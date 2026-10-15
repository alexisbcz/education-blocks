// Thermodynamics blocks: ideal-gas cycles and processes, the second law,
// multiplicities, the heat equation, water's phase diagram (IAPWS),
// energy flow through engines and refrigerators, and calorimetry. The
// isometric Stirling engine lives in ../anatomy/engine.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import "../anatomy/engine.js";

const R = 8.314462618; // J·mol⁻¹·K⁻¹
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const fmtJ = (v) => (Math.abs(v) < 0.05 ? "0" : num(v, Math.abs(v) >= 100 ? 0 : 1));
const minus = (s) => String(s).replace("-", "−");

// A segmented control's value changes; [data-only] parts show for some values.
function showOnly(root, value) {
  for (const n of root.querySelectorAll("[data-only]")) n.hidden = !n.dataset.only.split(" ").includes(value);
}

// ============================================================ Ideal-gas processes

// A process from state a = {T, V} to state b, sampled as (V, T) points,
// with Q (into the gas), W (by the gas) and ΔU for n = 1 mol.
function process(kind, a, b, g) {
  const cv = R / (g - 1);
  const N = 48;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let V, T;
    if (kind === "isothermal" || kind === "adiabatic") {
      V = a.V * (b.V / a.V) ** t;
      T = kind === "isothermal" ? a.T : a.T * (a.V / V) ** (g - 1);
    } else if (kind === "isochoric") {
      V = a.V;
      T = a.T + (b.T - a.T) * t;
    } else {
      V = a.V + (b.V - a.V) * t;
      T = (a.T * V) / a.V; // P constant: T ∝ V
    }
    pts.push({ V, T, P: (R * T) / V, S: cv * Math.log(T) + R * Math.log(V) });
  }
  const dU = cv * (b.T - a.T);
  const W =
    kind === "isothermal" ? R * a.T * Math.log(b.V / a.V)
    : kind === "adiabatic" ? -dU
    : kind === "isochoric" ? 0
    : (R * a.T / a.V) * (b.V - a.V);
  return { kind, a, b, pts, dU, W, Q: dU + W };
}

// Each cycle returns its processes (closing back to state 1), a title, the
// textbook efficiency and the extreme temperatures for the Carnot bound.
function cycle(name, p) {
  const g = p.gamma;
  const k = 1 / (g - 1);
  const st = (T, V) => ({ T, V });
  if (name === "carnot") {
    if (p.th <= p.tc) return { error: "T hot must be above T cold." };
    const a = (p.th / p.tc) ** k, V1 = 0.5e-3;
    const s = [st(p.th, V1), st(p.th, p.r * V1), st(p.tc, p.r * V1 * a), st(p.tc, V1 * a)];
    return {
      title: "Carnot: two isotherms, two adiabats",
      procs: [["isothermal", 0, 1, "isothermal expansion"], ["adiabatic", 1, 2, "adiabatic expansion"], ["isothermal", 2, 3, "isothermal compression"], ["adiabatic", 3, 0, "adiabatic compression"]].map(([kd, i, j, label]) => ({ ...process(kd, s[i], s[j], g), label: `${i + 1}→${j + 1} ${label}` })),
      formula: 1 - p.tc / p.th, formulaText: "1 − Tc/Th", tmax: p.th, tmin: p.tc,
      note: "r = V₂/V₁, the expansion along the hot isotherm.",
    };
  }
  if (name === "otto" || name === "diesel") {
    const Vmax = 1e-3, Vmin = Vmax / p.r;
    const T2 = p.tc * p.r ** (g - 1);
    let s3;
    if (name === "otto") {
      if (p.th <= T2) return { error: `After compression the gas is already at ${num(T2, 0)} K: raise T hot above it.` };
      s3 = st(p.th, Vmin);
    } else {
      s3 = st(T2 * p.rc, Vmin * p.rc);
      if (s3.V >= Vmax) return { error: "The cut-off ratio must be smaller than the compression ratio." };
    }
    const s = [st(p.tc, Vmax), st(T2, Vmin), s3, st(s3.T * (s3.V / Vmax) ** (g - 1), Vmax)];
    const heat = name === "otto" ? ["isochoric", "isochoric heating (combustion)"] : ["isobaric", "isobaric heating (combustion)"];
    const procs = [["adiabatic", 0, 1, "adiabatic compression"], [heat[0], 1, 2, heat[1]], ["adiabatic", 2, 3, "adiabatic expansion"], ["isochoric", 3, 0, "isochoric cooling (exhaust)"]]
      .map(([kd, i, j, label]) => ({ ...process(kd, s[i], s[j], g), label: `${i + 1}→${j + 1} ${label}` }));
    const formula = name === "otto" ? 1 - p.r ** (1 - g) : 1 - (p.r ** (1 - g) * (p.rc ** g - 1)) / (g * (p.rc - 1));
    return {
      title: name === "otto" ? "Otto: the petrol engine" : "Diesel: heat added at constant pressure",
      procs, formula, formulaText: name === "otto" ? "1 − r^(1−γ)" : "1 − r^(1−γ)(rc^γ − 1)/(γ(rc − 1))",
      tmax: s3.T, tmin: p.tc,
      note: name === "otto" ? "r = V_max/V_min, the compression ratio; T cold is the intake, T hot the peak after combustion." : `r = V_max/V_min; the peak temperature is ${num(s3.T, 0)} K.`,
    };
  }
  // Stirling: two isotherms joined by two isochores.
  if (p.th <= p.tc) return { error: "T hot must be above T cold." };
  const Vmax = 1e-3, Vmin = Vmax / p.r;
  const s = [st(p.th, Vmin), st(p.th, Vmax), st(p.tc, Vmax), st(p.tc, Vmin)];
  const procs = [["isothermal", 0, 1, "isothermal expansion"], ["isochoric", 1, 2, "isochoric cooling"], ["isothermal", 2, 3, "isothermal compression"], ["isochoric", 3, 0, "isochoric heating"]]
    .map(([kd, i, j, label]) => ({ ...process(kd, s[i], s[j], g), label: `${i + 1}→${j + 1} ${label}` }));
  if (p.regen) for (const q of procs) if (q.kind === "isochoric") q.internal = true;
  const qin = R * p.th * Math.log(p.r) + (p.regen ? 0 : (R / (g - 1)) * (p.th - p.tc));
  return {
    title: p.regen ? "Stirling with an ideal regenerator" : "Stirling without a regenerator",
    procs, formula: (R * (p.th - p.tc) * Math.log(p.r)) / qin,
    formulaText: p.regen ? "1 − Tc/Th (regenerator recycles the isochoric heat)" : "R(Th−Tc) ln r / (R Th ln r + Cv(Th−Tc))",
    tmax: p.th, tmin: p.tc, note: "r = V_max/V_min.",
  };
}

