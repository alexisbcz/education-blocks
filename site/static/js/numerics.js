// Numerical methods, blocks 1–5: cancellation, summation, conditioning,
// root finding and interpolation. Every error is measured against an
// exact or correctly rounded reference, never against another estimate.
// Blocks 6–10 are in numerics-ode.js.

import { scrubAll } from "./scrub.js";
import {
  el, text, polyline, outs, plot, fx, sci, minus, onSeg, C, clipped, logFrame, lg, path,
  endLabels, slope, rng, batched, frame, ticks, decade,
} from "./numerics-util.js";

const EPS = 2 ** -52;

// ============================================================ Exact helpers
// A positive double is m·2^e exactly; these turn it into a fraction of
// big integers so references can be computed with as many digits as needed.

function frac(x) {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4);
  const expBits = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (expBits === 0) e = -1074;
  else { m |= 1n << 52n; e = expBits - 1075; }
  return e >= 0 ? { n: m << BigInt(e), d: 1n } : { n: m, d: 1n << BigInt(-e) };
}

function isqrt(N) {
  if (N < 2n) return N;
  let x = 1n << BigInt(Math.ceil(N.toString(2).length / 2) + 1);
  for (;;) {
    const y = (x + N / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

const bits = (v) => (v === 0n ? 0 : v.toString(2).length);

/** num/den as the nearest double (to within an ulp). */
function ratio(num, den) {
  const s = Math.max(0, 70 + bits(den) - bits(num));
  const q = (num << BigInt(s)) / den;
  return Number(q) * 2 ** -s;
}

// ============================================================ 1 Cancellation

const P = 140n; // extra bits for the big-integer square roots
const CANCEL = {
  cos: {
    e: [-10, 0.6], def: -6,
    naive: (x) => (1 - Math.cos(x)) / (x * x),
    stable: (x) => (2 * Math.sin(x / 2) ** 2) / (x * x),
    // Σ (−1)^k x^(2k) / (2k+2)!: terms shrink fast for |x| ≤ 2, no cancellation.
    ref: (x) => {
      if (Math.abs(x) > 2) return (2 * Math.sin(x / 2) ** 2) / (x * x);
      let term = 0.5, sum = 0;
      for (let k = 0; k < 30; k++) { sum += term; term *= (-x * x) / ((2 * k + 3) * (2 * k + 4)); }
      return sum;
    },
    form: "x = 10^e",
    note: "cos x agrees with 1 in about 2·log₁₀(1/x) leading digits, and the subtraction throws them away; below x ≈ 10⁻⁸ cos x rounds to exactly 1 and the naive form returns 0. Writing 1 − cos x = 2 sin²(x/2) removes the subtraction entirely.",
    labels: ["(1 − cos x)/x²", "2 sin²(x/2)/x²"],
  },
  sqrt: {
    e: [0, 15], def: 10,
    naive: (x) => Math.sqrt(x + 1) - Math.sqrt(x),
    stable: (x) => 1 / (Math.sqrt(x + 1) + Math.sqrt(x)),
    ref: (x) => {
      const { n, d } = frac(x);
      const a = isqrt((n + d) * d << (2n * P)), b = isqrt(n * d << (2n * P));
      return ratio(d << P, a + b);
    },
    form: "x = 10^e",
    note: "For large x the two square roots share most of their digits. Multiplying by the conjugate, √(x+1) − √x = 1/(√(x+1) + √x), turns the subtraction into an addition, which never cancels. The reference uses 140 extra bits of integer square root.",
    labels: ["√(x+1) − √x", "1/(√(x+1) + √x)"],
  },
  quad: {
    e: [0.1, 15], def: 6,
    naive: (b) => b - Math.sqrt(b * b - 1),
    stable: (b) => 1 / (b + Math.sqrt(b * b - 1)),
    ref: (b) => {
      const { n, d } = frac(b);
      const r = isqrt((n * n - d * d) << (2n * P));
      return ratio(d << P, (n << P) + r);
    },
    form: "b = 10^e",
    note: "The small root of t² − 2bt + 1 is b − √(b² − 1), a difference of nearly equal numbers; past b ≈ 10⁸, b² − 1 rounds to b² and the result is exactly 0. The roots multiply to 1, so the small root is 1/(b + √(b² − 1)), computed without cancellation (Vieta's trick, used in every robust quadratic solver).",
    labels: ["b − √(b² − 1)", "1/(b + √(b² − 1))"],
  },
};

for (const root of document.querySelectorAll("[data-numx-cancel]")) {
  const svg = plot(root), o = outs(root);
  let Q = CANCEL.cos;
  const s = scrubAll(root, () => draw());
  s.e.set(Q.def, false);
  onSeg(root, (_, v) => { Q = CANCEL[v]; s.e.set(Q.def, false); draw(); });
  const rel = (v, r) => Math.abs(v - r) / Math.abs(r);

  function draw() {
    const e = Math.min(Q.e[1], Math.max(Q.e[0], s.e.get()));
    svg.replaceChildren();
    const f = logFrame(svg, { box: [52, 14, 430, 270], x: Q.e, y: [-17, 1], xlabel: Q.form.split(" ")[0], ylabel: "relative error" });
    const g = clipped(svg, f);
    // ε, the unit roundoff, as the floor anything can hope for.
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(Math.log10(EPS / 2)), y2: f.sy(Math.log10(EPS / 2)), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4" }, g);
    text(svg, f.L + 4, f.sy(Math.log10(EPS / 2)) - 4, "ε/2, one rounding");
    const N = 360, naive = [], stable = [];
    for (let i = 0; i <= N; i++) {
      const t = Q.e[0] + ((Q.e[1] - Q.e[0]) * i) / N, x = 10 ** t, r = Q.ref(x);
      naive.push([f.sx(t), f.sy(Math.min(1, lg(rel(Q.naive(x), r))))]);
      stable.push([f.sx(t), f.sy(Math.min(1, lg(rel(Q.stable(x), r))))]);
    }
    path(g, naive, `stroke:${C.j};stroke-width:1.5`);
    path(g, stable, `stroke:${C.u};stroke-width:1.5`);
    endLabels(svg, f, [
      { y: naive.at(-1)[1], label: "naive", color: C.j },
      { y: stable.at(-1)[1], label: "rewritten", color: C.u },
    ]);
    // The probe.
    const x = 10 ** e, r = Q.ref(x), a = Q.naive(x), b = Q.stable(x), ea = rel(a, r), eb = rel(b, r);
    el("line", { x1: f.sx(e), x2: f.sx(e), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, g);
    for (const [v, c] of [[ea, C.j], [eb, C.u]]) el("circle", { cx: f.sx(e), cy: f.sy(Math.min(1, lg(v))), r: 3.5, style: `fill:var(--background);stroke:${c};stroke-width:2` }, svg);
    o.form.textContent = `${Q.labels[0]}  vs  ${Q.labels[1]}`;
    o.naive.textContent = `${a.toPrecision(10)}  (${ea === 0 ? "exact" : sci(ea, 1)})`;
    o.stable.textContent = `${b.toPrecision(10)}  (${eb === 0 ? "exact" : sci(eb, 1)})`;
    o.ref.textContent = r.toPrecision(16);
    const dig = (v) => (v === 0 ? 16 : Math.max(0, Math.min(16, -Math.log10(v))));
    o.digits.textContent = `${dig(ea).toFixed(1)} naive · ${dig(eb).toFixed(1)} rewritten`;
    o.note.textContent = Q.note;
  }
  draw();
}

// ============================================================ 2 Summation

/** Shewchuk's exact partials (the algorithm behind Python's math.fsum). */
function fsumAdd(p, x) {
  let i = 0;
  for (let y of p) {
    if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
    const hi = x + y, lo = y - (hi - x);
    if (lo !== 0) p[i++] = lo;
    x = hi;
  }
  p.length = i;
  p.push(x);
}
/** The correctly rounded value of the partials. */
function fsumValue(p) {
  let n = p.length;
  if (n === 0) return 0;
  let hi = p[--n], lo = 0;
  while (n > 0) {
    const x = hi, y = p[--n];
    hi = x + y;
    lo = y - (hi - x);
    if (lo !== 0) break;
  }
  if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) {
    const y = lo * 2, x = hi + y;
    if (y === x - hi) hi = x;
  }
  return hi;
}
function pairwise(a, lo, hi) {
  if (hi - lo <= 128) { let s = 0; for (let i = lo; i < hi; i++) s += a[i]; return s; }
  const mid = lo + ((hi - lo) >> 1);
  return pairwise(a, lo, mid) + pairwise(a, mid, hi);
}
const ulp = (x) => {
  if (x === 0) return 2 ** -1074;
  const e = Math.floor(Math.log2(Math.abs(x)));
  return 2 ** (Math.max(e, -1022) - 52);
};

const DATA = {
  tenth: () => 0.1,
  uniform: (k, r) => r(),
  harmonic: (k) => 1 / (k + 1),
  mixed: (k, r) => (r() < 0.5 ? -1 : 1) * 10 ** (16 * r() - 8),
};

for (const root of document.querySelectorAll("[data-numx-sum]")) {
  const svg = plot(root), o = outs(root);
  let kind = "tenth", seed = 7;
  const redraw = batched(() => draw());
  const s = scrubAll(root, redraw);
  onSeg(root, (_, v) => { kind = v; redraw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed = (seed * 48271) % 2147483647; redraw(); });

  function draw() {
    const p = s.p.get(), N = Math.round(10 ** p);
    const r = rng(seed), gen = DATA[kind];
    const a = new Float64Array(N);
    for (let k = 0; k < N; k++) a[k] = gen(k, r);
    const cps = [];
    for (let t = 1; t < p - 1e-9; t += 0.25) cps.push(Math.round(10 ** t));
    cps.push(N);
    const rows = [];
    let naive = 0, ks = 0, kc = 0, ci = 0;
    const parts = [];
    for (let k = 0; k < N; k++) {
      const x = a[k];
      naive += x;
      const y = x - kc, t = ks + y;
      kc = (t - ks) - y;
      ks = t;
      fsumAdd(parts, x);
      if (k + 1 === cps[ci]) {
        const exact = fsumValue(parts), pw = pairwise(a, 0, k + 1);
        rows.push({ n: k + 1, exact, naive, pw, kahan: ks });
        ci++;
      }
    }
    svg.replaceChildren();
    const f = logFrame(svg, { box: [52, 14, 430, 270], x: [1, 6.5], y: [-18, 0], xlabel: "n", ylabel: "relative error" });
    const g = clipped(svg, f);
    const rel = (v, ex) => Math.abs(v - ex) / Math.abs(ex);
    // Guides: one rounding, and n roundings (the textbook bound for a loop).
    const guide = (fn, label, at) => {
      polyline(g, [[f.sx(1), f.sy(fn(1))], [f.sx(6.5), f.sy(fn(6.5))]], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4");
      text(svg, f.sx(at), f.sy(fn(at)) + 13, label, { "text-anchor": "middle" });
    };
    guide(() => Math.log10(EPS / 2), "ε/2", 6.2);
    guide((t) => t + Math.log10(EPS / 2), "n·ε/2", 2.2);
    const series = [["naive", C.j, "naive"], ["pw", C.out, "pairwise"], ["kahan", C.u, "Kahan"]];
    const ends = [];
    for (const [key, color, label] of series) {
      const pts = rows.map((q) => [f.sx(Math.log10(q.n)), f.sy(lg(rel(q[key], q.exact), -17.5))]);
      path(g, pts, `stroke:${color};stroke-width:1.75`);
      for (const pt of pts) el("circle", { cx: pt[0], cy: pt[1], r: 2, style: `fill:${color}` }, g);
      ends.push({ y: pts.at(-1)[1], label, color });
    }
    endLabels(svg, f, ends);
    const last = rows.at(-1), u = ulp(last.exact);
    const show = (v) => {
      const err = Math.abs(v - last.exact);
      return err === 0 ? "0 (correctly rounded)" : `${sci(err, 2)}  ≈ ${minus(Math.round(err / u).toLocaleString("en-US"))} ulp`;
    };
    o.exact.textContent = last.exact.toPrecision(17);
    o.naive.textContent = show(last.naive);
    o.pair.textContent = show(last.pw);
    o.kahan.textContent = show(last.kahan);
    o.ulp.textContent = sci(u, 2);
  }
  draw();
}

// ============================================================ 3 Conditioning

const binomCache = new Map();
function binom(n, k) {
  if (k < 0 || k > n) return 0n;
  const key = `${n},${k}`;
  if (binomCache.has(key)) return binomCache.get(key);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  binomCache.set(key, r);
  return r;
}
/** κ∞ of the exact n×n Hilbert matrix, from its integer inverse. */
function hilbertKappa(n) {
  let normH = 0;
  for (let j = 1; j <= n; j++) normH += 1 / j;
  let best = 0n;
  for (let i = 1; i <= n; i++) {
    let row = 0n;
    for (let j = 1; j <= n; j++) {
      const c = binom(i + j - 2, i - 1);
      row += BigInt(i + j - 1) * binom(n + i - 1, n - j) * binom(n + j - 1, n - i) * c * c;
    }
    if (row > best) best = row;
  }
  return normH * Number(best);
}
/** Gaussian elimination with partial pivoting; returns x. */
function solveGEPP(A, b) {
  const n = b.length, M = A.map((r) => r.slice()), y = b.slice();
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    [y[k], y[p]] = [y[p], y[k]];
    for (let i = k + 1; i < n; i++) {
      const l = M[i][k] / M[k][k];
      for (let j = k; j < n; j++) M[i][j] -= l * M[k][j];
      y[i] -= l * y[k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let t = y[i];
    for (let j = i + 1; j < n; j++) t -= M[i][j] * x[j];
    x[i] = t / M[i][i];
  }
  return x;
}
function hilbertRun(n, delta) {
  const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1)));
  const r = rng(n * 101);
  const b = H.map((row) => row.reduce((s, v) => s + v, 0) * (1 + delta * (r() < 0.5 ? -1 : 1)));
  const x = solveGEPP(H, b);
  const ferr = Math.max(...x.map((v) => Math.abs(v - 1)));
  const res = Math.max(...H.map((row, i) => Math.abs(b[i] - row.reduce((s, v, j) => s + v * x[j], 0)))) / Math.max(...b.map(Math.abs));
  return { x, ferr, res, kappa: hilbertKappa(n) };
}

for (const root of document.querySelectorAll("[data-numx-cond]")) {
  const svg = plot(root), bars = plot(root, "bars"), o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const n = Math.round(s.n.get()), delta = 10 ** s.pert.get();
    const runs = [];
    for (let m = 2; m <= 14; m++) runs.push({ m, ...hilbertRun(m, delta) });
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 430, 250], x: [2, 14], y: [-18, 22], xticks: ticks(2, 14, 2), yticks: [-16, -12, -8, -4, 0, 4, 8, 12, 16, 20], yfmt: decade, xlabel: "matrix size n" });
    const g = clipped(svg, f);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, g);
    text(svg, f.L + 4, f.sy(0) + 13, "error 1: no correct digits");
    const line = (key, color, dash = "") => {
      const pts = runs.map((q) => [f.sx(q.m), f.sy(key(q))]);
      path(g, pts, `stroke:${color};stroke-width:1.75;${dash}`);
      for (const pt of pts) el("circle", { cx: pt[0], cy: pt[1], r: 2.2, style: `fill:${color}` }, g);
      return pts.at(-1)[1];
    };
    const ends = [
      { y: line((q) => Math.log10(q.kappa), C.v), label: "κ", color: C.v },
      { y: line((q) => Math.log10(q.kappa * Math.max(EPS, delta)), C.out, "stroke-dasharray:5 4"), label: "κ·ε", color: C.out },
      { y: line((q) => lg(q.ferr), C.j), label: "error", color: C.j },
      { y: line((q) => lg(q.res), C.u), label: "residual", color: C.u },
    ];
    endLabels(svg, f, ends);
    el("line", { x1: f.sx(n), x2: f.sx(n), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, g);

    // The computed solution, entry by entry.
    const cur = runs.find((q) => q.m === n);
    bars.replaceChildren();
    const dev = cur.x.map((v) => v - 1), span = Math.max(1e-300, ...dev.map(Math.abs));
    const L = 52, W = 430, mid = 60, half = 44, bw = Math.min(26, W / n - 4);
    el("line", { x1: L, x2: L + W, y1: mid, y2: mid, style: "stroke:currentColor;stroke-opacity:0.3" }, bars);
    text(bars, L - 6, mid + 3, "1", { "text-anchor": "end" });
    text(bars, L - 6, mid - half + 3, `+${sci(span, 0)}`, { "text-anchor": "end" });
    dev.forEach((d, i) => {
      const cx = L + ((i + 0.5) * W) / n, hgt = (Math.abs(d) / span) * half;
      el("rect", { x: cx - bw / 2, y: d >= 0 ? mid - hgt : mid, width: bw, height: Math.max(0.5, hgt), rx: 1.5, style: `fill:${C.j};fill-opacity:0.75` }, bars);
    });
    text(bars, L + W + 6, mid + 3, "x̂ᵢ − 1");

    o.kappa.textContent = sci(cur.kappa, 2);
    o.ferr.textContent = sci(cur.ferr, 2);
    o.res.textContent = sci(cur.res, 2);
    const digits = Math.max(0, -Math.log10(cur.ferr));
    o.digits.textContent = `${digits.toFixed(1)} (16 − log₁₀ κ ≈ ${Math.max(0, 16 - Math.log10(cur.kappa)).toFixed(1)})`;
    o.note.textContent = cur.res < 1e-14
      ? `The residual stays near ε: elimination solved a nearby system almost exactly (backward stability). The forward error is large because κ is large, not because the algorithm is bad.`
      : `With b nudged by ${sci(delta, 0)}, the answer moves by up to κ times that much: the error follows the κ·ε line, not ε.`;
  }
  draw();
}

