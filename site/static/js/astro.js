// Astrophysics & cosmology blocks. SI constants (CODATA 2018, IAU 2015
// nominal solar values); every figure is computed here, nothing fetched.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const C = 299792458; // m/s
const H = 6.62607015e-34;
const KB = 1.380649e-23;
const SIGMA = 5.670374419e-8;
const WIEN = 2.897771955e-3; // m·K
const GMSUN = 1.32712440018e20; // m³/s²
const MSUN = 1.98847e30; // kg
const RSUN = 6.957e8; // m
const LSUN = 3.828e26; // W
const MPC = 3.0856775814913673e22; // m
const GYR = 3.15576e16; // s
const HUBBLE_GYR = 977.792; // 1/H₀ in Gyr for H₀ in km/s/Mpc
const C_KMS = C / 1000;

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).split("").map((c) => (c === "-" ? "⁻" : SUP[c] ?? c)).join("");
const sci = (v, d = 2) => {
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e <= 4) return num(v, Math.max(0, d - e));
  const m = v / 10 ** e;
  return `${num(m, d)} × 10${sup(e)}`;
};
const logTicks = (a, b) => {
  const out = [];
  for (let e = Math.ceil(Math.log10(a)); e <= Math.floor(Math.log10(b)); e++) out.push(10 ** e);
  return out;
};
const pow10 = (v) => {
  const e = Math.round(Math.log10(v));
  return e === 0 ? "1" : e === 1 ? "10" : `10${sup(e)}`;
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Presets: buttons carrying data-preset call pick(name).
function presets(root, pick) {
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.preset)));
}

// Resolves a CSS colour (oklch, hex…) to [r, g, b] by painting one pixel.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function rgbOf(el, name) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = getComputedStyle(el).getPropertyValue(name).trim() || "#888";
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

// Canvas sized to its box at device resolution.
function fitCanvas(canvas) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr };
}

// Redraw on theme change (the html class flips between light and dark).
function onTheme(fn) {
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
}

// ============================================================ Blackbody

// Spectral radiance B_λ(T) in W m⁻² sr⁻¹ m⁻¹.
function planck(lambda, T) {
  const x = (H * C) / (lambda * KB * T);
  if (x > 700) return 0;
  return (2 * H * C * C) / lambda ** 5 / Math.expm1(x);
}

// CIE 1931 colour matching functions, multi-lobe Gaussian fit (Wyman,
// Sloan & Shirley 2013).
function cie(l) {
  const g = (x, mu, s1, s2) => Math.exp(-0.5 * ((x - mu) / (x < mu ? s1 : s2)) ** 2);
  return [
    1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
  ];
}

// The colour a blackbody appears, normalised to full brightness (sRGB).
function starColour(T) {
  let X = 0, Y = 0, Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const b = planck(l * 1e-9, T), [x, y, z] = cie(l);
    X += b * x; Y += b * y; Z += b * z;
  }
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let bl = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  r = Math.max(0, r); g = Math.max(0, g); bl = Math.max(0, bl);
  const m = Math.max(r, g, bl) || 1;
  const gam = (v) => { v /= m; return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
  return `rgb(${gam(r)},${gam(g)},${gam(bl)})`;
}

