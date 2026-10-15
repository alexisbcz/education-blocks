// Archaeology blocks: excavation grid, Harris matrix, seriation, a
// synthetic radiocarbon calibration, dendro cross-dating, survey sampling,
// Clark–Evans nearest neighbours, a dichotomous key, MNI, and field notes.
// Every site, find and curve is synthetic.

import { el, text, frame, polyline, num } from "./plot.js";
import { scrubAll } from "./scrub.js";

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
const svgPoint = (svg, e) => {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
};

// ============================================================ Excavation

// Contexts are deposits, not squares: the topsoil is one context wherever
// it is dug. The pit (cut 4, fill 3) cuts the occupation layer (2).
const LAYERS = {
  topsoil: { ctx: 1, name: "topsoil", color: "var(--vec-out)", finds: ["clay pipe stem", "modern glass", "iron nail", "sherd (glazed)"] },
  occupation: { ctx: 2, name: "occupation layer", color: "var(--ion-na)", finds: ["sherd (grit-tempered)", "animal bone", "charcoal", "flint flake", "spindle whorl"] },
  pit: { ctx: 3, name: "pit fill (in cut 4)", color: "var(--ion-k)", finds: ["sherd (shell-tempered)", "burnt bone", "charred grain", "loom weight"] },
  natural: { ctx: 5, name: "natural", color: "var(--foreground)", finds: [] },
};

for (const root of document.querySelectorAll("[data-archaeo-dig]")) {
  const grid = root.querySelector("[data-grid]");
  const log = root.querySelector("[data-log]");
  const o = outs(root);
  const cols = "ABCDEF", rows = 4;
  let squares, contexts, finds;

  function setup() {
    const rng = mulberry32(19);
    squares = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < 6; c++) {
      const pit = (c === 3 || c === 4) && (r === 1 || r === 2);
      const occ = !pit && !(c === 0 && r === 3); // the occupation layer thins out in A4
      const stack = ["topsoil", ...(pit ? ["pit"] : occ ? ["occupation"] : []), "natural"];
      const findsBy = {};
      for (const l of stack) {
        const k = l === "natural" ? 0 : Math.floor(rng() * (l === "topsoil" ? 2 : 3)) + (l === "pit" ? 1 : 0);
        findsBy[l] = Array.from({ length: k }, () => LAYERS[l].finds[Math.floor(rng() * LAYERS[l].finds.length)]);
      }
      squares.push({ id: `${cols[c]}${r + 1}`, stack, depth: 0, findsBy });
    }
    contexts = new Set();
    finds = [];
    log.replaceChildren();
    render();
  }

  function dig(i) {
    const s = squares[i];
    const layer = s.stack[s.depth];
    if (layer === "natural") return;
    const L = LAYERS[layer];
    contexts.add(L.ctx);
    if (layer === "pit") contexts.add(4); // emptying the fill exposes the cut
    for (const f of s.findsBy[layer]) {
      finds.push(f);
      const li = document.createElement("li");
      li.className = "flex gap-2";
      const sf = document.createElement("span");
      sf.className = "text-muted-foreground";
      sf.textContent = `SF ${String(finds.length).padStart(3, "0")}`;
      li.append(sf, `C${L.ctx} · ${s.id} · ${f}`);
      log.prepend(li);
    }
    s.depth++;
    if (s.stack[s.depth] === "natural") contexts.add(5);
    render();
  }

  function render() {
    grid.replaceChildren();
    squares.forEach((s, i) => {
      const layer = s.stack[s.depth];
      const L = LAYERS[layer];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "flex aspect-square flex-col items-start justify-between rounded-md border p-1.5 text-left font-mono text-[10px] outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default";
      b.style.background = `color-mix(in oklab, ${L.color} ${layer === "natural" ? 10 : 28}%, var(--background))`;
      b.style.borderColor = `color-mix(in oklab, ${L.color} 45%, transparent)`;
      b.disabled = layer === "natural";
      b.setAttribute("aria-label", `Square ${s.id}: ${L.name}, context ${L.ctx}${layer === "natural" ? ", fully excavated" : ". Dig the next layer"}`);
      const top = document.createElement("span");
      top.className = "font-medium text-foreground";
      top.textContent = s.id;
      const bot = document.createElement("span");
      bot.className = "text-muted-foreground";
      bot.textContent = `C${L.ctx}`;
      b.append(top, bot);
      b.addEventListener("click", () => dig(i));
      grid.append(b);
    });
    o.contexts.textContent = contexts.size ? [...contexts].sort((a, b) => a - b).map((c) => `C${c}`).join(" ") : "none yet";
    o.finds.textContent = String(finds.length);
    o.natural.textContent = `${squares.filter((s) => s.stack[s.depth] === "natural").length} / ${squares.length}`;
    if (!log.children.length) {
      const li = document.createElement("li");
      li.className = "text-muted-foreground";
      li.dataset.empty = "";
      li.textContent = "Click a square to dig its top layer.";
      log.append(li);
    } else if (finds.length) log.querySelector("[data-empty]")?.remove();
  }

  root.querySelector("[data-action=dig-all]").addEventListener("click", () => {
    for (let i = 0; i < squares.length; i++) while (squares[i].stack[squares[i].depth] !== "natural") dig(i);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", setup);
  setup();
}

// ============================================================ Harris matrix

const HARRIS_CYCLE = "1 above 2\n2 above 3\n3 above 4\n4 above 2\n3 above 5";

function parseRelations(src) {
  const edges = [], errors = [];
  for (const [i, raw] of src.split("\n").entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(\w+)\s+(above|over|cuts|fills|seals|below|under|cut by|filled by)\s+(\w+)$/i);
    if (!m) { errors.push(`line ${i + 1}: “${line}”`); continue; }
    const rel = m[2].toLowerCase();
    const later = /below|under|cut by|filled by/.test(rel) ? m[3] : m[1];
    const earlier = later === m[1] ? m[3] : m[1];
    if (later !== earlier) edges.push([later, earlier]);
  }
  return { edges, errors };
}

