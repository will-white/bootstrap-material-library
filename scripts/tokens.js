// Exports the built design tokens as a W3C Design Tokens (DTCG) file:
// dist/m3x.tokens.json. Source of truth is dist/m3x.css (the tokens layer),
// so whatever Sass configuration produced the build is what gets exported.
//   md.ref.palette.*   sRGB hex of every palette step (the static tier)
//   md.sys.color.*     light value as an alias, dark value in
//                      $extensions.m3x.dark (DTCG has no light-dark pair)
//   md.sys.*, m3.*     shape, spacing, motion, elevation, state and every
//                      component token; var() references become aliases,
//                      computed values (calc, color-mix, light-dark) keep
//                      their CSS text in $value with $extensions.m3x.css
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');
const pkg = require(path.join(ROOT, 'package.json'));

// --- collect declarations from the tokens layer -----------------------------
const start = css.indexOf('@layer tokens {');
const end = css.indexOf('\n@layer ', start + 1);
const layer = css.slice(start, end < 0 ? undefined : end);

const decls = new Map();
const stack = [];
let i = 0, buf = '';
const allowed = (ctx) => ctx.every((p) => p === ':root' || p.startsWith('@supports (color: light-dark(#000, #fff))') || p === '@layer tokens');
while (i < layer.length) {
  const ch = layer[i];
  if (ch === '{') { stack.push(buf.trim()); buf = ''; }
  else if (ch === '}') { stack.pop(); buf = ''; }
  else if (ch === ';') {
    const d = buf.trim(); buf = '';
    const m = /^(--[\w-]+):\s*([\s\S]+)$/.exec(d);
    if (m && stack[stack.length - 1] === ':root' && allowed(stack)) decls.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  } else buf += ch;
  i++;
}

// --- naming -----------------------------------------------------------------
const PREFIXES = ['md-ref-palette-', 'md-sys-color-', 'md-sys-shape-', 'md-sys-motion-', 'md-sys-typescale-', 'md-sys-elevation-', 'md-sys-state-', 'md-sys-spacing-', 'md-extended-color-', 'md-tone-', 'md-', 'm3-'];
function pathOf(prop) {
  const name = prop.slice(2);
  for (const p of PREFIXES) if (name.startsWith(p)) return [...p.slice(0, -1).split('-'), name.slice(p.length)];
  return [name];
}
const alias = (prop) => `{${pathOf(prop).join('.')}}`;

// --- typing -----------------------------------------------------------------
function typed(prop, value) {
  const ext = { css: value };
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (ref) return { $value: alias(ref[1]), $type: inferType(ref[1], decls.get(ref[1]) || ''), $extensions: { m3x: ext } };
  const ld = /^light-dark\(var\((--[\w-]+)\), var\((--[\w-]+)\)\)$/.exec(value);
  if (ld) return { $type: 'color', $value: alias(ld[1]), $extensions: { m3x: { ...ext, dark: alias(ld[2]) } } };
  if (/^#[0-9a-f]{6}$/i.test(value)) return { $type: 'color', $value: value.toLowerCase() };
  const dim = /^(-?[\d.]+)(px|rem|em|%|vw|vh|dvh)$/.exec(value);
  if (dim) return { $type: 'dimension', $value: value };
  const dur = /^(-?[\d.]+)(ms|s)$/.exec(value);
  if (dur) return { $type: 'duration', $value: value };
  const bez = /^cubic-bezier\(([^)]+)\)$/.exec(value);
  if (bez) return { $type: 'cubicBezier', $value: bez[1].split(',').map((n) => parseFloat(n)) };
  if (/^-?[\d.]+$/.test(value)) return { $type: 'number', $value: parseFloat(value) };
  if (/font$/.test(prop) || /-family$/.test(prop)) return { $type: 'fontFamily', $value: value.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')) };
  return { $type: inferType(prop, value), $value: value, $extensions: { m3x: ext } };
}
function inferType(prop, value) {
  if (/color|palette|-seed$/.test(prop) || /^(oklch|color-mix|rgb|hsl|light-dark)\(/.test(value)) return 'color';
  if (/duration/.test(prop)) return 'duration';
  if (/easing|spring(?!.*duration)/.test(prop)) return 'cubicBezier';
  if (/shadow|elevation-\d/.test(prop)) return 'shadow';
  if (/opacity|density|-l$|weight|grade|optical|columns|level|z-/.test(prop)) return 'number';
  if (/font$/.test(prop) || /-family$/.test(prop)) return 'fontFamily';
  return 'dimension';
}

// --- assemble ---------------------------------------------------------------
const root = { $extensions: { m3x: { version: pkg.version, generator: 'scripts/tokens.js', source: 'dist/m3x.css' } } };
for (const [prop, value] of decls) {
  const segs = pathOf(prop);
  let node = root;
  for (const s of segs.slice(0, -1)) node = node[s] ??= {};
  node[segs[segs.length - 1]] = typed(prop, value);
}
const out = path.join(ROOT, 'dist/m3x.tokens.json');
fs.writeFileSync(out, JSON.stringify(root, null, 2) + '\n');
console.log(`${path.relative(ROOT, out)}: ${decls.size} tokens`);
