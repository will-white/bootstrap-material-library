// Token namespace contract (no browser): the library's two tiers stay
// distinguishable by name, both prefixes are configurable, and nothing in the
// build hardcodes either one.
//
//   --<sys>-ref-* / --<sys>-sys-* / --<sys>-extended-* / --<sys>-tone-/-seed
//                              the M3 tier ($sys-prefix, "md" by default)
//   --<lib>-sys-*              the library's own globals ($prefix, "m3")
//   --<lib>-<component>-*      per-component tokens
//
// The rule that matters: every --<lib>-* token is either a sys global or
// resolves to exactly one component stem. Before the split they shared one
// namespace and --m3-icon-size (a global) was indistinguishable from
// --m3-icon-weight (the icon component) and --m3-icon-btn-size (another
// component).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'dist/m3x.css'), 'utf8');

// Component stems, read from the partials that declare them (same derivation
// the token export uses).
function stems() {
  const dir = path.join(ROOT, 'src/components');
  const out = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.scss'))) {
    const block = /@mixin tokens\s*\{([\s\S]*?)\n\}/.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!block) continue;
    const groups = new Map();
    for (const m of block[1].matchAll(/--#\{c\.\$prefix\}-([a-z0-9-]+):/g)) {
      const segs = m[1].split('-');
      if (!groups.has(segs[0])) groups.set(segs[0], []);
      groups.get(segs[0]).push(segs);
    }
    for (const [head, segs] of groups) {
      let stem = head;
      if (segs.length > 1) {
        const cap = Math.min(...segs.map((s) => s.length)) - 1;
        const common = [];
        for (let i = 0; i < Math.max(cap, 1); i++) {
          if (new Set(segs.map((s) => s[i])).size !== 1) break;
          common.push(segs[0][i]);
        }
        if (common.length) stem = common.join('-');
      }
      if (out.has(stem)) throw new Error(`stem "${stem}" claimed by ${out.get(stem)} and ${file}`);
      out.set(stem, file);
    }
  }
  return out;
}

async function run() {
  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };

  const owner = stems();
  const STEMS = [...owner.keys()].sort((a, b) => b.length - a.length);

  // Every --m3-* token in the build is a sys global, a legacy alias of one, or
  // exactly one component's.
  // Only names that are declared or read: `@supports (anchor-name: --m3-t)`
  // feature queries mention identifiers that are not tokens.
  const sysGlobals = new Set([...css.matchAll(/--m3-sys-([a-z0-9-]+)\s*[:,)]/g)].map((m) => m[1]));
  const lib = new Set([
    ...[...css.matchAll(/(--m3-[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    ...[...css.matchAll(/var\((--m3-[a-z0-9-]+)/g)].map((m) => m[1]),
  ].map((n) => n.slice(5)));
  // Pre-1.0 names still read as fallbacks. Each must have a namespaced
  // canonical that is read first, so the short name is a courtesy rather than
  // the API. A new entry here is a deliberate decision, not an oversight.
  const DEPRECATED = new Map([['swatch', 'color-palette-swatch-color']]);
  for (const [old_, canonical] of DEPRECATED) {
    expect(lib.has(canonical), `deprecated --m3-${old_} has no canonical --m3-${canonical}`);
  }

  const unclaimed = [];
  for (const name of lib) {
    if (name.startsWith('sys-')) continue;
    if (sysGlobals.has(name)) continue; // deprecated alias of a global
    if (DEPRECATED.has(name)) continue;
    if (!STEMS.some((s) => name === s || name.startsWith(`${s}-`))) unclaimed.push(name);
  }
  expect(unclaimed.length === 0, `--m3-* tokens matching no component stem: ${unclaimed.slice(0, 8).join(', ')}`);

  // The tiers cannot overlap as long as no component claims the `sys` stem.
  expect(!STEMS.includes('sys'), 'a component stem named "sys" would collide with the library globals');

  // Both prefixes are honoured: a build with neither default leaves no
  // hardcoded --md-* or --m3-* behind.
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'm3x-ns-'));
  const entry = path.join(tmp, 'p.scss');
  fs.writeFileSync(entry, `@use "${path.join(ROOT, 'src')}" with ($sys-prefix: "acme", $prefix: "ax");\n`);
  let out = '';
  try {
    execFileSync(path.join(ROOT, 'node_modules/.bin/sass'), [entry, path.join(tmp, 'p.css'), '--style=expanded'], { stdio: 'pipe' });
    out = fs.readFileSync(path.join(tmp, 'p.css'), 'utf8');
  } catch (e) {
    failures.push(`custom-prefix build failed: ${String(e.stderr || e.message).split('\n')[0]}`);
  }
  if (out) {
    const leaked = [...new Set([...out.matchAll(/--(?:md|m3)-[a-z0-9-]+/g)].map((m) => m[0]))];
    expect(leaked.length === 0, `custom-prefix build still emits default names: ${leaked.slice(0, 6).join(', ')}`);
    expect(/--acme-sys-color-primary/.test(out), 'custom $sys-prefix did not reach the system roles');
    expect(/--ax-sys-space-4/.test(out), 'custom $prefix did not reach the library globals');
    expect(/--ax-btn-height/.test(out), 'custom $prefix did not reach the component tokens');
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  // The exported token file mirrors the tiers.
  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/m3x.tokens.json'), 'utf8'));
  expect(!!(tokens.m3 && tokens.m3.sys && tokens.m3.comp), 'token export is missing the m3.sys / m3.comp groups');
  if (tokens.m3 && tokens.m3.comp) {
    const iconKeys = Object.keys(tokens.m3.comp.icon || {});
    expect(!iconKeys.includes('size'), `m3.comp.icon should not carry the global icon size, got ${iconKeys.join(', ')}`);
    expect(Object.keys(tokens.m3.comp).length === owner.size, `m3.comp has ${Object.keys(tokens.m3.comp || {}).length} components, expected ${owner.size}`);
  }

  if (!failures.length) {
    console.log(`[namespace] ${sysGlobals.size} library globals, ${owner.size} component stems, both prefixes configurable, export grouped by tier: ok`);
  }
  return failures;
}

module.exports = { run };
if (require.main === module) run().then((f) => { f.forEach((x) => console.log('  ' + x)); process.exit(f.length ? 1 : 0); });
