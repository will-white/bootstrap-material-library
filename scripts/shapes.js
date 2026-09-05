// Generates src/_shape-library.scss: M3 Expressive's shape library as CSS
// clip-path polygons.
//
// M3 defines these 35 shapes as ROUNDED POLYGONS -- a vertex list plus a
// per-vertex corner radius -- not as paths. That definition is in androidx's
// MaterialShapes.kt, and this script is a port of it: it builds each shape's
// vertex list exactly as Compose does, rounds every corner with the tangent
// arc the radius asks for, walks the resulting outline at a constant arc
// length, and writes the samples out as percentages of the element's box.
//
// Why polygon() and not path(): `clip-path: path()` takes absolute user
// units, so a shape written that way would not scale with the box it clips.
// polygon() takes percentages, works everywhere clip-path does, and at 56
// samples a rounded corner is indistinguishable from its arc at UI sizes.
//
// What this does NOT port is CornerRounding's SMOOTHING parameter, which
// blends the ends of the arc further along the edges. Ignoring it leaves a
// plain circular corner where M3 has a slightly softer one -- visible only
// under magnification, and the alternative was to leave nine of the shapes
// out. The generated file says so too.
//
// Run: npm run shapes (also runs as the first step of npm run build).
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'src', '_shape-library.scss');
const SAMPLES = 56;

// --- geometry ---------------------------------------------------------------

const rad = (deg) => (deg / 180) * Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => {
  const l = len(a);
  return l === 0 ? [0, 0] : [a[0] / l, a[1] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

// Compose's rotateZ, in screen coordinates (y down, so positive is clockwise).
const rotate = (p, deg, c = [0, 0]) => {
  const a = rad(deg);
  const o = sub(p, c);
  return add([o[0] * Math.cos(a) - o[1] * Math.sin(a), o[0] * Math.sin(a) + o[1] * Math.cos(a)], c);
};

// --- the four RoundedPolygon constructors MaterialShapes uses ----------------

// A regular polygon on the unit circle, vertex 0 on the +x axis.
const polygon = (n, rounding = 0, perVertex = null) =>
  Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return { p: [Math.cos(a), Math.sin(a)], r: perVertex ? perVertex[i] : rounding };
  });

// A star: outer vertices on the unit circle, inner ones between them.
const star = (n, innerRadius, rounding = 0) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const b = (Math.PI * 2 * (i + 0.5)) / n;
    out.push({ p: [Math.cos(a), Math.sin(a)], r: rounding });
    out.push({ p: [Math.cos(b) * innerRadius, Math.sin(b) * innerRadius], r: rounding });
  }
  return out;
};

// A rectangle centred on the origin; corners in Compose's order.
const rectangle = (w, h, rounding = 0, perVertex = null) => {
  const l = -w / 2;
  const t = -h / 2;
  const r = w / 2;
  const b = h / 2;
  const pts = [
    [r, b],
    [l, b],
    [l, t],
    [r, t],
  ];
  return pts.map((p, i) => ({ p, r: perVertex ? perVertex[i] : rounding }));
};

// MaterialShapes.customPolygon: a point list repeated around a centre, with
// an optional mirrored alternation between repetitions.
const custom = (points, reps, mirroring = false, center = [0.5, 0.5]) => {
  if (!mirroring) {
    const np = points.length;
    return Array.from({ length: np * reps }, (_, i) => ({
      p: rotate(points[i % np].p, (Math.floor(i / np) * 360) / reps, center),
      r: points[i % np].r,
    }));
  }
  // doRepeat's mirroring branch, transcribed.
  const angles = points.map((q) => (Math.atan2(q.p[1] - center[1], q.p[0] - center[0]) * 180) / Math.PI);
  const distances = points.map((q) => len(sub(q.p, center)));
  const actualReps = reps * 2;
  const sectionAngle = 360 / actualReps;
  const out = [];
  for (let it = 0; it < actualReps; it++) {
    for (let index = 0; index < points.length; index++) {
      const i = it % 2 === 0 ? index : points.length - 1 - index;
      if (i > 0 || it % 2 === 0) {
        const a = rad(sectionAngle * it + (it % 2 === 0 ? angles[i] : sectionAngle - angles[i] + 2 * angles[0]));
        out.push({ p: add([Math.cos(a) * distances[i], Math.sin(a) * distances[i]], center), r: points[i].r });
      }
    }
  }
  return out;
};

