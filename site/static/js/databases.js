// Databases: a SQL engine with its plan, joins, normalization, a B+ tree,
// index costs, isolation anomalies, WAL recovery, join ordering, ER
// diagrams and quorum replication. The SQL engine lives in databases-sql.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { tokenize, run, SQLError } from "./databases-sql.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const make = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
// seg-change bubbles from the tablist; its aria-label names the control.
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const setSeg = (root, label, value) => {
  const list = root.querySelector(`[role=tablist][aria-label="${label}"]`);
  for (const b of list.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b.dataset.seg === value));
};
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmtNum = (v) => (typeof v === "number" && !Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(v));

// A result grid from columns and rows; NULL in italics.
function grid(columns, rows, opts = {}) {
  const wrap = make("div", "scroll-thin overflow-x-auto rounded-lg border bg-background");
  const table = make("table", "w-full font-mono text-xs");
  const head = make("tr", "border-b bg-code-panel text-left");
  for (const c of columns) head.append(make("th", "px-2.5 py-1.5 font-medium whitespace-nowrap", c));
  const thead = make("thead"); thead.append(head);
  const tbody = make("tbody");
  rows.forEach((r, i) => {
    const tr = make("tr", "border-b last:border-b-0 transition-colors duration-100 data-[on]:bg-brand/10 data-[miss]:text-muted-foreground");
    tr.dataset.idx = i;
    opts.decorate?.(tr, i);
    for (const v of r) {
      const td = make("td", "px-2.5 py-1 whitespace-nowrap tabular-nums");
      if (v === null) td.append(make("span", "text-muted-foreground italic", "NULL"));
      else td.textContent = fmtNum(v);
      tr.append(td);
    }
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

// ============================================================ SQL

const SQL_FUNCS = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

for (const root of document.querySelectorAll("[data-db-sql]")) {
  const tables = JSON.parse(root.dataset.tables);
  const ta = root.querySelector("[data-input]");
  const pre = root.querySelector("[data-highlight]");
  const planEl = root.querySelector("[data-plan]");
  const result = root.querySelector("[data-result]");
  const err = root.querySelector("[data-error]");
  const count = root.querySelector("[data-count]");
  const presets = [...root.querySelectorAll("[data-preset]")];

  const paint = () => {
    const src = ta.value;
    pre.replaceChildren();
    let toks;
    try { toks = tokenize(src); } catch { pre.textContent = src + "\n"; return; }
    toks.forEach((t, i) => {
      const raw = t.raw ?? t.v;
      let cls = "";
      if (t.t === "kw") cls = "tok-keyword";
      else if (t.t === "str") cls = "tok-string";
      else if (t.t === "num") cls = "tok-number";
      else if (t.t === "comment") cls = "tok-comment";
      else if (t.t === "op") cls = "*=<>+-/".includes(raw[0]) ? "tok-operator" : "tok-punct";
      else if (t.t === "id" && SQL_FUNCS.has(t.v.toUpperCase()) && toks.slice(i + 1).find((x) => x.t !== "ws")?.v === "(") cls = "tok-function";
      if (cls) pre.append(make("span", cls, raw)); else pre.append(document.createTextNode(raw));
    });
    pre.append(document.createTextNode("\n"));
    const lines = src.split("\n");
    ta.style.height = `${pre.offsetHeight}px`;
    ta.style.width = `calc(${Math.max(...lines.map((l) => l.length)) + 2}ch + 1.5rem)`;
  };

  const execute = () => {
    err.hidden = true;
    let res;
    try {
      res = run(ta.value, tables);
    } catch (e) {
      err.textContent = e instanceof SQLError ? e.message : `Error: ${e.message}`;
      err.hidden = false;
      return;
    }
    planEl.replaceChildren(...res.plan.map((s, i) => {
      const li = make("li", "flex items-start gap-2 rounded-md border bg-code px-2 py-1.5");
      li.append(make("span", "w-4 shrink-0 text-muted-foreground tabular-nums", String(i + 1)));
      const body = make("span", "min-w-0 flex-1");
      body.append(make("span", "font-medium text-foreground", s.op + " "), make("span", "break-words text-muted-foreground", s.detail));
      li.append(body, make("span", "shrink-0 rounded bg-brand/10 px-1.5 text-brand tabular-nums", `${s.rows} row${s.rows === 1 ? "" : "s"}`));
      return li;
    }));
    count.textContent = `${res.rows.length} row${res.rows.length === 1 ? "" : "s"} · ${res.columns.length} column${res.columns.length === 1 ? "" : "s"}`;
    result.replaceChildren(grid(res.columns, res.rows));
  };

  ta.addEventListener("input", paint);
  ta.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); execute(); }
  });
  root.querySelector("[data-action=run]").addEventListener("click", execute);
  for (const b of presets) b.addEventListener("click", () => {
    for (const x of presets) x.toggleAttribute("data-on", x === b);
    ta.value = b.dataset.sql;
    paint();
    execute();
  });
  new ResizeObserver(paint).observe(pre.parentElement);
  paint();
  execute();
}

// ============================================================ Joins

