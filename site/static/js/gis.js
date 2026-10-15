// GIS blocks, part one: raster and vector, point in polygon, line
// simplification, Voronoi and Delaunay, spatial interpolation. Part two
// is gis-maps.js. Every map is synthetic and generated here.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { outs, rng, gauss, seg, toggles, svgPoint, rgbOf, mix, onTheme, signedArea, crossings, inside, delaunay, bary, segDist, fmtInt } from "./gis-util.js";

const BRAND = "var(--brand)", BLUE = "var(--vec-u)", RED = "var(--code-del)";
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clear = (n) => n.replaceChildren();
const km2 = (m2) => (m2 >= 1e6 ? `${num(m2 / 1e6, 3)} km²` : `${num(m2 / 1e4, 1)} ha`);

// A blob ring around (cx, cy): radius modulated by a few seeded harmonics.
function blob(seed, cx, cy, R, n, harmonics = 6, wobble = 0.16) {
  const rand = rng(seed), terms = [];
  for (let k = 2; k < 2 + harmonics; k++) terms.push([k, (wobble * (rand() + 0.3)) / Math.sqrt(k - 1), rand() * Math.PI * 2]);
  const ring = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = 1;
    for (const [k, a, ph] of terms) r += a * Math.sin(k * t + ph);
    ring.push([cx + R * 1.45 * r * Math.cos(t), cy + R * 0.9 * r * Math.sin(t)]);
  }
  return ring;
}

// Cell centres inside a ring, row by row: crossings of each row's centre
// line give spans, so the count equals point-in-polygon on every centre.
function rasterise(ring, cell, W, H) {
  const rows = [];
  let count = 0;
  for (let y = cell / 2, r = 0; y < H; y += cell, r++) {
    const xs = crossings(ring, [-1, y]).map((c) => c.x).sort((a, b) => a - b);
    const spans = [];
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // Columns whose centre x0 = cell(c + ½) lies in [xs[k], xs[k+1]).
      const c0 = Math.ceil(xs[k] / cell - 0.5), c1 = Math.ceil(xs[k + 1] / cell - 0.5) - 1;
      if (c1 >= c0) {
        spans.push([c0, c1]);
        count += c1 - c0 + 1;
      }
    }
    rows.push(spans);
  }
  return { rows, count };
}

// ============================================================ Raster and vector

