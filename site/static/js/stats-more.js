// Statistics blocks, part two: Bayes with natural frequencies, correlation
// and Anscombe's quartet, the bootstrap, regression to the mean and
// descriptive statistics.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import * as S from "./stats-math.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const neg = (s) => String(s).replace("-", "−");
const tickFmt = (v) => neg(Math.abs(v) < 1e-9 ? "0" : String(+v.toPrecision(4)));
const niceTicks = (a, b, n = 6) => {
  const raw = (b - a) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
};
/** A readable number: integers as is, otherwise up to `d` decimals. */
const smart = (v, d = 2) => (Number.isInteger(v) ? neg(v.toLocaleString("en")) : neg(+v.toFixed(d)));
const pct = (v, d = 1) => `${num(100 * v, d)}%`;

// ============================================================ Bayes

for (const root of document.querySelectorAll("[data-bayes]")) {
  const grid = root.querySelector("[data-grid]");
  const tree = root.querySelector("[data-tree]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const prev = s.prev.get() / 100, sens = s.sens.get() / 100, spec = s.spec.get() / 100;
    // Whole people out of 1,000; the readouts use the exact probabilities.
    const D = Math.round(1000 * prev), H = 1000 - D;
    const TP = Math.round(D * sens), FN = D - TP;
    const FP = Math.round(H * (1 - spec)), TN = H - FP;
    const ppv = (sens * prev) / (sens * prev + (1 - spec) * (1 - prev));
    const npv = (spec * (1 - prev)) / (spec * (1 - prev) + (1 - sens) * prev);

    grid.replaceChildren();
    const kinds = [
      [TP, "fill:var(--brand)"],
      [FN, "fill:var(--background);stroke:var(--brand);stroke-width:1.5"],
      [FP, "fill:var(--vec-u)"],
      [TN, "fill:color-mix(in oklab, var(--foreground) 18%, transparent)"],
    ];
    let i = 0;
    for (const [count, style] of kinds) {
      for (let c = 0; c < count; c++, i++) {
        const col = i % 50, row = Math.floor(i / 50);
        el("circle", { cx: 6 + col * 12, cy: 6 + row * 12, r: 4, style }, grid);
      }
    }

    tree.replaceChildren();
    const node = (x, y, label, sub, color = "var(--foreground)") => {
      text(tree, x, y, label, { "text-anchor": "middle", class: "font-mono text-[11px] font-medium", style: `fill:${color}` });
      if (sub) text(tree, x, y + 13, sub, { "text-anchor": "middle" });
    };
    const edge = (x1, y1, x2, y2, label) => {
      el("line", { x1, y1, x2, y2, style: "stroke:currentColor;stroke-opacity:0.25" }, tree);
      if (label) text(tree, (x1 + x2) / 2, (y1 + y2) / 2 - 4, label, { "text-anchor": "middle" });
    };
    edge(78, 85, 222, 45, pct(prev, 1));
    edge(78, 85, 222, 125, pct(1 - prev, 1));
    edge(282, 45, 418, 22, pct(sens));
    edge(282, 45, 418, 64, "");
    edge(282, 125, 418, 106, pct(1 - spec));
    edge(282, 125, 418, 148, "");
    node(50, 89, "1,000", "people");
    node(252, 42, `${D} sick`);
    node(252, 128, `${H.toLocaleString("en")} healthy`);
    node(470, 22, `${TP} test +`, "", "var(--brand)");
    node(470, 64, `${FN} test −`);
    node(470, 106, `${FP} test +`, "", "var(--vec-u)");
    node(470, 148, `${TN.toLocaleString("en")} test −`);
    text(tree, 4, 12, `PPV ≈ ${TP} / (${TP} + ${FP}) of the positives`, { class: "fill-foreground font-mono text-[10px]" });

    o.ppvbig.textContent = pct(ppv);
    o.ppv.textContent = pct(ppv, 2);
    o.npv.textContent = pct(npv, 2);
    o.pos.textContent = `${TP + FP} of 1,000 (${TP} true)`;
  }
  draw();
}

// ============================================================ Correlation

