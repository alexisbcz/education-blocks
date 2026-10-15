// Game theory blocks, part two: replicator dynamics on the simplex and
// first- versus second-price auctions with independent uniform values.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { Q, Q0, Q1, solve, outs, reduced, minus, payoffTable, mulberry32 } from "./gametheory-util.js";

// ============================================================ Replicator dynamics

const REP_GAMES = {
  rps: { names: ["Rock", "Paper", "Scissors"], A: [[0, -1, 1], [1, 0, -1], [-1, 1, 0]],
    seeds: [[0.5, 0.3, 0.2], [0.7, 0.2, 0.1], [0.4, 0.35, 0.25]],
    note: "Zero-sum RPS keeps x₁x₂x₃ constant: every orbit is a closed loop around the centre. Make a win worth more than a loss costs and the centre attracts; the other way round and populations spiral out towards the edges." },
  hdb: { names: ["Hawk", "Dove", "Bourgeois"], A: [[-2, 4, 1], [0, 2, 1], [-1, 3, 2]],
    seeds: [[0.45, 0.45, 0.1], [0.2, 0.7, 0.1], [0.6, 0.3, 0.1], [0.3, 0.3, 0.4]],
    note: "Maynard Smith's Hawk–Dove with V = 2, C = 4, payoffs doubled. Bourgeois plays Hawk as owner and Dove as intruder: a convention that respects property, and the only ESS here." },
  coord: { names: ["A", "B", "C"], A: [[1, 0, 0], [0, 2, 0], [0, 0, 3]],
    seeds: [[0.5, 0.3, 0.2], [0.2, 0.6, 0.2], [0.7, 0.2, 0.1], [0.34, 0.33, 0.33]],
    note: "Pure coordination: every convention is an ESS. Where a population ends up depends on where it starts; the basins meet at unstable mixed rest points." },
};

const V = [[280, 34], [44, 442], [516, 442]];
const toXY = (x) => [x[0] * V[0][0] + x[1] * V[1][0] + x[2] * V[2][0], x[0] * V[0][1] + x[1] * V[1][1] + x[2] * V[2][1]];
function toBary([px, py]) {
  const [[x1, y1], [x2, y2], [x3, y3]] = V;
  const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / det;
  const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / det;
  return [a, b, 1 - a - b];
}
const Ax = (A, x) => A.map((r) => r[0] * x[0] + r[1] * x[1] + r[2] * x[2]);
const field = (A, x) => {
  const f = Ax(A, x), avg = x[0] * f[0] + x[1] * f[1] + x[2] * f[2];
  return x.map((xi, i) => xi * (f[i] - avg));
};
function rk4(A, x, dt) {
  const add = (a, b, s) => a.map((v, i) => v + b[i] * s);
  const k1 = field(A, x), k2 = field(A, add(x, k1, dt / 2)), k3 = field(A, add(x, k2, dt / 2)), k4 = field(A, add(x, k3, dt));
  const y = x.map((v, i) => Math.max(0, v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])));
  const s = y[0] + y[1] + y[2];
  return y.map((v) => v / s);
}
function trajectory(A, x0, T = 60, dt = 0.02) {
  const pts = [x0];
  let x = x0;
  for (let t = 0; t < T / dt; t++) { x = rk4(A, x, dt); pts.push(x); }
  return pts;
}

/** Rest points: vertices, one per edge where two strategies tie, and the
 *  interior point where all three earn the same (exact). */
