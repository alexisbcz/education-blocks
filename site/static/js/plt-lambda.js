// Untyped lambda calculus: normal-order (leftmost-outermost) β-reduction
// with capture-avoiding substitution, Church numerals and booleans.

import { h, msg, out, onInput, stepper, presets, setInput } from "./plt-ui.js";

const DEFS = {
  ZERO: "\\f x. x", ONE: "\\f x. f x", TWO: "\\f x. f (f x)", THREE: "\\f x. f (f (f x))",
  SUCC: "\\n f x. f (n f x)", PLUS: "\\m n f x. m f (n f x)", MULT: "\\m n f. m (n f)",
  PRED: "\\n f x. n (\\g h. h (g f)) (\\u. x) (\\u. u)", ISZERO: "\\n. n (\\x. FALSE) TRUE",
  TRUE: "\\x y. x", FALSE: "\\x y. y", IF: "\\b t e. b t e",
  Y: "\\f. (\\x. f (x x)) (\\x. f (x x))", ID: "\\x. x", K: "\\x y. x", OMEGA: "(\\x. x x) (\\x. x x)",
};
const LIMIT = 1500;

function parseLam(src) {
  const toks = src.replace(/λ/g, "\\").match(/[A-Za-z_][A-Za-z0-9_']*|[\\.()]|\S/g) ?? [];
  let p = 0;
  const expect = (t) => { if (toks[p] !== t) throw new Error(`expected ${t}${toks[p] ? `, found ${toks[p]}` : " at the end"}`); p++; };
  function term() {
    if (toks[p] === "\\") {
      p++;
      const vs = [];
      while (toks[p] && toks[p] !== ".") {
        if (!/^[A-Za-z_]/.test(toks[p])) throw new Error(`bad variable ${toks[p]}`);
        vs.push(toks[p++]);
      }
      if (!vs.length) throw new Error("λ needs a variable");
      expect(".");
      return vs.reduceRight((b, v) => ({ t: "lam", v, b }), term());
    }
    let f = atom();
    while (toks[p] && toks[p] !== ")") f = { t: "app", f, a: toks[p] === "\\" ? term() : atom() };
    return f;
  }
  function atom() {
    const t = toks[p];
    if (t === "(") { p++; const e = term(); expect(")"); return e; }
    if (t && /^[A-Za-z_]/.test(t)) { p++; return { t: "var", v: t }; }
    throw new Error(t ? `unexpected ${t}` : "unexpected end");
  }
  if (!toks.length) throw new Error("type a term");
  const e = term();
  if (p < toks.length) throw new Error(`unexpected ${toks[p]}`);
  return e;
}

const free = (t, acc = new Set()) => {
  if (t.t === "var") acc.add(t.v);
  else if (t.t === "lam") { const inner = free(t.b); inner.delete(t.v); inner.forEach((v) => acc.add(v)); }
  else { free(t.f, acc); free(t.a, acc); }
  return acc;
};

// Defined names that are free get replaced by their definitions.
function expand(t, depth = 0) {
  if (depth > 40) throw new Error("definitions nest too deeply");
  if (t.t === "var") return DEFS[t.v] ? expand(parseLam(DEFS[t.v]), depth + 1) : t;
  if (t.t === "lam") return DEFS[t.v] ? t : { ...t, b: expand(t.b, depth) };
  return { t: "app", f: expand(t.f, depth), a: expand(t.a, depth) };
}

function freshName(v, avoid) {
  const base = v.replace(/\d+$/, "");
  for (let k = 1; ; k++) if (!avoid.has(base + k)) return base + k;
}

/** t[x := s], renaming bound variables that would capture s's free ones. */
function subst(t, x, s, fvS = free(s)) {
  if (t.t === "var") return t.v === x ? s : t;
  if (t.t === "app") return { t: "app", f: subst(t.f, x, s, fvS), a: subst(t.a, x, s, fvS) };
  if (t.v === x) return t;
  if (fvS.has(t.v) && free(t.b).has(x)) {
    const nv = freshName(t.v, new Set([...fvS, ...free(t.b), x]));
    const b = subst(t.b, t.v, { t: "var", v: nv });
    return { t: "lam", v: nv, b: subst(b, x, s, fvS) };
  }
  return { t: "lam", v: t.v, b: subst(t.b, x, s, fvS) };
}

/** Path to the leftmost-outermost redex, or null in normal form. */
function redexPath(t) {
  if (t.t === "app") {
    if (t.f.t === "lam") return [];
    const l = redexPath(t.f);
    if (l) return ["f", ...l];
    const r = redexPath(t.a);
    return r ? ["a", ...r] : null;
  }
  if (t.t === "lam") { const b = redexPath(t.b); return b ? ["b", ...b] : null; }
  return null;
}

function contract(t, path) {
  if (!path.length) return subst(t.f.b, t.f.v, t.a);
  const [k, ...rest] = path;
  return { ...t, [k]: contract(t[k], rest) };
}

// Printing: λ bodies extend right, application is left-associative.
function print(t, mark, path = [], parts = [], ctx = "top") {
  const here = mark && mark.length === path.length && mark.every((k, i) => k === path[i]);
  const start = parts.length;
  const paren = (t.t === "lam" && ctx !== "top" && ctx !== "body") || (t.t === "app" && ctx === "arg");
  if (paren) parts.push("(");
  if (t.t === "var") parts.push(t.v);
  else if (t.t === "lam") {
    parts.push("λ" + t.v);
    let b = t.b, bp = [...path, "b"];
    while (b.t === "lam" && !(mark && mark.length === bp.length && mark.every((k, i) => k === bp[i]))) { parts.push(" " + b.v); b = b.b; bp = [...bp, "b"]; }
    parts.push(". ");
    print(b, mark, bp, parts, "body");
  } else {
    print(t.f, mark, [...path, "f"], parts, "fn");
    parts.push(" ");
    print(t.a, mark, [...path, "a"], parts, "arg");
  }
  if (paren) parts.push(")");
  if (here) parts.splice(start, parts.length - start, { redex: parts.slice(start).map((x) => (typeof x === "string" ? x : x.redex)).join("") });
  return parts;
}

const size = (t) => (t.t === "var" ? 1 : t.t === "lam" ? 1 + size(t.b) : size(t.f) + size(t.a));

function church(t) {
  if (t.t !== "lam" || t.b.t !== "lam") return null;
  const f = t.v, x = t.b.v;
  if (f === x) return null;
  let n = 0, b = t.b.b;
  while (b.t === "app" && b.f.t === "var" && b.f.v === f) { n++; b = b.a; }
  if (b.t === "var" && b.v === x) return String(n);
  if (t.b.b.t === "var") return t.b.b.v === f ? "TRUE" : null;
  return null;
}

for (const root of document.querySelectorAll("[data-plt-lambda]")) {
  const input = root.querySelector('[data-in="term"]');
  const trace = root.querySelector("[data-trace]");
  let steps = [], k = 0, normal = false;
  presets(root.querySelector("[data-presets]"), [
    ["SUCC (SUCC ZERO)", "SUCC (SUCC ZERO)"], ["PLUS TWO THREE", "PLUS TWO THREE"], ["MULT TWO THREE", "MULT TWO THREE"],
    ["PRED THREE", "PRED THREE"], ["IF FALSE ONE TWO", "IF FALSE ONE TWO"], ["capture", "(\\x y. x y) y"],
    ["factorial 2 with Y", "Y (\\f n. IF (ISZERO n) ONE (MULT n (f (PRED n)))) TWO"], ["OMEGA", "OMEGA"],
  ], (v) => setInput(input, v));

  function load() {
    steps = []; k = 0; normal = false;
    let t;
    try { t = expand(parseLam(input.value)); input.removeAttribute("data-bad"); }
    catch (e) { input.setAttribute("data-bad", ""); msg(root, e.message, "bad"); trace.replaceChildren(); return; }
    // Precompute the reduction so Back is instant.
    for (let n = 0; n <= LIMIT; n++) {
      const path = redexPath(t);
      steps.push({ t, path });
      if (!path) { normal = true; break; }
      if (size(t) > 4000) break;
      t = contract(t, path);
    }
    k = 0;
    render();
  }

  function line(st, idx) {
    const parts = print(st.t, st.path);
    const text = parts.map((x) => (typeof x === "string" ? x : x.redex)).join("");
    const nodes = text.length > 700 ? [text.slice(0, 700) + " …"] : parts.map((x) => typeof x === "string" ? x
      : h("span", { class: idx === k ? "rounded-sm bg-brand/15 text-brand underline decoration-brand underline-offset-4" : "underline decoration-foreground/30 underline-offset-4", text: x.redex }));
    return h("li", { class: "flex gap-3 py-0.5 " + (idx === k ? "" : "opacity-60") },
      h("span", { class: "w-10 shrink-0 text-right text-muted-foreground tabular-nums", text: idx === 0 ? "start" : idx }),
      h("span", { class: "break-all whitespace-pre-wrap" }, ...nodes));
  }

  function render() {
    const from = Math.max(0, k - 30);
    trace.replaceChildren(...steps.slice(from, k + 1).map((st, i) => line(st, from + i)));
    trace.scrollTop = trace.scrollHeight;
    const last = steps.length - 1;
    const atEnd = k === last;
    out(root, "steps", `${k} / ${normal ? last : `${last}+`}`);
    const nf = steps[last];
    out(root, "normal", normal ? (atEnd ? "reached" : `after ${last} steps`) : `none within ${last} steps`);
    out(root, "church", normal && atEnd ? church(nf.t) ?? "—" : "—");
    if (!normal && atEnd) msg(root, `no normal form within ${last} steps (the term may diverge)`, "bad");
    else if (atEnd) msg(root, "normal form: no redex left", "good");
    else msg(root, "the underlined redex is contracted next");
  }

  stepper(root, {
    reset: () => { k = 0; render(); },
    back: () => { k = Math.max(0, k - 1); render(); },
    step: () => { k = Math.min(steps.length - 1, k + 1); render(); },
    run: () => { k = steps.length - 1; render(); },
  });
  onInput(input, load, 250);
  load();
}
