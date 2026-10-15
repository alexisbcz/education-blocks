// Audio engineering blocks. Every sound is synthesised here (pink noise, a
// drum loop, a clap, test tones); nothing plays until the learner turns on a
// block's "Sound on" switch, the master gain stays low, and audio stops when
// the block scrolls away or the page is hidden.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const FS = 48000;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const log10 = Math.log10;
const fmtHz = (f) => (f >= 1000 ? `${num(f / 1000, f >= 10000 ? 1 : 2)} kHz` : `${num(f, f < 100 ? 1 : 0)} Hz`);
const sgn = (v, d = 1) => (v > 0 ? "+" : "") + num(v, d);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ signals

// Pink noise by Paul Kellet's filter on white noise, peak-normalised.
function pinkNoise(n, seed = 1, peak = 0.9) {
  const rng = mulberry32(seed);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  return normalise(out, peak);
}

function normalise(x, peak) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

// One bar of 4/4 at 120 BPM: kick on 1 and 3, snare on 2 and 4, closed
// hats on the eighths. Repeated `bars` times.
function drumLoop(bars = 1, seed = 7) {
  const rng = mulberry32(seed);
  const beat = FS / 2; // 120 BPM
  const n = bars * 4 * beat;
  const x = new Float32Array(n);
  const add = (start, len, fn) => {
    for (let i = 0; i < len && start + i < n; i++) x[start + i] += fn(i / FS);
  };
  for (let b = 0; b < bars * 4; b++) {
    const t0 = b * beat;
    if (b % 2 === 0) {
      let ph = 0;
      add(t0, FS * 0.45, (t) => {
        const f = 45 + 75 * Math.exp(-t * 30);
        ph += (2 * Math.PI * f) / FS;
        return 0.95 * Math.sin(ph) * Math.exp(-t * 7);
      });
    } else {
      add(t0, FS * 0.25, (t) => 0.55 * (rng() * 2 - 1) * Math.exp(-t * 18) + 0.3 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 25));
    }
    for (const half of [0, 0.5]) {
      let prev = 0;
      add(t0 + half * beat, FS * 0.06, (t) => {
        const w = rng() * 2 - 1;
        const hp = w - prev;
        prev = w;
        return 0.18 * hp * Math.exp(-t * 70);
      });
    }
  }
  return normalise(x, 0.9);
}

// A hand clap: three quick noise bursts then a short tail.
function clap(seed = 3) {
  const rng = mulberry32(seed);
  const n = Math.round(FS * 0.35);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) * 180));
    env = Math.max(env, t >= 0.03 ? 0.5 * Math.exp(-(t - 0.03) * 22) : 0);
    x[i] = (rng() * 2 - 1) * env;
  }
  return normalise(x, 0.8);
}

// ============================================================ audio engine

let actx = null;
let master = null;
const stoppers = new Set();

function engine() {
  if (!actx) {
    actx = new AudioContext();
    master = actx.createGain();
    master.gain.value = 0.2;
    master.connect(actx.destination);
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}

function toBuffer(...channels) {
  const b = actx.createBuffer(channels.length, channels[0].length, FS);
  channels.forEach((c, i) => b.copyToChannel(c, i));
  return b;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) for (const s of [...stoppers]) s();
});

