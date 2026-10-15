// Music theory and acoustics blocks. Sound starts only after a user
// gesture, at low volume; notes play instantly (no animation on keys).

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const nameOf = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const freqOf = (m) => 440 * 2 ** ((m - 69) / 12); // 12-TET, A4 = 440 Hz
const minus = (s) => String(s).replace("-", "−");

// ------------------------------------------------------------ audio

let audio;
function ctx() {
  if (!audio) {
    const c = new AudioContext();
    const comp = c.createDynamicsCompressor();
    const master = c.createGain();
    master.gain.value = 0.22;
    master.connect(comp).connect(c.destination);
    audio = { c, master };
  }
  if (audio.c.state === "suspended") audio.c.resume();
  return audio;
}

// tone plays one note with a short attack and release; returns a stop().
function tone(freq, { when = 0, dur = 0.6, type = "triangle", gain = 0.5, wave } = {}) {
  const { c, master } = ctx();
  const t0 = Math.max(c.currentTime, when || c.currentTime) + 0.005;
  const o = c.createOscillator();
  if (wave) o.setPeriodicWave(wave);
  else o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(gain * 0.6, t0 + 0.15);
  o.connect(g).connect(master);
  o.start(t0);
  const stop = (at) => {
    const t = Math.max(at ?? c.currentTime, t0 + 0.02);
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, 0.05);
    o.stop(t + 0.4);
  };
  if (dur) stop(t0 + dur);
  return stop;
}

// keyboard wires a [data-keyboard]: onPress(midi) when a key goes down.
function keyboard(kb, { onPress, momentary = true } = {}) {
  const keys = new Map([...kb.querySelectorAll("[data-midi]")].map((k) => [+k.dataset.midi, k]));
  kb.addEventListener("pointerdown", (e) => {
    const k = e.target.closest("[data-midi]");
    if (!k) return;
    e.preventDefault();
    const m = +k.dataset.midi;
    const stop = onPress(m, k);
    if (momentary) {
      k.dataset.on = "";
      const up = () => { delete k.dataset.on; stop?.(); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    }
  });
  // Keyboard users: Enter/Space on a focused key.
  kb.addEventListener("keydown", (e) => {
    const k = e.target.closest("[data-midi]");
    if (!k || (e.key !== "Enter" && e.key !== " ") || e.repeat) return;
    e.preventDefault();
    const stop = onPress(+k.dataset.midi, k);
    if (momentary) { k.dataset.on = ""; setTimeout(() => { delete k.dataset.on; stop?.(); }, 250); }
  });
  return keys;
}

const visible = (node, cb) => new IntersectionObserver(([e]) => cb(e.isIntersecting)).observe(node);

// ============================================================ Piano

const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

for (const root of document.querySelectorAll("[data-music-piano]")) {
  const o = outs(root);
  const show = (m) => {
    o.note.textContent = nameOf(m);
    o.midi.textContent = String(m);
    o.freq.textContent = `${num(freqOf(m), 2)} Hz`;
    o.formula.textContent = `440 · 2^(${minus(m - 69)}/12)`;
  };
  const keys = keyboard(root.querySelector("[data-keyboard]"), { onPress: (m) => { show(m); return tone(freqOf(m), { dur: 0 }); } });
  // Label every white key with its name.
  for (const [m, k] of keys) if (!NAMES[m % 12].includes("♯")) k.querySelector("[data-label]").textContent = nameOf(m);

  let inView = false;
  visible(root, (v) => (inView = v));
  const held = new Map();
  document.addEventListener("keydown", (e) => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (!inView || m === undefined || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    show(m);
    keys.get(m).dataset.on = "";
    held.set(m, tone(freqOf(m), { dur: 0 }));
  });
  document.addEventListener("keyup", (e) => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m === undefined || !held.has(m)) return;
    held.get(m)();
    held.delete(m);
    delete keys.get(m).dataset.on;
  });
}

// ============================================================ Intervals

