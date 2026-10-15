// Agriculture and soil science blocks. Every number comes from the method
// named in the block: the USDA texture class rules, the FAO-56 water balance
// and Penman–Monteith equation, crop coefficients, degree days, the
// non-rectangular hyperbola, a nitrogen budget, Liebig and Mitscherlich,
// and a cation-exchange lime estimate.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Client coordinates to SVG user units. */
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

let clipN = 0;
function clipTo(svg, f) {
  const id = `agri-clip-${++clipN}`;
  const cp = el("clipPath", { id }, el("defs", {}, svg));
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, cp);
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

/** The value of the active segment in a block's segmented control. */
const segValue = (root) => root.querySelector('[data-seg][aria-selected="true"]')?.dataset.seg;

// ============================================================ USDA texture

// The USDA texture class rules (Soil Survey Manual), in the order they are
// tested. sa, si, cl are percentages of sand, silt and clay.
export function usdaClass(sa, si, cl) {
  if (si + 1.5 * cl < 15) return "sand";
  if (si + 1.5 * cl >= 15 && si + 2 * cl < 30) return "loamy sand";
  if ((cl >= 7 && cl < 20 && sa > 52 && si + 2 * cl >= 30) || (cl < 7 && si < 50 && si + 2 * cl >= 30)) return "sandy loam";
  if (cl >= 7 && cl < 27 && si >= 28 && si < 50 && sa <= 52) return "loam";
  if ((si >= 50 && cl >= 12 && cl < 27) || (si >= 50 && si < 80 && cl < 12)) return "silt loam";
  if (si >= 80 && cl < 12) return "silt";
  if (cl >= 20 && cl < 35 && si < 28 && sa > 45) return "sandy clay loam";
  if (cl >= 27 && cl < 40 && sa > 20 && sa <= 45) return "clay loam";
  if (cl >= 27 && cl < 40 && sa <= 20) return "silty clay loam";
  if (cl >= 35 && sa > 45) return "sandy clay";
  if (cl >= 40 && si >= 40) return "silty clay";
  return "clay";
}

// The same classes as convex pieces of half-planes a·sand + b·clay ≤ k, so
// the regions can be drawn exactly by clipping the triangle.
const H = (a, b, k) => [a, b, k];
const TEXTURE_REGIONS = {
  "sand": [[H(-1, 0.5, -85)]],
  "loamy sand": [[H(1, -0.5, 85), H(-1, 1, -70)]],
  "sandy loam": [
    [H(0, -1, -7), H(0, 1, 20), H(-1, 0, -52), H(1, -1, 70)],
    [H(0, 1, 7), H(-1, -1, -50), H(1, -1, 70)],
  ],
  "loam": [[H(0, -1, -7), H(0, 1, 27), H(1, 1, 72), H(-1, -1, -50), H(1, 0, 52)]],
  "silt loam": [
    [H(1, 1, 50), H(0, -1, -12), H(0, 1, 27)],
    [H(1, 1, 50), H(-1, -1, -20), H(0, 1, 12)],
  ],
  "silt": [[H(1, 1, 20), H(0, 1, 12)]],
  "sandy clay loam": [[H(0, -1, -20), H(0, 1, 35), H(-1, -1, -72), H(-1, 0, -45)]],
  "clay loam": [[H(0, -1, -27), H(0, 1, 40), H(-1, 0, -20), H(1, 0, 45)]],
  "silty clay loam": [[H(0, -1, -27), H(0, 1, 40), H(1, 0, 20)]],
  "sandy clay": [[H(0, -1, -35), H(-1, 0, -45)]],
  "silty clay": [[H(0, -1, -40), H(1, 1, 60)]],
  "clay": [[H(0, -1, -40), H(1, 0, 45), H(-1, -1, -60)]],
};

// The class boundaries as [sand, clay] segments, drawn once over the fills so
// the two pieces of an L-shaped class show no seam between them.
const TEXTURE_LINES = [
  [[85, 0], [90, 10]], [[70, 0], [85, 15]], [[52, 20], [80, 20]], [[52, 7], [52, 20]],
  [[43, 7], [52, 7]], [[50, 0], [23, 27]], [[52, 20], [45, 27]], [[45, 35], [65, 35]],
  [[45, 27], [45, 55]], [[0, 27], [45, 27]], [[0, 40], [45, 40]], [[20, 27], [20, 40]],
  [[20, 40], [0, 60]], [[20, 0], [8, 12]], [[8, 12], [0, 12]],
];
// Hand-placed labels for classes too thin for their centroid.
const TEXTURE_LABELS = { "sand": [94, 2.5], "loamy sand": [80, 4.5] };

const BEHAVIOUR = {
  "sand": "drains fast, holds little water or nutrients",
  "loamy sand": "drains fast, warms early, needs frequent watering",
  "sandy loam": "easy to work, drains well, moderate water holding",
  "loam": "balanced drainage and water holding",
  "silt loam": "holds water well, can crust at the surface",
  "silt": "smooth and fertile, crusts and erodes easily",
  "sandy clay loam": "sticky when wet, fairly good structure",
  "clay loam": "fertile, holds water, slow to drain",
  "silty clay loam": "holds much water, compacts if worked wet",
  "sandy clay": "heavy, cracks when dry",
  "silty clay": "heavy, slow to drain, sticky",
  "clay": "holds water and nutrients, drains slowly, cracks when dry",
};

