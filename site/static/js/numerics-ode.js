// Numerical methods, blocks 6–10: finite differences and the complex
// step, adaptive quadrature, ODE solvers on an orbit, stiffness and
// stability regions, and iterative solvers for the Poisson equation.

import { scrubAll } from "./scrub.js";
import {
  el, text, polyline, outs, plot, fx, sci, minus, onSeg, C, clipped, logFrame, lg, path,
  endLabels, slope, frame, ticks, decade, playButton, reduced, batched, gaussLegendre,
} from "./numerics-util.js";

// ============================================================ 6 Differentiation

// Just enough complex arithmetic for the complex-step derivative.
const cx = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  exp: (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; },
  sin: (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])],
  cos: (a) => [Math.cos(a[0]) * Math.cosh(a[1]), -Math.sin(a[0]) * Math.sinh(a[1])],
  sqrt: (a) => {
    const r = Math.hypot(a[0], a[1]), re = Math.sqrt((r + a[0]) / 2);
    return [re, re === 0 ? Math.sqrt(r) : a[1] / (2 * re)];
  },
};
const cube = (a) => cx.mul(a, cx.mul(a, a));

const DIFF = {
  exp: { f: Math.exp, z: cx.exp, d: Math.exp },
  sin: { f: Math.sin, z: cx.sin, d: Math.cos },
  // Squire & Trapp's test function, used by Martins et al. (2003).
  mix: {
    f: (x) => Math.exp(x) / Math.sqrt(Math.sin(x) ** 3 + Math.cos(x) ** 3),
    z: (z) => cx.div(cx.exp(z), cx.sqrt(cx.add(cube(cx.sin(z)), cube(cx.cos(z))))),
    d: (x) => {
      const s = Math.sin(x), c = Math.cos(x), g = s ** 3 + c ** 3, gp = 3 * s * s * c - 3 * c * c * s;
      return (Math.exp(x) / Math.sqrt(g)) * (1 - gp / (2 * g));
    },
  },
};
const FORMULAS = [
  { key: "fwd", label: "forward", color: C.j, fn: (F, x, h) => (F.f(x + h) - F.f(x)) / h },
  { key: "cen", label: "central", color: C.out, fn: (F, x, h) => (F.f(x + h) - F.f(x - h)) / (2 * h) },
  { key: "five", label: "five-point", color: C.v, fn: (F, x, h) => (-F.f(x + 2 * h) + 8 * F.f(x + h) - 8 * F.f(x - h) + F.f(x - 2 * h)) / (12 * h) },
  { key: "cs", label: "complex step", color: C.u, fn: (F, x, h) => F.z([x, h])[1] / h },
];

for (const root of document.querySelectorAll("[data-numx-diff]")) {
  const svg = plot(root), o = outs(root);
  let F = DIFF.exp;
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { F = DIFF[v]; draw(); });

  function draw() {
    const x = s.x.get(), k = s.lh.get(), exact = F.d(x);
    const rel = (v) => Math.abs(v - exact) / Math.abs(exact);
    svg.replaceChildren();
    const f = logFrame(svg, { box: [52, 14, 430, 290], x: [-16, 0], y: [-17, 1], xlabel: "h", ylabel: "relative error" });
    const g = clipped(svg, f);
    // Slopes of the truncation error, for reading orders off the right side.
    const ends = [];
    const ks = Array.from({ length: 161 }, (_, i) => -16 + i / 10);
    let best = { k: 0, e: Infinity };
    for (const m of FORMULAS) {
      const pts = ks.map((kk) => {
        const e = rel(m.fn(F, x, 10 ** kk));
        if (m.key === "cen" && e < best.e) best = { k: kk, e };
        return [f.sx(kk), f.sy(Math.min(1, lg(e, -17)))];
      });
      path(g, pts, `stroke:${m.color};stroke-width:1.75`);
      ends.push({ y: pts.at(-1)[1], label: m.label, color: m.color });
    }
    endLabels(svg, f, ends);
    // The two halves of the U for central differences: ε/h and h².
    text(svg, f.sx(-15.6), f.sy(-11), "← round-off ∝ ε/h");
    text(svg, f.sx(-0.3), f.sy(-14.5), "truncation ∝ hᵖ →", { "text-anchor": "end" });
    el("line", { x1: f.sx(k), x2: f.sx(k), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, g);
    const h = 10 ** k;
    for (const m of FORMULAS) {
      const e = rel(m.fn(F, x, h));
      el("circle", { cx: f.sx(k), cy: f.sy(Math.min(1, lg(e, -17))), r: 3.2, style: `fill:var(--background);stroke:${m.color};stroke-width:2` }, svg);
      o[m.key].textContent = e === 0 ? "0" : sci(e, 1);
    }
    o.exact.textContent = exact.toPrecision(15);
    o.best.textContent = `h ≈ ${sci(10 ** best.k, 0)}, error ${sci(best.e, 1)}`;
  }
  draw();
}

