// Sound synthesis blocks 6–10: additive, Karplus–Strong, LFO, granular
// and the melodic step sequencer.

import { scrubAll } from "./scrub.js";
import { frame } from "./plot.js";
import {
  FS, el, text, num, outs, db, clear, fmtHz, engine, ctx, out, soundPanel, playToggle, fadeOut,
  onSeg, selectSeg, stroke, path, logAxis, mulberry32, midiToHz, noteName, visible, waveAt,
} from "./synth-core.js";

// ============================================================ 6. additive

for (const root of document.querySelectorAll("[data-synth-add]")) {
  const bars = root.querySelector("[data-bars]");
  const wave = root.querySelector("[data-wave]");
  const o = outs(root);
  const K = 16;
  let amps = Array.from({ length: K }, (_, i) => 1 / (i + 1));
  let scramble = false;
  const rng = mulberry32(11);
  const randPh = Array.from({ length: K }, () => rng() * 2 * Math.PI);
  let voice = null;
  // Hammond drawbar footages map to these harmonics of the 16' fundamental.
  const DRAWBARS = [1, 3, 2, 4, 6, 8, 10, 12, 16];
  const PRESETS = {
    saw: () => amps.map((_, i) => 1 / (i + 1)),
    square: () => amps.map((_, i) => ((i + 1) % 2 ? 1 / (i + 1) : 0)),
    organ: () => { const a = Array(K).fill(0); "888000000".split("").forEach((d, j) => { a[DRAWBARS[j] - 1] = Number(d) / 8; }); return a; },
    flute: () => amps.map((_, i) => [1, 0.32, 0.12, 0.05, 0.02][i] ?? 0),
    clear: () => amps.map((_, i) => (i === 0 ? 1 : 0)),
  };
  const s = scrubAll(root, () => { draw(); retune(); });
  const phase = (k) => (scramble ? randPh[k] : 0);

  const B = { L: 40, T: 12, W: 506, H: 160 };
  const bx = (i) => B.L + (i + 0.5) * (B.W / K);
  const bw = (B.W / K) * 0.62;
  const by = (a) => B.T + B.H - a * B.H;

  function drawBars(focusIndex) {
    clear(bars);
    for (const t of [0, 0.5, 1]) {
      el("line", { x1: B.L, x2: B.L + B.W, y1: by(t), y2: by(t), style: `stroke:currentColor;stroke-opacity:${t ? 0.07 : 0.3}` }, bars);
      text(bars, B.L - 6, by(t) + 3, num(t, 1), { "text-anchor": "end" });
    }
    amps.forEach((a, i) => {
      const g = el("g", { tabindex: i === (focusIndex ?? 0) ? 0 : -1, role: "slider", "aria-label": `Harmonic ${i + 1}`, "aria-valuemin": 0, "aria-valuemax": 1, "aria-valuenow": num(a, 2), class: "cursor-ns-resize outline-none", "data-bar": i }, bars);
      el("rect", { x: bx(i) - (B.W / K) / 2, y: B.T, width: B.W / K, height: B.H, style: "fill:transparent" }, g);
      el("rect", { x: bx(i) - bw / 2, y: by(a), width: bw, height: Math.max(0.5, B.H - (by(a) - B.T)), rx: 2, style: "fill:var(--vec-u);opacity:.85" }, g);
      el("rect", { "data-ring": "", x: bx(i) - bw / 2 - 3, y: B.T - 3, width: bw + 6, height: B.H + 6, rx: 4, style: "fill:none;stroke:var(--ring);stroke-width:2;opacity:0" }, g);
      text(bars, bx(i), B.T + B.H + 14, String(i + 1), { "text-anchor": "middle" });
    });
    text(bars, B.L + B.W, B.T + B.H + 28, "harmonic", { "text-anchor": "end" });
    if (focusIndex !== undefined) bars.querySelector(`[data-bar="${focusIndex}"]`)?.focus();
  }

  function sum(theta) {
    let v = 0;
    for (let k = 0; k < K; k++) if (amps[k]) v += amps[k] * Math.sin((k + 1) * theta + phase(k));
    return v;
  }

  function drawWave() {
    const pts = [];
    let peak = 0;
    for (let i = 0; i <= 500; i++) {
      const v = sum((2 * Math.PI * i) / 500);
      peak = Math.max(peak, Math.abs(v));
      pts.push(v);
    }
    const lim = Math.max(1, Math.ceil(peak * 2) / 2);
    clear(wave);
    const F = frame(wave, { box: [40, 10, 506, 130], x: [0, 1], y: [-lim, lim], yticks: [-lim, 0, lim], xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => `${v}`, xlabel: "period", yfmt: (v) => num(v, 1) });
    path(wave, pts.map((v, i) => [F.sx(i / 500), F.sy(v)]), stroke("var(--brand)", 1.75));
    return peak;
  }

  function draw(focusIndex) {
    drawBars(focusIndex);
    const peak = drawWave();
    const f0 = s.freq.get();
    let num1 = 0, den = 0, on = 0;
    amps.forEach((a, k) => { if (a > 0.001) on++; num1 += (k + 1) * f0 * a; den += a; });
    o.on.textContent = `${on} of ${K}`;
    o.peak.textContent = num(peak, 2);
    o.centroid.textContent = den ? fmtHz(num1 / den) : "—";
  }

  function periodicWave(ac) {
    const re = new Float32Array(K + 1), im = new Float32Array(K + 1);
    for (let k = 0; k < K; k++) { im[k + 1] = amps[k] * Math.cos(phase(k)); re[k + 1] = amps[k] * Math.sin(phase(k)); }
    return ac.createPeriodicWave(re, im);
  }
  function retune() {
    if (!voice) return;
    voice.osc.frequency.setTargetAtTime(s.freq.get(), ctx().currentTime, 0.02);
    voice.osc.setPeriodicWave(periodicWave(ctx()));
  }

  // Pointer: drag across the bars to paint amplitudes.
  bars.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const paint = (ev) => {
      const box = bars.getBoundingClientRect(), sc = 560 / box.width;
      const x = (ev.clientX - box.left) * sc, y = (ev.clientY - box.top) * sc;
      const i = Math.floor((x - B.L) / (B.W / K));
      if (i < 0 || i >= K) return;
      amps[i] = Math.round(Math.min(1, Math.max(0, (B.T + B.H - y) / B.H)) * 100) / 100;
      selectSeg(root, "Presets", null);
      draw();
      retune();
    };
    paint(e);
    const up = () => { removeEventListener("pointermove", paint); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
    addEventListener("pointermove", paint);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });
  bars.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-bar]");
    if (!g) return;
    let i = Number(g.dataset.bar);
    const step = e.shiftKey ? 0.25 : 0.05;
    if (e.key === "ArrowUp") amps[i] = Math.min(1, Math.round((amps[i] + step) * 100) / 100);
    else if (e.key === "ArrowDown") amps[i] = Math.max(0, Math.round((amps[i] - step) * 100) / 100);
    else if (e.key === "ArrowRight") i = Math.min(K - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else return;
    e.preventDefault();
    selectSeg(root, "Presets", null);
    draw(i);
    retune();
  });
  bars.addEventListener("focusin", (e) => e.target.closest("[data-bar]")?.querySelector("[data-ring]")?.setAttribute("style", "fill:none;stroke:var(--ring);stroke-width:2;opacity:1"));
  bars.addEventListener("focusout", (e) => e.target.closest("[data-bar]")?.querySelector("[data-ring]")?.setAttribute("style", "fill:none;stroke:var(--ring);stroke-width:2;opacity:0"));

  root.querySelector('[data-toggle="phase"]').addEventListener("shadcn:checked-change", (e) => { scramble = e.detail.checked; draw(); retune(); });
  onSeg(root, "Presets", (v) => { amps = PRESETS[v](); draw(); retune(); });
  const toggle = playToggle(root.querySelector('[data-action="play"]'), () => {
    const ac = engine();
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.setPeriodicWave(periodicWave(ac));
    osc.frequency.value = s.freq.get();
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.25, ac.currentTime + 0.05);
    osc.connect(g).connect(out());
    osc.start();
    voice = { osc, g };
    return () => { fadeOut(g, [osc]); voice = null; };
  });
  soundPanel(root, { onOff: () => toggle.halt() });
  draw();
}

