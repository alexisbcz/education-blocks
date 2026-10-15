// Psychology & cognitive science blocks. The experiments measure the
// learner: timings use performance.now() from the frame the stimulus is
// painted, stimuli appear and vanish instantly (no animation), and every
// result stays in memory in this page.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// The time the stimulus actually reached the screen: the next frame after
// it was written to the DOM.
const shown = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now()))));

// Inverse standard normal CDF (Acklam), |error| < 1.2e-9.
function probit(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
// Standard normal CDF from the Numerical Recipes erfc approximation
// (fractional error < 1.2e-7), accurate enough in the ROC tails.
function phi(x) {
  const t = 1 / (1 + 0.5 * Math.abs(x) / Math.SQRT2);
  const y = t * Math.exp(-((x / Math.SQRT2) ** 2) - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - y / 2 : y / 2;
}

// ============================================================ Reaction time

for (const root of document.querySelectorAll("[data-psych-rt]")) {
  const stage = root.querySelector("[data-stage]");
  const lampsBox = root.querySelector("[data-lamps]");
  const prompt = root.querySelector("[data-prompt]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const startBtn = root.querySelector("[data-action=start]");
  const PER = 10;
  let n = 1, data = { 1: [], 2: [], 4: [], 8: [] }, running = false, lit = -1, t0 = 0, timer = 0, left = 0, early = 0;

  const lamps = () => {
    lampsBox.replaceChildren();
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.lamp = i;
      b.className = "flex size-12 items-center justify-center rounded-full border-2 border-border font-mono text-sm text-muted-foreground data-[on]:border-brand data-[on]:bg-brand data-[on]:text-white";
      b.textContent = String(i + 1);
      b.setAttribute("aria-label", `Lamp ${i + 1}`);
      lampsBox.append(b);
    }
  };

  const schedule = () => {
    if (!left) { running = false; startBtn.disabled = false; prompt.textContent = `Done: ${data[n].length} trials with ${n} lamp${n > 1 ? "s" : ""}. Pick another setting.`; return; }
    prompt.textContent = "Wait for a lamp…";
    timer = setTimeout(async () => {
      lit = Math.floor(Math.random() * n);
      lampsBox.children[lit].dataset.on = "";
      t0 = await shown();
    }, 800 + Math.random() * 1400); // random foreperiod: no rhythm to anticipate
  };

  const respond = (i) => {
    if (!running) return;
    const now = performance.now();
    if (lit < 0) { // pressed before the lamp: too early
      clearTimeout(timer);
      early++;
      o.early.textContent = String(early);
      prompt.textContent = "Too early. Wait for the lamp.";
      return setTimeout(schedule, 700);
    }
    if (!t0) return; // lamp written but not painted yet
    const rt = now - t0;
    delete lampsBox.children[lit].dataset.on;
    const correct = i === lit;
    lit = -1; t0 = 0;
    if (correct) { data[n].push(rt); left--; o.last.textContent = `${Math.round(rt)} ms`; }
    else { o.last.textContent = "wrong lamp"; }
    o.trials.textContent = String(Object.values(data).reduce((s, a) => s + a.length, 0));
    draw();
    schedule();
  };

  stage.addEventListener("keydown", (e) => {
    const k = Number(e.key);
    if (k >= 1 && k <= 8) { e.preventDefault(); respond(k - 1); }
  });
  lampsBox.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-lamp]");
    if (b) respond(Number(b.dataset.lamp));
  });
  lampsBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lamp]");
    if (b && e.detail === 0) respond(Number(b.dataset.lamp));
  });
  root.addEventListener("seg-change", (e) => {
    if (running) return;
    n = Number(e.detail.value);
    lamps();
  });
  startBtn.addEventListener("click", () => {
    running = true; startBtn.disabled = true; left = PER; lit = -1; t0 = 0;
    stage.focus();
    schedule();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => {
    clearTimeout(timer);
    running = false; startBtn.disabled = false; lit = -1;
    data = { 1: [], 2: [], 4: [], 8: [] }; early = 0;
    for (const k of ["last", "trials", "a", "b"]) o[k].textContent = "—";
    o.early.textContent = "0";
    lamps(); draw();
  });

  function draw() {
    svg.replaceChildren();
    const pts = Object.entries(data).filter(([, a]) => a.length).map(([k, a]) => [Math.log2(Number(k) + 1), mean(a)]);
    const ymax = Math.max(600, ...pts.map((p) => p[1] + 50));
    const f = frame(svg, { box: [48, 14, 452, 170], x: [0.8, 3.4], y: [0, ymax], xticks: [1, Math.log2(3), Math.log2(5), Math.log2(9)], xfmt: (v) => `n=${Math.round(2 ** v - 1)}`, yticks: [0, 200, 400, 600, 800].filter((v) => v <= ymax), xlabel: "log₂(n + 1)", ylabel: "mean RT (ms)" });
    // Individual trials, faint, then the means.
    for (const [k, a] of Object.entries(data)) for (const rt of a) el("circle", { cx: f.sx(Math.log2(Number(k) + 1)), cy: f.sy(rt), r: 2, style: "fill:var(--foreground);fill-opacity:0.2" }, svg);
    for (const [x, y] of pts) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    if (pts.length >= 2) {
      const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
      const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      const b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx;
      const a = my - b * mx;
      polyline(svg, [[f.sx(0.8), f.sy(a + b * 0.8)], [f.sx(3.4), f.sy(a + b * 3.4)]], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 4");
      o.a.textContent = `${Math.round(a)} ms`;
      o.b.textContent = `${Math.round(b)} ms/bit`;
    } else if (pts.length === 0) {
      text(svg, 260, 100, "Your means appear here", { "text-anchor": "middle" });
    }
  }
  lamps();
  draw();
}

// ============================================================ Stroop

const INKS = { red: "var(--code-del)", blue: "var(--vec-u)", green: "var(--code-add)", yellow: "var(--vec-out)" };
const NAMES = Object.keys(INKS);

for (const root of document.querySelectorAll("[data-psych-stroop]")) {
  const stage = root.querySelector("[data-stage]");
  const word = root.querySelector("[data-word]");
  const prompt = root.querySelector("[data-prompt]");
  const progress = root.querySelector("[data-progress]");
  const results = root.querySelector("[data-results]");
  const svg = root.querySelector("[data-plot]");
  const startBtn = root.querySelector("[data-action=start]");
  const o = outs(root);
  const N = 24;
  let trials = [], i = 0, t0 = 0, running = false;

  // Half congruent, half incongruent, shuffled.
  const makeTrials = () => {
    const t = [];
    for (let k = 0; k < N; k++) {
      const w = NAMES[k % 4];
      const congruent = k < N / 2;
      let ink = w;
      if (!congruent) { const others = NAMES.filter((n) => n !== w); ink = others[Math.floor(Math.random() * 3)]; }
      t.push({ w, ink, congruent });
    }
    for (let k = t.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [t[k], t[j]] = [t[j], t[k]]; }
    return t;
  };

  const next = () => {
    word.textContent = "";
    t0 = 0;
    if (i >= N) return finish();
    setTimeout(async () => {
      const tr = trials[i];
      word.textContent = tr.w.toUpperCase();
      word.style.color = INKS[tr.ink];
      t0 = await shown();
    }, 400 + Math.random() * 400);
  };

  const answer = (ink) => {
    if (!running || !t0) return;
    const rt = performance.now() - t0;
    const tr = trials[i];
    tr.rt = rt;
    tr.correct = ink === tr.ink;
    i++;
    progress.textContent = `${i} / ${N}`;
    next();
  };

  function finish() {
    running = false;
    startBtn.disabled = false;
    prompt.hidden = false;
    prompt.textContent = "Done. Press Start to run it again.";
    word.hidden = true;
    const ok = (c) => trials.filter((t) => t.correct && t.congruent === c).map((t) => t.rt);
    const con = mean(ok(true)), inc = mean(ok(false));
    o.con.textContent = `${Math.round(con)} ms`;
    o.inc.textContent = `${Math.round(inc)} ms`;
    const diff = Math.round(inc - con);
    o.diff.textContent = `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${Math.abs(diff)} ms`;
    o.err.textContent = String(trials.filter((t) => !t.correct).length);
    results.hidden = false;
    svg.replaceChildren();
    const ymax = Math.max(800, con + 100, inc + 100);
    const f = frame(svg, { box: [48, 10, 300, 110], x: [0, 2], y: [0, ymax], xticks: [], yticks: [0, Math.round(ymax / 2 / 100) * 100], ylabel: "ms" });
    [[con, "congruent", "var(--foreground)"], [inc, "incongruent", "var(--brand)"]].forEach(([v, label, c], k) => {
      const x = f.sx(k + 0.25), w = f.sx(0.5) - f.sx(0);
      el("rect", { x, y: f.sy(v), width: w, height: f.T + f.H - f.sy(v), rx: 3, style: `fill:${c};fill-opacity:0.8` }, svg);
      text(svg, x + w / 2, f.T + f.H + 14, label, { "text-anchor": "middle" });
    });
  }

  startBtn.addEventListener("click", () => {
    trials = makeTrials(); i = 0; running = true;
    startBtn.disabled = true;
    results.hidden = true;
    prompt.hidden = true;
    word.hidden = false;
    progress.textContent = `0 / ${N}`;
    stage.focus();
    next();
  });
  stage.addEventListener("keydown", (e) => {
    const ink = { r: "red", b: "blue", g: "green", y: "yellow" }[e.key.toLowerCase()];
    if (ink) { e.preventDefault(); answer(ink); }
  });
  // Pointer responses are timed on pointerdown (click fires on release);
  // keyboard activation of a button arrives as a click with detail 0.
  root.querySelectorAll("[data-ink]").forEach((b) => {
    b.addEventListener("pointerdown", () => answer(b.dataset.ink));
    b.addEventListener("click", (e) => { if (e.detail === 0) answer(b.dataset.ink); });
  });
}

// ============================================================ Müller-Lyer

for (const root of document.querySelectorAll("[data-psych-ml]")) {
  const svg = root.querySelector("[data-plot]");
  const result = root.querySelector("[data-out=result]");
  const TRUE = 200; // the upper line, px in viewBox units
  let reveal = false;
  const s = scrubAll(root, draw);

  // A line with fins at both ends; outward fins point away (>—<), inward
  // fins form arrowheads (<—>).
  function figure(y, len, outward, angle) {
    const g = el("g", {}, svg);
    const x0 = 260 - len / 2, x1 = 260 + len / 2, f = 28, a = (angle * Math.PI) / 180;
    const st = "stroke:var(--foreground);stroke-width:2.5;stroke-linecap:round";
    el("line", { x1: x0, y1: y, x2: x1, y2: y, style: st }, g);
    const dx = f * Math.cos(a) * (outward ? -1 : 1), dy = f * Math.sin(a);
    for (const [x, sgn] of [[x0, 1], [x1, -1]]) {
      el("line", { x1: x, y1: y, x2: x + sgn * dx, y2: y - dy, style: st }, g);
      el("line", { x1: x, y1: y, x2: x + sgn * dx, y2: y + dy, style: st }, g);
    }
    return g;
  }

  function draw() {
    svg.replaceChildren();
    const len = s.len.get(), ang = s.fin.get();
    figure(60, TRUE, false, ang); // inward fins: looks shorter
    figure(150, len, true, ang); // outward fins: looks longer
    if (reveal) {
      for (const x of [260 - TRUE / 2, 260 + TRUE / 2]) el("line", { x1: x, y1: 30, x2: x, y2: 185, style: "stroke:var(--brand);stroke-width:1;stroke-dasharray:4 4" }, svg);
      text(svg, 262 + TRUE / 2, 194, "true length of the upper line", { "text-anchor": "end", style: "fill:var(--brand)" });
    }
  }

  root.querySelector("[data-action=submit]").addEventListener("click", () => {
    const len = s.len.get(), bias = ((len - TRUE) / TRUE) * 100;
    result.textContent = `You set ${len} px for a ${TRUE} px line: the outward-finned line had to be ${Math.abs(bias).toFixed(1)}% ${bias < 0 ? "shorter" : "longer"} to look equal. ${bias < 0 ? "That's the illusion." : "Unusual: most people undershoot."}`;
  });
  root.querySelector("[data-action=reveal]").addEventListener("click", () => { reveal = !reveal; draw(); });
  draw();
}

// ============================================================ Checker shadow

for (const root of document.querySelectorAll("[data-psych-checker]")) {
  const svg = root.querySelector("[data-plot]");
  const value = root.querySelector("[data-out=value]");
  // Lightness model: light squares 0.80, dark 0.40. The shadow is a soft
  // black radial gradient with a flat core at 50% opacity, so a light
  // square inside the core shows 0.80 × 0.5 = 0.40, the value of a dark
  // square in the light. A and B are then repainted from that one value.
  const LIGHT = 0.8, DARK = 0.4;
  const gray = (v) => { const c = Math.round(v * 255); return `rgb(${c},${c},${c})`; };
  let bridge = false, isolate = false;
  const N = 6, S = 40, OX = 90, OY = 30;
  const A = [1, 2], B = [4, 4]; // [col, row]: A dark in the light, B light in the shadow core

  function draw() {
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    const grad = el("radialGradient", { id: "psych-shade", cx: "50%", cy: "50%", r: "50%" }, defs);
    for (const [o, a] of [["0%", 0.5], ["55%", 0.5], ["100%", 0]]) el("stop", { offset: o, "stop-color": "#000", "stop-opacity": a }, grad);
    el("clipPath", { id: "psych-board" }, defs).append(el("rect", { x: OX, y: OY, width: N * S, height: N * S }));
    el("rect", { x: 0, y: 0, width: 420, height: 300, style: `fill:${gray(0.86)}` }, svg);
    const g = el("g", { style: isolate ? "opacity:0.05" : "" }, svg);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
      el("rect", { x: OX + c * S, y: OY + r * S, width: S, height: S, style: `fill:${gray((r + c) % 2 ? DARK : LIGHT)}` }, g);
    // The shadow, centred on B and clipped to the board.
    el("ellipse", { cx: OX + 4.4 * S, cy: OY + 4.5 * S, rx: 2.7 * S, ry: 2.3 * S, fill: "url(#psych-shade)", "clip-path": "url(#psych-board)" }, g);
    // The cylinder casting it.
    el("rect", { x: 330, y: 110, width: 52, height: 120, style: "fill:var(--code-add);fill-opacity:0.9" }, g);
    el("ellipse", { cx: 356, cy: 230, rx: 26, ry: 9, style: "fill:var(--code-add);fill-opacity:0.9" }, g);
    el("ellipse", { cx: 356, cy: 110, rx: 26, ry: 9, style: "fill:color-mix(in oklab, var(--code-add) 75%, white)" }, g);
    // A and B, both painted from one value.
    const same = gray(DARK);
    for (const [[c, r], label] of [[A, "A"], [B, "B"]]) {
      el("rect", { x: OX + c * S, y: OY + r * S, width: S, height: S, style: `fill:${same}` }, svg);
      const t = text(svg, OX + c * S + S / 2, OY + r * S + S / 2 + 5, label, { "text-anchor": "middle", class: "font-sans text-[15px] font-semibold" });
      t.style.fill = "#fff"; // same label colour on both: no contrast cue
    }
    if (bridge) {
      // Bars of the same grey joining A and B: the difference vanishes.
      el("path", { d: `M${OX + A[0] * S + S / 2} ${OY + A[1] * S + S} V${OY + B[1] * S + S / 2} H${OX + B[0] * S}`, style: `fill:none;stroke:${same};stroke-width:16` }, svg);
    }
    value.textContent = `A and B: ${same} (${Math.round(DARK * 100)}% grey)`;
  }
  root.querySelector("[data-action=bridge]").addEventListener("click", () => { bridge = !bridge; draw(); });
  root.querySelector("[data-action=isolate]").addEventListener("click", () => { isolate = !isolate; draw(); });
  draw();
}

// ============================================================ Serial position

for (const root of document.querySelectorAll("[data-psych-recall]")) {
  const word = root.querySelector("[data-word]");
  const prompt = root.querySelector("[data-prompt]");
  const form = root.querySelector("form[data-recall]");
  const input = form.querySelector("input");
  const typed = root.querySelector("[data-typed]");
  const svg = root.querySelector("[data-plot]");
  const startBtn = root.querySelector("[data-action=start]");
  const o = outs(root);
  const lists = [...root.querySelector("template[data-lists]").content.children].map((d) => d.dataset.words.split(" "));
  let listIdx = 0, current = [], recalled = new Set(), hits = new Array(15).fill(0), done = 0;

  startBtn.addEventListener("click", () => {
    if (listIdx >= lists.length) listIdx = 0;
    current = lists[listIdx++];
    recalled = new Set();
    typed.replaceChildren();
    form.hidden = true;
    startBtn.disabled = true;
    prompt.hidden = true;
    let k = 0;
    const show = () => {
      if (k === current.length) {
        word.textContent = "";
        prompt.hidden = false;
        prompt.textContent = "Now write every word you remember.";
        form.hidden = false;
        input.focus();
        return;
      }
      word.textContent = current[k++];
      setTimeout(show, 1000); // one word per second, as in Murdock's fast lists
    };
    show();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const w = input.value.trim().toLowerCase();
    input.value = "";
    if (!w || recalled.has(w)) return;
    recalled.add(w);
    const chip = document.createElement("span");
    const ok = current.includes(w);
    chip.className = `rounded-full border px-2 py-0.5 font-mono text-xs ${ok ? "border-brand/40 text-brand" : "text-muted-foreground line-through"}`;
    chip.textContent = w;
    typed.append(chip);
  });

  root.querySelector("[data-action=done]").addEventListener("click", () => {
    current.forEach((w, i) => { if (recalled.has(w)) hits[i]++; });
    done++;
    const got = current.filter((w) => recalled.has(w)).length;
    o.lists.textContent = String(done);
    o.last.textContent = `${got} / 15`;
    form.hidden = true;
    startBtn.disabled = false;
    prompt.textContent = done < lists.length ? "Recorded. Start the next list." : "All lists done. Start again to add more data.";
    draw();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => {
    hits = new Array(15).fill(0); done = 0; listIdx = 0;
    for (const k of ["lists", "last", "first", "middle", "end"]) o[k].textContent = "—";
    draw();
  });

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 464, 150], x: [0.5, 15.5], y: [0, 1], xticks: [1, 5, 10, 15], yticks: [0, 0.5, 1], xlabel: "position in the list", ylabel: "recalled" });
    if (!done) return text(svg, 272, 90, "Your curve appears after the first list", { "text-anchor": "middle" });
    const p = hits.map((v) => v / done);
    polyline(svg, p.map((v, i) => [f.sx(i + 1), f.sy(v)]), "stroke:var(--brand);stroke-width:1.75");
    p.forEach((v, i) => el("circle", { cx: f.sx(i + 1), cy: f.sy(v), r: 3.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg));
    const part = (a, b) => num(mean(p.slice(a, b)) * 100, 0) + "%";
    o.first.textContent = part(0, 3);
    o.middle.textContent = part(3, 12);
    o.end.textContent = part(12, 15);
  }
  draw();
}

