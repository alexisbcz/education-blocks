// Behavioral economics blocks. Every number comes from the model named in
// the block: cumulative prospect theory (Tversky & Kahneman 1992), a
// multiple price list for λ, hyperbolic and exponential discounting, the
// β–δ planner of O'Donoghue & Rabin (1999), a default-and-inertia
// population, a WTA/WTP double auction, a logistic ultimatum responder,
// a rule-based public goods game and the secretary problem.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const eur = (v, d = 2) => (v < 0 ? "−€" : "€") + num(Math.abs(v), d);
const pct = (v, d = 0) => `${num(v * 100, d)}%`;
/** The value of the active segment in the tablist labelled label. */
const segOf = (root, label) => root.querySelector(`[role=tablist][aria-label="${label}"] [aria-selected="true"]`)?.dataset.seg;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Client coordinates to SVG user units. */
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

let clipN = 0;
function clipTo(svg, f) {
  const id = `behav-clip-${++clipN}`;
  const cp = el("clipPath", { id }, el("defs", {}, svg));
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, cp);
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

function dot(svg, x, y, color, r = 3.5) {
  return el("circle", { cx: x, cy: y, r, style: `fill:var(--background);stroke:${color};stroke-width:1.75` }, svg);
}

// niceTicks returns about n round values covering [lo, hi].
function niceTicks(lo, hi, n = 4) {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const fmt = (v) => String(+v.toFixed(3)).replace("-", "−");

// ============================================================ Prospect theory

/** The value function v(x) of cumulative prospect theory. */
export const ptValue = (x, a, l) => (x >= 0 ? x ** a : -l * (-x) ** a);
/** The Tversky–Kahneman (1992) probability weighting function. */
export const ptWeight = (p, g) => (p <= 0 ? 0 : p >= 1 ? 1 : p ** g / (p ** g + (1 - p) ** g) ** (1 / g));

for (const root of document.querySelectorAll("[data-behav-value]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  for (const b of root.querySelectorAll("[data-preset]")) {
    b.addEventListener("click", () => {
      const [a, l, g] = b.dataset.preset.split(" ").map(Number);
      s.alpha.set(a, false); s.lambda.set(l, false); s.gamma.set(g, false);
      draw();
    });
  }

  function draw() {
    const a = s.alpha.get(), l = s.lambda.get(), g = s.gamma.get();
    const p = s.p.get() / 100, win = s.win.get(), lose = s.lose.get();
    svg.replaceChildren();

    // Value function: x over ±X, y spanning whichever of v(x) and x is wider.
    const X = Math.max(win, lose, 100) * 1.2;
    const yTop = Math.max(X ** a, X), yBot = -Math.max(l * X ** a, X);
    const f = frame(svg, { box: [44, 16, 262, 232], x: [-X, X], y: [yBot, yTop], xticks: niceTicks(-X, X, 4), yticks: niceTicks(yBot, yTop, 4), xfmt: fmt, yfmt: fmt, xlabel: "outcome x (€)", ylabel: "value v(x)" });
    const gv = clipTo(svg, f);
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, gv);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, gv);
    polyline(gv, [[f.sx(-X), f.sy(-X)], [f.sx(X), f.sy(X)]], "stroke:var(--muted-foreground);stroke-dasharray:4 3;stroke-width:1.25");
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const x = -X + (2 * X * i) / 200;
      pts.push([f.sx(x), f.sy(ptValue(x, a, l))]);
    }
    polyline(gv, pts, "stroke:var(--brand);stroke-width:2;stroke-linejoin:round");
    dot(svg, f.sx(win), f.sy(ptValue(win, a, l)), "var(--brand)");
    dot(svg, f.sx(-lose), f.sy(ptValue(-lose, a, l)), "var(--brand)");
    text(svg, f.sx(X * 0.45), f.sy(ptValue(X * 0.45, a, l)) + 16, "gains: concave", { "text-anchor": "start" });
    text(svg, f.sx(-X) + 4, f.T + 12, "losses: steeper by λ", { "text-anchor": "start" });

    // Weighting function on the unit square.
    const w = frame(svg, { box: [372, 16, 232, 232], x: [0, 1], y: [0, 1], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 0.5, 1], xfmt: fmt, yfmt: fmt, xlabel: "probability p" });
    text(svg, 372 - 30, 10, "weight w(p)", { "text-anchor": "start" });
    polyline(svg, [[w.sx(0), w.sy(0)], [w.sx(1), w.sy(1)]], "stroke:var(--muted-foreground);stroke-dasharray:4 3;stroke-width:1.25");
    const wp = [];
    for (let i = 0; i <= 200; i++) wp.push([w.sx(i / 200), w.sy(ptWeight(i / 200, g))]);
    polyline(svg, wp, "stroke:var(--brand);stroke-width:2;stroke-linejoin:round");
    el("line", { x1: w.sx(p), x2: w.sx(p), y1: w.sy(0), y2: w.sy(ptWeight(p, g)), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:2 3" }, svg);
    dot(svg, w.sx(p), w.sy(ptWeight(p, g)), "var(--brand)");
    if (g < 0.95) {
      text(svg, w.sx(0.03), w.sy(0.92), "rare: overweighted", { "text-anchor": "start" });
      text(svg, w.sx(0.97), w.sy(0.06), "near-certain: underweighted", { "text-anchor": "end" });
    }

    // The mixed gamble: gains and losses weighted separately (CPT, n = 2).
    const wg = ptWeight(p, g), wl = ptWeight(1 - p, g);
    const V = wg * ptValue(win, a, l) + wl * ptValue(-lose, a, l);
    const ce = V >= 0 ? V ** (1 / a) : -((-V / l) ** (1 / a));
    const ev = p * win - (1 - p) * lose;
    o.V.textContent = `${num(V, 1)} (worth ${eur(ce)} for sure)`;
    o.w.textContent = `${num(wg, 3)} / ${num(wl, 3)}`;
    o.ev.textContent = eur(ev);
    o.verdict.textContent = V >= 0 ? (ev >= 0 ? "accept, as EV says" : "accept, though EV < 0") : ev > 0 ? "reject, though EV > 0" : "reject, as EV says";
  }
  draw();
}

