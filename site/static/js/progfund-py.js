// A step-through interpreter for a teaching subset of Python. Pure
// module: importing it does nothing on its own.
//
// The tokenizer, parser and tree-walking evaluator are written here from
// scratch; user code is never handed to eval or Function. Evaluation is a
// tree of generators: every statement yields a "line" event, every call a
// "call" and a "return", so a driver can stop between any two steps and
// record the frames and the heap, Python Tutor style.
//
// Supported: int (arbitrary precision, as BigInt), float, bool, None,
// str, list, tuple, dict; arithmetic with Python's floor division and
// modulo; chained comparisons, and/or/not, conditional expressions;
// if/elif/else, while, for, break, continue, pass, def with defaults and
// keyword arguments, return, recursion, assert, tuple unpacking,
// augmented assignment, slicing with steps, list/dict comprehensions and
// generator expressions (evaluated eagerly), f-strings with simple format
// specs, the modules math and copy, and the usual builtins and methods.

// ------------------------------------------------------------ errors

export class PyError extends Error {
  constructor(type, message, line) {
    super(message);
    this.type = type;
    this.line = line;
  }
  toString() {
    return `${this.type}: ${this.message}`;
  }
}

let CUR = null; // the running interpreter, for the line number of errors

function raise(type, message) {
  throw new PyError(type, message, CUR ? CUR.line : undefined);
}

// ------------------------------------------------------------ tokenizer

const OPS3 = ["**=", "//=", "..."];
const OPS2 = ["**", "//", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "->"];
const OPS1 = "+-*/%<>=()[]{},:.;@";
const KEYWORDS = new Set(["False", "None", "True", "and", "as", "assert", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"]);

const isDigit = (c) => c >= "0" && c <= "9";
const isIdStart = (c) => c === "_" || /\p{L}/u.test(c ?? "");
const isIdChar = (c) => isIdStart(c) || isDigit(c ?? "");

export function tokenize(src) {
  const toks = [];
  const indents = [0];
  let depth = 0;
  let i = 0;
  let line = 1;
  const n = src.length;
  let lineStart = true;
  const fail = (m, l = line) => {
    throw new PyError("SyntaxError", m, l);
  };
  while (i < n) {
    if (lineStart && depth === 0) {
      let col = 0;
      let j = i;
      while (j < n && (src[j] === " " || src[j] === "\t")) {
        col += src[j] === "\t" ? 4 - (col % 4) : 1;
        j++;
      }
      if (j >= n) break;
      if (src[j] === "\n" || src[j] === "\r" || src[j] === "#") {
        while (j < n && src[j] !== "\n") j++;
        i = j + 1;
        line++;
        continue;
      }
      const top = indents[indents.length - 1];
      if (col > top) {
        indents.push(col);
        toks.push({ t: "indent", line });
      } else if (col < top) {
        while (col < indents[indents.length - 1]) {
          indents.pop();
          toks.push({ t: "dedent", line });
        }
        if (col !== indents[indents.length - 1]) fail("unindent does not match any outer indentation level");
      }
      i = j;
      lineStart = false;
    }
    const c = src[i];
    if (c === "\n") {
      if (depth === 0) {
        toks.push({ t: "nl", line });
        lineStart = true;
      }
      i++;
      line++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "\\" && src[i + 1] === "\n") {
      i += 2;
      line++;
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? ""))) {
      let j = i;
      let float = false;
      while (j < n && (isDigit(src[j]) || src[j] === "_")) j++;
      if (src[j] === "." && !(src[j + 1] === "." )) {
        float = true;
        j++;
        while (j < n && (isDigit(src[j]) || src[j] === "_")) j++;
      }
      if (src[j] === "e" || src[j] === "E") {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (isDigit(src[k] ?? "")) {
          float = true;
          j = k;
          while (j < n && isDigit(src[j])) j++;
        }
      }
      const text = src.slice(i, j).replace(/_/g, "");
      if (isIdStart(src[j])) fail("invalid decimal literal");
      toks.push({ t: "num", v: float ? Number(text) : BigInt(text), line });
      i = j;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < n && isIdChar(src[j])) j++;
      const word = src.slice(i, j);
      const q = src[j];
      if ((q === '"' || q === "'") && /^[fFrR]{1,2}$/.test(word)) {
        const lower = word.toLowerCase();
        const s = readString(j);
        toks.push({ t: lower.includes("f") ? "fstr" : "str", v: lower.includes("r") ? s.raw : s.value, raw: s.raw, line: s.line });
        continue;
      }
      toks.push({ t: KEYWORDS.has(word) ? "kw" : "name", v: word, line });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const s = readString(i);
      toks.push({ t: "str", v: s.value, raw: s.raw, line: s.line });
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    let op = OPS3.includes(three) ? three : OPS2.includes(two) ? two : OPS1.includes(c) ? c : null;
    if (!op) {
      if (c === "!") fail("invalid syntax: did you mean != ?");
      fail(`invalid character '${c}'`);
    }
    if ("([{".includes(op)) depth++;
    if (")]}".includes(op)) depth = Math.max(0, depth - 1);
    toks.push({ t: "op", v: op, line });
    i += op.length;
  }
  if (toks.length && toks[toks.length - 1].t !== "nl") toks.push({ t: "nl", line });
  while (indents.length > 1) {
    indents.pop();
    toks.push({ t: "dedent", line });
  }
  toks.push({ t: "eof", line });
  return toks;

  // Reads a string literal starting at the quote at k; advances i.
  function readString(k) {
    const q = src[k];
    const triple = src.slice(k, k + 3) === q + q + q;
    const startLine = line;
    let j = k + (triple ? 3 : 1);
    let value = "";
    let raw = "";
    for (;;) {
      if (j >= n) fail(triple ? "unterminated triple-quoted string literal" : "unterminated string literal", startLine);
      const ch = src[j];
      if (triple ? src.slice(j, j + 3) === q + q + q : ch === q) {
        j += triple ? 3 : 1;
        break;
      }
      if (ch === "\n") {
        if (!triple) fail("unterminated string literal", startLine);
        line++;
      }
      if (ch === "\\" && j + 1 < n) {
        const e = src[j + 1];
        raw += ch + e;
        const map = { n: "\n", t: "\t", "\\": "\\", "'": "'", '"': '"', r: "\r", 0: "\0" };
        if (e in map) value += map[e];
        else if (e === "\n") line++;
        else value += "\\" + e;
        j += 2;
        continue;
      }
      value += ch;
      raw += ch;
      j++;
    }
    i = j;
    return { value, raw, line: startLine };
  }
}

