// Algorithms and data structures: sorting, growth of functions, binary
// search, grid search, hashing, trees, stacks and queues, edit distance.

import { scrubAll } from "./scrub.js";
import { frame, polyline, text, num } from "./plot.js";
import { reduced, outs, mulberry32, shuffle, playButton, node, action, onSeg, PALETTE, ticker } from "./discrete-util.js";

// ============================================================ Sorting

// Each sort records its operations: compare, swap, or write a value.
function trace(kind, input) {
  const a = input.slice(), ops = [];
  const cmp = (i, j) => { ops.push(["c", i, j]); return a[i] - a[j]; };
  const swap = (i, j) => { ops.push(["s", i, j]); [a[i], a[j]] = [a[j], a[i]]; };
  const set = (i, v) => { ops.push(["w", i, v]); a[i] = v; };
  const n = a.length;
  if (kind === "bubble") {
    for (let end = n - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) if (cmp(i, i + 1) > 0) { swap(i, i + 1); swapped = true; }
      if (!swapped) break;
    }
  } else if (kind === "insertion") {
    for (let i = 1; i < n; i++) for (let j = i; j > 0 && cmp(j - 1, j) > 0; j--) swap(j - 1, j);
  } else if (kind === "merge") {
    const sort = (lo, hi) => {
      if (hi - lo < 2) return;
      const mid = (lo + hi) >> 1;
      sort(lo, mid); sort(mid, hi);
      const left = a.slice(lo, mid), right = a.slice(mid, hi);
      let i = 0, j = 0, k = lo;
      while (i < left.length && j < right.length) {
        ops.push(["c", lo + i, mid + j]);
        set(k++, left[i] <= right[j] ? left[i++] : right[j++]);
      }
      while (i < left.length) set(k++, left[i++]);
      while (j < right.length) set(k++, right[j++]);
    };
    sort(0, n);
  } else if (kind === "quick") {
    // Lomuto partition, last element as pivot: O(n²) on sorted input.
    const sort = (lo, hi) => {
      if (lo >= hi) return;
      let p = lo;
      for (let j = lo; j < hi; j++) if (cmp(j, hi) < 0) { if (p !== j) swap(p, j); p++; }
      if (p !== hi) swap(p, hi);
      sort(lo, p - 1); sort(p + 1, hi);
    };
    sort(0, n - 1);
  } else {
    const sift = (i, size) => {
      for (;;) {
        let big = i;
        const l = 2 * i + 1, r = l + 1;
        if (l < size && cmp(l, big) > 0) big = l;
        if (r < size && cmp(r, big) > 0) big = r;
        if (big === i) return;
        swap(i, big);
        i = big;
      }
    };
    for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
    for (let end = n - 1; end > 0; end--) { swap(0, end); sift(0, end); }
  }
  return ops;
}

