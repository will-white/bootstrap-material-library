// Rendering equivalence: every element of the one-of-everything fixture,
// every longhand that matters, compared against a baseline committed in
// test/fixtures/baseline.json.
//
// The other suites assert intent -- M3's numbers, the namespace contract, the
// cascade. This one asserts that nothing ELSE moved: a refactor that is meant
// to be behaviour-preserving either comes back clean or names exactly what it
// changed. Rewriting 802 token read sites is the sort of change it exists for.
//
// When a change is meant to alter rendering, review the reported differences
// and re-record:
//
//   npm run baseline
//
// The baseline is a string table plus per-element index arrays, so repeated
// values (most of them) cost two bytes.
//
// It also refuses to compare an unstyled page. An earlier ad-hoc version of
// this check swapped a <link> the fixture does not have, so both sides
// rendered bare and every comparison passed vacuously; the guard below is
// what makes a green result mean something.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(ROOT, 'test/fixtures');
const BASELINE = path.join(FIX, 'baseline.json');

const PROPS = [
  'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-bottom-style',
  'border-top-color', 'border-bottom-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'background-color', 'background-image', 'color', 'opacity', 'box-shadow', 'outline-width', 'outline-color', 'outline-offset',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-decoration-line', 'text-transform', 'white-space',
  'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'row-gap', 'column-gap', 'order', 'flex-grow', 'flex-shrink', 'flex-basis',
  'grid-template-columns', 'overflow-x', 'overflow-y', 'visibility', 'pointer-events', 'cursor',
  'z-index', 'translate', 'rotate', 'scale', 'transform', 'inset-block-start', 'inset-inline-start', 'inset-inline-end',
  'transition-property', 'transition-duration', 'transition-timing-function', 'animation-name', 'animation-duration',
  'mask-image', 'clip-path', 'content', 'accent-color', 'caret-color', 'aspect-ratio', 'object-fit', 'list-style-type',
];

// The fixture's popovers and dialogs are opened so their surfaces render.
const OPEN = `<script>addEventListener('DOMContentLoaded',()=>{for(const p of document.querySelectorAll('[popover]')){try{p.showPopover()}catch{}}for(const d of document.querySelectorAll('dialog[data-modal]')){try{d.showModal()}catch{}}})<\/script>`;

async function capture() {
  const fixture = fs.readFileSync(path.join(FIX, 'sink.html'), 'utf8');
  if (!fixture.includes('<!--HEAD-->')) throw new Error('sink.html lost its <!--HEAD--> placeholder');
  const server = await serve(ROOT, {
    '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'),
    '/page.html': fixture.replace('<!--HEAD-->', `<style>@import url("/m3x.css");</style>${OPEN}`),
  });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    // Nothing external: a font request that hangs would change metrics.
    await page.route('**://**', (r) => (r.request().url().includes('127.0.0.1') ? r.continue() : r.abort()));
    await page.goto(`http://127.0.0.1:${server.port}/page.html`, { waitUntil: 'load' });
    const shot = await page.evaluate((PROPS) => {
      const rows = [];
      let i = 0;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        const key = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}#${i++}`;
        rows.push([key, PROPS.map((p) => cs.getPropertyValue(p))]);
      }
      return rows;
    }, PROPS);
    await page.close();
    return shot;
  } finally {
    await browser.close();
    server.close();
  }
}

// A page that failed to load the stylesheet is not a comparison.
function assertStyled(rows) {
  const bg = PROPS.indexOf('background-color');
  const radius = PROPS.indexOf('border-top-left-radius');
  const painted = rows.filter(([, v]) => v[bg] && v[bg] !== 'rgba(0, 0, 0, 0)').length;
  const rounded = rows.filter(([, v]) => v[radius] && v[radius] !== '0px').length;
  if (painted < 20 || rounded < 20) {
    throw new Error(`the fixture rendered unstyled (${painted} painted, ${rounded} rounded) -- the comparison would be vacuous`);
  }
}

function encode(rows) {
  const table = new Map();
  const idx = (v) => {
    if (!table.has(v)) table.set(v, table.size);
    return table.get(v);
  };
  const elements = rows.map(([key, values]) => [key, values.map(idx)]);
  return { props: PROPS, values: [...table.keys()], elements };
}

function decode(baseline) {
  return baseline.elements.map(([key, ids]) => [key, ids.map((i) => baseline.values[i])]);
}

async function record() {
  const rows = await capture();
  assertStyled(rows);
  fs.writeFileSync(BASELINE, JSON.stringify(encode(rows)));
  const kb = Math.round(fs.statSync(BASELINE).size / 1024);
  console.log(`recorded ${rows.length} elements x ${PROPS.length} properties -> test/fixtures/baseline.json (${kb} KB)`);
}

async function run() {
  if (!fs.existsSync(BASELINE)) {
    return ['no baseline recorded: run `npm run baseline` and commit test/fixtures/baseline.json'];
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const rows = await capture();
  assertStyled(rows);

  const failures = [];
  if (baseline.props.join() !== PROPS.join()) {
    return ['the baseline was recorded for a different property list: re-record with `npm run baseline`'];
  }
  const was = new Map(decode(baseline));
  const now = new Map(rows);
  if (was.size !== now.size) {
    failures.push(`element count changed: ${was.size} -> ${now.size} (the fixture itself changed; re-record)`);
  }

  const diffs = [];
  for (const [key, values] of now) {
    const before = was.get(key);
    if (!before) continue;
    for (let i = 0; i < PROPS.length; i++) {
      if (before[i] !== values[i]) diffs.push(`${key} ${PROPS[i]}: ${before[i]} -> ${values[i]}`);
    }
  }
  if (diffs.length) {
    failures.push(`${diffs.length} computed declaration(s) differ from the baseline across ${new Set(diffs.map((d) => d.split(' ')[0])).size} element(s); review, then re-record with \`npm run baseline\``);
    for (const d of diffs.slice(0, 12)) failures.push(`    ${d}`);
    if (diffs.length > 12) failures.push(`    ... and ${diffs.length - 12} more`);
  }

  if (!failures.length) {
    console.log(`[equivalence] ${now.size} elements x ${PROPS.length} properties match the baseline`);
  }
  return failures;
}

module.exports = { run, record };
if (require.main === module) {
  const fn = process.argv.includes('--record') ? record().then(() => []) : run();
  fn.then((f) => { (f || []).forEach((x) => console.log('  ' + x)); process.exit((f || []).length ? 1 : 0); })
    .catch((e) => { console.error('  ' + e.message); process.exit(1); });
}
