// GIS blocks, part two: choropleth classification, slope/aspect/hillshade,
// buffer-and-overlay site selection, quadtree indexing and Moran's I.
// Part one is gis.js; shared helpers live in gis-util.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, num } from "./plot.js";
import { outs, rng, gauss, fbm, seg, svgPoint, rgbOf, mix, onTheme, segDist, fmtInt } from "./gis-util.js";

const BRAND = "var(--brand)", BLUE = "var(--vec-u)";
const clear = (n) => n.replaceChildren();
const tint = (c, pct) => `color-mix(in oklab, ${c} ${pct.toFixed(0)}%, var(--background))`;

// ============================================================ Choropleth classes

// Fisher's exact optimal partition of sorted values into k classes,
// minimising the sum of squared deviations inside classes (Jenks breaks).
export function jenks(sorted, k) {
  const n = sorted.length, s1 = [0], s2 = [0];
  for (const v of sorted) { s1.push(s1.at(-1) + v); s2.push(s2.at(-1) + v * v); }
  const ssd = (i, j) => { const m = j - i + 1, s = s1[j + 1] - s1[i]; return s2[j + 1] - s2[i] - (s * s) / m; };
  let cost = Array.from({ length: n }, (_, j) => ssd(0, j));
  const from = [];
  for (let c = 1; c < k; c++) {
    const next = new Array(n).fill(Infinity), arg = new Array(n).fill(0);
    for (let j = c; j < n; j++) for (let i = c; i <= j; i++) {
      const v = cost[i - 1] + ssd(i, j);
      if (v < next[j]) { next[j] = v; arg[j] = i; }
    }
    from.push(arg);
    cost = next;
  }
  // Walk back to the class starts; return upper bounds.
  const uppers = [sorted[n - 1]];
  let j = n - 1;
  for (let c = k - 1; c >= 1; c--) {
    const i = from[c - 1][j];
    uppers.unshift(sorted[i - 1]);
    j = i - 1;
  }
  return uppers;
}

function breaksOf(method, sorted, k) {
  const n = sorted.length, lo = sorted[0], hi = sorted[n - 1];
  if (method === "equal") return Array.from({ length: k }, (_, i) => lo + ((i + 1) * (hi - lo)) / k);
  if (method === "quantile") return Array.from({ length: k }, (_, i) => sorted[Math.ceil(((i + 1) * n) / k) - 1]);
  if (method === "jenks") return jenks(sorted, k);
  const mean = sorted.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const ups = [];
  for (let j = -6; j <= 6; j++) { const b = mean + (j + 0.5) * sd; if (b > lo && b < hi) ups.push(b); }
  ups.push(hi);
  return ups;
}

const classOf = (v, uppers) => { let c = 0; while (c < uppers.length - 1 && v > uppers[c]) c++; return c; };

const DISTRICTS = 120, COLS = 12, ROWS = 10;
function districtData(kind) {
  const r = rng({ skewed: 11, bimodal: 12, uniform: 13 }[kind]), f = fbm(41, 3);
  return Array.from({ length: DISTRICTS }, (_, i) => {
    const x = i % COLS, y = (i / COLS) | 0;
    if (kind === "uniform") return 10 + r() * 90;
    if (kind === "bimodal") return (x < 5 && y < 6) || f(x / 3, y / 3) > 0.62 ? 80 + gauss(r) * 7 : 25 + gauss(r) * 6;
    // Skewed: a dense core and a long tail, like population density.
    const core = Math.exp(-((x - 4) ** 2 + (y - 4) ** 2) / 18);
    return Math.round(Math.exp(3.2 + 1.8 * core + 0.55 * gauss(r) + f(x / 3, y / 3)));
  });
}

