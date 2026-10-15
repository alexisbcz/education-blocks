// Network science blocks 1–5: the giant component of a random graph,
// preferential attachment, the friendship paradox, failure against attack,
// and percolation on a lattice. Every network is synthetic and seeded.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import * as G from "./netsci-graph.js";

const pct = (v, d = 1) => `${num(v * 100, d)}%`;
const segValue = (root, label) => root.querySelector(`[role=tablist][aria-label="${label}"] [aria-selected=true]`)?.dataset.seg;
const onSeg = (root, label, fn) => root.querySelector(`[role=tablist][aria-label="${label}"]`)?.addEventListener("seg-change", (e) => fn(e.detail.value));
const later = (fn) => setTimeout(fn, 0);

/** Draws nodes and links into an SVG layer. */
function drawNet(svg, pos, edges, { node = () => ({}), edge = () => ({}) } = {}) {
  svg.replaceChildren();
  const ge = el("g", {}, svg), gn = el("g", {}, svg);
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const s = edge(a, b, i);
    if (s === null) continue;
    el("line", { x1: pos[a][0].toFixed(1), y1: pos[a][1].toFixed(1), x2: pos[b][0].toFixed(1), y2: pos[b][1].toFixed(1),
      style: s.style ?? "stroke:currentColor;stroke-opacity:0.15;stroke-width:0.8" }, ge);
  }
  for (let i = 0; i < pos.length; i++) {
    const s = node(i);
    if (s === null) continue;
    el("circle", { cx: pos[i][0].toFixed(1), cy: pos[i][1].toFixed(1), r: s.r ?? 3, style: s.style ?? "fill:var(--foreground);fill-opacity:0.45" }, gn);
  }
}

const zeta = (s, q) => {
  let t = 0;
  for (let j = 0; j < 20; j++) t += (q + j) ** -s;
  const x = q + 20;
  return t + x ** (1 - s) / (s - 1) + x ** -s / 2 + (s * x ** (-s - 1)) / 12;
};
/** Discrete power-law exponent by maximum likelihood for k ≥ kmin. */
function fitGamma(deg, kmin) {
  const ks = [...deg].filter((k) => k >= kmin);
  const L = ks.reduce((t, k) => t + Math.log(k), 0), n = ks.length;
  let best = -Infinity, bg = 0;
  for (let g = 1.5; g <= 4.5; g += 0.005) {
    const v = -g * L - n * Math.log(zeta(g, kmin));
    if (v > best) { best = v; bg = g; }
  }
  return bg;
}

// ============================================================ 1. Giant component

