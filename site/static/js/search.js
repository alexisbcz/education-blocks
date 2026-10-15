// The search and information retrieval blocks. Everything runs on the
// forty notes in search-corpus.js: an inverted index, Boolean merges with
// skip pointers, tf-idf and BM25 rankings, evaluation metrics, PageRank,
// edit distance, a trie, a Bloom filter and random-hyperplane LSH.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { DOCS, tokenize, isStop, stem, analyse, docText, buildIndex, queryTerms, highlight } from "./search-corpus.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onSeg = (root, fn) => root.querySelectorAll("[role=tablist]").forEach((t) => t.addEventListener("seg-change", (e) => fn(e.detail.value, t)));
const tag = (name, cls, txt) => {
  const e = document.createElement(name);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
const SERIES = ["var(--vec-i)", "var(--vec-j)", "var(--vec-u)", "var(--vec-v)", "var(--vec-out)", "var(--brand)"];
const input = (root, name) => root.querySelector(`[data-input="${name}"]`);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT = { stop: true, stem: true };
let shared = null;
const index = () => (shared ??= buildIndex(DOCS, DEFAULT));

// A result row: rank, title, highlighted text and an optional right column.
function resultRow(rank, d, terms, right) {
  const li = tag("li", "flex gap-3 px-3 py-2");
  li.append(tag("span", "w-5 shrink-0 pt-0.5 text-right font-mono text-[11px] text-muted-foreground tabular-nums", String(rank)));
  const body = tag("div", "flex min-w-0 flex-1 flex-col gap-0.5");
  body.append(tag("span", "text-sm font-medium", d.title));
  const p = tag("p", "text-xs leading-relaxed text-muted-foreground");
  highlight(p, d.text, terms);
  body.append(p);
  li.append(body);
  if (right) li.append(right);
  return li;
}

const emptyRow = (msg) => tag("li", "px-3 py-3 text-sm text-muted-foreground", msg);

// ============================================================ inverted index

function initIndex(root) {
  const o = outs(root);
  const opts = { stop: true, stem: true };
  let doc = 0, idx = buildIndex(DOCS, opts);
  const tokensEl = root.querySelector("[data-tokens]");
  const postEl = root.querySelector("[data-postings]");
  const termIn = input(root, "term");

  const drawDoc = () => {
    const d = DOCS[doc];
    o.doctitle.textContent = `${doc + 1} / ${DOCS.length} · ${d.title}`;
    tokensEl.replaceChildren();
    for (const t of tokenize(docText(d))) {
      const stopped = opts.stop && isStop(t.word);
      const term = opts.stem ? stem(t.word) : t.word;
      const chip = tag("span", "rounded-[4px] border px-1.5 py-0.5 " + (stopped ? "border-dashed text-muted-foreground/60 line-through" : "bg-muted/40"));
      chip.textContent = stopped || term === t.word ? t.word : `${t.word} → ${term}`;
      if (stopped) chip.title = "stopword";
      tokensEl.append(chip);
    }
  };

  const drawPostings = () => {
    postEl.replaceChildren();
    const q = analyse(termIn.value, opts);
    if (!q.length) {
      postEl.append(tag("span", "text-muted-foreground", termIn.value.trim() ? "That word is a stopword, so it is not indexed." : "Type a word."));
      return;
    }
    for (const { term } of q.slice(0, 3)) {
      const list = idx.index.get(term) ?? [];
      postEl.append(tag("span", "text-foreground", `${term}  df ${list.length}`));
      if (!list.length) postEl.append(tag("span", "pl-3 text-muted-foreground", "not in the vocabulary"));
      for (const p of list) {
        const b = tag("button", "rounded-sm pl-3 text-left text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50");
        b.type = "button";
        b.textContent = `doc ${String(p.doc + 1).padStart(2)} · tf ${p.tf} · @ ${p.positions.join(", ")}   ${DOCS[p.doc].title}`;
        b.addEventListener("click", () => { doc = p.doc; drawDoc(); });
        postEl.append(b);
      }
    }
  };

  const stats = () => {
    let ntok = 0;
    for (const d of DOCS) ntok += tokenize(docText(d)).length;
    const nkept = idx.lengths.reduce((a, b) => a + b, 0);
    let npost = 0;
    for (const l of idx.index.values()) npost += l.length;
    o.ndocs.textContent = DOCS.length;
    o.ntok.textContent = ntok;
    o.nkept.textContent = nkept;
    o.vocab.textContent = idx.index.size;
    o.npost.textContent = npost;
    o.ratio.textContent = `${Math.round((100 * npost) / ntok)}% entries`;
  };

  const all = () => { idx = buildIndex(DOCS, opts); drawDoc(); drawPostings(); stats(); };
  onToggle(root, (name, on) => { opts[name] = on; all(); });
  root.querySelector('[data-action="prev"]').addEventListener("click", () => { doc = (doc + DOCS.length - 1) % DOCS.length; drawDoc(); });
  root.querySelector('[data-action="next"]').addEventListener("click", () => { doc = (doc + 1) % DOCS.length; drawDoc(); });
  termIn.addEventListener("input", drawPostings);
  all();
}

// ============================================================ Boolean queries

function lexQuery(q) {
  return [...q.matchAll(/\(|\)|"[^"]*"?|[^\s()"]+/g)].map((m) => m[0]);
}