// ------------------------------------------------------------ parser

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const at = (t, v) => peek().t === t && (v === undefined || peek().v === v);
  const isOp = (v) => at("op", v);
  const isKw = (v) => at("kw", v);
  const fail = (m, tok = peek()) => {
    throw new PyError("SyntaxError", m, tok.line);
  };
  const next = () => toks[p++];
  const expectOp = (v) => {
    if (!isOp(v)) fail(`expected '${v}'${describe()}`);
    return next();
  };
  const expectName = () => {
    if (!at("name")) fail(`expected a name${describe()}`);
    return next().v;
  };
  function describe() {
    const t = peek();
    if (t.t === "nl") return " at the end of the line";
    if (t.t === "eof") return " at the end of the program";
    if (t.t === "indent") return ": unexpected indent";
    return t.v !== undefined ? `, found '${typeof t.v === "bigint" ? t.v.toString() : t.v}'` : "";
  }

  function program() {
    const body = [];
    while (!at("eof")) {
      if (at("nl")) {
        next();
        continue;
      }
      if (at("indent")) fail("unexpected indent");
      body.push(...statement());
    }
    return body;
  }

  // A statement; simple statements on one line separated by ; become several.
  function statement() {
    const t = peek();
    if (t.t === "kw") {
      switch (t.v) {
        case "if": return [ifStmt()];
        case "while": return [whileStmt()];
        case "for": return [forStmt()];
        case "def": return [defStmt()];
        case "class": fail("classes aren't part of this tracer's subset");
        case "try": fail("try/except isn't part of this tracer's subset");
        case "with": fail("with isn't part of this tracer's subset");
      }
    }
    const out = [simple()];
    while (isOp(";")) {
      next();
      if (at("nl")) break;
      out.push(simple());
    }
    if (!at("nl") && !at("eof")) fail(`invalid syntax${describe()}`);
    if (at("nl")) next();
    return out;
  }

  function block() {
    expectOp(":");
    if (!at("nl")) {
      // if x: return 1
      const out = [simple()];
      while (isOp(";")) {
        next();
        if (at("nl")) break;
        out.push(simple());
      }
      if (at("nl")) next();
      return out;
    }
    next();
    while (at("nl")) next();
    if (!at("indent")) fail("expected an indented block");
    next();
    const body = [];
    while (!at("dedent") && !at("eof")) {
      if (at("nl")) {
        next();
        continue;
      }
      body.push(...statement());
    }
    if (at("dedent")) next();
    return body;
  }

  function ifStmt() {
    const line = next().line;
    const tests = [{ cond: expr(), body: block(), line }];
    let orelse = null;
    while (isKw("elif")) {
      const l = next().line;
      tests.push({ cond: expr(), body: block(), line: l });
    }
    if (isKw("else")) {
      next();
      orelse = block();
    }
    return { k: "if", tests, orelse, line };
  }

  function whileStmt() {
    const line = next().line;
    const cond = expr();
    const body = block();
    if (isKw("else")) fail("while … else isn't part of this tracer's subset");
    return { k: "while", cond, body, line };
  }

  function forStmt() {
    const line = next().line;
    const target = targetList();
    if (!isKw("in")) fail(`expected 'in'${describe()}`);
    next();
    const iter = exprList();
    const body = block();
    if (isKw("else")) fail("for … else isn't part of this tracer's subset");
    return { k: "for", target, iter, body, line };
  }

  function defStmt() {
    const line = next().line;
    const name = expectName();
    expectOp("(");
    const params = [];
    while (!isOp(")")) {
      const pname = expectName();
      let def = null;
      if (isOp(":")) {
        next();
        expr(); // annotation, ignored
      }
      if (isOp("=")) {
        next();
        def = expr();
      } else if (params.some((q) => q.def)) fail("parameter without a default follows parameter with a default");
      params.push({ name: pname, def });
      if (!isOp(")")) expectOp(",");
    }
    next();
    if (isOp("->")) {
      next();
      expr();
    }
    const body = block();
    const locals = new Set(params.map((q) => q.name));
    collectLocals(body, locals);
    return { k: "def", name, params, body, line, locals, last: lastLine(body) };
  }

  function simple() {
    const t = peek();
    const line = t.line;
    if (t.t === "kw") {
      switch (t.v) {
        case "pass": next(); return { k: "pass", line };
        case "break": next(); return { k: "break", line };
        case "continue": next(); return { k: "continue", line };
        case "return": {
          next();
          const e = at("nl") || isOp(";") || at("eof") ? null : exprList();
          return { k: "return", e, line };
        }
        case "assert": {
          next();
          const e = expr();
          let msg = null;
          if (isOp(",")) {
            next();
            msg = expr();
          }
          return { k: "assert", e, msg, line };
        }
        case "import": {
          next();
          const names = [expectName()];
          while (isOp(",")) {
            next();
            names.push(expectName());
          }
          if (isKw("as")) fail("import … as isn't part of this tracer's subset");
          return { k: "import", names, line };
        }
        case "from": {
          next();
          const mod = expectName();
          if (!isKw("import")) fail("expected 'import'");
          next();
          const names = [expectName()];
          while (isOp(",")) {
            next();
            names.push(expectName());
          }
          return { k: "from", mod, names, line };
        }
        case "global":
        case "nonlocal":
        case "del":
        case "raise":
        case "lambda":
        case "yield":
          fail(`${t.v} isn't part of this tracer's subset`);
      }
    }
    const first = exprList();
    if (isOp("=")) {
      const targets = [first];
      let value;
      while (isOp("=")) {
        next();
        value = exprList();
        if (isOp("=")) targets.push(value);
      }
      for (const tg of targets) checkTarget(tg);
      return { k: "assign", targets, value, line };
    }
    for (const op of ["+=", "-=", "*=", "/=", "//=", "%=", "**="]) {
      if (isOp(op)) {
        next();
        if (first.k !== "name" && first.k !== "sub") fail("illegal target for augmented assignment");
        return { k: "aug", target: first, op: op.slice(0, -1), value: exprList(), line };
      }
    }
    if (isOp("==") === false && first.k === "name" && isOp(":")) fail("annotations aren't part of this tracer's subset");
    return { k: "expr", e: first, line };
  }

  function checkTarget(t) {
    if (t.k === "name" || t.k === "sub") return;
    if (t.k === "tuple" || t.k === "list") return t.items.forEach(checkTarget);
    fail(`cannot assign to ${t.k === "call" ? "function call" : t.k === "num" || t.k === "str" ? "literal" : "expression"}`);
  }

  function targetList() {
    const items = [target()];
    let tuple = false;
    while (isOp(",")) {
      tuple = true;
      next();
      if (isKw("in")) break;
      items.push(target());
    }
    return tuple ? { k: "tuple", items } : items[0];
  }
  function target() {
    if (isOp("(")) {
      next();
      const t = targetList();
      expectOp(")");
      return t;
    }
    const e = primary();
    checkTarget(e);
    return e;
  }

  // Expressions separated by commas form a tuple.
  function exprList() {
    const line = peek().line;
    const first = expr();
    if (!isOp(",")) return first;
    const items = [first];
    while (isOp(",")) {
      next();
      if (at("nl") || isOp("=") || isOp(")") || at("eof")) break;
      items.push(expr());
    }
    return { k: "tuple", items, line };
  }

  function expr() {
    const line = peek().line;
    if (isKw("lambda")) fail("lambda isn't part of this tracer's subset");
    const e = orTest();
    if (isKw("if") && !inCompIf) {
      next();
      const test = orTest();
      if (!isKw("else")) fail("expected 'else' in a conditional expression");
      next();
      return { k: "ifexp", test, body: e, orelse: expr(), line };
    }
    return e;
  }
  let inCompIf = false;

  function orTest() {
    let e = andTest();
    if (!isKw("or")) return e;
    const vals = [e];
    while (isKw("or")) {
      next();
      vals.push(andTest());
    }
    return { k: "bool", op: "or", vals };
  }
  function andTest() {
    let e = notTest();
    if (!isKw("and")) return e;
    const vals = [e];
    while (isKw("and")) {
      next();
      vals.push(notTest());
    }
    return { k: "bool", op: "and", vals };
  }
  function notTest() {
    if (isKw("not")) {
      next();
      return { k: "not", e: notTest() };
    }
    return comparison();
  }
  function comparison() {
    const first = arith();
    const ops = [];
    const operands = [first];
    for (;;) {
      let op = null;
      if (["<", ">", "==", "!=", "<=", ">="].some((o) => isOp(o))) op = next().v;
      else if (isOp("=") && false) op = "=";
      else if (isKw("in")) {
        next();
        op = "in";
      } else if (isKw("not") && peek(1).t === "kw" && peek(1).v === "in") {
        next();
        next();
        op = "not in";
      } else if (isKw("is")) {
        next();
        op = "is";
        if (isKw("not")) {
          next();
          op = "is not";
        }
      }
      if (!op) break;
      ops.push(op);
      operands.push(arith());
    }
    return ops.length ? { k: "cmp", ops, operands } : first;
  }
  function arith() {
    let e = term();
    while (isOp("+") || isOp("-")) {
      const op = next().v;
      e = { k: "bin", op, l: e, r: term() };
    }
    return e;
  }
  function term() {
    let e = factor();
    while (isOp("*") || isOp("/") || isOp("//") || isOp("%") || isOp("@")) {
      const tok = next();
      if (tok.v === "@") fail("the @ operator needs numpy, which this tracer doesn't have", tok);
      e = { k: "bin", op: tok.v, l: e, r: factor() };
    }
    return e;
  }
  function factor() {
    if (isOp("-") || isOp("+")) {
      const op = next().v;
      return { k: "unary", op, e: factor() };
    }
    return power();
  }
  function power() {
    const base = primary();
    if (isOp("**")) {
      next();
      return { k: "bin", op: "**", l: base, r: factor() };
    }
    return base;
  }
  function primary() {
    let e = atom();
    for (;;) {
      if (isOp("(")) {
        const line = next().line;
        const args = [];
        const kwargs = [];
        while (!isOp(")")) {
          if (at("name") && peek(1).t === "op" && peek(1).v === "=") {
            const name = next().v;
            next();
            kwargs.push([name, expr()]);
          } else {
            if (isOp("*")) fail("*args isn't part of this tracer's subset");
            if (kwargs.length) fail("positional argument follows keyword argument");
            const a = expr();
            if (isKw("for")) {
              args.push(comprehension("gen", a, line));
            } else args.push(a);
          }
          if (!isOp(")")) expectOp(",");
        }
        next();
        e = { k: "call", fn: e, args, kwargs, line };
      } else if (isOp("[")) {
        const line = next().line;
        const index = subscript();
        expectOp("]");
        e = { k: "sub", obj: e, index, line };
      } else if (isOp(".")) {
        next();
        e = { k: "attr", obj: e, name: expectName() };
      } else break;
    }
    return e;
  }
  function subscript() {
    const parts = [null, null, null];
    let slice = false;
    let idx = 0;
    if (!isOp(":")) parts[0] = expr();
    while (isOp(":")) {
      slice = true;
      next();
      idx++;
      if (idx > 2) fail("invalid slice");
      if (!isOp(":") && !isOp("]")) parts[idx] = expr();
    }
    if (!slice) {
      if (isOp(",")) fail("multi-dimensional indexing needs numpy; use a[i][j]");
      return parts[0];
    }
    return { k: "slice", lo: parts[0], hi: parts[1], step: parts[2] };
  }
  function atom() {
    const t = peek();
    const line = t.line;
    if (t.t === "num") {
      next();
      return { k: "num", v: t.v };
    }
    if (t.t === "str" || t.t === "fstr") {
      // Adjacent literals concatenate.
      const parts = [];
      while (at("str") || at("fstr")) {
        const s = next();
        if (s.t === "str") parts.push(s.v);
        else parts.push(...fstringParts(s.raw, s.line));
      }
      if (parts.every((x) => typeof x === "string")) return { k: "str", v: parts.join("") };
      return { k: "fstr", parts, line };
    }
    if (t.t === "name") {
      next();
      return { k: "name", id: t.v, line };
    }
    if (t.t === "kw") {
      if (t.v === "True" || t.v === "False") {
        next();
        return { k: "const", v: t.v === "True" };
      }
      if (t.v === "None") {
        next();
        return { k: "const", v: null };
      }
      fail(`invalid syntax${describe()}`);
    }
    if (isOp("(")) {
      next();
      if (isOp(")")) {
        next();
        return { k: "tuple", items: [], line };
      }
      const first = expr();
      if (isKw("for")) {
        const c = comprehension("gen", first, line);
        expectOp(")");
        return c;
      }
      if (isOp(")")) {
        next();
        return first.k === "tuple" ? { k: "paren", e: first } : first;
      }
      const items = [first];
      while (isOp(",")) {
        next();
        if (isOp(")")) break;
        items.push(expr());
      }
      expectOp(")");
      return { k: "tuple", items, line };
    }
    if (isOp("[")) {
      next();
      if (isOp("]")) {
        next();
        return { k: "list", items: [], line };
      }
      const first = expr();
      if (isKw("for")) {
        const c = comprehension("list", first, line);
        expectOp("]");
        return c;
      }
      const items = [first];
      while (isOp(",")) {
        next();
        if (isOp("]")) break;
        items.push(expr());
      }
      expectOp("]");
      return { k: "list", items, line };
    }
    if (isOp("{")) {
      next();
      if (isOp("}")) {
        next();
        return { k: "dict", pairs: [], line };
      }
      const key = expr();
      if (!isOp(":")) fail("sets aren't part of this tracer's subset; use a list or a dict");
      next();
      const value = expr();
      if (isKw("for")) {
        const c = comprehension("dict", [key, value], line);
        expectOp("}");
        return c;
      }
      const pairs = [[key, value]];
      while (isOp(",")) {
        next();
        if (isOp("}")) break;
        const k = expr();
        expectOp(":");
        pairs.push([k, expr()]);
      }
      expectOp("}");
      return { k: "dict", pairs, line };
    }
    fail(`invalid syntax${describe()}`);
  }
  function comprehension(kind, elt, line) {
    const gens = [];
    while (isKw("for")) {
      next();
      const target = targetList();
      if (!isKw("in")) fail("expected 'in'");
      next();
      const iter = orTest();
      const ifs = [];
      while (isKw("if")) {
        next();
        inCompIf = true;
        try {
          ifs.push(orTest());
        } finally {
          inCompIf = false;
        }
      }
      gens.push({ target, iter, ifs });
    }
    return { k: "comp", kind, elt, gens, line };
  }

  // f"…{expr:spec}…" → literal strings and {e, spec, conv} parts.
  function fstringParts(raw, line) {
    const parts = [];
    let lit = "";
    let i = 0;
    const unescape = (s) => s.replace(/\\(.)/g, (_, c) => ({ n: "\n", t: "\t", "\\": "\\", "'": "'", '"': '"' })[c] ?? "\\" + c);
    while (i < raw.length) {
      const c = raw[i];
      if (c === "{" && raw[i + 1] === "{") {
        lit += "{";
        i += 2;
      } else if (c === "}" && raw[i + 1] === "}") {
        lit += "}";
        i += 2;
      } else if (c === "{") {
        if (lit) parts.push(unescape(lit));
        lit = "";
        let depthB = 0;
        let j = i + 1;
        let colon = -1;
        let bang = -1;
        let quote = null;
        for (; j < raw.length; j++) {
          const d = raw[j];
          if (quote) {
            if (d === quote) quote = null;
            continue;
          }
          if (d === "'" || d === '"') quote = d;
          else if ("([{".includes(d)) depthB++;
          else if (")]".includes(d) || (d === "}" && depthB > 0)) depthB--;
          else if (d === "}" && depthB === 0) break;
          else if (d === ":" && depthB === 0 && colon < 0) colon = j;
          else if (d === "!" && depthB === 0 && raw[j + 1] !== "=" && colon < 0) bang = j;
        }
        if (j >= raw.length) throw new PyError("SyntaxError", "f-string: expecting '}'", line);
        const end = colon >= 0 ? colon : j;
        const exprEnd = bang >= 0 ? bang : end;
        const exprSrc = raw.slice(i + 1, exprEnd);
        if (!exprSrc.trim()) throw new PyError("SyntaxError", "f-string: empty expression not allowed", line);
        let e;
        try {
          e = parseExpression(exprSrc);
        } catch (err) {
          throw new PyError("SyntaxError", `f-string: ${err.message}`, line);
        }
        parts.push({ e, spec: colon >= 0 ? raw.slice(colon + 1, j) : "", conv: bang >= 0 ? raw[bang + 1] : "" });
        i = j + 1;
      } else {
        lit += c;
        i++;
      }
    }
    if (lit) parts.push(unescape(lit));
    return parts;
  }

  return program();
}

