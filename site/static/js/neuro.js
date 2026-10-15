// The neuroscience blocks. Every number on screen comes from a model
// computed here: Hodgkin–Huxley, Nernst/GHK, a leaky integrate-and-fire
// neuron, an inhomogeneous Poisson process, the Hill equation.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));

// ============================================================ Hodgkin–Huxley

// Rate functions of the 1952 model (ms⁻¹), voltage in mV with rest at −65.
// The two removable singularities take their limits.
const vtrap = (x, y) => (Math.abs(x / y) < 1e-6 ? y * (1 - x / y / 2) : x / (Math.exp(x / y) - 1));
const rates = (V) => ({
  am: 0.1 * vtrap(-(V + 40), 10),
  bm: 4 * Math.exp(-(V + 65) / 18),
  ah: 0.07 * Math.exp(-(V + 65) / 20),
  bh: 1 / (1 + Math.exp(-(V + 35) / 10)),
  an: 0.01 * vtrap(-(V + 55), 10),
  bn: 0.125 * Math.exp(-(V + 65) / 80),
});

function hodgkinHuxley({ amp, dur, amp2, delay, ttx, tea }) {
  const dt = 0.01, T = 50, t1 = 5, t2 = 5 + delay;
  const gNa = ttx ? 0 : 120, gK = tea ? 0 : 36, gL = 0.3;
  const ENa = 50, EK = -77, EL = -54.387;
  let V = -65;
  let r = rates(V);
  let m = r.am / (r.am + r.bm), h = r.ah / (r.ah + r.bh), n = r.an / (r.an + r.bn);
  const out = [];
  const spikes = [];
  let above = false;
  for (let i = 0, t = 0; t <= T; i++, t = i * dt) {
    const I = (t >= t1 && t < t1 + dur ? amp : 0) + (amp2 > 0 && t >= t2 && t < t2 + dur ? amp2 : 0);
    r = rates(V);
    const INa = gNa * m ** 3 * h * (V - ENa);
    const IK = gK * n ** 4 * (V - EK);
    const IL = gL * (V - EL);
    V += dt * (I - INa - IK - IL); // C = 1 µF/cm²
    m += dt * (r.am * (1 - m) - r.bm * m);
    h += dt * (r.ah * (1 - h) - r.bh * h);
    n += dt * (r.an * (1 - n) - r.bn * n);
    if (!above && V > 0) spikes.push(t);
    above = V > 0;
    if (i % 5 === 0) out.push({ t, V, m, h, n, I });
  }
  return { out, spikes, t1, t2 };
}

