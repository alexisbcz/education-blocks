// Nutrition science blocks. Each one is a small published model (prediction
// equations, Atwater factors, glycemic load, amino acid scoring, the EAR
// cut-point method, Mantel–Haenszel) with rounded typical food values; the
// approximations are stated in each block. Nothing here is dietary advice.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const set = (o, k, v) => { if (o[k]) o[k].textContent = v; };
const group = (e) => e.target.closest("[data-group]")?.dataset.group;
const int = (v) => Math.round(v).toLocaleString("en-US");
const pct = (v, d = 1) => `${num(v * 100, d)} %`;

// Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7).
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Round tick spacing for an axis from 0 (or lo) to hi.
function ticks(lo, hi, n = 4) {
  const span = hi - lo, raw = span / n, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// Counter rows ([data-food] with ± [data-step] buttons). Returns the counts.
function counters(root, onChange) {
  const rows = [...root.querySelectorAll("li[data-food]")];
  const counts = Object.fromEntries(rows.map((r) => [r.dataset.food, 0]));
  const show = () => rows.forEach((r) => {
    r.querySelector("[data-count]").textContent = counts[r.dataset.food];
    r.classList.toggle("border-brand", counts[r.dataset.food] > 0);
  });
  for (const r of rows) {
    r.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
      counts[r.dataset.food] = Math.max(0, Math.min(9, counts[r.dataset.food] + Number(b.dataset.step)));
      show();
      onChange();
    }));
  }
  return {
    rows, counts, show,
    load(m) { for (const k in counts) counts[k] = m[k] ?? 0; show(); },
  };
}

// ============================================================ Energy expenditure

const msj = (sex, w, hgt, a) => 10 * w + 6.25 * hgt - 5 * a + (sex === "m" ? 5 : -161);
const hb = (sex, w, hgt, a) => sex === "m"
  ? 88.362 + 13.397 * w + 4.799 * hgt - 5.677 * a
  : 447.593 + 9.247 * w + 3.098 * hgt - 4.33 * a;

