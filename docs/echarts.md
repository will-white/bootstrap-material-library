# ECharts theme bridge: design

Apache ECharts draws on a canvas from a JSON theme. It cannot read `var()`,
`light-dark()` or `color-mix()`, and its own colour code (zrender) parses only
the legacy syntax: `#hex`, `rgb()` / `rgba()`, `hsl()` and named colours. So
"an ECharts theme that follows m3x" is a script that reads the chart tokens
off a host element, normalises them to `rgb()` strings, assembles a theme
object, and does it again when the theme state changes.

This document is that script's design. The CSS half of it is shipped
(`src/components/_chart.scss`, README *Charts*); the JS half is not bundled
yet because the library is zero-JS and the demo has no chart. Everything the
bridge depends on is already asserted by `test/chart.js` against the built
CSS in headless Chromium, so writing the bridge is transcription, not
research.

## 1. What is settled

| Decision | Why |
|---|---|
| The host resolves every chart token into a **registered** private readout (`--_chart-<token>`, `@property` `<color>` / `<length>` / `<number>`, `inherits: true`). | `getComputedStyle` on an unregistered custom property returns the token stream with `var()` substituted and nothing else resolved. Registered, the computed value is absolute: `light-dark()`, `color-mix()` and relative colours are resolved on the host, so an island or forced contrast above it is already applied, and an invalid value falls back to the initial value instead of reaching the script. Measured in Chrome 141, see §7. |
| Readouts are named exactly like the token they resolve. | The bridge's table is the token list; the token export resolves privates back to tokens by the same rule. |
| The theme's `color` array reads `--_chart-series-1..8`; which family fills the slots is a CSS modifier (`--ordinal`, `--sequential`, `--diverging`) or a consumer token. | "Changing or adding a theme" is CSS. The bridge reads a fixed set of names and never changes. |
| The categorical family is fixed, not seed-derived. | Colour-vision safety is a property of absolute hues; every seed-relative rule tried fails the CVD floor for a large share of seeds (§8). Brand shows through the ramps, which run from the surface to `--m3-chart-accent-color`. |
| Colours are normalised through the canvas parser, not by string munging. | Registered `<color>` values serialise as `oklch(...)` or `color(srgb ... / a)`; zrender cannot parse either. Painting one pixel and reading it back yields 8-bit sRGB whatever the serialisation, and also covers the tier-1 case where a default reaches the script as an unresolved `color-mix()` string. |
| One theme object per host, passed to `echarts.init(el, themeObject)`. | A chart in an island or a `[data-contrast]` subtree has different readouts from one on the page. `init` accepts an object, so no `registerTheme` name bookkeeping. |
| Retheming re-inits. | ECharts has no live theme swap. The bridge keeps the consumer's option, disposes, inits with the new theme and re-applies the option. |
| Change detection is `transitionend` on the readouts, plus media-query and attribute listeners, plus an explicit `refresh()`. | A registered property can transition; a 1ms transition on the readouts fires `transitionend` with the readout's name when any upstream token changes (seed, theme attribute, island class, contrast). Asserted in `test/chart.js`. |

## 2. The contract the bridge reads

Every readout below is registered and computes on the host. Colours
serialise as absolute colours; lengths keep their unit (`2px`, and `1rem` for
the typescale-derived sizes: a registered `<length>` is not absolutised, see
§7), numbers are plain.