for (const root of document.querySelectorAll("[data-asort]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector('[data-action="play"]'), ["Sort", "Pause"]);
  let kind = "bubble", seed = 1, initial, arr, ops, at, cmps, writes, current = null;
  const s = scrubAll(root, (name) => name === "n" && build("shuffle"));

  function build(mode) {
    const n = Math.round(s.n.get());
    initial = Array.from({ length: n }, (_, i) => i + 1);
    if (mode === "shuffle") shuffle(initial, mulberry32(seed));
    else initial.reverse();
    reset();
  }
  function reset() {
    t.stop();
    arr = initial.slice();
    ops = trace(kind, initial);
    at = cmps = writes = 0;
    current = null;
    draw();
  }
  function apply() {
    if (at >= ops.length) { current = null; draw(); return false; }
    const op = ops[at++];
    if (op[0] === "c") cmps++;
    else if (op[0] === "s") { [arr[op[1]], arr[op[2]]] = [arr[op[2]], arr[op[1]]]; writes += 2; }
    else { arr[op[1]] = op[2]; writes++; }
    current = op;
    return true;
  }
  const t = ticker(root, () => {
    const k = Math.round(s.speed.get());
    let more = true;
    for (let i = 0; i < k && more; i++) more = apply();
    draw();
    return more && at < ops.length;
  }, 16);
  t.onChange = setPlay;
  onSeg(root, (v) => { kind = v; reset(); });
  action(root, "play", () => {
    if (t.playing) return t.stop();
    if (at >= ops.length) reset();
    if (reduced()) { while (apply()); draw(); return; }
    t.start();
  });
  action(root, "step", () => { t.stop(); apply(); draw(); });
  action(root, "shuffle", () => { seed++; build("shuffle"); });
  action(root, "reversed", () => build("reversed"));

  function draw() {
    svg.replaceChildren();
    const n = arr.length, w = 600 / n, done = at >= ops.length;
    arr.forEach((v, i) => {
      const hit = current && (current[1] === i || (current[0] !== "w" && current[2] === i));
      const color = done ? "var(--code-add)" : hit ? (current[0] === "c" ? "var(--brand)" : "var(--vec-out)") : "color-mix(in oklab, var(--foreground) 45%, transparent)";
      const h = (v / n) * 290;
      node("rect", { x: i * w + w * 0.1, y: 300 - h, width: w * 0.8, height: h, rx: Math.min(3, w * 0.2), style: `fill:${color}` }, svg);
    });
    o.cmp.textContent = cmps.toLocaleString("en-US");
    o.writes.textContent = writes.toLocaleString("en-US");
    o.prog.textContent = `${at} / ${ops.length} ops`;
    o.nlogn.textContent = Math.round(n * Math.log2(n)).toLocaleString("en-US");
  }
  build("shuffle");
}

// ============================================================ Growth

const CLASSES = [
  ["1", (n) => 0, "var(--foreground)"],
  ["log n", (n) => Math.log10(Math.max(1, Math.log2(n))), "var(--ion-cl)"],
  ["n", (n) => Math.log10(n), "var(--vec-u)"],
  ["n log n", (n) => Math.log10(n * Math.max(1, Math.log2(n))), "var(--ion-k)"],
  ["n²", (n) => 2 * Math.log10(n), "var(--vec-out)"],
  ["2ⁿ", (n) => n * Math.log10(2), "var(--brand)"],
];

// Seconds, given log10 of the operation count at 1e9 operations per second.
function duration(log10ops) {
  const lg = log10ops - 9;
  if (lg > 17.64) return `≈ 10^${Math.floor(lg - 7.5)} years`; // beyond the age of the universe (4.35e17 s)
  const sec = 10 ** lg;
  if (sec < 1e-6) return `${num(sec * 1e9, 0)} ns`;
  if (sec < 1e-3) return `${num(sec * 1e6, 1)} µs`;
  if (sec < 1) return `${num(sec * 1e3, 1)} ms`;
  if (sec < 120) return `${num(sec, 1)} s`;
  if (sec < 7200) return `${num(sec / 60, 1)} min`;
  if (sec < 172800) return `${num(sec / 3600, 1)} h`;
  if (sec < 3.15e7 * 2) return `${num(sec / 86400, 1)} days`;
  return `${(sec / 3.156e7).toPrecision(3)} years`;
}

function countComparisons(kind, n, seed) {
  const a = shuffle(Array.from({ length: n }, (_, i) => i), mulberry32(seed));
  return trace(kind, a).filter((op) => op[0] === "c").length;
}

for (const root of document.querySelectorAll("[data-agrowth]")) {
  const theory = root.querySelector("[data-theory]");
  const measured = root.querySelector("[data-measured]");
  const table = root.querySelector("[data-table]");
  const s = scrubAll(root, draw);

  // Measured once: average comparisons over three random arrays per size.
  const sizes = [10, 20, 40, 80, 160, 320, 640];
  const meas = ["insertion", "merge"].map((k) => sizes.map((n) => [n, [1, 2, 3].reduce((acc, sd) => acc + countComparisons(k, n, sd * 101 + n), 0) / 3]));
  measured.replaceChildren();
  const m = frame(measured, { box: [40, 12, 248, 206], x: [1, Math.log10(640)], y: [0, 6], xticks: [1, 2], yticks: [0, 2, 4, 6], xfmt: (v) => `10^${v}`, yfmt: (v) => `10^${v}`, xlabel: "n", ylabel: "comparisons" });
  const lg = (v) => Math.log10(Math.max(1, v));
  polyline(measured, sizes.map((n) => [m.sx(Math.log10(n)), m.sy(lg((n * n) / 4))]), "stroke:var(--vec-out);stroke-width:1;stroke-dasharray:4 4");
  polyline(measured, sizes.map((n) => [m.sx(Math.log10(n)), m.sy(lg(n * Math.log2(n)))]), "stroke:var(--ion-k);stroke-width:1;stroke-dasharray:4 4");
  meas.forEach((series, i) => {
    const color = i ? "var(--ion-k)" : "var(--vec-out)";
    polyline(measured, series.map(([n, c]) => [m.sx(Math.log10(n)), m.sy(lg(c))]), `stroke:${color};stroke-width:1.75`);
    series.forEach(([n, c]) => node("circle", { cx: m.sx(Math.log10(n)), cy: m.sy(lg(c)), r: 2.5, style: `fill:${color}` }, measured));
  });
  text(measured, m.L + 6, m.T + 10, "insertion sort (dashed: n²/4)", { style: "fill:var(--vec-out)" });
  text(measured, m.L + 6, m.T + 22, "merge sort (dashed: n log₂ n)", { style: "fill:var(--ion-k)" });

  function draw() {
    const n = Math.max(1, Math.round(s.n.get()));
    theory.replaceChildren();
    const f = frame(theory, { box: [40, 12, 248, 206], x: [0, 6], y: [0, 18], xticks: [0, 2, 4, 6], yticks: [0, 6, 12, 18], xfmt: (v) => `10^${v}`, yfmt: (v) => `10^${v}`, xlabel: "n", ylabel: "steps" });
    for (const [, g, color] of CLASSES) {
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const x = (i / 120) * 6, v = g(10 ** x);
        if (v > 18.5) { pts.push([f.sx(x), f.sy(18.5)]); break; }
        pts.push([f.sx(x), f.sy(v)]);
      }
      polyline(theory, pts, `stroke:${color};stroke-width:1.75`);
    }
    const x = Math.log10(n);
    node("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:2 3" }, theory);
    table.replaceChildren(...CLASSES.map(([name, g, color]) => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-[5rem_1fr_auto] items-center gap-2";
      const ops = g(n);
      row.innerHTML = `<span class="flex items-center gap-1.5"><span class="size-2 rounded-full" style="background:${color}"></span>${name}</span><span class="text-muted-foreground">${ops > 15 ? `10^${Math.floor(ops)} steps` : Math.round(10 ** ops).toLocaleString("en-US")}</span><span class="tabular-nums">${duration(ops)}</span>`;
      return row;
    }));
  }
  draw();
}

