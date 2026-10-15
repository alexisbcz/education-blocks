// Information theory blocks, part one: entropy, Huffman, arithmetic coding,
// LZ77, Burrows–Wheeler, twenty questions and compressibility. Part two
// (channels, CRC, mutual information, DCT) is infotheory-codes.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const log2 = Math.log2;
const show = (c) => (c === " " ? "␣" : c === "\n" ? "↵" : c);

// Text inputs and their presets: a preset fills the input it names.
export function wireText(root, name, onChange) {
  const input = root.querySelector(`[data-info-text="${name}"]`);
  if (!input) return null;
  input.addEventListener("input", () => onChange(input.value));
  for (const b of root.querySelectorAll(`[data-info-preset="${name}"]`)) {
    b.addEventListener("click", () => {
      input.value = b.dataset.value;
      onChange(input.value);
    });
  }
  return input;
}

function counts(s) {
  const m = new Map();
  for (const c of s) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

function entropy(cs, total) {
  let h = 0;
  for (const [, n] of cs) {
    const p = n / total;
    h -= p * log2(p);
  }
  return h;
}

// ============================================================ Entropy

for (const root of document.querySelectorAll("[data-info-entropy]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const draw = (s) => {
    const chars = [...s];
    svg.replaceChildren();
    if (!chars.length) {
      for (const k of ["h", "hmax", "eff", "n", "total"]) o[k].textContent = "—";
      return;
    }
    const cs = counts(chars).slice(0, 40);
    const total = chars.length;
    const h = entropy(counts(chars), total);
    const n = counts(chars).length;
    const sMax = Math.max(1, ...cs.map(([, c]) => -log2(c / total)));
    const top = frame(svg, { box: [44, 12, 540, 104], x: [0, cs.length], y: [0, 1], yticks: [0, 0.5, 1], xticks: [], ylabel: "p(x)" });
    const bot = frame(svg, { box: [44, 156, 540, 104], x: [0, cs.length], y: [0, Math.ceil(sMax)], yticks: [0, Math.ceil(sMax)], xticks: [], ylabel: "bits" });
    const w = 540 / cs.length;
    cs.forEach(([c, k], i) => {
      const p = k / total;
      const x = 44 + i * w + w * 0.15;
      el("rect", { x, y: top.sy(p), width: w * 0.7, height: top.T + top.H - top.sy(p), rx: 1.5, style: "fill:var(--vec-u);fill-opacity:0.75" }, svg);
      const s2 = -log2(p);
      el("rect", { x, y: bot.sy(s2), width: w * 0.7, height: bot.T + bot.H - bot.sy(s2), rx: 1.5, style: "fill:var(--brand);fill-opacity:0.75" }, svg);
      text(svg, x + w * 0.35, 276, show(c), { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    });
    // The average surprisal is the entropy.
    el("line", { x1: bot.L, x2: bot.L + bot.W, y1: bot.sy(h), y2: bot.sy(h), style: "stroke:var(--foreground);stroke-dasharray:4 3" }, svg);
    text(svg, bot.L + bot.W, bot.sy(h) - 4, `H = ${num(h, 3)}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    const hmax = log2(n);
    o.h.textContent = `${num(h, 3)} bits/symbol`;
    o.hmax.textContent = `${num(hmax, 3)} bits`;
    o.eff.textContent = n > 1 ? `${num((100 * h) / hmax, 1)}%` : "—";
    o.n.textContent = `${n} distinct, ${total} total`;
    o.total.textContent = `${num(total * h, 1)} bits`;
  };
  const input = wireText(root, "text", draw);
  draw(input.value);
}

// ============================================================ Huffman

// huffman returns every forest from the leaves to the final tree, merging
// the two lightest roots each time. Ties break by the earliest-created
// node, so the build is deterministic.
export function huffman(cs) {
  let id = 0;
  let forest = cs.map(([sym, w]) => ({ id: id++, w, sym }));
  const states = [{ forest, merged: null }];
  while (forest.length > 1) {
    const sorted = [...forest].sort((a, b) => a.w - b.w || a.id - b.id);
    const [a, b] = sorted;
    const node = { id: id++, w: a.w + b.w, left: a, right: b };
    forest = forest.filter((t) => t !== a && t !== b).concat(node);
    states.push({ forest, merged: [a, b, node] });
  }
  return states;
}

function codesOf(tree) {
  const out = new Map();
  const walk = (t, code) => {
    if (t.sym !== undefined) out.set(t.sym, code || "0");
    else {
      walk(t.left, code + "0");
      walk(t.right, code + "1");
    }
  };
  walk(tree, "");
  return out;
}

const label = (t) => (t.sym !== undefined ? `'${show(t.sym)}'` : "node");

for (const root of document.querySelectorAll("[data-info-huffman]")) {
  const svg = root.querySelector("[data-tree]");
  const table = root.querySelector("[data-codes]");
  const stepP = root.querySelector("[data-step]");
  const bitsP = root.querySelector("[data-bits]");
  const o = outs(root);
  let msg = "", states = [], at = 0;

  const build = (s) => {
    msg = [...s].slice(0, 200).join("");
    const cs = counts([...msg]);
    states = cs.length ? huffman(cs) : [];
    at = Math.max(0, states.length - 1); // show the finished tree; Back replays it
    draw();
  };

  function drawForest(forest, highlight) {
    svg.replaceChildren();
    const depth = (t) => (t.sym !== undefined ? 0 : 1 + Math.max(depth(t.left), depth(t.right)));
    const maxD = Math.max(1, ...forest.map(depth));
    const leaves = [];
    const collect = (t) => (t.sym !== undefined ? leaves.push(t) : (collect(t.left), collect(t.right)));
    forest.forEach(collect);
    const W = 560, H = 300, dx = W / Math.max(1, leaves.length);
    const pos = new Map();
    const place = (t, d) => {
      if (t.sym !== undefined) {
        const x = dx * (leaves.indexOf(t) + 0.5);
        pos.set(t, [x, 0]);
        return x;
      }
      const x = (place(t.left, d + 1) + place(t.right, d + 1)) / 2;
      pos.set(t, [x, 0]);
      return x;
    };
    // y from the bottom: leaves at the bottom, roots higher by their height.
    const setY = (t) => {
      const [x] = pos.get(t);
      pos.set(t, [x, H - 26 - depth(t) * ((H - 52) / maxD)]);
      if (t.sym === undefined) (setY(t.left), setY(t.right));
    };
    forest.forEach((t) => (place(t, 0), setY(t)));
    const edges = (t) => {
      if (t.sym !== undefined) return;
      for (const [child, bit] of [[t.left, "0"], [t.right, "1"]]) {
        const [x1, y1] = pos.get(t), [x2, y2] = pos.get(child);
        el("line", { x1, y1, x2, y2, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.25" }, svg);
        text(svg, (x1 + x2) / 2 + (bit === "0" ? -7 : 4), (y1 + y2) / 2, bit, { class: "fill-muted-foreground font-mono text-[10px]" });
        edges(child);
      }
    };
    forest.forEach(edges);
    const nodes = (t) => {
      const [x, y] = pos.get(t);
      const hot = highlight && highlight.includes(t);
      const r = t.sym !== undefined ? 11 : 9;
      el("circle", { cx: x, cy: y, r, style: `fill:var(--background);stroke:${hot ? "var(--brand)" : "currentColor"};stroke-opacity:${hot ? 1 : 0.5};stroke-width:${hot ? 2 : 1.25}` }, svg);
      text(svg, x, y + 3.5, t.sym !== undefined ? show(t.sym) : String(t.w), { "text-anchor": "middle", class: `${t.sym !== undefined ? "fill-foreground" : "fill-muted-foreground"} font-mono text-[10px]` });
      if (t.sym !== undefined) text(svg, x, y + 24, String(t.w), { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
      if (t.sym === undefined) (nodes(t.left), nodes(t.right));
    };
    forest.forEach(nodes);
  }

  function draw() {
    table.replaceChildren();
    if (!states.length) {
      svg.replaceChildren();
      stepP.textContent = "Type a message.";
      bitsP.textContent = "";
      for (const k of ["avg", "h", "size", "decode"]) o[k].textContent = "—";
      return;
    }
    const st = states[at];
    const done = at === states.length - 1;
    drawForest(st.forest, st.merged);
    stepP.textContent = st.merged
      ? `Merge ${st.merged[0].w} (${label(st.merged[0])}) and ${st.merged[1].w} (${label(st.merged[1])}) into ${st.merged[2].w}. ${done ? "One tree left: done." : `${st.forest.length} trees left.`}`
      : `Start: one leaf per symbol, weighted by its count (${st.forest.length} leaves).`;
    const final = states[states.length - 1].forest[0];
    const codes = codesOf(final);
    const cs = counts([...msg]);
    const total = msg.length;
    const mk = (tag, txt, cls = "") => {
      const e = document.createElement(tag);
      e.textContent = txt;
      if (cls) e.className = cls;
      return e;
    };
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    tr.className = "border-b text-left text-muted-foreground";
    for (const t of ["symbol", "count", "code", "bits"]) tr.append(mk("th", t, "py-1 pr-3 font-normal"));
    thead.append(tr);
    const tbody = document.createElement("tbody");
    for (const [c, n] of cs) {
      const row = document.createElement("tr");
      row.className = "border-b last:border-b-0";
      const code = done ? codes.get(c) : "…";
      row.append(mk("td", show(c), "py-1 pr-3"), mk("td", String(n), "py-1 pr-3 tabular-nums"), mk("td", code, "py-1 pr-3 text-brand"), mk("td", done ? String(code.length) : "", "py-1 tabular-nums"));
      tbody.append(row);
    }
    table.append(thead, tbody);
    const h = entropy(cs, total);
    o.h.textContent = `${num(h, 3)} bits/symbol`;
    if (!done) {
      o.avg.textContent = o.size.textContent = o.decode.textContent = "build the tree first";
      bitsP.textContent = "";
      return;
    }
    const avg = cs.reduce((s, [c, n]) => s + (n / total) * codes.get(c).length, 0);
    const bits = [...msg].map((c) => codes.get(c)).join("");
    // Decode by walking the tree from the root.
    let out = "", t = final;
    if (final.sym !== undefined) out = msg;
    else for (const b of bits) {
      t = b === "0" ? t.left : t.right;
      if (t.sym !== undefined) (out += t.sym, (t = final));
    }
    o.avg.textContent = `${num(avg, 3)} bits/symbol (H ≤ L < H + 1)`;
    o.size.textContent = `${bits.length} bits vs ${8 * total} in 8-bit bytes`;
    o.decode.textContent = out === msg ? "yes, prefix-free" : "no";
    bitsP.textContent = bits.length > 600 ? bits.slice(0, 600) + "…" : bits;
  }

  root.querySelector("[data-action=next]").addEventListener("click", () => { at = Math.min(states.length - 1, at + 1); draw(); });
  root.querySelector("[data-action=back]").addEventListener("click", () => { at = Math.max(0, at - 1); draw(); });
  root.querySelector("[data-action=all]").addEventListener("click", () => { at = states.length - 1; draw(); });
  const input = wireText(root, "text", build);
  build(input.value);
}

// ============================================================ Arithmetic coding

// Probabilities are dyadic (1/2, 1/4, 1/4), so every bound is an exact
// fraction n / 4^s: BigInt numerators, nothing rounded.
const ARITH = { A: [0n, 2n], B: [2n, 1n], C: [3n, 1n] }; // [cumulative, size] in quarters

for (const root of document.querySelectorAll("[data-info-arith]")) {
  const svg = root.querySelector("[data-plot]");
  const stepP = root.querySelector("[data-step]");
  const o = outs(root);
  let msg = "", at = 0;

  const states = () => {
    const st = [{ low: 0n, wid: 1n, s: 0 }];
    for (const c of msg) {
      const { low, wid, s } = st[st.length - 1];
      const [cum, size] = ARITH[c];
      st.push({ low: low * 4n + wid * cum, wid: wid * size, s: s + 1, c });
    }
    return st;
  };
  const dec = (n, s) => Number(n) / 4 ** s;

  function draw() {
    const st = states();
    at = Math.min(at, st.length - 1);
    svg.replaceChildren();
    const L = 40, R = 580, rowH = 38;
    const first = Math.max(1, at - 5);
    text(svg, L, 14, at ? `step ${at} of ${msg.length}` : "the interval starts as [0, 1)", { class: "fill-muted-foreground font-mono text-[10px]" });
    let y = 24;
    for (let k = first; k <= at; k++) {
      const prev = st[k - 1], cur = st[k];
      // The previous interval fills the row; A, B and C split it.
      let x = L;
      for (const sym of ["A", "B", "C"]) {
        const w = ((R - L) * Number(ARITH[sym][1])) / 4;
        const hot = sym === cur.c;
        el("rect", { x: x + 1, y, width: w - 2, height: rowH - 14, rx: 3, style: `fill:${hot ? "var(--brand)" : "currentColor"};fill-opacity:${hot ? 0.75 : 0.06};stroke:currentColor;stroke-opacity:0.15` }, svg);
        text(svg, x + w / 2, y + 16, sym, { "text-anchor": "middle", class: `${hot ? "fill-white" : "fill-muted-foreground"} font-mono text-[11px]` });
        x += w;
      }
      text(svg, L - 6, y + 16, String(k), { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" });
      text(svg, R + 4, y + 9, num(dec(prev.low, prev.s), 6), { class: "fill-muted-foreground font-mono text-[9px]" });
      y += rowH;
    }
    if (at === 0) {
      el("rect", { x: L, y: 30, width: R - L, height: 24, rx: 3, style: "fill:currentColor;fill-opacity:0.06;stroke:currentColor;stroke-opacity:0.15" }, svg);
      text(svg, (L + R) / 2, 46, "[0, 1)", { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[11px]" });
    }
    const cur = st[at];
    const k = Math.round(-log2(Number(cur.wid) / 4 ** cur.s));
    const lo = dec(cur.low, cur.s), hi = dec(cur.low + cur.wid, cur.s);
    o.interval.textContent = `[${lo.toFixed(8)}, ${hi.toFixed(8)})`;
    o.width.textContent = at ? `2^−${k} = ${Number(cur.wid) / 4 ** cur.s}` : "1";
    o.ideal.textContent = `${k} bits`;
    // low is a multiple of 2^-k, so its first k binary digits name the interval.
    const bin = cur.low.toString(2).padStart(2 * cur.s, "0").slice(0, k);
    o.code.textContent = at ? `0.${bin}₂ (${bin.length} bits)` : "—";
    stepP.textContent = at ? `'${cur.c}' keeps ${cur.c === "A" ? "the first half" : cur.c === "B" ? "the third quarter" : "the last quarter"} of the previous interval.` : "";
  }

  root.querySelector("[data-action=next]").addEventListener("click", () => { at = Math.min(msg.length, at + 1); draw(); });
  root.querySelector("[data-action=back]").addEventListener("click", () => { at = Math.max(0, at - 1); draw(); });
  root.querySelector("[data-action=all]").addEventListener("click", () => { at = msg.length; draw(); });
  const input = wireText(root, "text", (s) => {
    msg = s.toUpperCase().replace(/[^ABC]/g, "").slice(0, 24);
    at = msg.length;
    draw();
  });
  msg = input.value.toUpperCase().replace(/[^ABC]/g, "");
  at = msg.length;
  draw();
}

// ============================================================ LZ77

export function lz77(s, W, L = 15) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    let best = 0, off = 0;
    for (let j = Math.max(0, i - W); j < i; j++) {
      let k = 0;
      // Matches may run into the lookahead (overlapping copies), but must
      // leave one symbol to send as "next".
      while (k < L && i + k < s.length - 1 && s[j + k] === s[i + k]) k++;
      if (k > best) (best = k, (off = i - j));
    }
    out.push({ pos: i, off, len: best, next: s[i + best] });
    i += best + 1;
  }
  return out;
}

export function unlz77(tr) {
  const a = [];
  for (const { off, len, next } of tr) {
    const start = a.length - off;
    for (let k = 0; k < len; k++) a.push(a[start + k]);
    a.push(next);
  }
  return a.join("");
}

for (const root of document.querySelectorAll("[data-info-lz]")) {
  const strip = root.querySelector("[data-strip]");
  const list = root.querySelector("[data-triples]");
  const o = outs(root);
  let s = "", tr = [], at = 0;
  const sc = scrubAll(root, () => rebuild(s));

  function rebuild(v) {
    s = [...v].slice(0, 120).join("");
    tr = lz77([...s], Math.round(sc.window.get()));
    at = Math.min(at, tr.length);
    draw();
  }

  function draw() {
    strip.replaceChildren();
    const chars = [...s];
    const cur = tr[at];
    const W = Math.round(sc.window.get());
    chars.forEach((c, i) => {
      const span = document.createElement("span");
      span.textContent = show(c);
      let cls = "flex h-7 min-w-5 items-center justify-center border-y border-r px-0.5 first:border-l";
      if (cur) {
        const inWin = i >= Math.max(0, cur.pos - W) && i < cur.pos;
        const src = cur.len && i >= cur.pos - cur.off && i < cur.pos - cur.off + cur.len;
        const look = i >= cur.pos && i < cur.pos + cur.len;
        if (i === cur.pos + cur.len) cls += " bg-brand/20 text-brand";
        else if (src || look) cls += " bg-add/20";
        else if (inWin) cls += " bg-vec-u/10";
        else if (i < cur.pos) cls += " text-muted-foreground/60";
        else cls += " text-muted-foreground";
      } else cls += " text-muted-foreground";
      span.className = cls;
      strip.append(span);
    });
    list.replaceChildren();
    tr.forEach((t, i) => {
      const li = document.createElement("li");
      li.textContent = `(${t.off}, ${t.len}, ${show(t.next)})`;
      li.className = "rounded-md border px-1.5 py-0.5 " + (i === at ? "border-brand text-brand" : i < at ? "" : "text-muted-foreground/50");
      list.append(li);
    });
    o.count.textContent = `${tr.length} (${at} emitted)`;
    o.len.textContent = String(chars.length);
    o.decode.textContent = unlz77(tr) === s ? "yes" : "no";
  }

  root.querySelector("[data-action=next]").addEventListener("click", () => { at = Math.min(tr.length, at + 1); draw(); });
  root.querySelector("[data-action=back]").addEventListener("click", () => { at = Math.max(0, at - 1); draw(); });
  root.querySelector("[data-action=all]").addEventListener("click", () => { at = tr.length; draw(); });
  const input = wireText(root, "text", (v) => { at = 0; rebuild(v); });
  rebuild(input.value);
}

// ============================================================ Burrows–Wheeler

export function bwt(s) {
  const t = s + "$";
  const rots = [...t].map((_, i) => t.slice(i) + t.slice(0, i)).sort();
  return { rots, last: rots.map((r) => r[r.length - 1]).join("") };
}

// The inverse uses the LF mapping: the k-th occurrence of a symbol in the
// last column is the k-th occurrence in the first.
export function invertFromLF(last) {
  const first = [...last].sort();
  const rank = [], seen = {};
  for (const c of last) rank.push((seen[c] = (seen[c] ?? 0) + 1) - 1);
  const start = {};
  first.forEach((c, i) => (start[c] ??= i));
  // Row 0 starts with "$"; walking LF from it spells the text backwards.
  let row = 0, out = "";
  for (let k = 0; k < last.length - 1; k++) {
    out = last[row] + out;
    row = start[last[row]] + rank[row];
  }
  return out;
}

const runs = (s) => (s ? s.split("").filter((c, i) => i === 0 || c !== s[i - 1]).length : 0);

for (const root of document.querySelectorAll("[data-info-bwt]")) {
  const o = outs(root);
  const q = (k) => root.querySelector(`[data-${k}]`);
  const draw = (v) => {
    const s = v.replace(/\$/g, "").slice(0, 40);
    const list = q("rotations");
    list.replaceChildren();
    if (!s) {
      for (const k of ["bwt", "mtf", "rle", "inverse"]) q(k).textContent = "—";
      return;
    }
    const { rots, last } = bwt(s);
    for (const r of rots) {
      const li = document.createElement("li");
      li.className = "whitespace-pre";
      const head = document.createElement("span");
      head.textContent = r.slice(0, -1).replace(/ /g, "␣");
      const tail = document.createElement("span");
      tail.textContent = show(r[r.length - 1]);
      tail.className = "rounded-sm bg-brand/15 px-0.5 text-brand";
      li.append(head, tail);
      list.append(li);
    }
    q("bwt").textContent = [...last].map(show).join("");
    // Move-to-front over the sorted alphabet.
    const alpha = [...new Set(last)].sort();
    const mtf = [];
    for (const c of last) {
      const i = alpha.indexOf(c);
      mtf.push(i);
      alpha.splice(i, 1);
      alpha.unshift(c);
    }
    q("mtf").textContent = mtf.join(" ");
    const rle = [];
    for (let i = 0; i < last.length; ) {
      let j = i;
      while (j < last.length && last[j] === last[i]) j++;
      rle.push(j - i > 1 ? `${show(last[i])}×${j - i}` : show(last[i]));
      i = j;
    }
    q("rle").textContent = rle.join(" ");
    const back = invertFromLF(last);
    q("inverse").textContent = back === s ? `${back}  ✓` : back;
    o.runsText.textContent = String(runs(s));
    o.runsBWT.textContent = String(runs(last));
    o.zeros.textContent = `${mtf.filter((x) => x === 0).length} of ${mtf.length}`;
  };
  const input = wireText(root, "text", draw);
  draw(input.value);
}

// ============================================================ Twenty questions

for (const root of document.querySelectorAll("[data-info-questions]")) {
  const o = outs(root);
  const qP = root.querySelector("[data-question]");
  const log = root.querySelector("[data-log]");
  const N = 1000;
  let lo = 1, hi = N, asked = 0;
  const mid = () => Math.floor((lo + hi) / 2);
  const render = () => {
    const left = hi - lo + 1;
    o.range.textContent = `${lo} – ${hi}`;
    o.left.textContent = String(left);
    o.bits.textContent = `${num(log2(N / left), 2)} bits in ${asked} answers`;
    o.need.textContent = `${num(log2(N), 3)} bits → ${Math.ceil(log2(N))} questions`;
    qP.textContent = left === 1 ? `It's ${lo}! Found with ${asked} questions.` : `Is it greater than ${mid()}?`;
    for (const b of root.querySelectorAll("[data-action=yes],[data-action=no]")) b.disabled = left === 1;
  };
  const answer = (yes) => {
    const before = hi - lo + 1, m = mid();
    if (yes) lo = m + 1;
    else hi = m;
    asked++;
    const after = hi - lo + 1;
    const li = document.createElement("li");
    li.textContent = `${asked}. > ${m}? ${yes ? "yes" : "no"}  →  ${before} → ${after} candidates, +${num(log2(before / after), 3)} bits`;
    log.prepend(li);
    render();
  };
  root.querySelector("[data-action=yes]").addEventListener("click", () => answer(true));
  root.querySelector("[data-action=no]").addEventListener("click", () => answer(false));
  root.querySelector("[data-action=restart]").addEventListener("click", () => {
    lo = 1; hi = N; asked = 0;
    log.replaceChildren();
    render();
  });
  render();
}

// ============================================================ Compressibility

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function gzipSize(s) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"));
  return (await new Response(stream).arrayBuffer()).byteLength;
}

const ENGLISH =
  "Information theory began in 1948, when Claude Shannon showed that every message source has a rate, its entropy, below which it cannot be compressed without loss, and that every noisy channel has a capacity, below which messages can be sent with as few errors as we like. Ordinary English is far from random: letters follow each other in predictable ways, whole words repeat, and grammar constrains what can come next, so a good compressor can squeeze it to a fraction of its size. Random letters leave nothing to exploit.";

for (const root of document.querySelectorAll("[data-info-kolmogorov]")) {
  const rowsEl = root.querySelector("[data-rows]");
  const rng = mulberry32(1948);
  const random = Array.from({ length: 500 }, () => String.fromCharCode(97 + Math.floor(rng() * 26))).join("");
  const fixed = [
    ["Pattern: \"ab\" × 250", "ab".repeat(250)],
    ["English prose", ENGLISH],
    ["Random letters (500)", random],
  ];
  let own = "";
  let token = 0;
  async function draw() {
    const mine = ++token;
    const items = [...fixed, ["Your string", own]];
    const sizes = await Promise.all(items.map(([, s]) => gzipSize(s)));
    if (mine !== token) return;
    rowsEl.replaceChildren();
    items.forEach(([name, s], i) => {
      const raw = new TextEncoder().encode(s).length;
      const z = sizes[i];
      const row = document.createElement("div");
      row.className = "flex flex-col gap-1";
      const head = document.createElement("div");
      head.className = "flex items-baseline justify-between gap-2 text-xs";
      const a = document.createElement("span");
      a.textContent = name;
      const b = document.createElement("span");
      b.className = "font-mono text-muted-foreground tabular-nums";
      b.textContent = z === null ? "gzip unavailable" : `${raw} B → ${z} B · ${raw ? num((8 * z) / [...s].length || 0, 2) : "—"} bits/char`;
      head.append(a, b);
      const bar = document.createElement("div");
      bar.className = "h-2 overflow-hidden rounded-full bg-foreground/8";
      const fill = document.createElement("div");
      fill.className = "h-full rounded-full bg-brand/70";
      fill.style.width = z === null || !raw ? "0%" : `${Math.min(100, (100 * z) / raw)}%`;
      bar.append(fill);
      row.append(head, bar);
      rowsEl.append(row);
    });
  }
  const input = wireText(root, "own", (v) => { own = v; draw(); });
  own = input.value;
  draw();
}
