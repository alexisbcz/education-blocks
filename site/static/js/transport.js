// Transport and urban systems blocks: the fundamental diagram, the
// Nagel–Schreckenberg automaton, kinematic waves at a signal, Braess's
// paradox, selfish vs optimal routing, bus bunching, Webster's cycle,
// walking isochrones, urban scaling and commuting emissions. Every number
// is computed from the model the block states; towns and cities are
// synthetic.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const plotOf = (root, name) => root.querySelector(`[data-plot="${name}"]`);
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));
const onToggle = (root, name, fn) =>
  root.querySelector(`[data-toggle="${name}"]`)?.addEventListener("shadcn:checked-change", (e) => fn(e.detail.checked));
const int = (v) => Math.round(v).toLocaleString("en-US");
const range = (a, b, step) => { const r = []; for (let v = a; v <= b + 1e-9; v += step) r.push(+v.toFixed(6)); return r; };
const sample = (a, b, fn, n = 80) => range(0, n, 1).map((i) => { const x = a + ((b - a) * i) / n; return [x, fn(x)]; });

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// A clip path to the plot box, so lines stop at the frame.
let clipN = 0;
function clipped(svg, f) {
  const id = `trans-clip-${++clipN}`;
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, el("clipPath", { id }, el("defs", {}, svg)));
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

// player wires a play/pause button to a frame loop. tick(dt) gets seconds;
// the loop stops when the block scrolls out of view. Nothing autoplays.
function player(root, tick) {
  const btn = root.querySelector('[data-action="play"]');
  let raf = 0, last = 0;
  const icons = (on) => {
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", on);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !on);
    btn.setAttribute("aria-pressed", String(on));
  };
  const loop = (t) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    tick(dt);
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (raf) return; last = 0; icons(true); raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; icons(false); };
  btn.addEventListener("click", () => (raf ? stop() : start()));
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && raf) stop(); }).observe(root);
  return { stop };
}

// ---------------------------------------------------------------- T1

function fundamental(root) {
  const qs = plotOf(root, "q"), vs = plotOf(root, "v"), o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const vf = s.vf.get(), kj = s.kj.get(), k = Math.min(s.k.get(), kj);
    const V = (x) => vf * (1 - x / kj), Q = (x) => x * V(x);
    const kc = kj / 2, qmax = (vf * kj) / 4;
    qs.replaceChildren();
    vs.replaceChildren();

    const ymax = Math.max(1000, Math.ceil((qmax * 1.2) / 1000) * 1000);
    const f = frame(qs, {
      box: [52, 30, 332, 234], x: [0, 200], y: [0, ymax],
      xticks: range(0, 200, 40), yticks: range(0, ymax, ymax > 4000 ? 2000 : 1000), yfmt: int,
      xlabel: "density k (veh/km)", ylabel: "flow q (veh/h)",
    });
    const P = (pts) => pts.map(([x, y]) => [f.sx(x), f.sy(y)]);
    el("line", { x1: f.sx(kc), x2: f.sx(kc), y1: f.sy(0), y2: f.sy(qmax), style: "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:2 3" }, qs);
    text(qs, f.sx(kc), f.sy(qmax) - 8, "capacity", { "text-anchor": "middle" });
    polyline(qs, P(sample(0, kc, Q)), "stroke:var(--vec-u);stroke-width:2.2");
    polyline(qs, P(sample(kc, kj, Q)), "stroke:var(--code-del);stroke-width:2.2");
    // The ray from the origin has slope q/k = v: the speed.
    const q = Q(k), twin = kj - k;
    el("line", { x1: f.sx(0), y1: f.sy(0), x2: f.sx(k), y2: f.sy(q), style: "stroke:var(--brand);stroke-width:1.2;stroke-dasharray:4 3" }, qs);
    if (Math.abs(twin - k) > 1) {
      el("line", { x1: f.sx(k), x2: f.sx(twin), y1: f.sy(q), y2: f.sy(q), style: "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:2 3" }, qs);
      el("circle", { cx: f.sx(twin), cy: f.sy(q), r: 4.5, style: "fill:var(--background);stroke:currentColor;stroke-opacity:.6;stroke-width:1.5" }, qs);
      text(qs, f.sx(twin) + 8, f.sy(q) + 14, "same flow", { "text-anchor": "start" });
    }
    el("circle", { cx: f.sx(k), cy: f.sy(q), r: 5.5, style: "fill:var(--brand)" }, qs);

    const g = frame(vs, {
      box: [40, 30, 206, 234], x: [0, 200], y: [0, 140],
      xticks: range(0, 200, 50), yticks: range(0, 140, 20),
      xlabel: "k (veh/km)", ylabel: "speed v (km/h)",
    });
    const Pv = (pts) => pts.map(([x, y]) => [g.sx(x), g.sy(y)]);
    polyline(vs, Pv(sample(0, kc, V, 4)), "stroke:var(--vec-u);stroke-width:2.2");
    polyline(vs, Pv(sample(kc, kj, V, 4)), "stroke:var(--code-del);stroke-width:2.2");
    el("circle", { cx: g.sx(k), cy: g.sy(V(k)), r: 5.5, style: "fill:var(--brand)" }, vs);

    o.v.textContent = `${num(V(k), 0)} km/h`;
    o.q.textContent = `${int(q)} veh/h`;
    o.qmax.textContent = `${int(qmax)} veh/h`;
    o.kc.textContent = `${num(kc, 0)} veh/km`;
    o.regime.textContent = Math.abs(k - kc) < 0.5 ? "at capacity" : k < kc ? "free flow (stable)" : k >= kj ? "jammed" : "congested";
  }
  draw();
}

