// Rocket engineering blocks. Every number comes from a model computed
// here: the rocket equation, optimal identical staging, isentropic nozzle
// flow with the 1976 US Standard Atmosphere, vis-viva and Hohmann
// transfers, a two-stage gravity-turn ascent, and Allen–Eggers re-entry.
// Roots are data-rkt-* so they never match other subjects' blocks.

import "../anatomy/rocket.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const G0 = 9.80665;
const MU_E = 3.986004418e14; // m³/s²
const MU_S = 1.32712440018e20; // m³/s², the Sun
const R_E = 6371e3; // mean radius, m
const AU = 1.495978707e11;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const plot = (root, name) => root.querySelector(`[data-rkt-plot="${name}"]`);
const km = (m, d = 0) => `${Number((m / 1e3).toFixed(d)).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} km`;
const kms = (v, d = 2) => `${num(v / 1e3, d)} km/s`;
const minus = (s) => String(s).replace("-", "−");

// ------------------------------------------------------------ atmosphere
// US Standard Atmosphere 1976 pressure up to 84.852 km (geopotential
// height, taken here as geometric), 0 above.
const LAYERS = [
  [0, -6.5, 288.15, 101325],
  [11, 0, 216.65, 22632.06],
  [20, 1, 216.65, 5474.889],
  [32, 2.8, 228.65, 868.0187],
  [47, 0, 270.65, 110.9063],
  [51, -2.8, 270.65, 66.93887],
  [71, -2, 214.65, 3.95642],
];
function pressureAt(hKm) {
  if (hKm >= 84.852) return 0;
  let L = LAYERS[0];
  for (const layer of LAYERS) if (hKm >= layer[0]) L = layer;
  const [hb, lapse, tb, pb] = L;
  const K = 34.1632; // g0·M/R in K/km
  return lapse === 0 ? pb * Math.exp((-K * (hKm - hb)) / tb) : pb * Math.pow(tb / (tb + lapse * (hKm - hb)), K / lapse);
}

// ------------------------------------------------------------ isentropic nozzle
const areaMach = (M, g) => (1 / M) * Math.pow((2 / (g + 1)) * (1 + ((g - 1) / 2) * M * M), (g + 1) / (2 * (g - 1)));
function exitMach(eps, g) {
  let lo = 1.000001, hi = 60;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (areaMach(m, g) > eps) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}
const pressureRatio = (M, g) => Math.pow(1 + ((g - 1) / 2) * M * M, -g / (g - 1)); // pe/pc
const cfMomentum = (pr, g) => Math.sqrt(((2 * g * g) / (g - 1)) * Math.pow(2 / (g + 1), (g + 1) / (g - 1)) * (1 - Math.pow(pr, (g - 1) / g)));

// ============================================================ rocket equation

