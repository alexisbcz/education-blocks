// Sports science blocks. Ball flight is integrated with RK4; the rest are
// closed forms (release angle, sprint model, ACSM, Karvonen, levers, jumps,
// restitution, Elo) or a bisection solve (cycling speed for a power).

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const G = 9.81;
const RHO = 1.2;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const set = (o, k, v) => { if (o[k]) o[k].textContent = v; };

// Bisection for a root of f on [a, b] where f(a) < 0 < f(b).
function bisect(f, a, b, it = 80) {
  for (let i = 0; i < it; i++) {
    const m = (a + b) / 2;
    if (f(m) < 0) a = m; else b = m;
  }
  return (a + b) / 2;
}

// ============================================================ Ball flight

const BALLS = {
  football: { m: 0.43, r: 0.11, cd: 0.25, v: 25, angle: 16, h0: 0.11, rpm: 480 },
  tennis: { m: 0.057, r: 0.0335, cd: 0.55, v: 30, angle: 6, h0: 1.0, rpm: -2500 },
  baseball: { m: 0.145, r: 0.0366, cd: 0.35, v: 40, angle: 3, h0: 1.8, rpm: 2000 },
};

// Path of a spinning ball in the vertical plane: drag against the velocity,
// Magnus lift perpendicular to it (backspin up, topspin down).
function flight(ball, v0, angle, h0, rpm, air = true) {
  const A = Math.PI * ball.r * ball.r;
  const omega = (rpm * 2 * Math.PI) / 60;
  const acc = (vx, vy) => {
    if (!air) return [0, -G];
    const v = Math.hypot(vx, vy) || 1e-9;
    const s = (ball.r * Math.abs(omega)) / v;
    const cl = s > 0 ? Math.sign(omega) / (2 + 1 / s) : 0;
    const kd = (RHO * ball.cd * A) / (2 * ball.m);
    const kl = (RHO * cl * A) / (2 * ball.m);
    return [-kd * v * vx - kl * v * vy, -G - kd * v * vy + kl * v * vx];
  };
  // RK4 on the state (x, y, vx, vy).
  const deriv = ([, , vx, vy]) => { const [ax, ay] = acc(vx, vy); return [vx, vy, ax, ay]; };
  const add = (u, k, h) => u.map((x, i) => x + h * k[i]);
  let st = [0, h0, v0 * Math.cos(rad(angle)), v0 * Math.sin(rad(angle))], t = 0;
  const dt = 0.002;
  const pts = [[st[0], st[1]]];
  let apex = h0;
  while (t < 12) {
    const k1 = deriv(st), k2 = deriv(add(st, k1, dt / 2)), k3 = deriv(add(st, k2, dt / 2)), k4 = deriv(add(st, k3, dt));
    const next = st.map((x, i) => x + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += dt;
    if (next[1] < 0) {
      const f = st[1] / (st[1] - next[1]); // interpolate the landing point
      const x = st[0] + f * (next[0] - st[0]);
      pts.push([x, 0]);
      return { pts, range: x, apex, time: t - dt + f * dt };
    }
    st = next;
    apex = Math.max(apex, st[1]);
    if (pts.length < 6000) pts.push([st[0], st[1]]);
  }
  return { pts, range: st[0], apex, time: t };
}

for (const root of document.querySelectorAll("[data-sport-ball]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let ball = BALLS.football;
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    ball = BALLS[b.dataset.preset];
    for (const k of ["v", "angle", "h0", "rpm"]) s[k].set(ball[k], false);
    draw();
  }));

  function draw() {
    const v = s.v.get(), a = s.angle.get(), h0 = s.h0.get(), rpm = s.rpm.get();
    const spin = flight(ball, v, a, h0, rpm);
    const plain = flight(ball, v, a, h0, 0);
    const vac = flight(ball, v, a, h0, 0, false);
    const xmax = Math.max(spin.range, plain.range, Math.min(vac.range, 1.6 * Math.max(spin.range, plain.range))) * 1.05;
    const ymax = Math.max(spin.apex, plain.apex, 0.5) * 1.25;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 580, 260], x: [0, xmax], y: [0, ymax], xticks: ticks(xmax), yticks: ticks(ymax, 4), xlabel: "distance (m)", ylabel: "height (m)" });
    const clip = (pts) => pts.filter(([x]) => x <= xmax).map(([x, y]) => [f.sx(x), f.sy(Math.min(y, ymax))]);
    polyline(svg, clip(vac.pts), "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:4 4;stroke-width:1.25");
    polyline(svg, clip(plain.pts), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, clip(spin.pts), "stroke:var(--brand);stroke-width:2.25");
    el("circle", { cx: f.sx(spin.range), cy: f.sy(0), r: 4, style: "fill:var(--brand)" }, svg);
    const omega = (Math.abs(rpm) * 2 * Math.PI) / 60;
    set(o, "range", `${num(spin.range, 1)} m`);
    set(o, "apex", `${num(spin.apex, 2)} m`);
    set(o, "time", `${num(spin.time, 2)} s`);
    set(o, "s", num((ball.r * omega) / v, 3));
    const d = spin.range - plain.range;
    set(o, "diff", `${d >= 0 ? "+" : "−"}${num(Math.abs(d), 1)} m ${rpm > 0 ? "(backspin)" : rpm < 0 ? "(topspin)" : ""}`);
  }
  draw();
}

