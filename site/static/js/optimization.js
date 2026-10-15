// Optimization blocks: every picture is drawn from the exact solvers in
// optimization-math.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import * as M from "./optimization-math.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const PALETTE = ["var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)"];
let uid = 0;

/** An arrow between two pixel points. */
function arrowPx(parent, x1, y1, x2, y2, color, width = 2, head = 8) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const bx = x2 - ux * head, by = y2 - uy * head;
  el("line", { x1, y1, x2: bx, y2: by, style: `stroke:${color};stroke-width:${width}px;stroke-linecap:round` }, parent);
  el("path", { d: `M${x2} ${y2} L${bx - uy * head * 0.5} ${by + ux * head * 0.5} L${bx + uy * head * 0.5} ${by - ux * head * 0.5} Z`, style: `fill:${color}` }, parent);
}

/** Marching squares: line segments of fn = level on a grid, in data coordinates. */
function contour(fn, [x0, x1], [y0, y1], nx, ny, level) {
  const xs = (i) => x0 + ((x1 - x0) * i) / nx, ys = (j) => y0 + ((y1 - y0) * j) / ny;
  const v = Array.from({ length: nx + 1 }, (_, i) => Array.from({ length: ny + 1 }, (_, j) => fn(xs(i), ys(j)) - level));
  const segs = [];
  const lerp = (a, b, va, vb) => a + ((b - a) * va) / (va - vb);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const c = [v[i][j], v[i + 1][j], v[i + 1][j + 1], v[i][j + 1]];
      const p = [[xs(i), ys(j)], [xs(i + 1), ys(j)], [xs(i + 1), ys(j + 1)], [xs(i), ys(j + 1)]];
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const a = c[k], b = c[(k + 1) % 4];
        if ((a < 0) !== (b < 0)) {
          const [pa, pb] = [p[k], p[(k + 1) % 4]];
          pts.push([lerp(pa[0], pb[0], a, b), lerp(pa[1], pb[1], a, b)]);
        }
      }
      if (pts.length === 2) segs.push(pts);
      if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
    }
  }
  return segs;
}

function drawContours(parent, f, segs, style) {
  const d = segs.map(([a, b]) => `M${f.sx(a[0]).toFixed(1)} ${f.sy(a[1]).toFixed(1)}L${f.sx(b[0]).toFixed(1)} ${f.sy(b[1]).toFixed(1)}`).join("");
  if (d) el("path", { d, style: "fill:none;" + style }, parent);
}

/** A clip rectangle matching a frame, returned as a group that uses it. */
function clipped(svg, f) {
  const id = `optm-clip-${uid++}`;
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, el("defs", {}, svg)));
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

// Back / Next / keyboard for the step-through blocks.
function stepper(root, count, render) {
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(count(), i));
    render(at);
  };
  root.querySelector("[data-action=back]")?.addEventListener("click", () => go(at - 1));
  root.querySelector("[data-action=next]")?.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input")) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: count() }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  });
  if (!root.hasAttribute("tabindex")) root.tabIndex = 0;
  return { go, get at() { return at; } };
}

// ============================================================ LP in 2D

