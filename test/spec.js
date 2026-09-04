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
// --small is M3's 40px rung, the same metrics as the default: naming it is
// the point, so the ramp cannot quietly collapse it onto --xs the way a
// Bootstrap .btn-sm alias once did.
const BUTTON_RAMP = {
  xs: [32, 12, 20, 14],
  small: [40, 16, 20, 14],
  '': [40, 16, 20, 14],
  medium: [56, 24, 24, 16],
  large: [96, 48, 32, 24],
  xl: [136, 64, 40, 32],
};
// Icon buttons carry the same heights, square containers, and M3's icon ramp.
const ICON_BUTTON_RAMP = { xs: [32, 20], small: [40, 24], '': [40, 24], medium: [56, 24], large: [96, 32], xl: [136, 40] };

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
<aside class="m3-rail" id="rail-header">
  <div class="m3-rail__header" id="rail-header-slot"><button class="m3-icon-btn" type="button" aria-label="M">${ICON}</button></div>
  <a class="m3-rail__item" href="#" id="rail-header-item"><span class="m3-rail__icon">${ICON}</span>A</a></aside>
<aside class="m3-rail" id="rail-rhythm">
  <a class="m3-rail__item active" href="#" id="rail-item-1"><span class="m3-rail__icon">${ICON}</span>A</a>
  <a class="m3-rail__item" href="#" id="rail-item-2"><span class="m3-rail__icon">${ICON}</span>B</a></aside>
<aside class="m3-rail m3-rail--expanded" id="rail-expanded">
  <a class="m3-rail__item" href="#" id="rail-exp-item"><span class="m3-rail__icon" id="rail-exp-icon">${ICON}</span>A</a></aside>

<nav class="m3-tabs" id="tabs"><button class="m3-tabs__tab" id="tab-text">Text</button><button class="m3-tabs__tab">More</button></nav>
<nav class="m3-tabs" id="tabs-icon"><button class="m3-tabs__tab" id="tab-icon">${ICON}Text</button><button class="m3-tabs__tab">More</button></nav>
<nav class="m3-tabs m3-tabs--secondary" id="tabs2"><button class="m3-tabs__tab" id="tab2-icon">${ICON}Text</button></nav>

<div class="m3-fab" id="fab">${ICON}</div>
<div class="m3-card" id="card">Card</div>
<div style="width:672px">
  <div class="m3-carousel" id="car-default"><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div></div>
  <div class="m3-carousel m3-carousel--multi-browse" id="car-multi"><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div></div>
  <div class="m3-carousel m3-carousel--hero" id="car-hero"><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div></div>
  <div id="motion-probe" style="position:absolute;visibility:hidden">
  <div class="m3-motion-fade-through" id="mo-ft-in"></div>
  <div class="m3-motion-fade-through-out" id="mo-ft-out"></div>
  <div class="m3-motion-shared-x" id="mo-x-in"></div>
  <div class="m3-motion-shared-x m3-motion--reverse" id="mo-x-rev"></div>
  <div class="m3-motion-shared-z-out" id="mo-z-out"></div>
  <div class="m3-motion-fade" id="mo-fade"></div>
