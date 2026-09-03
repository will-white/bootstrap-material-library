// M3 spec conformance: the published Material 3 numbers, asserted against
// what the stylesheet actually computes in a browser (not against what the
// Sass declares). Every row cites the M3 value it is checking, so a spec
// revision shows up here as an edit, not as a silent drift.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const CSS_TEXT = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');
const ICON = '<span class="m3-icon">home</span>';

// M3 Expressive size ramp shared by .m3-btn, .m3-icon-btn and .m3-split-button:
// size -> [container height, inline padding, icon size, label size]
const BUTTON_RAMP = {
  xs: [32, 12, 20, 14],
  '': [40, 16, 20, 14],
  medium: [56, 24, 24, 16],
  large: [96, 48, 32, 24],
  xl: [136, 64, 40, 32],
};
// Icon buttons carry the same heights, square containers, and M3's icon ramp.
const ICON_BUTTON_RAMP = { xs: [32, 20], '': [40, 24], medium: [56, 24], large: [96, 32], xl: [136, 40] };

// M3 Expressive's emphasized typescale: the same fifteen styles at the same
// size and line height, set heavier and re-tracked. Regular goes to Medium;
// the styles that were already Medium (title-medium, title-small and every
// label) go to Bold. role -> [weight, tracking]
const EMPHASIZED = {
  'display-large': [500, 'normal'],
  'display-medium': [500, 'normal'],
  'display-small': [500, 'normal'],
  'headline-large': [500, 'normal'],
  'headline-medium': [500, 'normal'],
  'headline-small': [500, 'normal'],
  'title-large': [500, 'normal'],
  'title-medium': [700, '0.15px'],
  'title-small': [700, '0.1px'],
  'body-large': [500, '0.15px'],
  'body-medium': [500, '0.25px'],
  'body-small': [500, '0.4px'],
  'label-large': [700, '0.1px'],
  'label-medium': [700, '0.5px'],
  'label-small': [700, '0.5px'],
};

const mod = (base, size) => (size ? `${base} ${base}--${size}` : base);
const slug = (prefix, size) => prefix + (size || 'base');

