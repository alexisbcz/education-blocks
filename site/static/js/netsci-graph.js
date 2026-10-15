// Network science helpers: seeded random graphs (Erdős–Rényi, Barabási–
// Albert, configuration model, Holme–Kim, random geometric), union–find,
// components, Louvain modularity, degree-preserving swaps and a
// Fruchterman–Reingold layout. No side effects: the page loads this module
// like the others and it does nothing on its own.

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

export function playButton(btn, labels = ["Run", "Pause"]) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// Theme colours are oklch; painting one pixel turns any CSS colour into RGB.
let probe, probeEl;
export function rgbOf(css) {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probeEl ??= document.createElement("span");
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

/** Community and series colours, in order. */
export const PALETTE = ["var(--vec-u)", "var(--brand)", "var(--vec-out)", "var(--vec-v)", "var(--vec-i)", "var(--vec-j)"];

// ------------------------------------------------------------ union–find

export function unionFind(n) {
  const parent = new Int32Array(n).map((_, i) => i);
  const size = new Int32Array(n).fill(1);
  let largest = n ? 1 : 0, count = n;
  const find = (a) => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  return {
    find, size,
    get largest() { return largest; },
    get count() { return count; },
    union(a, b) {
      a = find(a); b = find(b);
      if (a === b) return false;
      if (size[a] < size[b]) { const t = a; a = b; b = t; }
      parent[b] = a; size[a] += size[b]; count--;
      if (size[a] > largest) largest = size[a];
      return true;
    },
  };
}

// ------------------------------------------------------------ graphs

/** Edges as a flat list of [a, b] pairs, a < b, no duplicates. */
export function adjacency(n, edges) {
  const deg = new Int32Array(n);
  for (const [a, b] of edges) { deg[a]++; deg[b]++; }
  const adj = Array.from({ length: n }, (_, i) => new Int32Array(deg[i]));
  const fill = new Int32Array(n);
  for (const [a, b] of edges) { adj[a][fill[a]++] = b; adj[b][fill[b]++] = a; }
  return adj;
}

export const degrees = (n, edges) => {
  const d = new Int32Array(n);
  for (const [a, b] of edges) { d[a]++; d[b]++; }
  return d;
};

/** G(n, M) with M = round(k n / 2): the same as G(n, p) for large n. */
export function erdosRenyi(n, k, rng) {
  const M = Math.min(Math.round((k * n) / 2), (n * (n - 1)) / 2);
  const seen = new Set(), edges = [];
  while (edges.length < M) {
    let a = Math.floor(rng() * n), b = Math.floor(rng() * n);
    if (a === b) continue;
    if (a > b) { const t = a; a = b; b = t; }
    const key = a * n + b;
    if (seen.has(key)) continue;
    seen.add(key); edges.push([a, b]);
  }
  return edges;
}

/** Barabási–Albert: a clique of m + 1 nodes, then each new node links to m
 *  distinct nodes chosen with probability proportional to degree. */
export function barabasiAlbert(n, m, rng) {
  const edges = [], ends = [];
  const m0 = Math.min(m + 1, n);
  for (let a = 0; a < m0; a++) for (let b = a + 1; b < m0; b++) { edges.push([a, b]); ends.push(a, b); }
  for (let v = m0; v < n; v++) {
    const picked = new Set();
    while (picked.size < Math.min(m, v)) picked.add(ends[Math.floor(rng() * ends.length)]);
    for (const u of picked) { edges.push([u, v]); ends.push(u, v); }
  }
  return edges;
}

/** Holme–Kim: Barabási–Albert plus triad formation with probability pt,
 *  which keeps the power law and adds clustering. */
export function holmeKim(n, m, pt, rng) {
  const edges = [], ends = [], nb = Array.from({ length: n }, () => []);
  const has = new Set();
  const add = (a, b) => {
    const k = a < b ? a * n + b : b * n + a;
    if (a === b || has.has(k)) return false;
    has.add(k); edges.push(a < b ? [a, b] : [b, a]); ends.push(a, b); nb[a].push(b); nb[b].push(a);
    return true;
  };
  const m0 = m + 1;
  for (let a = 0; a < m0; a++) for (let b = a + 1; b < m0; b++) add(a, b);
  for (let v = m0; v < n; v++) {
    let last = -1, made = 0, guard = 0;
    while (made < m && guard++ < 50 * m) {
      if (last >= 0 && rng() < pt && nb[last].length) {
        const w = nb[last][Math.floor(rng() * nb[last].length)];
        if (add(v, w)) { made++; continue; }
      }
      const u = ends[Math.floor(rng() * ends.length)];
      if (add(v, u)) { made++; last = u; }
    }
  }
  return edges;
}

/** Erased configuration model with a power-law degree sequence
 *  p(k) ∝ k^−γ for kmin ≤ k ≤ √n (structural cutoff). */
export function powerLawConfig(n, gamma, kmin, rng) {
  const kmax = Math.max(kmin + 1, Math.floor(Math.sqrt(n) * 2));
  const w = [];
  for (let k = kmin; k <= kmax; k++) w.push(k ** -gamma);
  const total = w.reduce((s, x) => s + x, 0);
  const deg = [];
  for (let i = 0; i < n; i++) {
    let r = rng() * total, k = kmin;
    for (const x of w) { if ((r -= x) <= 0) break; k++; }
    deg.push(Math.min(k, kmax));
  }
  return configuration(deg, rng);
}

/** Stub matching; self-loops and repeated edges are dropped. */
export function configuration(deg, rng) {
  const n = deg.length, stubs = [];
  deg.forEach((k, i) => { for (let j = 0; j < k; j++) stubs.push(i); });
  if (stubs.length % 2) stubs.pop();
  shuffle(stubs, rng);
  const seen = new Set(), edges = [];
  for (let i = 0; i + 1 < stubs.length; i += 2) {
    let a = stubs[i], b = stubs[i + 1];
    if (a === b) continue;
    if (a > b) { const t = a; a = b; b = t; }
    const key = a * n + b;
    if (seen.has(key)) continue;
    seen.add(key); edges.push([a, b]);
  }
  return edges;
}

/** Random geometric graph in the unit square: nodes closer than r link. */
export function geometric(n, r, rng) {
  const pos = Array.from({ length: n }, () => [rng(), rng()]);
  const edges = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1];
    if (dx * dx + dy * dy < r * r) edges.push([a, b]);
  }
  return { pos, edges };
}

