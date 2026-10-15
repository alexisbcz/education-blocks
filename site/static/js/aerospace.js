// Aerospace & Flight: steady flight, the standard atmosphere, the
// airfoil model the wind-tunnel figure also uses, NACA sections,
// pitot-static airspeed, the V–n envelope, turns, Breguet range and rotor
// momentum theory. Every number on screen is computed here.

import "../anatomy/aerospace-tunnel.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const G0 = 9.80665;
const RHO0 = 1.225;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const fmtInt = (v) => Math.round(v).toLocaleString("en-US");

// The ISA troposphere (to 11 km): exact for the standard's lapse rate.
export function isa(h) {
  const T = 288.15 - 0.0065 * h;
  const p = 101325 * (T / 288.15) ** 5.255877;
  return { T, p, rho: p / (287.053 * T) };
}

// The airfoil model shared with the tunnel figure: thin-airfoil lift up to
// stall near 15°, a smooth post-stall fall, drag polar CD0 + CL²/(πeAR).
export function airfoil({ ar = 3, e = 0.85, cd0 = 0.02, finite = false, stall = 15 } = {}) {
  const slope = finite ? (2 * Math.PI) / (1 + 2 / (e * ar)) : 2 * Math.PI; // per radian
  const cl = (d) => {
    if (Math.abs(d) <= stall) return slope * rad(d);
    const top = slope * rad(stall) * Math.sign(d);
    return top * (0.62 + 0.38 * Math.exp(-(Math.abs(d) - stall) / 2.5));
  };
  const cd = (d) => {
    const c = cl(d);
    const sep = Math.abs(d) > stall ? 0.035 * (Math.abs(d) - stall) : 0;
    return cd0 + (c * c) / (Math.PI * e * ar) + sep;
  };
  return { cl, cd, slope };
}

// A straight arrow in pixel space.
function arrowPx(parent, x1, y1, x2, y2, color, width = 2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len, hd = Math.min(9, len * 0.4);
  el("line", { x1, y1, x2: x2 - ux * hd * 0.8, y2: y2 - uy * hd * 0.8, style: `stroke:${color};stroke-width:${width}px;stroke-linecap:round` }, parent);
  const bx = x2 - ux * hd, by = y2 - uy * hd;
  el("path", { d: `M${x2} ${y2}L${bx - uy * hd * 0.45} ${by + ux * hd * 0.45}L${bx + uy * hd * 0.45} ${by - ux * hd * 0.45}Z`, style: `fill:${color}` }, parent);
}

// ============================================================ four forces

