// Computer graphics, part 2: renderers that compute every pixel. Images are
// computed in linear light and encoded to sRGB on the way out.

import { scrubAll } from "./scrub.js";
import { el, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

// ---------------------------------------------------------------- colour

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const enc = (c) => Math.round(255 * Math.min(1, Math.max(0, linearToSrgb(Math.max(0, c)))));

// OKLab, after Björn Ottosson (2020), from and to linear sRGB.
export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
function rgbToHsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

// Resolves any CSS colour (var(), oklch, hex) to linear RGB by painting it.
const probeCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function cssLinear(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = getComputedStyle(probeEl).color;
  probeCtx.fillRect(0, 0, 1, 1);
  return [...probeCtx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => srgbToLinear(v / 255));
}

// fit sizes a canvas's backing store to its box (device pixel ratio ≤ 2,
// capped at `max` pixels wide) and returns the context.
function fit(canvas, max = 720) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.min(max, Math.round(r.width * dpr)));
  const h = Math.max(1, Math.round((w * r.height) / Math.max(1, r.width)));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return canvas.getContext("2d");
}

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ============================================================ Lighting

for (const root of document.querySelectorAll("[data-gfx-lighting]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let model = "lambert", terms = false, L = norm([-0.5, 0.6, 0.65]), base;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { model = e.detail.value; draw(); });
  onToggle(root, (k, on) => { terms = on; draw(); });
  const setLight = (e) => {
    const r = canvas.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * 2 - 1, v = 1 - ((e.clientY - r.top) / r.height) * 2;
    const z2 = 1 - u * u - v * v;
    L = norm([u, v, z2 > 0 ? Math.sqrt(z2) + 0.15 : 0.15]);
    draw();
  };
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); setLight(e); });
  canvas.addEventListener("pointermove", (e) => { if (canvas.hasPointerCapture(e.pointerId)) setLight(e); });

  function shade(N, which) {
    const V = [0, 0, 1];
    const ndl = Math.max(0, dot(N, L));
    const amb = s.ambient.get(), n = s.shine.get();
    let spec = 0;
    if (model === "phong" && ndl > 0) {
      const R = sub(mul(N, 2 * dot(N, L)), L);
      spec = Math.max(0, dot(R, V)) ** n;
    } else if (model === "blinn" && ndl > 0) {
      const Hh = norm(add(L, V));
      spec = Math.max(0, dot(N, Hh)) ** n;
    }
    const d = which === "spec" ? 0 : which === "amb" ? 0 : ndl;
    const a = which === "spec" || which === "diff" ? 0 : amb;
    const sp = which === "diff" || which === "amb" ? 0 : spec * 0.8;
    return base.map((c) => c * (a + d * (1 - amb)) + sp);
  }

  function draw() {
    base = cssLinear("var(--brand)");
    const ctx = fit(canvas, 420);
    const W = canvas.width, H = canvas.height;
    const img = ctx.createImageData(W, H);
    const bg = cssLinear("var(--code-bg)");
    const spheres = terms ? [["amb", 0.18, 0.5], ["diff", 0.5, 0.5], ["spec", 0.82, 0.5]] : [["all", 0.5, 0.5]];
    const R = (terms ? 0.15 : 0.42) * W;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = bg;
      for (const [which, cx, cy] of spheres) {
        const dx = (x + 0.5 - cx * W) / R, dy = -(y + 0.5 - cy * H) / R, r2 = dx * dx + dy * dy;
        if (r2 <= 1) c = shade([dx, dy, Math.sqrt(1 - r2)], which);
      }
      const k = (y * W + x) * 4;
      img.data[k] = enc(c[0]); img.data[k + 1] = enc(c[1]); img.data[k + 2] = enc(c[2]); img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (terms) {
      ctx.fillStyle = getComputedStyle(root).color;
      ctx.font = `${Math.round(W / 34)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      [["ambient", 0.18], ["diffuse", 0.5], ["specular", 0.82]].forEach(([t, cx]) => ctx.fillText(t, cx * W, H * 0.5 + R + W / 22));
    }
    o.light.textContent = `(${L.map((v) => num(v, 2)).join(", ")})`;
    o.ndotl.textContent = `${num(Math.max(0, L[2]), 3)} (cos ${num((Math.acos(Math.min(1, L[2])) * 180) / Math.PI, 0)}°)`;
  }
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(draw);
}

// ============================================================ Ray tracer

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const root of document.querySelectorAll("[data-gfx-raytracer]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const RW = 200, RH = 150, MAX_SPP = 64;
  const opts = { shadows: true, aa: true };
  let acc = new Float32Array(RW * RH * 3), spp = 0, rays = 0, raf = 0, visible = false, rng = mulberry32(1);
  const s = scrubAll(root, restart);
  onToggle(root, (k, on) => { opts[k] = on; restart(); });

  const scene = () => ({
    light: [s.lightx.get(), 4, -1],
    spheres: [
      { c: [0, 0, -4.2], r: 1, color: [0.9, 0.9, 0.92], mirror: s.reflect.get(), spec: 64 },
      { c: [-2.2, -0.4, -5.2], r: 0.6, color: [0.85, 0.12, 0.1], mirror: 0, spec: 16 },
      { c: [2.1, -0.3, -3.6], r: 0.7, color: [0.05, 0.3, 0.85], mirror: 0.1, spec: 48 },
    ],
  });

  function hit(S, o3, d) {
    let best = { t: Infinity };
    for (const sp of S.spheres) {
      const oc = sub(o3, sp.c), b = dot(oc, d), c = dot(oc, oc) - sp.r * sp.r, disc = b * b - c;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      let t = -b - sq;
      if (t < 1e-4) t = -b + sq;
      if (t > 1e-4 && t < best.t) { const p = add(o3, mul(d, t)); best = { t, p, n: norm(sub(p, sp.c)), m: sp }; }
    }
    if (d[1] < 0) { // the floor, y = −1
      const t = (-1 - o3[1]) / d[1];
      if (t > 1e-4 && t < best.t) {
        const p = add(o3, mul(d, t));
        const check = (Math.floor(p[0]) + Math.floor(p[2])) & 1;
        best = { t, p, n: [0, 1, 0], m: { color: check ? [0.75, 0.75, 0.75] : [0.12, 0.12, 0.12], mirror: 0.15, spec: 0 } };
      }
    }
    return best;
  }

  function trace(S, o3, d, depth) {
    rays++;
    const h = hit(S, o3, d);
    if (h.t === Infinity) { const k = 0.5 * (d[1] + 1); return [0.55 + 0.25 * k, 0.65 + 0.2 * k, 0.85 + 0.15 * k].map((v) => v * 0.9); }
    const toL = sub(S.light, h.p), distL = Math.hypot(...toL), Ld = mul(toL, 1 / distL);
    let lit = Math.max(0, dot(h.n, Ld));
    if (opts.shadows && lit > 0) {
      rays++;
      const sh = hit(S, add(h.p, mul(h.n, 1e-3)), Ld);
      if (sh.t < distL) lit = 0;
    }
    let col = mul(h.m.color, 0.06 + 0.94 * lit);
    if (h.m.spec && lit > 0) {
      const Hh = norm(sub(Ld, d));
      col = add(col, mul([1, 1, 1], 0.6 * Math.max(0, dot(h.n, Hh)) ** h.m.spec));
    }
    if (h.m.mirror > 0 && depth > 0) {
      const r = sub(d, mul(h.n, 2 * dot(d, h.n)));
      const rc = trace(S, add(h.p, mul(h.n, 1e-3)), r, depth - 1);
      col = add(mul(col, 1 - h.m.mirror), mul(rc, h.m.mirror));
    }
    return col;
  }

  function pass() {
    const S = scene(), depth = Math.round(s.depth.get());
    const tanF = Math.tan((60 * Math.PI) / 360), aspect = RW / RH;
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const jx = opts.aa ? rng() : 0.5, jy = opts.aa ? rng() : 0.5;
      const u = ((2 * (x + jx)) / RW - 1) * tanF * aspect, v = (1 - (2 * (y + jy)) / RH) * tanF;
      const c = trace(S, [0, 0.2, 0], norm([u, v - 0.08, -1]), depth);
      const k = (y * RW + x) * 3;
      acc[k] += c[0]; acc[k + 1] += c[1]; acc[k + 2] += c[2];
    }
    spp++;
  }

  function show() {
    const ctx = fit(canvas, 560);
    const img = new ImageData(RW, RH);
    for (let i = 0; i < RW * RH; i++) {
      img.data[i * 4] = enc(acc[i * 3] / spp);
      img.data[i * 4 + 1] = enc(acc[i * 3 + 1] / spp);
      img.data[i * 4 + 2] = enc(acc[i * 3 + 2] / spp);
      img.data[i * 4 + 3] = 255;
    }
    const off = new OffscreenCanvas(RW, RH);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    o.spp.textContent = `${spp}${spp >= MAX_SPP || !opts.aa ? " (done)" : ""}`;
    o.rays.textContent = rays.toLocaleString("en");
    o.res.textContent = `${RW} × ${RH}, drawn at ${canvas.width} × ${canvas.height}`;
  }

  const frame = () => {
    raf = 0;
    if (!visible) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 12 && spp < MAX_SPP) pass();
    show();
    // Without jitter every sample is the same: one pass is the image.
    if (spp < MAX_SPP && opts.aa) raf = requestAnimationFrame(frame);
  };
  function restart() {
    acc = new Float32Array(RW * RH * 3); spp = 0; rays = 0; rng = mulberry32(1);
    cancelAnimationFrame(raf); raf = 0;
    if (reduced()) { for (let i = 0; i < (opts.aa ? 8 : 1); i++) pass(); show(); return; }
    pass();
    show();
    if (visible && opts.aa) raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && spp < MAX_SPP && opts.aa && !reduced()) raf = requestAnimationFrame(frame);
  }).observe(root);
  // One pass right away, so the block is never blank; the rest of the
  // samples accumulate while it is on screen.
  pass();
  requestAnimationFrame(show);
  new ResizeObserver(() => spp && show()).observe(canvas);
}

// ============================================================ Texture sampling

for (const root of document.querySelectorAll("[data-gfx-texture]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const N = 512; // texels per side
  let filter = "nearest", tint = false, mips = null, builtFor = 0;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { filter = e.detail.value; draw(); });
  onToggle(root, (k, on) => { tint = on; draw(); });

  // A checkerboard texture (linear values) and its box-filtered mip chain.
  function build(tiles) {
    const base = new Float32Array(N * N);
    const cell = N / tiles;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      base[y * N + x] = (Math.floor(x / cell) + Math.floor(y / cell)) & 1 ? 0.85 : 0.03;
    mips = [base];
    for (let n = N / 2; n >= 1; n /= 2) {
      const prev = mips.at(-1), next = new Float32Array(n * n), pn = n * 2;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
        next[y * n + x] = (prev[2 * y * pn + 2 * x] + prev[2 * y * pn + 2 * x + 1] + prev[(2 * y + 1) * pn + 2 * x] + prev[(2 * y + 1) * pn + 2 * x + 1]) / 4;
      mips.push(next);
    }
    builtFor = tiles;
  }
  const wrap = (v, n) => ((v % n) + n) % n;
  const texel = (lv, x, y) => { const n = N >> lv; return mips[lv][wrap(y, n) * n + wrap(x, n)]; };
  const bilinear = (lv, u, v) => {
    const n = N >> lv, x = u * n - 0.5, y = v * n - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    return (texel(lv, x0, y0) * (1 - fx) + texel(lv, x0 + 1, y0) * fx) * (1 - fy) + (texel(lv, x0, y0 + 1) * (1 - fx) + texel(lv, x0 + 1, y0 + 1) * fx) * fy;
  };
  const LEVEL_TINT = [[1, 0.3, 0.3], [1, 0.75, 0.2], [0.3, 0.9, 0.3], [0.2, 0.8, 1], [0.6, 0.4, 1], [1, 0.4, 0.9]];

  function draw() {
    const tiles = Math.round(s.tiles.get());
    if (tiles !== builtFor) build(tiles);
    const ctx = fit(canvas, 640);
    const W = Math.min(320, canvas.width), H = Math.round((W * canvas.height) / canvas.width);
    const img = new ImageData(W, H);
    const hy = Math.round(H * 0.3), cam = s.tilt.get(), f = W * 0.9;
    const sky = cssLinear("var(--code-bg)");
    // Ground point under pixel (x, y): depth from the camera height, then
    // world coordinates scaled so one texture covers 8 × 8 world units.
    const uvAt = (x, y) => { const z = (cam * f) / (y - hy); return [((x - W / 2) * z) / f / 8, z / 8]; };
    let horizonDensity = 0, levelShown = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      let c;
      if (y <= hy + 1) c = sky;
      else {
        const [u, v] = uvAt(x + 0.5, y + 0.5);
        // Texel footprint of one pixel, from neighbouring pixels.
        const [u2] = uvAt(x + 1.5, y + 0.5), [, v2] = uvAt(x + 0.5, y + 1.5);
        const fp = Math.max(Math.abs(u2 - u), Math.abs(v2 - v)) * N;
        const lvF = Math.max(0, Math.min(mips.length - 1, Math.log2(Math.max(1, fp))));
        let g;
        if (filter === "nearest") g = texel(0, Math.floor(u * N), Math.floor(v * N));
        else if (filter === "bilinear") g = bilinear(0, u, v);
        else { // trilinear: blend the two nearest levels
          const l0 = Math.floor(lvF), l1 = Math.min(mips.length - 1, l0 + 1), t = lvF - l0;
          g = bilinear(l0, u, v) * (1 - t) + bilinear(l1, u, v) * t;
        }
        c = [g, g, g];
        if (tint && filter === "mipmap") c = c.map((ch, i) => ch * 0.55 + 0.45 * LEVEL_TINT[Math.round(lvF) % LEVEL_TINT.length][i] * Math.max(ch, 0.25));
        if (y === hy + 3 && x === W >> 1) { horizonDensity = fp; levelShown = lvF; }
      }
      img.data[k] = enc(c[0]); img.data[k + 1] = enc(c[1]); img.data[k + 2] = enc(c[2]); img.data[k + 3] = 255;
    }
    const off = new OffscreenCanvas(W, H);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    o.density.textContent = `≈ ${num(horizonDensity, 0)}`;
    o.level.textContent = filter === "mipmap" ? num(levelShown, 1) : "0 (no mipmap)";
  }
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(draw);
}

// ============================================================ Colour spaces

const hex = (lin) => "#" + lin.map((c) => enc(c).toString(16).padStart(2, "0")).join("");
function parseHex(s) {
  const m = s.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));
}

for (const root of document.querySelectorAll("[data-gfx-color]")) {
  const o = outs(root);
  const swatch = root.querySelector("[data-swatch]");
  const values = root.querySelector("[data-values]");
  const grads = root.querySelector("[data-gradients]");
  const hex2 = root.querySelector("[data-hex2]");
  const s = scrubAll(root, draw);
  hex2.addEventListener("input", draw);

  const row = (k, v) => [Object.assign(document.createElement("span"), { className: "text-muted-foreground", textContent: k }), Object.assign(document.createElement("span"), { className: "tabular-nums", textContent: v })];

  function draw() {
    const L = s.L.get(), C = s.C.get(), hDeg = s.H.get(), hr = (hDeg * Math.PI) / 180;
    const lab = [L, C * Math.cos(hr), C * Math.sin(hr)];
    const lin = oklabToLinear(lab);
    const inGamut = lin.every((c) => c >= -1e-4 && c <= 1 + 1e-4);
    const clamped = lin.map((c) => Math.min(1, Math.max(0, c)));
    const srgb = clamped.map(linearToSrgb);
    const hsl = rgbToHsl(srgb);
    swatch.style.background = hex(clamped);
    values.replaceChildren(
      ...row("hex", hex(clamped)),
      ...row("sRGB", srgb.map((c) => Math.round(c * 255)).join(", ")),
      ...row("linear", clamped.map((c) => num(c, 4)).join(", ")),
      ...row("HSL", `${num(hsl[0], 0)}°, ${num(hsl[1] * 100, 0)}%, ${num(hsl[2] * 100, 0)}%`),
      ...row("OKLab", lab.map((c) => num(c, 3)).join(", ")),
      ...row("OKLCH", `${num(L, 3)}, ${num(C, 3)}, ${num(hDeg, 0)}°`),
    );
    o.gamut.textContent = inGamut ? "yes" : `no: clipped (raw linear ${lin.map((c) => num(c, 2)).join(", ")})`;
    o.gamut.className = inGamut ? "tabular-nums" : "tabular-nums text-del";

    const b = parseHex(hex2.value) ?? [0.012, 0.16, 0.83];
    hex2.setAttribute("aria-invalid", String(!parseHex(hex2.value)));
    const a = clamped;
    const mixes = {
      "sRGB (gamma-encoded)": (t) => { const sa = a.map(linearToSrgb), sb = b.map(linearToSrgb); return sa.map((c, i) => srgbToLinear(c + (sb[i] - c) * t)); },
      "linear light": (t) => a.map((c, i) => c + (b[i] - c) * t),
      OKLab: (t) => { const la = linearToOklab(a), lb = linearToOklab(b); return oklabToLinear(la.map((c, i) => c + (lb[i] - c) * t)).map((c) => Math.min(1, Math.max(0, c))); },
    };
    grads.replaceChildren(...Object.entries(mixes).map(([name, f]) => {
      const wrap = document.createElement("div");
      wrap.className = "grid grid-cols-[7.5rem_1fr] items-center gap-2";
      const label = Object.assign(document.createElement("span"), { className: "font-mono text-[11px] text-muted-foreground", textContent: name });
      const bar = document.createElement("div");
      bar.className = "h-7 rounded-md border";
      const stops = Array.from({ length: 17 }, (_, i) => `${hex(f(i / 16))} ${((i / 16) * 100).toFixed(1)}%`);
      bar.style.background = `linear-gradient(to right, ${stops.join(", ")})`;
      wrap.append(label, bar);
      return wrap;
    }));
  }
  draw();
}

// ============================================================ Distance fields

for (const root of document.querySelectorAll("[data-gfx-sdf]")) {
  const canvas = root.querySelector("[data-canvas]");
  const overlay = root.querySelector("[data-overlay]");
  const o = outs(root);
  let op = "smooth", ray = null;
  const s = scrubAll(root, () => { draw(); if (ray) march(ray); });
  root.addEventListener("seg-change", (e) => { op = e.detail.value; draw(); if (ray) march(ray); });

  // World: x ∈ [−4, 4], y ∈ [−3, 3]. A circle and an axis-aligned box.
  const circle = (p, c, r) => Math.hypot(p[0] - c[0], p[1] - c[1]) - r;
  const box = (p, c, b) => {
    const qx = Math.abs(p[0] - c[0]) - b[0], qy = Math.abs(p[1] - c[1]) - b[1];
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
  };
  // Polynomial smooth minimum (Inigo Quilez).
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - (h * h * k) / 4; };
  const sdf = (p) => {
    const g = s.gap.get();
    const a = circle(p, [-g / 2 - 0.3, 0], 1.1), b = box(p, [g / 2 + 0.3, 0], [0.9, 0.7]);
    if (op === "union") return Math.min(a, b);
    if (op === "subtract") return Math.max(a, -b);
    if (op === "intersect") return Math.max(a, b);
    return smin(a, b, s.k.get());
  };
  const toWorld = (fx, fy) => [fx * 8 - 4, 3 - fy * 6];

  function draw() {
    const ctx = fit(canvas, 560);
    const W = Math.min(400, canvas.width), H = Math.round((W * 3) / 4);
    const img = new ImageData(W, H);
    const inside = cssLinear("var(--brand)"), outside = cssLinear("var(--vec-u)"), bg = cssLinear("var(--code-bg)");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = sdf(toWorld((x + 0.5) / W, (y + 0.5) / H));
      const tint = d < 0 ? inside : outside;
      // Iso-distance bands every 0.25, fading with distance (after Quilez).
      const band = 0.8 + 0.2 * Math.cos(2 * Math.PI * d * 4);
      const fade = Math.exp(-1.2 * Math.abs(d));
      const w = (d < 0 ? 0.55 : 0.35) * band * fade;
      const edge = Math.max(0, 1 - Math.abs(d) * W / 8 / 1.2); // dark outline at d = 0
      const c = bg.map((v, i) => (v * (1 - w) + tint[i] * w) * (1 - 0.85 * edge));
      const k = (y * W + x) * 4;
      img.data[k] = enc(c[0]); img.data[k + 1] = enc(c[1]); img.data[k + 2] = enc(c[2]); img.data[k + 3] = 255;
    }
    const off = new OffscreenCanvas(W, H);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  // Sphere tracing from p towards +x: step by the distance until it is tiny.
  function march(p0) {
    overlay.replaceChildren();
    const sx = (x) => ((x + 4) / 8) * 400, sy = (y) => ((3 - y) / 6) * 300;
    let p = p0.slice(), steps = 0, hitP = null;
    for (; steps < 64; steps++) {
      const d = sdf(p);
      if (Math.abs(d) < 1e-3) { hitP = p; break; }
      if (p[0] > 4.5) break;
      const r = Math.abs(d);
      el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: (r / 8) * 400, style: "fill:none;stroke:var(--foreground);stroke-opacity:0.45;stroke-width:1" }, overlay);
      el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: 2, style: "fill:var(--foreground)" }, overlay);
      p = [p[0] + r, p[1]];
    }
    el("line", { x1: sx(p0[0]), y1: sy(p0[1]), x2: sx(Math.min(p[0], 4.5)), y2: sy(p0[1]), style: "stroke:var(--foreground);stroke-width:1.25;stroke-dasharray:4 3" }, overlay);
    if (hitP) el("circle", { cx: sx(hitP[0]), cy: sy(hitP[1]), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, overlay);
    o.steps.textContent = hitP ? `${steps} (hit at x = ${num(hitP[0], 3)})` : steps >= 64 ? "64 (gave up)" : `${steps} (missed)`;
  }

  const at = (e) => { const r = canvas.getBoundingClientRect(); return toWorld((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  canvas.addEventListener("pointermove", (e) => { o.d.textContent = num(sdf(at(e)), 3); });
  canvas.addEventListener("click", (e) => { ray = at(e); march(ray); });
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(draw);
  ray = [-3.6, 0.35];
  march(ray);
}