for (const root of document.querySelectorAll("[data-hh]")) {
  const svgV = root.querySelector('[data-plot="v"]');
  const svgG = root.querySelector('[data-plot="gates"]');
  const o = outs(root);
  const drugs = { ttx: false, tea: false };
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { drugs[k] = on; draw(); });

  function draw() {
    const p = { amp: s.amp.get(), dur: s.dur.get(), amp2: s.amp2.get(), delay: s.delay.get(), ...drugs };
    const { out, spikes, t1, t2 } = hodgkinHuxley(p);

    svgV.replaceChildren();
    const f = frame(svgV, { box: [44, 14, 584, 200], x: [0, 50], y: [-90, 60], xticks: [0, 10, 20, 30, 40, 50], yticks: [-80, -40, 0, 40], xlabel: "time (ms)", ylabel: "mV", yfmt: (v) => String(v).replace("-", "−") });
    hline(svgV, f, 50, "stroke:var(--ion-na);stroke-dasharray:4 4;stroke-opacity:0.8", "E_Na +50");
    hline(svgV, f, -77, "stroke:var(--ion-k);stroke-dasharray:4 4;stroke-opacity:0.8", "E_K −77");
    // Stimulus strip under the axis.
    const sy = 236;
    text(svgV, f.L - 6, sy + 4, "I", { "text-anchor": "end" });
    for (const [t0, a] of [[t1, p.amp], [t2, p.amp2]]) {
      if (a <= 0 || t0 > 50) continue;
      const hgt = Math.min(16, 4 + a / 4);
      el("rect", { x: f.sx(t0), y: sy + 6 - hgt, width: Math.max(1.5, f.sx(t0 + p.dur) - f.sx(t0)), height: hgt, rx: 1, style: "fill:var(--vec-u);fill-opacity:0.7" }, svgV);
    }
    el("line", { x1: f.L, x2: f.L + f.W, y1: sy + 6, y2: sy + 6, style: "stroke:currentColor;stroke-opacity:0.2" }, svgV);
    polyline(svgV, out.map((d) => [f.sx(d.t), f.sy(d.V)]), "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round");

    svgG.replaceChildren();
    const g = frame(svgG, { box: [44, 8, 584, 92], x: [0, 50], y: [0, 1], xticks: [], yticks: [0, 0.5, 1] });
    for (const [k, c] of [["m", "var(--ion-na)"], ["h", "var(--vec-out)"], ["n", "var(--ion-k)"]])
      polyline(svgG, out.map((d) => [g.sx(d.t), g.sy(d[k])]), `stroke:${c};stroke-width:1.5`);

    const peak = Math.max(...out.map((d) => d.V));
    o.spikes.textContent = String(spikes.length);
    o.peak.textContent = `${num(peak)} mV`;
    const second = p.amp2 > 0 && t2 < 50;
    const fromSecond = spikes.some((t) => t >= t2 && t < t2 + 8);
    o.verdict.textContent =
      p.ttx && spikes.length === 0 ? "no spike: Na⁺ channels blocked"
      : spikes.length === 0 ? "subthreshold"
      : second && !fromSecond && p.amp2 > 0 ? "pulse 2 fell in the refractory period"
      : p.tea ? "no K⁺ current: repolarization fails"
      : `${spikes.length} spike${spikes.length > 1 ? "s" : ""}`;
  }
  draw();
}

// ============================================================ Nernst / GHK

const IONS = [
  { key: "k", label: "E_K", z: 1, color: "var(--ion-k)" },
  { key: "na", label: "E_Na", z: 1, color: "var(--ion-na)" },
  { key: "cl", label: "E_Cl", z: -1, color: "var(--ion-cl)" },
  { key: "ca", label: "E_Ca", z: 2, color: "var(--ion-ca)" },
];
const PRESETS = { rest: { k: 1, na: 0.05, cl: 0.45 }, peak: { k: 1, na: 20, cl: 0.45 } };

