// Medical imaging blocks: X-ray attenuation, CT filtered backprojection,
// Hounsfield windowing, Larmor precession, T1/T2 relaxation and weighting,
// k-space, ultrasound echoes, PET coincidences and image quality. Every
// picture comes from the formulas named in the block text.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { fft, fft2, sheppLogan, rasterize, radon, drawGray, range, mulberry32, gauss } from "./imaging-fft.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const minus = (s) => String(s).replace(/-/g, "−");
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const visibleLoop = (root, step) => {
  // Calls step(dt) every frame while the root is on screen.
  let raf = 0, last = 0, on = false;
  const tick = (t) => {
    step(Math.min(50, t - last) / 1000);
    last = t;
    raf = on ? requestAnimationFrame(tick) : 0;
  };
  new IntersectionObserver(([e]) => {
    on = e.isIntersecting && !reduced();
    if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }).observe(root);
};

// ============================================================ X-ray projection

// Linear attenuation (cm⁻¹) from NIST μ/ρ: water, cortical bone (ρ 1.92),
// inflated lung (≈ 0.26 × water).
const XRAY_MU = {
  40: { tissue: 0.268, bone: 1.278, lung: 0.07 },
  60: { tissue: 0.206, bone: 0.604, lung: 0.054 },
  80: { tissue: 0.184, bone: 0.428, lung: 0.048 },
  100: { tissue: 0.171, bone: 0.356, lung: 0.044 },
};

