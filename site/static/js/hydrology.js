// Hydrology and water resources blocks. Every number comes from the model
// drawn next to it: steady-state box balances, Horton infiltration with
// time compression, the SCS Curve Number, unit hydrograph convolution,
// Manning, Gumbel flood frequency, Darcy and Thiem, the sequent peak
// algorithm, Streeter–Phelps and D8 flow routing. Catchments, records and
// terrain are synthetic.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const G = 9.80665;
const WATER = "var(--vec-u)";
const VAPOUR = "var(--vec-v)";
const BRAND = "var(--brand)";
const WARN = "var(--vec-j)";
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const group = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−") : "—");
const pct = (v, d = 1) => `${num(v * 100, d)}%`;

// A named segmented control in a block (hydroSegs in hydrology.go).
function seg(root, name, onChange) {
  const box = root.querySelector(`[data-hydro-seg="${name}"]`);
  let v = box.querySelector("[aria-selected=true]")?.dataset.seg;
  box.addEventListener("seg-change", (e) => {
    v = e.detail.value;
    onChange(v);
  });
  return {
    get: () => v,
    set(value) {
      v = value;
      for (const b of box.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b.dataset.seg === value));
    },
  };
}

// A small seeded generator, so a "new record" can be reproduced while
// debugging and the first render is the same for everyone.
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return next;
}
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

// Rounded tick step for a range.
function ticks(max, n = 5) {
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const niceMax = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((s) => s >= v);
};

function arrow(g, x1, y1, x2, y2, color, width, label, lx, ly) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = 6 + width;
  const bx = x2 - Math.cos(a) * head;
  const by = y2 - Math.sin(a) * head;
  el("line", { x1, y1, x2: bx, y2: by, style: `stroke:${color};stroke-width:${width};stroke-linecap:round` }, g);
  const s = head * 0.6;
  el("polygon", {
    points: `${x2},${y2} ${bx + Math.sin(a) * s},${by - Math.cos(a) * s} ${bx - Math.sin(a) * s},${by + Math.cos(a) * s}`,
    style: `fill:${color}`,
  }, g);
  if (label) text(g, lx, ly, label, { "text-anchor": "middle" });
}

// ============================================================ Water cycle