// ============================================================ 4 Root finding

const ROOTS = {
  cubic: { f: (x) => x ** 3 - 2 * x - 5, d: (x) => 3 * x * x - 2, r: 2.0945514815423265, a: 1, b: 3, note: "Wallis's equation x³ − 2x − 5 = 0, the one Newton himself used. A simple root: every method reaches full precision, at its own order." },
  cos: { f: (x) => Math.cos(x) - x, d: (x) => -Math.sin(x) - 1, r: 0.7390851332151607, a: 0, b: 1.5, note: "The Dottie number. Regula falsi keeps one end fixed because f is concave on the bracket, so it only converges linearly; the Illinois fix halves the stale end's value and restores superlinear speed. Illinois alternates slow and fast steps, so with this few iterates its fitted order is noisy; its average order per step is about 1.44." },
  exp: { f: (x) => Math.exp(x) - 3, d: (x) => Math.exp(x), r: Math.log(3), a: 0, b: 2, note: "eˣ − 3, root ln 3. Convex everywhere, so regula falsi again drags one end; Newton from the right converges monotonically." },
  triple: {
    f: (x) => (((x - 1) * x - 3) * x + 5) * x - 2, d: (x) => ((4 * x - 3) * x - 6) * x + 5, r: 1, a: 0, b: 2.5,
    note: "(x − 1)³(x + 2), expanded and evaluated by Horner's rule. At a triple root Newton and the secant method drop to linear convergence, and rounding in f means nothing can get much closer than about ε^(1/3) ≈ 10⁻⁵: a multiple root is an ill-conditioned problem.",
  },
};
const METHODS = [
  { key: "bis", label: "bisection", color: C.j, bracket: true },
  { key: "rf", label: "regula falsi", color: C.v, bracket: true },
  { key: "ill", label: "Illinois", color: C.i, bracket: true },
  { key: "sec", label: "secant", color: C.out },
  { key: "newton", label: "Newton", color: C.u },
];