// ---------------------------------------------------------------- T2

function nasch(root) {
  const L = 200, VMAX = 5, ROWS = 100;
  const canvas = root.querySelector("[data-canvas]"), o = outs(root);
  canvas.width = L;
  canvas.height = ROWS;
  const ctx = canvas.getContext("2d");
  let seed = 7, rand, road, hist, acc = 0;
  const s = scrubAll(root, init);

  function init() {
    rand = rng(seed);
    road = new Int8Array(L).fill(-1);
    const idx = [...Array(L).keys()];
    for (let i = L - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const n = Math.max(1, Math.round(s.density.get() * L));
    for (let i = 0; i < n; i++) road[idx[i]] = 0;
    hist = [road];
    for (let i = 1; i < ROWS; i++) step();
    draw();
  }

  // One second: accelerate, keep the gap, hesitate, move.
  function step() {
    const p = s.p.get(), next = new Int8Array(L).fill(-1);
    for (let i = 0; i < L; i++) {
      let v = road[i];
      if (v < 0) continue;
      v = Math.min(v + 1, VMAX);
      let gap = 0;
      while (gap < v && road[(i + gap + 1) % L] < 0) gap++;
      v = Math.min(v, gap);
      if (v > 0 && rand() < p) v--;
      next[(i + v) % L] = v;
    }
    road = next;
    hist.push(road);
    if (hist.length > ROWS) hist.shift();
  }

  function draw() {
    const css = getComputedStyle(root);
    ctx.clearRect(0, 0, L, ROWS);
    for (const [stopped, color] of [[false, "--foreground"], [true, "--code-del"]]) {
      ctx.fillStyle = css.getPropertyValue(color).trim();
      hist.forEach((row, y) => { for (let x = 0; x < L; x++) if (row[x] >= 0 && (row[x] === 0) === stopped) ctx.fillRect(x, y, 1, 1); });
    }
    // Averages over the last 50 seconds.
    let cars = 0, sum = 0, halted = 0;
    for (const row of hist.slice(-50)) for (const v of row) if (v >= 0) { cars++; sum += v; if (v === 0) halted++; }
    const n = hist.at(-1).reduce((c, v) => c + (v >= 0), 0);
    const kmh = (sum / cars) * 27; // 7.5 m/s per cell per step
    o.n.textContent = `${n} (${num(n / 1.5, 0)} veh/km)`;
    o.speed.textContent = `${num(kmh, 0)} km/h`;
    o.flow.textContent = `${int((n / 1.5) * kmh)} veh/h`;
    o.stopped.textContent = `${num((100 * halted) / cars, 0)}%`;
  }

  root.querySelector('[data-action="reseed"]').addEventListener("click", () => { seed = (seed * 48271) % 2147483647; init(); });
  player(root, (dt) => {
    acc += dt * 12;
    if (acc < 1) return;
    while (acc >= 1) { step(); acc--; }
    draw();
  });
  init();
}

// ---------------------------------------------------------------- T3

function shockwave(root) {
  const VF = 100, KJ = 120, KC = 60, QMAX = 3000;
  const svg = plotOf(root, "ts"), o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const kA = s.ka.get(), R = s.red.get();
    const vA = VF * (1 - kA / KJ), qA = kA * vA;
    // Shock speeds (km/h): w = Δq / Δk between the two states.
    const w1 = -qA / (KJ - kA), w2 = -QMAX / (KJ - KC), w3 = (QMAX - qA) / (KC - kA);
    const ts = (w2 * R) / (w2 - w1); // s: where the discharge wave meets the queue tail
    const xs = (w1 * ts) / 3600; // km
    const t3 = ts + (-xs / w3) * 3600;
    const Tmax = Math.ceil(Math.max(t3 * 1.12, R + 60) / 30) * 30;
    const X = Math.max(0.2, Math.ceil(-xs * 1.3 * 10) / 10);
    const xstep = X > 2 ? 1 : X > 0.8 ? 0.5 : 0.1;
    const tstep = Tmax > 600 ? 120 : Tmax > 300 ? 60 : 30;

    svg.replaceChildren();
    const f = frame(svg, {
      box: [52, 22, 568, 282], x: [0, Tmax], y: [-X, X * 0.3],
      xticks: range(0, Tmax, tstep), yticks: range(-Math.floor(X / xstep) * xstep, X * 0.3, xstep),
      yfmt: (v) => num(v, 1), xlabel: "time since the light turned red (s)", ylabel: "position (km), stop line at 0",
    });
    const g = clipped(svg, f);

    // Speed field of the three states: arrivals A, jam J, discharge C.
    const speed = (x, t) => {
      if (t <= ts) {
        if (x > 0) return t < R ? vA : VF / 2;
        if (x >= (w1 * t) / 3600 && (t < R || x <= (w2 * (t - R)) / 3600)) return 0;
        if (t >= R) return VF / 2;
        return vA;
      }
      return x >= xs + (w3 * (t - ts)) / 3600 ? VF / 2 : vA;
    };
    const d = 1 / kA, top = X * 0.3, bottom = -X - (vA * Tmax) / 3600;
    const count = Math.floor((top - bottom) / d);
    const stride = Math.max(1, Math.ceil(count / 45));
    const dt = Tmax / 700;
    for (let j = 0; j <= count; j += stride) {
      let x = top - j * d;
      const pts = [];
      for (let t = 0; t <= Tmax; t += dt) {
        pts.push([f.sx(t), f.sy(x)]);
        x += (speed(x, t) * dt) / 3600;
        if (x > top) break;
      }
      polyline(g, pts, "stroke:currentColor;stroke-opacity:.28;stroke-width:1");
    }
    if (stride > 1) text(svg, f.L + f.W, f.T - 8, `every ${stride}th car shown`, { "text-anchor": "end" });

    // Signal: red then green along the stop line.
    el("line", { x1: f.sx(0), x2: f.sx(R), y1: f.sy(0), y2: f.sy(0), style: "stroke:var(--code-del);stroke-width:5" }, g);
    el("line", { x1: f.sx(R), x2: f.sx(Tmax), y1: f.sy(0), y2: f.sy(0), style: "stroke:var(--code-add);stroke-width:5" }, g);
    const line = (t0, x0, t1, x1, color) =>
      el("line", { x1: f.sx(t0), y1: f.sy(x0), x2: f.sx(t1), y2: f.sy(x1), style: `stroke:${color};stroke-width:2.5;stroke-linecap:round` }, g);
    line(0, 0, ts, xs, "var(--code-del)");
    line(R, 0, ts, xs, "var(--vec-u)");
    line(ts, xs, t3, 0, "var(--brand)");
    el("circle", { cx: f.sx(ts), cy: f.sy(xs), r: 4.5, style: "fill:var(--brand)" }, g);
    text(svg, f.sx(R / 2), f.sy(0) - 8, "red", { "text-anchor": "middle" });
    text(svg, f.sx(Math.min(Tmax - 20, R + 25)), f.sy(0) - 8, "green", { "text-anchor": "start" });

    o.w1.textContent = `${num(w1, 1)} km/h`;
    o.w2.textContent = `${num(w2, 1)} km/h`;
    o.w3.textContent = `+${num(w3, 1)} km/h`;
    o.queue.textContent = `${int(-xs * 1000)} m (${int(-xs * KJ)} cars)`;
    o.clear.textContent = `${num(ts, 0)} s after red starts`;
  }
  draw();
}

