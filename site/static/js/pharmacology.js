// Pharmacology blocks: pharmacokinetic models of a generic drug with
// illustrative parameters. Teaching models only, never dosing tools.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const LN2 = Math.LN2;

// Readable numbers: fewer decimals as values grow.
const fmt = (v, unit = "") => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a >= 1000 ? Math.round(v).toLocaleString("en") : a >= 100 ? num(v, 0) : a >= 10 ? num(v, 1) : a >= 0.1 ? num(v, 2) : v.toPrecision(2);
  return unit ? `${s} ${unit}` : s;
};

function niceStep(max, n = 4) {
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
const ticks = (max, n = 4) => {
  const s = niceStep(max, n);
  const out = [];
  for (let v = 0; v <= max * 1.0001; v += s) out.push(+v.toPrecision(10));
  return out;
};
const decade = (v) => (v >= 1 && v < 1e4 ? String(Math.round(v)) : v >= 0.01 && v < 1 ? String(+v.toPrecision(1)) : `1e${Math.round(Math.log10(v))}`.replace("-", "−"));

/**
 * concPlot draws concentration curves against time, on a linear or log
 * axis. series: [{ pts: [[t, c]], style }]. opts: { tmax, log, ymax,
 * band: [mec, mtc], vlines: [{ t, style }], xlabel, ylabel, box }.
 */
function concPlot(svg, series, opts) {
  svg.replaceChildren();
  const box = opts.box ?? [52, 14, 570, 240];
  const all = series.flatMap((s) => s.pts.map((p) => p[1])).filter((c) => c > 0);
  let ymax = opts.ymax ?? Math.max(...all, opts.band ? opts.band[1] * 1.15 : 0) * 1.1;
  if (!(ymax > 0)) ymax = 1;
  const xt = ticks(opts.tmax, 6);
  let f, Y;
  if (opts.log) {
    const hi = Math.ceil(Math.log10(ymax));
    const lo = hi - (opts.decades ?? 3);
    f = frame(svg, { box, x: [0, opts.tmax], y: [lo, hi], xticks: xt, yticks: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), yfmt: (v) => decade(10 ** v), xlabel: opts.xlabel ?? "time (h)", ylabel: opts.ylabel ?? "mg/L" });
    f.lo = lo;
    Y = (c) => f.sy(Math.max(lo, Math.log10(Math.max(c, 1e-12))));
  } else {
    f = frame(svg, { box, x: [0, opts.tmax], y: [0, ymax], xticks: xt, yticks: ticks(ymax), yfmt: (v) => fmt(v), xlabel: opts.xlabel ?? "time (h)", ylabel: opts.ylabel ?? "mg/L" });
    Y = (c) => f.sy(Math.min(ymax, c));
  }
  if (opts.band) {
    const [mec, mtc] = opts.band;
    const top = f.T;
    el("rect", { x: f.L, y: Y(mtc), width: f.W, height: Math.max(0, Y(mec) - Y(mtc)), style: "fill:var(--code-add);fill-opacity:0.12" }, svg);
    el("rect", { x: f.L, y: top, width: f.W, height: Math.max(0, Y(mtc) - top), style: "fill:var(--code-del);fill-opacity:0.07" }, svg);
  }
  for (const v of opts.vlines ?? []) el("line", { x1: f.sx(v.t), x2: f.sx(v.t), y1: f.T, y2: f.T + f.H, style: v.style }, svg);
  for (const s of series) {
    if (!opts.log) { polyline(svg, s.pts.map(([t, c]) => [f.sx(t), Y(c)]), s.style); continue; }
    // On a log axis, a curve stops at the floor instead of running along it.
    const floor = 10 ** f.lo;
    let run = [];
    for (const [t, c] of s.pts) {
      if (c >= floor) run.push([f.sx(t), Y(c)]);
      else if (run.length) { if (run.length > 1) polyline(svg, run, s.style); run = []; }
    }
    if (run.length > 1) polyline(svg, run, s.style);
  }
  return { f, Y };
}