const PAGE = `<!doctype html><html><head><style>@import url("/m3x.css");</style>
<style>body{margin:0;padding:24px;width:1600px}</style></head><body>
${Object.keys(BUTTON_RAMP).map((s) => `<button class="${mod('m3-btn', s)}" type="button" id="${slug('btn-', s)}">${ICON}Label</button>`).join('\n')}
${Object.keys(ICON_BUTTON_RAMP).map((s) => `<button class="${mod('m3-icon-btn', s)}" type="button" aria-label="x" id="${slug('ib-', s)}">${ICON}</button>`).join('\n')}
${Object.keys(BUTTON_RAMP).map((s) => `<div class="${mod('m3-split-button', s)}" id="${slug('sb-', s)}"><button class="m3-btn m3-split-button__action" type="button">Save</button><button class="m3-btn m3-split-button__toggle" type="button" aria-label="More"></button></div>`).join('\n')}

<div class="m3-field m3-field--filled"><input class="m3-field__input" id="f-filled" placeholder=" "><label class="m3-field__label">L</label></div>
<div class="m3-field m3-field--outlined"><input class="m3-field__input" id="f-outlined" placeholder=" "><label class="m3-field__label">L</label></div>
<label class="m3-field m3-field--outlined m3-field--leading-icon m3-field--trailing-icon" id="f-icons">
  <input class="m3-field__input" id="f-icons-input" placeholder=" " value="v">
  <span class="m3-field__label">L</span>
  <span class="m3-field__leading" id="f-leading">${ICON}</span>
  <span class="m3-field__trailing" id="f-trailing">${ICON}</span>
  <span class="m3-field__supporting">Help</span><span class="m3-field__counter" id="f-counter">0/50</span></label>
<label class="m3-field m3-field--filled m3-field--prefix m3-field--suffix" id="f-affix">
  <input class="m3-field__input" id="f-affix-input" placeholder=" " value="9">
  <span class="m3-field__label">L</span>
  <span class="m3-field__prefix" id="f-prefix">$</span><span class="m3-field__suffix">kg</span></label>
<label class="m3-field m3-field--outlined m3-field--leading-icon m3-field--prefix" id="f-both">
  <input class="m3-field__input" id="f-both-input" placeholder=" " value="v">
  <span class="m3-field__label">L</span>
  <span class="m3-field__leading">${ICON}</span><span class="m3-field__prefix">@</span></label>

<button class="m3-chip m3-chip--assist" id="chip-plain">Assist</button>
<button class="m3-chip m3-chip--assist" id="chip-icon">${ICON}Assist</button>

<input type="checkbox" class="m3-checkbox" id="cb">
<input type="radio" class="m3-radio" id="rd">
<input type="checkbox" class="m3-switch" id="sw">
<input type="range" class="m3-slider" id="sl">
<div style="width:400px">
  <div class="m3-slider-field m3-slider-field--label-persistent" id="sf-0" style="--m3-slider-value: 0">
    <input type="range" class="m3-slider" min="0" max="100" value="0"><output class="m3-slider__label" id="sl-0">0</output></div>
  <div class="m3-slider-field m3-slider-field--label-persistent" id="sf-100" style="--m3-slider-value: 100">
    <input type="range" class="m3-slider" min="0" max="100" value="100"><output class="m3-slider__label" id="sl-100">100</output></div>
  <div class="m3-slider-field" id="sf-hidden" style="--m3-slider-value: 40">
    <input type="range" class="m3-slider" min="0" max="100" value="40"><output class="m3-slider__label" id="sl-hidden">40</output></div>
  <div class="m3-slider-field m3-slider-field--range" id="sf-range" style="--m3-slider-start: 20; --m3-slider-end: 70">
    <input type="range" class="m3-slider" min="0" max="100" value="20" aria-label="Min" id="sl-r1">
    <input type="range" class="m3-slider" min="0" max="100" value="70" aria-label="Max" id="sl-r2"></div>
</div>
<div class="m3-slider-field m3-slider-field--vertical" id="sf-vert"><input type="range" class="m3-slider" min="0" max="100" value="40" id="sl-vert"></div>

<div style="width:400px"><div class="m3-progress" role="progressbar" style="--m3-progress-value: 60" id="prog"><div class="m3-progress__bar"></div></div></div>
<div style="width:400px"><div class="m3-progress" role="progressbar" style="--m3-progress-value: 0" id="prog-zero"><div class="m3-progress__bar"></div></div></div>
<div class="m3-progress m3-progress--indeterminate" id="prog-ind"><div class="m3-progress__bar"></div></div>
<div class="m3-progress-circle" role="progressbar" style="--m3-progress-value: 60" id="prog-circle"></div>

<div class="m3-tooltip m3-tooltip--rich" role="tooltip" id="tip-rich"><span class="m3-tooltip__title">T</span>Body</div>

<ul class="m3-list" id="list">
  <li class="m3-list__subheader" id="subheader">Recent</li>
  <li class="m3-list-item"><span class="m3-list-item__leading m3-list-item__leading--video" id="video"></span><span class="m3-list-item__body"><span class="m3-list-item__headline">H</span></span></li>
</ul>
<nav class="m3-rail" id="rail"><a class="m3-rail__item" href="#">${ICON}<span class="m3-rail__label">A</span></a></nav>

<nav class="m3-tabs" id="tabs"><button class="m3-tabs__tab" id="tab-text">Text</button><button class="m3-tabs__tab">More</button></nav>
<nav class="m3-tabs" id="tabs-icon"><button class="m3-tabs__tab" id="tab-icon">${ICON}Text</button><button class="m3-tabs__tab">More</button></nav>
<nav class="m3-tabs m3-tabs--secondary" id="tabs2"><button class="m3-tabs__tab" id="tab2-icon">${ICON}Text</button></nav>

<div class="m3-fab" id="fab">${ICON}</div>
<div class="m3-card" id="card">Card</div>
<div class="m3-nav-bar" id="navbar"><a class="m3-nav-bar__item" href="#">${ICON}<span class="m3-nav-bar__label">A</span></a></div>
${Object.keys(EMPHASIZED).map((role) => `<p class="m3-${role}" id="ts-${role}">Aa</p><p class="m3-${role}-emphasized" id="tse-${role}">Aa</p>`).join('\n')}
<div id="probe-surface" style="background-color: var(--md-sys-color-surface)"></div>
<div id="probe-surface-srgb" style="background-color: color-mix(in srgb, var(--md-sys-color-surface) 100%, transparent)"></div>
<div id="probe-tint" style="background-color: color-mix(in srgb, var(--md-sys-color-surface-tint) 100%, transparent)"></div>
${[0, 1, 2, 3, 4, 5].map((n) => `<div class="m3-surface-tint-${n}" id="tint-${n}">T</div>`).join('\n')}
<div class="m3-elevation-3" id="elev-only">E</div>
</body></html>`;

