// M3's shape system, as its two axes.
//
// AXIS 1 -- the scale, and the assignment onto it. M3 does not give each
// component a radius; it gives the system a set of named SLOTS
// (extra-small ... full, plus the Expressive rungs) and assigns every
// container to one: a card is `medium`, a dialog `extra-large`, a button
// `full`. Theming is re-pointing a slot, and every container sitting on it
// follows. This suite pins both halves: the assignment, so a component cannot
// drift off its slot silently, and the cascade, so re-pointing a slot on the
// root OR on any ancestor moves the containers below it -- Bootstrap's radius
// scale included, since it reads the same slots.
//
// AXIS 2 -- the corner family: `rounded` and `cut` in Material's spec
// (material-components-android exposes it as `shapeCornerFamily`), carried
// here by --m3-sys-corner-shape onto the CSS `corner-shape` property. Same
// radii, drawn differently.
//
// Plus the two things that fall out of axis 1: a control that is round BY
// IDENTITY (a radio, a switch handle, a spinner) has to survive a flattened
// scale, because a square radio is indistinguishable from a checkbox; and
// flattening the scale deletes the press and selection morph, which is what
// the emphasis tokens exist to give back.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');

// M3's scale, in px.
const SLOTS = {
  none: 0,
  'extra-small': 4,
  small: 8,
  medium: 12,
  large: 16,
  'large-increased': 20,
  'extra-large': 28,
  'extra-large-increased': 32,
  'extra-extra-large': 48,
  full: 9999,
};

// The assignment: [selector, slot, mode, corner].
//
//   mode "pill"  the container MORPHS, so it resolves `full` against half its
//                own height to keep the radius interpolable (mixins/pill());
//                its expected radius is height/2, not 9999. Only the controls
//                that actually morph do this.
//   corner       which corner carries the slot. Several M3 containers shape
//                only some of their corners -- a navigation drawer takes its
//                radius on the trailing edge, a bottom sheet and a filled
//                field on the top edge -- so the table names the corner
//                rather than assuming top-left.
const TL = 'borderTopLeftRadius';
const TR = 'borderTopRightRadius';

const ASSIGNMENT = [
  ['.m3-btn', 'full', 'pill', TL],
  ['.m3-icon-btn', 'full', 'pill', TL],
  ['.m3-fab', 'large', '', TL],
  ['.m3-fab--small', 'medium', '', TL],
  ['.m3-fab--large', 'extra-large', '', TL],
  ['.m3-segmented', 'full', '', TL],
  ['.m3-badge', 'full', '', TL],
  ['.m3-chip', 'small', '', TL],
  ['.m3-card', 'medium', '', TL],
  ['.m3-carousel__item', 'extra-large', '', TL],
  ['.m3-dialog', 'extra-large', '', TL],
  ['.m3-menu', 'extra-small', '', TL],
  ['.m3-snackbar', 'extra-small', '', TL],
  ['.m3-tooltip', 'extra-small', '', TL],
  ['.m3-search', 'full', '', TL],
  ['.m3-sheet--bottom', 'extra-large', '', TL],
  ['.m3-drawer--modal', 'large', '', TR],
  ['.m3-field--filled .m3-field__input', 'extra-small', '', TL],
  ['.m3-pane', 'large', '', TL],
  ['.m3-date-picker', 'large', '', TL],
  ['.m3-time-picker', 'extra-large', '', TL],
  ['.m3-toolbar:not(.m3-toolbar--docked)', 'full', '', TL],
  ['.m3-toolbar--docked', 'large', '', TL],
  ['.m3-color-palette', 'extra-small', '', TL],
  ['.m3-disclosure > summary', 'small', '', TL],
  ['.m3-time-picker__input', 'small', '', TL],
];

