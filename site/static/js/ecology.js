// Ecology and oceanography blocks. Every number comes from the model named
// in the block: Lotka–Volterra competition, a topological food web,
// MacArthur–Wilson rates, the species–area power law, Shannon and Simpson,
// Lincoln–Petersen and Chapman, the Drossel–Schwabl automaton, UNESCO
// EOS-80, tidal harmonics and the carbonate equilibria.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const minus = (s) => String(s).replace("-", "−");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

let clipN = 0;
/** A clip path for a frame's plotting box, so curves stop at its edge. */
function clipTo(svg, f) {
  const id = `eco-clip-${++clipN}`;
  const cp = el("clipPath", { id }, el("defs", {}, svg));
  el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, cp);
  return el("g", { "clip-path": `url(#${id})` }, svg);
}

/** Client coordinates to SVG user units. */
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// rgbOf resolves a CSS color (vars, oklch) to [r, g, b] for ImageData.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

// ============================================================ Competition

const COMP_PRESETS = {
  coexist: { K1: 100, a12: 0.6, K2: 80, a21: 0.5 },
  one: { K1: 100, a12: 0.5, K2: 80, a21: 1.5 },
  two: { K1: 80, a12: 1.5, K2: 100, a21: 0.5 },
  bistable: { K1: 100, a12: 1.5, K2: 100, a21: 1.5 },
};

/** Which of the four outcomes the isoclines give. */
export function compOutcome(K1, K2, a12, a21) {
  const c1 = a21 > 0 ? K1 > K2 / a21 : false; // species 1 holds where species 2 would stop
  const c2 = a12 > 0 ? K2 > K1 / a12 : false;
  if (c1 && !c2) return "one";
  if (!c1 && c2) return "two";
  if (!c1 && !c2) return "coexist";
  return "bistable";
}

