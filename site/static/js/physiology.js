// Anatomy & physiology blocks. Every curve comes from a model computed
// here: a time-varying elastance heart, a synthetic ECG, Poiseuille flow,
// a spirogram, the Hill equation with Kelman's shift, the frog
// length–tension curve and a glucose feedback teaching model.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));

// SVG elements have no .hidden property: toggle the attribute.
function playButton(btn, labels) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// Converts a pointer event to the SVG's viewBox x coordinate.
function viewX(svg, e) {
  const r = svg.getBoundingClientRect();
  return ((e.clientX - r.left) / r.width) * svg.viewBox.baseVal.width;
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ Cardiac cycle

// Left ventricle as a time-varying elastance (double-Hill activation,
// Stergiopulos et al. 1996), mitral and aortic valves as ideal diodes with
// small resistances, a constant left atrial pressure and a two-element
// Windkessel aorta. Units: mmHg, mL, s.
function heartbeat({ HR, Emax, Rs }) {
  const T = 60 / HR, Emin = 0.072, V0 = 10, Pla = 8, Rmv = 0.005, Rav = 0.003, C = 1.2;
  const Tmax = 0.2 + 0.15 * T;
  const act = (t) => {
    const tn = t / Tmax, a = (tn / 0.7) ** 1.9, b = (tn / 1.17) ** 21.9;
    return 1.55 * (a / (1 + a)) / (1 + b);
  };
  const dt = 0.0005, every = 2;
  let V = 120, Pao = 80, out = [];
  for (let beat = 0; beat < 12; beat++) {
    out = [];
    for (let i = 0, t = 0; t < T; i++, t = i * dt) {
      const E = (Emax - Emin) * act(t) + Emin;
      const Plv = E * (V - V0);
      const Qmv = Plv < Pla ? (Pla - Plv) / Rmv : 0;
      const Qav = Plv > Pao ? (Plv - Pao) / Rav : 0;
      V += dt * (Qmv - Qav);
      Pao += (dt * (Qav - Pao / Rs)) / C;
      if (i % every === 0) out.push({ t, Plv, Pao, V, Pla, mv: Qmv > 0, av: Qav > 0 });
    }
  }
  // Valve events in model time.
  const ev = {};
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1], b = out[i];
    if (a.mv && !b.mv && ev.mc === undefined) ev.mc = b.t;
    if (!a.av && b.av) ev.ao = b.t;
    if (a.av && !b.av) ev.ac = b.t;
    if (!a.mv && b.mv && ev.ac !== undefined) ev.mo = b.t;
  }
  if (ev.mc === undefined) ev.mc = 0;
  const Vs = out.map((d) => d.V), Ps = out.map((d) => d.Pao);
  const EDV = Math.max(...Vs), ESV = Math.min(...Vs);
  return { T, out, ev, EDV, ESV, SV: EDV - ESV, sys: Math.max(...Ps), dia: Math.min(...Ps) };
}

// A schematic ECG beat (mV) as a sum of Gaussians, R peak at time 0.
function ecgBeat(t, { pr = 0.16, qt = 0.38, p = true } = {}) {
  const g = (c, a, s) => a * Math.exp(-((t - c) ** 2) / (2 * s * s));
  const qrsOn = -0.045;
  let v = g(-0.025, -0.12, 0.008) + g(0, 1.2, 0.011) + g(0.03, -0.3, 0.01);
  if (p) v += g(qrsOn - pr + 0.045, 0.15, 0.022);
  v += g(qrsOn + qt - 0.08, 0.3, 0.04);
  return v;
}

