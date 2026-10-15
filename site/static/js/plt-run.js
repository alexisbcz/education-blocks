// Lexer, Pratt parser, scope resolver, tree-walking interpreter and
// bytecode VM blocks. The language itself is in plt-lang.js.

import { h, s, stext, msg, out, onInput, stepper, presets, setInput, show } from "./plt-ui.js";
import { lex, parse, LangError, lineCol } from "./plt-lang.js";

const TOK_CLASS = { keyword: "tok-keyword", number: "tok-number", string: "tok-string", op: "tok-operator", punct: "tok-punct", comment: "tok-comment" };

/** Source as highlighted spans; mark(tok) may return extra classes. */
function codeView(src, toks, mark = () => "") {
  const nodes = [];
  let i = 0;
  for (const t of toks) {
    if (t.start > i) nodes.push(src.slice(i, t.start));
    nodes.push(h("span", { class: [TOK_CLASS[t.type] ?? "", mark(t)].join(" ").trim(), text: t.text }));
    i = t.end;
  }
  if (i < src.length) nodes.push(src.slice(i));
  return nodes;
}

// ============================================================ lexer

for (const root of document.querySelectorAll("[data-plt-lexer]")) {
  const src = root.querySelector('[data-in="src"]');
  const view = root.querySelector("[data-code]");
  const chips = root.querySelector("[data-tokens]");
  let toks = [], err = null, k = 0;

  function scan() {
    err = null;
    try { toks = lex(src.value, { trivia: true }); }
    catch (e) {
      if (!(e instanceof LangError)) throw e;
      err = e;
      toks = lex(src.value.slice(0, e.at), { trivia: true });
    }
    k = 0;
    render();
  }
  const real = () => toks.filter((t) => t.type !== "space");

  function render() {
    const done = toks.slice(0, k);
    const cur = toks[k - 1];
    view.replaceChildren(...codeView(src.value, toks, (t) => {
      const idx = toks.indexOf(t);
      return idx === k - 1 ? "rounded-sm bg-brand/15 outline outline-1 outline-brand" : idx >= k ? "opacity-35" : "";
    }));
    if (err && k >= toks.length) {
      view.append(h("span", { class: "rounded-sm bg-del/15 text-del", text: src.value[err.at] ?? "" }));
    }
    chips.replaceChildren(...done.filter((t) => t.type !== "space").map((t) => h("span", {
      class: "flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px] " + (t === cur ? "border-brand" : ""),
    }, h("span", { class: "text-muted-foreground", text: t.type }), h("span", { class: TOK_CLASS[t.type] ?? "", text: show(t.text.length > 18 ? t.text.slice(0, 17) + "…" : t.text) }))));
    if (cur) {
      const { line, col } = lineCol(src.value, cur.start);
      msg(root, cur.type === "space" ? `skipped whitespace at ${line}:${col}` : `token ${real().indexOf(cur) + 1}: ${cur.type} ${JSON.stringify(cur.text)} at ${line}:${col}`);
    } else msg(root, `${real().length} tokens to read`);
    if (err && k >= toks.length) msg(root, "lexical error: " + err.message, "bad");
    else if (k === toks.length && toks.length) msg(root, `done: ${real().filter((t) => t.type !== "comment").length} tokens, comments and whitespace skipped`, "good");
  }

  stepper(root, {
    reset: () => { k = 0; render(); },
    back: () => { k = Math.max(0, k - 1); render(); },
    step: () => { k = Math.min(toks.length, k + 1); render(); },
    run: () => { k = toks.length; render(); },
  });
  onInput(src, scan);
  scan();
}

// ============================================================ Pratt parser

// Binding powers [left, right]: + and − are left-associative (right side
// binds tighter), ^ is right-associative (left side binds tighter).
const PRATT_INFIX = { "+": [1, 2], "-": [1, 2], "*": [3, 4], "/": [3, 4], "^": [6, 5] };
const PRATT_PREFIX = 5; // unary minus: below ^, so -2^2 = -(2^2)