// ---------------------------------------------------------------- T4

function braess(root) {
  const svg = plotOf(root, "net"), o = outs(root);
  let open = false, mode = "ue";
  const s = scrubAll(root, draw);
  onToggle(root, "shortcut", (v) => { open = v; draw(); });
  onSeg(root, (v) => { mode = v; draw(); });

  // Closed form for the symmetric network: a drivers on each outer route,
  // the rest on the zig-zag. UE equalises path times, SO marginal costs.
  function solve(D, withLink) {
    let a = D / 2;
    if (withLink) a = mode === "ue" ? Math.min(D / 2, Math.max(0, D - 4500)) : Math.min(D / 2, Math.max(0, D - 2250));
    const f3 = D - 2 * a, x = D - a;
    const t1 = x / 100 + 45, t3 = (2 * x) / 100;
    return { a, f3, x, t1, t3, avg: D ? (2 * a * t1 + f3 * t3) / D : 0 };
  }

  function draw() {
    const D = s.demand.get(), r = solve(D, open), base = solve(D, false);
    svg.replaceChildren();
    const N = { S: [64, 160], A: [280, 56], B: [280, 264], E: [496, 160] };
    const w = (flow) => 1.5 + (12 * flow) / Math.max(D, 1);
    const edge = (p, q, flow, color, label, sub, side, closed) => {
      const [x1, y1] = N[p], [x2, y2] = N[q];
      el("line", {
        x1, y1, x2, y2,
        style: `stroke:${color};stroke-width:${closed ? 1.5 : w(flow)};stroke-linecap:round;${closed ? "stroke-dasharray:4 5;stroke-opacity:.45" : "stroke-opacity:.85"}`,
      }, svg);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const [dx, dy] = side;
      text(svg, mx + dx, my + dy, label, { "text-anchor": dx < 0 ? "end" : dx > 0 ? "start" : "middle", class: "fill-foreground font-mono text-[12px]" });
      text(svg, mx + dx, my + dy + 15, sub, { "text-anchor": dx < 0 ? "end" : dx > 0 ? "start" : "middle" });
    };
    const fmt = (flow, t) => `${int(flow)} · ${num(t, 1)} min`;
    const tv = r.x / 100;
    edge("S", "A", r.x, "var(--vec-u)", "T/100", fmt(r.x, tv), [-14, -14]);
    edge("A", "E", r.a, "var(--vec-out)", "45 min", fmt(r.a, 45), [14, -14]);
    edge("S", "B", r.a, "var(--vec-out)", "45 min", fmt(r.a, 45), [-14, 22]);
    edge("B", "E", r.x, "var(--vec-u)", "T/100", fmt(r.x, tv), [14, 22]);
    edge("A", "B", r.f3, "var(--brand)", open ? "0 min" : "closed", open ? `${int(r.f3)} drivers` : "", [12, 0], !open);
    for (const [name, [x, y]] of Object.entries(N)) {
      el("circle", { cx: x, cy: y, r: 16, style: "fill:var(--background);stroke:currentColor;stroke-opacity:.5;stroke-width:1.5" }, svg);
      text(svg, x, y + 4.5, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[13px] font-medium" });
    }
    text(svg, N.S[0], N.S[1] + 34, `${int(D)} drivers`, { "text-anchor": "middle" });

    o.p1.textContent = `${int(r.a)} · ${num(r.t1, 1)} min`;
    o.p2.textContent = `${int(r.a)} · ${num(r.t1, 1)} min`;
    o.p3.textContent = open ? `${int(r.f3)} · ${num(r.t3, 1)} min` : "closed";
    const delta = r.avg - base.avg;
    o.time.textContent = `${num(r.avg, 1)} min` + (open && Math.abs(delta) > 0.05 ? ` (${delta > 0 ? "+" : ""}${num(delta, 1)})` : "");
    o.base.textContent = `${num(base.avg, 1)} min`;
  }
  draw();
}

// ---------------------------------------------------------------- T5

function routes(root) {
  const T1 = 10, T2 = 15;
  const svg = plotOf(root, "t"), o = outs(root);
  const s = scrubAll(root, draw);
  const bpr = (t0, c) => (v) => t0 * (1 + 0.15 * (v / c) ** 4);
  const marg = (t0, c) => (v) => t0 * (1 + 0.75 * (v / c) ** 4); // d(v·t)/dv

  // The motorway flow x where g1(x) = g2(D − x), or a corner.
  function split(g1, g2, D) {
    const f = (x) => g1(x) - g2(D - x);
    if (f(0) >= 0) return 0;
    if (f(D) <= 0) return D;
    let lo = 0, hi = D;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; f(m) < 0 ? (lo = m) : (hi = m); }
    return (lo + hi) / 2;
  }

  function draw() {
    const D = s.demand.get(), c1 = s.c1.get(), c2 = s.c2.get();
    const t1 = bpr(T1, c1), t2 = bpr(T2, c2), m1 = marg(T1, c1), m2 = marg(T2, c2);
    const ue = split(t1, t2, D), so = split(m1, m2, D);
    const cost = (x) => (x * t1(x) + (D - x) * t2(D - x)) / 60;
    const tue = cost(ue), tso = cost(so);

    svg.replaceChildren();
    const tEq = Math.max(t1(ue), t2(D - ue));
    const ymax = Math.max(30, Math.ceil((tEq * 2.2) / 10) * 10);
    const xstep = D > 5000 ? 2000 : D > 2000 ? 1000 : 500;
    const f = frame(svg, {
      box: [44, 34, 500, 250], x: [0, D], y: [0, ymax],
      xticks: range(0, D, xstep), yticks: range(0, ymax, ymax > 60 ? 20 : 10), xfmt: int,
      xlabel: "flow on the motorway (veh/h); the rest takes the arterial →", ylabel: "minutes",
    });
    const g = clipped(svg, f);
    const P = (fn) => sample(0, D, fn, 120).map(([x, y]) => [f.sx(x), f.sy(y)]);
    polyline(g, P(t1), "stroke:var(--vec-u);stroke-width:2.2");
    polyline(g, P((x) => t2(D - x)), "stroke:var(--vec-out);stroke-width:2.2");
    polyline(g, P(m1), "stroke:var(--vec-u);stroke-width:1.4;stroke-dasharray:5 4");
    polyline(g, P((x) => m2(D - x)), "stroke:var(--vec-out);stroke-width:1.4;stroke-dasharray:5 4");
    // Equilibrium label to the right of its line, optimum to the left,
    // unless that runs off the plot.
    const vline = (x, dash, label, right) => {
      if (x > D * 0.82) right = false;
      if (x < D * 0.18) right = true;
      el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: `stroke:var(--brand);stroke-width:1.5;${dash ? "stroke-dasharray:3 3" : ""}` }, g);
      text(svg, f.sx(x) + (right ? 5 : -5), f.T + (dash ? 26 : 12), label, { "text-anchor": right ? "start" : "end", class: "fill-foreground font-mono text-[10px]" });
    };
    vline(ue, false, "equilibrium", true);
    vline(so, true, "optimum", false);
    el("circle", { cx: f.sx(ue), cy: f.sy(t1(ue)), r: 4.5, style: "fill:var(--brand)" }, g);
    text(svg, f.L + f.W, f.T - 8, "solid: travel time · dashed: marginal cost to everyone", { "text-anchor": "end" });

    o.ue.textContent = `${int(ue)} / ${int(D - ue)}`;
    o.so.textContent = `${int(so)} / ${int(D - so)}`;
    o.tue.textContent = `${int(tue)} · ${num(tEq, 1)} min`;
    o.tso.textContent = `${int(tso)}`;
    o.poa.textContent = num(tue / tso, 3);
    const toll1 = m1(so) - t1(so), toll2 = m2(D - so) - t2(D - so);
    o.toll.textContent = `${num(toll1, 1)} min (arterial ${num(toll2, 1)})`;
  }
  draw();
}

