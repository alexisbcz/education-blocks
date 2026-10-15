// A small SQL engine: tokenizer, recursive-descent parser and an executor
// that records its logical plan. It supports SELECT [DISTINCT] … FROM …
// [INNER|LEFT] JOIN … ON … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT,
// the aggregates COUNT, SUM, AVG, MIN, MAX, and SQL's three-valued logic:
// a comparison with NULL is unknown, and WHERE keeps only rows that are
// true. No eval anywhere.

const KEYWORDS = new Set(("SELECT DISTINCT FROM WHERE GROUP BY HAVING ORDER ASC DESC LIMIT JOIN INNER LEFT OUTER RIGHT FULL ON AS AND OR NOT NULL IS LIKE IN BETWEEN TRUE FALSE").split(" "));
const AGGREGATES = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

export class SQLError extends Error {}

// ------------------------------------------------------------ tokens

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { let j = i; while (j < src.length && /\s/.test(src[j])) j++; toks.push({ t: "ws", v: src.slice(i, j) }); i = j; continue; }
    if (c === "-" && src[i + 1] === "-") { let j = src.indexOf("\n", i); if (j < 0) j = src.length; toks.push({ t: "comment", v: src.slice(i, j) }); i = j; continue; }
    if (c === "'") {
      let j = i + 1, s = "";
      for (;;) {
        if (j >= src.length) throw new SQLError("Unterminated string");
        if (src[j] === "'") { if (src[j + 1] === "'") { s += "'"; j += 2; continue; } break; }
        s += src[j++];
      }
      toks.push({ t: "str", v: s, raw: src.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: "num", v: Number(src.slice(i, j)), raw: src.slice(i, j) }); i = j; continue;
    }
    if (/[\p{L}_]/u.test(c)) {
      let j = i; while (j < src.length && /[\p{L}\p{N}_]/u.test(src[j])) j++;
      const raw = src.slice(i, j), up = raw.toUpperCase();
      toks.push(KEYWORDS.has(up) ? { t: "kw", v: up, raw } : { t: "id", v: raw, raw }); i = j; continue;
    }
    if (c === '"') { const j = src.indexOf('"', i + 1); if (j < 0) throw new SQLError("Unterminated quoted name"); toks.push({ t: "id", v: src.slice(i + 1, j), raw: src.slice(i, j + 1) }); i = j + 1; continue; }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "<>", "!="].includes(two)) { toks.push({ t: "op", v: two === "!=" ? "<>" : two, raw: two }); i += 2; continue; }
    if ("=<>+-*/(),.;".includes(c)) { toks.push({ t: "op", v: c, raw: c }); i++; continue; }
    throw new SQLError(`Unexpected character “${c}”`);
  }
  return toks;
}

// ------------------------------------------------------------ parser

