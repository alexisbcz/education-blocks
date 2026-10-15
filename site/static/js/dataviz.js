// Data visualization blocks. Chart colours are the dataviz skill's
// validated reference palette (categorical slots in fixed order, a one-hue
// blue ramp, a blue↔red diverging pair with a grey midpoint), with selected
// dark-mode steps; text always wears the site's ink tokens, never a series
// colour. Every chart has a hover layer.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const isDark = () => document.documentElement.classList.contains("dark");
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

// ---------------------------------------------------------------- palette

const CAT = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};
const BLUE = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
const cat = (i) => (isDark() ? CAT.dark : CAT.light)[i % 8];
const muted = () => (isDark() ? "#4a4a47" : "#c3c2b7");
const surface = () => (isDark() ? "#0a0a0a" : "#ffffff");

// sRGB <-> linear <-> OKLab (Ottosson).
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgb2hex = (c) => "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function lin2oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklab2lin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const hexLab = (h) => lin2oklab(hex2rgb(h).map(toLin));
// A ramp through hex stops, interpolated in OKLab; t in [0, 1].
function ramp(stops) {
  const labs = stops.map(hexLab);
  return (t) => {
    const x = Math.min(1, Math.max(0, t)) * (labs.length - 1);
    const i = Math.min(labs.length - 2, Math.floor(x));
    const f = x - i;
    const lab = labs[i].map((v, k) => v + (labs[i + 1][k] - v) * f);
    return rgb2hex(oklab2lin(lab).map(toSrgb));
  };
}
// Sequential: on dark the low end recedes into the dark surface.
const seq = () => ramp(isDark() ? [...BLUE].reverse().slice(1) : BLUE);
const div = () => (isDark() ? ramp(["#86b6ef", "#3987e5", "#383835", "#e66767", "#f2a3a2"]) : ramp(["#104281", "#5598e7", "#f0efec", "#e34948", "#9b2524"]));

// Colour-vision simulation: Machado, Oliveira & Fernandes (2009), severity 1.
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
function simulate(hex, kind) {
  if (!CVD[kind]) return hex;
  const c = hex2rgb(hex).map(toLin);
  const M = CVD[kind];
  return rgb2hex(M.map((r) => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]).map(toSrgb));
}

