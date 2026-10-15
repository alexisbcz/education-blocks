// Machine learning blocks that fit things: least squares, polynomial
// overfitting, activation functions, k-means. Every value drawn is
// computed here from the model's own equations.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const minus = (s) => String(s).replace("-", "−");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal by Box–Muller.
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// The SVG point (viewBox units) under a pointer event.
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Inverse of a frame's scales: viewBox units back to data units.
const invert = (f, opts, p) => [
  opts.x[0] + ((p.x - f.L) / f.W) * (opts.x[1] - opts.x[0]),
  opts.y[0] + ((f.T + f.H - p.y) / f.H) * (opts.y[1] - opts.y[0]),
];

// ============================================================ Least squares

for (const root of document.querySelectorAll("[data-reg]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const show = { residuals: true, squares: true };
  const opts = { box: [40, 14, 500, 312], x: [0, 10], y: [0, 10], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 2, 4, 6, 8, 10], xlabel: "x", ylabel: "y" };

  const seeded = () => {
    const rng = mulberry32(42);
    return Array.from({ length: 10 }, (_, i) => {
      const x = 0.6 + i * 0.95 + (rng() - 0.5) * 0.6;
      return [x, Math.min(9.8, Math.max(0.2, 0.8 * x + 1 + gauss(rng) * 0.9))];
    });
  };
  let pts = seeded();

  function fit() {
    const n = pts.length;
    if (n < 2) return null;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n;
    const my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    if (sxx < 1e-12) return null;
    const b = sxy / sxx, a = my - b * mx;
    const sse = pts.reduce((s, [x, y]) => s + (y - (a + b * x)) ** 2, 0);
    return { a, b, mse: sse / n, r2: syy > 0 ? 1 - sse / syy : 1 };
  }

  let f;
  function draw() {
    svg.replaceChildren();
    f = frame(svg, opts);
    const m = fit();
    if (m) {
      const k = f.H / 10; // px per y unit: squares use it on both sides
      for (const [x, y] of pts) {
        const yh = m.a + m.b * x, r = y - yh;
        if (show.squares && Math.abs(r) > 1e-9) {
          const side = Math.abs(r) * k;
          const left = f.sx(x) + side > f.L + f.W ? f.sx(x) - side : f.sx(x);
          el("rect", { x: left, y: Math.min(f.sy(y), f.sy(yh)), width: side, height: side, style: "fill:var(--code-del);fill-opacity:0.12;stroke:var(--code-del);stroke-opacity:0.45;stroke-width:1" }, svg);
        }
        if (show.residuals) el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.sy(y), y2: f.sy(yh), style: "stroke:var(--code-del);stroke-width:1.25" }, svg);
      }
      // The fitted line, clipped to the plot box.
      const clip = (x) => Math.min(10, Math.max(0, x));
      let x0 = 0, x1 = 10;
      if (Math.abs(m.b) > 1e-9) {
        const xa = clip((0 - m.a) / m.b), xb = clip((10 - m.a) / m.b);
        x0 = Math.max(0, Math.min(xa, xb)); x1 = Math.min(10, Math.max(xa, xb));
      }
      polyline(svg, [[f.sx(x0), f.sy(m.a + m.b * x0)], [f.sx(x1), f.sy(m.a + m.b * x1)]], "stroke:var(--foreground);stroke-width:2");
      o.eq.textContent = `ŷ = ${num(m.b, 2)}x ${m.a < 0 ? "−" : "+"} ${num(Math.abs(m.a), 2)}`;
      o.mse.textContent = num(m.mse, 3);
      o.r2.textContent = num(m.r2, 3);
    } else {
      o.eq.textContent = o.mse.textContent = o.r2.textContent = "—";
    }
    for (const [x, y] of pts) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    o.n.textContent = String(pts.length);
  }

  svg.addEventListener("click", (e) => {
    const [x, y] = invert(f, opts, svgPoint(svg, e));
    if (x < 0 || x > 10 || y < 0 || y > 10) return;
    if (e.shiftKey) {
      let best = -1, bd = 0.6;
      pts.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) pts.splice(best, 1);
    } else {
      pts.push([x, y]);
    }
    draw();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { pts = seeded(); draw(); });
  onToggle(root, (k, on) => { show[k] = on; draw(); });
  draw();
}

