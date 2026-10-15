// Control & robotics blocks. Every curve comes from a model computed here:
// PID on a mass–spring–damper, LQR from the discrete Riccati equation on a
// cart-pole (simulated nonlinearly with RK4), Bode and root locus from the
// transfer function's polynomials, a 2-state linear system, planar inverse
// kinematics, RRT, a constant-velocity Kalman filter and wheel odometry.
// The isometric robot arm lives in ../anatomy/control-arm.js.

import "../anatomy/control-arm.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { P as flip, el as sel, line as sline, arrow, handle } from "./svg.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const minus = (s) => String(s).replace("-", "−");
const fmt = (v, d = 2) => minus(num(v, d));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Runs fn(dtSeconds) on animation frames while the root is on screen and
// fn returns true; returns { start, stop }.
function animator(root, fn) {
  let raf = 0, last = 0, visible = false, wanted = false;
  const loop = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const more = fn(dt);
    raf = visible && wanted && more !== false ? requestAnimationFrame(loop) : 0;
    if (!raf) wanted = more !== false && wanted;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && wanted && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(root);
  return {
    start() { wanted = true; if (visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } },
    stop() { wanted = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    get running() { return wanted; },
  };
}

// ============================================================ PID

for (const root of document.querySelectorAll("[data-ctl-pid]")) {
  const svgY = root.querySelector('[data-plot="y"]'), svgU = root.querySelector('[data-plot="u"]');
  const o = outs(root);
  let aw = false;
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { if (k === "antiwindup") { aw = on; draw(); } });
  const M = 1, C = 1, K = 2; // kg, N·s/m, N/m

  function simulate(kp, ki, kd, umax) {
    const dt = 0.0005, T = 10;
    let y = 0, v = 0, I = 0;
    const out = [];
    for (let i = 0, t = 0; t <= T + 1e-9; i++, t = i * dt) {
      const e = 1 - y;
      const raw = kp * e + ki * I - kd * v; // derivative on the measurement: no kick at the step
      const u = Math.max(-umax, Math.min(umax, raw));
      // Clamping anti-windup: stop integrating while saturated in the error's direction.
      if (!aw || u === raw || Math.sign(e) !== Math.sign(raw)) I += e * dt;
      const a = (u - C * v - K * y) / M;
      v += a * dt; y += v * dt; // semi-implicit Euler, stable at this step
      if (i % 40 === 0) out.push({ t, y, u });
    }
    return out;
  }

  function draw() {
    const kp = s.kp.get(), ki = s.ki.get(), kd = s.kd.get(), umax = s.umax.get();
    const d = simulate(kp, ki, kd, umax);
    const ymax = Math.max(1.4, Math.ceil(Math.max(...d.map((p) => p.y)) * 5) / 5);
    svgY.replaceChildren();
    const f = frame(svgY, { box: [44, 22, 500, 180], x: [0, 10], y: [Math.min(0, ...d.map((p) => p.y)), ymax], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 0.5, 1], xlabel: "time (s)", ylabel: "y (m)" });
    el("rect", { x: f.L, y: f.sy(1.02), width: f.W, height: f.sy(0.98) - f.sy(1.02), style: "fill:var(--brand);fill-opacity:0.08" }, svgY);
    hline(svgY, f, 1, "stroke:var(--brand);stroke-dasharray:5 4");
    polyline(svgY, d.map((p) => [f.sx(p.t), f.sy(p.y)]), "stroke:var(--foreground);stroke-width:1.75");
    svgU.replaceChildren();
    const g = frame(svgU, { box: [44, 20, 500, 70], x: [0, 10], y: [-umax * 1.1, umax * 1.1], xticks: [], yticks: [-umax, 0, umax], yfmt: (v) => minus(Math.round(v)), ylabel: "u (N)" });
    for (const lim of [umax, -umax]) hline(svgU, g, lim, "stroke:var(--code-del);stroke-opacity:0.5;stroke-dasharray:3 3");
    polyline(svgU, d.map((p) => [g.sx(p.t), g.sy(p.u)]), "stroke:var(--vec-u);stroke-width:1.5");

    const y10 = d.at(-1).y;
    const t10 = d.find((p) => p.y >= 0.1)?.t, t90 = d.find((p) => p.y >= 0.9)?.t;
    const peak = Math.max(...d.map((p) => p.y));
    let settle = 0;
    for (const p of d) if (Math.abs(p.y - 1) > 0.02) settle = p.t;
    o.rise.textContent = t10 !== undefined && t90 !== undefined ? `${num(t90 - t10, 2)} s` : "never reaches 90%";
    o.os.textContent = peak > 1 ? `${num((peak - 1) * 100, 1)}%` : "none";
    o.settle.textContent = settle >= 9.99 ? "not within 10 s" : `${num(settle, 2)} s`;
    o.ess.textContent = `${num(Math.abs(1 - y10) * 1000, 1)} mm`;
  }
  draw();
}

// ============================================================ Cart-pole with LQR

// Small dense matrix helpers (arrays of rows).
const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));
const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const madd = (A, B) => A.map((r, i) => r.map((a, j) => a + B[i][j]));

// Discrete-time LQR by iterating the Riccati equation to a fixed point, in
// the Joseph form P = Q + KᵀRK + (A − BK)ᵀP(A − BK), which keeps P symmetric
// positive definite (the textbook form drifts and blows up in floating point).
function dlqr(Ad, Bd, Q, R) {
  let P = Q.map((r) => r.slice());
  let K = Ad[0].map(() => 0);
  for (let it = 0; it < 20000; it++) {
    const BtP = mm(tr(Bd), P);
    const S = R + mm(BtP, Bd)[0][0]; // scalar: one input
    K = mm(BtP, Ad)[0].map((v) => v / S);
    const Acl = Ad.map((r, i) => r.map((a, j) => a - Bd[i][0] * K[j]));
    const KtRK = K.map((ki) => K.map((kj) => ki * R * kj));
    let Pn = madd(madd(Q, KtRK), mm(mm(tr(Acl), P), Acl));
    Pn = Pn.map((r, i) => r.map((v, j) => (v + Pn[j][i]) / 2));
    let diff = 0;
    for (let i = 0; i < Pn.length; i++) for (let j = 0; j < Pn.length; j++) diff = Math.max(diff, Math.abs(Pn[i][j] - P[i][j]));
    P = Pn;
    if (diff < 1e-9 * (1 + Math.abs(P[0][0]))) break;
  }
  return K; // u = −Kx
}