/** Components by union–find: label per node (0 = largest) and sizes. */
export function components(n, edges) {
  const uf = unionFind(n);
  for (const [a, b] of edges) uf.union(a, b);
  const rootSize = new Map();
  for (let i = 0; i < n; i++) { const r = uf.find(i); rootSize.set(r, uf.size[r]); }
  const order = [...rootSize.entries()].sort((x, y) => y[1] - x[1]);
  const rank = new Map(order.map(([r], i) => [r, i]));
  const label = new Int32Array(n);
  for (let i = 0; i < n; i++) label[i] = rank.get(uf.find(i));
  return { label, sizes: order.map(([, s]) => s), count: order.length };
}

// ------------------------------------------------------------ communities

/** Modularity Q = Σ_c [ L_c/m − (d_c / 2m)² ]. */
export function modularity(n, edges, comm, gamma = 1) {
  const m = edges.length;
  if (!m) return 0;
  const inside = new Map(), deg = new Map();
  for (const [a, b] of edges) {
    if (comm[a] === comm[b]) inside.set(comm[a], (inside.get(comm[a]) ?? 0) + 1);
    deg.set(comm[a], (deg.get(comm[a]) ?? 0) + 1);
    deg.set(comm[b], (deg.get(comm[b]) ?? 0) + 1);
  }
  let q = 0;
  for (const [c, d] of deg) q += (inside.get(c) ?? 0) / m - gamma * (d / (2 * m)) ** 2;
  return q;
}

/** Louvain (Blondel et al. 2008): local moves that raise modularity, then
 *  merge each community into one node and repeat until nothing moves. */
