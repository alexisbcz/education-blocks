// Theory of computation, part one: finite automata and what lies beyond
// them. A DFA designer checked by product construction, table-filling
// minimisation, an exhaustive pumping-lemma game, the diagonal argument
// and the Chomsky hierarchy. Machines with memory live in
// toc-machines.js, satisfiability in toc-sat.js.

import { h, s, stext, msg, out, onInput, stepper, drawAutomaton } from "./plt-ui.js";
import { scrubAll } from "./scrub.js";

// drawAutomaton puts self-loop labels at the very top edge; give them room.
function draw(svg, ...args) {
  drawAutomaton(svg, ...args);
  const [x, y, w, hh] = svg.getAttribute("viewBox").split(" ").map(Number);
  svg.setAttribute("viewBox", `${x} ${y - 16} ${w} ${hh + 16}`);
}

const onSeg = (root, fn) => root.querySelectorAll("[role=tablist]").forEach((t) => t.addEventListener("seg-change", (e) => fn(e.detail.value, t)));
const verdictClass = (el, ok) => { if (el) el.className = "tabular-nums " + (ok === null ? "" : ok ? "text-add" : "text-del"); };

// ------------------------------------------------------------ DFA core

/** A DFA: { n, sigma: [...], t: [{c: q}], acc: Set, start: 0 }. */
export function runDFA(d, str) {
  let q = d.start ?? 0;
  for (const c of str) {
    q = d.t[q][c];
    if (q === undefined) return { q: -1, ok: false };
  }
  return { q, ok: d.acc.has(q) };
}

/** Shortest string on which a and b disagree, or null if equivalent.
 *  Breadth-first search over the product automaton. */
export function counterexample(a, b) {
  const key = (p, q) => p * 1000 + q;
  const start = [a.start ?? 0, b.start ?? 0];
  const seen = new Map([[key(...start), null]]);
  const queue = [start];
  while (queue.length) {
    const [p, q] = queue.shift();
    if (a.acc.has(p) !== b.acc.has(q)) {
      let str = "", k = key(p, q);
      while (seen.get(k)) { const [pk, c] = seen.get(k); str = c + str; k = pk; }
      return { str, mine: a.acc.has(p) };
    }
    for (const c of a.sigma) {
      const np = a.t[p][c], nq = b.t[q][c], k = key(np, nq);
      if (!seen.has(k)) { seen.set(k, [key(p, q), c]); queue.push([np, nq]); }
    }
  }
  return null;
}

const tbl = (n, f) => Array.from({ length: n }, (_, q) => ({ 0: f(q, 0), 1: f(q, 1) }));
const TARGETS = {
  mod3: { n: 3, sigma: ["0", "1"], t: tbl(3, (r, b) => (2 * r + b) % 3), acc: new Set([0]), note: "Read most significant bit first; the empty string counts as 0." },
  even1: { n: 2, sigma: ["0", "1"], t: tbl(2, (q, b) => q ^ b), acc: new Set([0]), note: "Zero 1s is an even number." },
  ends01: { n: 3, sigma: ["0", "1"], t: [{ 0: 1, 1: 0 }, { 0: 1, 1: 2 }, { 0: 1, 1: 0 }], acc: new Set([2]), note: "" },
  no11: { n: 3, sigma: ["0", "1"], t: [{ 0: 0, 1: 1 }, { 0: 0, 1: 2 }, { 0: 2, 1: 2 }], acc: new Set([0, 1]), note: "Strings with no two 1s in a row." },
};

/** Merges parallel edges into one labelled edge for drawing. */
function edgesOf(d) {
  const m = new Map();
  d.t.forEach((row, q) => d.sigma.forEach((c) => {
    const to = row[c];
    if (to === undefined) return;
    const k = q + ">" + to;
    m.set(k, m.has(k) ? { ...m.get(k), label: m.get(k).label + "," + c } : { from: q, to, label: c });
  }));
  return [...m.values()];
}

const cellBtn = "w-full rounded px-2 py-1 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50";