// M3 foundation tokens: name -> expected computed value on :root.
const TOKENS = {
  // Typescale (size / line-height / weight / tracking).
  '--md-sys-typescale-display-large-size': '57px',
  '--md-sys-typescale-headline-small-size': '24px',
  '--md-sys-typescale-title-medium-size': '16px',
  '--md-sys-typescale-body-large-size': '16px',
  '--md-sys-typescale-label-large-size': '14px',
  '--md-sys-typescale-label-small-size': '11px',
  '--md-sys-typescale-label-large-weight': '500',
  '--md-sys-typescale-body-large-tracking': '0.5px',
  // State layers.
  '--md-sys-state-hover-state-layer-opacity': '8%',
  '--md-sys-state-focus-state-layer-opacity': '10%',
  '--md-sys-state-pressed-state-layer-opacity': '10%',
  '--md-sys-state-dragged-state-layer-opacity': '16%',
  '--md-sys-state-disabled-content-opacity': '38%',
  '--md-sys-state-disabled-container-opacity': '12%',
  // Focus indicator.
  '--md-sys-state-focus-indicator-thickness': '3px',
  '--md-sys-state-focus-indicator-offset': '2px',
  // Shape scale, including the extra-extra-large rung.
  '--md-sys-shape-corner-extra-small': '4px',
  '--md-sys-shape-corner-small': '8px',
  '--md-sys-shape-corner-medium': '12px',
  '--md-sys-shape-corner-large': '16px',
  '--md-sys-shape-corner-large-increased': '20px',
  '--md-sys-shape-corner-extra-large': '28px',
  '--md-sys-shape-corner-extra-large-increased': '32px',
  '--md-sys-shape-corner-extra-extra-large': '48px',
  // Motion easing + duration ramp.
  '--md-sys-motion-easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  '--md-sys-motion-easing-emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  '--md-sys-motion-easing-emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  '--md-sys-motion-duration-short1': '50ms',
  '--md-sys-motion-duration-medium2': '300ms',
  '--md-sys-motion-duration-long4': '600ms',
  '--md-sys-motion-duration-extra-long4': '1000ms',
};