for (const root of document.querySelectorAll("[data-music-intervals]")) {
  const C4 = freqOf(60);
  // A sawtooth through a low-pass: rich in harmonics, so mistuned
  // intervals audibly beat.
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dyad]");
    if (!b) return;
    const [kind, v] = b.dataset.dyad.split(":");
    const [num_, den] = v.split("/").map(Number);
    const r = kind === "just" ? num_ / den : 2 ** (num_ / 12);
    for (const f of [C4, C4 * r]) tone(f, { dur: 2, type: "sawtooth", gain: 0.18 });
  });
}

// ============================================================ Timbre

const PRESETS = {
  sine: (n) => (n === 1 ? 1 : 0),
  saw: (n) => 1 / n,
  square: (n) => (n % 2 ? 1 / n : 0),
  triangle: (n) => (n % 2 ? 1 / (n * n) : 0),
  organ: (n) => [1, 0.55, 0.65, 0.3, 0.25, 0.18, 0.08, 0.15, 0.05, 0.04, 0.02, 0.03][n - 1],
  clear: () => 0,
};
// Signs that make the textbook shapes: sawtooth (−1)^(n+1), triangle
// alternates over its odd harmonics.
const SIGNS = { saw: (n) => (n % 2 ? 1 : -1), triangle: (n) => (((n - 1) / 2) % 2 ? -1 : 1) };

for (const root of document.querySelectorAll("[data-music-timbre]")) {
  const wave = root.querySelector("[data-wave]");
  const spec = root.querySelector("[data-spectrum]");
  const N = 12;
  let amp = Array.from({ length: N }, (_, i) => PRESETS.saw(i + 1));
  let sign = Array.from({ length: N }, (_, i) => SIGNS.saw(i + 1));
  const s = scrubAll(root, () => {});

  function draw() {
    wave.replaceChildren();
    const ys = Array.from({ length: 401 }, (_, i) => {
      const t = (2 * i) / 400; // two periods
      return amp.reduce((a, A, k) => a + sign[k] * A * Math.sin(2 * Math.PI * (k + 1) * t), 0);
    });
    const m = Math.max(1e-9, ...ys.map(Math.abs));
    const f = frame(wave, { box: [36, 10, 512, 150], x: [0, 2], y: [-1.1, 1.1], xticks: [0, 1, 2], yticks: [0], xfmt: (v) => `${v}T` });
    text(wave, 4, 16, "signal");
    polyline(wave, ys.map((y, i) => [f.sx((2 * i) / 400), f.sy(y / m)]), "stroke:var(--brand);stroke-width:1.75");

    spec.replaceChildren();
    const g = frame(spec, { box: [36, 22, 512, 118], x: [0.5, N + 0.5], y: [0, 1], xticks: Array.from({ length: N }, (_, i) => i + 1), yticks: [0, 0.5, 1], xlabel: "harmonic n" });
    text(spec, 4, 12, "amplitude");
    amp.forEach((A, k) => {
      const x = g.sx(k + 1);
      el("rect", { x: x - 14, y: g.T, width: 28, height: g.H, style: "fill:transparent" }, spec).dataset.n = k;
      el("rect", { x: x - 9, y: g.sy(A), width: 18, height: g.T + g.H - g.sy(A), rx: 2, style: "fill:var(--foreground);fill-opacity:0.75;pointer-events:none" }, spec);
    });
    spec._g = g;
  }

  let dragging = false;
  const setFrom = (e) => {
    const g = spec._g;
    const pt = spec.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(spec.getScreenCTM().inverse());
    const k = Math.round(0.5 + ((p.x - g.L) / g.W) * N) - 1;
    if (k < 0 || k >= N) return;
    amp[k] = Math.round(Math.min(1, Math.max(0, (g.T + g.H - p.y) / g.H)) * 100) / 100;
    if (!sign[k]) sign[k] = 1;
    draw();
  };
  spec.addEventListener("pointerdown", (e) => { dragging = true; spec.setPointerCapture(e.pointerId); setFrom(e); });
  spec.addEventListener("pointermove", (e) => dragging && setFrom(e));
  spec.addEventListener("pointerup", () => (dragging = false));

  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = b.dataset.preset;
    amp = Array.from({ length: N }, (_, i) => PRESETS[p](i + 1));
    sign = Array.from({ length: N }, (_, i) => (SIGNS[p] ? SIGNS[p](i + 1) : 1));
    draw();
  }));
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    const { c } = ctx();
    const imag = new Float32Array(N + 1), real = new Float32Array(N + 1);
    amp.forEach((A, k) => (imag[k + 1] = sign[k] * A));
    if (!amp.some((A) => A > 0)) return;
    tone(s.f0.get(), { dur: 1.5, wave: c.createPeriodicWave(real, imag), gain: 0.4 });
  });
  draw();
}

