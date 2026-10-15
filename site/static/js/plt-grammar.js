// Context-free grammars: nullable, FIRST and FOLLOW by fixed-point
// iteration, the LL(1) table with its conflicts, and left recursion
// (direct and indirect) with the standard rewrite for the direct case.

import { h, msg, onInput, presets, setInput } from "./plt-ui.js";

const EPS = "ε";

function parseGrammar(src) {
  const prods = [];
  const order = [];
  src.split("\n").forEach((line, li) => {
    const t = line.replace(/#.*/, "").trim();
    if (!t) return;
    const m = t.match(/^(\S+)\s*(?:->|→|::=)\s*(.*)$/);
    if (!m) throw new Error(`line ${li + 1}: expected "A -> …"`);
    const [, lhs, rhs] = m;
    if (!order.includes(lhs)) order.push(lhs);
    for (const alt of rhs.split("|")) {
      const syms = alt.trim().split(/\s+/).filter((x) => x && x !== "ε" && x !== "eps");
      prods.push({ lhs, rhs: syms });
    }
  });
  if (!prods.length) throw new Error("write at least one rule");
  const nts = new Set(order);
  const terms = new Set(prods.flatMap((p) => p.rhs.filter((x) => !nts.has(x))));
  return { prods, nts: order, ntSet: nts, terms: [...terms], start: order[0] };
}

function analyse(g) {
  const nullable = new Set();
  const first = new Map(g.nts.map((n) => [n, new Set()]));
  const follow = new Map(g.nts.map((n) => [n, new Set()]));
  const firstOfSeq = (seq) => {
    const out = new Set();
    for (const x of seq) {
      if (!g.ntSet.has(x)) { out.add(x); return { set: out, nullable: false }; }
      first.get(x).forEach((t) => out.add(t));
      if (!nullable.has(x)) return { set: out, nullable: false };
    }
    return { set: out, nullable: true };
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const p of g.prods) {
      const { set, nullable: nl } = firstOfSeq(p.rhs);
      const f = first.get(p.lhs), before = f.size;
      set.forEach((t) => f.add(t));
      if (f.size !== before) changed = true;
      if (nl && !nullable.has(p.lhs)) { nullable.add(p.lhs); changed = true; }
    }
  }
  follow.get(g.start).add("$");
  for (let changed = true; changed;) {
    changed = false;
    for (const p of g.prods) p.rhs.forEach((x, i) => {
      if (!g.ntSet.has(x)) return;
      const fol = follow.get(x), before = fol.size;
      const { set, nullable: nl } = firstOfSeq(p.rhs.slice(i + 1));
      set.forEach((t) => fol.add(t));
      if (nl) follow.get(p.lhs).forEach((t) => fol.add(t));
      if (fol.size !== before) changed = true;
    });
  }
  // LL(1) table.
  const table = new Map(g.nts.map((n) => [n, new Map()]));
  const put = (A, a, p) => { const row = table.get(A); if (!row.has(a)) row.set(a, []); if (!row.get(a).includes(p)) row.get(a).push(p); };
  for (const p of g.prods) {
    const { set, nullable: nl } = firstOfSeq(p.rhs);
    set.forEach((a) => put(p.lhs, a, p));
    if (nl) follow.get(p.lhs).forEach((b) => put(p.lhs, b, p));
  }
  // Left recursion: A reaches A through leftmost symbols (past nullable ones).
  const left = new Map(g.nts.map((n) => [n, new Set()]));
  for (const p of g.prods) for (const x of p.rhs) {
    if (!g.ntSet.has(x)) break;
    left.get(p.lhs).add(x);
    if (!nullable.has(x)) break;
  }
  const leftRec = g.nts.filter((A) => {
    const seen = new Set(), stack = [...left.get(A)];
    while (stack.length) { const B = stack.pop(); if (B === A) return true; if (seen.has(B)) continue; seen.add(B); stack.push(...left.get(B)); }
    return false;
  });
  return { nullable, first, follow, table, leftRec, firstOfSeq };
}

const prodText = (p) => `${p.lhs} → ${p.rhs.length ? p.rhs.join(" ") : EPS}`;

/** A → A α | β   becomes   A → β A' ;  A' → α A' | ε. */
function removeDirect(g) {
  const lines = [];
  for (const A of g.nts) {
    const ps = g.prods.filter((p) => p.lhs === A);
    const rec = ps.filter((p) => p.rhs[0] === A), rest = ps.filter((p) => p.rhs[0] !== A);
    const alt = (syms) => (syms.length ? syms.join(" ") : EPS);
    if (!rec.length) { lines.push(`${A} -> ${ps.map((p) => alt(p.rhs)).join(" | ")}`); continue; }
    const A2 = A + "'";
    lines.push(`${A} -> ${rest.map((p) => alt([...p.rhs, A2])).join(" | ") || A2}`);
    lines.push(`${A2} -> ${rec.map((p) => alt([...p.rhs.slice(1), A2])).join(" | ")} | ε`);
  }
  return lines.join("\n");
}