// Approximate colour of visible light by wavelength (nm), for spectrum strips.
function waveColor(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const fade = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const c = (v) => Math.round(255 * Math.max(0, Math.min(1, v * fade)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

const BB_STARS = {
  sun: [5772, 1], proxima: [3042, 0.154], sirius: [9940, 1.711], betelgeuse: [3600, 764], rigel: [12100, 78.9],
};

for (const root of document.querySelectorAll("[data-astro-bb]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, (k) => { const [t, r] = BB_STARS[k]; s.t.set(t, false); s.r.set(r, false); draw(); });

  function draw() {
    const T = s.t.get(), R = s.r.get();
    svg.replaceChildren();
    const lx = (nm) => Math.log10(nm);
    const f = frame(svg, {
      box: [64, 26, 552, 250], x: [lx(50), lx(20000)], y: [6, 18],
      xticks: [100, 1000, 10000].map(lx), xfmt: (v) => `${Math.round(10 ** v)}`,
      yticks: [6, 8, 10, 12, 14, 16, 18], yfmt: (v) => `10${sup(v)}`,
      xlabel: "wavelength (nm, log)", ylabel: "B_λ (W m⁻² sr⁻¹ m⁻¹, log)",
    });
    // Visible band.
    for (let nm = 380; nm < 750; nm += 5) el("rect", { x: f.sx(lx(nm)), y: f.T, width: f.sx(lx(nm + 5)) - f.sx(lx(nm)) + 0.3, height: f.H, style: `fill:${waveColor(nm)};fill-opacity:0.12` }, svg);
    for (let nm = 380; nm < 750; nm += 5) el("rect", { x: f.sx(lx(nm)), y: f.T + f.H - 5, width: f.sx(lx(nm + 5)) - f.sx(lx(nm)) + 0.3, height: 5, style: `fill:${waveColor(nm)}` }, svg);
    const curve = (temp) => {
      const pts = [];
      for (let i = 0; i <= 300; i++) {
        const nm = 10 ** (lx(50) + (i / 300) * (lx(20000) - lx(50)));
        const b = planck(nm * 1e-9, temp);
        if (b <= 0) continue;
        const y = Math.log10(b);
        if (y < 6) continue;
        pts.push([f.sx(lx(nm)), f.sy(Math.min(18.5, y))]);
      }
      return pts;
    };
    polyline(svg, curve(5772), "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svg, curve(T), "stroke:var(--brand);stroke-width:2");
    const peak = (WIEN / T) * 1e9;
    const by = Math.log10(planck(peak * 1e-9, T));
    if (by <= 18.5) {
      el("circle", { cx: f.sx(lx(peak)), cy: f.sy(by), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, f.sx(lx(peak)) + 8, f.sy(by) - 6, `peak ${num(peak, 0)} nm`, { class: "fill-foreground font-mono text-[10px]" });
    }
    text(svg, f.L + f.W - 4, f.T + 12, "dashed: the Sun, 5772 K", { "text-anchor": "end" });
    text(svg, f.sx(lx(560)), f.T + 12, "visible", { "text-anchor": "middle" });

    const colour = starColour(T);
    o.swatch.replaceChildren();
    const sw = document.createElement("span");
    sw.className = "inline-block size-3 rounded-full border align-[-2px] mr-1.5";
    sw.style.background = colour;
    o.swatch.append(sw, colour);
    o.peak.textContent = peak >= 1000 ? `${num(peak / 1000, 2)} µm` : `${num(peak, 0)} nm`;
    const flux = SIGMA * T ** 4;
    o.flux.textContent = `${sci(flux / 1e6, 3)} MW/m²`;
    const L = 4 * Math.PI * (R * RSUN) ** 2 * flux;
    o.lum.textContent = `${sci(L / LSUN, 3)} L☉`;
    let vis = 0;
    for (let nm = 380; nm < 750; nm += 1) vis += planck((nm + 0.5) * 1e-9, T) * 1e-9;
    o.vis.textContent = `${num((100 * vis * Math.PI) / flux, 1)}% of the power`;
  }
  draw();
}

// ============================================================ Redshift

const Z_LINES = [
  // rest wavelength (nm, air), relative strength, label
  [372.7, 0.7, "[O II]"], [410.2, 0.09, "Hδ"], [434.0, 0.16, "Hγ"], [486.1, 0.35, "Hβ"],
  [495.9, 0.2, ""], [500.7, 0.6, "[O III]"], [656.3, 1.0, "Hα"], [658.4, 0.35, ""],
  [671.6, 0.15, "[S II]"], [673.1, 0.11, ""],
];
const Z_MIN = 360, Z_MAX = 1000;

for (const root of document.querySelectorAll("[data-astro-z]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let seed = 11, truth = 0, spectrum = [], revealed = false;
  const box = { L: 40, T: 26, W: 580, H: 222 };
  const sx = (nm) => box.L + ((nm - Z_MIN) / (Z_MAX - Z_MIN)) * box.W;
  const nmAt = (x) => Z_MIN + ((x - box.L) / box.W) * (Z_MAX - Z_MIN);

  function galaxy() {
    const rng = mulberry32(seed);
    truth = 0.03 + 0.85 * rng();
    const width = 0.5 + 0.6 * rng();
    const tilt = rng() * 0.4 - 0.2;
    spectrum = [];
    for (let nm = Z_MIN; nm <= Z_MAX; nm += 0.5) {
      let fl = 0.18 * (1 + tilt * ((nm - 680) / 320));
      for (const [l0, a] of Z_LINES) {
        const l = l0 * (1 + truth), w = width * (1 + truth);
        fl += a * Math.exp(-0.5 * ((nm - l) / w) ** 2);
      }
      fl += 0.035 * gauss(rng);
      spectrum.push([nm, fl]);
    }
    revealed = false;
  }

  // How much line flux the template catches: mean signal at the predicted
  // positions, relative to the true lines'. A measurement, not the answer.
  function matchScore(z) {
    const at = (nm) => {
      if (nm < Z_MIN || nm > Z_MAX) return null;
      let best = -Infinity;
      for (const [x, fl] of spectrum) if (Math.abs(x - nm) <= 0.75) best = Math.max(best, fl);
      return best;
    };
    let num0 = 0, den = 0;
    for (const [l0, a] of Z_LINES) {
      const v = at(l0 * (1 + z));
      if (v === null) continue;
      num0 += Math.max(0, v - 0.18) * a;
      den += a * a;
    }
    return den ? Math.min(1, num0 / den) : 0;
  }

  function draw() {
    const z = s.z.get();
    svg.replaceChildren();
    el("line", { x1: box.L, x2: box.L + box.W, y1: box.T + box.H, y2: box.T + box.H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    for (let nm = 400; nm <= 1000; nm += 100) {
      el("line", { x1: sx(nm), x2: sx(nm), y1: box.T, y2: box.T + box.H, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, sx(nm), box.T + box.H + 14, `${nm}`, { "text-anchor": "middle" });
    }
    text(svg, box.L + box.W, box.T + box.H + 28, "observed wavelength (nm)", { "text-anchor": "end" });
    text(svg, 4, 10, "flux (arbitrary)", { "text-anchor": "start" });
    for (let nm = 380; nm < 780; nm += 4) el("rect", { x: sx(nm), y: box.T + box.H - 4, width: sx(nm + 4) - sx(nm) + 0.3, height: 4, style: `fill:${waveColor(nm)}` }, svg);
    const fy = (fl) => box.T + box.H - 8 - (fl / 1.15) * (box.H - 20);
    polyline(svg, spectrum.map(([nm, fl]) => [sx(nm), Math.max(box.T, fy(fl))]), "stroke:var(--foreground);stroke-opacity:0.8;stroke-width:1");
    // Template.
    const g = el("g", {}, svg);
    let lastX = null, lastRow = 0;
    for (const [l0, , label] of Z_LINES) {
      const l = l0 * (1 + z);
      if (l < Z_MIN || l > Z_MAX) continue;
      el("line", { x1: sx(l), x2: sx(l), y1: box.T + 18, y2: box.T + box.H, style: "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:3 3" }, g);
      if (!label) continue;
      // Two label rows so neighbouring lines stay readable.
      const rowY = lastX !== null && sx(l) - lastX < 44 && lastRow === 0 ? 1 : 0;
      text(g, sx(l), box.T + 2 + rowY * 12, label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      lastX = sx(l); lastRow = rowY;
    }
    if (revealed) {
      for (const [l0] of Z_LINES) {
        const l = l0 * (1 + truth);
        if (l >= Z_MIN && l <= Z_MAX) el("circle", { cx: sx(l), cy: box.T + box.H + 2, r: 2.5, style: "fill:var(--code-add)" }, svg);
      }
    }
    const m = matchScore(z);
    o.match.textContent = `${Math.round(m * 100)}%${m > 0.85 ? " · lines on the peaks" : m > 0.4 ? " · close" : ""}`;
    o.truth.textContent = revealed ? `${num(truth, 4)} (off by ${num(Math.abs(z - truth), 4)})` : "hidden";
    o.stretch.textContent = num(1 + z, 3);
    const q = (1 + z) ** 2;
    o.v.textContent = `${Math.round(((q - 1) / (q + 1)) * C_KMS).toLocaleString("en-US")} km/s`;
  }

  root.querySelector('[data-action="new"]').addEventListener("click", () => { seed = (seed * 7919 + 13) % 100003; galaxy(); s.z.set(0, false); draw(); });
  root.querySelector('[data-action="reveal"]').addEventListener("click", () => { revealed = true; draw(); });

  // Drag the template: the stretch scales with the pointer.
  let drag = null;
  const svgX = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 640; };
  svg.style.cursor = "ew-resize";
  svg.style.touchAction = "none";
  svg.addEventListener("pointerdown", (e) => { drag = { z0: s.z.get(), nm0: nmAt(svgX(e)) }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const nm = nmAt(svgX(e));
    if (drag.nm0 > 1 && nm > 1) { s.z.set((1 + drag.z0) * (nm / drag.nm0) - 1, false); draw(); }
  });
  const stop = () => (drag = null);
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);

  galaxy();
  draw();
}

// ============================================================ Stellar fates

const AGE_GYR = 13.8;

function fate(m) {
  if (m < 0.5) return ["helium white dwarf", "≲ 0.5 M☉; none has formed yet"];
  if (m < 8) return ["white dwarf", `≈ ${num(Math.min(1.38, 0.08 * m + 0.49), 2)} M☉ (below 1.4 M☉), Earth-sized`];
  if (m < 25) return ["neutron star", "≈ 1.4 M☉, ≈ 12 km across, after a supernova"];
  return ["black hole", "several to tens of M☉, maybe without a bright supernova"];
}

for (const root of document.querySelectorAll("[data-astro-fate]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, (k) => s.m.set(Number(k)));

  function draw() {
    const m = s.m.get();
    svg.replaceChildren();
    const lg = Math.log10;
    const f = frame(svg, {
      box: [60, 24, 556, 232], x: [lg(0.1), lg(100)], y: [5, 13],
      xticks: [0.1, 1, 10, 100].map(lg), xfmt: (v) => `${+(10 ** v).toPrecision(1)}`,
      yticks: [5, 7, 9, 11, 13], yfmt: (v) => `10${sup(v)}`,
      xlabel: "initial mass (M☉, log)", ylabel: "main-sequence lifetime (years, log)",
    });
    // End-state bands under the axis.
    const bands = [[0.1, 0.5, "He WD (future)", "var(--muted-foreground)"], [0.5, 8, "white dwarf", "var(--vec-u)"], [8, 25, "neutron star", "var(--vec-v)"], [25, 100, "black hole", "var(--foreground)"]];
    for (const [a, b, label, col] of bands) {
      const x1 = f.sx(lg(a)), x2 = f.sx(lg(b));
      el("rect", { x: x1, y: f.T + f.H + 32, width: x2 - x1 - 2, height: 8, rx: 2, style: `fill:${col};fill-opacity:${m >= a && m < b ? 0.9 : 0.35}` }, svg);
      text(svg, (x1 + x2) / 2, f.T + f.H + 54, label, { "text-anchor": "middle", class: `font-mono text-[10px] ${m >= a && m < b ? "fill-foreground" : "fill-muted-foreground"}` });
    }
    // Age of the universe.
    const ya = lg(AGE_GYR * 1e9);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(ya), y2: f.sy(ya), style: "stroke:var(--code-add);stroke-dasharray:4 4" }, svg);
    text(svg, f.L + f.W - 4, f.sy(ya) - 5, "age of the universe, 13.8 Gyr", { "text-anchor": "end" });
    // Chandrasekhar: masses whose white dwarf would exceed it never make one.
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const mm = 10 ** (lg(0.1) + (i / 120) * 3);
      pts.push([f.sx(lg(mm)), f.sy(Math.min(13, Math.max(5, lg(1e10 * mm ** -2.5))))]);
    }
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    const life = 1e10 * m ** -2.5;
    const ly = lg(life);
    el("line", { x1: f.sx(lg(m)), x2: f.sx(lg(m)), y1: f.sy(Math.min(13, ly)), y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(lg(m)), cy: f.sy(Math.min(13, ly)), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);

    o.life.textContent = life >= 1e9 ? `${sci(life / 1e9, 3)} Gyr` : `${sci(life / 1e6, 3)} Myr`;
    o.lum.textContent = `${sci(m ** 3.5, 3)} L☉`;
    const [end, rem] = fate(m);
    o.end.textContent = end;
    o.rem.textContent = rem;
    o.dead.textContent = life < AGE_GYR * 1e9 ? "yes, if born early enough" : "no: it outlives the universe so far";
  }
  draw();
}

// ============================================================ Black hole

for (const root of document.querySelectorAll("[data-astro-bh]")) {
  const map = root.querySelector("[data-map]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, (k) => s.m.set(Number(k)));

  function draw() {
    const M = 10 ** s.m.get(), r = s.r.get();
    const rs = (2 * GMSUN * M) / (C * C);

    // To scale in r_s: the hole's centre near the left edge, circles cut
    // by the frame.
    map.replaceChildren();
    const X0 = 24, k = 600 / 20.5, Y = 95;
    el("line", { x1: 0, x2: 640, y1: Y, y2: Y, style: "stroke:currentColor;stroke-opacity:0.15" }, map);
    el("circle", { cx: X0, cy: Y, r: 3 * k, style: "fill:none;stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 3" }, map);
    el("circle", { cx: X0, cy: Y, r: 1.5 * k, style: "fill:none;stroke:var(--vec-out);stroke-width:1.5;stroke-dasharray:4 3" }, map);
    el("circle", { cx: X0, cy: Y, r: k, style: "fill:var(--foreground)" }, map);
    for (const t of [5, 10, 15, 20]) {
      el("line", { x1: X0 + t * k, x2: X0 + t * k, y1: Y - 4, y2: Y + 4, style: "stroke:currentColor;stroke-opacity:0.35" }, map);
      text(map, X0 + t * k, Y + 18, t === 20 ? "20 r_s" : `${t}`, { "text-anchor": "middle" });
    }
    el("line", { x1: X0 + r * k, x2: X0 + r * k, y1: Y - 22, y2: Y - 8, style: "stroke:var(--brand);stroke-opacity:0.5" }, map);
    el("circle", { cx: X0 + r * k, cy: Y, r: 6, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, map);
    text(map, X0 + r * k, Y - 28, "you", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });

    svg.replaceChildren();
    const f = frame(svg, {
      box: [56, 14, 556, 180], x: [1, 20], y: [0, 1],
      xticks: [1, 1.5, 3, 5, 10, 15, 20], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => num(v, 2),
      xlabel: "distance r (in r_s)", ylabel: "clock rate dτ/dt",
    });
    const pts = [];
    for (let i = 0; i <= 400; i++) {
      const x = 1 + (19 * i) / 400;
      pts.push([f.sx(x), f.sy(Math.sqrt(1 - 1 / x))]);
    }
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    for (const [x, col] of [[1.5, "var(--vec-out)"], [3, "var(--vec-u)"]]) el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: `stroke:${col};stroke-dasharray:3 3` }, svg);
    const rate = Math.sqrt(1 - 1 / r);
    el("circle", { cx: f.sx(r), cy: f.sy(rate), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);

    o.mass.textContent = `${sci(M, 3)} M☉`;
    const rsKm = rs / 1000;
    o.rs.textContent = rs > 1e11 ? `${sci(rs / 1.495978707e11, 3)} AU` : `${sci(rsKm, 3)} km`;
    o.rate.textContent = num(rate, 4);
    const hr = 1 / rate;
    o.hour.textContent = hr < 48 ? `${num(hr, 2)} h far away` : `${num(hr / 24, 1)} days far away`;
    o.z.textContent = num(1 / rate - 1, 4);
    const tide = (2 * GMSUN * M * 2) / (r * rs) ** 3;
    o.tide.textContent = `${sci(tide, 2)} m/s² (${sci(tide / 9.81, 2)} g)`;
  }
  draw();
}

// ============================================================ Rotation curves

const G_KPC = 4.30091e-6; // kpc (km/s)² / M☉

// Modified Bessel functions, Abramowitz & Stegun 9.8.1–9.8.8.
function besselI0(x) {
  const t = x / 3.75;
  if (x < 3.75) { const y = t * t; return 1 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813))))); }
  const y = 1 / t;
  return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281 + y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377))))))));
}
function besselI1(x) {
  const t = x / 3.75;
  if (x < 3.75) { const y = t * t; return x * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934 + y * (0.02658733 + y * (0.00301532 + y * 0.00032411)))))); }
  const y = 1 / t;
  return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + y * (-0.03988024 + y * (-0.00362018 + y * (0.00163801 + y * (-0.01031555 + y * (0.02282967 + y * (-0.02895312 + y * (0.01787654 - y * 0.00420059))))))));
}
function besselK0(x) {
  if (x <= 2) { const y = (x * x) / 4; return -Math.log(x / 2) * besselI0(x) + (-0.57721566 + y * (0.4227842 + y * (0.23069756 + y * (0.0348859 + y * (0.00262698 + y * (0.0001075 + y * 0.0000074)))))); }
  const y = 2 / x;
  return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.0025154 + y * 0.00053208))))));
}
function besselK1(x) {
  if (x <= 2) { const y = (x * x) / 4; return Math.log(x / 2) * besselI1(x) + (1 / x) * (1 + y * (0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686)))))); }
  const y = 2 / x;
  return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + y * (0.23498619 + y * (-0.0365562 + y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245))))));
}