for (const root of document.querySelectorAll("[data-eco-comp]")) {
  const phase = root.querySelector("[data-phase]");
  const time = root.querySelector("[data-time]");
  const o = outs(root);
  let starts = [[10, 10], [140, 15], [15, 140], [150, 150]];
  let active = 0;
  const s = scrubAll(root, draw);

  root.addEventListener("seg-change", (e) => {
    const p = COMP_PRESETS[e.detail.value];
    if (!p) return;
    for (const k in p) s[k].set(p[k], false);
    starts = [[10, 10], [140, 15], [15, 140], [150, 150]];
    active = 0;
    draw();
  });

  function run(n1, n2, P) {
    const f = (x, y) => [P.r1 * x * (1 - (x + P.a12 * y) / P.K1), P.r2 * y * (1 - (y + P.a21 * x) / P.K2)];
    const dt = 0.02, steps = 3000, pts = [[0, n1, n2]];
    for (let i = 1; i <= steps; i++) {
      const k1 = f(n1, n2);
      const k2 = f(n1 + (dt / 2) * k1[0], n2 + (dt / 2) * k1[1]);
      const k3 = f(n1 + (dt / 2) * k2[0], n2 + (dt / 2) * k2[1]);
      const k4 = f(n1 + dt * k3[0], n2 + dt * k3[1]);
      n1 = Math.max(0, n1 + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]));
      n2 = Math.max(0, n2 + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]));
      if (i % 10 === 0) pts.push([i * dt, n1, n2]);
    }
    return pts;
  }

  let f;
  function draw() {
    const P = { K1: s.K1.get(), K2: s.K2.get(), a12: s.a12.get(), a21: s.a21.get(), r1: s.r1.get(), r2: s.r2.get() };
    const top = 1.15 * Math.min(260, Math.max(P.K1, P.K2, 160));
    phase.replaceChildren();
    f = frame(phase, { box: [40, 14, 246, 246], x: [0, top], y: [0, top], xticks: [0, Math.round(top / 2), Math.round(top)], yticks: [0, Math.round(top / 2), Math.round(top)], xlabel: "N₁", ylabel: "N₂" });
    const g = clipTo(phase, f);
    // Isoclines: dN1/dt = 0 on N1 + a12 N2 = K1; dN2/dt = 0 on N2 + a21 N1 = K2.
    const iso1 = P.a12 > 0 ? [[P.K1, 0], [0, P.K1 / P.a12]] : [[P.K1, 0], [P.K1, top * 2]];
    const iso2 = P.a21 > 0 ? [[0, P.K2], [P.K2 / P.a21, 0]] : [[0, P.K2], [top * 2, P.K2]];
    polyline(g, iso1.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--vec-u);stroke-width:2");
    polyline(g, iso2.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:2");
    const runs = starts.map(([a, b]) => run(a, b, P));
    runs.forEach((pts, i) => {
      polyline(g, pts.map((p) => [f.sx(p[1]), f.sy(p[2])]), `stroke:var(--foreground);stroke-width:${i === active ? 1.75 : 1.1};stroke-opacity:${i === active ? 0.9 : 0.45}`);
      el("circle", { cx: f.sx(pts[0][1]), cy: f.sy(pts[0][2]), r: 3, style: "fill:var(--foreground);fill-opacity:0.6" }, g);
      const end = pts.at(-1);
      el("circle", { cx: f.sx(end[1]), cy: f.sy(end[2]), r: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, g);
    });
    const kind = compOutcome(P.K1, P.K2, P.a12, P.a21);
    const det = 1 - P.a12 * P.a21;
    let eq = "";
    if ((kind === "coexist" || kind === "bistable") && Math.abs(det) > 1e-9) {
      const e1 = (P.K1 - P.a12 * P.K2) / det, e2 = (P.K2 - P.a21 * P.K1) / det;
      if (e1 > 0 && e2 > 0) {
        el("circle", { cx: f.sx(e1), cy: f.sy(e2), r: 5, style: kind === "coexist" ? "fill:var(--brand)" : "fill:var(--background);stroke:var(--brand);stroke-width:2" }, g);
        eq = `N₁ = ${num(e1, 1)}, N₂ = ${num(e2, 1)}${kind === "bistable" ? " (saddle)" : ""}`;
      }
    }
    if (kind === "one") eq = `N₁ = K₁ = ${num(P.K1, 0)}, N₂ = 0`;
    if (kind === "two") eq = `N₁ = 0, N₂ = K₂ = ${num(P.K2, 0)}`;
    o.outcome.textContent = { one: "species 1 excludes 2", two: "species 2 excludes 1", coexist: "stable coexistence", bistable: "either wins, by start" }[kind];
    o.eq.textContent = eq || "—";

    time.replaceChildren();
    const pts = runs[active];
    const ymax = Math.max(top, 1);
    const t = frame(time, { box: [40, 14, 246, 246], x: [0, pts.at(-1)[0]], y: [0, ymax], xticks: [0, 20, 40, 60], yticks: [0, Math.round(ymax / 2), Math.round(ymax)], xlabel: "time", ylabel: "N" });
    polyline(time, pts.map((p) => [t.sx(p[0]), t.sy(p[1])]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(time, pts.map((p) => [t.sx(p[0]), t.sy(p[2])]), "stroke:var(--brand);stroke-width:1.75");
  }

  phase.addEventListener("click", (e) => {
    const p = svgPoint(phase, e);
    if (p.x < f.L || p.x > f.L + f.W || p.y < f.T || p.y > f.T + f.H) return;
    // Invert the frame's linear scales (both axes run from 0 to top).
    const top = 1.15 * Math.min(260, Math.max(s.K1.get(), s.K2.get(), 160));
    const n1 = ((p.x - f.L) / f.W) * top, n2 = (1 - (p.y - f.T) / f.H) * top;
    starts = [...starts.slice(-5), [Math.max(0.5, n1), Math.max(0.5, n2)]];
    active = starts.length - 1;
    draw();
  });
  draw();
}

// ============================================================ Food web

// An illustrative kelp-forest web (simplified; links after Estes and
// colleagues' work on otters, urchins and kelp). x is a layout position.
const WEB = [
  { id: "phyto", name: "Phytoplankton", prey: [], x: 0.12 },
  { id: "kelp", name: "Giant kelp", prey: [], x: 0.62 },
  { id: "zoo", name: "Zooplankton", prey: ["phyto"], x: 0.12 },
  { id: "urchin", name: "Sea urchin", prey: ["kelp"], x: 0.52 },
  { id: "abalone", name: "Abalone", prey: ["kelp"], x: 0.8 },
  { id: "fish", name: "Small fish", prey: ["zoo"], x: 0.22 },
  { id: "crab", name: "Crab", prey: ["abalone", "fish"], x: 0.44 },
  { id: "otter", name: "Sea otter", prey: ["urchin", "abalone", "crab"], x: 0.75 },
  { id: "rockfish", name: "Rockfish", prey: ["fish", "crab"], x: 0.24 },
  { id: "seal", name: "Harbour seal", prey: ["rockfish", "fish"], x: 0.38 },
  { id: "orca", name: "Orca", prey: ["seal", "otter"], x: 0.6 },
];
const byId = Object.fromEntries(WEB.map((s) => [s.id, s]));

/** Trophic level: 1 for producers, else 1 + the mean level of the prey. */
export function trophicLevels(web) {
  const tl = {};
  const level = (s) => (tl[s.id] ??= s.prey.length ? 1 + s.prey.reduce((a, p) => a + level(web.find((x) => x.id === p)), 0) / s.prey.length : 1);
  web.forEach(level);
  return tl;
}

/** Secondary extinctions: consumers whose prey are all gone, repeatedly. */
export function cascade(web, removed) {
  const gone = new Set(removed);
  const lost = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of web) {
      if (gone.has(s.id) || !s.prey.length) continue;
      if (s.prey.every((p) => gone.has(p))) { gone.add(s.id); lost.add(s.id); changed = true; }
    }
  }
  const released = new Set();
  for (const s of web) {
    if (gone.has(s.id)) continue;
    const preds = web.filter((x) => x.prey.includes(s.id));
    if (preds.length && preds.every((x) => gone.has(x.id))) released.add(s.id);
  }
  return { gone, lost, released };
}

for (const root of document.querySelectorAll("[data-eco-web]")) {
  const svg = root.querySelector("[data-web]");
  const pyr = root.querySelector("[data-pyramid]");
  const name = root.querySelector("[data-info-name]");
  const info = root.querySelector("[data-info-text]");
  const o = outs(root);
  const tl = trophicLevels(WEB);
  const removed = new Set();
  let focus = null;
  const s = scrubAll(root, drawPyramid);

  const X = (sp) => 40 + sp.x * 480;
  const Y = (sp) => 350 - ((tl[sp.id] - 1) / 4.2) * 310;

  function describe(id) {
    const sp = byId[id];
    const { lost, released } = cascade(WEB, removed);
    const names = (set) => [...set].map((x) => byId[x].name).join(", ");
    name.textContent = `${sp.name} · trophic level ${num(tl[id], 2)}`;
    if (removed.has(id)) {
      const parts = [];
      if (lost.size) parts.push(`Lost with what was removed: ${names(lost)}.`);
      if (released.size) parts.push(`Released from predation: ${names(released)}; without real dynamics we can only say they are no longer eaten.`);
      info.textContent = parts.length ? parts.join(" ") : "Nothing else loses all its food: every consumer of it still has other prey.";
    } else {
      const eats = sp.prey.map((p) => byId[p].name).join(", ") || "sunlight (a producer)";
      const eaten = WEB.filter((x) => x.prey.includes(id)).map((x) => x.name).join(", ") || "nothing here (top predator)";
      info.textContent = `Eats: ${eats}. Eaten by: ${eaten}.${lost.has(id) ? " Lost: all its prey are gone." : ""}${released.has(id) ? " Released: none of its predators are left." : ""}`;
    }
  }

  function draw() {
    svg.replaceChildren();
    const { gone, lost, released } = cascade(WEB, removed);
    for (let k = 1; k <= 5; k++) {
      const y = 350 - ((k - 1) / 4.2) * 310;
      el("line", { x1: 30, x2: 540, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
      text(svg, 30, y - 4, `level ${k}`, {});
    }
    for (const sp of WEB) {
      for (const p of sp.prey) {
        const a = byId[p];
        const off = gone.has(sp.id) || gone.has(p);
        const x1 = X(a), y1 = Y(a), x2 = X(sp), y2 = Y(sp);
        const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        const ex = x2 - ux * 19, ey = y2 - uy * 19;
        el("line", { x1: x1 + ux * 17, y1: y1 + uy * 17, x2: ex, y2: ey, style: `stroke:var(--foreground);stroke-opacity:${off ? 0.12 : 0.35};stroke-width:1.2;${off ? "stroke-dasharray:3 3" : ""}` }, svg);
        if (!off) el("path", { d: `M${ex},${ey} l${-ux * 6 - uy * 3},${-uy * 6 + ux * 3} l${uy * 6},${-ux * 6}Z`, style: "fill:var(--foreground);fill-opacity:0.45" }, svg);
      }
    }
    for (const sp of WEB) {
      const st = removed.has(sp.id) ? "removed" : lost.has(sp.id) ? "lost" : released.has(sp.id) ? "released" : "present";
      const stroke = { removed: "var(--muted-foreground)", lost: "var(--code-del)", released: "var(--vec-out)", present: "var(--foreground)" }[st];
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `${sp.name}, ${st}. Press to ${removed.has(sp.id) ? "restore" : "remove"}.`, "data-sp": sp.id, class: "cursor-pointer outline-none" }, svg);
      el("circle", { cx: X(sp), cy: Y(sp), r: 15, style: `fill:var(--code-bg);stroke:${stroke};stroke-width:${focus === sp.id ? 3 : 1.75};${st === "removed" ? "stroke-dasharray:3 3" : ""}` }, g);
      if (st === "removed" || st === "lost") {
        el("path", { d: `M${X(sp) - 6},${Y(sp) - 6} L${X(sp) + 6},${Y(sp) + 6} M${X(sp) + 6},${Y(sp) - 6} L${X(sp) - 6},${Y(sp) + 6}`, style: `stroke:${stroke};stroke-width:1.75` }, g);
      } else {
        el("circle", { cx: X(sp), cy: Y(sp), r: 4, style: `fill:${stroke}` }, g);
      }
      text(g, X(sp), Y(sp) + 27, sp.name, { "text-anchor": "middle", class: `font-mono text-[10px] ${st === "present" ? "fill-foreground" : "fill-muted-foreground"}` });
    }
    o.left.textContent = `${WEB.length - gone.size} of ${WEB.length}`;
    drawPyramid();
  }

  function drawPyramid() {
    const eff = s.eff.get() / 100, npp = s.npp.get();
    const { gone } = cascade(WEB, removed);
    const present = WEB.filter((x) => !gone.has(x.id));
    const topTL = present.length ? Math.max(...present.map((x) => tl[x.id])) : 0;
    pyr.replaceChildren();
    for (let k = 1; k <= 5; k++) {
      const E = npp * eff ** (k - 1);
      const w = Math.max(2, 140 * Math.sqrt(E / npp));
      const y = 130 - k * 24;
      el("rect", { x: 100 - w / 2, y, width: w, height: 18, rx: 3, style: `fill:var(--brand);fill-opacity:${k <= Math.floor(topTL + 1e-9) ? 0.6 : 0.15}` }, pyr);
      text(pyr, 4, y + 13, `L${k}`, {});
      text(pyr, 236, y + 13, E >= 10 ? Math.round(E).toLocaleString("en") : num(E, 2), { "text-anchor": "end" });
    }
    o.top.textContent = topTL ? `level ${num(topTL, 2)} gets ≈ ${num(npp * eff ** (topTL - 1), topTL > 3 ? 1 : 0)} kJ/m²/yr` : "—";
  }

  const toggle = (id) => {
    removed.has(id) ? removed.delete(id) : removed.add(id);
    focus = id;
    draw();
    describe(id);
    svg.querySelector(`[data-sp="${id}"]`)?.focus();
  };
  svg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-sp]");
    if (g) toggle(g.dataset.sp);
  });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-sp]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(g.dataset.sp); }
  });
  svg.addEventListener("focusin", (e) => {
    const g = e.target.closest("[data-sp]");
    if (g) describe(g.dataset.sp);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => {
    removed.clear();
    focus = null;
    name.textContent = "Click a species";
    info.textContent = "Removing it shows which species lose all their food. Click a removed species to bring it back.";
    draw();
  });
  draw();
}

