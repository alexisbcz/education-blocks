// Game theory blocks, part one: every equilibrium of a 3×3 game by support
// enumeration, iterated elimination of dominated strategies, backward
// induction on game trees, and the graphical method for 2×n zero-sum
// games. Matrix computations use exact fractions (gametheory-util.js).

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { Q, Q0, Q1, solve, subsets, outs, segOf, minus, h, switches, payoffTable, bestResponses, mixStr } from "./gametheory-util.js";

// ============================================================ Support enumeration

const SUPPORT_GAMES = {
  rps: {
    rows: ["Rock", "Paper", "Scissors"], cols: ["Rock", "Paper", "Scissors"],
    pay: [[[0, 0], [-1, 1], [1, -1]], [[1, -1], [0, 0], [-1, 1]], [[-1, 1], [1, -1], [0, 0]]],
  },
  coord: {
    rows: ["A", "B", "C"], cols: ["A", "B", "C"],
    pay: [[[3, 3], [0, 0], [0, 0]], [[0, 0], [2, 2], [0, 0]], [[0, 0], [0, 0], [1, 1]]],
  },
  shapley: {
    rows: ["1", "2", "3"], cols: ["1", "2", "3"],
    pay: [[[0, 0], [1, 0], [0, 1]], [[0, 1], [0, 0], [1, 0]], [[1, 0], [0, 1], [0, 0]]],
  },
  bos: {
    rows: ["Opera", "Football", "Stay in"], cols: ["Opera", "Football", "Stay in"],
    pay: [[[2, 1], [0, 0], [1, -1]], [[0, 0], [1, 2], [0, -1]], [[-1, 1], [-1, 0], [-1, -1]]],
  },
};

/** All isolated Nash equilibria of a bimatrix game by support enumeration
 *  over equal-size supports (complete for nondegenerate games). */
export function equilibria(pay) {
  const m = pay.length, n = pay[0].length;
  const A = pay.map((r) => r.map((c) => Q.of(c[0])));
  const B = pay.map((r) => r.map((c) => Q.of(c[1])));
  const found = [];
  let tried = 0, degenerate = false;
  for (const I of subsets(m)) for (const J of subsets(n)) {
    if (I.length !== J.length) continue;
    tried++;
    const k = I.length;
    // Column mix y on J (and value v) making the row player indifferent on I.
    const My = I.map((i) => [...J.map((j) => A[i][j]), Q.of(-1)]);
    My.push([...J.map(() => Q1), Q0]);
    const sy = solve(My, [...I.map(() => Q0), Q1]);
    const Mx = J.map((j) => [...I.map((i) => B[i][j]), Q.of(-1)]);
    Mx.push([...I.map(() => Q1), Q0]);
    const sx = solve(Mx, [...J.map(() => Q0), Q1]);
    if (!sy || !sx) continue;
    const yv = sy.slice(0, k), v = sy[k], xv = sx.slice(0, k), w = sx[k];
    if (yv.some((q) => q.sign() <= 0) || xv.some((q) => q.sign() <= 0)) continue;
    const y = Array(n).fill(Q0), x = Array(m).fill(Q0);
    J.forEach((j, t) => (y[j] = yv[t]));
    I.forEach((i, t) => (x[i] = xv[t]));
    let ok = true, ties = false;
    for (let i = 0; i < m && ok; i++) {
      if (I.includes(i)) continue;
      const u = y.reduce((s, q, j) => s.add(q.mul(A[i][j])), Q0);
      const c = u.cmp(v);
      if (c > 0) ok = false; else if (c === 0) ties = true;
    }
    for (let j = 0; j < n && ok; j++) {
      if (J.includes(j)) continue;
      const u = x.reduce((s, q, i) => s.add(q.mul(B[i][j])), Q0);
      const c = u.cmp(w);
      if (c > 0) ok = false; else if (c === 0) ties = true;
    }
    if (!ok) continue;
    if (ties) degenerate = true;
    const key = x.join() + "|" + y.join();
    if (!found.some((e) => e.key === key)) found.push({ key, x, y, v, w, I, J });
  }
  // A pure strategy with several pure best replies also makes the game degenerate.
  for (let i = 0; i < m; i++) { const best = Math.max(...pay[i].map((c) => c[1])); if (pay[i].filter((c) => c[1] === best).length > 1) degenerate = true; }
  for (let j = 0; j < n; j++) { const col = pay.map((r) => r[j][0]), best = Math.max(...col); if (col.filter((v) => v === best).length > 1) degenerate = true; }
  return { found, tried, degenerate };
}