// ============================================================ λ price list

const LAMBDA_MARKS = [
  { v: 1, label: "loss neutral" },
  { v: 1.97, label: "meta-analysis" },
  { v: 2.25, label: "Tversky & Kahneman" },
];

for (const root of document.querySelectorAll("[data-behav-lambda]")) {
  const rows = [...root.querySelectorAll("[data-row]")];
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);

  for (const row of rows) {
    for (const b of row.querySelectorAll("[data-choice]")) {
      b.addEventListener("click", () => {
        for (const x of row.querySelectorAll("[data-choice]")) x.setAttribute("aria-pressed", String(x === b));
        update();
      });
    }
  }
  root.querySelector("[data-action=fill]").addEventListener("click", () => {
    for (const row of rows) {
      const accept = Number(row.dataset.row) >= 200;
      for (const x of row.querySelectorAll("[data-choice]")) x.setAttribute("aria-pressed", String((x.dataset.choice === "accept") === accept));
    }
    update();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => {
    for (const x of root.querySelectorAll("[data-choice]")) x.setAttribute("aria-pressed", "false");
    update();
  });

  function update() {
    const ans = rows.map((r) => r.querySelector('[aria-pressed="true"]')?.dataset.choice);
    for (const r of rows) delete r.dataset.mark;
    const left = ans.filter((a) => !a).length;
    let lo = null, hi = null;
    if (left) {
      o.lambda.textContent = "—";
      o.msg.textContent = `${left} of ${rows.length} rows left.`;
    } else {
      const acc = ans.map((a) => a === "accept");
      const switches = acc.slice(1).filter((v, i) => v !== acc[i]).length;
      const first = acc.indexOf(true);
      if (switches > 1 || (switches === 1 && !acc[acc.length - 1])) {
        o.lambda.textContent = "?";
        o.msg.textContent = "Inconsistent: you rejected a gamble that pays more than one you accepted. Look again from the top.";
      } else if (first === -1) {
        lo = 4;
        o.lambda.textContent = "λ > 4";
        o.msg.textContent = "You rejected every gamble, even win €400 against lose €100: strongly loss averse, or wary of any risk.";
      } else if (first === 0) {
        hi = 1;
        o.lambda.textContent = "λ ≤ 1";
        o.msg.textContent = "You accepted even the fair coin flip: no loss aversion at these stakes.";
      } else {
        lo = Number(rows[first - 1].dataset.row) / 100;
        hi = Number(rows[first].dataset.row) / 100;
        rows[first].dataset.mark = "";
        o.lambda.textContent = `${num(lo, 2)} < λ ≤ ${num(hi, 2)}`;
        o.msg.textContent = `A loss of €100 needs a gain of about €${Math.round(((lo + hi) / 2) * 100)} to balance it.`;
      }
    }
    drawScale(lo, hi);
  }

  function drawScale(lo, hi) {
    svg.replaceChildren();
    const x0 = 0.5, x1 = 4.5, L = 12, W = 256, y = 30;
    const sx = (v) => L + ((clamp(v, x0, x1) - x0) / (x1 - x0)) * W;
    el("line", { x1: L, x2: L + W, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    for (const t of [1, 2, 3, 4]) {
      el("line", { x1: sx(t), x2: sx(t), y1: y - 3, y2: y + 3, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      text(svg, sx(t), y + 14, String(t), { "text-anchor": "middle" });
    }
    if (lo !== null || hi !== null) {
      const a = sx(lo ?? x0), b = sx(hi ?? x1);
      el("rect", { x: a, y: y - 9, width: Math.max(3, b - a), height: 18, rx: 3, style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-width:1.25" }, svg);
      text(svg, (a + b) / 2, y - 14, "you", { "text-anchor": "middle", style: "fill:var(--brand)" });
    }
    // Published values, each labelled on its own row below the axis.
    // Rightmost on top, so no leader line crosses a label.
    [...LAMBDA_MARKS].reverse().forEach((m, i) => {
      const ly = y + 30 + 12 * i;
      el("line", { x1: sx(m.v), x2: sx(m.v), y1: y + 18, y2: ly - 8, style: "stroke:var(--foreground);stroke-width:1;stroke-opacity:0.5" }, svg);
      el("line", { x1: sx(m.v), x2: sx(m.v), y1: y - 6, y2: y + 6, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
      text(svg, sx(m.v) + 3, ly, `${m.v} ${m.label}`, { "text-anchor": "start" });
    });
  }
  update();
}

// ============================================================ Discounting

/** Present value of amount A after delay d (days) at rate k. */
export const discount = (A, d, k, model) => (model === "exp" ? A * Math.exp(-k * d) : A / (1 + k * d));

for (const root of document.querySelectorAll("[data-behav-discount]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", draw);
  const T = 60;
  let f = null;

  const seek = (e) => {
    if (!f) return;
    const p = svgPoint(svg, e);
    s.now.set(clamp(Math.round(((p.x - f.L) / f.W) * T), 0, T));
  };
  svg.style.cursor = "ew-resize";
  svg.style.touchAction = "pan-y";
  svg.addEventListener("pointerdown", (e) => { svg.setPointerCapture(e.pointerId); seek(e); });
  svg.addEventListener("pointermove", (e) => { if (svg.hasPointerCapture(e.pointerId)) seek(e); });

  function draw() {
    const model = segOf(root, "Model") ?? "hyper";
    const k = s.k.get(), A = s.a.get(), B = s.b.get(), gap = s.gap.get(), now = s.now.get();
    const va = (t) => discount(A, T - t, k, model), vb = (t) => discount(B, T + gap - t, k, model);
    svg.replaceChildren();
    const ymax = Math.max(A, B) * 1.08;
    f = frame(svg, { box: [52, 24, 560, 222], x: [0, T], y: [0, ymax], xticks: [0, 10, 20, 30, 40, 50, 60], yticks: niceTicks(0, ymax, 4), yfmt: (v) => `€${fmt(v)}`, xlabel: "day you decide", ylabel: "what each reward is worth to you then" });
    const g = clipTo(svg, f);
    const ca = [], cb = [];
    let cross = null, prev = null;
    for (let i = 0; i <= 240; i++) {
      const t = (T * i) / 240;
      ca.push([f.sx(t), f.sy(va(t))]);
      cb.push([f.sx(t), f.sy(vb(t))]);
      const d = vb(t) - va(t);
      if (prev !== null && Math.sign(d) !== Math.sign(prev) && cross === null) cross = t;
      prev = d;
    }
    if (cross !== null) {
      el("rect", { x: f.sx(cross), y: f.T, width: f.sx(T) - f.sx(cross), height: f.H, style: "fill:var(--vec-u);fill-opacity:0.06" }, g);
      el("line", { x1: f.sx(cross), x2: f.sx(cross), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-dasharray:3 3;stroke-opacity:0.6" }, g);
      text(svg, f.sx(cross) + 4, f.T + 12, "preference reverses", { "text-anchor": "start" });
    }
    polyline(g, ca, "stroke:var(--vec-u);stroke-width:2");
    polyline(g, cb, "stroke:var(--brand);stroke-width:2");
    // The decision date.
    const x = f.sx(now);
    el("line", { x1: x, x2: x, y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
    dot(svg, x, f.sy(va(now)), "var(--vec-u)", 4);
    dot(svg, x, f.sy(vb(now)), "var(--brand)", 4);
    text(svg, clamp(x, f.L + 20, f.L + f.W - 20), f.T + f.H + 26, "drag", { "text-anchor": "middle", style: "fill:var(--foreground)" });
    text(svg, f.sx(T) - 4, f.sy(A) - 6, `€${fmt(A)} on day ${T}`, { "text-anchor": "end", style: "fill:var(--vec-u)" });

    const later = vb(now) > va(now);
    o.choice.textContent = later ? `wait for €${fmt(B)}` : `take €${fmt(A)} sooner`;
    o.vals.textContent = `${eur(va(now))} vs ${eur(vb(now))}`;
    o.cross.textContent = cross === null ? (model === "exp" ? "never (exponential)" : "never at this k") : num(cross, 1);
  }
  draw();
}

// ============================================================ β–δ planner

/**
 * plan returns the day (0-based) each agent acts on. vals are per-day costs
 * (incurred immediately) or rewards (received immediately); the task or
 * reward must be taken by the last day.
 */
export function plan(vals, beta, reward) {
  const n = vals.length;
  const better = (now, later) => (reward ? now >= beta * later : now <= beta * later);
  const best = (from) => {
    let b = from;
    for (let s = from; s < n; s++) if (reward ? vals[s] > vals[b] : vals[s] < vals[b]) b = s;
    return b;
  };
  // Time-consistent: the best day, from day 0's own point of view.
  const consistent = best(0);
  // Naive: each day expects a patient future self to act on the best later day.
  const naivePlans = [];
  let naive = n - 1;
  for (let t = 0; t < n; t++) {
    if (t === n - 1) { naive = t; break; }
    const s = best(t + 1);
    naivePlans.push(s);
    if (better(vals[t], vals[s])) { naive = t; break; }
  }
  // Sophisticated: backward induction over what future selves will really do.
  const sstar = new Array(n);
  sstar[n - 1] = n - 1;
  for (let t = n - 2; t >= 0; t--) sstar[t] = better(vals[t], vals[sstar[t + 1]]) ? t : sstar[t + 1];
  const sophPlans = sstar.map((_, t) => (t + 1 < n ? sstar[t + 1] : null));
  return { consistent, naive, naivePlans, soph: sstar[0], sophPlans };
}

for (const root of document.querySelectorAll("[data-behav-procrast]")) {
  const grid = root.querySelector("[data-grid]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", draw);

  const cell = (cls, txt, sub) => {
    const d = document.createElement("div");
    d.className = "flex min-h-14 flex-col justify-center gap-0.5 rounded-md border px-2 py-1.5 " + cls;
    d.append(Object.assign(document.createElement("span"), { textContent: txt }));
    if (sub) d.append(Object.assign(document.createElement("span"), { className: "font-mono text-[10px] text-muted-foreground", textContent: sub }));
    return d;
  };

  function draw() {
    const reward = segOf(root, "Situation") === "reward";
    const vals = [s.c1.get(), s.c2.get(), s.c3.get(), s.c4.get()];
    const beta = s.beta.get();
    const r = plan(vals, beta, reward);
    const verb = reward ? "takes it" : "does it";
    grid.replaceChildren();
    const head = (t, sub) => {
      const d = document.createElement("div");
      d.className = "flex flex-col gap-0.5 px-1 pb-1";
      d.append(Object.assign(document.createElement("span"), { className: "font-medium", textContent: t }));
      if (sub) d.append(Object.assign(document.createElement("span"), { className: "font-mono text-[11px] text-muted-foreground", textContent: sub }));
      return d;
    };
    grid.append(head(""));
    vals.forEach((v, i) => grid.append(head(`Day ${i + 1}`, `${reward ? "reward" : "cost"} ${fmt(v)}`)));
    const rows = [
      ["No present bias", "β = 1", r.consistent, () => null],
      ["Naive", `β = ${fmt(beta)}`, r.naive, (t) => r.naivePlans[t]],
      ["Sophisticated", `β = ${fmt(beta)}`, r.soph, (t) => r.sophPlans[t]],
    ];
    for (const [name, sub, day, plans] of rows) {
      grid.append(head(name, sub));
      for (let t = 0; t < vals.length; t++) {
        if (t === day) grid.append(cell("border-brand/50 bg-brand/10 font-medium text-brand", verb, `${reward ? "+" : "−"}${fmt(vals[t])}`));
        else if (t < day) {
          const p = plans(t);
          grid.append(cell("border-dashed text-muted-foreground", "waits", p === null ? "" : `plans day ${p + 1}`));
        } else grid.append(cell("border-transparent text-muted-foreground/40", "·"));
      }
    }
    if (!reduced()) {
      for (const c of grid.querySelectorAll(".bg-brand\\/10")) c.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(0.23,1,0.32,1)" });
    }
    const tot = (d) => fmt(vals[d]);
    o.story.textContent = reward
      ? `Rewards collected: patient ${tot(r.consistent)}, naive ${tot(r.naive)}, sophisticated ${tot(r.soph)}. ${r.soph < r.naive ? "Knowing they would cave later, the sophisticate grabs the reward early: preproperation." : ""}`
      : `Costs paid: patient ${tot(r.consistent)}, naive ${tot(r.naive)}, sophisticated ${tot(r.soph)}. ${r.naive > r.soph ? "The naive self keeps planning on a tomorrow that never comes; the sophisticate, knowing that, acts sooner." : ""}`;
  }
  draw();
}

// ============================================================ Defaults

// Inverse standard normal CDF by bisection on erf (Abramowitz–Stegun 7.1.26).
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function PhiInv(p) {
  let lo = -8, hi = 8;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    Phi(m) < p ? (lo = m) : (hi = m);
  }
  return (lo + hi) / 2;
}

/** Who ends up enrolled under each policy. */
export function enrol(people, policy) {
  return people.map(({ u, c }) => (policy === "in" ? u > c : policy === "out" ? u > -c : u > 0));
}

for (const root of document.querySelectorAll("[data-behav-defaults]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", draw);
  let seed = 11;
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); draw(); });

  const COLS = 25, N = 400;
  let base = [], dots = [];
  function build() {
    const rnd = mulberry32(seed);
    base = Array.from({ length: N }, () => {
      const z = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
      return { z, e: -Math.log(1 - rnd()) };
    }).sort((a, b) => b.z - a.z);
    svg.replaceChildren();
    const ease = reduced() ? "" : "transition:fill 260ms cubic-bezier(0.23,1,0.32,1),stroke 260ms cubic-bezier(0.23,1,0.32,1),r 260ms cubic-bezier(0.23,1,0.32,1);";
    dots = base.map((_, i) => {
      const cx = 14 + (i % COLS) * 25.5, cy = 12 + Math.floor(i / COLS) * 19.4;
      const ring = el("circle", { cx, cy, r: 8.5, style: ease + "fill:none;stroke-width:1.5;stroke:transparent" }, svg);
      const d = el("circle", { cx, cy, r: 5.5, style: ease + "stroke-width:1.25" }, svg);
      return { d, ring };
    });
  }

  function draw() {
    const policy = segOf(root, "Default") ?? "in";
    const mu = PhiInv(s.share.get() / 100), k = s.inertia.get();
    const people = base.map(({ z, e }) => ({ u: mu + z, c: k * e }));
    const on = enrol(people, policy);
    let stuck = 0;
    people.forEach((p, i) => {
      const bad = on[i] !== p.u > 0;
      if (bad) stuck++;
      dots[i].d.style.fill = on[i] ? "var(--brand)" : "transparent";
      dots[i].d.style.stroke = on[i] ? "var(--brand)" : "var(--muted-foreground)";
      dots[i].ring.style.stroke = bad ? "var(--code-del)" : "transparent";
    });
    const share = (pol) => enrol(people, pol).filter(Boolean).length / N;
    o.enrolled.textContent = `${on.filter(Boolean).length} of ${N} (${pct(share(policy))})`;
    o.stuck.textContent = `${stuck} (${pct(stuck / N)})`;
    o.gap.textContent = `${pct(share("in"))} vs ${pct(share("out"))}`;
  }
  build();
  draw();
}

// ============================================================ Endowment effect

/** Competitive trades between owners' asks and buyers' bids. */
export function market(asks, bids) {
  const sa = [...asks].sort((a, b) => a - b), sb = [...bids].sort((a, b) => b - a);
  let q = 0;
  while (q < sa.length && q < sb.length && sb[q] >= sa[q]) q++;
  const lo = q ? Math.max(sa[q - 1], sb[q] ?? 0) : null;
  const hi = q ? Math.min(sb[q - 1], sa[q] ?? Infinity) : null;
  return { q, sa, sb, lo, hi };
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

for (const root of document.querySelectorAll("[data-behav-endow]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let seed = 5;
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const n = Math.round(s.n.get()), ratio = s.ratio.get();
    const rnd = mulberry32(seed * 7919 + n);
    const own = Array.from({ length: n }, () => 10 * rnd()), buy = Array.from({ length: n }, () => 10 * rnd());
    const asks = own.map((v) => v * ratio);
    const m = market(asks, buy), m0 = market(own, buy);
    svg.replaceChildren();
    const ymax = Math.max(10, ...asks) * 1.05;
    const f = frame(svg, { box: [48, 20, 568, 230], x: [0, n], y: [0, ymax], xticks: niceTicks(0, n, 6), yticks: niceTicks(0, ymax, 4), yfmt: (v) => `€${fmt(v)}`, xlabel: "mugs", ylabel: "price" });
    const g = clipTo(svg, f);
    const steps = (vals) => {
      const pts = [];
      vals.forEach((v, i) => { pts.push([f.sx(i), f.sy(v)], [f.sx(i + 1), f.sy(v)]); });
      return pts;
    };
    if (m.q) el("rect", { x: f.sx(0), y: f.T, width: f.sx(m.q) - f.sx(0), height: f.H, style: "fill:var(--brand);fill-opacity:0.06" }, g);
    // Where trade would stop with no endowment effect.
    el("line", { x1: f.sx(m0.q), x2: f.sx(m0.q), y1: f.T, y2: f.T + f.H, style: "stroke:var(--muted-foreground);stroke-dasharray:3 3" }, g);
    text(svg, f.sx(m0.q) + 4, f.T + 12, `no effect: ${m0.q}`, { "text-anchor": "start" });
    polyline(g, steps(m.sb), "stroke:var(--vec-u);stroke-width:2");
    polyline(g, steps(m.sa), "stroke:var(--brand);stroke-width:2");
    if (m.q) {
      el("line", { x1: f.sx(m.q), x2: f.sx(m.q), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.25" }, g);
      text(svg, f.sx(m.q) - 4, f.T + 26, `${m.q} trade${m.q === 1 ? "" : "s"}`, { "text-anchor": "end", style: "fill:var(--brand)" });
    }
    o.trades.textContent = `${m.q} of ${n} mugs`;
    o.coase.textContent = `${m0.q} (about n/2 = ${num(n / 2, 0)})`;
    o.wta.textContent = eur(median(asks));
    o.wtp.textContent = eur(median(buy));
    o.price.textContent = m.q ? `${eur(m.lo)} – ${eur(m.hi)}` : "no trade";
  }
  draw();
}

// ============================================================ Ultimatum

const DICTATOR = [
  { label: "nothing", share: 0.3611 },
  { label: "some, not half", share: 1 - 0.3611 - 0.1674 - 0.0544 },
  { label: "half", share: 0.1674 },
  { label: "everything", share: 0.0544 },
];
/** P(responder accepts an offer of share s), half rejecting at mid. */
export const accept = (s, mid, w = 0.05) => 1 / (1 + Math.exp(-(s - mid) / w));

for (const root of document.querySelectorAll("[data-behav-ultimatum]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const ultOnly = root.querySelector("[data-ult-only]");
  const legend = root.querySelector('[data-legend="ultimatum"]');
  const s = scrubAll(root, () => { o.plays.textContent = ""; draw(); });
  root.addEventListener("seg-change", () => { o.plays.textContent = ""; draw(); });
  let seed = 1;
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    const sh = s.offer.get() / 100, rnd = mulberry32(++seed);
    let yes = 0;
    for (let i = 0; i < 20; i++) if (rnd() < accept(sh, s.mid.get() / 100)) yes++;
    o.plays.textContent = `${yes} of 20 accepted · you kept ${eur(yes * 10 * (1 - sh))} of €200`;
  });

  function draw() {
    const game = segOf(root, "Game") ?? "ultimatum";
    const sh = s.offer.get() / 100, mid = s.mid.get() / 100;
    ultOnly.hidden = game !== "ultimatum";
    legend.hidden = game !== "ultimatum";
    svg.replaceChildren();
    if (game === "ultimatum") {
      const fa = frame(svg, { box: [52, 26, 560, 92], x: [0, 1], y: [0, 1], xticks: [], yticks: [0, 0.5, 1], yfmt: pct, ylabel: "P(accept)" });
      const fe = frame(svg, { box: [52, 156, 560, 100], x: [0, 1], y: [0, 10], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0, 5, 10], xfmt: pct, yfmt: (v) => `€${v}`, xlabel: "share offered" });
      text(svg, 4, 142, "you expect to keep", { "text-anchor": "start" });
      const pa = [], pe = [];
      let best = 0, bestE = -1;
      for (let i = 0; i <= 200; i++) {
        const x = i / 200, p = accept(x, mid), e = 10 * (1 - x) * p;
        pa.push([fa.sx(x), fa.sy(p)]);
        pe.push([fe.sx(x), fe.sy(e)]);
        if (e > bestE) { bestE = e; best = x; }
      }
      polyline(svg, pa, "stroke:var(--vec-u);stroke-width:2");
      polyline(svg, pe, "stroke:var(--brand);stroke-width:2");
      polyline(svg, [[fe.sx(0), fe.sy(10)], [fe.sx(1), fe.sy(0)]], "stroke:var(--muted-foreground);stroke-dasharray:4 3;stroke-width:1");
      text(svg, fe.sx(0.5), fe.sy(6.2), "if nobody ever rejected", { "text-anchor": "start" });
      el("line", { x1: fe.sx(best), x2: fe.sx(best), y1: fe.sy(0), y2: fe.sy(bestE), style: "stroke:var(--brand);stroke-dasharray:2 3;stroke-opacity:0.6" }, svg);
      text(svg, fe.sx(best) + 4, fe.sy(bestE) - 6, `best ${pct(best)}`, { "text-anchor": "start", style: "fill:var(--brand)" });
      const x = fa.sx(sh);
      el("line", { x1: x, x2: x, y1: fa.T, y2: fe.T + fe.H, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
      dot(svg, x, fa.sy(accept(sh, mid)), "var(--vec-u)", 4);
      dot(svg, x, fe.sy(10 * (1 - sh) * accept(sh, mid)), "var(--brand)", 4);
      o.pa.textContent = pct(accept(sh, mid), 1);
      o.ep.textContent = eur(10 * (1 - sh) * accept(sh, mid));
      o.best.textContent = `${pct(best)} → ${eur(bestE)}`;
    } else {
      const f = frame(svg, { box: [52, 18, 560, 224], x: [0, 4], y: [0, 0.5], xticks: [], yticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yfmt: pct, ylabel: "share of dictators who give…" });
      const mine = sh === 0 ? 0 : sh === 0.5 ? 2 : sh === 1 ? 3 : 1;
      DICTATOR.forEach((b, i) => {
        const x = f.sx(i + 0.15), w = f.sx(0.7) - f.sx(0);
        const r = el("rect", { x, y: f.sy(b.share), width: w, height: f.sy(0) - f.sy(b.share), rx: 3, style: `fill:${i === mine ? "var(--brand)" : "var(--muted-foreground)"};fill-opacity:${i === mine ? 0.85 : 0.35}` }, svg);
        if (!reduced()) {
          r.style.transformOrigin = `0 ${f.sy(0)}px`;
          r.animate([{ transform: "scaleY(0)" }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.23,1,0.32,1)" });
        }
        text(svg, x + w / 2, f.sy(b.share) - 6, pct(b.share), { "text-anchor": "middle", style: "fill:var(--foreground)" });
        text(svg, x + w / 2, f.sy(0) + 14, b.label, { "text-anchor": "middle" });
      });
      text(svg, f.L + f.W, f.T + 8, "Engel (2011): 616 treatments, mean gift 28%", { "text-anchor": "end" });
      o.pa.textContent = "no veto";
      o.ep.textContent = eur(10 * (1 - sh));
      o.best.textContent = "€0 if purely selfish";
    }
  }
  draw();
}

// ============================================================ Public goods

const PG = { E: 20, mpcr: 0.4, rounds: 10, cost: 1, hit: 3 };
const PG_COLORS = ["var(--brand)", "var(--vec-u)", "var(--vec-v)", "var(--muted-foreground)"];
const PG_NAMES = ["you", "A", "B", "free rider"];

/**
 * pgRound plays one round. prev is the previous round (or null); you and
 * yourPunish are your contribution and the points you give the lowest of
 * the others. Bots: two conditional cooperators who give 90% of what the
 * others gave last round, and a free rider who gives little unless punished.
 */
export function pgRound(prev, you, yourPunish, punishOn) {
  const avgOthers = (i) => (prev ? prev.c.filter((_, j) => j !== i).reduce((a, b) => a + b, 0) / 3 : null);
  const c = [
    you,
    prev ? Math.round(clamp(0.9 * avgOthers(1) + 1, 0, PG.E)) : 14,
    prev ? Math.round(clamp(0.9 * avgOthers(2), 0, PG.E)) : 12,
    !prev ? 2 : punishOn && prev.recv[3] >= 2 ? Math.round(clamp(avgOthers(3) * (0.55 + 0.05 * prev.recv[3]), 0, PG.E)) : Math.max(0, prev.c[3] - 2),
  ];
  const pot = c.reduce((a, b) => a + b, 0);
  const give = [0, 0, 0, 0], recv = [0, 0, 0, 0];
  if (punishOn) {
    const avg = pot / 4;
    // You punish the lowest of the others (ties: the free rider).
    let low = 3;
    for (const j of [1, 2]) if (c[j] < c[low]) low = j;
    if (yourPunish > 0) { give[0] += yourPunish; recv[low] += yourPunish; }
    // Cooperators punish anyone well below the group average.
    for (const i of [1, 2]) {
      for (let j = 0; j < 4; j++) {
        if (j === i || c[j] >= avg - 2) continue;
        const pts = Math.min(4, Math.round((avg - c[j]) / 4));
        give[i] += pts; recv[j] += pts;
      }
    }
  }
  const earn = c.map((ci, i) => PG.E - ci + PG.mpcr * pot - PG.cost * give[i] - PG.hit * recv[i]);
  return { c, earn, give, recv };
}

for (const root of document.querySelectorAll("[data-behav-pgg]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  let rounds = [];
  const punishOn = () => segOf(root, "Punishment") === "on";
  const play = () => {
    if (rounds.length >= PG.rounds) return;
    rounds.push(pgRound(rounds.at(-1) ?? null, s.give.get(), punishOn() ? s.punish.get() : 0, punishOn()));
  };
  root.querySelector("[data-action=round]").addEventListener("click", () => { play(); draw(); });
  root.querySelector("[data-action=auto]").addEventListener("click", () => { while (rounds.length < PG.rounds) play(); draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { rounds = []; draw(); });
  root.addEventListener("seg-change", () => { rounds = []; draw(); });

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 18, 572, 236], x: [0.5, PG.rounds + 0.5], y: [0, PG.E], xticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], yticks: [0, 5, 10, 15, 20], xlabel: "round", ylabel: "tokens contributed" });
    if (!rounds.length) text(svg, f.L + f.W / 2, f.T + f.H / 2, "Set your contribution and play a round", { "text-anchor": "middle" });
    // Players drawn back to front so you stay on top; offsets keep ties apart.
    for (const i of [3, 2, 1, 0]) {
      const pts = rounds.map((r, t) => [f.sx(t + 1) + (i - 1.5) * 2, f.sy(r.c[i])]);
      if (pts.length > 1) polyline(svg, pts, `stroke:${PG_COLORS[i]};stroke-width:${i === 0 ? 2.25 : 1.5}`);
      for (const [x, y] of pts) dot(svg, x, y, PG_COLORS[i], i === 0 ? 3.5 : 2.75);
    }
    const last = rounds.at(-1);
    const mine = rounds.reduce((a, r) => a + r.earn[0], 0);
    o.round.textContent = `${rounds.length} / ${PG.rounds}`;
    o.earn.textContent = rounds.length ? `${num(mine, 1)} tokens` : "—";
    o.avg.textContent = last ? `${num(last.c.reduce((a, b) => a + b, 0) / 4, 1)} of ${PG.E}` : "—";
    o.opt.textContent = `${PG.rounds * (PG.mpcr * 4 * PG.E)} tokens each`;
    if (last) {
      const hits = last.recv.map((p, i) => (p ? `${PG_NAMES[i]} −${p * PG.hit}` : null)).filter(Boolean);
      o.log.textContent = `Round ${rounds.length}: ` + last.c.map((c, i) => `${PG_NAMES[i]} ${c}`).join(", ") + (hits.length ? ` · punished: ${hits.join(", ")}` : "");
    } else o.log.textContent = "";
  }
  draw();
}

// ============================================================ Secretary

/** Exact P(hire the best | skip the first r of n, then take the first record). */
export function pBest(r, n) {
  if (r === 0) return 1 / n;
  let sum = 0;
  for (let i = r + 1; i <= n; i++) sum += 1 / (i - 1);
  return (r / n) * sum;
}

const topCache = new Map();
/** Simulated P(the hire is in the top 10%) for every r, seeded per n. */
function pTop(n) {
  if (topCache.has(n)) return topCache.get(n);
  const rnd = mulberry32(n * 31 + 7), T = 800, cut = Math.max(1, Math.ceil(n / 10));
  const out = new Array(n).fill(0);
  const xs = new Float64Array(n);
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < n; i++) xs[i] = rnd();
    const sorted = Float64Array.from(xs).sort();
    const threshold = sorted[n - cut];
    let max = -1;
    for (let r = 0; r < n; r++) {
      // Skip r, then take the first record (or the last one).
      let pick = n - 1;
      for (let i = r; i < n; i++) if (xs[i] > max) { pick = i; break; }
      if (xs[pick] >= threshold) out[r]++;
      if (xs[r] > max) max = xs[r];
    }
  }
  const res = out.map((v) => v / T);
  topCache.set(n, res);
  return res;
}

for (const root of document.querySelectorAll("[data-behav-secretary]")) {
  const svg = root.querySelector("[data-plot]");
  const strip = root.querySelector("[data-strip]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const btnNext = root.querySelector("[data-action=next]"), btnHire = root.querySelector("[data-action=hire]");
  root.querySelector("[data-action=new]").addEventListener("click", newGame);
  btnNext.addEventListener("click", () => { if (game.at < 19) { game.at++; render(); } });
  btnHire.addEventListener("click", () => hire(game.at));

  function draw() {
    const n = Math.round(s.n.get()), r = Math.min(Math.round(s.r.get()), n - 1);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 572, 196], x: [0, n - 1], y: [0, 1], xticks: niceTicks(0, n - 1, 6), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: pct, xlabel: "candidates looked at before hiring (r)", ylabel: "P(success)" });
    const top = pTop(n);
    const pb = Array.from({ length: n }, (_, k) => pBest(k, n));
    el("line", { x1: f.sx(n / Math.E), x2: f.sx(n / Math.E), y1: f.T, y2: f.T + f.H, style: "stroke:var(--muted-foreground);stroke-dasharray:3 3" }, svg);
    text(svg, f.sx(n / Math.E) + 4, f.T + 10, "n/e", { "text-anchor": "start" });
    polyline(svg, top.map((v, k) => [f.sx(k), f.sy(v)]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, pb.map((v, k) => [f.sx(k), f.sy(v)]), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.sx(r), x2: f.sx(r), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.25" }, svg);
    dot(svg, f.sx(r), f.sy(pb[r]), "var(--brand)", 4);
    dot(svg, f.sx(r), f.sy(top[r]), "var(--vec-u)", 4);
    const argmax = (xs) => xs.reduce((b, v, i) => (v > xs[b] ? i : b), 0);
    const rb = argmax(pb), rt = argmax(top);
    o.pbest.textContent = pct(pb[r], 1);
    o.ptop.textContent = `${pct(top[r], 1)} (simulated)`;
    o.rstar.textContent = `best ${rb} (${pct(pb[rb], 1)}) · top 10% ${rt}`;
  }

  // The game: 20 candidates with distinct scores, revealed one at a time.
  let game, played = 0, won = 0;
  function newGame() {
    const set = new Set();
    while (set.size < 20) set.add(1 + Math.floor(Math.random() * 99));
    game = { scores: [...set].sort(() => Math.random() - 0.5), at: 0, hired: null };
    render();
  }
  function hire(i) {
    if (game.hired !== null) return;
    game.hired = i;
    const rank = 1 + game.scores.filter((v) => v > game.scores[i]).length;
    played++;
    if (rank === 1) won++;
    o.game.textContent = rank === 1 ? `You hired ${game.scores[i]}: the best of all 20.` : `You hired ${game.scores[i]}, the ${ord(rank)} best; the best was ${Math.max(...game.scores)}.`;
    render();
  }
  const ord = (k) => k + (k % 10 === 1 && k !== 11 ? "st" : k % 10 === 2 && k !== 12 ? "nd" : k % 10 === 3 && k !== 13 ? "rd" : "th");
  function render() {
    const done = game.hired !== null;
    strip.replaceChildren();
    let max = -1;
    game.scores.forEach((v, i) => {
      const seen = i <= game.at || done;
      const record = seen && v > max && i <= game.at;
      if (i <= game.at) max = Math.max(max, v);
      const d = document.createElement("div");
      d.className = "flex aspect-square items-center justify-center rounded-md border font-mono text-xs tabular-nums transition-colors duration-150 " +
        (i === game.hired ? "border-brand bg-brand/15 text-brand font-medium" : i === game.at && !done ? "border-ring ring-[3px] ring-ring/50" : seen ? (i > game.at ? "text-muted-foreground/60 border-dashed" : "") : "bg-muted/50 text-transparent");
      d.textContent = seen ? String(v) : "?";
      if (record && !done) d.title = "best so far";
      if (record && !done && i === game.at) d.className += " text-brand";
      strip.append(d);
    });
    btnNext.disabled = done || game.at >= 19;
    btnHire.disabled = done;
    if (!done) {
      const cur = game.scores[game.at], best = Math.max(...game.scores.slice(0, game.at + 1));
      o.game.textContent = `Candidate ${game.at + 1} of 20 scores ${cur}${cur === best ? ", the best so far" : `; best so far ${best}`}.${game.at === 19 ? " The last one: you must hire." : ""}`;
    }
    o.games.textContent = played ? `${won} of ${played} best (${pct(won / played)})` : "—";
  }
  newGame();
  draw();
}

// ============================================================ Replication

for (const root of document.querySelectorAll("[data-behav-replication]")) {
  const items = [...root.querySelectorAll("[data-status]")];
  const o = outs(root);
  root.addEventListener("seg-change", (e) => {
    const v = e.detail.value;
    let n = 0;
    for (const it of items) {
      const show = v === "all" || it.dataset.status === v;
      it.hidden = !show;
      if (show) n++;
    }
    o.count.textContent = `${n} finding${n === 1 ? "" : "s"}`;
  });
}
