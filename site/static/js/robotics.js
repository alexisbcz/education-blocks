// Robotics blocks. Every picture comes from a model computed here: the
// planar Jacobian and its SVD, resolved-rate IK on a four-link arm,
// Denavit–Hartenberg chains, configuration space with A*, potential
// fields, pure pursuit on a bicycle model, log-odds occupancy mapping,
// Monte Carlo localization and ICP. The SCARA figure lives in
// ../anatomy/robotics-scara.js.

import "../anatomy/robotics-scara.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (v, d = 1) => num(v, d);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const path = (pts, close = false) => (pts.length ? "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + (close ? "Z" : "") : "");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// The pointer in the SVG's viewBox coordinates.
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, p.y];
}

// Pointer dragging on an SVG: pick(p) returns a drag target or null;
// move(target, p) is called while dragging; click(p) when nothing was picked.
function drags(svg, { pick, move, click, end }) {
  let target = null;
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const p = svgPoint(svg, e);
    target = pick?.(p) ?? null;
    if (target === null) { click?.(p); return; }
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    move(target, p);
  });
  svg.addEventListener("pointermove", (e) => { if (target !== null) move(target, svgPoint(svg, e)); });
  const stop = () => { if (target !== null) { target = null; end?.(); } };
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);
}

// A requestAnimationFrame loop behind the block's play/pause button. It
// stops off screen and does not autoplay under reduced motion.
function animate(root, step, { autoplay = true } = {}) {
  const btn = root.querySelector('[data-action="play"]');
  const label = btn?.querySelector("[data-label]");
  let playing = autoplay && !reduced(), visible = false, raf = 0, last = 0;
  const show = () => {
    if (!btn) return;
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !playing);
    if (label) label.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-pressed", String(playing));
  };
  const loop = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (step(dt) === false) { playing = false; show(); }
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  btn?.addEventListener("click", () => { playing = !playing; show(); kick(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  show();
  return {
    play() { playing = true; show(); kick(); },
    pause() { playing = false; show(); },
    get playing() { return playing; },
  };
}

// Reads a CSS colour (any syntax the browser knows) as [r, g, b].
const rgbCache = new Map();
function cssRGB(color) {
  if (rgbCache.has(color)) return rgbCache.get(color);
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d");
  x.fillStyle = "#808080";
  x.fillStyle = color;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  const out = [d[0], d[1], d[2]];
  if (rgbCache.size > 32) rgbCache.clear();
  rgbCache.set(color, out);
  return out;
}
const themeRGB = (node) => {
  const cs = getComputedStyle(node);
  let bg = "transparent";
  for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
    const b = getComputedStyle(n).backgroundColor;
    if (b && b !== "transparent" && !/rgba\(.*,\s*0\)$/.test(b)) { bg = b; break; }
  }
  return { fg: cssRGB(cs.color), bg: cssRGB(bg === "transparent" ? getComputedStyle(document.body).backgroundColor : bg) };
};

// 2 × 2 symmetric eigen-decomposition: [[a, b], [b, c]] → values (desc), angle of the first.
function eig2(a, b, c) {
  const m = (a + c) / 2, d = Math.hypot((a - c) / 2, b);
  return { l1: m + d, l2: Math.max(0, m - d), ang: 0.5 * Math.atan2(2 * b, a - c) };
}

// ---------------------------------------------------------------- R2 Jacobian and manipulability

for (const root of document.querySelectorAll("[data-robo-jac]")) {
  const svg = root.querySelector('[data-plot="plane"]');
  const wsvg = root.querySelector('[data-plot="w"]');
  const o = outs(root);
  let force = false;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { force = on; draw(); });
  const Y = (p) => [p[0], -p[1]];
  const ellipse = (c, sx, sy, ang, style) =>
    el("ellipse", { cx: c[0], cy: -c[1], rx: Math.max(0.3, sx), ry: Math.max(0.3, sy), transform: `rotate(${(-deg(ang)).toFixed(2)} ${c[0].toFixed(1)} ${(-c[1]).toFixed(1)})`, style }, svg);

  drags(svg, {
    pick: (p) => {
      const tip = fk();
      return Math.hypot(p[0] - tip[0], -p[1] - tip[1]) < 20 ? "tip" : null;
    },
    move: (_, p) => {
      // IK keeping the current elbow sign
      const l1 = s.l1.get(), l2 = s.l2.get();
      let x = p[0], y = -p[1];
      const r = Math.hypot(x, y), rmax = l1 + l2 - 0.01, rmin = Math.abs(l1 - l2) + 0.01;
      const rr = clamp(r, rmin, rmax);
      if (r > 0) { x *= rr / r; y *= rr / r; }
      const c2 = clamp((rr * rr - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
      const sign = s.t2.get() >= 0 ? 1 : -1;
      const t2 = sign * Math.acos(c2);
      const t1 = Math.atan2(y, x) - Math.atan2(l2 * Math.sin(t2), l1 + l2 * Math.cos(t2));
      s.t1.set(Math.round(deg(wrap(t1))), false);
      s.t2.set(Math.round(deg(t2)), false);
      draw();
    },
  });

  function fk() {
    const l1 = s.l1.get(), l2 = s.l2.get(), t1 = rad(s.t1.get()), t2 = rad(s.t2.get());
    return [l1 * Math.cos(t1) + l2 * Math.cos(t1 + t2), l1 * Math.sin(t1) + l2 * Math.sin(t1 + t2)];
  }

  function draw() {
    const l1 = s.l1.get(), l2 = s.l2.get(), t1 = rad(s.t1.get()), t2 = rad(s.t2.get());
    const e = [l1 * Math.cos(t1), l1 * Math.sin(t1)];
    const p = fk();
    const J = [[-l1 * Math.sin(t1) - l2 * Math.sin(t1 + t2), -l2 * Math.sin(t1 + t2)], [l1 * Math.cos(t1) + l2 * Math.cos(t1 + t2), l2 * Math.cos(t1 + t2)]];
    // J Jᵀ gives the velocity ellipse: axes √λ along its eigenvectors
    const a = J[0][0] ** 2 + J[0][1] ** 2, b = J[0][0] * J[1][0] + J[0][1] * J[1][1], c = J[1][0] ** 2 + J[1][1] ** 2;
    const E = eig2(a, b, c);
    const s1 = Math.sqrt(E.l1), s2 = Math.sqrt(E.l2);
    const w = Math.abs(J[0][0] * J[1][1] - J[0][1] * J[1][0]);

    svg.replaceChildren();
    const R = l1 + l2, r0 = Math.abs(l1 - l2);
    el("path", { d: `M${R},0A${R},${R} 0 1 0 ${-R},0A${R},${R} 0 1 0 ${R},0Z M${r0},0A${r0},${r0} 0 1 1 ${-r0},0A${r0},${r0} 0 1 1 ${r0},0Z`, style: "fill:var(--muted-foreground);fill-opacity:0.07;fill-rule:evenodd;stroke:var(--muted-foreground);stroke-opacity:0.25;stroke-dasharray:3 4" }, svg);
    el("line", { x1: -195, x2: 195, y1: 0, y2: 0, style: "stroke:currentColor;stroke-opacity:0.08" }, svg);
    el("line", { y1: -165, y2: 165, x1: 0, x2: 0, style: "stroke:currentColor;stroke-opacity:0.08" }, svg);
    // the ellipses at the tool (velocity: 0.45 px per mm/s at 1 rad/s)
    const K = 0.45;
    ellipse(p, s1 * K, s2 * K, E.ang, "fill:var(--brand);fill-opacity:0.12;stroke:var(--brand);stroke-width:1.5");
    if (force) {
      const F = 2400; // force ellipse axes ∝ 1/σ
      ellipse(p, Math.min(160, F / Math.max(s2, 1e-3)), Math.min(160, F / Math.max(s1, 1e-3)), E.ang, "fill:none;stroke:var(--vec-v);stroke-width:1.5;stroke-dasharray:5 3");
    }
    // principal axes
    const ax = (len, ang) => [p[0] + len * Math.cos(ang), p[1] + len * Math.sin(ang)];
    polyline(svg, [Y(ax(-s1 * K, E.ang)), Y(ax(s1 * K, E.ang))], "stroke:var(--brand);stroke-opacity:0.6;stroke-width:1");
    polyline(svg, [Y(ax(-s2 * K, E.ang + Math.PI / 2)), Y(ax(s2 * K, E.ang + Math.PI / 2))], "stroke:var(--brand);stroke-opacity:0.6;stroke-width:1");
    // links
    polyline(svg, [[0, 0], Y(e), Y(p)], "stroke:var(--foreground);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0.85");
    polyline(svg, [[0, 0], Y(e), Y(p)], "stroke:var(--background);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round");
    for (const q of [[0, 0], e]) el("circle", { cx: q[0], cy: -q[1], r: 5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    el("circle", { cx: p[0], cy: -p[1], r: 6, class: "cursor-grab", style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    el("rect", { x: -12, y: 4, width: 24, height: 8, rx: 1.5, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.4" }, svg);
    text(svg, -195, -155, "drag the pink tool point", {});
    if (w < 0.08 * l1 * l2) text(svg, 195, -155, "near a singularity", { "text-anchor": "end", style: "fill:var(--brand)" });

    // w(θ₂) = L₁L₂|sin θ₂|
    wsvg.replaceChildren();
    const f = frame(wsvg, { box: [40, 12, 345, 70], x: [-180, 180], y: [0, l1 * l2], xticks: [-180, -90, 0, 90, 180], yticks: [0, l1 * l2], yfmt: (v) => (v ? "L₁L₂" : "0"), xlabel: "θ₂ (°)", xfmt: (v) => num(v, 0) });
    const pts = [];
    for (let d = -180; d <= 180; d += 2) pts.push([f.sx(d), f.sy(l1 * l2 * Math.abs(Math.sin(rad(d))))]);
    polyline(wsvg, pts, "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.2");
    el("circle", { cx: f.sx(s.t2.get()), cy: f.sy(w), r: 4, style: "fill:var(--brand)" }, wsvg);
    text(wsvg, 385, 10, "w(θ₂) — independent of θ₁", { "text-anchor": "end" });

    o.J.textContent = `[${fmt(J[0][0], 0)} ${fmt(J[0][1], 0)}; ${fmt(J[1][0], 0)} ${fmt(J[1][1], 0)}]`;
    o.sv.textContent = `${fmt(s1, 1)}, ${fmt(s2, 1)} mm/rad`;
    o.w.textContent = `${fmt(w, 0)} mm²`;
    o.k.textContent = s2 < 1e-6 ? "∞ (singular)" : fmt(s1 / s2, 2);
  }
  draw();
}

// ---------------------------------------------------------------- R3 resolved-rate IK on a redundant arm

const RR_L = [60, 50, 40, 30];
function rrFK(q) {
  const pts = [[0, 0]];
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < q.length; i++) { a += q[i]; x += RR_L[i] * Math.cos(a); y += RR_L[i] * Math.sin(a); pts.push([x, y]); }
  return pts;
}
function rrJ(q) {
  const pts = rrFK(q), tip = pts[pts.length - 1];
  // column i: ẑ × (tip − joint i)
  return [q.map((_, i) => -(tip[1] - pts[i][1])), q.map((_, i) => tip[0] - pts[i][0])];
}
// Solves (J Jᵀ + μI) y = e for the 2 × 2 case, then returns Jᵀ y.
function rrSolve(J, e, mu) {
  const a = J[0].reduce((s, v) => s + v * v, 0) + mu, b = J[0].reduce((s, v, i) => s + v * J[1][i], 0), c = J[1].reduce((s, v) => s + v * v, 0) + mu;
  const det = a * c - b * b;
  const y0 = (c * e[0] - b * e[1]) / det, y1 = (-b * e[0] + a * e[1]) / det;
  return J[0].map((v, i) => v * y0 + J[1][i] * y1);
}

for (const root of document.querySelectorAll("[data-robo-rr]")) {
  const svg = root.querySelector('[data-plot="plane"]');
  const ssvg = root.querySelector('[data-plot="speed"]');
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let method = "dls";
  onSeg(root, (v) => { method = v; draw(); });
  let q = [rad(40), rad(-30), rad(-40), rad(-20)];
  let target = [110, 30];
  let qdMax = 0;
  const hist = []; // [t, max |q̇|]
  let t = 0;

  // the scene is redrawn every frame; the target stays, so it keeps focus
  const scene = el("g", {}, svg);
  const tg = el("g", { tabindex: 0, role: "slider", "aria-label": "Target; arrow keys move it", class: "cursor-grab outline-none" }, svg);
  const tRing = el("circle", { r: 9, style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-width:1.5" }, tg);
  const tDot = el("circle", { r: 2.5, style: "fill:var(--brand)" }, tg);
  tg.addEventListener("focus", () => tRing.style.setProperty("stroke-width", "3"));
  tg.addEventListener("blur", () => tRing.style.setProperty("stroke-width", "1.5"));
  tg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (!d) return;
    e.preventDefault();
    target = [clamp(target[0] + d[0], -205, 205), clamp(target[1] + d[1], -165, 165)];
    anim.play();
    draw();
  });
  drags(svg, {
    pick: (p) => (Math.hypot(p[0] - target[0], -p[1] - target[1]) < 22 ? "t" : null),
    move: (_, p) => { target = [clamp(p[0], -205, 205), clamp(-p[1], -165, 165)]; anim.play(); draw(); },
  });
  root.querySelector('[data-action="reach"]').addEventListener("click", () => {
    const a = Math.atan2(target[1], target[0]) || 0.3;
    target = [195 * Math.cos(a), 195 * Math.sin(a)];
    anim.play();
    draw();
  });

  function step(dt) {
    const tip = rrFK(q).at(-1);
    const e = [target[0] - tip[0], target[1] - tip[1]];
    const J = rrJ(q), gain = s.gain.get();
    let qd;
    if (method === "transpose") {
      // Buss's step for the transpose: α = ⟨e, JJᵀe⟩ / ‖JJᵀe‖²
      const jte = q.map((_, i) => J[0][i] * e[0] + J[1][i] * e[1]);
      const jjte = [J[0].reduce((a, v, i) => a + v * jte[i], 0), J[1].reduce((a, v, i) => a + v * jte[i], 0)];
      const n2 = jjte[0] ** 2 + jjte[1] ** 2;
      const alpha = n2 > 1e-12 ? (e[0] * jjte[0] + e[1] * jjte[1]) / n2 : 0;
      qd = jte.map((v) => v * alpha * gain);
    } else {
      const lam = method === "dls" ? s.lambda.get() : 0;
      qd = rrSolve(J, e, lam * lam || 1e-9).map((v) => v * gain);
    }
    const peak = Math.max(...qd.map(Math.abs));
    // a real motor saturates: cap the commanded speed so the sim stays finite
    const cap = 40;
    const sc = peak > cap ? cap / peak : 1;
    q = q.map((v, i) => wrap(v + qd[i] * sc * dt));
    qdMax = peak;
    t += dt;
    hist.push([t, peak]);
    while (hist.length && hist[0][0] < t - 8) hist.shift();
    draw();
  }
  const anim = animate(root, step);

  function sminOf() {
    const J = rrJ(q);
    const a = J[0].reduce((s, v) => s + v * v, 0), b = J[0].reduce((s, v, i) => s + v * J[1][i], 0), c = J[1].reduce((s, v) => s + v * v, 0);
    return Math.sqrt(eig2(a, b, c).l2);
  }

  function draw() {
    const svg = scene;
    svg.replaceChildren();
    const R = RR_L.reduce((a, b) => a + b);
    el("circle", { cx: 0, cy: 0, r: R, style: "fill:var(--muted-foreground);fill-opacity:0.06;stroke:var(--muted-foreground);stroke-opacity:0.3;stroke-dasharray:3 4" }, svg);
    const pts = rrFK(q).map((p) => [p[0], -p[1]]);
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0.85");
    polyline(svg, pts, "stroke:var(--background);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round");
    pts.slice(0, -1).forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 4.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg));
    el("rect", { x: -12, y: 4, width: 24, height: 8, rx: 1.5, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.4" }, svg);
    const tip = pts.at(-1);
    el("line", { x1: tip[0], y1: tip[1], x2: target[0], y2: -target[1], style: "stroke:var(--brand);stroke-dasharray:3 3;stroke-opacity:0.7" }, svg);
    el("circle", { cx: tip[0], cy: tip[1], r: 3, style: "fill:var(--foreground)" }, svg);
    for (const c of [tRing, tDot]) { c.setAttribute("cx", target[0]); c.setAttribute("cy", -target[1]); }
    text(svg, -210, -180, "drag the target", {});

    ssvg.replaceChildren();
    const f = frame(ssvg, { box: [44, 10, 365, 74], x: [Math.max(0, t - 8), Math.max(8, t)], y: [-2, 2], yticks: [-2, 0, 2], yfmt: (v) => ["0.01", "1", "100"][v / 2 + 1], xlabel: "max |q̇| (rad/s), last 8 s" });
    const pts2 = hist.map(([tt, v]) => [f.sx(tt), f.sy(clamp(Math.log10(Math.max(v, 1e-2)), -2, 2))]);
    if (pts2.length > 1) polyline(ssvg, pts2, "stroke:var(--brand);stroke-width:1.5");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(Math.log10(40)), y2: f.sy(Math.log10(40)), style: "stroke:var(--foreground);stroke-opacity:0.3;stroke-dasharray:4 3" }, ssvg);
    text(ssvg, f.L + f.W - 2, f.sy(Math.log10(40)) - 3, "motor limit", { "text-anchor": "end" });

    const err = Math.hypot(target[0] - rrFK(q).at(-1)[0], target[1] - rrFK(q).at(-1)[1]);
    o.err.textContent = `${fmt(err, 1)} mm${Math.hypot(...target) > R ? " (out of reach)" : ""}`;
    o.qd.textContent = `${qdMax > 999 ? qdMax.toExponential(1) : fmt(qdMax, 2)} rad/s`;
    o.smin.textContent = `${fmt(sminOf(), 1)} mm/rad`;
    o.q.textContent = q.map((v) => fmt(deg(v), 0) + "°").join(" ");
  }
  draw();
}

// ---------------------------------------------------------------- R4 Denavit–Hartenberg

const DH_PRESETS = {
  elbow: { types: "RRR", rows: [[30, 60, 0, 90], [40, 0, 80, 0], [-60, 0, 70, 0]] },
  scara: { types: "RRP", rows: [[20, 60, 80, 0], [50, 0, 60, 180], [0, 30, 0, 0]] },
  planar: { types: "RRR", rows: [[30, 0, 70, 0], [40, 0, 60, 0], [-50, 0, 40, 0]] },
};
// Standard DH: Rot_z(θ) Trans_z(d) Trans_x(a) Rot_x(α).
function dhMatrix(th, d, a, al) {
  const ct = Math.cos(th), st = Math.sin(th), ca = Math.cos(al), sa = Math.sin(al);
  return [[ct, -st * ca, st * sa, a * ct], [st, ct * ca, -ct * sa, a * st], [0, sa, ca, d], [0, 0, 0, 1]];
}
const mul4 = (A, B) => A.map((r) => [0, 1, 2, 3].map((j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));

for (const root of document.querySelectorAll("[data-robo-dh]")) {
  const svg = root.querySelector('[data-plot="view"]');
  const o = outs(root);
  const pre = root.querySelector("[data-dh-matrix]");
  const copy = root.querySelector("[data-dh-copy] [data-copy]");
  const s = scrubAll(root, () => draw());
  let types = "RRR", az = rad(-35), elv = rad(25);
  const load = (name) => {
    const p = DH_PRESETS[name];
    types = p.types;
    p.rows.forEach((r, i) => {
      const n = i + 1;
      s["t" + n].set(r[0], false); s["d" + n].set(r[1], false); s["a" + n].set(r[2], false); s["al" + n].set(r[3], false);
      const tag = root.querySelector(`[data-dh-type="${n}"]`);
      if (tag) tag.textContent = types[i];
    });
    draw();
  };
  onSeg(root, load);
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY, az, elv]; svg.setPointerCapture(e.pointerId); svg.classList.add("cursor-grabbing"); });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    az = drag[2] + (e.clientX - drag[0]) * 0.01;
    elv = clamp(drag[3] + (e.clientY - drag[1]) * 0.01, rad(-5), rad(85));
    draw();
  });
  const up = () => { drag = null; svg.classList.remove("cursor-grabbing"); };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);

  // orthographic camera: turn by az about z, tilt by elv
  const proj = ([x, y, z]) => {
    const xr = x * Math.cos(az) - y * Math.sin(az), yr = x * Math.sin(az) + y * Math.cos(az);
    return [xr, -(z * Math.cos(elv) + yr * Math.sin(elv)) + 50];
  };
  const seg = (a, b, style) => el("line", { x1: proj(a)[0], y1: proj(a)[1], x2: proj(b)[0], y2: proj(b)[1], style }, svg);

  function draw() {
    svg.replaceChildren();
    // floor grid
    for (let v = -120; v <= 120; v += 30) {
      seg([v, -120, 0], [v, 120, 0], "stroke:currentColor;stroke-opacity:0.08");
      seg([-120, v, 0], [120, v, 0], "stroke:currentColor;stroke-opacity:0.08");
    }
    const Ts = [[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]];
    for (let i = 1; i <= 3; i++) {
      const th = rad(s["t" + i].get()), d = s["d" + i].get(), a = s["a" + i].get(), al = rad(s["al" + i].get());
      Ts.push(mul4(Ts[i - 1], dhMatrix(th, d, a, al)));
    }
    const orig = (T) => [T[0][3], T[1][3], T[2][3]];
    const axis = (T, k, len) => [T[0][3] + T[0][k] * len, T[1][3] + T[1][k] * len, T[2][3] + T[2][k] * len];
    // links: along z_{i−1} by d, then along x_i by a
    for (let i = 1; i <= 3; i++) {
      const p0 = orig(Ts[i - 1]), d = s["d" + i].get();
      const mid = axis(Ts[i - 1], 2, d);
      const p1 = orig(Ts[i]);
      for (const [a, b] of [[p0, mid], [mid, p1]]) {
        seg(a, b, "stroke:var(--foreground);stroke-width:6;stroke-linecap:round;stroke-opacity:0.8");
        seg(a, b, "stroke:var(--background);stroke-width:2.5;stroke-linecap:round");
      }
      // the joint: a short barrel along z_{i−1} (revolute) or a sleeve (prismatic)
      const j0 = axis(Ts[i - 1], 2, -7), j1 = axis(Ts[i - 1], 2, 7);
      seg(j0, j1, `stroke:var(--muted-foreground);stroke-width:${types[i - 1] === "P" ? 7 : 9};stroke-linecap:${types[i - 1] === "P" ? "butt" : "round"};stroke-opacity:0.55`);
    }
    // frames
    Ts.forEach((T, i) => {
      const p = orig(T);
      const L = i === 3 ? 30 : 22;
      seg(p, axis(T, 0, L), "stroke:var(--brand);stroke-width:2;stroke-linecap:round");
      seg(p, axis(T, 1, L), "stroke:var(--code-add);stroke-width:2;stroke-linecap:round");
      seg(p, axis(T, 2, L), "stroke:var(--vec-u);stroke-width:2;stroke-linecap:round");
      const q = proj(p);
      el("circle", { cx: q[0], cy: q[1], r: 2.5, style: "fill:var(--foreground)" }, svg);
      text(svg, q[0] - 8, q[1] + 12, String(i), { class: "fill-foreground font-mono text-[11px]" });
    });
    text(svg, -165, -122, "drag to orbit", {});

    const T = Ts[3];
    const w = 8;
    const rows = T.map((r) => r.map((v, j) => (j === 3 ? fmt(v, 1) : fmt(v, 3)).padStart(w)).join(" "));
    pre.textContent = "⁰T₃ =\n" + rows.map((r) => " " + r).join("\n");
    copy?.setAttribute("data-copy", rows.join("\n").replaceAll("−", "-"));
    o.p.textContent = `(${fmt(T[0][3], 1)}, ${fmt(T[1][3], 1)}, ${fmt(T[2][3], 1)}) mm`;
    o.z.textContent = `(${fmt(T[0][2], 2)}, ${fmt(T[1][2], 2)}, ${fmt(T[2][2], 2)})`;
  }
  load("elbow");
}

