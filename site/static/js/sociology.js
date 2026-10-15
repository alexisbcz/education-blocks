// Sociology blocks: Schelling's segregation model, Watts–Strogatz small
// worlds, network centrality (Brandes), Lorenz/Gini, the Bass diffusion
// model, an iterated prisoner's dilemma tournament, survey sampling and a
// Markov mobility chain. Populations are synthetic and labelled as such.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (v, d = 1) => `${num(v * 100, d)}%`;

// Resolves a CSS color to [r, g, b] by painting one pixel.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
function playButton(btn, labels = ["Run", "Pause"]) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// ============================================================ Schelling

for (const root of document.querySelectorAll("[data-schelling]")) {
  const canvas = root.querySelector("[data-canvas]");
  const trend = root.querySelector("[data-trend]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  const setPlay = playButton(btn);
  const N = 40;
  let grid, seed = 1, round = 0, history = [], playing = false, timer = 0, colors;
  const s = scrubAll(root, (name) => (name === "empty" ? reset() : draw()));
  canvas.width = N; canvas.height = N;
  const ctx = canvas.getContext("2d");
  const readColors = () => (colors = [rgbOf("var(--code-bg)"), rgbOf("var(--vec-u)"), rgbOf("var(--brand)")]);

  function reset() {
    const rng = mulberry32(seed);
    const cells = N * N, empty = Math.round((cells * s.empty.get()) / 100);
    const filled = cells - empty;
    grid = shuffle([...Array(cells)].map((_, i) => (i < empty ? 0 : i < empty + filled / 2 ? 1 : 2)), rng);
    round = 0;
    history = [stats().similar];
    setPlaying(false);
    draw();
  }

  // Share of like neighbours among occupied neighbours (8-neighbourhood, wrapping).
  const likeShare = (i) => {
    const x = i % N, y = (i / N) | 0, me = grid[i];
    let like = 0, other = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const v = grid[((y + dy + N) % N) * N + ((x + dx + N) % N)];
      if (v === me) like++; else if (v) other++;
    }
    return like + other ? like / (like + other) : 1;
  };
  function stats() {
    const want = s.want.get() / 100;
    let unhappy = 0, occupied = 0, sim = 0;
    const movers = [];
    grid.forEach((v, i) => {
      if (!v) return;
      occupied++;
      const share = likeShare(i);
      sim += share;
      if (share < want) { unhappy++; movers.push(i); }
    });
    return { unhappy: unhappy / occupied, similar: sim / occupied, movers };
  }
  function step() {
    const rng = mulberry32(seed * 7919 + round);
    const { movers } = stats();
    if (!movers.length) return false;
    const empties = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    for (const i of shuffle(movers, rng)) {
      const k = Math.floor(rng() * empties.length);
      const j = empties[k];
      grid[j] = grid[i]; grid[i] = 0;
      empties[k] = i;
    }
    round++;
    history.push(stats().similar);
    return true;
  }
  function draw() {
    const img = ctx.createImageData(N, N);
    grid.forEach((v, i) => { img.data.set([...colors[v], 255], i * 4); });
    ctx.putImageData(img, 0, 0);
    const st = stats();
    o.round.textContent = String(round);
    o.unhappy.textContent = pct(st.unhappy);
    o.similar.textContent = pct(st.similar);
    trend.replaceChildren();
    const f = frame(trend, { box: [36, 8, 418, 46], x: [0, Math.max(30, history.length - 1)], y: [0.3, 1], yticks: [0.5, 1], yfmt: (v) => `${v * 100}%`, xticks: [] });
    text(trend, 4, 64, "like neighbours by round");
    polyline(trend, history.map((v, i) => [f.sx(i), f.sy(Math.max(0.3, v))]), "stroke:var(--brand);stroke-width:1.5");
  }
  function setPlaying(p) {
    playing = p; setPlay(p); clearTimeout(timer);
    if (!p) return;
    if (reduced()) { for (let k = 0; k < 200 && step(); k++); playing = false; setPlay(false); draw(); return; }
    const tick = () => {
      const moved = step();
      draw();
      if (moved && playing && round < 500) timer = setTimeout(tick, 120); else setPlaying(false);
    };
    tick();
  }
  btn.addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=step]").addEventListener("click", () => { setPlaying(false); step(); draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { seed++; reset(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlaying(false); }).observe(root);
  onTheme(() => { readColors(); draw(); });
  readColors();
  reset();
}

