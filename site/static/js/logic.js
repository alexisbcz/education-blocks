// Logic blocks: a propositional parser with truth tables, a full adder,
// argument validity by exhaustive search, Venn-diagram syllogisms, set
// operations, quantifiers over a finite world, and an induction stepper.

import { scrubAll } from "./scrub.js";
import { el, text } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TF = (v) => (v ? "T" : "F");

// ============================================================ Parser
//
// Grammar, loosest first: iff := imp (↔ imp)* ; imp := or (→ imp)? (right
// associative) ; or := and (∨ and)* ; and := not (∧ not)* ;
// not := ¬ not | atom ; atom := variable | ⊤ | ⊥ | ( iff ).

const SYMBOLS = [
  ["<->", "↔"], ["<=>", "↔"], ["->", "→"], ["=>", "→"], ["~", "¬"], ["!", "¬"], ["&", "∧"], ["|", "∨"],
];

function tokenize(src) {
  let s = src;
  for (const [a, b] of SYMBOLS) s = s.split(a).join(b);
  const toks = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if ("¬∧∨→↔()⊤⊥".includes(c)) { toks.push(c); i++; continue; }
    const m = /^[A-Za-z][A-Za-z0-9_]*/.exec(s.slice(i));
    if (m) {
      const w = m[0];
      toks.push(w === "T" || w === "true" ? "⊤" : w === "F" || w === "false" ? "⊥" : { v: w });
      i += w.length;
      continue;
    }
    throw new Error(`unexpected “${c}” at position ${i + 1}`);
  }
  return toks;
}

export function parse(src) {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const eat = (t) => {
    if (toks[i] !== t) throw new Error(`expected “${t}”${toks[i] ? ` but found “${typeof toks[i] === "string" ? toks[i] : toks[i].v}”` : " at the end"}`);
    i++;
  };
  const bin = (op, l, r) => ({ op, l, r });
  function iff() { let l = imp(); while (peek() === "↔") { i++; l = bin("↔", l, imp()); } return l; }
  function imp() { const l = or(); if (peek() === "→") { i++; return bin("→", l, imp()); } return l; }
  function or() { let l = and(); while (peek() === "∨") { i++; l = bin("∨", l, and()); } return l; }
  function and() { let l = not(); while (peek() === "∧") { i++; l = bin("∧", l, not()); } return l; }
  function not() { if (peek() === "¬") { i++; return { op: "¬", x: not() }; } return atom(); }
  function atom() {
    const t = peek();
    if (t === undefined) throw new Error("the formula ends too early");
    if (t === "(") { i++; const e = iff(); eat(")"); return e; }
    if (t === "⊤" || t === "⊥") { i++; return { c: t === "⊤" }; }
    if (typeof t === "object") { i++; return { v: t.v }; }
    throw new Error(`unexpected “${t}”`);
  }
  if (!toks.length) throw new Error("type a formula");
  const e = iff();
  if (i < toks.length) throw new Error(`unexpected “${typeof toks[i] === "string" ? toks[i] : toks[i].v}” after a complete formula`);
  return e;
}

export function evaluate(e, env) {
  if ("v" in e) return env[e.v];
  if ("c" in e) return e.c;
  switch (e.op) {
    case "¬": return !evaluate(e.x, env);
    case "∧": return evaluate(e.l, env) && evaluate(e.r, env);
    case "∨": return evaluate(e.l, env) || evaluate(e.r, env);
    case "→": return !evaluate(e.l, env) || evaluate(e.r, env);
    case "↔": return evaluate(e.l, env) === evaluate(e.r, env);
  }
}

// Mixed binary operators always get parentheses, even where precedence
// would make them optional: (p → q) ↔ (¬q → ¬p) reads better than
// p → q ↔ ¬q → ¬p. A chain of the same associative operator stays flat.
export function show(e, parentOp = null) {
  if ("v" in e) return e.v;
  if ("c" in e) return e.c ? "⊤" : "⊥";
  if (e.op === "¬") return "¬" + show(e.x, "¬");
  const s = `${show(e.l, e.op)} ${e.op} ${show(e.r, e.op)}`;
  const flat = parentOp === e.op && (e.op === "∧" || e.op === "∨");
  return parentOp && !flat ? `(${s})` : s;
}

export function variables(e, set = new Set()) {
  if ("v" in e) set.add(e.v);
  else if (e.op === "¬") variables(e.x, set);
  else if (e.op) { variables(e.l, set); variables(e.r, set); }
  return set;
}

