// Pure models behind the parallel computing blocks (no DOM), so they can
// be checked in Node: task graphs and greedy scheduling, prefix scans,
// summation orders, load balancing, warps, memory sectors and caches.

/** Seeded PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ Scaling

export const amdahl = (s, n) => 1 / (s + (1 - s) / n);
export const gustafson = (s, n) => s + (1 - s) * n;

// ============================================================ Work and span

/** A task graph: nodes [{cost}], edges as parents lists. */
export function dagPreset(kind, seed = 1) {
  const nodes = [];
  const add = (cost, parents = []) => (nodes.push({ cost, parents }), nodes.length - 1);
  if (kind === "reduce") {
    let level = [3, 2, 4, 3, 2, 3, 5, 2].map((c) => add(c));
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(add(1, [level[i], level[i + 1]]));
      level = next;
    }
  } else if (kind === "forkjoin") {
    const s = add(1);
    const a = [2, 5, 3, 4, 2, 6].map((c) => add(c, [s]));
    const j = add(1, a);
    const b = [3, 3, 2, 4].map((c) => add(c, [j]));
    add(1, b);
  } else if (kind === "chain") {
    let prev = add(2);
    const side = [];
    for (const c of [3, 1, 4, 2, 3]) {
      const n = add(c, [prev]);
      side.push(add(2, [prev]));
      prev = n;
    }
    add(1, [prev, ...side]);
  } else {
    const r = rng(seed);
    const layers = 4 + Math.floor(r() * 2);
    let prev = [];
    for (let l = 0; l < layers; l++) {
      const width = l === 0 ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4);
      const cur = [];
      for (let k = 0; k < width; k++) {
        const parents = [];
        if (prev.length) {
          parents.push(prev[Math.floor(r() * prev.length)]);
          for (const p of prev) if (!parents.includes(p) && r() < 0.3) parents.push(p);
        }
        cur.push(add(1 + Math.floor(r() * 5), parents));
      }
      prev = cur;
    }
  }
  return nodes;
}

/** Work, span, the critical path and each node's depth (in hops). */
export function workSpan(nodes) {
  const finish = [], from = [], depth = [];
  nodes.forEach((n, i) => {
    let best = 0, arg = -1, d = 0;
    for (const p of n.parents) {
      if (finish[p] > best) { best = finish[p]; arg = p; }
      d = Math.max(d, depth[p] + 1);
    }
    finish[i] = best + n.cost;
    from[i] = arg;
    depth[i] = d;
  });
  const work = nodes.reduce((s, n) => s + n.cost, 0);
  let end = 0;
  finish.forEach((f, i) => { if (f > finish[end]) end = i; });
  const span = finish[end];
  const critical = new Set();
  for (let i = end; i >= 0; i = from[i]) critical.add(i);
  return { work, span, critical, depth };
}

/** Greedy list schedule on p processors: never leaves a processor idle
 *  while a task is ready. Ties go to the task with the longest path to
 *  the end (any greedy order satisfies Brent's bound). */
export function greedySchedule(nodes, p) {
  const n = nodes.length;
  const children = nodes.map(() => []);
  nodes.forEach((v, i) => v.parents.forEach((q) => children[q].push(i)));
  const bottom = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) bottom[i] = nodes[i].cost + Math.max(0, ...children[i].map((c) => bottom[c]));
  const waiting = nodes.map((v) => v.parents.length);
  let ready = nodes.map((_, i) => i).filter((i) => waiting[i] === 0);
  const free = new Array(p).fill(0); // time each processor becomes free
  const running = []; // {node, proc, end}
  const slots = [];
  let t = 0, done = 0;
  while (done < n) {
    ready.sort((a, b) => bottom[b] - bottom[a] || a - b);
    for (let q = 0; q < p && ready.length; q++) {
      if (free[q] > t) continue;
      const v = ready.shift();
      free[q] = t + nodes[v].cost;
      running.push({ node: v, proc: q, end: free[q] });
      slots.push({ node: v, proc: q, start: t, end: free[q] });
    }
    t = Math.min(...running.map((r) => r.end));
    for (let k = running.length - 1; k >= 0; k--) {
      if (running[k].end !== t) continue;
      const v = running[k].node;
      running.splice(k, 1);
      done++;
      for (const c of children[v]) if (--waiting[c] === 0) ready.push(c);
    }
  }
  return { slots, makespan: t };
}

