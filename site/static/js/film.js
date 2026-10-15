// Animation & Film blocks. Motion is the subject here, so blocks animate,
// but only while on screen, and never on their own under
// prefers-reduced-motion: there they show a still frame or onion skin and
// wait for Play or Step.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (u) => u * u * (3 - 2 * u);

// Sizes a canvas to its box at the device pixel ratio (capped at 2) and
// returns the context scaled to CSS pixels.
function fit(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

// A play/pause button and a frame loop that runs only while playing and
// on screen. tick(dt) returns false to stop.
function animator(root, tick, { autoplay = true } = {}) {
  const btn = root.querySelector("[data-action=play]");
  let playing = false, visible = false, raf = 0, last = 0;
  const show = () => {
    if (!btn) return;
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !playing);
    const label = btn.querySelector("[data-label]");
    if (label) label.textContent = playing ? "Pause" : "Play";
  };
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const more = tick(dt);
    raf = playing && visible && more !== false ? requestAnimationFrame(loop) : 0;
    if (more === false) set(false);
  };
  const kick = () => {
    if (playing && visible && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  function set(p) {
    playing = p;
    show();
    if (!p && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    kick();
  }
  btn?.addEventListener("click", () => set(!playing));
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    kick();
  }).observe(root);
  if (autoplay && !reduced()) set(true);
  else show();
  return { set, get playing() { return playing; } };
}

// ============================================================ Frame rate