for (const root of document.querySelectorAll("[data-ghk]")) {
  const o = outs(root);
  const axis = root.querySelector("[data-axis]");
  const s = scrubAll(root, draw);
  const lo = -110, hi = 150;
  const pos = (v) => `${(100 * (Math.min(hi, Math.max(lo, v)) - lo)) / (hi - lo)}%`;

  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PRESETS[b.dataset.preset];
      for (const k in p) s[`${k}-p`].set(p[k], false);
      draw();
    }));

  function draw() {
    const RTF = (8.314462 * (s.temp.get() + 273.15)) / 96485.33 * 1000; // mV
    const c = (k, side) => Math.max(1e-9, s[`${k}-${side}`].get());
    const E = {};
    for (const i of IONS) {
      E[i.key] = (RTF / i.z) * Math.log(c(i.key, "out") / c(i.key, "in"));
      o[`e-${i.key}`].textContent = `${num(E[i.key])} mV`;
    }
    const P = (k) => s[`${k}-p`].get();
    const vm = RTF * Math.log(
      (P("k") * c("k", "out") + P("na") * c("na", "out") + P("cl") * c("cl", "in")) /
      (P("k") * c("k", "in") + P("na") * c("na", "in") + P("cl") * c("cl", "out")));
    o.vm.textContent = Number.isFinite(vm) ? `${num(vm)} mV` : "—";

    // The axis: ticks every 50 mV, a marker per ion, Vm on top.
    axis.replaceChildren();
    const add = (cls, style, html) => {
      const d = document.createElement("div");
      d.className = cls;
      d.setAttribute("style", style);
      if (html !== undefined) d.textContent = html;
      axis.append(d);
      return d;
    };
    add("absolute inset-x-0 top-[40px] h-px bg-foreground/20", "");
    for (let v = -100; v <= 150; v += 50) {
      add("absolute top-[36px] h-2 w-px bg-foreground/30", `left:${pos(v)}`);
      add("absolute top-[48px] -translate-x-1/2 font-mono text-[10px] text-muted-foreground", `left:${pos(v)}`, String(v).replace("-", "−"));
    }
    const sorted = IONS.map((i) => ({ ...i, v: E[i.key] })).sort((a, b) => a.v - b.v);
    sorted.forEach((i, k) => {
      // Labels alternate between two rows so close potentials stay legible.
      add("absolute w-0.5 -translate-x-1/2 rounded-full " + (k % 2 ? "top-[30px] h-[10px]" : "top-[14px] h-[26px]"), `left:${pos(i.v)};background:${i.color}`);
      add("absolute -translate-x-1/2 font-mono text-[10px] leading-none whitespace-nowrap " + (k % 2 ? "top-[17px]" : "top-0"), `left:${pos(i.v)};color:${i.color}`, `${i.label} ${num(i.v, 0)}`);
    });
    if (Number.isFinite(vm)) {
      const m = add("absolute top-[40px] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow transition-[left] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none", `left:${pos(vm)}`);
      m.title = `Vm ${num(vm)} mV`;
    }
  }
  draw();
}

// ============================================================ Integrate-and-fire

