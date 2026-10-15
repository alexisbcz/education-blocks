// Computational chemistry, blocks on dynamics and statistics: the
// Lennard-Jones dimer, the LJ fluid by molecular dynamics, diffusion from
// the mean squared displacement, the butane torsion and an adsorption
// isotherm by Monte Carlo. Optimisers, the elastic band, Hückel, normal
// modes and the Gaussian basis are in compchem-pes.js and compchem-qc.js.

import { scrubAll } from "./scrub.js";
import {
  el, text, frame, polyline, outs, plot, fx, minus, C, onSeg, onToggle, toggled, playButton, batched,
  onScreen, reduced, rng, clipped, ticks, tickFmt, path,
} from "./compchem-util.js";
import { ljV, ljF, ljTurning, ljPeriod, LJ_RMIN, LJ_K, butaneV, butanePop } from "./compchem-chem.js";
import { LJBox } from "./compchem-md.js";

const sciFmt = (v, d = 2) => {
  if (!Number.isFinite(v)) return "—";
  const [m, e] = v.toExponential(d).split("e");
  return `${minus(m)}×10${String(Number(e)).split("").map((c) => ({ "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" })[c]).join("")}`;
};

/** A play loop that pauses off screen and under a paused button. */
function loop(root, tick, { autoplay = true } = {}) {
  const btn = root.querySelector("[data-action=play]"), show = playButton(btn);
  let playing = autoplay && !reduced(), visible = false, raf = 0, last = 0;
  const frameFn = (now) => {
    raf = 0;
    if (!playing || !visible) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    tick(dt);
    raf = requestAnimationFrame(frameFn);
  };
  const kick = () => { if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(frameFn); } };
  btn.addEventListener("click", () => { playing = !playing; show(playing); kick(); });
  onScreen(root, (v) => { visible = v; kick(); });
  show(playing);
  return { set: (p) => { playing = p; show(p); kick(); }, get playing() { return playing; } };
}

// ============================================================ 1 Lennard-Jones

