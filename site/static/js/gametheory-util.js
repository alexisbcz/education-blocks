// Shared helpers for the game theory blocks: exact rational arithmetic on
// BigInt, a linear solver over the rationals, an editable payoff table and
// small DOM utilities. This module does nothing on its own.

import { scrubbable } from "./scrub.js";

const gcd = (a, b) => {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

/** An exact fraction n/d with d > 0, always in lowest terms. */
export class Q {
  constructor(n, d = 1n) {
    if (d === 0n) throw new Error("Q: division by zero");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  /** From a JS number, exact for integers and decimals up to 6 places. */
  static of(x) {
    if (x instanceof Q) return x;
    if (Number.isInteger(x)) return new Q(BigInt(x));
    return new Q(BigInt(Math.round(x * 1e6)), 1000000n);
  }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  cmp(o) { o = Q.of(o); const a = this.n * o.d, b = o.n * this.d; return a < b ? -1 : a > b ? 1 : 0; }
  sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
  isZero() { return this.n === 0n; }
  eq(o) { return this.cmp(o) === 0; }
  toNumber() { return Number(this.n) / Number(this.d); }
  toString() {
    const s = this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
    return s.replace("-", "−");
  }
}
export const Q0 = new Q(0n), Q1 = new Q(1n);
export const qmax = (a, b) => (a.cmp(b) >= 0 ? a : b);
export const qmin = (a, b) => (a.cmp(b) <= 0 ? a : b);

/** Solves M·x = b over the rationals. Returns null if M is singular. */
export function solve(M, b) {
  const n = M.length;
  const A = M.map((row, i) => [...row.map(Q.of), Q.of(b[i])]);
  for (let c = 0; c < n; c++) {
    const p = A.findIndex((row, r) => r >= c && !row[c].isZero());
    if (p < 0) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || A[r][c].isZero()) continue;
      const f = A[r][c].div(A[c][c]);
      for (let k = c; k <= n; k++) A[r][k] = A[r][k].sub(f.mul(A[c][k]));
    }
  }
  return A.map((row, i) => row[n].div(row[i]));
}

/** All non-empty subsets of {0…n−1}, as sorted index arrays. */
export function subsets(n) {
  const out = [];
  for (let m = 1; m < 1 << n; m++) out.push([...Array(n).keys()].filter((i) => m & (1 << i)));
  return out;
}

export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const segOf = (root, label) => root.querySelector(`[role=tablist][aria-label="${label}"] [aria-selected="true"]`)?.dataset.seg;
export const minus = (s) => String(s).replace(/-/g, "−");

/** h creates an HTML element with classes, attributes and children. */
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}

/** The block's switches by name, kept current from their change events
 *  (the switch updates aria-checked only after its event fires). */
export function switches(root, onChange) {
  const state = {};
  root.querySelectorAll("[data-toggle]").forEach((sw) => {
    state[sw.dataset.toggle] = sw.getAttribute("aria-checked") === "true";
    sw.addEventListener("shadcn:checked-change", (e) => { state[sw.dataset.toggle] = e.detail.checked; onChange(); });
  });
  return state;
}

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inputClass = "h-8 w-9 cursor-ew-resize rounded-md border border-input bg-background px-1 text-center font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring sm:w-11";

function payInput(value, aria, onChange) {
  const input = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", "aria-label": aria, class: inputClass, value: minus(value) });
  const s = scrubbable(input, { min: -20, max: 20, step: 1, onChange });
  return { input, s };
}

/**
 * payoffTable fills container with an editable game table.
 * pay[i][j] is [row, column] for a bimatrix, or a number when single.
 * Returns { get, cell, rowHead, colHead, mark } where mark(i, j, who, on)
 * shades one payoff as a best response.
 */
