// Nuclear and particle physics: a partial chart of nuclides, the
// semi-empirical mass formula, mass defects and Q-values from AME masses,
// stochastic decay, Bateman chains, fission multiplication, the Coulomb
// barrier, γ attenuation, dose weighting and the Standard Model.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const minus = (s) => String(s).replace(/-/g, "−");
const sci = (v, d = 2) => {
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return minus(v.toFixed(Math.max(0, d - Math.max(0, e))));
  const sup = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const exp = String(e).replace("-", "⁻").replace(/\d/g, (c) => sup[c]);
  return `${(v / 10 ** e).toFixed(d)}×10${exp}`;
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A play/pause button whose icon and label follow the state.
function playButton(btn, labels = ["Run", "Pause"]) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// Toggle-button groups ([aria-pressed]) inside a container.
function pressGroup(container, attr, onPick) {
  const buttons = [...container.querySelectorAll(`[${attr}]`)];
  for (const b of buttons) {
    b.addEventListener("click", () => {
      for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
      onPick(b.getAttribute(attr));
    });
  }
}

// ============================================================ Chart of nuclides

for (const root of document.querySelectorAll("[data-nuc-chart]")) {
  const o = outs(root);
  const name = root.querySelector("[data-name]");
  const detail = root.querySelector("[data-detail]");
  const cells = [...root.querySelectorAll("[data-nuclide]")];
  const sup = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const show = (g) => {
    for (const c of cells) c.querySelector("rect").style.strokeWidth = c === g ? "3px" : "1px";
    const z = +g.dataset.z, n = +g.dataset.n, a = z + n;
    const [sym] = g.dataset.nuclide.split("-");
    name.textContent = `${String(a).replace(/\d/g, (d) => sup[d])}${sym}`;
    const mode = g.dataset.mode;
    detail.textContent = mode === "stable"
      ? `${z} protons and ${n} neutrons: stable.`
      : `${z} protons and ${n} neutrons: decays by ${mode}${g.dataset.half ? `, half-life ≈ ${g.dataset.half}` : ""}. ` +
        (mode.startsWith("β⁻") ? "Too many neutrons: a neutron turns into a proton (Z + 1)."
          : mode.startsWith("α") ? "It splits into two ⁴He nuclei almost at once."
          : "Too few neutrons: a proton turns into a neutron (Z − 1).");
    o.zna.textContent = `${z} / ${n} / ${a}`;
    o.ratio.textContent = z ? num(n / z, 2) : "—";
    o.half.textContent = g.dataset.half || "stable";
  };
  for (const c of cells) {
    c.addEventListener("pointerenter", () => show(c));
    c.addEventListener("focus", () => show(c));
    c.addEventListener("click", () => show(c));
  }
  const fe = cells.find((c) => c.dataset.nuclide === "C-14");
  if (fe) show(fe);
}

// ============================================================ Binding energy (SEMF)

const SEMF = { aV: 15.8, aS: 18.3, aC: 0.714, aA: 23.2, aP: 12 };
function semfTerms(A, Z) {
  const { aV, aS, aC, aA, aP } = SEMF;
  const N = A - Z;
  const pairing = A % 2 ? 0 : Z % 2 === 0 && N % 2 === 0 ? aP / Math.sqrt(A) : -aP / Math.sqrt(A);
  return {
    volume: aV * A,
    surface: -aS * A ** (2 / 3),
    coulomb: -aC * Z * (Z - 1) / A ** (1 / 3),
    asymmetry: -aA * (A - 2 * Z) ** 2 / A,
    pairing,
  };
}
const semfB = (A, Z) => Object.values(semfTerms(A, Z)).reduce((a, b) => a + b, 0);
function bestZ(A) {
  let best = 1, bb = -Infinity;
  for (let Z = 1; Z < A; Z++) {
    const b = semfB(A, Z);
    if (b > bb) { bb = b; best = Z; }
  }
  return best;
}
// Measured B/A (MeV) from the Atomic Mass Evaluation.
const MEASURED = [
  ["²H", 2, 1.112], ["⁴He", 4, 7.074], ["⁷Li", 7, 5.606], ["¹²C", 12, 7.680], ["¹⁶O", 16, 7.976],
  ["⁵⁶Fe", 56, 8.790], ["⁶²Ni", 62, 8.795], ["²⁰⁸Pb", 208, 7.867], ["²³⁵U", 235, 7.591], ["²³⁸U", 238, 7.570],
];

for (const root of document.querySelectorAll("[data-nuc-binding]")) {
  const svg = root.querySelector("[data-plot]");
  const terms = root.querySelector("[data-terms]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const curve = [];
  for (let A = 4; A <= 250; A++) curve.push([A, semfB(A, bestZ(A)) / A]);

  function draw() {
    const A = Math.round(s.a.get());
    const Z = bestZ(A);
    const t = semfTerms(A, Z);
    const B = semfB(A, Z);
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 506, 250], x: [0, 250], y: [0, 9.5], xticks: [0, 50, 100, 150, 200, 250], yticks: [0, 2, 4, 6, 8], xlabel: "mass number A", ylabel: "B/A (MeV)" });
    polyline(svg, curve.map(([a, v]) => [f.sx(a), f.sy(Math.max(0, v))]), "stroke:var(--foreground);stroke-width:1.75");
    // Label offsets keep neighbours apart; ¹²C and ²³⁵U are drawn unlabelled.
    const OFF = { "²H": [6, 4], "⁴He": [6, -8], "⁷Li": [7, 10], "¹⁶O": [-6, -8, "end"], "⁵⁶Fe": [4, -8], "⁶²Ni": [6, 14], "²⁰⁸Pb": [0, -9, "middle"], "²³⁸U": [0, -9, "middle"] };
    for (const [lab, a, v] of MEASURED) {
      el("circle", { cx: f.sx(a), cy: f.sy(v), r: 3.5, style: "fill:var(--brand)" }, svg);
      const off = OFF[lab];
      if (off) text(svg, f.sx(a) + off[0], f.sy(v) + off[1], lab, { "text-anchor": off[2] || "start", class: "fill-muted-foreground text-[11px]" });
    }
    el("line", { x1: f.sx(A), x2: f.sx(A), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(A), cy: f.sy(B / A), r: 4.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);

    // Terms per nucleon as signed bars.
    terms.replaceChildren();
    const rows = [["volume", t.volume], ["surface", t.surface], ["Coulomb", t.coulomb], ["asymmetry", t.asymmetry], ["pairing", t.pairing]];
    const scale = 230 / 16; // px per MeV/nucleon
    const x0 = 300;
    rows.forEach(([lab, v], i) => {
      const y = 6 + i * 16, w = (v / A) * scale;
      el("rect", { x: w >= 0 ? x0 : x0 + w, y, width: Math.max(1, Math.abs(w)), height: 11, rx: 2, style: `fill:${v >= 0 ? "var(--vec-u)" : "var(--code-del)"};fill-opacity:0.7` }, terms);
      text(terms, 8, y + 9, lab);
      text(terms, 120, y + 9, `${v >= 0 ? "+" : "−"}${num(Math.abs(v / A), 2)} MeV/A`, { class: "fill-foreground font-mono text-[10px]" });
    });
    el("line", { x1: x0, x2: x0, y1: 2, y2: 86, style: "stroke:currentColor;stroke-opacity:0.4" }, terms);
    o.z.textContent = `${Z} (N = ${A - Z})`;
    o.b.textContent = `${num(B, 1)} MeV`;
    o.ba.textContent = `${num(B / A, 3)} MeV`;
  }
  draw();
}