// ---------------------------------------------------------------- helpers

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Inverse normal CDF (Acklam), relative error < 1.2e-9.
function invNorm(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
// Normal CDF via erf (Abramowitz–Stegun 7.1.26 is too coarse; use W. J. Cody-style series/continued fraction through erfc).
function normCdf(x) {
  // Complementary error function, Numerical Recipes erfcc (fractional error < 1.2e-7).
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - r / 2 : r / 2;
}

// Vertical bar from baseline y0 to y1, with a 4px rounded data end.
function barV(x, y0, w, y1, r = 4) {
  const up = y1 < y0, h = Math.abs(y0 - y1);
  r = Math.min(r, h, w / 2);
  if (up) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}
// Horizontal bar from x0 to x1 (data end), rounded at x1.
function barH(x0, y, h, x1, r = 4) {
  const right = x1 > x0, w = Math.abs(x1 - x0);
  r = Math.min(r, w, h / 2);
  if (right) return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
  return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
}
const ink = (parent, x, y, s, attrs = {}) => text(parent, x, y, s, { class: "fill-foreground text-[11px]", ...attrs });

// The shared tooltip: positioned in the block's relative container.
function tipper(root) {
  const t = root.querySelector("[data-tip]");
  if (!t) return { show() {}, hide() {} };
  return {
    show(e, s) {
      const box = t.parentElement.getBoundingClientRect();
      t.textContent = s;
      t.hidden = false;
      let x = e.clientX - box.left + 12, y = e.clientY - box.top + 12;
      if (x + t.offsetWidth > box.width) x = e.clientX - box.left - t.offsetWidth - 12;
      if (y + t.offsetHeight > box.height) y = e.clientY - box.top - t.offsetHeight - 12;
      t.style.left = `${Math.max(0, x)}px`;
      t.style.top = `${Math.max(0, y)}px`;
    },
    hide() { t.hidden = true; },
  };
}
// Hover targets: a mark (or an invisible hit area) shows text on hover.
function hover(node, tip, s) {
  node.addEventListener("pointermove", (e) => tip.show(e, typeof s === "function" ? s() : s));
  node.addEventListener("pointerleave", () => tip.hide());
}
// Converts a pointer event to SVG viewBox coordinates.
function svgPoint(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
const fmtInt = (v) => Math.round(v).toLocaleString("en");

// ================================================================ DV1 perception

for (const root of document.querySelectorAll("[data-dv-perception]")) {
  const svg = root.querySelector("[data-plot]");
  const res = root.querySelector("[data-result]");
  const form = root.querySelector("[data-guess]");
  const input = form.querySelector("input");
  const o = outs(root);
  const tip = tipper(root);
  const ENC = ["position", "length", "angle", "area"];
  const LABEL = { position: "Position, common scale", length: "Length, unaligned", angle: "Angle (pie)", area: "Area (circles)" };
  let trials, at, errors;

  function start() {
    trials = [];
    for (const enc of ENC) for (let k = 0; k < 5; k++) trials.push({ enc, p: 12 + Math.round(Math.random() * 76) });
    for (let i = trials.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [trials[i], trials[j]] = [trials[j], trials[i]]; }
    at = 0;
    errors = Object.fromEntries(ENC.map((e) => [e, []]));
    o.feedback.textContent = "";
    show();
  }

  function show() {
    svg.replaceChildren();
    drawResult();
    if (at >= trials.length) {
      o.trial.textContent = "Done: 20 of 20";
      o.encoding.textContent = "";
      ink(svg, 230, 130, "Done. Your errors per encoding are below.", { "text-anchor": "middle", class: "fill-foreground text-[13px]" });
      input.disabled = true;
      return;
    }
    input.disabled = false;
    const { enc, p } = trials[at];
    o.trial.textContent = `Trial ${at + 1} of ${trials.length}`;
    o.encoding.textContent = LABEL[enc];
    const big = 1, small = p / 100, fill = cat(0);
    const swap = Math.random() < 0.5; // which side holds the smaller mark
    const vals = swap ? [small, big] : [big, small];
    if (enc === "position") {
      el("line", { x1: 90, x2: 370, y1: 230, y2: 230, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      el("line", { x1: 90, x2: 90, y1: 40, y2: 230, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      vals.forEach((v, i) => {
        const x = 150 + i * 110;
        el("path", { d: barV(x, 230, 50, 230 - v * 180), style: `fill:${fill}` }, svg);
        ink(svg, x + 25, 250, "AB"[i], { "text-anchor": "middle" });
      });
    } else if (enc === "length") {
      vals.forEach((v, i) => {
        const x = 150 + i * 110, base = 230 - (i ? 40 + Math.random() * 30 : Math.random() * 20);
        el("path", { d: barV(x, base, 50, base - v * 170), style: `fill:${fill}` }, svg);
        ink(svg, x + 25, base + 16, "AB"[i], { "text-anchor": "middle" });
      });
    } else if (enc === "angle") {
      // Two target slices plus two grey fillers in one pie.
      const f1 = 0.4 + Math.random() * 0.6, f2 = 0.4 + Math.random() * 0.6;
      const parts = [vals[0], f1, vals[1], f2];
      const tot = parts.reduce((a, b) => a + b, 0);
      let a0 = -Math.PI / 2 + Math.random() * Math.PI;
      const cx = 230, cy = 130, R = 100;
      parts.forEach((v, i) => {
        const a1 = a0 + (v / tot) * 2 * Math.PI;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const d = `M${cx},${cy}L${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)}A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}Z`;
        el("path", { d, style: `fill:${i % 2 ? muted() : fill};stroke:${surface()};stroke-width:2px` }, svg);
        if (i % 2 === 0) {
          const am = (a0 + a1) / 2;
          ink(svg, cx + (R + 14) * Math.cos(am), cy + (R + 14) * Math.sin(am) + 4, "AB"[i / 2], { "text-anchor": "middle" });
        }
        a0 = a1;
      });
    } else {
      vals.forEach((v, i) => {
        const r = 90 * Math.sqrt(v);
        el("circle", { cx: 150 + i * 160, cy: 130, r, style: `fill:${fill}` }, svg);
        ink(svg, 150 + i * 160, 250, "AB"[i], { "text-anchor": "middle" });
      });
    }
    input.value = "";
  }

  function drawResult() {
    res.replaceChildren();
    const f = frame(res, { box: [140, 8, 300, 104], x: [0, 7], y: [0, 4], xticks: [0, 1, 2, 3, 4, 5, 6, 7], yticks: [], xlabel: "error: log₂(|judged − true| + ⅛)" });
    ENC.forEach((enc, i) => {
      const y = f.T + 13 + i * 26;
      text(res, f.L - 8, y + 4, LABEL[enc], { "text-anchor": "end" });
      el("line", { x1: f.L, x2: f.L + f.W, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.06" }, res);
      const e = errors[enc];
      if (!e.length) return;
      const m = e.reduce((a, b) => a + b, 0) / e.length;
      const dot = el("circle", { cx: f.sx(m), cy: y, r: 5, style: `fill:${cat(0)};stroke:${surface()};stroke-width:2px` }, res);
      const hit = el("circle", { cx: f.sx(m), cy: y, r: 12, style: "fill:transparent" }, res);
      hover(hit, tip, `${LABEL[enc]}\nmean error ${num(m, 2)} over ${e.length} trial${e.length > 1 ? "s" : ""}`);
      void dot;
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (at >= trials.length) return;
    const g = parseFloat(input.value);
    if (!Number.isFinite(g)) return;
    const { enc, p } = trials[at];
    const err = Math.log2(Math.abs(g - p) + 1 / 8);
    errors[enc].push(err);
    o.feedback.textContent = `True ${p}% · you ${g}% · error ${num(err, 2)}`;
    at++;
    show();
    input.focus();
  });
  root.querySelector("[data-action=restart]").addEventListener("click", start);
  onTheme(show);
  start();
}

// ================================================================ DV2 chooser

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

for (const root of document.querySelectorAll("[data-dv-chooser]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const tip = tipper(root);
  const rng = mulberry32(17);
  const cats = [["Search", 4200], ["Direct", 3100], ["Social", 2400], ["Email", 1300], ["Referral", 900], ["Ads", 600]];
  const trend = Array.from({ length: 24 }, (_, i) => 100 + i * 4 + 12 * Math.sin(i / 1.9) + 6 * gauss(rng));
  const dist = Array.from({ length: 500 }, () => 50 + 12 * gauss(rng) + (rng() < 0.15 ? 25 : 0));
  const rel = Array.from({ length: 120 }, () => { const x = rng() * 10; return [x, 2 + 0.8 * x + 1.4 * gauss(rng)]; });
  const pol = Array.from({ length: 12 }, (_, i) => Math.round(30 * Math.sin(i / 1.7) + 12 * gauss(rng)));
  let task = "compare";

  const FORMS = {
    headline: ["Stat tile", "When the story is one number, the number is the chart. A big figure, its unit, and one comparison beat any one-bar chart or two-slice pie."],
    compare: ["Bar chart, sorted", "Length along a common baseline is read most accurately. Sort the bars so rank is free, use one colour for one series, and label the extreme directly."],
    trend: ["Line chart", "Position over time: one 2 px line, a recessive grid, and a crosshair for exact values. Time runs left to right."],
    part: ["100% stacked bar", "Part-to-whole with a few parts: one bar split into segments, 2 px gaps between them, labelled directly. A pie works only for ≤ 6 parts that aren't close."],
    distribution: ["Histogram", "Spread is a shape: counts per bin show the centre, the width and the bump a mean would hide (here, a second group at the high end)."],
    relation: ["Scatter plot", "Two measures per item: x and y positions. Add the correlation, not a trend line, unless a model is the point."],
    polarity: ["Diverging bars", "Above and below a reference: bars grow both ways from zero, the two directions in the diverging pair's warm and cool poles."],
  };

  function draw() {
    svg.replaceChildren();
    tip.hide();
    const [form, why] = FORMS[task];
    o.form.textContent = form;
    o.why.textContent = why;
    if (task === "headline") {
      ink(svg, 40, 120, "Active learners this month", { class: "fill-muted-foreground text-[14px]" });
      ink(svg, 40, 200, "12,840", { class: "fill-foreground text-[72px] font-semibold" });
      ink(svg, 40, 240, "▲ 12% vs last month", { class: "fill-add text-[15px]" });
    } else if (task === "compare") {
      const f = { L: 90, W: 420, T: 20, H: 250 };
      const max = 4500, bh = f.H / cats.length;
      el("line", { x1: f.L, x2: f.L, y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      cats.forEach(([name, v], i) => {
        const y = f.T + i * bh + 2, x1 = f.L + (v / max) * f.W;
        const bar = el("path", { d: barH(f.L, y, bh - 4, x1), style: `fill:${cat(0)}` }, svg);
        text(svg, f.L - 8, y + bh / 2 + 2, name, { "text-anchor": "end" });
        if (i === 0) ink(svg, x1 + 6, y + bh / 2 + 2, fmtInt(v));
        hover(bar, tip, `${name}\n${fmtInt(v)} visits`);
      });
    } else if (task === "trend") {
      const f = frame(svg, { box: [50, 16, 490, 240], x: [0, 23], y: [0, 240], xticks: [0, 6, 12, 18, 23], yticks: [0, 80, 160, 240], xfmt: (i) => `${MONTHS[i % 12]} '${24 + Math.floor(i / 12)}`, ylabel: "learners (k)" });
      polyline(svg, trend.map((v, i) => [f.sx(i), f.sy(v)]), `stroke:${cat(0)};stroke-width:2px;stroke-linejoin:round`);
      crosshair(svg, f, tip, 23, (i) => `${MONTHS[i % 12]} '${24 + Math.floor(i / 12)}\n${num(trend[i], 1)}k learners`, (i) => [[f.sx(i), f.sy(trend[i]), cat(0)]]);
    } else if (task === "part") {
      const parts = [["Video", 46], ["Reading", 27], ["Exercises", 19], ["Quizzes", 8]];
      let x = 40;
      const W = 480;
      parts.forEach(([name, v], i) => {
        const w = (v / 100) * W - 2;
        const seg = el("rect", { x, y: 120, width: w, height: 44, rx: i === 0 || i === parts.length - 1 ? 4 : 0, style: `fill:${cat(i)}` }, svg);
        ink(svg, x + 2, 108, `${name} ${v}%`);
        hover(seg, tip, `${name}\n${v}% of time`);
        x += w + 2;
      });
      // Legend (>= 2 series): swatches + names, below.
      parts.forEach(([name], i) => {
        el("rect", { x: 40 + i * 120, y: 200, width: 10, height: 10, rx: 2, style: `fill:${cat(i)}` }, svg);
        text(svg, 56 + i * 120, 209, name);
      });
    } else if (task === "distribution") {
      const bins = 24, lo = 10, hi = 106, w = (hi - lo) / bins;
      const counts = new Array(bins).fill(0);
      for (const v of dist) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)))]++;
      const top = Math.ceil(Math.max(...counts) / 10) * 10;
      const f = frame(svg, { box: [50, 16, 490, 240], x: [lo, hi], y: [0, top], xticks: [10, 30, 50, 70, 90], yticks: [0, top / 2, top], xlabel: "score", ylabel: "learners" });
      counts.forEach((c, i) => {
        const x0 = f.sx(lo + i * w) + 1, x1 = f.sx(lo + (i + 1) * w) - 1;
        const bar = el("path", { d: barV(x0, f.sy(0), x1 - x0, f.sy(c)), style: `fill:${cat(0)}` }, svg);
        hover(bar, tip, `${num(lo + i * w, 0)}–${num(lo + (i + 1) * w, 0)}\n${c} learners`);
      });
    } else if (task === "relation") {
      const f = frame(svg, { box: [50, 16, 490, 240], x: [0, 10], y: [-2, 14], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 4, 8, 12], xlabel: "hours practised", ylabel: "score gain" });
      const mx = rel.reduce((a, p) => a + p[0], 0) / rel.length, my = rel.reduce((a, p) => a + p[1], 0) / rel.length;
      let sxy = 0, sxx = 0, syy = 0;
      for (const [x, y] of rel) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
      for (const [x, y] of rel) {
        const d = el("circle", { cx: f.sx(x), cy: f.sy(y), r: 4, style: `fill:${cat(0)};stroke:${surface()};stroke-width:2px` }, svg);
        hover(d, tip, `${num(x, 1)} h → +${num(y, 1)}`);
      }
      ink(svg, f.L + f.W, f.T + 10, `r = ${num(sxy / Math.sqrt(sxx * syy), 2)}`, { "text-anchor": "end" });
    } else {
      const f = frame(svg, { box: [50, 16, 490, 250], x: [-0.5, 11.5], y: [-50, 50], xticks: [], yticks: [-40, -20, 0, 20, 40], ylabel: "balance" });
      const d = div();
      pol.forEach((v, i) => {
        const x = f.sx(i - 0.4), w = f.sx(i + 0.4) - x;
        const bar = el("path", { d: barV(x, f.sy(0), w, f.sy(v)), style: `fill:${d(v >= 0 ? 0.9 : 0.1)}` }, svg);
        text(svg, x + w / 2, f.T + f.H + 13, MONTHS[i], { "text-anchor": "middle" });
        hover(bar, tip, `${MONTHS[i]}\n${v > 0 ? "+" : ""}${v}`);
      });
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    }
  }

  for (const b of root.querySelectorAll("[data-task]")) {
    b.addEventListener("click", () => {
      task = b.dataset.task;
      for (const x of root.querySelectorAll("[data-task]")) x.setAttribute("aria-checked", String(x === b));
      draw();
    });
  }
  onTheme(draw);
  draw();
}

// A vertical crosshair over an index axis: n+1 points 0..n.
function crosshair(svg, f, tip, n, label, dots) {
  const g = el("g", { style: "pointer-events:none" }, svg);
  const hit = el("rect", { x: f.L, y: f.T, width: f.W, height: f.H, style: "fill:transparent" }, svg);
  hit.addEventListener("pointermove", (e) => {
    const p = svgPoint(svg, e);
    const i = Math.max(0, Math.min(n, Math.round(((p.x - f.L) / f.W) * n)));
    g.replaceChildren();
    el("line", { x1: f.sx(i), x2: f.sx(i), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35" }, g);
    for (const [x, y, c] of dots(i)) el("circle", { cx: x, cy: y, r: 4, style: `fill:${c};stroke:${surface()};stroke-width:2px` }, g);
    tip.show(e, label(i));
  });
  hit.addEventListener("pointerleave", () => { g.replaceChildren(); tip.hide(); });
}

// ================================================================ DV3 misleading

for (const root of document.querySelectorAll("[data-dv-mislead]")) {
  const bad = root.querySelector("[data-bad]");
  const good = root.querySelector("[data-good]");
  const o = outs(root);
  let trick = "truncated";
  const rng = mulberry32(5);
  const walk = [100];
  for (let i = 1; i < 60; i++) walk.push(walk[i - 1] * (1 + 0.012 + 0.04 * gauss(rng)));
  // Make the last eight steps fall, inside a long rise.
  for (let i = 52; i < 60; i++) walk[i] = walk[51] * (1 - 0.02 * (i - 51)) * (1 + 0.01 * gauss(rng));

  const EXPLAIN = {
    truncated: "The y-axis starts at 50, so a 10% difference looks like a 5× difference. Bars encode value by length, so a bar chart must start at zero; a line chart may zoom, because it encodes by position.",
    dual: "Two y-scales on one plot: where the lines cross is set by how each axis was stretched, not by the data, so the chart invents a relationship. Index both series to 100 at the start and draw them on one axis.",
    area: "The circles' radii are proportional to the values, so B (2× A) covers 4× the area and reads as 4×. Encode with length (bars), or scale area ∝ value (radius ∝ √value).",
    window: "Showing only the last eight points tells a story of collapse; the full series is a long rise with a recent dip. Show the full context and highlight the window you care about.",
    threed: "Tilting a pie adds perspective: the front slice (25%) is drawn larger than the back slice (30%), and the depth face adds ink that belongs to no value. Use bars, or at most a flat pie.",
  };

  function axisless(svg) { svg.replaceChildren(); }

  function draw() {
    axisless(bad); axisless(good);
    o.explain.textContent = EXPLAIN[trick];
    const c0 = cat(0), c1 = cat(1);
    if (trick === "truncated") {
      const vals = [52, 53, 55, 54, 57], names = ["A", "B", "C", "D", "E"];
      const draw2 = (svg, y0) => {
        const f = frame(svg, { box: [44, 16, 360, 210], x: [0, 5], y: [y0, y0 ? 58 : 60], xticks: [], yticks: y0 ? [50, 52, 54, 56, 58] : [0, 20, 40, 60] });
        vals.forEach((v, i) => {
          const x = f.sx(i + 0.15), w = f.sx(i + 0.85) - x;
          el("path", { d: barV(x, f.sy(y0), w, f.sy(v)), style: `fill:${c0}` }, svg);
          text(svg, x + w / 2, f.T + f.H + 13, names[i], { "text-anchor": "middle" });
        });
      };
      draw2(bad, 50); draw2(good, 0);
    } else if (trick === "dual") {
      const users = [5, 8, 11, 15, 19, 24, 28], sessions = [400, 430, 470, 520, 590, 680, 790];
      const fb = frame(bad, { box: [44, 16, 330, 210], x: [0, 6], y: [0, 30], xticks: [0, 2, 4, 6], yticks: [0, 10, 20, 30], ylabel: "users (k)" });
      const sy2 = (v) => fb.T + fb.H - ((v - 380) / (800 - 380)) * fb.H;
      polyline(bad, users.map((v, i) => [fb.sx(i), fb.sy(v)]), `stroke:${c0};stroke-width:2px`);
      polyline(bad, sessions.map((v, i) => [fb.sx(i), sy2(v)]), `stroke:${c1};stroke-width:2px`);
      [400, 600, 800].forEach((v) => text(bad, fb.L + fb.W + 6, sy2(v) + 3, `${v}k`));
      text(bad, fb.L + fb.W + 6, fb.T - 6, "sessions");
      const fg = frame(good, { box: [44, 16, 300, 210], x: [0, 6], y: [0, 600], xticks: [0, 2, 4, 6], yticks: [0, 200, 400, 600], ylabel: "index, month 0 = 100" });
      const iu = users.map((v) => (100 * v) / users[0]), is = sessions.map((v) => (100 * v) / sessions[0]);
      polyline(good, iu.map((v, i) => [fg.sx(i), fg.sy(v)]), `stroke:${c0};stroke-width:2px`);
      polyline(good, is.map((v, i) => [fg.sx(i), fg.sy(v)]), `stroke:${c1};stroke-width:2px`);
      ink(good, fg.sx(6) + 6, fg.sy(iu[6]) + 4, `Users ${num(iu[6], 0)}`);
      ink(good, fg.sx(6) + 6, fg.sy(is[6]) + 4, `Sessions ${num(is[6], 0)}`);
    } else if (trick === "area") {
      const vals = [["A", 1], ["B", 2]];
      vals.forEach(([n, v], i) => {
        el("circle", { cx: 120 + i * 170, cy: 130, r: 45 * v, style: `fill:${c0}` }, bad);
        ink(bad, 120 + i * 170, 245, `${n} = ${v}`, { "text-anchor": "middle" });
      });
      const f = frame(good, { box: [44, 16, 360, 210], x: [0, 2], y: [0, 2], xticks: [], yticks: [0, 1, 2] });
      vals.forEach(([n, v], i) => {
        const x = f.sx(i + 0.25), w = f.sx(i + 0.75) - x;
        el("path", { d: barV(x, f.sy(0), w, f.sy(v)), style: `fill:${c0}` }, good);
        text(good, x + w / 2, f.T + f.H + 13, n, { "text-anchor": "middle" });
      });
    } else if (trick === "window") {
      const tail = walk.slice(52);
      const lo = Math.min(...tail) * 0.98, hi = Math.max(...tail) * 1.02;
      const fb = frame(bad, { box: [44, 16, 360, 210], x: [52, 59], y: [lo, hi], xticks: [52, 55, 59], yticks: [], ylabel: "price" });
      polyline(bad, tail.map((v, i) => [fb.sx(52 + i), fb.sy(v)]), `stroke:${c0};stroke-width:2px`);
      const top = Math.max(...walk) * 1.05;
      const fg = frame(good, { box: [44, 16, 360, 210], x: [0, 59], y: [0, top], xticks: [0, 20, 40, 59], yticks: [0, 100, 200], ylabel: "price" });
      el("rect", { x: fg.sx(52), y: fg.T, width: fg.sx(59) - fg.sx(52), height: fg.H, style: "fill:currentColor;fill-opacity:0.06" }, good);
      polyline(good, walk.map((v, i) => [fg.sx(i), fg.sy(v)]), `stroke:${c0};stroke-width:2px`);
      text(good, fg.sx(55.5), fg.T + 10, "window shown left", { "text-anchor": "middle" });
    } else {
      const parts = [["A", 30], ["B", 25], ["C", 25], ["D", 20]];
      // 3D pie: squashed, with a depth face on the near half.
      const cx = 210, cy = 110, rx = 150, ry = 62, depth = 26;
      let a0 = -Math.PI * 0.85;
      const slices = parts.map(([n, v]) => { const a1 = a0 + (v / 100) * 2 * Math.PI; const s = { n, v, a0, a1 }; a0 = a1; return s; });
      slices.forEach((s, i) => {
        const pts = [];
        for (let t = 0; t <= 24; t++) {
          const a = s.a0 + ((s.a1 - s.a0) * t) / 24;
          if (Math.sin(a) > 0) pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
        }
        if (pts.length > 1) {
          const d = "M" + pts.map((p) => p.join(",")).join("L") + "L" + pts.slice().reverse().map((p) => `${p[0]},${p[1] + depth}`).join("L") + "Z";
          el("path", { d, style: `fill:${cat(i)};filter:brightness(0.8)` }, bad);
        }
      });
      slices.forEach((s, i) => {
        const large = s.a1 - s.a0 > Math.PI ? 1 : 0;
        const d = `M${cx},${cy}L${cx + rx * Math.cos(s.a0)},${cy + ry * Math.sin(s.a0)}A${rx},${ry} 0 ${large} 1 ${cx + rx * Math.cos(s.a1)},${cy + ry * Math.sin(s.a1)}Z`;
        el("path", { d, style: `fill:${cat(i)};stroke:${surface()};stroke-width:2px` }, bad);
        const am = (s.a0 + s.a1) / 2;
        ink(bad, cx + rx * 1.12 * Math.cos(am), cy + ry * 1.25 * Math.sin(am) + (Math.sin(am) > 0 ? depth : 0) + 4, s.n, { "text-anchor": "middle" });
      });
      const f = frame(good, { box: [44, 16, 360, 210], x: [0, 4], y: [0, 40], xticks: [], yticks: [0, 10, 20, 30, 40] });
      parts.forEach(([n, v], i) => {
        const x = f.sx(i + 0.15), w = f.sx(i + 0.85) - x;
        el("path", { d: barV(x, f.sy(0), w, f.sy(v)), style: `fill:${c0}` }, good);
        text(good, x + w / 2, f.T + f.H + 13, n, { "text-anchor": "middle" });
        ink(good, x + w / 2, f.sy(v) - 5, `${v}%`, { "text-anchor": "middle" });
      });
    }
  }
  root.addEventListener("seg-change", (e) => { trick = e.detail.value; draw(); });
  onTheme(draw);
  draw();
}

// ================================================================ DV4 colour scales

for (const root of document.querySelectorAll("[data-dv-color]")) {
  const svg = root.querySelector("[data-plot]");
  const prof = root.querySelector("[data-profile]");
  const o = outs(root);
  const tip = tipper(root);
  let scale = "sequential", vision = "normal";
  const C = 32, R = 16;
  // A smooth synthetic field in [-1, 1]: two bumps and a dip.
  const field = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const x = i / (C - 1), y = j / (R - 1);
    const v = 1.1 * Math.exp(-((x - 0.25) ** 2 + (y - 0.4) ** 2) / 0.03) - 1.0 * Math.exp(-((x - 0.7) ** 2 + (y - 0.6) ** 2) / 0.05) + 0.35 * Math.sin(6 * x) * y;
    field.push(Math.max(-1, Math.min(1, v)));
  }
  const rainbow = (t) => { const hue = 240 * (1 - t); return hslHex(hue, 0.95, 0.5); };
  function hslHex(h, s, l) {
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgb2hex([f(0), f(8), f(4)]);
  }

  function draw() {
    svg.replaceChildren();
    prof.replaceChildren();
    const fn = scale === "sequential" ? seq() : scale === "diverging" ? div() : rainbow;
    const t = (v) => (scale === "sequential" ? (v + 1) / 2 : (v + 1) / 2);
    const cw = 520 / C, ch = 270 / R;
    field.forEach((v, k) => {
      const i = k % C, j = Math.floor(k / C);
      const c = simulate(fn(t(v)), vision);
      const cell = el("rect", { x: 20 + i * cw, y: 10 + j * ch, width: cw + 0.8, height: ch + 0.8, "shape-rendering": "crispEdges", style: `fill:${c}` }, svg);
      hover(cell, tip, () => `value ${num(v, 2)}\nOKLab L ${num(hexLab(c)[0], 3)}`);
    });
    // Lightness profile of the scale itself.
    const n = 64, pts = [], strip = [];
    for (let s = 0; s <= n; s++) {
      const c = simulate(fn(s / n), vision);
      strip.push(c);
      pts.push(hexLab(c)[0]);
    }
    strip.forEach((c, s) => el("rect", { x: 20 + (s * 520) / (n + 1), y: 2, width: 520 / (n + 1) + 0.8, height: 10, "shape-rendering": "crispEdges", style: `fill:${c}` }, prof));
    const f = { L: 20, W: 520, T: 34, H: 42 };
    const sy = (L) => f.T + f.H - L * f.H;
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.T + f.H, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, prof);
    polyline(prof, pts.map((L, s) => [f.L + (s * f.W) / n, sy(L)]), "stroke:currentColor;stroke-width:1.5px");
    text(prof, f.L, f.T - 6, "OKLab lightness", {});
    text(prof, f.L + f.W, f.T + f.H + 12, "low → high value", { "text-anchor": "end" });
    // Monotonicity: count direction reversals in lightness.
    let rev = 0, dir = 0;
    for (let s = 1; s < pts.length; s++) {
      const d = Math.sign(Math.round((pts[s] - pts[s - 1]) * 1000));
      if (d && dir && d !== dir) rev++;
      if (d) dir = d;
    }
    o.mono.textContent = scale === "diverging" ? (rev === 1 ? "V-shaped (as designed)" : `${rev} reversals`) : rev === 0 ? "monotonic" : `${rev} reversals`;
    o.steps.textContent = `range ΔL ${num(Math.max(...pts) - Math.min(...pts), 2)}`;
    o.verdict.textContent = scale === "rainbow" ? "avoid: false edges, no order" : scale === "diverging" ? "use for polarity" : "use for magnitude";
  }
  root.addEventListener("seg-change", (e) => {
    const v = e.detail.value;
    if (["sequential", "diverging", "rainbow"].includes(v)) scale = v; else vision = v;
    draw();
  });
  onTheme(draw);
  draw();
}

// ================================================================ DV5 small multiples

for (const root of document.querySelectorAll("[data-dv-multiples]")) {
  const svg = root.querySelector("[data-plot]");
  const picks = root.querySelector("[data-series-picks]");
  const tip = tipper(root);
  const rng = mulberry32(23);
  const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const N = 36;
  const data = names.map((_, k) => {
    let v = 40 + 25 * rng();
    const drift = (rng() - 0.4) * 1.2, amp = 4 + 6 * rng();
    return Array.from({ length: N }, (_, i) => (v += drift + 2.2 * gauss(rng)) + amp * Math.sin((i / 12) * 2 * Math.PI + k));
  });
  const lo = Math.floor(Math.min(...data.flat()) / 10) * 10, hi = Math.ceil(Math.max(...data.flat()) / 10) * 10;
  let layout = "spaghetti", focus = 2;

  names.forEach((n, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `Series ${n}`;
    b.className = "rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:text-foreground";
    b.setAttribute("aria-pressed", String(k === focus));
    b.addEventListener("click", () => {
      focus = k;
      for (const x of picks.children) x.setAttribute("aria-pressed", String(x === b));
      if (layout === "spaghetti") layout = "highlight";
      root.querySelectorAll("[data-seg]").forEach((s) => s.setAttribute("aria-selected", String(s.dataset.seg === layout)));
      draw();
    });
    picks.append(b);
  });

  function draw() {
    svg.replaceChildren();
    tip.hide();
    if (layout === "multiples") {
      const cols = 4, pw = 128, ph = 130;
      data.forEach((s, k) => {
        const c = k % cols, r = Math.floor(k / cols);
        const f = frame(svg, { box: [24 + c * (pw + 8), 22 + r * (ph + 24), pw - 8, ph - 22], x: [0, N - 1], y: [lo, hi], xticks: [], yticks: c === 0 ? [lo, hi] : [] });
        ink(svg, f.L, f.T - 6, `Series ${names[k]}`);
        polyline(svg, s.map((v, i) => [f.sx(i), f.sy(v)]), `stroke:${cat(0)};stroke-width:2px;stroke-linejoin:round`);
        crosshair(svg, f, tip, N - 1, (i) => `Series ${names[k]} · month ${i + 1}\n${num(s[i], 1)}`, (i) => [[f.sx(i), f.sy(s[i]), cat(0)]]);
      });
      return;
    }
    const f = frame(svg, { box: [40, 14, 470, 270], x: [0, N - 1], y: [lo, hi], xticks: [0, 12, 24, 35], yticks: [lo, (lo + hi) / 2, hi], xfmt: (i) => `month ${i + 1}`, ylabel: "value" });
    const order = layout === "highlight" ? [...data.keys()].filter((k) => k !== focus).concat(focus) : [...data.keys()];
    for (const k of order) {
      const on = layout === "spaghetti" || k === focus;
      const color = layout === "spaghetti" ? cat(k) : k === focus ? cat(0) : muted();
      polyline(svg, data[k].map((v, i) => [f.sx(i), f.sy(v)]), `stroke:${color};stroke-width:${on && layout === "highlight" ? 2.5 : 2}px;stroke-linejoin:round`);
    }
    if (layout === "highlight") {
      ink(svg, f.sx(N - 1) + 6, f.sy(data[focus][N - 1]) + 4, `Series ${names[focus]}`);
    } else {
      // Legend for 8 series (and the point: nobody can match eight hues).
      names.forEach((n, k) => {
        el("rect", { x: 516, y: 20 + k * 16, width: 10, height: 10, rx: 2, style: `fill:${cat(k)}` }, svg);
        text(svg, 530, 29 + k * 16, n);
      });
    }
    crosshair(svg, f, tip, N - 1,
      (i) => layout === "highlight" ? `month ${i + 1}\nSeries ${names[focus]} ${num(data[focus][i], 1)}` : `month ${i + 1}\n` + names.map((n, k) => `${n} ${num(data[k][i], 1)}`).join("\n"),
      (i) => (layout === "highlight" ? [focus] : [...data.keys()]).map((k) => [f.sx(i), f.sy(data[k][i]), layout === "highlight" ? cat(0) : cat(k)]));
  }
  root.addEventListener("seg-change", (e) => { layout = e.detail.value; draw(); });
  onTheme(draw);
  draw();
}

// ================================================================ DV6 overplotting

for (const root of document.querySelectorAll("[data-dv-overplot]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const tip = tipper(root);
  const rng = mulberry32(99);
  const N = 20000;
  const pts = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    let x, y;
    if (rng() < 0.85) {
      const a = gauss(rng), b = gauss(rng);
      x = 1.1 * a; y = 0.6 * (0.6 * a + 0.8 * b);
    } else {
      x = 0.75 + 0.18 * gauss(rng); y = -0.05 + 0.18 * gauss(rng);
    }
    pts[2 * i] = x; pts[2 * i + 1] = y;
  }
  let mode = "raw", bins = null;
  const s = scrubAll(root, draw);

  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    ctx.fillStyle = surface();
    ctx.fillRect(0, 0, W, H);
    const px = (x) => ((x + 4) / 8) * W, py = (y) => H - ((y + 3) / 6) * H;
    o.n.textContent = fmtInt(N);
    bins = null;
    if (mode === "raw" || mode === "alpha") {
      ctx.fillStyle = cat(0);
      ctx.globalAlpha = mode === "alpha" ? s.alpha.get() : 1;
      for (let i = 0; i < N; i++) { ctx.beginPath(); ctx.arc(px(pts[2 * i]), py(pts[2 * i + 1]), 1.6, 0, 2 * Math.PI); ctx.fill(); }
      ctx.globalAlpha = 1;
      o.max.textContent = "—";
      return;
    }
    const size = s.bin.get();
    const counts = new Map();
    const key = mode === "hexbin" ? hexKey(size) : (x, y) => [Math.floor(x / size), Math.floor(y / size)];
    for (let i = 0; i < N; i++) {
      const k = key(px(pts[2 * i]), py(pts[2 * i + 1])).join(",");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const max = Math.max(...counts.values());
    const sc = seq();
    o.max.textContent = `${fmtInt(max)} points`;
    bins = { counts, size, key };
    for (const [k, c] of counts) {
      const [a, b] = k.split(",").map(Number);
      ctx.fillStyle = sc(0.12 + 0.88 * Math.sqrt(c / max));
      if (mode === "hexbin") {
        const [cx, cy] = hexCenter(a, b, size);
        ctx.beginPath();
        for (let v = 0; v < 6; v++) { const ang = Math.PI / 6 + (v * Math.PI) / 3; ctx.lineTo(cx + size * Math.cos(ang), cy + size * Math.sin(ang)); }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(a * size, b * size, size - 1, size - 1);
      }
    }
  }
  // Pointy-top hexagons, axial coordinates (Red Blob Games' formulas).
  function hexKey(size) {
    return (x, y) => {
      const q = ((Math.sqrt(3) / 3) * x - y / 3) / size, r = ((2 / 3) * y) / size;
      let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
      const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dz <= dy) ry = -rx - rz; else rz = -rx - ry;
      return [rx, rz];
    };
  }
  const hexCenter = (q, r, size) => [size * Math.sqrt(3) * (q + r / 2), size * 1.5 * r];

  canvas.addEventListener("pointermove", (e) => {
    if (!bins) return tip.hide();
    const r = canvas.getBoundingClientRect();
    const k = bins.key(e.clientX - r.left, e.clientY - r.top).join(",");
    tip.show(e, `${fmtInt(bins.counts.get(k) ?? 0)} points in this bin`);
  });
  canvas.addEventListener("pointerleave", () => tip.hide());
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  new ResizeObserver(draw).observe(canvas);
  onTheme(draw);
}

// ================================================================ DV7 log scale

for (const root of document.querySelectorAll("[data-dv-log]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const tip = tipper(root);
  let log = false;
  const s = scrubAll(root, draw);
  const N = 30;
  function series() {
    const rates = [s.ra.get(), s.rb.get(), s.rc.get()].map((r) => r / 100);
    return rates.map((r, k) => {
      const out = [100];
      for (let t = 1; t <= N; t++) out.push(out[t - 1] * (1 + (k === 2 && t > 18 ? 0.05 : r)));
      return out;
    });
  }
  function draw() {
    svg.replaceChildren();
    const data = series();
    const max = Math.max(...data.flat());
    const names = ["A", "B", "C"];
    let f;
    if (log) {
      const top = Math.ceil(Math.log10(max));
      const ticks = Array.from({ length: top - 1 }, (_, i) => i + 2);
      f = frame(svg, { box: [56, 14, 440, 270], x: [0, N], y: [2, top], xticks: [0, 10, 20, 30], yticks: ticks, yfmt: (v) => fmtInt(10 ** v), xlabel: "step", ylabel: "value (log)" });
    } else {
      const top = Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max));
      f = frame(svg, { box: [56, 14, 440, 270], x: [0, N], y: [0, top], xticks: [0, 10, 20, 30], yticks: [0, top / 2, top], yfmt: fmtInt, xlabel: "step", ylabel: "value" });
    }
    const Y = (v) => f.sy(log ? Math.log10(v) : v);
    data.forEach((d, k) => {
      polyline(svg, d.map((v, t) => [f.sx(t), Y(v)]), `stroke:${cat(k)};stroke-width:2px;stroke-linejoin:round`);
      ink(svg, f.sx(N) + 6, Y(d[N]) + 4, `${names[k]} ${fmtInt(d[N])}`);
    });
    crosshair(svg, f, tip, N, (t) => `step ${t}\n` + data.map((d, k) => `${names[k]} ${fmtInt(d[t])}`).join("\n"), (t) => data.map((d, k) => [f.sx(t), Y(d[t]), cat(k)]));
    const dbl = (r) => `${num(Math.log(2) / Math.log(1 + r / 100), 1)} steps`;
    o.da.textContent = dbl(s.ra.get()); o.db.textContent = dbl(s.rb.get()); o.dc.textContent = `${dbl(s.rc.get())}, then ${dbl(5)}`;
  }
  root.addEventListener("seg-change", (e) => { log = e.detail.value === "log"; draw(); });
  onTheme(draw);
  draw();
}

// ================================================================ DV8 uncertainty

for (const root of document.querySelectorAll("[data-dv-uncert]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const tip = tipper(root);
  const est = [["A", 2.0, 1.0], ["B", 1.2, 0.8], ["C", 0.4, 0.6], ["D", -0.3, 1.2]];
  let enc = "bars";
  const s = scrubAll(root, draw);

  function draw() {
    svg.replaceChildren();
    const level = s.level.get() / 100;
    const z = invNorm((1 + level) / 2);
    const f = frame(svg, { box: [40, 10, 500, 250], x: [-4, 5], y: [0, 4], xticks: [-4, -2, 0, 2, 4], yticks: [], xlabel: "effect" });
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.45" }, svg);
    const c = cat(0), rowH = f.H / est.length;
    est.forEach(([n, m, se], i) => {
      const y = f.T + rowH * (i + 0.5);
      text(svg, f.L - 8, y + 4, n, { "text-anchor": "end" });
      const lo = m - z * se, hi = m + z * se;
      if (enc === "bars") {
        el("line", { x1: f.sx(lo), x2: f.sx(hi), y1: y, y2: y, style: `stroke:${c};stroke-width:2px` }, svg);
        for (const x of [lo, hi]) el("line", { x1: f.sx(x), x2: f.sx(x), y1: y - 6, y2: y + 6, style: `stroke:${c};stroke-width:2px` }, svg);
        el("circle", { cx: f.sx(m), cy: y, r: 5, style: `fill:${c};stroke:${surface()};stroke-width:2px` }, svg);
      } else if (enc === "band") {
        el("rect", { x: f.sx(lo), y: y - 9, width: f.sx(hi) - f.sx(lo), height: 18, rx: 4, style: `fill:${c};fill-opacity:0.25` }, svg);
        el("line", { x1: f.sx(m), x2: f.sx(m), y1: y - 11, y2: y + 11, style: `stroke:${c};stroke-width:2px` }, svg);
      } else if (enc === "gradient") {
        const K = 60;
        for (let k = 0; k < K; k++) {
          const x0 = m - 3.5 * se + (7 * se * k) / K, x1 = x0 + (7 * se) / K;
          const d = Math.exp(-(((x0 + x1) / 2 - m) ** 2) / (2 * se * se));
          el("rect", { x: f.sx(x0), y: y - 11, width: f.sx(x1) - f.sx(x0) + 0.4, height: 22, style: `fill:${c};fill-opacity:${(0.85 * d).toFixed(3)}` }, svg);
        }
      } else {
        // 20 quantile dots, stacked in bins one dot wide (Kay et al. 2016).
        const r = 4.2, bw = (2 * r) / (f.W / 9);
        const stacks = new Map();
        for (let q = 0; q < 20; q++) {
          const v = m + se * invNorm((q + 0.5) / 20);
          const b = Math.round(v / bw);
          const h = stacks.get(b) ?? 0;
          stacks.set(b, h + 1);
          const below = v < 0;
          el("circle", { cx: f.sx(b * bw), cy: y + rowH * 0.32 - h * (2 * r + 1), r, style: `fill:${below ? muted() : c};stroke:${surface()};stroke-width:1px` }, svg);
        }
      }
      const hit = el("rect", { x: f.L, y: y - rowH / 2, width: f.W, height: rowH, style: "fill:transparent" }, svg);
      hover(hit, tip, `${n}: ${num(m, 1)} ± ${num(se, 1)} (SE)\n${Math.round(level * 100)}% interval ${num(lo, 2)} to ${num(hi, 2)}\nP(below 0) ${num(normCdf(-m / se) * 100, 1)}%`);
    });
    o.z.textContent = num(z, 3);
    o.pbelow.textContent = `${num(normCdf(0.3 / 1.2) * 100, 1)}% (${enc === "dots" ? "count the grey dots" : "area left of 0"})`;
  }
  root.addEventListener("seg-change", (e) => { enc = e.detail.value; draw(); });
  onTheme(draw);
  draw();
}

// ================================================================ DV9 same statistics

for (const root of document.querySelectorAll("[data-dv-samestats]")) {
  const host = root.querySelector("[data-panels]");
  let seed = 3;
  const s = scrubAll(root, draw);
  const SHAPES = [
    ["Ring", (rng) => { const a = 2 * Math.PI * rng(); return [Math.cos(a) + 0.05 * gauss(rng), Math.sin(a) + 0.05 * gauss(rng)]; }],
    ["Two clusters", (rng) => { const k = rng() < 0.5 ? -1 : 1; return [k + 0.25 * gauss(rng), -k * 0.6 + 0.25 * gauss(rng)]; }],
    ["Cross", (rng) => { const t = 2 * rng() - 1; return rng() < 0.5 ? [t, t + 0.04 * gauss(rng)] : [t, -t + 0.04 * gauss(rng)]; }],
    ["Wave", (rng) => { const x = 2 * rng() - 1; return [x, Math.sin(3 * x) + 0.08 * gauss(rng)]; }],
  ];
  const stats = (P) => {
    const n = P.length, mx = P.reduce((a, p) => a + p[0], 0) / n, my = P.reduce((a, p) => a + p[1], 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of P) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    return { mx, my, sx: Math.sqrt(sxx / (n - 1)), sy: Math.sqrt(syy / (n - 1)), r: sxy / Math.sqrt(sxx * syy) };
  };
  // Standardise x; Gram–Schmidt y against x; mix to the target r; rescale.
  function conform(P, T) {
    const n = P.length, st = stats(P);
    const zx = P.map((p) => (p[0] - st.mx) / st.sx);
    let zy = P.map((p) => (p[1] - st.my) / st.sy);
    const proj = zy.reduce((a, v, i) => a + v * zx[i], 0) / zx.reduce((a, v) => a + v * v, 0);
    let w = zy.map((v, i) => v - proj * zx[i]);
    const sw = Math.sqrt(w.reduce((a, v) => a + v * v, 0) / (n - 1));
    w = w.map((v) => v / sw);
    return zx.map((x, i) => [T.mx + T.sx * x, T.my + T.sy * (T.r * x + Math.sqrt(1 - T.r * T.r) * w[i])]);
  }
  function draw() {
    host.replaceChildren();
    const T = { mx: s.mx.get(), my: s.my.get(), sx: s.sx.get(), sy: s.sy.get(), r: s.r.get() };
    SHAPES.forEach(([name, gen], k) => {
      const rng = mulberry32(seed * 101 + k);
      const P = conform(Array.from({ length: 80 }, () => gen(rng)), T);
      const st = stats(P);
      const fig = document.createElement("figure");
      fig.className = "flex flex-col gap-1 rounded-lg border bg-background p-2";
      const svg = el("svg", { viewBox: "0 0 200 200", class: "block w-full", role: "img", "aria-label": name });
      const f = frame(svg, { box: [8, 6, 186, 186], x: [0, 100], y: [0, 100], xticks: [], yticks: [] });
      for (const [x, y] of P) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 3, style: `fill:${cat(0)};stroke:${surface()};stroke-width:1px` }, svg);
      const cap = document.createElement("figcaption");
      cap.className = "flex flex-col px-1 font-mono text-[10px] leading-4 text-muted-foreground";
      const title = document.createElement("span");
      title.className = "font-sans text-xs text-foreground";
      title.textContent = name;
      const line = document.createElement("span");
      line.className = "tabular-nums";
      line.textContent = `x̄ ${num(st.mx, 2)} ȳ ${num(st.my, 2)} sx ${num(st.sx, 2)} sy ${num(st.sy, 2)} r ${num(st.r, 3)}`;
      cap.append(title, line);
      fig.append(svg, cap);
      host.append(fig);
    });
  }
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });
  onTheme(draw);
  draw();
}

// ================================================================ DV10 grammar of graphics

for (const root of document.querySelectorAll("[data-dv-grammar]")) {
  const ta = root.querySelector("[data-spec]");
  const svg = root.querySelector("[data-plot]");
  const err = root.querySelector('[data-out="error"]');
  const tip = tipper(root);

  function fail(msg) {
    err.textContent = msg;
    err.classList.add("text-del");
  }

  function draw() {
    svg.replaceChildren();
    tip.hide();
    let spec;
    try { spec = JSON.parse(ta.value); } catch (e) { return fail(`JSON: ${e.message}`); }
    const d = spec?.data, mark = spec?.mark, enc = spec?.encoding ?? {};
    if (!Array.isArray(d) || !d.length) return fail("spec.data must be a non-empty array of objects");
    if (!["line", "bar", "point"].includes(mark)) return fail('spec.mark must be "line", "bar" or "point"');
    const fx = enc.x?.field, fy = enc.y?.field, fc = enc.color?.field;
    if (!fx || !fy) return fail("encoding.x.field and encoding.y.field are required");
    for (const f of [fx, fy, fc].filter(Boolean)) if (!d.every((row) => row && f in row)) return fail(`field "${f}" is missing from some rows`);
    if (!d.every((row) => Number.isFinite(row[fy]))) return fail(`y field "${fy}" must be numeric`);
    // Colour follows the entity: groups take slots in order of first appearance.
    const groups = fc ? [...new Set(d.map((r) => String(r[fc])))] : [""];
    if (groups.length > 8) return fail(`${groups.length} colour groups: more than 8 categorical slots; facet or fold into "Other"`);
    err.textContent = `valid spec · ${d.length} rows · ${mark}${fc ? ` · ${groups.length} groups` : ""}`;
    err.classList.remove("text-del");

    const numericX = d.every((r) => Number.isFinite(r[fx]));
    const xs = numericX ? null : [...new Set(d.map((r) => String(r[fx])))];
    const yv = d.map((r) => r[fy]);
    const y0 = mark === "bar" ? Math.min(0, ...yv) : Math.min(...yv), y1 = Math.max(...yv, 0.0001);
    const pad = (y1 - y0) * 0.08;
    const top = groups.length > 1 ? 34 : 14;
    let f;
    if (numericX) {
      const xv = d.map((r) => r[fx]);
      const xmin = Math.min(...xv), xmax = Math.max(...xv);
      const span = xmax - xmin || 1;
      const xpad = mark === "bar" ? span / (2 * Math.max(1, new Set(xv).size - 1)) : 0;
      f = frame(svg, { box: [50, top, 410, 294 - top], x: [xmin - xpad, xmax + xpad], y: [mark === "bar" ? y0 : y0 - pad, y1 + pad], xticks: [...new Set(xv)].sort((a, b) => a - b).slice(0, 12), yticks: niceTicks(mark === "bar" ? y0 : y0 - pad, y1 + pad), xlabel: fx, ylabel: fy });
    } else {
      f = frame(svg, { box: [50, top, 410, 294 - top], x: [-0.5, xs.length - 0.5], y: [mark === "bar" ? y0 : y0 - pad, y1 + pad], xticks: [], yticks: niceTicks(mark === "bar" ? y0 : y0 - pad, y1 + pad), xlabel: fx, ylabel: fy });
      xs.forEach((v, i) => text(svg, f.sx(i), f.T + f.H + 13, v, { "text-anchor": "middle" }));
    }
    const X = (r) => (numericX ? r[fx] : xs.indexOf(String(r[fx])));
    groups.forEach((g, gi) => {
      const rows = d.filter((r) => !fc || String(r[fc]) === g).sort((a, b) => X(a) - X(b));
      const color = cat(gi);
      const label = (r) => `${fc ? `${g} · ` : ""}${fx} ${r[fx]}\n${fy} ${r[fy]}`;
      if (mark === "line") {
        polyline(svg, rows.map((r) => [f.sx(X(r)), f.sy(r[fy])]), `stroke:${color};stroke-width:2px;stroke-linejoin:round`);
        for (const r of rows) hover(el("circle", { cx: f.sx(X(r)), cy: f.sy(r[fy]), r: 9, style: "fill:transparent" }, svg), tip, label(r));
        if (groups.length > 1 && groups.length <= 4 && rows.length) { const last = rows[rows.length - 1]; ink(svg, f.sx(X(last)) + 6, f.sy(last[fy]) + 4, g); }
      } else if (mark === "point") {
        for (const r of rows) hover(el("circle", { cx: f.sx(X(r)), cy: f.sy(r[fy]), r: 5, style: `fill:${color};stroke:${surface()};stroke-width:2px` }, svg), tip, label(r));
      } else {
        const ux = numericX ? [...new Set(d.map((r) => r[fx]))].sort((a, b) => a - b) : null;
        const gap = numericX ? (ux.length > 1 ? Math.min(...ux.slice(1).map((v, i) => v - ux[i])) : 1) : 1;
        const slot = numericX ? Math.abs(f.sx(ux[0] + gap) - f.sx(ux[0])) : f.sx(1) - f.sx(0);
        const bw = (slot * 0.8) / groups.length;
        for (const r of rows) {
          const x = f.sx(X(r)) - (slot * 0.8) / 2 + gi * bw;
          hover(el("path", { d: barV(x + 1, f.sy(Math.max(0, y0)), bw - 2, f.sy(r[fy])), style: `fill:${color}` }, svg), tip, label(r));
        }
      }
    });
    if (groups.length > 1) {
      groups.forEach((g, gi) => {
        el("rect", { x: 50 + gi * 90, y: 6, width: 10, height: 10, rx: 2, style: `fill:${cat(gi)}` }, svg);
        text(svg, 66 + gi * 90, 15, g);
      });
    }
  }
  function niceTicks(a, b) {
    const step = 10 ** Math.floor(Math.log10((b - a) / 4 || 1));
    const m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= 5) * step;
    const out = [];
    for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) out.push(+v.toFixed(10));
    return out;
  }
  ta.addEventListener("input", draw);
  root.addEventListener("seg-change", (e) => {
    // Swap only the mark, so the user's formatting survives.
    const re = /("mark"\s*:\s*)"[^"]*"/;
    if (re.test(ta.value)) ta.value = ta.value.replace(re, `$1"${e.detail.value}"`);
    draw();
  });
  onTheme(draw);
  draw();
}

