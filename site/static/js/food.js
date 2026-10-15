// Food science blocks. Each one is a small model (Clausius–Clapeyron, the
// heat equation, Stokes' law, colligative properties, stoichiometry) with
// its approximations stated in the block itself.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const presets = (root, s, key, draw, map = (v) => ({ [key]: Number(v) })) =>
  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      for (const [k, v] of Object.entries(map(b.dataset.preset))) s[k].set(v, false);
      draw();
    }));

// ============================================================ Browning

for (const root of document.querySelectorAll("[data-food-maillard]")) {
  const o = outs(root);
  const marker = root.querySelector("[data-marker]");
  const zones = [...root.querySelector("template[data-zones]").content.children].map((d) => ({ lo: +d.dataset.lo, hi: +d.dataset.hi, name: d.dataset.name, what: d.dataset.what }));
  const s = scrubAll(root, draw);
  presets(root, s, "temp", draw);
  function draw() {
    const t = s.temp.get();
    // Overlapping bands: the highest regime already reached wins.
    const z = zones.filter((z) => t > z.lo).at(-1) ?? zones[0];
    marker.style.left = `${(Math.min(260, Math.max(0, t)) / 260) * 100}%`;
    o.zone.textContent = z.name;
    o.t.textContent = `${num(t, 0)} °C`;
    o.what.textContent = z.what;
  }
  draw();
}

// ============================================================ Altitude

const P0 = 101325, R = 8.314462618, HVAP = 40660; // Pa, J/(mol·K), J/mol
const isaPressure = (h) => P0 * (1 - 2.25577e-5 * h) ** 5.25588;
const boilingC = (p) => 1 / (1 / 373.15 - (R * Math.log(p / P0)) / HVAP) - 273.15;

for (const root of document.querySelectorAll("[data-food-altitude]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, s, "alt", draw);
  function draw() {
    const h = s.alt.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 240], x: [0, 9000], y: [65, 102], xticks: [0, 2000, 4000, 6000, 8000], yticks: [70, 80, 90, 100], xlabel: "altitude (m)", ylabel: "boils at (°C)" });
    const pts = [];
    for (let a = 0; a <= 9000; a += 100) pts.push([f.sx(a), f.sy(boilingC(isaPressure(a)))]);
    polyline(svg, pts, "stroke:var(--vec-u);stroke-width:2");
    const p = isaPressure(h), tb = boilingC(p);
    el("line", { x1: f.sx(h), x2: f.sx(h), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(h), cy: f.sy(tb), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, f.sx(h) + 8, f.sy(tb) - 8, `${num(tb, 1)} °C`, { class: "fill-foreground font-mono text-[11px]" });
    o.p.textContent = `${num(p / 1000, 1)} kPa`;
    o.tb.textContent = `${num(tb, 1)} °C`;
    o.dt.textContent = `${num(tb - 100, 1)} °C`;
  }
  draw();
}

// ============================================================ Egg

const ALPHA = 1.4e-7; // m²/s, close to water and egg
const WHITE_SET = 63, YOLK_SET = 65, YOLK_FRAC = 0.65;

// Explicit finite differences for the heat equation in a sphere:
// T_t = α (T_rr + 2/r T_r), with T = Tw at the shell. Returns the radial
// profile every `every` seconds up to `seconds`.
function eggRun(Rmm, T0, Tw, seconds, every = 5) {
  const N = 40, Rm = Rmm / 1000, dr = Rm / N;
  const dt = (0.15 * dr * dr) / ALPHA; // centre node needs dt ≤ dr²/(6α)
  let T = new Float64Array(N + 1).fill(T0);
  T[N] = Tw;
  const frames = [Array.from(T)];
  let next = every;
  for (let t = 0; t < seconds; t += dt) {
    const U = new Float64Array(N + 1);
    U[0] = T[0] + ALPHA * dt * 6 * (T[1] - T[0]) / (dr * dr);
    for (let i = 1; i < N; i++) {
      const r = i * dr;
      U[i] = T[i] + ALPHA * dt * ((T[i + 1] - 2 * T[i] + T[i - 1]) / (dr * dr) + (T[i + 1] - T[i - 1]) / (r * dr));
    }
    U[N] = Tw;
    T = U;
    if (t + dt >= next) { frames.push(Array.from(T)); next += every; }
  }
  return { frames, every, N };
}