// Compound subformulas in evaluation order, without repeats.
function subformulas(e, out = []) {
  if ("v" in e || "c" in e) return out;
  if (e.op === "¬") subformulas(e.x, out);
  else { subformulas(e.l, out); subformulas(e.r, out); }
  const s = show(e);
  if (!out.some((x) => x.s === s)) out.push({ e, s });
  return out;
}

// Every assignment of the variables, in the textbook order (T before F).
function assignments(vars) {
  const rows = [];
  for (let k = 0; k < 2 ** vars.length; k++) {
    const env = {};
    vars.forEach((v, j) => (env[v] = !((k >> (vars.length - 1 - j)) & 1)));
    rows.push(env);
  }
  return rows;
}

// ============================================================ Truth table

for (const root of document.querySelectorAll("[data-truth]")) {
  const input = root.querySelector('[data-text="formula"]');
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  const verdictClass = "rounded-full border px-2.5 py-0.5 text-xs font-medium ";

  function draw() {
    let e;
    try {
      e = parse(input.value);
    } catch (err) {
      o.verdict.className = verdictClass + "border-del/40 text-del";
      o.verdict.textContent = "parse error";
      o.parsed.textContent = err.message;
      table.innerHTML = "";
      return;
    }
    const vars = [...variables(e)].sort();
    if (vars.length > 6) {
      o.verdict.className = verdictClass;
      o.verdict.textContent = "too many variables";
      o.parsed.textContent = `${vars.length} variables would make ${2 ** vars.length} rows; keep it to 6.`;
      table.innerHTML = "";
      return;
    }
    const cols = subformulas(e);
    const rows = assignments(vars);
    const results = rows.map((env) => evaluate(e, env));
    const trues = results.filter(Boolean).length;
    if (trues === rows.length) { o.verdict.className = verdictClass + "border-add/40 bg-add/8 text-add"; o.verdict.textContent = "tautology"; }
    else if (trues === 0) { o.verdict.className = verdictClass + "border-del/40 bg-del/8 text-del"; o.verdict.textContent = "contradiction"; }
    else { o.verdict.className = verdictClass + "border-brand/40 bg-brand/8 text-brand"; o.verdict.textContent = `satisfiable · true in ${trues} of ${rows.length} rows`; }
    o.parsed.textContent = `read as ${show(e)}`;
    const cell = (v, main) => `<td class="px-3 py-1 text-center ${main ? (v ? "font-medium text-add" : "font-medium text-del") : v ? "" : "text-muted-foreground"}">${TF(v)}</td>`;
    let html = `<table class="w-full font-mono text-[13px]"><thead class="sticky top-0 bg-code-panel"><tr class="border-b">`;
    html += vars.map((v) => `<th class="px-3 py-2 text-center font-normal text-muted-foreground">${esc(v)}</th>`).join("");
    html += cols.map((c, k) => `<th class="px-3 py-2 text-center font-normal whitespace-nowrap ${k === cols.length - 1 ? "text-foreground" : "text-muted-foreground"} ${k === 0 ? "border-l" : ""}">${esc(c.s)}</th>`).join("");
    html += "</tr></thead><tbody>";
    rows.forEach((env) => {
      html += `<tr class="border-b last:border-b-0">`;
      html += vars.map((v) => cell(env[v], false)).join("");
      html += cols.map((c, k) => cell(evaluate(c.e, env), k === cols.length - 1).replace("<td class=\"", `<td class="${k === 0 ? "border-l " : ""}`)).join("");
      html += "</tr>";
    });
    table.innerHTML = html + "</tbody></table>";
  }

  input.addEventListener("input", draw);
  root.querySelectorAll("[data-insert]").forEach((b) => b.addEventListener("click", () => {
    const s = input.selectionStart ?? input.value.length, t = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + b.dataset.insert + input.value.slice(t);
    input.focus();
    input.setSelectionRange(s + b.dataset.insert.length, s + b.dataset.insert.length);
    draw();
  }));
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.preset; draw(); }));
  draw();
}

// ============================================================ Full adder

