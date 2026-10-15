// Parallel computing blocks: strong and weak scaling, work and span with a
// greedy schedule, prefix scans, summation order, load balancing, warp
// divergence, memory coalescing, the roofline, false sharing and a
// Mandelbrot render timed with real Web Workers.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { reducedMotion } from "./svg.js";
import * as M from "./parallel-model.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const plot = (root, name) => root.querySelector(`[data-plot="${name}"]`);
/** Calls fn(label, value) when a segmented control in root changes. */
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
// The switch fires before it updates aria-checked: read the event's state.
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const pct = (v, d = 0) => `${num(100 * v, d)}%`;
const COLORS = ["var(--vec-i)", "var(--vec-j)", "var(--vec-u)", "var(--vec-v)", "var(--vec-out)", "var(--brand)", "var(--code-add)", "var(--code-del)"];
const workerColor = (w) => COLORS[w % COLORS.length];

/** A small HTML table, all text set with textContent. */
function table(host, head, rows, highlight = -1) {
  const t = document.createElement("table");
  t.className = "w-full font-mono text-xs tabular-nums";
  const tr = (cells, th, i) => {
    const r = document.createElement("tr");
    if (i === highlight) r.className = "text-brand";
    cells.forEach((c, k) => {
      const d = document.createElement(th ? "th" : "td");
      d.className = (th ? "pb-1 font-normal text-muted-foreground " : "py-0.5 ") + (k ? "pl-3 text-right" : "text-left");
      d.textContent = c;
      r.append(d);
    });
    return r;
  };
  t.append(tr(head, true, -2), ...rows.map((r, i) => tr(r, false, i)));
  host.replaceChildren(t);
}

// ============================================================ Strong and weak scaling

for (const root of document.querySelectorAll("[data-par-scaling]")) {
  const svg = plot(root, "speedup");
  const o = outs(root);
  let view = "speedup";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { view = v; draw(); });

  function draw() {
    const ser = s.s.get() / 100, n = s.n.get();
    svg.replaceChildren();
    const curve = (f, color, width = 2) => {
      const pts = [];
      for (let k = 0; k <= 100; k++) {
        const x = k / 10, c = 2 ** x, y = view === "speedup" ? Math.log10(f(c)) : f(c) / c;
        pts.push([F.sx(x), F.sy(y)]);
      }
      polyline(svg, pts, `stroke:${color};stroke-width:${width}`);
    };
    const F = view === "speedup"
      ? frame(svg, { box: [46, 14, 490, 246], x: [0, 10], y: [0, 3], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 1, 2, 3], xfmt: (k) => String(2 ** k), yfmt: (k) => String(10 ** k), xlabel: "cores n", ylabel: "speedup" })
      : frame(svg, { box: [46, 14, 490, 246], x: [0, 10], y: [0, 1], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (k) => String(2 ** k), yfmt: (v) => pct(v), xlabel: "cores n", ylabel: "efficiency" });
    curve((c) => c, "currentColor;stroke-opacity:0.25;stroke-dasharray:4 4", 1);
    curve((c) => M.amdahl(ser, c), "var(--vec-i)");
    curve((c) => M.gustafson(ser, c), "var(--vec-j)");
    const x = Math.log2(n);
    const A = M.amdahl(ser, n), G = M.gustafson(ser, n);
    for (const [v, color] of [[A, "var(--vec-i)"], [G, "var(--vec-j)"]]) {
      const y = view === "speedup" ? Math.log10(v) : v / n;
      el("circle", { cx: F.sx(x), cy: F.sy(y), r: 4.5, style: `fill:${color};stroke:var(--background);stroke-width:2` }, svg);
    }
    if (view === "speedup" && ser > 0 && 1 / ser < 1000) {
      const y = F.sy(Math.log10(1 / ser));
      el("line", { x1: F.L, x2: F.L + F.W, y1: y, y2: y, style: "stroke:var(--vec-i);stroke-opacity:0.5;stroke-dasharray:4 4" }, svg);
      text(svg, F.L + 4, y - 4, `Amdahl limit 1/s = ${num(1 / ser, 1)}×`);
    }
    o.amdahl.textContent = `${num(A, 2)}×`;
    o.gustafson.textContent = `${num(G, 2)}×`;
    o.eff.textContent = `${pct(A / n, 1)} / ${pct(G / n, 1)}`;
    o.limit.textContent = ser > 0 ? `${num(1 / ser, 1)}×` : "none";
    o.note.textContent = `With ${num(ser * 100, 1)}% serial work, ${n} cores run the same problem ${num(A, 1)}× faster (strong scaling), ` +
      `but a problem ${n}× larger in its parallel part finishes in the same time as the original on one core: a scaled speedup of ${num(G, 1)}× (weak scaling).`;
  }
  draw();
}

// ============================================================ Work, span and Brent

