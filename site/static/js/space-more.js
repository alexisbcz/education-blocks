// Space systems blocks, part 2: thermal balance, attitude control, a GNSS
// fix and orbital decay. Each block's root carries a data-spc-* attribute;
// the module does nothing on pages without them.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { MU, RE, DEG, outs, onSeg, setSeg, svgPoint, period, eclipseFraction, solve, inverse, rng, fmtSI } from "./space-util.js";

const BRAND = "var(--brand)";
const SIGMA = 5.670374e-8;

// ============================================================ thermal

const COATINGS = {
  white: { alpha: 0.2, eps: 0.85, name: "White paint" },
  black: { alpha: 0.95, eps: 0.85, name: "Black paint" },
  osr: { alpha: 0.08, eps: 0.8, name: "OSR" },
  mli: { alpha: 0.38, eps: 0.67, name: "Kapton MLI" },
  al: { alpha: 0.15, eps: 0.05, name: "Bare Al" },
};
const CASES = { hot: { S: 1414, a: 0.35, ir: 258 }, cold: { S: 1322, a: 0.25, ir: 217 } };

for (const root of document.querySelectorAll("[data-spc-thermal]")) {
  const tsvg = root.querySelector("[data-time]");
  const msvg = root.querySelector("[data-map]");
  const o = outs(root);
  const s = scrubAll(root, (name) => { if (name === "alpha" || name === "eps") setSeg(root, "Coating", ""); draw(); });
  onSeg(root, (_, v) => { const c = COATINGS[v]; s.alpha.set(c.alpha, false); s.eps.set(c.eps, false); draw(); });

  function run(c, p) {
    const A = 4 * Math.PI * p.r ** 2, Ap = Math.PI * p.r ** 2;
    const k = (RE / (RE + p.h)) ** 2;
    const F = (1 - Math.sqrt(1 - k)) / 2;
    const T = period(RE + p.h), fe = eclipseFraction(p.h, 0), Td = (1 - fe) * T;
    const qin = (t) => {
      const sun = (t % T) < Td;
      return (sun ? p.alpha * c.S * Ap + p.alpha * c.a * c.S * F * A : 0) + p.eps * c.ir * F * A + p.q;
    };
    // Start from the orbit-average equilibrium and run four orbits; keep
    // the last three.
    const avg = (p.alpha * (c.S * Ap + c.a * c.S * F * A)) * (1 - fe) + p.eps * c.ir * F * A + p.q;
    let Tk = (avg / (p.eps * SIGMA * A)) ** 0.25;
    const dt = 10, mc = p.mass * 1000, out = [];
    for (let t = 0; t <= 4 * T; t += dt) {
      if (t >= T) out.push([(t - T) / 60, Tk]);
      Tk += ((qin(t) - p.eps * SIGMA * A * Tk ** 4) / mc) * dt;
    }
    const sunEq = ((p.alpha * (c.S * Ap + c.a * c.S * F * A) + p.eps * c.ir * F * A + p.q) / (p.eps * SIGMA * A)) ** 0.25;
    return { out, F, T, sunEq };
  }

  function draw() {
    const p = { alpha: s.alpha.get(), eps: s.eps.get(), r: s.r.get(), q: s.q.get(), mass: s.mass.get(), h: s.alt.get() };
    const hot = run(CASES.hot, p), cold = run(CASES.cold, p);
    const K = 273.15;
    const all = [...hot.out, ...cold.out].map((q) => q[1] - K);
    const lo = Math.floor(Math.min(...all, hot.sunEq - K) / 20) * 20 - 10, hi = Math.ceil(Math.max(...all, hot.sunEq - K) / 20) * 20 + 10;
    tsvg.replaceChildren();
    const tm = (3 * hot.T) / 60;
    const f = frame(tsvg, { box: [50, 16, 560, 196], x: [0, tm], y: [lo, hi], xticks: [0, 50, 100, 150, 200, 250, 300].filter((x) => x <= tm), yticks: [lo, (lo + hi) / 2, hi].map(Math.round), yfmt: (v) => `${v} °C`, xlabel: "minutes", ylabel: "temperature" });
    // Eclipse bands.
    const fe = eclipseFraction(p.h, 0), Td = (1 - fe) * hot.T;
    for (let k = 0; k < 3; k++) {
      const x0 = f.sx((k * hot.T + Td) / 60), x1 = f.sx(((k + 1) * hot.T) / 60);
      el("rect", { x: x0, y: f.T, width: x1 - x0, height: f.H, style: "fill:currentColor;fill-opacity:.07" }, tsvg);
    }
    text(tsvg, (f.sx(Td / 60) + f.sx(hot.T / 60)) / 2, f.T + 11, "eclipse", { "text-anchor": "middle" });
    hline(f.g, f, hot.sunEq - K, "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:4 3", "hot equilibrium in sunlight");
    polyline(tsvg, hot.out.map(([t, T]) => [f.sx(t), f.sy(T - K)]), "stroke:var(--code-del);stroke-width:1.7");
    polyline(tsvg, cold.out.map(([t, T]) => [f.sx(t), f.sy(T - K)]), "stroke:var(--vec-u);stroke-width:1.7");

    // Far from the Earth, no internal power: T = (α S / 4 ε σ)^¼ against α/ε.
    msvg.replaceChildren();
    const Teq = (ratio) => ((ratio * 1361) / (4 * SIGMA)) ** 0.25 - K;
    const g = frame(msvg, { box: [50, 14, 560, 170], x: [Math.log10(0.05), Math.log10(20)], y: [-150, 300], xticks: [-1, 0, 1].concat([Math.log10(0.05), Math.log10(20)]), xfmt: (x) => num(10 ** x, x < -1 ? 2 : x < 0 ? 1 : 0), yticks: [-100, 0, 100, 200, 300], yfmt: (v) => `${v} °C`, xlabel: "α/ε (log scale)", ylabel: "sphere in sunlight, alone" });
    const pts = [];
    for (let x = Math.log10(0.05); x <= Math.log10(20) + 1e-9; x += 0.02) pts.push([g.sx(x), g.sy(Teq(10 ** x))]);
    polyline(msvg, pts, "stroke:currentColor;stroke-opacity:.55;stroke-width:1.4");
    hline(g.g, g, 0, "stroke:currentColor;stroke-opacity:.2");
    for (const [key, c] of Object.entries(COATINGS)) {
      const x = Math.log10(c.alpha / c.eps), y = Teq(c.alpha / c.eps);
      el("circle", { cx: g.sx(x), cy: g.sy(y), r: 3, style: "fill:var(--background);stroke:currentColor;stroke-opacity:.7" }, msvg);
      const left = key === "al" || key === "mli";
      text(msvg, g.sx(x) + (left ? -6 : 6), g.sy(y) + (key === "black" ? 13 : -6), c.name, { "text-anchor": left ? "end" : "start" });
    }
    const ratio = p.alpha / p.eps;
    el("circle", { cx: g.sx(Math.log10(Math.min(20, Math.max(0.05, ratio)))), cy: g.sy(Teq(Math.min(20, Math.max(0.05, ratio)))), r: 5, style: `fill:${BRAND}` }, msvg);

    const hotMax = Math.max(...hot.out.map((q) => q[1])), hotMin = Math.min(...hot.out.map((q) => q[1]));
    const coldMin = Math.min(...cold.out.map((q) => q[1]));
    o.thot.textContent = `${num(hotMax - K, 1)} °C`;
    o.tcold.textContent = `${num(coldMin - K, 1)} °C`;
    o.swing.textContent = `${num(hotMax - hotMin, 1)} K (hot case)`;
    o.ratio.textContent = `${num(ratio, 2)} → ${num(Teq(ratio), 0)} °C alone in sunlight`;
    o.vf.textContent = num(hot.F, 3);
  }
  draw();
}