// Recursive descent: or := and (OR and)* ; and := unary (AND? unary)* ;
// unary := NOT unary | ( or ) | "phrase" | term.
function parseQuery(q) {
  const toks = lexQuery(q);
  let i = 0;
  const peek = () => toks[i];
  const parseOr = () => {
    let n = parseAnd();
    while (peek() === "OR") { i++; n = { op: "OR", a: n, b: parseAnd() }; }
    return n;
  };
  const parseAnd = () => {
    let n = parseUnary();
    while (peek() !== undefined && peek() !== "OR" && peek() !== ")") {
      if (peek() === "AND") i++;
      n = { op: "AND", a: n, b: parseUnary() };
    }
    return n;
  };
  const parseUnary = () => {
    const t = toks[i++];
    if (t === undefined) throw new Error("the query ends too early");
    if (t === "NOT") return { op: "NOT", a: parseUnary() };
    if (t === "(") {
      const n = parseOr();
      if (toks[i++] !== ")") throw new Error("a bracket is not closed");
      return n;
    }
    if (t === ")" || t === "AND" || t === "OR") throw new Error(`unexpected ${t}`);
    if (t.startsWith('"')) {
      const words = analyse(t.replace(/"/g, ""), DEFAULT);
      if (!words.length) throw new Error("the phrase has only stopwords");
      return words.length === 1 ? { term: words[0].term } : { phrase: words };
    }
    const terms = analyse(t, DEFAULT);
    if (!terms.length) return { stop: t };
    return { term: terms[0].term };
  };
  const tree = parseOr();
  if (i < toks.length) throw new Error(`unexpected ${toks[i]}`);
  return tree;
}

const showTree = (n) =>
  n.term ? n.term : n.stop ? `(${n.stop}: stopword)` : n.phrase ? `"${n.phrase.map((w) => w.term).join(" ")}"` :
  n.op === "NOT" ? `NOT ${showTree(n.a)}` : `(${showTree(n.a)} ${n.op} ${showTree(n.b)})`;

const positiveTerms = (n, out = []) => {
  if (n.term) out.push(n.term);
  else if (n.phrase) out.push(...n.phrase.map((w) => w.term));
  else if (n.op && n.op !== "NOT") { positiveTerms(n.a, out); positiveTerms(n.b, out); }
  return out;
};

/** Intersects sorted lists, counting comparisons; with skips every √n. */
export function intersect(a, b, skips) {
  const sa = Math.floor(Math.sqrt(a.length)), sb = Math.floor(Math.sqrt(b.length));
  const out = [];
  let i = 0, j = 0, cmp = 0, jumps = 0;
  while (i < a.length && j < b.length) {
    cmp++;
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; continue; }
    if (a[i] < b[j]) {
      if (skips && sa > 1 && i % sa === 0 && i + sa < a.length) {
        cmp++;
        if (a[i + sa] <= b[j]) { i += sa; jumps++; continue; }
      }
      i++;
    } else {
      if (skips && sb > 1 && j % sb === 0 && j + sb < b.length) {
        cmp++;
        if (b[j + sb] <= a[i]) { j += sb; jumps++; continue; }
      }
      j++;
    }
  }
  return { out, cmp, jumps };
}

function union(a, b) {
  const out = [];
  let i = 0, j = 0, cmp = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] < b[j])) { out.push(a[i++]); if (j < b.length) cmp++; }
    else if (i >= a.length || b[j] < a[i]) { out.push(b[j++]); if (i < a.length) cmp++; }
    else { out.push(a[i]); i++; j++; cmp++; }
  }
  return { out, cmp };
}

function andNot(a, b) {
  const out = [];
  let i = 0, j = 0, cmp = 0;
  while (i < a.length) {
    if (j >= b.length) { out.push(a[i++]); continue; }
    cmp++;
    if (a[i] === b[j]) { i++; j++; }
    else if (a[i] < b[j]) out.push(a[i++]);
    else j++;
  }
  return { out, cmp };
}

function evalQuery(n, idx, skips, trace) {
  const docsOf = (t) => (idx.index.get(t) ?? []).map((p) => p.doc);
  if (n.stop) return { docs: null, label: n.stop };
  if (n.term) return { docs: docsOf(n.term), label: n.term };
  if (n.phrase) {
    const lists = n.phrase.map((w) => idx.index.get(w.term) ?? []);
    let docs = lists[0].map((p) => p.doc);
    for (const l of lists.slice(1)) docs = intersect(docs, l.map((p) => p.doc), false).out;
    const off = n.phrase.map((w) => w.pos - n.phrase[0].pos);
    const hits = docs.filter((d) => {
      const pos = lists.map((l) => new Set(l.find((p) => p.doc === d).positions));
      return [...pos[0]].some((p0) => off.every((k, x) => pos[x].has(p0 + k)));
    });
    const label = `"${n.phrase.map((w) => w.term).join(" ")}"`;
    trace.push({ op: "PHRASE", label, na: docs.length, nb: hits.length, cmp: 0, plain: 0, jumps: 0, n: hits.length, docs: hits });
    return { docs: hits, label };
  }
  if (n.op === "NOT") {
    const a = evalQuery(n.a, idx, skips, trace);
    const all = DOCS.map((_, i) => i);
    const out = a.docs ? andNot(all, a.docs).out : all;
    return { docs: out, label: `NOT ${a.label}`, neg: a };
  }
  if (n.op === "AND" && n.b.op === "NOT") {
    const a = evalQuery(n.a, idx, skips, trace), b = evalQuery(n.b.a, idx, skips, trace);
    if (!a.docs) return b.docs ? { docs: andNot(DOCS.map((_, i) => i), b.docs).out, label: `NOT ${b.label}` } : a;
    if (!b.docs) return a;
    const r = andNot(a.docs, b.docs);
    trace.push({ op: "AND NOT", label: `${a.label} AND NOT ${b.label}`, na: a.docs.length, nb: b.docs.length, cmp: r.cmp, plain: r.cmp, jumps: 0, n: r.out.length, docs: r.out });
    return { docs: r.out, label: `(${a.label} AND NOT ${b.label})` };
  }
  const a = evalQuery(n.a, idx, skips, trace), b = evalQuery(n.b, idx, skips, trace);
  if (!a.docs) return b;
  if (!b.docs) return a;
  if (n.op === "AND") {
    const r = intersect(a.docs, b.docs, skips), plain = intersect(a.docs, b.docs, false);
    trace.push({ op: "AND", label: `${a.label} AND ${b.label}`, na: a.docs.length, nb: b.docs.length, cmp: r.cmp, plain: plain.cmp, jumps: r.jumps, n: r.out.length, docs: r.out });
    return { docs: r.out, label: `(${a.label} AND ${b.label})` };
  }
  const r = union(a.docs, b.docs);
  trace.push({ op: "OR", label: `${a.label} OR ${b.label}`, na: a.docs.length, nb: b.docs.length, cmp: r.cmp, plain: r.cmp, jumps: 0, n: r.out.length, docs: r.out });
  return { docs: r.out, label: `(${a.label} OR ${b.label})` };
}