// ============================================================ 7 Adaptive quadrature

let oscRef = null;
const QUAD = {
  sqrt: { f: Math.sqrt, exact: () => 2 / 3, y: [0, 1.1] },
  spike: {
    f: (x) => 1 / ((x - 0.3) ** 2 + 0.001), y: [0, 1050],
    exact: () => { const r = Math.sqrt(0.001); return (Math.atan(0.7 / r) + Math.atan(0.3 / r)) / r; },
  },
  osc: {
    f: (x) => Math.sin(1 / (x + 0.05)), y: [-1.25, 1.25],
    // ∫ sin(1/u) du has no elementary form; 4000 panels of 10-point
    // Gauss–Legendre resolve its oscillations to rounding level.
    exact: () => (oscRef ??= compositeGL((x) => Math.sin(1 / (x + 0.05)), 0, 1, 4000, 10)),
  },
  exp: { f: Math.exp, exact: () => Math.E - 1, y: [0, 2.9] },
};
function compositeGL(f, a, b, panels, n) {
  const { x, w } = gaussLegendre(n), hh = (b - a) / panels;
  let sum = 0;
  for (let p = 0; p < panels; p++) {
    const c = a + (p + 0.5) * hh;
    for (let i = 0; i < n; i++) sum += w[i] * f(c + (x[i] * hh) / 2);
  }
  return (sum * hh) / 2;
}
function adaptiveSimpson(f, a, b, tol) {
  const pts = [], tree = [];
  const F = (x) => { pts.push(x); return f(x); };
  const fa = F(a), fb = F(b), m = (a + b) / 2, fm = F(m);
  const S = ((b - a) / 6) * (fa + 4 * fm + fb);
  let depth = 0;
  function rec(a, b, fa, fm, fb, S, tol, d) {
    const m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2, flm = F(lm), frm = F(rm);
    const Sl = ((m - a) / 6) * (fa + 4 * flm + fm), Sr = ((b - m) / 6) * (fm + 4 * frm + fb);
    const diff = Sl + Sr - S;
    depth = Math.max(depth, d);
    const leaf = d >= 40 || Math.abs(diff) <= 15 * tol;
    tree.push({ a, b, d, leaf });
    if (leaf) return Sl + Sr + diff / 15;
    return rec(a, m, fa, flm, fm, Sl, tol / 2, d + 1) + rec(m, b, fm, frm, fb, Sr, tol / 2, d + 1);
  }
  const value = rec(a, b, fa, fm, fb, S, tol, 0);
  return { value, pts, tree, depth };
}
function simpson(f, a, b, n) {
  const hh = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * hh);
  return (s * hh) / 3;
}