export function louvain(n, edges, rng, gamma = 1) {
  // Weighted graph as adjacency maps; self-loop weight stored separately.
  let N = n;
  let adj = Array.from({ length: N }, () => new Map());
  let self = new Float64Array(N);
  for (const [a, b] of edges) {
    adj[a].set(b, (adj[a].get(b) ?? 0) + 1);
    adj[b].set(a, (adj[b].get(a) ?? 0) + 1);
  }
  const m2 = 2 * edges.length;
  let member = Int32Array.from({ length: n }, (_, i) => i); // original node → current super-node
  if (!m2) return member;
  for (let level = 0; level < 20; level++) {
    const k = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 2 * self[i]; for (const w of adj[i].values()) s += w; k[i] = s; }
    const comm = Int32Array.from({ length: N }, (_, i) => i);
    const tot = Float64Array.from(k);
    let moved = true, any = false, passes = 0;
    const order = shuffle([...Array(N).keys()], rng);
    while (moved && passes++ < 50) {
      moved = false;
      for (const i of order) {
        const ci = comm[i];
        const links = new Map();
        for (const [j, w] of adj[i]) links.set(comm[j], (links.get(comm[j]) ?? 0) + w);
        tot[ci] -= k[i];
        let best = ci, gain = (links.get(ci) ?? 0) - (gamma * tot[ci] * k[i]) / m2;
        for (const [c, w] of links) {
          const g = w - (gamma * tot[c] * k[i]) / m2;
          if (g > gain + 1e-12) { gain = g; best = c; }
        }
        tot[best] += k[i];
        if (best !== ci) { comm[i] = best; moved = true; any = true; }
      }
    }
    if (!any) break;
    // Renumber communities and build the next level's graph.
    const ids = new Map();
    for (let i = 0; i < N; i++) if (!ids.has(comm[i])) ids.set(comm[i], ids.size);
    const M = ids.size;
    const nadj = Array.from({ length: M }, () => new Map());
    const nself = new Float64Array(M);
    for (let i = 0; i < N; i++) {
      const ci = ids.get(comm[i]);
      nself[ci] += self[i];
      for (const [j, w] of adj[i]) {
        const cj = ids.get(comm[j]);
        if (ci === cj) nself[ci] += w / 2;
        else nadj[ci].set(cj, (nadj[ci].get(cj) ?? 0) + w);
      }
    }
    member = member.map((s) => ids.get(comm[s]));
    adj = nadj; self = nself; N = M;
  }
  return member;
}

/** Normalised mutual information between two labelings. */
export function nmi(a, b) {
  const n = a.length, ca = new Map(), cb = new Map(), cab = new Map();
  for (let i = 0; i < n; i++) {
    ca.set(a[i], (ca.get(a[i]) ?? 0) + 1);
    cb.set(b[i], (cb.get(b[i]) ?? 0) + 1);
    const k = a[i] + "," + b[i];
    cab.set(k, (cab.get(k) ?? 0) + 1);
  }
  const H = (c) => -[...c.values()].reduce((s, x) => s + (x / n) * Math.log(x / n), 0);
  let I = 0;
  for (const [k, x] of cab) {
    const [p, q] = k.split(",");
    I += (x / n) * Math.log((x * n) / (ca.get(Number(p)) * cb.get(Number(q))));
  }
  const ha = H(ca), hb = H(cb);
  return ha + hb ? (2 * I) / (ha + hb) : 1;
}

// ------------------------------------------------------------ rewiring

/** Degree-preserving double edge swaps on an edge array (mutated in
 *  place). mode: "random", "assort" (join the two highest and the two
 *  lowest degrees) or "disassort" (join highest with lowest). Returns the
 *  number of swaps made. */
export function swapEdges(n, edges, deg, count, rng, mode = "random", bias = 1) {
  const key = (a, b) => (a < b ? a * n + b : b * n + a);
  const set = new Set(edges.map(([a, b]) => key(a, b)));
  let done = 0;
  for (let t = 0; t < count * 4 && done < count; t++) {
    const i = Math.floor(rng() * edges.length), j = Math.floor(rng() * edges.length);
    if (i === j) continue;
    const [a, b] = edges[i], [c, d] = edges[j];
    if (a === c || a === d || b === c || b === d) continue;
    let p, q, r, s;
    if (mode !== "random" && rng() < bias) {
      const four = [a, b, c, d].sort((x, y) => deg[y] - deg[x] || x - y);
      if (mode === "assort") { p = four[0]; q = four[1]; r = four[2]; s = four[3]; }
      else { p = four[0]; q = four[3]; r = four[1]; s = four[2]; }
    } else if (rng() < 0.5) { p = a; q = c; r = b; s = d; }
    else { p = a; q = d; r = b; s = c; }
    if (set.has(key(p, q)) || set.has(key(r, s))) continue;
    if ((key(p, q) === key(a, b) && key(r, s) === key(c, d)) || (key(p, q) === key(c, d) && key(r, s) === key(a, b))) continue;
    set.delete(key(a, b)); set.delete(key(c, d));
    set.add(key(p, q)); set.add(key(r, s));
    edges[i] = p < q ? [p, q] : [q, p];
    edges[j] = r < s ? [r, s] : [s, r];
    done++;
  }
  return done;
}

