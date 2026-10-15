// Regular expressions, compiled the textbook way: a recursive-descent
// parser, Thompson's construction (one NFA fragment per operator, joined
// by ε-moves) and the subset construction (each DFA state is the
// ε-closure of a set of NFA states). The other blocks live in plt-*.js.

import { h, msg, out, onInput, stepper, drawAutomaton, charRanges, show } from "./plt-ui.js";

// ------------------------------------------------------------ parser

function parseRegex(src) {
  let i = 0;
  const peek = () => src[i];
  const fail = (m) => { throw new Error(`${m} at position ${i + 1}`); };

  function alt() {
    const parts = [concat()];
    while (peek() === "|") { i++; parts.push(concat()); }
    return parts.length === 1 ? parts[0] : { t: "alt", parts };
  }
  function concat() {
    const parts = [];
    while (i < src.length && peek() !== "|" && peek() !== ")") parts.push(repeat());
    return parts.length === 1 ? parts[0] : { t: "cat", parts };
  }
  function repeat() {
    let node = atom();
    while ("*+?".includes(peek() ?? "x") && i < src.length) node = { t: src[i++], node };
    return node;
  }
  function atom() {
    const c = src[i];
    if (c === "(") {
      i++;
      const n = alt();
      if (peek() !== ")") fail("missing )");
      i++;
      return n;
    }
    if (c === "[") return cls();
    if (c === ".") { i++; return { t: "m", m: { any: true } }; }
    if (c === "\\") {
      i++;
      if (i >= src.length) fail("dangling \\");
      return { t: "m", m: { lit: src[i++] } };
    }
    if ("*+?".includes(c)) fail(`nothing to repeat before ${c}`);
    if (c === ")") fail("unmatched )");
    i++;
    return { t: "m", m: { lit: c } };
  }
  function cls() {
    i++;
    const neg = peek() === "^";
    if (neg) i++;
    const ranges = [];
    while (i < src.length && peek() !== "]") {
      let a = src[i++];
      if (a === "\\") a = src[i++];
      if (peek() === "-" && src[i + 1] && src[i + 1] !== "]") {
        i++;
        let b = src[i++];
        if (b === "\\") b = src[i++];
        if (b < a) fail(`bad range ${a}-${b}`);
        ranges.push([a, b]);
      } else ranges.push([a, a]);
    }
    if (peek() !== "]") fail("missing ]");
    i++;
    if (!ranges.length) fail("empty class");
    return { t: "m", m: { ranges, neg } };
  }
  if (!src.length) return { t: "eps" };
  const tree = alt();
  if (i < src.length) fail(src[i] === ")" ? "unmatched )" : "unexpected " + src[i]);
  return tree;
}

const matches = (m, c) =>
  m.any ? true : m.lit !== undefined ? m.lit === c : m.ranges.some(([a, b]) => c >= a && c <= b) !== m.neg;

const matcherLabel = (m) => (m.any ? "." : m.lit !== undefined ? show(m.lit) : `[${m.neg ? "^" : ""}${m.ranges.map(([a, b]) => (a === b ? a : a + "-" + b)).join("")}]`);

// ------------------------------------------------------------ Thompson

function thompson(tree) {
  const states = [];
  const ns = () => (states.push({ eps: [], edges: [] }), states.length - 1);
  function build(n) {
    if (n.t === "eps") { const a = ns(), b = ns(); states[a].eps.push(b); return [a, b]; }
    if (n.t === "m") { const a = ns(), b = ns(); states[a].edges.push({ m: n.m, to: b }); return [a, b]; }
    if (n.t === "cat") {
      const fr = n.parts.map(build);
      for (let k = 0; k + 1 < fr.length; k++) states[fr[k][1]].eps.push(fr[k + 1][0]);
      return [fr[0][0], fr.at(-1)[1]];
    }
    if (n.t === "alt") {
      const a = ns(), fr = n.parts.map(build), b = ns();
      for (const [s0, s1] of fr) { states[a].eps.push(s0); states[s1].eps.push(b); }
      return [a, b];
    }
    const [s0, s1] = build(n.node);
    const a = ns(), b = ns();
    states[a].eps.push(s0);
    states[s1].eps.push(b);
    if (n.t === "*" || n.t === "?") states[a].eps.push(b);
    if (n.t === "*" || n.t === "+") states[s1].eps.push(s0);
    return [a, b];
  }
  const [start, accept] = build(tree);
  return { states, start, accept };
}