for (const root of document.querySelectorAll("[data-numx-quad]")) {
  const svg = plot(root), tsvg = plot(root, "tree"), o = outs(root);
  let Q = QUAD.sqrt;
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { Q = QUAD[v]; draw(); });

  function draw() {
    const tol = 10 ** s.tol.get(), exact = Q.exact();
    const A = adaptiveSimpson(Q.f, 0, 1, tol), err = Math.abs(A.value - exact);
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 12, 460, 214], x: [0, 1], y: Q.y, xticks: [0, 0.25, 0.5, 0.75, 1], yticks: ticks(Q.y[0], Q.y[1], (Q.y[1] - Q.y[0]) > 100 ? 250 : (Q.y[1] - Q.y[0]) > 2 ? 1 : 0.5), yfmt: minus });
    const g = clipped(svg, f);
    const xs = Array.from({ length: 801 }, (_, i) => i / 800);
    // Dense sampling near the spike so the curve is drawn truthfully.
    const dense = [...xs, ...Array.from({ length: 400 }, (_, i) => 0.25 + i / 4000)].sort((a, b) => a - b);
    path(g, dense.map((x) => [f.sx(x), f.sy(Q.f(x))]), "stroke:var(--foreground);stroke-width:1.75");
    const base = f.T + f.H;
    for (const x of A.pts) {
      el("line", { x1: f.sx(x), x2: f.sx(x), y1: base, y2: base - 6, style: `stroke:${C.brand};stroke-opacity:0.55` }, g);
      el("circle", { cx: f.sx(x), cy: f.sy(Q.f(x)), r: 1.8, style: `fill:${C.brand}` }, g);
    }

    // The recursion tree.
    tsvg.replaceChildren();
    const rows = Math.min(A.depth + 1, 18), L = 52, W = 460, T = 8, H = 150, rh = H / rows;
    for (const node of A.tree) {
      if (node.d >= rows) continue;
      el("rect", {
        x: L + node.a * W + 0.4, y: T + node.d * rh + 0.5, width: Math.max(0.6, (node.b - node.a) * W - 0.8), height: Math.max(1, rh - 1.5), rx: Math.min(2, rh / 3),
        style: node.leaf ? `fill:${C.brand};fill-opacity:0.75` : "fill:currentColor;fill-opacity:0.14",
      }, tsvg);
    }
    text(tsvg, L - 8, T + 8, "depth", { "text-anchor": "end" });
    for (const d of [0, rows - 1]) text(tsvg, L - 8, T + d * rh + rh / 2 + (d === 0 ? 14 : 3), String(d), { "text-anchor": "end" });
    if (A.depth + 1 > rows) text(tsvg, L + W, T + H + 10, `${A.depth + 1 - rows} deeper levels not drawn`, { "text-anchor": "end" });

    // A uniform grid that matches the adaptive error.
    const target = Math.max(err, 1e-15 * Math.abs(exact));
    let n = 2, found = null;
    while (n <= 2 ** 21) {
      if (Math.abs(simpson(Q.f, 0, 1, n) - exact) <= target) { found = n; break; }
      n *= 2;
    }
    if (found && found > 2) {
      let lo = found / 2, hi = found;
      if (hi <= 2 ** 16) {
        while (hi - lo > 2) {
          const mid = Math.round((lo + hi) / 4) * 2;
          if (Math.abs(simpson(Q.f, 0, 1, mid) - exact) <= target) hi = mid; else lo = mid;
        }
      }
      found = hi;
    }
    const gl = gaussLegendre(10);
    let glv = 0;
    for (let i = 0; i < 10; i++) glv += gl.w[i] * Q.f((gl.x[i] + 1) / 2);
    glv /= 2;

    o.res.textContent = A.value.toPrecision(14);
    o.exact.textContent = exact.toPrecision(14);
    o.err.textContent = err === 0 ? "0" : sci(err, 2);
    o.evals.textContent = String(A.pts.length);
    o.depth.textContent = String(A.depth + 1);
    o.uni.textContent = found ? `${(found + 1).toLocaleString("en-US")} evaluations` : "> 2 million evaluations";
    o.gl.textContent = `error ${sci(Math.abs(glv - exact), 1)}`;
  }
  draw();
}

// ============================================================ 8 ODE orbits

const accel = (x, y) => { const r3 = Math.hypot(x, y) ** 3; return [-x / r3, -y / r3]; };
const energy = (s) => (s[2] * s[2] + s[3] * s[3]) / 2 - 1 / Math.hypot(s[0], s[1]);
const deriv = (s) => { const a = accel(s[0], s[1]); return [s[2], s[3], a[0], a[1]]; };
const axpy = (s, k, h) => s.map((v, i) => v + h * k[i]);
const STEPPERS = {
  euler: (s, h) => axpy(s, deriv(s), h),
  rk2: (s, h) => axpy(s, deriv(axpy(s, deriv(s), h / 2)), h),
  rk4: (s, h) => {
    const k1 = deriv(s), k2 = deriv(axpy(s, k1, h / 2)), k3 = deriv(axpy(s, k2, h / 2)), k4 = deriv(axpy(s, k3, h));
    return s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  },
  leap: (s, h) => {
    let a = accel(s[0], s[1]);
    const vx = s[2] + (h / 2) * a[0], vy = s[3] + (h / 2) * a[1];
    const x = s[0] + h * vx, y = s[1] + h * vy;
    a = accel(x, y);
    return [x, y, vx + (h / 2) * a[0], vy + (h / 2) * a[1]];
  },
};
const ODE_METHODS = [
  { key: "euler", label: "Euler", color: C.j, out: "e1" },
  { key: "rk2", label: "RK2", color: C.out, out: "e2" },
  { key: "rk4", label: "RK4", color: C.u, out: "e4" },
  { key: "leap", label: "leapfrog", color: C.i, out: "el" },
];
const start = (e) => [1 - e, 0, 0, Math.sqrt((1 + e) / (1 - e))];

