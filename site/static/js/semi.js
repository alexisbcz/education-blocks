// Semiconductors: device physics and fabrication, each block computed from
// its model: charge neutrality with incomplete ionization (Boltzmann
// statistics), Varshni's E_g(T), Caughey–Thomas mobility, the depletion
// approximation, Sze's exact MOS surface charge, square-law CMOS, the Hall
// relation, partially coherent imaging of a grating, Poisson/Murphy yield.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
// Several segmented controls can share a block: report which one changed.
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value, e.target.getAttribute("aria-label")));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => SUP[d]);
/** 1.07 × 10¹⁰ */
export function sci(v, d = 2) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / 10 ** e;
  if (Math.abs(Number(m.toFixed(d))) >= 10) { m /= 10; e += 1; }
  if (e >= -2 && e <= 3) return num(v, Math.max(0, d - e));
  return `${num(m, d)} × 10${sup(e)}`;
}
const pow10 = (e) => `10${sup(e)}`;

// ------------------------------------------------------------ Constants

const K_EV = 8.617333262e-5; // Boltzmann constant, eV/K
const Q = 1.602176634e-19; // C
const EPS0 = 8.8541878128e-14; // F/cm

// Sze (Physics of Semiconductor Devices, 3rd ed.) effective densities of
// states at 300 K, Varshni E_g(T) = E_g0 − aT²/(T + b), dopant levels
// (P/B in Si and Ge, Si/C in GaAs) and relative permittivity.
const MAT = {
  si: { name: "Si", eg0: 1.17, a: 4.73e-4, b: 636, nc: 2.86e19, nv: 2.66e19, ed: 0.045, ea: 0.045, eps: 11.7 },
  ge: { name: "Ge", eg0: 0.7437, a: 4.77e-4, b: 235, nc: 1.04e19, nv: 6.0e18, ed: 0.012, ea: 0.0104, eps: 16.0 },
  gaas: { name: "GaAs", eg0: 1.519, a: 5.405e-4, b: 204, nc: 4.7e17, nv: 9.0e18, ed: 0.0058, ea: 0.026, eps: 12.9 },
};
const egAt = (m, T) => m.eg0 - (m.a * T * T) / (T + m.b);

/**
 * solve finds the Fermi level (eV above E_v) where p + N_D⁺ = n + N_A⁻,
 * with donors (degeneracy 2) and acceptors (4) that may be un-ionized.
 */
export function solve(m, T, ND, NA) {
  const kT = K_EV * T, eg = egAt(m, T);
  const s = (T / 300) ** 1.5, Nc = m.nc * s, Nv = m.nv * s;
  const n = (ef) => Nc * Math.exp((ef - eg) / kT);
  const p = (ef) => Nv * Math.exp(-ef / kT);
  const ndp = (ef) => ND / (1 + 2 * Math.exp((ef - (eg - m.ed)) / kT));
  const nam = (ef) => NA / (1 + 4 * Math.exp((m.ea - ef) / kT));
  const g = (ef) => p(ef) + ndp(ef) - n(ef) - nam(ef);
  let lo = -0.3, hi = eg + 0.3;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid; else hi = mid;
  }
  const ef = (lo + hi) / 2;
  const ni = Math.sqrt(Nc * Nv) * Math.exp(-eg / (2 * kT));
  const ei = eg / 2 + (kT / 2) * Math.log(Nv / Nc);
  return { ef, eg, kT, Nc, Nv, n: n(ef), p: p(ef), ndp: ndp(ef), nam: nam(ef), ni, ei };
}

// ============================================================ Fermi level