// Round tick values for an axis from 0 to max.
function ticks(max, n = 6) {
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw);
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// ============================================================ Release angle

for (const root of document.querySelectorAll("[data-sport-throw]")) {
  const pathSvg = root.querySelector("[data-path]");
  const rangeSvg = root.querySelector("[data-range]");
  const o = outs(root);
  let event = "shot";
  const s = scrubAll(root, draw);
  const lossField = root.querySelector('[data-scrub="loss"]').closest("label");
  root.addEventListener("seg-change", (e) => {
    event = e.detail.value;
    if (event === "shot") { s.v.set(13.5, false); s.h.set(2.1, false); s.angle.set(40, false); }
    else { s.v.set(10, false); s.h.set(0, false); s.angle.set(25, false); s.loss.set(0.12, false); }
    draw();
  });

  const speed = (th) => (event === "jump" ? Math.max(0.1, s.v.get() - s.loss.get() * th) : s.v.get());
  const range = (th, h) => {
    const v = speed(th), a = rad(th);
    return ((v * Math.cos(a)) / G) * (v * Math.sin(a) + Math.sqrt(v * v * Math.sin(a) ** 2 + 2 * G * h));
  };

  function draw() {
    lossField.hidden = event !== "jump";
    const h = s.h.get(), th = s.angle.get();
    let best = 0, bestR = -1;
    for (let a = 0.1; a < 89.9; a += 0.1) {
      const r = range(a, h);
      if (r > bestR) { bestR = r; best = a; }
    }
    // Closed form for a constant speed: sin θ* = v / √(2v² + 2gh).
    if (event === "shot") {
      const v = s.v.get();
      best = deg(Math.asin(v / Math.sqrt(2 * v * v + 2 * G * h)));
      bestR = range(best, h);
    }
    const R = range(th, h);

    // Range against angle.
    rangeSvg.replaceChildren();
    const rmax = bestR * 1.15;
    const f = frame(rangeSvg, { box: [36, 14, 210, 214], x: [0, 90], y: [0, rmax], xticks: [0, 30, 45, 60, 90], yticks: ticks(rmax, 4), xlabel: "angle (°)", ylabel: "range (m)" });
    const pts = [];
    for (let a = 0.5; a < 90; a += 0.5) pts.push([f.sx(a), f.sy(Math.max(0, range(a, h)))]);
    polyline(rangeSvg, pts, "stroke:var(--foreground);stroke-width:1.5");
    el("line", { x1: f.sx(45), x2: f.sx(45), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, rangeSvg);
    el("circle", { cx: f.sx(best), cy: f.sy(bestR), r: 4, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, rangeSvg);
    el("circle", { cx: f.sx(th), cy: f.sy(R), r: 4, style: "fill:var(--brand)" }, rangeSvg);

    // The two trajectories.
    pathSvg.replaceChildren();
    const traj = (a) => {
      const v = speed(a), ar = rad(a), out = [];
      const T = (v * Math.sin(ar) + Math.sqrt(v * v * Math.sin(ar) ** 2 + 2 * G * h)) / G;
      for (let i = 0; i <= 80; i++) {
        const t = (T * i) / 80;
        out.push([v * Math.cos(ar) * t, h + v * Math.sin(ar) * t - 0.5 * G * t * t]);
      }
      return out;
    };
    const A = traj(th), B = traj(best);
    const xm = Math.max(R, bestR) * 1.08;
    const ym = Math.max(...A.map((p) => p[1]), ...B.map((p) => p[1]), 1) * 1.2;
    const g = frame(pathSvg, { box: [36, 14, 350, 214], x: [0, xm], y: [0, ym], xticks: ticks(xm, 5), yticks: ticks(ym, 4), xlabel: "distance (m)", ylabel: "height (m)" });
    polyline(pathSvg, B.map(([x, y]) => [g.sx(x), g.sy(y)]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(pathSvg, A.map(([x, y]) => [g.sx(x), g.sy(y)]), "stroke:var(--brand);stroke-width:2");
    text(pathSvg, g.sx(B.at(-1)[0]), g.sy(0) - 6, `best ${num(best, 1)}°`, { "text-anchor": "end", style: "fill:var(--vec-u)" });

    set(o, "range", `${num(R, 2)} m`);
    set(o, "best", `${num(best, 1)}°`);
    set(o, "bestRange", `${num(bestR, 2)} m`);
    set(o, "vt", `${num(speed(th), 2)} m/s`);
  }
  draw();
}

// ============================================================ Sprint

for (const root of document.querySelectorAll("[data-sport-sprint]")) {
  const svg = root.querySelector("[data-plot]");
  const splits = root.querySelector("[data-splits]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const vmax = s.vmax.get(), tau = s.tau.get(), react = s.react.get();
    const dist = (t) => vmax * (t - tau * (1 - Math.exp(-t / tau)));
    const timeTo = (d) => bisect((t) => dist(t) - d, 0, 60);
    const T = timeTo(100);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 580, 200], x: [0, T + react], y: [0, Math.ceil(vmax + 1)], xticks: ticks(T + react, 5), yticks: ticks(vmax + 1, 4), xlabel: "time from the gun (s)", ylabel: "speed (m/s)" });
    const pts = [[f.sx(0), f.sy(0)], [f.sx(react), f.sy(0)]];
    for (let i = 0; i <= 200; i++) {
      const t = (T * i) / 200;
      pts.push([f.sx(react + t), f.sy(vmax * (1 - Math.exp(-t / tau)))]);
    }
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(vmax), y2: f.sy(vmax), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4" }, svg);
    text(svg, f.L + f.W - 2, f.sy(vmax) - 4, `vmax ${num(vmax, 2)} m/s`, { "text-anchor": "end" });

    splits.replaceChildren();
    let prev = 0;
    for (let d = 10; d <= 100; d += 10) {
      const t = timeTo(d);
      const cell = document.createElement("div");
      cell.className = "flex flex-col items-center gap-0.5 rounded-md border bg-background px-1 py-1.5";
      const a = document.createElement("span"); a.className = "text-muted-foreground"; a.textContent = `${d} m`;
      const b = document.createElement("span"); b.className = "tabular-nums"; b.textContent = num(t + react, 2);
      const c = document.createElement("span"); c.className = "text-muted-foreground tabular-nums"; c.textContent = `+${num(t - prev, 2)}`;
      cell.append(a, b, c);
      splits.append(cell);
      prev = t;
    }
    const t95 = tau * Math.log(20);
    set(o, "time", `${num(T + react, 2)} s`);
    set(o, "t95", `${num(t95, 2)} s`);
    set(o, "d95", `${num(dist(t95), 1)} m`);
    set(o, "mean", `${num(100 / (T + react), 2)} m/s`);
  }
  draw();
}

// ============================================================ Cycling

for (const root of document.querySelectorAll("[data-sport-cycle]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let draft = false;
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { s.cda.set(Number(b.dataset.preset), false); draw(); }));
  root.querySelectorAll("[data-toggle=draft]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { draft = e.detail.checked; draw(); }));

  function draw() {
    const P = s.power.get(), m = s.mass.get(), th = Math.atan(s.grade.get() / 100);
    const cda = s.cda.get() * (draft ? 0.7 : 1);
    const crr = 0.004;
    const air = (v) => 0.5 * RHO * cda * v ** 3;
    const roll = (v) => crr * m * G * Math.cos(th) * v;
    const climb = (v) => m * G * Math.sin(th) * v;
    const total = (v) => air(v) + roll(v) + climb(v);
    const v = bisect((x) => total(x) - P, 0, 40);
    const vmaxKmh = 60;
    svg.replaceChildren();
    const pmax = Math.max(P * 1.6, 400);
    // Downhill, climbing power is negative: give the axis room below zero.
    const ymin = th < 0 ? Math.max(-pmax, climb(vmaxKmh / 3.6)) : 0;
    const f = frame(svg, { box: [48, 16, 572, 240], x: [0, vmaxKmh], y: [ymin, pmax], xticks: [0, 10, 20, 30, 40, 50, 60], yticks: ticks(pmax, 4), xlabel: "speed (km/h)", ylabel: "power (W)" });
    // Curves stop where they leave the chart instead of flattening at the edge.
    const curve = (fn) => {
      const out = [];
      for (let i = 0; i <= 240; i++) {
        const kmh = (vmaxKmh * i) / 240, p = fn(kmh / 3.6);
        if (p > pmax || p < ymin) break;
        out.push([f.sx(kmh), f.sy(p)]);
      }
      return out;
    };
    polyline(svg, curve(air), "stroke:var(--vec-u);stroke-width:1.5");
    polyline(svg, curve(roll), "stroke:var(--vec-out);stroke-width:1.5");
    if (Math.abs(th) > 1e-9) polyline(svg, curve(climb), "stroke:var(--ion-cl);stroke-width:1.5");
    polyline(svg, curve(total), "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(P), y2: f.sy(P), style: "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:4 4" }, svg);
    el("circle", { cx: f.sx(v * 3.6), cy: f.sy(P), r: 4.5, style: "fill:var(--brand)" }, svg);
    text(svg, f.sx(v * 3.6) + 8, f.sy(P) - 8, `${num(v * 3.6, 1)} km/h`, { style: "fill:var(--brand)" });

    set(o, "speed", `${num(v * 3.6, 1)} km/h`);
    set(o, "air", `${num((100 * air(v)) / P, 0)}%`);
    set(o, "wkg", num(P / m, 2));
    const mins = 40000 / v / 60;
    const hh = Math.floor(mins / 60), mm = Math.round(mins % 60);
    set(o, "t40", hh ? `${hh} h ${String(mm).padStart(2, "0")} min` : `${mm} min`);
  }
  draw();
}

// ============================================================ Running VO₂

for (const root of document.querySelectorAll("[data-sport-vo2]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  // ACSM running equation, speed in m/min, grade as a fraction.
  const vo2 = (kmh, g) => { const v = (kmh * 1000) / 60; return 0.2 * v + 0.9 * v * g + 3.5; };

  function draw() {
    const kmh = s.speed.get(), g = s.grade.get() / 100, m = s.mass.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [48, 16, 572, 240], x: [8, 22], y: [0, 140], xticks: [8, 10, 12, 14, 16, 18, 20, 22], yticks: [0, 35, 70, 105, 140], xlabel: "speed (km/h)", ylabel: "VO₂ (ml/kg/min)" });
    const colors = ["var(--vec-u)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-na)"];
    [0, 5, 10, 15].forEach((gr, i) => {
      const pts = [];
      for (let x = 8; x <= 22.001; x += 0.25) { const y = vo2(x, gr / 100); if (y > 140) break; pts.push([f.sx(x), f.sy(y)]); }
      polyline(svg, pts, `stroke:${colors[i]};stroke-width:1.25;stroke-opacity:0.7`);
      text(svg, f.sx(8.2), f.sy(vo2(8, gr / 100)) - 4, `${gr}%`, { style: `fill:${colors[i]}` });
    });
    const y = vo2(kmh, g);
    el("circle", { cx: f.sx(kmh), cy: f.sy(Math.min(140, y)), r: 5, style: "fill:var(--brand)" }, svg);
    const lmin = (y * m) / 1000;
    set(o, "vo2", `${num(y, 1)} ml/kg/min`);
    set(o, "mets", num(y / 3.5, 1));
    set(o, "lmin", `${num(lmin, 2)} L/min`);
    set(o, "kcal", `≈ ${num(lmin * 5, 1)} kcal/min`);
  }
  draw();
}

// ============================================================ Heart-rate zones

const ZONES = [
  ["Zone 1", "Very light", 0.5, 0.6],
  ["Zone 2", "Light", 0.6, 0.7],
  ["Zone 3", "Moderate", 0.7, 0.8],
  ["Zone 4", "Hard", 0.8, 0.9],
  ["Zone 5", "Maximal", 0.9, 1.0],
];

for (const root of document.querySelectorAll("[data-sport-heart]")) {
  const list = root.querySelector("[data-zones]");
  const o = outs(root);
  let formula = "tanaka";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { formula = e.detail.value; draw(); });

  function draw() {
    const age = s.age.get(), rest = s.rest.get();
    const max = formula === "tanaka" ? 208 - 0.7 * age : 220 - age;
    const reserve = max - rest;
    set(o, "max", `HRmax ≈ ${Math.round(max)} bpm · reserve ${Math.round(reserve)} bpm`);
    list.replaceChildren();
    ZONES.forEach(([name, label, lo, hi], i) => {
      const a = rest + lo * reserve, b = rest + hi * reserve;
      const row = document.createElement("div");
      row.className = "grid grid-cols-[124px_1fr_92px] items-center gap-3 text-sm";
      const n = document.createElement("span"); n.className = "text-xs whitespace-nowrap text-muted-foreground"; n.textContent = `${name} · ${label}`;
      const track = document.createElement("div"); track.className = "relative h-5 rounded-md bg-foreground/5";
      const bar = document.createElement("div"); bar.className = "absolute inset-y-0 rounded-md";
      bar.style.left = `${((a - 40) / 180) * 100}%`;
      bar.style.width = `${((b - a) / 180) * 100}%`;
      bar.style.background = "var(--brand)";
      bar.style.opacity = String(0.25 + i * 0.17);
      track.append(bar);
      const r = document.createElement("span"); r.className = "text-right font-mono text-xs tabular-nums"; r.textContent = `${Math.round(a)}–${Math.round(b)} bpm`;
      row.append(n, track, r);
      list.append(row);
    });
  }
  draw();
}

