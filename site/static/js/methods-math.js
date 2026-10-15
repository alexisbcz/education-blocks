// Pure functions behind the research methods blocks: d-separation and the
// backdoor criterion, multiple-testing corrections, meta-analysis,
// Cronbach's alpha and exact power. No DOM, so they run in Node too.

import { normCdf, tQuantile, nctUpper } from "./stats-math.js";

// ------------------------------------------------------------ causal graphs

/** Children of v in a graph given as edges [from, to]. */
const children = (edges, v) => edges.filter(([a]) => a === v).map(([, b]) => b);

/** Every node reachable from v by directed edges, v excluded. */
export function descendants(edges, v) {
  const seen = new Set();
  const stack = [v];
  while (stack.length) {
    for (const c of children(edges, stack.pop())) if (!seen.has(c)) { seen.add(c); stack.push(c); }
  }
  return seen;
}

/**
 * Simple paths from x to y ignoring edge direction. Each path is a list of
 * steps { node, arrowIn } where arrowIn says whether the edge from the
 * previous node points into this node.
 */
export function paths(nodes, edges, x, y) {
  const out = [];
  const walk = (v, seen, path) => {
    if (v === y) { out.push(path); return; }
    for (const [a, b] of edges) {
      let next = null, into = false;
      if (a === v) { next = b; into = true; } else if (b === v) { next = a; into = false; }
      if (next === null || seen.has(next)) continue;
      walk(next, new Set([...seen, next]), [...path, { node: next, arrowIn: into }]);
    }
  };
  walk(x, new Set([x]), [{ node: x, arrowIn: false }]);
  return out;
}

/**
 * Whether a path is blocked given the conditioning set z (a Set). A middle
 * node is a collider when both edges on the path point into it.
 */
export function blocked(path, edges, z) {
  for (let i = 1; i < path.length - 1; i++) {
    const m = path[i].node;
    const inFromPrev = path[i].arrowIn;
    const inFromNext = !path[i + 1].arrowIn; // edge next→m points into m
    const collider = inFromPrev && inFromNext;
    if (collider) {
      const opened = z.has(m) || [...descendants(edges, m)].some((d) => z.has(d));
      if (!opened) return { blocked: true, at: m, collider: true };
    } else if (z.has(m)) {
      return { blocked: true, at: m, collider: false };
    }
  }
  return { blocked: false };
}

/** A backdoor path starts with an edge pointing into x. */
export const isBackdoor = (path) => path.length > 1 && !path[1].arrowIn;

/**
 * Pearl's backdoor criterion for the effect of x on y: no member of z is a
 * descendant of x, and z blocks every backdoor path.
 */
export function backdoorOK(nodes, edges, x, y, z) {
  const desc = descendants(edges, x);
  for (const v of z) if (desc.has(v)) return { ok: false, reason: `${v} is a descendant of ${x}` };
  for (const p of paths(nodes, edges, x, y)) {
    if (isBackdoor(p) && !blocked(p, edges, z).blocked) return { ok: false, reason: `backdoor path ${p.map((s) => s.node).join("–")} is open` };
  }
  return { ok: true };
}

/** All minimal adjustment sets satisfying the backdoor criterion. */
export function minimalSets(nodes, edges, x, y) {
  const cand = nodes.filter((v) => v !== x && v !== y);
  const ok = [];
  for (let mask = 0; mask < 1 << cand.length; mask++) {
    const z = new Set(cand.filter((_, i) => mask & (1 << i)));
    if (!backdoorOK(nodes, edges, x, y, z).ok) continue;
    if (ok.some((s) => [...s].every((v) => z.has(v)))) continue; // a subset already works
    ok.push(z);
  }
  // Keep only minimal sets (bitmask order already visits small sets first
  // only partly, so filter again).
  return ok.filter((s) => !ok.some((t) => t !== s && t.size < s.size && [...t].every((v) => s.has(v))));
}

// ------------------------------------------------------------ multiple testing