// ============================================================ Overfitting

// Solves A x = b in place by Gaussian elimination with partial pivoting.
function solve(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c] / A[c][c];
      for (let j = c; j < n; j++) A[r][j] -= k * A[c][j];
      b[r] -= k * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j];
    x[r] = s / A[r][r];
  }
  return x;
}

// Least-squares polynomial of degree d on t = 2x − 1, by the normal
// equations with a tiny ridge for conditioning.
function polyfit(data, d) {
  const n = d + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (const [x, y] of data) {
    const t = 2 * x - 1;
    const pw = [1];
    for (let i = 1; i < n; i++) pw.push(pw[i - 1] * t);
    for (let i = 0; i < n; i++) {
      b[i] += pw[i] * y;
      for (let j = 0; j < n; j++) A[i][j] += pw[i] * pw[j];
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += 1e-9;
  const c = solve(A, b);
  return (x) => { const t = 2 * x - 1; let s = 0; for (let i = n - 1; i >= 0; i--) s = s * t + c[i]; return s; };
}

const truth = (x) => Math.sin(2 * Math.PI * x);

for (const root of document.querySelectorAll("[data-poly]")) {
  const svgFit = root.querySelector("[data-fit]");
  const svgErr = root.querySelector("[data-err]");
  const o = outs(root);
  let seed = 3, train, test, errors;
  const s = scrubAll(root, draw);

  function sample() {
    const rng = mulberry32(seed);
    const pts = (n) => Array.from({ length: n }, () => { const x = rng(); return [x, truth(x) + 0.25 * gauss(rng)]; });
    train = pts(12);
    test = pts(200);
    const mse = (p, data) => data.reduce((a, [x, y]) => a + (p(x) - y) ** 2, 0) / data.length;
    errors = Array.from({ length: 12 }, (_, d) => { const p = polyfit(train, d); return { train: mse(p, train), test: mse(p, test) }; });
  }

  function draw() {
    const d = Math.round(s.degree.get());
    const p = polyfit(train, d);

    svgFit.replaceChildren();
    const f = frame(svgFit, { box: [36, 12, 352, 254], x: [0, 1], y: [-1.6, 1.6], xticks: [0, 0.5, 1], yticks: [-1, 0, 1], yfmt: minus, xlabel: "x" });
    const id = `poly-clip-${seed}`;
    el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, el("defs", {}, svgFit)));
    const g = el("g", { "clip-path": `url(#${id})` }, svgFit);
    const xs = Array.from({ length: 241 }, (_, i) => i / 240);
    polyline(g, xs.map((x) => [f.sx(x), f.sy(truth(x))]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(g, xs.map((x) => [f.sx(x), f.sy(Math.max(-5, Math.min(5, p(x))))]), "stroke:var(--foreground);stroke-width:2");
    for (const [x, y] of train) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svgFit);

    // Errors on a log scale, clamped to [1e-4, 10].
    svgErr.replaceChildren();
    const lg = (v) => Math.log10(Math.min(10, Math.max(1e-4, v)));
    const e = frame(svgErr, { box: [36, 12, 212, 254], x: [0, 11], y: [-4, 1], xticks: [0, 3, 6, 9], yticks: [-4, -3, -2, -1, 0, 1], yfmt: (v) => (v === 0 ? "1" : `1e${minus(v)}`), xlabel: "degree", ylabel: "MSE" });
    polyline(svgErr, errors.map((r, i) => [e.sx(i), e.sy(lg(r.train))]), "stroke:var(--foreground);stroke-width:1.5");
    polyline(svgErr, errors.map((r, i) => [e.sx(i), e.sy(lg(r.test))]), "stroke:var(--brand);stroke-width:1.75");
    el("line", { x1: e.sx(d), x2: e.sx(d), y1: e.T, y2: e.T + e.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3" }, svgErr);
    for (const [k, c] of [["train", "var(--foreground)"], ["test", "var(--brand)"]])
      el("circle", { cx: e.sx(d), cy: e.sy(lg(errors[d][k])), r: 3.5, style: `fill:var(--background);stroke:${c};stroke-width:1.75` }, svgErr);

    const best = errors.reduce((b, r, i) => (r.test < errors[b].test ? i : b), 0);
    o.train.textContent = num(errors[d].train, 3);
    o.test.textContent = num(errors[d].test, 3);
    // Close to the best test error is a good fit; otherwise the side of the
    // valley says which way it fails.
    const near = errors[d].test <= 1.5 * errors[best].test;
    o.verdict.textContent = near ? "good fit" : d < best ? "underfitting" : "overfitting";
  }

  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; sample(); draw(); });
  sample();
  draw();
}

// ============================================================ Activations

// erf by Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
function erf(x) {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const sig = (x) => 1 / (1 + Math.exp(-x));
const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

const ACTS = {
  relu: { name: "ReLU", color: "var(--foreground)", f: (x) => Math.max(0, x), d: (x) => (x > 0 ? 1 : 0) },
  leaky: { name: "Leaky ReLU (α = 0.1)", color: "var(--ion-na)", f: (x) => (x > 0 ? x : 0.1 * x), d: (x) => (x > 0 ? 1 : 0.1) },
  sigmoid: { name: "Sigmoid", color: "var(--vec-u)", f: sig, d: (x) => sig(x) * (1 - sig(x)) },
  tanh: { name: "Tanh", color: "var(--ion-k)", f: Math.tanh, d: (x) => 1 - Math.tanh(x) ** 2 },
  gelu: { name: "GELU", color: "var(--brand)", f: (x) => x * Phi(x), d: (x) => Phi(x) + x * phi(x) },
  silu: { name: "SiLU", color: "var(--ion-cl)", f: (x) => x * sig(x), d: (x) => sig(x) * (1 + x * (1 - sig(x))) },
};

for (const root of document.querySelectorAll("[data-act]")) {
  const svg = root.querySelector("[data-plot]");
  const hover = root.querySelector("[data-out=hover]");
  const idle = hover.textContent;
  const buttons = [...root.querySelectorAll("[data-fn]")];
  let deriv = true, f, cursor;
  const opts = { box: [40, 12, 504, 300], x: [-4, 4], y: [-1.5, 4], xticks: [-4, -2, 0, 2, 4], yticks: [-1, 0, 1, 2, 3, 4], xfmt: minus, yfmt: minus };
  for (const s of root.querySelectorAll("[data-swatch]")) s.style.background = ACTS[s.dataset.swatch].color;
  const visible = () => buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.fn);

  function draw() {
    svg.replaceChildren();
    f = frame(svg, opts);
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.3");
    const clamp = (y) => Math.max(-1.6, Math.min(4.1, y));
    const xs = Array.from({ length: 321 }, (_, i) => -4 + i / 40);
    for (const k of visible()) {
      const a = ACTS[k];
      polyline(svg, xs.map((x) => [f.sx(x), f.sy(clamp(a.f(x)))]), `stroke:${a.color};stroke-width:2`);
      if (deriv) polyline(svg, xs.map((x) => [f.sx(x), f.sy(clamp(a.d(x)))]), `stroke:${a.color};stroke-width:1.25;stroke-dasharray:4 3;stroke-opacity:0.8`);
    }
    cursor = el("g", { style: "display:none" }, svg);
  }

  svg.addEventListener("pointermove", (e) => {
    const [x] = invert(f, opts, svgPoint(svg, e));
    if (x < -4 || x > 4) return;
    cursor.replaceChildren();
    cursor.style.display = "";
    el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, cursor);
    const rows = [`x = ${num(x, 2)}`];
    for (const k of visible()) {
      const a = ACTS[k], y = a.f(x);
      if (y >= -1.5 && y <= 4) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 3.5, style: `fill:var(--background);stroke:${a.color};stroke-width:1.75` }, cursor);
      rows.push(`${a.name}  ${num(y, 3)}   ′ ${num(a.d(x), 3)}`);
    }
    hover.replaceChildren(...rows.map((r, i) => { const d = document.createElement("div"); d.textContent = r; if (i === 0) d.className = "text-foreground"; return d; }));
  });
  svg.addEventListener("pointerleave", () => { if (cursor) cursor.style.display = "none"; hover.textContent = idle; });

  for (const b of buttons) b.addEventListener("click", () => { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); draw(); });
  onToggle(root, (k, on) => { if (k === "deriv") { deriv = on; draw(); } });
  draw();
}

