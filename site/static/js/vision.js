// Computer vision blocks, part one: Canny, Hough, Harris, histogram and
// Otsu, connected components. Images are generated here; every stage is
// computed from its definition on Float32Array grey images.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import {
  outs, minus, mulberry32, gauss, seg, onToggle, palette, onTheme, paintGray, paintRGB, mix,
  svgEl, overlay, blur, sobel, pixelAt,
} from "./vision-core.js";

// Clips the infinite line through p with direction d to the W × H box.
function clipLine(p, d, W, H) {
  let t0 = -1e9, t1 = 1e9;
  for (const [pc, dc, lo, hi] of [[p[0], d[0], 0, W], [p[1], d[1], 0, H]]) {
    if (Math.abs(dc) < 1e-12) { if (pc < lo || pc > hi) return null; continue; }
    let a = (lo - pc) / dc, b = (hi - pc) / dc;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (t0 >= t1) return null;
  return [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]];
}

// Point in polygon (even-odd).
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Renders filled shapes [{ pts | disc, v }] over a background with 2 × 2
// supersampling, so edges are antialiased like a real photo.
function rasterize(W, H, bgFn, shapes) {
  const out = new Float32Array(W * H);
  const sub = [0.25, 0.75];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let acc = 0;
    for (const sy of sub) for (const sx of sub) {
      const px = x + sx, py = y + sy;
      let v = bgFn(px, py);
      for (const s of shapes) {
        if (s.disc ? (px - s.disc[0]) ** 2 + (py - s.disc[1]) ** 2 < s.disc[2] ** 2 : inside(s.pts, px, py)) v = s.v;
      }
      acc += v;
    }
    out[y * W + x] = acc / 4;
  }
  return out;
}

// ---------------------------------------------------------------- Canny

for (const root of document.querySelectorAll("[data-cv-canny]")) {
  const o = outs(root);
  const W = 160, H = 120;
  const cin = root.querySelector('[data-canvas="in"]'), cout = root.querySelector('[data-canvas="out"]');
  const caption = root.querySelector('[data-caption="out"]');
  const legends = { dir: root.querySelector('[data-legend="dir"]'), edges: root.querySelector('[data-legend="edges"]') };
  let pal = palette();
  const stage = seg(root, "stage", () => draw());
  const s = scrubAll(root, (name) => { if (name === "noise") makeScene(); draw(); });

  const clean = rasterize(W, H, (x, y) => 70 + (x / W) * 30, [
    { pts: [[18, 18], [70, 18], [70, 58], [18, 58]], v: 175 },
    { disc: [112, 40, 22], v: 215 },
    { pts: [[30, 108], [62, 70], [94, 108]], v: 130 },
    { pts: [[110, 74], [146, 84], [138, 112], [102, 102]], v: 30 },
    { pts: [[40, 30], [58, 30], [58, 46], [40, 46]], v: 120 },
  ]);
  let src;
  const makeScene = () => {
    const rng = mulberry32(17), sd = s.noise.get();
    src = clean.map((v) => v + sd * gauss(rng));
    paintGray(cin, src, W, H);
  };

  function draw() {
    const st = stage();
    const b = blur(src, W, H, s.sigma.get());
    const { gx, gy } = sobel(b, W, H);
    const mag = new Float32Array(W * H), bin = new Uint8Array(W * H);
    let mmax = 1e-9;
    for (let i = 0; i < W * H; i++) {
      mag[i] = Math.hypot(gx[i], gy[i]);
      mmax = Math.max(mmax, mag[i]);
      let a = (Math.atan2(gy[i], gx[i]) * 180) / Math.PI;
      if (a < 0) a += 180;
      bin[i] = Math.round(a / 45) % 4; // 0: 0°, 1: 45°, 2: 90°, 3: 135°
    }
    // Non-maximum suppression along the gradient's bin direction.
    const steps = [[1, 0], [1, 1], [0, 1], [-1, 1]];
    const thin = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, [dx, dy] = steps[bin[i]];
      const m = mag[i];
      if (m >= mag[(y + dy) * W + x + dx] && m > mag[(y - dy) * W + x - dx]) thin[i] = m;
    }
    // Hysteresis: grow from strong pixels through weak 8-neighbours.
    const hi = s.high.get(), lo = Math.min(s.low.get(), hi);
    const state = new Uint8Array(W * H); // 0 none, 1 weak, 2 strong, 3 weak kept
    const stack = [];
    let strong = 0, weak = 0;
    for (let i = 0; i < W * H; i++) {
      if (thin[i] >= hi) { state[i] = 2; stack.push(i); strong++; } else if (thin[i] >= lo) { state[i] = 1; weak++; }
    }
    let kept = 0;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (state[j] === 1) { state[j] = 3; kept++; stack.push(j); }
      }
    }

    const binCol = [pal.u, pal.v, pal.brand, pal.out];
    if (st === "blur") paintGray(cout, b, W, H);
    else if (st === "mag") paintRGB(cout, W, H, (x, y, i) => mix(pal.bg, pal.fg, Math.min(1, mag[i] / (mmax * 0.6))));
    else if (st === "dir") paintRGB(cout, W, H, (x, y, i) => mix(pal.bg, binCol[bin[i]], Math.min(1, mag[i] / (mmax * 0.35))));
    else if (st === "nms") paintRGB(cout, W, H, (x, y, i) => mix(pal.bg, pal.fg, Math.min(1, thin[i] / (mmax * 0.5))));
    else paintRGB(cout, W, H, (x, y, i) => state[i] === 2 ? pal.fg : state[i] === 3 ? pal.brand : state[i] === 1 ? mix(pal.bg, pal.muted, 0.55) : pal.bg);
    caption.textContent = {
      blur: `1 · Gaussian blur, σ = ${num(s.sigma.get(), 1)} px`,
      mag: "2 · gradient magnitude |∇I| from Sobel",
      dir: "3 · gradient direction, 4 bins",
      nms: "4 · non-maximum suppression: ridges one pixel wide",
      edges: "5 · hysteresis: final edges",
    }[st];
    legends.dir.hidden = st !== "dir";
    legends.edges.hidden = st !== "edges";
    o.edges.textContent = strong + kept;
    o.strong.textContent = strong;
    o.kept.textContent = kept;
    o.dropped.textContent = weak - kept;
  }
  onTheme(() => { pal = palette(); draw(); });
  makeScene();
  draw();
}