function runRoot(key, F, a, b) {
  const xs = [];
  let evals = 0;
  const f = (x) => { evals++; return F.f(x); };
  const MAX = 60;
  if (key === "newton") {
    let x = b;
    for (let k = 0; k < MAX; k++) {
      const fx0 = f(x), dx = F.d(x);
      evals++;
      if (fx0 === 0 || dx === 0) break;
      const nx = x - fx0 / dx;
      xs.push({ x: nx, evals });
      if (nx === x || !Number.isFinite(nx)) break;
      x = nx;
    }
  } else if (key === "sec") {
    let x0 = a, x1 = b, f0 = f(x0), f1 = f(x1);
    for (let k = 0; k < MAX; k++) {
      if (f1 === f0) break;
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      if (!Number.isFinite(x2)) break;
      x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
      xs.push({ x: x1, evals });
      if (x1 === x0 || f1 === 0) break;
    }
  } else {
    let fa = f(a), fb = f(b), side = 0, prev = NaN;
    if (fa * fb > 0) return { xs, evals, invalid: true };
    for (let k = 0; k < MAX; k++) {
      let m;
      if (key === "bis") m = a + (b - a) / 2;
      else m = (a * fb - b * fa) / (fb - fa);
      // Rounding can push the secant point onto or past an end: the
      // bracket cannot shrink any further in double precision.
      if (!(m > Math.min(a, b) && m < Math.max(a, b)) || m === prev) break;
      prev = m;
      const fm = f(m);
      xs.push({ x: m, evals });
      if (fm === 0) break;
      if (fa * fm < 0) {
        b = m; fb = fm;
        if (key === "ill" && side === -1) fa /= 2;
        side = -1;
      } else {
        a = m; fa = fm;
        if (key === "ill" && side === 1) fb /= 2;
        side = 1;
      }
    }
  }
  return { xs, evals };
}