for (const root of document.querySelectorAll("[data-gt-support]")) {
  const o = outs(root);
  const list = root.querySelector("[data-list]");
  let table, game;
  const load = (key) => {
    game = SUPPORT_GAMES[key];
    table = payoffTable(root.querySelector("[data-matrix]"), { rows: game.rows, cols: game.cols, pay: game.pay, onChange: draw });
    draw();
  };
  root.addEventListener("seg-change", (e) => load(e.detail.value));

  function draw() {
    const pay = table.get();
    const br = bestResponses(pay);
    pay.forEach((r, i) => r.forEach((_, j) => {
      table.mark(i, j, 0, br[i][j][0]);
      table.mark(i, j, 1, br[i][j][1]);
      table.cell(i, j).toggleAttribute("data-eq", br[i][j][0] && br[i][j][1]);
    }));
    const { found, tried, degenerate } = equilibria(pay);
    const fmtStrat = (x, names) => {
      const used = x.map((q, i) => [q, names[i]]).filter(([q]) => !q.isZero());
      return used.length === 1 ? used[0][1] : mixStr(x);
    };
    list.replaceChildren(...found.map((e, t) => {
      const pure = e.I.length === 1;
      return h("li", { class: "flex flex-col gap-1 rounded-lg border p-2.5" },
        h("div", { class: "flex items-center justify-between gap-2" },
          h("span", { class: "font-mono text-[11px] text-muted-foreground", text: `#${t + 1} · ${pure ? "pure" : `mixed on ${e.I.length}×${e.J.length}`}` }),
          h("span", { class: "font-mono text-xs tabular-nums", text: `payoffs (${e.v}, ${e.w})` })),
        h("div", { class: "font-mono text-xs tabular-nums" },
          h("span", { class: "text-vec-u", text: "row " }), fmtStrat(e.x, game.rows)),
        h("div", { class: "font-mono text-xs tabular-nums" },
          h("span", { class: "text-vec-v", text: "column " }), fmtStrat(e.y, game.cols)),
        pure ? null : mixBars(e.x, e.y),
      );
    }));
    o.tried.textContent = `${tried} support pairs`;
    o.count.textContent = String(found.length);
    o.degenerate.textContent = degenerate ? "degenerate: ties between best replies" : "nondegenerate";
  }
  load("rps");
}

/** Two thin stacked bars showing a mixed strategy pair. */
function mixBars(x, y) {
  const bar = (p, color) => h("div", { class: "flex h-1.5 overflow-hidden rounded-full bg-muted" },
    ...p.map((q, i) => h("div", { class: "h-full border-r border-background last:border-0", style: `width:${q.toNumber() * 100}%;background:${color};opacity:${1 - i * 0.28}` })));
  return h("div", { class: "flex flex-col gap-1 pt-1" }, bar(x, "var(--vec-u)"), bar(y, "var(--vec-v)"));
}

// ============================================================ Dominance

const DOM_GAMES = {
  gibbons: {
    rows: ["Up", "Down"], cols: ["Left", "Middle", "Right"],
    pay: [[[1, 0], [1, 2], [0, 1]], [[0, 3], [0, 1], [2, 0]]],
  },
  mixture: {
    rows: ["Top", "Middle", "Bottom"], cols: ["Left", "Right"],
    pay: [[[3, 0], [0, 1]], [[0, 0], [3, 1]], [[1, 3], [1, 0]]],
  },
  pd: {
    rows: ["Cooperate", "Defect"], cols: ["Cooperate", "Defect"],
    pay: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]],
  },
  rps: SUPPORT_GAMES.rps,
};

/** Finds one strictly dominated strategy among the alive ones, for the row
 *  player first. Returns { who, k, by, p } or null. by is one or two
 *  strategies; p is the weight on by[0] when two are mixed. */