function prattParse(src) {
  const toks = [];
  const re = /\s*(\d+(?:\.\d+)?|[-+*/^()]|\S)/gy;
  let m;
  while ((m = re.exec(src)) && m[0].length) toks.push(m[1]);
  if (src.trim() && !toks.length) throw new Error("nothing to parse");
  let p = 0;
  const log = [];
  let depth = 0;
  const say = (text) => log.push("  ".repeat(depth) + text);
  function expr(minBP) {
    say(`expr(min=${minBP})`);
    depth++;
    let t = toks[p++];
    let left;
    if (t === undefined) throw new Error("unexpected end of input");
    if (/^\d/.test(t)) { left = { op: t, kids: [] }; say(`atom ${t}`); }
    else if (t === "(") { left = expr(0); if (toks[p++] !== ")") throw new Error("missing )"); say("close ( )"); }
    else if (t === "-") { say(`prefix − (bp ${PRATT_PREFIX})`); left = { op: "neg", kids: [expr(PRATT_PREFIX)] }; }
    else throw new Error(`unexpected ${t}`);
    for (;;) {
      const op = toks[p];
      if (op === undefined || op === ")") break;
      const bp = PRATT_INFIX[op];
      if (!bp) throw new Error(`unexpected ${op}`);
      if (bp[0] <= minBP) { say(`stop at ${op}: left bp ${bp[0]} ≤ ${minBP}`); break; }
      p++;
      say(`take ${op}: left bp ${bp[0]} > ${minBP}`);
      left = { op, kids: [left, expr(bp[1])] };
    }
    depth--;
    return left;
  }
  const tree = expr(0);
  if (p < toks.length) throw new Error(`unexpected ${toks[p]}`);
  return { tree, log };
}

const prattEval = (n) => n.kids.length === 0 ? Number(n.op) : n.op === "neg" ? -prattEval(n.kids[0])
  : (([a, b]) => ({ "+": a + b, "-": a - b, "*": a * b, "/": a / b, "^": a ** b })[n.op])(n.kids.map(prattEval));
const sexpr = (n) => (n.kids.length ? `(${n.op === "neg" ? "−" : n.op} ${n.kids.map(sexpr).join(" ")})` : n.op);

function drawTree(svg, tree) {
  svg.replaceChildren();
  let leaf = 0, maxDepth = 0, count = 0;
  const place = (n, d) => {
    count++;
    maxDepth = Math.max(maxDepth, d);
    n.d = d;
    if (!n.kids.length) n.x = leaf++;
    else { n.kids.forEach((k) => place(k, d + 1)); n.x = n.kids.reduce((a, k) => a + k.x, 0) / n.kids.length; }
  };
  place(tree, 0);
  const DX = 64, DY = 64, PAD = 30;
  const W = Math.max(1, leaf - 1) * DX + PAD * 2, H = maxDepth * DY + PAD * 2;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", Math.max(W, 120));
  const X = (n) => PAD + n.x * DX, Y = (n) => PAD + n.d * DY;
  const edges = (n) => n.kids.forEach((k) => {
    s("line", { x1: X(n), y1: Y(n), x2: X(k), y2: Y(k), style: "stroke:currentColor;stroke-opacity:.4" }, svg);
    edges(k);
  });
  edges(tree);
  const nodes = (n) => {
    const op = n.kids.length > 0;
    s("circle", { cx: X(n), cy: Y(n), r: 18, style: `fill:${op ? "color-mix(in oklab, var(--brand) 14%, var(--code-bg))" : "var(--code-bg)"};stroke:${op ? "var(--brand)" : "currentColor"};stroke-opacity:${op ? 1 : 0.5}` }, svg);
    const t = stext(svg, X(n), Y(n), n.op === "neg" ? "−" : n.op === "*" ? "×" : n.op, { style: `fill:${op ? "var(--brand)" : "var(--foreground)"}`, class: "font-mono text-[16px]" });
    t.setAttribute("dominant-baseline", "central");
    n.kids.forEach(nodes);
  };
  nodes(tree);
  return { count, depth: maxDepth };
}

