// Geography & demography blocks: projections with Tissot indicatrices,
// great circles and rhumb lines, solar time, contours and profiles, a
// coordinates quiz, population growth, a cohort-component projection and
// the gravity model. Spherical Earth, mean radius 6,371 km.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const R_EARTH = 6371; // km, IUGG mean radius
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const cities = (root) => [...root.querySelector("template[data-cities]").content.children].map((d) => ({ key: d.dataset.key, name: d.dataset.name, lat: +d.dataset.lat, lon: +d.dataset.lon }));
const km = (v) => `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(v)} km`;
const latStr = (v, d = 0) => `${num(Math.abs(v), d)}° ${v >= 0 ? "N" : "S"}`;
const lonStr = (v, d = 0) => `${num(Math.abs(v), d)}° ${v >= 0 ? "E" : "W"}`;
const wrap180 = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
const compass = (b) => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(b / 22.5) % 16];

// Haversine distance (km) and initial bearing (degrees from north).
function haversine(a, b) {
  const p1 = rad(a.lat), p2 = rad(b.lat), dp = p2 - p1, dl = rad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
// Point at angular distance d (radians) along bearing t from (lat, lon).
function destination(lat, lon, t, d) {
  const p1 = rad(lat), l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(p2), wrap180(deg(l2))];
}

// A plate carrée map in a pixel box: lon −180..180, lat −90..90.
function plateCarree(svg, box, { graticule = 30, labels = true } = {}) {
  const [L, T, W, H] = box;
  const x = (lon) => L + ((lon + 180) / 360) * W, y = (lat) => T + ((90 - lat) / 180) * H;
  el("rect", { x: L, y: T, width: W, height: H, rx: 4, style: "fill:color-mix(in oklab,var(--vec-u) 5%,transparent);stroke:currentColor;stroke-opacity:0.25" }, svg);
  for (let lon = -180 + graticule; lon < 180; lon += graticule) {
    el("line", { x1: x(lon), x2: x(lon), y1: T, y2: T + H, style: `stroke:currentColor;stroke-opacity:${lon === 0 ? 0.35 : 0.1}` }, svg);
    if (labels) text(svg, x(lon), T + H + 12, lonStr(lon), { "text-anchor": "middle" });
  }
  for (let lat = -90 + graticule; lat < 90; lat += graticule) {
    el("line", { x1: L, x2: L + W, y1: y(lat), y2: y(lat), style: `stroke:currentColor;stroke-opacity:${lat === 0 ? 0.35 : 0.1}` }, svg);
    if (labels) text(svg, L - 4, y(lat) + 3, latStr(lat), { "text-anchor": "end" });
  }
  return { x, y, L, T, W, H };
}

// Draws a lat/lon track on a plate carrée map, breaking at the antimeridian.
function track(svg, m, pts, style) {
  let run = [];
  const flush = () => { if (run.length > 1) polyline(svg, run, style); run = []; };
  pts.forEach(([lat, lon], i) => {
    if (i > 0 && Math.abs(lon - pts[i - 1][1]) > 180) flush();
    run.push([m.x(lon), m.y(lat)]);
  });
  flush();
}

