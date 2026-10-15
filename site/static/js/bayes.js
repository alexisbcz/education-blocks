// Bayesian inference blocks, part one: Beta–binomial updating, grid
// approximation with a drawn prior, Normal–Normal shrinkage, the eight
// schools and a Bayesian A/B test. bayes-sim.js and bayes-mcmc.js hold the
// rest; bayes-math.js the shared numerics.

import { scrubAll } from "./scrub.js";
import {
  C, el, text, frame, polyline, num, neg, pct, pfmt, outs, onToggle, onAction, reduced, niceTicks, tickFmt, svgPoint,
  lbeta, logBetaPdf, betaPdf, betaI, betaQuantile, betaHPD, betaDraw, probBBeatsA, mulberry32, normCdf, normPdf, lgamma,
  area, curve, dots,
} from "./bayes-math.js";

// ============================================================ Beta–binomial

const PRIORS = { flat: [1, 1], jeffreys: [0.5, 0.5], fair: [20, 20], low: [2, 6] };

for (const root of document.querySelectorAll("[data-bayes-coin]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const rng = mulberry32(20261015);
  let heads = 7, tails = 3, seq = "HHTHHTHHTH", hpd = false;
  // The posterior shown, eased toward the true one after each update.
  let shown = null, anim = 0;

  root.addEventListener("seg-change", (e) => {
    const [a, b] = PRIORS[e.detail.value];
    s.a.set(a, false);
    s.b.set(b, false);
    draw();
  });
  onToggle(root, (_, on) => { hpd = on; draw(); });
  onAction(root, (act) => {
    const p = s.p.get();
    const flip = () => {
      const h = rng() < p;
      h ? heads++ : tails++;
      seq += h ? "H" : "T";
    };
    if (act === "flip1") flip();
    else if (act === "flip10") for (let i = 0; i < 10; i++) flip();
    else if (act === "heads") { heads++; seq += "H"; }
    else if (act === "tails") { tails++; seq += "T"; }
    else if (act === "seven-three") { heads = 7; tails = 3; seq = "HHTHHTHHTH"; }
    else if (act === "reset") { heads = tails = 0; seq = ""; }
    update();
  });

  function update() {
    const target = [s.a.get() + heads, s.b.get() + tails];
    if (reduced() || !shown) { shown = target; draw(); return; }
    const from = shown.slice(), t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 220);
      const e = 1 - (1 - k) ** 3;
      shown = [from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e];
      draw(false);
      if (k < 1) anim = requestAnimationFrame(step);
      else draw();
    };
    anim = requestAnimationFrame(step);
  }

  function draw(final = true) {
    const a0 = s.a.get(), b0 = s.b.get();
    const a = a0 + heads, b = b0 + tails;
    if (final) shown = [a, b];
    const [pa, pb] = shown;
    svg.replaceChildren();
    // y range from interior values, so U-shaped densities don't flatten the rest.
    let ymax = 0;
    for (let i = 1; i < 200; i++) {
      const x = 0.02 + (0.96 * i) / 200;
      ymax = Math.max(ymax, betaPdf(x, pa, pb), betaPdf(x, a0, b0), betaPdf(x, heads + 1, tails + 1));
    }
    ymax = Math.max(1.5, ymax * 1.12);
    const f = frame(svg, { box: [40, 24, 545, 260], x: [0, 1], y: [0, ymax], xticks: niceTicks(0, 1, 10), yticks: niceTicks(0, ymax, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "θ (chance of heads)", ylabel: "density" });
    f.ymax = ymax;
    const lo = 1e-4, hi = 1 - 1e-4;
    const iv = hpd ? betaHPD(a, b) : [betaQuantile(0.025, a, b), betaQuantile(0.975, a, b)];
    if (final && iv) area(svg, f, (x) => betaPdf(x, a, b), iv[0], iv[1], "fill:var(--brand);fill-opacity:0.18");
    area(svg, f, (x) => betaPdf(x, pa, pb), lo, hi, `fill:${C.post};fill-opacity:0.1`);
    curve(svg, f, (x) => betaPdf(x, a0, b0), lo, hi, `stroke:${C.prior};stroke-width:1.5;stroke-dasharray:5 4`);
    if (heads + tails > 0) curve(svg, f, (x) => betaPdf(x, heads + 1, tails + 1), lo, hi, `stroke:${C.like};stroke-width:1.5`);
    curve(svg, f, (x) => betaPdf(x, pa, pb), lo, hi, `stroke:${C.post};stroke-width:2.25`);
    if (final && iv) for (const x of iv)
      el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.25" }, svg);
    if (s.p && heads + tails > 0) {
      const x = f.sx(s.p.get());
      el("line", { x1: x, x2: x, y1: f.T + f.H, y2: f.T + f.H - 8, style: "stroke:currentColor;stroke-width:2" }, svg);
      text(svg, x, f.T + f.H - 11, "true θ", { "text-anchor": "middle" });
    }
    o.formula.textContent = `θ | data ~ Beta(${fmtAB(a0)} + ${heads}, ${fmtAB(b0)} + ${tails})`;
    const n = heads + tails;
    o.seq.textContent = n ? `${heads} H · ${tails} T  ${seq.length > 32 ? "…" + seq.slice(-32) : seq}` : "no flips yet";
    o.post.textContent = `Beta(${fmtAB(a)}, ${fmtAB(b)})`;
    o.mean.textContent = num(a / (a + b), 3);
    o.mode.textContent = a > 1 && b > 1 ? num((a - 1) / (a + b - 2), 3) : a <= 1 && b > 1 ? "0" : b <= 1 && a > 1 ? "1" : "—";
    o.ci.textContent = iv ? `[${num(iv[0], 3)}, ${num(iv[1], 3)}]` : "two pieces (U-shaped)";
    o.pgt.textContent = num(1 - betaI(a, b, 0.5), 3);
  }
  const fmtAB = (v) => String(+v.toFixed(2));
  draw();
}

