# m3x

**Material 3 (Material You) as a pure CSS/Sass design system, built on modern CSS
primitives, with a complete Bootstrap 5.3 interop surface.**

- One implementation, two vocabularies: every component is authored once as Sass
  mixins; `.m3-*` classes and Bootstrap's class names are emitted from the *same*
  mixins. `.btn.btn-primary` and `.m3-btn.m3-btn--filled` render identically.
- Zero runtime JavaScript. Theming, dark mode, states, and every component are
  pure CSS on semantic HTML (`<button>`, `<input>`, `<dialog>`, `<label>`).
  Your existing `bootstrap.bundle.js` keeps working through the state-class
  contract (`.show`, `.collapsing`, `.active`, ...).
- Everything is a custom property. Colors, lengths, radii, borders, focus rings,
  spacing, durations, easings, z-indices, and opacities all resolve through a
  four-tier token chain -- retheme anything at `:root`, per region, or per
  instance without touching a selector.
- Self-sufficient for Bootstrap apps. Components, the grid, the full utility
  API, helpers, and reboot-level element defaults all ship from m3x, so a
  Bootstrap 5.3 codebase needs **nothing from `bootstrap.css`** -- only its
  JS, if you still want Bootstrap-driven behavior.

```bash
npm i && npm run build
# then serve the repo root statically and open demo/index.html
```

---

## Browser support

The support **floor is `@layer`** (Chrome/Edge 99, Firefox 97, Safari 15.4 --
Baseline 2022). `@layer` is an unknown at-rule to anything older and cannot be
cheaply polyfilled, so it defines the floor. Above the floor, features tier up
via `@supports`:

| Capability | Gate | Without it |
|---|---|---|
| Static sRGB scheme | none (floor) | -- (dark mode via `prefers-color-scheme` only) |
| `light-dark()` scheme switching | `@supports (color: light-dark(#000, #fff))` | media-query dark scheme; `[data-theme]` forcing unavailable |
| OKLCH palettes | `@supports (color: oklch(0% 0 0)) and (color: light-dark(#000, #fff))` | build-time sRGB equivalents |
| Runtime seed retheming | `@supports (color: oklch(from red l c h))` | Sass-precomputed palette stands |
| `@scope` refinements | none -- see below | slightly less isolation, identical rendering |
| Anchor-positioned tooltips, Popover menus | per-feature `@supports` | hidden gracefully / static fallback |

`@scope` (Chrome 118, Safari 17.4, Firefox 140) carries **refinement, never
load-bearing structure**: donut slot protection, low-specificity internals, and
token islands. Browsers without it drop those blocks wholesale and every
component still renders correctly. `@scope` blocks are never gated behind
`@supports` -- the `at-rule()` query is newer than `@scope` itself and would
only shrink support further.

---

## The cascade-layer contract

The **first statement** of the compiled CSS is exactly:

```css
@layer reset, bootstrap, tokens, bootstrap-compat, base, components, utilities, overrides;
```

1. `reset` -- minimal modern reset (box-sizing, margin zeroing, media defaults,
   `:focus-visible` groundwork). Nothing opinionated.
2. `bootstrap` -- **reserved and left empty by the library.** Consumers who
   still ship real Bootstrap import it here so every later layer beats it:

   ```css
   @layer reset, bootstrap, tokens, bootstrap-compat, base, components, utilities, overrides;
   @import url("bootstrap.min.css") layer(bootstrap);
   @import url("m3x.css");
   ```

3. `tokens` -- all `@property` registrations and every tier-1/2/3 custom
   property (M3 system tokens, palettes, component tokens, motion, shape,
   spacing, elevation, state opacities).
4. `bootstrap-compat` -- remaps `--bs-*` variables onto M3 tokens and emits the
   full Bootstrap component re-skin. Compiled only when enabled. Sits **after**
   `bootstrap` so its definitions win. Split into `own` and `rules` sub-layers
   (see *Box ownership* below).
5. `base` -- element defaults: body typography, headings on the M3 typescale,
   links, `::selection`, scrollbar color, `accent-color`. Element rules
   target *unclassed* elements (`h2:where(:not([class]))`, ...) at zero added
   specificity, so class-carrying markup in the earlier `bootstrap-compat`
   layer keeps control of its own typography and link styling.
6. `components` -- the full M3 catalog (`own` + `rules` sub-layers).
7. `utilities` -- typescale classes, color/surface/shape/elevation utilities,
   token-island context classes, the Bootstrap utility API and helpers
   (`own` + `rules` sub-layers).
8. `overrides` -- **declared, always empty, owned by downstream consumers.**
   The library never writes into it.