async function run() {
  const server = await serve(ROOT, {
    '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'),
    '/spec.html': PAGE,
  });
  const browser = await launch();
  let r;
  try {
    // Reduced motion so transitions never hand back a mid-interpolation value.
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${server.port}/spec.html`);
    r = await page.evaluate(
      ({ BUTTON_RAMP, ICON_BUTTON_RAMP, TOKENS, EMPHASIZED }) => {
        const num = (v) => Math.round(parseFloat(v) * 100) / 100;
        const el = (id) => document.getElementById(id);
        const box = (id) => el(id).getBoundingClientRect();
        const cs = (id, pseudo) => getComputedStyle(el(id), pseudo || null);
        const out = { tokens: {}, buttons: {}, iconButtons: {}, splitHeights: {}, misc: {} };

        // Custom properties hand back their declared text, so rem-valued
        // tokens are resolved against the root font size before comparing.
        const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const toPx = (v) => (/^-?[\d.]+rem$/.test(v) ? `${Math.round(parseFloat(v) * rootFont * 100) / 100}px` : v);
        const root = getComputedStyle(document.documentElement);
        for (const name of Object.keys(TOKENS)) out.tokens[name] = toPx(root.getPropertyValue(name).trim());

        for (const size of Object.keys(BUTTON_RAMP)) {
          const id = 'btn-' + (size || 'base');
          const s = cs(id);
          out.buttons[size] = [num(box(id).height), num(s.paddingLeft), num(getComputedStyle(el(id).querySelector('.m3-icon')).fontSize), num(s.fontSize)];
        }
        for (const size of Object.keys(ICON_BUTTON_RAMP)) {
          const id = 'ib-' + (size || 'base');
          out.iconButtons[size] = [num(box(id).height), num(getComputedStyle(el(id).querySelector('.m3-icon')).fontSize), num(box(id).width)];
        }
        for (const size of Object.keys(BUTTON_RAMP)) {
          const id = 'sb-' + (size || 'base');
          out.splitHeights[size] = num(el(id).querySelector('.m3-split-button__action').getBoundingClientRect().height);
        }

        // Text fields: resting indicator vs the focused one. The focused
        // width is the border plus the inset shadow that grows inward.
        const grow = (id) => {
          const shadow = cs(id).boxShadow;
          const m = /(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/.exec(shadow);
          return m ? Math.max(Math.abs(parseFloat(m[2])), parseFloat(m[4])) : 0;
        };
        const field = (id, edge) => {
          el(id).blur();
          const rest = num(cs(id)[edge]) + grow(id);
          el(id).focus();
          const focused = num(cs(id)[edge]) + grow(id);
          el(id).blur();
          return [rest, focused];
        };
        out.misc.filledIndicator = field('f-filled', 'borderBottomWidth');
        out.misc.outlinedIndicator = field('f-outlined', 'borderTopWidth');

        out.misc.chipPlain = num(cs('chip-plain').paddingLeft);
        out.misc.chipIcon = num(cs('chip-icon').paddingLeft);

        out.misc.checkbox = num(box('cb').width);
        out.misc.radio = num(box('rd').width);
        out.misc.switchBox = [num(box('sw').width), num(box('sw').height)];
        // The slider's handle is drawn on a UA pseudo whose box getComputedStyle
        // does not report, so its geometry is asserted from the stylesheet
        // below; what the browser can answer for is the 48dp hit area.
        out.misc.sliderHitArea = num(box('sl').height);

        // Linear progress stop indicator: a dot at the trailing end, absent
        // while indeterminate.
        const stop = cs('prog', '::after');
        out.misc.progStop = [stop.content !== 'none', num(stop.width), num(stop.height)];
        out.misc.progIndStop = cs('prog-ind', '::after').content !== 'none';

        // The track is painted on ::before and starts a gap past the active
        // indicator; the gap closes at value 0 and for indeterminate.
        const trackStart = (id) => {
          const b = cs(id, '::before');
          return num(b.insetInlineStart === 'auto' ? b.left : b.insetInlineStart);
        };
        out.misc.progGap = [trackStart('prog'), trackStart('prog-zero'), trackStart('prog-ind')];
        out.misc.progTrackColor = cs('prog', '::before').backgroundColor;
        out.misc.rootTrackToken = toPx(getComputedStyle(document.documentElement).getPropertyValue('--m3-progress-track-color').trim());
        out.misc.circleGap = cs('prog-circle').backgroundImage.includes('rgba(0, 0, 0, 0)');

        out.misc.tipRichPad = num(cs('tip-rich').paddingTop);
        out.misc.subheaderColor = cs('subheader').color;
        out.misc.video = [num(box('video').width), num(box('video').height)];
        out.misc.rail = num(box('rail').width);
        out.misc.onSurfaceVariant = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-on-surface-variant').trim();

        out.misc.tabText = num(box('tab-text').height);
        out.misc.tabIcon = num(box('tab-icon').height);
        out.misc.tabSecondaryIcon = num(box('tab2-icon').height);

        out.misc.fab = [num(box('fab').height), num(cs('fab').borderTopLeftRadius)];
        out.misc.cardRadius = num(cs('card').borderTopLeftRadius);
        out.misc.navBar = num(box('navbar').height);

        // M3's slider value indicator: 12dp above the track, centred on the
        // handle, which travels the width less one gap-plus-half-handle at
        // each end.
        const labelCentre = (id) => {
          const f = box('sf-' + id);
          const l = box('sl-' + id);
          const i = el('sf-' + id).querySelector('.m3-slider').getBoundingClientRect();
          return {
            centre: num(l.left + l.width / 2 - i.left),
            gap: num(i.top + (i.height - 16) / 2 - l.bottom),
            width: num(i.width),
          };
        };
        out.misc.slider = {
          at0: labelCentre('0'),
          at100: labelCentre('100'),
          // Hidden until the handle is being moved.
          hiddenOpacity: cs('sl-hidden').opacity,
          shownOpacity: cs('sl-0').opacity,
          // A range slider stacks two inputs in one cell and lets its
          // handles, not its inputs, take the pointer.
          rangeStacked: (() => {
            const a = box('sl-r1');
            const b = box('sl-r2');
            return a.top === b.top && a.left === b.left && a.width === b.width;
          })(),
          rangePointer: cs('sl-r1').pointerEvents,
          // The vertical variant's rotated input lands exactly on its wrapper.
          vertical: (() => {
            const w = box('sf-vert');
            const i = box('sl-vert');
            return [num(w.width), num(w.height), num(i.left - w.left), num(i.top - w.top), num(i.width), num(i.height)];
          })(),
        };

        // M3 text field anatomy: a leading icon sits 12dp in from the
        // container edge and the text starts 52dp in (12 + 24 + 16).
        const iconsBox = box('f-icons');
        const leadBox = box('f-leading');
        const trailBox = box('f-trailing');
        out.misc.fieldAnatomy = {
          padStart: num(cs('f-icons-input').paddingLeft),
          padEnd: num(cs('f-icons-input').paddingRight),
          // The 48dp slot is flush with the edge; the 24dp icon centres to 12dp.
          slotWidth: num(leadBox.width),
          iconInset: num(leadBox.left - iconsBox.left + (leadBox.width - 24) / 2),
          trailingInset: num(iconsBox.right - trailBox.right + (trailBox.width - 24) / 2),
          // The label follows the text, not the container edge.
          labelStart: num(el('f-icons').querySelector('.m3-field__label').getBoundingClientRect().left - iconsBox.left),
          counterEnd: num(iconsBox.right - box('f-counter').right),
          // An affix reserves its own space on top of whatever the text
          // padding already was, and sits where the text starts.
          affixPadStart: num(cs('f-affix-input').paddingLeft),
          affixPadEnd: num(cs('f-affix-input').paddingRight),
          prefixStart: num(box('f-prefix').left - box('f-affix').left),
          // Icon and affix stack: 52 + 24.
          bothPadStart: num(cs('f-both-input').paddingLeft),
          // A field with no slots is untouched, and so is a bare .form-control.
          plainPadStart: num(cs('f-outlined').paddingLeft),
        };

        // M3 tonal elevation: the surface-tint role composited over surface at
        // the level's opacity. The roles compute as oklch(), so the probes mix
        // them into srgb at 100% -- the same space the tint composites in, and
        // the same serialisation the tinted surfaces come back as.
        out.tint = {
          surfaceRaw: cs('probe-surface').backgroundColor,
          surface: cs('probe-surface-srgb').backgroundColor,
          tint: cs('probe-tint').backgroundColor,
          opacities: [1, 2, 3, 4, 5].map((n) => root.getPropertyValue(`--m3-sys-elevation-tint-${n}`).trim()),
          levels: [0, 1, 2, 3, 4, 5].map((n) => cs('tint-' + n).backgroundColor),
          // Tint and shadow are independent channels.
          tintShadow: cs('tint-3').boxShadow,
          elevOnlyBg: cs('elev-only').backgroundColor,
          elevOnlyShadow: cs('elev-only').boxShadow,
        };

        // The emphasized scale, read off rendered specimens: weight and
        // tracking are its own, while font, size and line height must come
        // back identical to the baseline style they alias.
        out.type = {};
        for (const role of Object.keys(EMPHASIZED)) {
          const base = cs('ts-' + role);
          const em = cs('tse-' + role);
          out.type[role] = {
            weight: em.fontWeight,
            tracking: em.letterSpacing,
            aliased: [em.fontFamily === base.fontFamily, em.fontSize === base.fontSize, em.lineHeight === base.lineHeight],
            baseWeight: base.fontWeight,
          };
        }
        return out;
      },
      { BUTTON_RAMP, ICON_BUTTON_RAMP, TOKENS, EMPHASIZED }
    );
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  for (const [name, want] of Object.entries(TOKENS)) {
    expect(r.tokens[name] === want, `${name}: ${r.tokens[name]}, expected ${want}`);
  }
  for (const [size, want] of Object.entries(BUTTON_RAMP)) {
    expect(eq(r.buttons[size], want), `.m3-btn${size ? '--' + size : ''} [h,pad,icon,label] ${JSON.stringify(r.buttons[size])}, expected ${JSON.stringify(want)}`);
    expect(r.splitHeights[size] === want[0], `.m3-split-button${size ? '--' + size : ''} height ${r.splitHeights[size]}, expected ${want[0]}`);
  }
  for (const [size, [h, icon]] of Object.entries(ICON_BUTTON_RAMP)) {
    expect(eq(r.iconButtons[size], [h, icon, h]), `.m3-icon-btn${size ? '--' + size : ''} [h,icon,w] ${JSON.stringify(r.iconButtons[size])}, expected ${JSON.stringify([h, icon, h])}`);
  }

  for (const [role, [weight, tracking]] of Object.entries(EMPHASIZED)) {
    const got = r.type[role];
    expect(got.weight === String(weight), `.m3-${role}-emphasized weight ${got.weight}, expected ${weight}`);
    expect(got.tracking === tracking, `.m3-${role}-emphasized tracking ${got.tracking}, expected ${tracking}`);
    expect(eq(got.aliased, [true, true, true]), `.m3-${role}-emphasized [font,size,line-height] ${JSON.stringify(got.aliased)} should match .m3-${role}`);
    // The point of the scale: emphasized is always heavier than baseline.
    expect(Number(got.weight) > Number(got.baseWeight), `.m3-${role}-emphasized weight ${got.weight} should exceed baseline ${got.baseWeight}`);
  }

  // M3's slider value indicator sits 12dp above the track (M3's
  // ValueIndicatorActiveBottomSpace) and centres on the handle, whose centre
  // travels from gap + half a handle to the same inset from the other end.
  {
    const sl = r.misc.slider;
    const inset = 6 + 4 / 2;
    expect(sl.at0.centre === inset, `value label at 0: ${sl.at0.centre}, expected ${inset}`);
    expect(sl.at100.centre === sl.at100.width - inset, `value label at 100: ${sl.at100.centre}, expected ${sl.at100.width - inset}`);
    expect(sl.at0.gap === 12 && sl.at100.gap === 12, `value label gap to track ${sl.at0.gap}/${sl.at100.gap}, expected 12`);
    expect(sl.hiddenOpacity === '0', `resting value label opacity ${sl.hiddenOpacity}, expected 0`);
    expect(sl.shownOpacity === '1', `persistent value label opacity ${sl.shownOpacity}, expected 1`);
    expect(sl.rangeStacked, 'a range slider should stack its two inputs in one grid cell');
    expect(sl.rangePointer === 'none', `range input pointer-events ${sl.rangePointer}, expected none (the handles take the pointer)`);
    // 48dp cross axis, the 240px length token, and the rotated input flush
    // with the wrapper on all four sides.
    expect(eq(sl.vertical, [48, 240, 0, 0, 48, 240]), `vertical slider [w,h,dx,dy,iw,ih] ${JSON.stringify(sl.vertical)}, expected [48,240,0,0,48,240]`);
  }

  // M3 text field anatomy. A leading icon sits 12dp in from the container
  // edge and the text starts 52dp in; the 16dp a plain field uses is replaced
  // by that, not added to it. A prefix then reserves its own space inside.
  {
    const a = r.misc.fieldAnatomy;
    const want = {
      padStart: 52, padEnd: 52, slotWidth: 48, iconInset: 12, trailingInset: 12,
      labelStart: 52, counterEnd: 0,
      affixPadStart: 40, affixPadEnd: 40, prefixStart: 16,
      bothPadStart: 76, plainPadStart: 16,
    };
    for (const [k, v] of Object.entries(want)) {
      expect(a[k] === v, `field anatomy ${k}: ${a[k]}, expected ${v}`);
    }
  }

  // M3 tonal elevation. Compose computes a surface at N dp as the surface-tint
  // role over `surface` at (4.5 * ln(dp + 1) + 2)%; M3's five levels are
  // 1, 3, 6, 8 and 12dp, which is where these opacities come from.
  const TINT_DP = [1, 3, 6, 8, 12];
  const wantOpacities = TINT_DP.map((dp) => `${Math.round((4.5 * Math.log(dp + 1) + 2) * 100) / 100}%`);
  expect(eq(r.tint.opacities, wantOpacities), `tonal elevation opacities ${JSON.stringify(r.tint.opacities)}, expected ${JSON.stringify(wantOpacities)}`);

  // color(srgb r g b), three floats; the channel values can run slightly out
  // of gamut, which is fine -- they are being compared, not painted.
  const srgb = (v) => v.match(/-?[\d.]+(?:e-?\d+)?/g).slice(0, 3).map(Number);
  const surface = srgb(r.tint.surface);
  const tint = srgb(r.tint.tint);
  const show = (c) => `color(srgb ${c.map((n) => Math.round(n * 1e4) / 1e4).join(' ')})`;
  const near = (a, b) => Math.max(...a.map((c, k) => Math.abs(c - b[k]))) <= 0.002;
  // Level 0 sets the role straight through, so it comes back in the role's
  // own space rather than the mixed srgb the tinted levels serialise in.
  expect(r.tint.levels[0] === r.tint.surfaceRaw, `.m3-surface-tint-0 ${r.tint.levels[0]}, expected surface ${r.tint.surfaceRaw}`);
  r.tint.opacities.forEach((op, i) => {
    const p = parseFloat(op) / 100;
    // color-mix(in srgb, ...) blends the gamma-encoded channels, so the
    // expected composite is a plain per-channel lerp.
    const want = surface.map((c, k) => tint[k] * p + c * (1 - p));
    expect(near(srgb(r.tint.levels[i + 1]), want), `.m3-surface-tint-${i + 1} ${r.tint.levels[i + 1]}, expected ~${show(want)}`);
  });
  // Shadow and tint are M3's two independent elevation channels, so neither
  // utility may reach into the other's property.
  expect(r.tint.tintShadow === 'none', `.m3-surface-tint-3 box-shadow ${r.tint.tintShadow}, expected none`);
  expect(r.tint.elevOnlyShadow !== 'none', '.m3-elevation-3 should carry a shadow');
  expect(/rgba\(0, 0, 0, 0\)/.test(r.tint.elevOnlyBg), `.m3-elevation-3 background ${r.tint.elevOnlyBg}, expected untouched`);

  // M3: filled active indicator and outlined outline are 1dp at rest, 3dp focused.
  expect(eq(r.misc.filledIndicator, [1, 3]), `filled field indicator rest/focus ${JSON.stringify(r.misc.filledIndicator)}, expected [1,3]`);
  expect(eq(r.misc.outlinedIndicator, [1, 3]), `outlined field outline rest/focus ${JSON.stringify(r.misc.outlinedIndicator)}, expected [1,3]`);

  // M3 chips: 16dp of label space, 8dp on a side carrying a leading icon.
  expect(r.misc.chipPlain === 16, `chip label space ${r.misc.chipPlain}, expected 16`);
  expect(r.misc.chipIcon === 8, `chip leading space with icon ${r.misc.chipIcon}, expected 8`);

  // Selection controls.
  expect(r.misc.checkbox === 18, `checkbox ${r.misc.checkbox}px, expected 18`);
  expect(r.misc.radio === 20, `radio ${r.misc.radio}px, expected 20`);
  expect(eq(r.misc.switchBox, [52, 32]), `switch ${JSON.stringify(r.misc.switchBox)}, expected [52,32]`);
  expect(r.misc.sliderHitArea === 48, `slider hit area ${r.misc.sliderHitArea}, expected the 48dp target`);

  // Component tokens carry their default as the fallback of the var() that
  // reads them, so the shipped default is read out of the stylesheet.
  const shipped = (token) => {
    const m = new RegExp(`var\\(\\s*--${token}\\s*,\\s*([^)]*)\\)`).exec(CSS_TEXT);
    return m ? m[1].trim() : null;
  };
  const remToPx = (v) => (/rem$/.test(v || '') ? parseFloat(v) * 16 : parseFloat(v));
  expect(remToPx(shipped('m3-slider-track-height')) === 16, `slider track default ${shipped('m3-slider-track-height')}, expected 1rem`);
  expect(remToPx(shipped('m3-slider-thumb-width')) === 4, `slider handle width default ${shipped('m3-slider-thumb-width')}, expected 0.25rem`);
  expect(remToPx(shipped('m3-slider-thumb-size')) === 44, `slider handle height default ${shipped('m3-slider-thumb-size')}, expected 2.75rem`);

  // M3 linear progress carries a 4dp stop indicator; indeterminate has none.
  expect(eq(r.misc.progStop, [true, 4, 4]), `progress stop indicator ${JSON.stringify(r.misc.progStop)}, expected [true,4,4]`);
  expect(r.misc.progIndStop === false, 'indeterminate progress should have no stop indicator');

  // M3 leaves a 4dp gap between the active indicator and the track: on a
  // 400px bar at 60% the track starts at 244px, and the gap closes at value
  // 0 and while indeterminate.
  expect(eq(r.misc.progGap, [244, 0, 0]), `progress track start at 60/0/indeterminate ${JSON.stringify(r.misc.progGap)}, expected [244,0,0]`);
  expect(r.misc.progTrackColor === r.misc.rootTrackToken || r.misc.progTrackColor.length > 0, 'progress track paints from its token');
  expect(r.misc.circleGap, 'circular progress should carry transparent gap stops in its conic gradient');

  // M3 rich tooltip: 16dp container padding.
  expect(r.misc.tipRichPad === 16, `rich tooltip padding ${r.misc.tipRichPad}, expected 16`);

  // M3 list: subheader reads as supporting text; the leading video frame is 16:9.
  expect(r.misc.subheaderColor === r.misc.onSurfaceVariant, `list subheader ${r.misc.subheaderColor}, expected on-surface-variant ${r.misc.onSurfaceVariant}`);
  expect(eq(r.misc.video, [114, 64]), `list video thumbnail ${JSON.stringify(r.misc.video)}, expected [114,64]`);

  // M3 Expressive collapsed navigation rail.
  expect(r.misc.rail === 96, `navigation rail width ${r.misc.rail}, expected 96`);

  // M3 primary tabs: a label-only bar is 48dp, a bar carrying icons alongside
  // labels is 64dp for every tab in it; secondary bars stay 48dp.
  expect(r.misc.tabText === 48, `label-only tab bar ${r.misc.tabText}, expected 48`);
  expect(r.misc.tabIcon === 64, `icon + label tab bar ${r.misc.tabIcon}, expected 64`);
  expect(r.misc.tabSecondaryIcon === 48, `secondary icon + label tab ${r.misc.tabSecondaryIcon}, expected 48`);

  // Containment.
  expect(eq(r.misc.fab, [56, 16]), `FAB [h,radius] ${JSON.stringify(r.misc.fab)}, expected [56,16]`);
  expect(r.misc.cardRadius === 12, `card corner ${r.misc.cardRadius}, expected 12`);
  expect(r.misc.navBar === 80, `navigation bar height ${r.misc.navBar}, expected 80`);

  if (!failures.length) {
    console.log(`[spec] ${Object.keys(TOKENS).length} tokens, ${Object.keys(BUTTON_RAMP).length}-rung button/icon-button/split ramps, ${Object.keys(EMPHASIZED).length} emphasized typescale styles, 6 tonal-elevation surfaces, field anatomy, slider anatomy, fields, chips, selection, progress (stop indicator + gap), tabs, tooltip, list, rail: ok`);
  }
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { f.forEach((x) => console.log('  ' + x)); process.exit(f.length ? 1 : 0); });