for (const root of document.querySelectorAll("[data-film-rate]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const rates = [12, 24, 30, 60];
  let t = 0.3;
  const s = scrubAll(root, draw);

  function draw() {
    const { ctx, w, h } = fit(canvas);
    const fg = cssVar("--foreground"), brand = cssVar("--brand"), muted = cssVar("--muted-foreground");
    ctx.clearRect(0, 0, w, h);
    const angle = s.angle.get(), speed = s.speed.get();
    const rowH = h / rates.length, r = Math.min(rowH * 0.28, 16), left = 64, track = w - left - 24;
    ctx.font = "11px 'Geist Mono', monospace";
    rates.forEach((fps, i) => {
      const cy = rowH * (i + 0.5);
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(left, cy);
      ctx.lineTo(left + track, cy);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.fillText(`${fps} fps`, 8, cy + 4);
      // The frame on screen now began at n/fps and stayed exposed for e.
      const n = Math.floor(t * fps), t0 = n / fps, e = angle / 360 / fps;
      const K = 16;
      ctx.fillStyle = i === 1 ? brand : fg;
      for (let k = 0; k < K; k++) {
        const tk = t0 + (e * k) / (K - 1);
        const x = left + (((tk * speed) % 1) + 1) % 1 * track;
        ctx.globalAlpha = Math.min(1, 2.2 / K);
        ctx.beginPath();
        ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    const e24 = angle / 360 / 24, e60 = angle / 360 / 60;
    const frac = (sec) => `1/${num(1 / sec, 0)} s`;
    o.exp24.textContent = frac(e24);
    o.exp60.textContent = frac(e60);
    o.blur.textContent = `${num(speed * e24 * 100, 1)}% of the width`;
  }

  animator(root, (dt) => { t += dt; draw(); });
  root.querySelector("[data-action=step]").addEventListener("click", () => { t += 1 / 24; draw(); });
  new ResizeObserver(draw).observe(canvas);
  onTheme(draw);
  draw();
}

// ============================================================ Squash and stretch

// One bounce per second: height follows a parabola; near the ground the
// ball squashes, in the air it stretches along its speed. Area stays 1.
function bounce(t, amount, on) {
  const u = ((t % 1) + 1) % 1;
  const y = 4 * u * (1 - u); // 0 at the ground, 1 at the top
  const v = Math.abs(4 * (1 - 2 * u)); // |dy/du|, 4 at impact
  let sy = 1;
  if (on) {
    const d = Math.min(u, 1 - u);
    if (d < 0.06) sy = 1 - amount * 0.45 * (1 - d / 0.06);
    else sy = 1 + amount * 0.5 * Math.min(1, v / 4);
  }
  return { y, sx: 1 / sy, sy };
}

for (const root of document.querySelectorAll("[data-film-squash]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let t = 0.4, on = true, onion = false;
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-toggle]").forEach((sw) =>
    sw.addEventListener("shadcn:checked-change", (e) => {
      if (sw.dataset.toggle === "squash") on = e.detail.checked;
      else onion = e.detail.checked;
      draw();
    }));

  function ball(ctx, w, h, tt, alpha) {
    const { y, sx, sy } = bounce(tt, s.amount.get(), on);
    const ground = h - 28, r = Math.min(h * 0.09, 26), top = ground - r - (ground - 2 * r - 20) * y;
    const x = 40 + ((((tt / 3) % 1) + 1) % 1) * (w - 80);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    // Squash anchors at the ground: the ball's bottom stays on the floor.
    const cy = Math.min(top, ground - r * sy);
    ctx.ellipse(x, cy, r * sx, r * sy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return { sx, sy };
  }

  function draw() {
    const { ctx, w, h } = fit(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = cssVar("--muted-foreground");
    ctx.beginPath();
    ctx.moveTo(16, h - 28);
    ctx.lineTo(w - 16, h - 28);
    ctx.stroke();
    if (onion) {
      ctx.fillStyle = cssVar("--muted-foreground");
      for (let k = 12; k >= 1; k--) ball(ctx, w, h, t - k / 24, 0.12);
    }
    ctx.fillStyle = cssVar("--brand");
    const { sx, sy } = ball(ctx, w, h, t, 1);
    o.scale.textContent = `${num(sx, 2)} × ${num(sy, 2)}`;
    o.area.textContent = num(sx * sy, 2);
  }

  animator(root, (dt) => { t += dt * 0.6; draw(); });
  root.querySelector("[data-action=step]").addEventListener("click", () => { t += 1 / 24; draw(); });
  new ResizeObserver(draw).observe(canvas);
  onTheme(draw);
  draw();
}

// ============================================================ Timing and spacing

for (const root of document.querySelectorAll("[data-film-spacing]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "gravity";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  // The arc: x from 60 to 580, y a parabola from the ground (230) to 60.
  const P = (u) => [60 + 520 * u, 230 - 170 * 4 * u * (1 - u)];

  function positions(N) {
    if (mode === "gravity") return Array.from({ length: N + 1 }, (_, i) => P(i / N));
    if (mode === "ease") return Array.from({ length: N + 1 }, (_, i) => P(smooth(i / N)));
    // Even: equal distances along the arc (arc-length parametrisation).
    const M = 2000, acc = [0];
    let prev = P(0);
    for (let k = 1; k <= M; k++) {
      const p = P(k / M);
      acc.push(acc[k - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
      prev = p;
    }
    const L = acc[M];
    return Array.from({ length: N + 1 }, (_, i) => {
      const target = (L * i) / N;
      let k = 0;
      while (k < M && acc[k + 1] < target) k++;
      const f = (target - acc[k]) / Math.max(1e-9, acc[k + 1] - acc[k]);
      return P((k + f) / M);
    });
  }

  function draw() {
    svg.replaceChildren();
    const N = Math.round(s.frames.get());
    const pts = positions(N);
    el("line", { x1: 30, x2: 610, y1: 246, y2: 246, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    polyline(svg, Array.from({ length: 101 }, (_, i) => P(i / 100)), "stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:3 4");
    pts.forEach((p, i) => {
      el("circle", { cx: p[0], cy: p[1], r: 14, style: `fill:var(--brand);fill-opacity:${i === 0 || i === N ? 0.9 : 0.22};stroke:var(--brand);stroke-width:1` }, svg);
      text(svg, p[0], p[1] + 4, String(i), { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
    });
    // Spacing chart: cumulative distance along the path, scaled to a line.
    const gaps = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = gaps.reduce((a, b) => a + b, 0);
    const y = 312;
    el("line", { x1: 60, x2: 580, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    let acc = 0;
    [0, ...gaps].forEach((g, i) => {
      acc += g;
      const x = 60 + (520 * acc) / total;
      el("line", { x1: x, x2: x, y1: y - (i === 0 || i === N ? 10 : 6), y2: y + (i === 0 || i === N ? 10 : 6), style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    });
    text(svg, 60, y + 26, "spacing chart: one tick per frame, along the path", { class: "fill-muted-foreground font-mono text-[10px]" });
    o.dur.textContent = `${N} frames = ${num(N / 24, 2)} s`;
    const max = Math.max(...gaps), min = Math.min(...gaps);
    o.maxgap.textContent = `${num((100 * max) / total, 1)}% of the path`;
    o.mingap.textContent = `${num((100 * min) / total, 1)}% of the path`;
  }
  draw();
}

// ============================================================ Follow-through

for (const root of document.querySelectorAll("[data-film-follow]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let anticipation = true;
  const s = scrubAll(root, () => {});
  root.querySelector("[data-toggle]")?.addEventListener("shadcn:checked-change", (e) => { anticipation = e.detail.checked; });
  const SEG = 5, LEN = 0.13, ASPECT = 16 / 9;
  let t = 0, head, pts, vel;
  const reset = () => {
    t = 0;
    head = [0.25 * ASPECT, 0.18];
    pts = Array.from({ length: SEG }, (_, i) => [0.25 * ASPECT, 0.18 + LEN * (i + 1)]);
    vel = pts.map(() => [0, 0]);
  };
  reset();

  // The head moves between two marks every 1.6 s: a 0.6 s ease-in-out move,
  // preceded by a small opposite move when anticipation is on.
  const headX = (tt) => {
    const cyc = tt % 3.2, dir = Math.floor(tt / 1.6) % 2 === 0 ? 1 : -1;
    const from = dir === 1 ? 0.25 : 0.75, to = 0.5 + (from === 0.25 ? 0.25 : -0.25);
    const local = cyc % 1.6;
    const pre = anticipation ? 0.25 : 0;
    if (local < 0.4 - pre) return from;
    if (anticipation && local < 0.4) {
      const u = (local - 0.15) / 0.25;
      return from - dir * 0.04 * Math.sin(Math.PI * smooth(clamp(u, 0, 1)) * 0.5);
    }
    if (local < 1.0) {
      const u = (local - 0.4) / 0.6, back = anticipation ? -dir * 0.04 : 0;
      return from + back + (to - from - back) * smooth(u);
    }
    return to;
  };

  // Each joint is pulled by a damped spring towards the point hanging
  // below the joint ahead, then put back at the segment's length, so the
  // chain swings like a rope instead of stretching. Units: frame heights.
  function step(dt) {
    const k = s.stiff.get(), c = s.damp.get();
    const sub = 8, h = dt / sub;
    for (let q = 0; q < sub; q++) {
      t += h;
      head = [headX(t) * ASPECT, 0.18];
      for (let i = 0; i < SEG; i++) {
        const prev = i === 0 ? head : pts[i - 1];
        const old = pts[i].slice();
        for (const a of [0, 1]) {
          const target = a === 0 ? prev[0] : prev[1] + LEN;
          vel[i][a] += (k * (target - pts[i][a]) - c * vel[i][a]) * h;
          pts[i][a] += vel[i][a] * h;
        }
        const dx = pts[i][0] - prev[0], dy = pts[i][1] - prev[1], d = Math.hypot(dx, dy) || 1;
        pts[i] = [prev[0] + (dx / d) * LEN, prev[1] + (dy / d) * LEN];
        vel[i] = [(pts[i][0] - old[0]) / h, (pts[i][1] - old[1]) / h];
      }
    }
  }

  function draw() {
    const { ctx, w, h } = fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const X = (p) => [(p[0] / ASPECT) * w, p[1] * h];
    ctx.strokeStyle = cssVar("--muted-foreground");
    ctx.setLineDash([3, 4]);
    for (const m of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(m * w, 8);
      ctx.lineTo(m * w, h - 8);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const chain = [head, ...pts].map(X);
    ctx.strokeStyle = cssVar("--foreground");
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    chain.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = cssVar("--foreground");
    chain.slice(1).forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4 - i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = cssVar("--brand");
    ctx.beginPath();
    ctx.arc(chain[0][0], chain[0][1], 14, 0, Math.PI * 2);
    ctx.fill();
    const tip = pts[SEG - 1];
    o.lag.textContent = `${num((Math.abs(tip[0] - head[0]) / ASPECT) * 100, 1)}% of the width`;
    const speed = Math.max(...vel.map((v) => Math.hypot(v[0], v[1])));
    o.settled.textContent = speed < 0.01 ? "yes" : "moving";
  }

  animator(root, (dt) => { step(dt); draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { reset(); draw(); });
  new ResizeObserver(draw).observe(canvas);
  onTheme(draw);
  draw();
}

// ============================================================ Spring

// Free response of m x'' + c x' + k x = 0 from x = 1, v = 0, in closed form.
export function springX(m, k, c, t) {
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (Math.abs(z - 1) < 1e-9) return (1 + w0 * t) * Math.exp(-w0 * t);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  const q = Math.sqrt(z * z - 1), r1 = -w0 * (z - q), r2 = -w0 * (z + q);
  return (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

for (const root of document.querySelectorAll("[data-film-spring]")) {
  const svg = root.querySelector("[data-plot]");
  const box = root.querySelector("[data-box]");
  const track = root.querySelector("[data-track]");
  const o = outs(root);
  let t = 0, T = 3;
  const s = scrubAll(root, () => { t = 0; draw(); });

  function settleTime(m, k, c) {
    let last = 0;
    for (let i = 0; i <= 6000; i++) {
      const tt = i / 500;
      if (Math.abs(springX(m, k, c, tt)) > 0.02) last = tt;
    }
    return last;
  }

  function draw() {
    const m = s.mass.get(), k = s.k.get(), c = s.c.get();
    const z = c / (2 * Math.sqrt(k * m));
    const ts = settleTime(m, k, c);
    T = clamp(ts * 1.3, 0.5, 12);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 580, 210], x: [0, T], y: [0, 1.8], xticks: [0, T / 2, T].map((v) => +v.toFixed(2)), yticks: [0, 1], xlabel: "time (s)", ylabel: "position" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(1), y2: f.sy(1), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:4 4" }, svg);
    text(svg, f.L + f.W, f.sy(1) - 4, "target", { "text-anchor": "end" });
    const pts = Array.from({ length: 401 }, (_, i) => {
      const tt = (i * T) / 400;
      return [f.sx(tt), f.sy(1 - springX(m, k, c, tt))];
    });
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:2");
    if (t > 0) el("line", { x1: f.sx(Math.min(t, T)), x2: f.sx(Math.min(t, T)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand)" }, svg);
    let peak = 0;
    for (let i = 0; i <= 4000; i++) peak = Math.max(peak, 1 - springX(m, k, c, (i * T) / 4000));
    const over = Math.max(0, peak - 1);
    o.zeta.textContent = num(z, 3);
    o.kind.textContent = Math.abs(z - 1) < 0.005 ? "critically damped" : z < 1 ? (z === 0 ? "undamped" : "underdamped (bouncy)") : "overdamped";
    o.over.textContent = over < 1e-4 ? "none" : `${num(over * 100, 1)}%`;
    o.settle.textContent = z === 0 ? "never" : `${num(ts, 2)} s`;
    place();
  }

  function place() {
    const m = s.mass.get(), k = s.k.get(), c = s.c.get();
    const pos = 1 - springX(m, k, c, t);
    const span = track.clientWidth - box.offsetWidth - 16;
    box.style.transform = `translateX(${8 + pos * span * 0.8}px)`;
  }

  const anim = animator(root, (dt) => {
    t += dt;
    place();
    if (t > T) { t = 0; return false; }
  }, { autoplay: false });
  root.querySelector("[data-action=critical]").addEventListener("click", () => {
    s.c.set(2 * Math.sqrt(s.k.get() * s.mass.get()), false);
    t = 0;
    draw();
  });
  root.querySelector("[data-action=play]").addEventListener("click", () => { if (anim.playing) t = 0; });
  onTheme(draw);
  draw();
}

// ============================================================ Keyframes

for (const root of document.querySelectorAll("[data-film-keys]")) {
  const svg = root.querySelector("[data-plot]");
  const dot = root.querySelector("[data-dot]");
  const track = root.querySelector("[data-track]");
  const o = outs(root);
  const FRAMES = 48;
  const defaults = [[0, 0.1], [16, 0.85], [30, 0.35], [48, 0.9]];
  let keys = defaults.map((k) => k.slice()), mode = "linear", sel = 1, frameNow = 0, f;
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  // Value at frame x, between keys.
  function valueAt(x) {
    let i = 0;
    while (i < keys.length - 2 && x > keys[i + 1][0]) i++;
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    const u = clamp((x - t0) / Math.max(1e-9, t1 - t0), 0, 1);
    if (mode === "linear") return v0 + (v1 - v0) * u;
    if (mode === "ease") return v0 + (v1 - v0) * smooth(u);
    // Uniform Catmull-Rom through the keys, end keys repeated.
    const p0 = keys[Math.max(0, i - 1)][1], p3 = keys[Math.min(keys.length - 1, i + 2)][1];
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * v0 + (-p0 + v1) * u + (2 * p0 - 5 * v0 + 4 * v1 - p3) * u2 + (-p0 + 3 * v0 - 3 * v1 + p3) * u3);
  }

  function draw() {
    svg.replaceChildren();
    f = frame(svg, { box: [44, 14, 580, 230], x: [0, FRAMES], y: [-0.25, 1.25], xticks: [0, 12, 24, 36, 48], yticks: [0, 0.5, 1], xlabel: "frame (24 fps)", ylabel: "value" });
    const pts = Array.from({ length: FRAMES * 8 + 1 }, (_, i) => [f.sx(i / 8), f.sy(valueAt(i / 8))]);
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:2");
    // In-between frames as ticks on the curve.
    for (let fr = 0; fr <= FRAMES; fr++) el("circle", { cx: f.sx(fr), cy: f.sy(valueAt(fr)), r: 1.6, style: "fill:var(--foreground);fill-opacity:0.45" }, svg);
    el("line", { x1: f.sx(frameNow), x2: f.sx(frameNow), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, svg);
    keys.forEach(([kt, kv], i) => {
      const g = el("rect", {
        x: f.sx(kt) - 6, y: f.sy(kv) - 6, width: 12, height: 12, rx: 2, transform: `rotate(45 ${f.sx(kt)} ${f.sy(kv)})`,
        tabindex: 0, role: "slider", "aria-label": `Key ${i + 1}: frame ${kt}, value ${num(kv, 2)}`, "data-key": i,
        style: `fill:${i === sel ? "var(--brand)" : "var(--background)"};stroke:var(--brand);stroke-width:2;cursor:grab;outline:none`,
      }, svg);
      g.addEventListener("focus", () => { if (sel !== i) { sel = i; draw(); svg.querySelector(`[data-key="${i}"]`)?.focus(); } });
    });
    // Overshoot: how far the curve leaves the range of the two keys it joins.
    let over = 0;
    for (let i = 0; i < keys.length - 1; i++) {
      const lo = Math.min(keys[i][1], keys[i + 1][1]), hi = Math.max(keys[i][1], keys[i + 1][1]);
      for (let x = keys[i][0]; x <= keys[i + 1][0]; x += 0.25) {
        const v = valueAt(x);
        over = Math.max(over, v - hi, lo - v);
      }
    }
    o.over.textContent = over < 1e-6 ? "none" : num(over, 3);
    place();
  }

  function place() {
    const v = valueAt(frameNow);
    dot.style.transform = `translateX(${8 + clamp(v, -0.25, 1.25) * (track.clientWidth - 48) * 0.8}px)`;
    o.frame.textContent = `${num(frameNow, 0)} / ${FRAMES}`;
    o.value.textContent = num(v, 3);
  }

  // Dragging keys: the end keys stay at frames 0 and 48.
  let drag = -1;
  const toPlot = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return [((q.x - f.L) / f.W) * FRAMES, 1.25 - ((q.y - f.T) / f.H) * 1.5];
  };
  const moveKey = (i, t, v) => {
    const lo = i === 0 ? 0 : keys[i - 1][0] + 1, hi = i === keys.length - 1 ? FRAMES : keys[i + 1][0] - 1;
    keys[i] = [i === 0 ? 0 : i === keys.length - 1 ? FRAMES : clamp(Math.round(t), lo, hi), clamp(+v.toFixed(3), -0.2, 1.2)];
  };
  svg.addEventListener("pointerdown", (e) => {
    const k = e.target.closest("[data-key]");
    if (!k) return;
    drag = +k.dataset.key;
    sel = drag;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    const [t, v] = toPlot(e);
    moveKey(drag, t, v);
    draw();
  });
  svg.addEventListener("pointerup", () => (drag = -1));
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key];
    if (!d) return;
    e.preventDefault();
    moveKey(sel, keys[sel][0] + d[0], keys[sel][1] + d[1]);
    draw();
    svg.querySelector(`[data-key="${sel}"]`)?.focus();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { keys = defaults.map((k) => k.slice()); draw(); });

  animator(root, (dt) => {
    frameNow = (frameNow + dt * 24) % (FRAMES + 1);
    draw();
  }, { autoplay: false });
  onTheme(draw);
  draw();
}

// ============================================================ Aspect ratios

for (const root of document.querySelectorAll("[data-film-aspect]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let safe = true;
  const picked = (name) => +root.querySelector(`[data-pick="${name}"] [aria-pressed="true"]`).dataset.ratio;
  root.querySelectorAll("[data-pick]").forEach((g) =>
    g.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ratio]");
      if (!b) return;
      g.querySelectorAll("[data-ratio]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }));
  root.querySelector("[data-toggle]")?.addEventListener("shadcn:checked-change", (e) => { safe = e.detail.checked; draw(); });

  function draw() {
    const rp = picked("picture"), rs = picked("screen");
    svg.replaceChildren();
    // The screen, as large as fits 600×340.
    const maxW = 600, maxH = 340;
    const sw = rs >= maxW / maxH ? maxW : maxH * rs, sh = sw / rs;
    const sx = (640 - sw) / 2, sy = (380 - sh) / 2;
    el("rect", { x: sx, y: sy, width: sw, height: sh, style: "fill:#000" }, svg);
    // The picture fitted inside.
    const pw = rp >= rs ? sw : sh * rp, ph = pw / rp;
    const px = sx + (sw - pw) / 2, py = sy + (sh - ph) / 2;
    const id = `film-clip-${Math.random().toString(36).slice(2)}`;
    el("rect", { x: px, y: py, width: pw, height: ph }, el("clipPath", { id }, el("defs", {}, svg)));
    const g = el("g", { "clip-path": `url(#${id})` }, svg);
    el("rect", { x: px, y: py, width: pw, height: ph * 0.62, style: "fill:#7fb3d5" }, g);
    el("rect", { x: px, y: py + ph * 0.62, width: pw, height: ph * 0.38, style: "fill:#6b8e4e" }, g);
    el("circle", { cx: px + pw * 0.78, cy: py + ph * 0.25, r: ph * 0.09, style: "fill:#f4d03f" }, g);
    el("path", { d: `M${px} ${py + ph * 0.62} L${px + pw * 0.25} ${py + ph * 0.38} L${px + pw * 0.45} ${py + ph * 0.62} Z`, style: "fill:#4d6a3a" }, g);
    el("rect", { x: px + pw * 0.48, y: py + ph * 0.42, width: pw * 0.04, height: ph * 0.26, rx: 3, style: "fill:#2c3e50" }, g);
    el("circle", { cx: px + pw * 0.5, cy: py + ph * 0.38, r: ph * 0.045, style: "fill:#2c3e50" }, g);
    if (safe) {
      for (const [f, label] of [[0.93, "action 93%"], [0.9, "title 90%"]]) {
        const w = pw * f, hh = ph * f;
        el("rect", { x: px + (pw - w) / 2, y: py + (ph - hh) / 2, width: w, height: hh, style: `fill:none;stroke:#fff;stroke-opacity:0.85;stroke-dasharray:${f === 0.9 ? "6 4" : "2 3"}` }, svg);
        text(svg, px + (pw - w) / 2 + 4, py + (ph - hh) / 2 + (f === 0.9 ? 24 : 12), label, { style: "fill:#fff;fill-opacity:0.9" });
      }
    }
    let fit, bar;
    if (Math.abs(rp - rs) < 1e-6) { fit = "fills the screen"; bar = "none"; }
    else if (rp > rs) { fit = "letterbox"; bar = `${num(((1 - rs / rp) / 2) * 100, 1)}% top and bottom`; }
    else { fit = "pillarbox"; bar = `${num(((1 - rp / rs) / 2) * 100, 1)}% left and right`; }
    o.fit.textContent = fit;
    o.bar.textContent = bar;
    o.used.textContent = `${num(Math.min(rp / rs, rs / rp) * 100, 1)}%`;
  }
  draw();
}

// ============================================================ Shot sizes

const ANGLE_NOTES = {
  eye: "Eye level: neutral, the camera is a witness.",
  high: "High angle: the camera looks down, the subject seems smaller, weaker, watched.",
  low: "Low angle: the camera looks up, the subject seems larger, powerful, threatening.",
  dutch: "Dutch angle: the horizon tilts, the world feels off balance.",
};

for (const root of document.querySelectorAll("[data-film-shots]")) {
  const note = root.querySelector("[data-angle-note]");
  let angle = "eye";
  root.addEventListener("seg-change", (e) => { angle = e.detail.value; draw(); note.textContent = ANGLE_NOTES[angle]; });

  // A figure 1 unit tall: 0 is the top of the head, 1 the soles.
  function figure(g, X, Y, s) {
    const st = "fill:var(--foreground);fill-opacity:0.82";
    el("circle", { cx: X(0), cy: Y(0.065), r: 0.065 * s }, g).setAttribute("style", st);
    el("ellipse", { cx: X(-0.022), cy: Y(0.06), rx: 0.008 * s, ry: 0.005 * s, style: "fill:var(--background)" }, g);
    el("ellipse", { cx: X(0.022), cy: Y(0.06), rx: 0.008 * s, ry: 0.005 * s, style: "fill:var(--background)" }, g);
    el("rect", { x: X(-0.025), y: Y(0.125), width: 0.05 * s, height: 0.04 * s, style: st }, g);
    el("path", { d: `M${X(-0.13)} ${Y(0.2)} Q${X(0)} ${Y(0.15)} ${X(0.13)} ${Y(0.2)} L${X(0.11)} ${Y(0.52)} L${X(-0.11)} ${Y(0.52)} Z`, style: st }, g);
    el("path", { d: `M${X(-0.13)} ${Y(0.2)} L${X(-0.17)} ${Y(0.5)} L${X(-0.13)} ${Y(0.5)} L${X(-0.1)} ${Y(0.26)} Z`, style: st }, g);
    el("path", { d: `M${X(0.13)} ${Y(0.2)} L${X(0.17)} ${Y(0.5)} L${X(0.13)} ${Y(0.5)} L${X(0.1)} ${Y(0.26)} Z`, style: st }, g);
    el("path", { d: `M${X(-0.11)} ${Y(0.5)} L${X(-0.09)} ${Y(1)} L${X(-0.02)} ${Y(1)} L${X(0)} ${Y(0.6)} L${X(0.02)} ${Y(1)} L${X(0.09)} ${Y(1)} L${X(0.11)} ${Y(0.5)} Z`, style: st }, g);
  }

  function draw() {
    for (const svg of root.querySelectorAll("[data-shot]")) {
      svg.replaceChildren();
      const top = +svg.dataset.top, bottom = +svg.dataset.bottom;
      const scale = 90 / (bottom - top);
      const g = el("g", {}, svg);
      if (angle === "dutch") g.setAttribute("transform", "rotate(-12 80 45)");
      let sy = 1, horizon = 0.62;
      if (angle === "high") { sy = 0.86; horizon = 0.3; }
      if (angle === "low") { sy = 1.12; horizon = 0.9; }
      const Y = (u) => (u - top) * scale * sy + (angle === "low" ? 90 * (1 - sy) : 0);
      const X = (u) => 80 + u * scale;
      // The horizon, where the shot is wide enough to show it.
      const hy = Y(horizon);
      if (hy > -20 && hy < 110 && bottom - top > 1.5) {
        el("rect", { x: -40, y: hy, width: 240, height: 160, style: "fill:currentColor;fill-opacity:0.08" }, g);
        el("line", { x1: -40, x2: 200, y1: hy, y2: hy, style: "stroke:currentColor;stroke-opacity:0.35" }, g);
      }
      figure(g, X, Y, scale);
    }
  }
  draw();
}

// ============================================================ 180-degree rule

for (const root of document.querySelectorAll("[data-film-axis]")) {
  const plan = root.querySelector("[data-plan]");
  const view = root.querySelector("[data-view]");
  const o = outs(root);
  const A = [160, 150], B = [240, 150], M = [200, 150];
  let cam = [200, 255];
  const startSide = Math.sign((B[0] - A[0]) * (cam[1] - A[1]) - (B[1] - A[1]) * (cam[0] - A[0]));

  const side = () => Math.sign((B[0] - A[0]) * (cam[1] - A[1]) - (B[1] - A[1]) * (cam[0] - A[0]));

  function project(P) {
    const d = [M[0] - cam[0], M[1] - cam[1]], n = Math.hypot(...d);
    const dir = [d[0] / n, d[1] / n], right = [-dir[1], dir[0]];
    const v = [P[0] - cam[0], P[1] - cam[1]];
    const depth = v[0] * dir[0] + v[1] * dir[1];
    return { x: (v[0] * right[0] + v[1] * right[1]) / depth, depth };
  }

  function draw() {
    plan.replaceChildren();
    const s = side();
    // Shade the half the camera started in: the safe side.
    const half = startSide > 0 ? `M0 150 L400 150 L400 300 L0 300 Z` : `M0 0 L400 0 L400 150 L0 150 Z`;
    el("path", { d: half, style: "fill:var(--brand);fill-opacity:0.06" }, plan);
    el("line", { x1: 10, x2: 390, y1: 150, y2: 150, style: "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:6 5" }, plan);
    text(plan, 386, 142, "axis of action", { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" });
    for (const [P, name, look] of [[A, "A", 1], [B, "B", -1]]) {
      el("circle", { cx: P[0], cy: P[1], r: 13, style: `fill:${name === "A" ? "var(--vec-u)" : "var(--ion-na)"}` }, plan);
      el("line", { x1: P[0], y1: P[1], x2: P[0] + look * 22, y2: P[1], style: "stroke:currentColor;stroke-width:1.5" }, plan);
      text(plan, P[0], P[1] + 4, name, { "text-anchor": "middle", style: "fill:#fff", class: "font-mono text-[11px]" });
    }
    // The camera: a body pointing at the pair.
    const ang = (Math.atan2(M[1] - cam[1], M[0] - cam[0]) * 180) / Math.PI;
    const g = el("g", { transform: `translate(${cam[0]} ${cam[1]}) rotate(${ang})`, tabindex: 0, role: "slider", "aria-label": "Camera position", "data-cam": "", style: "cursor:grab;outline:none" }, plan);
    el("rect", { x: -14, y: -9, width: 20, height: 18, rx: 3, style: `fill:var(--background);stroke:${s === startSide ? "var(--foreground)" : "var(--code-del)"};stroke-width:2` }, g);
    el("path", { d: "M6 -6 L18 -11 L18 11 L6 6 Z", style: `fill:${s === startSide ? "var(--foreground)" : "var(--code-del)"}` }, g);
    el("path", { d: `M${cam[0]} ${cam[1]} L${M[0]} ${M[1]}`, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, plan);

    // What the camera sees.
    view.replaceChildren();
    const pa = project(A), pb = project(B);
    for (const [p, name, color] of [[pa, "A", "var(--vec-u)"], [pb, "B", "var(--ion-na)"]]) {
      const x = 80 + p.x * 60, sz = clamp(900 / p.depth, 8, 40);
      el("rect", { x: x - sz * 0.35, y: 80 - sz * 1.6, width: sz * 0.7, height: sz * 1.6, rx: sz * 0.2, style: `fill:${color}` }, view);
      el("circle", { cx: x, cy: 80 - sz * 1.9, r: sz * 0.32, style: `fill:${color}` }, view);
      text(view, x, 88, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[8px]" });
    }
    const aLeft = pa.x < pb.x;
    o.a.textContent = aLeft ? "left, looking right" : "right, looking left";
    o.b.textContent = aLeft ? "right, looking left" : "left, looking right";
    o.side.textContent = s === startSide ? "same side: screen direction kept" : "crossed the line: a jump";
    o.side.className = s === startSide ? "" : "text-del";
  }

  const toPlan = (e) => {
    const p = plan.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(plan.getScreenCTM().inverse());
    return [q.x, q.y];
  };
  const moveCam = (p) => {
    let [x, y] = [clamp(p[0], 20, 380), clamp(p[1], 15, 285)];
    // Keep the camera off the line and away from the actors.
    if (Math.abs(y - 150) < 18) y = 150 + (y >= 150 ? 18 : -18);
    cam = [x, y];
    draw();
  };
  let dragging = false;
  plan.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-cam]")) return;
    dragging = true;
    plan.setPointerCapture(e.pointerId);
  });
  plan.addEventListener("pointermove", (e) => dragging && moveCam(toPlan(e)));
  plan.addEventListener("pointerup", () => (dragging = false));
  plan.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
    if (!d || !e.target.closest("[data-cam]")) return;
    e.preventDefault();
    moveCam([cam[0] + d[0], cam[1] + d[1]]);
    plan.querySelector("[data-cam]")?.focus();
  });
  root.querySelector("[data-action=cross]").addEventListener("click", () => moveCam([cam[0], 300 - cam[1]]));
  draw();
}

// ============================================================ Colour grading

for (const root of document.querySelectorAll("[data-film-grade]")) {
  const canvas = root.querySelector("[data-canvas]");
  const scope = root.querySelector("[data-scope]");
  const o = outs(root);
  const W = 320, H = 180;
  const neutral = () => ({ lift: 0, gamma: 1, gain: 1 });
  let params = { all: neutral(), r: neutral(), g: neutral(), b: neutral() }, ch = "all";
  const s = scrubAll(root, () => {
    params[ch] = { lift: s.lift.get(), gamma: s.gamma.get(), gain: s.gain.get() };
    render();
  });
  const showParams = () => {
    s.lift.set(params[ch].lift, false);
    s.gamma.set(params[ch].gamma, false);
    s.gain.set(params[ch].gain, false);
  };
  root.addEventListener("seg-change", (e) => { ch = e.detail.value; showParams(); });

  // The source frame, generated once: sky, sun, hills, ground, a figure.
  const src = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, v = y / H;
    let r, g, b;
    const hill = 0.55 + 0.08 * Math.sin(x / 37) + 0.05 * Math.sin(x / 13 + 1);
    if (v < hill) {
      const k = v / hill;
      [r, g, b] = [0.35 + 0.55 * k, 0.55 + 0.3 * k, 0.85 - 0.2 * k];
      const d = Math.hypot(x - 240, y - 55);
      if (d < 16) [r, g, b] = [1, 0.95, 0.75];
      else if (d < 40) { const a = 1 - (d - 16) / 24; r += 0.35 * a; g += 0.25 * a; b += 0.05 * a; }
    } else if (v < 0.72) {
      [r, g, b] = [0.2, 0.32, 0.18];
    } else {
      const k = (v - 0.72) / 0.28;
      [r, g, b] = [0.36 - 0.2 * k, 0.3 - 0.18 * k, 0.16 - 0.1 * k];
    }
    if (Math.abs(x - 110) < 6 && y > 92 && y < 140) [r, g, b] = [0.05, 0.05, 0.07];
    if (Math.hypot(x - 110, y - 86) < 8) [r, g, b] = [0.06, 0.06, 0.08];
    src[i] = clamp(r, 0, 1); src[i + 1] = clamp(g, 0, 1); src[i + 2] = clamp(b, 0, 1);
  }

  const grade = (x, p) => p.gain * Math.pow(Math.max(0, x + p.lift * (1 - x)), 1 / p.gamma);

  function render() {
    const { ctx, w, h } = fit(canvas);
    const img = new ImageData(W, H);
    const R = 160, wave = new Float32Array(W * R);
    let black = 1, white = 0, clipped = 0;
    const per = [params.r, params.g, params.b];
    for (let p = 0; p < W * H; p++) {
      let clip = false;
      const c = [0, 1, 2].map((k) => {
        const v = grade(grade(src[p * 3 + k], per[k]), params.all);
        if (v >= 1 || v <= 0) clip = true;
        return clamp(v, 0, 1);
      });
      if (clip) clipped++;
      img.data[p * 4] = c[0] * 255; img.data[p * 4 + 1] = c[1] * 255; img.data[p * 4 + 2] = c[2] * 255; img.data[p * 4 + 3] = 255;
      const Yl = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; // Rec. 709 luma
      black = Math.min(black, Yl); white = Math.max(white, Yl);
      const bin = (1 - Yl) * (R - 1), b0 = Math.floor(bin), fr = bin - b0, col = p % W;
      wave[b0 * W + col] += 1 - fr;
      if (fr > 0) wave[(b0 + 1) * W + col] += fr;
    }
    const off = new OffscreenCanvas(W, H);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.drawImage(off, 0, 0, w, h);

    const sc = fit(scope);
    sc.ctx.fillStyle = "#0a0a0a";
    sc.ctx.fillRect(0, 0, sc.w, sc.h);
    const wimg = new ImageData(W, R);
    for (let k = 0; k < W * R; k++) {
      const a = Math.min(255, wave[k] * 40);
      wimg.data[k * 4] = 120; wimg.data[k * 4 + 1] = 230; wimg.data[k * 4 + 2] = 140; wimg.data[k * 4 + 3] = a;
    }
    const woff = new OffscreenCanvas(W, R);
    woff.getContext("2d").putImageData(wimg, 0, 0);
    sc.ctx.drawImage(woff, 0, sc.h * 0.05, sc.w, sc.h * 0.9);
    sc.ctx.strokeStyle = "rgba(255,255,255,0.3)";
    sc.ctx.font = "10px 'Geist Mono', monospace";
    sc.ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (const [lv, lbl] of [[1, "100"], [0.5, "50"], [0, "0"]]) {
      const y = sc.h * 0.05 + (1 - lv) * sc.h * 0.9;
      sc.ctx.beginPath(); sc.ctx.moveTo(0, y); sc.ctx.lineTo(sc.w, y); sc.ctx.stroke();
      sc.ctx.fillText(lbl, 4, y - 3);
    }
    o.black.textContent = `${num(black * 100, 1)}%`;
    o.white.textContent = `${num(white * 100, 1)}%`;
    o.clip.textContent = `${num((clipped / (W * H)) * 100, 1)}% of pixels`;
  }

  root.querySelector("[data-action=reset]").addEventListener("click", () => {
    params = { all: neutral(), r: neutral(), g: neutral(), b: neutral() };
    showParams();
    render();
  });
  // Teal and orange: cool the shadows, warm the highlights.
  root.querySelector("[data-action=teal]").addEventListener("click", () => {
    params = { all: neutral(), r: { lift: -0.06, gamma: 1, gain: 1.12 }, g: { lift: 0.03, gamma: 1, gain: 0.98 }, b: { lift: 0.1, gamma: 1, gain: 0.8 } };
    showParams();
    render();
  });
  new ResizeObserver(render).observe(canvas);
  render();
}