export function parseExpression(src) {
  const body = parse(src.trim());
  if (body.length !== 1 || body[0].k !== "expr") throw new PyError("SyntaxError", "expected an expression", 1);
  return body[0].e;
}

function collectLocals(body, set) {
  const addTarget = (t) => {
    if (t.k === "name") set.add(t.id);
    else if (t.k === "tuple" || t.k === "list") t.items.forEach(addTarget);
  };
  for (const s of body) {
    if (s.k === "assign") s.targets.forEach(addTarget);
    else if (s.k === "aug") addTarget(s.target);
    else if (s.k === "for") {
      addTarget(s.target);
      collectLocals(s.body, set);
    } else if (s.k === "while") collectLocals(s.body, set);
    else if (s.k === "if") {
      s.tests.forEach((t) => collectLocals(t.body, set));
      if (s.orelse) collectLocals(s.orelse, set);
    } else if (s.k === "def") set.add(s.name);
    else if (s.k === "import") s.names.forEach((nm) => set.add(nm));
    else if (s.k === "from") s.names.forEach((nm) => set.add(nm));
  }
}

function lastLine(body) {
  let l = 0;
  for (const s of body) {
    l = Math.max(l, s.line);
    if (s.body) l = Math.max(l, lastLine(s.body));
    if (s.tests) for (const t of s.tests) l = Math.max(l, lastLine(t.body));
    if (s.orelse) l = Math.max(l, lastLine(s.orelse));
  }
  return l;
}

// ------------------------------------------------------------ values

// int → BigInt, float → number, bool → boolean, None → null, str →
// string. Everything else is an object with a kind; the mutable and
// shareable ones (list, dict, tuple, function) get a heap id.

const isInt = (v) => typeof v === "bigint" || typeof v === "boolean";
const isNum = (v) => isInt(v) || typeof v === "number";
const toBig = (v) => (typeof v === "boolean" ? (v ? 1n : 0n) : v);
const toF = (v) => (typeof v === "number" ? v : Number(toBig(v)));

export function typeName(v) {
  if (v === null) return "NoneType";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "bigint") return "int";
  if (typeof v === "number") return "float";
  if (typeof v === "string") return "str";
  switch (v.kind) {
    case "builtin": return "builtin_function_or_method";
    case "method": return "builtin_function_or_method";
    case "view": return "dict_" + v.which;
    case "iter": return v.name;
    default: return v.kind;
  }
}

function newObj(kind, props) {
  return { kind, id: CUR ? CUR.nextId++ : 0, ...props };
}
const newList = (items) => newObj("list", { items });
const newTuple = (items) => newObj("tuple", { items });
const newDict = () => newObj("dict", { map: new Map() });

export function floatRepr(x) {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const ax = Math.abs(x);
  if (ax >= 1e16 || ax < 1e-4) {
    const [m, e] = x.toExponential().split("e");
    const sign = e[0];
    const digits = e.slice(1).padStart(2, "0");
    return `${m}e${sign}${digits}`;
  }
  const s = String(x);
  return s.includes(".") ? s : s + ".0";
}

function strRepr(s) {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = q;
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\t") out += "\\t";
    else if (c === "\r") out += "\\r";
    else if (c === q) out += "\\" + q;
    else out += c;
  }
  return out + q;
}

export function repr(v, seen = new Set()) {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return floatRepr(v);
  if (typeof v === "string") return strRepr(v);
  switch (v.kind) {
    case "list":
    case "tuple": {
      if (seen.has(v)) return v.kind === "list" ? "[...]" : "(...)";
      seen.add(v);
      const inner = v.items.map((x) => repr(x, seen)).join(", ");
      seen.delete(v);
      if (v.kind === "list") return `[${inner}]`;
      return v.items.length === 1 ? `(${inner},)` : `(${inner})`;
    }
    case "dict": {
      if (seen.has(v)) return "{...}";
      seen.add(v);
      const inner = [...v.map.values()].map(([k, x]) => `${repr(k, seen)}: ${repr(x, seen)}`).join(", ");
      seen.delete(v);
      return `{${inner}}`;
    }
    case "function": return `<function ${v.name}>`;
    case "builtin": return `<built-in function ${v.name}>`;
    case "method": return `<built-in method ${v.name} of ${typeName(v.self)} object>`;
    case "type": return `<class '${v.name}'>`;
    case "module": return `<module '${v.name}'>`;
    case "range": return v.step === 1n ? `range(${v.start}, ${v.stop})` : `range(${v.start}, ${v.stop}, ${v.step})`;
    case "view": {
      const items = viewItems(v);
      return `dict_${v.which}([${items.map((x) => repr(x, seen)).join(", ")}])`;
    }
    case "iter": return `<${v.name} object>`;
  }
  return "<object>";
}

export function str(v) {
  return typeof v === "string" ? v : repr(v);
}

export function truthy(v) {
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === "bigint") return v !== 0n;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (v.kind === "list" || v.kind === "tuple") return v.items.length > 0;
  if (v.kind === "dict") return v.map.size > 0;
  if (v.kind === "range") return rangeLen(v) > 0n;
  if (v.kind === "view") return v.dict.map.size > 0;
  return true;
}

function hkey(v) {
  if (v === null) return "N";
  if (typeof v === "boolean") return "i" + (v ? 1 : 0);
  if (typeof v === "bigint") return "i" + v;
  if (typeof v === "number") return Number.isInteger(v) ? "i" + BigInt(v) : "f" + v;
  if (typeof v === "string") return "s" + v;
  if (v.kind === "tuple") return "t(" + v.items.map(hkey).join(",") + ")";
  if (v.kind === "function" || v.kind === "type" || v.kind === "builtin" || v.kind === "module") return "o" + v.name + v.id;
  raise("TypeError", `unhashable type: '${typeName(v)}'`);
}

function dictGet(d, k) {
  const e = d.map.get(hkey(k));
  return e ? e[1] : undefined;
}
function dictSet(d, k, v) {
  const h = hkey(k);
  const e = d.map.get(h);
  if (e) e[1] = v;
  else d.map.set(h, [k, v]);
}

export function pyEq(a, b) {
  if (isNum(a) && isNum(b)) {
    if (typeof a === "number" || typeof b === "number") return toF(a) === toF(b) || (isInt(a) || isInt(b) ? toBig(isInt(a) ? a : b) == (isInt(a) ? b : a) : false);
    return toBig(a) === toBig(b);
  }
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (a === b) return true;
  if ((a.kind === "list" || a.kind === "tuple") && a.kind === b.kind) {
    return a.items.length === b.items.length && a.items.every((x, i) => pyEq(x, b.items[i]));
  }
  if (a.kind === "dict" && b.kind === "dict") {
    if (a.map.size !== b.map.size) return false;
    for (const [h, [, v]] of a.map) {
      const e = b.map.get(h);
      if (!e || !pyEq(v, e[1])) return false;
    }
    return true;
  }
  if (a.kind === "range" && b.kind === "range") return a.start === b.start && a.stop === b.stop && a.step === b.step;
  return false;
}

