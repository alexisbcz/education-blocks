// Theory of computation, part two: machines with memory. A deterministic
// pushdown automaton, a Turing machine with editable rules, and the busy
// beaver champions run to completion (BB(5) in chunks, off the critical
// path of the page).

import { h, msg, out, onInput, stepper, presets, show } from "./plt-ui.js";

const onSeg = (root, fn) => root.querySelectorAll("[role=tablist]").forEach((t) => t.addEventListener("seg-change", (e) => fn(e.detail.value, t)));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const setVerdict = (root, text, ok) => {
  const el = root.querySelector('[data-out="verdict"], [data-out="output"]');
  out(root, el?.dataset.out, text);
  if (el) el.className = "tabular-nums " + (ok === null ? "" : ok ? "text-add" : "text-del");
};
const tapeCell = (c, cls = "") => h("span", { class: "grid h-8 min-w-7 place-items-center rounded-md border px-1 transition-colors duration-150 " + cls, text: c });

// ------------------------------------------------------------ PDA

// Rules: [state, read, top, push, next]. read "" means end of input (an
// ε-move taken only once the input is used up). top "X" matches any symbol
// and push may mention X to put it back. "$" marks the stack's bottom.
const PDAS = {
  brackets: {
    start: "q", input: "([()])()", alpha: /^[()[\]]*$/,
    rules: [["q", "(", "X", "(X", "q"], ["q", "[", "X", "[X", "q"], ["q", ")", "(", "", "q"], ["q", "]", "[", "", "q"], ["q", "", "$", "$", "accept"]],
  },
  anbn: {
    start: "p", input: "aaabbb", alpha: /^[ab]*$/,
    rules: [["p", "a", "X", "aX", "p"], ["p", "b", "a", "", "q"], ["q", "b", "a", "", "q"], ["p", "", "$", "$", "accept"], ["q", "", "$", "$", "accept"]],
  },
  wcw: {
    start: "p", input: "abbcbba", alpha: /^[abc]*$/,
    rules: [["p", "a", "X", "aX", "p"], ["p", "b", "X", "bX", "p"], ["p", "c", "X", "X", "q"], ["q", "a", "a", "", "q"], ["q", "b", "b", "", "q"], ["q", "", "$", "$", "accept"]],
  },
};

/** Runs a deterministic PDA; returns every configuration and the verdict. */
export function runPDA(m, w) {
  let state = m.start, stack = ["$"], pos = 0;
  const trace = [{ state, stack: [...stack], pos, rule: -1 }];
  for (;;) {
    const top = stack.at(-1), c = pos < w.length ? w[pos] : "";
    const k = m.rules.findIndex(([q, r, t]) => q === state && r === c && (t === "X" || t === top));
    if (k < 0) return { trace, ok: false, why: c ? `no rule for ${state} reading ${c} with ${top} on top` : `input used up in ${state} with ${top} on top` };
    const [, , t, push, next] = m.rules[k];
    stack.pop();
    // Push the replacement string so that its first symbol ends on top.
    for (const s of [...push.replace("X", top)].reverse()) stack.push(s);
    if (c) pos++;
    state = next;
    trace.push({ state, stack: [...stack], pos, rule: k, read: c || "ε" });
    if (state === "accept") return { trace, ok: true };
    if (stack.length > 400) return { trace, ok: false, why: "stack too deep" };
  }
}

