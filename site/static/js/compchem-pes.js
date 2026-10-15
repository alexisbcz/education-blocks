// Computational chemistry, blocks on the Müller–Brown surface: three
// geometry optimisers from a start you choose, and the nudged elastic band
// with an optional climbing image.

import { scrubAll } from "./scrub.js";
import {
  el, text, frame, polyline, outs, plot, fx, C, onSeg, onToggle, toggled, playButton, batched, onScreen, reduced,
  clipped, contours, ticks, tickFmt, rng,
} from "./compchem-util.js";
import { mbV, MB_MINIMA, MB_VIEW, optimise, nebInit, nebStep } from "./compchem-chem.js";

// The surface is sampled once and its contours cached per drawing size.
const NX = 136, NY = 120;
const FIELD = (() => {
  const F = new Float64Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = MB_VIEW.x[0] + ((MB_VIEW.x[1] - MB_VIEW.x[0]) * i) / (NX - 1);
    const y = MB_VIEW.y[0] + ((MB_VIEW.y[1] - MB_VIEW.y[0]) * j) / (NY - 1);
    F[j * NX + i] = Math.min(mbV(x, y), 200);
  }
  return F;
})();
const LEVELS = [-145, -130, -115, -100, -85, -70, -55, -40, -25, -10, 5, 20, 40, 70, 110];

/** Draws the contour map into svg; returns the frame (with sx, sy). */
function surface(svg, box) {
  const f = frame(svg, { box, x: MB_VIEW.x, y: MB_VIEW.y, xticks: ticks(-1.5, 1, 5), yticks: ticks(-0.25, 2, 5), xfmt: tickFmt, yfmt: tickFmt, xlabel: "x", ylabel: "y" });
  const g = clipped(svg, f);
  const map = (i, j) => [f.sx(MB_VIEW.x[0] + ((MB_VIEW.x[1] - MB_VIEW.x[0]) * i) / (NX - 1)), f.sy(MB_VIEW.y[0] + ((MB_VIEW.y[1] - MB_VIEW.y[0]) * j) / (NY - 1))];
  for (const c of contours(FIELD, NX, NY, LEVELS, map)) {
    // Low basins darker: the opacity follows the level.
    const op = 0.12 + 0.45 * Math.max(0, Math.min(1, (60 - c.level) / 205));
    el("path", { d: c.d, style: `fill:none;stroke:currentColor;stroke-opacity:${op.toFixed(2)};stroke-width:0.9` }, g);
  }
  for (const m of MB_MINIMA) {
    el("circle", { cx: f.sx(m.x), cy: f.sy(m.y), r: 3, style: "fill:currentColor;fill-opacity:0.7" }, g);
    text(g, f.sx(m.x) + 6, f.sy(m.y) - 6, m.name, { class: "fill-foreground font-mono text-[11px]" });
  }
  return { f, g };
}

const ptStr = (p) => `(${fx(p[0], 3)}, ${fx(p[1], 3)})`;
const which = (p) => {
  const m = MB_MINIMA.find((q) => Math.hypot(q.x - p[0], q.y - p[1]) < 0.02);
  return m ? m.name : "none";
};

// ============================================================ 5 Optimisers

