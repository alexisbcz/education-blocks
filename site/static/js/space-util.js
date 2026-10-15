// Shared helpers for the space systems blocks: constants, orbit
// propagation, small vector maths and a schematic world outline. Exports
// only; loading this module on its own does nothing.

import { el } from "./plot.js";

export const MU = 398600.4418; // km³/s²
export const RE = 6378.137; // km
export const J2 = 1.08263e-3;
export const OMEGA_E = 7.2921159e-5; // rad/s, sidereal
export const SIDEREAL_DAY = (2 * Math.PI) / OMEGA_E; // s
export const DEG = Math.PI / 180;
export const SUN_RATE = (360 / 365.2422) * DEG / 86400; // rad/s the Sun moves along the ecliptic

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
export const onToggle = (root, name, fn) => root.querySelector(`[data-toggle="${name}"]`)?.addEventListener("shadcn:checked-change", (e) => fn(!!e.detail.checked));
export const setSeg = (root, label, value) => {
  const list = root.querySelector(`[role=tablist][aria-label="${label}"]`);
  for (const b of list?.querySelectorAll("[data-seg]") ?? []) b.setAttribute("aria-selected", String(b.dataset.seg === value));
};
export const minutes = (s) => {
  const m = s / 60;
  if (m < 150) return `${m.toFixed(1)} min`;
  const total = Math.round(m), h = Math.floor(total / 60);
  return `${h} h ${String(total - h * 60).padStart(2, "0")} min`;
};
export const fmtSI = (v, unit, d = 2) => {
  const a = Math.abs(v);
  if (a >= 1e3 || (a < 1e-2 && a > 0)) {
    const e = Math.floor(Math.log10(a));
    return `${(v / 10 ** e).toFixed(d)} × 10${sup(e)} ${unit}`;
  }
  return `${v.toFixed(d)} ${unit}`;
};
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const sup = (n) => String(n).split("").map((c) => SUP[c]).join("");
export const svgPoint = (svg, e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};
export function arrow(g, x0, y0, x1, y1, color, width = 1.6, head = 6) {
  el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style: `stroke:${color};stroke-width:${width};stroke-linecap:round` }, g);
  if (Math.hypot(x1 - x0, y1 - y0) < 2) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  el("path", { d: `M${x1} ${y1}L${x1 - head * Math.cos(a - 0.42)} ${y1 - head * Math.sin(a - 0.42)}L${x1 - head * Math.cos(a + 0.42)} ${y1 - head * Math.sin(a + 0.42)}Z`, style: `fill:${color}` }, g);
}

// player wires a block's play button to a frame loop that runs only while
// the block is on screen and motion is allowed.
export function player(root, frameFn, label = "Play") {
  const btn = root.querySelector('[data-action="play"]');
  let playing = false, raf = 0, visible = false, last = 0;
  const loop = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    frameFn(dt);
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  const set = (p) => {
    playing = p && !reduced();
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? "Pause" : label;
    start();
  };
  btn.addEventListener("click", () => set(!playing));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; } start(); }).observe(root);
  return { set, get playing() { return playing; } };
}

// ---------------------------------------------------------------- orbits

export const period = (a) => 2 * Math.PI * Math.sqrt(a ** 3 / MU); // s
/** Node drift rate (rad/s) of a circular or elliptic orbit from J2. */
export const nodeRate = (a, e, i) => -1.5 * J2 * (RE / (a * (1 - e * e))) ** 2 * Math.sqrt(MU / a ** 3) * Math.cos(i);
/** Argument-of-latitude rate for a circular orbit with J2 (rad/s). */
export const latRate = (a, i) => {
  const n = Math.sqrt(MU / a ** 3);
  const k = 0.75 * J2 * (RE / a) ** 2 * n;
  // dω/dt + dM/dt for e = 0.
  return n + k * (4 - 5 * Math.sin(i) ** 2) + k * (2 - 3 * Math.sin(i) ** 2);
};
/** Inclination (rad) that makes a circular orbit at radius a sun-synchronous, or NaN. */
export function ssoInclination(a) {
  const c = SUN_RATE / (-1.5 * J2 * (RE / a) ** 2 * Math.sqrt(MU / a ** 3));
  return Math.abs(c) <= 1 ? Math.acos(c) : NaN;
}
/** Fraction of a circular orbit at altitude h (km) spent in a cylindrical
 *  shadow, for a sun angle β (rad) above the orbit plane. */
export const eclipseFraction = (h, beta) => {
  const bstar = Math.asin(RE / (RE + h));
  if (Math.abs(beta) >= bstar) return 0;
  return Math.acos(Math.sqrt(h * h + 2 * RE * h) / ((RE + h) * Math.cos(beta))) / Math.PI;
};
/** Position (km) in an inertial frame of a circular orbit: argument of
 *  latitude u, node Ω, inclination i. */
