// Network science blocks 6–10: communities by modularity, epidemics and
// vaccination, assortativity by rewiring, triangles against a null model,
// and force-directed layout. Every network is synthetic and seeded.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import * as G from "./netsci-graph.js";

const pct = (v, d = 1) => `${num(v * 100, d)}%`;
const segValue = (root, label) => root.querySelector(`[role=tablist][aria-label="${label}"] [aria-selected=true]`)?.dataset.seg;
const onSeg = (root, label, fn) => root.querySelector(`[role=tablist][aria-label="${label}"]`)?.addEventListener("seg-change", (e) => fn(e.detail.value));

function drawNet(svg, pos, edges, { node = () => ({}), edge = () => ({}) } = {}) {
  svg.replaceChildren();
  const ge = el("g", {}, svg), gn = el("g", {}, svg);
  for (const [a, b] of edges) {
    const s = edge(a, b);
    if (s === null) continue;
    el("line", { x1: pos[a][0].toFixed(1), y1: pos[a][1].toFixed(1), x2: pos[b][0].toFixed(1), y2: pos[b][1].toFixed(1),
      style: s.style ?? "stroke:currentColor;stroke-opacity:0.15;stroke-width:0.8" }, ge);
  }
  const nodes = [];
  for (let i = 0; i < pos.length; i++) {
    const s = node(i);
    nodes.push(el("circle", { cx: pos[i][0].toFixed(1), cy: pos[i][1].toFixed(1), r: s.r ?? 3, style: s.style ?? "fill:var(--foreground);fill-opacity:0.45" }, gn));
  }
  return nodes;
}

// ============================================================ 6. Communities

