// The large language model blocks. Every model here is a toy computed in the
// browser: a BPE tokenizer, character n-grams, PPMI + SVD word vectors,
// scaled dot-product attention, sinusoidal positions, a small neural
// character model trained by backprop, and the usual decoding rules.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onSeg = (root, fn) => root.querySelectorAll("[role=tablist]").forEach((t) => t.addEventListener("seg-change", (e) => fn(e.detail.value, t)));
const selectSeg = (root, value) =>
  root.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));
const corpusOf = (root) => root.querySelector("template[data-llm-corpus]")?.content.textContent ?? "";
const h = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
const fmtBytes = (b) => {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
  return `${b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)} ${u[i]}`;
};
const fmtBig = (v) => {
  const u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "k"]];
  for (const [d, s] of u) if (v >= d) return `${(v / d).toFixed(v / d >= 100 ? 0 : 1)}${s}`;
  return String(Math.round(v));
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Normalised corpus for the character models: lower case, single spaces.
const charText = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Draws an index from a probability vector.
function draw(p, rng = Math.random) {
  let u = rng(), i = 0;
  for (; i < p.length - 1; i++) { u -= p[i]; if (u < 0) return i; }
  return i;
}

// Runs step() in animation frames while the root is on screen.
function loop(root, step) {
  let raf = 0, playing = false, visible = true;
  const tick = () => { raf = 0; if (!playing || !visible) return; step(); raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(tick); }).observe(root);
  return {
    get playing() { return playing; },
    set(on) { playing = on; if (on && !raf) raf = requestAnimationFrame(tick); },
  };
}

// ============================================================ BPE tokenizer

// GPT-2 style pre-split: a word keeps its leading space; merges never cross
// chunk boundaries.
const preSplit = (s) => s.match(/ ?[\p{L}\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+/gu) ?? [];

export function bpeTrain(textIn, nMerges) {
  const counts = new Map();
  for (const c of preSplit(textIn)) counts.set(c, (counts.get(c) ?? 0) + 1);
  let words = [...counts].map(([w, n]) => ({ sym: [...w], n }));
  const base = new Set([...textIn]);
  const merges = [];
  for (let m = 0; m < nMerges; m++) {
    const pairs = new Map();
    for (const w of words) {
      for (let i = 0; i + 1 < w.sym.length; i++) {
        const k = w.sym[i] + "\u0000" + w.sym[i + 1];
        pairs.set(k, (pairs.get(k) ?? 0) + w.n);
      }
    }
    let best = null, bestN = 1; // a pair seen once is not worth a token
    for (const [k, n] of pairs) if (n > bestN || (n === bestN && best !== null && k < best)) { best = k; bestN = n; }
    if (best === null) break;
    const [a, b] = best.split("\u0000");
    merges.push({ a, b, n: bestN });
    for (const w of words) w.sym = mergePair(w.sym, a, b);
  }
  return { merges, base };
}

function mergePair(sym, a, b) {
  const out = [];
  for (let i = 0; i < sym.length; i++) {
    if (i + 1 < sym.length && sym[i] === a && sym[i + 1] === b) { out.push(a + b); i++; } else out.push(sym[i]);
  }
  return out;
}

export function bpeEncode(textIn, merges) {
  const toks = [];
  for (const chunk of preSplit(textIn)) {
    let sym = [...chunk];
    for (const { a, b } of merges) if (sym.length > 1) sym = mergePair(sym, a, b);
    toks.push(...sym);
  }
  return toks;
}
export const bpeDecode = (toks) => toks.join("");
const showTok = (t) => t.replace(/ /g, "·").replace(/\n/g, "⏎");

for (const root of document.querySelectorAll("[data-llm-bpe]")) {
  const ta = root.querySelector("textarea[data-text]");
  const tokBox = root.querySelector("[data-tokens]");
  const mergeList = root.querySelector("[data-merges]");
  const o = outs(root);
  const s = scrubAll(root, update);
  let timer = 0;
  ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 150); });
  root.querySelector('[data-action="step"]').addEventListener("click", () => s.merges.set(s.merges.get() + 1));
  root.querySelector('[data-action="reset"]').addEventListener("click", () => s.merges.set(0));

  function update() {
    const src = ta.value.slice(0, 6000);
    const { merges, base } = bpeTrain(src, s.merges.get());
    const toks = bpeEncode(src, merges);
    const words = src.split(/\s+/).filter(Boolean).length;
    tokBox.replaceChildren(...toks.slice(0, 600).map((t, i) =>
      h("span", "rounded px-1 py-0.5 whitespace-pre " + (i % 2 ? "bg-brand/15" : "bg-foreground/8"), showTok(t))));
    if (toks.length > 600) tokBox.append(h("span", "text-muted-foreground", ` … ${toks.length - 600} more`));
    mergeList.replaceChildren(...merges.map((m, i) => {
      const li = h("li", "rounded border bg-background px-1.5 py-0.5 whitespace-pre");
      li.append(h("span", "text-muted-foreground", `${i + 1}. `), `${showTok(m.a)} + ${showTok(m.b)} → ${showTok(m.a + m.b)}`, h("span", "text-muted-foreground", ` ×${m.n}`));
      return li;
    }));
    if (!merges.length) mergeList.append(h("li", "text-muted-foreground", "No merges yet: every character is a token."));
    o.chars.textContent = [...src].length;
    o.vocab.textContent = `${base.size} + ${merges.length} = ${base.size + merges.length}`;
    o.ntok.textContent = toks.length;
    o.tpw.textContent = words ? (toks.length / words).toFixed(2) : "—";
    const ok = bpeDecode(toks) === src;
    o.roundtrip.textContent = ok ? "exact ✓" : "mismatch";
    o.roundtrip.className = "tabular-nums " + (ok ? "text-brand" : "text-destructive");
    if (merges.length < s.merges.get()) o.vocab.textContent += " (no pair left)";
  }
  update();
}

// ============================================================ n-grams