function initBoolean(root) {
  const o = outs(root);
  const q = input(root, "query");
  const parsed = root.querySelector("[data-parsed]");
  const traceEl = root.querySelector("[data-trace]");
  const results = root.querySelector("[data-results]");
  let skips = true;

  const run = () => {
    traceEl.replaceChildren();
    results.replaceChildren();
    let tree;
    try {
      tree = parseQuery(q.value);
    } catch (e) {
      parsed.textContent = `Can't read the query: ${e.message}.`;
      for (const k of ["nmatch", "cmp", "cmpplain", "skips"]) o[k].textContent = "—";
      return;
    }
    parsed.textContent = `parsed: ${showTree(tree)}`;
    const trace = [];
    const r = evalQuery(tree, index(), skips, trace);
    const docs = r.docs ?? [];
    for (const t of trace) {
      const row = tag("div", "flex flex-col gap-0.5 rounded-md border bg-background px-3 py-2");
      row.append(tag("span", "text-foreground", t.label));
      const detail = t.op === "PHRASE"
        ? `${t.na} docs have every word · ${t.n} have them in order`
        : `${t.na} ∘ ${t.nb} → ${t.n} docs · ${t.cmp} comparisons` + (t.op === "AND" && skips ? ` (${t.plain} without skips, ${t.jumps} skips)` : "");
      row.append(tag("span", "text-muted-foreground", detail));
      traceEl.append(row);
    }
    if (!trace.length) traceEl.append(tag("span", "text-muted-foreground", r.docs ? `One postings list, read as is: ${docs.length} docs.` : "Only stopwords: nothing to look up."));
    const terms = positiveTerms(tree);
    docs.slice(0, 12).forEach((d, i) => results.append(resultRow(i + 1, DOCS[d], terms)));
    if (docs.length > 12) results.append(emptyRow(`… and ${docs.length - 12} more`));
    if (!docs.length) results.append(emptyRow("No document matches."));
    const sum = (k) => trace.reduce((s, t) => s + t[k], 0);
    o.nmatch.textContent = docs.length;
    o.cmp.textContent = sum("cmp");
    o.cmpplain.textContent = sum("plain");
    o.skips.textContent = sum("jumps");
  };

  q.addEventListener("input", run);
  root.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => { q.value = b.dataset.example; run(); }));
  onToggle(root, (_, on) => { skips = on; run(); });
  run();
}

// ============================================================ TF-IDF

