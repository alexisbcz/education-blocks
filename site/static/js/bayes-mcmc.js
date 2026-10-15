// Bayesian inference blocks, part three: Metropolis–Hastings and Hamiltonian
// Monte Carlo on two-dimensional targets, with traces, autocorrelation and
// effective sample size.

import { scrubAll } from "./scrub.js";
import {
  C, el, text, frame, polyline, num, neg, pct, outs, onAction, reduced, niceTicks, tickFmt,
  mulberry32, gauss, acf, ess, mean, sd, dots, contours, setPlaying, whenVisible,
} from "./bayes-math.js";

// Targets: log density (up to a constant) and its gradient. The banana is
// x ~ N(0, 1.5²), y | x ~ N(x²/2 − 1.5, 0.5²).
const rho9 = 0.9, rho95 = 0.95;
const corr = (r) => ({
  logp: (x, y) => -(x * x - 2 * r * x * y + y * y) / (2 * (1 - r * r)),
  grad: (x, y) => [-(x - r * y) / (1 - r * r), -(y - r * x) / (1 - r * r)],
});
const BA = 1 / 1.5 ** 2, BB = 1 / 0.5 ** 2;
const TARGETS = {
  normal: { logp: (x, y) => -(x * x + y * y) / 2, grad: (x, y) => [-x, -y] },
  corr: corr(rho9),
  corr95: corr(rho95),
  banana: {
    logp: (x, y) => { const u = y - (x * x / 2 - 1.5); return -(BA * x * x) / 2 - (BB * u * u) / 2; },
    grad: (x, y) => { const u = y - (x * x / 2 - 1.5); return [-BA * x + BB * u * x, -BB * u]; },
  },
};
const VIEW = [-4, 4];
// Contour levels at 1, 2 and 3 "sigmas" below the mode.
const LEVELS = [-0.5, -2, -4.5];

function scene(svg, target, box) {
  svg.replaceChildren();
  const f = frame(svg, { box, x: VIEW, y: VIEW, xticks: [-4, -2, 0, 2, 4], yticks: [-4, -2, 0, 2, 4], xfmt: tickFmt, yfmt: tickFmt, xlabel: "x", ylabel: "y" });
  contours(svg, target.logp, box, VIEW, VIEW, LEVELS, "stroke:var(--foreground);stroke-opacity:0.3;stroke-width:1");
  const layer = el("g", {}, svg);
  return { f, layer };
}

const inView = (x, y) => x > VIEW[0] && x < VIEW[1] && y > VIEW[0] && y < VIEW[1];

// ============================================================ Metropolis–Hastings