// ============================================================ Island biogeography

export const islandRates = (d, A) => ({ I0: 2 * Math.exp(-d / 500), E0: 2 * Math.pow(Math.max(A, 1e-6), -0.3) });

for (const root of document.querySelectorAll("[data-eco-island]")) {
  const svg = root.querySelector("[data-rates]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const P = s.pool.get();
    const { I0, E0 } = islandRates(s.dist.get(), s.area.get());
    const ref = islandRates(10, 1000);
    const ymax = 1.1 * Math.max(I0, E0, ref.I0, ref.E0, 0.2);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 270], x: [0, P], y: [0, ymax], xticks: [0, Math.round(P / 2), P], yticks: [0, +num(ymax / 2, 2), +num(ymax, 2)], xlabel: "species present S", ylabel: "species / yr" });
    const g = clipTo(svg, f);
    const line = (a, b, style) => polyline(g, [[f.sx(0), f.sy(a)], [f.sx(P), f.sy(b)]], style);
    line(ref.I0, 0, "stroke:var(--foreground);stroke-opacity:0.25;stroke-width:1.25;stroke-dasharray:5 4");
    line(0, ref.E0, "stroke:var(--foreground);stroke-opacity:0.25;stroke-width:1.25;stroke-dasharray:5 4");
    line(I0, 0, "stroke:var(--vec-u);stroke-width:2");
    line(0, E0, "stroke:var(--code-del);stroke-width:2");
    const S = (P * I0) / (I0 + E0);
    const T = (I0 * E0) / (I0 + E0);
    const Sref = (P * ref.I0) / (ref.I0 + ref.E0);
    el("line", { x1: f.sx(S), x2: f.sx(S), y1: f.sy(T), y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.4;stroke-dasharray:3 3" }, g);
    el("circle", { cx: f.sx(S), cy: f.sy(T), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, g);
    text(svg, f.sx(S), f.T + f.H - 6, `Ŝ = ${num(S, 0)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    el("circle", { cx: f.sx(Sref), cy: f.sy((ref.I0 * ref.E0) / (ref.I0 + ref.E0)), r: 3.5, style: "fill:var(--foreground);fill-opacity:0.3" }, g);
    o.s.textContent = `${num(S, 1)} of ${P} species (reference ${num(Sref, 0)})`;
    o.turnover.textContent = `${num(T, 3)} species / yr`;
    o.rates.textContent = `${num(I0, 3)} / ${num(E0, 3)}`;
  }
  draw();
}

// ============================================================ Species–area

export function fitLogLog(pts) {
  const n = pts.length;
  const xs = pts.map((p) => Math.log10(p[0])), ys = pts.map((p) => Math.log10(p[1]));
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const z = sxy / sxx;
  return { z, c: 10 ** (my - z * mx) };
}

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴" };
const pow10 = (k) => (k === -1 ? "0.1" : k <= 3 ? String(10 ** k) : "10" + String(k).split("").map((c) => SUP[c]).join(""));

for (const root of document.querySelectorAll("[data-eco-sar]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 3;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const c = s.c.get(), z = s.z.get(), noise = s.noise.get();
    const rng = mulberry32(seed * 7919);
    const isles = Array.from({ length: 25 }, () => {
      const A = 10 ** (-1 + 5 * rng());
      return [A, Math.max(1, Math.round(c * A ** z * Math.exp(noise * gauss(rng))))];
    });
    const fit = fitLogLog(isles);
    const ys = isles.map((p) => Math.log10(p[1]));
    const y0 = Math.floor(Math.min(0, ...ys)), y1 = Math.ceil(Math.max(Math.log10(c * 1e4 ** z), ...ys) + 0.2);
    svg.replaceChildren();
    const yt = [];
    for (let k = y0; k <= y1; k++) yt.push(k);
    const f = frame(svg, { box: [44, 14, 500, 270], x: [-1, 4], y: [y0, y1], xticks: [-1, 0, 1, 2, 3, 4], yticks: yt, xfmt: pow10, yfmt: (k) => pow10(k), xlabel: "area (km²)", ylabel: "species" });
    const g = clipTo(svg, f);
    const law = (A) => Math.log10(c * 10 ** (A * z));
    polyline(g, [[f.sx(-1), f.sy(law(-1))], [f.sx(4), f.sy(law(4))]], "stroke:var(--foreground);stroke-width:1.75");
    const fl = (A) => Math.log10(fit.c) + fit.z * A;
    polyline(g, [[f.sx(-1), f.sy(fl(-1))], [f.sx(4), f.sy(fl(4))]], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:6 4");
    for (const [A, S] of isles) el("circle", { cx: f.sx(Math.log10(A)), cy: f.sy(Math.log10(S)), r: 3.5, style: "fill:var(--vec-u);fill-opacity:0.75" }, g);
    const kept = (1 - s.loss.get() / 100) ** z;
    o.fitz.textContent = `${num(fit.z, 3)} (true ${num(z, 2)})`;
    o.kept.textContent = `${num(kept * 100, 1)}% kept, ${num((1 - kept) * 100, 1)}% lost`;
  }
  draw();
}

// ============================================================ Diversity

export function diversity(counts) {
  const n = counts.filter((x) => x > 0);
  const N = n.reduce((a, b) => a + b, 0);
  if (!N) return null;
  const p = n.map((x) => x / N);
  const H = -p.reduce((a, q) => a + q * Math.log(q), 0);
  const D = p.reduce((a, q) => a + q * q, 0);
  return { S: n.length, N, H, J: n.length > 1 ? H / Math.log(n.length) : NaN, expH: Math.exp(H), D, gini: 1 - D, invD: 1 / D };
}

const DIV_PRESETS = { woodland: [40, 25, 15, 10, 6, 4], even: [17, 17, 17, 17, 16, 16], dominated: [90, 3, 2, 2, 2, 1] };

for (const root of document.querySelectorAll("[data-eco-div]")) {
  const svg = root.querySelector("[data-bars]");
  const o = outs(root);
  const names = [...root.querySelectorAll("[data-scrub^=n]")].map((i) => i.closest("label").querySelector("span").textContent);
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    const p = DIV_PRESETS[e.detail.value];
    if (!p) return;
    p.forEach((v, i) => s[`n${i}`].set(v, false));
    draw();
  });

  function draw() {
    const counts = names.map((_, i) => s[`n${i}`].get());
    const d = diversity(counts);
    const N = counts.reduce((a, b) => a + b, 0);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 12, 500, 210], x: [0, names.length], y: [0, 1], xticks: [], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%`, ylabel: "share" });
    names.forEach((nm, i) => {
      const p = N ? counts[i] / N : 0;
      const x0 = f.sx(i) + 10, w = f.sx(1) - f.sx(0) - 20;
      el("rect", { x: x0, y: f.sy(p), width: w, height: f.T + f.H - f.sy(p), rx: 3, style: "fill:var(--brand);fill-opacity:0.7" }, svg);
      text(svg, x0 + w / 2, f.sy(p) - 4, `${num(p * 100, 1)}%`, { "text-anchor": "middle" });
      text(svg, x0 + w / 2, f.T + f.H + 14, nm, { "text-anchor": "middle" });
    });
    if (!d) { for (const k of ["S", "H", "J", "expH", "D", "gini", "invD", "N"]) o[k].textContent = "—"; return; }
    o.S.textContent = d.S;
    o.N.textContent = d.N;
    o.H.textContent = num(d.H, 3);
    o.J.textContent = Number.isFinite(d.J) ? num(d.J, 3) : "—";
    o.expH.textContent = `${num(d.expH, 2)} species`;
    o.D.textContent = num(d.D, 3);
    o.gini.textContent = num(d.gini, 3);
    o.invD.textContent = `${num(d.invD, 2)} species`;
  }
  draw();
}

