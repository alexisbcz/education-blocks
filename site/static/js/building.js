// Building physics blocks. Each block's root carries a data-bldg-* attribute;
// the module does nothing on pages without them. Methods: ISO 6946 series
// resistances, the ISO 13788 Glaser method, a UA + 0.33nV heat loss,
// explicit finite volumes for transient conduction, solar geometry with
// profile angles, the BRE average daylight factor, a well-mixed CO2 balance,
// Fanger's PMV (ISO 7730) and Sharp's sound insulation model with ISO 717-1
// Rw. The hot box figure listens for "bldg-wall" events.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import "../anatomy/building-hotbox.js";

const BRAND = "var(--brand)";
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const selectSeg = (root, label, value) => {
  const list = root.querySelector(`[role="tablist"][aria-label="${label}"]`);
  for (const b of list?.querySelectorAll("[data-seg]") ?? []) b.setAttribute("aria-selected", String(b.dataset.seg === value));
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;
const thou = (v) => Math.round(v).toLocaleString("en-GB");

// ============================================================ materials
// Typical design values: λ in W/(m·K), μ the vapour resistance factor,
// ρ in kg/m³, c in J/(kg·K). Air gaps and films carry a fixed R or sd.
export const MAT = {
  plaster: { name: "Gypsum plaster", lambda: 0.57, mu: 10, rho: 1300, c: 1000, shade: 0.22 },
  board: { name: "Plasterboard", lambda: 0.21, mu: 10, rho: 700, c: 1000, shade: 0.18 },
  brick: { name: "Brick", lambda: 0.77, mu: 10, rho: 1700, c: 800, shade: 0.34 },
  block: { name: "Dense concrete block", lambda: 1.13, mu: 15, rho: 2000, c: 1000, shade: 0.3 },
  concrete: { name: "Concrete", lambda: 1.35, mu: 80, rho: 2300, c: 1000, shade: 0.38 },
  aac: { name: "Aerated block", lambda: 0.15, mu: 6, rho: 600, c: 1000, shade: 0.2 },
  wool: { name: "Mineral wool", lambda: 0.035, mu: 1, rho: 30, c: 1030, shade: 0.06, soft: true },
  eps: { name: "EPS", lambda: 0.038, mu: 40, rho: 20, c: 1450, shade: 0.08, soft: true },
  pir: { name: "PIR board", lambda: 0.022, mu: 60, rho: 32, c: 1400, shade: 0.1, soft: true },
  fibre: { name: "Wood fibre board", lambda: 0.04, mu: 5, rho: 160, c: 2100, shade: 0.12, soft: true },
  osb: { name: "OSB", lambda: 0.13, mu: 200, rho: 650, c: 1700, shade: 0.26 },
  timber: { name: "Softwood", lambda: 0.13, mu: 50, rho: 500, c: 1600, shade: 0.24 },
  render: { name: "Cement render", lambda: 1.0, mu: 20, rho: 1800, c: 1000, shade: 0.3 },
  air: { name: "Air gap, sealed", air: true, mu: 1, rho: 1.2, c: 1000, shade: 0 },
  vcl: { name: "Polythene VCL", lambda: 0.33, mu: 250000, rho: 920, c: 1900, shade: 0.5, film: true },
  membrane: { name: "Breather membrane", lambda: 0.17, mu: 100, rho: 400, c: 1500, shade: 0.4, film: true },
};
const RSI = 0.13, RSE = 0.04;
// ISO 6946 Table 8: unventilated air layers, horizontal heat flow.
const AIR_R = [[0, 0], [5, 0.11], [7, 0.13], [10, 0.15], [15, 0.17], [25, 0.18], [1000, 0.18]];
function airR(mm) {
  for (let i = 1; i < AIR_R.length; i++) {
    const [d1, r1] = AIR_R[i], [d0, r0] = AIR_R[i - 1];
    if (mm <= d1) return r0 + ((r1 - r0) * (mm - d0)) / (d1 - d0);
  }
  return 0.18;
}
/** Thermal resistance of a layer of `mm` millimetres. */
export const layerR = (m, mm) => (MAT[m].air ? airR(mm) : mm / 1000 / MAT[m].lambda);
const layerSd = (m, mm) => (MAT[m].mu * mm) / 1000;

/** Interface temperatures for layers listed inside to outside. */
export function profile(layers, ti, te) {
  const rs = layers.map((l) => layerR(l.m, l.mm));
  const R = RSI + rs.reduce((a, b) => a + b, 0) + RSE;
  const U = 1 / R, q = U * (ti - te);
  const temps = [ti, ti - q * RSI];
  for (const r of rs) temps.push(temps[temps.length - 1] - q * r);
  temps.push(te);
  return { R, U, q, rs, temps };
}

// ============================================================ B2 U-value

const WALLS = {
  cavity: [["plaster", 13], ["block", 100], ["wool", 100], ["brick", 102.5]],
  timber: [["board", 12.5], ["vcl", 0.2], ["wool", 140], ["osb", 9], ["fibre", 60], ["render", 10]],
  solid: [["plaster", 13], ["brick", 215]],
  internal: [["board", 12.5], ["wool", 80], ["plaster", 13], ["brick", 215]],
};

const INPUT = "h-8 rounded-md border border-input bg-background px-2 font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

for (const root of document.querySelectorAll("[data-bldg-wall]")) {
  const svg = root.querySelector("[data-plot]");
  const list = root.querySelector("[data-layers]");
  const icon = root.querySelector("[data-remove-icon]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let layers = WALLS.cavity.map(([m, mm]) => ({ m, mm }));

  onSeg(root, (_, v) => { layers = WALLS[v].map(([m, mm]) => ({ m, mm })); rows(); draw(); });
  root.querySelector('[data-action="add"]').addEventListener("click", () => {
    if (layers.length >= 8) return;
    layers.push({ m: "wool", mm: 50 });
    rows();
    draw();
    list.lastElementChild?.querySelector("select")?.focus();
  });

  // One row per layer: material, thickness in mm, remove.
  function rows() {
    list.replaceChildren();
    layers.forEach((l, i) => {
      const row = document.createElement("div");
      row.setAttribute("role", "listitem");
      row.className = "flex items-center gap-2 text-sm";
      const n = document.createElement("span");
      n.className = "hidden w-14 shrink-0 font-mono text-[11px] text-muted-foreground sm:block";
      n.textContent = i === 0 ? "inside" : i === layers.length - 1 ? "outside" : String(i + 1).padStart(2, "0");
      const sel = document.createElement("select");
      sel.className = INPUT + " min-w-0 flex-1 font-sans";
      sel.setAttribute("aria-label", `Layer ${i + 1} material`);
      for (const [k, m] of Object.entries(MAT)) {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = m.name;
        opt.selected = k === l.m;
        sel.append(opt);
      }
      sel.addEventListener("change", () => {
        l.m = sel.value;
        if (MAT[l.m].film) l.mm = 0.2;
        else if (l.mm < 3) l.mm = 25;
        mm.value = String(l.mm);
        draw();
      });
      const mm = document.createElement("input");
      mm.type = "number";
      mm.inputMode = "decimal";
      mm.min = "0.1";
      mm.max = "600";
      mm.step = "any";
      mm.value = String(l.mm);
      mm.className = INPUT + " w-20 text-right";
      mm.setAttribute("aria-label", `Layer ${i + 1} thickness in millimetres`);
      mm.addEventListener("input", () => {
        const v = parseFloat(mm.value);
        if (Number.isFinite(v) && v > 0 && v <= 600) { l.mm = v; draw(); }
      });
      const unit = document.createElement("span");
      unit.className = "w-6 font-mono text-[11px] text-muted-foreground";
      unit.textContent = "mm";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "inline-flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40";
      del.setAttribute("aria-label", `Remove layer ${i + 1}, ${MAT[l.m].name}`);
      del.append(icon.content.cloneNode(true));
      del.disabled = layers.length <= 1;
      del.addEventListener("click", () => {
        layers.splice(i, 1);
        rows();
        draw();
        (list.children[Math.min(i, layers.length - 1)]?.querySelector("button") ?? root.querySelector('[data-action="add"]')).focus();
      });
      row.append(n, sel, mm, unit, del);
      list.append(row);
    });
  }

  function draw() {
    const ti = s.ti.get(), te = s.te.get();
    const p = profile(layers, ti, te);
    const total = layers.reduce((a, l) => a + l.mm, 0);
    svg.replaceChildren();
    // Films get a fixed band; layers share the rest by thickness, with a
    // floor so a thin film stays visible.
    const L = 52, W = 556, FILM = 26;
    const inner = W - 2 * FILM;
    const minW = 5;
    const raw = layers.map((l) => Math.max(minW, (l.mm / total) * inner));
    const k = inner / raw.reduce((a, b) => a + b, 0);
    const widths = raw.map((w) => w * k);
    const xs = [L, L + FILM];
    for (const w of widths) xs.push(xs[xs.length - 1] + w);
    xs.push(L + W);
    const lo = Math.min(te, ti) - 2, hi = Math.max(te, ti) + 2;
    const step = hi - lo > 30 ? 10 : 5;
    const yt = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yt.push(v);
    const f = frame(svg, { box: [L, 34, W, 222], x: [0, 1], y: [lo, hi], yticks: yt, yfmt: (v) => num(v, 0), ylabel: "°C" });
    // Bands.
    el("rect", { x: L, y: f.T, width: FILM, height: f.H, style: "fill:var(--vec-out);fill-opacity:.12" }, svg);
    el("rect", { x: L + W - FILM, y: f.T, width: FILM, height: f.H, style: "fill:var(--vec-out);fill-opacity:.12" }, svg);
    layers.forEach((l, i) => {
      const m = MAT[l.m], x0 = xs[i + 1], w = widths[i];
      el("rect", { x: x0, y: f.T, width: w, height: f.H, style: `fill:currentColor;fill-opacity:${m.shade};stroke:currentColor;stroke-opacity:.25;stroke-width:.6` }, svg);
      if (m.soft) for (let y = f.T + 6; y < f.T + f.H; y += 9) el("path", { d: `M${x0 + 2} ${y}q${w / 4} -4 ${w / 2} 0t${w / 2 - 4} 0`, style: "fill:none;stroke:currentColor;stroke-opacity:.18;stroke-width:.6" }, svg);
      if (w > 70) text(svg, x0 + w / 2, f.T + f.H - 8, m.name, { "text-anchor": "middle" });
      else if (w > 12) text(svg, x0 + w / 2 + 3, f.T + f.H - 8, m.name, { "text-anchor": "start", transform: `rotate(-90 ${x0 + w / 2} ${f.T + f.H - 8})` });
    });
    text(svg, L + FILM / 2, f.T + 12, "Rsi", { "text-anchor": "middle" });
    text(svg, L + W - FILM / 2, f.T + 12, "Rse", { "text-anchor": "middle" });
    text(svg, L, f.T + f.H + 14, "inside", { "text-anchor": "start" });
    text(svg, L + W, f.T + f.H + 14, "outside", { "text-anchor": "end" });
    // Temperature: flat in the air, then straight within each layer.
    const sy = f.sy;
    const pts = [[L, sy(ti)]];
    p.temps.slice(1, -1).forEach((t, i) => pts.push([xs[i + 1], sy(t)]));
    pts.push([L + W, sy(te)]);
    polyline(svg, pts, `stroke:${BRAND};stroke-width:2;stroke-linejoin:round`);
    for (const [x, y] of pts.slice(1, -1)) el("circle", { cx: x, cy: y, r: 2.6, style: `fill:${BRAND}` }, svg);
    // Label the drop across the biggest layer.
    const big = p.rs.indexOf(Math.max(...p.rs));
    if (big >= 0) {
      const t0 = p.temps[big + 1], t1 = p.temps[big + 2];
      const xm = (xs[big + 1] + xs[big + 2]) / 2;
      text(svg, xm, Math.min(sy(t0), sy(t1)) - 8, `−${num(t0 - t1, 1)} K (${Math.round(((t0 - t1) / Math.max(1e-9, ti - te)) * 100)} %)`, { "text-anchor": "middle", style: `fill:${BRAND}` });
    }
    o.r.textContent = `${num(p.R, 2)} m²K/W`;
    o.u.textContent = `${num(p.U, 2)} W/m²K`;
    o.q.textContent = `${num(p.q, 1)} W/m²`;
    o.tsi.textContent = `${num(p.temps[1], 1)} °C`;
    o.d.textContent = `${num(total, 0)} mm`;
    o.lim.textContent = p.U <= 0.26 ? "meets it" : `${num(p.U / 0.26, 1)}× too high`;
    document.dispatchEvent(new CustomEvent("bldg-wall", {
      detail: { layers: layers.map((l, i) => ({ m: l.m, mm: l.mm, name: MAT[l.m].name, shade: MAT[l.m].shade, soft: !!MAT[l.m].soft, film: !!MAT[l.m].film, air: !!MAT[l.m].air, r: p.rs[i] })), temps: p.temps, ti, te, U: p.U, q: p.q },
    }));
  }
  rows();
  draw();
}

// ============================================================ B3 Glaser

// ISO 13788 saturation pressure, Pa (over ice below 0 °C).
export const psat = (t) => (t >= 0 ? 610.5 * Math.exp((17.269 * t) / (237.3 + t)) : 610.5 * Math.exp((21.875 * t) / (265.5 + t)));
const DELTA0 = 2e-10; // kg/(m·s·Pa)
const GWALLS = {
  internal: { layers: [["board", 12.5], ["wool", 80], ["brick", 215]], vclAt: 1 },
  timber: { layers: [["board", 12.5], ["wool", 140], ["osb", 11], ["fibre", 40]], vclAt: 1 },
  external: { layers: [["plaster", 13], ["brick", 215], ["eps", 100], ["render", 10]], vclAt: 1 },
};

/** Lower convex hull of points sorted by x: the taut string under psat. */
function lowerHull(pts) {
  const h = [];
  for (const p of pts) {
    while (h.length >= 2) {
      const [a, b] = [h[h.length - 2], h[h.length - 1]];
      if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) <= 0) h.pop();
      else break;
    }
    h.push(p);
  }
  return h;
}

