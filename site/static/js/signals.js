// Signal processing blocks: sampling, DFT, Fourier series, convolution,
// FIR and biquad filters, the z-plane, a spectrogram, quantization and
// image kernels. Every curve is computed here from its definition.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { handle } from "./svg.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const plot = (root, name) => root.querySelector(`[data-plot="${name}"]`);
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const minus = (s) => String(s).replace(/-/g, "−");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// In-place radix-2 FFT on separate real and imaginary arrays.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

const WINDOWS = {
  rect: () => 1,
  hann: (n, N) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)),
  hamming: (n, N) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1)),
  blackman: (n, N) => 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (N - 1)),
};
const windowOf = (kind, N) => Float64Array.from({ length: N }, (_, n) => (N === 1 ? 1 : WINDOWS[kind](n, N)));
const db = (v) => 20 * Math.log10(Math.max(v, 1e-12));

// A short sine on the audio clock, with a soft envelope.
let audio = null;
function beep(freq, dur = 0.9) {
  audio ??= new AudioContext();
  const t = audio.currentTime;
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.03);
  g.gain.setValueAtTime(0.08, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// ============================================================ Sampling

for (const root of document.querySelectorAll("[data-sig-sampling]")) {
  const o = outs(root);
  const s = scrubAll(root, draw);
  const state = { f: 7, fa: 3 };
  root.querySelector("[data-action=play-signal]").addEventListener("click", () => beep(state.f * 100));
  root.querySelector("[data-action=play-alias]").addEventListener("click", () => beep(Math.max(20, Math.abs(state.fa) * 100)));

  function draw() {
    const f = s.f.get(), fs = s.fs.get();
    const k = Math.round(f / fs);
    const fa = f - k * fs; // signed: same samples as the signal
    Object.assign(state, { f, fa });

    const svg = plot(root, "time");
    svg.replaceChildren();
    const T = 2; // ms
    const fr = frame(svg, { box: [40, 10, 588, 214], x: [0, T], y: [-1.2, 1.2], xticks: [0, 0.5, 1, 1.5, 2], yticks: [-1, 0, 1], xlabel: "time (ms)", yfmt: minus });
    const dense = (fn) => Array.from({ length: 1201 }, (_, i) => { const t = (i * T) / 1200; return [fr.sx(t), fr.sy(fn(t))]; });
    polyline(svg, dense((t) => Math.sin(2 * Math.PI * f * t)), "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.25");
    polyline(svg, dense((t) => Math.sin(2 * Math.PI * fa * t)), "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:6 4");
    for (let n = 0; n / fs <= T + 1e-9; n++) {
      const t = n / fs, y = Math.sin(2 * Math.PI * f * t);
      el("line", { x1: fr.sx(t), x2: fr.sx(t), y1: fr.sy(0), y2: fr.sy(y), style: "stroke:var(--brand);stroke-opacity:0.6" }, svg);
      el("circle", { cx: fr.sx(t), cy: fr.sy(y), r: 3.5, style: "fill:var(--brand)" }, svg);
    }

    const fsvg = plot(root, "freq");
    fsvg.replaceChildren();
    const top = Math.max(fs * 1.5, f * 1.1, 10);
    const g = frame(fsvg, { box: [40, 22, 588, 34], x: [0, top], y: [0, 1], xticks: niceTicks(top), yticks: [], xlabel: "kHz" });
    el("rect", { x: g.sx(0), y: g.T, width: g.sx(fs / 2) - g.sx(0), height: g.H, style: "fill:var(--code-add);fill-opacity:0.1" }, fsvg);
    el("line", { x1: g.sx(fs / 2), x2: g.sx(fs / 2), y1: g.T - 6, y2: g.T + g.H, style: "stroke:var(--code-add);stroke-dasharray:3 3" }, fsvg);
    text(fsvg, g.sx(fs / 2) + 4, g.T - 8, "fs/2", { class: "fill-muted-foreground font-mono text-[10px]" });
    const mark = (x, color, label, anchor) => {
      el("line", { x1: g.sx(x), x2: g.sx(x), y1: g.T, y2: g.T + g.H, style: `stroke:${color};stroke-width:2.5` }, fsvg);
      text(fsvg, g.sx(x) + (anchor === "end" ? -5 : 5), g.T + 12, label, { "text-anchor": anchor, style: `fill:${color}` });
    };
    mark(f, "var(--foreground)", `f ${num(f)}`, "start");
    if (Math.abs(Math.abs(fa) - f) > 1e-9) mark(Math.abs(fa), "var(--vec-u)", `alias ${num(Math.abs(fa))}`, "end");

    o.nyq.textContent = `${num(fs / 2, 2)} kHz`;
    o.alias.textContent = Math.abs(fa) === f ? "none" : `${num(Math.abs(fa), 2)} kHz${fa < 0 ? " (phase flipped)" : ""}`;
    o.verdict.textContent = f < fs / 2 ? "faithful: f < fs/2" : f === fs / 2 ? "on the edge: f = fs/2" : `aliased (k = ${k})`;
    o.verdict.className = f < fs / 2 ? "text-add" : "text-del";
  }
  draw();
}

function niceTicks(top) {
  const step = [1, 2, 5, 10, 20, 50].find((s) => top / s <= 7) ?? 100;
  return Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
}

// ============================================================ DFT

for (const root of document.querySelectorAll("[data-sig-dft]")) {
  const o = outs(root);
  let win = "rect";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { win = e.detail.value; draw(); });
  const N = 256;
  const rng = mulberry32(11);
  const noise = Float64Array.from({ length: N }, () => gauss(rng));

  // Highest side lobe of a window, from a zero-padded transform.
  const sideLobe = {};
  for (const kind of Object.keys(WINDOWS)) {
    const M = 8192, re = new Float64Array(M), im = new Float64Array(M);
    windowOf(kind, N).forEach((v, i) => (re[i] = v));
    fft(re, im);
    const mag = Array.from({ length: M / 2 }, (_, k) => Math.hypot(re[k], im[k]));
    let k = 1;
    while (k < mag.length - 1 && mag[k + 1] < mag[k]) k++; // end of the main lobe
    sideLobe[kind] = db(Math.max(...mag.slice(k)) / mag[0]);
  }

  function draw() {
    const f1 = s.f1.get(), a1 = s.a1.get(), f2 = s.f2.get(), a2 = s.a2.get(), sd = s.noise.get();
    const w = windowOf(win, N);
    const sw = w.reduce((a, b) => a + b, 0);
    const x = Float64Array.from({ length: N }, (_, n) => a1 * Math.sin((2 * Math.PI * f1 * n) / N) + a2 * Math.sin((2 * Math.PI * f2 * n) / N) + sd * noise[n]);
    const re = Float64Array.from(x, (v, n) => v * w[n]), im = new Float64Array(N);
    const xw = Float64Array.from(re);
    fft(re, im);
    // Scaled so an on-bin sine of amplitude 1 reads 0 dB in any window.
    const spec = Array.from({ length: N / 2 + 1 }, (_, k) => db((2 * Math.hypot(re[k], im[k])) / sw));

    const t = plot(root, "time");
    t.replaceChildren();
    const ft = frame(t, { box: [40, 8, 588, 108], x: [0, N - 1], y: [-1.6, 1.6], xticks: [0, 64, 128, 192, 255], yticks: [-1, 0, 1], xlabel: "sample n", yfmt: minus });
    polyline(t, Array.from(w, (v, n) => [ft.sx(n), ft.sy(v)]), "stroke:var(--vec-u);stroke-opacity:0.5;stroke-dasharray:4 4");
    polyline(t, Array.from(xw, (v, n) => [ft.sx(n), ft.sy(Math.max(-1.6, Math.min(1.6, v)))]), "stroke:var(--foreground);stroke-width:1.25");

    const sp = plot(root, "spec");
    sp.replaceChildren();
    const fs = frame(sp, { box: [40, 20, 588, 184], x: [0, N / 2], y: [-120, 6], xticks: [0, 16, 32, 48, 64, 80, 96, 112, 128], yticks: [-120, -80, -40, 0], xlabel: "bin k", ylabel: "dB", yfmt: minus });
    const pts = spec.map((v, k) => [fs.sx(k), fs.sy(Math.max(-120, v))]);
    el("path", { d: `M${fs.sx(0)},${fs.sy(-120)} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(" ") + ` L${fs.sx(N / 2)},${fs.sy(-120)} Z`, style: "fill:var(--brand);fill-opacity:0.12" }, sp);
    polyline(sp, pts, "stroke:var(--brand);stroke-width:1.5");
    for (const [ff, aa] of [[f1, a1], [f2, a2]]) {
      if (aa <= 0) continue;
      el("line", { x1: fs.sx(ff), x2: fs.sx(ff), y1: fs.T, y2: fs.T + fs.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, sp);
    }
    const peakNear = (ff) => Math.max(...[Math.floor(ff), Math.ceil(ff)].filter((k) => k >= 0 && k <= N / 2).map((k) => spec[k]));
    o.n.textContent = `${N}, Δk = 1 bin`;
    o.p1.textContent = a1 > 0 ? `${num(peakNear(f1))} dB (true ${num(db(a1))})` : "—";
    o.p2.textContent = a2 > 0 ? `${num(peakNear(f2))} dB (true ${num(db(a2))})` : "—";
    o.side.textContent = `${num(sideLobe[win])} dB`;
  }
  draw();
}

// ============================================================ Fourier series

const SERIES = {
  square: { name: "(4/π) Σ sin(nx)/n, odd n", coef: (n) => (n % 2 ? 4 / (Math.PI * n) : 0), target: (x) => (wrap(x) < 0 ? -1 : 1), jump: 2 },
  saw: { name: "(2/π) Σ (−1)ⁿ⁺¹ sin(nx)/n", coef: (n) => ((n % 2 ? 2 : -2) / (Math.PI * n)), target: (x) => wrap(x) / Math.PI, jump: 2 },
  triangle: { name: "(8/π²) Σ ±sin(nx)/n², odd n", coef: (n) => (n % 2 ? ((((n - 1) / 2) % 2 ? -8 : 8) / (Math.PI * Math.PI * n * n)) : 0), target: (x) => tri(wrap(x)), jump: 0 },
};
function wrap(x) { return ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; }
function tri(x) { return Math.abs(x) <= Math.PI / 2 ? (2 * x) / Math.PI : Math.sign(x) * (2 - (2 * Math.abs(x)) / Math.PI); }

for (const root of document.querySelectorAll("[data-sig-fourier]")) {
  const o = outs(root);
  let kind = "square";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });

  function draw() {
    const S = SERIES[kind], N = Math.round(s.terms.get());
    const b = Array.from({ length: N + 1 }, (_, n) => (n ? S.coef(n) : 0));
    const sum = (x) => { let v = 0; for (let n = 1; n <= N; n++) if (b[n]) v += b[n] * Math.sin(n * x); return v; };
    // Fine grid over one period for the peak and the RMS error.
    const M = 6000;
    let peak = -Infinity, at = 0, err = 0;
    for (let i = 0; i < M; i++) {
      const x = -Math.PI + ((i + 0.5) * 2 * Math.PI) / M;
      const v = sum(x);
      if (v > peak) { peak = v; at = x; }
      err += (v - S.target(x)) ** 2;
    }
    // Refine the peak around the best grid point: the ripple is narrow.
    const dx = (2 * Math.PI) / M;
    for (let i = 0; i <= 400; i++) peak = Math.max(peak, sum(at - dx + (i * 2 * dx) / 400));
    const top = 1;

    const svg = plot(root, "wave");
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 588, 214], x: [-Math.PI, 3 * Math.PI], y: [-1.35, 1.35], xticks: [-Math.PI, 0, Math.PI, 2 * Math.PI, 3 * Math.PI], yticks: [-1, 0, 1], xfmt: (v) => ["−π", "0", "π", "2π", "3π"][Math.round(v / Math.PI) + 1], yfmt: minus });
    const pts = (fn, n = 1600) => Array.from({ length: n + 1 }, (_, i) => { const x = -Math.PI + (i * 4 * Math.PI) / n; return [f.sx(x), f.sy(fn(x))]; });
    polyline(svg, pts(S.target), "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1.25");
    polyline(svg, pts(sum, 2400), "stroke:var(--brand);stroke-width:1.75;stroke-linejoin:round");
    if (S.jump) hline(svg, f, 1 + 0.0895 * S.jump, "stroke:var(--vec-u);stroke-dasharray:4 4", "Gibbs limit 1.179");

    const c = plot(root, "coef");
    c.replaceChildren();
    const shown = Math.min(N, 60);
    const g = frame(c, { box: [40, 8, 588, 70], x: [0, shown + 1], y: [0, Math.abs(b[1]) * 1.1 || 1], xticks: niceTicks(shown).filter((v) => v <= shown), yticks: [0], xlabel: "harmonic n" });
    for (let n = 1; n <= shown; n++) if (b[n]) {
      el("line", { x1: g.sx(n), x2: g.sx(n), y1: g.sy(0), y2: g.sy(Math.abs(b[n])), style: "stroke:var(--brand);stroke-width:2" }, c);
    }
    text(c, 4, 16, "|bₙ|");

    o.series.textContent = S.name;
    o.over.textContent = S.jump ? `${num((100 * (peak - top)) / S.jump, 2)}% of the jump` : "none (no jump)";
    o.limit.textContent = S.jump ? "8.95% as n → ∞" : "uniform convergence";
    o.rms.textContent = num(Math.sqrt(err / M), 4);
  }
  draw();
}

// ============================================================ Convolution

const XS = { rect: (t) => (t >= 0 && t <= 1 ? 1 : 0), step: (t) => (t >= 0 ? 1 : 0), tri: (t) => (t >= 0 && t <= 2 ? 1 - Math.abs(t - 1) : 0) };
const HS = { exp: (t) => (t >= 0 ? Math.exp(-t / 0.5) : 0), rect: (t) => (t >= 0 && t <= 1 ? 1 : 0), gauss: (t) => Math.exp(-((t - 0.6) ** 2) / (2 * 0.15 ** 2)) };

for (const root of document.querySelectorAll("[data-sig-conv]")) {
  const o = outs(root);
  let xk = "rect", hk = "exp";
  const s = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => {
    const which = e.target.getAttribute("aria-label");
    if (which === "Input") xk = e.detail.value; else hk = e.detail.value;
    draw();
  });
  const dt = 0.005, T0 = -1.5, T1 = 6;
  const conv = (t) => { let y = 0; for (let tau = T0; tau <= T1; tau += dt) y += XS[xk](tau) * HS[hk](t - tau) * dt; return y; };

  function draw() {
    const t = s.t.get();
    const x = XS[xk], hh = HS[hk];
    const svg = plot(root, "slide");
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 10, 588, 150], x: [-1, 5], y: [-0.1, 1.15], xticks: [-1, 0, 1, 2, 3, 4, 5], yticks: [0, 1], xlabel: "τ (s)", xfmt: minus });
    const grid = Array.from({ length: 1201 }, (_, i) => -1 + (i * 6) / 1200);
    const prod = grid.map((tau) => [f.sx(tau), f.sy(x(tau) * hh(t - tau))]);
    el("path", { d: `M${f.sx(-1)},${f.sy(0)} ` + prod.map((p) => `L${p[0]},${p[1]}`).join(" ") + ` L${f.sx(5)},${f.sy(0)} Z`, style: "fill:var(--brand);fill-opacity:0.35" }, svg);
    polyline(svg, grid.map((tau) => [f.sx(tau), f.sy(x(tau))]), "stroke:var(--foreground);stroke-width:1.75");
    polyline(svg, grid.map((tau) => [f.sx(tau), f.sy(hh(t - tau))]), "stroke:var(--vec-u);stroke-width:1.75");
    el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-opacity:0.5;stroke-dasharray:3 3" }, svg);
    text(svg, f.sx(t) + 4, f.T + 10, `t = ${num(t, 2)}`, { class: "fill-foreground font-mono text-[10px]" });

    const out = plot(root, "out");
    out.replaceChildren();
    const ys = grid.map((tt) => conv(tt));
    const top = Math.max(0.5, ...ys) * 1.15;
    const g = frame(out, { box: [40, 20, 588, 100], x: [-1, 5], y: [0, top], xticks: [-1, 0, 1, 2, 3, 4, 5], yticks: [0, Math.round(top * 10) / 10], xlabel: "t (s)", ylabel: "y(t)", xfmt: minus });
    polyline(out, grid.map((tt, i) => [g.sx(tt), g.sy(ys[i])]), "stroke:var(--foreground);stroke-opacity:0.18;stroke-width:1.25;stroke-dasharray:3 3");
    const done = grid.map((tt, i) => [tt, ys[i]]).filter(([tt]) => tt <= t);
    if (done.length > 1) polyline(out, done.map(([tt, y]) => [g.sx(tt), g.sy(y)]), "stroke:var(--brand);stroke-width:2");
    const yt = conv(t);
    el("circle", { cx: g.sx(t), cy: g.sy(yt), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, out);
    o.y.textContent = num(yt, 3);
    let ah = 0; for (let tau = -2; tau <= 8; tau += dt) ah += hh(tau) * dt;
    o.areaH.textContent = num(ah, 3);
  }

  // Play: sweep t from −1 to 5 in 4 s.
  const btn = root.querySelector("[data-action=play]");
  let raf = 0, playing = false;
  const setPlay = (p) => {
    playing = p;
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Play";
    if (!p) cancelAnimationFrame(raf);
  };
  btn.querySelector("[data-label]").textContent = "Play";
  btn.addEventListener("click", () => {
    if (playing) return setPlay(false);
    if (reduced()) { s.t.set(5, false); return draw(); }
    if (s.t.get() >= 4.99) s.t.set(-1, false);
    setPlay(true);
    let last = performance.now();
    const step = (now) => {
      const nt = Math.min(5, s.t.get() + ((now - last) / 4000) * 6);
      last = now;
      s.t.set(nt, false);
      draw();
      if (nt < 5 && playing) raf = requestAnimationFrame(step); else setPlay(false);
    };
    raf = requestAnimationFrame(step);
  });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && playing) setPlay(false); }).observe(root);
  draw();
}

// ============================================================ FIR

const TRANSITION = { rect: 0.9, hamming: 3.3, blackman: 5.5 }; // transition width × fs/N

for (const root of document.querySelectorAll("[data-sig-fir]")) {
  const o = outs(root);
  let win = "rect";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { win = e.detail.value; draw(); });
  const L = 400, rng = mulberry32(5);
  const clean = Float64Array.from({ length: L }, (_, n) => Math.sin(2 * Math.PI * 0.02 * n));
  const noisy = Float64Array.from(clean, (v, n) => v + 0.4 * Math.sin(2 * Math.PI * 0.31 * n) + 0.25 * gauss(rng));

  function draw() {
    const fc = s.fc.get();
    let N = Math.round(s.taps.get());
    if (N % 2 === 0) N += 1;
    const M = (N - 1) / 2, w = windowOf(win, N);
    const h = Float64Array.from({ length: N }, (_, n) => { const k = n - M; return (k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k)) * w[n]; });
    const dc = h.reduce((a, b) => a + b, 0);
    h.forEach((v, i) => (h[i] = v / dc));
    const H = (f) => { let re = 0, im = 0; for (let n = 0; n < N; n++) { re += h[n] * Math.cos(2 * Math.PI * f * n); im -= h[n] * Math.sin(2 * Math.PI * f * n); } return Math.hypot(re, im); };
    const F = Array.from({ length: 501 }, (_, i) => (i * 0.5) / 500);
    const mag = F.map((f) => db(H(f)));

    const taps = plot(root, "taps");
    taps.replaceChildren();
    const hmax = Math.max(...h), hmin = Math.min(0, ...h);
    const ft = frame(taps, { box: [36, 10, 214, 160], x: [-0.5, N - 0.5], y: [hmin * 1.2, hmax * 1.15], xticks: [0, M, N - 1], yticks: [0], xlabel: "n" });
    h.forEach((v, n) => {
      el("line", { x1: ft.sx(n), x2: ft.sx(n), y1: ft.sy(0), y2: ft.sy(v), style: "stroke:var(--brand);stroke-width:1.5" }, taps);
      if (N <= 61) el("circle", { cx: ft.sx(n), cy: ft.sy(v), r: 2.2, style: "fill:var(--brand)" }, taps);
    });

    const resp = plot(root, "resp");
    resp.replaceChildren();
    const fr = frame(resp, { box: [40, 20, 330, 150], x: [0, 0.5], y: [-100, 5], xticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yticks: [-100, -60, -20, 0], xlabel: "f / fs", ylabel: "dB", yfmt: minus });
    el("rect", { x: fr.sx(0), y: fr.T, width: fr.sx(fc) - fr.sx(0), height: fr.H, style: "fill:var(--code-add);fill-opacity:0.08" }, resp);
    polyline(resp, F.map((f, i) => [fr.sx(f), fr.sy(Math.max(-100, mag[i]))]), "stroke:var(--foreground);stroke-width:1.5");
    el("line", { x1: fr.sx(fc), x2: fr.sx(fc), y1: fr.T, y2: fr.T + fr.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, resp);

    // −3 dB point and stop-band level beyond the window's transition band.
    const i3 = mag.findIndex((v) => v < -3.0103);
    const fStop = Math.min(0.5, fc + TRANSITION[win] / N);
    const stop = Math.max(...mag.filter((_, i) => F[i] >= fStop));

    const ap = plot(root, "apply");
    ap.replaceChildren();
    const fa = frame(ap, { box: [40, 8, 588, 118], x: [0, L - 1], y: [-2, 2], xticks: [0, 100, 200, 300, 399], yticks: [-1, 0, 1], xlabel: "n", yfmt: minus });
    polyline(ap, Array.from(noisy, (v, n) => [fa.sx(n), fa.sy(Math.max(-2, Math.min(2, v)))]), "stroke:var(--foreground);stroke-opacity:0.3;stroke-width:1");
    const y = new Float64Array(L);
    for (let n = 0; n < L; n++) { let acc = 0; for (let k = 0; k < N; k++) if (n - k >= 0) acc += h[k] * noisy[n - k]; y[n] = acc; }
    const pts = [];
    let e1 = 0, e0 = 0;
    for (let n = M; n < L; n++) {
      pts.push([fa.sx(n - M), fa.sy(Math.max(-2, Math.min(2, y[n])))]);
      if (n >= N) { e1 += (y[n] - clean[n - M]) ** 2; e0 += (noisy[n - M] - clean[n - M]) ** 2; }
    }
    polyline(ap, pts, "stroke:var(--brand);stroke-width:1.75");

    o.f3.textContent = i3 > 0 ? `${num(F[i3], 3)} × fs` : "—";
    o.stop.textContent = Number.isFinite(stop) ? `${num(stop)} dB (f ≥ ${num(fStop, 3)})` : "—";
    o.delay.textContent = `${M} samples`;
    o.left.textContent = e0 ? `${num((100 * Math.sqrt(e1)) / Math.sqrt(e0), 1)}% of the noise RMS` : "—";
  }
  draw();
}

// ============================================================ Biquad (RBJ cookbook)

function rbj(type, f0, q, fs) {
  const w0 = (2 * Math.PI * f0) / fs, c = Math.cos(w0), al = Math.sin(w0) / (2 * q);
  const B = {
    lowpass: [(1 - c) / 2, 1 - c, (1 - c) / 2],
    highpass: [(1 + c) / 2, -(1 + c), (1 + c) / 2],
    bandpass: [al, 0, -al],
    notch: [1, -2 * c, 1],
  }[type];
  const a0 = 1 + al;
  return { b: B.map((v) => v / a0), a: [1, (-2 * c) / a0, (1 - al) / a0] };
}
// Roots of z² + p z + q (as complex pairs).
const roots = (p, q) => {
  const d = p * p - 4 * q;
  return d >= 0 ? [[(-p + Math.sqrt(d)) / 2, 0], [(-p - Math.sqrt(d)) / 2, 0]] : [[-p / 2, Math.sqrt(-d) / 2], [-p / 2, -Math.sqrt(-d) / 2]];
};
function freqz(b, a, w) {
  const num_ = [b[0] + b[1] * Math.cos(w) + b[2] * Math.cos(2 * w), -(b[1] * Math.sin(w) + b[2] * Math.sin(2 * w))];
  const den = [a[0] + a[1] * Math.cos(w) + a[2] * Math.cos(2 * w), -(a[1] * Math.sin(w) + a[2] * Math.sin(2 * w))];
  const m = Math.hypot(...den);
  return { mag: Math.hypot(...num_) / m, phase: Math.atan2(num_[1], num_[0]) - Math.atan2(den[1], den[0]) };
}

function pzPlot(svg, poles, zeros) {
  svg.replaceChildren();
  const C = 120, R = 85;
  const X = (re) => C + re * R, Y = (im) => C - im * R;
  el("line", { x1: 10, x2: 230, y1: C, y2: C, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
  el("line", { x1: C, x2: C, y1: 10, y2: 230, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
  el("circle", { cx: C, cy: C, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:3 3" }, svg);
  text(svg, C + R + 3, C + 14, "1", {});
  for (const [re, im] of zeros) el("circle", { cx: X(re), cy: Y(im), r: 5, style: "fill:none;stroke:var(--vec-u);stroke-width:2" }, svg);
  for (const [re, im] of poles) {
    const x = X(re), y = Y(im), d = 5;
    el("path", { d: `M${x - d},${y - d}L${x + d},${y + d}M${x - d},${y + d}L${x + d},${y - d}`, style: "stroke:var(--brand);stroke-width:2.25;stroke-linecap:round" }, svg);
  }
  text(svg, 12, 20, "× poles  ○ zeros", {});
}

for (const root of document.querySelectorAll("[data-sig-biquad]")) {
  const o = outs(root);
  let type = "lowpass";
  const FS = 48000;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { type = e.detail.value; draw(); });

  function draw() {
    const { b, a } = rbj(type, Math.min(s.f0.get(), FS / 2 - 1), s.q.get(), FS);
    pzPlot(plot(root, "pz"), roots(a[1], a[2]), b[0] === 0 ? [] : roots(b[1] / b[0], b[2] / b[0]));
    const F = Array.from({ length: 400 }, (_, i) => 20 * Math.pow(1000, i / 399));
    const r = F.map((f) => freqz(b, a, (2 * Math.PI * f) / FS));
    const xt = [20, 100, 1000, 10000].map((v) => Math.log10(v));
    const lf = (v) => { const x = Math.round(10 ** v); return x >= 1000 ? `${x / 1000}k` : String(x); };

    const m = plot(root, "mag");
    m.replaceChildren();
    const fm = frame(m, { box: [40, 20, 330, 122], x: [Math.log10(20), Math.log10(20000)], y: [-60, 24], xticks: xt, yticks: [-60, -40, -20, 0, 20], ylabel: "dB", xfmt: lf, yfmt: minus });
    hline(m, fm, -3, "stroke:var(--code-add);stroke-dasharray:3 3;stroke-opacity:0.6");
    polyline(m, F.map((f, i) => [fm.sx(Math.log10(f)), fm.sy(Math.max(-60, Math.min(24, db(r[i].mag))))]), "stroke:var(--brand);stroke-width:1.75");

    const p = plot(root, "phase");
    p.replaceChildren();
    const fp = frame(p, { box: [40, 18, 330, 82], x: [Math.log10(20), Math.log10(20000)], y: [-180, 180], xticks: xt, yticks: [-180, 0, 180], xlabel: "Hz", ylabel: "°", xfmt: lf, yfmt: minus });
    const deg = r.map((v) => (((v.phase * 180) / Math.PI + 540) % 360) - 180);
    polyline(p, F.map((f, i) => [fp.sx(Math.log10(f)), fp.sy(deg[i])]), "stroke:var(--vec-u);stroke-width:1.5");

    o.b.textContent = b.map((v) => minus(v.toFixed(4))).join(", ");
    o.a.textContent = a.map((v) => minus(v.toFixed(4))).join(", ");
    o.r.textContent = num(Math.sqrt(Math.abs(a[2])), 4);
    o.peak.textContent = `${num(Math.max(...r.map((v) => db(v.mag))), 2)} dB`;
  }
  draw();
}

// ============================================================ z-plane

for (const root of document.querySelectorAll("[data-sig-zplane]")) {
  const svg = plot(root, "z");
  const o = outs(root);
  let pole = [0.6, 0.6], zero = [-0.2, 0.9], useZero = true;
  onToggle(root, (_, on) => { useZero = on; draw(); });

  const back = el("g", {}, svg);
  const top = el("g", { class: "text-foreground" }, svg);
  const marks = el("g", { style: "pointer-events:none" }, svg);
  const clampUpper = ([x, y]) => {
    let r = Math.hypot(x, y);
    y = Math.max(0, y);
    r = Math.hypot(x, y);
    if (r > 1.45) { x *= 1.45 / r; y *= 1.45 / r; }
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  };
  const hp = handle(svg, top, "Pole", (p) => { pole = clampUpper(p); draw(); });
  const hz = handle(svg, top, "Zero", (p) => { zero = clampUpper(p); draw(); });
  const keys = (get, set) => (e) => {
    const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key];
    if (!d) return;
    e.preventDefault();
    const v = get();
    set(clampUpper([v[0] + d[0], v[1] + d[1]]));
    draw();
  };
  hp.node.addEventListener("keydown", keys(() => pole, (v) => (pole = v)));
  hz.node.addEventListener("keydown", keys(() => zero, (v) => (zero = v)));

  function draw() {
    back.replaceChildren();
    marks.replaceChildren();
    const line = (x1, y1, x2, y2, st) => el("line", { x1, y1: -y1, x2, y2: -y2, style: st, "vector-effect": "non-scaling-stroke" }, back);
    line(-1.6, 0, 1.6, 0, "stroke:currentColor;stroke-opacity:0.2");
    line(0, -1.6, 0, 1.6, "stroke:currentColor;stroke-opacity:0.2");
    el("circle", { cx: 0, cy: 0, r: 1, style: "fill:none;stroke:currentColor;stroke-opacity:0.5;stroke-dasharray:3 3", "vector-effect": "non-scaling-stroke" }, back);
    const cross = ([x, y], op = 1) => {
      const d = 0.07;
      el("path", { d: `M${x - d},${-y - d}L${x + d},${-y + d}M${x - d},${-y + d}L${x + d},${-y - d}`, style: `stroke:var(--brand);stroke-width:2.5px;stroke-linecap:round;opacity:${op}`, "vector-effect": "non-scaling-stroke" }, marks);
    };
    const ring = ([x, y], op = 1) => el("circle", { cx: x, cy: -y, r: 0.06, style: `fill:none;stroke:var(--vec-u);stroke-width:2px;opacity:${op}`, "vector-effect": "non-scaling-stroke" }, marks);
    cross(pole); cross([pole[0], -pole[1]], 0.5);
    if (useZero) { ring(zero); ring([zero[0], -zero[1]], 0.5); }
    hp.place(pole, "var(--brand)");
    hz.place(useZero ? zero : [9, 9], "var(--vec-u)");
    hz.node.toggleAttribute("hidden", !useZero);

    // H(z) = (1 + b1 z⁻¹ + b2 z⁻²)/(1 + a1 z⁻¹ + a2 z⁻²) from the two pairs.
    const a = [1, -2 * pole[0], pole[0] ** 2 + pole[1] ** 2];
    const b = useZero ? [1, -2 * zero[0], zero[0] ** 2 + zero[1] ** 2] : [1, 0, 0];
    const W = Array.from({ length: 400 }, (_, i) => (i * Math.PI) / 399);
    const mags = W.map((w) => db(freqz(b, a, w).mag));
    const peak = Math.max(...mags);

    const m = plot(root, "mag");
    m.replaceChildren();
    const fm = frame(m, { box: [40, 20, 330, 122], x: [0, Math.PI], y: [-60, 6], xticks: [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI], yticks: [-60, -40, -20, 0], ylabel: "dB (rel. peak)", xfmt: (v) => ["0", "π/4", "π/2", "3π/4", "π"][Math.round((v / Math.PI) * 4)], yfmt: minus });
    polyline(m, W.map((w, i) => [fm.sx(w), fm.sy(Math.max(-60, mags[i] - peak))]), "stroke:var(--brand);stroke-width:1.75");
    el("line", { x1: fm.sx(Math.atan2(pole[1], pole[0])), x2: fm.sx(Math.atan2(pole[1], pole[0])), y1: fm.T, y2: fm.T + fm.H, style: "stroke:var(--brand);stroke-opacity:0.35;stroke-dasharray:3 3" }, m);

    const imp = plot(root, "imp");
    imp.replaceChildren();
    const K = 60, y = new Float64Array(K);
    for (let n = 0; n < K; n++) {
      const x = (k) => (k === 0 ? 1 : 0);
      y[n] = x(n) + b[1] * x(n - 1) + b[2] * x(n - 2) - a[1] * (n >= 1 ? y[n - 1] : 0) - a[2] * (n >= 2 ? y[n - 2] : 0);
    }
    const lim = Math.min(1e6, Math.max(1, ...Array.from(y, Math.abs)));
    const fi = frame(imp, { box: [40, 8, 330, 92], x: [-0.5, K - 0.5], y: [-lim * 1.1, lim * 1.1], xticks: [0, 20, 40, 59], yticks: [0], xlabel: "n" });
    y.forEach((v, n) => el("line", { x1: fi.sx(n), x2: fi.sx(n), y1: fi.sy(0), y2: fi.sy(Math.max(-lim, Math.min(lim, v))), style: "stroke:var(--vec-u);stroke-width:2" }, imp));

    const r = Math.hypot(...pole);
    const ang = (p) => `${num(Math.hypot(...p), 2)} ∠ ${num((Math.atan2(p[1], p[0]) * 180) / Math.PI, 0)}°`;
    o.pole.textContent = ang(pole);
    o.zero.textContent = useZero ? ang(zero) : "off";
    o.stable.textContent = r < 0.999 ? "stable: poles inside the circle" : r <= 1.001 ? "marginal: on the circle" : "unstable: grows without bound";
    o.stable.className = r < 0.999 ? "text-add" : "text-del";
  }
  draw();
}

// ============================================================ Spectrogram

const probeCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = getComputedStyle(probeEl).color;
  probeCtx.fillRect(0, 0, 1, 1);
  return [...probeCtx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

for (const root of document.querySelectorAll("[data-sig-spectro]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let L = 128;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { L = Number(e.detail.value); draw(); });
  const FS = 8000, n = FS;
  const sig = Float64Array.from({ length: n }, (_, i) => {
    const t = i / FS;
    let v = 0.6 * Math.sin(2 * Math.PI * (200 * t + 1500 * t * t)); // 200 → 3,200 Hz
    if (t >= 0.2 && t <= 0.8) v += 0.4 * Math.sin(2 * Math.PI * 1000 * t);
    return v;
  });
  sig[FS / 2] += 6; // the click

  function draw() {
    const hop = Math.max(1, Math.round((L * s.hop.get()) / 100));
    const w = windowOf("hann", L);
    const frames = Math.floor((n - L) / hop) + 1;
    const H = L / 2;
    const grid = new Float32Array(frames * H);
    let max = 1e-12;
    for (let f = 0; f < frames; f++) {
      const re = new Float64Array(L), im = new Float64Array(L);
      for (let i = 0; i < L; i++) re[i] = sig[f * hop + i] * w[i];
      fft(re, im);
      for (let k = 0; k < H; k++) { const m = Math.hypot(re[k], im[k]); grid[f * H + k] = m; max = Math.max(max, m); }
    }
    const lo = rgbOf("var(--code-bg)"), mid = rgbOf("var(--vec-u)"), hi = rgbOf("var(--brand)");
    const img = new ImageData(frames, H);
    for (let f = 0; f < frames; f++) for (let k = 0; k < H; k++) {
      const v = Math.max(0, Math.min(1, (db(grid[f * H + k] / max) + 60) / 60)) ** 1.6;
      const [c0, c1, t] = v < 0.5 ? [lo, mid, v / 0.5] : [mid, hi, (v - 0.5) / 0.5];
      const i = ((H - 1 - k) * frames + f) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[i + ch] = c0[ch] + (c1[ch] - c0[ch]) * t;
      img.data[i + 3] = 255;
    }
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    const off = new OffscreenCanvas(frames, H);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    ctx.font = `${10 * dpr}px "Geist Mono", monospace`;
    ctx.fillStyle = `rgb(${rgbOf("var(--foreground)").join(",")})`;
    for (const khz of [1, 2, 3]) ctx.fillText(`${khz} kHz`, 6 * dpr, canvas.height * (1 - khz / 4) + 4 * dpr);

    o.dt.textContent = `${num((1000 * L) / FS, 1)} ms`;
    o.df.textContent = `${num(FS / L, 1)} Hz`;
    o.frames.textContent = `${frames} × ${H} bins`;
  }
  new ResizeObserver(() => draw()).observe(canvas);
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// ============================================================ Quantization

for (const root of document.querySelectorAll("[data-sig-quant]")) {
  const o = outs(root);
  let dither = false;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { dither = on; draw(); });
  const N = 4096, cycles = 127; // coherent: a prime number of whole cycles, no leakage

  function draw() {
    const bits = Math.round(s.bits.get()), A = 10 ** (s.level.get() / 20);
    const step = 2 / 2 ** bits;
    const rng = mulberry32(3);
    const x = new Float64Array(N), q = new Float64Array(N);
    let pn = 0;
    for (let n = 0; n < N; n++) {
      x[n] = A * Math.sin((2 * Math.PI * cycles * n) / N) * (1 - 1e-9);
      const d = dither ? (rng() - rng()) * step : 0; // TPDF, ±1 LSB
      // Mid-rise: 2^N levels at ±step/2 … ±(1 − step/2), so a full-scale
      // sine is never clipped (the assumption behind 6.02N + 1.76).
      q[n] = Math.max(-1 + step / 2, Math.min(1 - step / 2, step * (Math.floor((x[n] + d) / step) + 0.5)));
      pn += (q[n] - x[n]) ** 2;
    }
    const snr = 10 * Math.log10((A * A) / 2 / (pn / N));

    const show = 96;
    const wv = plot(root, "wave");
    wv.replaceChildren();
    const fw = frame(wv, { box: [40, 10, 588, 160], x: [0, show], y: [-1.1, 1.1], xticks: [0, 32, 64, 96], yticks: [-1, 0, 1], yfmt: minus });
    polyline(wv, Array.from({ length: show * 8 + 1 }, (_, i) => { const t = i / 8; return [fw.sx(t), fw.sy(A * Math.sin((2 * Math.PI * cycles * t) / N))]; }), "stroke:var(--foreground);stroke-opacity:0.4;stroke-width:1.25");
    const stairs = [];
    for (let n = 0; n < show; n++) stairs.push([fw.sx(n), fw.sy(q[n])], [fw.sx(n + 1), fw.sy(q[n])]);
    polyline(wv, stairs, "stroke:var(--brand);stroke-width:1.75");

    const er = plot(root, "err");
    er.replaceChildren();
    const lim = step * (dither ? 1.6 : 0.6);
    const fe = frame(er, { box: [40, 18, 588, 70], x: [0, show], y: [-lim, lim], xticks: [], yticks: [0], ylabel: "error" });
    polyline(er, Array.from({ length: show }, (_, n) => [fe.sx(n + 0.5), fe.sy(q[n] - x[n])]), "stroke:var(--code-del);stroke-width:1.25");
    for (const v of [-step / 2, step / 2]) hline(er, fe, v, "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3");

    const sp = plot(root, "spec");
    sp.replaceChildren();
    const re = Float64Array.from(q), im = new Float64Array(N);
    fft(re, im);
    const spec = Array.from({ length: N / 2 }, (_, k) => db((2 * Math.hypot(re[k], im[k])) / N));
    const fs_ = frame(sp, { box: [40, 20, 588, 102], x: [0, N / 2], y: [-200, 0], xticks: [0, 512, 1024, 1536, 2048], yticks: [-200, -150, -100, -50, 0], xlabel: "bin", ylabel: "dB", yfmt: minus });
    polyline(sp, spec.map((v, k) => [fs_.sx(k), fs_.sy(Math.max(-200, v))]), "stroke:var(--vec-u);stroke-width:1");

    o.step.textContent = `${step < 1e-3 ? step.toExponential(2) : num(step, 4)} (${2 ** bits} levels)`;
    o.snr.textContent = `${num(snr, 2)} dB`;
    o.theory.textContent = `${num(6.02 * bits + 1.76 + s.level.get(), 2)} dB`;
  }
  draw();
}

// ============================================================ Image kernels

const KERNELS = {
  identity: { k: [0, 0, 0, 0, 1, 0, 0, 0, 0], div: 1, bias: 0 },
  box: { k: [1, 1, 1, 1, 1, 1, 1, 1, 1], div: 9, bias: 0 },
  gauss: { k: [1, 2, 1, 2, 4, 2, 1, 2, 1], div: 16, bias: 0 },
  sharpen: { k: [0, -1, 0, -1, 5, -1, 0, -1, 0], div: 1, bias: 0 },
  sobelx: { k: [-1, 0, 1, -2, 0, 2, -1, 0, 1], div: 1, bias: 128 },
  laplace: { k: [0, 1, 0, 1, -4, 1, 0, 1, 0], div: 1, bias: 128 },
  emboss: { k: [-2, -1, 0, -1, 1, 1, 0, 1, 2], div: 1, bias: 0 },
};

for (const root of document.querySelectorAll("[data-sig-image]")) {
  const o = outs(root);
  const cin = root.querySelector('[data-canvas="in"]'), cout = root.querySelector('[data-canvas="out"]');
  const cells = [...root.querySelectorAll("[data-k]")];
  const preset = root.querySelector("[data-preset]");
  const s = scrubAll(root, draw);
  const W = 96;
  // A test pattern: gradient, checkerboard, a disc, thin lines and noise.
  const rng = mulberry32(9);
  const src = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let v = (x / W) * 120 + 40;
    if (x >= 52 && y < 44) v = ((Math.floor(x / 6) + Math.floor(y / 6)) % 2) * 200 + 30;
    if ((x - 26) ** 2 + (y - 28) ** 2 < 16 ** 2) v = 225;
    if (y > 58 && (x % 12 === 0 || y === 76)) v = 15;
    if (y > 82) v += (rng() - 0.5) * 70;
    src[y * W + x] = Math.max(0, Math.min(255, v));
  }

  const paint = (canvas, data) => {
    canvas.width = W; canvas.height = W;
    const img = new ImageData(W, W);
    data.forEach((v, i) => { img.data.set([v, v, v, 255], i * 4); });
    canvas.getContext("2d").putImageData(img, 0, 0);
  };
  paint(cin, src);

  const load = (name) => {
    const p = KERNELS[name];
    cells.forEach((c, i) => (c.value = minus(p.k[i])));
    s.div.set(p.div, false);
    s.bias.set(p.bias, false);
    draw();
  };
  preset.addEventListener("change", () => load(preset.value));
  cells.forEach((c) => c.addEventListener("input", draw));

  function draw() {
    const k = cells.map((c) => { const v = parseFloat(c.value.replace("−", "-")); return Number.isFinite(v) ? v : 0; });
    const div = s.div.get() || 1, bias = s.bias.get();
    const out = new Float32Array(W * W);
    const at = (x, y) => src[Math.min(W - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]; // clamp edges
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) acc += k[(j + 1) * 3 + (i + 1)] * at(x + i, y + j);
      out[y * W + x] = Math.max(0, Math.min(255, acc / div + bias));
    }
    paint(cout, out);
    const sum = k.reduce((a, b) => a + b, 0) / div;
    o.sum.textContent = num(sum, 3);
    o.effect.textContent = Math.abs(sum) < 1e-9 ? "flat areas → bias: an edge detector" : Math.abs(sum - 1) < 1e-9 ? "keeps overall brightness" : sum > 1 ? "brightens" : "darkens";
  }
  load("gauss");
  preset.value = "gauss";
}
