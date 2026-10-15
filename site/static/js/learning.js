// Learning science tools. Every block root is prefixed data-learn-*, so this
// module does nothing on other pages. User text only reaches the DOM through
// textContent or form values, never innerHTML.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
function mk(tag, cls = "", txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}
const pct = (v) => `${Math.round(v * 100)}%`;
const setCopy = (root, s) => root.querySelectorAll("[data-learn-copy]").forEach((b) => (b.dataset.copy = s));

// ============================================================ forgetting curve

const SCHEDULES = { expanding: "1, 3, 7, 14, 30", uniform: "7, 14, 21, 28, 35, 42", massed: "0.2, 0.4, 0.6, 0.8", none: "" };

for (const root of document.querySelectorAll("[data-learn-forgetting]")) {
  const svg = root.querySelector("[data-plot]");
  const input = root.querySelector("[data-learn-days]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  input.addEventListener("input", draw);
  root.addEventListener("seg-change", (e) => { input.value = SCHEDULES[e.detail.value] ?? ""; draw(); });

  // Retention R(t) = exp(-(t - t_last)/S); each review multiplies S by
  // 1 + (gain - 1)(1 - R): reviewing after more forgetting helps more.
  function simulate(days, s0, gain, T = 60, dt = 0.05) {
    const reviews = days.filter((d) => d > 0 && d <= T).sort((a, b) => a - b);
    let S = s0, last = 0, k = 0;
    const pts = [];
    for (let t = 0; t <= T + 1e-9; t += dt) {
      while (k < reviews.length && reviews[k] <= t) {
        const R = Math.exp(-(reviews[k] - last) / S);
        S *= 1 + (gain - 1) * (1 - R);
        last = reviews[k++];
      }
      pts.push([t, Math.exp(-(t - last) / S)]);
    }
    return { pts, reviews, at: (x) => pts[Math.min(pts.length - 1, Math.round(x / dt))][1] };
  }

  function draw() {
    const days = input.value.split(/[,;\s]+/).map(Number).filter((d) => Number.isFinite(d));
    const run = simulate(days, s.s0.get(), s.gain.get());
    const base = simulate([], s.s0.get(), s.gain.get());
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 580, 260], x: [0, 60], y: [0, 1], xticks: [0, 10, 20, 30, 40, 50, 60], yticks: [0, 0.5, 1], yfmt: (v) => pct(v), xlabel: "days since first study", ylabel: "retention" });
    for (const d of run.reviews) el("line", { x1: f.sx(d), x2: f.sx(d), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
    polyline(svg, base.pts.map(([t, r]) => [f.sx(t), f.sy(r)]), "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1.5;stroke-dasharray:4 4");
    polyline(svg, run.pts.map(([t, r]) => [f.sx(t), f.sy(r)]), "stroke:var(--brand);stroke-width:2");
    text(svg, f.L + f.W - 4, f.sy(base.at(58)) - 6, "no reviews", { "text-anchor": "end" });
    const avg = (r) => r.pts.reduce((a, p) => a + p[1], 0) / r.pts.length;
    o.avg.textContent = pct(avg(run));
    o.base.textContent = `${pct(avg(base))} average`;
    o.r60.textContent = pct(run.at(60));
    o.count.textContent = String(run.reviews.length);
  }
  draw();
}

// ============================================================ spacing planner