// ---------------------------------------------------------------- T6

function buses(root) {
  const N = 6, LOOP = 60, H = LOOP / N, HS = 11, WINDOW = 240;
  const ring = plotOf(root, "ring"), hw = plotOf(root, "hw"), o = outs(root);
  let hold = false, st;
  const s = scrubAll(root, draw);
  onToggle(root, "hold", (v) => { hold = v; draw(); });
  const mod1 = (v) => ((v % 1) + 1) % 1;

  function reset() {
    const r = rng(11);
    st = {
      t: 0, rand: r, lastDep: null, rec: [],
      pos: Array.from({ length: N }, (_, i) => mod1(-i / N + (r() - 0.5) * 0.02)),
      held: Array(N).fill(0),
    };
  }

  // Bus i follows bus i − 1. The longer the gap ahead, the more people are
  // waiting and the slower the bus: dwell time feeds back on the headway.
  function step(dt) {
    const beta = 0.15 * s.demand.get();
    const gaps = st.pos.map((p, i) => mod1(st.pos[(i - 1 + N) % N] - p) || 1);
    for (let i = 0; i < N; i++) {
      if (st.held[i] > 0) { st.held[i] -= dt; continue; }
      let v = (1 + beta) / (1 + beta * gaps[i] * N) / LOOP;
      v *= 1 + 0.3 * (st.rand() - 0.5);
      const move = Math.min(v * dt, Math.max(0, gaps[i] - 0.004));
      const before = st.pos[i];
      st.pos[i] = mod1(before + move);
      if (st.pos[i] < before) {
        // Passed the control stop at the top of the loop.
        // Holding: no departure sooner than 11 minutes after the previous
        // bus, which leaves 6 minutes of slack per loop.
        let dep = st.t;
        if (hold && st.lastDep !== null && dep - st.lastDep < HS) {
          st.held[i] = HS - (dep - st.lastDep);
          dep = st.lastDep + HS;
        }
        if (st.lastDep !== null) st.rec.push([dep, dep - st.lastDep]);
        st.lastDep = dep;
      }
    }
    st.t += dt;
    st.rec = st.rec.filter(([t]) => t > st.t - WINDOW);
  }

  function draw() {
    ring.replaceChildren();
    const cx = 140, cy = 140, R = 104;
    el("circle", { cx, cy, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:.25;stroke-width:6" }, ring);
    el("rect", { x: cx - 2, y: cy - R - 14, width: 4, height: 28, style: "fill:var(--foreground)" }, ring);
    text(ring, cx + 8, cy - R - 16, "control stop", { "text-anchor": "start" });
    text(ring, cx, cy - 4, `t = ${int(st.t)} min`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    text(ring, cx, cy + 12, "clockwise", { "text-anchor": "middle" });
    st.pos.forEach((p, i) => {
      const a = p * 2 * Math.PI - Math.PI / 2;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      el("circle", { cx: x, cy: y, r: 11, style: `fill:${st.held[i] > 0 ? "var(--brand)" : "var(--vec-u)"};stroke:var(--background);stroke-width:2` }, ring);
      text(ring, x, y + 4, String(i + 1), { "text-anchor": "middle", class: "fill-background font-mono text-[11px] font-medium" });
    });

    hw.replaceChildren();
    const t1 = Math.max(WINDOW, st.t), t0 = t1 - WINDOW;
    const f = frame(hw, {
      box: [40, 34, 326, 214], x: [t0, t1], y: [0, 40],
      xticks: range(Math.ceil(t0 / 60) * 60, t1, 60), yticks: range(0, 40, 10),
      xlabel: "time (min)", ylabel: "headway at the control stop (min)",
    });
    const target = hold ? HS : H;
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(target), y2: f.sy(target), style: "stroke:var(--brand);stroke-dasharray:4 3" }, hw);
    text(hw, f.L + f.W - 2, f.sy(target) - 5, hold ? "minimum with holding" : "schedule", { "text-anchor": "end" });
    for (const [t, h] of st.rec) {
      el("circle", { cx: f.sx(t), cy: f.sy(Math.min(h, 40)), r: 3, style: `fill:${Math.abs(h - target) > 3 ? "var(--code-del)" : "var(--vec-u)"}` }, hw);
    }
    if (!st.rec.length) text(hw, f.L + f.W / 2, f.T + f.H / 2, "press Run to record headways", { "text-anchor": "middle" });

    // Headways now, from the spacing, in minutes at the scheduled speed.
    const h = st.pos.map((p, i) => mod1(st.pos[(i - 1 + N) % N] - p) * LOOP);
    const mean = h.reduce((a, b) => a + b, 0) / N;
    const sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) ** 2, 0) / N);
    o.sched.textContent = `every ${num(H, 0)} min`;
    o.cv.textContent = `${num(sd / mean, 2)} (CV)`;
    o.wait.textContent = `${num(h.reduce((a, b) => a + b * b, 0) / (2 * h.reduce((a, b) => a + b, 0)), 1)} min`;
    o.ideal.textContent = `${num(H / 2, 1)} min`;
  }

  root.querySelector('[data-action="reset"]').addEventListener("click", () => { reset(); draw(); });
  player(root, (dt) => {
    const sim = dt * 30; // simulated minutes per second
    for (let k = 0; k < Math.ceil(sim / 0.05); k++) step(sim / Math.ceil(sim / 0.05));
    draw();
  });
  // Open on 150 simulated minutes, so the drift is already visible.
  reset();
  for (let k = 0; k < 3000; k++) step(0.05);
  draw();
}

