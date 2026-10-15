// Quantum physics blocks. Units are stated in each block: ħ = m = 1 for the
// wave mechanics, SI with eV and nm for the atomic and radiation blocks.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const HC = 1239.84198; // eV·nm

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A play/pause button, and a loop that only runs while its block is
// visible. Under reduced motion nothing plays by itself.
function player(root, tick) {
  const btn = root.querySelector("[data-action=play]");
  let playing = false, visible = false, raf = 0, last = 0;
  const set = (p) => {
    playing = p;
    btn.querySelector('[data-icon="play"]').hidden = p;
    btn.querySelector('[data-icon="pause"]').hidden = !p;
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Play";
    kick();
  };
  const loop = (now) => {
    const dt = Math.min(50, now - last);
    last = now;
    if (tick(dt) === false) return set(false);
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => {
    if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  btn.querySelector("[data-label]").textContent = "Play";
  btn.addEventListener("click", () => set(!playing));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return { set, get playing() { return playing; } };
}

// Approximate colour of visible light (Dan Bruton's piecewise fit), or null
// outside 380–750 nm.
function waveRGB(l, alpha = 1) {
  if (l < 380 || l > 750) return null;
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; }
  else r = 1;
  const f = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (750 - l)) / 50 : 1;
  const c = (v) => Math.round(255 * Math.pow(v * f, 0.8));
  return `rgb(${c(r)} ${c(g)} ${c(b)} / ${alpha})`;
}

const area = (pts, base, style) =>
  `M${pts[0][0]},${base} L${pts.map((p) => p.join(",")).join(" L")} L${pts.at(-1)[0]},${base} Z`;

// ============================================================ Particle in a box

for (const root of document.querySelectorAll("[data-qbox]")) {
  const svg = root.querySelector("[data-plot]");
  const lv = root.querySelector("[data-levels]");
  const o = outs(root);
  const E = (n) => (n * n * Math.PI * Math.PI) / 2;
  let t = 0, parts = true;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { parts = on; draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { t = 0; draw(); });
  // One beat period lasts about three seconds on screen.
  player(root, (ms) => { t += (ms / 3000) * period(); draw(); });

  function coeffs() {
    let c = [s.c1.get(), s.c2.get(), s.c3.get()];
    const n = Math.hypot(...c);
    return n === 0 ? [1, 0, 0] : c.map((v) => v / n);
  }
  function period() {
    const c = coeffs();
    const ns = [1, 2, 3].filter((_, i) => c[i] > 0);
    return ns.length > 1 ? (2 * Math.PI) / (E(ns[1]) - E(ns[0])) : (2 * Math.PI) / E(ns[0]);
  }

  function draw() {
    const c = coeffs();
    const N = 400;
    const pts = [];
    let norm = 0;
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      let re = 0, im = 0;
      c.forEach((cn, k) => {
        const n = k + 1, a = cn * Math.SQRT2 * Math.sin(n * Math.PI * x), ph = -E(n) * t;
        re += a * Math.cos(ph);
        im += a * Math.sin(ph);
      });
      pts.push([x, re, im, re * re + im * im]);
      norm += (i === 0 || i === N ? 0.5 : 1) * (re * re + im * im) / N;
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 460, 252], x: [-0.05, 1.05], y: [-2.6, 6.2], xticks: [0, 0.5, 1], yticks: [-2, 0, 2, 4, 6], xlabel: "x / L", yfmt: (v) => String(v).replace("-", "−") });
    for (const x of [0, 1]) el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:3;stroke-opacity:0.7" }, svg);
    const dens = pts.map((p) => [f.sx(p[0]), f.sy(p[3])]);
    el("path", { d: area(dens, f.sy(0)), style: "fill:var(--brand);fill-opacity:0.15" }, svg);
    polyline(svg, dens, "stroke:var(--brand);stroke-width:2");
    if (parts) {
      polyline(svg, pts.map((p) => [f.sx(p[0]), f.sy(p[1])]), "stroke:var(--vec-u);stroke-width:1.25");
      polyline(svg, pts.map((p) => [f.sx(p[0]), f.sy(p[2])]), "stroke:var(--vec-v);stroke-width:1.25;stroke-dasharray:4 3");
    }

    // Levels: Eₙ ∝ n², dots sized by |cₙ|².
    lv.replaceChildren();
    const ey = (e) => 280 - (e / E(4)) * 250;
    for (let n = 1; n <= 4; n++) {
      const y = ey(E(n)), on = n <= 3 && c[n - 1] > 0;
      el("line", { x1: 30, x2: 110, y1: y, y2: y, style: `stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.35};stroke-width:1.5` }, lv);
      text(lv, 24, y + 3, `n=${n}`, { "text-anchor": "end" });
      text(lv, 110, y - 4, `${num(E(n), 1)}`, { "text-anchor": "end" });
      if (on) el("circle", { cx: 70, cy: y, r: 2 + 6 * c[n - 1] ** 2, style: "fill:var(--brand)" }, lv);
    }
    text(lv, 30, 296, "E (ħ²/mL²)");

    o.t.textContent = num(t, 3);
    o.e.textContent = num(c.reduce((a, cn, k) => a + cn * cn * E(k + 1), 0), 2);
    o.norm.textContent = norm.toFixed(4);
    o.period.textContent = num(period(), 3);
  }
  draw();
}

// ============================================================ Time-dependent Schrödinger