for (const root of document.querySelectorAll("[data-toc-pda]")) {
  const strIn = root.querySelector('[data-in="str"]');
  const tape = root.querySelector("[data-tape]"), stackEl = root.querySelector("[data-stack]"), rulesEl = root.querySelector("[data-rules]");
  let m = PDAS.brackets, res, step = 0;

  function compile() {
    const w = strIn.value.trim();
    if (!m.alpha.test(w)) {
      strIn.toggleAttribute("data-bad", true);
      msg(root, "That machine reads only " + (m === PDAS.brackets ? "( ) [ ]" : m === PDAS.anbn ? "a and b" : "a, b and one c"), "bad");
      res = null;
      return;
    }
    strIn.removeAttribute("data-bad");
    res = runPDA(m, w);
    step = 0;
    render();
  }
  function render() {
    if (!res) return;
    const w = strIn.value.trim(), cfg = res.trace[step], done = step === res.trace.length - 1;
    tape.replaceChildren(...[...w].map((c, i) => tapeCell(c, i < cfg.pos ? "text-muted-foreground opacity-60" : i === cfg.pos ? "border-brand bg-brand/10 text-brand" : "")),
      tapeCell("⊣", cfg.pos === w.length ? "border-brand text-brand" : "text-muted-foreground"));
    stackEl.replaceChildren(...[...cfg.stack].reverse().map((c, i) => h("span", {
      class: "grid h-8 min-w-10 place-items-center rounded-md border px-2 " + (i === 0 ? "border-brand bg-brand/10 text-brand" : c === "$" ? "text-muted-foreground" : ""),
      text: c, attrs: i === 0 ? { title: "top" } : {},
    })));
    rulesEl.replaceChildren(
      h("thead", {}, h("tr", { class: "border-b text-muted-foreground" }, ...["state", "read", "pop", "push", "next"].map((t) => h("th", { class: "px-2 py-1 text-left font-normal", text: t })))),
      h("tbody", {}, ...m.rules.map((r, k) => h("tr", { class: "border-b last:border-b-0 transition-colors duration-150 " + (cfg.rule === k ? "bg-brand/10 text-brand" : "") },
        ...[r[0], r[1] || "end", r[2] === "X" ? "any X" : r[2], r[3] || "ε", r[4]].map((t) => h("td", { class: "px-2 py-1", text: t }))))),
    );
    out(root, "state", cfg.state);
    out(root, "read", step ? cfg.read : "—");
    out(root, "depth", String(cfg.stack.length - 1));
    if (done) {
      setVerdict(root, res.ok ? "accepted" : "rejected", res.ok);
      msg(root, res.ok ? `Accepted in ${step} moves: the stack is back to its bottom marker.` : `Rejected: ${res.why}.`, res.ok ? "good" : "bad");
    } else {
      setVerdict(root, "reading…", null);
      msg(root, step ? `Move ${step}: read ${cfg.read}, top is now ${cfg.stack.at(-1)}.` : "Step to read the first symbol.");
    }
  }
  stepper(root, {
    reset: () => { step = 0; render(); },
    back: () => { step = Math.max(0, step - 1); render(); },
    step: () => { if (res) { step = Math.min(res.trace.length - 1, step + 1); render(); } },
    run: () => { if (res) { step = res.trace.length - 1; render(); } },
  });
  onSeg(root, (v) => { m = PDAS[v]; strIn.value = m.input; compile(); });
  onInput(strIn, compile, 100);
  compile();
}

// ------------------------------------------------------------ Turing machine

const TM_PRESETS = [
  ["binary +1", "1011", `# Walk to the right end, then add 1 with carry.
right 0 0 R right
right 1 1 R right
right _ _ L carry
carry 1 0 L carry
carry 0 1 L halt
carry _ 1 L halt`],
  ["unary a+b", "111+11", `# Turn + into 1, then erase the last 1.
start 1 1 R start
start + 1 R end
end 1 1 R end
end _ _ L erase
erase 1 _ L halt`],
  ["palindrome", "abbba", `# Erase the first letter, remember it, check the last.
start a _ R hasA
start b _ R hasB
start _ _ R accept
hasA a a R hasA
hasA b b R hasA
hasA _ _ L lastA
hasB a a R hasB
hasB b b R hasB
hasB _ _ L lastB
lastA a _ L back
lastA _ _ R accept
lastA b b R reject
lastB b _ L back
lastB _ _ R accept
lastB a a R reject
back a a L back
back b b L back
back _ _ R start`],
  ["aⁿbⁿcⁿ", "aabbcc", `# Cross off one a, one b, one c per pass. No PDA can do this.
q0 a X R q1
q0 Y Y R q4
q0 _ _ R accept
q1 a a R q1
q1 Y Y R q1
q1 b Y R q2
q2 b b R q2
q2 Z Z R q2
q2 c Z L q3
q3 a a L q3
q3 b b L q3
q3 Y Y L q3
q3 Z Z L q3
q3 X X R q0
q4 Y Y R q4
q4 Z Z R q5
q5 Z Z R q5
q5 _ _ L accept`],
];