// ============================================================ Mark and recapture

export const lincolnPetersen = (M, C, R) => (R > 0 ? (M * C) / R : Infinity);
export const chapman = (M, C, R) => ((M + 1) * (C + 1)) / (R + 1) - 1;
export const chapmanVar = (M, C, R) => ((M + 1) * (C + 1) * (M - R) * (C - R)) / ((R + 1) ** 2 * (R + 2));

/** Number of marked fish in a second catch: hypergeometric, by sequential draws. */
function recapture(rng, N, M, C) {
  let m = M, n = N, R = 0;
  for (let k = 0; k < C; k++) {
    if (rng() < m / n) { R++; m--; }
    n--;
  }
  return R;
}

for (const root of document.querySelectorAll("[data-eco-mr]")) {
  const pond = root.querySelector("[data-pond]");
  const hist = root.querySelector("[data-hist]");
  const o = outs(root);
  let seed = 1;
  let repeats = null;
  const s = scrubAll(root, () => { repeats = null; survey(); });

  function params() {
    const N = Math.round(s.N.get());
    return { N, M: Math.min(N, Math.round(s.M.get())), C: Math.min(N, Math.round(s.C.get())) };
  }

  function survey() {
    const { N, M, C } = params();
    const rng = mulberry32(seed * 104729 + N);
    // Fish positions in an elliptical pond, then two random catches.
    const fish = Array.from({ length: N }, () => {
      const a = 2 * Math.PI * rng(), r = Math.sqrt(rng());
      return { x: 150 + 128 * r * Math.cos(a), y: 128 + 100 * r * Math.sin(a), marked: false, caught: false };
    });
    const pick = (k) => {
      const idx = fish.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      return idx.slice(0, k);
    };
    for (const i of pick(M)) fish[i].marked = true;
    for (const i of pick(C)) fish[i].caught = true;
    const R = fish.filter((x) => x.marked && x.caught).length;

    pond.replaceChildren();
    el("ellipse", { cx: 150, cy: 128, rx: 140, ry: 112, style: "fill:color-mix(in oklab, var(--vec-u) 8%, var(--code-bg));stroke:var(--vec-u);stroke-opacity:0.5" }, pond);
    for (const fsh of fish) {
      el("circle", { cx: fsh.x, cy: fsh.y, r: 2.6, style: `fill:${fsh.marked ? "var(--brand)" : "var(--foreground)"};fill-opacity:${fsh.marked ? 0.9 : 0.3}` }, pond);
      if (fsh.caught) el("circle", { cx: fsh.x, cy: fsh.y, r: 5, style: "fill:none;stroke:var(--vec-out);stroke-width:1.25" }, pond);
    }
    text(pond, 8, 252, "● marked", { style: "fill:var(--brand)" });
    text(pond, 70, 252, "○ in the second catch", { style: "fill:var(--vec-out)" });

    const lp = lincolnPetersen(M, C, R), ch = chapman(M, C, R), sd = Math.sqrt(chapmanVar(M, C, R));
    o.R.textContent = `${R} of ${C}`;
    o.lp.textContent = Number.isFinite(lp) ? num(lp, 1) : "∞ (no recaptures)";
    o.ch.textContent = num(ch, 1);
    o.ci.textContent = `${num(Math.max(ch - 1.96 * sd, M + C - R), 0)} to ${num(ch + 1.96 * sd, 0)}`;
    drawHist();
  }

  function drawHist() {
    const { N } = params();
    hist.replaceChildren();
    if (!repeats) {
      text(hist, 150, 130, "Press × 500 to repeat the survey", { "text-anchor": "middle" });
      o.means.textContent = "—";
      return;
    }
    const lo = 0, hi = 3 * N, B = 30;
    const bin = (v) => Math.min(B - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * B)));
    const hl = new Array(B).fill(0), hc = new Array(B).fill(0);
    for (const r of repeats) { if (Number.isFinite(r.lp)) hl[bin(r.lp)]++; hc[bin(r.ch)]++; }
    const top = Math.max(...hl, ...hc, 1);
    const f = frame(hist, { box: [36, 12, 250, 214], x: [lo, hi], y: [0, top], xticks: [0, N, 2 * N, 3 * N], yticks: [0, top], xlabel: "estimated N", ylabel: "surveys" });
    const w = f.sx(hi / B) - f.sx(0);
    hl.forEach((v, i) => el("rect", { x: f.sx(lo + (i * (hi - lo)) / B), y: f.sy(v), width: w / 2, height: f.T + f.H - f.sy(v), style: "fill:var(--vec-u);fill-opacity:0.6" }, hist));
    hc.forEach((v, i) => el("rect", { x: f.sx(lo + (i * (hi - lo)) / B) + w / 2, y: f.sy(v), width: w / 2, height: f.T + f.H - f.sy(v), style: "fill:var(--brand);fill-opacity:0.7" }, hist));
    el("line", { x1: f.sx(N), x2: f.sx(N), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:4 3" }, hist);
    text(hist, f.L + 4, f.T + 10, "■ Lincoln–Petersen", { style: "fill:var(--vec-u)" });
    text(hist, f.L + 4, f.T + 22, "■ Chapman", { style: "fill:var(--brand)" });
    const fin = repeats.filter((r) => Number.isFinite(r.lp));
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    o.means.textContent = `LP ${num(mean(fin.map((r) => r.lp)), 1)}${fin.length < repeats.length ? ` (${repeats.length - fin.length} with R = 0 left out)` : ""}, Chapman ${num(mean(repeats.map((r) => r.ch)), 1)}, true ${N}`;
  }

  root.querySelector("[data-action=survey]").addEventListener("click", () => { seed++; survey(); });
  root.querySelector("[data-action=repeat]").addEventListener("click", () => {
    const { N, M, C } = params();
    const rng = mulberry32(seed * 31 + 7);
    repeats = Array.from({ length: 500 }, () => {
      const R = recapture(rng, N, M, C);
      return { lp: lincolnPetersen(M, C, R), ch: chapman(M, C, R) };
    });
    drawHist();
  });
  survey();
}

