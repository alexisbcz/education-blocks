// Computer vision blocks, part two: geometry and motion. The pinhole
// camera, a homography by DLT, stereo block matching, Lucas–Kanade flow
// and RANSAC. Scenes are generated here; every estimate is computed live.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import {
  outs, minus, mulberry32, gauss, seg, onToggle, palette, onTheme, paintRGB, mix,
  svgEl, overlay, pixelAt, loop, playButton, reduced,
} from "./vision-core.js";

const sci = (v) => {
  if (v === 0) return "0";
  const [m, e] = v.toExponential(1).split("e");
  return `${minus(m)} × 10${String(Number(e)).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`;
};

// Solves A x = b (n × n) by Gaussian elimination with partial pivoting,
// returning x and det A.
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return { x: null, det: 0 };
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; det = -det; }
    det *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return { x, det };
}

// The DLT with h₃₃ = 1: four pairs (x, y) → (u, v) give eight equations.
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const { x, det } = solve(A, b);
  return { H: x ? [...x, 1] : null, det };
}
const apply = (H, x, y) => {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
};

// ---------------------------------------------------------------- Pinhole camera

for (const root of document.querySelectorAll("[data-cv-camera]")) {
  const o = outs(root);
  const svg = root.querySelector('[data-plot="img"]');
  const s = scrubAll(root, () => draw());
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

  function draw() {
    const f = s.f.get(), cx = s.cx.get(), cy = s.cy.get(), k1 = s.k1.get(), k2 = s.k2.get();
    const yaw = (s.yaw.get() * Math.PI) / 180, pitch = (s.pitch.get() * Math.PI) / 180, dist = s.dist.get();
    const target = [0, 0, 1];
    const C = [target[0] + dist * Math.cos(pitch) * Math.cos(yaw), target[1] + dist * Math.cos(pitch) * Math.sin(yaw), target[2] + dist * Math.sin(pitch)];
    const fw = unit(sub(target, C)), right = unit(cross(fw, [0, 0, 1])), down = cross(fw, right);
    // World → camera (extrinsics), then normalise, distort, apply K.
    const project = (X) => {
      const d = sub(X, C), xc = dot(right, d), yc = dot(down, d), zc = dot(fw, d);
      if (zc < 0.05) return null;
      const x = xc / zc, y = yc / zc, r2 = x * x + y * y, sc = 1 + k1 * r2 + k2 * r2 * r2;
      // Past the radius where r·(1 + k₁r² + k₂r⁴) stops growing, the model folds back on itself.
      if (1 + 3 * k1 * r2 + 5 * k2 * r2 * r2 <= 0) return null;
      return [f * x * sc + cx, f * y * sc + cy, zc];
    };
    // Lines are subdivided so distortion can bend them.
    const pathOf = (a, b, n = 24) => {
      let d = "", pen = false;
      for (let i = 0; i <= n; i++) {
        const t = i / n, p = project([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        if (!p || Math.abs(p[0]) > 4000 || Math.abs(p[1]) > 4000) { pen = false; continue; }
        d += `${pen ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
        pen = true;
      }
      return d;
    };
    svg.replaceChildren();
    const clipId = "cv-camera-clip";
    const defs = el("defs", {}, svg);
    el("rect", { x: 0, y: 0, width: 640, height: 480 }, el("clipPath", { id: clipId }, defs));
    const g = el("g", { "clip-path": `url(#${clipId})` }, svg);
    let grid = "";
    for (let i = -5; i <= 5; i++) grid += pathOf([i, -5, 0], [i, 5, 0]) + pathOf([-5, i, 0], [5, i, 0]);
    el("path", { d: grid, style: "fill:none;stroke:var(--muted-foreground);stroke-opacity:0.55;stroke-width:1" }, g);
    const V = [];
    for (const z of [0, 2]) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) V.push([x, y, z]);
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    // Faces facing the camera get a light fill, so the wireframe reads as a solid.
    const F = [[0, 1, 2, 3, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]], [0, 1, 5, 4, [0, -1, 0]], [1, 2, 6, 5, [1, 0, 0]], [2, 3, 7, 6, [0, 1, 0]], [3, 0, 4, 7, [-1, 0, 0]]];
    for (const [a, b, c, d, n] of F) {
      const mid = [0, 1, 2].map((k) => (V[a][k] + V[c][k]) / 2);
      if (dot(n, sub(C, mid)) <= 0) continue;
      const ring = pathOf(V[a], V[b]) + pathOf(V[b], V[c]).replace(/^M/, "L") + pathOf(V[c], V[d]).replace(/^M/, "L") + pathOf(V[d], V[a]).replace(/^M/, "L");
      if (ring.split("M").length === 2) el("path", { d: ring + "Z", style: "fill:var(--brand);fill-opacity:0.08;stroke:none" }, g);
    }
    el("path", { d: E.map(([a, b]) => pathOf(V[a], V[b])).join(""), style: "fill:none;stroke:var(--brand);stroke-width:2.25;stroke-linejoin:round" }, g);
    const P = V.map(project);
    for (const p of P) if (p) el("circle", { cx: p[0], cy: p[1], r: 3, style: "fill:var(--brand)" }, g);
    el("path", { d: `M${cx - 9},${cy}H${cx + 9}M${cx},${cy - 9}V${cy + 9}`, style: "stroke:var(--vec-u);stroke-width:1.5" }, g);
    el("rect", { x: 0.5, y: 0.5, width: 639, height: 479, rx: 4, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, svg);
    text(svg, 8, 16, "640 × 480 px");

    const kv = [f, 0, cx, 0, f, cy, 0, 0, 1];
    kv.forEach((v, i) => (o[`k${i}`].textContent = num(v, 0)));
    o.fov.textContent = `${num((2 * Math.atan(320 / f) * 180) / Math.PI, 1)}°`;
    let near = -1;
    P.forEach((p, i) => { if (p && (near < 0 || p[2] < P[near][2])) near = i; });
    if (near >= 0) {
      o.corner.textContent = `(${V[near].join(", ")}) m → (${num(P[near][0], 0)}, ${num(P[near][1], 0)}) px`;
      o.z.textContent = `${num(P[near][2], 2)} m`;
    } else { o.corner.textContent = "behind the camera"; o.z.textContent = "—"; }
  }
  draw();
}

// ---------------------------------------------------------------- Homography

for (const root of document.querySelectorAll("[data-cv-homography]")) {
  const o = outs(root);
  const PW = 480, PH = 360, AW = 210, AH = 297, FS = 1.4; // photo px; page mm; rectified px per mm
  const cphoto = root.querySelector('[data-canvas="photo"]'), cflat = root.querySelector('[data-canvas="flat"]');
  const svg = root.querySelector('[data-overlay="photo"]');
  const page = [[0, 0], [AW, 0], [AW, AH], [0, AH]];
  let pal = palette(), seed = 2, truth = [], handles = [], Htrue = null, photo = null, drag = -1;

  // The page itself: a title bar, text lines and a figure, in millimetres.
  const ink = (u, v) => {
    if (u < 4 || u > AW - 4 || v < 4 || v > AH - 4) return 0;
    if (v > 16 && v < 30 && u > 18 && u < 150) return 2;
    if (u > 120 && u < 192 && v > 44 && v < 104) return u < 123 || u > 189 || v < 47 || v > 101 || Math.abs((v - 47) - ((u - 123) * 54) / 66) < 1.6 ? 1 : 0;
    const row = (v - 46) / 9;
    if (v > 44 && v < 270 && row - Math.floor(row) < 0.38) {
      const r = Math.floor(row), end = u < (r % 5 === 4 ? 120 : 192) && (v > 104 || u < 112);
      if (u > 18 && end) return 1;
    }
    return 0;
  };

  function makePhoto() {
    const rng = mulberry32(seed);
    const j = (a) => (rng() - 0.5) * 2 * a;
    truth = [[120 + j(28), 46 + j(18)], [352 + j(26), 64 + j(22)], [404 + j(22), 318 + j(18)], [84 + j(24), 296 + j(22)]];
    Htrue = homography(page, truth).H;
    const Hinv = homography(truth, page).H;
    const light = pal.fg[0] + pal.fg[1] + pal.fg[2] > pal.bg[0] + pal.bg[1] + pal.bg[2] ? pal.fg : pal.bg;
    const dark = light === pal.fg ? pal.bg : pal.fg;
    const paper = mix(light, pal.muted, 0.06), desk = mix(pal.bg, pal.muted, 0.35), deskLine = mix(pal.bg, pal.muted, 0.5);
    const text = mix(dark, pal.muted, 0.35);
    photo = new Float32Array(PW * PH * 3);
    paintRGB(cphoto, PW, PH, (x, y, i) => {
      let acc = [0, 0, 0];
      for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const [u, v] = apply(Hinv, x + sx, y + sy);
        let c;
        if (u >= 0 && u <= AW && v >= 0 && v <= AH) { const k = ink(u, v); c = k === 2 ? pal.brand : k === 1 ? text : paper; } else c = Math.sin((x + sx) * 0.09 + Math.sin(y * 0.02) * 3) > 0.96 ? deskLine : desk;
        acc = [acc[0] + c[0] / 4, acc[1] + c[1] / 4, acc[2] + c[2] / 4];
      }
      photo[i * 3] = acc[0]; photo[i * 3 + 1] = acc[1]; photo[i * 3 + 2] = acc[2];
      return acc;
    });
  }

  const sample = (x, y) => {
    if (x < 0 || y < 0 || x > PW - 1 || y > PH - 1) return pal.bg;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(PW - 1, x0 + 1), y1 = Math.min(PH - 1, y0 + 1), fx = x - x0, fy = y - y0;
    const c = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = photo[(y0 * PW + x0) * 3 + k], b = photo[(y0 * PW + x1) * 3 + k], d = photo[(y1 * PW + x0) * 3 + k], e = photo[(y1 * PW + x1) * 3 + k];
      c[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
    }
    return c;
  };

  function solveAndDraw() {
    const { H, det } = homography(page, handles);
    overlay(svg, PW, PH);
    svgEl("polygon", { points: handles.map((p) => p.join(",")).join(" "), fill: "none", stroke: "var(--brand)", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }, svg);
    handles.forEach((p, i) => {
      const g = svgEl("g", { tabindex: 0, role: "button", "aria-label": `Corner ${["top left", "top right", "bottom right", "bottom left"][i]} of the page, at ${Math.round(p[0])}, ${Math.round(p[1])}; arrow keys move it`, "data-handle": i, class: "cursor-grab outline-none [&:focus-visible>circle:last-child]:stroke-[3]" }, svg);
      svgEl("circle", { cx: p[0], cy: p[1], r: 14, fill: "transparent" }, g);
      svgEl("circle", { cx: p[0], cy: p[1], r: 6, fill: "var(--background)", stroke: "var(--brand)", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }, g);
    });
    if (!H) {
      o.det.textContent = "0: three handles are collinear";
      o.err.textContent = o.off.textContent = "—";
      for (let i = 0; i < 9; i++) o[`h${i}`].textContent = "—";
      return;
    }
    const FW = Math.round(AW * FS), FH = Math.round(AH * FS);
    paintRGB(cflat, FW, FH, (x, y) => { const [u, v] = apply(H, (x + 0.5) / FS, (y + 0.5) / FS); return sample(u - 0.5, v - 0.5); });
    const err = Math.max(...page.map((p, i) => { const q = apply(H, ...p); return Math.hypot(q[0] - handles[i][0], q[1] - handles[i][1]); }));
    const off = handles.reduce((a, p, i) => a + Math.hypot(p[0] - truth[i][0], p[1] - truth[i][1]), 0) / 4;
    H.forEach((v, i) => (o[`h${i}`].textContent = i === 6 || i === 7 ? minus(v.toFixed(6)) : num(v, 3)));
    o.err.textContent = `${sci(err)} px`;
    o.off.textContent = off < 0.05 ? "on the corners" : `${num(off, 1)} px (mean)`;
    o.det.textContent = sci(det);
  }

  const toPhoto = (e) => pixelAt(e, svg, PW, PH);
  svg.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-handle]");
    if (!g) return;
    drag = Number(g.dataset.handle);
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    const [x, y] = toPhoto(e);
    handles[drag] = [Math.max(0, Math.min(PW, x)), Math.max(0, Math.min(PH, y))];
    solveAndDraw();
  });
  const end = () => { drag = -1; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-handle]");
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!g || !d) return;
    e.preventDefault();
    const i = Number(g.dataset.handle), st = e.shiftKey ? 10 : 1;
    handles[i] = [handles[i][0] + d[0] * st, handles[i][1] + d[1] * st];
    solveAndDraw();
    svg.querySelector(`[data-handle="${i}"]`)?.focus();
  });
  const misplace = () => {
    const rng = mulberry32(seed * 31 + handles.length);
    handles = truth.map(([x, y]) => [x + (rng() - 0.5) * 50, y + (rng() - 0.5) * 50]);
  };
  root.querySelector('[data-action="snap"]').addEventListener("click", () => { handles = truth.map((p) => [...p]); solveAndDraw(); });
  root.querySelector('[data-action="jitter"]').addEventListener("click", () => { seed += 0; misplace(); solveAndDraw(); });
  root.querySelector('[data-action="new"]').addEventListener("click", () => { seed++; makePhoto(); misplace(); solveAndDraw(); });
  onTheme(() => { pal = palette(); makePhoto(); solveAndDraw(); });
  makePhoto();
  misplace();
  solveAndDraw();
  // For checks: the true homography, page → photo.
  root.cvTrue = () => Htrue;
}