// ============================================================ Mass defect and Q

// Atomic masses in u (AME 2020).
const MASS = {
  n: 1.00866491595, "H-1": 1.00782503223, "H-2": 2.01410177812, "H-3": 3.01604928132,
  "He-3": 3.01602932197, "He-4": 4.00260325413, "Li-6": 6.01512288742, "Li-7": 7.01600343426,
  "C-12": 12, "O-16": 15.99491461926, "Fe-56": 55.93493632, "Ni-62": 61.92834537,
  "Pb-208": 207.9766525, "U-235": 235.0439281, "U-238": 238.0507869,
};
const ZOF = { H: 1, He: 2, Li: 3, C: 6, O: 8, Fe: 26, Ni: 28, Pb: 82, U: 92 };
const UMEV = 931.49410242;
const NAMES = { n: "n", "H-1": "¹H", "H-2": "²H", "H-3": "³H", "He-3": "³He", "He-4": "⁴He", "Li-6": "⁶Li", "Li-7": "⁷Li" };
const REACTIONS = {
  dt: [["H-2", "H-3"], ["He-4", "n"]],
  dd1: [["H-2", "H-2"], ["He-3", "n"]],
  dd2: [["H-2", "H-2"], ["H-3", "H-1"]],
  dhe3: [["H-2", "He-3"], ["He-4", "H-1"]],
  pli7: [["H-1", "Li-7"], ["He-4", "He-4"]],
  nli6: [["n", "Li-6"], ["H-3", "He-4"]],
};