// ============================================================ Forest fire

for (const root of document.querySelectorAll("[data-eco-fire]")) {
  const canvas = root.querySelector("[data-canvas]");
  const dens = root.querySelector("[data-density]");
  const btn = root.querySelector("[data-action=play]");
  const o = outs(root);
  const W = 160, H = 106;
  btn.querySelector("[data-label]").textContent = "Run";
  let grid, step, history, peak, rng, playing = false, visible = false, raf = 0, last = 0, colors;
  const s = scrubAll(root, () => {});
  const readColors = () => (colors = { empty: rgbOf("var(--code-bg)"), tree: rgbOf("var(--ion-cl)"), fire: rgbOf("var(--ion-na)") });

  function reset() {
    rng = mulberry32(2024);
    grid = new Uint8Array(W * H);
    for (let i = 0; i < grid.length; i++) grid[i] = rng() < 0.55 ? 1 : 0;
    step = 0; history = []; peak = 0;
    render();
  }

  function advance() {
    const p = s.p.get(), f = s.f.get();
    const next = new Uint8Array(W * H);
    let trees = 0, burning = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, c = grid[i];
        if (c === 2) next[i] = 0;
        else if (c === 1) {
          const lit = (x > 0 && grid[i - 1] === 2) || (x < W - 1 && grid[i + 1] === 2) || (y > 0 && grid[i - W] === 2) || (y < H - 1 && grid[i + W] === 2);
          next[i] = lit || rng() < f ? 2 : 1;
        } else next[i] = rng() < p ? 1 : 0;
        if (next[i] === 1) trees++;
        if (next[i] === 2) burning++;
      }
    }
    grid = next;
    step++;
    peak = Math.max(peak, burning);
    history.push(trees / (W * H));
    if (history.length > 500) history.shift();
  }

  function render() {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H);
    let trees = 0, burning = 0;
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i] === 2 ? colors.fire : grid[i] === 1 ? colors.tree : colors.empty;
      if (grid[i] === 1) trees++;
      if (grid[i] === 2) burning++;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    dens.replaceChildren();
    const f = frame(dens, { box: [36, 6, 516, 56], x: [0, 500], y: [0, 1], xticks: [], yticks: [0, 1] });
    text(dens, f.L + f.W, 16, "tree density, last 500 steps", { "text-anchor": "end" });
    if (history.length > 1) polyline(dens, history.map((v, i) => [f.sx(i), f.sy(v)]), "stroke:var(--ion-cl);stroke-width:1.5");
    o.step.textContent = step;
    o.dens.textContent = `${num((trees / (W * H)) * 100, 1)}%`;
    o.burn.textContent = `${burning} cells`;
    o.big.textContent = `${peak} cells at once`;
  }

  const loop = (now) => {
    if (now - last > 45) { advance(); render(); last = now; }
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const setPlaying = (v) => {
    playing = v;
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", v);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !v);
    btn.querySelector("[data-label]").textContent = v ? "Pause" : "Run";
    if (v && visible && !raf) raf = requestAnimationFrame(loop);
  };
  btn.addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=reset]").addEventListener("click", () => { setPlaying(false); reset(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(loop); }).observe(root);
  new MutationObserver(() => { readColors(); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  readColors();
  reset();
  // A short warm-up so the first picture already shows the model's texture.
  for (let k = 0; k < 120; k++) advance();
  step = 0; history = []; peak = grid.reduce((n, c) => n + (c === 2), 0);
  render();
}

// ============================================================ Seawater

/** Density of seawater at the surface, UNESCO EOS-80 (Millero & Poisson 1981). */
export function rhoSeawater(S, T) {
  const rw = 999.842594 + 6.793952e-2 * T - 9.09529e-3 * T ** 2 + 1.001685e-4 * T ** 3 - 1.120083e-6 * T ** 4 + 6.536332e-9 * T ** 5;
  const A = 8.24493e-1 - 4.0899e-3 * T + 7.6438e-5 * T ** 2 - 8.2467e-7 * T ** 3 + 5.3875e-9 * T ** 4;
  const B = -5.72466e-3 + 1.0227e-4 * T - 1.6546e-6 * T ** 2;
  const C = 4.8314e-4;
  return rw + A * S + B * S ** 1.5 + C * S * S;
}

/** Contour segments of a sampled field at level v (marching squares). */
function contour(grid, nx, ny, v) {
  const segs = [];
  const interp = (a, b, fa, fb) => a + ((v - fa) / (fb - fa)) * (b - a);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const f00 = grid[j * nx + i], f10 = grid[j * nx + i + 1], f01 = grid[(j + 1) * nx + i], f11 = grid[(j + 1) * nx + i + 1];
      const pts = [];
      if ((f00 < v) !== (f10 < v)) pts.push([interp(i, i + 1, f00, f10), j]);
      if ((f10 < v) !== (f11 < v)) pts.push([i + 1, interp(j, j + 1, f10, f11)]);
      if ((f01 < v) !== (f11 < v)) pts.push([interp(i, i + 1, f01, f11), j + 1]);
      if ((f00 < v) !== (f01 < v)) pts.push([i, interp(j, j + 1, f00, f01)]);
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
    }
  }
  return segs;
}