for (const root of document.querySelectorAll("[data-ns-comm]")) {
  const svg = root.querySelector("[data-graph]"), chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const B = 4, SZ = 32, N = B * SZ;
  const planted = Array.from({ length: N }, (_, i) => (i / SZ) | 0);
  let seed = 4, u, colorBy = "found", state, sweep = [], sweepFor = -1, timer = 0;
  const sc = scrubAll(root, (name) => { update(); if (name === "kin") scheduleSweep(); });

  const graph = (kin, kout) => {
    const pin = Math.min(1, kin / (SZ - 1)), pout = Math.min(1, kout / (N - SZ));
    const edges = [];
    let idx = 0;
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
      if (u[idx++] < (planted[a] === planted[b] ? pin : pout)) edges.push([a, b]);
    }
    return edges;
  };
  // Detectability limit for equal groups (Decelle et al. 2011):
  // (c_in − c_out)² = q (c_in + (q − 1) c_out), with c = p · N.
  function limit(kin) {
    const cin = (kin / (SZ - 1)) * N;
    for (let kout = 0; kout <= 20; kout += 0.01) {
      const cout = (kout / (N - SZ)) * N;
      if ((cin - cout) ** 2 <= B * (cin + (B - 1) * cout)) return kout;
    }
    return null;
  }
  function build() {
    const rng = G.mulberry32(seed);
    u = new Float64Array((N * (N - 1)) / 2).map(() => rng());
    update();
    scheduleSweep();
  }
  function update() {
    const edges = graph(sc.kin.get(), sc.kout.get());
    const found = G.louvain(N, edges, G.mulberry32(seed + 9));
    // Match found community ids to planted colours by majority, for stable colours.
    const vote = new Map();
    for (let i = 0; i < N; i++) {
      const k = found[i] + ":" + planted[i];
      vote.set(k, (vote.get(k) ?? 0) + 1);
    }
    const best = new Map(), used = new Set();
    for (const [k, c] of [...vote.entries()].sort((a, b) => b[1] - a[1])) {
      const [fc, pc] = k.split(":").map(Number);
      if (best.has(fc) || used.has(pc)) continue;
      best.set(fc, pc); used.add(pc);
    }
    let extra = B;
    for (const fc of new Set(found)) if (!best.has(fc)) best.set(fc, extra++);
    const colorOf = (i) => G.PALETTE[(colorBy === "found" ? best.get(found[i]) : planted[i]) % G.PALETTE.length];
    const pos = G.settle(N, edges, 360, G.mulberry32(seed), { iters: 180, gravity: 0.05 });
    state = { edges, found, pos };
    drawNet(svg, pos, edges, {
      node: (i) => ({ r: 3.6, style: `fill:${colorOf(i)}` }),
      edge: (a, b) => (found[a] === found[b] ? { style: `stroke:${colorOf(a)};stroke-opacity:0.35;stroke-width:0.8` } : { style: "stroke:currentColor;stroke-opacity:0.1;stroke-width:0.6" }),
    });
    o.qf.textContent = num(G.modularity(N, edges, found), 3);
    o.qp.textContent = num(G.modularity(N, edges, planted), 3);
    o.nc.textContent = String(new Set(found).size);
    o.nmi.textContent = num(G.nmi(planted, [...found]), 3);
    plot();
  }
  function scheduleSweep() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const kin = sc.kin.get();
      sweep = [];
      for (let kout = 0; kout <= 20; kout += 1) {
        let q = 0, m = 0;
        for (let r = 0; r < 2; r++) {
          const save = u;
          const rng = G.mulberry32(1000 + r * 31 + kout);
          u = new Float64Array(save.length).map(() => rng());
          const e = graph(kin, kout), f = G.louvain(N, e, rng);
          q += G.modularity(N, e, f) / 2; m += G.nmi(planted, [...f]) / 2;
          u = save;
        }
        sweep.push([kout, q, m]);
      }
      sweepFor = kin;
      plot();
    }, 150);
  }
  function plot() {
    chart.replaceChildren();
    const f = frame(chart, { box: [34, 26, 214, 238], x: [0, 20], y: [0, 1], xticks: [0, 10, 20], yticks: [0, 0.5, 1], xlabel: "k_out" });
    text(chart, 4, 10, "Q · NMI");
    const lim = limit(sc.kin.get());
    if (lim !== null) {
      el("line", { x1: f.sx(lim), x2: f.sx(lim), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, chart);
      text(chart, f.sx(lim) + 3, f.T + 24, "detectable", { "text-anchor": "end", transform: `rotate(-90 ${f.sx(lim) + 3} ${f.T + 24})` });
    }
    if (sweep.length && sweepFor === sc.kin.get()) {
      polyline(chart, sweep.map(([x, q]) => [f.sx(x), f.sy(q)]), "stroke:var(--foreground);stroke-width:1.4");
      polyline(chart, sweep.map(([x, , m]) => [f.sx(x), f.sy(m)]), "stroke:var(--brand);stroke-width:1.6");
    }
    const x = Math.min(20, sc.kout.get());
    el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1" }, chart);
  }
  onSeg(root, "Colour by", (v) => { colorBy = v; update(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); });
  G.onTheme(update);
  colorBy = segValue(root, "Colour by") ?? "found";
  build();
}

// ============================================================ 7. Epidemics and vaccination