/** Newman's degree assortativity r: Pearson correlation of the degrees at
 *  either end of an edge. */
export function assortativity(edges, deg) {
  let s1 = 0, s2 = 0, s3 = 0;
  const m = edges.length;
  for (const [a, b] of edges) {
    const x = deg[a], y = deg[b];
    s1 += x * y; s2 += (x + y) / 2; s3 += (x * x + y * y) / 2;
  }
  const num = s1 / m - (s2 / m) ** 2, den = s3 / m - (s2 / m) ** 2;
  return den ? num / den : 0;
}

// ------------------------------------------------------------ layout

/** Fruchterman–Reingold (1991) in a w × h box, one iteration per step().
 *  Repulsion k²/d between every pair, attraction d²/k along edges, a pull
 *  toward the centre, and a temperature that caps each move and cools. */
export function forceLayout(n, edges, { w = 1, h = 1, rng = Math.random, scale = 1, gravity = 0.05, cooling = 0.97, pos, bounded = true } = {}) {
  const P = pos ?? Array.from({ length: n }, () => [w * (0.1 + 0.8 * rng()), h * (0.1 + 0.8 * rng())]);
  const state = { pos: P, t: w / 10, iter: 0, energy: 0, scale, gravity, cooling, fixed: -1 };
  state.step = () => {
    const k = state.scale * Math.sqrt((w * h) / Math.max(n, 1));
    const disp = Array.from({ length: n }, () => [0, 0]);
    let energy = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      let dx = P[a][0] - P[b][0], dy = P[a][1] - P[b][1];
      let d = Math.hypot(dx, dy);
      if (d < 1e-6) { dx = (rng() - 0.5) * 1e-3; dy = (rng() - 0.5) * 1e-3; d = Math.hypot(dx, dy); }
      const f = (k * k) / d;
      energy += k * k * Math.log(d);
      disp[a][0] += (dx / d) * f; disp[a][1] += (dy / d) * f;
      disp[b][0] -= (dx / d) * f; disp[b][1] -= (dy / d) * f;
    }
    for (const [a, b] of edges) {
      const dx = P[a][0] - P[b][0], dy = P[a][1] - P[b][1];
      const d = Math.hypot(dx, dy) || 1e-6;
      const f = (d * d) / k;
      energy += (d * d * d) / (3 * k);
      disp[a][0] -= (dx / d) * f; disp[a][1] -= (dy / d) * f;
      disp[b][0] += (dx / d) * f; disp[b][1] += (dy / d) * f;
    }
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < n; i++) {
      disp[i][0] -= state.gravity * (P[i][0] - cx);
      disp[i][1] -= state.gravity * (P[i][1] - cy);
      if (i === state.fixed) continue;
      const d = Math.hypot(disp[i][0], disp[i][1]) || 1e-9;
      const lim = Math.min(d, state.t);
      P[i][0] += (disp[i][0] / d) * lim;
      P[i][1] += (disp[i][1] / d) * lim;
      if (bounded) {
        P[i][0] = Math.min(w, Math.max(0, P[i][0]));
        P[i][1] = Math.min(h, Math.max(0, P[i][1]));
      }
    }
    state.t = Math.max(state.t * state.cooling, w / 2000);
    state.iter++;
    state.energy = energy;
    return energy;
  };
  state.reheat = () => { state.t = w / 10; };
  return state;
}

/** Positions of a static layout, scaled into [pad, size − pad]. */
export function fit(pos, size, pad = 12) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pos) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const s = (size - 2 * pad) / Math.max(x1 - x0, y1 - y0, 1e-9);
  const ox = (size - s * (x1 - x0)) / 2, oy = (size - s * (y1 - y0)) / 2;
  return pos.map(([x, y]) => [ox + (x - x0) * s, oy + (y - y0) * s]);
}

/** Least-squares slope through (x, y) pairs. */
export function slope(pts) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxy / sxx;
}

/** A settled layout in one call: iters steps of forceLayout, fitted into a
 *  size × size box. */
export function settle(n, edges, size, rng, { iters = 200, gravity = 0.08, scale = 1 } = {}) {
  const L = forceLayout(n, edges, { w: 1000, h: 1000, rng, gravity, scale, cooling: 0.97, bounded: false });
  for (let i = 0; i < iters; i++) L.step();
  return fit(L.pos, size);
}