for (const root of document.querySelectorAll("[data-ctl-cartpole]")) {
  const scene = root.querySelector('[data-plot="scene"]'), trace = root.querySelector('[data-plot="trace"]');
  const o = outs(root);
  const Mc = 1, m = 0.1, l = 0.5, g = 9.81, FMAX = 20, DT = 0.01;
  let K = [0, 0, 0, 0], x = [0, 0, 0.15, 0], hist = [], fallen = false;
  const s = scrubAll(root, gains);

  function gains() {
    // Linearised about upright, state [x, ẋ, θ, θ̇], Euler-discretised at DT.
    const A = [[0, 1, 0, 0], [0, 0, (-m * g) / Mc, 0], [0, 0, 0, 1], [0, 0, ((Mc + m) * g) / (l * Mc), 0]];
    const B = [[0], [1 / Mc], [0], [-1 / (l * Mc)]];
    const Ad = A.map((r, i) => r.map((a, j) => (i === j ? 1 : 0) + a * DT));
    const Bd = B.map((r) => [r[0] * DT]);
    const Q = [[s.qx.get(), 0, 0, 0], [0, 1, 0, 0], [0, 0, s.qth.get(), 0], [0, 0, 0, 1]];
    K = dlqr(Ad, Bd, Q, s.r.get());
    o.k.textContent = K.map((v) => fmt(v, 1)).join(", ");
    run.start();
  }
  // Full nonlinear dynamics, θ measured from upright.
  const deriv = ([, xd, th, thd], F) => {
    const sn = Math.sin(th), cs = Math.cos(th), den = Mc + m * sn * sn;
    const xdd = (F + m * l * thd * thd * sn - m * g * sn * cs) / den;
    const thdd = (g * sn * (Mc + m) - cs * (F + m * l * thd * thd * sn)) / (l * den);
    return [xd, xdd, thd, thdd];
  };
  function step(h) {
    const F = fallen ? 0 : Math.max(-FMAX, Math.min(FMAX, -K.reduce((a, k, i) => a + k * x[i], 0)));
    const add = (a, b, c) => a.map((v, i) => v + b[i] * c);
    const k1 = deriv(x, F), k2 = deriv(add(x, k1, h / 2), F), k3 = deriv(add(x, k2, h / 2), F), k4 = deriv(add(x, k3, h), F);
    x = x.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    if (Math.abs(x[2]) > 1.2) { fallen = true; x[2] = Math.sign(x[2]) * Math.min(Math.abs(x[2]), Math.PI / 2); x[3] = 0; }
    return F;
  }
  let t = 0, Flast = 0;
  const run = animator(root, (dt) => {
    for (let i = 0; i < Math.round(dt / 0.002); i++) { Flast = step(0.002); t += 0.002; }
    hist.push([t, x[2]]);
    while (hist.length && hist[0][0] < t - 8) hist.shift();
    draw();
    const still = !fallen && Math.abs(x[2]) < 1e-4 && Math.abs(x[3]) < 1e-4 && Math.abs(x[0]) < 1e-3 && Math.abs(x[1]) < 1e-3;
    return !(still || fallen) || hist.length < 2;
  });

  function draw() {
    scene.replaceChildren();
    const W = 560, cy = 170, sc = 120; // px per metre
    const span = 2.2; // metres shown either side
    const cx = 280 + Math.max(-span, Math.min(span, x[0])) * sc;
    el("line", { x1: 20, x2: 540, y1: cy + 18, y2: cy + 18, style: "stroke:currentColor;stroke-opacity:0.35" }, scene);
    for (let m0 = -2; m0 <= 2; m0++) {
      el("line", { x1: 280 + m0 * sc, x2: 280 + m0 * sc, y1: cy + 18, y2: cy + 24, style: "stroke:currentColor;stroke-opacity:0.35" }, scene);
      text(scene, 280 + m0 * sc, cy + 36, `${minus(m0)} m`, { "text-anchor": "middle" });
    }
    // force arrow
    if (Math.abs(Flast) > 0.05) {
      const len = (Flast / FMAX) * 70;
      el("line", { x1: cx, x2: cx + len, y1: cy - 2, y2: cy - 2, style: "stroke:var(--vec-u);stroke-width:2.5;stroke-linecap:round" }, scene);
      el("path", { d: `M${cx + len} ${cy - 7} L${cx + len + Math.sign(len) * 7} ${cy - 2} L${cx + len} ${cy + 3} Z`, style: "fill:var(--vec-u)" }, scene);
    }
    el("rect", { x: cx - 34, y: cy - 16, width: 68, height: 28, rx: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, scene);
    for (const wx of [-20, 20]) el("circle", { cx: cx + wx, cy: cy + 13, r: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, scene);
    const L = l * sc * 1.6;
    const tx = cx + L * Math.sin(x[2]), ty = cy - 16 - L * Math.cos(x[2]);
    el("line", { x1: cx, y1: cy - 16, x2: tx, y2: ty, style: `stroke:${fallen ? "var(--code-del)" : "var(--foreground)"};stroke-width:3;stroke-linecap:round` }, scene);
    el("circle", { cx: tx, cy: ty, r: 9, style: `fill:${fallen ? "var(--code-del)" : "var(--brand)"}` }, scene);
    el("circle", { cx, cy: cy - 16, r: 3.5, style: "fill:var(--foreground)" }, scene);

    trace.replaceChildren();
    const f = frame(trace, { box: [44, 20, 500, 82], x: [t - 8, t], y: [-0.6, 0.6], xticks: [], yticks: [-0.5, 0, 0.5], yfmt: (v) => `${minus(Math.round((v * 180) / Math.PI))}°`, ylabel: "θ" });
    polyline(trace, hist.map(([tt, th]) => [f.sx(tt), f.sy(Math.max(-0.6, Math.min(0.6, th)))]), "stroke:var(--brand);stroke-width:1.5");
    o.th.textContent = `${fmt((x[2] * 180) / Math.PI, 1)}°`;
    o.x.textContent = `${fmt(x[0], 2)} m`;
    o.state.textContent = fallen ? "fallen: press Reset" : Math.abs(x[2]) < 0.01 ? "balanced" : "recovering";
  }
  root.querySelector("[data-action=push]").addEventListener("click", () => { if (!fallen) x[3] += 1.2; run.start(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { x = [0, 0, 0.15, 0]; fallen = false; hist = []; t = 0; draw(); run.start(); });
  gains();
  draw(); // a still first frame, before the animation starts
  if (reduced()) { for (let i = 0; i < 2000; i++) step(0.002); draw(); }
}

// ============================================================ Transfer functions (Bode, root locus)

// Plants as real zeros and poles; L(s) = K·N(s)/D(s).
const PLANTS = {
  type1: { zeros: [], poles: [0, -1, -5] },
  triple: { zeros: [], poles: [-1, -1, -1] },
  lead: { zeros: [-2], poles: [0, -0.5, -10] },
};
// Coefficients, highest power first, of Π(s − r).
const polyOf = (roots) => roots.reduce((c, r) => [...c, 0].map((v, i) => v - r * (i > 0 ? c[i - 1] : 0)), [1]);
// Durand–Kerner: all complex roots of a monic polynomial, starting from guesses.
function rootsOf(coeffs, guess) {
  const n = coeffs.length - 1;
  const a = coeffs.map((c) => c / coeffs[0]);
  let z = guess && guess.length === n ? guess.map((g) => g.slice()) : Array.from({ length: n }, (_, k) => { const ang = (2 * Math.PI * k) / n + 0.4; return [0.9 * Math.cos(ang) * 2, 0.9 * Math.sin(ang) * 2]; });
  const cmul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const cdiv = (p, q) => { const d = q[0] * q[0] + q[1] * q[1] || 1e-300; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
  for (let it = 0; it < 500; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let pv = [1, 0];
      for (let j = 1; j <= n; j++) pv = [pv[0] * z[i][0] - pv[1] * z[i][1] + a[j], pv[0] * z[i][1] + pv[1] * z[i][0]];
      let den = [1, 0];
      for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, [z[i][0] - z[j][0], z[i][1] - z[j][1]]);
      const d = cdiv(pv, den);
      z[i] = [z[i][0] - d[0], z[i][1] - d[1]];
      moved = Math.max(moved, Math.hypot(d[0], d[1]));
    }
    if (moved < 1e-12) break;
  }
  return z;
}
// Closed-loop characteristic polynomial D(s) + K·N(s).
function charPoly(plant, K) {
  const D = polyOf(plant.poles), N = polyOf(plant.zeros);
  const c = D.slice();
  for (let i = 0; i < N.length; i++) c[c.length - N.length + i] += K * N[i];
  return c;
}
const stableAt = (plant, K) => rootsOf(charPoly(plant, K)).every(([re]) => re < -1e-9);
// The smallest gain at which the loop goes unstable (Infinity if never).
function criticalK(plant) {
  let lo = 1e-4, prev = stableAt(plant, lo);
  if (!prev) return 0;
  for (let k = 1e-4; k < 1e5; k *= 1.15) {
    if (!stableAt(plant, k)) {
      let a = k / 1.15, b = k;
      for (let i = 0; i < 60; i++) { const m = Math.sqrt(a * b); stableAt(plant, m) ? (a = m) : (b = m); }
      return Math.sqrt(a * b);
    }
  }
  return Infinity;
}

for (const root of document.querySelectorAll("[data-ctl-bode]")) {
  const svgM = root.querySelector('[data-plot="mag"]'), svgP = root.querySelector('[data-plot="phase"]');
  const o = outs(root);
  let plant = PLANTS.type1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { plant = PLANTS[e.detail.value]; draw(); });
  const magOf = (w, K) => (K * plant.zeros.reduce((p, z) => p * Math.hypot(w, z), 1)) / plant.poles.reduce((p, q) => p * Math.hypot(w, q), 1);
  // Phase of each real factor jω − r is atan2(ω, −r): continuous in ω, no unwrapping needed.
  const phaseOf = (w) => ((plant.zeros.reduce((a, z) => a + Math.atan2(w, -z), 0) - plant.poles.reduce((a, q) => a + Math.atan2(w, -q), 0)) * 180) / Math.PI;
  const bisect = (f, a, b) => { for (let i = 0; i < 80; i++) { const m = Math.sqrt(a * b); Math.sign(f(m)) === Math.sign(f(a)) ? (a = m) : (b = m); } return Math.sqrt(a * b); };
  const crossing = (f) => {
    const ws = Array.from({ length: 400 }, (_, i) => 10 ** (-3 + (6 * i) / 399));
    for (let i = 1; i < ws.length; i++) if (Math.sign(f(ws[i])) !== Math.sign(f(ws[i - 1]))) return bisect(f, ws[i - 1], ws[i]);
    return null;
  };

  function draw() {
    const K = s.k.get();
    const ws = Array.from({ length: 300 }, (_, i) => 10 ** (-2 + (4 * i) / 299));
    const db = ws.map((w) => 20 * Math.log10(magOf(w, K)));
    const ph = ws.map(phaseOf);
    const wc = crossing((w) => magOf(w, K) - 1);
    const w180 = crossing((w) => phaseOf(w) + 180);
    svgM.replaceChildren();
    const lx = (w) => Math.log10(w);
    const ylo = Math.max(-100, Math.floor(Math.min(...db) / 20) * 20), yhi = Math.min(100, Math.ceil(Math.max(...db) / 20) * 20);
    const f = frame(svgM, { box: [48, 10, 496, 150], x: [-2, 2], y: [ylo, yhi], xticks: [-2, -1, 0, 1, 2], yticks: Array.from({ length: (yhi - ylo) / 20 + 1 }, (_, i) => ylo + i * 20), xfmt: () => "", yfmt: (v) => minus(v), ylabel: "dB" });
    hline(svgM, f, 0, "stroke:currentColor;stroke-opacity:0.45");
    polyline(svgM, ws.map((w, i) => [f.sx(lx(w)), f.sy(Math.max(ylo, Math.min(yhi, db[i])))]), "stroke:var(--foreground);stroke-width:1.75");
    svgP.replaceChildren();
    const plo = Math.floor(Math.min(-180, ...ph) / 90) * 90, phi = Math.ceil(Math.max(0, ...ph) / 90) * 90;
    const g = frame(svgP, { box: [48, 10, 496, 150], x: [-2, 2], y: [plo, phi], xticks: [-2, -1, 0, 1, 2], yticks: Array.from({ length: (phi - plo) / 90 + 1 }, (_, i) => plo + i * 90), xfmt: (v) => `10${["⁻²", "⁻¹", "⁰", "¹", "²"][v + 2]}`, yfmt: (v) => `${minus(v)}°`, xlabel: "ω (rad/s)" });
    hline(svgP, g, -180, "stroke:var(--code-del);stroke-opacity:0.6;stroke-dasharray:4 4");
    polyline(svgP, ws.map((w, i) => [g.sx(lx(w)), g.sy(ph[i])]), "stroke:var(--foreground);stroke-width:1.75");
    // Margins drawn as vertical bars at the crossovers.
    if (wc && wc > 1e-2 && wc < 1e2) {
      el("line", { x1: f.sx(lx(wc)), x2: f.sx(lx(wc)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:2 3" }, svgM);
      el("line", { x1: g.sx(lx(wc)), x2: g.sx(lx(wc)), y1: g.sy(-180), y2: g.sy(phaseOf(wc)), style: "stroke:var(--brand);stroke-width:3;stroke-linecap:round" }, svgP);
    }
    if (w180 && w180 > 1e-2 && w180 < 1e2) {
      const m180 = 20 * Math.log10(magOf(w180, K));
      el("line", { x1: f.sx(lx(w180)), x2: f.sx(lx(w180)), y1: f.sy(0), y2: f.sy(Math.max(ylo, m180)), style: "stroke:var(--vec-u);stroke-width:3;stroke-linecap:round" }, svgM);
      el("line", { x1: g.sx(lx(w180)), x2: g.sx(lx(w180)), y1: g.T, y2: g.T + g.H, style: "stroke:var(--vec-u);stroke-opacity:0.4;stroke-dasharray:2 3" }, svgP);
    }
    o.wc.textContent = wc ? `${num(wc, 3)} rad/s` : "none";
    o.pm.textContent = wc ? `${fmt(180 + phaseOf(wc), 1)}°` : "∞";
    o.w180.textContent = w180 ? `${num(w180, 3)} rad/s` : "never";
    o.gm.textContent = w180 ? `${fmt(-20 * Math.log10(magOf(w180, K)), 2)} dB (×${num(1 / magOf(w180, K), 2)})` : "∞";
    const st = stableAt(plant, K);
    o.stable.textContent = st ? "stable" : "unstable";
    o.stable.className = st ? "tabular-nums text-add" : "tabular-nums text-del";
  }
  draw();
}

for (const root of document.querySelectorAll("[data-ctl-locus]")) {
  const svg = root.querySelector('[data-plot="plane"]');
  const o = outs(root);
  let plant = PLANTS.type1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { plant = PLANTS[e.detail.value]; draw(); });

  function draw() {
    const K = s.k.get();
    // Sweep K on a log scale, seeding each solve with the last roots so the
    // branches stay continuous.
    const branches = plant.poles.map(() => []);
    let prev = plant.poles.map((p, i) => [p + 1e-3 * (i + 1), 1e-3 * (i % 2 ? 1 : -1)]);
    for (let i = 0; i <= 260; i++) {
      const k = 10 ** (-3 + (7 * i) / 260);
      // Nudge the guesses off the real axis: from purely real starts the
      // iteration of a real polynomial never leaves it, and would miss the
      // complex branches after a breakaway point.
      const r = rootsOf(charPoly(plant, k), prev.map(([re, im], j) => [re, im + (j % 2 ? 1e-4 : -1e-4)]));
      // match to previous order by nearest neighbour
      const used = new Set();
      const ordered = prev.map((p) => {
        let best = -1, bd = Infinity;
        r.forEach((q, j) => { if (!used.has(j)) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = j; } } });
        used.add(best);
        return r[best];
      });
      ordered.forEach((q, j) => branches[j].push(q));
      prev = ordered;
    }
    const now = rootsOf(charPoly(plant, K));
    const all = [...branches.flat(), ...plant.poles.map((p) => [p, 0]), ...plant.zeros.map((z) => [z, 0])];
    const reMin = Math.max(-14, Math.min(-1, ...all.map((p) => p[0]))), imMax = Math.min(10, Math.max(2, ...all.map((p) => Math.abs(p[1]))));
    svg.replaceChildren();
    const xr = [Math.floor(reMin * 1.1), Math.max(2, Math.ceil(-reMin * 0.25))];
    const f = frame(svg, { box: [44, 14, 456, 350], x: xr, y: [-imMax * 1.1, imMax * 1.1], xticks: Array.from({ length: 5 }, (_, i) => Math.round(xr[0] + ((xr[1] - xr[0]) * i) / 4)), yticks: [-Math.round(imMax), 0, Math.round(imMax)], xfmt: minus, yfmt: (v) => `${minus(v)}j`, xlabel: "Re s", ylabel: "Im s" });
    el("rect", { x: f.sx(0), y: f.T, width: f.L + f.W - f.sx(0), height: f.H, style: "fill:var(--code-del);fill-opacity:0.06" }, svg);
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.45" }, svg);
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.25");
    const clip = (v, a, b) => Math.max(a, Math.min(b, v));
    // Branches leave the view along their asymptotes: break the path there
    // rather than flattening it against the frame.
    const inside = ([re, im]) => re >= xr[0] && re <= xr[1] && Math.abs(im) <= imMax * 1.1;
    for (const b of branches) {
      let d = "", pen = false;
      for (const p of b) {
        if (!inside(p)) { pen = false; continue; }
        d += `${pen ? "L" : "M"}${f.sx(p[0]).toFixed(1)} ${f.sy(p[1]).toFixed(1)}`;
        pen = true;
      }
      el("path", { d, style: "fill:none;stroke:var(--foreground);stroke-opacity:0.7;stroke-width:1.5;stroke-linejoin:round" }, svg);
    }
    for (const p of plant.poles) { const x = f.sx(p), y = f.sy(0); el("path", { d: `M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x - 6} ${y + 6}L${x + 6} ${y - 6}`, style: "stroke:var(--foreground);stroke-width:2" }, svg); }
    for (const z of plant.zeros) el("circle", { cx: f.sx(z), cy: f.sy(0), r: 6, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
    for (const [re, im] of now) el("circle", { cx: f.sx(clip(re, xr[0], xr[1])), cy: f.sy(clip(im, -imMax * 1.1, imMax * 1.1)), r: 5.5, style: `fill:${re < 0 ? "var(--brand)" : "var(--code-del)"};stroke:var(--background);stroke-width:2` }, svg);
    o.poles.textContent = now.map(([re, im]) => (Math.abs(im) < 1e-6 ? fmt(re, 2) : `${fmt(re, 2)} ${im < 0 ? "−" : "+"} ${num(Math.abs(im), 2)}j`)).join(", ");
    const kc = criticalK(plant);
    o.kc.textContent = Number.isFinite(kc) ? num(kc, 3) : "none (always stable)";
    const st = now.every(([re]) => re < -1e-9);
    o.stable.textContent = st ? "stable" : "unstable";
    o.stable.className = st ? "tabular-nums text-add" : "tabular-nums text-del";
  }
  draw();
}

// ============================================================ State space

for (const root of document.querySelectorAll("[data-ctl-ss]")) {
  const svg = root.querySelector('[data-plot="portrait"]');
  const o = outs(root);
  const s = scrubAll(root, draw);
  function draw() {
    const a11 = s.a11.get(), a12 = s.a12.get(), a21 = s.a21.get(), a22 = s.a22.get(), b1 = s.b1.get(), b2 = s.b2.get();
    const tr = a11 + a22, det = a11 * a22 - a12 * a21, disc = tr * tr - 4 * det;
    const f = (x, y) => [a11 * x + a12 * y, a21 * x + a22 * y];
    svg.replaceChildren();
    const S = 175, C = 210, sx = (x) => C + x * (S / 3), sy = (y) => C - y * (S / 3);
    el("rect", { x: C - S, y: C - S, width: 2 * S, height: 2 * S, rx: 6, style: "fill:none;stroke:currentColor;stroke-opacity:0.15" }, svg);
    el("line", { x1: C - S, x2: C + S, y1: C, y2: C, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    el("line", { x1: C, x2: C, y1: C - S, y2: C + S, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    // direction field
    for (let i = -2.5; i <= 2.51; i += 0.5) for (let j = -2.5; j <= 2.51; j += 0.5) {
      const [u, v] = f(i, j), n = Math.hypot(u, v) || 1, L = 0.18;
      el("line", { x1: sx(i - (u / n) * L), y1: sy(j - (v / n) * L), x2: sx(i + (u / n) * L), y2: sy(j + (v / n) * L), style: "stroke:currentColor;stroke-opacity:0.25;stroke-width:1.2;stroke-linecap:round" }, svg);
      el("circle", { cx: sx(i + (u / n) * L), cy: sy(j + (v / n) * L), r: 1.3, style: "fill:currentColor;fill-opacity:0.35" }, svg);
    }
    // trajectories (RK4) from a ring of starts, clipped to the box
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * 2 * Math.PI + 0.2;
      let p = [2.7 * Math.cos(ang), 2.7 * Math.sin(ang)];
      const pts = [p];
      for (let n = 0; n < 600; n++) {
        const h = 0.01;
        const k1 = f(...p), k2 = f(p[0] + (h / 2) * k1[0], p[1] + (h / 2) * k1[1]), k3 = f(p[0] + (h / 2) * k2[0], p[1] + (h / 2) * k2[1]), k4 = f(p[0] + h * k3[0], p[1] + h * k3[1]);
        p = [p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
        if (Math.abs(p[0]) > 3 || Math.abs(p[1]) > 3) break;
        pts.push(p);
      }
      polyline(svg, pts.map(([x, y]) => [sx(x), sy(y)]), "stroke:var(--brand);stroke-opacity:0.75;stroke-width:1.4");
      el("circle", { cx: sx(pts[0][0]), cy: sy(pts[0][1]), r: 2.5, style: "fill:var(--brand)" }, svg);
    }
    // B as an arrow from the origin
    const bn = Math.hypot(b1, b2);
    if (bn > 1e-9) {
      const L = 1.4 / bn, ex = sx(b1 * L), ey = sy(b2 * L);
      el("line", { x1: C, y1: C, x2: ex, y2: ey, style: "stroke:var(--vec-u);stroke-width:2.5;stroke-linecap:round" }, svg);
      el("circle", { cx: ex, cy: ey, r: 4, style: "fill:var(--vec-u)" }, svg);
      text(svg, ex + 8, ey - 6, "B", { class: "fill-foreground font-mono text-[11px]" });
    }
    const eigTxt = disc >= 0 ? [(tr + Math.sqrt(disc)) / 2, (tr - Math.sqrt(disc)) / 2].map((v) => fmt(v, 2)).join(", ") : `${fmt(tr / 2, 2)} ± ${num(Math.sqrt(-disc) / 2, 2)}j`;
    const eps = 1e-9;
    const kind = Math.abs(det) < eps ? "degenerate (a zero eigenvalue)"
      : det < 0 ? "saddle (unstable)"
      : disc < -eps ? (Math.abs(tr) < eps ? "centre (closed orbits)" : tr < 0 ? "stable spiral" : "unstable spiral")
      : tr < 0 ? "stable node" : "unstable node";
    const cdet = b1 * (a21 * b1 + a22 * b2) - b2 * (a11 * b1 + a12 * b2); // det [B AB]
    o.eig.textContent = eigTxt;
    o.kind.textContent = kind;
    o.det.textContent = fmt(cdet, 3);
    const ok = Math.abs(cdet) > 1e-9;
    o.ctrb.textContent = ok ? "yes: rank 2" : bn < eps ? "no: B = 0" : "no: B lies along an eigenvector";
    o.ctrb.className = ok ? "tabular-nums text-add" : "tabular-nums text-del";
  }
  draw();
}

// ============================================================ Two-link IK

// Same model as the robot arm figure: law of cosines for the elbow.
function ik2(x, y, L1, L2, up) {
  const r2 = x * x + y * y;
  const c = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  if (c < -1 - 1e-12 || c > 1 + 1e-12) return null;
  const q2 = (up ? -1 : 1) * Math.acos(Math.max(-1, Math.min(1, c)));
  const q1 = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
  return { q1, q2 };
}
const fk2 = ({ q1, q2 }, L1, L2) => [L1 * Math.cos(q1) + L2 * Math.cos(q1 + q2), L1 * Math.sin(q1) + L2 * Math.sin(q1 + q2)];

for (const root of document.querySelectorAll("[data-ctl-ik]")) {
  const svg = root.querySelector('[data-plot="plane"]');
  const o = outs(root);
  let target = [110, 60];
  const scene = sel("g", {}, svg), top = sel("g", {}, svg);
  const h = handle(svg, top, "Target", (p) => { target = [Math.max(-180, Math.min(180, p[0])), Math.max(-180, Math.min(180, p[1]))]; draw(); });
  h.node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = e.shiftKey ? 5 : 1;
    target = [target[0] + d[0] * k, target[1] + d[1] * k];
    draw();
  });
  // The handle was sized for small viewBoxes: scale it up here.
  h.node.setAttribute("r", "9");
  const s = scrubAll(root, draw);
  const deg = (r) => fmt((r * 180) / Math.PI, 1);

  function draw() {
    const L1 = s.l1.get(), L2 = s.l2.get();
    scene.replaceChildren();
    const rOut = L1 + L2, rIn = Math.abs(L1 - L2);
    const ring = (r) => `M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`;
    sel("path", { d: ring(rOut) + ring(Math.max(rIn, 0.01)), style: "fill:var(--brand);fill-opacity:0.07;fill-rule:evenodd;stroke:var(--brand);stroke-opacity:0.35;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, scene);
    sline(scene, [-185, 0], [185, 0], "stroke:currentColor;stroke-opacity:0.15;stroke-width:1px");
    sline(scene, [0, -185], [0, 185], "stroke:currentColor;stroke-opacity:0.15;stroke-width:1px");
    const sols = [true, false].map((up) => ({ up, s: ik2(target[0], target[1], L1, L2, up) }));
    let err = 0;
    for (const { up, s: q } of sols.slice().reverse()) {
      if (!q) continue;
      const e = [L1 * Math.cos(q.q1), L1 * Math.sin(q.q1)];
      const end = fk2(q, L1, L2);
      err = Math.max(err, Math.hypot(end[0] - target[0], end[1] - target[1]));
      const style = up ? "stroke:var(--foreground);stroke-width:7px;stroke-linecap:round" : "stroke:var(--foreground);stroke-opacity:0.25;stroke-width:7px;stroke-linecap:round";
      sline(scene, [0, 0], e, style);
      sline(scene, e, end, style);
      sel("circle", { cx: flip(e)[0], cy: flip(e)[1], r: 5, style: `fill:var(--background);stroke:var(--foreground);stroke-opacity:${up ? 1 : 0.35};stroke-width:2px`, "vector-effect": "non-scaling-stroke" }, scene);
    }
    sel("circle", { cx: 0, cy: 0, r: 7, style: "fill:var(--foreground)" }, scene);
    // the target marker (the handle itself is only a hit area here)
    sel("circle", { cx: flip(target)[0], cy: flip(target)[1], r: 7, style: `fill:var(--background);stroke:${sols[0].s ? "var(--brand)" : "var(--code-del)"};stroke-width:2.5px`, "vector-effect": "non-scaling-stroke" }, scene);
    sel("circle", { cx: flip(target)[0], cy: flip(target)[1], r: 2.5, style: `fill:${sols[0].s ? "var(--brand)" : "var(--code-del)"}` }, scene);
    h.place(target, "transparent");
    o.target.textContent = `(${fmt(target[0], 0)}, ${fmt(target[1], 0)}) mm`;
    o.up.textContent = sols[0].s ? `θ1 ${deg(sols[0].s.q1)}°, θ2 ${deg(sols[0].s.q2)}°` : "out of reach";
    o.down.textContent = sols[1].s ? `θ1 ${deg(sols[1].s.q1)}°, θ2 ${deg(sols[1].s.q2)}°` : "out of reach";
    o.err.textContent = sols[0].s ? (err < 1e-9 ? "< 10⁻⁹ mm" : `${err.toExponential(1)} mm`) : "—";
  }
  draw();
}

// ============================================================ RRT

for (const root of document.querySelectorAll("[data-ctl-rrt]")) {
  const svg = root.querySelector('[data-plot="map"]');
  const o = outs(root);
  const W = 520, H = 360, START = [40, 320], GOAL = [480, 40], GOAL_R = 14, MARGIN = 4;
  const OBST = [[150, 250, 50], [250, 120, 60], [360, 250, 55], [420, 110, 35], [110, 110, 34], [300, 320, 28]];
  let seed = 3, short = true, nodes, parent, path, iters, done, rng;
  const s = scrubAll(root, reset);
  onToggle(root, (k, on) => { if (k === "shortcut") { short = on; finish(); draw(); } });
  const free = (a, b) => OBST.every(([cx, cy, r]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((cx - a[0]) * dx + (cy - a[1]) * dy) / L2));
    return Math.hypot(a[0] + t * dx - cx, a[1] + t * dy - cy) > r + MARGIN;
  });
  function reset() {
    rng = mulberry32(seed);
    nodes = [START]; parent = [-1]; path = null; iters = 0; done = false;
    draw();
  }
  function grow(n) {
    const step = s.step.get(), bias = s.bias.get() / 100;
    for (let i = 0; i < n && !done && iters < 4000; i++) {
      iters++;
      const q = rng() < bias ? GOAL : [rng() * W, rng() * H];
      let best = 0, bd = Infinity;
      nodes.forEach((p, j) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = j; } });
      const p = nodes[best];
      const t = Math.min(1, step / (bd || 1));
      const nw = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      if (!free(p, nw)) continue;
      nodes.push(nw); parent.push(best);
      if (Math.hypot(nw[0] - GOAL[0], nw[1] - GOAL[1]) < GOAL_R && free(nw, GOAL)) { nodes.push(GOAL); parent.push(nodes.length - 2); done = true; finish(); }
    }
  }
  let raw = null;
  function finish() {
    if (!done) return;
    raw = [];
    for (let i = nodes.length - 1; i >= 0; i = parent[i]) raw.unshift(nodes[i]);
    path = raw.slice();
    if (short) {
      // Greedy shortcut: from each kept point, jump to the farthest visible one.
      const out = [path[0]];
      let i = 0;
      while (i < path.length - 1) {
        let j = path.length - 1;
        while (j > i + 1 && !free(path[i], path[j])) j--;
        out.push(path[j]); i = j;
      }
      path = out;
    }
  }
  const lenOf = (p) => p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
  function draw() {
    svg.replaceChildren();
    el("rect", { x: 0.5, y: 0.5, width: W - 1, height: H - 1, rx: 8, style: "fill:none;stroke:currentColor;stroke-opacity:0.2" }, svg);
    for (const [cx, cy, r] of OBST) el("circle", { cx, cy, r, style: "fill:currentColor;fill-opacity:0.1;stroke:currentColor;stroke-opacity:0.35" }, svg);
    const d = nodes.slice(1).map((p, i) => `M${parent[i + 1] >= 0 ? nodes[parent[i + 1]].map((v) => v.toFixed(1)).join(" ") : ""}L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
    el("path", { d, style: "fill:none;stroke:var(--vec-u);stroke-opacity:0.55;stroke-width:1" }, svg);
    if (raw && short) polyline(svg, raw, "stroke:var(--brand);stroke-opacity:0.3;stroke-width:2");
    if (path) polyline(svg, path, "stroke:var(--brand);stroke-width:3;stroke-linejoin:round;stroke-linecap:round");
    el("circle", { cx: START[0], cy: START[1], r: 7, style: "fill:var(--foreground)" }, svg);
    el("circle", { cx: GOAL[0], cy: GOAL[1], r: GOAL_R, style: "fill:var(--brand);fill-opacity:0.15;stroke:var(--brand)" }, svg);
    text(svg, START[0] + 12, START[1] + 4, "start");
    text(svg, GOAL[0] - 20, GOAL[1] + 28, "goal");
    o.nodes.textContent = String(nodes.length);
    o.iters.textContent = String(iters);
    o.len.textContent = path ? `${num(lenOf(path), 0)} px` : done ? "—" : iters >= 4000 ? "not found" : "searching…";
    o.direct.textContent = `${num(Math.hypot(GOAL[0] - START[0], GOAL[1] - START[1]), 0)} px`;
  }
  const run = animator(root, () => { grow(25); draw(); return !done && iters < 4000; });
  root.querySelector("[data-action=grow]").addEventListener("click", () => {
    if (done || iters >= 4000) reset();
    if (reduced()) { grow(4000); draw(); } else run.start();
  });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; run.stop(); reset(); if (reduced()) { grow(4000); draw(); } else run.start(); });
  reset();
  grow(4000); // first view: a solved plan
  draw();
}

// ============================================================ Kalman filter

for (const root of document.querySelectorAll("[data-ctl-kalman]")) {
  const svgT = root.querySelector('[data-plot="track"]'), svgG = root.querySelector('[data-plot="gain"]');
  const o = outs(root);
  let seed = 11;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });
  const DT = 0.1, N = 200, TRUE_ACC = 0.8; // s, steps, m/s² (σ of the true motion's acceleration)

  function draw() {
    const r = s.r.get(), q = s.q.get();
    const rng = mulberry32(seed * 977);
    // The true motion: velocity driven by random acceleration, independent of the filter's q.
    let x = 0, v = 1;
    const truth = [], meas = [];
    for (let k = 0; k < N; k++) {
      const a = TRUE_ACC * gauss(rng);
      x += v * DT + 0.5 * a * DT * DT; v += a * DT;
      truth.push(x); meas.push(x + r * gauss(rng));
    }
    // Constant-velocity Kalman filter with white-acceleration noise q.
    let X = [meas[0], 0], Pm = [[r * r, 0], [0, 10]];
    const Qm = [[(q * DT ** 4) / 4, (q * DT ** 3) / 2], [(q * DT ** 3) / 2, q * DT * DT]];
    const est = [], sig = [], gain = [];
    for (let k = 0; k < N; k++) {
      if (k > 0) {
        X = [X[0] + DT * X[1], X[1]];
        const p00 = Pm[0][0] + DT * (Pm[1][0] + Pm[0][1]) + DT * DT * Pm[1][1];
        const p01 = Pm[0][1] + DT * Pm[1][1], p10 = Pm[1][0] + DT * Pm[1][1], p11 = Pm[1][1];
        Pm = [[p00 + Qm[0][0], p01 + Qm[0][1]], [p10 + Qm[1][0], p11 + Qm[1][1]]];
      }
      const S = Pm[0][0] + r * r;
      const K = [Pm[0][0] / S, Pm[1][0] / S];
      const y = meas[k] - X[0];
      X = [X[0] + K[0] * y, X[1] + K[1] * y];
      Pm = [[(1 - K[0]) * Pm[0][0], (1 - K[0]) * Pm[0][1]], [Pm[1][0] - K[1] * Pm[0][0], Pm[1][1] - K[1] * Pm[0][1]]];
      est.push(X[0]); sig.push(Math.sqrt(Math.max(0, Pm[0][0]))); gain.push(K[0]);
    }
    const ts = Array.from({ length: N }, (_, k) => k * DT);
    const lo = Math.min(...meas, ...est) - 1, hi = Math.max(...meas, ...est) + 1;
    svgT.replaceChildren();
    const f = frame(svgT, { box: [44, 22, 500, 204], x: [0, N * DT], y: [lo, hi], xticks: [0, 5, 10, 15, 20], yticks: [Math.ceil(lo / 5) * 5, Math.round((lo + hi) / 10) * 5, Math.floor(hi / 5) * 5], yfmt: minus, xlabel: "time (s)", ylabel: "x (m)" });
    const band = ts.map((t, k) => [f.sx(t), f.sy(est[k] + 2 * sig[k])]).concat(ts.map((t, k) => [f.sx(t), f.sy(est[k] - 2 * sig[k])]).reverse());
    el("path", { d: "M" + band.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.15" }, svgT);
    for (let k = 0; k < N; k += 1) el("circle", { cx: f.sx(ts[k]), cy: f.sy(meas[k]), r: 1.6, style: "fill:var(--vec-u);fill-opacity:0.6" }, svgT);
    polyline(svgT, ts.map((t, k) => [f.sx(t), f.sy(truth[k])]), "stroke:var(--muted-foreground);stroke-width:1.5;stroke-dasharray:4 3");
    polyline(svgT, ts.map((t, k) => [f.sx(t), f.sy(est[k])]), "stroke:var(--brand);stroke-width:1.75");
    svgG.replaceChildren();
    const g = frame(svgG, { box: [44, 20, 500, 56], x: [0, N * DT], y: [0, 1], xticks: [], yticks: [0, 1], ylabel: "gain" });
    polyline(svgG, ts.map((t, k) => [g.sx(t), g.sy(gain[k])]), "stroke:var(--foreground);stroke-width:1.5");
    const rmse = (a) => Math.sqrt(a.reduce((acc, v, k) => acc + (v - truth[k]) ** 2, 0) / N);
    o.raw.textContent = `${num(rmse(meas), 2)} m`;
    o.est.textContent = `${num(rmse(est), 2)} m`;
    o.k.textContent = num(gain.at(-1), 3);
  }
  draw();
}

// ============================================================ Differential-drive odometry

for (const root of document.querySelectorAll("[data-ctl-odo]")) {
  const svg = root.querySelector('[data-plot="floor"]');
  const o = outs(root);
  const B = 0.3, SC = 100; // axle length (m), svg units per metre
  const btn = root.querySelector("[data-action=play]");
  const setPlay = (p) => { btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p); btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p); btn.querySelector("[data-label]").textContent = p ? "Pause" : "Drive"; };
  let truth, odo, trailT, trailO, t;
  const s = scrubAll(root, () => { show(); });
  const START = [0, -1, 0];
  function reset() { truth = START.slice(); odo = START.slice(); trailT = [truth.slice(0, 2)]; trailO = [odo.slice(0, 2)]; t = 0; }
  // Exact pose update along an arc (or a straight line when ω = 0).
  function move([x, y, th], vl, vr, dt) {
    const v = (vl + vr) / 2, w = (vr - vl) / B;
    if (Math.abs(w) < 1e-9) return [x + v * dt * Math.cos(th), y + v * dt * Math.sin(th), th];
    const R = v / w;
    return [x + R * (Math.sin(th + w * dt) - Math.sin(th)), y - R * (Math.cos(th + w * dt) - Math.cos(th)), th + w * dt];
  }
  function stepAll(dt) {
    const vl = s.vl.get(), vr = s.vr.get(), slip = s.slip.get() / 100;
    truth = move(truth, vl, vr * (1 - slip), dt); // the right wheel really covers less ground
    odo = move(odo, vl, vr, dt); // the encoders report the commanded speed
    t += dt;
    trailT.push(truth.slice(0, 2)); trailO.push(odo.slice(0, 2));
    if (trailT.length > 2000) { trailT.shift(); trailO.shift(); }
  }
  const P = ([x, y]) => [x * SC, -y * SC];
  function robot(pose, cls) {
    const [cx, cy] = P(pose), deg = (-pose[2] * 180) / Math.PI;
    const g = el("g", { transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${deg.toFixed(1)})` }, svg);
    el("rect", { x: -16, y: -13, width: 32, height: 26, rx: 5, style: `fill:var(--background);stroke:${cls};stroke-width:1.5` }, g);
    for (const wy of [-B * SC * 0.5, B * SC * 0.5]) el("rect", { x: -8, y: wy - 3, width: 16, height: 6, rx: 2, style: `fill:${cls}` }, g);
    el("path", { d: "M6 -5 L14 0 L6 5", style: `fill:none;stroke:${cls};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round` }, g);
  }
  function show() {
    const vl = s.vl.get(), vr = s.vr.get();
    const v = (vl + vr) / 2, w = (vr - vl) / B;
    svg.replaceChildren();
    for (let gx = -2; gx <= 2; gx++) el("line", { x1: gx * SC, x2: gx * SC, y1: -150, y2: 150, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
    for (let gy = -1; gy <= 1; gy++) el("line", { x1: -200, x2: 200, y1: gy * SC, y2: gy * SC, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
    text(svg, 196, 146, "grid 1 m", { "text-anchor": "end" });
    polyline(svg, trailO.map(P), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, trailT.map(P), "stroke:var(--brand);stroke-width:2");
    robot(odo, "var(--vec-u)");
    robot(truth, "var(--brand)");
    o.v.textContent = `${fmt(v, 3)} m/s`;
    o.w.textContent = `${fmt(w, 3)} rad/s`;
    o.R.textContent = Math.abs(w) < 1e-9 ? "∞ (straight)" : `${fmt(v / w, 2)} m`;
    o.err.textContent = `${num(Math.hypot(truth[0] - odo[0], truth[1] - odo[1]) * 100, 1)} cm after ${num(t, 1)} s`;
  }
  const run = animator(root, (dt) => { for (let i = 0; i < 10; i++) stepAll(dt / 10); show(); if (t > 60) { setPlay(false); return false; } return true; });
  btn.addEventListener("click", () => {
    if (run.running) { run.stop(); setPlay(false); return; }
    if (reduced()) { for (let i = 0; i < 300; i++) stepAll(0.1); show(); return; }
    setPlay(true); run.start();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { run.stop(); setPlay(false); reset(); show(); });
  setPlay(false);
  reset();
  for (let i = 0; i < 200; i++) stepAll(0.1); // a first lap so the drift is visible
  show();
}
