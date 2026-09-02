// Hit areas: the 48dp touch target of an icon button keeps its block-axis
// overhang everywhere, and inside a connected button group (and the dense
// toolbar) it never crosses the seam into a neighbour.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const ICON = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8"/></svg>';
const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style><style>body{margin:0;padding:120px}</style></head><body>
<div class="m3-button-group m3-button-group--connected" id="group">
  <button class="m3-btn m3-btn--tonal" type="button" aria-pressed="true">Bold</button>
  <button class="m3-btn m3-btn--tonal" type="button" aria-pressed="false" id="italic">Italic</button>
  <button class="m3-icon-btn m3-icon-btn--tonal" type="button" aria-label="Underline" id="underline">${ICON}</button>
</div>
<p><button class="m3-icon-btn" type="button" aria-label="Lone" id="lone">${ICON}</button></p>
<div class="m3-toolbar m3-toolbar--dense" id="bar"><div class="m3-toolbar__group">
  <button class="m3-icon-btn" type="button" aria-label="Undo" id="undo">${ICON}</button>
  <button class="m3-icon-btn" type="button" aria-label="Redo" id="redo">${ICON}</button>
</div></div>
</body></html>`;

async function run() {
  const server = await serve(ROOT, { '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'), '/hit.html': PAGE });
  const browser = await launch();
  let r;
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.goto(`http://127.0.0.1:${server.port}/hit.html`);
    r = await page.evaluate(() => {
      const id = (el) => (el && el.closest('button') ? el.closest('button').id || el.closest('button').textContent.trim() : String(el && el.tagName));
      const at = (x, y) => id(document.elementFromPoint(x, y));
      const italic = document.getElementById('italic').getBoundingClientRect();
      const underline = document.getElementById('underline').getBoundingClientRect();
      const lone = document.getElementById('lone').getBoundingClientRect();
      const undo = document.getElementById('undo').getBoundingClientRect();
      const redo = document.getElementById('redo').getBoundingClientRect();
      const hit = (el) => { const cs = getComputedStyle(document.getElementById(el), '::after'); return [parseFloat(cs.width), parseFloat(cs.height)]; };
      return {
        italicTrailingEdge: at(italic.right - 1, italic.top + italic.height / 2),
        underlineLeadingEdge: at(underline.left + 1, underline.top + underline.height / 2),
        underlineAbove: at(underline.left + underline.width / 2, underline.top - 3),
        underlineHit: hit('underline'), underlineWidth: underline.width,
        loneHit: hit('lone'), loneAbove: at(lone.left + lone.width / 2, lone.top - 3),
        undoTrailingEdge: at(undo.right - 1, undo.top + undo.height / 2),
        redoLeadingEdge: at(redo.left + 1, redo.top + redo.height / 2),
        denseHit: hit('undo'), denseWidth: undo.width,
      };
    });
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  const failures = [];
  const expect = (cond, msg) => { if (!cond) failures.push(msg); };
  expect(r.italicTrailingEdge === 'italic', `trailing edge of Italic hits ${r.italicTrailingEdge}`);
  expect(r.underlineLeadingEdge === 'underline', `leading edge of Underline hits ${r.underlineLeadingEdge}`);
  expect(r.underlineAbove === 'underline', `3px above Underline hits ${r.underlineAbove} (48dp block overhang expected)`);
  expect(Math.abs(r.underlineHit[0] - r.underlineWidth) < 0.5 && r.underlineHit[1] >= 48, `connected icon hit area ${r.underlineHit} for a ${r.underlineWidth}px member`);
  expect(r.loneHit[0] >= 48 && r.loneHit[1] >= 48 && r.loneAbove === 'lone', `standalone icon hit area ${r.loneHit}, above hits ${r.loneAbove}`);
  expect(r.undoTrailingEdge === 'undo' && r.redoLeadingEdge === 'redo', `dense toolbar edges hit ${r.undoTrailingEdge} / ${r.redoLeadingEdge}`);
  expect(Math.abs(r.denseHit[0] - r.denseWidth) < 0.5, `dense toolbar control hit width ${r.denseHit[0]} for a ${r.denseWidth}px control`);
  console.log(`[hit areas] ${failures.length ? failures.length + ' failures' : 'ok'}: ${JSON.stringify(r)}`);
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) { console.error(f.join('\n')); process.exit(1); } });