for (const root of document.querySelectorAll("[data-ns-epi]")) {
  const chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const N = 3000;
  let strategy = "none", nets, curves = null, timer = 0;
  const sc = scrubAll(root, (name) => (name === "g" ? schedule() : plot()));

  function makeNet(kind) {
    const rng = G.mulberry32(kind === "ba" ? 41 : 42);
    const edges = kind === "ba" ? G.barabasiAlbert(N, 3, rng) : G.erdosRenyi(N, 6, rng);
    const adj = G.adjacency(N, edges), deg = adj.map((a) => a.length);
    let s1 = 0, s2 = 0;
    for (const k of deg) { s1 += k; s2 += k * k; }
    const top = [...deg.keys()].sort((a, b) => deg[b] - deg[a]).slice(0, Math.ceil(N / 100));
    return { kind, edges, adj, deg, tc: s1 / (s2 - s1), top };
  }
  function vaccinate(net, g, rng) {
    const want = Math.round(g * N), vac = new Uint8Array(N);
    if (strategy === "random") for (const v of G.shuffle([...Array(N).keys()], rng).slice(0, want)) vac[v] = 1;
    else if (strategy === "hubs") for (const v of G.shuffle([...Array(N).keys()], rng).sort((a, b) => net.deg[b] - net.deg[a]).slice(0, want)) vac[v] = 1;
    else if (strategy === "friend") {
      let got = 0, guard = 0;
      while (got < want && guard++ < 50 * N) {
        const p = Math.floor(rng() * N), nb = net.adj[p];
        if (!nb.length) continue;
        const f = nb[Math.floor(rng() * nb.length)];
        if (!vac[f]) { vac[f] = 1; got++; }
      }
    }
    return vac;
  }
  // Final size against T by bond percolation: open links among the
  // unvaccinated in random order and record the largest cluster.
  function finalSize(net, vac, rng) {
    const live = net.edges.filter(([a, b]) => !vac[a] && !vac[b]);
    const P = 101, out = new Float64Array(P), R = 4;
    for (let r = 0; r < R; r++) {
      const order = G.shuffle(live.slice(), rng), uf = G.unionFind(N);
      let j = 0;
      for (let i = 0; i < P; i++) {
        const upto = Math.round((i / (P - 1)) * order.length);
        for (; j < upto; j++) uf.union(order[j][0], order[j][1]);
        out[i] += (j ? uf.largest : 0) / N / R;
      }
    }
    return out;
  }
  function compute() {
    const g = strategy === "none" ? 0 : sc.g.get() / 100, rng = G.mulberry32(99);
    curves = {};
    for (const net of nets) {
      const vac = vaccinate(net, g, rng);
      curves[net.kind] = { size: finalSize(net, vac, rng), hub: net.top.filter((v) => vac[v]).length / net.top.length };
    }
    plot();
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(compute, 60); };
  function plot() {
    if (!curves) return;
    chart.replaceChildren();
    const f = frame(chart, { box: [44, 16, 496, 240], x: [0, 1], y: [0, 1], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%`, xlabel: "transmissibility T" });
    text(chart, 4, 10, "final outbreak size");
    const T = sc.T.get(), i = Math.round(T * 100);
    for (const [kind, color] of [["er", "var(--vec-u)"], ["ba", "var(--brand)"]]) {
      const c = curves[kind], net = nets.find((x) => x.kind === kind);
      polyline(chart, [...c.size].map((v, k) => [f.sx(k / 100), f.sy(v)]), `stroke:${color};stroke-width:1.8`);
      el("line", { x1: f.sx(net.tc), x2: f.sx(net.tc), y1: f.T, y2: f.T + f.H, style: `stroke:${color};stroke-opacity:0.6;stroke-dasharray:3 3` }, chart);
      text(chart, f.sx(net.tc) + 3, f.T + (kind === "ba" ? 12 : 26), `T_c ${num(net.tc, 3)}`, { style: `fill:${color}` });
      el("circle", { cx: f.sx(T), cy: f.sy(c.size[i]), r: 3.5, style: `fill:${color}` }, chart);
    }
    el("line", { x1: f.sx(T), x2: f.sx(T), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:1" }, chart);
    o.ba.textContent = pct(curves.ba.size[i]);
    o.er.textContent = pct(curves.er.size[i]);
    o.tcba.textContent = num(nets[0].tc, 3);
    o.tcer.textContent = num(nets[1].tc, 3);
    o.hub.textContent = strategy === "none" ? "—" : `${pct(curves.ba.hub, 0)} of top 1%`;
  }
  onSeg(root, "Strategy", (v) => { strategy = v; schedule(); });
  G.onTheme(plot);
  strategy = segValue(root, "Strategy") ?? "none";
  nets = [makeNet("ba"), makeNet("er")];
  compute();
}

// ============================================================ 8. Assortativity

for (const root of document.querySelectorAll("[data-ns-assort]")) {
  const knnSvg = root.querySelector("[data-knn]"), trace = root.querySelector("[data-trace]");
  const o = G.outs(root);
  const btn = root.querySelector("[data-action=play]");
  const setPlay = G.playButton(btn, ["Swap", "Pause"]);
  const N = 2000, MAX = 30000;
  const original = G.barabasiAlbert(N, 2, G.mulberry32(61));
  const deg = G.degrees(N, original);
  let edges, swaps, history, target = "assort", playing = false, raf = 0, rng;

  function reset() {
    setPlaying(false);
    edges = original.map((e) => e.slice());
    swaps = 0; rng = G.mulberry32(62);
    history = [[0, G.assortativity(edges, deg)]];
    draw();
  }
  function knn() {
    const sum = new Float64Array(N);
    for (const [a, b] of edges) { sum[a] += deg[b]; sum[b] += deg[a]; }
    // Log bins of own degree.
    const bins = new Map();
    for (let i = 0; i < N; i++) {
      const b = Math.round(Math.log10(deg[i]) * 8);
      const v = bins.get(b) ?? [0, 0, 0];
      v[0] += deg[i]; v[1] += sum[i] / deg[i]; v[2]++;
      bins.set(b, v);
    }
    return [...bins.values()].map(([k, s, c]) => [k / c, s / c]).sort((a, b) => a[0] - b[0]);
  }
  function draw() {
    const r = history[history.length - 1][1];
    knnSvg.replaceChildren();
    const lx = Math.log10;
    const f = frame(knnSvg, { box: [36, 26, 230, 200], x: [lx(2), lx(200)], y: [0, lx(200)], xticks: [lx(2), lx(20), lx(200)], yticks: [0, 1, 2],
      xfmt: (v) => String(Math.round(10 ** v)), yfmt: (v) => String(Math.round(10 ** v)), xlabel: "own degree k" });
    text(knnSvg, 4, 10, "mean degree of neighbours");
    const pts = knn();
    polyline(knnSvg, pts.map(([k, v]) => [f.sx(lx(k)), f.sy(lx(v))]), "stroke:var(--brand);stroke-width:1.4");
    for (const [k, v] of pts) el("circle", { cx: f.sx(lx(k)), cy: f.sy(lx(v)), r: 2.6, style: "fill:var(--brand)" }, knnSvg);

    trace.replaceChildren();
    const g = frame(trace, { box: [40, 26, 226, 200], x: [0, MAX], y: [-0.8, 0.8], xticks: [0, MAX / 2, MAX], yticks: [-0.8, -0.4, 0, 0.4, 0.8],
      xfmt: (v) => (v ? `${v / 1000}k` : "0"), yfmt: (v) => num(v, 1), xlabel: "swaps" });
    text(trace, 4, 10, "assortativity r");
    el("line", { x1: g.L, x2: g.L + g.W, y1: g.sy(0), y2: g.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, trace);
    polyline(trace, history.map(([s, v]) => [g.sx(s), g.sy(Math.max(-0.8, Math.min(0.8, v)))]), "stroke:var(--brand);stroke-width:1.6");

    o.r.textContent = num(r, 3);
    o.swaps.textContent = swaps.toLocaleString("en");
    o.kept.textContent = G.degrees(N, edges).every((k, i) => k === deg[i]) ? "yes, all 2000" : "no";
    o.links.textContent = String(edges.length);
  }
  function batch() {
    swaps += G.swapEdges(N, edges, deg, 500, rng, target);
    history.push([swaps, G.assortativity(edges, deg)]);
  }
  function setPlaying(p) {
    playing = p; setPlay(p); cancelAnimationFrame(raf);
    if (!p) return;
    if (G.reduced()) { while (swaps < MAX) batch(); draw(); setPlaying(false); return; }
    const tick = () => {
      batch(); draw();
      if (swaps >= MAX) { setPlaying(false); return; }
      if (playing) raf = requestAnimationFrame(tick);
    };
    tick();
  }
  btn.addEventListener("click", () => { if (swaps >= MAX) reset(); setPlaying(!playing); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  onSeg(root, "Target", (v) => { target = v; });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlaying(false); }).observe(root);
  G.onTheme(draw);
  target = segValue(root, "Target") ?? "assort";
  reset();
}

// ============================================================ 9. Triangles and a null model

/** Triangles, connected triples, 4-cycles and local clustering. */
function motifs(n, edges) {
  const adj = G.adjacency(n, edges), set = adj.map((a) => new Set(a));
  const triAt = new Float64Array(n);
  let tri = 0, k4 = 0;
  // Each triangle a < b < c is found once, from its edge a–b, as c > b.
  for (const [x, y] of edges) {
    const a = Math.min(x, y), b = Math.max(x, y);
    for (const c of adj[a]) {
      if (c <= b || !set[b].has(c)) continue;
      tri++; triAt[a]++; triAt[b]++; triAt[c]++;
      // 4-cliques a < b < c < d, each found once from its smallest triangle.
      for (const d of adj[a]) if (d > c && set[b].has(d) && set[c].has(d)) k4++;
    }
  }
  let wedges = 0, localSum = 0, localN = 0;
  for (let i = 0; i < n; i++) {
    const k = adj[i].length, w = (k * (k - 1)) / 2;
    wedges += w;
    if (k >= 2) { localSum += triAt[i] / w; localN++; }
  }
  // 4-cycles: each pair a < b with c common neighbours closes C(c, 2) of
  // them, and every 4-cycle is seen from both of its diagonals.
  let sq = 0;
  for (let a = 0; a < n; a++) {
    const common = new Map();
    for (const x of adj[a]) for (const b of adj[x]) if (b > a) common.set(b, (common.get(b) ?? 0) + 1);
    for (const c of common.values()) sq += (c * (c - 1)) / 2;
  }
  sq /= 2;
  return { adj, tri, k4, wedges, open: wedges - 3 * tri, sq, trans: wedges ? (3 * tri) / wedges : 0, local: localN ? localSum / localN : 0, triAt };
}

for (const root of document.querySelectorAll("[data-ns-motif]")) {
  const svg = root.querySelector("[data-graph]"), chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const N = 300;
  let model = "geo", seed = 2, net, z = null, job = 0;

  function build() {
    const rng = G.mulberry32(seed * 13 + model.length);
    let edges, pos;
    if (model === "geo") { const g = G.geometric(N, 0.1, rng); edges = g.edges; pos = g.pos.map(([x, y]) => [12 + x * 336, 12 + y * 336]); }
    else {
      edges = model === "hk" ? G.holmeKim(N, 3, 0.8, rng) : G.erdosRenyi(N, 6, rng);
      pos = G.settle(N, edges, 360, rng, { iters: 160, gravity: 0.05 });
    }
    const m = motifs(N, edges);
    net = { edges, pos, m };
    z = null;
    draw();
    nullModel(edges, ++job);
  }
  function draw() {
    const { m, edges, pos } = net;
    drawNet(svg, pos, edges, {
      node: (i) => {
        const k = m.adj[i].length, c = k >= 2 ? m.triAt[i] / ((k * (k - 1)) / 2) : 0;
        return { r: 3, style: `fill:var(--brand);fill-opacity:${(0.12 + 0.88 * c).toFixed(2)};stroke:var(--brand);stroke-opacity:0.5;stroke-width:0.6` };
      },
    });
    o.tri.textContent = String(m.tri);
    o.trans.textContent = num(m.trans, 3);
    o.local.textContent = num(m.local, 3);
    chart.replaceChildren();
    const f = frame(chart, { box: [36, 26, 212, 238], x: [0, 3], y: [-10, 40], yticks: [-10, 0, 10, 20, 30, 40], xticks: [] });
    text(chart, 4, 10, "z-score vs shuffled");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, chart);
    for (const v of [-2, 2]) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(v), y2: f.sy(v), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, chart);
    const names = ["triangles", "4-cycles", "4-cliques"];
    names.forEach((name, i) => text(chart, f.sx(i + 0.5), f.T + f.H + 13, name, { "text-anchor": "middle" }));
    if (!z) {
      text(chart, f.sx(1.5), f.sy(20), "shuffling…", { "text-anchor": "middle" });
      o.null.textContent = "…"; o.z.textContent = "…";
      return;
    }
    z.vals.forEach((v, i) => {
      const clipped = Math.max(-10, Math.min(40, v));
      const y0 = f.sy(0), y1 = f.sy(clipped);
      el("rect", { x: f.sx(i + 0.2), width: f.sx(0.6) - f.sx(0), y: Math.min(y0, y1), height: Math.abs(y1 - y0) || 1,
        style: i === 0 ? "fill:var(--brand)" : "fill:var(--foreground);fill-opacity:0.45" }, chart);
      const label = Number.isFinite(v) ? num(v, 1) : v > 0 ? "∞" : "−∞";
      text(chart, f.sx(i + 0.5), v >= 0 ? y1 - 4 : f.sy(0) - 4, label, { "text-anchor": "middle" });
    });
    o.null.textContent = `${num(z.trans, 3)} ± ${num(z.transSd, 3)}`;
    o.z.textContent = Number.isFinite(z.vals[0]) ? num(z.vals[0], 1) : "∞";
  }
  // Degree-preserving null: 20 shuffles, 10 swaps per link each, computed
  // in slices so the page stays responsive.
  function nullModel(edges, id) {
    const deg = G.degrees(N, edges), rng = G.mulberry32(seed + 500);
    const samples = [];
    const one = () => {
      if (id !== job) return;
      const e = edges.map((x) => x.slice());
      G.swapEdges(N, e, deg, 10 * e.length, rng, "random");
      samples.push(motifs(N, e));
      if (samples.length < 20) { setTimeout(one, 0); return; }
      const stat = (key) => {
        const xs = samples.map((s) => s[key]), mean = xs.reduce((a, b) => a + b, 0) / xs.length;
        const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
        return [mean, sd];
      };
      const zs = ["tri", "sq", "k4"].map((k) => { const [mu, sd] = stat(k); return sd > 0 ? (net.m[k] - mu) / sd : net.m[k] === mu ? 0 : Infinity * Math.sign(net.m[k] - mu); });
      const [tm, ts] = stat("trans");
      z = { vals: zs, trans: tm, transSd: ts };
      draw();
    };
    setTimeout(one, 30);
  }
  onSeg(root, "Network", (v) => { model = v; build(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); });
  G.onTheme(draw);
  model = segValue(root, "Network") ?? "geo";
  build();
}

// ============================================================ 10. Force-directed layout

for (const root of document.querySelectorAll("[data-ns-layout]")) {
  const svg = root.querySelector("[data-graph]"), energySvg = root.querySelector("[data-energy]");
  const o = G.outs(root);
  const btn = root.querySelector("[data-action=play]");
  const setPlay = G.playButton(btn, ["Run", "Pause"]);
  const W = 520, H = 400;
  let kind = "grid", n, edges, lay, energy = [], playing = false, raf = 0, nodes = [], lines = [], rng = G.mulberry32(1);
  const sc = scrubAll(root, () => { if (!lay) return; lay.scale = sc.scale.get(); lay.gravity = sc.gravity.get(); lay.cooling = sc.cooling.get(); });

  function graphOf(k) {
    const E = [];
    if (k === "grid") {
      const s = 8;
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        if (x < s - 1) E.push([y * s + x, y * s + x + 1]);
        if (y < s - 1) E.push([y * s + x, (y + 1) * s + x]);
      }
      return [s * s, E];
    }
    if (k === "tree") { for (let i = 1; i < 63; i++) E.push([(i - 1) >> 1, i]); return [63, E]; }
    if (k === "cliques") {
      const c = 6, s = 6;
      for (let q = 0; q < c; q++) {
        for (let a = 0; a < s; a++) for (let b = a + 1; b < s; b++) E.push([q * s + a, q * s + b]);
        E.push([q * s, ((q + 1) % c) * s + 1]);
      }
      return [c * s, E];
    }
    for (let a = 0; a < 16; a++) for (let bit = 0; bit < 4; bit++) { const b = a ^ (1 << bit); if (a < b) E.push([a, b]); }
    return [16, E];
  }
  function build() {
    [n, edges] = graphOf(kind);
    lay = G.forceLayout(n, edges, { w: W, h: H, rng, scale: sc.scale.get(), gravity: sc.gravity.get(), cooling: sc.cooling.get() });
    energy = [];
    svg.replaceChildren();
    const ge = el("g", {}, svg), gn = el("g", {}, svg);
    lines = edges.map(() => el("line", { style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.2" }, ge));
    nodes = Array.from({ length: n }, (_, i) => {
      const c = el("circle", { r: 6, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.6;cursor:grab" }, gn);
      c.dataset.node = String(i);
      return c;
    });
    render();
  }
  function crossings() {
    const P = lay.pos;
    const ccw = (a, b, c) => (P[c][1] - P[a][1]) * (P[b][0] - P[a][0]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
    let k = 0;
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (ccw(a, b, c) * ccw(a, b, d) < 0 && ccw(c, d, a) * ccw(c, d, b) < 0) k++;
    }
    return k;
  }
  function render() {
    const P = lay.pos;
    edges.forEach(([a, b], i) => {
      lines[i].setAttribute("x1", P[a][0].toFixed(1)); lines[i].setAttribute("y1", P[a][1].toFixed(1));
      lines[i].setAttribute("x2", P[b][0].toFixed(1)); lines[i].setAttribute("y2", P[b][1].toFixed(1));
    });
    nodes.forEach((c, i) => { c.setAttribute("cx", P[i][0].toFixed(1)); c.setAttribute("cy", P[i][1].toFixed(1)); });
    energySvg.replaceChildren();
    // The first few iterations dwarf the rest, so the scale starts after them.
    const skip = Math.min(5, Math.max(0, energy.length - 2)), tail = energy.slice(skip);
    if (tail.length > 1) {
      const lo = Math.min(...tail), hi = Math.max(...tail);
      const f = frame(energySvg, { box: [8, 8, 504, 46], x: [0, Math.max(100, tail.length - 1)], y: [lo, hi === lo ? lo + 1 : hi], xticks: [] });
      polyline(energySvg, tail.map((e, i) => [f.sx(i), f.sy(e)]), "stroke:var(--brand);stroke-width:1.4");
    }
    text(energySvg, 8, 66, "energy by iteration");
    o.iter.textContent = String(lay.iter);
    o.temp.textContent = num(lay.t, 2);
    o.energy.textContent = energy.length ? Math.round(energy[energy.length - 1]).toLocaleString("en") : "—";
    o.cross.textContent = String(crossings());
  }
  function step() { energy.push(lay.step()); if (energy.length > 600) energy.shift(); }
  function setPlaying(p) {
    playing = p; setPlay(p); cancelAnimationFrame(raf);
    if (!p) return;
    if (G.reduced()) { for (let i = 0; i < 300; i++) step(); render(); setPlaying(false); return; }
    const tick = () => {
      step(); render();
      if (lay.t <= W / 1999 && lay.fixed < 0) { setPlaying(false); return; }
      if (playing) raf = requestAnimationFrame(tick);
    };
    tick();
  }
  // Drag a node: it stays where the pointer puts it while the rest settles.
  let drag = -1;
  const toSvg = (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.addEventListener("pointerdown", (e) => {
    const t = e.target.closest?.("[data-node]");
    if (!t) return;
    drag = Number(t.dataset.node); lay.fixed = drag;
    svg.setPointerCapture?.(e.pointerId);
    lay.t = Math.max(lay.t, W / 40);
    if (!playing && !G.reduced()) setPlaying(true);
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    const p = toSvg(e);
    lay.pos[drag][0] = Math.max(0, Math.min(W, p.x)); lay.pos[drag][1] = Math.max(0, Math.min(H, p.y));
    if (G.reduced()) { for (let i = 0; i < 5; i++) step(); }
    render();
  });
  const end = () => { if (drag >= 0) { drag = -1; lay.fixed = -1; } };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  btn.addEventListener("click", () => { if (!playing && lay.t <= W / 1999) lay.reheat(); setPlaying(!playing); });
  root.querySelector("[data-action=reheat]").addEventListener("click", () => { lay.reheat(); if (!playing) setPlaying(true); });
  root.querySelector("[data-action=scramble]").addEventListener("click", () => {
    for (const p of lay.pos) { p[0] = W * (0.1 + 0.8 * rng()); p[1] = H * (0.1 + 0.8 * rng()); }
    lay.reheat(); lay.iter = 0; energy = []; render();
  });
  onSeg(root, "Graph", (v) => { kind = v; setPlaying(false); build(); setPlaying(true); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlaying(false); }).observe(root);
  kind = segValue(root, "Graph") ?? "grid";
  build();
  // Settle once, cooling slowly, so the first view is a finished drawing.
  lay.cooling = 0.99;
  for (let i = 0; i < 600; i++) step();
  lay.cooling = sc.cooling.get();
  render();
}