// ============================================================ 7. Karplus–Strong

// pluck renders a Karplus–Strong string at FS: y[n] = x[n] + ρ((1−s)y[n−N] + s·y[n−N−1]),
// a loop of N + s samples. Returns the samples and the loop parameters.
export function karplus({ freq, rho, bright, pick = "noise", seconds = 3, seed = 5 }) {
  const sDelay = 0.5 * (1 - 0.9 * bright);
  const N = Math.max(2, Math.round(FS / freq - sDelay));
  const L = Math.round(FS * seconds);
  const y = new Float32Array(L);
  const rng = mulberry32(seed);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const w = rng() * 2 - 1;
    lp = pick === "pick" ? lp + 0.35 * (w - lp) : w;
    y[i] = lp;
  }
  // Remove the burst's DC so the string does not ring with an offset.
  let m = 0;
  for (let i = 0; i < N; i++) m += y[i];
  for (let i = 0; i < N; i++) y[i] -= m / N;
  for (let n = N; n < L; n++) y[n] += rho * ((1 - sDelay) * y[n - N] + sDelay * (n - N - 1 >= 0 ? y[n - N - 1] : 0));
  return { y, N, sDelay, expected: FS / (N + sDelay) };
}

// pitchByAutocorrelation finds the period of x between fmin and fmax with a
// normalised autocorrelation and parabolic interpolation.
export function pitchByAutocorrelation(x, start = Math.round(FS * 0.1), len = 4096, fmin = 30, fmax = 2000) {
  const seg = x.subarray(start, start + len + Math.ceil(FS / fmin) + 2);
  const lo = Math.floor(FS / fmax), hi = Math.ceil(FS / fmin);
  const r = new Float64Array(hi + 2);
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    let a = 0, e0 = 0, e1 = 0;
    for (let i = 0; i < len; i++) { a += seg[i] * seg[i + lag]; e0 += seg[i] * seg[i]; e1 += seg[i + lag] * seg[i + lag]; }
    r[lag] = a / Math.sqrt(e0 * e1 + 1e-20);
  }
  // The first strong peak, to avoid choosing a multiple of the period.
  let best = -1;
  let max = -Infinity;
  for (let lag = lo; lag <= hi; lag++) max = Math.max(max, r[lag]);
  for (let lag = lo; lag <= hi; lag++) if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > 0.9 * max) { best = lag; break; }
  if (best < 0) return NaN;
  const a = r[best - 1], b = r[best], c = r[best + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return FS / (best + (Number.isFinite(shift) ? shift : 0));
}

