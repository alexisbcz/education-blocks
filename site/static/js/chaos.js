// Chaos & fractals: logistic map, bifurcations and Feigenbaum's δ, the
// Lorenz attractor, a double pendulum, Mandelbrot and Julia sets, strange
// attractors, the chaos game, the Koch snowflake with box counting,
// L-systems and cellular automata. Every picture is computed here.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Colours: CSS custom properties resolved to [r, g, b] by painting a pixel,
// since ImageData needs numbers.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
const css = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
const palette = () => ({
  fg: rgbOf("var(--foreground)"), bg: rgbOf("var(--code-bg)"), brand: rgbOf("var(--brand)"),
  u: rgbOf("var(--vec-u)"), muted: rgbOf("var(--muted-foreground)"),
});
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

// Sizes a canvas to its box at the device pixel ratio (capped at 2).
function fit(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return canvas.getContext("2d");
}

// A play button (data-action=play) whose icon and label follow the state.
function playButton(btn, labels) {
  const label = btn.querySelector("[data-label]");
  const first = labels?.[0] ?? label.textContent;
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    label.textContent = playing ? labels?.[1] ?? "Pause" : first;
  };
}

// A requestAnimationFrame loop that only runs while its block is on screen.
function loop(root, tick, onStop) {
  let raf = 0, playing = false, visible = false, last = 0;
  const frameFn = (now) => {
    const dt = Math.min(50, now - last);
    last = now;
    const go = tick(dt) !== false;
    if (!go) { set(false); return; }
    raf = playing && visible ? requestAnimationFrame(frameFn) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frameFn); } };
  const set = (p) => {
    playing = p;
    if (!p && raf) { cancelAnimationFrame(raf); raf = 0; }
    onStop?.(p);
    kick();
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; } kick(); }).observe(root);
  return { set, get playing() { return playing; } };
}

// ============================================================ Logistic map

const logistic = (r, x) => r * x * (1 - x);

// detectCycle iterates past the transient and looks for a period ≤ 64.
function detectCycle(r, x0) {
  let x = x0;
  for (let i = 0; i < 4000; i++) x = logistic(r, x);
  if (!Number.isFinite(x)) return { period: 0, values: [] };
  const orbit = [x];
  for (let i = 0; i < 128; i++) { x = logistic(r, x); orbit.push(x); }
  for (let p = 1; p <= 64; p++) {
    if (orbit.slice(0, 64).every((v, i) => Math.abs(v - orbit[i + p]) < 1e-7)) return { period: p, values: orbit.slice(0, p).sort((a, b) => a - b) };
  }
  return { period: Infinity, values: [] };
}