for (const root of document.querySelectorAll("[data-plt-grammar]")) {
  const src = root.querySelector('[data-in="src"]');
  const setsEl = root.querySelector("[data-sets]");
  const tableEl = root.querySelector("[data-table]");
  const issuesEl = root.querySelector("[data-issues]");
  presets(root.querySelector("[data-presets]"), [
    ["left-recursive expressions", "E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id"],
    ["LL(1) expressions", "E -> T E'\nE' -> + T E' | ε\nT -> F T'\nT' -> * F T' | ε\nF -> ( E ) | id"],
    ["dangling else", "S -> if C then S S' | other\nS' -> else S | ε\nC -> cond"],
    ["indirect recursion", "S -> A a | b\nA -> S c | d"],
    ["balanced parens", "S -> ( S ) S | ε"],
  ], (v) => setInput(src, v));

  const set = (xs) => `{ ${[...xs].join(", ")} }`;
  function run() {
    let g, a;
    try { g = parseGrammar(src.value); a = analyse(g); src.removeAttribute("data-bad"); }
    catch (e) { src.setAttribute("data-bad", ""); msg(root, e.message, "bad"); setsEl.replaceChildren(); tableEl.replaceChildren(); issuesEl.replaceChildren(); return; }
    const th = (t, c = "") => h("th", { class: "px-2 py-1.5 text-left font-normal text-muted-foreground " + c, text: t });
    setsEl.replaceChildren(
      h("thead", {}, h("tr", { class: "border-b" }, th("nonterminal"), th("nullable"), th("FIRST"), th("FOLLOW"))),
      h("tbody", {}, ...g.nts.map((A) => h("tr", { class: "border-b last:border-b-0" },
        h("td", { class: "px-2 py-1.5 tok-function", text: A }), h("td", { class: "px-2", text: a.nullable.has(A) ? "yes" : "no" }),
        h("td", { class: "px-2", text: set([...a.first.get(A), ...(a.nullable.has(A) ? [EPS] : [])]) }), h("td", { class: "px-2", text: set(a.follow.get(A)) })))),
    );
    const cols = [...g.terms, "$"];
    let conflicts = 0;
    tableEl.replaceChildren(
      h("thead", {}, h("tr", { class: "border-b" }, th(""), ...cols.map((c) => th(c, "text-center")))),
      h("tbody", {}, ...g.nts.map((A) => h("tr", { class: "border-b last:border-b-0" }, h("td", { class: "px-2 py-1.5 tok-function", text: A }),
        ...cols.map((c) => {
          const ps = a.table.get(A).get(c) ?? [];
          if (ps.length > 1) conflicts++;
          return h("td", { class: "px-2 py-1.5 text-center whitespace-nowrap " + (ps.length > 1 ? "bg-del/12 text-del" : ""), text: ps.map(prodText).join("  /  ") });
        })))),
    );
    const issues = [];
    if (a.leftRec.length) {
      const direct = a.leftRec.filter((A) => g.prods.some((p) => p.lhs === A && p.rhs[0] === A));
      issues.push([`Left recursion in ${a.leftRec.join(", ")}${direct.length < a.leftRec.length ? " (some of it indirect)" : ""}: a top-down parser would loop forever.`, "bad"]);
      if (direct.length) {
        const fix = removeDirect(g);
        const b = h("button", { class: "rounded-md border px-2 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50", text: "Apply the rewrite", attrs: { type: "button" } });
        b.addEventListener("click", () => setInput(src, fix));
        issues.push([h("span", { class: "flex flex-col gap-1.5" }, h("span", { text: "Rewrite A → A α | β as A → β A′, A′ → α A′ | ε:" }),
          h("code", { class: "code rounded-md border bg-code px-2 py-1 whitespace-pre", text: fix }), h("span", {}, b)), ""]);
      }
    }
    if (conflicts) issues.push([`${conflicts} table cell${conflicts > 1 ? "s hold" : " holds"} two productions: the grammar is not LL(1).`, "bad"]);
    else if (!a.leftRec.length) issues.push(["Every cell holds at most one production: the grammar is LL(1).", "good"]);
    const unreachable = g.nts.filter((A) => A !== g.start && !g.prods.some((p) => p.rhs.includes(A)));
    if (unreachable.length) issues.push([`Never used on a right-hand side: ${unreachable.join(", ")}.`, ""]);
    issuesEl.replaceChildren(...issues.map(([t, kind]) => h("li", { class: "rounded-md border px-3 py-2 " + (kind === "bad" ? "border-del/40 bg-del/8" : kind === "good" ? "border-add/40 bg-add/8" : "") }, t)));
    msg(root, `${g.nts.length} nonterminals, ${g.terms.length} terminals, ${g.prods.length} productions`);
  }
  onInput(src, run, 200);
  run();
}