// soundSwitch wires a block's "Sound on" switch. onOn runs inside the
// click (a user gesture); onOff tears down. The switch turns itself off
// when the block leaves the viewport or the page is hidden.
function soundSwitch(root, { onOn = () => {}, onOff = () => {} } = {}) {
  const sw = root.querySelector('[data-toggle="sound"]');
  let on = false;
  const turnOff = () => {
    if (on) sw.click();
  };
  sw.addEventListener("shadcn:checked-change", (e) => {
    on = e.detail.checked;
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
  return { get on() { return on; } };
}

// A looping buffer source connected through `chain` (an array of nodes).
function loopThrough(buffer, firstNode) {
  const src = actx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(firstNode);
  src.start();
  return src;
}

function playOnce(buffer, dest) {
  const src = actx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  src.start();
  return src;
}

// Log-frequency axis helpers, 20 Hz to 20 kHz.
const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const fTick = (lf) => {
  const f = 10 ** lf;
  return f >= 1000 ? `${Math.round(f / 1000)}k` : String(Math.round(f));
};
const logSweep = (n = 240, lo = 20, hi = 20000) =>
  Float32Array.from({ length: n }, (_, i) => lo * (hi / lo) ** (i / (n - 1)));

// ============================================================ 1. decibels

for (const root of document.querySelectorAll("[data-aud-db]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const levels = ["l1", "l2", "l3"].map((k) => s[k].get()).filter((v) => v > 0);
    const sum = levels.length ? 10 * log10(levels.reduce((a, l) => a + 10 ** (l / 10), 0)) : 0;
    o.sum.textContent = levels.length ? `${num(sum, 2)} dB SPL (${levels.length} source${levels.length > 1 ? "s" : ""})` : "—";
    const ref = s.ref.get(), d = s.dist.get();
    const at = ref - 20 * log10(d);
    o.atdist.textContent = `${num(at, 2)} dB SPL (${sgn(-20 * log10(d), 2)} dB)`;
    const v = s.volts.get();
    o.volt.textContent = `${num(db(v), 2)} dBV · ${num(db(v / Math.sqrt(0.6)), 2)} dBu`;
    o.fs.textContent = `${num(db(s.sample.get()), 2)} dBFS`;

    svg.replaceChildren();
    const lo = ref - 60, hi = ref + 20;
    const f = frame(svg, {
      box: [48, 14, 494, 250], x: [-1, 2], y: [lo, hi],
      xticks: [-1, 0, 1, 2], yticks: [lo, lo + 20, lo + 40, lo + 60, hi].map((v) => Math.round(v)),
      xfmt: (lx) => `${10 ** lx} m`, xlabel: "distance (log)", ylabel: "dB SPL",
    });
    const pts = Array.from({ length: 120 }, (_, i) => {
      const lx = -1 + (3 * i) / 119;
      return [f.sx(lx), f.sy(ref - 20 * lx)];
    });
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    for (let k = -3; k <= 6; k++) {
      const dd = 2 ** k;
      if (log10(dd) < -1 || log10(dd) > 2) continue;
      el("line", { x1: f.sx(log10(dd)), x2: f.sx(log10(dd)), y1: f.sy(ref - 20 * log10(dd)), y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    }
    const ld = Math.min(2, Math.max(-1, log10(d)));
    el("circle", { cx: f.sx(ld), cy: f.sy(at), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(ld) + 8, f.sy(at) - 8, `${num(at, 1)} dB`, { class: "fill-foreground font-mono text-[11px]" });
  }
  draw();
}

// ============================================================ 2. weighting

// IEC 61672-1 weighting curves, in dB.
function aWeight(f) {
  const f2 = f * f;
  const r = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * log10(r) + 2.0;
}
function cWeight(f) {
  const f2 = f * f;
  const r = (12194 ** 2 * f2) / ((f2 + 20.6 ** 2) * (f2 + 12194 ** 2));
  return 20 * log10(r) + 0.06;
}

for (const root of document.querySelectorAll("[data-aud-weighting]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const bands = [["b63", 62.5], ["b125", 125], ["b250", 250], ["b500", 500], ["b1k", 1000], ["b2k", 2000], ["b4k", 4000], ["b8k", 8000]];
  const s = scrubAll(root, draw);

  function draw() {
    const lv = bands.map(([k, fc]) => ({ fc, L: s[k].get() }));
    const sumDb = (fn) => 10 * log10(lv.reduce((a, b) => a + 10 ** ((b.L + fn(b.fc)) / 10), 0));
    o.lin.textContent = `${num(sumDb(() => 0), 1)} dB`;
    o.dba.textContent = `${num(sumDb(aWeight), 1)} dB(A)`;
    o.dbc.textContent = `${num(sumDb(cWeight), 1)} dB(C)`;

    svg.replaceChildren();
    const f = frame(svg, {
      box: [44, 14, 498, 250], x: [log10(20), log10(20000)], y: [-50, 10],
      xticks: FREQ_TICKS.map(log10), yticks: [-50, -40, -30, -20, -10, 0, 10], xfmt: fTick, xlabel: "Hz", ylabel: "dB",
    });
    const fr = logSweep(240, 20, 20000);
    polyline(svg, [...fr].map((x) => [f.sx(log10(x)), f.sy(Math.max(-50, cWeight(x)))]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, [...fr].map((x) => [f.sx(log10(x)), f.sy(Math.max(-50, aWeight(x)))]), "stroke:var(--brand);stroke-width:2");
    // Each band's level relative to the loudest band, after A-weighting.
    const top = Math.max(...lv.map((b) => b.L));
    for (const b of lv) {
      const rel = b.L - top + aWeight(b.fc);
      const y = Math.max(-50, Math.min(10, rel));
      el("rect", { x: f.sx(log10(b.fc)) - 7, y: f.sy(Math.max(0, y)), width: 14, height: Math.abs(f.sy(y) - f.sy(0)), rx: 2, style: "fill:var(--foreground);fill-opacity:0.18" }, svg);
      el("circle", { cx: f.sx(log10(b.fc)), cy: f.sy(y), r: 3, style: "fill:var(--foreground)" }, svg);
    }
    text(svg, f.L + 6, f.sy(0) - 6, "bars: band level − loudest band + A", { class: "fill-muted-foreground font-mono text-[10px]" });
  }
  draw();
}

// ============================================================ 3. EQ

for (const root of document.querySelectorAll("[data-aud-eq]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  // An offline context computes responses without needing a user gesture.
  const off = new OfflineAudioContext(1, 128, FS);
  const mk = (c, type) => Object.assign(c.createBiquadFilter(), { type });
  const ref = [mk(off, "lowshelf"), mk(off, "peaking"), mk(off, "highshelf")];
  let live = null; // { src, filters, out }
  let bypass = false;
  const s = scrubAll(root, draw);

  const params = () => [
    { f: s.lsf.get(), g: s.lsg.get(), q: 1 },
    { f: s.pkf.get(), g: s.pkg.get(), q: s.pkq.get() },
    { f: s.hsf.get(), g: s.hsg.get(), q: 1 },
  ];
  const apply = (filters, t) => params().forEach((p, i) => {
    const flt = filters[i];
    if (t !== undefined) {
      flt.frequency.setTargetAtTime(p.f, t, 0.02);
      flt.gain.setTargetAtTime(p.g, t, 0.02);
      flt.Q.setTargetAtTime(p.q, t, 0.02);
    } else {
      flt.frequency.value = p.f;
      flt.gain.value = p.g;
      flt.Q.value = p.q;
    }
  });

  function draw() {
    apply(ref);
    if (live) apply(live.filters, actx.currentTime);
    const fr = logSweep(300, 20, 20000);
    const mag = new Float32Array(fr.length), ph = new Float32Array(fr.length);
    const bandsDb = ref.map((flt) => {
      flt.getFrequencyResponse(fr, mag, ph);
      return Array.from(mag, db);
    });
    const total = Array.from(fr, (_, i) => bandsDb.reduce((a, b) => a + b[i], 0));

    svg.replaceChildren();
    const f = frame(svg, {
      box: [40, 14, 502, 310], x: [log10(20), log10(20000)], y: [-18, 18],
      xticks: FREQ_TICKS.map(log10), yticks: [-18, -12, -6, 0, 6, 12, 18], xfmt: fTick, xlabel: "Hz", ylabel: "dB",
      yfmt: (v) => (v > 0 ? "+" : "") + String(v).replace("-", "−"),
    });
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    for (const b of bandsDb) polyline(svg, b.map((v, i) => [f.sx(log10(fr[i])), f.sy(v)]), "stroke:var(--vec-u);stroke-width:1;stroke-dasharray:4 3;stroke-opacity:0.8");
    polyline(svg, total.map((v, i) => [f.sx(log10(fr[i])), f.sy(Math.max(-18, Math.min(18, v)))]), `stroke:var(--brand);stroke-width:2.25;${bypass ? "stroke-opacity:0.35" : ""}`);
    // Each band's handle sits on its own curve at its frequency (a shelf is
    // at half its gain there).
    const one = new Float32Array(1), m1 = new Float32Array(1), p1 = new Float32Array(1);
    params().forEach((p, i) => {
      one[0] = p.f;
      ref[i].getFrequencyResponse(one, m1, p1);
      el("circle", { cx: f.sx(log10(p.f)), cy: f.sy(Math.max(-18, Math.min(18, db(m1[0])))), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    });
    if (bypass) text(svg, f.L + f.W - 4, f.T + 12, "bypassed", { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[11px]" });

    one[0] = 1000;
    const at1k = ref.reduce((a, flt) => { flt.getFrequencyResponse(one, m1, p1); return a + db(m1[0]); }, 0);
    const mx = Math.max(...total), mn = Math.min(...total);
    o.at1k.textContent = `${sgn(at1k, 2)} dB`;
    o.max.textContent = `${sgn(mx, 1)} dB at ${fmtHz(fr[total.indexOf(mx)])}`;
    o.min.textContent = `${sgn(mn, 1)} dB at ${fmtHz(fr[total.indexOf(mn)])}`;
  }

  const wire = () => {
    if (!live) return;
    live.src.disconnect();
    live.src.connect(bypass ? live.out : live.filters[0]);
  };
  soundSwitch(root, {
    onOn() {
      const filters = [mk(actx, "lowshelf"), mk(actx, "peaking"), mk(actx, "highshelf")];
      apply(filters);
      const out = actx.createGain();
      out.gain.value = 0.8;
      filters[0].connect(filters[1]).connect(filters[2]).connect(out).connect(master);
      const src = loopThrough(toBuffer(pinkNoise(FS * 4, 11, 0.7)), filters[0]);
      live = { src, filters, out };
      wire();
    },
    onOff() {
      if (!live) return;
      live.src.stop();
      live.out.disconnect();
      live = null;
    },
  });
  root.querySelector('[data-toggle="bypass"]').addEventListener("shadcn:checked-change", (e) => {
    bypass = e.detail.checked;
    wire();
    draw();
  });
  draw();
}

// ============================================================ 4. compressor

// Static curve with a soft knee (Giannoulis, Massberg & Reiss 2012).
function compGain(xg, T, R, W) {
  if (2 * (xg - T) < -W) return xg;
  if (W > 0 && 2 * Math.abs(xg - T) <= W) return xg + ((1 / R - 1) * (xg - T + W / 2) ** 2) / (2 * W);
  return T + (xg - T) / R;
}

function compress(x, { T, R, W, att, rel, makeup }) {
  const y = new Float32Array(x.length), gr = new Float32Array(x.length);
  const aA = Math.exp(-1 / ((att / 1000) * FS)), aR = Math.exp(-1 / ((rel / 1000) * FS));
  let gs = 0;
  for (let i = 0; i < x.length; i++) {
    const xg = db(Math.abs(x[i]));
    const gc = compGain(xg, T, R, W) - xg; // ≤ 0
    gs = gc < gs ? aA * gs + (1 - aA) * gc : aR * gs + (1 - aR) * gc;
    gr[i] = gs;
    y[i] = x[i] * 10 ** ((gs + makeup) / 20);
  }
  return { y, gr };
}

const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rmsOf = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);

for (const root of document.querySelectorAll("[data-aud-comp]")) {
  const curveSvg = root.querySelector("[data-curve]");
  const traceSvg = root.querySelector("[data-trace]");
  const o = outs(root);
  const dry = drumLoop(1, 7);
  let wet = dry;
  const buttons = [...root.querySelectorAll("[data-action]")];
  const s = scrubAll(root, draw);
  const sound = soundSwitch(root, {
    onOn: () => buttons.forEach((b) => (b.disabled = false)),
    onOff: () => buttons.forEach((b) => (b.disabled = true)),
  });

  function draw() {
    const p = { T: s.thr.get(), R: s.ratio.get(), W: s.knee.get(), att: s.att.get(), rel: s.rel.get(), makeup: s.makeup.get() };
    const { y, gr } = compress(dry, p);
    wet = y;

    curveSvg.replaceChildren();
    const c = frame(curveSvg, { box: [36, 12, 212, 212], x: [-60, 0], y: [-60, 6], xticks: [-60, -40, -20, 0], yticks: [-60, -40, -20, 0], xlabel: "in dBFS", ylabel: "out", xfmt: (v) => String(v).replace("-", "−"), yfmt: (v) => String(v).replace("-", "−") });
    polyline(curveSvg, [[c.sx(-60), c.sy(-60)], [c.sx(0), c.sy(0)]], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3");
    if (p.W > 0) el("rect", { x: c.sx(Math.max(-60, p.T - p.W / 2)), y: c.T, width: c.sx(Math.min(0, p.T + p.W / 2)) - c.sx(Math.max(-60, p.T - p.W / 2)), height: c.H, style: "fill:var(--brand);fill-opacity:0.07" }, curveSvg);
    el("line", { x1: c.sx(p.T), x2: c.sx(p.T), y1: c.T, y2: c.T + c.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:2 3" }, curveSvg);
    const curve = Array.from({ length: 121 }, (_, i) => {
      const xg = -60 + i / 2;
      return [c.sx(xg), c.sy(Math.min(6, compGain(xg, p.T, p.R, p.W) + p.makeup))];
    });
    polyline(curveSvg, curve, "stroke:var(--brand);stroke-width:2.25");
    text(curveSvg, c.sx(p.T) + 4, c.T + 10, `T ${num(p.T, 1)}`, { class: "fill-muted-foreground font-mono text-[10px]" });

    traceSvg.replaceChildren();
    const t = frame(traceSvg, { box: [36, 12, 312, 212], x: [0, dry.length / FS], y: [-60, 0], xticks: [0, 0.5, 1, 1.5, 2], yticks: [-60, -40, -20, 0], xlabel: "s", ylabel: "dB", yfmt: (v) => String(v).replace("-", "−") });
    const win = Math.round(FS * 0.005);
    const peaks = [], grs = [];
    for (let i = 0; i < dry.length; i += win) {
      let m = 0, g = 0;
      for (let k = i; k < Math.min(dry.length, i + win); k++) {
        m = Math.max(m, Math.abs(dry[k]));
        g = Math.min(g, gr[k]);
      }
      peaks.push([t.sx(i / FS), t.sy(Math.max(-60, db(m)))]);
      grs.push([t.sx(i / FS), t.sy(Math.max(-60, g))]);
    }
    polyline(traceSvg, peaks, "stroke:var(--foreground);stroke-width:1;stroke-opacity:0.7");
    polyline(traceSvg, grs, "stroke:var(--brand);stroke-width:2");
    hline(traceSvg, t, p.T, "stroke:var(--brand);stroke-opacity:0.35;stroke-dasharray:2 3", "threshold");

    const maxGr = gr.reduce((m, v) => Math.min(m, v), 0);
    const crest = (x) => db(peakOf(x) / rmsOf(x));
    o.maxgr.textContent = `${num(maxGr, 1)} dB`;
    o.crest.textContent = `${num(crest(dry), 1)} → ${num(crest(y), 1)} dB`;
    o.peak.textContent = `${num(db(peakOf(dry)), 1)} → ${num(db(peakOf(y)), 1)} dBFS${peakOf(y) > 1 ? " · clips: lower make-up" : ""}`;
  }

  let current = null;
  for (const b of buttons) {
    b.addEventListener("click", () => {
      if (!sound.on) return;
      current?.stop();
      // Play two passes so the release behaviour is audible.
      const two = new Float32Array((b.dataset.action === "wet" ? wet : dry).length * 2);
      two.set(b.dataset.action === "wet" ? wet : dry);
      two.set(b.dataset.action === "wet" ? wet : dry, two.length / 2);
      current = playOnce(toBuffer(two), master);
    });
  }
  draw();
}

// ============================================================ 5. reverb

const MATERIALS = [
  ["concrete", "Painted concrete", 0.02],
  ["glass", "Window glass", 0.18],
  ["plaster", "Plaster on brick", 0.02],
  ["gypsum", "Gypsum board", 0.05],
  ["wood", "Wood floor", 0.1],
  ["carpet", "Carpet on pad", 0.57],
  ["curtain", "Heavy curtains", 0.55],
  ["tile", "Acoustic ceiling tile", 0.7],
];

for (const root of document.querySelectorAll("[data-aud-reverb]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const holder = root.querySelector("[data-surfaces]");
  const surfaces = [["floor", "Floor", "wood"], ["ceiling", "Ceiling", "tile"], ["walls", "Walls", "gypsum"]];
  const selects = {};
  for (const [key, label, def] of surfaces) {
    const row = document.createElement("label");
    row.className = "flex items-center justify-between gap-2";
    const span = document.createElement("span");
    span.className = "text-muted-foreground";
    span.textContent = label;
    const sel = document.createElement("select");
    sel.className = "h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
    for (const [id, name, a] of MATERIALS) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${name} (${a})`;
      opt.selected = id === def;
      sel.append(opt);
    }
    sel.addEventListener("change", draw);
    row.append(span, sel);
    holder.append(row);
    selects[key] = sel;
  }
  const alpha = (sel) => MATERIALS.find((m) => m[0] === sel.value)[2];
  const dryClap = clap(3);
  let rt = 1;
  const buttons = [...root.querySelectorAll("[data-action]")];
  const s = scrubAll(root, draw);
  const sound = soundSwitch(root, {
    onOn: () => buttons.forEach((b) => (b.disabled = false)),
    onOff: () => buttons.forEach((b) => (b.disabled = true)),
  });

  // A synthetic impulse response: decorrelated noise in each ear under an
  // exponential that falls 60 dB at RT60, after a 10 ms gap.
  function impulse(rt60) {
    const len = Math.round(FS * Math.min(6, rt60 * 1.2 + 0.05));
    const chans = [mulberry32(21), mulberry32(22)].map((rng) => {
      const x = new Float32Array(len);
      const pre = Math.round(FS * 0.01);
      for (let i = pre; i < len; i++) x[i] = (rng() * 2 - 1) * Math.exp((-6.9078 * (i - pre)) / (rt60 * FS));
      return x;
    });
    return chans;
  }

  function draw() {
    const L = s.len.get(), W = s.wid.get(), H = s.hei.get();
    const V = L * W * H;
    const A = L * W * alpha(selects.floor) + L * W * alpha(selects.ceiling) + 2 * (L + W) * H * alpha(selects.walls);
    rt = (0.161 * V) / A;
    o.vol.textContent = `${num(V, 1)} m³ · ${num(2 * (L * W + L * H + W * H), 1)} m² of surface`;
    o.abs.textContent = `${num(A, 1)} m² sabins`;
    o.rt.textContent = `${num(rt, 2)} s`;

    svg.replaceChildren();
    const tMax = Math.max(0.5, Math.min(6, rt * 1.3));
    const f = frame(svg, { box: [40, 14, 502, 230], x: [0, tMax], y: [-80, 0], yticks: [-80, -60, -40, -20, 0], xticks: niceTicks(tMax), xlabel: "s", ylabel: "dB", yfmt: (v) => String(v).replace("-", "−") });
    const [ir] = impulse(rt);
    const win = Math.round(FS * 0.01);
    const pts = [];
    for (let i = 0; i < ir.length && i / FS <= tMax; i += win) {
      let e = 0;
      for (let k = i; k < Math.min(ir.length, i + win); k++) e += ir[k] * ir[k];
      pts.push([f.sx(i / FS), f.sy(Math.max(-80, 10 * log10(e / win) + 4.8))]);
    }
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.25;stroke-opacity:0.8");
    hline(svg, f, -60, "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:3 3");
    if (rt <= tMax) {
      el("line", { x1: f.sx(rt), x2: f.sx(rt), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
      text(svg, f.sx(rt) + 5, f.sy(-60) - 6, `RT60 ${num(rt, 2)} s`, { class: "fill-foreground font-mono text-[11px]" });
    }
  }

  let current = [];
  for (const b of buttons) {
    b.addEventListener("click", () => {
      if (!sound.on) return;
      current.forEach((n) => n.stop());
      if (b.dataset.action === "dry") {
        current = [playOnce(toBuffer(dryClap), master)];
        return;
      }
      const conv = actx.createConvolver();
      conv.buffer = toBuffer(...impulse(rt));
      const wetGain = actx.createGain();
      wetGain.gain.value = 0.6;
      conv.connect(wetGain).connect(master);
      const buf = toBuffer(dryClap);
      current = [playOnce(buf, master), playOnce(buf, conv)];
    });
  }
  draw();
}

function niceTicks(max) {
  const step = max > 4 ? 1 : max > 2 ? 0.5 : max > 1 ? 0.25 : 0.1;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

// ============================================================ 6. panning

const PAN_LAWS = {
  power: (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)],
  linear: (p) => [(1 - p) / 2, (1 + p) / 2],
  compromise: (p) => {
    const [a, b] = PAN_LAWS.power(p), [c, d] = PAN_LAWS.linear(p);
    return [Math.sqrt(a * c), Math.sqrt(b * d)];
  },
};

for (const root of document.querySelectorAll("[data-aud-pan]")) {
  const svg = root.querySelector("[data-plot]");
  const gonio = root.querySelector("[data-gonio]");
  const o = outs(root);
  let law = "power";
  let live = null;
  const a = pinkNoise(FS * 2, 31, 0.9), b = pinkNoise(FS * 2, 32, 0.9);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    law = e.detail.value;
    draw();
  });

  function draw() {
    const p = s.pan.get();
    const [gL, gR] = PAN_LAWS[law](p);
    o.gains.textContent = `${num(db(gL), 1)} / ${num(db(gR), 1)} dB`;
    const pw = gL * gL + gR * gR;
    o.power.textContent = `${num(10 * log10(pw), 2)} dB`;
    if (live) {
      live.l.gain.setTargetAtTime(gL, actx.currentTime, 0.02);
      live.r.gain.setTargetAtTime(gR, actx.currentTime, 0.02);
    }

    svg.replaceChildren();
    const f = frame(svg, { box: [36, 12, 292, 212], x: [-1, 1], y: [0, 1.2], xticks: [-1, -0.5, 0, 0.5, 1], yticks: [0, 0.5, 1], xfmt: (v) => (v === -1 ? "L" : v === 1 ? "R" : v === 0 ? "C" : ""), ylabel: "gain" });
    const xs = Array.from({ length: 101 }, (_, i) => -1 + i / 50);
    const g = xs.map((x) => PAN_LAWS[law](x));
    polyline(svg, xs.map((x, i) => [f.sx(x), f.sy(g[i][0])]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, xs.map((x, i) => [f.sx(x), f.sy(g[i][1])]), "stroke:var(--ion-cl);stroke-width:1.75");
    polyline(svg, xs.map((x, i) => [f.sx(x), f.sy(g[i][0] ** 2 + g[i][1] ** 2)]), "stroke:var(--brand);stroke-width:2.25");
    el("line", { x1: f.sx(p), x2: f.sx(p), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(p), cy: f.sy(pw), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);

    // Mid/side on a correlated stereo pair, shown on a goniometer.
    const c = s.corr.get(), w = s.width.get();
    const n = 1500;
    let sxy = 0, sxx = 0, syy = 0;
    gonio.replaceChildren();
    const R = 110, cx = 130, cy = 130;
    el("circle", { cx, cy, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:0.12" }, gonio);
    el("line", { x1: cx, x2: cx, y1: cy - R, y2: cy + R, style: "stroke:currentColor;stroke-opacity:0.12" }, gonio);
    el("line", { x1: cx - R, x2: cx + R, y1: cy, y2: cy, style: "stroke:currentColor;stroke-opacity:0.12" }, gonio);
    text(gonio, cx, cy - R - 4, "M (mono)", { "text-anchor": "middle" });
    text(gonio, cx + R - 2, cy - 4, "S", { "text-anchor": "end" });
    let d = "";
    for (let i = 0; i < n; i++) {
      const k = i * 31;
      const L = a[k], Rr = c * a[k] + Math.sqrt(1 - c * c) * b[k];
      const M = (L + Rr) / 2, S = (L - Rr) / 2;
      const L2 = M + w * S, R2 = M - w * S;
      sxy += L2 * R2; sxx += L2 * L2; syy += R2 * R2;
      const x = ((L2 - R2) / Math.SQRT2) * R * 0.9, y = ((L2 + R2) / Math.SQRT2) * R * 0.9;
      d += `M${(cx + x).toFixed(1)} ${(cy - y).toFixed(1)}h0.01`;
    }
    el("path", { d, style: "stroke:var(--brand);stroke-width:2;stroke-linecap:round;stroke-opacity:0.5" }, gonio);
    o.corr.textContent = num(sxy / Math.sqrt(sxx * syy), 2);
  }

  soundSwitch(root, {
    onOn() {
      const merger = actx.createChannelMerger(2);
      const l = actx.createGain(), r = actx.createGain();
      const src = actx.createBufferSource();
      src.buffer = toBuffer(a);
      src.loop = true;
      src.connect(l).connect(merger, 0, 0);
      src.connect(r).connect(merger, 0, 1);
      merger.connect(master);
      src.start();
      live = { src, l, r, merger };
      draw();
    },
    onOff() {
      if (!live) return;
      live.src.stop();
      live.merger.disconnect();
      live = null;
    },
  });
  draw();
}

// ============================================================ 7. microphones

const PATTERNS = [
  ["omni", "Omni", 1, 0, "var(--foreground)"],
  ["sub", "Subcardioid", 0.7, 0.3, "var(--ion-cl)"],
  ["cardioid", "Cardioid", 0.5, 0.5, "var(--brand)"],
  ["super", "Supercardioid", 0.37, 0.63, "var(--vec-u)"],
  ["hyper", "Hypercardioid", 0.25, 0.75, "var(--vec-out)"],
  ["fig8", "Figure-8", 0, 1, "var(--ion-k)"],
];

for (const root of document.querySelectorAll("[data-aud-mic]")) {
  const svg = root.querySelector("[data-plot]");
  const chips = root.querySelector("[data-patterns]");
  const table = root.querySelector("[data-table]");
  const shown = new Set(["omni", "cardioid", "super", "fig8"]);
  for (const [id, name, , , color] of PATTERNS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:text-foreground";
    b.setAttribute("aria-pressed", String(shown.has(id)));
    const dot = document.createElement("span");
    dot.className = "size-2 rounded-full";
    dot.style.background = color;
    b.append(dot, document.createTextNode(name));
    b.addEventListener("click", () => {
      shown.has(id) ? shown.delete(id) : shown.add(id);
      b.setAttribute("aria-pressed", String(shown.has(id)));
      draw();
    });
    chips.append(b);
  }
  const s = scrubAll(root, draw);
  const RAD = 120, RANGE = 30; // dB polar: 0 dB at the rim, −30 dB at the centre
  const rOf = (g) => RAD * Math.max(0, 1 + db(Math.abs(g)) / RANGE);

  function draw() {
    const th = (s.angle.get() * Math.PI) / 180;
    svg.replaceChildren();
    for (const ring of [0, -6, -12, -18, -24]) {
      el("circle", { cx: 0, cy: 0, r: RAD * (1 + ring / RANGE), style: "fill:none;stroke:currentColor;stroke-opacity:0.1" }, svg);
      text(svg, 3, -RAD * (1 + ring / RANGE) + 10, `${ring}`.replace("-", "−"), { class: "fill-muted-foreground font-mono text-[9px]" });
    }
    for (let a = 0; a < 360; a += 30) {
      const r = (a * Math.PI) / 180;
      el("line", { x1: 0, y1: 0, x2: RAD * Math.sin(r), y2: -RAD * Math.cos(r), style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
    }
    text(svg, 0, -RAD - 6, "0° front", { "text-anchor": "middle" });
    for (const [id, , A, B, color] of PATTERNS) {
      if (!shown.has(id)) continue;
      let pos = "", neg = "";
      for (let i = 0; i <= 360; i++) {
        const a = (i * Math.PI) / 180;
        const g = A + B * Math.cos(a);
        const r = rOf(g);
        const pt = `${(r * Math.sin(a)).toFixed(1)},${(-r * Math.cos(a)).toFixed(1)}`;
        if (g >= 0) pos += (pos ? " L" : "M") + pt;
        else neg += (neg ? " L" : "M") + pt;
      }
      el("path", { d: pos, style: `fill:none;stroke:${color};stroke-width:2` }, svg);
      if (neg) el("path", { d: neg, style: `fill:none;stroke:${color};stroke-width:1.5;stroke-dasharray:4 3` }, svg);
    }
    // The source.
    const sx = (RAD + 14) * Math.sin(th), sy = -(RAD + 14) * Math.cos(th);
    el("line", { x1: 0, y1: 0, x2: sx, y2: sy, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: sx, cy: sy, r: 6, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
    el("rect", { x: -5, y: -9, width: 10, height: 18, rx: 4, style: "fill:var(--background);stroke:currentColor;stroke-width:1.5" }, svg);

    // The table, built with textContent.
    table.replaceChildren();
    const t = document.createElement("table");
    t.className = "w-full min-w-[420px] font-mono text-xs";
    const head = t.createTHead().insertRow();
    for (const hd of ["pattern", `at ${Math.round((th * 180) / Math.PI)}°`, "90°", "180°", "null", "DI"]) {
      const c = document.createElement("th");
      c.className = "py-1 pr-3 text-left font-normal text-muted-foreground";
      c.textContent = hd;
      head.append(c);
    }
    const body = t.createTBody();
    for (const [id, name, A, B] of PATTERNS) {
      const r = body.insertRow();
      r.className = shown.has(id) ? "" : "opacity-50";
      const at = (a) => {
        const g = Math.abs(A + B * Math.cos(a));
        return g < 1e-6 ? "−∞" : `${num(db(g), 1)}`;
      };
      const nul = B > 0 && A / B <= 1 ? `${num((Math.acos(-A / B) * 180) / Math.PI, 1)}°` : "none";
      const di = -10 * log10(A * A + (B * B) / 3);
      for (const v of [name, at(th) + " dB", at(Math.PI / 2), at(Math.PI), nul, `${num(di, 2)} dB`]) {
        const c = r.insertCell();
        c.className = "py-1 pr-3 tabular-nums";
        c.textContent = v;
      }
    }
    table.append(t);
  }

  // Drag or arrow keys on the plot set the source angle (0–180°, the
  // patterns are symmetric).
  svg.setAttribute("tabindex", "0");
  svg.classList.add("cursor-crosshair", "outline-none", "touch-none");
  const fromPointer = (e) => {
    const r = svg.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    s.angle.set(Math.round(Math.abs((Math.atan2(x, -y) * 180) / Math.PI)));
  };
  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (svg.hasPointerCapture(e.pointerId)) fromPointer(e);
  });
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -5, ArrowRight: 5, ArrowUp: 5, ArrowDown: -5 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    s.angle.set(Math.min(180, Math.max(0, s.angle.get() + d)));
  });
  draw();
}

// ============================================================ 8. comb filter

for (const root of document.querySelectorAll("[data-aud-comb]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let align = false;
  let live = null;
  const s = scrubAll(root, draw);

  const model = () => {
    const d1 = s.d1.get(), d2 = Math.max(s.d2.get(), d1);
    const c = 331.3 * Math.sqrt(1 + s.temp.get() / 273.15);
    const tau = align ? 0 : (d2 - d1) / c;
    return { d1, d2, c, tau, g: d1 / d2 };
  };

  function draw() {
    const { d1, d2, c, tau, g } = model();
    if (live) {
      live.delay.delayTime.setValueAtTime(tau, actx.currentTime);
      live.far.gain.setValueAtTime(g, actx.currentTime);
    }
    const fr = logSweep(600, 20, 20000);
    const H = (f) => {
      const w = 2 * Math.PI * f * tau;
      return db(Math.hypot(1 + g * Math.cos(w), g * Math.sin(w)));
    };
    svg.replaceChildren();
    const f = frame(svg, {
      box: [40, 14, 502, 220], x: [log10(20), log10(20000)], y: [-30, 9],
      xticks: FREQ_TICKS.map(log10), yticks: [-30, -20, -10, 0, 6], xfmt: fTick, xlabel: "Hz", ylabel: "dB",
      yfmt: (v) => (v > 0 ? "+" : "") + String(v).replace("-", "−"),
    });
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.25");
    if (tau > 0) {
      for (let k = 0; ; k++) {
        const fn = (2 * k + 1) / (2 * tau);
        if (fn > 20000 || k > 60) break;
        if (fn < 20) continue;
        el("line", { x1: f.sx(log10(fn)), x2: f.sx(log10(fn)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-opacity:0.25" }, svg);
      }
    }
    polyline(svg, [...fr].map((x) => [f.sx(log10(x)), f.sy(Math.max(-30, H(x)))]), "stroke:var(--brand);stroke-width:1.75");

    o.delay.textContent = tau > 0 ? `${num(tau * 1000, 3)} ms (Δd ${num(d2 - d1, 2)} m, c ${num(c, 1)} m/s)` : "0 ms (aligned)";
    o.notch.textContent = tau > 0 ? `${fmtHz(1 / (2 * tau))}, then every ${fmtHz(1 / tau)}` : "none";
    o.depth.textContent = tau > 0 ? `${sgn(db(1 + g), 1)} / ${num(db(1 - g), 1)} dB` : `${sgn(db(1 + g), 1)} dB, flat`;
    o.rule.textContent = d2 / d1 >= 3 ? `met (${num(d2 / d1, 1)}:1)` : `not met (${num(d2 / d1, 1)}:1)`;
  }

  root.querySelector('[data-toggle="align"]').addEventListener("shadcn:checked-change", (e) => {
    align = e.detail.checked;
    draw();
  });
  soundSwitch(root, {
    onOn() {
      const { tau, g } = model();
      const sum = actx.createGain();
      sum.gain.value = 0.5;
      const near = actx.createGain();
      const far = actx.createGain();
      far.gain.value = g;
      const delay = actx.createDelay(0.1);
      delay.delayTime.value = tau;
      near.connect(sum);
      delay.connect(far).connect(sum);
      sum.connect(master);
      const src = actx.createBufferSource();
      src.buffer = toBuffer(pinkNoise(FS * 4, 41, 0.7));
      src.loop = true;
      src.connect(near);
      src.connect(delay);
      src.start();
      live = { src, sum, delay, far };
    },
    onOff() {
      if (!live) return;
      live.src.stop();
      live.sum.disconnect();
      live = null;
    },
  });
  draw();
}

// ============================================================ 9. loudness

// ITU-R BS.1770 K-weighting at 48 kHz: a high-shelf pre-filter, then the
// RLB high-pass. Direct form I biquads.
const K1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] };
const K2 = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] };

function biquad(x, { b, a }) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

function loudness(x) {
  const k = biquad(biquad(x, K1), K2);
  const block = Math.round(0.4 * FS), hop = Math.round(0.1 * FS);
  const z = [];
  for (let s = 0; s + block <= k.length; s += hop) {
    let e = 0;
    for (let i = s; i < s + block; i++) e += k[i] * k[i];
    z.push(e / block);
  }
  const lj = z.map((v) => -0.691 + 10 * log10(Math.max(v, 1e-20)));
  const abs = z.filter((_, j) => lj[j] > -70);
  if (!abs.length) return { lufs: -Infinity, lj, rel: -Infinity };
  const rel = -0.691 + 10 * log10(abs.reduce((a, v) => a + v, 0) / abs.length) - 10;
  const gated = z.filter((_, j) => lj[j] > -70 && lj[j] > rel);
  const lufs = -0.691 + 10 * log10(gated.reduce((a, v) => a + v, 0) / gated.length);
  return { lufs, lj, rel };
}

// True peak: 4× oversampling with a windowed-sinc interpolator (Hann
// window, 12 taps per phase each side).
function truePeak(x) {
  const N = 4, half = 12;
  const taps = [];
  for (let p = 0; p < N; p++) {
    const t = [];
    for (let k = -half + 1; k <= half; k++) {
      const u = k - p / N;
      const sinc = u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * u) / half);
      t.push(sinc * w);
    }
    taps.push(t);
  }
  let m = 0;
  for (let i = half; i < x.length - half; i++) {
    for (let p = 0; p < N; p++) {
      const t = taps[p];
      let v = 0;
      for (let j = 0; j < t.length; j++) v += t[j] * x[i + j - half + 1];
      if (Math.abs(v) > m) m = Math.abs(v);
    }
  }
  return m;
}

for (const root of document.querySelectorAll("[data-aud-loud]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const playBtn = root.querySelector('[data-action="play"]');
  const SECS = 8;
  const base = {
    sine: Float32Array.from({ length: FS * SECS }, (_, i) => Math.sin((2 * Math.PI * 997 * i) / FS)),
    pink: pinkNoise(FS * SECS, 51, 0.9),
    drums: (() => { const one = drumLoop(1, 7); const x = new Float32Array(FS * SECS); for (let i = 0; i < x.length; i++) x[i] = one[i % one.length]; return x; })(),
    mix: (() => { const p = pinkNoise(FS * SECS, 52, 0.9); for (let i = 0; i < p.length / 2; i++) p[i] *= 10 ** (-30 / 20); return p; })(),
  };
  let kind = "sine";
  let signal = base.sine;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    kind = e.detail.value;
    draw();
  });
  const sound = soundSwitch(root, {
    onOn: () => (playBtn.disabled = false),
    onOff: () => {
      playBtn.disabled = true;
      current?.stop();
    },
  });
  let current = null;
  playBtn.addEventListener("click", () => {
    if (!sound.on) return;
    current?.stop();
    current = playOnce(toBuffer(signal), master);
  });

  function draw() {
    const g = 10 ** (s.gain.get() / 20);
    signal = base[kind].map((v) => v * g);
    const { lufs, lj, rel } = loudness(signal);
    const sp = peakOf(signal), tp = truePeak(signal);
    o.lufs.textContent = Number.isFinite(lufs) ? `${num(lufs, 2)} LUFS` : "below the −70 gate";
    o.peak.textContent = `${num(db(sp), 2)} dBFS`;
    o.tp.textContent = `${num(db(tp), 2)} dBTP${tp > 1 ? " · over" : ""}`;
    o.rms.textContent = `${num(db(rmsOf(signal)), 2)} dBFS`;
    o.plr.textContent = Number.isFinite(lufs) ? `${num(db(tp) - lufs, 1)} LU` : "—";

    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 498, 220], x: [0, SECS], y: [-70, 0], xticks: [0, 2, 4, 6, 8], yticks: [-70, -60, -40, -20, 0], xlabel: "s", ylabel: "LUFS", yfmt: (v) => String(v).replace("-", "−") });
    hline(svg, f, -70, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3", "absolute gate −70");
    if (Number.isFinite(rel) && rel > -70) hline(svg, f, rel, "stroke:var(--vec-u);stroke-opacity:0.7;stroke-dasharray:4 3", `relative gate ${num(rel, 1)}`);
    if (Number.isFinite(lufs)) hline(svg, f, lufs, "stroke:var(--brand);stroke-width:1.75", `${num(lufs, 1)} LUFS`);
    polyline(svg, lj.map((v, j) => [f.sx(0.4 + j * 0.1), f.sy(Math.max(-70, Math.min(0, v)))]), "stroke:var(--foreground);stroke-width:1.5");
  }
  draw();
}

// ============================================================ 10. calculators

for (const root of document.querySelectorAll("[data-aud-calc]")) {
  const o = outs(root);
  const panes = [...root.querySelectorAll("[data-pane]")];
  const table = root.querySelector("[data-table]");
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    for (const p of panes) p.hidden = p.dataset.pane !== e.detail.value;
  });

  const NOTES = [["1/1", 4], ["1/2", 2], ["1/4", 1], ["1/8", 0.5], ["1/16", 0.25], ["1/32", 0.125]];
  function draw() {
    const bpm = s.bpm.get();
    const q = 60000 / bpm;
    table.replaceChildren();
    const t = document.createElement("table");
    t.className = "w-full min-w-[420px] font-mono text-xs";
    const head = t.createTHead().insertRow();
    for (const hd of ["note", "straight", "dotted", "triplet", "Hz (straight)"]) {
      const c = document.createElement("th");
      c.className = "py-1 pr-4 text-left font-normal text-muted-foreground";
      c.textContent = hd;
      head.append(c);
    }
    const body = t.createTBody();
    for (const [name, beats] of NOTES) {
      const ms = q * beats;
      const r = body.insertRow();
      for (const v of [name, `${num(ms, 1)} ms`, `${num(ms * 1.5, 1)} ms`, `${num((ms * 2) / 3, 1)} ms`, `${num(1000 / ms, 2)} Hz`]) {
        const c = r.insertCell();
        c.className = "py-1 pr-4 tabular-nums";
        c.textContent = v;
      }
    }
    table.append(t);

    const rate = s.rate.get() * 1000, bits = s.bits.get(), ch = s.ch.get(), secs = s.min.get() * 60;
    const bytes = (rate * bits * ch * secs) / 8;
    o.kbps.textContent = `${num((rate * bits * ch) / 1000, 1)} kbit/s`;
    o.bytes.textContent = `${Math.round(bytes).toLocaleString("en")} B · ${num(bytes / 2 ** 20, 2)} MiB`;
    o.mp3.textContent = `${num((128000 / 8) * secs / 2 ** 20, 2)} / ${num((320000 / 8) * secs / 2 ** 20, 2)} MiB`;
  }

  // Tap tempo: the average of the last four intervals.
  const taps = [];
  const tap = () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      s.bpm.set(60000 / iv);
      o.tap.textContent = `${taps.length} taps`;
    } else {
      o.tap.textContent = "tap again…";
    }
  };
  root.querySelector('[data-action="tap"]').addEventListener("click", tap);
  root.addEventListener("keydown", (e) => {
    if ((e.key === "t" || e.key === "T") && !e.target.closest("input")) tap();
  });
  draw();
}