for (const root of document.querySelectorAll("[data-nuc-mass]")) {
  const sum = root.querySelector("[data-sum]");
  const q = root.querySelector("[data-q]");
  const binding = (key) => {
    const [sym, a] = key.split("-");
    const A = +a, Z = ZOF[sym], N = A - Z;
    const parts = Z * MASS["H-1"] + N * MASS.n;
    const d = parts - MASS[key];
    const B = d * UMEV;
    sum.textContent =
      `${Z} × ¹H   ${(Z * MASS["H-1"]).toFixed(6)} u\n` +
      `${N} × n    ${(N * MASS.n).toFixed(6)} u\n` +
      `nucleus  −${MASS[key].toFixed(6)} u\n` +
      `mass defect  ${d.toFixed(6)} u\n` +
      `B = ${d.toFixed(6)} × 931.494 = ${B.toFixed(2)} MeV   (${(B / A).toFixed(3)} MeV per nucleon)`;
  };
  const reaction = (key) => {
    const [lhs, rhs] = REACTIONS[key];
    const m = (side) => side.reduce((s, k) => s + MASS[k], 0);
    const dm = m(lhs) - m(rhs);
    const label = (side) => side.map((k) => NAMES[k]).join(" + ");
    q.textContent =
      `${label(lhs)}   ${m(lhs).toFixed(8)} u\n` +
      `${label(rhs)}   ${m(rhs).toFixed(8)} u\n` +
      `Δm = ${dm.toFixed(8)} u   Q = ${(dm * UMEV).toFixed(3)} MeV${dm > 0 ? "  (released)" : "  (absorbed)"}`;
  };
  pressGroup(root.querySelector("[data-picks]"), "data-pick", binding);
  pressGroup(root.querySelector("[data-reactions]"), "data-reaction", reaction);
  binding("He-4");
  reaction("dt");
}

// ============================================================ Stochastic decay

for (const root of document.querySelectorAll("[data-nuc-decay]")) {
  const atomsSvg = root.querySelector("[data-atoms]");
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  const playBtn = root.querySelector("[data-action=play]");
  const setPlay = playButton(playBtn);
  let seed = 3, rng, alive, history, t, playing = false, timer = 0, visible = false;
  const s = scrubAll(root, () => reset());

  function reset() {
    rng = mulberry32(seed);
    const N = Math.round(s.atoms.get());
    alive = new Array(N).fill(true);
    history = [[0, N]];
    t = 0;
    stop();
    draw();
  }
  function step() {
    const dt = s.step.get();
    const p = 1 - 2 ** -dt;
    for (let i = 0; i < alive.length; i++) if (alive[i] && rng() < p) alive[i] = false;
    t += dt;
    history.push([t, alive.filter(Boolean).length]);
  }
  function draw() {
    const N = alive.length;
    atomsSvg.replaceChildren();
    const side = Math.ceil(Math.sqrt(N));
    const cell = 196 / side;
    alive.forEach((a, i) => {
      el("circle", { cx: 2 + (i % side + 0.5) * cell, cy: 2 + (Math.floor(i / side) + 0.5) * cell, r: cell * 0.36,
        style: a ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.12" }, atomsSvg);
    });
    plot.replaceChildren();
    const f = frame(plot, { box: [40, 12, 306, 176], x: [0, 6], y: [0, N], xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, N / 4, N / 2, N], xlabel: "time (half-lives)", ylabel: "atoms", yfmt: (v) => String(Math.round(v)) });
    const exp = Array.from({ length: 121 }, (_, i) => [f.sx(i / 20), f.sy(N * 2 ** -(i / 20))]);
    polyline(plot, exp, "stroke:var(--foreground);stroke-opacity:0.45;stroke-width:1.5;stroke-dasharray:5 4");
    polyline(plot, history.filter(([x]) => x <= 6).map(([x, n]) => [f.sx(x), f.sy(n)]), "stroke:var(--brand);stroke-width:2");
    const left = history.at(-1)[1];
    o.t.textContent = `${num(t, 2)} t½`;
    o.left.textContent = `${left} of ${N}`;
    o.expected.textContent = num(N * 2 ** -t, 1);
  }
  function stop() {
    playing = false;
    setPlay(false);
    clearTimeout(timer);
  }
  function tick() {
    if (!playing || !visible) return;
    step();
    draw();
    if (t >= 6 || history.at(-1)[1] === 0) return stop();
    timer = setTimeout(tick, 120);
  }
  playBtn.addEventListener("click", () => {
    if (playing) return stop();
    if (t >= 6 || history.at(-1)[1] === 0) reset();
    if (reduced()) {
      while (t < 6 && history.at(-1)[1] > 0) step();
      return draw();
    }
    playing = true;
    setPlay(true);
    tick();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { seed++; reset(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing) tick(); }).observe(root);
  reset();
}

// ============================================================ Bateman chain

for (const root of document.querySelectorAll("[data-nuc-chain]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const viewLabel = root.querySelector("[data-view-label]");
  let view = "activity";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { view = e.detail.value; draw(); });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const [a, c] = b.dataset.preset.split(" ").map(Number);
    s.t1.set(a, false);
    s.t2.set(c, false);
    draw();
  }));

  function draw() {
    const t1 = s.t1.get(), t2 = s.t2.get();
    const l1 = Math.LN2 / t1, l2 = Math.LN2 / t2;
    const same = Math.abs(l1 - l2) < 1e-12;
    const N1 = (t) => Math.exp(-l1 * t);
    const N2 = (t) => same ? l1 * t * Math.exp(-l1 * t) : (l1 / (l2 - l1)) * (Math.exp(-l1 * t) - Math.exp(-l2 * t));
    const N3 = (t) => 1 - N1(t) - N2(t);
    const T = 10 * Math.max(t2, Math.min(t1, 5 * t2));
    const act = view === "activity";
    viewLabel.textContent = act ? "activity (relative to the parent's at t = 0)" : "amounts (fraction of the parent's atoms)";
    const fns = act ? [(t) => N1(t), (t) => (l2 / l1) * N2(t), null] : [N1, N2, N3];
    let ymax = 1;
    if (act) for (let i = 0; i <= 200; i++) ymax = Math.max(ymax, fns[1]((i / 200) * T));
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 250], x: [0, T], y: [0, ymax * 1.05], xticks: [0, T / 4, T / 2, (3 * T) / 4, T], yticks: [0, ymax / 2, ymax], xlabel: "time (h)", xfmt: (v) => num(v, v < 10 ? 1 : 0), yfmt: (v) => num(v, 2) });
    const colors = ["var(--foreground)", "var(--brand)", "var(--vec-u)"];
    fns.forEach((fn, i) => {
      if (!fn) return;
      polyline(svg, Array.from({ length: 301 }, (_, k) => { const t = (k / 300) * T; return [f.sx(t), f.sy(fn(t))]; }), `stroke:${colors[i]};stroke-width:${i === 1 ? 2.25 : 1.75}`);
    });
    const tPeak = same ? 1 / l1 : Math.log(l2 / l1) / (l2 - l1);
    if (tPeak > 0 && tPeak < T) {
      el("line", { x1: f.sx(tPeak), x2: f.sx(tPeak), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
    }
    const regime = t1 <= t2 ? "no equilibrium (parent shorter-lived)" : t1 / t2 > 100 ? "secular equilibrium" : "transient equilibrium";
    o.regime.textContent = regime;
    o.peak.textContent = `${num(tPeak, tPeak < 10 ? 2 : 1)} h`;
    o.ratio.textContent = t1 <= t2 ? "parent gone first" : num(l2 / (l2 - l1), 3);
  }
  draw();
}

