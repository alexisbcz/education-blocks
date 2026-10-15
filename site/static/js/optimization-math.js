// Solvers for the optimization blocks. Pure functions, no DOM: exact
// fractions, LP vertices, the simplex tableau, knapsack branch and bound,
// line-search methods, 2-opt annealing, budget DP, ridge and lasso, Pareto
// fronts and Edmonds–Karp.

// ------------------------------------------------------------ fractions

const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

/** An exact rational number over BigInt. */
export class Q {
  constructor(n, d = 1n) {
    n = BigInt(n);
    d = BigInt(d);
    if (d === 0n) throw new Error("division by zero");
    if (d < 0n) [n, d] = [-n, -d];
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  static of(x) { return x instanceof Q ? x : new Q(x); }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  cmp(o) { o = Q.of(o); const a = this.n * o.d, b = o.n * this.d; return a < b ? -1 : a > b ? 1 : 0; }
  isZero() { return this.n === 0n; }
  sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
  valueOf() { return Number(this.n) / Number(this.d); }
  toString() {
    const s = this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
    return s.replace("-", "−");
  }
}

// ------------------------------------------------------------ LP in 2D

/** Vertices of {a x + b y ≤ r} for integer constraints, exact. */
export function lpVertices(cons) {
  const out = [];
  for (let i = 0; i < cons.length; i++) {
    for (let j = i + 1; j < cons.length; j++) {
      const [a1, b1, r1] = cons[i], [a2, b2, r2] = cons[j];
      const det = new Q(a1 * b2 - a2 * b1);
      if (det.isZero()) continue;
      const x = new Q(r1 * b2 - r2 * b1).div(det);
      const y = new Q(a1 * r2 - a2 * r1).div(det);
      const ok = cons.every(([a, b, r]) => x.mul(a).add(y.mul(b)).cmp(r) <= 0);
      if (ok && !out.some((p) => p.x.cmp(x) === 0 && p.y.cmp(y) === 0)) out.push({ x, y });
    }
  }
  // Order around the centroid so they draw as a polygon.
  const cx = out.reduce((s, p) => s + +p.x, 0) / (out.length || 1);
  const cy = out.reduce((s, p) => s + +p.y, 0) / (out.length || 1);
  out.sort((p, q) => Math.atan2(+p.y - cy, +p.x - cx) - Math.atan2(+q.y - cy, +q.x - cx));
  return out;
}

// ------------------------------------------------------------ simplex

/**
 * Runs the tableau simplex for max cᵀx s.t. Ax ≤ b, x ≥ 0 (b ≥ 0), and
 * returns every state: { T (rows of Q, last row = objective), basis,
 * kind: "start" | "choose" | "pivot" | "optimal", col, row, ratios }.
 */
export function simplexStates(A, b, c) {
  const m = A.length, n = c.length;
  const names = [...c.map((_, j) => ["x", "y", "z"][j] ?? `x${j + 1}`), ...A.map((_, i) => `s${i + 1}`)];
  let T = A.map((row, i) => [...row.map((v) => new Q(v)), ...A.map((_, k) => new Q(k === i ? 1 : 0)), new Q(b[i])]);
  T.push([...c.map((v) => new Q(-v)), ...A.map(() => new Q(0)), new Q(0)]);
  let basis = A.map((_, i) => n + i);
  const copy = () => T.map((r) => r.slice());
  const states = [{ kind: "start", T: copy(), basis: basis.slice() }];
  for (let iter = 0; iter < 20; iter++) {
    const z = T[m];
    let col = -1;
    for (let j = 0; j < n + m; j++) if (z[j].sign() < 0 && (col < 0 || z[j].cmp(z[col]) < 0)) col = j;
    if (col < 0) {
      states.push({ kind: "optimal", T: copy(), basis: basis.slice() });
      break;
    }
    const ratios = T.slice(0, m).map((r) => (r[col].sign() > 0 ? r[n + m].div(r[col]) : null));
    let row = -1;
    ratios.forEach((q, i) => { if (q && (row < 0 || q.cmp(ratios[row]) < 0)) row = i; });
    states.push({ kind: "choose", T: copy(), basis: basis.slice(), col, row, ratios });
    if (row < 0) {
      states.push({ kind: "unbounded", T: copy(), basis: basis.slice(), col });
      break;
    }
    const p = T[row][col];
    T[row] = T[row].map((v) => v.div(p));
    for (let i = 0; i <= m; i++) {
      if (i === row || T[i][col].isZero()) continue;
      const f = T[i][col];
      T[i] = T[i].map((v, j) => v.sub(f.mul(T[row][j])));
    }
    basis[row] = col;
    states.push({ kind: "pivot", T: copy(), basis: basis.slice(), col, row });
  }
  return { states, names };
}

// ------------------------------------------------------------ knapsack B&B

/**
 * Depth-first branch and bound for the 0/1 knapsack, items sorted by
 * value density. Returns the nodes in the order they were created, with
 * their bound (fractional relaxation) and fate.
 */
export function knapsackBnB(items, cap) {
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => b.v / b.w - a.v / a.w);
  const bound = (k, w, v) => {
    let b = v;
    let room = cap - w;
    for (let j = k; j < order.length && room > 0; j++) {
      const take = Math.min(1, room / order[j].w);
      b += take * order[j].v;
      room -= take * order[j].w;
    }
    return b;
  };
  const nodes = [];
  let best = { v: -1, pick: [] };
  const visit = (k, w, v, pick, parent, label) => {
    const node = { id: nodes.length, parent, depth: k, w, v, label, pick: pick.slice(), bound: w <= cap ? bound(k, w, v) : -Infinity, fate: "" };
    nodes.push(node);
    if (w > cap) { node.fate = "infeasible"; return; }
    if (node.bound <= best.v) { node.fate = "pruned"; node.bestAt = best.v; return; }
    if (k === order.length) {
      node.fate = "leaf";
      if (v > best.v) { best = { v, pick: pick.slice() }; node.fate = "best"; }
      node.bestAt = best.v;
      return;
    }
    node.fate = "branched";
    const it = order[k];
    visit(k + 1, w + it.w, v + it.v, [...pick, it.i], node.id, `+${it.n}`);
    visit(k + 1, w, v, pick, node.id, `−${it.n}`);
  };
  visit(0, 0, 0, [], -1, "start");
  return { nodes, best, order };
}