for (const root of document.querySelectorAll("[data-gates]")) {
  const svg = root.querySelector("[data-circuit]");
  const o = outs(root);
  const buttons = Object.fromEntries([...root.querySelectorAll("[data-input]")].map((b) => [b.dataset.input, b]));
  const truth = root.querySelector("[data-truthrow]");
  const st = { A: 0, B: 0, Cin: 0 };

  const G = { xor1: [200, 90, "XOR"], and1: [200, 170, "AND"], xor2: [380, 130, "XOR"], and2: [380, 220, "AND"], or: [520, 200, "OR"] };
  const IN = { A: [60, 60], B: [60, 140], Cin: [60, 250] };
  const pin = (g, k) => { const [x, y] = G[g]; return k === "out" ? [x + 25, y] : [x - 25, y + (k === 1 ? -10 : 10)]; };
  // Wires: [signal, from, to, x of the vertical run, junction dot at start].
  const W = [
    ["A", IN.A, pin("xor1", 1), 120], ["A", IN.A, pin("and1", 1), 100, true],
    ["B", IN.B, pin("xor1", 2), 140], ["B", IN.B, pin("and1", 2), 130, true],
    ["X", pin("xor1", "out"), pin("xor2", 1), 270], ["X", pin("xor1", "out"), pin("and2", 1), 260, true],
    ["Cin", IN.Cin, pin("xor2", 2), 300], ["Cin", IN.Cin, pin("and2", 2), 290, true],
    ["C1", pin("and1", "out"), pin("or", 1), 450], ["C2", pin("and2", "out"), pin("or", 2), 460],
    ["S", pin("xor2", "out"), [600, 130], 500], ["Cout", pin("or", "out"), [600, 200], 570],
  ];

  function gateShape(g, kind, live) {
    const [x, y] = G[g];
    const stroke = live ? "var(--brand)" : "currentColor";
    const style = `fill:var(--code-bg);stroke:${stroke};stroke-width:1.5;stroke-opacity:${live ? 1 : 0.6}`;
    let d;
    if (kind === "AND") d = `M${x - 25} ${y - 20} H${x} A20 20 0 0 1 ${x} ${y + 20} H${x - 25} Z`;
    else d = `M${x - 25} ${y - 20} Q${x - 12} ${y} ${x - 25} ${y + 20} Q${x + 10} ${y + 20} ${x + 25} ${y} Q${x + 10} ${y - 20} ${x - 25} ${y - 20} Z`;
    el("path", { d, style }, svg);
    if (kind === "XOR") el("path", { d: `M${x - 31} ${y - 20} Q${x - 18} ${y} ${x - 31} ${y + 20}`, style: `fill:none;stroke:${stroke};stroke-width:1.5;stroke-opacity:${live ? 1 : 0.6}` }, svg);
    text(svg, x, y + 34, kind, { "text-anchor": "middle" });
  }

  function draw() {
    const { A, B, Cin } = st;
    const v = { A, B, Cin, X: A ^ B };
    v.C1 = A & B; v.S = v.X ^ Cin; v.C2 = v.X & Cin; v.Cout = v.C1 | v.C2;
    svg.replaceChildren();
    for (const [sig, [x1, y1], [x2, y2], mx, dot] of W) {
      const on = v[sig] === 1;
      el("path", { d: `M${x1} ${y1} H${mx} V${y2} H${x2}`, style: `fill:none;stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.3};stroke-width:${on ? 2 : 1.5};stroke-linejoin:round` }, svg);
      if (dot) el("circle", { cx: mx, cy: y1, r: 2.5, style: `fill:${on ? "var(--brand)" : "currentColor"};fill-opacity:${on ? 1 : 0.5}` }, svg);
    }
    gateShape("xor1", "XOR", v.X); gateShape("and1", "AND", v.C1); gateShape("xor2", "XOR", v.S); gateShape("and2", "AND", v.C2); gateShape("or", "OR", v.Cout);
    for (const [name, [x, y]] of Object.entries(IN)) {
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `Toggle ${name}`, "data-node": name, class: "cursor-pointer outline-none" }, svg);
      el("circle", { cx: x, cy: y, r: 14, style: `fill:${v[name] ? "var(--brand)" : "var(--code-bg)"};stroke:${v[name] ? "var(--brand)" : "currentColor"};stroke-opacity:${v[name] ? 1 : 0.5};stroke-width:1.5` }, g);
      text(g, x, y + 4, String(v[name]), { "text-anchor": "middle", class: v[name] ? "fill-white font-mono text-[12px]" : "fill-foreground font-mono text-[12px]" });
      text(g, x - 22, y + 4, name, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    }
    for (const [name, y] of [["S", 130], ["Cout", 200]]) {
      el("rect", { x: 600, y: y - 14, width: 28, height: 28, rx: 6, style: `fill:${v[name] ? "var(--brand)" : "var(--code-bg)"};stroke:${v[name] ? "var(--brand)" : "currentColor"};stroke-opacity:${v[name] ? 1 : 0.5}` }, svg);
      text(svg, 614, y + 4, String(v[name]), { "text-anchor": "middle", class: v[name] ? "fill-white font-mono text-[12px]" : "fill-foreground font-mono text-[12px]" });
      text(svg, 614, y - 20, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    }
    for (const [k, b] of Object.entries(buttons)) { b.setAttribute("aria-pressed", String(!!st[k])); b.querySelector("[data-bit]").textContent = st[k]; }
    o.s.textContent = String(v.S);
    o.c.textContent = String(v.Cout);
    o.sum.textContent = `${A} + ${B} + ${Cin} = ${A + B + Cin} = ${v.Cout}${v.S}₂`;
    let html = `<table class="w-full font-mono text-[11px]"><thead><tr class="text-muted-foreground">${["A", "B", "Cin", "Cout", "S"].map((h) => `<th class="px-1.5 py-1 font-normal">${h}</th>`).join("")}</tr></thead><tbody>`;
    for (let k = 0; k < 8; k++) {
      const a = (k >> 2) & 1, b = (k >> 1) & 1, c = k & 1, s = a + b + c;
      const cur = a === A && b === B && c === Cin;
      html += `<tr class="${cur ? "bg-brand/10 text-brand" : ""}">${[a, b, c, s >> 1, s & 1].map((x) => `<td class="px-1.5 py-0.5 text-center">${x}</td>`).join("")}</tr>`;
    }
    truth.innerHTML = html + "</tbody></table>";
  }

  const flip = (k) => { st[k] ^= 1; draw(); };
  for (const [k, b] of Object.entries(buttons)) b.addEventListener("click", () => flip(k));
  svg.addEventListener("click", (e) => { const n = e.target.closest("[data-node]"); if (n) flip(n.dataset.node); });
  svg.addEventListener("keydown", (e) => {
    const n = e.target.closest("[data-node]");
    if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); flip(n.dataset.node); svg.querySelector(`[data-node="${n.dataset.node}"]`)?.focus(); }
  });
  draw();
}

