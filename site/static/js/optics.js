// Optics and photography blocks. Every number comes from a stated model:
// EV = log2(N²/t), the thin-lens depth of field, 1/f = 1/do + 1/di, paraxial
// ray transfer through two lenses, the Airy pattern [2J1(x)/x]², the angle of
// view 2·atan(w/2f), Malus's law and Snell's law with a Cauchy index for BK7.
// The camera figure lives in ../anatomy/optics-camera.js.

import "../anatomy/optics-camera.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const unitOf = (input) => input?.closest("label")?.querySelector("span.font-mono:last-child, span.w-12");

// Canvas sized to its box (devicePixelRatio ≤ 2).
function fit(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return canvas.getContext("2d");
}
const dark = () => document.documentElement.classList.contains("dark");
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

// Approximate display color of a wavelength (after Dan Bruton's piecewise
// fit), with the intensity falling off at the ends of the visible range.
function waveRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else { r = 1; }
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const c = (v) => Math.round(255 * Math.max(0, v * f) ** 0.8);
  return [c(r), c(g), c(b)];
}
const css = ([r, g, b]) => `rgb(${r},${g},${b})`;
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

// ============================================================ exposure triangle

const EXP_N = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const EXP_T = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const EXP_ISO = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
const tName = (t) => (t >= 1 ? `${t} s` : `1/${Math.round(1 / t)} s`);

