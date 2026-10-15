// Game design and game AI, part 1: search (tic-tac-toe minimax with
// alpha-beta, Connect Four with iterative deepening, Monte Carlo tree
// search), collision tests and loot odds. games-world.js holds the
// procedural, feel and agent blocks.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Selected segment of a segmented control, read from the DOM.
const segValue = (root) => root.querySelector('[role=tablist] [aria-selected="true"]')?.dataset.seg;

// ============================================================ Tic-tac-toe

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function tttWinner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a], line: [a, c, d] };
  return null;
}
const tttFull = (b) => b.every(Boolean);
const other = (m) => (m === "X" ? "O" : "X");

// Score from the point of view of `me`: wins sooner are better.
function tttPlain(b, toMove, me, depth, counter) {
  counter.n++;
  const w = tttWinner(b);
  if (w) return w.mark === me ? 10 - depth : depth - 10;
  if (tttFull(b)) return 0;
  let best = toMove === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = toMove;
    const v = tttPlain(b, other(toMove), me, depth + 1, counter);
    b[i] = "";
    best = toMove === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

function tttAlphaBeta(b, toMove, me, depth, alpha, beta, counter) {
  counter.n++;
  const w = tttWinner(b);
  if (w) return w.mark === me ? 10 - depth : depth - 10;
  if (tttFull(b)) return 0;
  if (toMove === me) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = toMove;
      best = Math.max(best, tttAlphaBeta(b, other(toMove), me, depth + 1, alpha, beta, counter));
      b[i] = "";
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = toMove;
    best = Math.min(best, tttAlphaBeta(b, other(toMove), me, depth + 1, alpha, beta, counter));
    b[i] = "";
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

// Best move for `me` to move, with exact node counts for both searches.
function tttSearch(b, me) {
  const plain = { n: 0 }, pruned = { n: 0 };
  tttPlain(b.slice(), me, me, 0, plain);
  pruned.n++; // the root
  let best = -1, bestV = -Infinity, alpha = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = me;
    const v = tttAlphaBeta(b, other(me), me, 1, alpha, Infinity, pruned);
    b[i] = "";
    if (v > bestV) { bestV = v; best = i; }
    alpha = Math.max(alpha, v);
  }
  return { move: best, value: bestV, plain: plain.n, pruned: pruned.n };
}

for (const root of document.querySelectorAll("[data-game-ttt]")) {
  const cells = [...root.querySelectorAll("[data-cell]")];
  const o = outs(root);
  let b, over;
  const human = "X", ai = "O";

  const draw = () => cells.forEach((c, i) => {
    c.textContent = b[i];
    c.dataset.mark = b[i];
    c.disabled = over || !!b[i];
  });

  function finish() {
    const w = tttWinner(b);
    if (w) {
      over = true;
      w.line.forEach((i) => (cells[i].dataset.win = ""));
      o.status.textContent = w.mark === human ? "You win. (That shouldn't happen.)" : "The computer wins.";
    } else if (tttFull(b)) {
      over = true;
      o.status.textContent = "Draw: perfect play from both sides always ends here.";
    }
    draw();
    return over;
  }

  function aiMove() {
    const r = tttSearch(b, ai);
    b[r.move] = ai;
    o.plain.textContent = fmtInt(r.plain);
    o.pruned.textContent = fmtInt(r.pruned);
    o.saved.textContent = `${num(100 * (1 - r.pruned / r.plain), 1)}%`;
    o.value.textContent = r.value > 0 ? "computer can force a win" : r.value < 0 ? "you can force a win" : "draw with best play";
    if (!finish()) o.status.textContent = `Computer played square ${r.move + 1}. Your move.`;
  }

  function reset() {
    b = Array(9).fill("");
    over = false;
    cells.forEach((c) => delete c.dataset.win);
    o.status.textContent = "Your move: you are X.";
    draw();
    if (segValue(root) === "ai") aiMove();
  }

  cells.forEach((c, i) => c.addEventListener("click", () => {
    if (over || b[i]) return;
    b[i] = human;
    if (finish()) return;
    draw();
    o.status.textContent = "Thinking…";
    setTimeout(aiMove, 20);
  }));
  root.querySelector("[data-action=new]").addEventListener("click", reset);
  root.addEventListener("seg-change", reset);
  reset();
}

// ============================================================ Connect Four

const ROWS = 6, COLS = 7;
const ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre first: better pruning

function c4Drop(g, col, p) {
  for (let r = ROWS - 1; r >= 0; r--) if (!g[r][col]) { g[r][col] = p; return r; }
  return -1;
}
function c4Undo(g, col) {
  for (let r = 0; r < ROWS; r++) if (g[r][col]) { g[r][col] = 0; return; }
}
function c4WinAt(g, r, c) {
  const p = g[r][c];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && g[rr][cc] === p) { cells.push([rr, cc]); rr += dr * s; cc += dc * s; }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}
