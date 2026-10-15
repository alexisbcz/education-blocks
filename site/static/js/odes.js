// Differential equations, blocks 1–5: the trace–determinant plane,
// nullclines and linearisation, one-dimensional bifurcations, the Hopf
// bifurcation, and forced oscillations.

import { scrubAll } from "./scrub.js";
import { parse, evaluate } from "./assess-expr.js";
import {
  el, text, frame, polyline, outs, plot, fx, minus, onSeg, selectSeg, C, clipped, ticks, path, rk4, solve,
  svgPoint, animator, batched, arrow, classify, eig2, fmtEig,
} from "./odes-util.js";

// ============================================================ 1 Trace–determinant

for (const root of document.querySelectorAll("[data-ode-tracedet]")) {
  const svg = plot(root), o = outs(root);
  const s = scrubAll(root, () => draw());
  const TR = [-4, 4], DET = [-3, 5];
  let pf = null;

  function draw() {
    const tr = s.tr.get(), det = s.det.get();
    svg.replaceChildren();

    // Left: the plane.
    const f = frame(svg, { box: [40, 20, 290, 290], x: TR, y: DET, xticks: ticks(-4, 4, 2), yticks: ticks(-2, 4, 2), xlabel: "trace τ", ylabel: "det Δ" });
    pf = f;
    const g = clipped(svg, f);
    el("rect", { x: f.L, y: f.sy(0), width: f.W, height: f.T + f.H - f.sy(0), style: "fill:var(--code-del);fill-opacity:0.06" }, g);
    const par = [];
    for (let k = 0; k <= 160; k++) { const t = TR[0] + (k / 160) * (TR[1] - TR[0]); par.push([f.sx(t), f.sy((t * t) / 4)]); }
    polyline(g, par, "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.25");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:var(--foreground);stroke-opacity:0.55" }, g);
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.sy(0), style: "stroke:var(--foreground);stroke-opacity:0.55;stroke-dasharray:3 3" }, g);
    const lab = (x, y, s, a = "middle") => text(g, f.sx(x), f.sy(y), s, { "text-anchor": a });
    lab(0, -1.8, "saddles");
    lab(-2.4, 4.4, "stable spirals");
    lab(2.4, 4.4, "unstable spirals");
    lab(-3.2, 1.6, "stable");
    lab(-3.2, 1.0, "nodes");
    lab(3.2, 1.6, "unstable");
    lab(3.2, 1.0, "nodes");
    text(g, f.sx(0) + 4, f.T + 12, "centres", { "text-anchor": "start" });
    text(g, f.sx(3.6), f.sy(3.6) - 4, "Δ = τ²/4", { "text-anchor": "end" });
    el("circle", { cx: f.sx(tr), cy: f.sy(det), r: 6, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);

    // Right: the phase portrait of the companion matrix A = [[0, 1], [−Δ, τ]].
    const a = 0, b = 1, c = -det, d = tr;
    const R = 3;
    const pp = frame(svg, { box: [410, 20, 290, 290], x: [-R, R], y: [-R, R], xticks: ticks(-3, 3, 1), yticks: ticks(-3, 3, 1), xlabel: "x", ylabel: "y = x′" });
    const pg = clipped(svg, pp);
    const F = (_, [x, y]) => [a * x + b * y, c * x + d * y];
    // A faint direction field.
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = (i / 6) * R * 0.95, y = (j / 6) * R * 0.95;
      const [u, v] = F(0, [x, y]);
      const n = Math.hypot(u, v);
      if (n < 1e-9) continue;
      const L = 0.16;
      el("line", { x1: pp.sx(x), y1: pp.sy(y), x2: pp.sx(x + (u / n) * L), y2: pp.sy(y + (v / n) * L), style: "stroke:var(--foreground);stroke-opacity:0.18" }, pg);
    }
    // Eigenvector lines when the eigenvalues are real.
    const ev = eig2(a, b, c, d);
    if (ev[0].im === 0 && Math.abs(det) > 1e-9) {
      for (const e of ev) {
        const vx = 1, vy = e.re, n = Math.hypot(vx, vy);
        el("line", { x1: pp.sx((-vx / n) * 5), y1: pp.sy((-vy / n) * 5), x2: pp.sx((vx / n) * 5), y2: pp.sy((vy / n) * 5), style: `stroke:${C.i};stroke-width:1.5;stroke-opacity:0.8` }, pg);
      }
    }
    // Trajectories from seeds on a circle, forward and backward in time.
    const seeds = [];
    for (let k = 0; k < 16; k++) { const th = (k / 16) * 2 * Math.PI + 0.1; seeds.push([2.2 * Math.cos(th), 2.2 * Math.sin(th)]); }
    for (let k = 0; k < 6; k++) { const th = (k / 6) * 2 * Math.PI + 0.3; seeds.push([0.6 * Math.cos(th), 0.6 * Math.sin(th)]); }
    for (const p0 of seeds) {
      for (const dir of [1, -1]) {
        const pts = [[pp.sx(p0[0]), pp.sy(p0[1])]];
        let p = p0;
        for (let k = 0; k < 500; k++) {
          // Step by arc length so slow and fast regions both draw smoothly.
          const [u, v] = F(0, p), n = Math.hypot(u, v);
          if (n < 1e-6) break;
          const hstep = (dir * 0.03) / Math.max(n, 0.05);
          p = rk4(F, 0, p, hstep);
          if (Math.abs(p[0]) > 2 * R || Math.abs(p[1]) > 2 * R) break;
          pts.push([pp.sx(p[0]), pp.sy(p[1])]);
        }
        polyline(pg, pts, "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.1");
        if (dir === 1 && pts.length > 12) {
          const m = Math.floor(pts.length / 3);
          arrow(pg, pts[m - 1][0], pts[m - 1][1], pts[m][0], pts[m][1], "stroke:var(--foreground);stroke-opacity:0.7;stroke-width:1.1", 3.5);
        }
      }
    }
    el("circle", { cx: pp.sx(0), cy: pp.sy(0), r: 3, style: "fill:var(--foreground)" }, svg);

    const cl = classify(tr, det);
    const disc = tr * tr - 4 * det;
    o.mat.textContent = `[[0, 1], [${fx(-det, 2)}, ${fx(tr, 2)}]]`;
    o.eig.textContent = ev.map(fmtEig).join(", ");
    o.disc.textContent = fx(disc, 3);
    o.type.textContent = cl.type;
    const notes = {
      saddle: "Δ < 0: the eigenvalues are real with opposite signs. Two directions come in, two go out, so almost every trajectory leaves.",
      node: "Real eigenvalues of the same sign. Trajectories run in along the slow eigenvector and leave or arrive tangent to it.",
      spiral: "Complex eigenvalues α ± iβ: rotation at rate β, growth or decay at rate α = τ/2.",
      centre: "Purely imaginary eigenvalues: closed orbits, neither growing nor decaying. Any change to τ tips it into a spiral, which is why centres are fragile.",
      degenerate: "On the parabola τ² = 4Δ the eigenvalue is repeated and there is only one eigenvector line.",
      line: "Δ = 0: one eigenvalue is zero, so a whole line of equilibria.",
    };
    o.note.textContent = notes[cl.key];
    svg.setAttribute("aria-label", `Trace ${fx(tr, 2)}, determinant ${fx(det, 2)}: ${cl.type}`);
  }

  // Dragging and keys move the point; small snaps help land on τ = 0 and the parabola.
  const fromEvent = (e) => {
    const p = svgPoint(svg, e);
    if (!pf || p.x > pf.L + pf.W + 10) return;
    let tr = TR[0] + ((p.x - pf.L) / pf.W) * (TR[1] - TR[0]);
    let det = DET[0] + ((pf.T + pf.H - p.y) / pf.H) * (DET[1] - DET[0]);
    tr = Math.max(TR[0], Math.min(TR[1], tr));
    det = Math.max(DET[0], Math.min(DET[1], det));
    if (Math.abs(tr) < 0.08) tr = 0;
    if (Math.abs(det - (tr * tr) / 4) < 0.08) det = (tr * tr) / 4;
    s.tr.set(tr, false); s.det.set(det, false);
    draw();
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => { const p = svgPoint(svg, e); if (pf && p.x <= pf.L + pf.W + 10) { dragging = true; fromEvent(e); } });
  svg.addEventListener("pointermove", (e) => { if (dragging && e.buttons) fromEvent(e); else dragging = false; });
  window.addEventListener("pointerup", () => (dragging = false));
  svg.setAttribute("tabindex", "0");
  svg.classList.add("outline-none", "focus-visible:ring-[3px]", "focus-visible:ring-ring/50", "rounded-md", "cursor-crosshair");
  svg.addEventListener("keydown", (e) => {
    const st = e.shiftKey ? 0.05 : 0.25;
    const m = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
    if (!m) return;
    e.preventDefault();
    s.tr.set(s.tr.get() + m[0], false); s.det.set(s.det.get() + m[1], false);
    draw();
  });
  draw();
}

