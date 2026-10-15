// Phylogenetics blocks, part one: UPGMA against neighbour joining, Fitch
// parsimony over all 15 five-taxon trees, long-branch attraction, the
// Jukes–Cantor correction and root-to-tip dating. phylo-pop.js holds the
// population-genetics blocks, phylo-trees.js tree reading and the
// bootstrap; phylo-core.js the shared code.

import { scrubAll } from "./scrub.js";
import {
  el, text, frame, polyline, num, neg, outs, onAction, reduced, setPlaying, whenVisible, niceTicks, tickFmt, chunked,
  mulberry32, gauss, rootAt, tips, splitsOf, sameSplits, upgma, nj, patristic, BASES, jcP, jcD, simulate, jcMatrix,
  fitch, allTrees, layout, drawBranches, drawTips,
} from "./phylo-core.js";

const NAMES5 = ["A", "B", "C", "D", "E"];

// ============================================================ UPGMA vs NJ

// Unequal rates: B and E evolve fast, so UPGMA pulls them together.
const RATES_TREE = { n: 5, edges: [[0, 5, 2], [1, 5, 9], [5, 6, 1], [6, 7, 1], [7, 2, 2], [7, 3, 2], [6, 4, 6]] };
// Clock-like: every tip the same distance from the root (node 9).
const CLOCK_TREE = { n: 5, edges: [[0, 5, 2], [1, 5, 2], [5, 9, 3], [9, 6, 2], [6, 2, 3], [6, 7, 1.5], [7, 3, 1.5], [7, 4, 1.5]] };