| Readout | Type | Theme use |
|---|---|---|
| `--_chart-series-1..8` | color | `color` |
| `--_chart-sequential-1..7` | color | `visualMap.color` (ECharts lists it **high to low**, so reversed) |
| `--_chart-diverging-1..7` | color | `visualMap.color` when the bridge is told the map is diverging |
| `--_chart-categorical-1..8` | color | available; the slots already carry them by default |
| `--_chart-background-color` | color | `backgroundColor` |
| `--_chart-text-color` | color | `title.textStyle.color`, `markPoint.label.color`, `toolbox.emphasis.iconStyle.borderColor` |
| `--_chart-label-color` | color | `textStyle.color`, `title.subtextStyle.color`, `legend.textStyle.color`, every axis `axisLabel.color`, `dataZoom.textStyle.color`, `toolbox.iconStyle.borderColor`, `timeline.label.color` |
| `--_chart-axis-color` | color | every axis `axisLine` / `axisTick` `lineStyle.color`, `tooltip.axisPointer.lineStyle.color` / `crossStyle.color`, `dataZoom.borderColor`, `dataZoom.dataBackground.lineStyle.color`, `timeline.lineStyle.color` |
| `--_chart-grid-color` | color | every axis `splitLine.lineStyle.color`, `radar.splitLine`, `dataZoom.dataBackground.areaStyle.color` |
| `--_chart-hover-color` | color | `tooltip.axisPointer.shadowStyle.color`, `categoryAxis.splitArea.areaStyle.color` second entry (first is transparent) |
| `--_chart-tooltip-container-color` / `-content-color` / `-shape` | color / color / length | `tooltip.backgroundColor`, `tooltip.borderColor` (same), `tooltip.borderWidth: 0`, `tooltip.textStyle.color`, `tooltip.borderRadius` (px number); `tooltip.extraCssText` carries the elevation shadow if wanted |
| `--_chart-gap-color` / `-gap-width` | color / length | `bar.itemStyle.borderColor` / `borderWidth`, `pie.itemStyle.*`, `sunburst`, `treemap.itemStyle.borderColor` / `gapWidth`, `funnel.itemStyle.*`: the 2px surface gap between fills |
| `--_chart-line-width` | length | `line.lineStyle.width`, `radar.lineStyle.width`, `parallel.lineStyle.width` |
| `--_chart-marker-size` | length | `line.symbolSize`, `scatter.symbolSize`, `line.symbol: 'circle'`, `line.itemStyle.borderWidth: 2` (the surface ring on overlap) |
| `--_chart-mark-radius` | length | `bar.itemStyle.borderRadius`: `[r, r, 0, 0]` by default (vertical bars, rounded data ends anchored to the baseline); the bridge option `bars: 'horizontal'` gives `[0, r, r, 0]`, `'none'` leaves it |
| `--_chart-positive-color` / `-negative-color` | color | `candlestick.itemStyle.color` / `color0` and their borders; also the bridge's `status` helper |
| `--_chart-zoom-fill-color` / `-zoom-handle-color` | color | `dataZoom.fillerColor`, `dataZoom.handleStyle.color`, `dataZoom.moveHandleStyle.color`, `dataZoom.emphasis.handleStyle.color` |
| `--_chart-title-size` / `-title-weight` / `-label-size` | length / number / length | `title.textStyle.fontSize` / `fontWeight`, `textStyle.fontSize` |
| host `font-family` (computed) | string | `textStyle.fontFamily` |

Other theme keys the bridge sets from the same readouts: `graph.color` and
`graph.label.color`, `map.itemStyle.areaColor` (grid colour) / `borderColor`
(axis colour) with `emphasis.itemStyle.areaColor` from `--_chart-zoom-fill-color`,
`gauge.axisLine.lineStyle.color: [[1, grid]]`, `sankey.lineStyle.color: 'gradient'`,
`boxplot.itemStyle.borderColor: series-1`, `visualMap.textStyle.color: label`.
Everything else keeps ECharts' own default.

## 3. Pipeline