// ------------------------------------------------------------ Rosenbrock

export const rosen = {
  f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
  g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
  H: (x, y) => [[2 - 400 * (y - x * x) + 800 * x * x, -400 * x], [-400 * x, 200]],
};

/** Gradient descent or Newton with Armijo backtracking, until |∇f| < tol. */
export function lineSearch(method, start, { c1 = 1e-4, tol = 1e-4, max = 20000 } = {}) {
  let [x, y] = start;
  const path = [[x, y]];
  const gnorm = [];
  for (let k = 0; k < max; k++) {
    const g = rosen.g(x, y);
    const gn = Math.hypot(...g);
    gnorm.push(gn);
    if (gn < tol) return { path, gnorm, iters: k, converged: true };
    let d = [-g[0], -g[1]];
    if (method === "newton") {
      const [[a, b], [, c]] = rosen.H(x, y);
      const det = a * c - b * b;
      if (det > 0 && a > 0) d = [-(c * g[0] - b * g[1]) / det, -(-b * g[0] + a * g[1]) / det];
    }
    const f0 = rosen.f(x, y), slope = g[0] * d[0] + g[1] * d[1];
    let t = 1;
    while (rosen.f(x + t * d[0], y + t * d[1]) > f0 + c1 * t * slope && t > 1e-14) t *= 0.5;
    x += t * d[0];
    y += t * d[1];
    path.push([x, y]);
  }
  return { path, gnorm, iters: max, converged: false };
}

// ------------------------------------------------------------ TSP

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
export const tourLength = (cities, tour) => tour.reduce((s, c, i) => s + dist(cities[c], cities[tour[(i + 1) % tour.length]]), 0);

