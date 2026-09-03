// Chart token contract: the palette families hold the data-viz gates, and the
// host's registered readouts hand a script absolute values in every theme
// state -- the pipeline the ECharts bridge (docs/echarts.md) stands on.
//
// Static (no browser), from dist/m3x.css:
//   - the categorical palette, light and dark at the built level: OKLCH
//     lightness inside the mode's band, chroma above the floor (below it a
//     hue reads as gray), neighbours separated under simulated protanopia
//     and deuteranopia (OKLab Delta E x100 >= 6, the floor; >= 8 is the
//     target and is reported), neighbours separated for full colour vision
//     (>= 15), and the contrast of each step against the surface (steps
//     below 3:1 are reported: they need direct labels or a table view);
//   - the medium and high contrast levels never lower a step's contrast;
//   - the sequential steps are one monotone lightness ramp with visible
//     gaps, the diverging steps are two arms meeting at the neutral.
// Browser (headless Chromium):
//   - every registered readout on a host computes to a value the canvas
//     parser accepts (an absolute colour, a length, a number) in light and
//     dark, inside a token island, under a forced contrast level and under
//     consumer overrides, and the light-dark() tier agrees with the static
//     tier to the pixel;
//   - the family modifiers re-point the series slots, the palette strip
//     paints from them, an accent override moves the sequential ramp, and a
//     token change fires transitionend on a readout the host transitions,
//     which is how the bridge notices a retheme without polling.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');