function restPoints(A) {
  const pts = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((x) => ({ x, kind: "vertex" }));
  const Aq = A.map((r) => r.map(Q.of));
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    // x_i A_i· = x_j... : x_i·Aii + x_j·Aij = x_i·Aji + x_j·Ajj with x_i + x_j = 1.
    const s = solve([[Aq[i][i].sub(Aq[j][i]), Aq[i][j].sub(Aq[j][j])], [Q1, Q1]], [Q0, Q1]);
    if (s && s.every((q) => q.sign() > 0)) {
      const x = [0, 0, 0]; x[i] = s[0].toNumber(); x[j] = s[1].toNumber();
      pts.push({ x, kind: "edge" });
    }
  }
  const M = [
    [Aq[0][0].sub(Aq[1][0]), Aq[0][1].sub(Aq[1][1]), Aq[0][2].sub(Aq[1][2])],
    [Aq[1][0].sub(Aq[2][0]), Aq[1][1].sub(Aq[2][1]), Aq[1][2].sub(Aq[2][2])],
    [Q1, Q1, Q1],
  ];
  const s = solve(M, [Q0, Q0, Q1]);
  let interior = null;
  if (s && s.every((q) => q.sign() > 0)) { interior = s; pts.push({ x: s.map((q) => q.toNumber()), kind: "interior", exact: s }); }
  return { pts, interior };
}

function jacobianEig(A, x) {
  // Coordinates (x1, x2) with x3 = 1 − x1 − x2; central differences.
  const g = (a, b) => { const f = field(A, [a, b, 1 - a - b]); return [f[0], f[1]]; };
  const e = 1e-6, [a, b] = x;
  const fa1 = g(a + e, b), fa0 = g(a - e, b), fb1 = g(a, b + e), fb0 = g(a, b - e);
  const J = [[(fa1[0] - fa0[0]) / (2 * e), (fb1[0] - fb0[0]) / (2 * e)], [(fa1[1] - fa0[1]) / (2 * e), (fb1[1] - fb0[1]) / (2 * e)]];
  const tr = J[0][0] + J[1][1], det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
  const disc = tr * tr - 4 * det;
  return { tr, det, complex: disc < -1e-9 * (1 + tr * tr) };
}

function essList(A, interior, names) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    let ess = true;
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      if (A[i][i] > A[j][i]) continue;
      if (A[i][i] === A[j][i] && A[i][j] > A[j][j]) continue;
      ess = false;
    }
    if (ess) out.push(names[i]);
  }
  if (interior) {
    const q = (u, v) => { let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += (u[i] * A[i][j] * v[j] + v[i] * A[i][j] * u[j]) / 2; return s; };
    const z1 = [1, -1, 0], z2 = [1, 0, -1];
    const m11 = q(z1, z1), m12 = q(z1, z2), m22 = q(z2, z2);
    if (m11 < -1e-12 && m11 * m22 - m12 * m12 > 1e-12) out.push("interior mix");
  }
  return out;
}