for (const root of document.querySelectorAll("[data-optm-lp]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const cons = [[1, 0, 4], [0, 2, 12], [s.a3.get(), s.b3.get(), s.r3.get()], [-1, 0, 0], [0, -1, 0]];
    const c = [s.c1.get(), s.c2.get()];
    const verts = M.lpVertices(cons);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 456, 350], x: [0, 8], y: [0, 10], xticks: [0, 2, 4, 6, 8], yticks: [0, 2, 4, 6, 8, 10], xlabel: "x", ylabel: "y" });
    const g = clipped(svg, f);
    if (verts.length >= 3) el("path", { d: "M" + verts.map((p) => `${f.sx(+p.x)} ${f.sy(+p.y)}`).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.12;stroke:var(--brand);stroke-width:1.5px" }, g);
    cons.slice(0, 3).forEach(([a, b, r], i) => {
      const pts = b !== 0 ? [[-1, (r + a) / b], [9, (r - 9 * a) / b]] : [[r / a, -1], [r / a, 11]];
      polyline(g, pts.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:currentColor;stroke-opacity:0.55;stroke-width:1px;stroke-dasharray:4 3");
      const lx = b !== 0 ? Math.min(7.6, Math.max(0.2, (r - 9.4 * b) / (a || 1e-9))) : r / a;
      const ly = b !== 0 ? (r - a * lx) / b : 9.4;
      text(g, f.sx(lx) + 4, f.sy(Math.min(9.6, Math.max(0.4, ly))) - 4, ["x ≤ 4", "2y ≤ 12", `${a}x + ${b}y ≤ ${r}`][i]);
    });
    const vals = verts.map((p) => p.x.mul(c[0]).add(p.y.mul(c[1])));
    let best = vals.reduce((bi, v, i) => (v.cmp(vals[bi]) > 0 ? i : bi), 0);
    const ties = vals.map((v, i) => i).filter((i) => vals[i].cmp(vals[best]) === 0);
    // The objective line through the optimum, and the direction it improves in.
    const p0 = verts[best];
    if (p0 && (c[0] || c[1])) {
      const z = +vals[best];
      const line = c[1] !== 0 ? [[-1, (z + c[0]) / c[1]], [9, (z - 9 * c[0]) / c[1]]] : [[z / c[0], -1], [z / c[0], 11]];
      polyline(g, line.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:1.75px");
      const n = Math.hypot(...c);
      arrowPx(svg, f.sx(+p0.x), f.sy(+p0.y), f.sx(+p0.x) + (c[0] / n) * 40, f.sy(+p0.y) - (c[1] / n) * 40, "var(--brand)", 1.75);
    }
    verts.forEach((p, i) => {
      const on = ties.includes(i);
      el("circle", { cx: f.sx(+p.x), cy: f.sy(+p.y), r: on ? 5 : 3.5, style: `fill:${on ? "var(--brand)" : "var(--background)"};stroke:${on ? "var(--brand)" : "var(--foreground)"};stroke-width:1.5px` }, svg);
      text(svg, f.sx(+p.x) + 7, f.sy(+p.y) + 13, `(${p.x}, ${p.y})`, { class: on ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    });
    const fmt = (p) => `(${p.x}, ${p.y})`;
    o.opt.textContent = !c[0] && !c[1] ? "every point" : ties.length > 1 ? `edge ${fmt(verts[ties[0]])}–${fmt(verts[ties.at(-1)])}` : fmt(p0);
    o.val.textContent = String(vals[best]);
    o.nv.textContent = String(verts.length);
  }
  draw();
}

// ============================================================ simplex

for (const root of document.querySelectorAll("[data-optm-simplex]")) {
  const box = root.querySelector("[data-tableau]");
  const o = outs(root);
  const { states, names } = M.simplexStates([[1, 0], [0, 2], [3, 2]], [4, 12, 18], [3, 5]);
  const cell = (tag, txt, cls = "") => {
    const c = document.createElement(tag);
    c.textContent = txt;
    c.className = cls;
    return c;
  };
  stepper(root, () => states.length - 1, render);

  function render(i) {
    const st = states[i];
    const m = st.T.length - 1;
    const table = document.createElement("table");
    table.className = "w-full border-collapse tabular-nums";
    const head = document.createElement("tr");
    head.append(cell("th", "basis", "py-1.5 pr-3 text-left font-normal text-muted-foreground"));
    names.forEach((nm, j) => head.append(cell("th", nm, `py-1.5 px-2 text-right font-normal ${j === st.col ? "text-brand" : "text-muted-foreground"}`)));
    head.append(cell("th", "RHS", "py-1.5 px-2 text-right font-normal text-muted-foreground"));
    if (st.kind === "choose") head.append(cell("th", "ratio", "py-1.5 pl-3 text-right font-normal text-muted-foreground"));
    table.append(head);
    st.T.forEach((row, r) => {
      const tr = document.createElement("tr");
      const isZ = r === m;
      tr.className = isZ ? "border-t-2 border-foreground/40" : "border-t";
      tr.append(cell("td", isZ ? "z" : names[st.basis[r]], `py-1.5 pr-3 ${r === st.row ? "text-brand font-medium" : ""}`));
      row.forEach((v, j) => {
        const pivot = r === st.row && j === st.col;
        const inCol = j === st.col && !isZ, inRow = r === st.row;
        let cls = "py-1.5 px-2 text-right";
        if (pivot) cls += " rounded-md bg-brand text-white";
        else if ((inCol || inRow) && st.kind === "choose") cls += " bg-brand/10";
        if (isZ && j === st.col) cls += " text-brand";
        tr.append(cell("td", String(v), cls));
      });
      if (st.kind === "choose") tr.append(cell("td", isZ ? "" : st.ratios[r] ? String(st.ratios[r]) : "—", `py-1.5 pl-3 text-right ${r === st.row ? "text-brand" : "text-muted-foreground"}`));
      table.append(tr);
    });
    box.replaceChildren(table);
    const nm = names[st.col];
    o.explain.textContent = {
      start: "Start at the origin: x = y = 0, the slack variables take the whole right-hand side. Negative entries in the z row mean the objective can still grow.",
      choose: `Entering: ${nm}, the most negative z entry. Ratio test: the smallest RHS / ${nm} over positive entries is row ${names[st.basis[st.row] ?? 0]}, so it leaves the basis. The pink cell is the pivot.`,
      pivot: `Pivot done: divide the pivot row by the pivot, then clear the rest of the ${nm} column. ${nm} is now basic.`,
      optimal: "No negative entry is left in the z row: no direction improves the objective. This vertex is optimal.",
      unbounded: "No positive entry in the entering column: the objective grows without bound.",
    }[st.kind];
    const last = st.T[m].length - 1;
    const val = (k) => { const r = st.basis.indexOf(k); return r < 0 ? "0" : String(st.T[r][last]); };
    o.basis.textContent = st.basis.map((k) => names[k]).join(", ");
    o.z.textContent = String(st.T[m][last]);
    o.vertex.textContent = `(${val(0)}, ${val(1)})`;
    o.step.textContent = `${i + 1} / ${states.length}`;
  }
  render(0);
}

// ============================================================ branch and bound

const ITEMS = [{ n: "Tent", w: 5, v: 40 }, { n: "Stove", w: 4, v: 30 }, { n: "Camera", w: 6, v: 50 }, { n: "Book", w: 3, v: 10 }, { n: "Food", w: 2, v: 25 }];

for (const root of document.querySelectorAll("[data-optm-bnb]")) {
  const svg = root.querySelector("[data-tree]");
  const list = root.querySelector("[data-items]");
  const o = outs(root);
  let res;
  const s = scrubAll(root, () => { solve(); nav.go(res.nodes.length); });
  const nav = stepper(root, () => res.nodes.length, render);
  root.querySelector("[data-action=all]").addEventListener("click", () => nav.go(res.nodes.length));

  function solve() {
    res = M.knapsackBnB(ITEMS, s.cap.get());
    list.replaceChildren(...res.order.map((it) => {
      const d = document.createElement("div");
      d.className = "flex justify-between gap-2";
      d.textContent = `${it.n.padEnd(7)} ${it.w} kg  ${it.v} pts`;
      const r = document.createElement("span");
      r.className = "text-muted-foreground";
      r.textContent = `${num(it.v / it.w, 2)}/kg`;
      d.append(r);
      return d;
    }));
    // Layout: leaves left to right in creation order, parents centred.
    const kids = res.nodes.map(() => []);
    res.nodes.forEach((n) => n.parent >= 0 && kids[n.parent].push(n.id));
    let leaf = 0;
    const place = (id) => {
      const n = res.nodes[id];
      if (!kids[id].length) n.x = leaf++;
      else { kids[id].forEach(place); n.x = (res.nodes[kids[id][0]].x + res.nodes[kids[id].at(-1)].x) / 2; }
    };
    place(0);
    res.leaves = leaf;
  }

  function render(k) {
    const W = Math.max(720, res.leaves * 86 + 40);
    const depth = Math.max(...res.nodes.map((n) => n.depth)) + 1;
    svg.setAttribute("viewBox", `0 0 ${W} ${depth * 62 + 20}`);
    svg.style.minWidth = `${W}px`; // one SVG unit per pixel: the card scrolls sideways
    svg.replaceChildren();
    const px = (n) => 20 + n.x * 86 + 40, py = (n) => 14 + n.depth * 62;
    const shown = res.nodes.slice(0, k);
    for (const n of shown) if (n.parent >= 0) {
      const p = res.nodes[n.parent];
      el("line", { x1: px(p), y1: py(p) + 34, x2: px(n), y2: py(n), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      text(svg, (px(p) + px(n)) / 2 + (n.x < p.x ? -6 : 6), (py(p) + 34 + py(n)) / 2 + 3, n.label, { "text-anchor": n.x < p.x ? "end" : "start" });
    }
    let bestSoFar = -1;
    for (const n of shown) {
      if (n.fate === "best") bestSoFar = n.v;
      const color = { best: "var(--brand)", infeasible: "var(--code-del)", pruned: "var(--muted-foreground)", leaf: "var(--foreground)", branched: "var(--foreground)" }[n.fate];
      const g = el("g", { opacity: n.fate === "pruned" || n.fate === "infeasible" ? 0.7 : 1 }, svg);
      el("rect", { x: px(n) - 39, y: py(n), width: 78, height: 34, rx: 6, style: `fill:var(--background);stroke:${color};stroke-width:${n.id === k - 1 ? 2.5 : 1.25}px${n.fate === "pruned" ? ";stroke-dasharray:3 3" : ""}` }, g);
      text(g, px(n), py(n) + 14, n.w > 999 ? "" : `${n.v} pts · ${n.w} kg`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      text(g, px(n), py(n) + 27, n.fate === "infeasible" ? "too heavy" : `≤ ${num(n.bound, 1)}`, { "text-anchor": "middle", style: `fill:${color}` });
    }
    const cur = shown.at(-1);
    o.explain.textContent = !cur ? "" : {
      branched: `Bound ${num(cur.bound, 1)} (taking the rest fractionally) beats the best so far, so split on the next item: take it, or leave it.`,
      pruned: `Bound ${num(cur.bound, 1)} cannot beat the best so far (${cur.bestAt}): prune, no need to explore below.`,
      infeasible: `Over capacity (${cur.w} kg > ${s.cap.get()} kg): infeasible.`,
      leaf: `Every item decided: ${cur.v} pts, not better than the best (${cur.bestAt}).`,
      best: `Every item decided: ${cur.v} pts, the new best.`,
    }[cur.fate];
    o.best.textContent = bestSoFar < 0 ? "—" : `${bestSoFar} pts${k === res.nodes.length ? ` (${res.best.pick.map((i) => ITEMS[i].n).join(", ")})` : ""}`;
    o.nodes.textContent = `${k} of ${res.nodes.length} (2⁵ = 32 leaves without pruning)`;
    o.pruned.textContent = String(shown.filter((n) => n.fate === "pruned").length);
    o.step.textContent = `${k} / ${res.nodes.length}`;
  }
  solve();
  nav.go(res.nodes.length);
}

// ============================================================ Lagrange

const LAGRANGE = {
  xy: {
    dom: (c) => ({ x: [0, c * 1.05], y: [0, c * 1.05] }),
    param: (t, c) => [c * (0.01 + 0.98 * t), c * (0.99 - 0.98 * t)],
    f: (x, y) => x * y, gf: (x, y) => [y, x], gg: () => [1, 1],
    goal: "max", levels: (fo) => [0.2, 0.45, 0.7, 1, 1.4].map((k) => k * fo),
    opt: (c) => ({ x: c / 2, y: c / 2, lam: c / 2 }),
  },
  circle: {
    dom: (c) => { const R = Math.sqrt(c) * 1.35; return { x: [-R, R], y: [-R, R] }; },
    param: (t, c) => [Math.sqrt(c) * Math.cos(2 * Math.PI * t), Math.sqrt(c) * Math.sin(2 * Math.PI * t)],
    f: (x, y) => x + 2 * y, gf: () => [1, 2], gg: (x, y) => [2 * x, 2 * y],
    goal: "max", levels: (fo) => [-1, -0.6, -0.2, 0.2, 0.6, 1, 1.4].map((k) => k * fo),
    opt: (c) => ({ x: Math.sqrt(c / 5), y: 2 * Math.sqrt(c / 5), lam: Math.sqrt(5) / (2 * Math.sqrt(c)) }),
  },
  dist: {
    dom: (c) => ({ x: [0, 3.2 * Math.sqrt(c)], y: [0, 3.2 * Math.sqrt(c)] }),
    param: (t, c) => { const x = Math.sqrt(c) * Math.exp(Math.log(0.32) + t * (Math.log(3) - Math.log(0.32))); return [x, c / x]; },
    f: (x, y) => x * x + y * y, gf: (x, y) => [2 * x, 2 * y], gg: (x, y) => [y, x],
    goal: "min", levels: (fo) => [0.5, 1, 1.6, 2.4, 3.4].map((k) => k * fo),
    opt: (c) => ({ x: Math.sqrt(c), y: Math.sqrt(c), lam: 2 }),
  },
};

for (const root of document.querySelectorAll("[data-optm-lagrange]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "xy";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });
  let fr = null;

  // The optimum along the curve: dense sampling, then golden-section search.
  function optimum(P, c) {
    const val = (t) => (P.goal === "max" ? -1 : 1) * P.f(...P.param(t, c));
    let bt = 0;
    for (let i = 0; i <= 2000; i++) if (val(i / 2000) < val(bt)) bt = i / 2000;
    let a = Math.max(0, bt - 0.001), b = Math.min(1, bt + 0.001);
    const r = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 60; k++) {
      const x1 = b - r * (b - a), x2 = a + r * (b - a);
      if (val(x1) < val(x2)) b = x2; else a = x1;
    }
    return (a + b) / 2;
  }

  function draw() {
    const P = LAGRANGE[kind], c = s.c.get(), t = s.t.get();
    const D = P.dom(c);
    svg.replaceChildren();
    const f = frame(svg, { box: [50, 12, 340, 340], x: D.x, y: D.y, xticks: [], yticks: [], xlabel: "x", ylabel: "y" });
    fr = f;
    const g = clipped(svg, f);
    const tOpt = optimum(P, c);
    const [ox, oy] = P.param(tOpt, c);
    const fo = P.f(ox, oy);
    for (const lv of P.levels(fo)) drawContours(g, f, contour(P.f, D.x, D.y, 70, 70, lv), `stroke:var(--brand);stroke-opacity:${Math.abs(lv - fo) < 1e-9 ? 0.9 : 0.3};stroke-width:${Math.abs(lv - fo) < 1e-9 ? 1.5 : 1}px`);
    polyline(g, Array.from({ length: 241 }, (_, i) => P.param(i / 240, c)).map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-width:2px");
    el("circle", { cx: f.sx(ox), cy: f.sy(oy), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2px" }, svg);
    const [x, y] = P.param(t, c);
    const gf = P.gf(x, y), gg = P.gg(x, y);
    // Arrows of equal length in pixels; data and pixel axes share one scale.
    for (const [v, col] of [[gf, "var(--brand)"], [gg, "var(--vec-u)"]]) {
      const n = Math.hypot(...v) || 1;
      arrowPx(svg, f.sx(x), f.sy(y), f.sx(x) + (v[0] / n) * 52, f.sy(y) - (v[1] / n) * 52, col, 2);
    }
    el("circle", { cx: f.sx(x), cy: f.sy(y), r: 6, "data-handle": "", tabindex: 0, role: "slider", "aria-label": "Point on the constraint", class: "cursor-grab outline-none", style: "fill:var(--background);stroke:var(--foreground);stroke-width:2px" }, svg);
    const dot = gf[0] * gg[0] + gf[1] * gg[1];
    const ang = (Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...gf) * Math.hypot(...gg) || 1)))) * 180) / Math.PI;
    const A = P.opt(c);
    o.pt.textContent = `(${num(x, 2)}, ${num(y, 2)})`;
    o.f.textContent = num(P.f(x, y), 3);
    o.ang.textContent = `${num(ang, 1)}°${ang < 0.5 || ang > 179.5 ? " · parallel" : ""}`;
    o.opt.textContent = `(${num(ox, 3)}, ${num(oy, 3)}) · ${P.goal} f = ${num(fo, 3)} (exact (${num(A.x, 3)}, ${num(A.y, 3)}))`;
    o.lam.textContent = `${num(A.lam, 3)} at the optimum`;
  }

  // Drag along the curve: the nearest parameter to the pointer.
  let drag = false;
  const pick = (e) => {
    const P = LAGRANGE[kind], c = s.c.get();
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    let bt = 0, bd = Infinity;
    for (let i = 0; i <= 400; i++) {
      const [x, y] = P.param(i / 400, c);
      const d = Math.hypot(fr.sx(x) - p.x, fr.sy(y) - p.y);
      if (d < bd) { bd = d; bt = i / 400; }
    }
    s.t.set(bt);
  };
  svg.addEventListener("pointerdown", (e) => { drag = true; svg.setPointerCapture(e.pointerId); pick(e); });
  svg.addEventListener("pointermove", (e) => drag && pick(e));
  svg.addEventListener("pointerup", () => (drag = false));
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -0.005, ArrowDown: -0.005, ArrowRight: 0.005, ArrowUp: 0.005 }[e.key];
    if (!d) return;
    e.preventDefault();
    s.t.set(s.t.get() + d * (e.shiftKey ? 10 : 1));
  });
  draw();
}

// ============================================================ Newton vs GD

for (const root of document.querySelectorAll("[data-optm-newton]")) {
  const svg = root.querySelector("[data-plot]");
  const conv = root.querySelector("[data-conv]");
  const o = outs(root);
  let start = [-1.2, 1];
  const s = scrubAll(root, draw);
  const X = [-2, 2], Y = [-1, 3];
  let fr;

  function draw() {
    const opts = { c1: 10 ** s.c1exp.get(), tol: 10 ** s.tolexp.get() };
    const gd = M.lineSearch("gd", start, opts), nt = M.lineSearch("newton", start, opts);
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 10, 430, 340], x: X, y: Y, xticks: [-2, -1, 0, 1, 2], yticks: [-1, 0, 1, 2, 3], xlabel: "x", ylabel: "y", yfmt: (v) => String(v).replace("-", "−"), xfmt: (v) => String(v).replace("-", "−") });
    fr = f;
    const g = clipped(svg, f);
    for (const lv of [0.1, 0.5, 2, 8, 30, 100, 300, 800]) drawContours(g, f, contour(M.rosen.f, X, Y, 110, 110, lv), "stroke:currentColor;stroke-opacity:0.18;stroke-width:1px");
    const step = Math.max(1, Math.floor(gd.path.length / 1500));
    polyline(g, gd.path.filter((_, i) => i % step === 0 || i === gd.path.length - 1).map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--vec-u);stroke-width:1.25px");
    polyline(g, nt.path.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:2px");
    nt.path.forEach(([x, y]) => el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.5, style: "fill:var(--brand)" }, g));
    el("path", { d: `M${f.sx(1) - 5} ${f.sy(1)}h10M${f.sx(1)} ${f.sy(1) - 5}v10`, style: "stroke:var(--foreground);stroke-width:1.5px" }, svg);
    el("circle", { cx: f.sx(start[0]), cy: f.sy(start[1]), r: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2px" }, svg);

    conv.replaceChildren();
    const maxK = Math.max(gd.gnorm.length, nt.gnorm.length);
    const cf = frame(conv, { box: [40, 8, 430, 86], x: [0, Math.log10(maxK + 1)], y: [-7, 4], xticks: [0, 1, 2, 3, 4].filter((v) => v <= Math.log10(maxK + 1)), yticks: [-6, -3, 0, 3], xfmt: (v) => `${10 ** v}`, yfmt: (v) => `1e${v}`.replace("-", "−"), xlabel: "iteration (log)" });
    text(conv, 4, 8, "|∇f|");
    for (const [r, col] of [[gd, "var(--vec-u)"], [nt, "var(--brand)"]]) polyline(conv, r.gnorm.map((v, k) => [cf.sx(Math.log10(k + 1)), cf.sy(Math.max(-7, Math.min(4, Math.log10(v))))]), `stroke:${col};stroke-width:1.5px`);
    const end = (r) => `(${num(r.path.at(-1)[0], 4)}, ${num(r.path.at(-1)[1], 4)})`;
    o.gd.textContent = gd.converged ? String(gd.iters) : `> ${gd.iters} (not converged)`;
    o.nt.textContent = nt.converged ? String(nt.iters) : `> ${nt.iters}`;
    o.gdx.textContent = end(gd);
    o.ntx.textContent = end(nt);
  }
  svg.addEventListener("click", (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = X[0] + ((p.x - fr.L) / fr.W) * (X[1] - X[0]);
    const y = Y[1] - ((p.y - fr.T) / fr.H) * (Y[1] - Y[0]);
    if (x < X[0] || x > X[1] || y < Y[0] || y > Y[1]) return;
    start = [x, y];
    draw();
  });
  draw();
}