// ============================================================ Fission

for (const root of document.querySelectorAll("[data-nuc-fission]")) {
  const svg = root.querySelector("[data-plot]");
  const budget = root.querySelector("[data-budget]");
  const o = outs(root);
  const parts = [["Fission fragments (kinetic)", 169], ["Prompt neutrons", 5], ["Prompt γ rays", 7], ["β from products", 7], ["Delayed γ rays", 6], ["Antineutrinos (escape)", 10]];
  const total = parts.reduce((a, [, v]) => a + v, 0);
  for (const [lab, v] of parts) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 text-xs";
    const name = document.createElement("span");
    name.textContent = lab;
    const val = document.createElement("span");
    val.className = "font-mono tabular-nums text-muted-foreground";
    val.textContent = `≈ ${v} MeV`;
    const bar = document.createElement("div");
    bar.className = "col-span-2 h-1.5 overflow-hidden rounded-full bg-foreground/8";
    const fill = document.createElement("div");
    fill.className = "h-full rounded-full " + (lab.startsWith("Anti") ? "bg-foreground/30" : "bg-brand");
    fill.style.width = `${(100 * v) / total}%`;
    bar.append(fill);
    row.append(name, val, bar);
    budget.append(row);
  }
  const s = scrubAll(root, draw);
  function draw() {
    const k = s.k.get(), n = Math.round(s.gens.get());
    svg.replaceChildren();
    const lo = Math.min(0, n * Math.log10(k)), hi = Math.max(0, n * Math.log10(k));
    const ylo = Math.floor(Math.min(lo, -1)), yhi = Math.ceil(Math.max(hi, 1));
    const ticks = [];
    const stepT = Math.max(1, Math.ceil((yhi - ylo) / 5));
    for (let v = ylo; v <= yhi; v += stepT) ticks.push(v);
    const f = frame(svg, { box: [44, 12, 266, 176], x: [0, n], y: [ylo, yhi], xticks: [0, Math.round(n / 2), n], yticks: ticks, xlabel: "generation", yfmt: (v) => `10${String(v).replace("-", "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c])}` });
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4", "1 neutron");
    polyline(svg, Array.from({ length: n + 1 }, (_, g) => [f.sx(g), f.sy(g * Math.log10(k))]), "stroke:var(--brand);stroke-width:2");
    const state = Math.abs(k - 1) < 0.005 ? "critical: steady" : k < 1 ? "subcritical: dies out" : "supercritical: grows";
    o.state.textContent = state;
    o.after.textContent = `×${sci(k ** n)}`;
    const perKg = 200e6 * 1.602176634e-19 * 6.02214076e23 / 0.235;
    o.perkg.textContent = `≈ ${sci(perKg)} J (≈ ${num(perKg / 4.184e12, 0)} kt TNT)`;
  }
  draw();
}

// ============================================================ Fusion