const ANSCOMBE_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const ANSCOMBE = {
  I: [ANSCOMBE_X, [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]],
  II: [ANSCOMBE_X, [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74]],
  III: [ANSCOMBE_X, [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73]],
  IV: [[8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8], [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.5, 5.56, 7.91, 6.89]],
};

for (const root of document.querySelectorAll("[data-corr]")) {
  const sim = root.querySelector("[data-corr-sim]");
  const svg = sim.querySelector("[data-plot]");
  const o = outs(sim);
  let seed = 1, outlier = false;
  const s = scrubAll(sim, draw);
  onToggle(sim, (_, on) => { outlier = on; draw(); });
  sim.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const rho = s.rho.get(), n = Math.round(s.n.get());
    const rng = S.mulberry32(seed * 31 + 7);
    const x = [], y = [];
    for (let i = 0; i < n; i++) {
      const z1 = S.gauss(rng), z2 = S.gauss(rng);
      x.push(z1);
      y.push(rho * z1 + Math.sqrt(1 - rho * rho) * z2);
    }
    if (outlier) { x.push(3.4); y.push(-3.4 * Math.sign(rho || 1)); }
    svg.replaceChildren();
    const f = frame(svg, { box: [36, 12, 470, 336], x: [-4, 4], y: [-4, 4], xticks: [-4, -2, 0, 2, 4], yticks: [-4, -2, 0, 2, 4], xfmt: tickFmt, yfmt: tickFmt, xlabel: "x", ylabel: "y" });
    const rad = n > 400 ? 1.8 : n > 150 ? 2.4 : 3.2;
    x.forEach((xi, i) => {
      const last = outlier && i === x.length - 1;
      el("circle", { cx: f.sx(xi), cy: f.sy(Math.max(-4, Math.min(4, y[i]))), r: last ? 5 : rad,
        style: last ? "fill:var(--background);stroke:var(--code-del);stroke-width:2" : "fill:var(--brand);fill-opacity:0.6" }, svg);
    });
    const [a, b] = S.ols(x, y);
    polyline(svg, [[f.sx(-4), f.sy(a - 4 * b)], [f.sx(4), f.sy(a + 4 * b)]].map(([px, py]) => [px, Math.max(f.T, Math.min(f.T + f.H, py))]), "stroke:var(--foreground);stroke-width:1.5");
    o.r.textContent = num(S.pearson(x, y), 3);
    o.rs.textContent = num(S.pearson(S.ranks(x), S.ranks(y)), 3);
    o.line.textContent = `ŷ = ${num(a, 2)} ${b < 0 ? "−" : "+"} ${num(Math.abs(b), 2)}x`;
  }
  draw();

  for (const [k, [ax, ay]] of Object.entries(ANSCOMBE)) {
    const g = root.querySelector(`[data-set="${k}"]`);
    const f = frame(g, { box: [30, 8, 400, 214], x: [2, 20], y: [2, 14], xticks: [4, 8, 12, 16, 20], yticks: [4, 8, 12], xfmt: tickFmt, yfmt: tickFmt });
    const [a, b] = S.ols(ax, ay);
    polyline(g, [[f.sx(2), f.sy(a + 2 * b)], [f.sx(20), f.sy(a + 20 * b)]], "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.25");
    ax.forEach((xi, i) => el("circle", { cx: f.sx(xi), cy: f.sy(ay[i]), r: 3.5, style: "fill:var(--brand);fill-opacity:0.85" }, g));
    root.querySelector(`[data-stats="${k}"]`).textContent =
      `x̄ ${num(S.mean(ax), 1)} · ȳ ${num(S.mean(ay), 2)} · s²ₓ ${num(S.sd(ax) ** 2, 1)} · r ${num(S.pearson(ax, ay), 3)} · ŷ = ${num(a, 2)} + ${num(b, 3)}x`;
  }
}

// ============================================================ Bootstrap

