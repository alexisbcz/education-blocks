// Shared helpers for the spectroscopy blocks: a molecular formula parser,
// isotope tables, a seeded random generator and small DOM conveniences.
// This module only exports; it draws nothing on its own.

import { num } from "./plot.js";

export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onSeg = (root, fn) =>
  root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
export const setSeg = (root, label, value) => {
  const list = root.querySelector(`[role=tablist][aria-label="${label}"]`);
  for (const b of list?.querySelectorAll("[data-seg]") ?? []) b.setAttribute("aria-selected", String(b.dataset.seg === value));
};
export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(6)); return o; };
export const sub = (s) => s.replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]);

/** Mulberry32: a small seeded generator, so "new data" is reproducible. */
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
export const gauss = (r) => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };

// IUPAC/CIAAW exact masses (u) and natural abundances, plus standard
// atomic weights for the average mass.
export const ISOTOPES = {
  H: { w: 1.008, iso: [[1.00782503207, 0.999885], [2.0141017778, 0.000115]] },
  C: { w: 12.011, iso: [[12, 0.9893], [13.0033548378, 0.0107]] },
  N: { w: 14.007, iso: [[14.0030740048, 0.99636], [15.0001088982, 0.00364]] },
  O: { w: 15.999, iso: [[15.99491461956, 0.99757], [16.9991317, 0.00038], [17.999161, 0.00205]] },
  F: { w: 18.998, iso: [[18.99840322, 1]] },
  Si: { w: 28.085, iso: [[27.9769265325, 0.92223], [28.9764947, 0.04685], [29.97377017, 0.03092]] },
  P: { w: 30.974, iso: [[30.97376163, 1]] },
  S: { w: 32.06, iso: [[31.972071, 0.9499], [32.97145876, 0.0075], [33.9678669, 0.0425], [35.96708076, 0.0001]] },
  Cl: { w: 35.45, iso: [[34.96885268, 0.7576], [36.96590259, 0.2424]] },
  Br: { w: 79.904, iso: [[78.9183371, 0.5069], [80.9162906, 0.4931]] },
  I: { w: 126.904, iso: [[126.904473, 1]] },
};
export const ELEMENTS = Object.keys(ISOTOPES);

/**
 * parseFormula reads formulas like C6H6, CH3CH2OH, Ca(OH)2 or C2H5Br into
 * { counts: {El: n}, order: [El…] }, or { error } when it can't.
 */
export function parseFormula(src) {
  const s = src.replace(/\s+/g, "").replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  if (!s) return { error: "type a formula" };
  let i = 0;
  const readNum = () => { const m = /^\d+/.exec(s.slice(i)); if (!m) return 1; i += m[0].length; return Number(m[0]); };
  function group(closer) {
    const c = {};
    while (i < s.length) {
      const ch = s[i];
      if (ch === "(") {
        i++;
        const inner = group(")");
        if (inner.error) return inner;
        if (s[i] !== ")") return { error: "a bracket is not closed" };
        i++;
        const k = readNum();
        for (const [e, n] of Object.entries(inner)) c[e] = (c[e] ?? 0) + n * k;
      } else if (ch === ")") {
        return closer ? c : { error: "a closing bracket has no opener" };
      } else {
        const m = /^[A-Z][a-z]?/.exec(s.slice(i));
        if (!m) return { error: `unexpected “${ch}”` };
        let el = m[0];
        if (!ISOTOPES[el] && el.length === 2 && ISOTOPES[el[0]]) el = el[0];
        if (!ISOTOPES[el]) return { error: `${m[0]} is not supported (use ${ELEMENTS.join(", ")})` };
        i += el.length;
        const k = readNum();
        c[el] = (c[el] ?? 0) + k;
      }
    }
    return closer ? { error: "a bracket is not closed" } : c;
  }
  const counts = group(null);
  if (counts.error) return counts;
  // Hill order: C, H, then alphabetical.
  const order = Object.keys(counts).sort((a, b) => {
    const r = (e) => (counts.C ? (e === "C" ? 0 : e === "H" ? 1 : 2) : 2);
    return r(a) - r(b) || a.localeCompare(b);
  });
  return { counts, order };
}

export const hill = (f) => f.order.map((e) => e + (f.counts[e] > 1 ? sub(String(f.counts[e])) : "")).join("");

/**
 * isotopeCluster convolves every atom's isotope distribution. Peaks are
 * binned by nominal offset from the monoisotopic mass; each bin keeps its
 * probability and its probability-weighted exact mass.
 */
export function isotopeCluster(counts) {
  let dist = [{ off: 0, p: 1, m: 0 }];
  let mono = 0;
  for (const [el, n] of Object.entries(counts)) {
    const iso = ISOTOPES[el].iso;
    const m0 = iso[0][0];
    mono += m0 * n;
    const atom = iso.map(([m, p]) => ({ off: Math.round(m - m0), p, dm: m - m0 }));
    for (let k = 0; k < n; k++) {
      const next = new Map();
      for (const a of dist) for (const b of atom) {
        const p = a.p * b.p;
        if (p < 1e-14) continue;
        const key = a.off + b.off;
        const cur = next.get(key) ?? { off: key, p: 0, m: 0 };
        cur.m = (cur.m * cur.p + (a.m + b.dm) * p) / (cur.p + p);
        cur.p += p;
        next.set(key, cur);
      }
      dist = [...next.values()].sort((x, y) => x.off - y.off);
    }
  }
  return { mono, peaks: dist.map((d) => ({ off: d.off, p: d.p, mass: mono + d.m })) };
}

export const averageMass = (counts) => Object.entries(counts).reduce((s, [e, n]) => s + ISOTOPES[e].w * n, 0);
export const nominalMass = (counts) => Object.entries(counts).reduce((s, [e, n]) => s + Math.round(ISOTOPES[e].iso[0][0]) * n, 0);

export const pct = (v, d = 1) => `${num(v * 100, d)}%`;