// ============================================================ Binary search

for (const root of document.querySelectorAll("[data-asearch]")) {
  const cells = root.querySelector("[data-cells]");
  const o = outs(root);
  let seed = 2, arr, lo, hi, mid, found, steps, log;
  const s = scrubAll(root, reset);
  function makeArray() {
    const rng = mulberry32(seed), pool = shuffle(Array.from({ length: 100 }, (_, i) => i), rng);
    arr = pool.slice(0, 32).sort((a, b) => a - b);
  }
  function reset() {
    lo = 0; hi = arr.length - 1; mid = -1; found = -1; steps = 0; log = "ready: the whole array is in range";
    const target = Math.round(s.target.get());
    const idx = arr.indexOf(target);
    o.lin.textContent = idx >= 0 ? `found at index ${idx} after ${idx + 1} comparisons` : `not present: ${arr.length} comparisons`;
    draw();
  }
  function step() {
    if (found >= 0 || lo > hi) return;
    const target = Math.round(s.target.get());
    mid = (lo + hi) >> 1;
    steps++;
    const v = arr[mid];
    if (v === target) { found = mid; log = `step ${steps}: a[${mid}] = ${v}: found in ${steps} comparisons`; }
    else if (v < target) { log = `step ${steps}: a[${mid}] = ${v} < ${target}: keep the right half`; lo = mid + 1; }
    else { log = `step ${steps}: a[${mid}] = ${v} > ${target}: keep the left half`; hi = mid - 1; }
    if (found < 0 && lo > hi) log += ` · not present after ${steps} comparisons`;
    draw();
  }
  action(root, "step", step);
  action(root, "reset", reset);
  action(root, "shuffle", () => { seed++; makeArray(); s.target.set(arr[21], false); reset(); });
  function draw() {
    cells.replaceChildren(...arr.map((v, i) => {
      const d = document.createElement("div");
      const inRange = i >= lo && i <= hi && found < 0;
      d.className = "flex flex-col items-center rounded-md border py-1 font-mono text-xs transition-colors duration-150 " +
        (i === found ? "border-transparent bg-add text-white" : i === mid ? "border-brand bg-brand/10 text-brand" : inRange ? "bg-background" : "border-transparent text-muted-foreground/40");
      d.innerHTML = `<span class="tabular-nums">${v}</span><span class="text-[9px] opacity-50">${i}</span>`;
      return d;
    }));
    o.bin.textContent = `${log} (worst case ⌊log₂ ${arr.length}⌋ + 1 = ${Math.floor(Math.log2(arr.length)) + 1})`;
  }
  makeArray();
  s.target.set(arr[21], false);
  reset();
}

// ============================================================ Grid search

const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function rgbOf(css) {
  const span = document.createElement("span");
  span.style.color = css;
  span.hidden = true;
  document.body.append(span);
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(span).color;
  probe.fillRect(0, 0, 1, 1);
  span.remove();
  return `rgb(${[...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(",")})`;
}