// ============================================================ attitude

const SAT = { I: 0.05, Iw: 2.0e-5, rpmMax: 6000 };
const HMAX = SAT.Iw * ((SAT.rpmMax * 2 * Math.PI) / 60);
export function slew(c, tEnd, dt = 0.01) {
  const kp = c.wn * c.wn * SAT.I, kd = 2 * c.zeta * c.wn * SAT.I, tlim = c.tmax * 1e-3, target = c.target * DEG;
  let th = 0, w = 0;
  const out = [];
  for (let t = 0; t <= tEnd; t += dt) {
    let tau = -kp * (th - target) - kd * w;
    tau = Math.max(-tlim, Math.min(tlim, tau));
    const hw = -SAT.I * w;
    if ((hw >= HMAX && tau < 0) || (hw <= -HMAX && tau > 0)) tau = 0;
    out.push({ t, th, w, tau, rpm: ((-SAT.I * w) / SAT.Iw) * (60 / (2 * Math.PI)) });
    w += (tau / SAT.I) * dt;
    th += w * dt;
  }
  return out;
}

for (const root of document.querySelectorAll("[data-spc-attitude]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let view = "slew";
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { view = v; draw(); });
  const ctrl = () => ({ target: s.target.get(), wn: s.wn.get(), zeta: s.zeta.get(), tmax: s.tmax.get() });
  root.querySelector('[data-action="bench"]').addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("spc-attitude", { detail: { ...ctrl(), restart: true } }));
    document.querySelector("#cubesat-bench")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  });

  function drawSlew() {
    const c = ctrl();
    const tEnd = Math.min(240, Math.max(30, 10 / (c.zeta * c.wn)) + 2 * Math.sqrt(Math.abs(c.target * DEG) / ((c.tmax * 1e-3) / SAT.I)));
    const run = slew(c, tEnd);
    const target = c.target;
    const panels = [
      { key: "th", lab: "yaw (°)", col: "var(--vec-u)", f: (q) => q.th / DEG, box: [60, 24, 550, 104] },
      { key: "rpm", lab: "wheel (rpm)", col: BRAND, f: (q) => q.rpm, box: [60, 162, 550, 96] },
      { key: "tau", lab: "torque (mN·m)", col: "var(--vec-out)", f: (q) => q.tau * 1e3, box: [60, 296, 550, 84] },
    ];
    for (const p of panels) {
      const vals = run.map(p.f);
      let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
      if (p.key === "th") { lo = Math.min(lo, target); hi = Math.max(hi, target); }
      // Ticks at zero, the extremes and the target, dropping any that sit
      // within a tenth of the range of one already kept.
      const ticks = [];
      for (const v of [0, p.key === "th" ? target : null, Math.min(...vals), Math.max(...vals)]) {
        if (v === null) continue;
        const r = Math.round(v * 10) / 10;
        if (ticks.every((t) => Math.abs(t - r) > 0.1 * Math.max(hi - lo, 1e-9))) ticks.push(r);
      }
      if (hi - lo < 1e-9) hi = lo + 1;
      const pad = (hi - lo) * 0.1;
      const f = frame(svg, { box: p.box, x: [0, tEnd], y: [lo - pad, hi + pad], xticks: p.key === "tau" ? [0, tEnd / 4, tEnd / 2, (3 * tEnd) / 4, tEnd].map((x) => Math.round(x)) : [], yticks: ticks, yfmt: (v) => num(v, Math.abs(v) < 10 && v !== 0 ? 1 : 0), xlabel: p.key === "tau" ? "seconds" : undefined });
      text(svg, p.box[0], p.box[1] - 8, p.lab, { "text-anchor": "start" });
      hline(f.g, f, 0, "stroke:currentColor;stroke-opacity:.2");
      if (p.key === "th") hline(f.g, f, target, "stroke:currentColor;stroke-opacity:.45;stroke-dasharray:4 3", "target");
      if (p.key === "rpm" && hi + pad > SAT.rpmMax) hline(f.g, f, SAT.rpmMax, "stroke:var(--code-del);stroke-dasharray:4 3", "wheel limit");
      if (p.key === "rpm" && lo - pad < -SAT.rpmMax) hline(f.g, f, -SAT.rpmMax, "stroke:var(--code-del);stroke-dasharray:4 3", "wheel limit");
      const step = Math.max(1, Math.floor(run.length / 600));
      polyline(svg, run.filter((_, k) => k % step === 0).map((q) => [f.sx(q.t), f.sy(p.f(q))]), `stroke:${p.col};stroke-width:1.6`);
    }
    // Settling time (2% band) and overshoot.
    let settle = 0;
    const band = Math.max(0.02 * Math.abs(target), 0.05);
    for (const q of run) if (Math.abs(q.th / DEG - target) > band) settle = q.t;
    const peak = target >= 0 ? Math.max(...run.map((q) => q.th / DEG)) : Math.min(...run.map((q) => q.th / DEG));
    const over = target ? Math.max(0, ((peak - target) / target) * 100) : 0;
    o.settle.textContent = settle >= tEnd - 0.5 ? `> ${num(tEnd, 0)} s` : `${num(settle, 1)} s`;
    o.over.textContent = `${num(over, 1)}%`;
    const pk = Math.max(...run.map((q) => Math.abs(q.rpm)));
    o.peak.textContent = `${num(pk, 0)} rpm${pk >= SAT.rpmMax - 1 ? ": saturated" : ""}`;
    o.torque.textContent = `${num(Math.max(...run.map((q) => Math.abs(q.tau))) * 1e3, 2)} mN·m`;
  }

  function drawDay() {
    const td = s.dist.get() * 1e-6, mB = s.dipole.get() * 30e-6;
    const dt = 10, out = [];
    let hw = 0, dumping = false, dumps = 0;
    for (let t = 0; t <= 86400; t += dt) {
      out.push([t / 3600, (hw / HMAX) * 100, dumping]);
      if (!dumping && hw >= 0.8 * HMAX) { dumping = true; dumps++; }
      if (dumping && hw <= 0.1 * HMAX) dumping = false;
      hw += (td - (dumping ? mB : 0)) * dt;
      hw = Math.min(hw, HMAX);
    }
    const f = frame(svg, { box: [60, 24, 550, 350], x: [0, 24], y: [0, 105], xticks: [0, 4, 8, 12, 16, 20, 24], yticks: [0, 10, 50, 80, 100], yfmt: (v) => `${v}%`, xlabel: "hours", ylabel: "wheel momentum, % of capacity" });
    hline(f.g, f, 80, "stroke:currentColor;stroke-opacity:.45;stroke-dasharray:4 3", "dump at 80%");
    hline(f.g, f, 10, "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:2 3", "stop at 10%");
    let span = null;
    for (const [t, , d] of out) {
      if (d && span === null) span = t;
      if (!d && span !== null) { el("rect", { x: f.sx(span), y: f.T, width: Math.max(1, f.sx(t) - f.sx(span)), height: f.H, style: "fill:var(--vec-out);fill-opacity:.12" }, svg); span = null; }
    }
    polyline(svg, out.filter((_, k) => k % 6 === 0).map(([t, p]) => [f.sx(t), f.sy(p)]), `stroke:${BRAND};stroke-width:1.6`);
    const stuck = mB <= td && td > 0;
    o.dumps.textContent = td === 0 ? "0 (no disturbance)" : stuck ? "magnetorquer too weak: wheel saturates" : String(dumps);
    o.settle.textContent = o.over.textContent = o.peak.textContent = o.torque.textContent = "slew view";
  }

  function draw() {
    svg.replaceChildren();
    if (view === "slew") { drawSlew(); o.dumps.textContent = "day view"; } else drawDay();
  }
  draw();
}