for (const root of document.querySelectorAll("[data-chaos-logistic]")) {
  const cob = root.querySelector("[data-cobweb]");
  const ser = root.querySelector("[data-series]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { s.r.set(Number(b.dataset.preset), false); draw(); }));

  function draw() {
    const r = s.r.get(), x0 = s.x0.get(), n = Math.round(s.n.get());
    const xs = [x0];
    for (let i = 0; i < n; i++) xs.push(logistic(r, xs[i]));

    cob.replaceChildren();
    const f = frame(cob, { box: [34, 10, 256, 256], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], xlabel: "xₙ", ylabel: "xₙ₊₁" });
    el("line", { x1: f.sx(0), y1: f.sy(0), x2: f.sx(1), y2: f.sy(1), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4" }, cob);
    polyline(cob, Array.from({ length: 101 }, (_, i) => [f.sx(i / 100), f.sy(logistic(r, i / 100))]), "stroke:var(--vec-u);stroke-width:1.75");
    const web = [[f.sx(x0), f.sy(0)]];
    for (let i = 0; i < Math.min(n, 80); i++) {
      web.push([f.sx(xs[i]), f.sy(xs[i + 1])], [f.sx(xs[i + 1]), f.sy(xs[i + 1])]);
    }
    polyline(cob, web, "stroke:var(--brand);stroke-width:1;stroke-opacity:0.85");

    ser.replaceChildren();
    const g = frame(ser, { box: [34, 10, 376, 256], x: [0, n], y: [0, 1], xticks: [0, Math.round(n / 2), n], yticks: [0, 0.5, 1], xlabel: "n", ylabel: "xₙ" });
    polyline(ser, xs.map((x, i) => [g.sx(i), g.sy(x)]), "stroke:var(--foreground);stroke-width:1;stroke-opacity:0.5");
    if (n <= 120) for (const [i, x] of xs.entries()) el("circle", { cx: g.sx(i), cy: g.sy(x), r: 2, style: "fill:var(--brand)" }, ser);

    const c = detectCycle(r, x0);
    o.kind.textContent = r < 1 ? "dies out (x → 0)" : c.period === 1 ? "settles on a fixed point" : Number.isFinite(c.period) ? `cycle of period ${c.period}` : "chaotic: no cycle ≤ 64";
    o.cycle.textContent = c.values.length && c.values.length <= 4 ? c.values.map((v) => num(v, 4)).join(" / ") : c.values.length ? `${c.values.length} values` : "—";
    const fx = 1 - 1 / r;
    o.fixed.textContent = r > 1 ? `x* = ${num(fx, 4)}, |f′| = ${num(Math.abs(2 - r), 3)} (${Math.abs(2 - r) < 1 ? "stable" : "unstable"})` : "x* = 0";
  }
  draw();
}

// ============================================================ Bifurcation

// superstable finds R_n where x = 1/2 belongs to a cycle of period 2^n:
// Newton's method on g(r) = f_r^(2^n)(1/2) − 1/2, with dg/dr carried along
// the iteration exactly (forward-mode derivative).
function superstable(n, guess) {
  let r = guess;
  for (let it = 0; it < 60; it++) {
    let x = 0.5, dx = 0;
    for (let k = 0; k < 2 ** n; k++) {
      const nx = r * x * (1 - x);
      dx = x * (1 - x) + r * (1 - 2 * x) * dx;
      x = nx;
    }
    const step = (x - 0.5) / dx;
    r -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return r;
}

function lyapunov(r) {
  let x = 0.4, sum = 0;
  for (let i = 0; i < 300; i++) x = logistic(r, x);
  for (let i = 0; i < 1000; i++) { x = logistic(r, x); sum += Math.log(Math.abs(r * (1 - 2 * x)) + 1e-300); }
  return sum / 1000;
}

for (const root of document.querySelectorAll("[data-chaos-bifurcation]")) {
  const canvas = root.querySelector("[data-canvas]");
  const lyapSvg = root.querySelector("[data-lyap]");
  const cursor = root.querySelector("[data-cursor]");
  const o = outs(root);
  let job = 0, colors = palette();
  const s = scrubAll(root, () => render());
  root.querySelector("[data-action=zoom]").addEventListener("click", () => { s.rmin.set(3.54, false); s.rmax.set(3.58, false); render(); });

  // Feigenbaum table.
  const R = [2, 1 + Math.sqrt(5)];
  for (let n = 2; n <= 8; n++) R.push(superstable(n, R[n - 1] + (R[n - 1] - R[n - 2]) / 4.6692));
  root.querySelector("[data-feigen]").replaceChildren(...R.map((r, n) => {
    const tr = document.createElement("tr");
    const ratio = n >= 2 ? (R[n - 1] - R[n - 2]) / (r - R[n - 1]) : null;
    for (const v of [String(n), r.toFixed(10), ratio ? ratio.toFixed(4) : "—"]) {
      const td = document.createElement("td");
      td.textContent = v;
      if (v === (ratio ? ratio.toFixed(4) : "—")) td.className = "text-right";
      tr.append(td);
    }
    return tr;
  }));

  function render() {
    const id = ++job;
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height;
    const lo = Math.min(s.rmin.get(), s.rmax.get() - 0.001), hi = Math.max(s.rmax.get(), lo + 0.001);
    const img = ctx.createImageData(W, H);
    const counts = new Uint16Array(W * H);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = colors.bg[0]; img.data[i + 1] = colors.bg[1]; img.data[i + 2] = colors.bg[2]; img.data[i + 3] = 255; }
    let col = 0;
    const chunk = () => {
      if (id !== job) return;
      const t0 = performance.now();
      for (; col < W && performance.now() - t0 < 24; col++) {
        const r = lo + ((col + 0.5) / W) * (hi - lo);
        let x = 0.5;
        for (let i = 0; i < 400; i++) x = logistic(r, x);
        for (let i = 0; i < 300; i++) {
          x = logistic(r, x);
          const y = Math.min(H - 1, Math.max(0, Math.floor((1 - x) * H)));
          const k = y * W + col;
          const c = ++counts[k];
          const a = Math.min(1, 0.25 + 0.15 * c);
          const p = k * 4;
          for (let ch = 0; ch < 3; ch++) img.data[p + ch] = colors.bg[ch] * (1 - a) + colors.fg[ch] * a;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (col < W) requestAnimationFrame(chunk);
    };
    chunk();

    lyapSvg.replaceChildren();
    const f = frame(lyapSvg, { box: [40, 18, 576, 90], x: [lo, hi], y: [-3, 1], xticks: [lo, (lo + hi) / 2, hi], yticks: [-3, 0, 1], xfmt: (v) => num(v, 3), yfmt: (v) => String(v).replace("-", "−"), ylabel: "λ" });
    hline(lyapSvg, f, 0, "stroke:currentColor;stroke-opacity:0.4");
    const pts = Array.from({ length: 400 }, (_, i) => { const r = lo + (i / 399) * (hi - lo); return [f.sx(r), f.sy(Math.max(-3, Math.min(1, lyapunov(r))))]; });
    polyline(lyapSvg, pts, "stroke:var(--brand);stroke-width:1.25");
  }

  canvas.parentElement.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    const fx = (e.clientX - b.left) / b.width;
    if (fx < 0 || fx > 1) return;
    const lo = s.rmin.get(), hi = s.rmax.get();
    const r = lo + fx * (hi - lo);
    cursor.style.left = `${fx * 100}%`;
    cursor.style.opacity = "0.7";
    o.r.textContent = num(r, 4);
    const l = lyapunov(r);
    o.lambda.textContent = `${num(l, 3)} (${l > 0.005 ? "chaotic" : "stable"})`;
  });
  canvas.parentElement.addEventListener("pointerleave", () => (cursor.style.opacity = "0"));
  new ResizeObserver(() => render()).observe(canvas);
  onTheme(() => { colors = palette(); render(); });
}

// ============================================================ Lorenz

for (const root of document.querySelectorAll("[data-chaos-lorenz]")) {
  const canvas = root.querySelector("[data-canvas]");
  const sepSvg = root.querySelector("[data-sep]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"));
  const s = scrubAll(root, () => reset());
  let colors = palette();
  let A, B, trailA, trailB, t, seps, yaw = 0, pitch = 0.12;
  const DT = 0.005, TMAX = 60;

  const deriv = ([x, y, z], sg, rh, be) => [sg * (y - x), x * (rh - z) - y, x * y - be * z];
  function rk4(p) {
    const sg = s.sigma.get(), rh = s.rho.get(), be = s.beta.get();
    const k1 = deriv(p, sg, rh, be);
    const k2 = deriv(p.map((v, i) => v + (DT / 2) * k1[i]), sg, rh, be);
    const k3 = deriv(p.map((v, i) => v + (DT / 2) * k2[i]), sg, rh, be);
    const k4 = deriv(p.map((v, i) => v + DT * k3[i]), sg, rh, be);
    return p.map((v, i) => v + (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  function step(n) {
    for (let i = 0; i < n; i++) {
      A = rk4(A); B = rk4(B); t += DT;
      if (i % 2 === 0) { trailA.push(A); trailB.push(B); }
      if (Math.round(t / DT) % 10 === 0) seps.push([t, Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])]);
    }
    const cap = 6000;
    if (trailA.length > cap) { trailA.splice(0, trailA.length - cap); trailB.splice(0, trailB.length - cap); }
  }
  function reset() {
    const eps = 10 ** s.eps.get();
    // Settle onto the attractor first, then split the pair.
    A = [1, 1, 1];
    for (let i = 0; i < 4000; i++) A = rk4(A);
    B = [A[0] + eps, A[1], A[2]]; t = 0; trailA = [A]; trailB = [B]; seps = [[0, eps]];
    runner.set(false);
    step(Math.round(16 / DT)); // a still: the pair just starting to part
    draw();
  }
  function project([x, y, z]) {
    const cz = z - 25;
    const x1 = x * Math.cos(yaw) - y * Math.sin(yaw), y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
    return [x1, cz * Math.cos(pitch) - y1 * Math.sin(pitch)];
  }
  function draw() {
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height, sc = Math.min(W, H) / 62;
    ctx.fillStyle = css(colors.bg);
    ctx.fillRect(0, 0, W, H);
    for (const [trail, c] of [[trailA, colors.brand], [trailB, colors.u]]) {
      ctx.beginPath();
      trail.forEach((p, i) => { const [u, v] = project(p); const X = W / 2 + u * sc, Y = H / 2 - v * sc; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.strokeStyle = css(c, 0.75);
      ctx.lineWidth = Math.max(1, W / 700);
      ctx.stroke();
      const [u, v] = project(trail.at(-1));
      ctx.beginPath(); ctx.arc(W / 2 + u * sc, H / 2 - v * sc, Math.max(3, W / 180), 0, 2 * Math.PI); ctx.fillStyle = css(c); ctx.fill();
    }
    sepSvg.replaceChildren();
    const f = frame(sepSvg, { box: [40, 18, 590, 86], x: [0, Math.max(TMAX, t)], y: [-12, 2], xticks: [0, 20, 40, 60].filter((v) => v <= Math.max(TMAX, t)), yticks: [-12, -8, -4, 0], yfmt: (v) => `1e${v}`.replace("-", "−"), xlabel: "t", ylabel: "distance" });
    polyline(sepSvg, seps.map(([tt, d]) => [f.sx(tt), f.sy(Math.max(-12, Math.min(2, Math.log10(d))))]), "stroke:var(--brand);stroke-width:1.25");
    const d = seps.at(-1)[1];
    o.t.textContent = num(t, 1);
    o.d.textContent = d.toExponential(2);
    // Growth rate: slope of ln d over the stretch where it grows freely.
    const fitPts = seps.filter(([, dd]) => dd > 10 ** (s.eps.get() + 1) && dd < 1);
    if (fitPts.length > 10) {
      const n = fitPts.length, mx = fitPts.reduce((a, p) => a + p[0], 0) / n, my = fitPts.reduce((a, p) => a + Math.log(p[1]), 0) / n;
      const slope = fitPts.reduce((a, p) => a + (p[0] - mx) * (Math.log(p[1]) - my), 0) / fitPts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
      o.rate.textContent = `≈ ${num(slope, 2)} per unit time (largest Lyapunov exponent ≈ 0.91)`;
    } else o.rate.textContent = "—";
  }

  const runner = loop(root, () => { step(8); draw(); if (t > 400) return false; }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (reduced()) { step(Math.round(20 / DT)); draw(); return; }
    runner.set(!runner.playing);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * 0.01));
    draw();
  });
  canvas.addEventListener("pointerup", () => (drag = null));
  new ResizeObserver(() => A && draw()).observe(canvas);
  onTheme(() => { colors = palette(); draw(); });
  reset();
}

// ============================================================ Double pendulum

for (const root of document.querySelectorAll("[data-chaos-pendulum]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"));
  const s = scrubAll(root, () => reset());
  const G = 9.81, DT = 0.001;
  let colors = palette(), P, t, E0, trails;

  // Equal masses and lengths (m = 1 kg, l = 1 m); state [θ1, θ2, ω1, ω2].
  function deriv([a, b, w1, w2]) {
    const d = a - b, den = 3 - Math.cos(2 * d);
    const a1 = (-3 * G * Math.sin(a) - G * Math.sin(a - 2 * b) - 2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den;
    const a2 = (2 * Math.sin(d) * (2 * w1 * w1 + 2 * G * Math.cos(a) + w2 * w2 * Math.cos(d))) / den;
    return [w1, w2, a1, a2];
  }
  function rk4(p) {
    const k1 = deriv(p);
    const k2 = deriv(p.map((v, i) => v + (DT / 2) * k1[i]));
    const k3 = deriv(p.map((v, i) => v + (DT / 2) * k2[i]));
    const k4 = deriv(p.map((v, i) => v + DT * k3[i]));
    return p.map((v, i) => v + (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  const energy = ([a, b, w1, w2]) => w1 * w1 + 0.5 * w2 * w2 + w1 * w2 * Math.cos(a - b) - 2 * G * Math.cos(a) - G * Math.cos(b);
  function reset() {
    const r = Math.PI / 180, gap = 10 ** s.gap.get();
    P = [[s.t1.get() * r, s.t2.get() * r, 0, 0], [s.t1.get() * r + gap, s.t2.get() * r, 0, 0]];
    t = 0; E0 = energy(P[0]); trails = [[], []];
    runner?.set(false);
    draw();
  }
  function draw() {
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height, L = Math.min(W, H) * 0.22, ox = W / 2, oy = H * 0.42;
    ctx.fillStyle = css(colors.bg);
    ctx.fillRect(0, 0, W, H);
    P.forEach((p, k) => {
      const c = k ? colors.u : colors.brand;
      const x1 = ox + L * Math.sin(p[0]), y1 = oy + L * Math.cos(p[0]);
      const x2 = x1 + L * Math.sin(p[1]), y2 = y1 + L * Math.cos(p[1]);
      const tr = trails[k];
      ctx.beginPath();
      tr.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = css(c, 0.35); ctx.lineWidth = Math.max(1, W / 600); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = css(c, 0.9); ctx.lineWidth = Math.max(2, W / 240); ctx.stroke();
      for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, Math.max(5, W / 90), 0, 2 * Math.PI); ctx.fillStyle = css(c); ctx.fill(); }
    });
    ctx.beginPath(); ctx.arc(ox, oy, Math.max(3, W / 200), 0, 2 * Math.PI); ctx.fillStyle = css(colors.fg); ctx.fill();
    let d = Math.abs(P[0][0] - P[1][0]) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    o.t.textContent = `${num(t, 2)} s`;
    o.d.textContent = d < 1e-3 ? d.toExponential(1) + " rad" : `${num((d * 180) / Math.PI, 1)}°`;
    o.drift.textContent = `${((energy(P[0]) - E0) / Math.abs(E0) * 100).toExponential(1)} %`;
  }
  const runner = loop(root, (ms) => {
    const steps = Math.round(Math.min(ms, 34) / 1000 / DT);
    for (let i = 0; i < steps; i++) { P = P.map(rk4); t += DT; }
    const W = canvas.width, H = canvas.height, L = Math.min(W, H) * 0.22;
    P.forEach((p, k) => {
      const x = W / 2 + L * (Math.sin(p[0]) + Math.sin(p[1])), y = H * 0.42 + L * (Math.cos(p[0]) + Math.cos(p[1]));
      trails[k].push([x, y]);
      if (trails[k].length > 400) trails[k].shift();
    });
    draw();
  }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (reduced()) { for (let i = 0; i < 10000; i++) { P = P.map(rk4); t += DT; } draw(); return; }
    runner.set(!runner.playing);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  new ResizeObserver(() => P && draw()).observe(canvas);
  onTheme(() => { colors = palette(); draw(); });
  reset();
}

// ============================================================ Mandelbrot & Julia

// colourOf maps a smooth escape count to the palette: background → blue →
// pink → foreground, cycling; points that never escape take the foreground.
function colourOf(nu, maxIter, pal) {
  if (nu < 0) return pal.fg;
  const t = (Math.sqrt(nu) / 4) % 1;
  const stops = [pal.bg, pal.u, pal.brand, pal.bg];
  const k = Math.min(2, Math.floor(t * 3)), f = t * 3 - k;
  return [0, 1, 2].map((i) => stops[k][i] * (1 - f) + stops[k + 1][i] * f);
}

function escape(zx, zy, cx, cy, maxIter) {
  for (let n = 0; n < maxIter; n++) {
    const x2 = zx * zx, y2 = zy * zy;
    if (x2 + y2 > 256) return n + 1 - Math.log2(Math.log2(x2 + y2) / 2);
    zy = 2 * zx * zy + cy;
    zx = x2 - y2 + cx;
  }
  return -1;
}

// progressive renders a fractal into a canvas a band of rows per frame.
function progressive(canvas, pixel, isCurrent) {
  const ctx = fit(canvas);
  const W = canvas.width, H = canvas.height;
  const img = ctx.createImageData(W, H);
  let row = 0;
  const band = () => {
    if (!isCurrent()) return;
    const t0 = performance.now();
    for (; row < H && performance.now() - t0 < 24; row++) for (let col = 0; col < W; col++) {
      const c = pixel(col / W, row / H);
      const p = (row * W + col) * 4;
      img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (row < H) requestAnimationFrame(band);
  };
  band();
}

for (const root of document.querySelectorAll("[data-chaos-mandelbrot]")) {
  const box = root.querySelector("[data-mview]");
  const mc = root.querySelector("[data-mandel]");
  const jc = root.querySelector("[data-julia]");
  const orbitSvg = root.querySelector("[data-orbit]");
  const o = outs(root);
  const HOME = { cx: -0.6, cy: 0, w: 3.2 };
  let view = { ...HOME }, c = [-0.8, 0.156], pal = palette(), mJob = 0, jJob = 0, visible = false, dirty = true;
  const s = scrubAll(root, () => { renderM(); renderJ(); });

  const aspect = () => mc.clientHeight / Math.max(1, mc.clientWidth);
  const toC = (fx, fy) => [view.cx + (fx - 0.5) * view.w, view.cy - (fy - 0.5) * view.w * aspect()];
  function renderM() {
    if (!visible) { dirty = true; return; }
    const id = ++mJob, max = Math.round(s.iter.get());
    const a = aspect();
    progressive(mc, (fx, fy) => colourOf(escape(0, 0, view.cx + (fx - 0.5) * view.w, view.cy - (fy - 0.5) * view.w * a, max), max, pal), () => id === mJob);
    o.centre.textContent = `${num(view.cx, 6)} ${view.cy < 0 ? "−" : "+"} ${num(Math.abs(view.cy), 6)}i`;
    o.width.textContent = view.w.toExponential(2);
    drawOrbit();
  }
  function renderJ() {
    if (!visible) { dirty = true; return; }
    const id = ++jJob, max = Math.round(s.iter.get()), a = jc.clientHeight / Math.max(1, jc.clientWidth);
    progressive(jc, (fx, fy) => colourOf(escape((fx - 0.5) * 3.4, -(fy - 0.5) * 3.4 * a, c[0], c[1], max), max, pal), () => id === jJob);
  }
  function drawOrbit() {
    const W = mc.clientWidth, H = mc.clientHeight;
    orbitSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    orbitSvg.replaceChildren();
    let zx = 0, zy = 0, n = 0;
    const pts = [];
    const max = Math.round(s.iter.get());
    for (; n < max; n++) {
      if (n < 60) pts.push([zx, zy]);
      [zx, zy] = [zx * zx - zy * zy + c[0], 2 * zx * zy + c[1]];
      if (zx * zx + zy * zy > 4) break;
    }
    const sx = (x) => ((x - view.cx) / view.w + 0.5) * W, sy = (y) => (0.5 - (y - view.cy) / (view.w * aspect())) * H;
    polyline(orbitSvg, pts.map(([x, y]) => [sx(x), sy(y)]), "stroke:var(--background);stroke-width:2.5;stroke-opacity:0.8");
    polyline(orbitSvg, pts.map(([x, y]) => [sx(x), sy(y)]), "stroke:var(--brand);stroke-width:1.25");
    el("circle", { cx: sx(c[0]), cy: sy(c[1]), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, orbitSvg);
    o.c.textContent = `${num(c[0], 4)} ${c[1] < 0 ? "−" : "+"} ${num(Math.abs(c[1]), 4)}i`;
    o.orbit.textContent = n < max ? `escapes after ${n + 1} steps (outside the set)` : "stays bounded (in the set)";
  }

  const zoomAt = (fx, fy, k) => {
    const [x, y] = toC(fx, fy);
    view = { cx: x + (view.cx - x) * k, cy: y + (view.cy - y) * k, w: view.w * k };
    renderM();
  };
  box.addEventListener("wheel", (e) => {
    e.preventDefault();
    const b = mc.getBoundingClientRect();
    zoomAt((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, e.deltaY < 0 ? 0.8 : 1.25);
  }, { passive: false });
  let drag = null;
  box.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, v: { ...view }, moved: false }; box.setPointerCapture(e.pointerId); });
  box.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const b = mc.getBoundingClientRect();
    view = { ...drag.v, cx: drag.v.cx - (dx / b.width) * drag.v.w, cy: drag.v.cy + (dy / b.height) * drag.v.w * aspect() };
    renderM();
  });
  box.addEventListener("pointerup", (e) => {
    if (drag && !drag.moved) {
      const b = mc.getBoundingClientRect();
      c = toC((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
      drawOrbit(); renderJ();
    }
    drag = null;
  });
  box.addEventListener("keydown", (e) => {
    const pan = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (pan) { e.preventDefault(); view.cx += pan[0] * view.w; view.cy += pan[1] * view.w * aspect(); renderM(); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomAt(0.5, 0.5, 0.5); }
    else if (e.key === "-") { e.preventDefault(); zoomAt(0.5, 0.5, 2); }
    else if (e.key === "Enter") { e.preventDefault(); c = [view.cx, view.cy]; drawOrbit(); renderJ(); }
  });
  root.querySelector("[data-action=in]").addEventListener("click", () => zoomAt(0.5, 0.5, 0.5));
  root.querySelector("[data-action=home]").addEventListener("click", () => { view = { ...HOME }; renderM(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && dirty) { dirty = false; renderM(); renderJ(); } }).observe(root);
  // A first picture even before the block scrolls into view.
  setTimeout(() => { if (dirty) { const v = visible; visible = true; dirty = false; renderM(); renderJ(); visible = v; } }, 0);
  new ResizeObserver(() => { dirty = true; if (visible) { dirty = false; renderM(); renderJ(); } }).observe(mc);
  onTheme(() => { pal = palette(); renderM(); renderJ(); });
}

// ============================================================ Strange attractors

const ATTRACTORS = {
  henon: { a: 1.4, b: 0.3, eq: "x′ = 1 − a·x² + y,  y′ = b·x" },
  rossler: { a: 0.2, b: 0.2, eq: "ẋ = −y − z,  ẏ = x + a·y,  ż = b + z(x − 5.7)" },
  clifford: { a: -1.4, b: 1.6, eq: "x′ = sin(a·y) + cos(a·x),  y′ = sin(b·x) + 0.7·cos(b·y)" },
};

for (const root of document.querySelectorAll("[data-chaos-attractors]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let kind = "henon", pal = palette();
  const s = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => {
    kind = e.detail.value;
    s.pa.set(ATTRACTORS[kind].a, false); s.pb.set(ATTRACTORS[kind].b, false);
    draw();
  });

  function points() {
    const a = s.pa.get(), b = s.pb.get(), N = 300000, xs = new Float32Array(N), ys = new Float32Array(N);
    let x = 0.1, y = 0.1, z = 0.1;
    if (kind === "rossler") {
      const dt = 0.01, f = (x, y, z) => [-y - z, x + a * y, b + z * (x - 5.7)];
      for (let i = -2000; i < N; i++) {
        const k1 = f(x, y, z), k2 = f(x + dt / 2 * k1[0], y + dt / 2 * k1[1], z + dt / 2 * k1[2]);
        const k3 = f(x + dt / 2 * k2[0], y + dt / 2 * k2[1], z + dt / 2 * k2[2]), k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
        x += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); z += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        if (i >= 0) { xs[i] = x; ys[i] = y; }
      }
    } else {
      for (let i = -100; i < N; i++) {
        if (kind === "henon") [x, y] = [1 - a * x * x + y, b * x];
        else [x, y] = [Math.sin(a * y) + Math.cos(a * x), Math.sin(b * x) + 0.7 * Math.cos(b * y)];
        if (!Number.isFinite(x) || Math.abs(x) > 1e6) return null;
        if (i >= 0) { xs[i] = x; ys[i] = y; }
      }
    }
    return { xs, ys, N };
  }

  function draw() {
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = css(pal.bg); ctx.fillRect(0, 0, W, H);
    o.eq.textContent = ATTRACTORS[kind].eq;
    const p = points();
    if (!p) { o.n.textContent = "the orbit escapes: no attractor here"; return; }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.N; i++) { x0 = Math.min(x0, p.xs[i]); x1 = Math.max(x1, p.xs[i]); y0 = Math.min(y0, p.ys[i]); y1 = Math.max(y1, p.ys[i]); }
    const pad = 0.06, sc = Math.min(W / ((x1 - x0) * (1 + 2 * pad) || 1), H / ((y1 - y0) * (1 + 2 * pad) || 1));
    const ox = W / 2 - ((x0 + x1) / 2) * sc, oy = H / 2 + ((y0 + y1) / 2) * sc;
    const counts = new Uint32Array(W * H);
    let max = 1;
    for (let i = 0; i < p.N; i++) {
      const X = Math.floor(ox + p.xs[i] * sc), Y = Math.floor(oy - p.ys[i] * sc);
      if (X >= 0 && X < W && Y >= 0 && Y < H) max = Math.max(max, ++counts[Y * W + X]);
    }
    const img = ctx.getImageData(0, 0, W, H), lm = Math.log(max + 1);
    for (let k = 0; k < counts.length; k++) {
      if (!counts[k]) continue;
      const t = Math.log(counts[k] + 1) / lm, a = Math.min(1, 0.35 + 0.9 * t);
      const c = t > 0.6 ? pal.brand : pal.fg;
      for (let ch = 0; ch < 3; ch++) img.data[k * 4 + ch] = pal.bg[ch] * (1 - a) + c[ch] * a;
    }
    ctx.putImageData(img, 0, 0);
    o.n.textContent = p.N.toLocaleString("en");
  }
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
}

// ============================================================ Chaos game

for (const root of document.querySelectorAll("[data-chaos-game]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"));
  let mode = "game", pal = palette(), ctx, rng, pt, n = 0;
  const s = scrubAll(root, () => reset());
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; reset(); });

  const corners = () => {
    const k = Math.round(s.corners.get()), W = canvas.width, H = canvas.height, R = Math.min(W, H) * 0.46;
    return Array.from({ length: k }, (_, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / k; return [W / 2 + R * Math.cos(a), H / 2 + 0.04 * H + R * Math.sin(a)]; });
  };
  function dimension() {
    const k = Math.round(s.corners.get()), r = s.ratio.get();
    const d = Math.log(k) / Math.log(1 / (1 - r));
    o.dim.textContent = d <= 2 ? `log ${k} / log ${num(1 / (1 - r), 3)} = ${num(d, 4)}` : "copies overlap: fills the polygon";
  }
  function addPoints(m) {
    const cs = corners(), r = s.ratio.get();
    ctx.fillStyle = css(pal.fg, 0.55);
    const sz = Math.max(1, canvas.width / 600);
    for (let i = 0; i < m; i++) {
      const c = cs[Math.floor(rng() * cs.length)];
      pt = [pt[0] + (c[0] - pt[0]) * r, pt[1] + (c[1] - pt[1]) * r];
      if (n > 20 || i > 20) ctx.fillRect(pt[0], pt[1], sz, sz);
      n++;
    }
    o.n.textContent = n.toLocaleString("en");
  }
  function subdivide() {
    const cs = corners(), r = s.ratio.get(), depth = Math.round(s.depth.get());
    let shapes = [cs];
    for (let d = 0; d < depth && shapes.length * cs.length < 300000; d++) {
      shapes = shapes.flatMap((sh) => sh.map((v) => sh.map((w) => [v[0] + (w[0] - v[0]) * (1 - r), v[1] + (w[1] - v[1]) * (1 - r)])));
    }
    ctx.fillStyle = css(pal.fg, 0.85);
    for (const sh of shapes) { ctx.beginPath(); sh.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); }
    o.n.textContent = `${shapes.length.toLocaleString("en")} pieces`;
  }
  function reset() {
    runner?.set(false);
    ctx = fit(canvas);
    ctx.fillStyle = css(pal.bg); ctx.fillRect(0, 0, canvas.width, canvas.height);
    rng = mulberry32(3); pt = [canvas.width / 2, canvas.height / 2]; n = 0;
    for (const [x, y] of corners()) { ctx.beginPath(); ctx.arc(x, y, Math.max(3, canvas.width / 160), 0, 2 * Math.PI); ctx.fillStyle = css(pal.brand); ctx.fill(); }
    if (mode === "game") addPoints(20000); else subdivide();
    dimension();
  }
  const runner = loop(root, () => { if (mode !== "game") return false; addPoints(3000); if (n > 400000) return false; }, setPlay);
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (mode !== "game") return;
    if (reduced()) { addPoints(100000); return; }
    runner.set(!runner.playing);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  new ResizeObserver(() => reset()).observe(canvas);
  onTheme(() => { pal = palette(); reset(); });
}