// ============================================================ Prefix scan

/** Hillis–Steele inclusive scan: one row per step, with the additions. */
export function hillisSteele(a) {
  const rows = [{ values: a.slice(), ops: [], label: "input" }];
  let x = a.slice();
  for (let d = 1; d < a.length; d *= 2) {
    const y = x.slice(), ops = [];
    for (let i = d; i < a.length; i++) { y[i] = x[i] + x[i - d]; ops.push([i - d, i]); }
    x = y;
    rows.push({ values: x.slice(), ops, label: `+${d}` });
  }
  return rows;
}

/** Blelloch work-efficient exclusive scan: up-sweep, clear, down-sweep. */
export function blelloch(a) {
  const n = a.length, x = a.slice();
  const rows = [{ values: x.slice(), ops: [], label: "input" }];
  for (let d = 1; d < n; d *= 2) {
    const ops = [];
    for (let k = 0; k < n; k += 2 * d) { x[k + 2 * d - 1] += x[k + d - 1]; ops.push([k + d - 1, k + 2 * d - 1]); }
    rows.push({ values: x.slice(), ops, label: `up ${d}` });
  }
  x[n - 1] = 0;
  rows.push({ values: x.slice(), ops: [], cleared: n - 1, label: "clear" });
  for (let d = n / 2; d >= 1; d /= 2) {
    const ops = [];
    for (let k = 0; k < n; k += 2 * d) {
      const t = x[k + d - 1];
      x[k + d - 1] = x[k + 2 * d - 1];
      x[k + 2 * d - 1] += t;
      ops.push([k + d - 1, k + 2 * d - 1]);
    }
    rows.push({ values: x.slice(), ops, swap: true, label: `down ${d}` });
  }
  return rows;
}

export const inclusive = (a) => a.reduce((acc, v, i) => (acc.push((acc[i - 1] ?? 0) + v), acc), []);
export const exclusive = (a) => inclusive(a).map((v, i) => v - a[i]);

// ============================================================ Summation order

/** Exact sum of doubles, correctly rounded (Shewchuk's msum, as in
 *  Python's math.fsum): partials kept free of rounding error. */
export function exactSum(xs) {
  const partials = [];
  for (let x of xs) {
    let i = 0;
    for (let y of partials) {
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi = x + y, lo = y - (hi - x);
      if (lo !== 0) partials[i++] = lo;
      x = hi;
    }
    partials.length = i;
    partials.push(x);
  }
  // Round the partials, top down, without double rounding.
  let n = partials.length, hi = 0, lo = 0;
  if (n > 0) {
    hi = partials[--n];
    while (n > 0) {
      const x = hi, y = partials[--n];
      hi = x + y;
      lo = y - (hi - x);
      if (lo !== 0) break;
    }
    if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
      const y = lo * 2, x = hi + y;
      if (y === x - hi) hi = x;
    }
  }
  return hi;
}

/** The summation orders compared in the reduction block. R rounds to the
 *  working precision (Math.fround for float32). */
