// Meteorology blocks. Constants: Rd = 287.04 J/(kg·K), cp = 1005.7
// J/(kg·K), Lv = 2.501 × 10⁶ J/kg, ε = 0.622, Ω = 7.2921 × 10⁻⁵ rad/s,
// g = 9.80665 m/s². The station figure (anatomy/weather-station.js) listens
// for "wx-wind" events from the Beaufort block and sends its own back.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import "../anatomy/weather-station.js";

const RD = 287.04, CP = 1005.7, LV = 2.501e6, EPS = 0.622, KAPPA = RD / CP, G0 = 9.80665;
const OMEGA = 7.2921e-5;
const RAD = Math.PI / 180;

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtSigned = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d);

// A play/pause button made by wxPlay: swaps its icons and label.
function playButton(root, labels, onToggle) {
  const btn = root.querySelector('[data-action="play"]');
  let on = false;
  const set = (v) => {
    on = v;
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", on);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !on);
    btn.querySelector("[data-label]").textContent = on ? labels[1] : labels[0];
  };
  btn?.addEventListener("click", () => {
    set(!on);
    onToggle(on);
  });
  return { set, get: () => on };
}

// Visible-only animation loop: tick(dt) returns false to stop. A loop that
// is asked to run while offscreen starts when it scrolls into view.
function loop(root, tick) {
  let frameId = 0, last = 0, visible = false, wanted = false;
  const step = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    wanted = tick(dt);
    frameId = wanted && visible ? requestAnimationFrame(step) : 0;
  };
  const start = () => { if (!frameId && visible) { last = 0; frameId = requestAnimationFrame(step); } };
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible && wanted) start();
    else if (!visible && frameId) { cancelAnimationFrame(frameId); frameId = 0; }
  }).observe(root);
  return () => { wanted = true; start(); };
}

// ============================================================ Beaufort

const BF_LIMITS = [0.2, 1.5, 3.3, 5.4, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
const BF_NAMES = ["Calm", "Light air", "Light breeze", "Gentle breeze", "Moderate breeze", "Fresh breeze", "Strong breeze", "Near gale", "Gale", "Strong gale", "Storm", "Violent storm", "Hurricane force"];
const BF_SEA = [
  "Sea like a mirror", "Ripples without crests", "Small wavelets, crests do not break", "Large wavelets, scattered white horses",
  "Small waves, frequent white horses", "Moderate longer waves, many white horses", "Large waves, white foam crests everywhere",
  "Sea heaps up, foam blown in streaks", "Moderately high waves, crests break into spindrift", "High waves, dense streaks of foam",
  "Very high waves, the sea looks white", "Exceptionally high waves", "Air full of foam and spray, sea completely white",
];
const BF_LAND = [
  "Smoke rises vertically", "Smoke drifts, vanes still", "Wind felt on the face, leaves rustle", "Leaves and twigs always moving",
  "Dust and loose paper lift, small branches move", "Small trees in leaf sway", "Large branches move, umbrellas hard to use",
  "Whole trees move, hard to walk into the wind", "Twigs break off, walking impeded", "Slight damage: slates and chimney pots",
  "Trees uprooted, considerable damage", "Widespread damage", "Devastation",
];
export const beaufortOf = (v) => {
  const i = BF_LIMITS.findIndex((l) => v < l + 0.05);
  return i < 0 ? 12 : i;
};

for (const root of document.querySelectorAll("[data-wx-beaufort]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw(true));
  root.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => { s.v.set(Number(b.dataset.v), false); draw(true); }));
  window.addEventListener("wx-wind", (e) => {
    if (e.detail.source === "beaufort") return;
    s.v.set(e.detail.ms, false);
    draw(false);
  });

  function draw(send) {
    const v = s.v.get();
    const B = beaufortOf(v);
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 18, 560, 240], x: [0, 40], y: [0, 12.6], xticks: [0, 5, 10, 15, 20, 25, 30, 35, 40], yticks: [0, 2, 4, 6, 8, 10, 12], xlabel: "wind speed at 10 m (m/s)", ylabel: "Beaufort force" });
    // The WMO bands as steps.
    let lo = 0;
    for (let b = 0; b <= 12; b++) {
      const hi = b < 12 ? BF_LIMITS[b] : 40;
      el("rect", { x: f.sx(lo), y: f.sy(b + 0.5), width: f.sx(hi) - f.sx(lo), height: f.sy(b - 0.5 < 0 ? 0 : b - 0.5) - f.sy(b + 0.5), style: `fill:${b === B ? "var(--brand)" : "currentColor"};fill-opacity:${b === B ? 0.18 : b % 2 ? 0.05 : 0.025}` }, svg);
      lo = hi;
    }
    // v = 0.836 B^1.5.
    const pts = [];
    for (let b = 0; b <= 12.6; b += 0.05) pts.push([f.sx(Math.min(40, 0.836 * b ** 1.5)), f.sy(b)]);
    polyline(svg, pts, "stroke:var(--muted-foreground);stroke-width:1.25;stroke-dasharray:4 3");
    text(svg, f.sx(30), f.sy(11.6), "v = 0.836 B^1.5", { "text-anchor": "end" });
    el("line", { x1: f.sx(v), x2: f.sx(v), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    el("circle", { cx: f.sx(v), cy: f.sy(B), r: 5, style: "fill:var(--brand)" }, svg);
    text(svg, f.sx(v) + (v > 30 ? -8 : 8), f.sy(B) - 8, `${B} · ${BF_NAMES[B]}`, { "text-anchor": v > 30 ? "end" : "start", class: "fill-foreground font-mono text-[11px]" });

    o.force.textContent = String(B);
    o.name.textContent = BF_NAMES[B];
    o.kmh.textContent = num(v * 3.6, 1);
    o.kt.textContent = num(v * 1.943844, 1);
    o.mph.textContent = num(v * 2.236936, 1);
    o.sea.textContent = BF_SEA[B];
    o.land.textContent = BF_LAND[B];
    if (send) window.dispatchEvent(new CustomEvent("wx-wind", { detail: { ms: v, source: "beaufort" } }));
  }
  draw(true);
}

// ============================================================ Parcel / skew-T

// Saturation vapour pressure (hPa) over water, Bolton (1980).
const esat = (tc) => 6.112 * Math.exp((17.67 * tc) / (tc + 243.5));
const mixing = (e, p) => (EPS * e) / (p - e);

// Pseudo-adiabatic lapse in pressure: dT/dp (K/hPa) for a saturated parcel.
function moistDTdp(TK, p) {
  const rs = mixing(esat(TK - 273.15), p);
  return (RD * TK + LV * rs) / (p * (CP + (LV * LV * rs * EPS) / (RD * TK * TK)));
}

// Lifts a parcel from (p0, T0, Td0) in steps of dp hPa to pTop. Returns
// the parcel temperature (°C) at each level and the LCL.
export function liftParcel(p0, T0, Td0, pTop = 100, dp = 5) {
  const theta = (T0 + 273.15) * (1000 / p0) ** KAPPA;
  const w0 = mixing(esat(Td0), p0);
  const dryT = (p) => theta * (p / 1000) ** KAPPA; // K
  // LCL: where the dry-lifted parcel saturates at its own mixing ratio.
  let lo = pTop, hi = p0;
  if (mixing(esat(dryT(p0) - 273.15), p0) <= w0) hi = lo = p0;
  else {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (mixing(esat(dryT(mid) - 273.15), mid) > w0) hi = mid;
      else lo = mid;
    }
  }
  const pLcl = (lo + hi) / 2;
  const levels = [];
  for (let p = p0; p >= pTop - 1e-9; p -= dp) levels.push(p);
  const temps = [];
  let TK = dryT(pLcl), pm = pLcl;
  for (const p of levels) {
    if (p >= pLcl) { temps.push(dryT(p) - 273.15); continue; }
    // RK4 from pm down to p.
    while (pm - p > 1e-9) {
      const h = -Math.min(1, pm - p);
      const k1 = moistDTdp(TK, pm);
      const k2 = moistDTdp(TK + (h / 2) * k1, pm + h / 2);
      const k3 = moistDTdp(TK + (h / 2) * k2, pm + h / 2);
      const k4 = moistDTdp(TK + h * k3, pm + h);
      TK += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      pm += h;
    }
    temps.push(TK - 273.15);
  }
  return { levels, temps, pLcl, tLcl: dryT(pLcl) - 273.15 };
}