for (const root of document.querySelectorAll("[data-synth-ks]")) {
  const startSvg = root.querySelector("[data-start]");
  const envSvg = root.querySelector("[data-env]");
  const o = outs(root);
  let pick = "noise";
  let last = null;
  const playing = new Set();
  const s = scrubAll(root, draw);

  function draw() {
    last = karplus({ freq: s.freq.get(), rho: s.decay.get(), bright: s.bright.get(), pick });
    const { y, N, sDelay, expected } = last;
    let peak = 1e-9;
    for (const v of y) peak = Math.max(peak, Math.abs(v));
    clear(startSvg);
    const n25 = Math.round(FS * 0.025);
    const F = frame(startSvg, { box: [40, 10, 506, 110], x: [0, 25], y: [-1.1, 1.1], yticks: [-1, 0, 1], xticks: [0, 5, 10, 15, 20, 25], xlabel: "ms" });
    const pts = [];
    for (let i = 0; i < n25; i += 2) pts.push([F.sx((i / FS) * 1000), F.sy(y[i] / peak)]);
    path(startSvg, pts, stroke("var(--brand)", 1.2));
    el("line", { x1: F.sx((N / FS) * 1000), x2: F.sx((N / FS) * 1000), y1: F.T, y2: F.T + F.H, style: stroke("var(--foreground)", 1, "stroke-dasharray:3 3;opacity:.5") }, startSvg);
    text(startSvg, F.sx((N / FS) * 1000) + 4, F.T + 10, "one lap of the loop", {});
    // Envelope in 10 ms windows.
    const win = FS / 100;
    const envDb = [];
    for (let i = 0; i + win <= y.length; i += win) {
      let e = 0;
      for (let j = 0; j < win; j++) e += y[i + j] * y[i + j];
      envDb.push(10 * Math.log10(e / win + 1e-20));
    }
    const ref = Math.max(...envDb);
    clear(envSvg);
    const G = frame(envSvg, { box: [40, 18, 506, 102], x: [0, 3], y: [-80, 0], yticks: [0, -20, -40, -60, -80], xticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], xfmt: (v) => num(v, 1), xlabel: "s", ylabel: "dB" });
    path(envSvg, envDb.map((d, i) => [G.sx((i + 0.5) / 100), G.sy(Math.max(-80, d - ref))]), stroke("var(--vec-u)", 1.5));
    el("line", { x1: G.L, x2: G.L + G.W, y1: G.sy(-60), y2: G.sy(-60), style: stroke("var(--code-del)", 1, "stroke-dasharray:3 3;opacity:.6") }, envSvg);
    // T60 from the slope after the first 50 ms, extrapolated if needed.
    let t60 = envDb.findIndex((d, i) => i > 5 && d - ref <= -60);
    let t60txt;
    if (t60 > 0) t60txt = `${num(t60 / 100, 2)} s`;
    else {
      const xs = [], ys = [];
      for (let i = 5; i < envDb.length; i++) { xs.push(i / 100); ys.push(envDb[i] - ref); }
      const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
      let sxy = 0, sxx = 0;
      xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
      const slope = sxy / sxx;
      t60txt = slope < 0 ? `≈ ${num((-60 - (my - slope * mx)) / slope, 1)} s (extrapolated)` : "no decay";
    }
    const measured = pitchByAutocorrelation(y);
    o.n.textContent = `${N} samples + ${num(sDelay, 2)} (filter)`;
    o.expected.textContent = `${num(expected, 2)} Hz (${num(1200 * Math.log2(expected / s.freq.get()), 1)} cents off)`;
    o.measured.textContent = Number.isFinite(measured) ? `${num(measured, 2)} Hz` : "—";
    o.t60.textContent = t60txt;
    root.dataset.measured = String(measured);
    root.dataset.expected = String(expected);
  }

  root.querySelector('[data-action="pluck"]').addEventListener("click", () => {
    const ac = engine();
    const y = last.y;
    let peak = 1e-9;
    for (const v of y) peak = Math.max(peak, Math.abs(v));
    const b = ac.createBuffer(1, y.length, FS);
    b.copyToChannel(Float32Array.from(y, (v) => v / peak), 0);
    const src = ac.createBufferSource(), g = ac.createGain();
    g.gain.value = 0.35;
    src.buffer = b;
    src.connect(g).connect(out());
    src.start();
    const v = { src, g };
    playing.add(v);
    src.onended = () => playing.delete(v);
  });
  onSeg(root, "Excitation", (v) => { pick = v; draw(); });
  soundPanel(root, { onOff() { for (const v of playing) fadeOut(v.g, [v.src]); playing.clear(); } });
  draw();
}

