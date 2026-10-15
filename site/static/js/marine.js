// Naval architecture blocks. Each block's root carries a data-marine-*
// attribute; the module does nothing on pages without them. Models:
// Archimedes with a block coefficient, exact GZ for a box section, the
// free-surface correction, a least-squares inclining test, the Froude
// number with bow–stern wave interference, ITTC-1957 friction, a linear
// open-water propeller, the apparent-wind triangle with sail lift and drag,
// and a synthetic sailing polar with VMG and a two-tack beat.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import "../anatomy/marine-incline.js";

const G = 9.81;
const KN = 0.514444; // m/s per knot
const RAD = Math.PI / 180;
const BRAND = "var(--brand)";
const WATER = "fill:var(--vec-u);fill-opacity:.12";
const BAD = "var(--code-del)";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const fx = (v, d = 1) => num(v, d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const grouped = (v, d = 0) => {
  const s = Math.abs(v).toFixed(d).split(".");
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (v < 0 ? "−" : "") + s.join(".");
};
const power = (w) => (Math.abs(w) >= 1e6 ? `${fx(w / 1e6, 2)} MW` : `${grouped(w / 1e3, 0)} kW`);
const force = (n) => (Math.abs(n) >= 1e6 ? `${fx(n / 1e6, 2)} MN` : Math.abs(n) >= 1e3 ? `${fx(n / 1e3, 1)} kN` : `${grouped(n, 0)} N`);
function arrow(g, x0, y0, x1, y1, color, width = 1.6, head = 6, dash = "") {
  el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style: `stroke:${color};stroke-width:${width};stroke-linecap:round${dash ? `;stroke-dasharray:${dash}` : ""}` }, g);
  if (Math.hypot(x1 - x0, y1 - y0) < 2) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  el("path", { d: `M${x1} ${y1}L${x1 - head * Math.cos(a - 0.42)} ${y1 - head * Math.sin(a - 0.42)}L${x1 - head * Math.cos(a + 0.42)} ${y1 - head * Math.sin(a + 0.42)}Z`, style: `fill:${color}` }, g);
}
const poly = (g, pts, style) => el("polygon", { points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), style }, g);
const dot = (g, x, y, r, color) => el("circle", { cx: x, cy: y, r, style: `fill:${color}` }, g);
const label = (g, x, y, s, anchor = "start", extra = {}) => text(g, x, y, s, { "text-anchor": anchor, ...extra });
// nice rounds a range out to steps of 1, 2 or 5 × 10ⁿ and lists the ticks.
function nice(lo, hi, count = 4) {
  const raw = (hi - lo) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { lo: a, hi: b, ticks, step };
}
const dec = (step) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

// ---------------------------------------------------------------- polygons

// clipBelow keeps the part of a convex polygon where n·p ≤ c.
function clipBelow(pts, n, c) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = n[0] * a[0] + n[1] * a[1] - c, db = n[0] * b[0] + n[1] * b[1] - c;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function areaCentroid(pts) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const cr = x0 * y1 - x1 * y0;
    A += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  }
  A /= 2;
  return Math.abs(A) < 1e-12 ? { A: 0, cx: 0, cy: 0 } : { A: Math.abs(A), cx: cx / (6 * A), cy: cy / (6 * A) };
}
// levelFor finds c so that the part of pts below n·p = c has the given area.
function levelFor(pts, n, area) {
  const hs = pts.map((p) => n[0] * p[0] + n[1] * p[1]);
  let lo = Math.min(...hs), hi = Math.max(...hs);
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (areaCentroid(clipBelow(pts, n, m)).A < area) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// ============================================================ displacement

for (const root of document.querySelectorAll("[data-marine-disp]")) {
  const hullSvg = root.querySelector("[data-hull]");
  const plotSvg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let rho = 1.025;
  onSeg(root, (lbl, v) => {
    if (lbl === "Hull form") s.cb.set(v === "box" ? 1 : 0.7, false);
    else rho = v === "salt" ? 1.025 : 1.0;
    draw();
  });

  function draw() {
    const L = s.len.get(), B = s.beam.get(), D = s.depth.get(), cb = s.cb.get(), disp = s.disp.get();
    const box = cb >= 0.995;
    const T = disp / (rho * L * B * cb);
    const cwp = box ? 1 : (1 + 2 * cb) / 3;
    const tpc = (rho * cwp * L * B) / 100;
    const tpcSalt = (1.025 * cwp * L * B) / 100;
    const fwa = disp / (4 * tpcSalt);
    const sinks = T > D;
    o.t.textContent = `${fx(T, 3)} m`;
    o.fb.textContent = sinks ? "none" : `${fx(D - T, 3)} m`;
    o.rb.textContent = sinks || T <= 0 ? "—" : `${grouped(((D - T) / T) * 100, 0)} %`;
    o.tpc.textContent = `${fx(tpc, 2)} t/cm`;
    o.fwa.textContent = `${fx(fwa, 0)} mm`;
    o.status.textContent = sinks ? "sinks: the draft exceeds the depth" : D - T < 0.1 * D ? "afloat, very little freeboard" : "afloat";
    o.status.style.color = sinks ? BAD : "";

    // Profile (left) and midship section (right), keel on one baseline.
    hullSvg.replaceChildren();
    const base = 150;
    const sp = Math.min(300 / L, 120 / D), sc = Math.min(150 / B, 120 / D);
    const px0 = 36, sx0 = 520;
    const water = (x0, x1, y) => el("rect", { x: x0, y, width: x1 - x0, height: 170 - y, style: WATER }, hullSvg);
    // Profile.
    const pw = L * sp, ph = D * sp, pwl = base - Math.min(T, D * 1.25) * sp;
    water(px0 - 20, px0 + pw + 20, pwl);
    const prof = box
      ? [[px0, base], [px0 + pw, base], [px0 + pw, base - ph], [px0, base - ph]]
      : [[px0 + 0.07 * pw, base], [px0 + 0.86 * pw, base], [px0 + pw, base - ph], [px0, base - ph], [px0, base - 0.62 * ph], [px0 + 0.03 * pw, base - 0.3 * ph]];
    poly(hullSvg, prof, `fill:var(--background);stroke:${sinks ? BAD : "currentColor"};stroke-width:1.2`);
    const subP = clipBelow(prof, [0, -1], -pwl);
    if (subP.length > 2) poly(hullSvg, subP, WATER);
    el("line", { x1: px0 - 20, x2: px0 + pw + 20, y1: pwl, y2: pwl, style: "stroke:var(--vec-u);stroke-width:1.2" }, hullSvg);
    label(hullSvg, px0 - 18, pwl - 5, "WL");
    label(hullSvg, px0 + pw / 2, 166, `L = ${fx(L, 1)} m · profile`, "middle");
    // Section.
    const sw = B * sc, sh = D * sc, swl = base - Math.min(T, D * 1.25) * sc;
    water(sx0 - sw / 2 - 20, sx0 + sw / 2 + 20, swl);
    const r = box ? 0 : Math.min(sw / 2, sh) * clamp((1 - cb) * 1.6, 0, 0.9);
    const sec = [];
    sec.push([sx0 - sw / 2, base - sh], [sx0 - sw / 2, base - r]);
    for (let i = 1; i < 8 && r > 0; i++) { const a = Math.PI + (i / 8) * (Math.PI / 2); sec.push([sx0 - sw / 2 + r + r * Math.cos(a), base - r - r * Math.sin(a)]); }
    sec.push([sx0 - sw / 2 + r, base], [sx0 + sw / 2 - r, base]);
    for (let i = 1; i < 8 && r > 0; i++) { const a = 1.5 * Math.PI + (i / 8) * (Math.PI / 2); sec.push([sx0 + sw / 2 - r + r * Math.cos(a), base - r - r * Math.sin(a)]); }
    sec.push([sx0 + sw / 2, base - r], [sx0 + sw / 2, base - sh]);
    poly(hullSvg, sec, `fill:var(--background);stroke:${sinks ? BAD : "currentColor"};stroke-width:1.2`);
    const subS = clipBelow(sec, [0, -1], -swl);
    if (subS.length > 2) poly(hullSvg, subS, WATER);
    el("line", { x1: sx0 - sw / 2 - 20, x2: sx0 + sw / 2 + 20, y1: swl, y2: swl, style: "stroke:var(--vec-u);stroke-width:1.2" }, hullSvg);
    // Draft and freeboard dimensions beside the section.
    const dx = sx0 - sw / 2 - 12;
    if (base - swl > 10) { arrow(hullSvg, dx, swl, dx, base, "currentColor", 1, 4); arrow(hullSvg, dx, base, dx, swl, "currentColor", 1, 4); }
    label(hullSvg, dx - 5, (swl + base) / 2 + 3, `T ${fx(T, 2)} m`, "end");
    if (!sinks) label(hullSvg, dx - 5, (swl + base - sh) / 2 + 3, `f ${fx(D - T, 2)} m`, "end");
    label(hullSvg, sx0, 166, `B = ${fx(B, 1)} m · midship section`, "middle");
    label(hullSvg, sx0, 14, `C_B ${fx(cb, 2)} · ρ ${fx(rho, 3)} t/m³`, "middle");

    // Draft against displacement, sea and fresh water, to the deck.
    plotSvg.replaceChildren();
    const full = 1.025 * L * B * D * cb;
    const f = frame(plotSvg, {
      box: [56, 18, 560, 140], x: [0, full * 1.1], y: [0, D * 1.15],
      xticks: nice(0, full * 1.1, 5).ticks.filter((v) => v <= full * 1.1), yticks: nice(0, D, 2).ticks.filter((v) => v <= D * 1.15),
      xfmt: (v) => grouped(v, v && v < 10 ? 1 : 0), yfmt: (v) => fx(v, 2), xlabel: "displacement Δ (t)", ylabel: "draft (m)",
    });
    hline(f.g, f, D, "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:4 3");
    label(f.g, f.L + 4, f.sy(D) - 4, "deck (depth D)");
    for (const [r2, color] of [[1.025, "var(--vec-u)"], [1.0, "var(--vec-out)"]]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const d = (i / 40) * full * 1.1; pts.push([f.sx(d), f.sy(Math.min(D * 1.15, d / (r2 * L * B * cb)))]); }
      polyline(f.g, pts, `stroke:${color};stroke-width:1.4`);
    }
    label(f.g, f.sx(full * 0.5) + 6, f.sy((full * 0.5) / (1.025 * L * B * cb)) + 14, "sea water");
    label(f.g, f.sx(full * 0.4) - 6, f.sy((full * 0.4) / (L * B * cb)) - 8, "fresh water", "end");
    if (disp <= full * 1.1) dot(f.g, f.sx(disp), f.sy(Math.min(D * 1.15, T)), 4, BRAND);
  }
  draw();
}