const PAR_LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100];
const PAR_PRESETS = {
  // T and Td at each level above the surface (925 hPa and up), °C.
  summer: { t: 30, td: 21, T: [25.5, 20, 8, 0, -9, -20, -35, -44, -54, -60, -64], Td: [19, 14, 1, -8, -20, -32, -46, -54, -63, -72, -80] },
  stable: { t: 16, td: 8, T: [13, 10, 4, -3, -11, -21, -34, -43, -52, -57, -60], Td: [5, 0, -12, -20, -28, -36, -48, -56, -64, -72, -80] },
  capped: { t: 31, td: 22, T: [26, 25, 11, 2, -8, -19, -34, -43, -53, -59, -63], Td: [20, 6, -2, -10, -21, -33, -47, -55, -64, -73, -80] },
};

for (const root of document.querySelectorAll("[data-wx-parcel]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let preset = "summer";
  let T = [...PAR_PRESETS.summer.T], Td = [...PAR_PRESETS.summer.Td];
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => {
    preset = v;
    const p = PAR_PRESETS[v];
    T = [...p.T];
    Td = [...p.Td];
    s.t.set(p.t, false);
    s.td.set(p.td, false);
    draw();
  });

  // Skew-T geometry: y ∝ ln p, isotherms lean 45°.
  const Lx = 52, Tp = 14, W = 560, H = 410, PX = W / 90; // 90 °C across the bottom
  const lnSpan = Math.log(1000 / 100);
  const yOf = (p) => Tp + H - (Math.log(1000 / p) / lnSpan) * H;
  const xOf = (t, p) => Lx + (t + 40) * PX + (Tp + H - yOf(p));
  const tOf = (x, p) => (x - Lx - (Tp + H - yOf(p))) / PX - 40;

  const envAt = (arr, t0, p) => {
    // Interpolate in ln p over [surface, ...levels].
    const vals = [t0, ...arr];
    for (let i = 0; i < PAR_LEVELS.length - 1; i++) {
      const a = PAR_LEVELS[i], b = PAR_LEVELS[i + 1];
      if (p <= a && p >= b) {
        const f = Math.log(a / p) / Math.log(a / b);
        return vals[i] + f * (vals[i + 1] - vals[i]);
      }
    }
    return vals[vals.length - 1];
  };

  let drag = null;
  const toView = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.addEventListener("pointerdown", (e) => {
    const h = e.target.closest("[data-handle]");
    if (!h) return;
    drag = { kind: h.dataset.kind, i: Number(h.dataset.i) };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const v = toView(e);
    nudgeTo(drag.kind, drag.i, tOf(v.x, PAR_LEVELS[drag.i + 1]));
  });
  const end = () => (drag = null);
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const h = e.target.closest("[data-handle]");
    if (!h || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const arr = h.dataset.kind === "t" ? T : Td, i = Number(h.dataset.i);
    nudgeTo(h.dataset.kind, i, arr[i] + (e.key === "ArrowRight" ? 0.5 : -0.5) * (e.shiftKey ? 4 : 1), true);
  });
  function nudgeTo(kind, i, value, refocus) {
    value = Math.round(value * 2) / 2;
    if (kind === "t") T[i] = clamp(value, Td[i], 50);
    else Td[i] = clamp(value, -100, T[i]);
    draw();
    if (refocus) svg.querySelector(`[data-handle][data-kind="${kind}"][data-i="${i}"]`)?.focus();
  }

  function draw() {
    let t0 = s.t.get(), td0 = s.td.get();
    if (td0 > t0) { td0 = t0; s.td.set(t0, false); }
    const parcel = liftParcel(1000, t0, td0);
    const env = parcel.levels.map((p) => envAt(T, t0, p));

    // Heights from the hypsometric equation with the environment.
    const zOf = (pTarget) => {
      let z = 0;
      for (let i = 1; i < parcel.levels.length; i++) {
        const pa = parcel.levels[i - 1], pb = parcel.levels[i];
        if (pb < pTarget) {
          const tm = (envAt(T, t0, pa) + envAt(T, t0, pTarget)) / 2 + 273.15;
          return z + ((RD * tm) / G0) * Math.log(pa / pTarget);
        }
        const tm = (env[i - 1] + env[i]) / 2 + 273.15;
        z += ((RD * tm) / G0) * Math.log(pa / pb);
      }
      return z;
    };

    // Buoyancy regions: LFC is the first crossing to positive above the
    // LCL, EL the top of the last positive layer.
    const diff = parcel.temps.map((tp, i) => tp - env[i]);
    let lfcIdx = -1, elIdx = -1;
    const lclIdx = parcel.levels.findIndex((p) => p <= parcel.pLcl);
    for (let i = Math.max(1, lclIdx); i < diff.length; i++) {
      if (diff[i] > 0 && lfcIdx < 0) lfcIdx = i;
      if (diff[i] > 0) elIdx = i;
    }
    // Crossing pressure between two samples (linear in ln p).
    const cross = (i) => {
      const a = diff[i - 1], b = diff[i];
      if (a === b) return parcel.levels[i];
      const f = a / (a - b);
      return Math.exp(Math.log(parcel.levels[i - 1]) + f * (Math.log(parcel.levels[i]) - Math.log(parcel.levels[i - 1])));
    };
    let cape = 0, cin = 0;
    const capeQuads = [], cinQuads = [];
    for (let i = 1; i < diff.length; i++) {
      const pa = parcel.levels[i - 1], pb = parcel.levels[i];
      const area = RD * ((diff[i - 1] + diff[i]) / 2) * Math.log(pa / pb);
      const quad = [[xOf(parcel.temps[i - 1], pa), yOf(pa)], [xOf(parcel.temps[i], pb), yOf(pb)], [xOf(env[i], pb), yOf(pb)], [xOf(env[i - 1], pa), yOf(pa)]];
      if (lfcIdx > 0 && i >= lfcIdx && i <= elIdx + 1) {
        if (area > 0) { cape += area; capeQuads.push(quad); }
      } else if (lfcIdx > 0 && i < lfcIdx) {
        if (area < 0) { cin += area; cinQuads.push(quad); }
      }
    }
    const pLfc = lfcIdx > 0 ? (lfcIdx <= lclIdx ? parcel.pLcl : cross(lfcIdx)) : null;
    const pEl = elIdx > 0 ? (elIdx + 1 < diff.length ? cross(elIdx + 1) : parcel.levels[elIdx]) : null;

    svg.replaceChildren();
    const clipId = "wx-parcel-clip";
    const defs = el("defs", {}, svg);
    const cp = el("clipPath", { id: clipId }, defs);
    el("rect", { x: Lx, y: Tp, width: W, height: H }, cp);
    const g = el("g", { "clip-path": `url(#${clipId})` }, svg);
    // Isotherms every 10 °C.
    for (let t = -110; t <= 50; t += 10) {
      el("line", { x1: xOf(t, 1000), y1: yOf(1000), x2: xOf(t, 100), y2: yOf(100), style: `stroke:currentColor;stroke-opacity:${t === 0 ? 0.25 : 0.08}` }, g);
    }
    // Dry adiabats every 10 K of θ, and moist adiabats.
    for (let th = 250; th <= 450; th += 10) {
      const pts = [];
      for (let p = 1000; p >= 100; p -= 20) pts.push([xOf(th * (p / 1000) ** KAPPA - 273.15, p), yOf(p)]);
      polyline(g, pts, "stroke:var(--vec-out);stroke-opacity:0.28;stroke-width:0.8");
    }
    for (let tw = -10; tw <= 32; tw += 6) {
      const m = liftParcel(1000, tw, tw, 200, 20);
      polyline(g, m.levels.map((p, i) => [xOf(m.temps[i], p), yOf(p)]), "stroke:var(--code-add);stroke-opacity:0.28;stroke-width:0.8;stroke-dasharray:3 3");
    }
    // CAPE and CIN.
    const quadPath = (qs) => qs.map((q) => "M" + q.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L") + "Z").join("");
    if (capeQuads.length) el("path", { d: quadPath(capeQuads), style: "fill:var(--code-add);fill-opacity:0.28;stroke:none" }, g);
    if (cinQuads.length) el("path", { d: quadPath(cinQuads), style: "fill:var(--code-del);fill-opacity:0.25;stroke:none" }, g);
    // Sounding and parcel.
    const fine = parcel.levels;
    polyline(g, fine.map((p) => [xOf(envAt(Td, td0, p), p), yOf(p)]), "stroke:var(--vec-u);stroke-width:2");
    polyline(g, fine.map((p, i) => [xOf(env[i], p), yOf(p)]), "stroke:var(--foreground);stroke-width:2");
    polyline(g, fine.map((p, i) => [xOf(parcel.temps[i], p), yOf(p)]), "stroke:var(--brand);stroke-width:2");
    // The parcel's mixing ratio line up to the LCL.
    const w0 = mixing(esat(td0), 1000);
    const wl = [];
    for (let p = 1000; p >= parcel.pLcl - 0.1; p -= 5) {
      const e = (w0 * p) / (EPS + w0);
      const td = (243.5 * Math.log(e / 6.112)) / (17.67 - Math.log(e / 6.112));
      wl.push([xOf(td, p), yOf(p)]);
    }
    polyline(g, wl, "stroke:var(--vec-u);stroke-opacity:0.6;stroke-width:1;stroke-dasharray:2 3");

    // Frame: isobars and labels outside the clip.
    for (const p of [1000, 850, 700, 500, 400, 300, 250, 200, 150, 100]) {
      el("line", { x1: Lx, x2: Lx + W, y1: yOf(p), y2: yOf(p), style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
      text(svg, Lx - 6, yOf(p) + 3, String(p), { "text-anchor": "end" });
    }
    text(svg, 4, Tp - 4, "hPa", { "text-anchor": "start" });
    for (let t = -40; t <= 40; t += 20) text(svg, xOf(t, 1000), Tp + H + 13, `${num(t, 0)}°`, { "text-anchor": "middle" });
    el("rect", { x: Lx, y: Tp, width: W, height: H, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, svg);

    const mark = (p, label) => {
      if (!p) return;
      el("line", { x1: Lx + W - 70, x2: Lx + W, y1: yOf(p), y2: yOf(p), style: "stroke:var(--brand);stroke-width:1" }, svg);
      text(svg, Lx + W - 4, yOf(p) - 4, label, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    };
    mark(parcel.pLcl, "LCL");
    if (pLfc && Math.abs(pLfc - parcel.pLcl) > 8) mark(pLfc, "LFC");
    mark(pEl, "EL");

    // Drag handles on the sounding points.
    for (const [kind, arr, cls] of [["td", Td, "var(--vec-u)"], ["t", T, "var(--foreground)"]]) {
      arr.forEach((t, i) => {
        const p = PAR_LEVELS[i + 1];
        if (p < 150) return;
        const c = el("circle", { cx: xOf(t, p), cy: yOf(p), r: 5, tabindex: 0, role: "slider", "aria-label": `${kind === "t" ? "Temperature" : "Dew point"} at ${p} hPa`, "aria-valuenow": t, "aria-valuetext": `${num(t, 1)} °C`, "data-handle": "", "data-kind": kind, "data-i": i, class: "cursor-ew-resize outline-none focus-visible:stroke-[var(--ring)]", style: `fill:var(--background);stroke:${cls};stroke-width:1.75` }, svg);
        c.addEventListener("focus", () => c.setAttribute("r", "6.5"));
        c.addEventListener("blur", () => c.setAttribute("r", "5"));
      });
    }

    const km = (p) => `${num(zOf(p) / 1000, 2)} km`;
    o.lcl.textContent = `${num(parcel.pLcl, 0)} hPa · ${km(parcel.pLcl)}`;
    o.lfc.textContent = pLfc ? `${num(pLfc, 0)} hPa · ${km(pLfc)}` : "none";
    o.el.textContent = pEl ? `${num(pEl, 0)} hPa · ${km(pEl)}` : "none";
    o.cape.textContent = `${num(cape, 0)} J/kg`;
    o.cin.textContent = `${num(cin, 0)} J/kg`;
    const i500 = parcel.levels.findIndex((p) => Math.abs(p - 500) < 1e-6);
    const li = env[i500] - parcel.temps[i500];
    o.li.textContent = `${fmtSigned(li, 1)} K${li < -6 ? " · very unstable" : li < -3 ? " · unstable" : li < 0 ? " · marginal" : " · stable"}`;
  }
  draw();
}

// ============================================================ Feels like

const cToF = (c) => (c * 9) / 5 + 32;
const fToC = (f) => ((f - 32) * 5) / 9;
export function heatIndexC(tc, rh) {
  const T = cToF(tc);
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  if ((simple + T) / 2 < 80) return fToC(simple);
  let hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T - 0.05481717 * rh * rh + 0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
  if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
  return fToC(hi);
}
export const windChillC = (t, v) => 13.12 + 0.6215 * t - 11.37 * v ** 0.16 + 0.3965 * t * v ** 0.16;
const dewPoint = (t, rh) => {
  const gma = Math.log(Math.max(rh, 0.1) / 100) + (17.62 * t) / (243.12 + t);
  return (243.12 * gma) / (17.62 - gma);
};
const heatCat = (hi) => (hi >= 51.7 ? "extreme danger" : hi >= 39.4 ? "danger" : hi >= 32.2 ? "extreme caution" : hi >= 26.7 ? "caution" : "no heat risk");
const chillCat = (wc) => (wc <= -55 ? "extreme: frostbite under 2 min" : wc <= -48 ? "severe: frostbite in 2–5 min" : wc <= -40 ? "very high: frostbite in 5–10 min" : wc <= -28 ? "high: frostbite in 10–30 min" : wc <= -10 ? "moderate" : "low");

for (const root of document.querySelectorAll("[data-wx-feels]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "heat";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => {
    mode = v;
    // Move to a temperature where the chosen index applies.
    if (v === "heat" && s.t.get() < 26.7) s.t.set(32, false);
    if (v === "cold" && s.t.get() > 10) s.t.set(-10, false);
    draw();
  });

  function draw() {
    const t = s.t.get(), rh = s.rh.get(), v = s.wind.get();
    const heatOk = t >= 26.7, coldOk = t <= 10 && v > 4.8;
    const hi = heatIndexC(t, rh), wc = windChillC(t, v);
    svg.replaceChildren();
    const heat = mode === "heat";
    const xr = heat ? [20, 50] : [-45, 10], yr = heat ? [20, 75] : [-75, 10];
    const f = frame(svg, {
      box: [52, 16, 560, 260], x: xr, y: yr,
      xticks: heat ? [20, 25, 30, 35, 40, 45, 50] : [-40, -30, -20, -10, 0, 10],
      yticks: heat ? [20, 30, 40, 50, 60, 70] : [-70, -50, -30, -10, 10],
      xfmt: (x) => `${num(x, 0)}°`, yfmt: (y) => `${num(y, 0)}°`,
      xlabel: "air temperature (°C)", ylabel: heat ? "heat index (°C)" : "wind chill (°C)",
    });
    // Where the index is not defined.
    const bad = heat ? [20, 26.7] : [10, 10];
    if (heat) {
      el("rect", { x: f.sx(bad[0]), y: f.T, width: f.sx(bad[1]) - f.sx(bad[0]), height: f.H, style: "fill:currentColor;fill-opacity:0.05" }, svg);
      text(svg, f.sx(23.35), f.sy(24), "not defined", { "text-anchor": "middle" });
    }
    // Danger bands for heat (NWS), frostbite bands for cold (MSC).
    const bands = heat
      ? [[32.2, 39.4, 0.05], [39.4, 51.7, 0.09], [51.7, 75, 0.14]]
      : [[-28, -40, 0.05], [-40, -48, 0.09], [-48, -75, 0.14]];
    for (const [a, b, op] of bands) {
      const y0 = f.sy(Math.max(a, b)), y1 = f.sy(Math.min(a, b));
      el("rect", { x: f.L, y: Math.max(f.T, y0), width: f.W, height: Math.min(f.T + f.H, y1) - Math.max(f.T, y0), style: `fill:var(--code-del);fill-opacity:${op}` }, svg);
    }
    text(svg, f.L + f.W - 4, (heat ? f.sy(53) : f.sy(-52)) + 3, heat ? "extreme danger" : "frostbite < 5 min", { "text-anchor": "end" });
    // y = x reference.
    const lo = Math.max(xr[0], yr[0]), hiR = Math.min(xr[1], yr[1]);
    el("line", { x1: f.sx(lo), y1: f.sy(lo), x2: f.sx(hiR), y2: f.sy(hiR), style: "stroke:var(--muted-foreground);stroke-dasharray:4 3" }, svg);
    // A family of curves, the current one in the accent.
    const family = heat ? [20, 40, 60, 80, 100] : [10, 20, 40, 60, 80];
    for (const k of family) {
      const pts = [];
      for (let x = heat ? 26.7 : xr[0]; x <= (heat ? xr[1] : 10) + 1e-9; x += 0.25) {
        const y = heat ? heatIndexC(x, k) : windChillC(x, k);
        if (y > yr[1] || y < yr[0]) continue;
        pts.push([f.sx(x), f.sy(y)]);
      }
      polyline(svg, pts, "stroke:currentColor;stroke-opacity:0.18;stroke-width:1");
      const end = pts[pts.length - 1];
      if (end) text(svg, end[0] + 3, end[1] + 3, heat ? `${k}%` : `${k}`, { "text-anchor": "start", class: "fill-muted-foreground font-mono text-[9px]" });
    }
    const cur = [];
    for (let x = heat ? 26.7 : xr[0]; x <= (heat ? xr[1] : 10) + 1e-9; x += 0.1) {
      const y = heat ? heatIndexC(x, rh) : windChillC(x, v);
      if (y > yr[1] || y < yr[0]) continue;
      cur.push([f.sx(x), f.sy(y)]);
    }
    polyline(svg, cur, "stroke:var(--brand);stroke-width:2");
    const ok = heat ? heatOk : coldOk;
    const yv = heat ? hi : wc;
    if (t >= xr[0] && t <= xr[1] && yv >= yr[0] && yv <= yr[1]) {
      el("circle", { cx: f.sx(t), cy: f.sy(yv), r: 5, style: ok ? "fill:var(--brand)" : "fill:var(--background);stroke:var(--muted-foreground);stroke-width:1.5" }, svg);
      text(svg, f.sx(t) + 8, f.sy(yv) - 8, ok ? `feels ${num(yv, 1)}°` : "outside the range", { class: "fill-foreground font-mono text-[11px]" });
    }
    text(svg, f.L + f.W - 4, f.T + f.H - 6, heat ? "curves: relative humidity" : "curves: wind (km/h)", { "text-anchor": "end" });

    o.hi.textContent = heatOk ? `${num(hi, 1)} °C` : "— (needs ≥ 26.7 °C)";
    o.wc.textContent = coldOk ? `${num(wc, 1)} °C` : t > 10 ? "— (needs ≤ 10 °C)" : "— (needs wind > 4.8 km/h)";
    o.td.textContent = `${num(dewPoint(t, rh), 1)} °C`;
    o.cat.textContent = heat ? (heatOk ? heatCat(hi) : "—") : coldOk ? chillCat(wc) : "—";
    o.valid.textContent = ok ? "yes" : "no: outside the index's range";
  }
  draw();
}

// ============================================================ Geostrophic wind

for (const root of document.querySelectorAll("[data-wx-geo]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const RHO = 1.2;
  let path = [], tMax = 0, t = 0, setup = null;
  const s = scrubAll(root, () => { compute(); t = still.matches ? tMax : 0; play.set(false); draw(); });
  const play = playButton(root, ["Release", "Pause"], (on) => {
    if (on) {
      if (t >= tMax) t = 0;
      if (still.matches) { t = tMax; draw(); play.set(false); return; }
      run();
    }
  });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { t = 0; play.set(false); draw(); });
  const run = loop(root, (dt) => {
    if (!play.get()) return false;
    t = Math.min(tMax, t + (tMax / 10) * dt); // the whole run in 10 s
    draw();
    if (t >= tMax) { play.set(false); return false; }
    return true;
  });

  function compute() {
    const lat = s.lat.get(), dxKm = s.dx.get(), k = s.k.get() / 3600;
    const f = 2 * OMEGA * Math.sin(lat * RAD);
    const G = 400 / (RHO * dxKm * 1000); // m/s², toward low pressure (+y)
    const fa = Math.max(Math.abs(f), 1e-6);
    const period = (2 * Math.PI) / fa;
    tMax = Math.min(2 * period, 72 * 3600);
    // RK4 on (x, y, u, v), SI units, 60 s steps.
    const rhs = ([, , u, v]) => [u, v, f * v - k * u, G - f * u - k * v];
    let st = [0, 0, 0, 0];
    path = [{ t: 0, x: 0, y: 0, u: 0, v: 0 }];
    const h = 60;
    for (let tt = 0; tt < tMax; tt += h) {
      const k1 = rhs(st);
      const k2 = rhs(st.map((v, i) => v + (h / 2) * k1[i]));
      const k3 = rhs(st.map((v, i) => v + (h / 2) * k2[i]));
      const k4 = rhs(st.map((v, i) => v + h * k3[i]));
      st = st.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      path.push({ t: tt + h, x: st[0], y: st[1], u: st[2], v: st[3] });
    }
    setup = { lat, dxKm, k, f, G, period };
  }

  function draw() {
    const { lat, dxKm, k, f, G, period } = setup;
    const i = Math.min(path.length - 1, Math.round(t / 60));
    const now = path[i];
    svg.replaceChildren();
    // Fit the whole track (km), equal aspect.
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    for (const p of path) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    x0 /= 1000; x1 /= 1000; y0 /= 1000; y1 /= 1000;
    const pad = 40, Wd = 640 - 2 * pad, Hd = 360 - 2 * pad - 10;
    const span = Math.max((x1 - x0) / Wd, (y1 - y0) / Hd, dxKm / 120);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const X = (km) => 320 + (km - cx) / span, Y = (km) => 175 - (km - cy) / span;
    // Isobars: horizontal, 4 hPa apart, lower pressure up (+y).
    const yTop = cy + 175 * span, yBot = cy - 185 * span;
    const first = Math.floor(yBot / dxKm), last = Math.ceil(yTop / dxKm);
    for (let n = first; n <= last; n++) {
      const yy = Y(n * dxKm);
      if (yy < 0 || yy > 360) continue;
      el("line", { x1: 0, x2: 640, y1: yy, y2: yy, style: "stroke:currentColor;stroke-opacity:0.18" }, svg);
      text(svg, 636, yy - 4, `${1012 - 4 * n} hPa`, { "text-anchor": "end" });
    }
    text(svg, 8, 14, "LOW", { "text-anchor": "start", class: "fill-foreground font-mono text-[11px]" });
    text(svg, 8, 352, "HIGH", { "text-anchor": "start", class: "fill-foreground font-mono text-[11px]" });
    // Track so far, and the rest faintly.
    polyline(svg, path.map((p) => [X(p.x / 1000), Y(p.y / 1000)]), "stroke:var(--brand);stroke-opacity:0.18;stroke-width:1.25");
    polyline(svg, path.slice(0, i + 1).map((p) => [X(p.x / 1000), Y(p.y / 1000)]), "stroke:var(--brand);stroke-width:2");
    // Forces on the parcel (per unit mass), scaled to G.
    const px = X(now.x / 1000), py = Y(now.y / 1000);
    const sc = 46 / G;
    const arrow = (fx, fy, color) => {
      const len = Math.hypot(fx, fy) * sc;
      if (len < 2) return;
      const ex = px + fx * sc, ey = py - fy * sc;
      const ux = (ex - px) / len, uy = (ey - py) / len;
      el("line", { x1: px, y1: py, x2: ex - ux * 6, y2: ey - uy * 6, style: `stroke:${color};stroke-width:2` }, svg);
      el("path", { d: `M${ex} ${ey}L${ex - ux * 8 - uy * 4} ${ey - uy * 8 + ux * 4}L${ex - ux * 8 + uy * 4} ${ey - uy * 8 - ux * 4}Z`, style: `fill:${color}` }, svg);
    };
    arrow(0, G, "var(--vec-u)");
    arrow(f * now.v, -f * now.u, "var(--vec-v)");
    arrow(-k * now.u, -k * now.v, "var(--code-del)");
    el("circle", { cx: px, cy: py, r: 5, style: "fill:var(--brand)" }, svg);
    // Scale bar.
    const bar = 10 ** Math.floor(Math.log10(200 * span));
    const barPx = bar / span;
    el("line", { x1: 40, x2: 40 + barPx, y1: 330, y2: 330, style: "stroke:currentColor;stroke-opacity:0.5" }, svg);
    text(svg, 40 + barPx / 2, 324, `${bar} km`, { "text-anchor": "middle" });

    const speed = Math.hypot(now.u, now.v);
    const near = Math.abs(lat) < 3;
    const vg = G / Math.abs(f);
    o.f.textContent = `${(f * 1e4).toFixed(3).replace("-", "−")} × 10⁻⁴ s⁻¹`;
    o.vg.textContent = near ? "no balance near the equator" : `${num(vg, 1)} m/s (${num(vg * 3.6, 0)} km/h)`;
    o.v.textContent = `${num(speed, 1)} m/s`;
    o.angle.textContent = speed > 0.05 ? `${num(Math.atan2(now.v, Math.abs(now.u)) / RAD, 0)}° toward low` : "—";
    o.period.textContent = near ? "—" : `${num(period / 3600, 1)} h`;
    o.time.textContent = `${num(Math.min(now.t, tMax) / 3600, 1)} h of ${num(tMax / 3600, 1)} h${k > 0 && !near ? ` · steady angle ${num(Math.atan(k / Math.abs(f)) / RAD, 0)}°` : ""}`;
  }
  compute();
  t = still.matches ? tMax : 0;
  draw();
}

// ============================================================ Station model

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const OKTA_NAMES = ["clear", "1 okta: few", "2 oktas: few", "3 oktas: scattered", "4 oktas: scattered", "5 oktas: broken", "6 oktas: broken", "7 oktas: broken", "8 oktas: overcast"];
export const pressureCode = (p) => String(Math.round(p * 10) % 1000).padStart(3, "0");
export const decodePressure = (code) => (Number(code) >= 500 ? 900 : 1000) + Number(code) / 10;
export function barbsOf(kt) {
  let r = Math.round(kt / 5) * 5;
  const pennants = Math.floor(r / 50); r -= pennants * 50;
  const full = Math.floor(r / 10); r -= full * 10;
  return { pennants, full, half: r >= 5 ? 1 : 0 };
}

for (const root of document.querySelectorAll("[data-wx-station]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let quiz = false, revealed = false;
  const s = scrubAll(root, () => { revealed = false; draw(); });
  root.querySelector("[data-toggle]")?.addEventListener("shadcn:checked-change", (e) => { quiz = e.detail.checked; revealed = false; draw(); });
  root.querySelector('[data-action="reveal"]').addEventListener("click", () => { revealed = true; draw(); });
  root.querySelector('[data-action="random"]').addEventListener("click", () => {
    const r = (a, b, step) => a + Math.round((Math.random() * (b - a)) / step) * step;
    const t = r(-15, 32, 1);
    s.t.set(t, false);
    s.td.set(t - r(0, 14, 1), false);
    s.p.set(Math.round((985 + Math.random() * 45) * 10) / 10, false);
    s.tend.set(Math.round((Math.random() * 8 - 4) * 10) / 10, false);
    s.dir.set(r(0, 350, 10), false);
    s.kt.set(r(0, 75, 5), false);
    s.okta.set(r(0, 8, 1), false);
    revealed = false;
    draw();
  });

  function draw() {
    const t = Math.round(s.t.get()), td = Math.min(Math.round(s.td.get()), t), p = s.p.get(), tend = s.tend.get();
    const dir = s.dir.get() % 360, kt = s.kt.get(), okta = Math.round(s.okta.get());
    svg.replaceChildren();
    const cx = 180, cy = 108, R = 12, Z = 1.35; // the glyph at several times its chart size
    const ink = "var(--foreground)";
    // Cloud cover.
    const g = el("g", {}, svg);
    el("circle", { cx, cy, r: R, style: `fill:var(--background);stroke:${ink};stroke-width:1.6` }, g);
    const sector = (a0, a1) => {
      // Angles clockwise from north.
      const p0 = [cx + R * Math.sin(a0 * RAD), cy - R * Math.cos(a0 * RAD)], p1 = [cx + R * Math.sin(a1 * RAD), cy - R * Math.cos(a1 * RAD)];
      el("path", { d: `M${cx} ${cy}L${p0[0]} ${p0[1]}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1[0]} ${p1[1]}Z`, style: `fill:${ink}` }, g);
    };
    const vline = (y0, y1) => el("line", { x1: cx, x2: cx, y1: y0, y2: y1, style: `stroke:${ink};stroke-width:2.5` }, g);
    if (okta === 1) vline(cy - R, cy + R);
    if (okta >= 2 && okta <= 3) sector(0, 90);
    if (okta === 3) vline(cy, cy + R);
    if (okta >= 4 && okta <= 5) sector(0, 180);
    if (okta === 5) el("line", { x1: cx - R, x2: cx, y1: cy, y2: cy, style: `stroke:${ink};stroke-width:2.5` }, g);
    if (okta === 6) sector(0, 270);
    if (okta >= 7) el("circle", { cx, cy, r: R, style: `fill:${ink}` }, g);
    if (okta === 7) el("rect", { x: cx - 2.5, y: cy - R + 1, width: 5, height: 2 * R - 2, style: "fill:var(--background)" }, g);
    // Wind: the shaft points to where the wind comes from.
    const knots = Math.round(kt / 5) * 5;
    if (knots < 5) {
      el("circle", { cx, cy, r: R + 6, style: `fill:none;stroke:${ink};stroke-width:1.5` }, g);
    } else {
      const ux = Math.sin(dir * RAD), uy = -Math.cos(dir * RAD);
      const L = 34 * Z;
      const tip = [cx + ux * (R + L), cy + uy * (R + L)];
      el("line", { x1: cx + ux * R, y1: cy + uy * R, x2: tip[0], y2: tip[1], style: `stroke:${ink};stroke-width:2` }, g);
      // Barbs on the clockwise side of the shaft, sloping outward.
      const nx = -uy, ny = ux; // rotated 90° clockwise on screen
      const { pennants, full, half } = barbsOf(kt);
      let d = 0;
      const step = 4.5 * Z, len = 11 * Z;
      const at = (dd) => [tip[0] - ux * dd, tip[1] - uy * dd];
      for (let n = 0; n < pennants; n++) {
        const a = at(d), b = at(d + step * 1.6);
        el("path", { d: `M${a[0]} ${a[1]}L${a[0] + nx * len + ux * 0} ${a[1] + ny * len}L${b[0]} ${b[1]}Z`, style: `fill:${ink}` }, g);
        d += step * 2;
      }
      for (let n = 0; n < full; n++) {
        const a = at(d);
        el("line", { x1: a[0], y1: a[1], x2: a[0] + nx * len + ux * len * 0.45, y2: a[1] + ny * len + uy * len * 0.45, style: `stroke:${ink};stroke-width:2` }, g);
        d += step;
      }
      if (half) {
        if (pennants + full === 0) d += step; // a lone half barb sits in from the tip
        const a = at(d);
        el("line", { x1: a[0], y1: a[1], x2: a[0] + nx * len * 0.5 + ux * len * 0.22, y2: a[1] + ny * len * 0.5 + uy * len * 0.22, style: `stroke:${ink};stroke-width:2` }, g);
      }
    }
    // Numbers around the circle.
    const big = { class: "fill-foreground font-mono text-[17px]" };
    text(svg, cx - R - 8, cy - 10, String(t).replace("-", "−"), { ...big, "text-anchor": "end" });
    text(svg, cx - R - 8, cy + 24, String(td).replace("-", "−"), { ...big, "text-anchor": "end" });
    text(svg, cx + R + 8, cy - 10, pressureCode(p), { ...big, "text-anchor": "start" });
    const tcode = (tend >= 0 ? "+" : "−") + String(Math.round(Math.abs(tend) * 10)).padStart(2, "0");
    text(svg, cx + R + 8, cy + 12, tcode, { ...big, "text-anchor": "start" });
    // Tendency glyph: rising, falling or steady.
    const gx = cx + R + 50, gy = cy + 6;
    const tg = tend > 0.1 ? `M${gx} ${gy + 5}L${gx + 6} ${gy - 5}L${gx + 12} ${gy - 5}` : tend < -0.1 ? `M${gx} ${gy - 5}L${gx + 6} ${gy + 5}L${gx + 12} ${gy + 5}` : `M${gx} ${gy}L${gx + 12} ${gy}`;
    el("path", { d: tg, style: `fill:none;stroke:${ink};stroke-width:1.6` }, svg);

    const hide = quiz && !revealed;
    const q = (v) => (hide ? "?" : v);
    const fullCount = barbsOf(kt);
    o.p.textContent = q(`${pressureCode(p)} → ${num(decodePressure(pressureCode(p)), 1)} hPa`);
    o.tend.textContent = q(`${tcode} → ${tend > 0.1 ? `rose ${num(tend, 1)} hPa` : tend < -0.1 ? `fell ${num(-tend, 1)} hPa` : "about steady"} in 3 h`);
    o.wind.textContent = q(knots < 5 ? "calm" : `from ${num(dir, 0)}° (${COMPASS[Math.round(dir / 22.5) % 16]}) at ${knots} kn: ${[fullCount.pennants && `${fullCount.pennants} pennant${fullCount.pennants > 1 ? "s" : ""}`, fullCount.full && `${fullCount.full} full`, fullCount.half && "1 half"].filter(Boolean).join(" + ")}`);
    o.cover.textContent = q(OKTA_NAMES[okta]);
    o.spread.textContent = q(`T − Td = ${t - td} °C${t - td <= 2 ? " · near saturation, fog or cloud likely" : ""}`);
  }
  draw();
}

// ============================================================ Clouds

const CLOUD_LEVEL = { Ci: "high", Cc: "high", Cs: "high", Ac: "middle", As: "middle", Ns: "middle", Sc: "low", St: "low", Cu: "vertical", Cb: "vertical" };

for (const root of document.querySelectorAll("[data-wx-clouds]")) {
  const deck = root.querySelector("[data-deck]");
  const cards = [...root.querySelectorAll("[data-cloud]")];
  const levels = [...root.querySelectorAll("[data-level]")];
  const score = root.querySelector('[data-out="score"]');
  let armed = null;
  const placed = () => cards.filter((c) => c.parentElement !== deck).length;
  const clearMarks = () => cards.forEach((c) => { delete c.dataset.right; delete c.dataset.wrong; });
  const arm = (card) => {
    armed = card;
    cards.forEach((c) => c.setAttribute("aria-pressed", String(c === card)));
    levels.forEach((l) => l.toggleAttribute("data-armed", !!card));
  };
  const update = () => (score.textContent = `${placed()} of 10 placed`);
  for (const card of cards) {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      arm(armed === card ? null : card);
    });
  }
  for (const level of levels) {
    level.addEventListener("click", () => {
      if (!armed) return;
      clearMarks();
      level.querySelector("[data-slot]").append(armed);
      const moved = armed;
      arm(null);
      moved.focus();
      update();
    });
  }
  root.querySelector('[data-action="check"]').addEventListener("click", () => {
    let right = 0;
    for (const c of cards) {
      const lv = c.closest("[data-level]");
      delete c.dataset.right;
      delete c.dataset.wrong;
      if (!lv) continue;
      if (lv.dataset.level === CLOUD_LEVEL[c.dataset.cloud]) { c.dataset.right = ""; right++; } else c.dataset.wrong = "";
    }
    score.textContent = `${right} of 10 right${placed() < 10 ? ` · ${10 - placed()} still in the deck` : right === 10 ? " · all sorted" : ""}`;
  });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => {
    clearMarks();
    arm(null);
    cards.forEach((c) => deck.append(c));
    update();
  });
}

// ============================================================ Radar

const RADAR_BINS = [
  [10, "--ion-ca"], [20, "--vec-u"], [30, "--code-add"], [40, "--vec-out"], [50, "--ion-na"], [55, "--code-del"], [65, "--vec-v"],
];
const zOfDbz = (dbz) => 10 ** (dbz / 10);
const ZR = { mp: [200, 1.6], conv: [300, 1.4] };
export const rainOfDbz = (dbz, law = "mp") => (zOfDbz(dbz) / ZR[law][0]) ** (1 / ZR[law][1]);

for (const root of document.querySelectorAll("[data-wx-radar]")) {
  const canvas = root.querySelector("[data-canvas]");
  const svg = root.querySelector("[data-plot]");
  const scaleEl = root.querySelector("[data-scale]");
  const o = outs(root);
  const ctx = canvas.getContext("2d");
  let law = "mp", time = 0, gauge = 0, cursor = null, cells = [];
  const RANGE = 150; // km
  const GAUGE = [45, -10];
  const SPEED = 40; // km/h eastward
  const s = scrubAll(root, readouts);
  onSeg(root, (_, v) => { law = v; gauge = recount(); render(); readouts(); });

  // The legend: one swatch per bin.
  for (const [dbz, v] of RADAR_BINS) {
    const sw = document.createElement("span");
    sw.className = "flex flex-1 flex-col items-center gap-0.5";
    const bar = document.createElement("span");
    bar.className = "h-2 w-full rounded-sm";
    bar.style.background = `var(${v})`;
    sw.append(bar, `${dbz}`);
    scaleEl.append(sw);
  }
  scaleEl.append(Object.assign(document.createElement("span"), { textContent: "dBZ", className: "pl-1" }));

  function newStorm() {
    const r = Math.random;
    cells = [
      { x: -110 + r() * 40, y: -40 + r() * 80, s: 14 + r() * 6, dbz: 52 + r() * 8 },
      { x: -150 + r() * 40, y: -60 + r() * 120, s: 10 + r() * 6, dbz: 44 + r() * 8 },
      { x: -125 + r() * 30, y: -20 + r() * 40, s: 30 + r() * 8, dbz: 28 + r() * 4, flat: true },
    ];
    time = 0;
    gauge = 0;
  }
  // Reflectivity (dBZ) at (x, y) km at time t (h): the cells drift east.
  const dbzAt = (x, y, t) => {
    let z = 0;
    for (const c of cells) {
      const dx = x - (c.x + SPEED * t), dy = y - c.y;
      const q = (dx * dx) / (c.flat ? 2.2 : 1) + dy * dy;
      z += zOfDbz(c.dbz) * Math.exp(-q / (2 * c.s * c.s));
    }
    return z > 1 ? 10 * Math.log10(z) : -10;
  };
  // Gauge total by integrating the rate from 0 to the current time.
  const recount = () => {
    let sum = 0;
    const dt = 1 / 60;
    for (let t = 0; t < time; t += dt) {
      const d = dbzAt(GAUGE[0], GAUGE[1], t);
      if (d >= 10) sum += rainOfDbz(d, law) * Math.min(dt, time - t);
    }
    return sum;
  };

  let colors = [];
  const readColors = () => {
    const cs = getComputedStyle(root);
    colors = RADAR_BINS.map(([, v]) => cs.getPropertyValue(v).trim());
  };
  new MutationObserver(() => { readColors(); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const N = 120;
  function render() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || 400;
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr); }
    const w = canvas.width, cell = w / N;
    ctx.clearRect(0, 0, w, w);
    const groups = RADAR_BINS.map(() => []);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = ((i + 0.5) / N) * 2 * RANGE - RANGE, y = RANGE - ((j + 0.5) / N) * 2 * RANGE;
        if (x * x + y * y > RANGE * RANGE) continue;
        const d = dbzAt(x, y, time);
        let b = -1;
        for (let k = 0; k < RADAR_BINS.length; k++) if (d >= RADAR_BINS[k][0]) b = k;
        if (b >= 0) groups[b].push(i, j);
      }
    }
    groups.forEach((g, b) => {
      ctx.fillStyle = colors[b] || "#888";
      ctx.globalAlpha = 0.85;
      for (let n = 0; n < g.length; n += 2) ctx.fillRect(g[n] * cell, g[n + 1] * cell, cell + 0.5, cell + 0.5);
    });
    ctx.globalAlpha = 1;
    overlay();
  }

  const P = (x, y) => [200 + (x / RANGE) * 200, 200 - (y / RANGE) * 200];
  function overlay() {
    svg.replaceChildren();
    for (const r of [50, 100, 150]) {
      el("circle", { cx: 200, cy: 200, r: (r / RANGE) * 200 - (r === 150 ? 0.5 : 0), style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, svg);
      text(svg, 200 + 3, 200 - (r / RANGE) * 200 + 11, `${r} km`, { "text-anchor": "start" });
    }
    el("line", { x1: 0, x2: 400, y1: 200, y2: 200, style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
    el("line", { y1: 0, y2: 400, x1: 200, x2: 200, style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
    el("circle", { cx: 200, cy: 200, r: 3, style: "fill:var(--foreground)" }, svg);
    const [gx, gy] = P(...GAUGE);
    el("rect", { x: gx - 4, y: gy - 4, width: 8, height: 8, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    text(svg, gx + 7, gy + 3, "gauge", { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    if (cursor) {
      const [x, y] = P(cursor[0], cursor[1]);
      el("circle", { cx: x, cy: y, r: 6, style: "fill:none;stroke:var(--brand);stroke-width:2" }, svg);
    }
    el("path", { d: "M200 6L196 16L204 16Z", style: "fill:var(--muted-foreground)" }, svg);
  }

  function readouts() {
    const dbz = s.dbz.get();
    const z = zOfDbz(dbz), r = rainOfDbz(dbz, law);
    o.z.textContent = `${z >= 1e4 ? z.toExponential(2).replace("e+", " × 10^") : num(z, 0)} mm⁶/m³`;
    o.r.textContent = `${r < 0.1 ? r.toFixed(3) : num(r, r < 10 ? 2 : 1)} mm/h${r < 2.5 ? " · light" : r < 10 ? " · moderate" : r < 50 ? " · heavy" : " · violent"}`;
    if (cursor) {
      const d = dbzAt(cursor[0], cursor[1], time);
      const rr = d >= 10 ? rainOfDbz(d, law) : 0;
      o.cursor.textContent = d >= 10 ? `${num(d, 0)} dBZ · ${num(rr, 1)} mm/h` : "no echo";
    } else o.cursor.textContent = "point at the scan";
    o.gauge.textContent = `${num(gauge, 1)} mm`;
    const mins = Math.round(time * 60);
    o.time.textContent = `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")} min`;
  }

  const toKm = (e) => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 * RANGE - RANGE, RANGE - ((e.clientY - r.top) / r.height) * 2 * RANGE];
  };
  svg.addEventListener("pointermove", (e) => {
    const k = toKm(e);
    cursor = k[0] ** 2 + k[1] ** 2 <= RANGE * RANGE ? k : null;
    overlay();
    readouts();
  });
  svg.addEventListener("pointerleave", () => { cursor = null; overlay(); readouts(); });
  root.querySelector('[data-action="storm"]').addEventListener("click", () => { newStorm(); render(); readouts(); });

  const play = playButton(root, ["Drift", "Pause"], (on) => {
    if (!on) return;
    if (still.matches) {
      // No animation: jump an hour ahead.
      time += 1;
      gauge = recount();
      render();
      readouts();
      play.set(false);
      return;
    }
    run();
  });
  let acc = 0;
  const run = loop(root, (dt) => {
    if (!play.get()) return false;
    const dh = (dt * 600) / 3600; // 600× real time
    const d = dbzAt(GAUGE[0], GAUGE[1], time);
    if (d >= 10) gauge += rainOfDbz(d, law) * dh;
    time += dh;
    acc += dt;
    if (acc > 0.05) { acc = 0; render(); readouts(); }
    if (time > 8) { play.set(false); return false; }
    return true;
  });

  readColors();
  newStorm();
  // Start with the storm about to reach the gauge.
  time = 2.5;
  gauge = recount();
  render();
  readouts();
  new ResizeObserver(() => render()).observe(canvas);
}

// ============================================================ CFL

const CFL_N = 100;
function cflInit(shape) {
  const q = new Float64Array(CFL_N);
  for (let i = 0; i < CFL_N; i++) q[i] = shape === "step" ? (i >= 15 && i < 35 ? 1 : 0) : Math.exp(-(((i - 25) / 5) ** 2));
  return q;
}
function cflStep(q, C, scheme) {
  const n = q.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = q[(i - 1 + n) % n], b = q[i], c = q[(i + 1) % n];
    if (scheme === "upwind") out[i] = b - C * (b - a);
    else if (scheme === "lw") out[i] = b - (C / 2) * (c - a) + ((C * C) / 2) * (c - 2 * b + a);
    else out[i] = b - (C / 2) * (c - a);
  }
  return out;
}
export function amplification(C, scheme) {
  let worst = 0;
  for (let m = 1; m <= CFL_N / 2; m++) {
    const th = (2 * Math.PI * m) / CFL_N, cs = 1 - Math.cos(th);
    const g2 = scheme === "upwind" ? 1 - 2 * C * (1 - C) * cs : scheme === "lw" ? 1 - C * C * (1 - C * C) * cs * cs : 1 + C * C * Math.sin(th) ** 2;
    worst = Math.max(worst, Math.sqrt(Math.max(0, g2)));
  }
  return worst;
}

for (const root of document.querySelectorAll("[data-wx-cfl]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let scheme = "upwind", shape = "bump", q, n = 0, total = 0, blew = false;
  const s = scrubAll(root, () => { restart(true); });
  onSeg(root, (label, v) => {
    if (label === "Scheme") scheme = v;
    else shape = v;
    restart(true);
  });
  const play = playButton(root, ["Run", "Pause"], (on) => {
    if (!on) return;
    if (n >= total || blew) restart(false);
    if (still.matches) { advance(total); draw(); play.set(false); return; }
    run();
  });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { play.set(false); restart(false); });

  function restart(toEnd) {
    const C = s.c.get();
    total = Math.max(1, Math.round((s.turns.get() * CFL_N) / C));
    q = cflInit(shape);
    n = 0;
    blew = false;
    if (toEnd) { play.set(false); advance(total); }
    draw();
  }
  function advance(to) {
    const C = s.c.get();
    while (n < to && !blew) {
      q = cflStep(q, C, scheme);
      n++;
      if (!q.every(Number.isFinite) || q.some((v) => Math.abs(v) > 1e6)) blew = true;
    }
  }
  const run = loop(root, (dt) => {
    if (!play.get()) return false;
    const perSec = Math.max(20, total / 6); // about six seconds per run
    advance(Math.min(total, n + Math.max(1, Math.round(perSec * dt))));
    draw();
    if (n >= total || blew) { play.set(false); return false; }
    return true;
  });

  function draw() {
    const C = s.c.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 576, 250], x: [0, CFL_N], y: [-0.6, 1.6], xticks: [0, 25, 50, 75, 100], yticks: [-0.5, 0, 0.5, 1, 1.5], xfmt: String, yfmt: (v) => num(v, 1), xlabel: "grid cell" });
    const shift = (n * C) % CFL_N;
    const exact = cflInit(shape);
    const ex = [];
    for (let i = 0; i <= CFL_N * 4; i++) {
      const xx = i / 4;
      let src = xx - shift;
      src = ((src % CFL_N) + CFL_N) % CFL_N;
      const v = shape === "step" ? (src >= 14.5 && src < 34.5 ? 1 : 0) : Math.exp(-(((src - 25) / 5) ** 2));
      ex.push([f.sx(xx), f.sy(v)]);
    }
    polyline(svg, ex, "stroke:var(--muted-foreground);stroke-width:1.25;stroke-dasharray:4 3");
    const clipped = [...q].map((v, i) => [f.sx(i), f.sy(clamp(Number.isFinite(v) ? v : 0, -0.6, 1.6))]);
    polyline(svg, clipped, "stroke:var(--brand);stroke-width:2");
    for (let i = 0; i < CFL_N; i += 1) el("circle", { cx: f.sx(i), cy: f.sy(clamp(Number.isFinite(q[i]) ? q[i] : 0, -0.6, 1.6)), r: 1.4, style: "fill:var(--brand)" }, svg);
    // How far one step reaches: C cells, against the stencil's one cell.
    const cw = 26, sx0 = f.L + f.W - 3 * cw - 150, sy0 = f.T + 4;
    for (let i = 0; i < 3; i++) el("rect", { x: sx0 + i * cw, y: sy0, width: cw, height: 14, style: `fill:currentColor;fill-opacity:${i === 1 ? 0.1 : 0.04};stroke:currentColor;stroke-opacity:0.25` }, svg);
    const ax0 = sx0 + cw * 0.5, ax1 = ax0 + cw * C;
    el("line", { x1: ax0, x2: ax1, y1: sy0 + 7, y2: sy0 + 7, style: `stroke:${C > 1 ? "var(--code-del)" : "var(--code-add)"};stroke-width:2.5` }, svg);
    el("circle", { cx: ax1, cy: sy0 + 7, r: 3, style: `fill:${C > 1 ? "var(--code-del)" : "var(--code-add)"}` }, svg);
    text(svg, sx0 + 3 * cw + 8, sy0 + 11, `one step: ${num(C, 2)} cells`, { "text-anchor": "start" });
    const G = amplification(C, scheme);
    let err = 0;
    for (let i = 0; i < CFL_N; i++) {
      let src = ((i - shift) % CFL_N + CFL_N) % CFL_N;
      const v = shape === "step" ? (src >= 14.5 && src < 34.5 ? 1 : 0) : Math.exp(-(((src - 25) / 5) ** 2));
      err += (q[i] - v) ** 2;
    }
    void exact;
    o.steps.textContent = `${n} of ${total}`;
    const peak = Math.max(...q.map(Math.abs));
    o.peak.textContent = blew || !Number.isFinite(peak) ? "∞ · blew up" : num(peak, 3);
    o.err.textContent = blew ? "—" : num(Math.sqrt(err / CFL_N), 3);
    o.amp.textContent = `|G| = ${num(G, 4)} per step`;
    o.verdict.textContent = G <= 1 + 1e-12 ? (scheme === "upwind" ? "stable, but smears" : "stable") : `unstable: the worst wave grows ×${total * Math.log10(G) > 6 ? `10^${num(total * Math.log10(G), 1)}` : num(G ** total, 1)} over the run`;
  }
  restart(true);
}

// ============================================================ Ensemble

const LZ = { s: 10, r: 28, b: 8 / 3 };
function lorenzRK4([x, y, z], h) {
  const f = ([a, b, c]) => [LZ.s * (b - a), a * (LZ.r - c) - b, a * b - LZ.b * c];
  const k1 = f([x, y, z]);
  const k2 = f([x + (h / 2) * k1[0], y + (h / 2) * k1[1], z + (h / 2) * k1[2]]);
  const k3 = f([x + (h / 2) * k2[0], y + (h / 2) * k2[1], z + (h / 2) * k2[2]]);
  const k4 = f([x + h * k3[0], y + h * k3[1], z + h * k3[2]]);
  return [x + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), z + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])];
}
const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