const FUSION = {
  dt: { z: [1, 1], a: [2, 3], q: "17.59 MeV" },
  dd: { z: [1, 1], a: [2, 2], q: "3.27 or 4.03 MeV" },
  dhe3: { z: [1, 2], a: [2, 3], q: "18.35 MeV" },
  pp: { z: [1, 1], a: [1, 1], q: "0.42 MeV (weak: p + p → ²H + e⁺ + ν)" },
};

for (const root of document.querySelectorAll("[data-nuc-fusion]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let r = FUSION.dt;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { r = FUSION[e.detail.value]; draw(); });

  function draw() {
    const R = 1.2 * (r.a[0] ** (1 / 3) + r.a[1] ** (1 / 3));
    const U = 1.44 * r.z[0] * r.z[1] / R; // MeV
    const kT = 8.617333262e-5 * s.temp.get() * 1e6 / 1e6; // MeV
    svg.replaceChildren();
    const Ukev = U * 1000;
    const top = Math.ceil((Ukev * 1.25) / 100) * 100;
    const f = frame(svg, { box: [52, 14, 490, 230], x: [0, 20], y: [-top * 0.35, top], xticks: [0, 5, 10, 15, 20], yticks: [0, top / 2, top], xlabel: "separation r (fm)", ylabel: "energy (keV)", yfmt: (v) => num(v, 0) });
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const x = R + ((20 - R) * i) / 200;
      pts.push([f.sx(x), f.sy(Math.min(top, (1.44 * r.z[0] * r.z[1] / x) * 1000))]);
    }
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:2");
    // Inside the nuclear radius the strong force wins: a schematic well.
    el("path", { d: `M${f.sx(R)},${f.sy(Ukev)} L${f.sx(R)},${f.sy(-top * 0.3)} L${f.sx(0)},${f.sy(-top * 0.3)}`, style: "fill:none;stroke:var(--foreground);stroke-width:2;stroke-dasharray:5 3" }, svg);
    text(svg, f.sx(R) / 2 + f.L / 2, f.sy(-top * 0.3) - 6, "strong force", { "text-anchor": "middle" });
    const kTkeV = kT * 1000;
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(kTkeV), y2: f.sy(kTkeV), style: "stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.L + f.W - 4, f.sy(kTkeV) - 5, `kT = ${num(kTkeV, 1)} keV`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    text(svg, f.sx(R) + 6, f.sy(Ukev) + 4, `barrier ≈ ${num(Ukev, 0)} keV at ${num(R, 2)} fm`, { class: "fill-foreground font-mono text-[10px]" });
    o.barrier.textContent = `${num(Ukev, 0)} keV`;
    o.kt.textContent = `${num(kTkeV, 2)} keV`;
    o.ratio.textContent = `${num(Ukev / kTkeV, 0)}×`;
    o.q.textContent = r.q;
  }
  draw();
}

// ============================================================ Shielding

const MU = { lead: 0.0588 * 11.35, steel: 0.0535 * 7.87, concrete: 0.0578 * 2.3, water: 0.0632 * 1.0 }; // cm⁻¹

for (const root of document.querySelectorAll("[data-nuc-shield]")) {
  const svg = root.querySelector("[data-plot]");
  const ranges = root.querySelector("[data-ranges]");
  const o = outs(root);
  let mat = "lead";
  const rows = [
    ["α (≈ 5 MeV)", "a few cm of air; stopped by paper or the outer skin", 0.08, "var(--vec-out)"],
    ["β (≈ 1 MeV)", "metres of air; a few mm of aluminium", 0.3, "var(--vec-u)"],
    ["γ", "thinned exponentially; lead or thick concrete", 0.85, "var(--brand)"],
    ["neutrons", "slowed best by hydrogen: water, polyethylene, concrete", 0.7, "var(--ion-k)"],
  ];
  for (const [lab, note, frac, color] of rows) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[6.5rem_1fr] items-center gap-3 text-xs";
    const l = document.createElement("span");
    l.className = "font-mono";
    l.textContent = lab;
    const right = document.createElement("div");
    right.className = "flex flex-col gap-0.5";
    const bar = document.createElement("div");
    bar.className = "h-1.5 rounded-full";
    bar.style.width = `${frac * 100}%`;
    bar.style.background = `linear-gradient(to right, ${color}, transparent)`;
    const n = document.createElement("span");
    n.className = "text-muted-foreground";
    n.textContent = note;
    right.append(bar, n);
    row.append(l, right);
    ranges.append(row);
  }
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mat = e.detail.value; draw(); });

  function draw() {
    const mu = MU[mat], x = s.x.get(), hvl = Math.LN2 / mu;
    svg.replaceChildren();
    const xmax = 60;
    const f = frame(svg, { box: [48, 12, 496, 180], x: [0, xmax], y: [-6, 0], xticks: [0, 10, 20, 30, 40, 50, 60], yticks: [0, -2, -4, -6], xlabel: "thickness (cm)", ylabel: "I / I₀", yfmt: (v) => (v === 0 ? "1" : `10${String(v).replace("-", "⁻")}`) });
    for (const [m, c] of [["lead", "var(--foreground)"], ["steel", "var(--vec-u)"], ["concrete", "var(--ion-cl)"], ["water", "var(--ion-ca)"]]) {
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const xx = (i / 120) * xmax, v = -MU[m] * xx / Math.LN10;
        if (v < -6) { pts.push([f.sx(6 * Math.LN10 / MU[m]), f.sy(-6)]); break; }
        pts.push([f.sx(xx), f.sy(v)]);
      }
      polyline(svg, pts, `stroke:${c};stroke-width:${m === mat ? 2.5 : 1.25};stroke-opacity:${m === mat ? 1 : 0.45}`);
    }
    const yv = Math.max(-6, -mu * x / Math.LN10);
    el("circle", { cx: f.sx(x), cy: f.sy(yv), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    o.hvl.textContent = `${num(hvl, 2)} cm`;
    o.mu.textContent = `${num(mu, 3)} cm⁻¹`;
    const tr = Math.exp(-mu * x);
    o.trans.textContent = tr > 1e-3 ? `${num(tr * 100, tr > 0.1 ? 1 : 3)}%` : sci(tr * 100) + "%";
    o.layers.textContent = num(x / hvl, 2);
  }
  draw();
}