// ============================================================ Koch & box counting

function kochCurve(level) {
  // Snowflake from an equilateral triangle of side 1, clockwise so the bumps
  // point outward.
  let pts = [[0, 0], [0.5, Math.sqrt(3) / 2], [1, 0], [0, 0]];
  for (let l = 0; l < level; l++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = (bx - ax) / 3, dy = (by - ay) / 3;
      const p1 = [ax + dx, ay + dy], p3 = [ax + 2 * dx, ay + 2 * dy];
      const p2 = [p1[0] + dx * 0.5 - dy * Math.sqrt(3) / 2, p1[1] + dy * 0.5 + dx * Math.sqrt(3) / 2];
      next.push(p1, p2, p3, [bx, by]);
    }
    pts = next;
  }
  return pts;
}

for (const root of document.querySelectorAll("[data-chaos-koch]")) {
  const flake = root.querySelector("[data-flake]");
  const fitSvg = root.querySelector("[data-fit]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  // Box counts on the level-7 curve, densely sampled.
  const fine = kochCurve(7);
  const samples = [];
  for (let i = 0; i < fine.length - 1; i++) for (let k = 0; k < 3; k++) samples.push([fine[i][0] + (fine[i + 1][0] - fine[i][0]) * k / 3, fine[i][1] + (fine[i + 1][1] - fine[i][1]) * k / 3]);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [x, y] of samples) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const size = Math.max(bx1 - bx0, by1 - by0) * 1.06;
  const minX = (bx0 + bx1) / 2 - size / 2, minY = (by0 + by1) / 2 - size / 2;
  const boxes = (k) => {
    const n = 2 ** k, set = new Set();
    for (const [x, y] of samples) set.add(Math.floor(((x - minX) / size) * n) * 4096 + Math.floor(((y - minY) / size) * n));
    return set;
  };
  const counts = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => ({ k, n: boxes(k).size }));
  const used = counts.filter((c) => c.k >= 4);
  const mx = used.reduce((a, c) => a + c.k * Math.LN2, 0) / used.length, my = used.reduce((a, c) => a + Math.log(c.n), 0) / used.length;
  const slope = used.reduce((a, c) => a + (c.k * Math.LN2 - mx) * (Math.log(c.n) - my), 0) / used.reduce((a, c) => a + (c.k * Math.LN2 - mx) ** 2, 0);

  function draw() {
    const level = Math.round(s.level.get()), gk = Math.round(s.box.get());
    const pts = kochCurve(level);
    flake.replaceChildren();
    const S = 400 / size, X = (x) => (x - minX) * S, Y = (y) => (y - minY) * S;
    // Counting grid: boxes the curve touches are shaded.
    const n = 2 ** gk, cell = 400 / n, hit = boxes(gk);
    for (const key of hit) {
      const i = Math.floor(key / 4096), j = key % 4096;
      el("rect", { x: i * cell, y: j * cell, width: cell, height: cell, style: "fill:var(--brand);fill-opacity:0.14" }, flake);
    }
    if (n <= 64) for (let i = 0; i <= n; i++) {
      el("line", { x1: i * cell, y1: 0, x2: i * cell, y2: 400, style: "stroke:currentColor;stroke-opacity:0.08" }, flake);
      el("line", { x1: 0, y1: i * cell, x2: 400, y2: i * cell, style: "stroke:currentColor;stroke-opacity:0.08" }, flake);
    }
    el("path", { d: "M" + pts.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join("L") + "Z", style: "fill:var(--vec-u);fill-opacity:0.12;stroke:var(--foreground);stroke-width:1;stroke-linejoin:round", "vector-effect": "non-scaling-stroke" }, flake);

    fitSvg.replaceChildren();
    const f = frame(fitSvg, { box: [40, 18, 206, 204], x: [0, 7], y: [0, 10], xticks: [0, 2, 4, 6], yticks: [0, 5, 10], xlabel: "ln 1/ε", ylabel: "ln N" });
    el("line", { x1: f.sx(0), y1: f.sy(my - slope * mx), x2: f.sx(7), y2: f.sy(my + slope * (7 - mx)), style: "stroke:var(--brand);stroke-width:1.5" }, fitSvg);
    for (const c of counts) el("circle", { cx: f.sx(c.k * Math.LN2), cy: f.sy(Math.log(c.n)), r: c.k === gk ? 5 : 3.5, style: `fill:${c.k >= 4 ? "var(--foreground)" : "var(--background)"};stroke:var(--foreground);stroke-width:1.25` }, fitSvg);

    const segs = 3 * 4 ** level;
    o.segs.textContent = segs.toLocaleString("en");
    o.per.textContent = `${num(3 * (4 / 3) ** level, 3)} × side  (→ ∞)`;
    o.area.textContent = `${num(8 / 5 - (3 / 5) * (4 / 9) ** level, 4)} × A₀  (→ 8/5)`;
    o.slope.textContent = `${num(slope, 4)}  (N = ${hit.size} at the grid shown)`;
    o.exact.textContent = `log 4 / log 3 = ${num(Math.log(4) / Math.log(3), 4)}`;
  }
  draw();
}

