// Discrete mathematics blocks: graph editor, colouring, counting,
// pigeonhole and birthdays, Hanoi, Fibonacci, spanning trees, inclusion–exclusion.

import { scrubAll } from "./scrub.js";
import { frame, polyline, hline, num } from "./plot.js";
import { easeInOut } from "./svg.js";
import { reduced, outs, mulberry32, shuffle, playButton, svgPoint, node, action, onSeg, PALETTE, ticker } from "./discrete-util.js";

const letter = (i) => (i < 26 ? String.fromCharCode(65 + i) : `v${i}`);

// Edges between the same two vertices bow apart so parallel edges show.
function drawEdges(g, verts, edges, styleOf) {
  const groups = new Map();
  edges.forEach((e, idx) => {
    const key = e[0] < e[1] ? `${e[0]}-${e[1]}` : `${e[1]}-${e[0]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(idx);
  });
  for (const list of groups.values()) {
    list.forEach((idx, k) => {
      const [a, b] = edges[idx];
      const A = verts[a], B = verts[b];
      const off = (k - (list.length - 1) / 2) * 30;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const cx = (A.x + B.x) / 2 - (dy / len) * off, cy = (A.y + B.y) / 2 + (dx / len) * off;
      node("path", { d: `M${A.x} ${A.y} Q${cx} ${cy} ${B.x} ${B.y}`, style: "fill:none;" + styleOf(idx) }, g);
    });
  }
}

function drawVertex(g, v, label, fill, ring) {
  node("circle", { cx: v.x, cy: v.y, r: 14, style: `fill:${fill};stroke:${ring ?? "var(--foreground)"};stroke-width:${ring ? 3 : 1.5}` }, g);
  node("text", { x: v.x, y: v.y + 4, "text-anchor": "middle", class: "pointer-events-none fill-foreground font-mono text-[11px] font-medium" }, g, label);
}

// ============================================================ Graph editor

const ring = (n, cx, cy, r, phase = -Math.PI / 2) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos(phase + (2 * Math.PI * i) / n), y: cy + r * Math.sin(phase + (2 * Math.PI * i) / n) }));

const GRAPHS = {
  // Euler's Königsberg: A the Kneiphof island, B and C the banks, D the eastern island.
  konigsberg: () => ({ verts: [{ x: 250, y: 190 }, { x: 280, y: 55 }, { x: 280, y: 325 }, { x: 450, y: 190 }], edges: [[0, 1], [0, 1], [0, 2], [0, 2], [0, 3], [1, 3], [2, 3]] }),
  k4: () => ({ verts: ring(4, 280, 190, 130, -Math.PI / 4), edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] }),
  k33: () => ({ verts: [0, 1, 2].map((i) => ({ x: 170, y: 80 + i * 110 })).concat([0, 1, 2].map((i) => ({ x: 390, y: 80 + i * 110 }))), edges: [0, 1, 2].flatMap((i) => [3, 4, 5].map((j) => [i, j])) }),
  petersen: () => ({ verts: ring(5, 280, 190, 150).concat(ring(5, 280, 190, 70)), edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 7], [7, 9], [9, 6], [6, 8], [8, 5]] }),
  cycle: () => ({ verts: ring(6, 280, 190, 140), edges: [0, 1, 2, 3, 4, 5].map((i) => [i, (i + 1) % 6]) }),
  empty: () => ({ verts: [], edges: [] }),
};

function adjacency(n, edges) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  return adj;
}

function components(n, adj) {
  const comp = new Array(n).fill(-1);
  let c = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const stack = [s];
    comp[s] = c;
    while (stack.length) for (const w of adj[stack.pop()]) if (comp[w] < 0) { comp[w] = c; stack.push(w); }
    c++;
  }
  return { comp, count: c };
}

function bipartition(n, adj) {
  const side = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (side[s] >= 0) continue;
    side[s] = 0;
    const queue = [s];
    while (queue.length) {
      const v = queue.shift();
      for (const w of adj[v]) {
        if (side[w] < 0) { side[w] = 1 - side[v]; queue.push(w); }
        else if (side[w] === side[v]) return null;
      }
    }
  }
  return side;
}

for (const root of document.querySelectorAll("[data-dgraph]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let { verts, edges } = GRAPHS.konigsberg();
  let selected = -1, drag = null;

  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    ({ verts, edges } = GRAPHS[b.dataset.preset]());
    selected = -1;
    draw();
  }));

  const hit = ([x, y]) => verts.findIndex((v) => Math.hypot(v.x - x, v.y - y) < 18);

  svg.addEventListener("pointerdown", (e) => {
    const p = svgPoint(svg, e);
    const i = hit(p);
    if (i >= 0) {
      drag = { i, moved: false, shift: e.shiftKey, start: p };
      svg.setPointerCapture(e.pointerId);
    } else if (!e.shiftKey) {
      verts.push({ x: Math.max(16, Math.min(544, p[0])), y: Math.max(16, Math.min(364, p[1])) });
      selected = -1;
      draw();
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = svgPoint(svg, e);
    if (!drag.moved && Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) < 4) return;
    drag.moved = true;
    verts[drag.i] = { x: Math.max(16, Math.min(544, p[0])), y: Math.max(16, Math.min(364, p[1])) };
    draw();
  });
  svg.addEventListener("pointerup", () => {
    if (!drag) return;
    const { i, moved, shift } = drag;
    drag = null;
    if (moved) return;
    if (shift) {
      // Delete the vertex and renumber the edges after it.
      verts.splice(i, 1);
      edges = edges.filter(([a, b]) => a !== i && b !== i).map(([a, b]) => [a > i ? a - 1 : a, b > i ? b - 1 : b]);
      selected = -1;
    } else if (selected >= 0 && selected !== i) {
      const has = edges.some(([a, b]) => (a === selected && b === i) || (a === i && b === selected));
      edges = has ? edges.filter(([a, b]) => !((a === selected && b === i) || (a === i && b === selected))) : [...edges, [selected, i]];
      selected = -1;
    } else {
      selected = selected === i ? -1 : i;
    }
    draw();
  });

  function draw() {
    svg.replaceChildren();
    const n = verts.length;
    const adj = adjacency(n, edges);
    const deg = adj.map((a) => a.length);
    const { comp, count } = components(n, adj);
    const side = n ? bipartition(n, adj) : null;
    const g = node("g", {}, svg);
    if (!n) node("text", { x: 280, y: 195, "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[11px]" }, g, "Click anywhere to add a vertex");
    drawEdges(g, verts, edges, () => "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:2");
    verts.forEach((v, i) => {
      const fill = side ? `color-mix(in oklab, ${side[i] ? "var(--brand)" : "var(--vec-u)"} 22%, var(--code-bg))` : "var(--code-bg)";
      drawVertex(g, v, letter(i), fill, i === selected ? "var(--brand)" : null);
      node("text", { x: v.x + 17, y: v.y - 12, class: "pointer-events-none fill-muted-foreground font-mono text-[10px]" }, g, String(deg[i]));
    });

    // Euler: every edge once needs one component holding all the edges,
    // and 0 (circuit) or 2 (path) vertices of odd degree.
    const odd = deg.map((d, i) => [d, i]).filter(([d]) => d % 2).map(([, i]) => i);
    const edgeComps = new Set(edges.map(([a]) => comp[a]));
    o.v.textContent = String(n);
    o.e.textContent = String(edges.length);
    o.deg.textContent = n ? [...deg].sort((a, b) => b - a).join(", ") : "—";
    o.conn.textContent = n ? (count === 1 ? "yes" : `no (${count} components)`) : "—";
    o.bip.textContent = n ? (side ? "yes" : "no (odd cycle)") : "—";
    let euler = "—", why = "Add edges to ask Euler's question.";
    if (edges.length) {
      if (edgeComps.size > 1) { euler = "none"; why = "The edges are not all in one connected piece."; }
      else if (odd.length === 0) { euler = "circuit"; why = "Every vertex has even degree, so a walk can use each edge once and come home."; }
      else if (odd.length === 2) { euler = `path ${letter(odd[0])} → ${letter(odd[1])}`; why = "Exactly two vertices have odd degree: the walk must start at one and end at the other."; }
      else { euler = "none"; why = `${odd.length} vertices have odd degree (${odd.map(letter).join(", ")}); a walk using every edge once allows at most two.`; }
    }
    o.euler.textContent = euler;
    o.why.textContent = why;
  }
  draw();
}

// ============================================================ Colouring

const COLOR_GRAPHS = {
  petersen: GRAPHS.petersen,
  wheel: () => ({ verts: [{ x: 280, y: 180 }, ...ring(5, 280, 180, 140)], edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1]] }),
  // Crown graph: K4,4 minus a perfect matching. Bipartite (χ = 2), but
  // greedy in the interleaved order u1, v1, u2, v2… uses four colours.
  crown: () => {
    const verts = [];
    for (let i = 0; i < 4; i++) verts.push({ x: 130 + i * 100, y: 80 }, { x: 130 + i * 100, y: 290 });
    const edges = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) edges.push([2 * i, 2 * j + 1]);
    return { verts, edges };
  },
  // A small planar "map": regions as vertices, shared borders as edges.
  map: () => ({
    verts: [{ x: 280, y: 60 }, { x: 140, y: 140 }, { x: 420, y: 140 }, { x: 280, y: 180 }, { x: 140, y: 280 }, { x: 420, y: 280 }, { x: 280, y: 320 }],
    edges: [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 6], [5, 6], [3, 6]],
  }),
};

for (const root of document.querySelectorAll("[data-dcolor]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let graph = COLOR_GRAPHS.petersen(), order = "index", seed = 1;
  let colors = [], at = 0, exact = null;
  const seq = () => {
    const n = graph.verts.length, idx = [...Array(n).keys()];
    if (order === "degree") {
      const deg = adjacency(n, graph.edges).map((a) => a.length);
      return idx.sort((a, b) => deg[b] - deg[a] || a - b);
    }
    return order === "random" ? shuffle(idx, mulberry32(seed)) : idx;
  };
  let visit = [];
  const reset = () => { colors = new Array(graph.verts.length).fill(-1); at = 0; exact = null; visit = seq(); draw(); };

  onSeg(root, (v) => {
    if (COLOR_GRAPHS[v]) graph = COLOR_GRAPHS[v]();
    else { order = v; if (v === "random") seed++; }
    reset();
  });
  action(root, "step", () => {
    if (exact) reset();
    if (at >= visit.length) return reset();
    const adj = adjacency(graph.verts.length, graph.edges);
    const v = visit[at++];
    const used = new Set(adj[v].map((w) => colors[w]));
    let c = 0;
    while (used.has(c)) c++;
    colors[v] = c;
    draw(v);
  });
  action(root, "exact", () => {
    // Smallest k with a proper k-colouring, by backtracking.
    const n = graph.verts.length, adj = adjacency(n, graph.edges);
    for (let k = 1; k <= n; k++) {
      const col = new Array(n).fill(-1);
      const go = (v) => {
        if (v === n) return true;
        for (let c = 0; c < k; c++) {
          if (adj[v].some((w) => col[w] === c)) continue;
          col[v] = c;
          if (go(v + 1)) return true;
        }
        col[v] = -1;
        return false;
      };
      if (go(0)) { exact = { k, col }; break; }
    }
    draw();
  });

  function draw(current = -1) {
    svg.replaceChildren();
    const g = node("g", {}, svg);
    const shown = exact ? exact.col : colors;
    drawEdges(g, graph.verts, graph.edges, (i) => {
      const [a, b] = graph.edges[i];
      const clash = shown[a] >= 0 && shown[a] === shown[b];
      return clash ? "stroke:var(--code-del);stroke-width:3" : "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:2";
    });
    graph.verts.forEach((v, i) => {
      const fill = shown[i] >= 0 ? PALETTE[shown[i] % PALETTE.length] : "var(--code-bg)";
      drawVertex(g, v, String(i + 1), fill, i === current ? "var(--foreground)" : null);
    });
    const greedyUsed = new Set(colors.filter((c) => c >= 0)).size;
    o.greedy.textContent = at ? `${greedyUsed}${at < visit.length ? " so far" : ""}` : "—";
    o.chi.textContent = exact ? String(exact.k) : "—";
    o.done.textContent = exact ? "exact colouring shown" : `${at} / ${visit.length}`;
  }
  reset();
}

// ============================================================ Counting

const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const choose = (n, k) => (k < 0 || k > n ? 0n : fact(n) / (fact(k) * fact(n - k)));
const big = (b) => b.toLocaleString("en-US");

for (const root of document.querySelectorAll("[data-dcount]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  function draw() {
    const n = Math.round(s.n.get()), k = Math.round(s.k.get());
    o.perm.textContent = big(k > n ? 0n : fact(n) / fact(n - k));
    o.comb.textContent = big(choose(n, k));
    o.seq.textContent = big(BigInt(n) ** BigInt(k));
    o.multi.textContent = big(n === 0 ? (k === 0 ? 1n : 0n) : choose(n + k - 1, k));
    o.rule.textContent = n >= 1 && k >= 1 && k <= n - 1
      ? `C(${n},${k}) = C(${n - 1},${k - 1}) + C(${n - 1},${k}) = ${big(choose(n - 1, k - 1))} + ${big(choose(n - 1, k))}`
      : `C(${n},${k}) = ${big(choose(n, k))}${k === 0 || k === n ? " (an edge of the triangle)" : ""}`;

    svg.replaceChildren();
    const R = 12, rowH = 25, cw = 41;
    for (let r = 0; r <= R; r++) {
      for (let c = 0; c <= r; c++) {
        const x = 280 + (c - r / 2) * cw, y = 18 + r * rowH;
        const hit = r === n && c === k, parent = r === n - 1 && (c === k - 1 || c === k) && k >= 1 && k <= n - 1;
        const fill = hit ? "var(--brand)" : parent ? "color-mix(in oklab, var(--vec-u) 30%, var(--code-bg))" : "transparent";
        node("rect", { x: x - cw / 2 + 2, y: y - 10, width: cw - 4, height: 20, rx: 5, style: `fill:${fill};stroke:currentColor;stroke-opacity:${hit || parent ? 0 : 0.08}` }, svg);
        node("text", { x, y: y + 4, "text-anchor": "middle", class: `font-mono text-[10px] ${hit ? "fill-white" : "fill-foreground"}` }, svg, String(choose(r, c)));
      }
    }
    if (n > R) node("text", { x: 280, y: 336, "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" }, svg, `row ${n} is below the drawing`);
  }
  draw();
}

// ============================================================ Pigeonhole and birthdays

for (const root of document.querySelectorAll("[data-dpigeon]")) {
  const holesSvg = root.querySelector("[data-holes]");
  const bdSvg = root.querySelector("[data-birthday]");
  const o = outs(root);
  let seed = 3;
  const s = scrubAll(root, draw);
  action(root, "shuffle", () => { seed++; draw(); });

  const pShared = (k) => { let q = 1; for (let i = 0; i < k; i++) q *= (365 - i) / 365; return 1 - q; };

  function draw() {
    const n = Math.round(s.n.get()), m = Math.round(s.m.get()), people = Math.round(s.people.get());
    const rng = mulberry32(seed * 977 + n * 31 + m);
    const count = new Array(m).fill(0);
    for (let i = 0; i < n; i++) count[Math.floor(rng() * m)]++;
    const max = Math.max(...count);

    holesSvg.replaceChildren();
    const cols = Math.min(m, 4), rows = Math.ceil(m / cols);
    const w = 280 / cols, hh = Math.min(110, 240 / rows);
    count.forEach((c, i) => {
      const x = 10 + (i % cols) * w, y = 10 + Math.floor(i / cols) * hh;
      const full = c === max;
      node("rect", { x: x + 3, y: y + 3, width: w - 6, height: hh - 6, rx: 8, style: `fill:${full ? "color-mix(in oklab, var(--brand) 12%, transparent)" : "transparent"};stroke:${full ? "var(--brand)" : "currentColor"};stroke-opacity:${full ? 1 : 0.25}` }, holesSvg);
      const per = Math.max(1, Math.floor((w - 16) / 12));
      for (let j = 0; j < c; j++) node("circle", { cx: x + 12 + (j % per) * 12, cy: y + 14 + Math.floor(j / per) * 12, r: 4, style: `fill:${full ? "var(--brand)" : "var(--vec-u)"}` }, holesSvg);
      node("text", { x: x + w - 10, y: y + hh - 10, "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" }, holesSvg, String(c));
    });

    bdSvg.replaceChildren();
    const f = frame(bdSvg, { box: [34, 12, 252, 210], x: [1, 80], y: [0, 1], xticks: [1, 23, 50, 80], yticks: [0, 0.5, 1], xlabel: "people", ylabel: "P(shared)" });
    hline(bdSvg, f, 0.5, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4");
    polyline(bdSvg, Array.from({ length: 80 }, (_, i) => [f.sx(i + 1), f.sy(pShared(i + 1))]), "stroke:var(--brand);stroke-width:1.75");
    node("circle", { cx: f.sx(people), cy: f.sy(pShared(people)), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, bdSvg);

    o.guar.textContent = `≥ ${Math.ceil(n / m)} in some hole`;
    o.max.textContent = String(max);
    o.pb.textContent = `${num(pShared(people) * 100, 1)}% (${people} people)`;
  }
  draw();
}

// ============================================================ Tower of Hanoi

for (const root of document.querySelectorAll("[data-dhanoi]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector('[data-action="play"]'), ["Solve", "Pause"]);
  let n = 4, pegs, moves, at, anim = null, moveToken = 0;
  const s = scrubAll(root, () => { n = Math.round(s.n.get()); reset(); });

  const solve = (k, from, to, via, out) => { if (!k) return out; solve(k - 1, from, via, to, out); out.push([from, to, k]); solve(k - 1, via, to, from, out); return out; };
  function reset() {
    t.stop();
    pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
    moves = solve(n, 0, 2, 1, []);
    at = 0;
    anim = null;
    moveToken++;
    draw();
  }
  const pegX = (p) => 100 + p * 180;
  const diskW = (d) => 30 + (d / n) * 120;

  function doMove() {
    if (at >= moves.length) return false;
    const [from, to, d] = moves[at++];
    pegs[from].pop();
    const startY = 214 - pegs[from].length * 20;
    pegs[to].push(d);
    const endY = 214 - (pegs[to].length - 1) * 20;
    anim = { d, x: pegX(from), y: startY };
    draw(); // the readouts update at once; the disk then glides
    if (reduced()) { anim = null; draw(); return at < moves.length; }
    const t0 = performance.now(), dur = Math.max(120, 420 - n * 35), token = ++moveToken;
    const step = (now) => {
      if (token !== moveToken) return; // a newer move took over
      const u = Math.min(1, (now - t0) / dur);
      const e = easeInOut(u);
      // Up, across, down: one path parameterised by e.
      const lift = 40;
      let x, y;
      if (e < 0.3) { x = pegX(from); y = startY + (lift - startY) * (e / 0.3); }
      else if (e < 0.7) { x = pegX(from) + (pegX(to) - pegX(from)) * ((e - 0.3) / 0.4); y = lift; }
      else { x = pegX(to); y = lift + (endY - lift) * ((e - 0.7) / 0.3); }
      anim = { d, x, y };
      draw();
      if (u < 1) requestAnimationFrame(step); else { anim = null; draw(); }
    };
    requestAnimationFrame(step);
    return at < moves.length;
  }

  const t = ticker(root, doMove, () => Math.max(160, 480 - n * 35));
  t.onChange = setPlay;
  action(root, "play", () => (t.playing ? t.stop() : (at >= moves.length && reset(), t.start())));
  action(root, "step", () => { t.stop(); doMove(); });
  action(root, "reset", reset);

  function draw() {
    svg.replaceChildren();
    node("rect", { x: 20, y: 234, width: 520, height: 8, rx: 3, style: "fill:currentColor;fill-opacity:0.25" }, svg);
    [0, 1, 2].forEach((p) => {
      node("rect", { x: pegX(p) - 3, y: 50, width: 6, height: 186, rx: 3, style: "fill:currentColor;fill-opacity:0.25" }, svg);
      node("text", { x: pegX(p), y: 256, "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" }, svg, "ABC"[p]);
      pegs[p].forEach((d, i) => {
        if (anim && anim.d === d && i === pegs[p].length - 1 && p === moves[at - 1]?.[1]) return;
        node("rect", { x: pegX(p) - diskW(d) / 2, y: 214 - i * 20, width: diskW(d), height: 18, rx: 5, style: `fill:${PALETTE[(d - 1) % PALETTE.length]};stroke:var(--background);stroke-width:1.5` }, svg);
      });
    });
    if (anim) node("rect", { x: anim.x - diskW(anim.d) / 2, y: anim.y, width: diskW(anim.d), height: 18, rx: 5, style: `fill:${PALETTE[(anim.d - 1) % PALETTE.length]};stroke:var(--background);stroke-width:1.5` }, svg);
    o.move.textContent = `${at} / ${moves.length}`;
    o.total.textContent = `2^${n} − 1 = ${2 ** n - 1}`;
    o.last.textContent = at ? `disk ${moves[at - 1][2]}: ${"ABC"[moves[at - 1][0]]} → ${"ABC"[moves[at - 1][1]]}` : "—";
  }
  reset();
}

// ============================================================ Fibonacci

const PHI = (1 + Math.sqrt(5)) / 2, PSI = (1 - Math.sqrt(5)) / 2;
const FIB = [0n, 1n];
for (let i = 2; i <= 300; i++) FIB.push(FIB[i - 1] + FIB[i - 2]);

for (const root of document.querySelectorAll("[data-dfib]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  function draw() {
    const n = Math.round(s.n.get());
    svg.replaceChildren();
    const top = 30;
    const f = frame(svg, { box: [40, 14, 504, 250], x: [1, top], y: [0.9, 2.1], xticks: [1, 5, 10, 15, 20, 25, 30], yticks: [1, 1.5, 2], xlabel: "n", ylabel: "F(n)/F(n−1)" });
    hline(svg, f, PHI, "stroke:var(--brand);stroke-dasharray:5 4", "φ = 1.6180339887…");
    const pts = [];
    for (let k = 2; k <= top; k++) pts.push([f.sx(k), f.sy(Number(FIB[k]) / Number(FIB[k - 1]))]);
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.5");
    pts.forEach(([x, y], i) => node("circle", { cx: x, cy: y, r: i + 2 === n ? 5 : 2.5, style: i + 2 === n ? "fill:var(--background);stroke:var(--brand);stroke-width:2" : "fill:var(--foreground)" }, svg));

    const F = FIB[n], digits = F.toString();
    o.f.textContent = digits.length > 28 ? `${digits.slice(0, 26)}…` : big(F);
    o.digits.textContent = String(digits.length);
    const ratio = n >= 2 ? Number(FIB[n]) / Number(FIB[n - 1]) : NaN;
    o.ratio.textContent = Number.isFinite(ratio) ? ratio.toFixed(12) : "—";
    o.err.textContent = Number.isFinite(ratio) ? (PHI - ratio).toExponential(2).replace("-", "−") : "—";
    const binet = Math.round((PHI ** n - PSI ** n) / Math.sqrt(5));
    o.binet.textContent = BigInt(binet) === F ? "matches exactly" : "differs: floating point ran out of digits";
  }
  draw();
}

// ============================================================ Spanning trees

const MST_VERTS = [{ x: 70, y: 90 }, { x: 210, y: 50 }, { x: 360, y: 70 }, { x: 490, y: 120 }, { x: 110, y: 260 }, { x: 250, y: 190 }, { x: 330, y: 300 }, { x: 480, y: 280 }];
const MST_EDGES = [[0, 1], [0, 4], [0, 5], [1, 2], [1, 5], [2, 3], [2, 5], [2, 6], [3, 7], [3, 6], [4, 5], [4, 6], [5, 6], [6, 7]];

for (const root of document.querySelectorAll("[data-dmst]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector('[data-action="play"]'), ["Run", "Pause"]);
  let algo = "kruskal", seed = 4, weights, state, order, parent, inTree, last;

  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  function reset() {
    t.stop();
    state = MST_EDGES.map(() => "idle");
    parent = MST_VERTS.map((_, i) => i);
    inTree = new Set([0]);
    order = MST_EDGES.map((_, i) => i).sort((a, b) => weights[a] - weights[b] || a - b);
    last = "—";
    draw();
  }
  function newWeights() {
    const rng = mulberry32(seed);
    weights = MST_EDGES.map(() => 1 + Math.floor(rng() * 19));
  }
  const name = (i) => `${letter(MST_EDGES[i][0])}–${letter(MST_EDGES[i][1])} (${weights[i]})`;

  function step() {
    const accepted = state.filter((x) => x === "tree").length;
    if (accepted === MST_VERTS.length - 1) return false;
    if (algo === "kruskal") {
      const i = order.find((e) => state[e] === "idle");
      if (i === undefined) return false;
      const [a, b] = MST_EDGES[i];
      if (find(a) !== find(b)) { parent[find(a)] = find(b); state[i] = "tree"; last = `${name(i)} added`; }
      else { state[i] = "skip"; last = `${name(i)} skipped: would close a cycle`; }
    } else {
      // Prim: cheapest edge with exactly one end in the tree.
      let best = -1;
      MST_EDGES.forEach(([a, b], i) => {
        if (state[i] === "tree" || inTree.has(a) === inTree.has(b)) return;
        if (best < 0 || weights[i] < weights[best]) best = i;
      });
      if (best < 0) return false;
      state[best] = "tree";
      MST_EDGES[best].forEach((v) => inTree.add(v));
      last = `${name(best)} added`;
    }
    draw();
    return state.filter((x) => x === "tree").length < MST_VERTS.length - 1;
  }
  const t = ticker(root, step, 550);
  t.onChange = setPlay;
  onSeg(root, (v) => { algo = v; reset(); });
  action(root, "step", () => { t.stop(); step(); });
  action(root, "play", () => (t.playing ? t.stop() : t.start()));
  action(root, "reset", reset);
  action(root, "shuffle", () => { seed++; newWeights(); reset(); });

  function draw() {
    svg.replaceChildren();
    const complete = state.filter((x) => x === "tree").length === MST_VERTS.length - 1;
    const nextK = algo === "kruskal" && !complete ? order.find((e) => state[e] === "idle") : -1;
    MST_EDGES.forEach(([a, b], i) => {
      const A = MST_VERTS[a], B = MST_VERTS[b];
      const st = state[i];
      const style = st === "tree" ? "stroke:var(--brand);stroke-width:4" : st === "skip" ? "stroke:var(--code-del);stroke-opacity:0.45;stroke-width:1.5;stroke-dasharray:4 4" : i === nextK ? "stroke:var(--foreground);stroke-width:2.5" : "stroke:currentColor;stroke-opacity:0.3;stroke-width:1.5";
      node("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, style }, svg);
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      node("rect", { x: mx - 11, y: my - 9, width: 22, height: 18, rx: 5, style: "fill:var(--code-bg);stroke:currentColor;stroke-opacity:0.2" }, svg);
      node("text", { x: mx, y: my + 4, "text-anchor": "middle", class: `font-mono text-[10px] ${st === "tree" ? "fill-brand" : "fill-foreground"}` }, svg, String(weights[i]));
    });
    MST_VERTS.forEach((v, i) => drawVertex(svg, v, letter(i), algo === "prim" && inTree.has(i) ? "color-mix(in oklab, var(--brand) 22%, var(--code-bg))" : "var(--code-bg)"));
    const tree = state.map((x, i) => (x === "tree" ? i : -1)).filter((i) => i >= 0);
    o.count.textContent = `${tree.length} / ${MST_VERTS.length - 1}`;
    o.total.textContent = String(tree.reduce((sum, i) => sum + weights[i], 0));
    o.last.textContent = last;
  }
  newWeights();
  reset();
}

// ============================================================ Inclusion–exclusion

for (const root of document.querySelectorAll("[data-dvenn]")) {
  const svg = root.querySelector("[data-plot]");
  const termsBox = root.querySelector("[data-terms]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const C = { A: [160, 130], B: [260, 130], C: [210, 215] }, R = 95;

  // Clip paths for each circle, so intersections are drawn exactly.
  const defs = node("defs", {}, svg);
  for (const k of "ABC") node("circle", { cx: C[k][0], cy: C[k][1], r: R }, node("clipPath", { id: `dvenn-clip-${k}` }, defs));
  const highlight = node("g", {}, svg);
  const base = node("g", {}, svg);
  const shape = (sets) => {
    // The first set's circle, clipped by each of the others in turn.
    let g = highlight;
    for (const k of sets.slice(1)) g = node("g", { "clip-path": `url(#dvenn-clip-${k})` }, g);
    node("circle", { cx: C[sets[0]][0], cy: C[sets[0]][1], r: R, style: "fill:var(--brand);fill-opacity:0.28" }, g);
  };
  for (const k of "ABC") {
    node("circle", { cx: C[k][0], cy: C[k][1], r: R, style: `fill:none;stroke:${{ A: "var(--vec-u)", B: "var(--brand)", C: "var(--ion-cl)" }[k]};stroke-width:2` }, base);
  }
  node("text", { x: 70, y: 50, class: "fill-foreground font-mono text-[12px]" }, base, "A");
  node("text", { x: 340, y: 50, class: "fill-foreground font-mono text-[12px]" }, base, "B");
  node("text", { x: 210, y: 316, "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" }, base, "C");
  const spots = { a: [118, 110], b: [302, 110], c: [210, 270], ab: [210, 95], ac: [160, 195], bc: [260, 195], abc: [210, 160] };
  const labels = Object.fromEntries(Object.entries(spots).map(([k, [x, y]]) => [k, node("text", { x, y, "text-anchor": "middle", class: "fill-foreground font-mono text-[13px] font-medium" }, base)]));

  const TERMS = [["+", "|A|", ["A"]], ["+", "|B|", ["B"]], ["+", "|C|", ["C"]], ["−", "|A∩B|", ["A", "B"]], ["−", "|A∩C|", ["A", "C"]], ["−", "|B∩C|", ["B", "C"]], ["+", "|A∩B∩C|", ["A", "B", "C"]]];

  function draw() {
    const r = Object.fromEntries(["a", "b", "c", "ab", "ac", "bc", "abc"].map((k) => [k, Math.round(s[k].get())]));
    for (const k in labels) labels[k].textContent = String(r[k]);
    const size = {
      "|A|": r.a + r.ab + r.ac + r.abc, "|B|": r.b + r.ab + r.bc + r.abc, "|C|": r.c + r.ac + r.bc + r.abc,
      "|A∩B|": r.ab + r.abc, "|A∩C|": r.ac + r.abc, "|B∩C|": r.bc + r.abc, "|A∩B∩C|": r.abc,
    };
    const union = Object.values(r).reduce((a, b) => a + b, 0);
    const formula = TERMS.reduce((acc, [sign, t]) => acc + (sign === "+" ? 1 : -1) * size[t], 0);
    o.union.textContent = `${union} (sum of regions)`;
    o.formula.textContent = `${TERMS.map(([sign, t], i) => `${i ? ` ${sign} ` : ""}${size[t]}`).join("")} = ${formula}`;
    termsBox.replaceChildren(...TERMS.map(([sign, t, sets]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rounded-full border px-2 py-0.5 text-muted-foreground outline-none transition-colors duration-150 hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand";
      b.textContent = `${sign} ${t} = ${size[t]}`;
      const on = () => { highlight.replaceChildren(); shape(sets); };
      const off = () => highlight.replaceChildren();
      b.addEventListener("pointerenter", on);
      b.addEventListener("focus", on);
      b.addEventListener("pointerleave", off);
      b.addEventListener("blur", off);
      return b;
    }));
  }
  draw();
}