for (const root of document.querySelectorAll("[data-apath]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector('[data-action="play"]'), ["Search", "Pause"]);
  const W = 35, H = 21;
  let grid = new Uint8Array(W * H), start = [3, 10], goal = [31, 10], algo = "bfs", brush = "wall", seed = 5;
  let result = null, shown = 0, colors;
  const id = (x, y) => y * W + x;
  const readColors = () => (colors = { wall: rgbOf("var(--foreground)"), mud: rgbOf("var(--vec-out)"), seen: rgbOf("var(--vec-u)"), path: rgbOf("var(--brand)"), bg: rgbOf("var(--code-bg)"), grid: rgbOf("var(--border)") });

  // Wall in the middle by default, with a gap, so the searches differ.
  for (let y = 3; y < 18; y++) grid[id(17, y)] = 1;
  for (let y = 8; y < 13; y++) grid[id(17, y)] = 0;
  for (let x = 20; x < 26; x++) for (let y = 7; y < 14; y++) grid[id(x, y)] = 2;

  function search() {
    const N = W * H, s0 = id(...start), g0 = id(...goal);
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N);
    const order = [];
    const cost = (i) => (grid[i] === 2 ? 5 : 1);
    const nbrs = (i) => {
      const x = i % W, y = (i / W) | 0, out = [];
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[id(nx, ny)] !== 1) out.push(id(nx, ny));
      }
      return out;
    };
    const h = (i) => Math.abs((i % W) - goal[0]) + Math.abs(((i / W) | 0) - goal[1]);
    dist[s0] = 0;
    if (algo === "bfs" || algo === "dfs") {
      const list = [s0];
      seen[s0] = 1;
      while (list.length) {
        const v = algo === "bfs" ? list.shift() : list.pop();
        order.push(v);
        if (v === g0) break;
        const ns = nbrs(v);
        if (algo === "dfs") ns.reverse(); // so the first neighbour is explored first
        for (const w of ns) if (!seen[w]) { seen[w] = 1; prev[w] = v; dist[w] = dist[v] + cost(w); list.push(w); }
      }
    } else {
      // Dijkstra, or A* with the Manhattan distance (admissible: every step costs ≥ 1).
      const open = [[algo === "astar" ? h(s0) : 0, s0]];
      while (open.length) {
        let bi = 0;
        for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
        const [, v] = open.splice(bi, 1)[0];
        if (seen[v]) continue;
        seen[v] = 1;
        order.push(v);
        if (v === g0) break;
        for (const w of nbrs(v)) {
          const d = dist[v] + cost(w);
          if (d < dist[w]) { dist[w] = d; prev[w] = v; open.push([d + (algo === "astar" ? h(w) : 0), w]); }
        }
      }
    }
    const path = [];
    if (prev[g0] >= 0 || s0 === g0) for (let v = g0; v >= 0; v = prev[v]) path.unshift(v);
    const pathCost = path.slice(1).reduce((acc, i) => acc + cost(i), 0);
    return { order, path, pathCost };
  }

  function run() {
    result = search();
    shown = 0;
    if (reduced()) { shown = result.order.length; draw(); return; }
    t.start();
  }
  const t = ticker(root, () => {
    shown = Math.min(result.order.length, shown + Math.max(2, Math.ceil(result.order.length / 80)));
    draw();
    return shown < result.order.length;
  }, 16);
  t.onChange = setPlay;
  onSeg(root, (v) => { algo = v; t.stop(); result = null; draw(); });
  root.querySelectorAll("[data-brush]").forEach((b) => b.addEventListener("click", () => {
    brush = b.dataset.brush;
    root.querySelectorAll("[data-brush]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  action(root, "play", () => (t.playing ? t.stop() : run()));
  action(root, "clear", () => { t.stop(); grid.fill(0); result = null; draw(); });
  action(root, "maze", () => {
    t.stop();
    const rng = mulberry32(seed++);
    for (let i = 0; i < grid.length; i++) grid[i] = rng() < 0.28 ? 1 : rng() < 0.08 ? 2 : 0;
    grid[id(...start)] = grid[id(...goal)] = 0;
    result = null;
    draw();
  });

  const cellAt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W))), Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H)))];
  };
  const paint = (e) => {
    const [x, y] = cellAt(e);
    if (brush === "start") start = [x, y];
    else if (brush === "goal") goal = [x, y];
    else if ((x !== start[0] || y !== start[1]) && (x !== goal[0] || y !== goal[1])) grid[id(x, y)] = { wall: 1, mud: 2, erase: 0 }[brush];
    if (brush === "start" || brush === "goal") grid[id(x, y)] = 0;
    t.stop();
    result = null;
    draw();
  };
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); paint(e); });
  canvas.addEventListener("pointermove", (e) => { if (canvas.hasPointerCapture(e.pointerId)) paint(e); });

  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    const cw = canvas.width / W, ch = canvas.height / H;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (result) {
      ctx.fillStyle = colors.seen;
      for (let k = 0; k < shown; k++) {
        const i = result.order[k];
        ctx.globalAlpha = 0.12 + 0.3 * (k / result.order.length);
        ctx.fillRect((i % W) * cw, ((i / W) | 0) * ch, cw, ch);
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]) continue;
      ctx.fillStyle = grid[i] === 1 ? colors.wall : colors.mud;
      ctx.globalAlpha = grid[i] === 1 ? 0.85 : 0.4;
      ctx.fillRect((i % W) * cw, ((i / W) | 0) * ch, cw, ch);
    }
    // Grid lines fade out when the cells get small (phones).
    ctx.globalAlpha = cw < 14 * Math.min(2, devicePixelRatio || 1) ? 0.2 : 0.45;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < W; x++) { ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, canvas.height); }
    for (let y = 1; y < H; y++) { ctx.moveTo(0, y * ch); ctx.lineTo(canvas.width, y * ch); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    const done = result && shown >= result.order.length;
    if (done && result.path.length) {
      ctx.strokeStyle = colors.path;
      ctx.lineWidth = Math.max(2, cw * 0.3);
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.beginPath();
      result.path.forEach((i, k) => { const x = (i % W + 0.5) * cw, y = (((i / W) | 0) + 0.5) * ch; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    for (const [[x, y], label] of [[start, "S"], [goal, "G"]]) {
      ctx.fillStyle = colors.path;
      ctx.beginPath();
      ctx.arc((x + 0.5) * cw, (y + 0.5) * ch, Math.min(cw, ch) * 0.42, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.round(ch * 0.5)}px Geist, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, (x + 0.5) * cw, (y + 0.5) * ch + 1);
    }
    const o2 = outs(root);
    o2.visited.textContent = result ? String(shown) : "—";
    o2.steps.textContent = done ? (result.path.length ? String(result.path.length - 1) : "no path") : "—";
    o2.cost.textContent = done ? (result.path.length ? `${result.pathCost}${algo === "bfs" || algo === "dfs" ? " (mud ignored when searching)" : ""}` : "—") : "—";
  }
  new ResizeObserver(draw).observe(canvas);
  new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  readColors();
  draw();
}

// ============================================================ Hash table

const WORDS = ["apple", "banana", "cherry", "date", "elder", "fig", "grape", "kiwi", "lemon", "mango", "nectar", "olive", "peach", "quince", "rasp", "straw", "tomato", "ugli", "vanilla", "walnut"];

// Polynomial string hash: h = (h·31 + code) mod m, one character at a time.
const hashOf = (key, m) => [...key].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) % m, 0);

