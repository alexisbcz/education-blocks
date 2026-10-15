// Answer checking for the assessment blocks: a small expression language
// (tokenizer + Pratt parser, never eval or Function), MathML rendering of the
// parse tree, equivalence by evaluation at random points, and a unit parser
// for physical quantities. Exports only; it does nothing on its own.

// ------------------------------------------------------------ tokenizer

const FUNCS = new Set(["sin", "cos", "tan", "exp", "ln", "log", "sqrt", "abs"]);
const CONSTS = { pi: Math.PI, e: Math.E };
const SUPERS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };

/** Normalises typographic input: − × · ÷ π and superscript digits. */
export function normalise(s) {
  return s
    .replace(/[−–]/g, "-")
    .replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/\*\*/g, "^")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => "^(" + [...m].map((c) => SUPERS[c]).join("") + ")");
}

export class ParseError extends Error {
  constructor(msg, at) { super(msg); this.at = at; }
}

function tokenize(src, vars) {
  const s = normalise(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new ParseError(`Unexpected "${c}"`, i);
      out.push({ t: "num", v: parseFloat(m[0]), s: m[0], at: i });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z]+/.exec(s.slice(i))[0];
      // Split runs of letters greedily into known names: "xsin" → x sin,
      // "pix" → pi x. Unknown letters are an error, not a silent variable.
      let j = 0;
      while (j < m.length) {
        const rest = m.slice(j);
        const name = [...FUNCS, ...Object.keys(CONSTS), ...vars].sort((a, b) => b.length - a.length).find((n) => rest.startsWith(n));
        if (!name) throw new ParseError(`Unknown name "${rest}". Use ${vars.join(", ")}${vars.length ? ", " : ""}pi, e, sin, cos, tan, exp, ln, sqrt, abs.`, i + j);
        out.push({ t: FUNCS.has(name) ? "fn" : "id", v: name, at: i + j });
        j += name.length;
      }
      i += m.length;
      continue;
    }
    if ("+-*/^(),".includes(c)) { out.push({ t: c, at: i }); i++; continue; }
    throw new ParseError(`Unexpected "${c}"`, i);
  }
  // Implicit multiplication: 2x, 2(x+1), x(x+1), (a)(b), x sin x, 3pi.
  const res = [];
  for (const tk of out) {
    const prev = res[res.length - 1];
    if (prev && (prev.t === "num" || prev.t === "id" || prev.t === ")") && (tk.t === "num" || tk.t === "id" || tk.t === "fn" || tk.t === "(")) {
      res.push({ t: "*", implicit: true, at: tk.at });
    }
    res.push(tk);
  }
  res.push({ t: "end", at: s.length });
  return res;
}

// ------------------------------------------------------------ Pratt parser

const BP = { "+": 10, "-": 10, "*": 20, "/": 20, "^": 30 };

/**
 * parse returns an AST: {k:"num",v} {k:"id",v} {k:"neg",a} {k:"fn",f,a}
 * {k:"+"|"-"|"*"|"/"|"^",a,b,implicit?}. vars are the allowed variables.
 */
export function parse(src, vars = ["x"]) {
  if (!src.trim()) throw new ParseError("Type an expression.", 0);
  const toks = tokenize(src, vars);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (t) => {
    const tk = next();
    if (tk.t !== t) throw new ParseError(t === ")" ? "A bracket is not closed." : `Expected "${t}"`, tk.at);
  };

  function nud(tk) {
    switch (tk.t) {
      case "num": return { k: "num", v: tk.v, s: tk.s };
      case "id": return { k: "id", v: tk.v };
      case "-": return { k: "neg", a: expr(25) }; // binds looser than ^: -x^2 = -(x^2)
      case "+": return expr(25);
      case "(": { const e = expr(0); expect(")"); return { k: "paren", a: e }; }
      case "fn": {
        // sin x and sin(x) both work; sin x^2 means sin(x^2), like most CAS.
        if (peek().t === "(") { next(); const a = expr(0); expect(")"); return { k: "fn", f: tk.v, a }; }
        return { k: "fn", f: tk.v, a: expr(20) };
      }
      case "end": throw new ParseError("The expression ends too early.", tk.at);
      default: throw new ParseError(`Unexpected "${tk.t}"`, tk.at);
    }
  }

  function expr(rbp) {
    let left = nud(next());
    for (;;) {
      const tk = peek();
      const bp = BP[tk.t];
      if (bp === undefined || bp <= rbp) break;
      next();
      // ^ is right-associative: 2^3^2 = 2^(3^2).
      const right = tk.t === "^" ? expr(bp - 1) : expr(bp);
      left = { k: tk.t, a: left, b: right, implicit: tk.implicit };
    }
    return left;
  }

  const tree = expr(0);
  const tk = peek();
  if (tk.t !== "end") throw new ParseError(tk.t === ")" ? "There is an extra closing bracket." : `Unexpected "${tk.t}"`, tk.at);
  return tree;
}

// ------------------------------------------------------------ evaluation

const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs };

export function evaluate(n, env) {
  switch (n.k) {
    case "num": return n.v;
    case "id": return n.v in env ? env[n.v] : CONSTS[n.v];
    case "paren": return evaluate(n.a, env);
    case "neg": return -evaluate(n.a, env);
    case "fn": return FN[n.f](evaluate(n.a, env));
    case "+": return evaluate(n.a, env) + evaluate(n.b, env);
    case "-": return evaluate(n.a, env) - evaluate(n.b, env);
    case "*": return evaluate(n.a, env) * evaluate(n.b, env);
    case "/": return evaluate(n.a, env) / evaluate(n.b, env);
    case "^": return Math.pow(evaluate(n.a, env), evaluate(n.b, env));
  }
  return NaN;
}

/** A tiny seeded generator (mulberry32), so checks are reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * equivalent compares two trees at random points of [lo, hi] for variable
 * x. mode "exact" needs equal values; "constant" accepts a constant
 * difference (antiderivatives). Returns {ok, points:[{x, a, b}], offset}.
 */
export function equivalent(ta, tb, { mode = "exact", lo = -2, hi = 2, n = 12, seed = 7, v = "x" } = {}) {
  const r = rng(seed);
  const points = [];
  let tries = 0;
  while (points.length < n && tries++ < n * 20) {
    const x = lo + (hi - lo) * r();
    const a = evaluate(ta, { [v]: x }), b = evaluate(tb, { [v]: x });
    if (!Number.isFinite(b)) continue; // outside the target's domain
    points.push({ x, a, b });
  }
  if (!points.length) return { ok: false, points };
  const tol = (y) => 1e-7 * Math.max(1, Math.abs(y));
  if (mode === "constant") {
    const off = points[0].a - points[0].b;
    const ok = points.every((p) => Number.isFinite(p.a) && Math.abs(p.a - p.b - off) <= tol(p.b) + tol(off));
    return { ok, points, offset: off };
  }
  const ok = points.every((p) => Number.isFinite(p.a) && Math.abs(p.a - p.b) <= tol(p.b));
  return { ok, points };
}

/** isProduct says whether the top of the tree is a product (factored form). */
export function isProduct(n) {
  while (n.k === "paren") n = n.a;
  if (n.k === "neg") return isProduct(n.a);
  if (n.k === "*") return true;
  if (n.k === "^") { let b = n.a; while (b.k === "paren") b = b.a; return b.k === "+" || b.k === "-"; }
  return false;
}

// ------------------------------------------------------------ MathML

const MML = "http://www.w3.org/1998/Math/MathML";
function m(tag, ...kids) {
  const e = document.createElementNS(MML, tag);
  for (const k of kids) e.append(typeof k === "string" ? k : k);
  return e;
}
const PREC = { "+": 1, "-": 1, neg: 2, "*": 3, "/": 4, "^": 5, fn: 4, num: 6, id: 6, paren: 6 };
const prec = (n) => PREC[n.k] ?? 6;
function fenced(node) { return m("mrow", m("mo", "("), node, m("mo", ")")); }

/** toMathML turns a tree into a <math> element (built with DOM, no HTML). */
export function toMathML(tree, display = false) {
  const root = m("math", mm(tree));
  if (display) root.setAttribute("display", "block");
  return root;
}

function mm(n) {
  switch (n.k) {
    case "num": return m("mn", n.s ?? String(n.v));
    case "id": return n.v === "pi" ? m("mi", "π") : m("mi", n.v);
    case "paren": return fenced(mm(n.a));
    case "neg": {
      const a = mm(n.a);
      return m("mrow", m("mo", "−"), prec(n.a) <= 2 ? fenced(a) : a);
    }
    case "fn": {
      const name = n.f === "sqrt" ? null : m("mi", n.f);
      if (n.f === "sqrt") return m("msqrt", mm(strip(n.a)));
      if (n.f === "abs") return m("mrow", m("mo", "|"), mm(strip(n.a)), m("mo", "|"));
      const arg = strip(n.a);
      const simple = arg.k === "num" || arg.k === "id";
      return m("mrow", name, m("mo", "⁡"), simple ? mm(arg) : fenced(mm(arg)));
    }
    case "+": case "-": {
      const b = mm(n.b);
      const wrapB = n.k === "-" && (n.b.k === "+" || n.b.k === "-");
      return m("mrow", mm(n.a), m("mo", n.k === "-" ? "−" : "+"), wrapB ? fenced(b) : b);
    }
    case "*": {
      const wrap = (c) => (prec(c) < 3 ? fenced(mm(c)) : mm(c));
      const op = n.implicit ? m("mo", "⁢") : m("mo", "·");
      return m("mrow", wrap(n.a), op, wrap(n.b));
    }
    case "/": return m("mfrac", mm(strip(n.a)), mm(strip(n.b)));
    case "^": {
      const base = prec(n.a) < 6 || n.a.k === "fn" ? fenced(mm(strip(n.a))) : mm(n.a);
      return m("msup", base, mm(strip(n.b)));
    }
  }
  return m("mi", "?");
}
const strip = (n) => (n.k === "paren" ? strip(n.a) : n);