// ============================================================ 8. LFO

for (const root of document.querySelectorAll("[data-synth-lfo]")) {
  const psvg = root.querySelector("[data-param]");
  const ssvg = root.querySelector("[data-signal]");
  const o = outs(root);
  let target = "vibrato", shape = "sine";
  let voice = null;
  const CARRIER = 220, BASE_CUTOFF = 1200;
  const s = scrubAll(root, () => { draw(); apply(); });

  const lfo = (t) => waveAt(shape, s.rate.get() * t);
  // The parameter value at time t for the current target.
  function param(t) {
    const d = s.depth.get() / 100, v = lfo(t);
    if (target === "vibrato") return 100 * d * v; // cents
    if (target === "tremolo") return 1 - d / 2 + (d / 2) * v; // gain
    return BASE_CUTOFF * 2 ** (3 * d * v); // Hz
  }

  function draw() {
    const d = s.depth.get() / 100, rate = s.rate.get();
    clear(psvg);
    const T = 2;
    let F;
    if (target === "vibrato") F = frame(psvg, { box: [48, 18, 498, 112], x: [0, T], y: [-110, 110], yticks: [-100, -50, 0, 50, 100], xticks: [0, 0.5, 1, 1.5, 2], xfmt: (v) => num(v, 1), xlabel: "s", ylabel: "cents" });
    else if (target === "tremolo") F = frame(psvg, { box: [48, 18, 498, 112], x: [0, T], y: [0, 1.05], yticks: [0, 0.5, 1], xticks: [0, 0.5, 1, 1.5, 2], xfmt: (v) => num(v, 1), xlabel: "s", ylabel: "gain" });
    else {
      const ly = (hz) => 18 + 112 - ((Math.log2(hz / 100) / Math.log2(160)) * 112); // 100 Hz – 16 kHz
      F = frame(psvg, { box: [48, 18, 498, 112], x: [0, T], y: [0, 1], yticks: [], xticks: [0, 0.5, 1, 1.5, 2], xfmt: (v) => num(v, 1), xlabel: "s", ylabel: "cutoff" });
      F.sy = (hz) => ly(hz);
      for (const hz of [100, 400, 1600, 6400]) {
        el("line", { x1: F.L, x2: F.L + F.W, y1: ly(hz), y2: ly(hz), style: "stroke:currentColor;stroke-opacity:0.07" }, psvg);
        text(psvg, F.L - 6, ly(hz) + 3, hz >= 1000 ? `${hz / 1000}k` : `${hz}`, { "text-anchor": "end" });
      }
    }
    const pts = [];
    for (let i = 0; i <= 800; i++) { const t = (T * i) / 800; pts.push([F.sx(t), F.sy(param(t))]); }
    path(psvg, pts, stroke("var(--vec-u)", 1.75));

    // The signal, with the carrier drawn at 15 Hz so its cycles show; the
    // modulation keeps its real rate and depth, and the filter keeps the
    // cutoff's ratio to the carrier.
    const fv = 15, scale = fv / CARRIER;
    clear(ssvg);
    const G = frame(ssvg, { box: [48, 18, 498, 112], x: [0, T], y: [-1.3, 1.3], yticks: [-1, 0, 1], xticks: [0, 0.5, 1, 1.5, 2], xfmt: (v) => num(v, 1), xlabel: "s" });
    const sp = [];
    let ph = 0;
    const n = 2400, dt = T / n;
    for (let i = 0; i <= n; i++) {
      const t = i * dt;
      const p = param(t);
      const f = target === "vibrato" ? fv * 2 ** (p / 1200) : fv;
      ph += f * dt;
      let v;
      if (target === "filter") {
        const fc = p * scale;
        v = 0;
        for (let k = 1; k <= 24; k++) v += ((2 / Math.PI) * (k % 2 ? 1 : -1) / k) * Math.sin(2 * Math.PI * k * ph) / Math.sqrt(1 + ((k * fv) / fc) ** 4);
      } else {
        v = waveAt("sawtooth", ph) * (target === "tremolo" ? p : 1);
      }
      sp.push([G.sx(t), G.sy(v)]);
    }
    path(ssvg, sp, stroke("var(--brand)", 1.1));
    text(ssvg, G.L + 4, G.T + 10, "carrier drawn at 15 Hz so the cycles show; modulation to scale", {});

    o.period.textContent = `${num(1000 / rate, 0)} ms`;
    if (target === "vibrato") o.swing.textContent = `±${num(100 * d, 0)} cents (±${fmtHz(CARRIER * (2 ** (d / 12) - 1))} at ${CARRIER} Hz)`;
    else if (target === "tremolo") o.swing.textContent = `gain ${num(1 - d, 2)} to 1 (${num(db(Math.max(1 - d, 1e-6)), 1)} dB)`;
    else o.swing.textContent = `${fmtHz(BASE_CUTOFF * 2 ** (-3 * d))} to ${fmtHz(BASE_CUTOFF * 2 ** (3 * d))}`;
  }

  // Live: the LFO oscillator feeds a depth gain into the target AudioParam.
  function apply() {
    if (!voice) return;
    const now = ctx().currentTime, d = s.depth.get() / 100;
    voice.lfo.type = shape;
    voice.lfo.frequency.setTargetAtTime(s.rate.get(), now, 0.02);
    for (const k of ["toPitch", "toGain", "toCutoff"]) voice[k].gain.setTargetAtTime(0, now, 0.02);
    voice.trem.gain.setTargetAtTime(1, now, 0.02);
    if (target === "vibrato") voice.toPitch.gain.setTargetAtTime(100 * d, now, 0.02);
    else if (target === "tremolo") { voice.trem.gain.setTargetAtTime(1 - d / 2, now, 0.02); voice.toGain.gain.setTargetAtTime(d / 2, now, 0.02); }
    else voice.toCutoff.gain.setTargetAtTime(3600 * d, now, 0.02);
  }

  const toggle = playToggle(root.querySelector('[data-action="play"]'), () => {
    const ac = engine();
    const osc = ac.createOscillator(), filt = ac.createBiquadFilter(), trem = ac.createGain(), g = ac.createGain();
    const lfoOsc = ac.createOscillator();
    const toPitch = ac.createGain(), toGain = ac.createGain(), toCutoff = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = CARRIER;
    filt.type = "lowpass";
    filt.frequency.value = BASE_CUTOFF;
    filt.Q.value = 6;
    for (const n of [toPitch, toGain, toCutoff]) { n.gain.value = 0; lfoOsc.connect(n); }
    toPitch.connect(osc.detune);
    toGain.connect(trem.gain);
    toCutoff.connect(filt.detune);
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.2, ac.currentTime + 0.05);
    osc.connect(filt).connect(trem).connect(g).connect(out());
    osc.start();
    lfoOsc.start();
    voice = { osc, lfo: lfoOsc, trem, toPitch, toGain, toCutoff, g };
    apply();
    return () => { fadeOut(g, [osc, lfoOsc]); voice = null; };
  });
  soundPanel(root, { onOff: () => toggle.halt() });
  onSeg(root, "Target", (v) => { target = v; draw(); apply(); });
  onSeg(root, "LFO shape", (v) => { shape = v; draw(); apply(); });
  draw();
}

