// Exports the built design tokens as a W3C Design Tokens (DTCG) file:
// dist/m3x.tokens.json. Source of truth is dist/m3x.css (the tokens layer),
// so whatever Sass configuration produced the build is what gets exported.
// Groups follow the token tiers, and both prefixes are read out of the build
// rather than assumed, so a $sys-prefix / $prefix build exports under its own
// names:
//   <sys>.ref.palette.*   sRGB hex of every palette step (the static tier)
//   <sys>.sys.color.*     light value as an alias, dark value in
//                         $extensions.m3x.dark (DTCG has no light-dark pair)
//   <sys>.sys.*           shape, motion, typescale, elevation, state
//   <lib>.sys.*           the library's own globals (space, density, stroke,
//                         z, opacity, icon and target sizes)
//   <lib>.comp.<name>.*   per-component tokens, grouped by the component that
//                         declares them (stems read from src/components/*.scss,
//                         so icon, icon-btn and the icon-size global land in
//                         three distinct groups rather than one flat tree)
// var() references become aliases; computed values (calc, color-mix,
// light-dark) keep their CSS text in $value with $extensions.m3x.css
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

// Both prefixes come from the build: the system tier is whatever carries
// -ref-palette-, the library tier whatever carries -sys-space-none.
const SYS = (/--([a-z0-9]+)-ref-palette-/.exec(css) || [, 'md'])[1];
const LIB = (/--([a-z0-9]+)-sys-space-none/.exec(css) || [, 'm3'])[1];

// Component token stems, read from the partials that declare them, so the
// export never has to guess where `icon-btn-size` splits.
function componentStems() {
  const dir = path.join(ROOT, 'src/components');
  const stems = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.scss'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const block = /@mixin tokens\s*\{([\s\S]*?)\n\}/.exec(src);
    if (!block) continue;
    const names = [...block[1].matchAll(/--#\{c\.\$prefix\}-([a-z0-9-]+):/g)].map((m) => m[1].split('-'));
    const groups = new Map();
    for (const segs of names) {
      if (!groups.has(segs[0])) groups.set(segs[0], []);
      groups.get(segs[0]).push(segs);
    }
    for (const [head, segs] of groups) {
      let stem = head;
      if (segs.length > 1) {
        // The longest shared lead, never the whole token name.
        const cap = Math.min(...segs.map((s) => s.length)) - 1;
        const common = [];
        for (let i = 0; i < Math.max(cap, 1); i++) {
          if (new Set(segs.map((s) => s[i])).size !== 1) break;
          common.push(segs[0][i]);
        }
        if (common.length) stem = common.join('-');
      }
      stems.set(stem, file.replace(/^_|\.scss$/g, ''));
    }
  }
  return [...stems.keys()].sort((a, b) => b.length - a.length);
}
const STEMS = componentStems();

// $legacy-global-aliases emits the pre-1.0 name of every library global next
// to the current one. They are the same token under an older name, and they
// collide with component stems (--m3-icon-size, the global, would file itself
// under the icon component), so the export describes only the current names.
for (const prop of [...decls.keys()]) {
  const m = new RegExp(`^--${LIB}-(?!sys-)(.+)$`).exec(prop);
  if (!m) continue;
  const current = `--${LIB}-sys-${m[1]}`;
  if (!decls.has(current)) continue;
  // The current token reads the alias, so fold the real value into it before
  // the alias goes -- otherwise the export would alias a token it dropped.
  if (decls.get(current) === `var(${prop})`) decls.set(current, decls.get(prop));
  decls.delete(prop);
}

const SYS_GROUPS = ['ref-palette-', 'ref-typeface-', 'sys-color-', 'sys-shape-', 'sys-motion-', 'sys-typescale-', 'sys-elevation-', 'sys-state-', 'extended-color-', 'tone-'];
function pathOf(prop) {
  const name = prop.slice(2);
  if (name.startsWith(`${SYS}-`)) {
    const rest = name.slice(SYS.length + 1);
    for (const g of SYS_GROUPS) {
      if (rest.startsWith(g)) return [SYS, ...g.slice(0, -1).split('-'), rest.slice(g.length)];
    }
    return [SYS, rest];
  }
  if (name.startsWith(`${LIB}-sys-`)) return [LIB, 'sys', name.slice(LIB.length + 5)];
  if (name.startsWith(`${LIB}-`)) {
    const rest = name.slice(LIB.length + 1);
    for (const stem of STEMS) {
      if (rest === stem || rest.startsWith(`${stem}-`)) {
        return [LIB, 'comp', stem, rest.slice(stem.length + 1) || 'default'];
      }
    }
    return [LIB, rest];
  }
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