### Consumer escape hatches (in precedence order)

- **(a) Unlayered CSS wins, zero config.** Per the cascade spec, anything you
  write *outside* any layer beats **all** library layers. Your existing
  stylesheet already overrides m3x.
- **(b) `@layer overrides { ... }`** is the disciplined path if you run your
  own layered architecture -- it is the last library-declared layer, so it
  beats everything the library ships while staying inside the layer system.

**`@scope` and the contract:** scoping proximity ranks *below* both layers and
specificity in the cascade. `@scope` blocks (always authored inside their
proper layer) can never leapfrog the layer order or defeat your `overrides` /
unlayered styles.

Advanced consumers who manage the layer order themselves can suppress the
library's order statement with `$emit-layer-statement: false`.

### Box ownership

Every piece of component chrome -- a button, a card container, a list item's
headline, a switch's handle, a touch target -- owns its **complete resting
box**: every property a stylesheet can visibly set. Nothing about a
component's resting look is left to the UA stylesheet or to whatever the host
page declares in a lower layer (a reset, a legacy theme, stock Bootstrap in
the reserved layer). The contract splits by inheritance:

- **Non-inherited properties are reset** to their neutral value: position and
  insets, z-index, float, sizes and min/max sizes, margin, padding, overflow,
  flex and grid item properties, gap, columns, aspect-ratio, border, radius,
  border-image, outline, background (every longhand), shadow, opacity,
  transforms, filters, clip-path, mask, blend mode, isolation, will-change,
  contain, animation, transition, appearance, resize, object-fit/position,
  user-select, touch-action, text decoration, text-overflow, vertical-align.
- **Inherited text properties are neutral on chrome.** Chrome text never
  inherits the page's italics, small caps, transforms, shadows, indents,
  spacing, hyphenation or list markers; the face itself is owned by the
  typescale wherever chrome carries text.
- **The rest is inherited on purpose, explicitly:** color, cursor, visibility,
  pointer-events, caret and accent color, color-scheme, image-rendering. A
  part follows its component root, the root follows the page, and a host
  rule aimed at the element itself has no effect.
- **Generated content is owned too.** `::before`/`::after` of every chrome
  element reset to `content: none`; the marks, chevrons, dividers and touch
  targets m3x draws set `content` after that and explicitly inherit font,
  color and cursor, so a host `*::after` rule cannot repaint them.
- **`display` is stated by every chrome rule** (it is the one visual
  property with no neutral value).

Two consequences worth knowing:

- **Density is the only vertical authority.** Controls set `padding-block: 0`
  and take their height from `calc(token + var(--m3-density) * 4px)`. A host
  rule such as `.btn { padding: 6px 12px }` in the `bootstrap` layer changes
  nothing; padding is horizontal only.
- **Content regions inherit on purpose.** Slots and bodies (`.m3-card__slot`,
  `.card-body`, `.m3-list-item__slot`, `.offcanvas-body`, ...) reset their
  non-inherited box and re-inherit everything else, so the typography of
  *your* content inside them stays yours.

Not chrome, and deliberately not owned beyond what they set: wrappers placed
on your own elements (`.m3-badge-anchor`, `.m3-tooltip-anchor`) and layout
scaffolding (`.container*`, `.row`, `.col*`).

Mechanically, each layer that carries chrome (`bootstrap-compat`,
`components`, `utilities`) is split into two sub-layers:

```css
@layer components {
  @layer own, rules;
  @layer rules { /* every component rule */ }
  @layer own   {
    .m3-btn, .m3-card, .m3-list-item__headline, ... { /* one shared reset */ }
    .m3-btn::before, .m3-btn::after, ... { content: none; /* ... */ }
  }
}
```