// ============================================================ GNSS

const C = 299792458;
const RS = 26560e3, REm = 6371e3;
const BIAS = 0.28e-3 * C;
const SKIES = {
  good: [[0, 70], [60, 25], [130, 40], [200, 15], [250, 55], [310, 30], [20, 12], [170, 75]],
  high: [[0, 75], [60, 70], [120, 80], [180, 72], [240, 78], [300, 70], [30, 66], [200, 68]],
  cluster: [[40, 30], [55, 45], [70, 25], [60, 60], [80, 40], [45, 52], [65, 35], [50, 20]],
};
const satPos = ([az, elv]) => {
  const a = az * DEG, e = elv * DEG;
  const rho = Math.sqrt(RS * RS - REm * REm * Math.cos(e) ** 2) - REm * Math.sin(e);
  return [rho * Math.sin(a) * Math.cos(e), rho * Math.cos(a) * Math.cos(e), rho * Math.sin(e)];
};
/** Gauss–Newton on x, y, z, b from pseudoranges; returns the iterates. */
export function gnssSolve(sats, pr, x0) {
  let x = [...x0];
  const its = [x.slice()];
  for (let k = 0; k < 12; k++) {
    const H = [], r = [];
    sats.forEach((sp, i) => {
      const d = [sp[0] - x[0], sp[1] - x[1], sp[2] - x[2]];
      const rng_ = Math.hypot(...d);
      H.push([-d[0] / rng_, -d[1] / rng_, -d[2] / rng_, 1]);
      r.push(pr[i] - (rng_ + x[3]));
    });
    const HtH = [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((b) => H.reduce((s, row) => s + row[a] * row[b], 0)));
    const Htr = [0, 1, 2, 3].map((a) => H.reduce((s, row, i) => s + row[a] * r[i], 0));
    const dx = solve(HtH, Htr);
    if (!dx) break;
    x = x.map((v, i) => v + dx[i]);
    its.push(x.slice());
    if (Math.hypot(...dx) < 1e-4) break;
  }
  return its;
}
export function dop(sats, x) {
  const H = sats.map((sp) => {
    const d = [sp[0] - x[0], sp[1] - x[1], sp[2] - x[2]];
    const r = Math.hypot(...d);
    return [-d[0] / r, -d[1] / r, -d[2] / r, 1];
  });
  const HtH = [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((b) => H.reduce((s, row) => s + row[a] * row[b], 0)));
  const Q = inverse(HtH);
  if (!Q) return null;
  return { g: Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2] + Q[3][3]), p: Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2]), h: Math.sqrt(Q[0][0] + Q[1][1]), v: Math.sqrt(Q[2][2]) };
}