// ============================================================ annealing

for (const root of document.querySelectorAll("[data-optm-anneal]")) {
  const svg = root.querySelector("[data-plot]");
  const hist = root.querySelector("[data-hist]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  let seed = 11, cities, tour, best, bestLen, T, moves, history, greedyTour, rng, raf = 0, playing = false, visible = false, showGreedy = false;
  const s = scrubAll(root, () => {});

  function newCities() {
    const r = M.mulberry32(seed);
    cities = Array.from({ length: 25 }, () => [6 + 88 * r(), 6 + 88 * r()]);
    greedyTour = M.greedyTwoOpt(cities);
    reset();
  }
  function reset() {
    rng = M.mulberry32(seed * 7 + 1);
    tour = cities.map((_, i) => i);
    for (let i = tour.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [tour[i], tour[j]] = [tour[j], tour[i]]; }
    best = tour.slice(); bestLen = M.tourLength(cities, tour);
    T = s.t0.get(); moves = 0; history = [[0, bestLen, T]]; showGreedy = false;
    setPlaying(false);
    draw();
  }
  // One batch of 2-opt proposals; the temperature drops every 100.
  function batch(k) {
    const n = tour.length, alpha = s.alpha.get();
    for (let it = 0; it < k; it++) {
      let i = Math.floor(rng() * (n - 1)), j = Math.floor(rng() * n);
      if (i > j) [i, j] = [j, i];
      if (j - i < 2 || (i === 0 && j === n - 1)) continue;
      const d = M.twoOptDelta(cities, tour, i, j);
      if (d < 0 || (T > 0 && rng() < Math.exp(-d / T))) M.reverse(tour, i, j);
      if (++moves % 100 === 0) T *= alpha;
    }
    const len = M.tourLength(cities, tour);
    if (len < bestLen) { bestLen = len; best = tour.slice(); }
    history.push([moves, len, T]);
  }
  const done = () => T < 0.005;
  const loop = () => {
    batch(400);
    draw();
    if (done()) { tour = best.slice(); setPlaying(false); draw(); return; }
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  function setPlaying(p) {
    playing = p;
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Anneal";
    if (p && reduced()) { while (!done()) batch(400); tour = best.slice(); playing = false; setPlaying(false); draw(); return; }
    if (p && visible && !raf) raf = requestAnimationFrame(loop);
    if (!p) { cancelAnimationFrame(raf); raf = 0; }
  }

  function draw() {
    svg.replaceChildren();
    const sx = (x) => 20 + x * 4, sy = (y) => 340 - y * 3.2;
    const shown = showGreedy ? greedyTour : tour;
    el("path", { d: "M" + shown.map((c) => `${sx(cities[c][0]).toFixed(1)} ${sy(cities[c][1]).toFixed(1)}`).join("L") + "Z", style: `fill:none;stroke:${showGreedy ? "var(--vec-u)" : "var(--brand)"};stroke-width:1.75px;stroke-linejoin:round` }, svg);
    cities.forEach(([x, y]) => el("circle", { cx: sx(x), cy: sy(y), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5px" }, svg));
    hist.replaceChildren();
    const maxM = Math.max(1000, moves), maxL = Math.max(...history.map((h) => h[1]));
    const f = frame(hist, { box: [40, 6, 390, 70], x: [0, maxM], y: [0, maxL], xticks: [], yticks: [0, Math.round(maxL)], xlabel: "moves" });
    polyline(hist, history.map(([m, l]) => [f.sx(m), f.sy(l)]), "stroke:var(--brand);stroke-width:1.5px");
    const t0 = s.t0.get() || 1;
    polyline(hist, history.map(([m, , t]) => [f.sx(m), f.sy((t / t0) * maxL)]), "stroke:var(--vec-out);stroke-width:1px;stroke-dasharray:3 3");
    hline(hist, f, M.tourLength(cities, greedyTour), "stroke:var(--vec-u);stroke-opacity:0.7;stroke-dasharray:2 3");
    o.len.textContent = num(M.tourLength(cities, shown), 1);
    o.best.textContent = num(bestLen, 1);
    o.greedy.textContent = num(M.tourLength(cities, greedyTour), 1);
    o.temp.textContent = num(T, 3);
    o.moves.textContent = moves.toLocaleString("en");
  }
  const hline = (svgEl, f, y, style) => el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(y), y2: f.sy(y), style }, svgEl);

  btn.addEventListener("click", () => { if (done()) reset(); showGreedy = false; setPlaying(!playing); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; newCities(); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  root.querySelector("[data-action=greedy]").addEventListener("click", () => { setPlaying(false); showGreedy = true; draw(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(loop); }).observe(root);
  newCities();
}

// ============================================================ budget DP

const PROJECTS = [["Lab", [0, 4, 6, 7, 7]], ["Library", [0, 2, 5, 8, 9]], ["Outreach", [0, 3, 5, 6, 8]]];

for (const root of document.querySelectorAll("[data-optm-dp]")) {
  const box = root.querySelector("[data-table]");
  const o = outs(root);
  let res, cells;
  const s = scrubAll(root, () => { solve(); nav.go(cells.length); });
  const nav = stepper(root, () => cells.length, render);

  function solve() {
    const B = s.budget.get();
    res = M.budgetDP(PROJECTS.map((p) => p[1]), B);
    cells = [];
    for (let k = PROJECTS.length - 1; k >= 0; k--) for (let b = 0; b <= B; b++) cells.push([k, b]);
  }

  function render(at) {
    const B = s.budget.get();
    const done = new Set(cells.slice(0, at).map(([k, b]) => `${k},${b}`));
    const cur = cells[at - 1];
    const table = document.createElement("table");
    table.className = "w-full min-w-[420px] border-collapse font-mono text-xs tabular-nums";
    const head = document.createElement("tr");
    const th = (t, cls) => { const c = document.createElement("th"); c.textContent = t; c.className = cls; return c; };
    head.append(th("projects left · budget →", "py-1.5 pr-3 text-left font-normal text-muted-foreground"));
    for (let b = 0; b <= B; b++) head.append(th(String(b), "py-1.5 px-2 text-right font-normal text-muted-foreground"));
    table.append(head);
    for (let k = PROJECTS.length - 1; k >= 0; k--) {
      const tr = document.createElement("tr");
      tr.className = "border-t";
      const name = document.createElement("td");
      name.className = "py-1.5 pr-3 font-sans text-sm";
      name.textContent = PROJECTS.slice(k).map((p) => p[0]).join(" + ");
      tr.append(name);
      for (let b = 0; b <= B; b++) {
        const td = document.createElement("td");
        const isCur = cur && cur[0] === k && cur[1] === b;
        td.className = `py-1.5 px-2 text-right ${isCur ? "bg-brand/12 text-brand" : ""}`;
        td.textContent = done.has(`${k},${b}`) ? `${res.f[k][b]} · ${res.choice[k][b]}` : "";
        tr.append(td);
      }
      table.append(tr);
    }
    box.replaceChildren(table);
    if (cur) {
      const [k, b] = cur;
      const tries = res.cand[k][b].map(([u, v]) => `${u}→${v}`).join(", ");
      o.explain.textContent = `${PROJECTS[k][0]} with ${b} unit${b === 1 ? "" : "s"} left: try giving it u = 0…${Math.min(b, 4)} (return + best for the rest): ${tries}. Best ${res.f[k][b]} with u = ${res.choice[k][b]}. Cells read "best · units to this project".`;
    } else o.explain.textContent = "Press Next to fill the table, from the last project backwards.";
    o.answer.textContent = at === cells.length ? `Best: ${PROJECTS.map((p, i) => `${p[0]} ${res.plan[i]}`).join(", ")} → total ${res.f[0][B]}` : "";
    o.step.textContent = `${at} / ${cells.length}`;
  }
  solve();
  nav.go(cells.length);
}

// ============================================================ ridge and lasso

for (const root of document.querySelectorAll("[data-optm-reg]")) {
  const svg = root.querySelector("[data-plot]");
  const list = root.querySelector("[data-coefs]");
  const o = outs(root);
  const data = M.regressionData();
  let kind = "lasso";
  const grid = Array.from({ length: 81 }, (_, i) => 1 - i * 0.05); // log10 λ from 1 down to −3
  const paths = { ridge: grid.map((l) => M.ridge(data, 10 ** l)), lasso: [] };
  let warm = null;
  for (const l of grid) { warm = M.lasso(data, 10 ** l, warm); paths.lasso.push(warm.slice()); }
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });

  function draw() {
    const ll = s.loglam.get();
    const b = kind === "ridge" ? M.ridge(data, 10 ** ll) : M.lasso(data, 10 ** ll);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 12, 460, 290], x: [-3, 1], y: [-2.6, 3.4], xticks: [-3, -2, -1, 0, 1], yticks: [-2, 0, 2], xfmt: (v) => String(v).replace("-", "−"), yfmt: (v) => String(v).replace("-", "−"), xlabel: "log₁₀ λ", ylabel: "β" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    for (let j = 0; j < 6; j++) polyline(svg, grid.map((l, i) => [f.sx(l), f.sy(paths[kind][i][j])]), `stroke:${PALETTE[j]};stroke-width:1.75px`);
    el("line", { x1: f.sx(ll), x2: f.sx(ll), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1px;stroke-dasharray:3 3" }, svg);
    list.replaceChildren(...b.map((v, j) => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-[2rem_1fr_3rem_3rem] items-center gap-2";
      const name = document.createElement("span"); name.textContent = `β${j + 1}`; name.style.color = PALETTE[j];
      const bar = document.createElement("div"); bar.className = "relative h-1.5 rounded-full bg-foreground/8";
      const fill = document.createElement("div"); fill.className = "absolute top-0 h-full rounded-full";
      const w = Math.min(50, Math.abs(v) / 3.5 * 50);
      fill.style.cssText = `background:${PALETTE[j]};width:${w}%;left:${v < 0 ? 50 - w : 50}%`;
      bar.append(fill);
      const val = document.createElement("span"); val.className = "text-right tabular-nums"; val.textContent = Math.abs(v) < 1e-12 ? "0" : num(v, 2);
      const tru = document.createElement("span"); tru.className = "text-right text-muted-foreground"; tru.textContent = `(${num(data.beta[j], 1)})`; tru.title = "true value";
      row.append(name, bar, val, tru);
      return row;
    }));
    o.nz.textContent = `${b.filter((v) => Math.abs(v) > 1e-12).length} of 6`;
    o.mse.textContent = num(M.mse(data, b), 3);
  }
  draw();
}

// ============================================================ Pareto

for (const root of document.querySelectorAll("[data-optm-pareto]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 5, pts;
  const s = scrubAll(root, draw);
  const make = () => {
    const r = M.mulberry32(seed);
    pts = Array.from({ length: 40 }, () => {
      const c = 10 + 90 * r();
      return [c, 12 + 700 / c + 40 * r() * r() + (r() < 0.25 ? 25 * r() : 0)];
    });
  };
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; make(); draw(); });

  function draw() {
    const front = M.paretoFront(pts);
    const sup = M.supported(pts, front);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [cx0, cx1, ty0, ty1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const w = s.w.get();
    const score = (p) => w * (p[0] - cx0) / (cx1 - cx0) + (1 - w) * (p[1] - ty0) / (ty1 - ty0);
    const pick = pts.reduce((bi, p, i) => (score(p) < score(pts[bi]) ? i : bi), 0);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 24, 440, 318], x: [0, 105], y: [0, Math.ceil(ty1 / 10) * 10 + 5], xticks: [0, 25, 50, 75, 100], yticks: [0, 25, 50, 75, 100].filter((v) => v < ty1 + 5), xlabel: "cost (k€)", ylabel: "time (days)" });
    const fs = front.slice().sort((a, b) => pts[a][0] - pts[b][0]);
    // Staircase of the front, and the hull through the supported points.
    const stair = [];
    fs.forEach((i, k) => { if (k) stair.push([pts[i][0], pts[fs[k - 1]][1]]); stair.push(pts[i]); });
    polyline(svg, stair.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-opacity:0.4;stroke-width:1px");
    polyline(svg, fs.filter((i) => sup.has(i)).map((i) => [f.sx(pts[i][0]), f.sy(pts[i][1])]), "stroke:var(--brand);stroke-width:1.25px;stroke-dasharray:4 3");
    // The weighted-sum line through the pick: w·c/Δc + (1−w)·t/Δt = const.
    const g = clipped(svg, f);
    const [px, py] = pts[pick];
    const slope = -(w / (cx1 - cx0)) / ((1 - w) / (ty1 - ty0) || 1e-9);
    polyline(g, [[0, py + slope * (0 - px)], [105, py + slope * (105 - px)]].map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1px;stroke-dasharray:2 3");
    pts.forEach((p, i) => {
      const onF = front.includes(i);
      el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: onF ? 4.5 : 3, style: onF ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.25" }, svg);
      if (onF && !sup.has(i)) el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 8, style: "fill:none;stroke:var(--brand);stroke-width:1.25px" }, svg);
    });
    el("circle", { cx: f.sx(px), cy: f.sy(py), r: 9, style: "fill:none;stroke:var(--foreground);stroke-width:2px" }, svg);
    o.front.textContent = `${front.length} of ${pts.length}`;
    o.unsup.textContent = String(front.filter((i) => !sup.has(i)).length);
    o.pick.textContent = `cost ${num(px, 1)}, time ${num(py, 1)}`;
  }
  make();
  draw();
}

// ============================================================ max flow

const NODES = [["s", 40, 170], ["a", 190, 70], ["b", 370, 70], ["c", 190, 270], ["d", 370, 270], ["t", 520, 170]];
const EDGES = [[0, 1, 10], [0, 3, 10], [1, 2, 4], [1, 3, 2], [1, 4, 8], [3, 4, 9], [4, 2, 6], [2, 5, 10], [4, 5, 10]];

for (const root of document.querySelectorAll("[data-optm-flow]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const edges = EDGES.map(([from, to, cap]) => ({ from, to, cap }));
  let sel = -1, res;
  const s = scrubAll(root, (name) => {
    if (name !== "cap" || sel < 0) return;
    edges[sel].cap = s.cap.get();
    solve();
    nav.go(res.steps.length);
  });
  const nav = stepper(root, () => res.steps.length, render);
  const solve = () => (res = M.edmondsKarp(NODES.length, edges, 0, 5));

  function render(k) {
    const flow = k ? res.steps[k - 1].flow : edges.map(() => 0);
    const path = k ? res.steps[k - 1].path : [];
    const final = k === res.steps.length;
    svg.replaceChildren();
    if (final) NODES.forEach(([, x, y], i) => res.S.has(i) && el("circle", { cx: x, cy: y, r: 30, style: "fill:var(--brand);fill-opacity:0.1" }, svg));
    edges.forEach((e, i) => {
      const [, x1, y1] = NODES[e.from], [, x2, y2] = NODES[e.to];
      const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const onPath = path.some((p) => p.e === i);
      const inCut = final && res.cut.includes(i);
      const color = onPath ? "var(--brand)" : inCut ? "var(--code-del)" : "currentColor";
      const g = el("g", { "data-edge": i, class: "cursor-pointer" }, svg);
      el("line", { x1, y1, x2, y2, style: "stroke:transparent;stroke-width:16px" }, g);
      arrowPx(g, x1 + ux * 18, y1 + uy * 18, x2 - ux * 18, y2 - uy * 18, color, 1.5 + (e.cap ? (flow[i] / e.cap) * 4 : 0) + (i === sel ? 1 : 0), 9);
      if (inCut) el("line", { x1: (x1 + x2) / 2 - uy * 12, y1: (y1 + y2) / 2 + ux * 12, x2: (x1 + x2) / 2 + uy * 12, y2: (y1 + y2) / 2 - ux * 12, style: "stroke:var(--code-del);stroke-width:2px" }, g);
      text(g, (x1 + x2) / 2 + uy * 14, (y1 + y2) / 2 - ux * 14 + 3, `${flow[i]}/${e.cap}`, { "text-anchor": "middle", class: `${i === sel ? "fill-brand" : "fill-foreground"} font-mono text-[11px]` });
    });
    NODES.forEach(([nm, x, y]) => {
      el("circle", { cx: x, cy: y, r: 16, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5px" }, svg);
      text(svg, x, y + 4, nm, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    });
    const value = flow.reduce((a, f2, i) => a + (edges[i].from === 0 ? f2 : 0), 0);
    if (!k) o.explain.textContent = "No flow yet. Each step finds the shortest path (fewest edges) with spare capacity, possibly undoing flow on a reverse edge.";
    else if (!final || res.steps.length && k === res.steps.length && path.length) {
      const nodes = [0];
      path.forEach(({ e, dir }) => nodes.push(dir > 0 ? edges[e].to : edges[e].from));
      o.explain.textContent = `Path ${nodes.map((n) => NODES[n][0]).join(" → ")}, bottleneck ${res.steps[k - 1].neck}. Flow is now ${value}.${final ? ` No augmenting path is left: the cut around {${[...res.S].map((n) => NODES[n][0]).join(", ")}} has capacity ${res.cutCap}.` : ""}`;
    }
    o.flow.textContent = String(value);
    o.cut.textContent = final ? `${res.cutCap} (${res.cut.map((i) => `${NODES[edges[i].from][0]}${NODES[edges[i].to][0]}`).join(", ")})` : "—";
    o.paths.textContent = `${k} of ${res.steps.length}`;
    o.step.textContent = `${k} / ${res.steps.length}`;
  }
  svg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-edge]");
    if (!g) return;
    sel = Number(g.dataset.edge);
    const ed = edges[sel];
    o.edge.textContent = `${NODES[ed.from][0]} → ${NODES[ed.to][0]}`;
    s.cap.set(ed.cap, false);
    render(nav.at);
  });
  solve();
  nav.go(res.steps.length);
}