// Small arrowhead in the middle of a screen-space polyline.
function midArrow(parent, pts, color) {
  const i = Math.floor(pts.length / 2);
  const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.min(pts.length - 1, i + 1)];
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1e-6) return;
  const ux = (x1 - x0) / d, uy = (y1 - y0) / d, s = 6;
  const [cx, cy] = pts[i];
  el("path", { d: `M${cx + ux * s} ${cy + uy * s} L${cx - ux * s - uy * s * 0.7} ${cy - uy * s + ux * s * 0.7} L${cx - ux * s + uy * s * 0.7} ${cy - uy * s - ux * s * 0.7} Z`, style: `fill:${color}` }, parent);
}

const procColor = (q) => (q.internal ? "var(--muted-foreground)" : q.Q > 1e-6 ? "var(--ion-na)" : q.Q < -1e-6 ? "var(--vec-u)" : "var(--foreground)");

for (const root of document.querySelectorAll("[data-cycles]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  let name = "carnot", view = "pv", regen = true;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    if (e.target.getAttribute("aria-label") === "Diagram") view = e.detail.value;
    else { name = e.detail.value; showOnly(root, name); }
    draw();
  });
  root.querySelectorAll("[data-toggle=regen]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { regen = e.detail.checked; draw(); }));

  function draw() {
    const p = { th: s.th.get(), tc: s.tc.get(), r: s.r.get(), rc: s.rc.get(), gamma: s.gamma.get(), regen };
    const c = cycle(name, p);
    svg.replaceChildren();
    table.replaceChildren();
    if (c.error) {
      text(svg, 280, 160, c.error, { "text-anchor": "middle", class: "fill-del font-mono text-[11px]" });
      o.title.textContent = "—";
      for (const k of ["w", "qin", "eta", "formula", "carnot", "sumu"]) o[k].textContent = "—";
      o.rnote.textContent = "";
      return;
    }
    const all = c.procs.flatMap((q) => q.pts);
    let f, X, Y, xlabel, ylabel;
    if (view === "pv") {
      const vs = all.map((q) => q.V * 1000), ps = all.map((q) => q.P / 1000);
      const log = Math.max(...vs) / Math.min(...vs) > 12 || Math.max(...ps) / Math.min(...ps) > 40;
      const tr = log ? Math.log10 : (v) => v;
      X = (q) => tr(q.V * 1000);
      Y = (q) => tr(q.P / 1000);
      const xr = [Math.min(...vs.map(tr)), Math.max(...vs.map(tr))], yr = [Math.min(...ps.map(tr)), Math.max(...ps.map(tr))];
      const pad = (r, k) => [r[0] - (r[1] - r[0]) * k, r[1] + (r[1] - r[0]) * k];
      const decades = (r) => { const t = []; for (let d = Math.ceil(r[0]); d <= Math.floor(r[1]); d++) t.push(d); return t; };
      const ticks = (r) => { const step = niceStep((r[1] - r[0]) / 4); const t = []; for (let v = Math.ceil(r[0] / step) * step; v <= r[1]; v += step) t.push(+v.toFixed(6)); return t; };
      const dec = (v) => { const x = 10 ** v; return x >= 1 ? String(Math.round(x)) : String(+x.toPrecision(1)); };
      xlabel = log ? "V (L), log scale" : "V (L)";
      ylabel = log ? "P (kPa), log" : "P (kPa)";
      const xs = pad(xr, 0.06), ys = pad(yr, 0.08);
      f = frame(svg, { box: [56, 18, 484, 262], x: xs, y: ys, xticks: log ? decades(xs) : ticks(xs), yticks: log ? decades(ys) : ticks(ys), xfmt: log ? dec : String, yfmt: log ? dec : String, xlabel, ylabel });
    } else {
      X = (q) => q.S; Y = (q) => q.T;
      const xs0 = all.map(X), ts = all.map(Y);
      const xr = [Math.min(...xs0), Math.max(...xs0)], yr = [0, Math.max(...ts) * 1.08];
      const dx = (xr[1] - xr[0]) * 0.08 || 1;
      f = frame(svg, { box: [56, 18, 484, 262], x: [xr[0] - dx, xr[1] + dx], y: yr, xticks: [], yticks: [0, ...[1, 2, 3, 4].map((i) => Math.round((yr[1] * i) / 4 / 50) * 50)], xlabel: "S (relative, J/K) →", ylabel: "T (K)" });
    }
    const sc = (q) => [f.sx(X(q)), f.sy(Y(q))];
    // Enclosed area = net work (P–V) or net heat (T–S).
    el("path", { d: "M" + all.map((q) => sc(q).map((v) => v.toFixed(1)).join(",")).join(" L") + " Z", style: "fill:var(--brand);fill-opacity:0.1;stroke:none" }, svg);
    c.procs.forEach((q) => {
      const pts = q.pts.map(sc);
      const color = procColor(q);
      polyline(svg, pts, `stroke:${color};stroke-width:2;stroke-linejoin:round;${q.internal ? "stroke-dasharray:4 3" : ""}`);
      midArrow(svg, pts, color);
    });
    c.procs.forEach((q, i) => {
      const [x, y] = sc(q.pts[0]);
      el("circle", { cx: x, cy: y, r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
      text(svg, x + 6, y - 6, String(i + 1), { class: "fill-foreground font-mono text-[11px]" });
    });

    // First-law table.
    for (const q of c.procs) {
      const tr = document.createElement("tr");
      tr.className = "border-b last:border-b-0";
      const cells = [q.label + (q.internal ? " · regenerator" : ""), fmtJ(q.Q), fmtJ(q.W), fmtJ(q.dU)];
      cells.forEach((v, i) => {
        const td = document.createElement("td");
        td.className = i === 0 ? "py-1.5 pr-2 font-sans" : "py-1.5 pr-2 text-right tabular-nums";
        if (i === 0) {
          const sw = document.createElement("span");
          sw.className = "mr-2 inline-block h-0.5 w-3 rounded-full align-middle";
          sw.style.background = procColor(q);
          td.append(sw);
        }
        td.append(minus(v));
        tr.append(td);
      });
      table.append(tr);
    }
    const Wnet = c.procs.reduce((a, q) => a + q.W, 0);
    const Qin = c.procs.filter((q) => !q.internal && q.Q > 0).reduce((a, q) => a + q.Q, 0);
    const sumU = c.procs.reduce((a, q) => a + q.dU, 0);
    o.title.textContent = c.title;
    o.w.textContent = `${minus(num(Wnet, 1))} J`;
    o.qin.textContent = `${num(Qin, 1)} J`;
    o.eta.textContent = `${num((100 * Wnet) / Qin, 2)}%`;
    o.formula.textContent = `${num(100 * c.formula, 2)}%  (${c.formulaText})`;
    o.carnot.textContent = `${num(100 * (1 - c.tmin / c.tmax), 2)}%  (Tc ${num(c.tmin, 0)} K, Th ${num(c.tmax, 0)} K)`;
    o.sumu.textContent = `${Math.abs(sumU) < 1e-6 ? "0.000" : sumU.toExponential(2)} J`;
    o.rnote.textContent = c.note;
  }
  showOnly(root, name);
  draw();
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

// ============================================================ Four processes

const PROCS = [
  ["isothermal", "var(--vec-u)"],
  ["adiabatic", "var(--brand)"],
  ["isobaric", "var(--ion-cl)"],
  ["isochoric", "var(--vec-out)"],
];

for (const root of document.querySelectorAll("[data-procs]")) {
  const svg = root.querySelector("[data-plot]");
  const s = scrubAll(root, draw);
  const T1 = 300, P1 = 100e3, V1 = (R * T1) / P1;

  function draw() {
    const x = s.ratio.get(), g = s.gamma.get();
    const a = { T: T1, V: V1 };
    const ends = {
      isothermal: { T: T1, V: x * V1 },
      adiabatic: { T: T1 * x ** (1 - g), V: x * V1 },
      isobaric: { T: T1 * x, V: x * V1 },
      isochoric: { T: T1 * x, V: V1 },
    };
    const res = Object.fromEntries(PROCS.map(([k]) => [k, process(k, a, ends[k], g)]));
    svg.replaceChildren();
    const pts = Object.values(res).flatMap((r) => r.pts);
    const vmax = Math.max(...pts.map((q) => q.V * 1000)) * 1.1, pmax = Math.max(...pts.map((q) => q.P / 1000)) * 1.1;
    const f = frame(svg, { box: [56, 18, 484, 262], x: [0, vmax], y: [0, pmax], xticks: ticksTo(vmax), yticks: ticksTo(pmax), xlabel: "V (L)", ylabel: "P (kPa)" });
    // The isotherm through the initial state, for reference.
    const iso = [];
    for (let i = 1; i <= 80; i++) { const V = (vmax / 1000) * (i / 80); const P = (R * T1) / V / 1000; if (P <= pmax) iso.push([f.sx(V * 1000), f.sy(P)]); }
    polyline(svg, iso, "stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:3 4");
    for (const [k, color] of PROCS) {
      const p2 = res[k].pts.map((q) => [f.sx(q.V * 1000), f.sy(q.P / 1000)]);
      polyline(svg, p2, `stroke:${color};stroke-width:2`);
      midArrow(svg, p2, color);
      const [ex, ey] = p2.at(-1);
      el("circle", { cx: ex, cy: ey, r: 3.5, style: `fill:${color}` }, svg);
    }
    el("circle", { cx: f.sx(V1 * 1000), cy: f.sy(P1 / 1000), r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    text(svg, f.sx(V1 * 1000) + 7, f.sy(P1 / 1000) - 7, "start: 300 K, 100 kPa", { class: "fill-foreground font-mono text-[10px]" });

    for (const [k] of PROCS) {
      const row = root.querySelector(`[data-row=${k}]`);
      const r = res[k], b = r.b;
      const set = (c, v) => (row.querySelector(`[data-c=${c}]`).textContent = v);
      set("state", `${num(b.T, 0)} K · ${num((R * b.T) / b.V / 1000, 1)} kPa`);
      set("w", minus(fmtJ(r.W)));
      set("q", minus(fmtJ(r.Q)));
      set("du", minus(fmtJ(r.dU)));
    }
  }
  draw();
}

function ticksTo(max) {
  const step = niceStep(max / 4);
  const t = [];
  for (let v = 0; v <= max; v += step) t.push(+v.toFixed(6));
  return t;
}

// ============================================================ Second law

for (const root of document.querySelectorAll("[data-entropy]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const T1 = s.t1.get(), T2 = s.t2.get(), C1 = s.c1.get(), C2 = s.c2.get();
    const Tf = (C1 * T1 + C2 * T2) / (C1 + C2);
    const Tfr = Math.exp((C1 * Math.log(T1) + C2 * Math.log(T2)) / (C1 + C2));
    const ds = (t) => {
      const e = Math.exp(-t);
      const a = Tf + (T1 - Tf) * e, b = Tf + (T2 - Tf) * e;
      return { a, b, s: C1 * Math.log(a / T1) + C2 * Math.log(b / T2) };
    };
    svg.replaceChildren();
    const lo = Math.min(T1, T2), hi = Math.max(T1, T2);
    const span = Math.max(20, hi - lo);
    const f = frame(svg, { box: [56, 14, 484, 150], x: [0, 5], y: [lo - span * 0.1, hi + span * 0.1], xticks: [], yticks: [Math.round(lo), Math.round(Tf), Math.round(hi)], ylabel: "T (K)" });
    const samples = Array.from({ length: 121 }, (_, i) => ({ t: (i / 120) * 5, ...ds((i / 120) * 5) }));
    hline(svg, f, Tfr, "stroke:var(--foreground);stroke-opacity:0.6;stroke-dasharray:5 4", `reversible ${num(Tfr, 1)} K`);
    polyline(svg, samples.map((q) => [f.sx(q.t), f.sy(q.a)]), "stroke:var(--ion-na);stroke-width:2");
    polyline(svg, samples.map((q) => [f.sx(q.t), f.sy(q.b)]), "stroke:var(--vec-u);stroke-width:2");
    const smax = Math.max(1e-9, samples.at(-1).s);
    const g = frame(svg, { box: [56, 196, 484, 76], x: [0, 5], y: [0, smax * 1.15], xticks: [0, 1, 2, 3, 4, 5], yticks: [0], xlabel: "time / τ  (τ = relaxation time)", ylabel: "ΔS (J/K)" });
    polyline(svg, samples.map((q) => [g.sx(q.t), g.sy(q.s)]), "stroke:var(--brand);stroke-width:2");
    text(svg, g.L + g.W - 4, g.sy(smax) - 6, `${num(smax, 3)} J/K`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    const Wmax = C1 * (T1 - Tfr) - C2 * (Tfr - T2);
    o.tf.textContent = `${num(Tf, 2)} K`;
    o.ds.textContent = `${num(ds(60).s, 3)} J/K  ≥ 0`;
    o.tfr.textContent = `${num(Tfr, 2)} K  (ΔS = 0)`;
    o.wlost.textContent = `${num(Wmax / 1000, 3)} kJ`;
  }
  draw();
}

// ============================================================ Microstates

const LOGF = [0];
for (let i = 1; i <= 10000; i++) LOGF[i] = LOGF[i - 1] + Math.log(i); // ln n!
const lnC = (n, k) => LOGF[n] - LOGF[k] - LOGF[n - k];

for (const root of document.querySelectorAll("[data-micro]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let lastN = null;
  const s = scrubAll(root, (name) => {
    if (name === "n") {
      const N = Math.round(s.n.get());
      // Keep the macrostate at the same fraction of N.
      s.k.set(Math.round(lastN ? (s.k.get() / lastN) * N : N / 2), false);
    }
    draw();
  });

  function draw() {
    const N = Math.round(s.n.get());
    let k = Math.round(s.k.get());
    if (k > N) { k = N; s.k.set(k, false); }
    lastN = N;
    const lnTot = N * Math.LN2;
    const P = Array.from({ length: N + 1 }, (_, i) => Math.exp(lnC(N, i) - lnTot));
    svg.replaceChildren();
    const pmax = Math.max(...P);
    const f = frame(svg, { box: [56, 16, 484, 240], x: [0, 1], y: [0, pmax * 1.12], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0], xlabel: "fraction pointing up, n/N", ylabel: "probability" });
    // ±1% band around N/2.
    el("rect", { x: f.sx(0.49), y: f.T, width: f.sx(0.51) - f.sx(0.49), height: f.H, style: "fill:var(--brand);fill-opacity:0.08" }, svg);
    if (N <= 120) {
      const w = Math.max(1, f.W / (N + 1) - 1);
      P.forEach((p, i) => el("rect", { x: f.sx(i / N) - w / 2, y: f.sy(p), width: w, height: f.T + f.H - f.sy(p), style: `fill:${i === k ? "var(--brand)" : "var(--foreground)"};fill-opacity:${i === k ? 1 : 0.35}` }, svg));
    } else {
      const pts = P.map((p, i) => [f.sx(i / N), f.sy(p)]);
      el("path", { d: `M${f.sx(0)} ${f.sy(0)} L` + pts.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" L") + ` L${f.sx(1)} ${f.sy(0)} Z`, style: "fill:var(--foreground);fill-opacity:0.2;stroke:var(--foreground);stroke-width:1.25" }, svg);
      el("line", { x1: f.sx(k / N), x2: f.sx(k / N), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    }
    const lnO = lnC(N, k);
    const log10O = lnO / Math.LN10;
    o.omega.textContent = log10O < 15 ? Math.round(Math.exp(lnO)).toLocaleString("en-US") : `≈ ${num(10 ** (log10O % 1), 2)} × 10^${Math.floor(log10O)}`;
    o.s.textContent = num(lnO, 3);
    const pk = Math.exp(lnO - lnTot);
    o.p.textContent = pk > 1e-4 ? num(pk, 4) : pk.toExponential(2);
    let near = 0;
    for (let i = 0; i <= N; i++) if (Math.abs(i / N - 0.5) <= 0.01 + 1e-12) near += P[i];
    o.near.textContent = `${num(100 * near, 2)}%`;
    o.width.textContent = num(1 / (2 * Math.sqrt(N)), 4);
  }
  draw();
}

// ============================================================ Heat conduction

const MATERIALS = { copper: 1.11e-4, steel: 1.2e-5, glass: 3.4e-7 }; // m²/s, ≈ room temperature
const fmtTime = (t) => (t < 120 ? `${num(t, 1)} s` : t < 7200 ? `${num(t / 60, 1)} min` : `${num(t / 3600, 1)} h`);

for (const root of document.querySelectorAll("[data-heatrod]")) {
  const bar = root.querySelector("[data-bar]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  const L = 0.1, N = 61, dx = L / (N - 1), T0 = 20;
  let alpha = MATERIALS.copper, T, t, playing = false, raf = 0, visible = false;
  const s = scrubAll(root, () => { applyEnds(); draw(); });

  const reset = () => { T = new Float64Array(N).fill(T0); t = 0; applyEnds(); draw(); };
  const applyEnds = () => { T[0] = s.left.get(); T[N - 1] = s.right.get(); };
  const dt = () => (0.4 * dx * dx) / alpha; // stable: r = α dt / dx² = 0.4 ≤ 0.5

  function step(n) {
    const r = (alpha * dt()) / (dx * dx);
    const next = new Float64Array(N);
    for (let k = 0; k < n; k++) {
      next[0] = T[0]; next[N - 1] = T[N - 1];
      for (let i = 1; i < N - 1; i++) next[i] = T[i] + r * (T[i + 1] - 2 * T[i] + T[i - 1]);
      T.set(next);
      t += dt();
    }
  }

  function draw() {
    const a = s.left.get(), b = s.right.get();
    const lo = Math.min(a, b, T0), hi = Math.max(a, b, T0);
    const span = Math.max(10, hi - lo);
    const share = (v) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
    bar.replaceChildren();
    const w = 484 / N;
    for (let i = 0; i < N; i++) el("rect", { x: 56 + i * w, y: 6, width: w + 0.5, height: 22, style: `fill:color-mix(in oklab, var(--vec-u), var(--ion-na) ${share(T[i]).toFixed(1)}%)` }, bar);
    el("rect", { x: 56, y: 6, width: 484, height: 22, rx: 3, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, bar);
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 20, 484, 202], x: [0, 10], y: [lo - span * 0.08, hi + span * 0.08], xticks: [0, 2, 4, 6, 8, 10], yticks: [Math.round(lo), Math.round((lo + hi) / 2), Math.round(hi)], xlabel: "x (cm)", ylabel: "T (°C)" });
    polyline(svg, [[f.sx(0), f.sy(a)], [f.sx(10), f.sy(b)]], "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:5 4");
    text(svg, f.sx(10) - 4, f.sy(b) + (a > b ? -8 : 14), "steady state", { "text-anchor": "end" });
    polyline(svg, Array.from(T, (v, i) => [f.sx((i * 10) / (N - 1)), f.sy(v)]), "stroke:var(--brand);stroke-width:2");
    o.t.textContent = fmtTime(t);
    o.mid.textContent = `${num(T[(N - 1) / 2], 1)} °C`;
    o.tau.textContent = fmtTime((L * L) / alpha);
  }

  // About L²/α of simulated time per 6 s of real time, whatever the material.
  const stepsPerFrame = Math.round((N * N) / (360 * 0.4));
  const loop = () => {
    step(stepsPerFrame);
    draw();
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const setPlaying = (p) => {
    playing = p;
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Run";
    if (p && reduced()) { step(stepsPerFrame * 360); draw(); return setPlaying(false); }
    if (p && visible && !raf) raf = requestAnimationFrame(loop);
  };
  btn.querySelector("[data-label]").textContent = "Run";
  btn.addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=reset]").addEventListener("click", () => { setPlaying(false); reset(); });
  root.addEventListener("seg-change", (e) => {
    alpha = MATERIALS[e.detail.value];
    o.alpha.textContent = `10 cm rod · α ≈ ${alpha.toExponential(2).replace("e-", " × 10⁻").replace(/(\d+)$/, (d) => d.split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c]).join(""))} m²/s`;
    setPlaying(false);
    reset();
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(loop); }).observe(root);
  o.alpha.textContent = "10 cm rod · α ≈ 1.11 × 10⁻⁴ m²/s";
  reset();
}

// ============================================================ Phase diagram of water

const TT = 273.16, PT = 611.657, TC = 647.096, PC = 22.064e6;
// IAPWS (2011) sublimation pressure of ice Ih.
const pSub = (T) => {
  const th = T / TT;
  return PT * Math.exp((-21.2144006 * th ** 0.00333333333 + 27.3203819 * th ** 1.20666667 - 6.1059813 * th ** 1.70333333) / th);
};
// IAPWS (2011) melting pressure of ice Ih (valid 251.165 K to 273.16 K).
const pMelt = (T) => {
  const th = T / TT;
  return PT * (1 + 1.19539337e6 * (1 - th ** 3) + 8.08183159e4 * (1 - th ** 25.75) + 3.3382686e3 * (1 - th ** 103.75));
};
// Wagner–Pruss (IAPWS) saturation pressure of liquid water.
const pVap = (T) => {
  const t = 1 - T / TC;
  return PC * Math.exp((TC / T) * (-7.85951783 * t + 1.84408259 * t ** 1.5 - 11.7866497 * t ** 3 + 22.6807411 * t ** 3.5 - 15.9618719 * t ** 4 + 1.80122502 * t ** 7.5));
};
// Melting temperature at pressure P ≥ PT, by bisection on the melting curve.
const tMelt = (P) => {
  let a = 251.165, b = TT;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; pMelt(m) > P ? (a = m) : (b = m); }
  return (a + b) / 2;
};
function phaseOf(T, P) {
  if (P < PT) return T < TT && P > pSub(T) ? "ice (solid)" : "water vapour";
  if (T < tMelt(P)) return "ice (solid)";
  if (T >= TC && P >= PC) return "supercritical fluid";
  if (T < TC && P > pVap(T)) return "liquid water";
  return T >= TC ? "gas (above the critical temperature)" : "water vapour";
}

for (const root of document.querySelectorAll("[data-thermo-phase]")) {
  const pt = root.querySelector("[data-pt]");
  const heat = root.querySelector("[data-heat]");
  const o = outs(root);
  const box = [60, 14, 344, 268];
  const xr = [200, 700], yr = [-1, 8]; // log10 Pa
  let marker = null;

  const pLabel = (d) => ({ "-1": "0.1 Pa", 0: "1 Pa", 1: "10 Pa", 2: "100 Pa", 3: "1 kPa", 4: "10 kPa", 5: "100 kPa", 6: "1 MPa", 7: "10 MPa", 8: "100 MPa" })[d];
  function drawPT() {
    pt.replaceChildren();
    const f = frame(pt, { box, x: xr, y: yr, xticks: [200, 300, 400, 500, 600, 700], yticks: [-1, 1, 3, 5, 7], yfmt: pLabel, xlabel: "T (K)", ylabel: "P" });
    const curve = (fn, a, b, n = 120) => Array.from({ length: n + 1 }, (_, i) => { const T = a + ((b - a) * i) / n; return [f.sx(T), f.sy(Math.log10(fn(T)))]; });
    const clipY = (pts) => pts.filter(([, y]) => y >= f.T - 1 && y <= f.T + f.H + 1);
    const sub = clipY(curve(pSub, 200, TT));
    const vap = curve(pVap, TT, TC);
    // Melting curve: sample in pressure, solve for T.
    const melt = [];
    for (let d = Math.log10(PT); d <= 8; d += 0.05) melt.push([f.sx(tMelt(10 ** d)), f.sy(d)]);
    const style = "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round";
    polyline(pt, sub, style);
    polyline(pt, vap, style);
    polyline(pt, melt, style);
    hline(pt, f, Math.log10(101325), "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4", "1 atm");
    for (const [T, P, lbl] of [[TT, PT, "triple point"], [TC, PC, "critical point"]]) {
      el("circle", { cx: f.sx(T), cy: f.sy(Math.log10(P)), r: 4, style: "fill:var(--brand)" }, pt);
      const crit = lbl === "critical point";
      text(pt, f.sx(T) + (crit ? -7 : 7), f.sy(Math.log10(P)) + (crit ? 14 : 14), lbl, { "text-anchor": crit ? "end" : "start", class: "fill-foreground font-mono text-[10px]" });
    }
    text(pt, f.sx(222), f.sy(3.6), "solid", { class: "fill-muted-foreground text-[12px]" });
    text(pt, f.sx(390), f.sy(6.7), "liquid", { class: "fill-muted-foreground text-[12px]" });
    text(pt, f.sx(500), f.sy(2), "vapour", { class: "fill-muted-foreground text-[12px]" });
    text(pt, f.sx(660), f.sy(7.8), "supercritical", { "text-anchor": "end", class: "fill-muted-foreground text-[12px]" });
    if (marker) {
      el("circle", { cx: f.sx(marker[0]), cy: f.sy(marker[1]), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, pt);
    }
    return f;
  }
  let f = drawPT();
  pt.addEventListener("click", (e) => {
    const p = pt.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(pt.getScreenCTM().inverse());
    const T = xr[0] + ((q.x - f.L) / f.W) * (xr[1] - xr[0]);
    const lp = yr[0] + ((f.T + f.H - q.y) / f.H) * (yr[1] - yr[0]);
    if (T < xr[0] || T > xr[1] || lp < yr[0] || lp > yr[1]) return;
    marker = [T, lp];
    f = drawPT();
    const P = 10 ** lp;
    o.phase.textContent = phaseOf(T, P);
    o.where.textContent = `T = ${num(T, 1)} K (${num(T - 273.15, 1)} °C), P = ${P >= 1e6 ? num(P / 1e6, 2) + " MPa" : P >= 1e3 ? num(P / 1e3, 2) + " kPa" : num(P, 2) + " Pa"}`;
  });

  // Heating curve of 1 kg at 1 atm, from −40 °C ice to 140 °C steam.
  const segs = [
    { from: -40, to: 0, c: 2.09, label: "ice", color: "var(--vec-u)" },
    { latent: 334, at: 0, label: "melting · 334 kJ", color: "var(--foreground)" },
    { from: 0, to: 100, c: 4.18, label: "liquid", color: "var(--ion-cl)" },
    { latent: 2257, at: 100, label: "boiling · 2257 kJ", color: "var(--foreground)" },
    { from: 100, to: 140, c: 2.01, label: "steam", color: "var(--ion-na)" },
  ];
  let q = 0;
  const pts = segs.map((sg) => {
    const a = [q, sg.latent ? sg.at : sg.from];
    q += sg.latent ? sg.latent : sg.c * (sg.to - sg.from);
    return { ...sg, a, b: [q, sg.latent ? sg.at : sg.to] };
  });
  const g = frame(heat, { box: [52, 14, 352, 268], x: [0, Math.ceil(q / 500) * 500], y: [-50, 150], xticks: [0, 1000, 2000, 3000], yticks: [-40, 0, 50, 100, 140], xlabel: "heat added (kJ per kg)", ylabel: "T (°C)" });
  for (const sg of pts) {
    polyline(heat, [[g.sx(sg.a[0]), g.sy(sg.a[1])], [g.sx(sg.b[0]), g.sy(sg.b[1])]], `stroke:${sg.color};stroke-width:2.25;stroke-linecap:round`);
    if (sg.latent) text(heat, sg.at === 0 ? g.sx(sg.a[0]) + 4 : (g.sx(sg.a[0]) + g.sx(sg.b[0])) / 2, g.sy(sg.at) + (sg.at === 0 ? 14 : -8), sg.label, { "text-anchor": sg.at === 0 ? "start" : "middle", class: "fill-foreground font-mono text-[10px]" });
  }
  text(heat, g.L + g.W, g.T + 10, "1 kg of water at 1 atm (c and L ≈ typical values)", { "text-anchor": "end" });
}

// ============================================================ Energy flow

for (const root of document.querySelectorAll("[data-flow]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "engine";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function band(x1, y1, x2, y2, w, color, arrow) {
    const d = `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`;
    el("path", { d, style: `fill:none;stroke:${color};stroke-opacity:0.55;stroke-width:${Math.max(1.5, w)}` }, svg);
    if (arrow) {
      const [ax, ay, dir] = arrow; // dir: 1 down, −1 up, 2 right
      const h = 8, half = w / 2 + 3;
      const pts = dir === 2 ? `${ax},${ay - half} ${ax + h},${ay} ${ax},${ay + half}` : `${ax - half},${ay} ${ax},${ay + h * dir} ${ax + half},${ay}`;
      el("polygon", { points: pts, style: `fill:${color};fill-opacity:0.8` }, svg);
    }
  }

  function draw() {
    const Th = s.th.get(), Tc = s.tc.get(), share = s.frac.get();
    svg.replaceChildren();
    if (Th <= Tc) {
      text(svg, 280, 160, "T hot must be above T cold.", { "text-anchor": "middle", class: "fill-del font-mono text-[11px]" });
      return;
    }
    let Qh, Qc, W, perf, limit, basis;
    if (mode === "engine") {
      const eta = share * (1 - Tc / Th);
      Qh = 1000; W = eta * Qh; Qc = Qh - W;
      perf = `η = ${num(100 * eta, 1)}%`; limit = `η_Carnot = 1 − Tc/Th = ${num(100 * (1 - Tc / Th), 1)}%`; basis = "heat drawn from the hot side";
    } else if (mode === "fridge") {
      const cop = share * (Tc / (Th - Tc));
      Qc = 1000; W = Qc / cop; Qh = Qc + W;
      perf = `COP = Qc/W = ${num(cop, 2)}`; limit = `Tc/(Th − Tc) = ${num(Tc / (Th - Tc), 2)}`; basis = "heat removed from the cold side";
    } else {
      const cop = share * (Th / (Th - Tc));
      Qh = 1000; W = Qh / cop; Qc = Qh - W;
      perf = `COP = Qh/W = ${num(cop, 2)}`; limit = `Th/(Th − Tc) = ${num(Th / (Th - Tc), 2)}`; basis = "heat delivered to the hot side";
    }
    const k = 72 / Math.max(Qh, Qc, W);
    const cx = 250, cy = 160;
    // Reservoirs.
    el("rect", { x: 120, y: 14, width: 260, height: 40, rx: 8, style: "fill:var(--ion-na);fill-opacity:0.12;stroke:var(--ion-na);stroke-opacity:0.5" }, svg);
    text(svg, 250, 39, `hot reservoir · ${num(Th, 0)} K`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    el("rect", { x: 120, y: 266, width: 260, height: 40, rx: 8, style: "fill:var(--vec-u);fill-opacity:0.12;stroke:var(--vec-u);stroke-opacity:0.5" }, svg);
    text(svg, 250, 291, `cold reservoir · ${num(Tc, 0)} K`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    const up = mode !== "engine";
    band(cx, 54, cx, cy - 22, Qh * k, "var(--ion-na)", up ? [cx, 60, -1] : [cx, cy - 26, 1]);
    band(cx, cy + 22, cx, 266, Qc * k, "var(--vec-u)", up ? [cx, cy + 28, -1] : [cx, 260, 1]);
    // Work: out to the right for an engine, in from the right otherwise.
    el("path", { d: `M${cx + 22} ${cy} L${470} ${cy}`, style: `fill:none;stroke:var(--brand);stroke-opacity:0.55;stroke-width:${Math.max(1.5, W * k)}` }, svg);
    const hw = (W * k) / 2 + 3;
    el("polygon", { points: up ? `${cx + 33},${cy - hw} ${cx + 25},${cy} ${cx + 33},${cy + hw}` : `${470},${cy - hw} ${478},${cy} ${470},${cy + hw}`, style: "fill:var(--brand);fill-opacity:0.8" }, svg);
    el("circle", { cx, cy, r: 24, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    text(svg, cx, cy + 4, mode === "engine" ? "engine" : mode === "fridge" ? "fridge" : "pump", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    text(svg, cx + 14 + Qh * k / 2, 100, `Qh ${num(Qh, 0)} J`, { class: "fill-foreground font-mono text-[11px]" });
    text(svg, cx + 14 + Qc * k / 2, 226, `Qc ${num(Qc, 0)} J`, { class: "fill-foreground font-mono text-[11px]" });
    text(svg, 480, cy - (W * k) / 2 - 10, `W ${num(W, 0)} J`, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    text(svg, 556, 312, "energy balance: Qh = W + Qc", { "text-anchor": "end" });
    o.perf.textContent = perf;
    o.limit.textContent = limit;
    o.basis.textContent = basis;
  }
  draw();
}

// ============================================================ Calorimetry

const MAT = {
  water: { c: 4186, water: true, phase: "liquid" },
  ice: { c: 2090, water: true, phase: "solid" },
  copper: { c: 385 },
  aluminium: { c: 897 },
  iron: { c: 449 },
};
const CL = 4186, CS = 2090, LF = 334000; // J/(kg·K), J/kg

for (const root of document.querySelectorAll("[data-calor]")) {
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-material]").forEach((sel) => sel.addEventListener("change", draw));

  function draw() {
    const parts = ["a", "b"].map((k) => {
      const mat = root.querySelector(`[data-material=${k}]`).value;
      let T = s[`${k}t`].get();
      // Ice cannot be above 0 °C, and liquid water not below it.
      if (mat === "ice") T = Math.min(T, 0);
      if (mat === "water") T = Math.max(T, 0);
      return { mat, m: s[`${k}m`].get() / 1000, T, ...MAT[mat] };
    });
    // Enthalpy relative to ice at 0 °C (water) and to 0 °C (metals).
    const H = (p) => (p.water ? (p.phase === "solid" ? p.m * CS * p.T : p.m * (LF + CL * p.T)) : p.m * p.c * p.T);
    const Htot = parts.reduce((a, p) => a + H(p), 0);
    const Mw = parts.filter((p) => p.water).reduce((a, p) => a + p.m, 0);
    const Cm = parts.filter((p) => !p.water).reduce((a, p) => a + p.m * p.c, 0);
    const ice0 = parts.filter((p) => p.mat === "ice").reduce((a, p) => a + p.m, 0);
    let Tf, liquid; // liquid: final mass fraction of the water that is liquid
    if (Htot < 0) { Tf = Htot / (Mw * CS + Cm); liquid = 0; }
    else if (Mw > 0 && Htot <= Mw * LF) { Tf = 0; liquid = Htot / (Mw * LF); }
    else { Tf = (Htot - Mw * LF) / (Mw * CL + Cm); liquid = 1; }
    o.tf.textContent = `${minus(num(Tf, 2))} °C`;
    const iceLeft = Mw * (1 - liquid);
    o.state.textContent = Mw === 0 ? "no water in the cup" : liquid === 1 ? "all liquid" : liquid === 0 ? "all frozen" : `ice and water together: ${num(iceLeft * 1000, 1)} g of ice left`;
    o["melt-bar"].style.width = Mw ? `${(100 * liquid).toFixed(1)}%` : "0%";
    const melted = (ice0 - iceLeft) * 1000;
    o.detail.textContent = (Mw ? `liquid share of the water: ${num(100 * liquid, 1)}% · ice ${melted >= 0 ? "melted" : "formed"}: ${num(Math.abs(melted), 1)} g · ` : "") +
      `total enthalpy (vs ice at 0 °C): ${minus(num(Htot / 1000, 2))} kJ`;
  }
  draw();
}