for (const root of document.querySelectorAll("[data-spc-gnss]")) {
  const sky = root.querySelector("[data-sky]");
  const cloud = root.querySelector("[data-cloud]");
  const iter = root.querySelector("[data-iter]");
  const o = outs(root);
  let sats = SKIES.good.map((p) => [...p]);
  let seed = 7, sel = 0;
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { sats = SKIES[v].map((p) => [...p]); draw(); });
  root.querySelector('[data-action="noise"]').addEventListener("click", () => { seed++; draw(); });

  const CX = 150, CY = 150, R = 120;
  const toXY = ([az, e]) => [CX + ((90 - e) / 90) * R * Math.sin(az * DEG), CY - ((90 - e) / 90) * R * Math.cos(az * DEG)];

  function draw(focus = false) {
    const n = Math.round(s.nsat.get()), sigma = s.sigma.get();
    const used = sats.slice(0, n);
    const pos = used.map(satPos);
    const rnd = rng(seed);
    const pr = pos.map((p) => Math.hypot(...p) + BIAS + sigma * rnd.normal());
    const its = gnssSolve(pos, pr, [0, 0, -REm, 0]);
    const sol = its[its.length - 1];
    const D = dop(pos, sol);

    // Sky plot.
    sky.replaceChildren();
    for (const e of [0, 30, 60]) el("circle", { cx: CX, cy: CY, r: ((90 - e) / 90) * R, style: "fill:none;stroke:currentColor;stroke-opacity:.15" }, sky);
    for (const [lbl, a0] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) text(sky, CX + (R + 11) * Math.sin(a0 * DEG), CY - (R + 11) * Math.cos(a0 * DEG) + 3, lbl, { "text-anchor": "middle" });
    text(sky, CX + 3, CY - ((90 - 30) / 90) * R - 3, "30°");
    text(sky, CX + 3, CY - ((90 - 60) / 90) * R - 3, "60°");
    sats.forEach((p, i) => {
      if (i >= n) return;
      const [x, y] = toXY(p);
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `Satellite ${i + 1}, azimuth ${Math.round(p[0])} degrees, elevation ${Math.round(p[1])} degrees`, "data-sat": i, style: "cursor:grab;outline:none" }, sky);
      el("circle", { cx: x, cy: y, r: 9, style: `fill:${i === sel ? BRAND : "var(--background)"};stroke:${i === sel ? BRAND : "currentColor"};stroke-opacity:${i === sel ? 1 : 0.6}` }, g);
      text(g, x, y + 3.5, String(i + 1), { "text-anchor": "middle", class: `font-mono text-[10px] ${i === sel ? "fill-background" : "fill-foreground"}` });
    });
    if (focus) sky.querySelector(`[data-sat="${sel}"]`)?.focus();

    // Cloud of noisy fixes from the truth, east and north error in metres.
    cloud.replaceChildren();
    const fixes = [];
    const r2 = rng(seed * 977 + 13);
    for (let k = 0; k < 300; k++) {
      const prk = pos.map((p) => Math.hypot(...p) + BIAS + sigma * r2.normal());
      const sk = gnssSolve(pos, prk, [0, 0, 0, BIAS]);
      fixes.push(sk[sk.length - 1]);
    }
    const hr = D ? D.h * sigma : 1;
    const span = Math.max(4 * hr, 1);
    const sc = 120 / span;
    el("line", { x1: 30, x2: 270, y1: 150, y2: 150, style: "stroke:currentColor;stroke-opacity:.15" }, cloud);
    el("line", { x1: 150, x2: 150, y1: 30, y2: 270, style: "stroke:currentColor;stroke-opacity:.15" }, cloud);
    for (const fx of fixes) {
      const x = 150 + fx[0] * sc, y = 150 - fx[1] * sc;
      if (x > 20 && x < 280 && y > 20 && y < 280) el("circle", { cx: x, cy: y, r: 1.6, style: "fill:var(--vec-u);fill-opacity:.55" }, cloud);
    }
    el("circle", { cx: 150, cy: 150, r: hr * sc, style: "fill:none;stroke:var(--vec-out);stroke-width:1.5" }, cloud);
    const fe = 150 + sol[0] * sc, fn = 150 - sol[1] * sc;
    el("circle", { cx: fe, cy: fn, r: 4, style: `fill:${BRAND}` }, cloud);
    text(cloud, 150, 292, `east–north error, ±${num(span, span < 10 ? 1 : 0)} m`, { "text-anchor": "middle" });
    text(cloud, 274, 146, "E", { "text-anchor": "end" });
    text(cloud, 154, 28, "N");

    // Convergence of this fix.
    iter.replaceChildren();
    const errs = its.map((x) => Math.max(Math.hypot(x[0], x[1], x[2]), 1e-3));
    const f = frame(iter, { box: [60, 12, 550, 120], x: [0, Math.max(5, its.length - 1)], y: [-3, 7], xticks: [...Array(Math.max(5, its.length - 1) + 1).keys()], yticks: [-3, -1, 1, 3, 5, 7], yfmt: (v) => `10${v < 0 ? "⁻" : ""}${"⁰¹²³⁴⁵⁶⁷"[Math.abs(v)]} m`, xlabel: "iteration", ylabel: "position error" });
    polyline(iter, errs.map((e, k) => [f.sx(k), f.sy(Math.log10(e))]), `stroke:${BRAND};stroke-width:1.6`);
    errs.forEach((e, k) => el("circle", { cx: f.sx(k), cy: f.sy(Math.log10(e)), r: 3, style: `fill:${BRAND}` }, iter));
    hline(f.g, f, Math.log10(Math.max(sigma, 1e-3)), "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:4 3", "σ");

    if (D) {
      o.gdop.textContent = num(D.g, 2);
      o.pdop.textContent = num(D.p, 2);
      o.hdop.textContent = num(D.h, 2);
      o.vdop.textContent = num(D.v, 2);
    } else o.gdop.textContent = o.pdop.textContent = o.hdop.textContent = o.vdop.textContent = "singular";
    o.iters.textContent = String(its.length - 1);
    o.err.textContent = `${num(Math.hypot(sol[0], sol[1]), 1)} m horizontal, ${num(Math.abs(sol[2]), 1)} m vertical`;
    o.bias.textContent = `${num((sol[3] / C) * 1e3, 6)} ms (${num(sol[3] / 1000, 3)} km)`;
  }

  let drag = null;
  sky.addEventListener("pointerdown", (ev) => {
    const g = ev.target.closest("[data-sat]");
    if (!g) return;
    sel = Number(g.dataset.sat);
    drag = true;
    sky.setPointerCapture?.(ev.pointerId);
    draw();
  });
  sky.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = svgPoint(sky, ev);
    const dx = p.x - CX, dy = CY - p.y;
    const rr = Math.min(R, Math.hypot(dx, dy));
    sats[sel] = [((Math.atan2(dx, dy) / DEG) + 360) % 360, Math.max(5, 90 - (rr / R) * 90)];
    draw();
  });
  const end = () => { drag = null; };
  sky.addEventListener("pointerup", end);
  sky.addEventListener("pointercancel", end);
  sky.addEventListener("focusin", (ev) => {
    const g = ev.target.closest?.("[data-sat]");
    if (g && Number(g.dataset.sat) !== sel) { sel = Number(g.dataset.sat); draw(true); }
  });
  sky.addEventListener("keydown", (ev) => {
    const g = ev.target.closest?.("[data-sat]");
    if (!g) return;
    const p = sats[sel];
    if (ev.key === "ArrowLeft") p[0] = (p[0] + 355) % 360;
    else if (ev.key === "ArrowRight") p[0] = (p[0] + 5) % 360;
    else if (ev.key === "ArrowUp") p[1] = Math.min(90, p[1] + 5);
    else if (ev.key === "ArrowDown") p[1] = Math.max(5, p[1] - 5);
    else return;
    ev.preventDefault();
    draw(true);
  });
  draw();
}

