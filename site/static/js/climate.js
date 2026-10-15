// Climate and meteorology blocks. Constants: σ = 5.670374419e-8
// W·m⁻²·K⁻⁴, Ω = 7.2921e-5 rad/s, 1 ppm CO₂ = 2.124 GtC.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const SIGMA = 5.670374419e-8;
const OMEGA = 7.2921e-5;
const GTC_PER_PPM = 2.124;
const RAD = Math.PI / 180;

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const minus = (s) => String(s).replace("-", "−");
const signed = (v, d = 1) => (v >= 0 ? "+" : "−") + num(Math.abs(v), d);

// A flow arrow from a to b with a width proportional to its flux.
function flow(svg, [x1, y1], [x2, y2], width, color, label, side = 1) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const w = Math.max(1.5, width), head = Math.max(8, w * 1.4);
  const bx = x2 - ux * head, by = y2 - uy * head;
  el("line", { x1, y1, x2: bx, y2: by, style: `stroke:${color};stroke-width:${w};stroke-opacity:0.75` }, svg);
  el("path", { d: `M${x2} ${y2}L${bx - uy * head * 0.7} ${by + ux * head * 0.7}L${bx + uy * head * 0.7} ${by - ux * head * 0.7}Z`, style: `fill:${color};fill-opacity:0.85` }, svg);
  if (label) text(svg, (x1 + x2) / 2 + side * (w / 2 + 6), (y1 + y2) / 2 + 3, label, { "text-anchor": side > 0 ? "start" : "end", class: "fill-foreground font-mono text-[10px]" });
}

// ============================================================ Energy balance