function cityDots(svg, m, list, highlight = []) {
  for (const c of list) {
    const on = highlight.includes(c.key);
    el("circle", { cx: m.x(c.lon), cy: m.y(c.lat), r: on ? 4.5 : 2.5, style: on ? "fill:var(--brand);stroke:var(--background);stroke-width:2" : "fill:currentColor;fill-opacity:0.55" }, svg);
    text(svg, m.x(c.lon) + 6, m.y(c.lat) - 5, c.name, { class: on ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[9px]" });
  }
}

// ============================================================ Projections

const PROJECTIONS = {
  equirect: {
    keeps: "distances along meridians",
    f: (p, l) => [l, p],
  },
  mercator: {
    keeps: "angles and local shapes (conformal)",
    maxLat: 80,
    f: (p, l) => [l, Math.log(Math.tan(Math.PI / 4 + p / 2))],
  },
  gallpeters: {
    keeps: "area (equal-area, standard parallels 45°)",
    f: (p, l) => [l * Math.SQRT1_2, Math.sin(p) / Math.SQRT1_2],
  },
  mollweide: {
    keeps: "area (equal-area)",
    f: (p, l) => {
      // Solve 2θ + sin 2θ = π sin φ by Newton's method.
      let t = p;
      for (let i = 0; i < 30; i++) {
        const fx = 2 * t + Math.sin(2 * t) - Math.PI * Math.sin(p);
        const d = 2 + 2 * Math.cos(2 * t);
        if (Math.abs(d) < 1e-12) break;
        t -= fx / d;
        if (Math.abs(fx) < 1e-12) break;
      }
      return [(2 * Math.SQRT2 / Math.PI) * l * Math.cos(t), Math.SQRT2 * Math.sin(t)];
    },
  },
};

// Principal scale factors on the central meridian, by finite differences
// of the unit-sphere projection (h along the meridian, k along the parallel).
function scales(proj, latDeg) {
  const p = rad(latDeg), e = 1e-6;
  const [, y1] = proj.f(p - e, 0), [, y2] = proj.f(p + e, 0);
  const h = Math.abs(y2 - y1) / (2 * e);
  const [x1] = proj.f(p, -e), [x2] = proj.f(p, e);
  const k = Math.abs(x2 - x1) / (2 * e) / Math.cos(p);
  return { h, k, area: h * k, omega: deg(2 * Math.asin(Math.abs(h - k) / (h + k))) };
}

for (const root of document.querySelectorAll("[data-geo-projection]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const list = cities(root);
  let key = "equirect";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { key = e.detail.value; draw(); });

  function draw() {
    const pr = PROJECTIONS[key];
    const maxLat = pr.maxLat ?? 90;
    const P = (lat, lon) => pr.f(rad(Math.max(-maxLat, Math.min(maxLat, lat))), rad(lon));
    // Fit the projection's extent into the 640×400 box.
    const [xmax] = pr.f(0, Math.PI), [, ymax] = pr.f(rad(maxLat), 0);
    const sc = Math.min(600 / (2 * xmax), 360 / (2 * ymax));
    const X = (v) => 320 + v * sc, Y = (v) => 200 - v * sc;
    const pt = (lat, lon) => { const [x, y] = P(lat, lon); return [X(x), Y(y)]; };
    svg.replaceChildren();

    // Outline: an ellipse for Mollweide, a rectangle otherwise.
    const edge = [];
    for (let lat = -maxLat; lat <= maxLat; lat += 2) edge.push(pt(lat, 180));
    for (let lat = maxLat; lat >= -maxLat; lat -= 2) edge.push(pt(lat, -180));
    el("path", { d: "M" + edge.map((q) => q.map((v) => v.toFixed(1)).join(",")).join("L") + "Z", style: "fill:color-mix(in oklab,var(--vec-u) 5%,transparent);stroke:currentColor;stroke-opacity:0.35" }, svg);
    for (let lon = -150; lon <= 150; lon += 30) {
      const line = [];
      for (let lat = -maxLat; lat <= maxLat; lat += 2) line.push(pt(lat, lon));
      polyline(svg, line, `stroke:currentColor;stroke-opacity:${lon === 0 ? 0.35 : 0.12}`);
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      if (Math.abs(lat) > maxLat) continue;
      const line = [];
      for (let lon = -180; lon <= 180; lon += 3) line.push(pt(lat, lon));
      polyline(svg, line, `stroke:currentColor;stroke-opacity:${lat === 0 ? 0.35 : 0.12}`);
    }
    // The chosen latitude.
    const chosen = s.lat.get();
    if (chosen <= maxLat) {
      for (const sign of [1, -1]) {
        const line = [];
        for (let lon = -180; lon <= 180; lon += 3) line.push(pt(sign * chosen, lon));
        polyline(svg, line, "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:4 4");
      }
    }
    // Tissot indicatrices: circles of 6° angular radius on the sphere.
    const r = rad(6);
    for (const lat of [-60, -30, 0, 30, 60]) {
      for (const lon of [-150, -90, -30, 30, 90, 150]) {
        const ring = [];
        for (let a = 0; a <= 360; a += 10) {
          const [la, lo] = destination(lat, lon, rad(a), r);
          ring.push(pt(la, lo));
        }
        el("path", { d: "M" + ring.map((q) => q.map((v) => v.toFixed(1)).join(",")).join("L") + "Z", style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-width:1" }, svg);
      }
    }
    for (const c of list) {
      if (Math.abs(c.lat) > maxLat) continue;
      const [x, y] = pt(c.lat, c.lon);
      el("circle", { cx: x, cy: y, r: 2.5, style: "fill:var(--foreground)" }, svg);
      text(svg, x + 5, y - 4, c.name, { class: "fill-muted-foreground font-mono text-[9px]" });
    }
    if (pr.maxLat) text(svg, 320, 395, `cut at ${pr.maxLat}° N/S: the poles lie at infinity`, { "text-anchor": "middle" });

    const sc2 = scales(pr, Math.min(chosen, maxLat));
    o.keeps.textContent = pr.keeps;
    o.h.textContent = num(sc2.h, 3);
    o.k.textContent = num(sc2.k, 3);
    o.area.textContent = `${num(sc2.area, 3)}${key === "mollweide" ? " (on the central meridian)" : ""}`;
    o.omega.textContent = `${num(sc2.omega, 1)}°`;
  }
  draw();
}

// ============================================================ Great circle

for (const root of document.querySelectorAll("[data-geo-gc]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const list = cities(root);
  const pick = { a: "paris", b: "nyc" };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    pick[b.dataset.pick] = b.dataset.city;
    for (const x of root.querySelectorAll(`[data-pick="${b.dataset.pick}"]`)) x.setAttribute("aria-checked", String(x === b));
    draw();
  });

  function draw() {
    const A = list.find((c) => c.key === pick.a), B = list.find((c) => c.key === pick.b);
    svg.replaceChildren();
    const m = plateCarree(svg, [44, 10, 586, 293]);
    cityDots(svg, m, list, [A.key, B.key]);
    if (A.key === B.key) {
      for (const k of ["gc", "rhumb", "saved", "bearing", "rbearing"]) o[k].textContent = "—";
      o.gc.textContent = "pick two different cities";
      return;
    }
    // Great circle: interpolate on the unit sphere (slerp).
    const v = (c) => [Math.cos(rad(c.lat)) * Math.cos(rad(c.lon)), Math.cos(rad(c.lat)) * Math.sin(rad(c.lon)), Math.sin(rad(c.lat))];
    const va = v(A), vb = v(B);
    const om = Math.acos(Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    const gc = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
      const p = va.map((x, j) => s1 * x + s2 * vb[j]);
      gc.push([deg(Math.asin(p[2])), deg(Math.atan2(p[1], p[0]))]);
    }
    // Rhumb line: a straight line in Mercator's (λ, ψ).
    const psi = (lat) => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
    const dl = rad(wrap180(B.lon - A.lon)), dpsi = psi(B.lat) - psi(A.lat), dphi = rad(B.lat - A.lat);
    const rh = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, ps = psi(A.lat) + t * dpsi;
      rh.push([deg(2 * Math.atan(Math.exp(ps)) - Math.PI / 2), wrap180(A.lon + deg(t * dl))]);
    }
    const q = Math.abs(dpsi) > 1e-12 ? dphi / dpsi : Math.cos(rad(A.lat));
    const rhumbKm = Math.sqrt(dphi * dphi + q * q * dl * dl) * R_EARTH;
    track(svg, m, rh, "stroke:var(--vec-u);stroke-width:1.75;stroke-dasharray:6 4");
    track(svg, m, gc, "stroke:var(--brand);stroke-width:2.25");
    cityDots(svg, m, list.filter((c) => c.key === A.key || c.key === B.key), [A.key, B.key]);

    const d = haversine(A, B), b0 = bearing(A, B), rb = (deg(Math.atan2(dl, dpsi)) + 360) % 360;
    o.gc.textContent = km(d);
    o.rhumb.textContent = km(rhumbKm);
    o.saved.textContent = `${km(rhumbKm - d)} (${num(100 * (rhumbKm - d) / rhumbKm, 1)}%)`;
    o.bearing.textContent = `${num(b0, 1)}° (${compass(b0)})`;
    o.rbearing.textContent = `${num(rb, 1)}° (${compass(rb)}), all the way`;
  }
  draw();
}

// ============================================================ Solar time

// Equation of time (minutes, apparent − mean solar time); a standard
// approximation good to about a minute.
const eotMinutes = (day) => {
  const B = (2 * Math.PI * (day - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
};
const hhmm = (h) => {
  const t = ((h % 24) + 24) % 24;
  let H = Math.floor(t), M = Math.round((t - H) * 60);
  if (M === 60) { H = (H + 1) % 24; M = 0; }
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};

for (const root of document.querySelectorAll("[data-geo-solar]")) {
  const strip = root.querySelector("[data-strip]"), eotSvg = root.querySelector("[data-eot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const lon = s.lon.get(), utc = s.utc.get(), day = Math.round(s.day.get());
    const E = eotMinutes(day);
    const L = 20, W = 600, x = (l) => L + ((l + 180) / 360) * W;
    strip.replaceChildren();
    // Nominal zones, 15° wide, centred on multiples of 15°.
    for (let n = -12; n <= 12; n++) {
      const a = Math.max(-180, n * 15 - 7.5), b = Math.min(180, n * 15 + 7.5);
      el("rect", { x: x(a), y: 40, width: x(b) - x(a), height: 80, style: `fill:currentColor;fill-opacity:${n % 2 ? 0.04 : 0.08}` }, strip);
      if (n % 2 === 0) text(strip, x(n * 15), 34, n === 0 ? "UTC" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`, { "text-anchor": "middle" });
    }
    // Night at the equator near an equinox: apparent solar time outside
    // 6–18 h. Runs of night longitudes become single rectangles.
    let start = null;
    for (let l = -180; l <= 180; l += 0.5) {
      const ast = (((utc + l / 15 + E / 60) % 24) + 24) % 24;
      const night = l < 180 && (ast < 6 || ast > 18);
      if (night && start === null) start = l;
      if (!night && start !== null) {
        el("rect", { x: x(start), y: 40, width: x(l) - x(start), height: 80, style: "fill:var(--vec-u);fill-opacity:0.16" }, strip);
        start = null;
      }
    }
    for (let l = -180; l <= 180; l += 60) text(strip, x(l), 136, lonStr(l), { "text-anchor": "middle" });
    // The subsolar meridian: where apparent solar time is noon.
    const sub = wrap180((12 - utc - E / 60) * 15);
    el("circle", { cx: x(sub), cy: 80, r: 9, style: "fill:var(--vec-out);stroke:var(--background);stroke-width:2" }, strip);
    text(strip, x(sub), 158, "solar noon", { "text-anchor": "middle", style: "fill:var(--vec-out)" });
    el("line", { x1: x(lon), x2: x(lon), y1: 36, y2: 124, style: "stroke:var(--brand);stroke-width:2" }, strip);
    el("circle", { cx: x(lon), cy: 124, r: 4, style: "fill:var(--brand)" }, strip);
    text(strip, x(lon), 16, "you", { "text-anchor": "middle", style: "fill:var(--brand)" });

    eotSvg.replaceChildren();
    const f = frame(eotSvg, { box: [40, 12, 580, 110], x: [1, 365], y: [-16, 18], xticks: [1, 91, 182, 274, 365], yticks: [-15, 0, 15], xfmt: (d) => ["1 Jan", "1 Apr", "1 Jul", "1 Oct", "31 Dec"][[1, 91, 182, 274, 365].indexOf(d)], yfmt: (v) => `${v > 0 ? "+" : ""}${v}`.replace("-", "−"), ylabel: "minutes" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, eotSvg);
    polyline(eotSvg, Array.from({ length: 365 }, (_, i) => [f.sx(i + 1), f.sy(eotMinutes(i + 1))]), "stroke:var(--vec-out);stroke-width:2");
    el("circle", { cx: f.sx(day), cy: f.sy(E), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, eotSvg);

    const n = Math.round(lon / 15);
    const mean = utc + lon / 15;
    o.zone.textContent = n === 0 ? "UTC" : `UTC${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    o.clock.textContent = hhmm(utc + n);
    o.mean.textContent = hhmm(mean);
    o.apparent.textContent = hhmm(mean + E / 60);
    o.eot.textContent = `${E >= 0 ? "+" : "−"}${num(Math.abs(E), 1)} min (sundial ${E >= 0 ? "ahead" : "behind"})`;
    o.noon.textContent = hhmm(12 - lon / 15 - E / 60);
  }
  draw();
}

// ============================================================ Contours

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const root of document.querySelectorAll("[data-geo-contours]")) {
  const svg = root.querySelector("[data-map]"), prof = root.querySelector("[data-profile]");
  const o = outs(root);
  const M_PER_PX = 4; // 600 px = 2.4 km
  let seed = 3, hills = [];
  let A = [110, 300], B = [480, 110];
  const s = scrubAll(root, draw);

  function terrain() {
    const rng = mulberry32(seed * 7919);
    hills = Array.from({ length: 7 }, () => ({ x: rng() * 600, y: rng() * 400, a: 60 + rng() * 220, s: 50 + rng() * 90 }));
  }
  const height = (x, y) => 180 + hills.reduce((h, k) => h + k.a * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (2 * k.s * k.s)), 0);

  // Marching squares on a 5-px grid; one path per level.
  function contours(interval) {
    const G = 5, nx = 600 / G, ny = 400 / G;
    const v = [];
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= ny; j++) { v.push([]); for (let i = 0; i <= nx; i++) { const z = height(i * G, j * G); v[j].push(z); lo = Math.min(lo, z); hi = Math.max(hi, z); } }
    const levels = [];
    for (let z = Math.ceil(lo / interval) * interval; z <= hi; z += interval) levels.push(z);
    const lerp = (a, b, za, zb, z) => a + ((z - za) / (zb - za)) * (b - a);
    return levels.map((z) => {
      let d = "";
      let label = null;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const z0 = v[j][i], z1 = v[j][i + 1], z2 = v[j + 1][i + 1], z3 = v[j + 1][i];
        const x0 = i * G, y0 = j * G;
        const e = [];
        if ((z0 < z) !== (z1 < z)) e.push([lerp(x0, x0 + G, z0, z1, z), y0]);
        if ((z1 < z) !== (z2 < z)) e.push([x0 + G, lerp(y0, y0 + G, z1, z2, z)]);
        if ((z3 < z) !== (z2 < z)) e.push([lerp(x0, x0 + G, z3, z2, z), y0 + G]);
        if ((z0 < z) !== (z3 < z)) e.push([x0, lerp(y0, y0 + G, z0, z3, z)]);
        for (let k = 0; k + 1 < e.length; k += 2) {
          d += `M${e[k][0].toFixed(1)},${e[k][1].toFixed(1)}L${e[k + 1][0].toFixed(1)},${e[k + 1][1].toFixed(1)}`;
          if (!label && i > 4 && i < nx - 8 && j > 2 && j < ny - 3) label = e[k];
        }
      }
      return { z, d, label };
    });
  }

  function draw() {
    const interval = s.interval.get();
    svg.replaceChildren();
    el("rect", { x: 0, y: 0, width: 600, height: 400, rx: 6, style: "fill:color-mix(in oklab,var(--ion-cl) 6%,transparent)" }, svg);
    for (const c of contours(interval)) {
      const index = Math.round(c.z / interval) % 5 === 0;
      el("path", { d: c.d, style: `fill:none;stroke:color-mix(in oklab,var(--vec-out) 55%,var(--foreground));stroke-opacity:${index ? 0.9 : 0.45};stroke-width:${index ? 1.6 : 0.8}` }, svg);
      if (index && c.label) {
        el("rect", { x: c.label[0] - 13, y: c.label[1] - 7, width: 26, height: 12, rx: 2, style: "fill:var(--code-bg)" }, svg);
        text(svg, c.label[0], c.label[1] + 3, String(c.z), { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
      }
    }
    // Scale bar: 500 m.
    el("rect", { x: 20, y: 372, width: 500 / M_PER_PX, height: 5, style: "fill:var(--foreground)" }, svg);
    text(svg, 20, 366, "0", {});
    text(svg, 20 + 500 / M_PER_PX, 366, "500 m", { "text-anchor": "middle" });
    text(svg, 590, 390, "1:25,000 · contours every " + interval + " m", { "text-anchor": "end" });

    // Transect and its handles.
    el("line", { x1: A[0], y1: A[1], x2: B[0], y2: B[1], style: "stroke:var(--brand);stroke-width:2" }, svg);
    for (const [p, name] of [[A, "A"], [B, "B"]]) {
      const g = el("g", { tabindex: 0, role: "slider", "aria-label": `Transect end ${name}: arrow keys move it`, "data-end": name, class: "cursor-grab outline-none" }, svg);
      el("circle", { cx: p[0], cy: p[1], r: 14, style: "fill:transparent" }, g);
      el("circle", { cx: p[0], cy: p[1], r: 7, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, g);
      text(g, p[0], p[1] + 3.5, name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px] pointer-events-none" });
    }

    // Profile.
    const N = 240, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = A[0] + t * (B[0] - A[0]), y = A[1] + t * (B[1] - A[1]);
      pts.push(height(x, y));
    }
    const dist = Math.hypot(B[0] - A[0], B[1] - A[1]) * M_PER_PX;
    prof.replaceChildren();
    const lo = Math.floor(Math.min(...pts) / 50) * 50, hi = Math.ceil(Math.max(...pts) / 50) * 50 + 10;
    const f = frame(prof, { box: [48, 10, 540, 130], x: [0, Math.max(dist, 1)], y: [lo, hi], xticks: [], yticks: [lo, Math.round((lo + hi) / 2), hi], ylabel: "m" });
    const line = pts.map((z, i) => [f.sx((i / N) * dist), f.sy(z)]);
    el("path", { d: `M${f.sx(0)},${f.T + f.H}L` + line.map((q) => q.map((v) => v.toFixed(1)).join(",")).join("L") + `L${f.sx(dist)},${f.T + f.H}Z`, style: "fill:var(--vec-out);fill-opacity:0.18" }, prof);
    polyline(prof, line, "stroke:var(--foreground);stroke-width:1.75");
    text(prof, f.L, f.T + f.H + 14, "A", {});
    text(prof, f.L + f.W, f.T + f.H + 14, `B · ${num(dist / 1000, 2)} km`, { "text-anchor": "end" });

    let up = 0, down = 0, steep = 0;
    const step = dist / N;
    for (let i = 1; i <= N; i++) {
      const dz = pts[i] - pts[i - 1];
      dz > 0 ? (up += dz) : (down -= dz);
      if (step > 0) steep = Math.max(steep, Math.abs(dz) / step);
    }
    const ve = dist > 0 ? (dist / f.W) / ((hi - lo) / f.H) : 0;
    o.dist.textContent = dist >= 1000 ? `${num(dist / 1000, 2)} km` : `${Math.round(dist)} m`;
    o.mapdist.textContent = `${num(dist / 250, 1)} cm at 1:25,000`;
    o.heights.textContent = `${Math.round(pts[0])} m → ${Math.round(pts[N])} m`;
    o.climb.textContent = `+${Math.round(up)} m / −${Math.round(down)} m`;
    o.steep.textContent = `${num(steep * 100, 0)}% (${num(deg(Math.atan(steep)), 1)}°)`;
    o.ve.textContent = `× ${num(ve, 1)}`;
  }

  // Dragging and keyboard for the two ends.
  const toSvg = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.max(4, Math.min(596, q.x)), Math.max(4, Math.min(396, q.y))];
  };
  let dragging = null;
  svg.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-end]");
    if (!g) return;
    dragging = g.dataset.end;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = toSvg(e);
    dragging === "A" ? (A = p) : (B = p);
    draw();
  });
  svg.addEventListener("pointerup", () => (dragging = null));
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-end]");
    const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (!g || !d) return;
    e.preventDefault();
    const p = g.dataset.end === "A" ? A : B;
    const q = [Math.max(4, Math.min(596, p[0] + d[0])), Math.max(4, Math.min(396, p[1] + d[1]))];
    g.dataset.end === "A" ? (A = q) : (B = q);
    draw();
    svg.querySelector(`[data-end="${g.dataset.end}"]`)?.focus();
  });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; terrain(); draw(); });
  terrain();
  draw();
}