for (const root of document.querySelectorAll("[data-img-xray]")) {
  const svg = root.querySelector("[data-slice]");
  const film = root.querySelector("[data-film]");
  const o = outs(root);
  let energy = 40;
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { energy = +v; draw(); });

  // Material at (x, y) in cm; bone wins over lung over tissue over air.
  const inEll = (x, y, cx, cy, a, b) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;
  const material = (x, y, t) => {
    if (!inEll(x, y, 0, 0, 14, 9.5)) return "air";
    if (inEll(x, y, 0, -6.6, 1.6, 1.6)) return "bone"; // vertebral body
    if (t > 0 && inEll(x, y, 0, 8.4, 1.4, t / 2)) return "bone"; // sternum
    for (const rx of [-11, -7, 7, 11]) for (const ry of [6.8, -6.4]) if (t > 0 && inEll(x, y, rx, ry, t / 2, t / 2)) return "bone"; // ribs
    if (inEll(x, y, -6.2, 0.4, 4.4, 6.2) || inEll(x, y, 6.2, 0.4, 4.4, 6.2)) return "lung";
    return "tissue";
  };
  const lineIntegral = (x, t, mu) => {
    let sum = 0;
    const dy = 0.02;
    for (let y = -10; y < 10; y += dy) {
      const m = material(x, y, t);
      if (m !== "air") sum += mu[m] * dy;
    }
    return sum;
  };

  function draw() {
    const t = s.rib.get(), mu = XRAY_MU[energy];
    svg.replaceChildren();
    const W = 640, X0 = 40, X1 = 600, Y0 = 12, Y1 = 162;
    const sx = (x) => X0 + ((x + 15) / 30) * (X1 - X0), sy = (y) => Y0 + ((10 - y) / 20) * (Y1 - Y0);
    // The slice, drawn from the same ellipses the rays are traced through.
    const ell = (cx, cy, a, b, style) =>
      el("ellipse", { cx: sx(cx), cy: sy(cy), rx: (a / 30) * (X1 - X0), ry: (b / 20) * (Y1 - Y0), style }, svg);
    const tissue = "fill:currentColor;fill-opacity:0.18;stroke:currentColor;stroke-opacity:0.3";
    const lungS = "fill:var(--vec-u);fill-opacity:0.12;stroke:var(--vec-u);stroke-opacity:0.4";
    const boneS = "fill:currentColor;fill-opacity:0.75";
    ell(0, 0, 14, 9.5, tissue);
    ell(-6.2, 0.4, 4.4, 6.2, lungS);
    ell(6.2, 0.4, 4.4, 6.2, lungS);
    ell(0, -6.6, 1.6, 1.6, boneS);
    if (t > 0) {
      ell(0, 8.4, 1.4, t / 2, boneS);
      for (const rx of [-11, -7, 7, 11]) for (const ry of [6.8, -6.4]) ell(rx, ry, t / 2, t / 2, boneS);
    }
    text(svg, X0, Y0 - 2, "beam ↓ (source above, detector below)");
    // Rays and the transmitted fraction across the detector.
    const N = 160, prof = [];
    for (let k = 0; k < N; k++) {
      const x = -15 + ((k + 0.5) * 30) / N;
      prof.push([x, Math.exp(-lineIntegral(x, t, mu))]);
    }
    for (const xr of [-12, -6.2, 0, 6.2, 12]) el("line", { x1: sx(xr), x2: sx(xr), y1: Y0, y2: Y1, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 3" }, svg);
    const f = frame(svg, { box: [X0, 186, X1 - X0, 90], x: [-15, 15], y: [0, 1], xticks: [-15, -10, -5, 0, 5, 10, 15], yticks: [0, 0.5, 1], xfmt: (v) => minus(v), xlabel: "x (cm)", ylabel: "I/I₀" });
    polyline(svg, prof.map(([x, v]) => [f.sx(x), f.sy(v)]), "stroke:var(--brand);stroke-width:1.75");
    // The film: high attenuation prints bright.
    const row = new Float64Array(N);
    prof.forEach(([, v], i) => (row[i] = 1 - v));
    drawGray(film, row, N, 1, 0, 1);
    const I = (x) => Math.exp(-lineIntegral(x, t, mu));
    const spine = I(0), lung = I(-6.2), near = I(2.6);
    o.mut.textContent = `${mu.tissue.toFixed(3)} cm⁻¹`;
    o.mub.textContent = `${mu.bone.toFixed(3)} cm⁻¹`;
    o.spine.textContent = `${(spine * 100).toPrecision(3)}%`;
    o.lung.textContent = `${(lung * 100).toPrecision(3)}%`;
    o.contrast.textContent = `${num(((near - spine) / near) * 100, 1)}%`;
  }
  draw();
}

// ============================================================ CT reconstruction

const CT_N = 128;
for (const root of document.querySelectorAll("[data-img-ct]")) {
  const cPh = root.querySelector('[data-canvas="phantom"]');
  const cSino = root.querySelector('[data-canvas="sinogram"]');
  const cRec = root.querySelector('[data-canvas="recon"]');
  const o = outs(root);
  let filter = "ramlak", modified = true, timer = 0;
  const s = scrubAll(root, schedule);
  onSeg(root, (v) => { filter = v; schedule(); });
  onToggle(root, (_, on) => { modified = on; schedule(); });

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(draw, 30); // coalesce scrub bursts
  }

  // Discrete Ram-Lak and Shepp-Logan kernels (Kak & Slaney), applied as a
  // product in the frequency domain on a zero-padded 256-sample signal.
  const PAD = 256, tau = 2 / CT_N;
  const kernelFFT = (kind) => {
    const re = new Float64Array(PAD), im = new Float64Array(PAD);
    for (let k = -CT_N + 1; k < CT_N; k++) {
      let v;
      if (kind === "ramlak") v = k === 0 ? 1 / (4 * tau * tau) : k % 2 ? -1 / (k * k * Math.PI * Math.PI * tau * tau) : 0;
      else v = -2 / (Math.PI * Math.PI * tau * tau * (4 * k * k - 1));
      re[(k + PAD) % PAD] = v;
    }
    fft(re, im);
    return [re, im];
  };
  const kernels = { ramlak: kernelFFT("ramlak"), shepplogan: kernelFFT("shepplogan") };

  function draw() {
    const t0 = performance.now();
    const ell = sheppLogan(modified);
    const truth = rasterize(ell, CT_N);
    const [lo, hi] = modified ? [0, 1] : [0.95, 1.05];
    drawGray(cPh, truth, CT_N, CT_N, lo, hi);

    const K = Math.round(s.angles.get());
    const sino = new Float64Array(K * CT_N);
    const sAt = (b) => -1 + (b + 0.5) * tau;
    for (let a = 0; a < K; a++) {
      const th = (a * Math.PI) / K;
      for (let b = 0; b < CT_N; b++) sino[b * K + a] = radon(ell, th, sAt(b));
    }
    drawGray(cSino, sino, K, CT_N, 0, range(sino)[1]);

    // Filter each projection, then smear it back across the image.
    const rec = new Float64Array(CT_N * CT_N);
    const re = new Float64Array(PAD), im = new Float64Array(PAD);
    const q = new Float64Array(CT_N);
    for (let a = 0; a < K; a++) {
      const th = (a * Math.PI) / K, c = Math.cos(th), sn = Math.sin(th);
      if (filter === "none") {
        for (let b = 0; b < CT_N; b++) q[b] = sino[b * K + a];
      } else {
        re.fill(0); im.fill(0);
        for (let b = 0; b < CT_N; b++) re[b] = sino[b * K + a];
        fft(re, im);
        const [kr, ki] = kernels[filter];
        for (let i = 0; i < PAD; i++) {
          const r = re[i] * kr[i] - im[i] * ki[i];
          im[i] = re[i] * ki[i] + im[i] * kr[i];
          re[i] = r;
        }
        fft(re, im, true);
        for (let b = 0; b < CT_N; b++) q[b] = re[b] * tau;
      }
      for (let j = 0; j < CT_N; j++) {
        const y = 1 - ((j + 0.5) * 2) / CT_N;
        for (let i = 0; i < CT_N; i++) {
          const x = ((i + 0.5) * 2) / CT_N - 1;
          const pos = (x * c + y * sn + 1) / tau - 0.5;
          const b0 = Math.floor(pos), w = pos - b0;
          if (b0 >= 0 && b0 + 1 < CT_N) rec[j * CT_N + i] += q[b0] * (1 - w) + q[b0 + 1] * w;
        }
      }
    }
    for (let i = 0; i < rec.length; i++) rec[i] *= Math.PI / K;
    // RMS error after the best scale (plain backprojection has no units).
    let num_ = 0, den = 0;
    for (let i = 0; i < rec.length; i++) { num_ += rec[i] * truth[i]; den += rec[i] * rec[i]; }
    const k = filter === "none" ? num_ / den : 1;
    let err = 0;
    for (let i = 0; i < rec.length; i++) err += (k * rec[i] - truth[i]) ** 2;
    if (filter === "none") { const [a, b] = range(rec); drawGray(cRec, rec, CT_N, CT_N, a, b); }
    else drawGray(cRec, rec, CT_N, CT_N, lo, hi);
    o.n.textContent = String(K);
    o.rms.textContent = `${num(Math.sqrt(err / rec.length), 3)}${filter === "none" ? " (best scale)" : ""}`;
    o.ms.textContent = `${Math.round(performance.now() - t0)} ms`;
  }
  draw();
}

// ============================================================ Hounsfield units

