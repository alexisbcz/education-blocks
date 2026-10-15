// Differential equations, blocks 6–10: the Laplace transform, first-order
// solution families, existence and uniqueness, the heat equation and the
// wave equation on a string.

import { scrubAll } from "./scrub.js";
import {
  el, text, frame, polyline, outs, plot, fx, minus, sgn, onSeg, selectSeg, onToggle, C, clipped, ticks, path, rk4, solve,
  svgPoint, animator, batched,
} from "./odes-util.js";

const li = (ol, ...lines) => ol.replaceChildren(...lines.map(([head, body]) => {
  const n = document.createElement("li");
  n.className = "flex flex-col gap-0.5";
  const a = document.createElement("span");
  a.className = "text-muted-foreground";
  a.textContent = head;
  const b = document.createElement("span");
  b.className = "break-words";
  b.textContent = body;
  n.append(a, b);
  return n;
}));

// ============================================================ 6 Laplace

// Complex numbers as [re, im].
const cx = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
};
/** Evaluates a polynomial (coefficients from the highest power) at complex z. */
const peval = (p, z) => p.reduce((acc, c) => cx.add(cx.mul(acc, z), [c, 0]), [0, 0]);
const pderiv = (p) => p.slice(0, -1).map((c, i) => c * (p.length - 1 - i));

/** A polynomial in s as text: [1, 3, 2] → "s² + 3s + 2". */
function pstr(p, v = "s") {
  const SUP = ["", "", "²", "³", "⁴"];
  const deg = p.length - 1;
  let out = "";
  p.forEach((c, i) => {
    const k = deg - i;
    if (Math.abs(c) < 1e-12) return;
    const mag = Math.abs(c), coef = k > 0 && Math.abs(mag - 1) < 1e-12 ? "" : fx(mag, 3);
    const term = k === 0 ? fx(mag, 3) : `${coef}${v}${SUP[k]}`;
    out += out ? (c < 0 ? ` − ${term}` : ` + ${term}`) : (c < 0 ? `−${term}` : term);
  });
  return out || "0";
}
/** (s − p) as text, with p real. */
const factor = (p) => (Math.abs(p) < 1e-12 ? "s" : p < 0 ? `(s + ${fx(-p, 3)})` : `(s − ${fx(p, 3)})`);
const expo = (p) => {
  if (Math.abs(p) < 1e-12) return "";
  const m = Math.abs(Math.abs(p) - 1) < 1e-12 ? "" : fx(Math.abs(p), 3);
  return `e^(${p < 0 ? "−" : ""}${m}t)`;
};
/** c times body, as text: drops a unit coefficient; "" when c is 0. */
const times = (c, body) => {
  if (Math.abs(c) < 1e-12) return "";
  if (!body) return fx(c, 4);
  if (Math.abs(c - 1) < 1e-12) return body;
  if (Math.abs(c + 1) < 1e-12) return `−${body}`;
  return `${fx(c, 4)}${/^(cos|sin)/.test(body) ? " " : ""}${body}`;
};
/** Joins signed terms into a sum, dropping empty ones. */
const sum = (arr) => {
  const out = arr.filter(Boolean).map((x, i) => (i === 0 ? x : x.startsWith("−") ? ` − ${x.slice(1)}` : ` + ${x}`)).join("");
  return out || "0";
};