const sample = (fn, tmax, n = 400) => Array.from({ length: n + 1 }, (_, i) => { const t = (tmax * i) / n; return [t, fn(t)]; });

// One dose: IV bolus or first-order oral absorption (Bateman).
function single({ D, V, k, ka, F, route }) {
  if (route === "iv") return (t) => (t < 0 ? 0 : (D / V) * Math.exp(-k * t));
  if (Math.abs(ka - k) < 1e-9) return (t) => (t < 0 ? 0 : ((F * D * k) / V) * t * Math.exp(-k * t));
  const c = (F * D * ka) / (V * (ka - k));
  return (t) => (t < 0 ? 0 : c * (Math.exp(-k * t) - Math.exp(-ka * t)));
}

// ============================================================ single dose

for (const root of document.querySelectorAll("[data-pharm-single]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let route = "iv", log = false;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { route = e.detail.value; draw(); });
  onToggle(root, (_, on) => { log = on; draw(); });

  function draw() {
    const D = s.dose.get(), V = s.v.get(), CL = s.cl.get(), ka = s.ka.get(), F = route === "iv" ? 1 : s.f.get();
    const k = CL / V, th = LN2 / k;
    const tmax = route === "iv" ? 0 : Math.abs(ka - k) < 1e-9 ? 1 / k : Math.log(ka / k) / (ka - k);
    const T = Math.min(168, Math.max(5 * th, 3 * tmax, 4));
    const fn = single({ D, V, k, ka, F, route });
    const ref = single({ D, V, k, ka, F: 1, route: "iv" });
    const series = [];
    if (route === "oral") series.push({ pts: sample(ref, T), style: "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:5 4" });
    series.push({ pts: sample(fn, T), style: "stroke:var(--foreground);stroke-width:2" });
    const { f, Y } = concPlot(svg, series, { tmax: T, log });
    const cmax = route === "iv" ? D / V : fn(tmax);
    el("circle", { cx: f.sx(tmax), cy: Y(cmax), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(tmax) + 7, Y(cmax) - 6, `Cmax ${fmt(cmax)}`, { class: "fill-foreground font-mono text-[10px]" });
    o.k.textContent = `${fmt(k)} /h`;
    o.thalf.textContent = fmt(th, "h");
    o.cmax.textContent = fmt(cmax, "mg/L");
    o.tmax.textContent = route === "iv" ? "0 h (at injection)" : fmt(tmax, "h");
    o.auc.textContent = fmt((F * D) / CL, "mg·h/L");
  }
  draw();
}

// ============================================================ multiple dosing

for (const root of document.querySelectorAll("[data-pharm-multi]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let route = "iv";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { route = e.detail.value; draw(); });
  const KA = 1.0; // 1/h, illustrative oral absorption

  function draw() {
    const D = s.dose.get(), tau = s.tau.get(), th = s.thalf.get(), V = s.v.get();
    const mec = s.mec.get(), mtc = Math.max(s.mtc.get(), mec * 1.01);
    const k = LN2 / th;
    const one = single({ D, V, k, ka: KA, F: 1, route });
    const T = Math.min(240, Math.max(6 * th, 4 * tau));
    const conc = (t) => { let c = 0; for (let n = 0; n * tau <= t + 1e-9; n++) c += one(t - n * tau); return c; };
    const pts = [];
    const N = 900;
    for (let i = 0; i <= N; i++) {
      const t = (T * i) / N;
      // Sample just before and at each dose so the jumps are vertical.
      pts.push([t, conc(t)]);
    }
    if (route === "iv") {
      const doses = [];
      for (let n = 1; n * tau <= T; n++) doses.push(n * tau);
      const merged = [];
      let j = 0;
      for (const p of pts) {
        while (j < doses.length && doses[j] <= p[0]) { merged.push([doses[j], conc(doses[j] - 1e-6)], [doses[j], conc(doses[j])]); j++; }
        merged.push(p);
      }
      pts.splice(0, pts.length, ...merged.sort((a, b) => a[0] - b[0]));
    }
    const vlines = [];
    for (let n = 0; n * tau <= T; n++) vlines.push({ t: n * tau, style: "stroke:currentColor;stroke-opacity:0.12" });
    concPlot(svg, [{ pts, style: "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round" }], { tmax: T, band: [mec, mtc], vlines });

    const R = 1 / (1 - Math.exp(-k * tau));
    let cmax, cmin;
    if (route === "iv") { cmax = (D / V) * R; cmin = cmax * Math.exp(-k * tau); }
    else {
      // Steady state numerically: one interval after many half-lives.
      const t0 = Math.ceil((20 * th) / tau) * tau;
      cmax = 0; cmin = Infinity;
      for (let i = 0; i <= 400; i++) { const c = conc(t0 + (tau * i) / 400); cmax = Math.max(cmax, c); cmin = Math.min(cmin, c); }
    }
    o.r.textContent = `×${fmt(R)}`;
    o.cmax.textContent = fmt(cmax, "mg/L");
    o.cmin.textContent = fmt(cmin, "mg/L");
    o.five.textContent = `${num(100 * (1 - 2 ** -5), 1)}% of steady state`;
    o.verdict.textContent = cmax >= mtc ? "peaks reach the toxic range" : cmin < mec ? "troughs fall below the window" : "stays within the window";
    o.verdict.className = cmax >= mtc ? "text-del" : cmin < mec ? "" : "text-add";
  }
  draw();
}

// ============================================================ infusion

for (const root of document.querySelectorAll("[data-pharm-infusion]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let load = false;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { load = on; draw(); });

  function draw() {
    const R0 = s.rate.get(), CL = s.cl.get(), V = s.v.get(), stop = s.stop.get();
    const k = CL / V, th = LN2 / k, css = R0 / CL;
    const T = Math.min(144, stop + 3 * th);
    const plain = (t) => {
      const t1 = Math.min(t, stop);
      const c = css * (1 - Math.exp(-k * t1));
      return t <= stop ? c : c * Math.exp(-k * (t - stop));
    };
    const loaded = (t) => (t <= stop ? css : css * Math.exp(-k * (t - stop)));
    const series = [{ pts: sample(plain, T), style: "stroke:var(--foreground);stroke-width:2" }];
    if (load) series.push({ pts: sample(loaded, T), style: "stroke:var(--brand);stroke-width:2" });
    const { f, Y } = concPlot(svg, series, { tmax: T, ymax: css * 1.3, vlines: [{ t: stop, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }] });
    el("line", { x1: f.L, x2: f.L + f.W, y1: Y(css), y2: Y(css), style: "stroke:var(--code-add);stroke-dasharray:6 4;stroke-width:1.5" }, svg);
    text(svg, f.L + f.W - 2, Y(css) - 5, `Css ${fmt(css)} mg/L`, { "text-anchor": "end" });
    text(svg, f.sx(stop) + 4, f.T + 10, "infusion stops", {});
    o.css.textContent = fmt(css, "mg/L");
    o.ld.textContent = fmt(css * V, "mg");
    o.thalf.textContent = fmt(th, "h");
    o.t90.textContent = `${fmt(Math.LN10 / k, "h")} (3.3 t½)`;
  }
  draw();
}

// ============================================================ two compartments

for (const root of document.querySelectorAll("[data-pharm-two]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const D = s.dose.get(), V1 = s.v1.get(), k12 = s.k12.get(), k21 = s.k21.get(), k10 = s.k10.get();
    const sum = k12 + k21 + k10, prod = k21 * k10;
    const disc = Math.sqrt(Math.max(0, sum * sum - 4 * prod));
    const a = (sum + disc) / 2, b = (sum - disc) / 2;
    const c0 = D / V1;
    const A = a - b > 1e-12 ? (c0 * (a - k21)) / (a - b) : c0;
    const B = a - b > 1e-12 ? (c0 * (k21 - b)) / (a - b) : 0;
    const C = (t) => A * Math.exp(-a * t) + B * Math.exp(-b * t);
    const X2 = (t) => (a - b > 1e-12 ? ((D * k12) / (a - b)) * (Math.exp(-b * t) - Math.exp(-a * t)) : 0);
    const T = Math.min(120, Math.max(4, 5 * (LN2 / b)));
    concPlot(svg, [
      { pts: sample((t) => A * Math.exp(-a * t), T), style: "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:5 4" },
      { pts: sample((t) => B * Math.exp(-b * t), T), style: "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:5 4" },
      { pts: sample((t) => X2(t) / V1, T), style: "stroke:var(--vec-u);stroke-width:1.5" },
      { pts: sample(C, T), style: "stroke:var(--foreground);stroke-width:2" },
    ], { tmax: T, log: true, ymax: c0 * 1.2, decades: 4 });
    o.alpha.textContent = `${fmt(a)} /h`;
    o.beta.textContent = `${fmt(b)} /h`;
    o.ta.textContent = fmt(LN2 / a, "h");
    o.tb.textContent = fmt(LN2 / b, "h");
    o.ab.textContent = `${fmt(A)}, ${fmt(B)} mg/L`;
  }
  draw();
}

// ============================================================ therapeutic index

for (const root of document.querySelectorAll("[data-pharm-ti]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const ed = s.ed50.get(), td = s.td50.get(), ld = s.ld50.get(), n = s.slope.get();
    const q = (d50) => (d) => 100 / (1 + (d50 / d) ** n);
    const lo = Math.floor(Math.log10(Math.min(ed, td, ld)) - 1.5), hi = Math.ceil(Math.log10(Math.max(ed, td, ld)) + 1.5);
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 570, 240], x: [lo, hi], y: [0, 100], xticks: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), yticks: [0, 50, 100], xfmt: (v) => decade(10 ** v), yfmt: (v) => `${v}%`, xlabel: "dose (mg, log scale)", ylabel: "responding" });
    hline(svg, f, 50, "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4");
    const curve = (fn, style) => polyline(svg, Array.from({ length: 301 }, (_, i) => { const x = lo + ((hi - lo) * i) / 300; return [f.sx(x), f.sy(fn(10 ** x))]; }), style);
    const ed99 = ed * 99 ** (1 / n), td1 = td * (1 / 99) ** (1 / n);
    for (const [x, label] of [[ed99, "ED99"], [td1, "TD1"]]) {
      const lx = Math.log10(x);
      if (lx < lo || lx > hi) continue;
      el("line", { x1: f.sx(lx), x2: f.sx(lx), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
      text(svg, f.sx(lx) + 3, f.T + 10, label, {});
    }
    curve(q(ld), "stroke:var(--code-del);stroke-width:2");
    curve(q(td), "stroke:var(--vec-out);stroke-width:2");
    curve(q(ed), "stroke:var(--code-add);stroke-width:2");
    const csf = td1 / ed99;
    o.ti.textContent = fmt(td / ed);
    o.lti.textContent = fmt(ld / ed);
    o.csf.textContent = fmt(csf);
    o.verdict.textContent = csf < 1 ? "the tails overlap: some patients get toxicity at doses others still need" : "clear margin between the curves";
    o.verdict.className = csf < 1 ? "text-del" : "text-add";
  }
  draw();
}

// ============================================================ receptor binding

for (const root of document.querySelectorAll("[data-pharm-bind]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let view = "linear";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { view = e.detail.value; draw(); });

  function draw() {
    const kd = s.kd.get(), bmax = s.bmax.get(), L = s.l.get();
    const occ = L / (L + kd), B = bmax * occ;
    svg.replaceChildren();
    const box = [56, 14, 566, 240];
    const dot = (x, y) => el("circle", { cx: x, cy: y, r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    if (view === "scatchard") {
      const f = frame(svg, { box, x: [0, bmax], y: [0, bmax / kd], xticks: ticks(bmax), yticks: ticks(bmax / kd), yfmt: (v) => fmt(v), xlabel: "bound B (fmol/mg)", ylabel: "B / F" });
      polyline(svg, [[f.sx(0), f.sy(bmax / kd)], [f.sx(bmax), f.sy(0)]], "stroke:var(--foreground);stroke-width:2");
      dot(f.sx(B), f.sy((bmax - B) / kd));
      text(svg, f.L + f.W - 4, f.T + 12, `slope −1/Kd = ${fmt(-1 / kd)}`, { "text-anchor": "end" });
    } else if (view === "log") {
      const lo = Math.floor(Math.log10(kd)) - 3, hi = lo + 6;
      const f = frame(svg, { box, x: [lo, hi], y: [0, bmax], xticks: Array.from({ length: 7 }, (_, i) => lo + i), yticks: ticks(bmax), xfmt: (v) => decade(10 ** v), xlabel: "[L] (nM, log scale)", ylabel: "bound" });
      polyline(svg, Array.from({ length: 301 }, (_, i) => { const x = lo + (6 * i) / 300; const l = 10 ** x; return [f.sx(x), f.sy((bmax * l) / (l + kd))]; }), "stroke:var(--foreground);stroke-width:2");
      el("line", { x1: f.sx(Math.log10(kd)), x2: f.sx(Math.log10(kd)), y1: f.sy(bmax / 2), y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, svg);
      text(svg, f.sx(Math.log10(kd)) + 4, f.T + f.H - 6, "Kd", {});
      const lx = Math.log10(L);
      if (lx >= lo && lx <= hi) dot(f.sx(lx), f.sy(B));
    } else {
      const xmax = Math.max(10 * kd, L * 1.3);
      const f = frame(svg, { box, x: [0, xmax], y: [0, bmax], xticks: ticks(xmax, 5), yticks: ticks(bmax), xfmt: (v) => fmt(v), xlabel: "[L] (nM)", ylabel: "bound" });
      hline(svg, f, bmax, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4", "Bmax");
      polyline(svg, Array.from({ length: 301 }, (_, i) => { const l = (xmax * i) / 300; return [f.sx(l), f.sy((bmax * l) / (l + kd))]; }), "stroke:var(--foreground);stroke-width:2");
      dot(f.sx(L), f.sy(B));
    }
    o.occ.textContent = `${num(100 * occ, 1)}%`;
    o.bound.textContent = fmt(B, "fmol/mg");
    o.c50.textContent = `${fmt(kd, "nM")} (= Kd)`;
    o.c90.textContent = `${fmt(9 * kd, "nM")} (9·Kd)`;
  }
  draw();
}

// ============================================================ interactions

for (const root of document.querySelectorAll("[data-pharm-ddi]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "inhibitor";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    mode = e.detail.value;
    s.factor.set(mode === "inhibitor" ? 0.4 : 2.5, false);
    draw();
  });

  function draw() {
    const D = s.dose.get(), tau = s.tau.get(), CL = s.cl.get(), V = s.v.get();
    let fct = s.factor.get();
    if (mode === "inhibitor" && fct > 1) fct = 1 / fct;
    if (mode === "inducer" && fct < 1) fct = 1 / fct;
    const start = s.start.get() * 24;
    const days = 14, T = days * 24, dt = 0.05;
    const k0 = CL / V, k1 = (CL * fct) / V;
    const pts = [];
    let c = 0, next = 0;
    for (let t = 0; t <= T + 1e-9; t += dt) {
      if (t + 1e-9 >= next) { pts.push([t / 24, c]); c += D / V; next += tau; }
      pts.push([t / 24, c]);
      c *= Math.exp(-(t < start ? k0 : k1) * dt);
    }
    const before = D / (CL * tau), after = D / (CL * fct * tau);
    const { f } = concPlot(svg, [{ pts, style: "stroke:var(--foreground);stroke-width:1.5;stroke-linejoin:round" }],
      { tmax: days, xlabel: "time (days)", vlines: [{ t: start / 24, style: "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:4 3" }] });
    text(svg, f.sx(start / 24) + 4, f.T + 10, mode === "inhibitor" ? "inhibitor started" : "inducer started", { style: "fill:var(--brand)" });
    o.before.textContent = fmt(before, "mg/L");
    o.after.textContent = `${fmt(after, "mg/L")} (×${fmt(after / before)})`;
    o.thalf.textContent = `${fmt(LN2 / k0, "h")} → ${fmt(LN2 / k1, "h")}`;
    o.settle.textContent = `≈ ${fmt((5 * LN2) / k1 / 24)} days after the start`;
  }
  draw();
}

// ============================================================ saturable elimination

for (const root of document.querySelectorAll("[data-pharm-mm]")) {
  const tsvg = root.querySelector("[data-time]");
  const csvg = root.querySelector("[data-css]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const cssOf = (R, vmax, km) => (R < vmax ? (km * R) / (vmax - R) : Infinity);

  function draw() {
    const R = s.rate.get(), vmax = s.vmax.get(), km = s.km.get(), V = s.v.get();
    const css = cssOf(R, vmax, km), lin = (R * km) / vmax;
    // Time course: Euler with small steps in days.
    const T = 40, dt = 0.01;
    const mm = [], li = [];
    let c = 0, cl = 0, t90 = NaN;
    for (let t = 0; t <= T + 1e-9; t += dt) {
      if (Math.round(t / dt) % 10 === 0) { mm.push([t, c]); li.push([t, cl]); }
      if (Number.isNaN(t90) && Number.isFinite(css) && c >= 0.9 * css) t90 = t;
      c += (dt * (R - (vmax * c) / (km + c))) / V;
      cl += (dt * (R - (vmax / km) * cl)) / V;
    }
    const ymax = Math.max(Number.isFinite(css) ? css * 1.25 : c * 1.1, lin * 1.25, 1);
    concPlot(tsvg, [
      { pts: li, style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4" },
      { pts: mm, style: "stroke:var(--foreground);stroke-width:2" },
    ], { tmax: T, ymax, xlabel: "time (days)", box: [44, 14, 344, 240] });

    // Css against dose rate, with the linear prediction and the asymptote.
    csvg.replaceChildren();
    const cap = Math.max(cssOf(0.95 * vmax, vmax, km), 1);
    const f = frame(csvg, { box: [40, 14, 206, 240], x: [0, vmax * 1.05], y: [0, cap], xticks: ticks(vmax, 3), yticks: ticks(cap, 3), xfmt: (v) => fmt(v), yfmt: (v) => fmt(v), xlabel: "mg/day", ylabel: "Css" });
    polyline(csvg, [[f.sx(0), f.sy(0)], [f.sx(vmax * 1.05), f.sy(Math.min(cap, (vmax * 1.05 * km) / vmax))]], "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:5 4");
    polyline(csvg, Array.from({ length: 201 }, (_, i) => { const r = (0.95 * vmax * i) / 200; return [f.sx(r), f.sy(Math.min(cap, cssOf(r, vmax, km)))]; }), "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: f.sx(vmax), x2: f.sx(vmax), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-del);stroke-opacity:0.6;stroke-dasharray:3 4" }, csvg);
    text(csvg, f.sx(vmax) - 3, f.T + 10, "Vmax", { "text-anchor": "end" });
    if (Number.isFinite(css) && css <= cap) el("circle", { cx: f.sx(R), cy: f.sy(css), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, csvg);

    const css11 = cssOf(1.1 * R, vmax, km);
    o.css.textContent = Number.isFinite(css) ? fmt(css, "mg/L") : "none: intake ≥ Vmax, it keeps rising";
    o.css.className = Number.isFinite(css) ? "" : "text-del";
    o.lin.textContent = fmt(lin, "mg/L");
    o.plus.textContent = Number.isFinite(css) && Number.isFinite(css11) ? `+${num(100 * (css11 / css - 1), 0)}% Css` : "no steady state";
    o.t90.textContent = Number.isFinite(t90) ? fmt(t90, "days") : "beyond 40 days";
  }
  draw();
}

// ============================================================ population

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const root of document.querySelectorAll("[data-pharm-pop]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 3;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const D = s.dose.get(), tau = s.tau.get(), CL = s.cl.get(), cv = s.cv.get() / 100;
    const mec = s.mec.get(), mtc = Math.max(s.mtc.get(), mec * 1.01);
    const omega = Math.sqrt(Math.log(1 + cv * cv)); // log-normal SD for this CV
    const rng = mulberry32(seed * 7919);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    const N = 400;
    const css = Array.from({ length: N }, () => D / (CL * Math.exp(omega * gauss()) * tau)).sort((a, b) => a - b);
    const lo = Math.floor(Math.log10(Math.min(css[0], mec)) - 0.2), hi = Math.ceil(Math.log10(Math.max(css[N - 1], mtc)) + 0.2);
    const bins = 36, w = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const c of css) counts[Math.min(bins - 1, Math.max(0, Math.floor((Math.log10(c) - lo) / w)))]++;
    const top = Math.max(10, Math.ceil(Math.max(...counts) / 10) * 10);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 578, 240], x: [lo, hi], y: [0, top], xticks: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), yticks: [0, top / 2, top], xfmt: (v) => decade(10 ** v), xlabel: "average steady-state concentration (mg/L, log scale)", ylabel: "people" });
    const lx = Math.log10(mec), hx = Math.log10(mtc);
    el("rect", { x: f.sx(lx), y: f.T, width: f.sx(hx) - f.sx(lx), height: f.H, style: "fill:var(--code-add);fill-opacity:0.12" }, svg);
    el("rect", { x: f.sx(hx), y: f.T, width: f.L + f.W - f.sx(hx), height: f.H, style: "fill:var(--code-del);fill-opacity:0.07" }, svg);
    counts.forEach((n, i) => {
      if (!n) return;
      const x0 = f.sx(lo + i * w), x1 = f.sx(lo + (i + 1) * w);
      el("rect", { x: x0 + 0.5, y: f.sy(n), width: Math.max(0.5, x1 - x0 - 1), height: f.T + f.H - f.sy(n), style: "fill:var(--foreground);fill-opacity:0.75" }, svg);
    });
    const below = css.filter((c) => c < mec).length, above = css.filter((c) => c >= mtc).length;
    o.below.textContent = `${num((100 * below) / N, 1)}%`;
    o.in.textContent = `${num((100 * (N - below - above)) / N, 1)}%`;
    o.above.textContent = `${num((100 * above) / N, 1)}%`;
    o.above.className = above ? "text-del" : "";
    o.median.textContent = fmt(css[N / 2], "mg/L");
  }
  draw();
}

// ============================================================ trial phases

for (const root of document.querySelectorAll("[data-pharm-trials]")) {
  const tabs = [...root.querySelectorAll("[data-phase]")];
  const cards = [...root.querySelectorAll("[data-phase-card]")];
  const count = root.querySelector("[data-out=count]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(cards.length - 1, i));
    cards.forEach((c, k) => (c.hidden = k !== at));
    tabs.forEach((t, k) => t.toggleAttribute("data-on", k <= at));
    count.textContent = `${at + 1} / ${cards.length}`;
    back.disabled = at === 0;
    next.disabled = at === cards.length - 1;
  };
  tabs.forEach((t, k) => t.addEventListener("click", () => go(k)));
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1 }[e.key];
    if (to === undefined || e.target.closest("input")) return;
    e.preventDefault();
    go(to);
  });
}