for (const root of document.querySelectorAll("[data-numx-roots]")) {
  const svg = plot(root), osvg = plot(root, "order"), o = outs(root), body = root.querySelector("[data-rows]");
  let F = ROOTS.cubic;
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { F = ROOTS[v]; s.a.set(F.a, false); s.b.set(F.b, false); draw(); });

  function draw() {
    const a = s.a.get(), b = s.b.get();
    const runs = METHODS.map((m) => ({ ...m, ...runRoot(m.key, F, a, b) }));
    for (const r of runs) r.err = r.xs.map((p) => Math.abs(p.x - F.r));
    const best = Math.max(1e-16, Math.min(...runs.flatMap((r) => r.err).filter((e) => e > 0)));
    const floor = Math.max(1e-14, best * 30);

    svg.replaceChildren();
    const kmax = Math.min(60, Math.max(12, ...runs.map((r) => r.xs.length)));
    const f = logFrame(svg, { box: [52, 14, 430, 230], x: [0, kmax], y: [-17, 1], linx: true, xticks: ticks(0, kmax, kmax > 30 ? 10 : 5), xlabel: "iteration k", ylabel: "|xₖ − root|" });
    const g = clipped(svg, f);
    const ends = [];
    for (const r of runs) {
      if (r.invalid) continue;
      const pts = r.err.map((e, k) => [f.sx(k + 1), f.sy(lg(e, -17))]);
      path(g, pts, `stroke:${r.color};stroke-width:1.75`);
      for (const pt of pts) el("circle", { cx: pt[0], cy: pt[1], r: 2, style: `fill:${r.color}` }, g);
      if (pts.length) ends.push({ y: pts.at(-1)[1], label: r.label, color: r.color });
    }
    endLabels(svg, f, ends, 10);

    // The order plot: log e(k+1) against log e(k).
    osvg.replaceChildren();
    const of = frame(osvg, { box: [52, 20, 430, 120], x: [-16, 0], y: [-16, 0], xticks: [-16, -12, -8, -4, 0], yticks: [-16, -8, 0], xfmt: decade, yfmt: decade, xlabel: "|eₖ|", ylabel: "|eₖ₊₁|" });
    const og = clipped(osvg, of);
    for (const p of [1, 1.618, 2]) {
      polyline(og, [[of.sx(0), of.sy(0)], [of.sx(-16 / p), of.sy(-16)]], "stroke:currentColor;stroke-opacity:0.22;stroke-dasharray:3 4");
      text(osvg, of.sx(-15.2 / p) + 4, of.sy(-15.2) + 2, `p = ${p === 1.618 ? "φ" : p}`);
    }
    body.replaceChildren();
    for (const r of runs) {
      const X = [], Y = [];
      for (let k = 0; k + 1 < r.err.length; k++) {
        const e0 = r.err[k], e1 = r.err[k + 1];
        if (e0 < 0.5 && e0 > floor && e1 > floor) { X.push(Math.log10(e0)); Y.push(Math.log10(e1)); }
      }
      r.order = slope(X, Y);
      const pts = X.map((x, i) => [of.sx(x), of.sy(Y[i])]);
      path(og, pts, `stroke:${r.color};stroke-width:1.25;stroke-opacity:0.7`);
      for (const pt of pts) el("circle", { cx: pt[0], cy: pt[1], r: 2.2, style: `fill:${r.color}` }, og);
      const hit = r.err.findIndex((e) => e < 1e-10);
      const row = document.createElement("tr");
      row.className = "border-b last:border-0";
      body.append(row);
      const add = (v, right, color) => {
        const c = document.createElement("td");
        c.className = `px-2 py-1${right ? " text-right" : ""}`;
        if (color) c.style.color = color;
        c.textContent = v;
        row.append(c);
      };
      add(r.label, false, r.color);
      if (r.invalid) { add("no sign change", true); add("", true); add("", true); continue; }
      add(hit >= 0 ? String(hit + 1) : "—", true);
      add(hit >= 0 ? String(r.xs[hit].evals) : "—", true);
      add(Number.isFinite(r.order) ? r.order.toFixed(2) : "—", true);
    }
    const bad = runs.some((r) => r.invalid);
    o.note.textContent = (bad ? "f(a) and f(b) have the same sign, so the bracketing methods cannot start; widen the bracket. " : "") + F.note;
  }
  draw();
}