for (const root of document.querySelectorAll("[data-cc-min]")) {
  const svg = plot(root), o = outs(root), rand = rng(5);
  let start = [-0.75, 0.0];
  svg.setAttribute("tabindex", "0");

  function draw() {
    svg.replaceChildren();
    const { f, g } = surface(svg, [44, 18, 480, 420]);
    const runs = [["sd", C.j], ["cg", C.u], ["bfgs", C.brand]].map(([m, color]) => ({ m, color, r: optimise(m, start[0], start[1]) }));
    for (const { r, color, m } of runs) {
      polyline(g, r.pts.map((p) => [f.sx(p[0]), f.sy(p[1])]), `stroke:${color};stroke-width:${m === "bfgs" ? 2 : 1.5};stroke-linejoin:round`);
      for (const p of r.pts) el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 1.8, style: `fill:${color}` }, g);
    }
    el("circle", { cx: f.sx(start[0]), cy: f.sy(start[1]), r: 6, style: `fill:var(--background);stroke:${C.fg};stroke-width:2` }, svg);
    o.start.textContent = `${ptStr(start)}, E = ${fx(mbV(...start), 1)}`;
    for (const { m, r } of runs) o[m].textContent = `${r.iters} steps, ${r.grads} gradients, ${r.energies} energies`;
    const ends = runs.map(({ r }) => which(r.end));
    const E = runs[2].r;
    o.min.textContent = ends.every((e) => e === ends[0]) ? `${ends[0]} at ${ptStr(E.end)}, E = ${fx(E.E, 2)}` : `different: ${ends.join(", ")}`;
    const sd = runs[0].r.iters, bf = runs[2].r.iters;
    o.note.textContent = ends.every((e) => e === ends[0])
      ? `All three stop where the gradient falls below 10⁻³. BFGS took ${bf} steps against ${sd} for steepest descent: after a few steps its Hessian estimate captures the shape of the valley, so its steps head down the valley floor instead of across it.`
      : "Started near a ridge, the methods fall into different basins: an optimiser finds a minimum, not the minimum. Global searches restart from many points or anneal.";
  }

  const pick = (e) => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const px = ((e.clientX - r.left) / r.width) * vb.width, py = ((e.clientY - r.top) / r.height) * vb.height;
    const x = MB_VIEW.x[0] + ((px - 44) / 480) * (MB_VIEW.x[1] - MB_VIEW.x[0]);
    const y = MB_VIEW.y[1] - ((py - 18) / 420) * (MB_VIEW.y[1] - MB_VIEW.y[0]);
    if (x < MB_VIEW.x[0] || x > MB_VIEW.x[1] || y < MB_VIEW.y[0] || y > MB_VIEW.y[1]) return;
    start = [x, y];
    draw();
  };
  svg.addEventListener("click", pick);
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    start = [Math.max(MB_VIEW.x[0], Math.min(MB_VIEW.x[1], start[0] + d[0])), Math.max(MB_VIEW.y[0], Math.min(MB_VIEW.y[1], start[1] + d[1]))];
    draw();
  });
  root.querySelector("[data-action=random]").addEventListener("click", () => {
    start = [MB_VIEW.x[0] + rand() * (MB_VIEW.x[1] - MB_VIEW.x[0]), MB_VIEW.y[0] + rand() * (MB_VIEW.y[1] - MB_VIEW.y[0])];
    draw();
  });
  draw();
}

// ============================================================ 6 Elastic band

// Converged climbing-image saddles of this surface (checked offline to 10⁻³).
const SADDLES = { AB: { x: -0.822, y: 0.624 }, BC: { x: 0.212, y: 0.293 } };
const ENDS = { AB: [MB_MINIMA[0], MB_MINIMA[1]], BC: [MB_MINIMA[1], MB_MINIMA[2]] };