function pyLess(a, b, op = "<") {
  if (isNum(a) && isNum(b)) {
    if (isInt(a) && isInt(b)) return toBig(a) < toBig(b);
    return toF(a) < toF(b);
  }
  if (typeof a === "string" && typeof b === "string") return a < b;
  if (a && b && typeof a === "object" && typeof b === "object" && a.kind === b.kind && (a.kind === "list" || a.kind === "tuple")) {
    const n = Math.min(a.items.length, b.items.length);
    for (let i = 0; i < n; i++) {
      if (!pyEq(a.items[i], b.items[i])) return pyLess(a.items[i], b.items[i], op);
    }
    return a.items.length < b.items.length;
  }
  raise("TypeError", `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
}

function compare(op, a, b) {
  switch (op) {
    case "==": return pyEq(a, b);
    case "!=": return !pyEq(a, b);
    case "<": return pyLess(a, b, "<");
    case ">": return pyLess(b, a, ">");
    case "<=": return pyLess(a, b, "<=") || pyEq(a, b);
    case ">=": return pyLess(b, a, ">=") || pyEq(a, b);
    case "is": return a === b || (a === null && b === null);
    case "is not": return !(a === b || (a === null && b === null));
    case "in": return contains(b, a);
    case "not in": return !contains(b, a);
  }
}

function contains(c, x) {
  if (typeof c === "string") {
    if (typeof x !== "string") raise("TypeError", `'in <string>' requires string as left operand, not ${typeName(x)}`);
    return c.includes(x);
  }
  if (c && typeof c === "object") {
    if (c.kind === "list" || c.kind === "tuple") return c.items.some((y) => pyEq(y, x));
    if (c.kind === "dict") return c.map.has(hkey(x));
    if (c.kind === "view") return viewItems(c).some((y) => pyEq(y, x));
    if (c.kind === "range") {
      if (!isNum(x) || (typeof x === "number" && !Number.isInteger(x))) return false;
      const k = toBig(typeof x === "number" ? BigInt(x) : x);
      const { start, stop, step } = c;
      if (step > 0n ? k < start || k >= stop : k > start || k <= stop) return false;
      return (k - start) % step === 0n;
    }
    if (c.kind === "iter") return c.items.some((y) => pyEq(y, x));
  }
  raise("TypeError", `argument of type '${typeName(c)}' is not iterable`);
}

const floorDiv = (a, b) => {
  let q = a / b;
  if (a % b !== 0n && a < 0n !== b < 0n) q -= 1n;
  return q;
};
const pyMod = (a, b) => {
  let r = a % b;
  if (r !== 0n && r < 0n !== b < 0n) r += b;
  return r;
};

export function binop(op, a, b) {
  if (isNum(a) && isNum(b)) {
    if (isInt(a) && isInt(b)) {
      const x = toBig(a);
      const y = toBig(b);
      switch (op) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/":
          if (y === 0n) raise("ZeroDivisionError", "division by zero");
          return Number(x) / Number(y);
        case "//":
          if (y === 0n) raise("ZeroDivisionError", "integer division or modulo by zero");
          return floorDiv(x, y);
        case "%":
          if (y === 0n) raise("ZeroDivisionError", "integer modulo by zero");
          return pyMod(x, y);
        case "**":
          if (y < 0n) {
            if (x === 0n) raise("ZeroDivisionError", "0.0 cannot be raised to a negative power");
            return Math.pow(Number(x), Number(y));
          }
          if (y > 20000n) raise("OverflowError", "exponent too large for this tracer");
          return x ** y;
      }
    } else {
      const x = toF(a);
      const y = toF(b);
      switch (op) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/":
          if (y === 0) raise("ZeroDivisionError", "float division by zero");
          return x / y;
        case "//":
          if (y === 0) raise("ZeroDivisionError", "float floor division by zero");
          return Math.floor(x / y);
        case "%": {
          if (y === 0) raise("ZeroDivisionError", "float modulo");
          const r = x - y * Math.floor(x / y);
          return r;
        }
        case "**": {
          if (x === 0 && y < 0) raise("ZeroDivisionError", "0.0 cannot be raised to a negative power");
          const r = Math.pow(x, y);
          if (Number.isNaN(r) && x < 0) raise("ValueError", "a negative number to a fractional power gives a complex number, which this tracer doesn't support");
          if (!Number.isFinite(r) && Number.isFinite(x) && Number.isFinite(y)) raise("OverflowError", "(34, 'Numerical result out of range')");
          return r;
        }
      }
    }
  }
  if (typeof a === "string" && typeof b === "string" && op === "+") return a + b;
  if (op === "*" && ((typeof a === "string" && isInt(b)) || (isInt(a) && typeof b === "string"))) {
    const [s, k] = typeof a === "string" ? [a, toBig(b)] : [b, toBig(a)];
    if (k * BigInt(s.length) > 1000000n) raise("MemoryError", "that string would be too long for this tracer");
    return k > 0n ? s.repeat(Number(k)) : "";
  }
  const seq = (v) => v && typeof v === "object" && (v.kind === "list" || v.kind === "tuple");
  if (op === "+" && seq(a) && seq(b) && a.kind === b.kind) {
    return a.kind === "list" ? newList([...a.items, ...b.items]) : newTuple([...a.items, ...b.items]);
  }
  if (op === "*" && ((seq(a) && isInt(b)) || (isInt(a) && seq(b)))) {
    const [s, k] = seq(a) ? [a, Number(toBig(b))] : [b, Number(toBig(a))];
    if (k * s.items.length > 100000) raise("MemoryError", "that list would be too long for this tracer");
    const items = [];
    for (let i = 0; i < k; i++) items.push(...s.items);
    return s.kind === "list" ? newList(items) : newTuple(items);
  }
  if (op === "+" && typeof a === "string") raise("TypeError", `can only concatenate str (not "${typeName(b)}") to str`);
  if (op === "+" && a && a.kind === "list") raise("TypeError", `can only concatenate list (not "${typeName(b)}") to list`);
  raise("TypeError", `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
}

function rangeLen(r) {
  const { start, stop, step } = r;
  if (step > 0n) return start < stop ? (stop - start + step - 1n) / step : 0n;
  return start > stop ? (start - stop - step - 1n) / -step : 0n;
}

function viewItems(v) {
  const entries = [...v.dict.map.values()];
  if (v.which === "keys") return entries.map(([k]) => k);
  if (v.which === "values") return entries.map(([, x]) => x);
  return entries.map(([k, x]) => newTuple([k, x]));
}

// A JS iterator over a Python iterable. Lists are walked live, by index,
// as CPython does: appending inside the loop extends the loop.
export function iterOf(v) {
  if (typeof v === "string") return [...v][Symbol.iterator]();
  if (v && typeof v === "object") {
    if (v.kind === "list") {
      let i = 0;
      return { next: () => (i < v.items.length ? { value: v.items[i++], done: false } : { value: undefined, done: true }) };
    }
    if (v.kind === "tuple" || v.kind === "iter") return v.items[Symbol.iterator]();
    if (v.kind === "dict") return [...v.map.values()].map(([k]) => k)[Symbol.iterator]();
    if (v.kind === "view") return viewItems(v)[Symbol.iterator]();
    if (v.kind === "range") {
      let k = v.start;
      const { stop, step } = v;
      return {
        next: () => {
          if (step > 0n ? k < stop : k > stop) {
            const out = k;
            k += step;
            return { value: out, done: false };
          }
          return { value: undefined, done: true };
        },
      };
    }
  }
  raise("TypeError", `'${typeName(v)}' object is not iterable`);
}
const toArray = (v) => {
  const out = [];
  const it = iterOf(v);
  for (let r = it.next(); !r.done; r = it.next()) {
    out.push(r.value);
    if (out.length > 200000) raise("MemoryError", "too many items for this tracer");
  }
  return out;
};

function seqIndex(v, idx, len) {
  if (!isInt(idx)) {
    if (typeof idx === "number") raise("TypeError", `${typeName(v)} indices must be integers or slices, not float`);
    raise("TypeError", `${typeName(v)} indices must be integers or slices, not ${typeName(idx)}`);
  }
  let i = Number(toBig(idx));
  if (i < 0) i += len;
  if (i < 0 || i >= len) raise("IndexError", `${typeName(v) === "str" ? "string" : typeName(v)} index out of range`);
  return i;
}

// Python's slice.indices: clamps start/stop, defaults depend on the step's sign.
export function sliceIndices(len, lo, hi, step) {
  const st = step === null ? 1 : Number(toBig(step));
  if (st === 0) raise("ValueError", "slice step cannot be zero");
  const norm = (v, def, isStart) => {
    if (v === null) return def;
    if (!isInt(v)) raise("TypeError", "slice indices must be integers or None");
    let i = Number(toBig(v));
    if (i < 0) i += len;
    if (st > 0) return Math.min(Math.max(i, 0), len);
    return Math.min(Math.max(i, -1), len - 1);
  };
  const start = norm(lo, st > 0 ? 0 : len - 1, true);
  const stop = norm(hi, st > 0 ? len : -1, false);
  const idx = [];
  if (st > 0) for (let i = start; i < stop; i += st) idx.push(i);
  else for (let i = start; i > stop; i += st) idx.push(i);
  return { start, stop, step: st, idx };
}

function getItem(obj, index) {
  if (index && index.kind === "sliceval") {
    const seq = typeof obj === "string" ? [...obj] : obj && (obj.kind === "list" || obj.kind === "tuple") ? obj.items : null;
    if (!seq) raise("TypeError", `'${typeName(obj)}' object is not subscriptable`);
    const { idx } = sliceIndices(seq.length, index.lo, index.hi, index.step);
    const items = idx.map((i) => seq[i]);
    if (typeof obj === "string") return items.join("");
    return obj.kind === "list" ? newList(items) : newTuple(items);
  }
  if (typeof obj === "string") {
    const cs = [...obj];
    return cs[seqIndex(obj, index, cs.length)];
  }
  if (obj && typeof obj === "object") {
    if (obj.kind === "list" || obj.kind === "tuple") return obj.items[seqIndex(obj, index, obj.items.length)];
    if (obj.kind === "dict") {
      const v = dictGet(obj, index);
      if (v === undefined) raise("KeyError", repr(index));
      return v;
    }
    if (obj.kind === "range") {
      const n = Number(rangeLen(obj));
      return obj.start + BigInt(seqIndex(obj, index, n)) * obj.step;
    }
  }
  raise("TypeError", `'${typeName(obj)}' object is not subscriptable`);
}

function setItem(obj, index, v) {
  if (obj && obj.kind === "list") {
    if (index && index.kind === "sliceval") {
      if (index.step !== null && Number(toBig(index.step)) !== 1) raise("ValueError", "extended slice assignment isn't part of this tracer's subset");
      const { start, stop } = sliceIndices(obj.items.length, index.lo, index.hi, null);
      obj.items.splice(start, Math.max(0, stop - start), ...toArray(v));
      return;
    }
    obj.items[seqIndex(obj, index, obj.items.length)] = v;
    return;
  }
  if (obj && obj.kind === "dict") return dictSet(obj, index, v);
  raise("TypeError", `'${typeName(obj)}' object does not support item assignment`);
}

// ------------------------------------------------------------ builtins

const kw = (kwargs, name, def) => (kwargs && kwargs.has(name) ? kwargs.get(name) : def);
function noKw(name, kwargs) {
  if (kwargs && kwargs.size) raise("TypeError", `${name}() got an unexpected keyword argument '${[...kwargs.keys()][0]}'`);
}
function arity(name, args, min, max = min) {
  if (args.length < min || args.length > max) {
    if (min === max) raise("TypeError", `${name}() takes exactly ${min} argument${min === 1 ? "" : "s"} (${args.length} given)`);
    raise("TypeError", `${name}() takes ${args.length < min ? "at least " + min : "at most " + max} arguments (${args.length} given)`);
  }
}
const builtin = (name, fn) => ({ kind: "builtin", name, fn, id: 0 });

function makeType(name, call) {
  return { kind: "type", name, call, id: 0 };
}

function toInt(v) {
  if (isInt(v)) return toBig(v);
  if (typeof v === "number") {
    if (Number.isNaN(v)) raise("ValueError", "cannot convert float NaN to integer");
    if (!Number.isFinite(v)) raise("OverflowError", "cannot convert float infinity to integer");
    return BigInt(Math.trunc(v));
  }
  if (typeof v === "string") {
    const s = v.trim().replace(/_/g, "");
    if (!/^[+-]?\d+$/.test(s)) raise("ValueError", `invalid literal for int() with base 10: ${strRepr(v)}`);
    return BigInt(s);
  }
  raise("TypeError", `int() argument must be a string or a number, not '${typeName(v)}'`);
}
function toFloat(v) {
  if (isNum(v)) return toF(v);
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "inf" || s === "+inf" || s === "infinity") return Infinity;
    if (s === "-inf" || s === "-infinity") return -Infinity;
    if (s === "nan") return NaN;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) raise("ValueError", `could not convert string to float: ${strRepr(v)}`);
    return Number(s);
  }
  raise("TypeError", `float() argument must be a string or a real number, not '${typeName(v)}'`);
}