for (const root of document.querySelectorAll("[data-semi-fermi]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "n";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });
  const m = MAT.si;

  function draw() {
    const T = s.t.get(), N = 10 ** s.logn.get();
    const r = solve(m, T, kind === "n" ? N : 0, kind === "p" ? N : 0);
    const { ef, eg, kT } = r;
    const lo = -0.4, hi = eg + 0.4;
    const top = 34, bot = 300;
    const y = (E) => bot - ((E - lo) / (hi - lo)) * (bot - top);
    svg.replaceChildren();

    const cols = [[56, 170, "Bands"], [200, 390, "States × occupancy"], [420, 580, "f(E)"]];
    for (const [a, b, t] of cols) text(svg, a, 18, t);

    // Bands: shaded allowed regions, edges, intrinsic level, dopant level.
    const [a1, b1] = cols[0];
    el("rect", { x: a1, y: top, width: b1 - a1, height: y(eg) - top, style: "fill:var(--vec-u);fill-opacity:0.08" }, svg);
    el("rect", { x: a1, y: y(0), width: b1 - a1, height: bot - y(0), style: "fill:var(--vec-j);fill-opacity:0.08" }, svg);
    for (const [E, lbl] of [[eg, "E_c"], [0, "E_v"]]) {
      el("line", { x1: a1, x2: b1, y1: y(E), y2: y(E), style: "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5" }, svg);
      text(svg, a1 - 6, y(E) + 3, lbl, { "text-anchor": "end" });
    }
    el("line", { x1: a1, x2: b1, y1: y(r.ei), y2: y(r.ei), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
    text(svg, a1 - 6, y(r.ei) + 3, "E_i", { "text-anchor": "end" });
    if (kind !== "i") {
      const Ed = kind === "n" ? eg - m.ed : m.ea;
      const frac = kind === "n" ? r.ndp / N : r.nam / N;
      for (let i = 0; i < 8; i++) {
        const x = a1 + 8 + i * 13;
        const ionized = i / 8 < frac;
        el("line", { x1: x, x2: x + 8, y1: y(Ed), y2: y(Ed), style: `stroke:${kind === "n" ? "var(--vec-u)" : "var(--vec-j)"};stroke-width:1.5;stroke-opacity:${ionized ? 0.35 : 1}` }, svg);
      }
      text(svg, b1 + 4, y(Ed) + 3, kind === "n" ? "E_d" : "E_a");
    }

    // States × occupancy: g(E)·f(E), with one common magnification.
    const [a2, b2] = cols[1];
    const w2 = b2 - a2;
    const f = (E) => 1 / (1 + Math.exp((E - ef) / kT));
    const steps = 160;
    const nE = (E) => Math.sqrt(Math.max(0, E - eg)) * f(E) * (m.nc / 2.66e19);
    const pE = (E) => Math.sqrt(Math.max(0, -E)) * (1 - f(E)) * (m.nv / 2.66e19);
    let peak = 0;
    for (let i = 0; i <= steps; i++) {
      peak = Math.max(peak, nE(eg + (i / steps) * 0.4), pE(-(i / steps) * 0.4));
    }
    const gmax = Math.sqrt(0.4);
    const sc = peak > 0 ? (0.85 * w2) / peak : 0;
    const gsc = (0.85 * w2) / gmax;
    const gc = [], gv = [], nf = [[a2, y(eg)]], pf = [[a2, y(0)]];
    for (let i = 0; i <= steps; i++) {
      const Ec = eg + (i / steps) * 0.4, Ev = -(i / steps) * 0.4;
      gc.push([a2 + Math.sqrt(Ec - eg) * gsc, y(Ec)]);
      gv.push([a2 + Math.sqrt(-Ev) * gsc, y(Ev)]);
      nf.push([a2 + nE(Ec) * sc, y(Ec)]);
      pf.push([a2 + pE(Ev) * sc, y(Ev)]);
    }
    nf.push([a2, y(eg + 0.4)]);
    pf.push([a2, y(-0.4)]);
    polyline(svg, gc, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3");
    polyline(svg, gv, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3");
    el("polygon", { points: nf.map((q) => q.join(",")).join(" "), style: "fill:var(--vec-u);fill-opacity:0.35;stroke:var(--vec-u);stroke-width:1.25" }, svg);
    el("polygon", { points: pf.map((q) => q.join(",")).join(" "), style: "fill:var(--vec-j);fill-opacity:0.35;stroke:var(--vec-j);stroke-width:1.25" }, svg);
    el("line", { x1: a2, x2: a2, y1: top, y2: bot, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    const mag = peak > 0 ? Math.round(Math.log10(gmax / peak)) : 0;
    text(svg, a2 + 8, y(eg / 2) - 6, "g(E): states, dashed");
    text(svg, a2 + 8, y(eg / 2) + 8, mag > 0 ? `g·f: carriers, ×${pow10(mag)}` : "g·f: carriers");

    // f(E): 0 to 1 along x.
    const [a3, b3] = cols[2];
    const fx = (v) => a3 + v * (b3 - a3);
    for (const t of [0, 0.5, 1]) {
      el("line", { x1: fx(t), x2: fx(t), y1: top, y2: bot, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, fx(t), bot + 14, String(t), { "text-anchor": "middle" });
    }
    const fc = [];
    for (let i = 0; i <= 300; i++) {
      const E = lo + (i / 300) * (hi - lo);
      fc.push([fx(f(E)), y(E)]);
    }
    polyline(svg, fc, "stroke:currentColor;stroke-width:1.75");
    el("circle", { cx: fx(0.5), cy: y(ef), r: 3, style: "fill:var(--brand)" }, svg);

    // The Fermi level runs across all three panels.
    el("line", { x1: a1, x2: b3, y1: y(ef), y2: y(ef), style: "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:6 3" }, svg);
    text(svg, a1 - 6, y(ef) + 3, "E_F", { "text-anchor": "end", style: "fill:var(--brand)" });
    text(svg, a1, bot + 14, `${num(T, 0)} K, silicon`);

    const cm3 = " cm⁻³";
    o.ni.textContent = sci(r.ni) + cm3;
    o.n.textContent = sci(r.n) + cm3;
    o.p.textContent = sci(r.p) + cm3;
    o.ef.textContent = `${num(ef - r.ei, 3)} eV`;
    o.ecf.textContent = `${num(eg - ef, 3)} eV`;
    o.ion.textContent = kind === "i" ? "—" : `${num((100 * (kind === "n" ? r.ndp : r.nam)) / N, 1)} %`;
  }
  draw();
}

// ============================================================ n against T

for (const root of document.querySelectorAll("[data-semi-carriers]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mat = "si";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { mat = v; draw(); });

  function draw() {
    const m = MAT[mat];
    const lN = s.logn.get(), ND = 10 ** lN, Tc = s.t.get();
    const ylo = Math.floor(lN) - 4, yhi = Math.floor(lN) + 4;
    svg.replaceChildren();
    const f = frame(svg, {
      box: [64, 30, 506, 248], x: [0, 800], y: [ylo, yhi],
      xticks: [0, 100, 200, 300, 400, 500, 600, 700, 800], yticks: Array.from({ length: yhi - ylo + 1 }, (_, i) => ylo + i),
      yfmt: (e) => pow10(e), xlabel: "T (K)", ylabel: "density (cm⁻³)",
    });
    const pts = [], ipts = [];
    let t1 = null, t2 = null;
    for (let T = 20; T <= 800; T += 4) {
      const r = solve(m, T, ND, 0);
      const ln = Math.log10(r.n), li = Math.log10(r.ni);
      pts.push([f.sx(T), f.sy(clamp(ln, ylo, yhi))]);
      if (li >= ylo) ipts.push([f.sx(T), f.sy(Math.min(li, yhi))]);
      const ratio = r.n / ND;
      if (t1 === null && ratio >= 0.9) t1 = T;
      if (t1 !== null && t2 === null && ratio > 1.1) t2 = T;
    }
    // Regimes as background bands.
    const bands = [[20, t1 ?? 800, "freeze-out"], [t1, t2 ?? 800, "extrinsic"], [t2, 800, "intrinsic"]];
    for (const [a, b, lbl] of bands) {
      if (a === null || b === null || b <= a) continue;
      el("rect", { x: f.sx(a), y: f.T, width: f.sx(b) - f.sx(a), height: f.H, style: `fill:currentColor;fill-opacity:${lbl === "extrinsic" ? 0 : 0.035}` }, svg);
      if (lbl === "freeze-out") text(svg, f.sx(a) + 4, f.T + 12, lbl);
      else if (f.sx(b) - f.sx(a) > 50) text(svg, (f.sx(a) + f.sx(b)) / 2, f.T + 12, lbl, { "text-anchor": "middle" });
    }
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(lN), y2: f.sy(lN), style: "stroke:var(--vec-out);stroke-width:1.25;stroke-dasharray:5 3" }, svg);
    polyline(svg, ipts, "stroke:currentColor;stroke-opacity:0.5;stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    const rc = solve(m, Tc, ND, 0);
    const lc = Math.log10(rc.n);
    el("line", { x1: f.sx(Tc), x2: f.sx(Tc), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    if (lc >= ylo && lc <= yhi) el("circle", { cx: f.sx(Tc), cy: f.sy(lc), r: 4, style: "fill:var(--brand)" }, svg);

    const cm3 = " cm⁻³";
    o.eg.textContent = `${num(rc.eg, 3)} eV`;
    o.ni.textContent = sci(rc.ni) + cm3;
    o.n.textContent = sci(rc.n) + cm3;
    o.ion.textContent = `${num((100 * rc.ndp) / ND, 1)} %`;
    const ratio = rc.n / ND;
    o.reg.textContent = ratio < 0.9 ? "freeze-out" : ratio > 1.1 ? "intrinsic" : "extrinsic";
    o.range.textContent = t1 === null ? "none" : `${t1}–${t2 ?? "800+"} K`;
  }
  draw();
}

// ============================================================ Mobility

// Caughey–Thomas with Masetti et al. (1983) parameters for silicon at
// 300 K (phosphorus for electrons, boron for holes), without the
// high-doping correction term.
const CT = {
  n: { min: 52.2, max: 1417, ref: 9.68e16, a: 0.68 },
  p: { min: 44.9, max: 470.5, ref: 2.23e17, a: 0.719 },
};
export const mobility = (c, N) => c.min + (c.max - c.min) / (1 + (N / c.ref) ** c.a);

for (const root of document.querySelectorAll("[data-semi-mobility]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let view = "mu";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { view = v; draw(); });
  const VT = 0.025852;

  function draw() {
    const lN = s.logn.get(), N = 10 ** lN;
    svg.replaceChildren();
    const mu = view === "mu";
    const y = mu ? [1, 3.4] : [-4, 3];
    const f = frame(svg, {
      box: [64, 16, 506, 262], x: [13, 20], y,
      xticks: [13, 14, 15, 16, 17, 18, 19, 20], yticks: mu ? [1, 2, 3] : [-4, -3, -2, -1, 0, 1, 2, 3],
      xfmt: pow10, yfmt: pow10, xlabel: "dopant density N (cm⁻³)", ylabel: mu ? "μ (cm²/V·s)" : "ρ (Ω·cm)",
    });
    const val = (c, n) => {
      const m = mobility(c, n);
      return mu ? Math.log10(m) : Math.log10(1 / (Q * n * m));
    };
    for (const [c, col] of [[CT.n, "var(--vec-u)"], [CT.p, "var(--vec-j)"]]) {
      const pts = [];
      for (let l = 13; l <= 20.001; l += 0.05) pts.push([f.sx(l), f.sy(clamp(val(c, 10 ** l), y[0], y[1]))]);
      polyline(svg, pts, `stroke:${col};stroke-width:2`);
      el("circle", { cx: f.sx(lN), cy: f.sy(clamp(val(c, N), y[0], y[1])), r: 4, style: `fill:${col}` }, svg);
    }
    el("line", { x1: f.sx(lN), x2: f.sx(lN), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);

    const mun = mobility(CT.n, N), mup = mobility(CT.p, N);
    o.mun.textContent = `${num(mun, 0)} cm²/V·s`;
    o.mup.textContent = `${num(mup, 0)} cm²/V·s`;
    o.dn.textContent = `${num(mun * VT, 1)} cm²/s`;
    const rho = (m) => 1 / (Q * N * m);
    o.rhon.textContent = `${sci(rho(mun))} Ω·cm`;
    o.rhop.textContent = `${sci(rho(mup))} Ω·cm`;
    const E = s.e.get(), grad = s.grad.get() * N * 1e4; // per cm
    o.jdr.textContent = `${sci(Q * N * mun * E)} A/cm²`;
    o.jdf.textContent = `${sci(Q * mun * VT * grad)} A/cm²`;
  }
  draw();
}

// ============================================================ pn junction

const SI300 = solve(MAT.si, 300, 0, 0);

/** Depletion-approximation junction, lengths in cm, energies in eV. */
export function junction(NA, ND, V) {
  const kT = SI300.kT, ni = SI300.ni, eps = MAT.si.eps * EPS0;
  const vbi = kT * Math.log((NA * ND) / (ni * ni));
  const valid = V < vbi - 0.1;
  const vj = vbi - (valid ? V : vbi - 0.1);
  const W = Math.sqrt(((2 * eps * vj) / Q) * (1 / NA + 1 / ND));
  const xp = (W * ND) / (NA + ND), xn = (W * NA) / (NA + ND);
  return { vbi, vj, W, xp, xn, emax: (Q * NA * xp) / eps, eps, valid, kT };
}

for (const root of document.querySelectorAll("[data-semi-pn]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const NA = 10 ** s.na.get(), ND = 10 ** s.nd.get(), V = s.v.get();
    const j = junction(NA, ND, V);
    const big = junction(NA, ND, -5);
    const X = 1.25 * Math.max(big.xp, big.xn); // cm, fixed by the reverse limit
    const um = (x) => x * 1e4;
    const span = um(X);
    const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20].find((t) => span / t <= 4) ?? 50;
    const xticks = [];
    for (let t = -Math.floor(span / step) * step; t <= span + 1e-9; t += step) xticks.push(Number(t.toFixed(3)));
    const { eps, xp, xn, vj, kT } = j;

    const rho = (x) => (x < -xp || x > xn ? 0 : x < 0 ? -NA : ND);
    const E = (x) => (x < -xp || x > xn ? 0 : x < 0 ? (-Q * NA * (x + xp)) / eps : (-Q * ND * (xn - x)) / eps);
    const P = (x) => (x <= -xp ? 0 : x >= xn ? vj : x < 0 ? (Q * NA * (x + xp) ** 2) / (2 * eps) : vj - (Q * ND * (xn - x) ** 2) / (2 * eps));
    const Va = j.vbi - vj; // the bias actually applied

    svg.replaceChildren();
    const L = 92, W = 478, H = 92;
    const tops = [18, 142, 266, 390];
    const xs = [];
    for (let i = 0; i <= 400; i++) xs.push(-X + (2 * X * i) / 400);
    const panel = (k, y, yt, yfmt, label, last) => {
      const f = frame(svg, { box: [L, tops[k], W, H], x: [um(-X), um(X)], y, xticks, yticks: yt, yfmt, xfmt: last ? (t) => num(t, step < 0.1 ? 2 : step < 1 ? 1 : 0) : () => "", xlabel: last ? "x (µm)" : undefined });
      text(svg, 4, tops[k] + H / 2, label);
      el("line", { x1: f.sx(0), x2: f.sx(0), y1: tops[k], y2: tops[k] + H, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
      return f;
    };

    // 1. Charge density.
    const nmax = Math.max(NA, ND);
    const f1 = panel(0, [-1.15, 1.15], [-1, 0, 1], (t) => (t === 0 ? "0" : t > 0 ? "+" : "−"), "ρ/q", false);
    if (xp > 0) el("rect", { x: f1.sx(um(-xp)), y: f1.sy(0), width: f1.sx(0) - f1.sx(um(-xp)), height: f1.sy(-NA / nmax) - f1.sy(0), style: "fill:var(--vec-j);fill-opacity:0.35;stroke:var(--vec-j)" }, svg);
    el("rect", { x: f1.sx(0), y: f1.sy(ND / nmax), width: f1.sx(um(xn)) - f1.sx(0), height: f1.sy(0) - f1.sy(ND / nmax), style: "fill:var(--vec-u);fill-opacity:0.35;stroke:var(--vec-u)" }, svg);
    text(svg, f1.sx(um(-X)) + 4, f1.T + 12, "p", { style: "fill:var(--vec-j)" });
    text(svg, f1.sx(um(X)) - 4, f1.T + 12, "n", { "text-anchor": "end", style: "fill:var(--vec-u)" });

    // 2. Field (negative: it points from n to p).
    const ref = j.vj >= j.vbi ? j : junction(NA, ND, 0);
    const kv = ref.emax / 1e3;
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((t) => kv / t <= 3) ?? 2000;
    const et = [];
    for (let t = 0; t <= kv + 1e-9; t += nice) et.push(-t);
    const f2 = panel(1, [-kv * 1.1, kv * 0.1], et, (t) => num(t, 0), "E kV/cm", false);
    polyline(svg, xs.map((x) => [f2.sx(um(x)), f2.sy(E(x) / 1e3)]), "stroke:currentColor;stroke-width:1.75");

    // 3. Potential.
    const vmax = ref.vj;
    const vt = [];
    for (let t = 0; t <= vmax + 1e-9; t += vmax > 3 ? 1 : vmax > 1.2 ? 0.5 : 0.25) vt.push(t);
    const f3 = panel(2, [-0.1 * vmax, vmax * 1.1], vt, (t) => num(t, t % 1 ? 2 : 0), "V (V)", false);
    polyline(svg, xs.map((x) => [f3.sx(um(x)), f3.sy(P(x))]), "stroke:currentColor;stroke-width:1.75");

    // 4. Bands. E_F on the p side is 0; electron energy falls as V rises.
    const eg = SI300.eg;
    const ecp = eg - kT * Math.log(SI300.Nv / NA);
    const Ec = (x) => ecp - P(x);
    const emin = ecp - vmax - eg - 0.15, emaxE = ecp + 0.15;
    const f4 = panel(3, [emin, emaxE], [], undefined, "bands (eV)", true);
    polyline(svg, xs.map((x) => [f4.sx(um(x)), f4.sy(Ec(x))]), "stroke:currentColor;stroke-width:1.75");
    polyline(svg, xs.map((x) => [f4.sx(um(x)), f4.sy(Ec(x) - eg)]), "stroke:currentColor;stroke-width:1.75");
    text(svg, f4.sx(um(-X)) + 4, f4.sy(Ec(-X)) - 4, "E_c");
    text(svg, f4.sx(um(-X)) + 4, f4.sy(Ec(-X) - eg) + 12, "E_v");
    // Quasi-Fermi levels: flat through the depletion region, relaxing to
    // the majority level in the neutral regions.
    const relax = (d) => Math.exp(-d / (0.3 * X));
    const efn = (x) => (x >= -xp ? Va : Va * relax(-xp - x));
    const efp = (x) => (x <= xn ? 0 : Va * (1 - relax(x - xn)));
    polyline(svg, xs.map((x) => [f4.sx(um(x)), f4.sy(efn(x))]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:6 3");
    if (Math.abs(Va) > 0.005) {
      polyline(svg, xs.map((x) => [f4.sx(um(x)), f4.sy(efp(x))]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:2 3");
      // Labelled at the junction, where the band edges are far away.
      text(svg, f4.sx(0) - 6, f4.sy(Va) - 5, "E_Fn", { "text-anchor": "end", style: "fill:var(--brand)" });
      text(svg, f4.sx(0) + 14, f4.sy(0) + 12, "E_Fp", { style: "fill:var(--brand)" });
    } else {
      text(svg, f4.sx(0) + 6, f4.sy(0) - 5, "E_F", { style: "fill:var(--brand)" });
    }

    o.vbi.textContent = `${num(j.vbi, 3)} V`;
    o.w.textContent = `${num(um(j.W), 3)} µm`;
    o.x.textContent = `${num(um(xp), 3)} / ${num(um(xn), 3)} µm`;
    o.emax.textContent = `${num(j.emax / 1e3, 1)} kV/cm`;
    o.bar.textContent = j.valid ? `${num(vj, 3)} eV` : `${num(vj, 3)} eV (V too near V_bi: model invalid)`;
    o.cj.textContent = `${num((eps / j.W) * 1e9, 2)} nF/cm²`;
  }
  draw();
}

// ============================================================ MOS C–V

for (const root of document.querySelectorAll("[data-semi-mos]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const NA = 10 ** s.na.get(), tox = s.tox.get() * 1e-7, vfb = s.vfb.get();
    const kT = SI300.kT, ni = SI300.ni, b = 1 / kT;
    const es = MAT.si.eps * EPS0, cox = (3.9 * EPS0) / tox;
    const n0p0 = (ni * ni) / NA / NA;
    const LD = Math.sqrt((es * kT) / (Q * NA));
    const phiF = kT * Math.log(NA / ni);
    const pre = (Math.SQRT2 * es * kT) / LD;
    // Sze's surface charge: Q_s = −sgn(ψ)·√2·ε_s kT/(q L_D)·F(ψ).
    const Fn = (psi, minority) => Math.sqrt(Math.max(0, Math.exp(-b * psi) + b * psi - 1 + (minority ? n0p0 * (Math.exp(b * psi) - b * psi - 1) : 0)));
    const Qs = (psi, minority = true) => -Math.sign(psi) * pre * Fn(psi, minority);
    const dQ = (psi, minority) => Math.abs(Qs(psi + 1e-4, minority) - Qs(psi - 1e-4, minority)) / 2e-4;
    const series = (cs) => 1 / (1 / cox + 1 / cs) / cox;
    const vt = vfb + 2 * phiF + Math.sqrt(4 * es * Q * NA * phiF) / cox;
    const wmax = Math.sqrt((2 * es * 2 * phiF) / (Q * NA));

    const x0 = Math.floor(vfb - 2.5), x1 = Math.ceil(Math.max(vt + 2, vfb + 3));
    const lf = [], hf = [];
    for (let i = 0; i <= 1600; i++) {
      const psi = -0.35 + (i / 1600) * (2 * phiF + 0.75);
      const vg = vfb + psi - Qs(psi) / cox;
      if (vg < x0 - 0.5 || vg > x1 + 0.5) continue;
      lf.push([vg, series(dQ(psi, true))]);
      hf.push([vg, series(dQ(Math.min(psi, 2 * phiF), false))]);
    }
    svg.replaceChildren();
    const span = x1 - x0;
    const st = span > 20 ? 5 : span > 10 ? 2 : 1;
    const xt = [];
    for (let t = Math.ceil(x0 / st) * st; t <= x1; t += st) xt.push(t);
    const f = frame(svg, { box: [56, 16, 514, 262], x: [x0, x1], y: [0, 1.08], xticks: xt, yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (t) => num(t, 0), yfmt: (t) => num(t, 2), xlabel: "gate voltage V_G (V)", ylabel: "C / C_ox" });
    const toPts = (arr) => arr.filter(([v]) => v >= x0 && v <= x1).map(([v, c]) => [f.sx(v), f.sy(c)]);
    polyline(svg, toPts(hf), "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, toPts(lf), "stroke:var(--brand);stroke-width:2;stroke-dasharray:6 3");
    for (const [v, lbl] of [[vfb, "V_FB"], [vt, "V_T"]]) {
      if (v < x0 || v > x1) continue;
      el("line", { x1: f.sx(v), x2: f.sx(v), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
      text(svg, f.sx(v) + 4, f.T + f.H - 6, lbl);
    }
    const regions = [[x0, vfb, "accumulation"], [vfb, vt, "depletion"], [vt, x1, "inversion"]];
    for (const [a, c, lbl] of regions) {
      const A = Math.max(a, x0), B = Math.min(c, x1);
      if (f.sx(B) - f.sx(A) > 70) text(svg, (f.sx(A) + f.sx(B)) / 2, f.T + 12, lbl, { "text-anchor": "middle" });
    }

    const cmin = series(dQ(2 * phiF, false));
    o.cox.textContent = `${num(cox * 1e9, 1)} nF/cm²`;
    o.phif.textContent = `${num(phiF, 3)} V`;
    o.vt.textContent = `${num(vt, 2)} V`;
    o.wmax.textContent = `${num(wmax * 1e7, 0)} nm`;
    o.cmin.textContent = num(cmin, 3);
    o.ld.textContent = `${num(LD * 1e7, 1)} nm`;
  }
  draw();
}

// ============================================================ CMOS inverter

const KN = 100e-6; // A/V², the nMOS transconductance parameter

export function ids(vgs, vds, k, vt, lam) {
  const vov = vgs - vt;
  if (vov <= 0 || vds <= 0) return 0;
  const clm = 1 + lam * vds;
  return vds < vov ? k * (vov * vds - (vds * vds) / 2) * clm : (k / 2) * vov * vov * clm;
}

/** Output voltage where I_n = I_p, by bisection (I_n − I_p rises with V_out). */
export function vout(vin, p) {
  let lo = 0, hi = p.vdd;
  for (let i = 0; i < 60; i++) {
    const v = (lo + hi) / 2;
    const d = ids(vin, v, p.kn, p.vtn, p.lam) - ids(p.vdd - vin, p.vdd - v, p.kp, p.vtp, p.lam);
    if (d > 0) hi = v; else lo = v;
  }
  return (lo + hi) / 2;
}

for (const root of document.querySelectorAll("[data-semi-cmos]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const p = { vdd: s.vdd.get(), vtn: s.vtn.get(), vtp: s.vtp.get(), lam: s.lam.get(), kn: KN, kp: KN / s.r.get() };
    const N = 600, pts = [];
    for (let i = 0; i <= N; i++) {
      const vi = (i / N) * p.vdd, vo = vout(vi, p);
      pts.push([vi, vo, ids(vi, vo, p.kn, p.vtn, p.lam)]);
    }
    // Unity-gain points and the switching threshold.
    let vil = null, vih = null, ipk = 0;
    for (let i = 1; i < pts.length; i++) {
      const g = (pts[i][1] - pts[i - 1][1]) / (pts[i][0] - pts[i - 1][0]);
      if (g <= -1) { if (vil === null) vil = pts[i - 1][0]; vih = pts[i][0]; }
      ipk = Math.max(ipk, pts[i][2]);
    }
    const voh = pts[0][1], vol = pts.at(-1)[1];
    let a = 0, b = p.vdd;
    for (let i = 0; i < 50; i++) { const c = (a + b) / 2; if (vout(c, p) > c) a = c; else b = c; }
    const vm = (a + b) / 2;

    svg.replaceChildren();
    const vd = p.vdd;
    const st = vd > 3 ? 1 : 0.5;
    const ticks = [];
    for (let t = 0; t <= vd + 1e-9; t += st) ticks.push(t);
    const f = frame(svg, { box: [52, 16, 470, 270], x: [0, vd], y: [0, vd * 1.05], xticks: ticks, yticks: ticks, xfmt: (t) => num(t, 1), yfmt: (t) => num(t, 1), xlabel: "V_in (V)", ylabel: "V_out (V)" });
    // Current on a right axis.
    const iMax = ipk > 0 ? ipk * 1.15 : 1;
    const iy = (i) => f.T + f.H - (i / iMax) * f.H;
    const iStep = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((t) => (iMax * 1e6) / t <= 5) ?? 1000;
    for (let t = 0; t <= iMax * 1e6; t += iStep) text(svg, f.L + f.W + 6, iy(t * 1e-6) + 3, num(t, 0));
    text(svg, f.L + f.W + 6, f.T - 6, "I (µA)");
    el("polygon", { points: [[f.sx(0), iy(0)], ...pts.map(([vi, , i]) => [f.sx(vi), iy(i)]), [f.sx(vd), iy(0)]].map((q) => q.join(",")).join(" "), style: "fill:var(--vec-out);fill-opacity:0.15;stroke:var(--vec-out);stroke-width:1.25" }, svg);
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(vd), f.sy(vd)]], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 3");
    polyline(svg, pts.map(([vi, vo]) => [f.sx(vi), f.sy(vo)]), "stroke:var(--brand);stroke-width:2");
    for (const [v, lbl] of [[vil, "V_IL"], [vih, "V_IH"]]) {
      if (v === null) continue;
      el("line", { x1: f.sx(v), x2: f.sx(v), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
      text(svg, f.sx(v) + (lbl === "V_IL" ? -4 : 4), f.T + 10, lbl, { "text-anchor": lbl === "V_IL" ? "end" : "start" });
    }
    if (vm !== null) {
      el("circle", { cx: f.sx(vm), cy: f.sy(vm), r: 4, style: "fill:var(--brand)" }, svg);
      text(svg, f.sx(vm) - 8, f.sy(vm) + 4, "V_M", { "text-anchor": "end" });
    }

    o.vm.textContent = vm === null ? "—" : `${num(vm, 3)} V`;
    o.vil.textContent = vil === null ? "—" : `${num(vil, 3)} / ${num(vih, 3)} V`;
    o.vol.textContent = `${num(vol, 3)} / ${num(voh, 3)} V`;
    o.nml.textContent = vil === null ? "—" : `${num(vil - vol, 3)} V`;
    o.nmh.textContent = vih === null ? "—" : `${num(voh - vih, 3)} V`;
    o.ipk.textContent = `${num(ipk * 1e6, 1)} µA`;
  }
  draw();
}

// ============================================================ Hall effect

for (const root of document.querySelectorAll("[data-semi-hall]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "n";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });
  const WIDTH = 1e-3; // m, the slab's width across the Hall contacts

  function draw() {
    const n = 10 ** s.logn.get() * 1e6; // m⁻³
    const t = s.t.get() * 1e-6, I = s.i.get() * 1e-3, B = s.b.get();
    const sign = kind === "p" ? 1 : -1;
    const vh = (sign * I * B) / (Q * n * t); // top minus bottom
    const vd = I / (Q * n * WIDTH * t);

    svg.replaceChildren();
    const x0 = 110, x1 = 470, y0 = 100, y1 = 220;
    text(svg, 24, 18, "⊗ B points into the page");
    el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 4, style: "fill:currentColor;fill-opacity:0.05;stroke:currentColor;stroke-opacity:0.5" }, svg);
    // The magnetic field, into the page, drawn faintly inside the slab.
    for (let gx = x0 + 30; gx < x1; gx += 50) {
      for (const gy of [y0 + 30, y1 - 30]) {
        el("circle", { cx: gx, cy: gy, r: 5, style: "fill:none;stroke:currentColor;stroke-opacity:0.18" }, svg);
        el("path", { d: `M${gx - 3},${gy - 3}L${gx + 3},${gy + 3}M${gx + 3},${gy - 3}L${gx - 3},${gy + 3}`, style: "stroke:currentColor;stroke-opacity:0.18" }, svg);
      }
    }
    // Current contacts and arrow.
    for (const x of [x0 - 14, x1]) el("rect", { x, y: y0 + 10, width: 14, height: y1 - y0 - 20, style: "fill:currentColor;fill-opacity:0.25" }, svg);
    el("path", { d: `M40,160 L${x0 - 20},160`, style: "stroke:currentColor;stroke-width:1.5" }, svg);
    el("path", { d: `M${x0 - 26},155 L${x0 - 18},160 L${x0 - 26},165`, style: "fill:none;stroke:currentColor;stroke-width:1.5" }, svg);
    text(svg, 24, 150, `I = ${num(I * 1e3, 2)} mA`);
    el("path", { d: `M${x1 + 14},160 L500,160`, style: "stroke:currentColor;stroke-width:1.5" }, svg);
    el("path", { d: `M494,155 L502,160 L494,165`, style: "fill:none;stroke:currentColor;stroke-width:1.5" }, svg);

    // Carriers drift (holes with I, electrons against it) and are bent
    // toward the top edge in both cases: F = q v × B.
    const col = kind === "p" ? "var(--vec-j)" : "var(--vec-u)";
    const ch = kind === "p" ? "+" : "−";
    for (let k = 0; k < 3; k++) {
      const yStart = 195 - k * 22;
      const xa = kind === "p" ? x0 + 30 + k * 30 : x1 - 30 - k * 30;
      const xb = kind === "p" ? xa + 150 : xa - 150;
      const cx = (xa + xb) / 2;
      el("path", { d: `M${xa},${yStart} Q${cx},${yStart} ${xb},${y0 + 12}`, style: `fill:none;stroke:${col};stroke-opacity:0.7;stroke-width:1.25;stroke-dasharray:4 3` }, svg);
      el("circle", { cx: xa, cy: yStart, r: 6, style: `fill:${col};fill-opacity:0.25;stroke:${col}` }, svg);
      text(svg, xa, yStart + 3.5, ch, { "text-anchor": "middle", style: `fill:${col}` });
    }
    // Accumulated charge: carriers on top, the opposite on the bottom.
    for (let x = x0 + 18; x < x1 - 8; x += 24) {
      text(svg, x, y0 + 4, ch, { "text-anchor": "middle", style: `fill:${col};font-size:13px` });
      text(svg, x, y1 + 2, kind === "p" ? "−" : "+", { "text-anchor": "middle", style: "fill:currentColor;fill-opacity:0.5;font-size:13px" });
    }
    // Hall contacts and voltmeter.
    const mx = 300;
    el("path", { d: `M${mx},${y0} L${mx},70 L548,70 L548,140`, style: "fill:none;stroke:currentColor;stroke-opacity:0.5" }, svg);
    el("path", { d: `M${mx},${y1} L${mx},262 L548,262 L548,190`, style: "fill:none;stroke:currentColor;stroke-opacity:0.5" }, svg);
    for (const y of [y0, y1]) el("circle", { cx: mx, cy: y, r: 3, style: "fill:currentColor" }, svg);
    el("circle", { cx: 548, cy: 165, r: 25, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, svg);
    text(svg, 548, 162, "V_H", { "text-anchor": "middle" });
    text(svg, 548, 175, vh >= 0 ? "+" : "−", { "text-anchor": "middle", style: "fill:var(--brand);font-size:13px" });
    text(svg, 312, 66, "top contact");
    text(svg, 24, 300, `w = 1 mm, t = ${num(t * 1e6, 0)} µm, B = ${num(B, 2)} T`);

    const fmtV = (v) => {
      const a = Math.abs(v);
      const [f, u] = a >= 1 ? [1, "V"] : a >= 1e-3 ? [1e3, "mV"] : a >= 1e-6 ? [1e6, "µV"] : [1e9, "nV"];
      return `${Number((v * f).toPrecision(3)).toString().replace("-", "−")} ${u}`;
    };
    o.vh.textContent = fmtV(vh);
    o.rh.textContent = `${sci((sign / (Q * n)) * 1e6)} cm³/C`;
    o.eh.textContent = `${sci(Math.abs(vh) / WIDTH)} V/m`;
    o.vd.textContent = `${sci(vd)} m/s`;
    const back = (I * B) / (Q * t * Math.abs(vh)) / 1e6;
    o.back.textContent = `${vh > 0 ? "holes" : "electrons"}, ${sci(back)} cm⁻³`;
  }
  draw();
}

// ============================================================ Process flow

// Materials and their fills. Doping uses the electron/hole colours.
const MATS = {
  si: ["silicon", "currentColor", 12],
  ox: ["oxide (SiO₂)", "var(--vec-i)", 30],
  nw: ["n-type", "var(--vec-u)", 18],
  pw: ["p-type", "var(--vec-j)", 14],
  nl: ["n⁻ / n⁺", "var(--vec-u)", 45],
  pl: ["p⁻ / p⁺", "var(--vec-j)", 45],
  poly: ["polysilicon", "var(--vec-out)", 60],
  sin: ["nitride", "var(--vec-v)", 50],
  sil: ["silicide", "currentColor", 55],
  w: ["tungsten", "currentColor", 32],
  cu: ["copper", "var(--ion-na)", 60],
};
// Opaque fills, so a layer hides what it covers.
const matFill = (m) => `color-mix(in oklab, ${MATS[m][1]} ${MATS[m][2]}%, var(--background))`;

// Each step lists what it adds as [step, material, shape] and what it
// removes. Coordinates: silicon top at y = 150; nMOS left, pMOS right.
const SI_TOP = 150;
const G = { n: 145, p: 425 }; // gate left edges, 30 wide
const r = (x, y, w, hh) => ({ rect: [x, y, w, hh] });
const STEPS = [
  { t: "Start with a p-type wafer", d: "A slice of single-crystal silicon, lightly doped with boron, polished flat. Everything is built in its top micrometre." },
  { t: "Shallow trench isolation", d: "Trenches are etched and filled with oxide, then polished flat (CMP). They insulate neighbouring transistors from each other." },
  { t: "Wells", d: "Through photoresist masks, an implant makes a p-well for the nMOS and an n-well for the pMOS. A high-temperature anneal drives the dopants deeper." },
  { t: "Gate oxide", d: "A thin layer of oxide is grown on the bare silicon: only a few nanometres in older nodes, drawn here much thicker." },
  { t: "Polysilicon gates", d: "Polysilicon is deposited, patterned by lithography and etched into gates. The oxide stays only under the gate; the gate is now a mask for what follows." },
  { t: "Light (LDD) implants", d: "A shallow, light implant on each side of each gate, self-aligned to it: n⁻ for the nMOS, p⁻ for the pMOS. It softens the field at the drain." },
  { t: "Spacers", d: "Nitride is deposited everywhere and etched straight down. Only the sidewalls of the gates keep a sliver: the spacers." },
  { t: "Source and drain, then anneal", d: "Heavy implants, n⁺ and p⁺, offset by the spacers, then a fast anneal that puts the dopants into the lattice (activation) and repairs the damage." },
  { t: "Silicide", d: "A metal (nickel today) reacts with exposed silicon only, leaving a low-resistance silicide on sources, drains and gates: self-aligned silicide, or salicide." },
  { t: "Insulator and contacts", d: "An oxide insulator covers everything. Holes are etched down to each source, drain and gate and filled with tungsten plugs." },
  { t: "Metal 1", d: "The first copper wiring layer, laid in trenches in another insulator (damascene). Ten or more such layers follow above it." },
];
function geometry(k) {
  const parts = [];
  const add = (from, mat, shape, until = Infinity) => { if (k >= from && k < until) parts.push({ from, mat, ...shape }); };
  add(0, "si", r(20, SI_TOP, 560, 140));
  add(2, "pw", r(20, SI_TOP, 280, 95));
  add(2, "nw", r(300, SI_TOP, 280, 95));
  for (const x of [20, 285, 550]) add(1, "ox", r(x, SI_TOP, 30, 42));
  // Gate oxide: everywhere on the active silicon, then only under gates.
  add(3, "ox", r(50, SI_TOP - 4, 235, 4), 4);
  add(3, "ox", r(315, SI_TOP - 4, 235, 4), 4);
  for (const x of [G.n, G.p]) add(4, "ox", r(x, SI_TOP - 4, 30, 4));
  for (const x of [G.n, G.p]) add(4, "poly", r(x, SI_TOP - 32, 30, 28));
  // LDD.
  add(5, "nl", r(50, SI_TOP, G.n - 50, 7));
  add(5, "nl", r(G.n + 30, SI_TOP, 285 - G.n - 30, 7));
  add(5, "pl", r(315, SI_TOP, G.p - 315, 7));
  add(5, "pl", r(G.p + 30, SI_TOP, 550 - G.p - 30, 7));
  // Spacers.
  for (const x of [G.n, G.p]) {
    add(6, "sin", { path: `M${x},${SI_TOP} L${x - 9},${SI_TOP} Q${x - 9},${SI_TOP - 30} ${x},${SI_TOP - 32} Z` });
    add(6, "sin", { path: `M${x + 30},${SI_TOP} L${x + 39},${SI_TOP} Q${x + 39},${SI_TOP - 30} ${x + 30},${SI_TOP - 32} Z` });
  }
  // Source and drain.
  add(7, "nl", r(50, SI_TOP, G.n - 9 - 50, 24));
  add(7, "nl", r(G.n + 39, SI_TOP, 285 - G.n - 39, 24));
  add(7, "pl", r(315, SI_TOP, G.p - 9 - 315, 24));
  add(7, "pl", r(G.p + 39, SI_TOP, 550 - G.p - 39, 24));
  // Silicide.
  for (const [a, b] of [[50, G.n - 9], [G.n + 39, 285], [315, G.p - 9], [G.p + 39, 550]]) add(8, "sil", r(a, SI_TOP - 3, b - a, 3));
  for (const x of [G.n, G.p]) add(8, "sil", r(x, SI_TOP - 35, 30, 3));
  // Insulator and contacts.
  add(9, "ox", { path: `M20,${SI_TOP} L20,62 L580,62 L580,${SI_TOP} Z`, under: true });
  const plugs = [[90, SI_TOP - 3], [G.n + 11, SI_TOP - 35], [230, SI_TOP - 3], [355, SI_TOP - 3], [G.p + 11, SI_TOP - 35], [510, SI_TOP - 3]];
  for (const [x, y] of plugs) add(9, "w", r(x, 62, 8, y - 62));
  for (const [x] of plugs) add(10, "cu", r(x - 10, 46, 28, 16));
  return parts;
}

for (const root of document.querySelectorAll("[data-semi-process]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const list = root.querySelector("[data-steps]");
  const legend = root.querySelector("[data-legend]");
  let k = 0;

  list.replaceChildren(...STEPS.map((st, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.goto = String(i);
    b.className = "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-[current=step]:bg-accent aria-[current=step]:text-foreground";
    const n = document.createElement("span");
    n.className = "w-5 font-mono text-[11px] tabular-nums text-muted-foreground/70";
    n.textContent = String(i + 1).padStart(2, "0");
    b.append(n, st.t);
    li.append(b);
    return li;
  }));

  function render(animate) {
    svg.replaceChildren();
    const parts = geometry(k);
    // The insulator sits behind the gates and plugs.
    parts.sort((a, b) => (b.under ? 1 : 0) - (a.under ? 1 : 0));
    const fresh = [];
    for (const p of parts) {
      const style = `fill:${matFill(p.mat)}`;
      const node = p.rect
        ? el("rect", { x: p.rect[0], y: p.rect[1], width: p.rect[2], height: p.rect[3], style }, svg)
        : el("path", { d: p.path, style }, svg);
      if (p.from === k && k > 0) {
        node.setAttribute("stroke", "var(--brand)");
        node.setAttribute("stroke-width", "1");
        fresh.push(node);
      }
    }
    // Insulator drawn first needs its gates and plugs on top: done by
    // the sort. Labels.
    text(svg, 160, 285, "nMOS", { "text-anchor": "middle" });
    text(svg, 440, 285, "pMOS", { "text-anchor": "middle" });
    if (k >= 2) {
      text(svg, 30, SI_TOP + 88, "p-well");
      text(svg, 570, SI_TOP + 88, "n-well", { "text-anchor": "end" });
    }
    if (k >= 7) {
      text(svg, 95, SI_TOP + 18, "n⁺ S", { "text-anchor": "middle" });
      text(svg, 235, SI_TOP + 18, "n⁺ D", { "text-anchor": "middle" });
      text(svg, 360, SI_TOP + 18, "p⁺ D", { "text-anchor": "middle" });
      text(svg, 505, SI_TOP + 18, "p⁺ S", { "text-anchor": "middle" });
    }
    if (k >= 4 && k < 9) for (const x of [G.n, G.p]) text(svg, x + 15, SI_TOP - 40, "gate", { "text-anchor": "middle" });
    if (animate && !reduced()) for (const n of fresh) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });

    const used = [...new Set(parts.map((p) => p.mat))];
    legend.replaceChildren(...used.map((m) => {
      const s = document.createElement("span");
      s.className = "flex items-center gap-1.5";
      const sw = document.createElement("span");
      sw.className = "size-2.5 rounded-sm border border-foreground/20";
      sw.setAttribute("style", `background:${matFill(m)}`);
      s.append(sw, MATS[m][0]);
      return s;
    }));
    o.count.textContent = `${k + 1} / ${STEPS.length}`;
    o.title.textContent = STEPS[k].t;
    o.text.textContent = STEPS[k].d;
    for (const b of list.querySelectorAll("[data-goto]")) {
      if (Number(b.dataset.goto) === k) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    }
    root.querySelector('[data-step="-1"]').disabled = k === 0;
    root.querySelector('[data-step="1"]').disabled = k === STEPS.length - 1;
  }

  const go = (n) => {
    const next = clamp(n, 0, STEPS.length - 1);
    if (next === k) return;
    const forward = next > k;
    k = next;
    render(forward);
  };
  root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-step]");
    if (s) return s.dataset.step === "reset" ? go(0) : go(k + Number(s.dataset.step));
    const g = e.target.closest("[data-goto]");
    if (g) go(Number(g.dataset.goto));
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(k + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(k - 1); }
  });
  render(false);
}

// ============================================================ Lithography

const SCANNERS = {
  iline: { lam: 365, na: 0.6, name: "i-line, mercury lamp" },
  krf: { lam: 248, na: 0.8, name: "KrF excimer" },
  arf: { lam: 193, na: 0.93, name: "ArF, dry" },
  arfi: { lam: 193, na: 1.35, name: "ArF in water" },
  euv: { lam: 13.5, na: 0.33, name: "EUV" },
  euvh: { lam: 13.5, na: 0.55, name: "High-NA EUV" },
};

/**
 * Aerial image of an equal line/space grating: the mask's Fourier orders
 * c_m = sin(πm/2)/(πm) pass when |mλ/p + s| ≤ NA for a source point s,
 * averaged over a 1-D source of half-width σ·NA. Returns I(x) samples.
 */
export function aerial(lam, na, sigma, pitch, xs) {
  const ns = sigma > 0 ? 41 : 1;
  const M = Math.ceil(((1 + sigma) * na * pitch) / lam) + 1;
  const I = new Float64Array(xs.length);
  const passed = new Set();
  for (let j = 0; j < ns; j++) {
    const sNA = ns === 1 ? 0 : (-1 + (2 * j) / (ns - 1)) * sigma * na;
    const ords = [];
    for (let m = -M; m <= M; m++) {
      if (Math.abs((m * lam) / pitch + sNA) <= na + 1e-12) ords.push(m);
    }
    ords.forEach((m) => passed.add(m));
    for (let i = 0; i < xs.length; i++) {
      let re = 0, im = 0;
      for (const m of ords) {
        const c = m === 0 ? 0.5 : Math.sin((Math.PI * m) / 2) / (Math.PI * m);
        const ph = (2 * Math.PI * m * xs[i]) / pitch;
        re += c * Math.cos(ph);
        im += c * Math.sin(ph);
      }
      I[i] += (re * re + im * im) / ns;
    }
  }
  return { I, passed: [...passed].sort((a, b) => a - b) };
}

for (const root of document.querySelectorAll("[data-semi-litho]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let sc = SCANNERS.arfi;
  const s = scrubAll(root, () => draw());
  // Two rows of one choice: start on ArF immersion.
  const pick = (v) => {
    for (const b of root.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b.dataset.seg === v));
  };
  onSeg(root, (v) => {
    pick(v);
    sc = SCANNERS[v];
    s.na.set(sc.na, false);
    draw();
  });
  pick("arfi");

  function draw() {
    const lam = sc.lam, na = s.na.get(), sigma = s.sigma.get(), hp = s.hp.get();
    const pitch = 2 * hp;
    const xs = [];
    for (let i = 0; i <= 480; i++) xs.push(-1.5 * pitch + (3 * pitch * i) / 480);
    const { I, passed } = aerial(lam, na, sigma, pitch, xs);
    let lo = Infinity, hi = -Infinity;
    for (const v of I) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const con = hi + lo > 0 ? (hi - lo) / (hi + lo) : 0;

    svg.replaceChildren();
    const L = 52, W = 520;
    const sx = (x) => L + ((x + 1.5 * pitch) / (3 * pitch)) * W;
    // Mask: clear where |x mod p| < p/4.
    text(svg, L, 16, "mask");
    el("rect", { x: L, y: 24, width: W, height: 22, style: "fill:currentColor;fill-opacity:0.65" }, svg);
    for (let c = -2; c <= 2; c++) {
      const a = Math.max(-1.5 * pitch, c * pitch - pitch / 4), b = Math.min(1.5 * pitch, c * pitch + pitch / 4);
      if (b > a) el("rect", { x: sx(a), y: 24, width: sx(b) - sx(a), height: 22, style: "fill:var(--background)" }, svg);
    }
    el("rect", { x: L, y: 24, width: W, height: 22, style: "fill:none;stroke:currentColor;stroke-opacity:0.4" }, svg);

    const ticksNm = [];
    const stepNm = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((t) => (3 * pitch) / t <= 7) ?? 1000;
    for (let t = Math.ceil((-1.5 * pitch) / stepNm) * stepNm; t <= 1.5 * pitch; t += stepNm) ticksNm.push(t);
    const f = frame(svg, { box: [L, 70, W, 220], x: [-1.5 * pitch, 1.5 * pitch], y: [0, 1.3], xticks: ticksNm, yticks: [0, 0.25, 0.5, 0.75, 1, 1.25], xfmt: (t) => num(t, 0), yfmt: (t) => num(t, 2), xlabel: "x (nm)", ylabel: "intensity (clear field = 1)" });
    const prints = con > 0.1;
    const th = (hi + lo) / 2;
    if (prints) {
      // Resist that receives more than the threshold: shade.
      let start = null;
      for (let i = 0; i <= xs.length; i++) {
        const on = i < xs.length && I[i] >= th;
        if (on && start === null) start = i;
        if (!on && start !== null) {
          el("rect", { x: f.sx(xs[start]), y: f.T, width: f.sx(xs[i - 1]) - f.sx(xs[start]), height: f.H, style: "fill:var(--brand);fill-opacity:0.07" }, svg);
          start = null;
        }
      }
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(th), y2: f.sy(th), style: "stroke:var(--vec-out);stroke-width:1.25;stroke-dasharray:5 3" }, svg);
    }
    polyline(svg, xs.map((x, i) => [f.sx(x), f.sy(I[i])]), "stroke:var(--brand);stroke-width:2");
    text(svg, f.L + f.W, f.T - 6, prints ? "prints" : "contrast too low: nothing prints", { "text-anchor": "end", style: prints ? "" : "fill:var(--code-del)" });

    o.lam.textContent = `${num(lam, lam < 20 ? 1 : 0)} nm`;
    o.k1.textContent = num((hp * na) / lam, 3);
    o.rmin.textContent = `${num((0.25 * lam) / na, 1)} nm`;
    o.ord.textContent = passed.length ? passed.map((m) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "0")).join(" ") : "none";
    o.con.textContent = num(con, 3);
    o.dof.textContent = `${num(lam / (na * na), 0)} nm`;
  }
  draw();
}

// ============================================================ Wafer yield

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const poisson = (A, D) => Math.exp(-A * D);
export const murphy = (A, D) => (A * D === 0 ? 1 : ((1 - Math.exp(-A * D)) / (A * D)) ** 2);
export const grossDies = (d, A) => (Math.PI * d * d) / (4 * A) - (Math.PI * d) / Math.sqrt(2 * A);

for (const root of document.querySelectorAll("[data-semi-yield]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let dia = 300, seed = 7;
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { dia = Number(v); draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed += 1; draw(); });
  const EDGE = 3; // mm of edge exclusion

  function draw() {
    const w = s.w.get(), hgt = s.hgt.get(), D0 = s.d0.get(), cost = s.cost.get();
    const R = dia / 2, Ru = R - EDGE;
    const A = (w * hgt) / 100; // cm²
    // Count whole dies inside the usable radius, trying the two usual grid
    // offsets and keeping the better.
    let best = [];
    for (const [ox, oy] of [[0, 0], [w / 2, hgt / 2], [w / 2, 0], [0, hgt / 2]]) {
      const dies = [];
      const nx = Math.ceil(R / w) + 1, ny = Math.ceil(R / hgt) + 1;
      for (let i = -nx; i <= nx; i++) {
        for (let j = -ny; j <= ny; j++) {
          const x = i * w - ox, y = j * hgt - oy;
          const far = Math.max(Math.hypot(x, y), Math.hypot(x + w, y), Math.hypot(x, y + hgt), Math.hypot(x + w, y + hgt));
          if (far <= Ru) dies.push({ x, y, bad: false });
        }
      }
      if (dies.length > best.length) best = dies;
    }
    // Defects: a Poisson count over the whole wafer, placed uniformly.
    const rnd = mulberry32(seed * 7919);
    const mean = D0 * Math.PI * (R / 10) ** 2;
    let count = 0;
    for (let acc = -Math.log(1 - rnd()); acc < mean; acc += -Math.log(1 - rnd())) count++;
    const defects = [];
    for (let i = 0; i < count; i++) {
      const rr = R * Math.sqrt(rnd()), th = 2 * Math.PI * rnd();
      defects.push([rr * Math.cos(th), rr * Math.sin(th)]);
    }
    for (const d of best) {
      d.bad = defects.some(([x, y]) => x >= d.x && x < d.x + w && y >= d.y && y < d.y + hgt);
    }
    const good = best.filter((d) => !d.bad).length;

    svg.replaceChildren();
    const cx = 160, cy = 160, sc = 145 / R;
    el("circle", { cx, cy, r: R * sc, style: "fill:currentColor;fill-opacity:0.04;stroke:currentColor;stroke-opacity:0.5" }, svg);
    el("circle", { cx, cy, r: Ru * sc, style: "fill:none;stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:3 3" }, svg);
    // The notch.
    el("path", { d: `M${cx - 4},${cy + R * sc} L${cx},${cy + R * sc - 5} L${cx + 4},${cy + R * sc}`, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.5" }, svg);
    for (const d of best) {
      el("rect", {
        x: cx + d.x * sc + 0.4, y: cy + d.y * sc + 0.4, width: Math.max(0.5, w * sc - 0.8), height: Math.max(0.5, hgt * sc - 0.8),
        style: d.bad ? "fill:var(--code-del);fill-opacity:0.55" : "fill:var(--brand);fill-opacity:0.22",
      }, svg);
    }
    for (const [x, y] of defects) el("circle", { cx: cx + x * sc, cy: cy + y * sc, r: 1.3, style: "fill:currentColor" }, svg);
    text(svg, 12, 16, `${dia} mm wafer`);

    // Yield against die area.
    const amax = 9; // cm²
    const f = frame(svg, { box: [372, 24, 246, 250], x: [0, amax], y: [0, 1], xticks: [0, 3, 6, 9], yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (t) => String(t * 100), yfmt: (t) => `${t * 100}%`, xlabel: "die area (mm²)" });
    text(svg, 372, 14, "yield");
    const pp = [], mp = [];
    for (let a = 0; a <= amax + 1e-9; a += 0.05) { pp.push([f.sx(a), f.sy(poisson(a, D0))]); mp.push([f.sx(a), f.sy(murphy(a, D0))]); }
    polyline(svg, pp, "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, mp, "stroke:var(--vec-out);stroke-width:2");
    if (A <= amax) {
      el("line", { x1: f.sx(A), x2: f.sx(A), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      if (best.length) el("circle", { cx: f.sx(A), cy: f.sy(good / best.length), r: 4, style: "fill:var(--brand)" }, svg);
    }

    const pct = (v) => `${num(100 * v, 1)} %`;
    const ym = murphy(A, D0);
    o.dies.textContent = String(best.length);
    o.gross.textContent = num(Math.max(0, grossDies(dia, w * hgt)), 0);
    o.good.textContent = best.length ? `${good} (${pct(good / best.length)})` : "—";
    o.poi.textContent = pct(poisson(A, D0));
    o.mur.textContent = pct(ym);
    o.cpd.textContent = best.length && ym > 0 ? `$${num(cost / (best.length * ym), 2)}` : "—";
  }
  draw();
}