// ============================================================ k-means

const PALETTE = ["var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)"];

for (const root of document.querySelectorAll("[data-kmeans]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const stepBtn = root.querySelector("[data-action=step]");
  const label = stepBtn.querySelector("[data-label]");
  const runBtn = root.querySelector("[data-action=run]");
  const opts = { box: [32, 12, 476, 320], x: [0, 10], y: [0, 7], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 2, 4, 6] };

  // Three blobs, one stretched along x.
  const rng = mulberry32(11);
  const blob = (n, cx, cy, sx, sy) => Array.from({ length: n }, () => [
    Math.min(9.9, Math.max(0.1, cx + sx * gauss(rng))), Math.min(6.9, Math.max(0.1, cy + sy * gauss(rng)))]);
  const points = [...blob(60, 2.5, 5.0, 0.6, 0.6), ...blob(60, 7.3, 5.3, 0.5, 0.5), ...blob(60, 5.4, 1.9, 1.4, 0.35)];

  let initSeed = 1, centroids, prev, assign, phase, iter, converged, timer = 0;
  const s = scrubAll(root, (k) => { if (k === "k") init(); });
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  function init() {
    clearTimeout(timer);
    timer = 0;
    const k = Math.round(s.k.get());
    const r = mulberry32(1000 + initSeed);
    const picks = new Set();
    while (picks.size < k) picks.add(Math.floor(r() * points.length));
    centroids = [...picks].map((i) => [...points[i]]);
    prev = null;
    assign = null;
    phase = "assign";
    iter = 0;
    converged = false;
    draw();
  }

  // One move. Returns false once an assignment changes nothing.
  function step() {
    if (converged) return false;
    if (phase === "assign") {
      const next = points.map((p) => centroids.reduce((b, c, i) => (d2(p, c) < d2(p, centroids[b]) ? i : b), 0));
      const changed = !assign || next.some((c, i) => c !== assign[i]);
      assign = next;
      prev = null;
      iter++;
      if (!changed) { converged = true; draw(); return false; }
      phase = "update";
    } else {
      prev = centroids.map((c) => [...c]);
      centroids = centroids.map((c, j) => {
        const mine = points.filter((_, i) => assign[i] === j);
        return mine.length ? [mine.reduce((a, p) => a + p[0], 0) / mine.length, mine.reduce((a, p) => a + p[1], 0) / mine.length] : c;
      });
      phase = "assign";
    }
    draw();
    return true;
  }

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, opts);
    points.forEach((p, i) => {
      const c = assign ? PALETTE[assign[i] % PALETTE.length] : "currentColor";
      el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 3, style: `fill:${c};fill-opacity:${assign ? 0.75 : 0.3}` }, svg);
    });
    centroids.forEach((c, j) => {
      const col = PALETTE[j % PALETTE.length], x = f.sx(c[0]), y = f.sy(c[1]);
      if (prev) el("line", { x1: f.sx(prev[j][0]), y1: f.sy(prev[j][1]), x2: x, y2: y, style: `stroke:${col};stroke-opacity:0.5;stroke-dasharray:3 3` }, svg);
      el("path", { d: `M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z`, style: "fill:var(--background);stroke:var(--background);stroke-width:4" }, svg);
      el("path", { d: `M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z`, style: `fill:${col};stroke:var(--foreground);stroke-width:1.25` }, svg);
    });
    o.iter.textContent = String(iter);
    o.phase.textContent = converged ? "converged" : phase;
    o.inertia.textContent = assign ? num(points.reduce((a, p, i) => a + d2(p, centroids[assign[i]]), 0), 1) : "—";
    label.textContent = phase === "assign" ? "Assign" : "Update";
    stepBtn.disabled = converged;
    runBtn.disabled = converged;
  }

  stepBtn.addEventListener("click", () => { clearTimeout(timer); timer = 0; step(); });
  runBtn.addEventListener("click", () => {
    clearTimeout(timer);
    if (reduced()) { while (step()); return; }
    const tick = () => { timer = step() ? setTimeout(tick, 350) : 0; };
    tick();
  });
  root.querySelector("[data-action=init]").addEventListener("click", () => { initSeed++; init(); });
  init();
}