for (const root of document.querySelectorAll("[data-learn-spacing]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const ri = s.ri.get(), gap = Math.min(s.gap.get(), ri);
    const peak = 0.15 * ri;
    // Schematic inverted U on a log gap axis, peaking at 15% of the interval.
    const curve = (g) => 0.35 + 0.45 * Math.exp(-((Math.log(g + 1) - Math.log(peak + 1)) ** 2) / (2 * 0.8 ** 2));
    const xmax = Math.max(1, Math.round(ri * 0.6));
    svg.replaceChildren();
    const f = frame(svg, { box: [36, 16, 584, 236], x: [0, xmax], y: [0, 1], xticks: [0, Math.round(xmax / 4), Math.round(xmax / 2), Math.round((3 * xmax) / 4), xmax], yticks: [], xlabel: "gap between the two sessions (days)", ylabel: "final recall (schematic)" });
    const lo = 0.1 * ri, hi = 0.2 * ri;
    el("rect", { x: f.sx(lo), y: f.T, width: Math.max(1, f.sx(Math.min(hi, xmax)) - f.sx(lo)), height: f.H, style: "fill:var(--code-add);fill-opacity:0.1" }, svg);
    text(svg, f.sx((lo + Math.min(hi, xmax)) / 2), f.T + 12, "10–20%", { "text-anchor": "middle", style: "fill:var(--code-add)" });
    const pts = [];
    for (let i = 0; i <= 200; i++) { const g = (xmax * i) / 200; pts.push([f.sx(g), f.sy(curve(g))]); }
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.75");
    const gx = Math.min(gap, xmax);
    el("line", { x1: f.sx(gx), x2: f.sx(gx), y1: f.sy(curve(gx)), y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(gx), cy: f.sy(curve(gx)), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    const r = (v) => Math.max(1, Math.round(v));
    o.range.textContent = `${r(lo)}–${r(hi)} days`;
    const share = gap / ri;
    o.share.textContent = `${num(share * 100, 0)}% of the interval · ${share < 0.08 ? "short" : share > 0.3 ? "long" : share >= 0.1 && share <= 0.2 ? "in range" : "close"}`;
    const g = r(peak);
    o.plan.textContent = `study day 0 · review day ${g} · test day ${r(ri)}`;
  }
  draw();
}

// ============================================================ retrieval practice

const STOP = new Set("because between through without another however although something students practice information remembered remember".split(" "));

for (const root of document.querySelectorAll("[data-learn-retrieval]")) {
  const notes = root.querySelector('[data-learn-field="notes"]');
  const recall = root.querySelector('[data-learn-field="recall"]');
  const pane = (n) => root.querySelector(`[data-learn-pane="${n}"]`);
  const stage = root.querySelector("[data-learn-stage]");
  const timer = root.querySelector("[data-learn-timer]");
  const chips = root.querySelector("[data-learn-chips]");
  const score = root.querySelector("[data-learn-score]");
  let t0 = 0, tick = 0;

  const keyIdeas = (s) => [...new Set(s.toLowerCase().match(/\p{L}{7,}/gu) ?? [])].filter((w) => !STOP.has(w));
  const stem = (w) => w.slice(0, 6);
  const show = (...names) => ["notes", "recall", "result"].forEach((n) => (pane(n).hidden = !names.includes(n)));

  root.querySelector('[data-learn-action="hide"]').addEventListener("click", () => {
    show("recall");
    stage.textContent = "2 · Recall without looking";
    t0 = performance.now();
    clearInterval(tick);
    tick = setInterval(() => (timer.textContent = `${Math.floor((performance.now() - t0) / 1000)} s`), 500);
    recall.focus();
  });
  root.querySelector('[data-learn-action="compare"]').addEventListener("click", () => {
    clearInterval(tick);
    const ideas = keyIdeas(notes.value);
    const said = new Set((recall.value.toLowerCase().match(/\p{L}{4,}/gu) ?? []).map(stem));
    chips.replaceChildren();
    let hit = 0;
    for (const w of ideas) {
      const ok = said.has(stem(w));
      if (ok) hit++;
      chips.append(mk("span", "rounded-full border px-2 py-0.5 text-xs " + (ok ? "border-add/40 bg-add/10 text-add" : "border-dashed text-muted-foreground"), w));
    }
    score.textContent = ideas.length ? `${hit} / ${ideas.length}` : "—";
    show("notes", "result");
    stage.textContent = "3 · Compare and study what you missed";
  });
  root.querySelector('[data-learn-action="restart"]').addEventListener("click", () => {
    clearInterval(tick);
    recall.value = "";
    timer.textContent = "";
    show("notes");
    stage.textContent = "1 · Read your notes";
  });
}

// ============================================================ interleaving

const SHAPES = [
  { key: "rect", color: "var(--vec-u)", make: (r) => { const a = r(2, 12), b = r(2, 12); return { q: `Area of a rectangle ${a} by ${b}`, a: a * b }; } },
  { key: "tri", color: "var(--brand)", make: (r) => { const b = r(2, 14), h = r(2, 12); return { q: `Area of a triangle with base ${b} and height ${h}`, a: (b * h) / 2 }; } },
  { key: "circle", color: "var(--ion-cl)", make: (r) => { const ra = r(1, 9); return { q: `Area of a circle of radius ${ra} (π ≈ 3.14)`, a: 3.14 * ra * ra }; } },
  { key: "trap", color: "var(--vec-out)", make: (r) => { const a = r(2, 10), b = r(a + 1, 14), h = r(2, 9); return { q: `Area of a trapezoid with parallel sides ${a} and ${b}, height ${h}`, a: ((a + b) * h) / 2 }; } },
];

for (const root of document.querySelectorAll("[data-learn-interleave]")) {
  const list = root.querySelector("[data-learn-problems]");
  const seq = root.querySelector("[data-learn-seq]");
  const result = root.querySelector("[data-learn-result]");
  let order = "interleaved", set = [];
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function generate() {
    set = [];
    for (const s of SHAPES) for (let i = 0; i < 3; i++) set.push({ shape: s, ...s.make(rand) });
    render();
  }
  function arranged() {
    if (order === "blocked") return set;
    // Shuffle, then repair runs so no two neighbours share a type.
    const out = [...set].sort(() => Math.random() - 0.5);
    for (let i = 1; i < out.length; i++) {
      if (out[i].shape === out[i - 1].shape) {
        const j = out.findIndex((p, k) => k > i && p.shape !== out[i].shape && p.shape !== out[i - 1]?.shape);
        if (j > 0) [out[i], out[j]] = [out[j], out[i]];
      }
    }
    return out;
  }
  function render() {
    const items = arranged();
    seq.replaceChildren(...items.map((p) => { const d = mk("span", "h-1.5 flex-1 rounded-full"); d.style.background = p.shape.color; return d; }));
    list.replaceChildren();
    items.forEach((p, i) => {
      const li = mk("li", "flex flex-col gap-1.5 rounded-lg border p-3 text-sm");
      li.dataset.answer = String(p.a);
      const head = mk("span", "flex items-center gap-2");
      const dot = mk("span", "size-2 shrink-0 rounded-full");
      dot.style.background = p.shape.color;
      head.append(mk("span", "font-mono text-[11px] text-muted-foreground", String(i + 1).padStart(2, "0")), dot, mk("span", "", p.q));
      const row = mk("span", "flex items-center gap-2");
      const inp = mk("input", "h-8 w-28 rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm");
      inp.inputMode = "decimal";
      inp.autocomplete = "off";
      inp.setAttribute("aria-label", `Answer ${i + 1}`);
      row.append(inp, mk("span", "text-xs text-muted-foreground"));
      li.append(head, row);
      list.append(li);
    });
    result.textContent = "";
  }
  root.addEventListener("seg-change", (e) => { order = e.detail.value; render(); });
  root.querySelector('[data-learn-action="new"]').addEventListener("click", generate);
  root.querySelector('[data-learn-action="check"]').addEventListener("click", () => {
    let ok = 0, n = 0;
    for (const li of list.children) {
      const inp = li.querySelector("input"), note = li.querySelector("span:last-child");
      const want = Number(li.dataset.answer), got = parseFloat(inp.value.replace(",", "."));
      n++;
      const right = Number.isFinite(got) && Math.abs(got - Math.round(want * 10) / 10) < 0.051;
      if (right) ok++;
      li.classList.toggle("border-add", right);
      li.classList.toggle("border-del", !right);
      note.textContent = right ? "✓" : `✗ ${num(want, 1)}`;
      note.className = "text-xs " + (right ? "text-add" : "text-del");
    }
    result.textContent = `${ok} / ${n} correct`;
  });
  generate();
}

// ============================================================ elaboration prompts

const PROMPTS = {
  why: [
    "Why is it true that {t}?",
    "Why does {t} — and not the opposite?",
    "What would change if it were not true that {t}?",
    "Why might {t} hold in some cases but not in others?",
    "How does \"{t}\" connect to something you already know?",
    "What evidence would convince a sceptic that {t}?",
    "Why would someone get this wrong, and believe the opposite?",
  ],
  how: [
    "Explain step by step how {t}.",
    "Which earlier idea does each step of \"{t}\" rely on?",
    "What would a beginner need to know first to understand \"{t}\"?",
    "Where would a beginner get stuck in \"{t}\", and why?",
    "Draw \"{t}\" as a diagram: what are the parts and the arrows?",
    "What new information did \"{t}\" add to what you knew before?",
    "Put \"{t}\" in your own words without its key technical term.",
  ],
};

for (const root of document.querySelectorAll("[data-learn-elaboration]")) {
  const topic = root.querySelector("[data-learn-topic]");
  const list = root.querySelector("[data-learn-prompts]");
  let kind = "why", offset = 0;
  function render() {
    const t = topic.value.trim().replace(/[.!?]+$/, "") || "this idea";
    const lower = t.charAt(0).toLowerCase() + t.slice(1);
    const all = PROMPTS[kind];
    const picked = Array.from({ length: 4 }, (_, i) => all[(offset + i) % all.length].replaceAll("{t}", lower));
    list.replaceChildren(...picked.map((p) => mk("li", "", p)));
    setCopy(root, picked.map((p, i) => `${i + 1}. ${p}`).join("\n"));
  }
  topic.addEventListener("input", render);
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; offset = 0; render(); });
  root.querySelector('[data-learn-action="shuffle"]').addEventListener("click", () => { offset = (offset + 4) % PROMPTS[kind].length; render(); });
  render();
}