// ============================================================ Spelling

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };
const parseName = (n) => {
  const li = LETTERS.indexOf(n[0]);
  const acc = (n.match(/♯/g) || []).length - (n.match(/♭/g) || []).length;
  return { li, pc: (((NATURAL[li] + acc) % 12) + 12) % 12 };
};
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], pentatonic: [0, 2, 4, 7, 9],
};
// Letter steps per degree: one letter each, except the pentatonic, which
// skips the 4th and 7th degrees of the major scale.
const DEGREES = { pentatonic: [0, 1, 2, 4, 5] };

// spell names each note of a scale so every letter is used once.
function spell(tonic, mode) {
  const { li, pc } = parseName(tonic);
  const degs = DEGREES[mode] || [0, 1, 2, 3, 4, 5, 6];
  return MODES[mode].map((off, i) => {
    const L = (li + degs[i]) % 7;
    const target = (pc + off) % 12;
    let acc = target - NATURAL[L];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    return { name: LETTERS[L] + (ACC[acc] ?? "?"), pc: target, off };
  });
}

// ============================================================ Circle of fifths

const CIRCLE = [
  ["C", "A", 0], ["G", "E", 1], ["D", "B", 2], ["A", "F♯", 3], ["E", "C♯", 4], ["B", "G♯", 5],
  ["F♯", "D♯", 6], ["D♭", "B♭", -5], ["A♭", "F", -4], ["E♭", "C", -3], ["B♭", "G", -2], ["F", "D", -1],
];
const ALT = { "F♯": "G♭", B: "C♭", "D♭": "C♯", "D♯": "E♭" };
const SHARPS = ["F♯", "C♯", "G♯", "D♯", "A♯", "E♯", "B♯"];
const FLATS = ["B♭", "E♭", "A♭", "D♭", "G♭", "C♭", "F♭"];

for (const root of document.querySelectorAll("[data-music-circle]")) {
  const svg = root.querySelector("[data-circle]");
  const o = outs(root);
  let sel = 0;
  const cx = 200, cy = 200;
  const arc = (r0, r1, a0, a1) => {
    const p = (r, a) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`;
    return `M${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
  };
  function draw() {
    svg.replaceChildren();
    CIRCLE.forEach(([maj, min, n], i) => {
      const a0 = ((i - 0.5) * Math.PI) / 6 + 0.01, a1 = ((i + 0.5) * Math.PI) / 6 - 0.01, am = (i * Math.PI) / 6;
      const on = i === sel;
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `${maj} major, ${min} minor`, "data-i": i, class: "cursor-pointer outline-none [&:focus-visible_path]:stroke-ring" }, svg);
      el("path", { d: arc(118, 188, a0, a1), style: `fill:${on ? "var(--brand)" : "var(--background)"};fill-opacity:${on ? 0.16 : 1};stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.2}` }, g);
      el("path", { d: arc(70, 116, a0, a1), style: `fill:${on ? "var(--brand)" : "var(--background)"};fill-opacity:${on ? 0.08 : 1};stroke:currentColor;stroke-opacity:0.15` }, g);
      const R = (r) => [cx + r * Math.sin(am), cy - r * Math.cos(am)];
      const [mx, my] = R(160), [nx, ny] = R(93), [sx, sy] = R(131);
      text(g, mx, my + 6, maj + (ALT[maj] && Math.abs(n) >= 5 ? "" : ""), { "text-anchor": "middle", class: `${on ? "fill-brand" : "fill-foreground"} text-[17px] font-semibold` });
      text(g, nx, ny + 4, min.toLowerCase(), { "text-anchor": "middle", class: "fill-muted-foreground text-[12px]" });
      text(g, sx, sy + 3, n === 0 ? "" : n > 0 ? `${n}♯` : `${-n}♭`, { "text-anchor": "middle" });
    });
    text(svg, cx, cy + 4, "fifths →", { "text-anchor": "middle" });
    const [maj, min, n] = CIRCLE[sel];
    const alt = ALT[maj];
    o.key.textContent = `${maj} major${alt ? ` (= ${alt} major)` : ""}`;
    o.minor.textContent = `relative minor: ${min} minor`;
    o.sig.textContent = n === 0 ? "no sharps or flats" : n > 0 ? `${n} sharp${n > 1 ? "s" : ""}: ${SHARPS.slice(0, n).join(" ")}` : `${-n} flat${n < -1 ? "s" : ""}: ${FLATS.slice(0, -n).join(" ")}`;
    o.scale.textContent = spell(maj, "ionian").map((x) => x.name).join(" ");
  }
  const pick = (i) => { sel = i; draw(); svg.querySelector(`[data-i="${i}"]`)?.focus({ preventScroll: true }); };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-i]"); if (g) pick(+g.dataset.i); });
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); pick((sel + d + 12) % 12); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playTonic(); }
  });
  const playTonic = () => {
    const pc = parseName(CIRCLE[sel][0]).pc;
    for (const off of [0, 4, 7, 12]) tone(freqOf(60 + pc + off), { dur: 1.2, gain: 0.3 });
  };
  root.querySelector("[data-action=play]").addEventListener("click", playTonic);
  draw();
}