for (const root of document.querySelectorAll("[data-phylo-dist]")) {
  const o = outs(root);
  const svgs = { truth: root.querySelector("[data-truth]"), upgma: root.querySelector("[data-upgma]"), nj: root.querySelector("[data-nj]") };
  const log = root.querySelector("[data-log]");
  const cells = [...root.querySelectorAll("[data-cell]")];
  let D = null, truth = null, shown = Infinity, res = null;

  function load(name) {
    truth = name === "clock" ? CLOCK_TREE : RATES_TREE;
    D = patristic(truth).map((r) => r.map((v) => +v.toFixed(3)));
    for (const c of cells) {
      const [i, j] = c.dataset.cell.split("-").map(Number);
      c.value = String(D[i][j]);
      c.removeAttribute("aria-invalid");
    }
    shown = Infinity;
    compute();
  }

  for (const c of cells)
    c.addEventListener("change", () => {
      const v = parseFloat(c.value.replace(",", ".").replace("−", "-"));
      if (!(v >= 0)) { c.setAttribute("aria-invalid", "true"); return; }
      c.removeAttribute("aria-invalid");
      const [i, j] = c.dataset.cell.split("-").map(Number);
      D[i][j] = D[j][i] = v;
      truth = null;
      shown = Infinity;
      compute();
    });

  root.addEventListener("seg-change", (e) => load(e.detail.value));
  onAction(root, (act) => {
    const total = res.u.steps.length;
    if (act === "step") shown = shown >= total ? 1 : shown + 1;
    else if (act === "all") shown = Infinity;
    else if (act === "reset") shown = 0;
    draw();
  });

  function compute() {
    res = { u: upgma(D), n: nj(D) };
    res.uSplits = splitsOf(res.u.tree, 5);
    res.nRooted = rootAt(res.n.g, 0);
    res.nSplits = splitsOf(res.nRooted, 5);
    const P = patristic(res.n.g);
    let fit = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) fit = Math.max(fit, Math.abs(P[i][j] - D[i][j]));
    res.fit = fit;
    draw();
  }

  function treeSvg(svg, tree, hi, opts = {}) {
    svg.replaceChildren();
    const { leaves } = layout(tree, { x: 12, y: 16, w: 170, h: 138, ...opts });
    drawBranches(svg, tree);
    for (const l of leaves) {
      const on = hi.has(l.id);
      text(svg, l.x + 5, l.y + 4, NAMES5[l.id], { class: (on ? "fill-[var(--brand)] font-semibold" : "fill-foreground") + " font-mono text-[12px]" });
    }
  }

  function draw() {
    const total = res.u.steps.length;
    const k = Math.min(shown, total);
    const cur = k > 0 && k <= total && shown !== Infinity ? k - 1 : -1;
    const hiU = new Set(cur >= 0 ? [...res.u.steps[cur].a, ...res.u.steps[cur].b] : []);
    const hiN = new Set(cur >= 0 && res.n.steps[cur] ? [...res.n.steps[cur].a, ...res.n.steps[cur].b] : []);
    if (truth) treeSvg(svgs.truth, rootAt(truth, 0), new Set());
    else {
      svgs.truth.replaceChildren();
      text(svgs.truth, 110, 85, "edited by hand: no true tree", { "text-anchor": "middle" });
    }
    if (k >= total) {
      treeSvg(svgs.upgma, res.u.tree, hiU);
      treeSvg(svgs.nj, res.nRooted, hiN);
    } else {
      for (const s of [svgs.upgma, svgs.nj]) {
        s.replaceChildren();
        text(s, 110, 85, k === 0 ? "press Step" : `step ${k} of ${total}`, { "text-anchor": "middle" });
      }
    }
    // The log of joins so far.
    log.replaceChildren();
    for (let i = 0; i < Math.min(k, total); i++) {
      const u = res.u.steps[i], n = res.n.steps[i];
      const li = document.createElement("li");
      li.className = i === cur ? "text-foreground" : "";
      const nm = (ids) => ids.map((x) => NAMES5[x]).join("");
      li.textContent = `${i + 1}. UPGMA joins ${nm(u.a)} + ${nm(u.b)} at height ${num(u.h, 2)}` +
        (n ? ` · NJ joins ${nm(n.a)} + ${nm(n.b)} (Q = ${neg(num(n.q, 1))})` : i === res.n.steps.length ? " · NJ: the last three meet at one node" : "");
      log.append(li);
    }
    for (const m of root.querySelectorAll("[data-mirror]")) {
      const [i, j] = m.dataset.mirror.split("-").map(Number);
      m.textContent = i === j ? "·" : String(+D[i][j].toFixed(3));
    }
    o.ultra.textContent = ultrametric(D) ? "yes" : "no";
    o.additive.textContent = additive(D) ? "yes" : "no";
    if (truth) {
      const t = splitsOf(rootAt(truth, 0), 5);
      o.upgmaok.textContent = sameSplits(res.uSplits, t) ? "correct" : "wrong";
      o.njok.textContent = sameSplits(res.nSplits, t) ? "correct" : "wrong";
    } else {
      o.upgmaok.textContent = sameSplits(res.uSplits, res.nSplits) ? "same as NJ" : "differs from NJ";
      o.njok.textContent = "no true tree";
    }
    o.upgmaok.style.color = o.upgmaok.textContent === "wrong" ? "var(--code-del)" : "";
    o.fit.textContent = res.fit < 1e-9 ? "0 (exact)" : num(res.fit, 3);
  }

  load("rates");
}

/** Three-point condition: in every triple the two largest distances are equal. */
function ultrametric(D) {
  const n = D.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const s = [D[i][j], D[i][k], D[j][k]].sort((a, b) => a - b);
        if (Math.abs(s[2] - s[1]) > 1e-9) return false;
      }
  return true;
}

/** Four-point condition: in every quartet the two largest pair sums are equal. */
function additive(D) {
  const n = D.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const s = [D[a][b] + D[c][d], D[a][c] + D[b][d], D[a][d] + D[b][c]].sort((x, y) => x - y);
          if (Math.abs(s[2] - s[1]) > 1e-9) return false;
        }
  return true;
}

// ============================================================ Fitch parsimony

const TAXA = ["Lungfish", "Frog", "Lizard", "Pigeon", "Mouse"];
// Synthetic sites: most support (Lizard, Pigeon) and (Lizard, Pigeon, Mouse);
// a few conflict, as real characters do.
const EXAMPLE = ["ACGTACGTACGA", "ACGTATGTGCGC", "ATACAGATATAG", "ATAGAGGCGTCT", "ATGCGCACGTCA"];
const BIT = { A: 1, C: 2, G: 4, T: 8 };