function integrate(key, e, N, periods) {
  const h = (2 * Math.PI) / N, total = N * periods, stride = Math.max(1, Math.floor(total / 1200));
  let s = start(e);
  const E0 = energy(s), pts = [[s[0], s[1], 0, 0]];
  for (let k = 1; k <= total; k++) {
    s = STEPPERS[key](s, h);
    if (!s.every(Number.isFinite) || Math.hypot(s[0], s[1]) > 1e6) break;
    if (k % stride === 0 || k === total) pts.push([s[0], s[1], k / N, Math.abs((energy(s) - E0) / E0)]);
  }
  return pts;
}

for (const root of document.querySelectorAll("[data-numx-ode]")) {
  const osvg = plot(root, "orbit"), esvg = plot(root, "energy"), rsvg = plot(root, "order"), o = outs(root);
  const btn = root.querySelector("[data-action=play]"), setPlay = playButton(btn);
  let runs = [], frac = 1, raf = 0, t0 = 0;
  const redo = batched(() => { compute(); frac = 1; stop(); draw(); });
  const s = scrubAll(root, redo);

  function compute() {
    const e = s.ecc.get(), N = Math.round(s.steps.get()), P = Math.round(s.periods.get());
    runs = ODE_METHODS.map((m) => ({ ...m, pts: integrate(m.key, e, N, P) }));
    // Global order: position error after exactly one period, against h.
    const Ns = Array.from({ length: 10 }, (_, k) => 100 * 2 ** k), s0 = start(e);
    rsvg.replaceChildren();
    const f = logFrame(rsvg, { box: [52, 10, 430, 128], x: [-4, -1], y: [-14, 1], xlabel: "step h", ylabel: "position error after 1 period" });
    const g = clipped(rsvg, f);
    const orders = [], ends = [];
    for (const m of ODE_METHODS) {
      const X = [], Y = [], pts = [];
      for (const n of Ns) {
        const h = (2 * Math.PI) / n;
        let st = s0;
        for (let k = 0; k < n; k++) st = STEPPERS[m.key](st, h);
        const err = Math.hypot(st[0] - s0[0], st[1] - s0[1]);
        pts.push([f.sx(Math.log10(h)), f.sy(lg(err, -15))]);
        if (Number.isFinite(err) && err < 0.3 && err > 1e-12) { X.push(Math.log10(h)); Y.push(Math.log10(err)); }
      }
      path(g, pts, `stroke:${m.color};stroke-width:1.75`);
      for (const pt of pts) el("circle", { cx: pt[0], cy: pt[1], r: 2.2, style: `fill:${m.color}` }, g);
      const p = slope(X, Y);
      orders.push(`${m.label} ${Number.isFinite(p) ? p.toFixed(2) : "—"}`);
      ends.push({ y: pts[0][1], label: `${m.label} ${Number.isFinite(p) ? `p≈${p.toFixed(1)}` : ""}`, color: m.color });
    }
    endLabels(rsvg, f, ends);
    o.orders.textContent = orders.join(" · ");
  }

  function draw() {
    const e = s.ecc.get(), P = Math.round(s.periods.get());
    osvg.replaceChildren();
    const W = 300, view = { x0: -2.1, x1: 1.1, y0: -1.6, y1: 1.6 }, sc = (W - 20) / (view.x1 - view.x0);
    const X = (x) => 10 + (x - view.x0) * sc, Y = (y) => W / 2 - y * sc;
    const box = { L: 4, T: 4, W: W - 8, H: W - 8 };
    const g = clipped(osvg, box);
    // The true ellipse, dashed.
    el("ellipse", { cx: X(-e), cy: Y(0), rx: sc, ry: Math.sqrt(1 - e * e) * sc, style: "fill:none;stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4" }, g);
    el("circle", { cx: X(0), cy: Y(0), r: 5, style: `fill:var(--vec-out)` }, g);
    const tmax = frac * P;
    for (const r of runs) {
      const pts = r.pts.filter((p) => p[2] <= tmax).map((p) => [X(p[0]), Y(p[1])]);
      path(g, pts, `stroke:${r.color};stroke-width:1.25;stroke-opacity:0.9`);
      const last = pts.at(-1);
      if (last) el("circle", { cx: last[0], cy: last[1], r: 3.2, style: `fill:${r.color}` }, g);
    }
    text(osvg, 8, W - 8, "dashed: exact orbit");

    esvg.replaceChildren();
    const f = logFrame(esvg, { box: [44, 10, 230, 250], x: [0, P], y: [-16, 1], linx: true, xticks: ticks(0, P, P > 10 ? 10 : P > 4 ? 2 : 1), xlabel: "periods", ylabel: "|ΔE / E|" });
    const eg = clipped(esvg, f);
    for (const r of runs) {
      const pts = r.pts.filter((p) => p[2] > 0 && p[2] <= tmax).map((p) => [f.sx(p[2]), f.sy(Math.min(1, lg(p[3], -16)))]);
      path(eg, pts, `stroke:${r.color};stroke-width:1.5`);
      const last = r.pts.at(-1);
      o[r.out].textContent = last && last[2] > 0 ? sci(last[3], 1) + (last[2] < P - 1e-9 ? " (escaped)" : "") : "—";
    }
  }

  function stop() { cancelAnimationFrame(raf); raf = 0; setPlay(false); }
  btn.addEventListener("click", () => {
    if (raf) return stop();
    if (reduced()) { frac = 1; draw(); return; }
    frac = 0; t0 = performance.now(); setPlay(true);
    const tick = (now) => {
      frac = Math.min(1, (now - t0) / 6000);
      draw();
      if (frac < 1) raf = requestAnimationFrame(tick); else stop();
    };
    raf = requestAnimationFrame(tick);
  });
  compute();
  draw();
}