// Heuristic for `me`: every window of four scored by its contents.
function c4Eval(g, me) {
  const you = 3 - me;
  let s = 0;
  for (let r = 0; r < ROWS; r++) if (g[r][3] === me) s += 3; else if (g[r][3] === you) s -= 3;
  const win = (a, b, c, d) => {
    let m = 0, y = 0;
    for (const v of [a, b, c, d]) { if (v === me) m++; else if (v === you) y++; }
    if (m && y) return 0;
    if (m === 3) return 5;
    if (m === 2) return 2;
    if (y === 3) return -4;
    if (y === 2) return -1;
    return 0;
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 3 < COLS) s += win(g[r][c], g[r][c + 1], g[r][c + 2], g[r][c + 3]);
    if (r + 3 < ROWS) s += win(g[r][c], g[r + 1][c], g[r + 2][c], g[r + 3][c]);
    if (r + 3 < ROWS && c + 3 < COLS) s += win(g[r][c], g[r + 1][c + 1], g[r + 2][c + 2], g[r + 3][c + 3]);
    if (r + 3 < ROWS && c - 3 >= 0) s += win(g[r][c], g[r + 1][c - 1], g[r + 2][c - 2], g[r + 3][c - 3]);
  }
  return s;
}

const WIN = 100000;
class Timeout extends Error {}

