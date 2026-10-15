// Sound synthesis blocks 1–5: oscillator lab, aliasing, ADSR, subtractive
// synth and FM. Shared engine and maths live in synth-core.js; blocks 6–10
// are in synth-more.js.

import { scrubAll } from "./scrub.js";
import { frame } from "./plot.js";
import {
  FS, el, text, num, outs, db, clear, fmtHz, engine, ctx, out, soundPanel, playToggle, fadeOut,
  onSeg, selectSeg, spectrum, peakNear, besselJ, stroke, path, logAxis, FREQ_TICKS, fTick,
  waveAt, harmonicAmp, hzToMidi, noteName, visible,
} from "./synth-core.js";

// ============================================================ 1. oscillator lab

for (const root of document.querySelectorAll("[data-synth-osc]")) {
  const scope = root.querySelector("[data-scope]");
  const spec = root.querySelector("[data-spectrum]");
  const source = root.querySelector("[data-source]");
  const o = outs(root);
  let type = "sine";
  let osc = null, gain = null, analyser = null, raf = 0, onScreen = false;
  const s = scrubAll(root, update);

  const freq = () => s.freq.get() * 2 ** (s.detune.get() / 1200);

  function update() {
    if (osc) {
      osc.type = type;
      osc.frequency.setTargetAtTime(s.freq.get(), ctx().currentTime, 0.01);
      osc.detune.setTargetAtTime(s.detune.get(), ctx().currentTime, 0.01);
    }
    readouts();
    if (!osc) drawComputed();
  }

  function readouts() {
    const f = freq();
    const m = hzToMidi(f);
    const near = Math.round(m);
    o.note.textContent = `${noteName(near)} · MIDI ${near}`;
    const c = (m - near) * 100;
    o.cents.textContent = `${c >= 0 ? "+" : ""}${num(c, 1)} cents`;
    o.period.textContent = `${num(1000 / f, 3)} ms`;
    let n = 0;
    for (let k = 1; k * f < 20000; k++) if (harmonicAmp(type, k) > 0) n++;
    o.harm.textContent = type === "sine" ? "1 (pure tone)" : `${n} below 20 kHz`;
  }

  const SC = { box: [40, 12, 506, 130] };
  const SP = { L: 40, T: 12, W: 506, H: 148 };

  function scopeFrame(periodMs) {
    clear(scope);
    return frame(scope, { ...SC, x: [0, 3 * periodMs], y: [-1.25, 1.25], yticks: [-1, 0, 1], xticks: [0, periodMs, 2 * periodMs, 3 * periodMs], xfmt: (v) => `${num(v, v < 10 ? 2 : 1)}`, xlabel: "ms" });
  }

  function specFrame() {
    clear(spec);
    const sx = logAxis(20, 20000, SP.L, SP.W);
    const sy = (d) => SP.T + (-d / 100) * SP.H;
    const g = el("g", {}, spec);
    for (const t of [0, -20, -40, -60, -80, -100]) {
      el("line", { x1: SP.L, x2: SP.L + SP.W, y1: sy(t), y2: sy(t), style: "stroke:currentColor;stroke-opacity:0.07" }, g);
      text(g, SP.L - 6, sy(t) + 3, `${t}`, { "text-anchor": "end" });
    }
    for (const f of FREQ_TICKS) {
      el("line", { x1: sx(f), x2: sx(f), y1: SP.T, y2: SP.T + SP.H, style: "stroke:currentColor;stroke-opacity:0.07" }, g);
      text(g, sx(f), SP.T + SP.H + 13, fTick(f), { "text-anchor": "middle" });
    }
    text(g, SP.L + SP.W, SP.T + SP.H + 26, "Hz", { "text-anchor": "end" });
    text(g, 4, SP.T - 2, "dB", {});
    return { sx, sy };
  }

  function drawComputed() {
    source.textContent = "computed from the Fourier series (ideal wave)";
    const f = freq(), per = 1000 / f;
    const F = scopeFrame(per);
    const pts = [];
    for (let i = 0; i <= 600; i++) {
      const t = (3 * per * i) / 600;
      pts.push([F.sx(t), F.sy(waveAt(type, (t * f) / 1000))]);
    }
    path(scope, pts, stroke("var(--brand)", 1.75));
    const { sx, sy } = specFrame();
    for (let k = 1; k * f < 20000; k++) {
      const a = harmonicAmp(type, k);
      if (a <= 0) continue;
      const d = Math.max(-100, db(a));
      el("line", { x1: sx(k * f), x2: sx(k * f), y1: sy(-100), y2: sy(d), style: stroke("var(--vec-u)", 1.5) }, spec);
      el("circle", { cx: sx(k * f), cy: sy(d), r: 2, style: "fill:var(--vec-u)" }, spec);
    }
  }

  // Live: trigger on a rising zero crossing so the trace stands still.
  const tbuf = new Float32Array(8192);
  let fbuf = null;
  function drawLive() {
    raf = 0;
    if (!analyser) return;
    source.textContent = "measured by the AnalyserNode";
    const sr = ctx().sampleRate, f = freq(), per = 1000 / f;
    analyser.getFloatTimeDomainData(tbuf);
    const span = Math.min(Math.round((3 * sr) / f), tbuf.length / 2);
    let start = 0;
    for (let i = 1; i < tbuf.length - span; i++) if (tbuf[i - 1] < 0 && tbuf[i] >= 0) { start = i; break; }
    const F = scopeFrame(per);
    const pts = [];
    const stepI = Math.max(1, Math.floor(span / 600));
    let peak = 1e-6;
    for (let i = 0; i < span; i++) peak = Math.max(peak, Math.abs(tbuf[start + i]));
    for (let i = 0; i < span; i += stepI) pts.push([F.sx((i / sr) * 1000), F.sy(tbuf[start + i] / peak)]);
    path(scope, pts, stroke("var(--brand)", 1.75));
    text(scope, 46, 24, "scaled to the peak", {});
    analyser.getFloatFrequencyData(fbuf);
    const { sx, sy } = specFrame();
    const bins = fbuf.length, ref = Math.max(...fbuf);
    const sp = [];
    for (let i = 1; i < bins; i++) {
      const fr = (i * sr) / (2 * bins);
      if (fr < 20 || fr > 20000) continue;
      sp.push([sx(fr), sy(Math.max(-100, fbuf[i] - ref))]);
    }
    path(spec, sp, stroke("var(--vec-u)", 1.25));
    if (onScreen) raf = requestAnimationFrame(drawLive);
  }

  soundPanel(root, {
    onOn() {
      const ac = engine();
      osc = ac.createOscillator();
      gain = ac.createGain();
      analyser = ac.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.6;
      fbuf = new Float32Array(analyser.frequencyBinCount);
      osc.type = type;
      osc.frequency.value = s.freq.get();
      osc.detune.value = s.detune.get();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.25, ac.currentTime + 0.03);
      osc.connect(gain).connect(analyser).connect(out());
      osc.start();
      raf = requestAnimationFrame(drawLive);
    },
    onOff() {
      if (osc) fadeOut(gain, [osc]);
      osc = gain = analyser = null;
      cancelAnimationFrame(raf);
      drawComputed();
    },
  });
  visible(root, (v) => { onScreen = v; if (v && analyser && !raf) raf = requestAnimationFrame(drawLive); });
  onSeg(root, "Waveform", (v) => { type = v; update(); });
  update();
}