// ---------------------------------------------------------------- Stereo

for (const root of document.querySelectorAll("[data-cv-stereo]")) {
  const o = outs(root);
  const W = 128, H = 96, DMAX = 12;
  const cl = root.querySelector('[data-canvas="left"]'), cr = root.querySelector('[data-canvas="right"]'), cd = root.querySelector('[data-canvas="disp"]');
  let pal = palette(), showTruth = false, L, R, truth, est;
  const s = scrubAll(root, (name) => { if (["f", "b"].includes(name)) depths(); else { if (name !== "win") makePair(); match(); } });
  onToggle(root, (name, on) => { if (name === "truth") { showTruth = on; paintDisp(); } });

  const inSquare = (x, y) => x >= 18 && x < 62 && y >= 22 && y < 72;
  const inDisc = (x, y) => (x - 88) ** 2 + (y - 50) ** 2 < 22 ** 2;

  function makePair() {
    const rng = mulberry32(11), dens = s.density.get() / 100;
    const ds = [s.dbg.get(), s.dsq.get(), s.ddisc.get()];
    L = new Uint8Array(W * H); R = new Uint8Array(W * H); truth = new Int8Array(W * H);
    const layer = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      L[i] = rng() < dens ? 1 : 0;
      layer[i] = inDisc(x, y) ? 2 : inSquare(x, y) ? 1 : 0;
      truth[i] = ds[layer[i]];
    }
    // The right view: each left pixel moves left by its disparity, painted
    // far to near so near layers occlude; uncovered pixels get fresh dots.
    const painted = new Int8Array(W * H).fill(-1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) R[y * W + x] = rng() < dens ? 1 : 0;
    const order = [0, 1, 2].sort((a, b) => ds[a] - ds[b]);
    for (const lay of order) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (layer[i] !== lay) continue;
      const xr = x - ds[lay];
      if (xr < 0) continue;
      R[y * W + xr] = L[i];
      painted[y * W + xr] = lay;
    }
    paintRGB(cl, W, H, (x, y, i) => (L[i] ? pal.fg : pal.bg));
    paintRGB(cr, W, H, (x, y, i) => (R[i] ? pal.fg : pal.bg));
  }

  // Block matching: for each d, the absolute difference image, box-summed
  // through an integral image, so the cost is O(W · H · D) for any window.
  function match() {
    const r = (s.win.get() - 1) / 2;
    const best = new Float32Array(W * H).fill(Infinity);
    est = new Int8Array(W * H);
    const ii = new Float64Array((W + 1) * (H + 1));
    for (let d = 0; d <= DMAX; d++) {
      for (let y = 0; y < H; y++) {
        let row = 0;
        for (let x = 0; x < W; x++) {
          const xr = x - d;
          row += xr < 0 ? 1 : Math.abs(L[y * W + x] - R[y * W + xr]);
          ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1] + row;
        }
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(W - 1, x + r), y0 = Math.max(0, y - r), y1 = Math.min(H - 1, y + r);
        const sum = ii[(y1 + 1) * (W + 1) + x1 + 1] - ii[y0 * (W + 1) + x1 + 1] - ii[(y1 + 1) * (W + 1) + x0] + ii[y0 * (W + 1) + x0];
        const cost = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
        if (cost < best[y * W + x] - 1e-9) { best[y * W + x] = cost; est[y * W + x] = d; }
      }
    }
    let ok = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = DMAX; x < W; x++) { n++; if (est[y * W + x] === truth[y * W + x]) ok++; }
    o.acc.textContent = `${num((100 * ok) / n, 1)}%`;
    paintDisp();
    depths();
  }

  function paintDisp() {
    const m = showTruth ? truth : est;
    paintRGB(cd, W, H, (x, y, i) => mix(pal.bg, pal.brand, 0.12 + (0.88 * m[i]) / DMAX));
    paintScan();
    root.querySelector('[data-caption="disp"]').textContent = showTruth ? "ground truth disparity (bright = near)" : "disparity found (bright = near) · hover";
  }
  const Z = (d) => (d <= 0 ? "∞ (d = 0)" : `${num((s.f.get() * s.b.get()) / 100 / d, 2)} m`);
  function depths() {
    o.zbg.textContent = Z(s.dbg.get());
    o.zsq.textContent = Z(s.dsq.get());
    o.zdisc.textContent = Z(s.ddisc.get());
  }
  const scan = root.querySelector('[data-plot="scan"]');
  let row = 50;
  function paintScan() {
    scan.replaceChildren();
    const f = frame(scan, { box: [34, 10, 590, 128], x: [0, W - 1], y: [0, DMAX], xticks: [0, 32, 64, 96, 127], yticks: [0, 4, 8, 12], xlabel: "x (px)", ylabel: "d (px)" });
    const pts = (m) => { const p = []; for (let x = 0; x < W; x++) { p.push([f.sx(x - 0.5), f.sy(m[row * W + x])], [f.sx(x + 0.5), f.sy(m[row * W + x])]); } return p; };
    polyline(scan, pts(truth), "stroke:var(--muted-foreground);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(scan, pts(est), "stroke:var(--brand);stroke-width:2");
    o.row.textContent = `row ${row} · hover the map to change`;
  }
  cd.addEventListener("pointermove", (e) => {
    const [px, py] = pixelAt(e, cd, W, H);
    const x = Math.min(W - 1, Math.max(0, Math.floor(px))), y = Math.min(H - 1, Math.max(0, Math.floor(py)));
    if (y !== row) { row = y; paintScan(); }
    const d = est[y * W + x];
    o.hover.textContent = `d = ${d} px → Z = ${Z(d)}${d === truth[y * W + x] ? "" : ` (true d = ${truth[y * W + x]})`}`;
  });
  onTheme(() => { pal = palette(); makePair(); paintDisp(); });
  makePair();
  match();
}