// v² contributions in (km/s)² at radius R (kpc). Masses in M☉.
function discV2(R, Md, Rd) {
  if (Md <= 0 || R <= 0) return 0;
  const y = R / (2 * Rd), sigma0 = Md / (2 * Math.PI * Rd * Rd);
  return Math.max(0, 4 * Math.PI * G_KPC * sigma0 * Rd * y * y * (besselI0(y) * besselK0(y) - besselI1(y) * besselK1(y)));
}
function haloV2(R, rho, rc) {
  if (rho <= 0 || R <= 0) return 0;
  return 4 * Math.PI * G_KPC * rho * rc * rc * (1 - (rc / R) * Math.atan(R / rc));
}

const ROT_TRUE = { md: 5, rd: 3, rho: 1.5, rc: 5 };

for (const root of document.querySelectorAll("[data-astro-rot]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, (k) => {
    const p = k === "fit" ? ROT_TRUE : { md: 7.5, rd: 3, rho: 0, rc: 5 };
    for (const n of ["md", "rd", "rho", "rc"]) s[n].set(p[n], false);
    draw();
  });
  // Synthetic observations: 6 km/s errors around the true model.
  const rng = mulberry32(42);
  const data = [];
  for (let R = 1; R <= 30.01; R += 1.45) {
    const v = Math.sqrt(discV2(R, ROT_TRUE.md * 1e10, ROT_TRUE.rd) + haloV2(R, ROT_TRUE.rho * 1e7, ROT_TRUE.rc));
    data.push([R, v + 6 * gauss(rng)]);
  }

  function draw() {
    const Md = s.md.get() * 1e10, Rd = s.rd.get(), rho = s.rho.get() * 1e7, rc = s.rc.get();
    svg.replaceChildren();
    const f = frame(svg, {
      box: [56, 24, 556, 260], x: [0, 32], y: [0, 300],
      xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 50, 100, 150, 200, 250, 300],
      xlabel: "radius (kpc)", ylabel: "rotation speed (km/s)",
    });
    const disc = [], halo = [], tot = [];
    for (let i = 1; i <= 160; i++) {
      const R = (32 * i) / 160;
      const d2 = discV2(R, Md, Rd), h2 = haloV2(R, rho, rc);
      disc.push([f.sx(R), f.sy(Math.min(300, Math.sqrt(d2)))]);
      halo.push([f.sx(R), f.sy(Math.min(300, Math.sqrt(h2)))]);
      tot.push([f.sx(R), f.sy(Math.min(300, Math.sqrt(d2 + h2)))]);
    }
    polyline(svg, disc, "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 3");
    if (rho > 0) polyline(svg, halo, "stroke:var(--vec-v);stroke-width:1.5;stroke-dasharray:5 3");
    polyline(svg, tot, "stroke:var(--brand);stroke-width:2.25");
    let chi = 0;
    for (const [R, v] of data) {
      const m = Math.sqrt(discV2(R, Md, Rd) + haloV2(R, rho, rc));
      chi += ((v - m) / 6) ** 2;
      el("line", { x1: f.sx(R), x2: f.sx(R), y1: f.sy(v - 6), y2: f.sy(v + 6), style: "stroke:var(--foreground);stroke-opacity:0.6" }, svg);
      el("circle", { cx: f.sx(R), cy: f.sy(v), r: 3, style: "fill:var(--foreground)" }, svg);
    }
    text(svg, f.L + f.W - 4, f.T + 12, "points: synthetic galaxy, ±6 km/s", { "text-anchor": "end" });
    chi /= data.length;
    o.chi.textContent = `${num(chi, 2)}${chi < 1.6 ? " · a good fit" : chi < 5 ? " · close" : " · a poor fit"}`;
    o.v30.textContent = `${Math.round(Math.sqrt(discV2(30, Md, Rd) + haloV2(30, rho, rc)))} km/s`;
    const x = 30 / Rd, mDisc = Md * (1 - Math.exp(-x) * (1 + x));
    const mHalo = rho > 0 ? 4 * Math.PI * rho * rc ** 3 * (30 / rc - Math.atan(30 / rc)) : 0;
    o.dark.textContent = mDisc + mHalo > 0 ? `${Math.round((100 * mHalo) / (mDisc + mHalo))}% of ${sci(mDisc + mHalo, 2)} M☉` : "—";
  }
  draw();
}