// ============================================================ 2. aliasing

for (const root of document.querySelectorAll("[data-synth-alias]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const N = 8192;
  const s = scrubAll(root, draw);

  const naive = (f, n) => Float32Array.from({ length: n }, (_, i) => {
    const p = (f * i) / FS;
    return 2 * (p - Math.floor(p)) - 1;
  });
  function bandLimited(f, n) {
    const x = new Float32Array(n);
    const K = Math.floor((FS / 2 - 1e-9) / f);
    for (let k = 1; k <= K; k++) {
      const a = ((2 / Math.PI) * (k % 2 ? 1 : -1)) / k;
      const w = (2 * Math.PI * k * f) / FS;
      for (let i = 0; i < n; i++) x[i] += a * Math.sin(w * i);
    }
    return x;
  }

  function draw() {
    const f = s.freq.get();
    clear(svg);
    const F = frame(svg, { box: [44, 14, 500, 270], x: [0, 24000], y: [-110, 0], yticks: [0, -20, -40, -60, -80, -100], xticks: [0, 4000, 8000, 12000, 16000, 20000, 24000], xfmt: (v) => `${v / 1000}k`, xlabel: "Hz", ylabel: "dB" });
    const plot = (mag, color, w) => {
      const pts = [];
      for (let k = 1; k < mag.length; k++) pts.push([F.sx((k * FS) / N), F.sy(Math.max(-110, db(mag[k])))]);
      path(svg, pts, stroke(color, w));
    };
    plot(spectrum(naive(f, N)), "var(--code-del)", 1.1);
    plot(spectrum(bandLimited(f, N)), "var(--vec-u)", 1.25);
    const K = Math.floor((FS / 2 - 1e-9) / f);
    for (let k = 1; k <= K; k++) el("circle", { cx: F.sx(k * f), cy: F.sy(db((2 / Math.PI) / k)), r: 2.5, style: "fill:var(--brand)" }, svg);
    // Where the first aliases land.
    for (let k = K + 1; k <= K + 6; k++) {
      const fa = Math.abs(((k * f + FS / 2) % FS) - FS / 2);
      el("line", { x1: F.sx(fa), x2: F.sx(fa), y1: F.T + F.H, y2: F.T + F.H + 5, style: stroke("var(--code-del)", 1.5) }, svg);
    }
    el("line", { x1: F.sx(24000), x2: F.sx(24000), y1: F.T, y2: F.T + F.H, style: stroke("currentColor", 1, "stroke-opacity:.35;stroke-dasharray:3 3") }, svg);
    text(svg, F.sx(24000) - 4, F.T + 10, "Nyquist 24 kHz", { "text-anchor": "end" });
    o.count.textContent = `${K}`;
    // Saw harmonic powers fall as 1/k²: the share above Nyquist.
    let tail = 0;
    for (let k = K + 1; k < 200000; k++) tail += 1 / (k * k);
    const share = tail / ((Math.PI * Math.PI) / 6);
    o.alias.textContent = `${num(share * 100, 2)} % of the power (${num(10 * Math.log10(share), 1)} dB)`;
    const k1 = K + 1, fa = Math.abs(((k1 * f + FS / 2) % FS) - FS / 2);
    o.loud.textContent = `${fmtHz(fa)}, ${num(-20 * Math.log10(k1), 1)} dB re fundamental`;
  }

  const play = (make) => {
    const ac = engine();
    const n = Math.round(FS * 1.5);
    const x = make(s.freq.get(), n);
    for (let i = 0; i < 480; i++) { x[i] *= i / 480; x[n - 1 - i] *= i / 480; }
    const b = ac.createBuffer(1, n, FS);
    b.copyToChannel(x, 0);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    g.gain.value = 0.22;
    src.buffer = b;
    src.connect(g).connect(out());
    src.start();
    current.push({ src, g });
    src.onended = () => { current = current.filter((c) => c.src !== src); };
  };
  let current = [];
  root.querySelector('[data-action="naive"]').addEventListener("click", () => play(naive));
  root.querySelector('[data-action="bandlimited"]').addEventListener("click", () => play(bandLimited));
  soundPanel(root, { onOff() { for (const c of current) fadeOut(c.g, [c.src]); current = []; } });
  draw();
}

// ============================================================ 3. ADSR

for (const root of document.querySelectorAll("[data-synth-adsr]")) {
  const svg = root.querySelector("[data-plot]");
  const key = root.querySelector('[data-action="key"]');
  const o = outs(root);
  const HOLD = 0.5; // seconds of sustain drawn between decay and release
  const s = scrubAll(root, () => { selectSeg(root, "Presets", null); draw(); });
  const PRESETS = {
    pad: [600, 800, 0.7, 1500], pluck: [2, 300, 0, 300], organ: [5, 1, 1, 30], swell: [1500, 10, 1, 1200],
  };
  let voice = null; // { osc, g, t0, tOff, levelOff }
  let raf = 0;

  const env = () => ({ a: s.a.get() / 1000, d: s.d.get() / 1000, s: s.s.get(), r: s.r.get() / 1000 });
  // levelAt is the envelope at time t after note-on with the key held.
  function levelAt(t, e = env()) {
    if (t < e.a) return t / e.a;
    if (t < e.a + e.d) return 1 + ((e.s - 1) * (t - e.a)) / e.d;
    return e.s;
  }

  let F = null;
  function draw(dot) {
    const e = env();
    const T = e.a + e.d + HOLD + e.r;
    clear(svg);
    F = frame(svg, { box: [40, 16, 506, 220], x: [0, T], y: [0, 1.08], yticks: [0, 0.5, 1], xticks: niceTicks(T), xfmt: (v) => num(v, T < 2 ? 2 : 1), xlabel: "s" });
    const gateEnd = e.a + e.d + HOLD;
    el("rect", { x: F.sx(0), y: F.T + F.H + 1, width: F.sx(gateEnd) - F.sx(0), height: 4, rx: 2, style: "fill:var(--vec-u);opacity:.6" }, svg);
    path(svg, [[F.sx(0), F.sy(0)], [F.sx(e.a), F.sy(1)], [F.sx(e.a + e.d), F.sy(e.s)], [F.sx(gateEnd), F.sy(e.s)], [F.sx(T), F.sy(0)]], stroke("var(--brand)", 2));
    for (const [x, lbl] of [[e.a / 2, "A"], [e.a + e.d / 2, "D"], [e.a + e.d + HOLD / 2, "S"], [gateEnd + e.r / 2, "R"]])
      text(svg, F.sx(x), F.T + 6, lbl, { "text-anchor": "middle" });
    handle(e.a, 1, "Attack: drag left or right", (dt, _dv) => s.a.set(s.a.get() + dt * 1000));
    handle(e.a + e.d, e.s, "Decay and sustain: arrows left/right for decay, up/down for sustain", (dt, dv) => { s.d.set(s.d.get() + dt * 1000); s.s.set(s.s.get() + dv); });
    handle(T, 0, "Release: drag left or right", (dt) => s.r.set(s.r.get() + dt * 1000));
    if (dot) el("circle", { cx: F.sx(dot[0]), cy: F.sy(dot[1]), r: 5, style: "fill:var(--foreground)" }, svg);
    o.tos.textContent = `${num((e.a + e.d) * 1000, 0)} ms`;
  }

  function niceTicks(T) {
    const step = [0.05, 0.1, 0.25, 0.5, 1, 2].find((st) => T / st <= 6) ?? 2;
    const t = [];
    for (let v = 0; v <= T + 1e-9; v += step) t.push(v);
    return t;
  }

  // A draggable, focusable handle. move(dtSeconds, dLevel). Dragging
  // listens on window because every move redraws the plot.
  function handle(x, y, label, move) {
    const g = el("g", { tabindex: 0, role: "slider", "aria-label": label, class: "cursor-grab outline-none" }, svg);
    el("circle", { cx: F.sx(x), cy: F.sy(y), r: 14, style: "fill:transparent" }, g);
    const dot = el("circle", { cx: F.sx(x), cy: F.sy(y), r: 6, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, g);
    g.addEventListener("focus", () => { dot.setAttribute("r", 8); dot.style.stroke = "var(--ring)"; dot.style.strokeWidth = 3; });
    g.addEventListener("blur", () => { dot.setAttribute("r", 6); dot.style.stroke = "var(--brand)"; dot.style.strokeWidth = 2; });
    const perPx = 1 / (F.sx(1) - F.sx(0));
    const H = F.H;
    g.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const box = svg.getBoundingClientRect(), scale = 560 / box.width;
      let lx = ev.clientX, ly = ev.clientY;
      const mv = (e2) => {
        const dx = (e2.clientX - lx) * scale, dy = (e2.clientY - ly) * scale;
        lx = e2.clientX; ly = e2.clientY;
        move(dx * perPx, (-dy / H) * 1.08);
      };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
      addEventListener("pointermove", mv);
      addEventListener("pointerup", up);
      addEventListener("pointercancel", up);
    });
    g.addEventListener("keydown", (e) => {
      const big = e.shiftKey ? 10 : 1;
      const k = { ArrowLeft: [-0.01 * big, 0], ArrowRight: [0.01 * big, 0], ArrowUp: [0, 0.02 * big], ArrowDown: [0, -0.02 * big] }[e.key];
      if (!k) return;
      e.preventDefault();
      move(...k);
      svg.querySelector(`[aria-label="${CSS.escape(label)}"]`)?.focus();
    });
  }

  // The scrub onChange redraws; handles call set() which notifies.

  function noteOn() {
    if (voice || key.disabled) return;
    const ac = engine();
    const e = env();
    const osc = ac.createOscillator();
    const filt = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 220;
    filt.frequency.value = 2400;
    const t0 = ac.currentTime + 0.01;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.3, t0 + e.a);
    g.gain.linearRampToValueAtTime(0.3 * e.s, t0 + e.a + e.d);
    osc.connect(filt).connect(g).connect(out());
    osc.start(t0);
    voice = { osc, g, t0, e, tOff: null, levelOff: 0 };
    key.setAttribute("aria-pressed", "true");
    tick();
  }
  function noteOff() {
    if (!voice || voice.tOff !== null) return;
    const ac = ctx();
    const now = ac.currentTime;
    const lvl = levelAt(Math.max(0, now - voice.t0), voice.e);
    voice.g.gain.cancelScheduledValues(now);
    voice.g.gain.setValueAtTime(0.3 * lvl, now);
    voice.g.gain.linearRampToValueAtTime(0, now + voice.e.r);
    voice.osc.stop(now + voice.e.r + 0.05);
    voice.tOff = now;
    voice.levelOff = lvl;
    key.setAttribute("aria-pressed", "false");
  }
  function tick() {
    cancelAnimationFrame(raf);
    if (!voice) return draw();
    const now = ctx().currentTime, e = voice.e;
    let t, lvl, stage;
    if (voice.tOff === null) {
      t = Math.max(0, now - voice.t0);
      lvl = levelAt(t, e);
      stage = t < e.a ? "attack" : t < e.a + e.d ? "decay" : "sustain";
      // Hold the dot inside the drawn sustain stretch.
      t = Math.min(t, e.a + e.d + HOLD * 0.98);
    } else {
      const tr = now - voice.tOff;
      if (tr >= e.r) {
        voice = null;
        o.level.textContent = "0.00";
        o.stage.textContent = "idle";
        return draw();
      }
      lvl = voice.levelOff * (1 - tr / e.r);
      stage = "release";
      t = e.a + e.d + HOLD + tr;
    }
    o.level.textContent = num(lvl, 2);
    o.stage.textContent = stage;
    draw([t, lvl]);
    raf = requestAnimationFrame(tick);
  }

  key.addEventListener("pointerdown", (e) => { e.preventDefault(); key.setPointerCapture(e.pointerId); noteOn(); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) key.addEventListener(ev, noteOff);
  key.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); noteOn(); } });
  key.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); noteOff(); } });
  key.addEventListener("click", (e) => e.preventDefault());

  onSeg(root, "Presets", (v) => {
    const p = PRESETS[v];
    ["a", "d", "s", "r"].forEach((k, i) => s[k].set(p[i], false));
    draw();
  });
  soundPanel(root, {
    onOff() {
      if (voice) { fadeOut(voice.g, [voice.osc]); voice = null; }
      cancelAnimationFrame(raf);
      o.stage.textContent = "idle";
      draw();
    },
  });
  o.level.textContent = "0.00";
  o.stage.textContent = "idle";
  draw();
}

