// Classical physics blocks. Every picture is computed from the equations of
// motion: RK4 for trajectories and pendulums, velocity Verlet (symplectic)
// for orbits, closed forms where they exist (collisions, inclines, Snell).

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { P, arrow, handle } from "./svg.js";

const G = 9.81; // m/s²
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const PALETTE = ["var(--brand)", "var(--vec-u)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)"];

// A real-time loop that runs only while playing and on screen. tick gets the
// elapsed milliseconds and returns false to stop.
function loop(root, tick, onState) {
  let playing = false, visible = false, raf = 0, last = 0;
  const frameFn = (now) => {
    const ms = Math.min(50, now - last);
    last = now;
    const go = tick(ms) !== false;
    if (!go) set(false);
    raf = playing && visible ? requestAnimationFrame(frameFn) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frameFn); } };
  function set(p) {
    playing = p;
    onState?.(p);
    if (!p && raf) { cancelAnimationFrame(raf); raf = 0; }
    kick();
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return { set, get playing() { return playing; } };
}

function playButton(btn, idle) {
  return (playing) => {
    if (!btn) return;
    // SVG elements have no .hidden property: toggle the attribute.
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? "Pause" : idle;
  };
}

// The unit label that follows a field's input.
const unitOf = (root, name) => root.querySelector(`[data-scrub="${name}"]`)?.parentElement?.lastElementChild;

// ============================================================ Projectile