for (const root of document.querySelectorAll("[data-par-workspan]")) {
  const dagSvg = plot(root, "dag"), gantt = plot(root, "gantt");
  const o = outs(root);
  let kind = "reduce", seed = 1;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { kind = v; draw(); });
  root.querySelector("[data-action=reroll]").addEventListener("click", () => { kind = "random"; seed++; selectSeg(root, "Task graph", "random"); draw(); });

  function draw() {
    const nodes = M.dagPreset(kind, seed);
    const { work, span, critical, depth } = M.workSpan(nodes);
    const p = s.p.get();
    const { slots, makespan } = M.greedySchedule(nodes, p);

    // The DAG, laid out by depth.
    dagSvg.replaceChildren();
    const levels = [];
    nodes.forEach((_, i) => (levels[depth[i]] ??= []).push(i));
    const pos = [];
    const L = levels.length;
    levels.forEach((ids, d) => ids.forEach((i, k) => {
      pos[i] = [40 + (480 * (d + 0.5)) / L, 115 + (k - (ids.length - 1) / 2) * Math.min(34, 200 / ids.length)];
    }));
    nodes.forEach((v, i) => v.parents.forEach((q) => {
      const crit = critical.has(i) && critical.has(q);
      el("line", { x1: pos[q][0], y1: pos[q][1], x2: pos[i][0], y2: pos[i][1], style: crit ? "stroke:var(--brand);stroke-width:2" : "stroke:currentColor;stroke-opacity:0.25" }, dagSvg);
    }));
    nodes.forEach((v, i) => {
      const crit = critical.has(i);
      el("circle", { cx: pos[i][0], cy: pos[i][1], r: 11, style: `fill:var(--background);stroke:${crit ? "var(--brand)" : "currentColor"};stroke-opacity:${crit ? 1 : 0.4};stroke-width:${crit ? 2 : 1}` }, dagSvg);
      text(dagSvg, pos[i][0], pos[i][1] + 3.5, String(v.cost), { "text-anchor": "middle", class: crit ? "fill-brand font-mono text-[10px]" : "fill-foreground font-mono text-[10px]" });
    });
    text(dagSvg, 8, 14, "numbers are task costs; time flows left to right");

    // The greedy schedule.
    gantt.replaceChildren();
    const brent = work / p + span, lower = Math.max(work / p, span);
    const tmax = Math.max(brent, makespan) * 1.04;
    const x0 = 38, W = 506, sx = (t) => x0 + (W * t) / tmax;
    const rowH = Math.min(22, 130 / p), top = 10;
    for (let q = 0; q < p; q++) {
      text(gantt, x0 - 6, top + q * rowH + rowH / 2 + 3, `P${q + 1}`, { "text-anchor": "end" });
      el("rect", { x: x0, y: top + q * rowH + 1, width: W, height: rowH - 2, rx: 2, style: "fill:currentColor;fill-opacity:0.04" }, gantt);
    }
    for (const sl of slots) {
      const crit = critical.has(sl.node);
      el("rect", { x: sx(sl.start) + 0.5, y: top + sl.proc * rowH + 2, width: Math.max(1, sx(sl.end) - sx(sl.start) - 1), height: rowH - 4, rx: 2,
        style: crit ? "fill:var(--brand);fill-opacity:0.85" : "fill:var(--vec-i);fill-opacity:0.45" }, gantt);
    }
    const yb = top + p * rowH + 4;
    for (const [t, label, style] of [[lower, "lower bound", "stroke:currentColor;stroke-opacity:0.5;stroke-dasharray:3 3"], [brent, "Brent", "stroke:var(--brand);stroke-opacity:0.7;stroke-dasharray:3 3"]]) {
      el("line", { x1: sx(t), x2: sx(t), y1: top, y2: yb, style }, gantt);
      text(gantt, sx(t), yb + 12, label, { "text-anchor": t === brent ? "start" : "end" });
    }
    text(gantt, sx(makespan), top - 1, `Tₚ = ${num(makespan, 0)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    gantt.setAttribute("viewBox", `0 0 560 ${yb + 20}`);

    o.t1.textContent = String(work);
    o.tinf.textContent = String(span);
    o.par.textContent = `${num(work / span, 2)}`;
    o.tp.textContent = `${makespan}`;
    o.lower.textContent = num(lower, 2);
    o.brent.textContent = num(brent, 2);
    const extra = p > work / span
      ? `p = ${p} is more than the parallelism T₁/T∞ = ${num(work / span, 1)}, so extra processors mostly wait on the critical path.`
      : `With p below the parallelism T₁/T∞ = ${num(work / span, 1)}, more processors still help.`;
    o.note.textContent = `Greedy finished at ${makespan}: between max(T₁/p, T∞) = ${num(lower, 1)} and T₁/p + T∞ = ${num(brent, 1)}, as Brent's bound promises. ${extra}`;
  }
  draw();
}

/** Selects a segmented control's option from code. */
function selectSeg(root, label, value) {
  const list = root.querySelector(`[role=tablist][aria-label="${label}"]`);
  list?.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));
}

// ============================================================ Prefix scan