for (const root of document.querySelectorAll("[data-gis-raster]")) {
  const svg = root.querySelector("[data-map]"), canvas = root.querySelector("[data-canvas]"), chart = root.querySelector("[data-chart]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const W = 640, H = 400, MPP = 5; // metres per viewBox unit: 3.2 × 2.0 km
  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.imageRendering = "auto";
  let seed = 7, ring, curve;
  const s = scrubAll(root, draw);
  const show = toggles(root, draw);

  function build() {
    ring = blob(seed, 330, 200, 118, 160);
    const area = Math.abs(signedArea(ring)) * MPP * MPP;
    curve = [];
    for (let c = 5; c <= 160; c += 5) {
      const { count } = rasterise(ring, c / MPP, W, H);
      curve.push([c, ((count * c * c - area) / area) * 100]);
    }
  }

  function draw() {
    const cellM = s.cell.get(), cell = cellM / MPP;
    const vecArea = Math.abs(signedArea(ring)) * MPP * MPP;
    const { rows, count } = rasterise(ring, cell, W, H);
    const rasArea = count * cellM * cellM;

    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = rgbOf(root, BLUE);
    ctx.fillStyle = `rgba(${r},${g},${b},0.38)`;
    rows.forEach((spans, i) => {
      for (const [c0, c1] of spans) ctx.fillRect(c0 * cell, i * cell, (c1 - c0 + 1) * cell, cell);
    });

    clear(svg);
    if (show.grid && cell >= 4) {
      const g2 = el("g", { style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
      for (let x = cell; x < W; x += cell) el("line", { x1: x, x2: x, y1: 0, y2: H }, g2);
      for (let y = cell; y < H; y += cell) el("line", { x1: 0, x2: W, y1: y, y2: y }, g2);
    }
    if (show.vector) {
      el("polygon", { points: ring.map((p) => p.join(",")).join(" "), style: `fill:none;stroke:${BRAND};stroke-width:2;stroke-linejoin:round` }, svg);
      for (const p of ring.filter((_, i) => i % 4 === 0)) el("circle", { cx: p[0], cy: p[1], r: 1.6, style: `fill:${BRAND}` }, svg);
    }
    // Scale bar: 500 m.
    el("line", { x1: 20, x2: 20 + 500 / MPP, y1: H - 18, y2: H - 18, style: "stroke:currentColor;stroke-width:2" }, svg);
    text(svg, 20, H - 24, "500 m");

    const err = (rasArea - vecArea) / vecArea;
    o.vec.textContent = km2(vecArea);
    o.ras.textContent = km2(rasArea);
    o.err.textContent = `${err >= 0 ? "+" : "−"}${num(Math.abs(err) * 100, 2)}%`;
    o.cells.textContent = fmtInt(count);
    o.verts.textContent = ring.length;

    clear(chart);
    const maxE = Math.max(2, ...curve.map((p) => Math.abs(p[1])));
    const f = frame(chart, { box: [52, 16, 560, 116], x: [0, 160], y: [-maxE, maxE], xticks: [0, 20, 40, 60, 80, 100, 120, 140, 160], yticks: [-maxE, 0, maxE].map((v) => Math.round(v)), yfmt: (v) => `${v}%`, xlabel: "cell size (m)", ylabel: "raster area error" });
    el("line", { x1: f.sx(0), x2: f.sx(160), y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, f.g);
    polyline(f.g, curve.map(([c, e]) => [f.sx(c), f.sy(e)]), `stroke:${BLUE};stroke-width:1.5`);
    for (const [c, e] of curve) el("circle", { cx: f.sx(c), cy: f.sy(e), r: 1.8, style: `fill:${BLUE}` }, f.g);
    el("circle", { cx: f.sx(cellM), cy: f.sy(err * 100), r: 4.5, style: `fill:${BRAND};stroke:var(--background);stroke-width:2` }, f.g);
  }

  root.querySelector("[data-action=new]").addEventListener("click", () => {
    seed = (seed * 48271 + 11) % 2147483647;
    build();
    draw();
  });
  onTheme(draw);
  build();
  draw();
}

// ============================================================ Point in polygon

const PIP_SHAPES = {
  bay: () => [[110, 70], [520, 60], [560, 180], [520, 330], [300, 350], [130, 320], [100, 230], [330, 260], [430, 200], [410, 140], [200, 150], [120, 130]],
  comb: () => {
    const r = [[80, 340], [80, 60]];
    for (let i = 0; i < 5; i++) {
      const x = 140 + i * 90;
      r.push([x, 60], [x, 260], [x + 45, 260], [x + 45, 60]);
    }
    r.push([600, 60], [600, 340]);
    return r;
  },
  star: () => Array.from({ length: 14 }, (_, i) => {
    const t = (i / 14) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 70 : 175;
    return [320 + r * 1.35 * Math.cos(t), 205 + r * Math.sin(t)];
  }),
};

for (const root of document.querySelectorAll("[data-gis-pip]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const MPP = 10; // 6.4 × 4 km
  let ring = PIP_SHAPES.bay(), pt = [330, 300], drag = null;
  svg.setAttribute("tabindex", "0");
  svg.classList.add("outline-none", "focus-visible:ring-[3px]", "focus-visible:ring-ring/50", "rounded-lg");
  seg(root, "shape", (v) => {
    ring = PIP_SHAPES[v]();
    draw();
  });

  function draw() {
    clear(svg);
    const hits = crossings(ring, pt), isIn = hits.length % 2 === 1;
    const crossed = new Set(hits.map((h) => h.edge));
    el("polygon", { points: ring.map((p) => p.join(",")).join(" "), style: `fill:${isIn ? BRAND : "currentColor"};fill-opacity:${isIn ? 0.08 : 0.04};stroke:currentColor;stroke-opacity:0.55;stroke-width:1.5;stroke-linejoin:round` }, svg);
    ring.forEach((a, i) => {
      if (!crossed.has(i)) return;
      const b = ring[(i + 1) % ring.length];
      el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], style: `stroke:${BLUE};stroke-width:3;stroke-linecap:round` }, svg);
    });
    el("line", { x1: pt[0], y1: pt[1], x2: 640, y2: pt[1], style: `stroke:${BRAND};stroke-width:1.5;stroke-dasharray:5 4` }, svg);
    hits.sort((a, b) => a.x - b.x).forEach((h, k) => {
      el("circle", { cx: h.x, cy: pt[1], r: 5, style: `fill:var(--background);stroke:${BLUE};stroke-width:2` }, svg);
      text(svg, h.x, pt[1] - 9, String(k + 1), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    });
    ring.forEach((p, i) => {
      const c = el("circle", { cx: p[0], cy: p[1], r: 5, "data-v": i, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.7;stroke-width:1.5;cursor:grab" }, svg);
      c.addEventListener("pointerdown", (e) => start(e, i));
    });
    const P = el("circle", { cx: pt[0], cy: pt[1], r: 7, style: `fill:${BRAND};stroke:var(--background);stroke-width:2.5;cursor:grab` }, svg);
    P.addEventListener("pointerdown", (e) => start(e, -1));

    const A = signedArea(ring);
    o.cross.textContent = String(hits.length);
    o.verdict.textContent = isIn ? "inside (odd)" : "outside (even)";
    o.verdict.style.color = isIn ? BRAND : "";
    o.area.textContent = km2(Math.abs(A) * MPP * MPP);
    o.orient.textContent = A > 0 ? "counter-clockwise (+)" : "clockwise (−)";
    o.verts.textContent = String(ring.length);
  }

  function start(e, which) {
    e.preventDefault();
    e.stopPropagation();
    drag = which;
    svg.setPointerCapture(e.pointerId);
  }
  svg.addEventListener("pointerdown", (e) => {
    if (drag !== null) return;
    pt = svgPoint(svg, e);
    drag = -1;
    svg.setPointerCapture(e.pointerId);
    draw();
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    const [x, y] = svgPoint(svg, e), p = [Math.max(4, Math.min(636, x)), Math.max(4, Math.min(396, y))];
    if (drag < 0) pt = p;
    else ring[drag] = p;
    draw();
  });
  const stop = () => (drag = null);
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
    if (!d) return;
    e.preventDefault();
    pt = [Math.max(4, Math.min(636, pt[0] + d[0])), Math.max(4, Math.min(396, pt[1] + d[1]))];
    draw();
  });
  // Put the point exactly on the level of a vertex whose neighbours lie on
  // opposite sides of the ray, at a spot inside the ring: the ray passes
  // through the vertex and the half-open rule still counts it once.
  root.querySelector("[data-action=vertex]").addEventListener("click", () => {
    let pick = null;
    ring.forEach((v, i) => {
      if (pick) return;
      const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length];
      // Opposite sides, or one neighbour level with it (a horizontal edge).
      if ((a[1] - v[1]) * (b[1] - v[1]) > 0 || (a[1] === v[1] && b[1] === v[1])) return;
      for (let d = 20; d < 400 && !pick; d += 10) {
        const p = [v[0] - d, v[1]];
        if (p[0] > 4 && inside(ring, [p[0], p[1] - 0.01]) && inside(ring, [p[0], p[1] + 0.01])) pick = p;
      }
    });
    if (pick) pt = pick;
    draw();
  });
  draw();
}

// ============================================================ Simplification

// A closed island by midpoint displacement: subdivide each edge and push
// the midpoint sideways by a shrinking random amount.
function island(seed) {
  const rand = rng(seed);
  let ring = blob(seed + 3, 320, 180, 105, 10, 3, 0.12);
  let amp = 26;
  for (let level = 0; level < 6; level++) {
    const next = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, off = gauss(rand) * amp;
      next.push(a, [(a[0] + b[0]) / 2 - (dy / L) * off, (a[1] + b[1]) / 2 + (dx / L) * off]);
    }
    ring = next;
    amp *= 0.52;
  }
  return ring;
}

function douglasPeucker(pts, tol) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let dmax = -1, k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = segDist(pts[m], pts[i], pts[j]);
      if (d > dmax) { dmax = d; k = m; }
    }
    if (k > 0 && dmax > tol) {
      keep[k] = 1;
      stack.push([i, k], [k, j]);
    }
  }
  return keep;
}