// ---------------------------------------------------------------- T7

function webster(root) {
  const COLORS = ["var(--vec-u)", "var(--vec-out)", "var(--vec-v)"];
  const svg = plotOf(root, "c"), bar = root.querySelector("[data-bar]"), o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const ys = [s.y1.get(), s.y2.get(), s.y3.get()];
    const phases = ys.map((y, i) => ({ y, i })).filter((p) => p.y > 0);
    const l = s.lost.get(), L = l * phases.length, Y = phases.reduce((a, p) => a + p.y, 0);
    const C = Y < 1 ? (1.5 * L + 5) / (1 - Y) : Infinity;
    const greens = phases.map((p) => ((C - L) * p.y) / Y);

    bar.replaceChildren();
    const seg = (grow, color, label, light) => {
      const node = document.createElement("div");
      node.className = "flex min-w-0 items-center justify-center overflow-hidden font-mono text-[11px] whitespace-nowrap " + (light ? "text-muted-foreground" : "text-background font-medium");
      node.style.flex = `${grow} 1 0`;
      node.style.background = color;
      node.textContent = label;
      bar.append(node);
    };
    if (!Number.isFinite(C) || !phases.length) {
      seg(1, "color-mix(in oklab, var(--code-del) 20%, transparent)", Y >= 1 ? "oversaturated: no cycle can serve this demand" : "no demand", true);
    } else {
      phases.forEach((p, k) => {
        seg(greens[k], COLORS[p.i], greens[k] / C > 0.1 ? `φ${p.i + 1} ${num(greens[k], 0)} s` : "");
        if (l > 0) seg(l, "color-mix(in oklab, var(--foreground) 10%, transparent)", "", true);
      });
    }

    svg.replaceChildren();
    const f = frame(svg, {
      box: [44, 32, 500, 156], x: [0, 1], y: [0, 240],
      xticks: range(0, 1, 0.2), yticks: range(0, 240, 60), xfmt: (v) => num(v, 1),
      xlabel: "Y = sum of critical flow ratios", ylabel: "optimal cycle C₀ (s)",
    });
    const g = clipped(svg, f);
    el("rect", { x: f.L, y: f.sy(120), width: f.W, height: f.sy(30) - f.sy(120), style: "fill:currentColor;fill-opacity:.05" }, g);
    text(svg, f.L + 4, f.sy(120) + 12, "usual range 30–120 s", { "text-anchor": "start" });
    polyline(g, sample(0, 0.985, (y) => (1.5 * L + 5) / (1 - y), 160).map(([x, y]) => [f.sx(x), f.sy(Math.min(y, 1e4))]), "stroke:var(--brand);stroke-width:2");
    if (Number.isFinite(C) && C < 240) el("circle", { cx: f.sx(Y), cy: f.sy(C), r: 5, style: "fill:var(--brand)" }, g);
    el("line", { x1: f.sx(1), x2: f.sx(1), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-del);stroke-dasharray:3 3" }, g);

    o.Y.textContent = num(Y, 2);
    o.L.textContent = `${num(L, 0)} s (${phases.length} × ${num(l, 1)})`;
    o.C.textContent = Number.isFinite(C) ? `${num(C, 0)} s` : "∞";
    o.greens.textContent = Number.isFinite(C) ? greens.map((gr) => num(gr, 0)).join(" · ") + " s" : "—";
    o.status.textContent = Y >= 1 ? "oversaturated (Y ≥ 1)" : C > 120 ? "long: usually capped near 120 s" : C < 30 ? "short: usually at least 30 s" : "within the usual range";
  }
  draw();
}

