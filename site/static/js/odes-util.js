// Shared helpers for the differential equations blocks (odes.js and
// odes-more.js). This module only exports; it draws nothing itself.

import { el, text, frame as baseFrame, polyline } from "./plot.js";

export { el, text, polyline };

/** plot.js's frame, with the y-axis label placed over its own frame's
 *  axis (plot.js puts it at x = 4, which collides when two frames share
 *  one SVG). */
export function frame(svg, opts) {
  const { ylabel, ...rest } = opts;
  const f = baseFrame(svg, rest);
  if (ylabel) text(f.g, Math.max(4, f.L - 32), f.T - 6, ylabel, { "text-anchor": "start" });
  return f;
}

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const plot = (root, name = "main") => root.querySelector(`[data-plot="${name}"]`);
export const minus = (s) => String(s).replace(/-/g, "−");
/** A number with d decimals and a real minus sign; — when not finite. */
export const fx = (v, d = 3) => (Number.isFinite(v) ? minus(Number(v.toFixed(d)).toString()) : "—");
/** A signed term for a formula: " + 2.5" or " − 2.5". */
export const sgn = (v, d = 3) => (v < 0 ? ` − ${fx(-v, d)}` : ` + ${fx(v, d)}`);

export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
export function selectSeg(root, label, value) {
  root.querySelector(`[role=tablist][aria-label="${label}"]`)
    ?.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));
}

/** The shadcn switch fires before aria-checked updates, so read the event. */
export const onToggle = (root, fn) => root.querySelectorAll("[data-toggle]").forEach((sw) =>
  sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));

/** Colours, the same meaning in every block. */
export const C = {
  i: "var(--vec-i)", j: "var(--vec-j)", u: "var(--vec-u)", v: "var(--vec-v)", out: "var(--vec-out)",
  brand: "var(--brand)", fg: "var(--foreground)", del: "var(--code-del)",
};

let clipN = 0;
/** A group clipped to a frame's plot box. */
export function clipped(svg, f) {
  const id = `ode-clip-${++clipN}`;
  const defs = el("defs", {}, svg);
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, defs));
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

/** Evenly spaced tick values. */
export function ticks(a, b, step) {
  const out = [];
  for (let t = Math.ceil(a / step - 1e-9) * step; t <= b + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

/** A polyline that breaks at non-finite or far-off points. */
export function path(g, pts, style, limit = 1e5) {
  let run = [];
  const flush = () => { if (run.length > 1) polyline(g, run, style); run = []; };
  for (const p of pts) (Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1]) < limit ? run.push(p) : flush());
  flush();
}

/** One classical RK4 step for a system y′ = f(t, y), y an array. */
export function rk4(f, t, y, h) {
  const n = y.length, k1 = f(t, y), a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = y[i] + (h / 2) * k1[i];
  const k2 = f(t + h / 2, a);
  for (let i = 0; i < n; i++) a[i] = y[i] + (h / 2) * k2[i];
  const k3 = f(t + h / 2, a);
  for (let i = 0; i < n; i++) a[i] = y[i] + h * k3[i];
  const k4 = f(t + h, a);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

/** Integrates with RK4 and returns [t, y] samples (y stops if it leaves |y| < cap). */
export function solve(f, t0, y0, t1, steps, cap = 1e6) {
  const h = (t1 - t0) / steps, out = [[t0, y0]];
  let y = y0;
  for (let k = 1; k <= steps; k++) {
    y = rk4(f, t0 + (k - 1) * h, y, h);
    if (!y.every((v) => Number.isFinite(v) && Math.abs(v) < cap)) break;
    out.push([t0 + k * h, y]);
  }
  return out;
}

/** The pointer position in an SVG's viewBox coordinates. */
export function svgPoint(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

/** Swaps the play/pause icon and label of a play button. */
export function playButton(btn) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    const l = btn.querySelector("[data-label]");
    if (l) l.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-pressed", String(playing));
  };
}

/**
 * animator runs step(dt) every frame while playing and the root is on
 * screen; it stops itself when step returns false.
 */
export function animator(root, btn, step) {
  const show = playButton(btn);
  let playing = false, visible = true, last = 0, raf = 0;
  const loop = (now) => {
    raf = 0;
    if (!playing || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (step(dt) === false) { set(false); return; }
    raf = requestAnimationFrame(loop);
  };
  const kick = () => { if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  function set(on) { playing = on; show(on); kick(); }
  btn.addEventListener("click", () => set(!playing));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); kick(); }).observe(root);
  }
  document.addEventListener("visibilitychange", kick);
  return { set, get playing() { return playing; } };
}

/** Coalesces bursts of calls into one per animation frame. */
export function batched(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
}

/** A small arrowhead at the end of a segment from (x0, y0) to (x1, y1). */
export function arrow(g, x0, y0, x1, y1, style, size = 4) {
  el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style }, g);
  const a = Math.atan2(y1 - y0, x1 - x0);
  const p = (s) => `${x1 + size * Math.cos(a + s)},${y1 + size * Math.sin(a + s)}`;
  el("polygon", { points: `${x1},${y1} ${p(Math.PI * 0.85)} ${p(-Math.PI * 0.85)}`, style: style.replace(/stroke:([^;]+)/, "fill:$1") }, g);
}

/** Classifies the linear system with trace tr and determinant det. */
export function classify(tr, det, eps = 1e-9) {
  const disc = tr * tr - 4 * det;
  if (Math.abs(det) < eps) return { type: "non-isolated equilibria (Δ = 0)", key: "line" };
  if (det < 0) return { type: "saddle (unstable)", key: "saddle" };
  if (Math.abs(tr) < eps) return { type: "centre (neutral)", key: "centre" };
  const st = tr < 0 ? "stable" : "unstable";
  if (Math.abs(disc) < eps) return { type: `degenerate node (${st})`, key: "degenerate" };
  if (disc > 0) return { type: `node (${st})`, key: "node" };
  return { type: `spiral (${st})`, key: "spiral" };
}

/** Eigenvalues of a 2×2 matrix as {re, im} pairs. */
export function eig2(a, b, c, d) {
  const tr = a + d, det = a * d - b * c, disc = tr * tr - 4 * det;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    return [{ re: (tr + s) / 2, im: 0 }, { re: (tr - s) / 2, im: 0 }];
  }
  const s = Math.sqrt(-disc);
  return [{ re: tr / 2, im: s / 2 }, { re: tr / 2, im: -s / 2 }];
}

export const fmtEig = (e) => (e.im === 0 ? fx(e.re, 3) : `${fx(e.re, 3)} ${e.im < 0 ? "−" : "+"} ${fx(Math.abs(e.im), 3)}i`);