for (const root of document.querySelectorAll("[data-food-egg]")) {
  const prof = root.querySelector("[data-profile]");
  const sec = root.querySelector("[data-section]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  let run = null, raf = 0;
  const s = scrubAll(root, (name) => (name === "time" ? draw() : (run = null, draw())));

  const setPlay = (p) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Cook";
  };
  const color = (T, T0, Tw) => `color-mix(in oklab, var(--ion-na) ${Math.round(Math.max(0, Math.min(1, (T - T0) / Math.max(1, Tw - T0))) * 100)}%, var(--vec-u))`;

  function draw() {
    const Rmm = s.r.get(), T0 = s.t0.get(), Tw = s.tw.get();
    run ??= eggRun(Rmm, T0, Tw, 20 * 60);
    const k = Math.min(run.frames.length - 1, Math.round((s.time.get() * 60) / run.every));
    const T = run.frames[k];
    const N = run.N;

    prof.replaceChildren();
    const f = frame(prof, { box: [40, 12, 326, 228], x: [0, Rmm], y: [0, 105], xticks: [0, Math.round(Rmm / 2), Math.round(Rmm)], yticks: [0, 25, 50, 75, 100], xlabel: "distance from centre (mm)", ylabel: "°C" });
    el("rect", { x: f.L, y: f.sy(65), width: f.W, height: f.sy(62) - f.sy(65), style: "fill:var(--vec-out);fill-opacity:0.18" }, prof);
    el("rect", { x: f.L, y: f.sy(70), width: f.W, height: f.sy(65) - f.sy(70), style: "fill:var(--ion-na);fill-opacity:0.12" }, prof);
    text(prof, f.L + f.W - 4, f.sy(63.5) + 3, "white sets", { "text-anchor": "end" });
    text(prof, f.L + f.W - 4, f.sy(68) + 3, "yolk sets", { "text-anchor": "end" });
    el("line", { x1: f.sx(Rmm * YOLK_FRAC), x2: f.sx(Rmm * YOLK_FRAC), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, prof);
    text(prof, f.sx(Rmm * YOLK_FRAC) - 4, f.T + 10, "yolk | white", { "text-anchor": "middle" });
    polyline(prof, T.map((v, i) => [f.sx((i / N) * Rmm), f.sy(v)]), "stroke:var(--foreground);stroke-width:2");

    // Cross-section: concentric rings coloured by temperature.
    sec.replaceChildren();
    const cx = 120, cy = 140, rad = 110;
    for (let i = N; i >= 0; i -= 2) el("circle", { cx, cy, r: (i / N) * rad + 1, style: `fill:${color(T[i], T0, Tw)}` }, sec);
    el("circle", { cx, cy, r: rad * YOLK_FRAC, style: "fill:none;stroke:var(--background);stroke-width:1.5;stroke-dasharray:4 3" }, sec);
    el("circle", { cx, cy, r: rad, style: "fill:none;stroke:currentColor;stroke-opacity:0.4;stroke-width:1.5" }, sec);

    // Readouts: depth of set white, time the yolk centre reaches 65 °C.
    let set = 0;
    for (let i = N; i >= 0 && T[i] >= WHITE_SET; i--) set = ((N - i) / N) * Rmm;
    const yolkAt = run.frames.findIndex((fr) => fr[0] >= YOLK_SET);
    o.centre.textContent = `${num(T[0], 1)} °C`;
    o.white.textContent = set > 0 ? `${num(Math.min(set, Rmm * (1 - YOLK_FRAC)), 1)} mm of ${num(Rmm * (1 - YOLK_FRAC), 1)}${set >= Rmm * (1 - YOLK_FRAC) ? " (all)" : ""}` : "not yet";
    o.yolk.textContent = yolkAt >= 0 ? `${num((yolkAt * run.every) / 60, 1)} min` : Tw < YOLK_SET ? "never at this water temp." : "> 20 min";
  }

  const loop = (t0, m0) => (now) => {
    const m = m0 + (now - t0) / 1000; // 1 minute of cooking per second
    s.time.set(Math.min(20, m), false);
    draw();
    raf = m < 20 ? requestAnimationFrame(loop(t0, m0)) : (setPlay(false), 0);
  };
  btn.addEventListener("click", () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; setPlay(false); return; }
    if (s.time.get() >= 20) s.time.set(0, false);
    if (reduced()) { s.time.set(20, false); draw(); return; }
    setPlay(true);
    raf = requestAnimationFrame(loop(performance.now(), s.time.get()));
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { cancelAnimationFrame(raf); raf = 0; setPlay(false); s.time.set(0, false); draw(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; setPlay(false); } }).observe(root);
  draw();
}

// ============================================================ Sugar stages