for (const root of document.querySelectorAll("[data-toc-dfa]")) {
  const svg = root.querySelector("[data-graph]");
  const table = root.querySelector("[data-table]");
  const strIn = root.querySelector('[data-in="str"]');
  let target = "mod3";
  let d;
  const fresh = (n) => ({ n, sigma: ["0", "1"], t: tbl(n, (q) => q), acc: new Set(), start: 0 });
  const reset = () => { d = fresh(2); render(); };

  function render() {
    k = 0;
    const T = TARGETS[target];
    const str = strIn.value.trim();
    const bad = /[^01]/.test(str);
    const mine = bad ? null : runDFA(d, str);
    draw(svg, Array.from({ length: d.n }, (_, q) => ({ label: "q" + q, accept: d.acc.has(q) })), edgesOf(d), 0, mine ? new Set([mine.q]) : new Set());

    table.replaceChildren(
      h("thead", {}, h("tr", { class: "border-b text-muted-foreground" },
        h("th", { class: "px-2 py-1 text-left font-normal", text: "state" }),
        h("th", { class: "px-2 py-1 font-normal", text: "on 0" }), h("th", { class: "px-2 py-1 font-normal", text: "on 1" }))),
      h("tbody", {}, ...d.t.map((row, q) => h("tr", { class: "border-b last:border-b-0" + (mine?.q === q ? " bg-brand/10" : "") },
        h("td", { class: "px-1 py-0.5" }, btn(`${q === 0 ? "→" : ""}q${q}${d.acc.has(q) ? " ✓" : ""}`, `State q${q}: ${d.acc.has(q) ? "accepting" : "rejecting"}. Toggle.`, (e) => {
          d.acc.has(q) ? d.acc.delete(q) : d.acc.add(q);
          render(); refocus(e);
        }, d.acc.has(q) ? "text-brand" : "")),
        ...["0", "1"].map((c) => h("td", { class: "px-1 py-0.5 text-center" }, btn("q" + row[c], `From q${q} on ${c} go to q${row[c]}. Change.`, (e) => {
          row[c] = (row[c] + (e.shiftKey ? d.n - 1 : 1)) % d.n;
          render(); refocus(e);
        })))))),
    );

    if (bad) { out(root, "mine", "use only 0 and 1"); out(root, "truth", "—"); }
    else {
      const truth = runDFA(T, str).ok;
      out(root, "mine", `${mine.ok ? "accepts" : "rejects"} “${str}” (ends in q${mine.q})`);
      out(root, "truth", `${truth ? "contains" : "excludes"} “${str}”`);
    }
    const ce = counterexample(d, T);
    const v = root.querySelector('[data-out="verdict"]');
    if (!ce) { v.textContent = "equivalent: your DFA recognises exactly this language"; verdictClass(v, true); }
    else {
      v.textContent = `differs on “${ce.str || "ε"}”: you ${ce.mine ? "accept" : "reject"}, it should ${ce.mine ? "reject" : "accept"}`;
      verdictClass(v, false);
    }
    if (T.note) v.title = T.note;
  }
  // Re-rendering replaces the buttons; keep keyboard focus on the same cell.
  function refocus(e) {
    const idx = e.currentTarget?.dataset.k;
    if (idx !== undefined) table.querySelector(`[data-k="${idx}"]`)?.focus();
  }
  let k = 0;
  function btn(text, label, onClick, extra = "") {
    const b = h("button", { class: cellBtn + " " + extra, text, attrs: { type: "button", "aria-label": label, "data-k": String(k++ % 64) } });
    b.addEventListener("click", onClick);
    return b;
  }

  root.querySelector('[data-act="add"]').addEventListener("click", () => {
    if (d.n >= 8) return;
    d.t.push({ 0: d.n, 1: d.n });
    d.n++;
    render();
  });
  root.querySelector('[data-act="remove"]').addEventListener("click", () => {
    if (d.n <= 1) return;
    d.n--;
    d.t.pop();
    d.acc.delete(d.n);
    for (const row of d.t) for (const c of d.sigma) if (row[c] >= d.n) row[c] = 0;
    render();
  });
  root.querySelector('[data-act="clear"]').addEventListener("click", reset);
  onSeg(root, (v) => { target = v; render(); });
  onInput(strIn, render, 60);
  reset();
}