const pnr = (x, y, r = 0) => ({ p: [x, y], r });
const transform = (verts, fn) => verts.map((v) => ({ p: fn(v.p), r: v.r }));
const scaled = (sx, sy) => (p) => [p[0] * sx, p[1] * sy];
const turned = (deg) => (p) => rotate(p, deg);

// --- rounding + sampling ----------------------------------------------------

// Round every corner with the arc its radius asks for, clamping any radius
// that would overrun the edge it shares with its neighbour, then return the
// outline as a list of segments.
function outline(verts) {
  const n = verts.length;
  const corners = verts.map((v, i) => {
    const prev = verts[(i - 1 + n) % n].p;
    const next = verts[(i + 1) % n].p;
    const e1 = norm(sub(prev, v.p));
    const e2 = norm(sub(next, v.p));
    // The interior angle at this vertex.
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(e1, e2))));
    const half = theta / 2;
    // A straight run (or a doubled point) is not a corner.
    if (!v.r || !isFinite(theta) || theta < 1e-4 || Math.PI - theta < 1e-4) {
      return { v: v.p, d: 0, e1, e2, r: 0 };
    }
    return { v: v.p, d: v.r / Math.tan(half), e1, e2, r: v.r, half };
  });

  // Scale back any pair whose tangent points would cross on their shared edge.
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const edge = len(sub(b.v, a.v));
    const want = a.d + b.d;
    if (want > edge && want > 0) {
      const k = edge / want;
      a.d *= k;
      a.r *= k;
      b.d *= k;
      b.r *= k;
    }
  }

  const segs = [];
  const tangents = corners.map((c) => ({
    in: add(c.v, mul(c.e1, c.d)),
    out: add(c.v, mul(c.e2, c.d)),
  }));

  for (let i = 0; i < n; i++) {
    const c = corners[i];
    if (c.r > 0 && c.d > 0) {
      // The arc centre sits on the bisector, r / sin(half) from the vertex.
      const bis = norm(add(c.e1, c.e2));
      const centre = add(c.v, mul(bis, c.r / Math.sin(c.half)));
      const a0 = Math.atan2(tangents[i].in[1] - centre[1], tangents[i].in[0] - centre[0]);
      const a1 = Math.atan2(tangents[i].out[1] - centre[1], tangents[i].out[0] - centre[0]);
      let sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      segs.push({ kind: 'arc', centre, r: c.r, a0, sweep, length: Math.abs(sweep) * c.r });
    }
    // The straight run to the next corner.
    const from = tangents[i].out;
    const to = tangents[(i + 1) % n].in;
    const l = len(sub(to, from));
    if (l > 1e-9) segs.push({ kind: 'line', from, to, length: l });
  }
  return segs;
}

// Walk the outline at a constant arc length.
function sample(segs, count) {
  const total = segs.reduce((s, g) => s + g.length, 0);
  const step = total / count;
  const pts = [];
  let seg = 0;
  let used = 0;
  for (let i = 0; i < count; i++) {
    let want = i * step;
    while (seg < segs.length - 1 && want > used + segs[seg].length) {
      used += segs[seg].length;
      seg++;
    }
    const g = segs[seg];
    const t = g.length === 0 ? 0 : Math.min(1, (want - used) / g.length);
    if (g.kind === 'line') {
      pts.push(add(g.from, mul(sub(g.to, g.from), t)));
    } else {
      const a = g.a0 + g.sweep * t;
      pts.push(add(g.centre, [Math.cos(a) * g.r, Math.sin(a) * g.r]));
    }
  }
  return pts;
}

// normalized(): fit the shape's bounds to the element's box.
function fit(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const w = x1 - x0 || 1;
  const h = y1 - y0 || 1;
  return pts.map((p) => [((p[0] - x0) / w) * 100, ((p[1] - y0) / h) * 100]);
}

const pct = (n) => {
  const v = Math.round(n * 100) / 100;
  return (Object.is(v, -0) ? 0 : v).toString();
};