for (const root of document.querySelectorAll("[data-ns-giant]")) {
  const svg = root.querySelector("[data-graph]"), chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const n = 150;
  let seed = 3, u, pos, sim = [];
  const sc = scrubAll(root, () => draw());

  function build() {
    const rng = G.mulberry32(seed);
    u = new Float64Array((n * (n - 1)) / 2).map(() => rng());
    pos = Array.from({ length: n }, (_, i) => {
      const r = Math.sqrt((i + 0.5) / n) * 162, t = i * 2.399963 + rng() * 0.3;
      return [180 + r * Math.cos(t), 180 + r * Math.sin(t)];
    });
    // Simulated curve: three G(n, M) networks per mean degree.
    const big = 4000, simRng = G.mulberry32(seed * 101);
    sim = [];
    for (let k = 0; k <= 4.0001; k += 0.1) {
      let acc = 0;
      for (let r = 0; r < 3; r++) acc += G.components(big, G.erdosRenyi(big, k, simRng)).sizes[0] / big;
      sim.push([k, acc / 3]);
    }
  }
  const theory = (k) => {
    let S = 0.9;
    for (let i = 0; i < 500; i++) S = 1 - Math.exp(-k * S);
    return S < 1e-6 ? 0 : S;
  };

  function draw() {
    const k = sc.k.get(), p = k / (n - 1);
    const edges = [];
    let idx = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (u[idx++] < p) edges.push([a, b]);
    const c = G.components(n, edges);
    const giant = (i) => c.label[i] === 0 && c.sizes[0] > 1;
    drawNet(svg, pos, edges, {
      edge: (a) => (giant(a) ? { style: "stroke:var(--brand);stroke-opacity:0.7;stroke-width:1" } : {}),
      node: (i) => (giant(i) ? { r: 3.4, style: "fill:var(--brand)" } : { r: 2.6, style: "fill:var(--foreground);fill-opacity:0.4" }),
    });

    chart.replaceChildren();
    const f = frame(chart, { box: [34, 26, 214, 238], x: [0, 4], y: [0, 1], xticks: [0, 1, 2, 3, 4], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%`, xlabel: "⟨k⟩" });
    text(chart, 4, 10, "largest component");
    el("line", { x1: f.sx(1), x2: f.sx(1), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, chart);
    text(chart, f.sx(1) + 4, f.T + 12, "⟨k⟩ = 1");
    const pts = [];
    for (let x = 0; x <= 4.0001; x += 0.02) pts.push([f.sx(x), f.sy(theory(x))]);
    polyline(chart, pts, "stroke:var(--foreground);stroke-width:1.5");
    for (const [x, y] of sim) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.2, style: "fill:var(--vec-u)" }, chart);
    el("line", { x1: f.sx(k), x2: f.sx(k), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.2" }, chart);
    el("circle", { cx: f.sx(k), cy: f.sy(theory(k)), r: 4, style: "fill:var(--brand)" }, chart);

    const near = sim.reduce((b, q) => (Math.abs(q[0] - k) < Math.abs(b[0] - k) ? q : b), sim[0]);
    o.links.textContent = String(edges.length);
    o.drawn.textContent = `${c.sizes[0]} (${pct(c.sizes[0] / n)})`;
    o.sim.textContent = pct(near[1]);
    o.theory.textContent = pct(theory(k));
    o.comps.textContent = String(c.count);
  }
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); draw(); });
  G.onTheme(draw);
  build();
  draw();
}

// ============================================================ 2. Preferential attachment

for (const root of document.querySelectorAll("[data-ns-ba]")) {
  const svg = root.querySelector("[data-graph]"), chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const btn = root.querySelector("[data-action=play]");
  const setPlay = G.playButton(btn, ["Grow", "Pause"]);
  const MAX = 220;
  let seed = 5, rng, edges, ends, pos, deg, playing = false, timer = 0, big = null;
  const sc = scrubAll(root, () => { restart(); stats(); });

  function restart() {
    setPlaying(false);
    const m = sc.m.get();
    rng = G.mulberry32(seed);
    edges = []; ends = []; pos = []; deg = [];
    const m0 = m + 1;
    for (let i = 0; i < m0; i++) { pos.push([180 + 30 * Math.cos((2 * Math.PI * i) / m0), 180 + 30 * Math.sin((2 * Math.PI * i) / m0)]); deg.push(0); }
    for (let a = 0; a < m0; a++) for (let b = a + 1; b < m0; b++) link(a, b);
    draw();
  }
  function link(a, b) { edges.push([a, b]); ends.push(a, b); deg[a]++; deg[b]++; }
  function grow() {
    const m = sc.m.get(), v = pos.length;
    const picked = new Set();
    while (picked.size < m) picked.add(ends[Math.floor(rng() * ends.length)]);
    const first = [...picked][0];
    pos.push([pos[first][0] + (rng() - 0.5) * 30, pos[first][1] + (rng() - 0.5) * 30]);
    deg.push(0);
    for (const t of picked) link(t, v);
  }
  function relax(iters) {
    const L = G.forceLayout(pos.length, edges, { w: 360, h: 360, rng, pos, gravity: 0.04, scale: 0.9, bounded: false });
    L.t = 6;
    for (let i = 0; i < iters; i++) L.step();
  }
  function draw() {
    const hub = deg.reduce((b, d, i) => (d > deg[b] ? i : b), 0);
    drawNet(svg, G.fit(pos, 360, 16), edges, {
      node: (i) => ({ r: 1.6 + Math.sqrt(deg[i]) * 1.1, style: i === hub ? "fill:var(--brand)" : "fill:var(--foreground);fill-opacity:0.55" }),
    });
    o.nodes.textContent = `${pos.length} of ${MAX}`;
    o.hub.textContent = `${deg[hub]} links`;
  }
  function stats() {
    const m = sc.m.get(), r = G.mulberry32(seed * 7 + m), N = 10000;
    const dba = G.degrees(N, G.barabasiAlbert(N, m, r));
    const eer = G.erdosRenyi(N, (2 * (G.barabasiAlbert(N, m, G.mulberry32(1)).length)) / N, r);
    const der = G.degrees(N, eer);
    big = { m, dba, der, gamma: fitGamma(dba, 5 * m) };
    plot();
  }
  function ccdf(deg) {
    const max = Math.max(...deg), count = new Float64Array(max + 2);
    for (const k of deg) count[k]++;
    const out = [];
    let tail = deg.length;
    for (let k = 1; k <= max; k++) { if (count[k] || k === 1) out.push([k, tail / deg.length]); tail -= count[k]; }
    return out.filter(([, p]) => p > 0);
  }
  function plot() {
    chart.replaceChildren();
    const lx = (k) => Math.log10(k), ly = (p) => Math.log10(p);
    const f = frame(chart, { box: [36, 26, 212, 238], x: [0, 3], y: [-4, 0], xticks: [0, 1, 2, 3], yticks: [-4, -2, 0],
      xfmt: (v) => String(10 ** v), yfmt: (v) => (v === 0 ? "1" : `10${v === -2 ? "⁻²" : "⁻⁴"}`), xlabel: "k" });
    text(chart, 4, 10, "share with ≥ k links");
    const { m } = big;
    const th = [];
    for (let k = m; ly((m * (m + 1)) / (k * (k + 1))) >= -4; k *= 1.05) th.push([f.sx(lx(k)), f.sy(ly((m * (m + 1)) / (k * (k + 1))))]);
    polyline(chart, th, "stroke:var(--foreground);stroke-width:1;stroke-dasharray:3 3");
    const line = (pts, style) => polyline(chart, pts.filter(([, p]) => ly(p) >= -4).map(([k, p]) => [f.sx(lx(k)), f.sy(ly(p))]), style);
    line(ccdf(big.der), "stroke:var(--vec-u);stroke-width:1.6");
    line(ccdf(big.dba), "stroke:var(--brand);stroke-width:1.6");
    o.maxba.textContent = String(Math.max(...big.dba));
    o.maxer.textContent = String(Math.max(...big.der));
    o.gamma.textContent = num(big.gamma, 2);
  }
  function setPlaying(p) {
    playing = p; setPlay(p); clearTimeout(timer);
    if (!p) return;
    if (G.reduced()) {
      while (pos.length < MAX) { grow(); if (pos.length % 10 === 0) relax(2); }
      relax(80); draw(); setPlaying(false); return;
    }
    const tick = () => {
      if (pos.length >= MAX) { relax(20); draw(); setPlaying(false); return; }
      grow(); relax(3); draw();
      if (playing) timer = setTimeout(tick, 60);
    };
    tick();
  }
  btn.addEventListener("click", () => {
    if (pos.length >= MAX && !playing) restart();
    setPlaying(!playing);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { seed++; restart(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlaying(false); }).observe(root);
  G.onTheme(() => { draw(); plot(); });
  restart();
  // Start with a grown network so the picture is not empty.
  for (let i = 0; i < 60; i++) { grow(); relax(2); }
  relax(40);
  draw();
  later(stats);
}

// ============================================================ 3. Friendship paradox

for (const root of document.querySelectorAll("[data-ns-friends]")) {
  const chart = root.querySelector("[data-chart]"), person = root.querySelector("[data-person]");
  const o = G.outs(root);
  const N = 5000;
  let seed = 11, model = "ba", adj, deg;

  function build() {
    const rng = G.mulberry32(seed + model.length * 1000);
    const edges = model === "er" ? G.erdosRenyi(N, 6, rng) : model === "ba" ? G.barabasiAlbert(N, 3, rng) : G.powerLawConfig(N, 2.3, 2, rng);
    adj = G.adjacency(N, edges);
    deg = adj.map((a) => a.length);
    draw();
  }
  function draw() {
    let s1 = 0, s2 = 0, out = 0, ffSum = 0, people = 0;
    for (let i = 0; i < N; i++) {
      const k = deg[i];
      s1 += k; s2 += k * k;
      if (!k) continue;
      let t = 0;
      for (const j of adj[i]) t += deg[j];
      const mean = t / k;
      ffSum += mean; people++;
      if (mean > k) out++;
    }
    const mk = s1 / N, kk = s2 / s1;
    o.k.textContent = num(mk, 2);
    o.kk.textContent = num(kk, 2);
    o.ff.textContent = num(ffSum / people, 2);
    o.share.textContent = pct(out / people);

    // Degree of a random person, p(k), against degree of a random friend, k p(k)/⟨k⟩.
    const cap = model === "er" ? 20 : 40;
    const pk = new Float64Array(cap + 1);
    for (const k of deg) pk[Math.min(k, cap)]++;
    const qk = new Float64Array(cap + 1);
    for (const k of deg) qk[Math.min(k, cap)] += k;
    for (let k = 0; k <= cap; k++) { pk[k] /= N; qk[k] /= s1; }
    chart.replaceChildren();
    const ymax = Math.max(...pk, ...qk) * 1.1;
    const step = cap === 20 ? 5 : 10;
    const f = frame(chart, { box: [40, 16, 506, 190], x: [-0.5, cap + 0.5], y: [0, ymax], xticks: Array.from({ length: cap / step + 1 }, (_, i) => i * step),
      xfmt: (v) => (v === cap ? `≥${cap}` : String(v)), yticks: [0, ymax / 2.2, ymax / 1.1].map((v) => Math.round(v * 100) / 100), yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "number of friends" });
    text(chart, 4, 10, "share");
    const bw = (f.W / (cap + 1)) * 0.42;
    for (let k = 0; k <= cap; k++) {
      const x = f.sx(k);
      el("rect", { x: x - bw, y: f.sy(pk[k]), width: bw, height: f.T + f.H - f.sy(pk[k]), style: "fill:var(--vec-u);fill-opacity:0.75" }, chart);
      el("rect", { x, y: f.sy(qk[k]), width: bw, height: f.T + f.H - f.sy(qk[k]), style: "fill:var(--brand);fill-opacity:0.75" }, chart);
    }
    const mark = (v, color, label, dy) => {
      const x = f.sx(Math.min(v, cap));
      el("line", { x1: x, x2: x, y1: f.T, y2: f.T + f.H, style: `stroke:${color};stroke-width:1.2;stroke-dasharray:4 3` }, chart);
      text(chart, x + 4, f.T + dy, label, { style: `fill:${color}` });
    };
    mark(mk, "var(--vec-u)", `⟨k⟩ = ${num(mk, 1)}`, 10);
    mark(kk, "var(--brand)", `⟨k²⟩/⟨k⟩ = ${num(kk, 1)}`, 24);
  }
  function pick() {
    const rng = Math.random;
    let i;
    do i = Math.floor(rng() * N); while (!deg[i]);
    const fr = [...adj[i]].map((j) => deg[j]);
    const mean = fr.reduce((a, b) => a + b, 0) / fr.length;
    const list = fr.slice(0, 12).join(", ") + (fr.length > 12 ? `, … (${fr.length - 12} more)` : "");
    person.textContent = `Person #${i} has ${deg[i]} friend${deg[i] === 1 ? "" : "s"}. Their friends have ${list} friends: ${num(mean, 1)} on average, ` +
      (mean > deg[i] ? "more than they do." : mean < deg[i] ? "fewer than they do: one of the hubs." : "exactly as many.");
  }
  onSeg(root, "Network", (v) => { model = v; build(); });
  root.querySelector("[data-action=pick]").addEventListener("click", pick);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); });
  G.onTheme(draw);
  model = segValue(root, "Network") ?? "er";
  build();
}