// ---------------------------------------------------------------- Lucas–Kanade

for (const root of document.querySelectorAll("[data-cv-flow]")) {
  const o = outs(root);
  const W = 160, H = 120;
  const canvas = root.querySelector('[data-canvas="img"]'), svg = root.querySelector('[data-overlay="img"]');
  const btn = root.querySelector('[data-action="play"]');
  const setPlay = playButton(btn, ["Play", "Pause"]);
  let pal = palette(), playing = false, tx = 0, ty = 0, acc = 0;
  const pattern = seg(root, "pattern", () => draw());
  const s = scrubAll(root, () => draw());

  // Smooth, periodic textures, so the motion can loop and be sub-pixel.
  const rng = mulberry32(8);
  const blobs = Array.from({ length: 46 }, () => [rng() * W, rng() * H, 4 + rng() * 5, (rng() < 0.5 ? -1 : 1) * (40 + rng() * 50)]);
  const wrap = (d, P) => d - P * Math.round(d / P);
  const smooth = (e) => 1 / (1 + Math.exp(-e / 1.2));
  const fns = {
    blobs: (x, y) => {
      let v = 128;
      for (const [bx, by, r, a] of blobs) {
        const dx = wrap(x - bx, W), dy = wrap(y - by, H), q = (dx * dx + dy * dy) / (r * r);
        if (q < 9) v += a * Math.exp(-q);
      }
      return v;
    },
    stripes: (x, y) => 128 + 80 * Math.sin((2 * Math.PI * (x * 0.866 + y * 0.5)) / 16),
    square: (x, y) => {
      const dx = wrap(x - 80, W), dy = wrap(y - 60, H);
      return 50 + 160 * smooth(28 - Math.abs(dx)) * smooth(28 - Math.abs(dy));
    },
  };

  function render(fn, ox, oy) {
    const img = new Float32Array(W * H);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) img[i] = fn(x - ox, y - oy);
    return img;
  }

  function draw() {
    const fn = fns[pattern()], u = s.u.get(), v = s.v.get();
    const I0 = render(fn, tx, ty), I1 = render(fn, tx + u, ty + v);
    paintRGB(canvas, W, H, (x, y, i) => mix(pal.bg, pal.fg, Math.max(0, Math.min(1, I0[i] / 255))));
    overlay(svg, W, H);
    const r = (s.win.get() - 1) / 2, step = 12;
    let n = 0, su = 0, sv = 0, serr = 0, ap = 0, tot = 0;
    for (let cy = 12; cy < H - 8; cy += step) for (let cx = 12; cx < W - 8; cx += step) {
      let a = 0, b = 0, c = 0, p = 0, q = 0;
      for (let y = Math.max(1, cy - r); y <= Math.min(H - 2, cy + r); y++) for (let x = Math.max(1, cx - r); x <= Math.min(W - 2, cx + r); x++) {
        const i = y * W + x;
        // Gradients of the average of the two frames: symmetric, more accurate.
        const ix = (I0[i + 1] - I0[i - 1] + I1[i + 1] - I1[i - 1]) / 4;
        const iy = (I0[i + W] - I0[i - W] + I1[i + W] - I1[i - W]) / 4;
        const it = I1[i] - I0[i];
        a += ix * ix; b += ix * iy; c += iy * iy; p += ix * it; q += iy * it;
      }
      tot++;
      const tr = a + c, det = a * c - b * b, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
      const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
      const area = (2 * r + 1) ** 2;
      if (l1 / area < 1) { svgEl("circle", { cx: cx + 0.5, cy: cy + 0.5, r: 0.8, fill: "var(--muted-foreground)" }, svg); continue; }
      let fu, fv, color;
      if (l2 < 0.02 * l1) {
        // Only the component along the dominant gradient direction e₁.
        let e = Math.abs(b) > 1e-9 ? [b, l1 - a] : a >= c ? [1, 0] : [0, 1];
        const el2 = Math.hypot(...e); e = [e[0] / el2, e[1] / el2];
        const m = -(e[0] * p + e[1] * q) / l1;
        fu = m * e[0]; fv = m * e[1]; color = "var(--muted-foreground)"; ap++;
      } else {
        fu = -(c * p - b * q) / det; fv = -(a * q - b * p) / det; color = "var(--brand)";
        n++; su += fu; sv += fv; serr += Math.hypot(fu - u, fv - v);
      }
      const k = 6, x2 = cx + 0.5 + fu * k, y2 = cy + 0.5 + fv * k;
      const len = Math.hypot(fu, fv) * k;
      svgEl("line", { x1: cx + 0.5, y1: cy + 0.5, x2, y2, stroke: color, "stroke-width": 1.75, "vector-effect": "non-scaling-stroke", "stroke-linecap": "round" }, svg);
      if (len > 2) {
        const ang = Math.atan2(fv, fu), hl = Math.min(3, len * 0.45);
        const pts = [[x2, y2], [x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45)], [x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45)]];
        svgEl("polygon", { points: pts.map((pt) => pt.join(",")).join(" "), fill: color }, svg);
      }
    }
    o.truth.textContent = `(${num(u, 2)}, ${num(v, 2)}) px`;
    o.mean.textContent = n ? `(${num(su / n, 2)}, ${num(sv / n, 2)}) px` : "none (all aperture)";
    o.err.textContent = n ? `${num(serr / n, 3)} px` : "—";
    o.ap.textContent = `${ap} of ${tot}`;
  }

  const kick = loop(root, () => playing, (dt) => {
    acc += dt;
    if (acc < 1 / 24) return;
    acc = 0;
    tx = (tx + s.u.get()) % W; ty = (ty + s.v.get()) % H;
    draw();
  });
  btn.addEventListener("click", () => { playing = !playing; setPlay(playing); kick(); });
  setPlay(false);
  onTheme(() => { pal = palette(); draw(); });
  draw();
}