// ============================================================ Graph helpers

function bfs(adj, src) {
  const d = new Array(adj.length).fill(-1);
  d[src] = 0;
  const q = [src];
  for (let h = 0; h < q.length; h++) for (const w of adj[q[h]]) if (d[w] < 0) { d[w] = d[q[h]] + 1; q.push(w); }
  return d;
}
function pathLength(adj) {
  let sum = 0, pairs = 0;
  for (let i = 0; i < adj.length; i++) for (const v of bfs(adj, i)) if (v > 0) { sum += v; pairs++; }
  return pairs ? sum / pairs : 0;
}
function clustering(adj) {
  let total = 0;
  for (const nb of adj) {
    const k = nb.length;
    if (k < 2) continue;
    let links = 0;
    for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (adj[nb[a]].includes(nb[b])) links++;
    total += links / ((k * (k - 1)) / 2);
  }
  return total / adj.length;
}

// Watts–Strogatz: a ring where each node links to its k/2 neighbours on each
// side; each edge's far end is rewired with probability p.
function wattsStrogatz(n, k, p, rng) {
  const adj = [...Array(n)].map(() => []);
  const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  const has = (a, b) => adj[a].includes(b);
  for (let i = 0; i < n; i++) for (let j = 1; j <= k / 2; j++) link(i, (i + j) % n);
  for (let j = 1; j <= k / 2; j++) for (let i = 0; i < n; i++) {
    if (rng() >= p) continue;
    const b = (i + j) % n;
    let c, tries = 0;
    do { c = Math.floor(rng() * n); } while ((c === i || has(i, c)) && ++tries < 100);
    if (tries >= 100) continue;
    adj[i].splice(adj[i].indexOf(b), 1);
    adj[b].splice(adj[b].indexOf(i), 1);
    link(i, c);
  }
  return adj;
}

// ============================================================ Small world