/** Change in length if the segment tour[i+1..j] is reversed (2-opt). */
export function twoOptDelta(cities, tour, i, j) {
  const n = tour.length;
  const a = cities[tour[i]], b = cities[tour[(i + 1) % n]], c = cities[tour[j]], d = cities[tour[(j + 1) % n]];
  return dist(a, c) + dist(b, d) - dist(a, b) - dist(c, d);
}

export function reverse(tour, i, j) {
  for (let l = i + 1, r = j; l < r; l++, r--) [tour[l], tour[r]] = [tour[r], tour[l]];
}

/** Nearest-neighbour tour, then 2-opt until no move improves it. */
export function greedyTwoOpt(cities) {
  const n = cities.length;
  const left = new Set(cities.map((_, i) => i));
  const tour = [0];
  left.delete(0);
  while (left.size) {
    const last = cities[tour.at(-1)];
    let best = -1;
    for (const c of left) if (best < 0 || dist(last, cities[c]) < dist(last, cities[best])) best = c;
    tour.push(best);
    left.delete(best);
  }
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n - (i === 0 ? 1 : 0); j++) {
        if (twoOptDelta(cities, tour, i, j) < -1e-9) { reverse(tour, i, j); improved = true; }
      }
    }
  }
  return tour;
}

// ------------------------------------------------------------ budget DP

/**
 * f[k][b] = best total for projects k.. with b units; choice[k][b] = units
 * given to project k. Projects get at most returns.length − 1 units.
 */
export function budgetDP(returns, budget) {
  const P = returns.length;
  const r = (k, u) => returns[k][Math.min(u, returns[k].length - 1)];
  const f = Array.from({ length: P + 1 }, () => new Array(budget + 1).fill(0));
  const choice = Array.from({ length: P }, () => new Array(budget + 1).fill(0));
  const cand = Array.from({ length: P }, () => new Array(budget + 1));
  for (let k = P - 1; k >= 0; k--) {
    for (let b = 0; b <= budget; b++) {
      let best = -1;
      cand[k][b] = [];
      for (let u = 0; u <= Math.min(b, returns[k].length - 1); u++) {
        const v = r(k, u) + f[k + 1][b - u];
        cand[k][b].push([u, v]);
        if (v > best) { best = v; choice[k][b] = u; }
      }
      f[k][b] = best;
    }
  }
  const plan = [];
  for (let k = 0, b = budget; k < P; k++) { plan.push(choice[k][b]); b -= choice[k][b]; }
  return { f, choice, cand, plan };
}

// ------------------------------------------------------------ ridge, lasso

const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

/** Synthetic standardized design (n × p) with correlated columns, centred y. */
export function regressionData(seed = 3, n = 60, beta = [3, -2, 0, 1.5, 0, 0]) {
  const rng = mulberry32(seed);
  const p = beta.length;
  const X = Array.from({ length: n }, () => {
    const z = gauss(rng);
    return Array.from({ length: p }, (_, j) => (j === 1 || j === 4 ? 0.6 * z : 0) + gauss(rng));
  });
  for (let j = 0; j < p; j++) {
    const m = X.reduce((s, r) => s + r[j], 0) / n;
    const sd = Math.sqrt(X.reduce((s, r) => s + (r[j] - m) ** 2, 0) / n);
    X.forEach((r) => (r[j] = (r[j] - m) / sd));
  }
  let y = X.map((r) => r.reduce((s, v, j) => s + v * beta[j], 0) + gauss(rng));
  const my = y.reduce((s, v) => s + v, 0) / n;
  y = y.map((v) => v - my);
  return { X, y, beta };
}

function solve(M, v) {
  const n = v.length;
  const A = M.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}

/** Ridge: minimise (1/2n)|y − Xβ|² + (λ/2)|β|². */
export function ridge({ X, y }, lam) {
  const n = X.length, p = X[0].length;
  const M = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0) / n + (i === j ? lam : 0)));
  const v = Array.from({ length: p }, (_, j) => X.reduce((s, r, k) => s + r[j] * y[k], 0) / n);
  return solve(M, v);
}