export function parse(src) {
  const toks = tokenize(src).filter((t) => t.t !== "ws" && t.t !== "comment");
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const isKw = (k, o = 0) => peek(o)?.t === "kw" && peek(o).v === k;
  const isOp = (v) => peek()?.t === "op" && peek().v === v;
  const want = (cond, what) => { if (!cond) throw new SQLError(`Expected ${what}${peek() ? ` near “${peek().raw ?? peek().v}”` : " at the end"}`); };
  const kw = (k) => { want(isKw(k), k); p++; };
  const op = (v) => { want(isOp(v), `“${v}”`); p++; };
  const ident = (what = "a name") => { want(peek()?.t === "id", what); return toks[p++].v; };

  function primary() {
    const t = peek();
    want(t, "an expression");
    if (t.t === "num") { p++; return { k: "num", v: t.v }; }
    if (t.t === "str") { p++; return { k: "str", v: t.v }; }
    if (isKw("NULL")) { p++; return { k: "null" }; }
    if (isKw("TRUE") || isKw("FALSE")) { p++; return { k: "bool", v: t.v === "TRUE" }; }
    if (isOp("(")) { p++; const e = expr(); op(")"); return e; }
    if (t.t === "id") {
      p++;
      if (isOp("(")) {
        const name = t.v.toUpperCase();
        if (!AGGREGATES.has(name)) throw new SQLError(`Unknown function ${t.v}()`);
        p++;
        let distinct = false, star = false, arg = null;
        if (isKw("DISTINCT")) { p++; distinct = true; }
        if (isOp("*")) { want(name === "COUNT", "an argument (only COUNT takes *)"); p++; star = true; } else arg = expr();
        op(")");
        return { k: "call", name, arg, star, distinct };
      }
      if (isOp(".")) { p++; return { k: "col", t: t.v, c: ident("a column") }; }
      return { k: "col", t: null, c: t.v };
    }
    throw new SQLError(`Unexpected “${t.raw ?? t.v}”`);
  }
  function unary() { if (isOp("-")) { p++; return { k: "neg", a: unary() }; } return primary(); }
  function mul() { let a = unary(); while (isOp("*") || isOp("/")) { const o = toks[p++].v; a = { k: "bin", op: o, a, b: unary() }; } return a; }
  function add() { let a = mul(); while (isOp("+") || isOp("-")) { const o = toks[p++].v; a = { k: "bin", op: o, a, b: mul() }; } return a; }
  function cmp() {
    const a = add();
    if (["=", "<>", "<", "<=", ">", ">="].some(isOp)) { const o = toks[p++].v; return { k: "bin", op: o, a, b: add() }; }
    if (isKw("IS")) { p++; let not = false; if (isKw("NOT")) { p++; not = true; } kw("NULL"); return { k: "isnull", a, not }; }
    let not = false;
    if (isKw("NOT") && (isKw("LIKE", 1) || isKw("IN", 1) || isKw("BETWEEN", 1))) { p++; not = true; }
    if (isKw("LIKE")) { p++; return { k: "like", a, b: add(), not }; }
    if (isKw("IN")) { p++; op("("); const list = [expr()]; while (isOp(",")) { p++; list.push(expr()); } op(")"); return { k: "in", a, list, not }; }
    if (isKw("BETWEEN")) { p++; const lo = add(); kw("AND"); const hi = add(); return { k: "between", a, lo, hi, not }; }
    return a;
  }
  function not() { if (isKw("NOT")) { p++; return { k: "not", a: not() }; } return cmp(); }
  function and() { let a = not(); while (isKw("AND")) { p++; a = { k: "bin", op: "AND", a, b: not() }; } return a; }
  function expr() { let a = and(); while (isKw("OR")) { p++; a = { k: "bin", op: "OR", a, b: and() }; } return a; }

  function tableRef() {
    const name = ident("a table name");
    let alias = name;
    if (isKw("AS")) { p++; alias = ident("an alias"); } else if (peek()?.t === "id") alias = toks[p++].v;
    return { name, alias };
  }

  kw("SELECT");
  const q = { distinct: false, items: [], joins: [], where: null, groupBy: [], having: null, orderBy: [], limit: null };
  if (isKw("DISTINCT")) { p++; q.distinct = true; }
  do {
    if (isOp("*")) { p++; q.items.push({ star: true }); continue; }
    const e = expr();
    let alias = null;
    if (isKw("AS")) { p++; alias = ident("an alias"); } else if (peek()?.t === "id") alias = toks[p++].v;
    q.items.push({ e, alias });
  } while (isOp(",") && ++p);
  kw("FROM");
  q.from = tableRef();
  for (;;) {
    let type = null;
    if (isKw("JOIN")) type = "INNER";
    else if (isKw("INNER") && isKw("JOIN", 1)) { p++; type = "INNER"; }
    else if (isKw("LEFT")) { p++; if (isKw("OUTER")) p++; type = "LEFT"; }
    else if (isKw("RIGHT") || isKw("FULL")) throw new SQLError(`${peek().v} JOIN isn't supported by this little engine: swap the tables and use LEFT JOIN (the joins block shows all four)`);
    if (!type) break;
    kw("JOIN");
    const t = tableRef();
    kw("ON");
    q.joins.push({ type, ...t, on: expr() });
  }
  if (isKw("WHERE")) { p++; q.where = expr(); }
  if (isKw("GROUP")) { p++; kw("BY"); do q.groupBy.push(expr()); while (isOp(",") && ++p); }
  if (isKw("HAVING")) { p++; q.having = expr(); }
  if (isKw("ORDER")) {
    p++; kw("BY");
    do {
      const e = expr();
      let desc = false;
      if (isKw("ASC")) p++; else if (isKw("DESC")) { p++; desc = true; }
      q.orderBy.push({ e, desc });
    } while (isOp(",") && ++p);
  }
  if (isKw("LIMIT")) { p++; want(peek()?.t === "num", "a number after LIMIT"); q.limit = toks[p++].v; }
  if (isOp(";")) p++;
  if (peek()) throw new SQLError(`Unexpected “${peek().raw ?? peek().v}” after the query`);
  return q;
}

