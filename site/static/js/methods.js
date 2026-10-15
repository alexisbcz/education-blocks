// Research methods blocks: causal diagrams, collider bias, randomization,
// forking paths, multiple testing, publication bias, meta-analysis, the
// winner's curse, reliability and a study planner. The maths lives in
// methods-math.js; this file draws and wires the blocks.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { mulberry32, gauss, normCdf, tCdf, mean } from "./stats-math.js";
import * as M from "./methods-math.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const neg = (s) => String(s).replace("-", "−");
const parseNums = (s) => s.split(/[\s,;]+/).map(Number).filter((v) => Number.isFinite(v));
const pf = (p) => (p < 0.0001 ? "<.0001" : p.toFixed(4));
const clear = (svg) => svg.replaceChildren();

// ============================================================ causal diagrams

const DAGS = {
  confounder: {
    nodes: { X: [120, 220], Y: [440, 220], Z: [280, 70] },
    edges: [["Z", "X"], ["Z", "Y"], ["X", "Y"]],
  },
  mediator: {
    nodes: { X: [100, 160], M: [280, 160], Y: [460, 160] },
    edges: [["X", "M"], ["M", "Y"]],
  },
  collider: {
    nodes: { X: [120, 90], Y: [440, 90], C: [280, 240] },
    edges: [["X", "C"], ["Y", "C"]],
  },
  mbias: {
    nodes: { A: [120, 60], B: [440, 60], M: [280, 150], X: [120, 250], Y: [440, 250] },
    edges: [["A", "X"], ["A", "M"], ["B", "M"], ["B", "Y"], ["X", "Y"]],
  },
  mixed: {
    nodes: { Z: [280, 40], W: [470, 40], X: [90, 155], M: [280, 155], Y: [470, 155], C: [280, 265] },
    edges: [["Z", "X"], ["Z", "Y"], ["X", "M"], ["M", "Y"], ["X", "C"], ["Y", "C"], ["W", "Y"]],
  },
};