for (const root of document.querySelectorAll("[data-par-scan]")) {
  const svg = plot(root, "scan");
  const o = outs(root);
  let algo = "hillis", n = 8, step = 0, seed = 0;
  let input = [3, 1, 7, 0, 4, 1, 6, 3];
  const makeInput = () => {
    if (seed === 0 && n === 8) return [3, 1, 7, 0, 4, 1, 6, 3];
    const r = M.rng(seed * 31 + n);
    return Array.from({ length: n }, () => Math.floor(r() * 10));
  };
  onSeg(root, (label, v) => {
    if (label === "Algorithm") algo = v;
    else { n = Number(v); input = makeInput(); }
    step = 0;
    draw();
  });
  root.querySelector("[data-action=next]").addEventListener("click", () => { step++; draw(); });
  root.querySelector("[data-action=prev]").addEventListener("click", () => { step = Math.max(0, step - 1); draw(); });
  root.querySelector("[data-action=random]").addEventListener("click", () => { seed++; input = makeInput(); step = 0; draw(); });

  function draw() {
    const rows = algo === "hillis" ? M.hillisSteele(input) : M.blelloch(input);
    step = Math.min(step, rows.length - 1);
    const shown = rows.slice(0, step + 1);
    const cw = 544 / n, x0 = 88, rh = 30;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 640 ${12 + rows.length * rh}`);
    let adds = 0;
    shown.forEach((row, r) => {
      const y = 8 + r * rh;
      const last = r === shown.length - 1;
      adds += row.ops.length;
      text(svg, x0 - 10, y + 15, row.label, { "text-anchor": "end", class: last ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
      const changed = new Set(row.ops.map((op) => op[1]));
      if (row.swap) row.ops.forEach((op) => changed.add(op[0]));
      if (row.cleared !== undefined) changed.add(row.cleared);
      row.values.forEach((v, i) => {
        const hot = changed.has(i);
        el("rect", { x: x0 + i * cw + 1, y, width: cw - 2, height: rh - 8, rx: 4,
          style: hot ? "fill:var(--brand);fill-opacity:0.12;stroke:var(--brand);stroke-opacity:0.7" : "fill:var(--background);stroke:currentColor;stroke-opacity:0.18" }, svg);
        text(svg, x0 + i * cw + cw / 2, y + 15, String(v), { "text-anchor": "middle", class: hot ? "fill-brand font-mono text-[11px]" : "fill-foreground font-mono text-[11px]" });
      });
      // Arrows from the previous row: what each addition read.
      if (r > 0) for (const [from, to] of row.ops) {
        const xa = x0 + from * cw + cw / 2, xb = x0 + to * cw + cw / 2;
        el("line", { x1: xa, y1: y - 8, x2: xb, y2: y, style: "stroke:var(--brand);stroke-opacity:0.55;stroke-width:1" }, svg);
        if (row.swap) el("line", { x1: xb, y1: y - 8, x2: xa, y2: y, style: "stroke:currentColor;stroke-opacity:0.3;stroke-width:1;stroke-dasharray:2 2" }, svg);
      }
    });
    // Steps still to come, as faint placeholders, so the picture does not
    // change height while stepping.
    for (let r = shown.length; r < rows.length; r++) {
      const y = 8 + r * rh;
      text(svg, x0 - 10, y + 15, rows[r].label, { "text-anchor": "end", class: "fill-muted-foreground/50 font-mono text-[10px]" });
      for (let i = 0; i < n; i++) el("rect", { x: x0 + i * cw + 1, y, width: cw - 2, height: rh - 8, rx: 4, style: "fill:none;stroke:currentColor;stroke-opacity:0.1;stroke-dasharray:3 3" }, svg);
    }
    const total = rows.reduce((a, r) => a + r.ops.length, 0);
    o.step.textContent = `${step} of ${rows.length - 1}`;
    o.adds.textContent = `${adds} (total ${total})`;
    o.seq.textContent = `${n - 1} additions, ${n - 1} steps`;
    const want = algo === "hillis" ? M.inclusive(input) : M.exclusive(input);
    const done = step === rows.length - 1;
    o.check.textContent = done ? (rows.at(-1).values.every((v, i) => v === want[i]) ? "matches the sequential scan" : "mismatch") : "not finished";
    const row = rows[step];
    o.note.textContent = step === 0
      ? `Press Step. ${algo === "hillis" ? `Each step every element adds the one 1, 2, 4… places to its left: log₂ ${n} = ${Math.log2(n)} steps, all additions of a step in parallel.` : `The up-sweep builds partial sums in a tree, the root is cleared, and the down-sweep passes prefixes back down: each step swaps the left value right and adds.`}`
      : algo === "hillis"
        ? `Step ${step}: ${row.ops.length} additions at distance ${2 ** (step - 1)}, all independent.${done ? ` Done in ${rows.length - 1} steps but ${total} additions, more than the ${n - 1} of a sequential loop.` : ""}`
        : `${row.label}: ${row.ops.length ? `${row.ops.length} operations, all independent.` : "the last element (the total) is replaced by 0."}${done ? ` Done: ${total} additions, about 2n, in ${rows.length - 1} steps.` : ""}`;
  }
  draw();
}

// ============================================================ Summation order

for (const root of document.querySelectorAll("[data-par-reduction]")) {
  const svg = plot(root, "tree");
  const host = root.querySelector("[data-table]");
  const o = outs(root);
  let data = "mixed", prec = "f32", seed = 1;
  const s = scrubAll(root, draw);
  onSeg(root, (label, v) => { if (label === "Data") data = v; else prec = v; draw(); });
  root.querySelector("[data-action=shuffle]").addEventListener("click", () => { seed++; draw(); });

  function values(n, R) {
    const r = M.rng(1000 + n);
    let xs;
    if (data === "mixed") xs = Array.from({ length: n }, () => (r() < 0.5 ? -1 : 1) * 10 ** (6 * r() - 2) * r());
    else if (data === "big") xs = Array.from({ length: n }, (_, i) => (i === 0 ? 1e8 : 0.5 + r()));
    else {
      xs = [];
      for (let i = 0; i < n / 2; i++) { const big = 1e7 * (1 + r()); xs.push(big, -big + (r() - 0.5)); }
    }
    xs = xs.map(R);
    // Shuffle with the order seed: the same numbers, a different order.
    const q = M.rng(seed);
    for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(q() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
    return xs;
  }

  function draw() {
    const R = prec === "f32" ? Math.fround : (v) => v;
    const n = s.n.get();
    const xs = values(n, R);
    const exact = M.exactSum(xs);
    const res = M.summations(xs, R);
    const fmtV = (v) => (prec === "f32" ? v.toPrecision(9) : v.toPrecision(17)).replace("-", "−");
    const err = (v) => Math.abs(v - exact);
    const errText = (v) => {
      const e = err(v);
      if (e === 0) return "0";
      return exact !== 0 ? `${e.toPrecision(2)} (${(e / Math.abs(exact)).toExponential(1)} rel)`.replaceAll("-", "−") : e.toPrecision(2);
    };
    let worst = 0;
    res.forEach((r) => (worst = Math.max(worst, err(r.value))));
    table(host, ["order", "sum", "error"], [...res.map((r) => [r.label, fmtV(r.value), errText(r.value)]), ["Exact (error-free)", fmtV(exact), "—"]], res.findIndex((r) => err(r.value) === worst && worst > 0));
    const distinct = new Set(res.map((r) => r.value)).size;
    o.distinct.textContent = `${distinct} of ${res.length}`;
    o.worst.textContent = worst === 0 ? "0" : worst.toPrecision(3).replace("-", "−");
    const vals = res.map((r) => r.value);
    o.spread.textContent = (Math.max(...vals) - Math.min(...vals)).toPrecision(3);
    o.note.textContent = data === "big"
      ? `In ${prec === "f32" ? "float32, 10⁸ has a spacing of 8 between neighbouring numbers" : "float64 the spacing near 10⁸ is tiny, so little is lost"}: adding a value near 1 to it ${prec === "f32" ? "rounds away entirely" : "barely rounds"}. Orders that sum the small values first keep them.`
      : data === "cancel"
        ? "Large values cancel in pairs, leaving a small total: any rounding in the large partial sums is huge compared with the answer."
        : `Same ${n} numbers, ${distinct} different answers. Shuffle the order and the parallel splits give different bits again, which is why reproducible reductions fix the tree.`;

    // Pairwise tree over the first 16 values, rounding steps in pink.
    svg.replaceChildren();
    const leaves = xs.slice(0, 16);
    const short = (v) => {
      const a = Math.abs(v);
      return (a !== 0 && (a >= 1e5 || a < 1e-2) ? v.toExponential(1) : v.toPrecision(3)).replace("-", "−").replace("e+", "e");
    };
    let level = leaves.map((v, i) => ({ v, x: 18 + (524 * (i + 0.5)) / 16, exact: true }));
    const y0 = 166, dy = 30;
    level.forEach((nd, i) => text(svg, nd.x, y0 + 6 + (i % 2) * 11, short(nd.v), { "text-anchor": "middle", class: "fill-foreground font-mono text-[8px]" }));
    let depth = 0, rounded = 0;
    while (level.length > 1) {
      depth++;
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const a = level[i], b = level[i + 1];
        const v = R(a.v + b.v);
        const lost = v !== M.exactSum([a.v, b.v]);
        if (lost) rounded++;
        const nd = { v, x: (a.x + b.x) / 2 };
        const y = y0 - depth * dy;
        for (const c of [a, b]) el("line", { x1: c.x, y1: y + dy - 10, x2: nd.x, y2: y + 4, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
        el("circle", { cx: nd.x, cy: y, r: 3, style: lost ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.35" }, svg);
        if (level.length <= 4) text(svg, nd.x, y - 6, short(v), { "text-anchor": "middle", class: lost ? "fill-brand font-mono text-[8px]" : "fill-foreground font-mono text-[8px]" });
        next.push(nd);
      }
      level = next;
    }
    text(svg, 6, 12, `first 16 values as a tree: ${rounded} of 15 additions rounded (pink)`);
  }
  draw();
}

// ============================================================ Load balancing

for (const root of document.querySelectorAll("[data-par-stealing]")) {
  const costsSvg = plot(root, "costs"), gantt = plot(root, "gantt");
  const host = root.querySelector("[data-table]");
  const o = outs(root);
  let kind = "uniform", strategy = "block", seed = 1;
  const s = scrubAll(root, draw);
  onSeg(root, (label, v) => { if (label === "Task costs") kind = v; else strategy = v; draw(); });
  root.querySelector("[data-action=reroll]").addEventListener("click", () => { seed++; draw(); });
  const NAMES = { block: "Equal blocks", cyclic: "Cyclic (round robin)", queue: "Shared queue", steal: "Work stealing" };

  function draw() {
    const n = s.tasks.get(), p = s.p.get(), c = s.overhead.get();
    const costs = M.taskCosts(kind, n, seed);
    const total = costs.reduce((a, b) => a + b, 0);
    const all = Object.fromEntries(Object.keys(NAMES).map((k) => [k, M.balance(costs, p, k, c, seed)]));
    const run = all[strategy];

    costsSvg.replaceChildren();
    const cmax = Math.max(...costs);
    const bw = 520 / n;
    costs.forEach((v, i) => {
      const owner = Math.floor((i * p) / n);
      const h = (60 * v) / cmax;
      el("rect", { x: 30 + i * bw, y: 74 - h, width: Math.max(0.6, bw - 0.6), height: h, style: `fill:${workerColor(owner)};fill-opacity:${owner % 2 ? 0.5 : 0.85}` }, costsSvg);
    });
    text(costsSvg, 30, 86, "task 0");
    text(costsSvg, 550, 86, `task ${n - 1}`, { "text-anchor": "end" });
    text(costsSvg, 30, 10, "cost of each task, coloured by its block owner");

    gantt.replaceChildren();
    const worst = Math.max(...Object.values(all).map((r) => r.makespan));
    const x0 = 38, W = 506, sx = (t) => x0 + (W * t) / (worst * 1.02);
    const rowH = Math.min(24, 170 / p), top = 6;
    for (let w = 0; w < p; w++) {
      text(gantt, x0 - 6, top + w * rowH + rowH / 2 + 3, `W${w + 1}`, { "text-anchor": "end" });
      el("rect", { x: x0, y: top + w * rowH + 1, width: W, height: rowH - 2, rx: 2, style: "fill:currentColor;fill-opacity:0.04" }, gantt);
    }
    for (const sl of run.slots) {
      const owner = sl.task >= 0 ? Math.floor((sl.task * p) / n) : 0;
      const style = sl.kind === "overhead" ? "fill:var(--code-del);fill-opacity:0.7"
        : sl.kind === "stolen" ? `fill:${workerColor(owner)};fill-opacity:0.85;stroke:var(--foreground);stroke-width:0.6`
          : `fill:${workerColor(owner)};fill-opacity:${owner % 2 ? 0.5 : 0.85}`;
      el("rect", { x: sx(sl.start), y: top + sl.w * rowH + 2, width: Math.max(0.5, sx(sl.end) - sx(sl.start) - 0.4), height: rowH - 4, style }, gantt);
    }
    const yb = top + p * rowH + 2;
    for (const [t, label, style, anchor] of [[total / p, "ideal T₁/p", "stroke:currentColor;stroke-opacity:0.5;stroke-dasharray:3 3", "end"], [run.makespan, "makespan", "stroke:var(--brand);stroke-width:1.5", "start"]]) {
      el("line", { x1: sx(t), x2: sx(t), y1: top, y2: yb, style }, gantt);
      text(gantt, sx(t) + (anchor === "start" ? 3 : -3), yb + 12, label, { "text-anchor": anchor });
    }
    gantt.setAttribute("viewBox", `0 0 560 ${yb + 18}`);

    const keys = Object.keys(NAMES);
    table(host, ["strategy", "makespan", "idle", "steals"], keys.map((k) => [NAMES[k], num(all[k].makespan, 1), pct(all[k].idle), k === "steal" ? String(all[k].steals) : "—"]), keys.indexOf(strategy));
    o.makespan.textContent = num(run.makespan, 2);
    o.ideal.textContent = num(total / p, 2);
    o.idle.textContent = pct(run.idle, 1);
    o.steals.textContent = strategy === "steal" ? String(run.steals) : strategy === "queue" ? `${n} grabs` : "—";
    o.note.textContent = strategy === "block"
      ? kind === "ramp" ? "With rising costs the last block holds the expensive tasks: everyone else waits for it." : "Blocks cost nothing to hand out; they only lose when the work is uneven."
      : strategy === "cyclic" ? "Round robin spreads a smooth ramp evenly, but not a few random heavy tasks."
        : strategy === "queue" ? `Every grab holds one lock for ${num(c, 1)}: with ${n} tasks that is ${num(n * c, 1)} units of serial time, which caps the speedup when tasks are small.`
          : `Workers start with their own block and steal only when idle, so there are just ${run.steals} steals (outlined bars are stolen tasks, red slivers the cost of stealing).`;
  }
  draw();
}

// ============================================================ Warp divergence

for (const root of document.querySelectorAll("[data-par-divergence]")) {
  const svg = plot(root, "lanes");
  const o = outs(root);
  let cond = "half";
  selectSeg(root, "Condition", cond);
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { cond = v; draw(); });
  const CODE = {
    warp: "if ((threadIdx.x / 32) % 2 == 0)   // whole warps agree",
    half: "if (threadIdx.x % 32 < 16)         // half of every warp",
    odd: "if (threadIdx.x % 2 == 1)          // odd lanes",
    data: "if (data[i] > t)                   // depends on the data",
  };

  function draw() {
    const prob = s.prob.get() / 100, a = s.a.get(), b = s.b.get();
    const mask = M.branchMask(cond, prob);
    const r = M.simtCost(mask, a, b);
    svg.replaceChildren();
    const x0 = 60, W = 480, tmax = Math.max(1, a + b), sx = (t) => x0 + (W * t) / tmax;
    const band = 56, lane = 1.4;
    r.warps.forEach((w, k) => {
      const y = 8 + k * band;
      text(svg, x0 - 8, y + 18, `warp ${k}`, { "text-anchor": "end" });
      text(svg, x0 - 8, y + 30, `${w.t} cyc`, { "text-anchor": "end" });
      let t = 0;
      for (const [run, len, isIf] of [[w.runIf, a, true], [w.runElse, b, false]]) {
        if (!run || len === 0) continue;
        for (let l = 0; l < 32; l++) {
          const on = mask[k][l] === isIf;
          el("rect", { x: sx(t), y: y + l * lane, width: Math.max(0.5, sx(t + len) - sx(t) - 0.5), height: lane - 0.3,
            style: on ? `fill:${isIf ? "var(--vec-i)" : "var(--vec-j)"}` : "fill:currentColor;fill-opacity:0.1" }, svg);
        }
        t += len;
      }
    });
    text(svg, x0, 8 + 4 * band + 6, "0");
    text(svg, x0 + W, 8 + 4 * band + 6, `${a + b} cycles (both paths)`, { "text-anchor": "end" });
    o.code.textContent = `${CODE[cond]}\n    x = f(x);      // ${a} instructions\nelse\n    x = g(x);      // ${b} instructions`;
    o.cycles.textContent = `${r.cycles}`;
    o.best.textContent = `${r.best}`;
    o.eff.textContent = pct(r.eff, 1);
    o.div.textContent = `${r.divergent} of 4`;
    const pAny = 1 - (1 - prob) ** 32;
    o.note.textContent = cond === "warp" ? "Each warp takes one path, so no lane waits: divergence happens inside a warp, never between warps."
      : cond === "data" ? `With P = ${pct(prob)} per lane, a warp of 32 runs the if body with probability 1 − (1 − p)³² = ${pct(pAny, 1)}: rare branches are rarely cheap on a GPU.`
        : `Every warp runs both bodies, one after the other, with half its lanes masked: the warp pays ${a} + ${b} cycles for work worth ${Math.max(a, b)}.`;
  }
  draw();
}