// ============================================================ 2 Nullclines

const NULL_PRESETS = {
  compete: { f: "x*(3 - x - 2*y)", g: "y*(2 - x - y)", box: [-0.4, 3.6, -0.4, 2.8], seeds: [[0.2, 0.15], [2.5, 2.4], [0.1, 2.5], [3.4, 0.1], [1.5, 0.3], [0.4, 1.6]],
    note: "Two species compete for one resource. The interior equilibrium is a saddle, so whichever species starts ahead wins: its stable manifold is the boundary between the two outcomes." },
  coexist: { f: "x*(1 - x - 0.5*y)", g: "y*(1 - y - 0.5*x)", box: [-0.1, 1.6, -0.1, 1.6], seeds: [[0.05, 0.05], [1.5, 1.5], [0.05, 1.4], [1.4, 0.05], [0.9, 0.2]],
    note: "Each species limits itself more than it limits the other, so the interior equilibrium is a stable node: every population with both species present ends at (2/3, 2/3)." },
  pendulum: { f: "y", g: "-sin(x) - 0.3*y", box: [-7, 7, -4, 4], seeds: [[-6.5, 3.6], [-6.5, 2.6], [6.5, -3.6], [0.5, 0], [-5, 0.2], [2.5, 3.5]],
    note: "x is the angle, y the angular velocity. Hanging down (x = 0, ±2π) is a stable spiral; balancing upright (x = ±π) is a saddle." },
};