// ============================================================ L-systems

const LSYSTEMS = {
  plant: { axiom: "X", rules: ["X=F+[[X]-X]-F[-FX]+X", "F=FF"], angle: 25, gen: 5, heading: 65 },
  dragon: { axiom: "FX", rules: ["X=X+YF+", "Y=-FX-Y"], angle: 90, gen: 11, heading: 0 },
  hilbert: { axiom: "A", rules: ["A=+BF-AFA-FB+", "B=-AF+BFB+FA-"], angle: 90, gen: 5, heading: 0 },
  koch: { axiom: "F-F-F-F", rules: ["F=F-F+F+FF-F-F+F", ""], angle: 90, gen: 3, heading: 0 },
  sierpinski: { axiom: "F", rules: ["F=G-F-G", "G=F+G+F"], angle: 60, gen: 7, heading: 0 },
  bush: { axiom: "F", rules: ["F=FF+[+F-F-F]-[-F+F+F]", ""], angle: 22.5, gen: 4, heading: 90 },
};

for (const root of document.querySelectorAll("[data-chaos-lsystem]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const inputs = Object.fromEntries([...root.querySelectorAll("[data-lsys]")].map((i) => [i.dataset.lsys, i]));
  let heading = 65;
  const s = scrubAll(root, () => draw());
  for (const i of Object.values(inputs)) i.addEventListener("input", () => draw());
  root.querySelectorAll("[data-lpreset]").forEach((b) => b.addEventListener("click", () => {
    const p = LSYSTEMS[b.dataset.lpreset];
    inputs.axiom.value = p.axiom; inputs.rule1.value = p.rules[0]; inputs.rule2.value = p.rules[1];
    s.angle.set(p.angle, false); s.gen.set(p.gen, false); heading = p.heading;
    draw();
  }));

  function draw() {
    const rules = {};
    for (const r of [inputs.rule1.value, inputs.rule2.value]) {
      const m = r.replace(/\s/g, "").replace(/−/g, "-").match(/^(.)=(.*)$/);
      if (m) rules[m[1]] = m[2];
    }
    let str = inputs.axiom.value.replace(/\s/g, "").replace(/−/g, "-");
    const gen = Math.round(s.gen.get());
    let truncated = false;
    for (let g = 0; g < gen; g++) {
      let next = "";
      for (const ch of str) { next += rules[ch] ?? ch; if (next.length > 1_500_000) { truncated = true; break; } }
      str = next;
      if (truncated) break;
    }
    const step = (s.angle.get() * Math.PI) / 180;
    let x = 0, y = 0, a = (heading * Math.PI) / 180, segs = 0;
    const stack = [], parts = [`M0,0`];
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    for (const ch of str) {
      if (ch === "F" || ch === "G") {
        x += Math.cos(a); y -= Math.sin(a); parts.push(`L${x.toFixed(3)},${y.toFixed(3)}`); segs++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      } else if (ch === "f") { x += Math.cos(a); y -= Math.sin(a); parts.push(`M${x.toFixed(3)},${y.toFixed(3)}`); }
      else if (ch === "+") a += step;
      else if (ch === "-") a -= step;
      else if (ch === "[") stack.push([x, y, a]);
      else if (ch === "]" && stack.length) { [x, y, a] = stack.pop(); parts.push(`M${x.toFixed(3)},${y.toFixed(3)}`); }
    }
    svg.replaceChildren();
    const w = x1 - x0 || 1, hh = y1 - y0 || 1, pad = Math.max(w, hh) * 0.04;
    svg.setAttribute("viewBox", `${x0 - pad} ${y0 - pad} ${w + 2 * pad} ${hh + 2 * pad}`);
    el("path", { d: parts.join(""), style: "fill:none;stroke:var(--foreground);stroke-width:1;stroke-linecap:round;stroke-linejoin:round", "vector-effect": "non-scaling-stroke" }, svg);
    o.len.textContent = `${str.length.toLocaleString("en")}${truncated ? " (stopped at 1.5 M)" : ""}`;
    o.segs.textContent = segs.toLocaleString("en");
  }
  draw();
}

// ============================================================ Cellular automata

const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
const GUN = [[24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2], [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4], [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8]];
const RPENT = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]];