for (const root of document.querySelectorAll("[data-aero-forces]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const W = s.mass.get() * G0, LD = s.ld.get(), D = W / LD, T = (s.thrust.get() / 100) * D;
    const sinG = Math.max(-1, Math.min(1, (T - D) / W));
    const gamma = Math.asin(sinG);
    svg.replaceChildren();
    const cx = 280, cy = 170;
    // The flight path through the aircraft, at the path angle.
    const dx = Math.cos(gamma), dy = -Math.sin(gamma);
    el("line", { x1: cx - dx * 250, y1: cy - dy * 250, x2: cx + dx * 250, y2: cy + dy * 250, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:4 5" }, svg);
    el("line", { x1: 30, y1: cy, x2: 530, y2: cy, style: "stroke:currentColor;stroke-opacity:0.1" }, svg);
    text(svg, 34, cy - 6, "horizon");
    // The aircraft, pitched along the path.
    const body = el("g", { transform: `translate(${cx} ${cy}) rotate(${-deg(gamma)})` }, svg);
    el("path", { d: "M-70 0C-60 -9 40 -10 62 -3C70 0 70 3 62 5C40 10 -60 9 -70 0Z", style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.4" }, body);
    el("path", { d: "M-62 -2L-74 -26L-60 -26L-44 -3Z", style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.2" }, body);
    el("path", { d: "M-16 1L22 1", style: "stroke:var(--foreground);stroke-width:2.4;stroke-linecap:round" }, body);
    el("circle", { cx: 66, cy: 1, r: 2, style: "fill:var(--foreground)" }, body);
    // Forces: lift ⟂ path, weight down, thrust and drag along the path.
    const k = 100 / W; // px per newton for lift and weight
    const kT = 260 / Math.max(W, 1); // thrust and drag on a larger scale so they read
    const L = W * Math.cos(gamma);
    arrowPx(svg, cx, cy, cx - dy * L * k, cy + dx * -L * k, "var(--code-add)");
    arrowPx(svg, cx, cy, cx, cy + W * k, "var(--foreground)");
    arrowPx(svg, cx + dx * 70, cy + dy * 70, cx + dx * (70 + T * kT), cy + dy * (70 + T * kT), "var(--vec-u)");
    arrowPx(svg, cx - dx * 70, cy - dy * 70, cx - dx * (70 + D * kT), cy - dy * (70 + D * kT), "var(--code-del)");
    text(svg, cx - dy * L * k + 6, cy - dx * L * k, "L", { class: "fill-foreground font-mono text-[11px]" });
    text(svg, cx + 6, cy + W * k, "W", { class: "fill-foreground font-mono text-[11px]" });
    text(svg, cx + dx * (74 + T * kT), cy + dy * (74 + T * kT) - 4, "T", { class: "fill-foreground font-mono text-[11px]" });
    text(svg, cx - dx * (78 + D * kT), cy - dy * (78 + D * kT) - 4, "D", { class: "fill-foreground font-mono text-[11px]" });
    text(svg, 530, 330, "thrust and drag drawn at 2.6× the lift scale", { "text-anchor": "end" });
    o.w.textContent = `${fmtInt(W)} N`;
    o.d.textContent = `${fmtInt(D)} N`;
    o.gamma.textContent = `${num(deg(gamma), 1)}° ${gamma > 0.0005 ? "climb" : gamma < -0.0005 ? "descent" : "level"}`;
    o.range.textContent = `${num((s.alt.get() * LD) / 1000, 1)} km`;
  }
  draw();
}

// ============================================================ ISA and lift

for (const root of document.querySelectorAll("[data-aero-isa]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const T0 = 288.15, P0 = 101325;

  function draw() {
    const h = s.alt.get();
    const a = isa(h);
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 16, 470, 280], x: [0, 1.05], y: [0, 11000], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 2000, 4000, 6000, 8000, 10000], xfmt: (v) => v.toFixed(2), yfmt: (v) => `${v / 1000} km`, xlabel: "fraction of sea-level value", ylabel: "altitude" });
    const series = [["T/T₀", (x) => isa(x).T / T0, "var(--code-del)"], ["p/p₀", (x) => isa(x).p / P0, "var(--vec-u)"], ["ρ/ρ₀", (x) => isa(x).rho / RHO0, "var(--brand)"]];
    series.forEach(([name, fn, color], i) => {
      const pts = [];
      for (let z = 0; z <= 11000; z += 250) pts.push([f.sx(fn(z)), f.sy(z)]);
      polyline(svg, pts, `stroke:${color};stroke-width:1.75`);
      const zl = [10200, 7600, 9000][i];
      text(svg, f.sx(fn(zl)) + 6, f.sy(zl), name, { style: `fill:${color}` });
      el("circle", { cx: f.sx(fn(h)), cy: f.sy(h), r: 3.5, style: `fill:var(--background);stroke:${color};stroke-width:1.75` }, svg);
    });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(h), y2: f.sy(h), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4" }, svg);
    const v = s.v.get(), S = s.area.get(), CL = s.cl.get();
    const L = 0.5 * a.rho * v * v * S * CL;
    o.t.textContent = `${num(a.T, 2)} K (${num(a.T - 273.15, 1)} °C)`;
    o.p.textContent = `${fmtInt(a.p)} Pa`;
    o.rho.textContent = `${a.rho.toFixed(4)} kg/m³`;
    o.sigma.textContent = num(a.rho / RHO0, 3);
    o.lift.textContent = L >= 1e4 ? `${num(L / 1000, 2)} kN (${fmtInt(L / G0)} kg)` : `${num(L, 1)} N (${num(L / G0, 1)} kg)`;
  }
  draw();
}

// ============================================================ airfoil

for (const root of document.querySelectorAll("[data-aero-airfoil]")) {
  const svgCl = root.querySelector("[data-cl]");
  const svgP = root.querySelector("[data-polar]");
  const o = outs(root);
  let finite = false;
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { if (k === "finite") { finite = on; draw(); } });

  function draw() {
    const m = airfoil({ ar: s.ar.get(), e: s.e.get(), cd0: s.cd0.get(), finite });
    const a = s.alpha.get();
    const grid = [];
    for (let d = -6; d <= 24; d += 0.25) grid.push(d);
    let best = { ld: -Infinity, d: 0 };
    for (const d of grid) { const ld = m.cl(d) / m.cd(d); if (ld > best.ld) best = { ld, d }; }

    svgCl.replaceChildren();
    const f = frame(svgCl, { box: [38, 14, 250, 210], x: [-6, 24], y: [-0.8, 2.6], xticks: [-5, 0, 5, 10, 15, 20], yticks: [0, 1, 2], xlabel: "α (°)", ylabel: "CL", xfmt: (v) => String(v).replace("-", "−") });
    hline(svgCl, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    el("rect", { x: f.sx(15), y: f.T, width: f.sx(24) - f.sx(15), height: f.H, style: "fill:var(--code-del);fill-opacity:0.06" }, svgCl);
    text(svgCl, f.sx(19.5), f.T + 12, "stalled", { "text-anchor": "middle" });
    polyline(svgCl, grid.map((d) => [f.sx(d), f.sy(m.cl(d))]), "stroke:var(--foreground);stroke-width:1.75");
    el("circle", { cx: f.sx(a), cy: f.sy(m.cl(a)), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svgCl);

    svgP.replaceChildren();
    const cdMax = Math.max(0.2, ...grid.filter((d) => d <= 18).map((d) => m.cd(d)));
    const g = frame(svgP, { box: [38, 14, 250, 210], x: [0, cdMax], y: [-0.8, 2.6], xticks: [0, cdMax / 2, cdMax].map((v) => +v.toFixed(2)), yticks: [0, 1, 2], xlabel: "CD", ylabel: "CL" });
    polyline(svgP, grid.filter((d) => d <= 18).map((d) => [g.sx(m.cd(d)), g.sy(m.cl(d))]), "stroke:var(--foreground);stroke-width:1.75");
    // The tangent from the origin touches the polar at the best L/D.
    const bx = m.cd(best.d), by = m.cl(best.d);
    const ext = Math.min(cdMax, 2.6 / (by / bx));
    el("line", { x1: g.sx(0), y1: g.sy(0), x2: g.sx(ext), y2: g.sy((by / bx) * ext), style: "stroke:var(--vec-out);stroke-width:1.25;stroke-dasharray:4 4" }, svgP);
    el("circle", { cx: g.sx(bx), cy: g.sy(by), r: 3.5, style: "fill:var(--background);stroke:var(--vec-out);stroke-width:1.75" }, svgP);
    el("circle", { cx: g.sx(m.cd(a)), cy: g.sy(m.cl(a)), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svgP);

    o.cl.textContent = num(m.cl(a), 3);
    o.cd.textContent = num(m.cd(a), 4);
    o.ld.textContent = num(m.cl(a) / m.cd(a), 1);
    o.ldmax.textContent = `${num(best.ld, 1)} at ${num(best.d, 2)}°`;
  }
  draw();
}

// ============================================================ NACA four-digit

function naca(code, closed) {
  const m = +code[0] / 100, p = +code[1] / 10, t = +code.slice(2) / 100;
  const a4 = closed ? -0.1036 : -0.1015;
  const yt = (x) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 + a4 * x ** 4);
  const yc = (x) => (m === 0 || p === 0 ? 0 : x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x));
  const dyc = (x) => (m === 0 || p === 0 ? 0 : x < p ? ((2 * m) / (p * p)) * (p - x) : ((2 * m) / ((1 - p) ** 2)) * (p - x));
  const upper = [], lower = [], camber = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const x = (1 - Math.cos((Math.PI * i) / N)) / 2; // cosine spacing: dense at both edges
    const th = Math.atan(dyc(x)), y = yt(x), c = yc(x);
    upper.push([x - y * Math.sin(th), c + y * Math.cos(th)]);
    lower.push([x + y * Math.sin(th), c - y * Math.cos(th)]);
    camber.push([x, c]);
  }
  let tmax = 0, tx = 0;
  for (let x = 0; x <= 1; x += 0.0005) if (2 * yt(x) > tmax) { tmax = 2 * yt(x); tx = x; }
  return { m, p, t, upper, lower, camber, tmax, tx };
}

for (const root of document.querySelectorAll("[data-aero-naca]")) {
  const svg = root.querySelector("[data-plot]");
  const input = root.querySelector("[data-code]");
  const o = outs(root);
  let closed = false;
  onToggle(root, (k, on) => { if (k === "closed") { closed = on; draw(); } });
  input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 4); draw(); });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.preset; draw(); }));

  function draw() {
    const code = input.value;
    svg.replaceChildren();
    if (!/^\d{4}$/.test(code) || +code.slice(2) === 0 || (code[0] !== "0" && code[1] === "0")) {
      text(svg, 280, 130, "Four digits, e.g. 2412 (thickness above 0; a cambered section needs a camber position)", { "text-anchor": "middle" });
      for (const k of ["m", "p", "t", "tx"]) o[k].textContent = "—";
      return;
    }
    const n = naca(code, closed);
    // Equal scales on both axes: chord 1 → 480 px.
    const L = 40, W = 480, cy = 150;
    const sx = (x) => L + x * W, sy = (y) => cy - y * W;
    el("line", { x1: sx(0), y1: cy, x2: sx(1), y2: cy, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4" }, svg);
    const outline = [...n.upper, ...n.lower.slice().reverse()].map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");
    el("polygon", { points: outline, style: "fill:color-mix(in oklab,var(--brand) 10%,var(--background));stroke:var(--foreground);stroke-width:1.5;stroke-linejoin:round" }, svg);
    polyline(svg, n.camber.map(([x, y]) => [sx(x), sy(y)]), "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:5 4");
    // Maximum thickness, drawn as a bar at its station.
    const ytx = n.tmax / 2, ycx = n.camber.reduce((b, c) => (Math.abs(c[0] - n.tx) < Math.abs(b[0] - n.tx) ? c : b))[1];
    el("line", { x1: sx(n.tx), x2: sx(n.tx), y1: sy(ycx + ytx), y2: sy(ycx - ytx), style: "stroke:var(--vec-u);stroke-width:1.5" }, svg);
    text(svg, sx(n.tx) + 5, sy(ycx - ytx) + 14, `t = ${num(n.tmax * 100, 2)}%`, { style: "fill:var(--vec-u)" });
    if (n.m > 0) {
      el("circle", { cx: sx(n.p), cy: sy(n.m), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.75" }, svg);
      text(svg, sx(n.p) + 6, sy(n.m) - 8, "max camber", { style: "fill:var(--brand)" });
    }
    text(svg, sx(0), cy + 92, "leading edge");
    text(svg, sx(1), cy + 92, "trailing edge", { "text-anchor": "end" });
    text(svg, 280, cy + 92, `NACA ${code} · chord to scale`, { "text-anchor": "middle" });
    o.m.textContent = `${num(n.m * 100, 0)}% of chord`;
    o.p.textContent = n.m > 0 ? `${num(n.p * 100, 0)}% of chord` : "— (symmetric)";
    o.t.textContent = `${num(n.t * 100, 0)}%`;
    o.tx.textContent = `${num(n.tx * 100, 1)}% of chord`;
  }
  draw();
}

// ============================================================ pitot-static

for (const root of document.querySelectorAll("[data-aero-pitot]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const KT = 0.514444;
  const s = scrubAll(root, draw);

  function draw() {
    const vi = s.ias.get() * KT, h = s.alt.get();
    const a = isa(h);
    const q = 0.5 * RHO0 * vi * vi;
    const tas = vi * Math.sqrt(RHO0 / a.rho);
    svg.replaceChildren();
    // Left: the pitot-static probe. The nose hole feels total pressure,
    // the side ports static; two lines lead to the two sides of a gauge.
    const g = el("g", {}, svg);
    for (let i = 0; i < 3; i++) arrowPx(g, 6, 56 + i * 16, 30, 56 + i * 16, "var(--vec-u)", 1.25);
    el("path", { d: "M44 64 Q36 72 44 80 L200 80 L200 64 Z", style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.4;stroke-linejoin:round" }, g);
    el("path", { d: "M186 80 L186 112 L200 112 L200 80", style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.4" }, g);
    el("circle", { cx: 40, cy: 72, r: 2.6, style: "fill:var(--brand)" }, g);
    for (const x of [110, 122]) el("circle", { cx: x, cy: 64, r: 1.8, style: "fill:var(--vec-u)" }, g);
    text(g, 40, 54, "total", { "text-anchor": "middle", style: "fill:var(--brand)" });
    text(g, 116, 54, "static", { "text-anchor": "middle", style: "fill:var(--vec-u)" });
    // Lines to the U-tube gauge.
    el("path", { d: "M40 82 V150 H70 V170", style: "fill:none;stroke:var(--brand);stroke-width:1.25" }, g);
    el("path", { d: "M116 66 V150 H110 V170", style: "fill:none;stroke:var(--vec-u);stroke-width:1.25" }, g);
    const scale = 90 / 7000, qh = Math.min(90, q * scale);
    // U-tube: liquid pushed down on the total side by q.
    el("path", { d: "M64 170 V280 Q64 292 76 292 H104 Q116 292 116 280 V170", style: "fill:none;stroke:var(--foreground);stroke-width:1.2" }, g);
    el("rect", { x: 66, y: 240 + qh / 2, width: 10, height: 50 - qh / 2, style: "fill:var(--vec-u);fill-opacity:0.35" }, g);
    el("rect", { x: 104, y: 240 - qh / 2, width: 10, height: 50 + qh / 2, style: "fill:var(--vec-u);fill-opacity:0.35" }, g);
    el("path", { d: `M120 ${240 - qh / 2} H132 M120 ${240 + qh / 2} H132 M126 ${240 - qh / 2} V${240 + qh / 2}`, style: "stroke:var(--foreground);stroke-width:1" }, g);
    text(g, 136, 244, `Δh ∝ q = ${fmtInt(q)} Pa`, {});
    // Right: TAS against altitude for this IAS.
    const f = frame(svg, { box: [280, 16, 260, 250], x: [0, 11000], y: [0, Math.max(60, Math.ceil((vi * Math.sqrt(RHO0 / isa(11000).rho)) / 20) * 20)], xticks: [0, 5000, 10000], yticks: [0, vi].map((v) => Math.round(v)), xfmt: (v) => `${v / 1000} km`, yfmt: (v) => `${v}`, xlabel: "altitude" });
    text(svg, 254, 12, "airspeed (m/s)");
    const pts = [];
    for (let z = 0; z <= 11000; z += 250) pts.push([f.sx(z), f.sy(vi * Math.sqrt(RHO0 / isa(z).rho))]);
    hline(svg, f, vi, "stroke:var(--vec-u);stroke-dasharray:4 4", "IAS");
    polyline(svg, pts, "stroke:var(--brand);stroke-width:1.75");
    text(svg, f.sx(10800), f.sy(vi * Math.sqrt(RHO0 / isa(10800).rho)) - 6, "TAS", { "text-anchor": "end", style: "fill:var(--brand)" });
    el("circle", { cx: f.sx(h), cy: f.sy(tas), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    o.q.textContent = `${fmtInt(q)} Pa`;
    o.rho.textContent = `${a.rho.toFixed(4)} kg/m³`;
    o.tas.textContent = `${num(tas, 1)} m/s (${num(tas / KT, 0)} kt)`;
    o.gain.textContent = `+${num(((tas - vi) / vi) * 100, 1)}%`;
  }
  draw();
}

// ============================================================ V–n diagram

for (const root of document.querySelectorAll("[data-aero-vn]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("aria-label", "Load factor against airspeed. Arrow keys move the point.");
  let f = null;

  function draw() {
    const ws = s.ws.get(), clmax = s.clmax.get(), nmax = s.nmax.get(), vd = s.vd.get();
    const nmin = -0.4 * nmax;
    const nStall = (v) => (0.5 * RHO0 * v * v * clmax) / ws; // positive stall boundary
    const nStallNeg = (v) => -(0.5 * RHO0 * v * v * 0.6 * clmax) / ws; // negative, |CLmin| ≈ 0.6 CLmax
    const vs = Math.sqrt((2 * ws) / (RHO0 * clmax));
    const va = vs * Math.sqrt(nmax);
    const vaNeg = Math.sqrt(nmin / (-(0.5 * RHO0 * 0.6 * clmax) / ws));
    const vmax = vd * 1.12;
    svg.replaceChildren();
    f = frame(svg, { box: [44, 14, 494, 286], x: [0, vmax], y: [Math.floor(nmin - 1), Math.ceil(nmax + 1)], xticks: [0, Math.round(vs), Math.round(va), Math.round(vd)], yticks: [Math.round(nmin), 0, 1, Math.round(nmax)], xlabel: "airspeed (m/s)", ylabel: "n (g)", yfmt: (v) => String(v).replace("-", "−") });
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    hline(svg, f, 1, "stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:2 4", "1 g");
    // The envelope, as one polygon.
    const pts = [];
    for (let v = 0; v <= va; v += va / 40) pts.push([v, nStall(v)]);
    pts.push([va, nmax], [vd, nmax], [vd, 0], [vd, nmin]);
    for (let v = Math.min(vaNeg, vd); v >= 0; v -= vaNeg / 40) pts.push([v, Math.max(nmin, nStallNeg(v))]);
    el("polygon", { points: pts.map(([v, n]) => `${f.sx(v).toFixed(1)},${f.sy(n).toFixed(1)}`).join(" "), style: "fill:var(--code-add);fill-opacity:0.07;stroke:var(--foreground);stroke-width:1.5;stroke-linejoin:round" }, svg);
    text(svg, f.sx(vs * 0.55), f.sy(nStall(vs * 1.2)) - 6, "stall", { "text-anchor": "middle" });
    text(svg, f.sx((va + vd) / 2), f.sy(nmax) - 6, `limit ${num(nmax, 1)} g`, { "text-anchor": "middle" });
    el("line", { x1: f.sx(va), x2: f.sx(va), y1: f.sy(nmax), y2: f.sy(0), style: "stroke:var(--vec-out);stroke-dasharray:3 4" }, svg);
    text(svg, f.sx(va) + 4, f.sy(0) - 6, "VA", { style: "fill:var(--vec-out)" });
    // The point.
    const v = s.v.get(), n = s.n.get();
    const state = v > vd ? "beyond VD" : n > nStall(v) + 1e-9 || n < nStallNeg(v) - 1e-9 ? "stalls first" : n > nmax || n < nmin ? "structural overload" : "inside the envelope";
    const color = state === "inside the envelope" ? "var(--brand)" : "var(--code-del)";
    el("circle", { cx: f.sx(v), cy: f.sy(n), r: 5, style: `fill:${color};stroke:var(--background);stroke-width:2` }, svg);
    o.vs.textContent = `${num(vs, 1)} m/s`;
    o.va.textContent = `${num(va, 1)} m/s`;
    o.state.textContent = state;
    o.state.className = state === "inside the envelope" ? "tabular-nums text-add" : "tabular-nums text-del";
  }

  const setFromPointer = (e) => {
    if (!f) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const vmax = s.vd.get() * 1.12;
    const v = ((p.x - f.L) / f.W) * vmax;
    const [n0, n1] = [Math.floor(-0.4 * s.nmax.get() - 1), Math.ceil(s.nmax.get() + 1)];
    const n = n0 + ((f.T + f.H - p.y) / f.H) * (n1 - n0);
    s.v.set(Math.max(0, v), false);
    s.n.set(n, false);
    draw();
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); setFromPointer(e); });
  svg.addEventListener("pointermove", (e) => dragging && setFromPointer(e));
  svg.addEventListener("pointerup", () => (dragging = false));
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (!d) return;
    e.preventDefault();
    s.v.set(s.v.get() + d[0] * (e.shiftKey ? 10 : 1), false);
    s.n.set(s.n.get() + d[1] * (e.shiftKey ? 10 : 1), false);
    draw();
  });
  draw();
}

// ============================================================ turning flight

for (const root of document.querySelectorAll("[data-aero-turn]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const phi = rad(s.bank.get()), v = s.v.get();
    const n = 1 / Math.cos(phi);
    const r = Math.tan(phi) > 1e-9 ? (v * v) / (G0 * Math.tan(phi)) : Infinity;
    const w = Math.tan(phi) > 1e-9 ? (G0 * Math.tan(phi)) / v : 0;
    svg.replaceChildren();
    // Left: the aircraft from behind, banked, with lift and its components.
    const cx = 130, cy = 170;
    const g = el("g", { transform: `translate(${cx} ${cy}) rotate(${deg(phi)})` }, svg);
    el("path", { d: "M-90 0L90 0", style: "stroke:var(--foreground);stroke-width:3;stroke-linecap:round" }, g);
    el("circle", { cx: 0, cy: 2, r: 9, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, g);
    el("path", { d: "M0 -8L0 -30", style: "stroke:var(--foreground);stroke-width:2" }, g);
    const Lpx = 70 * Math.min(n, 4);
    arrowPx(svg, cx, cy, cx + Math.sin(phi) * Lpx, cy - Math.cos(phi) * Lpx, "var(--code-add)");
    arrowPx(svg, cx, cy, cx, cy - 70, "var(--foreground)", 1.25);
    arrowPx(svg, cx, cy, cx + Math.sin(phi) * Lpx, cy, "var(--brand)", 1.25);
    text(svg, cx + Math.sin(phi) * Lpx + 6, cy - Math.cos(phi) * Lpx, `L = ${num(n, 2)} W`, { class: "fill-foreground font-mono text-[11px]" });
    text(svg, cx - 6, cy - 74, "L cos φ = W", { "text-anchor": "end" });
    text(svg, cx + Math.max(40, Math.sin(phi) * Lpx), cy + 48, "L sin φ turns the aircraft", { "text-anchor": "middle", style: "fill:var(--brand)" });
    // Right: the turn from above, with a scale bar.
    const ox = 400, oy = 160, Rmax = 120;
    if (Number.isFinite(r)) {
      const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find((b) => b >= r / 2) ?? 50000;
      const kpx = Rmax / Math.max(r, nice);
      el("circle", { cx: ox, cy: oy, r: r * kpx, style: "fill:none;stroke:var(--brand);stroke-width:1.5" }, svg);
      el("circle", { cx: ox, cy: oy, r: 2.5, style: "fill:var(--foreground)" }, svg);
      el("line", { x1: ox, y1: oy, x2: ox + r * kpx, y2: oy, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 4" }, svg);
      text(svg, ox + (r * kpx) / 2, oy - 6, `r = ${r >= 1000 ? num(r / 1000, 2) + " km" : fmtInt(r) + " m"}`, { "text-anchor": "middle" });
      el("line", { x1: ox - 60, x2: ox - 60 + nice * kpx, y1: 300, y2: 300, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
      text(svg, ox - 60, 292, nice >= 1000 ? `${nice / 1000} km` : `${nice} m`);
    } else {
      el("line", { x1: ox - 120, x2: ox + 120, y1: oy, y2: oy, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
      text(svg, ox, oy - 8, "wings level: straight flight", { "text-anchor": "middle" });
    }
    o.n.textContent = `${num(n, 2)} g`;
    o.r.textContent = Number.isFinite(r) ? (r >= 1000 ? `${num(r / 1000, 2)} km` : `${fmtInt(r)} m`) : "∞";
    o.rate.textContent = `${num(deg(w), 2)} °/s${Math.abs(deg(w) - 3) < 0.15 ? " (standard rate)" : ""}`;
    o.time.textContent = w > 0 ? `${num((2 * Math.PI) / w, 0)} s` : "—";
    o.vsn.textContent = `${num(s.vs.get() * Math.sqrt(n), 1)} m/s`;
  }
  draw();
}

// ============================================================ Breguet range

for (const root of document.querySelectorAll("[data-aero-breguet]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "jet";
  const s = scrubAll(root, draw);
  const fieldOf = (name) => root.querySelector(`[data-scrub="${name}"]`)?.closest("label");
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });
  const PRESETS = {
    airliner: { kind: "jet", v: 230, ld: 17, tsfc: 15.6, ratio: 1.4 },
    light: { kind: "prop", v: 60, ld: 10, bsfc: 270, eta: 0.8, ratio: 1.15 },
  };
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.preset];
    for (const k of Object.keys(p)) if (k !== "kind") s[k].set(p[k], false);
    kind = p.kind;
    root.querySelectorAll("[data-seg]").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.seg === kind)));
    draw();
  }));

  const rangeOf = (ratio) => {
    const ld = s.ld.get();
    if (kind === "jet") return (s.v.get() / (G0 * s.tsfc.get() * 1e-6)) * ld * Math.log(ratio);
    return (s.eta.get() / (G0 * (s.bsfc.get() / 3.6e9))) * ld * Math.log(ratio);
  };

  function draw() {
    // Show only the inputs this engine type uses.
    for (const name of ["tsfc"]) fieldOf(name)?.toggleAttribute("hidden", kind !== "jet");
    for (const name of ["bsfc", "eta"]) fieldOf(name)?.toggleAttribute("hidden", kind !== "prop");
    fieldOf("v")?.toggleAttribute("hidden", kind !== "jet");
    const ratio = s.ratio.get();
    const R = rangeOf(ratio);
    const top = Math.max(1000, Math.ceil(rangeOf(3) / 1000 / 2000) * 2000);
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 16, 476, 250], x: [1, 3], y: [0, top], xticks: [1, 1.5, 2, 2.5, 3], yticks: [0, top / 2, top], xlabel: "W₀ / W₁", ylabel: "range (km)", yfmt: (v) => fmtInt(v) });
    const pts = [];
    for (let x = 1; x <= 3.0001; x += 0.02) pts.push([f.sx(x), f.sy(rangeOf(x) / 1000)]);
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.75");
    el("line", { x1: f.sx(ratio), x2: f.sx(ratio), y1: f.sy(0), y2: f.sy(R / 1000), style: "stroke:var(--brand);stroke-dasharray:3 4" }, svg);
    el("circle", { cx: f.sx(ratio), cy: f.sy(R / 1000), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, f.sx(ratio) + 8, f.sy(R / 1000) - 8, `${fmtInt(R / 1000)} km`, { class: "fill-foreground font-mono text-[11px]" });
    o.range.textContent = `${fmtInt(R / 1000)} km`;
    o.fuel.textContent = `${num((1 - 1 / ratio) * 100, 1)}% of take-off weight`;
  }
  draw();
}

// ============================================================ rotor in hover

for (const root of document.querySelectorAll("[data-aero-rotor]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const PRESETS = { heli: { mass: 1200, radius: 5, fm: 0.7, alt: 0 }, drone: { mass: 0.3, radius: 0.12, fm: 0.6, alt: 0 } };
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.preset];
    for (const k of Object.keys(p)) s[k].set(p[k], false);
    draw();
  }));
  const fmtW = (w) => (w >= 1e6 ? `${num(w / 1e6, 2)} MW` : w >= 1000 ? `${num(w / 1000, 1)} kW` : `${num(w, 1)} W`);

  function draw() {
    const T = s.mass.get() * G0, R = s.radius.get(), FM = s.fm.get(), rho = isa(s.alt.get()).rho;
    const power = (r) => {
      const A = Math.PI * r * r;
      return (T * Math.sqrt(T / (2 * rho * A))) / FM;
    };
    const A = Math.PI * R * R, vi = Math.sqrt(T / (2 * rho * A)), Pi = T * vi;
    svg.replaceChildren();
    const r0 = R / 3, r1 = R * 3;
    const top = power(r0) * 1.05;
    const unit = top >= 2e6 ? 1e6 : top >= 2000 ? 1000 : 1;
    const uname = unit === 1e6 ? "MW" : unit === 1000 ? "kW" : "W";
    const f = frame(svg, { box: [56, 16, 476, 260], x: [r0, r1], y: [0, top / unit], xticks: [r0, R, 2 * R, r1].map((v) => +v.toPrecision(3)), yticks: [0, +(top / unit / 2).toPrecision(2), +(top / unit).toPrecision(2)], xlabel: "rotor radius (m)", ylabel: `shaft power (${uname})` });
    const pts = [];
    for (let i = 0; i <= 80; i++) { const r = r0 + ((r1 - r0) * i) / 80; pts.push([f.sx(r), f.sy(power(r) / unit)]); }
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.75");
    el("circle", { cx: f.sx(R), cy: f.sy(power(R) / unit), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, f.sx(R) + 8, f.sy(power(R) / unit) - 8, `P ∝ 1/r: double the radius, half the power`, { class: "fill-muted-foreground font-mono text-[10px]" });
    o.dl.textContent = `${num(T / A, 1)} N/m² (${num(T / A / G0, 1)} kg/m²)`;
    o.vi.textContent = `${num(vi, 2)} m/s`;
    o.pi.textContent = fmtW(Pi);
    o.p.textContent = fmtW(Pi / FM);
  }
  draw();
}