for (const root of document.querySelectorAll("[data-climate-energy]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const S0 = s.s0.get(), a = s.albedo.get(), eps = s.eps.get();
    const absorbed = (S0 * (1 - a)) / 4; // W/m², averaged over the sphere
    const Te = (absorbed / SIGMA) ** 0.25;
    const Ts = Te * (2 / (2 - eps)) ** 0.25;
    const Ta = Ts / 2 ** 0.25; // the layer's own temperature (when ε > 0)
    const up = SIGMA * Ts ** 4, layer = eps * SIGMA * Ta ** 4;

    svg.replaceChildren();
    const W = 640;
    // Bands: space, atmosphere, surface.
    el("rect", { x: 0, y: 120, width: W, height: 90, style: "fill:var(--vec-u);fill-opacity:0.08" }, svg);
    el("rect", { x: 0, y: 290, width: W, height: 40, style: "fill:var(--ion-cl);fill-opacity:0.18" }, svg);
    text(svg, 12, 20, "SPACE", { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, 12, 140, `ATMOSPHERE  ${num(Ta, 0)} K`, { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, 12, 312, `SURFACE  ${num(Ts, 0)} K`, { class: "fill-foreground font-mono text-[10px]" });
    const k = 0.06; // pixels of arrow width per W/m²
    // Sunlight in, reflected out.
    flow(svg, [200, 10], [200, 288], (S0 / 4) * k * 0.6, "var(--vec-out)", `${num(S0 / 4, 0)} in`, 1);
    flow(svg, [262, 288], [262, 10], ((S0 * a) / 4) * k * 0.6, "var(--vec-out)", `${num((S0 * a) / 4, 0)} reflected`, 1);
    // Surface infrared: part absorbed by the layer, the rest escapes.
    flow(svg, [400, 288], [400, 212], up * k * 0.5, "var(--ion-na)", `${num(up, 0)} surface IR`, -1);
    flow(svg, [400, 118], [400, 10], (1 - eps) * up * k * 0.5, "var(--ion-na)", `${num((1 - eps) * up, 0)} escapes`, 1);
    // The layer radiates both ways.
    flow(svg, [520, 118], [520, 10], layer * k * 0.5, "var(--ion-k)", `${num(layer, 0)} up`, 1);
    flow(svg, [580, 212], [580, 288], layer * k * 0.5, "var(--ion-k)", `${num(layer, 0)} back down`, -1);
    text(svg, 12, 36, `out at the top: ${num((1 - eps) * up + layer + (S0 * a) / 4, 0)} W/m²`, { class: "fill-muted-foreground font-mono text-[10px]" });

    o.te.textContent = `${num(Te, 1)} K (${minus(num(Te - 273.15, 1))} °C)`;
    o.ts.textContent = `${num(Ts, 1)} K (${minus(num(Ts - 273.15, 1))} °C)`;
    o.ta.textContent = eps > 0 ? `${num(Ta, 1)} K` : "—";
    o.gh.textContent = `${signed(Ts - Te)} K`;
  }
  draw();
}

// ============================================================ CO₂ forcing

for (const root of document.querySelectorAll("[data-climate-forcing]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-co2]").forEach((b) => b.addEventListener("click", () => s.co2.set(Number(b.dataset.co2))));
  const F2X = 5.35 * Math.log(2);
  const dT = (C, ecs) => (ecs * 5.35 * Math.log(C / 280)) / F2X;

  function draw() {
    const C = s.co2.get(), ecs = s.ecs.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [48, 14, 560, 250], x: [180, 1120], y: [-3, 12], xticks: [280, 420, 560, 840, 1120], yticks: [0, 3, 6, 9, 12], xlabel: "CO₂ (ppm)", ylabel: "ΔT (°C)" });
    const xs = Array.from({ length: 200 }, (_, i) => 180 + (i * 940) / 199);
    // AR6 very likely (2–5) and likely (2.5–4) bands.
    for (const [lo, hi, op] of [[2, 5, 0.08], [2.5, 4, 0.16]]) {
      const top = xs.map((c) => [f.sx(c), f.sy(Math.max(-3, Math.min(12, dT(c, c >= 280 ? hi : lo))))]);
      const bot = xs.map((c) => [f.sx(c), f.sy(Math.max(-3, Math.min(12, dT(c, c >= 280 ? lo : hi))))]).reverse();
      el("path", { d: "M" + [...top, ...bot].map((p) => p.join(",")).join("L") + "Z", style: `fill:var(--vec-u);fill-opacity:${op}` }, svg);
    }
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    polyline(svg, xs.map((c) => [f.sx(c), f.sy(Math.min(12, dT(c, 3)))]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, xs.map((c) => [f.sx(c), f.sy(Math.max(-3, Math.min(12, dT(c, ecs))))]), "stroke:var(--brand);stroke-width:2");
    const t = dT(C, ecs);
    el("line", { x1: f.sx(C), x2: f.sx(C), y1: f.sy(Math.min(12, t)), y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(C), cy: f.sy(Math.max(-3, Math.min(12, t))), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.L + 6, f.T + 12, "shaded: AR6 likely (2.5–4 °C) and very likely (2–5 °C) · dashed: best estimate 3 °C", { class: "fill-muted-foreground font-mono text-[10px]" });
    const dF = 5.35 * Math.log(C / 280);
    o.df.textContent = `${signed(dF, 2)} W/m²`;
    o.dbl.textContent = num(Math.log2(C / 280), 2);
    o.dt.textContent = `${signed(t)} °C at equilibrium`;
  }
  draw();
}

// ============================================================ Keeling curve

// Synthetic: trend c(y) = 315 + 0.831 (y − 1958) + 0.01207 (y − 1958)²,
// which passes through ≈ 315 ppm in 1958 and ≈ 420 ppm in 2023 with a
// 2023 growth of ≈ 2.4 ppm/yr; seasonal cycle peaking in May, ±3 ppm.
const trend = (y) => 315 + 0.831 * (y - 1958) + 0.01207 * (y - 1958) ** 2;
const growth = (y) => 0.831 + 2 * 0.01207 * (y - 1958);
const season = (y) => 3 * Math.cos(2 * Math.PI * (y - Math.floor(y) - 0.37));

for (const root of document.querySelectorAll("[data-climate-keeling]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const show = { season: true, zoom: false };
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { show[sw.dataset.toggle] = e.detail.checked; draw(); }));

  function draw() {
    const year = s.year.get();
    const y0 = show.zoom ? Math.max(1958, Math.min(2021, year - 1.5)) : 1958, y1 = show.zoom ? y0 + 3 : 2024;
    const c = (y) => trend(y) + (show.season ? season(y) : 0);
    const lo = show.zoom ? Math.floor(trend(y0) - 5) : 270, hi = show.zoom ? Math.ceil(trend(y1) + 5) : 430;
    svg.replaceChildren();
    const ticks = show.zoom ? [Math.ceil(y0), Math.ceil(y0) + 1, Math.ceil(y0) + 2].filter((t) => t <= y1) : [1960, 1980, 2000, 2020];
    const f = frame(svg, { box: [52, 14, 556, 240], x: [y0, y1], y: [lo, hi], xticks: ticks, yticks: show.zoom ? [lo, Math.round((lo + hi) / 2), hi] : [280, 320, 360, 400], ylabel: "CO₂ (ppm)" });
    if (!show.zoom) hline(svg, f, 280, "stroke:var(--vec-u);stroke-dasharray:4 4", "≈ 280 ppm pre-industrial");
    const pts = [];
    for (let y = y0; y <= y1; y += 1 / 24) pts.push([f.sx(y), f.sy(c(y))]);
    polyline(svg, pts, "stroke:var(--brand);stroke-width:1.5");
    polyline(svg, pts.map((_, i) => { const y = y0 + i / 24; return [f.sx(y), f.sy(trend(y))]; }), "stroke:var(--foreground);stroke-width:1;stroke-opacity:0.5;stroke-dasharray:3 3");
    if (!show.zoom) for (const [y, v] of [[1958, 315], [2023, 420]]) {
      el("circle", { cx: f.sx(y), cy: f.sy(v), r: 3.5, style: "fill:var(--foreground)" }, svg);
      text(svg, f.sx(y) + (y < 2000 ? 8 : -8), f.sy(v) + (y < 2000 ? 14 : -8), `${y}: ≈ ${v}`, { "text-anchor": y < 2000 ? "start" : "end", class: "fill-foreground font-mono text-[10px]" });
    }
    el("line", { x1: f.sx(year), x2: f.sx(year), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    el("circle", { cx: f.sx(year), cy: f.sy(c(year)), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.L + f.W, f.T + f.H + 26, "synthetic curve · anchors from NOAA", { "text-anchor": "end" });
    o.ppm.textContent = `${num(c(year), 1)} ppm`;
    o.trend.textContent = `${num(trend(year), 1)} ppm`;
    o.rate.textContent = `${num(growth(year), 2)} ppm/yr`;
  }
  draw();
}

// ============================================================ Carbon budget

const GCB = { fossil: 9.6, luc: 1.3, atm: 5.2, ocean: 2.8, land: 3.3 }; // GtC/yr, 2013–2022

for (const root of document.querySelectorAll("[data-climate-carbon]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const total0 = GCB.fossil + GCB.luc;

  function draw() {
    const E = s.scale.get(), k = E / total0;
    const parts = {
      fossil: GCB.fossil * k, luc: GCB.luc * k,
      atm: GCB.atm * k, ocean: GCB.ocean * k, land: GCB.land * k,
    };
    svg.replaceChildren();
    const unit = 10; // px per GtC/yr
    const bar = (x, items, title) => {
      let y = 40;
      text(svg, x, 26, title, { class: "fill-muted-foreground font-mono text-[10px]" });
      for (const [lbl, v, color] of items) {
        const hgt = Math.max(0.5, v * unit);
        el("rect", { x, y, width: 120, height: hgt, rx: 3, style: `fill:${color};fill-opacity:0.75` }, svg);
        text(svg, x + 128, y + Math.max(hgt, 10) / 2 + 3, `${lbl} ${num(v, 1)}`, { class: "fill-foreground font-mono text-[10px]" });
        y += hgt + 3;
      }
      return y;
    };
    bar(60, [["fossil fuels & cement", parts.fossil, "var(--foreground)"], ["land-use change", parts.luc, "var(--ion-na)"]], "SOURCES (GtC/yr)");
    bar(360, [["stays in the air", parts.atm, "var(--brand)"], ["ocean sink", parts.ocean, "var(--vec-u)"], ["land sink", parts.land, "var(--ion-cl)"]], "WHERE IT GOES");
    text(svg, 360, 290, `budget imbalance ${minus(num(-0.4 * k, 1))} GtC/yr (sources − sinks)`, { class: "fill-muted-foreground font-mono text-[10px]" });
    const ppm = parts.atm / GTC_PER_PPM, yrs = s.years.get();
    o.atm.textContent = `${num(parts.atm, 1)} GtC/yr (${num((GCB.atm / total0) * 100, 0)}%)`;
    o.rise.textContent = `${num(ppm, 2)} ppm/yr`;
    o.future.textContent = `${yrs} yr: ≈ ${num(420 + ppm * yrs, 0)} ppm`;
  }
  draw();
}

// ============================================================ Atmosphere layers

// US Standard Atmosphere 1976: base height (km), base T (K), lapse (K/km),
// base pressure (Pa).
const USSA = [
  [0, 288.15, -6.5, 101325], [11, 216.65, 0, 22632.06], [20, 216.65, 1.0, 5474.889],
  [32, 228.65, 2.8, 868.0187], [47, 270.65, 0, 110.9063], [51, 270.65, -2.8, 66.93887],
  [71, 214.65, -2.0, 3.95642],
];
const GMR = 0.0341632; // g₀M/R* in K/m

function atmosphere(hKm) {
  let b = USSA[0];
  for (const layer of USSA) if (hKm >= layer[0]) b = layer;
  const [hb, Tb, L, Pb] = b;
  const T = Tb + L * (hKm - hb);
  const P = L === 0 ? Pb * Math.exp((-GMR * (hKm - hb) * 1000) / Tb) : Pb * (T / Tb) ** (-GMR / (L / 1000));
  return { T, P };
}
const layerName = (h) => (h < 11 ? "troposphere" : h < 47 ? "stratosphere" : h < 51 ? "stratopause" : "mesosphere");

for (const root of document.querySelectorAll("[data-climate-layers]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-alt]").forEach((b) => b.addEventListener("click", () => s.alt.set(Number(b.dataset.alt))));

  function draw() {
    const h = s.alt.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 556, 320], x: [170, 300], y: [0, 86], xticks: [180, 200, 220, 240, 260, 280, 300], yticks: [0, 11, 20, 32, 47, 51, 71, 86], xlabel: "temperature (K)", ylabel: "km" });
    for (const [a, b, name, op] of [[0, 11, "troposphere", 0.1], [11, 47, "stratosphere", 0.05], [51, 86, "mesosphere", 0.1]]) {
      el("rect", { x: f.L, y: f.sy(b), width: f.W, height: f.sy(a) - f.sy(b), style: `fill:var(--vec-u);fill-opacity:${op}` }, svg);
      text(svg, f.L + f.W - 6, f.sy(b) + 14, name, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" });
    }
    text(svg, f.L + f.W - 6, f.sy(30) + 3, "ozone layer ≈ 15–35 km", { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[9px]" });
    const pts = [];
    for (let z = 0; z <= 86; z += 0.25) pts.push([f.sx(atmosphere(z).T), f.sy(z)]);
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    const { T, P } = atmosphere(h);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(h), y2: f.sy(h), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(T), cy: f.sy(h), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    o.layer.textContent = layerName(h);
    o.temp.textContent = `${num(T, 1)} K (${minus(num(T - 273.15, 1))} °C)`;
    o.p.textContent = P >= 100 ? `${num(P / 100, 1)} hPa` : `${num(P, 2)} Pa`;
    o.frac.textContent = `${num((P / 101325) * 100, P / 101325 < 0.01 ? 3 : 1)}%`;
  }
  draw();
}

// ============================================================ Humidity

const es = (T) => 6.112 * Math.exp((17.62 * T) / (243.12 + T)); // hPa
const dewPoint = (T, rh) => { const g = Math.log(rh / 100) + (17.62 * T) / (243.12 + T); return (243.12 * g) / (17.62 - g); };

for (const root of document.querySelectorAll("[data-climate-humidity]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const T = s.t.get(), rh = s.rh.get();
    const e = (rh / 100) * es(T), Td = dewPoint(T, rh);
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 556, 240], x: [-20, 45], y: [0, 100], xticks: [-20, -10, 0, 10, 20, 30, 40], yticks: [0, 25, 50, 75, 100], xlabel: "temperature (°C)", ylabel: "hPa", xfmt: minus });
    const pts = [];
    for (let t = -20; t <= 45; t += 0.25) pts.push([f.sx(t), f.sy(Math.min(100, es(t)))]);
    // Above the curve air is supersaturated; below, it can take more vapour.
    polyline(svg, pts, "stroke:var(--vec-u);stroke-width:2");
    text(svg, f.sx(36), f.sy(Math.min(96, es(36))) - 6, "saturation", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    // Cooling at constant vapour pressure: a horizontal line to the curve.
    el("line", { x1: f.sx(T), x2: f.sx(Td), y1: f.sy(e), y2: f.sy(e), style: "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:4 3" }, svg);
    el("line", { x1: f.sx(T), x2: f.sx(T), y1: f.sy(Math.min(100, es(T))), y2: f.sy(e), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(T), cy: f.sy(e), r: 5, style: "fill:var(--brand)" }, svg);
    el("circle", { cx: f.sx(Td), cy: f.sy(e), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(T) + 8, f.sy(e) + 4, "air", { class: "fill-foreground font-mono text-[10px]" });
    text(svg, f.sx(Td) - 8, f.sy(e) - 8, "dew point", { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    o.es.textContent = `${num(es(T), 2)} hPa`;
    o.e.textContent = `${num(e, 2)} hPa`;
    o.td.textContent = `${minus(num(Td, 1))} °C`;
    const spread = T - Td;
    o.base.textContent = spread < 0.05 ? "at the ground (fog)" : `≈ ${Math.round((125 * spread) / 10) * 10} m`;
  }
  draw();
}

// ============================================================ Circulation

const CELLS = {
  hadley: ["Hadley cell", "Warm air rises at the equator (the ITCZ, with its thunderstorms), flows poleward aloft, sinks near 30° in the dry subtropical highs, and returns along the surface as the trade winds."],
  ferrel: ["Ferrel cell", "An indirect cell driven by the cells on either side: surface air flows poleward from 30° to 60° as the westerlies, rises along the polar front near 60°, and returns aloft."],
  polar: ["Polar cell", "Cold dense air sinks over the pole, flows toward 60° along the surface as the polar easterlies, rises at the polar front, and returns poleward aloft."],
};

for (const root of document.querySelectorAll("[data-climate-circulation]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const name = root.querySelector("[data-info-name]"), info = root.querySelector("[data-info-text]");
  let sel = "hadley";
  const s = scrubAll(root, draw);
  const X = (lat) => 40 + ((lat + 90) / 180) * 560; // south pole left, north right
  const ground = 270;
  const top = (lat) => ground - (190 - 80 * (Math.abs(lat) / 90) ** 1.5); // tropopause, higher in the tropics

  // A loop between two latitudes; dir = +1 when the surface flow goes north.
  function cell(key, la, lb, dir) {
    const x0 = X(Math.min(la, lb)) + 10, x1 = X(Math.max(la, lb)) - 10;
    const y0 = ground - 18, y1 = Math.max(top(la), top(lb)) + 22;
    const g = el("g", { tabindex: 0, role: "button", "aria-label": CELLS[key][0], class: "cursor-pointer outline-none" }, svg);
    const on = sel === key;
    el("rect", { x: x0, y: y1, width: x1 - x0, height: y0 - y1, rx: Math.min(40, (x1 - x0) / 2), style: `fill:${on ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${on ? 0.12 : 0.05};stroke:${on ? "var(--brand)" : "var(--vec-u)"};stroke-width:${on ? 2 : 1.25}` }, g);
    // Arrowheads: surface flow (bottom) along dir, aloft the opposite way.
    const mid = (x0 + x1) / 2;
    const tri = (x, y, d) => el("path", { d: `M${x + 6 * d} ${y}L${x - 5 * d} ${y - 5}L${x - 5 * d} ${y + 5}Z`, style: `fill:${on ? "var(--brand)" : "var(--vec-u)"}` }, g);
    tri(mid, y0, dir);
    tri(mid, y1, -dir);
    const pick = () => { sel = key; draw(); };
    g.addEventListener("click", pick);
    g.addEventListener("pointerenter", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  }

  function draw() {
    svg.replaceChildren();
    // Tropopause.
    const tp = [];
    for (let lat = -90; lat <= 90; lat += 2) tp.push([X(lat), top(lat)]);
    polyline(svg, tp, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4");
    text(svg, X(0), top(0) - 6, "tropopause", { "text-anchor": "middle" });
    el("line", { x1: X(-90), x2: X(90), y1: ground, y2: ground, style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    for (const lat of [-90, -60, -30, 0, 30, 60, 90]) text(svg, X(lat), ground + 14, lat === 0 ? "0°" : `${Math.abs(lat)}°${lat < 0 ? "S" : "N"}`, { "text-anchor": "middle" });
    // Southern and northern cells. Surface flow: Hadley toward the
    // equator, Ferrel poleward, Polar toward 60°.
    cell("polar", -90, -60, 1); cell("ferrel", -60, -30, -1); cell("hadley", -30, 0, 1);
    cell("hadley", 0, 30, -1); cell("ferrel", 30, 60, 1); cell("polar", 60, 90, -1);
    const labels = [[-75, "polar easterlies"], [-45, "westerlies"], [-15, "SE trades"], [15, "NE trades"], [45, "westerlies"], [75, "polar easterlies"]];
    for (const [lat, l] of labels) text(svg, X(lat), ground + 30, l, { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
    for (const [lat, l] of [[0, "ITCZ (low)"], [30, "high"], [-30, "high"], [60, "low"], [-60, "low"]]) text(svg, X(lat), ground + 46, l, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
    // Rising and sinking arrows at the boundaries.
    for (const [lat, up] of [[0, true], [60, true], [-60, true], [30, false], [-30, false]]) {
      const x = X(lat), ya = ground - 40, yb = ground - 120;
      el("line", { x1: x, x2: x, y1: ya, y2: yb, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.5" }, svg);
      const y = up ? yb : ya, d = up ? -1 : 1;
      el("path", { d: `M${x} ${y + 6 * d}L${x - 5} ${y - 4 * d}L${x + 5} ${y - 4 * d}Z`, style: "fill:currentColor;fill-opacity:0.5" }, svg);
    }
    name.textContent = CELLS[sel][0];
    info.textContent = CELLS[sel][1];
    const lat = s.lat.get(), f = 2 * OMEGA * Math.sin(lat * RAD);
    o.f.textContent = `${minus(num(f * 1e4, 3))} × 10⁻⁴ s⁻¹`;
    o.defl.textContent = Math.abs(lat) < 0.5 ? "none at the equator" : lat > 0 ? "to the right (north)" : "to the left (south)";
  }
  draw();
}

// ============================================================ Meteogram

// Synthetic frontal passage at hour 24.
const front = (h) => 1 / (1 + Math.exp(-(h - 24) / 1.2)); // 0 before, 1 after
const met = (h) => {
  // A trough ahead of the front, a sharp but continuous rise as it passes,
  // then a slow climb behind it.
  const p = 1012 - 13 * Math.exp(-(((h - 23.5) / 7) ** 2)) * (1 - front(h)) + 5 * front(h) * (1 - Math.exp(-Math.max(0, h - 24) / 12));
  const diurnal = 2.5 * Math.sin(((h - 9) / 24) * 2 * Math.PI);
  const t = 16 - 7 * front(h) + diurnal * (1 - 0.4 * front(h));
  const dir = 225 + 90 * front(h); // SW → NW
  const spd = 15 + 15 * Math.exp(-(((h - 24) / 3) ** 2)) + 5 * front(h);
  const rain = Math.max(0, 4 * Math.exp(-(((h - 24.5) / 1.6) ** 2)) + 0.8 * Math.exp(-(((h - 20) / 3) ** 2)) - 0.05);
  return { p, t, dir, spd, rain };
};
const compass = (d) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((d % 360) / 45)) % 8];

// A wind barb at (x, y): staff toward where the wind comes from, barbs on
// the clockwise side (Northern Hemisphere).
function barb(svg, x, y, dirFrom, kt) {
  const g = el("g", { transform: `translate(${x} ${y}) rotate(${dirFrom})` }, svg);
  const L = 30, style = "stroke:var(--foreground);stroke-width:1.4;fill:none";
  el("circle", { cx: 0, cy: 0, r: 2.5, style: "fill:var(--foreground)" }, g);
  el("line", { x1: 0, y1: 0, x2: 0, y2: -L, style }, g);
  let v = Math.round(kt / 5) * 5, pos = -L;
  while (v >= 50) { el("path", { d: `M0 ${pos}L10 ${pos + 3}L0 ${pos + 6}Z`, style: "fill:var(--foreground)" }, g); pos += 8; v -= 50; }
  while (v >= 10) { el("line", { x1: 0, y1: pos, x2: 11, y2: pos - 4, style }, g); pos += 5; v -= 10; }
  if (v >= 5) { if (pos === -L) pos += 5; el("line", { x1: 0, y1: pos, x2: 6, y2: pos - 2, style }, g); }
}

for (const root of document.querySelectorAll("[data-climate-meteogram]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const hours = Array.from({ length: 97 }, (_, i) => i / 2);

  function draw() {
    const hr = s.hour.get();
    svg.replaceChildren();
    const xt = [0, 6, 12, 18, 24, 30, 36, 42, 48];
    const fp = frame(svg, { box: [52, 12, 556, 90], x: [0, 48], y: [996, 1020], xticks: [], yticks: [1000, 1010, 1020], ylabel: "hPa" });
    polyline(svg, hours.map((h) => [fp.sx(h), fp.sy(met(h).p)]), "stroke:var(--vec-u);stroke-width:1.75");
    const ft = frame(svg, { box: [52, 130, 556, 90], x: [0, 48], y: [4, 20], xticks: [], yticks: [5, 10, 15, 20], ylabel: "°C" });
    polyline(svg, hours.map((h) => [ft.sx(h), ft.sy(met(h).t)]), "stroke:var(--ion-na);stroke-width:1.75");
    const fr = frame(svg, { box: [52, 248, 556, 50], x: [0, 48], y: [0, 5], xticks: [], yticks: [0, 5], ylabel: "mm/h" });
    for (const h of hours) { const r = met(h).rain; if (r > 0.05) el("rect", { x: fr.sx(h) - 2.5, y: fr.sy(r), width: 5, height: fr.T + fr.H - fr.sy(r), style: "fill:var(--vec-u);fill-opacity:0.7" }, svg); }
    // Wind barbs every 3 hours along the bottom.
    for (let h = 0; h <= 48; h += 3) { const m = met(h); barb(svg, fr.sx(h), 350, m.dir, m.spd); }
    for (const t of xt) text(svg, fr.sx(t), 392, `${t} h`, { "text-anchor": "middle" });
    text(svg, 8, 354, "wind", { class: "fill-muted-foreground font-mono text-[10px]" });
    // Front marker and time cursor.
    el("line", { x1: fp.sx(24), x2: fp.sx(24), y1: 12, y2: 300, style: "stroke:var(--vec-u);stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
    text(svg, fp.sx(24) + 4, 22, "cold front", { style: "fill:var(--vec-u)" });
    el("line", { x1: fp.sx(hr), x2: fp.sx(hr), y1: 12, y2: 372, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    const m = met(hr);
    o.p.textContent = `${num(m.p, 1)} hPa`;
    o.t.textContent = `${num(m.t, 1)} °C`;
    o.wind.textContent = `${compass(m.dir)} ${Math.round(m.dir)}°, ${Math.round(m.spd)} kt`;
    o.rain.textContent = m.rain > 0.05 ? `${num(m.rain, 1)} mm/h` : "dry";
  }
  draw();
}