// ============================================================ Arguments

for (const root of document.querySelectorAll("[data-arguments]")) {
  const tabs = [...root.querySelectorAll("[data-arg]")];
  const o = outs(root);
  function show1(tab) {
    for (const t of tabs) t.setAttribute("aria-selected", String(t === tab));
    const premises = tab.dataset.premises.split("|");
    const conclusion = tab.dataset.conclusion;
    o.form.textContent = tab.dataset.form;
    o.symbolic.innerHTML = premises.map((p, i) => `<li><span class="mr-2 text-muted-foreground">${i + 1}.</span>${esc(p)}</li>`).join("") + `<li class="border-t pt-1"><span class="mr-2 text-muted-foreground">∴</span>${esc(conclusion)}</li>`;
    o.example.innerHTML = tab.dataset.example.split("|").map((s) => `<li>${esc(s)}</li>`).join("");
    const ps = premises.map(parse), c = parse(conclusion);
    const vars = [...ps.reduce((set, p) => variables(p, set), variables(c))].sort();
    const rows = assignments(vars);
    const bad = rows.find((env) => ps.every((p) => evaluate(p, env)) && !evaluate(c, env));
    if (!bad) {
      o.verdict.className = "rounded-lg border border-add/40 bg-add/8 p-3 text-sm";
      o.verdict.innerHTML = `<span class="font-medium text-add">Valid.</span> <span class="text-muted-foreground">None of the ${rows.length} rows makes every premise true and the conclusion false.</span>`;
    } else {
      o.verdict.className = "rounded-lg border border-del/40 bg-del/8 p-3 text-sm";
      o.verdict.innerHTML = `<span class="font-medium text-del">Invalid.</span> <span class="text-muted-foreground">Counterexample: ${vars.map((v) => `<span class="font-mono text-foreground">${v} = ${TF(bad[v])}</span>`).join(", ")}: every premise is true, the conclusion is false.</span>`;
    }
  }
  tabs.forEach((t) => t.addEventListener("click", () => show1(t)));
  show1(tabs[0]);
}

// ============================================================ Venn syllogisms

