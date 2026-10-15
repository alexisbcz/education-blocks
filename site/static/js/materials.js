// Materials science blocks. Every number comes from a stated model:
// stress–strain curves through typical handbook knots, hard-sphere crystal
// geometry, Bragg's law, the Fe–Fe₃C and Cu–Ni diagrams with the lever rule,
// the erf solution of Fick's second law, Hall–Petch, Ashby indices and
// Basquin S–N curves. Each block's root carries a data-mat-* attribute; the
// module does nothing on pages without them.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import "../anatomy/tensile.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const minus = (s) => String(s).replace(/-/g, "−");
const sci = (v, d = 2) => {
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / 10 ** e;
  return `${m.toFixed(d)} × 10${String(e).replace("-", "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c])}`;
};
const svgPoint = (svg, e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};

// Monotone cubic (Fritsch–Carlson): never overshoots between knots, so a
// curve's maximum sits exactly on the UTS knot.
function monotone(points) {
  const n = points.length, xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ============================================================ stress–strain

// Typical handbook values. E in MPa; knots (ε, σ MPa) start at the end of
// the linear elastic line; neck is where uniform elongation ends.
const MATERIALS = {
  steel: {
    name: "hot-rolled mild steel (AISI 1020 class)", E: 207000,
    knots: [[0.00145, 300], [0.0025, 280], [0.018, 282], [0.06, 360], [0.12, 405], [0.2, 420], [0.25, 395], [0.3, 330]],
    neck: 0.2, yieldPoint: { upper: 300, lower: 280 },
    note: "A sharp upper yield point, then a Lüders band runs along the bar at constant stress before work hardening starts.",
  },
  aluminium: {
    name: "aluminium alloy 6061-T6", E: 68900,
    knots: [[0.00348, 240], [0.0055, 270], [0.0065, 277], [0.012, 285], [0.03, 297], [0.08, 310], [0.12, 275]],
    neck: 0.08,
    note: "No yield point: the curve bends over smoothly, so yield is defined where it meets a line parallel to the elastic slope, offset by 0.2 % strain.",
  },
  copper: {
    name: "annealed copper (C11000)", E: 115000,
    knots: [[0.0003, 35], [0.0012, 55], [0.0026, 69], [0.01, 95], [0.05, 150], [0.15, 195], [0.3, 218], [0.35, 220], [0.45, 190], [0.48, 170]],
    neck: 0.35,
    note: "Soft and very ductile: a low yield strength, then strong work hardening over a long uniform elongation.",
  },
  polymer: {
    name: "polycarbonate", E: 2400,
    knots: [[0.0167, 40], [0.04, 58], [0.06, 62], [0.09, 52], [0.3, 52], [0.8, 55], [1.1, 65]],
    neck: 0.06, yieldPeak: { s: 62, eps: 0.06 },
    note: "A yield peak, then a neck that stays stable and travels along the bar (cold drawing) while the chains align; they stiffen again before the break.",
  },
  glass: {
    name: "soda-lime glass", E: 70000,
    knots: [[0.000714, 50]],
    neck: 0, brittle: true,
    note: "Linear to fracture, with no plastic strain at all. Tensile strength depends on surface flaws: ≈ 30–70 MPa is typical for ordinary glass.",
  },
};

function curveOf(mat) {
  const k = mat.knots;
  const spline = k.length > 1 ? monotone(k) : null;
  const end = k[k.length - 1][0];
  const sigma = (eps) => (eps <= k[0][0] ? mat.E * eps : eps > end ? NaN : spline(eps));
  return { sigma, end };
}

// Where the curve meets the 0.2 % offset line σ = E(ε − 0.002), by bisection.
function offsetYield(mat, sigma, end) {
  if (mat.brittle) return null;
  const f = (e) => sigma(e) - mat.E * (e - 0.002);
  let a = 0.002, b = Math.min(end, 0.05);
  if (f(b) > 0) return null;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    f(m) > 0 ? (a = m) : (b = m);
  }
  return { eps: a, s: sigma(a) };
}