for (const root of document.querySelectorAll("[data-cc-lj]")) {
  const svg = plot(root), dsvg = plot(root, "dimer"), o = outs(root);
  let r = 1, v = 0, simT = 0;
  const s = scrubAll(root, () => { resetDimer(); draw(); });
  onToggle(root, () => requestAnimationFrame(draw));
  const P = () => ({ eps: s.eps.get(), sig: s.sig.get(), e: s.e.get() });

  function resetDimer() {
    const { sig, e } = P();
    r = ljTurning(e)[0] * sig;
    v = 0;
  }

  // The frame and its curves are rebuilt on parameter changes only; the
  // moving dot and the atoms update every frame.
  let f, dot, atoms = [];
  function draw() {
    const { eps, sig, e } = P();
    svg.replaceChildren();
    f = frame(svg, { box: [52, 18, 470, 248], x: [0.8, 3], y: [-3.4, 2.4], xticks: ticks(0.8, 3, 6), yticks: ticks(-3, 2, 5), xfmt: tickFmt, yfmt: tickFmt, xlabel: "r / σ₀", ylabel: "energy / ε₀" });
    const g = clipped(svg, f);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, g);
    const V = [], F = [];
    for (let k = 0; k <= 400; k++) {
      const x = 0.8 + (2.2 * k) / 400;
      V.push([f.sx(x), f.sy(Math.max(-3.4, Math.min(2.6, ljV(x, eps, sig))))]);
      F.push([f.sx(x), f.sy(Math.max(-3.6, Math.min(2.6, ljF(x, eps, sig))))]);
    }
    if (toggled(root, "force")) path(g, F, `stroke:${C.j};stroke-width:1.5;stroke-dasharray:5 3`);
    path(g, V, `stroke:${C.u};stroke-width:2`);
    // Minimum, and the energy level between its turning points.
    const rm = LJ_RMIN * sig, [a, b] = ljTurning(e).map((q) => q * sig);
    el("line", { x1: f.sx(rm), x2: f.sx(rm), y1: f.sy(-eps), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, g);
    text(g, f.sx(rm) + 4, f.sy(-eps) + 14, `2^(1/6)σ, −ε`);
    el("line", { x1: f.sx(a), x2: f.sx(Math.min(b, 3)), y1: f.sy(e * eps), y2: f.sy(e * eps), style: `stroke:${C.brand};stroke-width:1.75` }, g);
    for (const q of [a, b]) if (q < 3) el("circle", { cx: f.sx(q), cy: f.sy(e * eps), r: 2.5, style: `fill:${C.brand}` }, g);
    dot = el("circle", { r: 5, style: `fill:var(--background);stroke:${C.brand};stroke-width:2` }, g);
    // The dimer strip uses the same horizontal scale as the plot.
    dsvg.replaceChildren();
    el("line", { x1: 20, x2: 540, y1: 35, y2: 35, style: "stroke:currentColor;stroke-opacity:0.12" }, dsvg);
    const rad = (sig * f.W) / 2.2 / 2 * 0.62;
    atoms = [0, 1].map(() => el("circle", { cy: 35, r: Math.min(30, rad), style: `fill:${C.u};fill-opacity:0.25;stroke:${C.u};stroke-width:1.5` }, dsvg));
    const rmin = LJ_RMIN * sig, T = (ljPeriod(e) * sig) / Math.sqrt(eps), T0 = 2 * Math.PI * Math.sqrt((0.5 * sig * sig) / (LJ_K * eps));
    o.rmin.textContent = `${fx(rmin, 4)} σ₀  (depth ${fx(eps, 2)} ε₀)`;
    o.turn.textContent = `${fx(a, 3)} – ${fx(b, 3)} σ₀`;
    o.period.textContent = `${fx(T, 3)} τ`;
    o.harm.textContent = `${fx(T0, 3)} τ  (ratio ${fx(T / T0, 3)})`;
    // Argon: σ₀ = 3.405 Å, ε₀/k = 119.8 K, τ = σ₀√(m/ε₀) = 2.156 ps.
    o.argon.textContent = `r_min ${fx(rmin * 3.405 * 1.0, 2)} Å, depth ${fx(eps * 0.996, 3)} kJ/mol, period ${fx(T * 2.156, 2)} ps`;
    o.note.textContent = e > -0.15
      ? "Near the top of the well the outer turning point runs far out, where the attraction is weak, so the atoms spend a long time apart and the period grows without limit as E → 0. At E ≥ 0 the dimer would fall apart."
      : "Units are reduced: lengths in σ₀, energies in ε₀ and time in τ = σ₀√(m/ε₀). The harmonic period uses the curvature at the bottom, V″ = 57.15 ε/σ²; the true period is longer because the well is softer on the outside.";
    place();
  }

  function place() {
    if (!f) return;
    const { eps } = P();
    dot.setAttribute("cx", f.sx(r)); dot.setAttribute("cy", f.sy(ljV(r, eps, s.sig.get())));
    const half = (r * f.W) / 2.2 / 2;
    atoms[0].setAttribute("cx", 280 - half); atoms[1].setAttribute("cx", 280 + half);
  }

  // Velocity Verlet on the relative coordinate, μ = m/2 = 1/2. One
  // harmonic period lasts about 1.6 s on screen.
  loop(root, (dt) => {
    const { eps, sig } = P(), T0 = 2 * Math.PI * Math.sqrt((0.5 * sig * sig) / (LJ_K * eps));
    const span = (dt / 1.6) * T0, n = 40, h = span / n;
    for (let k = 0; k < n; k++) {
      v += (0.5 * h * ljF(r, eps, sig)) / 0.5;
      r += h * v;
      v += (0.5 * h * ljF(r, eps, sig)) / 0.5;
    }
    simT += span;
    place();
  });
  resetDimer();
  draw();
}

// ============================================================ 2 Molecular dynamics