for (const root of document.querySelectorAll("[data-bayes-mh]")) {
  const svg = root.querySelector("[data-plot]"), tsvg = root.querySelector("[data-trace]"), asvg = root.querySelector("[data-acf]");
  const o = outs(root);
  const btn = root.querySelector('[data-action="play"]');
  let kind = "normal", rng, xs, ys, acc, tries, cx, cy, playing = false, visible = false, raf = 0, sc;
  const s = scrubAll(root, () => { if (!playing) redraw(); });

  function reset() {
    rng = mulberry32(42);
    cx = 3; cy = -3;
    xs = [cx]; ys = [cy]; acc = 0; tries = 0;
    sc = scene(svg, TARGETS[kind], [30, 10, 260, 260]);
    redraw();
  }
  function step(k) {
    const T = TARGETS[kind], w = s.w.get();
    let lp = T.logp(cx, cy);
    for (let i = 0; i < k; i++) {
      const px = cx + w * gauss(rng), py = cy + w * gauss(rng);
      const lq = T.logp(px, py);
      tries++;
      if (Math.log(rng()) < lq - lp) { cx = px; cy = py; lp = lq; acc++; }
      xs.push(cx); ys.push(cy);
    }
  }
  function redraw() {
    const { f, layer } = sc;
    layer.replaceChildren();
    const n = xs.length, from = Math.max(0, n - 4000);
    const pts = [];
    for (let i = from; i < n; i++) if (inView(xs[i], ys[i])) pts.push([f.sx(xs[i]), f.sy(ys[i])]);
    dots(layer, pts, `stroke:${C.post};stroke-width:3;stroke-opacity:0.35`);
    const tail = [];
    for (let i = Math.max(0, n - 40); i < n; i++) tail.push([f.sx(xs[i]), f.sy(ys[i])]);
    polyline(layer, tail, "stroke:var(--brand);stroke-width:1.25;stroke-opacity:0.9");
    el("circle", { cx: f.sx(cx), cy: f.sy(cy), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, layer);

    // Trace of the last 400 values of x.
    tsvg.replaceChildren();
    const tr = xs.slice(-400);
    const tf = frame(tsvg, { box: [30, 22, 260, 88], x: [0, 400], y: [-4, 4], xticks: [0, 100, 200, 300, 400], yticks: [-4, 0, 4], xfmt: (v) => (v === 400 ? "now" : neg(String(v - 400))), yfmt: tickFmt, xlabel: "iteration", ylabel: "x" });
    polyline(tsvg, tr.map((v, i) => [tf.sx(400 - tr.length + i), tf.sy(Math.max(-4, Math.min(4, v)))]), `stroke:${C.post};stroke-width:1`);

    // Autocorrelation after a 10% burn-in.
    asvg.replaceChildren();
    const kept = xs.slice(Math.floor(n / 10));
    const af = frame(asvg, { box: [30, 22, 260, 88], x: [-0.5, 40.5], y: [-0.2, 1], xticks: [0, 10, 20, 30, 40], yticks: [0, 0.5, 1], xfmt: tickFmt, yfmt: tickFmt, xlabel: "lag", ylabel: "autocorrelation" });
    if (kept.length > 50) {
      const r = acf(kept, 40);
      el("line", { x1: af.L, x2: af.L + af.W, y1: af.sy(0), y2: af.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, asvg);
      r.forEach((v, k) => el("line", { x1: af.sx(k), x2: af.sx(k), y1: af.sy(0), y2: af.sy(Math.max(-0.2, v)), style: `stroke:${C.post};stroke-width:3` }, asvg));
    }
    o.n.textContent = String(n - 1);
    o.acc.textContent = tries ? pct(acc / tries) : "—";
    if (kept.length > 50) {
      o.mx.textContent = neg(num(mean(kept), 3));
      o.sx.textContent = num(sd(kept), 3);
      o.ess.textContent = `${num(ess(kept), 0)} of ${kept.length}`;
    } else o.mx.textContent = o.sx.textContent = o.ess.textContent = "—";
  }
  const loop = () => {
    if (!playing || !visible) return;
    step(reduced() ? 200 : 8);
    redraw();
    raf = requestAnimationFrame(loop);
  };
  const setPlay = (on) => { playing = on; setPlaying(btn, on, ["Run", "Pause"]); cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(loop); };
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; reset(); });
  onAction(root, (act) => {
    if (act === "play") setPlay(!playing);
    else if (act === "burst") { step(1000); redraw(); }
    else if (act === "reset") { setPlay(false); reset(); }
  });
  whenVisible(root, (v) => { visible = v; if (v && playing) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } });
  reset();
  step(600);
  redraw();
}

// ============================================================ Hamiltonian Monte Carlo