for (const root of document.querySelectorAll("[data-ode-nullcline]")) {
  const svg = plot(root), o = outs(root);
  const inF = root.querySelector('[data-expr="f"]'), inG = root.querySelector('[data-expr="g"]');
  let preset = "compete", box = NULL_PRESETS.compete.box, f = null, g = null;
  let trajs = [];
  let fr = null;

  function compile() {
    o.err.textContent = "";
    for (const inp of [inF, inG]) inp.removeAttribute("aria-invalid");
    try {
      const tf = parse(inF.value, ["x", "y"]);
      try {
        const tg = parse(inG.value, ["x", "y"]);
        f = (x, y) => evaluate(tf, { x, y });
        g = (x, y) => evaluate(tg, { x, y });
        return true;
      } catch (err) { inG.setAttribute("aria-invalid", "true"); o.err.textContent = `g: ${err.message}`; }
    } catch (err) { inF.setAttribute("aria-invalid", "true"); o.err.textContent = `f: ${err.message}`; }
    return false;
  }

  const F = (_, [x, y]) => [f(x, y), g(x, y)];

  function trajectory(p0) {
    const out = [];
    const [x0, x1, y0, y1] = box, span = Math.max(x1 - x0, y1 - y0);
    for (const dir of [-1, 1]) {
      const pts = [p0];
      let p = p0;
      for (let k = 0; k < 1500; k++) {
        const [u, v] = F(0, p), n = Math.hypot(u, v);
        if (!Number.isFinite(n) || n < 1e-7) break;
        p = rk4(F, 0, p, (dir * 0.006 * span) / Math.max(n, 0.02 * span));
        if (p[0] < x0 - span || p[0] > x1 + span || p[1] < y0 - span || p[1] > y1 + span) break;
        pts.push(p);
      }
      if (dir === -1) out.push(...pts.reverse()); else out.push(...pts.slice(1));
    }
    return out;
  }

  // Equilibria by Newton's method from a grid of starting points.
  function equilibria() {
    const [x0, x1, y0, y1] = box, found = [];
    const hx = 1e-6 * Math.max(1, x1 - x0);
    const J = (x, y) => [
      (f(x + hx, y) - f(x - hx, y)) / (2 * hx), (f(x, y + hx) - f(x, y - hx)) / (2 * hx),
      (g(x + hx, y) - g(x - hx, y)) / (2 * hx), (g(x, y + hx) - g(x, y - hx)) / (2 * hx),
    ];
    for (let i = 0; i <= 14; i++) for (let j = 0; j <= 14; j++) {
      let x = x0 + ((x1 - x0) * i) / 14, y = y0 + ((y1 - y0) * j) / 14;
      for (let it = 0; it < 60; it++) {
        const fv = f(x, y), gv = g(x, y);
        if (!Number.isFinite(fv) || !Number.isFinite(gv)) break;
        if (Math.abs(fv) < 1e-13 && Math.abs(gv) < 1e-13) break;
        const [a, b, c, d] = J(x, y), det = a * d - b * c;
        if (Math.abs(det) < 1e-14) break;
        x -= (d * fv - b * gv) / det;
        y -= (-c * fv + a * gv) / det;
      }
      if (!(Math.abs(f(x, y)) < 1e-9 && Math.abs(g(x, y)) < 1e-9)) continue;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const tol = 1e-5 * Math.max(x1 - x0, y1 - y0);
      if (found.some((q) => Math.abs(q.x - x) < tol && Math.abs(q.y - y) < tol)) continue;
      const [a, b, c, d] = J(x, y);
      found.push({ x: Math.abs(x) < 1e-10 ? 0 : x, y: Math.abs(y) < 1e-10 ? 0 : y, J: [a, b, c, d], cl: classify(a + d, a * d - b * c, 1e-7) });
    }
    return found.sort((p, q) => p.x - q.x || p.y - q.y);
  }

  // Marching squares for the zero set of h on the plot grid.
  function zeroSet(h, gEl, color) {
    // The grid is offset by a fraction of a cell so that no sample lands
    // exactly on a zero line such as x = 0.
    const [x0, x1, y0, y1] = box, nx = 320, ny = 240;
    const X = (i) => x0 + ((x1 - x0) * (i - 0.5 + 0.0137)) / nx, Y = (j) => y0 + ((y1 - y0) * (j - 0.5 + 0.0219)) / ny;
    const v = [];
    for (let j = 0; j <= ny + 1; j++) { const row = []; for (let i = 0; i <= nx + 1; i++) row.push(h(X(i), Y(j))); v.push(row); }
    let d = "";
    const lerp = (a, b, va, vb) => a + ((b - a) * va) / (va - vb);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const a = v[j][i], b = v[j][i + 1], c = v[j + 1][i + 1], e = v[j + 1][i];
      if (![a, b, c, e].every(Number.isFinite)) continue;
      const pts = [];
      if ((a > 0) !== (b > 0)) pts.push([lerp(X(i), X(i + 1), a, b), Y(j)]);
      if ((b > 0) !== (c > 0)) pts.push([X(i + 1), lerp(Y(j), Y(j + 1), b, c)]);
      if ((c > 0) !== (e > 0)) pts.push([lerp(X(i + 1), X(i), c, e), Y(j + 1)]);
      if ((e > 0) !== (a > 0)) pts.push([X(i), lerp(Y(j + 1), Y(j), e, a)]);
      // Four crossings means two zero lines cross inside the cell: draw an X.
      if (pts.length === 4) pts.splice(0, 4, pts[0], pts[2], pts[1], pts[3]);
      for (let k = 0; k + 1 < pts.length; k += 2) {
        d += `M${fr.sx(pts[k][0]).toFixed(1)},${fr.sy(pts[k][1]).toFixed(1)}L${fr.sx(pts[k + 1][0]).toFixed(1)},${fr.sy(pts[k + 1][1]).toFixed(1)}`;
      }
    }
    el("path", { d, style: `fill:none;stroke:${color};stroke-width:2;stroke-linecap:round` }, gEl);
  }

  function draw() {
    svg.replaceChildren();
    const [x0, x1, y0, y1] = box;
    const step = (a, b) => { const s = (b - a) / 5; const p = 10 ** Math.floor(Math.log10(s)); return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= s); };
    fr = frame(svg, { box: [44, 20, 496, 346], x: [x0, x1], y: [y0, y1], xticks: ticks(x0, x1, step(x0, x1)), yticks: ticks(y0, y1, step(y0, y1)), xfmt: (v) => minus(v), yfmt: (v) => minus(v), xlabel: "x", ylabel: "y" });
    const gEl = clipped(svg, fr);
    if (!f) { o.eqs.replaceChildren(); return; }
    // Direction field.
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 12; j++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / 17, y = y0 + ((y1 - y0) * (j + 0.5)) / 13;
      const u = f(x, y), v = g(x, y);
      const du = (u / (x1 - x0)) * fr.W, dv = (v / (y1 - y0)) * fr.H, n = Math.hypot(du, dv);
      if (!(n > 1e-9)) continue;
      const L = 9, cx = fr.sx(x), cy = fr.sy(y);
      arrow(gEl, cx - ((du / n) * L) / 2, cy + ((dv / n) * L) / 2, cx + ((du / n) * L) / 2, cy - ((dv / n) * L) / 2, "stroke:var(--foreground);stroke-opacity:0.22", 2.5);
    }
    zeroSet(f, gEl, C.j);
    zeroSet(g, gEl, C.u);
    for (const t of trajs) {
      const pts = t.map((p) => [fr.sx(p[0]), fr.sy(p[1])]);
      path(gEl, pts, "stroke:var(--brand);stroke-width:1.5");
      const m = Math.min(pts.length - 1, Math.max(1, Math.floor(pts.length * 0.55)));
      if (pts.length > 4) arrow(gEl, pts[m - 1][0], pts[m - 1][1], pts[m][0], pts[m][1], "stroke:var(--brand);stroke-width:1.5", 4);
    }
    const eqs = equilibria();
    for (const q of eqs) {
      const stable = /\(stable\)/.test(q.cl.type);
      el("circle", { cx: fr.sx(q.x), cy: fr.sy(q.y), r: 5, style: `fill:${stable ? "var(--foreground)" : "var(--background)"};stroke:var(--foreground);stroke-width:1.75` }, svg);
    }
    o.eqs.replaceChildren(...(eqs.length ? eqs : [null]).map((q) => {
      const row = document.createElement("div");
      row.className = "flex flex-col gap-0.5";
      if (!q) { row.textContent = "No equilibrium in view."; return row; }
      const head = document.createElement("span");
      head.textContent = `(${fx(q.x, 3)}, ${fx(q.y, 3)}) → ${q.cl.type}`;
      const sub = document.createElement("span");
      sub.className = "text-muted-foreground";
      const [a, b, c, d] = q.J;
      sub.textContent = `J = [[${fx(a, 2)}, ${fx(b, 2)}], [${fx(c, 2)}, ${fx(d, 2)}]]  τ ${fx(a + d, 2)}  Δ ${fx(a * d - b * c, 2)}`;
      row.append(head, sub);
      return row;
    }));
    svg.setAttribute("aria-label", `Phase plane with ${eqs.length} equilibria: ${eqs.map((q) => `(${fx(q.x, 2)}, ${fx(q.y, 2)}) ${q.cl.type}`).join("; ")}`);
  }

  function load(name) {
    preset = name;
    const p = NULL_PRESETS[name];
    if (p) { inF.value = p.f; inG.value = p.g; box = p.box; }
    else box = [-4, 4, -4, 4];
    o.note.textContent = p ? p.note : "Type any f and g in x and y (sin, cos, exp, sqrt, abs, ^). Filled dots are stable, hollow dots unstable. On a boundary of the trace–determinant plane (a centre, for instance) linearisation alone cannot decide.";
    trajs = [];
    if (compile()) { if (p) trajs = p.seeds.map(trajectory); draw(); }
  }

  onSeg(root, (_, v) => load(v));
  const recompute = batched(() => {
    if (preset !== "own") { preset = "own"; selectSeg(root, "Preset", "own"); box = [-4, 4, -4, 4]; o.note.textContent = "Your own system on −4 ≤ x, y ≤ 4. Filled dots are stable, hollow dots unstable."; }
    trajs = [];
    if (compile()) draw();
  });
  inF.addEventListener("input", recompute);
  inG.addEventListener("input", recompute);
  root.querySelector('[data-action="clear"]').addEventListener("click", () => { trajs = []; draw(); });
  svg.classList.add("cursor-crosshair");
  svg.addEventListener("click", (e) => {
    if (!f || !fr) return;
    const p = svgPoint(svg, e);
    if (p.x < fr.L || p.x > fr.L + fr.W || p.y < fr.T || p.y > fr.T + fr.H) return;
    const [x0, x1, y0, y1] = box;
    const x = x0 + ((p.x - fr.L) / fr.W) * (x1 - x0), y = y0 + ((fr.T + fr.H - p.y) / fr.H) * (y1 - y0);
    trajs.push(trajectory([x, y]));
    if (trajs.length > 14) trajs.shift();
    draw();
  });
  load("compete");
}

