// Shape morphs, sampled every animation frame through a real press and
// release (button, icon button) and a selection change (a connected-group
// member's seam corner): the pill is half the control's height, never the
// 9999px corner-full token (which cannot interpolate), every transition
// shows intermediate frames, the spring's overshoot never clamps the radius
// toward square corners, and the radius settles on the target shape.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const ICON = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8"/></svg>';
const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style><style>body{margin:0;padding:80px;display:flex;gap:40px;align-items:flex-start}</style></head><body>
<button class="m3-btn m3-btn--filled" type="button" id="btn">Send</button>
<button class="m3-icon-btn m3-icon-btn--tonal" type="button" aria-label="icon" id="icon">${ICON}</button>
<div class="m3-button-group m3-button-group--connected" role="group"><button class="m3-btn m3-btn--tonal" type="button" id="member" aria-pressed="false">Bold</button><button class="m3-btn m3-btn--tonal" type="button" aria-pressed="true">Italic</button></div>
</body></html>`;

// One corner radius sampled every animation frame for `ms`.
const sample = async ([id, corner, ms]) => {
  const el = document.getElementById(id); const out = []; const t0 = performance.now();
  await new Promise((res) => { const tick = () => { const t = performance.now() - t0; out.push(parseFloat(getComputedStyle(el)[corner])); if (t < ms) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
  return out;
};

// press: the outer corner goes pill -> pressed shape and back under the mouse.
// select: a connected member's seam corner goes small -> pill and back as
// aria-pressed flips (the group's geometry rules, not :active, own it).
const CASES = [
  { id: 'btn', corner: 'borderTopLeftRadius', action: 'press', target: 8 },
  { id: 'icon', corner: 'borderTopLeftRadius', action: 'press', target: 8 },
  { id: 'member', corner: 'borderTopRightRadius', action: 'select', target: 'pill' },
];

async function run() {
  const server = await serve(ROOT, { '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'), '/morph.html': PAGE });
  const browser = await launch();
  const r = {};
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 }, reducedMotion: 'no-preference' });
    await page.goto(`http://127.0.0.1:${server.port}/morph.html`);
    for (const c of CASES) {
      const rest = await page.evaluate(([id, corner]) => { const cs = getComputedStyle(document.getElementById(id)); return { radius: parseFloat(cs[corner]), height: parseFloat(cs.height) }; }, [c.id, c.corner]);
      let go, back;
      if (c.action === 'press') {
        const box = await page.locator('#' + c.id).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        go = await page.evaluate(sample, [c.id, c.corner, 450]);
        await page.mouse.up();
        back = await page.evaluate(sample, [c.id, c.corner, 500]);
      } else {
        await page.evaluate((id) => document.getElementById(id).setAttribute('aria-pressed', 'true'), c.id);
        go = await page.evaluate(sample, [c.id, c.corner, 450]);
        await page.evaluate((id) => document.getElementById(id).setAttribute('aria-pressed', 'false'), c.id);
        back = await page.evaluate(sample, [c.id, c.corner, 500]);
      }
      r[c.id] = { ...rest, go, back, target: c.target === 'pill' ? rest.height / 2 : c.target, action: c.action };
    }
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  const failures = [];
  const expect = (cond, msg) => { if (!cond) failures.push(msg); };
  const near = (a, b, tol = 0.75) => Math.abs(a - b) <= tol;
  const fmt = (a) => a.map((x) => x.toFixed(1)).join(' ');
  // A run from `from` to `to`: intermediate frames visible, bounded overshoot, settles on `to`.
  const check = (id, name, run, from, to) => {
    const lo = Math.min(from, to); const hi = Math.max(from, to); const label = `\n  ${id} ${name}: [${fmt(run)}]`;
    expect(Math.min(...run) > lo - 3, `${id}: ${name} radius fell to ${Math.min(...run).toFixed(1)}px (clamped toward square corners)${label}`);
    expect(Math.max(...run) < hi + 3, `${id}: ${name} radius rose to ${Math.max(...run).toFixed(1)}px${label}`);
    expect(run.some((x) => x > lo + 2 && x < hi - 2), `${id}: ${name} shows no intermediate frame between ${from}px and ${to}px (snap)${label}`);
    expect(near(run[run.length - 1], to), `${id}: ${name} settled at ${run[run.length - 1]}px, expected ${to}px${label}`);
  };
  for (const [id, v] of Object.entries(r)) {
    if (v.action === 'press') expect(near(v.radius, v.height / 2), `${id}: resting radius ${v.radius}px is not half the ${v.height}px height (corner-full must resolve to a finite pill)`);
    else expect(near(v.radius, 8), `${id}: seam corner rests at ${v.radius}px, expected 8px`);
    check(id, v.action === 'press' ? 'press' : 'select', v.go, v.radius, v.target);
    check(id, v.action === 'press' ? 'release' : 'deselect', v.back, v.target, v.radius);
  }
  console.log(`morph: ${failures.length ? failures.length + ' failure(s)' : 'ok'} (${Object.entries(r).map(([k, v]) => `${k} ${v.radius}->${v.go[v.go.length - 1].toFixed(1)}->${v.back[v.back.length - 1].toFixed(1)}px, range ${Math.min(...v.go, ...v.back).toFixed(1)}..${Math.max(...v.go, ...v.back).toFixed(1)}`).join('; ')})`);
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) { console.error(f.join('\n')); process.exit(1); } });
