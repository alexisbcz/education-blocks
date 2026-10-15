// Helpers for the teaching-tool blocks. Exports only: it does nothing on its
// own, so loading it on the /teach page is harmless.

export { rng } from "./assess-expr.js";

/** The inner part of a tool, by its data-tk name. */
export const part = (root, name) => root.querySelector(`[data-tk="${name}"]`);

/** Creates an element with classes and optional text (never HTML). */
export function mk(tag, cls = "", txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

const NS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}
export function svgText(parent, x, y, s, attrs = {}) {
  const t = svg("text", { x, y, class: "fill-muted-foreground font-mono text-[10px]", ...attrs }, parent);
  t.textContent = s;
  return t;
}

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls fn(checked) whenever a switch inside root changes; the switch's
 *  own event carries the new state (aria-checked is updated after it). */
export function onSwitch(root, name, fn) {
  const sw = root.querySelector(`[data-toggle="${name}"]`);
  sw?.addEventListener("shadcn:checked-change", (e) => fn(e.detail.checked));
  return sw?.getAttribute("aria-checked") === "true";
}

/** A status line message. */
export const status = (root, s) => { const n = part(root, "status"); if (n) n.textContent = s; };

/** A minus sign that lines up with digits. */
export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace("-", "−") : "—");

/** Table helpers: header row and body rows from arrays of cells (nodes or text). */
export function table(head, rows, cls = "w-full text-sm") {
  const t = mk("table", cls);
  const th = mk("thead", "border-b bg-muted/40");
  const tr = mk("tr");
  for (const c of head) {
    const cell = mk("th", "px-3 py-2 text-left font-mono text-[11px] font-normal tracking-wider text-muted-foreground uppercase whitespace-nowrap");
    typeof c === "string" ? (cell.textContent = c) : cell.append(c);
    tr.append(cell);
  }
  th.append(tr);
  const tb = mk("tbody", "divide-y");
  for (const r of rows) tb.append(r);
  t.append(th, tb);
  return t;
}
export function row(cells, cls = "") {
  const tr = mk("tr", cls);
  for (const c of cells) {
    const td = mk("td", "px-3 py-2 align-middle");
    if (c instanceof Node) td.append(c);
    else td.textContent = c;
    tr.append(td);
  }
  return tr;
}

/** A small badge-like pill. tone: "brand" | "del" | "muted". */
export function pill(text, tone = "muted") {
  const t = {
    brand: "border-brand/40 bg-brand/10 text-brand",
    del: "border-del/40 bg-del/10 text-del",
    muted: "text-muted-foreground",
  }[tone];
  return mk("span", `inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap ${t}`, text);
}

/** An outline icon-less button styled like the shadcn sm outline button. */
export function btn(label, cls = "") {
  const b = mk("button", "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium shadow-xs outline-none transition-[color,background-color,box-shadow] duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30 " + cls, label);
  b.type = "button";
  return b;
}

export const inputCls = "h-8 min-w-0 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** Normal approximation helpers. */
export function normCdf(z) {
  // Abramowitz–Stegun 7.1.26 on erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Standard normal draw by Box–Muller from a uniform generator. */
export function gauss(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// ------------------------------------------------------------ graphs

/** Kahn's algorithm. ids keeps the authored order for ties; edges are
 *  [from, to] meaning "from is a prerequisite of to". Returns the order and
 *  the depth of each node (longest path from a source). */
export function topoOrder(ids, edges) {
  const indeg = new Map(ids.map((i) => [i, 0]));
  const out = new Map(ids.map((i) => [i, []]));
  for (const [a, b] of edges) { out.get(a).push(b); indeg.set(b, indeg.get(b) + 1); }
  const depth = new Map(ids.map((i) => [i, 0]));
  const ready = ids.filter((i) => indeg.get(i) === 0);
  const order = [];
  while (ready.length) {
    ready.sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
    const n = ready.shift();
    order.push(n);
    for (const m of out.get(n)) {
      depth.set(m, Math.max(depth.get(m), depth.get(n) + 1));
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) ready.push(m);
    }
  }
  return { order, depth, acyclic: order.length === ids.length };
}

/** A path from a to b following edges, or null. */
export function pathBetween(edges, a, b) {
  const prev = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const n = queue.shift();
    if (n === b) {
      const p = [];
      for (let c = b; c !== null; c = prev.get(c)) p.unshift(c);
      return p;
    }
    for (const [x, y] of edges) if (x === n && !prev.has(y)) { prev.set(y, n); queue.push(y); }
  }
  return null;
}

// ------------------------------------------------------------ test statistics

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
/** Population variance (divides by n), as in the usual α formula. */
export const pvar = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length; };
export function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
}

/** Cronbach's α for a learners × items score matrix; skip drops one item. */
export function cronbach(m, skip = -1) {
  const k0 = m[0].length;
  const cols = [...Array(k0).keys()].filter((j) => j !== skip);
  const k = cols.length;
  if (k < 2) return NaN;
  const totals = m.map((r) => cols.reduce((s, j) => s + r[j], 0));
  const sumVar = cols.reduce((s, j) => s + pvar(m.map((r) => r[j])), 0);
  const vt = pvar(totals);
  return vt ? (k / (k - 1)) * (1 - sumVar / vt) : NaN;
}