// ============================================================ Memory coalescing

for (const root of document.querySelectorAll("[data-par-coalescing]")) {
  const svg = plot(root, "memory");
  const o = outs(root);
  let pattern = "soa";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { pattern = v; draw(); });
  const CODE = {
    soa: "float v = x[i];            // struct of arrays: x is contiguous",
    aos: "float v = p[i].x;          // array of structs {x, y, z}: stride 3",
    stride: "float v = a[i * STRIDE];   // e.g. reading a column of a row-major matrix",
    random: "float v = a[idx[i]];       // gather through an index array",
  };

  function draw() {
    const words = M.warpAddresses(pattern, s.stride.get(), s.offset.get());
    const { sectors, lines, useful, moved } = M.sectorsOf(words);
    svg.replaceChildren();
    const perRow = 32, sw = 528 / perRow, x0 = 16;
    const maxSector = Math.max(...sectors);
    const rows = Math.floor(maxSector / perRow) + 1;
    const rh = Math.min(22, 140 / rows), y0 = 70;
    // Threads.
    for (let t = 0; t < 32; t++) {
      const x = x0 + (528 * (t + 0.5)) / 32;
      el("circle", { cx: x, cy: 18, r: 4, style: "fill:var(--vec-i)" }, svg);
      if (t % 8 === 0) text(svg, x, 10, `t${t}`, { "text-anchor": "middle" });
    }
    // Sectors.
    for (let r = 0; r < rows; r++) for (let k = 0; k < perRow; k++) {
      const id = r * perRow + k;
      const on = sectors.has(id);
      el("rect", { x: x0 + k * sw + 0.5, y: y0 + r * rh, width: sw - 1, height: rh - 3, rx: 1.5,
        style: on ? "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-opacity:0.8" : "fill:currentColor;fill-opacity:0.04;stroke:currentColor;stroke-opacity:0.12" }, svg);
    }
    // Lines from threads to the word they read.
    words.forEach((w, t) => {
      const sec = Math.floor(w / 8), within = w % 8;
      const r = Math.floor(sec / perRow), k = sec % perRow;
      const x = x0 + k * sw + (sw * (within + 0.5)) / 8, y = y0 + r * rh + (rh - 3) / 2;
      el("line", { x1: x0 + (528 * (t + 0.5)) / 32, y1: 22, x2: x, y2: y0 + r * rh, style: "stroke:var(--vec-i);stroke-opacity:0.3" }, svg);
      el("circle", { cx: x, cy: y, r: 1.6, style: "fill:var(--vec-i)" }, svg);
    });
    text(svg, x0, y0 + rows * rh + 12, `memory in 32-byte sectors (8 words each), ${perRow} sectors per row`);
    svg.setAttribute("viewBox", `0 0 560 ${y0 + rows * rh + 20}`);
    o.code.textContent = `int i = blockIdx.x * blockDim.x + threadIdx.x;\n${CODE[pattern]}`;
    o.useful.textContent = `${useful} B`;
    o.sectors.textContent = `${sectors.size} in ${lines.size} line${lines.size > 1 ? "s" : ""}`;
    o.moved.textContent = `${moved} B`;
    o.eff.textContent = pct(useful / moved, 1);
    o.note.textContent = pattern === "soa"
      ? s.offset.get() ? "Misaligned by a few words, the same 128 bytes straddle one extra sector." : "32 threads × 4 bytes = 128 bytes in 4 sectors: every byte moved is used."
      : pattern === "aos" ? "Reading only x from {x, y, z} structs drags y and z through the bus too: two thirds of the traffic is wasted. Storing x, y and z in separate arrays (SoA) fixes it."
        : pattern === "stride" ? `A stride of ${s.stride.get()} words puts the threads ${4 * s.stride.get()} bytes apart; from a stride of 8 every thread needs its own sector.`
          : "Random indices scatter the warp across memory: almost one sector per thread.";
  }
  draw();
}

