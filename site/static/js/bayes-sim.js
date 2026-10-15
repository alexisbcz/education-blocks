// Bayesian inference blocks, part two: Bayes factors and Lindley's paradox,
// optional stopping, and Thompson sampling.

import { scrubAll } from "./scrub.js";
import {
  C, el, text, frame, polyline, num, neg, pct, pfmt, outs, onAction, niceTicks, tickFmt,
  lbeta, logBetaPdf, betaPdf, betaDraw, mulberry32, normCdf, lgamma, area, curve, dots, whenVisible,
} from "./bayes-math.js";

// ============================================================ Bayes factors

/** Savage–Dickey: BF01 = posterior density at ½ over prior density at ½, under H1 = Beta(c, c). */
const logBF01 = (n, k, c) => logBetaPdf(0.5, c + k, c + n - k) - logBetaPdf(0.5, c, c);

/** Two-sided exact binomial test of θ = ½ (points no more likely than k), or the normal approximation for large n. */
function binomP(n, k) {
  if (n > 5000) {
    const z = (Math.abs(2 * k - n) - 1) / Math.sqrt(n);
    return Math.min(1, 2 * (1 - normCdf(Math.max(0, z))));
  }
  const lp = (j) => lgamma(n + 1) - lgamma(j + 1) - lgamma(n - j + 1) - n * Math.LN2;
  const ref = lp(k) + 1e-9;
  let p = 0;
  for (let j = 0; j <= n; j++) { const v = lp(j); if (v <= ref) p += Math.exp(v); }
  return Math.min(1, p);
}

const scale = (bf) =>
  bf < 1 ? "" : bf < 3 ? "anecdotal" : bf < 20 ? "positive" : bf < 150 ? "strong" : "very strong";

