// Geometry blocks. Every measure on screen is computed from the points the
// learner moves: triangle centres, circle theorems, conics, wallpaper
// groups, hyperbolic and spherical triangles, Platonic solids.

import { el, line, polygon, P, fmt, easeInOut, reducedMotion } from "./svg.js";
import { scrubAll } from "./scrub.js";
import { frame, polyline, text } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => len(sub(a, b));
const unit = (a) => mul(a, 1 / (len(a) || 1));
const mid = (a, b) => mul(add(a, b), 0.5);
const angleAt = (v, a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(a, v)), unit(sub(b, v))))));
const toWorld = (svg, e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, -p.y];
};

// A draggable, focusable point sized for the drawing's scale. onMove gets
// world coordinates; arrow keys nudge it by `step` (Shift ×5).
function grip(svg, parent, label, size, step, onMove, getPos) {
  const hit = el("circle", { r: size * 2.2, tabindex: 0, role: "slider", "aria-label": label, class: "cursor-grab outline-none", style: "fill:transparent" }, parent);
  const dotEl = el("circle", { r: size, class: "pointer-events-none", style: "fill:var(--background);stroke:var(--brand);stroke-width:2px", "vector-effect": "non-scaling-stroke" }, parent);
  hit.addEventListener("pointerdown", (e) => { hit.setPointerCapture(e.pointerId); onMove(toWorld(svg, e)); });
  hit.addEventListener("pointermove", (e) => { if (hit.hasPointerCapture(e.pointerId)) onMove(toWorld(svg, e)); });
  hit.addEventListener("focus", () => (dotEl.style.strokeWidth = "3.5px"));
  hit.addEventListener("blur", () => (dotEl.style.strokeWidth = "2px"));
  hit.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = step * (e.shiftKey ? 5 : 1);
    onMove(add(getPos(), [d[0] * k, d[1] * k]), e);
  });
  return {
    node: hit,
    place([x, y]) { for (const n of [hit, dotEl]) { n.setAttribute("cx", x); n.setAttribute("cy", -y); } },
    // Keep the grip above whatever is redrawn under it.
    raise() { parent.append(hit, dotEl); },
  };
}

// polyline for world-unit drawings: strokes stay in screen pixels.
function pl(parent, pts, style) {
  return el("polyline", { points: pts.map((p) => `${p[0]},${p[1]}`).join(" "), style: "fill:none;" + style, "vector-effect": "non-scaling-stroke" }, parent);
}

function circle(parent, c, r, style) {
  return el("circle", { cx: c[0], cy: -c[1], r, style: "fill:none;" + style, "vector-effect": "non-scaling-stroke" }, parent);
}
function dotAt(parent, p, r, color) {
  return el("circle", { cx: p[0], cy: -p[1], r, style: `fill:${color}` }, parent);
}
function label(parent, p, s, size, extra = {}) {
  const t = el("text", { x: p[0], y: -p[1], "font-size": size, "text-anchor": "middle", "dominant-baseline": "middle", class: "fill-foreground font-serif italic", ...extra }, parent);
  t.textContent = s;
  return t;
}
// A filled angle wedge at v between directions to a and b (the smaller one).
function wedge(parent, v, a, b, r, color, opacity = 0.2) {
  const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]);
  let a2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const pts = [v];
  for (let i = 0; i <= 24; i++) pts.push([v[0] + r * Math.cos(a1 + (d * i) / 24), v[1] + r * Math.sin(a1 + (d * i) / 24)]);
  return polygon(parent, pts, `fill:${color};fill-opacity:${opacity};stroke:${color};stroke-width:1px`);
}
const deg1 = (r) => `${fmt(deg(r), 1)}°`;

// ============================================================ G1 Triangle centres

for (const root of document.querySelectorAll("[data-geo-tri]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const show = { circum: true, incircle: false, centroid: false, ortho: false, euler: true, nine: false };
  let pts = [[-3, -2], [3.2, -2.2], [-0.6, 2.6]];
  const scene = el("g", {}, svg);
  const top = el("g", {}, svg);
  const grips = ["A", "B", "C"].map((n, i) =>
    grip(svg, top, `Vertex ${n}`, 0.13, 0.1, (p) => {
      pts[i] = [Math.max(-4.7, Math.min(4.7, p[0])), Math.max(-3.9, Math.min(3.9, p[1]))];
      draw();
    }, () => pts[i]));
  onToggle(root, (k, on) => { show[k] = on; draw(); });

  function circumcenter(A, B, C) {
    const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
    const s = (p) => p[0] * p[0] + p[1] * p[1];
    return [(s(A) * (B[1] - C[1]) + s(B) * (C[1] - A[1]) + s(C) * (A[1] - B[1])) / d,
      (s(A) * (C[0] - B[0]) + s(B) * (A[0] - C[0]) + s(C) * (B[0] - A[0])) / d];
  }
  const foot = (p, a, b) => { const d = sub(b, a); const t = dot(sub(p, a), d) / dot(d, d); return add(a, mul(d, t)); };
  // A long line through p and q, clipped by the view.
  const longLine = (p, q, style) => { const d = mul(unit(sub(q, p)), 30); line(scene, sub(p, d), add(p, d), style); };

  function draw() {
    scene.replaceChildren();
    const [A, B, C] = pts;
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const area2 = cross(sub(B, A), sub(C, A));
    const degenerate = Math.abs(area2) < 1e-6;
    polygon(scene, pts, "fill:var(--brand);fill-opacity:0.06;stroke:var(--foreground);stroke-width:2px;stroke-linejoin:round");
    if (!degenerate) {
      const O = circumcenter(A, B, C), R = dist(O, A);
      const G = mul(add(add(A, B), C), 1 / 3);
      const H = sub(add(add(A, B), C), mul(O, 2)); // H = A + B + C − 2O
      const I = mul(add(add(mul(A, a), mul(B, b)), mul(C, c)), 1 / (a + b + c));
      const s = (a + b + c) / 2, area = Math.abs(area2) / 2, r = area / s;
      if (show.euler && dist(O, H) > 1e-6) longLine(O, H, "stroke:var(--brand);stroke-width:1.5px;stroke-dasharray:6 4");
      if (show.nine) circle(scene, mid(O, H), R / 2, "stroke:var(--ion-na);stroke-width:1.25px");
      if (show.circum) circle(scene, O, R, "stroke:var(--vec-u);stroke-width:1.25px");
      if (show.incircle) circle(scene, I, r, "stroke:var(--ion-cl);stroke-width:1.25px");
      if (show.centroid) for (const [v, m] of [[A, mid(B, C)], [B, mid(C, A)], [C, mid(A, B)]]) line(scene, v, m, "stroke:var(--vec-out);stroke-width:1.25px");
      if (show.ortho) for (const [v, p, q] of [[A, B, C], [B, C, A], [C, A, B]]) {
        const f = foot(v, p, q);
        line(scene, v, f, "stroke:var(--ion-k);stroke-width:1.25px");
        // Extend the opposite side when the foot falls outside it.
        line(scene, p, f, "stroke:var(--ion-k);stroke-opacity:0.35;stroke-width:1px;stroke-dasharray:3 3");
      }
      const centre = (p, name, color, on, off = [0.22, 0.22]) => { if (!on) return; dotAt(scene, p, 0.09, color); label(scene, add(p, off), name, 0.32, { style: `fill:${color}` }); };
      centre(O, "O", "var(--vec-u)", show.circum || show.euler);
      centre(I, "I", "var(--ion-cl)", show.incircle);
      centre(G, "G", "var(--vec-out)", show.centroid || show.euler);
      centre(H, "H", "var(--ion-k)", show.ortho || show.euler);
      if (show.nine) centre(mid(O, H), "N", "var(--ion-na)", true, [-0.24, -0.26]);
      o.heron.textContent = fmt(Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c))), 3);
      o.shoe.textContent = fmt(area, 3);
      o.ratio.textContent = dist(G, O) < 1e-6 ? "— (equilateral: O = G = H)" : fmt(dist(H, G) / dist(G, O), 4);
    } else {
      o.heron.textContent = o.shoe.textContent = "0";
      o.ratio.textContent = "— (degenerate)";
    }
    ["A", "B", "C"].forEach((n, i) => {
      const cen = mul(add(add(A, B), C), 1 / 3);
      label(scene, add(pts[i], mul(unit(sub(pts[i], cen)), 0.42)), n, 0.38);
      grips[i].place(pts[i]);
    });
    const angA = angleAt(A, B, C), angB = angleAt(B, C, A), angC = angleAt(C, A, B);
    o.sides.textContent = `${fmt(a)} · ${fmt(b)} · ${fmt(c)}`;
    o.angles.textContent = `${deg1(angA)} · ${deg1(angB)} · ${deg1(angC)}`;
    o.sum.textContent = `${fmt(deg(angA + angB + angC), 6)}°`;
  }
  draw();
}

