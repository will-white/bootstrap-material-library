// Shape families, and the expression channel that swaps in when a family
// leaves no shape to morph.
//
// The premise, asserted rather than assumed: M3 Expressive signals a press
// and a selection by MORPHING the corner, so that signal is the difference
// between two radii. Flatten the scale and the difference is zero -- a
// square button cannot press squarer, and the control silently loses its
// feedback. This suite proves both halves: that a flat family really does
// flatten every rung (so the morph is a genuine no-op, not a half-flattened
// mess), and that the color channel then carries press and selection
// instead. It also pins the default build, where the shape channel is still
// the whole signal and every emphasis token is unset.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');

// Every rung of M3's published scale, in px, plus the pill.
const CORNERS = {
  none: 0,
  'extra-small': 4,
  small: 8,
  medium: 12,
  large: 16,
  'large-increased': 20,
  'extra-large': 28,
  'extra-large-increased': 32,
  'extra-extra-large': 48,
};

const TOGGLE = (id) =>
  `<button class="m3-btn m3-btn--filled" type="button" id="${id}" aria-pressed="false">Bold</button>`;

const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style></head><body>
<!-- the build default: M3's own family -->
<div id="default">
  ${TOGGLE('defaultBtn')}
  <div class="m3-card m3-card--outlined" id="defaultCard">c</div>
  <input type="radio" class="m3-radio" id="defaultRadio">
</div>

<!-- flat corners: nothing left to morph, so press and selection speak color -->
<div data-shape="sharp" id="sharp">
  ${TOGGLE('sharpBtn')}
  ${TOGGLE('sharpSelected')}
  <div class="m3-card m3-card--outlined" id="sharpCard">c</div>
  <div class="card" id="sharpBsCard">bs</div>
  <input type="radio" class="m3-radio" id="sharpRadio">
  <input type="checkbox" role="switch" class="m3-switch" id="sharpSwitch">
  <span class="m3-spinner" id="sharpSpinner"></span>
</div>

<!-- cut corners: the same radii, mitred; the shape channel stays -->
<div data-shape="cut" id="cut">
  ${TOGGLE('cutBtn')}
  <div class="m3-card m3-card--outlined" id="cutCard">c</div>
  <input type="radio" class="m3-radio" id="cutRadio">
  <input type="checkbox" role="switch" class="m3-switch" id="cutSwitch">
  <span class="m3-badge" id="cutBadge">4</span>
</div>

<!-- scaled up: every rung 1.5x, but a pill is already as round as it gets -->
<div data-shape="soft" id="soft">${TOGGLE('softBtn')}<div class="m3-card m3-card--outlined" id="softCard">c</div></div>

<!-- one probe button per shipped family, for the morph-clearance rule -->
<div id="probes">
  <button class="m3-btn m3-btn--filled" type="button" data-probe="rounded">p</button>
  <div data-shape="sharp"><button class="m3-btn m3-btn--filled" type="button" data-probe="sharp">p</button></div>
  <div data-shape="cut"><button class="m3-btn m3-btn--filled" type="button" data-probe="cut">p</button></div>
  <div data-shape="squircle"><button class="m3-btn m3-btn--filled" type="button" data-probe="squircle">p</button></div>
  <div data-shape="soft"><button class="m3-btn m3-btn--filled" type="button" data-probe="soft">p</button></div>
</div>

<!-- the utility form of the same family, on a subtree -->
<div class="m3-shape--sharp" id="utilSharp">${TOGGLE('utilSharpBtn')}</div>