// ============================================================ GZ curve

function boxStability(B, D, T, KG, phi) {
  const rect = [[-B / 2, 0], [B / 2, 0], [B / 2, D], [-B / 2, D]];
  const up = [-Math.sin(phi), Math.cos(phi)];
  const c = levelFor(rect, up, B * T);
  const sub = clipBelow(rect, up, c);
  const { cx, cy } = areaCentroid(sub);
  const hd = [Math.cos(phi), Math.sin(phi)];
  const gz = cx * hd[0] + (cy - KG) * hd[1];
  const deckUnder = -(B / 2) * Math.sin(phi) + D * Math.cos(phi) <= c + 1e-9;
  const bilgeOut = (B / 2) * Math.sin(phi) >= c - 1e-9;
  return { gz, sub, c, cx, cy, up, hd, deckUnder, bilgeOut, rect };
}

for (const root of document.querySelectorAll("[data-marine-gz]")) {
  const secSvg = root.querySelector("[data-section]");
  const plotSvg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const B = s.beam.get(), D = s.depth.get(), T = Math.min(s.draft.get(), D - 0.05), KG = s.kg.get(), heel = s.heel.get();
    const KB = T / 2, BM = (B * B) / (12 * T), GM = KB + BM - KG;
    const curve = [];
    for (let a = 0; a <= 90.0001; a += 0.5) curve.push([a, boxStability(B, D, T, KG, a * RAD).gz]);
    // Maximum, vanishing angle, deck-edge immersion.
    let max = curve[0], vanish = null, deck = null;
    for (const p of curve) if (p[1] > max[1]) max = p;
    for (let i = 2; i < curve.length; i++) if (curve[i - 1][1] > 0 && curve[i][1] <= 0) { const [a0, g0] = curve[i - 1], [a1, g1] = curve[i]; vanish = a0 + ((a1 - a0) * g0) / (g0 - g1); break; }
    for (let a = 0; a <= 90; a += 0.25) if (boxStability(B, D, T, KG, a * RAD).deckUnder) { deck = a; break; }
    const area = (to) => { let A = 0; for (let i = 1; i < curve.length && curve[i][0] <= to + 1e-9; i++) A += ((curve[i][1] + curve[i - 1][1]) / 2) * 0.5 * RAD; return A; };
    const a30 = area(30), a40 = area(40);
    const gzAt30plus = Math.max(...curve.filter((p) => p[0] >= 30).map((p) => p[1]));
    const now = boxStability(B, D, T, KG, heel * RAD);

    o.gm.textContent = `${fx(GM, 3)} m`;
    o.gm.style.color = GM <= 0 ? BAD : "";
    o.gz.textContent = `${fx(now.gz, 3)} m at ${fx(heel, 0)}°`;
    o.max.textContent = max[1] > 0 ? `${fx(max[1], 3)} m at ${fx(max[0], 1)}°` : "none: unstable";
    o.vanish.textContent = vanish !== null ? `${fx(vanish, 1)}°` : max[1] > 0 ? "beyond 90°" : "—";
    o.deck.textContent = deck !== null ? `${fx(deck, 1)}°` : "not before 90°";
    o.a30.textContent = `${fx(a30, 3)} m·rad`;
    o.a40.textContent = `${fx(a40, 3)} m·rad`;
    const crit = [
      ["area 0–30° ≥ 0.055", a30 >= 0.055],
      ["area 0–40° ≥ 0.090", a40 >= 0.09],
      ["area 30–40° ≥ 0.030", a40 - a30 >= 0.03],
      ["GZ ≥ 0.20 m at ≥ 30°", gzAt30plus >= 0.2],
      ["max GZ at ≥ 25°", max[0] >= 25 && max[1] > 0],
      ["GM₀ ≥ 0.15 m", GM >= 0.15],
    ];
    o.criteria.replaceChildren(...crit.map(([t, ok]) => {
      const li = document.createElement("li");
      li.textContent = `${ok ? "✓" : "✗"} ${t}`;
      li.style.color = ok ? BRAND : BAD;
      return li;
    }));

    // GZ curve with the wall-sided formula and the GM tangent.
    plotSvg.replaceChildren();
    const lo = Math.min(0, ...curve.map((p) => p[1])), hi = Math.max(0.05, max[1], GM > 0 ? Math.min(GM, max[1] * 2.5 + 0.1) : 0);
    const ny = nice(lo, hi * 1.1, 5);
    const yr = [ny.lo, ny.hi];
    const f = frame(plotSvg, {
      box: [48, 22, 312, 220], x: [0, 90], y: yr,
      xticks: [0, 15, 30, 45, 60, 75, 90], yticks: ny.ticks,
      xfmt: (v) => `${v}°`, yfmt: (v) => fx(v, dec(ny.step)), xlabel: "heel φ", ylabel: "GZ (m)",
    });
    hline(f.g, f, 0, "stroke:currentColor;stroke-opacity:.3");
    const inY = (v) => v >= yr[0] && v <= yr[1];
    const ws = [];
    for (let a = 0; a < 89; a += 0.5) { const p = a * RAD, v = Math.sin(p) * (GM + 0.5 * BM * Math.tan(p) ** 2); if (!inY(v)) break; ws.push([f.sx(a), f.sy(v)]); }
    polyline(f.g, ws, "stroke:var(--vec-out);stroke-width:1.2;stroke-dasharray:5 3");
    if (GM > 0) {
      const aEnd = Math.min(57.3, ((yr[1] / GM) * 57.3));
      el("line", { x1: f.sx(0), y1: f.sy(0), x2: f.sx(aEnd), y2: f.sy((GM * aEnd) / 57.3), style: `stroke:${BRAND};stroke-width:1;stroke-dasharray:2 3` }, f.g);
      if (aEnd >= 57.2) { el("line", { x1: f.sx(57.3), x2: f.sx(57.3), y1: f.sy(0), y2: f.sy(GM), style: `stroke:${BRAND};stroke-opacity:.6` }, f.g); label(f.g, f.sx(57.3) + 4, f.sy(GM) + 12, "GM at 1 rad"); }
    }
    polyline(f.g, curve.map(([a, g]) => [f.sx(a), f.sy(g)]), "stroke:var(--vec-u);stroke-width:1.8");
    if (deck !== null) { el("line", { x1: f.sx(deck), x2: f.sx(deck), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:3 3" }, f.g); label(f.g, f.sx(deck) + 3, f.T + 10, "deck edge under"); }
    if (vanish !== null) dot(f.g, f.sx(vanish), f.sy(0), 3, BAD);
    el("line", { x1: f.sx(heel), x2: f.sx(heel), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.45" }, f.g);
    dot(f.g, f.sx(heel), f.sy(now.gz), 4, BRAND);

    // Section, drawn with the waterline level.
    secSvg.replaceChildren();
    const sc = 200 / Math.hypot(B, D);
    const W = (p) => [140 + (p[0] * now.hd[0] + p[1] * now.hd[1]) * sc, 150 - (p[0] * now.up[0] + p[1] * now.up[1] - now.c) * sc];
    el("rect", { x: 0, y: 150, width: 280, height: 130, style: WATER }, secSvg);
    poly(secSvg, now.rect.map(W), "fill:var(--background);stroke:currentColor;stroke-width:1.2");
    poly(secSvg, now.sub.map(W), WATER);
    el("line", { x1: 0, x2: 280, y1: 150, y2: 150, style: "stroke:var(--vec-u);stroke-width:1.2" }, secSvg);
    const Gp = W([0, KG]), Bp = W([now.cx, now.cy]), K = W([0, 0]), M = W([0, KB + BM]);
    el("line", { x1: K[0], y1: K[1], x2: W([0, D])[0], y2: W([0, D])[1], style: "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:3 3" }, secSvg);
    arrow(secSvg, Bp[0], Bp[1] + 34, Bp[0], Bp[1] - 26, "var(--vec-u)", 1.4, 5);
    arrow(secSvg, Gp[0], Gp[1], Gp[0], Gp[1] + 40, "currentColor", 1.4, 5);
    const Z = [Bp[0], Gp[1]];
    el("line", { x1: Bp[0], y1: Math.min(Bp[1], Gp[1]) - 30, x2: Bp[0], y2: Math.max(Bp[1], Gp[1]) + 8, style: "stroke:var(--vec-u);stroke-opacity:.5;stroke-dasharray:2 3" }, secSvg);
    el("line", { x1: Gp[0], y1: Gp[1], x2: Z[0], y2: Z[1], style: `stroke:${now.gz >= 0 ? BRAND : BAD};stroke-width:2.4;stroke-linecap:round` }, secSvg);
    dot(secSvg, Gp[0], Gp[1], 3.5, "currentColor");
    dot(secSvg, Bp[0], Bp[1], 3.5, "var(--vec-u)");
    dot(secSvg, Z[0], Z[1], 2.5, now.gz >= 0 ? BRAND : BAD);
    label(secSvg, Gp[0] - 8, Gp[1] - 4, "G", "end");
    label(secSvg, Bp[0] + 6, Bp[1] + 12, "B");
    label(secSvg, Z[0] + 6, Z[1] - 4, "Z");
    label(secSvg, K[0] - 6, K[1] + 4, "K", "end");
    if (M[1] > 6 && M[1] < 274 && heel <= 15) { dot(secSvg, M[0], M[1], 2.5, "var(--vec-out)"); label(secSvg, M[0] + 6, M[1] + 3, "M"); }
    label(secSvg, 6, 14, `GZ ${fx(now.gz, 3)} m at ${fx(heel, 0)}°`);
    if (now.gz < 0) label(secSvg, 6, 28, "capsizing lever", "start", { style: `fill:${BAD}` });
  }
  draw();
}

// ============================================================ free surface

for (const root of document.querySelectorAll("[data-marine-fs]")) {
  const secSvg = root.querySelector("[data-section]");
  const barSvg = root.querySelector("[data-bars]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let rhoT = 0.85, n = 1;
  onSeg(root, (lbl, v) => {
    if (lbl === "Liquid") rhoT = { fuel: 0.85, sea: 1.025, fresh: 1.0 }[v];
    else n = Number(v);
    draw();
  });

  function draw() {
    const disp = s.disp.get(), KM = s.km.get(), KG = s.kg.get(), l = s.tl.get(), b = s.tb.get(), heel = s.heel.get() * RAD;
    const fsmOf = (k) => (rhoT * l * b ** 3) / (12 * k * k);
    const fsm = fsmOf(n), fsc = fsm / disp, gms = KM - KG, gmf = gms - fsc;
    o.fsm.textContent = `${grouped(fsm, 0)} t·m`;
    o.fsc.textContent = `${fx(fsc, 3)} m`;
    o.gms.textContent = `${fx(gms, 3)} m`;
    o.gmf.textContent = `${fx(gmf, 3)} m`;
    o.gmf.style.color = gmf <= 0 ? BAD : "";
    o.lost.textContent = gms > 0 ? `${fx((fsc / gms) * 100, 1)} %` : "—";

    // Schematic section: hull depth from KM, a double-bottom tank b wide.
    secSvg.replaceChildren();
    const Dh = KM * 1.3, Bh = Math.max(b + 4, Dh * 1.5);
    const up = [-Math.sin(heel), Math.cos(heel)], hd = [Math.cos(heel), Math.sin(heel)];
    const hull = [[-Bh / 2, 0], [Bh / 2, 0], [Bh / 2, Dh], [-Bh / 2, Dh]];
    const draftH = Dh * 0.45;
    const c = levelFor(hull, up, Bh * draftH);
    // Fit the heeled hull into the frame with the sea surface level.
    const wx = hull.map((p) => p[0] * hd[0] + p[1] * hd[1]), wy = hull.map((p) => p[0] * up[0] + p[1] * up[1] - c);
    const sc = Math.min(320 / (Math.max(...wx) - Math.min(...wx)), 220 / (Math.max(...wy) - Math.min(...wy)));
    const ox = 180 - ((Math.max(...wx) + Math.min(...wx)) / 2) * sc, sea = 36 + Math.max(...wy) * sc;
    const W = (p) => [ox + (p[0] * hd[0] + p[1] * hd[1]) * sc, sea - (p[0] * up[0] + p[1] * up[1] - c) * sc];
    el("rect", { x: 0, y: sea, width: 360, height: 280 - sea, style: WATER }, secSvg);
    poly(secSvg, hull.map(W), "fill:var(--background);stroke:currentColor;stroke-width:1.2");
    const tankH = Dh * 0.16, z0 = Dh * 0.03;
    for (let i = 0; i < n; i++) {
      const x0 = -b / 2 + (i * b) / n, x1 = x0 + b / n;
      const comp = [[x0, z0], [x1, z0], [x1, z0 + tankH], [x0, z0 + tankH]];
      const liquid = clipBelow(comp, up, levelFor(comp, up, (x1 - x0) * tankH * 0.5));
      poly(secSvg, liquid.map(W), "fill:var(--vec-out);fill-opacity:.35");
      poly(secSvg, comp.map(W), "fill:none;stroke:currentColor;stroke-opacity:.7;stroke-width:1");
    }
    el("line", { x1: 0, x2: 360, y1: sea, y2: sea, style: "stroke:var(--vec-u);stroke-width:1.2" }, secSvg);
    const Gs = W([0, KG]), Gv = W([0, KG + fsc]), M = W([0, KM]), K = W([0, 0]);
    el("line", { x1: K[0], y1: K[1], x2: W([0, Dh])[0], y2: W([0, Dh])[1], style: "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:3 3" }, secSvg);
    dot(secSvg, Gs[0], Gs[1], 3.5, "currentColor");
    label(secSvg, Gs[0] + 7, Gs[1] + 4, "G (solid)");
    dot(secSvg, Gv[0], Gv[1], 3.5, BRAND);
    label(secSvg, Gv[0] - 7, Gv[1] + 2, "G′ (fluid)", "end");
    dot(secSvg, M[0], M[1], 3, "var(--vec-u)");
    label(secSvg, M[0] + 7, M[1] + 3, "M");
    label(secSvg, 8, 14, `virtual rise ${fx(fsc, 3)} m · ${n} compartment${n > 1 ? "s" : ""}`);

    // GM for 1 to 4 compartments.
    barSvg.replaceChildren();
    const vals = [1, 2, 3, 4].map((k) => gms - fsmOf(k) / disp);
    const nb = nice(Math.min(0, ...vals), Math.max(gms, 0.05) * 1.1, 4);
    const f = frame(barSvg, { box: [44, 26, 180, 210], x: [0.5, 4.5], y: [nb.lo, nb.hi], xticks: [], yticks: nb.ticks, yfmt: (v) => fx(v, dec(nb.step)), ylabel: "GM (m)" });
    hline(f.g, f, gms, "stroke:currentColor;stroke-opacity:.45;stroke-dasharray:4 3", "solid GM");
    vals.forEach((v, i) => {
      const x = f.sx(i + 1);
      const y0 = f.sy(0), y1 = f.sy(v);
      el("rect", { x: x - 14, y: Math.min(y0, y1), width: 28, height: Math.abs(y1 - y0), style: `fill:${v <= 0 ? BAD : i + 1 === n ? BRAND : "var(--vec-u)"};fill-opacity:${i + 1 === n ? 0.9 : 0.4}` }, f.g);
      label(f.g, x, f.T + f.H + 14, `${i + 1}`, "middle");
    });
    label(f.g, f.L + f.W, f.T + f.H + 27, "compartments", "end");
  }
  draw();
}

// ============================================================ inclining test

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

for (const root of document.querySelectorAll("[data-marine-incl]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const SHIP = { disp: 6000, w: 15, l: 8 };
  let seed = 7, r, ship, readings, pos = 0, revealed = false;
  function newShip() {
    r = rng(seed++);
    ship = { km: 8.0 + r() * 0.5, kg: 6.9 + r() * 0.7 };
    readings = [];
    revealed = false;
    for (const d of [0, 12, -12, 6]) take(d);
  }
  function take(d) {
    const gm = ship.km - ship.kg;
    const tan = (SHIP.w * d) / (SHIP.disp * gm);
    readings.push({ m: SHIP.w * d, y: SHIP.l * 1000 * tan + 1.5 * gauss(r) });
  }
  onSeg(root, (_, v) => { pos = Number(v); });
  root.querySelector('[data-action="read"]').addEventListener("click", () => { take(pos); draw(); });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { readings = []; draw(); });
  root.querySelector('[data-action="reveal"]').addEventListener("click", () => { revealed = true; draw(); });
  root.querySelector('[data-action="ship"]').addEventListener("click", () => { newShip(); draw(); });

  function fit() {
    const n = readings.length;
    if (n < 2) return null;
    const mx = readings.reduce((a, p) => a + p.m, 0) / n, my = readings.reduce((a, p) => a + p.y, 0) / n;
    let sxx = 0, sxy = 0;
    for (const p of readings) { sxx += (p.m - mx) ** 2; sxy += (p.m - mx) * (p.y - my); }
    if (sxx < 1e-9) return null;
    const b = sxy / sxx, a = my - b * mx;
    let sse = 0;
    for (const p of readings) sse += (p.y - a - b * p.m) ** 2;
    const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : NaN;
    return { a, b, se };
  }
  function draw() {
    const ft = fit();
    const gmTrue = ship.km - ship.kg;
    svg.replaceChildren();
    const mMax = SHIP.w * 12 * 1.15;
    const ny = nice(0, Math.max(10, ...readings.map((p) => Math.abs(p.y)), (SHIP.l * 1000 * SHIP.w * 12) / (SHIP.disp * gmTrue)) * 1.1, 3);
    const yMax = ny.hi;
    const f = frame(svg, {
      box: [64, 24, 540, 260], x: [-mMax, mMax], y: [-yMax, yMax],
      xticks: [-180, -90, 0, 90, 180], yticks: [...ny.ticks.slice(1).map((v) => -v).reverse(), ...ny.ticks],
      xfmt: (v) => grouped(v, 0), yfmt: (v) => grouped(v, 0), xlabel: "heeling moment w·d (t·m)", ylabel: "pendulum deflection (mm)",
    });
    hline(f.g, f, 0, "stroke:currentColor;stroke-opacity:.3");
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.3" }, f.g);
    if (ft) polyline(f.g, [[f.sx(-mMax), f.sy(ft.a - ft.b * mMax)], [f.sx(mMax), f.sy(ft.a + ft.b * mMax)]], `stroke:${BRAND};stroke-width:1.4`);
    if (revealed) {
      const bt = (SHIP.l * 1000) / (SHIP.disp * gmTrue);
      polyline(f.g, [[f.sx(-mMax), f.sy(-bt * mMax)], [f.sx(mMax), f.sy(bt * mMax)]], "stroke:currentColor;stroke-opacity:.45;stroke-dasharray:4 3");
      label(f.g, f.sx(mMax) - 4, f.sy(bt * mMax) + 14, "true line", "end");
    }
    readings.forEach((p, i) => {
      dot(f.g, f.sx(p.m), f.sy(p.y), 4, "var(--vec-u)");
      if (i === readings.length - 1) el("circle", { cx: f.sx(p.m), cy: f.sy(p.y), r: 7, style: `fill:none;stroke:${BRAND};stroke-width:1.2` }, f.g);
    });
    o.n.textContent = String(readings.length);
    o.km.textContent = `${fx(ship.km, 3)} m`;
    o.true.textContent = revealed ? `${fx(ship.kg, 3)} m (GM ${fx(gmTrue, 3)} m)` : "hidden";
    if (ft && ft.b > 0) {
      const gm = (SHIP.l * 1000) / (SHIP.disp * ft.b);
      const err = Number.isFinite(ft.se) ? gm * (ft.se / ft.b) : NaN;
      o.slope.textContent = `${fx(ft.b, 4)} mm per t·m`;
      o.gm.textContent = Number.isFinite(err) ? `${fx(gm, 3)} ± ${fx(err, 3)} m` : `${fx(gm, 3)} m`;
      o.kg.textContent = `${fx(ship.km - gm, 3)} m`;
    } else {
      o.slope.textContent = "need two positions";
      o.gm.textContent = o.kg.textContent = "—";
    }
  }
  newShip();
  draw();
}

// ============================================================ hull speed

for (const root of document.querySelectorAll("[data-marine-speed]")) {
  const waves = root.querySelector("[data-waves]");
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const L = s.lwl.get(), kn = s.speed.get();
    const V = kn * KN, ft = L / 0.3048;
    const hull = 1.34 * Math.sqrt(ft);
    const Fn = V / Math.sqrt(G * L);
    const lambda = (2 * Math.PI * V * V) / G;
    o.ft.textContent = `${fx(L, 2)} m = ${fx(ft, 1)} ft`;
    o.hull.textContent = `${fx(hull, 2)} kn`;
    o.fn.textContent = fx(Fn, 3);
    o.lambda.textContent = `${fx(lambda, 2)} m`;
    o.per.textContent = fx(L / lambda, 2);
    o.regime.textContent = Fn < 0.3 ? "displacement: short waves along the hull" : Fn < 0.45 ? "near hull speed: one wave per hull" : Fn < 0.6 ? "climbing the bow wave" : "planing territory";

    // The hull moves right; its transverse waves trail behind the bow.
    waves.replaceChildren();
    const x0 = 360, x1 = 600, sc = (x1 - x0) / L, mid = 110;
    const A = 4 + 14 * Math.min(1, Fn / 0.45);
    const pts = [];
    for (let x = 0; x <= 640; x += 2) {
      const behind = (x1 - x) / sc; // metres astern of the bow
      const eta = behind < 0 ? 0 : A * Math.cos((2 * Math.PI * behind) / lambda) * Math.exp(-behind / (6 * L + lambda));
      pts.push([x, mid - eta]);
    }
    poly(waves, [...pts, [640, 190], [0, 190]], WATER);
    polyline(waves, pts, "stroke:var(--vec-u);stroke-width:1.4");
    // Hull side view, sitting at the mean level.
    const hd = Math.max(16, Math.min(34, L * sc * 0.22));
    poly(waves, [[x0, mid - hd * 0.75], [x1 + 8, mid - hd * 0.9], [x1 - 6, mid + hd * 0.25], [x0 + 26, mid + hd * 0.35], [x0, mid + hd * 0.05]], "fill:var(--background);stroke:currentColor;stroke-width:1.2");
    arrow(waves, x1 - 20, 40, x1 + 10, 40, "currentColor", 1.2, 5);
    label(waves, x1 - 26, 43, `${fx(kn, 1)} kn`, "end");
    // Dimension: one wavelength from the bow crest.
    const lx = x1 - lambda * sc;
    if (lx > 4) {
      arrow(waves, x1, 160, lx, 160, BRAND, 1, 4);
      arrow(waves, lx, 160, x1, 160, BRAND, 1, 4);
      label(waves, (x1 + lx) / 2, 176, `λ = ${fx(lambda, 2)} m`, "middle");
    } else label(waves, 8, 176, `λ = ${fx(lambda, 1)} m, longer than the view`);
    label(waves, x0 + (x1 - x0) / 2, 66, `LWL ${fx(L, 2)} m`, "middle");

    // Interference factor against Froude number.
    plot.replaceChildren();
    const f = frame(plot, { box: [48, 18, 560, 150], x: [0.1, 0.7], y: [0, 2.1], xticks: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7], yticks: [0, 1, 2], xfmt: (v) => fx(v, 1), yfmt: (v) => fx(v, 0), xlabel: "Froude number Fn", ylabel: "1 − cos(g·L_w/V²)" });
    const curve = [];
    for (let F = 0.1; F <= 0.7; F += 0.0004) curve.push([f.sx(F), f.sy(1 - Math.cos(0.9 / (F * F)))]);
    polyline(f.g, curve, "stroke:var(--vec-u);stroke-width:1.1");
    const mark = (F, txt, style) => { el("line", { x1: f.sx(F), x2: f.sx(F), y1: f.T, y2: f.T + f.H, style }, f.g); if (txt) label(f.g, f.sx(F) + 4, f.T + f.H - 6, txt); };
    mark(0.4, "1.34·√LWL", "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:4 3");
    mark(Math.sqrt(0.9 / (3 * Math.PI)), "", "stroke:currentColor;stroke-opacity:.2");
    label(f.g, f.sx(Math.sqrt(0.9 / (3 * Math.PI))) - 4, f.T + f.H - 6, "hump", "end");
    mark(Math.sqrt(0.9 / Math.PI), "main hump", "stroke:currentColor;stroke-opacity:.2");
    if (Fn >= 0.1 && Fn <= 0.7) {
      el("line", { x1: f.sx(Fn), x2: f.sx(Fn), y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:1.2` }, f.g);
      dot(f.g, f.sx(Fn), f.sy(1 - Math.cos(0.9 / (Fn * Fn))), 4, BRAND);
    }
  }
  draw();
}

// ============================================================ resistance

const RHO_SEA = 1026, NU_SEA = 1.19e-6, NU_TANK = 1.14e-6;
const ittc = (re) => 0.075 / (Math.log10(re) - 2) ** 2;

for (const root of document.querySelectorAll("[data-marine-res]")) {
  const pSvg = root.querySelector("[data-power]");
  const cSvg = root.querySelector("[data-cf]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const L = s.len.get(), B = s.beam.get(), T = s.draft.get(), cb = s.cb.get(), k = s.k.get(), kn = s.speed.get(), lam = s.scale.get();
    const vol = cb * L * B * T;
    const S = 1.7 * L * T + vol / T;
    const at = (knots) => {
      const V = knots * KN;
      const re = (V * L) / NU_SEA, cf = ittc(re), Fn = V / Math.sqrt(G * L);
      const cr = 0.001 * (cb / 0.65) ** 2 * (Fn / 0.25) ** 6;
      const q = 0.5 * RHO_SEA * S * V * V;
      return { V, re, cf, Fn, cr, rf: q * (1 + k) * cf, rr: q * cr };
    };
    const now = at(kn);
    const rt = now.rf + now.rr;
    const Vm = now.V / Math.sqrt(lam), Lm = L / lam, reM = (Vm * Lm) / NU_TANK;
    o.fn.textContent = fx(now.Fn, 3);
    o.re.textContent = now.re.toExponential(2).replace("e+", " × 10^");
    o.s.textContent = `${grouped(S, 0)} m²`;
    o.cf.textContent = `${fx(now.cf * 1000, 3)} × 10⁻³`;
    o.cfm.textContent = `${fx(ittc(reM) * 1000, 3)} × 10⁻³`;
    o.rt.textContent = force(rt);
    o.pe.textContent = power(rt * now.V);

    // Effective power, friction and residuary stacked.
    pSvg.replaceChildren();
    const vMax = Math.max(10, Math.ceil((kn * 1.4) / 5) * 5);
    const rows = [];
    for (let v = 0.25; v <= vMax + 1e-9; v += 0.25) { const a = at(v); rows.push([v, (a.rf * a.V) / 1e3, ((a.rf + a.rr) * a.V) / 1e3]); }
    const raw = Math.max(...rows.map((r2) => r2[2]));
    const big = raw > 5000;
    const ny = nice(0, big ? raw / 1000 : raw, 4);
    const pMax = big ? ny.hi * 1000 : ny.hi;
    const f = frame(pSvg, {
      box: [52, 22, 312, 220], x: [0, vMax], y: [0, pMax],
      xticks: nice(0, vMax, 5).ticks, yticks: ny.ticks.map((v) => (big ? v * 1000 : v)),
      xfmt: (v) => fx(v, 0), yfmt: (v) => (big ? fx(v / 1000, dec(ny.step)) : grouped(v, 0)), xlabel: "speed (kn)", ylabel: big ? "P_E (MW)" : "P_E (kW)",
    });
    poly(f.g, [[f.sx(0), f.sy(0)], ...rows.map((r2) => [f.sx(r2[0]), f.sy(r2[1])]), [f.sx(vMax), f.sy(0)]], "fill:var(--vec-u);fill-opacity:.18");
    poly(f.g, [...rows.map((r2) => [f.sx(r2[0]), f.sy(r2[2])]), ...rows.slice().reverse().map((r2) => [f.sx(r2[0]), f.sy(r2[1])])], "fill:var(--vec-out);fill-opacity:.25");
    polyline(f.g, rows.map((r2) => [f.sx(r2[0]), f.sy(r2[1])]), "stroke:var(--vec-u);stroke-width:1.2");
    polyline(f.g, rows.map((r2) => [f.sx(r2[0]), f.sy(r2[2])]), "stroke:var(--vec-out);stroke-width:1.6");
    el("line", { x1: f.sx(kn), x2: f.sx(kn), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.4" }, f.g);
    dot(f.g, f.sx(kn), f.sy((rt * now.V) / 1e3), 4, BRAND);
    label(f.g, f.sx(kn) - 6, f.sy((rt * now.V) / 1e3) - 8, `friction ${fx((now.rf / rt) * 100, 0)} % of R_T`, "end");

    // The ITTC line on a log Reynolds axis.
    cSvg.replaceChildren();
    const g2 = frame(cSvg, { box: [46, 22, 200, 220], x: [5, 10], y: [0, 0.009], xticks: [5, 6, 7, 8, 9, 10], yticks: [0, 0.003, 0.006, 0.009], xfmt: (v) => `10^${v}`, yfmt: (v) => fx(v * 1000, 0), xlabel: "Reynolds number", ylabel: "C_F × 10³" });
    const line = [];
    for (let x = 5; x <= 10; x += 0.05) line.push([g2.sx(x), g2.sy(ittc(10 ** x))]);
    polyline(g2.g, line, "stroke:var(--vec-u);stroke-width:1.4");
    const pt = (re, txt, color) => { const x = clamp(Math.log10(re), 5, 10); dot(g2.g, g2.sx(x), g2.sy(ittc(10 ** x)), 4, color); label(g2.g, g2.sx(x) + (x > 8.5 ? -6 : 6), g2.sy(ittc(10 ** x)) - 8, txt, x > 8.5 ? "end" : "start"); };
    pt(now.re, "ship", BRAND);
    pt(reM, `model 1:${fx(lam, 0)}`, "var(--vec-out)");
  }
  draw();
}

// ============================================================ propeller

const KT = (j) => 0.45 * (1 - j / 1.05);
const KQ = (j) => 0.065 * (1 - j / 1.2);

for (const root of document.querySelectorAll("[data-marine-prop]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const D = s.dia.get(), n = s.rpm.get() / 60, V = s.speed.get() * KN, w = s.wake.get(), t = s.thd.get();
    const Va = V * (1 - w);
    const J = Va / (n * D);
    const kt = KT(J), kq = KQ(J);
    const rho = 1025;
    const thrust = kt * rho * n * n * D ** 4, torque = kq * rho * n * n * D ** 5;
    const pd = 2 * Math.PI * n * torque;
    const eta = J > 0 && kq > 0 ? (J * kt) / (2 * Math.PI * kq) : 0;
    o.j.textContent = fx(J, 3);
    o.thrust.textContent = kt > 0 ? force(thrust) : "none: windmilling";
    o.thrust.style.color = kt > 0 ? "" : BAD;
    o.torque.textContent = `${fx((torque) / 1e3, 1)} kN·m`;
    o.pd.textContent = power(pd);
    o.eta.textContent = kt > 0 ? fx(eta, 3) : "—";
    o.etah.textContent = fx((1 - t) / (1 - w), 3);
    o.slip.textContent = `${fx((1 - Va / (n * D)) * 100, 1)} %`;

    svg.replaceChildren();
    const f = frame(svg, { box: [52, 30, 560, 250], x: [0, 1.25], y: [0, 0.8], xticks: [0, 0.25, 0.5, 0.75, 1, 1.25], yticks: [0, 0.2, 0.4, 0.6, 0.8], xfmt: (v) => fx(v, 2), yfmt: (v) => fx(v, 1), xlabel: "advance ratio J = V_A / nD", ylabel: "K_T, 10·K_Q, η₀" });
    const kts = [], kqs = [], etas = [];
    for (let j = 0; j <= 1.25; j += 0.005) {
      if (KT(j) >= 0) kts.push([f.sx(j), f.sy(KT(j))]);
      kqs.push([f.sx(j), f.sy(Math.max(0, 10 * KQ(j)))]);
      if (KT(j) > 0) etas.push([f.sx(j), f.sy((j * KT(j)) / (2 * Math.PI * KQ(j)))]);
    }
    polyline(f.g, kts, "stroke:var(--vec-u);stroke-width:1.6");
    polyline(f.g, kqs, "stroke:var(--vec-out);stroke-width:1.6");
    polyline(f.g, etas, "stroke:var(--vec-v);stroke-width:1.6");
    let best = [0, 0];
    for (let j = 0; j < 1.05; j += 0.001) { const e = (j * KT(j)) / (2 * Math.PI * KQ(j)); if (e > best[1]) best = [j, e]; }
    dot(f.g, f.sx(best[0]), f.sy(best[1]), 3, "var(--vec-v)");
    label(f.g, f.sx(best[0]), f.sy(best[1]) - 8, `η₀ max ${fx(best[1], 2)} at J ${fx(best[0], 2)}`, "middle");
    if (J >= 0 && J <= 1.25) {
      el("line", { x1: f.sx(J), x2: f.sx(J), y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:1.2` }, f.g);
      if (kt > 0) { dot(f.g, f.sx(J), f.sy(kt), 4, BRAND); dot(f.g, f.sx(J), f.sy(eta), 4, BRAND); }
      dot(f.g, f.sx(J), f.sy(10 * kq), 4, BRAND);
    }
  }
  draw();
}

// ============================================================ apparent wind

const pointOfSail = (twa) => (twa < 35 ? "in irons (no-go zone)" : twa < 55 ? "close-hauled" : twa < 80 ? "close reach" : twa <= 100 ? "beam reach" : twa < 150 ? "broad reach" : "running");

export function apparent(tws, twa, bs) {
  const x = tws * Math.cos(twa * RAD) + bs, y = tws * Math.sin(twa * RAD);
  return { aws: Math.hypot(x, y), awa: Math.atan2(y, x) / RAD };
}

for (const root of document.querySelectorAll("[data-marine-wind]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const tws = s.tws.get(), twa = s.twa.get(), bs = s.bs.get();
    const { aws, awa } = apparent(tws, twa, bs);
    // Sail coefficients: as set while the sail can be trimmed; past 100°
    // apparent it stalls and drag takes over, as on a run.
    const luff = awa < 25;
    const run = clamp((awa - 100) / 80, 0, 1);
    const cl = luff ? 0 : s.cl.get() * Math.cos((run * Math.PI) / 2) ** 2;
    const cd = luff ? 0 : s.cd.get() + 1.05 * Math.sin((run * Math.PI) / 2) ** 2;
    const q = 0.5 * 1.225 * (aws * KN) ** 2 * s.area.get();
    const Lf = q * cl, Df = q * cd;
    const lift = [Math.sin(awa * RAD), -Math.cos(awa * RAD)], drag = [-Math.cos(awa * RAD), -Math.sin(awa * RAD)];
    const F = [Lf * lift[0] + Df * drag[0], Lf * lift[1] + Df * drag[1]];
    const drive = F[0], side = -F[1];
    const mh = side * s.hce.get(), mr = s.disp.get() * G * s.gm.get();
    o.aws.textContent = `${fx(aws, 2)} kn`;
    o.awa.textContent = `${fx(awa, 1)}°`;
    o.pos.textContent = pointOfSail(twa);
    o.drive.textContent = luff ? "0 (sail luffing)" : force(drive);
    o.side.textContent = force(side);
    o.heel.textContent = mh / mr >= 1 ? "knocked down" : `${fx(Math.asin(clamp(mh / mr, -1, 1)) / RAD, 1)}°`;
    o.heel.style.color = mh / mr >= 1 ? BAD : "";

    svg.replaceChildren();
    // Boat axes: x forward = up the screen, y to starboard = right.
    const mast = [330, 175], k = 19;
    const P = (x, y) => [mast[0] + y * k, mast[1] - x * k];
    // Hull outline, 9 m long, mast a third back from the bow.
    const hull = [];
    for (let i = 0; i <= 24; i++) {
      const t2 = i / 24, x = 3 - 9 * t2;
      const half = t2 < 0.55 ? 1.6 * Math.sin((Math.PI / 2) * (t2 / 0.55)) ** 0.8 : 1.6 - 0.45 * ((t2 - 0.55) / 0.45) ** 2;
      hull.push([x, half]);
    }
    const outline = [...hull.map(([x, y]) => P(x, y)), ...hull.slice().reverse().map(([x, y]) => P(x, -y))];
    poly(svg, outline, "fill:var(--background);stroke:currentColor;stroke-width:1.2");
    el("line", { x1: P(3, 0)[0], y1: P(3, 0)[1], x2: P(-6, 0)[0], y2: P(-6, 0)[1], style: "stroke:currentColor;stroke-opacity:.2;stroke-dasharray:2 3" }, svg);
    // The wind triangle, ending at the mast.
    const vt = [-tws * Math.cos(twa * RAD), -tws * Math.sin(twa * RAD)];
    const va = [vt[0] - bs, vt[1]];
    const sc = 11;
    const Q0 = [mast[0] - va[1] * sc, mast[1] + va[0] * sc];
    const Q1 = [Q0[0] + vt[1] * sc, Q0[1] - vt[0] * sc];
    arrow(svg, Q0[0], Q0[1], Q1[0], Q1[1], "var(--vec-u)", 1.8, 7);
    arrow(svg, Q1[0], Q1[1], mast[0], mast[1], "var(--muted-foreground)", 1.4, 6, "4 3");
    arrow(svg, Q0[0], Q0[1], mast[0], mast[1], BRAND, 2, 7);
    label(svg, (Q0[0] + Q1[0]) / 2 + 6, (Q0[1] + Q1[1]) / 2 - 4, `true ${fx(tws, 1)} kn`);
    label(svg, (Q0[0] + mast[0]) / 2 + 6, (Q0[1] + mast[1]) / 2 + 12, `apparent ${fx(aws, 1)} kn`, "start", { style: `fill:${BRAND}` });
    // Sail: boom to leeward at about 15° to the apparent wind.
    const beta = clamp(awa - 15, 5, 85);
    const boom = [-Math.cos(beta * RAD), -Math.sin(beta * RAD)];
    const chord = 4.2;
    const clew = P(boom[0] * chord, boom[1] * chord);
    const ce = P(boom[0] * chord * 0.4, boom[1] * chord * 0.4);
    el("path", { d: `M${mast[0]} ${mast[1]}Q${(mast[0] + clew[0]) / 2 + (luff ? 0 : 10 * boom[1] * -1)} ${(mast[1] + clew[1]) / 2 + (luff ? 0 : 10 * boom[0] * -1)} ${clew[0]} ${clew[1]}`, style: `fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round${luff ? ";stroke-dasharray:3 3" : ""}` }, svg);
    dot(svg, mast[0], mast[1], 3.5, "currentColor");
    // Forces at the centre of effort, scaled to the resultant.
    if (!luff) {
      const fs = 110 / Math.max(1, Math.hypot(F[0], F[1]));
      const toS = (v) => [ce[0] + v[1] * fs, ce[1] - v[0] * fs];
      const Lv = toS([Lf * lift[0], Lf * lift[1]]), Dv = toS([Df * drag[0], Df * drag[1]]), Rv = toS(F), Dr = toS([drive, 0]), Sd = toS([0, F[1]]);
      arrow(svg, ce[0], ce[1], Lv[0], Lv[1], "currentColor", 1, 5);
      label(svg, Lv[0] + 4, Lv[1] - 4, "lift");
      arrow(svg, ce[0], ce[1], Dv[0], Dv[1], "currentColor", 1, 5);
      label(svg, Dv[0] + 4, Dv[1] + 10, "drag");
      arrow(svg, ce[0], ce[1], Rv[0], Rv[1], "var(--vec-out)", 2, 7);
      arrow(svg, ce[0], ce[1], Dr[0], Dr[1], "var(--vec-out)", 1.4, 6, "4 3");
      arrow(svg, ce[0], ce[1], Sd[0], Sd[1], "var(--vec-out)", 1.4, 6, "4 3");
      label(svg, Dr[0] + 6, Dr[1], `drive ${force(drive)}`);
      label(svg, Sd[0] - 6, Sd[1] + 14, `heel ${force(side)}`, "end");
    }
    label(svg, 10, 16, `${pointOfSail(twa)} · TWA ${fx(twa, 0)}° · AWA ${fx(awa, 1)}°`);
    arrow(svg, 30, 360, 30, 330, "currentColor", 1, 5);
    label(svg, 38, 352, "bow");
  }
  draw();
}

// ============================================================ polar and VMG

const VMAX = (tws) => 7.2 * (1 - Math.exp(-tws / 7));
export function boatSpeed(twa, tws) {
  const a = Math.abs(twa);
  if (a < 28) return 0;
  let shape;
  if (a <= 83) shape = Math.sqrt(Math.sin(((a - 28) / 55) * (Math.PI / 2)));
  else if (a <= 110) shape = 1;
  else shape = 1 - 0.3 * ((a - 110) / 70) ** 1.6;
  return VMAX(tws) * shape;
}

for (const root of document.querySelectorAll("[data-marine-polar]")) {
  const pSvg = root.querySelector("[data-polar]");
  const cSvg = root.querySelector("[data-course]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function best(tws) {
    let up = [0, 0], down = [0, 0];
    for (let a = 28; a <= 180; a += 0.25) {
      const v = boatSpeed(a, tws), vmg = v * Math.cos(a * RAD);
      if (vmg > up[1]) up = [a, vmg];
      if (-vmg > down[1]) down = [a, -vmg];
    }
    return { up, down };
  }

  function draw() {
    const tws = s.tws.get(), twa = s.twa.get(), dist = s.dist.get(), cur = s.cur.get();
    const v = boatSpeed(twa, tws);
    const { up, down } = best(tws);
    o.bs.textContent = `${fx(v, 2)} kn`;
    o.vmg.textContent = `${fx(v * Math.cos(twa * RAD), 2)} kn ${Math.cos(twa * RAD) >= 0 ? "upwind" : "downwind"}`;
    o.up.textContent = `${fx(up[0], 1)}° · VMG ${fx(up[1], 2)} kn`;
    o.down.textContent = `${fx(down[0], 1)}° · VMG ${fx(down[1], 2)} kn`;
    o.tack.textContent = `${fx(2 * up[0], 0)}°`;

    // Polar: wind from the top, starboard half.
    pSvg.replaceChildren();
    const cx = 40, cy = 190, R = 21; // px per knot
    const at = (a, r) => [cx + r * R * Math.sin(a * RAD), cy - r * R * Math.cos(a * RAD)];
    for (let r = 2; r <= 8; r += 2) {
      el("path", { d: `M${cx} ${cy - r * R}A${r * R} ${r * R} 0 0 1 ${cx} ${cy + r * R}`, style: "fill:none;stroke:currentColor;stroke-opacity:.12" }, pSvg);
      label(pSvg, cx - 4, cy - r * R + 3, `${r}`, "end");
    }
    for (let a = 0; a <= 180; a += 30) {
      const [x, y] = at(a, 8);
      el("line", { x1: cx, y1: cy, x2: x, y2: y, style: "stroke:currentColor;stroke-opacity:.12" }, pSvg);
      const [lx, ly] = at(a, 8.5);
      label(pSvg, lx, ly + 3, `${a}°`, a === 0 || a === 180 ? "middle" : "start");
    }
    for (const t of [6, 20]) {
      if (Math.abs(t - tws) < 1) continue;
      const pts = [];
      for (let a = 0; a <= 180; a += 1) pts.push(at(a, boatSpeed(a, t)));
      polyline(pSvg, pts, "stroke:currentColor;stroke-opacity:.25;stroke-width:1");
      const [lx, ly] = at(100, boatSpeed(100, t));
      label(pSvg, lx + 4, ly, `${t} kn`);
    }
    const pts = [];
    for (let a = 0; a <= 180; a += 0.5) pts.push(at(a, boatSpeed(a, tws)));
    polyline(pSvg, pts, "stroke:var(--vec-u);stroke-width:1.8");
    for (const [a, vmg, sign] of [[up[0], up[1], 1], [down[0], down[1], -1]]) {
      const p = at(a, boatSpeed(a, tws));
      el("line", { x1: cx, y1: cy, x2: p[0], y2: p[1], style: "stroke:var(--vec-out);stroke-width:1.2" }, pSvg);
      el("line", { x1: p[0], y1: p[1], x2: cx, y2: p[1], style: "stroke:var(--vec-out);stroke-opacity:.6;stroke-dasharray:3 3" }, pSvg);
      dot(pSvg, p[0], p[1], 3.5, "var(--vec-out)");
      label(pSvg, p[0] + 6, p[1] + (sign > 0 ? -4 : 12), `${sign > 0 ? "best VMG up" : "best VMG down"} ${fx(vmg, 2)} kn`);
    }
    const pc = at(twa, v);
    el("line", { x1: cx, y1: cy, x2: pc[0], y2: pc[1], style: `stroke:${BRAND};stroke-width:1.4` }, pSvg);
    dot(pSvg, pc[0], pc[1], 4.5, BRAND);
    arrow(pSvg, 330, 14, 330, 44, "currentColor", 1.2, 5);
    label(pSvg, 324, 24, "wind", "end");

    // The beat: two tacks at the best upwind angle, current across.
    cSvg.replaceChildren();
    const a = up[0] * RAD, sp = boatSpeed(up[0], tws);
    const v1 = [-sp * Math.sin(a) + cur, sp * Math.cos(a)], v2 = [sp * Math.sin(a) + cur, sp * Math.cos(a)];
    const det = v1[0] * v2[1] - v2[0] * v1[1];
    const t1 = Math.abs(det) > 1e-9 ? (0 * v2[1] - v2[0] * dist) / det : NaN;
    const t2 = Math.abs(det) > 1e-9 ? (v1[0] * dist - v1[1] * 0) / det : NaN;
    const ok = sp > 0 && t1 >= 0 && t2 >= 0;
    const reach = ok ? Math.abs(v1[0] * t1) : 0;
    const ps = Math.min(290 / dist, 105 / Math.max(reach, 1e-6));
    const mk = [130, 50], st = [130, 50 + dist * ps];
    const W = (p) => [st[0] + p[0] * ps, st[1] - p[1] * ps];
    for (const vv of [v1, v2]) {
      const L = Math.hypot(vv[0], vv[1]) || 1;
      const end = [mk[0] - (vv[0] / L) * 600, mk[1] + (vv[1] / L) * 600];
      el("line", { x1: mk[0], y1: mk[1], x2: end[0], y2: end[1], style: "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:4 3" }, cSvg);
    }
    if (ok) {
      const turn = W([v1[0] * t1, v1[1] * t1]);
      polyline(cSvg, [st, turn, mk], `stroke:${BRAND};stroke-width:1.8`);
      dot(cSvg, turn[0], turn[1], 3, BRAND);
      label(cSvg, turn[0] + 8, turn[1] + 4, "tack");
      o.time.textContent = `${fx((t1 + t2) * 60, 1)} min · legs ${fx(t1 * 60, 0)} + ${fx(t2 * 60, 0)} min`;
    } else o.time.textContent = "current too strong for this beat";
    if (cur) arrow(cSvg, 200, 360, 200 + Math.sign(cur) * 40, 360, "var(--vec-u)", 1.4, 5);
    if (cur) label(cSvg, 200, 352, `current ${fx(Math.abs(cur), 1)} kn`, "middle");
    el("rect", { x: mk[0] - 5, y: mk[1] - 5, width: 10, height: 10, style: `fill:${BRAND}` }, cSvg);
    label(cSvg, mk[0] + 9, mk[1] + 4, "mark");
    dot(cSvg, st[0], st[1], 4, "currentColor");
    label(cSvg, st[0] + 8, st[1] + 4, "start");
    label(cSvg, 30, 24, `wind · mark ${fx(dist, 1)} nm upwind`);
    arrow(cSvg, 20, 12, 20, 40, "currentColor", 1.2, 5);
  }
  draw();
}