function initTfidf(root) {
  const o = outs(root);
  const q = input(root, "query");
  const termsEl = root.querySelector("[data-terms]");
  const results = root.querySelector("[data-results]");
  let tfMode = "log", useIdf = true;
  const idx = index();
  const tfw = (tf) => (tf <= 0 ? 0 : tfMode === "log" ? 1 + Math.log10(tf) : tfMode === "raw" ? tf : 1);
  const idf = (t) => {
    const df = idx.index.get(t)?.length ?? 0;
    return df ? (useIdf ? Math.log10(idx.N / df) : 1) : 0;
  };

  const run = () => {
    // Document vectors, normalised.
    const docW = DOCS.map(() => new Map());
    for (const [t, list] of idx.index) {
      const w = idf(t);
      for (const p of list) docW[p.doc].set(t, tfw(p.tf) * w);
    }
    const norms = docW.map((m) => Math.hypot(...m.values()) || 1);
    const qTerms = analyse(q.value, DEFAULT).map((t) => t.term);
    const qtf = new Map();
    for (const t of qTerms) qtf.set(t, (qtf.get(t) ?? 0) + 1);
    const qw = new Map([...qtf].map(([t, tf]) => [t, tfw(tf) * idf(t)]));
    const qn = Math.hypot(...qw.values()) || 1;
    const terms = [...qw.keys()];

    termsEl.replaceChildren();
    terms.forEach((t, i) => {
      const df = idx.index.get(t)?.length ?? 0;
      const chip = tag("span", "flex items-center gap-1.5 rounded-[4px] border px-1.5 py-0.5");
      const sw = tag("span", "size-2 rounded-full");
      sw.style.background = SERIES[i % SERIES.length];
      chip.append(sw, `${t} · df ${df} · idf ${df ? num(Math.log10(idx.N / df), 2) : "—"}`);
      termsEl.append(chip);
    });

    const scored = DOCS.map((d, i) => {
      const parts = terms.map((t) => ((qw.get(t) ?? 0) * (docW[i].get(t) ?? 0)) / (qn * norms[i]));
      return { i, parts, score: parts.reduce((a, b) => a + b, 0) };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

    results.replaceChildren();
    const top = scored[0]?.score || 1;
    scored.slice(0, 8).forEach((s, r) => {
      const right = tag("div", "flex w-28 shrink-0 flex-col items-end gap-1 pt-0.5");
      right.append(tag("span", "font-mono text-[11px] tabular-nums", num(s.score, 3)));
      const bar = tag("div", "flex h-2 w-full overflow-hidden rounded-full bg-muted");
      s.parts.forEach((p, k) => {
        const seg = tag("div", "h-full");
        seg.style.width = `${(100 * p) / top}%`;
        seg.style.background = SERIES[k % SERIES.length];
        bar.append(seg);
      });
      right.append(bar);
      results.append(resultRow(r + 1, DOCS[s.i], terms, right));
    });
    if (!scored.length) results.append(emptyRow(terms.length ? "No document contains these terms." : "Type a query."));
    o.ndocs.textContent = idx.N;
    o.nmatch.textContent = scored.length;
    o.top.textContent = scored.length ? `${num(scored[0].score, 3)} · ${DOCS[scored[0].i].title}` : "—";
  };

  q.addEventListener("input", run);
  onSeg(root, (v) => { tfMode = v; run(); });
  onToggle(root, (_, on) => { useIdf = on; run(); });
  run();
}

// ============================================================ BM25

/** BM25 scores of every document for the query terms. */
export function bm25(idx, terms, k1, b) {
  const scores = new Array(idx.N).fill(0);
  for (const t of terms) {
    const list = idx.index.get(t);
    if (!list) continue;
    const n = list.length;
    const idf = Math.log(1 + (idx.N - n + 0.5) / (n + 0.5));
    for (const p of list) {
      const dl = idx.lengths[p.doc];
      scores[p.doc] += (idf * p.tf * (k1 + 1)) / (p.tf + k1 * (1 - b + (b * dl) / idx.avgdl));
    }
  }
  return scores;
}

const rankOf = (scores) => scores.map((s, i) => ({ s, i })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);

function initBm25(root) {
  const o = outs(root);
  const q = input(root, "query");
  const svg = root.querySelector("[data-plot]");
  const results = root.querySelector("[data-results]");
  const idx = index();
  const f = scrubAll(root, () => run());

  const run = () => {
    const k1 = f.k1.get(), b = f.b.get();
    const terms = queryTerms(q.value, DEFAULT);
    const ranked = rankOf(bm25(idx, terms, k1, b));
    const base = new Map(rankOf(bm25(idx, terms, 1.2, 0.75)).map((x, r) => [x.i, r]));

    // Saturation curves of the tf part, for a term in a short, average and long document.
    svg.replaceChildren();
    const ymax = Math.max(2.5, Math.ceil((k1 + 1) * 2) / 2 + 0.5);
    const fr = frame(svg, { box: [36, 14, 510, 156], x: [0, 12], y: [0, ymax], xticks: [0, 2, 4, 6, 8, 10, 12], yticks: [0, 1, 2, 3, 4].filter((v) => v <= ymax), xlabel: "tf in the document", ylabel: "contribution / idf" });
    const xs = Array.from({ length: 121 }, (_, i) => i / 10);
    polyline(svg, xs.filter((x) => x <= ymax).map((x) => [fr.sx(x), fr.sy(x)]), "stroke:var(--muted-foreground);stroke-width:1.25;stroke-dasharray:4 3");
    [[0.5, SERIES[0]], [1, SERIES[1]], [2, SERIES[2]]].forEach(([ratio, color]) => {
      const pts = xs.map((x) => [fr.sx(x), fr.sy((x * (k1 + 1)) / (x + k1 * (1 - b + b * ratio) || 1e-9))]);
      polyline(svg, pts, `stroke:${color};stroke-width:1.75`);
    });
    el("line", { x1: fr.sx(0), x2: fr.sx(12), y1: fr.sy(k1 + 1), y2: fr.sy(k1 + 1), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    text(svg, fr.sx(12) - 2, fr.sy(k1 + 1) - 4, `ceiling k₁ + 1 = ${num(k1 + 1, 2)}`, { "text-anchor": "end" });

    results.replaceChildren();
    let moved = 0;
    ranked.forEach((x, r) => { if (base.get(x.i) !== r) moved++; });
    ranked.slice(0, 8).forEach((x, r) => {
      const right = tag("div", "flex w-24 shrink-0 flex-col items-end gap-0.5 pt-0.5 font-mono text-[11px] tabular-nums");
      right.append(tag("span", "", num(x.s, 3)));
      right.append(tag("span", "text-muted-foreground", `${idx.lengths[x.i]} terms`));
      const was = base.get(x.i);
      if (was !== undefined && was !== r) right.append(tag("span", "text-brand", was > r ? `↑ ${was - r}` : `↓ ${r - was}`));
      results.append(resultRow(r + 1, DOCS[x.i], terms, right));
    });
    if (!ranked.length) results.append(emptyRow(terms.length ? "No document contains these terms." : "Type a query."));
    o.avgdl.textContent = `${num(idx.avgdl, 1)} terms`;
    o.topdoc.textContent = ranked.length ? DOCS[ranked[0].i].title : "—";
    o.moved.textContent = ranked.length ? `${moved} of ${ranked.length}` : "—";
  };

  q.addEventListener("input", run);
  root.querySelector('[data-action="defaults"]').addEventListener("click", () => { f.k1.set(1.2, false); f.b.set(0.75); });
  root.querySelector('[data-action="nolen"]').addEventListener("click", () => f.b.set(0));
  run();
}

// ============================================================ evaluation

/** Ranking metrics from relevance grades in ranked order. */
export function metrics(grades, k, pool) {
  const rel = grades.map((g) => (g > 0 ? 1 : 0));
  const R = Math.max(pool, rel.reduce((a, b) => a + b, 0));
  const hitsAt = (n) => rel.slice(0, n).reduce((a, b) => a + b, 0);
  let ap = 0;
  rel.forEach((r, i) => { if (r) ap += hitsAt(i + 1) / (i + 1); });
  const dcg = (gs) => gs.slice(0, k).reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);
  const ideal = dcg([...grades].sort((a, b) => b - a));
  const first = rel.indexOf(1);
  return {
    pk: hitsAt(k) / k, rk: R ? hitsAt(k) / R : 0, ap: R ? ap / R : 0,
    ndcg: ideal ? dcg(grades) / ideal : 0, rr: first < 0 ? 0 : 1 / (first + 1), R,
    curve: rel.map((_, i) => [R ? hitsAt(i + 1) / R : 0, hitsAt(i + 1) / (i + 1)]),
  };
}

function initEval(root) {
  const o = outs(root);
  const list = root.querySelector("[data-judged]");
  const svg = root.querySelector("[data-plot]");
  const byTitle = (t) => DOCS.findIndex((d) => d.title === t);
  let rows = [
    ["Ocean currents", 3], ["Tides", 2], ["Acids and bases", 0], ["The water cycle", 3], ["Photosynthesis", 1],
    ["Climate", 1], ["Solar wind", 0], ["Plate tectonics", 0], ["Earthquakes", 0], ["Volcanoes", 1],
  ].map(([t, g]) => ({ doc: byTitle(t), g }));
  const rng = mulberry32(7);
  const f = scrubAll(root, () => run());
  const GRADE = ["not relevant", "marginal", "relevant", "highly relevant"];

  const run = () => {
    const k = f.k.get(), pool = f.pool.get();
    const m = metrics(rows.map((r) => r.g), k, pool);
    list.replaceChildren();
    rows.forEach((r, i) => {
      const li = tag("li", "flex items-center gap-3 px-3 py-1.5 " + (i === k - 1 ? "border-b-2 border-b-brand/60" : ""));
      li.append(tag("span", "w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums", String(i + 1)));
      li.append(tag("span", "min-w-0 flex-1 truncate text-sm", DOCS[r.doc].title));
      const b = tag("button", "flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-1 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50");
      b.type = "button";
      b.setAttribute("aria-label", `${DOCS[r.doc].title}: ${GRADE[r.g]}. Change grade`);
      for (let s = 1; s <= 3; s++) {
        const dot = tag("span", "size-2 rounded-full " + (s <= r.g ? "bg-brand" : "bg-muted-foreground/25"));
        b.append(dot);
      }
      b.append(tag("span", "ml-1 w-3 font-mono text-[11px] tabular-nums", String(r.g)));
      b.addEventListener("click", () => { r.g = (r.g + 1) % 4; run(); list.children[i].querySelector("button").focus(); });
      li.append(b);
      list.append(li);
    });

    svg.replaceChildren();
    const fr = frame(svg, { box: [34, 24, 252, 184], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], xfmt: (v) => num(v, 1), yfmt: (v) => num(v, 1), xlabel: "recall", ylabel: "precision" });
    const pts = m.curve.map(([r, p]) => [fr.sx(r), fr.sy(p)]);
    polyline(svg, pts, "stroke:var(--vec-j);stroke-width:1.5");
    m.curve.forEach(([r, p], i) =>
      el("circle", { cx: fr.sx(r), cy: fr.sy(p), r: i === k - 1 ? 4.5 : 2.5, style: i === k - 1 ? "fill:var(--brand)" : "fill:var(--vec-j)" }, svg));
    text(svg, fr.sx(m.curve[k - 1][0]) + 6, fr.sy(m.curve[k - 1][1]) - 8, `k = ${k}`, { class: "fill-foreground font-mono text-[10px]" });

    o.pk.textContent = num(m.pk, 3);
    o.rk.textContent = `${num(m.rk, 3)}  (R = ${m.R})`;
    o.ap.textContent = num(m.ap, 3);
    o.ndcg.textContent = num(m.ndcg, 3);
    o.rr.textContent = num(m.rr, 3);
  };

  root.querySelector('[data-action="ideal"]').addEventListener("click", () => { rows = [...rows].sort((a, b) => b.g - a.g); run(); });
  root.querySelector('[data-action="shuffle"]').addEventListener("click", () => {
    for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    run();
  });
  run();
}

// ============================================================ PageRank

const PR_NODES = "ABCDEFGH".split("");
const PR_POS = [[180, 46], [292, 92], [318, 200], [236, 268], [124, 268], [42, 200], [68, 92], [180, 162]];
const PR_EDGES = [[0, 1], [0, 2], [1, 2], [2, 0], [3, 2], [3, 7], [4, 2], [4, 5], [5, 4], [5, 7], [6, 0], [6, 4], [1, 3]];

/** One power-iteration step with uniform teleport; dangling rank is spread evenly. */
export function prStep(r, out, d) {
  const N = r.length;
  let dangling = 0;
  for (let i = 0; i < N; i++) if (!out[i].length) dangling += r[i];
  const next = new Array(N).fill((1 - d) / N + (d * dangling) / N);
  for (let i = 0; i < N; i++) for (const j of out[i]) next[j] += (d * r[i]) / out[i].length;
  return next;
}

export function prSolve(out, d, tol = 1e-12) {
  let r = new Array(out.length).fill(1 / out.length), it = 0, delta = 1;
  while (delta > tol && it < 1000) {
    const n = prStep(r, out, d);
    delta = n.reduce((s, v, i) => s + Math.abs(v - r[i]), 0);
    r = n; it++;
  }
  return { r, it };
}

function initPagerank(root) {
  const o = outs(root);
  const g = root.querySelector("[data-graph]");
  const bars = root.querySelector("[data-bars]");
  const f = scrubAll(root, () => { reset(); draw(); });
  let edges = PR_EDGES.map((e) => [...e]);
  let r, iter, delta, visits, steps, sel = null;
  const N = PR_NODES.length;
  const outOf = () => PR_NODES.map((_, i) => edges.filter((e) => e[0] === i).map((e) => e[1]));
  const reset = () => { r = new Array(N).fill(1 / N); iter = 0; delta = NaN; visits = new Array(N).fill(0); steps = 0; };

  const draw = () => {
    const out = outOf();
    const exact = prSolve(out, f.d.get()).r;
    g.replaceChildren();
    const defs = el("defs", {}, g);
    const mk = el("marker", { id: "srch-pr-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0 L10 5 L0 10 z", style: "fill:currentColor;fill-opacity:0.55" }, mk);
    const rad = (i) => 11 + 60 * Math.sqrt(r[i]);
    for (const [a, b] of edges) {
      const [x1, y1] = PR_POS[a], [x2, y2] = PR_POS[b];
      const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const both = edges.some((e) => e[0] === b && e[1] === a);
      const off = both ? 5 : 0;
      const px = -uy * off, py = ux * off;
      el("line", {
        x1: x1 + ux * rad(a) + px, y1: y1 + uy * rad(a) + py, x2: x2 - ux * (rad(b) + 2) + px, y2: y2 - uy * (rad(b) + 2) + py,
        "marker-end": "url(#srch-pr-arrow)", style: "stroke:currentColor;stroke-opacity:0.4;stroke-width:1.25",
      }, g);
    }
    PR_NODES.forEach((name, i) => {
      const [x, y] = PR_POS[i];
      const node = el("g", { tabindex: "0", role: "button", "aria-label": `Page ${name}, rank ${num(r[i], 3)}${sel === i ? ", selected" : ""}`, class: "cursor-pointer outline-none" }, g);
      el("circle", { cx: x, cy: y, r: rad(i), style: `fill:color-mix(in oklab, var(--brand) ${Math.round(18 + 140 * r[i])}%, var(--background));stroke:${sel === i ? "var(--brand)" : "currentColor"};stroke-opacity:${sel === i ? 1 : 0.35};stroke-width:${sel === i ? 2.5 : 1}` }, node);
      text(node, x, y + 4, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px] font-medium pointer-events-none" });
      const pick = () => {
        if (sel === null) sel = i;
        else if (sel === i) sel = null;
        else {
          const k = edges.findIndex((e) => e[0] === sel && e[1] === i);
          if (k >= 0) edges.splice(k, 1); else edges.push([sel, i]);
          sel = null;
          reset();
        }
        draw();
        g.querySelectorAll("g[tabindex]")[i]?.focus();
      };
      node.addEventListener("click", pick);
      node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    if (sel !== null) text(g, 4, 292, `From ${PR_NODES[sel]}: click a page to add or remove a link`, { class: "fill-brand font-mono text-[10px]" });

    bars.replaceChildren();
    const total = visits.reduce((a, b) => a + b, 0);
    const vmax = Math.max(...exact, ...r, ...(total ? visits.map((v) => v / total) : [0]), 0.01);
    PR_NODES.forEach((name, i) => {
      const y = 14 + i * 34;
      text(bars, 10, y + 12, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      const w = (v) => (220 * v) / vmax;
      el("rect", { x: 22, y, width: w(r[i]), height: 9, rx: 2, style: "fill:var(--brand)" }, bars);
      text(bars, 26 + w(r[i]), y + 8, num(r[i], 3), {});
      if (total) {
        el("rect", { x: 22, y: y + 12, width: w(visits[i] / total), height: 9, rx: 2, style: "fill:var(--vec-u)" }, bars);
        text(bars, 26 + w(visits[i] / total), y + 20, num(visits[i] / total, 3), {});
      }
    });

    o.iter.textContent = iter;
    o.delta.textContent = Number.isFinite(delta) ? delta.toExponential(2) : "—";
    o.sum.textContent = num(r.reduce((a, b) => a + b, 0), 6);
    const top = exact.indexOf(Math.max(...exact));
    o.top.textContent = `${PR_NODES[top]} · ${num(exact[top], 3)}`;
    o.steps.textContent = steps.toLocaleString("en");
    o.gap.textContent = total ? `|Δ|₁ ${num(visits.reduce((s, v, i) => s + Math.abs(v / total - exact[i]), 0), 4)}` : "—";
  };

  const step = () => {
    const n = prStep(r, outOf(), f.d.get());
    delta = n.reduce((s, v, i) => s + Math.abs(v - r[i]), 0);
    r = n; iter++;
  };
  root.querySelector('[data-action="step"]').addEventListener("click", () => { step(); draw(); });
  root.querySelector('[data-action="solve"]').addEventListener("click", () => {
    let k = 0;
    do { step(); k++; } while (delta > 1e-12 && k < 1000);
    draw();
  });
  root.querySelector('[data-action="surf"]').addEventListener("click", () => {
    const out = outOf(), d = f.d.get();
    let at = Math.floor(Math.random() * N);
    for (let s = 0; s < 20000; s++) {
      visits[at]++;
      at = Math.random() < d && out[at].length ? out[at][Math.floor(Math.random() * out[at].length)] : Math.floor(Math.random() * N);
    }
    steps += 20000;
    draw();
  });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { edges = PR_EDGES.map((e) => [...e]); sel = null; reset(); draw(); });
  reset();
  draw();
}

// ============================================================ spelling

/** Levenshtein table between a and b (insert, delete, substitute all cost 1). */
export function levTable(a, b) {
  const D = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return D;
}

export function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

let vocabCounts = null;
const vocab = () => {
  if (vocabCounts) return vocabCounts;
  vocabCounts = new Map();
  for (const d of DOCS) for (const t of tokenize(docText(d))) if (/^\p{L}+$/u.test(t.word)) vocabCounts.set(t.word, (vocabCounts.get(t.word) ?? 0) + 1);
  return vocabCounts;
};

function initSpell(root) {
  const o = outs(root);
  const word = input(root, "word"), target = input(root, "target");
  const cands = root.querySelector("[data-candidates]");
  const table = root.querySelector("[data-table]");
  const opsEl = root.querySelector("[data-ops]");
  const V = vocab();

  const drawTable = (a, b) => {
    table.replaceChildren();
    opsEl.textContent = "";
    if (!a || !b) return;
    a = a.slice(0, 16); b = b.slice(0, 16);
    const D = levTable(a, b);
    // Backtrace one cheapest path.
    const path = new Set();
    const ops = [];
    let i = a.length, j = b.length;
    path.add(`${i},${j}`);
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
        ops.push(a[i - 1] === b[j - 1] ? `keep ${a[i - 1]}` : `${a[i - 1]}→${b[j - 1]}`); i--; j--;
      } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push(`delete ${a[i - 1]}`); i--; }
      else { ops.push(`insert ${b[j - 1]}`); j--; }
      path.add(`${i},${j}`);
    }
    const t = tag("table", "border-collapse font-mono text-[11px] tabular-nums");
    const head = tag("tr");
    head.append(tag("th", "size-6"), tag("th", "size-6 text-muted-foreground font-normal", "ε"));
    for (const c of b) head.append(tag("th", "size-6 font-medium", c));
    t.append(head);
    for (let r = 0; r <= a.length; r++) {
      const tr = tag("tr");
      tr.append(tag("th", "size-6 pr-1 text-right font-medium " + (r === 0 ? "text-muted-foreground font-normal" : ""), r === 0 ? "ε" : a[r - 1]));
      for (let c = 0; c <= b.length; c++) {
        const on = path.has(`${r},${c}`);
        tr.append(tag("td", "size-6 border text-center " + (on ? "bg-brand/25 font-medium text-foreground" : "text-muted-foreground"), String(D[r][c])));
      }
      t.append(tr);
    }
    table.append(t);
    const edits = ops.reverse().filter((x) => !x.startsWith("keep"));
    opsEl.textContent = edits.length ? `${D[a.length][b.length]} edits: ${edits.join(", ")}` : "Identical: 0 edits.";
  };

  const run = (fromWord) => {
    const w = word.value.trim().toLowerCase();
    cands.replaceChildren();
    const scored = w ? [...V].map(([v, n]) => ({ v, n, d: lev(w, v) })).filter((x) => x.d <= 2) : [];
    const tier = (d) => scored.filter((x) => x.d === d).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v));
    const best = V.has(w) ? { v: w, n: V.get(w), d: 0 } : tier(1)[0] ?? tier(2)[0] ?? null;
    const list = [...tier(0), ...tier(1), ...tier(2)].slice(0, 12);
    for (const c of list) {
      const b = tag("button", "rounded-md border px-2 py-1 font-mono text-[12px] outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 " + (best && c.v === best.v ? "border-brand ring-[3px] ring-brand/25" : ""));
      b.type = "button";
      b.textContent = `${c.v} · d${c.d} · ×${c.n}`;
      b.addEventListener("click", () => { target.value = c.v; drawTable(w, c.v); });
      cands.append(b);
    }
    if (w && !list.length) cands.append(tag("span", "text-sm text-muted-foreground", "Nothing within two edits."));
    if (fromWord) target.value = best?.v ?? "";
    drawTable(w, target.value.trim().toLowerCase());
    o.vocab.textContent = `${V.size} words`;
    o.best.textContent = best ? best.v : "—";
    o.dist.textContent = best ? best.d : "—";
    o.n1.textContent = tier(1).length;
    o.n2.textContent = tier(2).length;
  };

  word.addEventListener("input", () => run(true));
  target.addEventListener("input", () => drawTable(word.value.trim().toLowerCase(), target.value.trim().toLowerCase()));
  run(true);
}