export function summations(xs, R) {
  const seq = (a) => a.reduce((s, v) => R(s + v), 0);
  const tree = (a, lo = 0, hi = a.length) => (hi - lo === 1 ? a[lo] : R(tree(a, lo, (lo + hi) >> 1) + tree(a, (lo + hi) >> 1, hi)));
  const chunks = (k) => {
    const size = Math.ceil(xs.length / k), parts = [];
    for (let c = 0; c < k; c++) parts.push(seq(xs.slice(c * size, (c + 1) * size)));
    return seq(parts);
  };
  const strided = (k) => {
    const parts = [];
    for (let c = 0; c < k; c++) { let s = 0; for (let i = c; i < xs.length; i += k) s = R(s + xs[i]); parts.push(s); }
    return tree(parts);
  };
  const kahan = () => {
    let s = 0, c = 0;
    for (const v of xs) { const y = R(v - c), t = R(s + y); c = R(R(t - s) - y); s = t; }
    return s;
  };
  return [
    { key: "seq", label: "Left to right (1 thread)", value: seq(xs) },
    { key: "rev", label: "Right to left", value: seq(xs.slice().reverse()) },
    { key: "tree", label: "Pairwise tree", value: tree(xs) },
    { key: "chunk4", label: "4 threads, contiguous chunks", value: chunks(4) },
    { key: "stride8", label: "8 threads, strided, tree combine", value: strided(8) },
    { key: "sorted", label: "Sorted by size, then left to right", value: seq(xs.slice().sort((a, b) => Math.abs(a) - Math.abs(b))) },
    { key: "kahan", label: "Kahan compensated (1 thread)", value: kahan() },
  ];
}

// ============================================================ Load balancing

export function taskCosts(kind, n, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    if (kind === "uniform") return 0.8 + 0.4 * r();
    if (kind === "ramp") return 0.2 + (3.8 * i) / Math.max(1, n - 1) + 0.2 * r();
    return r() < 0.08 ? 4 + 8 * r() : 0.3 + 0.5 * r(); // heavy tail
  });
}

/** Simulates one strategy. Returns slots [{w, start, end, task, kind}],
 *  the makespan and the number of steals. */
export function balance(costs, p, strategy, overhead, seed = 7) {
  const n = costs.length, slots = [];
  const blockOf = (w) => [Math.floor((w * n) / p), Math.floor(((w + 1) * n) / p)];
  let steals = 0;
  if (strategy === "block" || strategy === "cyclic") {
    for (let w = 0; w < p; w++) {
      let t = 0;
      const mine = strategy === "block"
        ? Array.from({ length: blockOf(w)[1] - blockOf(w)[0] }, (_, k) => blockOf(w)[0] + k)
        : Array.from({ length: Math.ceil((n - w) / p) }, (_, k) => w + k * p);
      for (const i of mine) { slots.push({ w, start: t, end: t + costs[i], task: i, kind: "own" }); t += costs[i]; }
    }
  } else if (strategy === "queue") {
    // One shared queue behind a lock: taking a task holds the lock for
    // `overhead`, so grabs are serialised.
    const free = new Array(p).fill(0);
    let lock = 0;
    for (let i = 0; i < n; i++) {
      let w = 0;
      for (let k = 1; k < p; k++) if (free[k] < free[w]) w = k;
      const start = Math.max(free[w], lock);
      lock = start + overhead;
      if (overhead > 0) slots.push({ w, start, end: start + overhead, task: -1, kind: "overhead" });
      slots.push({ w, start: start + overhead, end: start + overhead + costs[i], task: i, kind: "own" });
      free[w] = start + overhead + costs[i];
    }
  } else {
    // Work stealing: each worker starts with its block in a deque, pops
    // from the bottom; an idle worker steals the top half of a random
    // non-empty victim's deque, paying `overhead` per steal.
    const r = rng(seed);
    const deques = Array.from({ length: p }, (_, w) => {
      const [a, b] = blockOf(w);
      return Array.from({ length: b - a }, (_, k) => a + k);
    });
    const origin = new Array(n);
    deques.forEach((d, w) => d.forEach((i) => (origin[i] = w)));
    const free = new Array(p).fill(0);
    const active = new Set(Array.from({ length: p }, (_, w) => w));
    while (active.size) {
      let w = -1;
      for (const k of active) if (w < 0 || free[k] < free[w]) w = k;
      const t = free[w];
      if (deques[w].length) {
        const i = deques[w].pop();
        slots.push({ w, start: t, end: t + costs[i], task: i, kind: origin[i] === w ? "own" : "stolen" });
        free[w] = t + costs[i];
        continue;
      }
      const victims = deques.map((d, k) => k).filter((k) => k !== w && deques[k].length > 0);
      if (!victims.length) { active.delete(w); continue; }
      const v = victims[Math.floor(r() * victims.length)];
      const take = Math.ceil(deques[v].length / 2);
      const got = deques[v].splice(0, take);
      for (const i of got) origin[i] = -1; // marks a stolen task
      deques[w].push(...got.reverse());
      steals++;
      if (overhead > 0) slots.push({ w, start: t, end: t + overhead, task: -1, kind: "overhead" });
      // The thief runs one stolen task straight away, so a task cannot
      // bounce between idle workers while they pay for the steal.
      const i = deques[w].pop();
      slots.push({ w, start: t + overhead, end: t + overhead + costs[i], task: i, kind: "stolen" });
      free[w] = t + overhead + costs[i];
    }
    for (const s of slots) if (s.task >= 0 && origin[s.task] === -1) s.kind = "stolen";
  }
  const makespan = Math.max(0, ...slots.map((s) => s.end));
  const busy = slots.filter((s) => s.task >= 0).reduce((a, s) => a + s.end - s.start, 0);
  return { slots, makespan, steals, idle: 1 - busy / (p * makespan) };
}