for (const root of document.querySelectorAll("[data-mat-stress]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let key = "steel", showTrue = true, f = null, cur = null, xmaxNow = 1;
  root.addEventListener("seg-change", (e) => { key = e.detail.value; draw(); });
  onToggle(root, (k, on) => { showTrue = on; draw(); });

  function draw() {
    const mat = MATERIALS[key];
    const { sigma, end } = curveOf(mat);
    cur = { mat, sigma, end };
    const pts = [];
    const N = 600;
    for (let i = 0; i <= N; i++) {
      const e = (end * i) / N;
      pts.push([e, sigma(e)]);
    }
    // A fine pass through the elastic part, so the knee is sharp.
    const e0 = mat.knots[0][0];
    for (let i = 0; i <= 40; i++) pts.push([(e0 * i) / 40, sigma((e0 * i) / 40)]);
    pts.sort((a, b) => a[0] - b[0]);
    const smax = Math.max(...pts.map((p) => p[1]));
    const trueTop = showTrue && mat.neck ? sigma(mat.neck) * (1 + mat.neck) : 0;
    const ymax = Math.ceil(Math.max(smax, trueTop) * 1.12 / 50) * 50;
    const xmax = end * 1.08;
    xmaxNow = xmax;
    svg.replaceChildren();
    const pct = (v) => `${+(v * 100).toPrecision(3)}`;
    const step = xmax / 5;
    const nice = 10 ** Math.floor(Math.log10(step));
    const tick = [1, 2, 5, 10].map((m) => m * nice).find((s) => s >= step) ?? step;
    const xticks = [];
    for (let v = 0; v <= xmax + 1e-12; v += tick) xticks.push(v);
    f = frame(svg, { box: [52, 16, 572, 280], x: [0, xmax], y: [0, ymax], xticks, yticks: [0, ymax / 2, ymax], xfmt: pct, xlabel: "strain ε (%)", ylabel: "σ (MPa)" });

    // Toughness: the area under the whole curve, shaded.
    const area = `M${f.sx(0)} ${f.sy(0)}` + pts.map(([e, s]) => `L${f.sx(e).toFixed(1)} ${f.sy(s).toFixed(1)}`).join("") + `L${f.sx(end)} ${f.sy(0)}Z`;
    el("path", { d: area, style: "fill:var(--foreground);fill-opacity:0.05" }, svg);
    // 0.2 % offset construction, or the steel's yield point.
    const y = mat.yieldPoint ? { eps: 0.0025, s: mat.yieldPoint.lower } : mat.yieldPeak ? null : offsetYield(mat, sigma, end);
    if (y && !mat.yieldPoint) {
      el("line", { x1: f.sx(0.002), y1: f.sy(0), x2: f.sx(y.eps), y2: f.sy(y.s), style: "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:4 3" }, svg);
      el("circle", { cx: f.sx(y.eps), cy: f.sy(y.s), r: 3.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:1.5" }, svg);
    }
    if (showTrue && mat.neck) {
      const tp = pts.filter(([e]) => e <= mat.neck).map(([e, s]) => [Math.log(1 + e), s * (1 + e)]);
      polyline(svg, tp.map(([e, s]) => [f.sx(e), f.sy(s)]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 3");
    }
    polyline(svg, pts.map(([e, s]) => [f.sx(e), f.sy(s)]), "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round");
    // UTS and fracture marks.
    const utsPt = pts.reduce((b, p) => (p[1] > b[1] ? p : b));
    el("circle", { cx: f.sx(utsPt[0]), cy: f.sy(utsPt[1]), r: 3, style: "fill:var(--foreground)" }, svg);
    text(svg, f.sx(utsPt[0]), f.sy(utsPt[1]) - 8, "UTS", { "text-anchor": "middle" });
    const last = pts[pts.length - 1];
    el("path", { d: `M${f.sx(last[0]) - 4} ${f.sy(last[1]) - 4}l8 8M${f.sx(last[0]) + 4} ${f.sy(last[1]) - 4}l-8 8`, style: "stroke:var(--code-del);stroke-width:1.5" }, svg);
    if (mat.neck && !mat.brittle) {
      el("line", { x1: f.sx(mat.neck), x2: f.sx(mat.neck), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:2 3" }, svg);
      text(svg, f.sx(mat.neck) + 4, f.T + 10, "necking starts");
    }
    // Readouts: toughness by trapezoids (MPa × strain = MJ/m³).
    let tough = 0;
    for (let i = 1; i < pts.length; i++) tough += ((pts[i][1] + pts[i - 1][1]) / 2) * (pts[i][0] - pts[i - 1][0]);
    const yieldS = mat.yieldPeak ? mat.yieldPeak.s : mat.yieldPoint ? mat.yieldPoint.lower : y ? y.s : smax;
    o.e.textContent = `${num(mat.E / 1000, mat.E < 10000 ? 1 : 0)} GPa`;
    o.yield.textContent = mat.brittle ? "— (brittle)" : mat.yieldPeak ? `${mat.yieldPeak.s} MPa (yield peak, at ${pct(mat.yieldPeak.eps)} %)` : mat.yieldPoint ? `${mat.yieldPoint.upper} upper / ${mat.yieldPoint.lower} lower MPa` : `${num(y.s, 0)} MPa (0.2 % offset)`;
    o.uts.textContent = `${num(smax, 0)} MPa at ${pct(utsPt[0])} %${utsPt[0] >= end - 1e-9 && !mat.brittle ? " (at break)" : ""}`;
    o.elong.textContent = `${pct(end)} %`;
    o.tough.textContent = `${tough < 1 ? num(tough * 1000, 1) + " kJ/m³" : num(tough, 1) + " MJ/m³"}`;
    const resil = (yieldS * yieldS) / (2 * mat.E);
    o.resil.textContent = resil < 0.1 ? `${num(resil * 1000, 1)} kJ/m³` : `${num(resil, 2)} MJ/m³`;
    o.note.textContent = `${mat.name[0].toUpperCase()}${mat.name.slice(1)}. ${mat.note}`;
    o.hover.textContent = "Hover the curve to read it";
  }

  svg.addEventListener("pointermove", (e) => {
    if (!f || !cur) return;
    const p = svgPoint(svg, e);
    const eps = ((p.x - f.L) / f.W) * xmaxNow;
    if (eps < 0 || eps > cur.end) return;
    const s = cur.sigma(eps);
    o.hover.textContent = `ε = ${+(eps * 100).toPrecision(3)} %   σ = ${num(s, 0)} MPa${eps <= cur.mat.neck && cur.mat.neck ? `   true σ = ${num(s * (1 + eps), 0)} MPa` : ""}`;
  });
  draw();
}

// ============================================================ 3D helpers (orthographic, yaw and pitch)

function view3d(svg, onChange, start = { yaw: -0.6, pitch: 0.42 }) {
  const v = { ...start };
  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, ...v };
    svg.setPointerCapture(e.pointerId);
    svg.classList.replace("cursor-grab", "cursor-grabbing");
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    v.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    v.pitch = Math.max(-1.3, Math.min(1.3, drag.pitch + (e.clientY - drag.y) * 0.01));
    onChange();
  });
  const end = () => { drag = null; svg.classList.replace("cursor-grabbing", "cursor-grab"); };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (!d) return;
    e.preventDefault();
    v.yaw += d[0];
    v.pitch = Math.max(-1.3, Math.min(1.3, v.pitch + d[1]));
    onChange();
  });
  // Project a point: x right, y into the screen, z up.
  v.project = ([x, y, z]) => {
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
    return { x: x1, y: -(z * cp + y1 * sp), depth: -y1 * cp + z * sp };
  };
  return v;
}

// ============================================================ crystal structures

const ELEMENTS = {
  sc: { name: "Polonium (α-Po), the only element that is simple cubic", R: 0.168, A: 208.98 },
  bcc: { name: "Iron (α-Fe, ferrite)", R: 0.1241, A: 55.845 },
  fcc: { name: "Copper", R: 0.1278, A: 63.546 },
  hcp: { name: "Magnesium (c/a = 1.624)", R: 0.1604, A: 24.305, ca: 1.624 },
};
const NA = 6.02214076e23;

function crystal(kind) {
  // Unit cells in units of the lattice parameter a, centred on the origin.
  const cube = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) cube.push([x - 0.5, y - 0.5, z - 0.5, "corner"]);
  if (kind === "sc") return { atoms: cube, n: 1, cn: 6, r: 0.5, edges: cubeEdges() };
  if (kind === "bcc") return { atoms: [...cube, [0, 0, 0, "body"]], n: 2, cn: 8, r: Math.sqrt(3) / 4, edges: cubeEdges() };
  if (kind === "fcc") {
    const faces = [[0, 0, -0.5], [0, 0, 0.5], [0, -0.5, 0], [0, 0.5, 0], [-0.5, 0, 0], [0.5, 0, 0]].map((p) => [...p, "face"]);
    return { atoms: [...cube, ...faces], n: 4, cn: 12, r: Math.sqrt(2) / 4, edges: cubeEdges() };
  }
  // HCP: hexagonal prism, a = 1, ideal c = √(8/3) a; 12 corners, 2 face centres, 3 inside.
  const c = Math.sqrt(8 / 3), atoms = [], edges = [];
  const hex = Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);
  for (const z of [-c / 2, c / 2]) {
    hex.forEach(([x, y]) => atoms.push([x, y, z, "corner"]));
    atoms.push([0, 0, z, "face"]);
  }
  for (let i = 0; i < 3; i++) {
    const t = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    atoms.push([Math.cos(t) / Math.sqrt(3), Math.sin(t) / Math.sqrt(3), 0, "body"]);
  }
  for (let i = 0; i < 6; i++) {
    const [ax, ay] = hex[i], [bx, by] = hex[(i + 1) % 6];
    edges.push([[ax, ay, -c / 2], [bx, by, -c / 2]], [[ax, ay, c / 2], [bx, by, c / 2]], [[ax, ay, -c / 2], [ax, ay, c / 2]]);
  }
  return { atoms, n: 6, cn: 12, r: 0.5, edges, c };
}
function cubeEdges() {
  const e = [];
  for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) {
    e.push([[-0.5, a, b], [0.5, a, b]], [[a, -0.5, b], [a, 0.5, b]], [[a, b, -0.5], [a, b, 0.5]]);
  }
  return e;
}
const SITE_COLOR = { corner: "var(--vec-u)", body: "var(--brand)", face: "var(--ion-cl)" };