for (const root of document.querySelectorAll("[data-tdse]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const N = 1000, dx = 0.1, dt = 0.05, X0 = 25, SIG = 4, B0 = 50;
  const xs = Float64Array.from({ length: N }, (_, j) => j * dx);
  let re, im, V, t = 0, showRe = true;
  // Crank–Nicolson: (1 + iHΔt/2) ψⁿ⁺¹ = (1 − iHΔt/2) ψⁿ, H = −½∂ₓ² + V.
  // The tridiagonal left side is factored once per potential (Thomas).
  const off = dt / (4 * dx * dx); // the off-diagonal is −i·off on the left, +i·off on the right
  let cpRe, cpIm, dnRe, dnIm; // c'ⱼ and 1/denominatorⱼ, complex
  const s = scrubAll(root, () => reset());
  const play = player(root, () => {
    for (let k = 0; k < 6; k++) step();
    draw();
    return t < 70 / s.k0.get() + 8;
  });
  onToggle(root, (_, on) => { showRe = on; draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => reset());

  function reset() {
    const k0 = s.k0.get(), V0 = s.v0.get(), a = s.a.get();
    V = Float64Array.from(xs, (x) => (x >= B0 && x < B0 + a ? V0 : 0));
    re = new Float64Array(N); im = new Float64Array(N);
    let n = 0;
    for (let j = 1; j < N - 1; j++) {
      const g = Math.exp(-((xs[j] - X0) ** 2) / (4 * SIG * SIG));
      re[j] = g * Math.cos(k0 * xs[j]);
      im[j] = g * Math.sin(k0 * xs[j]);
      n += (re[j] ** 2 + im[j] ** 2) * dx;
    }
    const sc = 1 / Math.sqrt(n);
    for (let j = 0; j < N; j++) { re[j] *= sc; im[j] *= sc; }
    // Factor A: diagonal bⱼ = 1 + i(Δt/2)(1/Δx² + Vⱼ), sub = sup = −i·off.
    cpRe = new Float64Array(N); cpIm = new Float64Array(N); dnRe = new Float64Array(N); dnIm = new Float64Array(N);
    let pRe = 0, pIm = 0; // previous c'
    for (let j = 0; j < N; j++) {
      const bRe = 1, bIm = (dt / 2) * (1 / (dx * dx) + V[j]);
      // denom = b − a·c'ⱼ₋₁ with a = −i·off: a·c' = (−i·off)(pRe + i pIm) = off·pIm − i·off·pRe
      const dRe = bRe - off * pIm, dIm = bIm + off * pRe;
      const m = dRe * dRe + dIm * dIm;
      dnRe[j] = dRe / m; dnIm[j] = -dIm / m; // 1/denom
      // c'ⱼ = c / denom with c = −i·off
      pRe = off * dnIm[j]; pIm = -off * dnRe[j];
      cpRe[j] = pRe; cpIm[j] = pIm;
    }
    t = 0;
    if (play) play.set(false);
    draw();
  }

  const dRe = new Float64Array(N), dIm = new Float64Array(N);
  function step() {
    // Right side: (1 − iHΔt/2)ψ, with ψ = 0 beyond the walls.
    for (let j = 0; j < N; j++) {
      const lRe = j > 0 ? re[j - 1] : 0, lIm = j > 0 ? im[j - 1] : 0;
      const rRe = j < N - 1 ? re[j + 1] : 0, rIm = j < N - 1 ? im[j + 1] : 0;
      const w = (dt / 2) * (1 / (dx * dx) + V[j]);
      // diag: (1 − i w)ψ ; off: +i·off·(ψⱼ₋₁ + ψⱼ₊₁)
      dRe[j] = re[j] + w * im[j] - off * (lIm + rIm);
      dIm[j] = im[j] - w * re[j] + off * (lRe + rRe);
    }
    // Forward sweep: d'ⱼ = (dⱼ − a·d'ⱼ₋₁)/denomⱼ, a = −i·off.
    let pRe = 0, pIm = 0;
    for (let j = 0; j < N; j++) {
      const nRe = dRe[j] - off * pIm, nIm = dIm[j] + off * pRe; // dⱼ − a·d'
      pRe = nRe * dnRe[j] - nIm * dnIm[j];
      pIm = nRe * dnIm[j] + nIm * dnRe[j];
      dRe[j] = pRe; dIm[j] = pIm;
    }
    // Back substitution: ψⱼ = d'ⱼ − c'ⱼψⱼ₊₁.
    re[N - 1] = dRe[N - 1]; im[N - 1] = dIm[N - 1];
    for (let j = N - 2; j >= 0; j--) {
      re[j] = dRe[j] - (cpRe[j] * re[j + 1] - cpIm[j] * im[j + 1]);
      im[j] = dIm[j] - (cpRe[j] * im[j + 1] + cpIm[j] * re[j + 1]);
    }
    t += dt;
  }

  function planeWaveT(E, V0, a) {
    if (V0 === 0 || a === 0) return 1;
    if (Math.abs(E - V0) < 1e-9) return 1 / (1 + (a * a * V0) / 2);
    if (E < V0) {
      const k = Math.sqrt(2 * (V0 - E));
      return 1 / (1 + (V0 * V0 * Math.sinh(k * a) ** 2) / (4 * E * (V0 - E)));
    }
    const k = Math.sqrt(2 * (E - V0));
    return 1 / (1 + (V0 * V0 * Math.sin(k * a) ** 2) / (4 * E * (E - V0)));
  }

  function draw() {
    const k0 = s.k0.get(), V0 = s.v0.get(), a = s.a.get();
    const Emean = (k0 * k0) / 2 + 1 / (8 * SIG * SIG);
    const rho0 = 1 / (Math.sqrt(2 * Math.PI) * SIG);
    let norm = 0, T = 0, R = 0;
    for (let j = 0; j < N; j++) {
      const p = (re[j] ** 2 + im[j] ** 2) * dx;
      norm += p;
      if (xs[j] >= B0 + a) T += p;
      if (xs[j] < B0) R += p;
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 12, 584, 252], x: [0, 100], y: [-0.7, 1.3], xticks: [0, 25, 50, 75, 100], yticks: [], xlabel: "x" });
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.2");
    // Potential and mean energy on one energy axis.
    const Emax = Math.max(V0, Emean) * 1.15 || 1;
    const vy = (v) => f.sy((v / Emax) * 1.15);
    el("rect", { x: f.sx(B0), y: vy(V0), width: Math.max(1, f.sx(B0 + a) - f.sx(B0)), height: f.sy(0) - vy(V0), style: "fill:var(--foreground);fill-opacity:0.1;stroke:var(--foreground);stroke-opacity:0.6" }, svg);
    el("line", { x1: f.L, x2: f.L + f.W, y1: vy(Emean), y2: vy(Emean), style: "stroke:var(--vec-out);stroke-dasharray:5 4" }, svg);
    text(svg, f.L + f.W - 2, vy(Emean) - 4, `⟨E⟩ ${num(Emean, 2)}`, { "text-anchor": "end" });
    if (V0 > 0) text(svg, f.sx(B0 + a) + 4, vy(V0) + 10, `V₀ ${num(V0, 2)}`);
    const step = 2;
    const dens = [];
    const rep = [];
    for (let j = 0; j < N; j += step) {
      dens.push([f.sx(xs[j]), f.sy((re[j] ** 2 + im[j] ** 2) / rho0)]);
      rep.push([f.sx(xs[j]), f.sy((re[j] / Math.sqrt(rho0)) * 0.6)]);
    }
    if (showRe) polyline(svg, rep, "stroke:var(--vec-u);stroke-width:1;stroke-opacity:0.8");
    el("path", { d: area(dens, f.sy(0)), style: "fill:var(--brand);fill-opacity:0.15" }, svg);
    polyline(svg, dens, "stroke:var(--brand);stroke-width:1.75");

    o.e.textContent = num(Emean, 3);
    o.t.textContent = `${num(T * 100, 1)}%`;
    o.r.textContent = `${num(R * 100, 1)}%`;
    o.tpw.textContent = `${num(planeWaveT(Emean, V0, a) * 100, 1)}%`;
    o.norm.textContent = norm.toFixed(5);
  }
  reset();
}

