// Shared numerics and drawing for the Bayesian inference blocks: Beta
// densities and quantiles from the log-gamma and incomplete beta functions,
// highest-density intervals, Gamma/Beta sampling (Marsaglia–Tsang), the
// exact P(B > A) for Beta variables, effective sample size (Geyer's initial
// positive sequence) and marching-squares contours. Imported, never run on
// its own.

import { lgamma, betaI, mulberry32, gauss, normCdf, normPdf } from "./stats-math.js";
import { el, text, frame, polyline, num } from "./plot.js";

export { lgamma, betaI, mulberry32, gauss, normCdf, normPdf, el, text, frame, polyline, num };

// Fixed colours: prior, likelihood, posterior.
export const C = { prior: "var(--vec-u)", like: "var(--vec-out)", post: "var(--vec-v)" };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
export const onAction = (root, fn) =>
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b && root.contains(b)) fn(b.dataset.action, b);
  });
export const neg = (s) => String(s).replace(/-/g, "−");
export const pct = (v, d = 1) => num(100 * v, d) + "%";
export const pfmt = (p) => (p < 0.0001 ? "< 0.0001" : num(p, 4));

/** A play/pause button's look. */
export function setPlaying(btn, on, labels = ["Run", "Pause"]) {
  if (!btn) return;
  btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", on);
  btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !on);
  const l = btn.querySelector("[data-label]");
  if (l) l.textContent = on ? labels[1] : labels[0];
}

/** Calls fn(visible) when the element enters or leaves the viewport. */
export function whenVisible(node, fn) {
  new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting)), { rootMargin: "100px" }).observe(node);
}

export const niceTicks = (a, b, n = 6) => {
  const raw = (b - a) / n;
  if (!(raw > 0)) return [a];
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
};
export const tickFmt = (v) => neg(Math.abs(v) < 1e-9 ? "0" : String(+v.toPrecision(4)));

/** SVG viewBox coordinates of a pointer event. */
export function svgPoint(svg, e) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
}

// ---------------------------------------------------------------- Beta

export const lbeta = (a, b) => lgamma(a) + lgamma(b) - lgamma(a + b);

