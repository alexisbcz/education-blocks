// Hindley–Milner type inference (Algorithm W) on small lambda terms,
// logging every unification and generalisation.

import { h, msg, out, onInput, presets, setInput } from "./plt-ui.js";

// ------------------------------------------------------------ parser
//   term := 'let' x '=' term 'in' term | '\' x+ '.' term
//         | 'if' term 'then' term 'else' term | sum
//   sum  := app ('+' app)*      app := atom atom*
//   atom := INT | true | false | IDENT | '(' term ')'

function parseTerm(src) {
  const toks = src.replace(/λ/g, "\\").match(/\d+|[A-Za-z_][A-Za-z0-9_']*|[\\.()=+]|\S/g) ?? [];
  let p = 0;
  const peek = () => toks[p];
  const expect = (t) => { if (toks[p] !== t) throw new Error(`expected ${t}${toks[p] ? `, found ${toks[p]}` : ""}`); p++; };
  const KW = new Set(["let", "in", "if", "then", "else", "true", "false"]);
  const ident = () => {
    const t = toks[p];
    if (!t || !/^[A-Za-z_]/.test(t) || KW.has(t)) throw new Error(`expected a name${t ? `, found ${t}` : ""}`);
    p++;
    return t;
  };
  function term() {
    if (peek() === "let") { p++; const x = ident(); expect("="); const e1 = term(); expect("in"); return { t: "let", x, e1, e2: term() }; }
    if (peek() === "\\") {
      p++;
      const xs = [ident()];
      while (peek() !== ".") xs.push(ident());
      p++;
      return xs.reduceRight((body, x) => ({ t: "lam", x, body }), term());
    }
    if (peek() === "if") { p++; const c = term(); expect("then"); const a = term(); expect("else"); return { t: "if", c, a, b: term() }; }
    let e = app();
    while (peek() === "+") { p++; e = { t: "plus", a: e, b: app() }; }
    return e;
  }
  const startsAtom = (t) => t !== undefined && (t === "(" || /^\d/.test(t) || (/^[A-Za-z_]/.test(t) && !["let", "in", "if", "then", "else"].includes(t)) || t === "\\");
  function app() {
    let e = atom();
    while (startsAtom(peek())) e = { t: "app", f: e, a: peek() === "\\" ? term() : atom() };
    return e;
  }
  function atom() {
    const t = peek();
    if (t === "(") { p++; const e = term(); expect(")"); return e; }
    if (/^\d/.test(t ?? "")) { p++; return { t: "int" }; }
    if (t === "true" || t === "false") { p++; return { t: "bool" }; }
    return { t: "var", x: ident() };
  }
  if (!toks.length) throw new Error("type a term");
  const e = term();
  if (p < toks.length) throw new Error(`unexpected ${toks[p]}`);
  return e;
}

// ------------------------------------------------------------ types

const tv = (n) => ({ v: n });
const tc = (name, ...args) => ({ c: name, args });
const fnT = (a, b) => tc("→", a, b);
const INT = tc("int"), BOOL = tc("bool");

function showT(t, names = null, top = true) {
  if (t.v !== undefined) return names?.get(t.v) ?? "t" + t.v;
  if (t.c === "→") {
    const l = t.args[0].c === "→" ? `(${showT(t.args[0], names)})` : showT(t.args[0], names);
    return `${l} → ${showT(t.args[1], names, false)}`;
  }
  return t.c;
}

function infer(expr) {
  let next = 0;
  const fresh = () => tv(next++);
  const subst = new Map();
  const steps = [];
  const prune = (t) => {
    while (t.v !== undefined && subst.has(t.v)) t = subst.get(t.v);
    return t;
  };
  const apply = (t) => { t = prune(t); return t.v !== undefined ? t : tc(t.c, ...t.args.map(apply)); };
  const occurs = (v, t) => { t = prune(t); return t.v !== undefined ? t.v === v : t.args.some((a) => occurs(v, a)); };
  function unify(a, b, why) {
    a = prune(a); b = prune(b);
    steps.push({ kind: "unify", text: `${showT(apply(a))}  ~  ${showT(apply(b))}`, why });
    if (a.v !== undefined && b.v !== undefined && a.v === b.v) return;
    if (a.v !== undefined) return bind(a.v, b);
    if (b.v !== undefined) return bind(b.v, a);
    if (a.c !== b.c || a.args.length !== b.args.length) throw new Error(`type mismatch: ${showT(apply(a))} is not ${showT(apply(b))} (${why})`);
    a.args.forEach((x, k) => unify(x, b.args[k], why));
  }
  function bind(v, t) {
    if (occurs(v, t)) throw new Error(`occurs check: t${v} = ${showT(apply(t))} would be an infinite type (${steps.at(-1).why})`);
    subst.set(v, t);
    steps.push({ kind: "bind", text: `t${v} := ${showT(apply(t))}` });
  }
  const ftv = (t, acc = new Set()) => { t = prune(t); if (t.v !== undefined) acc.add(t.v); else t.args.forEach((a) => ftv(a, acc)); return acc; };
  const envFtv = (env) => { const s = new Set(); for (const sc of env.values()) for (const v of ftv(sc.t)) if (!sc.vars.includes(v)) s.add(v); return s; };
  function instantiate(sc) {
    const m = new Map(sc.vars.map((v) => [v, fresh()]));
    const go = (t) => { t = prune(t); return t.v !== undefined ? m.get(t.v) ?? t : tc(t.c, ...t.args.map(go)); };
    return go(sc.t);
  }
  function W(env, e) {
    switch (e.t) {
      case "int": return INT;
      case "bool": return BOOL;
      case "var": {
        const sc = env.get(e.x);
        if (!sc) throw new Error(`unbound variable ${e.x}`);
        const t = instantiate(sc);
        if (sc.vars.length) steps.push({ kind: "inst", text: `${e.x} : ∀${sc.vars.map((v) => "t" + v).join(" ")}. ${showT(apply(sc.t))}  instantiated to  ${showT(apply(t))}` });
        return t;
      }
      case "lam": {
        const a = fresh();
        steps.push({ kind: "new", text: `${e.x} : t${a.v}  (parameter of λ${e.x})` });
        const env2 = new Map(env);
        env2.set(e.x, { vars: [], t: a });
        return fnT(a, W(env2, e.body));
      }
      case "app": {
        const tf = W(env, e.f), ta = W(env, e.a), r = fresh();
        unify(tf, fnT(ta, r), "applying a function");
        return r;
      }
      case "let": {
        const t1 = W(env, e.e1);
        const envVars = envFtv(env);
        const vars = [...ftv(apply(t1))].filter((v) => !envVars.has(v));
        steps.push({ kind: "gen", text: `generalise ${e.x} : ${vars.length ? "∀" + vars.map((v) => "t" + v).join(" ") + ". " : ""}${showT(apply(t1))}` });
        const env2 = new Map(env);
        env2.set(e.x, { vars, t: apply(t1) });
        return W(env2, e.e2);
      }
      case "if": {
        unify(W(env, e.c), BOOL, "if condition");
        const ta = W(env, e.a), tb = W(env, e.b);
        unify(ta, tb, "if branches must agree");
        return ta;
      }
      case "plus": {
        unify(W(env, e.a), INT, "left of +");
        unify(W(env, e.b), INT, "right of +");
        return INT;
      }
    }
  }
  let t;
  try { t = apply(W(new Map(), expr)); }
  catch (e) { e.steps = steps; throw e; }
  // Rename the remaining variables α, β, γ… in order of appearance.
  const names = new Map();
  const greek = "αβγδεζηθ";
  const walk = (x) => { if (x.v !== undefined) { if (!names.has(x.v)) names.set(x.v, greek[names.size] ?? "t" + x.v); } else x.args.forEach(walk); };
  walk(t);
  return { type: showT(t, names), steps };
}

for (const root of document.querySelectorAll("[data-plt-types]")) {
  const input = root.querySelector('[data-in="term"]');
  const stepsEl = root.querySelector("[data-steps]");
  presets(root.querySelector("[data-presets]"), [
    ["identity", "\\x. x"], ["twice", "\\f. \\x. f (f x)"], ["K", "\\x y. x"], ["S", "\\x y z. x z (y z)"],
    ["compose", "\\f g x. f (g x)"], ["let-polymorphism", "let id = \\x. x in id id"], ["λ-bound id", "(\\id. id id) (\\x. x)"],
    ["self-application", "\\x. x x"], ["arithmetic", "\\x. x + 1"], ["ill-typed if", "if true then 1 else false"],
  ], (v) => setInput(input, v));
  const COLORS = { unify: "", bind: "text-brand", gen: "tok-function", inst: "tok-function", new: "text-muted-foreground" };
  function run() {
    let res, err = null;
    try { res = infer(parseTerm(input.value)); }
    catch (e) { err = e; }
    if (err) {
      input.toggleAttribute("data-bad", /expected|unexpected|unbound|type a/.test(err.message));
      out(root, "type", "no type");
      msg(root, err.message, "bad");
      renderSteps(err.steps ?? []);
      return;
    }
    input.removeAttribute("data-bad");
    out(root, "type", res.type);
    msg(root, `well typed: ${res.steps.filter((s) => s.kind === "unify").length} unifications`, "good");
    renderSteps(res.steps);
  }
  function renderSteps(steps) {
    stepsEl.replaceChildren(...steps.map((s, k) => h("li", { class: "flex gap-2 py-0.5 " + (COLORS[s.kind] ?? "") },
      h("span", { class: "w-6 shrink-0 text-right text-muted-foreground tabular-nums", text: k + 1 }),
      h("span", { class: "whitespace-pre-wrap", text: s.text + (s.why ? `   (${s.why})` : "") }))));
  }
  onInput(input, run);
  run();
}