// ============================================================ Lensing

for (const root of document.querySelectorAll("[data-astro-lens]")) {
  const canvas = root.querySelector("[data-canvas]");
  const ctx = canvas.getContext("2d");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let by = 0, showSrc = true;
  root.querySelector("[data-toggle=source]").addEventListener("shadcn:checked-change", (e) => { showSrc = e.detail.checked; draw(); });
  const N = 220, FOV = 2.1; // pixels across, half-width in θ_E
  const img = new ImageData(N, N);
  const off = document.createElement("canvas");
  off.width = off.height = N;
  const octx = off.getContext("2d");

  // Background galaxy: an elliptical glow with three bright knots.
  function source(x, y, size) {
    const u = x / size, v = y / (size * 0.65);
    let b = Math.exp(-0.5 * (u * u + v * v) * 2.2);
    for (const [kx, ky, kb] of [[0.5, 0.25, 0.8], [-0.45, -0.3, 0.6], [0.1, -0.55, 0.5]]) {
      const dx = u - kx, dy = (y / size) - ky * 0.65;
      b += kb * Math.exp(-(dx * dx + dy * dy) / 0.03);
    }
    return Math.min(1, b);
  }

  function draw() {
    const M = s.m.get() * 1e12, Dl = s.dl.get(), Ds = s.ds.get(), bx = s.bx.get(), size = s.size.get();
    const { w, h } = fitCanvas(canvas);
    const bg = rgbOf(root, "--background"), fg = rgbOf(root, "--brand");
    const behind = Ds > Dl;
    // Ray shooting: for each image-plane pixel θ, β = θ − θ/|θ|² (θ_E units).
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const tx = ((i + 0.5) / N - 0.5) * 2 * FOV, ty = (0.5 - (j + 0.5) / N) * 2 * FOV;
        const r2 = tx * tx + ty * ty;
        let sx = tx, sy = ty;
        if (behind) { sx = tx - tx / Math.max(r2, 1e-6); sy = ty - ty / Math.max(r2, 1e-6); }
        const b = source(sx - bx, sy - by, size);
        const k = (j * N + i) * 4;
        for (let c = 0; c < 3; c++) img.data[k + c] = bg[c] + (fg[c] - bg[c]) * b;
        img.data[k + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);
    const px = (t) => ((t / FOV + 1) / 2) * w, py = (t) => ((1 - t / FOV) / 2) * h;
    const fgc = getComputedStyle(root).getPropertyValue("--foreground").trim();
    ctx.lineWidth = Math.max(1, w / 400);
    ctx.strokeStyle = fgc;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([w / 120, w / 120]);
    if (behind) { ctx.beginPath(); ctx.arc(px(0), py(0), (w / 2) / FOV, 0, 2 * Math.PI); ctx.stroke(); }
    if (showSrc) {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(px(bx), py(by), (size / FOV) * (w / 2), (size * 0.65 / FOV) * (w / 2), 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fgc;
    ctx.beginPath(); ctx.arc(px(0), py(0), w / 110, 0, 2 * Math.PI); ctx.fill();
    ctx.font = `${Math.round(w / 38)}px ui-monospace, monospace`;
    ctx.globalAlpha = 0.6;
    ctx.fillText("lens", px(0) + w / 60, py(0) - w / 60);
    if (behind) ctx.fillText("Einstein ring", px(0) - w / 6, py(0) - (w / 2) / FOV - w / 60);
    ctx.globalAlpha = 1;

    if (!behind) {
      o.te.textContent = "source must be behind the lens";
      o.img.textContent = "—";
      o.mu.textContent = "1 (no lensing)";
      return;
    }
    const thetaE = Math.sqrt((4 * GMSUN * M) / (C * C) * ((Ds - Dl) / (Dl * Ds * 1000 * MPC)));
    o.te.textContent = `${num((thetaE * 180 * 3600) / Math.PI, 2)}″`;
    const u = Math.hypot(bx, by);
    const tp = (u + Math.sqrt(u * u + 4)) / 2, tm = (u - Math.sqrt(u * u + 4)) / 2;
    o.img.textContent = `${num(tp, 2)} and ${num(tm, 2)} θ_E`;
    o.mu.textContent = u < 1e-3 ? "→ ∞ (ring)" : `${num((u * u + 2) / (u * Math.sqrt(u * u + 4)), 2)} (point source)`;
  }

  // Drag the source: the pointer marks where the source really is.
  const wrap = canvas.parentElement;
  wrap.tabIndex = 0;
  const toTheta = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width * 2 - 1) * FOV, (1 - (e.clientY - r.top) / r.height * 2) * FOV];
  };
  let dragging = false;
  let pending = 0;
  const later = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); };
  wrap.addEventListener("pointerdown", (e) => { dragging = true; wrap.setPointerCapture(e.pointerId); const [x, y] = toTheta(e); s.bx.set(x, false); by = Math.max(-2, Math.min(2, y)); later(); });
  wrap.addEventListener("pointermove", (e) => { if (!dragging) return; const [x, y] = toTheta(e); s.bx.set(x, false); by = Math.max(-2, Math.min(2, y)); later(); });
  const up = () => (dragging = false);
  wrap.addEventListener("pointerup", up);
  wrap.addEventListener("pointercancel", up);
  wrap.addEventListener("keydown", (e) => {
    const d = e.shiftKey ? 0.2 : 0.05;
    const moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
    if (!moves[e.key]) return;
    e.preventDefault();
    s.bx.set(s.bx.get() + moves[e.key][0], false);
    by = Math.max(-2, Math.min(2, by + moves[e.key][1]));
    draw();
  });
  new ResizeObserver(later).observe(canvas);
  onTheme(later);
  draw();
}