// Compose starts every shape's outline where it likes; rotating the sample
// list so it begins at the topmost point makes the generated file stable and
// readable, and a closed polygon does not care where it starts.
function fromTop(pts) {
  let best = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][1] < pts[best][1]) best = i;
  return pts.slice(best).concat(pts.slice(0, best));
}

// Compose walks its outlines clockwise in screen coordinates; make sure ours
// do too, so shapes that are mirrored in their definition still read the same
// way round.
function clockwise(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += cross(a, b);
  }
  return area >= 0 ? pts : pts.slice().reverse();
}

// --- the 35 shapes, as MaterialShapes.kt defines them ------------------------

const SHAPES = {
  circle: () => polygon(10, 1),
  square: () => rectangle(1, 1, 0.3),
  slanted: () => custom([pnr(0.926, 0.97, 0.189), pnr(-0.021, 0.967, 0.187)], 2),
  arch: () => transform(polygon(4, 0, [1, 1, 0.2, 0.2]), turned(-135)),
  fan: () => custom([pnr(1.004, 1.0, 0.148), pnr(0.0, 1.0, 0.151), pnr(0.0, -0.003, 0.148), pnr(0.978, 0.02, 0.803)], 1),
  arrow: () =>
    custom([pnr(0.5, 0.892, 0.313), pnr(-0.216, 1.05, 0.207), pnr(0.499, -0.16, 0.215), pnr(1.225, 1.06, 0.211)], 1),
  'semi-circle': () => rectangle(1.6, 1, 0, [0.2, 0.2, 1, 1]),
  oval: () => transform(transform(polygon(10, 1), scaled(1, 0.64)), turned(-45)),
  pill: () => custom([pnr(0.961, 0.039, 0.426), pnr(1.001, 0.428), pnr(1.0, 0.609, 1.0)], 2, true),
  triangle: () => transform(polygon(3, 0.2), turned(-90)),
  diamond: () => custom([pnr(0.5, 1.096, 0.151), pnr(0.04, 0.5, 0.159)], 2),
  'clam-shell': () => custom([pnr(0.171, 0.841, 0.159), pnr(-0.02, 0.5, 0.14), pnr(0.17, 0.159, 0.159)], 2),
  pentagon: () => custom([pnr(0.5, -0.009, 0.172), pnr(1.03, 0.365, 0.164), pnr(0.828, 0.97, 0.169)], 1, true),
  gem: () =>
    custom([pnr(0.499, 1.023, 0.241), pnr(-0.005, 0.792, 0.208), pnr(0.073, 0.258, 0.228), pnr(0.433, 0.0, 0.491)], 1, true),
  sunny: () => star(8, 0.8, 0.15),
  'very-sunny': () => custom([pnr(0.5, 1.08, 0.085), pnr(0.358, 0.843, 0.085)], 8),
  'cookie-4': () => custom([pnr(1.237, 1.236, 0.258), pnr(0.5, 0.918, 0.233)], 4),
  'cookie-6': () => custom([pnr(0.723, 0.884, 0.394), pnr(0.5, 1.099, 0.398)], 6),
  'cookie-7': () => transform(star(7, 0.75, 0.5), turned(-90)),
  'cookie-9': () => transform(star(9, 0.8, 0.5), turned(-90)),
  'cookie-12': () => transform(star(12, 0.8, 0.5), turned(-90)),
  ghostish: () => custom([pnr(0.5, 0, 1.0), pnr(1, 0, 1.0), pnr(1, 1.14, 0.254), pnr(0.575, 0.906, 0.253)], 1, true),
  'clover-4': () => custom([pnr(0.5, 0.074), pnr(0.725, -0.099, 0.476)], 4, true),
  'clover-8': () => custom([pnr(0.5, 0.036), pnr(0.758, -0.101, 0.209)], 8),
  burst: () => custom([pnr(0.5, -0.006, 0.006), pnr(0.592, 0.158, 0.006)], 12),
  'soft-burst': () => custom([pnr(0.193, 0.277, 0.053), pnr(0.176, 0.055, 0.053)], 10),
  boom: () => custom([pnr(0.457, 0.296, 0.007), pnr(0.5, -0.051, 0.007)], 15),
  'soft-boom': () =>
    custom([pnr(0.733, 0.454), pnr(0.839, 0.437, 0.532), pnr(0.949, 0.449, 0.439), pnr(0.998, 0.478, 0.174)], 16, true),
  flower: () => custom([pnr(0.37, 0.187), pnr(0.416, 0.049, 0.381), pnr(0.479, 0.001, 0.095)], 8, true),
  puffy: () =>
    transform(
      custom(
        [
          pnr(0.5, 0.053),
          pnr(0.545, -0.04, 0.405),
          pnr(0.67, -0.035, 0.426),
          pnr(0.717, 0.066, 0.574),
          pnr(0.722, 0.128),
          pnr(0.777, 0.002, 0.36),
          pnr(0.914, 0.149, 0.66),
          pnr(0.926, 0.289, 0.66),
          pnr(0.881, 0.346),
          pnr(0.94, 0.344, 0.126),
          pnr(1.003, 0.437, 0.255),
        ],
        2,
        true
      ),
      scaled(1, 0.742)
    ),
  'puffy-diamond': () => custom([pnr(0.87, 0.13, 0.146), pnr(0.818, 0.357), pnr(1.0, 0.332, 0.853)], 4, true),
  'pixel-circle': () =>
    custom(
      [
        pnr(0.5, 0.0),
        pnr(0.704, 0.0),
        pnr(0.704, 0.065),
        pnr(0.843, 0.065),
        pnr(0.843, 0.148),
        pnr(0.926, 0.148),
        pnr(0.926, 0.296),
        pnr(1.0, 0.296),
      ],
      2,
      true
    ),
  'pixel-triangle': () =>
    custom(
      [
        pnr(0.11, 0.5),
        pnr(0.113, 0.0),
        pnr(0.287, 0.0),
        pnr(0.287, 0.087),
        pnr(0.421, 0.087),
        pnr(0.421, 0.17),
        pnr(0.56, 0.17),
        pnr(0.56, 0.265),
        pnr(0.674, 0.265),
        pnr(0.675, 0.344),
        pnr(0.789, 0.344),
        pnr(0.789, 0.439),
        pnr(0.888, 0.439),
      ],
      1,
      true
    ),
  bun: () => custom([pnr(0.796, 0.5), pnr(0.853, 0.518, 1), pnr(0.992, 0.631, 1), pnr(0.968, 1.0, 1)], 2, true),
  heart: () =>
    custom([pnr(0.5, 0.268, 0.016), pnr(0.792, -0.066, 0.958), pnr(1.064, 0.276, 1.0), pnr(0.501, 0.946, 0.129)], 1, true),
};