for (const root of document.querySelectorAll("[data-wiggers]")) {
  const svgP = root.querySelector('[data-plot="p"]');
  const svgV = root.querySelector('[data-plot="v"]');
  const svgE = root.querySelector('[data-plot="ecg"]');
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"), ["Play", "Pause"]);
  const s = scrubAll(root, () => { model = run(); draw(); });
  const BOX = [44, 0, 584, 0];
  // Display time: the beat is rotated so the QRS sits 0.1 s from the left.
  const SHIFT = 0.1;
  let model = run(), cursor = 0.3, playing = false, raf = 0, visible = false;

  function run() {
    const m = heartbeat({ HR: s.hr.get(), Emax: s.emax.get(), Rs: s.rs.get() });
    const n = m.out.length, k = Math.round((SHIFT / m.T) * n);
    m.disp = m.out.map((_, i) => ({ ...m.out[(i - k + n) % n], tau: (i / n) * m.T }));
    m.toTau = (t) => (t + SHIFT) % m.T;
    return m;
  }

  function phaseAt(d) {
    if (d.av) return "Ejection";
    if (d.mv) return "Filling";
    return d.t < model.ev.ao ? "Isovolumic contraction" : "Isovolumic relaxation";
  }

  function draw() {
    const m = model, T = m.T, d = m.disp[Math.min(m.disp.length - 1, Math.round((cursor / T) * m.disp.length))];
    const pmax = Math.max(140, Math.ceil(Math.max(...m.disp.map((x) => x.Plv)) / 20) * 20 + 10);
    const ticks = Array.from({ length: Math.floor(T / 0.2) + 1 }, (_, i) => +(i * 0.2).toFixed(1));

    // Pressures.
    svgP.replaceChildren();
    const fp = frame(svgP, { box: [44, 14, 584, 168], x: [0, T], y: [0, pmax], xticks: [], yticks: [0, 40, 80, 120].filter((v) => v < pmax), ylabel: "mmHg" });
    const ej = [m.toTau(m.ev.ao), m.toTau(m.ev.ac)];
    if (ej[1] > ej[0]) el("rect", { x: fp.sx(ej[0]), y: fp.T, width: fp.sx(ej[1]) - fp.sx(ej[0]), height: fp.H, style: "fill:var(--code-del);fill-opacity:0.06" }, svgP);
    polyline(svgP, m.disp.map((x) => [fp.sx(x.tau), fp.sy(x.Pla)]), "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svgP, m.disp.map((x) => [fp.sx(x.tau), fp.sy(x.Pao)]), "stroke:var(--code-del);stroke-width:1.75");
    polyline(svgP, m.disp.map((x) => [fp.sx(x.tau), fp.sy(x.Plv)]), "stroke:var(--foreground);stroke-width:1.75");
    // Valve events, labels on two rows so close events stay legible.
    const evs = [["mc", "mitral closes"], ["ao", "aortic opens"], ["ac", "aortic closes"], ["mo", "mitral opens"]];
    evs.forEach(([k, label], i) => {
      if (m.ev[k] === undefined) return;
      const x = fp.sx(m.toTau(m.ev[k]));
      for (const [svg, top, bottom] of [[svgP, fp.T, fp.T + fp.H], [svgV, 6, 94], [svgE, 4, 80]])
        el("line", { x1: x, x2: x, y1: top, y2: bottom, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
      text(svgP, x + 3, fp.T + 10 + (i % 2) * 11, label);
    });

    // Volume.
    svgV.replaceChildren();
    const vs = m.disp.map((x) => x.V), vlo = Math.floor((Math.min(...vs) - 10) / 20) * 20, vhi = Math.ceil((Math.max(...vs) + 10) / 20) * 20;
    const fv = frame(svgV, { box: [44, 6, 584, 88], x: [0, T], y: [vlo, vhi], xticks: [], yticks: [vlo, vhi], ylabel: "" });
    text(svgV, 4, 14, "mL");
    polyline(svgV, m.disp.map((x) => [fv.sx(x.tau), fv.sy(x.V)]), "stroke:var(--vec-v);stroke-width:1.75");
    for (const [v, label] of [[m.EDV, "EDV"], [m.ESV, "ESV"]]) text(svgV, fv.L + fv.W - 2, fv.sy(v) - 4, `${label} ${Math.round(v)}`, { "text-anchor": "end" });

    // ECG, periodic around the beat.
    svgE.replaceChildren();
    const fe = frame(svgE, { box: [44, 4, 584, 76], x: [0, T], y: [-0.5, 1.3], xticks: ticks, yticks: [], xlabel: "time (s)" });
    text(svgE, 4, 14, "ECG");
    const rTau = SHIFT - 0.02, qt = Math.min(0.42, 0.4 * Math.sqrt(T));
    const pts = [];
    for (let i = 0; i <= 400; i++) {
      const tau = (i / 400) * T;
      let v = 0;
      for (const k of [-1, 0, 1]) v += ecgBeat(tau - rTau - k * T, { qt });
      pts.push([fe.sx(tau), fe.sy(v)]);
    }
    polyline(svgE, pts, "stroke:var(--foreground);stroke-width:1.25");

    // Cursor.
    for (const [svg, f, ys] of [[svgP, fp, [d.Plv, d.Pao]], [svgV, fv, [d.V]], [svgE, fe, []]]) {
      el("line", { x1: f.sx(cursor), x2: f.sx(cursor), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
      for (const y of ys) el("circle", { cx: f.sx(cursor), cy: f.sy(y), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.75" }, svg);
    }

    o.phase.textContent = phaseAt(d);
    o.cursor.textContent = `${Math.round(cursor * 1000)} ms`;
    o.pressures.textContent = `${Math.round(d.Plv)} / ${Math.round(d.Pao)} mmHg`;
    o.volume.textContent = `${Math.round(d.V)} mL`;
    o.bp.textContent = `≈ ${Math.round(m.sys)}/${Math.round(m.dia)} mmHg`;
    o.edv.textContent = `${Math.round(m.EDV)} / ${Math.round(m.ESV)} mL`;
    o.sv.textContent = `${Math.round(m.SV)} mL`;
    o.ef.textContent = `${Math.round((100 * m.SV) / m.EDV)}%`;
    o.co.textContent = `${num((m.SV * s.hr.get()) / 1000, 1)} L/min`;
  }

  // Drag across any plot to move the cursor; arrows step it.
  for (const svg of [svgP, svgV, svgE]) {
    const move = (e) => {
      const x = viewX(svg, e);
      cursor = Math.max(0, Math.min(model.T - 1e-6, ((x - BOX[0]) / BOX[2]) * model.T));
      setPlaying(false);
      draw();
    };
    svg.addEventListener("pointerdown", (e) => { svg.setPointerCapture(e.pointerId); move(e); });
    svg.addEventListener("pointermove", (e) => { if (svg.hasPointerCapture(e.pointerId)) move(e); });
  }
  svgP.setAttribute("tabindex", "0");
  svgP.classList.add("outline-none", "focus-visible:ring-2", "focus-visible:ring-ring/50", "rounded-sm");
  svgP.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -0.01, ArrowRight: 0.01 }[e.key];
    if (!step) return;
    e.preventDefault();
    cursor = (cursor + step * (e.shiftKey ? 5 : 1) + model.T) % model.T;
    draw();
  });

  // Quarter speed, so a beat is readable.
  let last = 0;
  const loop = (now) => {
    cursor = (cursor + Math.min(0.05, (now - last) / 1000) * 0.25) % model.T;
    last = now;
    draw();
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  function setPlaying(p) {
    playing = p && !reduced();
    setPlay(playing);
    if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  root.querySelector("[data-action=play]").addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=reset]").addEventListener("click", () => {
    s.hr.set(75, false); s.emax.set(3.2, false); s.rs.set(1.1, false);
    model = run(); cursor = 0.3; setPlaying(false); draw();
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && playing && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(root);
  draw();
}

// ============================================================ ECG

const RHYTHMS = {
  nsr: { hr: 72, pr: 0.16, reading: "Sinus rhythm, rate 60–100 bpm: normal." },
  brady: { hr: 48, pr: 0.17, reading: "Sinus bradycardia: under 60 bpm (normal in trained athletes and in sleep)." },
  tachy: { hr: 125, pr: 0.14, reading: "Sinus tachycardia: over 100 bpm, every P followed by a QRS." },
  avb1: { hr: 70, pr: 0.28, reading: "PR over 200 ms with every P conducted: first-degree AV block." },
  af: { hr: 0, pr: 0, reading: "Irregularly irregular RR, no P waves, a wavy baseline: atrial fibrillation." },
};

for (const root of document.querySelectorAll("[data-ecg]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "nsr";

  root.addEventListener("seg-change", (e) => {
    kind = e.detail.value;
    // Two tablists act as one control: clear the other one's selection.
    for (const b of root.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b.dataset.seg === kind));
    draw();
  });

  function draw() {
    const R = RHYTHMS[kind], af = kind === "af";
    const PX = 125, BASE = 120, MV = 50; // 125 px/s (5 px per 0.04 s), 50 px/mV (5 px per 0.1 mV)
    const Wd = 750, Ht = 240, dur = Wd / PX;
    svg.replaceChildren();
    // Paper.
    for (let x = 0; x <= Wd; x += 5) el("line", { x1: x, x2: x, y1: 0, y2: Ht, style: `stroke:var(--brand);stroke-opacity:${x % 25 === 0 ? 0.28 : 0.09};stroke-width:${x % 25 === 0 ? 0.9 : 0.5}` }, svg);
    for (let y = BASE % 5; y <= Ht; y += 5) el("line", { x1: 0, x2: Wd, y1: y, y2: y, style: `stroke:var(--brand);stroke-opacity:${(y - BASE) % 25 === 0 ? 0.28 : 0.09};stroke-width:${(y - BASE) % 25 === 0 ? 0.9 : 0.5}` }, svg);
    // Calibration pulse: 1 mV, 0.2 s.
    el("path", { d: `M4 ${BASE} h6 v${-MV} h25 v${MV} h6`, style: "fill:none;stroke:var(--foreground);stroke-width:1.25" }, svg);

    // Beat times.
    const rng = mulberry32(19);
    const rs = [];
    let t = 0.55;
    while (t < dur + 1) {
      rs.push(t);
      t += af ? 0.45 + 0.6 * rng() : 60 / R.hr;
    }
    const rr = af ? (rs.at(-2) - rs[0]) / (rs.length - 2) : 60 / R.hr;
    const qt = Math.min(0.46, 0.4 * Math.sqrt(af ? 0.75 : rr));
    const pts = [];
    for (let i = 0; i <= Wd * 2; i++) {
      const x = i / 2, tt = x / PX;
      let v = 0;
      for (const r of rs) if (Math.abs(tt - r) < 1.2) v += ecgBeat(tt - r, { pr: R.pr, qt, p: !af });
      if (af) v += 0.04 * Math.sin(2 * Math.PI * 6.3 * tt) + 0.03 * Math.sin(2 * Math.PI * 4.7 * tt + 1) + 0.02 * Math.sin(2 * Math.PI * 8.9 * tt + 2);
      if (x > 44) pts.push([x, BASE - v * MV]);
    }
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.4;stroke-linejoin:round");

    // Annotate the second beat that fits.
    const r = rs.find((x) => x > 1.0) ?? rs[1];
    const sx = (tt) => tt * PX;
    const qrsOn = r - 0.045, qrsOff = r + 0.045, pOn = qrsOn - R.pr, tEnd = qrsOn + qt;
    const lab = (x, y, s) => text(svg, x, y, s, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    if (!af) lab(sx(pOn + 0.045), BASE - 0.15 * MV - 8, "P");
    lab(sx(r), BASE - 1.2 * MV - 6, "R");
    lab(sx(r - 0.03), BASE + 16, "Q");
    lab(sx(r + 0.032), BASE + 0.3 * MV + 12, "S");
    lab(sx(qrsOn + qt - 0.08), BASE - 0.3 * MV - 8, "T");
    const bracket = (a, b, y, s) => {
      el("path", { d: `M${sx(a)} ${y - 4} v4 H${sx(b)} v-4`, style: "fill:none;stroke:var(--brand);stroke-width:1.25" }, svg);
      text(svg, (sx(a) + sx(b)) / 2, y + 12, s, { "text-anchor": "middle", class: "fill-brand font-mono text-[10px]" });
    };
    if (!af) bracket(pOn, qrsOn, 168, `PR ${Math.round(R.pr * 1000)}`);
    bracket(qrsOn, qrsOff, 190, "QRS 90");
    bracket(qrsOn, tEnd, 212, `QT ${Math.round(qt * 1000)}`);
    // RR between two beats.
    const i = rs.indexOf(r);
    if (rs[i + 1] && sx(rs[i + 1]) < Wd) {
      el("path", { d: `M${sx(r)} 22 v4 H${sx(rs[i + 1])} v-4`, style: "fill:none;stroke:var(--vec-u);stroke-width:1.25" }, svg);
      text(svg, (sx(r) + sx(rs[i + 1])) / 2, 16, `RR ${Math.round((rs[i + 1] - r) * 1000)} ms`, { "text-anchor": "middle", style: "fill:var(--vec-u)" });
    }

    const qtc = qt / Math.sqrt(rr);
    o.hr.textContent = af ? `≈ ${Math.round(60 / rr)} bpm (irregular)` : `${R.hr} bpm`;
    o.rr.textContent = af ? "varies" : `${Math.round(rr * 1000)} ms`;
    o.pr.textContent = af ? "no P waves" : `${Math.round(R.pr * 1000)} ms`;
    o.qrs.textContent = "90 ms";
    o.qt.textContent = `${Math.round(qt * 1000)} / ${Math.round(qtc * 1000)} ms`;
    o.reading.textContent = R.reading;
  }
  draw();
}

// ============================================================ Poiseuille

for (const root of document.querySelectorAll("[data-poiseuille]")) {
  const tube = root.querySelector("[data-tube]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  // Flow in mL/min from r (mm), L (cm), ΔP (mmHg), η (mPa·s).
  const flow = (r, L, dp, eta) => ((Math.PI * (r / 1000) ** 4 * dp * 133.322) / (8 * (eta / 1000) * (L / 100))) * 6e7;

  root.querySelector("[data-action=halve]").addEventListener("click", () => { s.r.set(s.r.get() / 2); });
  root.querySelector("[data-action=double]").addEventListener("click", () => { s.r.set(s.r.get() * 2); });

  function draw() {
    const r = s.r.get(), L = s.len.get(), dp = s.dp.get(), eta = s.eta.get();
    const Q = flow(r, L, dp, eta);
    const vmean = Q / 6e7 / (Math.PI * (r / 1000) ** 2); // m/s
    // Vessel: wall half-height in px proportional to r (4 mm → 90 px).
    tube.replaceChildren();
    const cy = 120, hh = (r / 4) * 90, x0 = 30, x1 = 370;
    el("rect", { x: x0, y: cy - hh, width: x1 - x0, height: 2 * hh, style: "fill:var(--code-del);fill-opacity:0.07" }, tube);
    for (const y of [cy - hh, cy + hh]) el("line", { x1: x0, x2: x1, y1: y, y2: y, style: "stroke:var(--code-del);stroke-width:3;stroke-linecap:round" }, tube);
    // Parabolic profile: arrow length ∝ local speed, scaled to the
    // reference vessel (r = 4 mm, same ΔP, η, L) so shrinking r shows.
    const vmaxRef = (2 * flow(4, L, dp, eta)) / 6e7 / (Math.PI * 0.004 ** 2);
    const vmax = 2 * vmean, xs = 90, scale = 220 / vmaxRef;
    const n = Math.max(3, Math.round(hh / 9));
    const prof = [];
    for (let k = -n; k <= n; k++) {
      const y = (k / n) * hh, v = vmax * (1 - (y / hh) ** 2), len = v * scale;
      if (len > 1) {
        el("line", { x1: xs, x2: xs + len, y1: cy + y, y2: cy + y, style: "stroke:var(--vec-u);stroke-width:1.5" }, tube);
        el("path", { d: `M${xs + len} ${cy + y} l-5 -3 v6 Z`, style: "fill:var(--vec-u)" }, tube);
      }
    }
    for (let k = 0; k <= 40; k++) {
      const y = (k / 20 - 1) * hh;
      prof.push([xs + vmax * (1 - (y / hh) ** 2) * scale, cy + y]);
    }
    polyline(tube, prof, "stroke:var(--vec-u);stroke-opacity:0.5;stroke-width:1;stroke-dasharray:3 3");
    el("line", { x1: xs, x2: xs, y1: cy - hh - 6, y2: cy + hh + 6, style: "stroke:currentColor;stroke-opacity:0.35" }, tube);
    text(tube, x0, 18, "flow →   fastest in the centre, zero at the wall");
    text(tube, x0, 232, `r = ${num(r, 2)} mm`);

    // Q against r on a linear axis: the r⁴ growth is the point.
    curve.replaceChildren();
    const qmax = flow(4, L, dp, eta);
    const f = frame(curve, { box: [44, 16, 200, 190], x: [0, 4], y: [0, qmax], xticks: [0, 1, 2, 3, 4], yticks: [0, qmax], yfmt: (v) => (v === 0 ? "0" : v >= 1000 ? `${num(v / 1000, 1)}k` : num(v, 0)), xlabel: "r (mm)", ylabel: "mL/min" });
    const pts = Array.from({ length: 81 }, (_, i) => { const rr = (i / 80) * 4; return [f.sx(rr), f.sy(flow(rr, L, dp, eta))]; });
    polyline(curve, pts, "stroke:var(--foreground);stroke-width:1.75");
    el("circle", { cx: f.sx(Math.min(4, r)), cy: f.sy(Math.min(qmax, Q)), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, curve);

    const fmtQ = (q) => (q >= 1000 ? `${num(q / 1000, 2)} L/min` : q >= 1 ? `${num(q, 1)} mL/min` : `${num(q * 1000, 2)} µL/min`);
    o.q.textContent = fmtQ(Q);
    o.res.textContent = `${(dp / Q).toPrecision(3)} mmHg·min/mL`;
    o.vmean.textContent = `${num(vmean * 100, 1)} cm/s`;
    const ratio = (r / 2) ** 4;
    o.ratio.textContent = ratio >= 1 ? `× ${num(ratio, ratio < 10 ? 2 : 0)}` : `× 1/${num(1 / ratio, 1 / ratio < 10 ? 2 : 0)}`;
  }
  draw();
}

// ============================================================ Lung volumes

for (const root of document.querySelectorAll("[data-spiro]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let mode = "volumes", selected = "VC";
  const TLC = 5800, RV = 1200, ERV = 1100, FRC = RV + ERV;
  const DEF = {
    TV: "Tidal volume: air moved in a quiet breath.",
    IRV: "Inspiratory reserve volume: the extra air you can still breathe in after a normal breath in.",
    ERV: "Expiratory reserve volume: the extra air you can still push out after a normal breath out.",
    RV: "Residual volume: air that stays in the lungs even after a maximal breath out.",
    IC: "Inspiratory capacity = TV + IRV.",
    FRC: "Functional residual capacity = ERV + RV: the volume at rest after a quiet breath out.",
    VC: "Vital capacity = IRV + TV + ERV: the most air you can move in one breath.",
    TLC: "Total lung capacity = all four volumes.",
  };
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; selected = mode === "volumes" ? "TV" : "VC"; draw(); });

  function draw() {
    const TV = s.tv.get(), IRV = TLC - FRC - TV;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 400, 270], x: [0, 30], y: [0, 6000], xticks: [0, 10, 20, 30], yticks: [0, 1200, 2300, 2300 + TV, 5800].filter((v, i, a) => a.indexOf(v) === i), xlabel: "time (s)", ylabel: "mL" });
    el("rect", { x: f.L, y: f.sy(RV), width: f.W, height: f.sy(0) - f.sy(RV), style: "fill:currentColor;fill-opacity:0.05" }, svg);
    text(svg, f.L + 6, f.sy(RV / 2) + 3, "not reachable by spirometry");
    // Trace: quiet breaths, a maximal breath in, a maximal breath out, quiet again.
    const period = 60 / s.rr.get();
    // Quiet breaths start and end at FRC; the big manoeuvre starts at the
    // end of a quiet breath out, and quiet breathing resumes from FRC.
    const t0 = Math.max(period, Math.floor(10 / period) * period), t3 = t0 + 10;
    const quiet = (tt) => FRC + TV * (0.5 - 0.5 * Math.cos((2 * Math.PI * tt) / period));
    const pts = [];
    for (let i = 0; i <= 600; i++) {
      const t = (i / 600) * 30;
      let v;
      if (t < t0) v = quiet(t);
      else if (t < t0 + 3) v = FRC + (TLC - FRC) * Math.sin(((t - t0) / 3) * (Math.PI / 2)) ** 2; // big breath in
      else if (t < t0 + 7) v = TLC - (TLC - RV) * Math.sin(((t - t0 - 3) / 4) * (Math.PI / 2)) ** 2; // all the way out
      else if (t < t3) v = RV + (FRC - RV) * Math.sin(((t - t0 - 7) / 3) * (Math.PI / 2)) ** 2;
      else v = quiet(t - t3);
      pts.push([f.sx(t), f.sy(v)]);
    }
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.6;stroke-linejoin:round");

    // Brackets on the right, clickable.
    const parts = mode === "volumes"
      ? [["RV", 0, RV, 0], ["ERV", RV, FRC, 0], ["TV", FRC, FRC + TV, 0], ["IRV", FRC + TV, TLC, 0]]
      : [["FRC", 0, FRC, 0], ["IC", FRC, TLC, 0], ["VC", RV, TLC, 1], ["TLC", 0, TLC, 2]];
    for (const [k, a, b, col] of parts) {
      const x = f.L + f.W + 22 + col * 58, on = k === selected;
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `${k} ${Math.round(b - a)} mL`, class: "cursor-pointer outline-none" }, svg);
      el("rect", { x: x - 6, y: f.sy(b), width: 54, height: f.sy(a) - f.sy(b), style: `fill:${on ? "var(--brand)" : "transparent"};fill-opacity:0.08` }, g);
      el("path", { d: `M${x + 6} ${f.sy(b) + 1} h-6 V${f.sy(a) - 1} h6`, style: `fill:none;stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.5};stroke-width:1.5` }, g);
      text(g, x + 9, (f.sy(a) + f.sy(b)) / 2 - 1, k, { class: `font-mono text-[11px] ${on ? "fill-brand" : "fill-foreground"}` });
      text(g, x + 9, (f.sy(a) + f.sy(b)) / 2 + 11, `${Math.round(b - a)}`);
      const pick = () => { selected = k; draw(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    }

    const vals = { TV, IRV, ERV, RV, IC: TV + IRV, FRC, VC: TLC - RV, TLC };
    o.ve.textContent = `${num((TV * s.rr.get()) / 1000, 1)} L/min`;
    o.va.textContent = `${num((Math.max(0, TV - s.dead.get()) * s.rr.get()) / 1000, 1)} L/min`;
    o.vc.textContent = `${TLC - RV} mL`;
    o.sel.textContent = `${selected} ${Math.round(vals[selected])} mL. ${DEF[selected]}`;
    o.sel.classList.add("font-sans", "leading-relaxed");
  }
  draw();
}

// ============================================================ Oxygen curve

for (const root of document.querySelectorAll("[data-o2]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let fetal = false;
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { if (k === "fetal") { fetal = on; draw(); } });
  const PRESETS = { rest: { ph: 7.4, pco2: 40, temp: 37 }, exercise: { ph: 7.2, pco2: 60, temp: 39 } };
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.preset];
    for (const k in p) s[k].set(p[k], false);
    draw();
  }));

  const N = 2.7;
  const sat = (P, p50) => P ** N / (P ** N + p50 ** N);

  function draw() {
    const base = fetal ? 19 : 26.8;
    // Kelman: PO2_virtual = PO2 · 10^(0.024(37−T) + 0.40(pH−7.40) + 0.06·log10(40/PCO2)).
    const factor = 10 ** (0.024 * (37 - s.temp.get()) + 0.4 * (s.ph.get() - 7.4) + 0.06 * Math.log10(40 / s.pco2.get()));
    const p50 = base / factor;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 560, 270], x: [0, 120], y: [0, 100], xticks: [0, 20, 40, 60, 80, 100, 120], yticks: [0, 25, 50, 75, 100], xlabel: "PO₂ (mmHg)", ylabel: "SO₂ %" });
    hline(svg, f, 50, "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4");
    const curvePts = (p) => Array.from({ length: 241 }, (_, i) => { const P = i / 2; return [f.sx(P), f.sy(100 * sat(P, p))]; });
    polyline(svg, curvePts(26.8), "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, curvePts(p50), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.sx(p50), x2: f.sx(p50), y1: f.sy(50), y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:2 3" }, svg);
    text(svg, f.sx(p50) + 4, f.T + f.H - 6, `P50 ${num(p50, 1)}`, { class: "fill-brand font-mono text-[10px]" });
    // Lungs (standard conditions) load at 100; tissues (current conditions) unload at 40.
    const sa = sat(100, base), sv = sat(40, p50);
    for (const [P, S, label] of [[100, sa, "lungs"], [40, sv, "tissue"]]) {
      el("circle", { cx: f.sx(P), cy: f.sy(100 * S), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, f.sx(P) + 7, f.sy(100 * S) + 14, label);
    }
    const hb = s.hb.get();
    const ca = 1.34 * hb * sa + 0.003 * 100, cv = 1.34 * hb * sv + 0.003 * 40;
    o.p50.textContent = `${num(p50, 1)} mmHg`;
    o.sa.textContent = `${num(sa * 100, 1)}%`;
    o.sv.textContent = `${num(sv * 100, 1)}%`;
    o.content.textContent = `${num(ca, 1)} / ${num(cv, 1)} mL/dL`;
    o.unload.textContent = `${num(ca - cv, 1)} mL O₂ per dL`;
  }
  draw();
}