const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style>
<style>
  /* Re-pointing ONE slot on a plain ancestor -- no library class involved. */
  #slot { --md-sys-shape-corner-medium: 3px; }
  /* The corner family, M3's second axis. */
  #cut { --m3-sys-corner-shape: bevel; }
  /* A flattened scale: nothing left for the morph to say. */
  #flat {
    --md-sys-shape-corner-none: 0px; --md-sys-shape-corner-extra-small: 0px;
    --md-sys-shape-corner-small: 0px; --md-sys-shape-corner-medium: 0px;
    --md-sys-shape-corner-large: 0px; --md-sys-shape-corner-large-increased: 0px;
    --md-sys-shape-corner-extra-large: 0px; --md-sys-shape-corner-extra-large-increased: 0px;
    --md-sys-shape-corner-extra-extra-large: 0px; --md-sys-shape-corner-full: 0px;
  }
  /* ...and the same, with the emphasis tokens set. */
  #emp {
    --md-sys-shape-corner-medium: 0px; --md-sys-shape-corner-full: 0px;
    --m3-sys-emphasis-pressed-state-layer-opacity: 16%;
    --m3-sys-emphasis-selected-state-layer-opacity: 12%;
  }
</style></head><body>

<!-- one of each container, at its assigned slot -->
<div id="assigned">
  <button class="m3-btn m3-btn--filled" type="button">b</button>
  <button class="m3-icon-btn" type="button" aria-label="i"><span class="m3-icon">home</span></button>
  <button class="m3-fab" type="button" aria-label="f"><span class="m3-icon">add</span></button>
  <button class="m3-fab m3-fab--small" type="button" aria-label="fs"><span class="m3-icon">add</span></button>
  <button class="m3-fab m3-fab--large" type="button" aria-label="fl"><span class="m3-icon">add</span></button>
  <fieldset class="m3-segmented"><label class="m3-segmented__segment"><input class="m3-segmented__input" type="radio" name="sg" checked><span class="m3-segmented__label">s</span></label></fieldset>
  <span class="m3-badge">9</span>
  <button class="m3-chip m3-chip--assist" type="button">c</button>
  <div class="m3-card m3-card--outlined">card</div>
  <div class="m3-carousel"><div class="m3-carousel__item">i</div></div>
  <dialog class="m3-dialog m3-dialog--static" open>d</dialog>
  <div class="m3-menu m3-menu--static"><button class="m3-menu__item" type="button">m</button></div>
  <div class="m3-snackbar"><span class="m3-snackbar__text">s</span></div>
  <span class="m3-tooltip" role="tooltip">t</span>
  <div class="m3-search"><input class="m3-search__input" aria-label="q"></div>
  <dialog class="m3-sheet--bottom" open>sh</dialog>
  <dialog class="m3-drawer--modal" open>dr</dialog>
  <label class="m3-field m3-field--filled"><input class="m3-field__input" placeholder=" " value="v"><span class="m3-field__label">L</span></label>
  <div class="m3-toolbar m3-toolbar--docked" role="toolbar"><button class="m3-icon-btn" type="button" aria-label="td"><span class="m3-icon">add</span></button></div>
  <section class="m3-pane">p</section>
  <div class="m3-date-picker"><div class="m3-date-picker__grid"></div></div>
  <div class="m3-time-picker"><div class="m3-time-picker__fields"><label class="m3-time-picker__field"><input class="m3-time-picker__input" value="07" aria-label="h"></label></div></div>
  <div class="m3-toolbar" role="toolbar"><button class="m3-icon-btn" type="button" aria-label="tb"><span class="m3-icon">add</span></button></div>
  <div class="m3-color-palette"><div class="m3-color-palette__grid"></div></div>
  <details class="m3-disclosure"><summary>s</summary><p>b</p></details>
</div>

<!-- one slot re-pointed on a plain ancestor -->
<div id="slot">
  <div class="m3-card m3-card--outlined" id="slotCard">card</div>
  <div class="card" id="slotBsCard">bs card</div>
  <div class="m3-menu m3-menu--static" id="slotMenu"><button class="m3-menu__item" type="button">m</button></div>
</div>
<div class="m3-card m3-card--outlined" id="outsideCard">card</div>

<!-- corner family -->
<div id="cut">
  <button class="m3-btn m3-btn--filled" type="button" id="cutBtn">b</button>
  <div class="m3-card m3-card--outlined" id="cutCard">card</div>
  <input type="radio" class="m3-radio" id="cutRadio">
  <input type="checkbox" role="switch" class="m3-switch" id="cutSwitch">
  <span class="m3-spinner" id="cutSpinner"></span>