// ============================================================ Warps

/** Which lanes take the `if` branch, for 4 warps of 32. */
export function branchMask(cond, prob, seed = 3) {
  const r = rng(seed);
  return Array.from({ length: 4 }, (_, w) =>
    Array.from({ length: 32 }, (_, l) => {
      const u = r();
      if (cond === "warp") return w % 2 === 0;
      if (cond === "half") return l < 16;
      if (cond === "odd") return l % 2 === 1;
      return u < prob;
    }));
}

export function simtCost(mask, a, b) {
  let cycles = 0, active = 0, divergent = 0, takeIf = 0;
  const warps = mask.map((lanes) => {
    const k = lanes.filter(Boolean).length;
    takeIf += k;
    const runIf = k > 0, runElse = k < 32;
    const t = (runIf ? a : 0) + (runElse ? b : 0);
    if (runIf && runElse && a > 0 && b > 0) divergent++;
    cycles += t;
    active += k * a + (32 - k) * b;
    return { k, runIf, runElse, t };
  });
  const best = Math.ceil(takeIf / 32) * a + Math.ceil((128 - takeIf) / 32) * b;
  return { warps, cycles, best, divergent, eff: cycles ? active / (32 * cycles) : 1 };
}

// ============================================================ Coalescing

/** Word addresses (4-byte words) read by the 32 lanes of a warp. */
export function warpAddresses(pattern, stride, offset, seed = 5) {
  const r = rng(seed);
  return Array.from({ length: 32 }, (_, t) => {
    if (pattern === "soa") return offset + t;
    if (pattern === "aos") return offset + 3 * t;
    if (pattern === "stride") return offset + stride * t;
    return offset + Math.floor(r() * 1024);
  });
}

export function sectorsOf(words) {
  const sectors = new Set(words.map((w) => Math.floor((w * 4) / 32)));
  const lines = new Set(words.map((w) => Math.floor((w * 4) / 128)));
  return { sectors, lines, useful: 4 * new Set(words).size, moved: 32 * sectors.size };
}

// ============================================================ False sharing

/** Increments per nanosecond for t threads under a simple coherence cost
 *  model: a write hits locally unless another core wrote the line last. */
export function counterRate(layout, t, hit, miss) {
  if (layout === "padded" || t === 1) return t / hit / (layout === "shared" && t === 1 ? 3 : 1);
  if (layout === "packed") return 1 / (hit + miss);
  return 1 / (3 * hit + miss); // one shared atomic: a locked read-modify-write per increment
}