// ============================================================ Dose

for (const root of document.querySelectorAll("[data-nuc-dose]")) {
  const o = outs(root);
  const scale = root.querySelector("[data-scale]");
  let wR = 1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { wR = Number(e.detail.value); draw(); });
  const refs = [
    ["Chest X-ray (typical)", 0.02],
    ["ICRP public limit, per year", 1],
    ["Natural background, world average per year", 2.4],
    ["Chest CT scan (typical)", 7],
    ["ICRP occupational limit, per year (5-year average)", 20],
  ];
  const lo = -3, hi = 3; // log10 mSv
  const pos = (v) => `${(100 * (Math.log10(Math.max(v, 1e-3)) - lo)) / (hi - lo)}%`;

  function draw() {
    const H = s.mgy.get() * wR; // mSv
    o.sv.textContent = H >= 1000 ? `${num(H / 1000, 3)} Sv` : `${num(H, H < 1 ? 3 : 2)} mSv`;
    o.wr.textContent = `w_R = ${wR}`;
    scale.replaceChildren();
    const axis = document.createElement("div");
    axis.className = "relative mt-2 mb-1 h-2 rounded-full bg-foreground/8";
    const you = document.createElement("div");
    you.className = "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-brand";
    you.style.left = pos(Math.min(H, 1000));
    axis.append(you);
    const ticks = document.createElement("div");
    ticks.className = "relative mb-3 h-4 font-mono text-[10px] whitespace-nowrap text-muted-foreground";
    for (let e = lo; e <= hi; e++) {
      const t = document.createElement("span");
      t.className = "absolute " + (e === lo ? "" : e === hi ? "-translate-x-full" : "-translate-x-1/2");
      t.style.left = `${(100 * (e - lo)) / (hi - lo)}%`;
      t.textContent = e === hi ? "1 Sv" : String(10 ** e);
      ticks.append(t);
    }
    const head = document.createElement("div");
    head.className = "grid grid-cols-[1fr_auto] gap-3 border-b pb-1 text-[11px] text-muted-foreground";
    const h1 = document.createElement("span");
    h1.textContent = "Reference level (mSv on the scale above)";
    const h2 = document.createElement("span");
    h2.textContent = "your dose ÷ reference";
    head.append(h1, h2);
    scale.append(axis, ticks, head);
    for (const [lab, v] of refs) {
      const row = document.createElement("div");
      row.className = "grid grid-cols-[1fr_auto] items-center gap-3 text-xs";
      const l = document.createElement("span");
      l.className = H >= v ? "text-foreground" : "text-muted-foreground";
      l.textContent = `${lab}: ≈ ${v} mSv`;
      const r = document.createElement("span");
      r.className = "font-mono tabular-nums text-muted-foreground";
      r.textContent = `${num(H / v, H / v < 10 ? 2 : 0)}×`;
      row.append(l, r);
      scale.append(row);
    }
  }
  draw();
}

// ============================================================ Standard Model