// ============================================================ 9 Stiffness

const STAB = [
  { key: "eu", label: "explicit Euler", color: C.j, R: (a, b) => [1 + a, b] },
  { key: "rk2", label: "RK2", color: C.out, R: (a, b) => [1 + a + (a * a - b * b) / 2, b + a * b] },
  {
    key: "rk4", label: "RK4", color: C.u,
    R: (a, b) => {
      let re = 1, im = 0, tr = 1, ti = 0;
      for (let k = 1; k <= 4; k++) { [tr, ti] = [(tr * a - ti * b) / k, (tr * b + ti * a) / k]; re += tr; im += ti; }
      return [re, im];
    },
  },
  { key: "be", label: "backward Euler", color: C.i, R: (a, b) => { const d = (1 - a) ** 2 + b * b; return [(1 - a) / d, b / d]; } },
];
const absR = (m, a, b) => Math.hypot(...m.R(a, b));

/** The stable set of each method as row runs, and its boundary by marching squares. */
function stabilityShapes(view, nx, ny) {
  const out = {};
  const ax = (i) => view.x0 + ((view.x1 - view.x0) * i) / nx, ay = (j) => view.y1 - ((view.y1 - view.y0) * j) / ny;
  for (const m of STAB) {
    const v = [];
    for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(absR(m, ax(i), ay(j)) - 1); v.push(row); }
    const runs = [];
    for (let j = 0; j < ny; j++) {
      let startI = -1;
      for (let i = 0; i <= nx; i++) {
        const inside = i < nx && v[j][i] + v[j + 1][i] + v[j][i + 1] + v[j + 1][i + 1] <= 0;
        if (inside && startI < 0) startI = i;
        if (!inside && startI >= 0) { runs.push([startI, j, i - startI]); startI = -1; }
      }
    }
    let d = "";
    const lerp = (p, q, vp, vq) => p + ((q - p) * vp) / (vp - vq);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = [v[j][i], v[j][i + 1], v[j + 1][i + 1], v[j + 1][i]];
      const P = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const cross = [];
      for (let e = 0; e < 4; e++) {
        const a = c[e], b = c[(e + 1) % 4];
        if ((a <= 0) !== (b <= 0)) {
          const [p, q] = [P[e], P[(e + 1) % 4]];
          cross.push([lerp(p[0], q[0], a, b), lerp(p[1], q[1], a, b)]);
        }
      }
      for (let k = 0; k + 1 < cross.length; k += 2) d += `M${cross[k][0]} ${cross[k][1]}L${cross[k + 1][0]} ${cross[k + 1][1]}`;
    }
    out[m.key] = { runs, d };
  }
  return out;
}