// ------------------------------------------------------------ printing

export function show(e) {
  switch (e.k) {
    case "num": return String(e.v);
    case "str": return `'${e.v.replaceAll("'", "''")}'`;
    case "null": return "NULL";
    case "bool": return e.v ? "TRUE" : "FALSE";
    case "col": return e.t ? `${e.t}.${e.c}` : e.c;
    case "neg": return `-${show(e.a)}`;
    case "not": return `NOT ${show(e.a)}`;
    case "bin": return `${show(e.a)} ${e.op} ${show(e.b)}`;
    case "isnull": return `${show(e.a)} IS ${e.not ? "NOT " : ""}NULL`;
    case "like": return `${show(e.a)} ${e.not ? "NOT " : ""}LIKE ${show(e.b)}`;
    case "in": return `${show(e.a)} ${e.not ? "NOT " : ""}IN (${e.list.map(show).join(", ")})`;
    case "between": return `${show(e.a)} ${e.not ? "NOT " : ""}BETWEEN ${show(e.lo)} AND ${show(e.hi)}`;
    case "call": return `${e.name}(${e.distinct ? "DISTINCT " : ""}${e.star ? "*" : show(e.arg)})`;
  }
  return "?";
}

const hasAggregate = (e) => !!e && (e.k === "call" || ["a", "b", "lo", "hi"].some((k) => hasAggregate(e[k])) || (e.list ?? []).some(hasAggregate));

// ------------------------------------------------------------ values

// Three-valued logic: true, false, or null (unknown).
const and3 = (a, b) => (a === false || b === false ? false : a === null || b === null ? null : true);
const or3 = (a, b) => (a === true || b === true ? true : a === null || b === null ? null : false);
const truthy = (v) => (v === null ? null : !!v);

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  const x = String(a), y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function likeToRegex(pattern) {
  let re = "^";
  for (const ch of pattern) re += ch === "%" ? ".*" : ch === "_" ? "." : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(re + "$", "su");
}

// ------------------------------------------------------------ executor

