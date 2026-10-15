// Spectroscopy blocks 6–10: IR functional groups, UV-Vis calibration with
// stray light, chromatographic resolution, detection limits and standard
// addition, and powder X-ray diffraction.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { outs, onSeg, setSeg, range, rng, gauss } from "./spectro-util.js";

const hitArea = (svg, attrs, label, onPick) => {
  const r = el("rect", { ...attrs, tabindex: 0, role: "button", "aria-label": label, style: "fill:transparent;cursor:pointer;outline:none" }, svg);
  r.addEventListener("click", onPick);
  r.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } });
  return r;
};

function fit(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const m = sxy / sxx, b = my - m * mx;
  const res = ys.reduce((a, y, i) => a + (y - (m * xs[i] + b)) ** 2, 0);
  return { m, b, r2: syy ? 1 - res / syy : 1, sy: n > 2 ? Math.sqrt(res / (n - 2)) : NaN };
}

// ============================================================ IR bands

const IR_GROUPS = {
  oh_alc: ["O–H, alcohol (H-bonded)", "3200–3550", "broad, strong"],
  oh_acid: ["O–H, carboxylic acid", "2500–3300", "very broad"],
  nh: ["N–H, amine (NH₂: two bands)", "3300–3500", "medium"],
  ch_sp: ["≡C–H, terminal alkyne", "≈3300", "sharp, strong"],
  ch_sp2: ["=C–H and Ar–H", "3000–3100", "weak to medium"],
  ch_sp3: ["C–H, sp³", "2850–2960", "medium to strong"],
  ch_ald: ["C–H, aldehyde (two bands)", "2700–2850", "weak"],
  cn: ["C≡N, nitrile", "2210–2260", "sharp, medium"],
  cc3: ["C≡C, alkyne", "2100–2260", "weak"],
  co: ["C=O, carbonyl", "1670–1780", "strong, sharp"],
  nhb: ["N–H bend", "1580–1650", "medium"],
  arom: ["C=C, aromatic ring", "1450–1600", "medium, paired"],
  c_o: ["C–O stretch", "1000–1300", "strong"],
};

// [centre cm⁻¹, half width, depth (absorbance), group or null for fingerprint]
const IR = {
  ethanol: [[3340, 150, 0.8, "oh_alc"], [2972, 22, 0.55, "ch_sp3"], [2885, 18, 0.35, "ch_sp3"], [1380, 14, 0.25, null], [1050, 22, 0.75, "c_o"], [880, 12, 0.35, null]],
  acetone: [[3005, 14, 0.2, "ch_sp3"], [2925, 14, 0.15, "ch_sp3"], [1715, 16, 0.95, "co"], [1362, 14, 0.5, null], [1222, 16, 0.6, null], [530, 12, 0.3, null]],
  propanoic: [[3000, 380, 0.6, "oh_acid"], [2950, 18, 0.25, "ch_sp3"], [1712, 18, 0.95, "co"], [1420, 14, 0.35, null], [1240, 22, 0.6, "c_o"], [935, 30, 0.35, null]],
  ethylacetate: [[2985, 18, 0.35, "ch_sp3"], [1742, 15, 0.95, "co"], [1373, 12, 0.45, null], [1240, 20, 0.9, "c_o"], [1047, 16, 0.6, "c_o"]],
  propylamine: [[3370, 22, 0.32, "nh"], [3290, 24, 0.28, "nh"], [2960, 18, 0.6, "ch_sp3"], [2874, 16, 0.45, "ch_sp3"], [1605, 22, 0.35, "nhb"], [1070, 18, 0.3, null], [800, 40, 0.45, null]],
  acetonitrile: [[2945, 14, 0.18, "ch_sp3"], [2254, 9, 0.55, "cn"], [1375, 12, 0.35, null], [1040, 12, 0.3, null], [918, 10, 0.25, null]],
  benzaldehyde: [[3065, 16, 0.2, "ch_sp2"], [2820, 12, 0.3, "ch_ald"], [2738, 12, 0.3, "ch_ald"], [1703, 16, 0.95, "co"], [1597, 10, 0.5, "arom"], [1455, 10, 0.4, "arom"], [1205, 14, 0.45, null], [745, 12, 0.6, null], [688, 10, 0.55, null]],
  hexyne: [[3310, 9, 0.8, "ch_sp"], [2960, 18, 0.65, "ch_sp3"], [2872, 16, 0.45, "ch_sp3"], [2120, 9, 0.22, "cc3"], [1465, 14, 0.35, null], [630, 16, 0.7, null]],
};