// ---------------------------------------------------------------- T8

function isochrones(root) {
  const NX = 24, NY = 16, P = 25, M = 10, RIVER = 15, BRIDGES = [4, 12];
  const id = (i, j) => j * (NX + 1) + i;
  const svg = plotOf(root, "map"), o = outs(root);
  const r = rng(2024);
  const edges = [];
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      if (i < NX) {
        const bridge = i === RIVER;
        if (!bridge || BRIDGES.includes(j)) if (bridge || r() > 0.06) edges.push([id(i, j), id(i + 1, j), bridge]);
      }
      if (j < NY && r() > 0.06) edges.push([id(i, j), id(i, j + 1), false]);
    }
  }
  const nodes = (NX + 1) * (NY + 1);
  const adj = Array.from({ length: nodes }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const KINDS = [["G", "grocery", 2], ["S", "school", 2], ["D", "doctor", 1], ["R", "pharmacy", 2], ["P", "park", 2], ["L", "library", 1], ["C", "café", 3], ["B", "bus stop", 4]];
  const places = [];
  for (const [letter, name, n] of KINDS) {
    for (let k = 0; k < n; k++) {
      // The only doctor is across the river; the library is on the west bank.
      const lo = letter === "D" ? RIVER + 2 : 0, hi = letter === "L" ? RIVER - 2 : NX;
      places.push({ letter, name, node: id(lo + Math.floor(r() * (hi - lo + 1)), Math.floor(r() * (NY + 1))) });
    }
  }
  let origin = id(10, 8);
  svg.setAttribute("tabindex", "0");
  const s = scrubAll(root, draw);

  function dijkstra(src, w) {
    const dist = new Float64Array(nodes).fill(Infinity), done = new Uint8Array(nodes);
    dist[src] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < nodes; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0) return dist;
      done[u] = 1;
      for (const v of adj[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    }
  }

  function draw() {
    const w = (0.1 / s.speed.get()) * 60; // minutes per 100 m block
    const dist = dijkstra(origin, w);
    const xy = (n) => [M + (n % (NX + 1)) * P, M + Math.floor(n / (NX + 1)) * P];
    svg.replaceChildren();
    const rx = M + (RIVER + 0.5) * P;
    // A wavy band down the map, between the two bank columns.
    const RH = 414, st = RH / 12;
    let d = `M ${rx - 7} 0`;
    for (let k = 0; k < 12; k++) d += ` Q ${rx - 7 + (k % 2 ? -5 : 5)} ${(k + 0.5) * st} ${rx - 7} ${(k + 1) * st}`;
    d += ` L ${rx + 7} ${RH}`;
    for (let k = 11; k >= 0; k--) d += ` Q ${rx + 7 + (k % 2 ? -5 : 5)} ${(k + 0.5) * st} ${rx + 7} ${k * st}`;
    el("path", { d: d + " Z", style: "fill:color-mix(in oklab, var(--vec-u) 22%, transparent)" }, svg);

    const band = (t) => (t <= 5 ? "var(--code-add)" : t <= 10 ? "var(--vec-u)" : t <= 15 ? "var(--vec-out)" : "color-mix(in oklab, var(--foreground) 25%, transparent)");
    let km = 0;
    for (const [a, b, bridge] of edges) {
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      const t = Math.max(dist[a], dist[b]);
      if (t <= 15) km += 0.1;
      el("line", { x1, y1, x2, y2, style: `stroke:${band(t)};stroke-width:${bridge ? 5 : 3};stroke-linecap:round` }, svg);
    }
    const seen = new Set();
    for (const p of places) {
      const [x, y] = xy(p.node), ok = dist[p.node] <= 15;
      if (ok) seen.add(p.name);
      const g = el("g", { style: `opacity:${ok ? 1 : 0.4}` }, svg);
      el("circle", { cx: x, cy: y, r: 8, style: `fill:var(--background);stroke:${ok ? "var(--foreground)" : "currentColor"};stroke-width:1.4` }, g);
      text(g, x, y + 3.5, p.letter, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px] font-medium" });
    }
    const [ox, oy] = xy(origin);
    el("circle", { cx: ox, cy: oy, r: 7, style: "fill:var(--brand);stroke:var(--background);stroke-width:2.5" }, svg);
    text(svg, M, 432, KINDS.map(([l, n]) => `${l} ${n}`).join(" · "), { "text-anchor": "start" });

    const missing = KINDS.map(([, n]) => n).filter((n) => !seen.has(n));
    const i = origin % (NX + 1);
    o.start.textContent = `${i <= RIVER ? "west" : "east"} bank (${i}, ${Math.floor(origin / (NX + 1))})`;
    o.reach.textContent = `${num(km, 1)} km of street`;
    o.places.textContent = `${KINDS.length - missing.length} of ${KINDS.length} kinds`;
    o.missing.textContent = missing.length ? missing.join(", ") : "none";
  }

  const move = (i, j) => {
    origin = id(Math.max(0, Math.min(NX, i)), Math.max(0, Math.min(NY, j)));
    draw();
  };
  svg.addEventListener("click", (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    move(Math.round((p.x - M) / P), Math.round((p.y - M) / P));
  });
  svg.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    move((origin % (NX + 1)) + k[0], Math.floor(origin / (NX + 1)) + k[1]);
  });
  draw();
}