// ============================================================ Parts pickers (nephron)

for (const root of document.querySelectorAll("[data-physio-parts]")) {
  const picks = [...root.querySelectorAll("[data-pick]")];
  const parts = [...root.querySelectorAll("[data-part]")];
  const name = root.querySelector("[data-info-name]");
  const role = root.querySelector("[data-info-role]");
  const show = (key) => {
    const p = picks.find((b) => b.dataset.pick === key);
    if (!p) return;
    for (const b of picks) b === p ? (b.dataset.on = "") : delete b.dataset.on;
    for (const g of parts) g.dataset.part === key ? (g.dataset.on = "") : delete g.dataset.on;
    name.textContent = p.dataset.name;
    role.textContent = p.dataset.role;
  };
  for (const g of parts) {
    g.addEventListener("pointerenter", () => show(g.dataset.part));
    g.addEventListener("focus", () => show(g.dataset.part));
  }
  for (const b of picks) b.addEventListener("click", () => show(b.dataset.pick));
}

// ============================================================ Sarcomere

// Active force against sarcomere length, frog fibres (Gordon, Huxley &
// Julian 1966), as straight segments between the classic breakpoints.
const LT = [[1.27, 0], [1.67, 0.84], [2.0, 1], [2.25, 1], [3.65, 0]];
function tension(L) {
  if (L <= LT[0][0] || L >= LT.at(-1)[0]) return 0;
  for (let i = 1; i < LT.length; i++) if (L <= LT[i][0]) {
    const [a, fa] = LT[i - 1], [b, fb] = LT[i];
    return fa + ((L - a) / (b - a)) * (fb - fa);
  }
  return 0;
}