/** Adjusted p-values in the input order: { bonf, holm, bh }. */
export function adjust(ps) {
  const m = ps.length;
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const bonf = ps.map((p) => Math.min(1, m * p));
  const holm = new Array(m);
  let run = 0;
  order.forEach(([p, i], k) => {
    run = Math.max(run, Math.min(1, (m - k) * p));
    holm[i] = run;
  });
  const bh = new Array(m);
  let min = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [p, i] = order[k];
    min = Math.min(min, (m * p) / (k + 1));
    bh[i] = Math.min(1, min);
  }
  return { bonf, holm, bh };
}

// ------------------------------------------------------------ meta-analysis

/** Fixed- and random-effects (DerSimonian–Laird) pooling of y with SEs se. */
export function meta(y, se) {
  const k = y.length;
  const w = se.map((s) => 1 / (s * s));
  const sw = w.reduce((a, b) => a + b, 0);
  const fe = w.reduce((a, wi, i) => a + wi * y[i], 0) / sw;
  const feSE = Math.sqrt(1 / sw);
  const Q = w.reduce((a, wi, i) => a + wi * (y[i] - fe) ** 2, 0);
  const df = k - 1;
  const c = sw - w.reduce((a, wi) => a + wi * wi, 0) / sw;
  const tau2 = df > 0 && c > 0 ? Math.max(0, (Q - df) / c) : 0;
  const wr = se.map((s) => 1 / (s * s + tau2));
  const swr = wr.reduce((a, b) => a + b, 0);
  const re = wr.reduce((a, wi, i) => a + wi * y[i], 0) / swr;
  const reSE = Math.sqrt(1 / swr);
  const I2 = Q > 0 ? Math.max(0, (Q - df) / Q) : 0;
  return { fe, feSE, re, reSE, Q, df, tau2, I2, w, wr };
}

// ------------------------------------------------------------ measurement

const variance = (a) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};

const corr = (x, y) => {
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
};

/** Cronbach's alpha of a people × items matrix (sample variances). */
export function cronbach(rows) {
  const k = rows[0].length;
  const items = Array.from({ length: k }, (_, j) => rows.map((r) => r[j]));
  const totals = rows.map((r) => r.reduce((s, v) => s + v, 0));
  const itemVar = items.map(variance);
  const totalVar = variance(totals);
  const alpha = (k / (k - 1)) * (1 - itemVar.reduce((s, v) => s + v, 0) / totalVar);
  return { alpha, itemVar, totalVar, k };
}

/** Per item: corrected item–rest correlation and alpha without the item. */
export function itemAnalysis(rows) {
  const k = rows[0].length;
  return Array.from({ length: k }, (_, j) => {
    const item = rows.map((r) => r[j]);
    const rest = rows.map((r) => r.reduce((s, v, i) => s + (i === j ? 0 : v), 0));
    const without = rows.map((r) => r.filter((_, i) => i !== j));
    return { r: corr(item, rest), alphaWithout: k > 2 ? cronbach(without).alpha : NaN };
  });
}

// ------------------------------------------------------------ power

/** Standard normal quantile by bisection on the CDF. */
export function zQuantile(p) {
  let lo = -10, hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    normCdf(mid) < p ? (lo = mid) : (hi = mid);
  }
  return (lo + hi) / 2;
}

/**
 * Exact two-sided power of a t-test. design "two": n per group, df 2n−2,
 * δ = d√(n/2); "paired": n pairs, df n−1, δ = d√n.
 */
export function powerT(n, d, alpha, design = "two") {
  const df = design === "two" ? 2 * n - 2 : n - 1;
  const delta = design === "two" ? d * Math.sqrt(n / 2) : d * Math.sqrt(n);
  const c = tQuantile(1 - alpha / 2, df);
  return nctUpper(c, df, delta) + nctUpper(c, df, -delta);
}

/** Smallest n reaching the target power, exactly and by the normal formula. */
export function sampleSize(d, alpha, power, design = "two") {
  const z = zQuantile(1 - alpha / 2) + zQuantile(power);
  const k = design === "two" ? 2 : 1;
  const approx = Math.ceil(k * (z / d) ** 2);
  let n = Math.max(design === "two" ? 2 : 3, approx - 3);
  while (powerT(n, d, alpha, design) < power && n < 100000) n++;
  return { exact: n, approx, achieved: powerT(n, d, alpha, design) };
}