// ============================================================ Friedmann

// (da/dτ)² with τ = H₀t: E(a) = Ω_r a⁻² + Ω_m a⁻¹ + Ω_k + Ω_Λ a².
const friedE = (a, p) => p.or / (a * a) + p.om / a + p.ok + p.ol * a * a;
// d²a/dτ² = −Ω_r a⁻³ − Ω_m/(2a²) + Ω_Λ a.
const friedAcc = (a, p) => -p.or / a ** 3 - p.om / (2 * a * a) + p.ol * a;

// Integrates a(τ) with RK4 from (τ0, a0, v0) for n steps of dt.
function rk4Path(p, t0, a0, v0, dt, n, stop) {
  const out = [[t0, a0]];
  let t = t0, a = a0, v = v0;
  for (let i = 0; i < n; i++) {
    const k1a = v, k1v = friedAcc(a, p);
    const k2a = v + (dt / 2) * k1v, k2v = friedAcc(a + (dt / 2) * k1a, p);
    const k3a = v + (dt / 2) * k2v, k3v = friedAcc(a + (dt / 2) * k2a, p);
    const k4a = v + dt * k3v, k4v = friedAcc(a + dt * k3a, p);
    a += (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += dt;
    if (!(a > 0) || !Number.isFinite(a)) break;
    out.push([t, a, v]);
    if (stop?.(a, v)) break;
  }
  return out;
}

// Age in units of 1/H₀: ∫₀¹ da / √E(a), with a = u² to tame the a → 0 end.
function friedAge(p) {
  const n = 4000;
  let sum = 0;
  const g = (u) => { if (u === 0) return 0; const a = u * u; return (2 * u) / Math.sqrt(friedE(a, p)); };
  for (let i = 0; i <= n; i++) {
    const u = i / n, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    sum += w * g(u);
  }
  return sum / (3 * n);
}

const FRIED_PRESETS = {
  planck: [67.4, 0.315, 0.685, 9.1], eds: [70, 1, 0, 0], closed: [70, 3, 0, 0], desitter: [70, 0, 1, 0],
};

for (const root of document.querySelectorAll("[data-astro-fried]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, (k) => {
    const [h0, om, ol, or] = FRIED_PRESETS[k];
    s.h0.set(h0, false); s.om.set(om, false); s.ol.set(ol, false); s.or.set(or, false);
    draw();
  });

  function draw() {
    const h0 = s.h0.get();
    const p = { om: s.om.get(), ol: s.ol.get(), or: s.or.get() * 1e-5 };
    p.ok = 1 - p.om - p.ol - p.or;
    const unit = HUBBLE_GYR / h0; // Gyr per unit of τ
    svg.replaceChildren();

    // Does the past reach a = 0? E must stay positive on (0, 1).
    let minE = Infinity;
    for (let i = 1; i <= 2000; i++) minE = Math.min(minE, friedE(i / 2000, p));
    const bang = minE > 0 && !(p.or === 0 && p.om === 0 && p.ok <= 1e-9);

    let past = [], age = 0;
    if (bang) {
      age = friedAge(p);
      // The past from the age integral: τ(a) cumulative.
      const n = 400;
      let t = 0;
      past.push([0, 0]);
      for (let i = 1; i <= n; i++) {
        const u0 = (i - 1) / n, u1 = i / n;
        const g = (u) => (u === 0 ? 0 : (2 * u) / Math.sqrt(friedE(u * u, p)));
        t += ((u1 - u0) / 6) * (g(u0) + 4 * g((u0 + u1) / 2) + g(u1));
        past.push([t, u1 * u1]);
      }
      age = t;
    } else {
      // No Big Bang: integrate backwards from today.
      past = rk4Path(p, 0, 1, -1, -0.004, 4000, (a) => a < 0.02 || a > 4).map(([t, a]) => [t, a]).reverse();
    }
    const t0 = bang ? age : 0;
    let crunch = null;
    const future = rk4Path(p, t0, 1, 1, 0.004, 6000, (a) => {
      if (a < 0.005) { crunch = true; return true; }
      return a > 6;
    });
    const tEnd = future[future.length - 1][0];

    // Axes in Gyr.
    const tMin = bang ? 0 : Math.max(-60, past[0][0] * unit);
    const tMax = bang ? Math.min(100, Math.max(30, Math.min(tEnd * unit, 3 * age * unit))) : Math.min(60, Math.max(20, tEnd * unit));
    const step = tMax - tMin > 60 ? 20 : 10;
    const xt = [];
    for (let v = Math.ceil(tMin / step) * step; v <= tMax; v += step) xt.push(v);
    const f = frame(svg, {
      box: [56, 24, 556, 260], x: [tMin, tMax], y: [0, 3],
      xticks: xt, yticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], yfmt: (v) => num(v, 1),
      xlabel: bang ? "time since the Big Bang (Gyr)" : "time from today (Gyr)", ylabel: "scale factor a (today = 1)",
    });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(1), y2: f.sy(1), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, svg);
    const toPts = (arr) => arr.filter(([t, a]) => t * unit >= tMin && t * unit <= tMax && a <= 3).map(([t, a]) => [f.sx(t * unit), f.sy(a)]);
    polyline(svg, toPts(past), "stroke:var(--brand);stroke-width:2.25");
    polyline(svg, toPts(future), "stroke:var(--brand);stroke-width:2.25;stroke-dasharray:6 4");
    el("circle", { cx: f.sx(t0 * unit), cy: f.sy(1), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(t0 * unit) + 8, f.sy(1) + 14, "today", { class: "fill-foreground font-mono text-[10px]" });
    text(svg, f.L + f.W - 4, f.T + 12, "solid: past · dashed: future", { "text-anchor": "end" });

    o.age.textContent = bang ? `${num(age * unit, 2)} Gyr` : "no Big Bang";
    o.ok.textContent = `${num(p.ok, 4)}${Math.abs(p.ok) < 1e-3 ? " (flat)" : p.ok > 0 ? " (open)" : " (closed)"}`;
    o.q.textContent = `${num(p.or + p.om / 2 - p.ol, 3)}${p.or + p.om / 2 - p.ol < 0 ? " (accelerating)" : " (decelerating)"}`;
    let fate;
    if (crunch) fate = `Big Crunch ${num((tEnd - t0) * unit, 1)} Gyr from now`;
    else {
      const last = future[future.length - 1];
      const turned = future.some((q) => q[2] < 0);
      fate = turned ? "recollapses" : friedAcc(last[1], p) > 0 ? "expands forever, accelerating" : "expands forever, slowing";
    }
    if (!bang && minE <= 0) fate += "; a bounce in the past";
    o.fate.textContent = fate;
  }
  draw();
}

