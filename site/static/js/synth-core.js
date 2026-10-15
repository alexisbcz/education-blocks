// Shared pieces of the sound synthesis blocks: one AudioContext behind a
// master gain and a safety limiter, the page-wide master volume and "Stop
// all", the per-block "Sound on" switch, an FFT, Bessel functions and
// small plotting helpers. This module only exports; it does nothing when
// loaded on its own.

import { scrubbable } from "./scrub.js";
import { el, text, num } from "./plot.js";

export const FS = 48000;
export { el, text, num };

export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const db = (x) => 20 * Math.log10(Math.max(Math.abs(x), 1e-12));
export const clear = (svg) => svg.replaceChildren();
export const fmtHz = (f) => (Math.abs(f) >= 1000 ? `${num(f / 1000, Math.abs(f) >= 10000 ? 1 : 2)} kHz` : `${num(f, Math.abs(f) < 100 ? 1 : 0)} Hz`);

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ notes

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
export const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const noteName = (m) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

// ============================================================ engine

let actx = null;
let master = null;
let volume = 0.15;
const stoppers = new Set();
const volInputs = [];

// engine creates the context on first use (always inside a user gesture)
// and resumes it if the browser suspended it.
export function engine() {
  if (!actx) {
    actx = new AudioContext();
    master = actx.createGain();
    master.gain.value = volume;
    const limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    master.connect(limiter).connect(actx.destination);
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
export const ctx = () => actx;
export const out = () => master;

function setVolume(v, from) {
  volume = v / 100;
  if (master) master.gain.setTargetAtTime(volume, actx.currentTime, 0.02);
  for (const s of volInputs) if (s !== from) s.set(v, false);
}

export function stopAll() {
  for (const s of [...stoppers]) s();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAll();
});

// A short fade avoids clicks when a node is cut off.
export function fadeOut(gainNode, nodes = [], t = 0.04) {
  if (!actx) return;
  const now = actx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(0, now + t);
  for (const n of nodes) {
    try { n.stop(now + t + 0.01); } catch { /* already stopped */ }
  }
  setTimeout(() => gainNode.disconnect(), (t + 0.1) * 1000);
}

// soundPanel wires a block's sound switch, its copy of the master volume
// and the "Stop all" button. onOn runs inside the switch's click (a user
// gesture); onOff tears the block's sound down. The switch turns itself
// off when the block leaves the viewport, the page is hidden or any
// block's "Stop all" is pressed. Buttons marked data-needs-sound follow it.
export function soundPanel(root, { onOn = () => {}, onOff = () => {} } = {}) {
  const sw = root.querySelector('[data-toggle="sound"]');
  const needs = root.querySelectorAll("[data-needs-sound]");
  let on = false;
  const turnOff = () => {
    if (on) sw.click();
  };
  sw.addEventListener("shadcn:checked-change", (e) => {
    on = e.detail.checked;
    for (const b of needs) b.disabled = !on;
    if (on) {
      engine();
      stoppers.add(turnOff);
      onOn();
    } else {
      stoppers.delete(turnOff);
      onOff();
    }
  });
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) turnOff();
  }).observe(root);
  const vol = root.querySelector("[data-master-vol]");
  if (vol) {
    const s = scrubbable(vol, { min: 0, max: 60, step: 1, onChange: (v) => setVolume(v, s) });
    s.set(volume * 100, false);
    volInputs.push(s);
  }
  root.querySelector("[data-stop-all]")?.addEventListener("click", stopAll);
  return { get on() { return on; } };
}

// playToggle drives a play/stop button: start() returns a stop function.
export function playToggle(button, start) {
  let stop = null;
  const show = (playing) => {
    button.setAttribute("aria-pressed", String(playing));
    button.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
    button.querySelector('[data-icon="stop"]')?.toggleAttribute("hidden", !playing);
    const label = button.querySelector("[data-label]");
    if (label) {
      label.dataset.idle ??= label.textContent;
      label.textContent = playing ? "Stop" : label.dataset.idle;
    }
  };
  const halt = () => {
    if (stop) stop();
    stop = null;
    show(false);
  };
  button.addEventListener("click", () => {
    if (stop) return halt();
    stop = start();
    show(true);
  });
  return { halt, get playing() { return stop !== null; } };
}