// ------------------------------------------------------------ minimisation

const AB = ["a", "b"];
const MIN_PRESETS = {
  // Ends in "ab", padded with duplicates of each of the three real states.
  a: {
    names: "ABCDEFGH".split(""), sigma: AB, acc: new Set([2, 5]),
    t: [[1, 3], [4, 2], [4, 6], [1, 6], [1, 5], [1, 0], [7, 0], [7, 2]].map(([a, b]) => ({ a, b })),
  },
  // Binary value mod 6, accepting multiples of 3: twice too many states.
  b: {
    names: ["r0", "r1", "r2", "r3", "r4", "r5"], sigma: ["0", "1"], acc: new Set([0, 3]),
    t: tbl(6, (r, b) => (2 * r + b) % 6),
  },
  // Number of a's mod 5: every state is needed.
  c: {
    names: ["c0", "c1", "c2", "c3", "c4"], sigma: AB, acc: new Set([0]),
    t: Array.from({ length: 5 }, (_, q) => ({ a: (q + 1) % 5, b: q })),
  },
};

/** Table filling. Returns the rounds: each a Map "p,q" → reason for the
 *  pairs it newly marks, plus the final equivalence classes. */
export function tableFilling(d) {
  const n = d.t.length, marked = new Map(), rounds = [];
  const key = (p, q) => (p < q ? p + "," + q : q + "," + p);
  let fresh = new Map();
  for (let q = 1; q < n; q++) for (let p = 0; p < q; p++)
    if (d.acc.has(p) !== d.acc.has(q)) fresh.set(key(p, q), { why: "accepting vs rejecting" });
  while (fresh.size) {
    for (const [k, v] of fresh) marked.set(k, { ...v, round: rounds.length + 1 });
    rounds.push(fresh);
    fresh = new Map();
    for (let q = 1; q < n; q++) for (let p = 0; p < q; p++) {
      if (marked.has(key(p, q))) continue;
      for (const c of d.sigma) {
        const a = d.t[p][c], b = d.t[q][c];
        if (a !== b && marked.has(key(a, b))) { fresh.set(key(p, q), { why: `on ${c} → (${d.names[Math.min(a, b)]},${d.names[Math.max(a, b)]})` }); break; }
      }
    }
  }
  // Classes: union of unmarked pairs.
  const cls = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (cls[x] === x ? x : (cls[x] = find(cls[x])));
  for (let q = 1; q < n; q++) for (let p = 0; p < q; p++) if (!marked.has(key(p, q))) cls[find(q)] = find(p);
  const reps = [...new Set(Array.from({ length: n }, (_, i) => find(i)))].sort((x, y) => x - y);
  const classes = reps.map((r) => Array.from({ length: n }, (_, i) => i).filter((i) => find(i) === r));
  return { rounds, marked, classes, key };
}