for (const root of document.querySelectorAll("[data-eco-sea]")) {
  const ts = root.querySelector("[data-ts]");
  const prof = root.querySelector("[data-profile]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const SR = [30, 40], TR = [-2, 30];
  const NX = 81, NY = 65;
  const field = new Float64Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) field[j * NX + i] = rhoSeawater(SR[0] + (i / (NX - 1)) * (SR[1] - SR[0]), TR[0] + (j / (NY - 1)) * (TR[1] - TR[0])) - 1000;
  let f, drag = null;

  function draw() {
    const A = { S: s.sA.get(), T: s.tA.get() }, B = { S: s.sB.get(), T: s.tB.get() }, w = s.mix.get() / 100;
    const M = { S: w * A.S + (1 - w) * B.S, T: w * A.T + (1 - w) * B.T };
    const rA = rhoSeawater(A.S, A.T), rB = rhoSeawater(B.S, B.T), rM = rhoSeawater(M.S, M.T);
    ts.replaceChildren();
    f = frame(ts, { box: [40, 14, 326, 270], x: SR, y: TR, xticks: [30, 32, 34, 36, 38, 40], yticks: [0, 10, 20, 30], xlabel: "salinity (g/kg)", ylabel: "T (°C)" });
    const g = clipTo(ts, f);
    const gx = (i) => f.sx(SR[0] + (i / (NX - 1)) * (SR[1] - SR[0])), gy = (j) => f.sy(TR[0] + (j / (NY - 1)) * (TR[1] - TR[0]));
    for (let lv = 18; lv <= 32; lv++) {
      const segs = contour(field, NX, NY, lv);
      if (!segs.length) continue;
      el("path", { d: segs.map(([a, b]) => `M${gx(a[0]).toFixed(1)},${gy(a[1]).toFixed(1)}L${gx(b[0]).toFixed(1)},${gy(b[1]).toFixed(1)}`).join(""), style: `fill:none;stroke:var(--foreground);stroke-opacity:${lv % 2 ? 0.12 : 0.28};stroke-width:1` }, g);
      if (lv % 2 === 0) {
        // Label where the contour meets the top or right edge.
        const end = segs.flat().reduce((best, p) => (p[1] > best[1] || (p[1] === best[1] && p[0] > best[0]) ? p : best));
        text(g, Math.min(gx(end[0]) + 2, f.L + f.W - 30), Math.max(gy(end[1]) + 10, f.T + 10), `σ ${lv}`, {});
      }
    }
    el("line", { x1: f.sx(A.S), y1: f.sy(A.T), x2: f.sx(B.S), y2: f.sy(B.T), style: "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:4 3" }, g);
    for (const [P, lab] of [[A, "A"], [B, "B"]]) {
      const gp = el("g", { "data-drag": lab, class: "cursor-grab" }, ts);
      el("circle", { cx: f.sx(P.S), cy: f.sy(P.T), r: 9, style: "fill:transparent" }, gp);
      el("circle", { cx: f.sx(P.S), cy: f.sy(P.T), r: 5.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, gp);
      text(gp, f.sx(P.S) + 9, f.sy(P.T) - 7, lab, { class: "fill-foreground font-mono text-[11px]" });
    }
    el("circle", { cx: f.sx(M.S), cy: f.sy(M.T), r: 5, style: "fill:var(--brand)" }, ts);
    const lin = w * rA + (1 - w) * rB;
    o.rA.textContent = `${num(rA, 3)} kg/m³ (σ ${num(rA - 1000, 2)})`;
    o.rB.textContent = `${num(rB, 3)} kg/m³ (σ ${num(rB - 1000, 2)})`;
    o.rM.textContent = `${num(rM, 3)} kg/m³ (σ ${num(rM - 1000, 2)})`;
    const extra = rM - lin;
    o.cab.textContent = `${extra >= 0 ? "+" : "−"}${num(Math.abs(extra), 3)} kg/m³ vs the parents' mean${rM > Math.max(rA, rB) + 1e-9 ? ", denser than both: it sinks" : ""}`;
  }

  // Schematic mid-latitude profile.
  function drawProfile() {
    prof.replaceChildren();
    const p = frame(prof, { box: [44, 30, 180, 256], x: [0, 25], y: [-2000, 0], xticks: [0, 10, 20], yticks: [-2000, -1000, 0], yfmt: (v) => `${-v} m`, xlabel: "T (°C)" });
    const Tth = (z) => 4 + 16 * Math.exp(-(z - 80) / 220);
    const Tz = (z) => (z < 80 ? 20 : z < 1000 ? Tth(z) : Tth(1000) - (2 * (z - 1000)) / 1000);
    const Sz = (z) => (z < 80 ? 36.4 : z < 1000 ? 34.6 + 1.8 * Math.exp(-(z - 80) / 300) : 34.7);
    const zs = Array.from({ length: 201 }, (_, i) => i * 10);
    polyline(prof, zs.map((z) => [p.sx(Tz(z)), p.sy(-z)]), "stroke:var(--vec-u);stroke-width:1.75");
    const sx = (S) => p.sx(((S - 34) / 3) * 25);
    polyline(prof, zs.map((z) => [sx(Sz(z)), p.sy(-z)]), "stroke:var(--brand);stroke-width:1.75");
    for (const S of [34, 35, 36, 37]) text(prof, sx(S), 24, String(S), { "text-anchor": "middle" });
    text(prof, p.L + p.W, 12, "S (g/kg)", { "text-anchor": "end", style: "fill:var(--brand)" });
    el("rect", { x: p.L, y: p.sy(-80), width: p.W, height: p.sy(-1000) - p.sy(-80), style: "fill:var(--vec-u);fill-opacity:0.06" }, prof);
    text(prof, p.L + p.W - 4, p.sy(-560), "thermocline", { "text-anchor": "end" });
    text(prof, p.L + 4, p.sy(-40) + 3, "mixed layer", {});
  }

  ts.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-drag]");
    if (!g) return;
    drag = g.dataset.drag;
    ts.setPointerCapture(e.pointerId);
  });
  ts.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = svgPoint(ts, e);
    const S = SR[0] + ((p.x - f.L) / f.W) * (SR[1] - SR[0]);
    const T = TR[1] - ((p.y - f.T) / f.H) * (TR[1] - TR[0]);
    s[`s${drag}`].set(Math.min(40, Math.max(30, S)), false);
    s[`t${drag}`].set(Math.min(30, Math.max(-2, T)), false);
    draw();
  });
  const end = () => (drag = null);
  ts.addEventListener("pointerup", end);
  ts.addEventListener("pointercancel", end);
  drawProfile();
  draw();
}