```js
// m3x-echarts.js (sketch; ESM, no bundler needed)
const COLORS = ['background-color', 'text-color', 'label-color', 'axis-color', 'grid-color', 'hover-color',
  'tooltip-container-color', 'tooltip-content-color', 'gap-color', 'positive-color', 'negative-color',
  'zoom-fill-color', 'zoom-handle-color', ...range(8, 'series-'), ...range(7, 'sequential-'), ...range(7, 'diverging-')];
const LENGTHS = ['tooltip-shape', 'gap-width', 'line-width', 'marker-size', 'mark-radius', 'title-size', 'label-size'];
const NUMBERS = ['title-weight'];

let ctx; // one 1x1 canvas for the whole page
function normalize(value) {
  ctx ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#010203';
  ctx.fillStyle = value;                       // the parser accepts it or leaves the sentinel
  if (ctx.fillStyle === '#010203' && !/^(#010203|rgb\(1, 2, 3\))$/.test(value.trim())) return null;
  ctx.clearRect(0, 0, 1, 1); ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

// px out of a computed length. A registered <length> keeps a font-relative
// unit (Chrome serialises the 1rem title size as "1rem"), so rem and em are
// resolved here against the root and the host font sizes, which computed
// style does absolutise.
function px(value, host) {
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(value.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (m[2] === 'rem') return n * parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (m[2] === 'em') return n * parseFloat(getComputedStyle(host).fontSize);
  return n;
}

export function read(host) {
  const cs = getComputedStyle(host);
  const out = { fontFamily: cs.fontFamily, labelSize: parseFloat(cs.fontSize) };  // the host wears the label size
  for (const n of COLORS) out[n] = normalize(cs.getPropertyValue(`--_chart-${n}`)) ?? fallback(n);
  for (const n of LENGTHS) out[n] = px(cs.getPropertyValue(`--_chart-${n}`), host);
  for (const n of NUMBERS) out[n] = parseFloat(cs.getPropertyValue(`--_chart-${n}`)) || 400;
  return out;
}

export function theme(host, options = {}) { return assemble(read(host), options); }  // §2's table
```

Points that make this hold up:

- **Normalise, always.** Even the values that already serialise as
  `rgb()` go through the canvas; one path, one behaviour. Translucent values
  (`grid`, `hover`, `zoom-fill`) lose up to 1/255 per channel to
  premultiplication on readback, which is invisible; the alpha is exact.
- **`fallback(n)`** is a static table of the light defaults (the same values
  the `@property` initial values carry). It is reached only when the parser
  rejects the string, which means a browser with neither `@property` nor the
  function in the default (tier 1 with `color-mix()`, Safari 15.4–16.1,
  Firefox 97–112). It never wins over a computed value.
- **Lengths keep their unit.** Registration as `<length>` does not
  absolutise a font-relative unit in Chrome (measured: `1rem` stays
  `"1rem"`), so `px()` above converts `rem` / `em` against font sizes that
  computed style does absolutise. The host's own `font-size` is the label
  size in `px` already.
- **Fonts**: read the host's computed `font-family`, which the host sets
  from `--m3-chart-font`. Do not read the typescale token; a consumer may
  have set the font on the host.
- **Per-host.** Read on the element the chart mounts on, never on `:root`.
  That is what makes islands and forced contrast work for free.

## 4. Instances and retheming

```js
export function mount(host, option, options = {}) {
  let chart = echarts.init(host, theme(host, options), options.init);
  let current = option;
  chart.setOption(current);
  const refresh = () => {
    const opt = current;                       // the consumer's option, not chart.getOption()
    chart.dispose();
    chart = echarts.init(host, theme(host, options), { ...options.init, ...(options.animateRetheme ? {} : {}) });
    chart.setOption(opt, { notMerge: true, lazyUpdate: false });
  };
  const stop = watch(host, refresh);
  return {
    get chart() { return chart; },
    setOption(next, opts) { current = next; chart.setOption(next, opts); },
    refresh,
    resize: () => chart.resize(),
    dispose() { stop(); chart.dispose(); },
  };
}
```

- `chart.getOption()` returns the option with the old theme's colours merged
  in, so it must not be the source for re-init. The handle keeps the
  consumer's option; `setOption` on the handle keeps it current.
- Re-init loses in-flight state (zoom window, legend selection). Version
  one accepts that on a retheme, which is a rare, user-initiated event; the
  handle exposes the live instance for consumers who want to capture
  `dataZoom` / `legendselectchanged` state and re-apply it after `refresh()`.
- `ResizeObserver` on the host calling `chart.resize()` belongs in the
  bridge too; it is orthogonal to theming and is the standard ECharts chore.

## 5. Change detection