// ============================================================ 5 Interpolation

const INTERP = {
  runge: { f: (x) => 1 / (1 + 25 * x * x), y: [-0.6, 1.6] },
  abs: { f: Math.abs, y: [-0.4, 1.4] },
  sin: { f: (x) => Math.sin(3 * x), y: [-1.5, 1.5] },
  step: { f: (x) => Math.tanh(20 * x), y: [-1.7, 1.7] },
};
const INTERP_NOTES = {
  equi: "Equally spaced nodes: the Lebesgue constant grows like 2ⁿ/(e·n·ln n), so for 1/(1+25x²) the error explodes near ±1 as n grows (Runge, 1901). It is a property of the nodes, not of rounding.",
  cheb: "Chebyshev nodes cluster near the ends, where polynomials want to wiggle. Λ grows only like (2/π)·ln n, and for smooth functions the error falls geometrically: about one digit every few nodes.",
  spline: "A natural cubic spline joins cubics with matching first and second derivatives. Its error falls like h⁴ for smooth functions and it never oscillates wildly, at the cost of being only twice differentiable.",
};

function nodesOf(kind, n) {
  const x = [], w = [];
  for (let j = 0; j <= n; j++) {
    if (kind === "cheb") {
      const th = ((2 * j + 1) * Math.PI) / (2 * n + 2);
      x.push(Math.cos(th));
      w.push((j % 2 ? -1 : 1) * Math.sin(th));
    } else {
      x.push(-1 + (2 * j) / n);
      let c = 1;
      for (let i = 1; i <= j; i++) c = (c * (n - j + i)) / i;
      w.push((j % 2 ? -1 : 1) * c);
    }
  }
  return { x, w };
}
function bary(nd, ys, t) {
  let num = 0, den = 0;
  for (let j = 0; j < nd.x.length; j++) {
    const d = t - nd.x[j];
    if (d === 0) return ys[j];
    const q = nd.w[j] / d;
    num += q * ys[j];
    den += q;
  }
  return num / den;
}
/** Second derivatives of the natural cubic spline through equispaced (x, y). */
function splineM(ys, hstep) {
  const n = ys.length - 1, M = new Float64Array(n + 1);
  if (n < 2) return M;
  const c = new Float64Array(n), d = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const rhs = (6 * (ys[i + 1] - 2 * ys[i] + ys[i - 1])) / (hstep * hstep);
    const m = 4 - (i > 1 ? c[i - 1] : 0);
    c[i] = 1 / m;
    d[i] = (rhs - (i > 1 ? d[i - 1] : 0)) / m;
  }
  for (let i = n - 1; i >= 1; i--) M[i] = d[i] - c[i] * (i < n - 1 ? M[i + 1] : 0);
  return M;
}
function splineEval(xs, ys, M, t) {
  const n = xs.length - 1, hstep = xs[1] - xs[0];
  const i = Math.min(n - 1, Math.max(0, Math.floor((t - xs[0]) / hstep)));
  const a = (xs[i + 1] - t) / hstep, b = (t - xs[i]) / hstep;
  return a * ys[i] + b * ys[i + 1] + ((a ** 3 - a) * M[i] + (b ** 3 - b) * M[i + 1]) * (hstep * hstep) / 6;
}
const SAMPLES = Array.from({ length: 1201 }, (_, i) => -1 + (2 * i) / 1200);

