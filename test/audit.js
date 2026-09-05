// Differential audits in headless Chromium:
//   1. box ownership -- every component's chrome computes identically on a
//      clean page and on a hostile host (stock bootstrap.css plus a universal
//      hostile rule in the reserved `bootstrap` layer);
//   2. stock parity -- Bootstrap-vocabulary markup renders identically with
//      and without stock bootstrap.css loaded in that layer (light + dark),
//      on the $enable-bootstrap-important-parity build.
// Fixtures: test/fixtures/sink.html (one of everything), hostile.css.
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const SINK = fs.readFileSync(path.join(FIX, 'sink.html'), 'utf8');
const LAYERS = '@layer reset, bootstrap, tokens, bootstrap-compat, base, components, utilities, overrides;';
const OPEN = `<script>addEventListener('DOMContentLoaded',()=>{for(const p of document.querySelectorAll('[popover]')){try{p.showPopover()}catch{}}for(const d of document.querySelectorAll('dialog[data-modal]')){try{d.showModal()}catch{}}})</script>`;

const PROPS = [
  'display','position','z-index','float','clear','max-width','max-height','min-width','min-height',
  'margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left',
  'overflow-x','overflow-y','flex-grow','flex-shrink','flex-basis','order','align-self','justify-self','row-gap','column-gap','column-count','aspect-ratio','box-sizing',
  'border-top-width','border-right-width','border-bottom-width','border-left-width',
  'border-top-style','border-right-style','border-bottom-style','border-left-style',
  'border-top-color','border-right-color','border-bottom-color','border-left-color',
  'border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius','border-image-source',
  'outline-style','outline-width','outline-offset',
  'background-color','background-image','background-size','background-position-x','background-repeat','background-clip','background-origin','background-attachment',
  'box-shadow','opacity','transform','translate','rotate','scale','filter','backdrop-filter','clip-path','mask-image','mix-blend-mode','isolation','will-change','contain',
  'animation-name','transition-property','transition-duration','appearance','resize','object-fit','object-position','user-select','touch-action','box-decoration-break',
  'text-decoration-line','text-underline-offset','text-overflow','vertical-align',
  'font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','text-indent','text-transform','text-shadow','text-align','text-emphasis-style',
  'white-space','hyphens','overflow-wrap','word-break','list-style-type','list-style-position','quotes','font-variant-caps','font-stretch','font-kerning','font-feature-settings',
  'color','cursor','visibility','pointer-events','caret-color','color-scheme','image-rendering','content',
];
const TYPO = new Set(['font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','text-indent','text-transform','text-shadow','text-align','text-emphasis-style','white-space','hyphens','overflow-wrap','word-break','quotes','font-variant-caps','font-stretch','font-kerning','font-feature-settings','color']);
const TEXT = new Set([...TYPO, 'visibility','pointer-events','cursor','color-scheme','image-rendering','list-style-type','list-style-position','caret-color']);
const NOT_CHROME_RE = /m3-badge-anchor|m3-tooltip-anchor|^div\.container|^div\.row|\.col(-|\.|#)|^div\.col#/;
const KNOWN_RE = /text-bg-/;
// Chrome whose color follows its surroundings by design: placeholders, and
// .m3-icon glyphs, which take the color of the control that holds them.
const FOLLOWS_TEXT_RE = /\.placeholder|\.m3-icon(?:\.|#)/;
const CONTENT_RE = /__slot|__content|card-body|card-header|card-footer|modal-body|accordion-body|offcanvas-body|toast-body|popover-body|alert(?!-link)|dropdown-item-text|navbar-text|list-group-item(?!-action)|carousel-caption|carousel-item|carousel__item|table|section|m3-pane(?!-layout)/;

const same = (a, b) => {
  if (a === b) return true;
  const ra = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(a), rb = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(b);
  if (!ra || !rb) return false;
  return ra.slice(1, 4).every((x, i) => Math.abs(+x - +rb[i + 1]) <= 6) && ra[4] === rb[4];
};

function bootstrapCss() {
  const candidates = [path.join(ROOT, 'node_modules/bootstrap/dist/css/bootstrap.css'), path.join(FIX, 'bootstrap.css')];
  for (const c of candidates) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  throw new Error('stock bootstrap.css not found: npm i, or drop a copy at test/fixtures/bootstrap.css');
}

function parityCss() {
  return sass.compileString('@use "src" with ($enable-bootstrap-important-parity: true);', { loadPaths: [ROOT], quietDeps: true, logger: sass.Logger.silent }).css;
}

async function snapshot(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', (e) => console.error('page error', url, String(e)));
  await page.goto(url);
  await page.waitForTimeout(150);
  const out = await page.evaluate((PROPS) => {
    const ctx = document.createElement('canvas').getContext('2d');
    const COLOR = /^(color|caret-color|background-color|outline-color|border-(top|right|bottom|left)-color)$/;
    const canon = (v) => {
      if (v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return 'transparent';
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = v; ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${(d[3] / 255).toFixed(1)})`;
    };
    const DISPLAY = { 'inline-flex': 'flex', 'inline-grid': 'grid', 'inline-block': 'block', inline: 'block', 'inline-table': 'table' };
    const res = {}; let i = 0;
    for (const el of document.querySelectorAll('#sink [class]')) {
      const key = el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + '#' + (i++);
      const tag = el.tagName.toLowerCase(), role = el.getAttribute('role') || '';
      const cs0 = getComputedStyle(el);
      const flags = {
        __hasText: [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0),
        __interactive: (/^(button|a|input|select|textarea|label|summary)$/.test(tag) || /^(button|link|tab|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|radio|switch|slider|searchbox|textbox|combobox|spinbutton)$/.test(role)) && cs0.pointerEvents !== 'none',
        __editable: tag === 'textarea' || (tag === 'input' && !/^(checkbox|radio|range|file|color|submit|button|reset|image|hidden)$/.test(el.type)),
        __util: !!el.closest('#utils'),
        __list: /^(ul|ol|li)$/.test(tag),
      };
      for (const pseudo of [null, '::before', '::after']) {
        const cs = pseudo ? getComputedStyle(el, pseudo) : cs0;
        const rec = {};
        for (const p of PROPS) { let v = cs.getPropertyValue(p); if (COLOR.test(p)) v = canon(v); else if (p === 'display') v = DISPLAY[v] || v; rec[p] = v; }
        if (!pseudo) Object.assign(rec, flags);
        res[key + (pseudo || '')] = rec;
      }
    }
    return res;
  }, PROPS);
  await page.close();
  return out;
}

function ownership(clean, hostile) {
  const leaks = {}, content = {}, known = {}; let total = 0;
  for (const key of Object.keys(clean)) {
    const c = clean[key], h = hostile[key]; if (!h) continue;
    const isPseudo = /::(before|after)$/.test(key);
    const owner = clean[key.replace(/::(before|after)$/, '')];
    if (NOT_CHROME_RE.test(key) || owner.__util) continue;
    const isContent = CONTENT_RE.test(key), isKnown = KNOWN_RE.test(key);
    const d = [];
    if (isPseudo) {
      const cNone = c.content === 'none', hNone = h.content === 'none';
      if (cNone && hNone) continue;
      if (cNone !== hNone) { leaks[key] = [`content: ${c.content} -> ${h.content}`]; total++; continue; }
    }
    for (const p of PROPS) {
      if (p === 'content' || same(c[p], h[p])) continue;
      if (isContent && TEXT.has(p)) { (content[key] ||= []).push(p); continue; }
      const side = /^border-(top|right|bottom|left)-color$/.exec(p);
      if (side && c[`border-${side[1]}-style`] === 'none' && h[`border-${side[1]}-style`] === 'none') continue;
      if (/^margin-/.test(p) && (Math.abs(parseFloat(c[p])) > 50 || Math.abs(parseFloat(h[p])) > 50)) continue;
      if (isKnown && (p === 'color' || p === 'background-color')) { (known[key] ||= []).push(p); continue; }
      if (FOLLOWS_TEXT_RE.test(key) && (p === 'color' || p === 'background-color')) { (content[key] ||= []).push(p); continue; }
      if (!isPseudo && !c.__hasText && TYPO.has(p)) continue;
      if (p === 'caret-color' && !owner.__editable) continue;
      if (p === 'cursor' && !owner.__interactive) continue;
      if (/^list-style/.test(p) && !owner.__list) continue;
      d.push(`${p}: ${c[p]} -> ${h[p]}`);
    }
    if (d.length) { leaks[key] = d; total += d.length; }
  }
  return { leaks, total, content: Object.keys(content).length, known: Object.keys(known).length, elements: Object.keys(clean).length / 3 };
}

function parity(a, b) {
  const diffs = {}; let n = 0;
  for (const key of Object.keys(a)) {
    const c = a[key], s = b[key]; if (!s) continue;
    if (/::/.test(key) && c.content === 'none' && s.content === 'none') continue;
    const d = [];
    for (const p of PROPS) {
      if (same(c[p], s[p])) continue;
      const side = /^border-(top|right|bottom|left)-color$/.exec(p);
      if (side && c[`border-${side[1]}-style`] === 'none' && s[`border-${side[1]}-style`] === 'none') continue;
      if (/^margin-/.test(p) && (Math.abs(parseFloat(c[p])) > 50 || Math.abs(parseFloat(s[p])) > 50)) continue;
      d.push(`${p}: ${c[p]} -> ${s[p]}`);
    }
    if (d.length) { diffs[key] = d; n += d.length; }
  }
  return { diffs, total: n };
}

async function run({ verbose = false } = {}) {
  const dist = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');
  const memory = {
    '/m3x.css': dist,
    '/m3x-parity.css': parityCss(),
    '/bootstrap.css': bootstrapCss(),
    '/hostile.css': fs.readFileSync(path.join(FIX, 'hostile.css'), 'utf8'),
  };
  const head = (css, imports) => `<style>${imports ? LAYERS + imports : ''}@import url("${css}");</style>` + OPEN;
  const pages = {
    'clean': head('/m3x.css'),
    'hostile': head('/m3x.css', '@import url("/hostile.css") layer(bootstrap);@import url("/bootstrap.css") layer(bootstrap);'),
    'parity-clean': head('/m3x-parity.css'),
    'parity-stock': head('/m3x-parity.css', '@import url("/bootstrap.css") layer(bootstrap);'),
  };
  for (const [name, h] of Object.entries(pages)) {
    memory[`/${name}.html`] = SINK.replace('<!--HEAD-->', h);
    memory[`/${name}-dark.html`] = SINK.replace('<!--HEAD-->', h).replace('<html', '<html data-theme="dark"');
  }
  const server = await serve(ROOT, memory);
  const browser = await launch();
  const R = {};
  try {
    for (const v of ['clean', 'hostile', 'parity-clean', 'parity-stock', 'parity-clean-dark', 'parity-stock-dark']) {
      R[v] = await snapshot(browser, `http://127.0.0.1:${server.port}/${v}.html`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  const failures = [];
  const own = ownership(R.clean, R.hostile);
  console.log(`[ownership] elements: ${own.elements}; chrome elements with leaks: ${Object.keys(own.leaks).length}; leaked declarations: ${own.total}; content-region inherited (allowed): ${own.content}; known !important residuals: ${own.known}`);
  if (own.total) {
    failures.push(`ownership: ${own.total} leaked declarations`);
    for (const [k, d] of Object.entries(own.leaks)) console.log(verbose ? `  [${k}]\n    ${d.join('\n    ')}` : `  ${String(d.length).padStart(3)}  ${k}`);
  }
  for (const [a, b, label] of [['parity-clean', 'parity-stock', 'light'], ['parity-clean-dark', 'parity-stock-dark', 'dark']]) {
    const p = parity(R[a], R[b]);
    console.log(`[stock parity ${label}] elements differing: ${Object.keys(p.diffs).length}; differing declarations: ${p.total}`);
    if (p.total) {
      failures.push(`stock parity ${label}: ${p.total} differing declarations`);
      for (const [k, d] of Object.entries(p.diffs)) console.log(verbose ? `  [${k}]\n    ${d.join('\n    ')}` : `  ${String(d.length).padStart(3)}  ${k}`);
    }
  }
  return failures;
}

module.exports = { run };
if (require.main === module) run({ verbose: process.argv.includes('--verbose') }).then((f) => { if (f.length) { console.error(f.join('\n')); process.exit(1); } });