// ============================================================ 3 Bifurcations

const BIF = {
  sn: {
    eq: "x′ = r + x²", f: (x, r) => r + x * x, fp: (x) => 2 * x,
    branches: [(r) => (r <= 0 ? -Math.sqrt(-r) : NaN), (r) => (r <= 0 ? Math.sqrt(-r) : NaN)],
    note: "Saddle-node: for r < 0 a stable and an unstable equilibrium sit at ∓√(−r). They collide at r = 0 and vanish; past it nothing holds x back.",
  },
  tc: {
    eq: "x′ = rx − x²", f: (x, r) => r * x - x * x, fp: (x, r) => r - 2 * x,
    branches: [() => 0, (r) => r],
    note: "Transcritical: the equilibria x = 0 and x = r cross at r = 0 and swap stability. Neither disappears.",
  },
  pf: {
    eq: "x′ = rx − x³", f: (x, r) => r * x - x ** 3, fp: (x, r) => r - 3 * x * x,
    branches: [() => 0, (r) => (r >= 0 ? Math.sqrt(r) : NaN), (r) => (r >= 0 ? -Math.sqrt(r) : NaN)],
    note: "Supercritical pitchfork: the origin loses stability at r = 0 and hands it to two symmetric branches ±√r. The change is gentle: the new states start at zero.",
  },
  sub: {
    eq: "x′ = rx + x³ − x⁵", f: (x, r) => r * x + x ** 3 - x ** 5, fp: (x, r) => r + 3 * x * x - 5 * x ** 4,
    branches: [
      () => 0,
      ...[1, -1].flatMap((sgn) => [
        (r) => { const q = (1 + Math.sqrt(1 + 4 * r)) / 2; return r >= -0.25 ? sgn * Math.sqrt(q) : NaN; },
        (r) => { const q = (1 - Math.sqrt(1 + 4 * r)) / 2; return r >= -0.25 && r <= 0 ? sgn * Math.sqrt(q) : NaN; },
      ]),
    ],
    note: "Subcritical pitchfork with a quintic to cap it: between r = −¼ and 0 the origin and two large states are all stable. Press Play: the state jumps when the origin fails at r = 0 and only falls back at r = −¼. That lag is hysteresis.",
  },
};