for (const root of document.querySelectorAll("[data-spec-ir]")) {
  const svg = root.querySelector("[data-plot]");
  const pick = root.querySelector("[data-pick]");
  const chart = root.querySelector("[data-chart]");
  const fb = root.querySelector("[data-feedback]");
  const o = outs(root);
  let sel = null, found = new Set();
  for (const [key, [name, where, shape]] of Object.entries(IR_GROUPS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.irgroup = key;
    b.className = "flex items-baseline justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs transition-colors duration-150 hover:bg-accent outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
    b.innerHTML = `<span></span><span class="shrink-0 font-mono tabular-nums text-muted-foreground"></span>`;
    b.firstChild.textContent = name;
    b.lastChild.textContent = where;
    b.title = shape;
    b.addEventListener("click", () => answer(key));
    chart.append(b);
  }
  pick.addEventListener("change", () => { sel = null; found = new Set(); fb.textContent = ""; draw(); });
  root.querySelector('[data-act="reveal"]').addEventListener("click", () => {
    IR[pick.value].forEach((b, i) => b[3] && found.add(i));
    fb.textContent = "Every diagnostic band is labelled. Unlabelled bands are in the fingerprint region.";
    draw();
  });
  root.querySelector('[data-act="reset"]').addEventListener("click", () => { sel = null; found = new Set(); fb.textContent = ""; draw(); });

  function answer(key) {
    if (sel === null) { fb.textContent = "Click a band in the spectrum first."; return; }
    const band = IR[pick.value][sel];
    if (!band[3]) { fb.textContent = `${band[0]} cm⁻¹ is in the fingerprint region: real, but not diagnostic on its own.`; return; }
    if (band[3] === key) {
      found.add(sel);
      fb.textContent = `Yes: ${band[0]} cm⁻¹ is ${IR_GROUPS[key][0]} (${IR_GROUPS[key][2]}).`;
    } else {
      const [name, where] = IR_GROUPS[key];
      fb.textContent = `${name} sits at ${where} cm⁻¹; this band is at ${band[0]} with a ${band[1] > 100 ? "very broad" : band[1] > 30 ? "broad" : "narrow"} shape. Try again.`;
    }
    draw();
  }

  function draw() {
    const bands = IR[pick.value];
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 22, 576, 210], x: [4000, 400], y: [0, 105], xticks: range(500, 4000, 500), yticks: [0, 50, 100], yfmt: (v) => `${v}`, xlabel: "wavenumber / cm⁻¹", ylabel: "%T" });
    const xs = range(400, 4000, 4);
    const A = (x) => bands.reduce((a, [c, w, d]) => a + d * Math.exp(-0.5 * ((x - c) / w) ** 2), 0);
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(100 * 10 ** -A(x) * 0.97 + 1)]), "stroke:var(--foreground);stroke-width:1.4");
    text(svg, f.sx(1500), f.T + 10, "fingerprint →", { "text-anchor": "start" });
    el("line", { x1: f.sx(1500), x2: f.sx(1500), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:3 3" }, svg);
    bands.forEach((b, i) => {
      const [c, w, d, g] = b;
      const y = f.sy(100 * 10 ** -A(c) * 0.97 + 1);
      const isSel = sel === i, ok = found.has(i);
      if (isSel || ok) el("circle", { cx: f.sx(c), cy: y, r: 4, style: `fill:var(--background);stroke:${isSel ? "var(--brand)" : "var(--vec-u)"};stroke-width:2` }, svg);
      if (ok) text(svg, f.sx(c), y + 16, IR_GROUPS[g][0].split(",")[0], { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
      const half = Math.max(8, Math.abs(f.sx(c + Math.min(w, 120)) - f.sx(c)));
      hitArea(svg, { x: f.sx(c) - half, y: f.T, width: half * 2, height: f.H }, `Band at ${c} per cm${ok ? `, ${IR_GROUPS[g][0]}` : ""}`, () => {
        sel = i;
        fb.textContent = `Band at ${c} cm⁻¹. Which group in the chart explains it?`;
        draw();
        svg.querySelectorAll("rect[role=button]")[i]?.focus();
      }).setAttribute("aria-pressed", String(isSel));
    });
    for (const b of chart.querySelectorAll("[data-irgroup]")) {
      const hit = [...found].some((i) => bands[i][3] === b.dataset.irgroup);
      b.style.borderColor = hit ? "var(--brand)" : "";
    }
    const diag = bands.filter((b) => b[3]).length;
    const b = sel === null ? null : bands[sel];
    o.band.textContent = b ? `${b[0]} cm⁻¹` : "click a band";
    o.shape.textContent = b ? `${b[1] > 100 ? "very broad" : b[1] > 30 ? "broad" : "sharp"}, ${b[2] > 0.7 ? "strong" : b[2] > 0.35 ? "medium" : "weak"}` : "—";
    o.score.textContent = `${found.size} of ${diag}`;
  }
  draw();
}

// ============================================================ Beer–Lambert

for (const root of document.querySelectorAll("[data-spec-beer]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let mode = "all";
  onSeg(root, (_, v) => { mode = v; draw(); });

  function draw() {
    const eps = s.eps.get(), l = s.path.get(), cmax = s.cmax.get(), cx = s.cx.get(), stray = s.stray.get() / 100, noise = s.noise.get() / 1000;
    const r = rng(11);
    const measure = (c) => { const T = 10 ** (-eps * l * c * 1e-6); return -Math.log10((T + stray) / (1 + stray)); };
    const stdC = [0, 0.2, 0.4, 0.6, 0.8, 1].map((k) => k * cmax);
    const stdA = stdC.map((c) => measure(c) + noise * gauss(r));
    const ax = measure(cx) + noise * gauss(r);
    const use = stdC.map((c, i) => mode === "all" || stdA[i] < 1);
    const fx = stdC.filter((_, i) => use[i]), fy = stdA.filter((_, i) => use[i]);
    svg.replaceChildren();
    const xmax = Math.max(cmax, cx) * 1.08;
    const amax = Math.max(1.2, Math.max(...stdA, ax) * 1.25);
    const ystep = amax > 2.5 ? 0.5 : 0.25;
    const f = frame(svg, { box: [52, 20, 560, 250], x: [0, xmax], y: [0, amax], xticks: range(0, xmax, xmax > 500 ? 200 : xmax > 200 ? 50 : 25), yticks: range(0, amax, ystep), yfmt: (v) => num(v, 2), xlabel: "concentration / µM", ylabel: "absorbance" });
    const xs = range(0, xmax, xmax / 200);
    const clip = (pts) => pts.filter(([, y]) => y >= f.T - 1);
    polyline(svg, clip(xs.map((c) => [f.sx(c), f.sy(eps * l * c * 1e-6)])), "stroke:var(--muted-foreground);stroke-width:1.2;stroke-dasharray:5 4");
    polyline(svg, xs.map((c) => [f.sx(c), f.sy(measure(c))]), "stroke:var(--foreground);stroke-width:1;stroke-opacity:0.35");
    el("rect", { x: f.L, y: f.sy(Math.min(1, amax)), width: f.W, height: f.sy(0.1) - f.sy(Math.min(1, amax)), style: "fill:var(--vec-u);fill-opacity:0.05" }, svg);
    text(svg, f.L + f.W - 4, f.sy(Math.min(1, amax)) + 12, "reliable range 0.1–1", { "text-anchor": "end" });
    let est = NaN, F = null;
    if (fx.length >= 2) {
      F = fit(fx, fy);
      const xEnd = F.m > 0 ? Math.min(xmax, (amax - F.b) / F.m) : xmax;
      polyline(svg, [[f.sx(0), f.sy(F.b)], [f.sx(xEnd), f.sy(F.b + F.m * xEnd)]], "stroke:var(--vec-u);stroke-width:1.8");
      est = (ax - F.b) / F.m;
    }
    stdC.forEach((c, i) => el("circle", { cx: f.sx(c), cy: f.sy(stdA[i]), r: 4, style: use[i] ? "fill:var(--foreground)" : "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg));
    // The unknown: read across to the fit, then down.
    el("line", { x1: f.L, x2: f.sx(Math.min(xmax, Math.max(0, est || 0))), y1: f.sy(ax), y2: f.sy(ax), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    if (Number.isFinite(est) && est > 0 && est < xmax) {
      el("line", { x1: f.sx(est), x2: f.sx(est), y1: f.sy(ax), y2: f.sy(0), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
      text(svg, f.sx(est), f.sy(0) - 4, "found", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    }
    el("circle", { cx: f.sx(cx), cy: f.sy(ax), r: 5, style: "fill:var(--brand)" }, svg);
    text(svg, f.sx(cx) - 8, f.sy(ax) - 8, "unknown", { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    o.slope.textContent = F ? `${num(F.m * 1000, 2)} mAU/µM (ideal ${num(eps * l * 1e-3, 2)})` : "need two standards";
    o.r2.textContent = F ? num(F.r2, 4) : "—";
    o.ax.textContent = num(ax, 3);
    o.est.textContent = Number.isFinite(est) ? `${num(est, 1)} µM` : "—";
    const err = (est - cx) / cx;
    o.err.textContent = Number.isFinite(err) ? `${err > 0 ? "+" : ""}${num(err * 100, 1)}%${ax > 1 ? " (above A = 1: dilute)" : ""}` : "—";
  }
  draw();
}

// ============================================================ chromatography

for (const root of document.querySelectorAll("[data-spec-chrom]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const L = s.len.get(), u = s.u.get(), A = s.a.get(), B = s.b.get(), C = s.c.get(), k1 = s.k1.get(), alpha = s.alpha.get();
    const Hof = (v) => A + B / v + C * v;
    const H = Hof(u), N = (L * 1000) / H, t0 = L / u;
    const k2 = k1 * alpha;
    const t1 = t0 * (1 + k1), t2 = t0 * (1 + k2);
    const s1 = t1 / Math.sqrt(N), s2 = t2 / Math.sqrt(N);
    const Rs = (2 * (t2 - t1)) / (4 * s1 + 4 * s2);
    const uopt = C > 0 ? Math.sqrt(B / C) : Infinity, Hmin = A + 2 * Math.sqrt(B * C);
    svg.replaceChildren();
    // Chromatogram (equal amounts: equal areas, so a wider peak is lower).
    const tmax = Math.max(t2 + 5 * s2, t0 * 1.2);
    const tstep = tmax > 600 ? 120 : tmax > 240 ? 60 : tmax > 90 ? 20 : tmax > 40 ? 10 : 5;
    const fc = frame(svg, { box: [52, 22, 560, 150], x: [0, tmax], y: [0, 1.15], xticks: range(0, tmax, tstep), yticks: [], xlabel: "time / s", ylabel: "detector signal" });
    const g = (t, mu, sd) => Math.exp(-0.5 * ((t - mu) / sd) ** 2) / sd;
    const ts = range(0, tmax, tmax / 600);
    const peak = Math.max(g(t1, t1, s1), g(t2, t2, s2));
    const y1 = ts.map((t) => g(t, t1, s1) / peak), y2 = ts.map((t) => g(t, t2, s2) / peak);
    polyline(svg, ts.map((t, i) => [fc.sx(t), fc.sy(y1[i])]), "stroke:var(--vec-u);stroke-width:1;stroke-opacity:0.7");
    polyline(svg, ts.map((t, i) => [fc.sx(t), fc.sy(y2[i])]), "stroke:var(--vec-v);stroke-width:1;stroke-opacity:0.7");
    polyline(svg, ts.map((t, i) => [fc.sx(t), fc.sy(y1[i] + y2[i])]), "stroke:var(--foreground);stroke-width:1.6");
    el("line", { x1: fc.sx(t0), x2: fc.sx(t0), y1: fc.sy(0), y2: fc.sy(0.12), style: "stroke:var(--muted-foreground);stroke-width:1.5" }, svg);
    text(svg, fc.sx(t0), fc.sy(0.12) - 4, "t₀", { "text-anchor": "middle" });
    for (const [t, sd, c] of [[t1, s1, "var(--vec-u)"], [t2, s2, "var(--vec-v)"]]) {
      el("line", { x1: fc.sx(t - 2 * sd), x2: fc.sx(t + 2 * sd), y1: fc.sy(0) - 2, y2: fc.sy(0) - 2, style: `stroke:${c};stroke-width:2` }, svg);
    }
    // van Deemter curve with its three terms.
    const umax = Math.max(8, u * 1.2);
    const us = range(0.05, umax, umax / 300);
    const hmax = Math.min(Math.max(...us.map(Hof)), Math.max(Hof(u), Hmin) * 3);
    const hstep = hmax > 80 ? 20 : hmax > 40 ? 10 : 5;
    const fv = frame(svg, { box: [52, 262, 560, 124], x: [0, umax], y: [0, hmax], xticks: range(0, umax, umax > 10 ? 2 : 1), yticks: range(0, hmax, hstep), xlabel: "flow velocity u / mm·s⁻¹", ylabel: "plate height H / µm" });
    const clip = (pts) => pts.filter(([, y]) => y >= fv.T);
    const term = (fn, style) => polyline(svg, clip(us.map((v) => [fv.sx(v), fv.sy(fn(v))])), style);
    term(() => A, "stroke:var(--muted-foreground);stroke-width:1;stroke-dasharray:2 3");
    term((v) => B / v, "stroke:var(--muted-foreground);stroke-width:1;stroke-dasharray:6 3");
    term((v) => C * v, "stroke:var(--muted-foreground);stroke-width:1;stroke-dasharray:1 2");
    term(Hof, "stroke:var(--foreground);stroke-width:1.8");
    text(svg, fv.sx(umax) - 2, fv.sy(C * umax) - 4 < fv.T ? fv.T + 10 : fv.sy(C * umax) - 4, "C·u", { "text-anchor": "end" });
    text(svg, fv.sx(0.7) + 6, Math.max(fv.T + 10, fv.sy(Math.min(hmax, B / 0.7)) - 2), "B/u", { "text-anchor": "start" });
    text(svg, fv.sx(umax) - 2, fv.sy(A) - 4, "A", { "text-anchor": "end" });
    if (uopt < umax) {
      el("line", { x1: fv.sx(uopt), x2: fv.sx(uopt), y1: fv.sy(0), y2: fv.sy(Hmin), style: "stroke:var(--foreground);stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
      text(svg, fv.sx(uopt), fv.sy(0) - 4, "u opt", { "text-anchor": "middle" });
    }
    if (H <= hmax) el("circle", { cx: fv.sx(u), cy: fv.sy(H), r: 5, style: "fill:var(--brand)" }, svg);
    o.hh.textContent = `${num(H, 1)} µm`;
    o.n.textContent = Math.round(N).toLocaleString("en");
    o.uopt.textContent = Number.isFinite(uopt) ? `${num(uopt, 2)} mm/s (H ${num(Hmin, 1)} µm)` : "—";
    o.times.textContent = `${num(t1, 1)} s · ${num(t2, 1)} s`;
    o.rs.textContent = num(Rs, 2);
    o.verdict.textContent = Rs >= 1.5 ? "baseline separated" : Rs >= 1 ? "partly overlapping" : Rs >= 0.5 ? "shoulder only" : "co-eluting";
  }
  draw();
}

// ============================================================ LOD and standard addition

for (const root of document.querySelectorAll("[data-spec-cal]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let mode = "external", seed = 3;
  onSeg(root, (_, v) => { mode = v; draw(); });
  root.querySelector('[data-act="reseed"]').addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const sigma = s.noise.get(), mat = s.matrix.get() / 100, cx = s.cx.get();
    const r = rng(seed * 7919);
    const S0 = 1; // signal per ppb in clean standards
    svg.replaceChildren();
    let xs, ys, found, F;
    if (mode === "external") {
      xs = [0, 0, 2, 5, 10, 20, 30, 40];
      ys = xs.map((c) => S0 * c + sigma * gauss(r));
      F = fit(xs, ys);
      const yx = S0 * mat * cx + sigma * gauss(r);
      found = (yx - F.b) / F.m;
      const xmax = 44, ymax = Math.max(...ys, yx) * 1.12;
      const f = frame(svg, { box: [52, 20, 560, 250], x: [0, xmax], y: [Math.min(0, ...ys) - 1, ymax], xticks: range(0, xmax, 5), yticks: range(0, ymax, ymax > 60 ? 20 : 10), yfmt: (v) => num(v, 0), xlabel: "concentration / ppb", ylabel: "signal (a.u.)" });
      polyline(svg, [[f.sx(0), f.sy(F.b)], [f.sx(xmax), f.sy(F.b + F.m * xmax)]], "stroke:var(--vec-u);stroke-width:1.8");
      xs.forEach((x, i) => el("circle", { cx: f.sx(x), cy: f.sy(ys[i]), r: 3.5, style: "fill:var(--foreground)" }, svg));
      const lod = (3.3 * F.sy) / F.m, loq = (10 * F.sy) / F.m;
      for (const [x, lab] of [[lod, "LOD"], [loq, "LOQ"]]) {
        if (x > xmax) continue;
        el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-v);stroke-dasharray:4 3" }, svg);
        text(svg, f.sx(x) + 3, f.T + 10, lab, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
      }
      el("line", { x1: f.L, x2: f.sx(Math.max(0, Math.min(xmax, found))), y1: f.sy(yx), y2: f.sy(yx), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
      el("circle", { cx: f.sx(Math.max(0, Math.min(xmax, found))), cy: f.sy(yx), r: 5, style: "fill:var(--brand)" }, svg);
      el("line", { x1: f.sx(cx), x2: f.sx(cx), y1: f.sy(0), y2: f.sy(0) - 10, style: "stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, f.sx(cx), f.sy(0) - 13, "true", { "text-anchor": "middle" });
    } else {
      // Equal aliquots of the sample, spiked with 0…20 ppb.
      xs = [0, 5, 10, 15, 20];
      ys = xs.map((a) => S0 * mat * (cx + a) + sigma * gauss(r));
      F = fit(xs, ys);
      found = F.b / F.m;
      const xmin = -Math.max(cx, found, 5) * 1.25, xmax = 24, ymax = Math.max(...ys) * 1.12;
      const f = frame(svg, { box: [52, 20, 560, 250], x: [xmin, xmax], y: [0, ymax], xticks: range(Math.ceil(xmin / 5) * 5, xmax, 5), yticks: range(0, ymax, ymax > 60 ? 20 : 10), yfmt: (v) => num(v, 0), xlabel: "standard added / ppb", ylabel: "signal (a.u.)" });
      el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      polyline(svg, [[f.sx(-found), f.sy(0)], [f.sx(xmax), f.sy(F.b + F.m * xmax)]], "stroke:var(--vec-u);stroke-width:1.8");
      xs.forEach((x, i) => el("circle", { cx: f.sx(x), cy: f.sy(ys[i]), r: 3.5, style: "fill:var(--foreground)" }, svg));
      el("circle", { cx: f.sx(-found), cy: f.sy(0), r: 5, style: "fill:var(--brand)" }, svg);
      text(svg, f.sx(-found), f.sy(0) - 10, `−${num(found, 1)} ppb`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      el("line", { x1: f.sx(-cx), x2: f.sx(-cx), y1: f.sy(0), y2: f.sy(0) + 8, style: "stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, f.sx(-cx), f.sy(0) + 18, "true", { "text-anchor": "middle" });
    }
    const lod = (3.3 * F.sy) / F.m, loq = (10 * F.sy) / F.m;
    o.slope.textContent = `${num(F.m, 3)} a.u./ppb`;
    o.sy.textContent = num(F.sy, 3);
    o.lod.textContent = `${num(lod, 2)} ppb`;
    o.loq.textContent = `${num(loq, 2)} ppb`;
    o.found.textContent = `${num(found, 2)} ppb${found < loq ? " (below LOQ)" : ""}`;
    o.err.textContent = `${found > cx ? "+" : ""}${num(((found - cx) / cx) * 100, 1)}%`;
  }
  draw();
}

// ============================================================ powder XRD

const CRYSTALS = { cu: ["fcc", 3.615], fe: ["bcc", 2.8665], po: ["sc", 3.359], si: ["dia", 5.431], al: ["fcc", 4.0495], w: ["bcc", 3.1652] };

function allowed(lat, h, k, l) {
  const even = (x) => x % 2 === 0;
  if (lat === "sc") return true;
  if (lat === "bcc") return even(h + k + l);
  const mixed = !((even(h) && even(k) && even(l)) || (!even(h) && !even(k) && !even(l)));
  if (lat === "fcc") return !mixed;
  if (mixed) return false; // diamond: fcc rules, and all-even needs h + k + l = 4n
  return !(even(h) && (h + k + l) % 4 !== 0);
}

function structure2(lat, h, k, l) {
  if (lat === "sc") return 1;
  if (lat === "bcc") return 4;
  if (lat === "fcc") return 16;
  return h % 2 ? 32 : 64;
}

function multiplicity(h, k, l) {
  const set = new Set();
  const perms = [[h, k, l], [h, l, k], [k, h, l], [k, l, h], [l, h, k], [l, k, h]];
  for (const p of perms) for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) set.add(`${p[0] * sx},${p[1] * sy},${p[2] * sz}`);
  return set.size;
}

export function reflections(lat, a, lam, max2t = 150) {
  const byS = new Map();
  for (let h = 0; h <= 9; h++) for (let k = 0; k <= h; k++) for (let l = 0; l <= k; l++) {
    if (!h && !k && !l) continue;
    if (!allowed(lat, h, k, l)) continue;
    const S = h * h + k * k + l * l, d = a / Math.sqrt(S), sinT = lam / (2 * d);
    if (sinT >= 1) continue;
    const th = Math.asin(sinT), tt = (2 * th * 180) / Math.PI;
    if (tt > max2t) continue;
    const lp = (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th));
    const decay = Math.exp(-3.2 * (sinT / lam) ** 2);
    const I = multiplicity(h, k, l) * lp * structure2(lat, h, k, l) * decay;
    const cur = byS.get(S) ?? { S, d, tt, I: 0, hkl: [] };
    cur.I += I;
    cur.hkl.push(`${h}${k}${l}`);
    byS.set(S, cur);
  }
  const list = [...byS.values()].sort((x, y) => x.tt - y.tt);
  const top = Math.max(...list.map((p) => p.I), 1);
  for (const p of list) p.rel = (p.I / top) * 100;
  return list;
}

for (const root of document.querySelectorAll("[data-spec-xrd]")) {
  const svg = root.querySelector("[data-plot]");
  const pick = root.querySelector("[data-pick]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let lat = "fcc", sel = 0;
  setSeg(root, "Lattice", lat);
  onSeg(root, (_, v) => { lat = v; sel = 0; draw(); });
  pick.addEventListener("change", () => {
    const [l, a] = CRYSTALS[pick.value];
    lat = l; sel = 0;
    setSeg(root, "Lattice", l);
    s.a.set(a, false);
    draw();
  });

  function draw() {
    const a = s.a.get(), lam = s.lam.get();
    const list = reflections(lat, a, lam);
    if (sel >= list.length) sel = 0;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 26, 576, 236], x: [10, 150], y: [0, 112], xticks: range(20, 150, 10), yticks: [0, 50, 100], xlabel: "2θ / degrees", ylabel: "intensity" });
    const xs = range(10, 150, 0.1);
    const w = 0.25;
    polyline(svg, xs.map((x) => [f.sx(x), f.sy(list.reduce((acc, p) => acc + p.rel * Math.exp(-0.5 * ((x - p.tt) / w) ** 2), 0) * 0.98)]), "stroke:var(--foreground);stroke-width:1.2");
    list.forEach((p, i) => {
      const isSel = i === sel;
      el("line", { x1: f.sx(p.tt), x2: f.sx(p.tt), y1: f.sy(0) + 4, y2: f.sy(0) + 12, style: `stroke:${isSel ? "var(--brand)" : "var(--vec-u)"};stroke-width:2` }, svg);
      if (p.rel > 6 || isSel) text(svg, f.sx(p.tt), f.sy(p.rel) - 5, `(${p.hkl[p.hkl.length - 1]})`, { "text-anchor": "middle", class: `${isSel ? "fill-foreground" : "fill-muted-foreground"} font-mono text-[9px]` });
      hitArea(svg, { x: f.sx(p.tt) - 7, y: f.T, width: 14, height: f.H + 14 }, `Reflection ${p.hkl.join(" and ")} at 2 theta ${num(p.tt, 1)} degrees`, () => { sel = i; draw(); svg.querySelectorAll("rect[role=button]")[i]?.focus(); })
        .setAttribute("aria-pressed", String(isSel));
    });
    const p = list[sel];
    o.hkl.textContent = p ? p.hkl.map((x) => `(${x})`).join(" + ") : "none in range";
    o.s.textContent = p ? String(p.S) : "—";
    o.d.textContent = p ? `${num(p.d, 4)} Å` : "—";
    o.tt.textContent = p ? `${num(p.tt, 2)}°` : "—";
    o.first.textContent = list.slice(0, 3).map((q) => `(${q.hkl[q.hkl.length - 1]})`).join(" ") || "—";
    o.seq.textContent = list.slice(0, 7).map((q) => q.S).join(", ");
  }
  draw();
}