for (const root of document.querySelectorAll("[data-smallworld]")) {
  const graph = root.querySelector("[data-graph]");
  const curves = root.querySelector("[data-curves]");
  const o = outs(root);
  const n = 40, k = 4;
  let seed = 3, selected = -1, adj;
  const s = scrubAll(root, () => { selected = -1; build(); });

  // Normalised curves, averaged over 8 networks per p (as in the 1998 figure).
  const lattice = wattsStrogatz(n, k, 0, Math.random);
  const L0 = pathLength(lattice), C0 = clustering(lattice);
  const grid = [];
  for (let lp = -4; lp <= 0.001; lp += 0.25) {
    let L = 0, C = 0;
    for (let r = 0; r < 8; r++) {
      const a = wattsStrogatz(n, k, 10 ** lp, mulberry32(1000 + r * 31 + Math.round(lp * 100)));
      L += pathLength(a); C += clustering(a);
    }
    grid.push([lp, L / 8 / L0, C / 8 / C0]);
  }

  function build() {
    adj = wattsStrogatz(n, k, 10 ** s.logp.get(), mulberry32(seed));
    draw();
  }

  function draw() {
    graph.replaceChildren();
    const pos = (i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return [180 + 150 * Math.cos(a), 180 + 150 * Math.sin(a)]; };
    const d = selected >= 0 ? bfs(adj, selected) : null;
    const far = d ? Math.max(...d) : 0;
    const g = el("g", {}, graph);
    adj.forEach((nb, i) => nb.forEach((j) => {
      if (j < i) return;
      const [x1, y1] = pos(i), [x2, y2] = pos(j);
      const ring = Math.min(Math.abs(i - j), n - Math.abs(i - j)) <= k / 2;
      const lit = d && (i === selected || j === selected);
      el("line", { x1, y1, x2, y2, style: `stroke:${lit ? "var(--brand)" : ring ? "currentColor" : "var(--vec-u)"};stroke-opacity:${lit ? 0.9 : ring ? 0.18 : 0.6};stroke-width:${lit ? 1.6 : 1}` }, g);
    }));
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(i);
      const shade = d ? (d[i] === 0 ? 1 : 1 - (d[i] / (far + 1)) * 0.85) : 1;
      const c = el("circle", { cx: x, cy: y, r: i === selected ? 7 : 5, tabindex: 0, role: "button", "aria-label": `Person ${i + 1}`,
        class: "cursor-pointer outline-none focus-visible:stroke-[var(--ring)]",
        style: `fill:${i === selected ? "var(--brand)" : "var(--foreground)"};fill-opacity:${shade};stroke:var(--code-bg);stroke-width:1.5` }, graph);
      const pick = () => { selected = selected === i ? -1 : i; draw(); };
      c.addEventListener("click", pick);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      if (d && i !== selected && d[i] > 0) text(graph, x + (x - 180) * 0.09, y + (y - 180) * 0.09 + 3, String(d[i]), { "text-anchor": "middle" });
    }
    o.p.textContent = (10 ** s.logp.get()).toPrecision(2);
    o.L.textContent = `${num(pathLength(adj), 2)} steps`;
    o.C.textContent = num(clustering(adj), 3);
    o.sel.textContent = d ? `person ${selected + 1}: ${adj[selected].length} ties, everyone within ${far} steps` : "click a person";

    curves.replaceChildren();
    const f = frame(curves, { box: [34, 14, 214, 240], x: [-4, 0], y: [0, 1.05], xticks: [-4, -3, -2, -1, 0], yticks: [0, 0.5, 1],
      xfmt: (v) => (v === 0 ? "1" : `1e${String(v).replace("-", "−")}`), xlabel: "rewiring p (log)" });
    polyline(curves, grid.map(([lp, L]) => [f.sx(lp), f.sy(L)]), "stroke:var(--foreground);stroke-width:1.75");
    polyline(curves, grid.map(([lp, , C]) => [f.sx(lp), f.sy(C)]), "stroke:var(--brand);stroke-width:1.75");
    el("line", { x1: f.sx(s.logp.get()), x2: f.sx(s.logp.get()), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, curves);
  }
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); });
  build();
}

// ============================================================ Centrality

// Brandes (2001): betweenness for an unweighted, undirected graph.
function betweenness(adj) {
  const n = adj.length, cb = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack = [], pred = [...Array(n)].map(() => []);
    const sigma = new Array(n).fill(0), dist = new Array(n).fill(-1);
    sigma[s] = 1; dist[s] = 0;
    const q = [s];
    for (let h = 0; h < q.length; h++) {
      const v = q[h];
      stack.push(v);
      for (const w of adj[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
      }
    }
    const delta = new Array(n).fill(0);
    while (stack.length) {
      const w = stack.pop();
      for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) cb[w] += delta[w];
    }
  }
  const norm = ((n - 1) * (n - 2)) / 2; // each pair was counted twice; /2 and normalise
  return cb.map((v) => v / 2 / norm);
}