// ---------------------------------------------------------------- T9

function scaling(root) {
  const PRESETS = {
    socio: { beta: 1.15, y0: 0.5, label: "economic output (synthetic units)" },
    infra: { beta: 0.85, y0: 0.05, label: "road length (synthetic km)" },
    basic: { beta: 1.0, y0: 0.42, label: "homes (synthetic)" },
  };
  const svg = plotOf(root, "plot"), o = outs(root);
  let kind = "socio", seed = 3;
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const pow10 = (v) => "10" + String(v).replace(/\d/g, (d) => SUP[d]).replace("-", "⁻");

  function draw() {
    const pr = PRESETS[kind], sigma = s.noise.get(), r = rng(seed);
    const pts = Array.from({ length: 60 }, () => {
      const lx = 4 + 3 * r();
      return [lx, Math.log10(pr.y0) + pr.beta * lx + (sigma * gauss(r)) / Math.LN10];
    });
    // Ordinary least squares on the logs.
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const b = sxy / sxx, a = my - b * mx;
    const sse = pts.reduce((acc, [x, y]) => acc + (y - a - b * x) ** 2, 0);
    const se = Math.sqrt(sse / (n - 2) / sxx), r2 = 1 - sse / syy;

    svg.replaceChildren();
    const ylo = Math.floor(Math.min(...pts.map((p) => p[1]))), yhi = Math.ceil(Math.max(...pts.map((p) => p[1])));
    const f = frame(svg, {
      box: [52, 32, 488, 268], x: [4, 7], y: [ylo, yhi],
      xticks: [4, 5, 6, 7], yticks: range(ylo, yhi, 1), xfmt: pow10, yfmt: pow10,
      xlabel: "population N (log scale)", ylabel: pr.label + ", log scale",
    });
    const g = clipped(svg, f);
    el("line", { x1: f.sx(4), y1: f.sy(my - (mx - 4)), x2: f.sx(7), y2: f.sy(my + (7 - mx)), style: "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:4 4" }, g);
    for (const [x, y] of pts) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 3.2, style: "fill:currentColor;fill-opacity:.45" }, g);
    el("line", { x1: f.sx(4), y1: f.sy(a + 4 * b), x2: f.sx(7), y2: f.sy(a + 7 * b), style: "stroke:var(--brand);stroke-width:2.2" }, g);
    text(svg, f.L + 6, f.T + 12, `fit: slope β̂ = ${num(b, 3)}`, { "text-anchor": "start", class: "fill-foreground font-mono text-[11px]" });
    text(svg, f.L + 6, f.T + 26, "dashed: β = 1 (proportional)", { "text-anchor": "start" });

    const ci = 2.002 * se, k = 2 ** (b - 1);
    o.beta.textContent = num(pr.beta, 2);
    o.fit.textContent = num(b, 3);
    o.ci.textContent = `${num(b - ci, 2)} – ${num(b + ci, 2)}`;
    o.r2.textContent = num(r2, 3);
    o.double.textContent = `×${num(k, 3)} (${k >= 1 ? "+" : ""}${num((k - 1) * 100, 1)}%)`;
  }

  root.querySelector('[data-action="reseed"]').addEventListener("click", () => { seed = (seed * 48271) % 2147483647; draw(); });
  draw();
}