// ============================================================ 4. subtractive

// One offline context gives real BiquadFilterNodes for frequency
// responses without a user gesture.
let offline = null;
const offlineFilter = () => {
  offline ??= new OfflineAudioContext(1, 128, FS);
  return offline.createBiquadFilter();
};

for (const root of document.querySelectorAll("[data-synth-sub]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let type = "sawtooth";
  const filt = offlineFilter();
  const voices = new Set();
  const s = scrubAll(root, draw);

  function draw() {
    const f0 = s.freq.get(), fc = s.cutoff.get(), q = s.q.get();
    filt.type = "lowpass";
    filt.frequency.value = fc;
    filt.Q.value = q;
    const n = 400;
    const fr = new Float32Array(n), mag = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) fr[i] = 20 * 1000 ** (i / (n - 1));
    filt.getFrequencyResponse(fr, mag, ph);
    clear(svg);
    const L = 44, T = 14, W = 500, H = 270;
    const sx = logAxis(20, 20000, L, W);
    const sy = (d) => T + ((30 - d) / 100) * H; // +30 dB to −70 dB
    for (const t of [30, 20, 10, 0, -20, -40, -60]) {
      el("line", { x1: L, x2: L + W, y1: sy(t), y2: sy(t), style: `stroke:currentColor;stroke-opacity:${t === 0 ? 0.25 : 0.07}` }, svg);
      text(svg, L - 6, sy(t) + 3, `${t > 0 ? "+" : ""}${t}`, { "text-anchor": "end" });
    }
    for (const f of FREQ_TICKS) text(svg, sx(f), T + H + 13, fTick(f), { "text-anchor": "middle" });
    text(svg, L + W, T + H + 26, "Hz", { "text-anchor": "end" });
    text(svg, 4, T - 2, "dB", {});
    let below = 0;
    for (let k = 1; k * f0 < 20000; k++) {
      const a = harmonicAmp(type, k);
      if (!a) continue;
      const f = k * f0;
      if (f < fc) below++;
      const src = db(a / harmonicAmp(type, 1));
      const m1 = new Float32Array(1), p1 = new Float32Array(1);
      filt.getFrequencyResponse(Float32Array.of(f), m1, p1);
      const outDb = src + db(m1[0]);
      const x = sx(f);
      el("line", { x1: x - 1.2, x2: x - 1.2, y1: sy(-70), y2: sy(Math.max(-70, src)), style: stroke("var(--muted-foreground)", 1.2, "opacity:.6") }, svg);
      if (outDb > -70) el("line", { x1: x + 1.2, x2: x + 1.2, y1: sy(-70), y2: sy(Math.min(30, outDb)), style: stroke("var(--brand)", 1.6) }, svg);
    }
    // The filter curve, drawn last so it sits on top.
    const pts = [];
    let peak = -Infinity, peakF = 0;
    for (let i = 0; i < n; i++) {
      const d = db(mag[i]);
      if (d > peak) { peak = d; peakF = fr[i]; }
      pts.push([sx(fr[i]), sy(Math.max(-70, Math.min(30, d)))]);
    }
    path(svg, pts, stroke("var(--vec-u)", 2));
    el("line", { x1: sx(fc), x2: sx(fc), y1: T, y2: T + H, style: stroke("var(--vec-u)", 1, "stroke-dasharray:3 3;opacity:.6") }, svg);
    o.below.textContent = `${below}`;
    o.peak.textContent = `${peak >= 0 ? "+" : ""}${num(peak, 1)} dB at ${fmtHz(peakF)}`;
    const start = Math.min(20000, fc * 2 ** s.amount.get());
    o.start.textContent = `${fmtHz(start)} → ${fmtHz(fc)} in ${num(s.decay.get(), 0)} ms`;
    for (const v of voices) {
      v.f.Q.setTargetAtTime(q, ctx().currentTime, 0.02);
    }
  }

  root.querySelector('[data-action="note"]').addEventListener("click", () => {
    const ac = engine();
    const t = ac.currentTime + 0.01;
    const osc = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    osc.type = type;
    osc.frequency.value = s.freq.get();
    f.type = "lowpass";
    f.Q.value = s.q.get();
    const fc = s.cutoff.get(), start = Math.min(20000, fc * 2 ** s.amount.get());
    f.frequency.setValueAtTime(start, t);
    f.frequency.exponentialRampToValueAtTime(fc, t + s.decay.get() / 1000);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.005);
    g.gain.setTargetAtTime(0.15, t + 0.01, 0.2);
    g.gain.setValueAtTime(0.15, t + 0.9);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    osc.connect(f).connect(g).connect(out());
    osc.start(t);
    osc.stop(t + 1.25);
    const v = { osc, f, g };
    voices.add(v);
    osc.onended = () => voices.delete(v);
  });
  onSeg(root, "Source", (v) => { type = v; draw(); });
  soundPanel(root, { onOff() { for (const v of voices) fadeOut(v.g, [v.osc]); voices.clear(); } });
  draw();
}