for (const root of document.querySelectorAll("[data-db-joins]")) {
  const authors = [[1, "Austen"], [2, "Hugo"], [3, "Tolstoy"]];
  const books = [["Emma", 1], ["Persuasion", 1], ["Les Misérables", 2], ["Untitled", 9]];
  const leftBox = root.querySelector("[data-left]"), rightBox = root.querySelector("[data-right]");
  const outBox = root.querySelector("[data-out=grid]"), rowsEl = root.querySelector("[data-rows]");
  const sqlEl = root.querySelector("[data-sql]"), note = root.querySelector("[data-note]");
  const NOTES = {
    inner: "Only pairs that satisfy the ON condition. Tolstoy (no book) and Untitled (unknown author 9) disappear.",
    left: "Every author, matched or not: Tolstoy appears once, with NULL where a book would be.",
    right: "Every book: Untitled keeps its row, with a NULL author. A RIGHT JOIN is a LEFT JOIN with the tables swapped.",
    full: "Both sides' orphans: the inner matches plus Tolstoy and Untitled, each padded with NULLs.",
  };
  let type = "inner";

  function draw() {
    const pairs = [];
    const usedB = new Set();
    authors.forEach((a, ai) => {
      let hit = false;
      books.forEach((b, bi) => { if (b[1] === a[0]) { pairs.push([ai, bi]); usedB.add(bi); hit = true; } });
      if (!hit && (type === "left" || type === "full")) pairs.push([ai, null]);
    });
    if (type === "right" || type === "full") books.forEach((b, bi) => { if (!usedB.has(bi)) pairs.push([null, bi]); });
    if (type === "right") pairs.sort((x, y) => (x[1] ?? 99) - (y[1] ?? 99));
    const kept = { a: new Set(pairs.map((p) => p[0])), b: new Set(pairs.map((p) => p[1])) };
    const lg = grid(["id", "name"], authors, { decorate: (tr, i) => { if (!kept.a.has(i)) tr.dataset.miss = ""; } });
    const rg = grid(["title", "author_id"], books, { decorate: (tr, i) => { if (!kept.b.has(i)) tr.dataset.miss = ""; } });
    leftBox.replaceChildren(lg);
    rightBox.replaceChildren(rg);
    const rows = pairs.map(([ai, bi]) => [ai === null ? null : authors[ai][1], bi === null ? null : books[bi][0]]);
    const og = grid(["a.name", "b.title"], rows);
    outBox.replaceChildren(og);
    rowsEl.textContent = `result · ${rows.length} rows`;
    sqlEl.textContent = `SELECT a.name, b.title FROM authors a ${type === "full" ? "FULL OUTER" : type.toUpperCase()} JOIN books b ON b.author_id = a.id`;
    note.textContent = NOTES[type];
    // Hover a result row: light its inputs.
    og.querySelectorAll("tbody tr").forEach((tr, i) => {
      const [ai, bi] = pairs[i];
      const light = (on) => {
        tr.toggleAttribute("data-on", on);
        if (ai !== null) lg.querySelectorAll("tbody tr")[ai].toggleAttribute("data-on", on);
        if (bi !== null) rg.querySelectorAll("tbody tr")[bi].toggleAttribute("data-on", on);
      };
      tr.addEventListener("pointerenter", () => light(true));
      tr.addEventListener("pointerleave", () => light(false));
    });
  }
  onSeg(root, (_, v) => { type = v; draw(); });
  draw();
}

// ============================================================ Steppers

for (const root of document.querySelectorAll("[data-db-norm]")) {
  const steps = [...root.querySelectorAll("[data-step]")];
  const counter = root.querySelector("[data-counter]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => (s.hidden = k !== at));
    counter.textContent = `${at + 1} / ${steps.length}`;
    back.disabled = at === 0;
    next.disabled = at === steps.length - 1;
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1 }[e.key];
    if (to === undefined || e.target.closest("button")) return;
    e.preventDefault();
    go(to);
  });
}

// ============================================================ B+ tree

// Leaves hold the keys and link to their right neighbour; internal nodes
// hold separators: child i covers keys < keys[i], the last child the rest.
class BPlusTree {
  constructor(maxKeys) { this.m = maxKeys; this.root = { leaf: true, keys: [], next: null }; this.splits = 0; }
  findLeaf(key, path = []) {
    let n = this.root;
    path.push(n);
    while (!n.leaf) {
      let i = 0;
      while (i < n.keys.length && key >= n.keys[i]) i++;
      n = n.children[i];
      path.push(n);
    }
    return n;
  }
  has(key) { return this.findLeaf(key).keys.includes(key); }
  insert(key) {
    const path = [];
    const leaf = this.findLeaf(key, path);
    if (leaf.keys.includes(key)) return { dup: true, split: [] };
    leaf.keys.push(key);
    leaf.keys.sort((a, b) => a - b);
    const split = [];
    let node = leaf, depth = path.length - 1;
    while (node.keys.length > this.m) {
      this.splits++;
      let right, sep;
      if (node.leaf) {
        const cut = Math.ceil(node.keys.length / 2);
        right = { leaf: true, keys: node.keys.slice(cut), next: node.next };
        node.keys = node.keys.slice(0, cut);
        node.next = right;
        sep = right.keys[0]; // copied up
      } else {
        const mid = Math.floor(node.keys.length / 2);
        sep = node.keys[mid]; // moved up
        right = { leaf: false, keys: node.keys.slice(mid + 1), children: node.children.slice(mid + 1) };
        node.keys = node.keys.slice(0, mid);
        node.children = node.children.slice(0, mid + 1);
      }
      split.push(node, right);
      if (depth === 0) {
        this.root = { leaf: false, keys: [sep], children: [node, right] };
        split.push(this.root);
        break;
      }
      const parent = path[depth - 1];
      const at = parent.children.indexOf(node);
      parent.keys.splice(at, 0, sep);
      parent.children.splice(at + 1, 0, right);
      node = parent;
      depth--;
    }
    return { dup: false, split };
  }
  levels() {
    const out = [];
    let level = [this.root];
    while (level.length) { out.push(level); level = level.flatMap((n) => (n.leaf ? [] : n.children)); }
    return out;
  }
  leafDepths() {
    const ds = [];
    const walk = (n, d) => (n.leaf ? ds.push(d) : n.children.forEach((c) => walk(c, d + 1)));
    walk(this.root, 0);
    return ds;
  }
}