// A character n-gram model with add-k smoothing over the training alphabet.
function ngramModel(train, n, alpha = [...new Set(train)].sort()) {
  const idx = new Map(alpha.map((c, i) => [c, i]));
  const table = new Map(); // context → counts
  for (let i = n - 1; i < train.length; i++) {
    const ctx = train.slice(i - n + 1, i);
    let row = table.get(ctx);
    if (!row) table.set(ctx, (row = { total: 0, c: new Float64Array(alpha.length) }));
    row.c[idx.get(train[i])]++;
    row.total++;
  }
  const probs = (ctx, k) => {
    const row = table.get(ctx.slice(ctx.length - (n - 1)));
    const V = alpha.length;
    const p = new Float64Array(V);
    for (let j = 0; j < V; j++) p[j] = ((row ? row.c[j] : 0) + k) / ((row ? row.total : 0) + k * V);
    return p;
  };
  return { alpha, idx, table, probs, n };
}

// Perplexity of text given the model; each character's context is the
// previous n − 1 characters, taken from `before` at the start.
function perplexity(model, before, textIn, k) {
  const full = before + textIn;
  let nll = 0, count = 0;
  for (let i = before.length; i < full.length; i++) {
    const p = model.probs(full.slice(Math.max(0, i - model.n + 1), i), k);
    nll -= Math.log(p[model.idx.get(full[i])]);
    count++;
  }
  return Math.exp(nll / count);
}

const withTemp = (p, T) => {
  const q = Array.from(p, (v) => Math.pow(v, 1 / T));
  const z = q.reduce((a, b) => a + b, 0);
  return q.map((v) => v / z);
};

for (const root of document.querySelectorAll("[data-llm-ngram]")) {
  const corpus = charText(corpusOf(root));
  const cut = Math.floor(corpus.length * 0.8);
  const train = corpus.slice(0, cut), test = corpus.slice(cut);
  const svg = root.querySelector("[data-plot]");
  const ctxIn = root.querySelector("[data-context]");
  const sampleOut = root.querySelector("[data-sample]");
  const o = outs(root);
  let n = 3;
  selectSeg(root, "3");
  const models = new Map();
  // The alphabet is that of the whole text (a closed vocabulary), so a
  // character first seen in the held-out part still has a probability.
  const alpha = [...new Set(corpus)].sort();
  const model = () => models.get(n) ?? models.set(n, ngramModel(train, n, alpha)).get(n);
  const s = scrubAll(root, update);
  onSeg(root, (v) => { n = Number(v); update(); });
  ctxIn.addEventListener("input", plot);
  root.querySelector('[data-action="sample"]').addEventListener("click", sample);

  function plot() {
    const m = model();
    const raw = ctxIn.value.toLowerCase();
    const used = n === 1 ? "" : (" ".repeat(n) + raw).slice(-(n - 1));
    o.used.textContent = n === 1 ? "unigram: context ignored" : `uses “${used.replace(/ /g, "·")}”`;
    const p = withTemp(m.probs(used, s.k.get()), s.temp.get());
    const top = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 16);
    svg.replaceChildren();
    const max = Math.max(0.05, top[0][0]);
    const f = frame(svg, { box: [40, 26, 506, 158], x: [0, 16], y: [0, max * 1.15], yticks: [0, max / 2, max].map((v) => +v.toFixed(2)), ylabel: "P(next | context)" });
    top.forEach(([v, i], r) => {
      const x = f.sx(r) + 3, w = f.sx(1) - f.sx(0) - 6;
      el("rect", { x, y: f.sy(v), width: w, height: Math.max(0, f.sy(0) - f.sy(v)), rx: 2, style: `fill:var(--brand);fill-opacity:${r === 0 ? 0.9 : 0.55}` }, svg);
      text(svg, x + w / 2, 201, m.alpha[i] === " " ? "␣" : m.alpha[i], { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
      if (v > max * 0.12) text(svg, x + w / 2, f.sy(v) - 3, (v * 100).toFixed(0), { "text-anchor": "middle" });
    });
    text(svg, 546, 216, "top 16 of " + m.alpha.length + " characters, % shown", { "text-anchor": "end" });
  }

  function sample() {
    const m = model();
    let out = " ".repeat(n) + ctxIn.value.toLowerCase();
    const seed = ctxIn.value.toLowerCase();
    let gen = "";
    for (let i = 0; i < 200; i++) {
      const p = withTemp(m.probs(n === 1 ? "" : out.slice(-(n - 1)), s.k.get()), s.temp.get());
      const c = m.alpha[draw(p)];
      out += c; gen += c;
    }
    sampleOut.replaceChildren(h("span", "text-muted-foreground", seed), gen);
  }

  function update() {
    const m = model();
    const k = s.k.get();
    o.ntrain.textContent = train.length;
    o.ntest.textContent = test.length;
    o.alpha.textContent = m.alpha.length;
    o.pptrain.textContent = perplexity(m, train.slice(0, n - 1), train.slice(n - 1), k).toFixed(2);
    o.pptest.textContent = perplexity(m, n > 1 ? train.slice(-(n - 1)) : "", test, k).toFixed(2);
    plot();
  }
  update();
  sample();
}

// ============================================================ Embeddings

const EMBED_GROUPS = {
  animal: ["cat", "dog", "horse", "cow"],
  royal: ["king", "queen", "prince", "princess"],
  food: ["bread", "cheese", "apple", "soup"],
  city: ["paris", "london", "rome", "berlin"],
};
const EMBED_TEMPLATES = {
  animal: ["the {} eats grass on the farm", "a {} runs in the field", "the farmer feeds the {} at dawn"],
  royal: ["the {} rules the kingdom", "the {} lives in the castle", "the {} wears a golden crown"],
  food: ["we eat {} for dinner", "the {} tastes fresh and good", "she cooks {} in the kitchen"],
  city: ["she travels to {} by train", "{} is a big old city", "the museum in {} has paintings"],
};
const EMBED_EXTRA = [
  "the king is a man", "the queen is a woman", "the prince is a young man", "the princess is a young woman",
  "the man rules the kingdom", "the woman rules the kingdom", "the dog eats meat", "the cat eats meat",
  "the king and the queen dance", "the prince and the princess dance", "the prince rides a horse",
  "the horse pulls a cart", "the cow gives milk", "cheese is made from milk", "she eats bread with cheese",
  "the cat chases a mouse", "the dog chases the cat", "rome and paris have old churches", "london has rain",
  "berlin has a long wall", "the apple grows on a tree", "soup with bread", "the king travels to rome",
  "the queen lives in london", "the dog sleeps by the fire", "the man eats an apple", "the woman eats soup",
];
const STOP = new Set("the a an is in at and for by on of to we she with from".split(" "));

function embedCorpus() {
  const out = [];
  for (const [g, words] of Object.entries(EMBED_GROUPS))
    for (const w of words) for (const t of EMBED_TEMPLATES[g]) out.push(t.replace("{}", w));
  return out.concat(EMBED_EXTRA).map((s) => s.split(" ").filter((w) => !STOP.has(w)));
}

// PPMI of word–context co-occurrences within ±window words.
function ppmi(sentences, window) {
  const vocab = [...new Set(sentences.flat())].sort();
  const id = new Map(vocab.map((w, i) => [w, i]));
  const V = vocab.length;
  const C = Array.from({ length: V }, () => new Float64Array(V));
  for (const s of sentences)
    for (let i = 0; i < s.length; i++)
      for (let j = Math.max(0, i - window); j <= Math.min(s.length - 1, i + window); j++)
        if (j !== i) C[id.get(s[i])][id.get(s[j])]++;
  const row = C.map((r) => r.reduce((a, b) => a + b, 0));
  const total = row.reduce((a, b) => a + b, 0);
  const M = C.map((r, i) => Float64Array.from(r, (c, j) => (c > 0 ? Math.max(0, Math.log((c * total) / (row[i] * row[j]))) : 0)));
  return { vocab, M };
}

// The PPMI matrix is symmetric, so its singular vectors are its
// eigenvectors and its singular values the |eigenvalues|. Cyclic Jacobi
// rotations diagonalise it exactly (to rounding) at this size.
function topEigen(M, k) {
  const n = M.length;
  const A = M.map((r) => Float64Array.from(r));
  const Q = Array.from({ length: n }, (_, i) => Float64Array.from({ length: n }, (_, j) => +(i === j)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let r = 0; r < n; r++) {
          const ap = A[r][p], aq = A[r][q];
          A[r][p] = c * ap - s * aq; A[r][q] = s * ap + c * aq;
        }
        for (let r = 0; r < n; r++) {
          const ap = A[p][r], aq = A[q][r];
          A[p][r] = c * ap - s * aq; A[q][r] = s * ap + c * aq;
        }
        for (let r = 0; r < n; r++) {
          const qp = Q[r][p], qq = Q[r][q];
          Q[r][p] = c * qp - s * qq; Q[r][q] = s * qp + c * qq;
        }
      }
  }
  const order = [...Array(n).keys()].sort((a, b) => Math.abs(A[b][b]) - Math.abs(A[a][a])).slice(0, k);
  return { vecs: order.map((c) => Float64Array.from(Q, (r) => r[c])), vals: order.map((c) => A[c][c]) };
}
const mat = (A, v) => Float64Array.from(A, (r) => r.reduce((a, x, j) => a + x * v[j], 0));
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / Math.sqrt(na * nb || 1);
};