```js
export function watch(host, cb) {
  const props = [...COLORS, ...LENGTHS, ...NUMBERS].map((n) => `--_chart-${n}`);
  host.style.setProperty('transition', props.map((p) => `${p} 1ms linear`).join(', '));
  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(cb); };
  const onEnd = (e) => { if (e.target === host && e.propertyName.startsWith('--_chart-')) schedule(); };
  host.addEventListener('transitionend', onEnd);
  const media = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)'].map((q) => matchMedia(q));
  media.forEach((m) => m.addEventListener('change', schedule));
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-theme', 'data-bs-theme', 'data-contrast', 'class', 'style'] });
  return () => { host.removeEventListener('transitionend', onEnd); media.forEach((m) => m.removeEventListener('change', schedule)); mo.disconnect(); cancelAnimationFrame(frame); };
}
```

- The **transition on the readouts** is the primary signal and the only one
  that sees a token change from anywhere (a `--md-seed` set from script, a
  class added to an ancestor, an inline token on the host). It is set inline
  so the `.m3-theme-transition` utility, which sets `transition-property` on
  every element, does not silence it. With that utility on, a retheme fades
  the page over `--md-sys-motion-duration-medium2` while the readouts, on
  their own 1ms transition, settle immediately; the chart re-inits once, at
  the start of the fade. Reading on every frame of the fade (`transitionrun`
  then a rAF loop until `transitionend`) is possible but re-inits per frame;
  not worth it.
- The media and mutation listeners are belt and braces for a value that
  does not change (no transition fires when the computed value is equal),
  and coalesce with the transition path through the single rAF.
- `refresh()` stays public for consumers who change tokens in a way none of
  the above sees (a stylesheet swap).

## 6. Options and the families

```js
mount(host, option, {
  bars: 'vertical' | 'horizontal' | 'none',   // how --_chart-mark-radius is applied; default 'vertical'
  visualMap: 'sequential' | 'diverging',      // which ramp fills visualMap.color; default 'sequential'
  init: { renderer: 'canvas', ... },          // passed to echarts.init
});
```

Which family fills the **series** slots is not a bridge option: put
`m3-chart--ordinal` / `--sequential` / `--diverging` on the host, or set
`--m3-chart-series-n`, and the theme's `color` array follows. A consumer
theme is a CSS class. The bridge reads the same eight names either way.

The theme carries the data-viz mark specs the tokens encode (2px lines,
8px markers, 2px surface gap between fills, 4px rounded data ends, recessive
grid). It does not add direct labels or a table view; the light-mode yellow
step (slot 4) sits at 2.1:1 on the surface, the reference palette's own
relief case, so a chart that leans on slot 4 should label its marks. The
bridge could expose a `labels: 'relief'` option that turns on
`series.label.show` for slots below 3:1; that is a later decision.

## 7. Facts the design rests on (Chrome 141, headless)

Probed against the built stylesheet before the partial was written; the
first four are now held by `test/chart.js`.

| Observation | Consequence |
|---|---|
| A registered `<color>` custom property computes to an absolute colour: `oklch(0.48 0.13 293.7)`, `color(srgb r g b / a)` for a `color-mix()` default, and `light-dark()` resolved by the host's `color-scheme`. | Registered readouts are what makes "read once, get an absolute colour" true. |
| An unregistered custom property keeps `light-dark(...)` and `color-mix(...)` as text; `var()` of a registered role substitutes the absolute colour. Canvas parses the `color-mix()` string but not the `light-dark()` one. | Never let `light-dark()` reach the script unresolved; hence the registration and, below the `light-dark()` gate, static light + media-dark pairs. |
| `var(--md-sys-state-hover-state-layer-opacity)` (a registered `<percentage>`) assigned to a `<number>` readout is invalid at computed-value time and yields the initial value. | Types must match across the chain; `title-weight` is the only `<number>` and reads a plain number. |
| `transitionend` fires on a registered custom property with an inline 1ms transition when `--md-seed` changes on `:root`. | Change detection without polling. |
| A registered `<length>` readout whose default is a `rem` token computes to `"1rem"`, not `"16px"`; `px` values stay `px`. | The bridge resolves `rem` / `em` itself; `test/chart.js` accepts either form so a browser that does absolutise still passes. |
| `[data-theme="dark"]` on a **subtree** does not flip `--md-sys-color-*` roles, which are declared at `:root` with `light-dark()` and inherit as absolute colours; it flips a `light-dark()` declared on the host itself. The library's forced theming is root-level, as documented. | The categorical `light-dark()` pairs are declared on the host, so they would follow a subtree theme while the chrome would not; nobody should do that, and the docs say the toggle goes on `<html>`. |
| The canvas 2D parser accepts `oklch()`, `color(srgb ...)` and `color-mix()` and reads back 8-bit sRGB; a rejected string leaves the previous `fillStyle`. | The sentinel technique in `normalize()` detects rejection without exceptions. |