// ============================================================ 4. Failure and attack

for (const root of document.querySelectorAll("[data-ns-robust]")) {
  const svg = root.querySelector("[data-graph]"), chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const sc = scrubAll(root, () => draw());
  let model = "ba", strategy = "attack", big, small;

  /** Largest component share after removing the first j nodes of order,
   *  for every j, by adding nodes back in reverse. */
  function curve(n, adj, order) {
    const uf = G.unionFind(n), on = new Uint8Array(n), out = new Float64Array(n + 1);
    out[n] = 0;
    for (let j = n - 1; j >= 0; j--) {
      const v = order[j];
      on[v] = 1;
      for (const w of adj[v]) if (on[w]) uf.union(v, w);
      out[j] = uf.largest / n;
    }
    return out; // out[j]: j nodes removed
  }
  const attackOrder = (deg, rng) => G.shuffle([...deg.keys()], rng).sort((a, b) => deg[b] - deg[a]);
  function makeNet(n, rng) {
    const edges = model === "ba" ? G.barabasiAlbert(n, 2, rng) : G.erdosRenyi(n, 4, rng);
    const adj = G.adjacency(n, edges);
    return { n, edges, adj, deg: adj.map((a) => a.length) };
  }
  function build() {
    const rng = G.mulberry32(model === "ba" ? 21 : 22);
    const n = 3000, net = makeNet(n, rng);
    const att = curve(n, net.adj, attackOrder(net.deg, rng));
    const rnd = new Float64Array(n + 1);
    for (let r = 0; r < 5; r++) {
      const c = curve(n, net.adj, G.shuffle([...Array(n).keys()], rng));
      for (let j = 0; j <= n; j++) rnd[j] += c[j] / 5;
    }
    let s1 = 0, s2 = 0;
    for (const k of net.deg) { s1 += k; s2 += k * k; }
    const kappa = s2 / s1;
    const collapse = (c) => { for (let j = 0; j <= n; j++) if (c[j] < 0.05) return j / n; return 1; };
    big = { n, att, rnd, mr: Math.max(0, 1 - 1 / (kappa - 1)), fca: collapse(att), fcr: collapse(rnd) };
    const sn = 200, snet = makeNet(sn, G.mulberry32(model === "ba" ? 31 : 32));
    small = { ...snet, pos: G.settle(sn, snet.edges, 360, G.mulberry32(5), { iters: 220, gravity: 0.06 }),
      att: attackOrder(snet.deg, G.mulberry32(7)), rnd: G.shuffle([...Array(sn).keys()], G.mulberry32(8)) };
    draw();
  }
  function draw() {
    const f0 = sc.f.get() / 100;
    // Small drawing: remove the first f of the chosen order.
    const order = strategy === "attack" ? small.att : small.rnd;
    const gone = new Uint8Array(small.n);
    for (let j = 0; j < Math.round(f0 * small.n); j++) gone[order[j]] = 1;
    const kept = small.edges.filter(([a, b]) => !gone[a] && !gone[b]);
    const c = G.components(small.n, kept);
    let giantRoot = -1, best = 0;
    const size = new Map();
    for (let i = 0; i < small.n; i++) if (!gone[i]) size.set(c.label[i], (size.get(c.label[i]) ?? 0) + 1);
    for (const [l, s] of size) if (s > best) { best = s; giantRoot = l; }
    drawNet(svg, small.pos, small.edges, {
      edge: (a, b) => (gone[a] || gone[b] ? null : c.label[a] === giantRoot ? { style: "stroke:var(--brand);stroke-opacity:0.55;stroke-width:0.9" } : {}),
      node: (i) => (gone[i] ? { r: 2, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }
        : { r: 1.8 + Math.sqrt(small.deg[i]) * 0.9, style: c.label[i] === giantRoot ? "fill:var(--brand)" : "fill:var(--foreground);fill-opacity:0.45" }),
    });

    chart.replaceChildren();
    const f = frame(chart, { box: [34, 26, 214, 238], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], xfmt: (v) => `${v * 100}%`, yfmt: (v) => `${v * 100}%`, xlabel: "removed f" });
    text(chart, 4, 10, "largest component S");
    const series = (arr, style) => {
      const pts = [];
      for (let j = 0; j <= big.n; j += 15) pts.push([f.sx(j / big.n), f.sy(arr[j])]);
      polyline(chart, pts, style);
    };
    series(big.rnd, "stroke:var(--vec-u);stroke-width:1.6");
    series(big.att, "stroke:var(--brand);stroke-width:1.6");
    el("line", { x1: f.sx(big.mr), x2: f.sx(big.mr), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, chart);
    text(chart, f.sx(big.mr) - 3, f.T + 12, "f_c", { "text-anchor": "end" });
    el("line", { x1: f.sx(f0), x2: f.sx(f0), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1" }, chart);
    const j = Math.round(f0 * big.n);
    el("circle", { cx: f.sx(f0), cy: f.sy(big.rnd[j]), r: 3.5, style: "fill:var(--vec-u)" }, chart);
    el("circle", { cx: f.sx(f0), cy: f.sy(big.att[j]), r: 3.5, style: "fill:var(--brand)" }, chart);
    o.rand.textContent = pct(big.rnd[j]);
    o.att.textContent = pct(big.att[j]);
    o.fcr.textContent = `f = ${pct(big.fcr, 0)}`;
    o.fca.textContent = `f = ${pct(big.fca, 0)}`;
    o.mr.textContent = pct(big.mr, 0);
  }
  onSeg(root, "Network", (v) => { model = v; build(); });
  onSeg(root, "Strategy", (v) => { strategy = v; draw(); });
  G.onTheme(draw);
  model = segValue(root, "Network") ?? "ba";
  strategy = segValue(root, "Strategy") ?? "attack";
  build();
}

// ============================================================ 5. Percolation

for (const root of document.querySelectorAll("[data-ns-perc]")) {
  const canvas = root.querySelector("[data-canvas]"), chart = root.querySelector("[data-chart]");
  const o = G.outs(root);
  const sc = scrubAll(root, () => draw());
  const L = 80, N = L * L, BONDS = 2 * L * (L - 1);
  const PC = { site: 0.592746, bond: 0.5 };
  let kind = "site", seed = 1, u, curves = {}, colors;
  const ctx = canvas.getContext("2d");
  const readColors = () => (colors = { bg: G.rgbOf("var(--code-bg)"), big: G.rgbOf("var(--brand)"), other: G.rgbOf("var(--vec-u)"), fg: G.rgbOf("var(--foreground)") });

  // Bond b joins sites: horizontal bonds first (y*(L−1)+x joins (x,y)–(x+1,y)), then vertical.
  const H = L * (L - 1);
  const bondEnds = (b) => (b < H ? [Math.floor(b / (L - 1)) * L + (b % (L - 1)), Math.floor(b / (L - 1)) * L + (b % (L - 1)) + 1] : [b - H, b - H + L]);

  /** Newman–Ziff: open in random order; record the largest cluster share
   *  and whether a cluster spans top to bottom after each opening. */
  function nz(k, rng) {
    const M = k === "site" ? N : BONDS;
    const order = G.shuffle([...Array(M).keys()], rng);
    const uf = G.unionFind(N), open = new Uint8Array(N), top = new Uint8Array(N), bot = new Uint8Array(N);
    for (let x = 0; x < L; x++) { top[x] = 1; bot[(L - 1) * L + x] = 1; }
    const big = new Float64Array(M + 1), span = new Uint8Array(M + 1);
    let spanning = false, largest = 0;
    const join = (a, b) => {
      const ra = uf.find(a), rb = uf.find(b);
      if (ra === rb) return;
      uf.union(ra, rb);
      const r = uf.find(ra);
      top[r] = top[ra] | top[rb]; bot[r] = bot[ra] | bot[rb];
      if (top[r] && bot[r]) spanning = true;
    };
    if (k === "bond") largest = 1;
    for (let j = 0; j < M; j++) {
      if (k === "site") {
        const v = order[j], x = v % L, y = (v / L) | 0;
        open[v] = 1;
        if (x > 0 && open[v - 1]) join(v, v - 1);
        if (x < L - 1 && open[v + 1]) join(v, v + 1);
        if (y > 0 && open[v - L]) join(v, v - L);
        if (y < L - 1 && open[v + L]) join(v, v + L);
        largest = Math.max(largest, uf.size[uf.find(v)]);
      } else {
        const [a, b] = bondEnds(order[j]);
        join(a, b);
        largest = Math.max(largest, uf.size[uf.find(a)]);
      }
      big[j + 1] = largest / N; span[j + 1] = spanning ? 1 : 0;
    }
    return { M, big, span };
  }
  function buildCurves() {
    for (const k of ["site", "bond"]) {
      const rng = G.mulberry32(77 + (k === "bond" ? 1 : 0));
      const P = 101, big = new Float64Array(P), span = new Float64Array(P);
      for (let r = 0; r < 8; r++) {
        const c = nz(k, rng);
        for (let i = 0; i < P; i++) { const j = Math.round((i / (P - 1)) * c.M); big[i] += c.big[j] / 8; span[i] += c.span[j] / 8; }
      }
      curves[k] = { big, span };
    }
  }
  function build() {
    const rng = G.mulberry32(seed * 977);
    u = new Float64Array(Math.max(N, BONDS)).map(() => rng());
    draw();
  }
  function draw() {
    const p = sc.p.get();
    const uf = G.unionFind(N), open = new Uint8Array(N);
    if (kind === "site") {
      for (let v = 0; v < N; v++) open[v] = u[v] < p ? 1 : 0;
      for (let v = 0; v < N; v++) {
        if (!open[v]) continue;
        const x = v % L;
        if (x < L - 1 && open[v + 1]) uf.union(v, v + 1);
        if (v + L < N && open[v + L]) uf.union(v, v + L);
      }
    } else {
      open.fill(1);
      for (let b = 0; b < BONDS; b++) if (u[b] < p) { const [a, c] = bondEnds(b); uf.union(a, c); }
    }
    // Largest cluster, cluster count, spanning.
    let bigRoot = -1, bigSize = 0, clusters = 0, openCount = 0;
    const tops = new Set(), spanRoots = new Set();
    for (let v = 0; v < N; v++) {
      if (!open[v]) continue;
      openCount++;
      const r = uf.find(v);
      if (r === v) clusters++;
      if (uf.size[r] > bigSize) { bigSize = uf.size[r]; bigRoot = r; }
      if (v < L) tops.add(r);
      if (v >= N - L && tops.has(r)) spanRoots.add(r);
    }
    if (kind === "bond") {
      let ob = 0;
      for (let b = 0; b < BONDS; b++) if (u[b] < p) ob++;
      openCount = ob;
    }
    // Picture.
    const S = kind === "site" ? L : 2 * L - 1;
    canvas.width = S; canvas.height = S;
    const img = ctx.createImageData(S, S);
    const put = (x, y, c, a = 1) => {
      const i = (y * S + x) * 4;
      img.data[i] = colors.bg[0] + (c[0] - colors.bg[0]) * a;
      img.data[i + 1] = colors.bg[1] + (c[1] - colors.bg[1]) * a;
      img.data[i + 2] = colors.bg[2] + (c[2] - colors.bg[2]) * a;
      img.data[i + 3] = 255;
    };
    const shade = (r) => 0.35 + ((r * 2654435761) >>> 0) % 1000 / 1000 * 0.45;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(x, y, colors.bg, 0);
    if (kind === "site") {
      for (let v = 0; v < N; v++) {
        if (!open[v]) continue;
        const r = uf.find(v);
        put(v % L, (v / L) | 0, r === bigRoot ? colors.big : colors.other, r === bigRoot ? 1 : shade(r));
      }
    } else {
      for (let v = 0; v < N; v++) {
        const r = uf.find(v), x = v % L, y = (v / L) | 0;
        if (uf.size[r] > 1) put(2 * x, 2 * y, r === bigRoot ? colors.big : colors.other, r === bigRoot ? 1 : shade(r));
        else put(2 * x, 2 * y, colors.fg, 0.12);
      }
      for (let b = 0; b < BONDS; b++) {
        if (u[b] >= p) continue;
        const [a, c] = bondEnds(b), r = uf.find(a);
        const x = (a % L) + (c % L), y = ((a / L) | 0) + ((c / L) | 0);
        put(x, y, r === bigRoot ? colors.big : colors.other, r === bigRoot ? 1 : shade(r));
      }
    }
    ctx.putImageData(img, 0, 0);

    chart.replaceChildren();
    const f = frame(chart, { box: [34, 26, 214, 238], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%`, xlabel: "p" });
    text(chart, 4, 10, "largest cluster · spans");
    const cv = curves[kind];
    polyline(chart, [...cv.big].map((v, i) => [f.sx(i / 100), f.sy(v)]), "stroke:var(--brand);stroke-width:1.6");
    polyline(chart, [...cv.span].map((v, i) => [f.sx(i / 100), f.sy(v)]), "stroke:var(--foreground);stroke-width:1.2;stroke-dasharray:4 3");
    const pc = PC[kind];
    el("line", { x1: f.sx(pc), x2: f.sx(pc), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, chart);
    text(chart, f.sx(pc) - 3, f.T + 12, `p_c ${kind === "site" ? "≈ 0.5927" : "= 1/2"}`, { "text-anchor": "end" });
    el("line", { x1: f.sx(p), x2: f.sx(p), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1" }, chart);
    el("circle", { cx: f.sx(p), cy: f.sy(bigSize / N), r: 3.5, style: "fill:var(--brand)" }, chart);
    text(chart, f.L + f.W, f.T + f.H - 26, "– – P(spans)", { "text-anchor": "end" });

    o.open.textContent = pct(openCount / (kind === "site" ? N : BONDS));
    o.largest.textContent = pct(bigSize / N);
    o.clusters.textContent = String(kind === "site" ? clusters : [...new Set(Array.from({ length: N }, (_, v) => uf.find(v)))].length);
    o.spans.textContent = spanRoots.size ? "yes" : "no";
  }
  onSeg(root, "Kind", (v) => { kind = v; draw(); });
  root.querySelector("[data-action=pc]").addEventListener("click", () => { sc.p.set(Math.round(PC[kind] * 1000) / 1000); draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); });
  G.onTheme(() => { readColors(); draw(); });
  kind = segValue(root, "Kind") ?? "site";
  readColors();
  buildCurves();
  build();
}