const CIRCLES = { S: [160, 125, 85], P: [260, 125, 85], M: [210, 210, 85] };
// Approximate centres of the seven regions, keyed "SPM" bits.
const CENTRE = { "100": [112, 100], "010": [308, 100], "001": [210, 268], "110": [210, 88], "101": [148, 192], "011": [272, 192], "111": [210, 155] };
let vennId = 0;

for (const root of document.querySelectorAll("[data-venn]")) {
  const svg = root.querySelector("[data-plot]");
  const tabs = [...root.querySelectorAll("[data-syl]")];
  const o = outs(root);
  const id = `venn-${++vennId}`;
  const keys = Object.keys(CENTRE);
  const bit = (key, term) => key["SPM".indexOf(term)] === "1";

  // A region is drawn as a full rectangle clipped by the circles it is
  // inside (nested clip-paths) and masked by the circles it is outside.
  function region(key, style, parent) {
    let g = parent;
    "SPM".split("").forEach((t, i) => {
      if (key[i] === "1") g = el("g", { "clip-path": `url(#${id}-c${t})` }, g);
    });
    const outside = "SPM".split("").filter((t, i) => key[i] === "0");
    const mask = outside.length ? `url(#${id}-m${outside.join("")})` : undefined;
    el("rect", { x: 0, y: 0, width: 420, height: 330, style, mask }, g);
  }

  function defs() {
    const d = el("defs", {}, svg);
    for (const [t, [cx, cy, r]] of Object.entries(CIRCLES)) el("circle", { cx, cy, r }, el("clipPath", { id: `${id}-c${t}` }, d));
    for (const combo of ["S", "P", "M", "SP", "SM", "PM", "SPM"]) {
      const m = el("mask", { id: `${id}-m${combo}`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 420, height: 330 }, d);
      el("rect", { x: 0, y: 0, width: 420, height: 330, fill: "white" }, m);
      for (const t of combo) { const [cx, cy, r] = CIRCLES[t]; el("circle", { cx, cy, r, fill: "black" }, m); }
    }
  }

  const regionsFor = (type, X, Y) =>
    keys.filter((k) => (type === "A" || type === "O" ? bit(k, X) && !bit(k, Y) : bit(k, X) && bit(k, Y)));

  function draw(tab) {
    for (const t of tabs) t.setAttribute("aria-selected", String(t === tab));
    const spec = tab.dataset.spec.split("|").map((s) => s.split(" "));
    const lines = tab.dataset.lines.split("|");
    o.lines.innerHTML = lines.map((l, i) => `<li class="${i === 2 ? "border-t pt-1 font-medium" : "text-muted-foreground"}">${esc(l)}</li>`).join("");
    const [p1, p2, concl] = spec;
    const shaded = new Set();
    for (const [t, X, Y] of [p1, p2]) if (t === "A" || t === "E") regionsFor(t, X, Y).forEach((k) => shaded.add(k));
    const marks = [];
    for (const [t, X, Y] of [p1, p2]) if (t === "I" || t === "O") marks.push(regionsFor(t, X, Y).filter((k) => !shaded.has(k)));

    svg.replaceChildren();
    defs();
    for (const k of shaded) region(k, "fill:var(--foreground);fill-opacity:0.18", svg);
    for (const [t, [cx, cy, r]] of Object.entries(CIRCLES)) {
      el("circle", { cx, cy, r, style: "fill:none;stroke:currentColor;stroke-width:1.5;stroke-opacity:0.7" }, svg);
      const [lx, ly] = t === "S" ? [cx - r * 0.78, cy - r * 0.78] : t === "P" ? [cx + r * 0.78, cy - r * 0.78] : [cx, cy + r + 14];
      text(svg, lx, ly, t, { "text-anchor": "middle", class: "fill-foreground font-mono text-[13px]" });
    }
    for (const m of marks) {
      if (!m.length) continue;
      const xs = m.map((k) => CENTRE[k]);
      const [x, y] = [xs.reduce((a, p) => a + p[0], 0) / xs.length, xs.reduce((a, p) => a + p[1], 0) / xs.length];
      text(svg, x, y + 6, "×", { "text-anchor": "middle", class: "fill-[var(--brand)] font-mono text-[20px]" });
      if (m.length > 1) el("line", { x1: xs[0][0], y1: xs[0][1], x2: xs[1][0], y2: xs[1][1], style: "stroke:var(--brand);stroke-dasharray:3 3;stroke-opacity:0.6" }, svg);
    }
    text(svg, 6, 322, "shaded: empty   ×: something exists   × on a line: one side or the other", { class: "fill-muted-foreground font-mono text-[9px]" });

    const [ct, X, Y] = concl;
    const need = regionsFor(ct, X, Y);
    let valid, why;
    if (ct === "A" || ct === "E") {
      const open = need.filter((k) => !shaded.has(k));
      valid = open.length === 0;
      why = valid ? `every region the conclusion says is empty is already shaded.` : `a region the conclusion says is empty (${open.map((k) => describe(k)).join("; ")}) is not shaded, so the premises allow something there.`;
    } else {
      valid = marks.some((m) => m.length && m.every((k) => need.includes(k)));
      why = valid ? `the × sits in a region where the conclusion says something exists.` : `no × is forced into the region the conclusion needs.`;
    }
    o.verdict.className = "rounded-lg border p-3 text-sm " + (valid ? "border-add/40 bg-add/8" : "border-del/40 bg-del/8");
    o.verdict.innerHTML = `<span class="font-medium ${valid ? "text-add" : "text-del"}">${valid ? "Valid" : "Invalid"}:</span> <span class="text-muted-foreground">${why}</span>`;
  }
  function describe(k) {
    return "SPM".split("").map((t, i) => (k[i] === "1" ? t : `not ${t}`)).join(", ");
  }
  tabs.forEach((t) => t.addEventListener("click", () => draw(t)));
  draw(tabs[0]);
}