for (const root of document.querySelectorAll("[data-centrality]")) {
  const svg = root.querySelector("[data-graph]");
  const names = svg.dataset.names.split(",");
  const n = names.length;
  const adj = [...Array(n)].map(() => []);
  for (const e of svg.dataset.edges.split(" ")) { const [a, b] = e.split("-").map(Number); adj[a].push(b); adj[b].push(a); }
  const ranking = root.querySelector("[data-ranking]");
  const o = outs(root);
  const measures = {
    degree: adj.map((nb) => nb.length / (n - 1)),
    closeness: adj.map((_, i) => (n - 1) / bfs(adj, i).reduce((a, b) => a + b, 0)),
    betweenness: betweenness(adj),
  };
  let measure = "degree", selected = -1;

  // Hand-placed coordinates (520 × 380): the left group, the bridge
  // Gus–Hana, the right group and the top group joined through Omar and Sam.
  const pos = [
    [130, 195], [85, 265], [65, 150], [150, 105], [40, 215], [130, 315], [215, 255],
    [300, 240], [345, 305], [385, 235], [425, 310], [455, 245], [485, 320], [500, 255],
    [325, 150], [405, 95], [335, 60], [255, 80], [185, 55], [275, 25],
  ];

  function draw() {
    svg.replaceChildren();
    const vals = measures[measure], max = Math.max(...vals);
    adj.forEach((nb, i) => nb.forEach((j) => {
      if (j < i) return;
      const lit = selected === i || selected === j;
      el("line", { x1: pos[i][0], y1: pos[i][1], x2: pos[j][0], y2: pos[j][1], style: `stroke:${lit ? "var(--brand)" : "currentColor"};stroke-opacity:${lit ? 0.8 : 0.2};stroke-width:${lit ? 1.6 : 1}` }, svg);
    }));
    names.forEach((name, i) => {
      const r = 5 + 14 * (vals[i] / max);
      const c = el("circle", { cx: pos[i][0], cy: pos[i][1], r, tabindex: 0, role: "button", "aria-label": name,
        class: "cursor-pointer outline-none transition-[r] duration-200",
        style: `fill:${i === selected ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${0.35 + 0.65 * (vals[i] / max)};stroke:var(--code-bg);stroke-width:2` }, svg);
      const pick = () => { selected = selected === i ? -1 : i; draw(); };
      c.addEventListener("click", pick);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      text(svg, pos[i][0], pos[i][1] + r + 11, name, { "text-anchor": "middle", class: i === selected ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    });
    const order = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5);
    ranking.innerHTML = "";
    for (const [v, i] of order) {
      const li = document.createElement("li");
      li.className = "grid grid-cols-[4rem_1fr_3rem] items-center gap-2";
      li.innerHTML = `<span></span><span class="h-1.5 rounded-full bg-foreground/8"><span class="block h-full rounded-full bg-brand"></span></span><span class="text-right tabular-nums"></span>`;
      li.children[0].textContent = names[i];
      li.children[1].firstChild.style.width = `${(100 * v) / max}%`;
      li.children[2].textContent = num(v, 3);
      ranking.append(li);
    }
    o.sel.textContent = selected < 0 ? "Click a person to see all three scores."
      : `${names[selected]}: degree ${num(measures.degree[selected], 2)}, betweenness ${num(measures.betweenness[selected], 2)}, closeness ${num(measures.closeness[selected], 2)} (${adj[selected].length} friends)`;
  }
  root.addEventListener("seg-change", (e) => { measure = e.detail.value; draw(); });
  draw();
}

// ============================================================ Lorenz / Gini

// Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
// Gini of a population: G = 2Σ i·x_(i) / (n Σx) − (n + 1)/n, x sorted ascending.
export function gini(xs) {
  const a = [...xs].sort((p, q) => p - q), n = a.length, sum = a.reduce((p, q) => p + q, 0);
  if (!sum) return 0;
  return (2 * a.reduce((acc, x, i) => acc + (i + 1) * x, 0)) / (n * sum) - (n + 1) / n;
}

for (const root of document.querySelectorAll("[data-gini]")) {
  const svg = root.querySelector("[data-lorenz]");
  const quint = root.querySelector("[data-quintiles]");
  const o = outs(root);
  const rng = mulberry32(99);
  const Z = Array.from({ length: 5000 }, () => gauss(rng));
  let mode = "lognormal";
  const s = scrubAll(root, () => { mode = "lognormal"; draw(); });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.preset === "equal") { mode = "lognormal"; s.sigma.set(0, false); }
    else mode = "one";
    draw();
  }));

  function draw() {
    const n = Math.round(s.n.get()), sigma = s.sigma.get();
    const xs = mode === "one" ? Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 0)) : Z.slice(0, n).map((z) => Math.exp(sigma * z));
    const a = [...xs].sort((p, q) => p - q), total = a.reduce((p, q) => p + q, 0);
    let cum = 0;
    const pts = [[0, 0], ...a.map((x, i) => { cum += x; return [(i + 1) / n, cum / total]; })];
    const G = gini(xs);

    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 320, 300], x: [0, 1], y: [0, 1], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0, 0.5, 1],
      xfmt: (v) => `${Math.round(v * 100)}%`, yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "share of people, poorest first", ylabel: "share of income" });
    const step = Math.max(1, Math.floor(pts.length / 400));
    const thin = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    el("path", { d: `M${thin.map(([x, y]) => `${f.sx(x)},${f.sy(y)}`).join(" L")} L${f.sx(1)},${f.sy(1)} L${f.sx(0)},${f.sy(0)} Z`, style: "fill:var(--brand);fill-opacity:0.12" }, svg);
    el("line", { x1: f.sx(0), y1: f.sy(0), x2: f.sx(1), y2: f.sy(1), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 4" }, svg);
    polyline(svg, thin.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-width:2");
    text(svg, f.sx(0.62), f.sy(0.7), "equality", { transform: `rotate(-43 ${f.sx(0.62)} ${f.sy(0.7)})` });

    // Quintile shares.
    quint.replaceChildren();
    const labels = ["Bottom 20%", "Second", "Middle", "Fourth", "Top 20%"];
    for (let q = 0; q < 5; q++) {
      const part = a.slice(Math.round((q * n) / 5), Math.round(((q + 1) * n) / 5)).reduce((p, x) => p + x, 0) / total;
      const row = document.createElement("div");
      row.className = "grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 font-mono text-[11px]";
      row.innerHTML = `<span class="text-muted-foreground"></span><span class="h-1.5 rounded-full bg-foreground/8"><span class="block h-full rounded-full bg-brand"></span></span><span class="text-right tabular-nums"></span>`;
      row.children[0].textContent = labels[q];
      row.children[1].firstChild.style.width = `${Math.min(100, part * 100)}%`;
      row.children[2].textContent = pct(part);
      quint.append(row);
    }
    o.gini.textContent = num(G, 3);
    o.theory.textContent = mode === "one" ? `1 − 1/n = ${num(1 - 1 / n, 3)}` : num(erf(sigma / 2), 3);
    o.top.textContent = pct(a.slice(Math.round(0.9 * n)).reduce((p, x) => p + x, 0) / total);
  }
  draw();
}

// ============================================================ Bass diffusion

for (const root of document.querySelectorAll("[data-bass]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const p = s.p.get(), q = s.q.get(), r = p + q;
    const F = (t) => (1 - Math.exp(-r * t)) / (1 + (q / p) * Math.exp(-r * t));
    const f = (t) => ((r * r) / p) * Math.exp(-r * t) / (1 + (q / p) * Math.exp(-r * t)) ** 2;
    // Time until 99% have adopted, by bisection.
    const solve = (target) => { let lo = 0, hi = 1000; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; F(m) < target ? (lo = m) : (hi = m); } return lo; };
    const T = Math.min(200, Math.max(10, Math.ceil(solve(0.99) * 1.05)));
    const ts = Array.from({ length: 301 }, (_, i) => (i * T) / 300);
    const fmax = Math.max(...ts.map(f));

    // Rogers' categories are shares of adopters in order of adoption, so
    // their boundaries are the times when 2.5%, 16%, 50% and 84% have adopted.
    const [q1, q2, q3, q4] = [0.025, 0.16, 0.5, 0.84].map(solve);

    svg.replaceChildren();
    const g = frame(svg, { box: [40, 40, 500, 260], x: [0, T], y: [0, 1], xticks: Array.from({ length: 6 }, (_, i) => Math.round((i * T) / 5)), yticks: [0, 0.5, 1],
      yfmt: (v) => `${v * 100}%`, xlabel: "years", ylabel: "adopted" });
    const cats = [["Innovators", 0, q1], ["Early adopters", q1, q2], ["Early majority", q2, q3], ["Late majority", q3, q4], ["Laggards", q4, Infinity]];
    cats.forEach(([name, a, b], i) => {
      const xa = g.sx(Math.max(0, a)), xb = g.sx(Math.min(T, b));
      if (xb <= xa) return;
      el("rect", { x: xa, y: g.T, width: xb - xa, height: g.H, style: `fill:var(--brand);fill-opacity:${0.02 + 0.03 * (i % 2)}` }, svg);
      el("line", { x1: xb, x2: xb, y1: g.T - 26, y2: g.T + g.H, style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
      text(svg, (xa + xb) / 2, g.T - 14 - (i % 2) * 12, name, { "text-anchor": "middle" });
    });
    polyline(svg, ts.map((t) => [g.sx(t), g.sy((f(t) / fmax) * 0.9)]), "stroke:var(--brand);stroke-width:1.75");
    polyline(svg, ts.map((t) => [g.sx(t), g.sy(F(t))]), "stroke:var(--foreground);stroke-width:2");
    text(svg, g.L + g.W, g.sy(0.92), "rate (scaled)", { "text-anchor": "end", style: "fill:var(--brand)" });

    const peak = q > p ? Math.log(q / p) / r : 0;
    o.peak.textContent = `${num(peak, 1)} years`;
    o.atpeak.textContent = q > p ? pct((q - p) / (2 * q)) : "0% (no peak: p ≥ q)";
    o.half.textContent = `${num(solve(0.5), 1)} years`;
  }
  draw();
}

// ============================================================ Prisoner's dilemma

const PAY = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] };
const STRATS = {
  allc: () => "C",
  alld: () => "D",
  tft: (me, them) => (them.length ? them.at(-1) : "C"),
  grim: (me, them) => (them.includes("D") ? "D" : "C"),
  // Win-stay, lose-shift: repeat after a good payoff (3 or 5), switch otherwise.
  pavlov: (me, them) => {
    if (!me.length) return "C";
    const got = PAY[me.at(-1) + them.at(-1)][0];
    return got >= 3 ? me.at(-1) : me.at(-1) === "C" ? "D" : "C";
  },
  random: (me, them, rng) => (rng() < 0.5 ? "C" : "D"),
};