for (const root of document.querySelectorAll("[data-toc-min]")) {
  const origSvg = root.querySelector("[data-orig]"), minSvg = root.querySelector("[data-min]");
  const pairs = root.querySelector("[data-pairs]");
  let d, res, step = 0;

  function load(id) {
    d = MIN_PRESETS[id];
    res = tableFilling(d);
    step = 0;
    draw(origSvg, d.names.map((label, q) => ({ label, accept: d.acc.has(q) })), edgesOf({ ...d, start: 0 }), 0);
    render();
  }
  const last = () => res.rounds.length + 1; // the extra step merges.

  function render() {
    const n = d.names.length;
    const shown = new Map();
    res.rounds.slice(0, step).forEach((r, i) => r.forEach((v, k) => shown.set(k, { ...v, round: i + 1 })));
    const fresh = step >= 1 && step <= res.rounds.length ? res.rounds[step - 1] : new Map();
    pairs.replaceChildren(
      h("tbody", {}, ...Array.from({ length: n - 1 }, (_, i) => i + 1).map((q) => h("tr", {},
        h("th", { class: "px-1.5 py-0.5 pr-2 text-right font-normal text-muted-foreground", text: d.names[q] }),
        ...Array.from({ length: n - 1 }, (_, p) => {
          if (p >= q) return h("td", {});
          const k = res.key(p, q), m = shown.get(k), isNew = fresh.has(k);
          const merged = step === last() && !m;
          return h("td", {
            class: "size-8 border text-center transition-colors duration-150 " + (isNew ? "bg-brand/15 text-brand" : merged ? "bg-[color-mix(in_oklab,var(--code-add)_14%,transparent)] text-add" : m ? "text-muted-foreground" : ""),
            text: m ? "×" + m.round : merged ? "≡" : "",
            attrs: { title: m ? `${d.names[p]},${d.names[q]} marked in round ${m.round}: ${m.why}` : `${d.names[p]},${d.names[q]}` },
          });
        }))),
        h("tr", {}, h("td", {}), ...d.names.slice(0, n - 1).map((nm) => h("th", { class: "px-1.5 pt-1 font-normal text-muted-foreground", text: nm })))),
    );
    out(root, "round", `${step} / ${last()}`);
    out(root, "marked", `${shown.size} of ${(n * (n - 1)) / 2}`);
    if (step === 0) msg(root, "Step to mark the pairs that accepting and rejecting already tell apart.");
    else if (step <= res.rounds.length) {
      const list = [...fresh].slice(0, 4).map(([k, v]) => `(${k.split(",").map((x) => d.names[x]).join(",")}) ${v.why}`);
      msg(root, `Round ${step}: ${fresh.size} new pair${fresh.size === 1 ? "" : "s"}. ${list.join("; ")}${fresh.size > 4 ? "; …" : ""}`);
    } else msg(root, `No new pair can be marked. The ${res.classes.length} unmarked groups merge into single states.`, "good");

    if (step === last()) {
      const cOf = (q) => res.classes.findIndex((c) => c.includes(q));
      const m = { sigma: d.sigma, start: cOf(0), acc: new Set(), t: res.classes.map((c) => Object.fromEntries(d.sigma.map((x) => [x, cOf(d.t[c[0]][x])]))) };
      res.classes.forEach((c, i) => { if (d.acc.has(c[0])) m.acc.add(i); });
      draw(minSvg, res.classes.map((c, i) => ({ label: c.map((q) => d.names[q]).join(""), accept: m.acc.has(i) })), edgesOf(m), m.start);
      out(root, "classes", `${res.classes.length} states (from ${n})`);
    } else {
      minSvg.replaceChildren();
      minSvg.setAttribute("viewBox", "0 0 300 60");
      minSvg.setAttribute("width", "300");
      stext(minSvg, 150, 32, "appears when no pair is left to mark", { style: "fill:var(--muted-foreground)" });
      out(root, "classes", "—");
    }
  }
  stepper(root, {
    reset: () => { step = 0; render(); },
    back: () => { step = Math.max(0, step - 1); render(); },
    step: () => { step = Math.min(last(), step + 1); render(); },
    run: () => { step = last(); render(); },
  });
  onSeg(root, load);
  load("a");
}

// ------------------------------------------------------------ pumping lemma

const LANGS = {
  anbn: { name: "aⁿbⁿ", test: (w) => /^a*b*$/.test(w) && w.split("a").length - 1 === w.length / 2, suggest: (p) => "a".repeat(p) + "b".repeat(p), alpha: /^[ab]*$/ },
  pal: { name: "palindromes over {a, b}", test: (w) => w === [...w].reverse().join(""), suggest: (p) => "a".repeat(p) + "b" + "a".repeat(p), alpha: /^[ab]*$/ },
  sq: { name: "a^(n²)", test: (w) => /^a*$/.test(w) && Number.isInteger(Math.sqrt(w.length)), suggest: (p) => "a".repeat(p * p), alpha: /^a*$/ },
  abstar: { name: "(ab)*", test: (w) => /^(ab)*$/.test(w), suggest: (p) => "ab".repeat(p), alpha: /^[ab]*$/, regular: true },
};
const I_MAX = 6;

