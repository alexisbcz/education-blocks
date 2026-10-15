// Fluid mechanics blocks. Every number comes from the model drawn next to
// it: hydrostatics, box-barge stability, Bernoulli, Colebrook, superposed
// potential flows, Stam's stable fluids, sphere drag, Blasius, the
// hydraulic jump and Buckingham's π theorem.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const G = 9.80665;
const P0 = 101325;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const sup = (n) => String(n).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]);
const sci = (v, d = 2) => {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e <= 4) return num(v, Math.max(0, d - Math.max(0, e)));
  return `${num(v / 10 ** e, d)}×10${sup(e)}`;
};
const pressure = (p) => (Math.abs(p) >= 1e6 ? `${num(p / 1e6, 3)} MPa` : Math.abs(p) >= 1e3 ? `${num(p / 1e3, 2)} kPa` : `${num(p, 1)} Pa`);
const length = (m) => (Math.abs(m) >= 1 ? `${num(m, 3)} m` : Math.abs(m) >= 0.01 ? `${num(m * 100, 2)} cm` : `${num(m * 1000, 3)} mm`);

// A play/pause button whose icon and label follow the state. SVG icons have
// no .hidden property, so the attribute is toggled.
function playButton(btn, labels) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// The value of a segmented control, kept in sync from chrome.js's event.
function seg(root, initial, onChange) {
  let v = root.querySelector("[role=tablist] [aria-selected=true]")?.dataset.seg ?? initial;
  root.addEventListener("seg-change", (e) => { v = e.detail.value; onChange(v); });
  return () => v;
}

// Visible while on screen: callers start and stop their loops with it.
function watchVisible(root, fn) {
  new IntersectionObserver(([e]) => fn(e.isIntersecting)).observe(root);
}

// ============================================================ Hydrostatics

const FLUIDS = { water: 998, sea: 1025, mercury: 13534 };
const RHO_HG = 13534;