const HU_WINDOWS = { soft: [40, 400], lung: [-600, 1500], bone: [400, 1800], brain: [40, 80] };
const HU_MARKS = [["air", -1000], ["lung", -700], ["fat", -100], ["water", 0], ["soft tissue", 40], ["bone", 700]];

function chestHU(n) {
  const img = new Float64Array(n * n).fill(-1000);
  const inE = (x, y, cx, cy, a, b) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * 2) / n - 1, y = 1 - ((j + 0.5) * 2) / n;
    let v = -1000;
    if (inE(x, y, 0, 0, 0.92, 0.66)) v = -100; // subcutaneous fat
    if (inE(x, y, 0, 0, 0.86, 0.6)) v = 40; // muscle and soft tissue
    if (inE(x, y, -0.4, 0.04, 0.32, 0.44) || inE(x, y, 0.42, 0.04, 0.32, 0.44)) v = -780; // lungs
    if (inE(x, y, 0.1, 0.12, 0.2, 0.17)) v = 45; // heart (blood)
    if (inE(x, y, 0, -0.42, 0.12, 0.11)) v = 1200; // vertebral cortex
    if (inE(x, y, 0, -0.42, 0.09, 0.08)) v = 300; // trabecular bone
    for (const [cx, cy] of [[-0.62, 0.38], [0.62, 0.38], [-0.74, -0.1], [0.74, -0.1], [-0.6, -0.42], [0.6, -0.42]]) if (inE(x, y, cx, cy, 0.04, 0.04)) v = 700; // ribs
    for (const [cx, cy] of [[-0.42, 0.2], [-0.3, -0.12], [0.36, 0.25], [0.5, -0.15]]) if (inE(x, y, cx, cy, 0.018, 0.018)) v = 40; // vessels
    img[j * n + i] = v;
  }
  return img;
}