for (const root of document.querySelectorAll("[data-numx-stiff]")) {
  const psvg = plot(root, "plane"), ssvg = plot(root, "sol"), o = outs(root);
  const view = { x0: -5, x1: 1.5, y0: -3.25, y1: 3.25 }, NX = 130, NY = 130;
  const shapes = stabilityShapes(view, NX, NY);
  const s = scrubAll(root, () => draw());
  const B = { L: 22, T: 8, W: 270, H: 270 };
  const PX = (x) => B.L + ((x - view.x0) / (view.x1 - view.x0)) * B.W, PY = (y) => B.T + ((view.y1 - y) / (view.y1 - view.y0)) * B.H;

  // Dragging the hλ point along the real axis sets h.
  let dragging = false;
  const fromPointer = (e) => {
    const r = psvg.getBoundingClientRect(), vx = ((e.clientX - r.left) / r.width) * 300;
    const z = view.x0 + ((vx - B.L) / B.W) * (view.x1 - view.x0);
    if (z < 0) { s.h.set(z / s.lam.get(), false); draw(); }
  };
  psvg.addEventListener("pointerdown", (e) => { dragging = true; psvg.setPointerCapture(e.pointerId); fromPointer(e); });
  psvg.addEventListener("pointermove", (e) => { if (dragging) fromPointer(e); });
  psvg.addEventListener("pointerup", () => { dragging = false; });
  psvg.style.touchAction = "none";
  psvg.style.cursor = "ew-resize";

  function draw() {
    const lam = s.lam.get(), h = s.h.get(), z = h * lam;
    psvg.replaceChildren();
    const g = clipped(psvg, B);
    const cw = B.W / NX, ch = B.H / NY;
    for (const m of STAB) {
      const gr = el("g", { style: `fill:${m.color};fill-opacity:${m.key === "be" ? 0.07 : 0.13}` }, g);
      for (const [i, j, len] of shapes[m.key].runs) el("rect", { x: B.L + i * cw, y: B.T + j * ch, width: len * cw + 0.3, height: ch + 0.3 }, gr);
      el("path", { d: shapes[m.key].d, transform: `translate(${B.L} ${B.T}) scale(${cw} ${ch})`, style: `fill:none;stroke:${m.color};stroke-width:${1.6 / cw};vector-effect:non-scaling-stroke` }, g);
    }
    // Axes.
    el("line", { x1: B.L, x2: B.L + B.W, y1: PY(0), y2: PY(0), style: "stroke:currentColor;stroke-opacity:0.4" }, g);
    el("line", { x1: PX(0), x2: PX(0), y1: B.T, y2: B.T + B.H, style: "stroke:currentColor;stroke-opacity:0.4" }, g);
    for (const t of [-4, -3, -2, -1, 1]) text(psvg, PX(t), PY(0) + 12, minus(String(t)), { "text-anchor": "middle" });
    text(psvg, PX(0) + 4, B.T + 10, "Im hλ");
    text(psvg, B.L + B.W - 2, PY(0) - 5, "Re hλ", { "text-anchor": "end" });
    // The point hλ.
    const zx = Math.max(view.x0, z);
    el("circle", { cx: PX(zx), cy: PY(0), r: 5.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2.5" }, psvg);
    if (z < view.x0) text(psvg, PX(view.x0) + 9, PY(0) - 9, `hλ = ${fx(z, 1)} →`, { style: "fill:var(--brand)" });

    // The solutions.
    ssvg.replaceChildren();
    const f = frame(ssvg, { box: [36, 10, 290, 250], x: [0, 3], y: [-1.6, 1.6], xticks: [0, 1, 2, 3], yticks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], yfmt: minus, xlabel: "t" });
    const sg = clipped(ssvg, f);
    const exact = (t) => Math.cos(t) - Math.exp(lam * t);
    path(sg, Array.from({ length: 301 }, (_, i) => { const t = (3 * i) / 300; return [f.sx(t), f.sy(exact(t))]; }), "stroke:var(--foreground);stroke-width:2;stroke-opacity:0.8");
    const rhs = (t, y) => lam * (y - Math.cos(t)) - Math.sin(t);
    const steps = Math.ceil(3 / h);
    const unstable = [];
    for (const m of STAB) {
      let y = 0, t = 0;
      const pts = [[f.sx(0), f.sy(0)]];
      for (let k = 0; k < steps; k++) {
        if (m.key === "eu") y = y + h * rhs(t, y);
        else if (m.key === "rk2") y = y + h * rhs(t + h / 2, y + (h / 2) * rhs(t, y));
        else if (m.key === "rk4") {
          const k1 = rhs(t, y), k2 = rhs(t + h / 2, y + (h / 2) * k1), k3 = rhs(t + h / 2, y + (h / 2) * k2), k4 = rhs(t + h, y + h * k3);
          y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        } else y = (y + h * (-lam * Math.cos(t + h) - Math.sin(t + h))) / (1 - h * lam);
        t += h;
        if (!Number.isFinite(y)) break;
        pts.push([f.sx(t), f.sy(Math.max(-3, Math.min(3, y)))]);
        if (Math.abs(y) > 3) break; // left the plot: it has blown up
      }
      path(sg, pts, `stroke:${m.color};stroke-width:1.5`);
      if (steps <= 120) for (const p of pts) el("circle", { cx: p[0], cy: p[1], r: 1.7, style: `fill:${m.color}` }, sg);
      const r = absR(m, z, 0);
      o[{ eu: "r1", rk2: "r2", rk4: "r4", be: "rb" }[m.key]].textContent = `${fx(r, 3)}${r > 1 ? "  unstable" : ""}`;
      if (r > 1) unstable.push(m.label);
    }
    o.z.textContent = fx(z, 3);
    o.hmax.textContent = `${fx(2 / Math.abs(lam), 4)}  (RK4: ${fx(2.7853 / Math.abs(lam), 4)})`;
    o.note.textContent = unstable.length
      ? `${unstable.length > 1 ? `${unstable.slice(0, -1).join(", ")} and ${unstable.at(-1)}` : unstable[0]} ${unstable.length > 1 ? "are" : "is"} outside ${unstable.length > 1 ? "their" : "its"} stability region: each step multiplies the error by |R| > 1, so the numerical solution oscillates and grows even though the true one is smooth. The step is limited by λ, not by accuracy: that is stiffness.`
      : "Every method is stable at this step. Make λ more negative or h larger and the explicit methods leave their regions first; backward Euler never does for Re hλ < 0 (A-stability).";
  }
  draw();
}

// ============================================================ 10 Poisson

function poissonProblem(N) {
  const hh = 1 / (N + 1), ustar = new Float64Array(N * N), b = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 1) * hh, y = (j + 1) * hh;
    ustar[j * N + i] = 16 * x * (1 - x) * y * (1 - y) + 0.3 * Math.sin(4 * Math.PI * x) * Math.sin(3 * Math.PI * y);
  }
  applyA(N, ustar, b);
  return { ustar, b, nb: norm(b) };
}
/** (Au)ᵢⱼ = 4uᵢⱼ − (four neighbours), with u = 0 on the boundary. */
function applyA(N, u, out) {
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    out[k] = 4 * u[k] - (i > 0 ? u[k - 1] : 0) - (i < N - 1 ? u[k + 1] : 0) - (j > 0 ? u[k - N] : 0) - (j < N - 1 ? u[k + N] : 0);
  }
}
const norm = (v) => { let s = 0; for (const x of v) s += x * x; return Math.sqrt(s); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** A solver as a state machine: step() does one iteration, res() reports. */
function solver(kind, N, prob, omega) {
  const n = N * N, u = new Float64Array(n), tmp = new Float64Array(n), Au = new Float64Array(n);
  const { b } = prob;
  const nbr = (v, k, i, j) => (i > 0 ? v[k - 1] : 0) + (i < N - 1 ? v[k + 1] : 0) + (j > 0 ? v[k - N] : 0) + (j < N - 1 ? v[k + N] : 0);
  let r, p, rr;
  if (kind === "cg") { r = Float64Array.from(b); p = Float64Array.from(b); rr = dot(r, r); }
  const res = () => {
    if (kind === "cg") return Math.sqrt(rr) / prob.nb;
    applyA(N, u, Au);
    let s = 0;
    for (let k = 0; k < n; k++) s += (b[k] - Au[k]) ** 2;
    return Math.sqrt(s) / prob.nb;
  };
  const step = () => {
    if (kind === "jacobi") {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; tmp[k] = (b[k] + nbr(u, k, i, j)) / 4; }
      u.set(tmp);
    } else if (kind === "gs" || kind === "sor") {
      const w = kind === "sor" ? omega : 1;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i, gs = (b[k] + nbr(u, k, i, j)) / 4;
        u[k] += w * (gs - u[k]);
      }
    } else {
      applyA(N, p, Au);
      const alpha = rr / dot(p, Au);
      for (let k = 0; k < n; k++) { u[k] += alpha * p[k]; r[k] -= alpha * Au[k]; }
      const rr2 = dot(r, r);
      for (let k = 0; k < n; k++) p[k] = r[k] + (rr2 / rr) * p[k];
      rr = rr2;
    }
  };
  return { u, step, res };
}