<!-- nothing outside a family may move -->
${TOGGLE('outsideBtn')}
<div class="card" id="outsideBsCard">bs</div>
</body></html>`;

// Samples a computed corner every animation frame for `ms`.
const SAMPLER = `(el, corner, ms) => new Promise((res) => {
  const out = []; const t0 = performance.now();
  const tick = () => {
    out.push(parseFloat(getComputedStyle(el)[corner]));
    if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(out);
  };
  requestAnimationFrame(tick);
})`;

async function run() {
  const server = await serve(ROOT, {
    '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'),
    '/shape.html': PAGE,
  });
  const browser = await launch();
  let r, sharpPress, defaultPress, selectedBefore, selectedAfter, probes;
  try {
    // Motion on: the press has to be sampled while the spring runs, which is
    // the only way to tell "the morph is a no-op" from "the morph is fast".
    const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
    await page.goto(`http://127.0.0.1:${server.port}/shape.html`);

    // Press the flat-family button and the default one, sampling the radius
    // and the background through the whole spring.
    const press = async (id) => {
      const box = await page.locator(`#${id}`).boundingBox();
      const before = await page.evaluate(
        (i) => getComputedStyle(document.getElementById(i)).backgroundColor,
        id,
      );
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const radii = await page.evaluate(
        ([i, sampler]) => eval(sampler)(document.getElementById(i), 'borderTopLeftRadius', 420),
        [id, SAMPLER],
      );
      const held = await page.evaluate(
        (i) => getComputedStyle(document.getElementById(i)).backgroundColor,
        id,
      );
      await page.mouse.up();
      await page.mouse.move(0, 0);
      return { before, held, radii };
    };

    sharpPress = await press('sharpBtn');
    defaultPress = await press('defaultBtn');

    // The expression budget, per shipped family: the resting radius, the two
    // radii the morph actually settles on (driven for real -- the shape tokens
    // are unset by design, so there is nothing to read), and whether the
    // family declared the colour channel.
    probes = {};
    for (const el of await page.locator('[data-probe]').all()) {
      const family = await el.getAttribute('data-probe');
      const read = () =>
        page.evaluate((f) => {
          const n = document.querySelector(`[data-probe="${f}"]`);
          const c = getComputedStyle(n);
          const px = (v) => Math.round(parseFloat(v) * 100) / 100;
          return {
            radius: px(c.borderTopLeftRadius),
            height: px(c.height),
            colorChannel:
              c.getPropertyValue('--m3-sys-emphasis-selected-state-layer-opacity').trim() !== '',
          };
        }, family);

      const rest = await read();
      const box = await el.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(500);
      const pressed = await read();
      await page.mouse.up();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(500);
      await el.evaluate((n) => n.setAttribute('aria-pressed', 'true'));
      await page.waitForTimeout(500);
      const selected = await read();
      await el.evaluate((n) => n.setAttribute('aria-pressed', 'false'));

      probes[family] = {
        rest: rest.radius,
        pressed: pressed.radius,
        selected: selected.radius,
        height: rest.height,
        colorChannel: rest.colorChannel,
      };
    }

    // Select the flat-family toggle.
    selectedBefore = await page.evaluate(
      () => getComputedStyle(document.getElementById('sharpSelected')).backgroundColor,
    );
    await page.evaluate(() =>
      document.getElementById('sharpSelected').setAttribute('aria-pressed', 'true'),
    );
    await page.waitForTimeout(500);
    selectedAfter = await page.evaluate(() => ({
      bg: getComputedStyle(document.getElementById('sharpSelected')).backgroundColor,
      radius: parseFloat(
        getComputedStyle(document.getElementById('sharpSelected')).borderTopLeftRadius,
      ),
    }));

    r = await page.evaluate(
      (corners) => {
        const cs = (id) => getComputedStyle(document.getElementById(id));
        const tok = (id, name) => cs(id).getPropertyValue(name).trim();
        const px = (v) => Math.round(parseFloat(v) * 100) / 100;
        const scale = (id) => {
          const out = {};
          for (const name of Object.keys(corners)) {
            out[name] = px(tok(id, `--md-sys-shape-corner-${name}`));
          }
          out.full = px(tok(id, '--md-sys-shape-corner-full'));
          return out;
        };
        return {
          supportsCornerShape: CSS.supports('corner-shape', 'bevel'),
          defaultScale: scale('default'),
          sharpScale: scale('sharp'),
          cutScale: scale('cut'),
          softScale: scale('soft'),
          // The emphasis tokens: unset under M3's family, open under a flat one.
          defaultEmphasis: {
            pressed: tok('default', '--m3-sys-emphasis-pressed-state-layer-opacity'),
            selected: tok('default', '--m3-sys-emphasis-selected-state-layer-opacity'),
          },
          sharpEmphasis: {
            pressed: tok('sharp', '--m3-sys-emphasis-pressed-state-layer-opacity'),
            selected: tok('sharp', '--m3-sys-emphasis-selected-state-layer-opacity'),
          },
          // corner-shape follows the family, and the circles opt out of it.
          cornerShape: {
            default: cs('defaultBtn').cornerShape || cs('defaultBtn').getPropertyValue('corner-shape'),
            cut: cs('cutBtn').cornerShape || cs('cutBtn').getPropertyValue('corner-shape'),
            cutCard: cs('cutCard').cornerShape || cs('cutCard').getPropertyValue('corner-shape'),
            cutRadio: cs('cutRadio').cornerShape || cs('cutRadio').getPropertyValue('corner-shape'),
            cutSwitch: cs('cutSwitch').cornerShape || cs('cutSwitch').getPropertyValue('corner-shape'),
            cutBadge: cs('cutBadge').cornerShape || cs('cutBadge').getPropertyValue('corner-shape'),
          },
          // Radii themselves, to prove a flat family flattens and a cut one does not.
          radii: {
            sharpRadio: px(cs('sharpRadio').borderTopLeftRadius),
            sharpSwitch: px(cs('sharpSwitch').borderTopLeftRadius),
            sharpSpinner: px(cs('sharpSpinner').borderTopLeftRadius),
            cutBtn: px(cs('cutBtn').borderTopLeftRadius),
            cutBtnHeight: px(cs('cutBtn').height),
            cutPressed: px(tok('cutBtn', '--m3-btn-shape-pressed')),
            cutSelected: px(tok('cutBtn', '--m3-btn-shape-selected')),
            defaultCard: px(cs('defaultCard').borderTopLeftRadius),
            sharpCard: px(cs('sharpCard').borderTopLeftRadius),
            cutCard: px(cs('cutCard').borderTopLeftRadius),
            sharpBtn: px(cs('sharpBtn').borderTopLeftRadius),
            utilSharpBtn: px(cs('utilSharpBtn').borderTopLeftRadius),
            outsideBtn: px(cs('outsideBtn').borderTopLeftRadius),
            softCard: px(cs('softCard').borderTopLeftRadius),
            softBtn: px(cs('softBtn').borderTopLeftRadius),
            softBtnHeight: px(cs('softBtn').height),
          },
          // Bootstrap's radius scale has to follow the family too.
          bsRadius: {
            sharp: tok('sharp', '--bs-border-radius'),
            sharpCard: px(cs('sharpBsCard').borderTopLeftRadius),
            outsideCard: px(cs('outsideBsCard').borderTopLeftRadius),
          },
        };
      },
      CORNERS,
    );
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  const failures = [];
  const expect = (ok, msg) => {
    if (!ok) failures.push(msg);
  };

  // --- 1. the default build is M3 as specified -------------------------------
  for (const [name, px] of Object.entries(CORNERS)) {
    expect(
      r.defaultScale[name] === px,
      `default family: --md-sys-shape-corner-${name} is ${r.defaultScale[name]}px, expected ${px}px`,
    );
  }
  expect(
    r.defaultScale.full === 9999,
    `default family: corner-full is ${r.defaultScale.full}px, expected 9999px`,
  );
  expect(
    r.defaultEmphasis.pressed === '' && r.defaultEmphasis.selected === '',
    `default family must leave the emphasis tokens unset so the read sites fall back to M3's values; got pressed="${r.defaultEmphasis.pressed}" selected="${r.defaultEmphasis.selected}"`,
  );
  // Its shape channel still works: a real press moves the radius.
  const defaultSpread = Math.max(...spread(defaultPress.radii));
  expect(
    defaultSpread > 4,
    `default family: a press should morph the corner, but the radius moved only ${defaultSpread}px`,
  );

  // --- 2. a flat family flattens EVERY rung, pill included -------------------
  for (const name of Object.keys(CORNERS)) {
    expect(
      r.sharpScale[name] === 0,
      `sharp family: --md-sys-shape-corner-${name} is ${r.sharpScale[name]}px, expected 0`,
    );
  }
  expect(
    r.sharpScale.full === 0,
    `sharp family: corner-full is ${r.sharpScale.full}px, expected 0 -- a family with no corners has no pills, and a pill left standing is what makes the morph press a pill into a square`,
  );
  expect(r.radii.sharpCard === 0, `sharp family: card radius is ${r.radii.sharpCard}px, expected 0`);
  expect(r.radii.sharpBtn === 0, `sharp family: button radius is ${r.radii.sharpBtn}px, expected 0`);
  expect(
    r.radii.utilSharpBtn === 0,
    `.m3-shape--sharp must work like [data-shape="sharp"]: button radius is ${r.radii.utilSharpBtn}px, expected 0`,
  );
  // ...and nothing outside the subtree moves.
  expect(
    r.radii.outsideBtn > 0,
    `a family on a subtree must not reach outside it: the button outside has radius ${r.radii.outsideBtn}px`,
  );

  // --- 3. the morph is a no-op there, and color takes over -------------------
  const sharpSpread = Math.max(...spread(sharpPress.radii));
  expect(
    sharpSpread === 0,
    `sharp family: the shape morph must be a clean no-op, but the radius moved ${sharpSpread}px during a press`,
  );
  expect(
    r.sharpEmphasis.pressed !== '' && r.sharpEmphasis.selected !== '',
    'sharp family must open the emphasis channel it needs: both emphasis opacities should be set',
  );
  // Set is not enough: the channel has to open WIDER than M3's own pressed
  // layer, or a flat family's press would read no louder than a rounded
  // family's, which already had the corner morph on top of it.
  expect(
    parseFloat(r.sharpEmphasis.pressed) > 10,
    `sharp family: the pressed emphasis is ${r.sharpEmphasis.pressed}, which is not louder than M3's own 10% pressed layer -- the family gave up the shape channel and got nothing back`,
  );
  expect(
    parseFloat(r.sharpEmphasis.selected) > 0,
    `sharp family: the selected emphasis is ${r.sharpEmphasis.selected}, so a selected control carries no persistent tint`,
  );
  expect(
    sharpPress.held !== sharpPress.before,
    `sharp family: with no shape to morph, a press must still be visible -- background stayed ${sharpPress.before}`,
  );
  expect(
    selectedAfter.radius === 0 && selectedAfter.bg !== selectedBefore,
    `sharp family: selection must be visible without a shape change -- radius ${selectedAfter.radius}px, background ${selectedBefore} -> ${selectedAfter.bg}`,
  );

  // A control that is round BY IDENTITY is not round as a corner treatment,
  // and a family may not square it: a square radio is indistinguishable from
  // a checkbox, so single choice stops reading as single choice. They take
  // their radius from --m3-sys-shape-pill, which no family re-points.
  for (const [id, label] of [
    ['sharpRadio', 'radio'],
    ['sharpSwitch', 'switch'],
    ['sharpSpinner', 'spinner'],
  ]) {
    expect(
      r.radii[id] > 0,
      `sharp family: the ${label} is round by identity and must not be squared by a shape family; radius is ${r.radii[id]}px`,
    );
  }

  // --- 4. a cut family keeps the radii and re-cuts the geometry --------------
  for (const [name, px] of Object.entries(CORNERS)) {
    expect(
      r.cutScale[name] === px,
      `cut family: --md-sys-shape-corner-${name} is ${r.cutScale[name]}px, expected M3's ${px}px (a cut family re-cuts corners, it does not resize them)`,
    );
  }
  // ...except the roundest rung, which is capped. A bevel taken at half the
  // box height is a hexagon, not a cut corner, so an uncapped pill button
  // would come out as a six-sided badge.
  expect(
    r.cutScale.full < r.radii.cutBtnHeight / 2,
    `cut family: corner-full is ${r.cutScale.full}px on a ${r.radii.cutBtnHeight}px control, which mitres the full half-height into a hexagon rather than cutting a corner`,
  );
  expect(
    r.radii.cutBtn === r.cutScale.full,
    `cut family: the button should take the capped rung (${r.cutScale.full}px); got ${r.radii.cutBtn}px`,
  );
  expect(
    r.radii.cutCard === r.radii.defaultCard,
    `cut family: card radius is ${r.radii.cutCard}px, expected the default ${r.radii.defaultCard}px`,
  );
  if (r.supportsCornerShape) {
    expect(
      r.cornerShape.cut === 'bevel' && r.cornerShape.cutCard === 'bevel',
      `cut family: chrome should compute corner-shape: bevel; got button "${r.cornerShape.cut}" card "${r.cornerShape.cutCard}"`,
    );
    expect(
      r.cornerShape.default === 'round',
      `default family: chrome should compute corner-shape: round; got "${r.cornerShape.default}"`,
    );
    // Load-bearing circles opt out: a bevel on a radius that is half the box
    // turns a circle into a diamond.
    for (const id of ['cutRadio', 'cutSwitch', 'cutBadge']) {
      expect(
        r.cornerShape[id] === 'round',
        `${id} is a load-bearing circle and must stay round under a cut family; got "${r.cornerShape[id]}"`,
      );
    }
  }

  // The expression-budget rule, over every shipped family. A family either
  // leaves the shape channel a VISIBLE gap between its resting rung and its
  // morph targets, or it declares "emphasis": "color". A numeric difference
  // is not enough: `cut` capped at corner-medium landed exactly on the
  // selected rung, and `soft` scaled the selected rung to 2px under the pill
  // -- one morphs nothing, the other morphs invisibly, and both are the flat
  // family's problem arriving by a side door. MIN_GAP is half M3's smallest
  // rung. There is no multiplier that satisfies this at every size, because
  // the resting pill is half the control's height and shrinks with it, which
  // is exactly why a family that scales up needs the colour channel.
  const MIN_GAP = 4;
  for (const [family, p] of Object.entries(probes)) {
    if (p.colorChannel) continue;
    for (const state of ['pressed', 'selected']) {
      expect(
        Math.abs(p.rest - p[state]) >= MIN_GAP,
        `${family} family relies on the shape channel but its resting rung (${p.rest}px on a ${p.height}px button) is only ${Math.abs(p.rest - p[state])}px from the ${state} target (${p[state]}px) -- that morph is not visible, so the family needs "emphasis": "color" or a rung that clears it by ${MIN_GAP}px`,
      );
    }
  }
  // ...and a family that DID declare the colour channel has to have opened it.
  for (const [family, p] of Object.entries(probes)) {
    if (!p.colorChannel) continue;
    expect(
      family !== 'rounded',
      'the identity family must not declare the colour channel',
    );
  }

  // --- 5. a scaled family scales the rungs and leaves the pill alone --------
  // `full` does not mean 9999px, it means "as round as this box can be", so
  // scaling up must not touch it -- there is nothing rounder than a pill.
  expect(
    r.softScale.medium === CORNERS.medium * 1.5,
    `soft family: corner-medium is ${r.softScale.medium}px, expected ${CORNERS.medium * 1.5}px`,
  );
  expect(
    r.softScale.full === 9999,
    `soft family: corner-full is ${r.softScale.full}px, expected 9999px -- scaling a pill up is a no-op, not a bigger number`,
  );
  expect(
    r.radii.softCard === r.radii.defaultCard * 1.5,
    `soft family: card radius is ${r.radii.softCard}px, expected ${r.radii.defaultCard * 1.5}px`,
  );
  // The button is still a pill: corner-full resolves against half its height.
  expect(
    Math.abs(r.radii.softBtn - r.radii.softBtnHeight / 2) < 0.5,
    `soft family: the button should still be a pill (${r.radii.softBtnHeight / 2}px on a ${r.radii.softBtnHeight}px box); got ${r.radii.softBtn}px`,
  );

  // --- 6. Bootstrap's radius scale follows a family on a subtree ------------
  expect(
    r.bsRadius.sharpCard === 0,
    `a family must move Bootstrap's radius scale too: .card inside [data-shape="sharp"] has radius ${r.bsRadius.sharpCard}px, expected 0 (the alias is declared at :root and has to be re-resolved where the family applies)`,
  );
  expect(
    r.bsRadius.outsideCard > 0,
    `.card outside the family should keep its radius; got ${r.bsRadius.outsideCard}px`,
  );

  if (!failures.length) {
    console.log(
      `[shape] ${Object.keys(CORNERS).length + 1} rungs per family; flat family flattens the pill and the morph goes quiet while press and selection move to color; cut family re-cuts geometry${r.supportsCornerShape ? '' : ' (corner-shape unsupported here: rounded fallback)'} with circles pinned round; Bootstrap radii follow: ok`,
    );
  }
  return failures;
}

// The peak-to-trough spread of a sampled radius series: how far the corner
// actually travelled during the press.
function spread(series) {
  const clean = series.filter((n) => Number.isFinite(n));
  if (!clean.length) return [0];
  return [Math.round((Math.max(...clean) - Math.min(...clean)) * 100) / 100];
}

module.exports = { run };
if (require.main === module)
  run().then((f) => {
    f.forEach((x) => console.log('  ' + x));
    process.exit(f.length ? 1 : 0);
  });
