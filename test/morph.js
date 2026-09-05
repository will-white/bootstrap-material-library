// Shape morphs, sampled every animation frame through a real press and
// release (button, icon button) and a selection change (a connected-group
// member's seam corner): the pill is half the control's height, never the
// 9999px corner-full token (which cannot interpolate), every transition
// shows intermediate frames, the spring's overshoot never clamps the radius
// toward square corners, and the radius settles on the target shape.
//
// Also M3's four transition patterns, driven to specific points on their own
// timelines: they are the other half of the library's motion, and they need
// a page WITHOUT reduced motion, which is what this suite already has.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const ICON = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8"/></svg>';
const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style><style>body{margin:0;padding:80px;display:flex;gap:40px;align-items:flex-start}</style></head><body>
<button class="m3-btn m3-btn--filled" type="button" id="btn">Send</button>
<button class="m3-icon-btn m3-icon-btn--tonal" type="button" aria-label="icon" id="icon">${ICON}</button>
<div class="m3-button-group m3-button-group--connected" role="group"><button class="m3-btn m3-btn--tonal" type="button" id="member" aria-pressed="false">Bold</button><button class="m3-btn m3-btn--tonal" type="button" aria-pressed="true">Italic</button></div>
<div style="position:absolute;visibility:hidden">
  <div class="m3-motion-fade-through" id="mo-ft-in"></div>
  <div class="m3-motion-fade-through-out" id="mo-ft-out"></div>
  <div class="m3-motion-shared-x" id="mo-x-in"></div>
  <div class="m3-motion-shared-x-out" id="mo-x-out"></div>
  <div class="m3-motion-shared-x m3-motion--reverse" id="mo-x-rev"></div>
  <div class="m3-motion-shared-y" id="mo-y-in"></div>
  <div class="m3-motion-shared-z" id="mo-z-in"></div>
  <div class="m3-motion-shared-z-out" id="mo-z-out"></div>
  <div class="m3-motion-fade" id="mo-fade"></div>
  <div class="m3-motion-fade-out" id="mo-fade-out"></div>