// ============================================================ Harmonic oscillator

// Normalised Hermite functions by the stable three-term recurrence
// ψₙ₊₁ = √(2/(n+1)) x ψₙ − √(n/(n+1)) ψₙ₋₁.
function hermite(n, x) {
  let p0 = Math.PI ** -0.25 * Math.exp((-x * x) / 2);
  if (n === 0) return p0;
  let p1 = Math.SQRT2 * x * p0;
  for (let k = 1; k < n; k++) {
    const p2 = Math.sqrt(2 / (k + 1)) * x * p1 - Math.sqrt(k / (k + 1)) * p0;
    p0 = p1; p1 = p2;
  }
  return p1;
}

for (const root of document.querySelectorAll("[data-qho]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "density", classical = true;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { classical = on; draw(); });
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function draw() {
    const n = Math.round(s.n.get()), En = n + 0.5, A = Math.sqrt(2 * n + 1);
    const L = A + 3.5, M = 1600;
    const xs = Array.from({ length: M + 1 }, (_, i) => -L + (2 * L * i) / M);
    const psi = xs.map((x) => hermite(n, x));
    const dx = (2 * L) / M;
    let norm = 0, outside = 0;
    psi.forEach((p, i) => { const w = p * p * dx; norm += w; if (Math.abs(xs[i]) > A) outside += w; });

    svg.replaceChildren();
    const top = En + Math.max(1.6, En * 0.45);
    const f = frame(svg, { box: [40, 14, 540, 300], x: [-L, L], y: [0, top], xticks: [-Math.floor(L), 0, Math.floor(L)], yticks: [0, Math.round(En * 2) / 2], xlabel: "x", ylabel: "E (ħω)", xfmt: (v) => String(v).replace("-", "−") });
    polyline(svg, xs.filter((x) => (x * x) / 2 <= top).map((x) => [f.sx(x), f.sy((x * x) / 2)]), "stroke:var(--foreground);stroke-width:1.5;stroke-opacity:0.6");
    hline(svg, f, En, "stroke:currentColor;stroke-opacity:0.35");
    for (const x of [-A, A]) {
      el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.sy(En), y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
      el("circle", { cx: f.sx(x), cy: f.sy(En), r: 3, style: "fill:var(--foreground)" }, svg);
    }
    // Both densities share one vertical scale, so their heights compare.
    const H = Math.max(1.2, top - En) * 0.9;
    const pmax = Math.max(...psi.map((p) => p * p));
    if (mode === "density") {
      const k = H / pmax;
      const pts = psi.map((p, i) => [f.sx(xs[i]), f.sy(En + p * p * k)]);
      el("path", { d: area(pts, f.sy(En)), style: "fill:var(--brand);fill-opacity:0.15" }, svg);
      polyline(svg, pts, "stroke:var(--brand);stroke-width:1.75");
      if (classical) {
        // P(x) = 1/(π√(A² − x²)) diverges at the turning points: stop where it leaves the plot.
        const cl = xs.filter((x) => Math.abs(x) < A && k / (Math.PI * Math.sqrt(A * A - x * x)) <= top - En).map((x) => [f.sx(x), f.sy(En + k / (Math.PI * Math.sqrt(A * A - x * x)))]);
        polyline(svg, cl, "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
      }
    } else {
      const k = (H * 0.6) / Math.sqrt(pmax);
      polyline(svg, psi.map((p, i) => [f.sx(xs[i]), f.sy(En + p * k)]), "stroke:var(--brand);stroke-width:1.75");
    }
    text(svg, f.L + f.W, f.sy(En) - 4, `n = ${n}`, { "text-anchor": "end" });
    o.e.textContent = `${num(En, 1)} ħω`;
    o.tp.textContent = `±${num(A, 3)}`;
    o.nodes.textContent = String(n);
    o.out.textContent = `${num(outside * 100, 1)}% beyond them`;
    o.norm.textContent = norm.toFixed(4);
  }
  draw();
}

// ============================================================ Double slit

for (const root of document.querySelectorAll("[data-slit]")) {
  const svg = root.querySelector("[data-plot]");
  const canvas = root.querySelector("[data-screen]");
  const o = outs(root);
  const Y = 0.02; // the screen spans ±20 mm
  let one = false, hits = [];
  const rng = mulberry32(3);
  const s = scrubAll(root, () => { hits = []; draw(); });
  onToggle(root, (_, on) => { one = on; hits = []; draw(); });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { hits = []; draw(); });

  const intensity = (y) => {
    const lam = s.lambda.get() * 1e-9, d = s.d.get() * 1e-6, a = s.w.get() * 1e-6;
    const b = (Math.PI * a * y) / lam; // L = 1 m, small angles
    const env = b === 0 ? 1 : (Math.sin(b) / b) ** 2;
    return one ? env : env * Math.cos((Math.PI * d * y) / lam) ** 2;
  };
  player(root, () => {
    // Rejection sampling from I(y) (its maximum is 1, at y = 0).
    for (let k = 0; k < 12 && hits.length < 30000; k++) {
      for (;;) {
        const y = (rng() * 2 - 1) * Y;
        if (rng() < intensity(y)) { hits.push([y, rng()]); break; }
      }
    }
    draw();
  });

  function draw() {
    const lam = s.lambda.get(), color = waveRGB(lam) ?? "var(--foreground)";
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 18, 560, 152], x: [-20, 20], y: [0, 1.05], xticks: [-20, -10, 0, 10, 20], yticks: [0, 1], xlabel: "position on screen (mm)", ylabel: "I / I₀", xfmt: (v) => String(v).replace("-", "−") });
    const pts = Array.from({ length: 801 }, (_, i) => { const y = -Y + (2 * Y * i) / 800; return [f.sx(y * 1000), f.sy(intensity(y))]; });
    el("path", { d: area(pts, f.sy(0)), style: `fill:${color};fill-opacity:0.18` }, svg);
    polyline(svg, pts, `stroke:${color};stroke-width:1.5`);

    // The screen: the faint expected pattern, then each particle's hit.
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const rgb = waveRGB(lam) ?? "rgb(255 255 255)";
    if (!hits.length) {
      for (let x = 0; x < W; x++) {
        ctx.globalAlpha = 0.85 * intensity(-Y + (2 * Y * x) / W);
        ctx.fillStyle = rgb;
        ctx.fillRect(x, 0, 1, H);
      }
    } else {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = rgb;
      const d = Math.max(1, dpr);
      for (const [y, v] of hits) ctx.fillRect(((y + Y) / (2 * Y)) * W, v * (H - d), d, d);
    }
    ctx.globalAlpha = 1;
    o.fringe.textContent = one ? "— (one slit)" : `${num((s.lambda.get() * 1e-9 / (s.d.get() * 1e-6)) * 1000, 2)} mm`;
    o.central.textContent = `${num((2 * s.lambda.get() * 1e-9 / (s.w.get() * 1e-6)) * 1000, 2)} mm`;
    o.hits.textContent = hits.length ? hits.length.toLocaleString("en") : "0";
  }
  new ResizeObserver(() => draw()).observe(canvas);
  draw();
}