// ------------------------------------------------------------ units

// Dimensions are [length, mass, time]; each unit has a factor to SI.
const UNITS = {
  m: [1, [1, 0, 0]], g: [1e-3, [0, 1, 0]], s: [1, [0, 0, 1]],
  min: [60, [0, 0, 1]], h: [3600, [0, 0, 1]], hr: [3600, [0, 0, 1]],
  ft: [0.3048, [1, 0, 0]], in: [0.0254, [1, 0, 0]], mi: [1609.344, [1, 0, 0]],
  N: [1, [1, 1, -2]], J: [1, [2, 1, -2]], W: [1, [2, 1, -3]], Hz: [1, [0, 0, -1]],
  mph: [0.44704, [1, 0, -1]], kph: [1 / 3.6, [1, 0, -1]],
};
const PREFIX = { k: 1e3, c: 1e-2, m: 1e-3, "µ": 1e-6, u: 1e-6, M: 1e6 };

function unitAtom(sym) {
  if (UNITS[sym]) return UNITS[sym];
  const p = sym[0];
  if (PREFIX[p] && UNITS[sym.slice(1)]) {
    const [f, d] = UNITS[sym.slice(1)];
    return [f * PREFIX[p], d];
  }
  return null;
}

/**
 * parseQuantity reads "19.8 m/s", "1.98e1 m·s^-1", "71 km/h", "981 cm/s²".
 * Returns {value, si, dim, digits, unitText} or throws ParseError.
 */
export function parseQuantity(text) {
  const s = text.trim().replace(/[−–]/g, "-").replace(/,/g, ".").replace(/\s*[×x]\s*10\^?\s*([-+]?\d+)/, "e$1");
  const m = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(.*)$/.exec(s);
  if (!m) throw new ParseError("Start with a number, then the unit.", 0);
  const value = parseFloat(m[1]);
  const mant = m[1].replace(/^[-+]/, "").replace(/[eE].*$/, "");
  const digits = sigDigits(mant);
  let rest = m[2].replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (x) => "^" + [...x].map((c) => SUPERS[c]).join("")).replace(/\*\*/g, "^");
  if (!rest) return { value, text: m[1], si: value, dim: [0, 0, 0], digits, unitText: "" };
  // Units: atoms joined by ·, *, space or /, each with an optional ^n.
  let factor = 1;
  const dim = [0, 0, 0];
  let sign = 1;
  const re = /\s*([/*·.\s])?\s*([a-zA-Zµ]+)(?:\^\(?([-+]?\d+)\)?)?/y;
  let i = 0;
  while (i < rest.length) {
    re.lastIndex = i;
    const u = re.exec(rest);
    if (!u) throw new ParseError(`Cannot read the unit "${rest.slice(i).trim()}".`, i);
    if (u[1] === "/") sign = -1;
    const a = unitAtom(u[2]);
    if (!a) throw new ParseError(`Unknown unit "${u[2]}".`, i);
    const e = sign * (u[3] ? parseInt(u[3], 10) : 1);
    factor *= a[0] ** e;
    for (let k = 0; k < 3; k++) dim[k] += a[1][k] * e;
    i = re.lastIndex;
  }
  return { value, text: m[1], si: value * factor, dim, digits, unitText: rest.trim() };
}

function sigDigits(mant) {
  const d = mant.replace(".", "").replace(/^0+/, "");
  if (!d) return 1;
  // Trailing zeros count only with a decimal point ("20." or "20.0").
  return mant.includes(".") ? d.length : d.replace(/0+$/, "").length || 1;
}

const DIM_NAMES = [
  [[1, 0, -1], "a speed"], [[1, 0, -2], "an acceleration"], [[1, 0, 0], "a length"], [[0, 0, 1], "a time"],
  [[0, 1, 0], "a mass"], [[1, 1, -2], "a force"], [[2, 1, -2], "an energy"], [[0, 0, 0], "a pure number"],
];
export function dimName(d) {
  const f = DIM_NAMES.find(([v]) => v.every((x, i) => x === d[i]));
  if (f) return f[1];
  const sym = ["m", "kg", "s"];
  return d.map((e, i) => (e ? sym[i] + (e === 1 ? "" : "^" + e) : "")).filter(Boolean).join("·");
}
const SI = [[[1, 0, -1], "m/s"], [[1, 0, -2], "m/s²"], [[1, 0, 0], "m"], [[0, 0, 1], "s"], [[0, 1, 0], "kg"], [[1, 1, -2], "N"], [[2, 1, -2], "J"], [[0, 0, 0], ""]];
/** siUnit names the SI unit of a dimension: "m/s", "N", or "m^2·s^-2". */
export function siUnit(d) {
  const f = SI.find(([v]) => v.every((x, i) => x === d[i]));
  if (f) return f[1];
  const sym = ["m", "kg", "s"];
  return d.map((e, i) => (e ? sym[i] + (e === 1 ? "" : "^" + e) : "")).filter(Boolean).join("·");
}
export const sameDim = (a, b) => a.every((x, i) => x === b[i]);