for (const root of document.querySelectorAll("[data-ode-laplace]")) {
  const svg = plot(root), o = outs(root);
  let forcing = "step";
  const s = scrubAll(root, batched(() => draw()));

  function draw() {
    const a = s.a.get(), b = s.b.get(), y0 = s.y0.get(), v0 = s.v0.get();
    const Fs = { step: "1/s", impulse: "1", none: "0" }[forcing];
    // Y(s) = N(s) / D(s)
    let N, D;
    const q = [1, a, b]; // s² + a s + b
    if (forcing === "step") { N = [y0, a * y0 + v0, 1]; D = [1, a, b, 0]; }
    else { N = [y0, a * y0 + v0 + (forcing === "impulse" ? 1 : 0)]; D = q; }

    const disc = a * a - 4 * b;
    const roots = Math.abs(disc) < 1e-9 ? { kind: "double", p: -a / 2 }
      : disc > 0 ? { kind: "real", p: [(-a + Math.sqrt(disc)) / 2, (-a - Math.sqrt(disc)) / 2] }
      : { kind: "complex", re: -a / 2, im: Math.sqrt(-disc) / 2 };

    const terms = [];   // {pf: text, inv: text, f: t => value}
    const poles = [];   // [re, im]
    const res = (p) => cx.div(peval(N, p), peval(pderiv(D), p));
    if (forcing === "step") {
      const r0 = N[2] / b; // N(0) / (s² + as + b at 0)
      poles.push([0, 0]);
      terms.push({ pf: Math.abs(r0) < 1e-12 ? "" : `${fx(r0, 4)}/s`, inv: times(r0, ""), f: () => r0 });
    }
    if (roots.kind === "real") {
      for (const p of roots.p) {
        poles.push([p, 0]);
        const r = res([p, 0])[0];
        terms.push({ pf: Math.abs(r) < 1e-12 ? "" : `${fx(r, 4)}/${factor(p)}`, inv: times(r, expo(p)), f: (t) => r * Math.exp(p * t) });
      }
    } else if (roots.kind === "complex") {
      const p = [roots.re, roots.im];
      poles.push(p, [roots.re, -roots.im]);
      const r = res(p), A = 2 * r[0], B = -2 * r[1], al = roots.re, be = roots.im;
      const shift = Math.abs(al) < 1e-12 ? "s²" : `(s ${al < 0 ? "+" : "−"} ${fx(Math.abs(al), 3)})²`;
      terms.push({
        pf: `[${sum([times(A, Math.abs(al) < 1e-12 ? "s" : `(s ${al < 0 ? "+" : "−"} ${fx(Math.abs(al), 3)})`), times(B * be, "")])}] / [${shift} + ${fx(be * be, 4)}]`,
        inv: `${expo(al)}(${sum([times(A, `cos ${fx(be, 3)}t`), times(B, `sin ${fx(be, 3)}t`)])})`,
        f: (t) => Math.exp(al * t) * (A * Math.cos(be * t) + B * Math.sin(be * t)),
      });
    } else {
      // Double root p: Q(s) = N(s)/s^k, terms A/(s−p)² + B/(s−p).
      const p = roots.p;
      poles.push([p, 0], [p, 0]);
      const k = forcing === "step" ? 1 : 0;
      const Np = peval(N, [p, 0])[0], dNp = peval(pderiv(N), [p, 0])[0];
      const A = k ? Np / p : Np;
      const B = k ? (dNp * p - Np) / (p * p) : dNp;
      terms.push({ pf: Math.abs(A) < 1e-12 ? "" : `${fx(A, 4)}/${factor(p)}²`, inv: times(A, `t${expo(p)}`), f: (t) => A * t * Math.exp(p * t) });
      terms.push({ pf: Math.abs(B) < 1e-12 ? "" : `${fx(B, 4)}/${factor(p)}`, inv: times(B, expo(p)), f: (t) => B * Math.exp(p * t) });
    }
    const y = (t) => terms.reduce((acc, tm) => acc + tm.f(t), 0);

    const qText = pstr(q);
    const fact = roots.kind === "real" ? `${factor(roots.p[0])}${factor(roots.p[1])}`
      : roots.kind === "double" ? `${factor(roots.p)}²`
      : `(s ${roots.re < 0 ? "+" : "−"} ${fx(Math.abs(roots.re), 3)})² + ${fx(roots.im ** 2, 4)}`;
    const neg = (c, body) => times(-c, body);
    const lhs = sum([
      "s²Y", neg(y0, "s"), neg(v0, ""),
      times(a, y0 ? `(sY − ${fx(y0, 2)})` : "sY"),
      times(b, "Y"),
    ]);
    const rhs = sum([forcing === "none" ? "" : Fs, times(y0, "s"), times(a * y0 + v0, "")]);
    li(o.steps,
      ["1. Transform each term (L{y″} = s²Y − s·y(0) − y′(0), L{y′} = sY − y(0))", `${lhs} = ${Fs}`],
      ["2. Collect Y", `(${qText}) Y = ${rhs}`],
      ["3. Solve for Y(s)", `Y(s) = (${pstr(N)}) / (${pstr(D)})`],
      ["4. Factor the denominator", `${forcing === "step" ? "s · " : ""}${fact}`],
      ["5. Partial fractions", `Y(s) = ${sum(terms.map((t) => t.pf))}`],
      ["6. Invert term by term", `y(t) = ${sum(terms.map((t) => t.inv))}`],
    );

    // Numerical check: RK4 from the same start (an impulse adds 1 to y′(0)).
    const T = 10, n = 2000, h = T / n;
    const force = forcing === "step" ? 1 : 0;
    const sol = solve((_, [u, v]) => [v, force - a * v - b * u], 0, [y0, v0 + (forcing === "impulse" ? 1 : 0)], T, n, 1e8);
    let err = 0;
    for (const [t, [u]] of sol) err = Math.max(err, Math.abs(u - y(t)));

    svg.replaceChildren();
    const re = poles.map((p) => p[0]), im = poles.map((p) => p[1]);
    const R = Math.max(1.5, ...re.map(Math.abs), ...im.map(Math.abs)) * 1.25;
    const sp = frame(svg, { box: [40, 20, 220, 210], x: [-R, R], y: [-R, R], xticks: ticks(-R, R, R > 6 ? 4 : R > 3 ? 2 : 1), yticks: ticks(-R, R, R > 6 ? 4 : R > 3 ? 2 : 1), xfmt: minus, yfmt: minus, xlabel: "Re s", ylabel: "Im s" });
    const sg = clipped(svg, sp);
    el("rect", { x: sp.sx(0), y: sp.T, width: sp.L + sp.W - sp.sx(0), height: sp.H, style: "fill:var(--code-del);fill-opacity:0.06" }, sg);
    el("line", { x1: sp.sx(0), x2: sp.sx(0), y1: sp.T, y2: sp.T + sp.H, style: "stroke:var(--foreground);stroke-opacity:0.4" }, sg);
    el("line", { x1: sp.L, x2: sp.L + sp.W, y1: sp.sy(0), y2: sp.sy(0), style: "stroke:var(--foreground);stroke-opacity:0.4" }, sg);
    text(sg, sp.L + sp.W - 4, sp.T + 12, "growth", { "text-anchor": "end" });
    text(sg, sp.L + 4, sp.T + 12, "decay", { "text-anchor": "start" });
    poles.forEach(([x, yv], i) => {
      const cxp = sp.sx(x), cyp = sp.sy(yv), d = 5 + (i > 0 && poles.slice(0, i).some((q) => Math.abs(q[0] - x) < 1e-9 && Math.abs(q[1] - yv) < 1e-9) ? 3 : 0);
      el("path", { d: `M${cxp - d},${cyp - d}L${cxp + d},${cyp + d}M${cxp - d},${cyp + d}L${cxp + d},${cyp - d}`, style: "stroke:var(--brand);stroke-width:2" }, svg);
    });

    const ys = sol.map(([, [u]]) => u);
    let lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
    if (hi - lo < 0.2) { hi += 0.1; lo -= 0.1; }
    const pad = (hi - lo) * 0.1;
    lo -= pad; hi += pad;
    const span = hi - lo, st = span > 20 ? 10 : span > 8 ? 2 : span > 3 ? 1 : span > 1.2 ? 0.5 : 0.2;
    const tf = frame(svg, { box: [320, 20, 380, 210], x: [0, T], y: [lo, hi], xticks: ticks(0, T, 2), yticks: ticks(lo, hi, st), yfmt: minus, xlabel: "t", ylabel: "y(t)" });
    const tg = clipped(svg, tf);
    sol.forEach(([t, [u]], k) => { if (k % 50 === 0) el("circle", { cx: tf.sx(t), cy: tf.sy(u), r: 3, style: `fill:none;stroke:${C.v};stroke-width:1.5` }, tg); });
    path(tg, Array.from({ length: 401 }, (_, k) => { const t = (T * k) / 400; return [tf.sx(t), tf.sy(y(t))]; }), "stroke:var(--brand);stroke-width:2");

    o.poles.textContent = poles.map(([x, yv]) => (yv === 0 ? fx(x, 3) : `${fx(x, 3)} ${yv < 0 ? "−" : "+"} ${fx(Math.abs(yv), 3)}i`)).join(", ");
    o.check.textContent = err < 1e-6 ? `${err.toExponential(1).replace("-", "−")} (agrees)` : err.toExponential(2).replace("-", "−");
    svg.setAttribute("aria-label", `Poles ${o.poles.textContent}. ${o.steps.lastChild.textContent}`);
  }

  onSeg(root, (_, v) => { forcing = v; draw(); });
  root.querySelector('[data-action="preset"]').addEventListener("click", () => {
    s.a.set(3, false); s.b.set(2, false); s.y0.set(0, false); s.v0.set(0, false);
    forcing = "step"; selectSeg(root, "Forcing", "step");
    draw();
  });
  draw();
}

