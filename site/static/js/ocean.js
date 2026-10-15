// Oceanography blocks. Each block's root carries a data-ocean-* attribute;
// the module does nothing on pages without them. Models: harmonic tides
// (M2, S2, K1, O1), a linear equation of state, linear (Airy) waves, long
// waves with Green's law, Ekman's 1905 spiral, geostrophic balance on a
// Gaussian eddy, Munk's sound-speed profile with ray tracing, Beer–Lambert
// attenuation with pure-water absorption, and the carbonate system at
// 25 °C. The tide gauge figure listens for "ocean-tide" events.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import "../anatomy/ocean-gauge.js";

const G = 9.81;
const OMEGA = 7.2921e-5;
const RAD = Math.PI / 180;
const BRAND = "var(--brand)";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const fx = (v, d = 1) => num(v, d);
const svgPoint = (svg, e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};
function arrow(g, x0, y0, x1, y1, color, width = 1.6, head = 6) {
  el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style: `stroke:${color};stroke-width:${width};stroke-linecap:round` }, g);
  const a = Math.atan2(y1 - y0, x1 - x0);
  if (Math.hypot(x1 - x0, y1 - y0) < 2) return;
  el("path", { d: `M${x1} ${y1}L${x1 - head * Math.cos(a - 0.42)} ${y1 - head * Math.sin(a - 0.42)}L${x1 - head * Math.cos(a + 0.42)} ${y1 - head * Math.sin(a + 0.42)}Z`, style: `fill:${color}` }, g);
}
const duration = (s) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
};

