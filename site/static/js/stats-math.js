// Numerical statistics for the statistics blocks: log-gamma, regularized
// incomplete gamma and beta functions (Numerical Recipes' series and
// continued fractions, accurate to ~1e-12), and the distributions built on
// them. No approximation coarser than double precision allows.

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw (Box–Muller). */
export const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Lanczos approximation (g = 7, n = 9): |error| < 1e-15 for x > 0.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularized lower incomplete gamma P(a, x). */
export function gammaP(a, x) {
  if (x <= 0) return 0;
  const gln = lgamma(a);
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 500; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  // Continued fraction for Q(a, x) (modified Lentz).
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, hh = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * hh;
}

function betacf(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let hh = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; hh *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return hh;
}

/** Regularized incomplete beta I_x(a, b). */
export function betaI(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// ---------------------------------------------------------------- distributions

export const normPdf = (x, mu = 0, s = 1) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
export function normCdf(x, mu = 0, s = 1) {
  const z = (x - mu) / s;
  const p = 0.5 * gammaP(0.5, (z * z) / 2); // erf(|z|/√2)/2
  return z >= 0 ? 0.5 + p : 0.5 - p;
}

export const tPdf = (t, v) => Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2) - 0.5 * Math.log(v * Math.PI) - ((v + 1) / 2) * Math.log(1 + (t * t) / v));
export function tCdf(t, v) {
  const tail = 0.5 * betaI(v / 2, 0.5, v / (v + t * t));
  return t >= 0 ? 1 - tail : tail;
}

/** The p-quantile of Student's t with v degrees of freedom (bisection). */
export function tQuantile(p, v) {
  if (p === 0.5) return 0;
  let lo = -1e4, hi = 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    tCdf(mid, v) < p ? (lo = mid) : (hi = mid);
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

export const chisqPdf = (x, k) => (x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2)));
export const chisqCdf = (x, k) => gammaP(k / 2, Math.max(0, x) / 2);

export const binomPmf = (k, n, p) =>
  k < 0 || k > n ? 0 : Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p));
export const poisPmf = (k, l) => (k < 0 ? 0 : Math.exp(k * Math.log(l) - l - lgamma(k + 1)));

/**
 * Upper tail of the noncentral t: P(T' > c) with T' = (Z + δ) / √(V/ν),
 * V ~ χ²(ν). Integrates P(Z > c√(v/ν) − δ) against the χ² density with
 * Simpson's rule.
 */
export function nctUpper(c, v, delta) {
  const top = v + 14 * Math.sqrt(2 * v) + 40;
  const N = 1200;
  const h = top / N;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const x = i * h;
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    s += w * chisqPdf(x, v) * (1 - normCdf(c * Math.sqrt(x / v) - delta));
  }
  // The χ² density diverges at 0 for ν = 1; ν ≥ 2 here (two groups, n ≥ 2).
  return (s * h) / 3;
}

/** The noncentral t density, by the same integral. */
export function nctPdf(t, v, delta) {
  const top = v + 14 * Math.sqrt(2 * v) + 40;
  const N = 300;
  const h = top / N;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const x = i * h;
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    const k = Math.sqrt(x / v);
    s += w * chisqPdf(x, v) * normPdf(t * k - delta) * k;
  }
  return (s * h) / 3;
}

// ---------------------------------------------------------------- descriptive helpers

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function sd(a, sample = true) {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - (sample ? 1 : 0)));
}
/** Quantile by linear interpolation (type 7) of a sorted array. */
export function quantile(sorted, p) {
  const hh = (sorted.length - 1) * p;
  const lo = Math.floor(hh);
  return lo + 1 < sorted.length ? sorted[lo] + (hh - lo) * (sorted[lo + 1] - sorted[lo]) : sorted[lo];
}
export const median = (a) => quantile([...a].sort((x, y) => x - y), 0.5);

/** Ranks with ties averaged, for Spearman's ρ. */
export function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
export function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
/** Ordinary least squares: [intercept, slope]. */
export function ols(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b = sxy / sxx;
  return [my - b * mx, b];
}