for (const root of document.querySelectorAll("[data-nutri-bmr]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let sex = "m", pal = 1.4;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    const g = group(e);
    if (g === "sex") sex = e.detail.value;
    if (g === "pal") pal = Number(e.detail.value);
    draw();
  });

  function draw() {
    const w = s.w.get(), hgt = s.hgt.get(), age = s.age.get();
    const ages = [];
    for (let a = 18; a <= 90; a += 1) ages.push(a);
    const A = ages.map((a) => msj(sex, w, hgt, a)), B = ages.map((a) => hb(sex, w, hgt, a));
    const lo = Math.min(...A, ...B) * 0.86, hi = Math.max(...A, ...B) * 1.14;
    const yt = ticks(lo, hi, 4);
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 16, 488, 236], x: [18, 90], y: [yt[0] - (yt[1] - yt[0]) * 0.5, yt.at(-1) + (yt[1] - yt[0]) * 0.3], xticks: [20, 30, 40, 50, 60, 70, 80, 90], yticks: yt, xlabel: "age (years)", ylabel: "kcal/day at rest" });
    const band = [...ages.map((a, i) => [f.sx(a), f.sy(A[i] * 1.1)]), ...ages.map((a, i) => [f.sx(a), f.sy(A[i] * 0.9)]).reverse()];
    el("polygon", { points: band.map((p) => p.join(",")).join(" "), style: "fill:var(--brand);fill-opacity:0.1" }, svg);
    polyline(svg, ages.map((a, i) => [f.sx(a), f.sy(B[i])]), "stroke:var(--vec-u);stroke-width:1.75;stroke-dasharray:6 4");
    polyline(svg, ages.map((a, i) => [f.sx(a), f.sy(A[i])]), "stroke:var(--brand);stroke-width:2");
    const m = msj(sex, w, hgt, age), b = hb(sex, w, hgt, age);
    el("line", { x1: f.sx(age), x2: f.sx(age), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(age), cy: f.sy(b), r: 4, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
    el("circle", { cx: f.sx(age), cy: f.sy(m), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, f.L + f.W, f.T + 4, "Mifflin–St Jeor ±10 %", { "text-anchor": "end", style: "fill:var(--brand)" });
    text(svg, f.L + f.W, f.T + 17, "Harris–Benedict (Roza–Shizgal)", { "text-anchor": "end", style: "fill:var(--vec-u)" });

    set(o, "msj", `${int(m)} kcal/day`);
    set(o, "hb", `${int(b)} kcal/day`);
    set(o, "diff", `${b >= m ? "+" : "−"}${int(Math.abs(b - m))} kcal (${num(((b - m) / m) * 100, 1)} %)`);
    set(o, "tdee", `${int(m * pal)} kcal/day at PAL ${num(pal, 1)}`);
    set(o, "band", `${int(m * 0.9)}–${int(m * 1.1)} kcal/day`);
  }
  draw();
}

// ============================================================ Energy balance

const RHO = 7700; // kcal per kg of tissue change
const EPS = 22; // kcal/day of expenditure per kg (10 kcal/day ≈ 1 lb)
const TAU = RHO / EPS; // days

for (const root of document.querySelectorAll("[data-nutri-balance]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { s.de.set(Number(b.dataset.preset), false); draw(); }));

  const stat = (de, t) => (de * t) / RHO;
  const dyn = (de, t) => (de / EPS) * (1 - Math.exp(-t / TAU));

  function draw() {
    const de = s.de.get(), years = s.years.get(), T = years * 365;
    const end = stat(de, T);
    const ext = Math.max(Math.abs(end), Math.abs(de / EPS), 1) * 1.08;
    const y0 = de < 0 ? -ext : -ext * 0.12, y1 = de < 0 ? ext * 0.12 : ext;
    const yt = ticks(y0, y1, 5);
    svg.replaceChildren();
    const xt = [];
    for (let y = 0; y <= years + 1e-9; y += years > 3 ? 1 : 0.5) xt.push(y);
    const f = frame(svg, { box: [52, 16, 488, 236], x: [0, years], y: [y0, y1], xticks: xt, yticks: yt, xlabel: "years", ylabel: "weight change (kg)", yfmt: (v) => num(v, Math.abs(yt[1] - yt[0]) < 1 ? 1 : 0) });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    const plateau = de / EPS;
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(plateau), y2: f.sy(plateau), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 4" }, svg);
    const S = [], D = [];
    for (let i = 0; i <= 200; i++) {
      const t = (T * i) / 200;
      S.push([f.sx(t / 365), f.sy(stat(de, t))]);
      D.push([f.sx(t / 365), f.sy(dyn(de, t))]);
    }
    polyline(svg, S, "stroke:var(--vec-u);stroke-width:1.75;stroke-dasharray:6 4");
    polyline(svg, D, "stroke:var(--brand);stroke-width:2.25");
    const lab = (x, y, s, c, anchor = "end") => text(svg, x, y, s, { "text-anchor": anchor, style: `fill:${c}` });
    const sMid = S[110];
    lab(sMid[0] - 8, sMid[1] + (de < 0 ? 16 : -10), "static 7,700 kcal/kg", "var(--vec-u)");
    lab(f.L + f.W - 4, f.sy(plateau) + (de < 0 ? 14 : -6), `plateau ${num(plateau, 1)} kg`, "var(--brand)");

    const kg = (v) => `${v >= 0 ? "+" : "−"}${num(Math.abs(v), 1)} kg`;
    set(o, "s1", kg(stat(de, 365)));
    set(o, "d1", kg(dyn(de, 365)));
    set(o, "s3", `${kg(end)} at ${num(years, 1)} y`);
    set(o, "d3", `${kg(dyn(de, T))} at ${num(years, 1)} y`);
    set(o, "plateau", kg(plateau));
    set(o, "half", `${Math.round(TAU * Math.LN2)} days`);
  }
  draw();
}

// ============================================================ Atwater

const ATWATER = { fat: 9, carb: 4, protein: 4, alcohol: 7 };
const LABELS = {
  bar: { name: "granola bar, 50 g", fat: 9, carb: 28, fibre: 4, protein: 6, alcohol: 0, stated: 220 },
  beer: { name: "lager, 330 ml", fat: 0, carb: 11, fibre: 0, protein: 1.5, alcohol: 13, stated: 140 },
  yoghurt: { name: "plain yoghurt, 150 g", fat: 5, carb: 7, fibre: 0, protein: 5.5, alcohol: 0, stated: 95 },
};

for (const root of document.querySelectorAll("[data-nutri-atwater]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let fibreK = 2, name = LABELS.bar.name;
  const s = scrubAll(root, () => { draw(); });
  root.addEventListener("seg-change", (e) => { if (group(e) === "fibre") { fibreK = Number(e.detail.value); draw(); } });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = LABELS[b.dataset.preset];
    for (const k of ["fat", "carb", "fibre", "protein", "alcohol", "stated"]) s[k].set(p[k], false);
    name = p.name;
    draw();
  }));

  function draw() {
    const g = Object.fromEntries(["fat", "carb", "fibre", "protein", "alcohol", "stated"].map((k) => [k, s[k].get()]));
    const parts = [
      ["fat", "fat", g.fat * ATWATER.fat, "var(--ion-na)"],
      ["carb", "carbohydrate", g.carb * ATWATER.carb, "var(--vec-u)"],
      ["fibre", "fibre", g.fibre * fibreK, "var(--vec-v)"],
      ["protein", "protein", g.protein * ATWATER.protein, "var(--brand)"],
      ["alcohol", "alcohol", g.alcohol * ATWATER.alcohol, "var(--vec-out)"],
    ];
    const total = parts.reduce((a, p) => a + p[2], 0);
    const max = Math.max(total, g.stated, 10) * 1.08;
    svg.replaceChildren();
    const L = 92, W = 448, sx = (v) => L + (v / max) * W;
    const xt = ticks(0, max, 5);
    for (const t of xt) {
      el("line", { x1: sx(t), x2: sx(t), y1: 14, y2: 112, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, sx(t), 126, String(t), { "text-anchor": "middle" });
    }
    text(svg, L + W, 140, "kcal per serving", { "text-anchor": "end" });
    text(svg, L - 8, 44, "computed", { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    text(svg, L - 8, 92, "stated", { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    let x = 0;
    for (const [, lbl, v, c] of parts) {
      if (v <= 0) continue;
      el("rect", { x: sx(x), y: 24, width: Math.max(0, sx(x + v) - sx(x) - 1), height: 28, rx: 3, style: `fill:${c};fill-opacity:0.8` }, svg);
      const t = `${lbl} ${Math.round(v)}`;
      if (sx(x + v) - sx(x) > t.length * 6.2 + 10) text(svg, sx(x) + 5, 42, t, { class: "font-mono text-[10px]", style: "fill:var(--background)" });
      x += v;
    }
    el("rect", { x: sx(0), y: 74, width: Math.max(0, sx(g.stated) - sx(0)), height: 28, rx: 3, style: "fill:currentColor;fill-opacity:0.18" }, svg);
    el("line", { x1: sx(total), x2: sx(total), y1: 18, y2: 108, style: "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:3 3" }, svg);

    for (const k of ["fat", "carb", "fibre", "protein", "alcohol"]) set(o, `g-${k}`, `${num(g[k], 1)} g`);
    set(o, "name", name);
    set(o, "stated", `${Math.round(g.stated)} kcal`);
    set(o, "computed", `${Math.round(total)} kcal`);
    set(o, "st", `${Math.round(g.stated)} kcal`);
    const gap = total > 0 ? (g.stated - total) / total : 0;
    set(o, "gap", `${g.stated - total >= 0 ? "+" : "−"}${Math.round(Math.abs(g.stated - total))} kcal (${num(gap * 100, 1)} %)`);
    set(o, "fatshare", total > 0 ? pct(parts[0][2] / total, 0) : "—");
  }
  draw();
}

// ============================================================ Glycemic load

const MEALS = {
  breakfast: { flakes: 1, oj: 1, milk: 1 },
  lunch: { lentils: 1, rice: 1 },
  melon: { melon: 1 },
  clear: {},
};

for (const root of document.querySelectorAll("[data-nutri-gl]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const c = counters(root, draw);
  const food = Object.fromEntries(c.rows.map((r) => [r.dataset.food, { name: r.dataset.name, gi: +r.dataset.gi, carbs: +r.dataset.carbs }]));
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    c.load(MEALS[b.dataset.preset]);
    s.n.set(0, false);
    draw();
  }));

  function draw() {
    const items = [];
    for (const [id, n] of Object.entries(c.counts)) if (n > 0) items.push({ name: food[id].name, n, gi: food[id].gi, carbs: food[id].carbs * n });
    const own = { name: "Your food", n: s.n.get(), gi: s.gi.get(), carbs: s.carbs.get() * s.n.get() };
    if (own.n > 0) items.push(own);
    for (const it of items) it.gl = (it.gi * it.carbs) / 100;
    const gl = items.reduce((a, it) => a + it.gl, 0);
    const carb = items.reduce((a, it) => a + it.carbs, 0);

    svg.replaceChildren();
    const rows = [...items, { name: "Meal", total: true, gl }];
    const max = Math.max(25, ...rows.map((r) => r.gl)) * 1.1;
    const L = 150, W = 310, T = 22, rowH = 28;
    const sx = (v) => L + (v / max) * W;
    const bottom = T + rows.length * rowH;
    for (const t of ticks(0, max, 5)) {
      el("line", { x1: sx(t), x2: sx(t), y1: T - 4, y2: bottom, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, sx(t), bottom + 13, String(t), { "text-anchor": "middle" });
    }
    for (const [v, lbl] of [[10, "low ≤ 10"], [20, "high ≥ 20"]]) {
      el("line", { x1: sx(v), x2: sx(v), y1: T - 6, y2: bottom, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
      text(svg, sx(v) + 3, T - 8, lbl);
    }
    text(svg, L + W, bottom + 27, "glycemic load", { "text-anchor": "end" });
    svg.setAttribute("viewBox", `0 0 560 ${bottom + 34}`);
    if (!items.length) text(svg, L + W / 2, T + 30, "Add foods to build a meal", { "text-anchor": "middle", class: "fill-muted-foreground text-xs" });
    rows.forEach((r, i) => {
      const y = T + i * rowH;
      if (r.total && !items.length) return;
      text(svg, L - 8, y + rowH / 2 + 3, r.total ? "Meal" : `${r.name}${r.n > 1 ? ` ×${r.n}` : ""}`, { "text-anchor": "end", class: r.total ? "fill-foreground font-mono text-[11px] font-semibold" : "fill-muted-foreground font-mono text-[10px]" });
      const w = Math.max(1, sx(r.gl) - sx(0));
      el("rect", { x: sx(0), y: y + 4, width: w, height: rowH - 8, rx: 3, style: r.total ? "fill:var(--brand)" : `fill:var(--vec-u);fill-opacity:${0.35 + Math.min(0.55, r.gi / 180)}` }, svg);
      text(svg, sx(r.gl) + 5, y + rowH / 2 + 3, r.total ? num(r.gl, 1) : `${num(r.gl, 1)} · GI ${r.gi}`, { class: "fill-foreground font-mono text-[10px]" });
    });

    set(o, "gl", items.length ? num(gl, 1) : "—");
    set(o, "mgi", carb > 0 ? num(items.reduce((a, it) => a + it.gi * it.carbs, 0) / carb, 0) : "—");
    set(o, "carb", `${num(carb, 0)} g`);
    set(o, "own", `${num((s.gi.get() * s.carbs.get()) / 100, 1)} per serving`);
  }
  draw();
}

// ============================================================ Protein quality

const AA = ["His", "Ile", "Leu", "Lys", "SAA", "AAA", "Thr", "Trp", "Val"];
const AA_REF = [16, 30, 61, 48, 23, 41, 25, 6.6, 40];

for (const root of document.querySelectorAll("[data-nutri-protein]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const foods = Object.fromEntries([...root.querySelector("template[data-foods]").content.children].map((d) => [d.dataset.id, { name: d.dataset.name, dig: +d.dataset.digest, aa: d.dataset.aa.split(",").map(Number) }]));
  let a = "rice", b = "beans";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    if (group(e) === "a") a = e.detail.value;
    if (group(e) === "b") b = e.detail.value;
    draw();
  });

  function draw() {
    const p = s.mix.get() / 100, A = foods[a], B = foods[b];
    const mix = AA.map((_, i) => p * A.aa[i] + (1 - p) * B.aa[i]);
    const ratio = mix.map((v, i) => v / AA_REF[i]);
    const rA = A.aa.map((v, i) => v / AA_REF[i]), rB = B.aa.map((v, i) => v / AA_REF[i]);
    const lim = ratio.indexOf(Math.min(...ratio));
    const aas = ratio[lim];
    const dig = p * A.dig + (1 - p) * B.dig;

    svg.replaceChildren();
    const ymax = Math.max(2, ...ratio, ...rA, ...rB) * 1.05;
    const f = frame(svg, { box: [44, 38, 496, 206], x: [0, AA.length], y: [0, ymax], yticks: ticks(0, ymax, 4), ylabel: "× reference pattern", yfmt: (v) => num(v, 1) });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(1), y2: f.sy(1), style: "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.25" }, svg);
    const bw = f.W / AA.length;
    AA.forEach((name, i) => {
      const x = f.L + i * bw;
      const isLim = i === lim;
      el("rect", { x: x + bw * 0.2, y: f.sy(ratio[i]), width: bw * 0.6, height: f.sy(0) - f.sy(ratio[i]), rx: 3, style: `fill:${isLim ? "var(--code-del)" : "var(--brand)"};fill-opacity:${isLim ? 0.85 : 0.55}` }, svg);
      for (const [r, c] of [[rA[i], "var(--vec-u)"], [rB[i], "var(--vec-v)"]]) {
        el("line", { x1: x + bw * 0.12, x2: x + bw * 0.88, y1: f.sy(r), y2: f.sy(r), style: `stroke:${c};stroke-width:2;stroke-linecap:round` }, svg);
      }
      text(svg, x + bw / 2, f.T + f.H + 14, name, { "text-anchor": "middle", class: isLim ? "fill-foreground font-mono text-[10px] font-semibold" : "fill-muted-foreground font-mono text-[10px]" });
      text(svg, x + bw / 2, f.sy(0) - 6, num(ratio[i], 2), { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
    });
    const lg = el("g", {}, svg);
    const legend = [["var(--brand)", "blend"], ["var(--vec-u)", `A: ${A.name}`], ["var(--vec-v)", `B: ${B.name}`], ["var(--foreground)", "FAO pattern = 1"]];
    legend.forEach(([c, t], i) => {
      el("rect", { x: 46 + i * 124, y: 6, width: 10, height: 3, rx: 1.5, style: `fill:${c}` }, lg);
      text(lg, 60 + i * 124, 11, t);
    });

    set(o, "lim", `${AA[lim]} (${num(mix[lim], 1)} of ${AA_REF[lim]} mg/g)`);
    set(o, "aas", num(aas, 2));
    set(o, "dig", pct(dig, 0));
    set(o, "pdcaas", `${num(Math.min(1, aas * dig), 2)}${aas * dig > 1 ? " (capped)" : ""}`);
  }
  draw();
}

// ============================================================ EAR, RDA, UL

const DRI = {
  vcm: { name: "Vitamin C", ear: 75, rda: 90, ul: 2000, median: 70 },
  vcf: { name: "Vitamin C", ear: 60, rda: 75, ul: 2000, median: 65 },
  zn: { name: "Zinc", ear: 9.4, rda: 11, ul: 40, median: 11 },
};

for (const root of document.querySelectorAll("[data-nutri-micro]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let d = DRI.vcm;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    if (group(e) !== "nutrient") return;
    d = DRI[e.detail.value];
    s.median.set(d.median, false);
    s.you.set(d.rda, false);
    draw();
  });

  function draw() {
    const sd = (d.rda - d.ear) / 2;
    const pInad = (x) => 1 - phi((x - d.ear) / sd);
    const m = s.median.get(), gsd = s.spread.get(), you = s.you.get();
    const sl = Math.log(gsd);
    const dens = (x) => Math.exp(-((Math.log(x / m)) ** 2) / (2 * sl * sl)) / (x * sl * Math.sqrt(2 * Math.PI));

    const lx0 = Math.log10(d.ear / 5), lx1 = Math.log10(d.ul * 2.5);
    const decades = [];
    for (let k = Math.ceil(lx0); k <= Math.floor(lx1); k++) for (const mlt of [1, 2, 5]) { const v = Math.log10(mlt) + k; if (v >= lx0 && v <= lx1) decades.push(v); }
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 36, 496, 214], x: [lx0, lx1], y: [0, 1.08], xticks: decades, yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => String(+(10 ** v).toPrecision(2)), yfmt: (v) => `${v * 100}%`, xlabel: "intake (mg/day, log scale)", ylabel: "probability" });
    el("rect", { x: f.sx(Math.log10(d.ul)), y: f.T, width: f.L + f.W - f.sx(Math.log10(d.ul)), height: f.H, style: "fill:var(--code-del);fill-opacity:0.1" }, svg);
    text(svg, f.L + f.W - 4, f.T + 12, "above UL: risk of harm possible", { "text-anchor": "end", style: "fill:var(--code-del)" });

    // Population intake distribution (density over log intake, scaled).
    const N = 240, pts = [];
    let peak = 0;
    for (let i = 0; i <= N; i++) {
      const lv = lx0 + ((lx1 - lx0) * i) / N, x = 10 ** lv;
      const yv = dens(x) * x; // density per unit ln(x)
      pts.push([lv, yv]); peak = Math.max(peak, yv);
    }
    const area = [[f.sx(lx0), f.sy(0)], ...pts.map(([lv, yv]) => [f.sx(lv), f.sy((yv / peak) * 0.6)]), [f.sx(lx1), f.sy(0)]];
    el("polygon", { points: area.map((p) => p.join(",")).join(" "), style: "fill:var(--vec-u);fill-opacity:0.18;stroke:var(--vec-u);stroke-opacity:0.6" }, svg);
    // Shade the population below the EAR.
    const below = pts.filter(([lv]) => 10 ** lv <= d.ear);
    if (below.length > 1) {
      const sh = [[f.sx(lx0), f.sy(0)], ...below.map(([lv, yv]) => [f.sx(lv), f.sy((yv / peak) * 0.6)]), [f.sx(below.at(-1)[0]), f.sy(0)]];
      el("polygon", { points: sh.map((p) => p.join(",")).join(" "), style: "fill:var(--vec-u);fill-opacity:0.35" }, svg);
    }
    // Individual risk of inadequacy.
    const risk = [];
    for (let i = 0; i <= N; i++) { const lv = lx0 + ((lx1 - lx0) * i) / N; risk.push([f.sx(lv), f.sy(pInad(10 ** lv))]); }
    polyline(svg, risk, "stroke:var(--brand);stroke-width:2.25");
    for (const [v, lbl, dy] of [[d.ear, "EAR", 0], [d.rda, "RDA", 11], [d.ul, "UL", 0]]) {
      const x = f.sx(Math.log10(v));
      el("line", { x1: x, x2: x, y1: f.T + 16, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
      text(svg, x + 3, f.T + 26 + dy, `${lbl} ${v}`, { class: "fill-foreground font-mono text-[10px]" });
    }
    const yx = f.sx(Math.log10(Math.min(Math.max(you, 10 ** lx0), 10 ** lx1)));
    el("circle", { cx: yx, cy: f.sy(pInad(you)), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, 50, 10, "— P(requirement above this intake)", { style: "fill:var(--brand)" });
    text(svg, 260, 10, "▮ population intakes (synthetic)", { style: "fill:var(--vec-u)" });

    // Prevalence of inadequacy: cut-point and full probability approach.
    const z = (v) => (Math.log(v) - Math.log(m)) / sl;
    const cut = phi(z(d.ear));
    let prob = 0;
    const steps = 2000, a = Math.log(m) - 6 * sl, b = Math.log(m) + 6 * sl;
    for (let i = 0; i < steps; i++) {
      const u = a + ((b - a) * (i + 0.5)) / steps;
      prob += (Math.exp(-((u - Math.log(m)) ** 2) / (2 * sl * sl)) / (sl * Math.sqrt(2 * Math.PI))) * pInad(Math.exp(u)) * ((b - a) / steps);
    }
    set(o, "dri", `${d.ear} / ${d.rda} / ${int(d.ul)} mg`);
    set(o, "below", pct(cut));
    set(o, "prob", pct(prob));
    set(o, "above", pct(1 - phi(z(d.ul)), 2));
    set(o, "pi", `${pct(pInad(you))} at ${num(you, you < 20 ? 1 : 0)} mg`);
  }
  draw();
}

// ============================================================ Nutrient density

const DENS_UNITS = ["kcal", "g", "g", "mg", "mg", "mg", "mg"];
const DENS_NAMES = ["energy", "protein", "fibre", "vitamin C", "potassium", "calcium", "iron"];

for (const root of document.querySelectorAll("[data-nutri-density]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const foods = [...root.querySelector("template[data-foods]").content.children].map((d) => ({ name: d.dataset.name, v: d.dataset.v.split(",").map(Number) }));
  let basis = "kcal", k = 1;
  root.addEventListener("seg-change", (e) => {
    const g = group(e);
    if (g === "basis") basis = e.detail.value;
    if (g === "nutrient") k = Number(e.detail.value);
    draw();
  });
  const val = (f, b) => (b === "kcal" ? (f.v[k] / f.v[0]) * 100 : f.v[k]);
  const rank = (b) => [...foods].sort((x, y) => val(y, b) - val(x, b)).map((f) => f.name);

  function draw() {
    const order = [...foods].sort((x, y) => val(y, basis) - val(x, basis));
    const other = rank(basis === "kcal" ? "g" : "kcal");
    const max = Math.max(...order.map((f) => val(f, basis)), 1e-9) * 1.12;
    svg.replaceChildren();
    const L = 160, W = 360, T = 14, rowH = 24;
    const sx = (v) => L + (v / max) * W;
    for (const t of ticks(0, max, 4)) {
      el("line", { x1: sx(t), x2: sx(t), y1: T - 2, y2: T + order.length * rowH, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, sx(t), T + order.length * rowH + 13, String(t), { "text-anchor": "middle" });
    }
    text(svg, L + W, T + order.length * rowH + 27, `${DENS_NAMES[k]} (${DENS_UNITS[k]}) per 100 ${basis === "kcal" ? "kcal" : "g"}`, { "text-anchor": "end" });
    order.forEach((f, i) => {
      const y = T + i * rowH, v = val(f, basis);
      const moved = other.indexOf(f.name) - i;
      text(svg, L - 8, y + rowH / 2 + 3, f.name, { "text-anchor": "end", class: i === 0 ? "fill-foreground font-mono text-[10px] font-semibold" : "fill-muted-foreground font-mono text-[10px]" });
      el("rect", { x: sx(0), y: y + 4, width: Math.max(v > 0 ? 1 : 0, sx(v) - sx(0)), height: rowH - 8, rx: 3, style: i === 0 ? "fill:var(--brand)" : "fill:var(--vec-u);fill-opacity:0.55" }, svg);
      const lbl = v === 0 ? "0" : num(v, v < 10 ? 1 : 0);
      text(svg, sx(v) + 5, y + rowH / 2 + 3, lbl + (moved !== 0 ? `  ${moved > 0 ? "▲" : "▼"}${Math.abs(moved)}` : ""), { class: "fill-foreground font-mono text-[10px]" });
    });
    const moves = foods.filter((f) => rank(basis).indexOf(f.name) !== other.indexOf(f.name)).length;
    set(o, "top", order[0].name);
    set(o, "topv", `${num(val(order[0], basis), 1)} ${DENS_UNITS[k]} per 100 ${basis === "kcal" ? "kcal" : "g"}`);
    set(o, "moves", `${moves} of ${foods.length} foods vs per 100 ${basis === "kcal" ? "g" : "kcal"}`);
  }
  draw();
}

// ============================================================ BMI and its limits

const BODIES = {
  rugby: { w: 105, hgt: 185, waist: 88, fat: 14 },
  desk: { w: 105, hgt: 185, waist: 112, fat: 32 },
  slim: { w: 62, hgt: 170, waist: 88, fat: 32 },
};
const BMI_BANDS = [
  [0, 18.5, "underweight", "var(--vec-v)"],
  [18.5, 25, "healthy range", "var(--vec-u)"],
  [25, 30, "overweight", "var(--ion-na)"],
  [30, 80, "obesity", "var(--code-del)"],
];

for (const root of document.querySelectorAll("[data-nutri-body]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = BODIES[b.dataset.preset];
    for (const k in p) s[k].set(p[k], false);
    draw();
  }));

  function draw() {
    const w = s.w.get(), hgt = s.hgt.get(), waist = s.waist.get(), fat = s.fat.get();
    const bmi = w / (hgt / 100) ** 2, whtr = waist / hgt;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 496, 236], x: [140, 210], y: [35, 160], xticks: [140, 150, 160, 170, 180, 190, 200, 210], yticks: [40, 60, 80, 100, 120, 140, 160], xlabel: "height (cm)", ylabel: "weight (kg)" });
    const clip = (v) => Math.max(35, Math.min(160, v));
    for (const [lo, hi, name, c] of BMI_BANDS) {
      const top = [], bot = [];
      for (let x = 140; x <= 210; x += 2) { top.push([f.sx(x), f.sy(clip(hi * (x / 100) ** 2))]); bot.push([f.sx(x), f.sy(clip(lo * (x / 100) ** 2))]); }
      el("polygon", { points: [...top, ...bot.reverse()].map((p) => p.join(",")).join(" "), style: `fill:${c};fill-opacity:0.13` }, svg);
      const lx = 200, ly = clip(((lo + Math.min(hi, 40)) / 2) * (lx / 100) ** 2);
      if (ly > 38 && ly < 157) text(svg, f.sx(lx), f.sy(ly) + 3, name, { "text-anchor": "middle", style: `fill:${c}` });
    }
    for (const b of [18.5, 25, 30]) {
      const pts = [];
      for (let x = 140; x <= 210; x += 2) { const y = b * (x / 100) ** 2; if (y <= 160) pts.push([f.sx(x), f.sy(y)]); }
      polyline(svg, pts, "stroke:currentColor;stroke-opacity:0.25");
    }
    el("circle", { cx: f.sx(Math.max(140, Math.min(210, hgt))), cy: f.sy(clip(w)), r: 5.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    // Waist-to-height gauge.
    const gx = f.L + 8, gy = f.T + 8, gw = 170;
    el("rect", { x: gx - 6, y: gy - 6, width: gw + 100, height: 38, rx: 6, style: "fill:var(--background);fill-opacity:0.85" }, svg);
    el("rect", { x: gx, y: gy, width: gw, height: 8, rx: 4, style: "fill:currentColor;fill-opacity:0.08" }, svg);
    const gs = (v) => gx + ((Math.max(0.35, Math.min(0.75, v)) - 0.35) / 0.4) * gw;
    el("rect", { x: gs(0.5), y: gy, width: gx + gw - gs(0.5), height: 8, rx: 4, style: "fill:var(--code-del);fill-opacity:0.25" }, svg);
    el("line", { x1: gs(0.5), x2: gs(0.5), y1: gy - 3, y2: gy + 11, style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    el("circle", { cx: gs(whtr), cy: gy + 4, r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, gx, gy + 24, `waist ÷ height ${num(whtr, 2)}  (0.5 boundary)`, { class: "fill-foreground font-mono text-[10px]" });

    const cat = BMI_BANDS.find(([lo, hi]) => bmi >= lo && bmi < hi)[2];
    set(o, "bmi", `${num(bmi, 1)} kg/m²`);
    set(o, "cat", cat);
    set(o, "whtr", `${num(whtr, 2)}${whtr > 0.5 ? " (above 0.5)" : ""}`);
    set(o, "fm", `${num((w * fat) / 100, 1)} kg`);
    set(o, "lm", `${num(w * (1 - fat / 100), 1)} kg`);
  }
  draw();
}

// ============================================================ Sodium and potassium

const SALT_NA = 22.99 / 58.44; // mass fraction of sodium in NaCl
const SALT_DAYS = {
  processed: { bread: 1, ham: 1, cheese: 1, soup: 1, crisps: 1 },
  fresh: { bread: 1, banana: 1, potato: 1, beans: 1, spinach: 1, yoghurt: 1, oj: 1 },
  clear: {},
};

for (const root of document.querySelectorAll("[data-nutri-salt]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const c = counters(root, draw);
  const food = Object.fromEntries(c.rows.map((r) => [r.dataset.food, { na: +r.dataset.na, k: +r.dataset.k }]));
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { c.load(SALT_DAYS[b.dataset.preset]); draw(); }));
  c.load(SALT_DAYS.processed);

  function draw() {
    let na = 0, k = 0;
    for (const [id, n] of Object.entries(c.counts)) { na += food[id].na * n; k += food[id].k * n; }
    const max = Math.max(na, k, 4000) * 1.08;
    svg.replaceChildren();
    const L = 92, W = 440, sx = (v) => L + (v / max) * W;
    for (const t of ticks(0, max, 5)) {
      el("line", { x1: sx(t), x2: sx(t), y1: 18, y2: 118, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, sx(t), 132, t.toLocaleString("en-US"), { "text-anchor": "middle" });
    }
    text(svg, L + W, 146, "mg per day", { "text-anchor": "end" });
    const bar = (y, v, lbl, c, mark, markLbl) => {
      text(svg, L - 8, y + 17, lbl, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
      el("rect", { x: sx(0), y: y + 4, width: Math.max(1, sx(v) - sx(0)), height: 22, rx: 3, style: `fill:${c};fill-opacity:0.7` }, svg);
      text(svg, sx(v) + 5, y + 19, int(v), { class: "fill-foreground font-mono text-[10px]" });
      el("line", { x1: sx(mark), x2: sx(mark), y1: y - 2, y2: y + 32, style: "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:3 2" }, svg);
      text(svg, sx(mark) + 3, y - 3, markLbl, { class: "fill-foreground font-mono text-[9px]" });
    };
    bar(28, na, "sodium", "var(--code-del)", 2000, "WHO limit < 2,000");
    bar(78, k, "potassium", "var(--brand)", 3510, "WHO ≥ 3,510");

    const salt = s.salt.get();
    set(o, "conv", `${num(salt, 1)} g salt = ${int(salt * SALT_NA * 1000)} mg sodium`);
    set(o, "na", `${int(na)} mg${na > 2000 ? " (above 2,000)" : ""}`);
    set(o, "saltEq", `${num(na / SALT_NA / 1000, 1)} g`);
    set(o, "k", `${int(k)} mg${k < 3510 ? " (below 3,510)" : ""}`);
    set(o, "ratio", k > 0 ? num(na / 22.99 / (k / 39.1), 2) : "—");
  }
  draw();
}

// ============================================================ Healthy-user bias

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const root of document.querySelectorAll("[data-nutri-study]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let design = "obs", seed = 7;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { if (group(e) === "design") { design = e.detail.value; draw(); } });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed = (seed * 48271 + 11) % 2147483647; draw(); });

  function simulate() {
    const rnd = mulberry32(seed);
    const n = Math.round(s.n.get()), conf = s.conf.get(), rr = s.rr.get();
    // t[stratum][exposed] = [cases, people]; stratum 1 = health-conscious.
    const t = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
    for (let i = 0; i < n; i++) {
      const hc = rnd() < 0.4 ? 1 : 0;
      const pX = design === "rct" ? 0.5 : Math.min(0.95, 0.2 * (hc ? conf : 1));
      const x = rnd() < pX ? 1 : 0;
      const risk = Math.min(1, (hc ? 0.1 : 0.2) * (x ? rr : 1));
      const y = rnd() < risk ? 1 : 0;
      t[hc][x][0] += y; t[hc][x][1] += 1;
    }
    return t;
  }

  function draw() {
    const t = simulate();
    const risk = (c) => (c[1] ? c[0] / c[1] : 0);
    const crude = [0, 1].map((x) => [t[0][x][0] + t[1][x][0], t[0][x][1] + t[1][x][1]]);
    const crudeRR = risk(crude[1]) / risk(crude[0]);
    let num_ = 0, den = 0;
    for (const k of [0, 1]) {
      const [a, n1] = t[k][1], [c, n0] = t[k][0], N = n1 + n0;
      if (!N) continue;
      num_ += (a * n0) / N; den += (c * n1) / N;
    }
    const mh = num_ / den;

    svg.replaceChildren();
    const groups = [["all (crude)", crude], ["health-conscious", t[1]], ["others", t[0]]];
    const f = frame(svg, { box: [44, 40, 496, 204], x: [0, 3], y: [0, 0.3], yticks: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3], yfmt: (v) => `${Math.round(v * 100)}%`, ylabel: "disease risk" });
    const gw = f.W / 3;
    groups.forEach(([name, g], i) => {
      const x0 = f.L + i * gw;
      [[1, "var(--brand)"], [0, "var(--vec-u)"]].forEach(([x, c], j) => {
        const r = risk(g[x]);
        const bx = x0 + gw * (0.2 + j * 0.31);
        el("rect", { x: bx, y: f.sy(Math.min(r, 0.3)), width: gw * 0.27, height: f.sy(0) - f.sy(Math.min(r, 0.3)), rx: 3, style: `fill:${c};fill-opacity:0.75` }, svg);
        text(svg, bx + gw * 0.135, f.sy(Math.min(r, 0.3)) - 5, `${num(r * 100, 1)}%`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
        text(svg, bx + gw * 0.135, f.T + f.H + 13, `n ${g[x][1]}`, { "text-anchor": "middle" });
      });
      text(svg, x0 + gw / 2, f.T + f.H + 27, name, { "text-anchor": "middle", class: i === 0 ? "fill-foreground font-mono text-[11px] font-semibold" : "fill-muted-foreground font-mono text-[10px]" });
      if (i > 0) el("line", { x1: x0, x2: x0, y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.15" }, svg);
    });
    el("rect", { x: 50, y: 6, width: 10, height: 8, rx: 2, style: "fill:var(--brand);fill-opacity:0.75" }, svg);
    text(svg, 64, 13, "eats food X");
    el("rect", { x: 150, y: 6, width: 10, height: 8, rx: 2, style: "fill:var(--vec-u);fill-opacity:0.75" }, svg);
    text(svg, 164, 13, "does not");

    const exposed = crude[1][1] / (crude[0][1] + crude[1][1]);
    set(o, "crude", num(crudeRR, 2));
    set(o, "adj", num(mh, 2));
    set(o, "truth", num(s.rr.get(), 2));
    set(o, "exp", pct(exposed, 0));
  }
  draw();
}