for (const root of document.querySelectorAll("[data-boot]")) {
  const sampleSvg = root.querySelector("[data-sample]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let dataSeed = 5, bootSeed = 1, stat = "mean";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { stat = e.detail.value; draw(); });
  root.querySelector("[data-action=resample]").addEventListener("click", () => { bootSeed++; draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { dataSeed++; draw(); });

  function draw() {
    const r1 = S.mulberry32(dataSeed * 977);
    const data = Array.from({ length: 15 }, () => Math.round(Math.exp(3 + 0.6 * S.gauss(r1)) * 10) / 10);
    const f = stat === "mean" ? S.mean : S.median;
    const obs = f(data);
    const B = Math.round(s.B.get());
    const r2 = S.mulberry32(bootSeed * 6151 + dataSeed);
    const boots = new Float64Array(B);
    const tmp = new Array(15);
    for (let b = 0; b < B; b++) {
      for (let i = 0; i < 15; i++) tmp[i] = data[Math.floor(r2() * 15)];
      boots[b] = f(tmp);
    }
    const sorted = Array.from(boots).sort((a, b) => a - b);
    const ci = [S.quantile(sorted, 0.025), S.quantile(sorted, 0.975)];
    const se = S.sd(sorted);
    const lo = Math.min(...data) * 0.9, hi = Math.max(...data) * 1.05;

    sampleSvg.replaceChildren();
    const g = frame(sampleSvg, { box: [44, 8, 540, 34], x: [lo, hi], y: [0, 1], xticks: niceTicks(lo, hi, 8), yticks: [], xfmt: tickFmt });
    text(sampleSvg, 4, 28, "data");
    data.forEach((v, i) => el("circle", { cx: g.sx(v), cy: g.T + 10 + (i % 3) * 7, r: 3.5, style: "fill:var(--foreground);fill-opacity:0.6" }, sampleSvg));
    el("line", { x1: g.sx(obs), x2: g.sx(obs), y1: g.T, y2: g.T + g.H, style: "stroke:var(--brand);stroke-width:2" }, sampleSvg);

    svg.replaceChildren();
    const x0 = sorted[0], x1 = sorted[sorted.length - 1];
    const pad = (x1 - x0) * 0.08 || 1;
    const bins = 50, w = (x1 - x0 + 2 * pad) / bins;
    const counts = new Array(bins).fill(0);
    for (const v of sorted) counts[Math.min(bins - 1, Math.floor((v - x0 + pad) / w))]++;
    const ymax = Math.max(...counts) * 1.15;
    const h = frame(svg, { box: [44, 10, 540, 216], x: [x0 - pad, x1 + pad], y: [0, ymax], xticks: niceTicks(x0 - pad, x1 + pad, 8), yticks: niceTicks(0, ymax, 3), xfmt: tickFmt, yfmt: tickFmt, xlabel: `bootstrap ${stat}`, ylabel: "count" });
    counts.forEach((c, i) => el("rect", { x: h.sx(x0 - pad + i * w) + 0.5, y: h.sy(c), width: Math.max(0.5, h.sx(x0 + w) - h.sx(x0) - 1), height: h.T + h.H - h.sy(c), style: "fill:var(--foreground);fill-opacity:0.28" }, svg));
    const band = (a, b, y, color, label) => {
      el("line", { x1: h.sx(a), x2: h.sx(b), y1: y, y2: y, style: `stroke:${color};stroke-width:3;stroke-linecap:round` }, svg);
      for (const v of [a, b]) el("line", { x1: h.sx(v), x2: h.sx(v), y1: h.T, y2: h.T + h.H, style: `stroke:${color};stroke-dasharray:3 3;stroke-opacity:0.8` }, svg);
      text(svg, h.sx(b) + 6, y + 3, label, { style: `fill:${color}` });
    };
    band(ci[0], ci[1], h.T + 8, "var(--brand)", "percentile");
    const n = data.length, tc = S.tQuantile(0.975, n - 1);
    const tci = [S.mean(data) - (tc * S.sd(data)) / Math.sqrt(n), S.mean(data) + (tc * S.sd(data)) / Math.sqrt(n)];
    if (stat === "mean") band(tci[0], tci[1], h.T + 22, "var(--vec-u)", "t");
    el("line", { x1: h.sx(obs), x2: h.sx(obs), y1: h.T, y2: h.T + h.H, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);

    o.obs.textContent = `${stat} = ${num(obs, 2)}`;
    o.se.textContent = num(se, 3);
    o.pci.textContent = `[${num(ci[0], 2)}, ${num(ci[1], 2)}]`;
    o.tci.textContent = stat === "mean" ? `[${num(tci[0], 2)}, ${num(tci[1], 2)}]` : "— (no simple formula)";
  }
  draw();
}

// ============================================================ Regression to the mean

for (const root of document.querySelectorAll("[data-rtm]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const N = 500;
  let seed = 9, z;
  const s = scrubAll(root, draw);
  const reseed = () => {
    const r = S.mulberry32(seed * 8191);
    z = Array.from({ length: N }, () => [S.gauss(r), S.gauss(r), S.gauss(r)]);
  };
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; reseed(); draw(); });

  function draw() {
    const noise = s.noise.get(), top = s.top.get() / 100;
    // The same people for every noise level: only the error's scale moves.
    const ability = z.map((v) => 100 + 10 * v[0]);
    const t1 = ability.map((a, i) => a + noise * z[i][1]);
    const t2 = ability.map((a, i) => a + noise * z[i][2]);
    const cut = S.quantile([...t1].sort((a, b) => a - b), 1 - top);
    const sel = t1.map((v) => v >= cut);
    const m1 = S.mean(t1.filter((_, i) => sel[i])), m2 = S.mean(t2.filter((_, i) => sel[i]));
    const rel = 100 / (100 + noise * noise);

    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 466, 346], x: [55, 145], y: [55, 145], xticks: [60, 80, 100, 120, 140], yticks: [60, 80, 100, 120, 140], xlabel: "test 1", ylabel: "test 2" });
    const clampY = (v) => Math.max(55, Math.min(145, v));
    polyline(svg, [[f.sx(55), f.sy(55)], [f.sx(145), f.sy(145)]], "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4");
    text(svg, f.sx(143), f.sy(143) + 12, "same score", { "text-anchor": "end" });
    el("rect", { x: f.sx(cut), y: f.T, width: f.sx(145) - f.sx(cut), height: f.H, style: "fill:var(--brand);fill-opacity:0.05" }, svg);
    el("line", { x1: f.sx(cut), x2: f.sx(cut), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 3" }, svg);
    t1.forEach((v, i) => el("circle", { cx: f.sx(clampY(v)), cy: f.sy(clampY(t2[i])), r: sel[i] ? 3 : 2.2,
      style: sel[i] ? "fill:var(--brand);fill-opacity:0.8" : "fill:var(--foreground);fill-opacity:0.2" }, svg));
    const [a, b] = S.ols(t1, t2);
    polyline(svg, [[f.sx(55), f.sy(clampY(a + 55 * b))], [f.sx(145), f.sy(clampY(a + 145 * b))]], "stroke:var(--vec-u);stroke-width:1.75");
    // The selected group: where they were, and where they land.
    el("line", { x1: f.sx(m1), x2: f.sx(m1), y1: f.sy(m1), y2: f.sy(m2), style: "stroke:var(--foreground);stroke-width:2" }, svg);
    el("circle", { cx: f.sx(m1), cy: f.sy(m1), r: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
    el("path", { d: `M${f.sx(m1) - 6} ${f.sy(m2)} L${f.sx(m1)} ${f.sy(m2) - 6} L${f.sx(m1) + 6} ${f.sy(m2)} L${f.sx(m1)} ${f.sy(m2) + 6} Z`, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    text(svg, f.sx(55) + 6, f.T + 10, "regression line", { style: "fill:var(--vec-u)" });

    o.t1.textContent = num(m1, 1);
    o.t2.textContent = num(m2, 1);
    o.drop.textContent = neg(num(m2 - m1, 1));
    o.exp.textContent = neg(num((rel - 1) * (m1 - 100), 1));
    o.rel.textContent = num(rel, 2);
  }
  reseed();
  draw();
}

// ============================================================ Descriptive statistics

for (const root of document.querySelectorAll("[data-describe]")) {
  const input = root.querySelector("[data-input]");
  const svg = root.querySelector("[data-box]");
  const o = outs(root);
  const hint = o.parse.textContent;

  function draw() {
    const tokens = input.value.split(/[\s,;]+/).filter(Boolean);
    const xs = tokens.map((t) => Number(t.replace("−", "-"))).filter(Number.isFinite);
    const bad = tokens.length - xs.length;
    o.parse.textContent = bad ? `${bad} value${bad > 1 ? "s" : ""} ignored (not a number).` : hint;
    svg.replaceChildren();
    const keys = ["n", "mean", "median", "mode", "sd", "sdp", "range", "quart", "iqr", "outliers"];
    if (xs.length < 2) {
      for (const k of keys) o[k].textContent = "—";
      o.n.textContent = String(xs.length);
      text(svg, 300, 58, "Enter at least two numbers.", { "text-anchor": "middle" });
      return;
    }
    const sorted = [...xs].sort((a, b) => a - b);
    const q1 = S.quantile(sorted, 0.25), q2 = S.quantile(sorted, 0.5), q3 = S.quantile(sorted, 0.75), iqr = q3 - q1;
    const lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
    const inliers = sorted.filter((v) => v >= lf && v <= uf);
    const out = sorted.filter((v) => v < lf || v > uf);
    const freq = new Map();
    for (const v of xs) freq.set(v, (freq.get(v) ?? 0) + 1);
    const maxF = Math.max(...freq.values());
    const modes = maxF > 1 ? [...freq].filter(([, c]) => c === maxF).map(([v]) => v).sort((a, b) => a - b) : [];

    o.n.textContent = String(xs.length);
    o.mean.textContent = smart(S.mean(xs), 3);
    o.median.textContent = smart(q2, 3);
    o.mode.textContent = modes.length ? `${modes.map((m) => smart(m)).join(", ")} (×${maxF})` : "none";
    o.sd.textContent = smart(S.sd(xs, true), 3);
    o.sdp.textContent = smart(S.sd(xs, false), 3);
    o.range.textContent = `${smart(sorted[0])} / ${smart(sorted.at(-1))}`;
    o.quart.textContent = `${smart(q1, 3)} / ${smart(q3, 3)}`;
    o.iqr.textContent = smart(iqr, 3);
    o.outliers.textContent = out.length ? out.map((v) => smart(v)).join(", ") : "none";

    const lo = sorted[0], hi = sorted.at(-1), pad = (hi - lo) * 0.06 || 1;
    const f = frame(svg, { box: [20, 10, 560, 74], x: [lo - pad, hi + pad], y: [0, 1], xticks: niceTicks(lo - pad, hi + pad, 8), yticks: [], xfmt: tickFmt });
    const y = f.T + 24;
    const wl = inliers[0], wh = inliers.at(-1);
    el("line", { x1: f.sx(wl), x2: f.sx(q1), y1: y, y2: y, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
    el("line", { x1: f.sx(q3), x2: f.sx(wh), y1: y, y2: y, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
    for (const v of [wl, wh]) el("line", { x1: f.sx(v), x2: f.sx(v), y1: y - 7, y2: y + 7, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
    el("rect", { x: f.sx(q1), y: y - 14, width: Math.max(1, f.sx(q3) - f.sx(q1)), height: 28, rx: 3, style: "fill:var(--brand);fill-opacity:0.15;stroke:var(--brand);stroke-width:1.5" }, svg);
    el("line", { x1: f.sx(q2), x2: f.sx(q2), y1: y - 14, y2: y + 14, style: "stroke:var(--brand);stroke-width:2.5" }, svg);
    const m = S.mean(xs);
    el("path", { d: `M${f.sx(m)} ${y - 4} l4 4 l-4 4 l-4 -4 Z`, style: "fill:var(--foreground)" }, svg);
    for (const v of out) el("circle", { cx: f.sx(v), cy: y, r: 4, style: "fill:var(--background);stroke:var(--code-del);stroke-width:2" }, svg);
    xs.forEach((v, i) => el("circle", { cx: f.sx(v), cy: y + 26 + ((i * 7) % 5) * 1.6, r: 2, style: "fill:var(--foreground);fill-opacity:0.35" }, svg));
  }
  input.addEventListener("input", draw);
  draw();
}