for (const root of document.querySelectorAll("[data-bayes-bf]")) {
  const svg = root.querySelector("[data-plot]"), wsvg = root.querySelector("[data-sweep]");
  const o = outs(root);
  const s = scrubAll(root, (name) => {
    if (name === "k" && s.k.get() > s.n.get()) s.n.set(s.k.get(), false);
    if (name === "n" && s.k.get() > s.n.get()) s.k.set(s.n.get(), false);
    draw();
  });
  onAction(root, (act) => {
    if (act === "small") { s.n.set(100, false); s.k.set(61, false); s.c.set(1, false); }
    if (act === "lindley") { s.n.set(100000, false); s.k.set(50330, false); s.c.set(1, false); }
    draw();
  });

  function draw() {
    const n = s.n.get(), k = s.k.get(), c = s.c.get();
    const a = c + k, b = c + n - k;
    const lbf = logBF01(n, k, c), bf01 = Math.exp(lbf);
    const m = a / (a + b), sdp = Math.sqrt((m * (1 - m)) / (a + b + 1));
    // Zoom so both ½ and the posterior bulk are in view.
    let x0 = Math.max(0, Math.min(0.5, m) - 5 * sdp), x1 = Math.min(1, Math.max(0.5, m) + 5 * sdp);
    if (x1 - x0 > 0.6) { x0 = 0; x1 = 1; }
    const dPost = Math.exp(logBetaPdf(0.5, a, b)), dPrior = Math.exp(logBetaPdf(0.5, c, c));
    const peak = Math.exp(logBetaPdf(Math.min(0.999, Math.max(0.001, m)), a, b));
    const ymax = Math.max(peak, dPrior, 1) * 1.15;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 24, 541, 150], x: [x0, x1], y: [0, ymax], xticks: niceTicks(x0, x1, 8), yticks: niceTicks(0, ymax, 3), xfmt: tickFmt, yfmt: tickFmt, xlabel: "θ under H₁", ylabel: "density" });
    f.ymax = ymax;
    area(svg, f, (x) => betaPdf(x, a, b), x0 + 1e-6, x1 - 1e-6, `fill:${C.post};fill-opacity:0.12`, 400);
    curve(svg, f, (x) => betaPdf(x, c, c), x0 + 1e-6, x1 - 1e-6, `stroke:${C.prior};stroke-width:1.5;stroke-dasharray:5 4`, 400);
    curve(svg, f, (x) => betaPdf(x, a, b), x0 + 1e-6, x1 - 1e-6, `stroke:${C.post};stroke-width:2.25`, 400);
    el("line", { x1: f.sx(0.5), x2: f.sx(0.5), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    for (const d of [dPost, dPrior])
      el("circle", { cx: f.sx(0.5), cy: f.sy(Math.min(ymax, d)), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    text(svg, f.L + f.W, 12, `at θ = 0.5: posterior ${fmtD(dPost)} ÷ prior ${fmtD(dPrior)} = BF₀₁ ${fmtBF(bf01)}`, { "text-anchor": "end" });

    // Lindley sweep: BF01 at fixed z = 2 as n grows (log–log).
    wsvg.replaceChildren();
    const ns = Array.from({ length: 121 }, (_, i) => 10 ** (1 + (6 * i) / 120));
    const bfz = ns.map((nn) => logBF01(nn, nn / 2 + Math.sqrt(nn), c) / Math.LN10);
    const ylo = Math.min(-1.5, Math.floor(Math.min(...bfz))), yhi = Math.max(2, Math.ceil(Math.max(...bfz)));
    const wf = frame(wsvg, { box: [44, 24, 541, 92], x: [1, 7], y: [ylo, yhi], xticks: [1, 2, 3, 4, 5, 6, 7], yticks: niceTicks(ylo, yhi, 4).filter(Number.isInteger), xfmt: (v) => "10" + sup(v), yfmt: (v) => "10" + sup(v), xlabel: "n flips at z = 2 (p ≈ 0.046)", ylabel: "BF₀₁" });
    el("line", { x1: wf.L, x2: wf.L + wf.W, y1: wf.sy(0), y2: wf.sy(0), style: "stroke:currentColor;stroke-opacity:0.5;stroke-dasharray:4 3" }, wsvg);
    text(wsvg, wf.L + wf.W - 4, wf.sy(0) + 12, "BF = 1: no evidence either way", { "text-anchor": "end" });
    polyline(wsvg, ns.map((nn, i) => [wf.sx(Math.log10(nn)), wf.sy(bfz[i])]), `stroke:${C.post};stroke-width:2`);
    const ln = Math.log10(Math.max(10, Math.min(1e7, n)));
    el("line", { x1: wf.sx(ln), x2: wf.sx(ln), y1: wf.T, y2: wf.T + wf.H, style: "stroke:var(--brand);stroke-width:1.5" }, wsvg);

    const p = binomP(n, k);
    o.bf01.textContent = fmtBF(bf01);
    o.bf10.textContent = fmtBF(1 / bf01);
    o.ph0.textContent = num(bf01 / (1 + bf01), 3);
    o.p.textContent = pfmt(p);
    const fav = bf01 >= 1 ? "H₀" : "H₁", strength = scale(Math.max(bf01, 1 / bf01));
    o.verdict.textContent = strength ? `${strength} for ${fav}` : "no evidence";
  }
  const fmtD = (d) => (d >= 100 ? num(d, 0) : d >= 0.01 ? num(d, 2) : d.toExponential(1).replace("-", "−"));
  const fmtBF = (v) => (v >= 1e4 || v < 1e-3 ? v.toExponential(2).replace("e+", "e").replace("-", "−") : num(v, v >= 100 ? 0 : 3));
  const sup = (v) => neg(String(v)).replace(/[−0-9]/g, (ch) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["−0123456789".indexOf(ch)]);
  draw();
}

// ============================================================ Optional stopping

for (const root of document.querySelectorAll("[data-bayes-stop]")) {
  const rsvg = root.querySelector("[data-rate]"), csvg = root.querySelector("[data-calib]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  let job = 0;

  onAction(root, (act) => {
    if (act === "reseed") s.seed.set(1 + Math.floor(Math.random() * 9998), false);
    run();
  });

  function run() {
    const R = s.runs.get(), N = s.max.get(), rng = mulberry32(s.seed.get() * 7919);
    const me = ++job;
    const firstP = new Int32Array(R).fill(-1), firstB = new Int32Array(R).fill(-1);
    const bins = Array.from({ length: 10 }, () => ({ n: 0, h0: 0, pred: 0 }));
    let r = 0;
    o.fp.textContent = o.fb.textContent = o.cal.textContent = "…";
    const chunk = () => {
      if (me !== job) return;
      const end = Math.min(R, r + Math.max(50, Math.floor(400000 / N)));
      for (; r < end; r++) {
        // Left: a fair coin, peeking from the 10th flip.
        let k = 0, lbf = 0;
        for (let n = 1; n <= N; n++) {
          const h = rng() < 0.5;
          // log BF10 with a Beta(1, 1) prior, updated one flip at a time.
          lbf += Math.LN2 + Math.log((h ? k + 1 : n - k) / (n + 1));
          if (h) k++;
          if (n >= 10) {
            if (firstP[r] < 0 && Math.abs(2 * k - n) / Math.sqrt(n) > 1.959964) firstP[r] = n;
            if (firstB[r] < 0 && lbf > Math.log(3)) firstB[r] = n;
            if (firstP[r] >= 0 && firstB[r] >= 0) break;
          }
        }
        // Right: a world drawn from the prior; stop when P(H0) leaves [0.1, 0.9].
        const h0 = rng() < 0.5, th = h0 ? 0.5 : rng();
        let kk = 0, lb = 0, ph0 = 0.5;
        for (let n = 1; n <= N; n++) {
          const h = rng() < th;
          lb += Math.LN2 + Math.log((h ? kk + 1 : n - kk) / (n + 1));
          if (h) kk++;
          ph0 = 1 / (1 + Math.exp(lb));
          if (ph0 < 0.1 || ph0 > 0.9) break;
        }
        const bi = Math.min(9, Math.floor(ph0 * 10));
        bins[bi].n++; bins[bi].pred += ph0; if (h0) bins[bi].h0++;
      }
      drawResults(firstP, firstB, bins, r, N);
      if (r < R) requestAnimationFrame(chunk);
    };
    requestAnimationFrame(chunk);
  }

  function drawResults(firstP, firstB, bins, R, N) {
    rsvg.replaceChildren();
    const xs = niceTicks(0, N, 4);
    const f = frame(rsvg, { box: [36, 24, 252, 180], x: [0, N], y: [0, 0.6], xticks: xs, yticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xfmt: tickFmt, yfmt: (v) => num(100 * v, 0) + "%", xlabel: "maximum flips", ylabel: "false alarms" });
    const cdf = (first) => {
      const cnt = new Float64Array(N + 1);
      for (let i = 0; i < R; i++) if (first[i] > 0) cnt[first[i]]++;
      const pts = [];
      let c = 0;
      for (let n = 0; n <= N; n++) { c += cnt[n]; if (n % Math.max(1, Math.floor(N / 200)) === 0 || n === N) pts.push([f.sx(n), f.sy(c / Math.max(1, R))]); }
      return [pts, c / Math.max(1, R)];
    };
    const [pp, fp] = cdf(firstP), [pb, fb] = cdf(firstB);
    for (const [y, lbl] of [[0.05, "5%"], [1 / 3, "1/3 bound"]]) {
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(y), y2: f.sy(y), style: "stroke:var(--foreground);stroke-opacity:0.45;stroke-dasharray:4 3" }, rsvg);
      text(rsvg, f.L + f.W - 2, f.sy(y) - 4, lbl, { "text-anchor": "end" });
    }
    polyline(rsvg, pp, `stroke:${C.like};stroke-width:2`);
    polyline(rsvg, pb, `stroke:${C.post};stroke-width:2`);

    csvg.replaceChildren();
    const cf = frame(csvg, { box: [36, 24, 252, 180], x: [0, 1], y: [0, 1], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0, 0.2, 0.4, 0.6, 0.8, 1], xfmt: tickFmt, yfmt: tickFmt, xlabel: "reported P(H₀ | data)", ylabel: "fraction with H₀ true" });
    el("line", { x1: cf.sx(0), y1: cf.sy(0), x2: cf.sx(1), y2: cf.sy(1), style: "stroke:var(--foreground);stroke-opacity:0.45;stroke-dasharray:4 3" }, csvg);
    let err = 0, tot = 0;
    const maxN = Math.max(1, ...bins.map((b) => b.n));
    for (const b of bins) {
      if (!b.n) continue;
      const px = b.pred / b.n, py = b.h0 / b.n;
      err += b.n * Math.abs(px - py); tot += b.n;
      // Bins with few runs are drawn hollow: their frequencies are noisy.
      const few = b.n < 30;
      el("circle", { cx: cf.sx(px), cy: cf.sy(py), r: 2.5 + 6 * Math.sqrt(b.n / maxN), style: `fill:${C.post};fill-opacity:${few ? 0 : 0.55};stroke:${C.post};stroke-opacity:${few ? 0.6 : 1}` }, csvg);
    }
    o.fp.textContent = pct(fp);
    o.fb.textContent = pct(fb);
    o.bound.textContent = fb <= 1 / 3 ? "holds" : "exceeded";
    o.cal.textContent = tot ? num(err / tot, 3) : "—";
  }
  run();
}