for (const root of document.querySelectorAll("[data-ipd]")) {
  const results = root.querySelector("[data-results]");
  const toggles = [...root.querySelectorAll("[data-strategy]")];
  const names = Object.fromEntries(toggles.map((b) => [b.dataset.strategy, b.textContent]));
  let seed = 5;
  const s = scrubAll(root, run);

  function play(a, b, rounds, noise, rng) {
    const ha = [], hb = [];
    let sa = 0, sb = 0;
    const flip = (m) => (rng() < noise ? (m === "C" ? "D" : "C") : m);
    for (let t = 0; t < rounds; t++) {
      const ma = flip(STRATS[a](ha, hb, rng)), mb = flip(STRATS[b](hb, ha, rng));
      const [pa, pb] = PAY[ma + mb];
      sa += pa; sb += pb; ha.push(ma); hb.push(mb);
    }
    return [sa / rounds, sb / rounds];
  }

  function run() {
    const players = toggles.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.strategy);
    const rounds = Math.round(s.rounds.get()), noise = s.noise.get() / 100;
    const rng = mulberry32(seed);
    const score = Object.fromEntries(players.map((p) => [p, 0]));
    // Round robin, each pair once, everyone also against its own twin.
    for (let i = 0; i < players.length; i++) for (let j = i; j < players.length; j++) {
      const [a, b] = play(players[i], players[j], rounds, noise, rng);
      if (i === j) score[players[i]] += a;
      else { score[players[i]] += a; score[players[j]] += b; }
    }
    const avg = players.map((p) => [p, score[p] / players.length]).sort((x, y) => y[1] - x[1]);
    results.replaceChildren();
    if (players.length < 2) { results.textContent = "Pick at least two strategies."; return; }
    avg.forEach(([p, v], rank) => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-[1.25rem_9.5rem_1fr_2.5rem] items-center gap-2 text-sm";
      row.innerHTML = `<span class="font-mono text-[11px] text-muted-foreground"></span><span class="truncate"></span><span class="h-2 rounded-full bg-foreground/8"><span class="block h-full rounded-full"></span></span><span class="text-right font-mono text-xs tabular-nums"></span>`;
      row.children[0].textContent = String(rank + 1);
      row.children[1].textContent = names[p];
      const bar = row.children[2].firstChild;
      bar.style.width = `${(v / 5) * 100}%`;
      bar.style.background = rank === 0 ? "var(--brand)" : "color-mix(in oklab, var(--foreground) 45%, transparent)";
      row.children[3].textContent = num(v, 2);
      results.append(row);
    });
  }
  toggles.forEach((b) => b.addEventListener("click", () => { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); run(); }));
  root.querySelector("[data-action=replay]").addEventListener("click", () => { seed++; run(); });
  run();
}