// ============================================================ decay

// Vallado's exponential atmosphere: base altitude (km), base density
// (kg/m³) and scale height (km) for each band.
const ATMOS = [
  [0, 1.225, 7.249], [25, 3.899e-2, 6.349], [30, 1.774e-2, 6.682], [40, 3.972e-3, 7.554], [50, 1.057e-3, 8.382],
  [60, 3.206e-4, 7.714], [70, 8.77e-5, 6.549], [80, 1.905e-5, 5.799], [90, 3.396e-6, 5.382], [100, 5.297e-7, 5.877],
  [110, 9.661e-8, 7.263], [120, 2.438e-8, 9.473], [130, 8.484e-9, 12.636], [140, 3.845e-9, 16.149], [150, 2.07e-9, 22.523],
  [180, 5.464e-10, 29.74], [200, 2.789e-10, 37.105], [250, 7.248e-11, 45.546], [300, 2.418e-11, 53.628], [350, 9.518e-12, 53.298],
  [400, 3.725e-12, 58.515], [450, 1.585e-12, 60.828], [500, 6.967e-13, 63.822], [600, 1.454e-13, 71.835], [700, 3.614e-14, 88.667],
  [800, 1.17e-14, 124.64], [900, 5.245e-15, 181.05], [1000, 3.019e-15, 268],
];
export const density = (h) => {
  let b = ATMOS[0];
  for (const row of ATMOS) if (h >= row[0]) b = row;
  return b[1] * Math.exp(-(h - b[0]) / b[2]);
};
const SOLAR = { low: 0.4, mod: 1, high: 3 };
const CRAFT = { u1: { m: 1.33, area: 0.01, cd: 2.2 }, u3: { m: 4, area: 0.06, cd: 2.2 }, smallsat: { m: 100, area: 0.8, cd: 2.2 }, iss: { m: 420000, area: 1600, cd: 2.2 } };
const YEAR = 365.25 * 86400;
/** Altitude history until 120 km or 200 years; returns [[t (s), h (km)]]. */
export function decay(h0, bInv, factor) {
  let h = h0, t = 0;
  const out = [[0, h]];
  while (h > 120 && t < 200 * YEAR) {
    const a = (RE + h) * 1e3;
    const rate = Math.sqrt(MU * 1e9 * a) * density(h) * factor * bInv / 1e3; // km/s
    const dt = Math.min(Math.max(0.25 / rate, 60), 30 * 86400);
    h -= rate * dt;
    t += dt;
    out.push([t, h]);
  }
  return out;
}

