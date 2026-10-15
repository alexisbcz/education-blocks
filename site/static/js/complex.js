// Complex analysis blocks. Complex numbers are [re, im] pairs; every value
// shown is computed here, from the same formulas the block text states.

import { P, el, line, arrow, polygon, handle } from "./svg.js";
import { frame, polyline, text } from "./plot.js";
import { scrubAll } from "./scrub.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

// ------------------------------------------------------------ complex maths

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const abs = (a) => Math.hypot(a[0], a[1]);
const arg = (a) => Math.atan2(a[1], a[0]);
const cexp = (a) => [Math.exp(a[0]) * Math.cos(a[1]), Math.exp(a[0]) * Math.sin(a[1])];
const csin = (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])];
const polar = (r, t) => [r * Math.cos(t), r * Math.sin(t)];

const n2 = (v, d = 2) => {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return (Object.is(r, -0) ? 0 : r).toFixed(d).replace("-", "−");
};
/** a + bi, with a real minus sign and the sign of b in the middle. */
const cstr = (z, d = 2) => {
  if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) return "∞";
  const im = Math.round(z[1] * 10 ** d) / 10 ** d;
  return `${n2(z[0], d)} ${im < 0 ? "−" : "+"} ${n2(Math.abs(im), d)}i`;
};
const deg = (t) => `${n2((t * 180) / Math.PI, 1)}°`;

// A grid with axes in a world-unit SVG plane.
function grid(parent, lo, hi, step = 1) {
  for (let k = Math.ceil(lo / step) * step; k <= hi; k += step) {
    const s = Math.abs(k) < 1e-9 ? "stroke:currentColor;stroke-opacity:0.35;stroke-width:1px" : "stroke:currentColor;stroke-opacity:0.07;stroke-width:1px";
    line(parent, [k, lo], [k, hi], s);
    line(parent, [lo, k], [hi, k], s);
  }
}
function label(parent, [x, y], s, style = "fill:var(--muted-foreground)", size = 0.3) {
  const t = el("text", { x, y: -y, style: `font-size:${size}px;font-family:var(--font-mono);${style}` }, parent);
  t.textContent = s;
  return t;
}
function dot(parent, [x, y], r, style) {
  return el("circle", { cx: x, cy: -y, r, style }, parent);
}
function keyNudge(node, get, set, stepSize = 0.1) {
  node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = e.shiftKey ? stepSize * 10 : stepSize;
    const p = get();
    set([p[0] + d[0] * s, p[1] + d[1] * s]);
  });
}
const snap = (p, lim, q = 0.05) => p.map((v) => Math.max(-lim, Math.min(lim, Math.round(v / q) * q)));

// ============================================================ arithmetic

