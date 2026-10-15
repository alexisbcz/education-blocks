// Energy systems blocks: the Betz limit, a single-diode solar module, panel
// tilt over a clear day, battery runtime with Peukert's law, grid frequency
// after a trip, energy densities, conversion chains, heat pump COP, LCOE and
// intermittency. The wind turbine figure lives in ../anatomy/energy-turbine.js.

import "../anatomy/energy-turbine.js";
import { scrubAll, scrubbable } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const minus = (s) => String(s).replace("-", "−");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// A right-hand axis for a second quantity on the same frame.
function rightAxis(svg, f, ticks, scale, label) {
  for (const t of ticks) text(svg, f.L + f.W + 6, scale(t) + 3, String(t), { "text-anchor": "start" });
  if (label) text(svg, f.L + f.W + 6, f.T - 6, label, { "text-anchor": "start" });
}

// ============================================================ Betz limit

for (const root of document.querySelectorAll("[data-nrg-betz]")) {
  const o = outs(root);
  const plot = root.querySelector("[data-plot]");
  const tube = root.querySelector("[data-tube]");
  const s = scrubAll(root, draw);
  const BETZ = 16 / 27;
  root.querySelector("[data-action=optimum]").addEventListener("click", () => s.a.set(1 / 3));

  function draw() {
    const a = s.a.get();
    const cp = 4 * a * (1 - a) ** 2, ct = 4 * a * (1 - a);

    plot.replaceChildren();
    const f = frame(plot, { box: [44, 14, 470, 200], x: [0, 0.5], y: [0, 1], xticks: [0, 0.1, 0.2, 1 / 3, 0.4, 0.5], yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => (Math.abs(v - 1 / 3) < 1e-9 ? "1/3" : String(v)), xlabel: "induction factor a", ylabel: "coefficient" });
    hline(plot, f, BETZ, "stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:4 4", "Betz 16/27 ≈ 0.593");
    const xs = Array.from({ length: 101 }, (_, i) => (i / 100) * 0.5);
    polyline(plot, xs.map((x) => [f.sx(x), f.sy(4 * x * (1 - x))]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(plot, xs.map((x) => [f.sx(x), f.sy(4 * x * (1 - x) ** 2)]), "stroke:var(--brand);stroke-width:2");
    text(plot, f.sx(0.5) - 4, f.sy(1) + 12, "Ct thrust", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    text(plot, f.sx(0.48), f.sy(4 * 0.48 * 0.52 ** 2) + 16, "Cp power", { "text-anchor": "end", style: "fill:var(--brand)" });
    el("line", { x1: f.sx(a), x2: f.sx(a), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3" }, plot);
    el("circle", { cx: f.sx(a), cy: f.sy(cp), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, plot);
    el("circle", { cx: f.sx(a), cy: f.sy(ct), r: 3.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:1.75" }, plot);

    // The stream tube: area is inversely proportional to the speed.
    tube.replaceChildren();
    const mid = 60, x0 = 30, xr = 280, x1 = 530;
    const hr = 26; // half-height at the rotor
    const hu = hr * (1 - a), hw = Math.min(56, (hr * (1 - a)) / Math.max(1e-6, 1 - 2 * a));
    const top = `M${x0} ${mid - hu} C${x0 + 120} ${mid - hu} ${xr - 90} ${mid - hr} ${xr} ${mid - hr} C${xr + 90} ${mid - hr} ${x1 - 120} ${mid - hw} ${x1} ${mid - hw}`;
    const bot = `M${x0} ${mid + hu} C${x0 + 120} ${mid + hu} ${xr - 90} ${mid + hr} ${xr} ${mid + hr} C${xr + 90} ${mid + hr} ${x1 - 120} ${mid + hw} ${x1} ${mid + hw}`;
    el("path", { d: `${top} L${x1} ${mid + hw} C${x1 - 120} ${mid + hw} ${xr + 90} ${mid + hr} ${xr} ${mid + hr} C${xr - 90} ${mid + hr} ${x0 + 120} ${mid + hu} ${x0} ${mid + hu} Z`, style: "fill:var(--vec-u);fill-opacity:0.08;stroke:none" }, tube);
    el("path", { d: top, style: "fill:none;stroke:var(--vec-u);stroke-width:1.25" }, tube);
    el("path", { d: bot, style: "fill:none;stroke:var(--vec-u);stroke-width:1.25" }, tube);
    el("rect", { x: xr - 2.5, y: mid - hr - 8, width: 5, height: 2 * hr + 16, rx: 2, style: "fill:var(--foreground)" }, tube);
    text(tube, x0, 112, "upstream v", { "text-anchor": "start" });
    text(tube, xr, 112, `rotor ${num(1 - a, 2)}·v`, { "text-anchor": "middle" });
    text(tube, x1, 112, `wake ${num(Math.max(0, 1 - 2 * a), 2)}·v`, { "text-anchor": "end" });

    o.vr.textContent = `${num(1 - a, 2)} v`;
    o.vw.textContent = `${num(Math.max(0, 1 - 2 * a), 2)} v`;
    o.cp.textContent = num(cp, 4);
    o.ct.textContent = num(ct, 3);
    o.share.textContent = `${num((100 * cp) / BETZ, 1)}%`;
  }
  draw();
}

// ============================================================ Solar module

// Single-diode model of a 60-cell module, fitted to typical standard-test
// values (Isc 9.5 A, Voc 38 V at 1000 W/m² and 25 °C).
const PV = { ns: 60, n: 1.25, rs: 0.32, rsh: 350, isc: 9.5, voc: 38, alpha: 0.0005, eg: 1.12, area: 1.6 };
const KB = 1.380649e-23, Q = 1.602176634e-19;
function module(G, tc) {
  const T = tc + 273.15, Tr = 298.15;
  const vt = (n, t) => (n * KB * t * PV.ns) / Q;
  const i0r = PV.isc / (Math.exp(PV.voc / vt(PV.n, Tr)) - 1);
  const i0 = i0r * (T / Tr) ** 3 * Math.exp(((PV.eg * Q) / (PV.n * KB)) * (1 / Tr - 1 / T));
  const iph = PV.isc * (G / 1000) * (1 + PV.alpha * (T - Tr));
  const Vt = vt(PV.n, T);
  const current = (V) => {
    let I = iph;
    for (let k = 0; k < 40; k++) {
      const e = Math.exp((V + I * PV.rs) / Vt);
      const f = iph - i0 * (e - 1) - (V + I * PV.rs) / PV.rsh - I;
      const df = -i0 * e * (PV.rs / Vt) - PV.rs / PV.rsh - 1;
      const step = f / df;
      I -= step;
      if (Math.abs(step) < 1e-10) break;
    }
    return I;
  };
  let lo = 0, hi = 60;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (current(m) > 0) lo = m; else hi = m; }
  const voc = lo, isc = current(0);
  const pts = [];
  let mpp = { v: 0, i: 0, p: 0 };
  for (let k = 0; k <= 200; k++) {
    const v = (voc * k) / 200, i = Math.max(0, current(v)), p = v * i;
    pts.push({ v, i, p });
    if (p > mpp.p) mpp = { v, i, p };
  }
  // refine the maximum power point
  let a = Math.max(0, mpp.v - voc / 200), b = Math.min(voc, mpp.v + voc / 200);
  for (let k = 0; k < 60; k++) {
    const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
    if (m1 * current(m1) < m2 * current(m2)) a = m1; else b = m2;
  }
  const vm = (a + b) / 2, im = current(vm);
  return { pts, voc, isc, mpp: { v: vm, i: im, p: vm * im }, ff: (vm * im) / (voc * isc), eff: (vm * im) / (G * PV.area) };
}

for (const root of document.querySelectorAll("[data-nrg-solar]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const s = scrubAll(root, draw);
  const ref = module(1000, 25);

  function draw() {
    const m = module(s.g.get(), s.t.get());
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 456, 260], x: [0, 45], y: [0, 12], xticks: [0, 10, 20, 30, 40], yticks: [0, 3, 6, 9, 12], xlabel: "voltage (V)", ylabel: "I (A)" });
    const py = (p) => f.T + f.H - (p / 360) * f.H;
    rightAxis(svg, f, [0, 120, 240, 360], py, "P (W)");
    polyline(svg, ref.pts.map((q) => [f.sx(q.v), f.sy(q.i)]), "stroke:currentColor;stroke-opacity:0.35;stroke-width:1;stroke-dasharray:4 4");
    polyline(svg, ref.pts.map((q) => [f.sx(q.v), py(q.p)]), "stroke:currentColor;stroke-opacity:0.35;stroke-width:1;stroke-dasharray:4 4");
    polyline(svg, m.pts.map((q) => [f.sx(q.v), f.sy(q.i)]), "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, m.pts.map((q) => [f.sx(q.v), py(q.p)]), "stroke:var(--brand);stroke-width:2");
    // the maximum power point and its rectangle
    el("rect", { x: f.L, y: f.sy(m.mpp.i), width: f.sx(m.mpp.v) - f.L, height: f.T + f.H - f.sy(m.mpp.i), style: "fill:var(--vec-u);fill-opacity:0.07;stroke:var(--vec-u);stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(m.mpp.v), cy: f.sy(m.mpp.i), r: 4.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
    el("circle", { cx: f.sx(m.mpp.v), cy: py(m.mpp.p), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(m.mpp.v) + 7, py(m.mpp.p) - 7, "MPP", { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });

    o.isc.textContent = `${num(m.isc, 2)} A`;
    o.voc.textContent = `${num(m.voc, 1)} V`;
    o.mpp.textContent = `${num(m.mpp.p, 0)} W at ${num(m.mpp.v, 1)} V`;
    o.ff.textContent = num(m.ff, 3);
    o.eff.textContent = `${num(m.eff * 100, 1)}%`;
  }
  draw();
}

// ============================================================ Panel tilt

const RAD = Math.PI / 180;
const MONTHS = [["Jan", 31], ["Feb", 28], ["Mar", 31], ["Apr", 30], ["May", 31], ["Jun", 30], ["Jul", 31], ["Aug", 31], ["Sep", 30], ["Oct", 31], ["Nov", 30], ["Dec", 31]];
const dateOf = (n) => { let d = Math.round(n); for (const [m, len] of MONTHS) { if (d <= len) return `${d} ${m}`; d -= len; } return "31 Dec"; };

// Irradiance on a surface (W/m²) through a clear day, every 5 minutes of
// solar time. Beam from Meinel's model DNI = 1361·0.7^(AM^0.678) with the
// Kasten–Young air mass; diffuse taken as 10% of the beam, isotropic.
function clearDay(lat, day, tilt, facing) {
  const dec = 23.44 * RAD * Math.sin((2 * Math.PI * (284 + day)) / 365);
  const phi = lat * RAD, b = tilt * RAD, g = facing * RAD;
  const n = [-Math.sin(g) * Math.sin(b), -Math.cos(g) * Math.sin(b), Math.cos(b)]; // east, north, up
  const out = [];
  let panel = 0, flat = 0, up = 0;
  for (let m = 0; m <= 24 * 60; m += 5) {
    const h = ((m / 60 - 12) * 15) * RAD;
    const sun = [-Math.cos(dec) * Math.sin(h), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(h), Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)];
    let gp = 0, gf = 0;
    if (sun[2] > 0) {
      const zen = Math.acos(sun[2]) / RAD;
      const am = 1 / (sun[2] + 0.50572 * (96.07995 - zen) ** -1.6364);
      const dni = 1361 * 0.7 ** (am ** 0.678);
      const dhi = 0.1 * dni;
      const inc = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
      gp = dni * Math.max(0, inc) + dhi * (1 + Math.cos(b)) / 2;
      gf = dni * sun[2] + dhi;
      up += 5 / 60;
    }
    panel += (gp * 5) / 60 / 1000;
    flat += (gf * 5) / 60 / 1000;
    out.push({ t: m / 60, gp, gf });
  }
  return { out, panel, flat, daylight: up };
}

for (const root of document.querySelectorAll("[data-nrg-tilt]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const sweep = root.querySelector("[data-sweep]");
  const s = scrubAll(root, draw);
  let best = 0;
  root.querySelector("[data-action=best]").addEventListener("click", () => s.tilt.set(best));

  function draw() {
    const lat = s.lat.get(), day = s.day.get(), tilt = s.tilt.get(), az = s.az.get();
    const d = clearDay(lat, day, tilt, az);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 220], x: [0, 24], y: [0, 1200], xticks: [0, 6, 12, 18, 24], yticks: [0, 400, 800, 1200], xfmt: (v) => `${v}h`, xlabel: "solar time", ylabel: "W/m²" });
    polyline(svg, d.out.map((q) => [f.sx(q.t), f.sy(q.gf)]), "stroke:var(--vec-u);stroke-width:1.5");
    el("path", { d: "M" + d.out.map((q) => `${f.sx(q.t).toFixed(1)},${f.sy(q.gp).toFixed(1)}`).join(" L") + ` L${f.sx(24)},${f.sy(0)} L${f.sx(0)},${f.sy(0)} Z`, style: "fill:var(--brand);fill-opacity:0.1;stroke:none" }, svg);
    polyline(svg, d.out.map((q) => [f.sx(q.t), f.sy(q.gp)]), "stroke:var(--brand);stroke-width:2");

    // Daily energy against tilt, same day and facing.
    sweep.replaceChildren();
    const tilts = Array.from({ length: 91 }, (_, i) => i);
    const ys = tilts.map((t) => clearDay(lat, day, t, az).panel);
    const top = Math.max(1, Math.ceil(Math.max(...ys)));
    best = tilts[ys.indexOf(Math.max(...ys))];
    const g = frame(sweep, { box: [44, 12, 500, 84], x: [0, 90], y: [0, top], xticks: [0, 30, 60, 90], yticks: [0, top], xfmt: (v) => `${v}°`, xlabel: "tilt", ylabel: "kWh/m²·day" });
    polyline(sweep, tilts.map((t, i) => [g.sx(t), g.sy(ys[i])]), "stroke:var(--brand);stroke-width:1.75");
    el("circle", { cx: g.sx(best), cy: g.sy(ys[best]), r: 3.5, style: "fill:var(--brand)" }, sweep);
    el("circle", { cx: g.sx(tilt), cy: g.sy(clearDay(lat, day, tilt, az).panel), r: 4.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.75" }, sweep);

    o.date.textContent = dateOf(day);
    o.daylight.textContent = `${num(d.daylight, 1)} h`;
    o.panel.textContent = `${num(d.panel, 2)} kWh/m²`;
    o.flat.textContent = `${num(d.flat, 2)} kWh/m²`;
    o.best.textContent = `${best}°`;
  }
  draw();
}

// ============================================================ Battery

const CHEM = { li: { k: 1.05, rt: 0.95, name: "Li-ion" }, lead: { k: 1.25, rt: 0.8, name: "lead-acid" } };

for (const root of document.querySelectorAll("[data-nrg-battery]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  let chem = "li";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { chem = e.detail.value; draw(); });

  function draw() {
    const C = s.cap.get(), V = s.volt.get(), I = s.load.get();
    const { k, rt } = CHEM[chem];
    const H = 20;
    const t = H * (C / (I * H)) ** k; // hours, Peukert
    const ideal = C / I;
    svg.replaceChildren();
    const tmax = Math.max(t, ideal) * 1.1;
    const f = frame(svg, { box: [44, 16, 480, 230], x: [0, tmax], y: [0, 100], xticks: [0, tmax / 4, tmax / 2, (3 * tmax) / 4, tmax].map((v) => Math.round(v * 10) / 10), yticks: [0, 25, 50, 75, 100], xlabel: "hours at this load", ylabel: "charge (%)" });
    polyline(svg, [[f.sx(0), f.sy(100)], [f.sx(ideal), f.sy(0)]], "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 4;stroke-width:1.25");
    text(svg, f.sx(ideal) + 4, f.sy(0) - 6, "if k = 1", { "text-anchor": "start" });
    polyline(svg, [[f.sx(0), f.sy(100)], [f.sx(t), f.sy(0)]], "stroke:var(--brand);stroke-width:2");
    el("circle", { cx: f.sx(t), cy: f.sy(0), r: 4, style: "fill:var(--brand)" }, svg);

    const wh = C * V;
    o.energy.textContent = wh >= 1000 ? `${num(wh / 1000, 2)} kWh` : `${num(wh, 0)} Wh`;
    o.crate.textContent = `${num(I / C, 2)}C`;
    const hrs = Math.floor(t), min = Math.round((t - hrs) * 60);
    o.runtime.textContent = `${hrs} h ${min} min (${num((100 * I * t) / C, 0)}% of rated)`;
    o.k.textContent = num(k, 2);
    o.rt.textContent = `${num(rt * 100, 0)}%: ${num(rt * 100, 0)} kWh back per 100 in`;
  }
  draw();
}

// ============================================================ Grid frequency

for (const root of document.querySelectorAll("[data-nrg-grid]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const s = scrubAll(root, draw);
  const F0 = 50, D = 1;

  function draw() {
    const dp = s.loss.get() / 100, H = s.hc.get(), R = s.droop.get() / 100, Tg = s.tg.get();
    // state: Δf (per unit), ΔPm (per unit); RK4, 40 s.
    const deriv = ([df, pm]) => [(pm - dp - D * df) / (2 * H), (-df / R - pm) / Tg];
    let x = [0, 0];
    const dt = 0.01, pts = [];
    let nadir = 0, tn = 0;
    for (let i = 0; i <= 4000; i++) {
      const t = i * dt;
      if (i % 10 === 0) pts.push([t, F0 * (1 + x[0])]);
      if (x[0] < nadir) { nadir = x[0]; tn = t; }
      const k1 = deriv(x), k2 = deriv(x.map((v, j) => v + (dt / 2) * k1[j])), k3 = deriv(x.map((v, j) => v + (dt / 2) * k2[j])), k4 = deriv(x.map((v, j) => v + dt * k3[j]));
      x = x.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    }
    const ss = -dp / (1 / R + D);
    svg.replaceChildren();
    const lo = Math.floor((F0 * (1 + nadir) - 0.05) * 10) / 10;
    const f = frame(svg, { box: [52, 16, 470, 240], x: [0, 40], y: [lo, 50.1], xticks: [0, 10, 20, 30, 40], yticks: [lo, (lo + 50) / 2, 50].map((v) => Math.round(v * 100) / 100), xlabel: "seconds after the trip", ylabel: "Hz" });
    hline(svg, f, 50, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4", "50 Hz");
    if (lo <= 49) hline(svg, f, 49, "stroke:var(--code-del);stroke-opacity:0.6;stroke-dasharray:3 4", "≈ 49 Hz: load shedding starts (Europe)");
    polyline(svg, pts.map(([t, v]) => [f.sx(t), f.sy(v)]), "stroke:var(--brand);stroke-width:2");
    // initial slope (RoCoF) as a short tangent
    const rocof = (-dp / (2 * H)) * F0;
    polyline(svg, [[f.sx(0), f.sy(50)], [f.sx(Math.min(4, (50 - lo) / -rocof)), f.sy(50 + rocof * Math.min(4, (50 - lo) / -rocof))]], "stroke:currentColor;stroke-opacity:0.5;stroke-width:1;stroke-dasharray:2 3");
    el("circle", { cx: f.sx(tn), cy: f.sy(F0 * (1 + nadir)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);

    o.rocof.textContent = `${minus(num(rocof, 3))} Hz/s`;
    o.nadir.textContent = `${num(F0 * (1 + nadir), 3)} Hz`;
    o.tnadir.textContent = `${num(tn, 1)} s`;
    o.ss.textContent = `${num(F0 * (1 + ss), 3)} Hz`;
  }
  draw();
}

// ============================================================ Energy density

// Typical ranges: Wh/kg and Wh/L at cell or fuel level, and a typical
// efficiency to motion (battery-to-wheels, engine or fuel cell).
const STORES = [
  { name: "Li-ion cell", kg: [150, 270], L: [250, 700], eff: 0.9, note: "Battery to wheels ≈ 85–90%. Packs add 20–40% mass." },
  { name: "Lead-acid", kg: [30, 50], L: [60, 110], eff: 0.75, note: "Cheap and heavy; the starter battery of most cars." },
  { name: "NiMH", kg: [60, 120], L: [140, 300], eff: 0.75, note: "Used in many hybrid cars before Li-ion." },
  { name: "Supercapacitor", kg: [1, 10], L: [1, 15], eff: 0.9, note: "Tiny energy, huge power: seconds of buffering." },
  { name: "Flywheel", kg: [5, 100], L: [20, 80], eff: 0.85, note: "System level. Spins down over hours by friction." },
  { name: "Pumped hydro (50–500 m)", kg: [0.136, 1.36], L: [0.136, 1.36], eff: 0.75, note: "1 kg of water lifted h metres stores g·h joules: 0.27 Wh/kg at 100 m." },
  { name: "Hydrogen, 700 bar", kg: [33300, 33300], L: [1200, 1400], eff: 0.5, note: "Gas only (LHV 120 MJ/kg). With the tank ≈ 1.5–2 kWh/kg. Fuel cell ≈ 50%." },
  { name: "Liquid hydrogen", kg: [33300, 33300], L: [2300, 2400], eff: 0.5, note: "−253 °C, 71 kg/m³. Fuel only; cryogenic tanks are heavy." },
  { name: "Gasoline", kg: [11900, 12200], L: [8700, 9100], eff: 0.25, note: "LHV ≈ 43–44 MJ/kg. Engine and drivetrain ≈ 20–30%." },
  { name: "Diesel", kg: [11800, 12000], L: [9800, 10000], eff: 0.3, note: "LHV ≈ 43 MJ/kg, denser than gasoline." },
];

for (const root of document.querySelectorAll("[data-nrg-storage]")) {
  const svg = root.querySelector("[data-plot]");
  const detail = root.querySelector("[data-out=detail]");
  let mode = "stored";
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  const lg = (v) => Math.log10(v);

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 16, 470, 290], x: [-1, 5], y: [-1, 5], xticks: [-1, 0, 1, 2, 3, 4, 5], yticks: [-1, 0, 1, 2, 3, 4, 5], xfmt: (v) => (v < 0 ? "0.1" : String(10 ** v)), yfmt: (v) => (v < 0 ? "0.1" : String(10 ** v)), xlabel: "Wh per kg", ylabel: "Wh per litre" });
    STORES.forEach((st) => {
      const m = mode === "useful" ? st.eff : 1;
      const x0 = lg(st.kg[0] * m), x1 = lg(st.kg[1] * m), y0 = lg(st.L[0] * m), y1 = lg(st.L[1] * m);
      const pad = 0.04;
      const g = el("g", { tabindex: 0, role: "button", "aria-label": st.name, class: "cursor-pointer outline-none" }, svg);
      const h2 = st.name.includes("ydrogen");
      const fuel = !h2 && st.kg[0] > 1000;
      const color = h2 ? "var(--vec-u)" : fuel ? "var(--ion-na)" : "var(--brand)";
      el("rect", { x: f.sx(x0 - pad), y: f.sy(y1 + pad), width: Math.max(6, f.sx(x1 + pad) - f.sx(x0 - pad)), height: Math.max(6, f.sy(y0 - pad) - f.sy(y1 + pad)), rx: 4, style: `fill:${color};fill-opacity:0.18;stroke:${color};stroke-width:1.25` }, g);
      const right = x1 > 3.6;
      const dy = st.name === "Diesel" ? -6 : st.name === "Gasoline" ? 10 : 3;
      text(g, right ? f.sx(x0 - pad) - 4 : f.sx(x1 + pad) + 4, f.sy((y0 + y1) / 2) + dy, st.name, { "text-anchor": right ? "end" : "start", class: "fill-foreground font-mono text-[10px]" });
      const show = () => {
        detail.textContent = `${st.name}: ${st.kg[0] === st.kg[1] ? num(st.kg[0], 0) : `${st.kg[0]}–${st.kg[1]}`} Wh/kg, ${st.L[0]}–${st.L[1]} Wh/L stored; ≈ ${Math.round(st.eff * 100)}% to motion. ${st.note}`;
      };
      g.addEventListener("pointerenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("click", show);
    });
  }
  draw();
}

// ============================================================ Conversion chains

const CHAINS = {
  coal: { start: "Coal", end: "visible light", stages: [["Power plant", 0.38], ["Transmission", 0.94], ["LED lamp", 0.35]] },
  car: { start: "Crude oil", end: "at the wheels", stages: [["Refining & delivery", 0.85], ["Engine", 0.3], ["Drivetrain", 0.88]] },
  ev: { start: "Sunlight", end: "at the wheels", stages: [["Solar panel", 0.2], ["Inverter & grid", 0.93], ["Charging", 0.9], ["Motor & drive", 0.88]] },
};

for (const root of document.querySelectorAll("[data-nrg-sankey]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const box = root.querySelector("[data-stages]");
  let chain = "coal";
  let effs = [];

  function controls() {
    box.replaceChildren();
    effs = CHAINS[chain].stages.map(([name, e]) => {
      const label = document.createElement("label");
      label.className = "flex items-center justify-between gap-3 text-sm";
      const span = document.createElement("span");
      span.className = "text-muted-foreground";
      span.textContent = name;
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.value = String(e);
      input.setAttribute("aria-label", `${name} efficiency`);
      input.className = "h-8 w-16 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring";
      label.append(span, input);
      box.append(label);
      return scrubbable(input, { min: 0.01, max: 1, step: 0.01, onChange: draw });
    });
  }

  function draw() {
    const c = CHAINS[chain];
    const es = effs.map((sv) => sv.get());
    svg.replaceChildren();
    const n = es.length;
    const x0 = 84, y0 = 44, base = 270, endW = 26;
    const step = (560 - x0 - endW - 128) / n;
    // px per unit of energy: the widest loss band must fit inside its stage
    let left = 100, widest = 0;
    for (const k of es) { widest = Math.max(widest, left * (1 - k)); left *= k; }
    const scale = Math.min(1.5, (0.8 * step - 10) / Math.max(1, widest));
    let e = 100, x = x0;
    text(svg, x0 - 6, y0 + 4, c.start, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    text(svg, x0 - 6, y0 + 16, "100", { "text-anchor": "end" });
    for (let i = 0; i < n; i++) {
      const out = e * es[i], lost = e - out;
      const xa = x, xb = x + step;
      const yk = y0 + out * scale, ye = y0 + e * scale, lw = lost * scale, ri = 8, ro = ri + lw;
      // kept energy runs on; the loss turns down through a quarter bend
      el("path", { d: `M${xa} ${y0}L${xb} ${y0}L${xb} ${yk}L${xa} ${yk}Z`, style: "fill:var(--brand);fill-opacity:0.55" }, svg);
      if (lw > 0.2) {
        const yEnd = Math.max(ye + ri + 6, base);
        el("path", { d: `M${xa} ${yk}A${ro} ${ro} 0 0 1 ${xa + ro} ${ye + ri}L${xa + ro} ${yEnd}L${xa + ri} ${yEnd}L${xa + ri} ${ye + ri}A${ri} ${ri} 0 0 0 ${xa} ${ye}Z`, style: "fill:currentColor;fill-opacity:0.12" }, svg);
        text(svg, xa + (ri + ro) / 2, yEnd + 13, `−${num(lost, 1)}`, { "text-anchor": "middle" });
      }
      text(svg, xa + step / 2, y0 - 16, c.stages[i][0], { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      text(svg, xa + step / 2, y0 - 5, `${Math.round(es[i] * 100)}%`, { "text-anchor": "middle" });
      el("line", { x1: xa, x2: xa, y1: y0 - 2, y2: y0 + e * scale + 2, style: "stroke:var(--background);stroke-width:1.5" }, svg);
      e = out;
      x = xb;
    }
    el("path", { d: `M${x} ${y0}L${x + endW} ${y0}L${x + endW} ${y0 + e * scale}L${x} ${y0 + e * scale}Z`, style: "fill:var(--brand);fill-opacity:0.9" }, svg);
    text(svg, x + endW + 6, y0 + 4, `${num(e, 1)}`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    text(svg, x + endW + 6, y0 + 16, c.end, { "text-anchor": "start" });
    o.total.textContent = `${num(e, 1)}%`;
    o.lost.textContent = `${num(100 - e, 1)}% as heat`;
  }

  root.addEventListener("seg-change", (ev) => { chain = ev.detail.value; controls(); draw(); });
  controls();
  draw();
}

// ============================================================ Heat pump

for (const root of document.querySelectorAll("[data-nrg-hp]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const s = scrubAll(root, draw);
  const carnot = (flow, out) => (flow + 273.15) / Math.max(1e-6, flow - out);

  function draw() {
    const out = s.out.get(), flow = s.flow.get(), eta = s.eta.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 470, 240], x: [-25, 20], y: [0, 10], xticks: [-20, -10, 0, 10, 20], yticks: [0, 2, 4, 6, 8, 10], xfmt: minus, xlabel: "outdoor temperature (°C)", ylabel: "COP" });
    const xs = Array.from({ length: 91 }, (_, i) => -25 + i * 0.5);
    const clip = (v) => Math.min(10, v);
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(clip(carnot(flow, x)))]), "stroke:currentColor;stroke-opacity:0.55;stroke-width:1.25;stroke-dasharray:4 4");
    for (const other of [35, 55]) {
      if (Math.abs(other - flow) < 1) continue;
      polyline(svg, xs.map((x) => [f.sx(x), f.sy(clip(eta * carnot(other, x)))]), "stroke:var(--brand);stroke-opacity:0.3;stroke-width:1");
      text(svg, f.sx(-24), f.sy(clip(eta * carnot(other, -24))) + (other < flow ? -6 : 13), `${other} °C flow`, { "text-anchor": "start" });
    }
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(clip(eta * carnot(flow, x)))]), "stroke:var(--brand);stroke-width:2");
    const c = carnot(flow, out), cop = eta * c;
    el("circle", { cx: f.sx(out), cy: f.sy(clip(cop)), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    o.carnot.textContent = num(c, 2);
    o.cop.textContent = num(cop, 2);
    o.heat.textContent = `${num(cop, 2)} kWh of heat`;
    const ref = eta * carnot(45, out);
    o.vs.textContent = `${cop >= ref ? "+" : "−"}${num(Math.abs((cop / ref - 1) * 100), 0)}% heat per kWh`;
  }
  draw();
}

// ============================================================ LCOE

const LCOE_PRESETS = {
  wind: { capex: 1400, fom: 40, vom: 0, fuel: 0, cf: 35, life: 25, rate: 6 },
  solar: { capex: 900, fom: 15, vom: 0, fuel: 0, cf: 15, life: 30, rate: 6 },
  gas: { capex: 900, fom: 25, vom: 4, fuel: 60, cf: 50, life: 30, rate: 7 },
};

for (const root of document.querySelectorAll("[data-nrg-lcoe]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const bars = root.querySelector("[data-bars]");
  const s = scrubAll(root, draw);
  const crf = (r, n) => (r === 0 ? 1 / n : (r * (1 + r) ** n) / ((1 + r) ** n - 1));
  const lcoe = (p, r) => {
    const mwh = 8.76 * (p.cf / 100);
    const parts = [["Capital", (p.capex * crf(r, p.life)) / mwh], ["Fixed O&M", p.fom / mwh], ["Variable O&M", p.vom], ["Fuel", p.fuel]];
    return { parts, total: parts.reduce((a, [, v]) => a + v, 0), mwh };
  };
  root.addEventListener("seg-change", (e) => {
    const p = LCOE_PRESETS[e.detail.value];
    for (const key in p) s[key].set(p[key], false);
    draw();
  });

  function draw() {
    const p = Object.fromEntries(["capex", "fom", "vom", "fuel", "cf", "life", "rate"].map((k) => [k, s[k].get()]));
    const r = p.rate / 100;
    const res = lcoe(p, r);
    // stacked bar
    bars.replaceChildren();
    const colors = ["var(--brand)", "var(--vec-u)", "var(--vec-out)", "var(--ion-na)"];
    const row = document.createElement("div");
    row.className = "flex h-7 w-full overflow-hidden rounded-md border";
    res.parts.forEach(([name, v], i) => {
      if (v <= 0) return;
      const seg = document.createElement("div");
      seg.style.width = `${(100 * v) / res.total}%`;
      seg.style.background = colors[i];
      seg.style.opacity = "0.75";
      seg.title = `${name}: ${num(v, 1)} €/MWh`;
      row.append(seg);
    });
    const legend = document.createElement("div");
    legend.className = "flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground";
    res.parts.forEach(([name, v], i) => {
      const item = document.createElement("span");
      item.className = "flex items-center gap-1.5";
      const sw = document.createElement("span");
      sw.className = "size-2 rounded-sm";
      sw.style.background = colors[i];
      item.append(sw, `${name} ${num(v, 1)}`);
      legend.append(item);
    });
    bars.append(row, legend);

    svg.replaceChildren();
    const rs = Array.from({ length: 151 }, (_, i) => i / 1000);
    const ys = rs.map((x) => lcoe(p, x).total);
    const top = Math.max(20, Math.ceil(Math.max(...ys) / 20) * 20);
    const f = frame(svg, { box: [52, 12, 470, 170], x: [0, 15], y: [0, top], xticks: [0, 5, 10, 15], yticks: [0, top / 2, top], xfmt: (v) => `${v}%`, xlabel: "discount rate", ylabel: "€/MWh" });
    polyline(svg, rs.map((x, i) => [f.sx(x * 100), f.sy(ys[i])]), "stroke:var(--brand);stroke-width:2");
    el("circle", { cx: f.sx(p.rate), cy: f.sy(res.total), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);

    o.lcoe.textContent = `${num(res.total, 1)} €/MWh`;
    o.crf.textContent = num(crf(r, p.life), 4);
    o.mwh.textContent = num(res.mwh, 2);
  }
  draw();
}

// ============================================================ Intermittency

for (const root of document.querySelectorAll("[data-nrg-mix]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const s = scrubAll(root, draw);
  let seed = 3;
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  // Normalised hourly profiles for one week (per unit of capacity).
  function profiles() {
    const rng = mulberry32(seed * 7919);
    const solar = [], wind = [];
    const clear = Array.from({ length: 7 }, () => 0.2 + 0.8 * rng());
    let u = gauss(rng);
    for (let h = 0; h < 168; h++) {
      const hour = h % 24;
      solar.push(hour > 6 && hour < 18 ? 0.85 * Math.sin((Math.PI * (hour - 6)) / 12) * clear[Math.floor(h / 24)] : 0);
      u = 0.93 * u + 0.37 * gauss(rng);
      const v = Math.max(0, 7.5 + 3.2 * u); // m/s at hub height
      wind.push(v < 3 || v > 25 ? 0 : v >= 12 ? 1 : (v ** 3 - 27) / (1728 - 27));
    }
    const demand = Array.from({ length: 168 }, (_, h) => 1 + 0.15 * Math.sin((2 * Math.PI * ((h % 24) - 9)) / 24));
    return { solar, wind, demand };
  }

  function draw() {
    const share = s.solar.get() / 100, over = s.over.get(), eta = s.eff.get() / 100;
    const { solar, wind, demand } = profiles();
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const cfs = mean(solar), cfw = mean(wind), dm = mean(demand);
    const capS = cfs > 0 ? (share * over * dm) / cfs : 0, capW = cfw > 0 ? ((1 - share) * over * dm) / cfw : 0;
    const gen = solar.map((v, h) => capS * v + capW * wind[h]);
    // Store sizing: track the level with charge and discharge losses split
    // evenly (√η each way); the store needed is the deepest drawdown.
    const half = Math.sqrt(eta);
    let level = 0, peak = 0, need = 0;
    for (let h = 0; h < 168; h++) {
      const net = gen[h] - demand[h];
      level += net > 0 ? net * half : net / half;
      peak = Math.max(peak, level);
      need = Math.max(need, peak - level);
    }
    const enough = level >= -1e-9;
    // Re-run with that store, starting full, to find curtailment.
    let lv = need, curtailed = 0, store = [];
    for (let h = 0; h < 168; h++) {
      const net = gen[h] - demand[h];
      if (net > 0) {
        const room = need - lv;
        const into = Math.min(net * half, room);
        lv += into;
        curtailed += net - into / half;
      } else lv = Math.max(0, lv + net / half);
      store.push(lv);
    }
    const genTotal = gen.reduce((a, b) => a + b, 0);

    svg.replaceChildren();
    const top = Math.max(2, Math.ceil(Math.max(...gen) + 0.5));
    const f = frame(svg, { box: [44, 16, 460, 270], x: [0, 168], y: [0, top], xticks: [0, 24, 48, 72, 96, 120, 144, 168], yticks: [0, top / 2, top], xfmt: (v) => (v % 24 === 0 ? `d${v / 24}` : String(v)), xlabel: "hours (one week)", ylabel: "× avg demand" });
    const area = (ys, base, color) => el("path", { d: "M" + ys.map((y, h) => `${f.sx(h).toFixed(1)},${f.sy(base[h] + y).toFixed(1)}`).join(" L") + " L" + base.map((b, h) => `${f.sx(h).toFixed(1)},${f.sy(b).toFixed(1)}`).reverse().join(" L") + " Z", style: `fill:${color};fill-opacity:0.35;stroke:none` }, svg);
    const zero = gen.map(() => 0), wpart = wind.map((v) => capW * v);
    area(wpart, zero, "var(--vec-u)");
    area(solar.map((v) => capS * v), wpart, "var(--vec-out)");
    polyline(svg, demand.map((d, h) => [f.sx(h), f.sy(d)]), "stroke:var(--foreground);stroke-width:1.5");
    if (need > 0) {
      const py = (v) => f.T + f.H - (v / need) * f.H;
      polyline(svg, store.map((v, h) => [f.sx(h), py(v)]), "stroke:var(--brand);stroke-width:1.75;stroke-dasharray:5 3");
      rightAxis(svg, f, [], py, "store");
    }
    o.cfs.textContent = `${num(cfs * 100, 1)}%`;
    o.cfw.textContent = `${num(cfw * 100, 1)}%`;
    o.store.textContent = enough ? `${num(need, 1)} h of demand` : "not enough energy";
    o.curt.textContent = enough ? `${num((100 * curtailed) / genTotal, 1)}% of output` : "—";
  }
  draw();
}
