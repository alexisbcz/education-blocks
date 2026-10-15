// Automotive engineering blocks: one vehicle model (synthetic torque curve,
// six-speed gearbox, aerodynamic and rolling resistance) shared by the
// traction diagram and the 0–100 km/h run, plus the Otto cycle sizing,
// Ackermann geometry, stopping distance, a quarter-car suspension and the
// energy chain. The two isometric figures live in ../anatomy/car-*.js.

import "../anatomy/car-engine.js";
import "../anatomy/car-diff.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const G0 = 9.81, RHO = 1.225; // m/s², kg/m³ (sea level, 15 °C)

// ---------------------------------------------------------------- vehicle model

const CAR = {
  gears: [3.6, 2.13, 1.39, 1.03, 0.82, 0.67],
  tyre: 0.31, // m
  eta: 0.9, // driveline efficiency
  crr: 0.012, // rolling resistance coefficient
  idle: 1000, redline: 6800, // rpm
};
// Synthetic torque curve (N·m): rises to a broad peak near 3,900 rpm and
// falls off above 6,000 rpm; scaled by the peak torque.
const torqueAt = (rpm, peak) => {
  if (rpm < CAR.idle || rpm > CAR.redline) return 0;
  let t = 0.7 + 0.3 * Math.sin((Math.PI * (rpm - CAR.idle)) / 5800);
  if (rpm > 6000) t *= 1 - 0.5 * ((rpm - 6000) / 800) ** 2;
  return peak * t;
};
const rpmAt = (v, ratio, fd) => (v / CAR.tyre) * ratio * fd * (60 / (2 * Math.PI));
const wheelForce = (v, gear, fd, peak) => {
  const ratio = CAR.gears[gear];
  return (torqueAt(rpmAt(v, ratio, fd), peak) * ratio * fd * CAR.eta) / CAR.tyre;
};
const resistance = (v, mass, cda) => 0.5 * RHO * cda * v * v + CAR.crr * mass * G0;

// ---------------------------------------------------------------- A2 Otto cycle sizing