for (const root of document.querySelectorAll("[data-gis-classify]")) {
  const svg = root.querySelector("[data-map]"), chart = root.querySelector("[data-chart]");
  const o = outs(root);
  const method = seg(root, "method", draw);
  const data = seg(root, "data", draw);
  const s = scrubAll(root, draw);

  function draw() {
    const vals = districtData(data.get()), sorted = [...vals].sort((a, b) => a - b);
    const k = Math.round(s.k.get()), m = method.get();
    const uppers = breaksOf(m, sorted, k), K = uppers.length;
    const cls = vals.map((v) => classOf(v, uppers));

    clear(svg);
    const cw = 640 / COLS, ch = 330 / ROWS;
    vals.forEach((v, i) => {
      const x = (i % COLS) * cw, y = ((i / COLS) | 0) * ch, c = cls[i];
      const r = el("rect", { x: x + 1, y: y + 1, width: cw - 2, height: ch - 2, rx: 2, style: `fill:${tint(BRAND, 8 + (84 * c) / Math.max(1, K - 1))};stroke:currentColor;stroke-opacity:0.12` }, svg);
      el("title", {}, r).textContent = `District ${i + 1}: ${num(v, 1)} (class ${c + 1})`;
    });

    // Goodness of variance fit.
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sdam = vals.reduce((a, v) => a + (v - mean) ** 2, 0);
    const sums = Array(K).fill(0), counts = Array(K).fill(0);
    vals.forEach((v, i) => { sums[cls[i]] += v; counts[cls[i]]++; });
    const sdcm = vals.reduce((a, v, i) => a + (v - sums[cls[i]] / counts[cls[i]]) ** 2, 0);
    const gvf = 1 - sdcm / sdam;

    clear(chart);
    const lo = sorted[0], hi = sorted.at(-1), bins = 30, bw = (hi - lo) / bins || 1;
    const hist = Array(bins).fill(0);
    for (const v of vals) hist[Math.min(bins - 1, Math.floor((v - lo) / bw))]++;
    const top = Math.max(...hist);
    const f = frame(chart, { box: [40, 12, 580, 104], x: [lo, hi], y: [0, top], xticks: [lo, (lo + hi) / 2, hi], xfmt: (v) => num(v, 0), yticks: [0, top], xlabel: "value", ylabel: "districts" });
    hist.forEach((c, i) => {
      const mid = lo + (i + 0.5) * bw, cl = classOf(mid, uppers);
      el("rect", { x: f.sx(lo + i * bw) + 0.5, y: f.sy(c), width: Math.max(1, f.sx(lo + bw) - f.sx(lo) - 1), height: f.sy(0) - f.sy(c), style: `fill:${tint(BRAND, 8 + (84 * cl) / Math.max(1, K - 1))};stroke:currentColor;stroke-opacity:0.2` }, f.g);
    });
    uppers.slice(0, -1).forEach((b) => el("line", { x1: f.sx(b), x2: f.sx(b), y1: f.T - 4, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:1.5` }, f.g));

    o.breaks.textContent = [sorted[0], ...uppers].map((b) => num(b, 1)).join(" · ");
    o.gvf.textContent = `${num(gvf * 100, 1)}%`;
    const big = counts.indexOf(Math.max(...counts)), small = counts.indexOf(Math.min(...counts));
    o.big.textContent = `class ${big + 1}: ${counts[big]} districts`;
    o.small.textContent = `class ${small + 1}: ${counts[small]} district${counts[small] === 1 ? "" : "s"}`;
    root.querySelector("[data-scrub=k]").closest("label").style.opacity = m === "sd" ? "0.45" : "";
  }
  draw();
}

// ============================================================ Slope, aspect and hillshade

// Horn's 3×3 gradient. z is row-major with row 0 at the north edge.
function horn(z, W, H, cs, x, y) {
  const at = (i, j) => z[Math.max(0, Math.min(H - 1, j)) * W + Math.max(0, Math.min(W - 1, i))];
  const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
  const d = at(x - 1, y), f = at(x + 1, y);
  const g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * cs);
  const dzdy = (g + 2 * hh + i - (a + 2 * b + c)) / (8 * cs);
  return [dzdx, dzdy];
}

// Slope (radians), aspect (radians in the hillshade's convention, and
// compass degrees: the direction the slope faces downhill).
function slopeAspect(dzdx, dzdy, zf = 1) {
  const slope = Math.atan(zf * Math.hypot(dzdx, dzdy));
  let a = Math.atan2(dzdy, -dzdx);
  if (a < 0) a += 2 * Math.PI;
  const deg = (a * 180) / Math.PI;
  const compass = deg <= 90 ? 90 - deg : 450 - deg;
  return { slope, aspect: a, compass: compass % 360, flat: dzdx === 0 && dzdy === 0 };
}

function hillshade(slope, aspect, az, alt) {
  const zen = ((90 - alt) * Math.PI) / 180, azm = (((360 - az + 90) % 360) * Math.PI) / 180;
  return Math.max(0, Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(azm - aspect));
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

for (const root of document.querySelectorAll("[data-gis-terrain]")) {
  const svg = root.querySelector("[data-map]"), canvas = root.querySelector("[data-canvas]"), ramp = root.querySelector("[data-ramp]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const W = 160, H = 100, CS = 25;
  canvas.width = W;
  canvas.height = H;
  canvas.style.imageRendering = "auto";
  const n1 = fbm(8, 6);
  const z = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ridge = 1 - Math.abs(2 * n1(x / 34 + 3, y / 34) - 1);
    z[y * W + x] = 140 + 420 * n1(x / 46, y / 46) + 160 * ridge * ridge - 0.9 * Math.abs(y - 50 - 12 * Math.sin(x / 15));
  }
  let zmin = Infinity, zmax = -Infinity;
  for (const v of z) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); }
  const layer = seg(root, "layer", draw);
  const s = scrubAll(root, draw);
  let hover = null;

  function cellInfo(x, y) {
    const [dx, dy] = horn(z, W, H, CS, x, y), sa = slopeAspect(dx, dy, s.z.get());
    return { ...sa, z: z[y * W + x], hs: hillshade(sa.slope, sa.aspect, s.az.get(), s.alt.get()) };
  }

  function draw() {
    const L = layer.get(), img = ctx.createImageData(W, H);
    const bg = rgbOf(root, "var(--background)"), fg = rgbOf(root, "var(--foreground)"), br = rgbOf(root, BRAND);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = cellInfo(x, y), q = (y * W + x) * 4;
      let rgb;
      if (L === "shade") { const v = 255 * c.hs; rgb = [v, v, v]; }
      else if (L === "slope") rgb = mix(bg, br, Math.min(1, (c.slope * 180) / Math.PI / 45));
      else if (L === "elev") rgb = mix(bg, fg, 0.08 + 0.85 * ((c.z - zmin) / (zmax - zmin)));
      else {
        // Aspect as a colour wheel: the colour is the data here.
        const [r2, g2, b2] = hsl(c.compass, 0.6, 0.55);
        rgb = c.slope < 0.02 ? bg : [r2, g2, b2];
      }
      img.data[q] = rgb[0]; img.data[q + 1] = rgb[1]; img.data[q + 2] = rgb[2]; img.data[q + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    clear(svg);
    // Sun direction, top right.
    const az = (s.az.get() * Math.PI) / 180, cx = 600, cy = 40;
    el("circle", { cx, cy, r: 24, style: "fill:var(--background);fill-opacity:0.85;stroke:currentColor;stroke-opacity:0.3" }, svg);
    text(svg, cx, cy - 27, "N", { "text-anchor": "middle" });
    el("line", { x1: cx, y1: cy, x2: cx + 20 * Math.sin(az), y2: cy - 20 * Math.cos(az), style: `stroke:${BRAND};stroke-width:2` }, svg);
    el("circle", { cx: cx + 20 * Math.sin(az), cy: cy - 20 * Math.cos(az), r: 4, style: `fill:${BRAND}` }, svg);
    el("line", { x1: 20, x2: 20 + (1000 / CS) * 4, y1: 380, y2: 380, style: "stroke:currentColor;stroke-width:2" }, svg);
    text(svg, 20, 374, "1 km");
    if (hover) {
      el("rect", { x: hover[0] * 4 - 6, y: hover[1] * 4 - 6, width: 16, height: 16, style: `fill:none;stroke:${BRAND};stroke-width:2` }, svg);
      const c = cellInfo(hover[0], hover[1]);
      o.cell.textContent = `${hover[0]}, ${hover[1]}`;
      o.elev.textContent = `${num(c.z, 0)} m`;
      o.slope.textContent = `${num((c.slope * 180) / Math.PI, 1)}° (${num(Math.tan(c.slope) * 100, 0)}%)`;
      o.aspect.textContent = c.slope < 0.005 ? "flat" : `${num(c.compass, 0)}° ${COMPASS[Math.round(c.compass / 45) % 8]}`;
      o.shade.textContent = `${Math.round(c.hs * 255)} / 255`;
    } else for (const k of ["cell", "elev", "slope", "aspect", "shade"]) o[k].textContent = "—";

    clear(ramp);
    if (L === "aspect") {
      for (let i = 0; i < 8; i++) {
        const sw = document.createElement("span");
        sw.className = "inline-flex items-center gap-1";
        const dot = document.createElement("span");
        dot.className = "size-2.5 rounded-sm";
        const [r2, g2, b2] = hsl(i * 45, 0.6, 0.55);
        dot.style.background = `rgb(${r2},${g2},${b2})`;
        sw.append(dot, COMPASS[i]);
        ramp.append(sw);
      }
    } else {
      const [a, b, lo, hi] = { shade: ["#000", "#fff", "0", "255"], slope: ["var(--background)", "var(--brand)", "0°", "45°+"], elev: [tint("var(--foreground)", 8), tint("var(--foreground)", 93), `${num(zmin, 0)} m`, `${num(zmax, 0)} m`] }[L];
      const bar = document.createElement("span");
      bar.className = "h-2 w-40 rounded-full border";
      bar.style.background = `linear-gradient(to right, ${a}, ${b})`;
      ramp.append(lo, bar, hi);
    }
  }

  svg.addEventListener("pointermove", (e) => {
    const [x, y] = svgPoint(svg, e);
    hover = [Math.max(0, Math.min(W - 1, Math.floor(x / 4))), Math.max(0, Math.min(H - 1, Math.floor(y / 4)))];
    draw();
  });
  svg.addEventListener("pointerleave", () => { hover = null; draw(); });
  onTheme(draw);
  draw();
}

function hsl(hdeg, s, l) {
  const k = (n) => (n + hdeg / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}

// ============================================================ Buffers and overlay

for (const root of document.querySelectorAll("[data-gis-overlay]")) {
  const svg = root.querySelector("[data-map]"), canvas = root.querySelector("[data-canvas]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const GW = 128, GH = 80, CELL = 5, MPP = 10; // 50 m cells, 6.4 × 4 km
  canvas.width = GW;
  canvas.height = GH;
  const river = Array.from({ length: 65 }, (_, i) => { const x = i * 10; return [x, 228 + 55 * Math.sin(x / 95) + 18 * Math.sin(x / 31)]; });
  const roads = [
    [[0, 70], [180, 95], [330, 80], [470, 120], [640, 105]],
    [[260, 0], [300, 140], [340, 260], [330, 400]],
    [[340, 260], [470, 300], [640, 340]],
    [[0, 330], [140, 300], [210, 360]],
  ];
  const nz = fbm(23, 5);
  const z = new Float64Array(GW * GH), dRoad = new Float64Array(GW * GH), dRiver = new Float64Array(GW * GH), slope = new Float64Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const p = [(x + 0.5) * CELL, (y + 0.5) * CELL], i = y * GW + x;
    let dr = Infinity, dv = Infinity;
    for (const r of roads) for (let k = 0; k + 1 < r.length; k++) dr = Math.min(dr, segDist(p, r[k], r[k + 1]));
    for (let k = 0; k + 1 < river.length; k++) dv = Math.min(dv, segDist(p, river[k], river[k + 1]));
    dRoad[i] = dr * MPP;
    dRiver[i] = dv * MPP;
    // Hills that rise away from the river.
    z[i] = 30 + 190 * nz(x / 18, y / 18) + 0.06 * Math.min(dRiver[i], 1500);
  }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const [dx, dy] = horn(z, GW, GH, CELL * MPP, x, y);
    slope[y * GW + x] = Math.hypot(dx, dy) * 100;
  }
  const show = seg(root, "show", draw);
  const s = scrubAll(root, draw);

  function draw() {
    const R = s.road.get(), F = s.flood.get(), S = s.slope.get(), v = show.get();
    const ok = new Uint8Array(GW * GH);
    for (let i = 0; i < ok.length; i++) ok[i] = dRoad[i] <= R && dRiver[i] > Math.max(F, 25) && slope[i] < S ? 1 : 0;

    const bg = rgbOf(root, "var(--background)"), fg = rgbOf(root, "var(--foreground)"), br = rgbOf(root, BRAND), bl = rgbOf(root, BLUE);
    const img = ctx.createImageData(GW, GH);
    for (let i = 0; i < ok.length; i++) {
      let c = mix(bg, fg, 0.04);
      if (v === "result" && ok[i]) c = mix(bg, br, 0.55);
      if (v === "road" && dRoad[i] <= R) c = mix(bg, fg, 0.22);
      if (v === "flood" && dRiver[i] <= Math.max(F, 25)) c = mix(bg, bl, 0.45);
      if (v === "slope") c = slope[i] < S ? mix(bg, fg, 0.06 + 0.25 * (slope[i] / S)) : mix(bg, br, 0.2 + Math.min(0.5, (slope[i] - S) / 60));
      if (v === "result" && !ok[i] && dRiver[i] <= Math.max(F, 25)) c = mix(bg, bl, 0.16);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    clear(svg);
    const pts = (l) => l.map((p) => p.join(",")).join(" ");
    el("polyline", { points: pts(river), style: `fill:none;stroke:${BLUE};stroke-width:4;stroke-linecap:round;stroke-linejoin:round` }, svg);
    for (const r of roads) {
      el("polyline", { points: pts(r), style: "fill:none;stroke:var(--background);stroke-width:5;stroke-linecap:round;stroke-linejoin:round" }, svg);
      el("polyline", { points: pts(r), style: "fill:none;stroke:currentColor;stroke-opacity:0.75;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round" }, svg);
    }
    el("line", { x1: 20, x2: 120, y1: 385, y2: 385, style: "stroke:currentColor;stroke-width:2" }, svg);
    text(svg, 20, 379, "1 km");

    // Patches: 4-connected components of suitable cells.
    const lab = new Int32Array(GW * GH).fill(-1);
    let patches = 0, big = 0, total = 0;
    for (let i = 0; i < ok.length; i++) {
      if (!ok[i] || lab[i] >= 0) continue;
      let size = 0;
      const stack = [i];
      lab[i] = patches;
      while (stack.length) {
        const c = stack.pop(), x = c % GW, y = (c / GW) | 0;
        size++;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const q = ny * GW + nx;
          if (ok[q] && lab[q] < 0) { lab[q] = patches; stack.push(q); }
        }
      }
      patches++;
      total += size;
      big = Math.max(big, size);
    }
    const ha = (cells) => `${num((cells * 2500) / 1e4, 0)} ha`;
    o.area.textContent = ha(total);
    o.share.textContent = `${num((total / ok.length) * 100, 1)}%`;
    o.patches.textContent = String(patches);
    o.big.textContent = ha(big);
    o.expr.textContent = `suitable = (dist(road)  ≤ ${R} m)\n     AND NOT (dist(river) ≤ ${Math.max(F, 25)} m)\n     AND (slope < ${S} %)`;
  }
  onTheme(draw);
  draw();
}

// ============================================================ Spatial indexing

function buildTree(pts, cap) {
  const root = { x: 0, y: 0, s: 400, pts: [], kids: null, depth: 0 };
  let maxDepth = 0;
  const insert = (node, p) => {
    while (node.kids) node = node.kids[(p[0] >= node.x + node.s / 2 ? 1 : 0) + (p[1] >= node.y + node.s / 2 ? 2 : 0)];
    node.pts.push(p);
    if (node.pts.length > cap && node.depth < 12) {
      const h2 = node.s / 2;
      node.kids = [0, 1, 2, 3].map((q) => ({ x: node.x + (q & 1) * h2, y: node.y + (q >> 1) * h2, s: h2, pts: [], kids: null, depth: node.depth + 1 }));
      maxDepth = Math.max(maxDepth, node.depth + 1);
      const old = node.pts;
      node.pts = [];
      for (const q of old) insert(node, q);
    }
  };
  for (const p of pts) insert(root, p);
  return { root, maxDepth };
}

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function geohash(lat, lon, len = 7) {
  let lo = [-90, 180 * -1], hi = [90, 180], even = true, bit = 0, ch = 0, out = "";
  while (out.length < len) {
    const d = even ? 1 : 0, mid = (lo[d] + hi[d]) / 2, v = even ? lon : lat;
    if (v >= mid) { ch = (ch << 1) | 1; lo[d] = mid; } else { ch <<= 1; hi[d] = mid; }
    even = !even;
    if (++bit === 5) { out += BASE32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

for (const root of document.querySelectorAll("[data-gis-index]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  svg.setAttribute("tabindex", "0");
  svg.classList.add("outline-none", "focus-visible:ring-[3px]", "focus-visible:ring-ring/50", "rounded-lg");
  let centre = [150, 160], pts = [], tree, dragging = false;
  const dist = seg(root, "dist", () => { scatter(); draw(); });
  const s = scrubAll(root, (name) => { if (name !== "w") scatter(); draw(); });

  function scatter() {
    const r = rng(17), n = Math.round(s.n.get()), clustered = dist.get() === "clustered";
    const centres = [[90, 110], [290, 90], [210, 260], [320, 320], [80, 330]];
    pts = [];
    while (pts.length < n) {
      let p;
      if (clustered && r() < 0.85) { const c = centres[Math.floor(r() * centres.length)]; p = [c[0] + gauss(r) * 28, c[1] + gauss(r) * 28]; }
      else p = [r() * 400, r() * 400];
      if (p[0] >= 0 && p[0] < 400 && p[1] >= 0 && p[1] < 400) pts.push(p);
    }
    tree = buildTree(pts, Math.round(s.cap.get()));
  }

  function draw() {
    const w = (s.w.get() / 100) * 400, x0 = centre[0] - w / 2, y0 = centre[1] - w / 2, x1 = x0 + w, y1 = y0 + w;
    clear(svg);
    const cells = el("g", { style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, svg);
    const vis = el("g", { style: `fill:${BLUE};fill-opacity:0.06;stroke:${BLUE};stroke-opacity:0.7` }, svg);
    let nodes = 0, tested = 0, hits = 0;
    const hitSet = new Set();
    const walk = (n) => {
      const touches = n.x < x1 && n.x + n.s > x0 && n.y < y1 && n.y + n.s > y0;
      if (!n.kids) el("rect", { x: n.x, y: n.y, width: n.s, height: n.s }, cells);
      if (!touches) return;
      nodes++;
      if (n.kids) return n.kids.forEach(walk);
      el("rect", { x: n.x, y: n.y, width: n.s, height: n.s }, vis);
      for (const p of n.pts) {
        tested++;
        if (p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1) { hits++; hitSet.add(p); }
      }
    };
    walk(tree.root);
    const dots = el("g", {}, svg);
    for (const p of pts) el("circle", { cx: p[0], cy: p[1], r: hitSet.has(p) ? 2.2 : 1.5, style: hitSet.has(p) ? `fill:${BRAND}` : "fill:currentColor;fill-opacity:0.45" }, dots);
    el("rect", { x: x0, y: y0, width: w, height: w, style: `fill:${BRAND};fill-opacity:0.06;stroke:${BRAND};stroke-width:2;cursor:move` }, svg);
    el("circle", { cx: centre[0], cy: centre[1], r: 3, style: `fill:${BRAND}` }, svg);

    const lon = -10 + (20 * centre[0]) / 400, lat = 60 - (20 * centre[1]) / 400;
    o.hits.textContent = fmtInt(hits);
    o.nodes.textContent = fmtInt(nodes);
    o.tested.textContent = `${fmtInt(tested)} (${num((tested / pts.length) * 100, 1)}%)`;
    o.brute.textContent = `${fmtInt(pts.length)} tested`;
    o.depth.textContent = String(tree.maxDepth);
    o.hash.textContent = `${geohash(lat, lon, 6)} (${num(lat, 2)}° N, ${num(Math.abs(lon), 2)}° ${lon < 0 ? "W" : "E"})`;
  }

  const move = (e) => {
    const [x, y] = svgPoint(svg, e);
    centre = [Math.max(0, Math.min(400, x)), Math.max(0, Math.min(400, y))];
    draw();
  };
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); move(e); });
  svg.addEventListener("pointermove", (e) => dragging && move(e));
  svg.addEventListener("pointerup", () => (dragging = false));
  svg.addEventListener("pointercancel", () => (dragging = false));
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
    if (!d) return;
    e.preventDefault();
    centre = [Math.max(0, Math.min(400, centre[0] + d[0])), Math.max(0, Math.min(400, centre[1] + d[1]))];
    draw();
  });
  scatter();
  draw();
}

// ============================================================ Moran's I

const MN = 12;
const NEIGH = Array.from({ length: MN * MN }, (_, i) => {
  const x = i % MN, y = (i / MN) | 0, out = [];
  if (x > 0) out.push(i - 1);
  if (x < MN - 1) out.push(i + 1);
  if (y > 0) out.push(i - MN);
  if (y < MN - 1) out.push(i + MN);
  return out;
});

// Moran's I with row-standardised rook weights (so S0 = n).
export function moran(vals) {
  const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n, z = vals.map((v) => v - mean);
  const den = z.reduce((a, b) => a + b * b, 0);
  if (den < 1e-12) return NaN;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const nb = NEIGH[i];
    let t = 0;
    for (const j of nb) t += z[j];
    s += (z[i] * t) / nb.length;
  }
  return s / den;
}

// Variance of I under the normality assumption (Cliff and Ord).
function moranVarN() {
  const n = MN * MN, w = (i, j) => (NEIGH[i].includes(j) ? 1 / NEIGH[i].length : 0);
  let S1 = 0, S2 = 0;
  for (let i = 0; i < n; i++) {
    let row = 0, col = 0;
    for (const j of NEIGH[i]) { S1 += (w(i, j) + w(j, i)) ** 2; row += w(i, j); col += w(j, i); }
    S2 += (row + col) ** 2;
  }
  S1 /= 2;
  const S0 = n, E = -1 / (n - 1);
  return (n * n * S1 - n * S2 + 3 * S0 * S0) / (S0 * S0 * (n * n - 1)) - E * E;
}

for (const root of document.querySelectorAll("[data-gis-moran]")) {
  const svg = root.querySelector("[data-map]"), chart = root.querySelector("[data-chart]");
  const o = outs(root);
  const n = MN * MN, E = -1 / (n - 1), VAR = moranVarN(), C = 32, OFF = 8;
  let vals = [], cursor = 0, painting = false, shuffleSeed = 1;
  svg.setAttribute("tabindex", "0");
  svg.classList.add("outline-none", "focus-visible:ring-[3px]", "focus-visible:ring-ring/50", "rounded-lg");
  const preset = seg(root, "preset", (v) => { setPreset(v); draw(); });
  const brush = seg(root, "paint", () => {});

  function setPreset(v) {
    const r = rng(14), f = fbm(31, 3);
    vals = Array.from({ length: n }, (_, i) => {
      const x = i % MN, y = (i / MN) | 0;
      if (v === "random") return r();
      if (v === "checker") return (x + y) % 2;
      if (v === "gradient") return (x + y) / (2 * (MN - 1));
      return Math.max(0, Math.min(1, (f(x / 4, y / 4) - 0.25) * 2));
    });
  }

  function draw() {
    clear(svg);
    vals.forEach((v, i) => {
      const x = OFF + (i % MN) * C, y = OFF + ((i / MN) | 0) * C;
      el("rect", { x: x + 1, y: y + 1, width: C - 2, height: C - 2, rx: 3, style: `fill:${tint(BRAND, 6 + 86 * v)};stroke:currentColor;stroke-opacity:0.1` }, svg);
    });
    if (document.activeElement === svg) {
      const x = OFF + (cursor % MN) * C, y = OFF + ((cursor / MN) | 0) * C;
      el("rect", { x, y, width: C, height: C, rx: 4, style: "fill:none;stroke:var(--foreground);stroke-width:2" }, svg);
    }

    const I = moran(vals);
    const r = rng(shuffleSeed), perm = [], copy = [...vals];
    for (let k = 0; k < 999; k++) {
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
      perm.push(moran(copy));
    }
    const extreme = perm.filter((v) => Math.abs(v - E) >= Math.abs(I - E) - 1e-12).length;
    const p = (1 + extreme) / 1000, zsc = (I - E) / Math.sqrt(VAR);

    clear(chart);
    if (!Number.isNaN(I)) {
      const lo = Math.min(-0.3, I - 0.05, ...perm), hi = Math.max(0.3, I + 0.05, ...perm), bins = 50, bw = (hi - lo) / bins;
      const hist = Array(bins).fill(0);
      for (const v of perm) hist[Math.min(bins - 1, Math.floor((v - lo) / bw))]++;
      const top = Math.max(...hist);
      const f = frame(chart, { box: [40, 14, 580, 100], x: [lo, hi], y: [0, top], xticks: [-1, -0.5, 0, 0.5, 1].filter((t) => t >= lo && t <= hi), xfmt: (t) => num(t, 1), yticks: [0, top], xlabel: "Moran's I", ylabel: "shuffles" });
      hist.forEach((c, i) => el("rect", { x: f.sx(lo + i * bw), y: f.sy(c), width: Math.max(1, f.sx(lo + bw) - f.sx(lo) - 0.5), height: f.sy(0) - f.sy(c), style: `fill:${BLUE};fill-opacity:0.45` }, f.g));
      el("line", { x1: f.sx(E), x2: f.sx(E), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.5;stroke-dasharray:3 3" }, f.g);
      el("line", { x1: f.sx(I), x2: f.sx(I), y1: f.T - 6, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:2.5` }, f.g);
      text(f.g, f.sx(I) + (f.sx(I) > 520 ? -4 : 4), f.T + 4, `observed ${num(I, 3)}`, { "text-anchor": f.sx(I) > 520 ? "end" : "start", class: "fill-foreground font-mono text-[10px]" });
    }

    o.i.textContent = Number.isNaN(I) ? "undefined (all equal)" : num(I, 3);
    o.ei.textContent = num(E, 4);
    o.z.textContent = Number.isNaN(I) ? "—" : num(zsc, 2);
    o.p.textContent = Number.isNaN(I) ? "—" : p < 0.001 ? "< 0.001" : num(p, 3);
    o.verdict.textContent = Number.isNaN(I) ? "—" : p >= 0.05 ? "consistent with random" : I > E ? "clustered" : "dispersed";
    o.verdict.style.color = !Number.isNaN(I) && p < 0.05 ? BRAND : "";
  }

  const cellAt = (e) => {
    const [x, y] = svgPoint(svg, e), cx = Math.floor((x - OFF) / C), cy = Math.floor((y - OFF) / C);
    return cx >= 0 && cy >= 0 && cx < MN && cy < MN ? cy * MN + cx : -1;
  };
  const paint = (i) => {
    if (i < 0) return;
    const v = brush.get() === "low" ? 0 : 1;
    if (vals[i] === v) return;
    vals[i] = v;
    cursor = i;
    draw();
  };
  svg.addEventListener("pointerdown", (e) => { painting = true; svg.setPointerCapture(e.pointerId); paint(cellAt(e)); });
  svg.addEventListener("pointermove", (e) => painting && paint(cellAt(e)));
  svg.addEventListener("pointerup", () => (painting = false));
  svg.addEventListener("pointercancel", () => (painting = false));
  svg.addEventListener("focus", draw);
  svg.addEventListener("blur", draw);
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -MN, ArrowDown: MN }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const x = cursor % MN;
      if ((d === -1 && x === 0) || (d === 1 && x === MN - 1)) return;
      cursor = Math.max(0, Math.min(n - 1, cursor + d));
      draw();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      vals[cursor] = vals[cursor] >= 0.5 ? 0 : 1;
      draw();
    }
  });
  root.querySelector("[data-action=perm]").addEventListener("click", () => { shuffleSeed++; draw(); });
  setPreset(preset.get());
  draw();
}