// ============================================================ Distances

const H0_DIST = 67.4;

for (const root of document.querySelectorAll("[data-astro-dist]")) {
  const svg = root.querySelector("[data-plot]");
  const sizeSvg = root.querySelector("[data-size]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const DH = C_KMS / H0_DIST; // Mpc

  // Tables of D_C and lookback on a log grid in z from 10⁻³ to 10.
  function tables(p) {
    const Ez = (z) => Math.sqrt(p.om * (1 + z) ** 3 + p.ok * (1 + z) ** 2 + p.ol);
    const zs = [0], dc = [0], tl = [0];
    const n = 3000, l0 = Math.log(1e-3), l1 = Math.log(10);
    let z = 0, D = 0, T = 0, bad = false;
    for (let i = 0; i <= n; i++) {
      const z1 = Math.exp(l0 + ((l1 - l0) * i) / n);
      const zm = (z + z1) / 2;
      const e0 = Ez(z), em = Ez(zm), e1 = Ez(z1);
      if (!(e0 > 0 && em > 0 && e1 > 0)) { bad = true; break; }
      D += ((z1 - z) / 6) * (1 / e0 + 4 / em + 1 / e1);
      T += ((z1 - z) / 6) * (1 / ((1 + z) * e0) + 4 / ((1 + zm) * em) + 1 / ((1 + z1) * e1));
      z = z1;
      zs.push(z); dc.push(D * DH); tl.push(T * (HUBBLE_GYR / H0_DIST));
    }
    const DM = (Dc) => {
      if (Math.abs(p.ok) < 1e-6) return Dc;
      const k = Math.sqrt(Math.abs(p.ok));
      return p.ok > 0 ? (DH / k) * Math.sinh((k * Dc) / DH) : (DH / k) * Math.sin((k * Dc) / DH);
    };
    return { zs, dc, tl, DM, bad };
  }
  const at = (t, z, arr) => {
    let i = 1;
    while (i < t.zs.length - 1 && t.zs[i] < z) i++;
    const z0 = t.zs[i - 1], z1 = t.zs[i], w = z1 > z0 ? (z - z0) / (z1 - z0) : 0;
    return arr[i - 1] + w * (arr[i] - arr[i - 1]);
  };

  function draw() {
    const z = s.z.get();
    const p = { om: s.om.get(), ol: s.ol.get() };
    p.ok = 1 - p.om - p.ol;
    const t = tables(p);
    svg.replaceChildren();
    sizeSvg.replaceChildren();
    const lg = Math.log10;
    const f = frame(svg, {
      box: [56, 24, 556, 190], x: [lg(0.01), lg(10)], y: [lg(0.03), lg(200)],
      xticks: [0.01, 0.1, 1, 10].map(lg), xfmt: (v) => `${+(10 ** v).toPrecision(1)}`,
      yticks: [0.1, 1, 10, 100].map(lg), yfmt: (v) => `${+(10 ** v).toPrecision(1)}`,
      xlabel: "redshift z (log)", ylabel: "distance (Gpc, log)",
    });
    if (t.bad) {
      text(svg, f.L + f.W / 2, f.T + f.H / 2, "No Big Bang for these values: H(z)² turns negative.", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      for (const k of ["look", "dc", "dl", "da", "ang"]) o[k].textContent = "—";
      return;
    }
    const curves = [["var(--vec-u)", (Dc) => Dc], ["var(--vec-v)", (Dc, zz) => t.DM(Dc) * (1 + zz)], ["var(--brand)", (Dc, zz) => t.DM(Dc) / (1 + zz)]];
    for (const [col, fn] of curves) {
      const pts = [];
      for (let i = 1; i < t.zs.length; i += 6) {
        const zz = t.zs[i];
        if (zz < 0.01) continue;
        const d = fn(t.dc[i], zz) / 1000;
        if (d > 0) pts.push([f.sx(lg(zz)), f.sy(Math.max(lg(0.03), Math.min(lg(200), lg(d))))]);
      }
      polyline(svg, pts, `stroke:${col};stroke-width:2`);
    }
    const Dc = at(t, z, t.dc), Dm = t.DM(Dc), Dl = Dm * (1 + z), Da = Dm / (1 + z);
    el("line", { x1: f.sx(lg(z)), x2: f.sx(lg(z)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    for (const [d, col] of [[Dc, "var(--vec-u)"], [Dl, "var(--vec-v)"], [Da, "var(--brand)"]]) {
      if (d / 1000 > 0.03 && d / 1000 < 200) el("circle", { cx: f.sx(lg(z)), cy: f.sy(lg(d / 1000)), r: 4, style: `fill:var(--background);stroke:${col};stroke-width:2` }, svg);
    }

    // Angular size of a 30 kpc galaxy.
    const g = frame(sizeSvg, {
      box: [56, 22, 556, 60], x: [lg(0.01), lg(10)], y: [0, 60],
      xticks: [0.01, 0.1, 1, 10].map(lg), xfmt: (v) => `${+(10 ** v).toPrecision(1)}`,
      yticks: [0, 20, 40, 60], yfmt: (v) => `${v}″`, xlabel: "redshift z (log)",
    });
    const arcsec = (D) => ((0.03 / D) * 180 * 3600) / Math.PI;
    const pts = [];
    let minA = Infinity, minZ = 0;
    for (let i = 1; i < t.zs.length; i += 4) {
      const zz = t.zs[i];
      if (zz < 0.01) continue;
      const a = arcsec(t.DM(t.dc[i]) / (1 + zz));
      if (a < minA) { minA = a; minZ = zz; }
      if (a <= 60) pts.push([g.sx(lg(zz)), g.sy(a)]);
    }
    polyline(sizeSvg, pts, "stroke:var(--brand);stroke-width:2");
    if (minZ < 9.9) {
      el("circle", { cx: g.sx(lg(minZ)), cy: g.sy(minA), r: 3.5, style: "fill:var(--brand)" }, sizeSvg);
      text(sizeSvg, g.sx(lg(minZ)), g.sy(minA) - 8, `smallest at z ≈ ${num(minZ, 2)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    }
    text(sizeSvg, 4, 8, "30 kpc galaxy spans", { "text-anchor": "start" });

    const fmtD = (mpc) => `${num(mpc / 1000, 2)} Gpc (${num((mpc * 3.26156) / 1000, 1)} Gly)`;
    o.look.textContent = `${num(at(t, z, t.tl), 2)} Gyr`;
    o.dc.textContent = fmtD(Dc);
    o.dl.textContent = fmtD(Dl);
    o.da.textContent = fmtD(Da);
    o.ang.textContent = `${num(arcsec(Da), 2)}″`;
  }
  draw();
}

// ============================================================ CMB

const CMB_T = 2.7255;
const CMB_N = 128, CMB_DEG = 20;

// In-place radix-2 FFT on separate real/imaginary arrays.
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar; im[i + k] += ai;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

// Toy D_ℓ = ℓ(ℓ+1)C_ℓ/2π in µK²: a plateau plus damped acoustic peaks whose
// positions scale with the first peak ℓ₁. Shaped like the measured
// spectrum, not fitted to it.
function toyDl(l, l1) {
  const peaks = [[1, 4300, 0.33], [2.45, 900, 0.27], [3.7, 1250, 0.27], [4.95, 500, 0.25], [6.2, 400, 0.25]];
  let d = 1000 + 900 * (1 - Math.exp(-l / (0.8 * l1)));
  for (const [pos, amp, w] of peaks) d += amp * Math.exp(-0.5 * ((l - pos * l1) / (w * l1)) ** 2);
  return d * Math.exp(-((l / (6.5 * l1)) ** 2));
}

for (const root of document.querySelectorAll("[data-astro-cmb]")) {
  const canvas = root.querySelector("[data-canvas]");
  const ctx = canvas.getContext("2d");
  const power = root.querySelector("[data-power]");
  const spec = root.querySelector("[data-spectrum]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let seed = 7, noise = null;
  const N = CMB_N, L = (CMB_DEG * Math.PI) / 180;
  const off = document.createElement("canvas");
  off.width = off.height = N;
  const octx = off.getContext("2d");
  const img = new ImageData(N, N);

  function newNoise() {
    const rng = mulberry32(seed);
    noise = { re: new Float64Array(N * N), im: new Float64Array(N * N) };
    for (let i = 0; i < N * N; i++) { noise.re[i] = gauss(rng); noise.im[i] = gauss(rng); }
  }

  function draw() {
    const omega = s.omega.get();
    const l1 = 220 / Math.sqrt(omega);
    // Shape white noise by √C_ℓ in Fourier space; ℓ = 2π|k|/L.
    const re = new Float64Array(N * N), im = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      const ky = y <= N / 2 ? y : y - N;
      for (let x = 0; x < N; x++) {
        const kx = x <= N / 2 ? x : x - N;
        const l = (2 * Math.PI * Math.hypot(kx, ky)) / L;
        if (l < 1) continue;
        const Cl = (2 * Math.PI * toyDl(l, l1)) / (l * (l + 1));
        const a = Math.sqrt(Cl);
        re[y * N + x] = noise.re[y * N + x] * a;
        im[y * N + x] = noise.im[y * N + x] * a;
      }
    }
    for (let y = 0; y < N; y++) {
      const r = re.subarray(y * N, y * N + N), i = im.subarray(y * N, y * N + N);
      fft(r, i, true);
    }
    const cr = new Float64Array(N), ci = new Float64Array(N);
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) { cr[y] = re[y * N + x]; ci[y] = im[y * N + x]; }
      fft(cr, ci, true);
      for (let y = 0; y < N; y++) re[y * N + x] = cr[y];
    }
    // Normalise to the variance the spectrum implies: σ² = Σ (2ℓ+1)C_ℓ/4π.
    let target = 0;
    const lmin = (2 * Math.PI) / L, lmax = (2 * Math.PI * (N / 2)) / L;
    for (let l = Math.ceil(lmin); l <= lmax; l++) target += ((2 * l + 1) * ((2 * Math.PI * toyDl(l, l1)) / (l * (l + 1)))) / (4 * Math.PI);
    let mean = 0;
    for (let i = 0; i < N * N; i++) mean += re[i];
    mean /= N * N;
    let v = 0;
    for (let i = 0; i < N * N; i++) v += (re[i] - mean) ** 2;
    const scale = Math.sqrt(target / (v / (N * N)));
    const rms = Math.sqrt(target);
    const cold = rgbOf(root, "--vec-u"), hot = rgbOf(root, "--code-del"), bg = rgbOf(root, "--background");
    for (let i = 0; i < N * N; i++) {
      const t = Math.max(-1, Math.min(1, ((re[i] - mean) * scale) / (2.5 * rms)));
      const c = t < 0 ? cold : hot, w = Math.abs(t) ** 0.8;
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = bg[k] + (c[k] - bg[k]) * w;
      img.data[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    const { w, h } = fitCanvas(canvas);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);
    // A 1° scale bar.
    const fgc = getComputedStyle(root).getPropertyValue("--foreground").trim();
    const bar = (w / CMB_DEG) * 1;
    ctx.fillStyle = fgc;
    ctx.fillRect(w * 0.05, h * 0.93, bar, Math.max(2, h / 160));
    ctx.font = `${Math.round(w / 32)}px ui-monospace, monospace`;
    ctx.fillText("1°", w * 0.05 + bar + w / 80, h * 0.93 + h / 70);

    // Power spectrum.
    power.replaceChildren();
    const f = frame(power, {
      box: [44, 22, 304, 140], x: [0, 1400], y: [0, 7000],
      xticks: [0, 500, 1000], yticks: [0, 2000, 4000, 6000], yfmt: (v) => `${v / 1000}k`,
      xlabel: "multipole ℓ", ylabel: "D_ℓ (µK², toy)",
    });
    const pts = [];
    for (let l = 2; l <= 1400; l += 4) pts.push([f.sx(l), f.sy(Math.min(7000, toyDl(l, l1)))]);
    polyline(power, pts, "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.sx(Math.min(1400, l1)), x2: f.sx(Math.min(1400, l1)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, power);
    text(power, f.sx(Math.min(1400, l1)) + 4, f.T + 10, `ℓ₁ ≈ ${Math.round(l1)}`, { class: "fill-foreground font-mono text-[10px]" });

    // Blackbody at 2.7255 K: B_ν in MJy/sr against frequency (log).
    spec.replaceChildren();
    const lg = Math.log10;
    const g = frame(spec, {
      box: [44, 22, 304, 100], x: [lg(10), lg(1000)], y: [0, 400],
      xticks: [10, 100, 1000].map(lg), xfmt: (v) => `${Math.round(10 ** v)}`,
      yticks: [0, 200, 400], xlabel: "frequency (GHz, log)", ylabel: "B_ν (MJy/sr)",
    });
    const bnu = (nu) => ((2 * H * nu ** 3) / (C * C)) / Math.expm1((H * nu) / (KB * CMB_T)) / 1e-20;
    const sp = [];
    for (let i = 0; i <= 160; i++) { const nu = 10 ** (1 + (2 * i) / 160) * 1e9; sp.push([g.sx(lg(nu / 1e9)), g.sy(bnu(nu))]); }
    polyline(spec, sp, "stroke:var(--vec-out);stroke-width:2");
    const nuPeak = (2.821439372 * KB * CMB_T) / H;
    el("circle", { cx: g.sx(lg(nuPeak / 1e9)), cy: g.sy(bnu(nuPeak)), r: 3.5, style: "fill:var(--vec-out)" }, spec);
    text(spec, g.sx(lg(nuPeak / 1e9)) + 6, g.sy(bnu(nuPeak)) + 4, `${num(nuPeak / 1e9, 1)} GHz`, { class: "fill-foreground font-mono text-[10px]" });

    o.l1.textContent = `≈ ${Math.round(l1)}`;
    o.spot.textContent = `≈ ${num(180 / l1, 2)}°`;
    o.rms.textContent = `${Math.round(rms)} µK (toy map)`;
    o.nu.textContent = `${num(nuPeak / 1e9, 1)} GHz · λ_peak ${num(((WIEN / CMB_T) * 1000), 2)} mm`;
  }

  root.querySelector('[data-action="new"]').addEventListener("click", () => { seed = (seed * 48271) % 2147483647; newNoise(); draw(); });
  let pending = 0;
  const later = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); };
  new ResizeObserver(later).observe(canvas);
  onTheme(later);
  newNoise();
  draw();
}

// ============================================================ GW chirp

const GW_PRESETS = { gw150914: [36, 29, 410], gw170817: [1.46, 1.27, 40], heavy: [80, 80, 1000] };
const F_LOW = 35;

for (const root of document.querySelectorAll("[data-astro-gw]")) {
  const wave = root.querySelector("[data-wave]");
  const freq = root.querySelector("[data-freq]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, (k) => { const [a, b, d] = GW_PRESETS[k]; s.m1.set(a, false); s.m2.set(b, false); s.d.set(d, false); draw(); });

  function model() {
    const m1 = s.m1.get(), m2 = s.m2.get(), dMpc = s.d.get();
    const M = m1 + m2;
    const Mc = (m1 * m2) ** 0.6 / M ** 0.2;
    const T = (GMSUN * Mc) / C ** 3; // chirp-mass time scale (s)
    const fisco = C ** 3 / (6 ** 1.5 * Math.PI * GMSUN * M);
    const tauOf = (f) => (5 / 256) * (Math.PI * f) ** (-8 / 3) * T ** (-5 / 3);
    const fOf = (tau) => (1 / Math.PI) * (5 / (256 * tau)) ** 0.375 * T ** -0.625;
    const phase = (tau) => -2 * (tau / (5 * T)) ** 0.625; // GW phase
    const d = dMpc * MPC;
    const lenC = (GMSUN * Mc) / (C * C);
    const hOf = (f) => (4 / d) * lenC ** (5 / 3) * ((Math.PI * f) / C) ** (2 / 3);
    return { m1, m2, M, Mc, T, fisco, tauOf, fOf, phase, hOf };
  }

  function draw() {
    const g = model();
    wave.replaceChildren();
    freq.replaceChildren();
    const tauIsco = g.tauOf(g.fisco);
    if (g.fisco <= F_LOW) {
      text(wave, 320, 100, `Merges at ${num(g.fisco, 1)} Hz, below the 35 Hz band shown.`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      for (const k of ["tau", "cycles"]) o[k].textContent = "—";
    } else {
      const tauLow = g.tauOf(F_LOW);
      const span = Math.min(tauLow - tauIsco, 1);
      const hMax = g.hOf(g.fisco);
      const e = Math.floor(Math.log10(hMax));
      const unitH = 10 ** e;
      const yTop = Math.ceil((hMax / unitH) * 1.15 * 2) / 2;
      const f = frame(wave, {
        box: [56, 24, 556, 140], x: [-span, 0], y: [-yTop, yTop],
        xticks: [-span, -span / 2, 0].map((v) => +v.toPrecision(3)), xfmt: (v) => `${num(v, span < 0.1 ? 3 : 2)} s`,
        yticks: [-yTop, 0, yTop], yfmt: (v) => num(v, 1),
        xlabel: span < tauLow - tauIsco ? `last ${num(span, 2)} s before merger` : "time before merger", ylabel: `strain h (× 10${sup(e)})`,
      });
      const n = 3000, pts = [], top = [], bot = [];
      let dense = false;
      for (let i = 0; i <= n; i++) {
        const t = -span + (span * i) / n; // time relative to ISCO
        const tau = tauIsco - t;
        const fr = g.fOf(tau);
        if ((span / n) * fr > 0.15) dense = true;
        const amp = g.hOf(fr) / unitH;
        pts.push([f.sx(t), f.sy(amp * Math.cos(g.phase(tau)))]);
        top.push([f.sx(t), f.sy(amp)]);
        bot.push([f.sx(t), f.sy(-amp)]);
      }
      if (dense) {
        el("polygon", { points: [...top, ...bot.reverse()].map((q) => q.join(",")).join(" "), style: "fill:var(--brand);fill-opacity:0.25" }, wave);
        polyline(wave, pts.slice(Math.floor(n * 0.97)), "stroke:var(--brand);stroke-width:1.25");
        text(wave, f.L + 6, f.T + 12, "too many cycles to draw: envelope shown", { "text-anchor": "start" });
      } else {
        polyline(wave, pts, "stroke:var(--brand);stroke-width:1.25");
      }

      const lg = Math.log10;
      const fTop = Math.max(300, g.fisco * 1.6);
      const ff = frame(freq, {
        box: [56, 22, 556, 96], x: [-span, 0], y: [lg(20), lg(fTop)],
        xticks: [-span, -span / 2, 0].map((v) => +v.toPrecision(3)), xfmt: (v) => `${num(v, span < 0.1 ? 3 : 2)} s`,
        yticks: [30, 100, 300, 1000, 3000].filter((v) => v <= fTop).map(lg), yfmt: (v) => `${Math.round(10 ** v)}`,
        ylabel: "frequency (Hz, log)",
      });
      const fp = [];
      for (let i = 0; i <= 400; i++) {
        const t = -span + (span * i) / 400;
        fp.push([ff.sx(t), ff.sy(Math.min(lg(fTop), lg(g.fOf(tauIsco - t))))]);
      }
      polyline(freq, fp, "stroke:var(--vec-u);stroke-width:2");
      const cycles = (g.phase(tauIsco) - g.phase(tauLow)) / (2 * Math.PI);
      o.tau.textContent = tauLow - tauIsco < 120 ? `${num(tauLow - tauIsco, 3)} s` : `${num((tauLow - tauIsco) / 60, 1)} min`;
      o.cycles.textContent = `${Math.round(cycles).toLocaleString("en-US")}`;
    }
    o.mc.textContent = `${num(g.Mc, 2)} M☉ (total ${num(g.M, 1)})`;
    o.fisco.textContent = `${num(g.fisco, 1)} Hz`;
    o.hmax.textContent = sci(g.hOf(g.fisco), 2);
  }

  // Listen: the chirp at its real frequencies (the last 2 s at most).
  let audio = null;
  root.querySelector('[data-action="sound"]').addEventListener("click", () => {
    const g = model();
    if (g.fisco <= F_LOW) return;
    audio ??= new AudioContext();
    const rate = audio.sampleRate;
    const tauIsco = g.tauOf(g.fisco);
    const span = Math.min(g.tauOf(F_LOW) - tauIsco, 2);
    const len = Math.floor((span + 0.05) * rate);
    const buf = audio.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    const hIsco = g.hOf(g.fisco);
    for (let i = 0; i < len; i++) {
      const t = i / rate - span;
      if (t > 0) { data[i] = 0; continue; }
      const tau = tauIsco - t;
      const fade = Math.min(1, (i / rate) / 0.05);
      data[i] = 0.6 * fade * (g.hOf(g.fOf(tau)) / hIsco) * Math.cos(g.phase(tau));
    }
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(audio.destination);
    src.start();
  });

  draw();
}

