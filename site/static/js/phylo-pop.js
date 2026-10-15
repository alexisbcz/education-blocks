// Phylogenetics blocks, part two: the coalescent, Kimura's fixation
// probability against a Wright–Fisher simulation, and phylogenetic
// independent contrasts. Shared code lives in phylo-core.js.

import { scrubAll } from "./scrub.js";
import {
  el, text, frame, polyline, num, neg, pct, outs, onAction, niceTicks, tickFmt, chunked, mulberry32, gauss, tCdf, binom,
  layout, drawBranches, tips, whenVisible,
} from "./phylo-core.js";

// ============================================================ Coalescent

/** Kingman coalescent for n copies; size N now, optionally shrinking back
 *  in time as N·e^(−rt). Returns { root, leaves, times } (times: merger times). */
export function coalescent(rng, n, N, r = 0) {
  let active = Array.from({ length: n }, (_, i) => ({ id: i, t: 0 }));
  const leaves = active.slice(), times = [];
  let t = 0;
  while (active.length > 1) {
    const k = active.length, c = (k * (k - 1)) / 2;
    const E = -Math.log(1 - rng());
    if (r > 0) t = Math.log(Math.exp(r * t) + (E * N * r) / c) / r;
    else t += (E * N) / c;
    const i = Math.floor(rng() * k);
    let j = Math.floor(rng() * (k - 1));
    if (j >= i) j++;
    const node = { t, c: [active[i], active[j]] };
    active = active.filter((_, x) => x !== i && x !== j);
    active.push(node);
    times.push(t);
  }
  return { root: active[0], leaves, times };
}

