// Spectroscopy blocks 1–5: degree of unsaturation, isotope clusters,
// fragment losses, splitting trees and assigning a ¹H spectrum.
// Blocks 6–10 live in spectro-more.js; shared helpers in spectro-util.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { outs, range, parseFormula, hill, isotopeCluster, averageMass, nominalMass } from "./spectro-util.js";

const elements = (counts) => Object.entries(counts);

// ============================================================ unsaturation

for (const root of document.querySelectorAll("[data-spec-dou]")) {
  const input = root.querySelector("[data-formula]");
  const svg = root.querySelector("[data-plot]");
  const atoms = root.querySelector("[data-atoms]");
  const ideas = root.querySelector("[data-ideas]");
  const o = outs(root);
  input.addEventListener("input", draw);
  for (const b of root.querySelectorAll("[data-example]"))
    b.addEventListener("click", () => { input.value = b.dataset.example; draw(); });

  function draw() {
    const f = parseFormula(input.value);
    svg.replaceChildren();
    atoms.replaceChildren();
    ideas.replaceChildren();
    if (f.error) {
      o.formula.textContent = f.error;
      for (const k of ["hmax", "heq", "dou", "status"]) o[k].textContent = "—";
      return;
    }
    const c = (e) => f.counts[e] ?? 0;
    const tetra = c("C") + c("Si"), tri = c("N") + c("P"), hal = c("F") + c("Cl") + c("Br") + c("I");
    const hmax = 2 * tetra + 2 + tri, heq = c("H") + hal;
    const dou = (hmax - heq) / 2;
    for (const e of f.order) {
      const role = e === "C" || e === "Si" ? "+2 each" : e === "N" || e === "P" ? "+1 each" : e === "H" ? "uses 1" : ["F", "Cl", "Br", "I"].includes(e) ? "uses 1 (like H)" : "no effect";
      const chip = document.createElement("span");
      chip.className = "rounded-full border px-2 py-0.5 text-muted-foreground";
      chip.textContent = `${e} × ${f.counts[e]} · ${role}`;
      atoms.append(chip);
    }
    // Two bars: what a saturated acyclic molecule would carry, and what this one does.
    const max = Math.max(hmax, heq, 2);
    const L = 120, W = 480, sx = (v) => L + (v / max) * W;
    const bar = (y, v, label, style) => {
      el("rect", { x: L, y, width: Math.max(0, sx(v) - L), height: 30, rx: 4, style }, svg);
      text(svg, L - 8, y + 19, label, { "text-anchor": "end" });
      text(svg, sx(v) + 6, y + 19, String(v), { "text-anchor": "start", class: "fill-foreground font-mono text-[11px]" });
    };
    bar(28, hmax, "saturated max", "fill:var(--muted-foreground);fill-opacity:0.25");
    bar(78, heq, "H + halogens", "fill:var(--vec-u);fill-opacity:0.55");
    if (dou > 0 && Number.isInteger(dou)) {
      for (let k = 0; k < dou && k < 40; k++) {
        const x0 = sx(heq + 2 * k), x1 = sx(heq + 2 * k + 2);
        el("rect", { x: x0 + 0.5, y: 78, width: Math.max(1, x1 - x0 - 1), height: 30, rx: 3, style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-opacity:0.6" }, svg);
      }
      text(svg, (sx(heq) + sx(hmax)) / 2, 132, `${dou} missing pair${dou === 1 ? "" : "s"} of H = ${dou} ring${dou === 1 ? "" : "s"} or π bond${dou === 1 ? "" : "s"}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    }
    o.formula.textContent = hill(f);
    o.hmax.textContent = `2·${tetra} + 2 + ${tri} = ${hmax}`;
    o.heq.textContent = String(heq);
    o.dou.textContent = Number.isInteger(dou) ? String(dou) : num(dou, 1);
    const ok = Number.isInteger(dou) && dou >= 0;
    o.status.textContent = dou < 0 ? "impossible: too many H" : !Number.isInteger(dou) ? "odd: a radical or an ion" : "valid";
    if (!ok) return;
    const say = (s) => { const li = document.createElement("li"); li.textContent = s; ideas.append(li); };
    if (dou === 0) say("Saturated and acyclic: only single bonds, no rings.");
    if (dou >= 1) say(c("O") > 0 ? "One unit could be a C=O (ketone, aldehyde, acid, ester) — look near 1700 cm⁻¹ in the IR." : "One unit could be a ring or a C=C.");
    if (dou >= 2 && c("N") > 0) say("Two units could be a C≡N nitrile (IR near 2250 cm⁻¹).");
    else if (dou >= 2) say("Two units could be one triple bond, or two rings or double bonds.");
    if (dou >= 4 && tetra >= 6) say("Four or more with six carbons or more: a benzene ring (one ring + three C=C) is likely — look for ¹H signals near 7 ppm.");
  }
  draw();
}

// ============================================================ isotope pattern

for (const root of document.querySelectorAll("[data-spec-iso]")) {
  const input = root.querySelector("[data-formula]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  input.addEventListener("input", draw);
  for (const b of root.querySelectorAll("[data-example]"))
    b.addEventListener("click", () => { input.value = b.dataset.example; draw(); });

  function draw() {
    const f = parseFormula(input.value);
    svg.replaceChildren();
    if (f.error) { o.nominal.textContent = f.error; for (const k of ["mono", "avg", "m1", "m2", "top"]) o[k].textContent = "—"; return; }
    const atomsN = elements(f.counts).reduce((s, [, n]) => s + n, 0);
    if (atomsN > 400) { o.nominal.textContent = "keep it under 400 atoms"; return; }
    const { mono, peaks } = isotopeCluster(f.counts);
    const pmax = Math.max(...peaks.map((p) => p.p));
    const shown = peaks.filter((p) => p.p / pmax >= 0.001);
    const nom = nominalMass(f.counts);
    const x0 = nom + shown[0].off - 1, x1 = nom + shown[shown.length - 1].off + 1;
    const step = x1 - x0 > 30 ? 5 : x1 - x0 > 14 ? 2 : 1;
    const fr = frame(svg, { box: [52, 28, 560, 230], x: [x0 - 0.5, x1 + 0.5], y: [0, 105], xticks: range(Math.ceil(x0 / step) * step, x1, step), yticks: [0, 25, 50, 75, 100], yfmt: (v) => `${v}%`, xlabel: "m/z", ylabel: "relative intensity" });
    for (const p of shown) {
      const x = fr.sx(nom + p.off), rel = (p.p / pmax) * 100;
      el("line", { x1: x, x2: x, y1: fr.sy(0), y2: fr.sy(rel), style: `stroke:${p.off === 0 ? "var(--brand)" : "var(--foreground)"};stroke-width:3;stroke-linecap:butt` }, svg);
      if (shown.length <= 14 && rel >= 0.5) {
        text(svg, x, fr.sy(rel) - 14, p.off === 0 ? "M" : `M+${p.off}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
        text(svg, x, fr.sy(rel) - 4, rel >= 10 ? num(rel, 0) : num(rel, 1), { "text-anchor": "middle" });
      }
    }
    const at = (off) => peaks.find((p) => p.off === off)?.p ?? 0;
    const base = at(0);
    const top = peaks.reduce((a, b) => (b.p > a.p ? b : a));
    o.nominal.textContent = `${nom} (${hill(f)})`;
    o.mono.textContent = `${mono.toFixed(4)} u`;
    o.avg.textContent = `${averageMass(f.counts).toFixed(2)} g/mol`;
    o.m1.textContent = `${num((at(1) / base) * 100, 1)}%`;
    o.m2.textContent = `${num((at(2) / base) * 100, 1)}%`;
    o.top.textContent = top.off === 0 ? "M" : `M+${top.off} (m/z ${nom + top.off})`;
  }
  draw();
}

// ============================================================ fragment losses

const LOSSES = [
  [1, "H·"], [15, "CH₃·"], [17, "OH·"], [18, "H₂O"], [28, "CO or C₂H₄"],
  [29, "C₂H₅· or CHO·"], [31, "OCH₃· or CH₂OH·"], [43, "C₃H₇· or CH₃CO·"], [45, "COOH· or OC₂H₅·"], [59, "COOCH₃·"],
];

// [m/z, relative intensity, explanation if it is a quiz peak]
const MS = {
  butanone: { M: 72, peaks: [[72, 25], [57, 6, "CH₃CH₂CO⁺, the acylium ion left when the methyl goes"], [43, 100, "CH₃CO⁺, the acylium ion from losing ethyl: α-cleavage next to C=O"], [29, 18, "C₂H₅⁺, the other side of the same α-cleavage"], [27, 9]] },
  ethanol: { M: 46, peaks: [[46, 22], [45, 50, "CH₃CHOH⁺: losing one H from the carbon next to O"], [31, 100, "CH₂=OH⁺: losing methyl, α-cleavage next to oxygen"], [29, 24, "C₂H₅⁺: losing OH"], [27, 22]] },
  propanoic: { M: 74, peaks: [[74, 80], [57, 25, "CH₃CH₂CO⁺: losing OH from the acid"], [45, 60, "COOH⁺: losing the ethyl group"], [29, 100, "C₂H₅⁺: losing the whole COOH"], [28, 85], [27, 40]] },
  butanol: { M: 74, peaks: [[74, 1], [56, 90, "C₄H₈⁺·: alcohols lose water easily, so M⁺· is tiny"], [43, 60, "C₃H₇⁺: losing CH₂OH"], [41, 65], [31, 100, "CH₂=OH⁺: losing propyl, the classic primary-alcohol peak"]] },
  acetophenone: { M: 120, peaks: [[120, 30], [105, 100, "C₆H₅CO⁺, the benzoyl cation: losing methyl"], [77, 80, "C₆H₅⁺, the phenyl cation: losing CH₃CO (or 105 losing CO)"], [51, 30]] },
  mebenzoate: { M: 136, peaks: [[136, 35], [105, 100, "C₆H₅CO⁺, the benzoyl cation: esters lose the alkoxy group"], [77, 70, "C₆H₅⁺: losing the whole ester group COOCH₃ (or 105 losing CO)"], [51, 25]] },
};

for (const root of document.querySelectorAll("[data-spec-frag]")) {
  const svg = root.querySelector("[data-plot]");
  const pick = root.querySelector("[data-pick]");
  const lossBox = root.querySelector("[data-losses]");
  const fb = root.querySelector("[data-feedback]");
  const o = outs(root);
  let sel = null, named = new Set();
  for (const [m, label] of LOSSES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.loss = String(m);
    b.className = "flex items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition-colors duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none disabled:opacity-50";
    b.innerHTML = `<span class="font-mono tabular-nums text-muted-foreground"></span><span></span>`;
    b.firstChild.textContent = `−${m}`;
    b.lastChild.textContent = label;
    b.addEventListener("click", () => answer(m, label));
    lossBox.append(b);
  }
  pick.addEventListener("change", () => { sel = null; named = new Set(); fb.textContent = ""; draw(); });

  function quiz() { return MS[pick.value].peaks.filter((p) => p[2]); }

  function answer(m, label) {
    const C = MS[pick.value];
    if (!sel) { fb.textContent = "Pick a fragment peak first."; return; }
    const delta = C.M - sel[0];
    if (m === delta) {
      named.add(sel[0]);
      fb.textContent = `Yes: ${C.M} − ${m} = ${sel[0]}. m/z ${sel[0]} is ${sel[2]}.`;
    } else {
      fb.textContent = `Not that one: M − ${label} would be m/z ${C.M - m}, not ${sel[0]}. The gap here is ${delta}.`;
    }
    draw();
  }

  function draw() {
    const C = MS[pick.value];
    svg.replaceChildren();
    const x1 = Math.ceil((C.M + 8) / 10) * 10;
    const f = frame(svg, { box: [52, 28, 560, 230], x: [10, x1], y: [0, 112], xticks: range(10, x1, x1 > 100 ? 20 : 10), yticks: [0, 25, 50, 75, 100], yfmt: (v) => `${v}%`, xlabel: "m/z", ylabel: "relative abundance" });
    for (const p of C.peaks) {
      const [mz, int, why] = p;
      const isM = mz === C.M, isSel = sel?.[0] === mz, done = named.has(mz);
      const color = isSel ? "var(--brand)" : isM ? "var(--vec-u)" : done ? "var(--brand)" : "var(--foreground)";
      el("line", { x1: f.sx(mz), x2: f.sx(mz), y1: f.sy(0), y2: f.sy(int), style: `stroke:${color};stroke-width:${isSel ? 4 : 3};stroke-opacity:${done && !isSel ? 0.55 : 1}` }, svg);
      text(svg, f.sx(mz), f.sy(int) - 5, isM ? `${mz} M⁺·` : String(mz), { "text-anchor": "middle", class: `${isSel || isM ? "fill-foreground" : "fill-muted-foreground"} font-mono text-[10px]` });
      if (!why) continue;
      // A wide, focusable hit area so thin sticks are easy to pick.
      const hit = el("rect", { x: f.sx(mz) - 9, y: f.T, width: 18, height: f.H, tabindex: 0, role: "button", "aria-pressed": String(isSel), "aria-label": `Peak at m/z ${mz}, ${int}%${done ? ", named" : ""}`, style: "fill:transparent;cursor:pointer;outline:none", class: "focus-visible:[stroke:var(--ring)] focus-visible:[stroke-width:2]" }, svg);
      const choose = () => { sel = p; fb.textContent = `m/z ${mz}: ${C.M} − ${mz} = ${C.M - mz}. What neutral weighs ${C.M - mz}?`; draw(); svg.querySelector(`[aria-label^="Peak at m/z ${mz},"]`)?.focus(); };
      hit.addEventListener("click", choose);
      hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    }
    o.peak.textContent = sel ? `m/z ${sel[0]} (${sel[1]}%)` : "click a fragment";
    o.delta.textContent = sel ? String(C.M - sel[0]) : "—";
    o.score.textContent = `${named.size} of ${quiz().length}`;
  }
  draw();
}

// ============================================================ splitting tree

const MULT = ["s", "d", "t", "q", "quint", "sext", "sept", "oct", "non"];
const MULT_NAME = { s: "singlet", d: "doublet", t: "triplet", q: "quartet", quint: "quintet", sext: "sextet", sept: "septet", oct: "octet", non: "nonet" };
const lorentz = (x, x0, w) => { const g = w / 2; return (g * g) / ((x - x0) ** 2 + g * g); };

/** Lines (Hz offsets, intensities) from coupling sets [[n, J]…], plus the tree levels. */
export function multiplet(sets) {
  const js = [];
  for (const [n, J] of [...sets].sort((a, b) => b[1] - a[1])) if (J > 0) for (let k = 0; k < n; k++) js.push(J);
  let lines = new Map([[0, 1]]);
  const levels = [[{ x: 0, i: 1 }]];
  for (const J of js) {
    const next = new Map();
    for (const [x, i] of lines) for (const s of [-J / 2, J / 2]) {
      const k = Math.round((x + s) * 1000) / 1000;
      next.set(k, (next.get(k) ?? 0) + i / 2);
    }
    lines = next;
    levels.push([...lines].map(([x, i]) => ({ x, i })).sort((a, b) => a.x - b.x));
  }
  return { levels, js };
}

export function multName(sets) {
  const active = sets.filter(([n, J]) => n > 0 && J > 0).sort((a, b) => b[1] - a[1]);
  if (!active.length) return "s";
  if (active.every(([, J]) => Math.abs(J - active[0][1]) < 0.05)) return MULT[active.reduce((s, [n]) => s + n, 0)] ?? "m";
  if (active.some(([n]) => n > 8)) return "m";
  return active.map(([n]) => (n <= 3 ? MULT[n] : `(${MULT[n]})`)).join("");
}

const PRESETS = {
  ethyl: [[3, 7], [0, 7], [0, 4]],
  ipr: [[6, 6.8], [0, 7], [0, 4]],
  vinyl: [[1, 17.2], [1, 10.4], [0, 1.5]],
  propyl: [[3, 7.4], [2, 7.2], [0, 4]],
  dt: [[1, 10.5], [2, 6.4], [0, 4]],
  single: [[0, 7], [0, 7], [0, 4]],
};

for (const root of document.querySelectorAll("[data-spec-split]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  for (const b of root.querySelectorAll("[data-preset]"))
    b.addEventListener("click", () => {
      PRESETS[b.dataset.preset].forEach(([n, J], i) => { s[`n${i + 1}`].set(n, false); s[`j${i + 1}`].set(J, false); });
      draw();
    });

  function draw() {
    const sets = [1, 2, 3].map((k) => [s[`n${k}`].get(), s[`j${k}`].get()]);
    const { levels, js } = multiplet(sets);
    const lw = s.lw.get(), mhz = s.mhz.get();
    const final = levels[levels.length - 1];
    const span = js.reduce((a, J) => a + J, 0) / 2;
    const half = Math.max(span + 4 * lw + 3, 12);
    svg.replaceChildren();
    const L = 40, W = 560, sx = (x) => L + W / 2 + (x / half) * (W / 2);
    // Tree: one row per coupled proton, largest J first.
    const treeTop = 16, treeH = js.length ? Math.min(150, 22 * js.length) : 0, dy = js.length ? treeH / js.length : 0;
    if (js.length) {
      for (let k = 1; k < levels.length; k++) {
        const J = js[k - 1];
        for (const p of levels[k - 1]) for (const sgn of [-1, 1]) {
          el("line", { x1: sx(p.x), y1: treeTop + (k - 1) * dy, x2: sx(p.x + (sgn * J) / 2), y2: treeTop + k * dy, style: "stroke:var(--muted-foreground);stroke-opacity:0.7;stroke-width:1" }, svg);
        }
        if (k === 1 || js[k - 1] !== js[k - 2]) text(svg, L + W + 4, treeTop + k * dy + 3, `J ${num(J, 1)}`, { "text-anchor": "start" });
      }
    }
    // Spectrum: sticks plus the Lorentzian sum at the chosen line width.
    const top = treeTop + treeH + 16, base = 352;
    const H = base - top - 24;
    const maxI = Math.max(...final.map((p) => p.i));
    const xs = range(-half, half, half / 400);
    const env = xs.map((x) => final.reduce((a, p) => a + p.i * lorentz(x, p.x, lw), 0));
    const emax = Math.max(...env);
    polyline(svg, xs.map((x, i) => [sx(x), base - (env[i] / emax) * H]), "stroke:var(--foreground);stroke-width:1.5");
    // Drop the tree's last row onto the spectrum lines.
    if (js.length) for (const p of final)
      el("line", { x1: sx(p.x), x2: sx(p.x), y1: treeTop + treeH, y2: base - (p.i / maxI) * H * 0.98 - 4, style: "stroke:var(--muted-foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    for (const p of final) {
      el("line", { x1: sx(p.x), x2: sx(p.x), y1: base, y2: base - (p.i / maxI) * H * 0.98, style: "stroke:var(--brand);stroke-width:1.5;stroke-opacity:0.8" }, svg);
    }
    el("line", { x1: L, x2: L + W, y1: base, y2: base, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    for (const t of range(-Math.floor(half / 5) * 5, half, half > 40 ? 10 : 5)) {
      el("line", { x1: sx(t), x2: sx(t), y1: base, y2: base + 4, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      text(svg, sx(t), base + 15, num(t, 0), { "text-anchor": "middle" });
    }
    text(svg, L + W, base + 26, "Hz from the centre", { "text-anchor": "end" });
    // Intensities as the smallest whole-number ratio.
    const unit = Math.min(...final.map((p) => p.i));
    const ints = final.map((p) => Math.round(p.i / unit));
    const name = multName(sets);
    o.name.textContent = name === "m" ? "multiplet" : `${name}${MULT_NAME[name] ? ` (${MULT_NAME[name]})` : ""}`;
    o.lines.textContent = String(final.length);
    o.ints.textContent = ints.length > 12 ? `${ints.slice(0, 6).join(":")}…` : ints.join(" : ");
    o.width.textContent = `${num(span * 2, 1)} Hz = ${num((span * 2) / mhz, 4)} ppm`;
  }
  draw();
}

// ============================================================ assign a spectrum

// Groups: [label, δ ppm, protons, coupling sets [[n, J]], line width Hz]
const NMR = {
  ethanol: { structure: "CH₃(a)–CH₂(b)–OH(c)", groups: [["a", "CH₃", 1.22, 3, [[2, 7.0]]], ["b", "CH₂", 3.69, 2, [[3, 7.0]]], ["c", "OH", 2.61, 1, [], 4]] },
  ethylacetate: { structure: "CH₃(a)–C(=O)–O–CH₂(b)–CH₃(c)", groups: [["a", "CH₃–C=O", 2.04, 3, []], ["b", "O–CH₂", 4.12, 2, [[3, 7.1]]], ["c", "CH₃", 1.26, 3, [[2, 7.1]]]] },
  toluene: { structure: "C₆H₅(a)–CH₃(b)", groups: [["a", "ring H", 7.2, 5, [[2, 7.6], [1, 1.5]], 3], ["b", "Ar–CH₃", 2.36, 3, []]] },
  butanone: { structure: "CH₃(a)–C(=O)–CH₂(b)–CH₃(c)", groups: [["a", "CH₃–C=O", 2.14, 3, []], ["b", "CH₂–C=O", 2.44, 2, [[3, 7.3]]], ["c", "CH₃", 1.06, 3, [[2, 7.3]]]] },
  propanoic: { structure: "CH₃(a)–CH₂(b)–COOH(c)", groups: [["a", "CH₃", 1.16, 3, [[2, 7.5]]], ["b", "CH₂–C=O", 2.38, 2, [[3, 7.5]]], ["c", "COOH", 11.7, 1, [], 12]] },
  isopropanol: { structure: "(CH₃)₂(a)CH(b)–OH(c)", groups: [["a", "2 × CH₃", 1.2, 6, [[1, 6.1]]], ["b", "CH–O", 4.02, 1, [[6, 6.1]]], ["c", "OH", 2.0, 1, [], 5]] },
};

const RANGES = [
  ["C–H alkyl", 0.8, 1.8], ["H–C–C=O", 2.0, 2.7], ["Ar–CH₃", 2.2, 2.5], ["O–H alcohol", 1, 5.5], ["H–C–O", 3.3, 4.5],
  ["alkene C=C–H", 4.5, 6.5], ["aromatic", 6.5, 8.2], ["aldehyde", 9, 10.2], ["COOH", 10, 13],
];

for (const root of document.querySelectorAll("[data-spec-assign]")) {
  const svg = root.querySelector("[data-plot]");
  const rangesSvg = root.querySelector("[data-ranges]");
  const pick = root.querySelector("[data-pick]");
  const groupsBox = root.querySelector("[data-groups]");
  const structure = root.querySelector("[data-structure]");
  const fb = root.querySelector("[data-feedback]");
  const o = outs(root);
  const MHZ = 400;
  let sel = null, given = new Map(), checked = false;
  pick.addEventListener("change", load);
  root.querySelector('[data-act="check"]').addEventListener("click", () => {
    checked = true;
    const sigs = signals();
    const right = sigs.filter((g, i) => given.get(i) === g[0]).length;
    fb.textContent = right === sigs.length ? `All ${right} signals placed correctly.` : `${right} of ${sigs.length} correct${given.size < sigs.length ? `, ${sigs.length - given.size} still unplaced` : ""}. Wrong ones are marked.`;
    draw();
  });
  root.querySelector('[data-act="reveal"]').addEventListener("click", () => {
    signals().forEach((g, i) => given.set(i, g[0]));
    checked = true;
    fb.textContent = "Shown: shift for the neighbourhood, integral for the count, splitting for the neighbours.";
    draw();
  });
  root.querySelector('[data-act="reset"]').addEventListener("click", () => { given = new Map(); checked = false; sel = null; fb.textContent = ""; draw(); });

  // Signals are shown in order of shift, which hides the answer key's order.
  const signals = () => [...NMR[pick.value].groups].sort((a, b) => b[2] - a[2]);

  function load() {
    const M = NMR[pick.value];
    sel = null; given = new Map(); checked = false; fb.textContent = "";
    structure.textContent = M.structure;
    groupsBox.replaceChildren();
    for (const g of M.groups) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.group = g[0];
      b.className = "flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-[color,background-color,box-shadow] duration-150 hover:bg-accent outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
      b.innerHTML = `<span></span><span class="font-mono text-xs text-muted-foreground"></span>`;
      b.firstChild.textContent = `(${g[0]}) ${g[1]}`;
      b.addEventListener("click", () => {
        if (sel === null) { fb.textContent = "Click a signal in the spectrum first."; return; }
        given.set(sel, g[0]);
        checked = false;
        fb.textContent = `Signal at ${num(signals()[sel][2], 2)} ppm → (${g[0]}).`;
        const nxt = signals().findIndex((_, i) => !given.has(i));
        sel = nxt >= 0 ? nxt : sel;
        draw();
      });
      groupsBox.append(b);
    }
    drawRanges();
    draw();
  }

  function draw() {
    const sigs = signals();
    const hi = Math.max(...sigs.map((g) => g[2])) > 9 ? 13 : 9;
    svg.replaceChildren();
    const f = frame(svg, { box: [24, 40, 592, 210], x: [hi, -0.2], y: [0, 1.15], xticks: range(0, hi, 1), xlabel: "δ / ppm", yticks: [] });
    // Each signal: its multiplet broadened enough to read at full width.
    const smallest = Math.min(...sigs.map((g) => g[3]));
    const curves = sigs.map((g) => {
      const { levels } = multiplet(g[4]);
      const lines = levels[levels.length - 1];
      const lw = g[5] ?? 1.2;
      const half = lines.reduce((a, p) => Math.max(a, Math.abs(p.x)), 0) + 6 * lw;
      const xs = range(-half, half, half / 120);
      const ys = xs.map((x) => lines.reduce((a, p) => a + p.i * lorentz(x, p.x, lw), 0));
      return { g, xs, ys, half };
    });
    const peakMax = Math.max(...sigs.map((g) => g[3]));
    curves.forEach((c, i) => {
      const { g, xs, ys, half } = c;
      const scale = (g[3] / peakMax) / Math.max(...ys);
      // Drawn ×6 wider than real so the splitting is visible on the full axis.
      const ppm = (x) => g[2] - (x / MHZ) * 6;
      const isSel = sel === i, mark = given.has(i) ? (checked ? (given.get(i) === g[0] ? "var(--brand)" : "var(--code-del)") : "var(--vec-u)") : "var(--foreground)";
      polyline(svg, xs.map((x, k) => [f.sx(ppm(x)), f.sy(ys[k] * scale)]), `stroke:${isSel ? "var(--brand)" : mark};stroke-width:${isSel ? 2 : 1.4}`);
      // Integral step above each signal.
      const ix0 = f.sx(ppm(-half)), ix1 = f.sx(ppm(half));
      el("path", { d: `M${ix0},${f.sy(1.02)} C${(ix0 + ix1) / 2},${f.sy(1.02)} ${(ix0 + ix1) / 2},${f.sy(1.02 + 0.1 * g[3] / smallest / 3)} ${ix1},${f.sy(1.02 + 0.1 * g[3] / smallest / 3)}`, style: "fill:none;stroke:var(--muted-foreground);stroke-width:1" }, svg);
      text(svg, f.sx(g[2]), f.T - 24, `${num(g[3] / smallest, g[3] % smallest ? 1 : 0)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      const lab = given.has(i) ? `(${given.get(i)})` : "?";
      text(svg, f.sx(g[2]), f.T - 10, lab, { "text-anchor": "middle", class: `${isSel ? "fill-foreground" : "fill-muted-foreground"} font-mono text-[10px]` });
      const hit = el("rect", { x: Math.min(ix0, ix1) - 6, y: f.T - 34, width: Math.abs(ix1 - ix0) + 12, height: f.H + 34, tabindex: 0, role: "button", "aria-pressed": String(isSel), "aria-label": `Signal at ${num(g[2], 2)} ppm, integral ${g[3] / smallest}, ${MULT_NAME[multName(g[4])] ?? "multiplet"}${given.has(i) ? `, assigned to ${given.get(i)}` : ""}`, style: "fill:transparent;cursor:pointer;outline:none" }, svg);
      const choose = () => { sel = i; draw(); svg.querySelectorAll("rect[role=button]")[i]?.focus(); };
      hit.addEventListener("click", choose);
      hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    });
    text(svg, f.L + 4, f.T + f.H - 6, "multiplets drawn ×6 wider than scale", { "text-anchor": "start" });
    for (const b of groupsBox.querySelectorAll("[data-group]")) {
      const n = [...given.values()].filter((v) => v === b.dataset.group).length;
      b.lastChild.textContent = n ? `${n} signal${n > 1 ? "s" : ""}` : "";
    }
    const g = sel === null ? null : sigs[sel];
    o.signal.textContent = g ? `#${sel + 1} of ${sigs.length}` : "click a signal";
    o.shift.textContent = g ? `${num(g[2], 2)} ppm` : "—";
    o.integral.textContent = g ? `${num(g[3] / smallest, 1)} (${g[3]}H in this molecule)` : "—";
    const nm = g ? multName(g[4]) : null;
    o.mult.textContent = g ? `${nm}${MULT_NAME[nm] ? `, ${MULT_NAME[nm]}` : ""}${g[5] && g[5] > 3 ? ", broad" : ""}` : "—";
    o.done.textContent = `${given.size} of ${sigs.length}`;
  }

  function drawRanges() {
    rangesSvg.replaceChildren();
    const f = frame(rangesSvg, { box: [24, 8, 592, 84], x: [13, -0.2], y: [0, RANGES.length], xticks: range(0, 13, 1), xlabel: "typical δ / ppm", yticks: [] });
    RANGES.forEach(([name, a, b], k) => {
      const y = f.T + (k + 0.15) * (f.H / RANGES.length), h = (f.H / RANGES.length) * 0.7;
      el("rect", { x: f.sx(b), y, width: f.sx(a) - f.sx(b), height: h, rx: 2, style: "fill:var(--vec-v);fill-opacity:0.3" }, rangesSvg);
      const right = f.sx(a) + 4 + name.length * 5 < 636;
      text(rangesSvg, right ? f.sx(a) + 4 : f.sx(b) - 4, y + h - 1, name, { "text-anchor": right ? "start" : "end", class: "fill-muted-foreground font-mono text-[8px]" });
    });
  }
  load();
}