// ============================================================ Signal detection

for (const root of document.querySelectorAll("[data-psych-sdt]")) {
  const dist = root.querySelector("[data-sdt-dist]");
  const roc = root.querySelector("[data-sdt-roc]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const pdf = (x, m) => Math.exp(-0.5 * (x - m) ** 2) / Math.sqrt(2 * Math.PI);

  function draw() {
    const H = s.hit.get(), F = s.fa.get();
    const zH = probit(H), zF = probit(F);
    const d = zH - zF, c = -(zH + zF) / 2;
    const k = -zF; // the criterion on the noise axis

    dist.replaceChildren();
    const f = frame(dist, { box: [24, 12, 360, 190], x: [-4, 6], y: [0, 0.45], xticks: [-3, 0, 3, 6], yticks: [], xlabel: "internal response" });
    const xs = Array.from({ length: 241 }, (_, i) => -4 + (i * 10) / 240);
    // Shade hits (signal beyond k) and false alarms (noise beyond k).
    for (const [m, color] of [[0, "var(--vec-u)"], [d, "var(--brand)"]]) {
      const tail = xs.filter((x) => x >= k);
      if (tail.length) el("path", { d: `M${f.sx(k)} ${f.sy(0)} ` + tail.map((x) => `L${f.sx(x).toFixed(1)} ${f.sy(pdf(x, m)).toFixed(1)}`).join(" ") + ` L${f.sx(6)} ${f.sy(0)} Z`, style: `fill:${color};fill-opacity:0.18` }, dist);
      polyline(dist, xs.map((x) => [f.sx(x), f.sy(pdf(x, m))]), `stroke:${color};stroke-width:2`);
    }
    el("line", { x1: f.sx(k), x2: f.sx(k), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.5" }, dist);
    text(dist, f.sx(k) + 4, f.T + 10, "criterion: say yes →", { class: "fill-foreground font-mono text-[10px]" });

    roc.replaceChildren();
    const g = frame(roc, { box: [34, 12, 190, 190], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], xlabel: "false alarms", ylabel: "hits" });
    el("line", { x1: g.sx(0), y1: g.sy(0), x2: g.sx(1), y2: g.sy(1), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4" }, roc);
    const curve = Array.from({ length: 121 }, (_, i) => { const kk = -6 + (i * 12) / 120; return [g.sx(1 - phi(kk)), g.sy(1 - phi(kk - d))]; });
    polyline(roc, curve, "stroke:var(--foreground);stroke-width:1.75");
    el("circle", { cx: g.sx(F), cy: g.sy(H), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, roc);

    o.d.textContent = num(d, 2);
    o.c.textContent = num(c, 2);
    o.bias.textContent = Math.abs(c) < 0.05 ? "neutral" : c > 0 ? "conservative (says no more)" : "liberal (says yes more)";
  }
  draw();
}

// ============================================================ Rescorla–Wagner

for (const root of document.querySelectorAll("[data-psych-rw]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let group = "blocking";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { group = e.detail.value; draw(); });

  // Phase 1: blocking group learns light → food; control has no trials.
  // Phase 2: both get light + tone → food. Each trial, every cue present
  // updates by ΔV = αβ(λ − ΣV) (equal salience α for both cues).
  function draw() {
    const a = s.alpha.get(), b = s.beta.get(), L = s.lambda.get(), n = Math.round(s.n.get());
    let VA = 0, VB = 0;
    const A = [[0, 0]], B = [[0, 0]];
    for (let t = 1; t <= n; t++) {
      if (group === "blocking") VA += a * b * (L - VA);
      A.push([t, VA]); B.push([t, VB]);
    }
    for (let t = n + 1; t <= 2 * n; t++) {
      const err = L - (VA + VB);
      VA += a * b * err;
      VB += a * b * err;
      A.push([t, VA]); B.push([t, VB]);
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 16, 500, 240], x: [0, 2 * n], y: [0, 1], xticks: [0, n, 2 * n], yticks: [0, 0.5, 1], xlabel: "trial", ylabel: "V" });
    el("rect", { x: f.sx(0), y: f.T, width: f.sx(n) - f.sx(0), height: f.H, style: "fill:currentColor;fill-opacity:0.03" }, svg);
    text(svg, f.sx(n / 2), f.T + 12, group === "blocking" ? "phase 1: light → food" : "phase 1: nothing", { "text-anchor": "middle" });
    text(svg, f.sx(1.5 * n), f.T + 12, "phase 2: light + tone → food", { "text-anchor": "middle" });
    hline(svg, f, L, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4", "λ");
    polyline(svg, A.map(([t, v]) => [f.sx(t), f.sy(v)]), "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, B.map(([t, v]) => [f.sx(t), f.sy(v)]), "stroke:var(--brand);stroke-width:2");
    o.va.textContent = num(VA, 3);
    o.vb.textContent = num(VB, 3);
    o.design.textContent = group === "blocking"
      ? "The light alone predicts food first. When the tone is added, almost nothing is left to learn: the tone is blocked."
      : "Light and tone are trained together from the start, so they share the available strength.";
  }
  draw();
}

// ============================================================ Framing

for (const root of document.querySelectorAll("[data-psych-biases]")) {
  const frames = [...root.querySelectorAll("[data-frame]")];
  const out = root.querySelector("[data-out=frame]");
  const frameName = Math.random() < 0.5 ? "gain" : "loss";
  for (const f of frames) f.hidden = f.dataset.frame !== frameName;
  // Original result (Tversky & Kahneman 1981): 72% chose A in the gain
  // frame (N = 152); 78% chose D in the loss frame (N = 155).
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    for (const x of root.querySelectorAll("[data-pick]")) x === b ? (x.dataset.on = "") : delete x.dataset.on;
    const sure = b.dataset.pick === "a";
    out.textContent = frameName === "gain"
      ? `You chose the ${sure ? "sure option" : "gamble"}. With the "saved" wording, 72% of the original participants chose the sure option A. The other wording (programmes C and D, the same outcomes described as deaths) flipped it: 78% chose the gamble.`
      : `You chose the ${sure ? "sure option" : "gamble"}. With the "die" wording, 78% of the original participants chose the gamble D. Described as lives saved, the same options made 72% choose the sure one.`;
  });
}