// ============================================================ Bloch sphere

// Complex numbers as [re, im].
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cscale = (a, k) => [a[0] * k, a[1] * k];
const I = [0, 1];
const R2 = Math.SQRT1_2;
const GATES = {
  h: { apply: ([a, b]) => [cscale(cadd(a, b), R2), cscale(csub(a, b), R2)], axis: [R2, 0, R2], angle: Math.PI },
  x: { apply: ([a, b]) => [b, a], axis: [1, 0, 0], angle: Math.PI },
  y: { apply: ([a, b]) => [cmul([0, -1], b), cmul(I, a)], axis: [0, 1, 0], angle: Math.PI },
  z: { apply: ([a, b]) => [a, cscale(b, -1)], axis: [0, 0, 1], angle: Math.PI },
  s: { apply: ([a, b]) => [a, cmul(I, b)], axis: [0, 0, 1], angle: Math.PI / 2 },
};
const AXES = { z: [0, 0, 1], x: [1, 0, 0], y: [0, 1, 0] };

for (const root of document.querySelectorAll("[data-bloch]")) {
  const svg = root.querySelector("[data-sphere]");
  const hist = root.querySelector("[data-hist]");
  const o = outs(root);
  let axis = "z", counts = null, anim = 0;
  const s = scrubAll(root, () => { counts = null; draw(); });
  root.addEventListener("seg-change", (e) => { axis = e.detail.value; counts = null; draw(); });

  const deg = Math.PI / 180;
  const vec = () => { const th = s.theta.get() * deg, ph = s.phi.get() * deg; return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; };
  const setVec = ([x, y, z]) => {
    const th = Math.acos(Math.max(-1, Math.min(1, z)));
    let ph = Math.atan2(y, x);
    if (ph < 0) ph += 2 * Math.PI;
    s.theta.set(th / deg, false);
    if (Math.sin(th) > 1e-6) s.phi.set(Math.round(ph / deg) % 360, false);
  };
  const amps = () => {
    const th = s.theta.get() * deg, ph = s.phi.get() * deg;
    return [[Math.cos(th / 2), 0], [Math.sin(th / 2) * Math.cos(ph), Math.sin(th / 2) * Math.sin(ph)]];
  };

  // Orthographic camera: azimuth −120°, elevation 20°; y up is screen up.
  const az = -120 * deg, elv = 20 * deg;
  const proj = ([x, y, z]) => {
    const x1 = x * Math.cos(az) - y * Math.sin(az), y1 = x * Math.sin(az) + y * Math.cos(az);
    return { X: x1, Y: -(z * Math.cos(elv) + y1 * Math.sin(elv)), depth: y1 * Math.cos(elv) - z * Math.sin(elv) };
  };
  const label = (p, s2, anchor = "middle") => {
    const q = proj(p);
    const t = el("text", { x: q.X, y: q.Y, "text-anchor": anchor, "dominant-baseline": "middle", "font-size": 0.12, class: "fill-muted-foreground font-mono" }, svg);
    t.textContent = s2;
  };
  const circle = (fn, style) => {
    // A great circle, front half solid and back half dashed.
    const pts = Array.from({ length: 121 }, (_, i) => proj(fn((i / 120) * 2 * Math.PI)));
    for (const back of [true, false]) {
      let d = "";
      pts.forEach((p, i) => { const vis = back ? p.depth > 0 : p.depth <= 0; d += vis ? `${d && i && (back ? pts[i - 1].depth > 0 : pts[i - 1].depth <= 0) ? "L" : "M"}${p.X.toFixed(3)},${p.Y.toFixed(3)}` : ""; });
      el("path", { d, style: style + (back ? ";stroke-dasharray:0.04 0.04;stroke-opacity:0.35" : ""), fill: "none" }, svg);
    }
  };

  function draw(r = vec()) {
    svg.replaceChildren();
    el("circle", { cx: 0, cy: 0, r: 1, style: "fill:var(--foreground);fill-opacity:0.03;stroke:var(--foreground);stroke-opacity:0.5;stroke-width:0.012" }, svg);
    circle((t) => [Math.cos(t), Math.sin(t), 0], "stroke:var(--foreground);stroke-width:0.01");
    circle((t) => [Math.cos(t), 0, Math.sin(t)], "stroke:var(--foreground);stroke-width:0.006;stroke-opacity:0.4");
    for (const [k, v] of Object.entries(AXES)) {
      const a = proj(v.map((c) => c * 1.12)), b = proj(v.map((c) => -c * 1.12));
      el("line", { x1: b.X, y1: b.Y, x2: a.X, y2: a.Y, style: `stroke:${k === axis ? "var(--vec-out)" : "var(--foreground)"};stroke-opacity:${k === axis ? 0.9 : 0.3};stroke-width:${k === axis ? 0.014 : 0.008}` }, svg);
    }
    label([0, 0, 1.3], "|0⟩"); label([0, 0, -1.3], "|1⟩");
    label([1.32, 0, 0], "|+⟩"); label([-1.3, 0, 0], "|−⟩");
    label([0, 1.3, 0], "|+i⟩"); label([0, -1.3, 0], "|−i⟩");
    // The state: arrow, its shadow on the equator plane, and the tip.
    const tip = proj(r), foot = proj([r[0], r[1], 0]), o0 = proj([0, 0, 0]);
    el("line", { x1: o0.X, y1: o0.Y, x2: foot.X, y2: foot.Y, style: "stroke:var(--brand);stroke-opacity:0.35;stroke-width:0.01;stroke-dasharray:0.04 0.03" }, svg);
    el("line", { x1: foot.X, y1: foot.Y, x2: tip.X, y2: tip.Y, style: "stroke:var(--brand);stroke-opacity:0.35;stroke-width:0.01;stroke-dasharray:0.04 0.03" }, svg);
    el("line", { x1: o0.X, y1: o0.Y, x2: tip.X, y2: tip.Y, style: "stroke:var(--brand);stroke-width:0.03;stroke-linecap:round" }, svg);
    el("circle", { cx: tip.X, cy: tip.Y, r: 0.055, style: "fill:var(--brand);stroke:var(--background);stroke-width:0.02" }, svg);

    const [a, b] = amps();
    const n = AXES[axis];
    const pp = (1 + (r[0] * n[0] + r[1] * n[1] + r[2] * n[2])) / 2;
    const fmtC = ([re, im]) => {
      if (Math.abs(im) < 5e-4) return num(re, 3);
      if (Math.abs(re) < 5e-4) return `${num(im, 3)}i`;
      return `(${num(re, 3)} ${im < 0 ? "−" : "+"} ${num(Math.abs(im), 3)}i)`;
    };
    o.ket.textContent = `|ψ⟩ = ${fmtC(a)} |0⟩ + ${fmtC(b)} |1⟩`;
    o.pp.textContent = num(pp, 3);
    o.pm.textContent = num(1 - pp, 3);

    // Outcome histogram, with the Born-rule prediction as a tick.
    hist.replaceChildren();
    const names = axis === "z" ? ["|0⟩", "|1⟩"] : axis === "x" ? ["|+⟩", "|−⟩"] : ["|+i⟩", "|−i⟩"];
    [pp, 1 - pp].forEach((p, i) => {
      const x = 30 + i * 90, w = 60, base = 100;
      el("rect", { x, y: base - 80, width: w, height: 80, rx: 4, style: "fill:var(--foreground);fill-opacity:0.05" }, hist);
      if (counts) {
        const f = counts[i] / (counts[0] + counts[1]);
        el("rect", { x, y: base - 80 * f, width: w, height: 80 * f, rx: 4, style: "fill:var(--brand);fill-opacity:0.7" }, hist);
        text(hist, x + w / 2, base - 80 * f - 4, String(counts[i]), { "text-anchor": "middle" });
      }
      el("line", { x1: x - 4, x2: x + w + 4, y1: base - 80 * p, y2: base - 80 * p, style: "stroke:var(--foreground);stroke-width:1.5" }, hist);
      text(hist, x + w / 2, base + 14, names[i], { "text-anchor": "middle" });
    });
  }

  // Gates rotate the Bloch vector about the gate's axis; the motion shows
  // the rotation, then the amplitudes are updated exactly.
  for (const b of root.querySelectorAll("[data-gate]")) {
    b.addEventListener("click", () => {
      const g = GATES[b.dataset.gate];
      const r0 = vec();
      const [na, nb] = g.apply(amps());
      // Remove the global phase so α is real and non-negative.
      const ph = Math.atan2(na[1], na[0]);
      const rot = [Math.cos(-ph), Math.sin(-ph)];
      const a = cmul(na, rot), bb = cmul(nb, rot);
      const th = 2 * Math.acos(Math.max(-1, Math.min(1, a[0])));
      const phi = Math.atan2(bb[1], bb[0]);
      const r1 = [Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi), Math.cos(th)];
      counts = null;
      cancelAnimationFrame(anim);
      const finish = () => { setVec(r1); draw(); };
      if (reduced()) return finish();
      const [ux, uy, uz] = g.axis, t0 = performance.now();
      const rodrigues = (v, ang) => {
        const c = Math.cos(ang), s2 = Math.sin(ang), d = ux * v[0] + uy * v[1] + uz * v[2];
        const cr = [uy * v[2] - uz * v[1], uz * v[0] - ux * v[2], ux * v[1] - uy * v[0]];
        return v.map((vi, i) => vi * c + cr[i] * s2 + [ux, uy, uz][i] * d * (1 - c));
      };
      const frameFn = (now) => {
        const t = Math.min(1, (now - t0) / 450);
        const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        draw(rodrigues(r0, g.angle * e));
        if (t < 1) anim = requestAnimationFrame(frameFn); else finish();
      };
      anim = requestAnimationFrame(frameFn);
    });
  }

  const rng = mulberry32(17);
  root.querySelector("[data-action=measure]").addEventListener("click", () => {
    const r = vec(), n = AXES[axis];
    const pp = (1 + (r[0] * n[0] + r[1] * n[1] + r[2] * n[2])) / 2;
    const up = rng() < pp;
    setVec(n.map((c) => (up ? c : -c)));
    o.last.textContent = `${up ? "+" : "−"} along ${axis} (p = ${num(up ? pp : 1 - pp, 3)}): collapsed`;
    counts = null;
    draw();
  });
  root.querySelector("[data-action=many]").addEventListener("click", () => {
    const r = vec(), n = AXES[axis];
    const pp = (1 + (r[0] * n[0] + r[1] * n[1] + r[2] * n[2])) / 2;
    counts = [0, 0];
    for (let k = 0; k < 1000; k++) counts[rng() < pp ? 0 : 1]++;
    o.last.textContent = `${counts[0]} + / ${counts[1]} − on 1000 fresh copies`;
    draw();
  });
  draw();
}