for (const root of document.querySelectorAll("[data-db-bplus]")) {
  const svg = root.querySelector("[data-svg=tree]");
  const input = root.querySelector("[data-input=key]");
  const o = outs(root);
  const SEED = [5, 12, 20, 27, 33, 41, 48, 56, 63, 70];
  let maxKeys = 3, tree, rng = mulberry32(3), hot = { path: [], split: [], key: null, found: null };

  const reset = () => {
    tree = new BPlusTree(maxKeys);
    for (const k of SEED) tree.insert(k);
    tree.splits = 0;
    hot = { path: [], split: [], key: null, found: null };
    o.last.textContent = "seeded with 10 keys";
    draw();
  };

  function draw() {
    const levels = tree.levels();
    const KW = 26, PAD = 6, GAP = 12, LH = 70;
    const width = (n) => Math.max(1, n.keys.length) * KW + PAD * 2;
    // Leaves left to right, parents centred over their children.
    const pos = new Map();
    let x = 10;
    for (const leaf of levels.at(-1)) { pos.set(leaf, { x, w: width(leaf) }); x += width(leaf) + GAP; }
    for (let li = levels.length - 2; li >= 0; li--) {
      for (const n of levels[li]) {
        const first = pos.get(n.children[0]), last = pos.get(n.children.at(-1));
        const w = width(n), cx = (first.x + last.x + last.w) / 2;
        pos.set(n, { x: cx - w / 2, w });
      }
    }
    const total = Math.max(640, x + 10), height = levels.length * LH + 20;
    svg.setAttribute("viewBox", `0 0 ${total} ${Math.max(160, height)}`);
    // Keep the drawing's scale: a big tree scrolls sideways instead of shrinking.
    svg.style.width = total > 640 ? `${total}px` : "";
    svg.style.minWidth = total > 640 ? `${total}px` : "";
    const rp = pos.get(tree.root), box = svg.parentElement;
    if (total > 640) box.scrollLeft = Math.max(0, rp.x + rp.w / 2 - box.clientWidth / 2);
    svg.replaceChildren();
    const yOf = (li) => 20 + li * LH;
    // Edges first.
    levels.forEach((lv, li) => lv.forEach((n) => {
      if (n.leaf) return;
      const p = pos.get(n);
      n.children.forEach((c, i) => {
        const q = pos.get(c);
        const sx = p.x + PAD + i * KW, onPath = hot.path.includes(n) && hot.path.includes(c);
        el("line", { x1: sx, y1: yOf(li) + 26, x2: q.x + q.w / 2, y2: yOf(li + 1), style: `stroke:${onPath ? "var(--brand)" : "currentColor"};stroke-opacity:${onPath ? 1 : 0.3};stroke-width:${onPath ? 2 : 1}` }, svg);
      });
    }));
    // Leaf links.
    const leaves = levels.at(-1);
    leaves.forEach((n) => {
      if (!n.next) return;
      const p = pos.get(n), q = pos.get(n.next), y = yOf(levels.length - 1) + 13;
      el("line", { x1: p.x + p.w, y1: y, x2: q.x - 2, y2: y, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 2" }, svg);
    });
    levels.forEach((lv, li) => lv.forEach((n) => {
      const p = pos.get(n), y = yOf(li);
      const isPath = hot.path.includes(n), isSplit = hot.split.includes(n);
      el("rect", { x: p.x, y, width: p.w, height: 26, rx: 5,
        style: `fill:${n.leaf ? "var(--background)" : "var(--code-panel)"};stroke:${isPath || isSplit ? "var(--brand)" : "currentColor"};stroke-opacity:${isPath || isSplit ? 1 : 0.35};stroke-width:${isPath ? 2 : 1};${isSplit ? "stroke-dasharray:4 2" : ""}` }, svg);
      n.keys.forEach((k, i) => {
        const cx = p.x + PAD + i * KW + KW / 2;
        if (i > 0) el("line", { x1: p.x + PAD + i * KW, y1: y + 4, x2: p.x + PAD + i * KW, y2: y + 22, style: "stroke:currentColor;stroke-opacity:0.15" }, svg);
        const isKey = k === hot.key;
        if (isKey && n.leaf) el("rect", { x: cx - KW / 2 + 2, y: y + 3, width: KW - 4, height: 20, rx: 3, style: `fill:${hot.found === false ? "var(--code-del)" : "var(--brand)"};fill-opacity:0.18` }, svg);
        text(svg, cx, y + 17, String(k), { "text-anchor": "middle", class: `font-mono text-[11px] ${isKey && n.leaf ? "fill-foreground font-semibold" : n.leaf ? "fill-foreground" : "fill-muted-foreground"}` });
      });
    }));
    const ds = tree.leafDepths();
    o.keys.textContent = String(leaves.reduce((s, n) => s + n.keys.length, 0));
    o.height.textContent = `${levels.length} level${levels.length > 1 ? "s" : ""}${new Set(ds).size === 1 ? " · balanced" : " · UNBALANCED"}`;
    o.nodes.textContent = String(levels.reduce((s, l) => s + l.length, 0));
    o.splits.textContent = String(tree.splits);
  }

  const readKey = () => {
    const v = parseInt(input.value, 10);
    if (!Number.isFinite(v) || v < 0 || v > 999) { o.last.textContent = "enter a key from 0 to 999"; return null; }
    return v;
  };
  const insert = (k) => {
    const before = tree.splits, oldRoot = tree.root;
    const r = tree.insert(k);
    const path = [];
    tree.findLeaf(k, path);
    hot = { path, split: r.split, key: k, found: true };
    const n = tree.splits - before;
    o.last.textContent = r.dup ? `${k} is already there`
      : n === 0 ? `inserted ${k}`
      : `inserted ${k}: ${n} split${n > 1 ? "s" : ""}${tree.root !== oldRoot ? ", new root (one level taller)" : ""}`;
    draw();
  };
  root.querySelector("[data-action=insert]").addEventListener("click", () => { const k = readKey(); if (k !== null) insert(k); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const k = readKey(); if (k !== null) insert(k); } });
  root.querySelector("[data-action=search]").addEventListener("click", () => {
    const k = readKey();
    if (k === null) return;
    const path = [];
    const leaf = tree.findLeaf(k, path);
    const found = leaf.keys.includes(k);
    hot = { path, split: [], key: k, found };
    o.last.textContent = `${found ? "found" : "not found"} ${k}: ${path.length} node${path.length > 1 ? "s" : ""} read`;
    draw();
  });
  root.querySelector("[data-action=random]").addEventListener("click", () => {
    const size = tree.levels().at(-1).reduce((s, n) => s + n.keys.length, 0);
    if (size >= 150) { o.last.textContent = "150 keys is plenty: reset to start again"; return; }
    let added = 0;
    for (let tries = 0; added < 10 && tries < 500; tries++) {
      const k = Math.floor(rng() * 1000);
      if (!tree.has(k)) { tree.insert(k); added++; }
    }
    hot = { path: [], split: [], key: null, found: null };
    o.last.textContent = `inserted ${added} random keys`;
    draw();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  onSeg(root, (_, v) => { maxKeys = Number(v); reset(); });
  root.dbTree = () => tree; // for tests
  reset();
}

// ============================================================ Index cost

for (const root of document.querySelectorAll("[data-db-cost]")) {
  const svg = root.querySelector("[data-svg=plot]");
  const o = outs(root);
  let kind = "point";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { kind = v; draw(); });

  // Page reads in a simple I/O model: B rows per page, fan-out f.
  function costs(n, B, f, sel) {
    const P = Math.ceil(n / B);
    const levels = P <= 1 ? 1 : 1 + Math.ceil(Math.log(P) / Math.log(f) - 1e-9);
    const scan = P;
    const btree = kind === "point" ? levels : Math.min(P + levels - 1, levels - 1 + Math.ceil((sel * n) / B));
    const hash = kind === "point" ? 1 : P;
    return { P, levels, scan, btree, hash };
  }
  function draw() {
    const B = Math.max(1, Math.round(s.perpage.get())), f = Math.max(2, Math.round(s.fanout.get()));
    const sel = s.sel.get() / 100, lg = s.rows.get(), n = Math.round(10 ** lg);
    svg.replaceChildren();
    const xs = Array.from({ length: 81 }, (_, i) => 2 + i * 0.1);
    const series = xs.map((x) => costs(10 ** x, B, f, sel));
    const top = Math.max(1, Math.ceil(Math.log10(Math.max(...series.map((c) => c.scan)))));
    // The floor sits a little below 1 page, so lines at 1 stay visible.
    const fr = frame(svg, { box: [52, 14, 530, 240], x: [2, 10], y: [-0.35, top], xticks: [2, 4, 6, 8, 10], yticks: Array.from({ length: top + 1 }, (_, i) => i),
      xfmt: (v) => `10^${v}`, yfmt: (v) => (v === 0 ? "1" : `10^${v}`), xlabel: "rows", ylabel: "page reads" });
    const line = (key, color, dash = "") => polyline(svg, xs.map((x, i) => [fr.sx(x), fr.sy(Math.log10(Math.max(1, series[i][key])))]), `stroke:${color};stroke-width:2;${dash}`);
    line("scan", "var(--code-del)");
    line("hash", "var(--vec-u)", "stroke-dasharray:6 4");
    line("btree", "var(--brand)");
    el("line", { x1: fr.sx(lg), x2: fr.sx(lg), y1: fr.T, y2: fr.T + fr.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    [["full scan", "var(--code-del)"], ["hash", "var(--vec-u)"], ["B+ tree", "var(--brand)"]].forEach(([l, c], i) => text(svg, fr.L + 8, fr.T + 12 + i * 13, `■ ${l}`, { style: `fill:${c}` }));
    const c = costs(n, B, f, sel);
    const fmt = (v) => `${v.toLocaleString("en")} page${v === 1 ? "" : "s"}`;
    o.scan.textContent = fmt(c.scan);
    o.btree.textContent = fmt(c.btree);
    o.hash.textContent = kind === "point" ? `${fmt(c.hash)} (no overflow)` : `${fmt(c.hash)}: can't do ranges`;
    o.levels.textContent = `${c.levels} (n = ${n.toLocaleString("en")})`;
  }
  draw();
}

// ============================================================ Isolation

for (const root of document.querySelectorAll("[data-db-isolation]")) {
  const verdict = root.querySelector("[data-verdict]");
  let scenario = "dirty", level = "ru";
  const RANK = { ru: 0, rc: 1, rr: 2, ser: 3 };
  // What each read returns at each level (lock- or snapshot-based engines
  // differ in how, not in what the standard allows).
  const OUTCOME = {
    dirty: (l) => ({ r1: RANK[l] === 0 ? 0 : 100, anomaly: RANK[l] === 0,
      text: RANK[l] === 0 ? "T2 read 0, a value T1 then rolled back: it never existed." : "T2 reads the last committed value, 100 (or waits for T1, in a locking engine)." }),
    nonrepeatable: (l) => ({ r1: 100, r2: RANK[l] <= 1 ? 50 : 100, anomaly: RANK[l] <= 1,
      text: RANK[l] <= 1 ? "T1 read the same row twice and got 100, then 50: T2's commit slipped in between." : "T1 sees 100 both times: its reads are repeatable until it ends." }),
    phantom: (l) => ({ r1: 2, r2: RANK[l] <= 2 ? 3 : 2, anomaly: RANK[l] <= 2,
      text: RANK[l] <= 2 ? "The same query returned 2 rows, then 3: a phantom row appeared. The standard allows it below serializable." : "Serializable: T1's two counts agree, as if the transactions ran one after the other." }),
  };
  function draw() {
    for (const ol of root.querySelectorAll("[data-scenario]")) ol.hidden = ol.dataset.scenario !== scenario;
    const res = OUTCOME[scenario](level);
    const ol = root.querySelector(`[data-scenario="${scenario}"]`);
    for (const r of ol.querySelectorAll("[data-read]")) r.textContent = `→ ${res[r.dataset.read]}`;
    for (const row of root.querySelectorAll("[data-level-row]")) row.toggleAttribute("data-on", row.dataset.levelRow === level);
    verdict.replaceChildren(
      make("span", `font-medium ${res.anomaly ? "text-del" : "text-add"}`, res.anomaly ? "Anomaly. " : "Prevented. "),
      make("span", "text-muted-foreground", res.text));
    verdict.className = `rounded-lg border p-3 text-sm ${res.anomaly ? "border-del/40 bg-del/8" : "border-add/40 bg-add/8"}`;
  }
  onSeg(root, (label, v) => { if (label === "Scenario") scenario = v; else level = v; draw(); });
  draw();
}

// ============================================================ WAL recovery

for (const root of document.querySelectorAll("[data-db-wal]")) {
  const recs = [...root.querySelectorAll("[data-lsn]")];
  const crashLine = root.querySelector("[data-crashline]");
  const phase = root.querySelector("[data-phase]");
  const vals = Object.fromEntries([...root.querySelectorAll("[data-val]")].map((n) => [n.dataset.val, n]));
  const o = outs(root);
  // The log as data: [kind, tx, page, old, new].
  const LOG = [["BEGIN", "T1"], ["UPDATE", "T1", "A", 100, 50], ["BEGIN", "T2"], ["UPDATE", "T2", "B", 200, 250],
    ["UPDATE", "T1", "C", 10, 60], ["COMMIT", "T1"], ["UPDATE", "T2", "A", 50, 80], ["BEGIN", "T3"],
    ["UPDATE", "T3", "C", 60, 0], ["COMMIT", "T2"], ["UPDATE", "T3", "B", 250, 300]];
  const INITIAL = { A: 100, B: 200, C: 10 };
  let crash = 9, steps = [], at = 0;

  function plan() {
    const log = LOG.slice(0, crash);
    const begun = new Set(), committed = new Set();
    for (const r of log) { if (r[0] === "BEGIN") begun.add(r[1]); if (r[0] === "COMMIT") committed.add(r[1]); }
    const losers = [...begun].filter((t) => !committed.has(t));
    const db = { ...INITIAL };
    steps = [{ lsn: null, db: { ...db }, text: `Crash after LSN ${crash}. No data page was flushed, so disk still holds A 100, B 200, C 10; the log survived.` }];
    steps.push({ lsn: null, db: { ...db }, text: `Analysis: scan the log. Committed (winners): ${[...committed].join(", ") || "none"}. Begun but not committed (losers): ${losers.join(", ") || "none"}.` });
    log.forEach((r, i) => {
      if (r[0] !== "UPDATE") return;
      db[r[2]] = r[4];
      steps.push({ lsn: i + 1, db: { ...db }, text: `Redo LSN ${i + 1}: ${r[1]} sets ${r[2]} to ${r[4]}. Redo repeats history, losers included.` });
    });
    for (let i = log.length - 1; i >= 0; i--) {
      const r = log[i];
      if (r[0] !== "UPDATE" || !losers.includes(r[1])) continue;
      db[r[2]] = r[3];
      steps.push({ lsn: i + 1, db: { ...db }, text: `Undo LSN ${i + 1}: ${r[1]} is a loser, so ${r[2]} goes back to ${r[3]}. Undo runs backwards.` });
    }
    // The answer recovery must reach: only the winners' updates, in log order.
    const expect = { ...INITIAL };
    for (const r of log) if (r[0] === "UPDATE" && committed.has(r[1])) expect[r[2]] = r[4];
    const ok = ["A", "B", "C"].every((k) => db[k] === expect[k]);
    steps.push({ lsn: null, db: { ...db }, text: `Recovered: A ${db.A}, B ${db.B}, C ${db.C}. ${ok ? "Exactly the committed transactions survive, and nothing else: atomicity and durability." : "Mismatch!"}` });
    o.win.textContent = [...committed].join(", ") || "—";
    o.lose.textContent = losers.join(", ") || "—";
    o.expect.textContent = `A ${expect.A} · B ${expect.B} · C ${expect.C}`;
    at = 0;
    draw();
  }
  function draw() {
    const st = steps[at];
    recs.forEach((b, i) => { b.toggleAttribute("data-gone", i + 1 > crash); b.toggleAttribute("data-cur", st.lsn === i + 1); });
    recs[crash - 1].parentElement.after(crashLine);
    for (const k of ["A", "B", "C"]) vals[k].textContent = st.db[k];
    phase.textContent = st.text;
    root.querySelector("[data-action=back]").disabled = at === 0;
    root.querySelector("[data-action=next]").disabled = at === steps.length - 1;
  }
  recs.forEach((b) => b.addEventListener("click", () => { crash = Number(b.dataset.lsn); plan(); }));
  root.querySelector("[data-action=next]").addEventListener("click", () => { at = Math.min(steps.length - 1, at + 1); draw(); });
  root.querySelector("[data-action=back]").addEventListener("click", () => { at = Math.max(0, at - 1); draw(); });
  plan();
}

// ============================================================ Join order

for (const root of document.querySelectorAll("[data-db-opt]")) {
  const bars = root.querySelector("[data-svg=bars]"), planSvg = root.querySelector("[data-svg=plan]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const fmtRows = (v) => (v >= 1e6 ? v.toExponential(1).replace("e+", "e") : Math.round(v).toLocaleString("en"));

  function draw() {
    const card = { R: s.r.get() * 1000 * s.fx.get(), S: s.s.get() * 1000, T: s.t.get() * 1000 };
    const sel = { RS: s.rs.get(), ST: s.st.get() };
    // Selectivity between a set of tables and one more: product of the
    // predicates that connect them; none means a cross product.
    const link = (set, x) => {
      let f = 1;
      for (const y of set) { const k = [x, y].sort().join(""); if (sel[k] !== undefined) f *= sel[k]; }
      return f;
    };
    const connected = (set, x) => set.some((y) => sel[[x, y].sort().join("")] !== undefined);
    const perms = [["R", "S", "T"], ["S", "R", "T"], ["S", "T", "R"], ["T", "S", "R"], ["R", "T", "S"], ["T", "R", "S"]];
    const plans = perms.map(([a, b, c]) => {
      const j1 = card[a] * card[b] * link([a], b);
      const j2 = j1 * card[c] * link([a, b], c);
      return { order: [a, b, c], j1, j2, cost: j1 + j2, cross: !connected([a], b) || !connected([a, b], c) };
    }).sort((x, y) => x.cost - y.cost);
    bars.replaceChildren();
    const lo = Math.floor(Math.log10(Math.max(1, plans[0].cost))), hi = Math.ceil(Math.log10(plans.at(-1).cost) + 0.01);
    const fr = frame(bars, { box: [118, 10, 460, 216], x: [lo, Math.max(hi, lo + 1)], y: [0, 6], xticks: Array.from({ length: Math.max(hi, lo + 1) - lo + 1 }, (_, i) => lo + i), yticks: [], xfmt: (v) => `10^${v}`, xlabel: "cost (sum of intermediate rows)" });
    plans.forEach((p, i) => {
      const y = fr.T + i * 36 + 6, best = i === 0;
      el("rect", { x: fr.L, y, width: Math.max(2, fr.sx(Math.log10(Math.max(1, p.cost))) - fr.L), height: 22, rx: 3, style: `fill:${best ? "var(--brand)" : "currentColor"};fill-opacity:${best ? 0.75 : 0.18}` }, bars);
      text(bars, fr.L - 8, y + 15, `(${p.order[0]} ⋈ ${p.order[1]}) ⋈ ${p.order[2]}`, { "text-anchor": "end", class: `font-mono text-[11px] ${best ? "fill-foreground" : "fill-muted-foreground"}` });
      text(bars, fr.L + 6, y + 15, `${fmtRows(p.cost)}${p.cross ? "  · cross product" : ""}`, { class: "font-mono text-[10px] fill-foreground" });
    });
    // The best plan as a tree.
    const b = plans[0];
    planSvg.replaceChildren();
    const nodes = [
      { x: 300, y: 22, label: `⋈  ${fmtRows(b.j2)} rows` },
      { x: 190, y: 72, label: `⋈  ${fmtRows(b.j1)} rows` },
      { x: 410, y: 72, label: `${b.order[2]}  ${fmtRows(card[b.order[2]])}` },
      { x: 120, y: 122, label: `${b.order[0]}  ${fmtRows(card[b.order[0]])}` },
      { x: 260, y: 122, label: `${b.order[1]}  ${fmtRows(card[b.order[1]])}` },
    ];
    [[0, 1], [0, 2], [1, 3], [1, 4]].forEach(([a, c]) => el("line", { x1: nodes[a].x, y1: nodes[a].y + 10, x2: nodes[c].x, y2: nodes[c].y - 12, style: "stroke:currentColor;stroke-opacity:0.35" }, planSvg));
    for (const n of nodes) {
      el("rect", { x: n.x - 62, y: n.y - 12, width: 124, height: 22, rx: 5, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.3" }, planSvg);
      text(planSvg, n.x, n.y + 3, n.label, { "text-anchor": "middle", class: "font-mono text-[10px] fill-foreground" });
    }
    text(planSvg, 8, 14, "best plan (R after its filter)", {});
    o.best.textContent = `${b.order.join(" → ")} · ${fmtRows(b.cost)}`;
    o.worst.textContent = `${plans.at(-1).order.join(" → ")} · ${fmtRows(plans.at(-1).cost)}`;
    o.ratio.textContent = `${fmtRows(plans.at(-1).cost / b.cost)}×`;
  }
  draw();
}

// ============================================================ ER diagram

for (const root of document.querySelectorAll("[data-db-er]")) {
  const svg = root.querySelector("[data-svg=er]");
  const ddl = root.querySelector("[data-ddl]");
  const ENT = {
    Student: { x: 30, y: 30, attrs: ["id", "name", "year"] },
    Course: { x: 440, y: 30, attrs: ["id", "title", "credits"] },
    Professor: { x: 440, y: 205, attrs: ["id", "name"] },
    Department: { x: 30, y: 205, attrs: ["id", "name"] },
  };
  const W = 160, ROW = 18;
  const REL = {
    enrolls: { name: "enrolls in", l: "Student", r: "Course", card: "M:N", lopt: true, ropt: true, attr: "grade" },
    teaches: { name: "teaches", l: "Professor", r: "Course", card: "1:N", lopt: true, ropt: false },
    belongs: { name: "works in", l: "Professor", r: "Department", card: "N:1", lopt: false, ropt: true },
  };
  let cur = "enrolls";
  const boxH = (e) => 26 + ENT[e].attrs.length * ROW + 6;
  const anchor = (e, side) => {
    const b = ENT[e];
    if (side === "right") return [b.x + W, b.y + boxH(e) / 2];
    if (side === "left") return [b.x, b.y + boxH(e) / 2];
    if (side === "top") return [b.x + W / 2, b.y];
    return [b.x + W / 2, b.y + boxH(e)];
  };
  // Crow's-foot end: max marker (bar or crow's foot) next to the entity,
  // min marker (circle for zero, bar for one) further along the line.
  function endMarks(p, dir, many, optional, color) {
    const [x, y] = p, [dx, dy] = dir, nx = -dy, ny = dx;
    const at = (d, s) => [x + dx * d + nx * s, y + dy * d + ny * s];
    const ln = (a, b) => el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], style: `stroke:${color};stroke-width:1.6` }, svg);
    if (many) { ln(at(0, -8), at(12, 0)); ln(at(0, 8), at(12, 0)); ln(at(0, 0), at(12, 0)); }
    else ln(at(8, -7), at(8, 7));
    if (optional) { const c = at(21, 0); el("circle", { cx: c[0], cy: c[1], r: 4.5, style: `fill:var(--code-bg);stroke:${color};stroke-width:1.6` }, svg); }
    else ln(at(19, -7), at(19, 7));
  }
  const ROUTE = { enrolls: ["right", "left"], teaches: ["top", "bottom"], belongs: ["left", "right"] };
  function draw() {
    svg.replaceChildren();
    for (const [key, r] of Object.entries(REL)) {
      const [sl, sr] = ROUTE[key];
      const a = anchor(r.l, sl), b = anchor(r.r, sr);
      const on = key === cur, color = on ? "var(--brand)" : "currentColor";
      el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], style: `stroke:${color};stroke-opacity:${on ? 1 : 0.55};stroke-width:${on ? 1.6 : 1.2}` }, svg);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      const [L, R] = r.card.split(":");
      // At the right end: how many right entities per left entity.
      endMarks(b, [-ux, -uy], R !== "1", r.lopt, on ? "var(--brand)" : "currentColor");
      endMarks(a, [ux, uy], L !== "1", r.ropt, on ? "var(--brand)" : "currentColor");
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const label = r.name + (r.attr ? ` (${r.attr})` : "");
      el("rect", { x: mx - label.length * 3.4 - 8, y: my - 10, width: label.length * 6.8 + 16, height: 20, rx: 10, style: `fill:var(--code-bg);stroke:${color};stroke-opacity:${on ? 1 : 0.3}` }, svg);
      text(svg, mx, my + 4, label, { "text-anchor": "middle", class: `font-mono text-[10px] ${on ? "fill-foreground" : "fill-muted-foreground"}` });
    }
    for (const [name, b] of Object.entries(ENT)) {
      el("rect", { x: b.x, y: b.y, width: W, height: boxH(name), rx: 6, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.4" }, svg);
      el("line", { x1: b.x, y1: b.y + 24, x2: b.x + W, y2: b.y + 24, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
      text(svg, b.x + 10, b.y + 16, name, { class: "text-[12px] font-medium fill-foreground" });
      b.attrs.forEach((a, i) => {
        const t = text(svg, b.x + 10, b.y + 40 + i * ROW, a + (a === "id" ? "  PK" : ""), { class: "font-mono text-[11px] fill-muted-foreground" });
        if (a === "id") t.setAttribute("text-decoration", "underline");
      });
    }
    ddl.textContent = schema();
  }
  // Relational mapping of the whole diagram.
  function schema() {
    const cols = Object.fromEntries(Object.entries(ENT).map(([n, e]) => [n, e.attrs.map((a) => (a === "id" ? "id INTEGER PRIMARY KEY" : `${a} TEXT`))]));
    const extra = [];
    const notes = [];
    const fk = (on, to, mandatory, unique) => cols[on].push(`${to.toLowerCase()}_id INTEGER${mandatory ? " NOT NULL" : ""}${unique ? " UNIQUE" : ""} REFERENCES ${to.toLowerCase()}(id)`);
    for (const r of Object.values(REL)) {
      if (r.card === "1:N") fk(r.r, r.l, !r.ropt, false);
      else if (r.card === "N:1") fk(r.l, r.r, !r.lopt, false);
      else if (r.card === "1:1") fk(r.r, r.l, !r.ropt, true);
      else {
        const t = `${r.l.toLowerCase()}_${r.r.toLowerCase()}`;
        extra.push(`CREATE TABLE ${t} (\n  ${r.l.toLowerCase()}_id INTEGER REFERENCES ${r.l.toLowerCase()}(id),\n  ${r.r.toLowerCase()}_id INTEGER REFERENCES ${r.r.toLowerCase()}(id),${r.attr ? `\n  ${r.attr} INTEGER,` : ""}\n  PRIMARY KEY (${r.l.toLowerCase()}_id, ${r.r.toLowerCase()}_id)\n);`);
        if (!r.lopt || !r.ropt) notes.push(`-- "${r.name}": mandatory participation in M:N can't be enforced by foreign keys alone.`);
      }
    }
    const tables = Object.entries(cols).map(([n, c]) => `CREATE TABLE ${n.toLowerCase()} (\n  ${c.join(",\n  ")}\n);`);
    return [...tables, ...extra, ...notes].join("\n");
  }
  function syncControls() {
    const r = REL[cur];
    setSeg(root, "Cardinality", r.card);
    setSeg(root, "Left participation", r.lopt ? "optional" : "mandatory");
    setSeg(root, "Right participation", r.ropt ? "optional" : "mandatory");
  }
  onSeg(root, (label, v) => {
    if (label === "Relationship") { cur = v; syncControls(); }
    else if (label === "Cardinality") REL[cur].card = v;
    else if (label === "Left participation") REL[cur].lopt = v === "optional";
    else if (label === "Right participation") REL[cur].ropt = v === "optional";
    draw();
  });
  syncControls();
  draw();
}

// ============================================================ Quorums

const choose = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

for (const root of document.querySelectorAll("[data-db-quorum]")) {
  const svg = root.querySelector("[data-svg=ring]");
  const o = outs(root);
  const rng = mulberry32(11);
  const pick = (n, k) => { const ids = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } return new Set(ids.slice(0, k)); };
  let version = 1, reps = [], wrote = new Set(), readSet = new Set(), lastRead = null;
  const s = scrubAll(root, () => { clamp(); reset(); });
  const N = () => Math.round(s.n.get()), Wq = () => Math.round(s.w.get()), Rq = () => Math.round(s.r.get());
  function clamp() {
    if (s.w.get() > N()) s.w.set(N(), false);
    if (s.r.get() > N()) s.r.set(N(), false);
  }
  function reset() { version = 1; reps = Array(N()).fill(1); wrote = new Set(); readSet = new Set(); lastRead = null; o.sim.textContent = "—"; draw(); }
  function draw() {
    const n = N(), w = Wq(), r = Rq();
    svg.replaceChildren();
    const cx = 300, cy = 140, R = 100;
    el("circle", { cx, cy, r: 24, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.4" }, svg);
    text(svg, cx, cy + 3, "client", { "text-anchor": "middle", class: "font-mono text-[9px] fill-muted-foreground" });
    reps.forEach((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const fresh = v === version, inW = wrote.has(i), inR = readSet.has(i);
      if (inW) el("line", { x1: cx, y1: cy, x2: x, y2: y, style: "stroke:var(--brand);stroke-opacity:0.6;stroke-width:1.5" }, svg);
      if (inR) el("line", { x1: cx, y1: cy, x2: x, y2: y, style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 3" }, svg);
      el("circle", { cx: x, cy: y, r: 22, style: `fill:${fresh ? "var(--brand)" : "var(--background)"};fill-opacity:${fresh ? 0.16 : 1};stroke:${fresh ? "var(--brand)" : "currentColor"};stroke-opacity:${fresh ? 1 : 0.4}` }, svg);
      if (inR) el("circle", { cx: x, cy: y, r: 27, style: "fill:none;stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:3 3" }, svg);
      text(svg, x, y - 2, `v${v}`, { "text-anchor": "middle", class: "font-mono text-[11px] fill-foreground" });
      text(svg, x, y + 10, `#${i + 1}`, { "text-anchor": "middle", class: "font-mono text-[9px] fill-muted-foreground" });
    });
    text(svg, 12, 18, `latest version v${version}`, { class: "font-mono text-[10px] fill-foreground" });
    text(svg, 12, 268, "■ has the latest write   ┄ asked by the last read", { class: "font-mono text-[10px] fill-muted-foreground" });
    const exact = choose(n - w, r) / choose(n, r);
    o.overlap.textContent = r + w > n ? `${r} + ${w} > ${n}: yes` : `${r} + ${w} ≤ ${n}: no`;
    o.overlap.className = `tabular-nums ${r + w > n ? "text-add" : "text-del"}`;
    o.exact.textContent = `${num(exact * 100, 2)}%`;
    o.last.textContent = lastRead === null ? "—" : lastRead === version ? `v${lastRead} (fresh)` : `v${lastRead} (stale)`;
  }
  root.querySelector("[data-action=write]").addEventListener("click", () => {
    version++;
    wrote = pick(N(), Wq());
    for (const i of wrote) reps[i] = version;
    readSet = new Set();
    draw();
  });
  root.querySelector("[data-action=read]").addEventListener("click", () => {
    readSet = pick(N(), Rq());
    lastRead = Math.max(...[...readSet].map((i) => reps[i]));
    draw();
  });
  root.querySelector("[data-action=sync]").addEventListener("click", () => { reps = reps.map(() => version); draw(); });
  root.querySelector("[data-action=many]").addEventListener("click", () => {
    // Each trial: a fresh write to W random replicas (the rest lag), then a
    // read from R random replicas.
    let stale = 0;
    for (let k = 0; k < 1000; k++) {
      const w = pick(N(), Wq()), r = pick(N(), Rq());
      if (![...r].some((i) => w.has(i))) stale++;
    }
    o.sim.textContent = `${num(stale / 10, 1)}% of 1000`;
  });
  clamp();
  reset();
}