function roundHalfEven(x) {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) return 2 * Math.round(x / 2);
  return r;
}

// Exact float sum (Shewchuk's algorithm, as in CPython's math.fsum).
function fsum(xs) {
  const partials = [];
  for (let x of xs) {
    let i = 0;
    for (let y of partials) {
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo) partials[i++] = lo;
      x = hi;
    }
    partials.length = i;
    partials.push(x);
  }
  let hi = 0;
  let n = partials.length;
  if (n > 0) {
    hi = partials[--n];
    let lo = 0;
    while (n > 0) {
      const x = hi;
      const y = partials[--n];
      hi = x + y;
      const yr = hi - x;
      lo = y - yr;
      if (lo) break;
    }
    if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
      const y = lo * 2;
      const x = hi + y;
      const yr = x - hi;
      if (y === yr) hi = x;
    }
  }
  return hi;
}

function deepcopy(v, memo = new Map()) {
  if (v === null || typeof v !== "object") return v;
  if (memo.has(v)) return memo.get(v);
  if (v.kind === "list") {
    const c = newList([]);
    memo.set(v, c);
    c.items = v.items.map((x) => deepcopy(x, memo));
    return c;
  }
  if (v.kind === "tuple") {
    const items = v.items.map((x) => deepcopy(x, memo));
    if (items.every((x, i) => x === v.items[i])) return v;
    return newTuple(items);
  }
  if (v.kind === "dict") {
    const c = newDict();
    memo.set(v, c);
    for (const [h, [k, x]] of v.map) c.map.set(h, [k, deepcopy(x, memo)]);
    return c;
  }
  return v;
}
function shallowcopy(v) {
  if (v && v.kind === "list") return newList([...v.items]);
  if (v && v.kind === "dict") {
    const c = newDict();
    for (const [h, [k, x]] of v.map) c.map.set(h, [k, x]);
    return c;
  }
  return v;
}

function minmax(name, args, kwargs, better) {
  noKw(name, kwargs);
  const items = args.length === 1 ? toArray(args[0]) : args;
  if (!items.length) raise("ValueError", `${name}() arg is an empty sequence`);
  let best = items[0];
  for (const x of items.slice(1)) if (better(x, best)) best = x;
  return best;
}

function formatSpec(v, spec) {
  if (!spec) return str(v);
  const m = spec.match(/^(?:(.)?([<>^]))?([+\- ])?(0)?(\d+)?(,|_)?(?:\.(\d+))?([bdeEfFgGosx%])?$/);
  if (!m) raise("ValueError", `invalid format specifier '${spec}' for this tracer`);
  let [, fill, align, sign, zero, width, group, prec, type] = m;
  let s;
  const p = prec === undefined ? undefined : Number(prec);
  if (type === "d") {
    if (!isInt(v)) raise("ValueError", `Unknown format code 'd' for object of type '${typeName(v)}'`);
    s = toBig(v).toString();
  } else if (type === "f" || type === "F") {
    if (!isNum(v)) raise("ValueError", `Unknown format code 'f' for object of type '${typeName(v)}'`);
    s = toF(v).toFixed(p ?? 6);
  } else if (type === "e" || type === "E") {
    const [mm, e] = toF(v).toExponential(p ?? 6).split("e");
    s = `${mm}e${e[0]}${e.slice(1).padStart(2, "0")}`;
    if (type === "E") s = s.toUpperCase();
  } else if (type === "%") {
    s = (toF(v) * 100).toFixed(p ?? 6) + "%";
  } else if (type === "g" || type === "G" || (type === undefined && p !== undefined && isNum(v))) {
    const x = toF(v);
    s = String(Number(x.toPrecision(p || 1)));
    if (Math.abs(x) >= 1e16 || (x !== 0 && Math.abs(x) < 1e-4)) s = floatRepr(Number(x.toPrecision(p || 1)));
  } else if (type === "x") {
    s = toBig(v).toString(16);
  } else if (type === "b") {
    s = toBig(v).toString(2);
  } else if (type === "o") {
    s = toBig(v).toString(8);
  } else {
    s = str(v);
    if (p !== undefined && typeof v === "string") s = s.slice(0, p);
  }
  if (group && /^-?\d/.test(s)) {
    const neg = s.startsWith("-");
    const body = neg ? s.slice(1) : s;
    const [ip, fp] = body.split(".");
    const g = ip.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    s = (neg ? "-" : "") + g + (fp !== undefined ? "." + fp : "");
  }
  if (sign === "+" && isNum(v) && !s.startsWith("-")) s = "+" + s;
  if (sign === " " && isNum(v) && !s.startsWith("-")) s = " " + s;
  const w = width ? Number(width) : 0;
  if (s.length < w) {
    const numeric = isNum(v) && typeof v !== "string";
    if (zero && !align) {
      const neg = s.startsWith("-") || s.startsWith("+");
      s = (neg ? s[0] : "") + s.slice(neg ? 1 : 0).padStart(w - (neg ? 1 : 0), "0");
    } else {
      const f = fill ?? " ";
      const a = align ?? (numeric ? ">" : "<");
      const pad = w - s.length;
      if (a === "<") s = s + f.repeat(pad);
      else if (a === ">") s = f.repeat(pad) + s;
      else s = f.repeat(Math.floor(pad / 2)) + s + f.repeat(Math.ceil(pad / 2));
    }
  }
  return s;
}