/** Glaser: vapour pressure line, saturation curve and condensation planes. */
export function glaser(layers, ti, rhi, te, rhe) {
  const p = profile(layers, ti, te);
  const sds = layers.map((l) => layerSd(l.m, l.mm));
  const sdT = sds.reduce((a, b) => a + b, 0);
  const pi = (rhi / 100) * psat(ti), pe = (rhe / 100) * psat(te);
  // Sample the saturation curve within each layer: temperature and sd
  // both vary linearly across a layer.
  const curve = [];
  let s0 = 0;
  layers.forEach((l, i) => {
    const t0 = p.temps[i + 1], t1 = p.temps[i + 2];
    const n = 24;
    for (let j = 0; j <= n; j++) {
      if (i > 0 && j === 0) continue;
      const u = j / n;
      curve.push([s0 + u * sds[i], psat(t0 + u * (t1 - t0)), i, u]);
    }
    s0 += sds[i];
  });
  // The string from (0, pi) to (sdT, pe) may not rise above psat. The
  // surfaces are included: an inside surface below the dew point is
  // surface condensation.
  const pts = [[0, Math.min(pi, curve[0][1]), "in"], ...curve.slice(1, -1).map((c) => [c[0], c[1], c]), [sdT, Math.min(pe, curve[curve.length - 1][1]), "out"]];
  const hull = lowerHull(pts);
  const planes = [];
  for (let i = 1; i < hull.length - 1; i++) {
    const [a, b, c] = [hull[i - 1], hull[i], hull[i + 1]];
    const gin = (DELTA0 * (b[1] - a[1])) / Math.max(1e-12, b[0] - a[0]);
    const gout = (DELTA0 * (c[1] - b[1])) / Math.max(1e-12, c[0] - b[0]);
    // gin and gout are pressure slopes × δ0, so the vapour flux is minus
    // each; flux arriving minus flux leaving is gout − gin.
    const rate = gout - gin; // kg/(m²·s), positive when vapour accumulates
    if (rate > 1e-13) planes.push({ sd: b[0], p: b[1], layer: b[2][2], u: b[2][3], rate });
  }
  // Merge neighbouring samples that touch the same stretch of curve.
  const merged = [];
  for (const pl of planes) {
    const last = merged[merged.length - 1];
    if (last && pl.layer === last.layer && Math.abs(pl.sd - last.sd) < sdT * 0.03) { last.rate += pl.rate; last.sd = pl.sd; last.p = pl.p; last.u = pl.u; }
    else merged.push({ ...pl });
  }
  return { ...p, sds, sdT, pi, pe, curve, hull, planes: merged, surface: pi > curve[0][1] };
}

