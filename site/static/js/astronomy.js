// Astronomy blocks. Constants: 1 AU = 149,597,870.7 km, light-time per AU
// 499.005 s, 1 pc = 3.26156 ly = 3.08568e13 km, R☉ = 695,700 km,
// R⊕ = 6,371 km, c = 299,792.458 km/s.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const AU_KM = 149597870.7;
const AU_LIGHT_S = 499.005;
const PC_LY = 3.26156;
const PC_KM = 3.08568e13;
const C_KMS = 299792.458;
const RSUN_KM = 695700;
const REARTH_KM = 6371;
const RAD = Math.PI / 180;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const minus = (s) => String(s).replace("-", "−");
const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
const sci = (v, d = 2) => {
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / 10 ** e;
  return `${m.toFixed(d)} × 10${String(e).split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c] ?? (c === "-" ? "⁻" : c)).join("")}`;
};

// Play buttons: the icon is an SVG, so toggle its hidden attribute.
function playButton(btn, labels) {
  return (on) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    btn.querySelector("[data-label]").textContent = on ? "Pause" : labels;
  };
}

// A loop that runs only while the block is visible and playing.
function animator(root, btn, label, tick) {
  const setLabel = playButton(btn, label);
  let playing = false, visible = false, raf = 0, last = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt);
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => {
    if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  const set = (p) => { playing = p; setLabel(p); kick(); };
  btn.addEventListener("click", () => set(!playing));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return { stop: () => set(false) };
}