function makeBuiltins() {
  const B = new Map();
  const def = (name, fn) => B.set(name, builtin(name, fn));
  def("print", (args, kwargs) => {
    const sep = kw(kwargs, "sep", " ");
    const end = kw(kwargs, "end", "\n");
    CUR.write(args.map(str).join(sep === null ? " " : str(sep)) + (end === null ? "\n" : str(end)));
    return null;
  });
  def("len", (args, kwargs) => {
    noKw("len", kwargs);
    arity("len", args, 1);
    const v = args[0];
    if (typeof v === "string") return BigInt([...v].length);
    if (v && (v.kind === "list" || v.kind === "tuple")) return BigInt(v.items.length);
    if (v && v.kind === "dict") return BigInt(v.map.size);
    if (v && v.kind === "range") return rangeLen(v);
    if (v && v.kind === "view") return BigInt(v.dict.map.size);
    raise("TypeError", `object of type '${typeName(v)}' has no len()`);
  });
  def("range", (args, kwargs) => {
    noKw("range", kwargs);
    arity("range", args, 1, 3);
    for (const a of args) if (!isInt(a)) raise("TypeError", `'${typeName(a)}' object cannot be interpreted as an integer`);
    const [a, b, c] = args.map(toBig);
    if (args.length === 3 && c === 0n) raise("ValueError", "range() arg 3 must not be zero");
    return args.length === 1 ? { kind: "range", start: 0n, stop: a, step: 1n } : { kind: "range", start: a, stop: b, step: args.length === 3 ? c : 1n };
  });
  def("abs", (args) => {
    arity("abs", args, 1);
    const v = args[0];
    if (isInt(v)) {
      const x = toBig(v);
      return x < 0n ? -x : x;
    }
    if (typeof v === "number") return Math.abs(v);
    raise("TypeError", `bad operand type for abs(): '${typeName(v)}'`);
  });
  def("min", (args, kwargs) => minmax("min", args, kwargs, (a, b) => pyLess(a, b)));
  def("max", (args, kwargs) => minmax("max", args, kwargs, (a, b) => pyLess(b, a)));
  def("sum", (args, kwargs) => {
    arity("sum", args, 1, 2);
    let acc = args.length > 1 ? args[1] : kw(kwargs, "start", 0n);
    if (typeof acc === "string") raise("TypeError", "sum() can't sum strings [use ''.join(seq) instead]");
    for (const x of toArray(args[0])) {
      if (typeof x === "string") raise("TypeError", `unsupported operand type(s) for +: '${typeName(acc)}' and 'str'`);
      acc = binop("+", acc, x);
    }
    return acc;
  });
  def("round", (args) => {
    arity("round", args, 1, 2);
    const [v, nd] = args;
    if (!isNum(v)) raise("TypeError", `type ${typeName(v)} doesn't define __round__ method`);
    if (nd === undefined || nd === null) return isInt(v) ? toBig(v) : BigInt(roundHalfEven(toF(v)));
    const d = Number(toBig(nd));
    if (isInt(v)) return toBig(v);
    if (d >= 0) return Number(toF(v).toFixed(Math.min(d, 100)));
    const f = 10 ** -d;
    return roundHalfEven(toF(v) / f) * f;
  });
  def("sorted", (args, kwargs) => {
    arity("sorted", args, 1);
    const items = toArray(args[0]);
    const out = mergeSort(items, (a, b) => pyLess(a, b));
    if (truthy(kw(kwargs, "reverse", false))) out.reverse();
    return newList(out);
  });
  def("reversed", (args) => {
    arity("reversed", args, 1);
    return { kind: "iter", name: "list_reverseiterator", items: toArray(args[0]).reverse() };
  });
  def("enumerate", (args, kwargs) => {
    arity("enumerate", args, 1, 2);
    let k = toBig(args[1] ?? kw(kwargs, "start", 0n));
    return { kind: "iter", name: "enumerate", items: toArray(args[0]).map((x) => newTuple([k++, x])) };
  });
  def("zip", (args) => {
    const arrs = args.map(toArray);
    const n = arrs.length ? Math.min(...arrs.map((a) => a.length)) : 0;
    const items = [];
    for (let i = 0; i < n; i++) items.push(newTuple(arrs.map((a) => a[i])));
    return { kind: "iter", name: "zip", items };
  });
  def("type", (args) => {
    arity("type", args, 1);
    return TYPES[typeName(args[0])] ?? makeType(typeName(args[0]));
  });
  def("isinstance", (args) => {
    arity("isinstance", args, 2);
    const [v, t] = args;
    const ts = t && t.kind === "tuple" ? t.items : [t];
    return ts.some((x) => x && x.kind === "type" && (x.name === typeName(v) || (x.name === "int" && typeof v === "boolean")));
  });
  def("repr", (args) => {
    arity("repr", args, 1);
    return repr(args[0]);
  });
  def("input", () => raise("RuntimeError", "input() isn't available in the tracer: set the variable directly"));
  def("id", (args) => BigInt(args[0] && typeof args[0] === "object" ? 4300000000 + args[0].id * 64 : 9000));
  def("any", (args) => toArray(args[0]).some(truthy));
  def("all", (args) => toArray(args[0]).every(truthy));
  def("chr", (args) => String.fromCodePoint(Number(toBig(args[0]))));
  def("ord", (args) => BigInt(args[0].codePointAt(0)));

  const TYPES = {
    int: makeType("int", (args) => (args.length ? toInt(args[0]) : 0n)),
    float: makeType("float", (args) => (args.length ? toFloat(args[0]) : 0)),
    str: makeType("str", (args) => (args.length ? str(args[0]) : "")),
    bool: makeType("bool", (args) => (args.length ? truthy(args[0]) : false)),
    list: makeType("list", (args) => newList(args.length ? toArray(args[0]) : [])),
    tuple: makeType("tuple", (args) => newTuple(args.length ? toArray(args[0]) : [])),
    dict: makeType("dict", (args, kwargs) => {
      const d = newDict();
      if (args.length) {
        const src = args[0];
        if (src && src.kind === "dict") for (const [h, e] of src.map) d.map.set(h, [e[0], e[1]]);
        else for (const pair of toArray(src)) {
          const kv = toArray(pair);
          dictSet(d, kv[0], kv[1]);
        }
      }
      if (kwargs) for (const [k, v] of kwargs) dictSet(d, k, v);
      return d;
    }),
    NoneType: makeType("NoneType"),
    function: makeType("function"),
    range: makeType("range"),
  };
  for (const [k, t] of Object.entries(TYPES)) if (["int", "float", "str", "bool", "list", "tuple", "dict"].includes(k)) B.set(k, t);
  return B;
}

function mergeSort(a, less) {
  if (a.length < 2) return [...a];
  const mid = a.length >> 1;
  const l = mergeSort(a.slice(0, mid), less);
  const r = mergeSort(a.slice(mid), less);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < l.length && j < r.length) out.push(less(r[j], l[i]) ? r[j++] : l[i++]);
  return out.concat(l.slice(i), r.slice(j));
}

function makeModules() {
  const mod = (name, entries) => ({ kind: "module", name, id: 0, attrs: new Map(entries) });
  const f1 = (name, fn) => [name, builtin("math." + name, (args) => {
    arity(name, args, 1);
    if (!isNum(args[0])) raise("TypeError", `must be real number, not ${typeName(args[0])}`);
    return fn(toF(args[0]));
  })];
  const math = mod("math", [
    ["pi", Math.PI],
    ["e", Math.E],
    ["tau", 2 * Math.PI],
    ["inf", Infinity],
    ["nan", NaN],
    f1("sqrt", (x) => {
      if (x < 0) raise("ValueError", "math domain error");
      return Math.sqrt(x);
    }),
    f1("exp", Math.exp),
    f1("log10", (x) => {
      if (x <= 0) raise("ValueError", "math domain error");
      return Math.log10(x);
    }),
    f1("log2", (x) => {
      if (x <= 0) raise("ValueError", "math domain error");
      return Math.log2(x);
    }),
    ["log", builtin("math.log", (args) => {
      arity("log", args, 1, 2);
      const x = toF(args[0]);
      if (x <= 0) raise("ValueError", "math domain error");
      return args.length > 1 ? Math.log(x) / Math.log(toF(args[1])) : Math.log(x);
    })],
    f1("sin", Math.sin),
    f1("cos", Math.cos),
    f1("tan", Math.tan),
    f1("atan", Math.atan),
    f1("fabs", Math.abs),
    ["floor", builtin("math.floor", (args) => (isInt(args[0]) ? toBig(args[0]) : BigInt(Math.floor(toF(args[0])))))],
    ["ceil", builtin("math.ceil", (args) => (isInt(args[0]) ? toBig(args[0]) : BigInt(Math.ceil(toF(args[0])))))],
    ["isclose", builtin("math.isclose", (args, kwargs) => {
      arity("isclose", args, 2);
      const a = toF(args[0]);
      const b = toF(args[1]);
      const rel = toF(kw(kwargs, "rel_tol", 1e-9));
      const abs = toF(kw(kwargs, "abs_tol", 0));
      if (a === b) return true;
      return Math.abs(a - b) <= Math.max(rel * Math.max(Math.abs(a), Math.abs(b)), abs);
    })],
    ["fsum", builtin("math.fsum", (args) => fsum(toArray(args[0]).map(toF)))],
    ["factorial", builtin("math.factorial", (args) => {
      let r = 1n;
      for (let k = 2n; k <= toBig(args[0]); k++) r *= k;
      return r;
    })],
    ["gcd", builtin("math.gcd", (args) => {
      let [a, b] = args.map((x) => (toBig(x) < 0n ? -toBig(x) : toBig(x)));
      while (b) [a, b] = [b, a % b];
      return a;
    })],
  ]);
  const copy = mod("copy", [
    ["copy", builtin("copy.copy", (args) => shallowcopy(args[0]))],
    ["deepcopy", builtin("copy.deepcopy", (args) => deepcopy(args[0]))],
  ]);
  return { math, copy };
}

// Methods of the built-in types; each takes (self, args, kwargs).
const METHODS = {
  list: {
    append(self, args) {
      arity("append", args, 1);
      self.items.push(args[0]);
      return null;
    },
    extend(self, args) {
      arity("extend", args, 1);
      self.items.push(...toArray(args[0]));
      return null;
    },
    insert(self, args) {
      arity("insert", args, 2);
      let i = Number(toBig(args[0]));
      if (i < 0) i = Math.max(0, i + self.items.length);
      self.items.splice(Math.min(i, self.items.length), 0, args[1]);
      return null;
    },
    pop(self, args) {
      if (!self.items.length) raise("IndexError", "pop from empty list");
      const i = args.length ? seqIndex(self, args[0], self.items.length) : self.items.length - 1;
      return self.items.splice(i, 1)[0];
    },
    remove(self, args) {
      const i = self.items.findIndex((x) => pyEq(x, args[0]));
      if (i < 0) raise("ValueError", "list.remove(x): x not in list");
      self.items.splice(i, 1);
      return null;
    },
    index(self, args) {
      const i = self.items.findIndex((x) => pyEq(x, args[0]));
      if (i < 0) raise("ValueError", `${repr(args[0])} is not in list`);
      return BigInt(i);
    },
    count: (self, args) => BigInt(self.items.filter((x) => pyEq(x, args[0])).length),
    copy: (self) => newList([...self.items]),
    clear(self) {
      self.items.length = 0;
      return null;
    },
    reverse(self) {
      self.items.reverse();
      return null;
    },
    sort(self, args, kwargs) {
      const out = mergeSort(self.items, (a, b) => pyLess(a, b));
      if (truthy(kw(kwargs, "reverse", false))) out.reverse();
      self.items.splice(0, self.items.length, ...out);
      return null;
    },
  },
  tuple: {
    count: (self, args) => BigInt(self.items.filter((x) => pyEq(x, args[0])).length),
    index(self, args) {
      const i = self.items.findIndex((x) => pyEq(x, args[0]));
      if (i < 0) raise("ValueError", "tuple.index(x): x not in tuple");
      return BigInt(i);
    },
  },
  dict: {
    get(self, args) {
      arity("get", args, 1, 2);
      const v = dictGet(self, args[0]);
      return v === undefined ? (args.length > 1 ? args[1] : null) : v;
    },
    keys: (self) => ({ kind: "view", which: "keys", dict: self }),
    values: (self) => ({ kind: "view", which: "values", dict: self }),
    items: (self) => ({ kind: "view", which: "items", dict: self }),
    setdefault(self, args) {
      const v = dictGet(self, args[0]);
      if (v !== undefined) return v;
      const d = args.length > 1 ? args[1] : null;
      dictSet(self, args[0], d);
      return d;
    },
    pop(self, args) {
      const h = hkey(args[0]);
      const e = self.map.get(h);
      if (!e) {
        if (args.length > 1) return args[1];
        raise("KeyError", repr(args[0]));
      }
      self.map.delete(h);
      return e[1];
    },
    update(self, args) {
      const src = args[0];
      if (src && src.kind === "dict") for (const [h, e] of src.map) self.map.set(h, [e[0], e[1]]);
      return null;
    },
    copy: (self) => shallowcopy(self),
    clear(self) {
      self.map.clear();
      return null;
    },
  },
  str: {
    upper: (s) => s.toUpperCase(),
    lower: (s) => s.toLowerCase(),
    title: (s) => s.replace(/\p{L}+/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
    capitalize: (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s),
    strip: (s, args) => (args.length && args[0] !== null ? trimChars(s, args[0], 3) : s.trim()),
    lstrip: (s, args) => (args.length && args[0] !== null ? trimChars(s, args[0], 1) : s.trimStart()),
    rstrip: (s, args) => (args.length && args[0] !== null ? trimChars(s, args[0], 2) : s.trimEnd()),
    split(s, args, kwargs) {
      const sep = args.length ? args[0] : kw(kwargs, "sep", null);
      if (sep === null) return newList(s.split(/\s+/).filter(Boolean));
      if (sep === "") raise("ValueError", "empty separator");
      return newList(s.split(sep));
    },
    join(s, args) {
      const items = toArray(args[0]);
      const bad = items.findIndex((x) => typeof x !== "string");
      if (bad >= 0) raise("TypeError", `sequence item ${bad}: expected str instance, ${typeName(items[bad])} found`);
      return items.join(s);
    },
    replace: (s, args) => s.split(args[0]).join(args[1]),
    startswith: (s, args) => s.startsWith(args[0]),
    endswith: (s, args) => s.endsWith(args[0]),
    find: (s, args) => BigInt(s.indexOf(args[0])),
    count: (s, args) => BigInt(args[0] === "" ? s.length + 1 : s.split(args[0]).length - 1),
    isdigit: (s) => s.length > 0 && /^\d+$/.test(s),
    isalpha: (s) => s.length > 0 && /^\p{L}+$/u.test(s),
    isspace: (s) => s.length > 0 && /^\s+$/.test(s),
    isupper: (s) => /\p{Lu}/u.test(s) && s === s.toUpperCase(),
    islower: (s) => /\p{Ll}/u.test(s) && s === s.toLowerCase(),
    format(s, args) {
      let k = 0;
      return s.replace(/\{(\d*)(?::([^}]*))?\}/g, (_, idx, spec) => formatSpec(args[idx === "" ? k++ : Number(idx)], spec ?? ""));
    },
  },
};

