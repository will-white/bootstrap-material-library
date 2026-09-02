// Contrast: the built scheme's role pairs meet M3's minimums in both modes,
// at the configured level and at high contrast, read straight from
// dist/m3x.css (static sRGB tier, i.e. what a tier-1 browser paints).
const fs = require('fs');
const path = require('path');

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

async function run() {
  const css = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');
  const { hex, base, high } = parse(css);
  const failures = [
    ...check(base, hex, 'standard', { onAccent: 4.5, onContainer: 4.5, accent: 4.5, onSurface: 4.5, onSurfaceVariant: 4.5, outline: 3 }),
    ...check(high, hex, 'high', { onAccent: 7, onContainer: 4.5, accent: 7, onSurface: 7, onSurfaceVariant: 7, outline: 4.5 }),
  ];
  console.log(`[contrast] ${Object.keys(base).length} roles, ${Object.keys(hex).length} palette steps: ${failures.length ? failures.length + ' failures' : 'ok'}`);
  for (const f of failures) console.log('  ' + f);
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { if (f.length) process.exit(1); });