for (const root of document.querySelectorAll("[data-chaos-automata]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const bits = root.querySelector("[data-bits]");
  const setPlay = playButton(root.querySelector("[data-action=play]"));
  const CW = 90, CH = 60; // Life grid (a torus)
  let mode = "elementary", pal = palette(), grid = new Uint8Array(CW * CH), gen = 0, acc = 0;
  const s = scrubAll(root, () => { drawBits(); draw(); });

  // Elementary automaton: 151 cells from one live cell, rows down the page.
  function elementary() {
    const rule = Math.round(s.rule.get()), W = 151, rows = 100;
    let row = new Uint8Array(W); row[75] = 1;
    const out = [row];
    for (let g = 1; g < rows; g++) {
      const next = new Uint8Array(W);
      for (let i = 0; i < W; i++) {
        const idx = (row[(i + W - 1) % W] << 2) | (row[i] << 1) | row[(i + 1) % W];
        next[i] = (rule >> idx) & 1;
      }
      out.push(next); row = next;
    }
    return out;
  }
  function drawBits() {
    const rule = Math.round(s.rule.get());
    bits.replaceChildren(...[7, 6, 5, 4, 3, 2, 1, 0].map((idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "flex flex-col items-center gap-0.5 rounded-md border p-1 font-mono text-[9px] outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50";
      b.setAttribute("aria-label", `Case ${idx.toString(2).padStart(3, "0")} gives ${(rule >> idx) & 1}; click to flip`);
      const top = document.createElement("span"); top.textContent = idx.toString(2).padStart(3, "0").replace(/1/g, "■").replace(/0/g, "□");
      const bottom = document.createElement("span"); bottom.textContent = (rule >> idx) & 1 ? "■" : "□";
      bottom.className = "text-[var(--brand)]";
      b.append(top, bottom);
      b.addEventListener("click", () => { s.rule.set(rule ^ (1 << idx), false); drawBits(); draw(); });
      return b;
    }));
  }
  function stepLife() {
    const next = new Uint8Array(CW * CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      let nb = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) nb += grid[((y + dy + CH) % CH) * CW + ((x + dx + CW) % CW)];
      const alive = grid[y * CW + x];
      next[y * CW + x] = nb === 3 || (alive && nb === 2) ? 1 : 0;
    }
    grid = next; gen++;
  }
  function place(cells, ox, oy) { grid = new Uint8Array(CW * CH); for (const [x, y] of cells) grid[(oy + y) * CW + ox + x] = 1; gen = 0; draw(); }
  function draw() {
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = css(pal.bg); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = css(pal.fg);
    if (mode === "elementary") {
      const rows = elementary(), cw = W / 151, ch = H / rows.length;
      rows.forEach((r, j) => r.forEach((v, i) => v && ctx.fillRect(i * cw, j * ch, Math.ceil(cw), Math.ceil(ch))));
      o.gen.textContent = String(rows.length);
      o.live.textContent = String(rows.at(-1).reduce((a, v) => a + v, 0));
    } else {
      const cw = W / CW, ch = H / CH;
      ctx.strokeStyle = css(pal.fg, 0.06);
      for (let x = 0; x <= CW; x++) { ctx.beginPath(); ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, H); ctx.stroke(); }
      for (let y = 0; y <= CH; y++) { ctx.beginPath(); ctx.moveTo(0, y * ch); ctx.lineTo(W, y * ch); ctx.stroke(); }
      let live = 0;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (grid[y * CW + x]) { live++; ctx.fillRect(x * cw + 0.5, y * ch + 0.5, cw - 1, ch - 1); }
      o.gen.textContent = String(gen);
      o.live.textContent = String(live);
    }
  }
  const runner = loop(root, (ms) => { acc += ms; if (acc < 90) return; acc = 0; stepLife(); draw(); }, setPlay);
  root.addEventListener("seg-change", (e) => {
    mode = e.detail.value;
    runner.set(false);
    root.querySelectorAll("[data-mode]").forEach((p) => (p.hidden = p.dataset.mode !== mode));
    if (mode === "life" && !grid.some(Boolean)) place(GLIDER, 4, 4);
    draw();
  });
  root.querySelectorAll("[data-rule]").forEach((b) => b.addEventListener("click", () => { s.rule.set(Number(b.dataset.rule), false); drawBits(); draw(); }));
  root.querySelectorAll("[data-pattern]").forEach((b) => b.addEventListener("click", () => {
    runner.set(false);
    const p = b.dataset.pattern;
    if (p === "glider") place(GLIDER, 4, 4);
    else if (p === "gun") place(GUN, 4, 6);
    else if (p === "rpent") place(RPENT, 44, 28);
    else { const rng = mulberry32(gen + 7); grid = Uint8Array.from({ length: CW * CH }, () => (rng() < 0.25 ? 1 : 0)); gen = 0; draw(); }
  }));
  root.querySelector("[data-action=play]").addEventListener("click", () => runner.set(!runner.playing));
  root.querySelector("[data-action=step]").addEventListener("click", () => { runner.set(false); stepLife(); draw(); });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { runner.set(false); grid = new Uint8Array(CW * CH); gen = 0; draw(); });
  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "life") return;
    const b = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - b.left) / b.width) * CW), y = Math.floor(((e.clientY - b.top) / b.height) * CH);
    if (x >= 0 && x < CW && y >= 0 && y < CH) { grid[y * CW + x] ^= 1; draw(); }
  });
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
  drawBits();
  // Exposed for tests: step the Life grid and read it back.
  root.chaosLife = { place, step: stepLife, cells: () => { const c = []; grid.forEach((v, k) => v && c.push([k % CW, Math.floor(k / CW)])); return c; } };
}