for (const root of document.querySelectorAll("[data-hydro-cycle]")) {
  const boxes = root.querySelector("[data-boxes]");
  const decay = root.querySelector("[data-decay]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const which = seg(root, "box", draw);

  function draw() {
    const atm = s.atm.get(), land = s.land.get(), ocean = s.ocean.get() * 1e6; // 10³ km³
    const eo = s.eo.get(), pl = s.pl.get(), el_ = s.el.get();
    const r = pl - el_;
    const po = eo - r;
    const ok = r >= 0 && po >= 0;
    const tau = { atm: atm / (po + pl), land: land / pl, ocean: ocean / eo }; // years

    boxes.replaceChildren();
    const g = el("g", {}, boxes);
    const box = (key, x, y, w, hgt, title, stock) => {
      const on = which.get() === key;
      el("rect", { x, y, width: w, height: hgt, rx: 8, style: `fill:${key === "atm" ? VAPOUR : WATER};fill-opacity:${key === "land" ? 0.06 : 0.1};stroke:${on ? BRAND : "currentColor"};stroke-opacity:${on ? 1 : 0.35};stroke-width:${on ? 2 : 1}` }, g);
      text(g, x + w / 2, y + 22, title, { "text-anchor": "middle", class: "fill-foreground text-[12px] font-medium" });
      text(g, x + w / 2, y + 40, stock, { "text-anchor": "middle" });
    };
    box("atm", 120, 14, 180, 56, "Atmosphere", `${group(atm)} ×10³ km³`);
    box("land", 14, 214, 170, 70, "Land", `${group(land)} ×10³ km³`);
    box("ocean", 236, 214, 170, 70, "Ocean", `${group(ocean)} ×10³ km³`);
    const w = (f) => Math.max(1, Math.min(9, Math.sqrt(Math.max(0, f)) / 2.5));
    arrow(g, 380, 212, 280, 74, VAPOUR, w(eo), `E ${group(eo)}`, 368, 146);
    arrow(g, 250, 74, 320, 212, WATER, w(po), `P ${group(po)}`, 252, 146);
    arrow(g, 170, 74, 110, 212, WATER, w(pl), `P ${group(pl)}`, 168, 146);
    arrow(g, 50, 212, 140, 74, VAPOUR, w(el_), `ET ${group(el_)}`, 64, 146);
    if (r > 0) arrow(g, 186, 262, 234, 262, WATER, w(r), `R ${group(r)}`, 210, 252);
    if (r > 0) {
      el("line", { x1: 245, y1: 98, x2: 185, y2: 98, style: `stroke:${VAPOUR};stroke-dasharray:3 3;stroke-opacity:0.7` }, g);
      el("polygon", { points: "181,98 189,94 189,102", style: `fill:${VAPOUR};fill-opacity:0.7` }, g);
      text(g, 215, 92, `vapour ${group(r)}`, { "text-anchor": "middle" });
    }
    text(g, 210, 298, "fluxes in 10³ km³/yr", { "text-anchor": "middle" });

    // Tracer pulse: well-mixed, so the fraction left is e^(−t/τ).
    decay.replaceChildren();
    const t = tau[which.get()];
    const days = t < 1;
    const k = days ? 365.25 : 1;
    const T = t * k;
    const xmax = niceMax(5 * T);
    const f = frame(decay, { box: [40, 28, 244, 230], x: [0, xmax], y: [0, 1], xticks: ticks(xmax, 4), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${v * 100}%`, xlabel: days ? "days" : "years", ylabel: "tracer left" });
    if (ok && Number.isFinite(T)) {
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const x = (xmax * i) / 200;
        pts.push([f.sx(x), f.sy(Math.exp(-x / T))]);
      }
      polyline(f.g, pts, `stroke:${BRAND};stroke-width:2`);
      el("line", { x1: f.sx(T), x2: f.sx(T), y1: f.sy(0), y2: f.sy(Math.exp(-1)), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, f.g);
      el("circle", { cx: f.sx(T), cy: f.sy(Math.exp(-1)), r: 3.5, style: `fill:${BRAND}` }, f.g);
      text(f.g, f.sx(T) + 6, f.sy(Math.exp(-1)) - 6, `τ: 37% left`);
    }

    const fmtTau = (y) => (!Number.isFinite(y) || y < 0 ? "—" : y < 1 ? `${num(y * 365.25, 1)} days` : `${group(y, y < 100 ? 1 : 0)} yr`);
    o.po.textContent = `${group(po)} ×10³ km³/yr`;
    o.r.textContent = `${group(r)} ×10³ km³/yr`;
    o.tatm.textContent = ok ? fmtTau(tau.atm) : "—";
    o.tland.textContent = ok ? fmtTau(tau.land) : "—";
    o.tocean.textContent = ok ? fmtTau(tau.ocean) : "—";
    o.ok.textContent = r < 0 ? "ET > P on land: land drying" : po < 0 ? "ocean P < 0: lower land P" : "every stock steady";
  }
  draw();
}

// ============================================================ Horton

for (const root of document.querySelectorAll("[data-hydro-horton]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const f0 = s.f0.get(), fc = Math.min(s.fc.get(), f0), k = s.k.get(), i = s.i.get(), dur = s.dur.get();
    const fh = (t) => fc + (f0 - fc) * Math.exp(-k * t);
    const Fh = (t) => fc * t + ((f0 - fc) / k) * (1 - Math.exp(-k * t));
    // Ponding: Horton time te at which capacity = i, cumulative Fp, then the
    // clock time Fp / i (all rain infiltrated until then).
    let tp = Infinity, te = 0;
    if (i >= f0) tp = 0;
    else if (i > fc) {
      te = -Math.log((i - fc) / (f0 - fc)) / k;
      tp = Fh(te) / i;
    }
    const rate = (t) => (t < tp ? i : fh(t - tp + te));
    const cum = (t) => (t <= tp ? i * t : Fh(te) + Fh(t - tp + te) - Fh(te));

    svg.replaceChildren();
    const ymax = niceMax(Math.max(f0, i) * 1.1);
    const f = frame(svg, { box: [48, 24, 492, 236], x: [0, dur], y: [0, ymax], xticks: ticks(dur, 6), yticks: ticks(ymax, 5), xlabel: "time (h)", ylabel: "rate (mm/h)" });
    const n = 300;
    const xs = Array.from({ length: n + 1 }, (_, j) => (dur * j) / n);
    // Rain block, runoff (rain above the actual rate), infiltration.
    el("rect", { x: f.sx(0), y: f.sy(i), width: f.sx(dur) - f.sx(0), height: f.sy(0) - f.sy(i), style: `fill:${WATER};fill-opacity:0.1` }, f.g);
    if (tp < dur) {
      const top = xs.filter((x) => x >= tp).map((x) => [f.sx(x), f.sy(i)]);
      const bot = xs.filter((x) => x >= tp).reverse().map((x) => [f.sx(x), f.sy(rate(x))]);
      el("polygon", { points: [...top, ...bot].map((p) => p.join(",")).join(" "), style: `fill:${BRAND};fill-opacity:0.22` }, f.g);
    }
    polyline(f.g, xs.map((x) => [f.sx(x), f.sy(fh(x))]), "stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:4 4");
    hline(f.g, f, i, `stroke:${WATER};stroke-width:1.5`, `rain i = ${num(i, 0)} mm/h`);
    polyline(f.g, xs.map((x) => [f.sx(x), f.sy(rate(x))]), `stroke:${WATER};stroke-width:2.5`);
    if (tp > 0 && tp < dur) {
      el("line", { x1: f.sx(tp), x2: f.sx(tp), y1: f.sy(0), y2: f.sy(i), style: `stroke:${BRAND};stroke-dasharray:3 3` }, f.g);
      text(f.g, f.sx(tp) + 4, f.sy(0) - 6, `ponding ${num(tp, 2)} h`, { style: `fill:${BRAND}` });
    }
    text(f.g, f.sx(dur * 0.02), f.sy(fh(dur * 0.02)) - 6, "Horton capacity from t = 0");

    const rain = i * dur, inf = cum(dur), ro = rain - inf;
    o.tp.textContent = tp === Infinity ? "never (i ≤ fc)" : tp >= dur ? `none (would be ${num(tp, 2)} h)` : `${num(tp, 2)} h`;
    o.rain.textContent = `${num(rain, 1)} mm`;
    o.inf.textContent = `${num(inf, 1)} mm`;
    o.ro.textContent = `${num(ro, 1)} mm`;
    o.ratio.textContent = pct(ro / rain);
  }
  draw();
}

// ============================================================ Curve Number

const cnRunoff = (P, CN, lambda) => {
  const S = 25400 / CN - 254;
  const Ia = lambda * S;
  return P <= Ia ? 0 : (P - Ia) ** 2 / (P - Ia + S);
};

for (const root of document.querySelectorAll("[data-hydro-cn]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, (name) => {
    if (name === "cn") {
      const v = String(s.cn.get());
      cover.set(root.querySelector(`[data-hydro-seg="cover"] [data-seg="${v}"]`) ? v : "custom");
    }
    draw();
  });
  const cover = seg(root, "cover", (v) => {
    if (v !== "custom") s.cn.set(Number(v), false);
    draw();
  });
  const lam = seg(root, "lambda", draw);

  function draw() {
    const CN = s.cn.get(), P = s.p.get(), lambda = Number(lam.get());
    const S = 25400 / CN - 254, Ia = lambda * S, Q = cnRunoff(P, CN, lambda);
    svg.replaceChildren();
    const f = frame(svg, { box: [48, 24, 492, 256], x: [0, 300], y: [0, 300], xticks: ticks(300, 6), yticks: ticks(300, 6), xlabel: "rainfall P (mm)", ylabel: "runoff Q (mm)" });
    polyline(f.g, [[f.sx(0), f.sy(0)], [f.sx(300), f.sy(300)]], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4");
    text(f.g, f.sx(262), f.sy(272), "Q = P", { "text-anchor": "end" });
    const curve = (cn) => Array.from({ length: 151 }, (_, j) => [f.sx(j * 2), f.sy(cnRunoff(j * 2, cn, lambda))]);
    for (const cn of [40, 50, 60, 70, 80, 90]) {
      polyline(f.g, curve(cn), "stroke:currentColor;stroke-opacity:0.18");
      text(f.g, f.sx(300) + 4, f.sy(cnRunoff(300, cn, lambda)) + 3, String(cn), { "text-anchor": "start", class: "fill-muted-foreground font-mono text-[9px]" });
    }
    polyline(f.g, curve(CN), `stroke:${BRAND};stroke-width:2.5`);
    // Ia on the rainfall axis, and the storm's point.
    if (Ia <= 300) {
      el("line", { x1: f.sx(0), x2: f.sx(Ia), y1: f.sy(0) - 3, y2: f.sy(0) - 3, style: `stroke:${WATER};stroke-width:4;stroke-linecap:round` }, f.g);
      text(f.g, f.sx(Math.min(Ia, 300)) + 4, f.sy(0) - 24, `Ia = ${num(Ia, 1)} mm`, { "text-anchor": "start" });
    }
    el("line", { x1: f.sx(P), x2: f.sx(P), y1: f.sy(0), y2: f.sy(Q), style: `stroke:${BRAND};stroke-opacity:0.5;stroke-dasharray:3 3` }, f.g);
    el("line", { x1: f.sx(0), x2: f.sx(P), y1: f.sy(Q), y2: f.sy(Q), style: `stroke:${BRAND};stroke-opacity:0.5;stroke-dasharray:3 3` }, f.g);
    el("circle", { cx: f.sx(P), cy: f.sy(Q), r: 4.5, style: `fill:${BRAND}` }, f.g);
    text(f.g, f.sx(P) - 8, f.sy(Q) - 10, `CN ${CN}: Q = ${num(Q, 1)} mm`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });

    o.s.textContent = `${num(S, 1)} mm`;
    o.ia.textContent = `${num(Ia, 1)} mm`;
    o.q.textContent = `${num(Q, 1)} mm`;
    o.c.textContent = P > 0 ? num(Q / P, 3) : "—";
    o.ret.textContent = `${num(P - Q, 1)} mm`;
  }
  draw();
}

// ============================================================ Unit hydrograph

const UH_HOURS = 8;
const UH_BURST = [2, 6, 14, 9, 4, 1, 0, 0];

for (const root of document.querySelectorAll("[data-hydro-uh]")) {
  const rainSvg = root.querySelector("[data-rain]");
  const flowSvg = root.querySelector("[data-flow]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let rain = UH_BURST.slice();
  let span = 1, rainFrame = null;

  // The 1-hour unit hydrograph: SCS triangle sampled hourly, scaled so the
  // ordinates (m³/s per mm) carry exactly 1 mm over the area.
  function unitHydrograph(A, tp) {
    const tb = 2.67 * tp;
    const u = [];
    for (let j = 0; j <= Math.ceil(tb); j++) u.push(j <= tp ? j / tp : Math.max(0, (tb - j) / (tb - tp)));
    const sum = u.reduce((a, b) => a + b, 0);
    const k = (A * 1e6 * 1e-3) / (sum * 3600);
    return u.map((v) => v * k);
  }

  function draw() {
    const A = s.area.get(), tp = s.tp.get();
    const U = unitHydrograph(A, tp);
    const n = UH_HOURS + U.length;
    span = n;
    // Qₙ = Σₘ Pₘ U(n − m): rain in hour m starts its response at the end of hour m.
    const parts = rain.map((p, m) => Array.from({ length: n + 1 }, (_, t) => {
      const j = t - m;
      return j >= 0 && j < U.length ? p * U[j] : 0;
    }));
    const Q = Array.from({ length: n + 1 }, (_, t) => parts.reduce((a, q) => a + q[t], 0));
    const depth = rain.reduce((a, b) => a + b, 0);
    const vin = A * 1e6 * depth * 1e-3;
    const vout = Q.reduce((a, b) => a + b, 0) * 3600;
    let ipk = 0;
    Q.forEach((q, t) => { if (q > Q[ipk]) ipk = t; });

    rainSvg.replaceChildren();
    const rf = frame(rainSvg, { box: [52, 16, 488, 80], x: [0, n], y: [0, 20], xticks: [], yticks: [0, 10, 20], ylabel: "excess rain (mm/h)" });
    rainFrame = rf;
    rain.forEach((p, m) => {
      el("rect", { x: rf.sx(m) + 1, y: rf.sy(p), width: rf.sx(1) - rf.sx(0) - 2, height: rf.sy(0) - rf.sy(p), rx: 2, style: `fill:${WATER};fill-opacity:0.7` }, rf.g);
      el("rect", { x: rf.sx(m), y: rf.sy(20), width: rf.sx(1) - rf.sx(0), height: rf.sy(0) - rf.sy(20), style: "fill:transparent;cursor:ns-resize" }, rf.g);
    });
    text(rf.g, rf.sx(UH_HOURS) + 6, rf.sy(10), "← drag the bars", { "text-anchor": "start" });

    flowSvg.replaceChildren();
    const qmax = niceMax(Math.max(1, Q[ipk]) * 1.1);
    const ff = frame(flowSvg, { box: [52, 20, 488, 206], x: [0, n], y: [0, qmax], xticks: ticks(n, 8), yticks: ticks(qmax, 4), xlabel: "time (h)", ylabel: "Q (m³/s)" });
    const pts = Q.map((q, t) => [ff.sx(t), ff.sy(q)]);
    el("polygon", { points: [[ff.sx(0), ff.sy(0)], ...pts, [ff.sx(n), ff.sy(0)]].map((p) => p.join(",")).join(" "), style: `fill:${WATER};fill-opacity:0.14` }, ff.g);
    for (const q of parts) if (q.some((v) => v > 0)) polyline(ff.g, q.map((v, t) => [ff.sx(t), ff.sy(v)]), `stroke:${WATER};stroke-opacity:0.5;stroke-width:1`);
    polyline(ff.g, pts, `stroke:${WATER};stroke-width:2.5`);
    if (Q[ipk] > 0) {
      el("circle", { cx: ff.sx(ipk), cy: ff.sy(Q[ipk]), r: 4, style: `fill:${BRAND}` }, ff.g);
      text(ff.g, ff.sx(ipk) + 7, ff.sy(Q[ipk]) + 3, `${num(Q[ipk], 1)} m³/s`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    }

    o.depth.textContent = `${num(depth, 1)} mm`;
    o.vin.textContent = `${group(vin)} m³`;
    o.vout.textContent = `${group(vout)} m³`;
    o.peak.textContent = Q[ipk] > 0 ? `${num(Q[ipk], 1)} m³/s` : "—";
    o.tpk.textContent = Q[ipk] > 0 ? `${ipk} h` : "—";
  }

  // Dragging sets the bar under the pointer (and those swept over).
  let dragging = false;
  const setAt = (e) => {
    const r = rainSvg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 560;
    const y = ((e.clientY - r.top) / r.height) * 120;
    const f = rainFrame;
    const m = Math.floor(((x - f.L) / f.W) * span);
    if (m < 0 || m >= UH_HOURS) return;
    rain[m] = Math.max(0, Math.min(20, Math.round(((f.T + f.H - y) / f.H) * 20 * 2) / 2));
    draw();
  };
  rainSvg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    rainSvg.setPointerCapture(e.pointerId);
    setAt(e);
  });
  rainSvg.addEventListener("pointermove", (e) => dragging && setAt(e));
  const stop = () => (dragging = false);
  rainSvg.addEventListener("pointerup", stop);
  rainSvg.addEventListener("pointercancel", stop);
  rainSvg.style.touchAction = "none";
  root.querySelector('[data-action="burst"]').addEventListener("click", () => { rain = UH_BURST.slice(); draw(); });
  root.querySelector('[data-action="clear"]').addEventListener("click", () => { rain = rain.map(() => 0); draw(); });
  draw();
}

// ============================================================ Manning

function trapezoid(b, z, y) {
  const A = (b + z * y) * y;
  const P = b + 2 * y * Math.sqrt(1 + z * z);
  const T = b + 2 * z * y;
  return { A, P, T, R: A / P };
}
const manning = (b, z, y, n, S) => {
  const g = trapezoid(b, z, y);
  const v = (1 / n) * g.R ** (2 / 3) * Math.sqrt(S);
  return { ...g, v, Q: v * g.A };
};

for (const root of document.querySelectorAll("[data-hydro-manning]")) {
  const section = root.querySelector("[data-section]");
  const rating = root.querySelector("[data-rating]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const lining = seg(root, "lining", draw);

  function draw() {
    const b = s.b.get(), z = s.z.get(), y = s.y.get(), S = s.s.get() / 1000, n = Number(lining.get());
    if (b === 0 && z === 0) {
      o.q.textContent = "no channel: b = z = 0";
      return;
    }
    const m = manning(b, z, y, n, S);
    const D = m.A / m.T;
    const Fr = m.v / Math.sqrt(G * D);

    // Section, to scale.
    section.replaceChildren();
    const Hb = Math.max(y * 1.25, 1);
    const top = b + 2 * z * Hb;
    const k = Math.min(320 / Math.max(top, 1e-6), 170 / Hb);
    const cx = 180, base = 215;
    const X = (u) => cx + u * k, Y = (v) => base - v * k;
    el("path", { d: `M${X(-top / 2) - 10} ${Y(Hb)}H${X(-top / 2)}L${X(-b / 2)} ${Y(0)}H${X(b / 2)}L${X(top / 2)} ${Y(Hb)}H${X(top / 2) + 10}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.6;stroke-width:2" }, section);
    const wt = b + 2 * z * y;
    el("polygon", { points: `${X(-wt / 2)},${Y(y)} ${X(-b / 2)},${Y(0)} ${X(b / 2)},${Y(0)} ${X(wt / 2)},${Y(y)}`, style: `fill:${WATER};fill-opacity:0.3` }, section);
    el("line", { x1: X(-wt / 2), x2: X(wt / 2), y1: Y(y), y2: Y(y), style: `stroke:${WATER};stroke-width:1.5` }, section);
    polyline(section, [[X(-wt / 2), Y(y)], [X(-b / 2), Y(0)], [X(b / 2), Y(0)], [X(wt / 2), Y(y)]], `stroke:${BRAND};stroke-width:3.5;stroke-linejoin:round;stroke-linecap:round`);
    text(section, cx, base + 18, `b = ${num(b, 1)} m`, { "text-anchor": "middle" });
    text(section, cx, Y(y / 2) + 3, `y = ${num(y, 2)} m`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    text(section, cx, Y(y) - 6, `T = ${num(m.T, 2)} m`, { "text-anchor": "middle" });
    text(section, 10, 16, "wetted perimeter P", { "text-anchor": "start", style: `fill:${BRAND}` });

    // Rating curve: stage against discharge, up to the field's 4 m.
    rating.replaceChildren();
    const ys = Array.from({ length: 81 }, (_, j) => 0.05 + (3.95 * j) / 80);
    const qs = ys.map((yy) => manning(b, z, yy, n, S).Q);
    const qmax = niceMax(Math.max(...qs) * 1.05);
    const f = frame(rating, { box: [36, 32, 210, 188], x: [0, qmax], y: [0, 4], xticks: ticks(qmax, 3), yticks: [0, 1, 2, 3, 4], xlabel: "Q (m³/s)", ylabel: "depth (m)" });
    polyline(f.g, ys.map((yy, j) => [f.sx(qs[j]), f.sy(yy)]), `stroke:${WATER};stroke-width:2`);
    el("circle", { cx: f.sx(m.Q), cy: f.sy(y), r: 4.5, style: `fill:${BRAND}` }, f.g);

    o.n.textContent = num(n, 3);
    o.a.textContent = `${num(m.A, 2)} m²`;
    o.p.textContent = `${num(m.P, 2)} m`;
    o.r.textContent = `${num(m.R, 3)} m`;
    o.v.textContent = `${num(m.v, 2)} m/s`;
    o.q.textContent = `${num(m.Q, 2)} m³/s`;
    o.fr.textContent = `${num(Fr, 2)} ${Fr < 1 ? "subcritical" : Fr > 1 ? "supercritical" : "critical"}`;
  }
  draw();
}

// ============================================================ Flood frequency

const GUMBEL_U = 300, GUMBEL_A = 100;
const reduced = (T) => -Math.log(-Math.log(1 - 1 / T));
const RP_TICKS = [2, 5, 10, 25, 50, 100, 500];

for (const root of document.querySelectorAll("[data-hydro-flood]")) {
  const plot = root.querySelector("[data-plot]");
  const riskSvg = root.querySelector("[data-risk]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const len = seg(root, "len", () => { sample(); draw(); });
  let seed = 20261015, record = [];

  function sample() {
    const r = rng(seed);
    record = Array.from({ length: Number(len.get()) }, () => GUMBEL_U - GUMBEL_A * Math.log(-Math.log(1 - r() * (1 - 1e-12))));
  }

  function draw() {
    const T = s.t.get(), life = s.life.get();
    const N = record.length;
    const mean = record.reduce((a, b) => a + b, 0) / N;
    const sd = Math.sqrt(record.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1));
    const alpha = (sd * Math.sqrt(6)) / Math.PI;
    const u = mean - 0.5772 * alpha;
    const yT = reduced(T);
    const qT = u + alpha * yT, qTrue = GUMBEL_U + GUMBEL_A * yT;
    const risk = 1 - (1 - 1 / T) ** life;

    plot.replaceChildren();
    const sorted = record.slice().sort((a, b) => a - b);
    const y0 = -2, y1 = 7.2;
    const qmax = niceMax(Math.max(sorted[N - 1], u + alpha * y1, GUMBEL_U + GUMBEL_A * y1) * 1.02);
    const f = frame(plot, { box: [44, 24, 320, 230], x: [y0, y1], y: [0, qmax], xticks: RP_TICKS.map(reduced), xfmt: (v) => String(RP_TICKS[RP_TICKS.map(reduced).indexOf(v)]), yticks: ticks(qmax, 5), xlabel: "return period T (yr), Gumbel scale", ylabel: "annual max Q (m³/s)" });
    polyline(f.g, [[f.sx(y0), f.sy(GUMBEL_U + GUMBEL_A * y0)], [f.sx(y1), f.sy(GUMBEL_U + GUMBEL_A * y1)]], "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 4");
    polyline(f.g, [[f.sx(y0), f.sy(Math.max(0, u + alpha * y0))], [f.sx(y1), f.sy(u + alpha * y1)]], `stroke:${BRAND};stroke-width:2`);
    sorted.forEach((q, j) => {
      const F = (j + 1) / (N + 1);
      el("circle", { cx: f.sx(-Math.log(-Math.log(F))), cy: f.sy(q), r: 2.6, style: `fill:${WATER};fill-opacity:0.8` }, f.g);
    });
    if (yT <= y1) {
      el("line", { x1: f.sx(yT), x2: f.sx(yT), y1: f.sy(0), y2: f.sy(qT), style: `stroke:${BRAND};stroke-opacity:0.5;stroke-dasharray:3 3` }, f.g);
      el("circle", { cx: f.sx(yT), cy: f.sy(qT), r: 4.5, style: `fill:${BRAND}` }, f.g);
    }
    text(f.g, f.sx(y0) + 4, f.T + 10, "— fitted   - - parent", { "text-anchor": "start" });

    riskSvg.replaceChildren();
    const rf = frame(riskSvg, { box: [40, 24, 206, 230], x: [0, 200], y: [0, 1], xticks: [0, 50, 100, 150, 200], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${v * 100}%`, xlabel: "design life n (yr)", ylabel: "P(at least one)" });
    const curve = (TT) => Array.from({ length: 101 }, (_, j) => [rf.sx(j * 2), rf.sy(1 - (1 - 1 / TT) ** (j * 2))]);
    for (const TT of [10, 50, 500]) {
      polyline(rf.g, curve(TT), "stroke:currentColor;stroke-opacity:0.2");
      const nn = Math.min(185, TT * 1.2);
      text(rf.g, rf.sx(nn) + 4, rf.sy(1 - (1 - 1 / TT) ** nn) + 12, `T ${TT}`, { "text-anchor": "start" });
    }
    polyline(rf.g, curve(T), `stroke:${BRAND};stroke-width:2`);
    el("circle", { cx: rf.sx(life), cy: rf.sy(risk), r: 4.5, style: `fill:${BRAND}` }, rf.g);
    text(rf.g, rf.sx(life) + (life > 120 ? -8 : 8), rf.sy(risk) + 14, pct(risk), { "text-anchor": life > 120 ? "end" : "start", class: "fill-foreground font-mono text-[10px]" });

    o.aep.textContent = pct(1 / T, 2);
    o.risk.textContent = pct(risk);
    o.ms.textContent = `${num(mean, 0)}, ${num(sd, 0)} m³/s`;
    o.ua.textContent = `${num(u, 0)}, ${num(alpha, 1)}`;
    o.qt.textContent = `${num(qT, 0)} m³/s`;
    o.qtrue.textContent = `${num(qTrue, 0)} m³/s (${qT >= qTrue ? "+" : "−"}${num(Math.abs(qT / qTrue - 1) * 100, 0)}%)`;
  }
  root.querySelector('[data-action="resample"]').addEventListener("click", () => { seed = newSeed(); sample(); draw(); });
  sample();
  draw();
}

// ============================================================ Darcy and Thiem

for (const root of document.querySelectorAll("[data-hydro-well]")) {
  const svg = root.querySelector("[data-section]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const K = s.k.get(), b = s.b.get(), ne = s.ne.get(), Q = s.q.get();
    const R = s.rr.get(), rw = Math.min(s.rw.get(), R / 2), ro = s.ro.get();
    const T = K * b;
    const sdown = (r) => (r >= R ? 0 : (Q / (2 * Math.PI * T)) * Math.log(R / Math.max(r, rw)));
    const sw = sdown(rw), so = sdown(ro);
    const grad = ro < R ? Q / (2 * Math.PI * T * ro) : 0;
    const darcy = K * grad * 2 * Math.PI * ro * b;
    const q = K * grad;

    svg.replaceChildren();
    const L = 30, W = 500, cx = L + W / 2;
    const span = R * 1.15;
    const X = (r) => cx + (r / span) * (W / 2);
    const head0 = 52, ks = 78 / Math.max(sw, 1e-9);
    // Ground, confining layer, aquifer, base.
    el("rect", { x: L, y: 140, width: W, height: 22, style: "fill:currentColor;fill-opacity:0.14" }, svg);
    el("rect", { x: L, y: 162, width: W, height: 76, style: `fill:${WATER};fill-opacity:0.1` }, svg);
    el("rect", { x: L, y: 238, width: W, height: 18, style: "fill:currentColor;fill-opacity:0.22" }, svg);
    el("line", { x1: L, x2: L + W, y1: 36, y2: 36, style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    text(svg, L + 4, 32, "ground", { "text-anchor": "start" });
    text(svg, L + 4, 154, "confining layer", { "text-anchor": "start" });
    text(svg, L + 4, 176, `confined aquifer, b = ${num(b, 0)} m`, { "text-anchor": "start" });
    text(svg, L + 4, 250, "impermeable base", { "text-anchor": "start" });
    // Static and pumped potentiometric surfaces (drawdown to its own scale).
    el("line", { x1: L, x2: L + W, y1: head0, y2: head0, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 4" }, svg);
    text(svg, L + W - 2, head0 - 4, "static head", { "text-anchor": "end" });
    const pts = [];
    for (let j = -200; j <= 200; j++) {
      const r = (Math.abs(j) / 200) * span;
      pts.push([X(Math.sign(j) * r), head0 + sdown(Math.max(r, rw)) * ks]);
    }
    polyline(svg, pts, `stroke:${WATER};stroke-width:2.5`);
    // Radius of influence.
    for (const sg of [-1, 1]) el("line", { x1: X(sg * R), x2: X(sg * R), y1: 40, y2: 256, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 4" }, svg);
    text(svg, X(R), 268, `R = ${group(R)} m`, { "text-anchor": "middle" });
    // Pumping well (not to scale) and the observation well.
    el("rect", { x: cx - 4, y: 30, width: 8, height: 208, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.6" }, svg);
    el("rect", { x: cx - 4, y: 162, width: 8, height: 76, style: `fill:${WATER};fill-opacity:0.35` }, svg);
    arrow(svg, cx, 30, cx, 12, WATER, 2);
    text(svg, cx + 8, 22, `Q = ${group(Q)} m³/day`, { "text-anchor": "start" });
    if (ro < span) {
      const xo = X(ro);
      el("line", { x1: xo, x2: xo, y1: 34, y2: 238, style: `stroke:${BRAND};stroke-width:1.5;stroke-dasharray:4 3` }, svg);
      el("line", { x1: xo - 6, x2: xo + 6, y1: head0 + so * ks, y2: head0 + so * ks, style: `stroke:${BRAND};stroke-width:2.5` }, svg);
      text(svg, xo + 8, head0 + so * ks + 14, `s = ${num(so, 2)} m`, { "text-anchor": "start", style: `fill:${BRAND}` });
    }
    // Flow towards the well through the aquifer.
    for (const sg of [-1, 1]) for (const fr of [0.35, 0.7]) arrow(svg, X(sg * R * fr), 210, X(sg * R * fr * 0.7), 210, WATER, 1.2);
    text(svg, cx - 10, head0 + sw * ks - 2, `sw = ${num(sw, 2)} m`, { "text-anchor": "end" });
    text(svg, L + W - 2, 288, "drawdown exaggerated; well width not to scale", { "text-anchor": "end" });

    o.t.textContent = `${group(T, 1)} m²/day`;
    o.sw.textContent = `${num(sw, 2)} m`;
    o.so.textContent = ro < R ? `${num(so, 3)} m` : "0 (beyond R)";
    o.i.textContent = ro < R ? grad.toExponential(2).replace("-", "−") : "0";
    o.darcy.textContent = ro < R ? `${group(darcy, 1)} m³/day` : "—";
    o.v.textContent = ro < R ? `${num(q / ne, 3)} m/day` : "—";
  }
  draw();
}

// ============================================================ Reservoir

const SEASON = [1.7, 1.9, 1.6, 1.25, 0.85, 0.5, 0.3, 0.22, 0.32, 0.6, 1.05, 1.45];
const RES_YEARS = 8;

for (const root of document.querySelectorAll("[data-hydro-res]")) {
  const mass = root.querySelector("[data-mass]");
  const def = root.querySelector("[data-deficit]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let seed = 7, inflow = [];

  function sample() {
    const r = rng(seed);
    inflow = [];
    for (let y = 0; y < RES_YEARS; y++) {
      const wet = Math.exp(0.4 * r.gauss());
      for (let m = 0; m < 12; m++) inflow.push(40 * SEASON[m] * wet * Math.exp(0.25 * r.gauss()));
    }
  }

  function draw() {
    const N = inflow.length;
    const mean = inflow.reduce((a, b) => a + b, 0) / N;
    const D = (s.d.get() / 100) * mean;
    // Sequent peak over two passes: Kₜ = max(0, Kₜ₋₁ + D − Qₜ).
    const K = [0];
    for (let t = 1; t <= 2 * N; t++) K.push(Math.max(0, K[t - 1] + D - inflow[(t - 1) % N]));
    let e = 0;
    K.forEach((k, t) => { if (k > K[e]) e = t; });
    let st = e;
    while (st > 0 && K[st] > 0) st--;
    const single = Math.max(...K.slice(0, N + 1));
    const C = [0];
    for (let t = 1; t <= 2 * N; t++) C.push(C[t - 1] + inflow[(t - 1) % N]);

    const M = 2 * N;
    const box = [56, 20, 484, 160];
    mass.replaceChildren();
    const cmax = niceMax(C[M]);
    const fm = frame(mass, { box, x: [0, M], y: [0, cmax], xticks: Array.from({ length: M / 24 + 1 }, (_, j) => j * 24), xfmt: (v) => `${v / 12}`, yticks: ticks(cmax, 4), yfmt: (v) => group(v), xlabel: "years", ylabel: "cumulative inflow (hm³)" });
    el("rect", { x: fm.sx(N), y: fm.T, width: fm.sx(M) - fm.sx(N), height: fm.H, style: "fill:currentColor;fill-opacity:0.04" }, fm.g);
    text(fm.g, fm.sx(N) + 4, fm.T + 10, "record repeated", { "text-anchor": "start" });
    polyline(fm.g, C.map((c, t) => [fm.sx(t), fm.sy(c)]), `stroke:${WATER};stroke-width:2`);
    if (K[e] > 0) {
      polyline(fm.g, [[fm.sx(st), fm.sy(C[st])], [fm.sx(e), fm.sy(C[st] + D * (e - st))]], `stroke:${BRAND};stroke-width:1.5`);
      el("line", { x1: fm.sx(e), x2: fm.sx(e), y1: fm.sy(C[e]), y2: fm.sy(C[st] + D * (e - st)), style: `stroke:${BRAND};stroke-width:3` }, fm.g);
      text(fm.g, fm.sx(e) + 6, fm.sy(C[e]) + 12, `storage ${group(K[e])} hm³`, { "text-anchor": "start", style: `fill:${BRAND}` });
    }

    def.replaceChildren();
    const kmax = niceMax(Math.max(K[e], 1) * 1.1);
    const fd = frame(def, { box: [56, 16, 484, 104], x: [0, M], y: [0, kmax], xticks: Array.from({ length: M / 24 + 1 }, (_, j) => j * 24), xfmt: (v) => `${v / 12}`, yticks: ticks(kmax, 2), yfmt: (v) => group(v), ylabel: "deficit Kₜ (hm³)" });
    el("polygon", { points: [[fd.sx(0), fd.sy(0)], ...K.map((k, t) => [fd.sx(t), fd.sy(k)]), [fd.sx(M), fd.sy(0)]].map((p) => p.join(",")).join(" "), style: `fill:${BRAND};fill-opacity:0.15` }, fd.g);
    polyline(fd.g, K.map((k, t) => [fd.sx(t), fd.sy(k)]), `stroke:${BRAND};stroke-width:1.5`);
    el("line", { x1: fd.sx(N), x2: fd.sx(N), y1: fd.T, y2: fd.T + fd.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, fd.g);

    o.mean.textContent = `${num(mean, 1)} hm³/mo`;
    o.d.textContent = `${num(D, 1)} hm³/mo`;
    o.k.textContent = `${group(K[e])} hm³`;
    o.rippl.textContent = `${group(single)} hm³${single < K[e] - 1e-6 ? " (misses the wrap)" : ""}`;
    o.crit.textContent = K[e] > 0 ? `${e - st} months` : "none";
    o.ratio.textContent = num(K[e] / (mean * 12), 2);
  }
  root.querySelector('[data-action="resample"]').addEventListener("click", () => { seed = newSeed(); sample(); draw(); });
  sample();
  draw();
}

// ============================================================ Streeter–Phelps

for (const root of document.querySelectorAll("[data-hydro-sag]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const L0 = s.l0.get(), sat = s.sat.get(), D0 = sat - s.do0.get();
    const kd = s.kd.get(), ka = s.ka.get(), u = s.u.get();
    const same = Math.abs(ka - kd) < 1e-9;
    const deficit = (t) => same
      ? (kd * L0 * t + D0) * Math.exp(-kd * t)
      : ((kd * L0) / (ka - kd)) * (Math.exp(-kd * t) - Math.exp(-ka * t)) + D0 * Math.exp(-ka * t);
    // The deficit grows at the outfall only if k_d L₀ > k_a D₀.
    let tc = 0;
    if (kd * L0 > ka * D0) tc = same ? (1 / kd) * (1 - D0 / L0) : Math.log((ka / kd) * (1 - (D0 * (ka - kd)) / (kd * L0))) / (ka - kd);
    const minDO = sat - deficit(tc);
    const tmax = Math.min(30, Math.max(2.5 * tc, 3 / Math.min(ka, kd), 1));
    const xmax = niceMax(u * tmax);
    const tEnd = xmax / u;

    svg.replaceChildren();
    const ymax = niceMax(Math.max(sat, L0, s.do0.get()) * 1.08);
    const f = frame(svg, { box: [44, 24, 496, 236], x: [0, xmax], y: [0, ymax], xticks: ticks(xmax, 6), yticks: ticks(ymax, 5), xlabel: "distance downstream (km)", ylabel: "mg/L" });
    hline(f.g, f, sat, "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 4", "saturation");
    hline(f.g, f, 5, `stroke:${WARN};stroke-opacity:0.7;stroke-dasharray:2 3`, "5 mg/L");
    const n = 300;
    const ts = Array.from({ length: n + 1 }, (_, j) => (tEnd * j) / n);
    polyline(f.g, ts.map((t) => [f.sx(u * t), f.sy(L0 * Math.exp(-kd * t))]), "stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:5 3");
    text(f.g, f.sx(u * ts[12]) + 4, f.sy(L0 * Math.exp(-kd * ts[12])) - 6, "BOD left", { "text-anchor": "start" });
    polyline(f.g, ts.map((t) => [f.sx(u * t), f.sy(Math.max(0, sat - deficit(t)))]), `stroke:${WATER};stroke-width:2.5`);
    if (tc <= tEnd) {
      el("line", { x1: f.sx(u * tc), x2: f.sx(u * tc), y1: f.sy(0), y2: f.sy(Math.max(0, minDO)), style: `stroke:${BRAND};stroke-opacity:0.5;stroke-dasharray:3 3` }, f.g);
      el("circle", { cx: f.sx(u * tc), cy: f.sy(Math.max(0, minDO)), r: 4.5, style: `fill:${BRAND}` }, f.g);
      text(f.g, f.sx(u * tc) + 8, f.sy(Math.max(0, minDO)) + 14, `DO min ${num(minDO, 2)} mg/L`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    }
    text(f.g, f.sx(xmax) - 2, f.sy(Math.max(0, sat - deficit(tEnd))) + 16, "dissolved oxygen", { "text-anchor": "end", style: `fill:${WATER}` });

    // Reach below 5 mg/L, from a fine sampling of the curve.
    let a = null, b = null;
    const fine = 4000, horizon = Math.max(tEnd, 4 * tc + 10 / ka);
    for (let j = 0; j <= fine; j++) {
      const t = (horizon * j) / fine;
      if (sat - deficit(t) < 5) {
        if (a === null) a = t;
        b = t;
      }
    }
    o.tc.textContent = `${num(tc, 2)} days`;
    o.xc.textContent = `${num(u * tc, 1)} km`;
    o.min.textContent = minDO < 0 ? "anoxic: model breaks down" : `${num(minDO, 2)} mg/L`;
    o.f.textContent = num(ka / kd, 2);
    o.low.textContent = a === null ? "never" : `${num(u * a, 1)}–${num(u * b, 1)} km`;
  }
  draw();
}

// ============================================================ D8 drainage

const D8_COLS = 40, D8_ROWS = 28, D8_CELL = 13.5;
const D8_DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// A binary min-heap of [z, cell].
function heap() {
  const a = [];
  const up = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < a.length && a[l][0] < a[m][0]) m = l;
      if (r < a.length && a[r][0] < a[m][0]) m = r;
      if (m === i) break;
      [a[m], a[i]] = [a[i], a[m]];
      i = m;
    }
  };
  return {
    size: () => a.length,
    push(x) { a.push(x); up(a.length - 1); },
    pop() {
      const top = a[0], last = a.pop();
      if (a.length) { a[0] = last; down(0); }
      return top;
    },
  };
}

function terrain(seed) {
  const r = rng(seed);
  const W = D8_COLS, H = D8_ROWS;
  const octave = (cells, amp) => {
    const gw = Math.ceil(W / cells) + 2, gh = Math.ceil(H / cells) + 2;
    const g = Array.from({ length: gw * gh }, () => r());
    return (x, y) => {
      const fx = x / cells, fy = y / cells, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const sm = (t) => t * t * (3 - 2 * t);
      const v = (i, j) => g[j * gw + i];
      const a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * sm(tx);
      const b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * sm(tx);
      return amp * (a + (b - a) * sm(ty));
    };
  };
  const o1 = octave(10, 1), o2 = octave(5, 0.5), o3 = octave(2.5, 0.22);
  const valley = W * (0.35 + 0.3 * r());
  const z = new Float64Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) z[y * W + x] = 2.6 * (1 - y / H) + 0.06 * Math.abs(x - valley - 4 * Math.sin(y / 5)) + o1(x, y) + o2(x, y) + o3(x, y);
  return z;
}

// Priority flood (Barnes et al.) with an ε gradient, then D8 and accumulation.
function route(z0) {
  const W = D8_COLS, H = D8_ROWS, n = W * H;
  const z = Float64Array.from(z0);
  const seen = new Uint8Array(n);
  const q = heap();
  for (let i = 0; i < n; i++) {
    const x = i % W, y = (i / W) | 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { seen[i] = 1; q.push([z[i], i]); }
  }
  let filled = 0;
  while (q.size()) {
    const [zc, c] = q.pop();
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of D8_DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nb = ny * W + nx;
      if (seen[nb]) continue;
      seen[nb] = 1;
      if (z[nb] <= zc + 1e-6) { z[nb] = zc + 1e-6; filled++; }
      q.push([z[nb], nb]);
    }
  }
  const dest = new Int32Array(n).fill(-1);
  for (let c = 0; c < n; c++) {
    const x = c % W, y = (c / W) | 0;
    let best = 0;
    for (const [dx, dy] of D8_DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nb = ny * W + nx;
      const slope = (z[c] - z[nb]) / (dx && dy ? Math.SQRT2 : 1);
      if (slope > best) { best = slope; dest[c] = nb; }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => z[b] - z[a]);
  const acc = new Int32Array(n).fill(1);
  for (const c of order) if (dest[c] >= 0) acc[dest[c]] += acc[c];
  const up = Array.from({ length: n }, () => []);
  for (let c = 0; c < n; c++) if (dest[c] >= 0) up[dest[c]].push(c);
  return { z, dest, acc, up, filled };
}

for (const root of document.querySelectorAll("[data-hydro-d8]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const s = scrubAll(root, drawNet);
  const W = D8_COLS, H = D8_ROWS, ox = (560 - W * D8_CELL) / 2, oy = (400 - H * D8_CELL) / 2;
  const cx = (c) => ox + ((c % W) + 0.5) * D8_CELL, cy = (c) => oy + (((c / W) | 0) + 0.5) * D8_CELL;
  let net, selected = -1, arrows = false;
  const base = el("g", {}, svg), shade = el("g", {}, svg), lines = el("g", {}, svg), pick = el("g", {}, svg);

  function build(seed) {
    net = route(terrain(seed));
    selected = -1;
    base.replaceChildren();
    let lo = Infinity, hi = -Infinity;
    for (const v of net.z) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let c = 0; c < W * H; c++) {
      const t = (net.z[c] - lo) / (hi - lo);
      el("rect", { x: ox + (c % W) * D8_CELL, y: oy + ((c / W) | 0) * D8_CELL, width: D8_CELL + 0.3, height: D8_CELL + 0.3, style: `fill:currentColor;fill-opacity:${(0.03 + 0.3 * t).toFixed(3)}` }, base);
    }
    el("rect", { x: ox, y: oy, width: W * D8_CELL, height: H * D8_CELL, style: "fill:none;stroke:currentColor;stroke-opacity:0.3" }, base);
    drawNet();
  }

  function drawNet() {
    const thr = s.thr.get();
    lines.replaceChildren();
    let chan = 0, max = 0;
    for (let c = 0; c < W * H; c++) {
      max = Math.max(max, net.acc[c]);
      const d = net.dest[c];
      if (arrows) {
        const x0 = cx(c), y0 = cy(c);
        // A small arrow across the cell, pointing at the receiving neighbour
        // (or off the edge).
        const ux = d >= 0 ? Math.sign(cx(d) - x0) : c % W === 0 ? -1 : c % W === W - 1 ? 1 : 0;
        const uy = d >= 0 ? Math.sign(cy(d) - y0) : edgeDy(c) ? Math.sign(edgeDy(c)) : 0;
        const len = Math.hypot(ux, uy) || 1, ax = ux / len, ay = uy / len, r = D8_CELL * 0.36;
        const tx = x0 + ax * r, ty = y0 + ay * r;
        el("line", { x1: x0 - ax * r, y1: y0 - ay * r, x2: tx - ax * 2, y2: ty - ay * 2, style: "stroke:currentColor;stroke-opacity:0.4;stroke-width:0.8" }, lines);
        el("polygon", { points: `${tx},${ty} ${tx - ax * 3.2 - ay * 2},${ty - ay * 3.2 + ax * 2} ${tx - ax * 3.2 + ay * 2},${ty - ay * 3.2 - ax * 2}`, style: "fill:currentColor;fill-opacity:0.45" }, lines);
      }
      if (net.acc[c] < thr) continue;
      chan++;
      // Cells that drain off the map get a stub towards the edge.
      const x2 = d >= 0 ? cx(d) : cx(c) + (c % W === 0 ? -D8_CELL / 2 : c % W === W - 1 ? D8_CELL / 2 : 0);
      const y2 = d >= 0 ? cy(d) : cy(c) + edgeDy(c);
      el("line", { x1: cx(c), y1: cy(c), x2, y2, style: `stroke:${WATER};stroke-width:${(0.8 + 1.1 * Math.log10(net.acc[c])).toFixed(2)};stroke-linecap:round` }, lines);
    }
    drawPick();
    o.grid.textContent = `${W} × ${H} = ${W * H} cells`;
    o.pits.textContent = `${net.filled} cells raised`;
    o.max.textContent = `${max} cells`;
    o.chan.textContent = `${chan} cells`;
  }
  const edgeDy = (c) => {
    const y = (c / W) | 0;
    return y === 0 ? -D8_CELL / 2 : y === H - 1 ? D8_CELL / 2 : 0;
  };

  function drawPick() {
    shade.replaceChildren();
    pick.replaceChildren();
    if (selected < 0) {
      o.sel.textContent = "click a cell";
      return;
    }
    // Everything upstream of the cell, by walking the reversed flow graph.
    const stack = [selected], basin = [];
    while (stack.length) {
      const c = stack.pop();
      basin.push(c);
      for (const u of net.up[c]) stack.push(u);
    }
    for (const c of basin) el("rect", { x: ox + (c % W) * D8_CELL, y: oy + ((c / W) | 0) * D8_CELL, width: D8_CELL + 0.3, height: D8_CELL + 0.3, style: `fill:${BRAND};fill-opacity:0.28` }, shade);
    const path = [];
    for (let c = selected; c >= 0; c = net.dest[c]) path.push([cx(c), cy(c)]);
    polyline(pick, path, `stroke:${BRAND};stroke-width:2;stroke-dasharray:4 3`);
    el("rect", { x: ox + (selected % W) * D8_CELL, y: oy + ((selected / W) | 0) * D8_CELL, width: D8_CELL, height: D8_CELL, style: `fill:none;stroke:${BRAND};stroke-width:2` }, pick);
    o.sel.textContent = `${basin.length} cells (${pct(basin.length / (W * H))}), acc = ${net.acc[selected]}`;
  }

  svg.addEventListener("click", (e) => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 560 - ox, y = ((e.clientY - r.top) / r.height) * 400 - oy;
    const i = Math.floor(x / D8_CELL), j = Math.floor(y / D8_CELL);
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    selected = j * W + i;
    drawPick();
  });
  svg.style.cursor = "crosshair";
  onToggle(root, (name, on) => { if (name === "arrows") { arrows = on; drawNet(); } });
  root.querySelector('[data-action="resample"]').addEventListener("click", () => build(newSeed()));
  root.querySelector('[data-action="clear"]').addEventListener("click", () => { selected = -1; drawPick(); });
  build(42);
}