// ============================================================ calibration

for (const root of document.querySelectorAll("[data-learn-calibration]")) {
  const qs = [...root.querySelectorAll("[data-learn-q]")];
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const answers = new Map();

  for (const q of qs) {
    for (const b of q.querySelectorAll("[data-learn-ans]")) {
      b.addEventListener("click", () => {
        answers.set(q, b.dataset.learnAns === "true");
        q.querySelectorAll("[data-learn-ans]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        o.answered.textContent = `${answers.size} / ${qs.length}`;
      });
    }
  }

  function plot(points) {
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 266, 240], x: [0.5, 1], y: [0, 1], xticks: [0.5, 0.75, 1], yticks: [0, 0.5, 1], xfmt: pct, yfmt: pct, xlabel: "confidence", ylabel: "right" });
    el("line", { x1: f.sx(0.5), y1: f.sy(0.5), x2: f.sx(1), y2: f.sy(1), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, svg);
    text(svg, f.sx(0.98), f.sy(0.93) + 14, "perfect", { "text-anchor": "end" });
    if (points.length > 1) polyline(svg, points.map((p) => [f.sx(p.c), f.sy(p.acc)]), "stroke:var(--brand);stroke-width:1.75");
    for (const p of points) el("circle", { cx: f.sx(p.c), cy: f.sy(p.acc), r: 3 + 2 * p.n, style: "fill:var(--brand);fill-opacity:0.25;stroke:var(--brand);stroke-width:1.5" }, svg);
  }

  root.querySelector('[data-learn-action="score"]').addEventListener("click", () => {
    const rows = [];
    for (const q of qs) {
      const mark = q.querySelector("[data-learn-mark]");
      if (!answers.has(q)) { mark.textContent = "not answered"; mark.className = "text-xs text-muted-foreground"; continue; }
      const right = answers.get(q) === (q.dataset.truth === "true");
      const c = Number(q.querySelector("[data-learn-conf]").value) / 100;
      rows.push({ c, o: right ? 1 : 0 });
      mark.textContent = `${right ? "✓" : "✗"} ${q.dataset.truth === "true" ? "True" : "False"}. ${q.dataset.note}`;
      mark.className = "text-xs " + (right ? "text-add" : "text-del");
    }
    if (!rows.length) return;
    const acc = rows.reduce((a, r) => a + r.o, 0) / rows.length;
    const conf = rows.reduce((a, r) => a + r.c, 0) / rows.length;
    const brier = rows.reduce((a, r) => a + (r.c - r.o) ** 2, 0) / rows.length;
    const bins = new Map();
    for (const r of rows) { const b = bins.get(r.c) ?? { c: r.c, n: 0, k: 0 }; b.n++; b.k += r.o; bins.set(r.c, b); }
    plot([...bins.values()].sort((a, b) => a.c - b.c).map((b) => ({ c: b.c, acc: b.k / b.n, n: b.n })));
    o.acc.textContent = pct(acc);
    o.conf.textContent = pct(conf);
    o.brier.textContent = num(brier, 3);
    const gap = conf - acc;
    o.verdict.textContent = gap > 0.05 ? `overconfident by ${Math.round(gap * 100)} points` : gap < -0.05 ? `underconfident by ${Math.round(-gap * 100)} points` : "well calibrated";
  });
  root.querySelector('[data-learn-action="reset"]').addEventListener("click", () => {
    answers.clear();
    for (const q of qs) {
      q.querySelectorAll("[data-learn-ans]").forEach((x) => x.setAttribute("aria-pressed", "false"));
      q.querySelector("[data-learn-conf]").value = "70";
      q.querySelector("[data-learn-mark]").textContent = "";
    }
    o.answered.textContent = `0 / ${qs.length}`;
    for (const k of ["acc", "conf", "brier", "verdict"]) o[k].textContent = "—";
    plot([]);
  });
  plot([]);
}