for (const root of document.querySelectorAll("[data-rkt-tsiol]")) {
  const svg = plot(root, "dv");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const PRESETS = [[311, "kerolox"], [451, "hydrolox"], [268, "solid"], [3000, "ion"]];
  root.addEventListener("seg-change", (e) => { s.isp.set(Number(e.detail.value), false); draw(); });

  function draw() {
    const isp = s.isp.get(), m0 = s.m0.get(), mf = s.mf.get();
    const ve = isp * G0;
    const mr = m0 / mf;
    const dv = mr > 1 ? ve * Math.log(mr) : NaN;
    svg.replaceChildren();
    const XMAX = Math.log10(30);
    const ymax = Math.max(12, Math.ceil(((Number.isFinite(dv) ? dv : 0) * 1.15) / 2e3) * 2);
    const f = frame(svg, {
      box: [46, 14, 530, 266], x: [0, XMAX], y: [0, ymax],
      xticks: [1, 2, 5, 10, 20, 30].map(Math.log10), xfmt: (v) => String(Math.round(10 ** v)),
      yticks: Array.from({ length: Math.floor(ymax / 4) + 1 }, (_, i) => i * 4), xlabel: "mass ratio m₀ / m_f (log)", ylabel: "Δv km/s",
    });
    hline(svg, f, 9.4, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4");
    text(svg, f.L + 6, f.sy(9.4) - 5, "≈ ground to low orbit", { "text-anchor": "start" });
    // Each curve stops where it leaves the plot instead of running along the top.
    const curve = (ispV) => {
      const pts = [];
      for (let i = 0; i <= 240; i++) {
        const x = (XMAX * i) / 240, y = (ispV * G0 * Math.log(10 ** x)) / 1e3;
        if (y > ymax) { pts.push([f.sx((ymax * 1e3) / (ispV * G0) / Math.LN10), f.sy(ymax)]); break; }
        pts.push([f.sx(x), f.sy(y)]);
      }
      return pts;
    };
    for (const [ispV, name] of PRESETS) {
      polyline(svg, curve(ispV), "stroke:currentColor;stroke-opacity:0.18;stroke-width:1.2");
      const xEnd = Math.min(XMAX, (ymax * 1e3) / (ispV * G0) / Math.LN10);
      const yEnd = (ispV * G0 * Math.log(10 ** xEnd)) / 1e3;
      text(svg, f.sx(xEnd) - 4, f.sy(yEnd) - 5, name, { "text-anchor": "end" });
    }
    polyline(svg, curve(isp), "stroke:var(--brand);stroke-width:2");
    if (Number.isFinite(dv) && mr <= 30) {
      el("circle", { cx: f.sx(Math.log10(mr)), cy: f.sy(Math.min(ymax, dv / 1e3)), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    }
    o.ve.textContent = `${num(ve / 1e3, 2)} km/s`;
    o.mr.textContent = mr > 1 ? num(mr, 2) : "—";
    o.frac.textContent = mr > 1 ? `${num((1 - mf / m0) * 100, 1)}% of liftoff` : "empty ≥ full";
    o.dv.textContent = Number.isFinite(dv) ? kms(dv) : "—";
  }
  draw();
}

// ============================================================ staging

// n identical stages sized for equal step ratios π = (M0/payload)^(1/n):
// each stage's mass ratio is R = 1 / (1/π + ε(1 − 1/π)).
function staged(n, m0, pay, isp, eps) {
  const pi = Math.pow(m0 / pay, 1 / n);
  const R = 1 / (1 / pi + eps * (1 - 1 / pi));
  const stages = [];
  for (let i = 0; i < n; i++) {
    const mi = m0 / Math.pow(pi, i), next = mi / pi;
    stages.push({ gross: mi - next, structure: eps * (mi - next), prop: (1 - eps) * (mi - next) });
  }
  return { dv: R > 1 ? n * isp * G0 * Math.log(R) : 0, R, stages };
}

for (const root of document.querySelectorAll("[data-rkt-staging]")) {
  const svg = plot(root, "stages");
  const o = outs(root);
  let n = 1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { n = Number(e.detail.value); draw(); });

  function draw() {
    const m0 = s.m0.get(), pay = Math.min(s.pay.get(), m0 * 0.9), isp = s.isp.get(), eps = s.eps.get();
    const runs = [1, 2, 3].map((k) => staged(k, m0, pay, isp, eps));
    const cur = runs[n - 1];
    svg.replaceChildren();
    // Left: the stack, drawn to mass (area), stage 1 at the bottom.
    const X = 70, W = 70, TOP = 20, BOT = 290;
    const scale = (BOT - TOP) / m0;
    let y = BOT;
    cur.stages.forEach((st, i) => {
      const hProp = st.prop * scale, hStruct = st.structure * scale;
      el("rect", { x: X, y: y - hStruct, width: W, height: Math.max(0.5, hStruct), style: "fill:currentColor;fill-opacity:0.35" }, svg);
      el("rect", { x: X, y: y - hStruct - hProp, width: W, height: hProp, style: `fill:var(--brand);fill-opacity:${0.55 - i * 0.12}` }, svg);
      el("rect", { x: X, y: y - hStruct - hProp, width: W, height: hStruct + hProp, rx: 2, style: "fill:none;stroke:currentColor;stroke-opacity:0.6" }, svg);
      text(svg, X + W + 8, y - (hStruct + hProp) / 2 + 3, `stage ${i + 1} · ${num(st.gross, 0)} t`, { "text-anchor": "start" });
      y -= hStruct + hProp;
    });
    el("rect", { x: X + 12, y: y - Math.max(3, pay * scale), width: W - 24, height: Math.max(3, pay * scale), rx: 2, style: "fill:var(--foreground)" }, svg);
    text(svg, X + W + 8, y - 2, `payload ${num(pay, 1)} t`, { "text-anchor": "start" });
    text(svg, X, BOT + 14, "propellant (pink) · structure (grey)", { "text-anchor": "start" });
    // Right: Δv for one, two and three stages.
    const f = frame(svg, { box: [360, 20, 220, 260], x: [0.4, 3.6], y: [0, 14], xticks: [], yticks: [0, 4, 8, 12] });
    text(svg, f.L - 6, f.T - 6, "Δv km/s", { "text-anchor": "end" });
    hline(svg, f, 9.4, "stroke:var(--code-add);stroke-dasharray:3 4");
    text(svg, f.L - 6, f.sy(9.4) + 3, "orbit", { "text-anchor": "end", style: "fill:var(--code-add)" });
    runs.forEach((r, i) => {
      const x0 = f.sx(i + 1) - 22, h = f.sy(0) - f.sy(Math.min(14, r.dv / 1e3));
      el("rect", { x: x0, y: f.sy(0) - h, width: 44, height: h, rx: 2, style: `fill:${i + 1 === n ? "var(--brand)" : "currentColor"};fill-opacity:${i + 1 === n ? 0.85 : 0.25}` }, svg);
      text(svg, f.sx(i + 1), f.sy(0) + 13, `${i + 1} stage${i ? "s" : ""}`, { "text-anchor": "middle" });
      text(svg, f.sx(i + 1), f.sy(0) - h + 13, num(r.dv / 1e3, 2), { "text-anchor": "middle", class: "fill-background font-mono text-[10px]" });
    });
    o.dv.textContent = kms(cur.dv);
    o.dv1.textContent = kms(runs[0].dv);
    o.gain.textContent = n === 1 ? "—" : `+${num((cur.dv / runs[0].dv - 1) * 100, 0)}%`;
    o.orbit.textContent = cur.dv >= 9400 ? "reaches it" : `short by ${kms(9400 - cur.dv)}`;
  }
  draw();
}

// ============================================================ nozzle

for (const root of document.querySelectorAll("[data-rkt-nozzle]")) {
  const shape = plot(root, "shape"), cfSvg = plot(root, "cf");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function at(eps, g, pc, pa) {
    const me = exitMach(eps, g), pr = pressureRatio(me, g), pe = pr * pc;
    return { me, pe, cf: cfMomentum(pr, g) + ((pe - pa) / pc) * eps };
  }

  function draw() {
    const eps = s.eps.get(), g = s.gamma.get(), pc = s.pc.get() * 1e6, alt = s.alt.get();
    const pa = pressureAt(alt);
    const cur = at(eps, g, pc, pa);
    const ratio = pa > 0 ? cur.pe / pa : Infinity;
    // Ideal area ratio here: expand until pe = pa.
    const best = pa > 0 && pa < pc ? areaMach(Math.sqrt((2 / (g - 1)) * (Math.pow(pc / pa, (g - 1) / g) - 1)), g) : Infinity;

    // The nozzle and a schematic plume.
    shape.replaceChildren();
    const cx = 130, rt = 12, re = Math.min(100, rt * Math.sqrt(eps)), yT = 70, yE = Math.min(200, yT + 30 + re * 1.2);
    const side = (sgn) => {
      const pts = [[cx + sgn * 30, 14], [cx + sgn * 30, 44]];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([cx + sgn * (30 - (30 - rt) * Math.sin((t * Math.PI) / 2)), 44 + (yT - 44) * t]); }
      for (let i = 1; i <= 20; i++) { const t = i / 20; pts.push([cx + sgn * (rt + (re - rt) * Math.pow(t, 0.7)), yT + (yE - yT) * t]); }
      return pts;
    };
    const k = Number.isFinite(ratio) ? Math.max(-1.8, Math.min(1.8, Math.log(ratio))) : 1.8;
    const plumeLen = 300 - yE - 6;
    const edge = (sgn) => Array.from({ length: 21 }, (_, i) => { const t = i / 20; const w = re * (1 + 0.32 * k * Math.sin(Math.PI * Math.min(1, t * 1.25)) * (k > 0 ? 1 : 0.8)) * (1 - 0.15 * t); return [cx + sgn * Math.max(2, w), yE + plumeLen * t]; });
    const plume = [...edge(-1), ...edge(1).reverse()];
    el("path", { d: "M" + plume.map((p) => p.join(",")).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-opacity:0.5" }, shape);
    polyline(shape, side(-1), "stroke:var(--foreground);stroke-width:1.75");
    polyline(shape, side(1), "stroke:var(--foreground);stroke-width:1.75");
    el("line", { x1: cx - 30, x2: cx + 30, y1: 14, y2: 14, style: "stroke:var(--foreground);stroke-width:1.75" }, shape);
    text(shape, cx, 10, "chamber", { "text-anchor": "middle" });
    text(shape, 6, 10, "schematic plume", { "text-anchor": "start" });

    // Thrust coefficient against altitude.
    cfSvg.replaceChildren();
    const alts = Array.from({ length: 81 }, (_, i) => i);
    const cfs = alts.map((h) => at(eps, g, pc, pressureAt(h)).cf);
    const sea = at(Math.max(1.5, Math.min(200, areaMach(Math.sqrt((2 / (g - 1)) * (Math.pow(pc / 101325, (g - 1) / g) - 1)), g))), g, pc, 0);
    const ymin = Math.min(...cfs) - 0.05, ymax = Math.max(...cfs, sea.cf) + 0.05;
    const f = frame(cfSvg, { box: [42, 14, 300, 256], x: [0, 80], y: [ymin, ymax], xticks: [0, 20, 40, 60, 80], yticks: [ymin, (ymin + ymax) / 2, ymax].map((v) => Math.round(v * 100) / 100), yfmt: (v) => v.toFixed(2), xlabel: "altitude (km)", ylabel: "Cf" });
    polyline(cfSvg, alts.map((h, i) => [f.sx(h), f.sy(cfs[i])]), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.sx(alt), x2: f.sx(alt), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, cfSvg);
    el("circle", { cx: f.sx(alt), cy: f.sy(cur.cf), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, cfSvg);

    o.me.textContent = num(cur.me, 2);
    o.pe.textContent = cur.pe >= 1e4 ? `${num(cur.pe / 1e3, 1)} kPa` : `${num(cur.pe / 1e3, 2)} kPa`;
    o.ratio.textContent = Number.isFinite(ratio) ? num(ratio, 2) : "∞ (vacuum)";
    o.cf.textContent = num(cur.cf, 3);
    o.best.textContent = Number.isFinite(best) ? num(best, 1) : "as large as fits";
    o.regime.textContent = !Number.isFinite(ratio) || ratio > 1.05 ? "under-expanded" : ratio >= 0.95 ? "ideally expanded" : ratio < 0.4 ? "over-expanded: separation likely (pe/pa < ≈0.4)" : "over-expanded";
  }
  draw();
}

// ============================================================ Hohmann

for (const root of document.querySelectorAll("[data-rkt-hohmann]")) {
  const svg = plot(root, "orbits");
  const o = outs(root);
  let mission = "geo";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    mission = e.detail.value;
    if (mission === "geo") { s.h1.set(400, false); s.h2.set(35786, false); }
    if (mission === "moon") { s.h1.set(400, false); s.h2.set(384400 - 6371, false); }
    draw();
  });

  function draw() {
    const helio = mission === "mars";
    const mu = helio ? MU_S : MU_E;
    const r1 = helio ? AU : R_E + s.h1.get() * 1e3;
    const r2 = helio ? 1.523679 * AU : R_E + s.h2.get() * 1e3;
    const a = (r1 + r2) / 2;
    const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
    const vp = Math.sqrt(mu * (2 / r1 - 1 / a)), va = Math.sqrt(mu * (2 / r2 - 1 / a));
    const dv1 = Math.abs(vp - v1), dv2 = Math.abs(v2 - va);
    const tof = Math.PI * Math.sqrt(a ** 3 / mu);

    svg.replaceChildren();
    const cx = 230, cy = 180, rMax = Math.max(r1, r2), sc = 160 / rMax;
    el("circle", { cx, cy, r: Math.max(4, (helio ? 0.08 * AU : R_E) * sc), style: `fill:${helio ? "var(--vec-out)" : "var(--vec-u)"};fill-opacity:0.8` }, svg);
    for (const [r, label] of [[r1, helio ? "Earth" : "start"], [r2, helio ? "Mars" : "target"]]) {
      el("circle", { cx, cy, r: r * sc, style: "fill:none;stroke:currentColor;stroke-opacity:0.35" }, svg);
      text(svg, cx + r * sc * 0.72 + 6, cy - r * sc * 0.72 - 4, label, { "text-anchor": "start" });
    }
    // The transfer: half an ellipse, periapsis at r1 (left), apoapsis at r2 (right).
    const inner = Math.min(r1, r2), outer = Math.max(r1, r2), aa = (inner + outer) / 2, e = (outer - inner) / (outer + inner);
    const pts = [];
    for (let i = 0; i <= 90; i++) {
      const nu = (Math.PI * i) / 90;
      const r = (aa * (1 - e * e)) / (1 + e * Math.cos(nu));
      pts.push([cx - r * Math.cos(nu) * sc, cy - r * Math.sin(nu) * sc]);
    }
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2;stroke-dasharray:6 4");
    el("circle", { cx: cx - inner * sc, cy, r: 4.5, style: "fill:var(--brand)" }, svg);
    el("circle", { cx: cx + outer * sc, cy, r: 4.5, style: "fill:var(--brand)" }, svg);
    text(svg, cx - inner * sc - 8, cy + 16, "burn 1", { "text-anchor": "end" });
    text(svg, cx + outer * sc + 8, cy + 16, "burn 2", { "text-anchor": "start" });

    o.dv1.textContent = kms(dv1);
    o.dv2.textContent = kms(dv2);
    o.dv.textContent = kms(dv1 + dv2);
    const days = tof / 86400;
    o.tof.textContent = days >= 2 ? `${num(days, 0)} days` : `${num(tof / 3600, 2)} h`;
    o.note.textContent = helio
      ? "heliocentric v∞ at each end (escaping Earth and capturing at Mars cost more)"
      : mission === "moon" ? "ignores the Moon's own gravity; ground → LEO is ≈ 9.4 km/s more" : "coplanar; ground → LEO is ≈ 9.4 km/s more";
    for (const k of ["h1", "h2"]) root.querySelector(`[data-scrub="${k}"]`).disabled = helio;
  }
  draw();
}

// ============================================================ burnout → orbit

for (const root of document.querySelectorAll("[data-rkt-burnout]")) {
  const svg = plot(root, "orbit");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const r = R_E + s.alt.get() * 1e3, v = s.v.get() * 1e3, gam = (s.fpa.get() * Math.PI) / 180;
    const hmom = r * v * Math.cos(gam);
    const E = (v * v) / 2 - MU_E / r;
    const e = Math.sqrt(Math.max(0, 1 + (2 * E * hmom * hmom) / (MU_E * MU_E)));
    const p = (hmom * hmom) / MU_E;
    const nu = Math.atan2((r * v * v * Math.cos(gam) * Math.sin(gam)) / MU_E, (r * v * v * Math.cos(gam) ** 2) / MU_E - 1);
    const rp = p / (1 + e);
    const ra = e < 1 ? p / (1 - e) : Infinity;

    svg.replaceChildren();
    const cx = 230, cy = 185, view = Math.min(Math.max(ra === Infinity ? 4 * R_E : ra, 1.6 * R_E), 6 * R_E), sc = 160 / view;
    el("circle", { cx, cy, r: (R_E + 100e3) * sc, style: "fill:var(--vec-u);fill-opacity:0.08" }, svg);
    el("circle", { cx, cy, r: R_E * sc, style: "fill:var(--vec-u);fill-opacity:0.35;stroke:var(--vec-u)" }, svg);
    // The burnout point sits at the top; periapsis is ν before it.
    const thetaB = Math.PI / 2, thetaP = thetaB - nu;
    const maxNu = e < 1 ? Math.PI : Math.acos(-1 / e) - 0.02;
    const pts = [];
    for (let i = 0; i <= 360; i++) {
      const f = -maxNu + (2 * maxNu * i) / 360;
      const rr = p / (1 + e * Math.cos(f));
      if (!(rr > 0) || rr > 8 * view) continue;
      pts.push([cx + rr * Math.cos(thetaP + f) * sc, cy - rr * Math.sin(thetaP + f) * sc]);
    }
    const crashes = rp < R_E + 100e3;
    polyline(svg, pts, `stroke:${crashes ? "var(--code-del)" : "var(--brand)"};stroke-width:2`);
    const b = [cx + r * Math.cos(thetaB) * sc, cy - r * Math.sin(thetaB) * sc];
    // velocity: horizontal (local east, to the left here) tilted up by γ
    const dir = [-Math.cos(gam), -Math.sin(gam)];
    el("line", { x1: b[0], y1: b[1], x2: b[0] + dir[0] * 34, y2: b[1] + dir[1] * 34, style: "stroke:var(--foreground);stroke-width:1.75" }, svg);
    el("circle", { cx: b[0], cy: b[1], r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.75" }, svg);
    text(svg, b[0] + 8, b[1] - 6, "burnout", { "text-anchor": "start" });
    text(svg, 6, 352, view >= 6 * R_E ? "view clipped at 6 Earth radii" : "faint ring: 100 km, top of the atmosphere", { "text-anchor": "start" });

    o.peri.textContent = km(rp - R_E);
    o.apo.textContent = Number.isFinite(ra) ? km(ra - R_E) : "—";
    o.period.textContent = E < 0 ? `${num((2 * Math.PI * Math.sqrt((p / (1 - e * e)) ** 3 / MU_E)) / 60, 1)} min` : "—";
    if (E < 0 && !crashes) {
      const vApo = hmom / ra, vCirc = Math.sqrt(MU_E / ra);
      o.circ.textContent = `+${num((vCirc - vApo), 0)} m/s at apoapsis`;
    } else o.circ.textContent = "—";
    o.verdict.textContent = E >= 0 ? "escapes Earth (hyperbolic)" : crashes ? "falls back: periapsis inside the atmosphere" : "in orbit";
    o.verdict.className = E >= 0 ? "" : crashes ? "text-del" : "text-add";
  }
  draw();
}

// ============================================================ ascent

function ascent({ kick, tkick, cda }) {
  const s1 = { dry: 7e3, prop: 90e3, isp: 290, thrust: 1.8e6 };
  const s2 = { dry: 2e3, prop: 20e3, isp: 340, thrust: 2.6e5 };
  const pay = 1e3, dt = 0.1;
  let x = 0, y = R_E, vx = 0, vy = 0, t = 0, stage = 1, kicked = false;
  let m = s1.dry + s1.prop + s2.dry + s2.prop + pay, prop = s1.prop;
  let maxq = 0, tq = 0, hq = 0, staging = null, cutoff = null, crashed = false;
  const track = [];
  for (; t < 1500; t += dt) {
    const r = Math.hypot(x, y), h = r - R_E;
    if (h < -1) { crashed = true; break; }
    const v = Math.hypot(vx, vy);
    const S = stage === 1 ? s1 : s2;
    const thrust = prop > 0 ? S.thrust : 0;
    const q = 0.5 * 1.225 * Math.exp(-h / 8500) * v * v;
    if (q > maxq) { maxq = q; tq = t; hq = h; }
    const ur = [x / r, y / r], ut = [y / r, -x / r];
    let dir;
    if (t < tkick) dir = ur;
    else if (!kicked) {
      const a = (kick * Math.PI) / 180;
      dir = [ur[0] * Math.cos(a) + ut[0] * Math.sin(a), ur[1] * Math.cos(a) + ut[1] * Math.sin(a)];
      if (t > tkick + 4) kicked = true;
    } else if (stage === 1) dir = v > 0 ? [vx / v, vy / v] : ur;
    else {
      // Upper stage: thrust horizontal, nosing up a little while falling.
      const up = vx * ur[0] + vy * ur[1] < 0 ? 0.12 : 0;
      const n = Math.hypot(ut[0] + ur[0] * up, ut[1] + ur[1] * up);
      dir = [(ut[0] + ur[0] * up) / n, (ut[1] + ur[1] * up) / n];
    }
    const drag = q * cda * (stage === 1 ? 1 : 0.4);
    const ax = (thrust * dir[0] - (v > 0 ? (drag * vx) / v : 0)) / m - (MU_E * x) / r ** 3;
    const ay = (thrust * dir[1] - (v > 0 ? (drag * vy) / v : 0)) / m - (MU_E * y) / r ** 3;
    vx += ax * dt; vy += ay * dt; x += vx * dt; y += vy * dt;
    if (thrust > 0) { const mdot = thrust / (S.isp * G0); prop -= mdot * dt; m -= mdot * dt; }
    if (Math.round(t / dt) % 10 === 0) track.push({ t, h: Math.max(0, h), down: R_E * Math.atan2(x, y), q });
    if (stage === 2 && thrust > 0) {
      const vv = Math.hypot(vx, vy), rr = Math.hypot(x, y), EE = (vv * vv) / 2 - MU_E / rr;
      if (EE < 0) {
        const aa = -MU_E / (2 * EE), hh = x * vy - y * vx, ee = Math.sqrt(Math.max(0, 1 + (2 * EE * hh * hh) / MU_E ** 2));
        if (aa * (1 - ee) - R_E > 200e3) { cutoff = { t, h: rr - R_E, v: vv, left: prop }; break; }
      }
    }
    if (prop <= 0) {
      if (stage === 1) { stage = 2; m -= s1.dry; prop = s2.prop; staging = { t, h, down: R_E * Math.atan2(x, y) }; }
      else if (!cutoff) { cutoff = { t, h, v, left: 0 }; break; }
    }
  }
  const r = Math.hypot(x, y), v = Math.hypot(vx, vy), E = (v * v) / 2 - MU_E / r;
  const a = -MU_E / (2 * E), hh = x * vy - y * vx, e = Math.sqrt(Math.max(0, 1 + (2 * E * hh * hh) / MU_E ** 2));
  track.push({ t, h: Math.max(0, r - R_E), down: R_E * Math.atan2(x, y), q: 0 });
  return { track, maxq, tq, hq, staging, cutoff, crashed, peri: E < 0 ? a * (1 - e) - R_E : NaN, apo: E < 0 ? a * (1 + e) - R_E : Infinity };
}

for (const root of document.querySelectorAll("[data-rkt-ascent]")) {
  const path = plot(root, "path"), qSvg = plot(root, "q");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const res = ascent({ kick: s.kick.get(), tkick: s.tkick.get(), cda: s.cda.get() });
    const tr = res.track;
    path.replaceChildren();
    const dmax = Math.max(100e3, ...tr.map((p) => p.down)), hmax = Math.max(50e3, ...tr.map((p) => p.h));
    const f = frame(path, { box: [46, 14, 320, 250], x: [0, dmax / 1e3], y: [0, hmax / 1e3], xticks: [0, dmax / 2e3, dmax / 1e3].map((v) => Math.round(v)), yticks: [0, hmax / 2e3, hmax / 1e3].map((v) => Math.round(v)), xlabel: "downrange (km)", ylabel: "km" });
    const stage1 = tr.filter((p) => !res.staging || p.t <= res.staging.t);
    const stage2 = tr.filter((p) => res.staging && p.t >= res.staging.t);
    polyline(path, stage1.map((p) => [f.sx(p.down / 1e3), f.sy(p.h / 1e3)]), "stroke:var(--foreground);stroke-width:2");
    polyline(path, stage2.map((p) => [f.sx(p.down / 1e3), f.sy(p.h / 1e3)]), "stroke:var(--brand);stroke-width:2");
    const qp = tr.reduce((b, p) => (p.q > b.q ? p : b), tr[0]);
    el("circle", { cx: f.sx(qp.down / 1e3), cy: f.sy(qp.h / 1e3), r: 3.5, style: "fill:var(--vec-out)" }, path);
    if (res.staging) {
      el("circle", { cx: f.sx(res.staging.down / 1e3), cy: f.sy(res.staging.h / 1e3), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, path);
      text(path, f.sx(res.staging.down / 1e3) + 6, f.sy(res.staging.h / 1e3) + 12, "staging", { "text-anchor": "start" });
    }
    text(path, f.sx(qp.down / 1e3) + 6, f.sy(qp.h / 1e3) - 4, "max-Q", { "text-anchor": "start" });

    qSvg.replaceChildren();
    const tmax = Math.max(...tr.map((p) => p.t)), qmax = Math.max(1, res.maxq / 1e3);
    const g = frame(qSvg, { box: [40, 14, 206, 250], x: [0, tmax], y: [0, qmax * 1.1], xticks: [0, Math.round(tmax / 2), Math.round(tmax)], yticks: [0, Math.round(qmax)], xlabel: "time (s)", ylabel: "q kPa" });
    polyline(qSvg, tr.map((p) => [g.sx(p.t), g.sy(p.q / 1e3)]), "stroke:var(--vec-out);stroke-width:2");
    el("circle", { cx: g.sx(res.tq), cy: g.sy(res.maxq / 1e3), r: 4, style: "fill:var(--background);stroke:var(--vec-out);stroke-width:2" }, qSvg);

    o.maxq.textContent = `${num(res.maxq / 1e3, 1)} kPa`;
    o.qat.textContent = `${num(res.tq, 0)} s · ${num(res.hq / 1e3, 1)} km`;
    o.cut.textContent = res.cutoff ? `${num(res.cutoff.t, 0)} s · ${km(res.cutoff.h)} · ${kms(res.cutoff.v)}` : res.crashed ? "—" : "—";
    const orbit = !res.crashed && res.peri > 100e3;
    o.orbit.textContent = res.crashed ? "falls back to Earth" : orbit ? `${km(res.peri)} × ${km(res.apo)}` : `suborbital (perigee ${minus(km(res.peri))})`;
    o.orbit.className = orbit ? "text-add" : "text-del";
    o.left.textContent = res.cutoff ? `${num(res.cutoff.left / 1e3, 2)} t` : "—";
  }
  draw();
}

// ============================================================ thrust-to-weight

for (const root of document.querySelectorAll("[data-rkt-twr]")) {
  const o = outs(root);
  const bars = Object.fromEntries([...root.querySelectorAll("[data-rkt-bar]")].map((n) => [n.dataset.rktBar, n]));
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-rkt-preset]").forEach((b) => b.addEventListener("click", () => {
    const [thrust, m0] = b.dataset.rktPreset.split(" ").map(Number);
    s.thrust.set(thrust, false);
    s.m0.set(m0, false);
    s.mb.set(Math.round(m0 * 0.25), false);
    draw();
  }));

  function draw() {
    const T = s.thrust.get() * 1e3;
    for (const [key, mass] of [["liftoff", s.m0.get() * 1e3], ["burnout", Math.min(s.mb.get(), s.m0.get()) * 1e3]]) {
      const twr = T / (mass * G0);
      o[`${key}-twr`].textContent = num(twr, 2);
      const acc = T / mass - G0;
      o[`${key}-acc`].textContent = key === "liftoff" && twr < 1 ? "stays on the pad" : `a = ${minus(num(acc, 1))} m/s² (vertical)`;
      o[`${key}-g`].textContent = `${num(twr, 2)} g felt`;
      bars[key].style.width = `${Math.min(100, (twr / 4) * 100)}%`;
    }
  }
  draw();
}