for (const root of document.querySelectorAll("[data-plt-pratt]")) {
  const input = root.querySelector('[data-in="expr"]');
  const svg = root.querySelector("[data-tree]");
  const logEl = root.querySelector("[data-log]");
  root.querySelector("[data-bp]").replaceChildren(
    h("thead", {}, h("tr", { class: "border-b text-muted-foreground" }, ...["op", "left", "right", "assoc"].map((x) => h("th", { class: "py-1 text-left font-normal", text: x })))),
    h("tbody", {}, ...Object.entries(PRATT_INFIX).map(([op, [l, r]]) => h("tr", { class: "border-b last:border-b-0" },
      h("td", { class: "py-1", text: op }), h("td", { text: l }), h("td", { text: r }), h("td", { class: "text-muted-foreground", text: l < r ? "left" : "right" }))),
    h("tr", {}, h("td", { class: "py-1", text: "−x" }), h("td", { text: "—" }), h("td", { text: PRATT_PREFIX }), h("td", { class: "text-muted-foreground", text: "prefix" }))),
  );
  presets(root.querySelector("[data-presets]"), [
    ["2 + 3 * 4", "2 + 3 * 4"], ["(2 + 3) * 4", "(2 + 3) * 4"], ["10 - 4 - 3", "10 - 4 - 3"],
    ["2 ^ 3 ^ 2", "2 ^ 3 ^ 2"], ["-2 ^ 2", "-2 ^ 2"], ["1 + 2 * 3 - 4 / 2", "1 + 2 * 3 - 4 / 2"],
  ], (v) => setInput(input, v));
  function run() {
    try {
      const { tree, log } = prattParse(input.value);
      const { count, depth } = drawTree(svg, tree);
      root.querySelector("[data-sexpr]").textContent = sexpr(tree);
      logEl.replaceChildren(...log.map((l) => h("li", { class: "whitespace-pre", text: l })));
      out(root, "value", String(+prattEval(tree).toFixed(10)));
      out(root, "nodes", String(count));
      out(root, "depth", String(depth));
      input.removeAttribute("data-bad");
      msg(root, "parsed: the deepest operators are evaluated first");
    } catch (e) {
      input.setAttribute("data-bad", "");
      msg(root, e.message, "bad");
    }
  }
  onInput(input, run);
  run();
}

// ============================================================ scope resolver

function resolve(prog) {
  const decls = [], uses = [], deferred = [];
  let scopeId = 0;
  const newScope = (parent, kind) => ({ id: scopeId++, parent, kind, names: new Map() });
  const declare = (scope, name, start, end, kind) => {
    let shadows = null;
    for (let s = scope.parent; s; s = s.parent) if (s.names.has(name)) { shadows = s.names.get(name); break; }
    const d = { name, start, end, kind, scope, shadows, id: decls.length };
    decls.push(d);
    scope.names.set(name, d);
  };
  const use = (scope, name, start, end) => {
    let hops = 0;
    for (let s = scope; s; s = s.parent, hops++) if (s.names.has(name)) { uses.push({ name, start, end, decl: s.names.get(name), hops }); return; }
    uses.push({ name, start, end, decl: null, hops: -1 });
  };
  function visit(n, scope) {
    switch (n.t) {
      case "program": case "block": {
        const sc = n.t === "block" && !n.fnBody ? newScope(scope, "block") : scope;
        n.body.forEach((x) => visit(x, sc));
        break;
      }
      case "let": visit(n.init, scope); declare(scope, n.name, n.nameStart, n.nameEnd, "let"); break;
      case "assign": visit(n.value, scope); use(scope, n.name, n.nameStart, n.nameEnd); break;
      case "var": use(scope, n.name, n.start, n.end); break;
      case "fn": {
        // Bodies run later, when every name of the enclosing scopes exists:
        // resolve them after the program, as the interpreter would see them.
        const sc = newScope(scope, "function");
        n.params.forEach((p) => declare(sc, p.name, p.start, p.end, "parameter"));
        n.body.fnBody = true;
        deferred.push(() => visit(n.body, sc));
        break;
      }
      case "print": case "expr": visit(n.value, scope); break;
      case "while": visit(n.cond, scope); visit(n.body, scope); break;
      case "if": visit(n.cond, scope); visit(n.then, scope); if (n.otherwise) visit(n.otherwise, scope); break;
      case "bin": visit(n.left, scope); visit(n.right, scope); break;
      case "un": visit(n.operand, scope); break;
      case "call": visit(n.callee, scope); n.args.forEach((a) => visit(a, scope)); break;
    }
  }
  const global = newScope(null, "global");
  visit(prog, global);
  while (deferred.length) deferred.shift()();
  return { decls, uses };
}