/** Clips a polygon of [sand, clay] points by a·sand + b·clay ≤ k. */
function clipHalf(poly, [a, b, k]) {
  const out = [];
  const inside = (p) => a * p[0] + b * p[1] <= k + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const pi = inside(p), qi = inside(q);
    if (pi) out.push(p);
    if (pi !== qi) {
      const fp = a * p[0] + b * p[1] - k, fq = a * q[0] + b * q[1] - k;
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

for (const root of document.querySelectorAll("[data-agri-texture]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  // Corners: 100% sand bottom-left, 100% silt bottom-right, 100% clay top.
  const A = [50, 420], B = [470, 420], C = [260, 420 - 420 * Math.sqrt(3) / 2];
  const toXY = (sa, cl) => {
    const si = 100 - sa - cl;
    return [(sa * A[0] + si * B[0] + cl * C[0]) / 100, (sa * A[1] + si * B[1] + cl * C[1]) / 100];
  };
  const fromXY = (x, y) => {
    // Solve the barycentric weights of (x, y) in triangle A, B, C.
    const det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    const sa = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / det;
    const si = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / det;
    return [sa * 100, (1 - sa - si) * 100];
  };

  const regions = [];
  const base = el("g", {}, svg);
  for (const [name, pieces] of Object.entries(TEXTURE_REGIONS)) {
    let biggest = null, bigArea = 0;
    const d = pieces.map((piece) => {
      let poly = [[0, 0], [100, 0], [0, 100]];
      for (const hp of piece) poly = clipHalf(poly, hp);
      if (poly.length < 3) return "";
      const pts = poly.map(([s, c]) => toXY(s, c));
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        area += x1 * y2 - x2 * y1;
      }
      if (Math.abs(area) > bigArea) { bigArea = Math.abs(area); biggest = pts; }
      return "M" + pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join("L") + "Z";
    }).join("");
    const path = el("path", { d, style: "fill:var(--foreground);fill-opacity:0.03" }, base);
    let cx = biggest.reduce((s, p) => s + p[0], 0) / biggest.length;
    let cy = biggest.reduce((s, p) => s + p[1], 0) / biggest.length;
    if (TEXTURE_LABELS[name]) [cx, cy] = toXY(...TEXTURE_LABELS[name]);
    const label = text(base, cx, cy + 3, name, { "text-anchor": "middle", class: "fill-muted-foreground font-sans text-[10px]" });
    regions.push({ name, path, label });
  }
  for (const [p, q] of TEXTURE_LINES) {
    const [x1, y1] = toXY(...p), [x2, y2] = toXY(...q);
    el("line", { x1, y1, x2, y2, style: "stroke:currentColor;stroke-opacity:0.4;stroke-width:1" }, base);
  }
  // Axes with ticks every 10%.
  el("path", { d: `M${A}L${B}L${C}Z`, style: "fill:none;stroke:currentColor;stroke-opacity:0.6;stroke-width:1.25" }, base);
  for (let p = 10; p < 100; p += 10) {
    const [x1, y1] = toXY(100 - p, p); // left edge: clay p
    text(base, x1 - 6, y1 + 3, String(p), { "text-anchor": "end" });
    const [x2, y2] = toXY(0, 100 - p); // right edge: silt p
    text(base, x2 + 6, y2 + 3, String(p), { "text-anchor": "start" });
    const [x3, y3] = toXY(p, 0); // bottom: sand p
    text(base, x3, y3 + 14, String(p), { "text-anchor": "middle" });
  }
  text(base, (A[0] + C[0]) / 2 - 34, (A[1] + C[1]) / 2, "clay %", { "text-anchor": "end" });
  text(base, (B[0] + C[0]) / 2 + 34, (B[1] + C[1]) / 2, "silt %", { "text-anchor": "start" });
  text(base, (A[0] + B[0]) / 2, A[1] + 30, "← sand %", { "text-anchor": "middle" });

  const marker = el("g", {}, svg);
  const ring = el("circle", { r: 7, style: "fill:var(--background);stroke:var(--brand);stroke-width:2.5" }, marker);
  const hit = el("circle", { r: 16, tabindex: 0, role: "slider", "aria-label": "Soil composition", style: "fill:transparent;cursor:grab", class: "outline-none" }, marker);
  const s = scrubAll(root, (name) => {
    if (name === "sand" && s.sand.get() + s.clay.get() > 100) s.clay.set(100 - s.sand.get(), false);
    if (name === "clay" && s.sand.get() + s.clay.get() > 100) s.sand.set(100 - s.clay.get(), false);
    draw();
  });

  function draw() {
    const sa = s.sand.get(), cl = s.clay.get(), si = 100 - sa - cl;
    const cls = usdaClass(sa, si, cl);
    for (const r of regions) {
      const on = r.name === cls;
      r.path.style.fill = on ? "var(--brand)" : "var(--foreground)";
      r.path.style.fillOpacity = on ? "0.16" : "0.03";
      r.label.setAttribute("class", on ? "fill-foreground font-sans text-[10px] font-medium" : "fill-muted-foreground font-sans text-[10px]");
    }
    const [x, y] = toXY(sa, cl);
    for (const c of [ring, hit]) { c.setAttribute("cx", x); c.setAttribute("cy", y); }
    hit.setAttribute("aria-valuetext", `${sa}% sand, ${si}% silt, ${cl}% clay: ${cls}`);
    o.class.textContent = cls;
    o.silt.textContent = `${si}%`;
    o.behaviour.textContent = BEHAVIOUR[cls];
  }
  const setFrom = (sa, cl) => {
    sa = Math.round(clamp(sa, 0, 100));
    cl = Math.round(clamp(cl, 0, 100 - sa));
    s.sand.set(sa, false);
    s.clay.set(cl, false);
    draw();
  };
  const drag = (e) => {
    const p = svgPoint(svg, e);
    let [sa, cl] = fromXY(p.x, p.y);
    sa = clamp(sa, 0, 100); cl = clamp(cl, 0, 100);
    if (sa + cl > 100) { const k = 100 / (sa + cl); sa *= k; cl *= k; }
    setFrom(sa, cl);
  };
  svg.addEventListener("pointerdown", (e) => { svg.setPointerCapture(e.pointerId); drag(e); });
  svg.addEventListener("pointermove", (e) => { if (svg.hasPointerCapture(e.pointerId)) drag(e); });
  hit.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = e.shiftKey ? 5 : 1;
    setFrom(s.sand.get() + d[0] * k, s.clay.get() + d[1] * k);
  });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const [sa, cl] = b.dataset.preset.split(" ").map(Number);
    setFrom(sa, cl);
  }));
  draw();
}

// ============================================================ Water balance

// Midpoints of the FAO-56 Table 19 ranges (m³/m³).
const SOILS = {
  sandy: { name: "Sandy loam", fc: 0.23, wp: 0.11 },
  loam: { name: "Loam", fc: 0.25, wp: 0.12 },
  clay: { name: "Clay", fc: 0.36, wp: 0.22 },
};
const EFFICIENCY = { drip: 0.9, sprinkler: 0.75, none: 1 };

/** A four-stage FAO-56 crop coefficient curve at day d. */
export function kcAt(d, [li, ld, lm, ll], [ki, km, ke]) {
  if (d <= li) return ki;
  if (d <= li + ld) return ki + ((d - li) / ld) * (km - ki);
  if (d <= li + ld + lm) return km;
  if (d <= li + ld + lm + ll) return km + ((d - li - ld - lm) / ll) * (ke - km);
  return ke;
}

