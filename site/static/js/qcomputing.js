// Quantum computing blocks, all on the exact simulator in
// qcomputing-sim.js. Qubit 0 is the top wire and the leftmost ket digit.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { G, State, blochAmps, mulberry32, sample, ket, sub, cfmt, dirac, stateTable, expect, axisOp, phaseColor } from "./qcomputing-sim.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const DEG = Math.PI / 180;
const pct = (p, d = 1) => `${num(p * 100, d)}%`;
const fixed = (v, d = 4) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d).replace("-", "−");

// A small circuit drawing: wires, then gate glyphs at columns.
// gates: { c, q, label } | { c, ctrl:[..], tgt, kind: "x"|"z"|"swap"|"m" }
function drawCircuit(svg, n, gates, { x0 = 60, dx = 56, y0 = 24, dy = 40, cols = 8, labels, mark } = {}) {
  svg.replaceChildren();
  const W = x0 + cols * dx + 20;
  const H = y0 + (n - 1) * dy + 24;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const X = (c) => x0 + c * dx + dx / 2, Y = (q) => y0 + q * dy;
  if (mark !== undefined && mark !== null) {
    const [c0, c1] = Array.isArray(mark) ? mark : [mark, mark];
    el("rect", { x: X(c0) - dx / 2 + 2, y: 4, width: (c1 - c0 + 1) * dx - 4, height: H - 8, rx: 6, style: "fill:var(--brand);fill-opacity:0.08;stroke:var(--brand);stroke-opacity:0.4" }, svg);
  }
  for (let q = 0; q < n; q++) {
    el("line", { x1: x0 - 4, x2: W - 10, y1: Y(q), y2: Y(q), style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    text(svg, 6, Y(q) + 4, labels ? labels[q] : `q${sub(q)}`, { class: "fill-muted-foreground font-mono text-[11px]" });
  }
  for (const g of gates) {
    const x = X(g.c);
    if (g.label !== undefined) {
      el("rect", { x: x - 15, y: Y(g.q) - 13, width: 30, height: 26, rx: 4, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.7" }, svg);
      text(svg, x, Y(g.q) + 4, g.label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      continue;
    }
    const qs = [...g.ctrl, g.tgt];
    el("line", { x1: x, x2: x, y1: Y(Math.min(...qs)), y2: Y(Math.max(...qs)), style: "stroke:currentColor;stroke-opacity:0.7" }, svg);
    for (const c of g.ctrl) el("circle", { cx: x, cy: Y(c), r: 4.5, style: "fill:currentColor" }, svg);
    const y = Y(g.tgt);
    if (g.kind === "x") {
      el("circle", { cx: x, cy: y, r: 11, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.8" }, svg);
      el("path", { d: `M${x - 11} ${y}h22M${x} ${y - 11}v22`, style: "stroke:currentColor;stroke-opacity:0.8" }, svg);
    } else if (g.kind === "z") {
      el("circle", { cx: x, cy: y, r: 4.5, style: "fill:currentColor" }, svg);
    } else if (g.kind === "swap") {
      for (const yy of [Y(g.ctrl[0]), y]) el("path", { d: `M${x - 6} ${yy - 6}l12 12M${x + 6} ${yy - 6}l-12 12`, style: "stroke:currentColor;stroke-width:1.6" }, svg);
    } else if (g.kind === "phase") {
      el("rect", { x: x - 15, y: y - 13, width: 30, height: 26, rx: 4, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.7" }, svg);
      text(svg, x, y + 4, g.text, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    }
  }
  return { X, Y, W, H };
}

// A bar chart of signed real amplitudes (or probabilities).
function amplitudeBars(svg, values, { labels, lo = -1, hi = 1, highlight, mean, title } = {}) {
  svg.replaceChildren();
  const vb = svg.viewBox.baseVal;
  const f = frame(svg, { box: [40, 16, vb.width - 52, vb.height - 46], x: [0, values.length], y: [lo, hi], xticks: [], yticks: lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi], yfmt: (v) => fixed(v, 2) });
  if (title) text(svg, 4, 10, title);
  if (lo < 0) hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.35");
  const w = f.W / values.length;
  values.forEach((v, i) => {
    const y0 = f.sy(Math.max(0, Math.min(v, 0) === v ? v : 0));
    const top = f.sy(Math.max(v, 0)), bot = f.sy(Math.min(v, 0));
    el("rect", { x: f.L + i * w + w * 0.18, y: top, width: w * 0.64, height: Math.max(0.5, bot - top), rx: 2, style: `fill:${i === highlight ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${i === highlight ? 0.9 : 0.6}` }, svg);
    text(svg, f.L + i * w + w / 2, f.T + f.H + 14, labels[i], { "text-anchor": "middle" });
    void y0;
  });
  if (mean !== undefined) {
    hline(svg, f, mean, "stroke:var(--foreground);stroke-dasharray:4 3;stroke-opacity:0.7", "mean");
  }
  return f;
}

// ============================================================ Circuit composer

const ONE = new Set(["h", "x", "y", "z", "s", "t", "rx", "ry", "rz", "m"]);
const NEED = { cx: 2, cz: 2, swap: 2, ccx: 3 };

for (const root of document.querySelectorAll("[data-qc-circuit]")) {
  const svg = root.querySelector("[data-grid]");
  const hist = root.querySelector("[data-hist]");
  const stateBox = root.querySelector("[data-state]");
  const qasmBox = root.querySelector("[data-qasm]");
  const copy = root.querySelector("[data-copy]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  const COLS = 10;
  let n = 3, tool = "h", pending = [], gates = [], history = [], seed = 1;
  let shots = null;

  const snapshot = () => { history.push(JSON.stringify(gates)); if (history.length > 50) history.shift(); };
  const span = (g) => { const qs = g.qs; return [Math.min(...qs), Math.max(...qs)]; };
  const overlaps = (a, b) => a.c === b.c && !(span(a)[1] < span(b)[0] || span(b)[1] < span(a)[0]);

  function place(g) {
    snapshot();
    gates = gates.filter((x) => !overlaps(x, g));
    gates.push(g);
    pending = [];
    shots = null;
    update();
  }

  function onCell(q, c) {
    if (tool === "erase") {
      const before = gates.length;
      const kept = gates.filter((g) => !(g.c === c && q >= span(g)[0] && q <= span(g)[1]));
      if (kept.length !== before) { snapshot(); gates = kept; shots = null; update(); }
      return;
    }
    if (ONE.has(tool)) {
      const g = { type: tool, c, qs: [q] };
      if (tool.startsWith("r")) g.angle = s.angle.get();
      return place(g);
    }
    if (pending.length && pending[0].c !== c) pending = [];
    if (pending.some((p) => p.q === q)) return;
    pending.push({ q, c });
    if (pending.length === NEED[tool]) place({ type: tool, c, qs: pending.map((p) => p.q) });
    else { o.hint.textContent = hintFor(); draw(); }
  }

  const hintFor = () => {
    if (!pending.length) return { cx: "CNOT: click the control wire, then the target.", cz: "CZ: click two wires.", swap: "SWAP: click two wires.", ccx: "Toffoli: click two controls, then the target.", erase: "Click a gate to erase it." }[tool] ?? "Click a wire to place the gate.";
    const left = NEED[tool] - pending.length;
    return `Now click ${left === 1 ? (tool === "cx" || tool === "ccx" ? "the target" : "the second wire") : "the second control"} in column ${pending[0].c + 1}.`;
  };

  function simulate(rng) {
    const st = new State(n);
    const measured = new Map();
    const byCol = [...gates].sort((a, b) => a.c - b.c);
    for (const g of byCol) {
      const [q] = g.qs;
      switch (g.type) {
        case "rx": case "ry": case "rz": st.apply(q, G[g.type](g.angle * DEG)); break;
        case "m": if (rng) measured.set(q, st.measure(q, rng)); break;
        case "cx": st.apply(g.qs[1], G.x, [g.qs[0]]); break;
        case "cz": st.apply(g.qs[1], G.z, [g.qs[0]]); break;
        case "ccx": st.apply(g.qs[2], G.x, [g.qs[0], g.qs[1]]); break;
        case "swap": st.swap(g.qs[0], g.qs[1]); break;
        default: st.apply(q, G[g.type]);
      }
    }
    return st;
  }

  function qasm() {
    const lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', `qreg q[${n}];`, `creg c[${n}];`];
    const ang = (d) => { const r = d / 180; return r === 1 ? "pi" : r === -1 ? "-pi" : `${+r.toFixed(6)}*pi`; };
    for (const g of [...gates].sort((a, b) => a.c - b.c)) {
      const Q = g.qs.map((q) => `q[${q}]`);
      if (g.type === "m") lines.push(`measure ${Q[0]} -> c[${g.qs[0]}];`);
      else if (g.type.startsWith("r")) lines.push(`${g.type}(${ang(g.angle)}) ${Q[0]};`);
      else lines.push(`${g.type} ${Q.join(",")};`);
    }
    return lines.join("\n");
  }

  function draw() {
    const glyphs = gates.map((g) => {
      if (ONE.has(g.type)) return { c: g.c, q: g.qs[0], label: g.type === "m" ? "M" : g.type.length === 2 ? g.type[0].toUpperCase() + g.type[1] : g.type.toUpperCase() };
      if (g.type === "cx") return { c: g.c, ctrl: [g.qs[0]], tgt: g.qs[1], kind: "x" };
      if (g.type === "ccx") return { c: g.c, ctrl: [g.qs[0], g.qs[1]], tgt: g.qs[2], kind: "x" };
      if (g.type === "cz") return { c: g.c, ctrl: [g.qs[0]], tgt: g.qs[1], kind: "z" };
      return { c: g.c, ctrl: [g.qs[0]], tgt: g.qs[1], kind: "swap" };
    });
    const { X, Y } = drawCircuit(svg, n, glyphs, { x0: 50, dx: 56, y0: 26, dy: 44, cols: COLS, labels: Array.from({ length: n }, (_, q) => `q${sub(q)}`) });
    // Rotation angles under their boxes.
    for (const g of gates) if (g.type.startsWith("r")) text(svg, X(g.c), Y(g.qs[0]) + 23, `${num(g.angle, 0)}°`, { "text-anchor": "middle" });
    for (const p of pending) el("circle", { cx: X(p.c), cy: Y(p.q), r: 13, style: "fill:none;stroke:var(--brand);stroke-width:2;stroke-dasharray:3 2" }, svg);
    // Hit areas: focusable cells.
    for (let q = 0; q < n; q++) {
      for (let c = 0; c < COLS; c++) {
        const cell = el("rect", { x: X(c) - 28, y: Y(q) - 22, width: 56, height: 44, tabindex: 0, role: "button", "aria-label": `Wire q${q}, column ${c + 1}`, "data-q": q, "data-c": c, class: "cursor-pointer outline-none [&:focus-visible]:stroke-[var(--ring)]", style: "fill:transparent;stroke-width:2" }, svg);
        cell.addEventListener("click", () => onCell(q, c));
        cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCell(q, c); } });
      }
    }
  }

  function drawHist() {
    hist.replaceChildren();
    const N = 1 << n;
    const st = simulate(null);
    const expectP = st.probs();
    const counts = shots ?? new Array(N).fill(0);
    const top = Math.max(0.5, ...counts.map((c) => c / 1024), ...expectP);
    const f = frame(hist, { box: [36, 12, 252, 128], x: [0, N], y: [0, top], xticks: [], yticks: [0, top], yfmt: (v) => pct(v, 0) });
    const w = f.W / N;
    for (let i = 0; i < N; i++) {
      const p = counts[i] / 1024;
      if (shots) el("rect", { x: f.L + i * w + w * 0.15, y: f.sy(p), width: w * 0.7, height: f.T + f.H - f.sy(p), rx: 1.5, style: "fill:var(--brand);fill-opacity:0.75" }, hist);
      el("line", { x1: f.L + i * w + w * 0.1, x2: f.L + i * w + w * 0.9, y1: f.sy(expectP[i]), y2: f.sy(expectP[i]), style: "stroke:var(--foreground);stroke-width:1.5" }, hist);
      const lab = text(hist, f.L + i * w + w / 2, f.T + f.H + 10, i.toString(2).padStart(n, "0"), { "text-anchor": "end", transform: `rotate(-50 ${f.L + i * w + w / 2} ${f.T + f.H + 10})` });
      lab.setAttribute("class", "fill-muted-foreground font-mono text-[8px]");
    }
    text(hist, f.L + f.W, 10, shots ? "bars: 1024 shots · lines: exact" : "lines: exact probabilities", { "text-anchor": "end" });
  }

  function update() {
    gates = gates.filter((g) => g.qs.every((q) => q < n));
    const st = simulate(null);
    stateTable(stateBox, st);
    const code = qasm();
    qasmBox.textContent = code;
    copy.dataset.copy = code;
    o.gates.textContent = String(gates.length);
    o.norm.textContent = fixed(st.norm(), 6);
    const ent = Array.from({ length: n }, (_, q) => st.purity(q) < 1 - 1e-9);
    o.ent.textContent = ent.some(Boolean) ? `yes (q${ent.map((e, q) => (e ? sub(q) : "")).filter(Boolean).join(", q")})` : "no, a product state";
    o.hint.textContent = gates.some((g) => g.type === "m") ? "Measurements apply in each shot; the table shows the state before them." : hintFor();
    draw();
    drawHist();
  }

  root.querySelectorAll("[data-tool]").forEach((b) =>
    b.addEventListener("click", () => {
      tool = b.dataset.tool;
      pending = [];
      root.querySelectorAll("[data-tool]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      o.hint.textContent = hintFor();
      draw();
    }));
  root.addEventListener("seg-change", (e) => { n = Number(e.detail.value); pending = []; shots = null; update(); });
  const act = (a, fn) => root.querySelector(`[data-action=${a}]`).addEventListener("click", fn);
  act("bell", () => { snapshot(); gates = [{ type: "h", c: 0, qs: [0] }, { type: "cx", c: 1, qs: [0, 1] }]; shots = null; update(); });
  act("ghz", () => { snapshot(); gates = [{ type: "h", c: 0, qs: [0] }, ...Array.from({ length: n - 1 }, (_, k) => ({ type: "cx", c: k + 1, qs: [k, k + 1] }))]; shots = null; update(); });
  act("undo", () => { if (history.length) { gates = JSON.parse(history.pop()); shots = null; update(); } });
  act("clear", () => { snapshot(); gates = []; shots = null; update(); });
  act("shots", () => {
    const rng = mulberry32(seed++);
    const counts = new Array(1 << n).fill(0);
    for (let k = 0; k < 1024; k++) counts[sample(simulate(rng).probs(), rng)]++;
    shots = counts;
    drawHist();
  });

  gates = [{ type: "h", c: 0, qs: [0] }, { type: "cx", c: 1, qs: [0, 1] }];
  update();
}

// ============================================================ Bell states and CHSH

function bellState(kind) {
  const st = new State(2);
  st.apply(0, G.h).apply(1, G.x, [0]);
  if (kind === "phi-" || kind === "psi-") st.apply(0, G.z);
  if (kind === "psi+" || kind === "psi-") st.apply(1, G.x);
  return st;
}

// Outcome bits (0 = spin up along the axis) for Alice at angle a, Bob at b.
function measurePair(st, a, b, rng) {
  const t = st.clone();
  t.apply(0, G.ry(-a)).apply(1, G.ry(-b));
  const i = sample(t.probs(), rng);
  return [(i >> 1) & 1, i & 1];
}

for (const root of document.querySelectorAll("[data-qc-bell]")) {
  const corr = root.querySelector("[data-corr]");
  const chsh = root.querySelector("[data-chsh]");
  const stateBox = root.querySelector("[data-state]");
  const o = outs(root);
  let kind = "phi+", seed = 7, game = null;
  const s = scrubAll(root, draw);

  function draw() {
    const st = bellState(kind);
    stateTable(stateBox, st);
    const a = s.a.get() * DEG, b = s.b.get() * DEG;
    const E = (x, y) => expect(st, [[0, axisOp(x)], [1, axisOp(y)]]);
    corr.replaceChildren();
    const f = frame(corr, { box: [36, 14, 312, 168], x: [-180, 180], y: [-1, 1], xticks: [-180, -90, 0, 90, 180], yticks: [-1, 0, 1], xlabel: "Bob's angle θ_b (°)", ylabel: "E(a, b)", xfmt: (v) => String(v).replace("-", "−"), yfmt: (v) => String(v).replace("-", "−") });
    hline(corr, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    const pts = [];
    for (let d = -180; d <= 180; d += 2) pts.push([f.sx(d), f.sy(E(a, d * DEG))]);
    polyline(corr, pts, "stroke:var(--brand);stroke-width:2");
    // Classical (local hidden variable) linear correlation for comparison.
    const lin = [];
    for (let d = -180; d <= 180; d += 2) {
      const diff = Math.abs((((d * DEG - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      const sign = E(a, a) >= 0 ? 1 : -1;
      lin.push([f.sx(d), f.sy(sign * (1 - (2 * diff) / Math.PI))]);
    }
    polyline(corr, lin, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4");
    const e = E(a, b);
    el("circle", { cx: f.sx(s.b.get()), cy: f.sy(e), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, corr);
    text(corr, f.L + f.W - 2, f.T + 10, "— quantum   - - - linear local model", { "text-anchor": "end" });
    o.e.textContent = fixed(e, 3);
    o.same.textContent = pct((1 + e) / 2);
    drawGame();
  }

  function drawGame() {
    chsh.replaceChildren();
    const exact = Math.cos(Math.PI / 8) ** 2;
    const f = frame(chsh, { box: [30, 10, 160, 80], x: [0, 3], y: [0, 1], xticks: [], yticks: [0, 0.5, 1], yfmt: (v) => pct(v, 0) });
    const rows = [["classical", 0.75, game?.classical], ["quantum", exact, game?.quantum]];
    rows.forEach(([name, theory, sim], i) => {
      const x = f.L + (i * 1.3 + 0.35) * (f.W / 3);
      const w = f.W / 3 * 0.8;
      el("rect", { x, y: f.sy(sim ?? 0), width: w, height: f.T + f.H - f.sy(sim ?? 0), rx: 2, style: `fill:${i ? "var(--brand)" : "var(--vec-u)"};fill-opacity:0.7` }, chsh);
      el("line", { x1: x - 3, x2: x + w + 3, y1: f.sy(theory), y2: f.sy(theory), style: "stroke:var(--foreground);stroke-width:1.5" }, chsh);
      text(chsh, x + w / 2, f.T + f.H + 12, name, { "text-anchor": "middle" });
    });
    hline(chsh, f, 0.75, "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3");
    o.chsh.textContent = game
      ? `1000 rounds: quantum won ${pct(game.quantum)} (exact cos²(π/8) = ${pct(exact, 2)}), always-0 classical ${pct(game.classical)} (exact 75%).`
      : `Exact: quantum cos²(π/8) = ${pct(exact, 2)}; no classical strategy beats 75%. Press Play to run rounds.`;
  }

  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });
  root.querySelector("[data-action=measure]").addEventListener("click", () => {
    const rng = mulberry32(seed++);
    const st = bellState(kind);
    const c = [0, 0, 0, 0];
    for (let k = 0; k < 200; k++) { const [x, y] = measurePair(st, s.a.get() * DEG, s.b.get() * DEG, rng); c[x * 2 + y]++; }
    o.pairs.textContent = `00:${c[0]} 01:${c[1]} 10:${c[2]} 11:${c[3]} · same ${pct((c[0] + c[3]) / 200)}`;
  });
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    const rng = mulberry32(seed++);
    const st = bellState("phi+");
    const A = [0, 90 * DEG], B = [45 * DEG, -45 * DEG];
    let q = 0, cl = 0;
    for (let k = 0; k < 1000; k++) {
      const x = rng() < 0.5 ? 1 : 0, y = rng() < 0.5 ? 1 : 0;
      const [a, b] = measurePair(st, A[x], B[y], rng);
      if ((a ^ b) === (x & y)) q++;
      if ((0 ^ 0) === (x & y)) cl++;
    }
    game = { quantum: q / 1000, classical: cl / 1000 };
    drawGame();
  });
  draw();
}

// ============================================================ Teleportation

const TP_STEPS = [
  { title: "Input", text: "Alice holds an unknown state |ψ⟩ on q₀. Bob's qubit q₂ and the helper q₁ start in |0⟩." },
  { title: "Bell pair", text: "H on q₁ and CNOT q₁ → q₂ share an entangled pair: q₁ stays with Alice, q₂ goes to Bob." },
  { title: "CNOT q₀ → q₁", text: "Alice entangles her unknown qubit with her half of the pair." },
  { title: "H on q₀", text: "After this Hadamard, each of Alice's four outcomes leaves Bob's qubit as |ψ⟩ up to an X and/or a Z." },
  { title: "Measure", text: "Alice measures q₀ and q₁ and sends the two bits to Bob over an ordinary channel. Nothing travels faster than light: without the bits Bob's qubit is maximally mixed." },
  { title: "Correct", text: "Bob applies X if the second bit is 1, then Z if the first bit is 1. His qubit is now exactly |ψ⟩, and Alice's copy is gone." },
];

for (const root of document.querySelectorAll("[data-qc-teleport]")) {
  const diagram = root.querySelector("[data-diagram]");
  const stateBox = root.querySelector("[data-state]");
  const o = outs(root);
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let step = 0, outcome = "random", seed = 3;
  const s = scrubAll(root, render);

  function run() {
    const [a0, a1] = blochAmps(s.theta.get() * DEG, s.phi.get() * DEG);
    const st = new State(3);
    st.re[0] = a0.re; st.im[0] = a0.im; st.re[4] = a1.re; st.im[4] = a1.im; // q₀ is the leftmost digit
    let m = null;
    if (step >= 1) st.apply(1, G.h).apply(2, G.x, [1]);
    if (step >= 2) st.apply(1, G.x, [0]);
    if (step >= 3) st.apply(0, G.h);
    if (step >= 4) {
      if (outcome === "random") {
        const rng = mulberry32(seed);
        m = [st.measure(0, rng), st.measure(1, rng)];
      } else {
        m = [Number(outcome[0]), Number(outcome[1])];
        st.collapse(0, m[0]); st.collapse(1, m[1]);
      }
    }
    if (step >= 5) {
      if (m[1]) st.apply(2, G.x);
      if (m[0]) st.apply(2, G.z);
    }
    return { st, m, a0, a1 };
  }

  // Fidelity of Bob's qubit with |ψ⟩ once q₀ and q₁ are known.
  function fidelity(st, m, a0, a1) {
    const base = (m[0] << 2) | (m[1] << 1);
    const b0 = { re: st.re[base], im: st.im[base] }, b1 = { re: st.re[base | 1], im: st.im[base | 1] };
    const ip = { re: a0.re * b0.re + a0.im * b0.im + a1.re * b1.re + a1.im * b1.im, im: a0.re * b0.im - a0.im * b0.re + a1.re * b1.im - a1.im * b1.re };
    return ip.re ** 2 + ip.im ** 2;
  }

  function render() {
    const { st, m, a0, a1 } = run();
    const glyphs = [
      { c: 0, q: 1, label: "H" }, { c: 1, ctrl: [1], tgt: 2, kind: "x" },
      { c: 2, ctrl: [0], tgt: 1, kind: "x" }, { c: 3, q: 0, label: "H" },
      { c: 4, q: 0, label: "M" }, { c: 4, q: 1, label: "M" },
      { c: 5, q: 2, label: "Xᵐ¹" }, { c: 6, q: 2, label: "Zᵐ⁰" },
    ];
    const markCols = [null, [0, 1], 2, 3, 4, [5, 6]][step];
    drawCircuit(diagram, 3, glyphs, { x0: 70, dx: 62, y0: 30, dy: 50, cols: 7, labels: ["q₀ |ψ⟩", "q₁ |0⟩", "q₂ |0⟩"], mark: markCols });
    o.explain.textContent = `${step + 1}. ${TP_STEPS[step].title}: ${TP_STEPS[step].text}`;
    stateTable(stateBox, st);
    o.step.textContent = `${step + 1} / ${TP_STEPS.length}`;
    o.bits.textContent = m ? `m₀m₁ = ${m[0]}${m[1]}` : "—";
    o.fix.textContent = m ? [m[1] ? "X" : "", m[0] ? "Z" : ""].filter(Boolean).join(" then ") || "nothing" : "—";
    o.fid.textContent = m ? (step >= 5 ? fixed(fidelity(st, m, a0, a1), 6) : `${fixed(fidelity(st, m, a0, a1), 4)} before correcting`) : "—";
    back.disabled = step === 0;
    next.disabled = step === TP_STEPS.length - 1;
  }

  back.addEventListener("click", () => { step = Math.max(0, step - 1); render(); });
  next.addEventListener("click", () => { step = Math.min(TP_STEPS.length - 1, step + 1); render(); });
  root.addEventListener("seg-change", (e) => { outcome = e.detail.value; seed++; render(); });
  root.querySelector("[data-action=random]").addEventListener("click", () => {
    const rng = mulberry32(Date.now() & 0xffff);
    s.theta.set(Math.round(Math.acos(1 - 2 * rng()) / DEG), false);
    s.phi.set(Math.round(rng() * 359), false);
    seed++;
    render();
  });
  render();
}

// ============================================================ Superdense coding

for (const root of document.querySelectorAll("[data-qc-dense]")) {
  const steps = root.querySelector("[data-steps]");
  const o = outs(root);
  let bits = "00";
  const OPS = { "00": "I", "01": "X", "10": "Z", "11": "Z·X" };

  function render() {
    const st = new State(2);
    const list = [];
    st.apply(0, G.h).apply(1, G.x, [0]);
    list.push(["Shared Bell pair", "H, then CNOT", dirac(st)]);
    if (bits[1] === "1") st.apply(0, G.x);
    if (bits[0] === "1") st.apply(0, G.z);
    list.push(["Alice encodes on her qubit", OPS[bits], dirac(st)]);
    st.apply(1, G.x, [0]);
    list.push(["Bob: CNOT q₀ → q₁", "after receiving q₀", dirac(st)]);
    st.apply(0, G.h);
    list.push(["Bob: H on q₀", "the state is a basis state", dirac(st)]);
    steps.replaceChildren(...list.map(([t, sub2, d], i) => {
      const li = document.createElement("li");
      li.className = "flex flex-col gap-1 rounded-lg border bg-code p-3";
      const h = document.createElement("span"); h.className = "text-sm font-medium"; h.textContent = `${i + 1}. ${t}`;
      const s2 = document.createElement("span"); s2.className = "text-xs text-muted-foreground"; s2.textContent = sub2;
      const k = document.createElement("span"); k.className = "font-mono text-sm"; k.textContent = d;
      li.append(h, s2, k);
      return li;
    }));
    const probs = st.probs();
    const best = probs.indexOf(Math.max(...probs));
    o.op.textContent = `Alice applies ${OPS[bits]}`;
    o.result.textContent = `Bob measures ${best.toString(2).padStart(2, "0")} with probability ${fixed(probs[best], 3)}: two classical bits from one qubit.`;
  }
  root.addEventListener("seg-change", (e) => { bits = e.detail.value; render(); });
  render();
}

// ============================================================ Deutsch–Jozsa

for (const root of document.querySelectorAll("[data-qc-deutsch]")) {
  const bars = root.querySelector("[data-bars]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  let n = 3;
  let f = new Array(1 << n).fill(0).map((_, x) => x >> (n - 1)); // first bit: balanced

  function run() {
    // n input qubits plus an ancilla (last wire) prepared in |−⟩.
    const st = new State(n + 1);
    st.apply(n, G.x);
    for (let q = 0; q <= n; q++) st.apply(q, G.h);
    // Oracle U_f: |x, y⟩ → |x, y ⊕ f(x)⟩, a permutation of amplitudes.
    for (let x = 0; x < 1 << n; x++) {
      if (!f[x]) continue;
      const i = x << 1, j = i | 1;
      [st.re[i], st.re[j]] = [st.re[j], st.re[i]];
      [st.im[i], st.im[j]] = [st.im[j], st.im[i]];
    }
    for (let q = 0; q < n; q++) st.apply(q, G.h);
    // The ancilla stays |−⟩: the input register's amplitude is √2 · a(x, 0).
    return Array.from({ length: 1 << n }, (_, x) => st.re[x << 1] * Math.SQRT2);
  }

  function render() {
    const amps = run();
    amplitudeBars(bars, amps, { labels: amps.map((_, i) => i.toString(2).padStart(n, "0")), highlight: 0, title: "amplitude of each input-register outcome after one query" });
    const ones = f.reduce((a, b) => a + b, 0), N = f.length;
    const kind = ones === 0 || ones === N ? "constant" : ones === N / 2 ? "balanced" : "neither";
    o.kind.textContent = kind === "neither" ? `neither (${ones} ones of ${N}): the promise is broken` : kind;
    o.p0.textContent = fixed(amps[0] ** 2, 4);
    o.verdict.textContent = amps[0] ** 2 > 1 - 1e-9 ? "constant (all zeros measured)" : amps[0] ** 2 < 1e-9 ? "balanced (never all zeros)" : "no clean answer";
    o.classical.textContent = `${N / 2 + 1} queries`;
    table.replaceChildren(...f.map((v, x) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rounded-md border px-2 py-1 font-mono text-xs transition-colors duration-150 hover:bg-accent " + (v ? "border-brand/50 bg-brand/10 text-brand" : "bg-background");
      b.textContent = `${x.toString(2).padStart(n, "0")} → ${v}`;
      b.setAttribute("aria-label", `f(${x.toString(2).padStart(n, "0")}) = ${v}, click to flip`);
      b.addEventListener("click", () => { f[x] ^= 1; render(); });
      return b;
    }));
  }

  const preset = (name, fn) => root.querySelector(`[data-action=${name}]`).addEventListener("click", () => { f = Array.from({ length: 1 << n }, (_, x) => fn(x)); render(); });
  preset("const0", () => 0);
  preset("const1", () => 1);
  preset("parity", (x) => x.toString(2).split("").filter((c) => c === "1").length % 2);
  preset("first", (x) => x >> (n - 1));
  root.addEventListener("seg-change", (e) => { n = Number(e.detail.value); f = Array.from({ length: 1 << n }, (_, x) => x >> (n - 1)); render(); });
  render();
}

// ============================================================ Grover

for (const root of document.querySelectorAll("[data-qc-grover]")) {
  const bars = root.querySelector("[data-bars]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const N = 8, theta = Math.asin(1 / Math.sqrt(N));
  let st, k = 0, phase = "start";
  const s = scrubAll(root, () => reset());

  const marked = () => Math.round(s.marked.get());
  function reset() {
    st = new State(3);
    for (let q = 0; q < 3; q++) st.apply(q, G.h);
    k = 0; phase = "start";
    render();
  }
  function oracle() { const m = marked(); st.re[m] = -st.re[m]; st.im[m] = -st.im[m]; phase = "oracle"; }
  function diffuse() {
    // H⊗3 · (2|0⟩⟨0| − I) · H⊗3, applied as gates.
    for (let q = 0; q < 3; q++) st.apply(q, G.h);
    for (let i = 1; i < N; i++) { st.re[i] = -st.re[i]; st.im[i] = -st.im[i]; }
    for (let q = 0; q < 3; q++) st.apply(q, G.h);
    phase = "diffusion";
    k++;
  }

  function render() {
    const amps = Array.from({ length: N }, (_, i) => st.re[i]);
    const mean = amps.reduce((a, b) => a + b, 0) / N;
    amplitudeBars(bars, amps, { labels: amps.map((_, i) => i.toString(2).padStart(3, "0")), highlight: marked(), mean, title: "amplitudes (real); dashed line: mean" });
    curve.replaceChildren();
    const f = frame(curve, { box: [36, 14, 210, 178], x: [0, 6], y: [0, 1], xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 0.5, 1], xlabel: "iterations k", ylabel: "P(marked)", yfmt: (v) => pct(v, 0) });
    const pts = [];
    for (let x = 0; x <= 6; x += 0.05) pts.push([f.sx(x), f.sy(Math.sin((2 * x + 1) * theta) ** 2)]);
    polyline(curve, pts, "stroke:var(--brand);stroke-width:1.8;stroke-opacity:0.6");
    for (let j = 0; j <= 6; j++) el("circle", { cx: f.sx(j), cy: f.sy(Math.sin((2 * j + 1) * theta) ** 2), r: j === k ? 5 : 2.5, style: j === k ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.5" }, curve);
    const p = st.prob(marked());
    o.k.textContent = String(k);
    o.p.textContent = pct(p, 2);
    o.theory.textContent = pct(Math.sin((2 * k + 1) * theta) ** 2, 2);
    o.opt.textContent = `${Math.round(Math.PI / (4 * theta) - 0.5)} (π/4·√8 ≈ ${num((Math.PI / 4) * Math.sqrt(N), 2)})`;
    o.phase.textContent = { start: "Uniform superposition after H⊗3.", oracle: `Oracle flipped the sign of |${marked().toString(2).padStart(3, "0")}⟩.`, diffusion: `Diffusion reflected every amplitude about the mean (iteration ${k}).` }[phase];
  }

  root.querySelector("[data-action=oracle]").addEventListener("click", () => { oracle(); render(); });
  root.querySelector("[data-action=diffuse]").addEventListener("click", () => { diffuse(); render(); });
  root.querySelector("[data-action=iterate]").addEventListener("click", () => { oracle(); diffuse(); render(); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  reset();
}

// ============================================================ QFT

for (const root of document.querySelectorAll("[data-qc-qft]")) {
  const diagram = root.querySelector("[data-diagram]");
  const phasors = root.querySelector("[data-phasors]");
  const o = outs(root);
  const s = scrubAll(root, render);

  function qft(x) {
    const st = new State(3);
    st.re[0] = 0; st.re[x] = 1;
    const R = (k) => G.p((2 * Math.PI) / 2 ** k);
    st.apply(0, G.h).apply(0, R(2), [1]).apply(0, R(3), [2]);
    st.apply(1, G.h).apply(1, R(2), [2]);
    st.apply(2, G.h);
    st.swap(0, 2);
    return st;
  }

  function render() {
    const x = Math.round(s.x.get());
    drawCircuit(diagram, 3, [
      { c: 0, q: 0, label: "H" }, { c: 1, ctrl: [1], tgt: 0, kind: "phase", text: "R₂" }, { c: 2, ctrl: [2], tgt: 0, kind: "phase", text: "R₃" },
      { c: 3, q: 1, label: "H" }, { c: 4, ctrl: [2], tgt: 1, kind: "phase", text: "R₂" }, { c: 5, q: 2, label: "H" },
      { c: 6, ctrl: [0], tgt: 2, kind: "swap" },
    ], { x0: 40, dx: 64, y0: 26, dy: 42, cols: 7 });
    const st = qft(x);
    phasors.replaceChildren();
    let err = 0;
    for (let y = 0; y < 8; y++) {
      const cx = 32 + y * 64, cy = 54, r = 24;
      el("circle", { cx, cy, r, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, phasors);
      const mag = Math.hypot(st.re[y], st.im[y]) * Math.sqrt(8);
      const ang = Math.atan2(st.im[y], st.re[y]);
      el("line", { x1: cx, y1: cy, x2: cx + r * mag * Math.cos(ang), y2: cy - r * mag * Math.sin(ang), style: `stroke:${phaseColor(st.re[y], st.im[y])};stroke-width:2.5;stroke-linecap:round` }, phasors);
      el("circle", { cx: cx + r * mag * Math.cos(ang), cy: cy - r * mag * Math.sin(ang), r: 3, style: `fill:${phaseColor(st.re[y], st.im[y])}` }, phasors);
      text(phasors, cx, cy + r + 16, ket(y, 3), { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" });
      const want = (2 * Math.PI * x * y) / 8;
      err = Math.max(err, Math.hypot(st.re[y] - Math.cos(want) / Math.sqrt(8), st.im[y] - Math.sin(want) / Math.sqrt(8)));
    }
    o.in.textContent = ket(x, 3);
    o.step.textContent = `${x * 45}° (${x}/8 turn)`;
    o.mag.textContent = `1/√8 = ${fixed(1 / Math.sqrt(8), 4)}`;
    o.err.textContent = err.toExponential(1).replace("-", "−");
  }
  render();
}

// ============================================================ Shor

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const modpow = (a, e, m) => { let r = 1; for (let i = 0; i < e; i++) r = (r * a) % m; return r; };

for (const root of document.querySelectorAll("[data-qc-shor]")) {
  const table = root.querySelector("[data-table]");
  const hist = root.querySelector("[data-hist]");
  const steps = root.querySelector("[data-steps]");
  const o = outs(root);
  let a = 7;
  const N = 15, Q = 16;

  function render() {
    const vals = Array.from({ length: Q }, (_, x) => modpow(a, x, N));
    let r = 1;
    while (modpow(a, r, N) !== 1) r++;
    // Table of a^x mod N.
    const t = document.createElement("table");
    t.className = "w-full min-w-[480px] text-center font-mono text-xs tabular-nums";
    const r1 = t.insertRow(), r2 = t.insertRow();
    const th = (row, s2, cls) => { const c = row.insertCell(); c.textContent = s2; c.className = cls; };
    th(r1, "x", "px-1 py-1 text-left text-muted-foreground"); th(r2, "aˣ mod 15", "px-1 py-1 text-left whitespace-nowrap text-muted-foreground");
    vals.forEach((v, x) => { th(r1, String(x), "px-1 py-1 text-muted-foreground"); th(r2, String(v), "px-1 py-1 " + (x % r === 0 ? "rounded bg-brand/12 text-brand" : "")); });
    table.replaceChildren(t);
    // Ideal counting-register distribution: r divides 16, so peaks at c = s·16/r.
    hist.replaceChildren();
    const f = frame(hist, { box: [36, 12, 470, 120], x: [0, Q], y: [0, 0.6], xticks: [], yticks: [0, 0.25, 0.5], yfmt: (v) => pct(v, 0) });
    const w = f.W / Q;
    for (let c = 0; c < Q; c++) {
      const p = c % (Q / r) === 0 ? 1 / r : 0;
      if (p) el("rect", { x: f.L + c * w + w * 0.18, y: f.sy(p), width: w * 0.64, height: f.T + f.H - f.sy(p), rx: 2, style: "fill:var(--brand);fill-opacity:0.75" }, hist);
      text(hist, f.L + c * w + w / 2, f.T + f.H + 13, String(c), { "text-anchor": "middle" });
    }
    text(hist, f.L + f.W, f.T + 10, `peaks at c/16 = s/${r}`, { "text-anchor": "end" });
    const half = modpow(a, r / 2, N);
    const ok = r % 2 === 0 && half !== N - 1;
    const p1 = ok ? gcd(half - 1, N) : null, p2 = ok ? gcd(half + 1, N) : null;
    const items = [
      `The period of ${a}ˣ mod 15 is r = ${r}: the quantum step would read some c = s·16/${r}, and continued fractions recover r from c/16.`,
      r % 2 ? `r is odd: this a fails, try another.` : `r = ${r} is even, so a^(r/2) = ${a}^${r / 2} ≡ ${half} (mod 15).`,
      r % 2 ? "" : half === N - 1 ? `${half} ≡ −1 (mod 15): a^(r/2) + 1 is a multiple of 15, so this a fails. Pick another.` : `${half} ≢ −1, so gcd(${half} − 1, 15) = ${p1} and gcd(${half} + 1, 15) = ${p2}.`,
    ].filter(Boolean);
    steps.replaceChildren(...items.map((s2, i) => { const li = document.createElement("li"); li.className = "flex gap-2"; const b = document.createElement("span"); b.className = "font-mono text-xs text-muted-foreground"; b.textContent = `${i + 1}.`; const tx = document.createElement("span"); tx.textContent = s2; li.append(b, tx); return li; }));
    o.r.textContent = String(r);
    o.half.textContent = r % 2 ? "—" : `${half}${half === N - 1 ? " ≡ −1" : ""}`;
    o.factors.textContent = ok ? `15 = ${Math.min(p1, p2)} × ${Math.max(p1, p2)}` : "none with this a";
  }
  root.addEventListener("seg-change", (e) => { a = Number(e.detail.value); render(); });
  render();
}

// ============================================================ No-cloning

for (const root of document.querySelectorAll("[data-qc-cloning]")) {
  const plot = root.querySelector("[data-plot]");
  const want = root.querySelector("[data-state]");
  const got = root.querySelector("[data-state2]");
  const o = outs(root);
  const s = scrubAll(root, render);

  function render() {
    const th = s.theta.get() * DEG;
    const al = Math.cos(th / 2), be = Math.sin(th / 2);
    const two = new State(2);
    two.apply(0, G.ry(th)).apply(1, G.ry(th));
    stateTable(want, two);
    const cnot = new State(2);
    cnot.apply(0, G.ry(th)).apply(1, G.x, [0]);
    stateTable(got, cnot);
    plot.replaceChildren();
    const f = frame(plot, { box: [40, 14, 584, 150], x: [0, 180], y: [0, 1], xticks: [0, 45, 90, 135, 180], yticks: [0, 0.5, 1], xlabel: "input θ (°)", ylabel: "fidelity", yfmt: (v) => String(v) });
    const pts = [];
    for (let d = 0; d <= 180; d += 2) { const a = Math.cos((d * DEG) / 2), b = Math.sin((d * DEG) / 2); pts.push([f.sx(d), f.sy(a ** 4 + b ** 4)]); }
    polyline(plot, pts, "stroke:var(--brand);stroke-width:2");
    hline(plot, f, 0.5, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3", "worst: 1/2 at θ = 90°");
    const F = al ** 4 + be ** 4;
    el("circle", { cx: f.sx(s.theta.get()), cy: f.sy(F), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, plot);
    o.alpha.textContent = fixed(al, 4);
    o.beta.textContent = fixed(be, 4);
    o.fid.textContent = fixed(F, 4);
    o.perfect.textContent = "θ = 0° or 180° (|0⟩, |1⟩)";
  }
  render();
}

// ============================================================ Noise

// Real 4×4 density matrices: Φ⁺ and the depolarizing channel stay real.
const I4 = () => Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i === j ? 1 : 0)));
function depolarize(rho, q, p) {
  // ρ → (1−p)ρ + p·(I/2 on qubit q) ⊗ Tr_q ρ. Qubit 0 is the high bit.
  const out = rho.map((r) => r.map((v) => (1 - p) * v));
  const bitOf = (i) => (q === 0 ? i >> 1 : i & 1);
  const other = (i) => (q === 0 ? i & 1 : i >> 1);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (bitOf(i) !== bitOf(j)) continue;
      // (Tr_q ρ)[other(i), other(j)] = Σ_b ρ[(b, oi), (b, oj)]
      let tr = 0;
      for (let b = 0; b < 2; b++) {
        const ii = q === 0 ? (b << 1) | other(i) : (other(i) << 1) | b;
        const jj = q === 0 ? (b << 1) | other(j) : (other(j) << 1) | b;
        tr += rho[ii][jj];
      }
      out[i][j] += (p / 2) * tr;
    }
  }
  return out;
}
const trProd = (A, B) => { let t = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) t += A[i][j] * B[j][i]; return t; };
const kron = (a, b) => Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => a[i >> 1][j >> 1] * b[i & 1][j & 1]));
const PX = [[0, 1], [1, 0]], PZ = [[1, 0], [0, -1]], PYr = [[0, -1], [1, 0]]; // Y = i·PYr
// Jacobi eigenvalues of a real symmetric matrix.
function eig(Ain) {
  const n = Ain.length, A = Ain.map((r) => r.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
    }
  }
  return A.map((r, i) => r[i]);
}

for (const root of document.querySelectorAll("[data-qc-noise]")) {
  const plot = root.querySelector("[data-plot]");
  const rhoSvg = root.querySelector("[data-rho]");
  const o = outs(root);
  const s = scrubAll(root, render);
  const bell = (() => { const r = I4().map((row) => row.map(() => 0)); for (const i of [0, 3]) for (const j of [0, 3]) r[i][j] = 0.5; return r; })();

  const layer = (rho, p) => depolarize(depolarize(rho, 0, p), 1, p);
  function measures(rho) {
    const F = trProd(rho, bell);
    // Correlation matrix T_ij = Tr(ρ σi⊗σj); ρ real makes the xy, yz terms vanish.
    const T = [
      [trProd(rho, kron(PX, PX)), 0, trProd(rho, kron(PX, PZ))],
      [0, -trProd(rho, kron(PYr, PYr)), 0],
      [trProd(rho, kron(PZ, PX)), 0, trProd(rho, kron(PZ, PZ))],
    ];
    const TT = [0, 1, 2].map((i) => [0, 1, 2].map((j) => T[0][i] * T[0][j] + T[1][i] * T[1][j] + T[2][i] * T[2][j]));
    const ev = eig(TT).sort((a, b) => b - a);
    const S = 2 * Math.sqrt(Math.max(0, ev[0] + ev[1])); // Horodecki
    // Partial transpose on qubit 1; a negative eigenvalue means entangled (PPT).
    const pt = rho.map((r, i) => r.map((_, j) => rho[(i & 2) | (j & 1)][(j & 2) | (i & 1)]));
    const ent = Math.min(...eig(pt)) < -1e-12;
    return { F, S, ent };
  }

  function render() {
    const p = s.p.get(), K = Math.round(s.k.get());
    let rho = bell;
    const Fs = [], Ss = [];
    let limit = null;
    for (let k = 0; k <= 40; k++) {
      const m = measures(rho);
      Fs.push(m.F); Ss.push(m.S);
      if (limit === null && m.S <= 2 + 1e-12) limit = k;
      if (k === K) var cur = { ...m, rho };
      rho = layer(rho, p);
    }
    plot.replaceChildren();
    const top = frame(plot, { box: [34, 12, 252, 78], x: [0, 40], y: [0, 3], xticks: [], yticks: [0, 2, 2 * Math.SQRT2], yfmt: (v) => (v > 2.5 ? "2√2" : String(v)), ylabel: "S" });
    hline(plot, top, 2, "stroke:var(--code-del);stroke-dasharray:4 3;stroke-opacity:0.8", "classical bound");
    polyline(plot, Ss.map((v, k) => [top.sx(k), top.sy(v)]), "stroke:var(--brand);stroke-width:1.8");
    el("circle", { cx: top.sx(K), cy: top.sy(Ss[K]), r: 4, style: "fill:var(--brand)" }, plot);
    const bot = frame(plot, { box: [34, 120, 252, 70], x: [0, 40], y: [0, 1], xticks: [0, 10, 20, 30, 40], yticks: [0.25, 1], xlabel: "layers", ylabel: "F", yfmt: (v) => String(v) });
    hline(plot, bot, 0.5, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3", "entangled above 1/2");
    polyline(plot, Fs.map((v, k) => [bot.sx(k), bot.sy(v)]), "stroke:var(--vec-u);stroke-width:1.8");
    el("circle", { cx: bot.sx(K), cy: bot.sy(Fs[K]), r: 4, style: "fill:var(--vec-u)" }, plot);
    // ρ as a heat map with values.
    rhoSvg.replaceChildren();
    const labels = ["00", "01", "10", "11"];
    for (let i = 0; i < 4; i++) {
      text(rhoSvg, 22, 46 + i * 44, labels[i], { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" });
      text(rhoSvg, 50 + i * 44, 18, labels[i], { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" });
      for (let j = 0; j < 4; j++) {
        const v = cur.rho[i][j];
        el("rect", { x: 28 + j * 44, y: 24 + i * 44, width: 42, height: 42, rx: 4, style: `fill:${v >= 0 ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${Math.min(1, Math.abs(v) * 1.6).toFixed(3)};stroke:currentColor;stroke-opacity:0.12` }, rhoSvg);
        text(rhoSvg, 50 + j * 44, 49 + i * 44, fixed(v, 3), { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
      }
    }
    o.fid.textContent = fixed(cur.F, 4);
    o.s.textContent = `${fixed(cur.S, 3)}${cur.S > 2 ? " (beats 2)" : ""}`;
    o.ent.textContent = cur.ent ? "yes (PPT test)" : "no";
    o.limit.textContent = p === 0 ? "never" : limit === null ? "> 40" : String(limit);
  }
  render();
}

void cfmt; void reduced;
