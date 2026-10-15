// Combinatorics blocks, part one: stars and bars, Catalan objects in four
// views, partitions and Young diagrams, Glaisher's bijection and
// derangements. Counts are exact BigInts; nothing leaves the browser.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";
import { outs, VEC, fmtBig, fact, binom, ratio, node, onToggle, onAction, player, stepper, selectSeg, partitions, conjugate } from "./combinatorics-util.js";

const mix = (c, p) => `color-mix(in oklch, ${c} ${p}%, transparent)`;
const plus = (a) => a.join(" + ");

// ============================================================ stars and bars

for (const root of document.querySelectorAll("[data-comb-stars]")) {
  const svg = root.querySelector("[data-plot]");
  const line = root.querySelector('[data-line="code"]');
  const o = outs(root);
  let positive = false, k = 0, n = 1, m = 0, r = 0, N = 0, bars = null;
  const s = scrubAll(root, () => reset());
  onToggle(root, (_, on) => { positive = on; reset(); });

  function reset() {
    k = Math.round(s.k.get()); n = Math.round(s.n.get());
    m = positive ? k - n : k;
    r = n - 1; N = m + r;
    bars = m < 0 ? null : Array.from({ length: r }, (_, i) => i);
    draw();
  }

  // Boxes' contents from the bar positions among the N slots.
  function counts() {
    if (r === 0) return [m];
    const c = [bars[0]];
    for (let j = 1; j < r; j++) c.push(bars[j] - bars[j - 1] - 1);
    c.push(N - 1 - bars[r - 1]);
    return c;
  }
  function rank() {
    let x = 0n, prev = -1;
    for (let i = 0; i < r; i++) {
      for (let v = prev + 1; v < bars[i]; v++) x += binom(N - 1 - v, r - 1 - i);
      prev = bars[i];
    }
    return x;
  }
  function step(d) {
    if (!bars || r === 0) return;
    if (d > 0) {
      let i = r - 1;
      while (i >= 0 && bars[i] === N - r + i) i--;
      if (i < 0) bars = bars.map((_, j) => j);
      else { bars[i]++; for (let j = i + 1; j < r; j++) bars[j] = bars[j - 1] + 1; }
    } else {
      let i = r - 1;
      while (i >= 0 && bars[i] === (i ? bars[i - 1] + 1 : 0)) i--;
      if (i < 0) bars = bars.map((_, j) => N - r + j);
      else { bars[i]--; for (let j = i + 1; j < r; j++) bars[j] = N - r + j; }
    }
    draw();
  }
  player(root, step, 650);
  onAction(root, (a) => {
    if (a !== "random" || !bars) return;
    const slots = Array.from({ length: N }, (_, i) => i);
    for (let i = 0; i < r; i++) { const j = i + Math.floor(Math.random() * (N - i)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    bars = slots.slice(0, r).sort((a, b) => a - b);
    draw();
  });

  function draw() {
    svg.replaceChildren();
    const total = m < 0 ? 0n : binom(N, r);
    o.total.textContent = fmtBig(total);
    o.formula.textContent = positive ? `C(k − 1, n − 1) = C(${k - 1}, ${n - 1})` : `C(k + n − 1, n − 1) = C(${N}, ${r})`;
    if (!bars) {
      o.index.textContent = "—";
      line.replaceChildren(node("span", "text-muted-foreground", `Need at least one ball per box: k ≥ n (${k} < ${n}).`));
      text(svg, 320, 115, "no distribution: fewer balls than boxes", { "text-anchor": "middle" });
      return;
    }
    o.index.textContent = `${fmtBig(rank() + 1n)} of ${fmtBig(total)}`;
    // The string: stars and bars, bars in the accent colour.
    line.replaceChildren();
    if (positive && n > 0) line.append(node("span", "text-muted-foreground", "after one ball each: "));
    const isBar = new Set(bars);
    for (let t = 0; t < N; t++) line.append(isBar.has(t) ? node("span", "text-[var(--brand)] font-semibold", "|") : node("span", "", "●"));
    if (N === 0) line.append(node("span", "text-muted-foreground", "(empty string: one way)"));
    // The boxes.
    const c = counts();
    const gap = 10, W = 620, bw = Math.min(140, (W - gap * (n - 1)) / n), x0 = (640 - (bw * n + gap * (n - 1))) / 2;
    const top = 30, bot = 190, rad = Math.max(3, Math.min(11, bw / 6));
    const cols = Math.max(1, Math.floor((bw - 8) / (2 * rad + 3)));
    for (let j = 0; j < n; j++) {
      const x = x0 + j * (bw + gap);
      el("path", { d: `M${x},${top} V${bot} H${x + bw} V${top}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.45;stroke-width:1.5;stroke-linejoin:round" }, svg);
      const total = c[j] + (positive ? 1 : 0);
      for (let b = 0; b < total; b++) {
        const col = b % cols, row = Math.floor(b / cols);
        const cx = x + 4 + rad + col * (2 * rad + 3) + ((bw - 8) - cols * (2 * rad + 3) + 3) / 2;
        const cy = bot - 4 - rad - row * (2 * rad + 3);
        if (cy < top) break;
        const base = positive && b === 0;
        el("circle", { cx, cy, r: rad, style: base ? "fill:var(--muted-foreground);fill-opacity:0.45" : "fill:var(--vec-u)" }, svg);
      }
      text(svg, x + bw / 2, bot + 18, String(total), { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    }
    text(svg, 8, 16, positive ? "grey ball: the one every box gets first" : `${k} balls into ${n} boxes`);
  }
  reset();
}

// ============================================================ Catalan

function dyckWords(n) {
  const out = [];
  const rec = (s, open, close) => {
    if (s.length === 2 * n) { out.push(s); return; }
    if (open < n) rec(s + "(", open + 1, close);
    if (close < open) rec(s + ")", open, close + 1);
  };
  rec("", 0, 0);
  return out;
}
// ( A ) B → node with left A and right B.
function parseTree(s) {
  if (!s) return null;
  let d = 0, j = 0;
  for (; j < s.length; j++) { d += s[j] === "(" ? 1 : -1; if (d === 0) break; }
  return { l: parseTree(s.slice(1, j)), r: parseTree(s.slice(j + 1)) };
}
const tsize = (t) => (t ? 1 + tsize(t.l) + tsize(t.r) : 0);
const tkey = (t) => (t ? `(${tkey(t.l)},${tkey(t.r)})` : ".");
// Triangulation of the polygon on vertices i..j from a tree of j − i − 1 nodes.
function triangles(t, i, j, out) {
  if (!t) return out;
  const k = i + tsize(t.l) + 1;
  out.push([i, k, j]);
  triangles(t.l, i, k, out);
  triangles(t.r, k, j, out);
  return out;
}

for (const root of document.querySelectorAll("[data-comb-catalan]")) {
  const o = outs(root);
  const V = (name) => root.querySelector(`[data-view="${name}"]`);
  const pathSvg = V("path"), parens = V("parens"), treeSvg = V("tree"), polySvg = V("poly");
  let n = 3, words = [];
  selectSeg(root, "3");
  root.addEventListener("seg-change", (e) => { n = Number(e.detail.value); build(); st.go(0); });
  const st = stepper(root, () => words.length, show, 900);

  function build() {
    words = dyckWords(n);
    const trees = words.map(parseTree);
    const tri = trees.map((t) => triangles(t, 0, n + 1, []).map((x) => x.join("-")).sort().join("|"));
    const distinct = [new Set(words).size, new Set(trees.map(tkey)).size, new Set(tri).size];
    o.cn.textContent = fmtBig(words.length);
    o.distinct.textContent = distinct.join(" · ");
    o.formula.textContent = `C(${2 * n}, ${n})/${n + 1} = ${fmtBig(binom(2 * n, n))}/${n + 1}`;
  }

  function show(i) {
    const w = words[i], t = parseTree(w);
    o.index.textContent = `${i + 1} of ${words.length}`;
    // Matching bracket of the first one: the root split ( A ) B.
    let d = 0, j = 0;
    for (; j < w.length; j++) { d += w[j] === "(" ? 1 : -1; if (d === 0) break; }
    parens.replaceChildren(...[...w].map((ch, q) => node("span", q === 0 || q === j ? "text-[var(--brand)] font-semibold" : "", ch)));
    parens.setAttribute("aria-label", w);

    // Dyck path.
    pathSvg.replaceChildren();
    const dx = 280 / (2 * n), dy = Math.min(dx, 115 / n), y0 = 135;
    el("line", { x1: 10, x2: 290, y1: y0, y2: y0, style: "stroke:currentColor;stroke-opacity:0.3" }, pathSvg);
    for (let h = 1; h <= n; h++) el("line", { x1: 10, x2: 290, y1: y0 - h * dy, y2: y0 - h * dy, style: "stroke:currentColor;stroke-opacity:0.06" }, pathSvg);
    let y = 0;
    const pts = [[10, y0]];
    [...w].forEach((ch, q) => { y += ch === "(" ? 1 : -1; pts.push([10 + (q + 1) * dx, y0 - y * dy]); });
    polyline(pathSvg, pts, "stroke:var(--brand);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round");
    el("circle", { cx: pts[j + 1][0], cy: y0, r: 3.5, style: "fill:var(--brand)" }, pathSvg);
    text(pathSvg, Math.min(pts[j + 1][0], 286), y0 + 12, "first return", { "text-anchor": pts[j + 1][0] > 240 ? "end" : "middle" });

    // Binary tree: x by in-order position, y by depth.
    treeSvg.replaceChildren();
    const nodes = [];
    let order = 0, maxDepth = 0;
    const walk = (u, depth, parent) => {
      if (!u) return;
      walk(u.l, depth + 1, u);
      u.x = order++; u.depth = depth; u.parent = parent;
      maxDepth = Math.max(maxDepth, depth);
      nodes.push(u);
      walk(u.r, depth + 1, u);
    };
    walk(t, 0, null);
    const tx = (u) => (n === 1 ? 150 : 25 + (u.x * 250) / (n - 1));
    const ty = (u) => 22 + u.depth * Math.min(34, 125 / Math.max(1, maxDepth));
    for (const u of nodes) if (u.parent) el("line", { x1: tx(u.parent), y1: ty(u.parent), x2: tx(u), y2: ty(u), style: "stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5" }, treeSvg);
    for (const u of nodes) el("circle", { cx: tx(u), cy: ty(u), r: 7, style: u === t ? "fill:var(--brand)" : "fill:var(--background);stroke:currentColor;stroke-width:1.5" }, treeSvg);

    // Polygon: vertices 0 and n + 1 on the bottom edge.
    polySvg.replaceChildren();
    const P = n + 2, stepA = (2 * Math.PI) / P, R = 72, cx = 150, cy = 82;
    const vx = (v) => cx + R * Math.cos(Math.PI / 2 + stepA / 2 + v * stepA);
    const vy = (v) => cy + R * Math.sin(Math.PI / 2 + stepA / 2 + v * stepA);
    const tris = triangles(t, 0, n + 1, []);
    const [a, b, c] = tris[0];
    el("polygon", { points: [a, b, c].map((v) => `${vx(v)},${vy(v)}`).join(" "), style: `fill:${mix("var(--brand)", 28)}` }, polySvg);
    el("polygon", { points: Array.from({ length: P }, (_, v) => `${vx(v)},${vy(v)}`).join(" "), style: "fill:none;stroke:currentColor;stroke-opacity:0.45;stroke-width:1.5" }, polySvg);
    for (const [i0, k0, j0] of tris) {
      if (k0 - i0 > 1) el("line", { x1: vx(i0), y1: vy(i0), x2: vx(k0), y2: vy(k0), style: "stroke:currentColor;stroke-width:1.5" }, polySvg);
      if (j0 - k0 > 1) el("line", { x1: vx(k0), y1: vy(k0), x2: vx(j0), y2: vy(j0), style: "stroke:currentColor;stroke-width:1.5" }, polySvg);
    }
    el("line", { x1: vx(0), y1: vy(0), x2: vx(n + 1), y2: vy(n + 1), style: "stroke:var(--brand);stroke-width:2.5" }, polySvg);
    for (let v = 0; v < P; v++) el("circle", { cx: vx(v), cy: vy(v), r: 2.5, style: "fill:currentColor" }, polySvg);
  }
  build();
  st.go(0);
}

// ============================================================ partitions

const pCache = [1n];
function pBig(N) {
  for (let n = pCache.length; n <= N; n++) {
    let s = 0n;
    for (let k = 1; ; k++) {
      const g1 = (k * (3 * k - 1)) / 2, g2 = (k * (3 * k + 1)) / 2;
      if (g1 > n) break;
      const sign = k % 2 ? 1n : -1n;
      s += sign * pCache[n - g1];
      if (g2 <= n) s += sign * pCache[n - g2];
    }
    pCache[n] = s;
  }
  return pCache[N];
}

function young(svg, lam, x0, y0, cell, color, diag, caption) {
  text(svg, x0, y0 - 10, caption, { class: "fill-foreground font-mono text-[12px]" });
  lam.forEach((row, i) => {
    for (let j = 0; j < row; j++) {
      const onDiag = diag && i === j;
      el("rect", { x: x0 + j * cell, y: y0 + i * cell, width: cell, height: cell, style: `fill:${onDiag ? mix("var(--brand)", 45) : mix(color, 22)};stroke:currentColor;stroke-opacity:0.55;stroke-width:1` }, svg);
    }
  });
}

for (const root of document.querySelectorAll("[data-comb-part]")) {
  const svg = root.querySelector("[data-plot]");
  const line = root.querySelector('[data-line="sum"]');
  const o = outs(root);
  let selfOnly = false, all = [], list = [];
  const s = scrubAll(root, (name) => { if (name === "big") big(); else { build(); st.go(0); } });
  onToggle(root, (_, on) => { selfOnly = on; build(); st.go(0); });
  const st = stepper(root, () => list.length, show, 900);

  const isSelf = (lam) => { const c = conjugate(lam); return c.length === lam.length && c.every((v, i) => v === lam[i]); };
  function build() {
    const n = Math.round(s.n.get());
    all = partitions(n);
    const selfs = all.filter(isSelf);
    list = selfOnly ? selfs : all;
    o.pn.textContent = fmtBig(all.length);
    o.selfc.textContent = fmtBig(selfs.length);
  }
  function show(i) {
    const lam = list[i], c = conjugate(lam), n = Math.round(s.n.get());
    o.index.textContent = `${i + 1} of ${list.length}`;
    svg.replaceChildren();
    const dim = Math.max(lam[0], lam.length);
    const cell = Math.min(26, 210 / dim);
    const self = isSelf(lam);
    young(svg, lam, 30, 34, cell, "var(--vec-u)", self, `λ = (${lam.join(", ")})`);
    young(svg, c, 350, 34, cell, "var(--vec-v)", self, `λ′ = (${c.join(", ")})`);
    text(svg, 320, 140, "flip ⤢", { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[12px]" });
    line.textContent = `${n} = ${plus(lam)}   ↔   ${plus(c)}${self ? "   (self-conjugate: the diagonal is its mirror)" : ""}`;
  }
  function big() {
    const N = Math.round(s.big.get());
    const p = pBig(N);
    o.big.textContent = fmtBig(p);
    o.digits.textContent = String(String(p).length);
  }
  build(); big(); st.go(Math.floor(list.length / 3));
}

// ============================================================ Glaisher

function distinctParts(n, max = n, acc = [], out = []) {
  if (n === 0) { out.push(acc.slice()); return out; }
  for (let p = Math.min(n, max); p >= 1; p--) { acc.push(p); distinctParts(n - p, p - 1, acc, out); acc.pop(); }
  return out;
}
function oddCount(n) {
  const a = new Array(n + 1).fill(0n); a[0] = 1n;
  for (let c = 1; c <= n; c += 2) for (let i = c; i <= n; i++) a[i] += a[i - c];
  return a[n];
}
const oddCore = (p) => { while (p % 2 === 0) p /= 2; return p; };

for (const root of document.querySelectorAll("[data-comb-glaisher]")) {
  const svg = root.querySelector("[data-plot]");
  const from = root.querySelector('[data-line="from"]'), to = root.querySelector('[data-line="to"]');
  const o = outs(root);
  let list = [], idx = 0, parts = [], n = 12;
  const s = scrubAll(root, () => { build(); load(0); });
  onAction(root, (a) => {
    if (a === "prev") load(idx - 1);
    else if (a === "next") load(idx + 1);
    else if (a === "reset") load(idx);
    else if (a === "split") {
      const e = parts.filter((p) => p % 2 === 0);
      if (!e.length) return;
      const big = Math.max(...e);
      parts.splice(parts.indexOf(big), 1, big / 2, big / 2);
      parts.sort((a, b) => b - a);
      draw();
    }
  });

  function build() {
    n = Math.round(s.n.get());
    list = distinctParts(n);
    o.distinct.textContent = fmtBig(list.length);
    o.odd.textContent = fmtBig(oddCount(n));
  }
  function load(i) {
    idx = ((i % list.length) + list.length) % list.length;
    parts = list[idx].slice();
    o.index.textContent = `${idx + 1} of ${list.length}`;
    const final = list[idx].flatMap((p) => Array(p / oddCore(p)).fill(oddCore(p))).sort((a, b) => b - a);
    from.textContent = `${n} = ${plus(list[idx])}   (distinct parts)`;
    // Group equal odd parts: 5 + 1 + 1 + 1 → 5 + 1×3.
    const groups = [...new Set(final)].map((v) => { const k = final.filter((x) => x === v).length; return k > 1 ? `${v} (×${k})` : String(v); });
    to.textContent = `→ ${plus(groups)}   (odd parts)`;
    draw();
  }
  function draw() {
    svg.replaceChildren();
    const cores = [...new Set(list[idx].map(oddCore))].sort((a, b) => b - a);
    const left = parts.reduce((t, p) => t + (p / oddCore(p) - 1), 0);
    o.left.textContent = left ? String(left) : "0, all parts odd";
    const finalLen = list[idx].reduce((t, p) => t + p / oddCore(p), 0);
    const unit = 500 / n, rowH = Math.min(22, 230 / finalLen), gap = Math.min(4, rowH * 0.2);
    svg.setAttribute("viewBox", `0 0 640 ${Math.max(60, 20 + finalLen * rowH)}`);
    parts.forEach((p, i) => {
      const color = VEC[cores.indexOf(oddCore(p)) % VEC.length];
      const y = 10 + i * rowH;
      el("rect", { x: 20, y, width: p * unit, height: rowH - gap, rx: Math.min(4, rowH / 4), style: `fill:${mix(color, p % 2 ? 55 : 22)};stroke:${color};stroke-width:1` }, svg);
      for (let u = 1; u < p; u++) el("line", { x1: 20 + u * unit, x2: 20 + u * unit, y1: y, y2: y + rowH - gap, style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
      if (rowH >= 11) text(svg, 26 + p * unit, y + (rowH - gap) / 2 + 3.5, p % 2 ? `${p}` : `${p} = 2 × ${p / 2}`, { class: "fill-foreground font-mono text-[11px]" });
    });
  }
  build();
  // Open on the partition that needs the most halvings.
  const work = (q) => q.reduce((t, p) => t + p / oddCore(p) - 1, 0);
  load(list.reduce((b, q, i) => (work(q) > work(list[b]) ? i : b), 0));
}

// ============================================================ derangements

const dCache = [1n, 0n];
function derange(n) {
  for (let i = dCache.length; i <= n; i++) dCache[i] = BigInt(i - 1) * (dCache[i - 1] + dCache[i - 2]);
  return dCache[n];
}
function shuffle(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

for (const root of document.querySelectorAll("[data-comb-derange]")) {
  const [hats, chart] = root.querySelectorAll("[data-plot]");
  const o = outs(root);
  const sims = new Map();
  let perm = [];
  const s = scrubAll(root, (name) => { if (name === "big") big(); else { perm = shuffle(Math.round(s.n.get())); exact(); drawHats(); drawChart(); } });
  onAction(root, (a) => {
    const n = Math.round(s.n.get());
    if (a === "shuffle") { perm = shuffle(n); drawHats(); }
    if (a === "many") {
      let ok = 0;
      for (let t = 0; t < 10000; t++) { const q = shuffle(n); if (q.every((v, i) => v !== i)) ok++; }
      sims.set(n, ok / 10000);
      o.sim.textContent = `${(ok / 100).toFixed(2)} % of 10 000`;
      drawChart();
    }
  });

  function exact() {
    const n = Math.round(s.n.get());
    o.dn.textContent = fmtBig(derange(n));
    o.share.textContent = ratio(derange(n), fact(n), 10).toFixed(6);
    o.sim.textContent = sims.has(n) ? `${(sims.get(n) * 100).toFixed(2)} % of 10 000` : "—";
  }
  function big() { o.big.textContent = fmtBig(derange(Math.round(s.big.get()))); }

  function drawHats() {
    hats.replaceChildren();
    const n = perm.length, dx = 600 / Math.max(1, n), x = (i) => 20 + dx * (i + 0.5);
    const fixed = perm.filter((v, i) => v === i).length;
    o.fixed.textContent = fixed ? `${fixed} (person ${perm.map((v, i) => (v === i ? i + 1 : null)).filter(Boolean).join(", ")})` : "none: a derangement";
    text(hats, 8, 22, "person");
    text(hats, 8, 178, "hat");
    perm.forEach((h, i) => {
      const own = h === i;
      el("line", { x1: x(i), y1: 42, x2: x(h), y2: 148, style: own ? "stroke:var(--brand);stroke-width:2.5" : "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.25" }, hats);
    });
    for (let i = 0; i < n; i++) {
      const own = perm[i] === i;
      el("circle", { cx: x(i), cy: 34, r: Math.min(9, dx / 2.6), style: own ? "fill:var(--brand)" : "fill:var(--vec-u)" }, hats);
      el("rect", { x: x(i) - Math.min(9, dx / 2.6), y: 148, width: 2 * Math.min(9, dx / 2.6), height: 12, rx: 2, style: own ? "fill:var(--brand)" : "fill:var(--muted-foreground);fill-opacity:0.5" }, hats);
      if (dx >= 18) {
        text(hats, x(i), 22, String(i + 1), { "text-anchor": "middle" });
        text(hats, x(i), 178, String(i + 1), { "text-anchor": "middle" });
      }
    }
  }
  function drawChart() {
    chart.replaceChildren();
    const f = frame(chart, { box: [52, 16, 568, 150], x: [1, 12], y: [0, 0.6], xticks: [1, 2, 4, 6, 8, 10, 12], yticks: [0, 0.2, 0.368, 0.5], yfmt: (v) => v.toFixed(2), xlabel: "people n" });
    el("line", { x1: f.sx(1), x2: f.sx(12), y1: f.sy(1 / Math.E), y2: f.sy(1 / Math.E), style: "stroke:var(--muted-foreground);stroke-dasharray:4 4" }, chart);
    text(chart, f.sx(12), f.sy(1 / Math.E) - 5, "1/e", { "text-anchor": "end" });
    const pts = [];
    for (let n = 1; n <= 12; n++) pts.push([f.sx(n), f.sy(ratio(derange(n), fact(n)))]);
    polyline(chart, pts, "stroke:var(--brand);stroke-width:2");
    for (const p of pts) el("circle", { cx: p[0], cy: p[1], r: 3, style: "fill:var(--brand)" }, chart);
    for (const [n, v] of sims) if (n <= 12) el("circle", { cx: f.sx(n), cy: f.sy(v), r: 4.5, style: "fill:none;stroke:var(--vec-u);stroke-width:2" }, chart);
    const cur = Math.round(s.n.get());
    if (cur <= 12) el("line", { x1: f.sx(cur), x2: f.sx(cur), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.35" }, chart);
  }
  perm = shuffle(Math.round(s.n.get()));
  exact(); big(); drawHats(); drawChart();
}