// ============================================================ re-entry

for (const root of document.querySelectorAll("[data-rkt-reentry]")) {
  const svg = plot(root, "entry");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const RHO0 = 1.225, H = 7200, K_SG = 1.7415e-4; // kg/m³, m, Sutton–Graves (Earth, SI)

  function draw() {
    const vE = s.v.get() * 1e3, gam = (s.gam.get() * Math.PI) / 180, beta = s.beta.get(), rn = s.rn.get();
    const sin = Math.sin(gam);
    const hs = Array.from({ length: 241 }, (_, i) => 120e3 - i * 500);
    const rows = hs.map((h) => {
      const rho = RHO0 * Math.exp(-h / H);
      const v = vE * Math.exp((-RHO0 * H * Math.exp(-h / H)) / (2 * beta * sin));
      return { h, v, decel: (rho * v * v) / (2 * beta), heat: K_SG * Math.sqrt(rho / rn) * v ** 3 };
    });
    const dmax = Math.max(...rows.map((r) => r.decel)), qmax = Math.max(...rows.map((r) => r.heat));
    const dRow = rows.find((r) => r.decel === dmax), qRow = rows.find((r) => r.heat === qmax);
    // Allen–Eggers closed form for the peak, as a check.
    const aPeak = (vE * vE * sin) / (2 * Math.E * H);
    const hPeak = H * Math.log((RHO0 * H) / (beta * sin));

    svg.replaceChildren();
    const f = frame(svg, { box: [46, 14, 530, 260], x: [120, 0], y: [0, 1.05], xticks: [120, 100, 80, 60, 40, 20, 0], yticks: [0, 0.5, 1], yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "altitude (km), falling →", ylabel: "of peak" });
    polyline(svg, rows.map((r) => [f.sx(r.h / 1e3), f.sy(r.v / vE)]), "stroke:var(--foreground);stroke-width:2");
    polyline(svg, rows.map((r) => [f.sx(r.h / 1e3), f.sy(r.decel / dmax)]), "stroke:var(--brand);stroke-width:2");
    polyline(svg, rows.map((r) => [f.sx(r.h / 1e3), f.sy(r.heat / qmax)]), "stroke:var(--ion-na);stroke-width:2");

    o.gmax.textContent = `${num(dmax / G0, 1)} g (closed form ${num(aPeak / G0, 1)} g)`;
    o.galt.textContent = hPeak > 0 ? km(dRow.h) : "at ground level";
    o.qmax.textContent = `${num(qmax / 1e6, 2)} MW/m²`;
    o.qalt.textContent = km(qRow.h);
  }
  draw();
}