// ============================================================ focus timer

const CIRC = 2 * Math.PI * 54;

for (const root of document.querySelectorAll("[data-learn-focus]")) {
  const clock = root.querySelector("[data-learn-clock]");
  const phaseEl = root.querySelector("[data-learn-phase]");
  const arc = root.querySelector("[data-arc]");
  const toggleBtn = root.querySelector('[data-learn-action="toggle"]');
  const log = root.querySelector("[data-learn-log]");
  const total = root.querySelector("[data-learn-total]");
  const s = scrubAll(root, () => { if (!running) { remaining = length(); paint(); } });
  root.tabIndex = 0;
  root.classList.add("outline-none", "focus-visible:ring-2", "focus-visible:ring-ring/50");

  // Four focus blocks, short breaks between, a long break after the fourth.
  const PHASES = ["work", "short", "work", "short", "work", "short", "work", "long"];
  let idx = 0, running = false, endAt = 0, remaining = 0, timer = 0;
  const length = () => s[PHASES[idx]].get() * 60 * 1000;
  remaining = length();

  const today = () => new Date().toISOString().slice(0, 10);
  const entries = () => store.get("learn-focus-log", []).filter((e) => e.day === today());

  function paintLog() {
    const list = entries();
    log.replaceChildren(...list.slice(-8).reverse().map((e) => {
      const li = mk("li", "flex justify-between text-muted-foreground");
      li.append(mk("span", "", e.at), mk("span", "", `${e.min} min focus`));
      return li;
    }));
    const min = list.reduce((a, e) => a + e.min, 0);
    total.textContent = `${list.length} session${list.length === 1 ? "" : "s"} · ${min} min`;
  }
  function paint() {
    const secs = Math.max(0, Math.ceil(remaining / 1000));
    clock.textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    const kind = PHASES[idx];
    const n = Math.floor(idx / 2) + 1;
    phaseEl.textContent = kind === "work" ? `Focus · ${n} of 4` : kind === "short" ? "Short break" : "Long break";
    arc.setAttribute("stroke", kind === "work" ? "var(--brand)" : "var(--code-add)");
    arc.setAttribute("stroke-dashoffset", String(CIRC * (1 - remaining / length())));
    toggleBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", running);
    toggleBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !running);
    toggleBtn.querySelector("[data-label]").textContent = running ? "Pause" : "Start";
  }
  function finish(completed) {
    if (completed && PHASES[idx] === "work") {
      const at = new Date().toTimeString().slice(0, 5);
      store.set("learn-focus-log", [...store.get("learn-focus-log", []), { day: today(), at, min: s.work.get() }].slice(-200));
      paintLog();
    }
    idx = (idx + 1) % PHASES.length;
    running = false;
    clearInterval(timer);
    remaining = length();
    paint();
  }
  function tick() {
    remaining = endAt - Date.now();
    if (remaining <= 0) finish(true);
    else paint();
  }
  function toggle() {
    running = !running;
    if (running) { endAt = Date.now() + remaining; timer = setInterval(tick, 250); }
    else { clearInterval(timer); remaining = endAt - Date.now(); }
    paint();
  }
  toggleBtn.addEventListener("click", toggle);
  root.querySelector('[data-learn-action="skip"]').addEventListener("click", () => finish(false));
  root.querySelector('[data-learn-action="reset"]').addEventListener("click", () => { clearInterval(timer); running = false; idx = 0; remaining = length(); paint(); });
  root.addEventListener("keydown", (e) => {
    if (e.key === " " && e.target === root) { e.preventDefault(); toggle(); }
  });
  paint();
  paintLog();
}