// ============================================================ 7 First-order families

const FIRST = {
  growth: {
    f: (t, y) => 0.5 * y,
    C: (t0, y0) => y0 * Math.exp(-0.5 * t0), y: (t, c) => c * Math.exp(0.5 * t),
    sol: (c) => `y = ${times(c, "e^(0.5t)") || "0"}`, dom: () => "all t",
    steps: (t0, y0, c) => [
      "Separate: dy / y = 0.5 dt",
      "Integrate: ln|y| = 0.5t + k",
      "Exponentiate: y = C e^(0.5t), C = ±e^k (C = 0 is the rest solution)",
      `Use y(${fx(t0, 2)}) = ${fx(y0, 2)}: C = y₀ e^(−0.5t₀) = ${fx(c, 4)}`,
    ],
  },
  gauss: {
    f: (t, y) => -t * y,
    C: (t0, y0) => y0 * Math.exp((t0 * t0) / 2), y: (t, c) => c * Math.exp(-(t * t) / 2),
    sol: (c) => `y = ${times(c, "e^(−t²/2)") || "0"}`, dom: () => "all t",
    steps: (t0, y0, c) => [
      "Separate: dy / y = −t dt",
      "Integrate: ln|y| = −t²/2 + k",
      "Exponentiate: y = C e^(−t²/2)",
      `Use y(${fx(t0, 2)}) = ${fx(y0, 2)}: C = y₀ e^(t₀²/2) = ${fx(c, 4)}`,
    ],
  },
  logistic: {
    f: (t, y) => y * (1 - y),
    C: (t0, y0) => (y0 === 0 ? Infinity : (1 / y0 - 1) * Math.exp(t0)),
    y: (t, c) => (c === Infinity ? 0 : 1 / (1 + c * Math.exp(-t))),
    sol: (c) => (c === Infinity ? "y = 0 (the rest solution)" : `y = 1 / (${sum(["1", times(c, "e^(−t)")])})`),
    dom: (t0, c) => {
      if (!(c < 0) || c === Infinity) return "all t";
      const ts = Math.log(-c);
      return t0 > ts ? `t > ${fx(ts, 3)} (blows up there)` : `t < ${fx(ts, 3)} (blows up there)`;
    },
    steps: (t0, y0, c) => [
      "Separate: dy / (y(1 − y)) = dt",
      "Partial fractions: (1/y + 1/(1 − y)) dy = dt",
      "Integrate: ln|y / (1 − y)| = t + k, so y = 1 / (1 + C e^(−t))",
      y0 === 0 ? "y₀ = 0 is the equilibrium y ≡ 0, the member the formula misses (C = ∞)" : `Use y(${fx(t0, 2)}) = ${fx(y0, 2)}: C = (1/y₀ − 1) e^(t₀) = ${fx(c, 4)}`,
    ],
  },
  linear: {
    f: (t, y) => t - y,
    C: (t0, y0) => (y0 - t0 + 1) * Math.exp(t0), y: (t, c) => t - 1 + c * Math.exp(-t),
    sol: (c) => `y = ${sum(["t", "−1", times(c, "e^(−t)")])}`, dom: () => "all t",
    steps: (t0, y0, c) => [
      "Integrating factor: μ(t) = e^(∫1 dt) = e^t",
      "Multiply: (y e^t)′ = t e^t",
      "Integrate by parts: y e^t = (t − 1) e^t + C",
      `Use y(${fx(t0, 2)}) = ${fx(y0, 2)}: C = (y₀ − t₀ + 1) e^(t₀) = ${fx(c, 4)}`,
    ],
  },
  circle: {
    f: (t, y) => -t / y,
    C: (t0, y0) => (y0 === 0 ? NaN : Math.sign(y0) * (t0 * t0 + y0 * y0)),
    y: (t, c) => Math.sign(c) * Math.sqrt(Math.abs(c) - t * t),
    sol: (c) => (Number.isFinite(c) ? `y = ${c < 0 ? "−" : ""}√(${fx(Math.abs(c), 4)} − t²)` : "no solution: f is undefined at y = 0"),
    dom: (t0, c) => (Number.isFinite(c) ? `|t| < ${fx(Math.sqrt(Math.abs(c)), 3)} (the slope is infinite at the ends)` : "—"),
    steps: (t0, y0, c) => [
      "Separate: y dy = −t dt",
      "Integrate: y²/2 = −t²/2 + k, so t² + y² = K",
      "Solve for y: y = ±√(K − t²), the sign set by y₀",
      Number.isFinite(c) ? `Use y(${fx(t0, 2)}) = ${fx(y0, 2)}: K = t₀² + y₀² = ${fx(Math.abs(c), 4)}` : "y₀ = 0 is not allowed: the equation divides by y",
    ],
  },
};