function interpolant(kind, fn, n) {
  if (kind === "spline") {
    const nd = nodesOf("equi", n), ys = nd.x.map(fn), M = splineM(ys, 2 / n);
    return { nodes: nd.x, ys, at: (t) => splineEval(nd.x, ys, M, t) };
  }
  const nd = nodesOf(kind, n), ys = nd.x.map(fn);
  return { nodes: nd.x, ys, at: (t) => bary(nd, ys, t), nd };
}
function maxErr(I, fn) {
  let m = 0;
  for (const t of SAMPLES) m = Math.max(m, Math.abs(I.at(t) - fn(t)));
  return m;
}
function lebesgue(kind, n) {
  if (kind === "spline") {
    const xs = nodesOf("equi", n).x, cards = [];
    for (let j = 0; j <= n; j++) {
      const e = xs.map((_, i) => (i === j ? 1 : 0));
      cards.push({ e, M: splineM(e, 2 / n) });
    }
    let best = 0;
    for (const t of SAMPLES) best = Math.max(best, cards.reduce((s, c) => s + Math.abs(splineEval(xs, c.e, c.M, t)), 0));
    return best;
  }
  const nd = nodesOf(kind, n);
  let best = 0;
  for (const t of SAMPLES) {
    let den = 0, num = 0, hit = false;
    for (let j = 0; j <= n; j++) {
      const d = t - nd.x[j];
      if (d === 0) { hit = true; break; }
      const q = nd.w[j] / d;
      den += q; num += Math.abs(q);
    }
    best = Math.max(best, hit ? 1 : num / Math.abs(den));
  }
  return best;
}