for (const root of document.querySelectorAll("[data-phylo-fitch]")) {
  const o = outs(root);
  const alignBox = root.querySelector("[data-align]"), thumbs = root.querySelector("[data-thumbs]"), big = root.querySelector("[data-big]");
  const trees = allTrees(5).map((g) => ({ g, rooted: rootAt(g, 0) }));
  const rng = mulberry32(7);
  let seqs = EXAMPLE.map((s) => s.split("")), sel = 0, site = 6;

  onAction(root, (act) => {
    if (act === "example") seqs = EXAMPLE.map((s) => s.split(""));
    else if (act === "random") {
      const t = trees[Math.floor(rng() * 15)].g;
      const g = { n: 5, edges: t.edges.map(([u, v]) => [u, v, 0.08 + 0.3 * rng()]) };
      seqs = simulate(rng, rootAt(g, 0), 12).map((s) => s.map((b) => BASES[b]));
    } else if (act.startsWith("tree-")) sel = +act.slice(5);
    else if (act.startsWith("site-")) site = +act.slice(5);
    else if (act.startsWith("cell-")) {
      const [i, j] = act.slice(5).split(".").map(Number);
      seqs[i][j] = BASES[(BASES.indexOf(seqs[i][j]) + 1) % 4];
      site = j;
    }
    render(act.startsWith("cell-") ? act : null);
  });

  function scoreOf(t) {
    let s = 0;
    for (let j = 0; j < seqs[0].length; j++) s += fitch(t.rooted, (id) => BIT[seqs[id][j]]);
    return s;
  }

  function render(focusAct) {
    const L = seqs[0].length;
    const scores = trees.map(scoreOf);
    const best = Math.min(...scores);
    // If nothing is chosen yet or the selection is no longer best, follow a best tree.
    // Alignment grid.
    alignBox.replaceChildren();
    const grid = document.createElement("div");
    grid.className = "inline-grid gap-0.5 font-mono text-xs";
    grid.style.gridTemplateColumns = `5.5rem repeat(${L}, 1.6rem)`;
    grid.append(document.createElement("span"));
    for (let j = 0; j < L; j++) {
      const b = button(`site-${j}`, String(j + 1), `Show site ${j + 1}`);
      b.className = "h-6 rounded text-[10px] tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
        (j === site ? "bg-[var(--brand)]/15 text-foreground" : "text-muted-foreground hover:text-foreground");
      b.setAttribute("aria-pressed", String(j === site));
      grid.append(b);
    }
    seqs.forEach((row, i) => {
      const lab = document.createElement("span");
      lab.className = "self-center truncate pr-2 text-muted-foreground";
      lab.textContent = TAXA[i];
      grid.append(lab);
      row.forEach((base, j) => {
        const b = button(`cell-${i}.${j}`, base, `${TAXA[i]}, site ${j + 1}: ${base}. Click to change`);
        b.className = "h-6 rounded border text-xs outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
          (j === site ? "border-[var(--brand)]/60 bg-[var(--brand)]/10" : "bg-background hover:border-foreground/30");
        grid.append(b);
      });
    });
    alignBox.append(grid);
    if (focusAct) alignBox.querySelector(`[data-action="${focusAct}"]`)?.focus();

    // Thumbnails.
    thumbs.replaceChildren();
    trees.forEach((t, k) => {
      const b = button(`tree-${k}`, "", `Tree ${k + 1}: ${scores[k]} changes${scores[k] === best ? ", most parsimonious" : ""}`);
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(k === sel));
      b.className = "flex flex-col items-stretch gap-0.5 rounded-md border p-1 outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
        (k === sel ? "border-ring ring-[3px] ring-ring/30" : "hover:border-foreground/30");
      const svg = el("svg", { viewBox: "0 0 100 72", class: "block w-full", "aria-hidden": "true" });
      layout(t.rooted, { x: 4, y: 8, w: 58, h: 56, phylogram: false });
      drawBranches(svg, t.rooted, () => "stroke:currentColor;stroke-opacity:0.6;stroke-width:2");
      for (const l of tips(t.rooted)) text(svg, l.x + 4, l.y + 4.5, TAXA[l.id].slice(0, 2), { class: "fill-foreground font-mono text-[13px]" });
      const s = document.createElement("span");
      s.className = "text-center font-mono text-[11px] tabular-nums " + (scores[k] === best ? "font-semibold text-[var(--brand)]" : "text-muted-foreground");
      s.textContent = String(scores[k]);
      b.append(svg, s);
      thumbs.append(b);
    });

    // The selected tree with Fitch sets for the selected site.
    const t = trees[sel].rooted;
    const siteCost = fitch(t, (id) => BIT[seqs[id][site]]);
    big.replaceChildren();
    const { leaves, nodes } = layout(t, { x: 30, y: 22, w: 220, h: 176, phylogram: false });
    drawBranches(big, t);
    const setStr = (m) => [...BASES].filter((_, i) => m & (1 << i)).join("");
    for (const nd of nodes) {
      if (!nd.c) continue;
      const union = nd.c.reduce((a, c) => a & c.set, 15) === 0;
      el("circle", { cx: nd.x, cy: nd.y, r: 3, style: union ? "fill:var(--code-del)" : "fill:var(--background);stroke:currentColor;stroke-opacity:0.6" }, big);
      text(big, nd.x - 4, nd.y - 6, "{" + setStr(nd.set) + "}", { "text-anchor": "end", class: (union ? "fill-[var(--code-del)]" : "fill-muted-foreground") + " font-mono text-[10px]" });
    }
    for (const l of leaves) {
      text(big, l.x + 6, l.y + 4, seqs[l.id][site], { class: "fill-[var(--brand)] font-mono text-[12px] font-semibold" });
      text(big, l.x + 20, l.y + 4, TAXA[l.id], { class: "fill-foreground font-mono text-[11px]" });
    }
    o.title.textContent = `Tree ${sel + 1} · site ${site + 1} costs ${siteCost} change${siteCost === 1 ? "" : "s"} (red nodes)`;
    o.best.textContent = `${best} changes`;
    o.nbest.textContent = `${scores.filter((s) => s === best).length} of 15`;
    o.sel.textContent = `${scores[sel]} changes`;
    o.site.textContent = `${site + 1}: ${siteCost} change${siteCost === 1 ? "" : "s"}`;
    let inf = 0;
    for (let j = 0; j < L; j++) {
      const counts = {};
      for (const r of seqs) counts[r[j]] = (counts[r[j]] ?? 0) + 1;
      if (Object.values(counts).filter((c) => c >= 2).length >= 2) inf++;
    }
    o.inf.textContent = `${inf} of ${L}`;
  }

  // Start on a most parsimonious tree.
  const s0 = trees.map(scoreOf);
  sel = s0.indexOf(Math.min(...s0));
  render();
}