for (const root of document.querySelectorAll("[data-sarcomere]")) {
  const fibre = root.querySelector("[data-fibre]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => s.len.set(Number(b.dataset.preset))));
  const THIN = 1.0, THICK = 1.6, BARE = 0.2;

  function draw() {
    const L = s.len.get(), F = tension(L);
    // Fibre drawing: 150 px per µm, centred.
    fibre.replaceChildren();
    const cx = 320, k = 150, zl = cx - (L / 2) * k, zr = cx + (L / 2) * k, cy = 65;
    for (const z of [zl, zr]) el("line", { x1: z, x2: z, y1: 12, y2: 118, style: "stroke:var(--foreground);stroke-width:3;stroke-linecap:round" }, fibre);
    text(fibre, zl, 128, "Z", { "text-anchor": "middle" });
    text(fibre, zr, 128, "Z", { "text-anchor": "middle" });
    // Thin filaments (actin) from each Z-disc, at four heights.
    for (const y of [cy - 36, cy - 12, cy + 12, cy + 36]) {
      el("line", { x1: zl, x2: zl + THIN * k, y1: y, y2: y, style: "stroke:var(--vec-u);stroke-width:2.5" }, fibre);
      el("line", { x1: zr, x2: zr - THIN * k, y1: y + 4, y2: y + 4, style: "stroke:var(--vec-u);stroke-width:2.5" }, fibre);
    }
    // Thick filaments (myosin), with heads coloured where they reach actin.
    const tl = cx - (THICK / 2) * k, tr = cx + (THICK / 2) * k;
    for (const y of [cy - 24, cy, cy + 24]) {
      el("line", { x1: Math.max(tl, zl), x2: Math.min(tr, zr), y1: y, y2: y, style: "stroke:var(--foreground);stroke-width:5;stroke-linecap:round" }, fibre);
      for (let x = tl + 4; x < tr - 2; x += 8) {
        if (Math.abs(x - cx) < (BARE / 2) * k || x < zl || x > zr) continue;
        // A head reaches actin if a thin filament from the near Z-disc covers x.
        const reach = x < cx ? x <= zl + THIN * k : x >= zr - THIN * k;
        const dir = x < cx ? -1 : 1;
        el("line", { x1: x, x2: x + dir * 4, y1: y - 3, y2: y - 9, style: `stroke:${reach ? "var(--brand)" : "currentColor"};stroke-opacity:${reach ? 1 : 0.3};stroke-width:1.5` }, fibre);
        el("line", { x1: x, x2: x + dir * 4, y1: y + 3, y2: y + 9, style: `stroke:${reach ? "var(--brand)" : "currentColor"};stroke-opacity:${reach ? 1 : 0.3};stroke-width:1.5` }, fibre);
      }
    }
    text(fibre, 6, 14, `${num(L, 2)} µm`, { class: "fill-foreground font-mono text-[11px]" });

    // Curve.
    curve.replaceChildren();
    const f = frame(curve, { box: [44, 14, 580, 170], x: [1.2, 3.8], y: [0, 1.1], xticks: [1.5, 2, 2.5, 3, 3.5], yticks: [0, 0.5, 1], xlabel: "sarcomere length (µm)", ylabel: "force", yfmt: (v) => `${v * 100}%` });
    el("rect", { x: f.sx(2.0), y: f.T, width: f.sx(2.25) - f.sx(2.0), height: f.H, style: "fill:var(--brand);fill-opacity:0.07" }, curve);
    polyline(curve, LT.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-width:1.75");
    el("line", { x1: f.sx(L), x2: f.sx(L), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:2 3" }, curve);
    el("circle", { cx: f.sx(L), cy: f.sy(F), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, curve);

    o.force.textContent = `${Math.round(F * 100)}% of maximum`;
    o.region.textContent =
      L < 1.67 ? "Too short: thick filaments press on the Z-discs."
      : L < 2.0 ? "Short: thin filaments overlap each other in the middle."
      : L <= 2.25 ? "Plateau: every cross-bridge can reach actin."
      : L < 3.65 ? "Stretched: overlap, and so force, falls with length."
      : "No overlap: no cross-bridges, no active force.";
  }
  // Drag on the curve to set the length.
  const move = (e) => {
    const x = viewX(curve, e);
    s.len.set(Math.max(1.3, Math.min(3.7, 1.2 + ((x - 44) / 580) * 2.6)));
  };
  curve.addEventListener("pointerdown", (e) => { curve.setPointerCapture(e.pointerId); move(e); });
  curve.addEventListener("pointermove", (e) => { if (curve.hasPointerCapture(e.pointerId)) move(e); });
  draw();
}

// ============================================================ Glucose feedback

// Teaching model (mmol/L, insulin in arbitrary units, minutes). Meals add
// glucose with a gamma-shaped absorption; insulin raises uptake and
// suppresses hepatic output; low glucose (glucagon) raises hepatic output;
// exercise adds insulin-independent uptake for 45 minutes; above the renal
// threshold (≈ 10 mmol/L) the kidneys spill glucose into the urine.
function glucoseRun({ meals, exercise, type1 }) {
  const step = (G, I, t, ev) => {
    let Ra = 0;
    for (const m of ev.meals) if (t >= m) { const u = t - m; Ra += 28 * (u / (35 * 35)) * Math.exp(-u / 35); }
    const ex = ev.exercise.some((e) => t >= e && t < e + 45) ? 1 : 0;
    const liver = 0.05 / (1 + 1.2 * I) + 0.08 / (1 + Math.exp((G - 4.0) / 0.3));
    const renal = 0.02 * Math.max(0, G - 10); // glycosuria above the renal threshold (≈ 10 mmol/L)
    const dG = Ra + liver - (0.004 + 0.012 * ex + 0.006 * I) * G - renal;
    const dI = (type1 ? 0 : 0.06 * Math.max(0, G - 3.5) ** 2) - 0.1 * I;
    return [G + 0.5 * dG, Math.max(0, I + 0.5 * dI)];
  };
  // Settle to a fasting steady state first (with the same insulin status).
  let G = 5, I = type1 ? 0 : 0.7;
  for (let t = 0; t < 600; t += 0.5) [G, I] = step(G, I, -1, { meals: [], exercise: [] });
  const out = [];
  for (let t = 0; t <= 360; t += 0.5) {
    out.push({ t, G, I });
    [G, I] = step(G, I, t, { meals, exercise });
  }
  return out;
}

for (const root of document.querySelectorAll("[data-glucose]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  let meals = [60], exercise = [], type1 = false;
  onToggle(root, (k, on) => { if (k === "type1") { type1 = on; draw(); } });
  root.querySelectorAll("[data-event]").forEach((b) => b.addEventListener("click", () => {
    const at = s.at.get(), k = b.dataset.event;
    if (k === "meal") meals = [...new Set([...meals, at])].sort((a, b) => a - b);
    else if (k === "exercise") exercise = [...new Set([...exercise, at])].sort((a, b) => a - b);
    else { meals = []; exercise = []; }
    draw();
  }));

  function draw() {
    const run = glucoseRun({ meals, exercise, type1 });
    const gmax = Math.max(12, Math.ceil(Math.max(...run.map((d) => d.G)) / 4) * 4);
    const imax = Math.max(4, ...run.map((d) => d.I));
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 560, 230], x: [0, 360], y: [0, gmax], xticks: [0, 60, 120, 180, 240, 300, 360], yticks: [0, 4, 8, 12, 16, 20, 24, 28].filter((v) => v <= gmax), xlabel: "minutes", ylabel: "mmol/L" });
    el("rect", { x: f.L, y: f.sy(5.5), width: f.W, height: f.sy(4) - f.sy(5.5), style: "fill:var(--code-add);fill-opacity:0.08" }, svg);
    text(svg, f.L + f.W - 4, f.sy(5.5) - 4, "normal fasting 4–5.5", { "text-anchor": "end" });
    polyline(svg, run.map((d) => [f.sx(d.t), f.sy((d.I / imax) * gmax * 0.6)]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 3");
    polyline(svg, run.map((d) => [f.sx(d.t), f.sy(d.G)]), "stroke:var(--brand);stroke-width:2");
    for (const m of meals) { el("path", { d: `M${f.sx(m)} ${f.T + f.H + 22} l-4 -7 h8 Z`, style: "fill:var(--vec-out)" }, svg); }
    for (const e of exercise) el("rect", { x: f.sx(e), y: f.T + f.H + 17, width: f.sx(e + 45) - f.sx(e), height: 4, rx: 2, style: "fill:var(--ion-cl)" }, svg);
    text(svg, f.L, f.T + f.H + 36, "▼ meal   ▬ exercise");

    const fasting = run[0].G;
    const peak = run.reduce((a, d) => (d.G > a.G ? d : a), run[0]);
    const back = run.find((d) => d.t > peak.t && d.G < fasting + 0.5);
    o.fasting.textContent = `${num(fasting, 1)} mmol/L`;
    o.peak.textContent = `${num(peak.G, 1)} mmol/L at ${Math.round(peak.t)} min`;
    o.back.textContent = peak.G - fasting < 0.5 ? "—" : back ? `at ${Math.round(back.t)} min` : "not within 6 h";
  }
  draw();
}

// ============================================================ Reflex arc

for (const root of document.querySelectorAll("[data-reflex]")) {
  const items = [...root.querySelectorAll("[data-item]")];
  const segs = [...root.querySelectorAll("path[data-step]")];
  const count = root.querySelector("[data-out=count]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(items.length - 1, i));
    // The pathway builds up: every segment up to the current step is lit.
    for (const p of segs) Number(p.dataset.step) <= at ? (p.dataset.on = "") : delete p.dataset.on;
    items.forEach((li, k) => (k === at ? (li.dataset.on = "") : delete li.dataset.on));
    count.textContent = `${at + 1} / ${items.length}`;
    back.disabled = at === 0;
    next.disabled = at === items.length - 1;
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  items.forEach((li, k) => li.addEventListener("click", () => go(k)));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: items.length - 1 }[e.key];
    if (to === undefined || e.target.closest("button,a")) return;
    e.preventDefault();
    go(to);
  });
  go(0);
}