for (const root of document.querySelectorAll("[data-phylo-coal]")) {
  const o = outs(root);
  const tsvg = root.querySelector("[data-tree]"), hsvg = root.querySelector("[data-hist]");
  const rng = mulberry32(31);
  let mode = "constant", gen = null, runs = [], stop = null;
  const s = scrubAll(root, () => { runs = []; fresh(); });
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; runs = []; fresh(); });
  onAction(root, (act) => {
    if (act === "new") fresh();
    else if (act === "many") many();
  });
  const rOf = () => (mode === "growth" ? s.r.get() : 0);

  function fresh() {
    stop?.();
    gen = coalescent(rng, s.n.get(), s.N.get(), rOf());
    draw();
  }

  function many() {
    stop?.();
    runs = [];
    const n = s.n.get(), N = s.N.get(), r = rOf();
    stop = chunked(2000, () => runs.push(coalescent(rng, n, N, r).root.t), () => draw(), () => draw());
  }

  function draw() {
    const n = s.n.get(), N = s.N.get();
    const theory = 2 * N * (1 - 1 / n);
    const T = gen.root.t;
    // Tree with time running up.
    tsvg.replaceChildren();
    const ymax = Math.max(T, 1e-9) * 1.05;
    const f = frame(tsvg, { box: [52, 16, 270, 228], x: [0, 1], y: [0, ymax], yticks: niceTicks(0, ymax, 4), yfmt: tickFmt, ylabel: "generations ago" });
    const order = [];
    const collect = (node) => (node.c ? node.c.forEach(collect) : order.push(node));
    collect(gen.root);
    order.forEach((l, i) => (l.x = f.L + 8 + (i * (f.W - 16)) / Math.max(1, order.length - 1)));
    const place = (node) => {
      if (node.c) { node.c.forEach(place); node.x = (node.c[0].x + node.c[1].x) / 2; }
      node.y = f.sy(node.t);
    };
    place(gen.root);
    const last = gen.times.length >= 2 ? gen.times[gen.times.length - 2] : 0;
    // Shade the stretch with only two lineages left.
    el("rect", { x: f.L, y: f.sy(T), width: f.W, height: Math.max(0, f.sy(last) - f.sy(T)), style: "fill:var(--brand);fill-opacity:0.08" }, tsvg);
    const walk = (node) => {
      if (!node.c) return;
      for (const c of node.c) {
        el("path", { d: `M${c.x.toFixed(1)},${c.y.toFixed(1)}V${node.y.toFixed(1)}H${node.x.toFixed(1)}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.7;stroke-width:1.4" }, tsvg);
        walk(c);
      }
    };
    walk(gen.root);
    for (const l of order) el("circle", { cx: l.x, cy: l.y, r: 2.4, style: "fill:var(--vec-v)" }, tsvg);
    el("circle", { cx: gen.root.x, cy: gen.root.y, r: 3.2, style: "fill:var(--brand)" }, tsvg);
    const leftSide = gen.root.x > f.L + f.W / 2;
    text(tsvg, leftSide ? f.L + 4 : f.L + f.W - 4, f.sy(T) + 13, "two lineages left", { "text-anchor": leftSide ? "start" : "end" });
    if (mode === "constant") {
      if (theory <= ymax) {
        el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(theory), y2: f.sy(theory), style: "stroke:var(--vec-u);stroke-dasharray:4 4" }, tsvg);
        text(tsvg, f.L + 2, f.sy(theory) - 4, "expected 2N(1 − 1/n)", { class: "fill-[var(--vec-u)] font-mono text-[10px]" });
      }
    }

    // Histogram of TMRCA over runs.
    hsvg.replaceChildren();
    if (!runs.length) {
      const f2 = frame(hsvg, { box: [40, 16, 244, 228], x: [0, 1], y: [0, 1] });
      text(hsvg, f2.L + f2.W / 2, f2.T + f2.H / 2, "press Run 2,000", { "text-anchor": "middle" });
    } else {
      const sorted = runs.slice().sort((a, b) => a - b);
      const hi = Math.max(sorted[Math.floor(0.99 * (sorted.length - 1))], theory) * 1.1;
      const B = 30, w = hi / B, counts = new Array(B).fill(0);
      for (const v of runs) counts[Math.min(B - 1, Math.floor(v / w))]++;
      const cmax = Math.max(...counts);
      const f2 = frame(hsvg, { box: [40, 16, 244, 228], x: [0, hi], y: [0, cmax * 1.1], xticks: niceTicks(0, hi, 3), yticks: niceTicks(0, cmax * 1.1, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "TMRCA (generations)", ylabel: "runs" });
      counts.forEach((c, i) => el("rect", { x: f2.sx(i * w) + 0.5, y: f2.sy(c), width: Math.max(0, f2.sx(w) - f2.sx(0) - 1), height: f2.sy(0) - f2.sy(c), style: "fill:var(--vec-v);fill-opacity:0.55" }, hsvg));
      const mean = runs.reduce((a, v) => a + v, 0) / runs.length;
      el("line", { x1: f2.sx(mean), x2: f2.sx(mean), y1: f2.T, y2: f2.T + f2.H, style: "stroke:var(--brand);stroke-width:1.5" }, hsvg);
      if (mode === "constant") el("line", { x1: f2.sx(theory), x2: f2.sx(theory), y1: f2.T, y2: f2.T + f2.H, style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 4" }, hsvg);
      text(hsvg, f2.L + f2.W, f2.T + 10, "— mean of runs", { "text-anchor": "end", class: "fill-[var(--brand)] font-mono text-[10px]" });
      if (mode === "constant") text(hsvg, f2.L + f2.W, f2.T + 22, "- - 2N(1 − 1/n)", { "text-anchor": "end", class: "fill-[var(--vec-u)] font-mono text-[10px]" });
    }

    o.t.textContent = `${Math.round(T).toLocaleString("en")} gen`;
    o.t2.textContent = `${Math.round(T - last).toLocaleString("en")} · ${Math.round((100 * (T - last)) / T)}%`;
    o.mean.textContent = runs.length ? `${Math.round(runs.reduce((a, v) => a + v, 0) / runs.length).toLocaleString("en")} gen` : "—";
    o.theory.textContent = `${Math.round(theory).toLocaleString("en")} gen`;
    o.runs.textContent = String(runs.length);
  }

  fresh();
  let started = false;
  whenVisible(root, (v) => { if (v && !started) { started = true; many(); } });
}

// ============================================================ Fixation

/** Kimura (1962): chance a single new copy among 2N fixes with selection s. */
export const kimura = (N, s) => (Math.abs(s) < 1e-12 ? 1 / (2 * N) : (1 - Math.exp(-2 * s)) / (1 - Math.exp(-4 * N * s)));

/** One Wright–Fisher run from a single copy; returns { fixed, gens, traj? }. */
export function wfRun(rng, N, s, keep = false) {
  const M = 2 * N;
  let i = 1, g = 0;
  const traj = keep ? [1 / M] : null;
  while (i > 0 && i < M) {
    const p = i / M;
    i = binom(rng, M, (p * (1 + s)) / (1 + p * s));
    g++;
    if (keep) traj.push(i / M);
  }
  return { fixed: i === M, gens: g, traj };
}

for (const root of document.querySelectorAll("[data-phylo-fix]")) {
  const o = outs(root);
  const tsvg = root.querySelector("[data-traj]"), csvg = root.querySelector("[data-curve]");
  const rng = mulberry32(1962);
  let trajs = [], pts = [], res = null, stop = null, lastN = null;
  const s = scrubAll(root, () => draw());
  onAction(root, (act) => { if (act === "run") run(); });

  function run() {
    stop?.();
    const N = s.N.get(), sel = s.s.get(), reps = s.reps.get();
    if (N !== lastN) { pts = []; lastN = N; }
    trajs = [];
    let fixed = 0, tsum = 0, done = 0;
    stop = chunked(reps, (i) => {
      const r = wfRun(rng, N, sel, i < 80);
      if (r.traj) trajs.push(r);
      if (r.fixed) { fixed++; tsum += r.gens; }
      done++;
    }, () => { res = { N, s: sel, fixed, done, tfix: fixed ? tsum / fixed : NaN }; draw(); }, () => {
      pts = pts.filter((p) => Math.abs(p.s - sel) > 1e-9);
      pts.push({ s: sel, p: fixed / done, n: done });
      draw();
    });
  }

  // Wilson 95% interval for a proportion.
  const wilson = (p, n) => {
    const z = 1.96, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [(c - h) / d, (c + h) / d];
  };

  function draw() {
    const N = s.N.get(), sel = s.s.get();
    // Trajectories.
    tsvg.replaceChildren();
    const gmax = Math.max(10, ...trajs.map((t) => t.traj.length - 1));
    const f = frame(tsvg, { box: [44, 14, 540, 156], x: [0, gmax], y: [0, 1], xticks: niceTicks(0, gmax, 6), yticks: [0, 0.5, 1], xfmt: tickFmt, yfmt: tickFmt, xlabel: "generations", ylabel: "frequency" });
    const lost = trajs.filter((t) => !t.fixed), won = trajs.filter((t) => t.fixed);
    for (const t of lost) polyline(tsvg, t.traj.map((v, g) => [f.sx(g), f.sy(v)]), "stroke:currentColor;stroke-opacity:0.25;stroke-width:1");
    for (const t of won) polyline(tsvg, t.traj.map((v, g) => [f.sx(g), f.sy(v)]), "stroke:var(--brand);stroke-width:1.6");
    if (!trajs.length) text(tsvg, f.L + f.W / 2, f.T + f.H / 2, "press Simulate", { "text-anchor": "middle" });
    else text(tsvg, f.L + f.W, f.T - 2, `first ${trajs.length} mutations: ${won.length} fixed`, { "text-anchor": "end" });

    // Fixation probability against s.
    csvg.replaceChildren();
    const s0 = -0.02, s1 = 0.1;
    const top = Math.max(kimura(N, s1), ...pts.map((p) => wilson(p.p, p.n)[1])) * 1.1;
    const g = frame(csvg, { box: [52, 14, 532, 156], x: [s0, s1], y: [0, top], xticks: niceTicks(s0, s1, 6), yticks: niceTicks(0, top, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "selection coefficient s", ylabel: "P(fixation)" });
    const curve = [];
    for (let i = 0; i <= 200; i++) { const x = s0 + ((s1 - s0) * i) / 200; curve.push([g.sx(x), g.sy(kimura(N, x))]); }
    polyline(csvg, curve, "stroke:var(--vec-v);stroke-width:2");
    el("line", { x1: g.sx(s0), x2: g.sx(s1), y1: g.sy(1 / (2 * N)), y2: g.sy(1 / (2 * N)), style: "stroke:var(--muted-foreground);stroke-dasharray:4 4" }, csvg);
    el("line", { x1: g.sx(sel), x2: g.sx(sel), y1: g.T, y2: g.T + g.H, style: "stroke:var(--brand);stroke-opacity:0.5" }, csvg);
    for (const p of pts) {
      const [lo, hi] = wilson(p.p, p.n);
      el("line", { x1: g.sx(p.s), x2: g.sx(p.s), y1: g.sy(lo), y2: g.sy(hi), style: "stroke:var(--brand);stroke-width:1.5" }, csvg);
      el("circle", { cx: g.sx(p.s), cy: g.sy(p.p), r: 3.2, style: "fill:var(--brand)" }, csvg);
    }

    o.kimura.textContent = num(kimura(N, sel), 4);
    o.neutral.textContent = num(1 / (2 * N), 4);
    if (res && res.N === N && Math.abs(res.s - sel) < 1e-12) {
      const p = res.fixed / res.done, [lo, hi] = wilson(p, res.done);
      o.fixed.textContent = `${res.fixed.toLocaleString("en")} / ${res.done.toLocaleString("en")}`;
      o.sim.textContent = num(p, 4);
      o.ci.textContent = `${num(lo, 4)}–${num(hi, 4)}`;
      o.tfix.textContent = res.fixed ? `${Math.round(res.tfix)} gen` : "none fixed";
    } else {
      o.fixed.textContent = "—";
      o.sim.textContent = "—";
      o.ci.textContent = "—";
      o.tfix.textContent = "—";
    }
  }

  draw();
  let started = false;
  whenVisible(root, (v) => { if (v && !started) { started = true; run(); } });
}

// ============================================================ Independent contrasts

/** Ultrametric tree: two clades of n tips splitting at the root; each clade's
 *  own branching takes the last (1 − stem) of the depth. Tips are ids 0..2n-1. */
export function twoClades(rng, n, stem) {
  const clade = (offset) => {
    let active = Array.from({ length: n }, (_, i) => ({ id: offset + i, t: 0 }));
    let t = 0;
    while (active.length > 1) {
      const k = active.length;
      t += -Math.log(1 - rng()) / ((k * (k - 1)) / 2);
      const i = Math.floor(rng() * k);
      let j = Math.floor(rng() * (k - 1));
      if (j >= i) j++;
      const node = { t, c: [active[i], active[j]] };
      active = active.filter((_, x) => x !== i && x !== j);
      active.push(node);
    }
    const r = active[0], scale = (1 - stem) / r.t;
    const lens = (node) => { if (node.c) for (const c of node.c) { c.len = (node.t - c.t) * scale; lens(c); } };
    lens(r);
    r.len = stem;
    return r;
  };
  return { len: 0, c: [clade(0), clade(n)] };
}

export function brownian(rng, tree) {
  const val = [];
  const go = (node, x) => {
    const v = x + Math.sqrt(node.len || 0) * gauss(rng);
    if (!node.c) val[node.id] = v;
    else node.c.forEach((c) => go(c, v));
  };
  go(tree, 0);
  return val;
}

/** Felsenstein's (1985) standardised contrasts for two traits. */
export function contrasts(tree, x, y) {
  const cx = [], cy = [];
  const go = (node) => {
    if (!node.c) return { x: x[node.id], y: y[node.id], v: node.len };
    const [a, b] = node.c.map(go);
    const sd = Math.sqrt(a.v + b.v);
    let dx = (a.x - b.x) / sd, dy = (a.y - b.y) / sd;
    if (dx < 0) { dx = -dx; dy = -dy; }
    cx.push(dx);
    cy.push(dy);
    const wa = 1 / a.v, wb = 1 / b.v;
    return { x: (a.x * wa + b.x * wb) / (wa + wb), y: (a.y * wa + b.y * wb) / (wa + wb), v: (node.len || 0) + (a.v * b.v) / (a.v + b.v) };
  };
  go(tree);
  return { cx, cy };
}

const pTwo = (r, df) => {
  const t = (r * Math.sqrt(df)) / Math.sqrt(Math.max(1e-15, 1 - r * r));
  return 2 * (1 - tCdf(Math.abs(t), df));
};
export function pearson(x, y) {
  const n = x.length, mx = x.reduce((a, v) => a + v, 0) / n, my = y.reduce((a, v) => a + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);
  return { r, p: pTwo(r, n - 2) };
}
export function throughOrigin(x, y) {
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += x[i] * y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; }
  const r = sxy / Math.sqrt(sxx * syy);
  return { r, p: pTwo(r, x.length - 1) };
}

for (const root of document.querySelectorAll("[data-phylo-pic]")) {
  const o = outs(root);
  const tsvg = root.querySelector("[data-tree]"), rsvg = root.querySelector("[data-raw]"), psvg = root.querySelector("[data-pic]");
  const rng = mulberry32(1985);
  let tree, x, y, stop = null;
  const s = scrubAll(root, () => { newTree(); newTraits(); o.fpraw.textContent = o.fppic.textContent = "—"; });
  onAction(root, (act) => {
    if (act === "new") newTraits();
    else if (act === "many") many();
  });

  function newTree() { tree = twoClades(rng, s.n.get(), s.stem.get()); }
  function newTraits() {
    x = brownian(rng, tree);
    y = brownian(rng, tree);
    draw();
  }

  function many() {
    stop?.();
    let raw = 0, pic = 0, done = 0;
    stop = chunked(1000, () => {
      const a = brownian(rng, tree), b = brownian(rng, tree);
      if (pearson(a, b).p < 0.05) raw++;
      const c = contrasts(tree, a, b);
      if (throughOrigin(c.cx, c.cy).p < 0.05) pic++;
      done++;
    }, () => {
      o.fpraw.textContent = `${pct(raw / done)} (${done})`;
      o.fppic.textContent = `${pct(pic / done)} (${done})`;
    }, () => {
      o.fpraw.style.color = raw / done > 0.08 ? "var(--code-del)" : "";
    });
  }

  function scatter(svg, xs, ys, color, origin) {
    svg.replaceChildren();
    const ext = (a) => { const lo = Math.min(...a), hi = Math.max(...a), pad = (hi - lo) * 0.12 || 1; return [lo - pad, hi + pad]; };
    let X = ext(xs), Y = ext(ys);
    if (origin) { X = [0, X[1]]; const m = Math.max(Math.abs(Y[0]), Math.abs(Y[1])); Y = [-m, m]; }
    const f = frame(svg, { box: [36, 14, 192, 196], x: X, y: Y, xticks: niceTicks(X[0], X[1], 3), yticks: niceTicks(Y[0], Y[1], 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: origin ? "contrast in X" : "trait X", ylabel: origin ? "contrast in Y" : "trait Y" });
    if (origin) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    xs.forEach((v, i) => el("circle", { cx: f.sx(v), cy: f.sy(ys[i]), r: 3, style: `fill:${color(i)};fill-opacity:0.8` }, svg));
    return f;
  }

  function draw() {
    const n = s.n.get();
    tsvg.replaceChildren();
    const { leaves } = layout(tree, { x: 10, y: 12, w: 170, h: 214 });
    drawBranches(tsvg, tree, () => "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.2");
    for (const l of leaves) el("circle", { cx: l.x + 4, cy: l.y, r: 2.6, style: `fill:${l.id < n ? "var(--vec-u)" : "var(--vec-v)"}` }, tsvg);
    const clade = (i) => (i < n ? "var(--vec-u)" : "var(--vec-v)");
    scatter(rsvg, x, y, clade, false);
    const c = contrasts(tree, x, y);
    scatter(psvg, c.cx, c.cy, () => "currentColor", true);
    const a = pearson(x, y), b = throughOrigin(c.cx, c.cy);
    const pf = (p) => (p < 0.001 ? "< 0.001" : num(p, 3));
    o.raw.textContent = neg(num(a.r, 2));
    o.rawp.textContent = pf(a.p);
    o.rawp.style.color = a.p < 0.05 ? "var(--code-del)" : "";
    o.picr.textContent = neg(num(b.r, 2));
    o.picp.textContent = pf(b.p);
    o.picp.style.color = b.p < 0.05 ? "var(--code-del)" : "";
  }

  newTree();
  newTraits();
  let started = false;
  whenVisible(root, (v) => { if (v && !started) { started = true; many(); } });
}