export function dominated(pay, R, C) {
  for (const who of [0, 1]) {
    const mine = who === 0 ? R : C, theirs = who === 0 ? C : R;
    const u = (s, t) => Q.of(who === 0 ? pay[s][t][0] : pay[t][s][1]);
    for (const k of mine) {
      for (const a of mine) {
        if (a !== k && theirs.every((t) => u(a, t).cmp(u(k, t)) > 0)) return { who, k, by: [a] };
      }
    }
    for (const k of mine) {
      for (const a of mine) for (const b of mine) {
        if (a >= b || a === k || b === k) continue;
        // p·u(a) + (1−p)·u(b) > u(k) for every t: p·d > e with d = u(a)−u(b), e = u(k)−u(b).
        let lo = Q0, hi = Q1, ok = true;
        for (const t of theirs) {
          const d = u(a, t).sub(u(b, t)), e = u(k, t).sub(u(b, t));
          if (d.isZero()) { if (e.sign() >= 0) ok = false; }
          else if (d.sign() > 0) { const r = e.div(d); if (r.cmp(lo) > 0) lo = r; }
          else { const r = e.div(d); if (r.cmp(hi) < 0) hi = r; }
        }
        if (ok && lo.cmp(hi) < 0) return { who, k, by: [a, b], p: lo.add(hi).div(2), lo, hi };
      }
    }
  }
  return null;
}