for (const root of document.querySelectorAll("[data-mat-crystal]")) {
  const svg = root.querySelector("[data-cell]");
  const o = outs(root);
  let kind = "sc", hard = false, raf = 0, spinning = !reduced(), visible = false;
  const s = scrubAll(root, () => readouts());
  const v = view3d(svg, () => { spinning = false; draw(); });
  const gid = `mat-atom-${Math.random().toString(36).slice(2)}`;
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; preset(); draw(); });
  onToggle(root, (k, on) => { hard = on; draw(); });

  function preset() {
    const el_ = ELEMENTS[kind];
    s.radius.set(el_.R, false);
    s.mass.set(el_.A, false);
    readouts();
  }

  function draw() {
    const cr = crystal(kind);
    // Hard spheres stick out of the cell by up to their radius: shrink to fit.
    const scale = kind === "hcp" ? (hard ? 0.72 : 1.05) : hard ? 1.02 : 1.55;
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    for (const [site, color] of Object.entries(SITE_COLOR)) {
      const g = el("radialGradient", { id: `${gid}-${site}`, cx: "35%", cy: "32%", r: "70%" }, defs);
      el("stop", { offset: "0", style: `stop-color:color-mix(in oklab, ${color} 35%, white)` }, g);
      el("stop", { offset: "1", style: `stop-color:${color}` }, g);
    }
    const P = (p) => v.project(p.map((c) => c * scale));
    // Edges behind the atoms' centre, then atoms by depth, then edges in front.
    const edges = cr.edges.map(([a, b]) => ({ a: P(a), b: P(b) }));
    const mid = (e) => (e.a.depth + e.b.depth) / 2;
    const line = (e, op) => el("line", { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, style: `stroke:currentColor;stroke-opacity:${op};stroke-width:0.012` }, svg);
    edges.filter((e) => mid(e) <= 0).forEach((e) => line(e, 0.3));
    const r = (hard ? cr.r : 0.11) * scale;
    cr.atoms.map((a) => ({ p: P(a), site: a[3] })).sort((a, b) => a.p.depth - b.p.depth).forEach(({ p, site }) => {
      el("circle", { cx: p.x, cy: p.y, r, style: `fill:url(#${gid}-${site});stroke:var(--background);stroke-width:0.012;fill-opacity:${hard ? 0.92 : 1}` }, svg);
    });
    edges.filter((e) => mid(e) > 0).forEach((e) => line(e, hard ? 0.55 : 0.4));
  }

  function readouts() {
    const cr = crystal(kind);
    const R = s.radius.get(), A = s.mass.get();
    // Lattice parameter from the touching condition, and the cell volume.
    let a, V, apf;
    if (kind === "sc") a = 2 * R;
    if (kind === "bcc") a = (4 * R) / Math.sqrt(3);
    if (kind === "fcc") a = 2 * Math.SQRT2 * R;
    if (kind === "hcp") {
      a = 2 * R;
      const c = (ELEMENTS.hcp.ca ?? Math.sqrt(8 / 3)) * a;
      V = ((3 * Math.sqrt(3)) / 2) * a * a * c;
      apf = (cr.n * (4 / 3) * Math.PI * (0.5) ** 3) / (((3 * Math.sqrt(3)) / 2) * Math.sqrt(8 / 3)); // ideal c/a
    } else {
      V = a ** 3;
      apf = (cr.n * (4 / 3) * Math.PI * cr.r ** 3);
    }
    const rho = (cr.n * A) / (V * 1e-21 * NA); // nm³ → cm³
    o.element.textContent = ELEMENTS[kind].name;
    o.n.textContent = String(cr.n);
    o.cn.textContent = String(cr.cn);
    o.a.textContent = kind === "hcp" ? `${num(a, 4)} nm, c = ${num((ELEMENTS.hcp.ca) * a, 4)} nm` : `${num(a, 4)} nm`;
    o.apf.textContent = `${num(apf, 3)}${kind === "hcp" ? " (ideal c/a)" : ""}`;
    o.rho.textContent = `${num(rho, 2)} g/cm³`;
  }

  const loop = (t) => {
    if (spinning) { v.yaw += 0.004; draw(); }
    raf = spinning && visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && spinning && !raf) raf = requestAnimationFrame(loop); }).observe(svg);
  svg.addEventListener("pointerdown", () => { spinning = false; });
  preset();
  draw();
}

// ============================================================ Miller indices and XRD

const LATTICES = { fcc: { a: 0.3615, name: "FCC copper" }, bcc: { a: 0.2866, name: "BCC iron" }, sc: { a: 0.3359, name: "simple cubic polonium" } };
const CU_KA = 0.15406; // nm
const bar = (n) => (n < 0 ? `${-n}̅` : String(n));
const allowed = (lat, h, k, l) => {
  if (!h && !k && !l) return false;
  if (lat === "fcc") return [h, k, l].every((n) => Math.abs(n) % 2 === 0) || [h, k, l].every((n) => Math.abs(n) % 2 === 1);
  if (lat === "bcc") return (h + k + l) % 2 === 0;
  return true;
};
const frac = (n) => (n === 0 ? "∞" : Math.abs(n) === 1 ? minus(String(1 / n)) : `${n < 0 ? "−" : ""}1/${Math.abs(n)}`);