function closure(nfa, set) {
  const st = [...set], seen = new Set(set);
  while (st.length) for (const v of nfa.states[st.pop()].eps) if (!seen.has(v)) { seen.add(v); st.push(v); }
  return seen;
}

function moveOn(nfa, set, c) {
  const next = new Set();
  for (const s of set) for (const e of nfa.states[s].edges) if (matches(e.m, c)) next.add(e.to);
  return next;
}

// ------------------------------------------------------------ subset construction

function literals(tree, acc = new Set()) {
  if (tree.t === "m") {
    if (tree.m.lit !== undefined) acc.add(tree.m.lit);
    if (tree.m.ranges) for (const [a, b] of tree.m.ranges) {
      // Small ranges contribute every character; large ones their ends.
      if (b.charCodeAt(0) - a.charCodeAt(0) <= 5) for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) acc.add(String.fromCharCode(c));
      else { acc.add(a); acc.add(b); }
    }
  }
  for (const k of tree.parts ?? []) literals(k, acc);
  if (tree.node) literals(tree.node, acc);
  return acc;
}

function subset(nfa, sigma) {
  const keyOf = (set) => [...set].sort((a, b) => a - b).join(",");
  const start = closure(nfa, [nfa.start]);
  const dstates = [start], index = new Map([[keyOf(start), 0]]), trans = [];
  for (let k = 0; k < dstates.length; k++) {
    trans[k] = {};
    for (const c of sigma) {
      const nxt = closure(nfa, moveOn(nfa, dstates[k], c));
      if (!nxt.size) continue; // the dead state is left out
      const key = keyOf(nxt);
      if (!index.has(key)) { index.set(key, dstates.length); dstates.push(nxt); }
      trans[k][c] = index.get(key);
    }
  }
  return { dstates, trans, accept: dstates.map((d) => d.has(nfa.accept)) };
}

// ------------------------------------------------------------ block