// segValue reads the selected value of a segmented control by its aria-label.
export function segValue(root, label) {
  const list = root.querySelector(`[role="tablist"][aria-label="${label}"]`);
  return list?.querySelector('[aria-selected="true"]')?.dataset.seg;
}

// onSeg calls fn(value) when the segmented control named label changes.
export function onSeg(root, label, fn) {
  const list = root.querySelector(`[role="tablist"][aria-label="${label}"]`);
  list?.addEventListener("seg-change", (e) => {
    e.stopPropagation();
    fn(e.detail.value);
  });
}

// selectSeg marks value selected in the control named label, without
// firing seg-change.
export function selectSeg(root, label, value) {
  const list = root.querySelector(`[role="tablist"][aria-label="${label}"]`);
  for (const b of list?.querySelectorAll("[data-seg]") ?? []) b.setAttribute("aria-selected", String(b.dataset.seg === value));
}

// ============================================================ maths

// fft is an in-place radix-2 FFT on separate real and imaginary arrays.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

// spectrum returns the windowed amplitude spectrum of x (length a power
// of two), scaled so a sine of amplitude A peaks at A. Hann gives sharp
// peaks for dB views; the flat-top window reads amplitudes to within
// 0.01 dB even between bins, at the cost of wider peaks.
const FLATTOP = [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368];
export function spectrum(x, windowName = "hann") {
  const n = x.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const ph = (2 * Math.PI * i) / (n - 1);
    const w = windowName === "flattop"
      ? FLATTOP.reduce((acc, a, k) => acc + (k % 2 ? -1 : 1) * a * Math.cos(k * ph), 0)
      : 0.5 - 0.5 * Math.cos(ph);
    re[i] = x[i] * w;
    wsum += w;
  }
  fft(re, im);
  const mag = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) mag[k] = (2 * Math.hypot(re[k], im[k])) / wsum;
  return mag;
}

// peakNear is the largest bin within ±w bins of frequency f.
export function peakNear(mag, f, fs = FS, w = 2) {
  const n = mag.length * 2;
  const k = Math.round((f * n) / fs);
  let m = 0;
  for (let i = Math.max(0, k - w); i <= Math.min(mag.length - 1, k + w); i++) m = Math.max(m, mag[i]);
  return m;
}

// besselJ is Bessel's integral J_n(x) = (1/π)∫₀^π cos(nτ − x sin τ) dτ by
// the trapezoid rule, which converges very fast on this periodic integrand.
export function besselJ(n, x, steps = 400) {
  let s = 0;
  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * i) / steps;
    const w = i === 0 || i === steps ? 0.5 : 1;
    s += w * Math.cos(n * t - x * Math.sin(t));
  }
  return s / steps;
}

// ============================================================ drawing

export const stroke = (color, width = 1.5, extra = "") => `fill:none;stroke:${color};stroke-width:${width};stroke-linejoin:round;stroke-linecap:round;${extra}`;

export function path(parent, pts, style) {
  if (!pts.length) return null;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return el("path", { d, style }, parent);
}

// A log-frequency axis from lo to hi Hz across [L, L + W].
export function logAxis(lo, hi, L, W) {
  const a = Math.log10(lo), b = Math.log10(hi);
  return (f) => L + ((Math.log10(Math.max(f, lo)) - a) / (b - a)) * W;
}

export const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
export const fTick = (f) => (f >= 1000 ? `${f / 1000}k` : String(f));

// waveAt evaluates an ideal (not band-limited) classic waveform at phase p
// in cycles.
export function waveAt(type, p) {
  const f = p - Math.floor(p);
  switch (type) {
    case "square": return f < 0.5 ? 1 : -1;
    case "sawtooth": return 2 * f - 1 >= 1 ? -1 : 2 * f - 1;
    case "triangle": return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
    default: return Math.sin(2 * Math.PI * f);
  }
}

// harmonicAmp is |b_k| of each wave's Fourier series (peak amplitude 1).
export function harmonicAmp(type, k) {
  switch (type) {
    case "square": return k % 2 ? 4 / (Math.PI * k) : 0;
    case "sawtooth": return 2 / (Math.PI * k);
    case "triangle": return k % 2 ? 8 / (Math.PI * Math.PI * k * k) : 0;
    default: return k === 1 ? 1 : 0;
  }
}

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// visible runs fn(true/false) as the element enters and leaves the screen.
export function visible(elm, fn) {
  new IntersectionObserver(([e]) => fn(e.isIntersecting)).observe(elm);
}