// ============================================================ 9. granular

// The source: two seconds of a harmonic tone gliding from 196 to 294 Hz
// while a formant sweeps up through its harmonics.
function grainSource() {
  const n = FS * 2;
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    const f = 196 * 1.5 ** (t / 2);
    ph += f / FS;
    const formant = 400 + 1800 * (t / 2);
    let v = 0;
    for (let k = 1; k <= 14; k++) v += Math.exp(-(((k * f - formant) / 500) ** 2)) * Math.sin(2 * Math.PI * k * ph) + (k === 1 ? 0.3 * Math.sin(2 * Math.PI * ph) : 0);
    x[i] = v * (0.75 + 0.25 * Math.sin(2 * Math.PI * 3 * t));
  }
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < n; i++) x[i] *= 0.9 / m;
  return x;
}

for (const root of document.querySelectorAll("[data-synth-gran]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const src = grainSource();
  const DUR = 2;
  let running = null; // { timer, next, t0, buffer, gain }
  let grains = []; // { at (context time), pos, size }
  let played = 0;
  let raf = 0, onScreen = false;
  const s = scrubAll(root, () => { if (!running) draw(); });
  const env = (() => {
    const w = 256;
    const mins = new Float32Array(w), maxs = new Float32Array(w);
    const per = src.length / w;
    for (let i = 0; i < w; i++) {
      let lo = 1, hi = -1;
      for (let j = Math.floor(i * per); j < Math.floor((i + 1) * per); j++) { lo = Math.min(lo, src[j]); hi = Math.max(hi, src[j]); }
      mins[i] = lo; maxs[i] = hi;
    }
    return { mins, maxs, w };
  })();

  // Where the scan head is t seconds after starting.
  const headAt = (t) => {
    const size = s.size.get() / 1000;
    const span = DUR - size;
    let p = s.pos.get() + s.speed.get() * t;
    p = ((p % span) + span) % span;
    return p;
  };

  function preview() {
    // The same schedule the cloud would play over one second, seeded.
    const rng = mulberry32(3);
    const dens = s.density.get(), size = s.size.get() / 1000, jit = s.jitter.get() / 1000;
    const g = [];
    for (let t = 0; t < 1; t += 1 / dens) g.push({ age: 1 - t, pos: Math.min(DUR - size, Math.max(0, headAt(t) + (rng() * 2 - 1) * jit)), size });
    return { list: g, head: headAt(1) };
  }

  function draw() {
    clear(svg);
    const F = frame(svg, { box: [40, 12, 506, 210], x: [0, DUR], y: [-1.05, 1.05], yticks: [-1, 0, 1], xticks: [0, 0.5, 1, 1.5, 2], xfmt: (v) => num(v, 1), xlabel: "s in the source" });
    const cw = F.W / env.w;
    for (let i = 0; i < env.w; i++) el("rect", { x: F.L + i * cw, y: F.sy(env.maxs[i]), width: Math.max(1, cw - 0.4), height: Math.max(0.5, F.sy(env.mins[i]) - F.sy(env.maxs[i])), style: "fill:var(--muted-foreground);opacity:.35" }, svg);
    let list, head;
    if (running) {
      const now = ctx().currentTime;
      list = grains.filter((g) => g.at <= now && now - g.at < 1).map((g) => ({ ...g, age: now - g.at }));
      head = headAt(now - running.t0);
    } else ({ list, head } = preview());
    // Each grain as its Hann window, fading with age; row by order so overlaps show.
    list.forEach((g, i) => {
      const x0 = F.sx(g.pos), x1 = F.sx(g.pos + g.size);
      const row = i % 6;
      const yb = F.T + F.H - 6 - row * 14;
      const pts = [];
      for (let j = 0; j <= 16; j++) {
        const u = j / 16;
        pts.push([x0 + (x1 - x0) * u, yb - 12 * (0.5 - 0.5 * Math.cos(2 * Math.PI * u))]);
      }
      path(svg, pts, `fill:var(--brand);fill-opacity:${(0.55 * (1 - g.age)).toFixed(2)};stroke:var(--brand);stroke-opacity:${(1 - g.age).toFixed(2)};stroke-width:1`);
    });
    el("line", { x1: F.sx(head), x2: F.sx(head), y1: F.T, y2: F.T + F.H, style: stroke("var(--vec-u)", 2) }, svg);
    const overlap = (s.size.get() / 1000) * s.density.get();
    o.overlap.textContent = `${num(overlap, 1)} on average`;
    o.count.textContent = running ? `${played}` : "—";
  }

  let hann = null;
  function schedule() {
    const ac = ctx();
    const look = 0.12;
    while (running.next < ac.currentTime + look) {
      const t = running.next;
      const size = s.size.get() / 1000, dens = s.density.get();
      const rate = 2 ** (s.pitch.get() / 12);
      const pos = Math.min(DUR - size, Math.max(0, headAt(t - running.t0) + (Math.random() * 2 - 1) * (s.jitter.get() / 1000)));
      const b = ac.createBufferSource(), g = ac.createGain();
      b.buffer = running.buffer;
      b.playbackRate.value = rate;
      hann ??= Float32Array.from({ length: 64 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 63));
      const level = 0.5 / Math.sqrt(Math.max(1, size * dens));
      g.gain.setValueAtTime(0, t);
      g.gain.setValueCurveAtTime(hann.map((v) => v * level), t, size / rate);
      b.connect(g).connect(running.gain);
      b.start(t, pos, size);
      grains.push({ at: t, pos, size });
      played++;
      running.next += (1 / dens) * (0.9 + 0.2 * Math.random());
    }
    const now = ac.currentTime;
    grains = grains.filter((g) => now - g.at < 1.2);
  }

  function frameLoop() {
    raf = 0;
    if (!running) return;
    draw();
    if (onScreen) raf = requestAnimationFrame(frameLoop);
  }

  const toggle = playToggle(root.querySelector('[data-action="play"]'), () => {
    const ac = engine();
    const buffer = ac.createBuffer(1, src.length, FS);
    buffer.copyToChannel(src, 0);
    const gain = ac.createGain();
    gain.connect(out());
    played = 0;
    grains = [];
    running = { buffer, gain, t0: ac.currentTime + 0.05, next: ac.currentTime + 0.05 };
    running.timer = setInterval(schedule, 25);
    schedule();
    raf = requestAnimationFrame(frameLoop);
    return () => {
      clearInterval(running.timer);
      fadeOut(gain, []);
      running = null;
      grains = [];
      cancelAnimationFrame(raf);
      raf = 0;
      draw();
    };
  });
  visible(root, (v) => { onScreen = v; if (v && running && !raf) raf = requestAnimationFrame(frameLoop); });
  soundPanel(root, { onOff: () => toggle.halt() });
  draw();
}

// ============================================================ 10. step sequencer

const SCALES = {
  minorpenta: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};
// degreeToSemitone maps a scale degree (0 = root) to semitones above it.
export const degreeToSemitone = (scale, d) => {
  const s = SCALES[scale];
  return 12 * Math.floor(d / s.length) + s[((d % s.length) + s.length) % s.length];
};

for (const root of document.querySelectorAll("[data-synth-seq]")) {
  const grid = root.querySelector("[data-grid]");
  const lane = root.querySelector("[data-lane]");
  const o = outs(root);
  const STEPS = 16, ROWS = 8;
  let scale = "minorpenta";
  let notes = [0, null, 2, 3, null, 4, 3, null, 0, null, 2, 5, 4, null, 2, 1]; // degree or null per step
  let cut = [600, 900, 1400, 2200, 3200, 4500, 6000, 7500, 600, 800, 1100, 1600, 2400, 3600, 5200, 7000];
  let running = null; // { timer, next, step, queue }
  let playStep = -1;
  let raf = 0;
  let focus = { r: ROWS - 1 - notes[0], c: 0 };
  const s = scrubAll(root, () => { label(); });

  const cell = (r, c) => grid.querySelector(`[data-r="${r}"][data-c="${c}"]`);

  function buildGrid() {
    grid.replaceChildren();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < STEPS; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.r = r;
        b.dataset.c = c;
        b.setAttribute("role", "gridcell");
        b.className = "h-6 min-w-0 overflow-hidden rounded-[3px] font-mono text-[0px] text-white sm:text-[9px] border border-border/60 bg-background transition-colors duration-100 outline-none hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/60 aria-pressed:border-transparent aria-pressed:bg-[var(--brand)] data-[playing]:ring-2 data-[playing]:ring-foreground/70";
        grid.append(b);
      }
    }
    refresh();
  }

  function label() {
    const rootMidi = s.root.get();
    for (let r = 0; r < ROWS; r++) {
      const m = rootMidi + degreeToSemitone(scale, ROWS - 1 - r);
      for (let c = 0; c < STEPS; c++) {
        const b = cell(r, c);
        const on = notes[c] === ROWS - 1 - r;
        b.setAttribute("aria-label", `Step ${c + 1}, ${noteName(m)}${on ? ", on" : ""}`);
        b.textContent = on ? noteName(m) : "";
      }
    }
  }

  function refresh() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < STEPS; c++) {
      const b = cell(r, c);
      b.setAttribute("aria-pressed", String(notes[c] === ROWS - 1 - r));
      b.tabIndex = r === focus.r && c === focus.c ? 0 : -1;
      b.toggleAttribute("data-playing", c === playStep && notes[c] === ROWS - 1 - r);
    }
    label();
    drawLane();
    o.notes.textContent = `${notes.filter((n) => n !== null).length} of ${STEPS} steps`;
  }

  const LN = { L: 6, T: 8, W: 548, H: 90 };
  const ly = logAxis(200, 8000, 0, LN.H);
  function drawLane() {
    clear(lane);
    const w = LN.W / STEPS;
    for (let c = 0; c < STEPS; c++) {
      const h = ly(cut[c]);
      const g = el("g", { tabindex: -1, "data-lane-step": c, role: "slider", "aria-label": `Cutoff for step ${c + 1}`, "aria-valuenow": Math.round(cut[c]), class: "outline-none" }, lane);
      el("rect", { x: LN.L + c * w + 1, y: LN.T, width: w - 2, height: LN.H, rx: 2, style: `fill:currentColor;opacity:${c === playStep ? 0.12 : 0.04}` }, g);
      el("rect", { x: LN.L + c * w + 3, y: LN.T + LN.H - h, width: w - 6, height: Math.max(1, h), rx: 2, style: "fill:var(--vec-u);opacity:.8" }, g);
    }
  }

  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-r]");
    if (!b) return;
    const r = Number(b.dataset.r), c = Number(b.dataset.c), d = ROWS - 1 - r;
    notes[c] = notes[c] === d ? null : d;
    focus = { r, c };
    refresh();
    cell(r, c).focus();
  });
  grid.addEventListener("keydown", (e) => {
    const b = e.target.closest("[data-r]");
    if (!b) return;
    let { r, c } = { r: Number(b.dataset.r), c: Number(b.dataset.c) };
    if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "ArrowDown") r = Math.min(ROWS - 1, r + 1);
    else if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
    else if (e.key === "ArrowRight") c = Math.min(STEPS - 1, c + 1);
    else return;
    e.preventDefault();
    focus = { r, c };
    refresh();
    cell(r, c).focus();
  });

  lane.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const paint = (ev) => {
      const box = lane.getBoundingClientRect(), sc = 560 / box.width;
      const x = (ev.clientX - box.left) * sc, y = (ev.clientY - box.top) * sc;
      const c = Math.floor((x - LN.L) / (LN.W / STEPS));
      if (c < 0 || c >= STEPS) return;
      const h = Math.min(LN.H, Math.max(0, LN.T + LN.H - y));
      cut[c] = Math.round(200 * 40 ** (h / LN.H));
      drawLane();
    };
    paint(e);
    const up = () => { removeEventListener("pointermove", paint); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
    addEventListener("pointermove", paint);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });

  root.querySelector('[data-action="random"]').addEventListener("click", () => {
    let d = Math.floor(Math.random() * 4);
    notes = notes.map((_, i) => {
      if (i % 4 !== 0 && Math.random() < 0.3) return null;
      d = Math.min(ROWS - 1, Math.max(0, d + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      return d;
    });
    const base = 300 + Math.random() * 600;
    cut = cut.map((_, i) => Math.round(Math.min(8000, base * 2 ** ((i % 8) * (0.3 + Math.random() * 0.3)))));
    refresh();
  });
  root.querySelector('[data-action="clear"]').addEventListener("click", () => { notes = notes.map(() => null); refresh(); });
  onSeg(root, "Scale", (v) => { scale = v; refresh(); });

  function voice(ac, t, step, dur) {
    const d = notes[step];
    if (d === null) return;
    const f = midiToHz(s.root.get() + degreeToSemitone(scale, d));
    const osc = ac.createOscillator(), filt = ac.createBiquadFilter(), g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    filt.type = "lowpass";
    filt.Q.value = s.q.get();
    filt.frequency.setValueAtTime(Math.min(16000, cut[step] * 2), t);
    filt.frequency.exponentialRampToValueAtTime(cut[step], t + dur * 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur * 0.95);
    osc.connect(filt).connect(g).connect(running.gain);
    osc.start(t);
    osc.stop(t + dur);
  }

  function schedule() {
    const ac = ctx();
    const dur = 60 / s.bpm.get() / 4;
    while (running.next < ac.currentTime + 0.1) {
      voice(ac, running.next, running.step, dur);
      running.queue.push({ step: running.step, at: running.next });
      running.lastAhead = running.next - ac.currentTime;
      running.step = (running.step + 1) % STEPS;
      running.next += dur;
    }
  }

  function tick() {
    raf = 0;
    if (!running) return;
    const now = ctx().currentTime;
    while (running.queue.length && running.queue[0].at <= now) playStep = running.queue.shift().step;
    refresh();
    o.step.textContent = `${playStep + 1}`;
    o.ahead.textContent = `${num(running.lastAhead * 1000, 0)} ms`;
    raf = requestAnimationFrame(tick);
  }

  const toggle = playToggle(root.querySelector('[data-action="play"]'), () => {
    const ac = engine();
    const gain = ac.createGain();
    gain.connect(out());
    running = { gain, next: ac.currentTime + 0.05, step: 0, queue: [], lastAhead: 0 };
    running.timer = setInterval(schedule, 25);
    schedule();
    raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(running.timer);
      fadeOut(gain, []);
      running = null;
      cancelAnimationFrame(raf);
      playStep = -1;
      o.step.textContent = "—";
      o.ahead.textContent = "—";
      refresh();
    };
  });
  soundPanel(root, { onOff: () => toggle.halt() });
  buildGrid();
}