function c4Negamax(g, p, depth, alpha, beta, ply, st) {
  if ((++st.nodes & 1023) === 0 && performance.now() > st.deadline) throw new Timeout();
  if (depth === 0) return c4Eval(g, p);
  let any = false, best = -Infinity;
  for (const c of ORDER) {
    if (g[0][c]) continue;
    any = true;
    const r = c4Drop(g, c, p);
    let v;
    if (c4WinAt(g, r, c)) v = WIN - ply;
    else v = -c4Negamax(g, 3 - p, depth - 1, -beta, -alpha, ply + 1, st);
    c4Undo(g, c);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}

// Iterative deepening under a time budget; returns the best move of the
// deepest search that finished.
function c4Think(g, p, budget) {
  const st = { nodes: 0, deadline: performance.now() + budget };
  const t0 = performance.now();
  let move = ORDER.find((c) => !g[0][c]), value = 0, depth = 0;
  // An immediate win or a forced block first.
  for (const who of [p, 3 - p]) for (const c of ORDER) {
    if (g[0][c]) continue;
    const r = c4Drop(g, c, who);
    const w = c4WinAt(g, r, c);
    c4Undo(g, c);
    if (w) return { move: c, value: who === p ? WIN : 0, depth: 1, nodes: 1, ms: 0, forced: who === p ? "wins" : "blocks" };
  }
  try {
    for (let d = 1; d <= 42; d++) {
      let bestC = -1, bestV = -Infinity, alpha = -Infinity;
      for (const c of ORDER) {
        if (g[0][c]) continue;
        const r = c4Drop(g, c, p);
        const v = c4WinAt(g, r, c) ? WIN : -c4Negamax(g, 3 - p, d - 1, -Infinity, -alpha, 1, st);
        c4Undo(g, c);
        if (v > bestV) { bestV = v; bestC = c; }
        alpha = Math.max(alpha, v);
      }
      move = bestC; value = bestV; depth = d;
      if (Math.abs(bestV) > WIN / 2) break;
    }
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
  }
  return { move, value, depth, nodes: st.nodes, ms: performance.now() - t0 };
}

for (const root of document.querySelectorAll("[data-game-c4]")) {
  const svg = root.querySelector("[data-board]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  let g, over, busy, winCells = [], hover = -1;
  const HUMAN = 1, AI = 2;

  function draw() {
    svg.replaceChildren();
    el("rect", { x: 4, y: 4, width: 692, height: 592, rx: 24, style: "fill:color-mix(in oklab, var(--foreground) 6%, var(--background));stroke:var(--border)" }, svg);
    if (hover >= 0 && !over && !busy) el("rect", { x: hover * 100 + 8, y: 8, width: 84, height: 584, rx: 18, style: "fill:var(--brand);fill-opacity:0.07" }, svg);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = g[r][c];
      const fill = v === HUMAN ? "var(--brand)" : v === AI ? "var(--vec-u)" : "var(--background)";
      el("circle", { cx: c * 100 + 50, cy: r * 100 + 50, r: 38, style: `fill:${fill};stroke:var(--border);stroke-width:2` }, svg);
    }
    for (const [r, c] of winCells) el("circle", { cx: c * 100 + 50, cy: r * 100 + 50, r: 18, style: "fill:none;stroke:var(--background);stroke-width:6" }, svg);
  }

  function play(c) {
    if (over || busy || c < 0 || g[0][c]) return;
    const r = c4Drop(g, c, HUMAN);
    if (end(r, c, "You win!")) return;
    busy = true;
    o.status.textContent = "Thinking…";
    draw();
    setTimeout(aiTurn, 30);
  }

  function end(r, c, msg) {
    const w = c4WinAt(g, r, c);
    if (w) { winCells = w; over = true; o.status.textContent = msg; draw(); return true; }
    if (g[0].every(Boolean)) { over = true; o.status.textContent = "Draw: the board is full."; draw(); return true; }
    return false;
  }

  function aiTurn() {
    const t = c4Think(g, AI, s.time.get());
    const r = c4Drop(g, t.move, AI);
    busy = false;
    o.depth.textContent = t.forced ? `1 (${t.forced})` : String(t.depth);
    o.nodes.textContent = fmtInt(t.nodes);
    o.rate.textContent = t.ms > 0 ? fmtInt((t.nodes / t.ms) * 1000) : "—";
    o.eval.textContent = Math.abs(t.value) > WIN / 2 ? (t.value > 0 ? "computer wins by force" : "you win by force") : (t.value >= 0 ? "+" : "") + t.value;
    if (!end(r, t.move, "The computer wins.")) o.status.textContent = `Computer dropped in column ${t.move + 1}. Your move.`;
    draw();
  }

  function reset() {
    g = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    over = false; busy = false; winCells = [];
    o.status.textContent = "Your move: click a column.";
    draw();
    if (segValue(root) === "ai") { busy = true; setTimeout(aiTurn, 30); }
  }

  const colAt = (e) => {
    const r = svg.getBoundingClientRect();
    return Math.max(0, Math.min(COLS - 1, Math.floor(((e.clientX - r.left) / r.width) * COLS)));
  };
  svg.addEventListener("pointermove", (e) => { const c = colAt(e); if (c !== hover) { hover = c; draw(); } });
  svg.addEventListener("pointerleave", () => { hover = -1; draw(); });
  svg.addEventListener("click", (e) => play(colAt(e)));
  svg.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 7) { e.preventDefault(); play(n - 1); }
  });
  root.querySelector("[data-action=new]").addEventListener("click", reset);
  root.addEventListener("seg-change", reset);
  reset();
}

// ============================================================ MCTS

function mctsNode(board, toMove, parent, move) {
  const w = tttWinner(board);
  const terminal = !!w || tttFull(board);
  return {
    board, toMove, parent, move, children: [], visits: 0, wins: 0, terminal,
    untried: terminal ? [] : board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0),
  };
}

// Result of a finished board for the player `p`: 1 win, 0.5 draw, 0 loss.
const resultFor = (board, p) => { const w = tttWinner(board); return !w ? 0.5 : w.mark === p ? 1 : 0; };