// ============================================================ Sets

for (const root of document.querySelectorAll("[data-sets]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const inA = root.querySelector('[data-text="A"]'), inB = root.querySelector('[data-text="B"]');
  let op = "union";
  const U = Array.from({ length: 20 }, (_, i) => i + 1);
  const read = (s) => new Set(s.split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 20));
  const fmtSet = (xs) => (xs.length ? `{${xs.join(", ")}}` : "∅");
  const OPS = {
    union: { name: "A ∪ B", keep: (a, b) => a || b },
    inter: { name: "A ∩ B", keep: (a, b) => a && b },
    diff: { name: "A − B", keep: (a, b) => a && !b },
    sym: { name: "A △ B", keep: (a, b) => a !== b },
    compA: { name: "Aᶜ (in 1…20)", keep: (a) => !a },
  };
  const C = { A: [125, 105, 72], B: [195, 105, 72] };

  function draw() {
    const A = read(inA.value), B = read(inB.value);
    const f = OPS[op];
    svg.replaceChildren();
    const d = el("defs", {}, svg);
    for (const [t, [cx, cy, r]] of Object.entries(C)) el("circle", { cx, cy, r }, el("clipPath", { id: `sets-${t}` }, d));
    const m = (name, cuts) => {
      const mk = el("mask", { id: name, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 320, height: 210 }, d);
      el("rect", { x: 0, y: 0, width: 320, height: 210, fill: "white" }, mk);
      for (const t of cuts) { const [cx, cy, r] = C[t]; el("circle", { cx, cy, r, fill: "black" }, mk); }
    };
    m("sets-mA", "A"); m("sets-mB", "B"); m("sets-mAB", "AB");
    // The four regions: only A, only B, both, neither.
    const regions = [
      { a: 1, b: 0, draw: (st) => el("rect", { x: 0, y: 0, width: 320, height: 210, style: st, mask: "url(#sets-mB)" }, el("g", { "clip-path": "url(#sets-A)" }, svg)) },
      { a: 0, b: 1, draw: (st) => el("rect", { x: 0, y: 0, width: 320, height: 210, style: st, mask: "url(#sets-mA)" }, el("g", { "clip-path": "url(#sets-B)" }, svg)) },
      { a: 1, b: 1, draw: (st) => el("rect", { x: 0, y: 0, width: 320, height: 210, style: st }, el("g", { "clip-path": "url(#sets-B)" }, el("g", { "clip-path": "url(#sets-A)" }, svg))) },
      { a: 0, b: 0, draw: (st) => el("rect", { x: 4, y: 4, width: 312, height: 202, rx: 8, style: st, mask: "url(#sets-mAB)" }, svg) },
    ];
    for (const r of regions) if (f.keep(!!r.a, !!r.b)) r.draw("fill:var(--brand);fill-opacity:0.22");
    el("rect", { x: 4, y: 4, width: 312, height: 202, rx: 8, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (const [t, [cx, cy, r]] of Object.entries(C)) el("circle", { cx, cy, r, style: "fill:none;stroke:currentColor;stroke-width:1.5;stroke-opacity:0.7" }, svg);
    text(svg, 70, 32, "A", { class: "fill-foreground font-mono text-[12px]" });
    text(svg, 244, 32, "B", { class: "fill-foreground font-mono text-[12px]" });
    text(svg, 300, 198, "U", { class: "fill-muted-foreground font-mono text-[10px]" });
    // Elements, laid out inside their region.
    const spots = { "10": [90, 105], "01": [230, 105], "11": [160, 105], "00": [160, 192] };
    const groups = { "10": [], "01": [], "11": [], "00": [] };
    for (const x of U) groups[`${A.has(x) ? 1 : 0}${B.has(x) ? 1 : 0}`].push(x);
    for (const [k, xs] of Object.entries(groups)) {
      const [cx, cy] = spots[k];
      const per = k === "00" ? 12 : 3;
      xs.forEach((x, i) => {
        const row = Math.floor(i / per), col = i % per, cols = Math.min(per, xs.length);
        const hi = f.keep(k[0] === "1", k[1] === "1");
        text(svg, cx + (col - (cols - 1) / 2) * 17, cy + (row - (Math.ceil(xs.length / per) - 1) / 2) * 14 + 3, String(x), { "text-anchor": "middle", class: hi ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground/60 font-mono text-[10px]" });
      });
    }
    const res = U.filter((x) => f.keep(A.has(x), B.has(x)));
    o.result.textContent = `${f.name} = ${fmtSet(res)}`;
    const AB = [...A].filter((x) => B.has(x)).length, AuB = U.filter((x) => A.has(x) || B.has(x)).length;
    const ie = `|A ∪ B| = ${AuB} = |A| + |B| − |A ∩ B| = ${A.size} + ${B.size} − ${AB}`;
    o.count.textContent = op === "union" ? ie : `|${f.name.split(" (")[0]}| = ${res.length}  ·  ${ie}`;
  }
  root.addEventListener("seg-change", (e) => { op = e.detail.value; draw(); });
  inA.addEventListener("input", draw);
  inB.addEventListener("input", draw);
  draw();
}

// ============================================================ Quantifiers

const WORLD0 = [
  { shape: "circle", color: "red", big: true }, { shape: "circle", color: "red", big: false },
  { shape: "square", color: "blue", big: false }, { shape: "square", color: "red", big: true },
  { shape: "triangle", color: "blue", big: false }, { shape: "triangle", color: "red", big: false },
];

const STATEMENTS = {
  allCircleRed: (w) => {
    const bad = w.map((o, i) => i).filter((i) => w[i].shape === "circle" && w[i].color !== "red");
    return bad.length ? { v: false, hl: bad, why: `counterexample: object ${bad[0] + 1}, a blue circle` } : { v: true, hl: [], why: "every circle is red" };
  },
  someSquareBlue: (w) => {
    const ok = w.map((o, i) => i).filter((i) => w[i].shape === "square" && w[i].color === "blue");
    return ok.length ? { v: true, hl: [ok[0]], why: `witness: object ${ok[0] + 1}` } : { v: false, hl: [], why: "no square is blue" };
  },
  allRedOrBig: (w) => {
    const bad = w.map((o, i) => i).filter((i) => w[i].color !== "red" && !w[i].big);
    return bad.length ? { v: false, hl: bad, why: `counterexample: object ${bad[0] + 1} is neither red nor big` } : { v: true, hl: [], why: "every object is red or big" };
  },
  noTriangleBig: (w) => {
    const bad = w.map((o, i) => i).filter((i) => w[i].shape === "triangle" && w[i].big);
    return bad.length ? { v: false, hl: bad, why: `object ${bad[0] + 1} is a big triangle` } : { v: true, hl: [], why: "there is no big triangle" };
  },
  everyBlueHasRed: (w) => {
    const bad = w.map((o, i) => i).filter((i) => w[i].color === "blue" && !w.some((y) => y.color === "red" && y.shape === w[i].shape));
    return bad.length ? { v: false, hl: bad, why: `object ${bad[0] + 1} is blue and no red ${w[bad[0]].shape} exists` } : { v: true, hl: [], why: "each blue object has a red twin in shape" };
  },
};

for (const root of document.querySelectorAll("[data-quant]")) {
  const svg = root.querySelector("[data-world]");
  const items = [...root.querySelectorAll("[data-stmt]")];
  const world = WORLD0.map((o) => ({ ...o }));
  let active = null;
  const results = () => Object.fromEntries(items.map((li) => [li.dataset.stmt, STATEMENTS[li.dataset.stmt](world)]));

  function draw() {
    const res = results();
    const hl = active ? res[active].hl : [];
    svg.replaceChildren();
    world.forEach((o, i) => {
      const cx = 60 + (i % 3) * 120, cy = 65 + Math.floor(i / 3) * 110;
      const s = o.big ? 34 : 20;
      const g = el("g", { tabindex: 0, role: "button", "data-obj": i, "aria-label": `Object ${i + 1}: ${o.big ? "big" : "small"} ${o.color} ${o.shape}. Enter changes colour, Shift+Enter size.`, class: "cursor-pointer outline-none" }, svg);
      if (hl.includes(i)) el("circle", { cx, cy, r: 46, style: "fill:none;stroke:var(--brand);stroke-width:2;stroke-dasharray:4 3" }, g);
      el("rect", { x: cx - 50, y: cy - 50, width: 100, height: 100, style: "fill:transparent" }, g);
      const fill = o.color === "red" ? "var(--code-del)" : "var(--vec-u)";
      const style = `fill:${fill};fill-opacity:0.85;stroke:var(--background);stroke-width:1.5`;
      if (o.shape === "circle") el("circle", { cx, cy, r: s, style }, g);
      else if (o.shape === "square") el("rect", { x: cx - s * 0.9, y: cy - s * 0.9, width: s * 1.8, height: s * 1.8, rx: 3, style }, g);
      else el("polygon", { points: `${cx},${cy - s} ${cx + s},${cy + s * 0.8} ${cx - s},${cy + s * 0.8}`, style }, g);
      text(g, cx, cy + 50, String(i + 1), { "text-anchor": "middle" });
    });
    for (const li of items) {
      const r = res[li.dataset.stmt];
      const v = li.querySelector("[data-val]");
      v.textContent = r.v ? "true" : "false";
      v.className = "w-12 shrink-0 rounded-full border px-1.5 py-0.5 text-center font-mono text-[11px] " + (r.v ? "border-add/40 bg-add/8 text-add" : "border-del/40 bg-del/8 text-del");
      li.querySelector("[data-why]").textContent = r.why;
      li.toggleAttribute("data-active", li.dataset.stmt === active);
    }
  }
  const change = (i, size) => {
    const o = world[i];
    if (size) o.big = !o.big; else o.color = o.color === "red" ? "blue" : "red";
    draw();
    svg.querySelector(`[data-obj="${i}"]`)?.focus();
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-obj]"); if (g) change(Number(g.dataset.obj), e.shiftKey); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-obj]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); change(Number(g.dataset.obj), e.shiftKey); }
  });
  for (const li of items) {
    const set = () => { active = li.dataset.stmt; draw(); };
    li.addEventListener("pointerenter", set);
    li.addEventListener("focus", set);
  }
  draw();
}

// ============================================================ Induction

for (const root of document.querySelectorAll("[data-induction]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const steps = [...root.querySelectorAll("[data-proof]")];
  const counter = root.querySelector("[data-counter]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 0;
  const s = scrubAll(root, draw);

  function draw() {
    const n = Math.round(s.n.get());
    const cell = 200 / n;
    svg.replaceChildren();
    // Layer k (1-based) is the L of cells with max(row, col) = k − 1: 2k − 1 cells.
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = Math.max(r, c) + 1;
      const last = k === n;
      const style = last ? "fill:var(--brand);fill-opacity:0.75" : `fill:${k % 2 ? "var(--vec-u)" : "var(--vec-out)"};fill-opacity:${0.25 + 0.4 * (k / n)}`;
      el("rect", { x: 10 + c * cell + 1, y: 10 + (n - 1 - r) * cell + 1, width: cell - 2, height: cell - 2, rx: Math.min(3, cell / 6), style }, svg);
    }
    const odds = Array.from({ length: n }, (_, i) => 2 * i + 1);
    o.sum.innerHTML = `${odds.join(" + ")} = ${n * n} = ${n}² · the last layer, <span class="text-brand">${2 * n - 1}</span> cells, is pink`;
  }
  const go = (i) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((st, k) => (st.hidden = k !== at));
    counter.textContent = `${at + 1} / ${steps.length}`;
    back.disabled = at === 0;
    next.disabled = at === steps.length - 1;
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  draw();
}