// ============================================================ G2 Pythagoras

for (const root of document.querySelectorAll("[data-pyth]")) {
  const svgR = root.querySelector('[data-view="rearrange"] [data-plane]');
  const svgE = root.querySelector('[data-view="euclid"] [data-plane]');
  const o = outs(root);
  const btn = root.querySelector("[data-action=swap]");
  let t = 0, target = 0, raf = 0;
  const s = scrubAll(root, draw);

  // A right triangle by its right-angle vertex R and the direction θ of
  // leg a; leg b points θ + 90°. All four copies move by translation only.
  const tri = (R, th, a, b) => [R, add(R, [a * Math.cos(th), a * Math.sin(th)]), add(R, [b * Math.cos(th + Math.PI / 2), b * Math.sin(th + Math.PI / 2)])];

  function draw() {
    const a = s.a.get(), b = s.b.get(), S = a + b, k = 7 / S;
    const A = a * k, B = b * k, Sk = 7;
    svgR.replaceChildren();
    // Arrangement 1 leaves the tilted c² square, arrangement 2 leaves a² and b².
    const one = [[[0, 0], 0], [[Sk, 0], Math.PI / 2], [[Sk, Sk], Math.PI], [[0, Sk], (3 * Math.PI) / 2]];
    const two = [[[0, A], 0], [[Sk, 0], Math.PI / 2], [[A, Sk], Math.PI], [[A, A], (3 * Math.PI) / 2]];
    const e = easeInOut(t);
    const holeC = [[A, 0], [Sk, A], [Sk - A, Sk], [0, Sk - A]];
    polygon(svgR, holeC, `fill:var(--brand);fill-opacity:${0.22 * (1 - e)};stroke:none`);
    polygon(svgR, [[0, 0], [A, 0], [A, A], [0, A]], `fill:var(--vec-i);fill-opacity:${0.25 * e};stroke:none`);
    polygon(svgR, [[A, A], [Sk, A], [Sk, Sk], [A, Sk]], `fill:var(--vec-j);fill-opacity:${0.25 * e};stroke:none`);
    one.forEach(([R1, th], i) => {
      const R = add(mul(R1, 1 - e), mul(two[i][0], e));
      polygon(svgR, tri(R, th, A, B), "fill:var(--code-bg);stroke:var(--foreground);stroke-width:1.5px;stroke-linejoin:round");
      polygon(svgR, tri(R, th, A, B), "fill:var(--foreground);fill-opacity:0.08;stroke:none");
    });
    polygon(svgR, [[0, 0], [Sk, 0], [Sk, Sk], [0, Sk]], "fill:none;stroke:var(--foreground);stroke-width:2px");
    const lab = (p, s, color, op) => label(svgR, p, s, 0.55, { style: `fill:${color};opacity:${op}` });
    lab([Sk / 2, Sk / 2], "c²", "var(--brand)", 1 - e);
    lab([A / 2, A / 2], "a²", "var(--vec-i)", e);
    lab([A + B / 2, A + B / 2], "b²", "var(--vec-j)", e);
    svgR.setAttribute("viewBox", "-0.6 -7.6 8.2 8.2");

    // Euclid I.47: squares outward on each side; the altitude from the
    // right angle splits the big square into two rectangles equal to a², b².
    svgE.replaceChildren();
    const C = [0, 0], Bp = [a, 0], Ap = [0, b];
    const n = [b, a]; // outward from C, length c
    const sqA = [C, Bp, [a, -a], [0, -a]];
    const sqB = [C, [-b, 0], [-b, b], Ap];
    const D = (() => { const d = sub(Ap, Bp); const tt = dot(sub(C, Bp), d) / dot(d, d); return add(Bp, mul(d, tt)); })();
    polygon(svgE, sqA, "fill:var(--vec-i);fill-opacity:0.25;stroke:var(--vec-i);stroke-width:1.5px");
    polygon(svgE, sqB, "fill:var(--vec-j);fill-opacity:0.25;stroke:var(--vec-j);stroke-width:1.5px");
    polygon(svgE, [Bp, D, add(D, n), add(Bp, n)], "fill:var(--vec-i);fill-opacity:0.25;stroke:none");
    polygon(svgE, [D, Ap, add(Ap, n), add(D, n)], "fill:var(--vec-j);fill-opacity:0.25;stroke:none");
    polygon(svgE, [Bp, Ap, add(Ap, n), add(Bp, n)], "fill:none;stroke:var(--brand);stroke-width:1.5px");
    line(svgE, C, add(D, n), "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:1px;stroke-dasharray:4 3");
    polygon(svgE, [C, Bp, Ap], "fill:var(--code-bg);stroke:var(--foreground);stroke-width:2px;stroke-linejoin:round");
    const fs = Math.max(0.35, (a + b) / 14);
    label(svgE, [a / 2, -a / 2], "a²", fs, { style: "fill:var(--vec-i)" });
    label(svgE, [-b / 2, b / 2], "b²", fs, { style: "fill:var(--vec-j)" });
    label(svgE, add(mid(Ap, Bp), mul(n, 0.5)), "c²", fs, { style: "fill:var(--brand)" });
    // Fit the view to the figure.
    const xs = [-b, a + b, 0], ys = [-a, a + b];
    const pad = 0.6, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const side = Math.max(x1 - x0, y1 - y0);
    svgE.setAttribute("viewBox", `${(x0 + x1 - side) / 2} ${-(y0 + y1 + side) / 2} ${side} ${side}`);

    const c2 = dist(Ap, Bp) ** 2;
    o.a2.textContent = fmt(a * a, 3);
    o.b2.textContent = fmt(b * b, 3);
    o.sum.textContent = fmt(a * a + b * b, 3);
    o.c2.textContent = fmt(c2, 3);
  }

  btn.addEventListener("click", () => {
    target = target ? 0 : 1;
    btn.querySelector("[data-label]").textContent = target ? "Back to c²" : "Rearrange";
    cancelAnimationFrame(raf);
    if (reducedMotion()) { t = target; return draw(); }
    const from = t, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      t = from + (target - from) * k;
      draw();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
  draw();
}

// ============================================================ G3 Unit circle

// Exact values at multiples of 30° and 45°, from the first quadrant by
// symmetry: sin(90°+r) = cos r, sin(180°+r) = −sin r, sin(270°+r) = −cos r.
const S = { 0: "0", 30: "1/2", 45: "√2/2", 60: "√3/2" };
const C = { 0: "1", 30: "√3/2", 45: "√2/2", 60: "1/2" };
const T = { 0: "0", 30: "√3/3", 45: "1", 60: "√3" };
const K = { 0: "undefined", 30: "√3", 45: "1", 60: "√3/3" }; // cot r
const neg = (x) => (x === "0" || x === "undefined" ? x : "−" + x);
function exact(fn, d) {
  if (d % 30 && d % 45) return null;
  const q = Math.floor(d / 90) % 4, r = d % 90;
  if (fn === "sin") return [S[r], C[r], neg(S[r]), neg(C[r])][q];
  if (fn === "cos") return [C[r], neg(S[r]), neg(C[r]), S[r]][q];
  return [T[r], neg(K[r]), T[r], neg(K[r])][q];
}
function piFraction(d) {
  const g = (x, y) => (y ? g(y, x % y) : x);
  const k = g(d, 180), num = d / k, den = 180 / k;
  if (num === 0) return "0";
  return `${num === 1 ? "" : num}π${den === 1 ? "" : "/" + den}`;
}

for (const root of document.querySelectorAll("[data-trig]")) {
  const svg = root.querySelector("[data-plane]");
  const graph = root.querySelector("[data-graph]");
  const o = outs(root);
  let th = rad(40), unitMode = "deg";
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  const g = grip(svg, top, "Angle point", 0.045, 0.02, (p, e) => {
    if (e && e.key) {
      const d = (e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 15 : 1);
      set(Math.round(deg(th)) + d);
      return;
    }
    let d = deg(Math.atan2(p[1], p[0]));
    if (d < 0) d += 360;
    // Snap to special angles within 3°.
    for (let s = 0; s <= 360; s += 15) if ((s % 30 === 0 || s % 45 === 0) && Math.abs(d - s) < 3) d = s % 360;
    set(d);
  }, () => [Math.cos(th), Math.sin(th)]);
  root.addEventListener("seg-change", (e) => { unitMode = e.detail.value; draw(); });

  function set(d) { th = rad(((d % 360) + 360) % 360); draw(); }

  function draw() {
    scene.replaceChildren();
    const c = Math.cos(th), s = Math.sin(th), t = s / c;
    line(scene, [-1.35, 0], [1.35, 0], "stroke:currentColor;stroke-opacity:0.3;stroke-width:1px");
    line(scene, [0, -1.35], [0, 1.35], "stroke:currentColor;stroke-opacity:0.3;stroke-width:1px");
    circle(scene, [0, 0], 1, "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.5px");
    line(scene, [1, -1.4], [1, 1.4], "stroke:currentColor;stroke-opacity:0.15;stroke-width:1px;stroke-dasharray:3 3");
    wedge(scene, [0, 0], [1, 0], [c, s], 0.22, "var(--brand)", 0.18);
    if (th > Math.PI) { // the wedge takes the smaller side; draw the reflex arc too
      const pts = [];
      for (let i = 0; i <= 48; i++) pts.push([0.16 * Math.cos((th * i) / 48), 0.16 * Math.sin((th * i) / 48)]);
      pl(scene, pts.map((p) => P(p)), "stroke:var(--brand);stroke-width:1px");
    }
    line(scene, [0, 0], [c, s], "stroke:var(--foreground);stroke-width:1.5px");
    if (Math.abs(c) > 1e-9) {
      const tt = Math.max(-1.4, Math.min(1.4, t));
      line(scene, [0, 0], [1, tt], "stroke:var(--vec-out);stroke-opacity:0.4;stroke-width:1px;stroke-dasharray:3 3");
      line(scene, [1, 0], [1, tt], "stroke:var(--vec-out);stroke-width:3px;stroke-linecap:round");
    }
    line(scene, [0, 0], [c, 0], "stroke:var(--vec-i);stroke-width:3px;stroke-linecap:round");
    line(scene, [c, 0], [c, s], "stroke:var(--vec-j);stroke-width:3px;stroke-linecap:round");
    g.place([c, s]);

    graph.replaceChildren();
    const f = frame(graph, { box: [34, 12, 372, 260], x: [0, 2 * Math.PI], y: [-2, 2], xticks: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI], yticks: [-2, -1, 0, 1, 2],
      xfmt: (v) => unitMode === "deg" ? `${Math.round(deg(v))}°` : piFraction(Math.round(deg(v))), yfmt: (v) => String(v).replace("-", "−") });
    const curve = (fn) => {
      let seg = [];
      for (let i = 0; i <= 360; i++) {
        const x = (2 * Math.PI * i) / 360, y = fn(x);
        if (!Number.isFinite(y) || Math.abs(y) > 2.2) { if (seg.length > 1) segs.push(seg); seg = []; continue; }
        seg.push([f.sx(x), f.sy(y)]);
      }
      if (seg.length > 1) segs.push(seg);
    };
    let segs = [];
    for (const [fn, color] of [[Math.cos, "var(--vec-i)"], [Math.sin, "var(--vec-j)"], [Math.tan, "var(--vec-out)"]]) {
      segs = [];
      curve(fn);
      for (const sg of segs) polyline(graph, sg, `stroke:${color};stroke-width:1.75`);
    }
    el("line", { x1: f.sx(th), x2: f.sx(th), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:3 3" }, graph);
    for (const [v, color] of [[c, "var(--vec-i)"], [s, "var(--vec-j)"], [t, "var(--vec-out)"]])
      if (Math.abs(v) <= 2) el("circle", { cx: f.sx(th), cy: f.sy(v), r: 3.5, style: `fill:${color};stroke:var(--background);stroke-width:1.5` }, graph);

    const d = Math.round(deg(th) * 1e6) / 1e6;
    const special = Number.isInteger(d) && (d % 30 === 0 || d % 45 === 0);
    o.theta.textContent = unitMode === "deg" ? `${fmt(d, 1)}°` : special ? `${piFraction(d)} rad` : `${fmt(th, 4)} rad`;
    const show = (fn, v) => {
      const ex = special ? exact(fn, d) : null;
      if (ex === "undefined") return "undefined (cos θ = 0)";
      return ex && !/^−?[01]$/.test(ex) ? `${ex} ≈ ${fmt(v, 4)}` : fmt(v, 4);
    };
    o.sin.textContent = show("sin", s);
    o.cos.textContent = show("cos", c);
    o.tan.textContent = Math.abs(c) < 1e-12 ? "undefined (cos θ = 0)" : show("tan", t);
  }
  draw();
}

// ============================================================ G4 Circle theorems

const THEOREMS = {
  inscribed: { pts: [200, 320, 90], names: ["A", "B", "P"], text: "An inscribed angle is half the central angle on the same arc: ∠APB = ½ ∠AOB." },
  segment: { pts: [200, 330, 70, 120], names: ["A", "B", "P", "Q"], text: "Angles in the same segment are equal: ∠APB = ∠AQB, wherever P and Q sit on the same arc." },
  semicircle: { pts: [180, 0, 110], names: ["A", "B", "P"], text: "An angle in a semicircle is a right angle: if AB is a diameter, ∠APB = 90°." },
  cyclic: { pts: [200, 290, 20, 110], names: ["A", "B", "C", "D"], text: "In a cyclic quadrilateral, opposite angles add up to 180°: ∠A + ∠C = ∠B + ∠D = 180°." },
};

for (const root of document.querySelectorAll("[data-circ]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  let mode = "inscribed", ang = THEOREMS.inscribed.pts.map(rad);
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  let grips = [];
  const at = (a) => [Math.cos(a), Math.sin(a)];

  function setMode(m) {
    mode = m;
    ang = THEOREMS[m].pts.map(rad);
    top.replaceChildren();
    grips = THEOREMS[m].names.map((n, i) =>
      grip(svg, top, `Point ${n}`, 0.045, 0.04, (p, e) => {
        let a = Math.atan2(p[1], p[0]);
        if (e && e.key) a = ang[i] + ((e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1) * (e.shiftKey ? 10 : 2) * Math.PI) / 180;
        ang[i] = a;
        if (mode === "semicircle" && i === 0) ang[1] = a + Math.PI;
        draw();
      }, () => at(ang[i])));
    if (mode === "semicircle") grips[1].node.style.display = "none";
    o.statement.textContent = THEOREMS[m].text;
    draw();
  }
  root.addEventListener("seg-change", (e) => {
    if (!THEOREMS[e.detail.value]) return;
    // Two seg rows share one choice: clear the other row.
    root.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === e.detail.value)));
    setMode(e.detail.value);
  });

  // Is angle x on the arc from a to b going counterclockwise?
  const onArc = (x, a, b) => { const n = (v) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return n(x - a) < n(b - a); };

  function draw() {
    scene.replaceChildren();
    circle(scene, [0, 0], 1, "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.5px");
    dotAt(scene, [0, 0], 0.03, "var(--foreground)");
    label(scene, [0.1, -0.1], "O", 0.12);
    const p = ang.map(at);
    const names = THEOREMS[mode].names;
    const rows = [];
    const seg = (a, b, style = "stroke:var(--foreground);stroke-width:1.5px") => line(scene, a, b, style);
    if (mode === "inscribed" || mode === "segment" || mode === "semicircle") {
      const [A, B] = p;
      seg(A, B, "stroke:currentColor;stroke-opacity:0.3;stroke-width:1px");
      const verts = mode === "segment" ? [p[2], p[3]] : [p[2]];
      const colors = ["var(--brand)", "var(--vec-u)"];
      verts.forEach((V, k) => {
        seg(V, A); seg(V, B);
        wedge(scene, V, A, B, 0.18, colors[k]);
      });
      if (mode === "inscribed") {
        // The central angle of the arc AB that does not contain P.
        const pIn = onArc(ang[2], ang[0], ang[1]);
        let central = (((pIn ? ang[0] - ang[1] : ang[1] - ang[0]) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        seg([0, 0], A, "stroke:var(--vec-out);stroke-width:1.5px"); seg([0, 0], B, "stroke:var(--vec-out);stroke-width:1.5px");
        const start = pIn ? ang[1] : ang[0];
        const pts = [[0, 0]];
        for (let i = 0; i <= 48; i++) pts.push(at(start + (central * i) / 48).map((v) => v * 0.22));
        polygon(scene, pts, "fill:var(--vec-out);fill-opacity:0.2;stroke:var(--vec-out);stroke-width:1px");
        const inscr = angleAt(p[2], A, B);
        rows.push(["∠APB", deg1(inscr), "var(--brand)"], ["∠AOB (arc not containing P)", deg1(central), "var(--vec-out)"], ["∠AOB ÷ ∠APB", fmt(central / inscr, 6), ""]);
      } else if (mode === "segment") {
        const a1 = angleAt(p[2], A, B), a2 = angleAt(p[3], A, B);
        const same = onArc(ang[2], ang[0], ang[1]) === onArc(ang[3], ang[0], ang[1]);
        rows.push(["∠APB", deg1(a1), "var(--brand)"], ["∠AQB", deg1(a2), "var(--vec-u)"],
          same ? ["difference", `${fmt(deg(a1 - a2), 6)}°`, ""] : ["opposite arcs: sum", `${fmt(deg(a1 + a2), 6)}°`, ""]);
      } else {
        seg(A, B, "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:1px;stroke-dasharray:4 3");
        rows.push(["∠APB", `${fmt(deg(angleAt(p[2], A, B)), 6)}°`, "var(--brand)"]);
      }
    } else {
      // Order the four points around the circle so the quadrilateral is simple.
      const order = [0, 1, 2, 3].sort((i, j) => ((ang[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - (((ang[j] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)));
      const q = order.map((i) => p[i]);
      polygon(scene, q, "fill:var(--brand);fill-opacity:0.06;stroke:var(--foreground);stroke-width:1.5px;stroke-linejoin:round");
      const angs = q.map((V, k) => angleAt(V, q[(k + 3) % 4], q[(k + 1) % 4]));
      const colors = ["var(--brand)", "var(--vec-u)", "var(--brand)", "var(--vec-u)"];
      q.forEach((V, k) => wedge(scene, V, q[(k + 3) % 4], q[(k + 1) % 4], 0.16, colors[k]));
      const n = order.map((i) => names[i]);
      rows.push([`∠${n[0]} + ∠${n[2]}`, `${fmt(deg(angs[0] + angs[2]), 6)}°`, "var(--brand)"], [`∠${n[1]} + ∠${n[3]}`, `${fmt(deg(angs[1] + angs[3]), 6)}°`, "var(--vec-u)"]);
    }
    p.forEach((pt, i) => {
      if (mode === "semicircle" && i === 1) dotAt(scene, pt, 0.035, "var(--foreground)");
      label(scene, mul(pt, 1.16), names[i], 0.13);
      grips[i]?.place(pt);
    });
    o.measures.replaceChildren(...rows.map(([k, v, color]) => {
      const d = document.createElement("div");
      d.className = "flex justify-between gap-3";
      const a = document.createElement("span"); a.className = "text-muted-foreground"; a.textContent = k;
      const b = document.createElement("span"); b.className = "tabular-nums"; b.textContent = v; if (color) b.style.color = color;
      d.append(a, b);
      return d;
    }));
  }
  setMode("inscribed");
}

// ============================================================ G5 Archimedes

for (const root of document.querySelectorAll("[data-pi]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  // Archimedes' doubling, without π: start from hexagons (half-perimeters
  // 3 inscribed, 2√3 circumscribed); then the harmonic mean gives the next
  // circumscribed value, the geometric mean the next inscribed one.
  let lo = 3, hi = 2 * Math.sqrt(3);
  const table = { 6: [lo, hi] };
  for (let n = 12; n <= 96; n *= 2) {
    hi = (2 * hi * lo) / (hi + lo);
    lo = Math.sqrt(hi * lo);
    table[n] = [lo, hi];
  }
  for (const row of root.querySelectorAll("[data-row]")) {
    const [l, u] = table[row.dataset.row];
    row.querySelector("[data-lo]").textContent = l.toFixed(6);
    row.querySelector("[data-hi]").textContent = u.toFixed(6);
  }

  function draw() {
    const n = Math.round(s.n.get());
    svg.replaceChildren();
    const ins = [], cir = [], R = 1 / Math.cos(Math.PI / n);
    for (let k = 0; k < n; k++) {
      const a = Math.PI / 2 + (2 * Math.PI * k) / n;
      ins.push([Math.cos(a), Math.sin(a)]);
      cir.push([R * Math.cos(a + Math.PI / n), R * Math.sin(a + Math.PI / n)]);
    }
    polygon(svg, cir, "fill:var(--vec-u);fill-opacity:0.08;stroke:var(--vec-u);stroke-width:1.5px;stroke-linejoin:round");
    circle(svg, [0, 0], 1, "stroke:var(--foreground);stroke-width:1.5px");
    polygon(svg, ins, "fill:var(--brand);fill-opacity:0.1;stroke:var(--brand);stroke-width:1.5px;stroke-linejoin:round");
    // Half-perimeters of polygons around a circle of radius 1.
    const lower = n * Math.sin(Math.PI / n), upper = n * Math.tan(Math.PI / n);
    o.lower.textContent = lower.toFixed(6);
    o.upper.textContent = upper.toFixed(6);
    o.gap.textContent = (upper - lower).toExponential(2);
    for (const row of root.querySelectorAll("[data-row]")) row.toggleAttribute("data-on", Number(row.dataset.row) === n);
  }
  draw();
}

// ============================================================ G6 Conics

for (const root of document.querySelectorAll("[data-conic]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const F = [-1, 0];
  let phi = rad(100), traced = 1, raf = 0;
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  const s = scrubAll(root, draw);
  // Polar form about the focus, with the directrix at x = F.x − p:
  // r(φ) = e p / (1 − e cos φ). A negative r is the hyperbola's far branch.
  const r = (a) => (s.e.get() * s.p.get()) / (1 - s.e.get() * Math.cos(a));
  const point = (a) => { const rr = r(a); return [F[0] + rr * Math.cos(a), F[1] + rr * Math.sin(a)]; };
  const g = grip(svg, top, "Point on the curve", 0.12, 0.02, (p, e) => {
    if (e && e.key) phi += ((e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1) * (e.shiftKey ? 10 : 2) * Math.PI) / 180;
    else {
      // Choose the curve point whose ray from F passes nearest the pointer.
      const a = Math.atan2(p[1] - F[1], p[0] - F[0]);
      phi = r(a) > 0 ? a : a + Math.PI;
    }
    draw();
  }, () => point(phi));
  root.querySelectorAll("[data-e]").forEach((b) => b.addEventListener("click", () => { s.e.set(Number(b.dataset.e)); }));
  root.querySelector("[data-action=trace]").addEventListener("click", () => {
    cancelAnimationFrame(raf);
    if (reducedMotion()) { traced = 1; return draw(); }
    const t0 = performance.now();
    const step = (now) => { traced = Math.min(1, (now - t0) / 2200); draw(); if (traced < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  });

  function draw() {
    scene.replaceChildren();
    const e = s.e.get(), p = s.p.get();
    const dx = F[0] - p;
    line(scene, [-7, 0], [7, 0], "stroke:currentColor;stroke-opacity:0.15;stroke-width:1px");
    line(scene, [dx, -5], [dx, 5], "stroke:var(--vec-u);stroke-width:1.5px");
    label(scene, [dx - 0.3, 4], "d", 0.4, { style: "fill:var(--vec-u)" });
    // The locus, sampled by angle and split where it runs off to infinity.
    const N = 720, upto = Math.floor(N * traced);
    let segs = [], cur = [];
    for (let i = 0; i <= upto; i++) {
      const a = (2 * Math.PI * i) / N - Math.PI;
      const rr = r(a);
      const q = [F[0] + rr * Math.cos(a), F[1] + rr * Math.sin(a)];
      if (!Number.isFinite(rr) || Math.abs(rr) > 40) { if (cur.length > 1) segs.push(cur); cur = []; continue; }
      if (cur.length && dist(q, cur.at(-1)) > 3) { if (cur.length > 1) segs.push(cur); cur = []; }
      cur.push(q);
    }
    if (cur.length > 1) segs.push(cur);
    for (const sg of segs) pl(scene, sg.map(P), "stroke:var(--foreground);stroke-width:2px;stroke-linejoin:round");

    dotAt(scene, F, 0.1, "var(--brand)");
    label(scene, add(F, [0, -0.4]), "F", 0.38, { style: "fill:var(--brand)" });
    let F2 = null, a = null;
    if (e < 1 - 1e-9) { a = (e * p) / (1 - e * e); F2 = [F[0] + 2 * a * e, 0]; }
    else if (e > 1 + 1e-9) { a = (e * p) / (e * e - 1); F2 = [F[0] - 2 * a * e, 0]; }
    if (F2 && Math.abs(F2[0]) < 6) { dotAt(scene, F2, 0.08, "var(--vec-out)"); label(scene, add(F2, [0, -0.4]), "F′", 0.38, { style: "fill:var(--vec-out)" }); }

    if (!Number.isFinite(r(phi)) || Math.abs(r(phi)) > 40) phi = rad(100);
    const P0 = point(phi), D = [dx, P0[1]];
    line(scene, F, P0, "stroke:var(--brand);stroke-width:1.5px");
    line(scene, P0, D, "stroke:var(--vec-u);stroke-width:1.5px;stroke-dasharray:4 3");
    if (F2 && e < 1) line(scene, F2, P0, "stroke:var(--vec-out);stroke-width:1.5px");
    if (F2 && e > 1) line(scene, F2, P0, "stroke:var(--vec-out);stroke-width:1.5px");
    g.place(P0);

    const PF = dist(P0, F), PD = Math.abs(P0[0] - dx);
    o.type.textContent = e < 1 - 1e-9 ? (e < 0.06 ? "ellipse (near a circle)" : "ellipse") : e > 1 + 1e-9 ? "hyperbola" : "parabola";
    o.pf.textContent = fmt(PF, 4);
    o.pd.textContent = fmt(e * PD, 4);
    o.sum.textContent = F2 ? (e < 1 ? `${fmt(PF + dist(P0, F2), 4)} = 2a` : `|PF − PF′| = ${fmt(Math.abs(PF - dist(P0, F2)), 4)} = 2a`) : "— (one focus)";
  }
  draw();
}

// ============================================================ G7 Wallpaper groups

const rotM = (d) => { const a = rad(d); return [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)]; };
const mirM = (d) => { const a = rad(2 * d); return [Math.cos(a), Math.sin(a), Math.sin(a), -Math.cos(a)]; }; // across the line at angle d
const LATT = {
  oblique: { a: [1.2, 0], b: [0.35, 1.0], name: "oblique" },
  rect: { a: [1.3, 0], b: [0, 0.9], name: "rectangular" },
  square: { a: [1.1, 0], b: [0, 1.1], name: "square" },
  hex: { a: [1.3, 0], b: [0.65, 1.3 * Math.sqrt(3) / 2], name: "hexagonal" },
};
// Each group: lattice, point operations (matrix + translation as a
// fraction of b), and the symbols drawn for the "show symmetry" toggle.
const GROUPS = {
  p1: { lat: "oblique", ops: [[rotM(0)]], rot: "none", refl: "none" },
  p2: { lat: "oblique", ops: [[rotM(0)], [rotM(180)]], rot: "2-fold", refl: "none", centres: [[2, [0, 0]], [2, [0.5, 0]], [2, [0, 0.5]], [2, [0.5, 0.5]]] },
  pm: { lat: "rect", ops: [[rotM(0)], [mirM(90)]], rot: "none", refl: "mirrors", mirrors: "pm" },
  pg: { lat: "rect", ops: [[rotM(0)], [mirM(90), [0, 0.5]]], rot: "none", refl: "glide reflections", glides: "pg" },
  p4: { lat: "square", ops: [0, 90, 180, 270].map((d) => [rotM(d)]), rot: "4-fold, 2-fold", refl: "none", centres: [[4, [0, 0]], [4, [0.5, 0.5]], [2, [0.5, 0]], [2, [0, 0.5]]] },
  p4m: { lat: "square", ops: [...[0, 90, 180, 270].map((d) => [rotM(d)]), ...[0, 45, 90, 135].map((d) => [mirM(d)])], rot: "4-fold, 2-fold", refl: "mirrors and glides", centres: [[4, [0, 0]], [4, [0.5, 0.5]], [2, [0.5, 0]], [2, [0, 0.5]]], mirrors: "p4m" },
  p3: { lat: "hex", ops: [0, 120, 240].map((d) => [rotM(d)]), rot: "3-fold", refl: "none", centres: [[3, [0, 0]], [3, [1 / 3, 1 / 3]], [3, [2 / 3, 2 / 3]]] },
  p6: { lat: "hex", ops: [0, 60, 120, 180, 240, 300].map((d) => [rotM(d)]), rot: "6-fold, 3-fold, 2-fold", refl: "none", centres: [[6, [0, 0]], [3, [1 / 3, 1 / 3]], [3, [2 / 3, 2 / 3]], [2, [0.5, 0]], [2, [0, 0.5]], [2, [0.5, 0.5]]] },
  p6m: { lat: "hex", ops: [...[0, 60, 120, 180, 240, 300].map((d) => [rotM(d)]), ...[0, 30, 60, 90, 120, 150].map((d) => [mirM(d)])], rot: "6-fold, 3-fold, 2-fold", refl: "mirrors and glides", centres: [[6, [0, 0]], [3, [1 / 3, 1 / 3]], [3, [2 / 3, 2 / 3]], [2, [0.5, 0]], [2, [0, 0.5]], [2, [0.5, 0.5]]], mirrors: "p6m" },
};
// An asymmetric flag: no rotation or reflection maps it to itself, so the
// pattern has exactly the symmetries of its group.
const MOTIF = [[0, 0], [0.05, 0], [0.05, 0.12], [0.17, 0.17], [0.05, 0.22], [0, 0.22]];

for (const root of document.querySelectorAll("[data-tile]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  let group = "p4m", anchor = [0.24, 0.1];
  const show = { cell: true, symbols: true };
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  const g = grip(svg, top, "Motif position", 0.05, 0.02, (p) => { anchor = [Math.max(-0.6, Math.min(0.6, p[0])), Math.max(-0.6, Math.min(0.6, p[1]))]; draw(); }, () => anchor);
  onToggle(root, (k, on) => { show[k] = on; draw(); });
  root.addEventListener("seg-change", (e) => { if (GROUPS[e.detail.value]) { group = e.detail.value; draw(); } });

  const apply = (m, v) => [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];

  function draw() {
    scene.replaceChildren();
    const G = GROUPS[group], L = LATT[G.lat];
    const latt = (i, j) => add(mul(L.a, i), mul(L.b, j));
    const motif = MOTIF.map((q) => add(q, anchor));
    for (let i = -6; i <= 6; i++) for (let j = -5; j <= 5; j++) {
      const T = latt(i, j);
      if (Math.abs(T[0]) > 4.5 || Math.abs(T[1]) > 3.6) continue;
      G.ops.forEach(([m, frac], k) => {
        const t = add(T, frac ? latt(frac[0], frac[1]) : [0, 0]);
        const det = m[0] * m[3] - m[1] * m[2];
        const color = i === 0 && j === 0 && k === 0 ? "var(--brand)" : det < 0 ? "var(--ion-cl)" : "var(--vec-u)";
        polygon(scene, motif.map((q) => add(apply(m, q), t)), `fill:${color};fill-opacity:0.7;stroke:${color};stroke-width:1px;stroke-linejoin:round`);
      });
    }
    if (show.cell) polygon(scene, [latt(0, 0), latt(1, 0), latt(1, 1), latt(0, 1)], "fill:none;stroke:var(--foreground);stroke-width:1.5px");
    if (show.symbols) {
      const style = "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.25px";
      const lines = (dir, through) => { for (const q of through) { const d = mul(unit(dir), 12); line(scene, sub(q, d), add(q, d), style); } };
      const grid = [];
      for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) grid.push(latt(i, j));
      if (G.mirrors === "pm") { const half = []; for (let i = -8; i <= 8; i++) half.push(mul(L.a, i / 2)); lines([0, 1], half); }
      if (G.mirrors === "p4m") {
        const half = []; for (let i = -10; i <= 10; i++) half.push(mul(L.a, i / 2));
        lines([0, 1], half); lines([1, 0], half.map(([x]) => [0, x]));
        lines([1, 1], grid.filter((q) => Math.abs(q[1]) < 1e-9)); lines([1, -1], grid.filter((q) => Math.abs(q[1]) < 1e-9));
      }
      if (G.mirrors === "p6m") for (const d of [0, 30, 60, 90, 120, 150]) lines([Math.cos(rad(d)), Math.sin(rad(d))], grid);
      if (G.glides === "pg") { for (let i = -8; i <= 8; i++) { const x = (L.a[0] * i) / 2; line(scene, [x, -6], [x, 6], "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.25px;stroke-dasharray:6 4"); } }
      for (const [order, f] of G.centres ?? []) for (let i = -5; i <= 5; i++) for (let j = -4; j <= 4; j++) {
        const c = latt(i + f[0], j + f[1]);
        if (Math.abs(c[0]) > 3.2 || Math.abs(c[1]) > 2.5) continue;
        const rr = order === 2 ? 0.07 : 0.085;
        const pts = Array.from({ length: order === 2 ? 2 : order }, (_, k) => [c[0] + rr * Math.cos((2 * Math.PI * k) / order + Math.PI / 2), c[1] + rr * Math.sin((2 * Math.PI * k) / order + Math.PI / 2)]);
        if (order === 2) el("ellipse", { cx: c[0], cy: -c[1], rx: 0.04, ry: 0.08, style: "fill:var(--foreground)" }, scene);
        else polygon(scene, pts, "fill:var(--foreground);stroke:none");
      }
    }
    g.place(anchor);
    o.lattice.textContent = L.name;
    o.rot.textContent = G.rot;
    o.refl.textContent = G.refl;
    o.copies.textContent = String(G.ops.length);
  }
  draw();
}

// ============================================================ G8 Hyperbolic and spherical

for (const root of document.querySelectorAll("[data-hyper]")) {
  const disk = root.querySelector("[data-disk]");
  const globe = root.querySelector("[data-globe]");
  const o = outs(root);

  // ---- Poincaré disk
  let H = [[-0.55, -0.35], [0.6, -0.3], [0.05, 0.62]];
  const dScene = el("g", {}, disk), dTop = el("g", {}, disk);
  const hGrips = ["A", "B", "C"].map((n, i) =>
    grip(disk, dTop, `Vertex ${n}`, 0.025, 0.02, (p) => {
      const m = len(p);
      H[i] = m > 0.94 ? mul(p, 0.94 / m) : p;
      drawDisk();
    }, () => H[i]));

  // The geodesic through p and q: a circle orthogonal to the rim, or a
  // diameter when p, q and the centre are collinear.
  function geodesic(p, q) {
    const det = cross(p, q);
    if (Math.abs(det) < 1e-9) return null;
    const k1 = (dot(p, p) + 1) / 2, k2 = (dot(q, q) + 1) / 2;
    const c = [(k1 * q[1] - k2 * p[1]) / det, (p[0] * k2 - q[0] * k1) / det];
    return { c, r: Math.sqrt(dot(c, c) - 1) };
  }
  const tangent = (p, q) => {
    const g = geodesic(p, q);
    let t = g ? [-(p[1] - g.c[1]), p[0] - g.c[0]] : sub(q, p);
    if (dot(t, sub(q, p)) < 0) t = mul(t, -1);
    return unit(t);
  };
  const arcPath = (p, q, first) => {
    const g = geodesic(p, q);
    const [x2, y2] = P(q);
    if (!g) return `${first ? `M${P(p)} ` : ""}L${x2} ${y2}`;
    const ps = P(p), qs = P(q), cs = P(g.c);
    const sweep = (ps[0] - cs[0]) * (qs[1] - cs[1]) - (ps[1] - cs[1]) * (qs[0] - cs[0]) > 0 ? 1 : 0;
    return `${first ? `M${ps} ` : ""}A${g.r} ${g.r} 0 0 ${sweep} ${x2} ${y2}`;
  };
  function drawDisk() {
    dScene.replaceChildren();
    circle(dScene, [0, 0], 1, "stroke:var(--foreground);stroke-width:1.5px");
    // A few faint geodesics through the centre's neighbourhood, for texture.
    for (const a of [15, 75, 135]) {
      const p = [0.98 * Math.cos(rad(a)), 0.98 * Math.sin(rad(a))], q = [0.98 * Math.cos(rad(a + 140)), 0.98 * Math.sin(rad(a + 140))];
      el("path", { d: arcPath(p, q, true), style: "fill:none;stroke:currentColor;stroke-opacity:0.12;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, dScene);
    }
    const [A, B, C] = H;
    el("path", { d: arcPath(A, B, true) + arcPath(B, C) + arcPath(C, A) + "Z", style: "fill:var(--brand);fill-opacity:0.12;stroke:var(--brand);stroke-width:2px;stroke-linejoin:round", "vector-effect": "non-scaling-stroke" }, dScene);
    const angs = [[A, B, C], [B, C, A], [C, A, B]].map(([v, x, y]) => Math.acos(Math.max(-1, Math.min(1, dot(tangent(v, x), tangent(v, y))))));
    ["A", "B", "C"].forEach((n, i) => { label(dScene, add(H[i], mul(unit(H[i].every((x) => x === 0) ? [0, 1] : H[i]), 0.09)), n, 0.08); hGrips[i].place(H[i]); });
    const sum = angs.reduce((a, b) => a + b, 0);
    o["h-angles"].textContent = angs.map((a) => deg1(a)).join(" · ");
    o["h-sum"].textContent = `${fmt(deg(sum), 2)}° < 180°`;
    o["h-area"].textContent = fmt(Math.PI - sum, 4);
  }
  drawDisk();

  // ---- Sphere (orthographic)
  const PRESETS = { octant: [[0, 0], [0, 90], [90, 0]], small: [[0, 0], [0, 25], [22, 12]], wide: [[-10, -30], [-10, 100], [70, 40]] };
  let tri = PRESETS.octant, yaw = rad(-135), pitch = rad(28);
  const ll = ([la, lo]) => [Math.cos(rad(la)) * Math.cos(rad(lo)), Math.cos(rad(la)) * Math.sin(rad(lo)), Math.sin(rad(la))];
  const view = ([x, y, z]) => {
    const x1 = x * Math.cos(yaw) - y * Math.sin(yaw), y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
    const y2 = y1 * Math.cos(pitch) - z * Math.sin(pitch), z2 = y1 * Math.sin(pitch) + z * Math.cos(pitch);
    return { s: [x1, z2], depth: -y2 }; // screen x, screen up; depth > 0 faces the viewer
  };
  const v3 = { dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub: (a, b) => a.map((v, i) => v - b[i]), mul: (a, k) => a.map((v) => v * k), norm: (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); } };
  const slerp = (a, b, t) => { const w = Math.acos(Math.max(-1, Math.min(1, v3.dot(a, b)))); if (w < 1e-9) return a; return a.map((_, i) => (Math.sin((1 - t) * w) * a[i] + Math.sin(t * w) * b[i]) / Math.sin(w)); };
  function drawPath(parent, pts3, front, back) {
    let seg = [], vis = null;
    const flush = () => { if (seg.length > 1) pl(parent, seg.map(P), vis ? front : back); seg = []; };
    for (const q of pts3) {
      const { s, depth } = view(q);
      const v = depth >= 0;
      if (vis !== null && v !== vis) { seg.push(s); flush(); }
      vis = v;
      seg.push(s);
    }
    flush();
  }
  function drawGlobe() {
    globe.replaceChildren();
    circle(globe, [0, 0], 1, "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.5px");
    const faint = "stroke:currentColor;stroke-opacity:0.14;stroke-width:1px", none = "stroke:none";
    for (let la = -60; la <= 60; la += 30) drawPath(globe, Array.from({ length: 73 }, (_, i) => ll([la, i * 5])), faint, none);
    for (let lo = 0; lo < 180; lo += 30) drawPath(globe, Array.from({ length: 73 }, (_, i) => ll([i * 5 - 180, lo])), faint, none);
    const V = tri.map(ll);
    const edges = [[0, 1], [1, 2], [2, 0]].map(([i, j]) => Array.from({ length: 65 }, (_, k) => slerp(V[i], V[j], k / 64)));
    const outline = edges.flat();
    if (outline.every((q) => view(q).depth >= 0)) polygon(globe, outline.map((q) => view(q).s), "fill:var(--brand);fill-opacity:0.14;stroke:none");
    for (const e of edges) drawPath(globe, e, "stroke:var(--brand);stroke-width:2px", "stroke:var(--brand);stroke-opacity:0.3;stroke-width:1px;stroke-dasharray:3 3");
    V.forEach((q, i) => { const { s, depth } = view(q); if (depth >= 0) { dotAt(globe, s, 0.035, "var(--brand)"); label(globe, mul(s, 1.1), "ABC"[i], 0.09); } });
    // Angles from the tangent vectors at each vertex.
    const angs = [[0, 1, 2], [1, 2, 0], [2, 0, 1]].map(([i, j, k]) => {
      const t = (a, b) => v3.norm(v3.sub(b, v3.mul(a, v3.dot(a, b))));
      return Math.acos(Math.max(-1, Math.min(1, v3.dot(t(V[i], V[j]), t(V[i], V[k])))));
    });
    const sum = angs.reduce((a, b) => a + b, 0);
    o["s-angles"].textContent = angs.map((a) => deg1(a)).join(" · ");
    o["s-sum"].textContent = `${fmt(deg(sum), 2)}° > 180°`;
    o["s-area"].textContent = `${fmt(sum - Math.PI, 4)}${tri === PRESETS.octant ? " = π/2, ⅛ of 4π" : ""}`;
  }
  let drag = null;
  globe.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY, yaw, pitch]; globe.setPointerCapture(e.pointerId); globe.classList.replace("cursor-grab", "cursor-grabbing"); });
  globe.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = drag[2] + (e.clientX - drag[0]) / 120;
    pitch = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) / 120));
    drawGlobe();
  });
  globe.addEventListener("pointerup", () => { drag = null; globe.classList.replace("cursor-grabbing", "cursor-grab"); });
  globe.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (!d) return;
    e.preventDefault();
    yaw += d[0];
    pitch = Math.max(-1.4, Math.min(1.4, pitch + d[1]));
    drawGlobe();
  });
  root.addEventListener("seg-change", (e) => { if (PRESETS[e.detail.value]) { tri = PRESETS[e.detail.value]; drawGlobe(); } });
  drawGlobe();
}

// ============================================================ G9 Platonic solids

const PHI = (1 + Math.sqrt(5)) / 2;
const signs = (v) => {
  let out = [v];
  for (let i = 0; i < 3; i++) out = out.flatMap((p) => (p[i] === 0 ? [p] : [p, p.map((x, k) => (k === i ? -x : x))]));
  return out;
};
const SOLIDS = {
  tetra: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  cube: signs([1, 1, 1]),
  octa: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  icosa: [...signs([0, 1, PHI]), ...signs([1, PHI, 0]), ...signs([PHI, 0, 1])],
  dodeca: [...signs([1, 1, 1]), ...signs([0, 1 / PHI, PHI]), ...signs([1 / PHI, PHI, 0]), ...signs([PHI, 0, 1 / PHI])],
};
const V3 = {
  sub: (a, b) => a.map((v, i) => v - b[i]), add: (a, b) => a.map((v, i) => v + b[i]), mul: (a, k) => a.map((v) => v * k),
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(...a),
};
// Edges are the shortest vertex pairs; faces are the planes through three
// vertices with every other vertex on one side. Nothing is typed in.
function polyhedron(raw) {
  const r = V3.len(raw[0]);
  const v = raw.map((p) => V3.mul(p, 1 / r));
  let min = Infinity;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) min = Math.min(min, V3.len(V3.sub(v[i], v[j])));
  const edges = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (V3.len(V3.sub(v[i], v[j])) < min * 1.0001) edges.push([i, j]);
  const faces = [], seen = new Set();
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++) {
    let n = V3.cross(V3.sub(v[j], v[i]), V3.sub(v[k], v[i]));
    const l = V3.len(n);
    if (l < 1e-9) continue;
    n = V3.mul(n, 1 / l);
    let d = V3.dot(n, v[i]);
    if (d < 0) { n = V3.mul(n, -1); d = -d; }
    if (d < 1e-9 || v.some((p) => V3.dot(n, p) > d + 1e-9)) continue;
    // Round, and add 0 so −0 and 0 give the same key.
    const key = n.map((x) => Math.round(x * 1e5) / 1e5 + 0).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const on = v.map((p, idx) => idx).filter((idx) => Math.abs(V3.dot(n, v[idx]) - d) < 1e-9);
    const c = V3.mul(on.reduce((s, idx) => V3.add(s, v[idx]), [0, 0, 0]), 1 / on.length);
    const u = V3.sub(v[on[0]], c), w = V3.cross(n, u);
    on.sort((a, b) => Math.atan2(V3.dot(V3.sub(v[a], c), w), V3.dot(V3.sub(v[a], c), u)) - Math.atan2(V3.dot(V3.sub(v[b], c), w), V3.dot(V3.sub(v[b], c), u)));
    faces.push({ idx: on, n, c });
  }
  return { v, edges, faces };
}