for (const root of document.querySelectorAll("[data-llm-embed]")) {
  const svg = root.querySelector("[data-plot]");
  const list = root.querySelector("[data-neighbours]");
  const o = outs(root);
  const sentences = embedCorpus();
  const groupOf = new Map(Object.entries(EMBED_GROUPS).flatMap(([g, ws]) => ws.map((w) => [w, g])));
  groupOf.set("man", "person").set("woman", "person");
  const colors = { animal: "var(--vec-u)", royal: "var(--brand)", food: "var(--ion-na)", city: "var(--ion-k)", person: "var(--foreground)" };
  let selected = "king", emb = null, vocab = [];
  const s = scrubAll(root, update);

  function update() {
    const { vocab: vs, M } = ppmi(sentences, s.window.get());
    vocab = vs;
    const k = Math.min(s.dims.get(), vs.length);
    const { vecs, vals } = topEigen(M, k);
    emb = vs.map((_, i) => vecs.map((v, c) => v[i] * Math.sqrt(Math.abs(vals[c]))));
    const fro = M.reduce((a, r) => a + r.reduce((b, x) => b + x * x, 0), 0);
    o.vocab.textContent = vs.length + " words";
    o.kept.textContent = ((vals.reduce((a, l) => a + l * l, 0) / fro) * 100).toFixed(1) + "%";
    plot();
  }

  function plot() {
    svg.replaceChildren();
    const xs = emb.map((e) => e[0]), ys = emb.map((e) => e[1] ?? 0);
    const pad = (lo, hi) => { const d = (hi - lo) * 0.12 || 1; return [lo - d, hi + d]; };
    const f = frame(svg, { box: [16, 12, 528, 336], x: pad(Math.min(...xs), Math.max(...xs)), y: pad(Math.min(...ys), Math.max(...ys)), xlabel: "dimension 1", ylabel: "dimension 2" });
    const near = neighbours(selected).slice(0, 5).map(([w]) => w);
    const placed = [];
    const order = [...vocab.keys()].sort((a, b) => +groupOf.has(vocab[a]) - +groupOf.has(vocab[b]));
    order.forEach((i) => {
      const w = vocab[i];
      const g = groupOf.get(w);
      const x = f.sx(xs[i]), y = f.sy(ys[i]);
      const on = w === selected, hi = near.includes(w);
      const grp = el("g", { role: "button", tabindex: "0", "aria-label": w, class: "cursor-pointer outline-none" }, svg);
      if (hi) el("line", { x1: f.sx(xs[vocab.indexOf(selected)]), y1: f.sy(ys[vocab.indexOf(selected)]), x2: x, y2: y, style: "stroke:var(--brand);stroke-opacity:0.35" }, grp);
      el("circle", { cx: x, cy: y, r: on ? 6 : g ? 4.5 : 2.5, style: `fill:${g ? colors[g] : "currentColor"};fill-opacity:${g ? 0.9 : 0.3};stroke:var(--background);stroke-width:1.5` }, grp);
      if (!g) { el("title", {}, grp).textContent = w; return; }
      // Nudge labels that would overlap one already placed.
      const lw = w.length * 6.6 + 2;
      const spots = [[7, 4], [-7 - lw, 4], [7, 15], [7, -7], [-7 - lw, 15], [-7 - lw, -7], [-lw / 2, 18], [-lw / 2, -10]];
      const free = ([dx, dy]) => !placed.some((b) => x + dx < b.x + b.w && b.x < x + dx + lw && Math.abs(b.y - (y + dy)) < 11);
      const [dx, dy] = spots.find(free) ?? spots[0];
      placed.push({ x: x + dx, y: y + dy, w: lw });
      text(grp, x + dx, y + dy, w, { class: `font-mono fill-foreground text-[11px]${on ? " font-semibold" : ""}` });
      if (!g) { grp.removeAttribute("role"); grp.removeAttribute("tabindex"); grp.removeAttribute("aria-label"); grp.classList.remove("cursor-pointer"); return; }
      const pick = () => { selected = w; plot(); };
      grp.addEventListener("click", pick);
      grp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    let lx = 24;
    for (const [g, c] of Object.entries(colors)) {
      el("circle", { cx: lx, cy: 368, r: 4, style: `fill:${c}` }, svg);
      text(svg, lx + 8, 372, g);
      lx += 72;
    }
    o.word.textContent = `Nearest to “${selected}” (${emb[0].length} dimensions)`;
    list.replaceChildren(...neighbours(selected).slice(0, 6).map(([w, c]) => {
      const li = h("li", "flex items-center justify-between gap-2");
      const bar = h("span", "h-1.5 rounded-full bg-brand/60");
      bar.style.width = `${Math.max(0, c) * 60}px`;
      li.append(h("span", "", w), h("span", "flex items-center gap-2 tabular-nums text-muted-foreground"));
      li.lastChild.append(bar, num(c, 2));
      return li;
    }));
  }

  function neighbours(w) {
    const i = vocab.indexOf(w);
    // Compared among the labelled words only: the other words are mostly
    // the contexts themselves.
    return vocab.map((v, j) => [v, cosine(emb[i], emb[j])]).filter(([v]) => v !== w && groupOf.has(v)).sort((a, b) => b[1] - a[1]);
  }
  update();
}

// ============================================================ Attention

const ATTN_TOKENS = ["the", "cat", "sat", "on", "the"];
const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((a, x, k) => a + x * B[k][j], 0)));
const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
export function softmaxRow(r) {
  const m = Math.max(...r.filter(Number.isFinite));
  const e = r.map((x) => (Number.isFinite(x) ? Math.exp(x - m) : 0));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}