for (const root of document.querySelectorAll("[data-fluid-hydro]")) {
  const tank = root.querySelector("[data-tank]");
  const press = root.querySelector("[data-press]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const fluid = seg(root, "water", draw);

  function draw() {
    const rho = FLUIDS[fluid()];
    const h = s.depth.get();
    const gauge = rho * G * h;
    const mano = gauge / (RHO_HG * G);

    // Tank: 0–10 m of depth over 240 px.
    tank.replaceChildren();
    const top = 30, k = 24, x0 = 30, x1 = 200;
    el("rect", { x: x0, y: top, width: x1 - x0, height: 10 * k, style: "fill:var(--vec-u);fill-opacity:0.12" }, tank);
    el("path", { d: `M${x0} ${top - 12}V${top + 10 * k}H${x1}V${top - 12}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.6;stroke-width:2" }, tank);
    el("line", { x1: x0, x2: x1, y1: top, y2: top, style: "stroke:var(--vec-u);stroke-width:1.5" }, tank);
    text(tank, x0 + 4, top - 4, "free surface, p₀");
    for (let d = 0; d <= 10; d += 2) {
      el("line", { x1: x1, x2: x1 + 5, y1: top + d * k, y2: top + d * k, style: "stroke:currentColor;stroke-opacity:0.4" }, tank);
      text(tank, x1 + 8, top + d * k + 3, `${d} m`);
    }
    const py = top + h * k;
    el("line", { x1: x0, x2: x1, y1: py, y2: py, style: "stroke:var(--brand);stroke-dasharray:3 3" }, tank);
    el("circle", { cx: 115, cy: py, r: 5, style: "fill:var(--brand)" }, tank);
    text(tank, 124, py - 6, `p = ${pressure(P0 + gauge)}`, { class: "fill-foreground font-mono text-[10px]" });
    // Pressure grows linearly: a wedge of arrows pressing on the right wall.
    for (let d = 1; d <= 10; d += 1.5) {
      const len = 6 + (rho * G * d) / (FLUIDS.mercury * G * 10) * 40 + (rho * G * d) / (FLUIDS.water * G * 10) * 10;
      el("line", { x1: x1 - 4 - Math.min(len, 60), x2: x1 - 4, y1: top + d * k, y2: top + d * k, style: "stroke:var(--vec-u);stroke-opacity:0.55;stroke-width:1.2" }, tank);
    }
    // Mercury U-tube open to the air, connected to the probe.
    const ux = 280, uw = 30, base = 270, rest = 150, ppm = 120; // px per metre of mercury
    const dy = Math.min(110, (mano * ppm) / 2);
    el("path", { d: `M115 ${py}H250V${base - 20}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.35;stroke-width:1.5" }, tank);
    el("path", { d: `M${ux - uw / 2} 40V${base}a${uw / 2} ${uw / 2} 0 0 0 ${uw} 0V40`, transform: "translate(-15 0)", style: "fill:none;stroke:currentColor;stroke-opacity:0.6;stroke-width:6;stroke-linecap:round" }, tank);
    const lx = ux - uw / 2 - 15, rx = ux + uw / 2 - 15;
    el("path", { d: `M${lx} ${rest + dy}V${base}a${uw / 2} ${uw / 2} 0 0 0 ${uw} 0V${rest - dy}`, style: "fill:none;stroke:var(--ion-ca);stroke-width:4;stroke-linecap:butt" }, tank);
    el("line", { x1: rx + 8, x2: rx + 8, y1: rest - dy, y2: rest + dy, style: "stroke:var(--brand);stroke-width:1" }, tank);
    text(tank, rx + 12, rest + 3, `Δh ${length(mano)}`, { class: "fill-foreground font-mono text-[10px]" });
    text(tank, lx - 4, 32, "Hg", { "text-anchor": "end" });

    // Press: F₂ = F₁ (d₂/d₁)².
    press.replaceChildren();
    const f1 = s.f1.get(), d1 = s.d1.get(), d2 = s.d2.get();
    const ratio = (d2 / d1) ** 2, f2 = f1 * ratio;
    const w1 = Math.max(8, d1 * 3), w2 = Math.max(24, d2 * 2.4);
    const fy = 200, cx1 = 50, cx2 = 160;
    el("path", { d: `M${cx1 - w1 / 2} 120V${fy + 30}H${cx2 + w2 / 2}V120M${cx1 + w1 / 2} 120V${fy}H${cx2 - w2 / 2}V120`, style: "fill:none;stroke:currentColor;stroke-opacity:0.6;stroke-width:2" }, press);
    el("rect", { x: cx1 - w1 / 2, y: 140, width: w1, height: fy - 140 + 30, style: "fill:var(--vec-u);fill-opacity:0.15" }, press);
    el("rect", { x: cx1 + w1 / 2, y: fy, width: cx2 - w2 / 2 - cx1 - w1 / 2, height: 30, style: "fill:var(--vec-u);fill-opacity:0.15" }, press);
    el("rect", { x: cx2 - w2 / 2, y: 140, width: w2, height: fy - 140 + 30, style: "fill:var(--vec-u);fill-opacity:0.15" }, press);
    el("rect", { x: cx1 - w1 / 2, y: 132, width: w1, height: 8, rx: 1, style: "fill:currentColor;fill-opacity:0.6" }, press);
    el("rect", { x: cx2 - w2 / 2, y: 132, width: w2, height: 8, rx: 1, style: "fill:currentColor;fill-opacity:0.6" }, press);
    el("path", { d: `M${cx1} 70V128M${cx1 - 4} 120L${cx1} 128L${cx1 + 4} 120`, style: "fill:none;stroke:var(--brand);stroke-width:2" }, press);
    const up = Math.min(100, 12 + Math.log10(ratio + 1) * 40);
    el("path", { d: `M${cx2} 128V${128 - up}M${cx2 - 5} ${136 - up}L${cx2} ${128 - up}L${cx2 + 5} ${136 - up}`, style: "fill:none;stroke:var(--code-add);stroke-width:2.5" }, press);
    text(press, cx1, 60, `F₁ ${num(f1, 0)} N`, { "text-anchor": "middle" });
    text(press, cx2, 118 - up, `F₂ ${f2 >= 1000 ? num(f2 / 1000, 2) + " kN" : num(f2, 0) + " N"}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    text(press, 120, 260, "same pressure everywhere", { "text-anchor": "middle" });

    o.rho.textContent = `${rho} kg/m³`;
    o.gauge.textContent = pressure(gauge);
    o.abs.textContent = pressure(P0 + gauge);
    o.mano.textContent = length(mano);
    o.f2.textContent = f2 >= 1000 ? `${num(f2 / 1000, 2)} kN` : `${num(f2, 0)} N`;
    o.stroke.textContent = `small piston moves ${num(ratio, 1)}× farther`;
  }
  draw();
}

// ============================================================ Box barge

// Area and centroid of a polygon (shoelace).
function polyArea(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  a /= 2;
  return { a: Math.abs(a), cx: a ? cx / (6 * a) : 0, cy: a ? cy / (6 * a) : 0 };
}
// The part of a polygon below the line y = w (world, y up).
function clipBelow(pts, w) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const pin = p[1] <= w, qin = q[1] <= w;
    if (pin) out.push(p);
    if (pin !== qin) {
      const t = (w - p[1]) / (q[1] - p[1]);
      out.push([p[0] + t * (q[0] - p[0]), w]);
    }
  }
  return out;
}

for (const root of document.querySelectorAll("[data-fluid-buoy]")) {
  const svg = root.querySelector("[data-hull]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const RHO = 1025;

  function draw() {
    const B = s.beam.get(), D = s.depth.get(), L = s.length.get(), m = s.mass.get() * 1000, KG = s.kg.get();
    const phi = (s.heel.get() * Math.PI) / 180;
    const T = m / (RHO * L * B);
    const KB = T / 2, BM = (B * B) / (12 * T), GM = KB + BM - KG;
    svg.replaceChildren();
    o.draft.textContent = `${num(T, 2)} m`;
    o.kb.textContent = `${num(KB, 2)} m`;
    o.bm.textContent = `${num(BM, 2)} m`;
    o.ice.textContent = `${num((917 / 1025) * 100, 1)}% (sea), ${num((917 / 998) * 100, 1)}% (fresh)`;
    if (T >= D) {
      o.gm.textContent = o.gz.textContent = o.gzs.textContent = "—";
      o.verdict.textContent = "sinks: the draft would exceed the hull depth";
      o.verdict.className = "text-del";
      text(svg, 260, 160, "Too heavy: displacing its weight needs more than the hull's depth.", { "text-anchor": "middle", class: "fill-foreground text-[12px]" });
      return;
    }
    // Hull corners in body axes (origin at keel centre, y up), rotated by φ.
    const rot = ([x, y]) => [x * Math.cos(phi) - y * Math.sin(phi), x * Math.sin(phi) + y * Math.cos(phi)];
    const hull = [[-B / 2, 0], [B / 2, 0], [B / 2, D], [-B / 2, D]].map(rot);
    // Find the waterline that keeps the displaced area B·T (bisection).
    let lo = Math.min(...hull.map((p) => p[1])), hi = Math.max(...hull.map((p) => p[1]));
    for (let i = 0; i < 60; i++) {
      const w = (lo + hi) / 2;
      polyArea(clipBelow(hull, w)).a < B * T ? (lo = w) : (hi = w);
    }
    const w = (lo + hi) / 2;
    const sub = clipBelow(hull, w);
    const cb = polyArea(sub);
    const g = rot([0, KG]);
    // The heel is counter-clockwise, so the low side is −x: buoyancy acting
    // left of the weight (B.x < G.x) turns her back upright.
    const gz = g[0] - cb.cx;
    const gzs = GM * Math.sin(phi);
    const deckWet = hull[2][1] < w || hull[3][1] < w;

    // Drawing: world → px around the hull.
    const span = Math.max(B, D) * 1.4;
    const k = 280 / span, ox = 260, oy = 250;
    const X = (x) => ox + x * k, Y = (y) => oy - (y - w) * k - 40;
    el("rect", { x: 0, y: Y(w), width: 520, height: 320 - Y(w), style: "fill:var(--vec-u);fill-opacity:0.12" }, svg);
    el("line", { x1: 0, x2: 520, y1: Y(w), y2: Y(w), style: "stroke:var(--vec-u);stroke-width:1.2" }, svg);
    el("path", { d: "M" + sub.map(([x, y]) => `${X(x)} ${Y(y)}`).join("L") + "Z", style: "fill:var(--vec-u);fill-opacity:0.25" }, svg);
    el("path", { d: "M" + hull.map(([x, y]) => `${X(x)} ${Y(y)}`).join("L") + "Z", style: "fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round" }, svg);
    // Centres: G (weight down), B (buoyancy up), metacentre M on the centreline.
    const M = rot([0, KB + BM]);
    const mark = (p, label, color) => {
      el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 4.5, style: `fill:var(--background);stroke:${color};stroke-width:2` }, svg);
      text(svg, X(p[0]) + 8, Y(p[1]) - 6, label, { class: "fill-foreground font-mono text-[11px]" });
    };
    const cl0 = rot([0, -0.5]), cl1 = rot([0, Math.max(D, KB + BM) + 1]);
    el("line", { x1: X(cl0[0]), y1: Y(cl0[1]), x2: X(cl1[0]), y2: Y(cl1[1]), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4" }, svg);
    el("line", { x1: X(g[0]), y1: Y(g[1]), x2: X(g[0]), y2: Y(g[1]) + 50, style: "stroke:var(--code-del);stroke-width:2" }, svg);
    el("line", { x1: X(cb.cx), y1: Y(cb.cy), x2: X(cb.cx), y2: Y(cb.cy) - 50, style: "stroke:var(--code-add);stroke-width:2" }, svg);
    if (Math.abs(KB + BM) < span * 2) mark(M, "M", "var(--brand)");
    mark(g, "G", "var(--code-del)");
    mark([cb.cx, cb.cy], "B", "var(--code-add)");
    text(svg, 8, 16, `heel ${num(s.heel.get(), 0)}°`, { class: "fill-foreground font-mono text-[11px]" });

    o.gm.textContent = `${num(GM, 2)} m`;
    o.gz.textContent = `${num(gz, 3)} m`;
    o.gzs.textContent = `${num(gzs, 3)} m`;
    const ok = GM > 0 && gz > 0;
    o.verdict.textContent = GM <= 0 ? "unstable: capsizes (GM ≤ 0)" : gz <= 0 && phi > 0 ? "past the angle of vanishing stability" : deckWet ? "stable, but the deck edge is under water" : "stable: B moves out past G and rights her";
    o.verdict.className = ok && !deckWet ? "text-add" : "text-del";
  }
  draw();
}

// ============================================================ Venturi

for (const root of document.querySelectorAll("[data-fluid-venturi]")) {
  const svg = root.querySelector("[data-pipe]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  const setPlay = playButton(btn, ["Flow", "Pause"]);
  const RHO = 998;
  const s = scrubAll(root, draw);
  let tracers = Array.from({ length: 40 }, (_, i) => ({ x: (i * 13.7) % 1, r: ((i * 7.31) % 1) * 1.6 - 0.8 }));
  let playing = false, visible = false, raf = 0, last = 0;

  // Radius profile along the tube (fraction 0..1): inlet, smooth contraction,
  // throat, longer diffuser.
  const profile = (u, r1, r2) => {
    if (u < 0.25 || u > 0.92) return r1;
    if (u < 0.42) return r1 + (r2 - r1) * (1 - Math.cos(((u - 0.25) / 0.17) * Math.PI)) / 2;
    if (u < 0.5) return r2;
    return r2 + (r1 - r2) * (1 - Math.cos(((u - 0.5) / 0.42) * Math.PI)) / 2;
  };

  function state() {
    const Q = s.q.get() / 1000, d1 = s.d1.get() / 100;
    const d2 = Math.min(s.d2.get(), s.d1.get()) / 100;
    const A1 = (Math.PI * d1 * d1) / 4, A2 = (Math.PI * d2 * d2) / 4;
    const v1 = Q / A1, v2 = Q / A2, dp = 0.5 * RHO * (v2 * v2 - v1 * v1);
    return { Q, d1, d2, A1, A2, v1, v2, dp };
  }

  function draw() {
    const st = state();
    svg.replaceChildren();
    const x0 = 30, x1 = 530, cy = 215, k = 300; // px per metre of radius scale
    const r1 = (st.d1 / 2) * k * 1.6, r2 = (st.d2 / 2) * k * 1.6;
    const rr = (u) => profile(u, r1, r2);
    const N = 120;
    const topPts = [], botPts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = x0 + u * (x1 - x0), r = rr(u);
      topPts.push([x, cy - r]); botPts.push([x, cy + r]);
    }
    el("path", { d: "M" + topPts.map((p) => p.join(" ")).join("L") + "L" + botPts.reverse().map((p) => p.join(" ")).join("L") + "Z", style: "fill:var(--vec-u);fill-opacity:0.12" }, svg);
    polyline(svg, topPts, "stroke:currentColor;stroke-width:2");
    polyline(svg, botPts, "stroke:currentColor;stroke-width:2");
    // Piezometers: head p/ρg above the axis; inlet column at a reference height.
    const dh = st.dp / (RHO * G);
    const scale = Math.min(400, 110 / Math.max(dh, 1e-6)); // px per metre of head
    const hInlet = 150;
    const cols = [[0.12, hInlet], [0.46, hInlet - dh * scale], [0.96, hInlet]];
    for (const [u, hh] of cols) {
      const x = x0 + u * (x1 - x0), r = rr(u);
      el("rect", { x: x - 4, y: cy - r - 160, width: 8, height: 160, style: "fill:none;stroke:currentColor;stroke-opacity:0.5" }, svg);
      const top = cy - r - Math.max(4, hh);
      el("rect", { x: x - 3, y: top, width: 6, height: cy - r - top, style: "fill:var(--vec-u);fill-opacity:0.55" }, svg);
    }
    const xa = x0 + 0.12 * (x1 - x0), xb = x0 + 0.46 * (x1 - x0);
    const ya = cy - r1 - hInlet, yb = cy - r2 - Math.max(4, hInlet - dh * scale);
    el("path", { d: `M${xa + 8} ${ya}H${xb - 14}M${xb - 14} ${ya}V${yb}`, style: "fill:none;stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    text(svg, xb - 18, (ya + yb) / 2, `Δh ${length(dh)}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    text(svg, xa, cy + r1 + 18, `v₁ ${num(st.v1, 2)} m/s`, { "text-anchor": "middle" });
    text(svg, xb, cy + r2 + 18, `v₂ ${num(st.v2, 2)} m/s`, { "text-anchor": "middle" });
    // Tracers move at the local mean speed Q/A.
    const g = el("g", {}, svg);
    for (const t of tracers) {
      const x = x0 + t.x * (x1 - x0), r = rr(t.x);
      el("circle", { cx: x, cy: cy + t.r * r * 0.8, r: 1.8, style: "fill:var(--vec-u)" }, g);
    }
    o.v1.textContent = `${num(st.v1, 3)} m/s`;
    o.v2.textContent = `${num(st.v2, 3)} m/s`;
    o.dp.textContent = pressure(st.dp);
    o.dh.textContent = length(dh);
    const qBack = st.A2 * Math.sqrt((2 * st.dp) / (RHO * (1 - (st.A2 / st.A1) ** 2)));
    o.qback.textContent = st.d2 >= st.d1 ? "throat ≥ inlet: no reading" : `${num(qBack * 1000, 3)} L/s`;
  }

  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const st = state();
    for (const t of tracers) {
      const r = profile(t.x, st.d1, st.d2), A = Math.PI * r * r;
      t.x += (dt * (st.Q / (A / 4))) / 3; // speed ∝ Q/A, tube shown ≈ 3 m long
      if (t.x > 1) t.x -= 1;
    }
    draw();
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (!raf && playing && visible) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  btn.addEventListener("click", () => { playing = !playing; setPlay(playing); start(); });
  watchVisible(root, (v) => { visible = v; start(); });
  setPlay(false);
  draw();
}

// ============================================================ Pipe friction

const PIPE_FLUIDS = { water: { rho: 998, mu: 1.0e-3 }, air: { rho: 1.204, mu: 1.81e-5 } };

// Colebrook–White, iterated on x = 1/√f from the Swamee–Jain estimate.
function colebrook(re, rel) {
  let f = 0.25 / Math.log10(rel / 3.7 + 5.74 / re ** 0.9) ** 2;
  let x = 1 / Math.sqrt(f), n = 0;
  for (; n < 50; n++) {
    const nx = -2 * Math.log10(rel / 3.7 + (2.51 * x) / re);
    if (Math.abs(nx - x) < 1e-12) { x = nx; n++; break; }
    x = nx;
  }
  return { f: 1 / (x * x), n };
}

for (const root of document.querySelectorAll("[data-fluid-pipe]")) {
  const svg = root.querySelector("[data-moody]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const fluid = seg(root, "water", draw);

  function draw() {
    const { rho, mu } = PIPE_FLUIDS[fluid()];
    const v = s.v.get(), D = s.d.get() / 1000, eps = s.eps.get() / 1000, Lp = s.len.get();
    const re = (rho * v * D) / mu, rel = eps / D;
    let f, n = 0, regime;
    if (re < 2300) { f = 64 / re; regime = "laminar"; }
    else { const c = colebrook(re, rel); f = c.f; n = c.n; regime = re < 4000 ? "transitional (uncertain)" : "turbulent"; }
    const hl = f * (Lp / D) * (v * v) / (2 * G);

    svg.replaceChildren();
    const ly = (x) => Math.log10(x);
    const fr = frame(svg, { box: [52, 16, 440, 310], x: [2.5, 8], y: [ly(0.005), ly(0.1)],
      xticks: [3, 4, 5, 6, 7, 8], yticks: [0.006, 0.008, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.07, 0.1].map(ly),
      xfmt: (t) => `10${sup(t)}`, yfmt: (t) => String(+(10 ** t).toFixed(3)), xlabel: "Reynolds number Re", ylabel: "f" });
    el("rect", { x: fr.sx(ly(2300)), y: fr.T, width: fr.sx(ly(4000)) - fr.sx(ly(2300)), height: fr.H, style: "fill:currentColor;fill-opacity:0.05" }, svg);
    const clipY = (y) => Math.max(fr.T, Math.min(fr.T + fr.H, y));
    const lam = [];
    for (let x = ly(640); x <= ly(4000); x += 0.02) lam.push([fr.sx(x), clipY(fr.sy(ly(64 / 10 ** x)))]);
    polyline(svg, lam, "stroke:currentColor;stroke-width:1.4");
    text(svg, fr.sx(2.6), fr.sy(ly(64 / 10 ** 3.2)) - 6, "64/Re");
    for (const r of [0, 1e-5, 1e-4, 1e-3, 5e-3, 0.01, 0.03, 0.05]) {
      const pts = [];
      for (let x = ly(2300); x <= 8.0001; x += 0.04) pts.push([fr.sx(x), clipY(fr.sy(ly(colebrook(10 ** x, r).f)))]);
      polyline(svg, pts, `stroke:var(--vec-u);stroke-opacity:${x2op(r)};stroke-width:1.1`);
      const fe = colebrook(1e8, r).f;
      text(svg, fr.L + fr.W + 4, fr.sy(ly(fe)) + 3, r === 0 ? "smooth" : String(r), { class: "fill-muted-foreground font-mono text-[9px]" });
    }
    text(svg, fr.L + fr.W + 4, fr.T - 4, "ε/D", { class: "fill-muted-foreground font-mono text-[9px]" });
    const inPlot = ly(re) >= 2.5 && ly(re) <= 8 && f >= 0.005 && f <= 0.1;
    if (inPlot) {
      el("line", { x1: fr.sx(ly(re)), x2: fr.sx(ly(re)), y1: fr.T, y2: fr.T + fr.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
      el("circle", { cx: fr.sx(ly(re)), cy: fr.sy(ly(f)), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    } else {
      text(svg, fr.L + 8, fr.T + 14, "operating point outside the chart", { class: "fill-foreground font-mono text-[10px]" });
    }
    o.re.textContent = sci(re, 3);
    o.regime.textContent = regime;
    o.rel.textContent = sci(rel, 2);
    o.f.textContent = num(f, 4);
    o.hl.textContent = length(hl);
    o.dp.textContent = pressure(rho * G * hl);
    o.iter.textContent = re < 2300 ? "— (laminar: f = 64/Re)" : String(n);
  }
  const x2op = (r) => (r === 0 ? 0.9 : 0.35 + 0.1 * Math.min(5, -Math.log10(r)));
  draw();
}

// ============================================================ Potential flow

for (const root of document.querySelectorAll("[data-fluid-potential]")) {
  const svg = root.querySelector("[data-field]");
  const o = outs(root);
  const W = 600, H = 360, K = 60; // px per metre, world x ∈ [−5, 5], y ∈ [−3, 3]
  const X = (x) => W / 2 + x * K, Y = (y) => H / 2 - y * K;
  const RHO = 1.204, A = 1; // cylinder radius 1 m
  let movers = { source: [-1, 0], sink: [1, 0], spot: [0, 0] };
  const preset = seg(root, "cylinder", (v) => {
    // Clockwise circulation (Γ < 0 here): the flow over the top speeds up and lift points up.
    if (v === "lifting" && Math.abs(s.gamma.get()) < 1e-9) s.gamma.set(-6, false);
    if (v === "vortex") { movers.spot = [0, 0]; if (Math.abs(s.gamma.get()) < 1e-9) s.gamma.set(8, false); }
    if (v === "cylinder") s.gamma.set(0, false);
    if (v === "rankine") movers = { ...movers, source: [-1, 0], sink: [1, 0] };
    draw();
  });
  const s = scrubAll(root, draw);

  function elements() {
    const U = s.u.get(), gam = s.gamma.get(), m = s.m.get(), p = preset();
    if (p === "cylinder" || p === "lifting") return { U, list: [{ t: "doublet", x: 0, y: 0, k: U * A * A }, { t: "vortex", x: 0, y: 0, k: gam }] };
    if (p === "rankine") return { U, list: [{ t: "source", x: movers.source[0], y: movers.source[1], k: m }, { t: "source", x: movers.sink[0], y: movers.sink[1], k: -m }] };
    return { U: 0, list: [{ t: "source", x: movers.spot[0], y: movers.spot[1], k: m }, { t: "vortex", x: movers.spot[0], y: movers.spot[1], k: gam }] };
  }

  function psi(x, y, E) {
    let v = E.U * y;
    for (const e of E.list) {
      const dx = x - e.x, dy = y - e.y, r2 = dx * dx + dy * dy || 1e-12;
      if (e.t === "source") v += (e.k / (2 * Math.PI)) * Math.atan2(dy, dx);
      else if (e.t === "vortex") v += (-e.k / (2 * Math.PI)) * 0.5 * Math.log(r2);
      else v += (-e.k * dy) / r2;
    }
    return v;
  }
  function vel(x, y, E) {
    let u = E.U, v = 0;
    for (const e of E.list) {
      const dx = x - e.x, dy = y - e.y, r2 = dx * dx + dy * dy || 1e-12;
      if (e.t === "source") { u += (e.k / (2 * Math.PI)) * dx / r2; v += (e.k / (2 * Math.PI)) * dy / r2; }
      else if (e.t === "vortex") { u += (-e.k / (2 * Math.PI)) * dy / r2; v += (e.k / (2 * Math.PI)) * dx / r2; }
      else { u += (-e.k * (dx * dx - dy * dy)) / (r2 * r2); v += (-2 * e.k * dx * dy) / (r2 * r2); }
    }
    return [u, v];
  }

  // Marching squares over ψ; cells straddling a branch cut of atan2 or a
  // singularity are skipped.
  function contours(E, levels) {
    const nx = 150, ny = 90, dx = 10 / nx, dy = 6 / ny;
    const vals = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) vals[j * (nx + 1) + i] = psi(-5 + i * dx, -3 + j * dy, E);
    const near = (x, y) => E.list.some((e) => (x - e.x) ** 2 + (y - e.y) ** 2 < 0.02);
    let d = "";
    const jump = Math.max(...E.list.filter((e) => e.t === "source").map((e) => Math.abs(e.k)), 0) * 0.4;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = vals[j * (nx + 1) + i], b = vals[j * (nx + 1) + i + 1], c = vals[(j + 1) * (nx + 1) + i + 1], q = vals[(j + 1) * (nx + 1) + i];
      const x = -5 + i * dx, y = -3 + j * dy;
      if (near(x + dx / 2, y + dy / 2)) continue;
      if (jump > 0 && Math.max(a, b, c, q) - Math.min(a, b, c, q) > jump) continue;
      for (const L of levels) {
        const pts = [];
        const edge = (v0, v1, x0, y0, x1, y1) => {
          if ((v0 < L) !== (v1 < L)) { const t = (L - v0) / (v1 - v0); pts.push([x0 + t * (x1 - x0), y0 + t * (y1 - y0)]); }
        };
        edge(a, b, x, y, x + dx, y);
        edge(b, c, x + dx, y, x + dx, y + dy);
        edge(c, q, x + dx, y + dy, x, y + dy);
        edge(q, a, x, y + dy, x, y);
        for (let k = 0; k + 1 < pts.length; k += 2) d += `M${X(pts[k][0]).toFixed(1)} ${Y(pts[k][1]).toFixed(1)}L${X(pts[k + 1][0]).toFixed(1)} ${Y(pts[k + 1][1]).toFixed(1)}`;
      }
    }
    return d;
  }

  function draw() {
    const E = elements(), p = preset();
    svg.replaceChildren();
    // Pressure coefficient shading (only with a free stream).
    if (E.U > 0) {
      const g = el("g", {}, svg);
      for (let j = 0; j < 30; j++) for (let i = 0; i < 50; i++) {
        const x = -5 + (i + 0.5) * 0.2, y = -3 + (j + 0.5) * 0.2;
        if ((p === "cylinder" || p === "lifting") && x * x + y * y < A * A) continue;
        const [u, v] = vel(x, y, E);
        const cp = 1 - (u * u + v * v) / (E.U * E.U);
        const a = Math.min(0.35, Math.abs(cp) * 0.12);
        if (a > 0.01) el("rect", { x: X(x - 0.1), y: Y(y + 0.1), width: 12.2, height: 12.2, style: `fill:${cp < 0 ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${a.toFixed(3)}` }, g);
      }
    }
    // Streamline levels: evenly spaced in ψ.
    const step = E.U > 0 ? E.U * 0.25 : Math.max(0.2, Math.abs(s.m.get()) / 16);
    const levels = [];
    for (let k = -40; k <= 40; k++) levels.push(k * step + (E.U > 0 ? 0 : step / 2));
    el("path", { d: contours(E, levels), style: "fill:none;stroke:currentColor;stroke-opacity:0.55;stroke-width:1" }, svg);
    if (E.U > 0) el("path", { d: contours(E, [0]), style: "fill:none;stroke:var(--vec-u);stroke-width:1.6" }, svg);
    if (p === "cylinder" || p === "lifting") {
      el("circle", { cx: X(0), cy: Y(0), r: A * K, style: "fill:var(--background);stroke:currentColor;stroke-width:2" }, svg);
      const gam = s.gamma.get();
      if (Math.abs(gam) > 1e-9) {
        const dir = gam > 0 ? 0 : 1;
        el("path", { d: `M${X(-0.45)} ${Y(0.05)}A${0.45 * K} ${0.45 * K} 0 1 ${dir} ${X(0.45)} ${Y(0.05)}`, style: "fill:none;stroke:var(--brand);stroke-width:1.5" }, svg);
      }
    }
    // Stagnation points, found as minima of |V| on a fine grid near zero.
    const stags = [];
    if (p === "cylinder" || p === "lifting") {
      const U = E.U, gam = s.gamma.get();
      const sn = gam / (4 * Math.PI * U * A);
      if (U > 0 && Math.abs(sn) <= 1) {
        const t = Math.asin(sn);
        stags.push([A * Math.cos(t), A * Math.sin(t)], [-A * Math.cos(t), A * Math.sin(t)]);
      } else if (U > 0) {
        // Off the body, on the y axis: U(1 + a²/y²) = Γ/(2π|y|) with the sign of −Γ.
        const sgn = gam > 0 ? 1 : -1, c = Math.abs(gam) / (2 * Math.PI * U);
        const y = (c + Math.sqrt(c * c - 4 * A * A)) / 2;
        stags.push([0, sgn * y]);
      }
    }
    for (const [x, y] of stags) el("circle", { cx: X(x), cy: Y(y), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    // Draggable singularities.
    const handles = p === "rankine" ? [["source", "+"], ["sink", "−"]] : p === "vortex" ? [["spot", "+"]] : [];
    for (const [key, sign] of handles) {
      const [hx, hy] = movers[key];
      const c = el("circle", { cx: X(hx), cy: Y(hy), r: 9, tabindex: 0, role: "slider", "aria-label": `Move the ${key === "sink" ? "sink" : "source"}`, class: "cursor-grab outline-none", style: `fill:var(--background);stroke:${sign === "+" ? "var(--code-add)" : "var(--code-del)"};stroke-width:2` }, svg);
      text(svg, X(hx), Y(hy) + 4, sign, { "text-anchor": "middle", class: "pointer-events-none fill-foreground font-mono text-[12px]" });
      c.addEventListener("pointerdown", (e) => { c.setPointerCapture(e.pointerId); dragging = key; });
      c.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
        if (!d) return;
        e.preventDefault();
        movers[key] = [Math.max(-4.5, Math.min(4.5, hx + d[0])), Math.max(-2.5, Math.min(2.5, hy + d[1]))];
        draw();
        svg.querySelector(`[aria-label="${c.getAttribute("aria-label")}"]`)?.focus();
      });
    }
    // Readouts.
    const U = s.u.get(), gam = s.gamma.get();
    if (p === "cylinder" || p === "lifting") {
      o.radius.textContent = "1 m (doublet κ = U·a²)";
      const ang = ([x, y]) => { const a = (Math.atan2(y, x) * 180) / Math.PI; return num(Math.abs(a) > 179.95 ? 180 : a + 0, 1); };
      o.stag.textContent = stags.length === 2 ? `θ = ${ang(stags[0])}° and ${ang(stags[1])}°` : stags.length ? `one point, off the body at y = ${num(stags[0][1], 2)} m` : "—";
      o.lift.textContent = `${num(-RHO * U * gam, 2)} N/m ${-gam > 0 ? "up" : -gam < 0 ? "down" : ""} (L′ = −ρUΓ, Γ counter-clockwise)`;
    } else if (p === "rankine") {
      const m = s.m.get();
      o.radius.textContent = "—";
      // Stagnation on the axis when the sources sit on it: U = m/2π (1/(x−xs) − 1/(x−xk)) solved numerically.
      o.stag.textContent = "where the ψ = 0 streamline closes (blue)";
      o.lift.textContent = "0 N/m (no circulation)";
      o.radius.textContent = `body half-width ≈ ${num(halfWidth(E), 2)} m`;
      void m;
    } else {
      o.radius.textContent = "—";
      o.stag.textContent = "none: a spiral vortex-source";
      o.lift.textContent = "— (no free stream)";
    }
    o.drag.textContent = "0 (d'Alembert's paradox)";
  }
  // Half-width of the closed body: largest |y| of the ψ = 0 line above the
  // sources (scan up the line x = midpoint until ψ changes sign).
  function halfWidth(E) {
    const xm = (movers.source[0] + movers.sink[0]) / 2, ym = (movers.source[1] + movers.sink[1]) / 2;
    const p0 = psi(xm, ym + 0.01, E);
    for (let y = 0.02; y < 3; y += 0.005) if (Math.sign(psi(xm, ym + y, E)) !== Math.sign(p0) || Math.abs(psi(xm, ym + y, E)) < 1e-4) return y;
    return NaN;
  }

  let dragging = null;
  svg.addEventListener("pointermove", (e) => {
    if (!dragging || !(e.buttons & 1)) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    movers[dragging] = [Math.max(-4.5, Math.min(4.5, (q.x - W / 2) / K)), Math.max(-2.5, Math.min(2.5, (H / 2 - q.y) / K))];
    draw();
  });
  svg.addEventListener("pointerup", () => (dragging = null));
  svg.addEventListener("pointercancel", () => (dragging = null));
  draw();
}

// ============================================================ Stable fluids

// rgbOf resolves a CSS colour to [r, g, b] by painting one pixel.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function rgbOf(css) {
  const span = document.createElement("span");
  span.style.color = css;
  span.hidden = true;
  document.body.append(span);
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(span).color;
  span.remove();
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

for (const root of document.querySelectorAll("[data-fluid-smoke]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  const setPlay = playButton(btn, ["Run", "Pause"]);
  const s = scrubAll(root, () => {});
  const N = 64, SZ = (N + 2) * (N + 2);
  const IX = (i, j) => i + (N + 2) * j;
  let u = new Float32Array(SZ), v = new Float32Array(SZ), u0 = new Float32Array(SZ), v0 = new Float32Array(SZ);
  let d = new Float32Array(SZ), d0 = new Float32Array(SZ);
  let showVel = false, playing = !reduced(), visible = false, raf = 0, last = 0, colors = null;
  const dt = 0.1;

  // b = 1: u reflects on the side walls, 2: v on the top/bottom, 0: copy.
  function bnd(b, x) {
    for (let i = 1; i <= N; i++) {
      x[IX(0, i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)];
      x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)];
      x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
      x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)];
    }
    x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, N + 1)] = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)]);
    x[IX(N + 1, 0)] = 0.5 * (x[IX(N, 0)] + x[IX(N + 1, 1)]);
    x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)]);
  }
  function linSolve(b, x, x0, a, c, iters) {
    for (let k = 0; k < iters; k++) {
      for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++)
        x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) / c;
      bnd(b, x);
    }
  }
  function diffuse(b, x, x0, diff, iters) {
    const a = dt * diff * N * N;
    if (a === 0) { x.set(x0); bnd(b, x); return; }
    linSolve(b, x, x0, a, 1 + 4 * a, iters);
  }
  function advect(b, dd, dd0, uu, vv) {
    const dt0 = dt * N;
    for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) {
      let x = i - dt0 * uu[IX(i, j)], y = j - dt0 * vv[IX(i, j)];
      x = Math.max(0.5, Math.min(N + 0.5, x)); y = Math.max(0.5, Math.min(N + 0.5, y));
      const i0 = Math.floor(x), j0 = Math.floor(y), s1 = x - i0, t1 = y - j0;
      dd[IX(i, j)] = (1 - s1) * ((1 - t1) * dd0[IX(i0, j0)] + t1 * dd0[IX(i0, j0 + 1)]) + s1 * ((1 - t1) * dd0[IX(i0 + 1, j0)] + t1 * dd0[IX(i0 + 1, j0 + 1)]);
    }
    bnd(b, dd);
  }
  function project(uu, vv, p, div, iters) {
    const h = 1 / N;
    for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) {
      div[IX(i, j)] = -0.5 * h * (uu[IX(i + 1, j)] - uu[IX(i - 1, j)] + vv[IX(i, j + 1)] - vv[IX(i, j - 1)]);
      p[IX(i, j)] = 0;
    }
    bnd(0, div); bnd(0, p);
    linSolve(0, p, div, 1, 4, iters);
    for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) {
      uu[IX(i, j)] -= (0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)])) / h;
      vv[IX(i, j)] -= (0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)])) / h;
    }
    bnd(1, uu); bnd(2, vv);
  }
  function maxDivergence() {
    let m = 0;
    for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++)
      m = Math.max(m, Math.abs(0.5 * N * (u[IX(i + 1, j)] - u[IX(i - 1, j)] + v[IX(i, j + 1)] - v[IX(i, j - 1)])));
    return m;
  }

  function step() {
    const visc = s.visc.get() * 1e-5, iters = Math.round(s.iters.get());
    // Velocity: add forces (already in u0/v0), diffuse, project, advect, project.
    for (let k = 0; k < SZ; k++) { u[k] += dt * u0[k]; v[k] += dt * v0[k]; }
    [u0, u] = [u, u0]; diffuse(1, u, u0, visc, iters);
    [v0, v] = [v, v0]; diffuse(2, v, v0, visc, iters);
    project(u, v, u0, v0, iters);
    [u0, u] = [u, u0]; [v0, v] = [v, v0];
    advect(1, u, u0, u0, v0); advect(2, v, v0, u0, v0);
    project(u, v, u0, v0, iters);
    // Density: add source, advect, fade.
    for (let k = 0; k < SZ; k++) d[k] += dt * d0[k];
    [d0, d] = [d, d0];
    advect(0, d, d0, u, v);
    const fade = 1 - (s.fade.get() / 100) * dt;
    for (let k = 0; k < SZ; k++) d[k] *= fade;
    u0.fill(0); v0.fill(0); d0.fill(0);
  }

  function render() {
    const ctx = canvas.getContext("2d");
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), hgt = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
    colors ??= { bg: rgbOf("var(--background)"), ink: rgbOf("var(--foreground)"), vec: rgbOf("var(--brand)") };
    const img = new ImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = Math.min(1, d[IX(i + 1, j + 1)]);
      const k = ((N - 1 - j) * N + i) * 4;
      for (let c = 0; c < 3; c++) img.data[k + c] = colors.bg[c] * (1 - a * 0.85) + colors.ink[c] * a * 0.85;
      img.data[k + 3] = 255;
    }
    const off = new OffscreenCanvas(N, N);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, hgt);
    if (showVel) {
      ctx.strokeStyle = `rgb(${colors.vec.join(",")})`;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      for (let j = 2; j <= N; j += 4) for (let i = 2; i <= N; i += 4) {
        const x = ((i - 0.5) / N) * w, y = (1 - (j - 0.5) / N) * hgt;
        ctx.moveTo(x, y);
        ctx.lineTo(x + u[IX(i, j)] * w * 0.5, y - v[IX(i, j)] * hgt * 0.5);
      }
      ctx.stroke();
    }
  }

  function puff() {
    for (let j = 6; j <= 14; j++) for (let i = N / 2 - 5; i <= N / 2 + 5; i++) {
      d0[IX(i, j)] += 60;
      v0[IX(i, j)] += 2.5;
    }
  }

  // Pointer: the drag direction pushes the fluid and leaves smoke.
  let prev = null;
  const cell = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * N + 0.5, (1 - (e.clientY - r.top) / r.height) * N + 0.5];
  };
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); prev = cell(e); ensure(); });
  canvas.addEventListener("pointermove", (e) => {
    if (!prev) return;
    const c = cell(e), i = Math.round(c[0]), j = Math.round(c[1]);
    if (i >= 1 && i <= N && j >= 1 && j <= N) {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = Math.max(1, Math.min(N, i + di)), jj = Math.max(1, Math.min(N, j + dj));
        // Drag distance in cells → velocity in box widths per unit time.
        u0[IX(ii, jj)] += ((c[0] - prev[0]) / N) * 30;
        v0[IX(ii, jj)] += ((c[1] - prev[1]) / N) * 30;
        d0[IX(ii, jj)] += 25;
      }
    }
    prev = c;
    if (!playing) { step(); render(); }
  });
  const up = () => (prev = null);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  const loop = (now) => {
    const t0 = performance.now();
    step();
    render();
    const ms = performance.now() - t0;
    if (now - last > 250) {
      last = now;
      let m = 0;
      for (let k = 0; k < SZ; k++) m = Math.max(m, Math.hypot(u[k], v[k]));
      o.speed.textContent = `${num(m * N * dt, 2)} cells/step`;
      o.div.textContent = sci(maxDivergence(), 2);
      o.ms.textContent = `${num(ms, 1)} ms`;
    }
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  function ensure() { if (!raf && playing && visible) raf = requestAnimationFrame(loop); }
  btn.addEventListener("click", () => { playing = !playing; setPlay(playing); ensure(); });
  root.querySelector("[data-action=puff]").addEventListener("click", () => { puff(); if (!playing) for (let k = 0; k < 20; k++) step(); render(); ensure(); });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { for (const a of [u, v, u0, v0, d, d0]) a.fill(0); render(); });
  onToggle(root, (_, on) => { showVel = on; render(); });
  watchVisible(root, (vis) => { visible = vis; ensure(); });
  new MutationObserver(() => { colors = null; render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  setPlay(playing);
  // Start with smoke already rising, so the box is never empty.
  puff();
  for (let k = 0; k < 30; k++) step();
  render();
  o.div.textContent = sci(maxDivergence(), 2);
}

// ============================================================ Terminal velocity

const DRAG_PRESETS = {
  rain: { d: 2, rho: 1000, fluid: "air" },
  sand: { d: 0.2, rho: 2650, fluid: "water" },
  steel: { d: 5, rho: 7850, fluid: "water" },
  skydiver: { d: 0, rho: 0, fluid: "air" },
};
const DRAG_FLUIDS = { air: { rho: 1.204, mu: 1.81e-5, name: "air, 20 °C" }, water: { rho: 998, mu: 1.0e-3, name: "water, 20 °C" } };
// Sphere drag: Schiller–Naumann to Re = 1000, then the Newton plateau.
const cdSphere = (re) => (re <= 1000 ? (24 / re) * (1 + 0.15 * re ** 0.687) : 0.44);

for (const root of document.querySelectorAll("[data-fluid-drag]")) {
  const cdSvg = root.querySelector("[data-cd]");
  const fall = root.querySelector("[data-fall]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const preset = seg(root, "rain", (p) => {
    const q = DRAG_PRESETS[p];
    if (p !== "skydiver") { s.d.set(q.d, false); s.rho.set(q.rho, false); }
    draw();
  });

  function draw() {
    const p = preset(), F = DRAG_FLUIDS[DRAG_PRESETS[p].fluid];
    let weight, mass, dragOf, re = NaN, cd = NaN, stokes = NaN;
    if (p === "skydiver") {
      mass = 80; weight = mass * G; // buoyancy in air is negligible here
      dragOf = (v) => 0.5 * F.rho * v * v * 0.43;
    } else {
      const d = s.d.get() / 1000, rs = s.rho.get();
      const V = (Math.PI * d ** 3) / 6, A = (Math.PI * d * d) / 4;
      mass = rs * V; weight = (rs - F.rho) * G * V;
      dragOf = (v) => (v <= 0 ? 0 : 0.5 * F.rho * v * v * A * cdSphere((F.rho * v * d) / F.mu));
      stokes = ((rs - F.rho) * G * d * d) / (18 * F.mu);
    }
    let vt = NaN;
    if (weight > 0) {
      let lo = 0, hi = 1;
      while (dragOf(hi) < weight && hi < 1e5) hi *= 2;
      for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; dragOf(m) < weight ? (lo = m) : (hi = m); }
      vt = (lo + hi) / 2;
    }
    if (p !== "skydiver" && Number.isFinite(vt)) {
      const d = s.d.get() / 1000;
      re = (F.rho * vt * d) / F.mu; cd = cdSphere(re);
    }
    // Speed against time: m dv/dt = W − drag (RK4, no added mass).
    const pts = [];
    let v = 0, t = 0, t95 = NaN;
    if (Number.isFinite(vt)) {
      const acc = (vv) => (weight - dragOf(vv)) / mass;
      // Long enough for 95%: several times vt over the initial acceleration.
      const tScale = (6 * vt) / (weight / mass);
      const dtt = tScale / 4000;
      for (let k = 0; k < 4000; k++) {
        pts.push([t, v]);
        const k1 = acc(v), k2 = acc(v + (dtt * k1) / 2), k3 = acc(v + (dtt * k2) / 2), k4 = acc(v + dtt * k3);
        v += (dtt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        t += dtt;
        if (!Number.isFinite(t95) && v >= 0.95 * vt) t95 = t;
      }
    }

    cdSvg.replaceChildren();
    const ly = Math.log10;
    const f = frame(cdSvg, { box: [44, 14, 320, 250], x: [-1, 6], y: [-1, 2.7], xticks: [-1, 0, 1, 2, 3, 4, 5, 6], yticks: [-1, 0, 1, 2], xfmt: (x) => `10${sup(x)}`, yfmt: (y) => String(10 ** y), xlabel: "Re", ylabel: "C_d" });
    const curve = [], stokesLine = [];
    for (let x = -1; x <= 6; x += 0.02) {
      curve.push([f.sx(x), f.sy(ly(cdSphere(10 ** x)))]);
      const c = 24 / 10 ** x;
      if (ly(c) <= 2.7 && ly(c) >= -1) stokesLine.push([f.sx(x), f.sy(ly(c))]);
    }
    polyline(cdSvg, stokesLine, "stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:4 4");
    polyline(cdSvg, curve, "stroke:var(--vec-u);stroke-width:1.75");
    text(cdSvg, f.sx(-0.8), f.sy(ly(24 / 10 ** -0.4)), "Stokes 24/Re");
    if (Number.isFinite(re) && ly(re) >= -1 && ly(re) <= 6) el("circle", { cx: f.sx(ly(re)), cy: f.sy(ly(cd)), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, cdSvg);

    fall.replaceChildren();
    if (pts.length) {
      const tMax = pts.at(-1)[0];
      const g = frame(fall, { box: [40, 14, 186, 250], x: [0, tMax], y: [0, vt * 1.1], xticks: [0, tMax / 2, tMax], yticks: [0, vt], xfmt: (x) => (tMax < 0.1 ? `${num(x * 1000, 0)} ms` : `${num(x, 1)} s`), yfmt: (y) => num(y, y < 1 ? 3 : 1), xlabel: "t", ylabel: "v (m/s)" });
      hline(fall, g, vt, "stroke:var(--brand);stroke-dasharray:3 3", "terminal");
      polyline(fall, pts.filter((_, i) => i % 20 === 0).map(([tt, vv]) => [g.sx(tt), g.sy(vv)]), "stroke:var(--foreground);stroke-width:1.75");
    }

    o.fluid.textContent = F.name;
    o.vt.textContent = Number.isFinite(vt) ? `${num(vt, vt < 1 ? 4 : 2)} m/s` : "floats (lighter than the fluid)";
    o.stokes.textContent = p === "skydiver" ? "not a small sphere" : Number.isFinite(stokes) && stokes > 0 ? `${num(stokes, stokes < 1 ? 4 : 1)} m/s${re > 1 ? " (invalid: Re > 1)" : " (valid: Re < 1)"}` : "—";
    o.re.textContent = p === "skydiver" ? "≈ 2×10⁶ (body length 0.5 m)" : sci(re, 3);
    o.cd.textContent = p === "skydiver" ? "C_d·A ≈ 0.43 m²" : num(cd, 3);
    o.t95.textContent = Number.isFinite(t95) ? (t95 < 0.1 ? `${num(t95 * 1000, 1)} ms` : `${num(t95, 2)} s`) : "—";
    for (const inp of root.querySelectorAll("[data-scrub]")) inp.disabled = p === "skydiver";
  }
  draw();
}

// ============================================================ Boundary layer

const BL_FLUIDS = { air: 1.81e-5 / 1.204, water: 1.0e-3 / 998 };

for (const root of document.querySelectorAll("[data-fluid-bl]")) {
  const svg = root.querySelector("[data-plate]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const fluid = seg(root, "air", draw);
  const RE_T = 5e5;

  function draw() {
    const nu = BL_FLUIDS[fluid()], U = s.u.get(), L = s.len.get();
    const xt = (RE_T * nu) / U;
    const lam = (x) => (x <= 0 ? 0 : 5 * Math.sqrt((nu * x) / U));
    const turb = (x) => (x <= 0 ? 0 : 0.37 * x ** 0.8 * (nu / U) ** 0.2);
    // Virtual origin x₀: the turbulent layer starts where its thickness
    // matches the laminar one at transition, so δ is continuous.
    const xv = xt - (lam(xt) / (0.37 * (nu / U) ** 0.2)) ** 1.25;
    const delta = (x) => (x < xt ? lam(x) : turb(x - xv));
    const xs = Array.from({ length: 301 }, (_, i) => (i / 300) * L);
    const dMax = Math.max(...xs.map(delta));
    svg.replaceChildren();
    const x0 = 40, x1 = 560, yb = 260, kx = (x1 - x0) / L, ky = 170 / dMax;
    el("rect", { x: x0, y: yb, width: x1 - x0, height: 8, style: "fill:currentColor;fill-opacity:0.35" }, svg);
    const edge = xs.map((x) => [x0 + x * kx, yb - delta(x) * ky]);
    el("path", { d: `M${x0} ${yb}L` + edge.map((p) => p.join(" ")).join("L") + `L${x1} ${yb}Z`, style: "fill:var(--vec-u);fill-opacity:0.12" }, svg);
    polyline(svg, edge, "stroke:var(--vec-u);stroke-width:1.6");
    if (xt < L) {
      const tx = x0 + xt * kx;
      el("line", { x1: tx, x2: tx, y1: yb, y2: 40, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, svg);
      text(svg, tx + 4, 50, "transition", {});
    }
    // Free stream arrows.
    for (let y = 30; y < 150; y += 30) el("path", { d: `M8 ${y}H30M25 ${y - 4}L30 ${y}L25 ${y + 4}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.45" }, svg);
    // Velocity profiles: Pohlhausen quartic (laminar) or 1/7 power (turbulent).
    const prof = (eta, turb) => (eta >= 1 ? 1 : turb ? eta ** (1 / 7) : 2 * eta - 2 * eta ** 3 + eta ** 4);
    const probe = (s.probe.get() / 100) * L;
    const stations = [0.15, 0.4, 0.65, 0.9].map((f) => f * L).concat([probe]);
    stations.forEach((x, n) => {
      const dx = delta(x), turb = x >= xt, px = x0 + x * kx, isProbe = n === 4;
      const hpx = Math.min(200, dx * ky * 1.6);
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const y = (k / 24) * hpx, eta = y / Math.max(1e-9, dx * ky);
        pts.push([px + prof(eta, turb) * 40, yb - y]);
      }
      el("line", { x1: px, x2: px, y1: yb, y2: yb - hpx, style: `stroke:${isProbe ? "var(--brand)" : "currentColor"};stroke-opacity:${isProbe ? 0.9 : 0.35}` }, svg);
      polyline(svg, pts, `stroke:${isProbe ? "var(--brand)" : "var(--foreground)"};stroke-width:${isProbe ? 1.8 : 1.1};stroke-opacity:${isProbe ? 1 : 0.6}`);
    });
    // True scale bar for thickness.
    const bar = dMax / 2;
    el("line", { x1: 22, x2: 22, y1: yb, y2: yb - bar * ky, style: "stroke:currentColor;stroke-width:1.5" }, svg);
    el("line", { x1: 18, x2: 26, y1: yb - bar * ky, y2: yb - bar * ky, style: "stroke:currentColor;stroke-width:1.5" }, svg);
    text(svg, 28, yb - bar * ky + 4, length(bar));
    text(svg, x0, yb + 24, "x = 0");
    text(svg, x1, yb + 24, `x = ${num(L, 2)} m`, { "text-anchor": "end" });

    const reP = (U * probe) / nu;
    o.rex.textContent = sci(reP, 3);
    o.delta.textContent = length(delta(probe));
    o.regime.textContent = probe < xt ? "laminar (Blasius)" : "turbulent (1/7 power law)";
    o.xt.textContent = xt < L ? `${length(xt)} from the leading edge` : `beyond the plate (${length(xt)})`;
    o.dend.textContent = length(delta(L));
  }
  draw();
}

// ============================================================ Hydraulic jump

for (const root of document.querySelectorAll("[data-fluid-jump]")) {
  const svg = root.querySelector("[data-channel]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const y1 = s.y1.get(), Fr1 = s.fr.get();
    const v1 = Fr1 * Math.sqrt(G * y1), q = v1 * y1;
    const ratio = 0.5 * (Math.sqrt(1 + 8 * Fr1 * Fr1) - 1), y2 = ratio * y1, v2 = q / y2, Fr2 = v2 / Math.sqrt(G * y2);
    const E1 = y1 + (v1 * v1) / (2 * G), E2 = y2 + (v2 * v2) / (2 * G);
    const dE = (y2 - y1) ** 3 / (4 * y1 * y2);
    svg.replaceChildren();
    const xb = 30, xe = 570, bed = 260, k = 180 / Math.max(E1, y2), jx = 300;
    el("line", { x1: xb, x2: xe, y1: bed, y2: bed, style: "stroke:currentColor;stroke-width:2" }, svg);
    // Water: shallow and fast, then a roller up to the deep, slow level.
    let d = `M${xb} ${bed - y1 * k}H${jx - 30}`;
    const lenJump = Math.min(200, 6 * (y2 - y1) * k / 1.2 + 40); // length ≈ 6 (y₂ − y₁)
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, x = jx - 30 + t * lenJump;
      const y = y1 + (y2 - y1) * (1 - Math.cos(Math.min(1, t * 1.3) * Math.PI)) / 2 + Math.sin(t * Math.PI * 5) * (y2 - y1) * 0.06 * (1 - t);
      d += `L${x.toFixed(1)} ${(bed - y * k).toFixed(1)}`;
    }
    d += `H${xe}V${bed}H${xb}Z`;
    el("path", { d, style: "fill:var(--vec-u);fill-opacity:0.25;stroke:var(--vec-u);stroke-width:1.4" }, svg);
    // Roller swirls.
    for (let i = 0; i < 3; i++) {
      const cx = jx - 10 + i * lenJump * 0.28, r = (y2 - y1) * k * 0.22;
      el("path", { d: `M${cx - r} ${bed - y1 * k - r * 0.6}a${r} ${r} 0 1 1 ${r} ${r}`, style: "fill:none;stroke:var(--foreground);stroke-opacity:0.35" }, svg);
    }
    // Energy line (dashed) and the head lost.
    el("line", { x1: xb, x2: jx, y1: bed - E1 * k, y2: bed - E1 * k, style: "stroke:var(--brand);stroke-dasharray:5 4" }, svg);
    el("line", { x1: jx + lenJump, x2: xe, y1: bed - E2 * k, y2: bed - E2 * k, style: "stroke:var(--brand);stroke-dasharray:5 4" }, svg);
    el("line", { x1: xe - 12, x2: xe - 12, y1: bed - E1 * k, y2: bed - E2 * k, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    el("line", { x1: jx + lenJump, x2: xe - 12, y1: bed - E1 * k, y2: bed - E1 * k, style: "stroke:var(--brand);stroke-opacity:0.3;stroke-dasharray:2 4" }, svg);
    text(svg, xe - 16, bed - ((E1 + E2) / 2) * k, `ΔE ${length(dE)}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    text(svg, xb + 4, bed - E1 * k - 6, "energy line");
    // Flow arrows ∝ speed.
    const arrow = (x, y, v) => {
      const len = Math.min(120, 12 + v * 8);
      el("path", { d: `M${x} ${y}h${len}m-5 -4l5 4l-5 4`, style: "fill:none;stroke:currentColor;stroke-width:1.5" }, svg);
    };
    arrow(70, bed - (y1 * k) / 2, v1);
    arrow(jx + lenJump + 40, bed - (y2 * k) / 2, v2);
    text(svg, 70, bed + 18, `y₁ ${length(y1)} · Fr ${num(Fr1, 2)}`);
    text(svg, jx + lenJump + 40, bed + 18, `y₂ ${length(y2)} · Fr ${num(Fr2, 2)}`);

    o.v1.textContent = `${num(v1, 2)} m/s`;
    o.q.textContent = `${num(q, 3)} m²/s`;
    o.ratio.textContent = num(ratio, 3);
    o.y2.textContent = length(y2);
    o.v2.textContent = `${num(v2, 2)} m/s · Fr₂ ${num(Fr2, 3)}`;
    o.de.textContent = `${length(dE)} (${num((dE / E1) * 100, 1)}% of E₁)`;
    o.eff.textContent = `${num((E2 / E1) * 100, 1)}%`;
    o.kind.textContent = Fr1 < 1.7 ? "undular" : Fr1 < 2.5 ? "weak" : Fr1 < 4.5 ? "oscillating" : Fr1 < 9 ? "steady" : "strong";
    void E2;
  }
  draw();
}

// ============================================================ Buckingham π

// Exact rationals for the exponents.
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const R = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const radd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const rmul = (a, b) => R(a.n * b.n, a.d * b.d);
const rdiv = (a, b) => R(a.n * b.d, a.d * b.n);
const rneg = (a) => R(-a.n, a.d);
const rstr = (a) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);

// Solve M·x = b (square, rationals) by Gauss–Jordan; null when singular.
function solve(M, b) {
  const n = M.length, A = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    const p = A.findIndex((row, r) => r >= c && row[c].n !== 0);
    if (p < 0) return null;
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c];
    A[c] = A[c].map((v) => rdiv(v, piv));
    for (let r = 0; r < n; r++) if (r !== c && A[r][c].n !== 0) {
      const f = A[r][c];
      A[r] = A[r].map((v, k) => radd(v, rneg(rmul(f, A[c][k]))));
    }
  }
  return A.map((row) => row[n]);
}

const PI_PROBLEMS = {
  sphere: { vars: [["F", "drag force", [1, 1, -2]], ["ρ", "fluid density", [1, -3, 0]], ["v", "speed", [0, 1, -1]], ["D", "diameter", [0, 1, 0]], ["μ", "viscosity", [1, -1, -1]]], repeat: ["ρ", "v", "D"] },
  pipe: { vars: [["Δp", "pressure drop", [1, -1, -2]], ["ρ", "density", [1, -3, 0]], ["v", "mean speed", [0, 1, -1]], ["D", "diameter", [0, 1, 0]], ["μ", "viscosity", [1, -1, -1]], ["L", "length", [0, 1, 0]], ["ε", "roughness", [0, 1, 0]]], repeat: ["ρ", "v", "D"] },
  pendulum: { vars: [["T", "period", [0, 0, 1]], ["L", "length", [0, 1, 0]], ["g", "gravity", [0, 1, -2]], ["m", "bob mass", [1, 0, 0]], ["θ₀", "amplitude", [0, 0, 0]]], repeat: ["L", "g", "m"] },
};
const KNOWN = [
  [/^F · ρ⁻¹ · v⁻² · D⁻²$/, "π·C_d/8, a drag coefficient"],
  [/^μ · ρ⁻¹ · v⁻¹ · D⁻¹$/, "1/Re"],
  [/^Δp · ρ⁻¹ · v⁻²$/, "an Euler number"],
  [/^L · D⁻¹$/, "the length ratio L/D"],
  [/^ε · D⁻¹$/, "relative roughness ε/D"],
  [/^T · L⁻¹ᐟ² · g¹ᐟ²$/, "T√(g/L), = 2π for small swings"],
  [/^θ₀$/, "already dimensionless"],
];

for (const root of document.querySelectorAll("[data-fluid-pi]")) {
  const matrix = root.querySelector("[data-matrix]");
  const repeat = root.querySelector("[data-repeat]");
  const groups = root.querySelector("[data-groups]");
  let prob = "sphere", chosen = [...PI_PROBLEMS.sphere.repeat];
  root.addEventListener("seg-change", (e) => { prob = e.detail.value; chosen = [...PI_PROBLEMS[prob].repeat]; draw(); });

  const node = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
  const expo = (r) => (r.d === 1 ? sup(r.n) : `${sup(r.n)}ᐟ${sup(r.d)}`);

  function draw() {
    const P = PI_PROBLEMS[prob];
    // Dimension matrix.
    matrix.replaceChildren();
    const table = node("table", "w-full min-w-[420px] text-sm");
    const head = node("tr", "border-b text-left text-xs text-muted-foreground");
    head.append(node("th", "py-1.5 pr-3 font-normal", "Variable"), node("th", "py-1.5 pr-3 font-normal", "Meaning"), ...["M", "L", "T"].map((d) => node("th", "py-1.5 pr-3 text-right font-normal", d)));
    table.append(head);
    for (const [sym, name, dims] of P.vars) {
      const tr = node("tr", "border-b last:border-b-0" + (chosen.includes(sym) ? " bg-brand/5" : ""));
      tr.append(node("td", "py-1.5 pr-3 font-mono", sym), node("td", "py-1.5 pr-3 text-muted-foreground", name), ...dims.map((d) => node("td", "py-1.5 pr-3 text-right font-mono tabular-nums", String(d))));
      table.append(tr);
    }
    matrix.append(table);
    // Repeating-variable chips.
    repeat.replaceChildren();
    for (const [sym] of P.vars) {
      const b = node("button", "rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand", sym);
      b.type = "button";
      b.setAttribute("aria-pressed", String(chosen.includes(sym)));
      b.addEventListener("click", () => {
        chosen = chosen.includes(sym) ? chosen.filter((x) => x !== sym) : [...chosen, sym];
        draw();
        repeat.querySelector(`button:nth-child(${P.vars.findIndex((v) => v[0] === sym) + 1})`)?.focus();
      });
      repeat.append(b);
    }
    // Groups.
    groups.replaceChildren();
    const k = 3;
    const nGroups = P.vars.length - k;
    groups.append(node("p", "text-sm", `${P.vars.length} variables − ${k} dimensions (M, L, T) = ${nGroups} dimensionless groups.`));
    const rep = P.vars.filter((v) => chosen.includes(v[0]));
    if (rep.length !== k) {
      groups.append(node("p", "text-sm text-muted-foreground", `Pick exactly ${k} repeating variables (${rep.length} chosen).`));
      return;
    }
    const M = [0, 1, 2].map((dim) => rep.map((r) => R(r[2][dim])));
    let n = 0;
    for (const v of P.vars) {
      if (chosen.includes(v[0])) continue;
      const x = solve(M, v[2].map((d) => R(-d)));
      if (!x) {
        groups.replaceChildren(node("p", "text-sm text-del", `These repeating variables are not independent, or together miss a dimension: ${rep.map((r) => r[0]).join(", ")} cannot cancel every unit. Try another set.`));
        return;
      }
      n++;
      const terms = [v[0]].concat(rep.map((r, i) => (x[i].n === 0 ? null : `${r[0]}${expo(x[i])}`)).filter(Boolean));
      const str = terms.join(" · ");
      const hint = KNOWN.find(([re]) => re.test(str))?.[1];
      const row = node("div", "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-code px-3 py-2");
      row.append(node("span", "font-mono text-xs text-muted-foreground", `Π${"₀₁₂₃₄₅₆₇₈₉"[n]}`), node("span", "font-mono text-sm", str));
      if (hint) row.append(node("span", "text-xs text-muted-foreground", `= ${hint}`));
      row.append(node("span", "ml-auto font-mono text-[10px] text-muted-foreground", `exponents ${x.map(rstr).join(", ")}`));
      groups.append(row);
    }
    const first = P.vars.find((v) => !chosen.includes(v[0]));
    groups.append(node("p", "text-xs text-muted-foreground", `So Π₁ = f(Π₂, …): the ${first[1]} depends on the other groups only, which is why a scale model that matches every other group behaves like the full-size one.`));
  }
  draw();
}