</div>
<button class="m3-btn m3-btn--filled" type="button" id="roundBtn">b</button>

<!-- a flattened scale, without and with the emphasis tokens -->
<div id="flat">
  <button class="m3-btn m3-btn--filled" type="button" id="flatToggle" aria-pressed="false">t</button>
  <button class="m3-btn m3-btn--filled" type="button" id="flatSelected" aria-pressed="true">t</button>
  <input type="radio" class="m3-radio" id="flatRadio">
  <input type="checkbox" role="switch" class="m3-switch" id="flatSwitch">
  <span class="m3-spinner" id="flatSpinner"></span>
</div>
<div id="emp">
  <button class="m3-btn m3-btn--filled" type="button" id="empToggle" aria-pressed="false">t</button>
  <button class="m3-btn m3-btn--filled" type="button" id="empSelected" aria-pressed="true">t</button>
</div>
</body></html>`;

async function run() {
  const server = await serve(ROOT, {
    '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'),
    '/shape.html': PAGE,
  });
  const browser = await launch();
  let r;
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1600 },
      reducedMotion: 'reduce',
    });
    await page.goto(`http://127.0.0.1:${server.port}/shape.html`);
    r = await page.evaluate(
      ([slots, assignment]) => {
        const px = (v) => Math.round(parseFloat(v) * 100) / 100;
        const radius = (el, corner) => px(getComputedStyle(el)[corner || 'borderTopLeftRadius']);
        const family = (el) => {
          const c = getComputedStyle(el);
          return c.cornerShape || c.getPropertyValue('corner-shape');
        };
        const byId = (id) => document.getElementById(id);
        const root = getComputedStyle(document.documentElement);
        return {
          supportsCornerShape: CSS.supports('corner-shape', 'bevel'),
          scale: Object.fromEntries(
            Object.keys(slots).map((n) => [
              n,
              px(root.getPropertyValue(`--md-sys-shape-corner-${n}`)),
            ]),
          ),
          assigned: Object.fromEntries(
            assignment.map(([sel, , , corner]) => {
              const el = document.querySelector(`#assigned ${sel}`);
              if (!el) return [sel, null];
              return [sel, { radius: radius(el, corner), height: px(getComputedStyle(el).height) }];
            }),
          ),
          slotMoved: {
            card: radius(byId('slotCard')),
            bsCard: radius(byId('slotBsCard')),
            menu: radius(byId('slotMenu')),
            outside: radius(byId('outsideCard')),
          },
          family: {
            btn: family(byId('cutBtn')),
            card: family(byId('cutCard')),
            round: family(byId('roundBtn')),
            radio: family(byId('cutRadio')),
            switch: family(byId('cutSwitch')),
            spinner: family(byId('cutSpinner')),
            btnRadius: radius(byId('cutBtn')),
            roundRadius: radius(byId('roundBtn')),
          },
          flat: {
            toggle: radius(byId('flatToggle')),
            selected: radius(byId('flatSelected')),
            toggleBg: getComputedStyle(byId('flatToggle')).backgroundColor,
            selectedBg: getComputedStyle(byId('flatSelected')).backgroundColor,
            radio: radius(byId('flatRadio')),
            switch: radius(byId('flatSwitch')),
            spinner: radius(byId('flatSpinner')),
          },
          emphasis: {
            toggleBg: getComputedStyle(byId('empToggle')).backgroundColor,
            selectedBg: getComputedStyle(byId('empSelected')).backgroundColor,
          },
        };
      },
      [SLOTS, ASSIGNMENT],
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

  // --- axis 1a: the scale resolves to M3's published values ------------------
  for (const [name, value] of Object.entries(SLOTS)) {
    expect(
      r.scale[name] === value,
      `--md-sys-shape-corner-${name} is ${r.scale[name]}px, expected M3's ${value}px`,
    );
  }

  // --- axis 1b: every container sits on its assigned slot -------------------
  // The "every container has a defined shape" half. A component that quietly
  // hardcodes a radius, or moves to another rung, shows up here.
  for (const [selector, slot, pill, corner] of ASSIGNMENT) {
    const got = r.assigned[selector];
    expect(!!got, `${selector} is missing from the fixture`);
    if (!got) continue;
    const want = pill === 'pill' ? got.height / 2 : SLOTS[slot];
    expect(
      Math.abs(got.radius - want) < 0.6,
      `${selector} should sit on the "${slot}" slot (${
        pill === 'pill' ? `a pill resolved against half its ${got.height}px height: ${want}px` : `${want}px`
      }) on ${corner === TR ? 'its trailing corner' : 'its leading corner'}; it renders ${got.radius}px`,
    );
  }

  // --- axis 1c: re-pointing ONE slot moves exactly its containers -----------
  expect(
    r.slotMoved.card === 3,
    `re-pointing --md-sys-shape-corner-medium on a plain ancestor must reach the containers on that slot: .m3-card renders ${r.slotMoved.card}px, expected 3px`,
  );
  expect(
    r.slotMoved.menu === SLOTS['extra-small'],
    `a container on a different slot must not move: .m3-menu renders ${r.slotMoved.menu}px, expected ${SLOTS['extra-small']}px`,
  );
  expect(
    r.slotMoved.outside === SLOTS.medium,
    `a container outside the subtree must not move: .m3-card renders ${r.slotMoved.outside}px, expected ${SLOTS.medium}px`,
  );

  // --- axis 2: the corner family -------------------------------------------
  if (r.supportsCornerShape) {
    expect(
      r.family.btn === 'bevel' && r.family.card === 'bevel',
      `the cut family should compute corner-shape: bevel on chrome; got button "${r.family.btn}" card "${r.family.card}"`,
    );
    expect(
      r.family.round === 'round',
      `the rounded family (the default) should compute corner-shape: round; got "${r.family.round}"`,
    );
    for (const id of ['radio', 'switch', 'spinner']) {
      expect(
        r.family[id] === 'round',
        `the ${id} is round by identity and must stay round under the cut family; got "${r.family[id]}"`,
      );
    }
  }
  // The family changes how a corner is drawn, not how big it is.
  expect(
    r.family.btnRadius === r.family.roundRadius,
    `the corner family must not resize corners: the cut button renders ${r.family.btnRadius}px against ${r.family.roundRadius}px rounded`,
  );

  // --- what falls out of a flattened scale ---------------------------------
  // The morph is the difference between two radii, so flattening the scale
  // deletes it. That much is arithmetic. What is not acceptable is losing the
  // signal with no way back, or squaring a control whose roundness is its
  // identity.
  expect(
    r.flat.toggle === 0 && r.flat.selected === 0,
    `a flattened scale should flatten the morph with it: toggle ${r.flat.toggle}px, selected ${r.flat.selected}px`,
  );
  expect(
    r.flat.toggleBg === r.flat.selectedBg,
    'with the scale flat and no emphasis tokens set, a selected button is indistinguishable from an unselected one -- this assertion documents the state the emphasis tokens exist to fix, so if it ever fails the docs below it are wrong',
  );
  expect(
    r.emphasis.toggleBg !== r.emphasis.selectedBg,
    `setting --m3-sys-emphasis-selected-state-layer-opacity must bring the selection signal back in colour: both buttons render ${r.emphasis.toggleBg}`,
  );
  for (const id of ['radio', 'switch', 'spinner']) {
    expect(
      r.flat[id] > 0,
      `the ${id} is round by identity, not by corner treatment, and a flattened scale must not square it (a square radio is indistinguishable from a checkbox); it renders ${r.flat[id]}px`,
    );
  }

  if (!failures.length) {
    console.log(
      `[shape] ${Object.keys(SLOTS).length} slots at M3's values; ${
        ASSIGNMENT.length
      } containers on their assigned slot; re-pointing one slot moves its containers and only those; corner family rounded/cut${
        r.supportsCornerShape ? '' : ' (corner-shape unsupported here)'
      } with identity circles pinned; a flat scale keeps its circles and hands the morph to the emphasis tokens: ok`,
    );
  }
  return failures;
}

module.exports = { run };
if (require.main === module)
  run().then((f) => {
    f.forEach((x) => console.log('  ' + x));
    process.exit(f.length ? 1 : 0);
  });