for (const root of document.querySelectorAll("[data-plt-regex]")) {
  const reIn = root.querySelector('[data-in="re"]');
  const strIn = root.querySelector('[data-in="str"]');
  const svg = root.querySelector("[data-graph]");
  const tape = root.querySelector("[data-tape]");
  const table = root.querySelector("[data-table]");
  let mode = "dfa", model = null, pos = 0;

  function compile() {
    try {
      const tree = parseRegex(reIn.value);
      const nfa = thompson(tree);
      const sigma = [...new Set([...literals(tree), ...strIn.value])].sort();
      const dfa = subset(nfa, sigma);
      model = { nfa, dfa, sigma };
      reIn.removeAttribute("data-bad");
      msg(root, `Σ = {${charRanges(sigma)}}`);
    } catch (e) {
      model = null;
      reIn.setAttribute("data-bad", "");
      msg(root, e.message, "bad");
    }
    pos = 0;
    render();
  }

  // The DFA run up to pos: the state after each prefix, or -1 once dead.
  function dfaRun() {
    const path = [0];
    let cur = 0;
    for (let k = 0; k < pos; k++) {
      cur = cur < 0 ? -1 : model.dfa.trans[cur][strIn.value[k]] ?? -1;
      path.push(cur);
    }
    return path;
  }
  function nfaSet() {
    let set = closure(model.nfa, [model.nfa.start]);
    for (let k = 0; k < pos; k++) set = closure(model.nfa, moveOn(model.nfa, set, strIn.value[k]));
    return set;
  }

  function render() {
    const str = strIn.value;
    tape.replaceChildren(...[...str].map((c, k) => h("span", {
      class: "flex size-7 items-center justify-center rounded-md border " + (k < pos ? "border-transparent bg-foreground/5 text-muted-foreground" : k === pos ? "border-brand text-brand" : ""),
      text: show(c),
    })), h("span", { class: "ml-1 self-center text-xs text-muted-foreground", text: `${pos}/${str.length}` }));
    if (!model) { svg.replaceChildren(); table.replaceChildren(); return; }
    const { nfa, dfa, sigma } = model;
    const path = dfaRun();
    const cur = path.at(-1);
    const nset = nfaSet();

    if (mode === "dfa") {
      const nodes = dfa.dstates.map((_, k) => ({ label: "D" + k, accept: dfa.accept[k] }));
      const merged = new Map();
      dfa.trans.forEach((row, k) => Object.entries(row).forEach(([c, to]) => {
        const key = k + ">" + to;
        if (!merged.has(key)) merged.set(key, { from: k, to, chars: [] });
        merged.get(key).chars.push(c);
      }));
      const edges = [...merged.values()].map((e) => ({ ...e, label: charRanges(e.chars) }));
      const hot = new Set();
      if (pos > 0 && cur >= 0) edges.forEach((e, k) => { if (e.from === path.at(-2) && e.to === cur) hot.add(k); });
      drawAutomaton(svg, nodes, edges, 0, new Set(cur >= 0 ? [cur] : []), hot);
    } else {
      const nodes = nfa.states.map((_, k) => ({ label: String(k), accept: k === nfa.accept }));
      const edges = [];
      nfa.states.forEach((st, k) => {
        st.eps.forEach((to) => edges.push({ from: k, to, label: "ε" }));
        st.edges.forEach((e) => edges.push({ from: k, to: e.to, label: matcherLabel(e.m) }));
      });
      drawAutomaton(svg, nodes, edges, nfa.start, nset);
    }

    // Transition table of the DFA.
    table.replaceChildren(
      h("thead", {}, h("tr", { class: "border-b text-muted-foreground" }, h("th", { class: "px-2 py-1 text-left font-normal", text: "state" }),
        ...sigma.map((c) => h("th", { class: "px-1.5 py-1 font-normal", text: show(c) })))),
      h("tbody", {}, ...dfa.dstates.map((d, k) => h("tr", { class: "border-b last:border-b-0 " + (k === cur ? "bg-brand/10 text-brand" : "") },
        h("td", { class: "px-2 py-1 whitespace-nowrap", text: `${dfa.accept[k] ? "*" : ""}D${k} {${[...d].sort((a, b) => a - b).join(",")}}` }),
        ...sigma.map((c) => h("td", { class: "px-1.5 py-1 text-center", text: dfa.trans[k][c] !== undefined ? "D" + dfa.trans[k][c] : "·" }))))),
    );

    const done = pos === str.length;
    out(root, "nfa", String(nfa.states.length));
    out(root, "dfa", `${dfa.dstates.length} (+ dead)`);
    out(root, "cur", cur < 0 ? "dead: no way to match" : `D${cur}  ≡ NFA {${[...nset].sort((a, b) => a - b).join(",")}}`);
    const ok = cur >= 0 && dfa.accept[cur];
    out(root, "verdict", done ? (ok ? "accepted" : "rejected") : cur < 0 ? "rejected (dead)" : ok ? "accepting so far" : "reading…");
    const v = root.querySelector('[data-out="verdict"]');
    v.className = "tabular-nums " + (done || cur < 0 ? (ok ? "text-add" : "text-del") : "");
  }

  stepper(root, {
    reset: () => { pos = 0; render(); },
    back: () => { pos = Math.max(0, pos - 1); render(); },
    step: () => { pos = Math.min(strIn.value.length, pos + 1); render(); },
    run: () => { pos = strIn.value.length; render(); },
  });
  onInput(reIn, compile);
  onInput(strIn, compile);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; render(); });
  compile();
}
