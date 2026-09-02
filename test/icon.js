// Icon contract: without an icon font a .m3-icon renders nothing (the
// embedded blank face) and keeps its box; containers set the opsz axis to
// the icon size and selected controls set FILL 1.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style><style>body{margin:0;padding:40px}</style></head><body>
<span class="m3-icon" id="lone">notifications</span>
<button class="m3-btn m3-btn--filled" type="button" id="btn"><span class="m3-icon">send</span>Send</button>
<button class="m3-icon-btn m3-icon-btn--xl" type="button" aria-label="xl" id="xl"><span class="m3-icon">favorite</span></button>
<button class="m3-icon-btn" type="button" aria-label="pressed" aria-pressed="true" id="pressed"><span class="m3-icon">star</span></button>
<div class="m3-toolbar m3-toolbar--dense"><div class="m3-toolbar__group"><button class="m3-icon-btn" type="button" aria-label="dense" id="dense"><span class="m3-icon">undo</span></button></div></div>
<button class="m3-fab m3-fab--large" type="button" aria-label="fab" id="fab"><span class="m3-icon">edit</span></button>
</body></html>`;

async function run() {
  const server = await serve(ROOT, { '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'), '/icon.html': PAGE });
  const browser = await launch();
  let r;
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto(`http://127.0.0.1:${server.port}/icon.html`);
    r = await page.evaluate(async () => {
      await document.fonts.ready;
      const faces = [...document.fonts].map((f) => `${f.family}:${f.status}`);
      const probe = (sel) => {
        const el = document.querySelector(sel);
        const range = document.createRange();
        range.selectNodeContents(el);
        const ink = range.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { text: el.textContent, ink: +ink.width.toFixed(2), w: +box.width.toFixed(2), h: +box.height.toFixed(2), fvs: cs.fontVariationSettings, family: cs.fontFamily };
      };
      return { faces, lone: probe('#lone'), btn: probe('#btn .m3-icon'), xl: probe('#xl .m3-icon'), pressed: probe('#pressed .m3-icon'), dense: probe('#dense .m3-icon'), fab: probe('#fab .m3-icon') };
    });
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  const failures = [];
  const expect = (cond, msg) => { if (!cond) failures.push(msg); };
  expect(r.faces.some((f) => /m3x-icon-blank:loaded/.test(f)), `blank fallback face not loaded (${r.faces.join(', ') || 'no faces'})`);
  for (const [k, v] of Object.entries(r)) {
    if (k === 'faces') continue;
    expect(v.ink === 0, `${k}: "${v.text}" paints ${v.ink}px of text without an icon font`);
    expect(/m3x-icon-blank/.test(v.family), `${k}: font-family ${v.family} lacks the blank fallback`);
  }
  expect(r.lone.w === 24 && r.lone.h === 24, `lone icon box ${r.lone.w}x${r.lone.h}, expected 24x24`);
  expect(r.btn.w === 18 && /"opsz" 20/.test(r.btn.fvs), `button icon ${r.btn.w}px ${r.btn.fvs}, expected 18px at opsz 20`);
  expect(r.xl.w === 40 && /"opsz" 40/.test(r.xl.fvs), `xl icon-button icon ${r.xl.w}px ${r.xl.fvs}, expected 40px at opsz 40`);
  expect(r.dense.w === 20 && /"opsz" 20/.test(r.dense.fvs), `dense toolbar icon ${r.dense.w}px ${r.dense.fvs}, expected 20px at opsz 20`);
  expect(r.fab.w === 36 && /"opsz" 36/.test(r.fab.fvs), `large FAB icon ${r.fab.w}px ${r.fab.fvs}, expected 36px at opsz 36`);
  expect(/"FILL" 1/.test(r.pressed.fvs), `pressed icon-button icon ${r.pressed.fvs}, expected FILL 1`);
  console.log(`icon: ${failures.length ? failures.length + ' failure(s)' : 'ok'} (blank fallback, boxes, opsz, fill)`);
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) { console.error(f.join('\n')); process.exit(1); } });