// ============================================================ Uncertainty

for (const root of document.querySelectorAll("[data-uncert]")) {
  const sx = root.querySelector("[data-x]"), sp = root.querySelector("[data-p]");
  const o = outs(root);
  let shape = "gauss";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { shape = e.detail.value; draw(); });
  const N = 512, Lx = 32, dx = Lx / N;
  const xs = Array.from({ length: N }, (_, j) => -Lx / 2 + j * dx);
  const dp = (2 * Math.PI) / Lx;
  const ps = Array.from({ length: N }, (_, k) => (k - N / 2) * dp);
  // Twiddle factors for the direct DFT, computed once.
  const cosT = new Float64Array(N * N), sinT = new Float64Array(N * N);
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) { cosT[k * N + j] = Math.cos(ps[k] * xs[j]); sinT[k * N + j] = Math.sin(ps[k] * xs[j]); }

  function draw() {
    const sg = s.sx.get();
    const re = new Float64Array(N), im = new Float64Array(N);
    xs.forEach((x, j) => {
      let g;
      if (shape === "two") {
        const w = sg / 2.5, d = 1.5 * sg;
        g = Math.exp(-((x - d) ** 2) / (4 * w * w)) + Math.exp(-((x + d) ** 2) / (4 * w * w));
        re[j] = g;
      } else {
        g = Math.exp(-(x * x) / (4 * sg * sg));
        const a = shape === "chirp" ? 0.5 / (sg * sg) : 0;
        re[j] = g * Math.cos(a * x * x);
        im[j] = g * Math.sin(a * x * x);
      }
    });
    let n = 0;
    for (let j = 0; j < N; j++) n += (re[j] ** 2 + im[j] ** 2) * dx;
    for (let j = 0; j < N; j++) { re[j] /= Math.sqrt(n); im[j] /= Math.sqrt(n); }
    const px = xs.map((_, j) => re[j] ** 2 + im[j] ** 2);
    // φ(p) = (1/√2π) Σ ψ(x) e^{−ipx} Δx
    const pp = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      let a = 0, b = 0;
      for (let j = 0; j < N; j++) {
        const c = cosT[k * N + j], si = sinT[k * N + j];
        a += re[j] * c + im[j] * si;
        b += im[j] * c - re[j] * si;
      }
      pp[k] = ((a * a + b * b) * dx * dx) / (2 * Math.PI);
    }
    const moments = (vals, grid, step) => {
      let m0 = 0, m1 = 0, m2 = 0;
      vals.forEach((v, i) => { m0 += v * step; m1 += v * grid[i] * step; m2 += v * grid[i] * grid[i] * step; });
      return { norm: m0, sd: Math.sqrt(m2 / m0 - (m1 / m0) ** 2) };
    };
    const mx = moments(px, xs, dx), mp = moments(Array.from(pp), ps, dp);

    const plot = (svg, grid, vals, label, lim) => {
      svg.replaceChildren();
      const top = Math.max(...vals) * 1.12;
      const f = frame(svg, { box: [30, 12, 280, 196], x: [-lim, lim], y: [0, top], xticks: [-lim, 0, lim], yticks: [], xlabel: label, xfmt: (v) => String(v).replace("-", "−") });
      const pts = grid.map((g, i) => [g, vals[i]]).filter(([g]) => Math.abs(g) <= lim).map(([g, v]) => [f.sx(g), f.sy(v)]);
      el("path", { d: area(pts, f.sy(0)), style: "fill:var(--brand);fill-opacity:0.15" }, svg);
      polyline(svg, pts, "stroke:var(--brand);stroke-width:1.75");
      return f;
    };
    const fx = plot(sx, xs, px, "x", 8);
    const fp = plot(sp, ps, Array.from(pp), "p", 8);
    for (const [f, m, svg] of [[fx, mx, sx], [fp, mp, sp]]) {
      const y = f.T + 14;
      el("line", { x1: f.sx(-m.sd), x2: f.sx(m.sd), y1: y, y2: y, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
      for (const v of [-m.sd, m.sd]) el("line", { x1: f.sx(v), x2: f.sx(v), y1: y - 4, y2: y + 4, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
      text(svg, f.sx(m.sd) + 4, y + 3, "±σ");
    }
    text(sx, 4, 10, "|ψ(x)|²");
    text(sp, 4, 10, "|φ(p)|²");
    const prod = mx.sd * mp.sd;
    o.sx.textContent = num(mx.sd, 3);
    o.sp.textContent = num(mp.sd, 3);
    o.prod.textContent = num(prod, 3);
    o.bound.textContent = prod < 0.5005 ? "at the bound ħ/2" : `${num(prod / 0.5, 2)} × ħ/2`;
  }
  draw();
}

// ============================================================ Hydrogen

const R_H = 1.09677583e7; // m⁻¹
const RY_EV = 13.598; // eV, hydrogen (reduced mass)
const SERIES = { 1: "Lyman", 2: "Balmer", 3: "Paschen", 4: "Brackett", 5: "Pfund", 6: "Humphreys" };
const lambdaNm = (nu, nl) => 1e9 / (R_H * (1 / (nl * nl) - 1 / (nu * nu)));

for (const root of document.querySelectorAll("[data-hydrogen]")) {
  const lv = root.querySelector("[data-levels]");
  const sp = root.querySelector("[data-spectrum]");
  const o = outs(root);
  const s = scrubAll(root, (name) => {
    if (s.nl.get() >= s.nu.get()) name === "nu" ? s.nl.set(s.nu.get() - 1, false) : s.nu.set(s.nl.get() + 1, false);
    draw();
  });
  const pick = (nu, nl) => { s.nu.set(nu, false); s.nl.set(nl, false); draw(); };

  function draw() {
    const nu = Math.round(s.nu.get()), nl = Math.round(s.nl.get());
    const lam = lambdaNm(nu, nl), color = waveRGB(lam) ?? "var(--brand)";

    // Level diagram, linear in energy.
    lv.replaceChildren();
    const ey = (e) => 20 + ((e + RY_EV) / RY_EV) * 270;
    for (let n = 1; n <= 7; n++) {
      const y = 310 - ey(-RY_EV / (n * n)) + 20;
      const on = n === nu || n === nl;
      el("line", { x1: 46, x2: 200, y1: y, y2: y, "data-n": n, style: `stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.35};stroke-width:${on ? 2 : 1}` }, lv);
      if (n <= 4 || on) {
        text(lv, 40, y + 3, `n=${n}`, { "text-anchor": "end" });
        text(lv, 200, y - 3, `${num(-RY_EV / (n * n), 2)} eV`, { "text-anchor": "end" });
      }
    }
    text(lv, 200, 34, "0 eV (ionised)", { "text-anchor": "end" });
    el("line", { x1: 46, x2: 200, y1: 40, y2: 40, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, lv);
    const yU = 310 - ey(-RY_EV / (nu * nu)) + 20, yL = 310 - ey(-RY_EV / (nl * nl)) + 20;
    el("line", { x1: 110, x2: 110, y1: yU, y2: yL - 6, style: `stroke:${color};stroke-width:2.5` }, lv);
    el("path", { d: `M104 ${yL - 8} L110 ${yL} L116 ${yL - 8} Z`, style: `fill:${color}` }, lv);

    // Spectrum: one row per series on a log wavelength axis.
    sp.replaceChildren();
    const lo = Math.log10(80), hi = Math.log10(2200);
    const lx = (l) => 30 + ((Math.log10(l) - lo) / (hi - lo)) * 360;
    // The visible band.
    const grad = el("linearGradient", { id: "h-vis", x1: 0, x2: 1, y1: 0, y2: 0 }, el("defs", {}, sp));
    for (let l = 380; l <= 750; l += 20) el("stop", { offset: (lx(l) - lx(380)) / (lx(750) - lx(380)), "stop-color": waveRGB(l) }, grad);
    el("rect", { x: lx(380), y: 10, width: lx(750) - lx(380), height: 180, rx: 3, fill: "url(#h-vis)", "fill-opacity": 0.18 }, sp);
    text(sp, (lx(380) + lx(750)) / 2, 8, "visible", { "text-anchor": "middle" });
    [1, 2, 3].forEach((n0, row) => {
      const y0 = 26 + row * 58;
      text(sp, 30, y0 - 4, `${SERIES[n0]} (→ n=${n0})`);
      el("line", { x1: 30, x2: 390, y1: y0 + 34, y2: y0 + 34, style: "stroke:currentColor;stroke-opacity:0.2" }, sp);
      for (let m = n0 + 1; m <= 8; m++) {
        const l = lambdaNm(m, n0), x = lx(l), sel = m === nu && n0 === nl;
        const line = el("line", { x1: x, x2: x, y1: y0 + 4, y2: y0 + 34, style: `stroke:${waveRGB(l) ?? "var(--foreground)"};stroke-opacity:${sel ? 1 : 0.6};stroke-width:${sel ? 3 : 1.5};cursor:pointer` }, sp);
        if (m <= 7) line.addEventListener("click", () => pick(m, n0));
        if (sel) text(sp, x, y0 + 46, `${num(l, 1)} nm`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      }
      // Series limit, n → ∞.
      const lim = 1e9 / (R_H / (n0 * n0));
      el("line", { x1: lx(lim), x2: lx(lim), y1: y0 + 4, y2: y0 + 34, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 2" }, sp);
    });
    for (const l of [100, 200, 500, 1000, 2000]) text(sp, lx(l), 214, String(l), { "text-anchor": "middle" });
    text(sp, 390, 226, "λ (nm, log scale)", { "text-anchor": "end" });

    o.de.textContent = `${num(HC / lam, 3)} eV`;
    o.lambda.textContent = `${num(lam, 2)} nm`;
    o.series.textContent = SERIES[nl] ?? `→ n=${nl}`;
    o.region.textContent = lam < 380 ? "ultraviolet" : lam <= 750 ? "visible" : "infrared";
  }
  draw();
}

// ============================================================ Photoelectric effect

for (const root of document.querySelectorAll("[data-photo]")) {
  const tube = root.querySelector("[data-tube]"), plot = root.querySelector("[data-plot]");
  const o = outs(root);
  let phi = 2.28, electrons = [], acc = 0;
  const rng = mulberry32(9);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { phi = Number(e.detail.value); draw(); });

  const state = () => {
    const E = HC / s.lambda.get(), K = E - phi;
    return { E, K, emits: K > 0 && s.intensity.get() > 0 };
  };

  function drawTube() {
    const { K, emits } = state();
    const lam = s.lambda.get(), color = waveRGB(lam) ?? "var(--vec-v)";
    tube.replaceChildren();
    el("rect", { x: 40, y: 50, width: 14, height: 130, rx: 2, style: "fill:var(--foreground);fill-opacity:0.6" }, tube);
    el("rect", { x: 270, y: 50, width: 10, height: 130, rx: 2, style: "fill:var(--foreground);fill-opacity:0.25" }, tube);
    text(tube, 47, 196, "metal", { "text-anchor": "middle" });
    text(tube, 275, 196, "collector", { "text-anchor": "middle" });
    // Incoming light: three wavy rays aimed at the plate; brighter light,
    // more opaque rays. The wiggle's period grows with the wavelength.
    const I = s.intensity.get() / 100;
    for (let k = 0; k < 3; k++) {
      const [x0, y0, x1, y1] = [150 + k * 26, 8, 58, 70 + k * 40];
      const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const wl = 6 + (lam / 800) * 12;
      let d = "";
      for (let u = 0; u <= len; u += 1) {
        const a = 3 * Math.sin((u / wl) * 2 * Math.PI);
        d += (u ? "L" : "M") + `${(x0 + ux * u - uy * a).toFixed(1)},${(y0 + uy * u + ux * a).toFixed(1)}`;
      }
      el("path", { d, style: `fill:none;stroke:${color};stroke-width:1.5;stroke-opacity:${0.12 + 0.88 * I}` }, tube);
    }
    if (lam < 380) text(tube, 230, 20, "ultraviolet", { "text-anchor": "middle" });
    for (const e of electrons) el("circle", { cx: e.x, cy: e.y, r: 3, style: "fill:var(--vec-u)" }, tube);
    if (!emits) text(tube, 160, 120, s.intensity.get() > 0 ? "no electrons: hf < φ" : "no light", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
  }

  function drawPlot() {
    const { E, K } = state();
    plot.replaceChildren();
    const fTHz = (e) => e / 4.135667696e-15 / 1e12; // eV → THz
    const f = frame(plot, { box: [36, 12, 270, 172], x: [300, 2000], y: [0, 6], xticks: [500, 1000, 1500, 2000], yticks: [0, 2, 4, 6], xlabel: "frequency (THz)", ylabel: "K_max (eV)" });
    const f0 = fTHz(phi);
    polyline(plot, [[f.sx(300), f.sy(0)], [f.sx(Math.min(2000, f0)), f.sy(0)]], "stroke:var(--foreground);stroke-width:1.5;stroke-opacity:0.5");
    // K = hf − φ, drawn until it leaves the plot.
    const fEnd = Math.min(2000, fTHz(6 + phi));
    if (f0 < 2000) polyline(plot, [[f.sx(f0), f.sy(0)], [f.sx(fEnd), f.sy(fEnd * 1e12 * 4.135667696e-15 - phi)]], "stroke:var(--foreground);stroke-width:1.75");
    el("line", { x1: f.sx(f0), x2: f.sx(f0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, plot);
    text(plot, f.sx(f0) + 3, f.T + 10, "threshold");
    const fx = fTHz(E);
    el("circle", { cx: f.sx(Math.min(2000, fx)), cy: f.sy(Math.max(0, Math.min(6, K))), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, plot);
    text(plot, f.L + f.W, f.T + f.H - 6, "slope = h", { "text-anchor": "end" });
  }

  function draw() {
    const { E, K } = state();
    drawTube();
    drawPlot();
    o.ephoton.textContent = `${num(E, 2)} eV`;
    o.phi.textContent = `≈ ${num(phi, 2)} eV`;
    o.kmax.textContent = K > 0 ? `${num(K, 2)} eV` : "0 (below threshold)";
    o.vstop.textContent = K > 0 ? `${num(K, 2)} V` : "—";
    o.lthresh.textContent = `${num(HC / phi, 0)} nm`;
  }

  // Electrons leave at a rate set by intensity and a speed set by K_max.
  let raf = 0, visible = false, last = 0;
  const loop = (now) => {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    const { K, emits } = state();
    if (emits) {
      acc += dt * 30 * (s.intensity.get() / 100);
      while (acc >= 1) { acc--; electrons.push({ x: 56, y: 60 + rng() * 110, v: 60 + 120 * Math.sqrt(K) }); }
    }
    electrons = electrons.filter((e) => (e.x += e.v * dt) < 268);
    drawTube();
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && !reduced()) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(root);
  draw();
}

// ============================================================ Blackbody

const H_ = 6.62607015e-34, C_ = 2.99792458e8, K_ = 1.380649e-23, SIGMA = 5.670374419e-8, WIEN = 2.897771955e-3;
const planck = (lnm, T) => { const l = lnm * 1e-9; return (2 * H_ * C_ * C_) / l ** 5 / Math.expm1((H_ * C_) / (l * K_ * T)); };
const rayleighJeans = (lnm, T) => { const l = lnm * 1e-9; return (2 * C_ * K_ * T) / l ** 4; };

for (const root of document.querySelectorAll("[data-blackbody]")) {
  const svg = root.querySelector("[data-plot]");
  const swatch = root.querySelector("[data-swatch]");
  const o = outs(root);
  const show = { rj: true, sun: false };
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { show[k] = on; draw(); });
  const unit = 1e-12; // W·sr⁻¹·m⁻³ → kW·sr⁻¹·m⁻²·nm⁻¹

  function draw() {
    const T = s.temp.get();
    const lams = Array.from({ length: 300 }, (_, i) => 100 + (i * 2900) / 299);
    const pk = (t) => planck((WIEN / t) * 1e9, t) * unit;
    const top = Math.max(pk(T), show.sun ? pk(5772) : 0) * 1.15;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 28, 572, 248], x: [100, 3000], y: [0, top], xticks: [500, 1000, 1500, 2000, 2500, 3000], yticks: [0, top / 2, top].map((v) => +v.toPrecision(2)), xlabel: "wavelength (nm)", ylabel: "B_λ", yfmt: (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2)) });
    const clipId = "bb-clip";
    el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id: clipId }, el("defs", {}, svg)));
    const g = el("g", { "clip-path": `url(#${clipId})` }, svg);
    for (let l = 380; l < 750; l += 5) el("rect", { x: f.sx(l), y: f.T, width: f.sx(l + 5) - f.sx(l) + 0.5, height: f.H, style: `fill:${waveRGB(l + 2.5)};fill-opacity:0.12` }, g);
    if (show.sun) polyline(g, lams.map((l) => [f.sx(l), f.sy(planck(l, 5772) * unit)]), "stroke:var(--foreground);stroke-width:1.25;stroke-dasharray:4 3;stroke-opacity:0.7");
    if (show.rj) polyline(g, lams.map((l) => [f.sx(l), f.sy(Math.min(top * 2, rayleighJeans(l, T) * unit))]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:6 4");
    const pts = lams.map((l) => [f.sx(l), f.sy(planck(l, T) * unit)]);
    el("path", { d: area(pts, f.sy(0)), style: "fill:var(--brand);fill-opacity:0.12" }, g);
    polyline(g, pts, "stroke:var(--brand);stroke-width:2");
    const lp = (WIEN / T) * 1e9;
    if (lp >= 100) {
      el("line", { x1: f.sx(lp), x2: f.sx(lp), y1: f.sy(pk(T)), y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:2 3" }, g);
      text(svg, f.sx(lp) + 4, f.sy(pk(T)) - 4, `λ_max ${num(lp, 0)} nm`);
    }
    // A rough glow colour: Planck at 450, 550 and 650 nm as B, G, R.
    const rgb = [650, 550, 450].map((l) => planck(l, T));
    const m = Math.max(...rgb);
    swatch.style.background = `rgb(${rgb.map((v) => Math.round(255 * (v / m) ** 0.45)).join(" ")})`;
    o.peak.textContent = `${num(lp, 0)} nm`;
    o.total.textContent = `${num((SIGMA * T ** 4) / 1e6, 2)} MW/m²`;
  }
  draw();
}