function attention(seed, causal) {
  const rng = mulberry32(seed);
  const rand = (n, m, sc) => Array.from({ length: n }, () => Array.from({ length: m }, () => +(gauss(rng) * sc).toFixed(2)));
  const d = 4;
  // Token embeddings: repeated tokens share a row, as in a real model.
  const table = new Map();
  const X = ATTN_TOKENS.map((t) => table.get(t) ?? table.set(t, rand(1, d, 1)[0]).get(t));
  const Wq = rand(d, d, 0.7), Wk = rand(d, d, 0.7), Wv = rand(d, d, 0.7);
  const Q = matmul(X, Wq), K = matmul(X, Wk), V = matmul(X, Wv);
  const S = matmul(Q, transpose(K)).map((r) => r.map((x) => x / Math.sqrt(d)));
  const Sm = S.map((r, i) => r.map((x, j) => (causal && j > i ? -Infinity : x)));
  const A = Sm.map(softmaxRow);
  const O = matmul(A, V);
  return { X, Wq, Wk, Wv, Q, K, V, S, Sm, A, O, d };
}

function matrixTable(name, M, { rows = ATTN_TOKENS, cols, heat = false, note } = {}) {
  const wrap = h("figure", "flex shrink-0 flex-col gap-1");
  const cap = h("figcaption", "font-mono text-[11px] text-muted-foreground");
  cap.append(h("span", "font-semibold text-foreground", name), note ? `  ${note}` : "");
  const t = h("table", "border-separate border-spacing-0.5 font-mono text-[11px] tabular-nums");
  if (cols) {
    const tr = h("tr");
    tr.append(h("th"), ...cols.map((c) => h("th", "px-1 text-center font-normal text-muted-foreground", c)));
    t.append(h("thead")); t.firstChild.append(tr);
  }
  const body = h("tbody");
  M.forEach((r, i) => {
    const tr = h("tr");
    if (rows) tr.append(h("th", "pr-1.5 text-right font-normal text-muted-foreground", rows[i]));
    for (const v of r) {
      const td = h("td", "min-w-11 rounded px-1 py-0.5 text-right", v === -Infinity ? "−∞" : num(v, 2));
      if (v === -Infinity) td.classList.add("text-muted-foreground");
      else if (heat) td.style.background = `color-mix(in oklch, var(--brand) ${Math.round(v * 85)}%, transparent)`;
      else td.style.background = `color-mix(in oklch, ${v >= 0 ? "var(--brand)" : "var(--vec-u)"} ${Math.min(40, Math.round(Math.abs(v) * 18))}%, transparent)`;
      tr.append(td);
    }
    body.append(tr);
  });
  t.append(body);
  wrap.append(cap, t);
  return wrap;
}

const ATTN_STEPS = {
  qkv: "Each token’s embedding x (a row of X) is multiplied by three learned matrices: Q = X·W_q asks “what am I looking for?”, K = X·W_k says “what do I contain?”, V = X·W_v is what gets passed on. Both “the” rows are equal: without positions, attention cannot tell them apart.",
  scores: "Every query is compared with every key by a dot product, divided by √d_k = 2 so the scores do not grow with the dimension. Row i says how relevant each token is to token i.",
  mask: "A decoder predicts the next token, so token i may only look at tokens 1…i. Entries above the diagonal are set to −∞, which softmax turns into exactly 0.",
  weights: "Softmax along each row turns scores into weights that are positive and sum to 1. With untrained random weights the pattern is arbitrary; training shapes it.",
  output: "Each output row is a weighted average of the value vectors: O = A·V. That mix is what the next layer sees for this position.",
};