const MD_STATES = { solid: [0.2, 0.95], liquid: [0.45, 0.75], gas: [1.2, 0.05] };

for (const root of document.querySelectorAll("[data-cc-md]")) {
  const bsvg = plot(root, "box"), esvg = plot(root, "energy"), gsvg = plot(root, "gr"), o = outs(root);
  const N = 144, RMAX = 4, BINS = 80, DT = 0.005;
  let box, dots = [], hist, frames, hist0, e0, thermo = toggled(root, "thermo"), seed = 1;
  const s = scrubAll(root, (name) => {
    if (name === "rho") { build(); warm(); }
    else { box.scaleTo(s.T.get()); resetStats(); }
    drawAll();
  });
  onSeg(root, (_, v) => { const [T, rho] = MD_STATES[v]; s.T.set(T, false); s.rho.set(rho, false); build(); warm(); drawAll(); });
  onToggle(root, (_, on) => { thermo = on; resetStats(); drawAll(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { seed++; build(); warm(); drawAll(); });

  function resetStats() {
    hist = new Float64Array(BINS); frames = 0;
    hist0 = []; e0 = null;
  }

  function build() {
    box = new LJBox({ N, rho: s.rho.get(), T: s.T.get(), seed });
    bsvg.replaceChildren();
    const sc = 300 / box.L;
    el("rect", { x: 0.5, y: 0.5, width: 299, height: 299, rx: 4, style: "fill:none;stroke:currentColor;stroke-opacity:0.2" }, bsvg);
    dots = Array.from({ length: N }, () => el("circle", { r: Math.max(1.2, 0.5 * sc * 0.95), style: `fill:${C.u};fill-opacity:0.55;stroke:${C.u};stroke-opacity:0.9;stroke-width:0.6` }, bsvg));
    resetStats();
  }

  function drawBox() {
    const sc = 300 / box.L;
    for (let i = 0; i < N; i++) { dots[i].setAttribute("cx", (box.x[i] * sc).toFixed(1)); dots[i].setAttribute("cy", (box.y[i] * sc).toFixed(1)); }
  }

  function record() {
    const ke = box.kinetic() / N, pe = box.pe / N;
    hist0.push([box.t, ke, pe, ke + pe]);
    if (hist0.length > 400) hist0.shift();
    if (e0 === null && !thermo) e0 = ke + pe;
    box.sampleGr(hist, RMAX); frames++;
  }

  function drawEnergy() {
    esvg.replaceChildren();
    if (hist0.length < 2) return;
    const t0 = hist0[0][0], t1 = Math.max(t0 + 0.5, hist0.at(-1)[0]);
    let lo = Infinity, hi = -Infinity;
    for (const h of hist0) for (const v of h.slice(1)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const pad = Math.max(0.1, (hi - lo) * 0.1);
    const f = frame(esvg, { box: [46, 16, 296, 120], x: [t0, t1], y: [lo - pad, hi + pad], xticks: ticks(t0, t1, 4), yticks: ticks(lo - pad, hi + pad, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "t*", ylabel: "energy per atom / ε" });
    const g = clipped(esvg, f);
    [[1, C.u], [2, C.j], [3, C.brand]].forEach(([k, c]) => polyline(g, hist0.map((h) => [f.sx(h[0]), f.sy(h[k])]), `stroke:${c};stroke-width:1.5`));
  }

  function drawGr() {
    gsvg.replaceChildren();
    const gr = box.normaliseGr(hist, RMAX, frames), top = Math.max(3, ...gr) * 1.08;
    const f = frame(gsvg, { box: [46, 16, 296, 120], x: [0, RMAX], y: [0, top], xticks: [0, 1, 2, 3, 4], yticks: ticks(0, top, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "r / σ", ylabel: `g(r), ${frames} frames` });
    const g = clipped(gsvg, f);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(1), y2: f.sy(1), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4" }, g);
    const dr = RMAX / BINS;
    polyline(g, gr.map((v, k) => [f.sx((k + 0.5) * dr), f.sy(v)]), `stroke:${C.brand};stroke-width:1.75`);
  }

  function drawAll() {
    drawBox(); drawEnergy(); drawGr();
    const ke = box.kinetic() / N, pe = box.pe / N;
    o.time.textContent = fx(box.t, 2);
    o.temp.textContent = `${fx(box.temperature(), 3)}  (target ${fx(s.T.get(), 2)})`;
    o.etot.textContent = `${fx(ke + pe, 4)}  (KE ${fx(ke, 3)}, PE ${fx(pe, 3)})`;
    o.drift.textContent = thermo ? "thermostat on: energy is exchanged with a bath" : e0 === null ? "—" : `${sciFmt(ke + pe - e0, 1)} ε per atom since the record began`;
    o.press.textContent = fx(box.pressure(), 3);
    const T = s.T.get(), rho = s.rho.get();
    o.note.textContent = rho > 0.85 && T < 0.4
      ? "A triangular crystal: the atoms rattle about fixed sites, so g(r) keeps sharp peaks, and the second one splits at √3σ and 2σ, the distances to the next shells of the lattice."
      : rho < 0.2
        ? "A dilute gas: most of the time atoms are far apart, so g(r) is close to 1 everywhere except a contact peak near 1.1σ, where the attraction makes neighbours slightly more likely than chance."
        : "A liquid: the first neighbour shell is sharp, the next ones fade within a few σ, and there is no long-range order. In two dimensions with this cutoff the liquid only exists below T* ≈ 0.46 (Smit and Frenkel 1991); above that the dense state is a supercritical fluid.";
  }

  const redraw = batched(drawAll);
  loop(root, () => {
    box.step(8, DT, thermo ? s.T.get() : null);
    record();
    redraw();
  });
  build();
  // Equilibrate with the thermostat, then start the record, so the plots
  // are not empty under reduced motion and the drift starts from here.
  function warm() {
    for (let k = 0; k < 250; k++) box.step(8, DT, s.T.get());
    resetStats();
    for (let k = 0; k < 30; k++) { box.step(8, DT, thermo ? s.T.get() : null); record(); }
  }
  warm();
  drawAll();
}

// ============================================================ 3 Diffusion

for (const root of document.querySelectorAll("[data-cc-msd]")) {
  const bsvg = plot(root, "box"), msvg = plot(root, "msd"), o = outs(root);
  const N = 144, DT = 0.005, TAGS = [3, 31, 58, 77, 101, 130];
  let box, x0, y0, t0, series, trails, layer;
  const s = scrubAll(root, (name) => (name === "rho" ? build() : restart()));
  root.querySelector("[data-action=reset]").addEventListener("click", restart);

  function build() {
    box = new LJBox({ N, rho: s.rho.get(), T: s.T.get(), seed: 7 });
    box.step(1500, DT, s.T.get()); // melt the starting lattice
    restart();
  }

  function restart() {
    box.scaleTo(s.T.get());
    x0 = Float64Array.from(box.ux); y0 = Float64Array.from(box.uy); t0 = box.t;
    series = [];
    trails = TAGS.map(() => []);
    // Run a stretch up front so the plot already has a diffusive part.
    for (let k = 0; k < 120; k++) { box.step(6, DT, s.T.get()); sample(); }
    draw();
  }

  function sample() {
    let m = 0;
    for (let i = 0; i < N; i++) m += (box.ux[i] - x0[i]) ** 2 + (box.uy[i] - y0[i]) ** 2;
    series.push([box.t - t0, m / N]);
    TAGS.forEach((i, k) => trails[k].push([box.ux[i] - x0[i], box.uy[i] - y0[i]]));
  }

  function fit() {
    // Least squares on the diffusive part, t > 1.
    const pts = series.filter((p) => p[0] > 1);
    if (pts.length < 5) return null;
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of pts) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; }
    const b = sxy / sxx;
    return { D: b / 4, c: my - b * mx };
  }

  function draw() {
    // Box: every atom faint, the tagged ones with their unwrapped paths,
    // each drawn from where it started.
    bsvg.replaceChildren();
    const sc = 300 / box.L;
    el("rect", { x: 0.5, y: 0.5, width: 299, height: 299, rx: 4, style: "fill:none;stroke:currentColor;stroke-opacity:0.2" }, bsvg);
    const atoms = el("g", { style: "fill:currentColor;fill-opacity:0.12" }, bsvg);
    for (let i = 0; i < N; i++) el("circle", { cx: box.x[i] * sc, cy: box.y[i] * sc, r: 0.45 * sc }, atoms);
    const g = clipped(bsvg, { L: 0, T: 0, W: 300, H: 300 });
    const colors = [C.brand, C.u, C.j, C.v, C.out, C.i];
    TAGS.forEach((i, k) => {
      const sx = x0[i] - box.L * Math.floor(x0[i] / box.L), sy = y0[i] - box.L * Math.floor(y0[i] / box.L);
      polyline(g, [[sx * sc, sy * sc], ...trails[k].map(([dx, dy]) => [(sx + dx) * sc, (sy + dy) * sc])], `stroke:${colors[k]};stroke-width:1.4;stroke-linejoin:round`);
      el("circle", { cx: sx * sc, cy: sy * sc, r: 2.5, style: `fill:${colors[k]}` }, g);
    });
    // MSD on log–log axes: slope 2 while ballistic, slope 1 once diffusive.
    msvg.replaceChildren();
    const f = frame(msvg, { box: [52, 18, 290, 240], x: [-2, 1.3], y: [-4, 2], xticks: [-2, -1, 0, 1], yticks: [-4, -3, -2, -1, 0, 1, 2], xfmt: (k) => (k === 0 ? "1" : k === 1 ? "10" : `10${k === -1 ? "⁻¹" : "⁻²"}`), yfmt: (k) => (k === 0 ? "1" : `10${String(k).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`), xlabel: "t*", ylabel: "MSD / σ²" });
    const gp = clipped(msvg, f), lg = (v) => Math.log10(Math.max(1e-9, v));
    const T = s.T.get(), ts = Array.from({ length: 60 }, (_, k) => 10 ** (-2 + (3.3 * k) / 59));
    path(gp, ts.map((t) => [f.sx(lg(t)), f.sy(lg(2 * T * t * t))]), `stroke:${C.out};stroke-width:1.25;stroke-dasharray:4 3`);
    const ft = fit();
    if (ft) path(gp, ts.filter((t) => t >= 0.5 && 4 * ft.D * t + ft.c > 0).map((t) => [f.sx(lg(t)), f.sy(lg(4 * ft.D * t + ft.c))]), `stroke:${C.u};stroke-width:1.5`);
    if (series.length > 1) polyline(gp, series.filter((p) => p[0] > 0).map((p) => [f.sx(lg(p[0])), f.sy(lg(p[1]))]), `stroke:${C.brand};stroke-width:2`);
    const last = series.at(-1);
    o.time.textContent = last ? fx(last[0], 2) : "0";
    o.msd.textContent = last ? `${fx(last[1], 3)} σ²` : "—";
    o.D.textContent = ft ? `${fx(ft.D, 4)}  (slope ${fx(4 * ft.D, 3)} = 4D)` : "needs t* > 1";
    o.argon.textContent = ft ? `${sciFmt(ft.D * 5.38e-8, 1)} m²/s  (D*·σ²/τ)` : "—";
    o.note.textContent = !ft
      ? "Early on each atom still moves in a straight line, so the displacement is vt and the mean square is ⟨v²⟩t² = 2T*t² in two dimensions: the dashed line. Collisions take over after a few tenths of a time unit."
      : `The linear fit uses t* > 1. A 2D liquid has a long-time tail that makes D creep up slowly with the run length, so treat the digits after the second as noise. ${T > 1.2 ? "At this temperature the dense phase is above the 2D critical point, a supercritical fluid." : ""}`;
  }

  const redraw = batched(draw);
  loop(root, () => {
    box.step(6, DT, s.T.get());
    sample();
    if (box.t - t0 > 20) restart();
    redraw();
  });
  build();
}

// ============================================================ 4 Butane

for (const root of document.querySelectorAll("[data-cc-butane]")) {
  const nsvg = plot(root, "newman"), svg = plot(root), o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { s.phi.set(Number(v), false); draw(); });

  const name = (d) => {
    const a = ((d % 360) + 360) % 360, near = (c, w = 15) => Math.abs(((a - c + 540) % 360) - 180) <= w;
    if (near(180, 20)) return "anti (staggered)";
    if (near(60) || near(300)) return "gauche (staggered)";
    if (near(120) || near(240)) return "eclipsed, CH₃ over H";
    if (near(0)) return "syn, CH₃ over CH₃ (fully eclipsed)";
    return "between conformers";
  };

  function newman(phi) {
    nsvg.replaceChildren();
    const cx = 130, cy = 130, R = 46, L = 92;
    const bond = (deg, from, len, back, label) => {
      const a = ((deg - 90) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
      el("line", { x1: cx + ux * from, y1: cy + uy * from, x2: cx + ux * len, y2: cy + uy * len, style: `stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-opacity:${back ? 0.55 : 1}` }, nsvg);
      const lr = len + (back ? 30 : 16);
      const t = text(nsvg, cx + ux * lr, cy + uy * lr + 4, label, { "text-anchor": "middle", class: `font-mono text-[12px] ${label === "CH₃" ? "fill-foreground" : "fill-muted-foreground"}` });
      if (label === "CH₃") t.setAttribute("style", `fill:${back ? C.j : C.u}`);
    };
    // Back carbon: bonds start at the circle's edge and are drawn first.
    [0, 120, 240].forEach((d, k) => bond(d + phi, R, L, true, k === 0 ? "CH₃" : "H"));
    el("circle", { cx, cy, r: R, style: "fill:var(--background);stroke:currentColor;stroke-width:2" }, nsvg);
    [0, 120, 240].forEach((d, k) => bond(d, 0, L - 6, false, k === 0 ? "CH₃" : "H"));
    el("circle", { cx, cy, r: 3.5, style: "fill:currentColor" }, nsvg);
    text(nsvg, 8, 252, `φ = ${Math.round(phi)}°`, { class: "fill-muted-foreground font-mono text-[11px]" });
  }

  function draw() {
    const phi = ((s.phi.get() % 360) + 360) % 360, T = s.T.get(), RT = (8.314462618 * T) / 1000;
    // φ is the angle from the front methyl to the back one: 0° puts them
    // on top of each other (syn), 180° on opposite sides (anti).
    newman(phi);
    svg.replaceChildren();
    const f = frame(svg, { box: [46, 20, 316, 236], x: [0, 360], y: [0, 21], xticks: [0, 60, 120, 180, 240, 300, 360], yticks: [0, 5, 10, 15, 20], xfmt: (v) => `${v}°`, yfmt: tickFmt, xlabel: "dihedral φ", ylabel: "energy / kJ mol⁻¹" });
    const g = clipped(svg, f);
    const pts = [], w = [];
    for (let k = 0; k <= 360; k++) { const V = butaneV(k); pts.push([f.sx(k), f.sy(V)]); w.push(Math.exp(-V / RT)); }
    // The Boltzmann distribution, scaled to the plot height, as a filled area.
    const wmax = Math.max(...w);
    const area = [[f.sx(0), f.sy(0)], ...w.map((q, k) => [f.sx(k), f.sy((q / wmax) * 19)]), [f.sx(360), f.sy(0)]];
    el("polygon", { points: area.map((p) => p.join(",")).join(" "), style: `fill:${C.brand};fill-opacity:0.14;stroke:${C.brand};stroke-opacity:0.6;stroke-width:1` }, g);
    polyline(g, pts, `stroke:${C.u};stroke-width:2`);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(RT), y2: f.sy(RT), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, g);
    text(g, f.L + f.W - 4, f.sy(RT) - 4, "RT", { "text-anchor": "end" });
    el("line", { x1: f.sx(phi), x2: f.sx(phi), y1: f.T, y2: f.T + f.H, style: `stroke:${C.brand};stroke-opacity:0.5` }, g);
    el("circle", { cx: f.sx(phi), cy: f.sy(butaneV(phi)), r: 4.5, style: `fill:var(--background);stroke:${C.brand};stroke-width:2` }, svg);
    const pop = butanePop(T);
    o.V.textContent = `${fx(Math.max(0, butaneV(phi)), 2)} kJ/mol`;
    o.name.textContent = name(phi);
    o.anti.textContent = `${fx(100 * pop.anti, 1)} %`;
    o.gauche.textContent = `${fx(100 * pop.gauche, 1)} %`;
    o.rt.textContent = `${fx(RT, 2)} kJ/mol at ${Math.round(T)} K`;
    o.note.textContent = T > 900
      ? "Hot enough that RT approaches the gauche penalty: the populations head toward the statistical 1 : 2 split between one anti and two gauche wells, while the 16–19 kJ/mol eclipsed barriers still keep molecules mostly in the wells."
      : "The barriers of 16 and 19 kJ/mol are several RT at room temperature, so a molecule rattles in one well for a few picoseconds to nanoseconds before hopping: fast enough that butane's conformers cannot be separated, slow on the scale of a vibration.";
  }

  loop(root, (dt) => { s.phi.set((s.phi.get() + 50 * dt) % 360, false); draw(); }, { autoplay: false });
  draw();
}

// ============================================================ 10 Adsorption

for (const root of document.querySelectorAll("[data-cc-ads]")) {
  const gsvg = plot(root, "grid"), isvg = plot(root, "iso"), o = outs(root);
  const L = 24, occ = new Uint8Array(L * L), rand = rng(11);
  let tries = 0, accepts = 0, sweeps = 0, avg = [], points = [], sweep = null;
  const s = scrubAll(root, () => { avg = []; draw(); });

  const cells = [];
  for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
    cells.push(el("rect", { x: i * 12 + 1, y: j * 12 + 1, width: 10, height: 10, rx: 2.5, style: "fill:currentColor;fill-opacity:0.06" }, gsvg));
  }

  // One Metropolis sweep in the grand canonical ensemble: z = KP is the
  // activity and J the energy per occupied neighbour pair, both in kT.
  function mcSweep(lp, J) {
    const z = 10 ** lp;
    for (let k = 0; k < L * L; k++) {
      const s0 = Math.floor(rand() * L * L), i = s0 % L, j = (s0 / L) | 0;
      const nn = occ[j * L + ((i + 1) % L)] + occ[j * L + ((i + L - 1) % L)] + occ[((j + 1) % L) * L + i] + occ[((j + L - 1) % L) * L + i];
      const ratio = occ[s0] ? Math.exp(J * nn) / z : z * Math.exp(-J * nn);
      tries++;
      if (ratio >= 1 || rand() < ratio) { occ[s0] ^= 1; accepts++; }
    }
    sweeps++;
  }
  const coverage = () => occ.reduce((a, b) => a + b, 0) / (L * L);

  function draw() {
    for (let k = 0; k < L * L; k++) cells[k].setAttribute("style", occ[k] ? `fill:${C.brand};fill-opacity:0.85` : "fill:currentColor;fill-opacity:0.06");
    isvg.replaceChildren();
    const f = frame(isvg, { box: [46, 18, 296, 230], x: [-3, 3], y: [0, 1], xticks: [-3, -2, -1, 0, 1, 2, 3], yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => (v === 0 ? "1" : `10${String(v).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`), yfmt: tickFmt, xlabel: "KP", ylabel: "coverage θ" });
    const g = clipped(isvg, f);
    const lang = [];
    for (let k = 0; k <= 120; k++) { const lp = -3 + (6 * k) / 120, z = 10 ** lp; lang.push([f.sx(lp), f.sy(z / (1 + z))]); }
    polyline(g, lang, `stroke:${C.u};stroke-width:2`);
    for (const p of points) el("circle", { cx: f.sx(p.lp), cy: f.sy(p.theta), r: 3.2, style: `fill:${C.brand};fill-opacity:${p.J === s.J.get() ? 0.9 : 0.3}` }, g);
    const lp = s.lp.get(), z = 10 ** lp, th = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : coverage();
    el("line", { x1: f.sx(lp), x2: f.sx(lp), y1: f.T, y2: f.T + f.H, style: `stroke:${C.brand};stroke-opacity:0.35` }, g);
    el("circle", { cx: f.sx(lp), cy: f.sy(th), r: 5, style: `fill:var(--background);stroke:${C.brand};stroke-width:2` }, isvg);
    o.theta.textContent = `${fx(th, 3)}  (now ${fx(coverage(), 3)})`;
    o.lang.textContent = fx(z / (1 + z), 3);
    o.acc.textContent = tries ? `${fx((100 * accepts) / tries, 1)} %` : "—";
    o.sweeps.textContent = String(sweeps);
    const J = s.J.get();
    o.note.textContent = sweep
      ? `Sweeping: ${sweep.i + 1} of ${sweep.lps.length} pressures, ${sweep.phase === "eq" ? "equilibrating" : "averaging"}.`
      : J === 0
        ? "With no neighbour forces each site fills independently, with odds KP : 1, which is exactly Langmuir's isotherm: the averaged coverage should sit on the curve within a few hundredths."
        : J <= -1.77
          ? `Neighbours attract strongly enough to condense: the coverage jumps from a sparse gas to a nearly full layer over a small change in pressure, near KP = e^(2J) = ${fx(Math.exp(2 * J), 3)}, where filled and empty sites are symmetric. By the lattice-gas mapping onto the Ising model, this needs |J| above 4 × 0.4407 = 1.76 kT (Onsager's critical point).`
          : J < 0
            ? "Attraction between neighbours makes a filled site encourage the next: the isotherm becomes steeper than Langmuir's, but below |J| = 1.76 kT the layer still fills continuously."
            : "Repulsion between neighbours makes it costly to pack the sites: coverage lags Langmuir's curve at high pressure, and near half filling the molecules order in a checkerboard.";
  }

  function startSweep() {
    sweep = { lps: Array.from({ length: 25 }, (_, k) => -3 + (6 * k) / 24), i: 0, n: 0, phase: "eq", acc: [], J: s.J.get() };
    play.set(true);
  }
  root.querySelector("[data-action=sweep]").addEventListener("click", startSweep);
  root.querySelector("[data-action=clear]").addEventListener("click", () => { points = []; draw(); });

  const redraw = batched(draw);
  const play = loop(root, () => {
    if (sweep) {
      const lp = sweep.lps[sweep.i];
      for (let k = 0; k < 20; k++) {
        mcSweep(lp, sweep.J);
        if (sweep.phase === "eq") { if (++sweep.n >= 100) { sweep.phase = "avg"; sweep.n = 0; } }
        else { sweep.acc.push(coverage()); if (++sweep.n >= 100) {
          points.push({ lp, theta: sweep.acc.reduce((a, b) => a + b, 0) / sweep.acc.length, J: sweep.J });
          sweep.i++; sweep.n = 0; sweep.phase = "eq"; sweep.acc = [];
          if (sweep.i >= sweep.lps.length) { sweep = null; s.lp.set(s.lp.get(), false); break; }
        } }
      }
    } else {
      for (let k = 0; k < 4; k++) mcSweep(s.lp.get(), s.J.get());
      avg.push(coverage());
      if (avg.length > 120) avg.shift();
    }
    redraw();
  });
  for (let k = 0; k < 60; k++) { mcSweep(0, 0); avg.push(coverage()); }
  draw();
}