/** The daily FAO-56 single-layer root-zone water balance. */
export function waterSeason({ fc, wp, zr, mad, method, seed }) {
  const days = 120, p = 0.5;
  const TAW = 1000 * (fc - wp) * zr, RAW = p * TAW;
  const eff = EFFICIENCY[method];
  const rng = mulberry32(seed);
  let Dr = 0;
  const rows = [];
  const tot = { rain: 0, etc: 0, eta: 0, irrNet: 0, irrGross: 0, dp: 0, stress: 0 };
  for (let d = 0; d < days; d++) {
    const et0 = 3.5 + 2 * Math.sin((Math.PI * d) / days);
    const etc = kcAt(d, [20, 35, 40, 25], [0.3, 1.2, 0.6]) * et0;
    const rain = rng() < 0.22 ? -8 * Math.log(1 - rng()) : 0;
    let irr = 0;
    const Ks = Dr > RAW ? Math.max(0, (TAW - Dr) / (TAW - RAW)) : 1;
    const eta = Ks * etc;
    Dr = Dr - rain + eta;
    let dp = 0;
    if (Dr < 0) { dp = -Dr; Dr = 0; }
    Dr = Math.min(Dr, TAW);
    if (method !== "none" && Dr >= (mad / 100) * TAW) { irr = Dr; Dr = 0; }
    if (Ks < 1) tot.stress++;
    tot.rain += rain; tot.etc += etc; tot.eta += eta; tot.dp += dp;
    tot.irrNet += irr; tot.irrGross += irr / eff;
    rows.push({ d, Dr, rain, irr, Ks });
  }
  return { rows, tot, TAW, RAW };
}

for (const root of document.querySelectorAll("[data-agri-water]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 3;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const soilKey = root.querySelector('[aria-label="Soil"] [aria-selected="true"]')?.dataset.seg ?? "sandy";
    const method = root.querySelector('[aria-label="Method"] [aria-selected="true"]')?.dataset.seg ?? "drip";
    const soil = SOILS[soilKey];
    const r = waterSeason({ fc: soil.fc, wp: soil.wp, zr: s.zr.get(), mad: s.mad.get(), method, seed });
    svg.replaceChildren();
    const f = frame(svg, { box: [46, 16, 560, 200], x: [0, 120], y: [0, r.TAW], xticks: [0, 30, 60, 90, 120], yticks: [0, Math.round(r.TAW / 2), Math.round(r.TAW)], xlabel: "day of season", ylabel: "mm in reach of roots" });
    const g = clipTo(svg, f);
    // Available water = TAW − depletion; the stress threshold is TAW − RAW.
    el("rect", { x: f.L, y: f.sy(r.TAW - r.RAW), width: f.W, height: f.sy(0) - f.sy(r.TAW - r.RAW), style: "fill:var(--code-del);fill-opacity:0.06" }, g);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(r.TAW - r.RAW), y2: f.sy(r.TAW - r.RAW), style: "stroke:var(--code-del);stroke-dasharray:4 3;stroke-width:1" }, g);
    if (method !== "none") {
      const trig = r.TAW * (1 - s.mad.get() / 100);
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(trig), y2: f.sy(trig), style: "stroke:var(--ion-cl);stroke-dasharray:2 3;stroke-width:1" }, g);
      text(svg, f.L + f.W - 4, f.sy(trig) - 4, "irrigation trigger", { "text-anchor": "end" });
    }
    text(svg, f.L + 4, f.sy(r.TAW - r.RAW) + 12, "below: crop under stress", { "text-anchor": "start" });
    polyline(g, r.rows.map((row) => [f.sx(row.d), f.sy(r.TAW - row.Dr)]), "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round");
    // Rain and irrigation as bars underneath.
    const b = frame(svg, { box: [46, 250, 560, 50], x: [0, 120], y: [0, 50], xticks: [], yticks: [0, 50], ylabel: "mm/day" });
    for (const row of r.rows) {
      if (row.rain > 0.1) el("rect", { x: b.sx(row.d), y: b.sy(Math.min(50, row.rain)), width: 3, height: b.sy(0) - b.sy(Math.min(50, row.rain)), style: "fill:var(--vec-u);fill-opacity:0.8" }, svg);
      if (row.irr > 0.1) el("rect", { x: b.sx(row.d) + 1.5, y: b.sy(Math.min(50, row.irr)), width: 3, height: b.sy(0) - b.sy(Math.min(50, row.irr)), style: "fill:var(--ion-cl)" }, svg);
    }
    o.taw.textContent = `${num(r.TAW, 0)} mm (stress below ${num(r.TAW - r.RAW, 0)})`;
    o.rain.textContent = `${num(r.tot.rain, 0)} mm`;
    o.eta.textContent = `${num(r.tot.eta, 0)} of ${num(r.tot.etc, 0)} mm`;
    o.irr.textContent = method === "none" ? "none" : `${num(r.tot.irrNet, 0)} mm net, ${num(r.tot.irrGross, 0)} mm applied`;
    o.dp.textContent = `${num(r.tot.dp, 0)} mm`;
    o.stress.textContent = String(r.tot.stress);
  }
  draw();
}

// ============================================================ Penman–Monteith

const es0 = (T) => 0.6108 * Math.exp((17.27 * T) / (T + 237.3));

/** FAO-56 daily reference evapotranspiration, every intermediate value. */
export function et0PM({ tmax, tmin, rhmax, rhmin, u2, n, lat, z, doy }) {
  const T = (tmax + tmin) / 2;
  const P = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26);
  const gamma = 0.665e-3 * P;
  const delta = (4098 * es0(T)) / (T + 237.3) ** 2;
  const es = (es0(tmax) + es0(tmin)) / 2;
  const ea = (es0(tmin) * rhmax / 100 + es0(tmax) * rhmin / 100) / 2;
  const phi = (lat * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const dec = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(dec), -1, 1));
  const Ra = ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
  const N = (24 / Math.PI) * ws;
  const Rs = (0.25 + 0.5 * Math.min(n, N) / N) * Ra;
  const Rso = (0.75 + 2e-5 * z) * Ra;
  const Rns = 0.77 * Rs;
  const sigma = 4.903e-9;
  const Rnl = sigma * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * Math.min(1, Rs / Rso) - 0.35);
  const Rn = Rns - Rnl;
  const den = delta + gamma * (1 + 0.34 * u2);
  const rad = (0.408 * delta * Rn) / den;
  const aero = (gamma * (900 / (T + 273)) * u2 * (es - ea)) / den;
  const hg = 0.0023 * (T + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * 0.408 * Ra;
  return { T, P, gamma, delta, es, ea, Ra, N, Rs, Rso, Rns, Rnl, Rn, rad, aero, et0: rad + aero, hg };
}