// ============================================================ Coordinates quiz

for (const root of document.querySelectorAll("[data-geo-latlon]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const next = root.querySelector("[data-action=next]");
  const ROUNDS = 5;
  let game = 0, round, targets, errors, answered;

  function restart() {
    const rng = mulberry32(1000 + game++);
    targets = Array.from({ length: ROUNDS }, () => ({ lat: Math.round(rng() * 140 - 70), lon: Math.round(rng() * 340 - 170) }));
    round = 0; errors = []; answered = null;
    draw();
  }

  function draw() {
    svg.replaceChildren();
    const m = plateCarree(svg, [44, 10, 586, 293]);
    const t = targets[round];
    if (answered) {
      el("line", { x1: m.x(answered.lon), y1: m.y(answered.lat), x2: m.x(t.lon), y2: m.y(t.lat), style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:3 3" }, svg);
      el("circle", { cx: m.x(answered.lon), cy: m.y(answered.lat), r: 5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
      el("circle", { cx: m.x(t.lon), cy: m.y(t.lat), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    }
    svg.dataset.m = JSON.stringify([m.L, m.T, m.W, m.H]);
    o.round.textContent = `${Math.min(round + 1, ROUNDS)} of ${ROUNDS}`;
    o.target.textContent = `${latStr(t.lat)}, ${lonStr(t.lon)}`;
    o.guess.textContent = answered ? `${latStr(answered.lat, 1)}, ${lonStr(answered.lon, 1)}` : "—";
    o.err.textContent = answered ? km(errors[errors.length - 1]) : "—";
    o.avg.textContent = errors.length ? km(errors.reduce((a, b) => a + b, 0) / errors.length) : "—";
    next.disabled = !answered || round >= ROUNDS - 1;
  }

  svg.addEventListener("click", (e) => {
    if (answered) return;
    const [L, T, W, H] = JSON.parse(svg.dataset.m);
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    if (q.x < L || q.x > L + W || q.y < T || q.y > T + H) return;
    answered = { lon: ((q.x - L) / W) * 360 - 180, lat: 90 - ((q.y - T) / H) * 180 };
    const d = haversine(answered, targets[round]);
    errors.push(d);
    o.hint.textContent = round === ROUNDS - 1
      ? `Done: average error ${km(errors.reduce((a, b) => a + b, 0) / errors.length)}. Restart for new points.`
      : d < 500 ? "Very close." : d < 1500 ? "Close: check which hemisphere each number points to." : "Remember: latitude is the row (N/S), longitude the column (E/W).";
    draw();
  });
  next.addEventListener("click", () => { round++; answered = null; o.hint.textContent = "Click the map where this point is."; draw(); });
  root.querySelector("[data-action=restart]").addEventListener("click", () => { o.hint.textContent = "Click the map where this point is."; restart(); });
  restart();
}

// ============================================================ Population growth

for (const root of document.querySelectorAll("[data-geo-growth]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const N0 = s.n0.get(), r = s.r.get() / 100, K = s.k.get(), T = s.years.get();
    const ex = (t) => N0 * Math.exp(r * t);
    const lg = (t) => K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
    const ymax = Math.max(K, N0) * 1.6;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 486, 286], x: [0, T], y: [0, ymax], xticks: [0, T / 4, T / 2, (3 * T) / 4, T].map(Math.round), yticks: [0, Math.round(ymax / 2), Math.round(ymax)], ylabel: "millions", xlabel: "years" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(K), y2: f.sy(K), style: "stroke:var(--vec-u);stroke-dasharray:5 4" }, svg);
    text(svg, f.L + f.W - 2, f.sy(K) - 5, `K = ${K}`, { "text-anchor": "end", style: "fill:var(--vec-u)" });
    const exPts = [];
    for (let i = 0; i <= 300; i++) {
      const t = (T * i) / 300, v = ex(t);
      if (v > ymax) { exPts.push([f.sx(Math.log(ymax / N0) / r), f.sy(ymax)]); break; }
      exPts.push([f.sx(t), f.sy(v)]);
    }
    polyline(svg, exPts, "stroke:var(--foreground);stroke-width:1.75");
    polyline(svg, Array.from({ length: 301 }, (_, i) => { const t = (T * i) / 300; return [f.sx(t), f.sy(lg(t))]; }), "stroke:var(--brand);stroke-width:2.25");
    const dbl = Math.LN2 / r;
    for (let k = 1; dbl * k <= T && N0 * 2 ** k <= ymax; k++) el("circle", { cx: f.sx(dbl * k), cy: f.sy(N0 * 2 ** k), r: 2.5, style: "fill:var(--foreground)" }, svg);
    const tInf = N0 < K ? Math.log((K - N0) / N0) / r : NaN;
    if (tInf > 0 && tInf <= T) {
      el("circle", { cx: f.sx(tInf), cy: f.sy(K / 2), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    }
    o.dbl.textContent = `${num(dbl, 1)} years`;
    o.r70.textContent = `${num(70 / (r * 100), 1)} years`;
    o.exp.textContent = `${num(ex(T), 0)} M`;
    o.log.textContent = `${num(lg(T), 1)} M`;
    o.infl.textContent = Number.isFinite(tInf) && tInf > 0 ? `year ${num(tInf, 0)}, at K/2 = ${num(K / 2, 0)} M` : N0 >= K ? "starts at or above K" : "at the start";
  }
  draw();
}

// ============================================================ Ageing and dependency

// A stylised cohort-component model, both sexes together, 5-year groups
// 0–4 … 80–84 and 85+. Mortality: Gompertz hazard μ(x) = A·e^{Bx}, with A
// solved so that life expectancy at birth matches e₀.
const GOMPERTZ_B = 0.09;
function lifeTable(e0) {
  const S = (A, x) => Math.exp((-A / GOMPERTZ_B) * (Math.exp(GOMPERTZ_B * x) - 1));
  const e = (A) => { let sum = 0; for (let x = 0; x < 130; x += 0.25) sum += 0.25 * S(A, x + 0.125); return sum; };
  let lo = 1e-9, hi = 1; // e0 falls as A grows: bisect on log A
  for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); e(mid) > e0 ? (lo = mid) : (hi = mid); }
  const A = Math.sqrt(lo * hi);
  const Lx = []; // person-years lived in each group (per 1 newborn)
  for (let g = 0; g < 18; g++) {
    const a = g * 5, b = g === 17 ? 130 : a + 5;
    let sum = 0;
    for (let x = a; x < b; x += 0.25) sum += 0.25 * S(A, x + 0.125);
    Lx.push(sum);
  }
  return { Lx, S: (x) => S(A, x) };
}
const FERTILITY_SHAPE = [0.05, 0.2, 0.3, 0.25, 0.13, 0.05, 0.02]; // ages 15–19 … 45–49

function project(tfr, e0, steps) {
  const { Lx, S } = lifeTable(e0);
  // Start from a young, growing stable population (1.5%/yr), index 100.
  let pop = Lx.map((L, g) => L * Math.exp(-0.015 * (g * 5 + 2.5)));
  const tot0 = pop.reduce((a, b) => a + b, 0);
  pop = pop.map((v) => (v / tot0) * 100);
  const out = [pop];
  for (let k = 0; k < steps; k++) {
    const next = new Array(18).fill(0);
    for (let g = 0; g < 16; g++) next[g + 1] = pop[g] * (Lx[g + 1] / Lx[g]);
    next[17] = (pop[16] + pop[17]) * (Lx[17] / (Lx[16] + Lx[17]));
    // Births over five years: women (half of each group) × annual rates × 5.
    let births = 0;
    for (let i = 0; i < 7; i++) births += 0.5 * pop[3 + i] * (tfr * FERTILITY_SHAPE[i] / 5) * 5;
    next[0] = births * (Lx[0] / 5);
    pop = next;
    out.push(pop);
  }
  // Net reproduction: daughters per woman surviving to a mean age of 29.
  const nrr = tfr * (1 / 2.05) * S(29);
  return { years: out, nrr };
}

for (const root of document.querySelectorAll("[data-geo-dependency]")) {
  const agesSvg = root.querySelector("[data-ages]"), ratioSvg = root.querySelector("[data-ratio]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const share = (p) => {
    const young = p.slice(0, 3).reduce((a, b) => a + b, 0), work = p.slice(3, 13).reduce((a, b) => a + b, 0), old = p.slice(13).reduce((a, b) => a + b, 0);
    return { young, work, old, total: young + work + old };
  };

  function draw() {
    const { years, nrr } = project(s.tfr.get(), s.e0.get(), 20);
    const k = Math.round(s.year.get() / 5);
    const p = years[k], sh = share(p);

    agesSvg.replaceChildren();
    const maxShare = Math.max(...years.flat().map((v, i) => v / share(years[Math.floor(i / 18)]).total)) * 100;
    const f = frame(agesSvg, { box: [44, 14, 200, 296], x: [0, Math.ceil(maxShare)], y: [0, 18], xticks: [0, Math.ceil(maxShare)], yticks: [], xfmt: (v) => `${v}%` });
    p.forEach((v, g) => {
      const pc = (v / sh.total) * 100;
      const color = g < 3 ? "var(--vec-u)" : g < 13 ? "var(--foreground)" : "var(--brand)";
      el("rect", { x: f.sx(0), y: f.sy(g + 1) + 1, width: f.sx(pc) - f.sx(0), height: f.sy(g) - f.sy(g + 1) - 2, rx: 1.5, style: `fill:${color};fill-opacity:${g < 3 || g >= 13 ? 0.75 : 0.35}` }, agesSvg);
      if (g % 3 === 0 || g === 17) text(agesSvg, f.L - 4, f.sy(g + 0.5) + 3, g === 17 ? "85+" : `${g * 5}`, { "text-anchor": "end" });
    });
    text(agesSvg, f.L + f.W, 6, `year ${k * 5}`, { "text-anchor": "end" });

    ratioSvg.replaceChildren();
    const ser = years.map((y) => { const z = share(y); return { t: (z.young + z.old) / z.work * 100, y: z.young / z.work * 100, o: z.old / z.work * 100 }; });
    const ymax = Math.max(100, ...ser.map((v) => v.t)) * 1.1;
    const g = frame(ratioSvg, { box: [40, 26, 306, 274], x: [0, 100], y: [0, ymax], xticks: [0, 25, 50, 75, 100], yticks: [0, 50, 100], xlabel: "years", ylabel: "per 100 aged 15–64" });
    polyline(ratioSvg, ser.map((v, i) => [g.sx(i * 5), g.sy(v.y)]), "stroke:var(--vec-u);stroke-width:1.5");
    polyline(ratioSvg, ser.map((v, i) => [g.sx(i * 5), g.sy(v.o)]), "stroke:var(--brand);stroke-width:1.5");
    polyline(ratioSvg, ser.map((v, i) => [g.sx(i * 5), g.sy(v.t)]), "stroke:var(--foreground);stroke-width:2.25");
    el("line", { x1: g.sx(k * 5), x2: g.sx(k * 5), y1: g.T, y2: g.T + g.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, ratioSvg);
    el("circle", { cx: g.sx(k * 5), cy: g.sy(ser[k].t), r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, ratioSvg);

    o.total.textContent = num(ser[k].t, 1);
    o.split.textContent = `${num(ser[k].y, 1)} young + ${num(ser[k].o, 1)} old`;
    o.old.textContent = `${num((sh.old / sh.total) * 100, 1)}%`;
    o.pop.textContent = num(sh.total, 1);
    o.repl.textContent = `NRR ${num(nrr, 2)} (1 = each generation replaces itself)`;
  }
  draw();
}

// ============================================================ Gravity model

for (const root of document.querySelectorAll("[data-geo-gravity]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const KM_PER_PX = 0.5;
  const towns = [
    { name: "A", pop: 500, x: 170, y: 170 },
    { name: "B", pop: 300, x: 430, y: 120 },
    { name: "C", pop: 150, x: 300, y: 300 },
    { name: "D", pop: 80, x: 520, y: 320 },
    { name: "E", pop: 220, x: 90, y: 330 },
    { name: "F", pop: 60, x: 360, y: 200 },
  ];
  const s = scrubAll(root, draw);

  function draw() {
    towns[0].pop = s.popA.get();
    const beta = s.beta.get();
    const flows = [];
    for (let i = 0; i < towns.length; i++) for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i], b = towns[j];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_PX);
      flows.push({ a, b, d, f: (a.pop * b.pop) / d ** beta });
    }
    const fmax = Math.max(...flows.map((x) => x.f));
    svg.replaceChildren();
    el("rect", { x: 0, y: 0, width: 600, height: 400, rx: 6, style: "fill:color-mix(in oklab,var(--vec-u) 4%,transparent)" }, svg);
    for (const x of flows) {
      const w = x.f / fmax;
      el("line", { x1: x.a.x, y1: x.a.y, x2: x.b.x, y2: x.b.y, style: `stroke:var(--brand);stroke-opacity:${0.15 + 0.7 * w};stroke-width:${0.75 + 9 * w};stroke-linecap:round` }, svg);
    }
    // Reilly's breaking point between the two largest towns: the place
    // whose pull to each is equal, d_j = d / (1 + (P_i / P_j)^(1/β)).
    const [big, second] = [...towns].sort((a, b) => b.pop - a.pop);
    const dij = Math.hypot(big.x - second.x, big.y - second.y);
    const fromSmall = dij / (1 + (big.pop / second.pop) ** (1 / beta));
    const t = fromSmall / dij;
    const bp = [second.x + t * (big.x - second.x), second.y + t * (big.y - second.y)];
    el("line", { x1: bp[0] - 8, y1: bp[1] - 8, x2: bp[0] + 8, y2: bp[1] + 8, style: "stroke:var(--foreground);stroke-width:2" }, svg);
    el("line", { x1: bp[0] - 8, y1: bp[1] + 8, x2: bp[0] + 8, y2: bp[1] - 8, style: "stroke:var(--foreground);stroke-width:2" }, svg);
    towns.forEach((tw, i) => {
      const r = 6 + Math.sqrt(tw.pop) * 0.6;
      const g = el("g", { tabindex: 0, role: "slider", "aria-label": `Town ${tw.name}, population ${tw.pop} thousand: drag or use arrow keys`, "data-town": i, class: "cursor-grab outline-none" }, svg);
      el("circle", { cx: tw.x, cy: tw.y, r, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, g);
      text(g, tw.x, tw.y + 4, tw.name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px] pointer-events-none" });
      text(g, tw.x, tw.y + r + 12, `${Math.round(tw.pop)}k`, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px] pointer-events-none" });
    });
    // Scale bar: 50 km.
    el("rect", { x: 20, y: 380, width: 50 / KM_PER_PX, height: 4, style: "fill:var(--foreground)" }, svg);
    text(svg, 20 + 50 / KM_PER_PX + 6, 386, "50 km", {});

    const total = flows.reduce((a, x) => a + x.f, 0);
    const list = root.querySelector("[data-out=flows]");
    list.replaceChildren(...[...flows].sort((a, b) => b.f - a.f).slice(0, 5).map((x) => {
      const li = document.createElement("li");
      li.className = "flex justify-between gap-3";
      li.innerHTML = `<span>${x.a.name} ↔ ${x.b.name} <span class="text-muted-foreground">${num(x.d, 0)} km</span></span><span class="tabular-nums">${num((100 * x.f) / total, 1)}%</span>`;
      return li;
    }));
    o.bp.textContent = `${num(fromSmall * KM_PER_PX, 1)} km from ${second.name}, ${num((dij - fromSmall) * KM_PER_PX, 1)} km from ${big.name}`;
  }

  const toSvg = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.max(20, Math.min(580, q.x)), Math.max(20, Math.min(370, q.y))];
  };
  let drag = -1;
  svg.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-town]");
    if (!g) return;
    drag = +g.dataset.town;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    [towns[drag].x, towns[drag].y] = toSvg(e);
    draw();
  });
  svg.addEventListener("pointerup", () => (drag = -1));
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-town]");
    const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (!g || !d) return;
    e.preventDefault();
    const tw = towns[+g.dataset.town];
    tw.x = Math.max(20, Math.min(580, tw.x + d[0]));
    tw.y = Math.max(20, Math.min(370, tw.y + d[1]));
    draw();
    svg.querySelector(`[data-town="${g.dataset.town}"]`)?.focus();
  });
  draw();
}