// ---------------------------------------------------------------- Hough

for (const root of document.querySelectorAll("[data-cv-hough]")) {
  const o = outs(root);
  const W = 140, H = 140, D = Math.ceil(Math.hypot(W, H) / 2), RB = 2; // ρ in [−D, D], bins of 2 px
  const NT = 180, NR = Math.floor((2 * D) / RB) + 1;
  const cimg = root.querySelector('[data-canvas="img"]'), cacc = root.querySelector('[data-canvas="acc"]');
  const oimg = root.querySelector('[data-overlay="img"]'), oacc = root.querySelector('[data-overlay="acc"]');
  const cos = Float64Array.from({ length: NT }, (_, t) => Math.cos((t * Math.PI) / NT));
  const sin = Float64Array.from({ length: NT }, (_, t) => Math.sin((t * Math.PI) / NT));
  let pal = palette(), seed = 4, planted = [], edges = [], acc = new Uint16Array(NT * NR), pick = null;
  const s = scrubAll(root, (name) => { if (["lines", "clutter", "gap"].includes(name)) makeScene(); detect(); });

  const lineEnds = (thetaDeg, rho) => {
    const t = (thetaDeg * Math.PI) / 180, c = Math.cos(t), sn = Math.sin(t);
    return clipLine([W / 2 + rho * c, H / 2 + rho * sn], [-sn, c], W, H);
  };

  function makeScene() {
    const rng = mulberry32(seed);
    const on = new Uint8Array(W * H);
    planted = [];
    for (let k = 0; k < s.lines.get(); k++) {
      const th = rng() * 180, rho = (rng() - 0.5) * 1.1 * D;
      planted.push([th, rho]);
      const seg = lineEnds(th, rho);
      if (!seg) continue;
      const [a, b] = seg, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d < len; d += 8) {
        if (rng() * 100 < s.gap.get()) continue;
        for (let e = d; e < Math.min(len, d + 8); e += 0.5) {
          const x = Math.floor(a[0] + ((b[0] - a[0]) * e) / len), y = Math.floor(a[1] + ((b[1] - a[1]) * e) / len);
          if (x >= 0 && y >= 0 && x < W && y < H) on[y * W + x] = 1;
        }
      }
    }
    for (let k = 0; k < s.clutter.get(); k++) on[Math.floor(rng() * H) * W + Math.floor(rng() * W)] = 1;
    edges = [];
    for (let i = 0; i < W * H; i++) if (on[i]) edges.push(i);
    acc = new Uint16Array(NT * NR);
    for (const i of edges) {
      const x = (i % W) + 0.5 - W / 2, y = ((i / W) | 0) + 0.5 - H / 2;
      for (let t = 0; t < NT; t++) acc[Math.round((x * cos[t] + y * sin[t] + D) / RB) * NT + t]++;
    }
    pick = null;
    paintRGB(cimg, W, H, (x, y, i) => (on[i] ? pal.fg : pal.bg));
    let amax = 1;
    for (const v of acc) amax = Math.max(amax, v);
    const L = Math.log1p(amax);
    paintRGB(cacc, NT, NR, (x, y, i) => mix(pal.bg, pal.fg, Math.log1p(acc[i]) / L));
    o.n.textContent = edges.length;
    o.size.textContent = `${NT} θ × ${NR} ρ`;
  }

  function detect() {
    // Peaks: local maxima in a ±5 θ, ±3 ρ window, strongest first.
    const cands = [];
    for (let r = 0; r < NR; r++) for (let t = 0; t < NT; t++) {
      const v = acc[r * NT + t];
      if (v < s.minvotes.get()) continue;
      let best = true;
      for (let dr = -3; dr <= 3 && best; dr++) for (let dt = -5; dt <= 5; dt++) {
        const rr = r + dr;
        let tt = t + dt;
        if (rr < 0 || rr >= NR) continue;
        let rIdx = rr;
        if (tt < 0 || tt >= NT) { tt = (tt + NT) % NT; rIdx = NR - 1 - rr; } // θ wraps with ρ flipped
        const w = acc[rIdx * NT + tt];
        if (w > v || (w === v && (dr < 0 || (dr === 0 && dt < 0)))) { best = false; break; }
      }
      if (best) cands.push([v, t, r]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    const peaks = cands.slice(0, s.peaks.get());
    overlay(oimg, W, H); overlay(oacc, NT, NR);
    const drawLine = (th, rho, color, w) => {
      const seg = lineEnds(th, rho);
      if (seg) svgEl("line", { x1: seg[0][0], y1: seg[0][1], x2: seg[1][0], y2: seg[1][1], stroke: color, "stroke-width": w, "vector-effect": "non-scaling-stroke", "stroke-linecap": "round" }, oimg);
    };
    for (const [, t, r] of peaks) {
      drawLine(t, r * RB - D, "var(--brand)", 2);
      svgEl("circle", { cx: t + 0.5, cy: r + 0.5, r: 5, fill: "none", stroke: "var(--brand)", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, oacc);
    }
    if (pick) {
      drawLine(pick[0], pick[1] * RB - D, "var(--vec-u)", 2);
      svgEl("rect", { x: pick[0] - 2, y: pick[1] - 2, width: 5, height: 5, fill: "none", stroke: "var(--vec-u)", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, oacc);
    }
    o.best.textContent = peaks.length ? `${peaks[0][0]} votes at θ ${peaks[0][1]}°, ρ ${minus(peaks[0][2] * RB - D)}` : "none above min votes";
    o.pick.textContent = pick ? `${acc[pick[1] * NT + pick[0]]} votes at θ ${pick[0]}°, ρ ${minus(pick[1] * RB - D)}` : "click the accumulator";
    // A planted line is found if a peak is within 3° and 4 px (allowing the θ wrap).
    let found = 0;
    for (const [th, rho] of planted) {
      if (peaks.some(([, t, r]) => {
        const pr = r * RB - D;
        const dt = Math.abs(t - th);
        return (dt <= 3 && Math.abs(pr - rho) <= 4) || (180 - dt <= 3 && Math.abs(pr + rho) <= 4);
      })) found++;
    }
    o.found.textContent = `${found} of ${planted.length}`;
  }

  cacc.addEventListener("click", (e) => {
    const [x, y] = pixelAt(e, cacc, NT, NR);
    pick = [Math.min(NT - 1, Math.max(0, Math.floor(x))), Math.min(NR - 1, Math.max(0, Math.floor(y)))];
    detect();
  });
  root.querySelector('[data-action="new"]').addEventListener("click", () => { seed++; makeScene(); detect(); });
  onTheme(() => { pal = palette(); makeScene(); detect(); });
  makeScene();
  detect();
}

// ---------------------------------------------------------------- Harris

for (const root of document.querySelectorAll("[data-cv-harris]")) {
  const o = outs(root);
  const W = 128, H = 128;
  const cimg = root.querySelector('[data-canvas="img"]'), cresp = root.querySelector('[data-canvas="resp"]');
  const oimg = root.querySelector('[data-overlay="img"]');
  let pal = palette(), M = null, R = null, lamMax = 1, img = null;
  const s = scrubAll(root, (name) => { if (name === "rot" || name === "noise") makeScene(); compute(); });

  // Shapes in a centred frame, rotated as a whole.
  const shapes = [
    { pts: [[-46, -44], [-14, -44], [-14, -20], [-46, -20]], v: 200 },
    { pts: [[8, -46], [44, -18], [4, -14]], v: 160 },
    { pts: [[-44, 6], [-30, 6], [-30, 30], [-10, 30], [-10, 42], [-44, 42]], v: 215 },
  ];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if ((i + j) % 2) continue;
    const x = 8 + i * 12, y = 8 + j * 12;
    shapes.push({ pts: [[x, y], [x + 12, y], [x + 12, y + 12], [x, y + 12]], v: 190 });
  }

  function makeScene() {
    const a = (s.rot.get() * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    const rotated = shapes.map((sh) => ({ v: sh.v, pts: sh.pts.map(([x, y]) => [W / 2 + x * c - y * sn, H / 2 + x * sn + y * c]) }));
    const rng = mulberry32(5), sd = s.noise.get();
    img = rasterize(W, H, () => 60, rotated).map((v) => v + sd * gauss(rng));
    paintGray(cimg, img, W, H);
  }

  function compute() {
    const { gx, gy } = sobel(blur(img, W, H, 0.7), W, H);
    const xx = new Float32Array(W * H), yy = new Float32Array(W * H), xy = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { xx[i] = gx[i] * gx[i]; yy[i] = gy[i] * gy[i]; xy[i] = gx[i] * gy[i]; }
    const sw = s.win.get();
    M = [blur(xx, W, H, sw), blur(yy, W, H, sw), blur(xy, W, H, sw)];
    const k = s.k.get();
    R = new Float32Array(W * H);
    let rmax = 1e-9, rmin = -1e-9;
    lamMax = 1e-9;
    for (let i = 0; i < W * H; i++) {
      const a = M[0][i], b = M[1][i], c = M[2][i];
      const det = a * b - c * c, tr = a + b;
      R[i] = det - k * tr * tr;
      rmax = Math.max(rmax, R[i]); rmin = Math.min(rmin, R[i]);
      lamMax = Math.max(lamMax, tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)));
    }
    const thr = (s.thr.get() / 100) * rmax;
    const corners = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x, v = R[i];
      if (v < thr) continue;
      let best = true;
      for (let dy = -2; dy <= 2 && best; dy++) for (let dx = -2; dx <= 2; dx++) {
        const w = R[i + dy * W + dx];
        if (w > v || (w === v && dy * W + dx < 0)) { best = false; break; }
      }
      if (best) corners.push([x, y]);
    }
    paintRGB(cresp, W, H, (x, y, i) => R[i] > 0 ? mix(pal.bg, pal.brand, Math.sqrt(R[i] / rmax)) : mix(pal.bg, pal.u, Math.sqrt(R[i] / rmin)));
    overlay(oimg, W, H);
    for (const [x, y] of corners) svgEl("circle", { cx: x + 0.5, cy: y + 0.5, r: 3, fill: "none", stroke: "var(--brand)", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }, oimg);
    o.n.textContent = corners.length;
  }

  cimg.addEventListener("pointermove", (e) => {
    const [px, py] = pixelAt(e, cimg, W, H);
    const x = Math.min(W - 1, Math.max(0, Math.floor(px))), y = Math.min(H - 1, Math.max(0, Math.floor(py)));
    const i = y * W + x, a = M[0][i], b = M[1][i], c = M[2][i];
    const tr = a + b, det = a * b - c * c, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    o.lam.textContent = `${num(l1, 0)}, ${num(l2, 0)}`;
    o.r.textContent = minus(R[i].toExponential(2));
    o.cls.textContent = l1 < 0.02 * lamMax ? "flat: both small" : l2 < 0.15 * l1 ? "edge: one large" : "corner: both large";
  });
  onTheme(() => { pal = palette(); compute(); });
  makeScene();
  compute();
}