</div>
</body></html>`;

// Material Motion's cross-fade split: the outgoing half of a 300ms pattern
// owns the first 90ms, so 30% of the timeline is where one ends and the other
// begins, and both read zero opacity there.
const SPLIT = 0.3;

// Drive one pattern's animation to a fraction of its own duration and read
// back what the element computes.
const samplePattern = ([id, fractions]) => {
  const el = document.getElementById(id);
  const anim = el.getAnimations()[0];
  if (!anim) return null;
  const d = anim.effect.getTiming().duration;
  return {
    duration: d,
    at: fractions.map((f) => {
      anim.currentTime = d * f;
      const cs = getComputedStyle(el);
      return { opacity: Math.round(parseFloat(cs.opacity) * 100) / 100, translate: cs.translate, scale: cs.scale };
    }),
  };
};

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
  const patterns = {};
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

    // The transition patterns, driven to points on their own timelines.
    for (const [key, id, fractions] of [
      ['ftIn', 'mo-ft-in', [0, SPLIT, 1]],
      ['ftOut', 'mo-ft-out', [0, SPLIT]],
      ['xIn', 'mo-x-in', [0, SPLIT, 1]],
      ['xOut', 'mo-x-out', [0, SPLIT]],
      ['xRev', 'mo-x-rev', [0]],
      ['yIn', 'mo-y-in', [0, 1]],
      ['zIn', 'mo-z-in', [0, SPLIT, 1]],
      ['zOut', 'mo-z-out', [0, SPLIT, 1]],
      ['fade', 'mo-fade', [0, 1]],
      ['fadeOut', 'mo-fade-out', [0, 1]],
    ]) {
      patterns[key] = await page.evaluate(samplePattern, [id, fractions]);
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

  // --- transition patterns ----------------------------------------------------
  // Every pattern is ONE animation carrying both halves of Material Motion's
  // 90ms / 210ms cross-fade, so the sample at the split is where the outgoing
  // half has finished and the incoming half has not started: both read 0.
  const missing = Object.entries(patterns).filter(([, v]) => !v).map(([k]) => k);
  expect(missing.length === 0, `transition patterns with no animation: ${missing.join(', ')}`);
  if (!missing.length) {
    const p = patterns;
    // Fade through: 300ms, hidden until the split, growing from 92%.
    expect(p.ftIn.duration === 300, `fade-through-in duration ${p.ftIn.duration}, expected 300`);
    expect(p.ftIn.at[0].opacity === 0 && p.ftIn.at[1].opacity === 0 && p.ftIn.at[2].opacity === 1,
      `fade-through-in opacity ${p.ftIn.at.map((x) => x.opacity).join('/')}, expected 0/0/1`);
    expect(p.ftIn.at[0].scale === '0.92' && p.ftIn.at[2].scale === '1',
      `fade-through-in scale ${p.ftIn.at[0].scale} -> ${p.ftIn.at[2].scale}, expected 0.92 -> 1`);
    expect(p.ftOut.at[0].opacity === 1 && p.ftOut.at[1].opacity === 0,
      `fade-through-out opacity ${p.ftOut.at.map((x) => x.opacity).join('/')}, expected 1/0 by the split`);
    // Shared axis x and y: Material Motion's 30px, negated by --reverse.
    expect(p.xIn.at[0].translate === '30px' && p.xIn.at[2].translate === '0px',
      `shared-axis-x travel ${p.xIn.at[0].translate} -> ${p.xIn.at[2].translate}, expected 30px -> 0px`);
    expect(p.xIn.at[1].opacity === 0, `shared-axis-x is visible at the split (${p.xIn.at[1].opacity})`);
    expect(p.xRev.at[0].translate === '-30px', `shared-axis-x --reverse ${p.xRev.at[0].translate}, expected -30px`);
    expect(p.yIn.at[0].translate === '0px 30px', `shared-axis-y travel ${p.yIn.at[0].translate}, expected "0px 30px"`);
    // The travel has to be spent where the element can be SEEN. One animation
    // carries the fade and the transform, so if the transform is not pinned at
    // the split it interpolates across the whole timeline while the element is
    // visible for only part of it -- and the exit easing puts almost all of the
    // outgoing journey after it has faded out, which renders a shared axis as a
    // plain fade. At the split the arriving element must not have moved yet and
    // the leaving one must have arrived.
    expect(p.xIn.at[1].translate === '30px',
      `shared-axis-x-in has already travelled to ${p.xIn.at[1].translate} at the split; the visible half of the slide is what is left, so it should still be at 30px`);
    expect(p.xOut.at[1].translate === '-30px',
      `shared-axis-x-out has only reached ${p.xOut.at[1].translate} by the split, when it is already invisible; it should have covered the whole -30px while it could still be seen`);
    expect(p.zIn.at[1].scale === '0.8',
      `shared-axis-z-in has already grown to ${p.zIn.at[1].scale} at the split, expected 0.8`);
    expect(p.zOut.at[1].scale === '1.1',
      `shared-axis-z-out has only reached ${p.zOut.at[1].scale} by the split, expected the full 1.1`);
    // Shared axis z travels by scale: in from 80%, out past the viewer to 110%.
    expect(p.zIn.at[0].scale === '0.8' && p.zIn.at[2].scale === '1',
      `shared-axis-z-in scale ${p.zIn.at[0].scale} -> ${p.zIn.at[2].scale}, expected 0.8 -> 1`);
    expect(p.zOut.at[0].scale === '1' && p.zOut.at[2].scale === '1.1',
      `shared-axis-z-out scale ${p.zOut.at[0].scale} -> ${p.zOut.at[2].scale}, expected 1 -> 1.1`);
    // The plain fade is asymmetric: in from 80% over 150ms, out faster.
    expect(p.fade.duration === 150, `fade-in duration ${p.fade.duration}, expected 150`);
    expect(p.fade.at[0].scale === '0.8' && p.fade.at[1].scale === '1',
      `fade-in scale ${p.fade.at[0].scale} -> ${p.fade.at[1].scale}, expected 0.8 -> 1`);
    expect(p.fadeOut.duration < p.fade.duration,
      `fade-out (${p.fadeOut.duration}ms) should be faster than fade-in (${p.fade.duration}ms)`);
  }

  console.log(`morph: ${failures.length ? failures.length + ' failure(s)' : 'ok'} (${Object.entries(r).map(([k, v]) => `${k} ${v.radius}->${v.go[v.go.length - 1].toFixed(1)}->${v.back[v.back.length - 1].toFixed(1)}px, range ${Math.min(...v.go, ...v.back).toFixed(1)}..${Math.max(...v.go, ...v.back).toFixed(1)}`).join('; ')}; ${Object.keys(patterns).length} transition patterns)`);
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) { console.error(f.join('\n')); process.exit(1); } });