## 8. Why the categorical palette is fixed

Three seed-relative rules were searched with the data-viz validator's
checks (OKLCH lightness band per mode, chroma >= 0.10, adjacent-pair
separation >= 8 under Machado protanopia / deuteranopia and >= 15 under
normal vision, contrast against m3x's surfaces `#f9f8fe` / `#131218`),
minimised over 24 seed hues:

| Rule | Best worst-case adjacent CVD separation | Verdict |
|---|---|---|
| Eight hue rotations from the seed at one lightness (`oklch(from var(--md-seed) L C calc(h + r))`) | 2.5 (target 8, floor 6) | hue alone does not survive a red-green simulation |
| Rotations with per-slot lightness alternation, per mode | light 14–15 / dark 1.7–3.3 | the dark band (0.48–0.67) and the chroma floor for teal hues (max in-gamut chroma at L 0.50 is 0.084) leave no room for alternation |
| The reference eight hues **harmonized** toward the seed by M3's rule (up to 15°) | 1.7–5.4 for seeds between 0° and 135° | harmonization pulls every hue on the seed's side of the wheel toward it, compressing exactly the neighbours CVD confuses |
| The reference eight hues, fixed, with per-slot lightness and chroma tuned for m3x's surfaces (shipped) | light **11.9**, dark **10.7**; normal-vision 21.7 / 17.6; one light step below 3:1 | passes every gate in both modes |

The tuned steps live in `$chart-categorical` as OKLCH; `test/chart.js`
re-runs the gates on whatever the build holds, so a brand palette goes in
through Sass and the suite says whether it holds. The medium / high levels
move each step 4% / 8% of lightness away from the surface and are checked
never to lower a step's contrast.

## 9. Packaging and tests (when the JS lands)

- `src/echarts/m3x-echarts.js`, ESM, no dependencies, `echarts` as a peer
  (`>=5`). Built to `dist/m3x-echarts.js` (ESM) and `dist/m3x-echarts.umd.js`
  (global `m3xEcharts`) by a small esbuild step in `npm run build`; ~4 KB.
  `package.json` gets `"exports": { ".": ..., "./echarts": ... }`. The CSS
  stays zero-JS; the bridge is opt-in.
- `test/echarts.js` (Chromium, `echarts` as a devDependency): mount a bar,
  a line, a pie and a heatmap on `.m3-chart` hosts in light, dark, an
  island and forced contrast; assert `chart.getOption().color` equals the
  normalised `--_chart-series-*`; assert the theme object snapshot; toggle
  `data-theme` and `--md-seed` and assert one re-init per change through the
  handle; screenshot-diff the heatmap's `visualMap` against the strip.
- The demo gets one chart per family (bar, line, heatmap with the
  sequential map, a diverging heatmap, candlestick) under the palette
  strips, driven by the existing seed / theme / contrast pickers.

## 10. Open decisions

1. **Bar radius orientation.** The theme cannot know a bar series'
   orientation; `bars: 'vertical'` is the default and horizontal-bar
   consumers pass the option or set `itemStyle.borderRadius` themselves.
2. **Relief labels.** Whether the bridge turns on direct labels for series
   below 3:1 (`labels: 'relief'`), or the docs simply say to.
3. **Live fade.** Whether a retheme under `.m3-theme-transition` should
   re-init once (current design) or animate through the fade.
4. **Separate package or `dist/` file.** A `dist/m3x-echarts.js` next to
   the CSS is simplest; a sub-path export keeps one package.
5. **Server-side rendering.** ECharts SSR has no `getComputedStyle`; a build
   step could emit the light and dark theme objects from
   `dist/m3x.tokens.json` (the export already carries the static tier of
   every chart token, with `series-n` as an alias of `categorical-n`) for a
   `themes.json` a server can use. Out of scope until asked for.