// Visvalingam–Whyatt on a closed ring: repeatedly drop the vertex with the
// smallest effective area while it is below the threshold.
function visvalingam(ring, minArea) {
  const n = ring.length, alive = new Uint8Array(n).fill(1);
  const prev = Int32Array.from({ length: n }, (_, i) => (i - 1 + n) % n), next = Int32Array.from({ length: n }, (_, i) => (i + 1) % n);
  const tri = (i) => {
    const a = ring[prev[i]], b = ring[i], c = ring[next[i]];
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  };
  const area = Float64Array.from({ length: n }, (_, i) => tri(i));
  let left = n;
  while (left > 3) {
    let k = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (alive[i] && area[i] < best) { best = area[i]; k = i; }
    if (best >= minArea) break;
    alive[k] = 0;
    left--;
    const p = prev[k], q = next[k];
    next[p] = q;
    prev[q] = p;
    // Effective area never falls below the area just removed.
    area[p] = Math.max(tri(p), best);
    area[q] = Math.max(tri(q), best);
  }
  return alive;
}

for (const root of document.querySelectorAll("[data-gis-simplify]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const MPP = 10;
  let seed = 21, ring = island(seed);
  const method = seg(root, "method", draw);
  const s = scrubAll(root, draw);

  function simplify(tol) {
    if (method.get() === "vw") return visvalingam(ring, (tol * tol) / 2);
    // A closed ring: split at vertex 0 and the vertex farthest from it.
    let far = 0, dm = 0;
    ring.forEach((p, i) => {
      const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]);
      if (d > dm) { dm = d; far = i; }
    });
    const a = douglasPeucker(ring.slice(0, far + 1), tol);
    const b = douglasPeucker(ring.slice(far).concat([ring[0]]), tol);
    const keep = new Uint8Array(ring.length);
    a.forEach((k, i) => (keep[i] ||= k));
    b.forEach((k, i) => { if (i < b.length - 1) keep[far + i] ||= k; });
    return keep;
  }

  const perim = (r) => r.reduce((s2, p, i) => s2 + Math.hypot(r[(i + 1) % r.length][0] - p[0], r[(i + 1) % r.length][1] - p[1]), 0);

  function draw() {
    const tol = s.tol.get() / MPP;
    const keep = simplify(tol);
    const idx = [...keep.keys()].filter((i) => keep[i]);
    const simple = idx.map((i) => ring[i]);
    // Largest deviation: each dropped vertex against the kept edge spanning it.
    let dev = { d: 0 };
    idx.forEach((i, k) => {
      const j = idx[(k + 1) % idx.length];
      for (let m = (i + 1) % ring.length; m !== j; m = (m + 1) % ring.length) {
        const d = segDist(ring[m], ring[i], ring[j]);
        if (d > dev.d) dev = { d, p: ring[m], a: ring[i], b: ring[j] };
      }
    });

    clear(svg);
    el("rect", { x: 0, y: 0, width: 640, height: 360, style: `fill:${BLUE};fill-opacity:0.06` }, svg);
    el("polygon", { points: ring.map((p) => p.join(",")).join(" "), style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.7;stroke-width:1" }, svg);
    el("polygon", { points: simple.map((p) => p.join(",")).join(" "), style: `fill:none;stroke:${BRAND};stroke-width:2;stroke-opacity:0.9;stroke-linejoin:round` }, svg);
    if (simple.length < 200) for (const p of simple) el("circle", { cx: p[0], cy: p[1], r: 2.4, style: `fill:${BRAND}` }, svg);
    if (dev.p) {
      const L = dev.b[0] - dev.a[0], M = dev.b[1] - dev.a[1], len2 = L * L + M * M;
      const t = Math.max(0, Math.min(1, ((dev.p[0] - dev.a[0]) * L + (dev.p[1] - dev.a[1]) * M) / len2));
      el("line", { x1: dev.p[0], y1: dev.p[1], x2: dev.a[0] + t * L, y2: dev.a[1] + t * M, style: `stroke:${RED};stroke-width:2` }, svg);
      el("circle", { cx: dev.p[0], cy: dev.p[1], r: 3, style: `fill:${RED}` }, svg);
    }
    el("line", { x1: 20, x2: 120, y1: 340, y2: 340, style: "stroke:currentColor;stroke-width:2" }, svg);
    text(svg, 20, 334, "1 km");

    const A0 = Math.abs(signedArea(ring)), A1 = Math.abs(signedArea(simple));
    o.kept.textContent = `${simple.length} of ${ring.length} (${num((simple.length / ring.length) * 100, 0)}%)`;
    o.len.textContent = `${num((perim(simple) * MPP) / 1000, 2)} of ${num((perim(ring) * MPP) / 1000, 2)} km`;
    const dA = (A1 - A0) / A0;
    o.area.textContent = `${dA >= 0 ? "+" : "−"}${num(Math.abs(dA) * 100, 2)}%`;
    o.dev.textContent = `${num(dev.d * MPP, 1)} m`;
  }

  root.querySelector("[data-action=new]").addEventListener("click", () => {
    seed += 17;
    ring = island(seed);
    draw();
  });
  draw();
}

// ============================================================ Voronoi and Delaunay

const AREA_COLOURS = ["var(--vec-u)", "var(--brand)", "var(--vec-v)", "var(--vec-i)", "var(--vec-j)", "var(--vec-out)"];

for (const root of document.querySelectorAll("[data-gis-voronoi]")) {
  const svg = root.querySelector("[data-map]"), canvas = root.querySelector("[data-canvas]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const W = 640, H = 400, MPP = 10, GW = 320, GH = 200;
  canvas.width = GW;
  canvas.height = GH;
  canvas.style.imageRendering = "auto";
  const show = toggles(root, draw);
  let seed = 5, sites = [], drag = null;

  // Households: a dense centre plus scattered farms.
  const homes = [];
  {
    const r = rng(99);
    for (let i = 0; i < 2400; i++) {
      const c = i < 1500;
      const x = c ? 330 + gauss(r) * 95 : r() * W, y = c ? 200 + gauss(r) * 70 : r() * H;
      if (x > 0 && x < W && y > 0 && y < H) homes.push([x, y]);
    }
  }

  function scatter() {
    const r = rng(seed);
    sites = Array.from({ length: 9 }, () => [40 + r() * (W - 80), 40 + r() * (H - 80)]);
  }

  const nearest = (p) => {
    let k = 0, best = Infinity;
    sites.forEach((s, i) => {
      const d = (s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2;
      if (d < best) { best = d; k = i; }
    });
    return [k, Math.sqrt(best)];
  };

  function draw() {
    const tris = delaunay(sites);
    // Neighbours from the triangulation, then a greedy colouring so
    // adjacent service areas differ.
    const adj = sites.map(() => new Set());
    for (const t of tris) for (let k = 0; k < 3; k++) adj[t.v[k]].add(t.v[(k + 1) % 3]), adj[t.v[(k + 1) % 3]].add(t.v[k]);
    const colour = sites.map(() => -1);
    sites.forEach((_, i) => {
      const used = new Set([...adj[i]].map((j) => colour[j]));
      let c = 0;
      while (used.has(c)) c++;
      colour[i] = c % AREA_COLOURS.length;
    });

    ctx.clearRect(0, 0, GW, GH);
    if (show.fill && sites.length) {
      const bg = rgbOf(root, "var(--background)"), cols = AREA_COLOURS.map((c) => mix(bg, rgbOf(root, c), 0.16));
      const img = ctx.createImageData(GW, GH);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const [k] = nearest([(x + 0.5) * (W / GW), (y + 0.5) * (H / GH)]);
        const c = cols[colour[k]], q = (y * GW + x) * 4;
        img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    clear(svg);
    const hg = el("g", { style: "fill:currentColor;fill-opacity:0.28" }, svg);
    for (let i = 0; i < homes.length; i += 2) el("rect", { x: homes[i][0] - 0.6, y: homes[i][1] - 0.6, width: 1.2, height: 1.2 }, hg);

    // Voronoi edges join circumcentres of triangles sharing an edge; a hull
    // edge's bisector runs outward from its one circumcentre.
    const edgeTris = new Map();
    tris.forEach((t, ti) => {
      for (let k = 0; k < 3; k++) {
        const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? a + "_" + b : b + "_" + a;
        (edgeTris.get(key) ?? edgeTris.set(key, []).get(key)).push([ti, t.v[(k + 2) % 3]]);
      }
    });
    const vg = el("g", { style: "stroke:currentColor;stroke-opacity:0.75;stroke-width:1.5" }, svg);
    for (const [key, list] of edgeTris) {
      const [a, b] = key.split("_").map(Number);
      if (list.length === 2) {
        const c1 = tris[list[0][0]].c, c2 = tris[list[1][0]].c;
        el("line", { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y }, vg);
      } else {
        const c = tris[list[0][0]].c, third = sites[list[0][1]];
        const A = sites[a], B = sites[b];
        let nx = -(B[1] - A[1]), ny = B[0] - A[0];
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        if ((third[0] - mx) * nx + (third[1] - my) * ny > 0) { nx = -nx; ny = -ny; }
        const L = Math.hypot(nx, ny);
        el("line", { x1: c.x, y1: c.y, x2: c.x + (nx / L) * 2000, y2: c.y + (ny / L) * 2000 }, vg);
      }
    }
    if (sites.length === 2) {
      const [A, B] = sites, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, nx = -(B[1] - A[1]), ny = B[0] - A[0], L = Math.hypot(nx, ny);
      el("line", { x1: mx - (nx / L) * 2000, y1: my - (ny / L) * 2000, x2: mx + (nx / L) * 2000, y2: my + (ny / L) * 2000 }, vg);
    }
    if (show.delaunay) {
      const dg = el("g", { style: `stroke:${BLUE};stroke-width:1;stroke-opacity:0.8;fill:none` }, svg);
      for (const t of tris) el("polygon", { points: t.v.map((i) => sites[i].join(",")).join(" ") }, dg);
    }
    if (show.circles) {
      const cg = el("g", { style: `stroke:${BLUE};stroke-opacity:0.35;stroke-dasharray:3 3;fill:none` }, svg);
      for (const t of tris) el("circle", { cx: t.c.x, cy: t.c.y, r: Math.sqrt(t.c.r2) }, cg);
    }
    sites.forEach((p, i) => {
      const c = el("circle", { cx: p[0], cy: p[1], r: 6.5, tabindex: 0, role: "button", "aria-label": `Facility ${i + 1}; arrow keys move it`, style: `fill:${BRAND};stroke:var(--background);stroke-width:2.5;cursor:grab;outline:none` }, svg);
      c.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        drag = i;
        svg.setPointerCapture(e.pointerId);
      });
      c.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
        if (!d) return;
        e.preventDefault();
        sites[i] = [Math.max(6, Math.min(W - 6, p[0] + d[0])), Math.max(6, Math.min(H - 6, p[1] + d[1]))];
        draw();
        svg.querySelectorAll("circle[tabindex]")[i]?.focus();
      });
      c.addEventListener("focus", () => c.setAttribute("stroke-width", "3"));
    });

    // Empty-circumcircle check against every site.
    let empty = 0;
    for (const t of tris) if (sites.every((p, i) => t.v.includes(i) || (p[0] - t.c.x) ** 2 + (p[1] - t.c.y) ** 2 >= t.c.r2 - 1e-6)) empty++;
    const load = sites.map(() => 0);
    let sum = 0, max = 0;
    for (const hm of homes) {
      const [k, d] = nearest(hm);
      load[k]++;
      sum += d;
      max = Math.max(max, d);
    }
    o.n.textContent = String(sites.length);
    o.tris.textContent = String(tris.length);
    o.empty.textContent = tris.length ? `${empty} of ${tris.length}` : "—";
    o.mean.textContent = `${num((sum / homes.length) * MPP / 1000, 2)} km`;
    o.max.textContent = `${num((max * MPP) / 1000, 2)} km`;
    const busy = load.indexOf(Math.max(...load));
    o.busy.textContent = `#${busy + 1}: ${fmtInt(load[busy])} homes`;
  }

  svg.addEventListener("pointerdown", (e) => {
    if (drag !== null || sites.length >= 40) return;
    sites.push(svgPoint(svg, e));
    drag = sites.length - 1;
    svg.setPointerCapture(e.pointerId);
    draw();
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    const [x, y] = svgPoint(svg, e);
    sites[drag] = [Math.max(6, Math.min(W - 6, x)), Math.max(6, Math.min(H - 6, y))];
    draw();
  });
  const stop = () => (drag = null);
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);
  root.querySelector("[data-action=new]").addEventListener("click", () => {
    seed += 1;
    scatter();
    draw();
  });
  root.querySelector("[data-action=remove]").addEventListener("click", () => {
    if (sites.length > 1) sites.pop();
    draw();
  });
  onTheme(draw);
  scatter();
  draw();
}