function mctsIterate(root, C, rng) {
  let node = root;
  // Selection.
  while (!node.terminal && node.untried.length === 0) {
    let best = null, bestU = -Infinity;
    const lnN = Math.log(node.visits);
    for (const ch of node.children) {
      const u = ch.wins / ch.visits + C * Math.sqrt(lnN / ch.visits);
      if (u > bestU) { bestU = u; best = ch; }
    }
    node = best;
  }
  // Expansion.
  if (!node.terminal) {
    const k = Math.floor(rng() * node.untried.length);
    const m = node.untried.splice(k, 1)[0];
    const b = node.board.slice();
    b[m] = node.toMove;
    const ch = mctsNode(b, other(node.toMove), node, m);
    node.children.push(ch);
    node = ch;
  }
  // Random playout.
  const b = node.board.slice();
  let p = node.toMove;
  while (!tttWinner(b) && !tttFull(b)) {
    const free = [];
    for (let i = 0; i < 9; i++) if (!b[i]) free.push(i);
    b[free[Math.floor(rng() * free.length)]] = p;
    p = other(p);
  }
  // Backpropagation: each node keeps wins for the player who moved into it.
  for (let n = node; n; n = n.parent) {
    n.visits++;
    const mover = other(n.toMove);
    n.wins += resultFor(b, mover);
  }
}

for (const root of document.querySelectorAll("[data-game-mcts]")) {
  const cells = [...root.querySelectorAll("[data-cell]")];
  const o = outs(root);
  const s = scrubAll(root, () => resetTree());
  const rng = mulberry32(2024);
  let board = Array(9).fill(""), tree, total = 0, rate = 0, running = 0;

  const toMove = () => (board.filter((v) => v === "X").length > board.filter((v) => v === "O").length ? "O" : "X");

  function resetTree() {
    tree = mctsNode(board.slice(), toMove(), null, -1);
    total = 0; rate = 0;
    draw();
  }

  function exactBest() {
    const me = toMove();
    if (tttWinner(board) || tttFull(board)) return "game over";
    const vals = [];
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = me;
      vals.push([i, tttAlphaBeta(board, other(me), me, 1, -Infinity, Infinity, { n: 0 })]);
      board[i] = "";
    }
    const top = Math.max(...vals.map((v) => v[1]));
    const best = vals.filter((v) => v[1] === top).map((v) => v[0] + 1);
    return `square ${best.join(" / ")} (${top > 0 ? "win" : top < 0 ? "loss" : "draw"})`;
  }

  function draw() {
    const kids = new Map(tree.children.map((c) => [c.move, c]));
    const most = tree.children.reduce((a, c) => (!a || c.visits > a.visits ? c : a), null);
    cells.forEach((c, i) => {
      c.querySelector("[data-mark]").textContent = board[i];
      c.querySelector("[data-mark]").className = "font-mono text-3xl font-medium " + (board[i] === "O" ? "text-vec-u" : "");
      const k = kids.get(i);
      c.querySelector("[data-stat]").textContent = k ? `${fmtInt(k.visits)} · ${num((100 * k.wins) / k.visits, 0)}%` : "";
      if (most && most.move === i && total > 0) c.dataset.best = ""; else delete c.dataset.best;
    });
    const w = tttWinner(board);
    o.turn.textContent = w ? `${w.mark} has won: set up another position.` : tttFull(board) ? "Board full." : `${toMove()} to move. Click squares to set up a position.`;
    o.playouts.textContent = fmtInt(total);
    o.rate.textContent = rate ? fmtInt(rate) : "—";
    o.pick.textContent = most && total ? `square ${most.move + 1}` : "—";
    o.exact.textContent = exactBest();
  }

  function run(n) {
    if (running || tree.terminal) return;
    let left = n;
    const t0 = performance.now();
    running = 1;
    const tick = () => {
      const end = performance.now() + 12;
      while (left > 0 && performance.now() < end) {
        for (let k = 0; k < 50 && left > 0; k++, left--) mctsIterate(tree, s.c.get(), rng);
      }
      total = tree.visits;
      rate = ((n - left) / (performance.now() - t0)) * 1000;
      draw();
      if (left > 0) requestAnimationFrame(tick); else running = 0;
    };
    requestAnimationFrame(tick);
  }

  cells.forEach((c, i) => c.addEventListener("click", () => {
    if (running) return;
    board[i] = board[i] === "" ? "X" : board[i] === "X" ? "O" : "";
    const nx = board.filter((v) => v === "X").length, no = board.filter((v) => v === "O").length;
    if (nx - no > 1 || no > nx) board[i] = ""; // keep the position legal
    resetTree();
  }));
  root.querySelector("[data-action=run1k]").addEventListener("click", () => run(1000));
  root.querySelector("[data-action=run10k]").addEventListener("click", () => run(10000));
  root.querySelector("[data-action=reset]").addEventListener("click", resetTree);
  root.querySelector("[data-action=clear]").addEventListener("click", () => { board = Array(9).fill(""); resetTree(); });
  // A position worth thinking about: X to move, one move wins.
  board = ["X", "O", "", "", "X", "", "", "O", ""];
  resetTree();
}