for (const root of document.querySelectorAll("[data-lif]")) {
  const svg = root.querySelector("[data-scope]");
  const o = outs(root);
  const EL = -70, VTH = -55, VRESET = -75, TAU_M = 10, TAU_S = 3, WINDOW = 400, DT = 0.1;

  // Calibrate weights so a lone EPSP peaks at +8 mV and an IPSP at −6 mV.
  const unitPeak = (() => {
    let v = 0, s = 1, peak = 0;
    for (let t = 0; t < 60; t += DT) {
      v += (DT * (-v + s)) / TAU_M;
      s -= (DT * s) / TAU_S;
      peak = Math.max(peak, v);
    }
    return peak;
  })();
  const W = { e1: 8 / unitPeak, e2: 8 / unitPeak, i: -6 / unitPeak };
  const COLORS = { e1: "var(--ion-na)", e2: "var(--ion-ca)", i: "var(--ion-k)" };

  let V = EL, syn = 0, t = 0, refractory = 0, spikes = 0;
  const samples = []; // [t, V]
  const marks = []; // [t, kind]
  const queue = []; // [t, kind]

  const fire = (kind) => {
    if (kind === "train") [0, 5, 10, 15].forEach((d) => queue.push([t + d, "e1"]));
    else if (kind === "both") queue.push([t, "e1"], [t, "e2"]);
    else queue.push([t, kind]);
    start();
  };
  root.querySelectorAll("[data-fire]").forEach((b) => b.addEventListener("click", () => fire(b.dataset.fire)));
  root.addEventListener("keydown", (e) => {
    const k = { 1: "e1", 2: "e2", 3: "i" }[e.key];
    if (k && !e.target.closest("button")) { e.preventDefault(); fire(k); }
  });

  function step(ms) {
    for (let n = 0; n < ms / DT; n++) {
      for (let q = queue.length - 1; q >= 0; q--) {
        if (queue[q][0] <= t) {
          syn += W[queue[q][1]];
          marks.push([t, queue[q][1]]);
          queue.splice(q, 1);
        }
      }
      if (refractory > 0) {
        refractory -= DT;
        V = VRESET;
      } else {
        V += (DT * (-(V - EL) + syn)) / TAU_M;
      }
      syn -= (DT * syn) / TAU_S;
      if (V >= VTH) {
        samples.push([t, VTH], [t, 30]); // the spike, drawn as a stroke
        V = VRESET;
        refractory = 2;
        spikes++;
      }
      t += DT;
      if (Math.round(t / DT) % 5 === 0) samples.push([t, V]);
    }
    while (samples.length && samples[0][0] < t - WINDOW) samples.shift();
    while (marks.length && marks[0][0] < t - WINDOW) marks.shift();
  }

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 660, 180], x: [t - WINDOW, t], y: [-80, 40], yticks: [-70, -40, 0, 30], xticks: [], yfmt: (v) => String(v).replace("-", "−") });
    hline(svg, f, VTH, "stroke:var(--brand);stroke-dasharray:5 4;stroke-opacity:0.8", "threshold −55 mV");
    polyline(svg, samples.map(([x, v]) => [f.sx(x), f.sy(v)]), "stroke:var(--foreground);stroke-width:1.6;stroke-linejoin:round");
    for (const [x, k] of marks) el("rect", { x: f.sx(x) - 1, y: 212, width: 2.5, height: 12, rx: 1, style: `fill:${COLORS[k]}` }, svg);
    text(svg, f.L - 6, 222, "in", { "text-anchor": "end" });
    text(svg, f.L + f.W, 236, "last 400 ms", { "text-anchor": "end" });
    o.vm.textContent = `${num(V)} mV`;
    o.spikes.textContent = `${spikes} spike${spikes === 1 ? "" : "s"}`;
  }

  // Runs in real time while visible; idles once the trace has settled.
  let raf = 0, last = 0, visible = false, quiet = 0;
  const loop = (now) => {
    const ms = Math.min(50, now - last);
    last = now;
    step(ms);
    draw();
    quiet = queue.length || Math.abs(V - EL) > 0.05 || Math.abs(syn) > 0.01 ? 0 : quiet + ms;
    raf = visible && quiet < WINDOW ? requestAnimationFrame(loop) : 0;
  };
  function start() {
    quiet = 0;
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(root);
  for (let i = 0; i < 4; i++) step(100);
  draw();
}

