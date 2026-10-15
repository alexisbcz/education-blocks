// HCI & UX research blocks, part 1: the pointing experiments (Fitts,
// steering), the keystroke-level model, the SUS questionnaire and the
// heuristic evaluation. Timings use performance.now(); every response stays
// in memory in this page. The statistics blocks are in hci-stats.js.

import { el, text, frame, polyline, num } from "./plot.js";
import { outs, mean, linfit, rng, gauss, svgPoint, shuffle, phi } from "./hci-util.js";

// A scatter of condition means with the fitted line, shared by Fitts and steering.
function fitPlot(svg, pts, fit, { x, y, xticks, yticks, xlabel, ylabel, xfmt }) {
  svg.replaceChildren();
  const f = frame(svg, { box: [46, 26, 456, 160], x, y, xticks, yticks, xlabel, ylabel, xfmt, yfmt: (v) => v.toFixed(1) });
  for (const p of pts) {
    for (const t of p.raw ?? []) el("circle", { cx: f.sx(p.x), cy: f.sy(Math.min(t, y[1])), r: 1.6, style: "fill:currentColor;fill-opacity:0.18" }, svg);
  }
  if (fit) polyline(svg, [[f.sx(x[0]), f.sy(fit.a + fit.b * x[0])], [f.sx(x[1]), f.sy(fit.a + fit.b * x[1])]].map(([px, py]) => [px, Math.max(26, Math.min(186, py))]), "stroke:var(--brand);stroke-width:2");
  for (const p of pts) el("circle", { cx: f.sx(p.x), cy: f.sy(Math.min(p.y, y[1])), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
  if (!pts.length) text(svg, 274, 102, "no data yet", { "text-anchor": "middle" });
  return f;
}

// ============================================================ Fitts's law

for (const root of document.querySelectorAll("[data-hci-fitts]")) {
  const arena = root.querySelector("[data-arena]");
  const plot = root.querySelector("[data-plot]");
  const prompt = root.querySelector("[data-prompt]");
  const o = outs(root);
  const startBtn = root.querySelector("[data-action=start]");
  const DS = [120, 240, 420], WS = [12, 24, 48], PER = 6;
  const id = (D, W) => Math.log2(D / W + 1);
  let conds = [], ci = 0, side = 0, tPrev = 0, running = false, misses = 0;

  const fresh = () => DS.flatMap((D) => WS.map((W) => ({ D, W, ID: id(D, W), mts: [] })));
  conds = fresh();

  const drawArena = () => {
    arena.replaceChildren();
    const c = conds[ci] ?? conds[0];
    for (const s of [0, 1]) {
      const cx = 300 + (s ? 1 : -1) * c.D / 2;
      const on = running && s === side;
      el("rect", { x: cx - c.W / 2, y: 14, width: c.W, height: 132, rx: Math.min(4, c.W / 4),
        style: on ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.14" }, arena);
    }
    text(arena, 8, 154, running ? `D ${c.D}  W ${c.W}  ID ${c.ID.toFixed(2)} bits` : "", { "dominant-baseline": "auto" });
  };

  const draw = () => {
    const pts = conds.filter((c) => c.mts.length).map((c) => ({ x: c.ID, y: mean(c.mts), raw: c.mts }));
    const fit = pts.length >= 2 ? linfit(pts.map((p) => p.x), pts.map((p) => p.y)) : null;
    const ymax = Math.max(1.2, ...pts.map((p) => p.y * 1.25));
    fitPlot(plot, pts, fit, { x: [1, 6], y: [0, ymax], xticks: [1, 2, 3, 4, 5, 6], yticks: [0, ymax / 2, ymax].map((v) => +v.toFixed(1)), xlabel: "ID = log₂(D/W + 1), bits", ylabel: "MT, s" });
    const n = conds.reduce((s, c) => s + c.mts.length, 0);
    o.n.textContent = String(n);
    o.miss.textContent = n || misses ? `${misses} (${num((100 * misses) / Math.max(1, n + misses))} %)` : "—";
    if (fit) {
      o.a.textContent = `${Math.round(fit.a * 1000)} ms`;
      o.b.textContent = `${Math.round(fit.b * 1000)} ms/bit`;
      o.r2.textContent = fit.r2.toFixed(3);
      o.tp.textContent = `${num(mean(pts.map((p) => p.x / p.y)), 2)} bits/s`;
    } else for (const k of ["a", "b", "r2", "tp"]) o[k].textContent = "—";
  };

  const finish = () => {
    running = false;
    startBtn.disabled = false;
    prompt.textContent = "Done. The line is fitted to the mean of each condition; the faint dots are single clicks.";
    drawArena();
  };

  arena.addEventListener("pointerdown", (e) => {
    if (!running) return;
    const c = conds[ci];
    const x = svgPoint(arena, e).x;
    const cx = 300 + (side ? 1 : -1) * c.D / 2;
    const now = performance.now();
    if (Math.abs(x - cx) > c.W / 2) {
      misses++;
      draw();
      return;
    }
    if (tPrev) c.mts.push((now - tPrev) / 1000);
    tPrev = now;
    side ^= 1;
    if (c.mts.length >= PER) {
      ci++;
      tPrev = 0;
      if (ci >= conds.length) return (draw(), finish());
      prompt.textContent = `Condition ${ci + 1} of ${conds.length}. Click the pink bar to begin; timing starts from that click.`;
    }
    drawArena();
    draw();
  });

  startBtn.addEventListener("click", () => {
    conds = shuffle(fresh());
    ci = 0; side = 0; tPrev = 0; misses = 0; running = true;
    startBtn.disabled = true;
    prompt.textContent = `Condition 1 of ${conds.length}. Click the pink bar to begin; timing starts from that click.`;
    drawArena();
    draw();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => {
    conds = fresh(); ci = 0; running = false; misses = 0;
    startBtn.disabled = false;
    prompt.textContent = "Cleared. Press Start for a new session.";
    drawArena();
    draw();
  });
  root.querySelector("[data-action=simulate]").addEventListener("click", () => {
    // A typical mouse user: a ≈ 150 ms, b ≈ 170 ms/bit, log-normal scatter.
    const rand = rng(Date.now() & 0xffff);
    conds = fresh();
    for (const c of conds) for (let i = 0; i < PER; i++) c.mts.push((0.15 + 0.17 * c.ID) * Math.exp(0.15 * gauss(rand)));
    misses = Math.round(rand() * 3);
    running = false; startBtn.disabled = false; ci = 0;
    prompt.textContent = "Simulated participant: true a = 150 ms, b = 170 ms/bit. The slope is recovered well; the intercept less so, since no condition is near ID 0.";
    drawArena();
    draw();
  });

  drawArena();
  draw();
}

// ============================================================ Steering law

for (const root of document.querySelectorAll("[data-hci-steer]")) {
  const arena = root.querySelector("[data-arena]");
  const plot = root.querySelector("[data-plot]");
  const prompt = root.querySelector("[data-prompt]");
  const o = outs(root);
  const AS = [240, 440], WS = [14, 28, 56], RUNS = 3, X0 = 90, Y = 70, SX = 52;
  let tunnels = [], ti = 0, hits = 0, drag = null;

  const fresh = () => AS.flatMap((A) => WS.map((W) => ({ A, W, idx: A / W, ts: [] })));
  const order = () => shuffle(fresh().flatMap((t) => Array(RUNS).fill(t)));
  let all = fresh();
  tunnels = order().map((t) => all.find((u) => u.A === t.A && u.W === t.W));

  const cur = () => tunnels[ti];

  const drawArena = (state = "") => {
    arena.replaceChildren();
    const t = cur();
    if (!t) {
      text(arena, 300, 74, "All tunnels done. Clear to run again.", { "text-anchor": "middle", class: "fill-muted-foreground text-[12px]" });
      return;
    }
    const x1 = X0 + t.A;
    el("rect", { x: X0, y: Y - t.W / 2, width: t.A, height: t.W, style: "fill:currentColor;fill-opacity:0.06" }, arena);
    for (const yy of [Y - t.W / 2, Y + t.W / 2]) el("line", { x1: X0, x2: x1, y1: yy, y2: yy, style: `stroke:${state === "wall" ? "var(--code-del)" : "currentColor"};stroke-opacity:${state === "wall" ? 1 : 0.5};stroke-width:1.5` }, arena);
    el("line", { x1: X0, x2: X0, y1: Y - t.W / 2 - 8, y2: Y + t.W / 2 + 8, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, arena);
    el("line", { x1: x1, x2: x1, y1: Y - t.W / 2 - 8, y2: Y + t.W / 2 + 8, style: "stroke:var(--brand);stroke-width:2" }, arena);
    el("circle", { cx: SX, cy: Y, r: 14, style: drag ? "fill:var(--brand);fill-opacity:0.25;stroke:var(--brand)" : "fill:var(--brand);fill-opacity:0.12;stroke:var(--brand);stroke-width:1.5" }, arena);
    text(arena, 8, 132, `A ${t.A}  W ${t.W}  A/W ${num(t.idx, 1)}   run ${ti + 1} of ${tunnels.length}`, {});
  };

  const draw = () => {
    const pts = all.filter((t) => t.ts.length).map((t) => ({ x: t.idx, y: mean(t.ts), raw: t.ts }));
    const fit = pts.length >= 2 ? linfit(pts.map((p) => p.x), pts.map((p) => p.y)) : null;
    const ymax = Math.max(1.5, ...pts.map((p) => p.y * 1.25));
    fitPlot(plot, pts, fit, { x: [0, 35], y: [0, ymax], xticks: [0, 5, 10, 15, 20, 25, 30, 35], yticks: [0, ymax / 2, ymax].map((v) => +v.toFixed(1)), xlabel: "A/W", ylabel: "T, s" });
    const n = all.reduce((s, t) => s + t.ts.length, 0);
    o.n.textContent = String(n);
    o.miss.textContent = String(hits);
    if (fit) {
      o.a.textContent = `${Math.round(fit.a * 1000)} ms`;
      o.b.textContent = `${Math.round(fit.b * 1000)} ms`;
      o.r2.textContent = fit.r2.toFixed(3);
    } else for (const k of ["a", "b", "r2"]) o[k].textContent = "—";
  };

  arena.addEventListener("pointerdown", (e) => {
    const t = cur();
    if (!t) return;
    const p = svgPoint(arena, e);
    if (Math.hypot(p.x - SX, p.y - Y) > 20) return;
    e.preventDefault();
    try { arena.setPointerCapture(e.pointerId); } catch {}
    drag = { t0: 0 };
    prompt.textContent = "Steer right to the pink line.";
    drawArena();
  });
  arena.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const t = cur();
    const p = svgPoint(arena, e);
    if (!drag.t0 && p.x >= X0) drag.t0 = performance.now();
    if (drag.t0 && Math.abs(p.y - Y) > t.W / 2) {
      hits++;
      drag = null;
      prompt.textContent = "You touched the wall: run voided. Try the same tunnel again.";
      drawArena("wall");
      draw();
      return;
    }
    if (drag.t0 && p.x >= X0 + t.A) {
      t.ts.push((performance.now() - drag.t0) / 1000);
      drag = null;
      ti++;
      prompt.textContent = cur() ? "Good. Next tunnel: press in the circle again." : "Done. The line is fitted to the mean of each tunnel.";
      drawArena();
      draw();
    }
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    prompt.textContent = "Released before the finish line. Press in the circle and try again.";
    drawArena();
  };
  arena.addEventListener("pointerup", release);
  arena.addEventListener("pointercancel", release);

  root.querySelector("[data-action=clear]").addEventListener("click", () => {
    all = fresh();
    tunnels = order().map((t) => all.find((u) => u.A === t.A && u.W === t.W));
    ti = 0; hits = 0; drag = null;
    prompt.textContent = "Cleared. Press inside the circle and drag through the tunnel.";
    drawArena();
    draw();
  });
  root.querySelector("[data-action=simulate]").addEventListener("click", () => {
    // Steering costs roughly 40 ms per unit of A/W on top of ~200 ms.
    const rand = rng(Date.now() & 0xffff);
    all = fresh();
    for (const t of all) for (let i = 0; i < RUNS; i++) t.ts.push((0.2 + 0.04 * t.idx) * Math.exp(0.12 * gauss(rand)));
    hits = Math.round(rand() * 4);
    tunnels = [];
    ti = 0; drag = null;
    prompt.textContent = "Simulated participant: true a = 200 ms, b = 40 ms per unit of A/W.";
    drawArena();
    draw();
  });

  drawArena();
  draw();
}

// ============================================================ Keystroke-level model

for (const root of document.querySelectorAll("[data-hci-klm]")) {
  const o = outs(root);
  const typist = root.querySelector("[data-typist]");
  const inputs = [...root.querySelectorAll("[data-seq]")];
  const OPS = {
    K: { name: "keystroke", color: "var(--vec-u)" },
    P: { name: "point", t: 1.1, color: "var(--vec-v)" },
    B: { name: "button", t: 0.1, color: "var(--vec-i)" },
    H: { name: "home hands", t: 0.4, color: "var(--vec-j)" },
    M: { name: "mental", t: 1.35, color: "var(--vec-out)" },
    W: { name: "wait", color: "currentColor" },
  };

  // "M P B B K*10 W0.5" → [{op, t}], or null when a token is not understood.
  const parse = (s, k) => {
    const ops = [];
    for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
      let m = tok.match(/^([KPBHM])(?:[*×x](\d{1,3}))?$/i);
      if (m) {
        const op = m[1].toUpperCase();
        for (let i = 0; i < Number(m[2] ?? 1); i++) ops.push({ op, t: op === "K" ? k : OPS[op].t });
        continue;
      }
      m = tok.match(/^W(\d*\.?\d+)$/i);
      if (m) { ops.push({ op: "W", t: Number(m[1]) }); continue; }
      return null;
    }
    return ops;
  };

  const legend = root.querySelector("[data-legend]");
  const update = () => {
    const k = Number(typist.value);
    const res = inputs.map((inp) => ({ key: inp.dataset.seq, inp, ops: parse(inp.value, k) }));
    const total = (r) => (r.ops ? r.ops.reduce((s, x) => s + x.t, 0) : NaN);
    const max = Math.max(1, ...res.map(total).filter(Number.isFinite));
    for (const r of res) {
      r.inp.setAttribute("aria-invalid", String(!r.ops));
      const svg = root.querySelector(`[data-bar="${r.key}"]`);
      svg.replaceChildren();
      const T = total(r);
      root.querySelector(`[data-total="${r.key}"]`).textContent = r.ops ? `${T.toFixed(2)} s` : "unknown operator";
      o[r.key].textContent = r.ops ? `${T.toFixed(2)} s` : "—";
      if (!r.ops) continue;
      let x = 0;
      const W = 516 / max;
      for (const s of r.ops) {
        const w = s.t * W;
        el("rect", { x: 2 + x, y: 4, width: Math.max(0.5, w - 0.8), height: 18, rx: 1.5, style: `fill:${OPS[s.op].color};fill-opacity:${s.op === "W" ? 0.25 : 0.85}` }, svg);
        if (w > 11) text(svg, 2 + x + w / 2, 16.5, s.op, { "text-anchor": "middle", class: "fill-background font-mono text-[9px]" });
        x += w;
      }
      for (let s = 0; s <= max; s += 2) el("line", { x1: 2 + s * W, x2: 2 + s * W, y1: 24, y2: 28, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    }
    const [a, b] = res.map(total);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const faster = a > b ? "typed field" : "dropdowns";
      o.diff.textContent = `${faster} faster by ${Math.abs(a - b).toFixed(2)} s (${Math.round((100 * Math.abs(a - b)) / Math.max(a, b))} %)`;
    } else o.diff.textContent = "—";
    legend.replaceChildren(...Object.entries(OPS).map(([op, d]) => {
      const s = document.createElement("span");
      s.className = "flex items-center gap-1.5";
      const sw = document.createElement("span");
      sw.className = "size-2.5 rounded-sm";
      sw.style.background = d.color;
      if (op === "W") sw.style.opacity = "0.3";
      s.append(sw, `${op} ${d.name} ${op === "K" ? k.toFixed(2) + " s" : op === "W" ? "as written" : d.t.toFixed(2) + " s"}`);
      return s;
    }));
  };
  for (const inp of inputs) inp.addEventListener("input", update);
  typist.addEventListener("change", update);
  update();
}

// ============================================================ System Usability Scale

for (const root of document.querySelectorAll("[data-hci-sus]")) {
  const o = outs(root);
  const scale = root.querySelector("[data-scale]");
  const radios = [...root.querySelectorAll("input[type=radio]")];
  const GRADES = [[84.1, "A+"], [80.8, "A"], [78.9, "A−"], [77.2, "B+"], [74.1, "B"], [72.6, "B−"], [71.1, "C+"], [65, "C"], [62.7, "C−"], [51.7, "D"], [0, "F"]];
  const ADJ = [[12.5, "Worst imaginable"], [20.3, "Awful"], [35.7, "Poor"], [50.9, "OK"], [71.4, "Good"], [85.5, "Excellent"], [90.9, "Best imaginable"]];

  const answers = () => {
    const a = Array(10).fill(0);
    for (const r of radios) if (r.checked) a[Number(r.dataset.item) - 1] = Number(r.value);
    return a;
  };

  const drawScale = (score) => {
    scale.replaceChildren();
    const sx = (v) => 10 + v * 2.4;
    el("line", { x1: sx(0), x2: sx(100), y1: 30, y2: 30, style: "stroke:currentColor;stroke-opacity:0.25;stroke-width:6;stroke-linecap:round" }, scale);
    for (const [i, [v, name]] of ADJ.entries()) {
      el("line", { x1: sx(v), x2: sx(v), y1: 24, y2: 36, style: "stroke:currentColor;stroke-opacity:0.4" }, scale);
      text(scale, sx(v), i % 2 ? 50 : 60, name.replace(" imaginable", ""), { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[8px]" });
    }
    el("line", { x1: sx(68), x2: sx(68), y1: 14, y2: 30, style: "stroke:currentColor;stroke-opacity:0.6;stroke-dasharray:2 2" }, scale);
    text(scale, sx(68), 11, "avg 68", { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[8px]" });
    if (score !== null) el("circle", { cx: sx(score), cy: 30, r: 6, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, scale);
  };

  const update = () => {
    const a = answers();
    const done = a.filter(Boolean).length;
    o.answered.textContent = `${done} / 10`;
    if (done < 10) {
      o.score.textContent = "—";
      for (const k of ["pct", "grade", "adj"]) o[k].textContent = "—";
      drawScale(null);
      return;
    }
    // Odd (positive) items: r − 1. Even (negative) items: 5 − r.
    const sum = a.reduce((s, r, i) => s + (i % 2 === 0 ? r - 1 : 5 - r), 0);
    const score = sum * 2.5;
    o.score.textContent = score.toFixed(1).replace(/\.0$/, "");
    o.pct.textContent = `${Math.round(phi((score - 68) / 12.5) * 100)}th`;
    o.grade.textContent = GRADES.find(([lo]) => score >= lo)[1];
    o.adj.textContent = ADJ.reduce((best, x) => (Math.abs(x[0] - score) < Math.abs(best[0] - score) ? x : best))[1];
    drawScale(score);
  };

  const set = (fn) => {
    for (let i = 1; i <= 10; i++) {
      const v = fn(i);
      for (const r of radios) if (Number(r.dataset.item) === i) r.checked = Number(r.value) === v;
    }
    update();
  };
  root.addEventListener("change", update);
  root.querySelector("[data-action=neutral]").addEventListener("click", () => set(() => 3));
  root.querySelector("[data-action=random]").addEventListener("click", () => set(() => 1 + Math.floor(Math.random() * 5)));
  root.querySelector("[data-action=clear]").addEventListener("click", () => set(() => 0));
  update();
}

// ============================================================ Heuristic evaluation

for (const root of document.querySelectorAll("[data-hci-heur]")) {
  const o = outs(root);
  const selected = root.querySelector("[data-selected]");
  const heurSel = root.querySelector("[data-heuristic]");
  const sevSel = root.querySelector("[data-severity]");
  const list = root.querySelector("[data-findings]");
  const H = [...heurSel.options].map((op) => op.textContent.replace(/^H\d+ · /, ""));
  // The planted problems: heuristics that count as a match, and why.
  const FLAWS = {
    jargon: { name: "Form title", ok: [2, 4], why: "“FORM 7B – USR_REG” and “registration object” are the system's words, not the user's (H2)." },
    legal: { name: "Legal text", ok: [8, 2], why: "A wall of 9 px legal prose competes with the task and nobody can read it (H8)." },
    dob: { name: "D.O.B. field", ok: [5, 6, 2], why: "An abbreviated label and no format example invite errors; a date picker or a hint would prevent them (H5)." },
    country: { name: "Country code", ok: [6, 2], why: "Asking for a numeric code from an annex forces recall; a searchable list of names lets people recognise theirs (H6)." },
    password: { name: "Password error", ok: [9, 5, 2], why: "“ERR_0x45: INVALID INPUT” says neither what is wrong nor how to fix it, and the rules were never shown (H9)." },
    status: { name: "“Processing…”", ok: [1], why: "No progress, no estimate, no sign of what is being processed: the user cannot tell whether it is working (H1)." },
    consistency: { name: "“Click Register”", ok: [4], why: "The text says Register but the button says Submit (H4)." },
    clear: { name: "Clear and Submit", ok: [5, 3, 4], why: "The destructive Clear is the big primary button, right next to Submit, with no undo (H5, H3)." },
  };
  let current = null, findings = [], revealed = false;
  const flawEls = [...root.querySelectorAll("[data-flaw]")];

  const select = (elm) => {
    current = elm.dataset.flaw;
    for (const f of flawEls) f.setAttribute("aria-pressed", String(f === elm));
    selected.textContent = `Selected: ${FLAWS[current].name}`;
  };
  for (const f of flawEls) {
    f.addEventListener("click", () => select(f));
    f.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(f); }
    });
  }

  const render = () => {
    list.replaceChildren();
    for (const [i, fd] of findings.entries()) {
      const li = document.createElement("li");
      const match = FLAWS[fd.flaw].ok.includes(fd.h);
      li.className = "flex items-start justify-between gap-2 rounded-md border p-2" + (revealed ? (match ? " border-brand" : " border-[var(--code-del)]") : "");
      const body = document.createElement("div");
      body.className = "flex flex-col gap-0.5";
      const t = document.createElement("span");
      t.className = "font-medium";
      t.textContent = FLAWS[fd.flaw].name;
      const d = document.createElement("span");
      d.className = "text-xs text-muted-foreground";
      d.textContent = `H${fd.h} ${H[fd.h - 1]} · severity ${fd.sev}${revealed ? (match ? " · matches" : ` · expected H${FLAWS[fd.flaw].ok[0]}`) : ""}`;
      body.append(t, d);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "shrink-0 rounded px-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";
      rm.textContent = "Remove";
      rm.setAttribute("aria-label", `Remove finding: ${FLAWS[fd.flaw].name}`);
      rm.addEventListener("click", () => { findings.splice(i, 1); render(); });
      li.append(body, rm);
      list.append(li);
    }
    if (revealed) {
      for (const [k, f] of Object.entries(FLAWS)) {
        const li = document.createElement("li");
        const got = findings.some((fd) => fd.flaw === k);
        li.className = "rounded-md bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground";
        li.textContent = `${got ? "Found" : "Missed"} · ${f.name}: ${f.why}`;
        list.append(li);
      }
    }
    const found = new Set(findings.map((fd) => fd.flaw));
    for (const f of flawEls) f.toggleAttribute("data-found", found.has(f.dataset.flaw));
    o.found.textContent = `${found.size} / ${Object.keys(FLAWS).length}`;
    o.match.textContent = revealed ? `${findings.filter((fd) => FLAWS[fd.flaw].ok.includes(fd.h)).length} / ${findings.length}` : "hidden until reveal";
  };

  root.querySelector("[data-action=add]").addEventListener("click", () => {
    if (!current) { selected.textContent = "Select a part of the form first."; return; }
    findings = findings.filter((fd) => fd.flaw !== current);
    findings.push({ flaw: current, h: Number(heurSel.value), sev: Number(sevSel.value) });
    render();
  });
  root.querySelector("[data-action=reveal]").addEventListener("click", (e) => {
    revealed = !revealed;
    e.currentTarget.lastChild.textContent = revealed ? "Hide" : "Reveal";
    render();
  });
  render();
}
