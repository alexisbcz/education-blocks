// Shared helpers for the numerical methods blocks (numerics.js and
// numerics-ode.js). This module only exports; it draws nothing itself.

import { el, text, frame, polyline } from "./plot.js";

export { el, text, frame, polyline };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const plot = (root, name = "main") => root.querySelector(`[data-plot="${name}"]`);
export const minus = (s) => String(s).replace(/-/g, "−");

/** A number with d decimals, or — when it is not finite. */
export const fx = (v, d = 4) => (Number.isFinite(v) ? minus(Number(v.toFixed(d))) : "—");
/** A number in scientific notation with a real minus and a times sign. */
export const sci = (v, d = 2) => {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const [m, e] = v.toExponential(d).split("e");
  return `${minus(m)}×10${sup(Number(e))}`;
};
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");
/** 10^k as a tick label. */
export const decade = (k) => (k === 0 ? "1" : k === 1 ? "10" : `10${sup(k)}`);

// onSeg calls fn(groupLabel, value) when a segmented control changes.
export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));

/** Selects a segment programmatically (the visual state only). */
export function selectSeg(root, label, value) {
  const group = root.querySelector(`[role=tablist][aria-label="${label}"]`);
  group?.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));
}

/** Method colours, the same in every block. */
export const C = {
  j: "var(--vec-j)", out: "var(--vec-out)", u: "var(--vec-u)", v: "var(--vec-v)", i: "var(--vec-i)",
  brand: "var(--brand)", fg: "var(--foreground)",
};

// A clip path to the plot box, so lines stop at the frame.
let clipN = 0;
export function clipped(svg, f) {
  const id = `numx-clip-${++clipN}`;
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, el("defs", {}, svg)));
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

const range = (a, b, step = 1) => {
  const out = [];
  for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
};
export { range as ticks };

/**
 * logFrame is a frame whose axes are log10 values. x and y are exponent
 * ranges; ticks fall on whole decades (thinned to at most ~8).
 * Pass linx: true for a linear x axis instead.
 */
export function logFrame(svg, { box, x, y, xlabel, ylabel, linx = false, xticks, xfmt }) {
  // Leave room above the plot for the y-axis label.
  if (ylabel && box[1] < 20) box = [box[0], 20, box[2], box[3] - (20 - box[1])];
  const thin = (lo, hi) => {
    const span = hi - lo;
    const step = span > 24 ? 6 : span > 14 ? 4 : span > 8 ? 2 : 1;
    return range(lo, hi, step);
  };
  return frame(svg, {
    box, x, y,
    xticks: xticks ?? (linx ? undefined : thin(x[0], x[1])),
    yticks: thin(y[0], y[1]),
    xfmt: xfmt ?? (linx ? String : decade),
    yfmt: decade,
    xlabel, ylabel,
  });
}

/** log10 of |v|, floored so exact zeros still plot. */
export const lg = (v, floor = -17) => Math.max(floor, Math.log10(Math.abs(v) || 10 ** floor));

/** A polyline that breaks at non-finite points. */
export function path(g, pts, style) {
  let run = [];
  const flush = () => { if (run.length > 1) polyline(g, run, style); run = []; };
  for (const p of pts) (Number.isFinite(p[0]) && Number.isFinite(p[1]) ? run.push(p) : flush());
  flush();
}

/** Labels at the right end of curves, pushed apart so they never overlap. */
export function endLabels(svg, f, items, gap = 11) {
  const list = items.filter((it) => Number.isFinite(it.y)).map((it) => ({ ...it, y: Math.max(f.T + 6, Math.min(f.T + f.H, it.y + 3)) }));
  list.sort((a, b) => a.y - b.y);
  for (let i = 1; i < list.length; i++) list[i].y = Math.max(list[i].y, list[i - 1].y + gap);
  // If the stack runs past the bottom of the plot, lift it back up.
  const over = list.length ? list.at(-1).y - (f.T + f.H + 3) : 0;
  if (over > 0) {
    for (const it of list) it.y -= over;
    for (let i = list.length - 2; i >= 0; i--) list[i].y = Math.min(list[i].y, list[i + 1].y - gap);
  }
  for (const it of list) text(svg, f.L + f.W + 6, it.y, it.label, { style: `fill:${it.color}` });
}

/** Least-squares slope of y on x. */
export function slope(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxx === 0 ? NaN : sxy / sxx;
}

/** A small seeded generator (mulberry32), so every run is reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playButton(btn) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
  };
}

/** Runs fn once the root scrolls into view (the first time only). */
export function whenVisible(root, fn) {
  if (!("IntersectionObserver" in window)) return fn();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: "200px" });
  io.observe(root);
}

/** Coalesces bursts of calls (scrubbing) into one per animation frame. */
export function batched(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
}

/** Gauss–Legendre nodes and weights on [−1, 1] by Newton's method. */
export function gaussLegendre(n) {
  const x = new Float64Array(n), w = new Float64Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) [p0, p1] = [p1, ((2 * k - 1) * z * p1 - (k - 1) * p0) / k];
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    x[i] = -z; x[n - 1 - i] = z;
    w[i] = w[n - 1 - i] = 2 / ((1 - z * z) * dp * dp);
  }
  return { x, w };
}