for (const root of document.querySelectorAll("[data-solids]")) {
  const svg = root.querySelector("[data-view3d]");
  const built = Object.fromEntries(Object.entries(SOLIDS).map(([k, raw]) => [k, polyhedron(raw)]));
  // Fill the table from the computed shapes.
  for (const row of root.querySelectorAll("[data-solid-row]")) {
    const s = built[row.dataset.solidRow];
    row.querySelector("[data-v]").textContent = s.v.length;
    row.querySelector("[data-e]").textContent = s.edges.length;
    row.querySelector("[data-f]").textContent = s.faces.length;
    row.querySelector("[data-chi]").textContent = s.v.length - s.edges.length + s.faces.length;
  }
  let solid = "dodeca", dual = false, yaw = 0.6, pitch = 0.35, auto = !reducedMotion(), raf = 0, visible = false, idleUntil = 0;
  root.addEventListener("seg-change", (e) => { if (built[e.detail.value]) { solid = e.detail.value; draw(); } });
  root.querySelector("[data-toggle=dual]").addEventListener("shadcn:checked-change", (e) => { dual = e.detail.checked; draw(); });

  const rot = ([x, y, z]) => {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    return [x1, y2, z2]; // z2 > 0 faces the viewer
  };

  function draw() {
    svg.replaceChildren();
    const s = built[solid];
    for (const row of root.querySelectorAll("[data-solid-row]")) row.toggleAttribute("data-on", row.dataset.solidRow === solid);
    const pv = s.v.map(rot);
    // Hidden edges first, faint.
    for (const [i, j] of s.edges) line(svg, pv[i], pv[j], "stroke:currentColor;stroke-opacity:0.18;stroke-width:1px;stroke-dasharray:3 3");
    const light = [-0.4, 0.6, 0.7];
    const faces = s.faces.map((f) => ({ f, n: rot(f.n), z: rot(f.c)[2] })).filter((x) => x.n[2] > 0).sort((a, b) => a.z - b.z);
    for (const { f, n } of faces) {
      const shade = 0.12 + 0.3 * Math.max(0, V3.dot(n, light) / V3.len(light));
      polygon(svg, f.idx.map((i) => pv[i]), `fill:var(--brand);fill-opacity:${dual ? shade * 0.5 : shade};stroke:var(--foreground);stroke-width:1.5px;stroke-linejoin:round`);
    }
    if (dual) {
      // Dual: one vertex per face (its centre, pushed to the circumsphere),
      // joined when two faces share an edge.
      const dv = s.faces.map((f) => rot(V3.mul(f.c, 1 / V3.len(f.c))));
      for (let a = 0; a < s.faces.length; a++) for (let b = a + 1; b < s.faces.length; b++) {
        const shared = s.faces[a].idx.filter((i) => s.faces[b].idx.includes(i)).length;
        if (shared === 2) line(svg, dv[a], dv[b], `stroke:var(--vec-u);stroke-width:${dv[a][2] + dv[b][2] > 0 ? 2 : 1}px;stroke-opacity:${dv[a][2] + dv[b][2] > 0 ? 1 : 0.35}`);
      }
      for (const q of dv) if (q[2] > 0) dotAt(svg, q, 0.03, "var(--vec-u)");
    }
  }

  const loop = (now) => {
    if (now > idleUntil) yaw += 0.006;
    draw();
    raf = auto && visible ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (auto && visible && !raf) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(svg);
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY, yaw, pitch]; svg.setPointerCapture(e.pointerId); svg.classList.replace("cursor-grab", "cursor-grabbing"); });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = drag[2] + (e.clientX - drag[0]) / 100;
    pitch = Math.max(-1.5, Math.min(1.5, drag[3] + (e.clientY - drag[1]) / 100));
    idleUntil = performance.now() + 2500;
    draw();
  });
  svg.addEventListener("pointerup", () => { drag = null; svg.classList.replace("cursor-grabbing", "cursor-grab"); });
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
    if (!d) return;
    e.preventDefault();
    yaw += d[0];
    pitch = Math.max(-1.5, Math.min(1.5, pitch + d[1]));
    idleUntil = performance.now() + 2500;
    draw();
  });
  draw();
}

// ============================================================ G10 Proof stepper

for (const root of document.querySelectorAll("[data-geo-proof]")) {
  const pieces = [...root.querySelectorAll("[data-steps]")];
  const texts = [...root.querySelectorAll("[data-step-text]")];
  const pips = [...root.querySelectorAll("[data-pip]")];
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 1;
  const go = (i) => {
    at = Math.max(1, Math.min(texts.length, i));
    for (const p of pieces) p.style.opacity = p.dataset.steps.split(",").includes(String(at)) ? "1" : "0";
    texts.forEach((t, k) => (t.hidden = k + 1 !== at));
    pips.forEach((p, k) => p.toggleAttribute("data-on", k + 1 === at));
    back.disabled = at === 1;
    next.disabled = at === texts.length;
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 1, End: texts.length }[e.key];
    if (to === undefined || e.target.closest("button")) return;
    e.preventDefault();
    go(to);
  });
  go(1);
}