function duration(s) {
  if (s < 60) return `${num(s, 1)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}

// ============================================================ Scale

const PLANETS = [
  // name, semi-major axis (AU, J2000), mean radius (km)
  ["Mercury", 0.387, 2439.7], ["Venus", 0.723, 6051.8], ["Earth", 1.0, 6371.0], ["Mars", 1.524, 3389.5],
  ["Jupiter", 5.203, 69911], ["Saturn", 9.537, 58232], ["Uranus", 19.19, 25362], ["Neptune", 30.07, 24622],
];

for (const root of document.querySelectorAll("[data-astro-scale]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "log", sel = 2;
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function draw() {
    svg.replaceChildren();
    const L = 50, R = 620, Y = 120;
    const x = mode === "log"
      ? (a) => L + ((Math.log10(a) - Math.log10(0.25)) / (Math.log10(40) - Math.log10(0.25))) * (R - L)
      : (a) => L + (a / 31) * (R - L);
    el("line", { x1: L - 30, x2: R, y1: Y, y2: Y, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    const ticks = mode === "log" ? [0.25, 0.5, 1, 2, 5, 10, 20, 40] : [0, 5, 10, 15, 20, 25, 30];
    for (const t of ticks) {
      el("line", { x1: x(t), x2: x(t), y1: Y + 50, y2: Y + 56, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      text(svg, x(t), Y + 68, `${t}`, { "text-anchor": "middle" });
    }
    text(svg, R, Y + 84, "distance from the Sun (AU)", { "text-anchor": "end" });
    // The Sun: on the log axis it sits off to the left (log 0 = −∞).
    el("circle", { cx: L - 34, cy: Y, r: 16, style: "fill:var(--vec-out)" }, svg);
    text(svg, 4, Y + 32, mode === "log" ? "Sun (at 0, off the log axis)" : "Sun", { "text-anchor": "start" });
    PLANETS.forEach(([name, a, r], i) => {
      const g = el("g", { tabindex: 0, role: "button", "aria-label": name, class: "cursor-pointer outline-none" }, svg);
      const cx = x(a), rr = 2.5 + 11 * Math.sqrt(r / 69911);
      el("line", { x1: cx, x2: cx, y1: Y + 14, y2: Y + 50, style: "stroke:currentColor;stroke-opacity:0.15" }, g);
      el("circle", { cx, cy: Y, r: rr + 6, style: "fill:transparent" }, g);
      el("circle", { cx, cy: Y, r: rr, style: `fill:${i === sel ? "var(--brand)" : "var(--foreground)"};fill-opacity:${i === sel ? 1 : 0.75}` }, g);
      // Alternate label rows so crowded inner planets stay readable.
      const up = i % 2 === 0;
      text(g, cx, up ? Y - rr - 10 : Y - rr - 24, name, { "text-anchor": "middle", class: `font-mono text-[10px] ${i === sel ? "fill-foreground" : "fill-muted-foreground"}` });
      const pick = () => { sel = i; draw(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    const [name, a, r] = PLANETS[sel];
    o.name.textContent = name;
    o.au.textContent = `${num(a, 3)} AU`;
    o.km.textContent = `${sci(a * AU_KM, 3)} km`;
    o.light.textContent = duration(a * AU_LIGHT_S);
    o.radius.textContent = `${fmtInt(r)} km (${num(r / 6371, 2)} R⊕)`;
  }
  draw();
}

// ============================================================ Moon phases

const SYNODIC = 29.530589;
const LIT = "#efe9d8", NIGHT = "#2f2f33"; // sunlit and unlit lunar surface
const PHASES = ["New Moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full Moon", "Waning gibbous", "Last quarter", "Waning crescent"];

for (const root of document.querySelectorAll("[data-astro-moon]")) {
  const orbit = root.querySelector("[data-orbit]");
  const disc = root.querySelector("[data-disc]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const day = s.day.get();
    const e = ((day / SYNODIC) * 360) % 360; // elongation, degrees
    // Top view: Sun far to the left; the Moon orbits counterclockwise.
    orbit.replaceChildren();
    for (const y of [-80, -40, 0, 40, 80]) {
      el("line", { x1: -128, x2: -108, y1: y, y2: y, style: "stroke:var(--vec-out);stroke-width:1.5;stroke-opacity:0.7" }, orbit);
      el("path", { d: `M-108 ${y - 3}L-103 ${y}L-108 ${y + 3}`, style: "fill:none;stroke:var(--vec-out);stroke-opacity:0.7" }, orbit);
    }
    text(orbit, -128, -100, "sunlight", { "text-anchor": "start" });
    el("circle", { cx: 0, cy: 0, r: 85, style: "fill:none;stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:3 4" }, orbit);
    // Night sides dark grey, day sides light: the same in both themes.
    const half = (cx, cy, r, cls) => {
      el("circle", { cx, cy, r, style: `fill:${NIGHT};stroke:currentColor;stroke-opacity:0.2` }, orbit);
      el("path", { d: `M${cx} ${cy - r}A${r} ${r} 0 0 0 ${cx} ${cy + r}Z`, style: `fill:${cls}` }, orbit);
    };
    half(0, 0, 14, "var(--vec-u)");
    text(orbit, 0, 30, "Earth", { "text-anchor": "middle" });
    const a = (180 + e) * RAD;
    const mx = 85 * Math.cos(a), my = -85 * Math.sin(a);
    half(mx, my, 8, LIT);
    el("line", { x1: 0, y1: 0, x2: mx * 0.8, y2: my * 0.8, style: "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:2 3" }, orbit);

    // The Moon as seen from the Northern Hemisphere: waxing lit on the right.
    disc.replaceChildren();
    const R = 50;
    el("circle", { cx: 0, cy: 0, r: R, style: `fill:${NIGHT};stroke:currentColor;stroke-opacity:0.15` }, disc);
    const waxing = e <= 180;
    const ce = Math.cos(e * RAD); // terminator ellipse x-radius = R·|cos e|
    const rx = Math.abs(ce) * R;
    // Right half circle (top → bottom through the right), then the
    // terminator back to the top: on the lit side for a crescent.
    const sweep = ce > 0 ? 0 : 1;
    const d = `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${sweep} 0 ${-R}Z`;
    el("path", { d, transform: waxing ? "" : "scale(-1 1)", style: `fill:${LIT}` }, disc);

    const lit = (1 - ce) / 2;
    o.phase.textContent = PHASES[Math.round(e / 45) % 8];
    o.lit.textContent = `${num(lit * 100, 1)}%`;
    o.elong.textContent = `${num(e, 1)}°`;
  }

  animator(root, root.querySelector("[data-action=play]"), "Play month", (dt) => {
    s.day.set((s.day.get() + dt * 2.5) % SYNODIC, false); // a month in ≈ 12 s
    draw();
  });
  draw();
}

// ============================================================ Seasons

const declination = (n) => -23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10));
const daylight = (lat, dec) => {
  const x = -Math.tan(lat * RAD) * Math.tan(dec * RAD);
  if (x <= -1) return 24; // midnight sun
  if (x >= 1) return 0; // polar night
  return (2 * Math.acos(x)) / RAD / 15;
};
const hm = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")} min`;

for (const root of document.querySelectorAll("[data-astro-seasons]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-lat]").forEach((b) => b.addEventListener("click", () => s.lat.set(Number(b.dataset.lat))));

  function draw() {
    const lat = s.lat.get(), doy = Math.round(s.doy.get());
    svg.replaceChildren();
    const months = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    const f = frame(svg, { box: [44, 18, 548, 240], x: [1, 365], y: [0, 90], xticks: months, yticks: [0, 30, 60, 90], xfmt: (d) => "JFMAMJJASOND"[months.indexOf(d)], ylabel: "noon Sun (°)" });
    // Day length shares the box: 24 h at the top.
    for (const hTick of [6, 12, 18, 24]) text(svg, f.L + f.W + 6, f.sy((hTick / 24) * 90) + 3, `${hTick} h`, { "text-anchor": "start" });
    const days = Array.from({ length: 365 }, (_, i) => i + 1);
    polyline(svg, days.map((d) => [f.sx(d), f.sy(Math.max(0, 90 - Math.abs(lat - declination(d))))]), "stroke:var(--brand);stroke-width:2");
    polyline(svg, days.map((d) => [f.sx(d), f.sy((daylight(lat, declination(d)) / 24) * 90)]), "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:6 4");
    el("line", { x1: f.sx(doy), x2: f.sx(doy), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    const dec = declination(doy), elev = 90 - Math.abs(lat - dec), dl = daylight(lat, dec);
    el("circle", { cx: f.sx(doy), cy: f.sy(Math.max(0, elev)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    el("circle", { cx: f.sx(doy), cy: f.sy((dl / 24) * 90), r: 4, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
    text(svg, f.L + 4, 290, "— noon elevation", { style: "fill:var(--brand)" });
    text(svg, f.L + 130, 290, "- - daylight (right axis)", { style: "fill:var(--vec-u)" });
    o.dec.textContent = `${minus(num(dec, 2))}°`;
    o.elev.textContent = elev > 0 ? `${num(elev, 1)}°` : `${minus(num(elev, 1))}° (below the horizon)`;
    o.day.textContent = dl >= 24 ? "24 h (midnight sun)" : dl <= 0 ? "0 h (polar night)" : hm(dl);
  }
  draw();
}

// ============================================================ Sky dome

const STARS = [
  // name, RA (h), Dec (°), visual magnitude — J2000, rounded
  ["Sirius", 6.752, -16.716, -1.46], ["Canopus", 6.399, -52.696, -0.74], ["Alpha Centauri", 14.66, -60.834, -0.27],
  ["Arcturus", 14.261, 19.182, -0.05], ["Vega", 18.616, 38.784, 0.03], ["Capella", 5.278, 45.998, 0.08],
  ["Rigel", 5.242, -8.202, 0.13], ["Procyon", 7.655, 5.225, 0.34], ["Betelgeuse", 5.919, 7.407, 0.42],
  ["Altair", 19.846, 8.868, 0.76], ["Acrux", 12.443, -63.099, 0.76], ["Aldebaran", 4.599, 16.509, 0.86],
  ["Antares", 16.49, -26.432, 0.96], ["Spica", 13.42, -11.161, 0.97], ["Pollux", 7.755, 28.026, 1.14],
  ["Fomalhaut", 22.961, -29.622, 1.16], ["Deneb", 20.69, 45.28, 1.25], ["Regulus", 10.14, 11.967, 1.35],
  ["Polaris", 2.53, 89.264, 1.98],
];

function altaz(raH, dec, lat, lst) {
  const H = (lst - raH) * 15 * RAD, d = dec * RAD, p = lat * RAD;
  const alt = Math.asin(Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
  return [alt / RAD, ((az / RAD) + 360) % 360];
}

for (const root of document.querySelectorAll("[data-astro-sky]")) {
  const svg = root.querySelector("[data-dome]");
  const o = outs(root);
  let sel = STARS.findIndex((x) => x[0] === "Polaris"), showEq = true;
  const s = scrubAll(root, draw);
  root.querySelector("[data-toggle=equator]").addEventListener("shadcn:checked-change", (e) => { showEq = e.detail.checked; draw(); });
  const R = 150;
  // Looking up with north at the top, east is on the left.
  const xy = (alt, az) => { const r = ((90 - alt) / 90) * R; return [-r * Math.sin(az * RAD), -r * Math.cos(az * RAD)]; };
  const hms = (h) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

  function draw() {
    const lat = s.lat.get(), lst = s.lst.get() % 24;
    svg.replaceChildren();
    el("circle", { cx: 0, cy: 0, r: R, style: "fill:color-mix(in oklab, var(--vec-u) 6%, var(--code-bg));stroke:currentColor;stroke-opacity:0.35" }, svg);
    for (const a of [30, 60]) el("circle", { cx: 0, cy: 0, r: ((90 - a) / 90) * R, style: "fill:none;stroke:currentColor;stroke-opacity:0.1" }, svg);
    for (const [lbl, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const [x, y] = xy(-9, az);
      text(svg, x, y + 3, lbl, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    }
    if (showEq) {
      let seg = [];
      const flush = () => { if (seg.length > 1) polyline(svg, seg, "stroke:var(--vec-out);stroke-width:1.25;stroke-dasharray:4 4"); seg = []; };
      for (let ra = 0; ra <= 24.001; ra += 0.1) {
        const [alt, az] = altaz(ra, 0, lat, lst);
        if (alt >= 0) seg.push(xy(alt, az)); else flush();
      }
      flush();
    }
    // The visible celestial pole sits at altitude |φ|.
    const pole = lat >= 0 ? xy(lat, 0) : xy(-lat, 180);
    el("path", { d: `M${pole[0] - 5} ${pole[1]}h10M${pole[0]} ${pole[1] - 5}v10`, style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    STARS.forEach(([name, ra, dec, mag], i) => {
      const [alt, az] = altaz(ra, dec, lat, lst);
      if (alt < 0) return;
      const [x, y] = xy(alt, az);
      const g = el("g", { tabindex: 0, role: "button", "aria-label": name, class: "cursor-pointer outline-none" }, svg);
      el("circle", { cx: x, cy: y, r: 9, style: "fill:transparent" }, g);
      el("circle", { cx: x, cy: y, r: Math.max(1.4, 4 - 0.9 * mag), style: `fill:${i === sel ? "var(--brand)" : "var(--foreground)"}` }, g);
      if (mag < 0.5 || i === sel) text(g, x + 6, y - 5, name, { class: `font-mono text-[9px] ${i === sel ? "fill-foreground" : "fill-muted-foreground"}` });
      const pick = () => { sel = i; draw(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    const [name, ra, dec] = STARS[sel];
    const [alt, az] = altaz(ra, dec, lat, lst);
    o.name.textContent = name;
    o.alt.textContent = alt >= 0 ? `${num(alt, 1)}°` : `${minus(num(alt, 1))}° (below the horizon)`;
    o.az.textContent = `${num(az, 1)}°`;
    o.radec.textContent = `${hms(ra)} / ${minus(num(dec, 1))}°`;
  }
  animator(root, root.querySelector("[data-action=play]"), "Turn the sky", (dt) => {
    s.lst.set((s.lst.get() + dt) % 24, false); // one sidereal hour per second
    draw();
  });
  draw();
}

// ============================================================ HR diagram

// Approximate blackbody colour (sRGB) for a temperature: a well-known
// curve fit (Tanner Helland), good enough to tint dots, not colorimetry.
function tempColor(T) {
  const t = T / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * (t - 60) ** -0.1332; g = 288.12 * (t - 60) ** -0.0755; b = 255; }
  const c = (v) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

const HR_STARS = [
  // name, Teff (K), L (L☉) — approximate literature values, rounded
  ["Sun", 5772, 1], ["Sirius A", 9940, 25.4], ["Vega", 9600, 40], ["Alpha Centauri A", 5790, 1.5],
  ["Arcturus", 4290, 170], ["Aldebaran", 3900, 440], ["Polaris", 6000, 1260], ["Spica", 22400, 20000],
  ["Rigel", 12100, 120000], ["Betelgeuse", 3500, 100000], ["Antares", 3600, 75000],
  ["Proxima Centauri", 3040, 0.0017], ["Barnard's Star", 3130, 0.0035], ["Sirius B", 25000, 0.056], ["Procyon B", 7740, 0.0005],
];

for (const root of document.querySelectorAll("[data-astro-hr]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let sel = -1; // −1: the slider star
  const s = scrubAll(root, () => { sel = -1; draw(); });
  const ms = (M) => { const L = M ** 3.5, R = M ** 0.8; return { L, R, T: 5772 * (L / (R * R)) ** 0.25 }; };

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 16, 560, 360], x: [Math.log10(40000), Math.log10(2500)], y: [-4.5, 6], xticks: [40000, 20000, 10000, 5000, 2500].map(Math.log10), yticks: [-4, -2, 0, 2, 4, 6], xfmt: (v) => `${fmtInt(10 ** v)}`, yfmt: (v) => (v === 0 ? "1" : `10${v < 0 ? "⁻" : ""}${"⁰¹²³⁴⁵⁶⁷⁸⁹"[Math.abs(v)]}`), xlabel: "surface temperature (K) ←hotter", ylabel: "L (L☉)" });
    // Constant-radius lines: log L = 2 log R + 4 (log T − log 5772).
    for (const R of [0.01, 0.1, 1, 10, 100, 1000]) {
      const y = (lt) => 2 * Math.log10(R) + 4 * (lt - Math.log10(5772));
      const pts = [];
      for (let lt = Math.log10(2500); lt <= Math.log10(40000); lt += 0.01) { const v = y(lt); if (v >= -4.5 && v <= 6) pts.push([f.sx(lt), f.sy(v)]); }
      if (pts.length > 1) {
        polyline(svg, pts, "stroke:currentColor;stroke-opacity:0.18;stroke-dasharray:3 4");
        const [px, py] = pts[pts.length - 1];
        text(svg, px + 2, py - 3, `${R} R☉`, { class: "fill-muted-foreground font-mono text-[9px]" });
      }
    }
    // Main sequence from the scalings.
    const msPts = [];
    for (let M = 0.2; M <= 40; M *= 1.05) { const m = ms(M); msPts.push([f.sx(Math.log10(m.T)), f.sy(Math.log10(m.L))]); }
    polyline(svg, msPts, "stroke:var(--brand);stroke-opacity:0.25;stroke-width:14;stroke-linecap:round;stroke-linejoin:round");
    text(svg, f.sx(Math.log10(15000)), f.sy(1.2), "main sequence", { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, f.sx(Math.log10(4300)), f.sy(3.2), "giants", { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, f.sx(Math.log10(9000)), f.sy(5.4), "supergiants", { class: "fill-muted-foreground font-mono text-[10px]" });
    text(svg, f.sx(Math.log10(30000)), f.sy(-2.7), "white dwarfs", { class: "fill-muted-foreground font-mono text-[10px]" });
    HR_STARS.forEach(([name, T, L], i) => {
      const x = f.sx(Math.log10(T)), y = f.sy(Math.log10(L));
      const g = el("g", { tabindex: 0, role: "button", "aria-label": name, class: "cursor-pointer outline-none" }, svg);
      el("circle", { cx: x, cy: y, r: 9, style: "fill:transparent" }, g);
      el("circle", { cx: x, cy: y, r: i === sel ? 6 : 4.5, style: `fill:${tempColor(T)};stroke:${i === sel ? "var(--brand)" : "var(--foreground)"};stroke-width:${i === sel ? 2 : 0.75};stroke-opacity:${i === sel ? 1 : 0.5}` }, g);
      const left = T < 3400 || name === "Betelgeuse" || name === "Antares";
      const dy = { Betelgeuse: -4, Antares: 10, "Barnard's Star": -3, "Proxima Centauri": 9, Vega: -4, "Sirius A": 8, "Alpha Centauri A": -6, Sun: 9 }[name] ?? 3;
      text(g, left ? x - 7 : x + 7, y + dy, name, { "text-anchor": left ? "end" : "start", class: `font-mono text-[9px] ${i === sel ? "fill-foreground" : "fill-muted-foreground"}` });
      const pick = () => { sel = i; draw(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    const M = s.mass.get(), m = ms(M);
    const mx = f.sx(Math.log10(m.T)), my = f.sy(Math.log10(m.L));
    el("path", { d: `M${mx} ${my - 8}L${mx + 8} ${my}L${mx} ${my + 8}L${mx - 8} ${my}Z`, style: `fill:${tempColor(m.T)};stroke:var(--brand);stroke-width:2` }, svg);
    const lum = (L) => (L >= 1000 || L < 0.01 ? sci(L, 1) : num(L, L < 1 ? 3 : 1));
    if (sel < 0) {
      o.name.textContent = `${num(M, 1)} M☉ main-sequence star`;
      o.temp.textContent = `≈ ${fmtInt(m.T)} K`;
      o.lum.textContent = `≈ ${lum(m.L)} L☉`;
      o.radius.textContent = `≈ ${num(m.R, 2)} R☉`;
      const life = 10 * M ** -2.5;
      o.life.textContent = life >= 1 ? `≈ ${num(life, 1)} Gyr` : `≈ ${fmtInt(life * 1000)} Myr`;
    } else {
      const [name, T, L] = HR_STARS[sel];
      o.name.textContent = name;
      o.temp.textContent = `≈ ${fmtInt(T)} K`;
      o.lum.textContent = `≈ ${lum(L)} L☉`;
      const R = Math.sqrt(L) * (5772 / T) ** 2;
      o.radius.textContent = `≈ ${R >= 100 ? fmtInt(R) : num(R, 2)} R☉`;
      o.life.textContent = "—";
    }
  }
  draw();
}

// ============================================================ Parallax

for (const root of document.querySelectorAll("[data-astro-parallax]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => s.p.set(Number(b.dataset.p))));

  function draw() {
    const p = s.p.get(), pc = 1 / p;
    svg.replaceChildren();
    // Not to scale: the star's height grows with log distance.
    const sun = [320, 250], orbitR = 70;
    const starY = 200 - 30 * Math.min(5.5, Math.log10(pc) + 1.5);
    const star = [320, Math.max(28, starY)];
    const bgY = 14;
    el("line", { x1: 40, x2: 600, y1: bgY, y2: bgY, style: "stroke:currentColor;stroke-opacity:0.15" }, svg);
    for (let x = 50; x < 600; x += 37) el("circle", { cx: x + ((x * 7) % 11), cy: bgY + ((x * 13) % 7) - 3, r: 1.2, style: "fill:currentColor;fill-opacity:0.5" }, svg);
    text(svg, 600, bgY + 16, "distant background stars", { "text-anchor": "end" });
    el("ellipse", { cx: sun[0], cy: sun[1], rx: orbitR, ry: 18, style: "fill:none;stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4" }, svg);
    el("circle", { cx: sun[0], cy: sun[1], r: 8, style: "fill:var(--vec-out)" }, svg);
    const e1 = [sun[0] - orbitR, sun[1]], e2 = [sun[0] + orbitR, sun[1]];
    // Sight lines through the star, extended to the background.
    for (const [e, lbl] of [[e1, "January"], [e2, "July"]]) {
      const t = (bgY - e[1]) / (star[1] - e[1]);
      const bx = e[0] + (star[0] - e[0]) * t;
      el("line", { x1: e[0], y1: e[1], x2: bx, y2: bgY, style: "stroke:var(--vec-u);stroke-opacity:0.6;stroke-width:1.25" }, svg);
      el("circle", { cx: bx, cy: bgY, r: 3.5, style: "fill:none;stroke:var(--brand);stroke-width:1.5" }, svg);
      el("circle", { cx: e[0], cy: e[1], r: 5, style: "fill:var(--vec-u)" }, svg);
      text(svg, e[0], e[1] + 20, `Earth, ${lbl}`, { "text-anchor": "middle" });
    }
    el("line", { x1: sun[0], y1: sun[1], x2: star[0], y2: star[1], style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3" }, svg);
    text(svg, sun[0] + 6, (sun[1] + star[1]) / 2, `d = 1/p (1 AU baseline)`, { class: "fill-muted-foreground font-mono text-[9px]" });
    el("circle", { cx: star[0], cy: star[1], r: 5, style: "fill:var(--foreground)" }, svg);
    text(svg, star[0] + 9, star[1] + 3, "p", { class: "fill-foreground font-mono text-[11px]" });
    o.pc.textContent = `${pc >= 100 ? fmtInt(pc) : num(pc, 2)} pc`;
    o.ly.textContent = `${pc * PC_LY >= 100 ? fmtInt(pc * PC_LY) : num(pc * PC_LY, 2)} ly`;
    o.km.textContent = `${sci(pc * PC_KM, 2)} km`;
    o.years.textContent = `${pc * PC_LY >= 100 ? fmtInt(pc * PC_LY) : num(pc * PC_LY, 2)} years`;
  }
  draw();
}

// ============================================================ Transit

// Area of overlap of a unit circle (the star) and a circle of radius k at
// centre distance d, as a fraction of the star's area.
function overlap(d, k) {
  if (d >= 1 + k) return 0;
  if (d <= 1 - k) return k * k;
  const a = Math.acos((d * d + 1 - k * k) / (2 * d));
  const b = Math.acos((d * d + k * k - 1) / (2 * d * k));
  return (a + k * k * b - 0.5 * Math.sqrt(Math.max(0, (-d + 1 + k) * (d + 1 - k) * (d - 1 + k) * (d + 1 + k)))) / Math.PI;
}

const TRANSIT_PRESETS = {
  earth: { rp: 1, rs: 1, ms: 1, period: 365.25 },
  jupiter: { rp: 11.2, rs: 1, ms: 1, period: 4332.6 },
  hotjupiter: { rp: 13, rs: 1.1, ms: 1.1, period: 3.5 },
};

for (const root of document.querySelectorAll("[data-astro-transit]")) {
  const star = root.querySelector("[data-star]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const s = scrubAll(root, () => { phase = -1; draw(); });
  let phase = -1, raf = 0, visible = false; // phase: −1..1 across the window
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = TRANSIT_PRESETS[b.dataset.preset];
    for (const k in p) s[k].set(p[k], false);
    phase = -1;
    draw();
  }));

  function model() {
    const k = (s.rp.get() * REARTH_KM) / (s.rs.get() * RSUN_KM);
    const aAU = Math.cbrt(s.ms.get() * (s.period.get() / 365.25) ** 2);
    const aR = (aAU * AU_KM) / (s.rs.get() * RSUN_KM); // a in stellar radii
    const P = s.period.get() * 24; // hours
    const dur = (P / Math.PI) * Math.asin(Math.min(1, (1 + k) / aR));
    return { k, aAU, aR, P, dur };
  }
  // Sky-plane separation (stellar radii) t hours from mid-transit, b = 0.
  const sep = (m, t) => Math.abs(m.aR * Math.sin((2 * Math.PI * t) / m.P));

  function draw() {
    const m = model();
    const win = m.dur * 0.8; // half-width of the plotted window
    // Star and planet.
    star.replaceChildren();
    const SR = 60, cx = 320, cy = 75;
    el("circle", { cx, cy, r: SR, style: "fill:var(--vec-out);fill-opacity:0.85" }, star);
    const t = phase * win;
    const x = cx + (m.aR * Math.sin((2 * Math.PI * t) / m.P)) * SR;
    el("circle", { cx: Math.max(-50, Math.min(690, x)), cy, r: Math.max(1.2, m.k * SR), style: "fill:var(--foreground)" }, star);
    // Light curve, flux relative to out of transit.
    curve.replaceChildren();
    const depth = m.k * m.k;
    const yMin = 1 - depth * 1.35;
    const f = frame(curve, { box: [64, 12, 548, 150], x: [-win, win], y: [yMin, 1 + depth * 0.15], xticks: [-win, 0, win].map((v) => Math.round(v * 10) / 10), yticks: [1, 1 - depth], xfmt: (v) => `${minus(num(v, 1))} h`, yfmt: (v) => (v === 1 ? "1" : depth < 0.001 ? `−${fmtInt(depth * 1e6)} ppm` : `−${num(depth * 100, 2)}%`), xlabel: "time from mid-transit", ylabel: "flux" });
    const pts = [];
    for (let i = 0; i <= 400; i++) { const tt = -win + (2 * win * i) / 400; pts.push([f.sx(tt), f.sy(1 - overlap(sep(m, tt), m.k))]); }
    polyline(curve, pts, "stroke:var(--foreground);stroke-width:1.75");
    el("circle", { cx: f.sx(t), cy: f.sy(1 - overlap(sep(m, t), m.k)), r: 4, style: "fill:var(--brand)" }, curve);
    o.depth.textContent = depth < 0.001 ? `${fmtInt(depth * 1e6)} ppm` : `${num(depth * 100, 2)}%`;
    o.a.textContent = `${num(m.aAU, 3)} AU (${fmtInt(m.aR)} R★)`;
    o.dur.textContent = `${num(m.dur, 1)} h`;
  }

  const loop = () => {
    phase += reduced() ? 0 : 0.006;
    if (phase > 1) phase = -1;
    draw();
    raf = visible && !reduced() ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && !reduced()) raf = requestAnimationFrame(loop);
  }).observe(root);
  draw();
}

// ============================================================ Hubble's law

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// Approximate colour of visible light by wavelength (nm), for the
// spectrum strip only.
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

for (const root of document.querySelectorAll("[data-astro-hubble]")) {
  const svg = root.querySelector("[data-plot]");
  const spec = root.querySelector("[data-spectrum]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-h0]").forEach((b) => b.addEventListener("click", () => s.h0.set(Number(b.dataset.h0))));
  // Synthetic galaxies: true H₀ = 70, 7% distance errors, ±300 km/s
  // peculiar velocities. Not real measurements.
  const rng = mulberry32(2024);
  const gals = Array.from({ length: 36 }, () => {
    const d = 8 + 390 * rng() ** 1.3;
    return [d * (1 + 0.07 * gauss(rng)), 70 * d + 300 * gauss(rng)];
  });
  const HA = 656.28;

  function draw() {
    const H0 = s.h0.get(), d = s.d.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 556, 240], x: [0, 420], y: [0, 32000], xticks: [0, 100, 200, 300, 400], yticks: [0, 10000, 20000, 30000], yfmt: (v) => `${v / 1000}k`, xlabel: "distance (Mpc)", ylabel: "v (km/s)" });
    for (const [gd, gv] of gals) el("circle", { cx: f.sx(gd), cy: f.sy(gv), r: 3, style: "fill:var(--foreground);fill-opacity:0.55" }, svg);
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(420), f.sy(Math.min(32000, H0 * 420))]], "stroke:var(--brand);stroke-width:2");
    const v = H0 * d;
    el("line", { x1: f.sx(d), x2: f.sx(d), y1: f.sy(v), y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(d), cy: f.sy(Math.min(32000, v)), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.L + 6, f.T + 12, "synthetic galaxies (true H₀ = 70)", { class: "fill-muted-foreground font-mono text-[10px]" });

    // Spectrum strip 380–780 nm with the rest and observed Hα lines.
    spec.replaceChildren();
    const x = (nm) => 40 + ((nm - 380) / 400) * 560;
    for (let nm = 380; nm < 780; nm += 2) el("rect", { x: x(nm), y: 10, width: 560 / 200 + 0.5, height: 26, style: `fill:${waveColor(nm)}` }, spec);
    const z = v / C_KMS, obs = HA * (1 + z);
    el("line", { x1: x(HA), x2: x(HA), y1: 6, y2: 40, style: "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:3 2" }, spec);
    text(spec, x(HA), 54, "rest 656.3", { "text-anchor": "middle" });
    if (obs <= 780) {
      el("line", { x1: x(obs), x2: x(obs), y1: 6, y2: 40, style: "stroke:var(--background);stroke-width:3" }, spec);
      el("line", { x1: x(obs), x2: x(obs), y1: 6, y2: 40, style: "stroke:var(--foreground);stroke-width:1.5" }, spec);
      text(spec, x(obs), 66, `observed ${num(obs, 1)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    } else text(spec, 600, 66, `observed ${num(obs, 1)} nm (infrared →)`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });

    o.v.textContent = `${fmtInt(v)} km/s`;
    o.z.textContent = num(z, 4);
    o.lambda.textContent = `${num(obs, 1)} nm`;
    o.age.textContent = `${num(977.8 / H0, 1)} Gyr`;
  }
  draw();
}