// ============================================================ Raster / PSTH

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const root of document.querySelectorAll("[data-raster]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 7;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  // Firing rate (Hz): 4 Hz baseline; during the stimulus, a Naka–Rushton
  // contrast response with a 40 ms latency, an onset transient that adapts
  // away, and a brief suppression after offset.
  const rate = (t, c) => {
    const base = 4;
    if (t < 40 || t >= 560) return base;
    if (t >= 540) return 1;
    const drive = (70 * c * c) / (c * c + 0.3 * 0.3);
    return base + drive * (0.55 + 0.9 * Math.exp(-(t - 40) / 50));
  };

  function draw() {
    const c = s.contrast.get() / 100, trials = Math.round(s.trials.get()), bin = s.bin.get();
    const rng = mulberry32(seed * 1000 + Math.round(c * 100));
    const all = [];
    for (let k = 0; k < trials; k++) {
      const row = [];
      for (let t = -200; t < 800; t += 1) if (rng() < rate(t, c) / 1000) row.push(t);
      all.push(row);
    }
    svg.replaceChildren();
    // Raster.
    const r = frame(svg, { box: [44, 10, 584, 150], x: [-200, 800], y: [0, trials], xticks: [], yticks: [] });
    el("rect", { x: r.sx(0), y: r.T, width: r.sx(500) - r.sx(0), height: r.H, style: "fill:var(--vec-u);fill-opacity:0.07" }, svg);
    text(svg, r.L - 6, r.T + 8, "trial", { "text-anchor": "end" });
    const rowH = r.H / trials;
    const ticks = all.flatMap((row, k) => row.map((t) => `M${r.sx(t).toFixed(1)} ${(r.T + k * rowH + 1).toFixed(1)}v${Math.max(1, rowH - 2).toFixed(1)}`)).join("");
    el("path", { d: ticks, style: "stroke:var(--foreground);stroke-width:1.2" }, svg);
    // PSTH.
    const nb = Math.ceil(1000 / bin);
    const counts = new Array(nb).fill(0);
    for (const row of all) for (const t of row) counts[Math.min(nb - 1, Math.floor((t + 200) / bin))]++;
    const hz = counts.map((n) => n / trials / (bin / 1000));
    const ymax = Math.max(20, Math.ceil(Math.max(...hz) / 20) * 20);
    const p = frame(svg, { box: [44, 186, 584, 120], x: [-200, 800], y: [0, ymax], xticks: [-200, 0, 200, 400, 600, 800], yticks: [0, ymax / 2, ymax], xlabel: "time from stimulus onset (ms)", ylabel: "spikes/s", xfmt: (v) => String(v).replace("-", "−") });
    el("rect", { x: p.sx(0), y: p.T, width: p.sx(500) - p.sx(0), height: p.H, style: "fill:var(--vec-u);fill-opacity:0.07" }, svg);
    hz.forEach((v, i) => {
      const x0 = p.sx(-200 + i * bin), x1 = p.sx(-200 + (i + 1) * bin);
      el("rect", { x: x0 + 0.5, y: p.sy(v), width: Math.max(0.5, x1 - x0 - 1), height: p.T + p.H - p.sy(v), style: "fill:var(--brand);fill-opacity:0.75" }, svg);
    });
    const count = (a, b) => all.reduce((n, row) => n + row.filter((t) => t >= a && t < b).length, 0);
    o.base.textContent = `${num(count(-200, 0) / trials / 0.2)} Hz`;
    o.stim.textContent = `${num(count(0, 500) / trials / 0.5)} Hz`;
    o.n.textContent = String(all.reduce((n, r) => n + r.length, 0));
  }
  draw();
}

// ============================================================ Dose–response

const conc = (logM) => {
  const m = 10 ** logM;
  const [v, u] = m >= 1e-3 ? [m * 1e3, "mM"] : m >= 1e-6 ? [m * 1e6, "µM"] : [m * 1e9, "nM"];
  return `${v >= 100 ? Math.round(v) : num(v, v >= 10 ? 1 : 2)} ${u}`;
};

for (const root of document.querySelectorAll("[data-dose]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "competitive";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function draw() {
    const lec = s.logec50.get(), n = s.hill.get(), r = s.ratio.get();
    const hill = (x, l, emax) => emax / (1 + 10 ** (n * (l - x)));
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 584, 236], x: [-10, -2], y: [0, 100], xticks: [-10, -9, -8, -7, -6, -5, -4, -3, -2], yticks: [0, 50, 100], xlabel: "log [agonist] (M)", ylabel: "% response", xfmt: (v) => String(v).replace("-", "−") });
    const pts = (l, emax) => Array.from({ length: 201 }, (_, i) => { const x = -10 + (i * 8) / 200; return [f.sx(x), f.sy(hill(x, l, emax))]; });
    const lecB = mode === "competitive" ? lec + Math.log10(1 + r) : lec;
    const emaxB = mode === "competitive" ? 100 : 100 / (1 + r);
    hline(svg, f, 50, "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4");
    if (r > 0) polyline(svg, pts(lecB, emaxB), "stroke:var(--ion-na);stroke-width:2;stroke-dasharray:6 4");
    polyline(svg, pts(lec, 100), "stroke:var(--foreground);stroke-width:2");
    // EC50 marker on the agonist curve.
    el("line", { x1: f.sx(lec), x2: f.sx(lec), y1: f.sy(50), y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(lec), cy: f.sy(50), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    o.ec50.textContent = conc(lec);
    o.ec50b.textContent = r > 0 ? (mode === "competitive" ? conc(lecB) : `${conc(lec)}, max ${num(emaxB, 0)}%`) : "—";
    o.dr.textContent = mode === "competitive" ? num(1 + r, r < 10 ? 1 : 0) : "—  (insurmountable)";
  }
  draw();
}