export function payoffTable(container, { rows, cols, pay, single = false, onChange, rowLabel = "Row", colLabel = "Column" }) {
  const m = rows.length, n = cols.length;
  const scrubs = [], spans = [], cells = [], rowHead = [], colHead = [];
  const thead = h("tr", {},
    h("th", { class: "text-left text-[11px] font-normal text-muted-foreground" },
      h("span", { class: "text-vec-u", text: rowLabel }), single ? null : " / ", single ? null : h("span", { class: "text-vec-v", text: colLabel })),
    cols.map((c, j) => (colHead[j] = h("th", { class: "px-1 text-center text-xs font-medium text-vec-v transition-opacity duration-150", text: c }))));
  const body = rows.map((r, i) => {
    scrubs[i] = []; spans[i] = []; cells[i] = [];
    rowHead[i] = h("th", { class: "pr-1 text-right text-[11px] font-medium text-vec-u transition-opacity duration-150 sm:pr-2 sm:text-xs", text: r });
    const tds = cols.map((c, j) => {
      const v = pay[i][j];
      let inner;
      if (single) {
        const a = payInput(v, `${rowLabel} payoff, ${r} against ${c}`, () => onChange?.());
        scrubs[i][j] = [a.s];
        spans[i][j] = [h("span", { class: "rounded-md p-0.5 data-[on]:bg-vec-u/15" }, a.input)];
        inner = spans[i][j][0];
      } else {
        const a = payInput(v[0], `${rowLabel} payoff, ${r} against ${c}`, () => onChange?.());
        const b = payInput(v[1], `${colLabel} payoff, ${r} against ${c}`, () => onChange?.());
        scrubs[i][j] = [a.s, b.s];
        spans[i][j] = [h("span", { class: "rounded-md p-0.5 data-[on]:bg-vec-u/15" }, a.input), h("span", { class: "rounded-md p-0.5 data-[on]:bg-vec-v/15" }, b.input)];
        inner = h("div", { class: "flex items-center justify-center gap-0.5 sm:gap-1" }, spans[i][j][0], h("span", { class: "text-muted-foreground", text: "," }), spans[i][j][1]);
      }
      return (cells[i][j] = h("td", { class: "rounded-lg border bg-background p-1 transition-[border-color,box-shadow,opacity] duration-150 data-[eq]:border-brand data-[eq]:ring-[3px] data-[eq]:ring-brand/25 data-[gone]:opacity-30 sm:p-1.5" }, inner));
    });
    return h("tr", {}, rowHead[i], tds);
  });
  container.replaceChildren(h("table", { class: "border-separate border-spacing-1 text-sm sm:border-spacing-1.5" }, h("thead", {}, thead), h("tbody", {}, body)));
  return {
    get: () => scrubs.map((row) => row.map((c) => (single ? c[0].get() : [c[0].get(), c[1].get()]))),
    set: (p) => p.forEach((row, i) => row.forEach((v, j) => (single ? scrubs[i][j][0].set(v, false) : (scrubs[i][j][0].set(v[0], false), scrubs[i][j][1].set(v[1], false))))),
    cell: (i, j) => cells[i][j],
    rowHead, colHead,
    mark: (i, j, who, on) => spans[i][j][who]?.toggleAttribute("data-on", on),
  };
}

/** Pure best responses of a bimatrix: br[i][j] = [row is BR, column is BR]. */
export function bestResponses(pay, aliveR, aliveC) {
  const m = pay.length, n = pay[0].length;
  const R = aliveR ?? [...Array(m).keys()], C = aliveC ?? [...Array(n).keys()];
  const br = pay.map((row) => row.map(() => [false, false]));
  for (const j of C) {
    const best = Math.max(...R.map((i) => pay[i][j][0]));
    for (const i of R) br[i][j][0] = pay[i][j][0] === best;
  }
  for (const i of R) {
    const best = Math.max(...C.map((j) => pay[i][j][1]));
    for (const j of C) br[i][j][1] = pay[i][j][1] === best;
  }
  return br;
}

/** Formats a mixed strategy of fractions as (a, b, c). */
export const mixStr = (x) => `(${x.map(String).join(", ")})`;