const POISSON = [
  { key: "jacobi", label: "Jacobi", color: C.j, out: "jac" },
  { key: "gs", label: "G–S", color: C.out, out: "gs" },
  { key: "sor", label: "SOR", color: C.v, out: "sor" },
  { key: "cg", label: "CG", color: C.u, out: "cg" },
];
const CAP = 20000;

for (const root of document.querySelectorAll("[data-numx-poisson]")) {
  const fsvg = plot(root, "field"), rsvg = plot(root, "res"), o = outs(root);
  const btn = root.querySelector("[data-action=play]"), setPlay = playButton(btn);
  let N = 0, prob = null, curves = {}, sel = "jacobi", live = null, it = 0, raf = 0, cells = [];
  // ω follows the optimum when N changes, unless the reader moved it away.
  const optimal = (n) => 2 / (1 + Math.sin(Math.PI / (n + 1)));
  const s = scrubAll(root, batched(() => {
    stop();
    const n = Math.round(s.N.get());
    if (N && n !== N && Math.abs(s.omega.get() - optimal(N)) < 0.006) s.omega.set(optimal(n), false);
    setup();
  }));
  onSeg(root, (_, v) => { sel = v; resetLive(); drawRes(); drawField(); });
  root.querySelector("[data-action=optimal]").addEventListener("click", () => {
    s.omega.set(optimal(Math.round(s.N.get())));
  });

  function setup() {
    N = Math.round(s.N.get());
    const omega = s.omega.get();
    prob = poissonProblem(N);
    curves = {};
    for (const m of POISSON) {
      const S = solver(m.key, N, prob, omega), hist = [1];
      let k = 0;
      while (k < CAP && hist.at(-1) > 1e-8) { S.step(); k++; hist.push(S.res()); }
      curves[m.key] = hist;
      o[m.out].textContent = hist.at(-1) <= 1e-8 ? (k).toLocaleString("en-US") : `> ${CAP.toLocaleString("en-US")}`;
    }
    o.rho.textContent = fx(Math.cos(Math.PI / (N + 1)), 5);
    // The heat map cells, built once per grid size.
    fsvg.replaceChildren();
    const size = 220 / N;
    cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cells.push(el("rect", { x: 10 + i * size, y: 10 + (N - 1 - j) * size, width: size + 0.2, height: size + 0.2 }, fsvg));
    fsvg.__label = text(fsvg, 10, 238, "");
    resetLive();
    drawRes();
    drawField();
  }
  function resetLive() {
    live = solver(sel, N, prob, s.omega.get());
    it = 0;
    o.it.textContent = "0";
  }
  function drawField() {
    let mx = 0;
    const e = new Float64Array(N * N);
    for (let k = 0; k < e.length; k++) { e[k] = live.u[k] - prob.ustar[k]; mx = Math.max(mx, Math.abs(e[k])); }
    for (let k = 0; k < cells.length; k++) {
      const v = mx > 0 ? e[k] / mx : 0;
      cells[k].setAttribute("style", `fill:${v >= 0 ? C.u : C.j};fill-opacity:${(Math.abs(v) ** 0.7 * 0.9).toFixed(3)}`);
    }
    fsvg.__label.textContent = `error, scaled to its max ${sci(mx, 1)}`;
  }
  function drawRes() {
    rsvg.replaceChildren();
    const f = logFrame(rsvg, { box: [44, 10, 236, 200], x: [0, Math.log10(CAP)], y: [-10, 0], xlabel: "iteration", ylabel: "‖r‖ / ‖b‖", xticks: [0, 1, 2, 3, 4] });
    const g = clipped(rsvg, f);
    const ends = [];
    for (const m of POISSON) {
      const hist = curves[m.key], pts = [];
      let lastK = -1;
      for (let q = 0; q <= 300; q++) {
        const k = Math.min(hist.length - 1, Math.round(10 ** ((q / 300) * Math.log10(hist.length))) - 1);
        if (k === lastK || k < 0) continue;
        lastK = k;
        pts.push([f.sx(Math.log10(k + 1)), f.sy(lg(hist[k], -10))]);
      }
      path(g, pts, `stroke:${m.color};stroke-width:${m.key === sel ? 2.25 : 1.5};stroke-opacity:${m.key === sel ? 1 : 0.7}`);
      ends.push({ y: pts.at(-1)[1], label: m.label, color: m.color });
    }
    endLabels(rsvg, f, ends, 10);
    el("line", { x1: f.sx(Math.log10(it + 1)), x2: f.sx(Math.log10(it + 1)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.7" }, rsvg);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; setPlay(false); }
  btn.addEventListener("click", () => {
    if (raf) return stop();
    const done = () => live.res() <= 1e-10 || it >= curves[sel].length + 50;
    if (done()) resetLive();
    setPlay(true);
    const tick = () => {
      const k = reduced() ? 50 : Math.max(1, Math.round(it * 0.03));
      for (let q = 0; q < k && !done(); q++) { live.step(); it++; }
      o.it.textContent = it.toLocaleString("en-US");
      drawField();
      drawRes();
      if (done()) return stop();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  setup();
}