// ============================================================ Tides

export const TIDE_PERIODS = { M2: 12.4206012, S2: 12, K1: 23.9344696, O1: 25.8193417 };
export const springNeapDays = () => 1 / (1 / TIDE_PERIODS.S2 - 1 / TIDE_PERIODS.M2) / 24;

for (const root of document.querySelectorAll("[data-eco-tide]")) {
  const svg = root.querySelector("[data-curve]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const m2 = s.m2.get(), s2 = s.s2.get(), k1 = s.k1.get(), o1 = s.o1.get(), days = s.days.get();
    const w = (T) => (2 * Math.PI) / T;
    const hgt = (t) => m2 * Math.cos(w(TIDE_PERIODS.M2) * t) + s2 * Math.cos(w(TIDE_PERIODS.S2) * t) + k1 * Math.cos(w(TIDE_PERIODS.K1) * t) + o1 * Math.cos(w(TIDE_PERIODS.O1) * t);
    const dw = w(TIDE_PERIODS.S2) - w(TIDE_PERIODS.M2);
    const env = (t) => Math.sqrt(m2 * m2 + s2 * s2 + 2 * m2 * s2 * Math.cos(dw * t));
    const amp = Math.max(0.5, m2 + s2 + k1 + o1) * 1.1;
    const H = days * 24, n = Math.min(4000, Math.round(H * 4));
    svg.replaceChildren();
    const xt = [];
    for (let d = 0; d <= days; d += days > 30 ? 10 : 5) xt.push(d);
    const f = frame(svg, { box: [44, 14, 500, 250], x: [0, days], y: [-amp, amp], xticks: xt, yticks: [-+num(amp, 1), 0, +num(amp, 1)], xlabel: "days", ylabel: "m" });
    const pts = Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * H; return [f.sx(t / 24), f.sy(hgt(t))]; });
    polyline(svg, pts, "stroke:var(--vec-u);stroke-width:1.1;stroke-linejoin:round");
    const ep = Array.from({ length: 301 }, (_, i) => (i / 300) * H);
    polyline(svg, ep.map((t) => [f.sx(t / 24), f.sy(env(t))]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, ep.map((t) => [f.sx(t / 24), f.sy(-env(t))]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 4");
    hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.2");
    const P = springNeapDays();
    for (let d = 0; d <= days; d += P) text(svg, f.sx(d), f.T + 10, "spring", { "text-anchor": "middle", style: "fill:var(--brand)" });
    o.spring.textContent = `${num(2 * (m2 + s2), 2)} m`;
    o.neap.textContent = `${num(2 * Math.abs(m2 - s2), 2)} m`;
    o.period.textContent = `${num(P, 2)} days`;
    const F = m2 + s2 > 0 ? (k1 + o1) / (m2 + s2) : Infinity;
    o.form.textContent = !Number.isFinite(F) ? "diurnal" : `${num(F, 2)} · ${F < 0.25 ? "semi-diurnal" : F <= 1.5 ? "mixed, mainly semi-diurnal" : F <= 3 ? "mixed, mainly diurnal" : "diurnal"}`;
  }
  draw();
}

// ============================================================ Carbonate system

export function carbonateFractions(pH, pK1, pK2) {
  const Hp = 10 ** -pH, K1 = 10 ** -pK1, K2 = 10 ** -pK2;
  const D = Hp * Hp + K1 * Hp + K1 * K2;
  return [(Hp * Hp) / D, (K1 * Hp) / D, (K1 * K2) / D];
}

for (const root of document.querySelectorAll("[data-eco-co3]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-ph]").forEach((b) => b.addEventListener("click", () => { s.ph.set(+b.dataset.ph, false); draw(); }));

  function draw() {
    const pH = s.ph.get(), pk1 = s.pk1.get(), pk2 = s.pk2.get(), dic = s.dic.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 266], x: [4, 11], y: [0, 1], xticks: [4, 5, 6, 7, 8, 9, 10, 11], yticks: [0, 0.5, 1], yfmt: (v) => `${v * 100}%`, xlabel: "pH", ylabel: "share of DIC" });
    const xs = Array.from({ length: 281 }, (_, i) => 4 + (i / 280) * 7);
    const colors = ["var(--vec-u)", "var(--foreground)", "var(--brand)"];
    for (let k = 0; k < 3; k++) polyline(svg, xs.map((x) => [f.sx(x), f.sy(carbonateFractions(x, pk1, pk2)[k])]), `stroke:${colors[k]};stroke-width:2`);
    for (const pk of [pk1, pk2]) {
      el("line", { x1: f.sx(pk), x2: f.sx(pk), y1: f.sy(0.5) - 4, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
      text(svg, f.sx(pk), f.T + f.H - 4, `pK ${num(pk, 2)}`, { "text-anchor": "middle" });
    }
    el("rect", { x: f.sx(7.8), y: f.T, width: f.sx(8.2) - f.sx(7.8), height: f.H, style: "fill:var(--vec-u);fill-opacity:0.06" }, svg);
    el("line", { x1: f.sx(pH), x2: f.sx(pH), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
    const fr = carbonateFractions(pH, pk1, pk2);
    fr.forEach((v, k) => el("circle", { cx: f.sx(pH), cy: f.sy(v), r: 4, style: `fill:var(--background);stroke:${colors[k]};stroke-width:2` }, svg));
    const fmt = (v) => `${num(v * 100, 2)}% · ${num(v * dic, 1)} µmol/kg`;
    o.co2.textContent = fmt(fr[0]);
    o.hco3.textContent = fmt(fr[1]);
    o.co3.textContent = fmt(fr[2]);
    const ratio = 10 ** (8.2 - pH);
    o.h.textContent = `${ratio >= 1 ? "+" : "−"}${num(Math.abs(ratio - 1) * 100, 0)}% (×${num(ratio, 2)})`;
  }
  draw();
}