for (const root of document.querySelectorAll("[data-cc-neb]")) {
  const svg = plot(root), psvg = plot(root, "profile"), o = outs(root);
  const btn = root.querySelector("[data-action=play]"), show = playButton(btn);
  let rx = "AB", P, iter, last, climb = toggled(root, "climb");
  let playing = !reduced(), visible = false, raf = 0;
  const resume = () => { playing = true; show(true); kick(); };
  const s = scrubAll(root, (name) => { if (name === "n") { reset(); resume(); } else { draw(); resume(); } });
  onSeg(root, (_, v) => { rx = v; reset(); resume(); });
  onToggle(root, (_, on) => { climb = on; draw(); resume(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { reset(); resume(); });

  function reset() {
    const [a, b] = ENDS[rx];
    P = nebInit(a, b, Math.round(s.n.get()));
    iter = 0; last = null;
    draw();
    kick();
  }

  function draw() {
    svg.replaceChildren();
    const { f, g } = surface(svg, [44, 18, 480, 420]);
    const sad = SADDLES[rx];
    el("path", { d: `M${f.sx(sad.x) - 5} ${f.sy(sad.y) - 5}l10 10m0 -10l-10 10`, style: "stroke:currentColor;stroke-width:1.5;stroke-opacity:0.7" }, g);
    polyline(g, P.map((p) => [f.sx(p[0]), f.sy(p[1])]), `stroke:${C.brand};stroke-width:1.5;stroke-opacity:0.7`);
    const E = P.map((p) => mbV(p[0], p[1])), top = E.slice(1, -1).indexOf(Math.max(...E.slice(1, -1))) + 1;
    P.forEach((p, i) => el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: i === top && climb ? 5.5 : 3.5, style: `fill:${i === top && climb ? C.brand : "var(--background)"};stroke:${C.brand};stroke-width:1.75` }, g));
    // Energy profile against arc length along the band.
    psvg.replaceChildren();
    const d = [0];
    for (let i = 1; i < P.length; i++) d.push(d[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const lo = Math.min(...E), hi = Math.max(...E, mbV(sad.x, sad.y));
    const pf = frame(psvg, { box: [50, 18, 290, 200], x: [0, d.at(-1)], y: [lo - 8, hi + 12], xticks: ticks(0, d.at(-1), 4), yticks: ticks(lo - 8, hi + 12, 5), xfmt: tickFmt, yfmt: tickFmt, xlabel: "distance along band", ylabel: "energy" });
    const pg = clipped(psvg, pf);
    el("line", { x1: pf.L, x2: pf.L + pf.W, y1: pf.sy(mbV(sad.x, sad.y)), y2: pf.sy(mbV(sad.x, sad.y)), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4" }, pg);
    text(pg, pf.L + 4, pf.sy(mbV(sad.x, sad.y)) - 4, `saddle ${fx(mbV(sad.x, sad.y), 2)}`);
    polyline(pg, d.map((t, i) => [pf.sx(t), pf.sy(E[i])]), `stroke:${C.brand};stroke-width:1.75`);
    d.forEach((t, i) => el("circle", { cx: pf.sx(t), cy: pf.sy(E[i]), r: 3, style: `fill:${C.brand}` }, pg));
    const fmax = last ? last.fmax : NaN;
    o.iter.textContent = String(iter);
    o.fmax.textContent = Number.isFinite(fmax) ? fx(fmax, 3) : "—";
    o.top.textContent = `image ${top} at ${ptStr(P[top])}`;
    o.barrier.textContent = `${fx(E[top] - E[0], 2)}  (E = ${fx(E[top], 2)})`;
    o.saddle.textContent = `${ptStr([sad.x, sad.y])}, E = ${fx(mbV(sad.x, sad.y), 2)}`;
    const err = Math.hypot(P[top][0] - sad.x, P[top][1] - sad.y);
    o.note.textContent = iter < 50
      ? "The band starts as a bowed line between the minima, cutting across the hillside. Each image moves along the force perpendicular to the band, so the band slides downhill sideways while the springs keep the spacing even."
      : climb
        ? (err < 0.01 ? `Converged: the climbing image sits on the saddle point to within ${fx(err, 4)}, so the barrier ${fx(E[top] - E[0], 2)} is exact for this surface, not an interpolation between images.` : "The climbing image is still working its way up the path to the saddle point.")
        : `Without climbing, the highest image only lands near the saddle, and the barrier read from it (${fx(E[top] - E[0], 2)}) is ${fx(mbV(sad.x, sad.y) - E[top], 2)} too low. Switch on the climbing image to refine it.`;
  }

  const redraw = batched(draw);
  const step = () => {
    raf = 0;
    if (!playing || !visible) return;
    for (let k = 0; k < 60; k++) { last = nebStep(P, { k: s.k.get(), climb }); P = last.P; iter++; }
    redraw();
    if (iter < 20000 && !(last.fmax < 0.05 && iter > 200)) raf = requestAnimationFrame(step);
    else { playing = false; show(false); }
  };
  function kick() { if (playing && visible && !raf) raf = requestAnimationFrame(step); }
  btn.addEventListener("click", () => { playing = !playing; show(playing); kick(); });
  onScreen(root, (v) => { visible = v; kick(); });
  show(playing);
  reset();
}
