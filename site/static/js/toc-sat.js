// Theory of computation, part three: satisfiability. Karp's reduction from
// 3-SAT to independent set with a polynomial verifier beside an exhaustive
// search, and the DPLL procedure recorded step by step.

import { h, s, stext, msg, out, onInput, stepper, presets, setInput } from "./plt-ui.js";

/** Parses "x1 ∨ ¬x2 ; x3" (also -, ~, !, v, |, ∧, &) into clauses of
 *  literals {v, neg}. Throws with a readable message. */
export function parseCNF(src) {
  const clauses = src.split(/[;∧&]/).map((c) => c.trim()).filter(Boolean).map((c, j) =>
    c.replace(/[()]/g, "").split(/\s*(?:∨|\||\bv\b|,|\s)\s*/).filter(Boolean).map((t) => {
      const m = /^([¬~!-]*)([A-Za-z]\w*)$/.exec(t);
      if (!m) throw new Error(`clause ${j + 1}: cannot read “${t}”`);
      return { v: m[2], neg: m[1].length % 2 === 1 };
    }));
  if (!clauses.length) throw new Error("write at least one clause");
  const vars = [];
  for (const c of clauses) for (const l of c) if (!vars.includes(l.v)) vars.push(l.v);
  return { clauses, vars };
}

const litText = (l) => (l.neg ? "¬" : "") + l.v;

const SAT_PRESETS = [
  ["satisfiable", "x1 ∨ x2 ∨ ¬x3 ; ¬x1 ∨ x3 ∨ x4 ; ¬x2 ∨ ¬x3 ∨ ¬x4 ; x1 ∨ ¬x2 ∨ x4"],
  ["all 8 clauses on 3 variables", "x1 ∨ x2 ∨ x3 ; x1 ∨ x2 ∨ ¬x3 ; x1 ∨ ¬x2 ∨ x3 ; x1 ∨ ¬x2 ∨ ¬x3 ; ¬x1 ∨ x2 ∨ x3 ; ¬x1 ∨ x2 ∨ ¬x3 ; ¬x1 ∨ ¬x2 ∨ x3 ; ¬x1 ∨ ¬x2 ∨ ¬x3"],
  ["x ∧ ¬x", "x1 ; ¬x1"],
  ["two clauses", "a ∨ b ∨ c ; ¬a ∨ ¬b"],
];

// ------------------------------------------------------------ reduction

/** The graph of the reduction: a vertex per literal occurrence, a triangle
 *  per clause, an edge between every literal and its negation. */
export function reduce(cnf) {
  const V = [], E = [];
  cnf.clauses.forEach((c, j) => c.forEach((l, i) => V.push({ ...l, clause: j, i })));
  const adj = V.map(() => new Set());
  const add = (a, b, kind) => { if (!adj[a].has(b)) { adj[a].add(b); adj[b].add(a); E.push({ a, b, kind }); } };
  for (let a = 0; a < V.length; a++) for (let b = a + 1; b < V.length; b++) {
    if (V[a].clause === V[b].clause) add(a, b, "clause");
    else if (V[a].v === V[b].v && V[a].neg !== V[b].neg) add(a, b, "conflict");
  }
  return { V, E, adj, k: cnf.clauses.length };
}

/** Checks a proposed set; counts each adjacency lookup as one step. */
export function verifyIS(g, set) {
  let steps = 0;
  const list = [...set];
  for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    steps++;
    if (g.adj[list[x]].has(list[y])) return { ok: false, steps, clash: [list[x], list[y]] };
  }
  return { ok: list.length === g.k, steps, size: list.length };
}

/** One vertex per triangle, depth first, pruning on edges. */
export function searchIS(g) {
  const byClause = Array.from({ length: g.k }, () => []);
  g.V.forEach((v, idx) => byClause[v.clause].push(idx));
  let tried = 0;
  const pick = [];
  const go = (j) => {
    if (j === g.k) return true;
    for (const v of byClause[j]) {
      tried++;
      if (pick.some((u) => g.adj[u].has(v))) continue;
      pick.push(v);
      if (go(j + 1)) return true;
      pick.pop();
    }
    return false;
  };
  const found = go(0);
  return { found, set: found ? new Set(pick) : null, tried, space: byClause.reduce((a, c) => a * c.length, 1) };
}