// --- emit --------------------------------------------------------------------

const rows = Object.entries(SHAPES).map(([name, build]) => {
  const pts = clockwise(fromTop(fit(sample(outline(build()), SAMPLES))));
  const body = pts.map(([x, y]) => `${pct(x)}% ${pct(y)}%`).join(', ');
  return `  "${name}": polygon(${body}),`;
});

const out = `// ============================================================================
// GENERATED by scripts/shapes.js -- do not edit by hand.
//
// M3 Expressive's shape library: ${rows.length} shapes, each a rounded polygon in
// androidx's MaterialShapes.kt, sampled here at ${SAMPLES} points and written as a
// percentage clip-path so it scales with whatever box it clips.
//
// CornerRounding's SMOOTHING parameter is not ported: nine of these shapes ask
// for it, and without it their corners are plain circular arcs rather than
// M3's slightly softer transition. The difference shows under magnification,
// not at UI sizes.
// ============================================================================

@use "sass:map";

$shapes: (
${rows.join('\n')}
);

// Apply one of M3's shapes to an element. The polygon is in percentages, so
// it follows the box it is put on -- no size is baked in.
//
//   .avatar { @include m3.material-shape("cookie-9"); }
@mixin shape($name) {
  @if not map.has-key($shapes, $name) {
    @error "Unknown M3 shape #{$name}. One of: #{map.keys($shapes)}";
  }
  clip-path: #{map.get($shapes, $name)};
}
`;
fs.writeFileSync(OUT, out);
console.log(`${OUT.split('/').slice(-2).join('/')}: ${rows.length} shapes at ${SAMPLES} samples`);