for (const root of document.querySelectorAll("[data-plt-scope]")) {
  const src = root.querySelector('[data-in="src"]');
  const view = root.querySelector("[data-code]");
  const info = root.querySelector('[data-out="info"]');
  let res = null, sel = null;
  const where = (at) => { const { line, col } = lineCol(src.value, at); return `line ${line}:${col}`; };

  function render() {
    let toks;
    try {
      toks = lex(src.value, { trivia: true });
      res = resolve(parse(src.value));
      src.removeAttribute("data-bad");
      const bad = res.uses.filter((u) => !u.decl);
      msg(root, bad.length ? `${bad.length} unresolved name${bad.length > 1 ? "s" : ""}: ${[...new Set(bad.map((u) => u.name))].join(", ")}` : `${res.decls.length} declarations, ${res.uses.length} uses, all resolved`, bad.length ? "bad" : "good");
    } catch (e) {
      src.setAttribute("data-bad", "");
      msg(root, e.message, "bad");
      return;
    }
    const byStart = new Map();
    res.decls.forEach((d) => byStart.set(d.start, { kind: "decl", d }));
    res.uses.forEach((u) => byStart.set(u.start, { kind: "use", u }));
    const lit = new Set();
    if (sel?.kind === "use" && sel.u.decl) lit.add(sel.u.decl.start);
    if (sel?.kind === "decl") res.uses.filter((u) => u.decl === sel.d).forEach((u) => lit.add(u.start));
    const nodes = [];
    let i = 0;
    for (const t of toks) {
      if (t.start > i) nodes.push(src.value.slice(i, t.start));
      const hit = t.type === "ident" && byStart.get(t.start);
      if (hit) {
        const selected = sel && (sel.kind === "use" ? sel.u.start : sel.d.start) === t.start;
        const unresolved = hit.kind === "use" && !hit.u.decl;
        const b = h("button", {
          class: "rounded-sm px-px outline-none focus-visible:ring-2 focus-visible:ring-ring/50 " +
            (hit.kind === "decl" ? "underline decoration-dotted underline-offset-4 " : "") +
            (unresolved ? "text-del underline decoration-wavy " : "") +
            (selected ? "bg-brand text-white " : lit.has(t.start) ? "bg-brand/20 text-brand " : "hover:bg-foreground/10 "),
          text: t.text, attrs: { type: "button" },
        });
        b.addEventListener("click", () => { sel = hit; render(); describe(); });
        nodes.push(b);
      } else nodes.push(h("span", { class: TOK_CLASS[t.type] ?? "", text: t.text }));
      i = t.end;
    }
    view.replaceChildren(...nodes);
  }

  function describe() {
    if (!sel) { info.textContent = "Click a name in the program."; return; }
    if (sel.kind === "use") {
      const { u } = sel;
      if (!u.decl) { info.textContent = `${u.name} at ${where(u.start)} is not declared in any enclosing scope: running the program would fail here.`; return; }
      const up = u.hops === 0 ? "in the same scope" : `${u.hops} scope${u.hops > 1 ? "s" : ""} up`;
      info.textContent = `${u.name} at ${where(u.start)} resolves to the ${u.decl.kind} at ${where(u.decl.start)}, ${up} (${u.decl.scope.kind} scope).` +
        (u.decl.shadows ? ` That declaration shadows the ${u.decl.shadows.kind} ${u.name} at ${where(u.decl.shadows.start)}.` : "");
    } else {
      const { d } = sel;
      const n = res.uses.filter((u) => u.decl === d).length;
      info.textContent = `${d.kind} ${d.name} at ${where(d.start)}, in a ${d.scope.kind} scope: used ${n} time${n === 1 ? "" : "s"}.` +
        (d.shadows ? ` It shadows the ${d.shadows.kind} at ${where(d.shadows.start)} inside this scope.` : "");
    }
  }

  onInput(src, () => { sel = null; render(); describe(); });
  render();
}