for (const root of document.querySelectorAll("[data-cx-arith]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  let z = [2, 1], w = [1, 1], op = "add";
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  const hz = handle(svg, top, "z", (p) => { z = snap(p, 3.8); draw(); });
  const hw = handle(svg, top, "w", (p) => { w = snap(p, 3.8); draw(); });
  keyNudge(hz.node, () => z, (p) => { z = snap(p, 3.8); draw(); });
  keyNudge(hw.node, () => w, (p) => { w = snap(p, 3.8); draw(); });
  root.addEventListener("seg-change", (e) => { op = e.detail.value; draw(); });

  function arc(c, r, a0, a1, style) {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(add(c, polar(r, a0 + ((a1 - a0) * i) / 40)));
    el("path", { d: "M" + pts.map((p) => P(p).join(",")).join(" L"), style: "fill:none;" + style, "vector-effect": "non-scaling-stroke" }, scene);
  }

  function draw() {
    scene.replaceChildren();
    grid(scene, -4, 4);
    let r;
    let rule = "";
    if (op === "add") {
      r = add(z, w);
      line(scene, z, r, "stroke:var(--vec-v);stroke-opacity:0.5;stroke-dasharray:4 3;stroke-width:1.25px");
      line(scene, w, r, "stroke:var(--vec-u);stroke-opacity:0.5;stroke-dasharray:4 3;stroke-width:1.25px");
      rule = "add the parts: real with real, imaginary with imaginary";
    } else if (op === "mul" || op === "div") {
      r = op === "mul" ? mul(z, w) : abs(w) < 1e-9 ? [NaN, NaN] : div(z, w);
      const az = arg(z), aw = arg(w);
      arc([0, 0], 0.55, 0, az, "stroke:var(--vec-u);stroke-width:1.5px");
      arc([0, 0], 0.75, 0, aw, "stroke:var(--vec-v);stroke-width:1.5px");
      if (Number.isFinite(r[0])) arc([0, 0], 0.95, 0, arg(r), "stroke:var(--brand);stroke-width:1.5px");
      rule = op === "mul"
        ? `lengths multiply ${n2(abs(z))} × ${n2(abs(w))} = ${n2(abs(z) * abs(w))}; angles add ${deg(az)} + ${deg(aw)}`
        : abs(w) < 1e-9 ? "division by zero is undefined" : `lengths divide ${n2(abs(z))} ÷ ${n2(abs(w))}; angles subtract ${deg(az)} − ${deg(aw)}`;
    } else {
      r = [z[0], -z[1]];
      line(scene, [-4, 0], [4, 0], "stroke:var(--brand);stroke-opacity:0.35;stroke-width:1px;stroke-dasharray:2 3");
      line(scene, z, r, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3;stroke-width:1px");
      rule = "reflect across the real axis: z̄ = a − bi, and z·z̄ = |z|²";
    }
    arrow(scene, [0, 0], z, "var(--vec-u)");
    if (op !== "conj") arrow(scene, [0, 0], w, "var(--vec-v)");
    if (Number.isFinite(r[0]) && Math.abs(r[0]) < 40 && Math.abs(r[1]) < 40) {
      const clip = [Math.max(-3.9, Math.min(3.9, r[0])), Math.max(-3.9, Math.min(3.9, r[1]))];
      arrow(scene, [0, 0], clip, "var(--brand)", 2.5);
      if (clip[0] !== r[0] || clip[1] !== r[1]) label(scene, add(clip, [-0.6, 0.25]), "off the view");
    }
    label(scene, add(z, [0.15, 0.15]), "z", "fill:var(--vec-u)", 0.36);
    if (op !== "conj") label(scene, add(w, [0.15, 0.15]), "w", "fill:var(--vec-v)", 0.36);
    hz.place(z, "var(--vec-u)");
    hw.place(w, "var(--vec-v)");
    hw.node.style.display = op === "conj" ? "none" : "";
    o.z.textContent = cstr(z);
    o.w.textContent = op === "conj" ? "—" : cstr(w);
    o.r.textContent = cstr(r);
    o.polar.textContent = Number.isFinite(r[0]) ? `${n2(abs(r))}, ${deg(arg(r))}` : "—";
    o.rule.textContent = rule;
  }
  draw();
}

// ============================================================ Euler

for (const root of document.querySelectorAll("[data-cx-euler]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  // The angle is kept exactly; the field shows it rounded to its step.
  let theta = 1;
  const s = scrubAll(root, () => { theta = s.theta.get(); draw(); });
  const btn = root.querySelector("[data-action=play]");
  btn.querySelector("[data-label]").textContent = "Play";
  let raf = 0, last = 0;
  const C = [140, 150], R = 105;

  function draw() {
    const t = theta;
    svg.replaceChildren();
    // Circle side, in pixel coordinates.
    const g = el("g", {}, svg);
    for (const [x1, y1, x2, y2] of [[C[0] - 125, C[1], C[0] + 125, C[1]], [C[0], C[1] - 125, C[0], C[1] + 125]])
      el("line", { x1, y1, x2, y2, style: "stroke:currentColor;stroke-opacity:0.3" }, g);
    el("circle", { cx: C[0], cy: C[1], r: R, style: "fill:none;stroke:currentColor;stroke-opacity:0.35" }, g);
    const px = C[0] + R * Math.cos(t), py = C[1] - R * Math.sin(t);
    // Angle arc.
    const arcPts = Array.from({ length: 49 }, (_, i) => { const a = (t * i) / 48; return [C[0] + 26 * Math.cos(a), C[1] - 26 * Math.sin(a)]; });
    polyline(g, arcPts, "stroke:var(--brand);stroke-width:1.5");
    el("line", { x1: C[0], y1: C[1], x2: px, y2: py, style: "stroke:var(--brand);stroke-width:2.5;stroke-linecap:round" }, g);
    el("line", { x1: px, y1: py, x2: px, y2: C[1], style: "stroke:var(--vec-v);stroke-width:2;stroke-dasharray:3 3" }, g);
    el("line", { x1: C[0], y1: C[1], x2: px, y2: C[1], style: "stroke:var(--vec-u);stroke-width:3;stroke-linecap:round" }, g);
    el("line", { x1: px, y1: py, x2: 300, y2: py, style: "stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:2 4" }, g);
    el("circle", { cx: px, cy: py, r: 5, style: "fill:var(--brand)" }, g);
    text(g, C[0] + R + 6, C[1] - 4, "1");
    text(g, C[0] - R - 16, C[1] - 4, "−1");
    text(g, C[0] + 4, C[1] - R - 6, "i");
    // Waves, θ from 0 to 4π.
    const f = frame(svg, { box: [320, 45, 380, 210], x: [0, 4 * Math.PI], y: [-1.2, 1.2], xticks: [0, Math.PI, 2 * Math.PI, 3 * Math.PI, 4 * Math.PI], yticks: [-1, 0, 1], xfmt: (v) => ["0", "π", "2π", "3π", "4π"][Math.round(v / Math.PI)], yfmt: (v) => String(v).replace("-", "−") });
    const xs = Array.from({ length: 241 }, (_, i) => (4 * Math.PI * i) / 240);
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(Math.sin(x))]), "stroke:var(--vec-v);stroke-width:1.75");
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(Math.cos(x))]), "stroke:var(--vec-u);stroke-width:1.75;stroke-dasharray:5 4");
    el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, svg);
    el("circle", { cx: f.sx(t), cy: f.sy(Math.sin(t)), r: 4, style: "fill:var(--vec-v)" }, svg);
    el("circle", { cx: f.sx(t), cy: f.sy(Math.cos(t)), r: 4, style: "fill:var(--vec-u)" }, svg);
    text(svg, 330, 34, "sin θ (solid) · cos θ (dashed)");
    const z = [Math.cos(t), Math.sin(t)];
    o.z.textContent = cstr(z, 3);
    o.cos.textContent = n2(z[0], 4);
    o.sin.textContent = n2(z[1], 4);
    o.mod.textContent = n2(abs(z), 6);
  }

  const setPlaying = (p) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Play";
    cancelAnimationFrame(raf);
    raf = 0;
    if (p) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    theta = (theta + dt) % (4 * Math.PI);
    s.theta.set(theta, false);
    draw();
    raf = requestAnimationFrame(loop);
  };
  btn.addEventListener("click", () => setPlaying(!raf));
  root.querySelector("[data-action=pi]").addEventListener("click", () => { setPlaying(false); theta = Math.PI; s.theta.set(theta, false); draw(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && raf) setPlaying(false); }).observe(root);
  draw();
}