// ---------------------------------------------------------------- Histogram and Otsu

for (const root of document.querySelectorAll("[data-cv-histogram]")) {
  const o = outs(root);
  const W = 160, H = 120;
  const cimg = root.querySelector('[data-canvas="img"]'), caption = root.querySelector('[data-caption="img"]');
  const svg = root.querySelector('[data-plot="hist"]');
  let pal = palette();
  const view = seg(root, "view", () => draw());
  const s = scrubAll(root, () => draw());
  const mask = rasterize(W, H, () => 0, [
    { disc: [44, 46, 24], v: 1 },
    { pts: [[86, 20], [140, 26], [134, 70], [92, 62]], v: 1 },
    { disc: [110, 96, 14], v: 1 },
    { pts: [[18, 82], [62, 82], [62, 108], [18, 108]], v: 1 },
  ]);
  const rngBase = mulberry32(23), noise = Float32Array.from({ length: W * H }, () => gauss(rngBase));

  function draw() {
    const bg = s.bg.get(), fg = s.fg.get(), sd = s.noise.get(), shade = s.shade.get();
    const img = new Float32Array(W * H), q = new Uint8Array(W * H);
    const hist = new Float64Array(256);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const v = bg + (fg - bg) * mask[i] + sd * noise[i] + shade * (x / (W - 1) - 0.5) * 2;
      img[i] = v;
      q[i] = Math.max(0, Math.min(255, Math.round(v)));
      hist[q[i]]++;
    }
    const N = W * H;
    // Otsu: maximise between-class variance over all thresholds.
    let total = 0;
    for (let g = 0; g < 256; g++) total += g * hist[g];
    const mu = total / N;
    let varT = 0;
    for (let g = 0; g < 256; g++) varT += hist[g] * (g - mu) ** 2;
    varT /= N;
    const sb = new Float64Array(256);
    let w0 = 0, sum0 = 0, best = 0, bt = 0;
    for (let t = 0; t < 256; t++) {
      w0 += hist[t]; sum0 += t * hist[t];
      const w1 = N - w0;
      if (w0 === 0 || w1 === 0) continue;
      const m0 = sum0 / w0, m1 = (total - sum0) / w1;
      sb[t] = (w0 / N) * (w1 / N) * (m0 - m1) ** 2;
      if (sb[t] > best) { best = sb[t]; bt = t; }
    }
    let n0 = 0, s0 = 0;
    for (let g = 0; g <= bt; g++) { n0 += hist[g]; s0 += g * hist[g]; }
    const m0 = s0 / Math.max(1, n0), m1 = (total - s0) / Math.max(1, N - n0);
    // Equalisation through the cumulative histogram.
    const cdf = new Float64Array(256);
    let c = 0;
    for (let g = 0; g < 256; g++) { c += hist[g]; cdf[g] = c / N; }
    let cmin = 0;
    for (let g = 0; g < 256; g++) if (hist[g]) { cmin = cdf[g]; break; }
    const eqMap = cdf.map((v) => Math.round(((v - cmin) / Math.max(1e-9, 1 - cmin)) * 255));
    // Accuracy against the true mask, with the object on its brighter or darker side.
    const objBright = fg >= bg;
    let right = 0;
    for (let i = 0; i < N; i++) if ((q[i] > bt) === (objBright ? mask[i] > 0.5 : mask[i] <= 0.5)) right++;

    const v = view();
    let shown = q, sh = hist;
    if (v === "eq") {
      shown = q.map((g) => eqMap[g]);
      sh = new Float64Array(256);
      for (const g of shown) sh[g]++;
    }
    if (v === "otsu") {
      paintRGB(cimg, W, H, (x, y, i) => {
        const on = q[i] > bt, truth = objBright ? mask[i] > 0.5 : mask[i] <= 0.5;
        return on !== truth ? pal.del : on ? pal.fg : pal.bg;
      });
      caption.textContent = `pixels > ${bt} · red: labelled wrong`;
    } else {
      paintGray(cimg, shown, W, H);
      caption.textContent = v === "eq" ? "equalised: grey g → 255 · CDF(g)" : "original (generated)";
    }

    svg.replaceChildren();
    const f = frame(svg, { box: [36, 18, 370, 250], x: [0, 255], y: [0, 1], xticks: [0, 64, 128, 192, 255], yticks: [0, 0.5, 1], yfmt: (t) => (t ? num(t, 1) : "0"), xlabel: "grey level", ylabel: "share (scaled)" });
    let hmax = 1;
    for (const x of sh) hmax = Math.max(hmax, x);
    const bars = el("path", { d: [...sh].map((x, g) => x ? `M${f.sx(g)},${f.sy(0)}V${f.sy(x / hmax)}` : "").join(""), style: "stroke:currentColor;stroke-width:1.4;stroke-opacity:0.8" }, svg);
    bars.setAttribute("class", "text-foreground");
    let cc = 0;
    const scdf = [...sh].map((x, g) => { cc += x; return [f.sx(g), f.sy(cc / N)]; });
    polyline(svg, scdf, "stroke:var(--vec-u);stroke-width:2");
    if (v !== "eq") {
      polyline(svg, [...sb].map((x, g) => [f.sx(g), f.sy(best ? x / best : 0)]), "stroke:var(--brand);stroke-width:2;stroke-opacity:0.85");
      el("line", { x1: f.sx(bt), x2: f.sx(bt), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:4 3" }, svg);
      text(svg, f.sx(bt), f.T - 6, `t = ${bt}`, { "text-anchor": "middle", style: "fill:var(--brand)" });
    }
    o.t.textContent = bt;
    o.means.textContent = `${num(m0, 1)}, ${num(m1, 1)}`;
    o.eta.textContent = num(varT ? best / varT : 0, 3);
    o.acc.textContent = `${num((100 * right) / N, 1)}%`;
  }
  onTheme(() => { pal = palette(); draw(); });
  draw();
}

// ---------------------------------------------------------------- Connected components

for (const root of document.querySelectorAll("[data-cv-components]")) {
  const o = outs(root);
  const GW = 40, GH = 28;
  const canvas = root.querySelector('[data-canvas="grid"]');
  canvas.style.aspectRatio = `${GW} / ${GH}`;
  let pal = palette(), cells = new Uint8Array(GW * GH), showFirst = false, seed = 3;
  const conn = seg(root, "conn", () => draw());
  onToggle(root, (name, on) => { if (name === "first") { showFirst = on; draw(); } });

  function randomize() {
    const rng = mulberry32(seed++);
    cells.fill(0);
    const put = (x, y) => { if (x >= 0 && y >= 0 && x < GW && y < GH) cells[y * GW + x] = 1; };
    for (let k = 0; k < 9; k++) {
      const cx = 2 + rng() * (GW - 4), cy = 2 + rng() * (GH - 4), r = 1.2 + rng() * 2.6;
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= r * r) put(Math.round(cx + x), Math.round(cy + y));
    }
    // Diagonal staircases: joined only under 8-connectivity.
    for (let k = 0; k < 3; k++) {
      let x = Math.floor(rng() * (GW - 8)), y = Math.floor(rng() * (GH - 6));
      const dx = rng() < 0.5 ? 1 : -1;
      if (dx < 0) x += 6;
      for (let j = 0; j < 5; j++) { put(x, y); x += dx; y++; }
    }
    draw();
  }

  // A U shape (two provisional labels that merge) and a diagonal pair of blobs.
  function preset() {
    cells.fill(0);
    const box = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells[y * GW + x] = 1; };
    box(3, 4, 5, 20); box(12, 4, 14, 20); box(3, 18, 14, 20);
    box(20, 4, 25, 9); box(26, 10, 31, 15);
    box(20, 18, 23, 24); box(27, 19, 29, 21); box(33, 3, 37, 24);
    for (let y = 9; y <= 12; y++) for (let x = 34; x <= 36; x++) cells[y * GW + x] = 0; // a ring: one component with a hole
    draw();
  }

  function label() {
    const eight = conn() === "8";
    const lab = new Int32Array(GW * GH), parent = [0];
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    let merges = 0;
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) { parent[Math.max(a, b)] = Math.min(a, b); merges++; } };
    const nb = eight ? [[-1, 0], [-1, -1], [0, -1], [1, -1]] : [[-1, 0], [0, -1]];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (!cells[i]) continue;
      const ls = [];
      for (const [dx, dy] of nb) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < GW && lab[yy * GW + xx]) ls.push(lab[yy * GW + xx]);
      }
      if (!ls.length) { parent.push(parent.length); lab[i] = parent.length - 1; } else {
        const m = Math.min(...ls);
        lab[i] = m;
        for (const l of ls) union(m, l);
      }
    }
    const first = Int32Array.from(lab);
    const rename = new Map(), sizes = [];
    for (let i = 0; i < lab.length; i++) {
      if (!lab[i]) continue;
      const r = find(lab[i]);
      if (!rename.has(r)) { rename.set(r, rename.size + 1); sizes.push(0); }
      lab[i] = rename.get(r);
      sizes[lab[i] - 1]++;
    }
    return { first, lab, prov: parent.length - 1, merges, n: rename.size, largest: sizes.length ? Math.max(...sizes) : 0 };
  }

  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cw = Math.max(GW, Math.round((r.width || 640) * dpr));
    canvas.width = cw; canvas.height = Math.round((cw * GH) / GW);
    const ctx = canvas.getContext("2d"), cs = canvas.width / GW;
    const L = label(), shown = showFirst ? L.first : L.lab;
    const cols = [pal.brand, pal.u, pal.v, pal.out, pal.add];
    const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    ctx.fillStyle = css(pal.bg);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = css(pal.fg, 0.07);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GW; x++) { ctx.moveTo(Math.round(x * cs) + 0.5, 0); ctx.lineTo(Math.round(x * cs) + 0.5, canvas.height); }
    for (let y = 0; y <= GH; y++) { ctx.moveTo(0, Math.round(y * cs) + 0.5); ctx.lineTo(canvas.width, Math.round(y * cs) + 0.5); }
    ctx.stroke();
    const showNums = cs / dpr >= 11;
    ctx.font = `${Math.round(cs * 0.48)}px ui-monospace, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (!cells[i]) continue;
      ctx.fillStyle = css(mix(pal.bg, cols[(shown[i] - 1) % cols.length], 0.8));
      ctx.fillRect(x * cs + 1, y * cs + 1, cs - 1, cs - 1);
      if (showNums) { ctx.fillStyle = css(pal.bg); ctx.fillText(String(shown[i]), x * cs + cs / 2, y * cs + cs / 2 + 0.5); }
    }
    o.n.textContent = L.n;
    o.prov.textContent = L.prov;
    o.merges.textContent = L.merges;
    o.largest.textContent = L.largest ? `${L.largest} px` : "—";
  }

  let painting = null;
  const paintAt = (e) => {
    const [px, py] = pixelAt(e, canvas, GW, GH);
    const x = Math.floor(px), y = Math.floor(py);
    if (x < 0 || y < 0 || x >= GW || y >= GH) return;
    if (cells[y * GW + x] !== painting) { cells[y * GW + x] = painting; draw(); }
  };
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    painting = e.shiftKey || e.button === 2 ? 0 : 1;
    canvas.setPointerCapture(e.pointerId);
    paintAt(e);
  });
  canvas.addEventListener("pointermove", (e) => { if (painting !== null) paintAt(e); });
  const stop = () => { painting = null; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  root.querySelector('[data-action="random"]').addEventListener("click", randomize);
  root.querySelector('[data-action="clear"]').addEventListener("click", () => { cells.fill(0); draw(); });
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
  preset();
}
