// The tiny language the lexer, scope, interpreter and bytecode blocks
// share: let, assignment, fn (closures), if/else, while, print, integers,
// strings, booleans, calls, and the usual operators. Pure exports.
//
//   program  := stmt*                       (';' between statements is optional)
//   stmt     := 'let' IDENT '=' expr | 'print' expr | 'while' '(' expr ')' block
//             | IDENT '=' expr | expr
//   expr     := Pratt over: || && == != < > <= >= + - * / % unary(- !) call
//   primary  := INT | STRING | true | false | IDENT | '(' expr ')' | block
//             | 'fn' '(' params ')' block | 'if' '(' expr ')' block ['else' (block | if)]

export const KEYWORDS = new Set(["let", "fn", "if", "else", "while", "print", "true", "false"]);
const OPS = ["==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "=", "!"];
const PUNCT = "(){},;";

export class LangError extends Error {
  constructor(message, at, src) {
    const { line, col } = lineCol(src, at);
    super(`${message} (line ${line}, column ${col})`);
    this.at = at;
  }
}

export function lineCol(src, at) {
  const before = src.slice(0, at).split("\n");
  return { line: before.length, col: before.at(-1).length + 1 };
}

/**
 * Splits src into tokens {type, text, start, end}. Types: keyword, ident,
 * number, string, op, punct; with trivia, also space and comment.
 */
export function lex(src, { trivia = false } = {}) {
  const toks = [];
  let i = 0;
  const push = (type, start) => toks.push({ type, text: src.slice(start, i), start, end: i });
  while (i < src.length) {
    const c = src[i], start = i;
    if (/\s/.test(c)) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (trivia) push("space", start);
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      if (trivia) push("comment", start);
    } else if (/[0-9]/.test(c)) {
      while (/[0-9]/.test(src[i] ?? "")) i++;
      if (src[i] === "." && /[0-9]/.test(src[i + 1] ?? "")) { i++; while (/[0-9]/.test(src[i] ?? "")) i++; }
      push("number", start);
    } else if (/[A-Za-z_]/.test(c)) {
      while (/[A-Za-z0-9_]/.test(src[i] ?? "")) i++;
      push(KEYWORDS.has(src.slice(start, i)) ? "keyword" : "ident", start);
    } else if (c === '"') {
      i++;
      while (i < src.length && src[i] !== '"' && src[i] !== "\n") i += src[i] === "\\" ? 2 : 1;
      if (src[i] !== '"') throw new LangError("unterminated string", start, src);
      i++;
      push("string", start);
    } else {
      // Maximal munch: the longest operator that matches.
      const op = OPS.find((o) => src.startsWith(o, i));
      if (op) { i += op.length; push("op", start); }
      else if (PUNCT.includes(c)) { i++; push("punct", start); }
      else throw new LangError(`unexpected character ${JSON.stringify(c)}`, start, src);
    }
  }
  return toks;
}

// Binding powers: [left, right]. Left-associative operators bind their
// right side a little tighter than their left.
const INFIX = {
  "||": [1, 2], "&&": [3, 4],
  "==": [5, 6], "!=": [5, 6], "<": [7, 8], ">": [7, 8], "<=": [7, 8], ">=": [7, 8],
  "+": [9, 10], "-": [9, 10], "*": [11, 12], "/": [11, 12], "%": [11, 12],
};
const PREFIX_BP = 13, CALL_BP = 15;

/** Parses src into a program node. Every node carries start/end offsets. */
export function parse(src) {
  const toks = lex(src);
  let p = 0;
  const peek = (k = 0) => toks[p + k];
  const at = () => (peek() ? peek().start : src.length);
  const is = (text, type) => peek() && peek().text === text && (!type || peek().type === type);
  const fail = (m) => { throw new LangError(m, at(), src); };
  const expect = (text) => {
    if (!is(text)) fail(`expected ${text}${peek() ? `, found ${peek().text}` : " at end of input"}`);
    return toks[p++];
  };
  const node = (t, start, extra) => ({ t, start, end: toks[p - 1]?.end ?? start, ...extra });

  function program() {
    const body = [];
    while (p < toks.length) { body.push(stmt()); while (is(";")) p++; }
    return { t: "program", body, start: 0, end: src.length };
  }
  function block() {
    const start = expect("{").start, body = [];
    while (!is("}")) {
      if (p >= toks.length) fail("missing }");
      body.push(stmt());
      while (is(";")) p++;
    }
    p++;
    return node("block", start, { body });
  }
  function stmt() {
    const start = at();
    if (is("let", "keyword")) {
      p++;
      if (peek()?.type !== "ident") fail("expected a name after let");
      const nameTok = toks[p++];
      expect("=");
      const init = expr(0);
      return node("let", start, { name: nameTok.text, nameStart: nameTok.start, nameEnd: nameTok.end, init });
    }
    if (is("print", "keyword")) { p++; return node("print", start, { value: expr(0) }); }
    if (is("while", "keyword")) {
      p++;
      expect("(");
      const cond = expr(0);
      expect(")");
      return node("while", start, { cond, body: block() });
    }
    if (peek()?.type === "ident" && peek(1)?.text === "=" ) {
      const nameTok = toks[p++];
      p++;
      return node("assign", start, { name: nameTok.text, nameStart: nameTok.start, nameEnd: nameTok.end, value: expr(0) });
    }
    return node("expr", start, { value: expr(0) });
  }
  function expr(minBP) {
    let left = prefix();
    for (;;) {
      const tk = peek();
      if (!tk) break;
      if (tk.text === "(" && CALL_BP > minBP) {
        p++;
        const args = [];
        while (!is(")")) { args.push(expr(0)); if (!is(")")) expect(","); }
        p++;
        left = node("call", left.start, { callee: left, args });
        continue;
      }
      const bp = tk.type === "op" && INFIX[tk.text];
      if (!bp || bp[0] <= minBP) break;
      p++;
      const right = expr(bp[1]);
      left = { t: "bin", op: tk.text, left, right, start: left.start, end: right.end };
    }
    return left;
  }
  function prefix() {
    const tk = peek(), start = at();
    if (!tk) fail("expected an expression");
    if (tk.type === "number") { p++; return node("num", start, { value: Number(tk.text) }); }
    if (tk.type === "string") { p++; return node("str", start, { value: JSON.parse(tk.text) }); }
    if (tk.text === "true" || tk.text === "false") { p++; return node("bool", start, { value: tk.text === "true" }); }
    if (tk.type === "ident") { p++; return node("var", start, { name: tk.text }); }
    if (tk.text === "-" || tk.text === "!") { p++; const operand = expr(PREFIX_BP); return { t: "un", op: tk.text, operand, start, end: operand.end }; }
    if (tk.text === "(") { p++; const e = expr(0); expect(")"); return e; }
    if (tk.text === "{") return block();
    if (tk.text === "fn") {
      p++;
      expect("(");
      const params = [];
      while (!is(")")) {
        if (peek()?.type !== "ident") fail("expected a parameter name");
        const t = toks[p++];
        params.push({ name: t.text, start: t.start, end: t.end });
        if (!is(")")) expect(",");
      }
      p++;
      return node("fn", start, { params, body: block() });
    }
    if (tk.text === "if") {
      p++;
      expect("(");
      const cond = expr(0);
      expect(")");
      const then = block();
      let otherwise = null;
      if (is("else")) { p++; otherwise = is("if") ? prefix() : block(); }
      return node("if", start, { cond, then, otherwise });
    }
    fail(`unexpected ${tk.text}`);
  }
  return program();
}