// player wires a block's Animate button to a frame loop that runs only
// while the block is on screen and motion is allowed.
function player(root, frameFn, label = "Animate") {
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

// ============================================================ tides

// Periods in hours (solar hours), from the constituents' angular speeds.
export const TIDE = { M2: 12.4206012, S2: 12, K1: 23.9344696, O1: 25.8193417 };
const TIDE_PRESETS = {
  semi: { m2: 2.05, s2: 0.75, k1: 0.07, o1: 0.07 },
  mixed: { m2: 0.58, s2: 0.13, k1: 0.37, o1: 0.23 },
  diurnal: { m2: 0.03, s2: 0.01, k1: 0.16, o1: 0.15 },
};
const tideAt = (a, t) => a.m2 * Math.cos((2 * Math.PI * t) / TIDE.M2) + a.s2 * Math.cos((2 * Math.PI * t) / TIDE.S2) + a.k1 * Math.cos((2 * Math.PI * t) / TIDE.K1) + a.o1 * Math.cos((2 * Math.PI * t) / TIDE.O1);

for (const root of document.querySelectorAll("[data-ocean-tide]")) {
  const svg = root.querySelector("[data-plot]");
  const parts = root.querySelector("[data-parts]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const DAYS = 30;
  const BEAT = 1 / (1 / TIDE.S2 - 1 / TIDE.M2); // hours
  const LUNAR_DAY = 24.8412;
  let cursor = null;
  const amps = () => ({ m2: s.m2.get(), s2: s.s2.get(), k1: s.k1.get(), o1: s.o1.get() });

  onSeg(root, (_, v) => {
    const p = TIDE_PRESETS[v];
    for (const k in p) s[k].set(p[k], false);
    draw();
  });

  function draw() {
    const a = amps();
    const total = a.m2 + a.s2 + a.k1 + a.o1;
    const lim = Math.max(0.5, Math.ceil(total * 2) / 2);
    svg.replaceChildren();
    const f = frame(svg, {
      box: [44, 46, 580, 250], x: [0, DAYS], y: [-lim, lim],
      xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [-lim, -lim / 2, 0, lim / 2, lim],
      yfmt: (v) => num(v, 1), xlabel: "days", ylabel: "level (m)",
    });
    // Moon phases along the top: new at day 0, synodic month 29.53 d.
    const SYN = 29.530589;
    ["new", "first quarter", "full", "last quarter", "new"].forEach((name, i) => {
      const d = (i * SYN) / 4;
      if (d > DAYS) return;
      const x = f.sx(d), y = 14;
      const c = el("circle", { cx: x, cy: y, r: 5, style: "stroke:currentColor;stroke-opacity:.6;fill:" + (name === "full" ? "currentColor" : "var(--background)") }, svg);
      void c;
      if (name.includes("quarter")) el("path", { d: `M${x} ${y - 5}A5 5 0 0 ${name === "first quarter" ? 1 : 0} ${x} ${y + 5}Z`, style: "fill:currentColor;fill-opacity:.85" }, svg);
      text(svg, x + 8, y + 3, name, { "text-anchor": "start" });
    });
    // Spring–neap envelope of the semidiurnal pair.
    const env = [], envLow = [];
    for (let t = 0; t <= DAYS * 24; t += 1) {
      const e = Math.sqrt(a.m2 ** 2 + a.s2 ** 2 + 2 * a.m2 * a.s2 * Math.cos(2 * Math.PI * t * (1 / TIDE.S2 - 1 / TIDE.M2)));
      env.push([f.sx(t / 24), f.sy(e)]);
      envLow.push([f.sx(t / 24), f.sy(-e)]);
    }
    polyline(f.g, env, `stroke:${BRAND};stroke-width:1.2;stroke-dasharray:4 3`);
    polyline(f.g, envLow, `stroke:${BRAND};stroke-width:1.2;stroke-dasharray:4 3`);
    const pts = [];
    for (let t = 0; t <= DAYS * 24; t += 0.25) pts.push([f.sx(t / 24), f.sy(tideAt(a, t))]);
    polyline(f.g, pts, "stroke:var(--vec-u);stroke-width:1.1");
    hline(f.g, f, 0, "stroke:currentColor;stroke-opacity:.25");

    // Daily ranges over each lunar day: the largest is the spring range.
    let spring = 0, neap = Infinity;
    for (let t0 = 0; t0 + LUNAR_DAY <= DAYS * 24; t0 += LUNAR_DAY / 4) {
      let hi = -Infinity, lo = Infinity;
      for (let t = t0; t <= t0 + LUNAR_DAY; t += 0.1) { const v = tideAt(a, t); hi = Math.max(hi, v); lo = Math.min(lo, v); }
      spring = Math.max(spring, hi - lo);
      neap = Math.min(neap, hi - lo);
    }
    if (cursor !== null) {
      const t = cursor * 24, v = tideAt(a, t);
      el("line", { x1: f.sx(cursor), x2: f.sx(cursor), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.35" }, svg);
      el("circle", { cx: f.sx(cursor), cy: f.sy(v), r: 3.5, style: `fill:${BRAND}` }, svg);
      o.cursor.textContent = `day ${num(cursor, 2)}: ${v >= 0 ? "+" : ""}${num(v, 2)} m`;
    } else o.cursor.textContent = "hover the chart";

    // Each constituent alone over the first two days.
    parts.replaceChildren();
    const lim2 = Math.max(0.1, Math.max(a.m2, a.s2, a.k1, a.o1));
    const pf = frame(parts, { box: [44, 12, 580, 110], x: [0, 48], y: [-lim2, lim2], xticks: [0, 12, 24, 36, 48], yticks: [0], xfmt: (v) => `${v} h`, yfmt: () => "0" });
    const colors = { m2: "var(--vec-u)", s2: "var(--vec-out)", k1: "var(--vec-v)", o1: "var(--ion-cl)" };
    for (const k of ["m2", "s2", "k1", "o1"]) {
      const T = TIDE[k.toUpperCase()], p = [];
      for (let t = 0; t <= 48; t += 0.2) p.push([pf.sx(t), pf.sy(a[k] * Math.cos((2 * Math.PI * t) / T))]);
      polyline(pf.g, p, `stroke:${colors[k]};stroke-width:1.2;stroke-opacity:.9`);
    }
    let lx = 52;
    for (const k of ["m2", "s2", "k1", "o1"]) {
      el("line", { x1: lx, x2: lx + 12, y1: 145, y2: 145, style: `stroke:${colors[k]};stroke-width:2` }, parts);
      text(parts, lx + 16, 148, `${k.toUpperCase()} ${num(TIDE[k.toUpperCase()], 2)} h`, { "text-anchor": "start" });
      lx += 120;
    }

    const F = (a.k1 + a.o1) / Math.max(1e-9, a.m2 + a.s2);
    o.f.textContent = Number.isFinite(F) && a.m2 + a.s2 > 0 ? num(F, 2) : "∞";
    o.type.textContent = F < 0.25 ? "semidiurnal" : F < 1.5 ? "mixed, mainly semidiurnal" : F <= 3 ? "mixed, mainly diurnal" : "diurnal";
    o.spring.textContent = `${num(spring, 2)} m`;
    o.neap.textContent = `${num(neap, 2)} m`;
    o.beat.textContent = `${num(BEAT / 24, 2)} days`;
    document.dispatchEvent(new CustomEvent("ocean-tide", { detail: a }));
  }
  svg.addEventListener("pointermove", (e) => {
    const p = svgPoint(svg, e);
    const d = ((p.x - 44) / 580) * DAYS;
    cursor = d >= 0 && d <= DAYS ? d : null;
    draw();
  });
  svg.addEventListener("pointerleave", () => { cursor = null; draw(); });
  draw();
  // The figure may mount after this module: send the state once more.
  requestAnimationFrame(() => draw());
}

// ============================================================ water column

const RHO0 = 1027, ALPHA = 2.0e-4, BETA = 7.6e-4;
const sigma = (T, S) => RHO0 * (1 - ALPHA * (T - 10) + BETA * (S - 35)) - 1000;
const PROFILE_PRESETS = {
  mid: { sst: 18, deept: 4, sss: 35.2, deeps: 34.9, mld: 30, thick: 120 },
  tropic: { sst: 28, deept: 4.5, sss: 35.6, deeps: 34.7, mld: 60, thick: 180 },
  polar: { sst: -1.5, deept: 0.8, sss: 32, deeps: 34.9, mld: 20, thick: 150 },
};

for (const root of document.querySelectorAll("[data-ocean-profile]")) {
  const svgP = root.querySelector("[data-profile]");
  const svgT = root.querySelector("[data-ts]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let ZMAX = 400;
  let hover = null;
  onSeg(root, (_, v) => {
    const p = PROFILE_PRESETS[v];
    for (const k in p) s[k].set(p[k], false);
    draw();
  });
  const shape = (z, mld, thick) => (z <= mld ? 1 : Math.exp((-3 * (z - mld)) / thick));
  function columnAt(z) {
    // Thermocline and halocline share one shape, so σ is monotonic
    // whenever the two end members are stably stacked.
    const k = shape(z, s.mld.get(), s.thick.get());
    const T = s.deept.get() + (s.sst.get() - s.deept.get()) * k;
    const S = s.deeps.get() + (s.sss.get() - s.deeps.get()) * k;
    return { T, S, sig: sigma(T, S) };
  }
  function draw() {
    ZMAX = Math.max(300, Math.ceil((s.mld.get() + 2.6 * s.thick.get()) / 100) * 100);
    const zs = [];
    for (let z = 0; z <= ZMAX; z += ZMAX / 200) zs.push(z);
    const col = zs.map((z) => ({ z, ...columnAt(z) }));
    const Ts = col.map((c) => c.T), Ss = col.map((c) => c.S), sigs = col.map((c) => c.sig);
    const span = (arr, pad, minSpan) => {
      let lo = Math.min(...arr), hi = Math.max(...arr);
      if (hi - lo < minSpan) { const m = (hi + lo) / 2; lo = m - minSpan / 2; hi = m + minSpan / 2; }
      return [lo - pad * (hi - lo), hi + pad * (hi - lo)];
    };
    const tR = span(Ts, 0.08, 2), sR = span(Ss, 0.08, 0.5), gR = span(sigs, 0.08, 0.5);

    svgP.replaceChildren();
    const panels = [
      { key: "T", range: tR, color: "var(--code-del)", label: "T (°C)", x: 40 },
      { key: "S", range: sR, color: "var(--vec-u)", label: "S (g/kg)", x: 150 },
      { key: "sig", range: gR, color: "var(--vec-v)", label: "σ (kg/m³)", x: 260 },
    ];
    const T0 = 30, H = 280, W = 100;
    const sy = (z) => T0 + (z / ZMAX) * H;
    for (const z of niceTicks([0, ZMAX], 5)) {
      el("line", { x1: 40, x2: 360, y1: sy(z), y2: sy(z), style: "stroke:currentColor;stroke-opacity:.07" }, svgP);
      text(svgP, 34, sy(z) + 3, String(z), { "text-anchor": "end" });
    }
    text(svgP, 4, 14, "depth (m)", { "text-anchor": "start" });
    // The mixed layer and cline band.
    el("rect", { x: 40, y: sy(0), width: 320, height: sy(s.mld.get()) - sy(0), style: "fill:var(--vec-u);fill-opacity:.06" }, svgP);
    el("rect", { x: 40, y: sy(s.mld.get()), width: 320, height: Math.max(0, Math.min(sy(ZMAX), sy(s.mld.get() + s.thick.get())) - sy(s.mld.get())), style: "fill:currentColor;fill-opacity:.05" }, svgP);
    for (const p of panels) {
      const sx = (v) => p.x + ((v - p.range[0]) / (p.range[1] - p.range[0])) * W;
      el("line", { x1: p.x, x2: p.x + W, y1: T0 + H, y2: T0 + H, style: "stroke:currentColor;stroke-opacity:.3" }, svgP);
      text(svgP, p.x + W / 2, T0 - 14, p.label, { "text-anchor": "middle", style: `fill:${p.color}` });
      const vals = col.map((c) => c[p.key]), lo = Math.min(...vals), hi = Math.max(...vals);
      for (const [v, anchor] of [[lo, "start"], [hi, "end"]]) {
        el("line", { x1: sx(v), x2: sx(v), y1: T0 + H, y2: T0 + H + 4, style: "stroke:currentColor;stroke-opacity:.4" }, svgP);
        if (hi - lo > 1e-6 || anchor === "end") text(svgP, sx(v) + (anchor === "start" ? -4 : 4), T0 + H + 14, num(v, 1), { "text-anchor": hi - lo > 1e-6 ? anchor : "middle" });
      }
      polyline(svgP, col.map((c) => [sx(c[p.key]), sy(c.z)]), `stroke:${p.color};stroke-width:1.8`);
      if (hover !== null) {
        const c = columnAt(hover);
        el("circle", { cx: sx(c[p.key]), cy: sy(hover), r: 3.5, style: `fill:${BRAND}` }, svgP);
      }
    }
    text(svgP, 44, sy(s.mld.get() / 2) + 3, s.mld.get() >= 25 ? "mixed layer" : "", { "text-anchor": "start" });
    if (hover !== null) el("line", { x1: 40, x2: 360, y1: sy(hover), y2: sy(hover), style: `stroke:${BRAND};stroke-opacity:.5;stroke-dasharray:3 3` }, svgP);

    // T–S diagram with isopycnals.
    svgT.replaceChildren();
    const sR2 = span(Ss, 0.25, 1), tR2 = span(Ts, 0.15, 4);
    const f = frame(svgT, { box: [34, 22, 214, 280], x: sR2, y: tR2, xticks: niceTicks(sR2, 4), yticks: niceTicks(tR2, 5), xfmt: (v) => num(v, 1), yfmt: (v) => num(v, 0), xlabel: "S (g/kg)", ylabel: "T (°C)" });
    // σ(T, S) is linear, so its contours are straight lines.
    const corners = [[sR2[0], tR2[0]], [sR2[1], tR2[0]], [sR2[0], tR2[1]], [sR2[1], tR2[1]]].map(([S, T]) => sigma(T, S));
    const sLo = Math.min(...corners), sHi = Math.max(...corners);
    const step = sHi - sLo > 6 ? 1 : sHi - sLo > 2.5 ? 0.5 : 0.2;
    const clip = el("clipPath", { id: "ocean-ts-clip" }, svgT);
    el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, clip);
    const iso = el("g", { "clip-path": "url(#ocean-ts-clip)" }, svgT);
    for (let v = Math.ceil(sLo / step) * step; v <= sHi; v += step) {
      // T at a given S on the isopycnal σ = v.
      const tAt = (S) => 10 + (1 + BETA * (S - 35) - (v + 1000) / RHO0) / ALPHA;
      el("line", { x1: f.sx(sR2[0]), y1: f.sy(tAt(sR2[0])), x2: f.sx(sR2[1]), y2: f.sy(tAt(sR2[1])), style: "stroke:currentColor;stroke-opacity:.18;stroke-dasharray:2 3" }, iso);
      const tl = tAt(sR2[1] - 0.04 * (sR2[1] - sR2[0]));
      if (tl > tR2[0] && tl < tR2[1]) text(iso, f.sx(sR2[1]) - 3, f.sy(tl) - 3, num(v, step < 0.5 ? 1 : 1), { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[9px]" });
    }
    polyline(svgT, col.map((c) => [f.sx(c.S), f.sy(c.T)]), "stroke:var(--vec-v);stroke-width:1.8");
    el("circle", { cx: f.sx(col[0].S), cy: f.sy(col[0].T), r: 3, style: "fill:var(--background);stroke:var(--vec-v);stroke-width:1.5" }, svgT);
    text(svgT, f.sx(col[0].S) + 5, f.sy(col[0].T) - 5, "surface", { "text-anchor": "start" });
    if (hover !== null) {
      const c = columnAt(hover);
      el("circle", { cx: f.sx(c.S), cy: f.sy(c.T), r: 4, style: `fill:${BRAND}` }, svgT);
    }

    const top = col[0], bot = col[col.length - 1];
    const dT = -RHO0 * ALPHA * (bot.T - top.T), dS = RHO0 * BETA * (bot.S - top.S);
    o.s0.textContent = `${num(top.sig, 2)} kg/m³`;
    o.s1.textContent = `${num(bot.sig, 2)} kg/m³`;
    o.dt.textContent = `${dT >= 0 ? "+" : ""}${num(dT, 2)} kg/m³`;
    o.ds.textContent = `${dS >= 0 ? "+" : ""}${num(dS, 2)} kg/m³`;
    const unstable = col.some((c, i) => i > 0 && c.sig < col[i - 1].sig - 1e-9);
    o.by.textContent = unstable ? "unstable: denser water on top" : dT >= dS ? (dS < 0 ? "heat (salt works against it)" : "mostly heat") : dT < 0 ? "salt (heat works against it)" : "mostly salt";
    o.by.className = unstable ? "tabular-nums text-del" : "tabular-nums";
    if (hover !== null) {
      const c = columnAt(hover);
      o.hover.textContent = `${Math.round(hover)} m: ${num(c.T, 2)} °C, ${num(c.S, 2)}, σ ${num(c.sig, 2)}`;
    } else o.hover.textContent = "hover the profiles";
  }
  svgP.addEventListener("pointermove", (e) => {
    const p = svgPoint(svgP, e);
    const z = ((p.y - 30) / 280) * ZMAX;
    hover = z >= 0 && z <= ZMAX ? Math.round(z) : null;
    draw();
  });
  svgP.addEventListener("pointerleave", () => { hover = null; draw(); });
  draw();
}

function niceTicks([lo, hi], n) {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// ============================================================ waves

// waveNumber solves ω² = g·k·tanh(k·h) for k by Newton's method.
export function waveNumber(omega, h) {
  let k = Math.max((omega * omega) / G, omega / Math.sqrt(G * h));
  for (let i = 0; i < 60; i++) {
    const th = Math.tanh(k * h);
    const fval = G * k * th - omega * omega;
    const d = G * th + G * k * h * (1 - th * th);
    const next = k - fval / d;
    if (!(next > 0)) { k /= 2; continue; }
    if (Math.abs(next - k) < 1e-12 * k) return next;
    k = next;
  }
  return k;
}
// cosh(k(z+h))/sinh(kh) and sinh(k(z+h))/sinh(kh) without overflow, z ≤ 0.
function orbitRatios(k, z, h) {
  if (k * h > 18) return [Math.exp(k * z), Math.exp(k * z)];
  const s = Math.sinh(k * h);
  return [Math.cosh(k * (z + h)) / s, Math.sinh(k * (z + h)) / s];
}

for (const root of document.querySelectorAll("[data-ocean-waves]")) {
  const train = root.querySelector("[data-train]");
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => { drawPlot(); drawTrain(); });
  let t = 0;
  const state = () => {
    const T = s.period.get(), h = s.depth.get(), H = s.height.get();
    const w = (2 * Math.PI) / T, k = waveNumber(w, h), L = (2 * Math.PI) / k;
    const c = w / k, kh = k * h;
    const n = kh > 25 ? 0.5 : 0.5 * (1 + (2 * kh) / Math.sinh(2 * kh));
    return { T, h, H, w, k, L, c, cg: n * c, kh };
  };

  function drawTrain() {
    const st = state();
    train.replaceChildren();
    const W = 640, top = 60, deepShow = Math.min(st.h, st.L * 0.55);
    const scaleX = W / (2 * st.L);
    const bedY = top + 140; // the bottom of the drawn water (true bottom when it fits)
    const scaleZ = 140 / deepShow;
    const amp = Math.min(26, Math.max(6, (st.H / 2) * scaleX * 4)); // drawn amplitude, exaggerated
    const ex = amp / ((st.H / 2) * scaleX);
    const surf = [];
    for (let x = 0; x <= W; x += 4) {
      const th = st.k * (x / scaleX) - st.w * t;
      surf.push([x, top - amp * Math.cos(th)]);
    }
    el("path", { d: `M0 ${bedY + 6}L` + surf.map((p) => `${p[0]} ${p[1].toFixed(1)}`).join("L") + `L${W} ${bedY + 6}Z`, style: "fill:var(--vec-u);fill-opacity:.1" }, train);
    polyline(train, surf, "stroke:var(--vec-u);stroke-width:1.8");
    const bottomShown = st.h <= deepShow + 1e-6;
    if (bottomShown) {
      el("rect", { x: 0, y: bedY, width: W, height: 14, style: "fill:currentColor;fill-opacity:.14" }, train);
      text(train, 8, bedY + 11, `bottom, ${fx(st.h, st.h < 10 ? 1 : 0)} m`, { "text-anchor": "start" });
    } else text(train, 8, bedY + 4, `bottom at ${fx(st.h, 0)} m, below the picture`, { "text-anchor": "start" });
    // Particles: orbits at a few depths, each dot where its water parcel is now.
    const depths = [0.02, 0.18, 0.36, 0.6, 0.9].map((q) => q * deepShow);
    for (const zd of depths) {
      const [ra, rb] = orbitRatios(st.k, -zd, st.h);
      const ax = (st.H / 2) * ra * scaleX * ex, bz = (st.H / 2) * rb * scaleX * ex;
      const y0 = top + zd * scaleZ;
      for (let i = 0; i < 9; i++) {
        const x0 = ((i + 0.5) / 9) * W;
        const th = st.k * (x0 / scaleX) - st.w * t;
        if (ax > 0.6 || bz > 0.6) el("ellipse", { cx: x0, cy: y0, rx: Math.max(0.3, ax), ry: Math.max(0.3, bz), style: "fill:none;stroke:currentColor;stroke-opacity:.22" }, train);
        el("circle", { cx: x0 + ax * Math.sin(th), cy: y0 - bz * Math.cos(th), r: 2.6, style: `fill:${i === 4 ? BRAND : "currentColor"};fill-opacity:${i === 4 ? 1 : 0.6}` }, train);
      }
    }
    // A crest marker moving at c and a group marker moving at cg.
    text(train, 8, 18, `${fx(2, 0)} wavelengths = ${fx(2 * st.L, st.L < 10 ? 1 : 0)} m across · height drawn ×${num(ex, ex < 10 ? 1 : 0)}`, { "text-anchor": "start" });
    text(train, W - 8, 18, `t = ${num(t, 1)} s`, { "text-anchor": "end" });

    o.l.textContent = `${fx(st.L, st.L < 10 ? 2 : 1)} m`;
    o.hl.textContent = num(st.h / st.L, st.h / st.L < 0.1 ? 3 : 2);
    const r = st.h / st.L;
    o.regime.textContent = r > 0.5 ? "deep water" : r < 0.05 ? "shallow water" : "intermediate";
    o.c.textContent = `${num(st.c, 2)} m/s`;
    o.cg.textContent = `${num(st.cg, 2)} m/s (${num(st.cg / st.c, 2)} c)`;
    o.cdeep.textContent = `${num((G * st.T) / (2 * Math.PI), 2)} m/s`;
    const steep = st.H / st.L;
    const breaking = steep > 1 / 7 || st.H > 0.78 * st.h;
    o.steep.textContent = `1/${num(1 / steep, 0)}${breaking ? " · breaking" : ""}`;
    o.steep.className = breaking ? "tabular-nums text-del" : "tabular-nums";
  }

  function drawPlot() {
    const st = state();
    plot.replaceChildren();
    const lx = [0, Math.log10(5000)];
    const cMax = Math.max(5, ((G * st.T) / (2 * Math.PI)) * 1.2);
    const f = frame(plot, { box: [44, 16, 580, 140], x: lx, y: [0, cMax], xticks: [0, 1, 2, 3], yticks: niceTicks([0, cMax], 4), xfmt: (v) => `${10 ** v} m`, yfmt: (v) => num(v, 0), xlabel: "depth h (log)", ylabel: "speed (m/s)" });
    const c = [], cg = [], sh = [];
    for (let q = 0; q <= 160; q++) {
      const lh = (q / 160) * lx[1], h = 10 ** lh;
      const w = (2 * Math.PI) / st.T, k = waveNumber(w, h), cc = w / k, kh = k * h;
      const n = kh > 25 ? 0.5 : 0.5 * (1 + (2 * kh) / Math.sinh(2 * kh));
      c.push([f.sx(lh), f.sy(cc)]);
      cg.push([f.sx(lh), f.sy(n * cc)]);
      const v = Math.sqrt(G * h);
      if (v <= cMax) sh.push([f.sx(lh), f.sy(v)]);
    }
    polyline(f.g, sh, "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:3 3");
    polyline(f.g, c, "stroke:var(--vec-u);stroke-width:1.8");
    polyline(f.g, cg, "stroke:var(--vec-v);stroke-width:1.8");
    hline(f.g, f, (G * st.T) / (2 * Math.PI), "stroke:currentColor;stroke-opacity:.25;stroke-dasharray:1 3", "deep: gT/2π");
    const x = f.sx(Math.log10(Math.max(1, st.h)));
    el("line", { x1: x, x2: x, y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-opacity:.6` }, plot);
    el("circle", { cx: x, cy: f.sy(st.c), r: 3.5, style: "fill:var(--vec-u)" }, plot);
    el("circle", { cx: x, cy: f.sy(st.cg), r: 3.5, style: "fill:var(--vec-v)" }, plot);
    const lg = el("g", {}, plot);
    [["var(--vec-u)", "phase c"], ["var(--vec-v)", "group c_g"], ["currentColor", "√(gh)"]].forEach(([col, lab], i) => {
      el("line", { x1: 60 + i * 100, x2: 72 + i * 100, y1: 184, y2: 184, style: `stroke:${col};stroke-width:2${i === 2 ? ";stroke-dasharray:3 3;stroke-opacity:.5" : ""}` }, lg);
      text(lg, 76 + i * 100, 187, lab, { "text-anchor": "start" });
    });
  }
  player(root, (dt) => { t += dt; drawTrain(); });
  drawPlot();
  drawTrain();
}

// ============================================================ tsunami

for (const root of document.querySelectorAll("[data-ocean-tsunami]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const START = 900; // s: the pulse starts in full view
  const s = scrubAll(root, () => { tNow = START; draw(); });
  const SLOPE = 80, SHELF = 120, BEACH = 2; // km
  let tNow = START; // seconds since the wave left x = 0
  function geom() {
    const D = s.dist.get(), deep = s.deep.get(), shelf = Math.min(s.shelf.get(), deep);
    const x1 = D, x2 = D + SLOPE, x3 = x2 + SHELF, x4 = x3 + BEACH;
    const depth = (x) => (x <= x1 ? deep : x <= x2 ? deep + ((shelf - deep) * (x - x1)) / SLOPE : x <= x3 ? shelf + ((10 - shelf) * (x - x2)) / SHELF : Math.max(0, 10 * (1 - (x - x3) / BEACH)));
    return { D, deep, shelf, x1, x2, x3, x4, depth };
  }
  // Travel time from 0 to x, integrating dx/√(g·h) with 0.5 km steps.
  function travel(gm, xEnd) {
    let t = 0;
    const dx = 0.5;
    for (let x = 0; x < xEnd; x += dx) {
      const h = gm.depth(Math.min(xEnd, x + dx / 2));
      if (h <= 0) break;
      t += (Math.min(dx, xEnd - x) * 1000) / Math.sqrt(G * h);
    }
    return t;
  }
  function positionAt(gm, t) {
    let x = 0, acc = 0;
    const dx = 0.5;
    while (x < gm.x3) {
      const h = gm.depth(x + dx / 2), step = (dx * 1000) / Math.sqrt(G * h);
      if (acc + step > t) return x + ((t - acc) / step) * dx;
      acc += step;
      x += dx;
    }
    return gm.x3;
  }
  // Piecewise horizontal axis: the abyss gets half the width.
  function draw() {
    const gm = geom();
    const L = 20, R = 620, mid = L + (R - L) * 0.5;
    const X = (x) => (x <= gm.x1 ? L + (x / gm.x1) * (mid - L) : mid + ((x - gm.x1) / (gm.x4 - gm.x1)) * (R - mid));
    const top = 100, bot = 296;
    const Y = (d) => top + 14 + (d / gm.deep) * (bot - top - 14);
    svg.replaceChildren();
    // Sea and bed.
    const bed = [];
    for (let i = 0; i <= 400; i++) { const x = (i / 400) * gm.x4; bed.push([X(x), Y(gm.depth(x))]); }
    el("path", { d: `M${L} ${top + 14}L` + bed.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L") + "Z", style: "fill:var(--vec-u);fill-opacity:.08" }, svg);
    el("path", { d: `M${L} ${bot + 10}L` + bed.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L") + `L${R} ${bot + 10}Z`, style: "fill:currentColor;fill-opacity:.14" }, svg);
    el("line", { x1: mid, x2: mid, y1: top - 6, y2: bot + 10, style: "stroke:currentColor;stroke-opacity:.2;stroke-dasharray:2 4" }, svg);
    text(svg, (L + mid) / 2, bot + 24, `abyss ${fx(gm.D, 0)} km`, { "text-anchor": "middle" });
    text(svg, (mid + R) / 2, bot + 24, `slope ${SLOPE} km · shelf ${SHELF} km (scale ×${num((gm.x1 / (mid - L)) / ((gm.x4 - gm.x1) / (R - mid)), 0)})`, { "text-anchor": "middle" });
    text(svg, L + 4, Y(gm.deep) - 6, `${fx(gm.deep, 0)} m`, { "text-anchor": "start" });
    text(svg, X(gm.x2) + 4, Y(gm.shelf) + 12, `${fx(gm.shelf, 0)} m`, { "text-anchor": "start" });

    // The pulse: a crest whose height follows Green's law and whose width
    // follows the speed (the period stays the same, about 20 min).
    const xp = positionAt(gm, tNow);
    const hp = Math.max(10, gm.depth(xp));
    const A = s.amp.get() * (gm.deep / hp) ** 0.25;
    const lam = (Math.sqrt(G * hp) * 1200) / 1000; // km
    const aMaxDrawn = s.amp.get() * (gm.deep / 10) ** 0.25;
    const pxPerM = 60 / Math.max(aMaxDrawn, 0.5);
    const surf = [];
    for (let i = 0; i <= 600; i++) {
      const x = (i / 600) * gm.x4;
      const u = (x - xp) / (lam / 2.5);
      surf.push([X(x), top + 14 - A * pxPerM * Math.exp(-u * u)]);
    }
    polyline(svg, surf, "stroke:var(--vec-u);stroke-width:1.8");
    el("circle", { cx: X(xp), cy: top + 14 - A * pxPerM, r: 3.5, style: `fill:${BRAND}` }, svg);
    text(svg, Math.min(X(xp) + 6, R - 70), top + 6 - A * pxPerM, `${num(A, 2)} m`, { "text-anchor": "start", style: `fill:${BRAND}` });
    const exag = pxPerM / ((bot - top - 14) / gm.deep);
    text(svg, L, 20, `wave height drawn ×${Math.round(exag).toLocaleString("en")} against the depths`, { "text-anchor": "start" });
    text(svg, R, 20, `t = ${duration(tNow)} · c = ${num(Math.sqrt(G * hp), 0)} m/s`, { "text-anchor": "end" });

    const total = travel(gm, gm.x3);
    o.cdeep.textContent = `${num(Math.sqrt(G * gm.deep), 1)} m/s (${num(Math.sqrt(G * gm.deep) * 3.6, 0)} km/h)`;
    o.cshelf.textContent = `${num(Math.sqrt(G * gm.shelf), 1)} m/s`;
    o.c10.textContent = `${num(Math.sqrt(G * 10), 1)} m/s`;
    o.time.textContent = `${duration(total)} to the 10 m line`;
    o.a10.textContent = `${num(s.amp.get() * (gm.deep / 10) ** 0.25, 2)} m (×${num((gm.deep / 10) ** 0.25, 2)})`;
    o.now.textContent = `${fx(xp, 0)} km, ${duration(tNow)}`;
    return total;
  }
  let total = draw();
  // One second on screen is ten minutes of travel.
  player(root, (dt) => {
    tNow += dt * 600;
    if (tNow > total + 300) tNow = START;
    total = draw();
  });
}

// ============================================================ Ekman

for (const root of document.querySelectorAll("[data-ocean-ekman]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const RHO = 1025, RHO_AIR = 1.22, CD = 1.3e-3;
  function draw() {
    const U = s.wind.get(), lat = s.lat.get(), Az = s.az.get(), dir = s.dir.get() * RAD;
    svg.replaceChildren();
    if (Math.abs(lat) < 2) {
      text(svg, 320, 170, "Within 2° of the equator f ≈ 0 and Ekman's balance does not hold.", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      for (const k of ["f", "tau", "de", "v0", "m", "ang"]) o[k].textContent = "—";
      o.f.textContent = `${(2 * OMEGA * Math.sin(lat * RAD)).toExponential(2)} s⁻¹`;
      return;
    }
    const f = 2 * OMEGA * Math.sin(lat * RAD), af = Math.abs(f), side = f > 0 ? 1 : -1;
    const tau = RHO_AIR * CD * U * U;
    const D = Math.PI * Math.sqrt((2 * Az) / af);
    const V0 = tau / (RHO * Math.sqrt(Az * af));
    const M = tau / (RHO * af);
    // Compass bearings (clockwise from north) to screen vectors.
    const vec = (bearing, len) => [Math.sin(bearing) * len, -Math.cos(bearing) * len];

    // Left: an oblique view of the column. North recedes up-right.
    const cx = 190, cy0 = 104, depthPx = 200, scale = 110 / Math.max(V0, 1e-6);
    const obl = (e, n, z) => [cx + e + n * 0.45, cy0 + z - n * 0.35];
    // The surface plane.
    const sq = [[-120, -120], [120, -120], [120, 120], [-120, 120]].map(([e, n]) => obl(e, n, 0));
    el("path", { d: "M" + sq.map((p) => p.join(" ")).join("L") + "Z", style: "fill:var(--vec-u);fill-opacity:.06;stroke:currentColor;stroke-opacity:.2" }, svg);
    const axisTop = obl(0, 0, 0), axisBot = obl(0, 0, depthPx);
    el("line", { x1: axisTop[0], y1: axisTop[1], x2: axisBot[0], y2: axisBot[1], style: "stroke:currentColor;stroke-opacity:.35" }, svg);
    text(svg, axisBot[0] + 6, axisBot[1] + 4, `D = ${num(D, 0)} m`, { "text-anchor": "start" });
    const [we, wn] = vec(dir, 1);
    const wa = obl(-we * 90, wn * 90, 0), wb = obl(we * 90, -wn * 90, 0);
    void wa; void wb;
    // Wind arrow above the surface.
    const w0 = obl(0, 0, -34), w1 = obl(we * 100, -wn * 100, -34);
    arrow(svg, w0[0], w0[1], w1[0], w1[1], "var(--vec-out)", 2.2, 8);
    text(svg, w1[0] + 6, w1[1], `wind ${num(U, 0)} m/s`, { "text-anchor": "start", style: "fill:var(--vec-out)" });
    const tips = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const z = (i / N) * D;
      const speed = V0 * Math.exp((-Math.PI * z) / D);
      const bearing = dir + side * (Math.PI / 4 + (Math.PI * z) / D);
      const [ve, vn] = vec(bearing, speed * scale);
      const zp = (i / N) * depthPx;
      const a = obl(0, 0, zp), b = obl(ve, -vn, zp);
      tips.push(b);
      arrow(svg, a[0], a[1], b[0], b[1], i === 0 ? BRAND : "var(--vec-u)", i === 0 ? 2 : 1.2, i === 0 ? 7 : 5);
    }
    polyline(svg, tips, "stroke:var(--vec-u);stroke-opacity:.45;stroke-dasharray:2 3");
    text(svg, 12, 18, `Side view, ${lat > 0 ? "northern" : "southern"} hemisphere`, { "text-anchor": "start" });

    // Right: plan view with the wind, surface current and net transport.
    const px = 520, py = 150, R = 80;
    el("circle", { cx: px, cy: py, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:.15" }, svg);
    for (const [lab, b] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const [e, n] = vec(b * RAD, R + 12);
      text(svg, px + e, py + n + 3, lab, { "text-anchor": "middle" });
    }
    const keys = [["var(--vec-out)", "wind", dir, 0.9, 2.2], [BRAND, "surface current", dir + side * Math.PI / 4, 0.65, 2], ["var(--vec-v)", "net transport", dir + side * Math.PI / 2, 0.8, 3]];
    keys.forEach(([color, label, b, len, w], i) => {
      const [e, n] = vec(b, R * len);
      arrow(svg, px, py, px + e, py + n, color, w, 8);
      el("line", { x1: px - 70, x2: px - 56, y1: 270 + i * 16, y2: 270 + i * 16, style: `stroke:${color};stroke-width:${w}` }, svg);
      text(svg, px - 50, 273 + i * 16, label, { "text-anchor": "start" });
    });
    text(svg, px, 18, "Plan view", { "text-anchor": "middle" });

    const bearingTxt = (b) => `${Math.round((((b / RAD) % 360) + 360) % 360)}°`;
    o.f.textContent = `${f.toExponential(2).replace("-", "−")} s⁻¹`;
    o.tau.textContent = `${num(tau, 3)} N/m²`;
    o.de.textContent = `${num(D, 0)} m`;
    o.v0.textContent = `${num(V0 * 100, 1)} cm/s toward ${bearingTxt(dir + side * Math.PI / 4)}`;
    o.m.textContent = `${num(M, 2)} m²/s, so ${num(M, 2)} Sv per 1,000 km of coast`;
    o.ang.textContent = `${bearingTxt(dir + side * Math.PI / 2)}, 90° ${side > 0 ? "right" : "left"} of the wind`;
  }
  draw();
}

// ============================================================ geostrophy

for (const root of document.querySelectorAll("[data-ocean-geo]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const BOX = 600; // km
  let kind = "warm", cx = 300, cy = 300, cursor = null;
  onSeg(root, (_, v) => { kind = v; draw(); });
  root.querySelector('[data-action="centre"]').addEventListener("click", () => { cx = 300; cy = 300; draw(); });
  const P = { L: 12, T: 12, S: 376 }; // the map square in the viewBox
  const toPx = (x, y) => [P.L + (x / BOX) * P.S, P.T + P.S - (y / BOX) * P.S];
  function model() {
    const lat = s.lat.get(), f = 2 * OMEGA * Math.sin(lat * RAD);
    const A = (s.amp.get() / 100) * (kind === "warm" ? 1 : -1), R = s.radius.get() * 1000;
    const eta = (x, y) => A * Math.exp(-(((x - cx) * 1000) ** 2 + ((y - cy) * 1000) ** 2) / (2 * R * R));
    // u = −(g/f)·∂η/∂y, v = (g/f)·∂η/∂x, with ∂η/∂x = −η·Δx/R².
    const vel = (x, y) => {
      const e = eta(x, y), dx = (x - cx) * 1000, dy = (y - cy) * 1000;
      return [(G / f) * e * dy / (R * R), -(G / f) * e * dx / (R * R)];
    };
    return { lat, f, A, R, eta, vel };
  }
  function draw() {
    const m = model();
    svg.replaceChildren();
    if (Math.abs(m.lat) < 2) {
      text(svg, 320, 200, "Within 2° of the equator f ≈ 0: geostrophic balance does not hold.", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      for (const k of ["vmax", "rot", "turn", "cursor"]) o[k].textContent = "—";
      o.f.textContent = `${(2 * OMEGA * Math.sin(m.lat * RAD)).toExponential(2)} s⁻¹`;
      return;
    }
    const color = kind === "warm" ? "var(--code-del)" : "var(--vec-u)";
    el("rect", { x: P.L, y: P.T, width: P.S, height: P.S, style: "fill:none;stroke:currentColor;stroke-opacity:.25" }, svg);
    const clip = el("clipPath", { id: "ocean-geo-clip" }, svg);
    el("rect", { x: P.L, y: P.T, width: P.S, height: P.S }, clip);
    const g = el("g", { "clip-path": "url(#ocean-geo-clip)" }, svg);
    // Contours of η: circles, filled more strongly toward the centre.
    const [ex, ey] = toPx(cx, cy);
    for (let q = 1; q <= 9; q++) {
      const level = q / 10; // fraction of η₀
      const r = Math.sqrt(-2 * Math.log(level)) * (m.R / 1000); // km
      el("circle", { cx: ex, cy: ey, r: (r / BOX) * P.S, style: `fill:${color};fill-opacity:.07;stroke:${color};stroke-opacity:.4;stroke-width:.8` }, g);
    }
    // Velocity arrows on a grid.
    const N = 15, step = BOX / N;
    let vmax = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = (i + 0.5) * step, y = (j + 0.5) * step;
      const [u, v] = m.vel(x, y);
      vmax = Math.max(vmax, Math.hypot(u, v));
    }
    const peak = (G / Math.abs(m.f)) * Math.abs(m.A) * Math.exp(-0.5) / m.R;
    const k = 20 / Math.max(peak, 1e-6);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = (i + 0.5) * step, y = (j + 0.5) * step;
      const [u, v] = m.vel(x, y);
      const sp = Math.hypot(u, v);
      const [px, py] = toPx(x, y);
      if (sp * k < 1.2) { el("circle", { cx: px, cy: py, r: 0.8, style: "fill:currentColor;fill-opacity:.3" }, g); continue; }
      arrow(g, px - (u * k) / 2, py + (v * k) / 2, px + (u * k) / 2, py - (v * k) / 2, "currentColor", 1.1, 4);
    }
    el("circle", { cx: ex, cy: ey, r: 3, style: `fill:${color}` }, g);
    text(svg, P.L + 4, P.T + P.S + 0, "", {});
    text(svg, P.L + 2, 398, `${BOX} km box · arrows ∝ speed`, { "text-anchor": "start" });

    // Right: a section through the centre, west to east.
    const sx0 = 410, sw = 220;
    const sec = frame(svg, { box: [sx0 + 20, 30, sw - 20, 120], x: [0, BOX], y: [-Math.abs(m.A) * 1.15 * 100, Math.abs(m.A) * 1.15 * 100], xticks: [0, 300, 600], yticks: [0], yfmt: () => "0", xlabel: "km, west → east" });
    text(svg, sx0, 20, "η along the centre (cm)", { "text-anchor": "start" });
    const ptsE = [], ptsV = [];
    for (let x = 0; x <= BOX; x += 4) {
      ptsE.push([sec.sx(x), sec.sy(m.eta(x, cy) * 100)]);
      ptsV.push([x, m.vel(x, cy)[1]]);
    }
    polyline(sec.g, ptsE, `stroke:${color};stroke-width:1.8`);
    const vsec = frame(svg, { box: [sx0 + 20, 215, sw - 20, 120], x: [0, BOX], y: [-peak * 1.2, peak * 1.2], xticks: [0, 300, 600], yticks: [-peak, 0, peak], yfmt: (v) => num(v, 2) });
    text(svg, sx0, 205, "northward speed v (m/s)", { "text-anchor": "start" });
    polyline(vsec.g, ptsV.map(([x, v]) => [vsec.sx(x), vsec.sy(v)]), `stroke:${BRAND};stroke-width:1.8`);

    if (cursor) {
      const [u, v] = m.vel(cursor[0], cursor[1]);
      const sp = Math.hypot(u, v), b = (((Math.atan2(u, v) / RAD) % 360) + 360) % 360;
      o.cursor.textContent = `${num(sp, 2)} m/s toward ${Math.round(b)}° · η ${num(m.eta(cursor[0], cursor[1]) * 100, 1)} cm`;
    } else o.cursor.textContent = "hover the map";
    const clockwise = (m.A > 0) === (m.f > 0);
    o.f.textContent = `${m.f.toExponential(2).replace("-", "−")} s⁻¹`;
    o.vmax.textContent = `${num(peak, 2)} m/s at r = R`;
    o.rot.textContent = clockwise ? "clockwise" : "anticlockwise";
    o.turn.textContent = `${num((2 * Math.PI * m.R) / peak / 86400, 1)} days per loop at r = R`;
  }
  const pick = (e) => {
    const p = svgPoint(svg, e);
    const x = ((p.x - P.L) / P.S) * BOX, y = ((P.T + P.S - p.y) / P.S) * BOX;
    return x >= 0 && x <= BOX && y >= 0 && y <= BOX ? [x, y] : null;
  };
  svg.addEventListener("pointermove", (e) => { cursor = pick(e); draw(); });
  svg.addEventListener("pointerleave", () => { cursor = null; draw(); });
  svg.addEventListener("click", (e) => { const q = pick(e); if (q) { [cx, cy] = q; draw(); } });
  draw();
}

// ============================================================ SOFAR

const MUNK = { c1: 1500, B: 1300, z1: 1300, eps: 0.00737, bottom: 5000 };
export const munk = (z) => { const e = (2 * (z - MUNK.z1)) / MUNK.B; return MUNK.c1 * (1 + MUNK.eps * (e + Math.exp(-e) - 1)); };
const munkDz = (z) => { const e = (2 * (z - MUNK.z1)) / MUNK.B; return MUNK.c1 * MUNK.eps * (2 / MUNK.B) * (1 - Math.exp(-e)); };

for (const root of document.querySelectorAll("[data-ocean-sofar]")) {
  const svgC = root.querySelector("[data-profile]");
  const svgR = root.querySelector("[data-rays]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  function trace(z0, theta0, rangeM) {
    // z down; dθ/ds = −(1/c)·(dc/dz)·cos θ. Reflect at surface and bottom.
    const ds = 25;
    let x = 0, z = z0, th = theta0, hit = false;
    const pts = [[0, z0]];
    while (x < rangeM) {
      // Midpoint (RK2) step.
      const k1 = -(munkDz(z) / munk(z)) * Math.cos(th);
      const zm = z + (ds / 2) * Math.sin(th), thm = th + (ds / 2) * k1;
      const k2 = -(munkDz(zm) / munk(zm)) * Math.cos(thm);
      x += ds * Math.cos(thm);
      z += ds * Math.sin(thm);
      th += ds * k2;
      if (z < 0) { z = -z; th = -th; hit = true; }
      if (z > MUNK.bottom) { z = 2 * MUNK.bottom - z; th = -th; hit = true; }
      if (pts.length === 0 || x - pts[pts.length - 1][0] >= 250) pts.push([x, z]);
    }
    pts.push([x, z]);
    return { pts, hit };
  }
  function draw() {
    const zs = s.zs.get(), spread = s.spread.get() * RAD, n = Math.round(s.rays.get()), range = s.range.get() * 1000;
    svgC.replaceChildren();
    const fc = frame(svgC, { box: [34, 20, 96, 290], x: [1480, 1560], y: [MUNK.bottom, 0], xticks: [1490, 1550], yticks: [0, 1000, 2000, 3000, 4000, 5000], yfmt: (v) => `${v / 1000}`, xfmt: String, ylabel: "km" });
    const cp = [];
    for (let z = 0; z <= MUNK.bottom; z += 25) cp.push([fc.sx(munk(z)), fc.sy(z)]);
    polyline(fc.g, cp, "stroke:var(--vec-u);stroke-width:1.8");
    el("line", { x1: fc.L, x2: fc.L + fc.W, y1: fc.sy(MUNK.z1), y2: fc.sy(MUNK.z1), style: "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:3 3" }, svgC);
    el("circle", { cx: fc.sx(munk(zs)), cy: fc.sy(zs), r: 3.5, style: `fill:${BRAND}` }, svgC);
    text(svgC, fc.L + fc.W, 334, "c (m/s)", { "text-anchor": "end" });

    svgR.replaceChildren();
    const fr = frame(svgR, { box: [10, 20, 500, 290], x: [0, range / 1000], y: [MUNK.bottom, 0], xticks: niceTicks([0, range / 1000], 5), yticks: [], xlabel: "range (km)" });
    el("line", { x1: fr.L, x2: fr.L + fr.W, y1: fr.sy(MUNK.z1), y2: fr.sy(MUNK.z1), style: "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:3 3" }, svgR);
    text(svgR, fr.L + fr.W - 2, fr.sy(MUNK.z1) - 4, "sound channel axis", { "text-anchor": "end" });
    el("rect", { x: fr.L, y: fr.sy(MUNK.bottom), width: fr.W, height: 6, style: "fill:currentColor;fill-opacity:.15" }, svgR);
    let trapped = 0;
    const g = el("g", {}, svgR);
    for (let i = 0; i < n; i++) {
      const th = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1);
      const r = trace(zs, th, range);
      if (!r.hit) trapped++;
      polyline(g, r.pts.map(([x, z]) => [fr.sx(x / 1000), fr.sy(z)]), r.hit ? "stroke:currentColor;stroke-opacity:.3;stroke-width:.9" : "stroke:var(--vec-u);stroke-opacity:.85;stroke-width:1.1");
    }
    el("circle", { cx: fr.sx(0) + 2, cy: fr.sy(zs), r: 4, style: `fill:${BRAND}` }, svgR);
    const cs = munk(zs), cmin = Math.min(munk(0), munk(MUNK.bottom));
    o.axis.textContent = `${MUNK.z1} m, ${num(munk(MUNK.z1), 1)} m/s`;
    o.cs.textContent = `${num(cs, 1)} m/s`;
    o.trapped.textContent = `${trapped} of ${n}`;
    o.crit.textContent = cs < cmin ? `±${num(Math.acos(cs / cmin) / RAD, 1)}°` : "none: source outside the channel";
  }
  draw();
}

// ============================================================ light

// Pure-water absorption, 1/m (Pope & Fry 1997), and display colours.
const BANDS = [
  { nm: 400, aw: 0.00663, rgb: [130, 0, 200] },
  { nm: 450, aw: 0.00922, rgb: [0, 70, 255] },
  { nm: 500, aw: 0.0204, rgb: [0, 200, 200] },
  { nm: 550, aw: 0.0565, rgb: [100, 220, 0] },
  { nm: 600, aw: 0.2224, rgb: [255, 170, 0] },
  { nm: 650, aw: 0.34, rgb: [255, 40, 0] },
  { nm: 700, aw: 0.65, rgb: [180, 0, 0] },
];
const LIGHT_PRESETS = { open: 0.04, coastal: 0.2, turbid: 1.2 };

for (const root of document.querySelectorAll("[data-ocean-light]")) {
  const col = root.querySelector("[data-column]");
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { s.kd.set(LIGHT_PRESETS[v], false); draw(); });
  // Particles and dissolved matter add to pure water, more in the blue.
  const kOf = (b, K) => b.aw + Math.max(0.005, K - 0.025) * (0.3 * Math.exp(-0.014 * (b.nm - 550)) + 0.7);
  function draw() {
    const K = s.kd.get();
    const zeu = Math.log(100) / K;
    const tk = niceTicks([0, zeu * 1.25], 4), zStep = tk[1] - tk[0];
    const zMax = Math.ceil((zeu * 1.25) / zStep) * zStep;
    // Colour column: the remaining light at each depth, as an RGB mix.
    col.replaceChildren();
    const T = 20, H = 300, X = 70, W = 70;
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const z = ((i + 0.5) / steps) * zMax;
      let r = 0, g = 0, b = 0, tot = 0;
      for (const band of BANDS) {
        const w = Math.exp(-kOf(band, K) * z);
        r += band.rgb[0] * w; g += band.rgb[1] * w; b += band.rgb[2] * w; tot += 1;
      }
      const bright = Math.exp(-K * z);
      const norm = Math.max(r, g, b, 1);
      const c = (v) => Math.round((v / norm) * 255 * Math.pow(bright, 0.35));
      el("rect", { x: X, y: T + (i / steps) * H, width: W, height: H / steps + 0.6, style: `fill:rgb(${c(r)},${c(g)},${c(b)})` }, col);
    }
    el("rect", { x: X, y: T, width: W, height: H, style: "fill:none;stroke:currentColor;stroke-opacity:.3" }, col);
    for (const z of niceTicks([0, zMax], 4)) {
      const y = T + (z / zMax) * H;
      el("line", { x1: X - 4, x2: X, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:.4" }, col);
      text(col, X - 6, y + 3, `${num(z, z < 10 ? 1 : 0)}`, { "text-anchor": "end" });
    }
    text(col, X - 6, 12, "m", { "text-anchor": "end" });
    const marks = [["10 %", Math.log(10) / K], ["1 % euphotic", zeu], ["Secchi", 1.7 / K]];
    for (const [lab, z] of marks) {
      if (z > zMax) continue;
      const y = T + (z / zMax) * H;
      el("line", { x1: X, x2: X + W + 8, y1: y, y2: y, style: `stroke:${lab.startsWith("1 %") ? BRAND : "currentColor"};stroke-width:1.2;stroke-opacity:.8` }, col);
      text(col, X + W + 10, y + 3, lab, { "text-anchor": "start", style: lab.startsWith("1 %") ? `fill:${BRAND}` : "" });
    }

    plot.replaceChildren();
    const f = frame(plot, { box: [40, 20, 340, 266], x: [-4, 0], y: [zMax, 0], xticks: [-4, -3, -2, -1, 0], yticks: niceTicks([0, zMax], 4), xfmt: (v) => (v === 0 ? "100 %" : `${10 ** (2 + v) >= 1 ? 10 ** (2 + v) : 10 ** (2 + v)} %`), yfmt: (v) => num(v, v < 10 ? 1 : 0), xlabel: "light left (log)", ylabel: "depth (m)" });
    let lastLabel = -99;
    for (const band of BANDS) {
      const k = kOf(band, K), pts = [];
      for (let q = 0; q <= 80; q++) {
        const z = (q / 80) * zMax, l = -k * z / Math.LN10;
        if (l < -4) { pts.push([f.sx(-4), f.sy(4 * Math.LN10 / k)]); break; }
        pts.push([f.sx(l), f.sy(z)]);
      }
      polyline(f.g, pts, `stroke:rgb(${band.rgb.join(",")});stroke-width:1.4;stroke-opacity:.85`);
      const zEnd = Math.min(zMax, (4 * Math.LN10) / k);
      const lx = f.sx(Math.max(-4, (-k * zEnd) / Math.LN10)) + 3, ly = f.sy(zEnd) - 3;
      if (Math.abs(lx + ly - lastLabel) > 16) { text(f.g, lx, ly, `${band.nm}`, { "text-anchor": "start", class: "fill-muted-foreground font-mono text-[9px]" }); lastLabel = lx + ly; }
    }
    polyline(f.g, [[f.sx(0), f.sy(0)], [f.sx(Math.max(-4, (-K * zMax) / Math.LN10)), f.sy(Math.min(zMax, (4 * Math.LN10) / K))]], "stroke:currentColor;stroke-width:2;stroke-dasharray:5 3");
    el("line", { x1: f.sx(-2), x2: f.sx(-2), y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-opacity:.5` }, plot);
    text(plot, f.sx(-2) + 3, f.T + 10, "1 %", { "text-anchor": "start", style: `fill:${BRAND}` });
    text(plot, f.L, 334, "dashed: PAR · labels: wavelength (nm)", { "text-anchor": "start" });

    const z1 = (b) => Math.log(100) / kOf(b, K);
    o.zeu.textContent = `${num(zeu, zeu < 10 ? 1 : 0)} m`;
    o.secchi.textContent = `${num(1.7 / K, 1)} m`;
    o.z10.textContent = `${num(Math.log(10) / K, 1)} m`;
    o.red.textContent = `${num(z1(BANDS[5]), 1)} m`;
    o.blue.textContent = `${num(z1(BANDS[1]), 1)} m`;
  }
  draw();
}

// ============================================================ carbonate

const CARB = { K0: 0.0284, K1: 10 ** -5.85, K2: 10 ** -8.97, KB: 10 ** -8.6, BT: 416e-6, KW: 6.0e-14, CA: 0.01028, KSP: 6.48e-7 };
// carbonate returns the equilibrium state for pCO₂ (µatm) and alkalinity
// (µmol/kg), solving TA = HCO₃⁻ + 2CO₃²⁻ + B(OH)₄⁻ + OH⁻ − H⁺ for H⁺.
export function carbonate(pco2, ta) {
  const co2 = CARB.K0 * pco2 * 1e-6, TA = ta * 1e-6;
  const resid = (H) => co2 * (CARB.K1 / H + (2 * CARB.K1 * CARB.K2) / (H * H)) + (CARB.BT * CARB.KB) / (CARB.KB + H) + CARB.KW / H - H - TA;
  let lo = 6, hi = 10; // pH bracket: resid grows with pH
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    resid(10 ** -mid) > 0 ? (hi = mid) : (lo = mid);
  }
  const pH = (lo + hi) / 2, H = 10 ** -pH;
  const hco3 = (co2 * CARB.K1) / H, co3 = (co2 * CARB.K1 * CARB.K2) / (H * H);
  return { pH, H, co2, hco3, co3, dic: co2 + hco3 + co3, omega: (CARB.CA * co3) / CARB.KSP };
}

for (const root of document.querySelectorAll("[data-ocean-carb]")) {
  const bj = root.querySelector("[data-bjerrum]");
  const om = root.querySelector("[data-omega]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { s.pco2.set(+v, false); draw(); });
  function draw() {
    const ta = s.ta.get(), st = carbonate(s.pco2.get(), ta), base = carbonate(280, ta);
    bj.replaceChildren();
    const f = frame(bj, { box: [40, 14, 580, 170], x: [4, 11], y: [0, 1], xticks: [4, 5, 6, 7, 8, 9, 10, 11], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%`, xlabel: "pH" });
    const a0 = [], a1 = [], a2 = [];
    for (let p = 4; p <= 11.001; p += 0.05) {
      const H = 10 ** -p, d = H * H + CARB.K1 * H + CARB.K1 * CARB.K2;
      a0.push([f.sx(p), f.sy((H * H) / d)]);
      a1.push([f.sx(p), f.sy((CARB.K1 * H) / d)]);
      a2.push([f.sx(p), f.sy((CARB.K1 * CARB.K2) / d)]);
    }
    polyline(f.g, a0, "stroke:var(--vec-out);stroke-width:1.8");
    polyline(f.g, a1, "stroke:var(--vec-u);stroke-width:1.8");
    polyline(f.g, a2, "stroke:var(--vec-v);stroke-width:1.8");
    for (const [lab, pk] of [["pK₁", 5.85], ["pK₂", 8.97]]) {
      el("line", { x1: f.sx(pk), x2: f.sx(pk), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:.25;stroke-dasharray:2 3" }, bj);
      text(bj, f.sx(pk) + 3, f.T + 10, lab, { "text-anchor": "start" });
    }
    el("rect", { x: f.sx(7.8), y: f.T, width: f.sx(8.3) - f.sx(7.8), height: f.H, style: "fill:currentColor;fill-opacity:.05" }, bj);
    text(bj, f.sx(7.78) - 3, f.T + 10, "seawater", { "text-anchor": "end" });
    el("line", { x1: f.sx(st.pH), x2: f.sx(st.pH), y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:1.8` }, bj);
    text(bj, f.sx(st.pH) - 4, f.T + f.H / 2 + 34, `pH ${num(st.pH, 2)}`, { "text-anchor": "end", style: `fill:${BRAND}` });

    om.replaceChildren();
    const g = frame(om, { box: [40, 14, 580, 100], x: [150, 1500], y: [0, 6], xticks: [200, 400, 600, 800, 1000, 1200, 1400], yticks: [0, 1, 2, 3, 4, 5, 6], xlabel: "pCO₂ (µatm)", ylabel: "Ω arag." });
    el("rect", { x: g.L, y: g.sy(1), width: g.W, height: g.sy(0) - g.sy(1), style: "fill:var(--code-del);fill-opacity:.1" }, om);
    text(om, g.L + g.W - 4, g.sy(0.5) + 3, "Ω < 1: aragonite dissolves", { "text-anchor": "end", style: "fill:var(--code-del)" });
    const curve = [];
    for (let p = 150; p <= 1500; p += 10) curve.push([g.sx(p), g.sy(Math.min(6, carbonate(p, ta).omega))]);
    polyline(g.g, curve, "stroke:var(--vec-v);stroke-width:1.8");
    el("circle", { cx: g.sx(s.pco2.get()), cy: g.sy(Math.min(6, st.omega)), r: 4, style: `fill:${BRAND}` }, om);

    o.ph.textContent = num(st.pH, 3);
    o.h.textContent = `${st.H >= base.H ? "+" : "−"}${num(Math.abs(st.H / base.H - 1) * 100, 0)} %`;
    o.dic.textContent = `${num(st.dic * 1e6, 0)} µmol/kg`;
    o.co3.textContent = `${num(st.co3 * 1e6, 0)} µmol/kg`;
    o.omega.textContent = num(st.omega, 2);
    o.omega.className = st.omega < 1 ? "tabular-nums text-del" : "tabular-nums";
  }
  draw();
}