for (const root of document.querySelectorAll("[data-wx-ensemble]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const DT = 0.01, STEPS = 1500, EVERY = 3;
  let start = [1, 1, 1], truth = [], control = [], members = [];
  const s = scrubAll(root, (name) => (name === "lead" ? draw() : (perturb(), draw())));
  root.querySelector('[data-action="new"]').addEventListener("click", () => { newStart(); perturb(); draw(); });
  root.querySelector('[data-action="rerun"]').addEventListener("click", () => { perturb(); draw(); });

  const run = (p) => {
    const out = [p[0]];
    let st = p;
    for (let i = 1; i <= STEPS; i++) {
      st = lorenzRK4(st, DT);
      if (i % EVERY === 0) out.push(st[0]);
    }
    return out;
  };
  function newStart() {
    let st = start;
    const spin = 300 + Math.floor(Math.random() * 2000);
    for (let i = 0; i < spin; i++) st = lorenzRK4(st, DT);
    start = st;
  }
  function perturb() {
    const e = s.eps.get(), n = Math.round(s.n.get());
    control = run(start);
    truth = run(start.map((v) => v + e * gauss()));
    members = [];
    for (let m = 0; m < n; m++) members.push(run(start.map((v) => v + e * gauss())));
  }

  function draw() {
    const lead = s.lead.get();
    const nPts = control.length;
    const tOf = (i) => i * DT * EVERY;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 576, 220], x: [0, 15], y: [-22, 22], xticks: [0, 3, 6, 9, 12, 15], yticks: [-20, -10, 0, 10, 20], xfmt: String, yfmt: (v) => num(v, 0), ylabel: "x" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (const m of members) polyline(svg, m.map((v, i) => [f.sx(tOf(i)), f.sy(v)]), "stroke:var(--muted-foreground);stroke-opacity:0.32;stroke-width:0.8");
    // Mean and spread.
    const mean = [], sd = [], prob = [];
    for (let i = 0; i < nPts; i++) {
      let a = 0, a2 = 0, pos = 0;
      for (const m of members) { a += m[i]; a2 += m[i] * m[i]; if (m[i] > 0) pos++; }
      const mu = a / members.length;
      mean.push(mu);
      sd.push(Math.sqrt(Math.max(0, a2 / members.length - mu * mu)));
      prob.push(pos / members.length);
    }
    polyline(svg, mean.map((v, i) => [f.sx(tOf(i)), f.sy(v)]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, control.map((v, i) => [f.sx(tOf(i)), f.sy(v)]), "stroke:var(--brand);stroke-width:1.75");
    polyline(svg, truth.map((v, i) => [f.sx(tOf(i)), f.sy(v)]), "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:5 3");
    // Probability strip.
    const g = frame(svg, { box: [44, 268, 576, 80], x: [0, 15], y: [0, 1], xticks: [0, 3, 6, 9, 12, 15], yticks: [0, 0.5, 1], xfmt: String, yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "lead time (model units)", ylabel: "P(x > 0)" });
    const area = prob.map((p, i) => [g.sx(tOf(i)), g.sy(p)]);
    el("path", { d: `M${g.sx(0)} ${g.sy(0)}L${area.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}L${g.sx(tOf(nPts - 1))} ${g.sy(0)}Z`, style: "fill:var(--vec-u);fill-opacity:0.18;stroke:none" }, svg);
    polyline(svg, area, "stroke:var(--vec-u);stroke-width:1.25");
    // The truth's sign along the bottom.
    for (let i = 0; i < nPts - 1; i++) if (truth[i] > 0) el("rect", { x: g.sx(tOf(i)), y: g.sy(0) + 2, width: g.sx(tOf(i + 1)) - g.sx(tOf(i)) + 0.3, height: 3, style: "fill:var(--foreground);fill-opacity:0.6" }, svg);
    // Usefulness horizon and the lead cursor.
    const hIdx = sd.findIndex((v) => v > 7.9 / 2);
    if (hIdx > 0) {
      const hx = f.sx(tOf(hIdx));
      el("rect", { x: hx, y: f.T, width: f.L + f.W - hx, height: f.H, style: "fill:currentColor;fill-opacity:0.04" }, svg);
      text(svg, hx + 4, f.T + 11, "spread > half the climate spread", { "text-anchor": "start" });
    }
    const li = Math.min(nPts - 1, Math.round(lead / (DT * EVERY)));
    for (const fr of [f, g]) el("line", { x1: fr.sx(lead), x2: fr.sx(lead), y1: fr.T, y2: fr.T + fr.H, style: "stroke:var(--brand);stroke-width:1;stroke-dasharray:2 2" }, svg);

    o.prob.textContent = `${Math.round(prob[li] * 100)}% of ${members.length} members`;
    o.truth.textContent = `x = ${num(truth[li], 1)} · ${truth[li] > 0 ? "positive" : "negative"}`;
    o.spread.textContent = `σ = ${num(sd[li], 2)}`;
    o.horizon.textContent = hIdx > 0 ? `lead ≈ ${num(tOf(hIdx), 1)}` : "beyond 15";
  }
  newStart();
  perturb();
  draw();
}