// ============================================================ Feynman workspace

for (const root of document.querySelectorAll("[data-learn-feynman]")) {
  const steps = [...root.querySelectorAll("[data-learn-step]")];
  const fields = Object.fromEntries([...root.querySelectorAll("[data-learn-field]")].map((f) => [f.dataset.learnField, f]));
  const back = root.querySelector('[data-learn-go="-1"]'), next = root.querySelector('[data-learn-go="1"]');
  const o = outs(root);
  let at = 0;

  const saved = store.get("learn-feynman", null);
  if (saved) for (const [k, v] of Object.entries(saved)) if (fields[k] && typeof v === "string") fields[k].value = v;

  function meter() {
    const src = (at >= 3 ? fields.refine : fields.explain).value || fields.explain.value;
    const words = src.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
    const sentences = src.split(/[.!?]+/).filter((x) => x.trim()).length;
    const long = [...new Set(words.filter((w) => w.length >= 12).map((w) => w.toLowerCase()))];
    o.words.textContent = String(words.length);
    o.wps.textContent = sentences ? num(words.length / sentences, 1) : "—";
    o.long.textContent = words.length ? String(long.length) : "—";
    o.flagged.textContent = long.length ? `check: ${long.slice(0, 8).join(", ")}` : words.length ? "no long words" : "";
    o.wps.className = sentences && words.length / sentences > 20 ? "text-del" : "";
  }
  function exportMd() {
    const v = (k) => fields[k].value.trim() || "_(empty)_";
    setCopy(root, `# ${fields.concept.value.trim() || "Concept"}\n\n## Simple explanation\n\n${v("explain")}\n\n## Gaps\n\n${v("gaps")}\n\n## Refined explanation\n\n${v("refine")}\n`);
  }
  function go(i) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => (s.hidden = k !== at));
    back.disabled = at === 0;
    next.disabled = at === steps.length - 1;
    meter();
  }
  for (const f of Object.values(fields)) f.addEventListener("input", () => {
    store.set("learn-feynman", Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, x.value])));
    meter();
    exportMd();
  });
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  go(0);
  exportMd();
}