for (const root of document.querySelectorAll("[data-mat-miller]")) {
  const svg = root.querySelector("[data-cell]");
  const xrd = root.querySelector("[data-xrd]");
  const steps = root.querySelector("[data-steps]");
  const o = outs(root);
  let lat = "fcc";
  const s = scrubAll(root, () => draw());
  const v = view3d(svg, () => draw(), { yaw: -0.9, pitch: 0.42 });
  root.addEventListener("seg-change", (e) => { lat = e.detail.value; draw(); });
  const idx = (k) => Math.round(s[k].get());

  function draw() {
    const [h, k, l] = ["h", "k", "l"].map(idx);
    const [u, vv, w] = ["u", "v", "w"].map(idx);
    const S = 1.25;
    const P = ([x, y, z]) => v.project([(x - 0.5) * S, (y - 0.5) * S, (z - 0.5) * S]);
    svg.replaceChildren();
    // The cube, with the axes from the origin corner.
    const corners = [];
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) corners.push([x, y, z]);
    const edges = [];
    for (const a of corners) for (const b of corners) {
      const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      if (d === 1 && a < b) edges.push([a, b]);
    }
    for (const [a, b] of edges) {
      const A = P(a), B = P(b);
      el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:0.012" }, svg);
    }
    // The plane: h(x−ox) + k(y−oy) + l(z−oz) = 1, the origin moved to the far corner along any negative axis.
    const O = [h < 0 ? 1 : 0, k < 0 ? 1 : 0, l < 0 ? 1 : 0];
    const n = [h, k, l];
    const pts = [];
    if (h || k || l) {
      for (const [a, b] of edges) {
        const fa = n[0] * (a[0] - O[0]) + n[1] * (a[1] - O[1]) + n[2] * (a[2] - O[2]) - 1;
        const fb = n[0] * (b[0] - O[0]) + n[1] * (b[1] - O[1]) + n[2] * (b[2] - O[2]) - 1;
        if (Math.abs(fa) < 1e-9) pts.push(a);
        else if (fa * fb < 0) {
          const t = fa / (fa - fb);
          pts.push(a.map((c, i) => c + (b[i] - c) * t));
        }
      }
    }
    const uniq = pts.filter((p, i) => pts.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-6) === i);
    if (uniq.length >= 3) {
      const c = uniq.reduce((s_, p) => s_.map((v_, i) => v_ + p[i] / uniq.length), [0, 0, 0]);
      // Order around the centroid in the plane: two axes perpendicular to n.
      const nn = Math.hypot(...n), nz = n.map((x) => x / nn);
      const ref = Math.abs(nz[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = [nz[1] * ref[2] - nz[2] * ref[1], nz[2] * ref[0] - nz[0] * ref[2], nz[0] * ref[1] - nz[1] * ref[0]];
      const e2 = [nz[1] * e1[2] - nz[2] * e1[1], nz[2] * e1[0] - nz[0] * e1[2], nz[0] * e1[1] - nz[1] * e1[0]];
      const ang = (p) => { const d = p.map((x, i) => x - c[i]); return Math.atan2(d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2], d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2]); };
      uniq.sort((a, b) => ang(a) - ang(b));
      const poly = uniq.map((p) => P(p));
      el("path", { d: "M" + poly.map((q) => `${q.x} ${q.y}`).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-width:0.018;stroke-linejoin:round" }, svg);
    }
    // The direction [uvw], drawn from its own origin corner.
    if (u || vv || w) {
      const m = Math.max(Math.abs(u), Math.abs(vv), Math.abs(w));
      const Od = [u < 0 ? 1 : 0, vv < 0 ? 1 : 0, w < 0 ? 1 : 0];
      const tip = [Od[0] + u / m, Od[1] + vv / m, Od[2] + w / m];
      const A = P(Od), B = P(tip);
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hd = 0.09;
      el("line", { x1: A.x, y1: A.y, x2: B.x - ux * hd, y2: B.y - uy * hd, style: "stroke:var(--vec-u);stroke-width:0.03;stroke-linecap:round" }, svg);
      el("path", { d: `M${B.x} ${B.y}L${B.x - ux * hd - uy * hd * 0.5} ${B.y - uy * hd + ux * hd * 0.5}L${B.x - ux * hd + uy * hd * 0.5} ${B.y - uy * hd - ux * hd * 0.5}Z`, style: "fill:var(--vec-u)" }, svg);
    }
    // Axis labels at the origin corner.
    const ax = [[[1.18, 0, 0], "x"], [[0, 1.18, 0], "y"], [[0, 0, 1.18], "z"]];
    const o0 = P([0, 0, 0]);
    el("circle", { cx: o0.x, cy: o0.y, r: 0.03, style: "fill:currentColor" }, svg);
    for (const [p, name] of ax) {
      const q = P(p);
      const t = el("text", { x: q.x, y: q.y, "font-size": 0.13, "text-anchor": "middle", "dominant-baseline": "middle", class: "fill-muted-foreground font-mono" }, svg);
      t.textContent = name;
    }

    // Steps of the intercept method.
    const name = `(${bar(h)}${bar(k)}${bar(l)})`;
    steps.replaceChildren();
    const li = (html, strong) => {
      const e = document.createElement("li");
      e.className = strong ? "text-foreground" : "text-muted-foreground";
      e.textContent = html;
      steps.append(e);
    };
    if (!h && !k && !l) li("(000) is not a plane: pick at least one non-zero index.", true);
    else {
      li(`1. Origin${O.some(Boolean) ? ` moved to (${O.join(", ")}) for the negative index` : " at a corner"}.`);
      li(`2. Intercepts on x, y, z: ${frac(h)}, ${frac(k)}, ${frac(l)} (in units of a).`);
      li(`3. Reciprocals: ${h}, ${k}, ${l}${[h, k, l].some((x) => x === 0) ? " (∞ gives 0: parallel to that axis)" : ""}.`.replace(/-/g, "−"));
      li(`4. Already integers: the plane is ${name}.`, true);
    }

    // d-spacing and Bragg angle.
    const a = LATTICES[lat].a;
    const hk = Math.sqrt(h * h + k * k + l * l);
    const ok = allowed(lat, h, k, l);
    o.a.textContent = `${a} nm (${LATTICES[lat].name})`;
    if (!hk) { o.d.textContent = "—"; o.theta.textContent = "—"; o.allowed.textContent = "—"; }
    else {
      const d = a / hk, sinT = CU_KA / (2 * d);
      o.d.textContent = `${num(d, 4)} nm`;
      o.theta.textContent = sinT <= 1 ? `${num((2 * Math.asin(sinT) * 180) / Math.PI, 2)}° (Cu Kα)` : "none: d < λ/2";
      o.allowed.textContent = ok ? "yes" : lat === "fcc" ? "no: FCC needs h, k, l all odd or all even" : "no: BCC needs h + k + l even";
      o.allowed.className = ok ? "tabular-nums text-add" : "tabular-nums text-del";
    }
    drawXRD(h, k, l, a);
  }

  // The powder pattern: every allowed family up to 2θ = 120°, heights = multiplicity (positions are exact; intensities are not modelled).
  function drawXRD(h, k, l, a) {
    xrd.replaceChildren();
    const f = frame(xrd, { box: [8, 10, 284, 112], x: [20, 120], y: [0, 50], xticks: [20, 40, 60, 80, 100, 120], yticks: [], xlabel: "2θ (°)" });
    const fams = new Map();
    for (let H = -4; H <= 4; H++) for (let K = -4; K <= 4; K++) for (let Lx = -4; Lx <= 4; Lx++) {
      if (!allowed(lat, H, K, Lx)) continue;
      const s2 = H * H + K * K + Lx * Lx;
      const sinT = CU_KA / (2 * (a / Math.sqrt(s2)));
      if (sinT > 1) continue;
      const tt = (2 * Math.asin(sinT) * 180) / Math.PI;
      if (tt > 120) continue;
      const key = [Math.abs(H), Math.abs(K), Math.abs(Lx)].sort((x, y) => y - x).join("");
      const e = fams.get(s2) ?? { tt, mult: 0, keys: new Set() };
      e.mult++;
      e.keys.add(key);
      fams.set(s2, e);
    }
    const mine = h * h + k * k + l * l;
    for (const [s2, e] of fams) {
      const hot = s2 === mine && allowed(lat, h, k, l);
      el("line", { x1: f.sx(e.tt), x2: f.sx(e.tt), y1: f.sy(0), y2: f.sy(e.mult), style: `stroke:${hot ? "var(--brand)" : "var(--foreground)"};stroke-width:${hot ? 2.5 : 1.25}` }, xrd);
      text(xrd, f.sx(e.tt), f.sy(e.mult) - 3, [...e.keys].join("/"), { "text-anchor": "middle", class: `font-mono text-[8px] ${hot ? "fill-foreground" : "fill-muted-foreground"}` });
    }
    text(xrd, 290, 20, "height: multiplicity", { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[8px]" });
  }
  draw();
}

// ============================================================ iron–carbon

const FE = {
  liq: [[0, 1538], [0.53, 1495], [4.3, 1147], [6.69, 1227]],
  deltaSol: [[0, 1538], [0.09, 1495]],
  deltaGamma: [[0.09, 1495], [0, 1394]],
  gammaDelta: [[0.17, 1495], [0, 1394]],
  gammaSol: [[0.17, 1495], [2.14, 1147]],
  a3: [[0, 912], [0.76, 727]],
  acm: [[0.76, 727], [2.14, 1147]],
  alphaHi: [[0, 912], [0.022, 727]],
  alphaLo: [[0.022, 727], [0.005, 400]],
};
const CEM = 6.69;
// x on segment at temperature T (segments are monotone in T).
const cAt = (seg, T) => {
  for (let i = 0; i < seg.length - 1; i++) {
    const [c0, t0] = seg[i], [c1, t1] = seg[i + 1];
    if ((T - t0) * (T - t1) <= 0 && t0 !== t1) return c0 + ((T - t0) / (t1 - t0)) * (c1 - c0);
  }
  return NaN;
};
// T on a polyline at composition c.
const tAt = (seg, c) => {
  for (let i = 0; i < seg.length - 1; i++) {
    const [c0, t0] = seg[i], [c1, t1] = seg[i + 1];
    if (c >= c0 && c <= c1) return t0 + ((c - c0) / (c1 - c0)) * (t1 - t0);
  }
  return NaN;
};

// Phases at (c, T): name and, for two-phase fields, the tie line [left, right] and their names.
function feC(c, T) {
  const Tl = tAt(FE.liq, c);
  if (T >= Tl) return { name: "L (liquid)" };
  if (c > 2.14) {
    if (T > 1147) return c < 4.3 ? { name: "L + γ", tie: [cAt(FE.gammaSol, T), cAt(FE.liq.slice(1, 3), T)], parts: ["γ", "L"] } : { name: "L + Fe₃C", tie: [cAt(FE.liq.slice(2), T), CEM], parts: ["L", "Fe₃C"] };
    if (T >= 727) return { name: "γ + Fe₃C", tie: [cAt(FE.acm, T), CEM], parts: ["γ", "Fe₃C"] };
    return { name: "α + Fe₃C", tie: [cAt(FE.alphaLo, T), CEM], parts: ["α", "Fe₃C"] };
  }
  if (T > 1495) return c <= cAt(FE.deltaSol, T) ? { name: "δ (δ-ferrite)" } : { name: "L + δ", tie: [cAt(FE.deltaSol, T), cAt(FE.liq.slice(0, 2), T)], parts: ["δ", "L"] };
  if (c >= 0.17 && T > tAt(FE.gammaSol, c)) return { name: "L + γ", tie: [cAt(FE.gammaSol, T), cAt(FE.liq.slice(1, 3), T)], parts: ["γ", "L"] };
  if (c < 0.17 && T > 1394) {
    const cd = cAt(FE.deltaGamma, T), cg = cAt(FE.gammaDelta, T);
    if (c <= cd) return { name: "δ (δ-ferrite)" };
    if (c <= cg) return { name: "δ + γ", tie: [cd, cg], parts: ["δ", "γ"] };
    return { name: "γ (austenite)" };
  }
  if (T >= 727) {
    if (c <= 0.76) {
      if (T >= tAt(FE.a3, c)) return { name: "γ (austenite)" };
      const ca = cAt(FE.alphaHi, T);
      return c <= ca ? { name: "α (ferrite)" } : { name: "α + γ", tie: [ca, cAt(FE.a3, T)], parts: ["α", "γ"] };
    }
    return T >= tAt(FE.acm, c) ? { name: "γ (austenite)" } : { name: "γ + Fe₃C", tie: [cAt(FE.acm, T), CEM], parts: ["γ", "Fe₃C"] };
  }
  const ca = cAt(FE.alphaLo, T);
  return c <= ca ? { name: "α (ferrite)" } : { name: "α + Fe₃C", tie: [ca, CEM], parts: ["α", "Fe₃C"] };
}

for (const root of document.querySelectorAll("[data-mat-fec]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let f;
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const [c, T] = b.dataset.preset.split(" ").map(Number);
    s.c.set(c, false);
    s.t.set(T, false);
    draw();
  }));
  svg.addEventListener("click", (e) => {
    if (!f) return;
    const p = svgPoint(svg, e);
    const c = ((p.x - f.L) / f.W) * 6.69, T = 1600 - ((p.y - f.T) / f.H) * 1200;
    if (c < 0 || c > 6.69 || T < 400 || T > 1600) return;
    s.c.set(Math.round(c * 100) / 100, false);
    s.t.set(Math.round(T), false);
    draw();
  });

  function draw() {
    const c = s.c.get(), T = s.t.get();
    svg.replaceChildren();
    f = frame(svg, { box: [50, 14, 570, 340], x: [0, 6.69], y: [400, 1600], xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [400, 600, 800, 1000, 1200, 1400, 1600], xlabel: "carbon (wt%)", ylabel: "T (°C)" });
    const line = (seg, style = "stroke:var(--foreground);stroke-width:1.4") => polyline(svg, seg.map(([x, y]) => [f.sx(x), f.sy(y)]), style);
    Object.values(FE).forEach((seg) => line(seg));
    line([[0.09, 1495], [0.53, 1495]]);
    line([[2.14, 1147], [CEM, 1147]]);
    line([[0.022, 727], [CEM, 727]]);
    line([[CEM, 400], [CEM, 1227]]);
    const lab = (x, y, t) => text(svg, f.sx(x), f.sy(y), t, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    lab(2.6, 1400, "L"); lab(1.0, 1250, "L + γ"); lab(5.95, 1163, "L + Fe₃C"); lab(0.9, 1000, "γ austenite");
    lab(4.0, 900, "γ + Fe₃C"); lab(3.5, 560, "α + Fe₃C (ferrite + cementite)"); lab(0.33, 800, "α+γ");
    text(svg, f.sx(0.76), f.sy(727) + 12, "0.76 % · 727 °C", { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
    text(svg, f.sx(4.3), f.sy(1147) + 12, "4.30 % · 1147 °C", { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
    // The point, and its tie line.
    const ph = feC(c, T);
    if (ph.tie && ph.tie.every(Number.isFinite)) {
      el("line", { x1: f.sx(ph.tie[0]), x2: f.sx(ph.tie[1]), y1: f.sy(T), y2: f.sy(T), style: "stroke:var(--brand);stroke-width:2" }, svg);
      for (const x of ph.tie) el("circle", { cx: f.sx(x), cy: f.sy(T), r: 3, style: "fill:var(--brand)" }, svg);
    }
    el("line", { x1: f.sx(c), x2: f.sx(c), y1: f.sy(T), y2: f.sy(400), style: "stroke:var(--brand);stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(c), cy: f.sy(T), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);

    const rows = [`<div class="text-sm font-medium font-sans">${ph.name}</div>`, `<div class="text-muted-foreground">${num(c, 2)} wt% C at ${num(T, 0)} °C</div>`];
    if (ph.tie && ph.tie.every(Number.isFinite)) {
      const [l, r] = ph.tie, wl = (r - c) / (r - l);
      rows.push(`<div>${ph.parts[0]}: ${num(l, 3)} % C, fraction ${num(wl * 100, 1)} %</div>`);
      rows.push(`<div>${ph.parts[1]}: ${num(r, 3)} % C, fraction ${num((1 - wl) * 100, 1)} %</div>`);
      rows.push(`<div class="text-muted-foreground">lever rule: W = (${num(r, 3)} − ${num(c, 2)}) / (${num(r, 3)} − ${num(l, 3)})</div>`.replace(/-/g, "−"));
    }
    // Microstructure of a slowly cooled steel just below the eutectoid.
    if (T < 727 && c > 0.022 && c <= 2.14) {
      if (c < 0.76) rows.push(`<div class="pt-1">Steel: proeutectoid ferrite ${num((0.76 - c) / (0.76 - 0.022) * 100, 1)} %, pearlite ${num((c - 0.022) / (0.76 - 0.022) * 100, 1)} %</div>`);
      else if (c > 0.76) rows.push(`<div class="pt-1">Steel: pearlite ${num((CEM - c) / (CEM - 0.76) * 100, 1)} %, proeutectoid cementite ${num((c - 0.76) / (CEM - 0.76) * 100, 1)} %</div>`);
      else rows.push(`<div class="pt-1">Steel: 100 % pearlite (eutectoid)</div>`);
    }
    o.phases.innerHTML = rows.join("");
  }
  draw();
}

// ============================================================ Cu–Ni lens and lever rule

// x is the nickel weight fraction. Smooth curves through the real melting
// points (Cu 1085 °C, Ni 1455 °C), fitted to the textbook diagram.
const TL = (x) => 1085 + 370 * (1 - (1 - x) ** 1.6);
const TS = (x) => 1085 + 370 * x ** 0.95;
const invert = (fn, T) => {
  let a = 0, b = 1;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; fn(m) < T ? (a = m) : (b = m); }
  return (a + b) / 2;
};

for (const root of document.querySelectorAll("[data-mat-lens]")) {
  const svg = root.querySelector("[data-plot]");
  const cool = root.querySelector("[data-cool]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let f;
  svg.addEventListener("click", (e) => {
    if (!f) return;
    const p = svgPoint(svg, e);
    const x = ((p.x - f.L) / f.W) * 100, T = 1500 - ((p.y - f.T) / f.H) * 500;
    if (x < 0 || x > 100 || T < 1000 || T > 1500) return;
    s.x.set(Math.round(x * 2) / 2, false);
    s.t.set(Math.round(T), false);
    draw();
  });

  function draw() {
    const x = s.x.get() / 100, T = s.t.get();
    svg.replaceChildren();
    f = frame(svg, { box: [46, 22, 340, 244], x: [0, 100], y: [1000, 1500], xticks: [0, 20, 40, 60, 80, 100], yticks: [1000, 1100, 1200, 1300, 1400, 1500], xlabel: "Ni (wt%)", ylabel: "T (°C)" });
    const curve = (fn) => Array.from({ length: 101 }, (_, i) => [f.sx(i), f.sy(fn(i / 100))]);
    el("path", { d: "M" + curve(TL).map((p) => p.join(" ")).join("L") + "L" + curve(TS).reverse().map((p) => p.join(" ")).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.06" }, svg);
    polyline(svg, curve(TL), "stroke:var(--foreground);stroke-width:1.5");
    polyline(svg, curve(TS), "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:5 3");
    const lab = (xx, y, t) => text(svg, f.sx(xx), f.sy(y), t, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    lab(25, 1420, "L (liquid)"); lab(72, 1120, "α (solid solution)"); lab(48, 1300, "α + L");
    text(svg, f.sx(80), f.sy(TL(0.8)) - 6, "liquidus", { "text-anchor": "middle" });
    text(svg, f.sx(30), f.sy(TS(0.3)) + 14, "solidus", { "text-anchor": "middle" });

    let phases, cl = null, cs = null;
    if (T >= TL(x)) phases = "liquid";
    else if (T <= TS(x)) phases = "solid α";
    else {
      phases = "liquid + α";
      cl = invert(TL, T);
      cs = invert(TS, T);
      el("line", { x1: f.sx(cl * 100), x2: f.sx(cs * 100), y1: f.sy(T), y2: f.sy(T), style: "stroke:var(--brand);stroke-width:2" }, svg);
      for (const v of [cl, cs]) el("circle", { cx: f.sx(v * 100), cy: f.sy(T), r: 3, style: "fill:var(--brand)" }, svg);
    }
    el("circle", { cx: f.sx(x * 100), cy: f.sy(T), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    o.phases.textContent = phases;
    o.cl.textContent = cl === null ? "—" : `${num(cl * 100, 1)} wt% Ni`;
    o.cs.textContent = cs === null ? "—" : `${num(cs * 100, 1)} wt% Ni`;
    if (cl === null) {
      o.wl.textContent = phases === "liquid" ? "100 %" : "0 %";
      o.ws.textContent = phases === "liquid" ? "0 %" : "100 %";
    } else {
      const wl = (cs - x) / (cs - cl);
      o.wl.textContent = `${num(wl * 100, 1)} %`;
      o.ws.textContent = `${num((1 - wl) * 100, 1)} %`;
    }

    // Schematic cooling curve: fast above the liquidus and below the
    // solidus, slow in between while latent heat is released.
    cool.replaceChildren();
    const tl = TL(x), ts = TS(x);
    const g = frame(cool, { box: [46, 22, 200, 244], x: [0, 10], y: [1000, 1500], xticks: [], yticks: [1000, 1250, 1500], xlabel: "time →", ylabel: "T (°C)" });
    const t1 = (1500 - tl) / 120, t2 = t1 + (tl - ts) / 25;
    const path = [];
    for (let t = 0; t <= 10; t += 0.05) {
      const temp = t < t1 ? 1500 - 120 * t : t < t2 ? tl - 25 * (t - t1) : ts - 120 * (t - t2);
      if (temp < 1000) break;
      path.push([g.sx(t), g.sy(temp)]);
    }
    polyline(cool, path, "stroke:var(--foreground);stroke-width:1.5");
    hline(cool, g, tl, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3", `liquidus ${num(tl, 0)} °C`);
    hline(cool, g, ts, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3", `solidus ${num(ts, 0)} °C`);
    if (T < 1500 && T > 1000) el("line", { x1: g.L, x2: g.L + g.W, y1: g.sy(T), y2: g.sy(T), style: "stroke:var(--brand);stroke-opacity:0.6" }, cool);
  }
  draw();
}

// ============================================================ diffusion

// erf by Abramowitz & Stegun 7.1.26 (|error| < 1.5 × 10⁻⁷), and its inverse by bisection.
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const erfinv = (y) => { let a = 0, b = 6; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; erf(m) < y ? (a = m) : (b = m); } return (a + b) / 2; };
const D0 = 2.3e-5, Q = 148000, R = 8.314462618;

for (const root of document.querySelectorAll("[data-mat-diff]")) {
  const svg = root.querySelector("[data-plot]");
  const arr = root.querySelector("[data-arr]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const Tk = s.temp.get() + 273.15, hours = s.hours.get(), cs = s.cs.get(), c0 = s.c0.get();
    const D = D0 * Math.exp(-Q / (R * Tk));
    const profile = (t) => (x) => c0 + (cs - c0) * (1 - erf(x / (2 * Math.sqrt(D * t))));
    svg.replaceChildren();
    const f = frame(svg, { box: [46, 22, 340, 244], x: [0, 3], y: [0, 1.5], xticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], yticks: [0, 0.5, 1, 1.5], xlabel: "depth (mm)", ylabel: "C (wt%)" });
    hline(svg, f, 0.4, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3", "0.4 % C");
    for (const [frac_, op] of [[0.25, 0.3], [0.5, 0.5]]) {
      const p = profile(hours * 3600 * frac_);
      polyline(svg, Array.from({ length: 151 }, (_, i) => { const x = (i / 150) * 3e-3; return [f.sx(x * 1000), f.sy(p(x))]; }), `stroke:var(--foreground);stroke-opacity:${op};stroke-width:1.25`);
    }
    const p = profile(hours * 3600);
    polyline(svg, Array.from({ length: 151 }, (_, i) => { const x = (i / 150) * 3e-3; return [f.sx(x * 1000), f.sy(p(x))]; }), "stroke:var(--brand);stroke-width:2");
    // Case depth: where C = 0.4 %, if the surface is above it.
    const ratio = (0.4 - c0) / (cs - c0);
    let depth = NaN;
    if (ratio > 0 && ratio < 1) depth = 2 * Math.sqrt(D * hours * 3600) * erfinv(1 - ratio);
    if (Number.isFinite(depth) && depth * 1000 < 3) {
      el("line", { x1: f.sx(depth * 1000), x2: f.sx(depth * 1000), y1: f.sy(0.4), y2: f.sy(0), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
      el("circle", { cx: f.sx(depth * 1000), cy: f.sy(0.4), r: 3.5, style: "fill:var(--brand)" }, svg);
    }
    text(svg, f.L + f.W, f.T + 10, `${hours / 4} h, ${hours / 2} h (faint) · ${hours} h`, { "text-anchor": "end" });

    // Arrhenius: log10 D against 1000/T.
    arr.replaceChildren();
    const xs = [1000 / (1100 + 273.15), 1000 / (800 + 273.15)];
    const g = frame(arr, { box: [46, 22, 200, 244], x: xs, y: [-12, -10], xticks: [0.75, 0.8, 0.85, 0.9], yticks: [-12, -11, -10], xlabel: "1000 / T (K⁻¹)", ylabel: "log₁₀ D", yfmt: (v) => minus(v) });
    polyline(arr, Array.from({ length: 41 }, (_, i) => { const iv = xs[0] + ((xs[1] - xs[0]) * i) / 40; return [g.sx(iv), g.sy(Math.log10(D0) - (Q / (R * 1000 / iv)) / Math.LN10)]; }), "stroke:var(--foreground);stroke-width:1.5");
    el("circle", { cx: g.sx(1000 / Tk), cy: g.sy(Math.log10(D)), r: 4, style: "fill:var(--brand)" }, arr);
    text(arr, g.L + g.W, g.T + g.H - 8, "slope = −Q / (2.303 R)", { "text-anchor": "end" });

    o.d.textContent = `${sci(D)} m²/s`;
    o.sqrt.textContent = `${num(Math.sqrt(D * hours * 3600) * 1000, 3)} mm`;
    o.case.textContent = Number.isFinite(depth) ? `${num(depth * 1000, 2)} mm` : "— (surface below 0.4 %)";
  }
  draw();
}

// ============================================================ dislocations

for (const root of document.querySelectorAll("[data-mat-disl]")) {
  const svg = root.querySelector("[data-lattice]");
  const o = outs(root);
  const N = 14, b = 24, X0 = 32, Y0 = 115, W = 0.75 * b;
  const START = -3 * b, END = (N + 2) * b;
  let p = START, timer = 0, burgers = true;
  onToggle(root, (k, on) => { burgers = on; draw(); });

  // Top atoms are displaced by u(x) = b·(½ − atan((x − p)/w)/π): left of the
  // core the top has slipped by b, right of it not yet. The core broadens
  // away from the slip plane.
  const u = (x, row) => b * (0.5 - Math.atan((x - p) / (W * (1 + 0.6 * row))) / Math.PI);

  function draw() {
    svg.replaceChildren();
    const top = (i, row) => { const x = i * b; return [X0 + x + u(x, row), Y0 - (row + 0.5) * b]; };
    const bot = (i, row) => [X0 + i * b, Y0 + (row + 0.5) * b];
    const bonds = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < N; i++) {
      if (i < N - 1) bonds.push([top(i, row), top(i + 1, row)]);
      if (row < 2) bonds.push([top(i, row), top(i, row + 1)]);
      const [bx, by] = bot(i, row);
      if (i < N - 1) bonds.push([[bx, by], bot(i + 1, row)]);
      if (row < 2) bonds.push([[bx, by], bot(i, row + 1)]);
    }
    // Bonds across the slip plane: each top atom to the bottom atom nearest below it.
    for (let i = 0; i < N; i++) {
      const [tx, ty] = top(i, 0);
      const j = Math.round((tx - X0) / b);
      if (j >= 0 && j < N && Math.abs(tx - (X0 + j * b)) < b * 0.3) bonds.push([[tx, ty], bot(j, 0)]);
    }
    el("path", { d: bonds.map(([a, c]) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(""), style: "stroke:currentColor;stroke-opacity:0.25;stroke-width:1.2" }, svg);
    // Slip plane.
    el("line", { x1: X0 - b, x2: X0 + N * b, y1: Y0, y2: Y0, style: "stroke:var(--vec-u);stroke-opacity:0.6;stroke-dasharray:4 4" }, svg);
    for (let row = 0; row < 3; row++) for (let i = 0; i < N; i++) {
      const [tx, ty] = top(i, row), [bx, by] = bot(i, row);
      el("circle", { cx: tx, cy: ty, r: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.3" }, svg);
      el("circle", { cx: bx, cy: by, r: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.3" }, svg);
    }
    // The dislocation symbol ⊥ at the core.
    const cx = X0 + p - b / 2;
    if (p > -b && p < N * b) {
      el("path", { d: `M${cx - 9} ${Y0 + 1}h18M${cx} ${Y0 + 1}v-16`, style: "stroke:var(--brand);stroke-width:2.5;stroke-linecap:round" }, svg);
    }
    // Burgers circuit: 4 atoms right along a bottom row, up 3 rows, 4 atoms
    // left along a top row, down 3 rows. Around the core it misses its start
    // by one spacing: the Burgers vector b.
    if (burgers && p > 2 * b && p < (N - 3) * b) {
      const i0 = Math.round(p / b) - 3;
      const path = [];
      for (let i = i0; i <= i0 + 4; i++) path.push(bot(i, 1));
      path.push(bot(i0 + 4, 0), top(i0 + 4, 0), top(i0 + 4, 1));
      for (let i = i0 + 3; i >= i0; i--) path.push(top(i, 1));
      path.push(top(i0, 0));
      const j = Math.round((top(i0, 0)[0] - X0) / b);
      path.push(bot(j, 0), bot(j, 1));
      el("path", { d: "M" + path.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join("L"), style: "fill:none;stroke:var(--vec-out);stroke-width:2;stroke-linejoin:round" }, svg);
      const end = bot(j, 1), start = bot(i0, 1);
      if (j !== i0) {
        el("line", { x1: end[0], y1: end[1] + 12, x2: start[0] + 6, y2: start[1] + 12, style: "stroke:var(--brand);stroke-width:2" }, svg);
        el("path", { d: `M${start[0]} ${start[1] + 12}l7 -4v8z`, style: "fill:var(--brand)" }, svg);
        text(svg, (end[0] + start[0]) / 2, start[1] + 26, "b", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      }
    }
    const done = p >= N * b;
    o.pos.textContent = p < 0 ? "outside, about to enter" : done ? "left the crystal" : `between columns ${Math.floor(p / b)} and ${Math.floor(p / b) + 1}`;
    o.slip.textContent = done ? "top half moved by b: a slip step at the right" : p < 0 ? "none yet" : "left of the core: b, right of it: 0";
  }
  const step = () => { p = Math.min(END, p + b); draw(); return p < END; };
  root.querySelector("[data-action=step]").addEventListener("click", () => { clearInterval(timer); step(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { clearInterval(timer); p = START; draw(); });
  root.querySelector("[data-action=run]").addEventListener("click", () => {
    clearInterval(timer);
    if (p >= END) p = START;
    if (reduced()) { p = END; draw(); return; }
    // Glide is an explanation: a smooth sweep, one spacing every 320 ms.
    let last = performance.now();
    const target = END;
    timer = setInterval(() => {
      const now = performance.now();
      p = Math.min(target, p + ((now - last) / 320) * b);
      last = now;
      draw();
      if (p >= target) clearInterval(timer);
    }, 30);
  });
  draw();
}

for (const root of document.querySelectorAll("[data-mat-hp]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const S0 = 70, K = 0.74 * Math.sqrt(1000); // MPa·mm^½
  function draw() {
    const d = s.d.get() / 1000; // mm
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 22, 570, 160], x: [0, 32], y: [0, 850], xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 400, 800], xlabel: "d^−½ (mm^−½)", ylabel: "σy (MPa)" });
    polyline(svg, [[f.sx(0), f.sy(S0)], [f.sx(32), f.sy(S0 + K * 32)]], "stroke:var(--foreground);stroke-width:1.5");
    const x = 1 / Math.sqrt(d), sy = S0 + K * x;
    el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.sy(sy), y2: f.sy(0), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(x), cy: f.sy(sy), r: 4, style: "fill:var(--brand)" }, svg);
    text(svg, f.sx(1), f.sy(S0) - 6, "σ₀ ≈ 70 MPa");
    o.sy.textContent = `${num(sy, 0)} MPa`;
    o.dinv.textContent = `${num(x, 2)} mm^−½`;
  }
  draw();
}

// ============================================================ Ashby chart

// label: [ρ, E] where the family's name goes (inside its own field).
const FAMILIES = [
  { name: "Foams", rho: [0.02, 0.5], E: [0.001, 1], label: [0.1, 0.4] },
  { name: "Elastomers", rho: [0.9, 1.5], E: [0.0005, 0.1], label: [1.17, 0.0012] },
  { name: "Polymers", rho: [0.9, 2.2], E: [0.2, 5], label: [1.4, 0.3] },
  { name: "Woods", rho: [0.15, 1.1], E: [0.5, 25], label: [0.4, 1.2] },
  { name: "Composites", rho: [1.4, 2.2], E: [15, 250], label: [1.75, 190] },
  { name: "Glasses", rho: [2.2, 2.8], E: [50, 90], label: null },
  { name: "Metals", rho: [1.7, 20], E: [40, 420], label: [11, 55] },
  { name: "Ceramics", rho: [2.3, 16], E: [150, 1000], label: [9, 750] },
];
// name, ρ, E, label side: [dx, dy, anchor].
const GRADES = [
  ["Steel", 7.85, 210, [6, 3, "start"]], ["Aluminium alloy", 2.7, 70, [6, 4, "start"]], ["Titanium alloy", 4.43, 114, [6, 3, "start"]],
  ["Magnesium alloy", 1.8, 45, [-6, 10, "end"]], ["CFRP (quasi-isotropic)", 1.6, 60, [-6, 0, "end"]], ["GFRP", 1.9, 20, [-6, 4, "end"]],
  ["Spruce (along grain)", 0.45, 11, [6, 3, "start"]], ["Balsa (along grain)", 0.15, 3, [6, 3, "start"]],
  ["Alumina", 3.9, 370, [6, 6, "start"]], ["Silicon carbide", 3.2, 410, [-6, -4, "end"]], ["Soda-lime glass", 2.5, 70, [-6, -8, "end"]],
  ["Concrete", 2.4, 30, [6, 9, "start"]], ["Epoxy", 1.2, 3, [6, 3, "start"]], ["HDPE", 0.95, 1, [6, 3, "start"]],
  ["Natural rubber", 0.93, 0.002, [6, 3, "start"]], ["Rigid PU foam", 0.05, 0.01, [6, 3, "start"]],
];
const LOGX = [-2, 1.5], LOGY = [-3.5, 3];

for (const root of document.querySelectorAll("[data-mat-ashby]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const seg = { tie: 1, beam: 2, plate: 3 };
  let n = 1;
  const s = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => { n = seg[e.detail.value]; draw(); });

  function draw() {
    const logM = s.m.get();
    svg.replaceChildren();
    const decade = (v) => (v >= 0 ? (v === 0 ? "1" : `10${"⁰¹²³"[v]}`) : `10⁻${"⁰¹²³"[-v]}`);
    const f = frame(svg, { box: [54, 12, 566, 370], x: LOGX, y: LOGY, xticks: [-2, -1, 0, 1], yticks: [-3, -2, -1, 0, 1, 2, 3], xfmt: decade, yfmt: decade, xlabel: "density ρ (Mg/m³)", ylabel: "E (GPa)" });
    const clip = `mat-ashby-clip-${Math.random().toString(36).slice(2)}`;
    el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id: clip }, el("defs", {}, svg)));
    const g = el("g", { "clip-path": `url(#${clip})` }, svg);
    const colors = ["var(--vec-u)", "var(--vec-v)", "var(--ion-k)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-ca)", "var(--ion-na)", "var(--brand)"];
    FAMILIES.forEach((fam, i) => {
      const [x0, x1] = fam.rho.map(Math.log10), [y0, y1] = fam.E.map(Math.log10);
      const cx = f.sx((x0 + x1) / 2), cy = f.sy((y0 + y1) / 2), rx = (f.sx(x1) - f.sx(x0)) / 2, ry = (f.sy(y0) - f.sy(y1)) / 2;
      el("ellipse", { cx, cy, rx, ry, style: `fill:${colors[i]};fill-opacity:0.12;stroke:${colors[i]};stroke-opacity:0.7;stroke-width:1.2` }, g);
      if (fam.label) text(g, f.sx(Math.log10(fam.label[0])), f.sy(Math.log10(fam.label[1])), fam.name, { "text-anchor": "middle", class: "font-mono text-[10px]", style: `fill:${colors[i]}` });
    });
    // The index line log E = n log ρ + n log M, and the region above it.
    const yAt = (x) => n * x + n * logM;
    const pts = [[LOGX[0], yAt(LOGX[0])], [LOGX[1], yAt(LOGX[1])]];
    el("path", { d: `M${f.sx(pts[0][0])} ${f.sy(pts[0][1])}L${f.sx(pts[1][0])} ${f.sy(pts[1][1])}L${f.sx(LOGX[1])} ${f.sy(LOGY[1] + 5)}L${f.sx(LOGX[0])} ${f.sy(LOGY[1] + 5)}Z`, style: "fill:var(--brand);fill-opacity:0.05" }, g);
    el("line", { x1: f.sx(pts[0][0]), y1: f.sy(pts[0][1]), x2: f.sx(pts[1][0]), y2: f.sy(pts[1][1]), style: "stroke:var(--brand);stroke-width:2;stroke-dasharray:6 4" }, g);
    const Mof = ([, rho, E]) => E ** (1 / n) / rho;
    const ranked = GRADES.map((gr) => ({ gr, M: Mof(gr) })).sort((a, b) => b.M - a.M);
    for (const { gr, M } of ranked) {
      const above = Math.log10(M) >= logM;
      const x = f.sx(Math.log10(gr[1])), y = f.sy(Math.log10(gr[2]));
      el("circle", { cx: x, cy: y, r: above ? 4 : 3, style: above ? "fill:var(--brand)" : "fill:var(--background);stroke:var(--foreground);stroke-width:1.2" }, g);
      const [dx, dy, anchor] = gr[3];
      text(g, x + dx, y + dy, gr[0], { "text-anchor": anchor, class: `font-mono text-[9px] ${above ? "fill-foreground" : "fill-muted-foreground"}` });
    }
    const idx = n === 1 ? "E/ρ" : n === 2 ? "E^½/ρ" : "E^⅓/ρ";
    const best = ranked.filter(({ M }) => Math.log10(M) >= logM);
    o.rank.innerHTML = (best.length ? best : ranked.slice(0, 1)).slice(0, 6).map(({ gr, M }, i) =>
      `<li class="flex justify-between gap-2"><span>${i + 1}. ${gr[0]}</span><span class="text-muted-foreground tabular-nums">${idx} = ${num(M, 2)}</span></li>`).join("") +
      (best.length ? "" : `<li class="text-muted-foreground">Nothing above the line: lower it.</li>`);
  }
  draw();
}

// ============================================================ S–N curves

// Basquin fits through two typical points each: steel 540 MPa at 10³ to its
// endurance limit 300 MPa at 10⁶ cycles, flat after; aluminium 430 MPa at
// 10³ to 140 MPa at 5 × 10⁸, still falling.
const STEEL_B = Math.log10(300 / 540) / 3;
const AL_B = Math.log10(140 / 430) / Math.log10(5e5);
const steelS = (N) => (N >= 1e6 ? 300 : 540 * (N / 1e3) ** STEEL_B);
const alS = (N) => 430 * (N / 1e3) ** AL_B;

for (const root of document.querySelectorAll("[data-mat-fatigue]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const life = (sa, S0, B) => 1e3 * (sa / S0) ** (1 / B);
  const fmtN = (N) => (N < 1e3 ? "< 10³ (low-cycle, not modelled)" : `≈ ${sci(N, 1)} cycles`);
  function draw() {
    const sa = s.s.get();
    svg.replaceChildren();
    const exp = (v) => `10${"⁰¹²³⁴⁵⁶⁷⁸⁹"[v]}`;
    const f = frame(svg, { box: [52, 12, 570, 270], x: [3, 9], y: [0, 600], xticks: [3, 4, 5, 6, 7, 8, 9], yticks: [0, 200, 400, 600], xfmt: exp, xlabel: "cycles to failure N", ylabel: "σa (MPa)" });
    const curve = (fn) => Array.from({ length: 121 }, (_, i) => { const lg = 3 + (6 * i) / 120; return [f.sx(lg), f.sy(fn(10 ** lg))]; });
    polyline(svg, curve(steelS), "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, curve(alS), "stroke:var(--brand);stroke-width:2");
    text(svg, f.sx(8.9), f.sy(300) + 14, "steel: endurance limit ≈ 300 MPa", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    text(svg, f.sx(8.9), f.sy(alS(8e8)) - 8, "aluminium: no limit", { "text-anchor": "end", style: "fill:var(--brand)" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(sa), y2: f.sy(sa), style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:4 3" }, svg);
    const ns = sa <= 300 ? Infinity : life(sa, 540, STEEL_B);
    const na = life(sa, 430, AL_B);
    for (const [N, color] of [[ns, "var(--vec-u)"], [na, "var(--brand)"]]) {
      if (!Number.isFinite(N) || N < 1e3 || N > 1e9) continue;
      el("circle", { cx: f.sx(Math.log10(N)), cy: f.sy(sa), r: 4, style: `fill:${color}` }, svg);
    }
    o.steel.textContent = sa <= 300 ? "no failure: below the endurance limit" : fmtN(ns);
    o.al.textContent = na > 1e9 ? "> 10⁹ cycles, but it would still fail eventually" : fmtN(na);
  }
  draw();
}