// --- colour maths (OKLab, Machado-Oliveira-Fernandes 2009 CVD, WCAG) ---------
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map(s2lin);
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const lch = (hex) => { const [L, a, b] = oklab(lin(hex)); return { L, C: Math.hypot(a, b) }; };
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const simulate = (rgb, M) => rgb.map((_, i) => Math.max(0, Math.min(1, M[i][0] * rgb[0] + M[i][1] * rgb[1] + M[i][2] * rgb[2])));
const dE = (a, b, kind) => {
  const x = oklab(kind ? simulate(lin(a), MACHADO[kind]) : lin(a)), y = oklab(kind ? simulate(lin(b), MACHADO[kind]) : lin(b));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const lum = (hex) => { const [r, g, b] = lin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1, CVD_FLOOR = 6, CVD_TARGET = 8, NORMAL_FLOOR = 15;

// --- static: the families in the built CSS -----------------------------------
function families(css) {
  // light-dark() pairs of the categorical defaults, in emission order: the
  // built level, then prefers-contrast: more (high), then the three forced
  // levels; eight per block.
  const pairs = [...css.matchAll(/--_chart-categorical-(\d)-default: light-dark\(\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\s*\)/g)].map((m) => [m[2], m[3]]);
  const block = (i) => ({ light: pairs.slice(i * 8, i * 8 + 8).map((p) => p[0]), dark: pairs.slice(i * 8, i * 8 + 8).map((p) => p[1]) });
  const initial = (name) => [...css.matchAll(new RegExp(`@property --_chart-${name}-(\\d) \\{[^}]*initial-value: (#[0-9a-f]{6});`, 'g'))].map((m) => m[2]);
  const surface = (mode) => {
    const re = mode === 'light' ? /--md-sys-color-surface: var\(--md-ref-palette-(neutral\d+)\)/ : /--md-sys-color-surface: light-dark\(var\(--md-ref-palette-neutral\d+\), var\(--md-ref-palette-(neutral\d+)\)\)/;
    const step = re.exec(css)[1];
    return new RegExp(`--md-ref-palette-${step}: (#[0-9a-f]{6})`).exec(css)[1];
  };
  return {
    standard: block(0), high: block(1), forced: { standard: block(2), medium: block(3), high: block(4) },
    sequential: initial('sequential'), diverging: initial('diverging'),
    surface: { light: surface('light'), dark: surface('dark') },
    count: pairs.length,
  };
}

function checkCategorical(cols, mode, surface, label) {
  const failures = [], notes = [];
  const [lo, hi] = BAND[mode];
  for (const c of cols) {
    const { L, C } = lch(c);
    if (L < lo || L > hi) failures.push(`${label}: ${c} lightness ${L.toFixed(3)} outside ${lo}-${hi}`);
    if (C < CHROMA_FLOOR) failures.push(`${label}: ${c} chroma ${C.toFixed(3)} below ${CHROMA_FLOOR} (reads gray)`);
  }
  let worstCvd = 99, worstNormal = 99;
  for (let i = 0; i < cols.length - 1; i++) {
    worstNormal = Math.min(worstNormal, dE(cols[i], cols[i + 1]));
    for (const k of ['protan', 'deutan']) worstCvd = Math.min(worstCvd, dE(cols[i], cols[i + 1], k));
  }
  if (worstCvd < CVD_FLOOR) failures.push(`${label}: worst adjacent CVD separation ${worstCvd.toFixed(1)} < ${CVD_FLOOR}`);
  else if (worstCvd < CVD_TARGET) notes.push(`CVD ${worstCvd.toFixed(1)} is in the 6-8 floor band (secondary encoding required)`);
  if (worstNormal < NORMAL_FLOOR) failures.push(`${label}: worst adjacent normal-vision separation ${worstNormal.toFixed(1)} < ${NORMAL_FLOOR}`);
  const relief = cols.filter((c) => contrast(c, surface) < 3).map((c) => `${c} ${contrast(c, surface).toFixed(2)}:1`);
  if (relief.length) notes.push(`below 3:1 on the surface, relief required: ${relief.join(', ')}`);
  return { failures, notes, worstCvd, worstNormal };
}

function checkStatic(css) {
  const failures = [];
  const f = families(css);
  if (f.count !== 40) failures.push(`expected 40 categorical light-dark pairs (5 blocks of 8), found ${f.count}`);
  const summary = [];
  for (const mode of ['light', 'dark']) {
    const r = checkCategorical(f.standard[mode], mode, f.surface[mode], `categorical ${mode}`);
    failures.push(...r.failures);
    summary.push(`${mode}: CVD ${r.worstCvd.toFixed(1)}, normal ${r.worstNormal.toFixed(1)}${r.notes.length ? '; ' + r.notes.join('; ') : ''}`);
    // Levels only move a step away from its surface.
    for (const level of ['medium', 'high']) {
      f.forced[level][mode].forEach((c, i) => {
        if (contrast(c, f.surface[mode]) + 0.01 < contrast(f.forced.standard[mode][i], f.surface[mode])) failures.push(`categorical ${mode} ${level}: step ${i + 1} ${c} has less contrast than the standard step`);
      });
    }
    f.high[mode].forEach((c, i) => { if (c !== f.forced.high[mode][i]) failures.push(`prefers-contrast: more and [data-contrast=high] disagree on ${mode} step ${i + 1}`); });
  }
  // Sequential: one monotone ramp with visible steps (light: toward the
  // accent = darker). Diverging: the neutral is the lightest (light mode)
  // step and both arms are monotone.
  const seqL = f.sequential.map((c) => lch(c).L);
  if (seqL.length !== 7) failures.push(`expected 7 sequential initial values, found ${seqL.length}`);
  for (let i = 0; i < seqL.length - 1; i++) {
    if (seqL[i] - seqL[i + 1] < 0.06) failures.push(`sequential step ${i + 2} is not at least 0.06 darker than step ${i + 1} (${seqL[i].toFixed(3)} -> ${seqL[i + 1].toFixed(3)})`);
  }
  const divL = f.diverging.map((c) => lch(c).L);
  if (divL.length !== 7) failures.push(`expected 7 diverging initial values, found ${divL.length}`);
  for (let i = 0; i < 3; i++) {
    if (divL[i + 1] <= divL[i]) failures.push(`diverging low arm is not monotone at step ${i + 2}`);
    if (divL[4 + i] >= divL[3 + i]) failures.push(`diverging high arm is not monotone at step ${i + 5}`);
  }
  return { failures, summary, sequential: f.sequential, standard: f.standard, forced: f.forced };
}

// --- browser: the readouts ----------------------------------------------------
const PAGE = (swatches) => `<!doctype html><html><head><style>@import url("/m3x.css");</style>
<style>
  #o { --m3-chart-series-1: rgb(1, 2, 3); --m3-chart-accent-color: rgb(200, 10, 10); --m3-chart-title-weight: 700; }
</style></head><body>
<div class="m3-chart" id="base"></div>
<div class="m3-chart-palette" id="pal">${swatches}</div>
<div class="m3-island--tertiary" id="islandRoot"><div class="m3-chart" id="island"></div></div>
<div data-contrast="high"><div class="m3-chart" id="hc"></div></div>
<div id="o"><div class="m3-chart" id="ovr"></div></div>
<div class="m3-chart m3-chart--ordinal" id="ord"></div>
<div class="m3-chart m3-chart--diverging" id="div"></div>
<div class="m3-chart-palette m3-chart-palette--sequential m3-chart-palette--ramp" id="seq">${swatches}</div>
<canvas id="c" width="1" height="1"></canvas>
</body></html>`;

async function checkBrowser(css, staticFamilies) {
  const failures = [];
  const readouts = [...new Set([...css.matchAll(/@property (--_chart-[a-z0-9-]+) \{\s*syntax: "([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`))].map((s) => s.split(' '));
  if (readouts.length < 50) failures.push(`expected the chart readouts to be registered, found ${readouts.length}`);
  const server = await serve(ROOT, {
    '/m3x.css': css,
    '/chart.html': PAGE('<span class="m3-chart-palette__swatch"></span>'.repeat(8)),
  });
  const browser = await launch();
  let r;
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.port}/chart.html`);
    const read = () => page.evaluate((readouts) => {
      const ctx = document.getElementById('c').getContext('2d', { willReadFrequently: true });
      // The canvas parser is the normaliser: whatever serialization a
      // registered <color> computes to (oklch(), color(srgb ...), rgb()),
      // painting it and reading the pixel back yields 8-bit sRGB, the only
      // form a chart library's own colour code can be trusted with.
      const normalize = (v) => {
        ctx.fillStyle = '#010203';
        ctx.fillStyle = v;
        if (ctx.fillStyle === '#010203' && v.trim() !== '#010203' && v.trim() !== 'rgb(1, 2, 3)') return null;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], Math.round((d[3] / 255) * 100) / 100];
      };
      const out = {};
      for (const id of ['base', 'pal', 'island', 'hc', 'ovr', 'ord', 'div', 'seq']) {
        const cs = getComputedStyle(document.getElementById(id));
        const rec = { font: cs.fontFamily };
        for (const [name, syntax] of readouts) {
          const v = cs.getPropertyValue(name).trim();
          rec[name] = syntax === '<color>' ? { raw: v, rgba: v ? normalize(v) : null } : v;
        }
        out[id] = rec;
      }
      out.islandPrimary = normalize(getComputedStyle(document.getElementById('islandRoot')).getPropertyValue('--md-sys-color-primary'));
      out.swatch3 = normalize(getComputedStyle(document.querySelectorAll('#pal > .m3-chart-palette__swatch')[2]).backgroundColor);
      out.seqSwatch1 = normalize(getComputedStyle(document.querySelector('#seq > .m3-chart-palette__swatch')).backgroundColor);
      out.seqSwatch7 = normalize(getComputedStyle(document.querySelectorAll('#seq > .m3-chart-palette__swatch')[6]).backgroundColor);
      return out;
    }, readouts);
    const light = await read();
    // A token change the bridge must notice: the host transitions a readout,
    // so transitionend carries the readout's name.
    const event = await page.evaluate(() => new Promise((resolve) => {
      const el = document.getElementById('base');
      el.style.transition = '--_chart-accent-color 1ms linear';
      const t = setTimeout(() => resolve('none'), 800);
      el.addEventListener('transitionend', (e) => { clearTimeout(t); resolve(e.propertyName); }, { once: true });
      document.documentElement.style.setProperty('--md-seed', 'oklch(0.55 0.15 150)');
    }));
    await page.evaluate(() => { document.documentElement.style.removeProperty('--md-seed'); document.documentElement.setAttribute('data-theme', 'dark'); });
    const dark = await read();
    await page.close();
    r = { light, dark, event };
  } finally {
    await browser.close();
    server.close();
  }

  const hex = (rgba) => '#' + rgba.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
  const near = (a, b, tol = 2) => a && b && a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol);
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lumOf = (rgba) => lum(hex(rgba));

  // Every readout, every host, both schemes: present and normalisable.
  for (const [scheme, snap] of [['light', r.light], ['dark', r.dark]]) {
    for (const id of ['base', 'pal', 'island', 'hc', 'ovr', 'ord', 'div', 'seq']) {
      for (const [name, syntax] of readouts) {
        const v = snap[id][name];
        if (syntax === '<color>') {
          if (!v.raw) failures.push(`${scheme} #${id} ${name} is empty`);
          else if (!v.rgba) failures.push(`${scheme} #${id} ${name} did not normalise: ${v.raw}`);
          else if (/^(light-dark|var)\(/.test(v.raw)) failures.push(`${scheme} #${id} ${name} computed to an unresolved ${v.raw.slice(0, 20)}`);
        } else if (!/^-?[\d.]+(px|rem|em)?$/.test(v)) failures.push(`${scheme} #${id} ${name} is not a plain ${syntax}: "${v}"`);
      }
      if (!snap[id].font) failures.push(`${scheme} #${id} has no computed font-family`);
    }
  }
  const L = r.light, D = r.dark;
  // The light-dark() tier agrees with the static tier.
  for (let n = 1; n <= 8; n++) {
    if (!near(L.base[`--_chart-categorical-${n}`].rgba, rgbOf(staticFamilies.standard.light[n - 1]))) failures.push(`light categorical ${n} computes to ${hex(L.base[`--_chart-categorical-${n}`].rgba)}, static tier says ${staticFamilies.standard.light[n - 1]}`);
    if (!near(D.base[`--_chart-categorical-${n}`].rgba, rgbOf(staticFamilies.standard.dark[n - 1]))) failures.push(`dark categorical ${n} computes to ${hex(D.base[`--_chart-categorical-${n}`].rgba)}, static tier says ${staticFamilies.standard.dark[n - 1]}`);
    if (!near(L.base[`--_chart-series-${n}`].rgba, L.base[`--_chart-categorical-${n}`].rgba)) failures.push(`series ${n} does not default to categorical ${n}`);
  }
  if (near(L.base['--_chart-text-color'].rgba, D.base['--_chart-text-color'].rgba)) failures.push('text colour did not change between light and dark');
  if (!near(L.hc['--_chart-categorical-1'].rgba, rgbOf(staticFamilies.forced.high.light[0]))) failures.push(`[data-contrast=high] categorical 1 is ${hex(L.hc['--_chart-categorical-1'].rgba)}, expected ${staticFamilies.forced.high.light[0]}`);
  // Islands reach the chrome and the accent-driven ramp, not the identity palette.
  if (near(L.island['--_chart-text-color'].rgba, L.base['--_chart-text-color'].rgba)) failures.push('a tertiary island did not re-tint the chart text colour');
  if (!near(L.island['--_chart-sequential-high-color'].rgba, r.light.islandPrimary)) failures.push('the sequential ramp inside a tertiary island does not end on the island\'s primary');
  if (!near(L.island['--_chart-categorical-1'].rgba, L.base['--_chart-categorical-1'].rgba)) failures.push('the categorical palette changed inside an island (identity must stay put)');
  // Consumer overrides.
  if (!near(L.ovr['--_chart-series-1'].rgba, [1, 2, 3])) failures.push(`--m3-chart-series-1 override did not reach the readout: ${L.ovr['--_chart-series-1'].raw}`);
  if (!near(L.ovr['--_chart-sequential-high-color'].rgba, [200, 10, 10])) failures.push('--m3-chart-accent-color did not move the sequential high anchor');
  if (near(L.ovr['--_chart-sequential-4'].rgba, L.base['--_chart-sequential-4'].rgba)) failures.push('--m3-chart-accent-color did not move the sequential steps');
  if (L.ovr['--_chart-title-weight'] !== '700') failures.push(`--m3-chart-title-weight override read as ${L.ovr['--_chart-title-weight']}`);
  // A registered <length> keeps a font-relative unit in its computed value
  // (Chrome serialises 1rem as "1rem"), so the bridge converts rem/em itself.
  if (L.base['--_chart-title-weight'] !== '500' || L.base['--_chart-gap-width'] !== '2px' || !['1rem', '16px'].includes(L.base['--_chart-title-size'])) failures.push(`numeric readouts: weight ${L.base['--_chart-title-weight']}, gap ${L.base['--_chart-gap-width']}, title ${L.base['--_chart-title-size']}`);
  // Family modifiers.
  const ordL = [1, 2, 3, 4, 5, 6].map((n) => lumOf(L.ord[`--_chart-series-${n}`].rgba));
  for (let i = 0; i < 5; i++) if (ordL[i] <= ordL[i + 1]) failures.push(`--ordinal series ${i + 1} -> ${i + 2} is not darker in light mode`);
  if (!near(L.ord['--_chart-series-7'].rgba, L.ord['--_chart-series-6'].rgba)) failures.push('--ordinal series 7 does not repeat 6');
  if (!near(L.div['--_chart-series-4'].rgba, L.div['--_chart-diverging-mid-color'].rgba)) failures.push('--diverging series 4 is not the neutral midpoint');
  if (!near(L.div['--_chart-series-1'].rgba, L.div['--_chart-diverging-low-color'].rgba) || !near(L.div['--_chart-series-7'].rgba, L.div['--_chart-diverging-high-color'].rgba)) failures.push('--diverging series 1 / 7 are not the poles');
  // The strip paints from the slots.
  if (!near(r.light.swatch3, L.pal['--_chart-series-3'].rgba)) failures.push('palette swatch 3 is not painted from series 3');
  if (!near(r.light.seqSwatch1, L.seq['--_chart-sequential-1'].rgba) || !near(r.light.seqSwatch7, L.seq['--_chart-sequential-7'].rgba)) failures.push('a --sequential strip is not painted from the sequential steps');
  if (r.event !== '--_chart-accent-color') failures.push(`a seed change did not fire transitionend on the transitioned readout (got ${r.event})`);
  return { failures, readouts: readouts.length };
}

async function run() {
  const css = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');
  const s = checkStatic(css);
  const b = await checkBrowser(css, s);
  const failures = [...s.failures, ...b.failures];
  console.log(`[chart] categorical ${s.summary.join(' | ')}; sequential ${s.sequential.length} steps; ${b.readouts} readouts resolve in light, dark, an island, forced contrast and under overrides: ${failures.length ? failures.length + ' failures' : 'ok'}`);
  for (const f of failures) console.log('  ' + f);
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) process.exit(1); });