// ============================================================ concept map

const MAP_PRESET = {
  nodes: [
    { id: 1, label: "Plants", x: 300, y: 70 },
    { id: 2, label: "Leaves", x: 110, y: 180 },
    { id: 3, label: "Chlorophyll", x: 120, y: 330 },
    { id: 4, label: "Sunlight", x: 330, y: 360 },
    { id: 5, label: "Carbon dioxide", x: 510, y: 140 },
    { id: 6, label: "Sugar", x: 360, y: 230 },
    { id: 7, label: "Oxygen", x: 540, y: 300 },
  ],
  links: [
    { from: 1, to: 2, label: "have" },
    { from: 2, to: 3, label: "contain" },
    { from: 3, to: 4, label: "absorbs" },
    { from: 1, to: 5, label: "take in" },
    { from: 1, to: 6, label: "make" },
    { from: 1, to: 7, label: "release" },
  ],
};

for (const root of document.querySelectorAll("[data-learn-cmap]")) {
  const svg = root.querySelector("[data-canvas]");
  const from = root.querySelector("[data-learn-from]"), to = root.querySelector("[data-learn-to]");
  const labelIn = root.querySelector("[data-learn-label]"), newIn = root.querySelector("[data-learn-new]");
  const props = root.querySelector("[data-learn-props]"), count = root.querySelector("[data-learn-count]");
  let map = store.get("learn-cmap", null) ?? structuredClone(MAP_PRESET);
  let selected = null;
  const W = 640, H = 420;
  const width = (n) => Math.max(64, n.label.length * 7.4 + 24);
  const byId = (id) => map.nodes.find((n) => n.id === id);
  const save = () => store.set("learn-cmap", map);

  // Where the segment from a node's centre toward a point leaves its box.
  function edge(n, tx, ty) {
    const dx = tx - n.x, dy = ty - n.y, hw = width(n) / 2 + 3, hh = 17;
    const s = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
    return [n.x + dx * Math.min(1, s), n.y + dy * Math.min(1, s)];
  }

  function toWorld(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }

  function draw() {
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    const m = el("marker", { id: "learn-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0 L10 5 L0 10 Z", style: "fill:var(--muted-foreground)" }, m);
    for (const l of map.links) {
      const a = byId(l.from), b = byId(l.to);
      if (!a || !b) continue;
      const [x1, y1] = edge(a, b.x, b.y), [x2, y2] = edge(b, a.x, a.y);
      el("line", { x1, y1, x2, y2, "marker-end": "url(#learn-arrow)", style: "stroke:var(--muted-foreground);stroke-width:1.25" }, svg);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, w = l.label.length * 6.4 + 10;
      el("rect", { x: mx - w / 2, y: my - 9, width: w, height: 18, rx: 4, style: "fill:var(--code-bg)" }, svg);
      text(svg, mx, my + 4, l.label, { "text-anchor": "middle", class: "fill-muted-foreground text-[11px] italic" });
    }
    for (const n of map.nodes) {
      const w = width(n);
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `Concept ${n.label}`, class: "cursor-grab outline-none", "data-node": n.id }, svg);
      el("rect", { x: n.x - w / 2, y: n.y - 16, width: w, height: 32, rx: 8, style: `fill:var(--background);stroke:${selected === n.id ? "var(--brand)" : "var(--border)"};stroke-width:${selected === n.id ? 2 : 1.25}` }, g);
      text(g, n.x, n.y + 4.5, n.label, { "text-anchor": "middle", class: "fill-foreground font-sans text-[13px]" });
      g.addEventListener("pointerdown", (e) => {
        selected = n.id;
        g.setPointerCapture(e.pointerId);
        const [px, py] = toWorld(e), ox = n.x - px, oy = n.y - py;
        const move = (ev) => {
          const [qx, qy] = toWorld(ev);
          n.x = Math.max(width(n) / 2, Math.min(W - width(n) / 2, qx + ox));
          n.y = Math.max(18, Math.min(H - 18, qy + oy));
          draw();
          svg.querySelector(`[data-node="${n.id}"]`)?.focus({ preventScroll: true });
        };
        const up = () => { g.removeEventListener("pointermove", move); save(); };
        g.addEventListener("pointermove", move);
        g.addEventListener("pointerup", up, { once: true });
        draw();
      });
      g.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
        if (d) {
          e.preventDefault();
          n.x = Math.max(width(n) / 2, Math.min(W - width(n) / 2, n.x + d[0]));
          n.y = Math.max(18, Math.min(H - 18, n.y + d[1]));
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          map.nodes = map.nodes.filter((x) => x !== n);
          map.links = map.links.filter((l) => l.from !== n.id && l.to !== n.id);
          selected = null;
          refresh();
          return;
        } else return;
        selected = n.id;
        save();
        draw();
        svg.querySelector(`[data-node="${n.id}"]`)?.focus({ preventScroll: true });
      });
      g.addEventListener("focus", () => { if (selected !== n.id) { selected = n.id; } });
    }
  }

  function refresh() {
    for (const s of [from, to]) {
      const keep = s.value;
      s.replaceChildren(...map.nodes.map((n) => { const o = mk("option", "", n.label); o.value = String(n.id); return o; }));
      if (map.nodes.some((n) => String(n.id) === keep)) s.value = keep;
    }
    if (from.value === to.value && map.nodes.length > 1) to.selectedIndex = (from.selectedIndex + 1) % map.nodes.length;
    props.replaceChildren();
    const lines = [];
    map.links.forEach((l, i) => {
      const a = byId(l.from), b = byId(l.to);
      if (!a || !b) return;
      lines.push(`- ${a.label} — ${l.label} → ${b.label}`);
      const li = mk("li", "flex items-center justify-between gap-2");
      const t = mk("span", "min-w-0");
      t.append(mk("span", "font-medium", a.label), document.createTextNode(` — ${l.label} → `), mk("span", "font-medium", b.label));
      const del = mk("button", "shrink-0 rounded px-1.5 text-xs text-muted-foreground hover:text-del focus-visible:ring-2 focus-visible:ring-ring/50 outline-none", "remove");
      del.type = "button";
      del.setAttribute("aria-label", `Remove link ${a.label} ${l.label} ${b.label}`);
      del.addEventListener("click", () => { map.links.splice(i, 1); refresh(); });
      li.append(t, del);
      props.append(li);
    });
    count.textContent = `${map.nodes.length} concepts · ${map.links.length} links`;
    setCopy(root, lines.join("\n"));
    save();
    draw();
  }

  root.querySelector('[data-learn-action="add"]').addEventListener("click", () => {
    const label = newIn.value.trim().slice(0, 40);
    if (!label) return newIn.focus();
    const id = Math.max(0, ...map.nodes.map((n) => n.id)) + 1;
    const k = map.nodes.length;
    map.nodes.push({ id, label, x: 90 + ((k * 137) % 460), y: 50 + ((k * 89) % 320) });
    newIn.value = "";
    refresh();
  });
  newIn.addEventListener("keydown", (e) => { if (e.key === "Enter") root.querySelector('[data-learn-action="add"]').click(); });
  root.querySelector('[data-learn-action="link"]').addEventListener("click", () => {
    const a = Number(from.value), b = Number(to.value), label = labelIn.value.trim().slice(0, 30) || "relates to";
    if (!a || !b || a === b) return;
    map.links.push({ from: a, to: b, label });
    labelIn.value = "";
    refresh();
  });
  root.querySelector('[data-learn-action="reset"]').addEventListener("click", () => { map = structuredClone(MAP_PRESET); selected = null; refresh(); });
  refresh();
}
