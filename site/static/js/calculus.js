// Calculus blocks: limits, derivatives, quadrature, the fundamental
// theorem, Taylor polynomials, Newton's method, Euler's method and series.
// Every curve is computed from the formula it shows.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const plot = (root, name = "main") => root.querySelector(`[data-plot="${name}"]`);
const minus = (s) => String(s).replace(/-/g, "−");
const fx = (v, d = 4) => (Number.isFinite(v) ? minus(Number(v.toFixed(d))) : "—");

// onSeg calls fn(groupLabel, value) when a segmented control changes.
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));

// A clip path to the plot box, so lines stop at the frame.
let clipN = 0;
function clipped(svg, f) {
  const id = `calc-clip-${++clipN}`;
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, el("defs", {}, svg)));
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

// Samples f over [a, b], breaking the line where f is not finite or the
// value jumps off-scale (poles).
function curve(g, f, fn, a, b, style, n = 400) {
  let pts = [];
  const flush = () => { if (pts.length > 1) polyline(g, pts, style); pts = []; };
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) { flush(); continue; }
    pts.push([f.sx(x), f.sy(y)]);
  }
  flush();
}

const ticks = (a, b, step) => {
  const out = [];
  for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
};

function playButton(btn) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
  };
}

// ============================================================ Limits

const LIMITS = {
  square: { f: (x) => x * x, a: 2, L: 4, hole: false, x: [0, 4], y: [-1, 13] },
  sinc: { f: (x) => (x === 0 ? NaN : Math.sin(x) / x), a: 0, L: 1, hole: true, x: [-8, 8], y: [-0.6, 1.8] },
  cubic: { f: (x) => (x === 1 ? NaN : (x ** 3 - 1) / (x - 1)), a: 1, L: 3, hole: true, x: [-1, 3], y: [-0.5, 13] },
};

for (const root of document.querySelectorAll("[data-calc-limit]")) {
  const svg = plot(root), o = outs(root);
  let F = LIMITS.square;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { F = LIMITS[v]; draw(); });

  // The widest δ: walk outward from a until some x leaves the ε-band.
  function widestDelta(eps) {
    const reach = Math.max(F.a - F.x[0], F.x[1] - F.a);
    const step = reach / 40000;
    for (let k = 1; k <= 40000; k++) {
      const d = k * step;
      for (const x of [F.a - d, F.a + d]) if (!(Math.abs(F.f(x) - F.L) < eps)) return { d: d - step, whole: false };
    }
    return { d: reach, whole: true };
  }

  function draw() {
    const eps = s.eps.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 290], x: F.x, y: F.y, xticks: ticks(F.x[0], F.x[1], (F.x[1] - F.x[0]) / 8), yticks: ticks(F.y[0], F.y[1], (F.y[1] - F.y[0]) > 4 ? 2 : 0.5), xfmt: minus, yfmt: minus });
    const g = clipped(svg, f);
    const { d, whole } = widestDelta(eps);
    el("rect", { x: f.L, y: f.sy(F.L + eps), width: f.W, height: f.sy(F.L - eps) - f.sy(F.L + eps), style: "fill:var(--brand);fill-opacity:0.12" }, g);
    el("rect", { x: f.sx(F.a - d), y: f.T, width: f.sx(F.a + d) - f.sx(F.a - d), height: f.H, style: "fill:var(--vec-u);fill-opacity:0.12" }, g);
    for (const y of [F.L - eps, F.L + eps]) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(y), y2: f.sy(y), style: "stroke:var(--brand);stroke-dasharray:4 4" }, g);
    for (const x of [F.a - d, F.a + d]) el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-dasharray:4 4" }, g);
    curve(g, f, F.f, F.x[0], F.x[1], "stroke:var(--foreground);stroke-opacity:0.45;stroke-width:1.5", 800);
    curve(g, f, F.f, F.a - d, F.a + d, "stroke:var(--foreground);stroke-width:2.5", 400);
    el("circle", { cx: f.sx(F.a), cy: f.sy(F.L), r: 4, style: F.hole ? "fill:var(--code-bg);stroke:var(--foreground);stroke-width:1.5" : "fill:var(--foreground)" }, svg);
    text(svg, f.sx(F.a + d) + 4, f.T + 12, "a + δ", { style: "fill:var(--vec-u)" });
    text(svg, f.L + 4, f.sy(F.L + eps) - 4, "L + ε", { style: "fill:var(--brand)" });
    o.L.textContent = fx(F.L);
    o.delta.textContent = whole ? `> ${fx(d, 2)} (whole view)` : fx(d, 4);
    o.fa.textContent = F.hole ? "undefined (hole)" : fx(F.f(F.a));
  }
  draw();
}