// ============================================================ Grid approximation

const GRID = Array.from({ length: 101 }, (_, i) => i / 100);
const SHAPES = {
  flat: () => 0.6,
  bimodal: (t) => 0.9 * Math.exp(-0.5 * ((t - 0.25) / 0.07) ** 2) + 0.9 * Math.exp(-0.5 * ((t - 0.75) / 0.07) ** 2),
  ramp: (t) => 0.95 * t,
  spike: (t) => 0.95 * Math.exp(-0.5 * ((t - 0.5) / 0.03) ** 2),
};

for (const root of document.querySelectorAll("[data-bayes-grid]")) {
  const psvg = root.querySelector("[data-prior]"), svg = root.querySelector("[data-plot]"), qsvg = root.querySelector("[data-pred]");
  const o = outs(root);
  const s = scrubAll(root, (name) => {
    if (name === "k" && s.k.get() > s.n.get()) s.n.set(s.k.get(), false);
    if (name === "n" && s.k.get() > s.n.get()) s.k.set(s.n.get(), false);
    draw();
  });
  let prior = GRID.map(SHAPES.bimodal);
  const PB = [40, 10, 545, 110];

  root.addEventListener("seg-change", (e) => { prior = GRID.map(SHAPES[e.detail.value]); draw(); });

  // Draw the prior: each pointer move paints the grid points it crosses.
  let last = null;
  const paint = (e) => {
    const [x, y] = svgPoint(psvg, e);
    const i = Math.round(Math.min(1, Math.max(0, (x - PB[0]) / PB[2])) * 100);
    const v = Math.min(1, Math.max(0, (PB[1] + PB[3] - y) / PB[3]));
    if (last) {
      const [i0, v0] = last;
      const lo = Math.min(i0, i), hi = Math.max(i0, i);
      for (let j = lo; j <= hi; j++) prior[j] = hi === lo ? v : v0 + ((v - v0) * (j - i0)) / (i - i0);
    } else prior[i] = v;
    last = [i, v];
    root.querySelectorAll('[role="tablist"] [data-seg]').forEach((b) => b.setAttribute("aria-selected", "false"));
    draw();
  };
  let down = false;
  psvg.addEventListener("pointerdown", (e) => { down = true; try { psvg.setPointerCapture(e.pointerId); } catch {} last = null; paint(e); });
  psvg.addEventListener("pointermove", (e) => { if (down) paint(e); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) psvg.addEventListener(t, () => { down = false; last = null; });

  function draw() {
    const k = s.k.get(), n = s.n.get(), m = s.m.get();
    // Prior panel.
    psvg.replaceChildren();
    const pf = frame(psvg, { box: PB, x: [0, 1], y: [0, 1], xticks: niceTicks(0, 1, 10), yticks: [], xfmt: tickFmt });
    text(psvg, 4, 10, "prior (drawn)");
    const pp = GRID.map((t, i) => [pf.sx(t), pf.sy(prior[i])]);
    el("path", { d: `M${pf.sx(0)},${pf.sy(0)} L` + pp.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" L") + ` L${pf.sx(1)},${pf.sy(0)} Z`, style: `fill:${C.prior};fill-opacity:0.15` }, psvg);
    polyline(psvg, pp, `stroke:${C.prior};stroke-width:1.75`);
    el("rect", { x: PB[0], y: PB[1], width: PB[2], height: PB[3], style: "fill:transparent;cursor:crosshair" }, psvg);

    // Posterior on the grid, in log space for large n.
    const ll = GRID.map((t) => (k > 0 ? k * Math.log(t) : 0) + (n - k > 0 ? (n - k) * Math.log1p(-t) : 0));
    const mx = Math.max(...ll.filter(Number.isFinite));
    const like = ll.map((v) => (Number.isFinite(v) ? Math.exp(v - mx) : 0));
    const lsum = like.reduce((a, b) => a + b, 0);
    const raw = like.map((v, i) => v * prior[i]);
    const tot = raw.reduce((a, b) => a + b, 0);
    svg.replaceChildren();
    qsvg.replaceChildren();
    if (!(tot > 0)) {
      text(svg, 300, 90, "The prior gives no weight where the data are possible: draw some mass there.", { "text-anchor": "middle" });
      for (const k of ["mean", "ci", "next", "psd", "bsd"]) o[k].textContent = "—";
      return;
    }
    const post = raw.map((v) => v / tot), lik = like.map((v) => v / lsum);
    const ymax = Math.max(...post, ...lik) * 1.12;
    const f = frame(svg, { box: [40, 24, 545, 118], x: [0, 1], y: [0, ymax], xticks: niceTicks(0, 1, 10), yticks: niceTicks(0, ymax, 3), xfmt: tickFmt, yfmt: (v) => num(v, 2), xlabel: "θ", ylabel: "mass per grid point" });
    const pts = (arr) => GRID.map((t, i) => [f.sx(t), f.sy(arr[i])]);
    el("path", { d: `M${f.sx(0)},${f.sy(0)} L` + pts(post).map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" L") + ` L${f.sx(1)},${f.sy(0)} Z`, style: `fill:${C.post};fill-opacity:0.12` }, svg);
    if (n > 0) polyline(svg, pts(lik), `stroke:${C.like};stroke-width:1.5`);
    dots(svg, pts(post), `stroke:${C.post};stroke-width:3`);
    polyline(svg, pts(post), `stroke:${C.post};stroke-width:1.5`);

    const meanT = post.reduce((acc, p, i) => acc + p * GRID[i], 0);
    let c = 0, lo = null, hi = null;
    post.forEach((p, i) => { c += p; if (lo === null && c >= 0.025) lo = GRID[i]; if (hi === null && c >= 0.975) hi = GRID[i]; });

    // Posterior predictive for the next m flips.
    const lch = (y) => lgamma(m + 1) - lgamma(y + 1) - lgamma(m - y + 1);
    const binom = (y, t) => (t === 0 ? (y === 0 ? 1 : 0) : t === 1 ? (y === m ? 1 : 0) : Math.exp(lch(y) + y * Math.log(t) + (m - y) * Math.log1p(-t)));
    const pred = Array.from({ length: m + 1 }, (_, y) => post.reduce((acc, p, i) => acc + p * binom(y, GRID[i]), 0));
    const plug = Array.from({ length: m + 1 }, (_, y) => binom(y, meanT));
    const qmax = Math.max(...pred, ...plug) * 1.15;
    const qf = frame(qsvg, { box: [40, 24, 545, 96], x: [-0.6, m + 0.6], y: [0, qmax], xticks: niceTicks(0, m, Math.min(m, 10)).filter(Number.isInteger), yticks: niceTicks(0, qmax, 3), xfmt: tickFmt, yfmt: (v) => num(v, 2), xlabel: `heads in the next ${m}`, ylabel: "predictive probability" });
    const w = Math.min(22, (qf.sx(1) - qf.sx(0)) * 0.7);
    pred.forEach((v, y) => el("rect", { x: qf.sx(y) - w / 2, y: qf.sy(v), width: w, height: qf.T + qf.H - qf.sy(v), rx: 1.5, style: `fill:${C.post};fill-opacity:0.55` }, qsvg));
    dots(qsvg, plug.map((v, y) => [qf.sx(y), qf.sy(v)]), "stroke:var(--foreground);stroke-width:4.5");
    const mom = (arr) => {
      const mu = arr.reduce((acc, p, y) => acc + p * y, 0);
      return Math.sqrt(arr.reduce((acc, p, y) => acc + p * (y - mu) ** 2, 0));
    };
    o.mean.textContent = num(meanT, 3);
    o.ci.textContent = `[${num(lo, 2)}, ${num(hi, 2)}]`;
    o.next.textContent = num(meanT, 3);
    o.psd.textContent = num(mom(pred), 2);
    o.bsd.textContent = num(mom(plug), 2);
  }
  draw();
}