for (const root of document.querySelectorAll("[data-ode-bif]")) {
  const svg = plot(root), o = outs(root);
  let kind = "sn", state = -1.2, dirR = 1;
  const s = scrubAll(root, () => { draw(); });
  const anim = animator(root, root.querySelector('[data-action="play"]'), (dt) => {
    let r = s.r.get() + dirR * 0.35 * dt;
    if (r > 1.9) { r = 1.9; dirR = -1; }
    if (r < -1.9) { r = -1.9; dirR = 1; }
    s.r.set(r, false);
    // The state follows the flow quickly (fast dynamics, slow parameter).
    const B = BIF[kind];
    for (let k = 0; k < 40; k++) {
      state += (dt / 4) * B.f(state, r) * 10;
      state = Math.max(-2.4, Math.min(2.4, state));
    }
    draw();
  });

  function draw() {
    const B = BIF[kind], r = s.r.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 20, 470, 286], x: [-2, 2], y: [-2, 2], xticks: ticks(-2, 2, 1), yticks: ticks(-2, 2, 1), xfmt: minus, yfmt: minus, xlabel: "r", ylabel: "equilibrium x*" });
    const g = clipped(svg, f);
    const N = 600;
    for (const br of B.branches) {
      let run = [], st = null;
      const flush = () => {
        if (run.length > 1) polyline(g, run, `stroke:${st ? C.v : C.j};stroke-width:2.25;${st ? "" : "stroke-dasharray:5 4"}`);
        run = [];
      };
      for (let k = 0; k <= N; k++) {
        const rr = -2 + (4 * k) / N, x = br(rr);
        if (!Number.isFinite(x)) { flush(); st = null; continue; }
        const stable = B.fp(x, rr) < 0;
        if (st !== null && stable !== st) { const last = run.at(-1); flush(); if (last) run.push(last); }
        st = stable;
        run.push([f.sx(rr), f.sy(x)]);
      }
      flush();
    }
    el("line", { x1: f.sx(r), x2: f.sx(r), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5;stroke-opacity:0.8" }, g);
    if (anim.playing) el("circle", { cx: f.sx(r), cy: f.sy(state), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);

    // The phase line at the current r.
    const X = 580;
    text(svg, X, 14, `phase line, r = ${fx(r, 2)}`, { "text-anchor": "middle" });
    el("line", { x1: X, x2: X, y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.5" }, svg);
    const eqs = B.branches.map((br) => br(r)).filter((x) => Number.isFinite(x) && Math.abs(x) <= 2)
      .sort((a, b) => a - b).filter((x, i, a) => i === 0 || Math.abs(x - a[i - 1]) > 1e-9);
    const cuts = [-2.05, ...eqs, 2.05];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const lo = cuts[i], hi = cuts[i + 1], mid = (lo + hi) / 2;
      if (f.sy(lo) - f.sy(hi) < 16) continue;
      const up = B.f(mid, r) > 0, y = f.sy(mid);
      arrow(svg, X, y + (up ? 6 : -6), X, y + (up ? -6 : 6), "stroke:var(--foreground);stroke-width:1.5", 4);
    }
    for (const x of eqs) {
      const fp = B.fp(x, r), stable = fp < 0;
      el("circle", { cx: X, cy: f.sy(x), r: 5, style: `fill:${stable ? C.v : "var(--background)"};stroke:${stable ? C.v : C.j};stroke-width:2` }, svg);
      text(svg, X + 10, f.sy(x) + 3, fx(x, 2), { "text-anchor": "start" });
    }
    o.eq.textContent = B.eq;
    o.eqs.textContent = eqs.length ? eqs.map((x) => fx(x, 3)).join(", ") : "none";
    const st = eqs.filter((x) => B.fp(x, r) < 0);
    o.stable.textContent = st.length ? st.map((x) => fx(x, 3)).join(", ") : "none";
    o.note.textContent = B.note;
    svg.setAttribute("aria-label", `${B.eq} at r = ${fx(r, 2)}: equilibria ${o.eqs.textContent}; stable ${o.stable.textContent}`);
  }

  onSeg(root, (_, v) => {
    kind = v;
    state = v === "sn" ? -1.2 : 0.01;
    draw();
  });
  draw();
}

// ============================================================ 4 Hopf

const HOPF = {
  normal: {
    eq: "x′ = μx − y − x(x²+y²), y′ = x + μy − y(x²+y²)",
    F: (mu) => (_, [x, y]) => { const q = x * x + y * y; return [mu * x - y - x * q, x + mu * y - y * q]; },
    R: 2.2, seeds: [[0.05, 0], [2.1, 0.6]], amp: [0, 2],
  },
  vdp: {
    eq: "x′ = y, y′ = μ(1 − x²)y − x",
    F: (mu) => (_, [x, y]) => [y, mu * (1 - x * x) * y - x],
    R: 3.4, seeds: [[0.1, 0], [3.2, 2.5]], amp: [0, 2.6],
  },
};

/** Integrates long enough to settle and measures amplitude and period. */
function settle(F, p0, T = 120, h = 0.01) {
  let p = p0, t = 0, amp = 0, cross = [];
  const n = Math.round(T / h);
  for (let k = 0; k < n; k++) {
    const q = rk4(F, t, p, h);
    t += h;
    if (!q.every(Number.isFinite) || Math.abs(q[0]) > 1e3) return { amp: NaN, period: NaN };
    if (t > T * 0.6) {
      amp = Math.max(amp, Math.abs(q[0]));
      // Upward crossings of x = 0, one per turn of the cycle.
      if (p[0] < 0 && q[0] >= 0) cross.push(t - (h * q[0]) / (q[0] - p[0]));
    }
    p = q;
  }
  const period = cross.length > 1 ? (cross.at(-1) - cross[0]) / (cross.length - 1) : NaN;
  return { amp, period, end: p };
}

for (const root of document.querySelectorAll("[data-ode-hopf]")) {
  const svg = plot(root), o = outs(root);
  let kind = "normal", head = 0, curve = null, cache = null;
  const s = scrubAll(root, () => { head = 0; draw(); });
  const anim = animator(root, root.querySelector('[data-action="play"]'), (dt) => { head += dt * 0.5; draw(); });

  function ampCurve() {
    const H = HOPF[kind], out = [];
    for (let k = 0; k <= 40; k++) {
      const mu = -1 + (4 * k) / 40;
      if (kind === "normal") { out.push([mu, mu > 0 ? Math.sqrt(mu) : 0]); continue; }
      const r = mu > 0 ? settle(H.F(mu), [0.5, 0], 80, 0.01) : { amp: 0 };
      out.push([mu, r.amp]);
    }
    return out;
  }

  function draw() {
    const H = HOPF[kind], mu = s.mu.get(), F = H.F(mu);
    svg.replaceChildren();
    const R = H.R;
    const f = frame(svg, { box: [40, 20, 300, 300], x: [-R, R], y: [-R, R], xticks: ticks(-R, R, 1), yticks: ticks(-R, R, 1), xfmt: minus, yfmt: minus, xlabel: "x", ylabel: "y" });
    const g = clipped(svg, f);
    // Trajectories: the full path faint, the part reached so far in colour.
    const colors = [C.i, C.u];
    const key = `${kind}:${mu}`;
    if (!cache || cache.key !== key) {
      const res = settle(F, H.seeds[0], 140, 0.01);
      const per = Number.isFinite(res.period) ? res.period : 2 * Math.PI;
      cache = {
        key, res,
        sols: H.seeds.map((p0) => solve(F, 0, p0, 40, 4000, 50).map(([, p]) => p)),
        cyc: solve(F, 0, res.end ?? [0, 0], per * 1.02, 800).map(([, p]) => p),
      };
    }
    cache.sols.forEach((sol, i) => {
      const pts = sol.map((p) => [f.sx(p[0]), f.sy(p[1])]);
      polyline(g, pts, "stroke:var(--foreground);stroke-opacity:0.15;stroke-width:1");
      const upto = anim.playing ? Math.min(pts.length, Math.floor(((head % 1.2) / 1) * pts.length) + 2) : pts.length;
      polyline(g, pts.slice(0, upto), `stroke:${colors[i]};stroke-width:1.4;stroke-opacity:0.9`);
      el("circle", { cx: pts[0][0], cy: pts[0][1], r: 3, style: `fill:${colors[i]}` }, g);
    });
    const res = cache.res;
    const hasCycle = mu > 0.02 && Number.isFinite(res.amp) && res.amp > 0.05;
    // One period of the settled orbit is the limit cycle.
    if (hasCycle) polyline(g, cache.cyc.map((p) => [f.sx(p[0]), f.sy(p[1])]), "stroke:var(--brand);stroke-width:2.5");
    el("circle", { cx: f.sx(0), cy: f.sy(0), r: 3.5, style: `fill:${mu < 0 ? "var(--foreground)" : "var(--background)"};stroke:var(--foreground);stroke-width:1.5` }, svg);

    // Amplitude against μ.
    curve ??= ampCurve();
    const a = frame(svg, { box: [400, 20, 220, 300], x: [-1, 3], y: H.amp, xticks: ticks(-1, 3, 1), yticks: ticks(0, H.amp[1], 0.5), xfmt: minus, xlabel: "μ", ylabel: kind === "normal" ? "cycle radius" : "cycle amplitude" });
    const ag = clipped(svg, a);
    polyline(ag, curve.map(([m, v]) => [a.sx(m), a.sy(v)]), `stroke:${C.v};stroke-width:2`);
    el("line", { x1: a.sx(mu), x2: a.sx(mu), y1: a.T, y2: a.T + a.H, style: "stroke:var(--brand);stroke-opacity:0.7" }, ag);
    el("circle", { cx: a.sx(mu), cy: a.sy(hasCycle ? res.amp : 0), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);

    const tr = kind === "normal" ? 2 * mu : mu, det = 1;
    o.eq.textContent = H.eq;
    o.origin.textContent = classify(tr, det).type;
    o.amp.textContent = hasCycle ? fx(res.amp, 3) : "no cycle";
    o.theory.textContent = kind === "normal" ? (mu > 0 ? fx(Math.sqrt(mu), 3) : "—") : "≈ 2 for any μ > 0";
    o.period.textContent = hasCycle && Number.isFinite(res.period) ? `${fx(res.period, 3)}${kind === "normal" ? " (2π = 6.283)" : ""}` : "—";
    o.note.textContent = kind === "normal"
      ? (mu > 0 ? "μ > 0: the origin is an unstable spiral and both trajectories wind onto the circle of radius √μ, one from inside, one from outside." : "μ ≤ 0: the origin is a stable spiral (a weak one at μ = 0) and there is no cycle. Push μ past 0 to see the cycle appear at zero size and grow like √μ.")
      : (mu > 0 ? "Van der Pol: for small μ the cycle is nearly a circle of radius 2; for large μ it becomes a relaxation oscillation, slow drifts and fast jumps, and the period grows (about (3 − 2 ln 2)μ for large μ)." : "μ ≤ 0: the origin is stable. The Van der Pol cycle does not grow from zero here: for μ < 0 it still exists but is unstable, and trajectories from outside it run away.");
    svg.setAttribute("aria-label", `μ = ${fx(mu, 2)}: origin ${o.origin.textContent}, cycle ${o.amp.textContent}`);
  }

  onSeg(root, (_, v) => { kind = v; curve = null; head = 0; draw(); });
  draw();
}

// ============================================================ 5 Resonance

for (const root of document.querySelectorAll("[data-ode-res]")) {
  const svg = plot(root), o = outs(root);
  const s = scrubAll(root, batched(() => draw()));
  const gain = (w, z) => 1 / Math.sqrt((1 - w * w) ** 2 + (2 * z * w) ** 2);
  const lag = (w, z) => Math.atan2(2 * z * w, 1 - w * w);

  function draw() {
    const z = s.zeta.get(), w = s.w.get();
    svg.replaceChildren();
    const YMAX = 6;
    const A = frame(svg, { box: [48, 20, 270, 160], x: [0, 3], y: [0, YMAX], xticks: ticks(0, 3, 0.5), yticks: ticks(0, YMAX, 2), xlabel: "ω / ω₀", ylabel: "amplitude × ω₀²" });
    const ag = clipped(svg, A);
    const N = 300;
    for (const zz of [0.05, 0.2, 0.5, 1]) {
      polyline(ag, Array.from({ length: N + 1 }, (_, k) => { const ww = (3 * k) / N; return [A.sx(ww), A.sy(Math.min(YMAX * 2, gain(ww, zz)))]; }), "stroke:var(--foreground);stroke-opacity:0.2;stroke-width:1");
    }
    polyline(ag, Array.from({ length: N + 1 }, (_, k) => { const ww = (3 * k) / N; return [A.sx(ww), A.sy(Math.min(YMAX * 2, gain(ww, z)))]; }), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: A.sx(w), x2: A.sx(w), y1: A.T, y2: A.T + A.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 3" }, ag);
    const G = gain(w, z);
    if (Number.isFinite(G) && G < YMAX) el("circle", { cx: A.sx(w), cy: A.sy(G), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);

    const P = frame(svg, { box: [48, 222, 270, 120], x: [0, 3], y: [0, 180], xticks: ticks(0, 3, 0.5), yticks: [0, 90, 180], yfmt: (v) => `${v}°`, xlabel: "ω / ω₀", ylabel: "phase lag" });
    const pg = clipped(svg, P);
    for (const zz of [0.05, 0.2, 0.5, 1]) {
      polyline(pg, Array.from({ length: N + 1 }, (_, k) => { const ww = (3 * k) / N; return [P.sx(ww), P.sy((lag(ww, zz) * 180) / Math.PI)]; }), "stroke:var(--foreground);stroke-opacity:0.2;stroke-width:1");
    }
    polyline(pg, Array.from({ length: N + 1 }, (_, k) => { const ww = (3 * k) / N; return [P.sx(ww), P.sy((lag(ww, z) * 180) / Math.PI)]; }), "stroke:var(--brand);stroke-width:2");
    el("circle", { cx: P.sx(w), cy: P.sy((lag(w, z) * 180) / Math.PI), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);

    // Time response from rest: total by RK4, steady state exactly, transient the difference.
    const T = 80, h = 0.02, n = Math.round(T / h);
    const F = (t, [x, v]) => [v, Math.cos(w * t) - 2 * z * v - x];
    const resonantUndamped = z === 0 && Math.abs(w - 1) < 1e-9;
    const phi = lag(w, z);
    const ss = (t) => (resonantUndamped ? NaN : G * Math.cos(w * t - phi));
    let p = [0, 0];
    const tot = [[0, 0]];
    for (let k = 1; k <= n; k++) { p = rk4(F, (k - 1) * h, p, h); tot.push([k * h, p[0]]); }
    let ymax = 0;
    for (const [, x] of tot) ymax = Math.max(ymax, Math.abs(x));
    if (!resonantUndamped) ymax = Math.max(ymax, G);
    ymax = Math.max(0.5, ymax * 1.1);
    const step = ymax > 8 ? 5 : ymax > 3 ? 2 : ymax > 1.2 ? 1 : 0.5;
    const R = frame(svg, { box: [380, 20, 320, 322], x: [0, T], y: [-ymax, ymax], xticks: ticks(0, T, 20), yticks: ticks(-ymax, ymax, step), yfmt: minus, xlabel: "t ω₀", ylabel: "x(t)" });
    const rg = clipped(svg, R);
    if (!resonantUndamped) {
      polyline(rg, tot.filter((_, k) => k % 2 === 0).map(([t]) => [R.sx(t), R.sy(ss(t))]), `stroke:${C.v};stroke-width:1.25;stroke-opacity:0.85`);
      polyline(rg, tot.filter((_, k) => k % 2 === 0).map(([t, x]) => [R.sx(t), R.sy(x - ss(t))]), `stroke:${C.u};stroke-width:1.25;stroke-opacity:0.85`);
    }
    polyline(rg, tot.filter((_, k) => k % 2 === 0).map(([t, x]) => [R.sx(t), R.sy(x)]), "stroke:var(--brand);stroke-width:1.75");

    const zc = 1 / Math.SQRT2;
    o.amp.textContent = resonantUndamped ? "unbounded (grows like t/2)" : `${fx(G, 3)} × F/ω₀²`;
    o.phase.textContent = `${fx((phi * 180) / Math.PI, 1)}°`;
    o.peak.textContent = z < zc ? fx(Math.sqrt(1 - 2 * z * z), 4) : "none (ζ ≥ 1/√2)";
    o.gain.textContent = z === 0 ? "∞" : z < zc ? fx(1 / (2 * z * Math.sqrt(1 - z * z)), 3) : "1 (at ω = 0)";
    o.decay.textContent = z > 0 ? `${fx(1 / z, 1)} / ω₀` : "never";
    let note;
    if (resonantUndamped) note = "Undamped and driven exactly at ω₀: no steady state exists. The response is t·sin(t)/2 and grows without bound.";
    else if (z === 0) note = `Undamped: the transient never dies, and it beats against the steady state at the difference frequency |ω − ω₀| = ${fx(Math.abs(w - 1), 2)}, a beat period of ${fx((2 * Math.PI) / Math.abs(w - 1), 1)}.`;
    else note = `The transient (initial conditions minus the steady state) decays like e^(−ζω₀t); after a few multiples of ${fx(1 / z, 1)} only the steady state at the driving frequency is left.`;
    o.note.textContent = note;
    svg.setAttribute("aria-label", `ζ ${fx(z, 2)}, ω ${fx(w, 2)}: amplitude ${o.amp.textContent}, lag ${o.phase.textContent}`);
  }
  draw();
}