for (const root of document.querySelectorAll("[data-ahash]")) {
  const table = root.querySelector("[data-table]");
  const form = root.querySelector("[data-insert]");
  const input = form.querySelector("[data-input]");
  const o = outs(root);
  let mode = "chain", keys = [], last = null;
  const s = scrubAll(root, rebuild);

  // Rebuilds from scratch in insertion order, so m and the strategy can change.
  let buckets, collisions, lastInfo;
  function rebuild() {
    const m = Math.round(s.m.get());
    buckets = mode === "chain" ? Array.from({ length: m }, () => []) : new Array(m).fill(null);
    collisions = 0;
    lastInfo = "—";
    const kept = [];
    for (const k of keys) {
      const h = hashOf(k, m);
      if (mode === "chain") {
        if (buckets[h].length) collisions++;
        buckets[h].push(k);
        kept.push(k);
        lastInfo = `h("${k}") = ${h}${buckets[h].length > 1 ? `, chain length ${buckets[h].length}` : ""}`;
      } else {
        let i = h, probes = 1;
        while (buckets[i] !== null && probes <= m) { i = (i + 1) % m; probes++; }
        if (probes > m) { lastInfo = `"${k}" not inserted: table full`; continue; }
        if (i !== h) collisions++;
        buckets[i] = { k, home: h };
        kept.push(k);
        lastInfo = `h("${k}") = ${h}, ${probes} probe${probes > 1 ? "s" : ""}${i !== h ? ` → slot ${i}` : ""}`;
      }
    }
    keys = kept;
    draw();
  }
  const insert = (k) => {
    k = k.trim().toLowerCase().slice(0, 12);
    if (!k) return;
    if (keys.includes(k)) { o.last.textContent = `"${k}" is already in the table`; return; }
    keys.push(k);
    last = k;
    rebuild();
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); insert(input.value); input.value = ""; input.focus(); });
  onSeg(root, (v) => { mode = v; rebuild(); });
  action(root, "words", () => WORDS.filter((w) => !keys.includes(w)).slice(0, 8).forEach((w) => { keys.push(w); last = w; }) || rebuild());
  action(root, "clear", () => { keys = []; last = null; rebuild(); });

  function draw() {
    const m = buckets.length;
    table.replaceChildren(...buckets.map((b, i) => {
      const row = document.createElement("div");
      row.className = "flex min-h-7 items-center gap-2";
      const chips = (mode === "chain" ? b : b ? [b.k] : []).map((k) => {
        const home = mode === "probe" && b.home !== i ? `<sup class="ml-0.5 text-[9px] text-muted-foreground">${b.home}</sup>` : "";
        return `<span class="rounded-md border px-1.5 py-0.5 ${k === last ? "border-brand bg-brand/10 text-brand" : "bg-background"}">${k}${home}</span>`;
      });
      row.innerHTML = `<span class="w-6 text-right text-muted-foreground tabular-nums">${i}</span><span class="h-px w-3 bg-border"></span>${chips.join('<span class="text-muted-foreground">→</span>') || '<span class="text-muted-foreground/40">∅</span>'}`;
      return row;
    }));
    o.n.textContent = String(keys.length);
    o.alpha.textContent = num(keys.length / m, 2);
    o.coll.textContent = String(collisions);
    o.last.textContent = lastInfo;
  }
  rebuild();
}

