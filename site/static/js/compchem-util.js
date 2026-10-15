// Shared helpers for the computational chemistry blocks. This module only
// exports; it draws nothing by itself.

import { el, text, frame, polyline } from "./plot.js";

export { el, text, frame, polyline };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const plot = (root, name = "main") => root.querySelector(`[data-plot="${name}"]`);
export const minus = (s) => String(s).replace(/-/g, "−");
/** A number with d decimals and a real minus sign, or — when not finite. */
export const fx = (v, d = 3) => (Number.isFinite(v) ? minus(v.toFixed(d)) : "—");

/** Series colours, the same in every block. */
export const C = {
  i: "var(--vec-i)", j: "var(--vec-j)", u: "var(--vec-u)", v: "var(--vec-v)", out: "var(--vec-out)",
  brand: "var(--brand)", fg: "var(--foreground)", del: "var(--code-del)",
};

// onSeg calls fn(groupLabel, value) when a segmented control changes.
export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));

// onToggle calls fn(name, checked). The switch announces its new state in
// the event before it updates aria-checked, so the event is the source.
export const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
export const toggled = (root, name) => root.querySelector(`[data-toggle="${name}"]`)?.getAttribute("aria-checked") === "true";

export function playButton(btn) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !playing);
    const l = btn.querySelector("[data-label]");
    if (l) l.textContent = playing ? "Pause" : "Run";
  };
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

/** Tracks whether root is on screen; simulations pause when it is not. */
export function onScreen(root, fn) {
  if (!("IntersectionObserver" in window)) return fn(true);
  new IntersectionObserver((es) => fn(es.some((e) => e.isIntersecting)), { rootMargin: "100px" }).observe(root);
}

/** A small seeded generator (mulberry32), so runs are reproducible. */
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

/** A standard normal draw from a uniform generator (Box–Muller). */
export const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// A clip path to a box, so lines stop at the frame.
let clipN = 0;
export function clipped(svg, f) {
  const id = `cc-clip-${++clipN}`;
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, el("defs", {}, svg)));
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

/** Evenly spaced tick values covering [a, b]. */
export function ticks(a, b, n = 5) {
  const raw = (b - a) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let t = Math.ceil(a / step - 1e-9) * step; t <= b + 1e-9; t += step) out.push(Math.round(t / step) * step);
  return out;
}
export const tickFmt = (v) => minus(Number(v.toPrecision(6)).toString());

/** A polyline that breaks at non-finite points. */
export function path(g, pts, style) {
  let run = [];
  const flush = () => { if (run.length > 1) polyline(g, run, style); run = []; };
  for (const p of pts) (Number.isFinite(p[0]) && Number.isFinite(p[1]) ? run.push(p) : flush());
  flush();
}

// ------------------------------------------------------------ linear algebra

/**
 * Jacobi eigenvalue algorithm for a symmetric matrix (array of rows).
 * Returns eigenvalues ascending and eigenvectors as columns vecs[k][i].
 */
export function jacobi(A0) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-26) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = A.map((r, i) => [r[i], i]).sort((a, b) => a[0] - b[0]);
  return { values: order.map((o) => o[0]), vectors: order.map(([, i]) => V.map((r) => r[i])) };
}

/** Generalized symmetric eigenproblem H c = E S c by Cholesky reduction. */
export function geneig(H, S) {
  const n = H.length, L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = S[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (s <= 0) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
  }
  // Linv by forward substitution, then A = Linv H Linvᵀ.
  const Li = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i][k] * Li[k][j];
      Li[i][j] = s / L[i][i];
    }
  }
  const T = Li.map((r) => H[0].map((_, j) => r.reduce((a, v, k) => a + v * H[k][j], 0)));
  const A = T.map((r) => Li.map((lj) => r.reduce((a, v, k) => a + v * lj[k], 0)));
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i] = (A[i][j] + A[j][i]) / 2;
  const { values, vectors } = jacobi(A);
  // Back-transform c = Linvᵀ y.
  const vecs = vectors.map((y) => Array.from({ length: n }, (_, i) => y.reduce((a, v, k) => a + Li[k][i] * v, 0)));
  return { values, vectors: vecs };
}

/** Nelder–Mead minimisation of f from x0 with initial step. */
export function nelderMead(f, x0, step = 0.5, iters = 4000, tol = 1e-13) {
  const n = x0.length;
  let pts = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step; pts.push(p); }
  let vals = pts.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = idx.map((i) => pts[i]); vals = idx.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol * (1 + Math.abs(vals[0]))) break;
    const cen = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) cen[k] += pts[i][k] / n;
    const at = (t) => cen.map((c, k) => c + t * (pts[n][k] - c));
    const xr = at(-1), fr = f(xr);
    if (fr < vals[0]) {
      const xe = at(-2), fe = f(xe);
      if (fe < fr) { pts[n] = xe; vals[n] = fe; } else { pts[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { pts[n] = xr; vals[n] = fr; }
    else {
      const xc = fr < vals[n] ? at(-0.5) : at(0.5), fc = f(xc);
      if (fc < Math.min(fr, vals[n])) { pts[n] = xc; vals[n] = fc; }
      else for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, k) => pts[0][k] + 0.5 * (v - pts[0][k])); vals[i] = f(pts[i]); }
    }
  }
  const b = vals.indexOf(Math.min(...vals));
  return { x: pts[b], f: vals[b] };
}

// ------------------------------------------------------------ contours

/**
 * Marching squares: one SVG path string per level for a scalar field
 * sampled on an nx × ny grid over [x0,x1]×[y0,y1], mapped by sx, sy.
 */
export function contours(F, nx, ny, levels, map) {
  const out = [];
  for (const lv of levels) {
    let d = "";
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = F[j * nx + i], b = F[j * nx + i + 1], c = F[(j + 1) * nx + i + 1], e = F[(j + 1) * nx + i];
        const k = (a > lv) | ((b > lv) << 1) | ((c > lv) << 2) | ((e > lv) << 3);
        if (k === 0 || k === 15) continue;
        const ip = (p, q, u0, v0, u1, v1) => { const t = (lv - p) / (q - p); return map(u0 + t * (u1 - u0), v0 + t * (v1 - v0)); };
        const B = () => ip(a, b, i, j, i + 1, j), R = () => ip(b, c, i + 1, j, i + 1, j + 1);
        const T = () => ip(e, c, i, j + 1, i + 1, j + 1), Lf = () => ip(a, e, i, j, i, j + 1);
        const seg = (p, q) => { d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`; };
        switch (k) {
          case 1: case 14: seg(Lf(), B()); break;
          case 2: case 13: seg(B(), R()); break;
          case 3: case 12: seg(Lf(), R()); break;
          case 4: case 11: seg(R(), T()); break;
          case 6: case 9: seg(B(), T()); break;
          case 7: case 8: seg(Lf(), T()); break;
          case 5: seg(Lf(), T()); seg(B(), R()); break;
          case 10: seg(Lf(), B()); seg(R(), T()); break;
        }
      }
    }
    out.push({ level: lv, d });
  }
  return out;
}