for (const root of document.querySelectorAll("[data-food-sugar]")) {
  const rows = [...root.querySelectorAll("li[data-lo]")];
  const o = outs(root);
  const s = scrubAll(root, draw);
  function draw() {
    const t = s.temp.get();
    let hit = null;
    for (const r of rows) {
      const on = t >= +r.dataset.lo && t <= +r.dataset.hi;
      r.toggleAttribute("data-on", on);
      if (on) hit = r;
    }
    if (hit) { o.stage.textContent = `${num(t, 1)} °C: ${hit.querySelector("span.font-medium").textContent}.`; return; }
    if (t < +rows[0].dataset.lo) { o.stage.textContent = `${num(t, 1)} °C: still a thin syrup, below the thread stage.`; return; }
    if (t > +rows.at(-1).dataset.hi) { o.stage.textContent = `${num(t, 1)} °C: past caramel, the sugar burns and turns bitter.`; return; }
    const before = rows.filter((r) => +r.dataset.hi < t).at(-1);
    const after = rows.find((r) => +r.dataset.lo > t);
    o.stage.textContent = `${num(t, 1)} °C: between ${before.querySelector("span.font-medium").textContent.toLowerCase()} and ${after.querySelector("span.font-medium").textContent.toLowerCase()}.`;
  }
  draw();
}

// ============================================================ Leavening

const M_SODA = 84.007, M_TARTAR = 188.177, M_CO2 = 44.009;

for (const root of document.querySelectorAll("[data-food-leaven]")) {
  const o = outs(root);
  const s = scrubAll(root, draw);
  function draw() {
    const n = s.soda.get() / M_SODA; // 1:1 with cream of tartar and with CO₂
    const T = s.temp.get() + 273.15;
    o.mol.textContent = `${num(n * 1000, 1)} mmol`;
    o.tartar.textContent = `${num(n * M_TARTAR, 2)} g`;
    o.co2.textContent = `${num(n * M_CO2, 2)} g`;
    o.vol.textContent = `${num(((n * R * T) / P0) * 1000, 2)} L at ${num(s.temp.get(), 0)} °C`;
  }
  draw();
}

// ============================================================ Baker's percentages

for (const root of document.querySelectorAll("[data-food-bakers]")) {
  const o = outs(root);
  const body = root.querySelector("[data-rows]");
  const s = scrubAll(root, draw);
  function draw() {
    const pct = { water: s.hydration.get(), salt: s.salt.get(), yeast: s.yeast.get(), levain: s.levain.get() };
    const sum = 100 + pct.water + pct.salt + pct.yeast + pct.levain;
    const target = s.target.get();
    const flour = target > 0 ? (target * 100) / sum : s.flour.get();
    const rows = [["Flour", 100], ["Water", pct.water], ["Salt", pct.salt], ["Instant yeast", pct.yeast], ["Levain (100% hydration)", pct.levain]];
    body.replaceChildren();
    for (const [name, p] of rows) {
      if (p === 0 && name !== "Flour") continue;
      const tr = document.createElement("tr");
      tr.className = "border-b last:border-b-0";
      for (const [v, cls] of [[name, "py-1.5 font-sans"], [`${num(p, 1)}%`, "py-1.5 text-right text-muted-foreground"], [`${num((flour * p) / 100, 1)} g`, "py-1.5 text-right"]]) {
        const td = document.createElement("td");
        td.className = cls;
        td.textContent = v;
        tr.append(td);
      }
      body.append(tr);
    }
    const lev = (flour * pct.levain) / 100;
    o.total.textContent = `${num((flour * sum) / 100, 0)} g`;
    o.true.textContent = `${num((((flour * pct.water) / 100 + lev / 2) / (flour + lev / 2)) * 100, 1)}%`;
  }
  draw();
}

// ============================================================ Emulsion

const EMULSION_PRESETS = {
  vinaigrette: { d: 50, mu: 1, drho: 80 },
  milk: { d: 1, mu: 2, drho: 100 },
  mayo: { d: 3, mu: 1000, drho: 80 },
};