/** Every legal split of s for pumping length p, with the first i in 0..6
 *  (if any) that pumps it out of the language. */
export function pumpSplits(s, p, inL) {
  const out = [];
  for (let j = 1; j <= Math.min(p, s.length); j++) for (let i = 0; i < j; i++) {
    const x = s.slice(0, i), y = s.slice(i, j), z = s.slice(j);
    let breaks = -1;
    for (let k = 0; k <= I_MAX && breaks < 0; k++) if (!inL(x + y.repeat(k) + z)) breaks = k;
    out.push({ x, y, z, breaks });
  }
  return out;
}

for (const root of document.querySelectorAll("[data-toc-pump]")) {
  const sIn = root.querySelector('[data-in="s"]');
  const splitEl = root.querySelector("[data-split]");
  let lang = "anbn", p = 4, splits = [], cur = 0, iVal = 2;
  const scr = scrubAll(root, () => { iVal = scr.i.get(); showSplit(); });

  function evaluate() {
    const L = LANGS[lang], s = sIn.value.trim();
    out(root, "claim", `Adversary: “${L.name} is regular, and every string in it of length ≥ ${p} can be pumped.”`);
    out(root, "p", String(p));
    splits = [];
    const v = root.querySelector('[data-out="verdict"]');
    const fail = (m) => {
      msg(root, m, "bad");
      sIn.toggleAttribute("data-bad", true);
      splitEl.replaceChildren();
      out(root, "pumped", ""); out(root, "which", ""); out(root, "nsplits", "—"); out(root, "survive", "—");
      v.textContent = "pick a valid string"; verdictClass(v, null);
    };
    if (!L.alpha.test(s)) return fail(`Use only the letters of the alphabet (${lang === "sq" ? "a" : "a, b"}).`);
    if (!L.test(s)) return fail(`“${s || "ε"}” is not in ${L.name}. The string must be in the language.`);
    if (s.length < p) return fail(`|s| = ${s.length} is shorter than p = ${p}. The lemma only speaks about strings of length ≥ p.`);
    sIn.removeAttribute("data-bad");
    splits = pumpSplits(s, p, L.test);
    const surv = splits.filter((x) => x.breaks < 0);
    // The adversary plays its best split: a surviving one if it has any.
    cur = Math.max(0, splits.findIndex((x) => x.breaks < 0));
    out(root, "nsplits", String(splits.length));
    out(root, "survive", String(surv.length));
    if (surv.length) {
      v.textContent = L.regular ? "adversary wins, as the lemma promises" : "adversary wins: try another string";
      verdictClass(v, false);
      msg(root, `The split below survives every i from 0 to ${I_MAX}.`);
    } else {
      v.textContent = "you win for this p";
      verdictClass(v, true);
      msg(root, `Every one of the ${splits.length} splits breaks for some i, so ${L.name} cannot be regular with p = ${p}. Your choice of string works for any p: that is the proof.`, "good");
    }
    showSplit();
  }

  function showSplit() {
    const sp = splits[cur];
    if (!sp) return;
    const L = LANGS[lang];
    const cell = (c, cls) => h("span", { class: "grid h-7 min-w-6 place-items-center rounded border px-1 " + cls, text: c });
    const group = (str, cls, tag) => str.length ? h("span", { class: "flex items-center gap-1" }, h("span", { class: "font-mono text-[10px] text-muted-foreground", text: tag }), ...[...str].map((c) => cell(c, cls))) : null;
    splitEl.replaceChildren(...[group(sp.x, "text-muted-foreground", "x"), group(sp.y, "border-brand bg-brand/10 text-brand", "y"), group(sp.z, "", "z")].filter(Boolean));
    const w = sp.x + sp.y.repeat(iVal) + sp.z, ok = L.test(w);
    const pe = root.querySelector('[data-out="pumped"]');
    pe.textContent = `xy${toSup(iVal)}z = ${w.length > 60 ? w.slice(0, 57) + "…" : w || "ε"}  (${w.length})  ${ok ? "✓ in" : "✗ not in"} the language`;
    pe.className = "min-w-0 font-mono text-sm break-all " + (ok ? "text-add" : "text-del");
    out(root, "which", `split ${cur + 1} of ${splits.length}: |x| = ${sp.x.length}, |y| = ${sp.y.length} · ${sp.breaks < 0 ? `survives i = 0…${I_MAX}` : `breaks at i = ${sp.breaks}`}`);
  }
  const toSup = (n) => String(n).replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c]);

  root.querySelector('[data-act="prev"]').addEventListener("click", () => { if (splits.length) { cur = (cur - 1 + splits.length) % splits.length; showSplit(); } });
  root.querySelector('[data-act="next"]').addEventListener("click", () => { if (splits.length) { cur = (cur + 1) % splits.length; showSplit(); } });
  root.querySelector('[data-act="newp"]').addEventListener("click", () => {
    let q;
    do q = 3 + Math.floor(Math.random() * 5); while (q === p);
    p = q;
    evaluate();
  });
  root.querySelector('[data-act="suggest"]').addEventListener("click", () => { sIn.value = LANGS[lang].suggest(p); evaluate(); });
  onSeg(root, (v) => { lang = v; sIn.value = LANGS[lang].suggest(p); evaluate(); });
  onInput(sIn, evaluate, 120);
  evaluate();
}