// ============================================================ Thompson sampling

for (const root of document.querySelectorAll("[data-bayes-bandit]")) {
  const psvg = root.querySelector("[data-post]"), gsvg = root.querySelector("[data-regret]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  let seed = 1, job = 0;
  onAction(root, (act) => {
    if (act === "reseed") seed = 1 + Math.floor(Math.random() * 1e6);
    run();
  });

  function run() {
    const P = [s.p1.get(), s.p2.get(), s.p3.get()], T = s.T.get(), eps = s.eps.get();
    const best = Math.max(...P), bestArm = P.indexOf(best);
    const RUNS = 100, me = ++job;
    const reg = { ts: new Float64Array(T), eg: new Float64Array(T), gr: new Float64Array(T) };
    let r = 0, found = 0, first = null;
    const rng = mulberry32(seed * 104729);
    const pull = (arm) => (rng() < P[arm] ? 1 : 0);
    const argmax = (v) => {
      let m = -Infinity, idx = [];
      v.forEach((x, i) => { if (x > m) { m = x; idx = [i]; } else if (x === m) idx.push(i); });
      return idx[Math.floor(rng() * idx.length)];
    };
    const chunk = () => {
      if (me !== job) return;
      const end = Math.min(RUNS, r + Math.max(1, Math.floor(60000 / T)));
      for (; r < end; r++) {
        // Thompson: one Beta draw per arm, play the largest.
        const S = [0, 0, 0], F = [0, 0, 0], cnt = [0, 0, 0];
        let cum = 0;
        for (let t = 0; t < T; t++) {
          const arm = argmax([0, 1, 2].map((i) => betaDraw(S[i] + 1, F[i] + 1, rng)));
          pull(arm) ? S[arm]++ : F[arm]++;
          cnt[arm]++;
          cum += best - P[arm];
          reg.ts[t] += cum;
        }
        if (cnt.indexOf(Math.max(...cnt)) === bestArm) found++;
        if (!first) first = { S, F, cnt };
        // ε-greedy and greedy: one pull of each arm, then the best mean.
        for (const [key, e] of [["eg", eps], ["gr", 0]]) {
          const sum = [0, 0, 0], n = [0, 0, 0];
          let c = 0;
          for (let t = 0; t < T; t++) {
            const arm = t < 3 ? t : rng() < e ? Math.floor(rng() * 3) : argmax(sum.map((v, i) => v / n[i]));
            sum[arm] += pull(arm); n[arm]++;
            c += best - P[arm];
            reg[key][t] += c;
          }
        }
      }
      draw(reg, r, T, P, first, found);
      if (r < RUNS) requestAnimationFrame(chunk);
    };
    o.rt.textContent = o.re.textContent = o.rg.textContent = o.best.textContent = "…";
    requestAnimationFrame(chunk);
  }

  function draw(reg, R, T, P, first, found) {
    // Posteriors of the first Thompson run.
    psvg.replaceChildren();
    const ys = [0, 1, 2].map((i) => (x) => betaPdf(x, first.S[i] + 1, first.F[i] + 1));
    let ymax = 0;
    for (let i = 1; i < 200; i++) for (const g of ys) ymax = Math.max(ymax, g(i / 200));
    ymax *= 1.15;
    const f = frame(psvg, { box: [40, 24, 545, 112], x: [0, 1], y: [0, ymax], xticks: niceTicks(0, 1, 10), yticks: niceTicks(0, ymax, 3), xfmt: tickFmt, yfmt: tickFmt, xlabel: "payout rate (one Thompson run)", ylabel: "posterior density" });
    f.ymax = ymax;
    ys.forEach((g, i) => {
      const op = [0.45, 0.7, 1][i];
      area(psvg, f, g, 1e-4, 1 - 1e-4, `fill:${C.post};fill-opacity:${0.06 + 0.04 * i}`);
      curve(psvg, f, g, 1e-4, 1 - 1e-4, `stroke:${C.post};stroke-width:1.75;stroke-opacity:${op}`);
      el("line", { x1: f.sx(P[i]), x2: f.sx(P[i]), y1: f.T + f.H, y2: f.T + f.H - 8, style: "stroke:currentColor;stroke-width:2" }, psvg);
      const mx = (first.S[i] + 1) / (first.S[i] + first.F[i] + 2);
      const peak = Math.min(ymax * 0.92, g(Math.min(0.999, Math.max(0.001, mx))));
      text(psvg, f.sx(mx), f.sy(peak) - 5 - 9 * (i === 1 && Math.abs(P[1] - P[2]) < 0.1 ? 1 : 0), `arm ${i + 1} · ${first.cnt[i]} pulls`, { "text-anchor": "middle" });
    });
    // Average cumulative regret.
    gsvg.replaceChildren();
    const avg = (arr, t) => arr[t] / Math.max(1, R);
    const top = Math.max(avg(reg.gr, T - 1), avg(reg.eg, T - 1), avg(reg.ts, T - 1), 1) * 1.1;
    const g = frame(gsvg, { box: [40, 24, 545, 130], x: [0, T], y: [0, top], xticks: niceTicks(0, T, 6), yticks: niceTicks(0, top, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "pulls", ylabel: "average cumulative regret" });
    const step = Math.max(1, Math.floor(T / 300));
    for (const [key, col] of [["gr", C.prior], ["eg", C.like], ["ts", C.post]]) {
      const pts = [];
      for (let t = 0; t < T; t += step) pts.push([g.sx(t + 1), g.sy(avg(reg[key], t))]);
      pts.push([g.sx(T), g.sy(avg(reg[key], T - 1))]);
      polyline(gsvg, pts, `stroke:${col};stroke-width:2`);
    }
    o.rt.textContent = num(avg(reg.ts, T - 1), 1);
    o.re.textContent = num(avg(reg.eg, T - 1), 1);
    o.rg.textContent = num(avg(reg.gr, T - 1), 1);
    o.best.textContent = `${pct(found / Math.max(1, R), 0)} of ${R} runs`;
  }
  run();
}
