// Space systems blocks, part 1: orbital elements, ground tracks, passes,
// link budget and power budget. Each block's root carries a data-spc-*
// attribute; the module does nothing on pages without them. The CubeSat
// figure (../anatomy/space-cubesat.js) mounts itself.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import {
  MU, RE, DEG, OMEGA_E, outs, onSeg, onToggle, minutes, svgPoint, player,
  period, nodeRate, latRate, ssoInclination, circPos, toEcef, latLon, wrapLon, dot, norm, sub, worldMap, eclipseFraction,
} from "./space-util.js";
import "../anatomy/space-cubesat.js";

const BRAND = "var(--brand)";

// ============================================================ elements

const ELEMENT_PRESETS = {
  iss: { a: 6798, e: 0.0005, i: 51.6, raan: 40, argp: 90, nu: 30 },
  molniya: { a: 26600, e: 0.74, i: 63.4, raan: 60, argp: 270, nu: 0 },
  gto: { a: 24396, e: 0.7283, i: 27, raan: 0, argp: 180, nu: 20 },
  sso: { a: 7078, e: 0.001, i: 98.2, raan: 100, argp: 90, nu: 60 },
};

for (const root of document.querySelectorAll("[data-spc-elements]")) {
  const svg = root.querySelector("[data-view]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let az = -35 * DEG, elv = 22 * DEG;

  onSeg(root, (_, v) => {
    const p = ELEMENT_PRESETS[v];
    for (const k in p) s[k].set(p[k], false);
    draw();
  });

  // Inertial frame, z to the north pole, x to the vernal equinox; an
  // orthographic camera at azimuth az, elevation elv.
  const cam = (p, sc) => {
    const x1 = p[0] * Math.cos(-az) - p[1] * Math.sin(-az);
    const y1 = p[0] * Math.sin(-az) + p[1] * Math.cos(-az);
    const z1 = p[2];
    return { X: 280 + x1 * sc, Y: 220 - (y1 * Math.sin(elv) + z1 * Math.cos(elv)) * sc, d: -y1 * Math.cos(elv) + z1 * Math.sin(elv) };
  };
  const posAt = (a, e, i, raan, argp, nu) => {
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
    const cO = Math.cos(raan), sO = Math.sin(raan), cw = Math.cos(argp), sw = Math.sin(argp), ci = Math.cos(i), si = Math.sin(i);
    return [
      (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
      (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
      sw * si * xp + cw * si * yp,
    ];
  };

  function draw() {
    const a = s.a.get(), e = Math.min(s.e.get(), 0.95), i = s.i.get() * DEG, raan = s.raan.get() * DEG, argp = s.argp.get() * DEG, nu = s.nu.get() * DEG;
    const ra = a * (1 + e), rp = a * (1 - e);
    const sc = 190 / Math.max(ra, RE * 1.6);
    svg.replaceChildren();
    const R = RE * sc;
    const hidden = (q) => q.d < 0 && Math.hypot(q.X - 280, q.Y - 220) < R;
    // Equatorial plane: a faint disc out to the apogee, then the Earth.
    const eq = [];
    for (let t = 0; t <= 360; t += 4) eq.push(cam([ra * 1.08 * Math.cos(t * DEG), ra * 1.08 * Math.sin(t * DEG), 0], sc));
    el("path", { d: "M" + eq.map((q) => `${q.X.toFixed(1)} ${q.Y.toFixed(1)}`).join("L") + "Z", style: "fill:currentColor;fill-opacity:.035;stroke:currentColor;stroke-opacity:.12;stroke-dasharray:2 3" }, svg);
    // Orbit points behind the Earth first, then the Earth, then the rest.
    const pts = [];
    for (let t = 0; t <= 360; t += 1) {
      const p = posAt(a, e, i, raan, argp, t * DEG);
      pts.push({ ...cam(p, sc), z: p[2] });
    }
    const runs = (pick) => {
      const out = [];
      let cur = [];
      for (const q of pts) {
        if (pick(q)) cur.push([q.X, q.Y]);
        else { if (cur.length > 1) out.push(cur); cur = []; }
      }
      if (cur.length > 1) out.push(cur);
      return out;
    };
    const orbitStyle = (dash) => `stroke:var(--vec-u);stroke-width:1.6;${dash ? "stroke-dasharray:4 3;" : ""}`;
    for (const r of runs((q) => q.d < 0 && q.z < 0)) polyline(svg, r, orbitStyle(true));
    for (const r of runs((q) => q.d < 0 && q.z >= 0)) polyline(svg, r, orbitStyle(false));
    el("circle", { cx: 280, cy: 220, r: R, style: "fill:var(--background);stroke:currentColor;stroke-opacity:.45" }, svg);
    // Equator and the prime direction on the globe, front halves only.
    const eqLine = [];
    for (let t = 0; t <= 360; t += 3) eqLine.push(cam([RE * Math.cos(t * DEG), RE * Math.sin(t * DEG), 0], sc));
    let run = [];
    for (const q of eqLine) { if (q.d >= 0) run.push([q.X, q.Y]); else { if (run.length > 1) polyline(svg, run, "stroke:currentColor;stroke-opacity:.35"); run = []; } }
    if (run.length > 1) polyline(svg, run, "stroke:currentColor;stroke-opacity:.35");
    const pole = cam([0, 0, RE * 1.35], sc), c0 = cam([0, 0, RE], sc);
    el("line", { x1: c0.X, y1: c0.Y, x2: pole.X, y2: pole.Y, style: "stroke:currentColor;stroke-opacity:.5" }, svg);
    text(svg, pole.X + 4, pole.Y, "N");
    const vx = cam([ra * 1.08, 0, 0], sc);
    text(svg, vx.X + 4, vx.Y + 3, "♈ x");
    for (const r of runs((q) => q.d >= 0 && !hidden(q) && q.z < 0)) polyline(svg, r, orbitStyle(true));
    for (const r of runs((q) => q.d >= 0 && q.z >= 0)) polyline(svg, r, orbitStyle(false));
    // Line of nodes (centre to ascending node) and perigee line.
    const nodeNu = -argp;
    const an = cam(posAt(a, e, i, raan, argp, nodeNu), sc), cc = cam([0, 0, 0], sc);
    el("line", { x1: cc.X, y1: cc.Y, x2: an.X, y2: an.Y, style: "stroke:var(--vec-v);stroke-width:1.2;stroke-dasharray:3 2" }, svg);
    el("circle", { cx: an.X, cy: an.Y, r: 3, style: "fill:var(--vec-v)" }, svg);
    text(svg, an.X + 5, an.Y - 4, "☊ ascending node");
    if (e > 0.01) {
      const pe = cam(posAt(a, e, i, raan, argp, 0), sc);
      el("line", { x1: cc.X, y1: cc.Y, x2: pe.X, y2: pe.Y, style: "stroke:var(--vec-out);stroke-width:1.2" }, svg);
      text(svg, pe.X + 5, pe.Y + 10, "perigee");
    }
    const sat = cam(posAt(a, e, i, raan, argp, nu), sc);
    el("circle", { cx: sat.X, cy: sat.Y, r: 5, style: `fill:${BRAND};stroke:var(--background);stroke-width:1.5;opacity:${hidden(sat) ? 0.35 : 1}` }, svg);

    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    const v = Math.sqrt(MU * (2 / r - 1 / a));
    const gamma = Math.atan2(e * Math.sin(nu), 1 + e * Math.cos(nu));
    o.rp.textContent = rp - RE < 0 ? `${num(rp - RE, 0)} km: below the surface` : `${num(rp - RE, 0)} km`;
    o.ra.textContent = `${num(ra - RE, 0)} km`;
    o.period.textContent = minutes(period(a));
    o.alt.textContent = `${num(r - RE, 0)} km`;
    o.v.textContent = `${num(v, 3)} km/s`;
    o.gamma.textContent = `${num(gamma / DEG, 2)}°`;
  }

  let drag = null;
  svg.addEventListener("pointerdown", (ev) => { drag = { x: ev.clientX, y: ev.clientY, az, elv }; svg.setPointerCapture?.(ev.pointerId); });
  svg.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    az = drag.az - (ev.clientX - drag.x) * 0.01;
    elv = Math.max(-80 * DEG, Math.min(80 * DEG, drag.elv + (ev.clientY - drag.y) * 0.01));
    draw();
  });
  const end = () => { drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (ev) => {
    const step = 5 * DEG;
    if (ev.key === "ArrowLeft") az += step;
    else if (ev.key === "ArrowRight") az -= step;
    else if (ev.key === "ArrowUp") elv = Math.min(80 * DEG, elv + step);
    else if (ev.key === "ArrowDown") elv = Math.max(-80 * DEG, elv - step);
    else return;
    ev.preventDefault();
    draw();
  });
  draw();
}

// ============================================================ ground track

for (const root of document.querySelectorAll("[data-spc-track]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let j2 = true, tNow = 0;
  onToggle(root, "j2", (on) => { j2 = on; draw(); });
  root.querySelector('[data-action="sso"]').addEventListener("click", () => {
    const i = ssoInclination(RE + s.alt.get());
    if (Number.isFinite(i)) { s.inc.set(Math.round((i / DEG) * 100) / 100, false); if (!j2) root.querySelector('[data-toggle="j2"]')?.click(); draw(); }
  });
  player(root, (dt) => { tNow += dt * 300; draw(); }, "Fly");

  function track(a, inc, raan0, t) {
    const u = (j2 ? latRate(a, inc) : Math.sqrt(MU / a ** 3)) * t;
    const raan = raan0 + (j2 ? nodeRate(a, 0, inc) : 0) * t;
    return latLon(toEcef(circPos(a, u, raan, inc), t));
  }

  function draw() {
    const h = s.alt.get(), a = RE + h, inc = s.inc.get() * DEG, raan0 = s.raan.get() * DEG, n = Math.round(s.orbits.get());
    const T = period(a), Tn = (2 * Math.PI) / (j2 ? latRate(a, inc) : Math.sqrt(MU / a ** 3));
    const drift = j2 ? nodeRate(a, 0, inc) : 0;
    svg.replaceChildren();
    const m = worldMap(svg, [40, 20, 560, 280]);
    for (const lon of [-180, -90, 0, 90, 180]) text(svg, m.sx(lon), 314, `${lon}°`, { "text-anchor": "middle" });
    for (const lat of [-60, 0, 60]) text(svg, 34, m.sy(lat) + 3, `${lat}°`, { "text-anchor": "end" });
    const end = n * Tn;
    const step = Tn / 240;
    if (tNow > end) tNow = 0;
    for (let k = n - 1; k >= 0; k--) {
      const segs = [];
      let cur = [], prevLon = null;
      for (let t = k * Tn; t <= (k + 1) * Tn + 1e-6; t += step) {
        const [lat, lon] = track(a, inc, raan0, t);
        if (prevLon !== null && Math.abs(lon - prevLon) > Math.PI) { if (cur.length > 1) segs.push(cur); cur = []; }
        cur.push([m.sx(lon / DEG), m.sy(lat / DEG)]);
        prevLon = lon;
      }
      if (cur.length > 1) segs.push(cur);
      const style = k === 0 ? "stroke:var(--vec-u);stroke-width:1.8" : "stroke:currentColor;stroke-opacity:.38;stroke-width:1";
      for (const sg of segs) polyline(svg, sg, style);
    }
    // Ascending node of the first orbit and the satellite now.
    const [la0, lo0] = track(a, inc, raan0, 0);
    el("circle", { cx: m.sx(lo0 / DEG), cy: m.sy(la0 / DEG), r: 3, style: "fill:var(--vec-u)" }, svg);
    const [la, lo] = track(a, inc, raan0, tNow);
    el("circle", { cx: m.sx(lo / DEG), cy: m.sy(la / DEG), r: 5, style: `fill:${BRAND};stroke:var(--background);stroke-width:1.5` }, svg);

    // Westward shift between successive ascending nodes.
    const shift = ((OMEGA_E - drift) * Tn) / DEG;
    const sso = ssoInclination(a);
    o.period.textContent = minutes(T);
    o.rev.textContent = num(86400 / Tn, 2);
    o.shift.textContent = `${num(shift, 2)}° (${num(shift * 111.32, 0)} km at the equator)`;
    o.drift.textContent = j2 ? `${drift >= 0 ? "+" : ""}${num((drift / DEG) * 86400, 3)}°/day` : "0 (J2 off)";
    o.sso.textContent = Number.isFinite(sso) ? `${num(sso / DEG, 2)}°` : "not possible";
    // Repeat: D nodal days holding a whole number of orbits.
    const nodalDay = (2 * Math.PI) / (OMEGA_E - drift);
    const k = nodalDay / Tn;
    let rep = "none within 20 days";
    for (let D = 1; D <= 20; D++) {
      const N = D * k, miss = Math.abs(N - Math.round(N)) * shift;
      if (miss < 0.5) { rep = `${Math.round(N)} orbit${Math.round(N) > 1 ? "s" : ""} in ${D} day${D > 1 ? "s" : ""}${miss > 0.05 ? ` (off by ${num(miss * 111.32, 0)} km)` : ""}`; break; }
    }
    o.repeat.textContent = rep;
  }
  draw();
}

// ============================================================ passes

const STATIONS = { tls: 43.6, svalbard: 78.2, sgp: 1.35 };

for (const root of document.querySelectorAll("[data-spc-passes]")) {
  const elev = root.querySelector("[data-elev]");
  const sky = root.querySelector("[data-sky]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { s.lat.set(STATIONS[v], false); draw(); });

  function draw() {
    const phi = s.lat.get() * DEG, mask = s.mask.get(), h = s.alt.get(), inc = s.inc.get() * DEG, a = RE + h;
    const st = [RE * Math.cos(phi), 0, RE * Math.sin(phi)];
    const up = st.map((v) => v / RE);
    const east = [0, 1, 0], north = [-Math.sin(phi), 0, Math.cos(phi)];
    const DT = 10, N = 8640;
    const samples = [];
    const lr = latRate(a, inc), nr = nodeRate(a, 0, inc);
    for (let k = 0; k <= N; k++) {
      const t = k * DT;
      const p = toEcef(circPos(a, lr * t, nr * t, inc), t);
      const rho = sub(p, st), d = norm(rho);
      const e = Math.asin(dot(rho, up) / d) / DEG;
      const az = Math.atan2(dot(rho, east), dot(rho, north)) / DEG;
      samples.push({ t, e, az, d });
    }
    // Passes: runs above the mask.
    const passes = [];
    let cur = null;
    for (const q of samples) {
      if (q.e >= mask) { if (!cur) cur = []; cur.push(q); }
      else if (cur) { passes.push(cur); cur = null; }
    }
    if (cur) passes.push(cur);

    elev.replaceChildren();
    const f = frame(elev, { box: [40, 20, 400, 200], x: [0, 24], y: [0, 90], xticks: [0, 4, 8, 12, 16, 20, 24], yticks: [0, 30, 60, 90], yfmt: (v) => `${v}°`, xlabel: "hours", ylabel: "elevation" });
    for (const p of passes) {
      const x0 = f.sx(p[0].t / 3600), x1 = f.sx(p[p.length - 1].t / 3600);
      el("rect", { x: x0, y: f.T, width: Math.max(1.5, x1 - x0), height: f.H, style: `fill:${BRAND};fill-opacity:.14` }, elev);
    }
    hline(f.g, f, mask, "stroke:currentColor;stroke-opacity:.45;stroke-dasharray:4 3", `mask ${mask}°`);
    let run = [];
    for (const q of samples) {
      if (q.e > 0) run.push([f.sx(q.t / 3600), f.sy(q.e)]);
      else if (run.length) { if (run.length > 1) polyline(elev, run, "stroke:var(--vec-u);stroke-width:1.4"); else el("circle", { cx: run[0][0], cy: run[0][1], r: 1, style: "fill:var(--vec-u)" }, elev); run = []; }
    }
    if (run.length > 1) polyline(elev, run, "stroke:var(--vec-u);stroke-width:1.4");

    // Sky plot of the longest pass.
    sky.replaceChildren();
    const cx = 110, cy = 112, R = 92;
    for (const e of [0, 30, 60]) el("circle", { cx, cy, r: ((90 - e) / 90) * R, style: "fill:none;stroke:currentColor;stroke-opacity:.15" }, sky);
    el("circle", { cx, cy, r: ((90 - mask) / 90) * R, style: "fill:none;stroke:currentColor;stroke-opacity:.45;stroke-dasharray:4 3" }, sky);
    for (const [lbl, a0] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      text(sky, cx + (R + 9) * Math.sin(a0 * DEG), cy - (R + 9) * Math.cos(a0 * DEG) + 3, lbl, { "text-anchor": "middle" });
    }
    let longest = null;
    for (const p of passes) if (!longest || p.length > longest.length) longest = p;
    if (longest) {
      const pts = longest.map((q) => [cx + ((90 - q.e) / 90) * R * Math.sin(q.az * DEG), cy - ((90 - q.e) / 90) * R * Math.cos(q.az * DEG)]);
      polyline(sky, pts, `stroke:${BRAND};stroke-width:2`);
      el("circle", { cx: pts[0][0], cy: pts[0][1], r: 3, style: `fill:${BRAND}` }, sky);
      const peak = Math.max(...longest.map((q) => q.e));
      text(sky, cx, 236, `longest pass, peak ${num(peak, 0)}°`, { "text-anchor": "middle" });
    } else text(sky, cx, cy + 3, "no pass above the mask", { "text-anchor": "middle" });

    const durs = passes.map((p) => (p[p.length - 1].t - p[0].t + DT));
    const elr = mask * DEG;
    const lam = Math.PI / 2 - elr - Math.asin((RE * Math.cos(elr)) / a);
    const range = Math.sqrt(a * a - RE * RE * Math.cos(elr) ** 2) - RE * Math.sin(elr);
    o.n.textContent = String(passes.length);
    o.longest.textContent = durs.length ? minutes(Math.max(...durs)) : "—";
    o.total.textContent = durs.length ? minutes(durs.reduce((x, y) => x + y, 0)) : "0";
    o.foot.textContent = `${num(lam * RE, 0)} km (${num(lam / DEG, 1)}°)`;
    o.range.textContent = `${num(range, 0)} km`;
  }
  draw();
}

// ============================================================ link budget

const LINK_PRESETS = {
  uhf: { f: 0.437, p: 1, gt: 0, lt: 1, d: 2000, la: 2, gr: 14, ts: 500, r: 9.6, req: 9.6 },
  sband: { f: 2.2, p: 2, gt: 6, lt: 1, d: 2000, la: 2, gr: 35, ts: 250, r: 2000, req: 4 },
  ka: { f: 20, p: 50, gt: 43, lt: 1, d: 38000, la: 4, gr: 41.5, ts: 300, r: 50000, req: 3 },
};
const C = 299792458;
const fspl = (fGHz, dKm) => 20 * Math.log10((4 * Math.PI * dKm * 1e3) / (C / (fGHz * 1e9)));

for (const root of document.querySelectorAll("[data-spc-link]")) {
  const chart = root.querySelector("[data-chart]");
  const rate = root.querySelector("[data-rate]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { const p = LINK_PRESETS[v]; for (const k in p) s[k].set(p[k], false); draw(); });

  function draw() {
    const v = Object.fromEntries(Object.keys(LINK_PRESETS.uhf).map((k) => [k, s[k].get()]));
    const pdb = 10 * Math.log10(v.p);
    const L = fspl(v.f, v.d);
    const gt = v.gr - 10 * Math.log10(v.ts);
    const eirp = pdb + v.gt - v.lt;
    const cn0 = eirp - L - v.la + gt + 228.6;
    const rdb = 10 * Math.log10(v.r * 1000);
    const ebn0 = cn0 - rdb;
    const margin = ebn0 - v.req;
    const rows = [
      ["Tx power", pdb, "dBW"], ["Tx antenna", v.gt], ["line losses", -v.lt], ["path loss", -L], ["atmosphere, pointing", -v.la],
      ["Rx G/T", gt], ["−k (Boltzmann)", 228.6], ["= C/N0", null, cn0], ["data rate", -rdb], ["= Eb/N0", null, ebn0], ["required", -v.req], ["= margin", null, margin],
    ];
    let level = 0, lo = 0, hi = 0;
    const bars = rows.map(([name, dv, total]) => {
      if (dv === null) { const b = { name, total: true, from: 0, to: total }; lo = Math.min(lo, total); hi = Math.max(hi, total); return b; }
      const b = { name, from: level, to: level + dv, dv };
      level += dv;
      lo = Math.min(lo, b.from, b.to);
      hi = Math.max(hi, b.from, b.to);
      return b;
    });
    chart.replaceChildren();
    const step = 50;
    const f = frame(chart, { box: [150, 14, 470, 252], x: [Math.floor(lo / step) * step, Math.ceil(hi / step) * step], y: [0, rows.length], xticks: [...Array(Math.round((Math.ceil(hi / step) - Math.floor(lo / step))) + 1)].map((_, k) => Math.floor(lo / step) * step + k * step), xlabel: "dB" });
    bars.forEach((b, k) => {
      const y = f.T + (k / rows.length) * f.H + 3, hgt = f.H / rows.length - 6;
      const x0 = f.sx(Math.min(b.from, b.to)), x1 = f.sx(Math.max(b.from, b.to));
      const color = b.total ? (b.name === "= margin" ? (b.to >= 3 ? BRAND : "var(--code-del)") : "var(--muted-foreground)") : b.dv >= 0 ? "var(--code-add)" : "var(--code-del)";
      el("rect", { x: x0, y, width: Math.max(1, x1 - x0), height: hgt, rx: 2, style: `fill:${color};fill-opacity:${b.total ? 0.55 : 0.75}` }, chart);
      text(chart, 144, y + hgt / 2 + 3, b.name, { "text-anchor": "end", class: b.total ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
      const val = b.total ? b.to : b.dv;
      const right = x1 + 4 + 52 < f.L + f.W;
      text(chart, right ? x1 + 4 : x0 - 4, y + hgt / 2 + 3, `${val >= 0 ? "+" : ""}${num(val, 1)}`, { "text-anchor": right ? "start" : "end" });
    });
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.35" }, chart);

    // Margin against data rate, 100 bit/s to 1 Gbit/s.
    rate.replaceChildren();
    const mAt = (bps) => cn0 - 10 * Math.log10(bps) - v.req;
    const lo2 = Math.min(-20, mAt(1e9)), hi2 = Math.max(20, mAt(100));
    const g = frame(rate, { box: [50, 12, 560, 120], x: [2, 9], y: [Math.floor(lo2 / 10) * 10, Math.ceil(hi2 / 10) * 10], xticks: [2, 3, 4, 5, 6, 7, 8, 9], xfmt: (x) => ["100 b/s", "1 kb/s", "10 kb/s", "100 kb/s", "1 Mb/s", "10 Mb/s", "100 Mb/s", "1 Gb/s"][x - 2], yticks: [Math.floor(lo2 / 10) * 10, 0, Math.ceil(hi2 / 10) * 10], yfmt: (y) => `${y} dB`, ylabel: "margin" });
    hline(g.g, g, 3, "stroke:var(--brand);stroke-opacity:.6;stroke-dasharray:4 3", "3 dB");
    hline(g.g, g, 0, "stroke:currentColor;stroke-opacity:.3");
    polyline(rate, [[g.sx(2), g.sy(mAt(100))], [g.sx(9), g.sy(mAt(1e9))]], "stroke:var(--vec-u);stroke-width:1.6");
    const lr = Math.log10(v.r * 1000);
    if (lr >= 2 && lr <= 9) el("circle", { cx: g.sx(lr), cy: g.sy(margin), r: 4.5, style: `fill:${margin >= 3 ? BRAND : "var(--code-del)"}` }, rate);

    const rmax = 10 ** ((cn0 - v.req - 3) / 10);
    o.eirp.textContent = `${num(eirp, 1)} dBW`;
    o.fspl.textContent = `${num(L, 1)} dB`;
    o.gt.textContent = `${num(gt, 1)} dB/K`;
    o.cn0.textContent = `${num(cn0, 1)} dB·Hz`;
    o.ebn0.textContent = `${num(ebn0, 1)} dB`;
    o.margin.textContent = `${margin >= 0 ? "+" : ""}${num(margin, 1)} dB${margin < 0 ? ": link fails" : margin < 3 ? ": too thin" : ""}`;
    o.max.textContent = rmax >= 1e6 ? `${num(rmax / 1e6, 2)} Mb/s` : rmax >= 1e3 ? `${num(rmax / 1e3, 2)} kb/s` : `${num(rmax, 0)} b/s`;
  }
  draw();
}

// ============================================================ power budget

const S0 = 1361;
const niceTicks = (max) => {
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].find((st) => max / st <= 5) ?? 5000;
  return [...Array(Math.floor(max / step) + 1).keys()].map((k) => k * step);
};

for (const root of document.querySelectorAll("[data-spc-power]")) {
  const orbit = root.querySelector("[data-orbit]");
  const betaSvg = root.querySelector("[data-beta]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const h = s.alt.get(), beta = s.beta.get() * DEG, load = s.load.get();
    const eta = s.eff.get() / 100, years = s.years.get(), deg = s.deg.get() / 100, dod = s.dod.get() / 100;
    const T = period(RE + h), fe = eclipseFraction(h, beta);
    const Te = fe * T, Td = T - Te;
    const Psa = (load * Te / 0.65 + load * Td / 0.85) / Td;
    const Ld = (1 - deg) ** years;
    const area = Psa / (S0 * eta * 0.77 * Math.cos(23.5 * DEG) * Ld);
    const eDraw = (load * Te) / 0.9; // J taken from the battery in eclipse
    const capWh = eDraw / 3600 / dod;

    orbit.replaceChildren();
    const tm = T / 60;
    const pmax = Math.max(Psa, load) * 1.25;
    const f = frame(orbit, { box: [50, 18, 520, 200], x: [0, tm], y: [0, pmax], xticks: [0, 15, 30, 45, 60, 75, 90, 105, 120].filter((x) => x <= tm), yticks: niceTicks(pmax), xlabel: "minutes from dawn", ylabel: "W" });
    if (Te > 0) el("rect", { x: f.sx(Td / 60), y: f.T, width: f.sx(tm) - f.sx(Td / 60), height: f.H, style: "fill:currentColor;fill-opacity:.08" }, orbit);
    if (Te > 0) text(orbit, (f.sx(Td / 60) + f.sx(tm)) / 2, f.T + 12, "eclipse", { "text-anchor": "middle" });
    polyline(orbit, [[f.sx(0), f.sy(Psa)], [f.sx(Td / 60), f.sy(Psa)], [f.sx(Td / 60), f.sy(0)], [f.sx(tm), f.sy(0)]], "stroke:var(--code-add);stroke-width:1.8");
    hline(f.g, f, load, "stroke:var(--vec-u);stroke-width:1.6");
    // Battery: charged at a constant rate in sunlight, exactly refilled.
    const soc = [];
    const capJ = capWh * 3600;
    for (let k = 0; k <= 200; k++) {
      const t = (k / 200) * T;
      let E;
      if (t <= Td) E = capJ * (1 - dod) + (eDraw * t) / Math.max(Td, 1);
      else E = capJ - (eDraw * (t - Td)) / Math.max(Te, 1);
      soc.push([f.sx(t / 60), f.T + f.H - (E / capJ) * f.H]);
    }
    if (Te > 0) polyline(orbit, soc, `stroke:${BRAND};stroke-width:1.6;stroke-dasharray:5 3`);
    text(orbit, f.L + f.W + 6, f.T + 3, "100%", { "text-anchor": "start" });
    text(orbit, f.L + f.W + 6, f.T + f.H + 3, "0%", { "text-anchor": "start" });

    betaSvg.replaceChildren();
    const Tm = T / 60;
    const g = frame(betaSvg, { box: [50, 14, 520, 100], x: [0, 90], y: [0, 40], xticks: [0, 15, 30, 45, 60, 75, 90], yticks: [0, 20, 40], xfmt: (x) => `${x}°`, xlabel: "β angle", ylabel: "eclipse (min)" });
    const pts = [];
    for (let b = 0; b <= 90; b += 0.5) pts.push([g.sx(b), g.sy(Math.min(40, eclipseFraction(h, b * DEG) * Tm))]);
    polyline(betaSvg, pts, "stroke:currentColor;stroke-opacity:.6;stroke-width:1.4");
    el("circle", { cx: g.sx(beta / DEG), cy: g.sy(Math.min(40, fe * Tm)), r: 4, style: `fill:${BRAND}` }, betaSvg);
    const bstar = Math.asin(RE / (RE + h)) / DEG;
    el("line", { x1: g.sx(bstar), x2: g.sx(bstar), y1: g.T, y2: g.T + g.H, style: "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:3 3" }, betaSvg);
    text(betaSvg, g.sx(bstar) + 4, g.T + 10, `β* = ${num(bstar, 1)}°`);

    o.ecl.textContent = Te > 0 ? `${minutes(Te)} (${num(fe * 100, 1)}%)` : "none (β ≥ β*)";
    o.sun.textContent = minutes(Td);
    o.psa.textContent = `${num(Psa, 1)} W`;
    o.area.textContent = area < 1 ? `${num(area * 1e4, 0)} cm²` : `${num(area, 2)} m²`;
    o.batt.textContent = `${num(capWh, 1)} Wh`;
    o.soc.textContent = Te > 0 ? `${num(100 - dod * 100, 0)}% at the end of eclipse` : "stays full";
  }
  draw();
}