// ============================================================ Scales

for (const root of document.querySelectorAll("[data-music-scales]")) {
  const kbEl = root.querySelector("[data-keyboard]");
  const keys = keyboard(kbEl, { onPress: (m) => tone(freqOf(m), { dur: 0 }) });
  const o = outs(root);
  const selTonic = root.querySelector('[data-select="tonic"]');
  const selMode = root.querySelector('[data-select="mode"]');
  let notes = [];

  function draw() {
    notes = spell(selTonic.value, selMode.value);
    const pcs = new Map(notes.map((n) => [n.pc, n.name]));
    for (const [m, k] of keys) {
      const name = pcs.get(m % 12);
      if (name) k.dataset.hl = ""; else delete k.dataset.hl;
      k.querySelector("[data-label]").textContent = name ?? (m % 12 === 0 ? nameOf(m) : "");
    }
    const offs = [...MODES[selMode.value], 12];
    o.steps.textContent = offs.slice(1).map((v, i) => ({ 1: "H", 2: "W", 3: "1½" })[v - offs[i]] ?? "?").join(" ");
    o.notes.replaceChildren(...notes.map((n, i) => {
      const s = document.createElement("span");
      s.className = "flex flex-col items-center rounded-md border bg-background px-2.5 py-1";
      s.innerHTML = `<span class="text-base font-medium"></span><span class="font-mono text-[10px] text-muted-foreground"></span>`;
      s.children[0].textContent = n.name;
      s.children[1].textContent = String(i + 1);
      return s;
    }));
  }
  selTonic.addEventListener("change", draw);
  selMode.addEventListener("change", draw);
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    const { c } = ctx();
    const base = 60 + notes[0].pc;
    const seq = [...notes.map((n) => base + n.off), base + 12, ...notes.map((n) => base + n.off).reverse()];
    seq.forEach((m, i) => {
      const when = c.currentTime + 0.05 + i * 0.28;
      tone(freqOf(m), { when, dur: 0.26, gain: 0.35 });
      // Light the key while it sounds (it is the explanation, not decoration).
      const k = keys.get(m);
      if (k) setTimeout(() => { k.dataset.on = ""; setTimeout(() => delete k.dataset.on, 250); }, (when - c.currentTime) * 1000);
    });
  });
  draw();
}

// ============================================================ Chords