for (const root of document.querySelectorAll("[data-bayes-hmc]")) {
  const hsvg = root.querySelector("[data-hmc]"), rsvg = root.querySelector("[data-rw]");
  const o = outs(root);
  const btn = root.querySelector('[data-action="play"]');
  let kind = "corr95", rng, H, RW, path, divergent, acc, iters, divs, lastDH, playing = false, visible = false, raf = 0, hs, rs;
  const s = scrubAll(root, () => {});
  const RW_SD = 0.25;

  function reset() {
    rng = mulberry32(7);
    const start = kind === "banana" ? [-2.5, 2] : [2.5, -2.5];
    H = { x: start[0], y: start[1], xs: [], ys: [] };
    RW = { x: start[0], y: start[1], xs: [], ys: [] };
    path = []; divergent = false; acc = 0; iters = 0; divs = 0; lastDH = NaN;
    hs = scene(hsvg, TARGETS[target()], [30, 10, 260, 260]);
    rs = scene(rsvg, TARGETS[target()], [30, 10, 260, 260]);
    text(hsvg, 290, 22, "HMC", { "text-anchor": "end" });
    text(rsvg, 290, 22, "random walk", { "text-anchor": "end" });
    redraw();
  }
  const target = () => (kind === "corr" ? "corr95" : kind);

  function iterate() {
    const T = TARGETS[target()], eps = s.eps.get(), L = s.L.get();
    // HMC: fresh momentum, L leapfrog steps, accept on the energy change.
    let x = H.x, y = H.y, px = gauss(rng), py = gauss(rng);
    const H0 = -T.logp(x, y) + (px * px + py * py) / 2;
    path = [[x, y]];
    let g = T.grad(x, y);
    px += (eps / 2) * g[0]; py += (eps / 2) * g[1];
    let bad = false;
    for (let i = 0; i < L; i++) {
      x += eps * px; y += eps * py;
      path.push([x, y]);
      g = T.grad(x, y);
      const last = i === L - 1;
      px += (last ? eps / 2 : eps) * g[0]; py += (last ? eps / 2 : eps) * g[1];
      if (!Number.isFinite(x + y + px + py) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) { bad = true; break; }
    }
    const H1 = bad ? Infinity : -T.logp(x, y) + (px * px + py * py) / 2;
    const dH = H1 - H0;
    lastDH = dH;
    divergent = bad || dH > 1000;
    if (divergent) divs++;
    else if (Math.log(rng()) < -dH) { H.x = x; H.y = y; acc++; }
    H.xs.push(H.x); H.ys.push(H.y);
    // Random walk with the same budget: L proposals, one density each.
    let lp = T.logp(RW.x, RW.y);
    for (let i = 0; i < L; i++) {
      const qx = RW.x + RW_SD * gauss(rng), qy = RW.y + RW_SD * gauss(rng), lq = T.logp(qx, qy);
      if (Math.log(rng()) < lq - lp) { RW.x = qx; RW.y = qy; lp = lq; }
    }
    RW.xs.push(RW.x); RW.ys.push(RW.y);
    iters++;
  }

  function redraw() {
    for (const [sc, C2, showPath] of [[hs, H, true], [rs, RW, false]]) {
      const { f, layer } = sc;
      layer.replaceChildren();
      const pts = [];
      for (let i = Math.max(0, C2.xs.length - 3000); i < C2.xs.length; i++) if (inView(C2.xs[i], C2.ys[i])) pts.push([f.sx(C2.xs[i]), f.sy(C2.ys[i])]);
      dots(layer, pts, `stroke:${C.post};stroke-width:3;stroke-opacity:0.4`);
      if (showPath && path.length > 1) {
        const clip = path.filter(([x, y]) => Math.abs(x) < 50 && Math.abs(y) < 50).map(([x, y]) => [f.sx(Math.max(-4, Math.min(4, x))), f.sy(Math.max(-4, Math.min(4, y)))]);
        const col = divergent ? "var(--vec-j)" : "var(--brand)";
        polyline(layer, clip, `stroke:${col};stroke-width:1.5`);
        dots(layer, clip, `stroke:${col};stroke-width:3.5`);
      }
      el("circle", { cx: f.sx(Math.max(-4, Math.min(4, C2.x))), cy: f.sy(Math.max(-4, Math.min(4, C2.y))), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, layer);
    }
    o.n.textContent = String(iters);
    o.acc.textContent = iters ? pct(acc / iters) : "—";
    o.dh.textContent = Number.isFinite(lastDH) ? num(Math.abs(lastDH), 3) : iters ? "∞" : "—";
    o.div.textContent = String(divs);
    o.ess.textContent = H.xs.length > 50 ? `${num(ess(H.xs), 0)} of ${H.xs.length}` : "—";
    o.essrw.textContent = RW.xs.length > 50 ? `${num(ess(RW.xs), 0)} of ${RW.xs.length}` : "—";
  }
  let tick = 0;
  const loop = () => {
    if (!playing || !visible) return;
    // A few iterations a second so each trajectory can be seen.
    if (reduced()) { for (let i = 0; i < 20; i++) iterate(); redraw(); }
    else if (++tick % 6 === 0) { iterate(); redraw(); }
    raf = requestAnimationFrame(loop);
  };
  const setPlay = (on) => { playing = on; setPlaying(btn, on, ["Run", "Pause"]); cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(loop); };
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; reset(); });
  onAction(root, (act) => {
    if (act === "play") setPlay(!playing);
    else if (act === "step") { iterate(); redraw(); }
    else if (act === "reset") { setPlay(false); reset(); }
  });
  whenVisible(root, (v) => { visible = v; if (v && playing) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } });
  reset();
  for (let i = 0; i < 150; i++) iterate();
  redraw();
}