const PARTICLES = [
  { s: "u", n: "up quark", kind: "quark", q: "+2/3", spin: "1/2", m: "≈ 2.2 MeV", gen: 1 },
  { s: "c", n: "charm quark", kind: "quark", q: "+2/3", spin: "1/2", m: "≈ 1.27 GeV", gen: 2 },
  { s: "t", n: "top quark", kind: "quark", q: "+2/3", spin: "1/2", m: "≈ 172.6 GeV", gen: 3 },
  { s: "g", n: "gluon", kind: "boson", q: "0", spin: "1", m: "0", note: "carries the strong force" },
  { s: "H", n: "Higgs boson", kind: "boson", q: "0", spin: "0", m: "≈ 125.2 GeV", note: "excitation of the field that gives W, Z and fermions mass" },
  { s: "d", n: "down quark", kind: "quark", q: "−1/3", spin: "1/2", m: "≈ 4.7 MeV", gen: 1 },
  { s: "s", n: "strange quark", kind: "quark", q: "−1/3", spin: "1/2", m: "≈ 93 MeV", gen: 2 },
  { s: "b", n: "bottom quark", kind: "quark", q: "−1/3", spin: "1/2", m: "≈ 4.18 GeV", gen: 3 },
  { s: "γ", n: "photon", kind: "boson", q: "0", spin: "1", m: "0", note: "carries the electromagnetic force" },
  { s: "Z", n: "Z boson", kind: "boson", q: "0", spin: "1", m: "≈ 91.19 GeV", note: "neutral carrier of the weak force" },
  { s: "e", n: "electron", kind: "lepton", q: "−1", spin: "1/2", m: "0.511 MeV", gen: 1 },
  { s: "μ", n: "muon", kind: "lepton", q: "−1", spin: "1/2", m: "105.7 MeV", gen: 2 },
  { s: "τ", n: "tau", kind: "lepton", q: "−1", spin: "1/2", m: "≈ 1777 MeV", gen: 3 },
  { s: "W", n: "W boson", kind: "boson", q: "±1", spin: "1", m: "≈ 80.37 GeV", note: "charged carrier of the weak force" },
  { s: "", n: "", kind: "gap" },
  { s: "ν", sub: "e", n: "electron neutrino", kind: "lepton", q: "0", spin: "1/2", m: "< 1 eV", gen: 1 },
  { s: "ν", sub: "μ", n: "muon neutrino", kind: "lepton", q: "0", spin: "1/2", m: "< 1 eV", gen: 2 },
  { s: "ν", sub: "τ", n: "tau neutrino", kind: "lepton", q: "0", spin: "1/2", m: "< 1 eV", gen: 3 },
];
const FORCES = { quark: "strong, electromagnetic and weak", lepton: "electromagnetic and weak (neutrinos: weak only)" };
const KIND_COLOR = { quark: "var(--brand)", lepton: "var(--vec-u)", boson: "var(--vec-out)" };

// Hadrons by quark content: lightest state, mass in MeV (PDG).
// Keys: sorted quark letters for baryons, "quark|antiquark" for mesons.
const BARYON_LIST = [
  ["uud", "proton p", 938.27], ["udd", "neutron n", 939.57], ["uuu", "Δ⁺⁺", 1232], ["ddd", "Δ⁻", 1232],
  ["uds", "Λ⁰ (also Σ⁰, 1192.6)", 1115.68], ["uus", "Σ⁺", 1189.37], ["dds", "Σ⁻", 1197.45],
  ["uss", "Ξ⁰", 1314.86], ["dss", "Ξ⁻", 1321.71], ["sss", "Ω⁻", 1672.45], ["udc", "Λc⁺", 2286.46],
];
const BARYONS = Object.fromEntries(BARYON_LIST.map(([k, n, m]) => [[...k].sort().join(""), [n, m]]));
const MESONS = {
  "u|d": ["π⁺", 139.57], "d|u": ["π⁻", 139.57], "u|u": ["π⁰ (a u ū – d d̄ mixture)", 134.98], "d|d": ["π⁰ (a u ū – d d̄ mixture)", 134.98],
  "u|s": ["K⁺", 493.68], "d|s": ["K⁰", 497.61], "s|u": ["K⁻", 493.68], "s|d": ["K̄⁰", 497.61],
  "s|s": ["φ(1020), nearly pure s s̄ (the lighter η, η′ are mixtures)", 1019.46],
  "c|u": ["D⁰", 1864.84], "c|d": ["D⁺", 1869.66], "c|s": ["D_s⁺", 1968.35], "c|c": ["η_c (J/ψ at 3096.9)", 2983.9],
  "u|b": ["B⁺", 5279.34], "d|b": ["B⁰", 5279.66], "s|b": ["B_s⁰", 5366.9], "b|b": ["η_b (ϒ(1S) at 9460.3)", 9398.7],
};
const QCHARGE = { u: 2, c: 2, t: 2, d: -1, s: -1, b: -1 }; // in thirds
const frac3 = (n) => (n === 0 ? "0" : `${n < 0 ? "−" : "+"}${n % 3 === 0 ? Math.abs(n / 3) : `${Math.abs(n)}/3`}`);
const antiName = (name) => name.startsWith("proton") ? "antiproton p̄" : name.startsWith("neutron") ? "antineutron n̄" : `anti-${name}`;