export function logBetaPdf(x, a, b) {
  if (x <= 0 || x >= 1) {
    if (x === 0) return a < 1 ? Infinity : a === 1 ? -lbeta(a, b) : -Infinity;
    if (x === 1) return b < 1 ? Infinity : b === 1 ? -lbeta(a, b) : -Infinity;
    return -Infinity;
  }
  return (a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - lbeta(a, b);
}
export const betaPdf = (x, a, b) => Math.exp(logBetaPdf(x, a, b));

/** The p-quantile of Beta(a, b), by bisection on the regularized incomplete beta. */
export function betaQuantile(p, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaI(a, b, mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The highest-density interval of mass m for Beta(a, b), or null when the
 *  density is U-shaped (two pieces) or flat (no unique interval). */
export function betaHPD(a, b, m = 0.95) {
  if (a <= 1 && b <= 1) return null;
  if (a <= 1) return [0, betaQuantile(m, a, b)];
  if (b <= 1) return [betaQuantile(1 - m, a, b), 1];
  // Unimodal: minimise the width over the lower tail mass t in [0, 1 − m].
  const width = (t) => betaQuantile(t + m, a, b) - betaQuantile(t, a, b);
  let lo = 0, hi = 1 - m;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = width(x1), f2 = width(x2);
  for (let i = 0; i < 40; i++) {
    if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = width(x1); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = width(x2); }
  }
  const t = (lo + hi) / 2;
  return [betaQuantile(t, a, b), betaQuantile(t + m, a, b)];
}

/** A Gamma(shape, 1) draw (Marsaglia & Tsang 2000). */
export function gammaDraw(k, rng) {
  if (k < 1) return gammaDraw(k + 1, rng) * Math.pow(rng(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = gauss(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export function betaDraw(a, b, rng) {
  const x = gammaDraw(a, rng), y = gammaDraw(b, rng);
  return x / (x + y);
}

/** P(X_B > X_A) for X_A ~ Beta(aA, bA), X_B ~ Beta(aB, bB), aB a positive
 *  integer: the closed-form sum (Evan Miller, 2015). */
export function probBBeatsA(aA, bA, aB, bB) {
  let total = 0;
  const c = lbeta(aA, bA);
  for (let i = 0; i < aB; i++) total += Math.exp(lbeta(aA + i, bA + bB) - Math.log(bB + i) - lbeta(1 + i, bB) - c);
  return Math.min(1, Math.max(0, total));
}

// ---------------------------------------------------------------- MCMC diagnostics

/** Autocorrelations of x up to maxLag. */
export function acf(x, maxLag) {
  const n = x.length;
  let m = 0;
  for (const v of x) m += v;
  m /= n;
  let c0 = 0;
  for (const v of x) c0 += (v - m) ** 2;
  const out = [1];
  if (c0 === 0) return out.concat(Array(maxLag).fill(0));
  for (let k = 1; k <= maxLag && k < n; k++) {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += (x[i] - m) * (x[i + k] - m);
    out.push(s / c0);
  }
  return out;
}

/** Effective sample size by Geyer's initial positive sequence. */
export function ess(x) {
  const n = x.length;
  if (n < 10) return NaN;
  const rho = acf(x, Math.min(n - 1, 1000));
  let tau = -1;
  for (let k = 0; k + 1 < rho.length; k += 2) {
    const g = rho[k] + rho[k + 1];
    if (g <= 0) break;
    tau += 2 * g;
  }
  return n / Math.max(tau, 1e-9);
}

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

// ---------------------------------------------------------------- drawing

/** A filled area under fn between x0 and x1, clipped to the frame's top. */
export function area(svg, f, fn, x0, x1, style, steps = 200) {
  if (!(x1 > x0)) return;
  const top = f.ymax ?? Infinity;
  const pts = [[f.sx(x0), f.sy(0)]];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = fn(x);
    pts.push([f.sx(x), f.sy(Math.min(top, Number.isFinite(y) ? y : top))]);
  }
  pts.push([f.sx(x1), f.sy(0)]);
  return el("path", { d: "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L") + " Z", style }, svg);
}

export function curve(svg, f, fn, x0, x1, style, steps = 300) {
  const top = f.ymax ?? Infinity;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = fn(x);
    if (Number.isFinite(y)) pts.push([f.sx(x), f.sy(Math.min(top, y))]);
    else if (y === Infinity) pts.push([f.sx(x), f.sy(top)]);
  }
  return polyline(svg, pts, style);
}

/** Many dots as one path: round caps on zero-length segments. */
export function dots(svg, pts, style) {
  let d = "";
  for (const [x, y] of pts) d += `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
  return el("path", { d, style: "fill:none;stroke-linecap:round;" + style }, svg);
}

/** Marching-squares contour lines of fn at each level, as one path per level. */
export function contours(svg, fn, box, xr, yr, levels, style, n = 70) {
  const [L, T, W, H] = box;
  const g = [];
  for (let j = 0; j <= n; j++) {
    const row = [];
    for (let i = 0; i <= n; i++) row.push(fn(xr[0] + ((xr[1] - xr[0]) * i) / n, yr[1] - ((yr[1] - yr[0]) * j) / n));
    g.push(row);
  }
  const px = (i) => L + (W * i) / n, py = (j) => T + (H * j) / n;
  for (const lv of levels) {
    let d = "";
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]];
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const cross = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e], b = v[(e + 1) % 4];
        if ((a >= lv) !== (b >= lv)) {
          const t = (lv - a) / (b - a);
          const [i0, j0] = c[e], [i1, j1] = c[(e + 1) % 4];
          cross.push([px(i0 + t * (i1 - i0)), py(j0 + t * (j1 - j0))]);
        }
      }
      for (let k = 0; k + 1 < cross.length; k += 2)
        d += `M${cross[k][0].toFixed(1)} ${cross[k][1].toFixed(1)}L${cross[k + 1][0].toFixed(1)} ${cross[k + 1][1].toFixed(1)}`;
    }
    el("path", { d, style: "fill:none;" + style }, svg);
  }
}