for (const root of document.querySelectorAll("[data-gt-replicator]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const playBtn = root.querySelector("[data-action=play]");
  const playLabel = playBtn.querySelector("[data-label]");
  playLabel.textContent = "Play";
  let key = "rps", game, table, trajs = [], playing = false, raf = 0, t0 = 0;
  const layers = {};

  const load = (k) => {
    key = k; game = REP_GAMES[k];
    table = payoffTable(root.querySelector("[data-matrix]"), { rows: game.names, cols: game.names, pay: game.A, single: true, onChange: () => rebuild(true), rowLabel: "Payoff to" });
    rebuild(false);
  };
  function rebuild(keepStarts) {
    const A = table.get();
    const starts = keepStarts && trajs.length ? trajs.map((t) => t.pts[0]) : game.seeds;
    trajs = starts.map((x0) => ({ pts: trajectory(A, x0) }));
    drawStatic();
  }

  function drawStatic() {
    const A = table.get();
    svg.replaceChildren();
    // Triangle and labels.
    el("polygon", { points: V.map((p) => p.join(",")).join(" "), style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.35;stroke-width:1.25" }, svg);
    text(svg, V[0][0], V[0][1] - 12, `all ${game.names[0]}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    text(svg, V[1][0] - 2, V[1][1] + 20, `all ${game.names[1]}`, { "text-anchor": "start", class: "fill-foreground font-mono text-[11px]" });
    text(svg, V[2][0] + 2, V[2][1] + 20, `all ${game.names[2]}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    // Direction field.
    const g = el("g", { style: "stroke:var(--muted-foreground);stroke-width:1;fill:none" }, svg);
    const N = 14;
    let maxS = 0;
    const arrows = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) {
      const x = [(i + 0.33) / (N + 1), (j + 0.33) / (N + 1)];
      x.push(1 - x[0] - x[1]);
      if (x[2] <= 0.02) continue;
      const d = field(A, x);
      const p = toXY(x), q = toXY(x.map((v, k) => v + d[k]));
      const dx = q[0] - p[0], dy = q[1] - p[1], s = Math.hypot(dx, dy);
      maxS = Math.max(maxS, s);
      arrows.push({ p, dx, dy, s });
    }
    for (const a of arrows) {
      if (a.s < 1e-9) continue;
      const L = 7 + 5 * Math.sqrt(a.s / maxS), ux = a.dx / a.s, uy = a.dy / a.s;
      const [x, y] = a.p, ex = x + ux * L, ey = y + uy * L;
      el("path", { d: `M${(x - ux * L / 2).toFixed(1)},${(y - uy * L / 2).toFixed(1)}L${(ex - ux * L / 2).toFixed(1)},${(ey - uy * L / 2).toFixed(1)}m${(-ux * 3 + uy * 2).toFixed(1)},${(-uy * 3 - ux * 2).toFixed(1)}l${(ux * 3 - uy * 2).toFixed(1)},${(uy * 3 + ux * 2).toFixed(1)}l${(-ux * 3 - uy * 2).toFixed(1)},${(-uy * 3 + ux * 2).toFixed(1)}`, "stroke-opacity": (0.25 + 0.5 * Math.sqrt(a.s / maxS)).toFixed(2) }, g);
    }
    // Trajectories.
    layers.traj = el("g", {}, svg);
    for (const t of trajs) {
      polyline(layers.traj, t.pts.filter((_, i) => i % 4 === 0).map(toXY), "stroke:var(--brand);stroke-width:1.75;stroke-linejoin:round;stroke-opacity:0.85");
      const s = toXY(t.pts[0]);
      el("circle", { cx: s[0], cy: s[1], r: 3, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, layers.traj);
      t.dot = el("circle", { cx: s[0], cy: s[1], r: 4.5, style: "fill:var(--brand)", visibility: playing ? "visible" : "hidden" }, layers.traj);
    }
    // Rest points.
    const { pts, interior } = restPoints(A);
    for (const r of pts) {
      const [x, y] = toXY(r.x);
      el("circle", { cx: x, cy: y, r: r.kind === "interior" ? 5.5 : 4, style: `fill:${r.kind === "interior" ? "var(--vec-u)" : "var(--background)"};stroke:var(--vec-u);stroke-width:2` }, svg);
    }
    // Readouts.
    if (interior) {
      o.interior.textContent = `(${interior.map(String).join(", ")})`;
      const e = jacobianEig(A, interior.map((q) => q.toNumber()));
      const tol = 1e-7;
      o.stab.textContent = Math.abs(e.tr) < tol && e.det > 0 ? "neutral: closed orbits"
        : e.det < 0 ? "saddle: unstable"
        : e.tr < 0 ? (e.complex ? "stable spiral" : "stable node")
        : (e.complex ? "unstable spiral" : "unstable node");
    } else { o.interior.textContent = "none"; o.stab.textContent = "—"; }
    const ess = essList(A, interior, game.names);
    o.ess.textContent = ess.length ? ess.join(", ") : "none among the vertices and interior";
    const last = trajs.at(-1)?.pts.at(-1);
    if (last) { const f = Ax(A, last); o.fit.textContent = `${num(last[0] * f[0] + last[1] * f[1] + last[2] * f[2], 3)} at the end of the last run`; }
    root.querySelector("[data-note]")?.remove();
    svg.parentElement.append(Object.assign(document.createElement("p"), { className: "px-1 text-xs leading-relaxed text-muted-foreground", textContent: game.note }));
    svg.parentElement.lastChild.dataset.note = "";
  }

  // Click to add a trajectory.
  svg.addEventListener("click", (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = toBary([p.x, p.y]);
    if (x.some((v) => v < 0.005)) return;
    trajs.push({ pts: trajectory(table.get(), x) });
    if (trajs.length > 10) trajs.shift();
    drawStatic();
  });

  function frameLoop(ts) {
    if (!playing) return;
    if (!t0) t0 = ts;
    const k = Math.floor(((ts - t0) / 12) % 3000);
    for (const t of trajs) {
      const i = Math.min(t.pts.length - 1, k);
      const [x, y] = toXY(t.pts[i]);
      t.dot.setAttribute("cx", x.toFixed(1)); t.dot.setAttribute("cy", y.toFixed(1));
    }
    raf = requestAnimationFrame(frameLoop);
  }
  function setPlaying(on) {
    playing = on;
    playBtn.querySelector("[data-icon=play]").toggleAttribute("hidden", on);
    playBtn.querySelector("[data-icon=pause]").toggleAttribute("hidden", !on);
    playLabel.textContent = on ? "Pause" : "Play";
    for (const t of trajs) t.dot?.setAttribute("visibility", on ? "visible" : "hidden");
    cancelAnimationFrame(raf);
    t0 = 0;
    if (on) raf = requestAnimationFrame(frameLoop);
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=clear]").addEventListener("click", () => { trajs = []; drawStatic(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlaying(false); }).observe(root);
  root.addEventListener("seg-change", (e) => load(e.detail.value));
  void reduced;
  load("rps");
}

// ============================================================ Auctions

/** Expected profit of bid b with value v against n−1 rivals whose values are
 *  uniform on [0, 100]; first-price rivals bid (n−1)/n of their value. */
export const firstPriceProfit = (v, b, n) => {
  const c = ((n - 1) / n) * 100;
  return (v - b) * Math.min(1, Math.max(0, b / c)) ** (n - 1);
};
export const secondPriceProfit = (v, b, n) => {
  const B = Math.min(Math.max(b, 0), 100) / 100;
  return v * B ** (n - 1) - ((n - 1) / n) * 100 * B ** n;
};

for (const root of document.querySelectorAll("[data-gt-auction]")) {
  const [svgA, svgB] = root.querySelectorAll("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, (name) => { if (name === "n") simulate(); draw(); });
  let sim = null, seed = 7;

  function simulate() {
    const n = Math.round(s.n.get()), rnd = mulberry32(seed++), R = 5000;
    const r1 = [], r2 = [];
    for (let t = 0; t < R; t++) {
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) { const v = rnd() * 100; if (v > a) { b = a; a = v; } else if (v > b) b = v; }
      r1.push(((n - 1) / n) * a);
      r2.push(b);
    }
    sim = { r1, r2, n };
  }

  function draw() {
    const n = Math.round(s.n.get()), v = s.v.get(), b = s.b.get();
    // Profit curves.
    svgA.replaceChildren();
    const ys = [];
    for (let x = 0; x <= 100; x++) ys.push(firstPriceProfit(v, x, n), secondPriceProfit(v, x, n));
    // Losses from overbidding are cut off below a third of the peak profit.
    const ymax = Math.max(5, ...ys) * 1.12, ymin = -Math.max(5, ymax / 3);
    const step = ymax - ymin > 60 ? 20 : ymax - ymin > 25 ? 10 : 5;
    const yt = [];
    for (let t = Math.ceil(ymin / step) * step; t <= ymax; t += step) yt.push(t);
    const f = frame(svgA, { box: [44, 16, 560, 214], x: [0, 100], y: [ymin, ymax], xticks: [0, 20, 40, 60, 80, 100], yticks: yt, yfmt: (t) => minus(t), xlabel: "your bid (€)", ylabel: "expected profit (€)" });
    el("line", { x1: f.sx(0), x2: f.sx(100), y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.25" }, svgA);
    const curve = (fn, color) => {
      const pts = [];
      for (let x = 0; x <= 100; x += 0.5) { const y = fn(v, x, n); if (y < ymin) break; pts.push([f.sx(x), f.sy(y)]); }
      polyline(svgA, pts, `stroke:${color};stroke-width:2.25`);
    };
    curve(firstPriceProfit, "var(--vec-u)");
    curve(secondPriceProfit, "var(--vec-v)");
    const bstar = ((n - 1) / n) * v;
    el("line", { x1: f.sx(v), x2: f.sx(v), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.3;stroke-dasharray:3 3" }, svgA);
    text(svgA, f.sx(v) + 4, f.T + f.H - 6, "your value", { class: "fill-muted-foreground font-mono text-[10px]" });
    el("circle", { cx: f.sx(bstar), cy: f.sy(firstPriceProfit(v, bstar, n)), r: 3.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:1.75" }, svgA);
    el("line", { x1: f.sx(b), x2: f.sx(b), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5" }, svgA);
    if (firstPriceProfit(v, b, n) >= ymin) el("circle", { cx: f.sx(b), cy: f.sy(firstPriceProfit(v, b, n)), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svgA);
    el("circle", { cx: f.sx(b), cy: f.sy(secondPriceProfit(v, b, n)), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svgA);
    o.fp.textContent = `€${num(firstPriceProfit(v, b, n), 2)}`;
    o.fpstar.textContent = `€${num(bstar, 2)}, profit €${num(firstPriceProfit(v, bstar, n), 2)}`;
    o.sp.textContent = `€${num(secondPriceProfit(v, b, n), 2)} (best at €${num(v, 0)}: €${num(secondPriceProfit(v, v, n), 2)})`;

    // Revenue histograms.
    svgB.replaceChildren();
    if (!sim || sim.n !== n) simulate();
    const bins = 25, w = 100 / bins;
    const hist = (arr) => { const c = Array(bins).fill(0); for (const x of arr) c[Math.min(bins - 1, Math.floor(x / w))]++; return c.map((k) => k / arr.length / w); };
    const h1 = hist(sim.r1), h2 = hist(sim.r2);
    const top = Math.max(...h1, ...h2) * 1.15;
    const g = frame(svgB, { box: [44, 12, 560, 150], x: [0, 100], y: [0, top], xticks: [0, 20, 40, 60, 80, 100], yticks: [], xlabel: "seller's revenue (€)" });
    const step2 = (hh, color) => {
      const pts = [[g.sx(0), g.sy(0)]];
      hh.forEach((d, i) => { pts.push([g.sx(i * w), g.sy(d)], [g.sx((i + 1) * w), g.sy(d)]); });
      pts.push([g.sx(100), g.sy(0)]);
      el("path", { d: "M" + pts.map((p) => p.map((c) => c.toFixed(1)).join(",")).join("L") + "Z", style: `fill:${color};fill-opacity:0.18;stroke:${color};stroke-width:1.5` }, svgB);
    };
    step2(h2, "var(--vec-v)");
    step2(h1, "var(--vec-u)");
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const th = (100 * (n - 1)) / (n + 1);
    el("line", { x1: g.sx(th), x2: g.sx(th), y1: g.T, y2: g.T + g.H, style: "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:4 3" }, svgB);
    const m1 = mean(sim.r1), m2 = mean(sim.r2);
    const sd = (a, m) => Math.sqrt(a.reduce((s2, x) => s2 + (x - m) ** 2, 0) / a.length);
    o.r1.textContent = `€${num(m1, 2)} (sd ${num(sd(sim.r1, m1), 1)})`;
    o.r2.textContent = `€${num(m2, 2)} (sd ${num(sd(sim.r2, m2), 1)})`;
    o.rth.textContent = `€${num(th, 2)} = 100·(n−1)/(n+1)`;
  }
  root.querySelector("[data-action=sim]").addEventListener("click", () => { simulate(); draw(); });
  simulate();
  draw();
}