for (const root of document.querySelectorAll("[data-meth-dag]")) {
  const svg = root.querySelector("[data-graph]");
  const list = root.querySelector("[data-paths]");
  const chips = root.querySelector("[data-adjust]");
  const o = outs(root);
  let dag = DAGS.confounder;
  let z = new Set();

  root.addEventListener("seg-change", (e) => {
    if (!DAGS[e.detail.value]) return;
    dag = DAGS[e.detail.value];
    z = new Set();
    draw();
  });

  function draw() {
    const names = Object.keys(dag.nodes);
    const all = M.paths(names, dag.edges, "X", "Y").map((p) => ({ p, back: M.isBackdoor(p), b: M.blocked(p, dag.edges, z) }));
    // Edges on an open path are coloured: causal green, backdoor red.
    const edgeStyle = new Map();
    for (const { p, back, b } of all) {
      if (b.blocked) continue;
      for (let i = 1; i < p.length; i++) {
        const [a, c] = p[i].arrowIn ? [p[i - 1].node, p[i].node] : [p[i].node, p[i - 1].node];
        edgeStyle.set(a + c, back ? "var(--code-del)" : "var(--brand)");
      }
    }
    clear(svg);
    const defs = el("defs", {}, svg);
    for (const [id, color] of [["n", "currentColor"], ["r", "var(--code-del)"], ["g", "var(--code-add)"]]) {
      const m = el("marker", { id: `meth-arrow-${id}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0 0 L10 5 L0 10 Z", style: `fill:${color}` }, m);
    }
    for (const [a, b] of dag.edges) {
      const [x1, y1] = dag.nodes[a];
      const [x2, y2] = dag.nodes[b];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const color = edgeStyle.get(a + b);
      const id = color === "var(--code-del)" ? "r" : color === "var(--code-add)" ? "g" : "n";
      el("line", {
        x1: x1 + ux * 26, y1: y1 + uy * 26, x2: x2 - ux * 28, y2: y2 - uy * 28,
        style: `stroke:${color ?? "currentColor"};stroke-opacity:${color ? 1 : 0.45};stroke-width:${color ? 2.25 : 1.5}`,
        "marker-end": `url(#meth-arrow-${id})`,
      }, svg);
    }
    for (const [name, [x, y]] of Object.entries(dag.nodes)) {
      const key = name === "X" || name === "Y";
      const adj = z.has(name);
      const g = el("g", {}, svg);
      if (adj) el("rect", { x: x - 22, y: y - 22, width: 44, height: 44, rx: 6, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, g);
      else el("circle", { cx: x, cy: y, r: 22, style: `fill:var(--background);stroke:${key ? "var(--foreground)" : "currentColor"};stroke-opacity:${key ? 1 : 0.5};stroke-width:${key ? 2 : 1.5}` }, g);
      text(g, x, y + 5, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[15px] font-medium" });
    }

    // Path list, built with textContent only.
    list.replaceChildren();
    for (const { p, back, b } of all) {
      const li = document.createElement("li");
      li.className = "flex flex-wrap items-baseline gap-x-2 rounded-md border px-2 py-1";
      const s = document.createElement("span");
      s.textContent = p.map((st, i) => (i === 0 ? st.node : (st.arrowIn ? " → " : " ← ") + st.node)).join("");
      const tag = document.createElement("span");
      tag.className = b.blocked ? "text-muted-foreground" : back ? "text-del" : "text-add";
      // An open path through a collider is open only because of the adjustment.
      const opened = !b.blocked && p.some((st, i) => i > 0 && i < p.length - 1 && st.arrowIn && !p[i + 1].arrowIn);
      tag.textContent = `${back ? "backdoor" : "non-causal"}`;
      if (!back && !p.some((st, i) => i > 0 && !st.arrowIn)) tag.textContent = "causal";
      tag.textContent += ` · ${b.blocked ? `blocked at ${b.at} (${b.collider ? "collider, not adjusted" : "adjusted"})` : opened ? "open: adjusting a collider opened it" : "open"}`;
      li.append(s, tag);
      list.append(li);
    }
    if (!all.length) list.textContent = "No path connects X and Y.";

    chips.replaceChildren();
    for (const name of Object.keys(dag.nodes).filter((n) => n !== "X" && n !== "Y")) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(z.has(name)));
      b.className = "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand";
      b.textContent = name;
      b.addEventListener("click", () => { z.has(name) ? z.delete(name) : z.add(name); draw(); });
      chips.append(b);
    }

    const openCausal = all.filter((a) => !a.back && !a.b.blocked).length;
    const openBack = all.filter((a) => a.back && !a.b.blocked).length;
    o.open.textContent = `${openCausal} causal, ${openBack} backdoor`;
    const v = M.backdoorOK(Object.keys(dag.nodes), dag.edges, "X", "Y", z);
    o.verdict.textContent = v.ok ? `{${[...z].join(", ")}} is valid` : v.reason;
    o.verdict.className = v.ok ? "tabular-nums text-add" : "tabular-nums text-del";
    o.sets.textContent = M.minimalSets(Object.keys(dag.nodes), dag.edges, "X", "Y").map((s) => `{${[...s].join(", ")}}`).join("  ") || "none";
  }
  draw();
}

// ============================================================ collider bias

for (const root of document.querySelectorAll("[data-meth-collider]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 3, showAll = true, pts = [];
  const make = () => {
    const rng = mulberry32(seed);
    pts = Array.from({ length: 800 }, () => [gauss(rng), gauss(rng)]);
  };
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { showAll = on; draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; make(); draw(); });

  const r = (a) => {
    const mx = mean(a.map((p) => p[0])), my = mean(a.map((p) => p[1]));
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of a) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    return { r: sxy / Math.sqrt(sxx * syy), b: sxy / sxx, mx, my };
  };

  function draw() {
    const keep = s.keep.get() / 100;
    const sums = pts.map((p) => p[0] + p[1]).sort((a, b) => b - a);
    const cut = sums[Math.max(0, Math.min(sums.length - 1, Math.ceil(keep * sums.length) - 1))];
    const sel = pts.filter((p) => p[0] + p[1] >= cut);
    clear(svg);
    const f = frame(svg, { box: [44, 14, 500, 300], x: [-3.5, 3.5], y: [-3.5, 3.5], xticks: [-3, -2, -1, 0, 1, 2, 3], yticks: [-3, 0, 3], xlabel: "talent", ylabel: "looks", xfmt: neg, yfmt: neg });
    if (showAll) for (const [x, y] of pts) if (x + y < cut) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.2, style: "fill:currentColor;fill-opacity:0.18" }, svg);
    for (const [x, y] of sel) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.6, style: "fill:var(--brand);fill-opacity:0.8" }, svg);
    // The selection boundary talent + looks = cut, clipped to the frame.
    const line = (a, b, style) => polyline(svg, [[f.sx(-3.5), f.sy(a + b * -3.5)], [f.sx(3.5), f.sy(a + b * 3.5)]].map(([x, y]) => [x, Math.max(f.T, Math.min(f.T + f.H, y))]), style);
    if (keep < 1) line(cut, -1, "stroke:var(--brand);stroke-dasharray:5 4;stroke-opacity:0.7");
    const all = r(pts), rs = r(sel);
    if (showAll) line(all.my - all.b * all.mx, all.b, "stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5");
    if (sel.length > 2) line(rs.my - rs.b * rs.mx, rs.b, "stroke:var(--brand);stroke-width:2");
    o.rall.textContent = num(all.r, 3);
    o.rsel.textContent = sel.length > 2 ? num(rs.r, 3) : "—";
    o.n.textContent = `${sel.length} of ${pts.length}`;
  }
  make();
  draw();
}