// ============================================================ Survey sampling

const HOODS = [
  { name: "Campus", size: 1500, support: 0.7 },
  { name: "Old town", size: 3000, support: 0.45 },
  { name: "Suburbs", size: 4000, support: 0.35 },
  { name: "Riverside", size: 1500, support: 0.55 },
];
const NOTES = {
  random: "Everyone has the same chance of being picked: about 95% of the intervals should contain the truth.",
  stratified: "Sample each neighbourhood in proportion to its size: unbiased, and slightly less spread than a simple random sample.",
  convenience: "The interviewer stands outside the university and asks passers-by: only Campus is reached. A bigger sample just makes the wrong answer more precise.",
  voluntary: "An online poll anyone can answer: opponents feel more strongly and reply twice as often as supporters. Self-selection biases the result.",
};

for (const root of document.querySelectorAll("[data-sampling]")) {
  const svg = root.querySelector("[data-plot]");
  const hoods = root.querySelector("[data-hoods]");
  const o = outs(root);
  // The population: one entry per person, [neighbourhood, supports?].
  const people = [];
  HOODS.forEach((hd, k) => { const yes = Math.round(hd.size * hd.support); for (let i = 0; i < hd.size; i++) people.push([k, i < yes ? 1 : 0]); });
  const truth = people.reduce((a, p) => a + p[1], 0) / people.length;
  let method = "random", draws = [], seed = 1;
  const s = scrubAll(root, () => {});

  for (const hd of HOODS) {
    const card = document.createElement("div");
    card.className = "flex flex-col gap-1 rounded-lg border bg-background p-2.5";
    card.innerHTML = `<span class="text-xs font-medium"></span><span class="font-mono text-[11px] text-muted-foreground"></span><span class="h-1.5 rounded-full bg-foreground/8"><span class="block h-full rounded-full bg-brand"></span></span>`;
    card.children[0].textContent = hd.name;
    card.children[1].textContent = `${hd.size.toLocaleString("en")} people · ${Math.round(hd.support * 100)}% yes`;
    card.children[2].firstChild.style.width = `${hd.support * 100}%`;
    hoods.append(card);
  }

  function sample(n, rng) {
    if (method === "random") return shuffle(people.slice(), rng).slice(0, n);
    if (method === "stratified") return HOODS.flatMap((hd, k) => shuffle(people.filter((p) => p[0] === k), rng).slice(0, Math.round((n * hd.size) / people.length)));
    if (method === "convenience") return shuffle(people.filter((p) => p[0] === 0), rng).slice(0, n);
    // Voluntary response: opponents reply with probability 0.10, supporters 0.05.
    const out = [];
    for (const p of shuffle(people.slice(), rng)) { if (rng() < (p[1] ? 0.05 : 0.1)) out.push(p); if (out.length === n) break; }
    return out;
  }
  function draw1() {
    const rng = mulberry32(seed++ * 2654435761);
    const sm = sample(Math.round(s.size.get()), rng);
    const p = sm.reduce((a, x) => a + x[1], 0) / sm.length;
    const moe = 1.96 * Math.sqrt((p * (1 - p)) / sm.length);
    draws.push({ p, moe, n: sm.length });
    if (draws.length > 40) draws.shift();
  }
  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 22, 506, 168], x: [0, 41], y: [0.2, 0.8], yticks: [0.2, 0.4, 0.6, 0.8], xticks: [], yfmt: (v) => `${Math.round(v * 100)}%`, ylabel: "estimate" });
    hline(svg, f, truth, "stroke:var(--foreground);stroke-width:1.5", `truth ${pct(truth)}`);
    draws.forEach((d, i) => {
      const hit = Math.abs(d.p - truth) <= d.moe;
      const color = hit ? "var(--code-add)" : "var(--code-del)";
      const x = f.sx(i + 1);
      el("line", { x1: x, x2: x, y1: f.sy(Math.min(0.8, d.p + d.moe)), y2: f.sy(Math.max(0.2, d.p - d.moe)), style: `stroke:${color};stroke-width:2;stroke-linecap:round;stroke-opacity:0.7` }, svg);
      el("circle", { cx: x, cy: f.sy(d.p), r: 2.5, style: `fill:${color}` }, svg);
    });
    text(svg, f.L, 206, draws.length ? `${draws.length} samples, newest on the right` : "Draw a sample", {});
    const last = draws.at(-1);
    o.truth.textContent = pct(truth);
    o.est.textContent = last ? `${pct(last.p)} (n = ${last.n})` : "—";
    o.moe.textContent = last ? `±${pct(last.moe)}` : "—";
    o.cover.textContent = draws.length ? `${draws.filter((d) => Math.abs(d.p - truth) <= d.moe).length} / ${draws.length}` : "—";
    o.note.textContent = NOTES[method];
  }
  root.addEventListener("seg-change", (e) => { method = e.detail.value; draws = []; draw(); });
  root.querySelector("[data-action=draw]").addEventListener("click", () => { draw1(); draw(); });
  root.querySelector("[data-action=draw20]").addEventListener("click", () => { for (let i = 0; i < 20; i++) draw1(); draw(); });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { draws = []; draw(); });
  draw();
}