for (const root of document.querySelectorAll("[data-img-hu]")) {
  const canvas = root.querySelector('[data-canvas="slice"]');
  const scale = root.querySelector("[data-scale]");
  const o = outs(root);
  const N = 128, hu = chestHU(N);
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { const [l, w] = HU_WINDOWS[v]; s.level.set(l, false); s.width.set(w, false); draw(); });

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * N), j = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (i >= 0 && j >= 0 && i < N && j < N) o.pixel.textContent = `${minus(Math.round(hu[j * N + i]))} HU`;
  });

  function draw() {
    const L = s.level.get(), W = s.width.get(), lo = L - W / 2, hi = L + W / 2;
    drawGray(canvas, hu, N, N, lo, hi);
    scale.replaceChildren();
    const f = frame(scale, { box: [70, 14, 60, 270], x: [0, 1], y: [-1000, 2000], xticks: [], yticks: [-1000, -500, 0, 500, 1000, 1500, 2000], yfmt: (v) => minus(v) });
    // Gray ramp of what each HU becomes on screen.
    for (let v = -1000; v < 2000; v += 25) {
      const g = Math.max(0, Math.min(1, (v - lo) / W));
      el("rect", { x: f.L, y: f.sy(v + 25), width: f.W, height: f.sy(v) - f.sy(v + 25) + 0.5, style: `fill:rgb(${g * 255},${g * 255},${g * 255})` }, scale);
    }
    el("rect", { x: f.L - 4, y: f.sy(Math.min(2000, hi)), width: f.W + 8, height: Math.max(1, f.sy(Math.max(-1000, lo)) - f.sy(Math.min(2000, hi))), style: "fill:none;stroke:var(--brand);stroke-width:2" }, scale);
    // Labels pushed apart where marks crowd (fat, water and soft tissue sit
    // within 140 HU), each joined to its tick by a leader.
    let prev = Infinity;
    for (const [name, v] of HU_MARKS) {
      const y = f.sy(v), ly = Math.min(y, prev - 11);
      prev = ly;
      el("polyline", { points: `${f.L + f.W},${y} ${f.L + f.W + 8},${y} ${f.L + f.W + 14},${ly}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.5" }, scale);
      text(scale, f.L + f.W + 17, ly + 3, `${name} ${minus(v)}`);
    }
    text(scale, f.L, 10, "HU → screen grey");
    const mu = s.mu.get();
    o.hu.textContent = `${minus(Math.round((1000 * (mu - 0.19)) / 0.19))} HU`;
    o.range.textContent = `${minus(Math.round(lo))} … ${minus(Math.round(hi))} HU`;
  }
  draw();
}

// ============================================================ Larmor precession

const GAMMA = { h1: ["¹H", 42.577], c13: ["¹³C", 10.708], p31: ["³¹P", 17.235], f19: ["¹⁹F", 40.078] };

for (const root of document.querySelectorAll("[data-img-larmor]")) {
  const svg = root.querySelector("[data-spin]");
  const o = outs(root);
  let nucleus = "h1", phase = 0.6;
  const s = scrubAll(root, readout);
  onSeg(root, (v) => { nucleus = v; readout(); });

  function readout() {
    const [, g] = GAMMA[nucleus], b0 = s.b0.get(), f = g * b0;
    const flip = (s.flip.get() * Math.PI) / 180;
    o.gamma.textContent = `${g} MHz/T`;
    o.f.textContent = `${num(f, 2)} MHz`;
    o.period.textContent = `${num(1000 / f, 2)} ns`;
    o.mz.textContent = `${minus(num(Math.cos(flip), 2))} / ${num(Math.sin(flip), 2)} M₀`;
    draw();
  }

  function draw() {
    svg.replaceChildren();
    const cx = 160, cy = 190, R = 110, tilt = 0.32; // ellipse squash for the xy-plane
    const flip = (s.flip.get() * Math.PI) / 180;
    el("ellipse", { cx, cy, rx: R, ry: R * tilt, style: "fill:currentColor;fill-opacity:0.04;stroke:currentColor;stroke-opacity:0.25" }, svg);
    el("line", { x1: cx, x2: cx, y1: cy + 60, y2: 20, style: "stroke:currentColor;stroke-opacity:0.4;stroke-width:1.5" }, svg);
    el("path", { d: `M${cx - 5} 30 L${cx} 18 L${cx + 5} 30 Z`, style: "fill:currentColor;fill-opacity:0.4" }, svg);
    text(svg, cx + 8, 26, "B₀");
    // The precession cone and the magnetization vector.
    const L = 150, r = L * Math.sin(flip), h = L * Math.cos(flip);
    el("ellipse", { cx, cy: cy - h, rx: Math.abs(r), ry: Math.abs(r) * tilt, style: "fill:none;stroke:var(--brand);stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
    const tipX = cx + r * Math.cos(phase), tipY = cy - h + r * tilt * Math.sin(phase);
    el("line", { x1: cx, y1: cy, x2: tipX, y2: tipY, style: "stroke:var(--brand);stroke-width:3;stroke-linecap:round" }, svg);
    el("circle", { cx: tipX, cy: tipY, r: 4.5, style: "fill:var(--brand)" }, svg);
    el("line", { x1: cx, y1: cy, x2: cx + r * Math.cos(phase), y2: cy + r * tilt * Math.sin(phase), style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 3" }, svg);
    text(svg, tipX + 8, tipY - 6, "M");
    text(svg, 8, 292, "dashed: Mxy, the part the receiver coil hears");
  }
  visibleLoop(root, (dt) => { phase += dt * 2.2; draw(); });
  readout();
}

// ============================================================ T1 / T2 relaxation

const TISSUES = [
  { key: "fat", name: "fat", t1: 260, t2: 80, pd: 0.9, color: "var(--vec-out)" },
  { key: "wm", name: "white matter", t1: 780, t2: 90, pd: 0.7, color: "var(--vec-u)" },
  { key: "gm", name: "grey matter", t1: 920, t2: 100, pd: 0.85, color: "var(--ion-k)" },
  { key: "muscle", name: "muscle", t1: 870, t2: 47, pd: 0.8, color: "var(--ion-na)" },
  { key: "csf", name: "CSF", t1: 4000, t2: 2000, pd: 1.0, color: "var(--ion-cl)" },
];

for (const root of document.querySelectorAll("[data-img-relax]")) {
  const s1 = root.querySelector("[data-t1]"), s2 = root.querySelector("[data-t2]");
  const legend = root.querySelector("[data-legend]");
  const s = scrubAll(root, draw);

  function draw() {
    const t = s.t.get();
    s1.replaceChildren(); s2.replaceChildren();
    const f1 = frame(s1, { box: [40, 16, 266, 186], x: [0, 5000], y: [0, 1], xticks: [0, 1000, 2000, 3000, 4000, 5000], yticks: [0, 0.5, 1], xlabel: "t (ms)", ylabel: "Mz / M₀" });
    const f2 = frame(s2, { box: [40, 16, 266, 186], x: [0, 1000], y: [0, 1], xticks: [0, 250, 500, 750, 1000], yticks: [0, 0.5, 1], xlabel: "t (ms)", ylabel: "Mxy / M₀" });
    legend.replaceChildren();
    for (const ts of TISSUES) {
      polyline(s1, Array.from({ length: 121 }, (_, i) => { const x = i * 5000 / 120; return [f1.sx(x), f1.sy(1 - Math.exp(-x / ts.t1))]; }), `stroke:${ts.color};stroke-width:1.75`);
      polyline(s2, Array.from({ length: 121 }, (_, i) => { const x = i * 1000 / 120; return [f2.sx(x), f2.sy(Math.exp(-x / ts.t2))]; }), `stroke:${ts.color};stroke-width:1.75`);
      const row = document.createElement("div");
      row.className = "flex items-center gap-2";
      const sw = document.createElement("span");
      sw.className = "h-0.5 w-3 rounded-full";
      sw.style.background = ts.color;
      row.append(sw, `${ts.name}: Mz ${num(1 - Math.exp(-t / ts.t1), 2)} · Mxy ${num(Math.exp(-t / ts.t2), 2)}`);
      legend.append(row);
    }
    el("line", { x1: f1.sx(t), x2: f1.sx(t), y1: f1.T, y2: f1.T + f1.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, s1);
    if (t <= 1000) el("line", { x1: f2.sx(t), x2: f2.sx(t), y1: f2.T, y2: f2.T + f2.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, s2);
    text(s1, f1.L + 4, f1.T + 10, "T1 recovery");
    text(s2, f2.L + f2.W - 4, f2.T + 10, "T2 decay", { "text-anchor": "end" });
  }
  draw();
}

// ============================================================ Weighting

const WEIGHT_PRESETS = { t1: [500, 15], t2: [4000, 100], pd: [3000, 15] };

// Tissue index per pixel of a synthetic axial brain slice: 0 air, 1 fat,
// 2 skull, 3 grey matter, 4 white matter, 5 CSF.
function brainMap(n) {
  const map = new Uint8Array(n * n);
  const inE = (x, y, cx, cy, a, b) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * 2) / n - 1, y = 1 - ((j + 0.5) * 2) / n;
    let m = 0;
    if (inE(x, y, 0, 0, 0.8, 0.95)) m = 1;
    if (inE(x, y, 0, 0, 0.74, 0.89)) m = 2;
    if (inE(x, y, 0, 0, 0.68, 0.83)) m = 5; // thin CSF around the brain
    if (inE(x, y, 0, 0, 0.65, 0.8)) m = 3;
    // White matter with gyri: a wavy boundary.
    const ang = Math.atan2(y, x), wob = 1 + 0.06 * Math.sin(ang * 11);
    if (inE(x * wob, y * wob, 0, 0, 0.52, 0.66)) m = 4;
    if (inE(x, y, -0.13, 0.08, 0.07, 0.28) || inE(x, y, 0.13, 0.08, 0.07, 0.28)) m = 5; // ventricles
    if (Math.abs(x) < 0.012 && inE(x, y, 0, 0, 0.65, 0.8) && !inE(x, y, 0, 0, 0.3, 0.45)) m = 5; // falx fissure
    map[j * n + i] = m;
  }
  return map;
}

for (const root of document.querySelectorAll("[data-img-weight]")) {
  const canvas = root.querySelector('[data-canvas="brain"]');
  const bars = root.querySelector("[data-bars]");
  const o = outs(root);
  const N = 128, map = brainMap(N);
  const tissue = { fat: TISSUES[0], wm: TISSUES[1], gm: TISSUES[2], csf: TISSUES[4] };
  const byIndex = [null, tissue.fat, null, tissue.gm, tissue.wm, tissue.csf];
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { const [tr, te] = WEIGHT_PRESETS[v]; s.tr.set(tr, false); s.te.set(te, false); draw(); });

  function draw() {
    const TR = s.tr.get(), TE = s.te.get();
    const sig = (ts) => ts.pd * (1 - Math.exp(-TR / ts.t1)) * Math.exp(-TE / ts.t2);
    const vals = byIndex.map((ts, i) => (ts ? sig(ts) : i === 2 ? 0.03 : 0));
    const max = Math.max(...vals);
    const img = new Float64Array(N * N);
    for (let i = 0; i < img.length; i++) img[i] = vals[map[i]] / max;
    drawGray(canvas, img, N, N, 0, 1);
    bars.replaceChildren();
    const list = [tissue.fat, tissue.wm, tissue.gm, tissue.csf];
    const f = frame(bars, { box: [40, 16, 250, 240], x: [0, list.length], y: [0, Math.max(0.05, Math.ceil(max * 10) / 10)], xticks: [], yticks: [0, max / 2, max].map((v) => +v.toFixed(2)), ylabel: "signal" });
    list.forEach((ts, i) => {
      const v = sig(ts), x = f.sx(i + 0.18), w = f.sx(i + 0.82) - x;
      el("rect", { x, y: f.sy(v), width: w, height: f.T + f.H - f.sy(v), rx: 3, style: `fill:${ts.color};fill-opacity:0.8` }, bars);
      ts.name.split(" ").forEach((word, k) => text(bars, x + w / 2, f.T + f.H + 14 + k * 12, word, { "text-anchor": "middle" }));
    });
    const kind = TR < 1000 && TE < 30 ? "T1-weighted" : TR >= 2000 && TE >= 70 ? "T2-weighted" : TR >= 2000 && TE < 30 ? "proton density" : "mixed";
    const bright = list.reduce((a, b) => (sig(b) > sig(a) ? b : a));
    const gm = sig(tissue.gm), wm = sig(tissue.wm);
    o.kind.textContent = kind;
    o.bright.textContent = bright.name;
    o.gmwm.textContent = `${minus(num(((gm - wm) / (gm + wm)) * 100, 1))}% (${gm > wm ? "grey brighter" : "white brighter"})`;
  }
  draw();
}

// ============================================================ k-space

for (const root of document.querySelectorAll("[data-img-kspace]")) {
  const cImg = root.querySelector('[data-canvas="image"]');
  const cK = root.querySelector('[data-canvas="k"]');
  const cOut = root.querySelector('[data-canvas="out"]');
  const o = outs(root);
  const N = 128;
  const image = rasterize(sheppLogan(true), N);
  drawGray(cImg, image, N, N, 0, 1);
  const Kre = Float64Array.from(image), Kim = new Float64Array(N * N);
  fft2(Kre, Kim, N);
  // Round trip with nothing masked, as a check of the FFT itself.
  {
    const r = Float64Array.from(Kre), i = Float64Array.from(Kim);
    fft2(r, i, N, true);
    let e = 0;
    for (let k = 0; k < r.length; k++) e = Math.max(e, Math.abs(r[k] - image[k]), Math.abs(i[k]));
    o.err.textContent = e.toExponential(1);
  }
  let mask = "centre";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { mask = v; draw(); });

  function draw() {
    const R = (s.radius.get() / 100) * (N / 2);
    const keep = (kx, ky) => {
      const fx = kx < N / 2 ? kx : kx - N, fy = ky < N / 2 ? ky : ky - N; // signed frequency
      const r = Math.hypot(fx, fy);
      if (mask === "centre") return r <= R;
      if (mask === "edges") return r > R;
      if (mask === "skip") return (fy & 1) === 0;
      return true;
    };
    const re = new Float64Array(N * N), im = new Float64Array(N * N), view = new Float64Array(N * N);
    let kept = 0;
    for (let ky = 0; ky < N; ky++) for (let kx = 0; kx < N; kx++) {
      const k = ky * N + kx, on = keep(kx, ky);
      if (on) { re[k] = Kre[k]; im[k] = Kim[k]; kept++; }
      // Shifted log magnitude, dimmed where masked out.
      const sx = (kx + N / 2) % N, sy = (ky + N / 2) % N;
      view[sy * N + sx] = Math.log1p(Math.hypot(Kre[k], Kim[k])) * (on ? 1 : 0.18);
    }
    drawGray(cK, view, N, N, 0, range(view)[1]);
    fft2(re, im, N, true);
    const out = new Float64Array(N * N);
    let rms = 0;
    for (let k = 0; k < out.length; k++) { out[k] = Math.hypot(re[k], im[k]); rms += (out[k] - image[k]) ** 2; }
    const [lo, hi] = mask === "edges" ? range(out) : [0, 1];
    drawGray(cOut, out, N, N, lo, hi);
    o.kept.textContent = `${num((kept / (N * N)) * 100, 1)}%`;
    o.rms.textContent = num(Math.sqrt(rms / out.length), 3);
  }
  draw();
}

// ============================================================ Ultrasound

const C_SOFT = 1540; // m/s
const Z = { gel: 1.63, fat: 1.38, muscle: 1.7, bone: 7.8, liver: 1.65, air: 0.0004 };

for (const root of document.querySelectorAll("[data-img-us]")) {
  const layers = root.querySelector("[data-layers]");
  const amode = root.querySelector("[data-amode]");
  const o = outs(root);
  let deep = "bone";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { deep = v; draw(); });

  function draw() {
    const fMHz = s.freq.get(), fat = s.fat.get(), mus = s.muscle.get();
    const alpha = 0.5; // dB/cm/MHz
    const skin = 0.2;
    const interfaces = [
      { d: skin, z1: Z.gel, z2: Z.fat, name: "skin/fat" },
      { d: skin + fat, z1: Z.fat, z2: Z.muscle, name: "fat/muscle" },
      { d: skin + fat + mus, z1: Z.muscle, z2: Z[deep], name: `muscle/${deep}` },
    ];
    // Echo amplitude: reflection there, transmission through every earlier
    // interface both ways, and attenuation over the round trip.
    let trans = 1;
    const echoes = interfaces.map((it) => {
      const r = (it.z2 - it.z1) / (it.z2 + it.z1);
      const att = 10 ** ((-alpha * fMHz * 2 * it.d) / 20);
      const a = Math.abs(r) * trans * att;
      trans *= 1 - r * r;
      return { ...it, R: r * r, a, t: (2 * it.d) / 100 / C_SOFT * 1e6 };
    });
    const maxD = Math.max(12, skin + fat + mus + 3);

    layers.replaceChildren();
    const L = 40, Wd = 580, sx = (d) => L + (d / maxD) * Wd;
    const band = (d0, d1, name, op) => {
      el("rect", { x: sx(d0), y: 22, width: sx(d1) - sx(d0), height: 56, style: `fill:currentColor;fill-opacity:${op}` }, layers);
      text(layers, (sx(d0) + sx(d1)) / 2, 54, name, { "text-anchor": "middle" });
    };
    band(0, skin, "", 0.1);
    band(skin, skin + fat, "fat", 0.06);
    band(skin + fat, skin + fat + mus, "muscle", 0.14);
    band(skin + fat + mus, maxD, deep, deep === "bone" ? 0.4 : deep === "air" ? 0.02 : 0.18);
    el("rect", { x: L - 26, y: 30, width: 26, height: 40, rx: 4, style: "fill:var(--brand);fill-opacity:0.8" }, layers);
    for (let d = 0; d <= maxD; d += 2) {
      el("line", { x1: sx(d), x2: sx(d), y1: 78, y2: 84, style: "stroke:currentColor;stroke-opacity:0.4" }, layers);
      text(layers, sx(d), 96, `${d}`, { "text-anchor": "middle" });
    }
    text(layers, L + Wd, 112, "depth (cm)", { "text-anchor": "end" });

    // A-mode: the RF trace, log-compressed to 60 dB like a scanner display.
    amode.replaceChildren();
    const tMax = (2 * maxD) / 100 / C_SOFT * 1e6;
    const f = frame(amode, { box: [40, 10, 580, 160], x: [0, tMax], y: [-1, 1], xticks: [0, 50, 100, 150].filter((v) => v <= tMax), yticks: [], xlabel: "echo time (µs)" });
    const pts = [];
    const cycles = 2, dur = cycles / fMHz; // µs
    for (let i = 0; i <= 900; i++) {
      const t = (i / 900) * tMax;
      let v = 0;
      for (const e of echoes) {
        const u = (t - e.t) / dur;
        if (u > -1.5 && u < 1.5) {
          const db = Math.max(0, 60 + 20 * Math.log10(e.a + 1e-12)) / 60;
          v += db * Math.exp(-((u * 2.2) ** 2)) * Math.sin(2 * Math.PI * fMHz * (t - e.t));
        }
      }
      pts.push([f.sx(t), f.sy(Math.max(-1, Math.min(1, v)))]);
    }
    polyline(amode, pts, "stroke:var(--brand);stroke-width:1.2");
    // Labels start at their echo; a label that would run into the previous
    // one drops to a second row.
    const rowEnd = [-Infinity, -Infinity];
    for (const e of echoes) {
      const x = f.sx(e.t), label = `${e.name} R=${(e.R * 100).toPrecision(2)}%`;
      const row = x > rowEnd[0] ? 0 : 1;
      rowEnd[row] = x + label.length * 6.2;
      text(amode, x, f.T + 10 + row * 13, label);
    }

    const lambda = C_SOFT / (fMHz * 1e6) * 1000; // mm
    o.lambda.textContent = `${num(lambda, 3)} mm`;
    o.axial.textContent = `≈ ${num((cycles * lambda) / 2, 2)} mm`;
    o.pen.textContent = `≈ ${num(60 / (2 * alpha * fMHz), 1)} cm`;
    const last = echoes.at(-1);
    o.deep.textContent = `${num(last.t, 1)} µs, ${num(20 * Math.log10(last.a), 1)} dB`;
    const t = s.echo.get();
    o.depth.textContent = `${num((C_SOFT * t * 1e-6) / 2 * 100, 2)} cm`;
  }
  draw();
}

// ============================================================ PET

for (const root of document.querySelectorAll("[data-img-pet]")) {
  const svg = root.querySelector("[data-ring]");
  const canvas = root.querySelector('[data-canvas="image"]');
  const o = outs(root);
  const N = 96, RING = 90, DET = 64, CM_PER_UNIT = 40 / (2 * RING); // a 40 cm ring
  let seed = 3, rng, spots, img, count, recent;
  const s = scrubAll(root, () => o.tof.textContent = tofText());
  const tofText = () => {
    const dt = s.tof.get();
    return dt === 0 ? "no TOF (whole line)" : `Δx = c·Δt/2 = ${num(0.03 * dt / 2, 1)} cm`;
  };

  function reset() {
    rng = mulberry32(seed);
    spots = [0, 1].map(() => {
      const a = rng() * 2 * Math.PI, r = 15 + rng() * 30;
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    img = new Float64Array(N * N);
    count = 0;
    recent = [];
    draw();
  }

  // Activity: a warm disc (r 60) plus two hot spots (10× denser).
  function sampleSource() {
    if (rng() < 0.55) {
      const [cx, cy] = spots[rng() < 0.5 ? 0 : 1];
      return [cx + 4 * gauss(rng), cy + 4 * gauss(rng)];
    }
    for (;;) {
      const x = (rng() * 2 - 1) * 60, y = (rng() * 2 - 1) * 60;
      if (x * x + y * y < 3600) return [x, y];
    }
  }

  function event() {
    const [px, py] = sampleSource();
    const th = rng() * Math.PI, dx = Math.cos(th), dy = Math.sin(th);
    // Intersections of the line with the ring circle.
    const b = px * dx + py * dy, c = px * px + py * py - RING * RING;
    const root_ = Math.sqrt(b * b - c);
    const t1 = -b - root_, t2 = -b + root_;
    const snap = (t) => {
      const a = Math.atan2(py + t * dy, px + t * dx);
      const k = Math.round((a / (2 * Math.PI)) * DET);
      const aa = (k / DET) * 2 * Math.PI;
      return [RING * Math.cos(aa), RING * Math.sin(aa)];
    };
    const A = snap(t1), B = snap(t2);
    // Backproject along the detector-to-detector line, with TOF if set.
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const dtPs = s.tof.get();
    const sigma = dtPs ? (0.03 * dtPs) / 2 / CM_PER_UNIT / 2.355 : 0; // FWHM → σ, in ring units
    const ux = (B[0] - A[0]) / len, uy = (B[1] - A[1]) / len;
    const tTrue = (px - A[0]) * ux + (py - A[1]) * uy;
    const tMeas = tTrue + (sigma ? sigma * gauss(rng) : 0);
    for (let k = 0; k <= 160; k++) {
      const t = (k / 160) * len;
      const w = sigma ? Math.exp(-0.5 * ((t - tMeas) / sigma) ** 2) : 1;
      const x = A[0] + ux * t, y = A[1] + uy * t;
      const i = Math.floor(((x + RING) / (2 * RING)) * N), j = Math.floor(((RING - y) / (2 * RING)) * N);
      if (i >= 0 && j >= 0 && i < N && j < N) img[j * N + i] += w;
    }
    count++;
    recent.push([A, B, [px, py]]);
    if (recent.length > 40) recent.shift();
  }

  function draw() {
    svg.replaceChildren();
    for (let k = 0; k < DET; k++) {
      const a = (k / DET) * 2 * Math.PI;
      el("rect", { x: -3, y: -5, width: 6, height: 10, rx: 1, transform: `translate(${RING * Math.cos(a)} ${-RING * Math.sin(a)}) rotate(${(-a * 180) / Math.PI})`, style: "fill:currentColor;fill-opacity:0.35" }, svg);
    }
    el("circle", { cx: 0, cy: 0, r: 60, style: "fill:currentColor;fill-opacity:0.05;stroke:currentColor;stroke-opacity:0.2" }, svg);
    for (const [x, y] of spots) el("circle", { cx: x, cy: -y, r: 7, style: "fill:var(--brand);fill-opacity:0.2" }, svg);
    recent.forEach(([A, B, P], i) => {
      const lastOne = i === recent.length - 1;
      el("line", { x1: A[0], y1: -A[1], x2: B[0], y2: -B[1], style: `stroke:${lastOne ? "var(--brand)" : "currentColor"};stroke-opacity:${lastOne ? 0.9 : 0.12};stroke-width:${lastOne ? 1.2 : 0.6}` }, svg);
      if (lastOne) el("circle", { cx: P[0], cy: -P[1], r: 2.5, style: "fill:var(--brand)" }, svg);
    });
    drawGray(canvas, img, N, N, 0, Math.max(1e-9, range(img)[1]));
    o.count.textContent = String(count);
    o.tof.textContent = tofText();
    o.e.textContent = "511.0 keV × 2, back to back";
  }

  const act = (name, fn) => root.querySelector(`[data-action=${name}]`).addEventListener("click", fn);
  act("one", () => { event(); draw(); });
  act("many", () => { for (let k = 0; k < 500; k++) event(); draw(); });
  act("reset", reset);
  act("reseed", () => { seed++; reset(); });
  reset();
  for (let k = 0; k < 300; k++) event();
  draw();
}

// ============================================================ Image quality

for (const root of document.querySelectorAll("[data-img-quality]")) {
  const canvas = root.querySelector('[data-canvas="test"]');
  const mtfSvg = root.querySelector("[data-mtf]");
  const o = outs(root);
  const N = 128, PERIODS = [16, 12, 8, 6, 4, 3];
  let seed = 9;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  // Bars on the top half (one group per period), a disc on the bottom.
  const base = (contrast) => {
    const img = new Float64Array(N * N).fill(0.5);
    const gw = N / PERIODS.length;
    for (let j = 6; j < 58; j++) for (let i = 0; i < N; i++) {
      const g = Math.min(PERIODS.length - 1, Math.floor(i / gw)), p = PERIODS[g];
      img[j * N + i] = 0.5 + 0.25 * Math.cos((2 * Math.PI * (i - g * gw)) / p);
    }
    for (let j = 64; j < N; j++) for (let i = 0; i < N; i++) {
      if ((i - 64) ** 2 + (j - 96) ** 2 < 14 ** 2) img[j * N + i] = 0.5 * (1 + contrast);
    }
    return img;
  };
  const blur = (img, sigma) => {
    if (sigma < 0.05) return Float64Array.from(img);
    const r = Math.ceil(3 * sigma), k = [];
    for (let i = -r; i <= r; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
    const sum = k.reduce((a, b) => a + b);
    const tmp = new Float64Array(N * N), out = new Float64Array(N * N);
    const at = (a, x, y) => a[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (let i = -r; i <= r; i++) v += k[i + r] * at(img, x + i, y); tmp[y * N + x] = v / sum; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (let i = -r; i <= r; i++) v += k[i + r] * at(tmp, x, y + i); out[y * N + x] = v / sum; }
    return out;
  };

  function draw() {
    const sigma = s.sigma.get(), noise = s.noise.get() / 100, contrast = s.contrast.get() / 100;
    const clean = blur(base(contrast), sigma);
    const rng = mulberry32(seed);
    const img = clean.map((v) => v + noise * gauss(rng));
    drawGray(canvas, img, N, N, 0, 1);

    // Measured grating modulation per group (noise-free image), against the
    // MTF: the amplitude at 1/p over whole periods away from the group edges,
    // divided by the 0.25 the grating started with.
    const gw = N / PERIODS.length, meas = PERIODS.map((p, g) => {
      const a = Math.ceil(g * gw + 3 * sigma + 1), n = Math.floor((Math.floor((g + 1) * gw - 3 * sigma - 1) - a) / p) * p;
      let re = 0, im = 0;
      for (let i = a; i < a + n; i++) { const v = clean[32 * N + i], ph = (2 * Math.PI * (i - g * gw)) / p; re += v * Math.cos(ph); im += v * Math.sin(ph); }
      return [1 / p, n > 0 ? (2 * Math.hypot(re, im)) / n / 0.25 : NaN];
    }).filter(([, m]) => Number.isFinite(m));
    mtfSvg.replaceChildren();
    const f = frame(mtfSvg, { box: [40, 16, 248, 236], x: [0, 0.5], y: [0, 1], xticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yticks: [0, 0.5, 1], xlabel: "lp/pixel", ylabel: "MTF" });
    polyline(mtfSvg, Array.from({ length: 101 }, (_, i) => { const fr = i * 0.005; return [f.sx(fr), f.sy(Math.exp(-2 * Math.PI ** 2 * sigma ** 2 * fr ** 2))]; }), "stroke:var(--brand);stroke-width:1.75");
    for (const [fr, m] of meas) el("circle", { cx: f.sx(fr), cy: f.sy(Math.min(1, m)), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, mtfSvg);
    text(mtfSvg, f.L + f.W, f.T + 10, "line: theory · dots: measured", { "text-anchor": "end" });

    const fAt = (m) => (sigma < 0.05 ? Infinity : Math.sqrt(-Math.log(m) / (2 * Math.PI ** 2 * sigma ** 2)));
    const fmt = (v) => (v > 0.5 ? "beyond Nyquist" : `${num(v, 3)} lp/px`);
    o.f50.textContent = fmt(fAt(0.5));
    o.f10.textContent = fmt(fAt(0.1));
    // SNR and CNR measured from pixels: background patch and the disc.
    const stats = (pred) => {
      let n = 0, m = 0, m2 = 0;
      for (let j = 64; j < N; j++) for (let i = 0; i < N; i++) if (pred(i, j)) { const v = img[j * N + i]; n++; m += v; m2 += v * v; }
      m /= n;
      return [m, Math.sqrt(Math.max(0, m2 / n - m * m))];
    };
    const [bg, sd] = stats((i, j) => i < 30 && j > 70);
    const [disc] = stats((i, j) => (i - 64) ** 2 + (j - 96) ** 2 < 8 ** 2);
    o.snr.textContent = sd > 1e-9 ? num(bg / sd, 1) : "∞";
    o.cnr.textContent = sd > 1e-9 ? num((disc - bg) / sd, 2) : "∞";
  }
  draw();
}