for (const root of document.querySelectorAll("[data-food-emulsion]")) {
  const svg = root.querySelector("[data-jar]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  presets(root, s, "d", draw, (k) => EMULSION_PRESETS[k]);
  let drops = [], v = 0, raf = 0, last = 0, visible = false;
  const rng = (() => { let a = 9; return () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  for (let i = 0; i < 60; i++) drops.push({ x: 40 + rng() * 440, y: 40 + rng() * 220, k: 0.6 + rng() * 0.8 });

  function fmtTime(sec) {
    if (sec < 60) return `${num(sec, 1)} s`;
    if (sec < 3600) return `${num(sec / 60, 1)} min`;
    if (sec < 86400) return `${num(sec / 3600, 1)} h`;
    if (sec < 86400 * 365) return `${num(sec / 86400, 1)} days`;
    return `${num(sec / (86400 * 365), 1)} years`;
  }
  function draw() {
    const r = (s.d.get() / 2) * 1e-6, mu = s.mu.get() * 1e-3, drho = s.drho.get();
    v = (2 * drho * 9.81 * r * r) / (9 * mu); // m/s, upward for oil in water
    const t1 = 0.01 / v;
    o.v.textContent = v >= 1e-3 ? `${num(v * 1000, 2)} mm/s` : `${num(v * 1e6, v < 1e-6 ? 4 : 2)} µm/s`;
    o.t1.textContent = fmtTime(t1);
    o.verdict.textContent = t1 < 600 ? "separates quickly" : t1 < 86400 ? "separates within a day" : "practically stable";
    paint();
  }
  // The jar is drawn as a time-lapse: 1 cm of rise is the jar's height, and
  // the speed shown is compressed so it stays watchable.
  function paint() {
    svg.replaceChildren();
    el("rect", { x: 20, y: 20, width: 480, height: 260, rx: 14, style: "fill:var(--vec-out);fill-opacity:0.06;stroke:currentColor;stroke-opacity:0.3" }, svg);
    const rr = Math.max(1.5, Math.min(14, Math.sqrt(s.d.get()) * 1.6));
    for (const d of drops) el("circle", { cx: d.x, cy: d.y, r: rr * d.k, style: "fill:var(--vec-out);fill-opacity:0.55;stroke:var(--vec-out);stroke-opacity:0.8" }, svg);
    const t1 = 0.01 / v;
    text(svg, 488, 270, t1 > 30 ? `time-lapse ×${t1 < 1e6 ? Math.round(t1 / 30) : "10⁵+"}` : "real time", { "text-anchor": "end" });
  }
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const pxPerS = 240 / Math.max(0.5, Math.min(30, 0.01 / v)); // whole jar in ≤ 30 s
    for (const d of drops) { d.y -= pxPerS * dt * d.k; if (d.y < 30) d.y = 270; }
    paint();
    raf = visible ? requestAnimationFrame(step) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !reduced();
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  }).observe(root);
  draw();
}

// ============================================================ Freezing point

const SOLUTES = { nacl: { M: 58.44, i: 2 }, sucrose: { M: 342.3, i: 1 }, glucose: { M: 180.16, i: 1 } };

for (const root of document.querySelectorAll("[data-food-freeze]")) {
  const o = outs(root);
  const bar = root.querySelector("[data-bar]");
  let solute = "nacl";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { solute = e.detail.value; draw(); });
  function draw() {
    const { M, i } = SOLUTES[solute];
    const m = s.g.get() / M / (s.water.get() / 1000);
    const dT = i * 1.86 * m;
    o.m.textContent = `${num(m, 3)} mol/kg`;
    o.i.textContent = String(i);
    o.tf.textContent = `${num(-dT, 2)} °C`;
    bar.style.width = `${Math.min(1, dT / 30) * 83.3}%`;
  }
  draw();
}

// ============================================================ Converter

const GAS = [[1, 140], [2, 150], [3, 170], [4, 180], [5, 190], [6, 200], [7, 220], [8, 230], [9, 240]];

for (const root of document.querySelectorAll("[data-food-convert]")) {
  const o = outs(root);
  const sel = root.querySelector("[data-ingredient]");
  const rows = [...root.querySelectorAll("tr[data-gas]")];
  const s = scrubAll(root, draw);
  sel.addEventListener("change", draw);
  function draw() {
    const cups = s.cups.get() * s.scale.get();
    o.grams.textContent = `${num(cups * Number(sel.value), 0)} g`;
    o.ml.textContent = `${num(cups * 236.6, 0)} mL`;
    const c = s.c.get();
    o.f.textContent = `${num((c * 9) / 5 + 32, 0)} °F`;
    const near = GAS.reduce((b, g) => (Math.abs(g[1] - c) < Math.abs(b[1] - c) ? g : b));
    const ok = Math.abs(near[1] - c) <= 7;
    o.gas.textContent = ok ? String(near[0]) : c < 140 ? "below gas mark 1" : "above gas mark 9";
    rows.forEach((r) => r.toggleAttribute("data-on", ok && +r.dataset.gas === near[0]));
  }
  draw();
}