// ============================================================ Mobility

for (const root of document.querySelectorAll("[data-mobility]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const STARTS = { working: [1, 0, 0], upper: [0, 0, 1], mixed: [0.5, 0.35, 0.15] };
  const COLORS = ["var(--vec-u)", "var(--ion-cl)", "var(--brand)"];
  const LABELS = ["Working", "Middle", "Upper"];
  let start = STARTS.working;
  let s;
  s = scrubAll(root, (name) => {
    // Keep the row stochastic: rescale the other two entries to fill 1 − edited.
    const i = Number(name[1]), j = Number(name[2]);
    const v = s[name].get();
    const others = [0, 1, 2].filter((k) => k !== j);
    const rest = others.reduce((a, k) => a + s[`m${i}${k}`].get(), 0);
    others.forEach((k) => s[`m${i}${k}`].set(rest > 0 ? ((1 - v) * s[`m${i}${k}`].get()) / rest : (1 - v) / 2, false));
    draw();
  });
  const M = () => [0, 1, 2].map((i) => [0, 1, 2].map((j) => s[`m${i}${j}`].get()));
  const stepDist = (d, m) => [0, 1, 2].map((j) => d.reduce((a, di, i) => a + di * m[i][j], 0));

  function draw() {
    const m = M();
    const gens = [start];
    for (let g = 1; g <= 8; g++) gens.push(stepDist(gens.at(-1), m));
    let pi = [1 / 3, 1 / 3, 1 / 3];
    for (let k = 0; k < 2000; k++) pi = stepDist(pi, m);
    const bars = [...gens, pi];

    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 500, 236], x: [0, bars.length], y: [0, 1], yticks: [0, 0.5, 1], xticks: [], yfmt: (v) => `${v * 100}%`, ylabel: "share" });
    const bw = f.W / bars.length;
    bars.forEach((d, g) => {
      let y = 0;
      d.forEach((v, c) => {
        el("rect", { x: f.L + g * bw + 4, y: f.sy(y + v), width: bw - 8, height: f.sy(y) - f.sy(y + v), rx: 2, style: `fill:${COLORS[c]};fill-opacity:${g === bars.length - 1 ? 0.95 : 0.7}` }, svg);
        y += v;
      });
      text(svg, f.L + g * bw + bw / 2, f.T + f.H + 14, g === bars.length - 1 ? "∞" : String(g), { "text-anchor": "middle" });
    });
    text(svg, f.L + f.W, f.T + f.H + 28, "generation", { "text-anchor": "end" });
    LABELS.forEach((l, c) => {
      el("rect", { x: 46 + c * 80, y: 284, width: 8, height: 8, rx: 2, style: `fill:${COLORS[c]}` }, svg);
      text(svg, 58 + c * 80, 291, l);
    });
    o.stationary.textContent = pi.map((v, c) => `${LABELS[c][0]} ${Math.round(v * 100)}`).join(" · ") + "%";
    o.stay.textContent = pct(pi.reduce((a, v, i) => a + v * m[i][i], 0), 0);
  }
  root.addEventListener("seg-change", (e) => { start = STARTS[e.detail.value]; draw(); });
  draw();
}