for (const root of document.querySelectorAll("[data-bldg-glaser]")) {
  const svg = root.querySelector("[data-plot]");
  const strip = root.querySelector("[data-strip]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let wall = "internal", vcl = false;
  onSeg(root, (_, v) => { wall = v; draw(); });
  root.querySelector('[data-toggle="vcl"]')?.addEventListener("shadcn:checked-change", (e) => { vcl = e.detail.checked; draw(); });

  function layersNow() {
    const w = GWALLS[wall];
    const ls = w.layers.map(([m, mm]) => ({ m, mm }));
    if (vcl) ls.splice(w.vclAt, 0, { m: "vcl", mm: 0.2 });
    return ls;
  }

  function draw() {
    const layers = layersNow();
    const g = glaser(layers, s.ti.get(), s.rhi.get(), s.te.get(), s.rhe.get());
    svg.replaceChildren();
    const top = Math.max(g.curve[0][1], g.pi, 400) * 1.08;
    const ystep = top > 2400 ? 500 : top > 1200 ? 250 : 100;
    const yt = [];
    for (let v = 0; v <= top; v += ystep) yt.push(v);
    const xs = niceTicks(g.sdT);
    const f = frame(svg, { box: [56, 32, 560, 240], x: [0, g.sdT], y: [0, top], xticks: xs, yticks: yt, xfmt: (v) => num(v, g.sdT < 3 ? 2 : g.sdT < 20 ? 1 : 0), yfmt: (v) => thou(v), xlabel: "equivalent air thickness sd (m)", ylabel: "pressure (Pa)" });
    let acc = 0;
    g.sds.forEach((sd, i) => {
      acc += sd;
      if (i < g.sds.length - 1) el("line", { x1: f.sx(acc), x2: f.sx(acc), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.18;stroke-dasharray:2 3" }, svg);
    });
    polyline(svg, g.curve.map(([x, y]) => [f.sx(x), f.sy(Math.min(y, top))]), "stroke:var(--vec-u);stroke-width:1.6");
    // The naive straight line, then the real (taut) one.
    el("line", { x1: f.sx(0), y1: f.sy(g.pi), x2: f.sx(g.sdT), y2: f.sy(g.pe), style: `stroke:${BRAND};stroke-opacity:.35;stroke-width:1.2;stroke-dasharray:4 3` }, svg);
    polyline(svg, g.hull.map(([x, y]) => [f.sx(x), f.sy(y)]), `stroke:${BRAND};stroke-width:2`);
    for (const pl of g.planes) {
      el("line", { x1: f.sx(pl.sd), x2: f.sx(pl.sd), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-del);stroke-width:1.4" }, svg);
      el("circle", { cx: f.sx(pl.sd), cy: f.sy(pl.p), r: 3.5, style: "fill:var(--code-del)" }, svg);
    }
    // The strip: layers drawn to their sd.
    strip.replaceChildren();
    acc = 0;
    layers.forEach((l, i) => {
      const x0 = f.sx(acc), x1 = f.sx(acc + g.sds[i]);
      acc += g.sds[i];
      el("rect", { x: x0, y: 8, width: Math.max(1, x1 - x0), height: 28, style: `fill:currentColor;fill-opacity:${Math.max(0.05, MAT[l.m].shade)};stroke:currentColor;stroke-opacity:.3;stroke-width:.6` }, strip);
      if (x1 - x0 > 46) text(strip, (x0 + x1) / 2, 26, MAT[l.m].name, { "text-anchor": "middle" });
    });
    const thin = layers.filter((l, i) => f.sx(g.sds.slice(0, i + 1).reduce((a, b) => a + b, 0)) - f.sx(g.sds.slice(0, i).reduce((a, b) => a + b, 0)) <= 46).map((l) => MAT[l.m].name);
    text(strip, f.L, 54, thin.length ? `too thin to label at this scale: ${thin.join(", ")}` : "each layer as wide as its vapour resistance", { "text-anchor": "start" });
    o.sd.textContent = `${num(g.sdT, 2)} m`;
    o.pi.textContent = `${thou(g.pi)} Pa (dew point ${num(dewPoint(g.pi), 1)} °C)`;
    o.pe.textContent = `${thou(g.pe)} Pa`;
    const month = g.planes.reduce((a, pl) => a + pl.rate, 0) * 86400 * 30 * 1000;
    if (g.surface) o.at.textContent = "inside surface";
    else o.at.textContent = g.planes.length ? g.planes.map((pl) => describePlane(layers, pl)).join("; ") : "nowhere";
    o.rate.textContent = g.planes.length ? `${num(month, 0)} g/m² a month` : "0";
    o.verdict.textContent = g.surface ? "surface condensation and mould risk" : g.planes.length ? (month > 200 ? "wetting: check drying, add a VCL" : "small: must dry out in summer") : "no condensation";
    o.verdict.style.color = g.planes.length || g.surface ? "var(--code-del)" : "";
  }
  const describePlane = (layers, pl) => {
    const a = MAT[layers[pl.layer].m].name;
    if (pl.u > 0.97 && layers[pl.layer + 1]) return `${a} / ${MAT[layers[pl.layer + 1].m].name}`;
    if (pl.u < 0.03 && pl.layer > 0) return `${MAT[layers[pl.layer - 1].m].name} / ${a}`;
    return `inside the ${a.toLowerCase()}`;
  };
  draw();
}
function dewPoint(p) {
  // Inverse of the Magnus form above 0 °C (and the ice form below).
  const a = Math.log(p / 610.5);
  const t = (237.3 * a) / (17.269 - a);
  return t >= 0 ? t : (265.5 * a) / (21.875 - a);
}
function niceTicks(max) {
  const raw = max / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// ============================================================ B4 heat loss

const AREAS = { walls: 110, roof: 50, floor: 50, windows: 20 };
const VOLUME = 250, FLOOR = 100;
const HOUSES = {
  old: { uw: 1.6, ur: 2.0, uf: 0.7, ug: 4.8, n: 1.0 },
  mid: { uw: 0.35, ur: 0.25, uf: 0.25, ug: 2.0, n: 0.6 },
  low: { uw: 0.12, ur: 0.1, uf: 0.12, ug: 0.8, n: 0.3 },
};
for (const root of document.querySelectorAll("[data-bldg-loss]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { for (const [k, x] of Object.entries(HOUSES[v])) s[k].set(x, false); draw(); });
  function draw() {
    const items = [
      ["Walls", s.uw.get() * AREAS.walls, `${AREAS.walls} m² × ${num(s.uw.get(), 2)}`],
      ["Roof", s.ur.get() * AREAS.roof, `${AREAS.roof} m² × ${num(s.ur.get(), 2)}`],
      ["Floor", s.uf.get() * AREAS.floor, `${AREAS.floor} m² × ${num(s.uf.get(), 2)}`],
      ["Windows, doors", s.ug.get() * AREAS.windows, `${AREAS.windows} m² × ${num(s.ug.get(), 1)}`],
      ["Air", 0.33 * s.n.get() * VOLUME, `0.33 × ${num(s.n.get(), 2)} × ${VOLUME} m³`],
    ];
    const hlc = items.reduce((a, [, v]) => a + v, 0);
    svg.replaceChildren();
    const L = 120, W = 330, T = 20, rowH = 44;
    const max = Math.max(...items.map(([, v]) => v));
    const scale = niceTicks(max);
    const xmax = scale[scale.length - 1];
    scale.forEach((t) => {
      const x = L + (t / xmax) * W;
      el("line", { x1: x, x2: x, y1: T, y2: T + rowH * items.length, style: "stroke:currentColor;stroke-opacity:.07" }, svg);
      text(svg, x, T + rowH * items.length + 14, thou(t), { "text-anchor": "middle" });
    });
    text(svg, L + W, T + rowH * items.length + 28, "W/K", { "text-anchor": "end" });
    items.forEach(([name, v, how], i) => {
      const y = T + i * rowH;
      const w = (v / xmax) * W;
      el("rect", { x: L, y: y + 8, width: Math.max(1, w), height: 18, rx: 3, style: `fill:${i === 4 ? "var(--vec-out)" : BRAND};fill-opacity:${i === 4 ? 0.55 : 0.7}` }, svg);
      text(svg, L - 10, y + 21, name, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
      text(svg, L + w + 6, y + 15, `${num(v, 0)} W/K · ${Math.round((v / hlc) * 100)} %`, { "text-anchor": "start" });
      text(svg, L + w + 6, y + 27, how, { "text-anchor": "start", style: "opacity:.75" });
    });
    const ua = items.slice(0, 4).reduce((a, [, v]) => a + v, 0);
    const year = (hlc * s.dd.get() * 24) / 1000;
    o.ua.textContent = `${num(ua, 0)} W/K`;
    o.hv.textContent = `${num(items[4][1], 0)} W/K`;
    o.hlc.textContent = `${num(hlc, 0)} W/K`;
    o.load.textContent = `${num((hlc * s.dt.get()) / 1000, 1)} kW`;
    o.year.textContent = `${thou(year)} kWh`;
    o.pm2.textContent = `${thou(year / FLOOR)} kWh/m²`;
  }
  draw();
}

// ============================================================ B5 thermal mass

// Outside → inside. The marked layer's thickness is the "main layer" field.
const MASS_WALLS = {
  concrete: { layers: [["eps", 100], ["concrete", 200, true], ["plaster", 13]], d: 200 },
  aac: { layers: [["render", 10], ["aac", 400, true], ["plaster", 13]], d: 400 },
  timber: { layers: [["fibre", 60], ["wool", 140, true], ["osb", 11], ["board", 12.5]], d: 140 },
  brick: { layers: [["render", 15], ["brick", 330, true], ["plaster", 13]], d: 330 },
};

/** Periodic response of a wall (layers outside → inside) to a 24 h sine. */
export function massResponse(layers, mean, amp, ti = 20) {
  const cells = [];
  for (const l of layers) {
    const m = MAT[l.m], d = l.mm / 1000;
    const n = Math.max(2, Math.ceil(d / (m.soft ? 0.005 : 0.004)));
    for (let i = 0; i < n; i++) cells.push({ dx: d / n, k: m.air ? d / airR(l.mm) : m.lambda, C: m.rho * m.c * (d / n) });
  }
  const N = cells.length;
  const G = new Float64Array(N + 1); // G[i] between cell i-1 and i; G[0] outside, G[N] inside
  G[0] = 1 / (RSE + cells[0].dx / (2 * cells[0].k));
  for (let i = 1; i < N; i++) G[i] = 1 / (cells[i - 1].dx / (2 * cells[i - 1].k) + cells[i].dx / (2 * cells[i].k));
  G[N] = 1 / (RSI + cells[N - 1].dx / (2 * cells[N - 1].k));
  let dt = Infinity;
  for (let i = 0; i < N; i++) dt = Math.min(dt, cells[i].C / (G[i] + G[i + 1]));
  dt *= 0.9;
  const P = 86400, days = 6;
  const steps = Math.ceil((days * P) / dt);
  dt = (days * P) / steps;
  const T = new Float64Array(N).fill(mean);
  const C = cells.map((c) => c.C);
  const tout = (t) => mean + amp * Math.cos((2 * Math.PI * (t - 15 * 3600)) / P); // peak at 15:00
  const out = [];
  const sampleEvery = Math.max(1, Math.round(600 / dt));
  const flux = new Float64Array(N + 1);
  for (let s = 0; s < steps; s++) {
    const t = s * dt;
    flux[0] = G[0] * (tout(t) - T[0]);
    for (let i = 1; i < N; i++) flux[i] = G[i] * (T[i - 1] - T[i]);
    flux[N] = G[N] * (T[N - 1] - ti);
    for (let i = 0; i < N; i++) T[i] += (dt * (flux[i] - flux[i + 1])) / C[i];
    if (t >= (days - 2) * P && s % sampleEvery === 0) out.push([(t - (days - 2) * P) / 3600, tout(t), flux[N]]);
  }
  const R = RSI + RSE + layers.reduce((a, l) => a + layerR(l.m, l.mm), 0);
  const U = 1 / R;
  const kappa = layers.reduce((a, l) => a + (MAT[l.m].rho * MAT[l.m].c * l.mm) / 1000, 0) / 1000; // kJ/(m²K)
  const day = out.filter(([h]) => h >= 24);
  const qmax = day.reduce((a, p) => (p[2] > a[2] ? p : a));
  const qmin = day.reduce((a, p) => (p[2] < a[2] ? p : a));
  const f = amp > 0 ? (qmax[2] - qmin[2]) / 2 / (U * amp) : 0;
  const lag = ((((qmax[0] - 24) - 15) % 24) + 24) % 24;
  return { out, U, f, lag, qmax: qmax[2], kappa };
}

for (const root of document.querySelectorAll("[data-bldg-mass]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let wall = "concrete";
  onSeg(root, (_, v) => { wall = v; s.d.set(MASS_WALLS[v].d, false); draw(); });
  function draw() {
    const w = MASS_WALLS[wall];
    const layers = w.layers.map(([m, mm, main]) => ({ m, mm: main ? s.d.get() : mm }));
    const mean = s.mean.get(), amp = s.amp.get();
    const r = massResponse(layers, mean, amp);
    svg.replaceChildren();
    const tlo = Math.floor((mean - amp - 2) / 5) * 5, thi = Math.ceil((mean + amp + 2) / 5) * 5;
    const tt = [];
    for (let v = tlo; v <= thi; v += thi - tlo > 30 ? 10 : 5) tt.push(v);
    const ft = frame(svg, { box: [52, 20, 560, 110], x: [0, 48], y: [tlo, thi], xticks: [0, 6, 12, 18, 24, 30, 36, 42, 48], yticks: tt, yfmt: (v) => num(v, 0), ylabel: "outside (°C)" });
    polyline(svg, r.out.map(([h, t]) => [ft.sx(h), ft.sy(t)]), "stroke:var(--vec-u);stroke-width:1.6");
    hline(svg, ft, 20, "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:3 3");
    text(svg, ft.L + 4, ft.sy(20) - 4, "room 20 °C", { "text-anchor": "start" });
    const ref = r.out.map(([h, t]) => [h, r.U * (t - 20)]);
    const all = [...r.out.map((p) => p[2]), ...ref.map((p) => p[1])];
    let qlo = Math.min(...all), qhi = Math.max(...all);
    const span = Math.max(1, qhi - qlo);
    qlo -= span * 0.08; qhi += span * 0.08;
    const qstep = niceTicks(span)[1] || 1;
    const qt = [];
    for (let v = Math.ceil(qlo / qstep) * qstep; v <= qhi; v += qstep) qt.push(+v.toFixed(6));
    const fq = frame(svg, { box: [52, 180, 560, 110], x: [0, 48], y: [qlo, qhi], xticks: [0, 6, 12, 18, 24, 30, 36, 42, 48], yticks: qt, yfmt: (v) => num(v, qstep < 1 ? 1 : 0), xlabel: "hours (two days of the repeating cycle)", ylabel: "into the room (W/m²)" });
    if (qlo < 0 && qhi > 0) hline(svg, fq, 0, "stroke:currentColor;stroke-opacity:.3");
    polyline(svg, ref.map(([h, q]) => [fq.sx(h), fq.sy(q)]), "stroke:var(--vec-out);stroke-width:1.2;stroke-dasharray:4 3");
    polyline(svg, r.out.map(([h, , q]) => [fq.sx(h), fq.sy(q)]), `stroke:${BRAND};stroke-width:2`);
    // Lag arrow from the second day's outdoor peak (15:00 → h 39) to the flux peak.
    const tp = 39, qp = tp + r.lag;
    const qAt = (h) => r.out.reduce((a, p) => (Math.abs(p[0] - h) < Math.abs(a[0] - h) ? p : a))[2];
    const hq = qp > 48 ? qp - 24 : qp;
    const hs = hq - r.lag;
    el("line", { x1: ft.sx(hs), x2: ft.sx(hs), y1: ft.sy(mean + amp), y2: fq.sy(qAt(hq)), style: "stroke:var(--vec-u);stroke-opacity:.5;stroke-dasharray:2 3" }, svg);
    el("line", { x1: fq.sx(hq), x2: fq.sx(hq), y1: fq.T, y2: fq.sy(qAt(hq)), style: `stroke:${BRAND};stroke-opacity:.6;stroke-dasharray:2 3` }, svg);
    const ya = fq.T - 10;
    el("line", { x1: fq.sx(hs), x2: fq.sx(hq), y1: ya, y2: ya, style: "stroke:currentColor;stroke-width:1" }, svg);
    el("path", { d: `M${fq.sx(hq)} ${ya}l-5 -3v6z`, style: "fill:currentColor" }, svg);
    text(svg, (fq.sx(hs) + fq.sx(hq)) / 2, ya - 5, `lag ${num(r.lag, 1)} h`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    o.u.textContent = `${num(r.U, 2)} W/m²K`;
    o.f.textContent = num(r.f, 2);
    o.lag.textContent = `${num(r.lag, 1)} h`;
    o.peak.textContent = `${num(r.qmax, 1)} W/m² (no mass: ${num(r.U * amp + r.U * (mean - 20), 1)})`;
    o.k.textContent = `${thou(r.kappa)} kJ/m²K`;
  }
  draw();
}

// ============================================================ B6 sun

const MONTH_DAY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const decl = (n) => 23.45 * Math.sin((2 * Math.PI * (284 + n)) / 365);
/** Sun altitude and azimuth (degrees from south, west positive). */
export function sunAt(lat, dec, hour) {
  const H = 15 * (hour - 12) * RAD, phi = lat * RAD, d = dec * RAD;
  const sa = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  const alt = Math.asin(clamp(sa, -1, 1));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi));
  return { alt: alt / RAD, az: az / RAD };
}
function shadeOf(sun, face, od, gap, hw) {
  const g = (sun.az - face) * RAD;
  if (sun.alt <= 0 || Math.cos(g) <= 0.001) return null;
  const tanP = Math.tan(sun.alt * RAD) / Math.cos(g);
  return { s: clamp((od * tanP - gap) / hw, 0, 1), w: Math.cos(sun.alt * RAD) * Math.cos(g), prof: Math.atan(tanP) / RAD };
}

for (const root of document.querySelectorAll("[data-bldg-sun]")) {
  const pathSvg = root.querySelector("[data-path]");
  const secSvg = root.querySelector("[data-section]");
  const bars = root.querySelector("[data-bars]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  function draw() {
    const lat = s.lat.get(), face = s.face.get(), mo = s.month.get() - 1;
    const od = s.od.get(), gap = s.gap.get(), hw = s.hw.get();
    pathSvg.replaceChildren();
    const f = frame(pathSvg, { box: [40, 30, 344, 224], x: [-150, 150], y: [0, 90], xticks: [-120, -90, -60, -30, 0, 30, 60, 90, 120], yticks: [0, 15, 30, 45, 60, 75, 90], xfmt: (v) => ({ "-90": "E", 0: "S", 90: "W" })[v] ?? `${v}°`, yfmt: (v) => `${v}°`, xlabel: "azimuth", ylabel: "altitude" });
    // Wall plane: the window sees the half-space within ±90° of its face.
    const x0 = f.sx(clamp(face - 90, -150, 150)), x1 = f.sx(clamp(face + 90, -150, 150));
    el("rect", { x: x0, y: f.T, width: x1 - x0, height: f.H, style: "fill:var(--vec-u);fill-opacity:.05" }, pathSvg);
    text(pathSvg, (x0 + x1) / 2, f.T + 12, "in front of the window", { "text-anchor": "middle" });
    const shades = [];
    for (let m = 0; m < 12; m++) {
      const dec = decl(MONTH_DAY[m] + 21);
      const pts = [];
      let num_ = 0, den = 0;
      for (let hh = 0; hh <= 24; hh += 0.1) {
        const sun = sunAt(lat, dec, hh);
        if (sun.alt > 0 && Math.abs(sun.az) <= 150) pts.push([f.sx(sun.az), f.sy(sun.alt)]);
        const sh = shadeOf(sun, face, od, gap, hw);
        if (sh) { num_ += sh.s * sh.w; den += sh.w; }
      }
      shades.push(den > 0 ? num_ / den : null);
      if (m > 5 && m !== mo) continue; // months 7–12 retrace 1–6
      if (pts.length > 1) polyline(pathSvg, pts, m === mo ? `stroke:${BRAND};stroke-width:2` : "stroke:currentColor;stroke-opacity:.25;stroke-width:1");
    }
    const dec = decl(MONTH_DAY[mo] + 21);
    for (let hh = 6; hh <= 18; hh++) {
      const sun = sunAt(lat, dec, hh);
      if (sun.alt <= 0 || Math.abs(sun.az) > 150) continue;
      el("circle", { cx: f.sx(sun.az), cy: f.sy(sun.alt), r: 2.4, style: `fill:${BRAND}` }, pathSvg);
      if (hh % 3 === 0) text(pathSvg, f.sx(sun.az), f.sy(sun.alt) - 6, `${hh}h`, { "text-anchor": "middle" });
    }
    text(pathSvg, f.L + f.W, f.T - 4, `21 ${MONTHS[mo]} in pink, other months grey`, { "text-anchor": "end" });

    // Section: window wall on the right, outside to the left.
    secSvg.replaceChildren();
    const sc = 56, wx = 190, ground = 270, sill = 0.9;
    const yOf = (m) => ground - m * sc;
    const top = sill + hw, ohY = top + gap;
    el("rect", { x: wx, y: yOf(ohY + 0.6), width: 18, height: (ohY + 0.6) * sc, style: "fill:currentColor;fill-opacity:.18;stroke:currentColor;stroke-opacity:.4" }, secSvg);
    el("rect", { x: wx, y: yOf(top), width: 18, height: hw * sc, style: "fill:var(--vec-u);fill-opacity:.25;stroke:currentColor;stroke-opacity:.5" }, secSvg);
    el("rect", { x: wx - od * sc, y: yOf(ohY) - 6, width: od * sc + 18, height: 6, style: "fill:currentColor;fill-opacity:.55" }, secSvg);
    el("line", { x1: 0, x2: 260, y1: ground, y2: ground, style: "stroke:currentColor;stroke-opacity:.4" }, secSvg);
    const noon = sunAt(lat, dec, 12);
    const sh = shadeOf(noon, face, od, gap, hw);
    if (sh) {
      const tp = Math.tan(sh.prof * RAD);
      const yHit = ohY - od * tp;
      const shadedTo = Math.max(sill, Math.min(top, yHit));
      if (sh.s > 0) el("rect", { x: wx, y: yOf(top), width: 18, height: (top - shadedTo) * sc, style: "fill:currentColor;fill-opacity:.45" }, secSvg);
      // The ray that grazes the overhang tip.
      const tipX = wx - od * sc, tipY = yOf(ohY) - 6;
      const L2 = Math.min(220, (tipY - 30) / Math.max(0.05, Math.sin(sh.prof * RAD)));
      const dx = -Math.cos(sh.prof * RAD), dy = -Math.sin(sh.prof * RAD);
      el("line", { x1: tipX + dx * L2, y1: tipY + dy * L2, x2: wx, y2: tipY + (wx - tipX) * Math.tan(sh.prof * RAD), style: `stroke:${BRAND};stroke-width:1.4` }, secSvg);
      text(secSvg, 8, 18, `noon profile angle ${num(sh.prof, 1)}°`, { "text-anchor": "start" });
    } else text(secSvg, 8, 18, "no direct sun on the window at noon", { "text-anchor": "start" });
    text(secSvg, wx + 9, ground + 14, "wall", { "text-anchor": "middle" });
    text(secSvg, wx - od * sc / 2, yOf(ohY) - 10, `${num(od, 2)} m`, { "text-anchor": "middle" });

    // Bars by month.
    bars.replaceChildren();
    const fb = frame(bars, { box: [40, 10, 600, 100], x: [0, 12], y: [0, 1], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%` });
    shades.forEach((v, m) => {
      const x = fb.sx(m + 0.15), w = fb.sx(m + 0.85) - x;
      if (v !== null) el("rect", { x, y: fb.sy(v), width: w, height: Math.max(0.5, fb.sy(0) - fb.sy(v)), rx: 2, style: `fill:${m === mo ? BRAND : "currentColor"};fill-opacity:${m === mo ? 0.8 : 0.3}` }, bars);
      text(bars, x + w / 2, fb.T + fb.H + 14, MONTHS[m], { "text-anchor": "middle", ...(m === mo ? { class: "fill-foreground font-mono text-[10px]" } : {}) });
    });
    text(bars, fb.L, fb.T + fb.H + 30, "share of the direct sun on the window that the overhang blocks, over each 21st", { "text-anchor": "start" });

    o.alt.textContent = `${num(sunAt(lat, dec, 12).alt, 1)}°`;
    const cosH = -Math.tan(lat * RAD) * Math.tan(dec * RAD);
    o.len.textContent = cosH <= -1 ? "24 h" : cosH >= 1 ? "0 h" : `${num((2 * Math.acos(cosH)) / RAD / 15, 1)} h`;
    o.noon.textContent = sh ? `${Math.round(sh.s * 100)} %` : "no sun";
    o.jd.textContent = `${shades[5] === null ? "—" : Math.round(shades[5] * 100) + " %"} / ${shades[11] === null ? "—" : Math.round(shades[11] * 100) + " %"}`;
  }
  draw();
}

// ============================================================ B7 daylight

/** BRE average daylight factor, in percent. */
export const adf = ({ t, aw, theta, m, a, r }) => (t * aw * theta * m) / (a * (1 - r * r));

for (const root of document.querySelectorAll("[data-bldg-day]")) {
  const svg = root.querySelector("[data-plot]");
  const sec = root.querySelector("[data-section]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  function draw() {
    const W = s.w.get(), D = s.dp.get(), H = s.ht.get();
    const A = 2 * (W * D + W * H + D * H);
    const theta = 90 - s.obs.get();
    const base = { t: s.t.get(), theta, m: s.m.get(), a: A, r: s.r.get() };
    const aw = Math.min(s.aw.get(), W * H);
    const df = adf({ ...base, aw });
    const xmax = Math.min(W * H, Math.max(6, Math.ceil(aw * 1.6)));
    const ymax = Math.max(6, Math.ceil(adf({ ...base, aw: xmax }) + 1));
    svg.replaceChildren();
    const yt = [];
    for (let v = 0; v <= ymax; v += ymax > 12 ? 4 : 2) yt.push(v);
    const f = frame(svg, { box: [40, 32, 340, 224], x: [0, xmax], y: [0, ymax], xticks: niceTicks(xmax), yticks: yt, xfmt: (v) => num(v, xmax < 5 ? 1 : 0), yfmt: (v) => `${v}%`, xlabel: "glazed area (m²)", ylabel: "average DF" });
    el("rect", { x: f.L, y: f.sy(Math.min(ymax, 5)), width: f.W, height: f.sy(2) - f.sy(Math.min(ymax, 5)), style: `fill:${BRAND};fill-opacity:.06` }, svg);
    hline(svg, f, 2, "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:3 3", "2 % daylit");
    if (ymax > 5) hline(svg, f, 5, "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:3 3", "5 % well daylit");
    const pts = [];
    for (let x = 0; x <= xmax; x += xmax / 100) pts.push([f.sx(x), f.sy(adf({ ...base, aw: x }))]);
    polyline(svg, pts, `stroke:${BRAND};stroke-width:2`);
    el("circle", { cx: f.sx(aw), cy: f.sy(df), r: 4.5, style: `fill:${BRAND}` }, svg);
    text(svg, f.sx(aw) + 8, f.sy(df) + 14, `${num(df, 1)} %`, { "text-anchor": "start", class: "fill-foreground font-mono text-[11px]" });

    // Section: window on the left wall, the obstruction across the street.
    sec.replaceChildren();
    const sc = Math.min(160 / D, 150 / H, 40);
    const x0 = 100, gy = 250;
    const wy = (m) => gy - m * sc;
    el("rect", { x: x0, y: wy(H), width: D * sc, height: H * sc, style: "fill:currentColor;fill-opacity:.04;stroke:currentColor;stroke-opacity:.45" }, sec);
    const winH = Math.min(H - 0.3, Math.max(0.4, aw / W));
    const sill = Math.max(0.1, Math.min(0.9, H - 0.3 - winH));
    el("line", { x1: x0, x2: x0, y1: wy(sill + winH), y2: wy(sill), style: "stroke:var(--vec-u);stroke-width:4" }, sec);
    const cy = wy(sill + winH / 2);
    const ang = s.obs.get() * RAD;
    const obX = 18, obTopY = cy - Math.tan(ang) * (x0 - obX);
    el("rect", { x: 4, y: Math.max(12, obTopY), width: obX - 4, height: gy - Math.max(12, obTopY), style: "fill:currentColor;fill-opacity:.25" }, sec);
    el("line", { x1: x0, y1: cy, x2: obX, y2: obTopY, style: "stroke:currentColor;stroke-opacity:.5;stroke-dasharray:3 3" }, sec);
    // θ: from the obstruction line up to the zenith.
    const r = 38;
    const a0 = Math.PI + ang;
    const a1 = 1.5 * Math.PI;
    el("path", { d: `M${x0 + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}A${r} ${r} 0 0 1 ${x0 + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`, style: `fill:none;stroke:${BRAND};stroke-width:1.6` }, sec);
    el("line", { x1: x0, y1: cy, x2: x0, y2: cy - r - 6, style: "stroke:currentColor;stroke-opacity:.3" }, sec);
    text(sec, x0 - r * 0.9, cy - r * 0.9, `θ ${num(theta, 0)}°`, { "text-anchor": "end", style: `fill:${BRAND}` });
    el("line", { x1: 0, x2: 260, y1: gy, y2: gy, style: "stroke:currentColor;stroke-opacity:.4" }, sec);
    text(sec, x0 + (D * sc) / 2, gy + 14, `room ${num(D, 1)} m deep`, { "text-anchor": "middle" });
    text(sec, 4, gy + 14, "obstruction", { "text-anchor": "start" });

    o.theta.textContent = `${num(theta, 0)}°`;
    o.a.textContent = `${num(A, 1)} m²`;
    o.df.textContent = `${num(df, 2)} %`;
    o.verdict.textContent = df >= 5 ? "well daylit" : df >= 2 ? "daylit" : "gloomy: lights on by day";
    const need = (2 * A * (1 - base.r ** 2)) / (base.t * theta * base.m);
    o.need.textContent = need > W * H ? "more than the whole wall" : `${num(need, 1)} m²`;
    if (s.aw.get() > W * H) o.df.textContent += " (glass capped at the wall)";
  }
  draw();
}

// ============================================================ B8 CO2

/** Exact piecewise solution: phases of { min, G (m³/s), Q (m³/s) }. */
export function co2Run({ V, out, phases }) {
  let C = out, t0 = 0;
  const pts = [[0, C]];
  for (const ph of phases) {
    const ss = out + (ph.Q > 0 ? (ph.G * 1e6) / ph.Q : Infinity);
    const tau = ph.Q > 0 ? V / ph.Q : Infinity;
    for (let s = 1; s <= ph.min; s++) {
      const t = s * 60;
      const c = Number.isFinite(tau) ? ss + (C - ss) * Math.exp(-t / tau) : C + (ph.G * 1e6 * t) / V;
      pts.push([t0 + s, c]);
    }
    C = pts[pts.length - 1][1];
    t0 += ph.min;
  }
  return pts;
}

for (const root of document.querySelectorAll("[data-bldg-co2]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  function draw() {
    const np = s.np.get(), V = s.v.get(), out = s.out.get();
    const G = (np * s.g.get()) / 1000;
    const Q = (np * s.qp.get()) / 1000;
    const Qb = (s.qb.get() * V) / 3600;
    const lesson = { min: 50, G, Q }, brk = { min: 10, G: 0, Q: Qb };
    const pts = co2Run({ V, out, phases: [lesson, brk, lesson, brk, lesson] });
    const ss = out + (G * 1e6) / Q;
    const ymax = Math.max(2000, Math.ceil(Math.max(ss, ...pts.map((p) => p[1])) / 500) * 500 + 250);
    svg.replaceChildren();
    const yt = [];
    for (let v = 0; v <= ymax; v += ymax > 4000 ? 1000 : 500) yt.push(v);
    const f = frame(svg, { box: [52, 32, 560, 218], x: [0, 170], y: [0, ymax], xticks: [0, 30, 60, 90, 120, 150, 170], yticks: yt, yfmt: thou, xlabel: "minutes", ylabel: "CO₂ (ppm)" });
    [[50, 60], [110, 120]].forEach(([a, b]) => {
      el("rect", { x: f.sx(a), y: f.T, width: f.sx(b) - f.sx(a), height: f.H, style: "fill:var(--vec-u);fill-opacity:.08" }, svg);
      text(svg, (f.sx(a) + f.sx(b)) / 2, f.T + 12, "break", { "text-anchor": "middle" });
    });
    hline(svg, f, 1500, "stroke:var(--code-del);stroke-opacity:.6;stroke-dasharray:4 3", "1500 ppm");
    hline(svg, f, 1000, "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:4 3", "1000 ppm");
    if (ss < ymax) hline(svg, f, ss, "stroke:var(--vec-out);stroke-width:1.2;stroke-dasharray:2 3");
    hline(svg, f, out, "stroke:currentColor;stroke-opacity:.2", "outdoor");
    polyline(svg, pts.map(([t, c]) => [f.sx(t), f.sy(c)]), `stroke:${BRAND};stroke-width:2`);
    const end1 = pts[50][1];
    el("circle", { cx: f.sx(50), cy: f.sy(end1), r: 3.5, style: `fill:${BRAND}` }, svg);
    o.q.textContent = `${num(Q * 1000, 0)} L/s`;
    o.ach.textContent = `${num((Q * 3600) / V, 1)} /h`;
    o.ss.textContent = `${thou(ss)} ppm`;
    o.end.textContent = `${thou(end1)} ppm`;
    const tau = V / Q;
    o.t1500.textContent = ss <= 1500 ? "never in a lesson" : `${num((-tau * Math.log(1 - (1500 - out) / (ss - out))) / 60, 0)} min`;
  }
  draw();
}

// ============================================================ B9 PMV

/** ISO 7730 PMV and PPD (external work zero). */
export function pmv({ ta, tr, va, rh, met, clo }) {
  const pa = rh * 10 * Math.exp(16.6536 - 4030.183 / (ta + 235));
  const icl = 0.155 * clo, m = met * 58.15, mw = m;
  const fcl = icl <= 0.078 ? 1 + 1.29 * icl : 1.05 + 0.645 * icl;
  const hcf = 12.1 * Math.sqrt(va);
  const taa = ta + 273, tra = tr + 273;
  const tcla = taa + (35.5 - ta) / (3.5 * icl + 0.1);
  const p1 = icl * fcl, p2 = p1 * 3.96, p3 = p1 * 100, p4 = p1 * taa;
  const p5 = 308.7 - 0.028 * mw + p2 * (tra / 100) ** 4;
  let xn = tcla / 100, xf = tcla / 50, hc = hcf, n = 0;
  while (Math.abs(xn - xf) > 0.00015 && n++ < 150) {
    xf = (xf + xn) / 2;
    const hcn = 2.38 * Math.abs(100 * xf - taa) ** 0.25;
    hc = Math.max(hcf, hcn);
    xn = (p5 + p4 * hc - p2 * xf ** 4) / (100 + p3 * hc);
  }
  const tcl = 100 * xn - 273;
  const hl1 = 3.05e-3 * (5733 - 6.99 * mw - pa);
  const hl2 = mw > 58.15 ? 0.42 * (mw - 58.15) : 0;
  const hl3 = 1.7e-5 * m * (5867 - pa);
  const hl4 = 0.0014 * m * (34 - ta);
  const hl5 = 3.96 * fcl * (xn ** 4 - (tra / 100) ** 4);
  const hl6 = fcl * hc * (tcl - ta);
  const ts = 0.303 * Math.exp(-0.036 * m) + 0.028;
  const v = ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6);
  return { pmv: v, ppd: 100 - 95 * Math.exp(-0.03353 * v ** 4 - 0.2179 * v ** 2), tcl };
}
const COMFORT = {
  office: { met: 1.2, clo: 0.5, ta: 25.5, tr: 25.5, va: 0.1, rh: 50 },
  winter: { met: 1.2, clo: 1.0, ta: 21, tr: 20, va: 0.1, rh: 40 },
  walk: { met: 2.0, clo: 0.7, ta: 20, tr: 20, va: 0.2, rh: 50 },
};
for (const root of document.querySelectorAll("[data-bldg-pmv]")) {
  const ppdSvg = root.querySelector("[data-ppd]");
  const band = root.querySelector("[data-band]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { for (const [k, x] of Object.entries(COMFORT[v])) s[k].set(x, false); draw(); });
  function draw() {
    const inp = { ta: s.ta.get(), tr: s.tr.get(), va: s.va.get(), rh: s.rh.get(), met: s.met.get(), clo: s.clo.get() };
    const r = pmv(inp);
    const pv = clamp(r.pmv, -3, 3);
    ppdSvg.replaceChildren();
    const f = frame(ppdSvg, { box: [40, 30, 264, 186], x: [-3, 3], y: [0, 100], xticks: [-3, -2, -1, 0, 1, 2, 3], yticks: [0, 25, 50, 75, 100], yfmt: (v) => `${v}%`, xfmt: (v) => num(v, 0), xlabel: "PMV", ylabel: "PPD" });
    [[0.7, 0.07], [0.5, 0.08], [0.2, 0.12]].forEach(([w, a]) => el("rect", { x: f.sx(-w), y: f.T, width: f.sx(w) - f.sx(-w), height: f.H, style: `fill:${BRAND};fill-opacity:${a}` }, ppdSvg));
    const pts = [];
    for (let x = -3; x <= 3.001; x += 0.05) pts.push([f.sx(x), f.sy(100 - 95 * Math.exp(-0.03353 * x ** 4 - 0.2179 * x ** 2))]);
    polyline(ppdSvg, pts, "stroke:currentColor;stroke-opacity:.6;stroke-width:1.4");
    el("circle", { cx: f.sx(pv), cy: f.sy(Math.min(100, r.ppd)), r: 4.5, style: `fill:${BRAND}` }, ppdSvg);
    ["cold", "cool", "slightly cool", "neutral", "slightly warm", "warm", "hot"].forEach((w, i) => {
      if (i % 3 === 0) text(ppdSvg, f.sx(i - 3), f.T + f.H + 40, w, { "text-anchor": i === 0 ? "start" : i === 6 ? "end" : "middle" });
    });
    // PMV against air temperature, radiant temperature tracking it.
    band.replaceChildren();
    const off = inp.tr - inp.ta;
    const fb = frame(band, { box: [40, 30, 264, 186], x: [12, 34], y: [-3, 3], xticks: [12, 16, 20, 24, 28, 32], yticks: [-3, -2, -1, 0, 1, 2, 3], yfmt: (v) => num(v, 0), xlabel: "air temperature (°C)", ylabel: "PMV" });
    el("rect", { x: fb.L, y: fb.sy(0.5), width: fb.W, height: fb.sy(-0.5) - fb.sy(0.5), style: `fill:${BRAND};fill-opacity:.1` }, band);
    text(band, fb.L + 4, fb.sy(0.5) - 4, "category B", { "text-anchor": "start" });
    const line = [];
    for (let t = 12; t <= 34.001; t += 0.25) line.push([fb.sx(t), fb.sy(clamp(pmv({ ...inp, ta: t, tr: t + off }).pmv, -3, 3))]);
    polyline(band, line, `stroke:${BRAND};stroke-width:2`);
    el("circle", { cx: fb.sx(clamp(inp.ta, 12, 34)), cy: fb.sy(pv), r: 4.5, style: `fill:${BRAND}` }, band);
    // Neutral temperature by bisection.
    let a = 0, b = 45;
    const g = (t) => pmv({ ...inp, ta: t, tr: t + off }).pmv;
    let neutral = null;
    if (g(a) < 0 && g(b) > 0) {
      for (let i = 0; i < 50; i++) { const c = (a + b) / 2; if (g(c) < 0) a = c; else b = c; }
      neutral = (a + b) / 2;
    }
    o.pmv.textContent = `${r.pmv >= 0 ? "+" : ""}${num(r.pmv, 2)}`;
    o.ppd.textContent = `${num(r.ppd, 1)} %`;
    const ab = Math.abs(r.pmv);
    o.cat.textContent = ab < 0.2 ? "A" : ab < 0.5 ? "B" : ab < 0.7 ? "C" : "outside C";
    o.tcl.textContent = `${num(r.tcl, 1)} °C`;
    o.neutral.textContent = neutral === null ? "—" : `${num(neutral, 1)} °C`;
  }
  draw();
}

// ============================================================ B10 sound

const SOUND = {
  gypsum: { rho: 690, E: 2.5e9, nu: 0.3, t: 12.5 },
  glass: { rho: 2500, E: 7.0e10, nu: 0.22, t: 6 },
  concrete: { rho: 2300, E: 3.0e10, nu: 0.2, t: 150 },
};
const C0 = 343;
const THIRDS = [50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000];
const REF717 = [33, 36, 39, 42, 45, 48, 51, 52, 53, 54, 55, 56, 56, 56, 56, 56]; // 100–3150 Hz
const massLaw = (m, f) => 20 * Math.log10(m * f) - 47;
export function fcOf(mat, h) {
  const B = (mat.E * h ** 3) / (12 * (1 - mat.nu ** 2));
  return ((C0 * C0) / (2 * Math.PI)) * Math.sqrt((mat.rho * h) / B);
}
/** Single panel: mass law, then Cremer above coincidence (η = 0.02). */
export function rSingle(m, fc, f) {
  const cremer = (x) => 20 * Math.log10(m * x) - 42 + 10 * Math.log10((2 * 0.02 * x) / (Math.PI * fc));
  if (f < fc / 2) return massLaw(m, f);
  if (f >= fc) return cremer(f);
  const u = Math.log(f / (fc / 2)) / Math.log(2);
  return (1 - u) * massLaw(m, fc / 2) + u * cremer(fc);
}
/** Sharp's double wall with an absorbent cavity of depth d (m). */
export function rDouble(m1, fc1, m2, fc2, d, f) {
  const f0 = 60 * Math.sqrt((m1 + m2) / (m1 * m2 * d));
  const fl = 55 / d;
  if (f < f0) return massLaw(m1 + m2, f);
  const r1 = rSingle(m1, fc1, f), r2 = rSingle(m2, fc2, f);
  return f < fl ? r1 + r2 + 20 * Math.log10(f * d) - 29 : r1 + r2 + 6;
}
/** ISO 717-1 weighted sound reduction index from 16 thirds 100–3150 Hz. */
export function rw(R) {
  let shift = -60;
  while (shift < 60) {
    const bad = REF717.reduce((a, ref, i) => a + Math.max(0, ref + shift + 1 - R[i]), 0);
    if (bad > 32) break;
    shift++;
  }
  return { rw: 52 + shift, shift };
}

for (const root of document.querySelectorAll("[data-bldg-sound]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let type = "single", mat = "gypsum";
  onSeg(root, (label, v) => {
    if (label === "Type") type = v;
    else { mat = v; s.t1.set(SOUND[v].t, false); s.t2.set(SOUND[v].t, false); }
    draw();
  });
  function draw() {
    const M = SOUND[mat];
    const h1 = s.t1.get() / 1000, h2 = s.t2.get() / 1000, d = s.gap.get() / 1000;
    const m1 = M.rho * h1, m2 = M.rho * h2;
    const fc1 = fcOf(M, h1), fc2 = fcOf(M, h2);
    const dbl = type === "double";
    for (const name of ["t2", "gap"]) {
      const input = root.querySelector(`[data-scrub="${name}"]`);
      input.disabled = !dbl;
      input.closest("label").style.opacity = dbl ? "" : "0.45";
    }
    const R = (f) => (dbl ? rDouble(m1, fc1, m2, fc2, d, f) : rSingle(m1, fc1, f));
    const mt = dbl ? m1 + m2 : m1;
    svg.replaceChildren();
    const f = frame(svg, { box: [48, 32, 560, 238], x: [Math.log10(50), Math.log10(5000)], y: [0, 90], xticks: [63, 125, 250, 500, 1000, 2000, 4000].map(Math.log10), yticks: [0, 15, 30, 45, 60, 75, 90], xfmt: (v) => { const hz = Math.round(10 ** v); return hz >= 1000 ? `${hz / 1000}k` : String(hz); }, xlabel: "frequency (Hz)", ylabel: "R (dB)" });
    const curve = [], ml = [];
    for (let lf = Math.log10(50); lf <= Math.log10(5000) + 1e-9; lf += 0.01) {
      curve.push([f.sx(lf), f.sy(clamp(R(10 ** lf), 0, 90))]);
      ml.push([f.sx(lf), f.sy(clamp(massLaw(mt, 10 ** lf), 0, 90))]);
    }
    polyline(svg, ml, "stroke:var(--vec-out);stroke-width:1.2;stroke-dasharray:4 3");
    polyline(svg, curve, `stroke:${BRAND};stroke-width:2`);
    const bandsR = THIRDS.slice(3, 19).map((hz) => Math.round(R(hz) * 10) / 10);
    const w = rw(bandsR);
    polyline(svg, THIRDS.slice(3, 19).map((hz, i) => [f.sx(Math.log10(hz)), f.sy(clamp(REF717[i] + w.shift, 0, 90))]), "stroke:var(--vec-u);stroke-width:1.2");
    THIRDS.slice(3, 19).forEach((hz, i) => el("circle", { cx: f.sx(Math.log10(hz)), cy: f.sy(clamp(bandsR[i], 0, 90)), r: 2, style: `fill:${BRAND}` }, svg));
    const mark = (hz, label) => {
      if (hz < 50 || hz > 5000) return;
      el("line", { x1: f.sx(Math.log10(hz)), x2: f.sx(Math.log10(hz)), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:2 3" }, svg);
      text(svg, f.sx(Math.log10(hz)) + 3, f.T + 10, label, { "text-anchor": "start" });
    };
    mark(fc1, "fc");
    const f0 = 60 * Math.sqrt((m1 + m2) / (m1 * m2 * d));
    if (dbl) mark(f0, "f₀");
    o.m.textContent = `${num(mt, 1)} kg/m²`;
    o.fc.textContent = `${thou(fc1)} Hz`;
    o.f0.textContent = dbl ? `${thou(f0)} Hz` : "—";
    o.rw.textContent = `${w.rw} dB`;
  }
  draw();
}