// ============================================================ Derivative

const DERIV = {
  cubic: { f: (x) => x ** 3 - 3 * x, d: (x) => 3 * x * x - 3, dd: (x) => 6 * x, x: [-2.5, 2.5], y: [-5, 5] },
  sin: { f: Math.sin, d: Math.cos, dd: (x) => -Math.sin(x), x: [-2.5, 2.5], y: [-1.6, 1.6] },
  exp: { f: Math.exp, d: Math.exp, dd: Math.exp, x: [-2, 2.5], y: [-0.5, 9] },
};

for (const root of document.querySelectorAll("[data-calc-deriv]")) {
  const svg = plot(root), o = outs(root);
  let F = DERIV.cubic;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { F = DERIV[v]; draw(); });
  root.querySelector("[data-action=shrink]").addEventListener("click", () => { s.h.set(Math.max(0.001, s.h.get() / 2), false); draw(); });

  function draw() {
    const a = s.a.get(), hh = s.h.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 290], x: F.x, y: F.y, xticks: ticks(F.x[0], F.x[1], 0.5), yticks: ticks(F.y[0], F.y[1], F.y[1] - F.y[0] > 6 ? 2 : 0.5), xfmt: minus, yfmt: minus });
    const g = clipped(svg, f);
    curve(g, f, F.f, F.x[0], F.x[1], "stroke:var(--foreground);stroke-width:2");
    const sec = (F.f(a + hh) - F.f(a)) / hh, tan = F.d(a);
    const lineThrough = (m, style) => el("line", { x1: f.sx(F.x[0]), y1: f.sy(F.f(a) + m * (F.x[0] - a)), x2: f.sx(F.x[1]), y2: f.sy(F.f(a) + m * (F.x[1] - a)), style }, g);
    lineThrough(tan, "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:6 4");
    lineThrough(sec, "stroke:var(--brand);stroke-width:1.75");
    el("line", { x1: f.sx(a + hh), x2: f.sx(a + hh), y1: f.sy(F.f(a)), y2: f.sy(F.f(a + hh)), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:2 3" }, g);
    el("line", { x1: f.sx(a), x2: f.sx(a + hh), y1: f.sy(F.f(a)), y2: f.sy(F.f(a)), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:2 3" }, g);
    for (const x of [a, a + hh]) el("circle", { cx: f.sx(x), cy: f.sy(F.f(x)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, g);
    text(svg, f.L + 6, f.T + 12, "secant", { style: "fill:var(--brand)" });
    text(svg, f.L + 6, f.T + 26, "tangent", { style: "fill:var(--vec-u)" });
    const err = sec - tan;
    o.secant.textContent = fx(sec, 6);
    o.exact.textContent = fx(tan, 6);
    o.err.textContent = Math.abs(err) < 1e-6 ? err.toExponential(2).replace("-", "−") : fx(err, 6);
    o.ratio.textContent = `${fx(err / hh, 4)}  (f″/2 = ${fx(F.dd(a) / 2, 4)})`;
  }
  draw();
}

// ============================================================ Riemann sums

const INTEGRALS = {
  sq: { f: (x) => x * x, a: 0, b: 2, exact: 8 / 3, y: [-0.3, 4.5] },
  sin: { f: Math.sin, a: 0, b: Math.PI, exact: 2, y: [-0.15, 1.2] },
  exp: { f: Math.exp, a: 0, b: 1, exact: Math.E - 1, y: [-0.15, 3] },
};

function quad(F, rule, n) {
  const h = (F.b - F.a) / n, x = (i) => F.a + i * h;
  let s = 0;
  if (rule === "left") for (let i = 0; i < n; i++) s += F.f(x(i));
  else if (rule === "right") for (let i = 1; i <= n; i++) s += F.f(x(i));
  else if (rule === "mid") for (let i = 0; i < n; i++) s += F.f(x(i + 0.5));
  else if (rule === "trap") { for (let i = 1; i < n; i++) s += F.f(x(i)); s += (F.f(x(0)) + F.f(x(n))) / 2; }
  else { // Simpson, n even
    for (let i = 1; i < n; i++) s += F.f(x(i)) * (i % 2 ? 4 : 2);
    return ((s + F.f(x(0)) + F.f(x(n))) * h) / 3;
  }
  return s * h;
}

for (const root of document.querySelectorAll("[data-calc-riemann]")) {
  const svg = plot(root), errSvg = plot(root, "err"), o = outs(root);
  let F = INTEGRALS.sq, rule = "left";
  const s = scrubAll(root, draw);
  onSeg(root, (group, v) => { if (group === "Rule") rule = v; else F = INTEGRALS[v]; draw(); });
  const RULES = ["left", "right", "mid", "trap", "simpson"];

  function draw() {
    const n = Math.max(2, Math.round(s.n.get() / 2) * 2);
    svg.replaceChildren();
    const pad = (F.b - F.a) * 0.08;
    const f = frame(svg, { box: [44, 12, 500, 254], x: [F.a - pad, F.b + pad], y: F.y, xticks: ticks(F.a, F.b, (F.b - F.a) / 4).map((t) => Math.round(t * 1000) / 1000), yticks: ticks(0, F.y[1], F.y[1] > 2 ? 1 : 0.5), xfmt: (t) => (F === INTEGRALS.sin ? ({ 0: "0", 0.25: "π/4", 0.5: "π/2", 0.75: "3π/4", 1: "π" })[Math.round((t / Math.PI) * 4) / 4] ?? "" : String(t)) });
    const g = clipped(svg, f);
    const h = (F.b - F.a) / n;
    const style = "fill:var(--brand);fill-opacity:0.16;stroke:var(--brand);stroke-opacity:0.7;stroke-width:1";
    for (let i = 0; i < n; i++) {
      const x0 = F.a + i * h, x1 = x0 + h;
      if (rule === "trap") {
        el("path", { d: `M${f.sx(x0)} ${f.sy(0)}L${f.sx(x0)} ${f.sy(F.f(x0))}L${f.sx(x1)} ${f.sy(F.f(x1))}L${f.sx(x1)} ${f.sy(0)}Z`, style }, g);
      } else if (rule === "simpson") {
        if (i % 2) continue;
        // The parabola through three points over each pair of slices.
        const xa = x0, xm = x0 + h, xb = x0 + 2 * h, ya = F.f(xa), ym = F.f(xm), yb = F.f(xb);
        const q = (x) => ya * ((x - xm) * (x - xb)) / ((xa - xm) * (xa - xb)) + ym * ((x - xa) * (x - xb)) / ((xm - xa) * (xm - xb)) + yb * ((x - xa) * (x - xm)) / ((xb - xa) * (xb - xm));
        let d = `M${f.sx(xa)} ${f.sy(0)}`;
        for (let k = 0; k <= 24; k++) { const x = xa + (k * 2 * h) / 24; d += `L${f.sx(x)} ${f.sy(q(x))}`; }
        el("path", { d: d + `L${f.sx(xb)} ${f.sy(0)}Z`, style }, g);
      } else {
        const xs = rule === "left" ? x0 : rule === "right" ? x1 : x0 + h / 2;
        const y = F.f(xs);
        el("rect", { x: f.sx(x0), y: Math.min(f.sy(y), f.sy(0)), width: f.sx(x1) - f.sx(x0), height: Math.abs(f.sy(y) - f.sy(0)), style }, g);
        el("circle", { cx: f.sx(xs), cy: f.sy(y), r: 2.2, style: "fill:var(--brand)" }, g);
      }
    }
    curve(g, f, F.f, F.a - pad, F.b + pad, "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, g);

    // Error against n, every rule, log–log.
    errSvg.replaceChildren();
    const ns = [2, 4, 8, 16, 32, 64, 128, 256];
    const lg = (e) => Math.log10(Math.max(1e-16, Math.abs(e)));
    const e = frame(errSvg, { box: [44, 16, 440, 122], x: [1, 8], y: [-16, 0], xticks: [1, 2, 3, 4, 5, 6, 7, 8], yticks: [-16, -12, -8, -4, 0], xfmt: (t) => String(2 ** t), yfmt: (t) => (t === 0 ? "1" : `1e${minus(t)}`), xlabel: "n (log scale)", ylabel: "|error|" });
    const NAMES = { left: "left", right: "right", mid: "midpoint", trap: "trapezoid", simpson: "Simpson" };
    const ends = [];
    for (const r of RULES) {
      const pts = ns.map((m, i) => [e.sx(i + 1), e.sy(lg(quad(F, r, m) - F.exact))]);
      polyline(errSvg, pts, r === rule ? "stroke:var(--brand);stroke-width:2" : "stroke:currentColor;stroke-opacity:0.25;stroke-width:1");
      ends.push({ r, y: Math.max(e.T + 4, Math.min(e.T + e.H, pts.at(-1)[1] + 3)) });
    }
    // Labels at the right end, pushed apart so equal errors don't overlap.
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 11);
    for (const { r, y } of ends) text(errSvg, e.L + e.W + 6, y, NAMES[r], r === rule ? { style: "fill:var(--brand)" } : {});
    const cur = quad(F, rule, n), err = cur - F.exact;
    el("circle", { cx: e.sx(Math.log2(n)), cy: e.sy(lg(err)), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, errSvg);
    o.approx.textContent = fx(cur, 8);
    o.exact.textContent = `${fx(F.exact, 8)}`;
    o.err.textContent = Math.abs(err) < 1e-12 ? "0 (exact for this f)" : Math.abs(err) < 1e-4 ? err.toExponential(2).replace("-", "−") : fx(err, 6);
  }
  draw();
}

// ============================================================ Fundamental theorem

const FTC = {
  cos: { f: Math.cos, F: Math.sin },
  lin: { f: (t) => 1 - t / 2, F: (x) => x - (x * x) / 4 },
  wave: { f: (t) => t * Math.sin(t), F: (x) => Math.sin(x) - x * Math.cos(x) },
};

for (const root of document.querySelectorAll("[data-calc-ftc]")) {
  const top = plot(root, "f"), bot = plot(root, "F"), o = outs(root);
  const btn = root.querySelector("[data-action=play]"), setPlay = playButton(btn);
  let F = FTC.cos, raf = 0;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { F = FTC[v]; draw(); });

  const range = (fn) => {
    let lo = 0, hi = 0;
    for (let i = 0; i <= 200; i++) { const v = fn((6 * i) / 200); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const p = (hi - lo) * 0.12 || 1;
    return [lo - p, hi + p];
  };

  function draw() {
    const x = s.x.get();
    top.replaceChildren();
    const yf = range(F.f), yF = range(F.F);
    const f = frame(top, { box: [44, 12, 500, 166], x: [0, 6], y: yf, xticks: [0, 1, 2, 3, 4, 5, 6], yticks: ticks(yf[0], yf[1], yf[1] - yf[0] > 4 ? 2 : 1), yfmt: minus, ylabel: "f(t)" });
    // Signed area: above the axis counts positive, below negative.
    let pos = `M${f.sx(0)} ${f.sy(0)}`;
    const N = 200;
    for (let i = 0; i <= N; i++) { const t = (x * i) / N; pos += `L${f.sx(t)} ${f.sy(Math.max(0, F.f(t)))}`; }
    el("path", { d: pos + `L${f.sx(x)} ${f.sy(0)}Z`, style: "fill:var(--brand);fill-opacity:0.25" }, top);
    let neg = `M${f.sx(0)} ${f.sy(0)}`;
    for (let i = 0; i <= N; i++) { const t = (x * i) / N; neg += `L${f.sx(t)} ${f.sy(Math.min(0, F.f(t)))}`; }
    el("path", { d: neg + `L${f.sx(x)} ${f.sy(0)}Z`, style: "fill:var(--code-del);fill-opacity:0.22" }, top);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, top);
    curve(top, f, F.f, 0, 6, "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, top);
    el("circle", { cx: f.sx(x), cy: f.sy(F.f(x)), r: 4, style: "fill:var(--brand)" }, top);

    bot.replaceChildren();
    const g = frame(bot, { box: [44, 12, 500, 166], x: [0, 6], y: yF, xticks: [0, 1, 2, 3, 4, 5, 6], yticks: ticks(yF[0], yF[1], yF[1] - yF[0] > 4 ? 2 : 1), yfmt: minus, xlabel: "x", ylabel: "F(x) = ∫₀ˣ f(t) dt" });
    const clip = clipped(bot, g);
    el("line", { x1: g.L, x2: g.L + g.W, y1: g.sy(0), y2: g.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, clip);
    curve(clip, g, F.F, 0, 6, "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1.5");
    curve(clip, g, F.F, 0, x, "stroke:var(--foreground);stroke-width:2");
    const m = F.f(x), dx = 0.7;
    el("line", { x1: g.sx(x - dx), y1: g.sy(F.F(x) - m * dx), x2: g.sx(x + dx), y2: g.sy(F.F(x) + m * dx), style: "stroke:var(--brand);stroke-width:1.75" }, clip);
    el("circle", { cx: g.sx(x), cy: g.sy(F.F(x)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, bot);
    const slope = (F.F(x + 1e-5) - F.F(x - 1e-5)) / 2e-5;
    o.F.textContent = fx(F.F(x), 4);
    o.slope.textContent = fx(slope, 4);
    o.fx.textContent = fx(m, 4);
  }

  const stop = () => { cancelAnimationFrame(raf); raf = 0; setPlay(false); };
  btn.addEventListener("click", () => {
    if (raf) return stop();
    if (reduced()) { s.x.set(6, false); return draw(); }
    if (s.x.get() >= 5.99) s.x.set(0, false);
    setPlay(true);
    let last = performance.now();
    const loop = (now) => {
      const x = Math.min(6, s.x.get() + ((now - last) / 1000) * 1.2);
      last = now;
      s.x.set(x, false);
      draw();
      if (x >= 6) return stop();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && raf) stop(); }).observe(root);
  draw();
}

// ============================================================ Taylor

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).split("").map((d) => SUP[d]).join("");
const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

const TAYLOR = {
  sin: { f: Math.sin, c: (n) => (n % 2 ? (((n - 1) / 2) % 2 ? -1 : 1) / fact(n) : 0), term: (n) => `x${n > 1 ? sup(n) : ""}${n > 1 ? `/${n}!` : ""}`, radius: "∞", x: [-7, 7], y: [-2.5, 2.5] },
  exp: { f: Math.exp, c: (n) => 1 / fact(n), term: (n) => (n === 0 ? "1" : `x${n > 1 ? sup(n) : ""}${n > 1 ? `/${n}!` : ""}`), radius: "∞", x: [-4, 3], y: [-2, 12] },
  log: { f: (x) => (x > -1 ? Math.log1p(x) : NaN), c: (n) => (n === 0 ? 0 : (n % 2 ? 1 : -1) / n), term: (n) => `x${n > 1 ? sup(n) : ""}${n > 1 ? `/${n}` : ""}`, radius: "1 (|x| < 1, and x = 1)", x: [-1.5, 3], y: [-3, 2.5], R: 1 },
  geo: { f: (x) => 1 / (1 - x), c: () => 1, term: (n) => (n === 0 ? "1" : `x${n > 1 ? sup(n) : ""}`), radius: "1 (|x| < 1)", x: [-3, 3], y: [-4, 6], R: 1 },
};

for (const root of document.querySelectorAll("[data-calc-taylor]")) {
  const svg = plot(root), o = outs(root);
  let key = "sin", F = TAYLOR.sin;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { key = v; F = TAYLOR[v]; draw(); });
  const P = (x, n) => { let sum = 0, p = 1; for (let k = 0; k <= n; k++) { sum += F.c(k) * p; p *= x; } return sum; };

  function draw() {
    const n = Math.round(s.deg.get()), x0 = s.x.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 290], x: F.x, y: F.y, xticks: ticks(F.x[0], F.x[1], 1), yticks: ticks(F.y[0], F.y[1], F.y[1] - F.y[0] > 8 ? 2 : 1), xfmt: minus, yfmt: minus });
    const g = clipped(svg, f);
    if (F.R) {
      for (const [a, b] of [[F.x[0], -F.R], [F.R, F.x[1]]]) {
        if (b <= a) continue;
        el("rect", { x: f.sx(a), y: f.T, width: f.sx(b) - f.sx(a), height: f.H, style: "fill:currentColor;fill-opacity:0.05" }, g);
      }
      text(svg, f.sx(F.R) + 4, f.T + 12, "outside the radius");
    }
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, g);
    curve(g, f, F.f, F.x[0], F.x[1], "stroke:var(--foreground);stroke-width:2", 800);
    curve(g, f, (x) => P(x, n), F.x[0], F.x[1], "stroke:var(--brand);stroke-width:2", 800);
    const fv = F.f(x0), pv = P(x0, n);
    el("line", { x1: f.sx(x0), x2: f.sx(x0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, g);
    if (Number.isFinite(pv)) el("circle", { cx: f.sx(x0), cy: f.sy(Math.max(F.y[0], Math.min(F.y[1], pv))), r: 4, style: "fill:var(--brand)" }, g);
    if (Number.isFinite(fv)) el("circle", { cx: f.sx(x0), cy: f.sy(Math.max(F.y[0], Math.min(F.y[1], fv))), r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.75" }, g);
    o.fx.textContent = Number.isFinite(fv) ? fx(fv, 6) : "undefined";
    o.px.textContent = Math.abs(pv) > 1e6 ? pv.toExponential(3).replace("-", "−") : fx(pv, 6);
    const err = Math.abs(fv - pv);
    o.err.textContent = !Number.isFinite(err) ? "—" : err > 1e6 ? err.toExponential(2) : err < 1e-6 ? err.toExponential(2).replace("-", "−") : fx(err, 6);
    o.radius.textContent = F.radius;
    // The polynomial written out, first terms only.
    const parts = [];
    for (let k = 0; k <= n; k++) {
      const c = F.c(k);
      if (c === 0) continue;
      parts.push([c < 0 ? "−" : "+", F.term(k)]);
    }
    const shown = parts.slice(0, 6).map(([sg, t], i) => (i === 0 ? (sg === "−" ? "−" : "") + t : ` ${sg} ${t}`)).join("");
    o.terms.textContent = `P${n <= 9 ? "₀₁₂₃₄₅₆₇₈₉"[n] : "ₙ"}(x) = ${shown || "0"}${parts.length > 6 ? " + …" : ""}`;
  }
  draw();
}

// ============================================================ Newton

const NEWTON = {
  sqrt2: { f: (x) => x * x - 2, d: (x) => 2 * x, root: Math.SQRT2, x0: 3, x: [-0.5, 3.5], y: [-3, 11] },
  cos: { f: (x) => Math.cos(x) - x, d: (x) => -Math.sin(x) - 1, root: 0.7390851332151607, x0: 2, x: [-1, 3], y: [-4, 2] },
  cycle: { f: (x) => x ** 3 - 2 * x + 2, d: (x) => 3 * x * x - 2, root: null, x0: 0, x: [-2.5, 2.5], y: [-6, 8] },
};

for (const root of document.querySelectorAll("[data-calc-newton]")) {
  const svg = plot(root), rows = root.querySelector("[data-rows]");
  let F = NEWTON.sqrt2, xs = [];
  const s = scrubAll(root, reset);
  onSeg(root, (_, v) => { F = NEWTON[v]; s.x0.set(F.x0, false); reset(); });
  root.querySelector("[data-action=step]").addEventListener("click", step);
  root.querySelector("[data-action=reset]").addEventListener("click", reset);

  function reset() { xs = [s.x0.get()]; draw(); }
  function step() {
    if (xs.length > 24) return;
    const x = xs.at(-1), d = F.d(x);
    if (d === 0 || !Number.isFinite(x)) return;
    xs.push(x - F.f(x) / d);
    draw();
  }

  // How many leading digits agree with the root.
  const correct = (x) => {
    if (F.root === null) return 0;
    const a = x.toFixed(12), b = F.root.toFixed(12);
    let k = 0;
    while (k < a.length && a[k] === b[k]) k++;
    return a.slice(0, k).replace(/\D/g, "").length ? k : 0;
  };

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 270], x: F.x, y: F.y, xticks: ticks(F.x[0], F.x[1], 0.5), yticks: ticks(F.y[0], F.y[1], 2), xfmt: minus, yfmt: minus });
    const g = clipped(svg, f);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.4" }, g);
    curve(g, f, F.f, F.x[0], F.x[1], "stroke:var(--foreground);stroke-width:2");
    xs.forEach((x, k) => {
      if (k + 1 < xs.length) {
        el("line", { x1: f.sx(x), y1: f.sy(0), x2: f.sx(x), y2: f.sy(F.f(x)), style: "stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:3 3" }, g);
        el("line", { x1: f.sx(x), y1: f.sy(F.f(x)), x2: f.sx(xs[k + 1]), y2: f.sy(0), style: "stroke:var(--brand);stroke-width:1.5" }, g);
      }
      el("circle", { cx: f.sx(x), cy: f.sy(0), r: k === xs.length - 1 ? 4.5 : 3, style: k === xs.length - 1 ? "fill:var(--brand)" : "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, g);
    });
    rows.innerHTML = xs.map((x, k) => {
      const str = minus(x.toFixed(12)), c = correct(x);
      const val = c ? `<span class="text-brand">${str.slice(0, c)}</span>${str.slice(c)}` : str;
      const r = Math.abs(F.f(x));
      return `<tr class="border-b last:border-b-0"><td class="px-2 py-1 text-muted-foreground">${k}</td><td class="px-2 py-1">${val}</td><td class="px-2 py-1 text-right">${r < 1e-3 ? r.toExponential(1).replace("-", "−") : r.toFixed(4)}</td></tr>`;
    }).join("");
  }
  reset();
}

// ============================================================ Euler

const ODES = {
  growth: { f: (x, y) => y, exact: Math.exp, y: [-0.5, 9] },
  relax: { f: (x, y) => x - y, exact: (x) => x - 1 + 2 * Math.exp(-x), y: [0, 2] },
  gauss: { f: (x, y) => -2 * x * y, exact: (x) => Math.exp(-x * x), y: [-0.3, 1.3] },
};

for (const root of document.querySelectorAll("[data-calc-euler]")) {
  const svg = plot(root), o = outs(root);
  let F = ODES.growth, heun = true;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { F = ODES[v]; draw(); });
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { heun = e.detail.checked; draw(); }));

  // Steps of (about) h that land exactly on x = 2.
  function solve(method, h0) {
    const n = Math.max(1, Math.round(2 / h0)), h = 2 / n;
    const pts = [[0, 1]];
    let x = 0, y = 1;
    for (let i = 0; i < n; i++) {
      const k1 = F.f(x, y);
      if (method === "euler") y += h * k1;
      else { const k2 = F.f(x + h, y + h * k1); y += (h * (k1 + k2)) / 2; }
      x += h;
      pts.push([x, y]);
    }
    return pts;
  }

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 290], x: [0, 2.4], y: F.y, xticks: [0, 0.5, 1, 1.5, 2], yticks: ticks(F.y[0], F.y[1], F.y[1] - F.y[0] > 4 ? 2 : 0.5), xfmt: minus, yfmt: minus });
    const g = clipped(svg, f);
    // Slope field: short segments of equal screen length.
    for (let i = 0; i <= 18; i++) for (let j = 0; j <= 11; j++) {
      const x = (2.4 * i) / 18, y = F.y[0] + ((F.y[1] - F.y[0]) * j) / 11;
      const m = F.f(x, y);
      const dxs = f.sx(1) - f.sx(0), dys = f.sy(0) - f.sy(1);
      const vx = dxs, vy = m * dys, len = Math.hypot(vx, vy), L = 8;
      el("line", { x1: f.sx(x) - (vx / len) * L, y1: f.sy(y) + (vy / len) * L, x2: f.sx(x) + (vx / len) * L, y2: f.sy(y) - (vy / len) * L, style: "stroke:currentColor;stroke-opacity:0.22;stroke-width:1" }, g);
    }
    curve(g, f, F.exact, 0, 2.4, "stroke:var(--foreground);stroke-width:2");
    const eu = solve("euler", s.h.get()), he = solve("heun", s.h.get());
    polyline(g, eu.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:1.75");
    for (const [x, y] of eu) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.5, style: "fill:var(--brand)" }, g);
    if (heun) {
      polyline(g, he.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 3");
      for (const [x, y] of he) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.2, style: "fill:var(--vec-u)" }, g);
    }
    el("line", { x1: f.sx(2), x2: f.sx(2), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3" }, g);
    const ex = F.exact(2), ye = eu.at(-1)[1], yh = he.at(-1)[1];
    o.exact.textContent = fx(ex, 6);
    o.euler.textContent = fx(ye, 6);
    o.eerr.textContent = fx(ye - ex, 6);
    o.herr.textContent = Math.abs(yh - ex) < 1e-4 ? (yh - ex).toExponential(2).replace("-", "−") : fx(yh - ex, 6);
  }
  draw();
}