export function execute(q, tables) {
  const plan = [];
  const byName = Object.fromEntries(tables.map((t) => [t.name.toLowerCase(), t]));
  const load = (ref) => {
    const t = byName[ref.name.toLowerCase()];
    if (!t) throw new SQLError(`No table named ${ref.name} (try students, courses or enrollments)`);
    return t;
  };
  const scope = []; // [alias, columns]
  const addScope = (ref, t) => {
    if (scope.some(([a]) => a.toLowerCase() === ref.alias.toLowerCase())) throw new SQLError(`Alias ${ref.alias} is used twice`);
    scope.push([ref.alias, t.columns]);
  };
  const keyOf = (alias, col) => `${alias}.${col}`;

  // Column lookup against the tables in scope (and, for ORDER BY and
  // HAVING, the output aliases).
  function resolve(e, outAliases) {
    if (e.t) {
      const s = scope.find(([a]) => a.toLowerCase() === e.t.toLowerCase());
      if (!s) throw new SQLError(`No table or alias named ${e.t}`);
      const col = s[1].find((c) => c.toLowerCase() === e.c.toLowerCase());
      if (!col) throw new SQLError(`${s[0]} has no column ${e.c}`);
      return { key: keyOf(s[0], col) };
    }
    const hits = scope.filter(([, cols]) => cols.some((c) => c.toLowerCase() === e.c.toLowerCase()));
    if (hits.length > 1) throw new SQLError(`Column ${e.c} is ambiguous: prefix it with ${hits.map(([a]) => a).join(" or ")}`);
    if (hits.length === 1) return { key: keyOf(hits[0][0], hits[0][1].find((c) => c.toLowerCase() === e.c.toLowerCase())) };
    if (outAliases && e.c in outAliases) return { alias: e.c };
    throw new SQLError(`No column named ${e.c}`);
  }

  // ctx: { row } for a single row, or { group, first, groupKeys, groupTexts }.
  function evaluate(e, ctx) {
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "null": return null;
      case "bool": return e.v;
      case "col": {
        if (ctx.group && ctx.groupTexts.has(show(e))) return ctx.first[resolve(e).key] ?? null;
        const r = resolve(e, ctx.out);
        if (r.alias !== undefined) return ctx.out[r.alias];
        if (ctx.group) {
          if (!ctx.groupKeys.has(r.key)) throw new SQLError(`Column ${show(e)} must appear in GROUP BY or be used in an aggregate`);
          return ctx.first[r.key] ?? null;
        }
        return ctx.row[r.key] ?? null;
      }
      case "call": {
        if (!ctx.group) throw new SQLError(`${e.name}() is an aggregate: it can't be used in WHERE or ON (use HAVING)`);
        let vals = e.star ? ctx.group : ctx.group.map((row) => evaluate(e.arg, { row })).filter((v) => v !== null);
        if (e.distinct && !e.star) vals = [...new Map(vals.map((v) => [JSON.stringify(v), v])).values()];
        if (e.name === "COUNT") return vals.length;
        if (vals.length === 0) return null;
        if (e.name === "SUM") return vals.reduce((a, b) => a + b, 0);
        if (e.name === "AVG") return vals.reduce((a, b) => a + b, 0) / vals.length;
        if (e.name === "MIN") return vals.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
        return vals.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
      }
      case "neg": { const v = evaluate(e.a, ctx); return v === null ? null : -v; }
      case "not": { const v = truthy(evaluate(e.a, ctx)); return v === null ? null : !v; }
      case "isnull": { const v = evaluate(e.a, ctx) === null; return e.not ? !v : v; }
      case "like": {
        const a = evaluate(e.a, ctx), b = evaluate(e.b, ctx);
        if (a === null || b === null) return null;
        const m = likeToRegex(String(b)).test(String(a));
        return e.not ? !m : m;
      }
      case "in": {
        const a = evaluate(e.a, ctx);
        if (a === null) return null;
        let res = false;
        for (const x of e.list) { const v = evaluate(x, ctx); res = or3(res, v === null ? null : compare(a, v) === 0); }
        return e.not ? (res === null ? null : !res) : res;
      }
      case "between": {
        const a = evaluate(e.a, ctx), lo = evaluate(e.lo, ctx), hi = evaluate(e.hi, ctx);
        const r = and3(a === null || lo === null ? null : compare(a, lo) >= 0, a === null || hi === null ? null : compare(a, hi) <= 0);
        return e.not ? (r === null ? null : !r) : r;
      }
      case "bin": {
        if (e.op === "AND") return and3(truthy(evaluate(e.a, ctx)), truthy(evaluate(e.b, ctx)));
        if (e.op === "OR") return or3(truthy(evaluate(e.a, ctx)), truthy(evaluate(e.b, ctx)));
        const a = evaluate(e.a, ctx), b = evaluate(e.b, ctx);
        if (a === null || b === null) return null;
        switch (e.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          // Exact division (as in MySQL); SQLite and PostgreSQL truncate
          // integer / integer. Division by zero gives NULL, as in SQLite.
          case "/": return b === 0 ? null : a / b;
          case "=": return compare(a, b) === 0;
          case "<>": return compare(a, b) !== 0;
          case "<": return compare(a, b) < 0;
          case "<=": return compare(a, b) <= 0;
          case ">": return compare(a, b) > 0;
          case ">=": return compare(a, b) >= 0;
        }
      }
    }
    throw new SQLError("Can't evaluate " + show(e));
  }

  // FROM and JOIN: nested loops.
  const base = load(q.from);
  addScope(q.from, base);
  let rows = base.rows.map((r) => Object.fromEntries(base.columns.map((c, i) => [keyOf(q.from.alias, c), r[i]])));
  plan.push({ op: "Scan", detail: `${base.name}${q.from.alias !== base.name ? " AS " + q.from.alias : ""}`, rows: rows.length });
  for (const j of q.joins) {
    const t = load(j);
    addScope(j, t);
    const right = t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [keyOf(j.alias, c), r[i]])));
    const nulls = Object.fromEntries(t.columns.map((c) => [keyOf(j.alias, c), null]));
    const out = [];
    for (const l of rows) {
      let matched = false;
      for (const r of right) {
        const row = { ...l, ...r };
        if (evaluate(j.on, { row }) === true) { out.push(row); matched = true; }
      }
      if (!matched && j.type === "LEFT") out.push({ ...l, ...nulls });
    }
    plan.push({ op: j.type === "LEFT" ? "Left join" : "Join", detail: `${t.name}${j.alias !== t.name ? " AS " + j.alias : ""} ON ${show(j.on)}`, rows: out.length });
    rows = out;
  }
  if (q.where) {
    if (hasAggregate(q.where)) throw new SQLError("Aggregates can't be used in WHERE: filter groups with HAVING");
    rows = rows.filter((row) => evaluate(q.where, { row }) === true);
    plan.push({ op: "Filter", detail: show(q.where), rows: rows.length });
  }

  const grouped = q.groupBy.length > 0 || q.items.some((it) => it.e && hasAggregate(it.e)) || hasAggregate(q.having) || q.orderBy.some((o) => hasAggregate(o.e));
  // Each unit is a row, or a group of rows, ready for projection.
  let units;
  if (grouped) {
    if (q.items.some((it) => it.star)) throw new SQLError("SELECT * can't be combined with GROUP BY or aggregates");
    const groupKeys = new Set(), groupTexts = new Set(q.groupBy.map(show));
    for (const g of q.groupBy) {
      if (hasAggregate(g)) throw new SQLError("Aggregates can't be used in GROUP BY");
      if (g.k === "col") groupKeys.add(resolve(g).key);
    }
    const map = new Map();
    for (const row of rows) {
      const key = JSON.stringify(q.groupBy.map((g) => evaluate(g, { row })));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    let groups = [...map.values()];
    if (q.groupBy.length === 0) groups = [rows]; // one group, even when empty
    units = groups.map((g) => ({ group: g, first: g[0] ?? {}, groupKeys, groupTexts }));
    plan.push({ op: "Aggregate", detail: q.groupBy.length ? `GROUP BY ${q.groupBy.map(show).join(", ")}` : "whole table", rows: units.length });
    if (q.having) {
      units = units.filter((u) => evaluate(q.having, u) === true);
      plan.push({ op: "Filter", detail: `HAVING ${show(q.having)}`, rows: units.length });
    }
  } else {
    if (q.having) throw new SQLError("HAVING needs GROUP BY or an aggregate");
    units = rows.map((row) => ({ row }));
  }

  // Projection: output names and values.
  const columns = [];
  for (const it of q.items) {
    if (it.star) for (const [alias, cols] of scope) for (const c of cols) columns.push({ name: scope.length > 1 ? `${alias}.${c}` : c, key: keyOf(alias, c) });
    else columns.push({ name: it.alias ?? show(it.e), e: it.e });
  }
  for (const u of units) {
    u.out = {};
    u.values = columns.map((c) => {
      const v = c.key ? u.row[c.key] ?? null : evaluate(c.e, u);
      u.out[c.name] = v;
      return v;
    });
  }
  if (q.distinct) {
    const seen = new Set();
    units = units.filter((u) => { const k = JSON.stringify(u.values); if (seen.has(k)) return false; seen.add(k); return true; });
    plan.push({ op: "Distinct", detail: "", rows: units.length });
  }
  if (q.orderBy.length) {
    const keyFor = (o, u) => {
      if (o.e.k === "num") {
        const i = o.e.v - 1;
        if (i < 0 || i >= columns.length) throw new SQLError(`ORDER BY ${o.e.v} is out of range`);
        return u.values[i];
      }
      if (o.e.k === "col" && !o.e.t && o.e.c in u.out && !q.items.some((it) => it.e && show(it.e) === o.e.c && !it.alias)) return u.out[o.e.c];
      return evaluate(o.e, { ...u, out: u.out });
    };
    const keyed = units.map((u, i) => ({ u, i, ks: q.orderBy.map((o) => keyFor(o, u)) }));
    keyed.sort((a, b) => {
      for (let k = 0; k < q.orderBy.length; k++) {
        const x = a.ks[k], y = b.ks[k];
        // NULLs sort first in ascending order and last in descending, as in SQLite.
        const c = x === null && y === null ? 0 : x === null ? -1 : y === null ? 1 : compare(x, y);
        if (c) return q.orderBy[k].desc ? -c : c;
      }
      return a.i - b.i;
    });
    units = keyed.map((k) => k.u);
    plan.push({ op: "Sort", detail: q.orderBy.map((o) => show(o.e) + (o.desc ? " DESC" : "")).join(", "), rows: units.length });
  }
  if (q.limit !== null) {
    units = units.slice(0, q.limit);
    plan.push({ op: "Limit", detail: String(q.limit), rows: units.length });
  }
  plan.push({ op: "Project", detail: columns.map((c) => c.name).join(", "), rows: units.length });
  return { columns: columns.map((c) => c.name), rows: units.map((u) => u.values), plan };
}

export function run(src, tables) {
  return execute(parse(src), tables);
}