export const circPos = (a, u, raan, i) => [
  a * (Math.cos(u) * Math.cos(raan) - Math.sin(u) * Math.cos(i) * Math.sin(raan)),
  a * (Math.cos(u) * Math.sin(raan) + Math.sin(u) * Math.cos(i) * Math.cos(raan)),
  a * Math.sin(u) * Math.sin(i),
];
/** Rotate an inertial vector into the Earth-fixed frame at time t (s). */
export const toEcef = ([x, y, z], t) => {
  const g = OMEGA_E * t;
  return [x * Math.cos(g) + y * Math.sin(g), -x * Math.sin(g) + y * Math.cos(g), z];
};
export const latLon = ([x, y, z]) => [Math.atan2(z, Math.hypot(x, y)), Math.atan2(y, x)];
export const wrapLon = (l) => ((((l + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

// ---------------------------------------------------------------- vectors

export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));

/** Solve the small dense system A x = b by Gaussian elimination with
 *  partial pivoting; returns null if singular. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
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
  return x;
}
export function inverse(A) {
  const n = A.length;
  const cols = [];
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0);
    e[j] = 1;
    const c = solve(A, e);
    if (!c) return null;
    cols.push(c);
  }
  return A.map((_, i) => cols.map((c) => c[i]));
}

/** A seeded generator (mulberry32) and a normal deviate from it. */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.normal = () => {
    const u = Math.max(next(), 1e-12), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

// ---------------------------------------------------------------- world map

/** Coarse, schematic coastlines as [lon, lat] rings in degrees: enough to
 *  recognise the continents on an equirectangular map, nothing more. */
export const LAND = [
  [[-168, 66], [-162, 70], [-140, 70], [-120, 72], [-95, 72], [-80, 73], [-65, 62], [-60, 55], [-53, 48], [-66, 44], [-70, 41], [-76, 35], [-81, 31], [-81, 25], [-87, 30], [-97, 27], [-97, 22], [-90, 21], [-87, 15], [-83, 9], [-78, 8], [-85, 12], [-92, 15], [-105, 20], [-112, 30], [-117, 32], [-124, 40], [-124, 48], [-133, 56], [-150, 60], [-165, 60]],
  [[-78, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-39, -15], [-48, -26], [-58, -35], [-65, -42], [-68, -52], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-76, -12], [-81, -5], [-80, 1]],
  [[-17, 15], [-17, 21], [-10, 30], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [45, 2], [40, -5], [40, -15], [35, -22], [33, -28], [27, -34], [19, -35], [15, -27], [12, -17], [13, -6], [9, 4], [-5, 5], [-13, 8]],
  [[-10, 36], [-9, 43], [-2, 47], [-5, 48], [3, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [40, 67], [60, 69], [70, 73], [80, 73], [100, 77], [115, 74], [140, 72], [160, 70], [180, 68], [180, 65], [170, 60], [160, 58], [156, 51], [142, 47], [135, 43], [129, 35], [122, 31], [122, 25], [110, 20], [108, 15], [105, 9], [100, 13], [98, 8], [100, 4], [104, 1], [98, 8], [94, 16], [90, 22], [80, 15], [78, 8], [72, 19], [67, 25], [57, 25], [56, 27], [50, 30], [48, 29], [52, 24], [56, 24], [59, 22], [55, 17], [44, 12], [42, 16], [35, 28], [34, 31], [36, 36], [27, 37], [26, 40], [23, 38], [22, 37], [19, 42], [13, 45], [15, 40], [16, 38], [12, 38], [8, 44], [3, 43], [-1, 37], [-6, 36]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -25], [151, -34], [146, -39], [140, -38], [135, -35], [129, -32], [115, -34]],
  [[-73, 78], [-60, 82], [-30, 83], [-20, 77], [-22, 70], [-40, 64], [-50, 62], [-55, 70]],
  [[-180, -78], [-150, -76], [-100, -73], [-60, -64], [-55, -70], [-30, -78], [0, -70], [40, -68], [80, -67], [120, -66], [160, -70], [180, -78], [180, -90], [-180, -90]],
];

/** Draws a graticule and the schematic land on an equirectangular box. */
export function worldMap(svg, box) {
  const [L, T, W, H] = box;
  const sx = (lon) => L + ((lon + 180) / 360) * W;
  const sy = (lat) => T + ((90 - lat) / 180) * H;
  const g = el("g", {}, svg);
  el("rect", { x: L, y: T, width: W, height: H, style: "fill:var(--background);stroke:currentColor;stroke-opacity:.25" }, g);
  for (const ring of LAND) el("path", { d: "M" + ring.map(([lo, la]) => `${sx(lo).toFixed(1)} ${sy(la).toFixed(1)}`).join("L") + "Z", style: "fill:currentColor;fill-opacity:.09;stroke:currentColor;stroke-opacity:.22;stroke-width:.6" }, g);
  for (let lon = -150; lon <= 150; lon += 30) el("line", { x1: sx(lon), x2: sx(lon), y1: T, y2: T + H, style: "stroke:currentColor;stroke-opacity:.07" }, g);
  for (let lat = -60; lat <= 60; lat += 30) el("line", { x1: L, x2: L + W, y1: sy(lat), y2: sy(lat), style: `stroke:currentColor;stroke-opacity:${lat ? 0.07 : 0.2}` }, g);
  return { sx, sy, g };
}