for (const root of document.querySelectorAll("[data-llm-attn]")) {
  const stage = root.querySelector("[data-stage]");
  const explain = root.querySelector("[data-explain]");
  const o = outs(root);
  let step = "qkv", causal = true, seed = 3;
  onSeg(root, (v) => { step = v; render(); });
  onToggle(root, (_, on) => { causal = on; render(); });
  root.querySelector('[data-action="reseed"]').addEventListener("click", () => { seed++; render(); });

  function render() {
    const r = attention(seed, causal);
    const dims = ["d1", "d2", "d3", "d4"];
    const box = h("div", "flex flex-wrap items-start gap-x-5 gap-y-3");
    const add = (...nodes) => box.append(...nodes);
    const op = (s) => h("span", "self-center font-mono text-sm text-muted-foreground", s);
    if (step === "qkv") add(matrixTable("X", r.X, { cols: dims, note: "5×4" }), op("·W →"), matrixTable("Q", r.Q, { cols: dims }), matrixTable("K", r.K, { cols: dims }), matrixTable("V", r.V, { cols: dims }));
    if (step === "scores") add(matrixTable("Q", r.Q, { cols: dims }), op("·Kᵀ / 2 →"), matrixTable("S", r.S, { cols: ATTN_TOKENS, note: "query rows, key columns" }));
    if (step === "mask") add(matrixTable("S", r.S, { cols: ATTN_TOKENS }), op(causal ? "mask →" : "no mask →"), matrixTable("S′", r.Sm, { cols: ATTN_TOKENS }));
    if (step === "weights") add(matrixTable("S′", r.Sm, { cols: ATTN_TOKENS }), op("softmax rows →"), matrixTable("A", r.A, { cols: ATTN_TOKENS, heat: true }));
    if (step === "output") add(matrixTable("A", r.A, { cols: ATTN_TOKENS, heat: true }), op("·"), matrixTable("V", r.V, { cols: dims }), op("="), matrixTable("O", r.O, { cols: dims }));
    stage.replaceChildren(box);
    explain.textContent = ATTN_STEPS[step] + (step === "mask" && !causal ? " (The mask is off: every token sees the whole sequence, as in an encoder such as BERT.)" : "");
    const sums = r.A.map((row) => row.reduce((a, b) => a + b, 0));
    const maxDev = Math.max(...sums.map((x) => Math.abs(x - 1)));
    o.rowsum.textContent = `1 ± ${maxDev.toExponential(0)}`;
    let masked = 0;
    r.A.forEach((row, i) => row.forEach((v, j) => { if (j > i) masked += v; }));
    o.masked.textContent = causal ? String(masked) : "mask off";
  }
  render();
}

// ============================================================ Positional encodings

export function sinusoidal(pos, i, d) {
  const w = 1 / Math.pow(10000, (2 * Math.floor(i / 2)) / d);
  return i % 2 === 0 ? Math.sin(pos * w) : Math.cos(pos * w);
}