const CHORDS = {
  "0,4,7": ["", "major triad"], "0,3,7": ["m", "minor triad"], "0,3,6": ["dim", "diminished triad"], "0,4,8": ["aug", "augmented triad"],
  "0,2,7": ["sus2", "suspended second"], "0,5,7": ["sus4", "suspended fourth"],
  "0,4,7,10": ["7", "dominant seventh"], "0,4,7,11": ["maj7", "major seventh"], "0,3,7,10": ["m7", "minor seventh"],
  "0,3,6,10": ["m7♭5", "half-diminished seventh"], "0,3,6,9": ["dim7", "diminished seventh"], "0,4,7,9": ["6", "major sixth"], "0,3,7,9": ["m6", "minor sixth"],
  "0,3,7,11": ["m(maj7)", "minor-major seventh"],
};
const INTERVAL = ["unison", "minor second", "major second", "minor third", "major third", "perfect fourth", "tritone", "perfect fifth", "minor sixth", "major sixth", "minor seventh", "major seventh"];
const DEG = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♯5/♭6", "6", "♭7", "7"];
// Letter steps of each chord tone above the root (thirds stack on every
// other letter; sus and sixth chords differ).
const LETTER_STEPS = { "0,2,7": [0, 1, 4], "0,5,7": [0, 3, 4], "0,4,7,9": [0, 2, 4, 5], "0,3,7,9": [0, 2, 4, 5] };
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// spellChord names the root and each tone by letter, trying the sharp and
// the flat name of the root and keeping the one with fewer accidentals.
function spellChord(rootPc, key) {
  const offs = key.split(",").map(Number);
  const steps = LETTER_STEPS[key] || offs.map((_, i) => 2 * i);
  let best;
  for (const rootName of new Set([NAMES[rootPc], FLAT_NAMES[rootPc]])) {
    const { li } = parseName(rootName);
    let cost = 0;
    const tones = offs.map((off, i) => {
      const L = (li + steps[i]) % 7;
      let acc = ((rootPc + off) % 12) - NATURAL[L];
      if (acc > 6) acc -= 12;
      if (acc < -6) acc += 12;
      cost += Math.abs(acc);
      return { off, name: LETTERS[L] + (ACC[acc] ?? "?"), acc };
    });
    if (!best || cost < best.cost) best = { cost, root: rootName, tones };
  }
  return best;
}

const BUILD = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10] };

for (const root of document.querySelectorAll("[data-music-chords]")) {
  const o = outs(root);
  const sel = new Set();
  const keys = keyboard(root.querySelector("[data-keyboard]"), {
    momentary: false,
    onPress: (m) => {
      if (sel.has(m)) sel.delete(m);
      else { sel.add(m); tone(freqOf(m), { dur: 0.5, gain: 0.35 }); }
      draw();
    },
  });
  for (const [m, k] of keys) if (m % 12 === 0) k.querySelector("[data-label]").textContent = nameOf(m);

  function identify() {
    const notes = [...sel].sort((a, b) => a - b);
    if (notes.length < 2) return null;
    const pcs = [...new Set(notes.map((m) => m % 12))];
    const bass = notes[0] % 12;
    if (pcs.length === 2) {
      const d = (notes.at(-1) - notes[0]) % 12;
      return { name: INTERVAL[d], detail: `an interval of ${notes.at(-1) - notes[0]} semitones`, root: bass };
    }
    // Try each note as the root; prefer the bass when several match
    // (augmented triads and diminished sevenths are symmetric).
    const cands = pcs.map((r) => {
      const key = pcs.map((p) => (p - r + 12) % 12).sort((a, b) => a - b).join(",");
      return CHORDS[key] ? { r, key, sym: CHORDS[key][0], long: CHORDS[key][1] } : null;
    }).filter(Boolean);
    if (!cands.length) return { name: "No common chord", detail: pcs.map((p) => NAMES[p]).join(" "), root: bass };
    const c = cands.find((x) => x.r === bass) || cands[0];
    const sp = spellChord(c.r, c.key);
    const b = (bass - c.r + 12) % 12;
    const toneName = (pc) => sp.tones.find((t) => t.off === (pc - c.r + 12) % 12)?.name ?? NAMES[pc];
    const inv = b === 0 ? "root position" : [3, 4].includes(b) ? "first inversion" : [6, 7, 8].includes(b) ? "second inversion" : "third inversion";
    const slash = b === 0 ? "" : `/${toneName(bass)}`;
    return { name: `${sp.root}${c.sym}${slash}`, detail: `${sp.root} ${c.long}, ${inv}`, root: c.r, toneName };
  }

  function draw() {
    for (const [m, k] of keys) if (sel.has(m)) k.dataset.hl = ""; else delete k.dataset.hl;
    const notes = [...sel].sort((a, b) => a - b);
    const id = identify();
    o.name.textContent = id ? id.name : "—";
    o.detail.textContent = id ? id.detail : "Click two or more keys";
    // Spelled by letter when the chord is known (E♭, not D♯, in Am7♭5).
    o.notes.textContent = notes.length ? notes.map((m) => (id?.toneName ? id.toneName(m % 12) : NAMES[m % 12])).join(" ") : "—";
    o.intervals.textContent = id && notes.length > 2 ? notes.map((m) => DEG[(m - id.root + 120) % 12]).join(" ") : "—";
  }
  root.querySelectorAll("[data-quality]").forEach((b) => b.addEventListener("click", () => {
    const rootNote = sel.size ? Math.min(...sel) : 60;
    sel.clear();
    for (const off of BUILD[b.dataset.quality]) if (rootNote + off <= 71) sel.add(rootNote + off);
    draw();
    playChord();
  }));
  const playChord = () => [...sel].forEach((m) => tone(freqOf(m), { dur: 1.2, gain: 0.25 }));
  root.querySelector("[data-action=play]").addEventListener("click", playChord);
  root.querySelector("[data-action=clear]").addEventListener("click", () => { sel.clear(); draw(); });
  root.querySelector("[data-action=invert]").addEventListener("click", () => {
    if (sel.size < 2) return;
    const low = Math.min(...sel);
    sel.delete(low);
    let up = low + 12;
    while (sel.has(up)) up += 12;
    if (up > 71) { // no room above: drop everything an octave first
      const all = [...sel].map((m) => m - 12);
      sel.clear(); all.forEach((m) => sel.add(m));
      up -= 12;
    }
    sel.add(up);
    draw();
    playChord();
  });
  draw();
}