// ------------------------------------------------------------ halting

for (const root of document.querySelectorAll("[data-toc-halt]")) {
  const grid = root.querySelector("[data-grid]");
  const N = 6;
  let cells, checked = new Set(), picked = -1;
  const shuffle = () => {
    cells = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() < 0.55));
    checked = new Set(); picked = -1;
    msg(root, "");
    render();
  };
  const mark = (halts) => (halts ? "halts" : "loops");
  const cellCls = "grid h-8 w-11 place-items-center sm:w-14 rounded-md border text-[11px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50";

  function render() {
    const D = cells.map((row, i) => !row[i]);
    grid.replaceChildren(
      h("thead", {}, h("tr", {}, h("th", { class: "px-1 pb-1 text-left font-normal text-muted-foreground", text: "program ↓  input →" }),
        ...cells.map((_, j) => h("th", { class: "px-1 pb-1 font-normal text-muted-foreground", text: String(j) })))),
      h("tbody", {},
        ...cells.map((row, i) => h("tr", {},
          h("th", { class: "px-1 py-0.5 text-left font-normal" }, rowBtn(i)),
          ...row.map((halts, j) => {
            const diag = i === j, hit = picked === i && diag;
            const b = h("button", {
              class: cellCls + " " + (hit ? "border-del bg-[color-mix(in_oklab,var(--code-del)_16%,transparent)] text-del" : diag ? "border-brand bg-brand/10 text-brand" : "bg-background text-muted-foreground hover:text-foreground"),
              text: mark(halts), attrs: { type: "button", "aria-label": `Program ${i} on input ${j}: ${mark(halts)}. Toggle.` },
            });
            b.addEventListener("click", () => { cells[i][j] = !cells[i][j]; checked = new Set(); picked = -1; msg(root, ""); render(); });
            return h("td", { class: "p-0.5" }, b);
          }))),
        h("tr", {}, h("th", { class: "px-1 pt-3 text-left font-medium text-brand", text: "D" }),
          ...D.map((halts, j) => h("td", { class: "p-0.5 pt-3" }, h("span", { class: cellCls + " border-dashed " + (picked === j ? "border-del text-del" : "border-brand text-brand"), text: mark(halts) })))),
      ),
    );
    out(root, "checked", `${checked.size} of ${N}`);
    const f = root.querySelector('[data-out="found"]');
    f.textContent = checked.size === N ? "no: D differs from every row" : checked.size ? "not so far" : "—";
    verdictClass(f, checked.size === N ? true : null);
  }
  function rowBtn(i) {
    const b = h("button", {
      class: "rounded-md border px-2 py-1 text-[11px] outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 " + (picked === i ? "border-brand text-brand" : checked.has(i) ? "text-muted-foreground" : ""),
      text: `P${i}${checked.has(i) ? " ≠ D" : ""}`, attrs: { type: "button", "aria-label": `Is D the same as program ${i}?` },
    });
    b.addEventListener("click", () => {
      picked = i; checked.add(i);
      msg(root, `D ≠ P${i}: on input ${i}, P${i} ${mark(cells[i][i])} and D ${mark(!cells[i][i])}, by construction.`);
      render();
      grid.querySelectorAll("tbody th button")[i]?.focus();
    });
    return b;
  }
  root.querySelector('[data-act="shuffle"]').addEventListener("click", shuffle);
  shuffle();
}