function button(action, label, aria) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.action = action;
  b.textContent = label;
  if (aria) b.setAttribute("aria-label", aria);
  return b;
}

// ============================================================ Long-branch attraction

for (const root of document.querySelectorAll("[data-phylo-lba]")) {
  const o = outs(root);
  const qsvg = root.querySelector("[data-quartet]"), svg = root.querySelector("[data-plot]");
  const s = scrubAll(root, () => { drawQuartet(); drawPlot(); });
  const rng = mulberry32(2026);
  let sweep = [], stop = null;
  const LMAX = 2;

  const quartet = (long, short) => ({ n: 4, edges: [[0, 4, long], [1, 4, short], [4, 5, short], [5, 2, long], [5, 3, short]] });

  /** One replicate: site pattern counts and both methods' choices (0 = AB|CD). */
  function replicate(long, short, L) {
    const seqs = simulate(rng, rootAt(quartet(long, short), 0), L);
    const c = [0, 0, 0];
    for (let j = 0; j < L; j++) {
      const a = seqs[0][j], b = seqs[1][j], cc = seqs[2][j], d = seqs[3][j];
      if (a === b && cc === d && a !== cc) c[0]++;
      else if (a === cc && b === d && a !== b) c[1]++;
      else if (a === d && b === cc && a !== b) c[2]++;
    }
    const mx = Math.max(...c);
    const ties = [0, 1, 2].filter((k) => c[k] === mx);
    const pars = ties[Math.floor(rng() * ties.length)];
    const D = jcMatrix(seqs);
    const sums = [D[0][1] + D[2][3], D[0][2] + D[1][3], D[0][3] + D[1][2]];
    const dist = sums.indexOf(Math.min(...sums));
    return { c, pars, dist, parsTie: ties.length > 1 };
  }

  const NAMES = ["AB|CD", "AC|BD", "AD|BC"];
  const once = () => {
      const r = replicate(s.long.get(), s.short.get(), s.sites.get());
      o.xxyy.textContent = String(r.c[0]);
      o.xyxy.textContent = String(r.c[1]);
      o.xyyx.textContent = String(r.c[2]);
      o.pars.textContent = NAMES[r.pars] + (r.pars === 0 ? " ✓" : " ✗") + (r.parsTie ? " (tie)" : "");
      o.dist.textContent = NAMES[r.dist] + (r.dist === 0 ? " ✓" : " ✗");
      o.pars.style.color = r.pars === 0 ? "" : "var(--code-del)";
      o.dist.style.color = r.dist === 0 ? "" : "var(--code-del)";
  };
  onAction(root, (act) => {
    if (act === "once") once();
    else if (act === "sweep") runSweep();
  });

  function runSweep() {
    stop?.();
    const lens = [];
    for (let v = 0.1; v <= LMAX + 1e-9; v += 0.1) lens.push(+v.toFixed(2));
    const reps = s.reps.get(), L = s.sites.get(), short = s.short.get();
    sweep = lens.map((x) => ({ x, pars: 0, dist: 0, n: 0 }));
    stop = chunked(lens.length * reps, (i) => {
      const pt = sweep[Math.floor(i / reps)];
      const r = replicate(pt.x, short, L);
      pt.pars += r.pars === 0;
      pt.dist += r.dist === 0;
      pt.n++;
    }, () => drawPlot(), () => drawPlot());
  }

  function drawQuartet() {
    qsvg.replaceChildren();
    const long = s.long.get(), short = s.short.get();
    const k = 70 / Math.max(long, 0.5);
    // Short branches get a floor so they stay visible; the label says so.
    const vis = (len) => Math.max(len * k, 18) / k;
    const cx = 120, cy = 96, half = Math.max(9, (short * k) / 2);
    const x1 = cx - half, x2 = cx + half;
    const arm = (x, y, ang, len, name, isLong) => {
      const ex = x + Math.cos(ang) * len * k, ey = y - Math.sin(ang) * len * k;
      el("line", { x1: x, y1: y, x2: ex, y2: ey, style: `stroke:${isLong ? "var(--brand)" : "currentColor"};stroke-width:${isLong ? 2.2 : 1.6};stroke-linecap:round;stroke-opacity:${isLong ? 1 : 0.7}` }, qsvg);
      text(qsvg, ex + Math.cos(ang) * 10, ey - Math.sin(ang) * 10 + 4, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    };
    el("line", { x1, y1: cy, x2, y2: cy, style: "stroke:currentColor;stroke-width:1.6;stroke-opacity:0.7" }, qsvg);
    arm(x1, cy, (3 * Math.PI) / 4, long, "A", true);
    arm(x1, cy, (5 * Math.PI) / 4, vis(short), "B", false);
    arm(x2, cy, Math.PI / 4, long, "C", true);
    arm(x2, cy, -Math.PI / 4, vis(short), "D", false);
    text(qsvg, cx, 176, "true tree AB|CD", { "text-anchor": "middle" });
    text(qsvg, cx, 190, "short branches drawn at least 18 px", { "text-anchor": "middle", class: "fill-muted-foreground/70 font-mono text-[9px]" });
  }

  function drawPlot() {
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 20, 450, 196], x: [0, LMAX], y: [0, 1], xticks: niceTicks(0, LMAX, 8), yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: tickFmt, yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "long-branch length (subs/site)", ylabel: "true tree recovered" });
    el("line", { x1: f.sx(0), x2: f.sx(LMAX), y1: f.sy(1 / 3), y2: f.sy(1 / 3), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, svg);
    text(svg, f.sx(LMAX) - 2, f.sy(1 / 3) - 4, "random guess", { "text-anchor": "end" });
    const x = f.sx(s.long.get());
    el("line", { x1: x, x2: x, y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.25" }, svg);
    const done = sweep.filter((p) => p.n > 0);
    for (const [key, color] of [["pars", "var(--code-del)"], ["dist", "var(--vec-v)"]]) {
      if (done.length > 1) polyline(svg, done.map((p) => [f.sx(p.x), f.sy(p[key] / p.n)]), `stroke:${color};stroke-width:2`);
      for (const p of done) el("circle", { cx: f.sx(p.x), cy: f.sy(p[key] / p.n), r: 2.6, style: `fill:${color}` }, svg);
    }
    if (!done.length) text(svg, f.L + f.W / 2, f.T + f.H / 2, "press Sweep lengths", { "text-anchor": "middle" });
  }

  drawQuartet();
  drawPlot();
  once();
  let started = false;
  whenVisible(root, (v) => { if (v && !started) { started = true; runSweep(); } });
}

// ============================================================ Jukes–Cantor

for (const root of document.querySelectorAll("[data-phylo-jc]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]"), seqBox = root.querySelector("[data-seqs]");
  const playBtn = root.querySelector('[data-action="play"]');
  const DMAX = 2.5;
  let L, anc, cur, d, hits, pts, playing = false, raf = 0, visible = true;
  const rng = mulberry32(4242);
  const s = scrubAll(root, (name) => {
    if (name === "sites") reset();
    else calc();
  });

  function reset() {
    L = s.sites.get();
    anc = Array.from({ length: L }, () => Math.floor(rng() * 4));
    cur = anc.slice();
    d = 0; hits = 0; pts = [[0, 0]];
    draw();
  }

  /** Advances the true distance by dd: each site changes with chance dd. */
  function advance(dd) {
    for (let i = 0; i < L; i++)
      if (rng() < dd) { cur[i] = (cur[i] + 1 + Math.floor(rng() * 3)) % 4; hits++; }
    d += dd;
    if (pts.length === 0 || d - pts[pts.length - 1][0] >= 0.025 - 1e-9) pts.push([d, pDiff()]);
  }
  const pDiff = () => { let k = 0; for (let i = 0; i < L; i++) k += cur[i] !== anc[i]; return k / L; };

  onAction(root, (act) => {
    if (act === "play") toggle(!playing);
    else if (act === "reset") { toggle(false); reset(); }
  });

  function toggle(on) {
    playing = on && visible;
    setPlaying(playBtn, playing, ["Run", "Pause"]);
    cancelAnimationFrame(raf);
    if (!playing) return;
    if (d >= DMAX - 1e-9) reset();
    if (reduced()) {
      while (d < DMAX - 1e-9) advance(0.005);
      toggle(false);
      draw();
      return;
    }
    const step = () => {
      for (let k = 0; k < 2 && d < DMAX - 1e-9; k++) advance(0.005);
      draw();
      if (d >= DMAX - 1e-9) toggle(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  whenVisible(root, (v) => { visible = v; if (!v && playing) toggle(false); });

  function calc() {
    const p = s.p.get();
    const dd = jcD(p);
    o.calc.textContent = `d = −¾ ln(1 − 4·${num(p, 2)}/3) = ${Number.isFinite(dd) ? num(dd, 4) : "∞"}`;
  }

  function draw() {
    // Sequences: ancestor over descendant, differing sites marked.
    seqBox.replaceChildren();
    const n = Math.min(64, L);
    for (const [label, seq] of [["then", anc], ["now ", cur]]) {
      const row = document.createElement("div");
      row.className = "flex whitespace-pre";
      const lab = document.createElement("span");
      lab.className = "mr-2 text-muted-foreground";
      lab.textContent = label;
      row.append(lab);
      for (let i = 0; i < n; i++) {
        const c = document.createElement("span");
        const diff = cur[i] !== anc[i];
        c.textContent = BASES[seq[i]];
        c.className = diff ? "text-[var(--brand)] font-semibold" : "text-muted-foreground";
        row.append(c);
      }
      seqBox.append(row);
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 18, 530, 224], x: [0, DMAX], y: [0, DMAX], xticks: niceTicks(0, DMAX, 5), yticks: niceTicks(0, DMAX, 5), xfmt: tickFmt, yfmt: tickFmt, xlabel: "true substitutions per site d", ylabel: "distance" });
    el("line", { x1: f.sx(0), y1: f.sy(0), x2: f.sx(DMAX), y2: f.sy(DMAX), style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:5 4" }, svg);
    el("line", { x1: f.sx(0), x2: f.sx(DMAX), y1: f.sy(0.75), y2: f.sy(0.75), style: "stroke:var(--vec-u);stroke-opacity:0.5;stroke-dasharray:2 4" }, svg);
    text(svg, f.sx(DMAX) - 2, f.sy(0.75) + 12, "p cannot pass 3/4", { "text-anchor": "end" });
    const theory = [];
    for (let i = 0; i <= 100; i++) { const x = (DMAX * i) / 100; theory.push([f.sx(x), f.sy(jcP(x))]); }
    polyline(svg, theory, "stroke:var(--vec-u);stroke-width:1.25;stroke-opacity:0.55");
    for (const [x, p] of pts) {
      el("circle", { cx: f.sx(x), cy: f.sy(p), r: 2.2, style: "fill:var(--vec-u)" }, svg);
      const j = jcD(p);
      if (Number.isFinite(j) && j <= DMAX) el("circle", { cx: f.sx(x), cy: f.sy(j), r: 2.2, style: "fill:var(--vec-v)" }, svg);
    }
    const p = pDiff(), j = jcD(p);
    o.d.textContent = num(d, 3);
    o.p.textContent = num(p, 3);
    o.jc.textContent = Number.isFinite(j) ? num(j, 3) : "∞ (saturated)";
    o.hits.textContent = `${hits.toLocaleString("en")} · ${num(hits / L, 2)}/site`;
    const differing = Math.round(p * L);
    o.hidden.textContent = hits ? `${(hits - differing).toLocaleString("en")} (${Math.round((100 * (hits - differing)) / hits)}%)` : "0";
  }

  reset();
  calc();
}

// ============================================================ Molecular clock

for (const root of document.querySelectorAll("[data-phylo-clock]")) {
  const o = outs(root);
  const tsvg = root.querySelector("[data-tree]"), svg = root.querySelector("[data-plot]");
  const rng = mulberry32(19);
  let sim = null;
  const s = scrubAll(root, () => regenerate(false));
  onAction(root, (act) => { if (act === "new") regenerate(true); });

  const T0 = 2020.2, T1 = 2021.8, THETA = 0.35; // sampling window; coalescent scale in years

  /** Serially sampled coalescent: returns the root and the tips with dates. */
  function genealogy(n) {
    const dates = Array.from({ length: n }, () => T0 + (T1 - T0) * rng()).sort((a, b) => b - a);
    const tipsArr = dates.map((date, i) => ({ id: i, date }));
    let t = dates[0], next = 1;
    let active = [tipsArr[0]];
    while (next < n || active.length > 1) {
      const k = active.length;
      const w = k >= 2 ? -Math.log(1 - rng()) * THETA / ((k * (k - 1)) / 2) : Infinity;
      const sn = next < n ? dates[next] : -Infinity;
      if (t - w > sn) {
        t -= w;
        const i = Math.floor(rng() * k);
        let j = Math.floor(rng() * (k - 1));
        if (j >= i) j++;
        const node = { date: t, c: [active[i], active[j]] };
        active = active.filter((_, x) => x !== i && x !== j);
        active.push(node);
      } else {
        t = sn;
        active.push(tipsArr[next++]);
      }
    }
    return { tree: active[0], tips: tipsArr };
  }

  function poisson(m) {
    if (m > 40) return Math.max(0, Math.round(m + Math.sqrt(m) * gauss(rng)));
    const L = Math.exp(-m);
    let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }

  function regenerate(fresh) {
    if (fresh || !sim || sim.n !== s.n.get()) sim = { n: s.n.get(), ...genealogy(s.n.get()), noise: [] };
    const rate = s.rate.get() * 1e-3, sites = s.sites.get(), sd = s.relax.get();
    // Substitutions per branch, root to tips.
    let b = 0;
    const walk = (node, parentDate, acc) => {
      if (parentDate !== null) {
        const len = node.date - parentDate;
        const z = sim.noise[b] ?? (sim.noise[b] = gauss(rng));
        const mult = Math.exp(sd * z - (sd * sd) / 2);
        b++;
        acc += poisson(rate * mult * len * sites) / sites;
      }
      node.dist = acc;
      if (node.c) node.c.forEach((c) => walk(c, node.date, acc));
    };
    walk(sim.tree, null, 0);
    // Least squares of distance on date.
    const xs = sim.tips.map((t) => t.date), ys = sim.tips.map((t) => t.dist);
    const n = xs.length, mx = xs.reduce((a, v) => a + v, 0) / n, my = ys.reduce((a, v) => a + v, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
    const slope = sxy / sxx, icpt = my - slope * mx;
    sim.fit = { slope, icpt, root: -icpt / slope, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 0 };
    draw();
  }

  const fmtDate = (t) => {
    const y = Math.floor(t);
    const m = Math.min(11, Math.floor((t - y) * 12));
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]} ${y}`;
  };

  function draw() {
    const { tree, tips: tp, fit } = sim;
    const tmin = Math.min(tree.date, fit.slope > 0 ? fit.root : tree.date) - 0.1;
    // Tree, time-scaled on x.
    tsvg.replaceChildren();
    const order = [];
    const collect = (node) => (node.c ? node.c.forEach(collect) : order.push(node));
    collect(tree);
    const f0 = frame(tsvg, { box: [14, 14, 272, 228], x: [tmin, T1 + 0.05], y: [0, 1], xticks: niceTicks(tmin, T1, 3).filter((v) => v >= tmin), xfmt: (v) => String(+v.toFixed(1)), xlabel: "date" });
    order.forEach((l, i) => (l.y = f0.T + 4 + (i * (f0.H - 8)) / Math.max(1, order.length - 1)));
    const place = (node) => {
      node.x = f0.sx(node.date);
      if (node.c) { node.c.forEach(place); node.y = (node.c[0].y + node.c[1].y) / 2; }
    };
    place(tree);
    drawBranches(tsvg, tree, () => "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.2");
    for (const l of order) el("circle", { cx: l.x, cy: l.y, r: 2.2, style: "fill:var(--vec-v)" }, tsvg);
    el("circle", { cx: tree.x, cy: tree.y, r: 3, style: "fill:var(--brand)" }, tsvg);

    // Root-to-tip regression.
    svg.replaceChildren();
    const ymax = Math.max(...tp.map((t) => t.dist)) * 1.15 || 1e-4;
    const f = frame(svg, { box: [52, 18, 236, 224], x: [tmin, T1 + 0.05], y: [0, ymax], xticks: niceTicks(tmin, T1, 3).filter((v) => v >= tmin), yticks: niceTicks(0, ymax, 4), xfmt: (v) => String(+v.toFixed(1)), yfmt: (v) => (v === 0 ? "0" : v.toExponential(0).replace("e-", "e−")), xlabel: "sampling date", ylabel: "root-to-tip (subs/site)" });
    el("line", { x1: f.sx(tree.date), x2: f.sx(tree.date), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.25" }, svg);
    if (fit.slope > 0) {
      const xa = Math.max(tmin, fit.root), xb = T1 + 0.05;
      el("line", { x1: f.sx(xa), y1: f.sy(fit.icpt + fit.slope * xa), x2: f.sx(xb), y2: f.sy(fit.icpt + fit.slope * xb), style: "stroke:var(--vec-v);stroke-width:1.75" }, svg);
      if (fit.root >= tmin) el("circle", { cx: f.sx(fit.root), cy: f.sy(0), r: 3.5, style: "fill:none;stroke:var(--vec-v);stroke-width:1.75" }, svg);
    }
    for (const t of tp) el("circle", { cx: f.sx(t.date), cy: f.sy(t.dist), r: 2.6, style: "fill:currentColor;fill-opacity:0.65" }, svg);

    o.rate.textContent = fit.slope > 0 ? `${num(fit.slope * 1e3, 2)} ×10⁻³/yr` : "negative: no clock signal";
    o.true.textContent = `${num(s.rate.get(), 2)} ×10⁻³/yr`;
    o.root.textContent = fit.slope > 0 ? fmtDate(fit.root) : "—";
    o.troot.textContent = fmtDate(tree.date);
    o.r2.textContent = num(fit.r2, 3);
  }

  regenerate(true);
}