// ============================================================ Normal–Normal shrinkage

for (const root of document.querySelectorAll("[data-bayes-shrink]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const bar = root.querySelector('[data-bar="prior"]');
  let f = null;

  const drag = (e) => {
    if (!f) return;
    const [x] = svgPoint(svg, e);
    const v = f.x0 + ((x - f.L) / f.W) * (f.x1 - f.x0);
    s.xbar.set(Math.max(-10, Math.min(10, v)), false);
    draw();
  };
  let down = false;
  svg.addEventListener("pointerdown", (e) => { down = true; try { svg.setPointerCapture(e.pointerId); } catch {} drag(e); });
  svg.addEventListener("pointermove", (e) => { if (down) drag(e); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) svg.addEventListener(t, () => (down = false));

  function draw() {
    const mu0 = s.mu0.get(), t0 = s.tau0.get(), xb = s.xbar.get(), n = s.n.get(), sg = s.sigma.get();
    const p0 = 1 / t0 ** 2, pd = n / sg ** 2;
    const pm = (p0 * mu0 + pd * xb) / (p0 + pd), ps = 1 / Math.sqrt(p0 + pd), se = sg / Math.sqrt(n);
    const x0 = -12, x1 = 12;
    const ymax = Math.max(normPdf(0, 0, ps), normPdf(0, 0, se), normPdf(0, 0, t0)) * 1.12;
    svg.replaceChildren();
    f = frame(svg, { box: [40, 24, 545, 230], x: [x0, x1], y: [0, ymax], xticks: niceTicks(x0, x1, 12), yticks: niceTicks(0, ymax, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "μ", ylabel: "density" });
    f.x0 = x0; f.x1 = x1; f.ymax = ymax;
    area(svg, f, (x) => normPdf(x, pm, ps), x0, x1, `fill:${C.post};fill-opacity:0.12`, 400);
    curve(svg, f, (x) => normPdf(x, mu0, t0), x0, x1, `stroke:${C.prior};stroke-width:1.5;stroke-dasharray:5 4`, 400);
    curve(svg, f, (x) => normPdf(x, xb, se), x0, x1, `stroke:${C.like};stroke-width:1.5`, 400);
    curve(svg, f, (x) => normPdf(x, pm, ps), x0, x1, `stroke:${C.post};stroke-width:2.25`, 400);
    const mark = (x, color, label, dy) => {
      el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T + f.H, y2: f.T + f.H - 10, style: `stroke:${color};stroke-width:2` }, svg);
      text(svg, f.sx(x), f.T + f.H + 26 + dy, label, { "text-anchor": "middle", style: `fill:${color}` });
    };
    mark(mu0, C.prior, "μ₀", 0);
    mark(pm, C.post, "posterior", 0);
    // The draggable sample mean.
    el("circle", { cx: f.sx(xb), cy: f.T + f.H, r: 6, style: `fill:var(--background);stroke:${C.like};stroke-width:2;cursor:ew-resize` }, svg);
    text(svg, f.sx(xb), f.T + f.H - 12, "sample mean (drag)", { "text-anchor": "middle" });
    const wp = p0 / (p0 + pd);
    bar.style.width = (100 * wp).toFixed(1) + "%";
    o.wprior.textContent = `prior weight ${pct(wp)}`;
    o.wdata.textContent = `data weight ${pct(1 - wp)}`;
    o.mean.textContent = neg(num(pm, 3));
    o.sd.textContent = num(ps, 3);
    o.ci.textContent = `[${neg(num(pm - 1.96 * ps, 2))}, ${neg(num(pm + 1.96 * ps, 2))}]`;
    o.shrink.textContent = Math.abs(xb - mu0) < 1e-9 ? "none" : `${pct(wp)} toward μ₀`;
  }
  draw();
}

// ============================================================ Eight schools

const SCHOOLS = { y: [28, 8, -3, 7, -1, 1, 18, 12], s: [15, 10, 16, 11, 9, 11, 10, 18], names: "ABCDEFGH" };

/** Conditional posterior given τ, with μ integrated out under a flat prior (BDA3 §5.4). */
function schoolsGiven(tau) {
  const { y, s } = SCHOOLS;
  const t2 = Math.max(tau, 1e-6) ** 2;
  const w = s.map((si) => 1 / (si * si + t2));
  const W = w.reduce((a, b) => a + b, 0);
  const mu = w.reduce((acc, wi, i) => acc + wi * y[i], 0) / W, Vmu = 1 / W;
  const theta = y.map((yi, i) => {
    const pj = 1 / s[i] ** 2 + 1 / t2, V = 1 / pj;
    const m = (yi / s[i] ** 2 + mu / t2) * V;
    // Var = V + (V/τ²)² Vμ: the uncertainty in μ propagates through the pull.
    return { m, sd: Math.sqrt(V + (V / t2) ** 2 * Vmu) };
  });
  // Unnormalised log p(τ | y) with a flat prior on τ (BDA3 eq 5.21).
  const lp = 0.5 * Math.log(Vmu) + y.reduce((acc, yi, i) => acc - 0.5 * Math.log(s[i] ** 2 + t2) - (yi - mu) ** 2 / (2 * (s[i] ** 2 + t2)), 0);
  return { mu, Vmu, theta, lp };
}

const TAUS = Array.from({ length: 601 }, (_, i) => i * 0.05);
const TAU_POST = (() => {
  const lps = TAUS.map((t) => schoolsGiven(t).lp);
  const mx = Math.max(...lps);
  const p = lps.map((v) => Math.exp(v - mx));
  const z = p.reduce((a, b) => a + b, 0);
  return p.map((v) => v / z);
})();

for (const root of document.querySelectorAll("[data-bayes-schools]")) {
  const fsvg = root.querySelector("[data-forest]"), psvg = root.querySelector("[data-paths]"), tsvg = root.querySelector("[data-tau]");
  const o = outs(root);
  const s = scrubAll(root, () => { if (mode === "avg" || mode === "none" || mode === "complete") setMode("partial"); else draw(); });
  let mode = "partial";
  const setMode = (m) => {
    mode = m;
    root.querySelectorAll('[role="tablist"] [data-seg]').forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === m)));
    draw();
  };
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function estimates() {
    const { y, s: sg } = SCHOOLS;
    if (mode === "none") return { mu: null, est: y.map((yi, i) => ({ m: yi, sd: sg[i] })) };
    if (mode === "complete") {
      const g = schoolsGiven(0);
      return { mu: g.mu, est: y.map(() => ({ m: g.mu, sd: Math.sqrt(g.Vmu) })) };
    }
    if (mode === "avg") {
      // Mixture over τ: mean and total variance of each θj.
      const acc = y.map(() => ({ m: 0, m2: 0 }));
      let mu = 0;
      TAUS.forEach((t, k) => {
        const g = schoolsGiven(t), w = TAU_POST[k];
        mu += w * g.mu;
        g.theta.forEach((th, i) => { acc[i].m += w * th.m; acc[i].m2 += w * (th.sd ** 2 + th.m ** 2); });
      });
      return { mu, est: acc.map((a) => ({ m: a.m, sd: Math.sqrt(Math.max(0, a.m2 - a.m ** 2)) })) };
    }
    const g = schoolsGiven(s.tau.get());
    return { mu: g.mu, est: g.theta };
  }

  function draw() {
    const { y, s: sg, names } = SCHOOLS;
    const { mu, est } = estimates();
    // Forest plot.
    fsvg.replaceChildren();
    const ff = frame(fsvg, { box: [26, 10, 262, 258], x: [-25, 50], y: [0, 8], xticks: [-20, 0, 20, 40], yticks: [], xfmt: tickFmt, xlabel: "effect (points)" });
    if (mu !== null) el("line", { x1: ff.sx(mu), x2: ff.sx(mu), y1: ff.T, y2: ff.T + ff.H, style: `stroke:${C.post};stroke-dasharray:3 3;stroke-opacity:0.7` }, fsvg);
    el("line", { x1: ff.sx(0), x2: ff.sx(0), y1: ff.T, y2: ff.T + ff.H, style: "stroke:currentColor;stroke-opacity:0.25" }, fsvg);
    y.forEach((yi, i) => {
      const cy = ff.T + ((i + 0.5) / 8) * ff.H;
      text(fsvg, 8, cy + 3, names[i]);
      el("line", { x1: ff.sx(yi - sg[i]), x2: ff.sx(yi + sg[i]), y1: cy - 5, y2: cy - 5, style: `stroke:${C.like};stroke-width:1.25;stroke-opacity:0.8` }, fsvg);
      el("circle", { cx: ff.sx(yi), cy: cy - 5, r: 2.5, style: `fill:${C.like}` }, fsvg);
      const e = est[i];
      el("line", { x1: ff.sx(e.m - e.sd), x2: ff.sx(e.m + e.sd), y1: cy + 5, y2: cy + 5, style: `stroke:${C.post};stroke-width:2.25;stroke-linecap:round` }, fsvg);
      el("circle", { cx: ff.sx(e.m), cy: cy + 5, r: 3.5, style: `fill:${C.post}` }, fsvg);
    });
    // Shrinkage paths over τ.
    psvg.replaceChildren();
    const pf = frame(psvg, { box: [34, 24, 240, 140], x: [0, 30], y: [-5, 30], xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 10, 20, 30], xfmt: tickFmt, yfmt: tickFmt, xlabel: "τ", ylabel: "E(θⱼ | τ, y)" });
    const grid = TAUS.filter((t) => t <= 30 && t > 0);
    const ends = schoolsGiven(30).theta.map((t, i) => ({ i, y: pf.sy(t.m) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 9);
    names.split("").forEach((nm, i) => {
      polyline(psvg, grid.map((t) => [pf.sx(t), pf.sy(schoolsGiven(t).theta[i].m)]), `stroke:${C.post};stroke-width:1.25;stroke-opacity:${i === 0 ? 1 : 0.45}`);
      text(psvg, pf.L + pf.W + 4, ends.find((e) => e.i === i).y + 3, nm, { style: i === 0 ? `fill:${C.post}` : undefined });
    });
    const tcur = mode === "partial" ? s.tau.get() : mode === "complete" ? 0 : mode === "avg" ? null : 30;
    if (tcur !== null) el("line", { x1: pf.sx(tcur), x2: pf.sx(tcur), y1: pf.T, y2: pf.T + pf.H, style: "stroke:var(--brand);stroke-width:1.5" }, psvg);
    // Marginal posterior of τ.
    tsvg.replaceChildren();
    const sub = TAUS.filter((t) => t <= 30);
    const pmax = Math.max(...TAU_POST) * 1.1;
    const tf = frame(tsvg, { box: [34, 22, 240, 52], x: [0, 30], y: [0, pmax], xticks: [0, 10, 20, 30], yticks: [], xfmt: tickFmt, xlabel: "τ", ylabel: "p(τ | y)" });
    const tp = sub.map((t, k) => [tf.sx(t), tf.sy(TAU_POST[k])]);
    el("path", { d: `M${tf.sx(0)},${tf.sy(0)} L` + tp.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" L") + ` L${tf.sx(30)},${tf.sy(0)} Z`, style: `fill:${C.post};fill-opacity:0.15` }, tsvg);
    polyline(tsvg, tp, `stroke:${C.post};stroke-width:1.5`);
    if (tcur !== null) el("line", { x1: tf.sx(tcur), x2: tf.sx(tcur), y1: tf.T, y2: tf.T + tf.H, style: "stroke:var(--brand);stroke-width:1.5" }, tsvg);

    o.mu.textContent = mu === null ? "— (no common mean)" : num(mu, 2);
    o.a.textContent = `${num(est[0].m, 1)} ± ${num(est[0].sd, 1)}`;
    o.pull.textContent = mu === null ? "0%" : pct(Math.max(0, Math.min(1, (28 - est[0].m) / (28 - mu))), 0) + "";
    o.ptau.textContent = num(TAUS.reduce((acc, t, k) => acc + (t < 5 ? TAU_POST[k] : 0), 0), 3);
  }
  draw();
}