// ------------------------------------------------------------ Chomsky hierarchy

const LEVELS = [
  { id: "reg", name: "Regular", type: "Type 3", grammar: "A → aB | a | ε", machine: "Finite automaton (DFA = NFA)", closed: "union, concatenation, star, intersection, complement", decide: "membership, emptiness, equivalence all decidable", ex: "(ab)*, binary multiples of 3" },
  { id: "cf", name: "Context-free", type: "Type 2", grammar: "A → γ (any string)", machine: "Nondeterministic pushdown automaton", closed: "union, concatenation, star; not intersection or complement", decide: "membership and emptiness decidable; equivalence undecidable", ex: "aⁿbⁿ, balanced brackets, palindromes" },
  { id: "cs", name: "Context-sensitive", type: "Type 1", grammar: "αAβ → αγβ, γ non-empty", machine: "Linear bounded automaton (tape as long as the input)", closed: "union, intersection, complement (Immerman–Szelepcsényi, 1987–88)", decide: "membership decidable (PSPACE-complete in general); emptiness undecidable", ex: "aⁿbⁿcⁿ, ww, aᵖ for prime p" },
  { id: "re", name: "Recursively enumerable", type: "Type 0", grammar: "α → β, unrestricted", machine: "Turing machine", closed: "union, intersection, star; not complement", decide: "membership only semi-decidable: a yes is eventually confirmed, a no may run forever. The decidable languages sit between context-sensitive and RE.", ex: "the halting set" },
  { id: "out", name: "Not RE", type: "beyond", grammar: "no grammar", machine: "no Turing machine recognises it", closed: "", decide: "Most languages are here: there are countably many machines and uncountably many languages.", ex: "the complement of the halting set" },
];
const QUIZ = [
  ["(ab)*", "reg", "A two-state DFA recognises it."],
  ["aⁿbⁿ", "cf", "S → aSb | ε generates it; the pumping lemma shows no DFA can."],
  ["aⁿbⁿcⁿ", "cs", "Not context-free (pumping lemma for CFLs); an LBA checks the three counts."],
  ["binary numbers divisible by 3", "reg", "A three-state DFA tracks the remainder."],
  ["balanced brackets ( ) [ ]", "cf", "A PDA pushes on opening brackets and pops on closing ones; it needs unbounded memory."],
  ["ww (a string written twice)", "cs", "Not context-free, though its cousin wwᴿ is."],
  ["⟨M, x⟩ such that M halts on x", "re", "Run M on x and accept if it halts: recognisable, never decidable (Turing, 1936)."],
  ["palindromes over {a, b}", "cf", "S → aSa | bSb | a | b | ε."],
  ["⟨M, x⟩ such that M never halts on x", "out", "If both it and the halting set were recognisable, halting would be decidable."],
  ["aᵖ with p prime", "cs", "An LBA can test primality in the space of its input; the pumping lemma rules out context-free."],
];