function rgbOf(css) {
  const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const span = document.createElement("span");
  span.hidden = true;
  document.body.append(span);
  span.style.color = css;
  c.fillStyle = getComputedStyle(span).color;
  span.remove();
  c.fillRect(0, 0, 1, 1);
  return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

function heatmap(canvas, rowsN, colsN, value, lo, hi) {
  const pos = rgbOf("var(--brand)"), neg = rgbOf("var(--vec-u)"), bg = rgbOf("var(--background)");
  canvas.width = colsN; canvas.height = rowsN;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(colsN, rowsN);
  for (let r = 0; r < rowsN; r++)
    for (let c = 0; c < colsN; c++) {
      const v = value(r, c);
      const t = v >= 0 ? Math.min(1, v / hi) : Math.min(1, v / lo);
      const col = v >= 0 ? pos : neg;
      const k = (r * colsN + c) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[k + ch] = bg[ch] + (col[ch] - bg[ch]) * t;
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  canvas.style.imageRendering = "pixelated";
}

for (const root of document.querySelectorAll("[data-llm-pe]")) {
  const peC = root.querySelector("[data-pe]"), dotC = root.querySelector("[data-dot]");
  const o = outs(root);
  const s = scrubAll(root, update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  function update() {
    const d = s.d.get(), n = s.n.get(), heads = s.heads.get();
    const PE = Array.from({ length: n }, (_, p) => Array.from({ length: d }, (_, i) => sinusoidal(p, i, d)));
    heatmap(peC, n, d, (r, c) => PE[r][c], -1, 1);
    const dot = (a, b) => a.reduce((x, v, i) => x + v * b[i], 0);
    heatmap(dotC, n, n, (r, c) => dot(PE[r], PE[c]) / (d / 2), -1, 1);
    // Relative positions are linear: each (sin, cos) pair at p + k is the
    // pair at p rotated by angle k·ω, whatever p is.
    const k = 5;
    let err = 0;
    for (let p = 0; p + k < n; p++)
      for (let i = 0; i < d; i += 2) {
        const w = 1 / Math.pow(10000, i / d);
        const c = Math.cos(k * w), sn = Math.sin(k * w);
        const [a, b] = [PE[p][i], PE[p][i + 1]];
        err = Math.max(err, Math.abs(a * c + b * sn - PE[p + k][i]), Math.abs(b * c - a * sn - PE[p + k][i + 1]));
      }
    o.check.textContent = `max err ${err.toExponential(1)}`;
    o.lambda.textContent = `${fmtBig(2 * Math.PI * Math.pow(10000, (d - 2) / d))} positions`;
    if (d % heads === 0) {
      o.dhead.textContent = d / heads;
      o.heads.textContent = `Multi-head attention: ${d} dimensions split into ${heads} head${heads > 1 ? "s" : ""} of ${d / heads}. Each head has its own W_q, W_k, W_v (${d}×${d / heads}), computes its own attention pattern, and the ${heads} outputs are concatenated and mixed by W_o (${d}×${d}). Total cost is about that of one full-width head.`;
    } else {
      o.dhead.textContent = "—";
      o.heads.textContent = `${d} is not divisible by ${heads}: pick a head count that divides d_model.`;
    }
  }
  update();
}

// ============================================================ Tiny model

const CTX = 3, EMB = 8;

export function tinyNet(V, H, rng) {
  const p = (n, sc) => Float64Array.from({ length: n }, () => gauss(rng) * sc);
  const I = CTX * EMB;
  const net = { V, H, C: p(V * EMB, 1), W1: p(I * H, 1 / Math.sqrt(I)), b1: new Float64Array(H), W2: p(H * V, 1 / Math.sqrt(H) * 0.5), b2: new Float64Array(V) };
  net.keys = ["C", "W1", "b1", "W2", "b2"];
  net.m = Object.fromEntries(net.keys.map((k) => [k, new Float64Array(net[k].length)]));
  net.v = Object.fromEntries(net.keys.map((k) => [k, new Float64Array(net[k].length)]));
  net.t = 0;
  return net;
}

// Forward pass for one example: returns hidden activations and probabilities.
export function forward(net, ctx) {
  const { V, H, C, W1, b1, W2, b2 } = net;
  const I = CTX * EMB;
  const x = new Float64Array(I);
  for (let c = 0; c < CTX; c++) for (let e = 0; e < EMB; e++) x[c * EMB + e] = C[ctx[c] * EMB + e];
  const hdn = new Float64Array(H);
  for (let j = 0; j < H; j++) {
    let a = b1[j];
    for (let i = 0; i < I; i++) a += x[i] * W1[i * H + j];
    hdn[j] = Math.tanh(a);
  }
  const logits = new Float64Array(V);
  let mx = -Infinity;
  for (let k = 0; k < V; k++) {
    let a = b2[k];
    for (let j = 0; j < H; j++) a += hdn[j] * W2[j * V + k];
    logits[k] = a;
    if (a > mx) mx = a;
  }
  let z = 0;
  for (let k = 0; k < V; k++) z += (logits[k] = Math.exp(logits[k] - mx));
  for (let k = 0; k < V; k++) logits[k] /= z;
  return { x, hdn, p: logits };
}

// One Adam step on a minibatch; returns the mean cross-entropy.
export function trainStep(net, data, batch, lr, rng, wd = 0) {
  const { V, H, W1, W2 } = net;
  const I = CTX * EMB;
  const g = Object.fromEntries(net.keys.map((k) => [k, new Float64Array(net[k].length)]));
  let loss = 0;
  for (let b = 0; b < batch; b++) {
    const [ctx, y] = data[Math.floor(rng() * data.length)];
    const { x, hdn, p } = forward(net, ctx);
    loss -= Math.log(p[y] + 1e-12);
    const dlog = p; dlog[y] -= 1; // softmax + cross-entropy gradient
    const dh = new Float64Array(H);
    for (let j = 0; j < H; j++) {
      let s = 0;
      for (let k = 0; k < V; k++) { g.W2[j * V + k] += hdn[j] * dlog[k]; s += W2[j * V + k] * dlog[k]; }
      dh[j] = s * (1 - hdn[j] * hdn[j]);
    }
    for (let k = 0; k < V; k++) g.b2[k] += dlog[k];
    for (let i = 0; i < I; i++) {
      let s = 0;
      for (let j = 0; j < H; j++) { g.W1[i * H + j] += x[i] * dh[j]; s += W1[i * H + j] * dh[j]; }
      g.C[ctx[Math.floor(i / EMB)] * EMB + (i % EMB)] += s;
    }
    for (let j = 0; j < H; j++) g.b1[j] += dh[j];
  }
  net.t++;
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (const k of net.keys) {
    const w = net[k], m = net.m[k], v = net.v[k], gr = g[k];
    for (let i = 0; i < w.length; i++) {
      const gi = gr[i] / batch;
      m[i] = b1 * m[i] + (1 - b1) * gi;
      v[i] = b2 * v[i] + (1 - b2) * gi * gi;
      w[i] -= (lr * (m[i] / (1 - b1 ** net.t))) / (Math.sqrt(v[i] / (1 - b2 ** net.t)) + eps) + lr * wd * w[i];
    }
  }
  return loss / batch;
}

export const meanLoss = (net, data) => data.reduce((a, [c, y]) => a - Math.log(forward(net, c).p[y] + 1e-12), 0) / data.length;

for (const root of document.querySelectorAll("[data-llm-tiny]")) {
  const corpus = charText(corpusOf(root));
  const alpha = [...new Set(corpus)].sort();
  const id = new Map(alpha.map((c, i) => [c, i]));
  const V = alpha.length;
  const examples = [];
  const padded = " ".repeat(CTX) + corpus;
  for (let i = CTX; i < padded.length; i++) examples.push([[...padded.slice(i - CTX, i)].map((c) => id.get(c)), id.get(padded[i])]);
  const cut = Math.floor(examples.length * 0.9);
  const train = examples.slice(0, cut), val = examples.slice(cut);
  const svg = root.querySelector("[data-loss]");
  const sampleOut = root.querySelector("[data-sample]");
  const btn = root.querySelector('[data-action="play"]');
  const o = outs(root);
  let net, rng, hist, ema, steps;
  const s = scrubAll(root, (k) => { if (k === "hidden") reset(); });
  const show = (on) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    btn.querySelector("[data-label]").textContent = on ? "Pause" : "Train";
  };
  const run = loop(root, () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 10) {
      const l = trainStep(net, train, 32, s.lr.get(), rng, s.wd.get());
      ema = ema === null ? l : 0.95 * ema + 0.05 * l;
      steps++;
      if (steps % 50 === 0) hist.push([steps, ema, steps % 200 === 0 ? meanLoss(net, val) : null]);
    }
    readout();
    plot();
  });
  btn.addEventListener("click", () => { run.set(!run.playing); show(run.playing); });
  root.querySelector('[data-action="reset"]').addEventListener("click", reset);
  root.querySelector('[data-action="sample"]').addEventListener("click", sample);

  function reset() {
    rng = mulberry32(11);
    net = tinyNet(V, s.hidden.get(), rng);
    steps = 0; ema = null;
    hist = [[0, meanLoss(net, train.slice(0, 400)), meanLoss(net, val)]];
    const P = net.keys.reduce((a, k) => a + net[k].length, 0);
    o.params.textContent = P.toLocaleString("en");
    readout();
    plot();
  }

  function readout() {
    o.steps.textContent = steps.toLocaleString("en");
    o.train.textContent = num(ema ?? hist[0][1], 3);
    const lastVal = [...hist].reverse().find((r) => r[2] !== null);
    o.val.textContent = num(lastVal[2], 3);
    o.uniform.textContent = `${num(Math.log(V), 3)} (ln ${V})`;
  }

  function plot() {
    svg.replaceChildren();
    const xMax = Math.max(1000, steps);
    const yMax = Math.ceil(Math.log(V) + 0.3);
    const f = frame(svg, { box: [40, 14, 500, 150], x: [0, xMax], y: [0, yMax], yticks: [0, 1, 2, 3, yMax].filter((v, i, a) => v <= yMax && a.indexOf(v) === i), xticks: [0, xMax / 2, xMax].map(Math.round), xfmt: fmtBig, xlabel: "steps (batch 32)", ylabel: "cross-entropy (nats)" });
    hline(svg, f, Math.log(V), "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4", "uniform guess");
    polyline(svg, hist.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-width:1.75");
    const vals = hist.filter((r) => r[2] !== null);
    polyline(svg, vals.map(([x, , y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:1.75;stroke-dasharray:5 3");
    text(svg, 60, 196, "— train (smoothed)", { class: "fill-foreground font-mono text-[10px]" });
    text(svg, 190, 196, "- - validation", { class: "fill-brand font-mono text-[10px]" });
    const best = vals.reduce((m, r) => (r[2] < m[2] ? r : m), vals[0]);
    if (vals.at(-1)[2] > best[2] + 0.15) {
      el("circle", { cx: f.sx(best[0]), cy: f.sy(best[2]), r: 3.5, style: "fill:var(--brand)" }, svg);
      text(svg, 300, 196, `overfitting: best validation at step ${fmtBig(best[0])}`, { class: "fill-foreground font-mono text-[10px]" });
    }
  }

  function sample() {
    const T = s.temp.get();
    let ctx = [...(" ".repeat(CTX) + "alice ").slice(-CTX)].map((c) => id.get(c));
    let out = "";
    for (let i = 0; i < 160; i++) {
      const p = withTemp(forward(net, ctx).p, T);
      const k = draw(p);
      out += alpha[k];
      ctx = [...ctx.slice(1), k];
    }
    sampleOut.replaceChildren(h("span", "text-muted-foreground", "alice "), out);
    sampleOut.prepend(h("span", "mr-2 font-sans text-[11px] text-muted-foreground", `after ${steps.toLocaleString("en")} steps:`));
  }

  reset();
  show(false);
}

// ============================================================ Sampling

const CANDIDATES = [["time", 5.0], ["day", 2.6], ["midnight", 2.1], ["hill", 1.6], ["star", 1.3], ["dream", 1.0], ["kingdom", 0.8], ["teapot", 0.3], ["Tuesday", 0.0], ["spreadsheet", -0.8]];

// Returns the distribution a strategy samples from: temperature first,
// then truncation and renormalisation.
export function decode(logits, { strategy, T, k, p }) {
  const n = logits.length;
  const base = softmaxRow(logits.map((l) => l / (strategy === "greedy" ? 1 : T)));
  const order = [...base.keys()].sort((a, b) => base[b] - base[a]);
  let keep;
  if (strategy === "greedy") keep = [order[0]];
  else if (strategy === "temperature") keep = order;
  else if (strategy === "topk") keep = order.slice(0, Math.min(k, n));
  else {
    keep = [];
    let cum = 0;
    for (const i of order) { keep.push(i); cum += base[i]; if (cum >= p - 1e-12) break; }
  }
  const mass = keep.reduce((a, i) => a + base[i], 0);
  const final = base.map((v, i) => (keep.includes(i) ? v / mass : 0));
  return { base, final, keep, mass };
}

for (const root of document.querySelectorAll("[data-llm-sampling]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const logits = CANDIDATES.map((c) => c[1]);
  let strategy = "greedy", tally = null;
  const s = scrubAll(root, () => { tally = null; update(); });
  onSeg(root, (v) => { strategy = v; tally = null; update(); });
  root.querySelector('[data-action="sample"]').addEventListener("click", () => {
    const d = cur();
    const i = draw(d.final);
    o.pick.textContent = CANDIDATES[i][0];
    if (!reduced()) o.pick.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 200 });
  });
  root.querySelector('[data-action="sample1000"]').addEventListener("click", () => {
    const d = cur();
    tally = new Array(CANDIDATES.length).fill(0);
    for (let n = 0; n < 1000; n++) tally[draw(d.final)]++;
    update();
  });

  const cur = () => decode(logits, { strategy, T: s.temp.get(), k: s.k.get(), p: s.p.get() });

  function update() {
    const d = cur();
    for (const [name, field] of [["temp", "temperature"], ["k", "topk"], ["p", "topp"]]) {
      const lbl = root.querySelector(`[data-scrub="${name}"]`).closest("label");
      const active = name === "temp" ? strategy !== "greedy" : strategy === field;
      lbl.classList.toggle("opacity-40", !active);
    }
    svg.replaceChildren();
    const max = Math.max(...d.final, ...d.base);
    const f = frame(svg, { box: [96, 8, 440, 220], x: [0, Math.max(0.2, max)], y: [0, CANDIDATES.length], xticks: [0, 0.25, 0.5, 0.75, 1].filter((v) => v <= Math.max(0.2, max) + 1e-9), xfmt: (v) => v.toFixed(2) });
    const bh = 220 / CANDIDATES.length;
    CANDIDATES.forEach(([w], i) => {
      const y = 8 + i * bh;
      const kept = d.keep.includes(i);
      text(svg, 88, y + bh / 2 + 4, w, { "text-anchor": "end", class: `font-mono text-[11px] ${kept ? "fill-foreground" : "fill-muted-foreground"}` });
      el("rect", { x: f.sx(0), y: y + 3, width: f.sx(d.base[i]) - f.sx(0), height: bh - 6, rx: 2, style: "fill:currentColor;fill-opacity:0.12" }, svg);
      if (kept) el("rect", { x: f.sx(0), y: y + 6, width: Math.max(1, f.sx(d.final[i]) - f.sx(0)), height: bh - 12, rx: 2, style: "fill:var(--brand);fill-opacity:0.85" }, svg);
      const label = kept ? (d.final[i] * 100).toFixed(1) + "%" : "cut";
      const end = f.sx(Math.max(d.final[i], d.base[i]));
      const full = label + (tally ? `  · ${tally[i]}/1000` : "");
      if (end > 440) text(svg, end - 6, y + bh / 2 + 4, full, { "text-anchor": "end", style: "fill:var(--background)" });
      else text(svg, end + 4, y + bh / 2 + 4, full);
    });
    text(svg, 96, 254, "grey: after temperature · colour: what is sampled from", {});
    o.kept.textContent = `${d.keep.length} of ${CANDIDATES.length}`;
    o.mass.textContent = d.mass.toFixed(3);
    o.entropy.textContent = (-d.final.reduce((a, v) => a + (v > 0 ? v * Math.log2(v) : 0), 0)).toFixed(2) + " bits";
    o.tally.textContent = tally ? `1000 samples: ${CANDIDATES.map(([w], i) => [w, tally[i]]).filter(([, c]) => c).map(([w, c]) => `${w} ${c}`).join(" · ")}` : "";
  }
  update();
}

// ============================================================ Cost

for (const root of document.querySelectorAll("[data-llm-cost]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let bytes = 2;
  const s = scrubAll(root, update);
  onSeg(root, (v) => { bytes = Number(v); update(); });

  function update() {
    const L = s.layers.get(), d = s.d.get(), heads = s.heads.get(), Vv = s.vocab.get(), n = s.n.get(), B = s.batch.get();
    const dh = d / heads;
    const params = 12 * L * d * d + Vv * d;
    const weights = params * bytes;
    const kvTok = 2 * L * heads * dh * bytes;
    const kv = kvTok * n * B;
    o.params.textContent = `≈ ${fmtBig(params)}`;
    o.weights.textContent = fmtBytes(weights);
    o.kv.textContent = fmtBytes(kv);
    o.kvtok.textContent = fmtBytes(kvTok) + (Number.isInteger(dh) ? "" : " (heads ∤ d)");
    o.flops.textContent = `≈ ${fmtBig(4 * L * n * n * d)} / pass`;

    svg.replaceChildren();
    const nMax = Math.max(8192, Math.pow(2, Math.ceil(Math.log2(n * 1.25))));
    const gb = (b) => b / 1e9;
    const yMax = Math.max(gb(weights), gb(kvTok * nMax * B)) * 1.1;
    const nice = (v) => { const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map((m) => m * e).find((m) => m >= v / 4); };
    const step = nice(yMax);
    const yt = []; for (let v = 0; v <= yMax; v += step) yt.push(v);
    const f = frame(svg, { box: [52, 16, 480, 230], x: [0, nMax], y: [0, yMax], xticks: [0, nMax / 4, nMax / 2, (3 * nMax) / 4, nMax], yticks: yt, xfmt: fmtBig, yfmt: (v) => (v < 1 ? v.toPrecision(1) : String(+v.toFixed(1))), xlabel: "context length n (tokens)", ylabel: "memory (GB)" });
    hline(svg, f, gb(weights), "stroke:var(--foreground);stroke-opacity:0.6;stroke-dasharray:5 4", "weights");
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(nMax), f.sy(gb(kvTok * nMax * B))]], "stroke:var(--brand);stroke-width:2");
    // Attention cost ∝ n², scaled so it meets the KV line at the chosen n.
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const x = (nMax * i) / 120, y = gb(kv) * (x / n) ** 2;
      if (y > yMax) break;
      pts.push([f.sx(x), f.sy(y)]);
    }
    polyline(svg, pts, "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:2 3");
    el("circle", { cx: f.sx(n), cy: f.sy(gb(kv)), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    text(svg, f.sx(n) + 8, f.sy(gb(kv)) + 16, `KV ${fmtBytes(kv)}`, { class: "fill-foreground font-mono text-[10px]" });
    text(svg, 60, 290, "— KV cache (linear in n)", { class: "fill-brand font-mono text-[10px]" });
    text(svg, 230, 290, "··· attention compute (∝ n², relative)", { style: "fill:var(--vec-u)" });
  }
  update();
}

// ============================================================ Pipeline

for (const root of document.querySelectorAll("[data-llm-pipeline]")) {
  const btns = [...root.querySelectorAll("[data-stage]")];
  const panels = [...root.querySelectorAll("[data-panel]")];
  const go = (i) => {
    btns.forEach((b, j) => { b.toggleAttribute("data-on", i === j); b.setAttribute("aria-pressed", String(i === j)); });
    panels.forEach((p, j) => (p.hidden = i !== j));
  };
  btns.forEach((b, i) => {
    b.addEventListener("click", () => go(i));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const j = (i + d + btns.length) % btns.length;
      go(j);
      btns[j].focus();
    });
  });
  go(0);
}

// ============================================================ Evaluation

for (const root of document.querySelectorAll("[data-llm-eval]")) {
  const corpus = charText(corpusOf(root));
  const n = 3, k = 0.01;
  const m = ngramModel(corpus, n);
  const input = root.querySelector("[data-prompt]");
  const o = outs(root);
  const go = () => {
    const prompt = input.value.toLowerCase();
    let ctx = (" ".repeat(n) + prompt).slice(-(n - 1));
    let out = "", logp = 0, seenCtx = 0;
    for (let i = 0; i < 60; i++) {
      if (m.table.has(ctx)) seenCtx++;
      const p = m.probs(ctx, k);
      let best = 0;
      for (let j = 1; j < p.length; j++) if (p[j] > p[best]) best = j;
      out += m.alpha[best];
      logp += Math.log(p[best]);
      ctx = (ctx + m.alpha[best]).slice(-(n - 1));
    }
    o.continuation.replaceChildren(h("span", "text-muted-foreground", input.value), h("span", "text-brand", out));
    const words = prompt.split(/\s+/).filter(Boolean);
    const unseen = words.filter((w) => !corpus.includes(w));
    o.confidence.textContent = `mean probability of each chosen character ${Math.exp(logp / 60).toFixed(2)}` +
      (unseen.length ? ` · never in the training text: ${unseen.map((w) => `“${w}”`).join(", ")} — the model continues anyway` : " · every prompt word appears in the training text");
  };
  root.querySelector('[data-action="continue"]').addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  go();
}