/** Lasso: minimise (1/2n)|y − Xβ|² + λ|β|₁ by coordinate descent (columns have unit variance). */
export function lasso({ X, y }, lam, start) {
  const n = X.length, p = X[0].length;
  const b = start ? start.slice() : new Array(p).fill(0);
  const r = y.map((v, k) => v - X[k].reduce((s, x, j) => s + x * b[j], 0));
  for (let sweep = 0; sweep < 500; sweep++) {
    let change = 0;
    for (let j = 0; j < p; j++) {
      let rho = 0;
      for (let k = 0; k < n; k++) rho += X[k][j] * (r[k] + X[k][j] * b[j]);
      rho /= n;
      const nb = Math.sign(rho) * Math.max(0, Math.abs(rho) - lam);
      const d = nb - b[j];
      if (d) for (let k = 0; k < n; k++) r[k] -= X[k][j] * d;
      change = Math.max(change, Math.abs(d));
      b[j] = nb;
    }
    if (change < 1e-10) break;
  }
  return b;
}

export const mse = ({ X, y }, b) => y.reduce((s, v, k) => s + (v - X[k].reduce((t, x, j) => t + x * b[j], 0)) ** 2, 0) / y.length;

// ------------------------------------------------------------ Pareto

/** Indices of non-dominated points (minimise both coordinates). */
export function paretoFront(pts) {
  return pts.map((p, i) => i).filter((i) => !pts.some((q, j) => j !== i && q[0] <= pts[i][0] && q[1] <= pts[i][1] && (q[0] < pts[i][0] || q[1] < pts[i][1])));
}

/** Front points on the lower-left convex hull: the ones a weighted sum can select. */
export function supported(pts, front) {
  const f = front.slice().sort((a, b) => pts[a][0] - pts[b][0]);
  const hull = [];
  const cross = (o, a, b) => (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
  for (const i of f) {
    while (hull.length >= 2 && cross(hull.at(-2), hull.at(-1), i) <= 0) hull.pop();
    hull.push(i);
  }
  return new Set(hull);
}

// ------------------------------------------------------------ max flow

/**
 * Edmonds–Karp: BFS augmenting paths in the residual graph. Returns each
 * augmentation (path as edge indices with directions, bottleneck, flows
 * after it) and the final min cut.
 */
export function edmondsKarp(n, edges, s, t) {
  const flow = edges.map(() => 0);
  const steps = [];
  for (let guard = 0; guard < 200; guard++) {
    const prev = new Array(n).fill(null);
    prev[s] = { e: -1 };
    const q = [s];
    while (q.length && !prev[t]) {
      const u = q.shift();
      edges.forEach((e, i) => {
        if (e.from === u && !prev[e.to] && e.cap - flow[i] > 0) { prev[e.to] = { e: i, dir: 1, from: u }; q.push(e.to); }
        if (e.to === u && !prev[e.from] && flow[i] > 0) { prev[e.from] = { e: i, dir: -1, from: u }; q.push(e.from); }
      });
    }
    if (!prev[t]) break;
    const path = [];
    for (let v = t; v !== s; v = prev[v].from) path.unshift({ e: prev[v].e, dir: prev[v].dir });
    const neck = Math.min(...path.map(({ e, dir }) => (dir > 0 ? edges[e].cap - flow[e] : flow[e])));
    for (const { e, dir } of path) flow[e] += dir * neck;
    steps.push({ path, neck, flow: flow.slice() });
  }
  // Reachable set in the final residual graph.
  const seen = new Set([s]);
  const q = [s];
  while (q.length) {
    const u = q.shift();
    edges.forEach((e, i) => {
      if (e.from === u && !seen.has(e.to) && e.cap - flow[i] > 0) { seen.add(e.to); q.push(e.to); }
      if (e.to === u && !seen.has(e.from) && flow[i] > 0) { seen.add(e.from); q.push(e.from); }
    });
  }
  const cut = edges.map((e, i) => i).filter((i) => seen.has(edges[i].from) && !seen.has(edges[i].to));
  const value = edges.reduce((s2, e, i) => s2 + (e.from === s ? flow[i] : 0) - (e.to === s ? flow[i] : 0), 0);
  return { steps, flow, value, cut, cutCap: cut.reduce((a, i) => a + edges[i].cap, 0), S: seen };
}