for (const root of document.querySelectorAll("[data-toc-chomsky]")) {
  const svg = root.querySelector("[data-map]");
  const levelsEl = root.querySelector("[data-levels]");
  const detail = root.querySelector("[data-detail]");
  const answers = root.querySelector("[data-answers]");
  let sel = "reg", q = 0, right = 0, tried = 0, marker = null;
  const rects = { out: [6, 6, 548, 348], re: [24, 34, 512, 306], cs: [58, 98, 444, 222], cf: [94, 150, 372, 158], reg: [134, 202, 292, 94] };
  const labels = { out: "all languages", re: "recursively enumerable · Turing machines", cs: "context-sensitive · linear bounded automata", cf: "context-free · pushdown automata", reg: "regular · finite automata" };

  function draw() {
    svg.replaceChildren();
    for (const id of ["out", "re", "cs", "cf", "reg"]) {
      const [x, y, w, hh] = rects[id], on = id === sel;
      const r = s("rect", { x, y, width: w, height: hh, rx: 16, style: `fill:${on ? "color-mix(in oklab, var(--brand) 10%, var(--code-bg))" : "var(--code-bg)"};stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.35};stroke-width:${on ? 2 : 1};cursor:pointer;transition:fill .15s,stroke .15s` }, svg);
      r.addEventListener("click", (e) => { e.stopPropagation(); pick(id); });
      stext(svg, x + 14, y + 20, labels[id], { "text-anchor": "start", style: `fill:${on ? "var(--brand)" : "var(--muted-foreground)"};pointer-events:none` });
    }
    // Decidable languages: between CS and RE.
    s("rect", { x: 40, y: 64, width: 480, height: 266, rx: 14, style: "fill:none;stroke:currentColor;stroke-opacity:.35;stroke-dasharray:4 4;pointer-events:none" }, svg);
    stext(svg, 506, 78, "decidable", { "text-anchor": "end", style: "fill:var(--muted-foreground);pointer-events:none" });
    if (marker) {
      const [x, y, w, hh] = rects[marker.lvl];
      const cx = x + w - 24, cy = y + hh - 18;
      s("circle", { cx, cy, r: 6, style: `fill:${marker.ok ? "var(--code-add)" : "var(--code-del)"}` }, svg);
    }
  }
  function pick(id) {
    sel = id;
    const L = LEVELS.find((l) => l.id === id);
    detail.replaceChildren(
      h("p", { class: "font-medium text-sm sm:col-span-2", text: `${L.name} · ${L.type}` }),
      ...[["Grammar", L.grammar], ["Machine", L.machine], ["Closed under", L.closed], ["Decision problems", L.decide], ["Examples", L.ex]].filter(([, v]) => v).map(([k, v]) =>
        h("p", {}, h("span", { class: "text-muted-foreground", text: k + ": " }), v)),
    );
    levelsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lvl === id)));
    draw();
  }
  levelsEl.replaceChildren(...LEVELS.map((L) => {
    const b = h("button", { class: "rounded-md px-2.5 py-1 text-left text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground", text: `${L.type} · ${L.name}`, attrs: { type: "button", "data-lvl": L.id } });
    b.addEventListener("click", () => pick(L.id));
    return b;
  }));
  function ask() {
    const [lang] = QUIZ[q % QUIZ.length];
    out(root, "lang", lang);
    answers.replaceChildren(...LEVELS.map((L) => {
      const b = h("button", { class: "rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50", text: L.name, attrs: { type: "button" } });
      b.addEventListener("click", () => answer(L.id));
      return b;
    }));
  }
  function answer(id) {
    const [lang, truth, why] = QUIZ[q % QUIZ.length];
    tried++;
    const ok = id === truth;
    if (ok) right++;
    const T = LEVELS.find((l) => l.id === truth);
    msg(root, `${ok ? "Right" : "Not quite"}: ${lang} is ${T.id === "out" ? "not even recursively enumerable" : T.name.toLowerCase()}. ${why}`, ok ? "good" : "bad");
    out(root, "score", `${right} / ${tried}`);
    marker = { lvl: truth, ok };
    q++;
    pick(truth);
    ask();
  }
  pick("reg");
  ask();
}