// ============================================================ Interpolation

const RAIN_LO = 15, RAIN_HI = 80;

// The hidden truth: rain (mm) from two storm cells over a gentle trend.
function rainTruth(x, y) {
  const g = (cx, cy, sx, sy, a) => a * Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) / 2);
  return 18 + 0.03 * x + g(190, 150, 90, 70, 55) + g(470, 270, 70, 90, 40) - g(420, 90, 60, 40, 12);
}

for (const root of document.querySelectorAll("[data-gis-idw]")) {
  const svg = root.querySelector("[data-map]"), canvas = root.querySelector("[data-canvas]"), ramp = root.querySelector("[data-ramp]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const W = 640, H = 400, GW = 160, GH = 100;
  canvas.width = GW;
  canvas.height = GH;
  canvas.style.imageRendering = "auto";
  let seed = 3, gauges = [];
  const method = seg(root, "method", draw);
  const s = scrubAll(root, (name) => {
    if (name === "n") place();
    draw();
  });

  function place() {
    const r = rng(seed), n = Math.round(s.n.get());
    gauges = Array.from({ length: n }, () => {
      const x = 15 + r() * (W - 30), y = 15 + r() * (H - 30);
      return [x, y, rainTruth(x, y)];
    });
  }

  const idw = (pts, p, power) => {
    let num2 = 0, den = 0;
    for (const g of pts) {
      const d2 = (g[0] - p[0]) ** 2 + (g[1] - p[1]) ** 2;
      if (d2 < 1e-9) return g[2];
      const w = 1 / d2 ** (power / 2);
      num2 += w * g[2];
      den += w;
    }
    return num2 / den;
  };
  const nn = (pts, p) => {
    let best = Infinity, z = 0;
    for (const g of pts) {
      const d2 = (g[0] - p[0]) ** 2 + (g[1] - p[1]) ** 2;
      if (d2 < best) { best = d2; z = g[2]; }
    }
    return z;
  };
  const tinOf = (pts) => {
    const tris = delaunay(pts.map((g) => [g[0], g[1]]));
    return (p) => {
      for (const t of tris) {
        const [a, b, c] = t.v.map((i) => pts[i]), l = bary(a, b, c, p);
        if (l) return l[0] * a[2] + l[1] * b[2] + l[2] * c[2];
      }
      return null;
    };
  };

  function draw() {
    const power = s.p.get(), m = method.get();
    const tin = tinOf(gauges);
    const est = { idw: (p) => idw(gauges, p, power), nn: (p) => nn(gauges, p), tin, truth: (p) => rainTruth(p[0], p[1]) };

    // One colour scale for every method.
    const bg = rgbOf(root, "var(--background)"), hi = rgbOf(root, BLUE);
    const img = ctx.createImageData(GW, GH);
    const sq = { idw: 0, nn: 0, tin: 0 }, cnt = { idw: 0, nn: 0, tin: 0 };
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const p = [(x + 0.5) * (W / GW), (y + 0.5) * (H / GH)], truth = rainTruth(p[0], p[1]);
      for (const k of ["idw", "nn", "tin"]) {
        const v = est[k](p);
        if (v !== null) { sq[k] += (v - truth) ** 2; cnt[k]++; }
      }
      const v = est[m](p), q = (y * GW + x) * 4;
      if (v === null) continue;
      const c = mix(bg, hi, Math.max(0, Math.min(1, (v - RAIN_LO) / (RAIN_HI - RAIN_LO))) * 0.95);
      img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255;
    }
    ctx.clearRect(0, 0, GW, GH);
    ctx.putImageData(img, 0, 0);

    // Leave-one-out cross-validation.
    const cv = { idw: [0, 0], nn: [0, 0], tin: [0, 0] };
    gauges.forEach((g, i) => {
      const rest = gauges.filter((_, j) => j !== i);
      cv.idw[0] += (idw(rest, g, power) - g[2]) ** 2; cv.idw[1]++;
      cv.nn[0] += (nn(rest, g) - g[2]) ** 2; cv.nn[1]++;
      const t = tinOf(rest)(g);
      if (t !== null) { cv.tin[0] += (t - g[2]) ** 2; cv.tin[1]++; }
    });
    const best = Object.entries(cv).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1])[0][0];
    for (const k of ["idw", "nn", "tin"]) {
      o["cv-" + k].textContent = cv[k][1] ? num(Math.sqrt(cv[k][0] / cv[k][1]), 2) + (k === best ? " ★" : "") : "—";
      o["cv-" + k].style.color = k === best ? BRAND : "";
      o["true-" + k].textContent = num(Math.sqrt(sq[k] / cnt[k]), 2);
    }

    clear(svg);
    if (m === "tin") {
      const g2 = el("g", { style: "stroke:currentColor;stroke-opacity:0.18;fill:none" }, svg);
      for (const t of delaunay(gauges.map((g) => [g[0], g[1]]))) el("polygon", { points: t.v.map((i) => gauges[i][0] + "," + gauges[i][1]).join(" ") }, g2);
    }
    for (const g of gauges) {
      el("circle", { cx: g[0], cy: g[1], r: 3.5, style: `fill:var(--background);stroke:${BRAND};stroke-width:2` }, svg);
      if (gauges.length <= 40) text(svg, g[0] + 5, g[1] - 5, num(g[2], 0), { class: "fill-foreground font-mono text-[9px]" });
    }

    clear(ramp);
    ramp.append(`${RAIN_LO} mm`);
    const bar = document.createElement("span");
    bar.className = "h-2 w-40 rounded-full border";
    bar.style.background = `linear-gradient(to right, var(--background), color-mix(in oklab, ${BLUE} 95%, var(--background)))`;
    ramp.append(bar, `${RAIN_HI} mm`);
  }

  root.querySelector("[data-action=new]").addEventListener("click", () => {
    seed += 1;
    place();
    draw();
  });
  onTheme(draw);
  place();
  draw();
}

export {};