// ============================================================ String and beats

for (const root of document.querySelectorAll("[data-music-string]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw(0));
  let mode = "standing", raf = 0, inView = false, t0 = performance.now();
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(0); loop(); });

  const nearest = (f) => {
    const m = 69 + 12 * Math.log2(f / 440);
    const r = Math.round(m);
    return `${nameOf(r)} ${m - r >= 0 ? "+" : "−"}${num(Math.abs(m - r) * 100, 0)}¢`;
  };

  function standing(phase) {
    const L = s.L.get(), T = s.T.get(), mu = s.mu.get() / 1000, n = s.n.get();
    const v = Math.sqrt(T / mu), f = (n * v) / (2 * L);
    const fr = frame(svg, { box: [30, 20, 500, 200], x: [0, L], y: [-1.3, 1.3], xticks: [0, L], yticks: [], xfmt: (x) => `${num(x, 2)} m` });
    const xs = Array.from({ length: 241 }, (_, i) => (i / 240) * L);
    const shape = (x) => Math.sin((n * Math.PI * x) / L);
    for (const sgn of [1, -1]) polyline(svg, xs.map((x) => [fr.sx(x), fr.sy(sgn * shape(x))]), "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4");
    polyline(svg, xs.map((x) => [fr.sx(x), fr.sy(shape(x) * Math.cos(phase))]), "stroke:var(--brand);stroke-width:2.5;stroke-linecap:round");
    for (let k = 0; k <= n; k++) el("circle", { cx: fr.sx((k * L) / n), cy: fr.sy(0), r: k === 0 || k === n ? 4 : 3, style: `fill:${k === 0 || k === n ? "var(--foreground)" : "var(--background)"};stroke:var(--foreground);stroke-width:1.5` }, svg);
    o.v.textContent = `${num(v, 1)} m/s`;
    o.f.textContent = `${num(f, 2)} Hz (${nearest(f)})`;
    o.list.textContent = [1, 2, 3, 4, 5, 6].map((k) => num((k * v) / (2 * L), 0)).join(", ") + " Hz";
    o.caption.textContent = `Harmonic ${n}: ${n + 1} nodes including the fixed ends. The motion is slowed down about ${num(f / 0.8, 0)}×.`;
    return f;
  }

  function beats() {
    const fa = s.fa.get(), fb = s.fb.get(), d = Math.abs(fa - fb);
    const span = d > 0.05 ? Math.min(2, 3 / d) : 1;
    const fr = frame(svg, { box: [30, 20, 500, 200], x: [0, span], y: [-2.2, 2.2], xticks: [0, span / 2, span], yticks: [], xfmt: (x) => `${num(x, 2)} s` });
    const xs = Array.from({ length: 601 }, (_, i) => (i / 600) * span);
    const env = (t) => Math.abs(2 * Math.cos(Math.PI * d * t));
    const top = xs.map((t) => [fr.sx(t), fr.sy(env(t))]);
    const bot = xs.map((t) => [fr.sx(t), fr.sy(-env(t))]).reverse();
    el("path", { d: "M" + [...top, ...bot].map((p) => p.join(",")).join(" L") + " Z", style: "fill:var(--brand);fill-opacity:0.18;stroke:none" }, svg);
    polyline(svg, top, "stroke:var(--brand);stroke-width:1.5");
    polyline(svg, bot.slice().reverse(), "stroke:var(--brand);stroke-width:1.5");
    o.v.textContent = "—";
    o.f.textContent = `beats at ${num(d, 2)} Hz`;
    o.list.textContent = `carrier ${num((fa + fb) / 2, 2)} Hz`;
    o.caption.textContent = `The sum of the two tones is a ${num((fa + fb) / 2, 1)} Hz carrier, far too fast to draw here, inside this envelope, which swells ${num(d, 2)} times a second.`;
  }

  function draw(phase) {
    svg.replaceChildren();
    if (mode === "standing") standing(phase); else beats();
  }
  const loop = () => {
    cancelAnimationFrame(raf);
    if (mode !== "standing" || !inView || reduced()) return draw(0);
    const step = (now) => {
      draw(((now - t0) / 1000) * 2 * Math.PI * 0.8);
      raf = inView && mode === "standing" ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  };
  visible(root, (v) => { inView = v; loop(); });
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (mode === "standing") {
      const L = s.L.get(), v = Math.sqrt(s.T.get() / (s.mu.get() / 1000));
      tone((s.n.get() * v) / (2 * L), { dur: 1.5, type: "sine", gain: 0.5 });
    } else {
      for (const f of [s.fa.get(), s.fb.get()]) tone(f, { dur: 3, type: "sine", gain: 0.35 });
    }
  });
  draw(0);
}

