// Shared code for the phylogenetics blocks: unrooted trees as edge lists,
// rooted trees as nested nodes, UPGMA and neighbour joining, splits for
// comparing topologies, Jukes–Cantor simulation and distances, Fitch
// parsimony, a binomial sampler and rectangular tree drawing. Imported,
// never run on its own.

import { mulberry32, gauss, tCdf } from "./stats-math.js";
import { el, text, frame, polyline, num } from "./plot.js";

export { mulberry32, gauss, tCdf, el, text, frame, polyline, num };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onAction = (root, fn) =>
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b && root.contains(b)) fn(b.dataset.action, b);
  });
export const neg = (s) => String(s).replace(/-/g, "−");
export const pct = (v, d = 1) => num(100 * v, d) + "%";

/** A play/pause button's look. */
export function setPlaying(btn, on, labels = ["Run", "Pause"]) {
  if (!btn) return;
  btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", on);
  btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !on);
  const l = btn.querySelector("[data-label]");
  if (l) l.textContent = on ? labels[1] : labels[0];
}

/** Calls fn(visible) when the element enters or leaves the viewport. */
export function whenVisible(node, fn) {
  new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting)), { rootMargin: "100px" }).observe(node);
}

export const niceTicks = (a, b, n = 6) => {
  const raw = (b - a) / n;
  if (!(raw > 0)) return [a];
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
};
export const tickFmt = (v) => neg(Math.abs(v) < 1e-9 ? "0" : String(+v.toPrecision(4)));

/** Runs work(i) for i = 0..n-1 in slices of about 12 ms, then done(). */
export function chunked(n, work, progress, done) {
  let i = 0, cancelled = false;
  const tick = () => {
    if (cancelled) return;
    const t0 = performance.now();
    while (i < n && performance.now() - t0 < 12) work(i++);
    progress?.(i, n);
    if (i < n) setTimeout(tick, 0);
    else done?.();
  };
  setTimeout(tick, 0);
  return () => (cancelled = true);
}

// ------------------------------------------------------------ binomial

/** Exact binomial draw by CDF inversion (cost about n·min(p, 1−p)). */
export function binom(rng, n, p) {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  if (p > 0.5) return n - binom(rng, n, 1 - p);
  const q = 1 - p, r = p / q;
  let u = rng(), k = 0, f = q ** n;
  if (f === 0 || n * p * q > 200) {
    // Large counts: a rounded normal draw, accurate to well under one
    // count here and far cheaper than walking the CDF.
    const m = n * p, s = Math.sqrt(n * p * q);
    return Math.max(0, Math.min(n, Math.round(m + s * gauss(rng))));
  }
  while (u > f && k < n) {
    u -= f;
    f *= (r * (n - k)) / (k + 1);
    k++;
  }
  return k;
}

// ------------------------------------------------------------ trees

// An unrooted tree is { n, edges: [[u, v, len], ...] } with leaves 0..n-1.
// A rooted tree is a node { id?, name?, len, c?: [child, ...] }.

export function adjacency(g) {
  const adj = new Map();
  for (const [u, v, len] of g.edges) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push([v, len]);
    adj.get(v).push([u, len]);
  }
  return adj;
}

/** Roots an unrooted tree at the middle of the edge to leaf `out`. */
export function rootAt(g, out = 0) {
  const adj = adjacency(g);
  const build = (v, from, len) => {
    const kids = adj.get(v).filter(([w]) => w !== from).map(([w, l]) => build(w, v, l));
    return kids.length ? { id: v, len, c: kids } : { id: v, len };
  };
  const [nb, len] = adj.get(out)[0];
  return { id: -1, len: 0, c: [{ id: out, len: len / 2 }, build(nb, out, len / 2)] };
}

export const tips = (t, acc = []) => {
  if (!t.c) acc.push(t);
  else for (const c of t.c) tips(c, acc);
  return acc;
};

/** Non-trivial splits of a rooted or unrooted tree on n leaves, as keys. */
export function splitsOf(t, n) {
  const out = new Set();
  const all = (1n << BigInt(n)) - 1n;
  const walk = (node) => {
    if (!node.c) return 1n << BigInt(node.id);
    let m = 0n;
    for (const c of node.c) m |= walk(c);
    let k = m & 1n ? all ^ m : m;
    const size = popcount(k);
    if (size >= 2 && size <= n - 2) out.add(k.toString());
    return m;
  };
  walk(t);
  return out;
}
const popcount = (m) => {
  let c = 0;
  while (m) { c += Number(m & 1n); m >>= 1n; }
  return c;
};
export const sameSplits = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

/** The leaf set of a split key, as leaf indices. */
export const splitLeaves = (key, n) => {
  const m = BigInt(key), out = [];
  for (let i = 0; i < n; i++) if ((m >> BigInt(i)) & 1n) out.push(i);
  return out;
};