for (const root of document.querySelectorAll("[data-agri-et0]")) {
  const svg = root.querySelector("[data-plot]");
  const steps = root.querySelector("[data-steps]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const v = Object.fromEntries(["tmax", "tmin", "rhmax", "rhmin", "u2", "n", "lat", "z", "doy"].map((k) => [k, s[k].get()]));
    if (v.tmin > v.tmax) { s.tmin.set(v.tmax, false); v.tmin = v.tmax; }
    if (v.rhmin > v.rhmax) { s.rhmin.set(v.rhmax, false); v.rhmin = v.rhmax; }
    const r = et0PM(v);
    const rows = [
      ["mean T", `${num(r.T, 1)} °C`], ["pressure P", `${num(r.P, 1)} kPa`],
      ["γ", `${num(r.gamma, 4)} kPa/°C`], ["Δ", `${num(r.delta, 4)} kPa/°C`],
      ["eₛ", `${num(r.es, 3)} kPa`], ["eₐ", `${num(r.ea, 3)} kPa`],
      ["Rₐ", `${num(r.Ra, 2)} MJ/m²/d`], ["N (day length)", `${num(r.N, 2)} h`],
      ["Rₛ", `${num(r.Rs, 2)} MJ/m²/d`], ["Rₙₛ", `${num(r.Rns, 2)} MJ/m²/d`],
      ["Rₙₗ", `${num(r.Rnl, 2)} MJ/m²/d`], ["Rₙ", `${num(r.Rn, 2)} MJ/m²/d`],
    ];
    steps.replaceChildren(...rows.map(([k, val]) => {
      const d = document.createElement("div");
      d.className = "flex justify-between gap-3 border-b border-border/50 py-0.5";
      const a = document.createElement("span"); a.className = "text-muted-foreground"; a.textContent = k;
      const b = document.createElement("span"); b.className = "tabular-nums"; b.textContent = val;
      d.append(a, b);
      return d;
    }));
    svg.replaceChildren();
    const max = Math.max(1, Math.ceil(Math.max(r.et0, r.hg) + 0.5));
    const f = frame(svg, { box: [150, 14, 440, 150], x: [0, max], y: [0, 3], xticks: Array.from({ length: max + 1 }, (_, i) => i), yticks: [], xlabel: "mm/day" });
    const bar = (row, x0, w, color, label) => {
      el("rect", { x: f.sx(x0), y: f.sy(3 - row) + 8, width: Math.max(0, f.sx(x0 + w) - f.sx(x0)), height: 30, rx: 3, style: `fill:${color}` }, svg);
      if (label) text(svg, f.L - 8, f.sy(3 - row) + 27, label, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    };
    bar(0, 0, Math.max(0, r.rad), "var(--vec-out)", "Penman–Monteith");
    bar(0, Math.max(0, r.rad), Math.max(0, r.aero), "var(--vec-u)");
    text(svg, f.sx(Math.max(0, r.rad) / 2), f.sy(3) + 27, "radiation", { "text-anchor": "middle", class: "fill-background font-mono text-[10px]" });
    if (r.aero > 0.5) text(svg, f.sx(r.rad + r.aero / 2), f.sy(3) + 27, "air", { "text-anchor": "middle", class: "fill-background font-mono text-[10px]" });
    bar(1.3, 0, r.hg, "var(--foreground)", "Hargreaves");
    o.et0.textContent = `${num(r.et0, 2)} mm/day (radiation ${num(r.rad, 2)} + air ${num(r.aero, 2)})`;
    o.hg.textContent = `${num(r.hg, 2)} mm/day`;
  }
  draw();
}

// ============================================================ Crop coefficient

const KC_PRESETS = {
  maize: { l: [30, 40, 50, 30], k: [0.3, 1.2, 0.6] },
  wheat: { l: [20, 25, 60, 30], k: [0.3, 1.15, 0.25] },
  tomato: { l: [30, 40, 40, 25], k: [0.6, 1.15, 0.8] },
};

for (const root of document.querySelectorAll("[data-agri-kc]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    const p = KC_PRESETS[e.detail.value];
    ["lini", "ldev", "lmid", "llate"].forEach((k, i) => s[k].set(p.l[i], false));
    ["kini", "kmid", "kend"].forEach((k, i) => s[k].set(p.k[i], false));
    draw();
  });

  function draw() {
    const l = ["lini", "ldev", "lmid", "llate"].map((k) => s[k].get());
    const k = ["kini", "kmid", "kend"].map((x) => s[x].get());
    const L = l.reduce((a, b) => a + b, 0);
    const mean = s.et0.get();
    // A smooth seasonal ET₀ whose average over the season is exactly `mean`.
    const et0 = (d) => mean * (1 + 0.25 * Math.sin((Math.PI * d) / L) - 0.5 / Math.PI);
    const days = Array.from({ length: L + 1 }, (_, d) => d);
    const kc = days.map((d) => kcAt(d, l, k));
    const etc = days.map((d, i) => kc[i] * et0(d));
    svg.replaceChildren();
    const f = frame(svg, { box: [46, 16, 560, 110], x: [0, L], y: [0, 1.4], xticks: [], yticks: [0, 0.7, 1.4], ylabel: "Kc" });
    let x0 = 0;
    ["initial", "development", "mid-season", "late"].forEach((name, i) => {
      if (i % 2) el("rect", { x: f.sx(x0), y: f.T, width: f.sx(x0 + l[i]) - f.sx(x0), height: f.H, style: "fill:var(--foreground);fill-opacity:0.04" }, svg);
      text(svg, f.sx(x0 + l[i] / 2), f.T + 12, name, { "text-anchor": "middle" });
      x0 += l[i];
    });
    polyline(svg, days.map((d, i) => [f.sx(d), f.sy(kc[i])]), "stroke:var(--brand);stroke-width:2");
    const peak = Math.max(...etc);
    const top = Math.max(2, Math.ceil(peak + 0.5));
    const g = frame(svg, { box: [46, 150, 560, 110], x: [0, L], y: [0, top], xticks: Array.from({ length: Math.floor(L / 30) + 1 }, (_, i) => i * 30), yticks: [0, top], xlabel: "day after planting", ylabel: "mm/day" });
    polyline(svg, days.map((d) => [g.sx(d), g.sy(et0(d))]), "stroke:var(--foreground);stroke-opacity:0.45;stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svg, days.map((d, i) => [g.sx(d), g.sy(etc[i])]), "stroke:var(--vec-u);stroke-width:2");
    text(svg, g.L + g.W - 4, g.T + 10, "ETc (solid), ET₀ (dashed)", { "text-anchor": "end" });
    // Daily sum (trapezoid would double-count the ends; days are whole).
    const total = etc.slice(0, L).reduce((a, b) => a + b, 0);
    o.len.textContent = `${L} days`;
    o.etc.textContent = `${num(total, 0)} mm (ET₀ ${num(mean * L, 0)} mm)`;
    o.peak.textContent = `${num(peak, 2)} mm/day`;
  }
  draw();
}

// ============================================================ Degree days

/** Growing degree days for one day, by the simple or bounded method. */
export function gdd(tmax, tmin, base, cap, method) {
  if (method === "simple") return Math.max(0, (tmax + tmin) / 2 - base);
  const hi = Math.max(base, Math.min(tmax, cap));
  const lo = Math.min(cap, Math.max(tmin, base));
  return Math.max(0, (hi + lo) / 2 - base);
}

const STAGES = [[100, "emergence"], [700, "flowering"], [1400, "maturity"]];

for (const root of document.querySelectorAll("[data-agri-gdd]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", draw);
  // A synthetic season from 1 May (day 0) to the end of September.
  const rng = mulberry32(11);
  const season = Array.from({ length: 153 }, (_, d) => {
    const mean = 12 + 10 * Math.sin((Math.PI * (d + 10)) / 175) + 2.2 * (rng() + rng() - 1);
    const amp = 5 + 3 * rng();
    return [mean + amp, mean - amp];
  });

  function draw() {
    const method = segValue(root) ?? "modified";
    const base = s.base.get(), cap = s.cap.get();
    let acc = 0;
    const cum = season.map(([tx, tn]) => (acc += gdd(tx, tn, base, cap, method)));
    svg.replaceChildren();
    const f = frame(svg, { box: [46, 14, 560, 120], x: [0, 152], y: [-5, 40], xticks: [], yticks: [0, 20, 40], ylabel: "°C" });
    const g = clipTo(svg, f);
    season.forEach(([tx, tn], d) => el("line", { x1: f.sx(d), x2: f.sx(d), y1: f.sy(tx), y2: f.sy(tn), style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:2" }, g));
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(base), y2: f.sy(base), style: "stroke:var(--vec-u);stroke-width:1.25" }, g);
    text(svg, f.L + f.W - 4, f.sy(base) - 4, `base ${num(base, 1)}`, { "text-anchor": "end" });
    if (method === "modified") {
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(cap), y2: f.sy(cap), style: "stroke:var(--code-del);stroke-width:1;stroke-dasharray:4 3" }, g);
      text(svg, f.L + f.W - 4, f.sy(cap) - 4, `cap ${num(cap, 1)}`, { "text-anchor": "end" });
    }
    const top = Math.max(1600, Math.ceil(acc / 200) * 200);
    const c = frame(svg, { box: [46, 170, 560, 120], x: [0, 152], y: [0, top], xticks: [0, 31, 61, 92, 123, 152], xfmt: (v) => ({ 0: "May", 31: "Jun", 61: "Jul", 92: "Aug", 123: "Sep", 152: "Oct" })[v], yticks: [0, top / 2, top], ylabel: "GDD" });
    let maturity = null;
    for (const [t, name] of STAGES) {
      el("line", { x1: c.L, x2: c.L + c.W, y1: c.sy(t), y2: c.sy(t), style: "stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:3 3" }, svg);
      const day = cum.findIndex((v) => v >= t);
      text(svg, c.L + 4, c.sy(t) - 4, `${name} ${t}`, { "text-anchor": "start" });
      if (day >= 0) el("circle", { cx: c.sx(day), cy: c.sy(t), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
      if (name === "maturity") maturity = day;
    }
    polyline(svg, cum.map((v, d) => [c.sx(d), c.sy(v)]), "stroke:var(--brand);stroke-width:2");
    const date = (d) => new Date(Date.UTC(2026, 4, 1 + d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    o.day.textContent = `${num(gdd(s.tx.get(), s.tn.get(), base, cap, method), 1)} degree-days`;
    o.total.textContent = `${num(acc, 0)} degree-days`;
    o.maturity.textContent = maturity >= 0 && maturity !== null ? `${date(maturity)} (day ${maturity})` : "not reached";
  }
  draw();
}

// ============================================================ Light response

const LIGHT_PRESETS = { c3: { pmax: 25, alpha: 0.05, theta: 0.7, rd: 1.5 }, c4: { pmax: 45, alpha: 0.06, theta: 0.8, rd: 1.5 } };

/** Net photosynthesis from the non-rectangular hyperbola. */
export function photo(I, { pmax, alpha, theta, rd }) {
  const a = alpha * I + pmax;
  const gross = theta < 1e-6 ? (alpha * I * pmax) / a : (a - Math.sqrt(Math.max(0, a * a - 4 * theta * alpha * I * pmax))) / (2 * theta);
  return gross - rd;
}

function bisect(f, lo, hi) {
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (f(lo) * f(m) <= 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

for (const root of document.querySelectorAll("[data-agri-light]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    const p = LIGHT_PRESETS[e.detail.value];
    for (const k in p) s[k].set(p[k], false);
    draw();
  });

  function draw() {
    const pathway = segValue(root) ?? "c3";
    const p = { pmax: s.pmax.get(), alpha: s.alpha.get(), theta: s.theta.get(), rd: s.rd.get() };
    const other = LIGHT_PRESETS[pathway === "c3" ? "c4" : "c3"];
    const I = s.light.get();
    svg.replaceChildren();
    const top = Math.ceil(Math.max(p.pmax, other.pmax) / 10) * 10 + 5;
    const f = frame(svg, { box: [52, 16, 550, 260], x: [0, 2000], y: [-5, top], xticks: [0, 500, 1000, 1500, 2000], yticks: [0, Math.round(top / 2), top], xlabel: "PPFD (µmol photons/m²/s)", ylabel: "net CO₂ uptake" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    const xs = Array.from({ length: 201 }, (_, i) => i * 10);
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(photo(x, other))]), "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(photo(x, p))]), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(p.pmax - p.rd), y2: f.sy(p.pmax - p.rd), style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
    text(svg, f.L + f.W - 4, f.sy(p.pmax - p.rd) - 4, "P max − Rd", { "text-anchor": "end" });
    const pn = photo(I, p);
    el("circle", { cx: f.sx(I), cy: f.sy(pn), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    const comp = bisect((x) => photo(x, p), 0, 2000);
    const sat = bisect((x) => photo(x, p) + p.rd - 0.9 * p.pmax, 0, 20000);
    o.pn.textContent = `${num(pn, 1)} µmol CO₂/m²/s`;
    o.comp.textContent = comp === null ? "—" : `${num(comp, 0)} µmol/m²/s`;
    o.sat.textContent = sat === null ? "—" : `${num(sat, 0)} µmol/m²/s`;
  }
  draw();
}

// ============================================================ Nitrogen

const N_FRACTION = { urea: 0.46, an: 0.34, can: 0.27, as: 0.21 };

/** Nitrogen to apply and the matching mass of fertilizer product. */
export function nitrogenPlan({ yld, uptake, soil, miner, credit, eff, product }) {
  const demand = yld * uptake;
  const supply = soil + miner + credit;
  const n = Math.max(0, demand - supply) / (eff / 100);
  const mass = n / N_FRACTION[product];
  return { demand, supply, n, mass, bags: Math.ceil(mass / 50 - 1e-9) };
}

for (const root of document.querySelectorAll("[data-agri-nitrogen]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", draw);

  function draw() {
    const product = segValue(root) ?? "urea";
    const r = nitrogenPlan({ yld: s.yield.get(), uptake: s.uptake.get(), soil: s.soil.get(), miner: s.miner.get(), credit: s.credit.get(), eff: s.eff.get(), product });
    svg.replaceChildren();
    const max = Math.max(r.demand, r.supply + r.n) * 1.05 || 1;
    const sx = (v) => 130 + (v / max) * 450;
    const row = (y, label) => text(svg, 122, y + 17, label, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    row(10, "crop demand");
    el("rect", { x: sx(0), y: 10, width: sx(r.demand) - sx(0), height: 26, rx: 3, style: "fill:var(--foreground);fill-opacity:0.7" }, svg);
    row(60, "where N comes from");
    let x = 0;
    const seg = (v, color, label) => {
      if (v <= 0) return;
      el("rect", { x: sx(x), y: 60, width: sx(x + v) - sx(x), height: 26, style: `fill:${color}` }, svg);
      if (sx(x + v) - sx(x) > 9 * label.length) text(svg, (sx(x) + sx(x + v)) / 2, 77, label, { "text-anchor": "middle", class: "fill-background font-mono text-[10px]" });
      x += v;
    };
    seg(s.soil.get(), "var(--vec-out)", "soil");
    seg(s.miner.get(), "var(--ion-ca)", "min.");
    seg(s.credit.get(), "var(--ion-cl)", "legume");
    const recovered = r.n * (s.eff.get() / 100);
    seg(recovered, "var(--brand)", "fertilizer");
    seg(r.n - recovered, "var(--code-del)", "lost");
    text(svg, 130, 118, "Fertilizer: recovered by the crop (pink), lost (red).", { "text-anchor": "start" });
    o.demand.textContent = `${num(r.demand, 0)} kg N/ha`;
    o.supply.textContent = `${num(r.supply, 0)} kg N/ha`;
    o.napply.textContent = `${num(r.n, 1)} kg N/ha`;
    o.product.textContent = `${num(r.mass, 1)} kg/ha`;
    o.bags.textContent = String(r.bags);
  }
  draw();
}

// ============================================================ Rotation

const FAMILIES = {
  Solanaceae: { gap: 3, color: "var(--code-del)" },
  Brassicaceae: { gap: 3, color: "var(--vec-u)" },
  Fabaceae: { gap: 2, color: "var(--ion-cl)" },
  Apiaceae: { gap: 2, color: "var(--vec-out)" },
  Amaryllidaceae: { gap: 2, color: "var(--ion-k)" },
  Cucurbitaceae: { gap: 2, color: "var(--ion-na)" },
  Poaceae: { gap: 1, color: "var(--ion-ca)" },
  Amaranthaceae: { gap: 2, color: "var(--brand)" },
};
const CROPS = {
  potato: ["Solanaceae", "heavy"], tomato: ["Solanaceae", "heavy"],
  cabbage: ["Brassicaceae", "heavy"], broccoli: ["Brassicaceae", "heavy"], turnip: ["Brassicaceae", "medium"],
  pea: ["Fabaceae", "fixer"], bean: ["Fabaceae", "fixer"], clover: ["Fabaceae", "fixer"],
  carrot: ["Apiaceae", "light"], onion: ["Amaryllidaceae", "light"], squash: ["Cucurbitaceae", "heavy"],
  wheat: ["Poaceae", "medium"], barley: ["Poaceae", "medium"], maize: ["Poaceae", "heavy"],
  beet: ["Amaranthaceae", "medium"], fallow: [null, "none"],
};
const ROT_PRESETS = {
  veg: ["pea", "cabbage", "carrot", "potato"],
  norfolk: ["wheat", "turnip", "barley", "clover"],
  bad: ["maize", "maize", "maize", "maize"],
};

for (const root of document.querySelectorAll("[data-agri-rotation]")) {
  const grid = root.querySelector("[data-grid]");
  const legend = root.querySelector("[data-legend]");
  const checks = root.querySelector("[data-checks]");
  // plan[bed][year]
  let plan = [];
  const load = (key) => {
    const seq = ROT_PRESETS[key];
    plan = Array.from({ length: 4 }, (_, b) => Array.from({ length: 4 }, (_, y) => seq[(b + y) % 4]));
  };
  load("veg");

  for (const [fam, f] of Object.entries(FAMILIES)) {
    const chip = document.createElement("span");
    chip.className = "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground";
    const dot = document.createElement("span");
    dot.className = "size-2 rounded-full";
    dot.style.background = f.color;
    chip.append(dot, `${fam} · gap ${f.gap} y`);
    legend.append(chip);
  }

  function render() {
    grid.replaceChildren();
    grid.style.gridTemplateColumns = "auto repeat(4, minmax(0, 1fr))";
    const head = (t) => { const d = document.createElement("div"); d.className = "px-1 text-center font-mono text-[11px] text-muted-foreground"; d.textContent = t; return d; };
    grid.append(head(""), ...[1, 2, 3, 4].map((y) => head(`Year ${y}`)));
    plan.forEach((row, b) => {
      const label = head(`Bed ${b + 1}`);
      label.className = "self-center pr-1 font-mono text-[11px] text-muted-foreground";
      grid.append(label);
      row.forEach((crop, y) => {
        const sel = document.createElement("select");
        sel.setAttribute("aria-label", `Bed ${b + 1}, year ${y + 1}`);
        sel.className = "h-10 w-full min-w-0 cursor-pointer rounded-md border border-input bg-background px-1.5 text-base sm:text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
        for (const c of Object.keys(CROPS)) {
          const opt = document.createElement("option");
          opt.value = c; opt.textContent = c;
          if (c === crop) opt.selected = true;
          sel.append(opt);
        }
        const fam = CROPS[crop][0];
        sel.style.boxShadow = fam ? `inset 4px 0 0 ${FAMILIES[fam].color}` : "none";
        sel.addEventListener("change", () => { plan[b][y] = sel.value; render(); });
        grid.append(sel);
      });
    });
    check();
  }

  function check() {
    const items = [];
    let gapProblems = 0, follows = 0, heavyAfterHeavy = 0;
    plan.forEach((row, b) => {
      row.forEach((crop, y) => {
        const fam = CROPS[crop][0];
        if (!fam) return;
        // The plan repeats every four years, so look ahead cyclically.
        for (let k = 1; k <= FAMILIES[fam].gap && k < 4; k++) {
          const next = row[(y + k) % 4];
          if (CROPS[next][0] === fam) {
            gapProblems++;
            const gap = FAMILIES[fam].gap;
            items.push(["bad", `Bed ${b + 1}: ${fam} in year ${y + 1} returns ${k} year${k > 1 ? "s" : ""} later; leave at least ${gap} year${gap > 1 ? "s" : ""} of other crops between.`]);
            break;
          }
        }
        const nxt = row[(y + 1) % 4];
        if (CROPS[crop][1] === "fixer" && ["heavy", "medium"].includes(CROPS[nxt][1])) follows++;
        if (CROPS[crop][1] === "heavy" && CROPS[nxt][1] === "heavy") heavyAfterHeavy++;
      });
    });
    if (gapProblems > 3) items.splice(2, items.length, ["bad", `…and ${gapProblems - 2} more returns too soon.`]);
    if (!gapProblems) items.unshift(["good", "No family returns to a bed before its gap, assuming the plan repeats."]);
    if (follows) items.push(["good", `${follows} time${follows > 1 ? "s" : ""} a nitrogen-using crop follows a legume and uses the nitrogen it fixed.`]);
    else items.push(["info", "No hungry crop follows a legume: try putting brassicas or maize after peas, beans or clover."]);
    if (heavyAfterHeavy) items.push(["info", `${heavyAfterHeavy} time${heavyAfterHeavy > 1 ? "s" : ""} a heavy feeder follows another: expect to add more fertilizer.`]);
    const color = { good: "var(--code-add)", bad: "var(--code-del)", info: "var(--muted-foreground)" };
    checks.replaceChildren(...items.slice(0, 7).map(([kind, msg]) => {
      const li = document.createElement("li");
      li.className = "flex gap-2 leading-snug";
      const dot = document.createElement("span");
      dot.className = "mt-1.5 size-2 shrink-0 rounded-full";
      dot.style.background = color[kind];
      const span = document.createElement("span");
      span.textContent = msg;
      li.append(dot, span);
      return li;
    }));
  }

  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { load(b.dataset.preset); render(); }));
  render();
}

// ============================================================ Liebig and Mitscherlich

/** Mitscherlich yield, and the rate where the last kg of N pays for itself. */
export function mitscherlich({ A, c, b, ratio }) {
  const Y = (x) => A * (1 - Math.exp(-c * (x + b)));
  const opt = Math.max(0, Math.log((1000 * A * c) / ratio) / c - b);
  return { Y, opt, yopt: Y(opt), marg: 1000 * A * c * Math.exp(-c * (opt + b)) };
}

for (const root of document.querySelectorAll("[data-agri-minimum]")) {
  const barrel = root.querySelector("[data-barrel]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const factors = [["water", 80], ["N", 45], ["P", 70], ["K", 90], ["light", 95], ["Ca", 85]];
  const s = scrubAll(root, drawCurve);

  // The barrel: one stave per factor, as tall as its supply relative to need.
  const left = 50, width = 220, bottom = 270, full = 230;
  const sw = width / factors.length;
  const water = el("rect", { x: left, width, style: "fill:var(--vec-u);fill-opacity:0.35" }, barrel);
  const staves = factors.map(([name], i) => {
    const r = el("rect", { x: left + i * sw + 1, width: sw - 2, rx: 2, tabindex: 0, role: "slider", "aria-label": `${name} supply`, "aria-valuemin": 10, "aria-valuemax": 100, class: "cursor-pointer outline-none", style: "fill:var(--foreground);fill-opacity:0.12;stroke:currentColor;stroke-opacity:0.5" }, barrel);
    const t = text(barrel, left + i * sw + sw / 2, bottom + 16, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    const v = text(barrel, left + i * sw + sw / 2, 0, "", { "text-anchor": "middle" });
    return { r, t, v, i };
  });
  el("line", { x1: left - 6, x2: left + width + 6, y1: bottom, y2: bottom, style: "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5" }, barrel);
  for (const y of [0.35, 0.75]) el("line", { x1: left - 4, x2: left + width + 4, y1: bottom - full * y, y2: bottom - full * y, style: "stroke:currentColor;stroke-opacity:0.25;stroke-width:3" }, barrel);

  function drawBarrel() {
    const min = Math.min(...factors.map((f) => f[1]));
    const limiting = factors.filter((f) => f[1] === min).map((f) => f[0]);
    water.setAttribute("y", bottom - (full * min) / 100);
    water.setAttribute("height", (full * min) / 100);
    for (const st of staves) {
      const val = factors[st.i][1];
      st.r.setAttribute("y", bottom - (full * val) / 100);
      st.r.setAttribute("height", (full * val) / 100);
      st.r.setAttribute("aria-valuenow", val);
      st.r.style.fill = val === min ? "var(--code-del)" : "var(--foreground)";
      st.r.style.fillOpacity = val === min ? "0.35" : "0.12";
      st.v.setAttribute("y", bottom - (full * val) / 100 - 5);
      st.v.textContent = `${val}%`;
    }
    o.limit.textContent = `Yield is held at ≈${min}% of potential by ${limiting.join(" and ")}. Raising any other factor adds nothing.`;
  }
  const setStave = (i, v) => { factors[i][1] = Math.round(clamp(v, 10, 100) / 5) * 5; drawBarrel(); };
  for (const st of staves) {
    st.r.addEventListener("keydown", (e) => {
      const d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5 }[e.key];
      if (d) { e.preventDefault(); setStave(st.i, factors[st.i][1] + d); }
    });
  }
  barrel.addEventListener("pointerdown", (e) => {
    const p = svgPoint(barrel, e);
    const i = Math.floor((p.x - left) / sw);
    if (i < 0 || i >= factors.length) return;
    setStave(i, ((bottom - p.y) / full) * 100);
    staves[i].r.focus({ preventScroll: true });
  });

  function drawCurve() {
    const m = mitscherlich({ A: s.A.get(), c: s.c.get(), b: s.b.get(), ratio: s.ratio.get() });
    curve.replaceChildren();
    const f = frame(curve, { box: [44, 12, 300, 190], x: [0, 300], y: [0, Math.ceil(s.A.get())], xticks: [0, 100, 200, 300], yticks: [0, Math.ceil(s.A.get())], xlabel: "kg N/ha applied", ylabel: "t/ha" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(s.A.get()), y2: f.sy(s.A.get()), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, curve);
    polyline(curve, Array.from({ length: 151 }, (_, i) => [f.sx(i * 2), f.sy(m.Y(i * 2))]), "stroke:var(--brand);stroke-width:2");
    if (m.opt <= 300) {
      el("line", { x1: f.sx(m.opt), x2: f.sx(m.opt), y1: f.sy(m.yopt), y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:2 3" }, curve);
      el("circle", { cx: f.sx(m.opt), cy: f.sy(m.yopt), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, curve);
    }
    o.opt.textContent = `${num(m.opt, 0)} kg N/ha`;
    o.yopt.textContent = `${num(m.yopt, 2)} t/ha`;
    o.marg.textContent = `${num(m.marg, 1)} kg grain per kg N`;
  }
  drawBarrel();
  drawCurve();
}

// ============================================================ Soil pH

// Schematic relative availability (0–1) at pH control points, after the
// classic chart of Truog (1946).
const NUTRIENTS = [
  ["N", [[4, 0.25], [5.5, 0.6], [6, 1], [8, 1], [9, 0.45], [10, 0.3]]],
  ["P", [[4, 0.2], [5.5, 0.35], [6.2, 1], [7.4, 1], [8, 0.4], [9, 0.45], [10, 0.5]]],
  ["K", [[4, 0.3], [5.5, 0.55], [6, 1], [10, 1]]],
  ["S", [[4, 0.3], [5.5, 0.55], [6, 1], [10, 1]]],
  ["Ca", [[4, 0.2], [5.5, 0.4], [7, 1], [8.5, 1], [10, 0.7]]],
  ["Mg", [[4, 0.2], [5.5, 0.4], [7, 1], [8.5, 1], [10, 0.7]]],
  ["Fe", [[4, 1], [6, 1], [7, 0.55], [7.8, 0.25], [10, 0.2]]],
  ["Mn", [[4, 1], [6.2, 1], [7, 0.55], [8, 0.25], [10, 0.2]]],
  ["B", [[4, 0.35], [5, 1], [7, 1], [8, 0.35], [8.5, 0.3], [10, 0.5]]],
  ["Cu", [[4, 0.4], [5, 1], [7, 1], [8, 0.35], [10, 0.25]]],
  ["Zn", [[4, 0.4], [5, 1], [7, 1], [8, 0.35], [10, 0.25]]],
  ["Mo", [[4, 0.15], [5.5, 0.3], [7, 0.8], [8, 1], [10, 1]]],
];
const interp = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
};

/** CaCO₃ (t/ha) to raise base saturation: 1 cmol+/kg needs 0.5 g CaCO₃/kg. */
export function limeNeed({ cec, bs, bst, depth, bd }) {
  const acid = Math.max(0, (cec * (bst - bs)) / 100);
  const soilKg = depth * bd * 100000; // per hectare: depth cm × 10⁴ m² × bd t/m³
  return { acid, t: (acid * 0.5 * soilKg) / 1e6 };
}

for (const root of document.querySelectorAll("[data-agri-ph]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const ph = s.ph.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 560, 330], x: [4, 10], y: [0, NUTRIENTS.length], xticks: [4, 5, 6, 7, 8, 9, 10], yticks: [], xlabel: "soil pH" });
    el("rect", { x: f.sx(6), y: f.T, width: f.sx(7.5) - f.sx(6), height: f.H, style: "fill:var(--code-add);fill-opacity:0.06" }, svg);
    const rowH = f.H / NUTRIENTS.length;
    const xs = Array.from({ length: 121 }, (_, i) => 4 + i * 0.05);
    NUTRIENTS.forEach(([name, pts], i) => {
      const cy = f.T + rowH * (i + 0.5);
      const half = (x) => (rowH * 0.42) * interp(pts, x);
      const upper = xs.map((x) => `${f.sx(x).toFixed(1)},${(cy - half(x)).toFixed(1)}`);
      const lower = xs.slice().reverse().map((x) => `${f.sx(x).toFixed(1)},${(cy + half(x)).toFixed(1)}`);
      el("path", { d: `M${upper.join("L")}L${lower.join("L")}Z`, style: "fill:var(--foreground);fill-opacity:0.16" }, svg);
      text(svg, f.L - 6, cy + 3, name, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
      const w = interp(pts, ph);
      el("rect", { x: f.sx(ph) - 3, y: cy - half(ph), width: 6, height: 2 * half(ph), rx: 2, style: `fill:${w >= 0.85 ? "var(--code-add)" : w <= 0.4 ? "var(--code-del)" : "var(--vec-out)"}` }, svg);
    });
    el("line", { x1: f.sx(ph), x2: f.sx(ph), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    text(svg, f.sx(6.75), f.T + 10, "most crops: 6–7.5", { "text-anchor": "middle" });
    const at = NUTRIENTS.map(([n, pts]) => [n, interp(pts, ph)]);
    o.good.textContent = at.filter(([, w]) => w >= 0.85).map(([n]) => n).join(", ") || "—";
    o.poor.textContent = at.filter(([, w]) => w <= 0.4).map(([n]) => n).join(", ") || "—";
    const l = limeNeed({ cec: s.cec.get(), bs: s.bs.get(), bst: s.bst.get(), depth: s.depth.get(), bd: s.bd.get() });
    o.acid.textContent = `${num(l.acid, 2)} cmol+/kg`;
    o.lime.textContent = `${num(l.t, 2)} t/ha`;
  }
  draw();
}
