// Statistics blocks: distributions, the central limit theorem, confidence
// intervals and the t-test. stats-more.js holds Bayes, correlation, the
// bootstrap, regression to the mean and descriptive statistics.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import * as S from "./stats-math.js";
import "./stats-more.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const neg = (s) => String(s).replace("-", "−");
const pfmt = (p) => (p < 0.0001 ? "< 0.0001" : num(p, 4));

/** A filled area under a curve between x0 and x1 (world units, frame f). */
function area(svg, f, fn, x0, x1, style, steps = 160) {
  if (!(x1 > x0)) return;
  const pts = [[f.sx(x0), f.sy(0)]];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    pts.push([f.sx(x), f.sy(Math.min(f.ymax, fn(x)))]);
  }
  pts.push([f.sx(x1), f.sy(0)]);
  el("path", { d: "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L") + " Z", style }, svg);
}

function curve(svg, f, fn, x0, x1, style, steps = 300) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = fn(x);
    if (Number.isFinite(y)) pts.push([f.sx(x), f.sy(Math.min(f.ymax, y))]);
  }
  return polyline(svg, pts, style);
}

const niceTicks = (a, b, n = 6) => {
  const raw = (b - a) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
};
const tickFmt = (v) => neg(Math.abs(v) < 1e-9 ? "0" : String(+v.toPrecision(4)));

// ============================================================ Distribution explorer

const DISTS = {
  normal: {
    formula: (p) => `X ~ N(${neg(p.mu)}, ${p.sigma}²)`, support: "x ∈ ℝ",
    range: (p) => [p.mu - 4 * p.sigma, p.mu + 4 * p.sigma],
    pdf: (x, p) => S.normPdf(x, p.mu, p.sigma), cdf: (x, p) => S.normCdf(x, p.mu, p.sigma),
    moments: (p) => [p.mu, p.sigma ** 2],
    bounds: (p) => [p.mu - 1.96 * p.sigma, p.mu + 1.96 * p.sigma],
  },
  t: {
    formula: (p) => `X ~ t(${p.df})`, support: "x ∈ ℝ",
    range: () => [-6, 6],
    pdf: (x, p) => S.tPdf(x, p.df), cdf: (x, p) => S.tCdf(x, p.df),
    moments: (p) => [p.df > 1 ? 0 : NaN, p.df > 2 ? p.df / (p.df - 2) : p.df > 1 ? Infinity : NaN],
    bounds: () => [-2, 2],
  },
  chisq: {
    formula: (p) => `X ~ χ²(${p.k})`, support: "x ≥ 0",
    range: (p) => [0, Math.max(10, p.k + 6 * Math.sqrt(2 * p.k))],
    pdf: (x, p) => S.chisqPdf(x, p.k), cdf: (x, p) => S.chisqCdf(x, p.k),
    moments: (p) => [p.k, 2 * p.k],
    bounds: (p) => [0, p.k],
  },
  binomial: {
    discrete: true, formula: (p) => `X ~ Bin(${p.n}, ${p.p})`, support: "x ∈ {0, …, n}",
    range: (p) => [0, p.n],
    pmf: (k, p) => S.binomPmf(k, p.n, p.p),
    moments: (p) => [p.n * p.p, p.n * p.p * (1 - p.p)],
    bounds: (p) => [Math.max(0, Math.round(p.n * p.p) - 2), Math.round(p.n * p.p) + 2],
  },
  poisson: {
    discrete: true, formula: (p) => `X ~ Pois(${p.lambda})`, support: "x ∈ {0, 1, 2, …}",
    range: (p) => [0, Math.ceil(p.lambda + 5 * Math.sqrt(p.lambda) + 3)],
    pmf: (k, p) => S.poisPmf(k, p.lambda),
    moments: (p) => [p.lambda, p.lambda],
    bounds: (p) => [Math.max(0, Math.round(p.lambda) - 2), Math.round(p.lambda) + 2],
  },
  exponential: {
    formula: (p) => `X ~ Exp(${p.lambda})`, support: "x ≥ 0",
    range: (p) => [0, 6 / p.lambda],
    pdf: (x, p) => (x < 0 ? 0 : p.lambda * Math.exp(-p.lambda * x)), cdf: (x, p) => (x < 0 ? 0 : 1 - Math.exp(-p.lambda * x)),
    moments: (p) => [1 / p.lambda, 1 / p.lambda ** 2],
    bounds: (p) => [0, 1 / p.lambda],
  },
  uniform: {
    formula: (p) => `X ~ U(${neg(p.a)}, ${neg(p.b)})`, support: "a ≤ x ≤ b",
    range: (p) => { const w = Math.max(0.5, p.b - p.a); return [p.a - 0.3 * w, p.b + 0.3 * w]; },
    pdf: (x, p) => (x >= p.a && x <= p.b ? 1 / (p.b - p.a) : 0),
    cdf: (x, p) => Math.min(1, Math.max(0, (x - p.a) / (p.b - p.a))),
    moments: (p) => [(p.a + p.b) / 2, (p.b - p.a) ** 2 / 12],
    bounds: (p) => [p.a, (p.a + p.b) / 2],
  },
};