// ============================================================ Neuron anatomy

for (const root of document.querySelectorAll("[data-anatomy-neuron]")) {
  const picks = [...root.querySelectorAll("[data-pick]")];
  const parts = [...root.querySelectorAll("[data-part]")];
  const name = root.querySelector("[data-info-name]");
  const role = root.querySelector("[data-info-role]");
  const fact = root.querySelector("[data-info-fact]");
  const show = (key) => {
    const p = picks.find((b) => b.dataset.pick === key);
    if (!p) return;
    for (const b of picks) b === p ? (b.dataset.on = "") : delete b.dataset.on;
    for (const g of parts) g.dataset.part === key ? (g.dataset.on = "") : delete g.dataset.on;
    name.textContent = p.dataset.name;
    role.textContent = p.dataset.role;
    fact.textContent = p.dataset.fact;
  };
  for (const g of parts) {
    g.addEventListener("pointerenter", () => show(g.dataset.part));
    g.addEventListener("focus", () => show(g.dataset.part));
  }
  for (const b of picks) b.addEventListener("click", () => show(b.dataset.pick));
}

// ============================================================ Flashcards

for (const root of document.querySelectorAll("[data-deck]")) {
  const card = root.querySelector("[data-card]");
  const q = card.querySelector("[data-q]"), a = card.querySelector("[data-a]"), note = card.querySelector("[data-note]");
  const grades = [...root.querySelectorAll("[data-grade]")];
  const o = outs(root);
  const queue = [...root.querySelector("template[data-cards]").content.children].map((d) => ({ ...d.dataset }));
  const total = queue.length;
  let seen = 0, known = 0;

  const flipped = () => card.hasAttribute("data-flipped");
  card.addEventListener("click", () => {
    if (!queue.length) return;
    card.toggleAttribute("data-flipped");
    grades.forEach((g) => (g.disabled = !flipped()));
  });

  const grade = (kind) => {
    if (!flipped() || !queue.length) return;
    const c = queue.shift();
    seen++;
    if (kind === "again") queue.push(c);
    else known++;
    o.score.textContent = `${known} known`;
    grades.forEach((g) => (g.disabled = true));
    const next = queue[0];
    q.textContent = next ? next.q : `Deck done: ${known} of ${total} known.`;
    card.removeAttribute("data-flipped");
    o.pos.textContent = next ? `${Math.min(seen + 1, total)} / ${total}${seen >= total ? " · review" : ""}` : "done";
    // Swap the answer once its face has turned away.
    setTimeout(() => { if (next) { a.textContent = next.a; note.textContent = next.note; } }, reduced() ? 0 : 520);
  };
  grades.forEach((g) => g.addEventListener("click", () => grade(g.dataset.grade)));
  root.addEventListener("keydown", (e) => {
    const k = { 1: "again", 2: "good", 3: "easy" }[e.key];
    if (k) grade(k);
  });
}

// ============================================================ Protocol

for (const root of document.querySelectorAll("[data-protocol]")) {
  const boxes = [...root.querySelectorAll('[data-slot="checkbox"]')];
  const bar = root.querySelector("[data-bar]");
  const count = root.querySelector("[data-out=count]");
  const done = root.querySelector("[data-done]");
  const update = () => {
    const n = boxes.filter((b) => b.dataset.state === "checked").length;
    bar.style.width = `${(100 * n) / boxes.length}%`;
    count.textContent = `${n} / ${boxes.length}`;
    done.hidden = n !== boxes.length;
  };
  new MutationObserver(update).observe(root, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
  update();
}