// ============================================================ Collision

for (const root of document.querySelectorAll("[data-game-collide]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let mode = "aabb";
  const pos = { a: [200, 190], b: [360, 170] };

  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const norm = (p) => { const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l]; };

  function polyA() {
    const [cx, cy] = pos.a;
    return Array.from({ length: 5 }, (_, i) => { const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [cx + 70 * Math.cos(t), cy + 70 * Math.sin(t)]; });
  }
  function polyB() {
    const [cx, cy] = pos.b, a = (s.rot.get() * Math.PI) / 180;
    return [[-80, -35], [80, -35], [80, 35], [-80, 35]].map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  const project = (poly, ax) => { const d = poly.map((p) => dot(p, ax)); return [Math.min(...d), Math.max(...d)]; };

  function sat(A, B) {
    const axes = [];
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const e = sub(P[(i + 1) % P.length], P[i]);
      axes.push(norm([-e[1], e[0]]));
    }
    let tests = 0, minOverlap = Infinity, mtv = null, sep = null, gap = 0;
    for (const ax of axes) {
      tests++;
      const [a0, a1] = project(A, ax), [b0, b1] = project(B, ax);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      if (overlap < 0) { sep = ax; gap = -overlap; break; }
      if (overlap < minOverlap) { minOverlap = overlap; mtv = ax; }
    }
    return sep ? { hit: false, axis: sep, gap, tests } : { hit: true, axis: mtv, depth: minOverlap, tests };
  }

  function shapes() {
    const [ax, ay] = pos.a, [bx, by] = pos.b;
    if (mode === "aabb") return { A: { box: [ax - 80, ay - 50, 160, 100] }, B: { box: [bx - 60, by - 70, 120, 140] } };
    if (mode === "circle") return { A: { circle: [ax, ay, 70] }, B: { circle: [bx, by, 55] } };
    if (mode === "boxcircle") return { A: { box: [ax - 80, ay - 55, 160, 110] }, B: { circle: [bx, by, 55] } };
    return { A: { poly: polyA() }, B: { poly: polyB() } };
  }

  function test(S) {
    const { A, B } = S;
    if (mode === "aabb") {
      const [x0, y0, w0, h0] = A.box, [x1, y1, w1, h1] = B.box;
      const ox = Math.min(x0 + w0, x1 + w1) - Math.max(x0, x1);
      const oy = Math.min(y0 + h0, y1 + h1) - Math.max(y0, y1);
      const hit = ox > 0 && oy > 0;
      if (hit) return { hit, axisName: ox < oy ? "x (least overlap)" : "y (least overlap)", depth: Math.min(ox, oy), tests: 2, push: ox < oy ? [Math.sign(x1 - x0) * ox, 0] : [0, Math.sign(y1 - y0) * oy] };
      return { hit, axisName: ox <= 0 ? "x" : "y", gap: ox <= 0 ? -ox : -oy, tests: ox <= 0 ? 1 : 2 };
    }
    if (mode === "circle") {
      const [x0, y0, r0] = A.circle, [x1, y1, r1] = B.circle;
      const d = Math.hypot(x1 - x0, y1 - y0);
      const hit = d < r0 + r1;
      const n = norm([x1 - x0, y1 - y0]);
      return hit ? { hit, axisName: "centre line", depth: r0 + r1 - d, tests: 1, push: [n[0] * (r0 + r1 - d), n[1] * (r0 + r1 - d)] } : { hit, axisName: "centre line", gap: d - r0 - r1, tests: 1 };
    }
    if (mode === "boxcircle") {
      const [x0, y0, w0, h0] = A.box, [cx, cy, r] = B.circle;
      const px = Math.max(x0, Math.min(cx, x0 + w0)), py = Math.max(y0, Math.min(cy, y0 + h0));
      const d = Math.hypot(cx - px, cy - py);
      const hit = d < r;
      return { hit, axisName: "closest point", ...(hit ? { depth: r - d } : { gap: d - r }), tests: 1, closest: [px, py] };
    }
    const r = sat(A.poly, B.poly);
    return { ...r, axisName: `(${num(r.axis[0], 2)}, ${num(r.axis[1], 2)})`, push: r.hit ? [r.axis[0] * r.depth, r.axis[1] * r.depth] : null };
  }

  const shapeStyle = (c, hit) => `fill:${c};fill-opacity:${hit ? 0.28 : 0.12};stroke:${c};stroke-width:2`;

  function drawShape(sh, c, hit, key) {
    let n;
    if (sh.box) n = el("rect", { x: sh.box[0], y: sh.box[1], width: sh.box[2], height: sh.box[3], rx: 4, style: shapeStyle(c, hit) }, svg);
    else if (sh.circle) n = el("circle", { cx: sh.circle[0], cy: sh.circle[1], r: sh.circle[2], style: shapeStyle(c, hit) }, svg);
    else n = el("path", { d: "M" + sh.poly.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L") + "Z", style: shapeStyle(c, hit) }, svg);
    n.setAttribute("tabindex", "0");
    n.setAttribute("role", "button");
    n.setAttribute("aria-label", `Shape ${key.toUpperCase()}: drag or use the arrow keys`);
    n.dataset.shape = key;
    n.style.cursor = "grab";
    n.classList.add("outline-none");
  }

  function draw() {
    svg.replaceChildren();
    el("rect", { x: 0, y: 0, width: 560, height: 380, style: "fill:none" }, svg);
    const S = shapes();
    const r = test(S);
    // The axis and the shapes' shadows on it (SAT).
    if (mode === "sat") {
      const ax = r.axis, c = [280, 340];
      const along = (t) => [c[0] + ax[0] * (t - dot(c, ax)), c[1] + ax[1] * (t - dot(c, ax))];
      const pA = project(S.A.poly, ax), pB = project(S.B.poly, ax);
      const lo = Math.min(pA[0], pB[0]) - 30, hi = Math.max(pA[1], pB[1]) + 30;
      const p0 = along(lo), p1 = along(hi);
      el("line", { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4" }, svg);
      for (const [rng, col] of [[pA, "var(--vec-u)"], [pB, "var(--brand)"]]) {
        const q0 = along(rng[0]), q1 = along(rng[1]);
        el("line", { x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1], style: `stroke:${col};stroke-width:6;stroke-linecap:round;stroke-opacity:0.8` }, svg);
      }
      text(svg, p1[0] + 4, p1[1] + 4, r.hit ? "least-overlap axis" : "separating axis");
    }
    drawShape(S.A, "var(--vec-u)", r.hit, "a");
    drawShape(S.B, "var(--brand)", r.hit, "b");
    if (r.closest) el("circle", { cx: r.closest[0], cy: r.closest[1], r: 4, style: "fill:var(--foreground)" }, svg);
    if (r.push) {
      const [bx, by] = pos.b;
      el("line", { x1: bx, y1: by, x2: bx + r.push[0], y2: by + r.push[1], style: "stroke:var(--code-del);stroke-width:2.5" }, svg);
      el("circle", { cx: bx + r.push[0], cy: by + r.push[1], r: 3.5, style: "fill:var(--code-del)" }, svg);
    }
    o.hit.textContent = r.hit ? "yes" : "no";
    o.hit.className = r.hit ? "text-del" : "text-add";
    o.axis.textContent = r.axisName;
    o.depth.textContent = r.hit ? `overlap ${num(r.depth, 1)} px` : `gap ${num(r.gap, 1)} px`;
    o.tests.textContent = String(r.tests);
  }

  // Dragging and keyboard moves.
  let drag = null;
  const toSvg = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  svg.addEventListener("pointerdown", (e) => {
    const k = e.target.dataset?.shape;
    if (!k) return;
    const p = toSvg(e);
    drag = { k, dx: pos[k][0] - p[0], dy: pos[k][1] - p[1], id: e.pointerId };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toSvg(e);
    pos[drag.k] = [Math.max(0, Math.min(560, p[0] + drag.dx)), Math.max(0, Math.min(380, p[1] + drag.dy))];
    draw();
  });
  svg.addEventListener("pointerup", () => (drag = null));
  svg.addEventListener("keydown", (e) => {
    const k = e.target.dataset?.shape;
    const d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
    if (!k || !d) return;
    e.preventDefault();
    pos[k] = [pos[k][0] + d[0], pos[k][1] + d[1]];
    draw();
    svg.querySelector(`[data-shape="${k}"]`)?.focus();
  });
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  draw();
}

// ============================================================ Loot odds

for (const root of document.querySelectorAll("[data-game-loot]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => { sim = null; draw(); });
  let seed = 1, sim = null;

  // CDF of the try of the first drop, with optional hard pity N.
  const cdf = (k, p, N) => (N > 0 && k >= N ? 1 : 1 - Math.pow(1 - p, k));
  function mean(p, N) {
    if (!(N > 0)) return 1 / p;
    let m = 0;
    for (let k = 1; k < N; k++) m += k * p * Math.pow(1 - p, k - 1);
    return m + N * Math.pow(1 - p, N - 1);
  }
  function quantile(q, p, N) {
    const k = Math.ceil(Math.log(1 - q) / Math.log(1 - p));
    return N > 0 ? Math.min(k, N) : k;
  }

  function simulate(p, N, n) {
    const rng = mulberry32(seed * 7919);
    const players = 10000;
    let got = 0, total = 0;
    const firsts = new Int32Array(players);
    for (let i = 0; i < players; i++) {
      let k = 1;
      while (!(rng() < p) && !(N > 0 && k >= N)) k++;
      firsts[i] = k;
      total += k;
      if (k <= n) got++;
    }
    return { share: got / players, mean: total / players, firsts };
  }

  function draw() {
    const p = s.p.get() / 100, n = Math.round(s.n.get()), N = Math.round(s.pity.get());
    const q99 = quantile(0.99, p, N);
    const xmax = Math.max(10, Math.min(2000, Math.max(n, q99) * 1.1));
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 496, 262], x: [0, xmax], y: [0, 1], xticks: niceTicks(xmax), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${v * 100}%`, xlabel: "tries", ylabel: "has the drop" });
    const pts = [];
    for (let k = 0; k <= xmax; k += Math.max(1, Math.floor(xmax / 400))) {
      // The pity try is a jump: draw it as a vertical step.
      if (N > 0 && k >= N && pts.length && pts.at(-1)[0] < f.sx(N)) pts.push([f.sx(N), f.sy(cdf(N - 1, p, N))], [f.sx(N), f.sy(1)]);
      pts.push([f.sx(k), f.sy(cdf(k, p, N))]);
    }
    if (sim) {
      const counts = new Float64Array(Math.ceil(xmax) + 2);
      for (const k of sim.firsts) if (k <= xmax) counts[k]++;
      let acc = 0;
      const sp = [];
      for (let k = 0; k <= xmax; k++) { acc += counts[k] || 0; if (k % Math.max(1, Math.floor(xmax / 120)) === 0) sp.push([f.sx(k), f.sy(acc / 10000)]); }
      polyline(svg, sp, "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:3 3");
    }
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    const at = cdf(n, p, N);
    el("line", { x1: f.sx(n), x2: f.sx(n), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, svg);
    el("circle", { cx: f.sx(n), cy: f.sy(at), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(n) + 6, f.sy(at) + 14, `${num(at * 100, 1)}% after ${n}`);
    if (N > 0 && N <= xmax) text(svg, f.sx(N) - 4, f.T + 10, "pity", { "text-anchor": "end" });
    o.atleast.textContent = `${num(at * 100, 1)}%`;
    o.mean.textContent = num(mean(p, N), 1);
    o.quant.textContent = [0.5, 0.9, 0.99].map((q) => quantile(q, p, N)).join(" / ");
    o.sim.textContent = sim ? `${num(sim.share * 100, 1)}% · mean ${num(sim.mean, 1)}` : "—";
  }

  function niceTicks(max) {
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((st) => max / st <= 6) ?? 500;
    const t = [];
    for (let v = 0; v <= max; v += step) t.push(v);
    return t;
  }

  root.querySelector("[data-action=sim]").addEventListener("click", () => {
    seed++;
    sim = simulate(s.p.get() / 100, Math.round(s.pity.get()), Math.round(s.n.get()));
    draw();
  });
  draw();
}