// ---------------------------------------------------------------- RANSAC

for (const root of document.querySelectorAll("[data-cv-ransac]")) {
  const o = outs(root);
  const svg = root.querySelector('[data-plot="plot"]');
  let seed = 6, pts = [], isIn = [], planted = [0, 0], tries = 0, best = null, last = null, anim = 0;
  const s = scrubAll(root, (name) => {
    if (["n", "out", "sd"].includes(name)) makeData();
    reset();
  });

  function makeData() {
    const rng = mulberry32(seed);
    // A clearly sloped line through a point near the middle of the plot.
    const a = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.45);
    planted = [a, 3.5 + rng() * 3 - a * 5];
    const n = s.n.get(), nOut = Math.round((n * s.out.get()) / 100);
    pts = []; isIn = [];
    for (let i = 0; i < n; i++) {
      if (i < nOut) { pts.push([rng() * 10, rng() * 10]); isIn.push(false); } else {
        const x = rng() * 10;
        pts.push([x, planted[0] * x + planted[1] + s.sd.get() * gauss(rng)]);
        isIn.push(true);
      }
    }
  }
  const fitLS = (P) => {
    const n = P.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const [x, y] of P) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) return null;
    const a = (n * sxy - sx * sy) / den;
    return [a, (sy - a * sx) / n];
  };
  // Perpendicular distance to y = a x + b.
  const dist = ([a, b], [x, y]) => Math.abs(a * x - y + b) / Math.hypot(a, 1);

  function oneTry(rng) {
    const i = Math.floor(rng() * pts.length);
    let j = Math.floor(rng() * (pts.length - 1));
    if (j >= i) j++;
    const [p, q] = [pts[i], pts[j]];
    if (Math.abs(q[0] - p[0]) < 1e-9) { tries++; last = { i, j, line: null, count: 0 }; return; }
    const a = (q[1] - p[1]) / (q[0] - p[0]), line = [a, p[1] - a * p[0]];
    const tol = s.tol.get();
    const count = pts.reduce((c, pt) => c + (dist(line, pt) < tol ? 1 : 0), 0);
    tries++;
    last = { i, j, line, count };
    if (!best || count > best.count) best = { line, count };
  }
  let rng = mulberry32(1);
  function reset() {
    cancelAnimationFrame(anim);
    tries = 0; best = null; last = null; rng = mulberry32(seed * 7 + 1);
    draw();
  }

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 16, 584, 344], x: [0, 10], y: [0, 10], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 2, 4, 6, 8, 10], xlabel: "x", ylabel: "y" });
    const clip = el("clipPath", { id: "cv-ransac-clip" }, el("defs", {}, svg));
    el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, clip);
    const g = el("g", { "clip-path": "url(#cv-ransac-clip)" }, svg);
    const lineOf = (l, style) => l && el("line", { x1: f.sx(0), y1: f.sy(l[1]), x2: f.sx(10), y2: f.sy(l[0] * 10 + l[1]), style }, g);
    const tol = s.tol.get();
    const band = (l, style) => {
      if (!l) return;
      const h = tol * Math.hypot(l[0], 1);
      el("polygon", { points: [[0, l[1] + h], [10, l[0] * 10 + l[1] + h], [10, l[0] * 10 + l[1] - h], [0, l[1] - h]].map(([x, y]) => `${f.sx(x)},${f.sy(y)}`).join(" "), style }, g);
    };
    if (last?.line) band(last.line, "fill:var(--vec-u);fill-opacity:0.1");
    let final = null, inl = [];
    if (best) {
      inl = pts.filter((p) => dist(best.line, p) < tol);
      final = fitLS(inl) ?? best.line;
      band(best.line, "fill:var(--brand);fill-opacity:0.1");
    }
    lineOf(planted, "stroke:var(--muted-foreground);stroke-width:1.5;stroke-dasharray:6 5");
    const ls = fitLS(pts);
    lineOf(ls, "stroke:var(--vec-out);stroke-width:2");
    if (final) lineOf(final, "stroke:var(--brand);stroke-width:2.5");
    for (const p of pts) {
      const on = best && dist(best.line, p) < tol;
      el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 3.2, style: on ? "fill:var(--brand)" : "fill:var(--muted-foreground);fill-opacity:0.65" }, g);
    }
    if (last) for (const k of [last.i, last.j]) el("circle", { cx: f.sx(pts[k][0]), cy: f.sy(pts[k][1]), r: 7, style: "fill:none;stroke:var(--vec-u);stroke-width:2" }, g);
    const fmt = (l) => (l ? `y = ${num(l[0], 3)}x ${l[1] < 0 ? "−" : "+"} ${num(Math.abs(l[1]), 2)}` : "—");
    o.true.textContent = fmt(planted);
    o.ls.textContent = fmt(ls);
    o.rs.textContent = final ? fmt(final) : "press One try or Run all";
    const nIn = isIn.filter(Boolean).length;
    o.inl.textContent = best ? `${inl.length} found · ${nIn} planted` : `${nIn} planted`;
    o.tries.textContent = `${tries} of ${s.iters.get()}`;
    const w = nIn / pts.length;
    o.need.textContent = w >= 1 ? "1" : w <= 0 ? "∞" : `${Math.ceil(Math.log(0.01) / Math.log(1 - w * w))} (w = ${num(w, 2)})`;
  }

  root.querySelector('[data-action="step"]').addEventListener("click", () => { if (tries < s.iters.get()) oneTry(rng); draw(); });
  root.querySelector('[data-action="run"]').addEventListener("click", () => {
    cancelAnimationFrame(anim);
    const total = s.iters.get();
    if (reduced()) { while (tries < total) oneTry(rng); draw(); return; }
    const t0 = performance.now(), start = tries, dur = 1200;
    const tick = (t) => {
      const target = Math.min(total, start + Math.ceil(((t - t0) / dur) * (total - start)));
      while (tries < target) oneTry(rng);
      draw();
      if (tries < total) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  });
  root.querySelector('[data-action="new"]').addEventListener("click", () => { seed++; makeData(); reset(); });
  makeData();
  reset();
}