for (const root of document.querySelectorAll("[data-gt-dominance]")) {
  const o = outs(root);
  const log = root.querySelector("[data-log]");
  let table, game, R, C, rounds;
  const load = (key) => {
    game = DOM_GAMES[key];
    table = payoffTable(root.querySelector("[data-matrix]"), { rows: game.rows, cols: game.cols, pay: game.pay, onChange: reset });
    reset();
  };
  function reset() {
    R = game.rows.map((_, i) => i);
    C = game.cols.map((_, j) => j);
    rounds = 0;
    log.replaceChildren(h("li", { "data-empty": "", class: "list-none text-muted-foreground", text: "Press Step to look for a dominated strategy." }));
    paint(null);
  }
  function paint(done) {
    const pay = table.get();
    const br = bestResponses(pay, R, C);
    game.rows.forEach((_, i) => game.cols.forEach((_, j) => {
      const alive = R.includes(i) && C.includes(j);
      table.cell(i, j).toggleAttribute("data-gone", !alive);
      table.mark(i, j, 0, alive && br[i][j][0]);
      table.mark(i, j, 1, alive && br[i][j][1]);
      table.cell(i, j).toggleAttribute("data-eq", alive && br[i][j][0] && br[i][j][1]);
    }));
    table.rowHead.forEach((th, i) => th.classList.toggle("line-through", !R.includes(i)));
    table.rowHead.forEach((th, i) => th.classList.toggle("opacity-40", !R.includes(i)));
    table.colHead.forEach((th, j) => th.classList.toggle("line-through", !C.includes(j)));
    table.colHead.forEach((th, j) => th.classList.toggle("opacity-40", !C.includes(j)));
    o.rounds.textContent = String(rounds);
    o.left.textContent = `${R.length} × ${C.length}`;
    if (R.length === 1 && C.length === 1) o.result.textContent = `solved: (${game.rows[R[0]]}, ${game.cols[C[0]]})`;
    else o.result.textContent = done ? "stuck: nothing more is dominated" : "—";
  }
  function step() {
    const d = dominated(table.get(), R, C);
    if (!d) {
      log.querySelector("[data-empty]")?.remove();
      if (!log.querySelector("[data-end]")) log.append(h("li", { "data-end": "", class: "text-muted-foreground", text: R.length * C.length === 1 ? "One cell left." : "No strategy is strictly dominated, by a pure strategy or a mixture of two." }));
      paint(true);
      return false;
    }
    rounds++;
    log.querySelector("[data-empty]")?.remove();
    const names = d.who === 0 ? game.rows : game.cols;
    const by = d.by.length === 1 ? names[d.by[0]]
      : `${d.p} ${names[d.by[0]]} + ${Q1.sub(d.p)} ${names[d.by[1]]} (any weight on ${names[d.by[0]]} strictly between ${d.lo} and ${d.hi})`;
    log.append(h("li", {},
      h("span", { class: d.who === 0 ? "text-vec-u" : "text-vec-v", text: d.who === 0 ? "Row" : "Column" }),
      ` removes ${names[d.k]}: dominated by ${by}.`));
    if (d.who === 0) R = R.filter((i) => i !== d.k); else C = C.filter((j) => j !== d.k);
    paint(false);
    return true;
  }
  root.addEventListener("seg-change", (e) => load(e.detail.value));
  root.querySelector("[data-action=step]").addEventListener("click", step);
  root.querySelector("[data-action=all]").addEventListener("click", () => { for (let g = 0; g < 20 && step(); g++); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  load("gibbons");
}

// ============================================================ Backward induction

const money = (v) => `$${v.toFixed(2)}`;

/** Trees: decision nodes {player, name, kids: [{act, node}]}, leaves {pay}. */
function entryTree() {
  const P2 = { player: 1, name: "Incumbent", kids: [{ act: "Fight", node: { pay: [-1, -1] } }, { act: "Accommodate", node: { pay: [1, 1] } }] };
  const root = { player: 0, name: "Entrant", kids: [{ act: "Out", node: { pay: [0, 2] } }, { act: "In", node: P2 }] };
  // Layout in the 640×360 box.
  root.x = 220; root.y = 70; root.kids[0].node.x = 110; root.kids[0].node.y = 230;
  P2.x = 360; P2.y = 180; P2.kids[0].node.x = 270; P2.kids[0].node.y = 310; P2.kids[1].node.x = 470; P2.kids[1].node.y = 310;
  return {
    root, fmt: (v) => minus(v),
    threat: { edges: [[P2, 0]], text: "Nash equilibrium (Out, Fight): if the entrant believed the threat, staying out would be right. But once In, fighting pays the incumbent −1 instead of 1, so the threat is not credible." },
    foot: "Selten's (1978) chain-store paradox repeats this game in 20 towns; backward induction says the incumbent never fights.",
  };
}

function centipedeTree(n) {
  // McKelvey & Palfrey (1992): the pot starts at $0.50 split $0.40/$0.10 and
  // doubles at each pass; the mover can take the larger pile.
  const nodes = [];
  const x0 = 50, dx = Math.min(70, 540 / n);
  let next = null;
  const m = 2 ** n, last = n % 2 === 0 ? [0.4 * m, 0.1 * m] : [0.1 * m, 0.4 * m];
  next = { pay: last, x: x0 + n * dx, y: 110 };
  for (let k = n; k >= 1; k--) {
    const mover = (k - 1) % 2, s = 2 ** (k - 1);
    const take = mover === 0 ? [0.4 * s, 0.1 * s] : [0.1 * s, 0.4 * s];
    const node = { player: mover, name: `Move ${k}`, x: x0 + (k - 1) * dx, y: 110,
      kids: [{ act: "Take", node: { pay: take, x: x0 + (k - 1) * dx, y: 270 } }, { act: "Pass", node: next }] };
    nodes.unshift(node);
    next = node;
  }
  return {
    root: nodes[0], fmt: money, compact: true,
    foot: "In McKelvey & Palfrey's (1992) experiments most players passed at the first move, against the backward-induction prediction of taking at once.",
  };
}

function sequentialTree() {
  const mk = (pays, x) => ({ player: 1, name: "Player 2", x, y: 190, kids: [{ act: "Opera", node: { pay: pays[0], x: x - 70, y: 310 } }, { act: "Football", node: { pay: pays[1], x: x + 70, y: 310 } }] });
  const a = mk([[2, 1], [0, 0]], 170), b = mk([[0, 0], [1, 2]], 470);
  const root = { player: 0, name: "Player 1", x: 320, y: 70, kids: [{ act: "Opera", node: a }, { act: "Football", node: b }] };
  return {
    root, fmt: (v) => minus(v),
    threat: { edges: [[a, 1]], text: "Nash equilibrium where player 2 says “Football whatever you do”: player 1 then picks Football. After Opera that threat pays player 2 0 instead of 1, so it is not credible." },
    foot: "Seen in turns, the battle of the sexes has a first-mover advantage: player 1 commits to Opera and player 2 follows.",
  };
}

for (const root of document.querySelectorAll("[data-gt-tree]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => load());
  const stagesRow = root.querySelector("[data-stages]");
  const threatRow = root.querySelector("[data-threat-row]");
  const sw = switches(root, () => draw());
  let kind = "entry", T, order, done;

  function postorder(node, out = []) {
    if (!node.kids) return out;
    for (const k of node.kids) postorder(k.node, out);
    out.push(node);
    return out;
  }
  function load() {
    T = kind === "entry" ? entryTree() : kind === "centipede" ? centipedeTree(Math.round(s.n.get())) : sequentialTree();
    stagesRow.hidden = kind !== "centipede";
    threatRow.hidden = !T.threat;
    order = postorder(T.root);
    for (const n of order) { delete n.choice; delete n.value; }
    done = 0;
    draw();
  }
  function stepOnce() {
    if (done >= order.length) return false;
    const n = order[done++];
    let best = 0;
    n.kids.forEach((k, i) => { if (val(k.node)[n.player] > val(n.kids[best].node)[n.player]) best = i; });
    n.choice = best;
    n.value = val(n.kids[best].node);
    draw();
    return true;
  }
  const val = (node) => node.pay ?? node.value;

  function draw() {
    svg.replaceChildren();
    const nodes = [];
    (function walk(n) { nodes.push(n); n.kids?.forEach((k) => walk(k.node)); })(T.root);
    const threatSet = new Set((sw.threat && T.threat ? T.threat.edges : []).map(([n, i]) => n.kids[i]));
    // Edges first.
    for (const n of nodes) {
      if (!n.kids) continue;
      n.kids.forEach((k, i) => {
        const chosen = n.choice === i;
        const threat = threatSet.has(k);
        const style = chosen ? "stroke:var(--brand);stroke-width:3"
          : threat ? "stroke:var(--code-del);stroke-width:2.25;stroke-dasharray:5 4"
          : `stroke:currentColor;stroke-opacity:${n.choice === undefined ? 0.45 : 0.18};stroke-width:1.5`;
        el("line", { x1: n.x, y1: n.y, x2: k.node.x, y2: k.node.y, style, class: "transition-[stroke-opacity] duration-200" }, svg);
        const mx = (n.x + k.node.x) / 2, my = (n.y + k.node.y) / 2;
        const horizontal = Math.abs(k.node.y - n.y) < 4;
        const lbl = text(svg, mx + (horizontal ? 0 : k.node.x < n.x ? -8 : 8), my + (horizontal ? -8 : 0), k.act, {
          "text-anchor": horizontal ? "middle" : k.node.x < n.x ? "end" : k.node.x > n.x ? "start" : "start",
          class: `font-mono text-[11px] ${chosen ? "fill-brand" : "fill-muted-foreground"}`,
        });
        if (!horizontal && k.node.x === n.x) lbl.setAttribute("x", mx + 8);
      });
    }
    // Nodes and leaves.
    for (const n of nodes) {
      if (n.kids) {
        el("circle", { cx: n.x, cy: n.y, r: 9, style: `fill:${n.player === 0 ? "var(--vec-u)" : "var(--vec-v)"};stroke:var(--background);stroke-width:2` }, svg);
        text(svg, n.x, n.y - 15, n.name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
        if (n.value && !T.compact) text(svg, n.x, n.y + 24, `(${n.value.map(T.fmt).join(", ")})`, { "text-anchor": "middle", class: "fill-brand font-mono text-[10px] font-medium" });
      } else {
        el("rect", { x: n.x - 3.5, y: n.y - 3.5, width: 7, height: 7, rx: 1.5, style: "fill:var(--foreground)" }, svg);
        const label = T.compact ? n.pay.map(T.fmt).join(" ") : `(${n.pay.map(T.fmt).join(", ")})`;
        if (T.compact) {
          text(svg, n.x, n.y + 16, T.fmt(n.pay[0]), { "text-anchor": "middle", class: "fill-vec-u font-mono text-[9px]" });
          text(svg, n.x, n.y + 28, T.fmt(n.pay[1]), { "text-anchor": "middle", class: "fill-vec-v font-mono text-[9px]" });
        } else {
          const t = text(svg, n.x, n.y + 18, "", { "text-anchor": "middle", class: "font-mono text-[11px]" });
          const span = (s, cls) => { const e = el("tspan", { class: cls }, t); e.textContent = s; };
          span("(", "fill-muted-foreground"); span(T.fmt(n.pay[0]), "fill-vec-u"); span(", ", "fill-muted-foreground"); span(T.fmt(n.pay[1]), "fill-vec-v"); span(")", "fill-muted-foreground");
          void label;
        }
      }
    }
    // Readouts.
    o.step.textContent = `${done} of ${order.length} decisions solved`;
    if (done === order.length) {
      const path = [];
      let n = T.root;
      while (n.kids) { path.push(n.kids[n.choice].act); n = n.kids[n.choice].node; }
      o.path.textContent = path.join(" → ");
      o.pay.textContent = `(${n.pay.map(T.fmt).join(", ")})`;
    } else { o.path.textContent = "—"; o.pay.textContent = "—"; }
    o.note.textContent = sw.threat && T.threat ? T.threat.text : done === order.length ? "subgame-perfect equilibrium" : "solve from the last moves backwards";
    o.foot.textContent = T.foot;
  }
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; load(); });
  root.querySelector("[data-action=step]").addEventListener("click", stepOnce);
  root.querySelector("[data-action=solve]").addEventListener("click", () => { while (stepOnce()); });
  root.querySelector("[data-action=reset]").addEventListener("click", load);
  load();
}

// ============================================================ Zero-sum, graphical method

const ZS_GAMES = {
  mixed: { cols: ["C1", "C2", "C3", "C4"], pay: [[3, -1, 2, 0], [-2, 4, 1, 3]] },
  saddle: { cols: ["C1", "C2", "C3", "C4"], pay: [[4, 2, 5, 3], [1, 0, 6, 2]] },
  morra: { cols: ["One", "Two"], pay: [[2, -3], [-3, 4]], rows: ["One", "Two"] },
};

/** Solves a 2×n zero-sum game exactly. f_j(p) = p·a1j + (1−p)·a2j. */
export function solve2xn(pay) {
  const n = pay[0].length;
  const a = pay[0].map(Q.of), b = pay[1].map(Q.of);
  const f = (j, p) => p.mul(a[j]).add(Q1.sub(p).mul(b[j]));
  const env = (p) => [...Array(n).keys()].reduce((m, j) => (f(j, p).cmp(m) < 0 ? f(j, p) : m), f(0, p));
  const cands = [Q0, Q1];
  for (let j = 0; j < n; j++) for (let k = j + 1; k < n; k++) {
    const den = a[j].sub(b[j]).sub(a[k].sub(b[k]));
    if (den.isZero()) continue;
    const p = b[k].sub(b[j]).div(den);
    if (p.sign() >= 0 && p.cmp(Q1) <= 0) cands.push(p);
  }
  let pstar = cands[0], v = env(cands[0]);
  for (const p of cands) {
    const e = env(p);
    if (e.cmp(v) > 0 || (e.eq(v) && p.cmp(pstar) < 0)) { pstar = p; v = e; }
  }
  // Column's optimal mix from the columns active at p*.
  const slope = (j) => a[j].sub(b[j]);
  const J = [...Array(n).keys()].filter((j) => f(j, pstar).eq(v));
  const q = Array(n).fill(Q0);
  const flat = J.find((j) => slope(j).isZero());
  if (flat !== undefined) q[flat] = Q1;
  else if (pstar.isZero()) q[J.reduce((m, j) => (slope(j).cmp(slope(m)) < 0 ? j : m), J[0])] = Q1;
  else if (pstar.eq(Q1)) q[J.reduce((m, j) => (slope(j).cmp(slope(m)) > 0 ? j : m), J[0])] = Q1;
  else {
    const up = J.find((j) => slope(j).sign() > 0), down = J.find((j) => slope(j).sign() < 0);
    const qu = slope(down).div(slope(down).sub(slope(up)));
    q[up] = qu; q[down] = Q1.sub(qu);
  }
  // Pure saddle point: maximin over rows equals minimax over columns.
  const rowMin = [Math.min(...pay[0]), Math.min(...pay[1])];
  const colMax = pay[0].map((_, j) => Math.max(pay[0][j], pay[1][j]));
  const maximin = Math.max(...rowMin), minimax = Math.min(...colMax);
  return { pstar, v, q, f, env, saddle: maximin === minimax ? { i: rowMin.indexOf(maximin), j: colMax.indexOf(minimax), v: maximin } : null, maximin, minimax };
}

for (const root of document.querySelectorAll("[data-gt-zerosum]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let table, game;
  const load = (key) => {
    game = ZS_GAMES[key];
    table = payoffTable(root.querySelector("[data-matrix]"), { rows: game.rows ?? ["R1", "R2"], cols: game.cols, pay: game.pay, single: true, onChange: draw, rowLabel: "Row's payoff" });
    draw();
  };
  root.addEventListener("seg-change", (e) => load(e.detail.value));

  function draw() {
    const pay = table.get();
    const r = solve2xn(pay);
    const n = pay[0].length;
    const all = pay.flat();
    const lo = Math.min(0, ...all) - 0.5, hi = Math.max(0, ...all) + 0.5;
    svg.replaceChildren();
    const step = hi - lo > 12 ? 2 : 1;
    const yt = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) yt.push(t);
    const f = frame(svg, { box: [44, 18, 540, 262], x: [0, 1], y: [lo, hi], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: yt, xfmt: (v) => String(v), yfmt: (v) => minus(v), xlabel: "p = P(row 1)", ylabel: "row's expected payoff" });
    el("line", { x1: f.sx(0), x2: f.sx(1), y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (let j = 0; j < n; j++) {
      const active = !r.q[j].isZero();
      el("line", { x1: f.sx(0), y1: f.sy(pay[1][j]), x2: f.sx(1), y2: f.sy(pay[0][j]), style: `stroke:${active ? "var(--vec-v)" : "var(--muted-foreground)"};stroke-opacity:${active ? 0.9 : 0.55};stroke-width:1.5` }, svg);
      text(svg, f.sx(1) + 6, f.sy(pay[0][j]) + 3, game.cols[j], { class: `font-mono text-[10px] ${active ? "fill-vec-v" : "fill-muted-foreground"}` });
    }
    // Lower envelope, exact at its kinks: sample breakpoints plus endpoints.
    const pts = [];
    for (let t = 0; t <= 200; t++) { const p = t / 200; pts.push([f.sx(p), f.sy(Math.min(...pay[0].map((_, j) => p * pay[0][j] + (1 - p) * pay[1][j])))]); }
    polyline(svg, pts, "stroke:var(--vec-u);stroke-width:3;stroke-linejoin:round");
    // Maximin point.
    const px = r.pstar.toNumber(), pv = r.v.toNumber();
    el("line", { x1: f.sx(px), x2: f.sx(px), y1: f.sy(pv), y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(px), cy: f.sy(pv), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, f.sx(px), f.sy(pv) - 10, `v = ${r.v}`, { "text-anchor": px > 0.85 ? "end" : px < 0.15 ? "start" : "middle", class: "fill-brand font-mono text-[11px] font-medium" });
    // The learner's p.
    const p = s.p.get();
    const g = Math.min(...pay[0].map((_, j) => p * pay[0][j] + (1 - p) * pay[1][j]));
    el("line", { x1: f.sx(p), x2: f.sx(p), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 4" }, svg);
    el("circle", { cx: f.sx(p), cy: f.sy(g), r: 4, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
    o.g.textContent = num(g, 3);
    o.pstar.textContent = `${r.pstar}  (≈ ${num(px, 3)})`;
    o.v.textContent = `${r.v}`;
    o.q.textContent = r.q.map((q, j) => (q.isZero() ? null : `${game.cols[j]} ${q}`)).filter(Boolean).join(", ");
    o.saddle.textContent = r.saddle ? `yes: (${(game.rows ?? ["R1", "R2"])[r.saddle.i]}, ${game.cols[r.saddle.j]}), value ${minus(r.saddle.v)}` : `no: maximin ${minus(r.maximin)} < minimax ${minus(r.minimax)}`;
  }
  load("mixed");
}