// ============================================================ Trees

for (const root of document.querySelectorAll("[data-atree]")) {
  const svg = root.querySelector("[data-plot]");
  const form = root.querySelector("[data-insert]");
  const input = form.querySelector("[data-input]");
  const o = outs(root);
  let mode = "bst", bst = null, heap = [], last = "—", lastKey = null, seed = 9;

  const bstInsert = (t, k, depth = 0) => {
    if (!t) { last = `inserted ${k} at depth ${depth}`; return { k, l: null, r: null }; }
    if (k === t.k) { last = `${k} is already in the tree`; return t; }
    if (k < t.k) t.l = bstInsert(t.l, k, depth + 1); else t.r = bstInsert(t.r, k, depth + 1);
    return t;
  };
  const bstDeleteMin = (t) => (t.l ? ((t.l = bstDeleteMin(t.l)), t) : t.r);
  const bstMin = (t) => (t.l ? bstMin(t.l) : t.k);
  const height = (t) => (t ? 1 + Math.max(height(t.l), height(t.r)) : 0);
  const inorder = (t, out = []) => (t && (inorder(t.l, out), out.push(t.k), inorder(t.r, out)), out);

  const heapInsert = (k) => {
    heap.push(k);
    let i = heap.length - 1, swaps = 0;
    while (i > 0 && heap[(i - 1) >> 1] > heap[i]) { [heap[i], heap[(i - 1) >> 1]] = [heap[(i - 1) >> 1], heap[i]]; i = (i - 1) >> 1; swaps++; }
    last = `inserted ${k}: sifted up ${swaps} time${swaps === 1 ? "" : "s"}`;
  };
  const heapPop = () => {
    const min = heap[0], end = heap.pop();
    if (heap.length) heap[0] = end;
    let i = 0, swaps = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < heap.length && heap[l] < heap[m]) m = l;
      if (r < heap.length && heap[r] < heap[m]) m = r;
      if (m === i) break;
      [heap[i], heap[m]] = [heap[m], heap[i]];
      i = m;
      swaps++;
    }
    last = `removed ${min}: sifted down ${swaps} time${swaps === 1 ? "" : "s"}`;
  };

  const insert = (k) => {
    if (!Number.isFinite(k)) return;
    lastKey = k;
    if (mode === "bst") bst = bstInsert(bst, k); else heapInsert(k);
    draw();
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); insert(parseInt(input.value, 10)); input.select(); });
  onSeg(root, (v) => { mode = v; last = "—"; lastKey = null; draw(); });
  action(root, "remove", () => {
    if (mode === "bst") { if (bst) { const k = bstMin(bst); bst = bstDeleteMin(bst); last = `removed ${k}`; } }
    else if (heap.length) heapPop();
    lastKey = null;
    draw();
  });
  action(root, "random", () => {
    const rng = mulberry32(seed++);
    const ks = shuffle(Array.from({ length: 99 }, (_, i) => i + 1), rng).slice(0, 7);
    ks.forEach((k) => (mode === "bst" ? (bst = bstInsert(bst, k)) : heapInsert(k)));
    last = `inserted ${ks.join(", ")}`;
    lastKey = ks.at(-1);
    draw();
  });
  action(root, "sorted", () => {
    for (let k = 1; k <= 7; k++) mode === "bst" ? (bst = bstInsert(bst, k)) : heapInsert(k);
    last = "inserted 1…7 in order";
    lastKey = 7;
    draw();
  });
  action(root, "clear", () => { if (mode === "bst") bst = null; else heap = []; last = "—"; lastKey = null; draw(); });

  function draw() {
    svg.replaceChildren();
    const nodes = [], edges = [];
    if (mode === "bst") {
      // x from the in-order rank, y from the depth.
      let rank = 0;
      const place = (t, d) => {
        if (!t) return null;
        const l = place(t.l, d + 1), me = { k: t.k, x: rank++, d };
        const r = place(t.r, d + 1);
        nodes.push(me);
        if (l) edges.push([me, l]);
        if (r) edges.push([me, r]);
        return me;
      };
      place(bst, 0);
      const n = nodes.length;
      nodes.forEach((p) => { p.px = n === 1 ? 280 : 30 + (p.x / (n - 1)) * 500; p.py = 30 + p.d * 48; });
    } else {
      heap.forEach((k, i) => {
        const d = Math.floor(Math.log2(i + 1)), pos = i + 1 - 2 ** d, span = 2 ** d;
        nodes.push({ k, px: 30 + ((pos + 0.5) / span) * 500, py: 30 + d * 56 });
        if (i) edges.push([nodes[(i - 1) >> 1], nodes[i]]);
      });
    }
    for (const [a, b] of edges) node("line", { x1: a.px, y1: a.py, x2: b.px, y2: b.py, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.5" }, svg);
    for (const p of nodes) {
      const hit = p.k === lastKey;
      node("circle", { cx: p.px, cy: p.py, r: 15, style: `fill:${hit ? "color-mix(in oklab, var(--brand) 18%, var(--code-bg))" : "var(--code-bg)"};stroke:${hit ? "var(--brand)" : "var(--foreground)"};stroke-width:${hit ? 2.5 : 1.5}` }, svg);
      node("text", { x: p.px, y: p.py + 4, "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" }, svg, String(p.k));
    }
    if (!nodes.length) node("text", { x: 280, y: 160, "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[11px]" }, svg, "Empty: insert a number");
    const size = mode === "bst" ? nodes.length : heap.length;
    const hgt = mode === "bst" ? height(bst) - 1 : heap.length ? Math.floor(Math.log2(heap.length)) : -1;
    o.size.textContent = String(size);
    o.height.textContent = size ? `${hgt} (edges)` : "—";
    o.walk.textContent = mode === "bst" ? (size ? `in-order ${inorder(bst).join(" ")}` : "—") : size ? `array [${heap.join(", ")}]` : "—";
    o.last.textContent = last;
  }
  draw();
}

// ============================================================ Stack, queue, list

for (const root of document.querySelectorAll("[data-astruct]")) {
  const view = root.querySelector("[data-view]");
  const input = root.querySelector("[data-input]");
  const add = root.querySelector('[data-action="add"]');
  const take = root.querySelector('[data-action="take"]');
  const o = outs(root);
  let mode = "stack";
  const data = { stack: [3, 8, 5], queue: [3, 8, 5], list: [3, 8, 5] };
  const LABELS = { stack: ["Push", "Pop"], queue: ["Enqueue", "Dequeue"], list: ["Insert head", "Remove head"] };
  const setLabels = () => {
    add.lastChild.textContent = LABELS[mode][0];
    take.lastChild.textContent = LABELS[mode][1];
  };
  onSeg(root, (v) => { mode = v; setLabels(); o.log.textContent = "—"; draw(); });
  add.addEventListener("click", () => {
    const v = parseInt(input.value, 10);
    if (!Number.isFinite(v)) return;
    const d = data[mode];
    if (mode === "list") d.unshift(v); else d.push(v);
    o.log.textContent = `${LABELS[mode][0].toLowerCase()} ${v} → size ${d.length} · O(1)`;
    input.value = String((v * 7 + 3) % 20);
    draw(mode === "list" ? 0 : d.length - 1);
  });
  take.addEventListener("click", () => {
    const d = data[mode];
    if (!d.length) { o.log.textContent = "empty: nothing to remove"; return; }
    const v = mode === "stack" ? d.pop() : d.shift();
    o.log.textContent = `${LABELS[mode][1].toLowerCase()} → ${v} · size ${d.length} · O(1)`;
    draw();
  });

  const box = (v, cls = "") => `<span class="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background font-mono text-sm ${cls}">${v}</span>`;
  const tag = (s) => `<span class="font-mono text-[10px] text-muted-foreground">${s}</span>`;
  function draw(fresh = -1) {
    const d = data[mode];
    const cls = (i) => (i === fresh ? "enter border-brand text-brand" : "");
    if (mode === "stack") {
      view.innerHTML = `<div class="flex flex-col-reverse items-center gap-1">${d.map((v, i) => box(v, cls(i))).join("")}${d.length ? "" : tag("empty")}</div><div class="ml-3 flex flex-col justify-start self-stretch pt-1">${d.length ? tag("← top") : ""}</div>`;
    } else if (mode === "queue") {
      view.innerHTML = `<div class="flex items-center gap-2">${tag("front")}${d.map((v, i) => box(v, cls(i))).join("") || tag("empty")}${tag("back")}</div>`;
    } else {
      view.innerHTML = `<div class="flex items-center gap-1">${tag("head")}<span class="text-muted-foreground">→</span>${d.map((v, i) => `${box(v, cls(i))}<span class="text-muted-foreground">→</span>`).join("")}${tag("null")}</div>`;
    }
  }
  setLabels();
  draw();
}

// ============================================================ Edit distance

for (const root of document.querySelectorAll("[data-adp]")) {
  const grid = root.querySelector("[data-grid]");
  const ia = root.querySelector('[data-input="a"]');
  const ib = root.querySelector('[data-input="b"]');
  const o = outs(root);
  const setPlay = playButton(root.querySelector('[data-action="play"]'), ["Fill", "Pause"]);
  let a, b, D, filled, path;

  function reset() {
    t.stop();
    a = ia.value.toLowerCase().slice(0, 12);
    b = ib.value.toLowerCase().slice(0, 12);
    D = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(null));
    filled = 0;
    path = null;
    draw();
  }
  const total = () => (a.length + 1) * (b.length + 1);
  function fillOne() {
    if (filled >= total()) return false;
    const i = Math.floor(filled / (b.length + 1)), j = filled % (b.length + 1);
    D[i][j] = i === 0 ? j : j === 0 ? i : Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    filled++;
    if (filled === total()) traceback();
    return filled < total();
  }
  function traceback() {
    path = new Set();
    const ops = [];
    let i = a.length, j = b.length;
    path.add(`${i},${j}`);
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && D[i][j] === D[i - 1][j - 1]) { ops.unshift(`keep ${a[i - 1]}`); i--; j--; }
      else if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + 1) { ops.unshift(`${a[i - 1]}→${b[j - 1]}`); i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.unshift(`delete ${a[i - 1]}`); i--; }
      else { ops.unshift(`insert ${b[j - 1]}`); j--; }
      path.add(`${i},${j}`);
    }
    o.ops.textContent = ops.join(" · ");
  }
  const t = ticker(root, () => { const more = fillOne(); draw(); return more; }, 70);
  t.onChange = setPlay;
  action(root, "play", () => (t.playing ? t.stop() : (filled >= total() && reset(), reduced() ? (fillAll(), 0) : t.start())));
  action(root, "step", () => { t.stop(); fillOne(); draw(); });
  const fillAll = () => { t.stop(); while (fillOne()); draw(); };
  action(root, "all", fillAll);
  for (const inp of [ia, ib]) inp.addEventListener("input", reset);

  function draw() {
    const cols = b.length + 2;
    grid.style.gridTemplateColumns = `repeat(${cols}, 2rem)`;
    const cells = [];
    const head = (s) => `<span class="flex h-8 items-center justify-center text-muted-foreground">${s}</span>`;
    cells.push(head(""), head("ε"), ...[...b].map(head));
    for (let i = 0; i <= a.length; i++) {
      cells.push(head(i ? a[i - 1] : "ε"));
      for (let j = 0; j <= b.length; j++) {
        const idx = i * (b.length + 1) + j;
        const v = D[i][j];
        const cur = idx === filled - 1;
        const onPath = path?.has(`${i},${j}`);
        const cls = onPath ? "border-brand bg-brand/12 text-brand" : cur ? "border-foreground" : v === null ? "border-dashed text-transparent" : "bg-background";
        cells.push(`<span class="flex h-8 items-center justify-center rounded-md border tabular-nums ${cls}">${v ?? "·"}</span>`);
      }
    }
    grid.innerHTML = cells.join("");
    o.dist.textContent = filled >= total() ? String(D[a.length][b.length]) : "—";
    if (!path) o.ops.textContent = filled ? `${filled} / ${total()} cells` : "Press Fill or Step";
  }
  reset();
}