// ---------------------------------------------------------------- T10

function commute(root) {
  const COMMUTERS = 100000, DAYS = 230;
  const MODES = [
    ["car", "Car", "var(--code-del)"],
    ["bus", "Bus", "var(--vec-out)"],
    ["rail", "Rail", "var(--vec-u)"],
    ["bike", "Bike", "var(--code-add)"],
    ["walk", "Walk", "var(--code-add)"],
  ];
  const bars = root.querySelector("[data-bars]"), o = outs(root);
  const rows = {};
  for (const [key, label, color] of MODES) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[3rem_minmax(0,1fr)_6.5rem] items-center gap-3 font-mono text-xs";
    const name = document.createElement("span");
    name.className = "text-muted-foreground";
    name.textContent = label;
    const track = document.createElement("div");
    track.className = "h-2 overflow-hidden rounded-full bg-muted";
    const fill = document.createElement("div");
    fill.className = "h-full rounded-full transition-[width] duration-200 ease-out";
    fill.style.background = color;
    track.append(fill);
    const val = document.createElement("span");
    val.className = "text-right tabular-nums";
    row.append(name, track, val);
    bars.append(row);
    rows[key] = { fill, val };
  }
  const s = scrubAll(root, draw);

  // kg CO₂e per passenger-km; typical values, see the note on the block.
  const factors = () => ({ car: 0.164 / s.occ.get(), bus: 0.1, rail: 0.035, bike: 0, walk: 0 });

  function daily(shares) {
    const fac = factors(), pkm = COMMUTERS * 2 * s.km.get();
    return Object.fromEntries(MODES.map(([k]) => [k, (pkm * shares[k] * fac[k]) / 1000])); // tonnes
  }

  function draw() {
    const raw = Object.fromEntries(MODES.map(([k]) => [k, s[k].get()]));
    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    const shares = Object.fromEntries(MODES.map(([k]) => [k, sum ? raw[k] / sum : 0]));
    const t = daily(shares), total = Object.values(t).reduce((a, b) => a + b, 0);
    const max = Math.max(...Object.values(t), 1e-9);
    for (const [k] of MODES) {
      rows[k].fill.style.width = `${(100 * t[k]) / max}%`;
      rows[k].val.textContent = `${num(t[k], 1)} t/day`;
    }
    const swap = { ...shares, car: shares.car * 0.8, bike: shares.bike + shares.car * 0.2 };
    const t2 = Object.values(daily(swap)).reduce((a, b) => a + b, 0);
    o.sum.textContent = Math.abs(sum - 100) < 0.5 ? "100%" : `${num(sum, 0)}% (rescaled to 100)`;
    o.day.textContent = `${num(total, 1)} t CO₂e`;
    o.year.textContent = `${int((total * 1000 * DAYS) / COMMUTERS)} kg CO₂e`;
    o.swap.textContent = total ? `−${num(total - t2, 1)} t/day (−${num((100 * (total - t2)) / total, 0)}%)` : "—";
  }
  draw();
}

// ---------------------------------------------------------------- wiring

const MODULES = {
  "trans-fd": fundamental,
  "trans-nasch": nasch,
  "trans-shock": shockwave,
  "trans-braess": braess,
  "trans-ue": routes,
  "trans-bus": buses,
  "trans-webster": webster,
  "trans-iso": isochrones,
  "trans-scale": scaling,
  "trans-co2": commute,
};
for (const [attr, init] of Object.entries(MODULES)) {
  for (const root of document.querySelectorAll(`[data-${attr}]`)) init(root);
}