// ============================================================ roots

for (const root of document.querySelectorAll("[data-cx-roots]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const list = root.querySelector("[data-list]");
  const input = root.querySelector("[data-coeffs]");
  const s = scrubAll(root, () => (mode === "nth" ? drawNth() : resetPoly()));
  let mode = "nth", coeffs = [], guesses = [], trails = [], iter = 0, timer = 0, error = "";

  root.addEventListener("seg-change", (e) => {
    mode = e.detail.value;
    root.querySelectorAll("[data-mode]").forEach((d) => (d.hidden = d.dataset.mode !== mode));
    clearInterval(timer);
    mode === "nth" ? drawNth() : resetPoly();
  });

  function view(radius) {
    const L = Math.max(1.5, Math.min(12, radius * 1.25));
    svg.setAttribute("viewBox", `${-L} ${-L} ${2 * L} ${2 * L}`);
    svg.replaceChildren();
    const g = el("g", {}, svg);
    const step = L > 6 ? 2 : L > 3 ? 1 : 0.5;
    grid(g, -L, L, step);
    return { g, L };
  }

  function showList(roots) {
    list.replaceChildren(...roots.map((r, k) => {
      const li = document.createElement("li");
      li.textContent = `z${String(k + 1).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d])} = ${cstr(r, 4)}`;
      return li;
    }));
  }

  function drawNth() {
    const n = Math.round(s.n.get()), c = [s.cre.get(), s.cim.get()];
    const rc = abs(c);
    const rr = Math.pow(rc, 1 / n), phi = arg(c);
    const roots = Array.from({ length: n }, (_, k) => polar(rr, (phi + 2 * Math.PI * k) / n));
    const { g, L } = view(Math.max(rr, rc, 1));
    const sz = L / 12;
    el("circle", { cx: 0, cy: 0, r: rr, style: "fill:none;stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4", "vector-effect": "non-scaling-stroke" }, g);
    if (rc > 1e-12) polygon(g, roots, "fill:var(--brand);fill-opacity:0.08;stroke:var(--brand);stroke-width:1.5px");
    roots.forEach((r, k) => { dot(g, r, sz * 0.32, "fill:var(--brand)"); label(g, add(r, [sz * 0.4, sz * 0.4]), `z${k + 1}`, "fill:var(--brand)", sz * 0.9); });
    dot(g, c, sz * 0.3, "fill:var(--vec-u)");
    label(g, add(c, [sz * 0.4, -sz * 1.1]), "c", "fill:var(--vec-u)", sz);
    showList(rc < 1e-12 ? [[0, 0]] : roots);
    o.count.textContent = rc < 1e-12 ? `${n} (all at 0)` : `${n}, on a circle of radius |c|^(1/${n}) = ${n2(rr, 4)}`;
    o.iter.textContent = "— (exact formula)";
    const res = Math.max(...roots.map((r) => abs(sub(powc(r, n), c))));
    o.res.textContent = res.toExponential(1);
  }
  const powc = (z, n) => { let p = [1, 0]; for (let i = 0; i < n; i++) p = mul(p, z); return p; };

  // p(z) by Horner, coefficients highest first.
  const evalp = (cs, z) => cs.reduce((acc, a) => add(mul(acc, z), [a, 0]), [0, 0]);

  function resetPoly() {
    clearInterval(timer);
    error = "";
    const raw = input.value.split(/[,\s]+/).filter(Boolean).map((t) => Number(t.replace("−", "-")));
    let cs = raw;
    while (cs.length && cs[0] === 0) cs = cs.slice(1);
    if (raw.some((v) => !Number.isFinite(v))) error = "Use numbers separated by commas, e.g. 1, 0, -2, 2";
    else if (cs.length < 2) error = "Give at least a degree-1 polynomial";
    else if (cs.length > 11) error = "Degree 10 at most";
    coeffs = error ? [] : cs.map((a) => a / cs[0]); // monic
    const n = coeffs.length - 1;
    guesses = Array.from({ length: Math.max(0, n) }, (_, k) => powc([0.4, 0.9], k));
    trails = guesses.map((g) => [g]);
    iter = 0;
    drawPoly();
  }

  function stepPoly() {
    if (!guesses.length) return 0;
    let moved = 0;
    const next = guesses.map((zi, i) => {
      let den = [1, 0];
      guesses.forEach((zj, j) => { if (j !== i) den = mul(den, sub(zi, zj)); });
      const d = div(evalp(coeffs, zi), den);
      moved = Math.max(moved, abs(d));
      return sub(zi, d);
    });
    guesses = next;
    guesses.forEach((g, i) => trails[i].push(g));
    iter++;
    return moved;
  }

  function drawPoly() {
    const bound = coeffs.length ? 1 + Math.max(...coeffs.slice(1).map(Math.abs)) : 2; // Cauchy's bound
    const { g, L } = view(Math.min(bound, 6));
    const sz = L / 12;
    el("circle", { cx: 0, cy: 0, r: bound, style: "fill:none;stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:2 4", "vector-effect": "non-scaling-stroke" }, g);
    trails.forEach((t) => {
      if (t.length > 1) el("path", { d: "M" + t.map((p) => P(p).join(",")).join(" L"), style: "fill:none;stroke:var(--brand);stroke-opacity:0.35;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, g);
    });
    guesses.forEach((z, k) => { dot(g, z, sz * 0.32, "fill:var(--brand)"); label(g, add(z, [sz * 0.4, sz * 0.4]), `z${k + 1}`, "fill:var(--brand)", sz * 0.9); });
    if (error) { list.replaceChildren(); o.count.textContent = error; o.iter.textContent = "—"; o.res.textContent = "—"; return; }
    showList(guesses);
    o.count.textContent = `${coeffs.length - 1} (degree); dashed: Cauchy's bound`;
    o.iter.textContent = String(iter);
    o.res.textContent = Math.max(...guesses.map((z) => abs(evalp(coeffs, z)))).toExponential(1);
  }

  root.querySelector("[data-action=step]").addEventListener("click", () => { clearInterval(timer); stepPoly(); drawPoly(); });
  root.querySelector("[data-action=solve]").addEventListener("click", () => {
    clearInterval(timer);
    const run = () => { const m = stepPoly(); drawPoly(); return m < 1e-13 || iter > 500; };
    if (reduced()) { while (!run()); return; }
    timer = setInterval(() => { if (run()) clearInterval(timer); }, 60);
  });
  input.addEventListener("change", resetPoly);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") resetPoly(); });
  drawNth();
}

// ============================================================ domain colouring

const FUNCS = {
  sq: (z) => mul(z, z),
  inv: (z) => div([1, 0], z),
  rat: (z) => { const z2 = mul(z, z); return div(sub(z2, [1, 0]), add(z2, [1, 0])); },
  exp: cexp,
  sin: csin,
  cube: (z) => sub(mul(mul(z, z), z), [1, 0]),
};

function hsv(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
}

for (const root of document.querySelectorAll("[data-cx-domain]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let fn = "sq", cx = 0, cy = 0, half = 2.5;

  function render() {
    const rect = canvas.getBoundingClientRect();
    const W = Math.min(720, Math.round(rect.width * Math.min(2, devicePixelRatio || 1)));
    if (!W) return;
    canvas.width = canvas.height = W;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, W);
    const f = FUNCS[fn];
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        const z = [cx - half + (2 * half * (i + 0.5)) / W, cy + half - (2 * half * (j + 0.5)) / W];
        const w = f(z);
        const m = abs(w);
        let rgb;
        if (!Number.isFinite(m) || m > 1e12) rgb = [1, 1, 1];
        else {
          const hue = (arg(w) / (2 * Math.PI) + 1) % 1;
          const l = Math.log2(m || 1e-300);
          const frac = l - Math.floor(l);
          rgb = hsv(hue, 0.72, 0.6 + 0.36 * frac);
        }
        const k = (j * W + i) * 4;
        img.data[k] = rgb[0] * 255; img.data[k + 1] = rgb[1] * 255; img.data[k + 2] = rgb[2] * 255; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Axes.
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = Math.max(1, W / 400);
    const X = ((0 - (cx - half)) / (2 * half)) * W, Y = ((cy + half - 0) / (2 * half)) * W;
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, W); ctx.moveTo(0, Y); ctx.lineTo(W, Y); ctx.stroke();
    o.view.textContent = `centre ${cstr([cx, cy])}, half-width ${n2(half, 3)}`;
  }

  const toZ = (e) => {
    const r = canvas.getBoundingClientRect();
    return [cx - half + (2 * half * (e.clientX - r.left)) / r.width, cy + half - (2 * half * (e.clientY - r.top)) / r.height];
  };
  canvas.addEventListener("pointermove", (e) => {
    const z = toZ(e), w = FUNCS[fn](z);
    o.z.textContent = cstr(z, 3);
    o.fz.textContent = cstr(w, 3);
    o.polar.textContent = Number.isFinite(abs(w)) ? `${n2(abs(w), 3)}, ${deg(arg(w))}` : "pole";
  });
  canvas.addEventListener("click", (e) => { [cx, cy] = toZ(e); render(); });
  root.addEventListener("seg-change", (e) => { fn = e.detail.value; render(); });
  root.querySelector("[data-action=zoom-in]").addEventListener("click", () => { half /= 2; render(); });
  root.querySelector("[data-action=zoom-out]").addEventListener("click", () => { half = Math.min(64, half * 2); render(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { cx = cy = 0; half = 2.5; render(); });
  new ResizeObserver(render).observe(canvas);
}

// ============================================================ conformal maps

for (const root of document.querySelectorAll("[data-cx-conformal]")) {
  const from = root.querySelector("[data-from]"), to = root.querySelector("[data-to]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let map = "sq";
  root.addEventListener("seg-change", (e) => {
    map = e.detail.value;
    root.querySelectorAll("[data-params]").forEach((d) => (d.hidden = d.dataset.params !== map));
    draw();
  });

  const curve = (parent, pts, style) => {
    const segs = [];
    let cur = [];
    for (const p of pts) {
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 50 || Math.abs(p[1]) > 50) { if (cur.length > 1) segs.push(cur); cur = []; continue; }
      cur.push(p);
    }
    if (cur.length > 1) segs.push(cur);
    for (const sg of segs) el("path", { d: "M" + sg.map((p) => P(p).join(",")).join(" L"), style: "fill:none;" + style, "vector-effect": "non-scaling-stroke" }, parent);
  };

  function draw() {
    const a = [s.are.get(), s.aim.get()];
    const c = [s.jre.get(), s.jim.get()];
    const F = {
      sq: (z) => mul(z, z),
      exp: cexp,
      mobius: (z) => div(sub(z, a), sub([1, 0], mul([a[0], -a[1]], z))),
      joukowski: (z) => add(z, div([1, 0], z)),
    }[map];
    // The curves to map: a family of "horizontal" and "vertical" lines in the domain.
    const fam = [];
    let fromView = "-2.5 -2.5 5 5", toView = "-3 -3 6 6";
    const sample = (g, t0, t1, n = 160) => Array.from({ length: n + 1 }, (_, i) => g(t0 + ((t1 - t0) * i) / n));
    if (map === "sq") {
      for (let k = -1.2; k <= 1.2001; k += 0.2) {
        fam.push({ pts: sample((t) => [t, k], -1.2, 1.2), kind: "h" });
        fam.push({ pts: sample((t) => [k, t], -1.2, 1.2), kind: "v" });
      }
      fromView = "-1.6 -1.6 3.2 3.2";
    } else if (map === "exp") {
      for (let k = -Math.PI; k <= Math.PI + 1e-9; k += Math.PI / 8) fam.push({ pts: sample((t) => [t, k], -2, 1), kind: "h" });
      for (let k = -2; k <= 1.0001; k += 0.25) fam.push({ pts: sample((t) => [k, t], -Math.PI, Math.PI), kind: "v" });
      fromView = "-3.6 -3.6 7.2 7.2";
    } else if (map === "mobius") {
      for (let r = 0.2; r <= 1.0001; r += 0.2) fam.push({ pts: sample((t) => polar(r, t), 0, 2 * Math.PI, 200), kind: "h" });
      for (let k = 0; k < 12; k++) fam.push({ pts: sample((t) => polar(t, (k * Math.PI) / 6), 0, 1), kind: "v" });
      fromView = toView = "-1.3 -1.3 2.6 2.6";
    } else {
      const R = abs(sub([1, 0], c));
      for (let k = 0.6; k <= 2.0001; k += 0.2) fam.push({ pts: sample((t) => add(c, polar(R * k, t)), 0, 2 * Math.PI, 240), kind: Math.abs(k - 1) < 1e-9 ? "wing" : "h" });
      for (let k = 0; k < 16; k++) fam.push({ pts: sample((t) => add(c, polar(R * t, (k * Math.PI) / 8)), 0.6, 2), kind: "v" });
      fromView = "-2.8 -2.8 5.6 5.6";
      toView = "-3.2 -3.2 6.4 6.4";
    }
    from.setAttribute("viewBox", fromView);
    to.setAttribute("viewBox", toView);
    for (const [svg, vb] of [[from, fromView], [to, toView]]) {
      svg.replaceChildren();
      const [x0, , wv] = vb.split(" ").map(Number);
      line(svg, [x0, 0], [x0 + wv, 0], "stroke:currentColor;stroke-opacity:0.3;stroke-width:1px");
      line(svg, [0, x0], [0, x0 + wv], "stroke:currentColor;stroke-opacity:0.3;stroke-width:1px");
    }
    const style = (k) => k === "wing" ? "stroke:var(--brand);stroke-width:2.5px" : k === "h" ? "stroke:var(--vec-u);stroke-opacity:0.8;stroke-width:1.1px" : "stroke:var(--vec-v);stroke-opacity:0.8;stroke-width:1.1px";
    for (const f of fam) {
      curve(from, f.pts, style(f.kind));
      curve(to, f.pts.map(F), style(f.kind));
    }
    if (map === "mobius") {
      for (const svg of [from, to]) el("circle", { cx: 0, cy: 0, r: 1, style: "fill:none;stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5px", "vector-effect": "non-scaling-stroke" }, svg);
      dot(from, a, 0.04, "fill:var(--brand)");
      dot(to, [0, 0], 0.04, "fill:var(--brand)");
    }
    if (map === "joukowski") for (const p of [[1, 0], [-1, 0]]) dot(from, p, 0.06, "fill:currentColor");
    o.map.textContent = { sq: "w = z²", exp: "w = eᶻ (strip of height 2π onto the plane)", mobius: `w = (z − a)/(1 − āz), a = ${cstr(a)}: sends a to 0`, joukowski: "w = z + 1/z (circle through 1 → wing with a sharp trailing edge)" }[map];
    o.crit.textContent = { sq: "z = 0 (angles double there)", exp: "nowhere", mobius: "nowhere", joukowski: "z = ±1 (the sharp trailing edge)" }[map];
  }
  draw();
}

// ============================================================ contour integrals

const CONTOUR = {
  inv: { f: (z) => div([1, 0], z), poles: [{ at: [0, 0], res: [1, 0] }] },
  two: { f: (z) => div([1, 0], add(mul(z, z), [1, 0])), poles: [{ at: [0, 1], res: [0, -0.5] }, { at: [0, -1], res: [0, 0.5] }] },
  expz: { f: (z) => div(cexp(z), z), poles: [{ at: [0, 0], res: [1, 0] }] },
  double: { f: (z) => div([1, 0], mul(z, z)), poles: [{ at: [0, 0], res: [0, 0], order: 2 }] },
  entire: { f: (z) => mul(z, z), poles: [] },
};

for (const root of document.querySelectorAll("[data-cx-contour]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let fn = "inv", c = [0.6, 0.4];
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  const hc = handle(svg, top, "Centre of the circle", (p) => { c = snap(p, 2.8); draw(); });
  keyNudge(hc.node, () => c, (p) => { c = snap(p, 2.8); draw(); });
  root.addEventListener("seg-change", (e) => { fn = e.detail.value; draw(); });

  function draw() {
    const r = s.r.get();
    const F = CONTOUR[fn];
    scene.replaceChildren();
    grid(scene, -3, 3);
    // The contour, counter-clockwise, with direction arrows.
    const pts = Array.from({ length: 181 }, (_, i) => add(c, polar(r, (2 * Math.PI * i) / 180)));
    el("path", { d: "M" + pts.map((p) => P(p).join(",")).join(" L"), style: "fill:var(--brand);fill-opacity:0.05;stroke:var(--brand);stroke-width:2px", "vector-effect": "non-scaling-stroke" }, scene);
    for (const t of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
      const p = add(c, polar(r, t)), d = polar(0.22, t + Math.PI / 2);
      arrow(scene, sub(p, [d[0] * 0.5, d[1] * 0.5]), add(p, [d[0] * 0.5, d[1] * 0.5]), "var(--brand)", 2, 0.2);
    }
    // Numeric integral: trapezoid on z(t) = c + r e^{it}, dz = i r e^{it} dt.
    const N = 2000;
    let sum = [0, 0], onPole = false;
    for (const p of F.poles) if (Math.abs(abs(sub(p.at, c)) - r) < 1e-3) onPole = true;
    for (let k = 0; k < N; k++) {
      const t = (2 * Math.PI * k) / N;
      const e = polar(1, t);
      const z = add(c, [r * e[0], r * e[1]]);
      const dz = mul([0, r], e);
      sum = add(sum, mul(F.f(z), dz));
    }
    sum = [(sum[0] * 2 * Math.PI) / N, (sum[1] * 2 * Math.PI) / N];
    // Exact: 2πi times the residues inside.
    let res = [0, 0];
    const inside = [];
    for (const p of F.poles) {
      const isIn = abs(sub(p.at, c)) < r;
      if (isIn) { res = add(res, p.res); inside.push(p); }
      const sz = 0.13;
      const st = isIn ? "stroke:var(--code-del);stroke-width:2.5px" : "stroke:currentColor;stroke-opacity:0.5;stroke-width:2px";
      line(scene, add(p.at, [-sz, -sz]), add(p.at, [sz, sz]), st);
      line(scene, add(p.at, [-sz, sz]), add(p.at, [sz, -sz]), st);
      label(scene, add(p.at, [-0.1, -0.42]), p.order === 2 ? "double pole, Res 0" : `Res ${cstr(p.res, 2)}`, isIn ? "fill:var(--code-del)" : "fill:var(--muted-foreground)", 0.17);
    }
    const exact = mul([0, 2 * Math.PI], res);
    hc.place(c, "var(--brand)");
    o.num.textContent = onPole ? "the contour passes through a pole" : cstr(sum, 6);
    o.exact.textContent = cstr(exact, 6);
    o.inside.textContent = inside.length ? inside.map((p) => cstr(p.at, 0)).join(", ") + " (winding number 1)" : "none (winding number 0 for every pole)";
    o.err.textContent = onPole ? "—" : abs(sub(sum, exact)).toExponential(1);
  }
  draw();
}

// ============================================================ Riemann sphere

for (const root of document.querySelectorAll("[data-cx-sphere]")) {
  const sv = root.querySelector("[data-sphere]");
  const plane = root.querySelector("[data-plane]");
  const o = outs(root);
  let z = [1.2, 0.8], yaw = -0.6, pitch = 0.45;
  const show = { grid: true, ray: true };
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { show[sw.dataset.toggle] = e.detail.checked; draw(); }));

  const toSphere = ([x, y]) => { const m = x * x + y * y; return [(2 * x) / (1 + m), (2 * y) / (1 + m), (m - 1) / (m + 1)]; };
  // Orthographic view: turn about Z (yaw), tilt about X (pitch). Screen y is up = Z.
  const proj = ([X, Y, Z]) => {
    const x1 = X * Math.cos(yaw) - Y * Math.sin(yaw), y1 = X * Math.sin(yaw) + Y * Math.cos(yaw);
    const y2 = y1 * Math.cos(pitch) - Z * Math.sin(pitch), z2 = y1 * Math.sin(pitch) + Z * Math.cos(pitch);
    return { p: [x1, z2], depth: -y2 }; // depth > 0: facing the viewer
  };
  // A 3D polyline, front parts solid and back parts dashed.
  function curve3(parent, pts3, style) {
    let run = [], front = null;
    const flush = () => {
      if (run.length > 1) el("path", { d: "M" + run.map((q) => P(q).join(",")).join(" L"), style: "fill:none;" + style + (front ? "" : ";stroke-dasharray:2 3;stroke-opacity:0.35"), "vector-effect": "non-scaling-stroke" }, parent);
    };
    for (const q of pts3) {
      const { p, depth } = proj(q);
      const f = depth >= 0;
      if (front !== null && f !== front) { run.push(p); flush(); run = [p]; front = f; continue; }
      front = f;
      run.push(p);
    }
    flush();
  }

  const circleAtZ = (Z, n = 120) => { const rr = Math.sqrt(Math.max(0, 1 - Z * Z)); return Array.from({ length: n + 1 }, (_, i) => [rr * Math.cos((2 * Math.PI * i) / n), rr * Math.sin((2 * Math.PI * i) / n), Z]); };
  const meridian = (a, n = 80) => Array.from({ length: n + 1 }, (_, i) => { const t = -Math.PI / 2 + (Math.PI * i) / n; return [Math.cos(t) * Math.cos(a), Math.cos(t) * Math.sin(a), Math.sin(t)]; });

  function draw() {
    sv.replaceChildren();
    el("circle", { cx: 0, cy: 0, r: 1, style: "fill:var(--background);fill-opacity:0.6;stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5px", "vector-effect": "non-scaling-stroke" }, sv);
    // The equatorial plane as a square, under the sphere.
    curve3(sv, [[-1.45, -1.45, 0], [1.45, -1.45, 0], [1.45, 1.45, 0], [-1.45, 1.45, 0], [-1.45, -1.45, 0]], "stroke:currentColor;stroke-opacity:0.25;stroke-width:1px");
    for (let a = 0; a < Math.PI; a += Math.PI / 6) curve3(sv, meridian(a).concat(meridian(a + Math.PI).reverse()), "stroke:currentColor;stroke-opacity:0.15;stroke-width:1px");
    curve3(sv, circleAtZ(0), "stroke:var(--vec-u);stroke-width:1.75px");
    if (show.grid) for (const r of [0.5, 2]) curve3(sv, circleAtZ((r * r - 1) / (r * r + 1)), "stroke:var(--vec-v);stroke-opacity:0.8;stroke-width:1.25px");
    const S = toSphere(z);
    const N = [0, 0, 1];
    if (show.ray) {
      const far = [z[0], z[1], 0];
      curve3(sv, [N, S], "stroke:var(--brand);stroke-width:1.5px");
      curve3(sv, [S, far], "stroke:var(--brand);stroke-opacity:0.5;stroke-width:1.25px");
      const pf = proj(far).p;
      el("circle", { cx: pf[0], cy: -pf[1], r: 0.035, style: "fill:var(--brand);fill-opacity:0.6" }, sv);
    }
    for (const [pt, txt] of [[N, "∞"], [[0, 0, -1], "0"]]) {
      const { p, depth } = proj(pt);
      el("circle", { cx: p[0], cy: -p[1], r: 0.04, style: `fill:currentColor;opacity:${depth >= 0 ? 1 : 0.4}` }, sv);
      label(sv, [p[0] + 0.06, p[1] + 0.06], txt, "fill:currentColor", 0.14);
    }
    const ps = proj(S);
    el("circle", { cx: ps.p[0], cy: -ps.p[1], r: 0.06, style: `fill:var(--brand);stroke:var(--background);stroke-width:1.5px;opacity:${ps.depth >= 0 ? 1 : 0.5}`, "vector-effect": "non-scaling-stroke" }, sv);

    // The plane panel.
    planeScene.replaceChildren();
    grid(planeScene, -4, 4);
    el("circle", { cx: 0, cy: 0, r: 1, style: "fill:none;stroke:var(--vec-u);stroke-width:1.75px", "vector-effect": "non-scaling-stroke" }, planeScene);
    if (show.grid) for (const r of [0.5, 2]) el("circle", { cx: 0, cy: 0, r, style: "fill:none;stroke:var(--vec-v);stroke-opacity:0.8;stroke-width:1.25px", "vector-effect": "non-scaling-stroke" }, planeScene);
    hz.place(z, "var(--brand)");
    o.z.textContent = cstr(z);
    o.xyz.textContent = `(${S.map((v) => n2(v, 3)).join(", ")})`;
    o.mod.textContent = `${n2(abs(z), 3)} → ${abs(z) < 1 ? "southern" : abs(z) > 1 ? "northern" : "on the equator"}`;
  }

  const planeScene = el("g", {}, plane), planeTop = el("g", {}, plane);
  const hz = handle(plane, planeTop, "z", (p) => { z = snap(p, 3.9); draw(); });
  keyNudge(hz.node, () => z, (p) => { z = snap(p, 3.9); draw(); });

  // Drag the sphere to turn it.
  let drag = null;
  sv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; sv.setPointerCapture(e.pointerId); });
  sv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * 0.01));
    draw();
  });
  sv.addEventListener("pointerup", () => (drag = null));
  draw();
}