// ============================================================ autocomplete

function buildTrie(words) {
  let nodes = 0;
  const mk = () => { nodes++; return { kids: new Map(), count: 0, best: 0, size: 0 }; };
  const root = mk();
  for (const [w, n] of words) {
    let at = root;
    for (const ch of w) {
      if (!at.kids.has(ch)) at.kids.set(ch, mk());
      at = at.kids.get(ch);
    }
    at.count = n;
  }
  const fill = (nd) => {
    nd.best = nd.count; nd.size = nd.count ? 1 : 0;
    for (const k of nd.kids.values()) { fill(k); nd.best = Math.max(nd.best, k.best); nd.size += k.size; }
  };
  fill(root);
  return { root, nodes };
}

/** Best-first top-n completions under a node; counts nodes taken off the queue. */
export function complete(node, prefix, n) {
  const queue = [{ p: node.best, node, s: prefix }];
  const out = [];
  let visited = 0;
  while (queue.length && out.length < n) {
    queue.sort((a, b) => b.p - a.p || (a.word ? -1 : 1));
    const it = queue.shift();
    if (it.word) { out.push({ w: it.s, n: it.p }); continue; }
    visited++;
    if (it.node.count) queue.push({ p: it.node.count, word: true, s: it.s });
    for (const [ch, k] of it.node.kids) queue.push({ p: k.best, node: k, s: it.s + ch });
  }
  return { out, visited };
}