for (const root of document.querySelectorAll("[data-toc-red]")) {
  const cnfIn = root.querySelector('[data-in="cnf"]');
  const svg = root.querySelector("[data-graph]");
  let cnf, g, chosen = new Set(), tried = null;

  function build() {
    try {
      cnf = parseCNF(cnfIn.value);
      if (cnf.clauses.some((c) => c.length > 3)) throw new Error("3-SAT: at most three literals per clause");
      cnfIn.removeAttribute("data-bad");
    } catch (e) {
      cnfIn.toggleAttribute("data-bad", true);
      msg(root, e.message, "bad");
      return;
    }
    g = reduce(cnf);
    chosen = new Set();
    tried = null;
    render();
  }

  function layout() {
    const perRow = Math.min(4, g.k), rowsN = Math.ceil(g.k / perRow);
    const W = 560, cellW = W / perRow, cellH = 150, R = 36;
    const pos = g.V.map((v) => {
      const j = v.clause, cx = cellW * (j % perRow) + cellW / 2, cy = cellH * Math.floor(j / perRow) + cellH / 2 + 6;
      const n = cnf.clauses[j].length, a = -Math.PI / 2 + (2 * Math.PI * v.i) / Math.max(n, 1) + (n === 2 ? Math.PI / 2 : 0);
      return n === 1 ? { x: cx, y: cy } : { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    return { pos, W, H: cellH * rowsN + 40, cellW, cellH, perRow };
  }

  function render() {
    const L = layout();
    svg.setAttribute("viewBox", `0 0 ${L.W} ${L.H}`);
    svg.replaceChildren();
    const v = verifyIS(g, chosen);
    const clash = v.clash ? new Set(v.clash) : new Set();
    cnf.clauses.forEach((c, j) => stext(svg, L.cellW * (j % L.perRow) + L.cellW / 2, L.cellH * Math.floor(j / L.perRow) + 14, `clause ${j + 1}`, { style: "fill:var(--muted-foreground)" }));
    for (const e of g.E) {
      const a = L.pos[e.a], b = L.pos[e.b];
      const hot = clash.has(e.a) && clash.has(e.b);
      if (e.kind === "clause") {
        s("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, style: `stroke:${hot ? "var(--code-del)" : "currentColor"};stroke-opacity:${hot ? 1 : 0.45};stroke-width:${hot ? 2 : 1.2}` }, svg);
        continue;
      }
      // Conflict edges bow away from the triangles so they never run
      // along a triangle's side.
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const bow = Math.min(46, 14 + len * 0.12) * (dx >= 0 ? 1 : -1);
      const mx = (a.x + b.x) / 2 - (dy / len) * bow, my = (a.y + b.y) / 2 + (dx / len) * bow;
      s("path", { d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`, style: `fill:none;stroke:var(--code-del);stroke-opacity:${hot ? 1 : 0.4};stroke-width:${hot ? 2 : 1};stroke-dasharray:${hot ? "none" : "3 3"}` }, svg);
    }
    g.V.forEach((vx, idx) => {
      const p = L.pos[idx], on = chosen.has(idx), bad = clash.has(idx);
      const grp = s("g", { tabindex: "0", role: "button", "aria-pressed": String(on), "aria-label": `${litText(vx)} in clause ${vx.clause + 1}`, class: "cursor-pointer outline-none [&:focus-visible>circle]:stroke-[3px]" }, svg);
      s("circle", { cx: p.x, cy: p.y, r: 17, style: `fill:${on ? "color-mix(in oklab, var(--brand) 22%, var(--code-bg))" : "var(--code-bg)"};stroke:${bad ? "var(--code-del)" : on ? "var(--brand)" : "currentColor"};stroke-opacity:${on || bad ? 1 : 0.6};stroke-width:${on || bad ? 2 : 1.2};transition:fill .15s,stroke .15s` }, grp);
      stext(grp, p.x, p.y, litText(vx), { "dominant-baseline": "central", style: `fill:${on ? "var(--brand)" : "var(--foreground)"};pointer-events:none` });
      const toggle = () => { on ? chosen.delete(idx) : chosen.add(idx); render(); svg.querySelectorAll("g[role=button]")[idx]?.focus(); };
      grp.addEventListener("click", toggle);
      grp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });

    out(root, "size", `${g.V.length} · ${g.E.length}`);
    out(root, "k", String(g.k));
    out(root, "chosen", `${chosen.size} of ${g.k}`);
    out(root, "verify", `${v.steps} pair check${v.steps === 1 ? "" : "s"}`);
    out(root, "tried", tried ? `${tried.tried} of up to ${tried.space.toLocaleString("en")}` : "—");
    const a = root.querySelector('[data-out="assign"]');
    if (v.clash) {
      msg(root, `Not independent: ${litText(g.V[v.clash[0]])} and ${litText(g.V[v.clash[1]])} are joined ${g.V[v.clash[0]].clause === g.V[v.clash[1]].clause ? "(same clause)" : "(a variable cannot be both)"}.`, "bad");
      a.textContent = "—"; a.className = "tabular-nums";
    } else if (v.ok) {
      const val = new Map([...chosen].map((i) => [g.V[i].v, !g.V[i].neg]));
      const sat = cnf.clauses.every((c) => c.some((l) => val.has(l.v) && val.get(l.v) !== l.neg));
      msg(root, `Independent set of size k found. Make its literals true: every clause has one, so the formula is ${sat ? "satisfied" : "NOT satisfied (bug)"}.`, "good");
      a.textContent = cnf.vars.map((x) => `${x}=${val.has(x) ? (val.get(x) ? 1 : 0) : "any"}`).join(" ");
      a.className = "tabular-nums text-add";
    } else {
      msg(root, chosen.size ? `Independent so far; pick one vertex in each of the ${g.k - chosen.size} remaining triangles.` : "Click vertices to build an independent set, one per triangle.");
      a.textContent = "—"; a.className = "tabular-nums";
    }
  }

  root.querySelector('[data-act="solve"]').addEventListener("click", () => {
    if (!g) return;
    tried = searchIS(g);
    if (tried.found) chosen = tried.set;
    render();
    if (!tried.found) msg(root, `No independent set of size ${g.k} exists after ${tried.tried} tries, so the formula is unsatisfiable.`, "bad");
  });
  root.querySelector('[data-act="clear"]').addEventListener("click", () => { chosen = new Set(); tried = null; if (g) render(); });
  presets(root.querySelector("[data-presets]"), SAT_PRESETS, (v) => setInput(cnfIn, v));
  onInput(cnfIn, build, 200);
  build();
}

// ------------------------------------------------------------ DPLL

const MAX_FRAMES = 3000;

/** Runs DPLL with unit propagation and chronological backtracking,
 *  recording a frame after every action. */
export function dpll(cnf) {
  const order = cnf.vars;
  const trail = [];
  const frames = [];
  let decisions = 0, props = 0, backtracks = 0;
  const val = () => new Map(trail.map((t) => [t.v, t.val]));
  const litVal = (m, l) => (m.has(l.v) ? m.get(l.v) !== l.neg : undefined);
  const push = (text, focus, verdict = null) => frames.push({ trail: trail.map((t) => ({ ...t })), text, focus, decisions, props, backtracks, verdict });
  push("Nothing assigned yet.", -1);
  while (frames.length < MAX_FRAMES) {
    const m = val();
    // Conflict?
    const conflict = cnf.clauses.findIndex((c) => c.every((l) => litVal(m, l) === false));
    if (conflict >= 0) {
      const k = trail.map((t) => t.kind).lastIndexOf("decide");
      if (k < 0) { push(`Clause ${conflict + 1} is false and no guess is left to undo: unsatisfiable.`, conflict, false); return frames; }
      push(`Conflict: every literal of clause ${conflict + 1} is false.`, conflict);
      const t = trail[k];
      trail.length = k;
      trail.push({ v: t.v, val: !t.val, kind: "flip" });
      backtracks++;
      push(`Backtrack: undo the guess ${t.v} = ${t.val ? 1 : 0} and everything after it; now ${t.v} = ${t.val ? 0 : 1}.`, -1);
      continue;
    }
    // Unit clause?
    let unit = -1, lit = null;
    for (let j = 0; j < cnf.clauses.length && unit < 0; j++) {
      const c = cnf.clauses[j];
      if (c.some((l) => litVal(m, l) === true)) continue;
      const free = c.filter((l) => litVal(m, l) === undefined);
      if (free.length === 1) { unit = j; lit = free[0]; }
    }
    if (unit >= 0) {
      trail.push({ v: lit.v, val: !lit.neg, kind: "unit" });
      props++;
      push(`Unit propagation: clause ${unit + 1} has one free literal left, so ${litText(lit)} must be true.`, unit);
      continue;
    }
    if (cnf.clauses.every((c) => c.some((l) => litVal(m, l) === true))) {
      push(`Every clause is satisfied: ${order.map((x) => `${x}=${m.has(x) ? (m.get(x) ? 1 : 0) : "any"}`).join(" ")}.`, -1, true);
      return frames;
    }
    const v = order.find((x) => !m.has(x));
    trail.push({ v, val: true, kind: "decide" });
    decisions++;
    push(`Guess ${v} = 1.`, -1);
  }
  push("Stopped after too many steps.", -1, null);
  return frames;
}

for (const root of document.querySelectorAll("[data-toc-dpll]")) {
  const cnfIn = root.querySelector('[data-in="cnf"]');
  const clausesEl = root.querySelector("[data-clauses]"), trailEl = root.querySelector("[data-trail]");
  let cnf, frames = [], step = 0;

  function build() {
    try {
      cnf = parseCNF(cnfIn.value);
      cnfIn.removeAttribute("data-bad");
    } catch (e) {
      cnfIn.toggleAttribute("data-bad", true);
      msg(root, e.message, "bad");
      return;
    }
    frames = dpll(cnf);
    step = 0;
    render();
  }
  function render() {
    const f = frames[step];
    const m = new Map(f.trail.map((t) => [t.v, t.val]));
    clausesEl.replaceChildren(...cnf.clauses.map((c, j) => {
      const vals = c.map((l) => (m.has(l.v) ? m.get(l.v) !== l.neg : undefined));
      const sat = vals.some((x) => x === true), dead = vals.every((x) => x === false);
      return h("div", {
        class: "flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 transition-colors duration-150 " +
          (j === f.focus ? "border-brand " : "border-transparent ") + (sat ? "text-add" : dead ? "text-del" : ""),
      },
        h("span", { class: "w-6 text-[11px] text-muted-foreground", text: String(j + 1) }),
        ...c.flatMap((l, i) => [i ? h("span", { class: "text-muted-foreground", text: "∨" }) : null,
          h("span", { class: vals[i] === false ? "text-muted-foreground line-through opacity-60" : vals[i] === true ? "font-medium" : "", text: litText(l) })]));
    }));
    trailEl.replaceChildren(...(f.trail.length ? f.trail.map((t) => h("span", {
      class: "rounded border px-1.5 py-0.5 " + (t.kind === "decide" ? "border-brand text-brand" : t.kind === "flip" ? "border-dashed" : "text-muted-foreground"),
      text: `${t.v}=${t.val ? 1 : 0}`, attrs: { title: { decide: "guess", unit: "forced by a unit clause", flip: "the other branch after a conflict" }[t.kind] },
    })) : [h("span", { class: "text-muted-foreground", text: "empty" })]));
    out(root, "step", `${step} / ${frames.length - 1}`);
    out(root, "decisions", String(f.decisions));
    out(root, "props", String(f.props));
    out(root, "backtracks", String(f.backtracks));
    const last = frames.at(-1), v = root.querySelector('[data-out="verdict"]');
    v.textContent = step === frames.length - 1 ? (last.verdict ? "satisfiable" : last.verdict === false ? "unsatisfiable" : "gave up") : "searching…";
    v.className = "tabular-nums " + (step === frames.length - 1 ? (last.verdict ? "text-add" : "text-del") : "");
    msg(root, f.text, f.verdict === true ? "good" : f.verdict === false ? "bad" : "");
  }
  stepper(root, {
    reset: () => { step = 0; render(); },
    back: () => { step = Math.max(0, step - 1); render(); },
    step: () => { step = Math.min(frames.length - 1, step + 1); render(); },
    run: () => { step = frames.length - 1; render(); },
  });
  presets(root.querySelector("[data-presets]"), [
    ["needs a backtrack", "x1 ∨ x2 ; ¬x1 ∨ x3 ; ¬x3 ∨ ¬x2 ; x2 ∨ x4 ; ¬x4 ∨ ¬x1 ; x1 ∨ ¬x3 ∨ x4"],
    ["propagation only", "x1 ; ¬x1 ∨ x2 ; ¬x2 ∨ x3 ; ¬x3 ∨ x4"],
    ["3 pigeons, 2 holes", "p11 ∨ p12 ; p21 ∨ p22 ; p31 ∨ p32 ; ¬p11 ∨ ¬p21 ; ¬p11 ∨ ¬p31 ; ¬p21 ∨ ¬p31 ; ¬p12 ∨ ¬p22 ; ¬p12 ∨ ¬p32 ; ¬p22 ∨ ¬p32"],
    ["all 8 on 3 variables", SAT_PRESETS[1][1]],
  ], (v) => setInput(cnfIn, v));
  onInput(cnfIn, build, 200);
  build();
}