/** Parses "state read write move next" lines; # starts a comment. */
export function parseTM(src) {
  const rules = new Map(), errors = [];
  let first = null;
  src.split("\n").forEach((line, i) => {
    const t = line.replace(/#.*/, "").trim();
    if (!t) return;
    const f = t.split(/\s+/);
    if (f.length !== 5) return errors.push(`line ${i + 1}: expected 5 fields`);
    const [q, r, w, mv, nx] = f;
    if (!/^[LRS]$/i.test(mv)) return errors.push(`line ${i + 1}: move must be L, R or S`);
    if (r.length !== 1 || w.length !== 1) return errors.push(`line ${i + 1}: symbols are single characters`);
    if (rules.has(q + " " + r)) return errors.push(`line ${i + 1}: a second rule for ${q} reading ${r}`);
    first ??= q;
    rules.set(q + " " + r, { w, d: { L: -1, R: 1, S: 0 }[mv.toUpperCase()], next: nx, line: i });
  });
  return { rules, start: first, errors };
}

const TM_BUDGET = 100_000;

for (const root of document.querySelectorAll("[data-toc-tm]")) {
  const src = root.querySelector('[data-in="rules"]'), inp = root.querySelector('[data-in="input"]');
  const tape = root.querySelector("[data-tape]"), traceEl = root.querySelector("[data-trace]");
  let M, cells, head, state, steps, undo, halted;

  function load() {
    M = parseTM(src.value);
    src.toggleAttribute("data-bad", M.errors.length > 0);
    cells = new Map([...inp.value.replace(/\s/g, "")].map((c, i) => [i, c]));
    head = 0; state = M.start; steps = 0; undo = []; halted = false;
    if (M.errors.length) msg(root, M.errors[0], "bad");
    else if (!M.start) msg(root, "Write at least one rule.", "bad");
    else msg(root, `Starts in ${M.start} with the head on the first cell.`);
    render();
  }
  const sym = (i) => cells.get(i) ?? "_";
  function step1() {
    if (halted || !state) return false;
    const r = M.rules.get(state + " " + sym(head));
    if (!r) { halted = true; return false; }
    undo.push({ head, state, sym: sym(head), line: r.line });
    if (r.w === "_") cells.delete(head); else cells.set(head, r.w);
    head += r.d; state = r.next; steps++;
    return true;
  }
  function back() {
    const u = undo.pop();
    if (!u) return;
    if (u.sym === "_") cells.delete(u.head); else cells.set(u.head, u.sym);
    head = u.head; state = u.state; steps--; halted = false;
  }
  function render() {
    const keys = [...cells.keys(), head];
    const lo = Math.min(...keys) - 2, hi = Math.max(Math.max(...keys) + 2, lo + 14);
    const view = [];
    for (let i = lo; i <= hi; i++) view.push(tapeCell(show(sym(i) === "_" ? "·" : sym(i)), i === head ? "border-brand bg-brand/10 text-brand" : sym(i) === "_" ? "text-muted-foreground opacity-50" : ""));
    tape.replaceChildren(...view);
    tape.children[head - lo]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    traceEl.parentElement.hidden = !undo.length;
    traceEl.replaceChildren(h("tbody", {}, ...undo.slice(-6).map((u, k, a) => h("tr", { class: "border-b last:border-b-0 " + (k === a.length - 1 ? "text-brand" : "text-muted-foreground") },
      h("td", { class: "px-2 py-0.5", text: String(steps - a.length + k + 1) }),
      h("td", { class: "px-2 py-0.5", text: src.value.split("\n")[u.line].replace(/#.*/, "").trim() })))));
    // Highlight is cheap; the next rule is shown in the readout instead.
    const r = state && M.rules.get(state + " " + sym(head));
    if (!r && state && !M.errors.length) halted = true;
    out(root, "state", state ?? "—");
    out(root, "steps", steps.toLocaleString("en"));
    out(root, "head", String(head));
    const tapeStr = [...cells.keys()].length ? (() => { const ks = [...cells.keys()]; let s = ""; for (let i = Math.min(...ks); i <= Math.max(...ks); i++) s += sym(i); return s.replace(/^_+|_+$/g, ""); })() : "";
    if (halted) {
      const ok = state === "accept" ? true : state === "reject" ? false : null;
      setVerdict(root, `${ok === null ? "halted" : state === "accept" ? "accepted" : "rejected"} · tape ${tapeStr || "blank"}`, ok);
      if (!M.errors.length) msg(root, `Halted after ${steps.toLocaleString("en")} steps in ${state}${state === "accept" || state === "reject" || state === "halt" ? "" : ` (no rule for ${state} reading ${sym(head)})`}.`, ok === false ? "bad" : "good");
    } else setVerdict(root, `running · tape ${tapeStr || "blank"}`, null);
  }
  stepper(root, {
    reset: load,
    back: () => { back(); msg(root, `Back to step ${steps}.`); render(); },
    step: () => { step1(); render(); },
    run: () => {
      let n = 0;
      while (n < TM_BUDGET && step1()) n++;
      render();
      if (n >= TM_BUDGET && !halted) msg(root, `Still running after ${TM_BUDGET.toLocaleString("en")} more steps. It may never halt; no program can tell you in general.`, "bad");
    },
  });
  presets(root.querySelector("[data-presets]"), TM_PRESETS.map(([label, input, rules]) => [label, { input, rules }]), (p) => { src.value = p.rules; inp.value = p.input; load(); });
  onInput(src, load, 250);
  onInput(inp, load, 150);
  src.value = TM_PRESETS[0][2];
  load();
}

// ------------------------------------------------------------ busy beavers

const CHAMPIONS = {
  2: { tm: "1RB1LB_1LA1RZ", steps: 6, ones: 4, record: "S(2) = 6, Σ(2) = 4" },
  3: { tm: "1RB1RZ_1LB0RC_1LC1LA", steps: 21, ones: 5, record: "S(3) = 21 (Σ(3) = 6 is reached by another machine)" },
  4: { tm: "1RB1LB_1LA0LC_1RZ1LD_1RD0RA", steps: 107, ones: 13, record: "S(4) = 107, Σ(4) = 13" },
  5: { tm: "1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RZ0LA", steps: 47_176_870, ones: 4098, record: "S(5) = 47,176,870, Σ(5) = 4,098" },
};

/** "1RB1LB_1LA1RZ" → per state, per symbol: {w, d, n}; n = -1 halts. */
export function parseStd(s) {
  return s.split("_").map((st) => [0, 1].map((r) => {
    const t = st.slice(r * 3, r * 3 + 3);
    return { w: +t[0], d: t[1] === "R" ? 1 : -1, n: t[2] === "Z" ? -1 : t.charCodeAt(2) - 65 };
  }));
}

/** A tape machine on a growable typed array, stepped in batches. */
export function beaver(std) {
  const M = parseStd(std);
  let size = 1 << 12, tape = new Uint8Array(size), off = size >> 1;
  const m = { q: 0, head: 0, steps: 0, ones: 0, lo: 0, hi: 0, last: null };
  const grow = () => {
    const t = new Uint8Array(size * 2);
    t.set(tape, size >> 1);
    off += size >> 1; size *= 2; tape = t;
  };
  m.read = (i) => (i + off >= 0 && i + off < size ? tape[i + off] : 0);
  m.run = (budget) => {
    let { q, head, steps, ones, lo, hi } = m;
    let last = m.last;
    for (let k = 0; k < budget && q >= 0; k++) {
      if (head + off < 0 || head + off >= size) grow();
      const p = head + off, r = tape[p], t = M[q][r];
      ones += t.w - r;
      tape[p] = t.w;
      last = [q, r];
      head += t.d; q = t.n; steps++;
      if (head < lo) lo = head;
      if (head > hi) hi = head;
    }
    Object.assign(m, { q, head, steps, ones, lo, hi, last });
    return q < 0;
  };
  return m;
}

const resolveColor = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d", { willReadFrequently: true });
  return (css) => { x.clearRect(0, 0, 1, 1); x.fillStyle = css; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; };
})();

for (const root of document.querySelectorAll("[data-toc-bb]")) {
  const canvas = root.querySelector("[data-canvas]"), ctx = canvas.getContext("2d");
  const table = root.querySelector("[data-table]");
  const play = root.querySelector('[data-action="play"]');
  const W = canvas.width, H = canvas.height;
  let n = 2, m, rows, raf = 0, timer = 0, running = false, gen = 0;

  const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();
  function load(k, fromStart = false) {
    stop();
    gen++;
    n = Number(k);
    m = beaver(CHAMPIONS[n].tm);
    rows = [snapshot()];
    // The small champions halt at once: show the whole run, Run replays it.
    if (n < 5 && !fromStart) while (m.q >= 0) { m.run(1); rows.push(snapshot()); }
    drawTable();
    draw();
    setPlaying(false);
  }
  // A row is the tape between the extremes seen so far, plus the head.
  function snapshot() {
    const cellsArr = new Uint8Array(m.hi - m.lo + 1);
    for (let i = m.lo; i <= m.hi; i++) cellsArr[i - m.lo] = m.read(i);
    return { lo: m.lo, cells: cellsArr, head: m.head, step: m.steps };
  }
  function drawTable() {
    const M = parseStd(CHAMPIONS[n].tm);
    table.replaceChildren(
      h("thead", {}, h("tr", { class: "border-b text-muted-foreground" }, h("th", { class: "px-2 py-1 text-left font-normal", text: "state" }), h("th", { class: "px-2 py-1 font-normal", text: "read 0" }), h("th", { class: "px-2 py-1 font-normal", text: "read 1" }))),
      h("tbody", {}, ...M.map((row, q) => h("tr", { class: "border-b last:border-b-0" },
        h("td", { class: "px-2 py-1", text: String.fromCharCode(65 + q) }),
        ...row.map((t, r) => h("td", { class: "px-2 py-1 text-center transition-colors duration-150", attrs: { "data-rule": `${q}${r}` }, text: `${t.w}${t.d > 0 ? "R" : "L"}${t.n < 0 ? "Z" : String.fromCharCode(65 + t.n)}` }))))),
    );
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const fg = resolveColor(css("--foreground")), brand = resolveColor(css("--brand"));
    const lo = Math.min(...rows.map((r) => r.lo)), hi = Math.max(...rows.map((r) => r.lo + r.cells.length - 1));
    const cols = hi - lo + 1;
    if (n < 5) {
      const total = CHAMPIONS[n].steps + 1;
      const cw = Math.max(1, Math.min(Math.floor(W / cols), 28)), ch = Math.max(1, Math.min(Math.floor(H / total), 28));
      const x0 = Math.floor((W - cw * cols) / 2), gx = cw > 3 ? 0.5 : 0, gy = ch > 3 ? 0.5 : 0;
      rows.forEach((r, y) => {
        r.cells.forEach((v, i) => {
          const x = x0 + (r.lo - lo + i) * cw;
          ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${v ? 0.85 : 0.07})`;
          ctx.fillRect(x + gx, y * ch + gy, cw - 2 * gx, ch - 2 * gy);
        });
        ctx.fillStyle = `rgb(${brand[0]},${brand[1]},${brand[2]})`;
        const hx = x0 + (r.head - lo) * cw;
        ctx.fillRect(hx + cw * 0.3, y * ch + ch * 0.3, Math.max(1, cw * 0.4), Math.max(1, ch * 0.4));
      });
    } else {
      // Sampled rows, each squeezed to the canvas width by averaging.
      const img = ctx.createImageData(W, H);
      const rowsH = Math.max(1, Math.floor(H / Math.max(rows.length, 1)));
      rows.forEach((r, y) => {
        for (let x = 0; x < W; x++) {
          const a = Math.floor((x * cols) / W) + lo, b = Math.max(a + 1, Math.floor(((x + 1) * cols) / W) + lo);
          let sum = 0;
          for (let i = a; i < b; i++) { const j = i - r.lo; if (j >= 0 && j < r.cells.length) sum += r.cells[j]; }
          const dens = sum / (b - a);
          const isHead = r.head >= a && r.head < b;
          for (let yy = y * rowsH; yy < Math.min(H, (y + 1) * rowsH); yy++) {
            const p = (yy * W + x) * 4, c = isHead ? brand : fg;
            img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2];
            img.data[p + 3] = isHead ? 255 : Math.round(255 * (0.07 + 0.7 * dens));
          }
        }
      });
      ctx.putImageData(img, 0, 0);
    }
    out(root, "steps", m.steps.toLocaleString("en"));
    out(root, "ones", m.ones.toLocaleString("en"));
    out(root, "state", m.q < 0 ? "halted" : String.fromCharCode(65 + m.q));
    out(root, "record", CHAMPIONS[n].record);
    const done = m.q < 0;
    const cap = root.querySelector('[data-out="caption"]');
    cap.textContent = `${CHAMPIONS[n].tm} · ${n < 5 ? "one row per step" : `${rows.length} sampled rows, ${cols.toLocaleString("en")} cells wide`}${done ? ` · halted: ${m.steps.toLocaleString("en")} steps, ${m.ones.toLocaleString("en")} ones ${m.steps === CHAMPIONS[n].steps && m.ones === CHAMPIONS[n].ones ? "✓ matches the record" : "✗"}` : ""}`;
    table.querySelectorAll("[data-rule]").forEach((td) => td.classList.toggle("text-brand", !!m.last && td.dataset.rule === `${m.last[0]}${m.last[1]}`));
  }
  function setPlaying(on) {
    running = on;
    play.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    play.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    play.querySelector("[data-label]").textContent = on ? "Pause" : m?.q < 0 ? "Replay" : "Run";
  }
  function stop() { cancelAnimationFrame(raf); clearTimeout(timer); setPlaying(false); }
  function start() {
    if (m.q < 0 || (n < 5 && m.steps === 0)) load(n, true);
    setPlaying(true);
    const g = gen;
    if (n < 5) {
      const tick = () => {
        if (g !== gen || !running) return;
        const per = reduced() ? Infinity : Math.max(1, Math.ceil(CHAMPIONS[n].steps / 90));
        for (let k = 0; k < per && m.q >= 0; k++) { m.run(1); rows.push(snapshot()); }
        draw();
        if (m.q < 0) return setPlaying(false);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } else {
      const every = Math.ceil(CHAMPIONS[5].steps / (H / 1));
      const chunk = () => {
        if (g !== gen || !running) return;
        const t0 = performance.now();
        // About 12 ms of work per slice keeps the page responsive.
        while (performance.now() - t0 < 12 && m.q >= 0) {
          const nextRow = (Math.floor(m.steps / every) + 1) * every;
          m.run(Math.min(200_000, nextRow - m.steps));
          if (m.steps >= nextRow || m.q < 0) rows.push(snapshot());
        }
        draw();
        if (m.q < 0) return setPlaying(false);
        timer = setTimeout(chunk, 0);
      };
      chunk();
    }
  }
  play.addEventListener("click", () => (running ? stop() : start()));
  root.querySelector('[data-act="reset"]').addEventListener("click", () => load(n));
  onSeg(root, (v) => load(v));
  new MutationObserver(() => m && draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  load(2);
}
