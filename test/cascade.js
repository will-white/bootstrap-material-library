// Token cascade: re-pointing an upstream tier on any ancestor reaches the
// components below it, and an override of a component token on any ancestor
// still wins.
//
// A component token's default is emitted as the fallback of the var() that
// reads it, never as a :root declaration. CSS substitutes a var() where the
// declaration it sits in applies, so a :root declaration froze the whole
// chain at :root: an island re-pointed --md-sys-color-primary and the button
// token that read it did not move. These are the cases that regressed.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const ICON = '<span class="m3-icon">home</span>';

const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style>
<style>
  /* upstream tiers re-pointed on a plain ancestor, no library class involved */
  #role { --md-sys-color-primary: rgb(20, 30, 40); }
  #surface { --md-sys-color-surface-container-low: rgb(21, 31, 41); }
  #shape { --md-sys-shape-corner-full: 7px; }
  #space { --m3-sys-space-4: 33px; }
  /* the component token itself, which must keep beating the tiers above it */
  #token { --m3-btn-container-color: rgb(22, 32, 42); }
  #both { --md-sys-color-primary: rgb(1, 2, 3); --m3-btn-container-color: rgb(23, 33, 43); }
</style></head><body>
<button class="m3-btn m3-btn--filled" id="base">A</button>
<div id="role"><button class="m3-btn m3-btn--filled" id="roleBtn">A</button></div>
<div id="surface"><div class="m3-card" id="surfaceCard">c</div></div>
<div id="shape"><button class="m3-btn m3-btn--filled" id="shapeBtn">A</button></div>
<div id="space"><button class="m3-btn m3-btn--filled" id="spaceBtn">A</button></div>
<div id="token"><button class="m3-btn m3-btn--filled" id="tokenBtn">A</button></div>
<div id="both"><button class="m3-btn m3-btn--filled" id="bothBtn">A</button></div>

<!-- the shipped island utilities, which is where this was first noticed -->
<div class="m3-island--inverse" id="island">
  <button class="m3-btn m3-btn--filled" id="islandBtn">A</button>
  <div class="m3-card" id="islandCard">c</div>
  <span class="m3-chip m3-chip--assist" id="islandChip">c</span>
</div>
<button class="m3-btn m3-btn--filled" id="outsideBtn">A</button>

<!-- a forced contrast subtree re-points the same roles -->
<div data-contrast="high" id="hc"><button class="m3-btn m3-btn--filled" id="hcBtn">A</button></div>
${ICON}
</body></html>`;

async function run() {
  const server = await serve(ROOT, {
    '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'),
    '/cascade.html': PAGE,
  });
  const browser = await launch();
  let r;
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${server.port}/cascade.html`);
    r = await page.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      const px = (v) => Math.round(parseFloat(v) * 100) / 100;
      return {
        base: cs('base').backgroundColor,
        role: cs('roleBtn').backgroundColor,
        surface: cs('surfaceCard').backgroundColor,
        shape: px(cs('shapeBtn').borderTopLeftRadius),
        space: px(cs('spaceBtn').paddingLeft),
        token: cs('tokenBtn').backgroundColor,
        both: cs('bothBtn').backgroundColor,
        islandBtn: cs('islandBtn').backgroundColor,
        islandCard: cs('islandCard').backgroundColor,
        islandChip: cs('islandChip').color,
        outside: cs('outsideBtn').backgroundColor,
        islandRole: cs('islandBtn').getPropertyValue('--md-sys-color-primary').trim(),
        hc: cs('hcBtn').backgroundColor,
      };
    });
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  // State layers go through color-mix(in srgb, ...), so Chromium reports
  // color(srgb r g b) rather than rgb(); compare in one space.
  const rgb = (v) => {
    const c = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(v);
    if (c) return `rgb(${c.slice(1, 4).map((n) => Math.round(parseFloat(n) * 255)).join(', ')})`;
    return v;
  };

  // An upstream tier re-pointed on a plain ancestor reaches the component.
  expect(rgb(r.role) === 'rgb(20, 30, 40)', `system role re-pointed on an ancestor: button is ${rgb(r.role)}, expected rgb(20, 30, 40)`);
  expect(rgb(r.surface) === 'rgb(21, 31, 41)', `surface role re-pointed on an ancestor: card is ${rgb(r.surface)}, expected rgb(21, 31, 41)`);
  // corner-full is resolved against half the height for the morph, so a 7px
  // full corner is what the button takes.
  expect(r.shape === 7, `shape role re-pointed on an ancestor: radius is ${r.shape}, expected 7`);
  expect(r.space === 33, `library global re-pointed on an ancestor: padding is ${r.space}, expected 33`);

  // The component token still wins, on its own and over a re-pointed role.
  expect(rgb(r.token) === 'rgb(22, 32, 42)', `component token override: button is ${rgb(r.token)}, expected rgb(22, 32, 42)`);
  expect(rgb(r.both) === 'rgb(23, 33, 43)', `component token must beat a re-pointed role: button is ${rgb(r.both)}, expected rgb(23, 33, 43)`);

  // The island utilities re-tint components, not just inherited text.
  expect(r.islandRole !== '', 'island should re-point --md-sys-color-primary');
  expect(r.islandBtn !== r.outside, `island button ${r.islandBtn} should differ from the same button outside (${r.outside})`);
  expect(r.islandCard !== r.base, `island card ${r.islandCard} should take the island surface`);

  // A forced high-contrast subtree moves the same roles.
  expect(r.hc !== r.base, `high-contrast subtree button ${r.hc} should differ from the standard one (${r.base})`);

  if (!failures.length) {
    console.log('[cascade] roles, surfaces, shape and globals re-pointed on an ancestor reach components; component tokens still win; islands and forced contrast re-tint: ok');
  }
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { f.forEach((x) => console.log('  ' + x)); process.exit(f.length ? 1 : 0); });