// ============================================================ A/B test

for (const root of document.querySelectorAll("[data-bayes-ab]")) {
  const svg = root.querySelector("[data-plot]"), lsvg = root.querySelector("[data-lift]");
  const o = outs(root);
  const s = scrubAll(root, (name) => {
    if (name === "ka" || name === "na") { if (s.ka.get() > s.na.get()) s.ka.set(s.na.get(), false); }
    if (name === "kb" || name === "nb") { if (s.kb.get() > s.nb.get()) s.kb.set(s.nb.get(), false); }
    schedule();
  });
  let pending = 0;
  const schedule = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(draw); };
  const A = "var(--vec-i)", B = C.post;

  function draw() {
    const na = s.na.get(), ka = s.ka.get(), nb = s.nb.get(), kb = s.kb.get();
    const aA = ka + 1, bA = na - ka + 1, aB = kb + 1, bB = nb - kb + 1;
    const mA = aA / (aA + bA), mB = aB / (aB + bB);
    const sdA = Math.sqrt((mA * (1 - mA)) / (aA + bA + 1)), sdB = Math.sqrt((mB * (1 - mB)) / (aB + bB + 1));
    const x0 = Math.max(0, Math.min(mA - 5 * sdA, mB - 5 * sdB)), x1 = Math.min(1, Math.max(mA + 5 * sdA, mB + 5 * sdB));
    const ymax = Math.max(betaPdf(Math.min(0.9999, Math.max(1e-4, mA)), aA, bA), betaPdf(Math.min(0.9999, Math.max(1e-4, mB)), aB, bB)) * 1.15 || 1;
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 24, 545, 138], x: [x0, x1], y: [0, ymax], xticks: niceTicks(x0, x1, 8), yticks: niceTicks(0, ymax, 3), xfmt: (v) => num(100 * v, 1) + "%", yfmt: tickFmt, xlabel: "conversion rate", ylabel: "density" });
    f.ymax = ymax;
    for (const [a, b, col] of [[aA, bA, A], [aB, bB, B]]) {
      area(svg, f, (x) => betaPdf(x, a, b), x0, x1, `fill:${col};fill-opacity:0.12`, 300);
      curve(svg, f, (x) => betaPdf(x, a, b), x0, x1, `stroke:${col};stroke-width:2`, 300);
    }
    // Exact P(B > A); posterior draws for the lift and the expected losses.
    const pB = probBBeatsA(aA, bA, aB, bB);
    const rng = mulberry32(7);
    const N = 20000, lift = new Float64Array(N);
    let lossB = 0, lossA = 0;
    for (let i = 0; i < N; i++) {
      const xa = betaDraw(aA, bA, rng), xb = betaDraw(aB, bB, rng);
      lift[i] = (xb - xa) / xa;
      lossB += Math.max(xa - xb, 0);
      lossA += Math.max(xb - xa, 0);
    }
    lossB /= N; lossA /= N;
    const sorted = Float64Array.from(lift).sort();
    const q = (p) => sorted[Math.min(N - 1, Math.floor(p * N))];
    const l0 = q(0.005), l1 = q(0.995), bins = 60, h = new Array(bins).fill(0);
    for (const v of lift) if (v >= l0 && v <= l1) h[Math.min(bins - 1, Math.floor(((v - l0) / (l1 - l0)) * bins))]++;
    lsvg.replaceChildren();
    const hmax = Math.max(...h) * 1.1;
    const lf = frame(lsvg, { box: [40, 10, 545, 96], x: [l0, l1], y: [0, hmax], xticks: niceTicks(l0, l1, 8), yticks: [], xfmt: (v) => neg(num(100 * v, 0)) + "%", xlabel: "relative lift of B over A" });
    const bw = lf.W / bins;
    h.forEach((c, i) => {
      const xv = l0 + ((i + 0.5) / bins) * (l1 - l0);
      el("rect", { x: lf.L + i * bw + 0.5, y: lf.sy(c), width: Math.max(0.5, bw - 1), height: lf.T + lf.H - lf.sy(c), style: xv > 0 ? "fill:var(--brand);fill-opacity:0.7" : "fill:var(--foreground);fill-opacity:0.25" }, lsvg);
    });
    if (l0 < 0 && l1 > 0) el("line", { x1: lf.sx(0), x2: lf.sx(0), y1: lf.T, y2: lf.T + lf.H, style: "stroke:currentColor;stroke-opacity:0.5" }, lsvg);
    // Frequentist two-proportion z-test.
    const pa = ka / na, pb = kb / nb, pp = (ka + kb) / (na + nb);
    const se = Math.sqrt(pp * (1 - pp) * (1 / na + 1 / nb));
    const z = se > 0 ? (pb - pa) / se : 0;
    const p = 2 * (1 - normCdf(Math.abs(z)));
    o.pb.textContent = num(pB, 4);
    o.lossb.textContent = num(100 * lossB, 3) + " pts";
    o.lossa.textContent = num(100 * lossA, 3) + " pts";
    o.lift.textContent = `${neg(num(100 * q(0.025), 1))}% to ${neg(num(100 * q(0.975), 1))}%`;
    o.p.textContent = pfmt(p);
  }
  draw();
}