for (const root of document.querySelectorAll("[data-ode-first]")) {
  const svg = plot(root), o = outs(root);
  let eq = "growth", fr = null;
  const s = scrubAll(root, batched(() => draw()));

  function draw() {
    const E = FIRST[eq], t0 = s.t0.get(), y0 = s.y0.get();
    svg.replaceChildren();
    fr = frame(svg, { box: [44, 20, 496, 330], x: [-3, 3], y: [-3, 3], xticks: ticks(-3, 3, 1), yticks: ticks(-3, 3, 1), xfmt: minus, yfmt: minus, xlabel: "t", ylabel: "y" });
    const g = clipped(svg, fr);
    // A faint slope field.
    for (let i = 0; i <= 24; i++) for (let j = 0; j <= 18; j++) {
      const t = -3 + (6 * (i + 0.5)) / 25, y = -3 + (6 * (j + 0.5)) / 19;
      const m = E.f(t, y);
      if (!Number.isFinite(m)) continue;
      const dx = fr.W / 6, dy = (m * fr.H) / 6, n = Math.hypot(dx, dy), L = 5;
      el("line", { x1: fr.sx(t) - (dx / n) * L, y1: fr.sy(y) + (dy / n) * L, x2: fr.sx(t) + (dx / n) * L, y2: fr.sy(y) - (dy / n) * L, style: "stroke:var(--foreground);stroke-opacity:0.16" }, g);
    }
    // The family: one member per starting value at t = 0 (or per radius).
    const N = 400;
    const curve = (c, style) => path(g, Array.from({ length: N + 1 }, (_, k) => {
      const t = -3 + (6 * k) / N;
      return [fr.sx(t), fr.sy(E.y(t, c))];
    }), style, 1e4);
    const family = eq === "circle"
      ? [0.5, 1, 1.5, 2, 2.5, 3].flatMap((r) => [r * r, -r * r])
      : [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5].map((v) => E.C(0, v)).filter((c) => c !== Infinity || eq === "logistic");
    for (const c of family) curve(c, "stroke:var(--foreground);stroke-opacity:0.3;stroke-width:1");
    const c = E.C(t0, y0);
    if (Number.isFinite(c) || c === Infinity) curve(c, "stroke:var(--brand);stroke-width:2.5");
    el("circle", { cx: fr.sx(t0), cy: fr.sy(y0), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);

    const steps = E.steps(t0, y0, c);
    o.steps.replaceChildren(...steps.map((st) => { const n = document.createElement("li"); n.textContent = st; return n; }));
    o.c.textContent = c === Infinity ? "∞" : Number.isFinite(c) ? fx(c, 4) : "—";
    o.sol.textContent = E.sol(c);
    o.dom.textContent = E.dom(t0, c);
    svg.setAttribute("aria-label", `Solution through (${fx(t0, 2)}, ${fx(y0, 2)}): ${o.sol.textContent}`);
  }

  onSeg(root, (_, v) => { eq = v; if (v === "circle" && s.y0.get() === 0) s.y0.set(1, false); draw(); });
  svg.classList.add("cursor-crosshair");
  svg.addEventListener("click", (e) => {
    if (!fr) return;
    const p = svgPoint(svg, e);
    if (p.x < fr.L || p.x > fr.L + fr.W || p.y < fr.T || p.y > fr.T + fr.H) return;
    s.t0.set(-3 + ((p.x - fr.L) / fr.W) * 6, false);
    s.y0.set(-3 + ((fr.T + fr.H - p.y) / fr.H) * 6, false);
    draw();
  });
  draw();
}

// ============================================================ 8 Existence and uniqueness

for (const root of document.querySelectorAll("[data-ode-unique]")) {
  const svg = plot(root), o = outs(root);
  let eq = "sqrt";
  const s = scrubAll(root, batched(() => draw()));

  function draw() {
    svg.replaceChildren();
    if (eq === "sqrt") {
      const c = s.c.get();
      const f = frame(svg, { box: [44, 20, 496, 310], x: [0, 6], y: [-0.3, 6], xticks: ticks(0, 6, 1), yticks: ticks(0, 6, 1), xlabel: "t", ylabel: "y" });
      const g = clipped(svg, f);
      const member = (cc) => Array.from({ length: 301 }, (_, k) => { const t = (6 * k) / 300; return [f.sx(t), f.sy(t <= cc ? 0 : ((t - cc) ** 2) / 4)]; });
      for (let cc = 0; cc <= 4.01; cc += 0.5) polyline(g, member(cc), "stroke:var(--foreground);stroke-opacity:0.25;stroke-width:1");
      // RK4 from y = 0 sees f = 0 and never moves.
      const rk = solve((_, [y]) => [Math.sqrt(Math.abs(y))], 0, [0], 6, 120);
      polyline(g, rk.map(([t, [y]]) => [f.sx(t), f.sy(y)]), `stroke:${C.u};stroke-width:2;stroke-dasharray:5 4`);
      polyline(g, member(c), "stroke:var(--brand);stroke-width:2.5");
      el("circle", { cx: f.sx(c), cy: f.sy(0), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
      el("circle", { cx: f.sx(0), cy: f.sy(0), r: 4, style: "fill:var(--foreground)" }, svg);
      text(svg, f.sx(0) + 8, f.sy(0) - 8, "y(0) = 0", { "text-anchor": "start" });
      o.sol.textContent = `y = 0 for t ≤ ${fx(c, 2)}, (t − ${fx(c, 2)})²/4 after`;
      o.lip.textContent = "fails: ∂f/∂y = 1/(2√y) → ∞";
      o.tstar.textContent = `lift-off at t = ${fx(c, 2)}`;
      o.note.textContent = "Every member satisfies y′ = √|y| and y(0) = 0: check (t − c)²/4, whose derivative (t − c)/2 equals its square root. The numerical solver (dashed) can only ever find y ≡ 0, the one member where f = 0 at every step. Uniqueness fails because f is not Lipschitz at y = 0.";
      svg.setAttribute("aria-label", `y′ = √|y| with lift-off time ${fx(c, 2)}: ${o.sol.textContent}`);
    } else {
      const y0 = s.y0.get(), ts = 1 / y0, YM = 20, TM = 6;
      const f = frame(svg, { box: [44, 20, 496, 310], x: [0, TM], y: [0, YM], xticks: ticks(0, TM, 1), yticks: ticks(0, YM, 5), xlabel: "t", ylabel: "y" });
      const g = clipped(svg, f);
      for (const yy of [0.2, 0.3, 0.5, 1, 2]) {
        const t1 = 1 / yy;
        path(g, Array.from({ length: 401 }, (_, k) => { const t = Math.min(TM, t1 * 0.9999) * (k / 400); return [f.sx(t), f.sy(yy / (1 - yy * t))]; }), "stroke:var(--foreground);stroke-opacity:0.25;stroke-width:1", 1e6);
      }
      el("line", { x1: f.sx(ts), x2: f.sx(ts), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-del);stroke-width:1.25;stroke-dasharray:4 4" }, g);
      text(g, f.sx(ts) + 4, f.T + 12, `t* = 1/y₀ = ${fx(ts, 3)}`, { "text-anchor": "start" });
      path(g, Array.from({ length: 801 }, (_, k) => { const t = Math.min(TM, ts * 0.99999) * (k / 800); return [f.sx(t), f.sy(y0 / (1 - y0 * t))]; }), "stroke:var(--brand);stroke-width:2.5", 1e6);
      // A fixed-step RK4 run: fine until near t*, then it overflows.
      const rk = solve((_, [y]) => [y * y], 0, [y0], TM, 120, 1e6);
      for (const [t, [y]] of rk) if (y < YM * 1.5) el("circle", { cx: f.sx(t), cy: f.sy(y), r: 2.5, style: `fill:none;stroke:${C.u};stroke-width:1.25` }, g);
      const last = rk.at(-1);
      o.sol.textContent = `y = ${fx(y0, 2)} / (1 − ${fx(y0, 2)}t)`;
      o.lip.textContent = "holds on bounded sets (∂f/∂y = 2y)";
      o.tstar.textContent = `blow-up at t* = ${fx(ts, 3)}`;
      o.note.textContent = `f = y² is smooth, so a unique solution exists near t = 0, but only up to t* = 1/y₀: the solution leaves every bounded set in finite time. The fixed-step RK4 run (h = 0.05, circles) overflowed at t ≈ ${fx(last[0], 2)}; it cannot cross t* because nothing lies beyond it.`;
      svg.setAttribute("aria-label", `y′ = y² from y(0) = ${fx(y0, 2)}: blows up at t = ${fx(ts, 3)}`);
    }
  }

  onSeg(root, (_, v) => { eq = v; draw(); });
  draw();
}

// ============================================================ 9 Heat equation

const M = 240, MODES = 60;
const xs = Array.from({ length: M + 1 }, (_, i) => i / M);
const PROFILES = {
  tri: (x) => 1 - Math.abs(2 * x - 1),
  step: (x) => (x > 0.3 && x < 0.7 ? 1 : 0),
  two: (x) => Math.exp(-(((x - 0.25) / 0.06) ** 2)) + 0.7 * Math.exp(-(((x - 0.72) / 0.1) ** 2)),
};
/** Sine-series coefficients bₙ = 2∫₀¹ f sin nπx dx by the trapezoid rule. */
function sineCoeffs(f) {
  const b = new Float64Array(MODES + 1);
  for (let n = 1; n <= MODES; n++) {
    let sum = 0;
    for (let i = 1; i < M; i++) sum += f[i] * Math.sin(n * Math.PI * xs[i]);
    b[n] = (2 * sum) / M;
  }
  return b;
}

for (const root of document.querySelectorAll("[data-ode-heat]")) {
  const svg = plot(root), o = outs(root);
  let f0 = xs.map(PROFILES.tri), b = sineCoeffs(f0), fr = null;
  const s = scrubAll(root, batched(() => draw()));
  animator(root, root.querySelector('[data-action="play"]'), (dt) => {
    let t = s.t.get() + dt * 0.5;
    if (t >= 5) { s.t.set(5, false); draw(); return false; }
    s.t.set(t, false);
    draw();
  });

  const u = (x, t, k) => {
    let sum = 0;
    for (let n = 1; n <= MODES; n++) sum += b[n] * Math.exp(-n * n * Math.PI * Math.PI * k * t) * Math.sin(n * Math.PI * x);
    return sum;
  };

  function draw() {
    const k = s.k.get(), t = s.t.get();
    svg.replaceChildren();
    fr = frame(svg, { box: [44, 20, 430, 284], x: [0, 1], y: [-0.2, 1.25], xticks: ticks(0, 1, 0.25), yticks: ticks(0, 1, 0.5), xlabel: "x", ylabel: "u" });
    const g = clipped(svg, fr);
    polyline(g, xs.map((x, i) => [fr.sx(x), fr.sy(f0[i])]), `stroke:${C.v};stroke-width:1.5;stroke-dasharray:5 4`);
    let peak = 0;
    const pts = xs.map((x) => { const v = u(x, t, k); peak = Math.max(peak, v); return [fr.sx(x), fr.sy(v)]; });
    polyline(g, pts, "stroke:var(--brand);stroke-width:2.5");
    el("rect", { x: fr.L, y: fr.T + fr.H + 1, width: fr.W, height: 4, rx: 2, style: "fill:var(--foreground);fill-opacity:0.25" }, svg);

    // Mode sizes on a log scale: initial (faint) against now.
    const B = frame(svg, { box: [530, 20, 170, 284], x: [0.5, 15.5], y: [-5, 0], xticks: [1, 5, 10, 15], yticks: [-4, -2, 0], yfmt: (v) => (v === 0 ? "1" : `10${v === -2 ? "⁻²" : "⁻⁴"}`), xlabel: "mode n", ylabel: "|bₙ|" });
    const bw = B.W / 15 - 2;
    for (let n = 1; n <= 15; n++) {
      const a0 = Math.abs(b[n]), at = a0 * Math.exp(-n * n * Math.PI * Math.PI * k * t);
      const ly = (v) => B.sy(Math.max(-5, Math.log10(v || 1e-9)));
      el("rect", { x: B.sx(n) - bw / 2, y: ly(a0), width: bw, height: Math.max(0, B.T + B.H - ly(a0)), style: "fill:var(--foreground);fill-opacity:0.12" }, svg);
      el("rect", { x: B.sx(n) - bw / 2, y: ly(at), width: bw, height: Math.max(0, B.T + B.H - ly(at)), style: "fill:var(--brand);fill-opacity:0.85" }, svg);
    }
    const rate = Math.PI * Math.PI * k;
    o.modes.textContent = `${MODES} (bₙ by trapezoid rule)`;
    o.rate.textContent = `${fx(rate, 4)} per unit time`;
    o.peak.textContent = fx(peak, 4);
    o.m3.textContent = `${fx(100 * Math.exp(-9 * rate * t), 3)} % (mode 1: ${fx(100 * Math.exp(-rate * t), 2)} %)`;
    o.note.textContent = t === 0
      ? "At t = 0 the series reproduces the initial profile, with a small Gibbs overshoot at jumps. Press Play: mode n decays n² times faster than mode 1."
      : `After t = ${fx(t, 2)}, mode 1 keeps ${fx(100 * Math.exp(-rate * t), 1)} % of its size while mode 3 keeps ${fx(100 * Math.exp(-9 * rate * t), 2)} %. Mode 1 dominates once t ≫ 1/(8π²k) = ${fx(1 / (8 * rate), 2)}.`;
    svg.setAttribute("aria-label", `Heat equation at t = ${fx(t, 2)}, peak temperature ${fx(peak, 3)}`);
  }

  onSeg(root, (_, v) => {
    if (v !== "draw") { f0 = xs.map(PROFILES[v]); b = sineCoeffs(f0); }
    s.t.set(0, false);
    draw();
  });
  // Drawing on the rod: a soft brush lifts or lowers the profile under the pointer.
  let drawing = false, lastX = null;
  const paint = (e) => {
    const p = svgPoint(svg, e);
    if (!fr || p.x < fr.L - 4 || p.x > fr.L + fr.W + 4) return;
    const x = Math.max(0, Math.min(1, (p.x - fr.L) / fr.W));
    const v = Math.max(-0.2, Math.min(1.2, -0.2 + ((fr.T + fr.H - p.y) / fr.H) * 1.45));
    const from = lastX ?? x;
    const lo = Math.min(from, x), hi = Math.max(from, x);
    for (let i = 1; i < M; i++) if (xs[i] >= lo - 0.012 && xs[i] <= hi + 0.012) f0[i] = v;
    f0[0] = f0[M] = 0;
    lastX = x;
    b = sineCoeffs(f0);
    s.t.set(0, false);
    selectSeg(root, "Profile", "draw");
    draw();
  };
  svg.classList.add("cursor-crosshair");
  svg.addEventListener("pointerdown", (e) => { drawing = true; lastX = null; paint(e); });
  svg.addEventListener("pointermove", (e) => { if (drawing && e.buttons) paint(e); else drawing = false; });
  window.addEventListener("pointerup", () => { drawing = false; lastX = null; });
  draw();
}

// ============================================================ 10 Wave equation

for (const root of document.querySelectorAll("[data-ode-wave]")) {
  const svg = plot(root), o = outs(root);
  let halves = true;
  const s = scrubAll(root, batched(() => draw()));
  onToggle(root, (_, on) => { halves = on; draw(); });
  animator(root, root.querySelector('[data-action="play"]'), (dt) => {
    s.t.set((s.t.get() + dt * 0.25) % 2, false);
    draw();
  });

  function draw() {
    const p = s.p.get(), t = s.t.get();
    const f = (x) => (x <= p ? x / p : (1 - x) / (1 - p));
    // The odd, 2-periodic extension used by d'Alembert's formula.
    const F = (x) => { let y = ((x % 2) + 2) % 2; if (y > 1) return -f(2 - y); return f(y); };
    svg.replaceChildren();
    const fr = frame(svg, { box: [44, 20, 430, 284], x: [0, 1], y: [-1.15, 1.15], xticks: ticks(0, 1, 0.25), yticks: ticks(-1, 1, 0.5), yfmt: minus, xlabel: "x", ylabel: "u" });
    const g = clipped(svg, fr);
    el("line", { x1: fr.L, x2: fr.L + fr.W, y1: fr.sy(0), y2: fr.sy(0), style: "stroke:var(--foreground);stroke-opacity:0.2" }, g);
    const N = 400, X = Array.from({ length: N + 1 }, (_, k) => k / N);
    if (halves) {
      polyline(g, X.map((x) => [fr.sx(x), fr.sy(F(x - t) / 2)]), `stroke:${C.i};stroke-width:1.25;stroke-dasharray:5 4`);
      polyline(g, X.map((x) => [fr.sx(x), fr.sy(F(x + t) / 2)]), `stroke:${C.u};stroke-width:1.25;stroke-dasharray:5 4`);
    }
    polyline(g, X.map((x) => [fr.sx(x), fr.sy((F(x - t) + F(x + t)) / 2)]), "stroke:var(--brand);stroke-width:2.5");
    for (const x of [0, 1]) el("circle", { cx: fr.sx(x), cy: fr.sy(0), r: 4, style: "fill:var(--foreground)" }, svg);

    // Harmonics: bₙ = 2 sin(nπp) / (n²π² p(1 − p)).
    const bn = (n) => (2 * Math.sin(n * Math.PI * p)) / (n * n * Math.PI * Math.PI * p * (1 - p));
    const B = frame(svg, { box: [530, 20, 170, 284], x: [0.5, 12.5], y: [0, 1], xticks: [1, 4, 8, 12], yticks: [0, 0.5, 1], xlabel: "harmonic n", ylabel: "|bₙ|" });
    const bw = B.W / 12 - 3;
    const missing = [];
    for (let n = 1; n <= 12; n++) {
      const v = Math.abs(bn(n));
      if (v < 1e-9) missing.push(n);
      el("rect", { x: B.sx(n) - bw / 2, y: B.sy(Math.min(1, v)), width: bw, height: Math.max(0, B.T + B.H - B.sy(Math.min(1, v))), style: "fill:var(--brand);fill-opacity:0.85" }, svg);
    }
    // Series against d'Alembert at this instant, as a check.
    let err = 0;
    for (const x of [0.13, 0.37, 0.61, 0.88]) {
      let sum = 0;
      for (let n = 1; n <= 400; n++) sum += bn(n) * Math.sin(n * Math.PI * x) * Math.cos(n * Math.PI * t);
      err = Math.max(err, Math.abs(sum - (F(x - t) + F(x + t)) / 2));
    }
    o.b.textContent = [1, 2, 3].map((n) => fx(bn(n), 4)).join(", ");
    o.missing.textContent = missing.length ? `n = ${missing.join(", ")}` : "none up to 12";
    o.period.textContent = "ct = 2 (string length 1)";
    o.note.textContent = `Solid: the string, as the sum of the two dashed halves. The standing-wave series with 400 terms matches it to ${err.toExponential(0).replace("-", "−")} at this instant. ${missing.length ? `Plucked at p = ${fx(p, 2)}, every harmonic whose node sits at p vanishes.` : "Pluck at 1/2, 1/3 or 1/4 to silence harmonics."}`;
    svg.setAttribute("aria-label", `String plucked at ${fx(p, 2)} at time ${fx(t, 3)}; missing harmonics ${o.missing.textContent}`);
  }
  draw();
}