// ============================================================ Roofline

for (const root of document.querySelectorAll("[data-par-roofline]")) {
  const svg = plot(root, "roof");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const MACHINES = { laptop: [400, 60], server: [3000, 300], gpu: [30000, 3000] };
  onSeg(root, (_, v) => { s.peak.set(MACHINES[v][0], false); s.bw.set(MACHINES[v][1], false); draw(); });
  // FP64, intensity counted against main-memory traffic.
  const KERNELS = [
    ["STREAM triad", 2 / 24],
    ["dot product, naive matmul", 2 / 16],
    ["7-point stencil", 8 / 16],
    ["FFT (large)", 1.25],
  ];

  function draw() {
    const peak = s.peak.get(), bw = s.bw.get(), b = s.tile.get();
    const at = (ai) => Math.min(peak, ai * bw);
    svg.replaceChildren();
    const F = frame(svg, { box: [54, 16, 470, 260], x: [-6, 8], y: [0, 5], xticks: [-6, -4, -2, 0, 2, 4, 6, 8], yticks: [0, 1, 2, 3, 4, 5],
      xfmt: (k) => (k < 0 ? `1/${2 ** -k}` : String(2 ** k)), yfmt: (k) => (k >= 3 ? `${10 ** (k - 3)}T` : `${10 ** k}G`), xlabel: "arithmetic intensity (flop/byte)", ylabel: "FLOP/s (log)" });
    const X = (ai) => F.sx(Math.log2(ai)), Y = (g) => F.sy(Math.log10(Math.max(1, g)));
    const ridge = peak / bw;
    const pts = [];
    for (let k = -6; k <= 8; k += 0.05) pts.push([F.sx(k), Y(at(2 ** k))]);
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: X(ridge), x2: X(ridge), y1: Y(peak), y2: F.T + F.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
    text(svg, Math.min(X(ridge) + 4, F.L + F.W - 60), F.T + F.H - 6, `ridge ${num(ridge, 1)}`);
    text(svg, F.L + F.W - 2, Y(peak) - 6, `peak ${peak} GFLOP/s`, { "text-anchor": "end" });
    const plotted = [];
    const point = (name, ai, color, big) => {
      const x = X(ai), y = Y(at(ai));
      el("circle", { cx: x, cy: y, r: big ? 5 : 3.5, style: `fill:${color};stroke:var(--background);stroke-width:1.5` }, svg);
      // Labels sit below and right of the rising roof, or above and left
      // for the highlighted point, so they never cross the line.
      let ly = big ? y - 9 : y + 14;
      while (!big && plotted.some((p) => Math.abs(p[0] - x) < 90 && Math.abs(p[1] - ly) < 11)) ly += 11;
      plotted.push([x, ly]);
      text(svg, big ? x - 8 : x + 6, ly, name, { "text-anchor": big ? "end" : "start", class: big ? "fill-brand font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    };
    for (const [name, ai] of KERNELS) point(name, ai, "var(--vec-i)", false);
    const ai = b / 8;
    point(`tiled matmul b=${b}`, ai, "var(--brand)", true);
    o.ridge.textContent = `${num(ridge, 2)} flop/B`;
    o.ai.textContent = `${num(ai, 2)} flop/B`;
    o.mm.textContent = `${num(at(ai), 0)} GFLOP/s (${pct(at(ai) / peak)})`;
    o.bound.textContent = ai < ridge ? "memory" : "compute";
    const cacheKB = (3 * b * b * 8) / 1024;
    o.note.textContent = `A b×b tile does 2b³ flops for 2b² loads of 8 bytes, so intensity is b/8. b = ${b} needs three tiles, ${num(cacheKB, cacheKB < 10 ? 1 : 0)} KB, to stay in cache${cacheKB > 1024 ? ", more than most L2s" : ""}. ` +
      `${ai < ridge ? `Still left of the ridge: memory-bound, so a bigger tile helps.` : "Right of the ridge: compute-bound, the flops now set the speed."} Machine numbers are rough FP64 figures.`;
  }
  draw();
}

// ============================================================ False sharing

for (const root of document.querySelectorAll("[data-par-falseshare]")) {
  const cores = plot(root, "cores"), chart = plot(root, "throughput");
  const o = outs(root);
  let layout = "packed", playing = false, raf = 0, last = 0, simT = 0, lineFree = 0, owner = -1, transfers = 0, counters = [], nextAt = [], flash = null;
  const s = scrubAll(root, () => { reset(); draw(); });
  onSeg(root, (_, v) => { layout = v; reset(); draw(); });
  const btn = root.querySelector("[data-action=play]");
  btn.addEventListener("click", () => (playing ? stop() : start()));
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) stop(); }).observe(root);

  function reset() {
    const t = s.threads.get();
    counters = new Array(t).fill(0);
    nextAt = new Array(t).fill(0).map((_, i) => i * 0.37);
    simT = 0; lineFree = 0; owner = -1; transfers = 0; flash = null;
  }
  function start() {
    playing = true; last = 0;
    btn.querySelector("[data-icon=play]").hidden = true;
    btn.querySelector("[data-icon=pause]").hidden = false;
    btn.querySelector("[data-label]").textContent = "Pause";
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf);
    btn.querySelector("[data-icon=play]").hidden = false;
    btn.querySelector("[data-icon=pause]").hidden = true;
    btn.querySelector("[data-label]").textContent = "Run";
  }
  // Event simulation: each thread writes as soon as it can; in the packed
  // and shared layouts the line is one resource, so writes serialise and a
  // write by a new core first pays the line transfer.
  function tick(now) {
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    const hit = s.hit.get(), miss = s.miss.get();
    const until = simT + dt / 6; // 6 ms of animation per simulated nanosecond
    for (let guard = 0; guard < 2000; guard++) {
      let i = 0;
      for (let k = 1; k < counters.length; k++) if (nextAt[k] < nextAt[i]) i = k;
      if (nextAt[i] > until) break;
      if (layout === "padded") { counters[i]++; nextAt[i] += hit; continue; }
      const startAt = Math.max(nextAt[i], lineFree);
      const cost = (owner === i ? hit : hit + miss) + (layout === "shared" ? 2 * hit : 0);
      if (owner !== i && owner >= 0) { transfers++; flash = { from: owner, to: i, at: now }; }
      owner = i;
      lineFree = startAt + cost;
      counters[i]++;
      nextAt[i] = lineFree;
    }
    simT = until;
    draw();
    if (playing) raf = requestAnimationFrame(tick);
  }

  function draw() {
    const T = s.threads.get(), hit = s.hit.get(), miss = s.miss.get();
    if (counters.length !== T) reset();
    // Cores with their caches.
    cores.replaceChildren();
    const cw = 528 / 8;
    for (let c = 0; c < T; c++) {
      const x = 16 + c * cw;
      el("rect", { x: x + 4, y: 8, width: cw - 8, height: 30, rx: 5, style: `fill:${workerColor(c)};fill-opacity:0.15;stroke:${workerColor(c)}` }, cores);
      text(cores, x + cw / 2, 27, `core ${c}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      const holds = layout === "padded" || owner === c;
      el("rect", { x: x + 4, y: 46, width: cw - 8, height: 22, rx: 4, style: holds ? "fill:var(--brand);fill-opacity:0.15;stroke:var(--brand)" : "fill:none;stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:3 2" }, cores);
      text(cores, x + cw / 2, 61, layout === "padded" ? "own line" : holds ? "owns line" : "invalid", { "text-anchor": "middle", class: holds ? "fill-brand font-mono text-[9px]" : "fill-muted-foreground font-mono text-[9px]" });
      text(cores, x + cw / 2, 84, layout === "shared" ? "" : String(counters[c] ?? 0), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px] tabular-nums" });
    }
    // Memory: one 64-byte line of eight 8-byte slots, or one line each.
    const y = 120;
    text(cores, 16, y - 8, layout === "padded" ? "memory: each counter padded to its own 64-byte line" : layout === "packed" ? "memory: eight 8-byte counters share one 64-byte line" : "memory: one counter that every thread increments");
    if (layout === "padded") {
      for (let c = 0; c < T; c++) {
        const x = 16 + c * cw;
        el("rect", { x: x + 4, y, width: cw - 8, height: 24, rx: 3, style: `fill:${workerColor(c)};fill-opacity:0.25;stroke:currentColor;stroke-opacity:0.2` }, cores);
        el("rect", { x: x + 4, y, width: (cw - 8) / 8, height: 24, style: `fill:${workerColor(c)}` }, cores);
      }
    } else {
      const lw = 528, sw = lw / 8;
      for (let k = 0; k < 8; k++) {
        const used = layout === "packed" ? k < T : k === 0;
        el("rect", { x: 16 + k * sw + 1, y, width: sw - 2, height: 24, rx: 3, style: used ? `fill:${layout === "shared" ? "var(--code-del)" : workerColor(k)};fill-opacity:0.35` : "fill:currentColor;fill-opacity:0.05" }, cores);
      }
      el("rect", { x: 16, y, width: lw, height: 24, rx: 4, style: "fill:none;stroke:var(--brand);stroke-width:1.5" }, cores);
      if (layout === "shared") text(cores, 16 + sw / 2, y + 16, String(counters.reduce((a, b) => a + b, 0)), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      if (owner >= 0) {
        const ox = 16 + owner * cw + cw / 2;
        el("line", { x1: ox, y1: 68, x2: ox, y2: y, style: "stroke:var(--brand);stroke-width:1.5" }, cores);
      }
      if (flash && performance.now() - flash.at < 200) {
        el("path", { d: `M${16 + flash.from * cw + cw / 2},70 Q${16 + ((flash.from + flash.to) / 2) * cw + cw / 2},100 ${16 + flash.to * cw + cw / 2},70`, style: "fill:none;stroke:var(--code-del);stroke-width:1.5" }, cores);
      }
    }
    text(cores, 16, 166, `simulated ${num(simT, 0)} ns`, {});

    // Throughput against threads for the three layouts.
    chart.replaceChildren();
    const rates = (l) => Array.from({ length: 8 }, (_, k) => 1000 * M.counterRate(l, k + 1, hit, miss));
    const ymax = Math.max(...rates("padded"));
    const F = frame(chart, { box: [56, 14, 470, 160], x: [1, 8], y: [0, Math.log10(ymax) + 0.2], xticks: [1, 2, 3, 4, 5, 6, 7, 8], yticks: [0, 1, 2, 3, 4].filter((k) => k <= Math.log10(ymax) + 0.2),
      yfmt: (k) => String(10 ** k), xlabel: "threads", ylabel: "increments per µs (log)" });
    for (const [l, color] of [["padded", "var(--vec-i)"], ["packed", "var(--vec-u)"], ["shared", "var(--code-del)"]]) {
      const rs = rates(l);
      polyline(chart, rs.map((r, k) => [F.sx(k + 1), F.sy(Math.log10(Math.max(1, r)))]), `stroke:${color};stroke-width:${l === layout ? 2.5 : 1.25};stroke-opacity:${l === layout ? 1 : 0.6}`);
      if (l === layout) el("circle", { cx: F.sx(T), cy: F.sy(Math.log10(Math.max(1, rs[T - 1]))), r: 4.5, style: `fill:${color};stroke:var(--background);stroke-width:2` }, chart);
    }
    const rate = 1000 * M.counterRate(layout, T, hit, miss), padded = 1000 * M.counterRate("padded", T, hit, miss);
    o.transfers.textContent = layout === "padded" ? "0" : String(transfers);
    o.rate.textContent = `${num(rate, 0)} per µs`;
    o.ratio.textContent = `${num(rate / padded, 3)}×`;
    o.note.textContent = layout === "padded"
      ? `Each core keeps its own line in its cache: ${T} threads, ${T}× the throughput.`
      : layout === "packed"
        ? `The counters are independent, but the line is not: a write by another core costs a ${miss} ns transfer, so ${T > 1 ? `${T} threads run ${num(padded / rate, 0)}× slower than padded ones` : "one thread is still fast"}.`
        : "Here the data really is shared (true sharing): every increment is an atomic read-modify-write on the same line. Give each thread its own counter and add them at the end.";
  }
  reset();
  draw();
}

// ============================================================ Real Web Workers

for (const root of document.querySelectorAll("[data-par-workers]")) {
  const canvas = root.querySelector("[data-canvas]");
  const ctx = canvas.getContext("2d");
  const chart = plot(root, "speedup");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  const runBtn = root.querySelector("[data-action=run]"), sweepBtn = root.querySelector("[data-action=sweep]");
  const W = canvas.width, H = canvas.height;
  let split = "blocks", tint = true, pool = [], busy = false, last = null;
  const results = { blocks: new Map(), chunks: new Map() }; // workers -> ms, per split, for the current iteration count
  let resultsIter = 0;
  onSeg(root, (_, v) => { split = v; plotSpeedup(); });
  onToggle(root, (_, on) => { tint = on; if (last) paint(last); });
  const cores = navigator.hardwareConcurrency || 4;
  o.cores.textContent = String(cores);
  s.workers.set(Math.min(cores, 32), false);

  // Theme colours as RGB, by letting the canvas parse the CSS value.
  function rgbOf(cssVar) {
    const value = getComputedStyle(root).getPropertyValue(cssVar).trim() || "#888";
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#000";
    g.fillStyle = value;
    g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }

  function ensurePool(n) {
    while (pool.length < n) {
      const w = new Worker(new URL("./parallel-worker.js", import.meta.url), { type: "module" });
      pool.push(w);
    }
  }
  const call = (w, msg) => new Promise((resolve, reject) => {
    w.onmessage = (e) => resolve(e.data);
    w.onerror = (e) => reject(e);
    w.postMessage(msg);
  });

  async function render(p, iter) {
    ensurePool(p);
    const view = { cx: -0.6, cy: 0, scale: 3.2 / W, width: W, height: H, iter };
    await Promise.all(pool.slice(0, p).map((w) => call(w, { rows: [0], ...view }))); // warm up
    const counts = new Uint16Array(W * H), owner = new Uint8Array(H), busyMs = new Array(p).fill(0);
    const t0 = performance.now();
    if (split === "blocks") {
      await Promise.all(pool.slice(0, p).map(async (w, k) => {
        const a = Math.floor((k * H) / p), b = Math.floor(((k + 1) * H) / p);
        const rows = Array.from({ length: b - a }, (_, i) => a + i);
        const res = await call(w, { rows, ...view });
        store(res, k);
      }));
    } else {
      let next = 0;
      const CHUNK = 4;
      await Promise.all(pool.slice(0, p).map(async (w, k) => {
        while (next < H) {
          const rows = [];
          for (let i = 0; i < CHUNK && next < H; i++) rows.push(next++);
          store(await call(w, { rows, ...view }), k);
        }
      }));
    }
    const ms = performance.now() - t0;
    function store(res, k) {
      res.rows.forEach((y, i) => { counts.set(res.data.subarray(i * W, (i + 1) * W), y * W); owner[y] = k; });
      busyMs[k] += res.ms;
    }
    return { counts, owner, busyMs, ms, p, iter };
  }

  function paint(r) {
    const img = ctx.createImageData(W, H);
    const fg = rgbOf("--foreground"), bg = rgbOf("--background");
    const tints = COLORS.map((c) => rgbOf(c.slice(4, -1)));
    const logMax = Math.log(r.iter);
    for (let y = 0; y < H; y++) {
      const tc = tints[r.owner[y] % tints.length];
      for (let x = 0; x < W; x++) {
        const n = r.counts[y * W + x];
        let col;
        if (n >= r.iter) col = fg;
        else {
          const f = Math.log(1 + n) / logMax;
          col = bg.map((b, i) => b + (fg[i] - b) * f * 0.85);
        }
        if (tint && n < r.iter) col = col.map((v, i) => v * 0.6 + tc[i] * 0.4);
        if (tint && x < 5) col = tc;
        const j = 4 * (y * W + x);
        img.data[j] = col[0]; img.data[j + 1] = col[1]; img.data[j + 2] = col[2]; img.data[j + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function plotSpeedup() {
    chart.replaceChildren();
    const n = Math.max(s.workers.get(), ...[...results.blocks.keys(), ...results.chunks.keys()], 2);
    const sp = (m, p) => (m.has(1) && m.has(p) ? m.get(1) / m.get(p) : null);
    let ymax = 2;
    for (const m of Object.values(results)) for (const p of m.keys()) ymax = Math.max(ymax, sp(m, p) ?? 0);
    ymax = Math.ceil(Math.min(n, ymax * 1.15));
    const step = ymax > 8 ? Math.ceil(ymax / 6) : 1;
    const F = frame(chart, { box: [40, 14, 490, 166], x: [1, n], y: [0, ymax], xticks: Array.from({ length: n }, (_, k) => k + 1).filter((k) => n <= 16 || k % 2 === 1),
      yticks: Array.from({ length: Math.floor(ymax / step) + 1 }, (_, k) => k * step), xlabel: "workers", ylabel: "measured speedup" });
    polyline(chart, [[F.sx(1), F.sy(1)], [F.sx(Math.min(n, ymax)), F.sy(Math.min(n, ymax))]], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4");
    el("line", { x1: F.sx(Math.min(cores, n)), x2: F.sx(Math.min(cores, n)), y1: F.T, y2: F.T + F.H, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, chart);
    text(chart, F.sx(Math.min(cores, n)) - 4, F.T + 10, `${cores} cores`, { "text-anchor": "end" });
    for (const [key, color] of [["blocks", "var(--vec-j)"], ["chunks", "var(--vec-i)"]]) {
      const m = results[key];
      const pts = [...m.keys()].sort((a, b) => a - b).map((p) => [p, sp(m, p)]).filter(([, v]) => v !== null);
      if (pts.length > 1) polyline(chart, pts.map(([p, v]) => [F.sx(p), F.sy(v)]), `stroke:${color};stroke-width:${key === split ? 2.25 : 1.25}`);
      for (const [p, v] of pts) el("circle", { cx: F.sx(p), cy: F.sy(v), r: key === split ? 4 : 3, style: `fill:${color};stroke:var(--background);stroke-width:1.5` }, chart);
    }
    text(chart, F.L + 4, F.T + 10, "equal blocks", { class: "fill-[var(--vec-j)] font-mono text-[10px]" });
    text(chart, F.L + 4, F.T + 22, "chunks on demand", { class: "fill-[var(--vec-i)] font-mono text-[10px]" });
  }

  function remember(r) {
    if (r.iter !== resultsIter) { results.blocks.clear(); results.chunks.clear(); resultsIter = r.iter; }
    const m = results[split];
    m.set(r.p, Math.min(m.get(r.p) ?? Infinity, r.ms));
  }
  function report(r) {
    last = r;
    paint(r);
    remember(r);
    const base = results[split].get(1);
    o.time.textContent = `${num(r.ms, 0)} ms on ${r.p} worker${r.p > 1 ? "s" : ""}`;
    o.speedup.textContent = base ? `${num(base / r.ms, 2)}×` : "—";
    const bm = r.busyMs.filter((v) => v > 0);
    o.balance.textContent = bm.length > 1 ? `${num(Math.max(...bm), 0)} / ${num(Math.min(...bm), 0)} ms` : "—";
    plotSpeedup();
  }

  async function guarded(fn) {
    if (busy) return;
    busy = true;
    runBtn.disabled = sweepBtn.disabled = true;
    try { await fn(); }
    catch (err) { o.note.textContent = `Web Workers could not run here: ${err?.message ?? err}`; }
    finally { busy = false; runBtn.disabled = sweepBtn.disabled = false; }
  }

  runBtn.addEventListener("click", () => guarded(async () => {
    const p = s.workers.get(), iter = s.iter.get();
    if (iter !== resultsIter || !results[split].has(1)) {
      o.note.textContent = "Timing 1 worker first, as the baseline…";
      report(await render(1, iter));
    }
    o.note.textContent = `Rendering with ${p} workers…`;
    const r = await render(p, iter);
    report(r);
    const bm = r.busyMs;
    o.note.textContent = split === "blocks"
      ? `Each worker got ${num(H / p, 0)} consecutive rows. The busiest worked ${num(Math.max(...bm), 0)} ms and the idlest ${num(Math.min(...bm), 0)} ms: the rows through the black set cost the most.`
      : `Workers took 4 rows at a time until none were left, so they finished within ${num(Math.max(...bm) - Math.min(...bm), 0)} ms of each other.`;
  }));

  sweepBtn.addEventListener("click", () => guarded(async () => {
    const n = s.workers.get(), iter = s.iter.get();
    for (let p = 1; p <= n; p++) {
      o.note.textContent = `Sweeping: ${p} of ${n} workers…`;
      report(await render(p, iter));
    }
    const m = results[split];
    o.note.textContent = `Best speedup ${num(Math.max(...[...m.keys()].map((p) => m.get(1) / m.get(p))), 2)}× on this device (${cores} cores reported). Past the core count, extra workers only share the same cores.`;
  }));

  plotSpeedup();
  // Draw a first picture without timing it, so the canvas is not empty.
  guarded(async () => { const r = await render(Math.min(cores, 4), 300); last = r; paint(r); o.note.textContent = "Press Run to time it on this device."; });
}