// ============================================================ 5. FM

for (const root of document.querySelectorAll("[data-synth-fm]")) {
  const svg = root.querySelector("[data-plot]");
  const bsvg = root.querySelector("[data-bessel]");
  const o = outs(root);
  const N = 16384;
  const PRESETS = { brass: [440, 1, 3], clarinet: [440, 2, 2], bell: [440, 1.4, 8] };
  let voice = null;
  const s = scrubAll(root, () => { selectSeg(root, "Presets", null); draw(); });

  // Sidebands at fc + n·fm with amplitude Jₙ(I); negative frequencies fold
  // onto positive ones with their sign flipped (sin(−x) = −sin x).
  function theory(fc, fm, I) {
    const lines = new Map();
    const nMax = Math.ceil(I + 12);
    for (let n = -nMax; n <= nMax; n++) {
      const f = fc + n * fm;
      const a = besselJ(n, I) * (f < 0 ? -1 : 1);
      const key = Math.round(Math.abs(f) * 100) / 100;
      if (key === 0) continue;
      lines.set(key, (lines.get(key) ?? 0) + a);
    }
    return [...lines].map(([f, a]) => ({ f, a: Math.abs(a) })).filter((l) => l.f < FS / 2);
  }

  function draw() {
    const fc = s.fc.get(), fm = fc * s.ratio.get(), I = s.index.get();
    const lines = theory(fc, fm, I);
    const x = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / FS;
      x[i] = Math.sin(2 * Math.PI * fc * t + I * Math.sin(2 * Math.PI * fm * t));
    }
    const mag = spectrum(x, "flattop");
    const dev = I * fm, carson = 2 * (dev + fm);
    const fmax = Math.min(20000, Math.max(2 * fc, fc + carson / 2 + 3 * fm));
    clear(svg);
    const F = frame(svg, { box: [40, 14, 506, 250], x: [0, fmax], y: [0, 1.05], yticks: [0, 0.25, 0.5, 0.75, 1], xticks: ticks(fmax), xfmt: (v) => (v >= 1000 ? `${num(v / 1000, 1)}k` : `${v}`), xlabel: "Hz", ylabel: "amplitude" });
    const lo = Math.max(0, fc - carson / 2), hi = Math.min(fmax, fc + carson / 2);
    el("rect", { x: F.sx(lo), y: F.T, width: Math.max(0, F.sx(hi) - F.sx(lo)), height: F.H, style: "fill:var(--muted-foreground);opacity:.08" }, svg);
    let worst = 0;
    for (const l of lines) {
      if (l.f > fmax) continue;
      el("line", { x1: F.sx(l.f), x2: F.sx(l.f), y1: F.sy(0), y2: F.sy(l.a), style: stroke("var(--brand)", 2.5, "stroke-linecap:butt") }, svg);
      const m = peakNear(mag, l.f, FS, 1);
      if (l.a > 0.01 || m > 0.01) {
        el("circle", { cx: F.sx(l.f), cy: F.sy(Math.min(1.05, m)), r: 2.6, style: "fill:var(--vec-u)" }, svg);
        worst = Math.max(worst, Math.abs(m - l.a));
      }
    }
    el("line", { x1: F.sx(fc), x2: F.sx(fc), y1: F.T + F.H, y2: F.T + F.H + 5, style: stroke("var(--foreground)", 1.5) }, svg);
    o.fm.textContent = fmtHz(fm);
    o.dev.textContent = `±${fmtHz(dev)}`;
    o.carson.textContent = fmtHz(carson);
    o.err.textContent = num(worst, 3);
    drawBessel(I);
    if (voice) {
      const now = ctx().currentTime;
      voice.car.frequency.setTargetAtTime(fc, now, 0.02);
      voice.mod.frequency.setTargetAtTime(fm, now, 0.02);
      voice.depth.gain.setTargetAtTime(dev, now, 0.02);
    }
  }

  function ticks(fmax) {
    const step = [100, 200, 250, 500, 1000, 2000, 5000].find((st) => fmax / st <= 7) ?? 5000;
    const t = [];
    for (let v = 0; v <= fmax; v += step) t.push(v);
    return t;
  }

  let besselCache = null;
  function drawBessel(I) {
    clear(bsvg);
    const F = frame(bsvg, { box: [40, 10, 506, 116], x: [0, 12], y: [-0.5, 1], yticks: [-0.4, 0, 0.5, 1], xticks: [0, 2, 4, 6, 8, 10, 12], xlabel: "index I" });
    const colors = ["var(--brand)", "var(--vec-u)", "var(--vec-v)", "var(--vec-out)", "var(--vec-i)"];
    besselCache ??= [0, 1, 2, 3, 4].map((n) => Array.from({ length: 241 }, (_, i) => besselJ(n, i / 20, 200)));
    besselCache.forEach((ys, n) => {
      path(bsvg, ys.map((y, i) => [F.sx(i / 20), F.sy(y)]), stroke(colors[n], 1.4));
      text(bsvg, F.sx(9.4 + n * 0.55), F.T + 10, `J${n}`, { style: `fill:${colors[n]}` });
    });
    el("line", { x1: F.sx(I), x2: F.sx(I), y1: F.T, y2: F.T + F.H, style: stroke("var(--foreground)", 1, "stroke-dasharray:3 3") }, bsvg);
  }

  const toggle = playToggle(root.querySelector('[data-action="play"]'), () => {
    const ac = engine();
    const fc = s.fc.get(), fm = fc * s.ratio.get();
    const car = ac.createOscillator(), mod = ac.createOscillator(), depth = ac.createGain(), g = ac.createGain();
    car.frequency.value = fc;
    mod.frequency.value = fm;
    depth.gain.value = s.index.get() * fm;
    mod.connect(depth).connect(car.frequency);
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.2, ac.currentTime + 0.05);
    car.connect(g).connect(out());
    car.start();
    mod.start();
    voice = { car, mod, depth, g };
    return () => { fadeOut(g, [car, mod]); voice = null; };
  });
  soundPanel(root, { onOff: () => toggle.halt() });
  onSeg(root, "Presets", (v) => {
    const p = PRESETS[v];
    s.fc.set(p[0], false); s.ratio.set(p[1], false); s.index.set(p[2], false);
    draw();
  });
  draw();
}