function trimChars(s, chars, side) {
  let a = 0;
  let b = s.length;
  if (side & 1) while (a < b && chars.includes(s[a])) a++;
  if (side & 2) while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

function getAttr(obj, name) {
  if (obj && obj.kind === "module") {
    if (obj.attrs.has(name)) return obj.attrs.get(name);
    raise("AttributeError", `module '${obj.name}' has no attribute '${name}'`);
  }
  const t = typeName(obj);
  const table = METHODS[t];
  if (table && Object.hasOwn(table, name)) return { kind: "method", self: obj, name, fn: table[name], id: 0 };
  raise("AttributeError", `'${t}' object has no attribute '${name}'`);
}

// ------------------------------------------------------------ interpreter

class Frame {
  constructor(name, parent, fn, id) {
    this.name = name;
    this.parent = parent;
    this.fn = fn;
    this.id = id;
    this.vars = new Map();
    this.line = 0;
    this.ret = undefined;
  }
}

class Interp {
  constructor(opts) {
    this.nextId = 1;
    this.frameId = 0;
    this.line = 0;
    this.output = "";
    this.maxDepth = opts.maxDepth ?? 200;
    this.maxOutput = opts.maxOutput ?? 20000;
    this.builtins = makeBuiltins();
    this.modules = makeModules();
    this.global = new Frame("Global frame", null, null, this.frameId++);
    this.stack = [this.global];
  }
  write(s) {
    if (this.output.length + s.length > this.maxOutput) raise("RuntimeError", "too much output for this tracer");
    this.output += s;
  }
  lookup(f, name) {
    if (f.fn && f.fn.locals.has(name) && !f.vars.has(name)) {
      raise("UnboundLocalError", `cannot access local variable '${name}' where it is not associated with a value`);
    }
    for (let fr = f; fr; fr = fr.parent) if (fr.vars.has(name)) return fr.vars.get(name);
    if (this.builtins.has(name)) return this.builtins.get(name);
    raise("NameError", `name '${name}' is not defined`);
  }

  *block(stmts, f) {
    for (const s of stmts) {
      const r = yield* this.stmt(s, f);
      if (r) return r;
    }
    return null;
  }

  *at(f, line) {
    f.line = line;
    this.line = line;
    yield { ev: "line", line };
  }

  *stmt(s, f) {
    yield* this.at(f, s.line);
    switch (s.k) {
      case "expr":
        yield* this.eval(s.e, f);
        return null;
      case "assign": {
        const v = yield* this.eval(s.value, f);
        for (const t of s.targets) yield* this.assign(t, v, f);
        return null;
      }
      case "aug": {
        const t = s.target;
        let objv;
        let idx;
        let cur;
        if (t.k === "name") cur = this.lookup(f, t.id);
        else {
          objv = yield* this.eval(t.obj, f);
          idx = yield* this.index(t.index, f);
          cur = getItem(objv, idx);
        }
        const rhs = yield* this.eval(s.value, f);
        let nv;
        if (s.op === "+" && cur && cur.kind === "list") {
          // list += iterable extends the same list in place.
          cur.items.push(...toArray(rhs));
          nv = cur;
        } else nv = binop(s.op, cur, rhs);
        if (t.k === "name") f.vars.set(t.id, nv);
        else setItem(objv, idx, nv);
        return null;
      }
      case "pass":
        return null;
      case "break":
        return { k: "break" };
      case "continue":
        return { k: "continue" };
      case "return": {
        const v = s.e ? yield* this.eval(s.e, f) : null;
        return { k: "return", v };
      }
      case "assert": {
        const v = yield* this.eval(s.e, f);
        if (!truthy(v)) {
          const m = s.msg ? str(yield* this.eval(s.msg, f)) : "";
          raise("AssertionError", m);
        }
        return null;
      }
      case "import":
        for (const name of s.names) {
          if (!this.modules[name]) raise("ModuleNotFoundError", `No module named '${name}' (this tracer knows math and copy)`);
          f.vars.set(name, this.modules[name]);
        }
        return null;
      case "from": {
        const m = this.modules[s.mod];
        if (!m) raise("ModuleNotFoundError", `No module named '${s.mod}' (this tracer knows math and copy)`);
        for (const name of s.names) {
          if (!m.attrs.has(name)) raise("ImportError", `cannot import name '${name}' from '${s.mod}'`);
          f.vars.set(name, m.attrs.get(name));
        }
        return null;
      }
      case "def": {
        const defaults = [];
        for (const p of s.params) defaults.push(p.def ? yield* this.eval(p.def, f) : undefined);
        f.vars.set(s.name, newObj("function", { name: s.name, params: s.params, defaults, body: s.body, env: f, locals: s.locals, line: s.line, last: s.last }));
        return null;
      }
      case "if": {
        for (let i = 0; i < s.tests.length; i++) {
          const t = s.tests[i];
          if (i > 0) yield* this.at(f, t.line);
          if (truthy(yield* this.eval(t.cond, f))) return yield* this.block(t.body, f);
        }
        if (s.orelse) return yield* this.block(s.orelse, f);
        return null;
      }
      case "while": {
        for (;;) {
          if (!truthy(yield* this.eval(s.cond, f))) return null;
          const r = yield* this.block(s.body, f);
          if (r && r.k === "break") return null;
          if (r && r.k === "return") return r;
          yield* this.at(f, s.line);
        }
      }
      case "for": {
        const it = iterOf(yield* this.eval(s.iter, f));
        let first = true;
        for (;;) {
          if (!first) yield* this.at(f, s.line);
          first = false;
          const nx = it.next();
          if (nx.done) return null;
          yield* this.assign(s.target, nx.value, f);
          const r = yield* this.block(s.body, f);
          if (r && r.k === "break") return null;
          if (r && r.k === "return") return r;
        }
      }
    }
    raise("SyntaxError", "unsupported statement");
  }

  *index(ix, f) {
    if (ix && ix.k === "slice") {
      return {
        kind: "sliceval",
        lo: ix.lo ? yield* this.eval(ix.lo, f) : null,
        hi: ix.hi ? yield* this.eval(ix.hi, f) : null,
        step: ix.step ? yield* this.eval(ix.step, f) : null,
      };
    }
    return yield* this.eval(ix, f);
  }

  *assign(t, v, f) {
    if (t.k === "name") {
      f.vars.set(t.id, v);
      return;
    }
    if (t.k === "sub") {
      const obj = yield* this.eval(t.obj, f);
      const idx = yield* this.index(t.index, f);
      setItem(obj, idx, v);
      return;
    }
    if (t.k === "tuple" || t.k === "list") {
      const items = toArray(v);
      if (items.length > t.items.length) raise("ValueError", `too many values to unpack (expected ${t.items.length})`);
      if (items.length < t.items.length) raise("ValueError", `not enough values to unpack (expected ${t.items.length}, got ${items.length})`);
      for (let i = 0; i < items.length; i++) yield* this.assign(t.items[i], items[i], f);
      return;
    }
    raise("SyntaxError", "cannot assign to expression");
  }

  *eval(e, f) {
    switch (e.k) {
      case "num":
      case "str":
        return e.v;
      case "const":
        return e.v;
      case "paren":
        return yield* this.eval(e.e, f);
      case "fstr": {
        let out = "";
        for (const p of e.parts) {
          if (typeof p === "string") out += p;
          else {
            const v = yield* this.eval(p.e, f);
            out += p.conv === "r" ? repr(v) : formatSpec(v, p.spec);
          }
        }
        return out;
      }
      case "name":
        return this.lookup(f, e.id);
      case "bin": {
        const a = yield* this.eval(e.l, f);
        const b = yield* this.eval(e.r, f);
        return binop(e.op, a, b);
      }
      case "unary": {
        const v = yield* this.eval(e.e, f);
        if (!isNum(v)) raise("TypeError", `bad operand type for unary ${e.op}: '${typeName(v)}'`);
        if (e.op === "+") return isInt(v) ? toBig(v) : v;
        return isInt(v) ? -toBig(v) : -v;
      }
      case "not":
        return !truthy(yield* this.eval(e.e, f));
      case "bool": {
        let v;
        for (const x of e.vals) {
          v = yield* this.eval(x, f);
          if (e.op === "and" ? !truthy(v) : truthy(v)) return v;
        }
        return v;
      }
      case "cmp": {
        let a = yield* this.eval(e.operands[0], f);
        for (let i = 0; i < e.ops.length; i++) {
          const b = yield* this.eval(e.operands[i + 1], f);
          if (!compare(e.ops[i], a, b)) return false;
          a = b;
        }
        return true;
      }
      case "ifexp":
        return truthy(yield* this.eval(e.test, f)) ? yield* this.eval(e.body, f) : yield* this.eval(e.orelse, f);
      case "list": {
        const items = [];
        for (const x of e.items) items.push(yield* this.eval(x, f));
        return newList(items);
      }
      case "tuple": {
        const items = [];
        for (const x of e.items) items.push(yield* this.eval(x, f));
        return newTuple(items);
      }
      case "dict": {
        const d = newDict();
        for (const [k, v] of e.pairs) {
          const kv = yield* this.eval(k, f);
          dictSet(d, kv, yield* this.eval(v, f));
        }
        return d;
      }
      case "sub": {
        const obj = yield* this.eval(e.obj, f);
        const idx = yield* this.index(e.index, f);
        return getItem(obj, idx);
      }
      case "attr":
        return getAttr(yield* this.eval(e.obj, f), e.name);
      case "call": {
        const fn = yield* this.eval(e.fn, f);
        const args = [];
        for (const a of e.args) args.push(yield* this.eval(a, f));
        let kwargs = null;
        if (e.kwargs.length) {
          kwargs = new Map();
          for (const [k, v] of e.kwargs) kwargs.set(k, yield* this.eval(v, f));
        }
        return yield* this.call(fn, args, kwargs, f);
      }
      case "comp":
        return yield* this.comp(e, f);
    }
    raise("SyntaxError", "unsupported expression");
  }

  // A comprehension runs in its own frame, as in Python 3; each element
  // is a line event so the stepper can walk through it.
  *comp(e, f) {
    const name = e.kind === "list" ? "<listcomp>" : e.kind === "dict" ? "<dictcomp>" : "<genexpr>";
    const outer = yield* this.eval(e.gens[0].iter, f);
    const fr = new Frame(name, f, null, this.frameId++);
    fr.line = e.line ?? f.line;
    this.stack.push(fr);
    if (this.stack.length > this.maxDepth) raise("RecursionError", "maximum recursion depth exceeded");
    const result = e.kind === "dict" ? newDict() : newList([]);
    fr.result = result;
    const self = this;
    function* loop(g, iterable) {
      const gen = e.gens[g];
      const it = iterOf(iterable);
      for (let nx = it.next(); !nx.done; nx = it.next()) {
        yield* self.assign(gen.target, nx.value, fr);
        let ok = true;
        for (const c of gen.ifs) {
          if (!truthy(yield* self.eval(c, fr))) {
            ok = false;
            break;
          }
        }
        if (!ok) {
          // A filtered-out item is still one pass of the loop.
          if (g + 1 === e.gens.length) yield* self.at(fr, fr.line);
          continue;
        }
        if (g + 1 < e.gens.length) {
          yield* loop(g + 1, yield* self.eval(e.gens[g + 1].iter, fr));
          continue;
        }
        if (e.kind === "dict") {
          const k = yield* self.eval(e.elt[0], fr);
          dictSet(result, k, yield* self.eval(e.elt[1], fr));
        } else result.items.push(yield* self.eval(e.elt, fr));
        yield* self.at(fr, fr.line);
      }
    }
    yield* loop(0, outer);
    this.stack.pop();
    return result;
  }

  *call(fn, args, kwargs, f) {
    if (!fn || typeof fn !== "object") raise("TypeError", `'${typeName(fn)}' object is not callable`);
    if (fn.kind === "builtin") return fn.fn(args, kwargs, this);
    if (fn.kind === "method") return fn.fn(fn.self, args, kwargs ?? new Map());
    if (fn.kind === "type") {
      if (!fn.call) raise("TypeError", `cannot create '${fn.name}' instances`);
      return fn.call(args, kwargs);
    }
    if (fn.kind !== "function") raise("TypeError", `'${typeName(fn)}' object is not callable`);
    const ps = fn.params;
    if (args.length > ps.length) {
      raise("TypeError", `${fn.name}() takes ${ps.length} positional argument${ps.length === 1 ? "" : "s"} but ${args.length} ${args.length === 1 ? "was" : "were"} given`);
    }
    const fr = new Frame(fn.name, fn.env, fn, this.frameId++);
    ps.forEach((p, i) => {
      if (i < args.length) {
        if (kwargs && kwargs.has(p.name)) raise("TypeError", `${fn.name}() got multiple values for argument '${p.name}'`);
        fr.vars.set(p.name, args[i]);
      } else if (kwargs && kwargs.has(p.name)) fr.vars.set(p.name, kwargs.get(p.name));
      else if (fn.defaults[i] !== undefined) fr.vars.set(p.name, fn.defaults[i]);
    });
    if (kwargs) for (const k of kwargs.keys()) if (!ps.some((p) => p.name === k)) raise("TypeError", `${fn.name}() got an unexpected keyword argument '${k}'`);
    const missing = ps.filter((p) => !fr.vars.has(p.name)).map((p) => `'${p.name}'`);
    if (missing.length) {
      raise("TypeError", `${fn.name}() missing ${missing.length} required positional argument${missing.length === 1 ? "" : "s"}: ${missing.join(" and ")}`);
    }
    this.stack.push(fr);
    if (this.stack.length > this.maxDepth) {
      raise("RecursionError", `maximum recursion depth exceeded (this tracer stops at ${this.maxDepth} frames; Python's default is 1000)`);
    }
    fr.line = fn.line;
    this.line = fn.line;
    yield { ev: "call", line: fn.line };
    const r = yield* this.block(fn.body, fr);
    const v = r && r.k === "return" ? r.v : null;
    fr.ret = v;
    this.line = fr.line;
    yield { ev: "return", line: fr.line };
    this.stack.pop();
    this.line = f.line;
    return v;
  }
}

// ------------------------------------------------------------ snapshots

function serial(v, heap) {
  if (v === null) return { t: "none", s: "None" };
  if (typeof v === "boolean") return { t: "bool", s: v ? "True" : "False" };
  if (typeof v === "bigint") return { t: "int", s: v.toString() };
  if (typeof v === "number") return { t: "float", s: floatRepr(v) };
  if (typeof v === "string") return { t: "str", s: strRepr(v) };
  if (v.kind === "list" || v.kind === "tuple" || v.kind === "dict" || v.kind === "function") {
    visit(v, heap);
    return { t: "ref", id: v.id };
  }
  return { t: "other", s: repr(v) };
}

function visit(v, heap) {
  if (heap.has(v.id)) return;
  const o = { id: v.id, kind: v.kind };
  heap.set(v.id, o);
  if (v.kind === "list" || v.kind === "tuple") o.items = v.items.map((x) => serial(x, heap));
  else if (v.kind === "dict") o.entries = [...v.map.values()].map(([k, x]) => [serial(k, heap), serial(x, heap)]);
  else if (v.kind === "function") {
    o.name = v.name;
    o.params = v.params.map((p, i) => (v.defaults[i] !== undefined ? `${p.name}=${repr(v.defaults[i])}` : p.name)).join(", ");
  }
}

function snapshot(it, ev) {
  const heap = new Map();
  const frames = it.stack.map((fr) => {
    const vars = [];
    for (const [k, v] of fr.vars) {
      if (v && v.kind === "module") vars.push([k, { t: "other", s: `module ${v.name}` }]);
      else if (v && v.kind === "builtin") vars.push([k, { t: "other", s: `builtin ${v.name}` }]);
      else vars.push([k, serial(v, heap)]);
    }
    const out = { id: fr.id, name: fr.name, vars, line: fr.line };
    if (fr.result) out.result = serial(fr.result, heap);
    if (fr.ret !== undefined) out.ret = serial(fr.ret, heap);
    return out;
  });
  return { ev: ev.ev, line: ev.line, frames, heap: [...heap.values()], out: it.output.length };
}

/**
 * Runs src and records a snapshot before every step. Returns
 * { steps, output, error, stopped, ok }. error is a PyError (with
 * .type, .message, .line) or null; stopped is true when maxSteps ran out.
 * opts.record = false skips snapshots (for running tests quickly).
 */
export function trace(src, opts = {}) {
  const maxSteps = opts.maxSteps ?? 1000;
  const record = opts.record ?? true;
  const steps = [];
  let prog;
  try {
    prog = parse(src);
  } catch (e) {
    return { steps, output: "", error: asPyError(e), stopped: false, ok: false, globals: null };
  }
  const it = new Interp(opts);
  const prev = CUR;
  CUR = it;
  let error = null;
  let stopped = false;
  let count = 0;
  try {
    const gen = it.block(prog, it.global);
    for (let r = gen.next(); !r.done; r = gen.next()) {
      count++;
      if (record) steps.push(snapshot(it, r.value));
      if (count >= maxSteps) {
        stopped = true;
        break;
      }
    }
  } catch (e) {
    error = asPyError(e);
    if (record) steps.push({ ...snapshot(it, { ev: "exception", line: error.line ?? it.line }), error: { type: error.type, message: error.message } });
  } finally {
    CUR = prev;
  }
  if (record && !error && !stopped) steps.push({ ...snapshot(it, { ev: "end", line: 0 }), end: true });
  return { steps, output: it.output, error, stopped, ok: !error && !stopped, globals: it.global.vars, count };
}

function asPyError(e) {
  if (e instanceof PyError) return e;
  if (e instanceof RangeError) return new PyError("RecursionError", "maximum recursion depth exceeded", CUR?.line);
  return new PyError("InternalError", String(e && e.message ? e.message : e), CUR?.line);
}

/** Evaluates one expression in a fresh interpreter (after running setup). */
export function evaluate(exprSrc, setup = "") {
  const r = trace(`${setup}\n__result__ = (${exprSrc})`, { record: false, maxSteps: 5000 });
  if (r.error) return { error: r.error, output: r.output };
  const v = r.globals.get("__result__");
  return { value: v, repr: repr(v), type: typeName(v), output: r.output };
}