// ---------------------------------------------------------------- R5 configuration space

for (const root of document.querySelectorAll("[data-robo-cs]")) {
  const work = root.querySelector('[data-plot="work"]');
  const cs = root.querySelector('[data-plot="cspace"]');
  const canvas = root.querySelector("[data-cs-canvas]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const N = 120, STEP = 360 / N;
  canvas.width = canvas.height = N;
  let seed = 7, obstacles = [], grid = new Uint8Array(N * N), pose = [0, 0], goal = null, plan = [], following = 0, expanded = 0;
  const s = scrubAll(root, (name) => { if (name === "obs") makeRoom(); else rebuild(); });

  const idx = (i, j) => ((j + N) % N) * N + ((i + N) % N);
  const cellOf = (t1, t2) => [Math.floor((((t1 + 180) % 360) + 360) % 360 / STEP), Math.floor((((t2 + 180) % 360) + 360) % 360 / STEP)];
  const angOf = (i, j) => [-180 + (i + 0.5) * STEP, -180 + (j + 0.5) * STEP];
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function armPts(t1, t2) {
    const l1 = s.l1.get(), l2 = s.l2.get(), a = rad(t1), b = rad(t1 + t2);
    const e = [l1 * Math.cos(a), l1 * Math.sin(a)];
    return [[0, 0], e, [e[0] + l2 * Math.cos(b), e[1] + l2 * Math.sin(b)]];
  }
  function collides(t1, t2) {
    const [o0, e, p] = armPts(t1, t2);
    for (const ob of obstacles) {
      const r = ob.r + 3; // link half-thickness
      if (segDist([ob.x, ob.y], o0, e) < r || segDist([ob.x, ob.y], e, p) < r) return true;
    }
    return false;
  }
  function makeRoom() {
    for (let tries = 0; tries < 60; tries++) {
      const rng = mulberry32(seed * 7919 + tries);
      obstacles = [];
      const n = Math.round(s.obs.get());
      while (obstacles.length < n) {
        const r = 12 + rng() * 16, d = 55 + rng() * 95, a = rng() * 2 * Math.PI;
        const ob = { x: d * Math.cos(a), y: d * Math.sin(a), r };
        if (obstacles.every((q) => Math.hypot(q.x - ob.x, q.y - ob.y) > q.r + ob.r + 10)) obstacles.push(ob);
      }
      pose = [0, 0];
      // start: the first free pose among a few natural ones, else anywhere
      let start = [[30, 60], [-60, 70], [120, -50], [0, 100], [-150, 40], [90, 90]].find((a) => !collides(...a)) ?? null;
      for (let k = 0; k < N * N && !start; k += 7) { const a = angOf(k % N, Math.floor(k / N)); if (!collides(...a)) start = a; }
      if (!start) continue;
      pose = start;
      rebuild();
      // a goal far away in C-space that the planner can reach
      for (let k = 0; k < 400; k++) {
        const g = [-180 + rng() * 360, -180 + rng() * 360];
        if (collides(...g)) continue;
        if (Math.hypot(wrapD(g[0] - pose[0]), wrapD(g[1] - pose[1])) < 120) continue;
        goal = g;
        replan();
        if (plan.length) return;
      }
    }
  }
  const wrapD = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  function rebuild() {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) grid[j * N + i] = collides(...angOf(i, j)) ? 1 : 0;
    if (goal) replan(); else draw();
  }
  function replan() {
    plan = [];
    expanded = 0;
    if (!goal) return draw();
    const [si, sj] = cellOf(...pose), [gi, gj] = cellOf(...goal);
    if (grid[idx(gi, gj)] || grid[idx(si, sj)]) return draw();
    const h = (i, j) => Math.hypot(Math.min(Math.abs(i - gi), N - Math.abs(i - gi)), Math.min(Math.abs(j - gj), N - Math.abs(j - gj)));
    const g = new Float64Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    // binary heap of [f, cell]
    const heap = [];
    const push = (f, c) => { heap.push([f, c]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s0 = idx(si, sj), goalC = idx(gi, gj);
    g[s0] = 0;
    push(h(si, sj), s0);
    while (heap.length) {
      const [, c] = pop();
      if (closed[c]) continue;
      closed[c] = 1;
      expanded++;
      if (c === goalC) break;
      const ci = c % N, cj = Math.floor(c / N);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const n = idx(ci + di, cj + dj);
        if (grid[n] || closed[n]) continue;
        const ng = g[c] + (di && dj ? Math.SQRT2 : 1);
        if (ng < g[n]) { g[n] = ng; from[n] = c; push(ng + h((ci + di + N) % N, (cj + dj + N) % N), n); }
      }
    }
    if (from[goalC] !== -1 || s0 === goalC) {
      for (let c = goalC; c !== -1; c = from[c]) plan.push(angOf(c % N, Math.floor(c / N)));
      plan.reverse();
      plan[0] = [...pose];
      plan[plan.length - 1] = [...goal];
    }
    draw();
  }
  function setGoal(g) {
    goal = g;
    following = 0;
    replan();
  }
  function ikGoal(x, y) {
    const l1 = s.l1.get(), l2 = s.l2.get();
    const r = Math.hypot(x, y);
    if (r > l1 + l2 || r < Math.abs(l1 - l2)) return null;
    const c2 = clamp((r * r - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
    const sols = [1, -1].map((sg) => {
      const t2 = sg * Math.acos(c2);
      return [deg(Math.atan2(y, x) - Math.atan2(l2 * Math.sin(t2), l1 + l2 * Math.cos(t2))), deg(t2)].map(wrapD);
    }).filter((q) => !collides(...q));
    if (!sols.length) return "blocked";
    sols.sort((a, b) => Math.hypot(wrapD(a[0] - pose[0]), wrapD(a[1] - pose[1])) - Math.hypot(wrapD(b[0] - pose[0]), wrapD(b[1] - pose[1])));
    return sols[0];
  }
  let dragOb = null;
  drags(work, {
    pick: (p) => {
      const w = [p[0], -p[1]];
      const ob = obstacles.find((q) => Math.hypot(q.x - w[0], q.y - w[1]) < q.r);
      return ob ?? null;
    },
    move: (ob, p) => { ob.x = clamp(p[0], -160, 160); ob.y = clamp(-p[1], -160, 160); dragOb = ob; rebuild(); },
    click: (p) => {
      const g = ikGoal(p[0], -p[1]);
      if (Array.isArray(g)) setGoal(g);
      else { o.goal.textContent = g === "blocked" ? "both IK poses collide" : "out of reach"; }
    },
    end: () => { dragOb = null; },
  });
  drags(cs, { click: (p) => setGoal([clamp(p[0], -180, 180), clamp(-p[1], -180, 180)]) });
  root.querySelector('[data-action="reseed"]').addEventListener("click", () => { seed++; makeRoom(); });
  root.querySelector('[data-action="go"]').addEventListener("click", () => {
    if (!plan.length) return;
    following = 1;
    if (reduced()) { pose = [...goal]; following = 0; replan(); return; }
    let i = 0;
    const tick = () => {
      if (!following) return;
      i = Math.min(plan.length - 1, i + 1);
      pose = plan[i];
      drawWork();
      if (i < plan.length - 1) requestAnimationFrame(tick);
      else { following = 0; replan(); }
    };
    requestAnimationFrame(tick);
  });

  function drawArm(svg, t1, t2, style, joint = true) {
    const pts = armPts(t1, t2).map((p) => [p[0], -p[1]]);
    polyline(svg, pts, `stroke-width:6;stroke-linecap:round;stroke-linejoin:round;${style}`);
    if (joint) pts.slice(0, 2).forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.2" }, svg));
  }
  function drawWork() {
    work.replaceChildren();
    const R = s.l1.get() + s.l2.get();
    el("circle", { cx: 0, cy: 0, r: R, style: "fill:none;stroke:var(--muted-foreground);stroke-opacity:0.25;stroke-dasharray:3 4" }, work);
    if (plan.length > 1) {
      const tips = plan.map((q) => armPts(...q)[2]).map((p) => [p[0], -p[1]]);
      polyline(work, tips, "stroke:var(--brand);stroke-opacity:0.45;stroke-width:1.2;stroke-dasharray:2 3");
    }
    for (const ob of obstacles) el("circle", { cx: ob.x, cy: -ob.y, r: ob.r, class: "cursor-grab", style: `fill:var(--muted-foreground);fill-opacity:${ob === dragOb ? 0.55 : 0.35};stroke:var(--foreground);stroke-opacity:0.4` }, work);
    if (goal) drawArm(work, ...goal, "stroke:var(--brand);stroke-opacity:0.35", false);
    drawArm(work, ...pose, `stroke:var(--foreground);stroke-opacity:${collides(...pose) ? 0.4 : 0.85}`);
    const tip = armPts(...pose)[2];
    el("circle", { cx: tip[0], cy: -tip[1], r: 3, style: "fill:var(--brand)" }, work);
    // C-space marker for the current pose
    const m = cs.querySelector("[data-pose]");
    if (m) { m.setAttribute("cx", pose[0]); m.setAttribute("cy", -pose[1]); }
  }
  function draw() {
    const { fg } = themeRGB(canvas);
    const img = ctx.createImageData(N, N);
    let free = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = grid[j * N + i], k = ((N - 1 - j) * N + i) * 4; // θ₂ up
      if (!c) { free++; continue; }
      img.data[k] = fg[0]; img.data[k + 1] = fg[1]; img.data[k + 2] = fg[2]; img.data[k + 3] = 95;
    }
    ctx.putImageData(img, 0, 0);
    cs.replaceChildren();
    el("line", { x1: -180, x2: 180, y1: 0, y2: 0, style: "stroke:currentColor;stroke-opacity:0.12" }, cs);
    el("line", { x1: 0, x2: 0, y1: -180, y2: 180, style: "stroke:currentColor;stroke-opacity:0.12" }, cs);
    text(cs, 176, -6, "θ₁", { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[14px]" });
    text(cs, 6, -166, "θ₂", { class: "fill-muted-foreground font-mono text-[14px]" });
    if (plan.length > 1) {
      // split where a joint wraps through ±180°
      let run = [[plan[0][0], -plan[0][1]]];
      for (let k = 1; k < plan.length; k++) {
        const a = plan[k - 1], b = plan[k];
        if (Math.abs(b[0] - a[0]) > 180 || Math.abs(b[1] - a[1]) > 180) { polyline(cs, run, "stroke:var(--brand);stroke-width:3"); run = []; }
        run.push([b[0], -b[1]]);
      }
      polyline(cs, run, "stroke:var(--brand);stroke-width:3");
    }
    if (goal) el("circle", { cx: goal[0], cy: -goal[1], r: 7, style: "fill:none;stroke:var(--brand);stroke-width:2.5" }, cs);
    el("circle", { "data-pose": "", cx: pose[0], cy: -pose[1], r: 6, style: "fill:var(--foreground);stroke:var(--background);stroke-width:2" }, cs);
    drawWork();
    const len = plan.slice(1).reduce((a, q, k) => a + Math.hypot(wrapD(q[0] - plan[k][0]), wrapD(q[1] - plan[k][1])), 0);
    o.free.textContent = `${fmt((100 * free) / (N * N), 1)}% of ${N * N}`;
    o.path.textContent = !goal ? "—" : plan.length ? `${fmt(len, 0)}° of joint motion` : "no path (goal walled off)";
    o.exp.textContent = `${expanded} cells`;
    if (goal) o.goal.textContent = `(${fmt(goal[0], 0)}°, ${fmt(goal[1], 0)}°)`;
  }
  makeRoom();
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// ---------------------------------------------------------------- R6 potential fields

const PF_ROOMS = {
  open: { start: [60, 300], goal: [460, 70], obs: [{ c: [200, 210], r: 30 }, { c: [330, 140], r: 34 }, { c: [320, 280], r: 22 }, { c: [130, 90], r: 18 }] },
  trap: { start: [70, 180], goal: [460, 180], obs: [{ a: [230, 100], b: [330, 100] }, { a: [330, 100], b: [330, 260] }, { a: [330, 260], b: [230, 260] }] },
  gap: { start: [60, 180], goal: [460, 180], obs: [{ a: [260, 10], b: [260, 158] }, { a: [260, 202], b: [260, 350] }] },
};
for (const root of document.querySelectorAll("[data-robo-pf]")) {
  const svg = root.querySelector('[data-plot="map"]');
  const o = outs(root);
  let room = "open", start = [...PF_ROOMS.open.start], goal = [...PF_ROOMS.open.goal], arrows = true;
  const s = scrubAll(root, () => draw());
  onSeg(root, (v) => { room = v; start = [...PF_ROOMS[v].start]; goal = [...PF_ROOMS[v].goal]; draw(); });
  onToggle(root, (_, on) => { arrows = on; draw(); });
  drags(svg, {
    pick: (p) => (Math.hypot(p[0] - goal[0], p[1] - goal[1]) < 16 ? "goal" : Math.hypot(p[0] - start[0], p[1] - start[1]) < 16 ? "start" : null),
    move: (w, p) => { const q = [clamp(p[0], 6, 514), clamp(p[1], 6, 354)]; if (w === "goal") goal = q; else start = q; draw(); },
  });
  // nearest point on an obstacle (circle or segment) and the distance to its surface
  function nearest(ob, x) {
    if (ob.r) {
      const d = Math.hypot(x[0] - ob.c[0], x[1] - ob.c[1]) || 1e-9;
      return { rho: d - ob.r, n: [(x[0] - ob.c[0]) / d, (x[1] - ob.c[1]) / d] };
    }
    const dx = ob.b[0] - ob.a[0], dy = ob.b[1] - ob.a[1];
    const t = clamp(((x[0] - ob.a[0]) * dx + (x[1] - ob.a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    const px = ob.a[0] + t * dx, py = ob.a[1] + t * dy;
    const d = Math.hypot(x[0] - px, x[1] - py) || 1e-9;
    return { rho: d - 4, n: [(x[0] - px) / d, (x[1] - py) / d] };
  }
  // −∇U at x
  function force(x) {
    const k = s.k.get(), eta = s.eta.get() * 1e4, rho0 = s.rho.get();
    const F = [-k * (x[0] - goal[0]), -k * (x[1] - goal[1])];
    for (const ob of PF_ROOMS[room].obs) {
      const { rho, n } = nearest(ob, x);
      if (rho >= rho0) continue;
      const r = Math.max(rho, 0.5);
      const m = eta * (1 / r - 1 / rho0) / (r * r);
      F[0] += m * n[0]; F[1] += m * n[1];
    }
    return F;
  }
  function run() {
    const pts = [[...start]];
    let x = [...start], outcome = "stuck", steps = 0, len = 0;
    for (steps = 1; steps <= 2500; steps++) {
      const F = force(x), m = Math.hypot(...F);
      if (Math.hypot(x[0] - goal[0], x[1] - goal[1]) < 4) { outcome = "goal"; break; }
      if (m < 1e-3) break;
      const stepLen = 2;
      x = [x[0] + (F[0] / m) * stepLen, x[1] + (F[1] / m) * stepLen];
      len += stepLen;
      pts.push(x);
      if (steps > 150 && Math.hypot(x[0] - pts[pts.length - 150][0], x[1] - pts[pts.length - 150][1]) < 6) break;
    }
    return { pts, outcome, steps: Math.min(steps, 2500), len, grad: Math.hypot(...force(x)), end: x };
  }
  function draw() {
    svg.replaceChildren();
    el("rect", { x: 0.5, y: 0.5, width: 519, height: 359, rx: 6, style: "fill:none;stroke:currentColor;stroke-opacity:0.12" }, svg);
    const rho0 = s.rho.get();
    for (const ob of PF_ROOMS[room].obs) {
      if (ob.r) {
        el("circle", { cx: ob.c[0], cy: ob.c[1], r: ob.r + rho0, style: "fill:var(--muted-foreground);fill-opacity:0.05;stroke:var(--muted-foreground);stroke-opacity:0.25;stroke-dasharray:2 4" }, svg);
        el("circle", { cx: ob.c[0], cy: ob.c[1], r: ob.r, style: "fill:var(--muted-foreground);fill-opacity:0.35;stroke:var(--foreground);stroke-opacity:0.4" }, svg);
      } else {
        el("line", { x1: ob.a[0], y1: ob.a[1], x2: ob.b[0], y2: ob.b[1], style: `stroke:var(--muted-foreground);stroke-opacity:0.07;stroke-width:${2 * rho0 + 8};stroke-linecap:round` }, svg);
        el("line", { x1: ob.a[0], y1: ob.a[1], x2: ob.b[0], y2: ob.b[1], style: "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:8;stroke-linecap:round" }, svg);
      }
    }
    if (arrows) {
      const g = el("g", { style: "stroke:var(--muted-foreground);stroke-opacity:0.5;stroke-width:1;fill:none" }, svg);
      for (let y = 15; y < 360; y += 22) for (let x = 15; x < 520; x += 22) {
        if (PF_ROOMS[room].obs.some((ob) => nearest(ob, [x, y]).rho < 1)) continue;
        const F = force([x, y]), m = Math.hypot(...F) || 1;
        const u = [F[0] / m, F[1] / m], L = 7;
        const a = [x - u[0] * L / 2, y - u[1] * L / 2], b = [x + u[0] * L / 2, y + u[1] * L / 2];
        el("path", { d: `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}M${(b[0] - u[0] * 3 - u[1] * 2).toFixed(1)},${(b[1] - u[1] * 3 + u[0] * 2).toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}L${(b[0] - u[0] * 3 + u[1] * 2).toFixed(1)},${(b[1] - u[1] * 3 - u[0] * 2).toFixed(1)}` }, g);
      }
    }
    const r = run();
    polyline(svg, r.pts, "stroke:var(--brand);stroke-width:2.2;stroke-linejoin:round");
    if (r.outcome !== "goal") {
      el("circle", { cx: r.end[0], cy: r.end[1], r: 9, style: "fill:none;stroke:var(--brand);stroke-width:1.5;stroke-dasharray:3 2" }, svg);
      text(svg, r.end[0] - 12, r.end[1] - 12, "local minimum", { "text-anchor": "end", style: "fill:var(--brand)" });
    }
    el("circle", { cx: start[0], cy: start[1], r: 7, class: "cursor-grab", style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
    text(svg, start[0], start[1] + 20, "start", { "text-anchor": "middle" });
    el("circle", { cx: goal[0], cy: goal[1], r: 8, class: "cursor-grab", style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, goal[0], goal[1] + 21, "goal", { "text-anchor": "middle" });
    o.out.textContent = r.outcome === "goal" ? "reached the goal" : `stuck ${fmt(Math.hypot(r.end[0] - goal[0], r.end[1] - goal[1]), 0)} px short`;
    o.steps.textContent = String(r.steps);
    o.len.textContent = `${fmt(r.len, 0)} px (straight ${fmt(Math.hypot(goal[0] - start[0], goal[1] - start[1]), 0)})`;
    o.grad.textContent = fmt(r.grad, 2);
  }
  draw();
}

// ---------------------------------------------------------------- R7 pure pursuit

function ppPath(kind) {
  const pts = [];
  if (kind === "s") for (let x = 40; x <= 520; x += 2) pts.push([x, 170 + 95 * Math.sin(((x - 40) / 480) * 2 * Math.PI)]);
  else if (kind === "lane") for (let x = 30; x <= 530; x += 2) pts.push([x, x < 200 ? 230 : x > 300 ? 110 : 230 - 120 * ((1 - Math.cos(((x - 200) / 100) * Math.PI)) / 2)]);
  else {
    const c = [[90, 60], [470, 60], [470, 280], [90, 280]];
    for (let e = 0; e < 4; e++) {
      const a = c[e], b = c[(e + 1) % 4], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      for (let i = 0; i < n; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
    }
  }
  return { pts, loop: kind === "square" };
}
for (const root of document.querySelectorAll("[data-robo-pp]")) {
  const svg = root.querySelector('[data-plot="map"]');
  const esvg = root.querySelector('[data-plot="err"]');
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const WB = 22;
  let kind = "s", P = ppPath(kind), st, track, errs, t, near, sumsq, n, done, look, kappa, delta;
  function reset() {
    const p0 = P.pts[0], p1 = P.pts[6];
    const h = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    st = { x: p0[0] - 10, y: p0[1] + 28, h: h - 0.5 };
    track = [[st.x, st.y]];
    errs = []; t = 0; near = 0; sumsq = 0; n = 0; done = false; look = null; kappa = 0; delta = 0;
    draw();
  }
  onSeg(root, (v) => { kind = v; P = ppPath(v); reset(); anim.play(); });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { reset(); anim.play(); });
  const N = () => P.pts.length;
  const at = (i) => P.pts[P.loop ? ((i % N()) + N()) % N() : clamp(i, 0, N() - 1)];
  function step(dt) {
    if (done) return false;
    const v = s.v.get(), Ld = s.ld.get(), dmax = rad(s.dmax.get());
    // nearest point, searched forward from the last one
    let best = Infinity, bi = near;
    for (let i = near; i < near + 80; i++) {
      if (!P.loop && i >= N()) break;
      const p = at(i), d = Math.hypot(p[0] - st.x, p[1] - st.y);
      if (d < best) { best = d; bi = i; }
    }
    near = bi;
    // lookahead: the first path point at least L_d away, from the nearest on
    let li = near;
    while ((P.loop || li < N() - 1) && li < near + N() && Math.hypot(at(li)[0] - st.x, at(li)[1] - st.y) < Ld) li++;
    look = at(li);
    const alpha = wrap(Math.atan2(look[1] - st.y, look[0] - st.x) - st.h);
    const Lr = Math.max(Math.hypot(look[0] - st.x, look[1] - st.y), 1e-6);
    kappa = (2 * Math.sin(alpha)) / Lr;
    delta = clamp(Math.atan(kappa * WB), -dmax, dmax);
    const sub = 4;
    for (let k = 0; k < sub; k++) {
      const h = dt / sub;
      st.h = wrap(st.h + (v / WB) * Math.tan(delta) * h);
      st.x += v * Math.cos(st.h) * h;
      st.y += v * Math.sin(st.h) * h;
    }
    track.push([st.x, st.y]);
    if (track.length > 2000) track.shift();
    // signed cross-track error to the nearest segment
    const a = at(near), b = at(near + 1);
    const cross = (b[0] - a[0]) * (st.y - a[1]) - (b[1] - a[1]) * (st.x - a[0]);
    const cte = Math.sign(cross || 1) * best;
    t += dt;
    errs.push([t, cte]);
    sumsq += cte * cte; n++;
    if (!P.loop && near >= N() - 3) done = true;
    if (P.loop && t > 30) done = true;
    if (st.x < -60 || st.x > 620 || st.y < -60 || st.y > 400) done = true;
    draw();
    return !done;
  }
  const anim = animate(root, step);
  function draw() {
    svg.replaceChildren();
    el("rect", { x: 0.5, y: 0.5, width: 559, height: 339, rx: 6, style: "fill:none;stroke:currentColor;stroke-opacity:0.12" }, svg);
    polyline(svg, P.loop ? [...P.pts, P.pts[0]] : P.pts, "stroke:var(--muted-foreground);stroke-width:2;stroke-dasharray:6 4;stroke-opacity:0.7");
    if (track.length > 1) polyline(svg, track, "stroke:var(--brand);stroke-width:2;stroke-opacity:0.85");
    if (look) {
      // the arc of curvature κ from the robot, up to the lookahead point
      const arc = [[st.x, st.y]];
      let x = st.x, y = st.y, h = st.h;
      const L = s.ld.get();
      for (let i = 0; i < 30; i++) { const d = L / 30; h += kappa * d; x += d * Math.cos(h); y += d * Math.sin(h); arc.push([x, y]); }
      polyline(svg, arc, "stroke:var(--vec-u);stroke-width:1.5");
      el("circle", { cx: st.x, cy: st.y, r: s.ld.get(), style: "fill:none;stroke:var(--vec-u);stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
      el("circle", { cx: look[0], cy: look[1], r: 4, style: "fill:var(--vec-u)" }, svg);
    }
    // the robot: a body, rear axle at (x, y), steered front wheels
    const g = el("g", { transform: `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)}) rotate(${deg(st.h).toFixed(1)})` }, svg);
    el("rect", { x: -6, y: -8, width: WB + 12, height: 16, rx: 3, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, g);
    for (const yy of [-9, 9]) {
      el("rect", { x: -4, y: yy - 1.5, width: 8, height: 3, rx: 1, style: "fill:var(--foreground)" }, g);
      el("rect", { x: -4, y: -1.5, width: 8, height: 3, rx: 1, transform: `translate(${WB} ${yy}) rotate(${deg(delta).toFixed(1)})`, style: "fill:var(--foreground)" }, g);
    }
    el("circle", { cx: 0, cy: 0, r: 1.8, style: "fill:var(--brand)" }, g);

    esvg.replaceChildren();
    const T = Math.max(8, t);
    const f = frame(esvg, { box: [40, 8, 505, 64], x: [Math.max(0, T - 12), T], y: [-30, 30], yticks: [-30, 0, 30], yfmt: (v) => num(v, 0), xlabel: "cross-track error (px), last 12 s" });
    const pts = errs.filter(([tt]) => tt >= T - 12).map(([tt, e]) => [f.sx(tt), f.sy(clamp(e, -30, 30))]);
    if (pts.length > 1) polyline(esvg, pts, "stroke:var(--brand);stroke-width:1.5");
    const last = errs.at(-1)?.[1] ?? 0;
    o.cte.textContent = `${fmt(last, 1)} px`;
    o.rms.textContent = n ? `${fmt(Math.sqrt(sumsq / n), 1)} px` : "—";
    o.steer.textContent = `${fmt(deg(delta), 1)}°${Math.abs(delta) >= rad(s.dmax.get()) - 1e-6 ? " (at limit)" : ""}`;
    o.kappa.textContent = `${fmt(kappa * 1000, 1)} ×10⁻³ /px`;
  }
  reset();
}

// ---------------------------------------------------------------- R8 occupancy grid mapping

const OG_W = 60, OG_H = 44;
function ogTruth() {
  const g = new Uint8Array(OG_W * OG_H);
  const box = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * OG_W + x] = 1; };
  box(0, 0, OG_W - 1, 0); box(0, OG_H - 1, OG_W - 1, OG_H - 1); box(0, 0, 0, OG_H - 1); box(OG_W - 1, 0, OG_W - 1, OG_H - 1);
  box(20, 1, 21, 16); box(20, 26, 21, 42); // a wall with a doorway
  box(38, 10, 46, 15); // a table
  box(8, 30, 11, 33); // a box
  box(40, 30, 41, 42); box(42, 30, 50, 31); // an alcove
  return g;
}
const OG_LOOP = [[8, 8], [14, 20], [10, 38], [28, 38], [30, 22], [34, 6], [54, 6], [54, 22], [34, 24], [28, 20], [16, 22], [8, 8]];
for (const root of document.querySelectorAll("[data-robo-og]")) {
  const world = root.querySelector('[data-plot="world"]');
  const canvas = root.querySelector("[data-og-canvas]");
  canvas.width = OG_W; canvas.height = OG_H;
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const truth = ogTruth();
  const s = scrubAll(root, () => drawWorld());
  const rng = mulberry32(42);
  let L = new Float32Array(OG_W * OG_H), seen = new Uint8Array(OG_W * OG_H), pose = [...OG_LOOP[0]], seg = 0, segT = 0, scans = 0, clock = 0, beams = [];
  const C = 5; // px per cell
  const MAXR = 22;
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { L = new Float32Array(OG_W * OG_H); seen = new Uint8Array(OG_W * OG_H); scans = 0; render(); });
  const occ = (x, y) => x < 0 || y < 0 || x >= OG_W || y >= OG_H || truth[Math.floor(y) * OG_W + Math.floor(x)] === 1;
  function cast(a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    for (let r = 0; r < MAXR; r += 0.05) if (occ(pose[0] + 0.5 + dx * r, pose[1] + 0.5 + dy * r)) return r;
    return Infinity;
  }
  function scan() {
    const lHit = Math.log(s.phit.get() / (1 - s.phit.get())), lFree = Math.log(s.pfree.get() / (1 - s.pfree.get()));
    const n = Math.round(s.beams.get()), sigma = s.noise.get();
    beams = [];
    const x0 = Math.floor(pose[0] + 0.5), y0 = Math.floor(pose[1] + 0.5);
    for (let b = 0; b < n; b++) {
      const a = (b / n) * 2 * Math.PI + scans * 0.07;
      const r0 = cast(a);
      const hit = Number.isFinite(r0);
      const r = hit ? Math.max(0.5, r0 + sigma * gauss(rng)) : MAXR;
      const ex = pose[0] + 0.5 + Math.cos(a) * r, ey = pose[1] + 0.5 + Math.sin(a) * r;
      beams.push([ex, ey, hit]);
      // Bresenham from the robot's cell to the end cell
      let x = x0, y = y0;
      const x1 = clamp(Math.floor(ex), 0, OG_W - 1), y1 = clamp(Math.floor(ey), 0, OG_H - 1);
      const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
      let err = dx + dy;
      while (!(x === x1 && y === y1)) {
        const k = y * OG_W + x;
        L[k] = clamp(L[k] + lFree, -8, 8); seen[k] = 1;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      const k = y1 * OG_W + x1;
      if (hit) { L[k] = clamp(L[k] + lHit, -8, 8); seen[k] = 1; }
    }
    scans++;
  }
  function render() {
    const { fg, bg } = themeRGB(canvas);
    const img = ctx.createImageData(OG_W, OG_H);
    let nseen = 0, agree = 0;
    for (let k = 0; k < OG_W * OG_H; k++) {
      const p = 1 / (1 + Math.exp(-L[k]));
      for (let c = 0; c < 3; c++) img.data[k * 4 + c] = Math.round(bg[c] + (fg[c] - bg[c]) * p);
      img.data[k * 4 + 3] = 255;
      if (seen[k]) { nseen++; if ((p > 0.5) === (truth[k] === 1)) agree++; }
    }
    ctx.putImageData(img, 0, 0);
    o.scans.textContent = String(scans);
    o.seen.textContent = `${nseen} of ${OG_W * OG_H}`;
    o.acc.textContent = nseen ? `${fmt((100 * agree) / nseen, 1)}% of seen cells` : "—";
    drawWorld();
  }
  function drawWorld() {
    world.replaceChildren();
    const g = el("g", { style: "fill:var(--muted-foreground);fill-opacity:0.45" }, world);
    for (let y = 0; y < OG_H; y++) for (let x = 0; x < OG_W; x++) if (truth[y * OG_W + x]) el("rect", { x: x * C, y: y * C, width: C, height: C }, g);
    polyline(world, OG_LOOP.map(([x, y]) => [(x + 0.5) * C, (y + 0.5) * C]), "stroke:var(--foreground);stroke-opacity:0.18;stroke-dasharray:2 3");
    const bg = el("g", { style: "stroke:var(--vec-u);stroke-opacity:0.35;stroke-width:0.6" }, world);
    const cx = (pose[0] + 0.5) * C, cy = (pose[1] + 0.5) * C;
    for (const [x, y, hit] of beams) {
      el("line", { x1: cx, y1: cy, x2: x * C, y2: y * C }, bg);
      if (hit) el("circle", { cx: x * C, cy: y * C, r: 1.2, style: "fill:var(--vec-u);stroke:none" }, world);
    }
    el("circle", { cx, cy, r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, world);
  }
  animate(root, (dt) => {
    // drive along the loop at 6 cells/s; scan every 0.25 s
    let d = 6 * dt;
    while (d > 0) {
      const a = OG_LOOP[seg], b = OG_LOOP[(seg + 1) % OG_LOOP.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const left = len - segT;
      if (d < left) { segT += d; d = 0; } else { d -= left; segT = 0; seg = (seg + 1) % (OG_LOOP.length - 1); }
      const a2 = OG_LOOP[seg], b2 = OG_LOOP[seg + 1], l2 = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) || 1;
      pose = [a2[0] + ((b2[0] - a2[0]) * segT) / l2, a2[1] + ((b2[1] - a2[1]) * segT) / l2];
    }
    clock += dt;
    if (clock >= 0.25) { clock = 0; scan(); render(); } else drawWorld();
  });
  scan();
  render();
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// ---------------------------------------------------------------- R9 Monte Carlo localization

const MCL = { x0: 30, x1: 530, doors: [[100, 130], [180, 210], [390, 420]] };
for (const root of document.querySelectorAll("[data-robo-mcl]")) {
  const svg = root.querySelector('[data-plot="corridor"]');
  const o = outs(root);
  const rng = mulberry32(2024);
  const LEN = MCL.x1 - MCL.x0;
  const U = 14; // commanded motion per step
  const s = scrubAll(root, (name) => { if (name === "n") init(); });
  let robot, parts, lastZ = null, neff = 0;
  const ring = (x) => MCL.x0 + ((((x - MCL.x0) % LEN) + LEN) % LEN);
  const atDoor = (x) => MCL.doors.some(([a, b]) => x >= a && x <= b);
  function init(keepRobot = false) {
    if (!keepRobot) robot = 60;
    const n = Math.round(s.n.get());
    parts = Array.from({ length: n }, () => MCL.x0 + rng() * LEN);
    lastZ = null; neff = n;
    draw();
  }
  function step() {
    const n = parts.length, acc = s.acc.get() / 100, sig = s.mnoise.get();
    // the robot moves (with its own wheel slip) and senses
    robot = ring(robot + U + gauss(rng) * 1.5);
    const truth = atDoor(robot);
    const z = rng() < acc ? truth : !truth;
    lastZ = z;
    // predict, weight, resample (low variance), plus 2% random particles
    const moved = parts.map((x) => ring(x + U + gauss(rng) * sig));
    const w = moved.map((x) => (atDoor(x) === z ? acc : 1 - acc));
    const sum = w.reduce((a, b) => a + b, 0);
    const wn = w.map((v) => v / sum);
    neff = 1 / wn.reduce((a, b) => a + b * b, 0);
    const out = [];
    const keep = Math.round(n * 0.98);
    let r = rng() / keep, c = wn[0], i = 0;
    for (let m = 0; m < keep; m++) {
      const u = r + m / keep;
      while (u > c && i < n - 1) { i++; c += wn[i]; }
      out.push(moved[i]);
    }
    while (out.length < n) out.push(MCL.x0 + rng() * LEN);
    parts = out;
    draw();
  }
  root.querySelector('[data-action="step"]').addEventListener("click", step);
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { robot = MCL.x0 + rng() * LEN; lastZ = null; draw(); });
  let acc = 0;
  animate(root, (dt) => { acc += dt; if (acc > 0.45) { acc = 0; step(); } }, { autoplay: false });

  function estimate() {
    const bins = new Float64Array(50);
    for (const x of parts) bins[Math.min(49, Math.floor(((x - MCL.x0) / LEN) * 50))]++;
    let best = 0;
    for (let b = 1; b < 50; b++) if (bins[b] > bins[best]) best = b;
    // mean of particles within ±30 of the best bin (on the ring)
    const c = MCL.x0 + ((best + 0.5) / 50) * LEN;
    let sx = 0, cnt = 0;
    for (const x of parts) {
      let d = x - c;
      d -= LEN * Math.round(d / LEN);
      if (Math.abs(d) < 30) { sx += d; cnt++; }
    }
    return { bins, est: ring(c + (cnt ? sx / cnt : 0)), share: cnt / parts.length };
  }
  function draw() {
    svg.replaceChildren();
    // corridor walls and doors
    const wallY = 30;
    el("rect", { x: MCL.x0, y: wallY - 18, width: LEN, height: 18, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.3" }, svg);
    for (const [a, b] of MCL.doors) {
      el("rect", { x: a, y: wallY - 16, width: b - a, height: 16, rx: 1, style: "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.5" }, svg);
      el("circle", { cx: b - 5, cy: wallY - 8, r: 1.3, style: "fill:var(--foreground);fill-opacity:0.6" }, svg);
    }
    el("line", { x1: MCL.x0, x2: MCL.x1, y1: wallY + 34, y2: wallY + 34, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
    text(svg, MCL.x0, wallY + 46, "the corridor loops: the right end leads back to the left", {});
    // robot
    const rx = robot;
    el("rect", { x: rx - 9, y: wallY + 6, width: 18, height: 14, rx: 3, style: "fill:var(--brand);fill-opacity:0.2;stroke:var(--brand);stroke-width:1.5" }, svg);
    el("line", { x1: rx, y1: wallY + 6, x2: rx, y2: wallY + 1, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    if (lastZ !== null) text(svg, rx, wallY + 31, lastZ ? "door!" : "wall", { "text-anchor": "middle", style: "fill:var(--brand)" });
    // particles, jittered vertically for visibility
    const pg = el("g", { style: "fill:var(--vec-u);fill-opacity:0.45" }, svg);
    const jr = mulberry32(5);
    for (const x of parts.slice(0, 1500)) el("circle", { cx: x.toFixed(1), cy: (92 + jr() * 30).toFixed(1), r: 1.4 }, pg);
    // belief histogram
    const { bins, est, share } = estimate();
    const top = Math.max(...bins), base = 218, H = 80, bw = LEN / 50;
    bins.forEach((v, b) => {
      const h = top ? (v / top) * H : 0;
      el("rect", { x: MCL.x0 + b * bw + 0.5, y: base - h, width: bw - 1, height: h, style: "fill:var(--muted-foreground);fill-opacity:0.45" }, svg);
    });
    el("line", { x1: MCL.x0, x2: MCL.x1, y1: base, y2: base, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    el("line", { x1: rx, x2: rx, y1: wallY + 20, y2: base, style: "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:3 3" }, svg);
    el("path", { d: `M${est.toFixed(1)},${base + 2}l-4,7h8z`, style: "fill:var(--foreground)" }, svg);
    let err = est - robot;
    err -= LEN * Math.round(err / LEN);
    o.z.textContent = lastZ === null ? "—" : lastZ ? "door" : "wall";
    o.est.textContent = `x ≈ ${fmt(est - MCL.x0, 0)} (${fmt(share * 100, 0)}% of particles)`;
    o.err.textContent = `${fmt(Math.abs(err), 0)} px`;
    o.neff.textContent = `${fmt(neff, 0)} of ${parts.length}`;
  }
  init();
}

// ---------------------------------------------------------------- R10 ICP scan matching

function icpRoom() {
  // an L-shaped room and a round pillar, as point samples: a dense
  // reference (every 3 px) and a sparser scan (every 9 px, offset)
  const poly = [[-150, -100], [150, -100], [150, 20], [40, 20], [40, 100], [-150, 100]];
  const sample = (step, phase) => {
    const out = [];
    for (let e = 0; e < poly.length; e++) {
      const a = poly[e], b = poly[(e + 1) % poly.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = phase; d < len; d += step) out.push([a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len]);
    }
    const n = Math.round((2 * Math.PI * 18) / step);
    for (let k = 0; k < n; k++) { const t = ((k + phase / step) / n) * 2 * Math.PI; out.push([-60 + 18 * Math.cos(t), 10 + 18 * Math.sin(t)]); }
    return out;
  };
  return { ref: sample(3, 0), raw: sample(9, 4.5) };
}
for (const root of document.querySelectorAll("[data-robo-icp]")) {
  const svg = root.querySelector('[data-plot="map"]');
  const esvg = root.querySelector('[data-plot="err"]');
  const o = outs(root);
  const room = icpRoom();
  let scan, T, pairs, errs, it, running = false;
  const s = scrubAll(root, () => reset());
  const apply = ([th, tx, ty], p) => [Math.cos(th) * p[0] - Math.sin(th) * p[1] + tx, Math.sin(th) * p[0] + Math.cos(th) * p[1] + ty];
  function reset() {
    const rng = mulberry32(11);
    const off = [rad(s.rot.get()), s.dx.get(), s.dy.get()], sig = s.noise.get();
    scan = room.raw.map((p) => apply(off, [p[0] + sig * gauss(rng), p[1] + sig * gauss(rng)]));
    T = [0, 0, 0]; errs = []; it = 0; running = false;
    pair();
    errs.push(meanErr());
    draw();
  }
  function pair() {
    pairs = scan.map((p) => {
      const q = apply(T, p);
      let best = Infinity, bi = 0;
      room.ref.forEach((r, i) => { const d = (r[0] - q[0]) ** 2 + (r[1] - q[1]) ** 2; if (d < best) { best = d; bi = i; } });
      return bi;
    });
  }
  const meanErr = () => scan.reduce((a, p, i) => { const q = apply(T, p), r = room.ref[pairs[i]]; return a + Math.hypot(q[0] - r[0], q[1] - r[1]); }, 0) / scan.length;
  function iterate() {
    // closed-form 2-D alignment of the current pairs (Arun et al. 1987)
    const P = scan.map((p) => apply(T, p)), Q = pairs.map((i) => room.ref[i]);
    const n = P.length;
    const pc = [P.reduce((a, p) => a + p[0], 0) / n, P.reduce((a, p) => a + p[1], 0) / n];
    const qc = [Q.reduce((a, p) => a + p[0], 0) / n, Q.reduce((a, p) => a + p[1], 0) / n];
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      const a = [P[i][0] - pc[0], P[i][1] - pc[1]], b = [Q[i][0] - qc[0], Q[i][1] - qc[1]];
      sxx += a[0] * b[0] + a[1] * b[1];
      sxy += a[0] * b[1] - a[1] * b[0];
    }
    const th = Math.atan2(sxy, sxx);
    const rpc = apply([th, 0, 0], pc);
    const dT = [th, qc[0] - rpc[0], qc[1] - rpc[1]];
    // compose: new T = dT ∘ T
    const t = apply(dT, [T[1], T[2]]);
    T = [wrap(T[0] + dT[0]), t[0], t[1]];
    it++;
    pair();
    errs.push(meanErr());
    draw();
    return Math.abs(errs.at(-2) - errs.at(-1)) > 1e-5 && it < 120;
  }
  root.querySelector('[data-action="step"]').addEventListener("click", () => { running = false; iterate(); });
  root.querySelector('[data-action="reset"]').addEventListener("click", reset);
  root.querySelector('[data-action="run"]').addEventListener("click", () => {
    if (running) return;
    running = true;
    const go = () => {
      if (!running) return;
      const more = iterate();
      if (more) reduced() ? go() : setTimeout(go, 120);
      else running = false;
    };
    go();
  });
  function draw() {
    svg.replaceChildren();
    const rg = el("g", { style: "fill:var(--muted-foreground)" }, svg);
    for (const p of room.ref) el("circle", { cx: p[0].toFixed(1), cy: (-p[1]).toFixed(1), r: 1.1 }, rg);
    const pg = el("g", { style: "stroke:var(--vec-u);stroke-opacity:0.45;stroke-width:0.8" }, svg);
    const sg = el("g", { style: "fill:var(--brand)" }, svg);
    scan.forEach((p, i) => {
      const q = apply(T, p), r = room.ref[pairs[i]];
      el("line", { x1: q[0].toFixed(1), y1: (-q[1]).toFixed(1), x2: r[0].toFixed(1), y2: (-r[1]).toFixed(1) }, pg);
      el("circle", { cx: q[0].toFixed(1), cy: (-q[1]).toFixed(1), r: 2 }, sg);
    });
    // the scan's own sensor origin, carried by the transform
    const origin = apply(T, apply([rad(s.rot.get()), s.dx.get(), s.dy.get()], [0, 0]));
    el("circle", { cx: origin[0], cy: -origin[1], r: 4, style: "fill:none;stroke:var(--brand);stroke-width:1.5" }, svg);
    el("circle", { cx: 0, cy: 0, r: 4, style: "fill:none;stroke:var(--muted-foreground);stroke-width:1.5" }, svg);

    esvg.replaceChildren();
    const top = Math.max(...errs, 1);
    const f = frame(esvg, { box: [40, 10, 345, 62], x: [0, Math.max(10, errs.length - 1)], y: [0, top], yticks: [0, top], yfmt: (v) => num(v, 1), xlabel: "iteration" });
    polyline(esvg, errs.map((e, i) => [f.sx(i), f.sy(e)]), "stroke:var(--brand);stroke-width:1.5");
    errs.forEach((e, i) => el("circle", { cx: f.sx(i), cy: f.sy(e), r: 2, style: "fill:var(--brand)" }, esvg));

    // the estimated offset is the inverse of T
    const inv = [-T[0], ...apply([-T[0], 0, 0], [-T[1], -T[2]])];
    o.it.textContent = String(it);
    o.err.textContent = `${fmt(errs.at(-1), 2)} px`;
    o.pose.textContent = `${fmt(deg(inv[0]), 1)}°, (${fmt(inv[1], 1)}, ${fmt(inv[2], 1)})`;
    o.truth.textContent = `${fmt(s.rot.get(), 1)}°, (${fmt(s.dx.get(), 1)}, ${fmt(s.dy.get(), 1)})`;
  }
  reset();
}