// ============================================================ Series

// ζ(p) for p > 1: a partial sum plus the Euler–Maclaurin tail.
function zeta(p) {
  const M = 10000;
  let s = 0;
  for (let n = 1; n <= M; n++) s += n ** -p;
  return s + M ** (1 - p) / (p - 1) - M ** -p / 2 + (p * M ** (-p - 1)) / 12;
}

for (const root of document.querySelectorAll("[data-calc-series]")) {
  const svg = plot(root), o = outs(root);
  let kind = "harmonic";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { kind = v; draw(); });

  function series() {
    const r = s.r.get(), p = s.p.get();
    switch (kind) {
      case "harmonic": return { a: (n) => 1 / n, start: 1, limit: null, verdict: "diverges", test: "Integral test: the sum grows like ln N + γ (γ ≈ 0.5772), slowly but without bound." };
      case "alt": return { a: (n) => (n % 2 ? 1 : -1) / n, start: 1, limit: Math.LN2, name: "ln 2", verdict: "converges to ln 2", test: "Alternating series test: terms shrink to 0, so the sums close in; the error after N terms is at most 1/(N+1). Only conditionally convergent: Σ 1/n diverges." };
      case "geo": return Math.abs(r) < 1
        ? { a: (n) => r ** n, start: 0, limit: 1 / (1 - r), name: "1/(1−r)", verdict: `converges to ${fx(1 / (1 - r), 4)}`, test: "Geometric series: Σ rⁿ = 1/(1−r) exactly when |r| < 1 (ratio test with ratio |r|)." }
        : { a: (n) => r ** n, start: 0, limit: null, verdict: "diverges", test: "|r| ≥ 1: the terms do not shrink to 0, so the series cannot converge (divergence test)." };
      case "p": return p > 1
        ? { a: (n) => n ** -p, start: 1, limit: Math.abs(p - 2) < 1e-9 ? Math.PI ** 2 / 6 : zeta(p), name: Math.abs(p - 2) < 1e-9 ? "π²/6" : "ζ(p)", verdict: `converges to ${fx(Math.abs(p - 2) < 1e-9 ? Math.PI ** 2 / 6 : zeta(p), 4)}`, test: "p-series: converges exactly when p > 1 (integral test). At p = 2 the sum is π²/6 (Euler, 1734)." }
        : { a: (n) => n ** -p, start: 1, limit: null, verdict: "diverges", test: "p ≤ 1: the terms shrink too slowly; compare with the integral of x⁻ᵖ, which diverges." };
      default: return { a: (n) => 1 / fact(n), start: 0, limit: Math.E, name: "e", verdict: "converges to e", test: "Ratio test: aₙ₊₁/aₙ = 1/(n+1) → 0, so it converges, very fast. The sum is e." };
    }
  }

  function draw() {
    const N = Math.round(s.N.get()), S = series();
    const sums = [];
    let acc = 0;
    for (let k = 0; k < N; k++) { acc += S.a(S.start + k); sums.push(acc); }
    const finite = sums.filter((v) => Number.isFinite(v) && Math.abs(v) < 1e6);
    let lo = Math.min(0, ...finite, S.limit ?? 0), hi = Math.max(...finite, S.limit ?? 0);
    if (hi - lo < 1e-9) hi = lo + 1;
    const pad = (hi - lo) * 0.1;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 492, 270], x: [0, N], y: [lo - pad, hi + pad], xticks: ticks(0, N, N > 100 ? 100 : N > 40 ? 20 : N > 10 ? 5 : 1), yticks: ticks(lo - pad, hi + pad, niceStep((hi - lo) / 4)), yfmt: (v) => minus(Number(v.toFixed(3))), xlabel: "terms N", ylabel: "partial sum Sₙ" });
    const g = clipped(svg, f);
    if (S.limit !== null) {
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(S.limit), y2: f.sy(S.limit), style: "stroke:var(--vec-u);stroke-dasharray:5 4;stroke-width:1.5" }, g);
      text(svg, f.L + f.W - 4, f.sy(S.limit) - 5, S.name, { "text-anchor": "end", style: "fill:var(--vec-u)" });
    }
    if (kind === "harmonic") {
      curve(g, f, (x) => Math.log(x) + 0.5772156649, 1, N, "stroke:var(--vec-u);stroke-dasharray:5 4;stroke-width:1.25");
      text(svg, f.L + f.W - 4, f.sy(Math.log(N) + 0.5772156649) + 16, "ln N + γ", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    }
    polyline(g, sums.map((v, k) => [f.sx(k + 1), f.sy(Math.max(lo - pad, Math.min(hi + pad, v)))]), "stroke:var(--brand);stroke-width:1.5");
    if (N <= 80) sums.forEach((v, k) => el("circle", { cx: f.sx(k + 1), cy: f.sy(Math.max(lo - pad, Math.min(hi + pad, v))), r: 2, style: "fill:var(--brand)" }, g));
    const last = sums.at(-1);
    o.sum.textContent = Math.abs(last) > 1e6 ? last.toExponential(3) : fx(last, 6);
    o.limit.textContent = S.limit === null ? "none" : fx(S.limit, 6);
    o.verdict.textContent = S.verdict;
    o.verdict.className = "tabular-nums " + (S.limit === null ? "text-del" : "text-add");
    o.test.textContent = S.test;
  }

  function niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(raw || 1));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  draw();
}