// ============================================================ randomization

for (const root of document.querySelectorAll("[data-meth-rct]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 11;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=rerun]").addEventListener("click", () => { seed++; draw(); });

  // One study: difference in mean outcome between treated and untreated.
  function study(rng, tau, k, n, randomized) {
    let s1 = 0, n1 = 0, s0 = 0, n0 = 0;
    for (let i = 0; i < n; i++) {
      const u = gauss(rng);
      const p = randomized ? 0.5 : 1 / (1 + Math.exp(-k * u));
      const t = rng() < p ? 1 : 0;
      const y = tau * t + 2 * u + gauss(rng);
      t ? ((s1 += y), n1++) : ((s0 += y), n0++);
    }
    return n1 && n0 ? s1 / n1 - s0 / n0 : NaN;
  }

  function draw() {
    const tau = s.effect.get(), k = s.conf.get(), n = Math.round(s.n.get());
    const rng = mulberry32(seed);
    const obs = [], rct = [];
    for (let i = 0; i < 200; i++) {
      obs.push(study(rng, tau, k, n, false));
      rct.push(study(rng, tau, k, n, true));
    }
    const ok = (a) => a.filter(Number.isFinite);
    const all = [...ok(obs), ...ok(rct), tau];
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 + 0.1;
    lo -= pad; hi += pad;
    clear(svg);
    const f = frame(svg, { box: [96, 16, 440, 240], x: [lo, hi], y: [0, 2], xticks: niceTicks(lo, hi), yticks: [], xlabel: "estimated effect", xfmt: (v) => neg(num(v, Math.abs(hi - lo) < 4 ? 1 : 0)) });
    const strip = (vals, y, color, label) => {
      const jr = mulberry32(seed * 7 + y * 100);
      text(svg, 8, f.sy(y) + 4, label, { class: "fill-foreground font-mono text-[11px]" });
      for (const v of ok(vals)) el("circle", { cx: f.sx(v), cy: f.sy(y) + (jr() - 0.5) * 50, r: 2.4, style: `fill:${color};fill-opacity:0.55` }, svg);
      const m = mean(ok(vals));
      el("line", { x1: f.sx(m), x2: f.sx(m), y1: f.sy(y) - 34, y2: f.sy(y) + 34, style: `stroke:${color};stroke-width:2.5` }, svg);
    };
    strip(obs, 1.5, "var(--code-del)", "observational");
    strip(rct, 0.5, "var(--vec-u)", "randomized");
    el("line", { x1: f.sx(tau), x2: f.sx(tau), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-dasharray:4 3" }, svg);
    const mo = mean(ok(obs)), mr = mean(ok(rct));
    o.obs.textContent = neg(num(mo, 3));
    o.obsbias.textContent = neg(num(mo - tau, 3));
    o.rct.textContent = neg(num(mr, 3));
    o.rctbias.textContent = neg(num(mr - tau, 3));
  }
  draw();
}

function niceTicks(a, b, n = 6) {
  const raw = (b - a) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

// ============================================================ forking paths

for (const root of document.querySelectorAll("[data-meth-phack]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const flags = { stop: true, sub: false };
  let seed = 5, result = null, base = null;
  const s = scrubAll(root, () => { result = null; draw(); });
  onToggle(root, (k, on) => { flags[k] = on; result = null; draw(); });
  root.querySelector("[data-action=run]").addEventListener("click", () => { seed++; run(); });

  // Pooled two-sample t-test p-value from running sums.
  const pT = (a, b) => {
    if (a.n < 2 || b.n < 2) return 1;
    const ma = a.s / a.n, mb = b.s / b.n;
    const va = (a.q - a.n * ma * ma), vb = (b.q - b.n * mb * mb);
    const df = a.n + b.n - 2;
    const sp = Math.sqrt(((va + vb) / df) * (1 / a.n + 1 / b.n));
    if (!(sp > 0)) return 1;
    const t = Math.abs(ma - mb) / sp;
    return 2 * (1 - tCdf(t, df));
  };

  function simulate(studies, k, n, stop, sub, rng) {
    let hits = 0;
    const max = stop ? 2 * n : n;
    for (let st = 0; st < studies; st++) {
      // Shared subgroup labels (e.g. a coin for each participant).
      const label = Array.from({ length: 2 * max }, () => rng() < 0.5 ? 0 : 1);
      let found = false;
      for (let j = 0; j < k && !found; j++) {
        const g = [[], []];
        for (let i = 0; i < max; i++) { g[0].push(gauss(rng)); g[1].push(gauss(rng)); }
        for (let m = n; m <= max && !found; m += 10) {
          const acc = (arr, filt) => {
            const r = { s: 0, q: 0, n: 0 };
            for (let i = 0; i < m; i++) if (filt(i)) { r.s += arr[i]; r.q += arr[i] * arr[i]; r.n++; }
            return r;
          };
          if (pT(acc(g[0], () => true), acc(g[1], () => true)) < 0.05) { found = true; break; }
          if (sub) {
            for (const lab of [0, 1]) {
              if (pT(acc(g[0], (i) => label[i] === lab), acc(g[1], (i) => label[max + i] === lab)) < 0.05) { found = true; break; }
            }
          }
          if (!stop) break;
        }
      }
      if (found) hits++;
    }
    return hits / studies;
  }

  function run() {
    const k = Math.round(s.k.get()), n = Math.round(s.n.get());
    const rng = mulberry32(seed);
    base = simulate(2000, 1, n, false, false, rng);
    result = { fp: simulate(2000, k, n, flags.stop, flags.sub, rng), k, n };
    draw();
  }

  function draw() {
    const k = Math.round(s.k.get());
    clear(svg);
    // Left: the two simulated rates; right: 1 − 0.95^k for independent outcomes.
    const f = frame(svg, { box: [44, 16, 210, 240], x: [0, 2], y: [0, 1], yticks: [0, 0.25, 0.5, 0.75, 1], xticks: [], yfmt: (v) => `${Math.round(v * 100)}%`, ylabel: "false-positive rate" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0.05), y2: f.sy(0.05), style: "stroke:currentColor;stroke-dasharray:3 3;stroke-opacity:0.6" }, svg);
    text(svg, f.L + f.W, f.sy(0.05) - 4, "5%", { "text-anchor": "end" });
    const bars = [["no hacking", base, "currentColor"], ["your analysis", result?.fp, "var(--brand)"]];
    bars.forEach(([lab, v, color], i) => {
      const x = f.sx(i + 0.2), w = f.sx(i + 0.8) - x;
      if (v != null) {
        el("rect", { x, y: f.sy(v), width: w, height: f.T + f.H - f.sy(v), rx: 3, style: `fill:${color};fill-opacity:${i ? 0.85 : 0.3}` }, svg);
        text(svg, x + w / 2, f.sy(v) - 5, `${num(v * 100, 1)}%`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      }
      text(svg, x + w / 2, f.T + f.H + 14, lab, { "text-anchor": "middle" });
    });
    const g = frame(svg, { box: [320, 16, 220, 240], x: [1, 20], y: [0, 1], xticks: [1, 5, 10, 15, 20], yticks: [], xlabel: "independent outcomes", xfmt: String });
    polyline(svg, Array.from({ length: 20 }, (_, i) => [g.sx(i + 1), g.sy(1 - 0.95 ** (i + 1))]), "stroke:var(--vec-u);stroke-width:2");
    el("circle", { cx: g.sx(k), cy: g.sy(1 - 0.95 ** k), r: 4.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
    text(svg, g.L + 4, g.T + 10, "1 − 0.95ᵏ", { class: "fill-muted-foreground font-mono text-[10px]" });

    o.fp.textContent = result ? `${num(result.fp * 100, 1)}%` : "press Run";
    o.base.textContent = base != null ? `${num(base * 100, 1)}%` : "—";
    o.analytic.textContent = `${num((1 - 0.95 ** k) * 100, 1)}%`;
    o.runs.textContent = result ? "2,000 + 2,000" : "—";
  }
  run();
}

// ============================================================ multiple comparisons

for (const root of document.querySelectorAll("[data-meth-multiple]")) {
  const input = root.querySelector('[data-input="p"]');
  const svg = root.querySelector("[data-plot]");
  const tbody = root.querySelector("[data-rows]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  input.addEventListener("input", draw);

  function draw() {
    const ps = parseNums(input.value).filter((p) => p >= 0 && p <= 1);
    const q = s.q.get();
    o["p-hint"].textContent = ps.length ? `${ps.length} p-values read.` : "Enter p-values between 0 and 1.";
    tbody.replaceChildren();
    clear(svg);
    if (!ps.length) { for (const k of ["m", "bonf", "holm", "bh"]) o[k].textContent = "—"; return; }
    const adj = M.adjust(ps);
    const m = ps.length;
    const order = ps.map((p, i) => i).sort((a, b) => ps[a] - ps[b]);
    order.forEach((i, rank) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-dashed last:border-0";
      const cell = (v, rej) => {
        const td = document.createElement("td");
        td.className = "py-1 pr-2";
        if (rej === undefined) td.textContent = v;
        else {
          const dot = document.createElement("span");
          dot.className = `mr-1.5 inline-block size-2 rounded-full ${rej ? "bg-brand" : "border border-foreground/30"}`;
          td.append(dot, document.createTextNode(v));
        }
        return td;
      };
      tr.append(cell(String(rank + 1)), cell(pf(ps[i])), cell(pf(adj.bonf[i]), adj.bonf[i] <= q), cell(pf(adj.holm[i]), adj.holm[i] <= q), cell(pf(adj.bh[i]), adj.bh[i] <= q));
      tbody.append(tr);
    });
    o.m.textContent = String(m);
    o.bonf.textContent = `${adj.bonf.filter((p) => p <= q).length}  (p ≤ ${num(q / m, 5)})`;
    o.holm.textContent = String(adj.holm.filter((p) => p <= q).length);
    o.bh.textContent = String(adj.bh.filter((p) => p <= q).length);

    const top = Math.max(q * 1.15, ...ps) * 1.05;
    const f = frame(svg, { box: [44, 14, 360, 196], x: [0.5, m + 0.5], y: [0, top], xticks: m <= 20 ? order.map((_, k) => k + 1) : [1, m], yticks: [0, q, top].map((v) => +v.toPrecision(2)), xlabel: "rank", ylabel: "p", yfmt: (v) => String(v) });
    polyline(svg, [[f.sx(0.5), f.sy((0.5 * q) / m)], [f.sx(m + 0.5), f.sy(((m + 0.5) * q) / m)]], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 3");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(q / m), y2: f.sy(q / m), style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:2 3" }, svg);
    order.forEach((i, k) => {
      const rej = adj.bh[i] <= q;
      el("circle", { cx: f.sx(k + 1), cy: f.sy(ps[i]), r: 4, style: rej ? "fill:var(--brand)" : "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    });
  }
  draw();
}

// ============================================================ publication bias

for (const root of document.querySelectorAll("[data-meth-funnel]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 13, drawer = true; // a representative draw: pooled-all ≈ the truth
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { drawer = on; draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const delta = s.delta.get(), k = Math.round(s.k.get());
    const rng = mulberry32(seed);
    const studies = Array.from({ length: k }, () => {
      const n = Math.round(Math.exp(Math.log(10) + rng() * (Math.log(200) - Math.log(10))));
      const se = Math.sqrt(2 / n);
      const d = delta + se * gauss(rng);
      const sig = d / se > 1.959964;
      const coin = rng();
      return { d, se, pub: !drawer || sig || coin < 0.1 };
    });
    const pub = studies.filter((x) => x.pub);
    const pool = (arr) => (arr.length ? M.meta(arr.map((x) => x.d), arr.map((x) => x.se)).fe : NaN);
    const pAll = pool(studies), pPub = pool(pub);
    // Egger: regress d/se on 1/se among published studies.
    let egger = NaN;
    if (pub.length > 2) {
      const xs = pub.map((x) => 1 / x.se), ys = pub.map((x) => x.d / x.se);
      const mx = mean(xs), my = mean(ys);
      let sxy = 0, sxx = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      egger = my - (sxy / sxx) * mx;
    }
    clear(svg);
    const seMax = Math.sqrt(2 / 10) * 1.05;
    const f = frame(svg, { box: [52, 16, 490, 290], x: [-1.2, 1.8], y: [seMax, 0], xticks: [-1, -0.5, 0, 0.5, 1, 1.5], yticks: [0, 0.1, 0.2, 0.3, 0.4], xlabel: "effect size d", ylabel: "standard error", xfmt: (v) => neg(String(v)), yfmt: String });
    const centre = Number.isFinite(pPub) ? pPub : delta;
    polyline(svg, [[f.sx(centre - 1.96 * seMax), f.sy(seMax)], [f.sx(centre), f.sy(0)], [f.sx(centre + 1.96 * seMax), f.sy(seMax)]], "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 3");
    // The significance boundary d = 1.96·SE: studies right of it are significant.
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(1.96 * seMax), f.sy(seMax)]], "stroke:var(--code-add);stroke-opacity:0.5;stroke-width:1");
    for (const x of studies) {
      el("circle", { cx: f.sx(Math.max(-1.2, Math.min(1.8, x.d))), cy: f.sy(x.se), r: 3.2, style: x.pub ? "fill:var(--foreground);fill-opacity:0.85" : "fill:none;stroke:currentColor;stroke-opacity:0.3" }, svg);
    }
    const vline = (v, color, dash) => el("line", { x1: f.sx(v), x2: f.sx(v), y1: f.T, y2: f.T + f.H, style: `stroke:${color};stroke-width:2${dash ? ";stroke-dasharray:4 3" : ""}` }, svg);
    vline(delta, "var(--vec-u)", true);
    if (Number.isFinite(pPub)) vline(pPub, "var(--brand)");
    text(svg, f.sx(1.96 * seMax) - 4, f.sy(seMax) - 6, "p = .05", { "text-anchor": "end", style: "fill:var(--code-add)" });
    o.pub.textContent = `${pub.length} of ${k}`;
    o.all.textContent = neg(num(pAll, 3));
    o.published.textContent = neg(num(pPub, 3));
    o.egger.textContent = Number.isFinite(egger) ? neg(num(egger, 2)) : "—";
  }
  draw();
}

// ============================================================ meta-analysis

for (const root of document.querySelectorAll("[data-meth-meta]")) {
  const svg = root.querySelector("[data-plot]");
  const input = root.querySelector('[data-input="studies"]');
  const o = outs(root);
  input.addEventListener("input", draw);

  function parse() {
    const rows = [], bad = [];
    input.value.split("\n").forEach((line, i) => {
      if (!line.trim()) return;
      const parts = line.split(",").map((s) => s.trim());
      const se = Number(parts.at(-1)), y = Number(parts.at(-2));
      const name = parts.slice(0, -2).join(", ") || `Study ${i + 1}`;
      if (parts.length >= 3 && Number.isFinite(y) && se > 0) rows.push({ name, y, se });
      else bad.push(i + 1);
    });
    return { rows, bad };
  }

  function draw() {
    const { rows, bad } = parse();
    o["studies-hint"].textContent = bad.length ? `Couldn't read line${bad.length > 1 ? "s" : ""} ${bad.join(", ")}: use name, effect, SE.` : `${rows.length} studies. Illustrative numbers.`;
    clear(svg);
    if (rows.length < 2) { for (const k of ["fe", "re", "q", "i2", "tau2"]) o[k].textContent = "—"; return; }
    const r = M.meta(rows.map((x) => x.y), rows.map((x) => x.se));
    const lo = Math.min(...rows.map((x) => x.y - 1.96 * x.se), r.re - 1.96 * r.reSE, 0);
    const hi = Math.max(...rows.map((x) => x.y + 1.96 * x.se), r.re + 1.96 * r.reSE, 0);
    const pad = (hi - lo) * 0.06;
    const H = 320, rowH = Math.min(30, (H - 90) / (rows.length + 2));
    svg.setAttribute("viewBox", `0 0 600 ${Math.max(200, 50 + rowH * (rows.length + 3) + 30)}`);
    const L = 150, W = 300;
    const sx = (v) => L + ((v - (lo - pad)) / (hi + pad - (lo - pad))) * W;
    const bottom = 30 + rowH * (rows.length + 2.6);
    el("line", { x1: sx(0), x2: sx(0), y1: 22, y2: bottom, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    for (const t of niceTicks(lo - pad, hi + pad, 5)) text(svg, sx(t), bottom + 14, neg(String(t)), { "text-anchor": "middle" });
    text(svg, 8, 14, "study", { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, 592, 14, "effect [95% CI]  weight", { "text-anchor": "end" });
    const maxW = Math.max(...r.w);
    const sumW = r.w.reduce((a, b) => a + b, 0);
    rows.forEach((x, i) => {
      const y = 34 + rowH * i;
      text(svg, 8, y + 4, x.name.length > 22 ? x.name.slice(0, 21) + "…" : x.name, { class: "fill-foreground font-mono text-[11px]" });
      el("line", { x1: sx(x.y - 1.96 * x.se), x2: sx(x.y + 1.96 * x.se), y1: y, y2: y, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
      const side = 4 + 9 * Math.sqrt(r.w[i] / maxW);
      el("rect", { x: sx(x.y) - side / 2, y: y - side / 2, width: side, height: side, style: "fill:var(--foreground)" }, svg);
      text(svg, 592, y + 4, `${neg(num(x.y, 2))} [${neg(num(x.y - 1.96 * x.se, 2))}, ${neg(num(x.y + 1.96 * x.se, 2))}]  ${num((100 * r.w[i]) / sumW, 1)}%`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    });
    const diamond = (est, se, y, color, label) => {
      const a = sx(est - 1.96 * se), b = sx(est + 1.96 * se), c = sx(est);
      el("path", { d: `M${a} ${y} L${c} ${y - 7} L${b} ${y} L${c} ${y + 7} Z`, style: `fill:${color}` }, svg);
      text(svg, 8, y + 4, label, { class: "fill-foreground font-mono text-[11px] font-medium" });
      text(svg, 592, y + 4, `${neg(num(est, 3))} [${neg(num(est - 1.96 * se, 3))}, ${neg(num(est + 1.96 * se, 3))}]`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    };
    diamond(r.fe, r.feSE, 34 + rowH * (rows.length + 0.6), "var(--vec-u)", "Fixed effect");
    diamond(r.re, r.reSE, 34 + rowH * (rows.length + 1.6), "var(--brand)", "Random effects");
    const ci = (e, se) => `${neg(num(e, 3))} ± ${num(1.96 * se, 3)}`;
    o.fe.textContent = ci(r.fe, r.feSE);
    o.re.textContent = ci(r.re, r.reSE);
    o.q.textContent = `${num(r.Q, 2)} (${r.df})`;
    o.i2.textContent = `${num(r.I2 * 100, 1)}%`;
    o.tau2.textContent = num(r.tau2, 4);
  }
  draw();
}

// ============================================================ winner's curse

for (const root of document.querySelectorAll("[data-meth-winners]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 9;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const d = s.d.get(), n = Math.round(s.n.get());
    const se = Math.sqrt(2 / n), c = 1.959964;
    const rng = mulberry32(seed);
    const est = Array.from({ length: 5000 }, () => d + se * gauss(rng));
    const sig = est.filter((x) => Math.abs(x / se) > c);
    const power = 1 - normCdf(c - d / se) + normCdf(-c - d / se);
    const lo = d - 4.2 * se, hi = d + 4.2 * se;
    const B = 60, bw = (hi - lo) / B;
    const hs = new Array(B).fill(0), hn = new Array(B).fill(0);
    for (const x of est) {
      const b = Math.floor((x - lo) / bw);
      if (b < 0 || b >= B) continue;
      Math.abs(x / se) > c ? hs[b]++ : hn[b]++;
    }
    const top = Math.max(...hs.map((v, i) => v + hn[i]));
    clear(svg);
    const f = frame(svg, { box: [44, 16, 500, 240], x: [lo, hi], y: [0, top * 1.05], xticks: niceTicks(lo, hi), yticks: [], xlabel: "estimated d", xfmt: (v) => neg(String(+v.toFixed(2))) });
    for (let i = 0; i < B; i++) {
      const x = f.sx(lo + i * bw) + 0.5, w = f.sx(lo + bw) - f.sx(lo) - 1;
      el("rect", { x, y: f.sy(hn[i]), width: w, height: f.T + f.H - f.sy(hn[i]), style: "fill:currentColor;fill-opacity:0.22" }, svg);
      el("rect", { x, y: f.sy(hn[i] + hs[i]), width: w, height: f.sy(hn[i]) - f.sy(hn[i] + hs[i]), style: "fill:var(--brand);fill-opacity:0.85" }, svg);
    }
    el("line", { x1: f.sx(d), x2: f.sx(d), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:4 3" }, svg);
    const pos = sig.filter((x) => x > 0);
    const msig = sig.length ? mean(sig.map(Math.abs)) : NaN;
    if (pos.length) {
      const m = mean(pos);
      el("line", { x1: f.sx(m), x2: f.sx(m), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, f.sx(m) + 4, f.T + 12, "mean of significant", { style: "fill:var(--brand)" });
    }
    o.power.textContent = `${num(power * 100, 1)}%`;
    o.sig.textContent = `${sig.length} of 5,000`;
    o.msig.textContent = sig.length ? num(msig, 3) : "—";
    o["type-m"].textContent = sig.length ? `×${num(msig / d, 2)}` : "—";
    o["type-s"].textContent = sig.length ? `${num((100 * sig.filter((x) => x < 0).length) / sig.length, 1)}%` : "—";
  }
  draw();
}

// ============================================================ reliability

for (const root of document.querySelectorAll("[data-meth-reliability]")) {
  const input = root.querySelector('[data-input="items"]');
  const tbody = root.querySelector("[data-rows]");
  const targets = root.querySelector("[data-targets]");
  const o = outs(root);
  let seed = 4;
  input.addEventListener("input", compute);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; shoot(); });

  function compute() {
    const lines = input.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/).map(Number));
    const k = lines[0]?.length ?? 0;
    const ok = lines.length >= 3 && k >= 2 && lines.every((r) => r.length === k && r.every(Number.isFinite));
    tbody.replaceChildren();
    if (!ok) {
      o["items-hint"].textContent = "Need at least 3 people and 2 items, the same number of numbers on every line.";
      o.shape.textContent = o.alpha.textContent = "—";
      return;
    }
    o["items-hint"].textContent = "Illustrative 1–5 answers to a 5-item scale; item 5 was meant to be reverse-coded and wasn't.";
    const c = M.cronbach(lines);
    const items = M.itemAnalysis(lines);
    items.forEach((it, j) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-dashed last:border-0";
      const better = it.alphaWithout > c.alpha + 0.01;
      for (const [v, cls] of [[`#${j + 1}`, ""], [num(c.itemVar[j], 2), ""], [neg(num(it.r, 2)), it.r < 0.2 ? "text-del" : ""], [Number.isFinite(it.alphaWithout) ? neg(num(it.alphaWithout, 3)) : "—", better ? "text-brand font-medium" : ""]]) {
        const td = document.createElement("td");
        td.className = `py-1 pr-2 ${cls}`;
        td.textContent = v;
        tr.append(td);
      }
      tbody.append(tr);
    });
    o.shape.textContent = `${lines.length} × ${k}`;
    o.alpha.textContent = neg(num(c.alpha, 3));
  }

  function shoot() {
    clear(targets);
    const rng = mulberry32(seed);
    const cases = [
      ["reliable, valid", 0.08, [0, 0]],
      ["reliable, not valid", 0.08, [0.45, -0.35]],
      ["valid, not reliable", 0.32, [0, 0]],
      ["neither", 0.32, [0.4, 0.3]],
    ];
    cases.forEach(([label, spread, [ox, oy]], i) => {
      const cx = 100 + (i % 2) * 200, cy = 95 + Math.floor(i / 2) * 200, R = 70;
      for (const k of [1, 0.66, 0.33]) el("circle", { cx, cy, r: R * k, style: "fill:none;stroke:currentColor;stroke-opacity:0.3" }, targets);
      el("circle", { cx, cy, r: 3, style: "fill:currentColor;fill-opacity:0.5" }, targets);
      for (let s = 0; s < 12; s++) {
        const x = cx + R * (ox + spread * gauss(rng)), y = cy + R * (oy + spread * gauss(rng));
        el("circle", { cx: x, cy: y, r: 3.6, style: "fill:var(--brand);fill-opacity:0.85" }, targets);
      }
      text(targets, cx, cy + R + 18, label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    });
  }
  compute();
  shoot();
}

// ============================================================ study planner

for (const root of document.querySelectorAll("[data-meth-planner]")) {
  const o = outs(root);
  const md = root.querySelector("[data-markdown]");
  const copy = root.querySelector("[data-copy-host] [data-copy]");
  const checks = [...root.querySelectorAll('[data-slot="checkbox"]')];
  const val = (name) => root.querySelector(`[data-input="${name}"]`).value.trim();
  let design = "two", size = null;
  const s = scrubAll(root, () => { size = null; render(); });
  root.addEventListener("seg-change", (e) => { if (e.detail.value === "two" || e.detail.value === "paired") { design = e.detail.value; size = null; render(); } });
  root.querySelectorAll("[data-input]").forEach((i) => i.addEventListener("input", render));
  new MutationObserver(render).observe(root, { subtree: true, attributes: true, attributeFilter: ["data-state"] });

  function render() {
    const d = s.d.get(), alpha = s.alpha.get(), power = s.power.get(), attr = s.attrition.get() / 100;
    if (!size) size = M.sampleSize(d, alpha, power, design);
    const per = design === "two" ? "per group" : "pairs";
    const total = design === "two" ? 2 * size.exact : size.exact;
    const recruit = Math.ceil(total / (1 - attr));
    o.nexact.textContent = `${size.exact} ${per}`;
    o.napprox.textContent = `${size.approx} ${per}`;
    o.recruit.textContent = `${recruit} people`;
    o.achieved.textContent = `${num(size.achieved * 100, 1)}%`;
    const done = checks.filter((c) => c.dataset.state === "checked");
    o.done.textContent = `${done.length} / ${checks.length}`;
    const lines = [
      `# ${val("title") || "Untitled study"}`,
      "",
      "## Hypothesis",
      val("hypothesis") || "_Not written yet._",
      "",
      "## Primary outcome",
      val("outcome") || "_Not named yet._",
      "",
      "## Design and sample size",
      `- Design: ${design === "two" ? "two independent groups" : "paired (within-subject)"}`,
      `- Smallest effect of interest: d = ${d}`,
      `- α = ${alpha} (two-sided), power = ${power}`,
      `- n = ${size.exact} ${per} (exact noncentral t; normal approximation ${size.approx})`,
      `- Recruit ${recruit} people to allow for ${Math.round(attr * 100)}% attrition`,
      "",
      "## Checklist",
      ...checks.map((c) => `- [${c.dataset.state === "checked" ? "x" : " "}] ${c.dataset.check}`),
    ];
    const text = lines.join("\n");
    md.textContent = text;
    copy?.setAttribute("data-copy", text);
  }
  render();
}