for (const root of document.querySelectorAll("[data-archaeo-harris]")) {
  const svg = root.querySelector("[data-plot]");
  const ta = root.querySelector("[data-rels]");
  const o = outs(root);
  const original = ta.value;

  function draw() {
    const { edges, errors } = parseRelations(ta.value);
    const nodes = [...new Set(edges.flat())].sort((a, b) => (+a - +b) || a.localeCompare(b));
    const out = new Map(nodes.map((n) => [n, new Set()]));
    for (const [a, b] of edges) out.get(a).add(b);
    // Kahn's algorithm: what can't be ordered is in (or behind) a cycle.
    const indeg = new Map(nodes.map((n) => [n, 0]));
    for (const [, b] of edges) indeg.set(b, indeg.get(b) + 1);
    const order = [], queue = nodes.filter((n) => indeg.get(n) === 0);
    const deg = new Map(indeg);
    while (queue.length) {
      const n = queue.shift();
      order.push(n);
      for (const m of out.get(n)) { deg.set(m, deg.get(m) - 1); if (!deg.get(m)) queue.push(m); }
    }
    svg.replaceChildren();
    o.n.textContent = String(nodes.length);
    if (order.length < nodes.length) {
      // Peel off contexts that are merely below the loop, leaving the cycle.
      const stuck = new Set(nodes.filter((n) => !order.includes(n)));
      for (let changed = true; changed; ) {
        changed = false;
        for (const n of stuck) if (![...out.get(n)].some((m) => stuck.has(m))) { stuck.delete(n); changed = true; }
        for (const n of stuck) if (!edges.some(([a, b]) => b === n && stuck.has(a))) { stuck.delete(n); changed = true; }
      }
      const loop = [...stuck];
      o.status.textContent = `contradiction among ${loop.join(", ")}`;
      o.status.className = "text-del";
      o.levels.textContent = "—";
      o.redundant.textContent = "—";
      text(svg, 280, 180, "These relationships form a cycle:", { "text-anchor": "middle", class: "fill-foreground text-[13px]" });
      text(svg, 280, 204, `${loop.join(", ")} would each have to be later than the others.`, { "text-anchor": "middle", class: "fill-muted-foreground text-[12px]" });
      return;
    }
    // Reachability for the transitive reduction.
    const reach = new Map();
    for (const n of [...order].reverse()) {
      const r = new Set();
      for (const m of out.get(n)) { r.add(m); for (const x of reach.get(m)) r.add(x); }
      reach.set(n, r);
    }
    const kept = [];
    let redundant = 0;
    for (const [a, b] of edges) {
      const via = [...out.get(a)].some((m) => m !== b && reach.get(m).has(b));
      via ? redundant++ : kept.push([a, b]);
    }
    // Levels: longest path from the latest contexts.
    const level = new Map(nodes.map((n) => [n, 0]));
    for (const n of order) for (const m of out.get(n)) level.set(m, Math.max(level.get(m), level.get(n) + 1));
    const depth = Math.max(0, ...level.values()) + 1;
    const rowsOf = Array.from({ length: depth }, () => []);
    for (const n of order) rowsOf[level.get(n)].push(n);
    const pos = new Map();
    const rowH = Math.min(70, 340 / Math.max(1, depth));
    rowsOf.forEach((row, li) => {
      // Order a row by the mean x of the contexts above it, to cut crossings.
      if (li) row.sort((a, b) => avgParent(a) - avgParent(b));
      row.forEach((n, i) => pos.set(n, [280 + (i - (row.length - 1) / 2) * 90, 30 + li * rowH]));
    });
    function avgParent(n) {
      const ps = kept.filter(([, b]) => b === n).map(([a]) => pos.get(a)?.[0]).filter((x) => x !== undefined);
      return ps.length ? ps.reduce((s, x) => s + x, 0) / ps.length : 280;
    }
    for (const [a, b] of kept) {
      const [x1, y1] = pos.get(a), [x2, y2] = pos.get(b);
      el("path", { d: `M${x1} ${y1 + 13} V${(y1 + y2) / 2} H${x2} V${y2 - 13}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.45;stroke-width:1.25" }, svg);
    }
    for (const n of nodes) {
      const [x, y] = pos.get(n);
      el("rect", { x: x - 24, y: y - 13, width: 48, height: 26, rx: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.25" }, svg);
      text(svg, x, y + 4, n, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    }
    text(svg, 6, 14, "latest", { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, 6, 30 + (depth - 1) * rowH + 4, "earliest", { class: "fill-muted-foreground font-mono text-[10px]" });
    o.levels.textContent = String(depth);
    o.redundant.textContent = String(redundant);
    o.status.textContent = errors.length ? `unread: ${errors.join("; ")}` : "consistent";
    o.status.className = errors.length ? "text-del" : "text-add";
  }

  ta.addEventListener("input", draw);
  root.addEventListener("seg-change", (e) => { ta.value = e.detail.value === "cycle" ? HARRIS_CYCLE : original; draw(); });
  draw();
}

// ============================================================ Seriation

const TYPES = ["Cord-marked", "Incised", "Red-slipped", "Glazed"];

function brainerdRobinson(a, b) {
  return 200 - a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
}

function permutations(n) {
  const out = [], a = [...Array(n).keys()];
  const go = (k) => {
    if (k === n) { out.push([...a]); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; go(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  go(0);
  return out;
}

for (const root of document.querySelectorAll("[data-archaeo-seriation]")) {
  const svg = root.querySelector("[data-plot]");
  const list = root.querySelector("[data-rows]");
  const o = outs(root);
  // Seven assemblages in true time order; each type's popularity is a
  // bell over time, then each assemblage is normalised to 100%.
  const peaks = [0.5, 2.5, 4.2, 6.3], widths = [1.4, 1.5, 1.3, 1.4];
  const rng = mulberry32(5);
  const names = ["Site K", "Site C", "Site R", "Site A", "Site M", "Site T", "Site F"];
  const data = Array.from({ length: 7 }, (_, t) => {
    const raw = peaks.map((p, k) => Math.exp(-((t - p) ** 2) / (2 * widths[k] ** 2)) * (0.9 + 0.2 * rng()));
    const sum = raw.reduce((s, x) => s + x, 0);
    return { name: names[t], pct: raw.map((x) => (100 * x) / sum) };
  });
  let order = [3, 0, 5, 1, 6, 2, 4];
  let counter = 1;

  const score = (ord) => ord.slice(1).reduce((s, r, i) => s + brainerdRobinson(data[ord[i]].pct, data[r].pct), 0);
  const best = Math.max(...permutations(7).map(score));

  function unimodal(ord) {
    let count = 0;
    for (let k = 0; k < 4; k++) {
      const seq = ord.map((r) => data[r].pct[k]);
      let falling = false, ok = true;
      for (let i = 1; i < seq.length; i++) {
        if (seq[i] < seq[i - 1] - 0.5) falling = true;
        else if (falling && seq[i] > seq[i - 1] + 0.5) ok = false;
      }
      if (ok) count++;
    }
    return count;
  }

  function render() {
    svg.replaceChildren();
    const L = 80, colW = 118, rowH = 40, T = 34;
    TYPES.forEach((t, k) => text(svg, L + k * colW + colW / 2, 18, t, { "text-anchor": "middle", class: "fill-foreground text-[11px]" }));
    const colors = ["var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)"];
    order.forEach((r, i) => {
      const y = T + i * rowH;
      text(svg, L - 8, y + rowH / 2 + 4, data[r].name, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[11px]" });
      data[r].pct.forEach((p, k) => {
        const w = (p / 100) * (colW - 10);
        const cx = L + k * colW + colW / 2;
        el("rect", { x: cx - w / 2, y: y + 4, width: Math.max(0.5, w), height: rowH - 8, rx: 2, style: `fill:${colors[k]};fill-opacity:0.7` }, svg);
      });
    });
    for (let k = 0; k <= 4; k++) el("line", { x1: L + k * colW, x2: L + k * colW, y1: T, y2: T + 7 * rowH, style: "stroke:currentColor;stroke-opacity:0.1" }, svg);

    list.replaceChildren();
    order.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "flex items-center gap-2 text-sm";
      li.tabIndex = 0;
      li.setAttribute("aria-label", `${data[r].name}, position ${i + 1}. Alt and arrow keys move it.`);
      li.className += " rounded-md px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
      const name = document.createElement("span");
      name.className = "flex-1 font-mono text-xs";
      name.textContent = `${i + 1}. ${data[r].name}`;
      const mk = (label, d) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40";
        b.textContent = label;
        b.setAttribute("aria-label", `Move ${data[r].name} ${d < 0 ? "up" : "down"}`);
        b.disabled = (d < 0 && i === 0) || (d > 0 && i === order.length - 1);
        b.addEventListener("click", () => move(i, d));
        return b;
      };
      li.append(name, mk("↑", -1), mk("↓", 1));
      li.addEventListener("keydown", (e) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        move(i, e.key === "ArrowUp" ? -1 : 1);
        list.children[Math.max(0, Math.min(6, i + (e.key === "ArrowUp" ? -1 : 1)))]?.focus();
      });
      list.append(li);
    });
    const s = score(order);
    o.score.textContent = num(s, 1);
    o.best.textContent = num(best, 1) + (Math.abs(s - best) < 1e-9 ? "  ✓ reached" : "");
    o.unimodal.textContent = `${unimodal(order)} / 4`;
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    render();
  }

  root.querySelector("[data-action=auto]").addEventListener("click", () => {
    let top = -Infinity, pick = order;
    for (const p of permutations(7)) { const s = score(p); if (s > top + 1e-9) { top = s; pick = p; } }
    order = pick;
    render();
  });
  root.querySelector("[data-action=shuffle]").addEventListener("click", () => {
    const r = mulberry32(100 + counter++);
    order = [...order].sort(() => r() - 0.5);
    render();
  });
  render();
}

// ============================================================ Radiocarbon

// A synthetic curve, not IntCal: a slope a little under 1 plus wiggles,
// with a flat stretch so some dates fall on a plateau.
const c14Curve = (t) => 0.92 * t + 160 + 38 * Math.sin((2 * Math.PI * t) / 210) + 18 * Math.sin((2 * Math.PI * t) / 77);
const C14_SIGMA_CURVE = 15;

for (const root of document.querySelectorAll("[data-archaeo-c14]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const mu = s.age.get(), sig = s.sigma.get();
    const t0 = 2000, t1 = 3000;
    const years = [], dens = [];
    const v = sig * sig + C14_SIGMA_CURVE * C14_SIGMA_CURVE;
    for (let t = t0; t <= t1; t++) { years.push(t); dens.push(Math.exp(-((c14Curve(t) - mu) ** 2) / (2 * v))); }
    const total = dens.reduce((a, b) => a + b, 0);
    const p = dens.map((d) => d / total);
    // Highest-density region holding 95%.
    const idx = p.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]);
    const inHdr = new Array(p.length).fill(false);
    let acc = 0;
    for (const [x, i] of idx) { if (acc >= 0.95) break; inHdr[i] = true; acc += x; }
    const ranges = [];
    for (let i = 0; i < p.length; i++) {
      if (!inHdr[i]) continue;
      let j = i;
      while (j + 1 < p.length && inHdr[j + 1]) j++;
      const mass = p.slice(i, j + 1).reduce((a, b) => a + b, 0);
      ranges.push([years[j], years[i], mass]); // [oldest, youngest, probability]
      i = j;
    }
    ranges.sort((a, b) => b[0] - a[0]);

    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 490, 250], x: [t1, t0], y: [1900, 3050], xticks: [3000, 2800, 2600, 2400, 2200, 2000], yticks: [2000, 2250, 2500, 2750, 3000], xlabel: "calendar age (cal BP, older left)", ylabel: "¹⁴C age BP" });
    // Curve band.
    const band = [...years.map((t) => [f.sx(t), f.sy(c14Curve(t) + C14_SIGMA_CURVE)]), ...[...years].reverse().map((t) => [f.sx(t), f.sy(c14Curve(t) - C14_SIGMA_CURVE)])];
    el("path", { d: "M" + band.map((q) => q.join(",")).join(" L") + " Z", style: "fill:var(--vec-u);fill-opacity:0.18" }, svg);
    polyline(svg, years.map((t) => [f.sx(t), f.sy(c14Curve(t))]), "stroke:var(--vec-u);stroke-width:1.5");
    // Measured date as a bell on the y axis.
    const bell = [];
    for (let y = mu - 4 * sig; y <= mu + 4 * sig; y += sig / 10) bell.push([f.L - 2 - 40 * Math.exp(-((y - mu) ** 2) / (2 * sig * sig)), f.sy(y)]);
    polyline(svg, bell, "stroke:var(--brand);stroke-width:1.5;fill:var(--brand);fill-opacity:0.15");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(mu), y2: f.sy(mu), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 4" }, svg);
    // Calendar density along the bottom, HDR shaded.
    const base = f.T + f.H, pmax = Math.max(...p);
    const area = years.map((t, i) => [f.sx(t), base - (p[i] / pmax) * 70]);
    el("path", { d: `M${f.sx(t0)},${base} L` + area.map((q) => q.join(",")).join(" L") + ` L${f.sx(t1)},${base} Z`, style: "fill:var(--foreground);fill-opacity:0.08" }, svg);
    for (const [hi, lo] of ranges) {
      const seg = years.map((t, i) => [t, i]).filter(([t]) => t >= lo && t <= hi).map(([t, i]) => [f.sx(t), base - (p[i] / pmax) * 70]);
      el("path", { d: `M${f.sx(lo)},${base} L` + seg.map((q) => q.join(",")).join(" L") + ` L${f.sx(hi)},${base} Z`, style: "fill:var(--brand);fill-opacity:0.45" }, svg);
    }
    text(svg, f.L + f.W, f.T + 12, "synthetic curve, not IntCal", { "text-anchor": "end" });

    o.ranges.textContent = ranges.length ? ranges.map(([old, young, m]) => `${old}–${young} (${Math.round(m * 100)}%)`).join(", ") + " cal BP" : "—";
    const years95 = ranges.reduce((a, [old, young]) => a + old - young + 1, 0);
    o.span.textContent = ranges.length ? `${years95} years in ${ranges.length} range${ranges.length > 1 ? "s" : ""}` : "—";
    o.mode.textContent = `${years[p.indexOf(pmax)]} cal BP`;
  }
  draw();
}

// ============================================================ Dendrochronology

for (const root of document.querySelectorAll("[data-archaeo-dendro]")) {
  const svg = root.querySelector("[data-plot]");
  const corr = root.querySelector("[data-corr]");
  const o = outs(root);
  const Y0 = 1650, Y1 = 1800, N = 50;
  const master = [];
  {
    const rng = mulberry32(41);
    let x = 0;
    for (let y = Y0; y <= Y1; y++) {
      x = 0.45 * x + gauss(rng) * 0.32;
      const marker = rng() < 0.06 ? -0.9 : 0; // drought years: very narrow rings
      master.push(Math.max(0.15, 1 + x + marker));
    }
  }
  let seed = 3, planted, sample;
  const s = scrubAll(root, draw);

  function newSample() {
    const rng = mulberry32(seed++);
    planted = Y0 + 10 + Math.floor(rng() * (Y1 - Y0 - N - 15));
    // The timber's own growth: same climate signal, its own scale and noise.
    const scale = 0.7 + 0.6 * rng();
    sample = Array.from({ length: N }, (_, i) => Math.max(0.1, master[planted - Y0 + i] * scale + gauss(rng) * 0.18));
  }

  const pearson = (a, b) => {
    const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
    let sab = 0, sa = 0, sb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
    return sab / Math.sqrt(sa * sb);
  };
  const rAt = (start) => pearson(sample, master.slice(start - Y0, start - Y0 + N));
  const tOf = (r) => (r * Math.sqrt(N - 2)) / Math.sqrt(1 - r * r);

  function draw() {
    const start = Math.round(s.offset.get());
    const r = rAt(start);
    const all = [];
    for (let st = Y0; st <= Y1 - N + 1; st++) all.push([st, rAt(st)]);
    const best = all.reduce((b, x) => (x[1] > b[1] ? x : b));

    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 506, 170], x: [Y0, Y1], y: [0, 2.6], xticks: [1650, 1675, 1700, 1725, 1750, 1775, 1800], yticks: [0, 1, 2], xlabel: "year", ylabel: "ring width" });
    polyline(svg, master.map((w, i) => [f.sx(Y0 + i), f.sy(w)]), "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.2");
    const ms = master.slice(start - Y0, start - Y0 + N);
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const sd = (a) => Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
    const k = sd(ms) / sd(sample), c = mean(ms) - k * mean(sample);
    el("rect", { x: f.sx(start), y: f.T, width: f.sx(start + N - 1) - f.sx(start), height: f.H, style: "fill:var(--brand);fill-opacity:0.06" }, svg);
    polyline(svg, sample.map((w, i) => [f.sx(start + i), f.sy(c + k * w)]), "stroke:var(--brand);stroke-width:1.75");
    text(svg, f.sx(start) + 4, f.T + 12, "sample (rescaled)", { style: "fill:var(--brand)" });

    corr.replaceChildren();
    const g = frame(corr, { box: [40, 20, 506, 80], x: [Y0, Y1 - N + 1], y: [-0.6, 1], xticks: [1650, 1675, 1700, 1725, 1750], yticks: [0, 0.5, 1], ylabel: "r" });
    polyline(corr, all.map(([st, v]) => [g.sx(st), g.sy(v)]), "stroke:var(--foreground);stroke-width:1.2");
    el("circle", { cx: g.sx(best[0]), cy: g.sy(best[1]), r: 3.5, style: "fill:var(--ion-cl)" }, corr);
    el("line", { x1: g.sx(start), x2: g.sx(start), y1: g.T, y2: g.T + g.H, style: "stroke:var(--brand);stroke-width:1.5" }, corr);

    o.r.textContent = num(r, 3);
    o.t.textContent = num(tOf(r), 1) + (tOf(r) >= 3.5 ? "  (convincing)" : "");
    o.felled.textContent = `${start + N - 1} (if the bark edge survives)`;
    o.bestat.textContent = `${best[0]}, r = ${num(best[1], 3)}`;
    root.dataset.planted = String(planted);
  }

  root.querySelector("[data-action=best]").addEventListener("click", () => {
    let b = Y0, br = -2;
    for (let st = Y0; st <= Y1 - N + 1; st++) { const r = rAt(st); if (r > br) { br = r; b = st; } }
    s.offset.set(b, false);
    draw();
  });
  root.querySelector("[data-action=new]").addEventListener("click", () => { newSample(); draw(); });
  newSample();
  draw();
}

// ============================================================ Survey

for (const root of document.querySelectorAll("[data-archaeo-survey]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const W = 400, KM = 4; // 400 px = 4 km, 1 px = 10 m
  let design = "random", seed = 1, reveal = false;
  const s = scrubAll(root, draw);
  const river = (x) => 120 + 0.45 * x + 30 * Math.sin(x / 45);
  const sites = [];
  {
    const rng = mulberry32(77);
    while (sites.length < 120) {
      if (rng() < 0.7) {
        const x = rng() * W, y = river(x) + gauss(rng) * 28;
        if (y > 0 && y < W) sites.push([x, y, rng()]);
      } else sites.push([rng() * W, rng() * W, rng()]);
    }
  }

  function units(n, rng) {
    if (design === "systematic") {
      const gap = W / n;
      return Array.from({ length: n }, (_, i) => [gap * (i + 0.5) - 5, 0, 10, W]);
    }
    if (design === "stratified") {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const cw = W / cols, ch = W / rows, q = Math.min(40, cw, ch), out = [];
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        out.push([c * cw + rng() * (cw - q), r * ch + rng() * (ch - q), q, q]);
      }
      return out;
    }
    return Array.from({ length: n }, () => [rng() * (W - 40), rng() * (W - 40), 40, 40]);
  }

  function draw() {
    const n = Math.round(s.units.get()), pDetect = s.detect.get() / 100;
    const rng = mulberry32(seed * 31 + n);
    const us = units(n, rng);
    // Coverage on a 4 px raster, so overlapping quadrats aren't counted twice.
    let covered = 0;
    for (let y = 0; y < W; y += 4) for (let x = 0; x < W; x += 4)
      if (us.some(([ux, uy, uw, uh]) => x + 2 >= ux && x + 2 < ux + uw && y + 2 >= uy && y + 2 < uy + uh)) covered++;
    const coveredKm2 = (covered * 16) / (W * W) * KM * KM;
    const inside = sites.filter(([x, y]) => us.some(([ux, uy, uw, uh]) => x >= ux && x < ux + uw && y >= uy && y < uy + uh));
    const found = inside.filter(([, , d]) => d < pDetect);

    svg.replaceChildren();
    el("rect", { x: 0, y: 0, width: W, height: W, style: "fill:var(--ion-cl);fill-opacity:0.06" }, svg);
    polyline(svg, Array.from({ length: 81 }, (_, i) => [i * 5, river(i * 5)]), "stroke:var(--vec-u);stroke-width:6;stroke-opacity:0.35;stroke-linecap:round");
    for (const [x, y, w, h] of us) el("rect", { x, y, width: w, height: h, style: "fill:var(--brand);fill-opacity:0.14;stroke:var(--brand);stroke-opacity:0.6" }, svg);
    if (reveal) for (const [x, y] of sites) el("circle", { cx: x, cy: y, r: 3, style: "fill:none;stroke:currentColor;stroke-opacity:0.45" }, svg);
    for (const [x, y] of found) el("circle", { cx: x, cy: y, r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    text(svg, 6, W - 6, "1 km = 100 px", { class: "fill-muted-foreground font-mono text-[10px]" });

    const est = coveredKm2 > 0 ? found.length / (coveredKm2 * pDetect) : NaN;
    o.cover.textContent = `${num(coveredKm2, 2)} km² (${Math.round((100 * covered * 16) / (W * W))}%)`;
    o.found.textContent = `${found.length} of ${inside.length} in units`;
    o.est.textContent = Number.isFinite(est) ? `${num(est, 2)} sites/km²` : "—";
    o.true.textContent = reveal ? `${num(sites.length / (KM * KM), 2)} sites/km²` : "hidden";
  }

  root.addEventListener("seg-change", (e) => { design = e.detail.value; draw(); });
  root.querySelector("[data-action=resample]").addEventListener("click", () => { seed++; draw(); });
  root.querySelector("[data-action=reveal]").addEventListener("click", (e) => {
    reveal = !reveal;
    e.currentTarget.lastChild.textContent = reveal ? "Hide truth" : "Reveal all";
    draw();
  });
  draw();
}

// ============================================================ Nearest neighbour

export function clarkEvans(pts, area) {
  const n = pts.length;
  if (n < 2) return null;
  let sum = 0;
  const nn = pts.map(([x, y], i) => {
    let best = Infinity, j0 = -1;
    pts.forEach(([u, v], j) => { if (j !== i) { const d = Math.hypot(x - u, y - v); if (d < best) { best = d; j0 = j; } } });
    sum += best;
    return j0;
  });
  const robs = sum / n, rexp = 0.5 / Math.sqrt(n / area);
  const se = 0.26136 / Math.sqrt((n * n) / area);
  return { R: robs / rexp, z: (robs - rexp) / se, nn, robs, rexp };
}

for (const root of document.querySelectorAll("[data-archaeo-nn]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const W = 400, H = 300;
  let pts = [];

  function preset(kind) {
    const rng = mulberry32(kind === "random" ? 11 : kind === "clustered" ? 12 : 13);
    pts = [];
    if (kind === "random") for (let i = 0; i < 40; i++) pts.push([rng() * W, rng() * H]);
    else if (kind === "clustered") {
      const centres = Array.from({ length: 5 }, () => [40 + rng() * (W - 80), 40 + rng() * (H - 80)]);
      for (let i = 0; i < 40; i++) {
        const [cx, cy] = centres[i % 5];
        pts.push([Math.min(W, Math.max(0, cx + gauss(rng) * 14)), Math.min(H, Math.max(0, cy + gauss(rng) * 14))]);
      }
    } else for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) pts.push([25 + c * 50 + (rng() - 0.5) * 10, 30 + r * 60 + (rng() - 0.5) * 10]);
    draw();
  }

  function draw() {
    svg.replaceChildren();
    const ce = clarkEvans(pts, W * H);
    if (ce) pts.forEach(([x, y], i) => {
      const [u, v] = pts[ce.nn[i]];
      el("line", { x1: x, y1: y, x2: u, y2: v, style: "stroke:var(--brand);stroke-opacity:0.45;stroke-width:1.2" }, svg);
    });
    for (const [x, y] of pts) el("circle", { cx: x, cy: y, r: 3.5, style: "fill:var(--foreground)" }, svg);
    o.n.textContent = String(pts.length);
    if (!ce) { o.R.textContent = o.z.textContent = "—"; o.verdict.textContent = "add sites"; return; }
    o.R.textContent = num(ce.R, 2);
    o.z.textContent = num(ce.z, 2);
    o.verdict.textContent = ce.z < -1.96 ? "clustered" : ce.z > 1.96 ? "dispersed" : "random (not significant)";
  }

  svg.addEventListener("click", (e) => {
    const p = svgPoint(svg, e);
    if (e.shiftKey) {
      let best = -1, bd = 14;
      pts.forEach(([x, y], i) => { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) pts.splice(best, 1);
    } else pts.push([p.x, p.y]);
    draw();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { pts = []; draw(); });
  root.addEventListener("seg-change", (e) => preset(e.detail.value));
  preset("random");
}

// ============================================================ Dichotomous key

const KEY = {
  q1: { ask: "Is the rim everted (turned outwards)?", attr: "rim", yes: "everted", y: "q2", n: "q3" },
  q2: { ask: "Is the clay tempered with crushed shell?", attr: "temper", yes: "shell", y: "q4", n: "Type B · grit-tempered everted jar" },
  q4: { ask: "Is it decorated with incised lines?", attr: "decor", yes: "incised", y: "Type A1 · incised shell-tempered jar", n: "Type A2 · plain shell-tempered jar" },
  q3: { ask: "Is the rim inverted (turned inwards)?", attr: "rim", yes: "inverted", y: "Type C · inverted-rim bowl", n: "q5" },
  q5: { ask: "Is the surface cord-marked?", attr: "decor", yes: "cord", y: "Type D1 · cord-marked straight-rim pot", n: "Type D2 · plain straight-rim pot" },
};

for (const root of document.querySelectorAll("[data-archaeo-key]")) {
  const sherds = [...root.querySelectorAll("[data-sherd]")];
  const card = root.querySelector("[data-card]");
  const qbox = root.querySelector("[data-question]");
  const path = root.querySelector("[data-path]");
  let current = null, node = "q1";

  function pick(b) {
    current = b;
    node = "q1";
    for (const s of sherds) s === b ? (s.dataset.on = "") : delete s.dataset.on;
    card.textContent = `${b.textContent} — rim: ${b.dataset.rim} · temper: ${b.dataset.temper} · decoration: ${b.dataset.decor}`;
    path.replaceChildren();
    ask();
  }

  function ask() {
    qbox.replaceChildren();
    if (!current) { qbox.textContent = "Pick a sherd to start."; return; }
    if (!KEY[node]) {
      const p = document.createElement("p");
      p.className = "text-sm";
      const strong = document.createElement("span");
      strong.className = "font-medium text-brand";
      strong.textContent = node;
      p.append("Classified as ", strong, ".");
      const again = document.createElement("button");
      again.type = "button";
      again.className = "self-start rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground";
      again.textContent = "Start again";
      again.addEventListener("click", () => pick(current));
      qbox.append(p, again);
      return;
    }
    const q = KEY[node];
    const p = document.createElement("p");
    p.className = "text-sm font-medium";
    p.textContent = q.ask;
    const row = document.createElement("div");
    row.className = "flex gap-2";
    for (const [label, ans] of [["Yes", true], ["No", false]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rounded-md border px-3 py-1 text-sm outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";
      b.textContent = label;
      b.addEventListener("click", () => answer(ans));
      row.append(b);
    }
    qbox.append(p, row);
  }

  function answer(ans) {
    const q = KEY[node];
    const truth = current.dataset[q.attr] === q.yes;
    const li = document.createElement("li");
    li.textContent = `${q.ask} → ${ans ? "yes" : "no"}`;
    if (ans !== truth) {
      li.className = "text-del";
      li.textContent += `  (the record says ${q.attr}: ${current.dataset[q.attr]})`;
    }
    path.append(li);
    node = ans ? q.y : q.n;
    ask();
  }

  sherds.forEach((b) => b.addEventListener("click", () => pick(b)));
  pick(sherds[0]);
}

// ============================================================ MNI

export function mni(rows) {
  let best = 0, from = "", nisp = 0;
  for (const r of rows) {
    nisp += (r.l || 0) + (r.r || 0) + (r.u || 0);
    const m = r.paired ? Math.max(r.l, r.r) : r.u;
    r.mni = m;
    if (m > best) { best = m; from = r.name; }
  }
  return { mni: best, from, nisp };
}

for (const root of document.querySelectorAll("[data-archaeo-mni]")) {
  const o = outs(root);
  const rows = [...root.querySelectorAll("tr[data-row]")];
  const val = (name) => Math.max(0, Math.floor(+root.querySelector(`[data-count="${name}"]`)?.value || 0));

  function update() {
    const data = rows.map((tr) => {
      const i = tr.dataset.row;
      return { name: tr.cells[0].textContent, paired: tr.dataset.paired === "true", l: val(`l${i}`), r: val(`r${i}`), u: val(`u${i}`) };
    });
    const res = mni(data);
    data.forEach((d, i) => {
      const cell = rows[i].querySelector("[data-mni]");
      cell.textContent = String(d.mni);
      cell.className = "py-1.5 text-right font-mono tabular-nums " + (d.name === res.from ? "font-medium text-brand" : "");
    });
    o.nisp.textContent = String(res.nisp);
    o.mni.textContent = String(res.mni);
    o.from.textContent = res.from || "—";
  }
  root.addEventListener("input", update);
  update();
}

// ============================================================ Field notes

for (const root of document.querySelectorAll("[data-archaeo-notes]")) {
  const o = outs(root);
  const s = scrubAll(root, update);
  function update() {
    const foot = (s.dist.get() * s.sensor.get()) / s.focal.get();
    const step = foot * (1 - s.overlap.get() / 100);
    o.foot.textContent = `${num(foot, 2)} m`;
    o.step.textContent = `${num(step, 2)} m`;
    o.shots.textContent = step > 0 ? String(Math.ceil(10 / step) + 1) : "—";
  }
  update();
}