function launch(angle, speed, model, k, dt = 0.002) {
  let x = 0, y = 0, vx = speed * Math.cos(rad(angle)), vy = speed * Math.sin(rad(angle));
  const acc = (vx, vy) => {
    if (model === "linear") return [-k * vx, -G - k * vy];
    if (model === "quadratic") { const v = Math.hypot(vx, vy); return [-k * v * vx, -G - k * v * vy]; }
    return [0, -G];
  };
  const pts = [[0, 0]];
  let t = 0, apex = 0;
  for (let i = 0; i < 400000; i++) {
    // RK4 on (x, y, vx, vy).
    const a1 = acc(vx, vy);
    const a2 = acc(vx + (dt / 2) * a1[0], vy + (dt / 2) * a1[1]);
    const a3 = acc(vx + (dt / 2) * a2[0], vy + (dt / 2) * a2[1]);
    const a4 = acc(vx + dt * a3[0], vy + dt * a3[1]);
    const nx = x + (dt / 6) * (vx + 2 * (vx + (dt / 2) * a1[0]) + 2 * (vx + (dt / 2) * a2[0]) + (vx + dt * a3[0]));
    const ny = y + (dt / 6) * (vy + 2 * (vy + (dt / 2) * a1[1]) + 2 * (vy + (dt / 2) * a2[1]) + (vy + dt * a3[1]));
    const nvx = vx + (dt / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
    const nvy = vy + (dt / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
    if (ny < 0) { // land: interpolate the crossing
      const f = y / (y - ny);
      const lx = x + f * (nx - x);
      pts.push([lx, 0]);
      return { pts, range: lx, apex, time: t + f * dt };
    }
    x = nx; y = ny; vx = nvx; vy = nvy; t += dt;
    apex = Math.max(apex, y);
    if (i % 10 === 0) pts.push([x, y]);
  }
  return { pts, range: x, apex, time: t };
}

for (const root of document.querySelectorAll("[data-proj]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let model = "none";
  const shots = [];
  let anim = null;
  const s = scrubAll(root, () => draw());
  const MODELS = {
    none: ["a = −g ŷ", ""],
    linear: ["a = −g ŷ − k v   (k in 1/s)", "1/s"],
    quadratic: ["a = −g ŷ − k |v| v   (k in 1/m)", "1/m"],
  };

  const bestAngle = () => {
    if (model === "none") return 45;
    let best = 0, ba = 45;
    for (let a = 1; a <= 89; a += 0.5) {
      const r = launch(a, s.speed.get(), model, s.k.get(), 0.005).range;
      if (r > best) { best = r; ba = a; }
    }
    return ba;
  };

  function draw() {
    const a = s.angle.get(), v = s.speed.get(), k = s.k.get();
    const cur = launch(a, v, model, k);
    const ideal = (v * v * Math.sin(2 * rad(a))) / G;
    const all = [cur, ...shots.map((x) => x.r)];
    const xmax = Math.max(10, ...all.map((r) => r.range), (v * v) / G) * 1.05;
    const ymax = Math.max(5, ...all.map((r) => r.apex), (v * v) / (2 * G) * 0.55) * 1.15;
    svg.replaceChildren();
    const nice = (m) => { const p = 10 ** Math.floor(Math.log10(m)); return [1, 2, 5, 10].map((n) => n * p).find((n) => m / n <= 6); };
    const ticks = (m) => { const st = nice(m); return Array.from({ length: Math.floor(m / st) + 1 }, (_, i) => i * st); };
    const f = frame(svg, { box: [44, 14, 580, 290], x: [0, xmax], y: [0, ymax], xticks: ticks(xmax), yticks: ticks(ymax), xlabel: "x (m)", ylabel: "y (m)" });
    shots.forEach((sh, i) => {
      polyline(svg, sh.r.pts.map(([x, y]) => [f.sx(x), f.sy(y)]), `stroke:${PALETTE[i % PALETTE.length]};stroke-width:1.75`);
      const end = sh.r.pts.at(-1);
      text(svg, f.sx(end[0]), f.sy(0) - 6, `${sh.a}°`, { "text-anchor": "middle", style: `fill:${PALETTE[i % PALETTE.length]}` });
    });
    polyline(svg, cur.pts.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-width:1.25;stroke-dasharray:4 4;stroke-opacity:0.6");
    if (model !== "none") el("line", { x1: f.sx(ideal), x2: f.sx(ideal), y1: f.sy(0), y2: f.sy(0) - 10, style: "stroke:var(--foreground);stroke-opacity:0.5" }, svg);
    // The ball of the latest launch.
    if (anim) {
      const p = anim.r.pts[Math.min(anim.r.pts.length - 1, anim.i)];
      el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    }
    o.model.textContent = MODELS[model][0];
    o.range.textContent = `${num(cur.range, 2)} m`;
    o.apex.textContent = `${num(cur.apex, 2)} m`;
    o.time.textContent = `${num(cur.time, 2)} s`;
    o.ideal.textContent = `${num(ideal, 2)} m`;
    o.best.textContent = `${num(bestAngle(), 1)}°`;
  }

  root.addEventListener("seg-change", (e) => {
    model = e.detail.value;
    const u = unitOf(root, "k");
    if (u) u.textContent = MODELS[model][1];
    if (model === "quadratic" && s.k.get() > 0.05) s.k.set(0.01, false);
    if (model === "linear" && s.k.get() < 0.02) s.k.set(0.1, false);
    draw();
  });
  const runner = loop(root, (ms) => {
    anim.t += ms / 1000;
    // pts are sampled every 10 RK4 steps of 2 ms: 20 ms of flight per point.
    anim.i = Math.floor(anim.t / 0.02);
    draw();
    if (anim.i >= anim.r.pts.length - 1) { anim = null; draw(); return false; }
  });
  root.querySelector("[data-action=launch]").addEventListener("click", () => {
    const a = s.angle.get();
    const r = launch(a, s.speed.get(), model, s.k.get());
    shots.push({ a, r });
    if (shots.length > PALETTE.length) shots.shift();
    if (reduced()) return draw();
    anim = { r, t: 0, i: 0 };
    runner.set(true);
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { shots.length = 0; anim = null; draw(); });
  draw();
}

// ============================================================ Pendulum

// Exact period of the undamped pendulum: T = 2π√(L/g) / AGM(1, cos(θ₀/2)).
function agm(a, b) {
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

function swing({ amp, L, gamma, A, w }, linear, T = 20, dt = 0.002) {
  const w0 = G / L;
  const f = (t, th, om) => -w0 * (linear ? th : Math.sin(th)) - gamma * om + A * Math.cos(w * t);
  let th = rad(amp), om = 0;
  const out = [[0, th]];
  for (let i = 1, t = 0; t < T; i++) {
    const k1 = [om, f(t, th, om)];
    const k2 = [om + (dt / 2) * k1[1], f(t + dt / 2, th + (dt / 2) * k1[0], om + (dt / 2) * k1[1])];
    const k3 = [om + (dt / 2) * k2[1], f(t + dt / 2, th + (dt / 2) * k2[0], om + (dt / 2) * k2[1])];
    const k4 = [om + dt * k3[1], f(t + dt, th + dt * k3[0], om + dt * k3[1])];
    th += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    om += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    t = i * dt;
    if (i % 10 === 0) out.push([t, th]);
  }
  return out;
}

for (const root of document.querySelectorAll("[data-pend]")) {
  const sw = root.querySelector("[data-swing]");
  const plot = root.querySelector("[data-plot]");
  const res = root.querySelector("[data-res]");
  const o = outs(root);
  let nl = [], lin = [], t = 0, f;
  const s = scrubAll(root, compute);
  const params = () => ({ amp: s.amp.get(), L: s.len.get(), gamma: s.gamma.get(), A: s.drive.get(), w: s.omega.get() });

  function compute() {
    const p = params();
    nl = swing(p, false);
    lin = swing(p, true);
    const T0 = 2 * Math.PI * Math.sqrt(p.L / G);
    const T = T0 / agm(1, Math.cos(rad(p.amp) / 2));
    o.period.textContent = `${num(T, 3)} s`;
    o.ideal.textContent = `${num(T0, 3)} s`;
    o.ratio.textContent = `×${num(T / T0, 3)}`;

    plot.replaceChildren();
    const m = Math.max(10, ...nl.map(([, th]) => Math.abs(deg(th))), ...lin.map(([, th]) => Math.abs(deg(th))));
    const ym = Math.min(400, Math.ceil(m / 10) * 10);
    f = frame(plot, { box: [44, 20, 466, 150], x: [0, 20], y: [-ym, ym], xticks: [0, 5, 10, 15, 20], yticks: [-ym, 0, ym], xlabel: "t (s)", ylabel: "θ (°)", yfmt: (v) => String(v).replace("-", "−") });
    const clampY = (v) => Math.max(-ym, Math.min(ym, deg(v)));
    polyline(plot, lin.map(([tt, th]) => [f.sx(tt), f.sy(clampY(th))]), "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:4 3");
    polyline(plot, nl.map(([tt, th]) => [f.sx(tt), f.sy(clampY(th))]), "stroke:var(--foreground);stroke-width:1.6");
    plot.append(f.cursor = el("line", { y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1" }));

    // Steady-state amplitude of the linearised driven oscillator.
    res.replaceChildren();
    const w0 = Math.sqrt(G / p.L);
    const ampAt = (w) => deg(p.A / Math.sqrt((w0 * w0 - w * w) ** 2 + (p.gamma * w) ** 2));
    const r = frame(res, { box: [44, 20, 466, 80], x: [0, 10], y: [0, 90], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 45, 90], xlabel: "drive ω (rad/s)", ylabel: "steady amplitude (°, linear model)" });
    if (p.A > 0) {
      const pts = Array.from({ length: 300 }, (_, i) => { const w = 0.01 + (i / 299) * 10; return [r.sx(w), r.sy(Math.min(90, ampAt(w)))]; });
      polyline(res, pts, "stroke:var(--brand);stroke-width:1.5");
      el("circle", { cx: r.sx(p.w), cy: r.sy(Math.min(90, ampAt(p.w))), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, res);
    } else text(res, r.L + r.W / 2, r.T + r.H / 2, "set a drive amplitude to see resonance", { "text-anchor": "middle" });
    el("line", { x1: r.sx(w0), x2: r.sx(w0), y1: r.T, y2: r.T + r.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:2 3" }, res);
    text(res, r.sx(w0) + 4, r.T + 8, `ω₀ ${num(w0, 2)}`);
    t = 0;
    drawSwing();
  }

  const at = (series, tt) => series[Math.min(series.length - 1, Math.round(tt / 0.02))][1];
  function drawSwing() {
    sw.replaceChildren();
    const L = 1; // drawn length; the physics uses the real L
    el("line", { x1: -0.5, x2: 0.5, y1: 0, y2: 0, style: "stroke:currentColor;stroke-opacity:0.4;stroke-width:2px", "vector-effect": "non-scaling-stroke" }, sw);
    const bob = (th, style, r) => {
      const x = L * Math.sin(th), y = L * Math.cos(th);
      el("line", { x1: 0, y1: 0, x2: x, y2: y, style: `${style};stroke-width:1.5px`, "vector-effect": "non-scaling-stroke" }, sw);
      el("circle", { cx: x, cy: y, r, style: style.replace("stroke", "fill") }, sw);
    };
    bob(at(lin, t), "stroke:var(--vec-u);stroke-opacity:0.6", 0.07);
    bob(at(nl, t), "stroke:var(--foreground)", 0.1);
    el("circle", { cx: 0, cy: 0, r: 0.03, style: "fill:var(--foreground)" }, sw);
    if (f?.cursor) { f.cursor.setAttribute("x1", f.sx(t)); f.cursor.setAttribute("x2", f.sx(t)); }
  }

  const runner = loop(root, (ms) => { t = (t + ms / 1000) % 20; drawSwing(); });
  compute();
  if (!reduced()) runner.set(true);
}

// ============================================================ Oscillator

for (const root of document.querySelectorAll("[data-osc]")) {
  const xt = root.querySelector("[data-xt]");
  const ph = root.querySelector("[data-phase]");
  const o = outs(root);
  let series = [], t = 0, dots = [];
  const s = scrubAll(root, compute);

  function compute() {
    const z = s.zeta.get(), w0 = s.w0.get();
    let x = s.x0.get(), v = s.v0.get();
    const acc = (x, v) => -2 * z * w0 * v - w0 * w0 * x;
    const dt = 0.002, T = 15;
    series = [[0, x, v]];
    for (let i = 1; i <= T / dt; i++) {
      const k1 = [v, acc(x, v)];
      const k2 = [v + (dt / 2) * k1[1], acc(x + (dt / 2) * k1[0], v + (dt / 2) * k1[1])];
      const k3 = [v + (dt / 2) * k2[1], acc(x + (dt / 2) * k2[0], v + (dt / 2) * k2[1])];
      const k4 = [v + dt * k3[1], acc(x + dt * k3[0], v + dt * k3[1])];
      x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      v += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      if (i % 10 === 0) series.push([i * dt, x, v]);
    }
    const xm = Math.max(0.1, ...series.map((r) => Math.abs(r[1]))) * 1.1;
    const vm = Math.max(0.1, ...series.map((r) => Math.abs(r[2]))) * 1.1;
    const sym = (v) => v.toFixed(Math.abs(v) < 1 ? 2 : 1).replace("-", "−");

    xt.replaceChildren();
    const a = frame(xt, { box: [44, 22, 346, 204], x: [0, T], y: [-xm, xm], xticks: [0, 5, 10, 15], yticks: [-xm, 0, xm].map((v) => +v.toFixed(2)), yfmt: sym, xlabel: "t (s)", ylabel: "x (m)" });
    if (z < 1) { // the envelope ±x₀·e^(−ζω₀t) of the underdamped case
      const amp0 = Math.hypot(series[0][1], (series[0][2] + z * w0 * series[0][1]) / (w0 * Math.sqrt(1 - z * z)));
      for (const sg of [1, -1]) polyline(xt, series.map(([tt]) => [a.sx(tt), a.sy(Math.max(-xm, Math.min(xm, sg * amp0 * Math.exp(-z * w0 * tt))))]), "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 4");
    }
    polyline(xt, series.map(([tt, x]) => [a.sx(tt), a.sy(x)]), "stroke:var(--foreground);stroke-width:1.6");

    ph.replaceChildren();
    const b = frame(ph, { box: [44, 22, 206, 204], x: [-xm, xm], y: [-vm, vm], xticks: [-xm, 0, xm].map((v) => +v.toFixed(2)), yticks: [-vm, 0, vm].map((v) => +v.toFixed(2)), xfmt: sym, yfmt: sym, xlabel: "x", ylabel: "v (m/s)" });
    polyline(ph, series.map(([, x, v]) => [b.sx(x), b.sy(v)]), "stroke:var(--vec-u);stroke-width:1.5");
    el("circle", { cx: b.sx(series[0][1]), cy: b.sy(series[0][2]), r: 3, style: "fill:var(--vec-u)" }, ph);
    dots = [
      [xt, el("circle", { r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, xt), (r) => [a.sx(r[0]), a.sy(r[1])]],
      [ph, el("circle", { r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, ph), (r) => [b.sx(r[1]), b.sy(r[2])]],
    ];

    const regime = z === 0 ? "undamped" : Math.abs(z - 1) < 0.005 ? "critically damped" : z < 1 ? "underdamped" : "overdamped";
    o.regime.textContent = regime;
    o.wd.textContent = z < 1 ? `${num(w0 * Math.sqrt(1 - z * z), 3)} rad/s` : "— (no oscillation)";
    o.q.textContent = z === 0 ? "∞" : num(1 / (2 * z), 2);
    const E = (r) => 0.5 * r[2] * r[2] + 0.5 * w0 * w0 * r[1] * r[1];
    const e0 = E(series[0]);
    o.left.textContent = e0 > 0 ? `${num((100 * E(series[Math.round(10 / 0.02)])) / e0, 2)}%` : "—";
    t = 0;
    place();
  }

  function place() {
    const r = series[Math.min(series.length - 1, Math.round(t / 0.02))];
    for (const [, d, pos] of dots) { const [x, y] = pos(r); d.setAttribute("cx", x); d.setAttribute("cy", y); }
  }
  const runner = loop(root, (ms) => { t = (t + ms / 1000) % 15; place(); });
  compute();
  if (!reduced()) runner.set(true);
}

// ============================================================ Orbits

const GM = 4 * Math.PI * Math.PI; // AU³/yr²: the Sun

for (const root of document.querySelectorAll("[data-phys-orbit]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"), "Play");
  let path = [], T = null, idx = 0, wedges = true, scale = 1;
  const VSCALE = 0.18; // AU drawn per AU/yr of velocity
  const s = scrubAll(root, compute);

  const layer = el("g", {}, svg);
  const planet = el("circle", { r: 0.09, style: "fill:var(--vec-u);stroke:var(--background);stroke-width:2px", "vector-effect": "non-scaling-stroke" });
  const top = el("g", {}, svg);
  const tip = handle(svg, top, "Launch velocity", ([x, y]) => {
    const vx = (x - 1) / VSCALE, vy = y / VSCALE;
    s.v.set(Math.hypot(vx, vy), false);
    s.dir.set(Math.max(-80, Math.min(80, deg(Math.atan2(vx, vy)))), false);
    compute();
  });

  function compute() {
    const v = s.v.get(), d = rad(s.dir.get());
    let r = [1, 0], vel = [v * Math.sin(d), v * Math.cos(d)];
    const accel = ([x, y]) => { const r3 = Math.hypot(x, y) ** 3; return [(-GM * x) / r3, (-GM * y) / r3]; };
    const E0 = 0.5 * v * v - GM;
    const bound = E0 < 0;
    const a = bound ? -GM / (2 * E0) : null;
    T = bound ? a ** 1.5 : null;
    const tmax = bound ? Math.min(T, 40) : 6;
    const dt = 0.0002;
    path = [[0, r[0], r[1]]];
    let acc = accel(r), drift = 0;
    for (let i = 1, t = 0; t < tmax; i++) {
      // Velocity Verlet: symplectic, so energy does not drift away.
      const half = [vel[0] + 0.5 * dt * acc[0], vel[1] + 0.5 * dt * acc[1]];
      r = [r[0] + dt * half[0], r[1] + dt * half[1]];
      acc = accel(r);
      vel = [half[0] + 0.5 * dt * acc[0], half[1] + 0.5 * dt * acc[1]];
      t = i * dt;
      const E = 0.5 * (vel[0] ** 2 + vel[1] ** 2) - GM / Math.hypot(...r);
      drift = Math.max(drift, Math.abs((E - E0) / E0));
      if (i % 10 === 0) path.push([t, r[0], r[1]]);
      if (Math.hypot(...r) > 8 || Math.hypot(...r) < 0.02) break;
    }
    // Eccentricity vector: ((v² − GM/r) r − (r·v) v) / GM at launch.
    const v0 = [v * Math.sin(d), v * Math.cos(d)], r0 = [1, 0];
    const rv = r0[0] * v0[0] + r0[1] * v0[1];
    const ev = [((v * v - GM) * r0[0] - rv * v0[0]) / GM, ((v * v - GM) * r0[1] - rv * v0[1]) / GM];
    const ecc = Math.hypot(...ev);

    // Fit the view to the orbit (4:3, never smaller than ±4 AU).
    const xs = path.map((p) => p[1]).concat([0, 1]), ys = path.map((p) => p[2]).concat([0]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const w = Math.min(24, Math.max(8, (x1 - x0) * 1.15, ((y1 - y0) * 1.15 * 4) / 3)), hv = (w * 3) / 4;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    svg.setAttribute("viewBox", `${cx - w / 2} ${-cy - hv / 2} ${w} ${hv}`);
    scale = w / 8;
    tip.node.setAttribute("r", 0.22 * scale);
    tip.node.nextElementSibling?.setAttribute("r", 0.11 * scale);
    planet.setAttribute("r", 0.09 * scale);

    o.e.textContent = `${num(E0, 2)} AU²/yr²`;
    o.drift.textContent = `${(drift * 100).toExponential(1)} %`;
    o.ecc.textContent = num(ecc, 3);
    o.period.textContent = T ? `${num(T, 3)} yr` : "—";
    o.kind.textContent = !bound ? (Math.abs(E0) < 1e-3 ? "parabolic: escapes" : "hyperbolic: escapes") : ecc < 0.01 ? "circular" : "elliptical";
    idx = 0;
    draw();
  }

  function draw() {
    layer.replaceChildren();
    // Equal-time wedges (Kepler II): one per twelfth of the period.
    if (wedges && T) {
      const n = 12, per = path.length / n;
      for (let k = 0; k < n; k += 2) {
        const seg = path.slice(Math.round(k * per), Math.round((k + 1) * per) + 1);
        const d = "M0,0 L" + seg.map(([, x, y]) => P([x, y]).join(",")).join(" L") + " Z";
        el("path", { d, style: "fill:var(--brand);fill-opacity:0.14;stroke:var(--brand);stroke-opacity:0.35;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, layer);
      }
    }
    el("path", { d: "M" + path.map(([, x, y]) => P([x, y]).join(",")).join(" L"), style: "fill:none;stroke:var(--foreground);stroke-width:1.5px;stroke-opacity:0.8", "vector-effect": "non-scaling-stroke" }, layer);
    el("circle", { cx: 0, cy: 0, r: 0.16 * scale, style: "fill:var(--vec-out)" }, layer);
    const v = s.v.get(), d = rad(s.dir.get());
    const tipW = [1 + VSCALE * v * Math.sin(d), VSCALE * v * Math.cos(d)];
    arrow(layer, [1, 0], tipW, "var(--vec-u)", 1.75, 0.18 * scale);
    const p = path[Math.min(idx, path.length - 1)];
    planet.setAttribute("cx", p[1]);
    planet.setAttribute("cy", -p[2]);
    layer.append(planet);
    tip.place(tipW, "var(--vec-u)");
  }

  // 1 year of orbit = 4 s of animation.
  const runner = loop(root, (ms) => {
    idx += Math.max(1, Math.round((ms / 4000) / 0.002));
    if (idx >= path.length) { if (T) idx = 0; else { idx = path.length - 1; draw(); return false; } }
    draw();
  }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => runner.set(!runner.playing));
  root.querySelector("[data-action=circular]").addEventListener("click", () => { s.v.set(2 * Math.PI, false); s.dir.set(0, false); compute(); });
  root.querySelectorAll("[data-toggle=wedges]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { wedges = e.detail.checked; draw(); }));
  compute();
}

// ============================================================ Energy track

const track = {
  h: (x) => 2 + 1.5 * Math.cos((Math.PI * x) / 5) - 0.4 * Math.sin((3 * Math.PI * x) / 5),
  d: (x) => -1.5 * (Math.PI / 5) * Math.sin((Math.PI * x) / 5) - 0.4 * ((3 * Math.PI) / 5) * Math.cos((3 * Math.PI * x) / 5),
  dd: (x) => -1.5 * (Math.PI / 5) ** 2 * Math.cos((Math.PI * x) / 5) + 0.4 * ((3 * Math.PI) / 5) ** 2 * Math.sin((3 * Math.PI * x) / 5),
};

for (const root of document.querySelectorAll("[data-track]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const bars = Object.fromEntries([...root.querySelectorAll("[data-bar]")].map((n) => [n.dataset.bar, n]));
  const setPlay = playButton(root.querySelector("[data-action=play]"), "Release");
  let x, v, t, E0, heat;
  const s = scrubAll(root, () => { runner.set(false); reset(); });

  // Bead on y = h(x), coordinate x. Lagrange gives
  // ẍ = −(g h′ + h′h″ẋ²)/(1 + h′²); friction μN acts along the track.
  const accel = (x, v) => {
    const d = track.d(x), dd = track.dd(x), q = 1 + d * d;
    const N = Math.abs(G + dd * v * v) / Math.sqrt(q);
    const fr = v === 0 ? 0 : (Math.sign(v) * s.mu.get() * N) / Math.sqrt(q);
    return -(G * d + d * dd * v * v) / q - fr;
  };
  const energy = () => {
    const d = track.d(x);
    return { ke: 0.5 * v * v * (1 + d * d), pe: G * track.h(x) };
  };

  function reset() {
    x = s.x0.get(); v = 0; t = 0; heat = 0;
    E0 = G * track.h(x);
    draw();
  }

  function step(dt) {
    const k1 = [v, accel(x, v)];
    const k2 = [v + (dt / 2) * k1[1], accel(x + (dt / 2) * k1[0], v + (dt / 2) * k1[1])];
    const k3 = [v + (dt / 2) * k2[1], accel(x + (dt / 2) * k2[0], v + (dt / 2) * k2[1])];
    const k4 = [v + dt * k3[1], accel(x + dt * k3[0], v + dt * k3[1])];
    const nv = v + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    // Friction can stop the bead but never reverse it.
    v = s.mu.get() > 0 && Math.sign(nv) !== Math.sign(v) && v !== 0 ? 0 : nv;
    if (x < 0) { x = -x; v = -v; }
    if (x > 10) { x = 20 - x; v = -v; }
    t += dt;
  }

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 16, 584, 250], x: [0, 10], y: [0, 4.5], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 1, 2, 3, 4], xlabel: "x (m)", ylabel: "height (m)" });
    const pts = Array.from({ length: 241 }, (_, i) => { const xx = (i / 240) * 10; return [f.sx(xx), f.sy(track.h(xx))]; });
    el("path", { d: `M${pts.map((p) => p.join(",")).join(" L")} L${f.sx(10)},${f.sy(0)} L${f.sx(0)},${f.sy(0)} Z`, style: "fill:currentColor;fill-opacity:0.05" }, svg);
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:2");
    hline(svg, f, E0 / G, "stroke:var(--ion-cl);stroke-dasharray:4 4;stroke-opacity:0.7", "starting height");
    el("circle", { cx: f.sx(x), cy: f.sy(track.h(x)) - 8, r: 8, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    const { ke, pe } = energy();
    if (s.mu.get() > 0) heat = Math.max(0, E0 - ke - pe);
    const total = ke + pe + heat;
    const pct = (v) => `${Math.max(0, Math.min(100, (100 * v) / E0))}%`;
    bars.ke.style.width = pct(ke); bars.pe.style.width = pct(pe); bars.heat.style.width = pct(heat); bars.total.style.width = pct(total);
    o.ke.textContent = `${num(ke, 2)} J`; o.pe.textContent = `${num(pe, 2)} J`; o.heat.textContent = `${num(heat, 2)} J`; o.total.textContent = `${num(total, 2)} J`;
    o.t.textContent = `${num(t, 1)} s`;
    o.speed.textContent = `${num(Math.abs(v) * Math.sqrt(1 + track.d(x) ** 2), 2)} m/s`;
    o.height.textContent = `${num(track.h(x), 2)} m`;
  }

  const runner = loop(root, (ms) => {
    for (let k = 0; k < Math.round(ms / 0.5); k++) step(0.0005);
    draw();
    // At rest where friction can hold it: stop.
    const d = track.d(x);
    if (v === 0 && s.mu.get() > 0 && Math.abs(G * d) / (1 + d * d) <= s.mu.get() * G / Math.sqrt(1 + d * d) + 1e-9) return false;
    if (t > 60) return false;
  }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => runner.set(!runner.playing));
  root.querySelector("[data-action=reset]").addEventListener("click", () => { runner.set(false); reset(); });
  reset();
}

// ============================================================ Waves

const PRESETS = { standing: { f1: 0.5, f2: 0.5, v: 1, opposite: true }, beats: { f1: 1, f2: 0.85, v: 2, opposite: false } };

for (const root of document.querySelectorAll("[data-waves]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const sw = root.querySelector("[data-toggle=opposite]");
  const setPlay = playButton(root.querySelector("[data-action=play]"), "Play");
  let t = 0, opposite = true;
  const s = scrubAll(root, () => draw());
  const A = 0.5, X = 8;

  function draw() {
    const f1 = s.f1.get(), f2 = s.f2.get(), v = s.v.get();
    const l1 = v / f1, l2 = v / f2;
    const y1 = (x) => A * Math.sin(2 * Math.PI * (x / l1 - f1 * t));
    const y2 = (x) => A * Math.sin(2 * Math.PI * (x / l2 + (opposite ? 1 : -1) * f2 * t));
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 584, 250], x: [0, X], y: [-1.2, 1.2], xticks: [0, 2, 4, 6, 8], yticks: [-1, 0, 1], xlabel: "x (m)", ylabel: "y", yfmt: (v) => String(v).replace("-", "−") });
    const xs = Array.from({ length: 401 }, (_, i) => (i / 400) * X);
    const standing = opposite && Math.abs(f1 - f2) < 1e-9;
    if (!opposite && Math.abs(f1 - f2) > 1e-9) { // beat envelope
      const env = (x) => 2 * A * Math.abs(Math.cos(Math.PI * (x / l1 - x / l2 - (f1 - f2) * t)));
      for (const sg of [1, -1]) polyline(svg, xs.map((x) => [f.sx(x), f.sy(sg * env(x))]), "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:4 4");
    }
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(y1(x))]), "stroke:var(--vec-u);stroke-width:1.25;stroke-opacity:0.7");
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(y2(x))]), "stroke:var(--vec-v);stroke-width:1.25;stroke-opacity:0.7");
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(y1(x) + y2(x))]), "stroke:var(--foreground);stroke-width:2");
    if (standing) { // nodes where sin(2πx/λ) = 0: every half wavelength
      for (let x = 0; x <= X + 1e-9; x += l1 / 2) el("circle", { cx: f.sx(x), cy: f.sy(0), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.75" }, svg);
    }
    o.l1.textContent = `${num(l1, 2)} m`;
    o.l2.textContent = `${num(l2, 2)} m`;
    o.beat.textContent = opposite ? "—" : `${num(Math.abs(f1 - f2), 2)} Hz`;
    o.pattern.textContent = standing ? `standing, nodes every ${num(l1 / 2, 2)} m` : opposite ? "travelling in both directions" : Math.abs(f1 - f2) < 1e-9 ? "one wave, doubled" : "beats";
  }

  const runner = loop(root, (ms) => { t += ms / 1000; draw(); }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => runner.set(!runner.playing));
  sw.addEventListener("shadcn:checked-change", (e) => { opposite = e.detail.checked; draw(); });
  root.addEventListener("seg-change", (e) => {
    const p = PRESETS[e.detail.value];
    s.f1.set(p.f1, false); s.f2.set(p.f2, false); s.v.set(p.v, false);
    if ((sw.getAttribute("aria-checked") === "true") !== p.opposite) sw.click();
    opposite = p.opposite;
    draw();
  });
  draw();
  if (!reduced()) runner.set(true);
}

// ============================================================ Collisions

for (const root of document.querySelectorAll("[data-coll]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"), "Run");
  let t = 0;
  const s = scrubAll(root, () => { runner.set(false); t = 0; draw(); });

  const solve = () => {
    const m1 = s.m1.get(), m2 = s.m2.get(), v1 = s.v1.get(), v2 = s.v2.get(), e = s.e.get();
    const w1 = 0.5 + 0.08 * m1, w2 = 0.5 + 0.08 * m2;
    const gap = 7 - w2 / 2 - (2 + w1 / 2), closing = v1 - v2;
    const tc = closing > 0 ? gap / closing : Infinity;
    const P = m1 * v1 + m2 * v2;
    const a1 = tc < Infinity ? (P + m2 * e * (v2 - v1)) / (m1 + m2) : v1;
    const a2 = tc < Infinity ? (P + m1 * e * (v1 - v2)) / (m1 + m2) : v2;
    return { m1, m2, v1, v2, e, w1, w2, tc, a1, a2 };
  };

  function draw() {
    const c = solve();
    const pos = (x0, v, a) => (t < c.tc ? x0 + v * t : x0 + v * c.tc + a * (t - c.tc));
    const x1 = pos(2, c.v1, c.a1), x2 = pos(7, c.v2, c.a2);
    svg.replaceChildren();
    const sx = (x) => 30 + (x / 10) * 580;
    el("line", { x1: 20, x2: 620, y1: 110, y2: 110, style: "stroke:currentColor;stroke-opacity:0.3;stroke-width:2" }, svg);
    for (let x = 0; x <= 10; x++) el("line", { x1: sx(x), x2: sx(x), y1: 110, y2: 115, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    const cart = (x, w, m, v, color, label) => {
      if (x + w / 2 < -0.5 || x - w / 2 > 10.5) return;
      const hgt = 28 + 4 * m;
      el("rect", { x: sx(x - w / 2), y: 110 - hgt - 8, width: (w / 10) * 580, height: hgt, rx: 5, style: `fill:${color};fill-opacity:0.18;stroke:${color};stroke-width:1.5` }, svg);
      for (const dx of [-w / 4, w / 4]) el("circle", { cx: sx(x + dx), cy: 106, r: 4, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5" }, svg);
      text(svg, sx(x), 110 - hgt / 2 - 4, label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px] font-medium" });
      text(svg, sx(x), 110 - hgt - 14, `${num(m, 1)} kg`, { "text-anchor": "middle" });
      if (Math.abs(v) > 1e-6) {
        const y = 110 - hgt - 30, len = Math.max(-90, Math.min(90, v * 18));
        el("line", { x1: sx(x), x2: sx(x) + len, y1: y, y2: y, style: `stroke:${color};stroke-width:2` }, svg);
        el("path", { d: `M${sx(x) + len} ${y} l${-Math.sign(len) * 7} -4 v8 Z`, style: `fill:${color}` }, svg);
      }
    };
    const after = t >= c.tc;
    cart(x1, c.w1, c.m1, after ? c.a1 : c.v1, "var(--vec-u)", "1");
    cart(x2, c.w2, c.m2, after ? c.a2 : c.v2, "var(--brand)", "2");
    const ke = (m, v) => 0.5 * m * v * v;
    const K0 = ke(c.m1, c.v1) + ke(c.m2, c.v2), K1 = ke(c.m1, c.a1) + ke(c.m2, c.a2);
    o.v1.textContent = num(c.v1, 2); o.v2.textContent = num(c.v2, 2);
    o.p.textContent = num(c.m1 * c.v1 + c.m2 * c.v2, 2); o.ke.textContent = num(K0, 2);
    o.v1a.textContent = num(c.a1, 2); o.v2a.textContent = num(c.a2, 2);
    o.pa.textContent = num(c.m1 * c.a1 + c.m2 * c.a2, 2); o.kea.textContent = num(K1, 2);
    o.lost.textContent = c.tc === Infinity ? "— (they never meet)" : `${num(K0 - K1, 2)} J (${num(K0 ? (100 * (K0 - K1)) / K0 : 0, 0)}%)`;
    o.type.textContent = c.tc === Infinity ? "no collision" : c.e === 1 ? "elastic" : c.e === 0 ? "perfectly inelastic" : "inelastic";
  }

  const runner = loop(root, (ms) => {
    t += ms / 1000;
    draw();
    if (t > Math.min(10, (solve().tc === Infinity ? 0 : solve().tc) + 2.5)) return false;
  }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (runner.playing) return runner.set(false);
    t = 0;
    if (reduced()) { t = Math.min(10, solve().tc + 1.5); return draw(); }
    runner.set(true);
  });
  draw();
}

// ============================================================ Inclined plane

function arrowPx(parent, x1, y1, x2, y2, color, w = 2, dash = "") {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len, hd = Math.min(10, len / 2);
  el("line", { x1, y1, x2: x2 - ux * hd * 0.8, y2: y2 - uy * hd * 0.8, style: `stroke:${color};stroke-width:${w};${dash ? "stroke-dasharray:" + dash : ""}` }, parent);
  el("path", { d: `M${x2} ${y2} L${x2 - ux * hd - uy * hd * 0.45} ${y2 - uy * hd + ux * hd * 0.45} L${x2 - ux * hd + uy * hd * 0.45} ${y2 - uy * hd - ux * hd * 0.45} Z`, style: `fill:${color}` }, parent);
}

for (const root of document.querySelectorAll("[data-incline]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const th = rad(s.angle.get()), m = s.m.get(), mus = s.mus.get(), muk = s.muk.get();
    const W = m * G, N = W * Math.cos(th), along = W * Math.sin(th);
    const slides = along > mus * N + 1e-12;
    const fric = slides ? muk * N : along;
    const a = slides ? Math.max(0, G * (Math.sin(th) - muk * Math.cos(th))) : 0;

    svg.replaceChildren();
    const Ax = 70, Ay = 290;
    const L = Math.min(400, th > 0 ? 260 / Math.sin(th) : 400);
    const Cx = Ax + L * Math.cos(th), Cy = Ay - L * Math.sin(th);
    el("path", { d: `M${Ax} ${Ay} L${Cx} ${Ay} L${Cx} ${Cy} Z`, style: "fill:currentColor;fill-opacity:0.06;stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5;stroke-linejoin:round" }, svg);
    el("line", { x1: 30, x2: 540, y1: Ay, y2: Ay, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    // Angle arc at the foot.
    if (th > 0.01) {
      const r = 46;
      el("path", { d: `M${Ax + r} ${Ay} A${r} ${r} 0 0 0 ${Ax + r * Math.cos(th)} ${Ay - r * Math.sin(th)}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.5" }, svg);
      // Under the ground line when the slope is too shallow to leave room.
      text(svg, Ax + r + 6, deg(th) < 16 ? Ay + 16 : Ay - 8, `θ = ${num(deg(th), 1)}°`);
    }
    // The block rests on the slope: its bottom face lies on the surface, so
    // its centre of mass is half its height out along the surface normal.
    const tx = Math.cos(th), ty = -Math.sin(th); // up the slope (screen)
    const nx = -Math.sin(th), ny = -Math.cos(th); // out of the slope (screen)
    const bw = 64, bh = 40;
    const mx = Ax + (L / 2) * tx, my = Ay + (L / 2) * ty; // middle of the contact face
    const cx = mx + nx * (bh / 2), cy = my + ny * (bh / 2); // centre of mass
    const corner = (u, v) => [cx + tx * u + nx * v, cy + ty * u + ny * v];
    const pts = [corner(-bw / 2, -bh / 2), corner(bw / 2, -bh / 2), corner(bw / 2, bh / 2), corner(-bw / 2, bh / 2)];
    el("path", { d: "M" + pts.map((p) => p.join(",")).join(" L") + " Z", style: `fill:var(--background);stroke:${slides ? "var(--brand)" : "var(--foreground)"};stroke-width:1.75;stroke-linejoin:round` }, svg);

    // Forces, all from the centre of mass. The weight is 100 px at most, and
    // shorter when the block sits low enough for it to leave the drawing.
    const k = Math.min(100, 392 - cy) / W;
    arrowPx(svg, cx, cy, cx - tx * along * k, cy - ty * along * k, "var(--vec-out)", 1.5, "4 3");
    arrowPx(svg, cx, cy, cx - nx * N * k, cy - ny * N * k, "var(--vec-out)", 1.5, "4 3");
    arrowPx(svg, cx, cy, cx + nx * N * k, cy + ny * N * k, "var(--vec-u)", 2);
    arrowPx(svg, cx, cy, cx + tx * fric * k, cy + ty * fric * k, "var(--ion-na)", 2);
    arrowPx(svg, cx, cy, cx, cy + W * k, "var(--foreground)", 2);
    el("circle", { cx, cy, r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    // The label goes on the side the components leave free: the normal
    // component heads down-right, the along-slope one down-left, steeper as θ grows.
    const left = deg(th) < 45;
    text(svg, cx + (left ? -7 : 7), cy + W * k * 0.62, `mg = ${num(W, 1)} N`, { "text-anchor": left ? "end" : "start", class: "fill-foreground font-mono text-[10px]", style: "paint-order:stroke;stroke:var(--background);stroke-width:3px;stroke-linejoin:round" });

    o.n.textContent = `${num(N, 2)} N`;
    o.f.textContent = `${num(fric, 2)} N ${slides ? "(kinetic)" : "(static)"}`;
    o.a.textContent = `${num(a, 2)} m/s² down the slope`;
    o.crit.textContent = `${num(deg(Math.atan(mus)), 1)}°`;
    o.state.textContent = slides ? (a === 0 ? "slides at constant speed" : "slides") : "holds";
    o.state.className = slides ? "text-brand" : "";
  }
  draw();
}

// ============================================================ Snell's law

const MEDIA = { "air-glass": [1, 1.5], "glass-air": [1.5, 1], "air-water": [1, 1.333] };

for (const root of document.querySelectorAll("[data-snell]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const layer = el("g", {}, svg);
  const top = el("g", {}, svg);
  const src = handle(svg, top, "Light source", ([x, y]) => {
    s.theta.set(Math.max(0, Math.min(89, deg(Math.atan2(Math.abs(x), Math.max(0.001, y))))), false);
    draw();
  });
  src.node.setAttribute("r", 0.09);
  src.node.nextElementSibling?.setAttribute("r", 0.045);
  const label = (x, y, str, color = "var(--muted-foreground)") => {
    const t = el("text", { x, y, style: `font-size:0.07px;font-family:var(--font-mono);fill:${color}` }, layer);
    t.textContent = str;
  };

  function draw() {
    const n1 = s.n1.get(), n2 = s.n2.get(), t1 = rad(s.theta.get());
    const sin2 = (n1 / n2) * Math.sin(t1);
    const tir = sin2 > 1;
    const t2 = tir ? null : Math.asin(sin2);
    let R = 1;
    if (!tir) {
      const ci = Math.cos(t1), ct = Math.cos(t2);
      const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
      R = (rs * rs + rp * rp) / 2; // unpolarised light
    }
    layer.replaceChildren();
    const shade = (n) => Math.min(0.22, (n - 1) * 0.25);
    el("rect", { x: -1.25, y: -1.1, width: 2.5, height: 1.1, style: `fill:var(--vec-u);fill-opacity:${shade(n1)}` }, layer);
    el("rect", { x: -1.25, y: 0, width: 2.5, height: 1.1, style: `fill:var(--vec-u);fill-opacity:${shade(n2)}` }, layer);
    el("line", { x1: -1.25, x2: 1.25, y1: 0, y2: 0, style: "stroke:currentColor;stroke-opacity:0.5;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, layer);
    el("line", { x1: 0, x2: 0, y1: -1.05, y2: 1.05, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:1px;stroke-dasharray:4 4", "vector-effect": "non-scaling-stroke" }, layer);
    label(-1.18, -0.98, `n₁ = ${num(n1, 3)}`);
    label(-1.18, 1.03, `n₂ = ${num(n2, 3)}`);
    const S = [-Math.sin(t1), Math.cos(t1)]; // world, y up
    const ray = (a, b, color, op) => el("line", { x1: a[0], y1: -a[1], x2: b[0], y2: -b[1], style: `stroke:${color};stroke-opacity:${op};stroke-width:2.25px;stroke-linecap:round`, "vector-effect": "non-scaling-stroke" }, layer);
    ray(S, [0, 0], "var(--vec-out)", 1);
    ray([0, 0], [Math.sin(t1), Math.cos(t1)], "var(--vec-out)", 0.15 + 0.85 * R);
    if (!tir) ray([0, 0], [Math.sin(t2), -Math.cos(t2)], "var(--brand)", 0.15 + 0.85 * (1 - R));
    // Angle arcs from the normal.
    const arc = (r, from, to, below) => {
      const p = (a) => [r * Math.sin(a), (below ? 1 : -1) * r * Math.cos(a)];
      const [x0, y0] = p(from), [x1, y1] = p(to);
      el("path", { d: `M${x0} ${y0} A${r} ${r} 0 0 ${below ? 0 : 1} ${x1} ${y1}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.5;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, layer);
    };
    if (t1 > 0.02) { arc(0.28, 0, -t1, false); label(-0.32, -0.32, `θ₁ ${num(deg(t1), 1)}°`); }
    if (!tir && t2 > 0.02) { arc(0.28, 0, t2, true); label(0.1, 0.38, `θ₂ ${num(deg(t2), 1)}°`, "var(--brand)"); }
    if (tir) label(0.08, 0.3, "total internal reflection", "var(--brand)");
    src.place(S, "var(--vec-out)");

    o.t2.textContent = tir ? "— (no refracted ray)" : `${num(deg(t2), 2)}°`;
    o.crit.textContent = n1 > n2 ? `${num(deg(Math.asin(n2 / n1)), 2)}°` : "none (n₁ ≤ n₂)";
    o.r.textContent = `${num(R * 100, 1)}%`;
    o.tr.textContent = `${num((1 - R) * 100, 1)}%`;
  }
  root.addEventListener("seg-change", (e) => {
    const [a, b] = MEDIA[e.detail.value];
    s.n1.set(a, false); s.n2.set(b, false);
    draw();
  });
  draw();
}