for (const root of document.querySelectorAll("[data-spc-decay]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let solar = "mod";
  const s = scrubAll(root, (name) => { if (name !== "alt") setSeg(root, "Spacecraft", ""); draw(); });
  setSeg(root, "Solar activity", solar);
  onSeg(root, (label, v) => {
    if (label === "Solar activity") solar = v;
    else { const c = CRAFT[v]; s.m.set(c.m, false); s.area.set(c.area, false); s.cd.set(c.cd, false); }
    draw();
  });

  function draw() {
    const m = s.m.get(), A = s.area.get(), cd = s.cd.get(), h0 = s.alt.get();
    const bInv = (cd * A) / m;
    const runs = Object.fromEntries(Object.entries(SOLAR).map(([k, f]) => [k, decay(h0, bInv, f)]));
    svg.replaceChildren();
    // Log time axis from 1 day to 200 years.
    const x0 = 0, x1 = Math.log10(200 * 365.25);
    const f = frame(svg, { box: [56, 20, 550, 320], x: [x0, x1], y: [100, Math.ceil(h0 / 100) * 100], xticks: [0, 1, Math.log10(30), Math.log10(365.25), Math.log10(3652.5), Math.log10(25 * 365.25), Math.log10(73050)], xfmt: (x) => ({ 0: "1 day", 1: "10 days" })[x] ?? (Math.abs(x - Math.log10(30)) < 0.01 ? "1 month" : Math.abs(x - Math.log10(365.25)) < 0.01 ? "1 yr" : Math.abs(x - Math.log10(3652.5)) < 0.01 ? "10 yr" : Math.abs(x - Math.log10(25 * 365.25)) < 0.01 ? "25 yr" : "200 yr"), yticks: [100, 200, 300, 400, 500, 600, 700, 800, 900].filter((v) => v <= Math.ceil(h0 / 100) * 100), yfmt: (v) => `${v} km`, xlabel: "time (log scale)", ylabel: "altitude" });
    el("line", { x1: f.sx(Math.log10(25 * 365.25)), x2: f.sx(Math.log10(25 * 365.25)), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:4 3" }, svg);
    hline(f.g, f, 120, "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:2 3", "re-entry, 120 km");
    const style = { low: "stroke:var(--vec-u);stroke-width:1.2;stroke-opacity:.8", mod: "stroke:currentColor;stroke-opacity:.45;stroke-width:1.2", high: "stroke:var(--code-del);stroke-width:1.2;stroke-opacity:.8" };
    for (const k of ["low", "mod", "high"]) {
      const st = k === solar ? `stroke:${BRAND};stroke-width:2.2` : style[k];
      const pts = runs[k].filter(([t]) => t >= 86400).map(([t, h]) => [f.sx(Math.min(x1, Math.log10(t / 86400))), f.sy(Math.max(100, h))]);
      pts.unshift([f.sx(0), f.sy(runs[k].find(([t]) => t >= 86400)?.[1] ?? h0)]);
      polyline(svg, pts, st);
    }
    const life = runs[solar][runs[solar].length - 1][0];
    const done = runs[solar][runs[solar].length - 1][1] <= 120;
    const rate0 = Math.sqrt(MU * 1e9 * (RE + h0) * 1e3) * density(h0) * SOLAR[solar] * bInv / 1e3 * 86400;
    o.bc.textContent = `${num(m / (cd * A), 1)} kg/m²`;
    o.life.textContent = !done ? "> 200 years" : life < 86400 * 60 ? `${num(life / 86400, 1)} days` : life < 2 * YEAR ? `${num(life / (YEAR / 12), 1)} months` : `${num(life / YEAR, 1)} years`;
    o.rate.textContent = rate0 >= 1 ? `${num(rate0, 2)} km/day` : `${num(rate0 * 1000, 1)} m/day`;
    o.rho.textContent = fmtSI(density(h0) * SOLAR[solar], "kg/m³");
    o.rule.textContent = done && life <= 25 * YEAR ? "meets it" : "fails: needs a de-orbit plan";
  }
  draw();
}