/** Split key for the tips under a node (normalised away from leaf 0). */
export function nodeSplit(node, n) {
  let m = 0n;
  for (const t of tips(node)) m |= 1n << BigInt(t.id);
  const all = (1n << BigInt(n)) - 1n;
  return (m & 1n ? all ^ m : m).toString();
}

// ------------------------------------------------------------ distances

/** UPGMA with steps: returns { tree, steps: [{a, b, h}] } (rooted, ultrametric). */
export function upgma(D) {
  const n = D.length;
  let clusters = D.map((_, i) => ({ node: { id: i, len: 0, h: 0 }, size: 1 }));
  let d = D.map((r) => r.slice());
  const steps = [];
  while (clusters.length > 1) {
    let bi = 0, bj = 1, best = Infinity;
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) if (d[i][j] < best - 1e-12) { best = d[i][j]; bi = i; bj = j; }
    const A = clusters[bi], B = clusters[bj], h = best / 2;
    A.node.len = Math.max(0, h - A.node.h);
    B.node.len = Math.max(0, h - B.node.h);
    const node = { id: -2 - steps.length, len: 0, h, c: [A.node, B.node] };
    steps.push({ a: tips(A.node).map((t) => t.id), b: tips(B.node).map((t) => t.id), h });
    const row = clusters.map((_, k) => (d[bi][k] * A.size + d[bj][k] * B.size) / (A.size + B.size));
    const keep = clusters.map((_, k) => k).filter((k) => k !== bi && k !== bj);
    const nd = keep.map((k) => keep.map((l) => d[k][l]));
    keep.forEach((k, i) => nd[i].push(row[k]));
    nd.push([...keep.map((k) => row[k]), 0]);
    clusters = [...keep.map((k) => clusters[k]), { node, size: A.size + B.size }];
    d = nd;
  }
  return { tree: clusters[0].node, steps };
}

/** Neighbour joining (Saitou & Nei 1987): { g, steps: [{a, b, q, la, lb}] }. */
export function nj(D) {
  const n = D.length;
  const edges = [], steps = [];
  let ids = D.map((_, i) => i);
  let d = D.map((r) => r.slice());
  let next = n;
  const members = new Map(ids.map((i) => [i, [i]]));
  while (ids.length > 3) {
    const m = ids.length;
    const r = d.map((row) => row.reduce((s, v) => s + v, 0));
    let bi = 0, bj = 1, best = Infinity;
    for (let i = 0; i < m; i++)
      for (let j = i + 1; j < m; j++) {
        const q = (m - 2) * d[i][j] - r[i] - r[j];
        if (q < best - 1e-12) { best = q; bi = i; bj = j; }
      }
    const la = d[bi][bj] / 2 + (r[bi] - r[bj]) / (2 * (m - 2));
    const lb = d[bi][bj] - la;
    const u = next++;
    edges.push([ids[bi], u, la], [ids[bj], u, lb]);
    members.set(u, [...members.get(ids[bi]), ...members.get(ids[bj])]);
    steps.push({ a: members.get(ids[bi]), b: members.get(ids[bj]), q: best, la, lb });
    const row = ids.map((_, k) => (d[bi][k] + d[bj][k] - d[bi][bj]) / 2);
    const keep = ids.map((_, k) => k).filter((k) => k !== bi && k !== bj);
    const nd = keep.map((k) => keep.map((l) => d[k][l]));
    keep.forEach((k, i) => nd[i].push(row[k]));
    nd.push([...keep.map((k) => row[k]), 0]);
    ids = [...keep.map((k) => ids[k]), u];
    d = nd;
  }
  if (ids.length === 3) {
    const [a, b, c] = [0, 1, 2];
    const u = next++;
    edges.push(
      [ids[a], u, (d[a][b] + d[a][c] - d[b][c]) / 2],
      [ids[b], u, (d[a][b] + d[b][c] - d[a][c]) / 2],
      [ids[c], u, (d[a][c] + d[b][c] - d[a][b]) / 2],
    );
  } else if (ids.length === 2) edges.push([ids[0], ids[1], d[0][1]]);
  return { g: { n, edges }, steps };
}

/** Path-length (patristic) distances between the leaves of an unrooted tree. */
export function patristic(g) {
  const adj = adjacency(g);
  return Array.from({ length: g.n }, (_, i) => {
    const dist = new Map([[i, 0]]), stack = [i];
    while (stack.length) {
      const v = stack.pop();
      for (const [w, l] of adj.get(v)) if (!dist.has(w)) { dist.set(w, dist.get(v) + l); stack.push(w); }
    }
    return Array.from({ length: g.n }, (_, j) => dist.get(j));
  });
}

// ------------------------------------------------------------ sequences

export const BASES = "ACGT";

/** Jukes–Cantor: probability that a site differs after distance d. */
export const jcP = (d) => 0.75 * (1 - Math.exp((-4 * d) / 3));
/** Jukes–Cantor distance from the share p of differing sites (Infinity past 3/4). */
export const jcD = (p) => (p >= 0.75 ? Infinity : -0.75 * Math.log(1 - (4 * p) / 3));