// ============================================================ Sequencer

const TRACKS = ["Kick", "Snare", "Hi-hat", "Clap"];
const METRES = {
  "4/4": { steps: 16, group: 4, perBeat: 4, unit: "quarter note" },
  "3/4": { steps: 12, group: 4, perBeat: 4, unit: "quarter note" },
  "6/8": { steps: 12, group: 6, perBeat: 6, unit: "dotted quarter note" },
};
const PATTERNS = {
  "4/4": [[0, 8, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], []],
  "3/4": [[0], [4, 8], [0, 2, 4, 6, 8, 10], []],
  "6/8": [[0], [6], [0, 2, 4, 6, 8, 10], [10]],
};

function drum(track, when) {
  const { c, master } = ctx();
  const noise = (dur) => {
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    return src;
  };
  const g = c.createGain();
  g.connect(master);
  if (track === 0) { // kick: a sine sweeping down
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.15);
    g.gain.setValueAtTime(0.9, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    o.connect(g); o.start(when); o.stop(when + 0.32);
  } else if (track === 1) { // snare: band-passed noise
    const n = noise(0.2), f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.6, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    n.connect(f).connect(g); n.start(when);
  } else if (track === 2) { // hi-hat: high-passed noise, short
    const n = noise(0.06), f = c.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.35, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    n.connect(f).connect(g); n.start(when);
  } else { // clap: three quick noise bursts
    const f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 1.5;
    f.connect(g);
    g.gain.setValueAtTime(0.5, when);
    for (const dt of [0, 0.012, 0.024]) { const n = noise(0.08); n.connect(f); n.start(when + dt); }
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
  }
}