// ============================================================ interpreter

class RuntimeErr extends Error {}

function interpret(src, limit = 4000) {
  const prog = parse(src);
  const snaps = [];
  let frameId = 0;
  const frame = (parent, label) => ({ id: frameId++, parent, label, vars: new Map() });
  const output = [];
  const calls = [];
  const fmt = (v) => v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : v?.kind === "closure" ? `fn(${v.params.join(", ")}) ⟨F${v.env.id}⟩` : String(v);
  function snap(node, env, note) {
    if (snaps.length >= limit) throw new RuntimeErr(`stopped after ${limit} steps`);
    const chain = [];
    for (let f = env; f; f = f.parent) chain.push({ id: f.id, label: f.label, vars: [...f.vars].map(([k, v]) => [k, fmt(v)]) });
    snaps.push({ start: node.start, end: node.end, chain, calls: [...calls], out: output.join("\n"), note });
  }
  const lookup = (env, name, node) => {
    for (let f = env; f; f = f.parent) if (f.vars.has(name)) return f;
    throw new RuntimeErr(`undefined name ${name} (${posOf(node)})`);
  };
  const posOf = (node) => { const { line, col } = lineCol(src, node.start); return `line ${line}:${col}`; };
  const truth = (v, node) => {
    if (typeof v !== "boolean") throw new RuntimeErr(`condition must be true or false, got ${fmt(v)} (${posOf(node)})`);
    return v;
  };
  function ev(n, env) {
    switch (n.t) {
      case "program": case "block": {
        const sc = n.t === "block" && !n.fnBody ? frame(env, "block") : env;
        let v = null;
        for (const st of n.body) v = ev(st, sc);
        return v;
      }
      case "let": { const v = ev(n.init, env); env.vars.set(n.name, v); snap(n, env, `let ${n.name} = ${fmt(v)}`); return null; }
      case "assign": { const v = ev(n.value, env); lookup(env, n.name, n).vars.set(n.name, v); snap(n, env, `${n.name} = ${fmt(v)}`); return null; }
      case "print": { const v = ev(n.value, env); output.push(typeof v === "string" ? v : fmt(v)); snap(n, env, `print ${fmt(v)}`); return null; }
      case "expr": return ev(n.value, env);
      case "while": {
        while (truth(ev(n.cond, env), n.cond)) ev(n.body, env);
        return null;
      }
      case "if": return truth(ev(n.cond, env), n.cond) ? ev(n.then, env) : n.otherwise ? ev(n.otherwise, env) : null;
      case "num": case "str": case "bool": return n.value;
      case "var": { const v = lookup(env, n.name, n).vars.get(n.name); snap(n, env, `${n.name} → ${fmt(v)}`); return v; }
      case "fn": { n.body.fnBody = true; const v = { kind: "closure", params: n.params.map((p) => p.name), body: n.body, env }; snap(n, env, `closure created, capturing frame F${env.id}`); return v; }
      case "un": { const v = ev(n.operand, env); if (n.op === "-") { if (typeof v !== "number") throw new RuntimeErr(`cannot negate ${fmt(v)}`); return -v; } return !truth(v, n); }
      case "bin": {
        if (n.op === "&&" || n.op === "||") {
          const l = truth(ev(n.left, env), n.left);
          return n.op === "&&" ? (l ? truth(ev(n.right, env), n.right) : false) : (l ? true : truth(ev(n.right, env), n.right));
        }
        const l = ev(n.left, env), r = ev(n.right, env);
        let v;
        switch (n.op) {
          case "+":
            if (typeof l === "string" || typeof r === "string") { v = (typeof l === "string" ? l : fmt(l)) + (typeof r === "string" ? r : fmt(r)); break; }
          // falls through
          case "-": case "*": case "/": case "%": case "<": case ">": case "<=": case ">=":
            if (typeof l !== "number" || typeof r !== "number") throw new RuntimeErr(`${n.op} needs numbers, got ${fmt(l)} and ${fmt(r)} (${posOf(n)})`);
            if ((n.op === "/" || n.op === "%") && r === 0) throw new RuntimeErr(`division by zero (${posOf(n)})`);
            v = { "+": l + r, "-": l - r, "*": l * r, "/": l / r, "%": l % r, "<": l < r, ">": l > r, "<=": l <= r, ">=": l >= r }[n.op];
            break;
          case "==": v = l === r; break;
          case "!=": v = l !== r; break;
        }
        snap(n, env, `${fmt(l)} ${n.op} ${fmt(r)} = ${fmt(v)}`);
        return v;
      }
      case "call": {
        const f = ev(n.callee, env);
        const args = n.args.map((a) => ev(a, env));
        if (f?.kind !== "closure") throw new RuntimeErr(`${fmt(f)} is not a function (${posOf(n)})`);
        if (args.length !== f.params.length) throw new RuntimeErr(`expected ${f.params.length} argument(s), got ${args.length} (${posOf(n)})`);
        if (calls.length > 200) throw new RuntimeErr("call stack overflow (more than 200 nested calls)");
        const callee = n.callee.t === "var" ? n.callee.name : "fn";
        const fr = frame(f.env, `call ${callee}`);
        f.params.forEach((p, k) => fr.vars.set(p, args[k]));
        calls.push(`${callee}(${args.map(fmt).join(", ")})`);
        snap(n, fr, `call ${callee}: new frame F${fr.id} whose parent is F${f.env.id}`);
        const v = ev(f.body, fr);
        calls.pop();
        snap(n, env, `${callee} returned ${fmt(v)}`);
        return v;
      }
    }
    throw new RuntimeErr(`cannot evaluate ${n.t}`);
  }
  const global = frame(null, "global");
  let result, error = null;
  try { result = ev(prog, global); }
  catch (e) { if (!(e instanceof RuntimeErr)) throw e; error = e.message; }
  return { snaps, result: error ? null : fmt(result), error, output: output.join("\n") };
}