function initTrie(root) {
  const o = outs(root);
  const pre = input(root, "prefix");
  const svg = root.querySelector("[data-plot]");
  const list = root.querySelector("[data-completions]");
  const V = vocab();
  const trie = buildTrie(V);
  const f = scrubAll(root, () => run());

  const run = () => {
    const p = pre.value.trim().toLowerCase();
    let at = trie.root;
    for (const ch of p) { at = at?.kids.get(ch); if (!at) break; }
    svg.replaceChildren();
    list.replaceChildren();
    o.nodes.textContent = trie.nodes.toLocaleString("en");
    o.words.textContent = V.size;
    o.scan.textContent = `${V.size} words`;
    if (!at) {
      svg.setAttribute("viewBox", "0 0 560 60");
      text(svg, 280, 34, `No word starts with “${p}”.`, { "text-anchor": "middle", class: "fill-muted-foreground text-[13px]" });
      o.under.textContent = "0"; o.visited.textContent = "—";
      return;
    }
    // Next letters below the prefix: words under each, and the best count there.
    const kids = [...at.kids].sort((a, b) => b[1].best - a[1].best).slice(0, 12);
    svg.setAttribute("viewBox", `0 0 560 ${Math.max(60, 34 + kids.length * 17)}`);
    const smax = Math.max(1, ...kids.map(([, k]) => k.size));
    text(svg, 4, 12, `after “${p || "·"}”: words under each next letter (bar) and the most frequent one's count`, {});
    kids.forEach(([ch, k], i) => {
      const y = 24 + i * 17;
      text(svg, 50, y + 10, `${p}${ch}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
      el("rect", { x: 56, y, width: Math.max(2, (380 * k.size) / smax), height: 12, rx: 2, style: "fill:var(--vec-j);fill-opacity:0.55" }, svg);
      text(svg, 62 + (380 * k.size) / smax, y + 10, `${k.size} · best ×${k.best}`, {});
    });
    if (!kids.length) text(svg, 4, 40, "This prefix is a whole word with nothing below it.", { class: "fill-muted-foreground text-[12px]" });

    const { out, visited } = complete(at, p, f.n.get());
    const top = out[0]?.n || 1;
    out.forEach((c) => {
      const li = tag("li", "flex items-center gap-3 font-mono text-[13px]");
      const word = tag("span", "w-32 shrink-0 truncate");
      word.append(tag("span", "text-foreground", p), tag("span", "text-muted-foreground", c.w.slice(p.length)));
      const bar = tag("span", "h-2 rounded-full bg-brand/70");
      bar.style.width = `${(60 * c.n) / top}%`;
      li.append(word, bar, tag("span", "text-[11px] text-muted-foreground tabular-nums", `×${c.n}`));
      list.append(li);
    });
    o.under.textContent = `${at.size} words`;
    o.visited.textContent = visited;
  };

  pre.addEventListener("input", run);
  run();
}

// ============================================================ Bloom filter

function fnv1a(s, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  // Final avalanche (murmur3 fmix32) so nearby strings spread out.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

export function bloomPositions(s, k, m) {
  const h1 = fnv1a(s), h2 = fnv1a(s, 0x9747b28c) | 1;
  return Array.from({ length: k }, (_, i) => ((h1 + Math.imul(i, h2)) >>> 0) % m);
}

export const bloomFpr = (m, n, k) => (1 - Math.exp((-k * n) / m)) ** k;

function initBloom(root) {
  const o = outs(root);
  const q = input(root, "query");
  const bitsSvg = root.querySelector("[data-bits]");
  const plot = root.querySelector("[data-plot]");
  const verdict = root.querySelector("[data-verdict]");
  const ranked = [...vocab()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
  const f = scrubAll(root, () => run());
  const probes = (() => {
    const rng = mulberry32(42), set = new Set(ranked), out = [];
    while (out.length < 20000) {
      const len = 5 + Math.floor(rng() * 6);
      let s = "";
      for (let i = 0; i < len; i++) s += String.fromCharCode(97 + Math.floor(rng() * 26));
      if (!set.has(s)) out.push(s);
    }
    return out;
  })();

  const run = () => {
    const m = f.m.get(), k = f.k.get(), n = Math.min(f.n.get(), ranked.length);
    const words = ranked.slice(0, n);
    const bits = new Uint8Array(m);
    for (const w of words) for (const p of bloomPositions(w, k, m)) bits[p] = 1;
    const set = bits.reduce((a, b) => a + b, 0);
    let fp = 0;
    for (const s of probes) if (bloomPositions(s, k, m).every((p) => bits[p])) fp++;
    const meas = fp / probes.length, pred = bloomFpr(m, n, k);
    const kopt = Math.max(1, Math.round((m / n) * Math.LN2));

    const word = q.value.trim().toLowerCase();
    const qp = word ? bloomPositions(word, k, m) : [];
    const qset = new Set(qp);

    bitsSvg.replaceChildren();
    const cols = m <= 256 ? 32 : 64, rows = Math.ceil(m / cols);
    const cw = 540 / cols, ch = Math.min(cw, 130 / rows);
    for (let i = 0; i < m; i++) {
      const x = 10 + (i % cols) * cw, y = 10 + Math.floor(i / cols) * ch;
      const hit = qset.has(i);
      el("rect", {
        x: x + 0.5, y: y + 0.5, width: cw - 1, height: ch - 1, rx: 1,
        style: `fill:${bits[i] ? (hit ? "var(--brand)" : "var(--muted-foreground)") : "transparent"};fill-opacity:${bits[i] ? (hit ? 1 : 0.45) : 0};stroke:${hit ? "var(--brand)" : "currentColor"};stroke-opacity:${hit ? 1 : 0.15};stroke-width:${hit ? 1.5 : 0.75}`,
      }, bitsSvg);
    }

    verdict.replaceChildren();
    if (word) {
      const all = qp.every((p) => bits[p]);
      const member = words.includes(word);
      const strong = tag("span", "font-medium");
      if (!all) {
        const zero = qp.find((p) => !bits[p]);
        strong.textContent = "Definitely not in the set";
        verdict.append(strong, ` — bit ${zero} is 0. Bits checked: ${qp.join(", ")}.`);
      } else {
        strong.textContent = member ? "Maybe in the set, and it is" : "Maybe in the set, but it is not: a false positive";
        if (!member) strong.className += " text-brand";
        verdict.append(strong, ` — all ${k} bits are set (${qp.join(", ")}).`);
      }
    }

    plot.replaceChildren();
    const lg = (v) => Math.log10(Math.max(v, 1e-6));
    const fr = frame(plot, { box: [44, 24, 500, 134], x: [1, 12], y: [-6, 0], xticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], yticks: [-6, -4, -2, 0], yfmt: (v) => (v === 0 ? "1" : `1e${v}`.replace("-", "−")), xlabel: "hashes k", ylabel: "false-positive rate (log)" });
    polyline(plot, Array.from({ length: 111 }, (_, i) => 1 + i / 10).map((kk) => [fr.sx(kk), fr.sy(lg(bloomFpr(m, n, kk)))]), "stroke:var(--vec-j);stroke-width:1.75");
    if (kopt <= 12) {
      el("line", { x1: fr.sx(kopt), x2: fr.sx(kopt), y1: fr.sy(0), y2: fr.sy(-6), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, plot);
      text(plot, fr.sx(kopt) + 4, fr.sy(-0.3), `optimal k ≈ ${num((m / n) * Math.LN2, 1)}`, {});
    }
    if (meas > 0) el("circle", { cx: fr.sx(k), cy: fr.sy(lg(meas)), r: 4.5, style: "fill:var(--brand)" }, plot);
    else text(plot, fr.sx(k), fr.sy(-5.6), "0 measured", { "text-anchor": "middle", class: "fill-brand font-mono text-[10px]" });

    o.set.textContent = `${set} / ${m} (${Math.round((100 * set) / m)}%)`;
    const pct = (v) => (v < 1e-4 ? v.toExponential(2) : `${num(100 * v, 2)}%`);
    o.pred.textContent = pct(pred);
    o.fill.textContent = pct((set / m) ** k);
    o.meas.textContent = `${num(100 * meas, 2)}%  (${fp} / ${probes.length})`;
    o.kopt.textContent = `${num((m / n) * Math.LN2, 2)} → ${kopt}`;
    o.bpw.textContent = num(m / n, 1);
  };

  q.addEventListener("input", run);
  root.querySelector('[data-action="optimal"]').addEventListener("click", () => {
    const n = Math.min(f.n.get(), ranked.length);
    f.k.set(Math.min(12, Math.max(1, Math.round((f.m.get() / n) * Math.LN2))));
  });
  run();
}

// ============================================================ LSH

function initLsh(root) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const f = scrubAll(root, () => { planes = makePlanes(); run(); });
  const rng = mulberry32(11);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const centres = [[0.55, 0.35], [-0.5, 0.5], [-0.35, -0.6], [0.45, -0.5], [0.05, 0.75]];
  const pts = Array.from({ length: 600 }, (_, i) => {
    const [cx, cy] = centres[i % centres.length];
    return [cx + 0.17 * gauss(), cy + 0.17 * gauss()];
  });
  const ang = (p) => Math.atan2(p[1], p[0]);
  const angDiff = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  let planeRng = mulberry32(3), query = [0.4, 0.25], planes;
  const makePlanes = () => Array.from({ length: f.tables.get() }, () => Array.from({ length: f.bits.get() }, () => {
    const t = planeRng() * Math.PI;
    return [Math.cos(t), Math.sin(t)];
  }));
  const key = (p, tb) => tb.map((n) => (p[0] * n[0] + p[1] * n[1] >= 0 ? 1 : 0)).join("");

  const searchFor = (qp) => {
    const qa = ang(qp);
    const keys = planes.map((tb) => key(qp, tb));
    const cand = new Set();
    pts.forEach((p, i) => { if (planes.some((tb, t) => key(p, tb) === keys[t])) cand.add(i); });
    const truth = pts.map((p, i) => [angDiff(ang(p), qa), i]).sort((a, b) => a[0] - b[0]).slice(0, 10).map((x) => x[1]);
    const recall = truth.filter((i) => cand.has(i)).length / 10;
    return { cand, truth: new Set(truth), recall };
  };

  const S = 180, C = 200;
  const sx = (x) => C + x * S, sy = (y) => C - y * S;

  const run = () => {
    const { cand, truth, recall } = searchFor(query);
    svg.replaceChildren();
    el("circle", { cx: C, cy: C, r: 2, style: "fill:currentColor;fill-opacity:0.5" }, svg);
    for (const n of planes[0]) {
      // The plane's trace is the line through the centre perpendicular to n.
      const dx = -n[1], dy = n[0];
      el("line", { x1: sx(-1.2 * dx), y1: sy(-1.2 * dy), x2: sx(1.2 * dx), y2: sy(1.2 * dy), style: "stroke:var(--vec-u);stroke-opacity:0.7;stroke-width:1;stroke-dasharray:5 4" }, svg);
    }
    pts.forEach((p, i) => {
      const c = cand.has(i);
      el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: c ? 2.6 : 2, style: `fill:${c ? "var(--vec-j)" : "currentColor"};fill-opacity:${c ? 0.9 : 0.18}` }, svg);
    });
    for (const i of truth) el("circle", { cx: sx(pts[i][0]), cy: sy(pts[i][1]), r: 5, style: "fill:none;stroke:var(--vec-i);stroke-width:1.5" }, svg);
    el("line", { x1: C, y1: C, x2: sx(query[0]), y2: sy(query[1]), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-width:1" }, svg);
    el("circle", { cx: sx(query[0]), cy: sy(query[1]), r: 7, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    o.npts.textContent = pts.length;
    o.scanned.textContent = `${cand.size} (${Math.round((100 * cand.size) / pts.length)}%)`;
    o.recall.textContent = num(recall, 1);
  };

  const toSvg = (e) => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const clamp = (v) => Math.max(-1.05, Math.min(1.05, v));
    return [clamp((pt.x - C) / S), clamp((C - pt.y) / S)];
  };
  let drag = false;
  svg.addEventListener("pointerdown", (e) => { drag = true; svg.setPointerCapture(e.pointerId); query = toSvg(e); run(); });
  svg.addEventListener("pointermove", (e) => { if (drag) { query = toSvg(e); run(); } });
  svg.addEventListener("pointerup", () => (drag = false));
  svg.addEventListener("pointercancel", () => (drag = false));
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    query = [Math.max(-1.05, Math.min(1.05, query[0] + d[0])), Math.max(-1.05, Math.min(1.05, query[1] + d[1]))];
    run();
  });
  root.querySelector('[data-action="reseed"]').addEventListener("click", () => { planes = makePlanes(); run(); });
  root.querySelector('[data-action="bench"]').addEventListener("click", () => {
    const r = mulberry32(99);
    let sc = 0, rc = 0;
    for (let i = 0; i < 200; i++) {
      const t = r() * 2 * Math.PI, rad = 0.3 + 0.6 * r();
      const res = searchFor([rad * Math.cos(t), rad * Math.sin(t)]);
      sc += res.cand.size; rc += res.recall;
    }
    o.avgscan.textContent = `${num((100 * sc) / 200 / pts.length, 1)}%`;
    o.avgrecall.textContent = num(rc / 200, 2);
  });
  planes = makePlanes();
  run();
}

// ============================================================ boot

const BLOCKS = [
  ["srch-index", initIndex], ["srch-bool", initBoolean], ["srch-tfidf", initTfidf], ["srch-bm25", initBm25],
  ["srch-eval", initEval], ["srch-pr", initPagerank], ["srch-spell", initSpell], ["srch-trie", initTrie],
  ["srch-bloom", initBloom], ["srch-lsh", initLsh],
];
for (const [attr, init] of BLOCKS) {
  for (const root of document.querySelectorAll(`[data-${attr}]`)) {
    try { init(root); } catch (e) { console.error(`${attr}:`, e); }
  }
}