/** Evolves a sequence (array of 0..3) along a branch of length d. */
export function evolve(rng, seq, d) {
  const pc = jcP(d);
  return seq.map((b) => (rng() < pc ? (b + 1 + Math.floor(rng() * 3)) % 4 : b));
}

/** Simulates leaf sequences on a rooted tree: array indexed by leaf id. */
export function simulate(rng, tree, L) {
  const out = [];
  const go = (node, seq) => {
    const s = evolve(rng, seq, node.len || 0);
    if (!node.c) out[node.id] = s;
    else for (const c of node.c) go(c, s);
  };
  go(tree, Array.from({ length: L }, () => Math.floor(rng() * 4)));
  return out;
}

/** Pairwise JC distances, with saturated pairs capped at `cap`. */
export function jcMatrix(seqs, cols, cap = 5) {
  const n = seqs.length, L = cols ? cols.length : seqs[0].length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let diff = 0;
      if (cols) for (const c of cols) diff += seqs[i][c] !== seqs[j][c];
      else for (let c = 0; c < L; c++) diff += seqs[i][c] !== seqs[j][c];
      D[i][j] = D[j][i] = Math.min(cap, jcD(diff / L));
    }
  return D;
}

// ------------------------------------------------------------ parsimony

/** Fitch first pass for one site on a rooted tree whose leaves carry
 *  states (bitmasks A1 C2 G4 T8). Sets node.set; returns the change count. */
export function fitch(node, stateOf) {
  if (!node.c) { node.set = stateOf(node.id); return 0; }
  let cost = 0, inter = 15, uni = 0;
  for (const c of node.c) {
    cost += fitch(c, stateOf);
    inter &= c.set;
    uni |= c.set;
  }
  if (inter) node.set = inter;
  else { node.set = uni; cost += node.c.length - 1; }
  return cost;
}

/** Every unrooted binary tree on n leaves, by stepwise addition. */
export function allTrees(n) {
  let trees = [{ n, edges: [[0, n, 1], [1, n, 1], [2, n, 1]], next: n + 1 }];
  for (let k = 3; k < n; k++) {
    const grown = [];
    for (const t of trees)
      t.edges.forEach(([u, v], i) => {
        const w = t.next;
        const edges = t.edges.filter((_, j) => j !== i).map((e) => e.slice());
        edges.push([u, w, 1], [w, v, 1], [w, k, 1]);
        grown.push({ n, edges, next: w + 1 });
      });
    trees = grown;
  }
  return trees;
}

// ------------------------------------------------------------ drawing

/**
 * Lays out a rooted tree in a box: leaves top to bottom in order, x by
 * cumulative branch length (phylogram) or by node depth (cladogram).
 * Sets node.x, node.y; returns { leaves, nodes }.
 */
export function layout(tree, { x, y, w, h, phylogram = true, maxDepth } = {}) {
  const leaves = tips(tree);
  const nodes = [];
  const depth = (node, at) => {
    node.depth = at;
    nodes.push(node);
    if (node.c) for (const c of node.c) depth(c, at + (phylogram ? Math.max(0, c.len) : 1));
  };
  depth(tree, 0);
  if (!phylogram) {
    // Cladogram: leaves line up on the right.
    const height = (node) => (node.c ? 1 + Math.max(...node.c.map(height)) : 0);
    const H = height(tree);
    const set = (node) => { node.depth = H - height(node); if (node.c) node.c.forEach(set); };
    set(tree);
    for (const l of leaves) l.depth = H;
  }
  const D = maxDepth ?? Math.max(1e-9, ...leaves.map((l) => l.depth));
  leaves.forEach((l, i) => (l.y = leaves.length === 1 ? y + h / 2 : y + (i * h) / (leaves.length - 1)));
  const place = (node) => {
    node.x = x + (node.depth / D) * w;
    if (node.c) {
      node.c.forEach(place);
      node.y = (node.c[0].y + node.c[node.c.length - 1].y) / 2;
    }
  };
  place(tree);
  return { leaves, nodes };
}

/** Draws the elbows of a laid-out tree into parent g. style(child) styles a branch. */
export function drawBranches(g, tree, style = () => "stroke:currentColor;stroke-opacity:0.7;stroke-width:1.5") {
  const walk = (node) => {
    if (!node.c) return;
    for (const c of node.c) {
      const st = style(c);
      el("path", { d: `M${node.x.toFixed(1)},${node.y.toFixed(1)}V${c.y.toFixed(1)}H${c.x.toFixed(1)}`, style: "fill:none;stroke-linecap:round;" + st }, g);
      walk(c);
    }
  };
  walk(tree);
}

/** Tip labels to the right of each leaf. */
export function drawTips(g, leaves, name, attrs = {}) {
  for (const l of leaves) text(g, l.x + 5, l.y + 3.5, name(l), { class: "fill-foreground font-mono text-[11px]", ...attrs });
}