for (const root of document.querySelectorAll("[data-opt-exposure]")) {
  const canvas = root.querySelector("[data-scene]");
  const meter = root.querySelector("[data-plot]");
  const o = outs(root);
  let sceneEV = 15;
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { sceneEV = Number(v); draw(); });
  const unit = (k) => unitOf(root.querySelector(`[data-scrub="${k}"]`));

  // A fixed random field for the noise, so it doesn't crawl between redraws.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grain = Array.from({ length: 2400 }, () => [rnd(), rnd(), rnd()]);

  function draw() {
    const ni = Math.round(s.n.get()), ti = Math.round(s.t.get()), ii = Math.round(s.iso.get());
    const N = EXP_N[ni], t = EXP_T[ti], iso = EXP_ISO[ii];
    unit("n").textContent = `f/${N}`;
    unit("t").textContent = tName(t).replace(" s", "");
    unit("iso").textContent = String(iso);
    const ev100 = Math.log2((N * N) / t);
    const over = sceneEV + Math.log2(iso / 100) - ev100; // stops of extra light

    // The picture: background blur ∝ 1/N, motion streak ∝ t, grain ∝ log2(ISO/100).
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height, k = W / 640;
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#9cc4ef");
    sky.addColorStop(1, "#dbe9f7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.filter = `blur(${((16 / N) * 2.2 * k).toFixed(1)}px)`;
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.5) * (W / 9), hgt = H * (0.28 + 0.12 * Math.sin(i * 1.7));
      ctx.fillStyle = i % 2 ? "#3f7a4f" : "#2f6a41";
      ctx.beginPath();
      ctx.ellipse(x, H * 0.62 - hgt * 0.4, W * 0.07, hgt * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6b4f3a";
      ctx.fillRect(x - 4 * k, H * 0.6, 8 * k, H * 0.12);
    }
    ctx.filter = "none";
    ctx.fillStyle = "#7aa35b";
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
    // The subject, in focus: a post with a sign.
    ctx.fillStyle = "#5c4636";
    ctx.fillRect(W * 0.22, H * 0.38, 7 * k, H * 0.42);
    ctx.fillStyle = "#f2efe8";
    ctx.fillRect(W * 0.16, H * 0.3, W * 0.13, H * 0.12);
    ctx.fillStyle = "#3a3a3a";
    for (let r = 0; r < 3; r++) ctx.fillRect(W * 0.175, H * (0.325 + r * 0.03), W * (0.09 - r * 0.02), 3 * k);
    // A ball moving at 4 m/s, ~3 m away: its streak grows with the time.
    const streak = Math.min(W * 0.55, 1400 * t * k);
    const bx = W * 0.55, by = H * 0.78, br = 13 * k;
    const grad = ctx.createLinearGradient(bx, 0, bx + streak, 0);
    grad.addColorStop(0, "rgba(214,48,49,0.15)");
    grad.addColorStop(1, "rgba(214,48,49,1)");
    ctx.fillStyle = streak > 2 ? grad : "#d63031";
    ctx.beginPath();
    ctx.roundRect(bx - br, by - br, streak + 2 * br, 2 * br, br);
    ctx.fill();
    // Exposure: each stop doubles the light; clipped like a real sensor.
    const gain = 2 ** Math.max(-4, Math.min(4, over));
    if (gain > 1) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.92, 1 - 1 / gain)})`; ctx.fillRect(0, 0, W, H); }
    else if (gain < 1) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.94, 1 - gain)})`; ctx.fillRect(0, 0, W, H); }
    // Grain.
    const amount = Math.log2(iso / 100) / 7;
    if (amount > 0) {
      for (const [gx, gy, gv] of grain) {
        ctx.fillStyle = gv > 0.5 ? `rgba(255,255,255,${amount * 0.55})` : `rgba(0,0,0,${amount * 0.55})`;
        ctx.fillRect(gx * W, gy * H, 2 * k, 2 * k);
      }
    }
    ctx.restore();

    // The meter, −3 to +3 stops.
    meter.replaceChildren();
    const f = frame(meter, { box: [40, 10, 560, 26], x: [-3, 3], y: [0, 1], xticks: [-3, -2, -1, 0, 1, 2, 3], yticks: [], xfmt: (v) => (v > 0 ? "+" + v : String(v).replace("-", "−")) });
    for (let v = -3; v <= 3; v += 1 / 3) el("line", { x1: f.sx(v), x2: f.sx(v), y1: f.T + f.H - 6, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35" }, meter);
    const clamped = Math.max(-3.2, Math.min(3.2, over));
    el("path", { d: `M${f.sx(clamped)} ${f.T + 2}l-5 -8h10Z`, style: "fill:var(--brand)" }, meter);
    el("line", { x1: f.sx(clamped), x2: f.sx(clamped), y1: f.T + 2, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:2" }, meter);
    text(meter, f.L, f.T + 6, "under", { "text-anchor": "start" });
    text(meter, f.L + f.W, f.T + 6, "over", { "text-anchor": "end" });

    o.settings.textContent = `f/${N} · ${tName(t)} · ISO ${iso}`;
    o.ev.textContent = num(ev100, 2);
    o.meter.textContent = Math.abs(over) < 0.17 ? "correct" : `${over > 0 ? "+" : "−"}${num(Math.abs(over), 1)} stops ${over > 0 ? "over" : "under"}`;
    const eq = [];
    if (ni > 0 && ti > 0) eq.push(`f/${EXP_N[ni - 1]} · ${tName(EXP_T[ti - 1])}`);
    if (ni < EXP_N.length - 1 && ti < EXP_T.length - 1) eq.push(`f/${EXP_N[ni + 1]} · ${tName(EXP_T[ti + 1])}`);
    o.equiv.textContent = eq.join("  or  ") || "—";
  }
  new ResizeObserver(() => draw()).observe(canvas);
  draw();
}

// ============================================================ depth of field

for (const root of document.querySelectorAll("[data-opt-dof]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let coc = 0.03; // mm
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { coc = Number(v); draw(); });
  const dist = (m) => (m >= 1000 ? "∞" : m >= 10 ? `${num(m, 1)} m` : `${num(m, 2)} m`);

  function limits() {
    const fl = s.f.get(), N = s.n.get(), sub = s.s.get() * 1000; // mm
    const H = (fl * fl) / (N * coc) + fl;
    const near = (sub * (H - fl)) / (H + sub - 2 * fl);
    const far = sub < H ? (sub * (H - fl)) / (H - sub) : Infinity;
    return { H, near, far, sub };
  }
  root.querySelector("[data-action=hyperfocal]").addEventListener("click", () => {
    s.s.set(Math.min(100, limits().H / 1000));
  });

  function draw() {
    const { H, near, far, sub } = limits();
    svg.replaceChildren();
    const lg = (m) => Math.log10(m);
    const X0 = lg(0.25), X1 = lg(200);
    const f = frame(svg, { box: [30, 40, 560, 120], x: [X0, X1], y: [0, 1], xticks: [0.3, 1, 3, 10, 30, 100].map(lg), yticks: [], xfmt: (v) => { const m = 10 ** v; return m < 1 ? String(Math.round(m * 10) / 10) : String(Math.round(m)); }, xlabel: "distance from the camera (m, log scale)" });
    const sx = (mm) => (mm === Infinity || mm / 1000 > 200 ? f.L + f.W + 30 : f.sx(lg(Math.max(250, mm) / 1000)));
    // the infinity column
    text(svg, f.L + f.W + 30, f.T + f.H + 13, "∞", { "text-anchor": "middle" });
    el("line", { x1: f.L + f.W + 30, x2: f.L + f.W + 30, y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
    // the sharp zone
    const x0 = sx(near), x1 = sx(far);
    el("rect", { x: x0, y: f.T + 18, width: Math.max(2, x1 - x0), height: f.H - 36, rx: 4, style: "fill:var(--brand);fill-opacity:0.18;stroke:var(--brand);stroke-width:1.5" }, svg);
    text(svg, x0 + 4, f.T + f.H - 24, "sharp", { "text-anchor": "start", style: "fill:var(--brand)" });
    // hyperfocal
    const xh = sx(H);
    el("line", { x1: xh, x2: xh, y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-dasharray:4 4;stroke-width:1.5" }, svg);
    text(svg, xh + 4, f.T + 10, "H", { "text-anchor": "start", style: "fill:var(--vec-u)" });
    // subject
    const xs = sx(sub);
    el("line", { x1: xs, x2: xs, y1: f.T + 8, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:2" }, svg);
    el("circle", { cx: xs, cy: f.T + 8, r: 4, style: "fill:var(--foreground)" }, svg);
    text(svg, xs, f.T - 8, "subject", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    // the camera at the left edge
    el("rect", { x: 4, y: f.T + f.H / 2 - 9, width: 18, height: 18, rx: 3, style: "fill:none;stroke:currentColor;stroke-opacity:0.6" }, svg);
    el("circle", { cx: 22, cy: f.T + f.H / 2, r: 5, style: "fill:none;stroke:currentColor;stroke-opacity:0.6" }, svg);

    o.h.textContent = dist(H / 1000);
    o.near.textContent = dist(near / 1000);
    o.far.textContent = far === Infinity ? "∞" : dist(far / 1000);
    o.depth.textContent = far === Infinity ? "∞ (to infinity)" : dist((far - near) / 1000);
  }
  draw();
}

// ============================================================ ray diagram

for (const root of document.querySelectorAll("[data-opt-rays]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "converging";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });
  const W = 640, Hh = 300, AX = 150, LX = 400, K = 6; // axis y, element x, px per cm

  // Drag the object along the axis.
  let dragging = false;
  const toX = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()).x; };
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); s.do.set((LX - toX(e)) / K); });
  svg.addEventListener("pointermove", (e) => { if (dragging) s.do.set((LX - toX(e)) / K); });
  svg.addEventListener("pointerup", () => (dragging = false));

  // Clip a ray (point + direction) to the drawing box: returns the far point.
  const toEdge = ([x, y], [dx, dy]) => {
    let t = Infinity;
    if (dx > 1e-9) t = Math.min(t, (W - x) / dx);
    if (dx < -1e-9) t = Math.min(t, -x / dx);
    if (dy > 1e-9) t = Math.min(t, (Hh - y) / dy);
    if (dy < -1e-9) t = Math.min(t, -y / dy);
    return [x + dx * t, y + dy * t];
  };
  const line = (a, b, style) => el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], style }, svg);
  const arrow = (x, y0, y1, style) => {
    line([x, y0], [x, y1], style + ";stroke-width:2.5");
    const d = Math.sign(y1 - y0) || -1;
    el("path", { d: `M${x} ${y1}l-5 ${-d * 8}h10Z`, style: style.replace(/stroke/g, "fill").split(";")[0] }, svg);
  };

  function draw() {
    const mirror = kind === "concave" || kind === "convex";
    const sign = kind === "converging" || kind === "concave" ? 1 : -1;
    const fcm = sign * s.f.get(), dcm = s.do.get(), hcm = s.ho.get();
    const atInf = Math.abs(dcm - fcm) < 0.05;
    const di = atInf ? Infinity : 1 / (1 / fcm - 1 / dcm);
    const m = atInf ? Infinity : -di / dcm;
    svg.replaceChildren();
    // axis, element, focal points
    line([0, AX], [W, AX], "stroke:currentColor;stroke-opacity:0.3");
    const F1 = LX - fcm * K, F2 = LX + fcm * K; // front and back focal points (lens); for a mirror both sit in front
    if (mirror) {
      // A concave mirror's edges reach towards the object, its centre of
      // curvature on the object's side; a convex one bulges towards it.
      const bulge = kind === "concave" ? 16 : -16;
      const xm = (y) => LX + bulge * 0.5 * (1 - ((y - AX) / 110) ** 2);
      el("path", { d: `M${LX} ${AX - 110}Q${LX + bulge} ${AX} ${LX} ${AX + 110}`, style: "fill:none;stroke:var(--foreground);stroke-width:3" }, svg);
      for (let y = AX - 100; y <= AX + 100; y += 12) line([xm(y) + 2, y], [xm(y) + 10, y - 8], "stroke:currentColor;stroke-opacity:0.35");
    } else if (kind === "converging") {
      el("path", { d: `M${LX} ${AX - 110}Q${LX + 16} ${AX} ${LX} ${AX + 110}Q${LX - 16} ${AX} ${LX} ${AX - 110}Z`, style: "fill:var(--vec-u);fill-opacity:0.12;stroke:var(--vec-u);stroke-width:1.5" }, svg);
    } else {
      el("path", { d: `M${LX - 9} ${AX - 110}L${LX + 9} ${AX - 110}Q${LX + 1} ${AX} ${LX + 9} ${AX + 110}L${LX - 9} ${AX + 110}Q${LX - 1} ${AX} ${LX - 9} ${AX - 110}Z`, style: "fill:var(--vec-u);fill-opacity:0.12;stroke:var(--vec-u);stroke-width:1.5" }, svg);
    }
    const focal = mirror ? [[LX - fcm * K, "F"], [LX - 2 * fcm * K, "C"]] : [[F1, "F"], [F2, "F′"], [LX - 2 * fcm * K, "2F"], [LX + 2 * fcm * K, "2F′"]];
    for (const [x, label] of focal) {
      if (x < 4 || x > W - 4) continue;
      el("circle", { cx: x, cy: AX, r: 3, style: "fill:currentColor;fill-opacity:0.6" }, svg);
      text(svg, x, AX + 16, label, { "text-anchor": "middle" });
    }

    // object
    const xo = LX - dcm * K, yo = AX - hcm * K;
    arrow(xo, AX, yo, "stroke:var(--foreground)");
    el("circle", { cx: xo, cy: AX, r: 9, style: "fill:transparent;stroke:var(--foreground);stroke-opacity:0.25;cursor:ew-resize" }, svg);

    // Rays, traced as for a lens; a mirror folds the outgoing side back.
    const fold = ([x, y]) => (mirror ? [2 * LX - x, y] : [x, y]);
    const xi = atInf ? null : LX + di * K, yi = atInf ? null : AX - m * hcm * K;
    const rays = [];
    rays.push(yo); // 1: parallel to the axis
    rays.push(AX); // 2: through the centre (vertex for a mirror)
    // 3: aimed at the front focal point F1, leaves parallel
    const ty = Math.abs(LX - xo) < 1e-6 ? yo : yo + ((AX - yo) * (LX - xo)) / (F1 - xo);
    if (Number.isFinite(ty) && Math.abs(F1 - xo) > 1) rays.push(ty);
    const RAY = "stroke:var(--brand);stroke-width:1.6";
    const VIRT = "stroke:var(--vec-u);stroke-width:1.2;stroke-dasharray:5 4";
    rays.forEach((yl, idx) => {
      const hit = [LX, yl];
      line([xo, yo], hit, RAY);
      // outgoing direction
      let dir;
      if (atInf) dir = [1, (AX - yo) / (LX - xo)]; // all parallel to the central ray
      else if (idx === 0) dir = [LX + fcm * K - LX, AX - yl]; // towards (or from) F2
      else if (idx === 1) dir = [LX - xo, AX - yo];
      else dir = [1, 0];
      if (!atInf && idx === 0 && fcm < 0) dir = [LX - (LX + fcm * K), yl - AX]; // diverging: away from F2 (on the left)
      const n = Math.hypot(...dir);
      dir = [dir[0] / n, dir[1] / n];
      if (mirror) dir = [-dir[0], dir[1]];
      const start = hit;
      const end = toEdge(start, dir);
      line(start, end, RAY);
      // virtual: extend back to the virtual image
      if (!atInf && di < 0) line(hit, fold([xi, yi]), VIRT);
    });
    if (!atInf) {
      const [ix] = fold([xi, yi]);
      if (ix > -200 && ix < W + 200) arrow(ix, AX, yi, di > 0 ? "stroke:var(--foreground)" : "stroke:var(--vec-u)");
    }

    o.di.textContent = atInf ? "∞ (at F)" : `${di > 0 ? "" : "−"}${num(Math.abs(di), 1)} cm`;
    o.m.textContent = atInf ? "∞" : `${num(m, 2)}×`;
    o.kind.textContent = atInf ? "no image (rays parallel)" : `${di > 0 ? "real" : "virtual"}, ${m < 0 ? "inverted" : "upright"}, ${Math.abs(m) > 1.005 ? "enlarged" : Math.abs(m) < 0.995 ? "reduced" : "same size"}`;
  }
  draw();
}

// ============================================================ telescope and microscope

for (const root of document.querySelectorAll("[data-opt-instr]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "telescope";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => {
    kind = v;
    if (v === "telescope") { s.fo.set(900, false); s.fe.set(25, false); s.d.set(90, false); }
    else { s.fo.set(4, false); s.fe.set(25, false); s.d.set(10, false); }
    draw();
  });
  const TUBE = 160; // mm, optical tube length (microscope)

  function draw() {
    const fo = s.fo.get(), fe = s.fe.get(), D = s.d.get();
    svg.replaceChildren();
    const AX = 130, X0 = 50, X1 = 600;
    let rays, L, objX, M;
    if (kind === "telescope") {
      L = fo + fe;
      M = fo / fe;
      const a = 0.012; // incoming angle (rad), small
      rays = [-D / 2, 0, D / 2].map((y0) => {
        // before the objective: from the left edge, slope a
        const s1 = a - y0 / fo, ye = y0 + s1 * L, s2 = s1 - ye / fe;
        return { y0, s0: a, s1, ye, s2 };
      });
      objX = 0;
    } else {
      const di = fo + TUBE; // intermediate image distance
      const dObj = 1 / (1 / fo - 1 / di);
      L = di + fe; // objective to eyepiece
      M = (TUBE / fo) * (250 / fe);
      const h0 = 0.05 * fo; // a small object
      rays = [-D / 2, 0, D / 2].map((y0) => {
        const s0 = (y0 - h0) / dObj; // from the object tip to the objective at height y0
        const s1 = s0 - y0 / fo, ye = y0 + s1 * L, s2 = s1 - ye / fe;
        return { y0, s0, s1, ye, s2, dObj, h0 };
      });
      objX = rays[0].dObj;
    }
    const span = objX + L + fe * 1.2;
    const sx = (mm) => X0 + ((mm + objX) / span) * (X1 - X0); // mm from the objective
    const yMax = Math.max(D / 2, ...rays.map((r) => Math.abs(r.ye))) * 1.25 || 1;
    const sy = (mm) => AX - (mm / yMax) * 100;
    el("line", { x1: 0, x2: 640, y1: AX, y2: AX, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    const lens = (xmm, half, label) => {
      const x = sx(xmm), h = Math.max(14, Math.abs(sy(half) - AX));
      el("path", { d: `M${x} ${AX - h}Q${x + 8} ${AX} ${x} ${AX + h}Q${x - 8} ${AX} ${x} ${AX - h}Z`, style: "fill:var(--vec-u);fill-opacity:0.14;stroke:var(--vec-u);stroke-width:1.5" }, svg);
      text(svg, x, AX + h + 14, label, { "text-anchor": "middle" });
    };
    lens(0, D / 2, "objective");
    lens(L, Math.max(...rays.map((r) => Math.abs(r.ye))) * 1.1, "eyepiece");
    const RAY = "stroke:var(--brand);stroke-width:1.4";
    for (const r of rays) {
      const pts = [];
      if (kind === "telescope") pts.push([sx(-objX - span * 0.08), sy(r.y0 - r.s0 * span * 0.08)]);
      else pts.push([sx(-objX), sy(r.h0)]);
      pts.push([sx(0), sy(r.y0)], [sx(L), sy(r.ye)]);
      // leave the eyepiece along slope s2, for a fixed 70 px on screen
      const kx = (X1 - X0) / span, ky = 100 / yMax, run = 70 / kx;
      pts.push([sx(L) + 70, sy(r.ye + r.s2 * run)]);
      polyline(svg, pts, RAY);
      void ky;
    }
    if (kind === "microscope") {
      el("line", { x1: sx(-objX), x2: sx(-objX), y1: AX, y2: sy(rays[0].h0), style: "stroke:var(--foreground);stroke-width:2" }, svg);
      text(svg, sx(-objX), AX + 14, "object", { "text-anchor": "middle" });
    }
    text(svg, 620, 20, "vertical scale exaggerated", { "text-anchor": "end" });
    o.m.textContent = `${num(M, 1)}×`;
    o.len.textContent = kind === "telescope" ? `${num(L, 0)} mm` : `≈ ${num(L + objX, 0)} mm`;
    o.pupil.textContent = kind === "telescope" ? `${num(D / M, 2)} mm` : "—";
    o.note.textContent = kind === "telescope" ? (D / M > 7 ? "pupil wider than an eye's (≈ 7 mm)" : D / M < 0.7 ? "very dim: empty magnification" : "fits the eye's pupil") : `objective ${num(TUBE / fo, 0)}× · eyepiece ${num(250 / fe, 0)}×`;
  }
  draw();
}

// ============================================================ Airy disk

// J1 by its integral J1(x) = (1/π)∫0^π cos(τ − x sin τ) dτ (Simpson, 200 steps).
function besselJ1(x) {
  const n = 200, h = Math.PI / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const tau = i * h, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    sum += w * Math.cos(tau - x * Math.sin(tau));
  }
  return (sum * h) / 3 / Math.PI;
}
const airy = (x) => (Math.abs(x) < 1e-6 ? 1 : ((2 * besselJ1(x)) / x) ** 2);

for (const root of document.querySelectorAll("[data-opt-airy]")) {
  const svg = root.querySelector("[data-plot]");
  const canvas = root.querySelector("[data-disk]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const FIELD = 40; // µm across the disk view

  function draw() {
    const lam = s.lambda.get() / 1000, N = s.n.get(), pitch = s.pitch.get(); // µm
    const r1 = 1.22 * lam * N; // first zero, µm
    const xOf = (r) => (Math.PI * r) / (lam * N);
    svg.replaceChildren();
    const R = Math.max(12, 3.3 * r1);
    const f = frame(svg, { box: [40, 16, 340, 200], x: [0, R], y: [0, 1], xticks: [0, R / 4, R / 2, (3 * R) / 4, R].map((v) => Math.round(v)), yticks: [0, 0.5, 1], xlabel: "radius on the sensor (µm)", ylabel: "I / I₀" });
    const col = css(waveRGB(s.lambda.get()));
    const pts = Array.from({ length: 241 }, (_, i) => { const r = (i / 240) * R; return [f.sx(r), f.sy(airy(xOf(r)))]; });
    polyline(svg, pts, `stroke:${col};stroke-width:2`);
    el("line", { x1: f.sx(r1), x2: f.sx(r1), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:4 4" }, svg);
    text(svg, f.sx(r1) + 4, f.T + 12, "1.22 λN", { "text-anchor": "start", style: "fill:var(--brand)" });
    el("line", { x1: f.sx(pitch), x2: f.sx(pitch), y1: f.T, y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-width:1.5" }, svg);
    text(svg, f.sx(pitch) + 4, f.T + 26, "1 pixel", { "text-anchor": "start", style: "fill:var(--vec-u)" });

    // The disk over the pixel grid.
    const ctx = fit(canvas);
    const W = canvas.width, scale = W / FIELD, c = W / 2;
    const img = ctx.createImageData(W, W);
    const [cr, cg, cb] = waveRGB(s.lambda.get());
    const bg = dark() ? 12 : 250;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - c, y - c) / scale;
      const v = Math.min(1, airy(xOf(r)) * 1.0 + 0) ** 0.5;
      const i = (y * W + x) * 4;
      img.data[i] = bg + (cr - bg) * v; img.data[i + 1] = bg + (cg - bg) * v; img.data[i + 2] = bg + (cb - bg) * v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = dark() ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    for (let g = c % (pitch * scale); g < W; g += pitch * scale) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke();
    }

    o.disk.textContent = `${num(2 * r1, 1)} µm`;
    o.pixels.textContent = `${num((2 * r1) / pitch, 1)} px wide`;
    o.zero.textContent = `${num(r1, 2)} µm`;
    o.limit.textContent = `≈ f/${num((2 * pitch) / (2.44 * lam), 1)} (disk = 2 px)`;
  }
  new ResizeObserver(() => draw()).observe(canvas);
  onTheme(draw);
  draw();
}

// ============================================================ field of view

const SENSORS = { 36: [36, 24], 23.5: [23.5, 15.6], 17.3: [17.3, 13], 13.2: [13.2, 8.8] };
const FF_DIAG = Math.hypot(36, 24);

for (const root of document.querySelectorAll("[data-opt-fov]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let sensor = SENSORS[36];
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { sensor = SENSORS[v]; draw(); });
  root.querySelectorAll("[data-lens]").forEach((b) => b.addEventListener("click", () => s.f.set(Number(b.dataset.lens))));

  function draw() {
    const fl = s.f.get(), [w, hgt] = sensor;
    const hfov = 2 * Math.atan(w / (2 * fl)), dfov = 2 * Math.atan(Math.hypot(w, hgt) / (2 * fl));
    const ffov = 2 * Math.atan(36 / (2 * fl));
    const crop = FF_DIAG / Math.hypot(w, hgt);
    svg.replaceChildren();
    const cx = 320, cy = 262, R = 230;
    const cone = (a, style) => {
      const p1 = [cx - R * Math.sin(a / 2), cy - R * Math.cos(a / 2)], p2 = [cx + R * Math.sin(a / 2), cy - R * Math.cos(a / 2)];
      const large = a > Math.PI ? 1 : 0;
      el("path", { d: `M${cx} ${cy}L${p1[0]} ${p1[1]}A${R} ${R} 0 ${large} 1 ${p2[0]} ${p2[1]}Z`, style }, svg);
    };
    if (crop > 1.01) cone(ffov, "fill:currentColor;fill-opacity:0.05;stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4");
    cone(hfov, "fill:var(--brand);fill-opacity:0.16;stroke:var(--brand);stroke-width:1.5");
    el("rect", { x: cx - 16, y: cy - 4, width: 32, height: 16, rx: 3, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.6" }, svg);
    el("rect", { x: cx - 8, y: cy - 10, width: 16, height: 6, rx: 1, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.6" }, svg);
    text(svg, cx, cy - R * 0.55, `${num(deg(hfov), 1)}°`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    if (crop > 1.01) text(svg, cx + R * Math.sin(ffov / 2) * 0.8 + 6, cy - R * Math.cos(ffov / 2) * 0.8, "full frame", { "text-anchor": "start" });
    o.hfov.textContent = `${num(deg(hfov), 1)}°`;
    o.dfov.textContent = `${num(deg(dfov), 1)}°`;
    o.crop.textContent = `${num(crop, 2)}×`;
    o.equiv.textContent = `${num(fl * crop, 0)} mm`;
  }
  draw();
}

// ============================================================ color and light

const BANDS = [[380, "violet"], [450, "blue"], [495, "green"], [570, "yellow"], [590, "orange"], [620, "red"]];

for (const root of document.querySelectorAll("[data-opt-color]")) {
  const mix = root.querySelector("[data-mix]");
  const spec = root.querySelector("[data-spectrum]");
  const o = outs(root);
  let mode = "additive";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { mode = v; draw(); });
  const units = ["a", "b", "c"].map((k) => unitOf(root.querySelector(`[data-scrub="${k}"]`)));
  const labelOf = (k) => root.querySelector(`[data-scrub="${k}"]`)?.closest("label")?.querySelector("span");
  spec.addEventListener("click", (e) => { const r = spec.getBoundingClientRect(); s.lambda.set(380 + ((e.clientX - r.left) / r.width) * 370); });

  function draw() {
    const v = ["a", "b", "c"].map((k) => s[k].get() / 100);
    const names = mode === "additive" ? ["Red", "Green", "Blue"] : ["Cyan", "Magenta", "Yellow"];
    ["a", "b", "c"].forEach((k, i) => { const l = labelOf(k); if (l) l.textContent = names[i]; units[i].textContent = "%"; });
    const ctx = fit(mix);
    const W = mix.width, H = mix.height, r = Math.min(W, H) * 0.3;
    const centers = [[W / 2, H / 2 - r * 0.5], [W / 2 - r * 0.55, H / 2 + r * 0.42], [W / 2 + r * 0.55, H / 2 + r * 0.42]];
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = mode === "additive" ? "#000" : "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = mode === "additive" ? "lighter" : "multiply";
    const colors = mode === "additive"
      ? v.map((x, i) => [i === 0 ? 255 * x : 0, i === 1 ? 255 * x : 0, i === 2 ? 255 * x : 0])
      : v.map((x, i) => [i === 0 ? 255 * (1 - x) : 255, i === 1 ? 255 * (1 - x) : 255, i === 2 ? 255 * (1 - x) : 255]);
    centers.forEach(([x, y], i) => { ctx.fillStyle = css(colors[i].map(Math.round)); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalCompositeOperation = "source-over";
    const center = mode === "additive" ? colors.reduce((a, c) => a.map((x, i) => Math.min(255, x + c[i])), [0, 0, 0]) : colors.reduce((a, c) => a.map((x, i) => (x * c[i]) / 255), [255, 255, 255]);
    o.center.textContent = hex(center);

    // spectrum strip
    const sc = fit(spec);
    const SW = spec.width, SH = spec.height;
    for (let x = 0; x < SW; x++) { sc.fillStyle = css(waveRGB(380 + (x / SW) * 370)); sc.fillRect(x, 0, 1, SH); }
    const lam = s.lambda.get(), mx = ((lam - 380) / 370) * SW;
    sc.fillStyle = dark() ? "#fff" : "#000";
    sc.fillRect(mx - 1.5, 0, 3, SH);
    o.lambda.textContent = `${num(lam, 0)} nm ≈ ${hex(waveRGB(lam))}`;
    o.band.textContent = [...BANDS].reverse().find(([from]) => lam >= from)?.[1] ?? "—";
  }
  new ResizeObserver(() => draw()).observe(mix);
  onTheme(draw);
  draw();
}

// ============================================================ polarization

for (const root of document.querySelectorAll("[data-opt-polar]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mid = true;
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { mid = e.detail.checked; draw(); }));

  const frac = (x) => {
    if (x < 1e-6) return "0";
    for (let d = 1; d <= 64; d++) { const n = Math.round(x * d); if (n > 0 && Math.abs(n / d - x) < 5e-4) return `${n}/${d}`; }
    return num(x, 3);
  };

  function draw() {
    const a1 = s.a1.get(), a2 = s.a2.get(), a3 = s.a3.get();
    const i1 = 0.5;
    const i2 = mid ? i1 * Math.cos(rad(a2 - a1)) ** 2 : i1;
    const i3 = i2 * Math.cos(rad(a3 - (mid ? a2 : a1))) ** 2;
    svg.replaceChildren();
    const AX = 100;
    const stages = [[60, 1, null, "unpolarized"], [210, i1, a1, "first"], [360, i2, mid ? a2 : null, "middle"], [510, i3, a3, "last"]];
    // the beam, its thickness and opacity following the intensity
    for (let k = 0; k < stages.length; k++) {
      const [x, I] = stages[k];
      const x2 = k < stages.length - 1 ? stages[k + 1][0] : 620;
      if (I <= 1e-4) continue;
      el("rect", { x, y: AX - 10 * Math.sqrt(I), width: x2 - x, height: 20 * Math.sqrt(I), style: `fill:var(--vec-out);fill-opacity:${0.15 + 0.6 * I}` }, svg);
    }
    stages.slice(1).forEach(([x, , ang, label]) => {
      const present = ang !== null;
      el("ellipse", { cx: x, cy: AX, rx: 14, ry: 46, style: `fill:var(--background);fill-opacity:0.65;stroke:currentColor;stroke-opacity:${present ? 0.7 : 0.15}` }, svg);
      if (present) {
        // transmission axis, foreshortened: the disk is seen at an angle
        const t = rad(ang);
        el("line", { x1: x - 13 * Math.sin(t) * 0.3, y1: AX - 42 * Math.cos(t), x2: x + 13 * Math.sin(t) * 0.3, y2: AX + 42 * Math.cos(t), style: "stroke:var(--brand);stroke-width:2.5;stroke-linecap:round" }, svg);
        text(svg, x, AX + 64, `${num(ang, 0)}°`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      }
      text(svg, x, AX - 56, present ? label : `${label} (out)`, { "text-anchor": "middle" });
    });
    // intensity bars
    const bars = [["in", 1], ["1", i1], ["2", i2], ["out", i3]];
    bars.forEach(([lab, I], k) => {
      const x = 160 + k * 110, top = 190;
      el("rect", { x, y: top, width: 80, height: 12, rx: 3, style: "fill:currentColor;fill-opacity:0.07" }, svg);
      el("rect", { x, y: top, width: 80 * I, height: 12, rx: 3, style: "fill:var(--vec-out)" }, svg);
      text(svg, x, top - 4, `${lab}: ${num(I * 100, 1)}%`, { "text-anchor": "start" });
    });
    o.i1.textContent = `${num(i1 * 100, 1)}%`;
    o.i2.textContent = mid ? `${num(i2 * 100, 1)}%` : "— (removed)";
    o.i3.textContent = `${num(i3 * 100, 2)}%`;
    o.frac.textContent = frac(i3);
  }
  draw();
}

// ============================================================ prism

const cauchy = (nm) => 1.5046 + 0.0042 / (nm / 1000) ** 2;
const WAVES = [400, 450, 500, 550, 600, 650, 700];

for (const root of document.querySelectorAll("[data-opt-prism]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=min]").addEventListener("click", () => {
    const A = rad(s.apex.get());
    s.inc.set(deg(Math.asin(Math.min(1, cauchy(589) * Math.sin(A / 2)))));
  });

  // Snell in vector form: d incident unit, n surface normal (unit, against d), eta = n1/n2.
  function refract([dx, dy], [nx, ny], eta) {
    const cosi = -(nx * dx + ny * dy);
    const k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return null;
    const c = eta * cosi - Math.sqrt(k);
    return [eta * dx + c * nx, eta * dy + c * ny];
  }
  // Deviation for one wavelength, by the angle formulas.
  function deviation(nm, A, i) {
    const n = cauchy(nm);
    const r1 = Math.asin(Math.sin(i) / n), r2 = A - r1;
    if (n * Math.sin(r2) >= 1) return null;
    return i + Math.asin(n * Math.sin(r2)) - A;
  }

  function draw() {
    const A = rad(s.apex.get()), inc = rad(s.inc.get());
    svg.replaceChildren();
    // Prism: apex at the top, base horizontal.
    const cx = 300, base = 250, side = 230;
    const apex = [cx, base - side * Math.cos(A / 2)];
    const left = [cx - side * Math.sin(A / 2), base], right = [cx + side * Math.sin(A / 2), base];
    el("path", { d: `M${apex[0]} ${apex[1]}L${right[0]} ${right[1]}L${left[0]} ${left[1]}Z`, style: "fill:var(--vec-u);fill-opacity:0.1;stroke:var(--vec-u);stroke-width:1.5;stroke-linejoin:round" }, svg);
    // left face: outward normal (pointing up-left)
    const lf = [apex[0] - left[0], apex[1] - left[1]], lfl = Math.hypot(...lf);
    const lu = [lf[0] / lfl, lf[1] / lfl];
    const nOut = [lu[1], -lu[0]]; // rotate the face direction: outward to the left
    const hitL = [left[0] + lu[0] * side * 0.55, left[1] + lu[1] * side * 0.55];
    // incident direction: angle inc from the inward normal (−nOut), turned towards the base
    const nIn = [-nOut[0], -nOut[1]];
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    const dIn = rot(nIn, -inc);
    const startP = [hitL[0] - dIn[0] * 400, hitL[1] - dIn[1] * 400];
    el("line", { x1: startP[0], y1: startP[1], x2: hitL[0], y2: hitL[1], style: "stroke:var(--foreground);stroke-width:2.5" }, svg);
    // right face
    const rf = [right[0] - apex[0], right[1] - apex[1]], rfl = Math.hypot(...rf);
    const ru = [rf[0] / rfl, rf[1] / rfl];
    const nOutR = [ru[1], -ru[0]]; // outward: up and to the right
    const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
    for (const nm of WAVES) {
      const n = cauchy(nm);
      const d1 = refract(dIn, nOut, 1 / n);
      if (!d1) continue;
      // intersect with the right face: hitL + t d1 = apex + u rf
      const t = cross([apex[0] - hitL[0], apex[1] - hitL[1]], rf) / cross(d1, rf);
      const hitR = [hitL[0] + d1[0] * t, hitL[1] + d1[1] * t];
      const col = css(waveRGB(nm));
      el("line", { x1: hitL[0], y1: hitL[1], x2: hitR[0], y2: hitR[1], style: `stroke:${col};stroke-width:1.2;stroke-opacity:0.8` }, svg);
      const d2 = refract(d1, [-nOutR[0], -nOutR[1]], n);
      if (!d2) { text(svg, hitR[0] + 6, hitR[1], "total internal reflection", { "text-anchor": "start", style: "fill:var(--code-del)" }); continue; }
      el("line", { x1: hitR[0], y1: hitR[1], x2: hitR[0] + d2[0] * 420, y2: hitR[1] + d2[1] * 420, style: `stroke:${col};stroke-width:2` }, svg);
    }
    const d589 = deviation(589, A, inc), d400 = deviation(400, A, inc), d700 = deviation(700, A, inc);
    o.nred.textContent = num(cauchy(656.3), 4);
    o.nblue.textContent = num(cauchy(486.1), 4);
    o.dev.textContent = d589 === null ? "TIR" : `${num(deg(d589), 2)}° (589 nm)`;
    o.spread.textContent = d400 === null || d700 === null ? "—" : `${num(deg(d400 - d700), 2)}° (400–700 nm)`;
  }
  draw();
}