for (const root of document.querySelectorAll("[data-plt-interp]")) {
  const src = root.querySelector('[data-in="src"]');
  const view = root.querySelector("[data-code]");
  const framesEl = root.querySelector("[data-frames]");
  let run = null, k = 0;
  presets(root.querySelector("[data-presets]"), [
    ["counter", src.value],
    ["adder", "let add = fn(a) { fn(b) { a + b } };\nlet add2 = add(2);\nadd2(40)"],
    ["factorial", "let fact = fn(n) {\n  if (n <= 1) { 1 } else { n * fact(n - 1) }\n};\nfact(5)"],
    ["shadowing", "let x = \"outer\";\nlet show = fn() { x };\nlet test = fn(x) { show() };\ntest(\"inner\")"],
  ], (v) => setInput(src, v));

  function load() {
    try {
      run = interpret(src.value);
      src.removeAttribute("data-bad");
      k = 0;
      render();
    } catch (e) {
      run = null;
      src.setAttribute("data-bad", "");
      msg(root, e.message, "bad");
      framesEl.replaceChildren();
    }
  }
  function render() {
    if (!run) return;
    const n = run.snaps.length;
    const sn = run.snaps[k - 1];
    let toks = [];
    try { toks = lex(src.value); } catch {}
    view.replaceChildren(...codeView(src.value, toks, (t) => sn && t.start >= sn.start && t.end <= sn.end ? "bg-brand/15" : ""));
    out(root, "steps", `step ${k} / ${n}`);
    if (!sn) {
      framesEl.replaceChildren(h("p", { class: "text-sm text-muted-foreground", text: "Step to start evaluating." }));
      msg(root, `${n} steps recorded${run.error ? ", then an error" : ""}`);
      out(root, "result", "");
      return;
    }
    framesEl.replaceChildren(...sn.chain.map((f, i) => h("div", { class: "rounded-lg border bg-background p-2.5 " + (i === 0 ? "border-brand" : "") },
      h("div", { class: "mb-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground" },
        h("span", { class: i === 0 ? "text-brand" : "", text: `F${f.id}` }), h("span", { text: f.label }), i > 0 ? h("span", { text: "↑ parent" }) : null),
      f.vars.length ? h("dl", { class: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[13px]" },
        ...f.vars.flatMap(([name, v]) => [h("dt", { class: "text-muted-foreground", text: name }), h("dd", { class: "truncate", text: v })]))
        : h("p", { class: "font-mono text-[12px] text-muted-foreground", text: "(empty)" }))));
    if (sn.calls.length) framesEl.prepend(h("p", { class: "font-mono text-[11px] text-muted-foreground", text: "calls: " + sn.calls.join(" → ") }));
    const last = k === n;
    msg(root, last && run.error ? run.error : sn.note, last && run.error ? "bad" : last ? "good" : "");
    out(root, "result", (sn.out ? sn.out + "\n" : "") + (last && !run.error ? `⇒ ${run.result}` : ""));
  }
  stepper(root, {
    reset: () => { k = 0; render(); },
    back: () => { k = Math.max(0, k - 1); render(); },
    step: () => { k = Math.min(run?.snaps.length ?? 0, k + 1); render(); },
    run: () => { k = run?.snaps.length ?? 0; render(); },
  });
  onInput(src, load, 250);
  load();
}

// ============================================================ bytecode VM

class CompileErr extends Error {}

function compile(prog) {
  const code = [];
  const emit = (op, arg) => (code.push(arg === undefined ? { op } : { op, arg }), code.length - 1);
  const OPS = { "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "%": "MOD", "<": "LT", ">": "GT", "<=": "LE", ">=": "GE", "==": "EQ", "!=": "NE", "&&": "AND", "||": "OR" };
  function expr(n) {
    switch (n.t) {
      case "num": case "str": case "bool": emit("PUSH", n.value); return;
      case "var": emit("LOAD", n.name); return;
      case "bin": expr(n.left); expr(n.right); emit(OPS[n.op]); return;
      case "un": expr(n.operand); emit(n.op === "-" ? "NEG" : "NOT"); return;
      case "fn": case "call": throw new CompileErr("functions are not compiled by this VM: try them in the interpreter above");
      case "if": throw new CompileErr("use if as a statement here, not as a value");
      case "block": throw new CompileErr("a block is not a value here");
    }
    throw new CompileErr(`cannot compile ${n.t}`);
  }
  function stmt(n) {
    switch (n.t) {
      case "let": case "assign": expr(n.t === "let" ? n.init : n.value); emit("STORE", n.name); return;
      case "print": expr(n.value); emit("PRINT"); return;
      case "while": {
        const top = code.length;
        expr(n.cond);
        const jf = emit("JMPF", 0);
        n.body.body.forEach(stmt);
        emit("JMP", top);
        code[jf].arg = code.length;
        return;
      }
      case "expr":
        if (n.value.t === "if") return ifStmt(n.value);
        if (n.value.t === "block") return n.value.body.forEach(stmt);
        expr(n.value); emit("POP"); return;
    }
    throw new CompileErr(`cannot compile ${n.t}`);
  }
  function ifStmt(n) {
    expr(n.cond);
    const jf = emit("JMPF", 0);
    n.then.body.forEach(stmt);
    if (n.otherwise) {
      const j = emit("JMP", 0);
      code[jf].arg = code.length;
      if (n.otherwise.t === "if") ifStmt(n.otherwise); else n.otherwise.body.forEach(stmt);
      code[j].arg = code.length;
    } else code[jf].arg = code.length;
  }
  prog.body.forEach(stmt);
  emit("HALT");
  return code;
}

function execute(code, limit = 5000) {
  const stack = [], vars = new Map(), out = [], snaps = [];
  let pc = 0, error = null;
  const fmt = (v) => typeof v === "string" ? JSON.stringify(v) : String(v);
  snaps.push({ pc, stack: [], vars: [], out: "" });
  try {
    while (code[pc].op !== "HALT") {
      if (snaps.length > limit) throw new Error(`stopped after ${limit} instructions`);
      const { op, arg } = code[pc];
      pc++;
      const pop = () => { if (!stack.length) throw new Error("stack underflow"); return stack.pop(); };
      switch (op) {
        case "PUSH": stack.push(arg); break;
        case "LOAD": if (!vars.has(arg)) throw new Error(`undefined name ${arg}`); stack.push(vars.get(arg)); break;
        case "STORE": vars.set(arg, pop()); break;
        case "POP": pop(); break;
        case "PRINT": out.push(String(pop())); break;
        case "NEG": stack.push(-pop()); break;
        case "NOT": stack.push(!pop()); break;
        case "JMP": pc = arg; break;
        case "JMPF": { const c = pop(); if (typeof c !== "boolean") throw new Error(`condition must be true or false, got ${fmt(c)}`); if (!c) pc = arg; break; }
        default: {
          const b = pop(), a = pop();
          const r = { ADD: () => (typeof a === "string" || typeof b === "string" ? String(a) + String(b) : a + b), SUB: () => a - b, MUL: () => a * b, DIV: () => a / b, MOD: () => a % b,
            LT: () => a < b, GT: () => a > b, LE: () => a <= b, GE: () => a >= b, EQ: () => a === b, NE: () => a !== b, AND: () => a && b, OR: () => a || b }[op];
          stack.push(r());
        }
      }
      snaps.push({ pc, stack: stack.map(fmt), vars: [...vars].map(([k, v]) => [k, fmt(v)]), out: out.join(" ") });
    }
  } catch (e) { error = e.message; }
  return { snaps, error };
}

const showArg = (a) => (typeof a === "string" ? JSON.stringify(a) : String(a));

for (const root of document.querySelectorAll("[data-plt-vm]")) {
  const src = root.querySelector('[data-in="src"]');
  const codeEl = root.querySelector("[data-code]");
  const stackEl = root.querySelector("[data-stack]");
  const varsEl = root.querySelector("[data-vars]");
  let code = [], run = null, k = 0;
  function load() {
    try {
      code = compile(parse(src.value));
      run = execute(code);
      src.removeAttribute("data-bad");
    } catch (e) {
      code = []; run = null;
      src.setAttribute("data-bad", "");
      msg(root, e.message, "bad");
    }
    k = 0;
    render();
  }
  function render() {
    if (!run) { codeEl.replaceChildren(); stackEl.replaceChildren(); varsEl.replaceChildren(); return; }
    const sn = run.snaps[k];
    codeEl.replaceChildren(...code.map((ins, i) => h("li", { class: "flex gap-3 rounded-sm px-1.5 " + (i === sn.pc ? "bg-brand/15 text-brand" : "") },
      h("span", { class: "w-6 text-right text-muted-foreground tabular-nums", text: i }),
      h("span", { class: "w-12 tok-keyword", text: ins.op }),
      h("span", { class: ins.op.startsWith("J") ? "tok-number" : "", text: ins.arg === undefined ? "" : ins.op.startsWith("J") ? "→ " + ins.arg : ins.op === "LOAD" || ins.op === "STORE" ? ins.arg : showArg(ins.arg) }))));
    stackEl.replaceChildren(...(sn.stack.length ? sn.stack : []).map((v, i) => h("li", {
      class: "rounded-md border bg-code px-2 py-1 " + (i === sn.stack.length - 1 ? "border-brand" : ""), text: v,
    })));
    if (!sn.stack.length) stackEl.replaceChildren(h("li", { class: "text-xs text-muted-foreground", text: "(empty)" }));
    varsEl.replaceChildren(...sn.vars.flatMap(([n, v]) => [h("dt", { class: "text-muted-foreground", text: n }), h("dd", { text: v })]));
    out(root, "pc", String(sn.pc));
    out(root, "steps", `${k} / ${run.snaps.length - 1}`);
    out(root, "output", sn.out || "—");
    const last = k === run.snaps.length - 1;
    if (last && run.error) msg(root, run.error, "bad");
    else if (last) msg(root, `halted after ${k} instructions`, "good");
    else msg(root, `${code.length} instructions compiled`);
  }
  stepper(root, {
    reset: () => { k = 0; render(); },
    back: () => { k = Math.max(0, k - 1); render(); },
    step: () => { k = Math.min((run?.snaps.length ?? 1) - 1, k + 1); render(); },
    run: () => { k = (run?.snaps.length ?? 1) - 1; render(); },
  });
  onInput(src, load, 250);
  load();
}