for (const root of document.querySelectorAll("[data-auto-otto]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const GAM = 1.4, CV = 718, RAIR = 287, P1 = 100e3, T1 = 300;

  function draw() {
    const b = s.bore.get() / 1000, st = s.stroke.get() / 1000, n = s.cyl.get(), r = s.cr.get(), rpm = s.rpm.get(), q = s.q.get() * 1000;
    const vd = (Math.PI / 4) * b * b * st; // m³ per cylinder
    const vc = vd / (r - 1);
    const v1 = vd + vc, v2 = vc;
    const m = (P1 * v1) / (RAIR * T1);
    const T2 = T1 * r ** (GAM - 1), p2 = P1 * r ** GAM;
    const T3 = T2 + q / CV, p3 = (p2 * T3) / T2;
    const T4 = T3 / r ** (GAM - 1), p4 = p3 / r ** GAM;
    const W = m * CV * (T3 - T2 - (T4 - T1)); // J per cycle per cylinder
    const eta = 1 - r ** (1 - GAM);
    const power = (W * n * rpm) / 120; // four-stroke: one cycle every two turns
    const torque = power / ((rpm * 2 * Math.PI) / 60);

    svg.replaceChildren();
    const cc = (v) => v * 1e6;
    const f = frame(svg, { box: [52, 14, 490, 280], x: [0, cc(v1) * 1.08], y: [0, (p3 / 1e5) * 1.08], xticks: [0, Math.round(cc(v1) / 2 / 50) * 50, Math.round(cc(v1) / 50) * 50], yticks: [0, Math.round(p3 / 1e5 / 2 / 10) * 10, Math.round(p3 / 1e5 / 10) * 10], xlabel: "cylinder volume (cm³)", ylabel: "pressure (bar)" });
    const adiabat = (pa, va, vb) => Array.from({ length: 61 }, (_, i) => { const v = va + ((vb - va) * i) / 60; return [f.sx(cc(v)), f.sy((pa * (va / v) ** GAM) / 1e5)]; });
    const loop = [...adiabat(P1, v1, v2), [f.sx(cc(v2)), f.sy(p3 / 1e5)], ...adiabat(p3, v2, v1), [f.sx(cc(v1)), f.sy(P1 / 1e5)]];
    el("path", { d: "M" + loop.map((p) => p.map((x) => x.toFixed(1)).join(",")).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.12;stroke:none" }, svg);
    polyline(svg, adiabat(P1, v1, v2), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, [[f.sx(cc(v2)), f.sy(p2 / 1e5)], [f.sx(cc(v2)), f.sy(p3 / 1e5)]], "stroke:var(--ion-na);stroke-width:1.75");
    polyline(svg, adiabat(p3, v2, v1), "stroke:var(--brand);stroke-width:1.75");
    polyline(svg, [[f.sx(cc(v1)), f.sy(p4 / 1e5)], [f.sx(cc(v1)), f.sy(P1 / 1e5)]], "stroke:var(--muted-foreground);stroke-width:1.75");
    const pts = [[v1, P1, "1"], [v2, p2, "2"], [v2, p3, "3"], [v1, p4, "4"]];
    for (const [v, p, label] of pts) {
      el("circle", { cx: f.sx(cc(v)), cy: f.sy(p / 1e5), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
      text(svg, f.sx(cc(v)) + 7, f.sy(p / 1e5) - 5, label, { class: "fill-foreground font-mono text-[11px]" });
    }
    text(svg, f.sx(cc(v2)) + 10, f.sy(p3 / 1e5) + 16, "spark: heat added at constant volume", {});
    text(svg, f.sx(cc(v1)) - 6, f.sy(p4 / 1e5) - 8, "exhaust", { "text-anchor": "end" });

    o.vd.textContent = `${num(vd * n * 1000, 2)} L (${num(vd * 1e6, 0)} cm³ × ${n})`;
    o.eta.textContent = `${num(eta * 100, 1)}%`;
    o.mep.textContent = `${num(W / vd / 1e5, 1)} bar`;
    o.pw.textContent = `${num(power / 1000, 0)} kW (${num(power / 745.7, 0)} hp)`;
    o.tq.textContent = `${num(torque, 0)} N·m`;
    o.pmax.textContent = `${num(p3 / 1e5, 0)} bar`;
  }
  draw();
}

// ---------------------------------------------------------------- A3 traction diagram

function topSpeed(mass, cda, fd, peak) {
  let best = { v: 0, gear: 0 };
  for (let v = 0.5; v < 120; v += 0.05) {
    let fmax = 0, g = 0;
    CAR.gears.forEach((_, i) => { const F = wheelForce(v, i, fd, peak); if (F > fmax) { fmax = F; g = i; } });
    if (fmax >= resistance(v, mass, cda)) best = { v, gear: g };
  }
  return best;
}

for (const root of document.querySelectorAll("[data-auto-traction]")) {
  const svg = root.querySelector("[data-plot]");
  const tsvg = root.querySelector("[data-torque]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const colors = ["var(--vec-u)", "var(--vec-v)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-na)", "var(--brand)"];

  function draw() {
    const mass = s.mass.get(), cda = s.cda.get(), fd = s.fd.get(), peak = s.tq.get();
    const vmaxPlot = 70; // m/s ≈ 250 km/h
    let fTop = 0;
    for (let v = 1; v < 30; v += 0.25) fTop = Math.max(fTop, wheelForce(v, 0, fd, peak));
    fTop *= 1.05;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 22, 488, 240], x: [0, vmaxPlot * 3.6], y: [0, Math.max(2000, Math.ceil(fTop / 1000) * 1000)], xticks: [0, 50, 100, 150, 200, 250], yticks: [0, Math.ceil(fTop / 2000) * 1000, Math.ceil(fTop / 1000) * 1000], xlabel: "speed (km/h)", ylabel: "force at the wheels (N)" });
    CAR.gears.forEach((ratio, i) => {
      const pts = [];
      for (let v = 0.5; v <= vmaxPlot; v += 0.25) {
        const rpm = rpmAt(v, ratio, fd);
        if (rpm >= CAR.idle && rpm <= CAR.redline) pts.push([f.sx(v * 3.6), f.sy(wheelForce(v, i, fd, peak))]);
      }
      if (pts.length > 1) {
        polyline(svg, pts, `stroke:${colors[i]};stroke-width:1.75`);
        text(svg, pts[0][0] + 2, pts[0][1] - 5, String(i + 1), { class: "fill-foreground font-mono text-[10px]" });
      }
    });
    polyline(svg, Array.from({ length: 141 }, (_, i) => { const v = (i / 140) * vmaxPlot; return [f.sx(v * 3.6), f.sy(resistance(v, mass, cda))]; }), "stroke:var(--foreground);stroke-width:2;stroke-dasharray:6 4");
    const top = topSpeed(mass, cda, fd, peak);
    const Rtop = resistance(top.v, mass, cda);
    el("circle", { cx: f.sx(top.v * 3.6), cy: f.sy(Rtop), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(top.v * 3.6) - 8, f.sy(Rtop) - 10, "top speed", { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });

    // engine torque and power against rpm
    tsvg.replaceChildren();
    const g = frame(tsvg, { box: [56, 18, 488, 68], x: [CAR.idle, CAR.redline], y: [0, peak * 1.1], xticks: [1000, 2000, 3000, 4000, 5000, 6000], yticks: [0, peak], xlabel: "engine speed (rpm)", ylabel: "torque (N·m)" });
    const rpms = Array.from({ length: 117 }, (_, i) => CAR.idle + i * 50);
    polyline(tsvg, rpms.map((r) => [g.sx(r), g.sy(torqueAt(r, peak))]), "stroke:var(--foreground);stroke-width:1.5");
    const pmax = Math.max(...rpms.map((r) => (torqueAt(r, peak) * r * 2 * Math.PI) / 60));
    polyline(tsvg, rpms.map((r) => [g.sx(r), g.sy(((torqueAt(r, peak) * r * 2 * Math.PI) / 60 / pmax) * peak)]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:4 3");
    text(tsvg, g.L + g.W - 2, 12, `power (dashed), peak ${num(pmax / 1000, 0)} kW`, { "text-anchor": "end" });

    o.vmax.textContent = `${num(top.v * 3.6, 0)} km/h`;
    o.gear.textContent = `${top.gear + 1} (${num(rpmAt(top.v, CAR.gears[top.gear], fd), 0)} rpm)`;
    o.pw.textContent = `${num((Rtop * top.v) / 1000 / CAR.eta, 0)} kW from the engine`;
    o.drag.textContent = `${num(((0.5 * RHO * cda * top.v ** 2) / Rtop) * 100, 0)}% of resistance is air`;
  }
  draw();
}

// ---------------------------------------------------------------- A4 0–100 km/h

for (const root of document.querySelectorAll("[data-auto-accel]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const FD = 3.7, PEAK = 250, CDA = 0.65, SHIFT_T = 0.3, DT = 0.005;

  function simulate(mass, shiftRpm, mu, share) {
    const grip = mu * mass * G0 * share; // N on the driven wheels (static load)
    let v = 0, t = 0, x = 0, gear = 0, shifting = 0, slipped = false;
    const trace = [[0, 0, 0]];
    const shifts = [];
    let t100 = null, g100 = null, d100 = null;
    while (t < 30 && v < 200 / 3.6) {
      let F = 0;
      if (shifting > 0) shifting -= DT;
      else {
        const rpm = rpmAt(v, CAR.gears[gear], FD);
        if (rpm >= shiftRpm && gear < CAR.gears.length - 1) { gear++; shifting = SHIFT_T; shifts.push([t, gear]); continue; }
        // below 1,500 rpm the clutch slips and the engine holds 1,500 rpm
        const r = Math.max(rpm, 1500);
        F = (torqueAt(r, PEAK) * CAR.gears[gear] * FD * CAR.eta) / CAR.tyre;
        if (F > grip) { F = grip; slipped = true; }
      }
      const a = (F - resistance(v, mass, CDA)) / mass;
      v = Math.max(0, v + a * DT);
      x += v * DT;
      t += DT;
      if (t100 === null && v >= 100 / 3.6) { t100 = t; g100 = gear + 1; d100 = x; }
      if (Math.round(t / DT) % 10 === 0) trace.push([t, v, gear]);
    }
    return { trace, shifts, t100, g100, d100, slipped };
  }

  function draw() {
    const r = simulate(s.mass.get(), s.shift.get(), s.mu.get(), s.drive.get() / 100);
    svg.replaceChildren();
    const tEnd = Math.max(12, Math.ceil((r.t100 ?? 20) * 1.4));
    const f = frame(svg, { box: [48, 12, 496, 250], x: [0, tEnd], y: [0, 200], xticks: [0, Math.round(tEnd / 4), Math.round(tEnd / 2), Math.round((3 * tEnd) / 4), tEnd], yticks: [0, 50, 100, 150, 200], xlabel: "time (s)", ylabel: "km/h" });
    hline(svg, f, 100, "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:4 4", "100 km/h");
    for (const [t, g] of r.shifts) if (t < tEnd) {
      el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
      text(svg, f.sx(t) + 3, f.T + 10, `→${g + 1}`, {});
    }
    polyline(svg, r.trace.filter(([t]) => t <= tEnd).map(([t, v]) => [f.sx(t), f.sy(v * 3.6)]), "stroke:var(--foreground);stroke-width:2");
    if (r.t100) el("circle", { cx: f.sx(r.t100), cy: f.sy(100), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    o.t100.textContent = r.t100 ? `${num(r.t100, 1)} s` : "not reached";
    o.g100.textContent = r.g100 ? `gear ${r.g100}` : "—";
    o.slip.textContent = r.slipped ? "yes: the tyres limit first gear" : "no: the engine is the limit";
    o.dist.textContent = r.d100 ? `${num(r.d100, 0)} m to 100 km/h` : "—";
  }
  draw();
}

// ---------------------------------------------------------------- A6 Ackermann

for (const root of document.querySelectorAll("[data-auto-ackermann]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const L = s.wb.get(), t = s.track.get(), di = (s.delta.get() * Math.PI) / 180;
    const R = L / Math.tan(di) + t / 2; // to the centre of the rear axle (left turn)
    const dout = Math.atan(L / (R + t / 2));
    svg.replaceChildren();
    // World: x right, y forward; rear axle centre at origin; turn to the left,
    // centre at (−R, 0). Fit the car and as much of the centre as possible.
    const span = Math.min(R + t, 16);
    const sc = Math.min(500 / (span + t + 2), 300 / (L + 2.4));
    const ox = 520 - (t / 2 + 1) * sc, oy = 330 - 0.7 * sc;
    const P = (x, y) => [ox + x * sc, oy - y * sc];
    const line = (a, b, style) => el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], style }, svg);
    // car body
    const body = [[-t / 2 - 0.12, -0.8], [t / 2 + 0.12, -0.8], [t / 2 + 0.12, L + 0.85], [-t / 2 - 0.12, L + 0.85]].map(([x, y]) => P(x, y));
    el("path", { d: "M" + body.map((p) => p.join(",")).join("L") + "Z", style: "fill:var(--foreground);fill-opacity:0.04;stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1.2" }, svg);
    line(P(-t / 2, 0), P(t / 2, 0), "stroke:currentColor;stroke-opacity:0.35");
    line(P(-t / 2, L), P(t / 2, L), "stroke:currentColor;stroke-opacity:0.35");
    // the rear-axle line extended to the centre
    line(P(-R, 0), P(t / 2, 0), "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:4 4");
    const wheel = (x, y, ang, color) => {
      const w = 0.32, l = 0.66;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const pts = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map(([u, v]) => P(x + u * c - v * sn, y + u * sn + v * c));
      el("path", { d: "M" + pts.map((p) => p.join(",")).join("L") + "Z", style: `fill:${color};fill-opacity:0.85;stroke:${color}` }, svg);
    };
    wheel(-t / 2, 0, 0, "var(--muted-foreground)");
    wheel(t / 2, 0, 0, "var(--muted-foreground)");
    wheel(-t / 2, L, di, "var(--brand)");
    wheel(t / 2, L, dout, "var(--vec-u)");
    // rays from each front wheel, perpendicular to it, to the centre
    const centre = P(-R, 0);
    for (const x of [-t / 2, t / 2]) line(P(x, L), centre, "stroke:currentColor;stroke-opacity:0.3");
    if (centre[0] > 10) {
      el("circle", { cx: centre[0], cy: centre[1], r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
      text(svg, centre[0] + 6, centre[1] + 14, "turning centre", { class: "fill-foreground font-mono text-[10px]" });
    } else text(svg, 12, centre[1] - 6, "← turning centre off the drawing", {});
    text(svg, P(-t / 2, L)[0] - 8, P(-t / 2, L)[1] - 14, `inner ${num(s.delta.get(), 1)}°`, { "text-anchor": "end", class: "font-mono text-[10px]", style: "fill:var(--brand)" });
    text(svg, P(t / 2, L)[0] + 2, P(t / 2, L)[1] + 30, `outer ${num((dout * 180) / Math.PI, 1)}°`, { "text-anchor": "end", class: "font-mono text-[10px]", style: "fill:var(--vec-u)" });
    const circle = 2 * Math.hypot(R + t / 2, L);
    o.outer.textContent = `${num((dout * 180) / Math.PI, 1)}°`;
    o.diff.textContent = `${num(s.delta.get() - (dout * 180) / Math.PI, 1)}° more on the inside`;
    o.r.textContent = `${num(R, 2)} m`;
    o.circle.textContent = `${num(circle, 1)} m (outer front wheel)`;
  }
  draw();
}

// ---------------------------------------------------------------- A7 stopping distance

for (const root of document.querySelectorAll("[data-auto-braking]")) {
  const svg = root.querySelector("[data-plot]");
  const bars = root.querySelector("[data-bars]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-mu]").forEach((b) => b.addEventListener("click", () => { s.mu.set(Number(b.dataset.mu), false); draw(); }));

  const parts = (vk, mu, tr) => { const v = vk / 3.6; return { react: v * tr, brake: (v * v) / (2 * mu * G0) }; };
  function draw() {
    const vk = s.v.get(), mu = s.mu.get(), tr = s.t.get();
    const d = parts(vk, mu, tr);
    const total = d.react + d.brake;
    const scale = Math.max(100, Math.ceil(total / 50) * 50);
    bars.innerHTML = `
      <div class="flex items-center justify-between font-mono text-[11px] text-muted-foreground"><span>0 m</span><span>${scale} m</span></div>
      <div class="relative h-7 overflow-hidden rounded-md bg-foreground/5">
        <div class="absolute inset-y-0 left-0 bg-vec-u/60" style="width:${(100 * d.react) / scale}%"></div>
        <div class="absolute inset-y-0 bg-brand/70" style="left:${(100 * d.react) / scale}%;width:${(100 * d.brake) / scale}%"></div>
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span class="flex items-center gap-1.5"><span class="h-2 w-3 rounded-sm bg-vec-u/60"></span>reacting ${num(d.react, 1)} m</span>
        <span class="flex items-center gap-1.5"><span class="h-2 w-3 rounded-sm bg-brand/70"></span>braking ${num(d.brake, 1)} m</span>
      </div>`;
    svg.replaceChildren();
    const at200 = parts(200, mu, tr);
    const ymax = Math.max(100, Math.ceil((at200.react + at200.brake) / 100) * 100);
    const f = frame(svg, { box: [52, 20, 492, 166], x: [0, 200], y: [0, ymax], xticks: [0, 50, 100, 150, 200], yticks: [0, ymax / 2, ymax], xlabel: "speed (km/h)", ylabel: "metres" });
    const vs = Array.from({ length: 101 }, (_, i) => i * 2);
    polyline(svg, vs.map((v) => [f.sx(v), f.sy(parts(v, mu, tr).react)]), "stroke:var(--vec-u);stroke-width:1.5");
    polyline(svg, vs.map((v) => { const p = parts(v, mu, tr); return [f.sx(v), f.sy(p.react + p.brake)]; }), "stroke:var(--brand);stroke-width:2");
    el("circle", { cx: f.sx(vk), cy: f.sy(total), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    o.react.textContent = `${num(d.react, 1)} m`;
    o.brake.textContent = `${num(d.brake, 1)} m`;
    o.total.textContent = `${num(total, 1)} m`;
    o.decel.textContent = `${num(mu * G0, 1)} m/s² (${num(mu, 2)} g)`;
  }
  draw();
}

// ---------------------------------------------------------------- A8 quarter-car suspension

for (const root of document.querySelectorAll("[data-auto-suspension]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const MS = 350, MU = 40, KT = 200e3, BUMP = { h: 0.05, len: 0.6, at: 0.3 }, T = 2.5, DT = 0.0005;

  function simulate(zeta, ks, v) {
    const cs = 2 * zeta * Math.sqrt(ks * MS);
    const road = (t) => { const x = (t - BUMP.at) * v; return x > 0 && x < BUMP.len ? BUMP.h * Math.sin((Math.PI * x) / BUMP.len) ** 2 : 0; };
    const deriv = (t, [zs, vs, zu, vu]) => {
      const fs = ks * (zs - zu) + cs * (vs - vu);
      return [vs, -fs / MS, vu, (fs - KT * (zu - road(t))) / MU];
    };
    let y = [0, 0, 0, 0], t = 0;
    const out = [];
    let peak = 0, acc = 0, minLoad = Infinity, maxLoad = 0;
    const W0 = (MS + MU) * G0;
    while (t <= T) {
      const k1 = deriv(t, y);
      const k2 = deriv(t + DT / 2, y.map((v, i) => v + (DT / 2) * k1[i]));
      const k3 = deriv(t + DT / 2, y.map((v, i) => v + (DT / 2) * k2[i]));
      const k4 = deriv(t + DT, y.map((v, i) => v + DT * k3[i]));
      y = y.map((v, i) => v + (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      t += DT;
      const a = deriv(t, y)[1];
      peak = Math.max(peak, Math.abs(y[0]));
      acc = Math.max(acc, Math.abs(a));
      const load = W0 - KT * (y[2] - road(t)); // static load plus the tyre's deflection change
      minLoad = Math.min(minLoad, load); maxLoad = Math.max(maxLoad, load);
      if (Math.round(t / DT) % 20 === 0) out.push([t, road(t), y[2], y[0]]);
    }
    return { out, peak, acc, minLoad, maxLoad, W0 };
  }

  function draw() {
    const zeta = s.zeta.get(), ks = s.ks.get() * 1000, v = s.v.get() / 3.6;
    const r = simulate(zeta, ks, v);
    svg.replaceChildren();
    const f = frame(svg, { box: [48, 12, 496, 270], x: [0, T], y: [-4, 8], xticks: [0, 0.5, 1, 1.5, 2, 2.5], yticks: [-4, 0, 4, 8], xlabel: "time (s)", ylabel: "height (cm)", yfmt: (y) => String(y).replace("-", "−") });
    polyline(svg, r.out.map(([t, zr]) => [f.sx(t), f.sy(zr * 100)]), "stroke:var(--muted-foreground);stroke-width:1.5");
    polyline(svg, r.out.map(([t, , zu]) => [f.sx(t), f.sy(zu * 100)]), "stroke:var(--vec-u);stroke-width:1.5");
    polyline(svg, r.out.map(([t, , , zs]) => [f.sx(t), f.sy(zs * 100)]), "stroke:var(--brand);stroke-width:2");
    const kEff = (ks * KT) / (ks + KT);
    o.peak.textContent = `${num(r.peak * 100, 1)} cm`;
    o.acc.textContent = `${num(r.acc, 1)} m/s² (${num(r.acc / G0, 2)} g)`;
    o.load.textContent = r.minLoad <= 0 ? "wheel leaves the road" : `${num((100 * r.minLoad) / r.W0, 0)}–${num((100 * r.maxLoad) / r.W0, 0)}% of static`;
    o.freq.textContent = `${num(Math.sqrt(kEff / MS) / (2 * Math.PI), 2)} Hz`;
  }
  draw();
}

// ---------------------------------------------------------------- A9 energy per kilometre

for (const root of document.querySelectorAll("[data-auto-energy]")) {
  const chain = root.querySelector("[data-chain]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const PETROL_KWH_PER_L = 8.9; // ≈ 32 MJ/L lower heating value

  const row = (label, total, useful, color, note) => `
    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between gap-3 text-sm"><span class="font-medium">${label}</span><span class="font-mono text-xs text-muted-foreground tabular-nums">${note}</span></div>
      <div class="flex h-7 overflow-hidden rounded-md bg-foreground/5" style="width:${Math.max(12, Math.min(100, total))}%">
        <div style="width:${(100 * useful) / total}%;background:${color}" class="h-full opacity-80"></div>
        <div class="h-full flex-1 bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--foreground)_10%,transparent)_5px_6px)]"></div>
      </div>
    </div>`;

  function draw() {
    const v = s.v.get() / 3.6, m = s.mass.get(), cda = s.cda.get();
    const F = resistance(v, m, cda);
    const wheelWh = (F * 1000) / 3600; // per km
    const fuelWh = wheelWh / (s.ice.get() / 100);
    const battWh = wheelWh / (s.ev.get() / 100);
    const scale = 100 / fuelWh; // the petrol bar is the full width
    chain.innerHTML =
      row("Petrol car", fuelWh * scale, wheelWh * scale, "var(--ion-na)", `${num(fuelWh, 0)} Wh/km from the tank`) +
      row("Electric car", battWh * scale, wheelWh * scale, "var(--vec-u)", `${num(battWh, 0)} Wh/km from the battery`) +
      `<p class="text-xs leading-relaxed text-muted-foreground">Coloured part: energy that reaches the wheels (${num(wheelWh, 0)} Wh/km at ${num(s.v.get(), 0)} km/h). Hatched part: losses, mostly heat. Both cars face the same road load: ${num((0.5 * RHO * cda * v * v), 0)} N of drag and ${num(CAR.crr * m * G0, 0)} N of rolling resistance.</p>`;
    const ke = (0.5 * m * v * v) / 3600; // Wh
    o.wheel.textContent = `${num(wheelWh, 0)} Wh/km (${num(F, 0)} N)`;
    o.fuel.textContent = `${num((fuelWh * 100) / 1000 / PETROL_KWH_PER_L, 1)} L/100 km`;
    o.batt.textContent = `${num((battWh * 100) / 1000, 1)} kWh/100 km`;
    o.stop.textContent = `${num(ke, 0)} Wh of motion, ${num(ke * (s.regen.get() / 100), 0)} Wh won back`;
  }
  draw();
}