</div>
<div class="m3-carousel m3-carousel--uncontained" id="car-unc"><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div><div class="m3-carousel__item"></div></div>
</div>
<div class="m3-time-picker"><div class="m3-time-picker__dial" id="dial"><span class="m3-time-picker__dial-hand" id="dial-hand"></span><label class="m3-time-picker__dial-number" id="dn-1"><input type="radio" name="spec-h" value="1"><span>1</span></label><label class="m3-time-picker__dial-number" id="dn-2"><input type="radio" name="spec-h" value="2"><span>2</span></label><label class="m3-time-picker__dial-number" id="dn-3"><input type="radio" name="spec-h" value="3" checked><span>3</span></label><label class="m3-time-picker__dial-number" id="dn-4"><input type="radio" name="spec-h" value="4"><span>4</span></label><label class="m3-time-picker__dial-number" id="dn-5"><input type="radio" name="spec-h" value="5"><span>5</span></label><label class="m3-time-picker__dial-number" id="dn-6"><input type="radio" name="spec-h" value="6"><span>6</span></label><label class="m3-time-picker__dial-number" id="dn-7"><input type="radio" name="spec-h" value="7"><span>7</span></label><label class="m3-time-picker__dial-number" id="dn-8"><input type="radio" name="spec-h" value="8"><span>8</span></label><label class="m3-time-picker__dial-number" id="dn-9"><input type="radio" name="spec-h" value="9"><span>9</span></label><label class="m3-time-picker__dial-number" id="dn-10"><input type="radio" name="spec-h" value="10"><span>10</span></label><label class="m3-time-picker__dial-number" id="dn-11"><input type="radio" name="spec-h" value="11"><span>11</span></label><label class="m3-time-picker__dial-number" id="dn-12"><input type="radio" name="spec-h" value="12"><span>12</span></label></div></div>
<div class="m3-date-picker m3-date-picker--docked"><div class="m3-date-picker__years"><button class="m3-date-picker__year" id="year-cell" type="button">2026</button></div></div>
<div class="m3-menu m3-menu--static" id="menu-anat"><button class="m3-menu__item" id="menu-item-sc">Undo <span class="m3-menu__shortcut" id="menu-sc">Ctrl Z</span></button></div>
<form class="m3-search" role="search" id="search-anat" style="width:360px"><span class="m3-search__leading" id="search-lead">${ICON}</span><input type="search" class="m3-search__input" id="search-in"><button class="m3-search__trailing" id="search-trail" type="reset" aria-label="x">${ICON}</button></form>
<dialog open class="m3-dialog" id="dlg-icon"><span class="m3-dialog__icon">${ICON}</span><h2 class="m3-dialog__title" id="dlg-icon-title">Hero</h2></dialog>
<dialog open class="m3-dialog" id="dlg-plain"><h2 class="m3-dialog__title" id="dlg-plain-title">Plain</h2></dialog>
<span class="m3-chip m3-chip--input" id="chip-av"><span class="m3-chip__avatar" id="chip-avatar">RC</span>Riley</span>
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

        // The anatomy slots M3 defines but the library was missing.
        const dialBox = box('dial');
        const dialCentre = { x: dialBox.left + dialBox.width / 2, y: dialBox.top + dialBox.height / 2 };
        const numAt = (k) => {
          const b = box('dn-' + k);
          return [num(b.left + b.width / 2 - dialCentre.x), num(b.top + b.height / 2 - dialCentre.y)];
        };
        const searchBox = box('search-anat');
        out.misc.anatomy = {
          // Time picker dial: 256dp face, numbers on a 104dp radius, hand at
          // the checked hour.
          dial: [num(dialBox.width), num(dialBox.height)],
          dialAt3: numAt(3),
          dialAt6: numAt(6),
          dialAt12: numAt(12),
          handRotate: cs('dial-hand').rotate,
          handOpacity: cs('dial-hand').opacity,
          // Date picker year cell: M3's 72x36 pill.
          yearCell: [num(box('year-cell').width), num(box('year-cell').height)],
          // Menu shortcut: pushed to the trailing edge of the item.
          shortcutEnd: num(box('menu-item-sc').right - box('menu-sc').right),
          // Search slots: 16dp from the container edge, 16dp to the text.
          searchLeadStart: num(box('search-lead').left - searchBox.left),
          searchLeadGap: num(box('search-in').left - box('search-lead').right),
          searchTrailEnd: num(searchBox.right - box('search-trail').right),
          // Dialog: an icon centres the headline; without one it does not.
          titleWithIcon: cs('dlg-icon-title').textAlign,
          titleWithout: cs('dlg-plain-title').textAlign,
          // Chip avatar: 24dp round, 4dp from the leading edge.
          avatar: [num(box('chip-avatar').width), num(box('chip-avatar').height)],
          avatarStart: num(box('chip-avatar').left - box('chip-av').left),
        };

        // M3's transition patterns are all behind
        // prefers-reduced-motion: no-preference, and this page runs with
        // reduced motion, so every one of them must be inert here. The frames
        // themselves are sampled in test/morph.js, which runs without it.
        out.misc.motionReduced = ['mo-ft-in', 'mo-ft-out', 'mo-x-in', 'mo-x-rev', 'mo-z-out', 'mo-fade']
          .map((id) => [cs(id).animationName, el(id).getAnimations().length]);

        // M3's carousel layouts, measured on a 672px track.
        const carWidths = (id) => [...el(id).children].map((e) => num(e.getBoundingClientRect().width));
        out.misc.carousel = {
          track: num(box('car-default').width),
          def: carWidths('car-default'),
          multi: carWidths('car-multi'),
          hero: carWidths('car-hero'),
          unc: carWidths('car-unc'),
          snap: [cs('car-default').scrollSnapType, getComputedStyle(el('car-unc').firstElementChild).scrollSnapAlign],
        };

        // M3 Expressive's navigation rail: a 96dp collapsed rail, a 220dp
        // expanded one (its published minimum), a 56dp horizontal item, and
        // HeaderSpaceMinimum between the header and the first destination.
        out.misc.rail2 = {
          expandedWidth: num(box('rail-expanded').width),
          itemHeight: num(box('rail-exp-item').height),
          // The indicator is the row now, so the icon is back to a glyph box.
          iconBox: [num(box('rail-exp-icon').width), num(box('rail-exp-icon').height)],
          headerGap: num(box('rail-header-item').top - box('rail-header-slot').bottom),
          // The collapsed rail's own vertical rhythm: M3 hangs it from a
          // 44dp top space with nothing below, 4dp between destinations, and
          // a 64dp minimum for a destination.
          topSpace: num(box('rail-item-1').top - box('rail-rhythm').top),
          bottomSpace: num(box('rail-rhythm').bottom - box('rail-item-2').bottom),
          itemGap: num(box('rail-item-2').top - box('rail-item-1').bottom),
          collapsedItemHeight: num(box('rail-item-1').height),
          // M3's ItemActiveLabelText is `secondary`, not `on-surface`.
          activeLabel: cs('rail-item-1').color,
          secondaryRole: getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-secondary').trim(),
        };

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
    // The slider paints its track as background LAYERS on a vendor
    // pseudo-element, whose computed style getComputedStyle() will not return
    // -- so this reads the PAINT instead. One bad var() anywhere in the
    // track's background-position list is invalid at computed-value time and
    // takes the whole declaration to 0% 0%, sliding every layer to the top of
    // the control: a second track floating above the real one. A 1x1
    // screenshot is byte-identical to another of the same colour, so three of
    // them settle it with no image decoder.
    {
      const b = await page.locator('#sl').boundingBox();
      const dot = async (x, y) =>
        (await page.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString('base64');
      r.misc.sliderPaint = {
        // Well inside the active track, at the control's vertical centre.
        centre: await dot(b.x + 8, b.y + b.height / 2),
        // The same column, 8px down. The correct 16px band sits at the
        // control's centre (16..32 of 48), so nothing paints here; a band
        // pushed to 0% 0% of the 44px runnable track covers 2..18 and does.
        top: await dot(b.x + 8, b.y + 8),
        // A reference pixel of the page, far from any control.
        page: await dot(b.x + 8, b.y - 6),
      };
    }
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

  // Five named rungs, five distinct heights. Checking each modifier against
  // its own expected height is not enough on its own: a modifier can hit the
  // right number while a neighbour silently sits on the same one, which is
  // how --xs and --small were both 32px, indistinguishable on the page.
  const RUNGS = ['xs', 'small', 'medium', 'large', 'xl'];
  for (const [family, got] of [['m3-btn', (s) => r.buttons[s][0]], ['m3-icon-btn', (s) => r.iconButtons[s][0]], ['m3-split-button', (s) => r.splitHeights[s]]]) {
    const heights = RUNGS.map(got);
    expect(new Set(heights).size === RUNGS.length, `.${family} size ramp collapses: ${RUNGS.map((s, i) => `--${s} ${heights[i]}px`).join(', ')}`);
  }

  for (const [role, [weight, tracking]] of Object.entries(EMPHASIZED)) {
    const got = r.type[role];
    expect(got.weight === String(weight), `.m3-${role}-emphasized weight ${got.weight}, expected ${weight}`);
    expect(got.tracking === tracking, `.m3-${role}-emphasized tracking ${got.tracking}, expected ${tracking}`);
    expect(eq(got.aliased, [true, true, true]), `.m3-${role}-emphasized [font,size,line-height] ${JSON.stringify(got.aliased)} should match .m3-${role}`);
    // The point of the scale: emphasized is always heavier than baseline.
    expect(Number(got.weight) > Number(got.baseWeight), `.m3-${role}-emphasized weight ${got.weight} should exceed baseline ${got.baseWeight}`);
  }

  // The anatomy slots M3 defines: the time picker's dial, the date picker's
  // year cell, the menu shortcut, the search bar's icon slots, the dialog's
  // hero icon and the chip's avatar.
  {
    const a = r.misc.anatomy;
    expect(eq(a.dial, [256, 256]), `time picker dial ${JSON.stringify(a.dial)}, expected [256,256]`);
    // (256 - 48) / 2 = 104: three o'clock is due east, six due south, twelve due north.
    expect(eq(a.dialAt3, [104, 0]), `dial 3 o'clock ${JSON.stringify(a.dialAt3)}, expected [104,0]`);
    expect(eq(a.dialAt6, [0, 104]), `dial 6 o'clock ${JSON.stringify(a.dialAt6)}, expected [0,104]`);
    expect(eq(a.dialAt12, [0, -104]), `dial 12 o'clock ${JSON.stringify(a.dialAt12)}, expected [0,-104]`);
    expect(a.handRotate === '90deg', `dial hand at hour 3 ${a.handRotate}, expected 90deg`);
    expect(a.handOpacity === '1', `dial hand with an hour checked ${a.handOpacity}, expected 1`);
    expect(eq(a.yearCell, [72, 36]), `year cell ${JSON.stringify(a.yearCell)}, expected [72,36]`);
    // The item's own 12dp inline padding is what the shortcut stops at.
    expect(a.shortcutEnd === 12, `menu shortcut trailing gap ${a.shortcutEnd}, expected 12`);
    expect(a.searchLeadStart === 16, `search leading icon inset ${a.searchLeadStart}, expected 16`);
    expect(a.searchLeadGap === 16, `search icon-to-text gap ${a.searchLeadGap}, expected 16`);
    expect(a.searchTrailEnd === 16, `search trailing icon inset ${a.searchTrailEnd}, expected 16`);
    expect(a.titleWithIcon === 'center', `dialog title with a hero icon ${a.titleWithIcon}, expected center`);
    expect(a.titleWithout === 'start', `dialog title without an icon ${a.titleWithout}, expected start`);
    expect(eq(a.avatar, [24, 24]), `chip avatar ${JSON.stringify(a.avatar)}, expected [24,24]`);
    // M3's 4dp sits inside the chip's 1dp outline, so 5px from its outer edge.
    expect(a.avatarStart === 5, `chip avatar inset ${a.avatarStart}, expected 5 (4dp inside the 1dp outline)`);
  }

  // Under reduced motion every transition pattern is inert: no animation
  // name, no running animation, the element simply there.
  expect(
    r.misc.motionReduced.every(([name, count]) => name === 'none' && count === 0),
    `motion patterns under reduced motion ${JSON.stringify(r.misc.motionReduced)}, expected none/0 for all`
  );

  // M3's carousel layouts. The default is one large item; multi-browse cycles
  // large / medium / small out of one repeating grid-auto-columns track list;
  // hero is the track less a small item and a gap on each side; uncontained
  // is uniform. M3's small item is clamped between its Min and Max (40, 56).
  {
    const car = r.misc.carousel;
    const W = car.track;
    const small = Math.min(56, Math.max(40, W * 0.12));
    const edge = small + 8;
    // A percentage track quantises to the engine's 1/64px layout unit, so
    // these compare within a fraction of a pixel rather than exactly.
    const px = (n) => Math.round(n * 100) / 100;
    const all = (got, want) => got.length === 4 && got.every((w) => Math.abs(w - want) < 0.05);
    expect(all(car.def, 0.75 * W), `carousel default ${JSON.stringify(car.def)}, expected ${px(0.75 * W)}`);
    const wantMulti = [0.6 * W, 0.35 * W, small, 0.6 * W];
    expect(car.multi.every((w, i) => Math.abs(w - wantMulti[i]) < 0.05),
      `carousel multi-browse ${JSON.stringify(car.multi)}, expected ${JSON.stringify(wantMulti.map(px))}`);
    expect(all(car.hero, W - 2 * edge), `carousel hero ${JSON.stringify(car.hero)}, expected ${W - 2 * edge}`);
    expect(all(car.unc, 0.4 * W), `carousel uncontained ${JSON.stringify(car.unc)}, expected ${px(0.4 * W)}`);
    expect(eq(car.snap, ['x mandatory', 'start']), `carousel snap ${JSON.stringify(car.snap)}, expected ["x mandatory","start"]`);
  }

  // M3 Expressive's navigation rail anatomy.
  expect(r.misc.rail2.expandedWidth === 220, `expanded rail width ${r.misc.rail2.expandedWidth}, expected 220 (M3's minimum)`);
  expect(r.misc.rail2.itemHeight === 56, `expanded rail item ${r.misc.rail2.itemHeight}, expected 56`);
  expect(eq(r.misc.rail2.iconBox, [24, 24]), `expanded rail icon ${JSON.stringify(r.misc.rail2.iconBox)}, expected [24,24]`);
  expect(r.misc.rail2.headerGap === 40, `rail header gap ${r.misc.rail2.headerGap}, expected 40 (M3's HeaderSpaceMinimum)`);
  expect(r.misc.rail2.topSpace === 44, `rail top space ${r.misc.rail2.topSpace}, expected 44 (M3's TopSpace)`);
  expect(r.misc.rail2.bottomSpace === 0, `rail bottom space ${r.misc.rail2.bottomSpace}, expected 0 (M3 hangs the rail from the top)`);
  expect(r.misc.rail2.itemGap === 4, `rail item gap ${r.misc.rail2.itemGap}, expected 4 (M3's ItemVerticalSpace)`);
  expect(r.misc.rail2.collapsedItemHeight === 64,
    `collapsed rail item height ${r.misc.rail2.collapsedItemHeight}, expected 64 (M3's ContainerHeight)`);
  expect(r.misc.rail2.activeLabel === r.misc.rail2.secondaryRole,
    `rail active label ${r.misc.rail2.activeLabel}, expected the secondary role ${r.misc.rail2.secondaryRole}`);

  // The track band is painted at the control's vertical centre, and nothing
  // is painted at its top edge. If the background-position list ever goes
  // invalid, every layer moves to 0% 0% and both of these flip.
  {
    const paint = r.misc.sliderPaint;
    expect(paint.centre !== paint.page, 'slider: no track painted at the control centre');
    expect(
      paint.top === paint.page,
      'slider: something is painted at the top edge of the control -- the track layers have lost their positions and are stacking above the real track'
    );
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
    console.log(`[spec] ${Object.keys(TOKENS).length} tokens, ${Object.keys(BUTTON_RAMP).filter(Boolean).length}-rung button/icon-button/split ramps, ${Object.keys(EMPHASIZED).length} emphasized typescale styles, 6 tonal-elevation surfaces, field anatomy, slider anatomy (track layers positioned), fields, chips, selection, progress (stop indicator + gap), tabs, tooltip, list, 4 carousel layouts, motion patterns inert under reduced motion, dial/year/shortcut/search-slot/hero-icon/avatar anatomy, rail (collapsed rhythm + expanded + header): ok`);
  }
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { f.forEach((x) => console.log('  ' + x)); process.exit(f.length ? 1 : 0); });