for (const root of document.querySelectorAll("[data-music-seq]")) {
  const gridEl = root.querySelector("[data-grid]");
  const o = outs(root);
  const playBtn = root.querySelector("[data-action=play]");
  const s = scrubAll(root, info);
  let metre = "4/4";
  let pattern;
  let playing = false, timer = 0, raf = 0, step = 0, nextTime = 0;
  const queue = [];

  function build() {
    const M = METRES[metre];
    pattern = TRACKS.map((_, t) => Array.from({ length: M.steps }, (_, i) => PATTERNS[metre][t].includes(i)));
    gridEl.innerHTML = "";
    const table = document.createElement("div");
    table.className = "grid min-w-[560px] items-center gap-1";
    table.style.gridTemplateColumns = `5rem repeat(${M.steps}, minmax(0, 1fr))`;
    TRACKS.forEach((name, t) => {
      const lab = document.createElement("span");
      lab.className = "text-xs text-muted-foreground";
      lab.textContent = name;
      table.append(lab);
      for (let i = 0; i < M.steps; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.t = t; b.dataset.i = i;
        b.setAttribute("aria-label", `${name}, step ${i + 1}`);
        b.setAttribute("aria-pressed", String(pattern[t][i]));
        b.className = "h-8 rounded-md border outline-none transition-colors duration-100 hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/70 data-[now]:ring-2 data-[now]:ring-foreground/60 "
          + (i % M.group === 0 ? "bg-foreground/[0.07]" : "bg-background");
        table.append(b);
      }
    });
    gridEl.append(table);
    info();
  }
  gridEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    const t = +b.dataset.t, i = +b.dataset.i;
    pattern[t][i] = !pattern[t][i];
    b.setAttribute("aria-pressed", String(pattern[t][i]));
    if (pattern[t][i]) drum(t, ctx().c.currentTime + 0.01);
  });

  function stepDur() { return 60 / s.bpm.get() / METRES[metre].perBeat; }
  function info() {
    const M = METRES[metre];
    o.info.textContent = `${metre}: ${M.steps} steps per bar, beat = ${M.unit} at ${s.bpm.get()} BPM · step ${num(stepDur() * 1000, 1)} ms · bar ${num(stepDur() * M.steps, 2)} s`;
  }

  // The lookahead scheduler: a coarse timer wakes every 25 ms and places
  // every step that falls in the next 100 ms on the audio clock.
  function schedule() {
    const { c } = ctx();
    while (nextTime < c.currentTime + 0.1) {
      pattern.forEach((row, t) => row[step % row.length] && drum(t, nextTime));
      queue.push([step % pattern[0].length, nextTime]);
      nextTime += stepDur();
      step = (step + 1) % pattern[0].length;
    }
    timer = setTimeout(schedule, 25);
  }
  function paint() {
    const { c } = ctx();
    let cur = null;
    while (queue.length && queue[0][1] <= c.currentTime) cur = queue.shift()[0];
    if (cur !== null) for (const b of gridEl.querySelectorAll("[data-i]")) +b.dataset.i === cur ? (b.dataset.now = "") : delete b.dataset.now;
    raf = playing ? requestAnimationFrame(paint) : 0;
  }
  function setPlaying(p) {
    playing = p;
    playBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    playBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    playBtn.querySelector("[data-label]").textContent = p ? "Stop" : "Play";
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    queue.length = 0;
    for (const b of gridEl.querySelectorAll("[data-now]")) delete b.dataset.now;
    if (p) {
      step = 0;
      nextTime = ctx().c.currentTime + 0.05;
      schedule();
      raf = requestAnimationFrame(paint);
    }
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=clear]").addEventListener("click", () => {
    pattern.forEach((row) => row.fill(false));
    gridEl.querySelectorAll("[data-t]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  });
  root.addEventListener("seg-change", (e) => {
    metre = e.detail.value;
    const was = playing;
    if (was) setPlaying(false);
    build();
    if (was) setPlaying(true);
  });
  visible(root, (v) => { if (!v && playing) setPlaying(false); });
  build();
}