for (const root of document.querySelectorAll("[data-numx-interp]")) {
  const svg = plot(root), esvg = plot(root, "err"), o = outs(root);
  let fnKey = "runge", kind = "equi", errCache = null;
  const KIND_COLOR = { equi: C.j, cheb: C.u, spline: C.i };
  const s = scrubAll(root, () => draw());
  onSeg(root, (group, v) => { if (group === "Nodes") kind = v; else { fnKey = v; errCache = null; } draw(); });

  function errorCurves(fn) {
    const out = {};
    for (const k of ["equi", "cheb", "spline"]) out[k] = Array.from({ length: 39 }, (_, i) => maxErr(interpolant(k, fn, i + 2), fn));
    return out;
  }

  function draw() {
    const n = Math.round(s.n.get()), F = INTERP[fnKey], I = interpolant(kind, F.f, n), color = KIND_COLOR[kind];
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 12, 470, 260], x: [-1, 1], y: F.y, xticks: [-1, -0.5, 0, 0.5, 1], yticks: ticks(F.y[0], F.y[1], 0.5), xfmt: minus, yfmt: minus });
    const g = clipped(svg, f);
    path(g, SAMPLES.map((t) => [f.sx(t), f.sy(F.f(t))]), "stroke:var(--foreground);stroke-width:2;stroke-opacity:0.85");
    path(g, SAMPLES.map((t) => [f.sx(t), f.sy(Math.max(-1e4, Math.min(1e4, I.at(t))))]), `stroke:${color};stroke-width:1.75`);
    I.nodes.forEach((x, j) => el("circle", { cx: f.sx(x), cy: f.sy(I.ys[j]), r: 3, style: `fill:var(--background);stroke:${color};stroke-width:1.75` }, g));

    errCache ??= errorCurves(F.f);
    esvg.replaceChildren();
    const ef = logFrame(esvg, { box: [52, 10, 430, 122], x: [2, 40], y: [-16, 4], linx: true, xticks: [2, 10, 20, 30, 40], xlabel: "n", ylabel: "max |error|" });
    const eg = clipped(esvg, ef);
    const ends = [];
    for (const [k, label] of [["equi", "equispaced"], ["cheb", "Chebyshev"], ["spline", "spline"]]) {
      const pts = errCache[k].map((e, i) => [ef.sx(i + 2), ef.sy(lg(e, -16))]);
      path(eg, pts, `stroke:${KIND_COLOR[k]};stroke-width:${k === kind ? 2 : 1.25};stroke-opacity:${k === kind ? 1 : 0.6}`);
      ends.push({ y: pts.at(-1)[1], label, color: KIND_COLOR[k] });
    }
    endLabels(esvg, ef, ends);
    const cur = errCache[kind][n - 2];
    el("circle", { cx: ef.sx(n), cy: ef.sy(lg(cur, -16)), r: 3.5, style: `fill:var(--background);stroke:var(--brand);stroke-width:2` }, esvg);
    o.err.textContent = sci(cur, 2);
    o.leb.textContent = fx(lebesgue(kind, n), 2);
    o.nodes.textContent = String(n + 1);
    o.note.textContent = INTERP_NOTES[kind];
  }
  draw();
}