// ============================================================ Energy systems

// Schematic shares (Gastin 2001 shape): aerobic t/(t + 75); the anaerobic
// remainder splits between phosphocreatine (first seconds) and glycolysis.
function shares(t) {
  const aer = t / (t + 75);
  const pcOfAnaerobic = 1 / (1 + (t / 10) ** 1.6);
  return { pc: (1 - aer) * pcOfAnaerobic, gly: (1 - aer) * (1 - pcOfAnaerobic), aer };
}

for (const root of document.querySelectorAll("[data-sport-energy]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { s.t.set(Number(b.dataset.preset), false); draw(); }));
  const lx = (t) => Math.log10(t);

  function draw() {
    const T = s.t.get();
    svg.replaceChildren();
    const xt = [1, 10, 60, 600, 3600];
    const f = frame(svg, { box: [44, 16, 576, 220], x: [0, lx(7200)], y: [0, 1], xticks: xt.map(lx), yticks: [0, 0.5, 1], xfmt: (v) => ({ 0: "1 s", 1: "10 s" }[Math.round(v * 100) / 100] ?? (Math.abs(v - lx(60)) < 1e-6 ? "1 min" : Math.abs(v - lx(600)) < 1e-6 ? "10 min" : "1 h")), yfmt: (v) => `${v * 100}%`, ylabel: "share of energy" });
    const N = 200;
    const xs = Array.from({ length: N + 1 }, (_, i) => 10 ** ((lx(7200) * i) / N));
    const band = (lo, hi, color) => {
      const top = xs.map((t) => [f.sx(lx(t)), f.sy(hi(t))]);
      const bot = xs.map((t) => [f.sx(lx(t)), f.sy(lo(t))]).reverse();
      el("path", { d: "M" + [...top, ...bot].map((p) => p.join(",")).join(" L") + " Z", style: `fill:${color};fill-opacity:0.55` }, svg);
    };
    band((t) => 0, (t) => shares(t).pc, "var(--ion-na)");
    band((t) => shares(t).pc, (t) => shares(t).pc + shares(t).gly, "var(--vec-out)");
    band((t) => 1 - shares(t).aer, () => 1, "var(--vec-u)");
    el("line", { x1: f.sx(lx(T)), x2: f.sx(lx(T)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
    el("line", { x1: f.sx(lx(75)), x2: f.sx(lx(75)), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
    text(svg, f.sx(lx(75)) + 4, f.T + 12, "≈ 75 s crossover");
    const sh = shares(T);
    set(o, "pc", `${num(sh.pc * 100, 0)}%`);
    set(o, "gly", `${num(sh.gly * 100, 0)}%`);
    set(o, "aer", `${num(sh.aer * 100, 0)}%`);
  }
  draw();
}

// ============================================================ Levers

for (const root of document.querySelectorAll("[data-sport-lever]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const UPPER = 0.30, FOREARM_M = 1.5, FOREARM_C = 0.15;

  function draw() {
    const m = s.load.get(), L = s.arm.get() / 100, d = s.ins.get() / 100, th = rad(s.angle.get());
    // Elbow at the origin, upper arm straight up to the shoulder; the
    // forearm makes the elbow angle with it.
    const fdir = [Math.sin(th), Math.cos(th)];
    const I = [d * fdir[0], d * fdir[1]];
    const O = [0, UPPER];
    const u = [O[0] - I[0], O[1] - I[1]];
    const ul = Math.hypot(...u);
    const arm = Math.abs(I[0] * u[1] - I[1] * u[0]) / ul; // perpendicular moment arm
    const torque = G * (m * L + FOREARM_M * FOREARM_C) * Math.sin(th);
    const F = torque / arm;

    svg.replaceChildren();
    const sc = 470, ox = 200, oy = 175;
    const P = ([x, y]) => [ox + x * sc, oy - y * sc];
    const line = (a, b, style) => el("line", { x1: P(a)[0], y1: P(a)[1], x2: P(b)[0], y2: P(b)[1], style }, svg);
    line([0, 0], O, "stroke:var(--foreground);stroke-opacity:0.4;stroke-width:10;stroke-linecap:round");
    const hand = [L * fdir[0], L * fdir[1]];
    line([0, 0], hand, "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:9;stroke-linecap:round");
    line(I, O, "stroke:var(--brand);stroke-width:3");
    el("circle", { cx: P([0, 0])[0], cy: P([0, 0])[1], r: 7, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
    el("circle", { cx: P(I)[0], cy: P(I)[1], r: 3.5, style: "fill:var(--brand)" }, svg);
    // Load.
    const [hx, hy] = P(hand);
    el("rect", { x: hx - 12, y: hy + 6, width: 24, height: 18, rx: 3, style: "fill:var(--vec-u);fill-opacity:0.7" }, svg);
    el("line", { x1: hx, y1: hy, x2: hx, y2: hy + 6, style: "stroke:var(--vec-u);stroke-width:2" }, svg);
    text(svg, hx + 16, hy + 20, `${num(m, 1)} kg`, { style: "fill:var(--vec-u)" });
    text(svg, P(O)[0] + 10, P(O)[1] + 4, "shoulder");
    text(svg, P([0, 0])[0] - 12, P([0, 0])[1] + 22, "elbow (fulcrum)", { "text-anchor": "end" });
    text(svg, (P(I)[0] + P(O)[0]) / 2 + 8, (P(I)[1] + P(O)[1]) / 2, `biceps ≈ ${num(F, 0)} N`, { style: "fill:var(--brand)" });

    set(o, "force", `${num(F, 0)} N`);
    set(o, "ratio", m > 0 ? `${num(F / (m * G), 1)}×` : "—");
    set(o, "ma", num(arm / (L * Math.sin(th)), 3));
    set(o, "torque", `${num(torque, 1)} N·m`);
  }
  draw();
}

// ============================================================ Jumps and bounces

for (const root of document.querySelectorAll("[data-sport-jump]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "jump";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    mode = e.detail.value;
    root.querySelectorAll("[data-mode]").forEach((p) => (p.hidden = p.dataset.mode !== mode));
    draw();
  });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const [a, c] = b.dataset.preset.split(":").map(Number);
    s.h1.set(a, false); s.h2.set(c, false); draw();
  }));

  const labels = { jump: ["jump height", "takeoff speed", "time in the air"], bounce: ["restitution e", "energy kept", "bounces to 1 cm"] };
  function draw() {
    svg.replaceChildren();
    root.querySelectorAll("[data-lbl]").forEach((n) => (n.textContent = labels[mode][Number(n.dataset.lbl)]));
    if (mode === "jump") {
      const t = s.flight.get();
      const h = (G * t * t) / 8, v = (G * t) / 2;
      const f = frame(svg, { box: [52, 16, 568, 200], x: [0, Math.max(1.2, t * 1.1)], y: [0, Math.max(0.8, h * 1.3)], xticks: ticks(Math.max(1.2, t * 1.1), 6), yticks: ticks(Math.max(0.8, h * 1.3), 4), xlabel: "time in the air (s)", ylabel: "height of the centre of mass (m)" });
      const pts = Array.from({ length: 101 }, (_, i) => { const x = (t * i) / 100; return [f.sx(x), f.sy(v * x - 0.5 * G * x * x)]; });
      polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
      el("line", { x1: f.sx(t / 2), x2: f.sx(t / 2), y1: f.sy(0), y2: f.sy(h), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
      text(svg, f.sx(t / 2) + 6, f.sy(h) - 6, `h = ${num(h * 100, 1)} cm at t/2`);
      set(o, "main", `${num(h * 100, 1)} cm`);
      set(o, "second", `${num(v, 2)} m/s`);
      set(o, "third", `${num(t, 2)} s`);
      return;
    }
    const h1 = s.h1.get() / 100, h2 = Math.min(s.h2.get() / 100, h1);
    const e = Math.sqrt(h2 / h1);
    // Bounces: each rebound height is e² times the last; time between
    // impacts is 2√(2h/g).
    let t = Math.sqrt((2 * h1) / G), hh = h1;
    const pts = [];
    for (let i = 0; i <= 30; i++) { const x = (Math.sqrt((2 * h1) / G) * i) / 30; pts.push([x, h1 - 0.5 * G * x * x]); }
    let n = 0;
    while (n < 12 && hh > 0.01) {
      hh *= e * e;
      const T = 2 * Math.sqrt((2 * hh) / G), v0 = Math.sqrt(2 * G * hh);
      for (let i = 1; i <= 30; i++) { const x = (T * i) / 30; pts.push([t + x, v0 * x - 0.5 * G * x * x]); }
      t += T; n++;
    }
    const f = frame(svg, { box: [52, 16, 568, 200], x: [0, t], y: [0, h1 * 1.1], xticks: ticks(t, 6), yticks: ticks(h1 * 1.1, 4), xlabel: "time (s)", ylabel: "ball height (m)" });
    polyline(svg, pts.map(([x, y]) => [f.sx(x), f.sy(Math.max(0, y))]), "stroke:var(--brand);stroke-width:1.75");
    const bounces = e < 1 ? Math.ceil(Math.log(0.01 / h1) / Math.log(e * e)) : Infinity;
    set(o, "main", `e = ${num(e, 3)}`);
    set(o, "second", `${num(e * e * 100, 1)}% per bounce`);
    set(o, "third", Number.isFinite(bounces) && bounces > 0 ? `${bounces} bounces` : "—");
  }
  draw();
}

// ============================================================ Elo

for (const root of document.querySelectorAll("[data-sport-elo]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let result = 1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { result = Number(e.detail.value); draw(); });
  const expected = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

  function draw() {
    const ra = s.ra.get(), rb = s.rb.get(), k = s.k.get();
    const ea = expected(ra, rb), eb = 1 - ea;
    const da = k * (result - ea);
    set(o, "expA", `expected ${num(ea, 3)}`);
    set(o, "expB", `expected ${num(eb, 3)}`);
    set(o, "newA", `${num(ra + da, 1)} (${da >= 0 ? "+" : "−"}${num(Math.abs(da), 1)})`);
    set(o, "newB", `${num(rb - da, 1)} (${-da >= 0 ? "+" : "−"}${num(Math.abs(da), 1)})`);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 12, 576, 150], x: [-800, 800], y: [0, 1], xticks: [-800, -400, 0, 400, 800], yticks: [0, 0.5, 1], xfmt: (v) => String(v).replace("-", "−"), xlabel: "rating difference A − B", ylabel: "expected score of A" });
    polyline(svg, Array.from({ length: 161 }, (_, i) => { const dd = -800 + i * 10; return [f.sx(dd), f.sy(expected(dd, 0))]; }), "stroke:var(--foreground);stroke-width:1.5");
    const dd = Math.max(-800, Math.min(800, ra - rb));
    el("circle", { cx: f.sx(dd), cy: f.sy(ea), r: 5, style: "fill:var(--brand)" }, svg);
  }
  draw();
}