for (const root of document.querySelectorAll("[data-nuc-sm]")) {
  const grid = root.querySelector("[data-grid]");
  const card = root.querySelector("[data-card]");
  for (const p of PARTICLES) {
    if (p.kind === "gap") {
      const g = document.createElement("div");
      g.className = "hidden lg:block";
      grid.append(g);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "flex flex-col items-start gap-0.5 rounded-lg border bg-background p-2.5 text-left outline-none transition-[border-color,box-shadow] duration-150 hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand";
    b.setAttribute("aria-pressed", "false");
    const sym = document.createElement("span");
    sym.className = "font-mono text-lg font-semibold";
    sym.style.color = KIND_COLOR[p.kind];
    sym.textContent = p.s;
    if (p.sub) { const sb = document.createElement("sub"); sb.textContent = p.sub; sym.append(sb); }
    const nm = document.createElement("span");
    nm.className = "text-xs";
    nm.textContent = p.n;
    const m = document.createElement("span");
    m.className = "font-mono text-[10px] text-muted-foreground";
    m.textContent = `${p.m} · ${p.q}`;
    b.append(sym, nm, m);
    b.addEventListener("click", () => {
      for (const x of grid.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
      card.textContent = `${p.n} (${p.s}${p.sub ?? ""}): charge ${p.q}, spin ${p.spin}, mass ${p.m}. ` +
        (p.kind === "boson" ? `${p.note[0].toUpperCase()}${p.note.slice(1)}.` : `Generation ${p.gen}; feels the ${FORCES[p.kind]} forces.`);
    });
    grid.append(b);
  }

  // Hadron builder.
  const palette = root.querySelector("[data-palette]");
  const slots = root.querySelector("[data-slots]");
  const result = root.querySelector("[data-result]");
  const picked = [];
  const flavours = ["u", "d", "s", "c", "b", "t"];
  for (const anti of [false, true]) {
    for (const f of flavours) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "min-w-9 rounded-md border px-2 py-1 font-mono text-sm outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";
      b.textContent = anti ? `${f}̄` : f;
      b.setAttribute("aria-label", `${anti ? "anti-" : ""}${f} quark`);
      b.addEventListener("click", () => { if (picked.length < 3) { picked.push({ f, anti }); render(); } });
      palette.append(b);
    }
  }
  function render() {
    slots.replaceChildren();
    picked.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "flex size-11 items-center justify-center rounded-full border-2 font-mono text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
      b.style.borderColor = p.anti ? "var(--vec-u)" : "var(--brand)";
      b.textContent = p.anti ? `${p.f}̄` : p.f;
      b.setAttribute("aria-label", "Remove");
      b.addEventListener("click", () => { picked.splice(i, 1); render(); });
      slots.append(b);
    });
    result.replaceChildren();
    const line = (t, cls = "") => { const d = document.createElement("div"); d.className = cls; d.textContent = t; result.append(d); };
    if (!picked.length) return line("Pick quarks from the palette.", "text-muted-foreground");
    const q = picked.reduce((a, p) => a + (p.anti ? -1 : 1) * QCHARGE[p.f], 0);
    const B = picked.reduce((a, p) => a + (p.anti ? -1 : 1), 0);
    const S = picked.reduce((a, p) => a + (p.f === "s" ? (p.anti ? 1 : -1) : 0), 0);
    line(`charge ${frac3(q)} · baryon number ${frac3(B)} · strangeness ${minus(S)}`, "font-mono text-xs text-muted-foreground");
    if (picked.some((p) => p.f === "t")) return line("Top quarks decay (≈ 5×10⁻²⁵ s) before they can bind into hadrons.", "text-del");
    const quarks = picked.filter((p) => !p.anti).map((p) => p.f);
    const antis = picked.filter((p) => p.anti).map((p) => p.f);
    if (picked.length === 3 && (quarks.length === 3 || antis.length === 3)) {
      const hit = BARYONS[(quarks.length === 3 ? quarks : antis).slice().sort().join("")];
      const name = hit ? hit[0] : null;
      if (quarks.length === 3) line(hit ? `Baryon: ${name}, ≈ ${hit[1]} MeV` : "A baryon (three quarks), not in this short list.", "font-medium");
      else line(hit ? `Antibaryon: ${antiName(name)}, ≈ ${hit[1]} MeV` : "An antibaryon (three antiquarks).", "font-medium");
      return;
    }
    if (picked.length === 2 && quarks.length === 1 && antis.length === 1) {
      const hit = MESONS[`${quarks[0]}|${antis[0]}`];
      return line(hit ? `Meson: ${hit[0]}, ≈ ${hit[1]} MeV` : `Meson ${quarks[0]} ${antis[0]}̄: its antiparticle is ${antis[0]} ${quarks[0]}̄.`, "font-medium");
    }
    if (picked.length === 2) return line("Not colour-neutral: two quarks (or two antiquarks) can't form a hadron. Try a quark and an antiquark.", "text-del");
    line(picked.length < 3 ? "Add another quark." : "Not colour-neutral: use three quarks, three antiquarks, or one of each.", "text-muted-foreground");
  }
  render();
}
