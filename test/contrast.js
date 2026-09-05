// Contrast, in two passes.
//
// 1. The built scheme's role pairs meet M3's minimums in both modes, at the
//    configured level and at high contrast, read straight from dist/m3x.css
//    (static sRGB tier, i.e. what a tier-1 browser paints).
//
// 2. What a browser actually paints on the one-of-everything fixture: every
//    element carrying its own text, against the nearest opaque background
//    behind it. Pass 1 asserts that the pairs M3 names are sound; it cannot
//    see a component that reaches for the WRONG pair. .m3-island--inverse
//    re-pointed --md-sys-color-primary to inverse-primary and left
//    --md-sys-color-on-primary alone, so a filled button inside one painted
//    a near-white label on a light purple container -- 1.6:1, and every role
//    pair involved was individually fine.
const fs = require('fs');
const path = require('path');
const { launch, serve } = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function parse(css) {
  const hex = {};
  for (const m of css.matchAll(/--md-ref-palette-([a-z-]+?)(\d+): (#[0-9a-f]{6})/g)) hex[`${m[1]}${m[2]}`] ??= m[3];
  const pairs = (text) => {
    const out = {};
    for (const m of text.matchAll(/--md-(?:sys|extended)-color-([a-z-]+): light-dark\(var\(--md-ref-palette-([a-z0-9-]+)\), var\(--md-ref-palette-([a-z0-9-]+)\)\)/g)) out[m[1]] ??= [m[2], m[3]];
    return out;
  };
  const base = pairs(css);
  const at = css.lastIndexOf('[data-contrast=high] {');
  const high = at < 0 ? {} : pairs(css.slice(at, css.indexOf('\n  }', at) + 4));
  return { hex, base, high: { ...base, ...high } };
}

function check(scheme, hex, level, mins) {
  const failures = [];
  const color = (role, mode) => { const p = scheme[role]; if (!p) throw new Error(`no role ${role}`); const h = hex[p[mode]]; if (!h) throw new Error(`no palette step ${p[mode]}`); return h; };
  const need = (a, b, min, mode) => {
    const r = ratio(color(a, mode), color(b, mode));
    if (r < min) failures.push(`${level} ${mode ? 'dark' : 'light'}: ${a} on ${b} = ${r.toFixed(2)} < ${min}`);
  };
  for (const mode of [0, 1]) {
    for (const accent of ['primary', 'secondary', 'tertiary', 'error', 'success', 'warning', 'info']) {
      need(`on-${accent}`, accent, mins.onAccent, mode);
      need(`on-${accent}-container`, `${accent}-container`, mins.onContainer, mode);
      need(accent, 'surface', mins.accent, mode);
    }
    for (const surface of ['surface', 'surface-dim', 'surface-bright', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest']) {
      need('on-surface', surface, mins.onSurface, mode);
      need('on-surface-variant', surface, mins.onSurfaceVariant, mode);
    }
    need('outline', 'surface', mins.outline, mode);
    need('inverse-on-surface', 'inverse-surface', mins.onSurface, mode);
    need('inverse-primary', 'inverse-surface', mins.accent, mode);
    for (const fixed of ['primary', 'secondary', 'tertiary']) {
      need(`on-${fixed}-fixed`, `${fixed}-fixed`, mins.onContainer, mode);
      need(`on-${fixed}-fixed-variant`, `${fixed}-fixed-dim`, mins.onContainer, mode);
    }
  }
  return failures;
}

// --- pass 2: rendered -------------------------------------------------------

// Text that is meant to be muted: M3 mixes disabled content to 38% and
// placeholders sit on the same footing, so neither is held to 4.5:1.
const RENDERED_SKIP = ':disabled, [aria-disabled="true"], .disabled, .m3-date-picker__day--outside, .visually-hidden, .placeholder';

function rendered(SKIP) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  // getComputedStyle hands back oklch(); rasterising one pixel is the shortest
  // honest path to the sRGB the screen gets.
  const px = (c) => {
    if (cache.has(c)) return cache.get(c);
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const v = [d[0], d[1], d[2], d[3] / 255];
    cache.set(c, v);
    return v;
  };
  const lin = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const behind = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = px(getComputedStyle(n).backgroundColor);
      if (c[3] > 0.9) return c;
    }
    return [255, 255, 255, 1];
  };

  const out = [];
  for (const el of document.querySelectorAll('#sink *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.35) continue;
    if (el.closest(SKIP)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const fg = px(cs.color), bg = behind(el);
    const got = cr(fg, bg);
    const size = parseFloat(cs.fontSize);
    const min = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700) ? 3 : 4.5;
    if (got < min) {
      const id = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      out.push(`${id} "${el.textContent.trim().slice(0, 22)}": ${Math.round(got * 100) / 100}:1, needs ${min}:1`);
    }
  }
  return out;
}

async function renderedPass() {
  const fixture = fs.readFileSync(path.join(ROOT, 'test/fixtures/sink.html'), 'utf8');
  const server = await serve(ROOT, {
    '/m3x.css': fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8'),
    '/page.html': fixture.replace('<!--HEAD-->', '<style>@import url("/m3x.css");</style>'),
  });
  const browser = await launch();
  const failures = [];
  let checked = 0;
  try {
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      await page.route('**://**', (r) => (r.request().url().includes('127.0.0.1') ? r.continue() : r.abort()));
      await page.goto(`http://127.0.0.1:${server.port}/page.html`, { waitUntil: 'load' });
      const bad = await page.evaluate(rendered, RENDERED_SKIP);
      checked += await page.evaluate(() => document.querySelectorAll('#sink *').length);
      for (const b of bad) failures.push(`${colorScheme}: ${b}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return { failures, checked };
}

async function run() {
  const css = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');
  const { hex, base, high } = parse(css);
  const failures = [
    ...check(base, hex, 'standard', { onAccent: 4.5, onContainer: 4.5, accent: 4.5, onSurface: 4.5, onSurfaceVariant: 4.5, outline: 3 }),
    ...check(high, hex, 'high', { onAccent: 7, onContainer: 4.5, accent: 7, onSurface: 7, onSurfaceVariant: 7, outline: 4.5 }),
  ];
  console.log(`[contrast] ${Object.keys(base).length} roles, ${Object.keys(hex).length} palette steps: ${failures.length ? failures.length + ' failures' : 'ok'}`);
  for (const f of failures) console.log('  ' + f);

  const r = await renderedPass();
  console.log(`[contrast rendered] ${r.checked} elements across light and dark (islands and forced-contrast subtrees included): ${r.failures.length ? r.failures.length + ' failures' : 'ok'}`);
  for (const f of r.failures) console.log('  ' + f);
  return failures.concat(r.failures);
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) process.exit(1); });