`rules` beats `own` regardless of specificity or source order, so the reset can
never clobber a library rule, and it costs one rule per layer instead of one
per component. Rules you write directly into `@layer components { }` beat both
sub-layers (a layer's own declarations rank above its sub-layers); unlayered
CSS and `overrides` beat everything, as before.

This is verified by a differential audit in headless Chromium: every
component, every re-skinned Bootstrap class, and open dialogs, sheets and
popovers are rendered once cleanly and once under a hostile host -- a
universal `*, *::before, *::after` rule that sets a visibly wrong value for
every property in the contract (`display`, `content` and the
inherited-by-design properties are aimed at leaf chrome so legitimate
inheritance is never confused with a leak), plus stock Bootstrap 5.3, both in
the `bootstrap` layer. 449 elements, 0 leaked declarations.

---

## Color engine: OKLCH tonal palettes from one seed

M3 schemes derive from tonal palettes. Google's reference implementation uses
**HCT**; m3x **approximates HCT with OKLCH**. HCT tone equals CIELAB L\*, so
tone *T*'s OKLCH lightness is computed exactly at build time as the OKLCH `l`
channel of `lab(T 0 0)`. Results are **visually close but not bit-identical**
to `material-color-utilities` output: OKLCH hue lines and gamut mapping differ
slightly from HCT's. Chroma is capped per tone at build time so every static
value stays inside sRGB.

Five palettes derive from the seed (`$seed: #6750a4` by default): `primary`
(seed chroma capped at 0.17), `secondary` (~0.05), `tertiary` (hue +60deg,
~0.08), `neutral` (~0.012), `neutral-variant` (~0.025), plus a fixed `error`
palette and **extended** `success` / `warning` / `info` palettes
(`--md-extended-color-*`) for Bootstrap parity.

**Runtime retheming** (behind the relative-color gate): every palette step is
re-derived from `--md-seed`, so one line rethemes the entire app -- both
vocabularies, every component:

```css
:root { --md-seed: oklch(0.55 0.15 250); }   /* or any CSS color */
```

Dark mode is `color-scheme` all the way down: every `--md-sys-color-*` role is
defined once with `light-dark()`; forcing a theme is just:

```css
[data-theme="light"] { color-scheme: light; }
[data-theme="dark"]  { color-scheme: dark; }
```

`[data-bs-theme]` is aliased to the same mechanism, so existing Bootstrap theme
togglers keep working. Elevation container fills come from the
surface-container roles (current M3), never tonal-overlay hacks; shadows derive
from the `shadow` role via `color-mix()`.

### Theme transitions

Because color tokens are registered via `@property` as `<color>`, changing
`--md-seed` or toggling `[data-theme]` produces **smoothly interpolated theme
transitions** on elements that transition their color-consuming properties.
Opt in globally (respects `prefers-reduced-motion`):

```html
<html class="m3-theme-transition" ...>
```

---

## The four-tier variable architecture

Every value in the library flows through this chain:

1. **Reference tokens** -- `--md-ref-palette-*`: raw palette steps.
2. **System tokens** -- `--md-sys-*`: semantic roles (color, typescale, shape,
   elevation, motion, state opacities). Library extensions are clearly
   namespaced: `--md-extended-color-*`, the spacing scale `--m3-space-1..8`
   (4/8/12/16/24/32/48/64px -- **an m3x extension; M3 defines no official
   spacing token set**), stroke widths `--m3-stroke-*`, z-indices `--m3-z-*`,
   and density `--m3-density` (0 to -3).
3. **Component tokens** -- `--m3-btn-*`, `--m3-card-*`, `--m3-field-*`, ...:
   the public API of each component, defined in the `tokens` layer, each
   defaulting to a system token. **The Bootstrap re-skin consumes these same
   tier-3 tokens**, so retheming a component rethemes both vocabularies.
4. **Private per-instance variables** -- `--_container`, `--_content`,
   `--_state-opacity`: set inside component rules. Variants and states
   re-point these and nothing else. Underscore prefix = not API.

Components consume only tiers 3-4 (plus the shared state/focus/motion machinery
in the library's mixins); tier-3 defaults reference tier 2; tier 2 references
tier 1. Tiers chain **by declaration**, never by nested
`var(a, var(b, var(c)))` fallback pyramids (banned: undebuggable, and they hide
the tier structure).

### The composability payoff

```css
.brand-cta { --m3-btn-container-color: var(--md-sys-color-tertiary); }
```

recolors every button inside `.brand-cta` -- **including `.btn` Bootstrap
buttons** -- with no selector wars. Works per instance via `style=""`, per
region via any ancestor, or globally via `:root`. Every height-based
interactive control participates in density:
`height: calc(var(--m3-btn-height) + var(--m3-density) * 4px)`.
(Selection-control glyphs -- checkbox, radio, switch, slider thumb -- are
fixed-size per the M3 spec; their >=48px touch targets stay constant.)

### Button variable API (the canonical example)

Every component partial opens with a comment block documenting its public
variable API; this table is the button's, and the pattern holds for all
components.

| Token | Default | Notes |
|---|---|---|
| `--m3-btn-height` | 40px (2.5rem) | participates in density |
| `--m3-btn-height-small` | 32px | `.m3-btn--small` / `.btn-sm` |
| `--m3-btn-height-large` | 48px | `.m3-btn--large` / `.btn-lg` |
| `--m3-btn-padding-inline` | `--m3-space-5` (24px) | |
| `--m3-btn-padding-inline-small` | `--m3-space-4` | |
| `--m3-btn-padding-inline-large` | `--m3-space-6` | |
| `--m3-btn-icon-gap` | `--m3-space-2` | |
| `--m3-btn-icon-size` | 18px | leading icon slot |
| `--m3-btn-shape` | `corner-full` | |
| `--m3-btn-outline-width` | `--m3-stroke-hairline` | outlined variant |
| `--m3-btn-container-color` | `primary` | filled container |
| `--m3-btn-label-color` | `on-primary` | filled label |
| `--m3-btn-tonal-container-color` | `secondary-container` | |
| `--m3-btn-tonal-label-color` | `on-secondary-container` | |
| `--m3-btn-elevated-container-color` | `surface-container-low` | |
| `--m3-btn-elevated-label-color` | `primary` | |
| `--m3-btn-outlined-label-color` | `primary` | |
| `--m3-btn-outlined-outline-color` | `outline` | |
| `--m3-btn-text-label-color` | `primary` | |

---

## State system

No hardcoded rgba state colors exist anywhere. M3 state layers and disabled
treatments are expressed exclusively as `color-mix()` **in sRGB** (matching
M3's alpha compositing; `oklab`/`oklch` interpolation is reserved for
decorative gradients):

```css
background-color: color-mix(in srgb, var(--_state-color) var(--_state-opacity), var(--_container));
```

State-layer opacities are tokens (hover 8%, focus 10%, pressed 10%, dragged
16%); disabled content is `on-surface` at 38%, containers at 12%. Focus is
`:focus-visible` everywhere: a 3px indicator with 2px offset, both tokenized
(`--md-sys-state-focus-indicator-*`), drawn around the component's shape.

Selection controls follow the spec's own geometry rather than the generic
pattern: checkbox and radio paint a 40dp circular state layer inside the 48dp
touch target (on-surface unselected, primary selected, the two swapping when
pressed) and their focus indicator is the ring 2dp outside that circle, not a
box around the glyph; the switch paints its 40dp layer centered on the handle,
which grows to 28dp while pressed; a selected segmented button shows the check
icon. Check marks (checkbox, filter chip, segmented button) are drawn at the
Material Symbols glyph proportions and optically centered.

---

## Bootstrap interop

Enabled by default (`$enable-bootstrap-compat`, `$enable-bootstrap-reskin`).
Three pieces:

- **Variable remap (9a).** `var(--bs-primary)`, `--bs-body-bg`,
  `--bs-border-radius`, `--bs-box-shadow`, the `-bg-subtle`/`-border-subtle`/
  `-text-emphasis` families, and friends all resolve to M3 tokens. The
  `--bs-*-rgb` triplets are the **one** place scheme values are duplicated
  (light on `:root`, dark under `[data-theme="dark"]`/`[data-bs-theme="dark"]`
  and a `prefers-color-scheme` block), because `light-dark()` returns a color,
  not a channel list.
- **Component re-skin (9b).** Every Bootstrap 5.3 component renders in M3
  visuals from the same mixins as the `.m3-*` classes (see the table below).
  The re-skin styles Bootstrap's existing class + state contract and never
  alters markup expectations.
- **Grid (on by default, `$enable-bootstrap-grid`).** Containers
  (`.container`, `-fluid`, `-{sm..xxl}`), the `.row`/`.col-*` flex grid with
  the `--bs-gutter-x/y` contract, `.row-cols-*`, offsets, orders, `.g-*`
  gutters, and the CSS-grid opt-in (`.grid`, `.g-col-*`, `.g-start-*`), all
  responsive across `$grid-breakpoints` (576/768/992/1200/1400px) and driven
  by the spacing scale. Emitted in the `bootstrap-compat` layer.
- **Utility API (on by default, `$enable-bootstrap-utilities`).** The full
  Bootstrap 5.3 utility set generated from tokens: spacing, gap, display
  (incl. print), flex, float, object-fit, order, and text-alignment with
  responsive variants; plus align, opacity, overflow, shadow, focus-ring,
  position, border, sizing, font, text, color, link, background,
  interaction, rounded, visibility, and z-index utilities. Emitted in the
  `utilities` layer so they beat every component layer. Two deliberate
  differences from Bootstrap: no `!important` unless importance parity is on (utilities beat all library
  layers but never your own unlayered CSS -- that is the layer contract),
  and the `--bs-text-opacity`/`--bs-bg-opacity`/`--bs-border-opacity`/
  `--bs-link-opacity` contracts are honored through `color-mix()` instead of
  `rgba(var(--bs-*-rgb))`.
- **Helpers + content classes (on by default, `$enable-bootstrap-helpers`).**
  `.visually-hidden(-focusable)`, `.stretched-link`, `.ratio-*`,
  `.fixed-*`/`.sticky-*`, `.vstack`/`.hstack`, `.vr`, `.clearfix`,
  `.icon-link`, and the type/content classes (`.lead`, `.display-*`,
  `.blockquote(-footer)`, `.mark`, `.small`, `.initialism`,
  `.list-unstyled`/`.list-inline`, `.img-fluid`/`.img-thumbnail`,
  `.figure*`). Reboot-level element defaults (lists, `blockquote`, `mark`,
  `sub`/`sup`, `abbr`, `kbd`, `pre`, `fieldset`/`legend`, `[hidden]`) live in
  the `base` layer.

Together these cover what a typical Bootstrap app consumes from
`bootstrap.css`; the components table below lists what still needs
Bootstrap's *JavaScript*. Size: the full default build is about 470 KB
expanded / 385 KB minified (about 42 KB gzipped); turn off the grid,
utilities, or helpers flags to trim it.

### Running alongside real Bootstrap (optional)

You do not need `bootstrap.css` at all. If you keep it during a migration
(for example for a Bootstrap plugin's own styles), import it into the
reserved layer so every m3x layer beats it:

```css
@layer reset, bootstrap, tokens, bootstrap-compat, base, components, utilities, overrides;
@import url("bootstrap.min.css") layer(bootstrap);
@import url("m3x.css");
```

Everything m3x defines beats the `bootstrap` layer, and because every
component owns its resting box (see *Box ownership*), a Bootstrap theme in
that layer cannot leak spacing, borders, typography or effects into
components. Stock Bootstrap's own `!important` declarations (its utilities,
helpers and responsive navbar/offcanvas rules) are `var(--bs-*)`-driven almost
without exception, and m3x defines those variables, so they compute to M3
values too. The handful with literal values (`.text-bg-*` forces `#fff`/`#000`
text) are covered by **importance parity**:

```scss
@use "m3x/src" with ($enable-bootstrap-important-parity: true);
```

This re-emits exactly those declarations, with m3x's values and `!important`,
into the `reset` layer. `reset` is the only layer ordered before `bootstrap`,
and among important declarations the *earlier* layer wins, so m3x's values
prevail -- and consumers face precisely the importance they already faced
with stock Bootstrap, nothing more. Off (the default), m3x ships no
`!important` beyond `[hidden]`.

With the flag on, the parity audit -- every component, re-skinned class,
utility and helper in the audit page, light and dark scheme -- computes
identically with and without `bootstrap.css` in the reserved layer: 0
differing declarations. Off, the only differences are the `.text-bg-*` text
colors. (Bootstrap's `--bs-*-rgb` triplets are build-time sRGB renderings of
the OKLCH tokens; where a stock important utility reads one, the color can
differ from the token by up to 5/255 per channel in the dark scheme, below
visual threshold.)

Two details make the "with or without" invariant hold:

- Bootstrap's reboot applies to every element, while m3x's `base` layer only
  styles *unclassed* ones (so it can never beat a compat component). The
  compat layer therefore opens with zero-specificity reboot rules for
  **classed** elements (`:where(p[class]) { margin-block: 0 1rem }`, link
  color on classed anchors, heading sizes, ...), which every component rule
  overrides -- exactly the cascade a page sees with stock Bootstrap present.
- The utility API follows Bootstrap's contract where stock forces a literal:
  `.fs-*` uses Bootstrap's fluid sizes, `.float-*` is physical, `.z-*` is
  numeric, helpers own every property stock sets on the same class.

What can still reach a component is a host's **own** `!important` in the
`bootstrap` layer (or unlayered). Strip importance from that theme at build
time (`bootstrap.css` itself stays untouched), extend the parity block, or
isolate with Shadow DOM. Blanket `!important` inside m3x would not help:
`bootstrap` precedes every m3x layer, so a theme's important declaration
beats an m3x important declaration regardless, while m3x's would beat every
normal declaration you write.

### Migration zones

Re-skin a legacy page region by region instead of all at once:

```scss
@use "m3x/src" with ($bootstrap-reskin-scope: "[data-m3]");
```

```html
<section data-m3>  <!-- Bootstrap markup here renders in M3 -->
```

The 9b re-skin is wrapped in `@scope ([data-m3])`; outside those zones, legacy
Bootstrap CSS (in the `bootstrap` layer) keeps rendering. Note the variable
remap (9a) stays global by design so `var(--bs-*)` reads are consistent.

### Interop table

"JS needed" means Bootstrap's own `bootstrap.bundle.js` (or your replacement)
still drives *behavior*; visuals never need it. Components marked "native"
have an M3 counterpart that needs no JS at all.

| Bootstrap component | M3 counterpart | JS needed for behavior? | Migration note |
|---|---|---|---|
| `.accordion` (+ `.collapse`/`.collapsing`) | -- (styled natively from tokens) | Yes (collapse) | Or migrate to `<details>`/native patterns at your own pace |
| `.alert` | -- (container-role styling) | No (dismiss needs JS) | `alert-*` maps to `*-container` roles |
| `.badge` | `.m3-badge` | No | `.text-bg-*` re-points the badge tokens |
| `.breadcrumb` | -- (styled natively) | No | `--bs-breadcrumb-divider` still respected |
| `.btn`, `.btn-*`, `.btn-outline-*` | `.m3-btn` + variants | No | `primary`->filled, `secondary`->tonal, others re-point filled |
| `.btn-group`, `.btn-check` | `.m3-button-group--connected`, `.m3-btn-check` | No | horizontal groups render as connected button groups (checked member = primary); `.btn-group-vertical` stacks |
| `.btn-close` | `.m3-icon-btn` (CSS-drawn cross) | No | |
| `.card` + parts | `.m3-card--outlined` + parts | No | `.card-body` acts as the donut slot |
| `.carousel` | `.m3-carousel` (scroll-snap) | Yes (autoplay/controls) | M3 counterpart needs no JS at all |
| `.dropdown-menu`/`.dropdown-item` | `.m3-menu`/`.m3-menu__item` | Yes (open/position) | M3 menu uses the Popover API, no JS |
| `.list-group` | `.m3-list`/`.m3-list-item` | No | `.active` maps to the selected state |
| `.modal` + parts | `.m3-dialog` on `<dialog>` | Yes (open/close) | native `<dialog>.showModal()` replaces it in one line |
| `.navbar` + `.navbar-toggler` | `.m3-top-app-bar` | Yes (collapse toggling) | toggler icon is CSS-drawn |
| `.nav-tabs` / `.nav-pills` | `.m3-tabs` / pills | Yes (pane switching) | M3 tabs also work on real radio inputs, no JS |
| `.offcanvas` | `.m3-sheet--bottom/--side` on `<dialog>` | Yes | native dialog variant needs no JS |
| `.pagination` | -- (state-layered page links) | No | |
| `.placeholder` (+ glow/wave) | -- (styled natively) | No | sizes (`.placeholder-lg` etc.) intentionally not shipped |
| `.popover` | `.m3-tooltip--rich` | Yes (trigger/position) | arrows are dropped (M3 has none) |
| `.tooltip` | `.m3-tooltip` | Yes (trigger/position) | CSS-only anchor pattern available |
| `.progress`/`.progress-bar` | `.m3-progress` | No | inline `width` and `--m3-progress-value` both work |
| `.spinner-border`/`.spinner-grow` | `.m3-spinner` | No | |
| `.toast` | `.m3-snackbar` | Yes (show/hide timing) | |
| `.table` + variants | -- (styled natively) | No | striped/hover ride the state-layer opacities |
| `.form-control` | `.m3-field` (filled) | No | |
| `.form-select` | `.m3-select` | No | |
| `.form-check` / `.form-switch` | `.m3-checkbox`/`.m3-radio`/`.m3-switch` | No | |
| `.form-range` | `.m3-slider` | No | |
| `.input-group` | -- (field-aware joining) | No | |
| `.form-floating` | `.m3-field` floating label | No | identical markup shape (input then label) |
| validation (`.is-invalid`/`.was-validated`) | `:user-invalid` | No | **pixel-identical error treatment by construction** |

| grid (`.container`, `.row`, `.col-*`, `.g-*`, `.grid`) | -- (token-driven, same contract) | No | responsive across `$grid-breakpoints` |
| utilities (`.d-*`, `.m-*`, `.text-*`, `.bg-*`, `.rounded-*`, ...) | -- (generated from tokens) | No | no `!important`; opacity contracts via `color-mix()` |
| helpers (`.visually-hidden`, `.stretched-link`, `.ratio`, `.sticky-top`, ...) | -- | No | in the `utilities` layer |
| content (`.lead`, `.display-*`, `.blockquote`, `.img-fluid`, ...) | typescale utilities | No | |

**Additive M3 components with no Bootstrap ancestor:** icon buttons, FABs,
segmented buttons, chips, navigation bar / rail / drawer, bottom app bar,
search bar, sliders beyond `form-range` styling, snackbar (as a class), date/
time fields, dividers, token islands.

---

## How to override (in recommended order)

1. **Retheme globally**: set `--md-seed` (relative-color browsers) or any
   system token: `:root { --md-sys-color-primary: oklch(0.5 0.1 150); }`.
2. **Component tokens** per type, per region, or per instance:
   `.sidebar { --m3-card-shape: var(--md-sys-shape-corner-none); }` or
   `<button style="--m3-btn-height: 3rem">`.
3. **`@layer overrides { ... }`** -- the disciplined path for layered setups.
4. **Unlayered CSS always wins** -- your plain stylesheet already outranks
   every m3x layer; no config needed.
5. **Sass `with (...)`** -- `@use "m3x/src" with ($seed: #00695c, $prefix: "md",
   $components: ("button", "card", "text-field"));` for build-time control.
6. **Your `var(--bs-primary)` still works** -- the compat layer redefines every
   `--bs-*` variable on top of M3 tokens, and it lives in a later layer than
   real Bootstrap, so legacy reads resolve to the M3 scheme automatically.

---

## Component catalog (all pure CSS on semantic HTML)

Where M3 specifies JS-driven behavior, m3x resolves it to a native-element or
pure-CSS equivalent -- divergences are listed.

| Component | Classes | Divergence from JS-driven M3 |
|---|---|---|
| Buttons | `.m3-btn` + `--filled/--tonal/--elevated/--outlined/--text`, sizes `--xs/--small/--medium/--large/--xl`, `--square` | -- |
| Icon buttons | `.m3-icon-btn` + variants, sizes `--xs/--small/--medium/--large/--xl`, `--square` | toggle state via `aria-pressed` |
| Button groups | `.m3-button-group` + `--connected`, sizes `--xs..--xl`, `.m3-btn-check` hidden inputs | selected via `aria-pressed`, `.active`, or a checked `.m3-btn-check` |
| Split button | `.m3-split-button` (`__action` + `__toggle` on `.m3-btn`) + `--tonal/--outlined/--elevated` | the toggle is the `popovertarget` of a `.m3-menu[popover]`; the chevron flips through `:has()` |
| Toolbar | `.m3-toolbar` + `--floating/--docked/--standard/--vibrant/--vertical/--fixed` | -- |
| FAB / extended FAB | `.m3-fab` + `--small/--medium/--large/--extended/--fixed`, colors `--primary/--secondary/--tertiary/--surface` | -- |
| FAB menu | `.m3-fab-menu` (`__fab` + `__items[popover]` of `__item`s) | opens through `popovertarget`; the FAB flips to its open look through `:has()`; anchored above the FAB where anchor positioning exists |
| Loading indicator | `.m3-loading-indicator` + `--contained/--small/--large` | shape-morphing loader (build-time polygons, `clip-path`); static under reduced motion |
| Segmented buttons | `.m3-segmented` on real radios/checkboxes | -- |
| Badges | `.m3-badge`, `--dot`, `.m3-badge-anchor` | -- |
| Progress | `.m3-progress`, `.m3-progress-circle`, `.m3-spinner`, `--wavy` variants | value via `--m3-progress-value` |
| Snackbar | `.m3-snackbar` (+ `--fixed`) | show/hide timing is yours |
| Tooltips | `.m3-tooltip`, `--rich`, `.m3-tooltip-anchor` | anchor positioning behind `@supports`, hidden gracefully otherwise |
| Cards | `.m3-card` + variants, donut-scoped chrome | -- |
| Carousel | `.m3-carousel` | CSS scroll-snap, no autoplay |
| Dialogs | `.m3-dialog` on native `<dialog>` (+ `--fullscreen`, `--static` for an in-flow surface) | consumer calls `showModal()` |
| Divider | `.m3-divider` on `<hr>` | -- |
| Lists | `.m3-list` (+ `--dividers`, `--inset`), `.m3-list__subheader`, `.m3-list-item` (one to three lines, donut) with `__overline`, `__leading--avatar/--image/--video`, `__trailing--meta`, trailing controls | -- |
| Bottom/side sheets | `.m3-sheet--bottom/--side` on `<dialog>`, `--side-standard` on `<aside>` | modal variants via `showModal()` |
| Navigation bar/rail/drawer | `.m3-nav-bar`, `.m3-rail`, `.m3-drawer` (+ `--modal`) | active via `aria-current` |
| Tabs | `.m3-tabs` (aria/`.active` or real radio inputs) | pane switching is yours |
| Top/bottom app bars | `.m3-top-app-bar` + size variants, `.m3-bottom-app-bar` | no scroll-elevate (JS) |
| Checkbox / radio / switch | `.m3-checkbox`, `.m3-radio`, `.m3-switch` | `:indeterminate` styled; set it from your code |
| Chips | `.m3-chip` + assist/filter/input/suggestion | filter/input ride real checkboxes; remove button styling only |
| Menus | `.m3-menu` on `[popover]` | positioning via Popover API; hidden gracefully without it |
| Sliders | `.m3-slider` on `input[type="range"]` (current M3 spec: 16px track, bar handle, stop indicator) + `--ticks` | active-track fill is CSS-only in both engines; dual-thumb ranges and value labels need script |
| Date/time inputs | `.m3-datetime` on native date/time inputs | the native popup calendar/clock is the browser's |
| Date picker | `.m3-date-picker` (docked; `--modal` inside `.m3-dialog`; `--range`) with `__nav`, `__grid`, `__day` states (`--today`, `[aria-selected]`, `--outside`, `:disabled`, range start/end) | the calendar surface only: month navigation and selection are your script's or a form's |
| Time picker | `.m3-time-picker` (input mode; `--modal`) with hour/minute fields and the AM/PM selector | the dial mode needs script and is not shipped |
| Text fields | `.m3-field` filled/outlined, floating label, supporting text | -- |
| Search | `.m3-search` (+ `[popover]`/focus panel) | -- |
| Select | `.m3-select` on native `<select>` | native option list, CSS chevron |

---

## Accessibility floor

`:focus-visible` indicators on every interactive element (outlines are never
removed without replacement); M3 role pairings are preserved so on-color
contrast holds; `prefers-reduced-motion` is respected globally (every animated
declaration is gated); a `forced-colors: active` block lets system colors
through on controls; hit targets are >= 48x48px via pseudo-element expansion on
small controls (icon buttons, checkbox, radio, switch, carousel indicators).

---

## Sass API

Dart Sass >= 1.79, modern modules only (`@use`/`@forward`; the library contains
no `@import`).

```scss
@use "m3x/src" with (
  $seed: #6750a4,                  // scheme seed (any Sass-parsable color)
  $prefix: "m3",                   // class + tier-3 token prefix
  $enable-bootstrap-compat: true,  // --bs-* remap (9a)
  $enable-bootstrap-reskin: true,  // component re-skin (9b)
  $enable-bootstrap-grid: true,    // containers + .row/.col grid
  $enable-bootstrap-utilities: true, // full utility API (9c)
  $enable-bootstrap-helpers: true, // helpers + content classes
  $enable-bootstrap-important-parity: false, // literal !important parity with stock
  $grid-breakpoints: (...),        // xs 0 / sm 576px / ... / xxl 1400px
  $container-max-widths: (...),    // sm 540px / ... / xxl 1320px
  $grid-columns: 12,
  $bootstrap-reskin-scope: null,   // e.g. "[data-m3]" for migration zones
  $emit-layer-statement: true,     // suppress if you own the layer order
  $components: (...)               // prune the catalog; default: all
);
```

Functions and mixins are forwarded for building your own components:
`tone($hue, $chroma, $t)`, `palette()`, `okl()`, `rem()`, `hex()`, plus
`state-layer()`, `typescale()`, `focus-ring()`, `elevation()`, `transition()`,
`touch-target()`, the ownership mixins `own-box()` / `own-region()` /
`own-pseudo()`, and every component's rules mixins under prefixed names
(`btn-filled`, `card-container`, `field-input-filled`, ...):

```scss
@use "m3x/src" as m3;
.my-cta { @include m3.btn-base; @include m3.btn-filled; }
```

Standalone includes emit their box-ownership declarations inline
(`$ownership: "inline"`, the default outside the entry point), so a component
built from the mixins is as host-proof as the shipped classes without needing
the `own` sub-layer.

### Build

```bash
npm i
npm run build    # dist/m3x.css + dist/m3x.min.css with source maps
npm run watch
```

---

## Notes on the built artifacts

- The top-level layer order statement is unchanged; `bootstrap-compat`,
  `components` and `utilities` additionally declare `own` and `rules`
  sub-layers (see *Box ownership*).
- `!important` appears only on `[hidden]`, plus the `.text-bg-*` text colors
  when `$enable-bootstrap-important-parity` is on.
- `dist/m3x.css` (expanded) contains zero `rgba()`/`hsla()` anywhere. In
  `dist/m3x.min.css`, Dart Sass's compressed mode re-serializes the
  `transparent` keyword as `rgba(0,0,0,0)` in a handful of structural
  declarations (tap-highlight, transparent backgrounds/borders); these are
  never state layers or disabled treatments and render identically.

---

## License

MIT