for (const root of document.querySelectorAll("[data-dist]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "normal", cdf = false;
  const s = scrubAll(root, () => draw());
  const params = () => ({
    normal: { mu: s["normal-mu"].get(), sigma: s["normal-sigma"].get() },
    t: { df: s["t-df"].get() },
    chisq: { k: s["chisq-k"].get() },
    binomial: { n: s["binomial-n"].get(), p: s["binomial-p"].get() },
    poisson: { lambda: s["poisson-lambda"].get() },
    exponential: { lambda: s["exponential-lambda"].get() },
    uniform: { a: s["uniform-a"].get(), b: s["uniform-b"].get() },
  })[kind];

  root.addEventListener("seg-change", (e) => {
    kind = e.detail.value;
    root.querySelectorAll("[data-params]").forEach((g) => (g.hidden = g.dataset.params !== kind));
    const [a, b] = DISTS[kind].bounds(params());
    s.lo.set(a, false);
    s.hi.set(b, false);
    draw();
  });
  onToggle(root, (_, on) => { cdf = on; draw(); });

  function draw() {
    const D = DISTS[kind], p = params();
    const a = Math.min(s.lo.get(), s.hi.get()), b = Math.max(s.lo.get(), s.hi.get());
    svg.replaceChildren();
    o.formula.textContent = D.formula(p);
    o.support.textContent = D.support;
    if (kind === "uniform" && !(p.b > p.a)) {
      text(svg, 300, 160, "Set b above a.", { "text-anchor": "middle" });
      o.prob.textContent = o.mean.textContent = o.var.textContent = "—";
      return;
    }
    const [x0, x1] = D.range(p);
    let prob;
    if (D.discrete) {
      const ks = [];
      for (let k = Math.max(0, Math.floor(x0)); k <= x1; k++) ks.push(k);
      const pm = ks.map((k) => D.pmf(k, p));
      const cum = pm.reduce((acc, v) => (acc.push((acc.at(-1) ?? 0) + v), acc), []);
      const inside = (k) => k >= Math.ceil(a - 1e-9) && k <= Math.floor(b + 1e-9);
      prob = ks.reduce((t, k, i) => t + (inside(k) ? pm[i] : 0), 0);
      const ymax = cdf ? 1.05 : Math.max(...pm) * 1.15;
      const f = frame(svg, { box: [44, 12, 540, 270], x: [x0 - 0.6, x1 + 0.6], y: [0, ymax], xticks: niceTicks(x0, x1, 8).filter(Number.isInteger), yticks: niceTicks(0, ymax, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "x", ylabel: cdf ? "F(x)" : "P(X = x)" });
      f.ymax = ymax;
      const w = Math.min(18, (f.sx(1) - f.sx(0)) * 0.7);
      ks.forEach((k, i) => {
        const v = cdf ? cum[i] : pm[i];
        el("rect", { x: f.sx(k) - w / 2, y: f.sy(v), width: w, height: f.T + f.H - f.sy(v), rx: 1.5,
          style: inside(k) ? "fill:var(--brand);fill-opacity:0.8" : "fill:var(--foreground);fill-opacity:0.22" }, svg);
      });
    } else {
      const xs = Array.from({ length: 200 }, (_, i) => x0 + ((x1 - x0) * (i + 0.5)) / 200);
      const peak = Math.max(...xs.map((x) => D.pdf(x, p)).filter(Number.isFinite));
      const ymax = cdf ? 1.05 : Math.min(peak * 1.15, 5);
      const f = frame(svg, { box: [44, 12, 540, 270], x: [x0, x1], y: [0, ymax], xticks: niceTicks(x0, x1, 8), yticks: niceTicks(0, ymax, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "x", ylabel: cdf ? "F(x)" : "f(x)" });
      f.ymax = ymax;
      const lo = Math.max(a, x0), hi = Math.min(b, x1);
      prob = D.cdf(b, p) - D.cdf(a, p);
      if (cdf) {
        curve(svg, f, (x) => D.cdf(x, p), x0, x1, "stroke:var(--foreground);stroke-width:1.75");
        for (const x of [a, b]) {
          if (x < x0 || x > x1) continue;
          const y = D.cdf(x, p);
          el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.sy(0), y2: f.sy(y), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
          el("line", { x1: f.L, x2: f.sx(x), y1: f.sy(y), y2: f.sy(y), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
        }
        // The probability is the vertical gap F(b) − F(a).
        const ya = D.cdf(Math.max(a, x0), p), yb = D.cdf(Math.min(b, x1), p);
        el("line", { x1: f.L + 8, x2: f.L + 8, y1: f.sy(ya), y2: f.sy(yb), style: "stroke:var(--brand);stroke-width:3;stroke-linecap:round" }, svg);
      } else {
        area(svg, f, (x) => D.pdf(x, p), lo, hi, "fill:var(--brand);fill-opacity:0.25");
        curve(svg, f, (x) => D.pdf(x, p), x0 + 1e-9, x1, "stroke:var(--foreground);stroke-width:1.75");
        for (const x of [a, b]) if (x >= x0 && x <= x1)
          el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.25" }, svg);
      }
    }
    o.prob.textContent = num(Math.max(0, Math.min(1, prob)), 4);
    const [m, v] = D.moments(p);
    o.mean.textContent = Number.isFinite(m) ? num(m, 3) : "undefined";
    o.var.textContent = v === Infinity ? "∞" : Number.isFinite(v) ? num(v, 3) : "undefined";
  }
  draw();
}

// ============================================================ Central limit theorem

const SOURCES = {
  exponential: { draw: (r) => -Math.log(1 - r()), mu: 1, sd: 1, skew: 2, lo: 0, hi: Infinity, label: "Exponential, λ = 1" },
  bernoulli: { draw: (r) => (r() < 0.1 ? 1 : 0), mu: 0.1, sd: 0.3, skew: 0.8 / 0.3, lo: 0, hi: 1, label: "Coin with p = 0.1" },
  uniform: { draw: (r) => r(), mu: 0.5, sd: Math.sqrt(1 / 12), skew: 0, lo: 0, hi: 1, label: "Uniform on [0, 1]" },
};

for (const root of document.querySelectorAll("[data-clt]")) {
  const src = root.querySelector("[data-clt-source]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  let kind = "exponential", means = [], rng = S.mulberry32(3), playing = false, raf = 0, visible = false;
  const s = scrubAll(root, () => reset());
  const MAX = 10000;

  const add = (count) => {
    const n = Math.round(s.n.get()), Src = SOURCES[kind];
    for (let c = 0; c < count && means.length < MAX; c++) {
      let t = 0;
      for (let i = 0; i < n; i++) t += Src.draw(rng);
      means.push(t / n);
    }
  };
  function reset() {
    means = [];
    rng = S.mulberry32(3);
    add(400);
    draw();
  }

  function drawSource() {
    src.replaceChildren();
    const Src = SOURCES[kind];
    text(src, 4, 12, "source: " + Src.label);
    const f = frame(src, { box: [44, 20, 540, 60], x: kind === "exponential" ? [0, 5] : [-0.2, 1.2], y: [0, 1.15], xticks: [], yticks: [] });
    if (kind === "exponential") curve(src, Object.assign(f, { ymax: 1.15 }), (x) => Math.exp(-x), 0, 5, "stroke:var(--foreground);stroke-width:1.5");
    else if (kind === "uniform") polyline(src, [[f.sx(-0.2), f.sy(0)], [f.sx(0), f.sy(0)], [f.sx(0), f.sy(1)], [f.sx(1), f.sy(1)], [f.sx(1), f.sy(0)], [f.sx(1.2), f.sy(0)]], "stroke:var(--foreground);stroke-width:1.5");
    else for (const [x, v] of [[0, 0.9], [1, 0.1]]) el("rect", { x: f.sx(x) - 8, y: f.sy(v), width: 16, height: f.T + f.H - f.sy(v), style: "fill:var(--foreground);fill-opacity:0.35" }, src);
    text(src, f.L + f.W, 12, `μ = ${num(Src.mu, 2)}, σ = ${num(Src.sd, 3)}, skew = ${num(Src.skew, 2)}`, { "text-anchor": "end" });
  }

  function draw() {
    drawSource();
    svg.replaceChildren();
    const Src = SOURCES[kind], n = Math.round(s.n.get());
    const se = Src.sd / Math.sqrt(n);
    let x0 = Math.max(Src.lo, Src.mu - 4.5 * se), x1 = Math.min(Src.hi, Src.mu + 4.5 * se);
    if (x1 - x0 < 1e-9) x1 = x0 + 1;
    // For a coin the means live on a lattice k/n: align bins to it.
    let B = 40;
    if (kind === "bernoulli") {
      x0 = Math.floor(x0 * n) / n - 0.5 / n;
      B = Math.max(2, Math.round((x1 - x0) * n) + 1);
      x1 = x0 + B / n;
    }
    const w = (x1 - x0) / B;
    const counts = new Array(B).fill(0);
    for (const m of means) { const i = Math.floor((m - x0) / w); if (i >= 0 && i < B) counts[i]++; }
    const dens = (x) => means.length * w * S.normPdf(x, Src.mu, se);
    const ymax = Math.max(5, ...counts, dens(Src.mu)) * 1.12;
    const f = frame(svg, { box: [44, 20, 540, 210], x: [x0, x1], y: [0, ymax], xticks: niceTicks(x0, x1, 7), yticks: niceTicks(0, ymax, 3), xfmt: tickFmt, yfmt: tickFmt, xlabel: "sample mean", ylabel: "count" });
    f.ymax = ymax;
    counts.forEach((c, i) => el("rect", { x: f.sx(x0 + i * w) + 0.5, y: f.sy(c), width: Math.max(0.5, f.sx(x0 + w) - f.sx(x0) - 1), height: f.T + f.H - f.sy(c), style: "fill:var(--brand);fill-opacity:0.7" }, svg));
    curve(svg, f, dens, x0, x1, "stroke:var(--foreground);stroke-width:1.75");
    el("line", { x1: f.sx(Src.mu), x2: f.sx(Src.mu), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);

    const m = S.mean(means), sdm = S.sd(means);
    const skew = means.reduce((t, v) => t + ((v - m) / sdm) ** 3, 0) / means.length;
    o.draws.textContent = `${means.length.toLocaleString("en")} × n = ${n}`;
    o.mean.textContent = num(m, 4);
    o.sd.textContent = num(sdm, 4);
    o.se.textContent = num(se, 4);
    o.skew.textContent = `${num(skew, 2)}  (theory ${num(Src.skew / Math.sqrt(n), 2)})`;
  }

  const setPlay = (p) => {
    playing = p && means.length < MAX;
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? "Pause" : "Sample";
    if (playing && reduced()) { add(MAX); draw(); return setPlay(false); }
    if (playing && visible && !raf) raf = requestAnimationFrame(loop);
  };
  const loop = () => {
    add(40);
    draw();
    raf = 0;
    if (means.length >= MAX) return setPlay(false);
    if (playing && visible) raf = requestAnimationFrame(loop);
  };
  btn.querySelector("[data-label]").textContent = "Sample";
  btn.addEventListener("click", () => setPlay(!playing));
  root.querySelector("[data-action=reset]").addEventListener("click", () => { setPlay(false); means = []; draw(); });
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; reset(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(loop); }).observe(root);
  reset();
}

// ============================================================ Confidence intervals

for (const root of document.querySelectorAll("[data-ci]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const MU = 50, SIGMA = 10, K = 100;
  let seed = 1, total = 0, runs = 0;
  const s = scrubAll(root, () => { total = 0; runs = 0; draw(true); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(true); });

  function draw(count) {
    const n = Math.round(s.n.get()), level = s.level.get() / 100;
    const tc = S.tQuantile(1 - (1 - level) / 2, n - 1);
    const rng = S.mulberry32(seed * 7919 + n);
    const iv = [];
    for (let k = 0; k < K; k++) {
      const xs = Array.from({ length: n }, () => MU + SIGMA * S.gauss(rng));
      const m = S.mean(xs), half = (tc * S.sd(xs)) / Math.sqrt(n);
      iv.push([m - half, m + half, m]);
    }
    const hit = iv.filter(([a, b]) => a <= MU && MU <= b).length;
    if (count) { total += hit; runs++; }
    svg.replaceChildren();
    const span = Math.max(12, ...iv.map(([a, b]) => Math.max(MU - a, b - MU))) * 1.05;
    const f = frame(svg, { box: [30, 22, 556, 372], x: [MU - span, MU + span], y: [0, K], xticks: niceTicks(MU - span, MU + span, 8), yticks: [], xfmt: tickFmt, xlabel: "value" });
    const rowH = f.H / K;
    iv.forEach(([a, b, m], k) => {
      const miss = !(a <= MU && MU <= b);
      const y = f.T + (k + 0.5) * rowH;
      el("line", { x1: f.sx(a), x2: f.sx(b), y1: y, y2: y, style: `stroke:${miss ? "var(--code-del)" : "var(--foreground)"};stroke-opacity:${miss ? 1 : 0.4};stroke-width:${miss ? 2 : 1.5};stroke-linecap:round` }, svg);
      el("circle", { cx: f.sx(m), cy: y, r: 1.4, style: `fill:${miss ? "var(--code-del)" : "var(--foreground)"}` }, svg);
    });
    el("line", { x1: f.sx(MU), x2: f.sx(MU), y1: f.T - 4, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.75" }, svg);
    text(svg, f.sx(MU), f.T - 10, "true mean μ = 50", { "text-anchor": "middle", style: "fill:var(--brand)" });
    o.cover.textContent = `${hit} / ${K} cover μ`;
    o.total.textContent = runs ? `${num((100 * total) / (runs * K), 1)}% over ${runs} run${runs > 1 ? "s" : ""}` : "—";
    o.tcrit.textContent = `${num(tc, 3)}  (df ${n - 1})`;
  }
  draw(true);
}

// ============================================================ t-test and power

for (const root of document.querySelectorAll("[data-ttest]")) {
  const nullSvg = root.querySelector("[data-null]");
  const powSvg = root.querySelector("[data-power]");
  const o = outs(root);
  let seed = 4, sided = "two";
  const s = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => { sided = e.detail.value; draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const d = s.d.get(), n = Math.round(s.n.get()), alpha = s.alpha.get();
    const rng = S.mulberry32(seed * 104729 + n);
    const A = Array.from({ length: n }, () => S.gauss(rng));
    const B = Array.from({ length: n }, () => d + S.gauss(rng));
    const df = 2 * n - 2;
    const sp = Math.sqrt((S.sd(A) ** 2 + S.sd(B) ** 2) / 2);
    const t = (S.mean(B) - S.mean(A)) / (sp * Math.sqrt(2 / n));
    const two = sided === "two";
    const p = two ? 2 * (1 - S.tCdf(Math.abs(t), df)) : 1 - S.tCdf(t, df);
    const c = S.tQuantile(1 - (two ? alpha / 2 : alpha), df);
    const delta = d * Math.sqrt(n / 2);
    const power = S.nctUpper(c, df, delta) + (two ? 1 - S.nctUpper(-c, df, delta) : 0);

    // Null distribution with the observed statistic.
    nullSvg.replaceChildren();
    const lim = Math.max(5, Math.min(12, Math.abs(t) + 1));
    const ymax = S.tPdf(0, df) * 1.2;
    const f = frame(nullSvg, { box: [44, 10, 540, 150], x: [-lim, lim], y: [0, ymax], xticks: niceTicks(-lim, lim, 8), yticks: [], xfmt: tickFmt, xlabel: "t under H₀" });
    f.ymax = ymax;
    const pdf = (x) => S.tPdf(x, df);
    const at = Math.abs(t);
    if (two) {
      area(nullSvg, f, pdf, -lim, -at, "fill:var(--brand);fill-opacity:0.35");
      area(nullSvg, f, pdf, at, lim, "fill:var(--brand);fill-opacity:0.35");
    } else area(nullSvg, f, pdf, t, lim, "fill:var(--brand);fill-opacity:0.35");
    curve(nullSvg, f, pdf, -lim, lim, "stroke:var(--foreground);stroke-width:1.75");
    for (const x of two ? [-c, c] : [c]) el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-del);stroke-dasharray:4 3" }, nullSvg);
    const tx = Math.max(-lim, Math.min(lim, t));
    el("line", { x1: f.sx(tx), x2: f.sx(tx), y1: f.T - 2, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:2" }, nullSvg);
    text(nullSvg, f.sx(tx) + (tx > 0 ? -4 : 4), f.T + 8, `t = ${num(t, 2)}`, { "text-anchor": tx > 0 ? "end" : "start", style: "fill:var(--brand)" });
    text(nullSvg, f.L + f.W, f.T + 8, `p = ${pfmt(p)} (shaded)`, { "text-anchor": "end" });

    // Power: the null and the alternative (noncentral t).
    powSvg.replaceChildren();
    const hi = Math.max(5, delta + 5), lo = -5;
    const xs = Array.from({ length: 140 }, (_, i) => lo + ((hi - lo) * i) / 139);
    const alt = xs.map((x) => S.nctPdf(x, df, delta));
    const altAt = (x) => { const i = Math.max(0, Math.min(138, Math.floor(((x - lo) / (hi - lo)) * 139))); const u = ((x - lo) / (hi - lo)) * 139 - i; return alt[i] * (1 - u) + alt[i + 1] * u; };
    const ym = Math.max(ymax, Math.max(...alt) * 1.2);
    const g = frame(powSvg, { box: [44, 10, 540, 150], x: [lo, hi], y: [0, ym], xticks: niceTicks(lo, hi, 8), yticks: [], xfmt: tickFmt, xlabel: "t" });
    g.ymax = ym;
    area(powSvg, g, altAt, c, hi, "fill:var(--code-add);fill-opacity:0.3");
    area(powSvg, g, altAt, two ? Math.max(lo, -c) : lo, c, "fill:var(--vec-out);fill-opacity:0.35");
    area(powSvg, g, pdf, c, hi, "fill:var(--code-del);fill-opacity:0.45");
    if (two) area(powSvg, g, pdf, lo, -c, "fill:var(--code-del);fill-opacity:0.45");
    curve(powSvg, g, pdf, lo, hi, "stroke:var(--foreground);stroke-width:1.5");
    curve(powSvg, g, altAt, lo, hi, "stroke:var(--vec-u);stroke-width:1.75");
    for (const x of two ? [-c, c] : [c]) el("line", { x1: g.sx(x), x2: g.sx(x), y1: g.T, y2: g.T + g.H, style: "stroke:var(--code-del);stroke-dasharray:4 3" }, powSvg);
    text(powSvg, g.sx(0), g.T + 8, "H₀", { "text-anchor": "middle" });
    text(powSvg, g.sx(delta), g.T + 8, "H₁", { "text-anchor": "middle", style: "fill:var(--vec-u)" });

    o.t.textContent = num(t, 3);
    o.df.textContent = String(df);
    o.p.textContent = pfmt(p);
    o.decision.textContent = p < alpha ? `reject H₀ (p < ${alpha})` : "fail to reject H₀";
    o.decision.className = "tabular-nums " + (p < alpha ? "text-brand" : "");
    o.pow.textContent = `${num(power, 3)}  (β ${num(1 - power, 3)})`;
  }
  draw();
}
