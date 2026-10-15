// Electromagnetism & circuits blocks. SI throughout; constants below.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { P, line, arrow, handle, reducedMotion } from "./svg.js";

const K = 8.9875517923e9; // Coulomb constant, N·m²/C²
const EPS0 = 8.8541878128e-12; // F/m
const MU0 = 1.25663706212e-6; // N/A²
const C = 299792458; // m/s, exact
const H = 6.62607015e-34; // J·s, exact
const EV = 1.602176634e-19; // J, exact

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

// si formats a value with an SI prefix: si(0.0021, "A") → "2.10 mA".
const PREFIX = [[1e12, "T"], [1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
function si(v, unit, digits = 3) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return `0 ${unit}`;
  const a = Math.abs(v);
  const [f, p] = PREFIX.find(([f]) => a >= f * 0.9995) ?? PREFIX.at(-1);
  return `${Number((v / f).toPrecision(digits)).toString().replace("-", "−")} ${p}${unit}`;
}
const sci = (v, d = 3) => {
  if (!Number.isFinite(v)) return "—";
  const [m, e] = v.toExponential(d - 1).split("e");
  return `${m.replace("-", "−")} × 10${sup(Number(e))}`;
};
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map((c) => SUP[c]).join("");

// rgbOf resolves a CSS colour to [r, g, b] by painting one pixel.
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

function playToggle(btn) {
  const lbl = btn.querySelector("[data-label]");
  return (on) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    lbl.textContent = on ? "Pause" : lbl.dataset.idle;
  };
}

// A real-time animation loop that runs only while visible and playing.
function animator(root, step) {
  let playing = false, visible = false, raf = 0, last = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    raf = playing && visible ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return { set(p) { playing = p; kick(); }, get playing() { return playing; } };
}

// ============================================================ Field and potential

const PRESETS = {
  dipole: [[-1.5, 0, 1], [1.5, 0, -1]],
  like: [[-1.5, 0, 1], [1.5, 0, 1]],
  quad: [[-1.5, -1.5, 1], [1.5, -1.5, -1], [1.5, 1.5, 1], [-1.5, 1.5, -1]],
};

for (const root of document.querySelectorAll("[data-em-field]")) {
  const canvas = root.querySelector("[data-canvas]");
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const show = { lines: true, potential: true };
  let charges = PRESETS.dipole.map((c) => [...c]);
  const layer = el("g", {}, svg);
  const top = el("g", {}, svg);
  let handles = [];

  // World units are cm, charges nC. V in volts, E in V/m.
  const fieldAt = (x, y) => {
    let ex = 0, ey = 0, v = 0;
    for (const [cx, cy, q] of charges) {
      const dx = (x - cx) / 100, dy = (y - cy) / 100; // m
      const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
      if (r < 1e-6) continue;
      const kq = K * q * 1e-9;
      v += kq / r;
      ex += (kq * dx) / (r2 * r);
      ey += (kq * dy) / (r2 * r);
    }
    return [ex, ey, v];
  };

  function shade() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    const G = Math.min(240, canvas.width);
    const img = ctx.createImageData(G, G);
    const pos = rgbOf("var(--code-del)"), neg = rgbOf("var(--vec-u)"), bg = rgbOf("var(--code-bg)"), ink = rgbOf("var(--foreground)");
    const scale = K * 1e-9 / 0.01; // V of 1 nC at 1 cm
    const vals = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x = -5 + ((i + 0.5) / G) * 10, y = 5 - ((j + 0.5) / G) * 10;
      vals[j * G + i] = fieldAt(x, y)[2] / scale;
    }
    // Signed log compression, banded every 0.25 for contours.
    const t = (v) => Math.sign(v) * Math.log1p(Math.abs(v) * 4) / Math.log1p(8);
    const band = (v) => Math.floor(t(v) * 8);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i, v = vals[k], s = Math.max(-1, Math.min(1, t(v)));
      const c = s > 0 ? pos : neg, a = show.potential ? Math.abs(s) * 0.38 : 0;
      const edge = show.potential && ((i + 1 < G && band(vals[k + 1]) !== band(v)) || (j + 1 < G && band(vals[k + G]) !== band(v)));
      for (let ch = 0; ch < 3; ch++) {
        let x = bg[ch] * (1 - a) + c[ch] * a;
        if (edge) x = x * 0.82 + ink[ch] * 0.18;
        img.data[k * 4 + ch] = x;
      }
      img.data[k * 4 + 3] = 255;
    }
    const off = new OffscreenCanvas(G, G);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  function lines() {
    layer.replaceChildren();
    if (!show.lines) return;
    const pos = charges.filter((c) => c[2] > 0);
    const seeds = pos.length ? pos : charges.filter((c) => c[2] < 0);
    const dir = pos.length ? 1 : -1;
    for (const [cx, cy, q] of seeds) {
      const n = 16 * Math.abs(q);
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * (k + 0.5)) / n;
        let x = cx + 0.18 * Math.cos(a), y = cy + 0.18 * Math.sin(a);
        const pts = [[x, y]];
        for (let s = 0; s < 900; s++) {
          const [ex, ey] = fieldAt(x, y);
          const m = Math.hypot(ex, ey);
          if (!m) break;
          x += (dir * 0.04 * ex) / m;
          y += (dir * 0.04 * ey) / m;
          pts.push([x, y]);
          if (Math.abs(x) > 5.5 || Math.abs(y) > 5.5) break;
          // Stop on a charge of the opposite sign (where lines end).
          if (charges.some(([px, py, pq]) => pq * dir < 0 && Math.hypot(x - px, y - py) < 0.15)) break;
        }
        el("polyline", { points: pts.map((p) => P(p).join(",")).join(" "), style: "fill:none;stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, layer);
        // One arrowhead per line, a third of the way along.
        const i = Math.floor(pts.length / 3);
        if (pts.length > 8) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
          const d = Math.hypot(x1 - x0, y1 - y0) || 1, ux = ((x1 - x0) / d) * dir, uy = ((y1 - y0) / d) * dir;
          const tip = [x0 + ux * 0.12, y0 + uy * 0.12], l = [x0 - uy * 0.07, y0 + ux * 0.07], r = [x0 + uy * 0.07, y0 - ux * 0.07];
          el("path", { d: `M${P(tip)} L${P(l)} L${P(r)} Z`, style: "fill:var(--foreground);fill-opacity:0.6" }, layer);
        }
      }
    }
  }

  function placeCharges() {
    top.replaceChildren();
    handles = charges.map((c, i) => {
      const g = el("g", { class: "pointer-events-none" }, top);
      const color = c[2] > 0 ? "var(--code-del)" : "var(--vec-u)";
      el("circle", { cx: c[0], cy: -c[1], r: 0.3, style: `fill:${color};stroke:var(--background);stroke-width:2px`, "vector-effect": "non-scaling-stroke" }, g);
      const t = el("text", { x: c[0], y: -c[1] + 0.13, "text-anchor": "middle", style: "font-size:0.38px;font-weight:600;fill:white" }, g);
      t.textContent = c[2] > 0 ? "+" : "−";
      const hd = handle(svg, top, `${c[2] > 0 ? "Positive" : "Negative"} charge ${i + 1}`, (p) => {
        charges[i] = [Math.max(-4.6, Math.min(4.6, p[0])), Math.max(-4.6, Math.min(4.6, p[1])), c[2]];
        redraw();
      });
      hd.node.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
        if (!d) return;
        e.preventDefault();
        charges[i] = [charges[i][0] + d[0], charges[i][1] + d[1], charges[i][2]];
        redraw();
      });
      hd.place([c[0], c[1]], color);
      return { g, hd };
    });
  }

  let pending = 0;
  function redraw(full = true) {
    // Keep the handles (and focus) while dragging; just move the discs.
    charges.forEach((c, i) => {
      const hh = handles[i];
      if (!hh) return;
      const [circle, label] = hh.g.children;
      circle.setAttribute("cx", c[0]); circle.setAttribute("cy", -c[1]);
      label.setAttribute("x", c[0]); label.setAttribute("y", -c[1] + 0.13);
      hh.hd.place([c[0], c[1]], c[2] > 0 ? "var(--code-del)" : "var(--vec-u)");
    });
    o.q.textContent = `${num(charges.reduce((s, c) => s + c[2], 0), 0)} nC`;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { lines(); if (full) shade(); });
  }

  function reset(list) {
    charges = list.map((c) => [...c]);
    placeCharges();
    redraw();
  }

  svg.addEventListener("pointermove", (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const [ex, ey, v] = fieldAt(p.x, -p.y);
    o.pos.textContent = `(${num(p.x)}, ${num(-p.y)}) cm`;
    o.e.textContent = si(Math.hypot(ex, ey), "V/m");
    // Cancellation leaves float noise near zero: call it zero below 1 µV.
    o.v.textContent = Math.abs(v) < 1e-6 ? "≈ 0 V" : si(v, "V");
  });
  root.addEventListener("seg-change", (e) => reset(PRESETS[e.detail.value]));
  root.querySelector("[data-action=add-pos]").addEventListener("click", () => reset([...charges, [0, 2.5 - charges.length * 0.5, 1]]));
  root.querySelector("[data-action=add-neg]").addEventListener("click", () => reset([...charges, [0, -2.5 + charges.length * 0.5, -1]]));
  root.querySelector("[data-action=remove]").addEventListener("click", () => charges.length && reset(charges.slice(0, -1)));
  onToggle(root, (k, on) => { show[k] = on; redraw(); });
  new ResizeObserver(() => shade()).observe(canvas);
  onTheme(shade);
  reset(charges);
}

// ============================================================ Coulomb

for (const root of document.querySelectorAll("[data-em-coulomb]")) {
  const scene = root.querySelector("[data-scene]");
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const q1 = s.q1.get() * 1e-6, q2 = s.q2.get() * 1e-6, r = s.r.get() / 100;
    const F = (K * Math.abs(q1 * q2)) / (r * r);
    const repel = q1 * q2 > 0;
    o.f.textContent = si(F, "N");
    o.kind.textContent = q1 * q2 === 0 ? "no force" : repel ? "repulsive" : "attractive";
    o.f2.textContent = `${si(F / 4, "N")} (¼)`;

    // Scene: the two charges at a distance proportional to r, arrows ∝ log F.
    scene.replaceChildren();
    const cx = 200, half = 30 + (s.r.get() / 100) * 130;
    const xs = [cx - half, cx + half];
    el("line", { x1: xs[0], x2: xs[1], y1: 150, y2: 150, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4" }, scene);
    text(scene, cx, 168, `r = ${num(s.r.get(), 1)} cm`, { "text-anchor": "middle" });
    const len = q1 * q2 === 0 ? 0 : Math.max(14, Math.min(70, 14 + 9 * Math.log10(1 + F)));
    [[xs[0], q1, -1], [xs[1], q2, 1]].forEach(([x, q, side]) => {
      const col = q > 0 ? "var(--code-del)" : q < 0 ? "var(--vec-u)" : "var(--muted-foreground)";
      const rad = 10 + 8 * Math.min(1, Math.abs(q) / 1e-5);
      if (len) {
        const d = repel ? side : -side;
        const x2 = x + d * (rad + len);
        el("line", { x1: x + d * rad, x2: x2 - d * 6, y1: 100, y2: 100, style: "stroke:var(--brand);stroke-width:2.5" }, scene);
        el("path", { d: `M${x2} 100 L${x2 - d * 9} 95 L${x2 - d * 9} 105 Z`, style: "fill:var(--brand)" }, scene);
      }
      el("circle", { cx: x, cy: 100, r: rad, style: `fill:${col};fill-opacity:0.85;stroke:var(--background);stroke-width:2` }, scene);
      const t = el("text", { x, y: 105, "text-anchor": "middle", style: "fill:white;font-size:14px;font-weight:600" }, scene);
      t.textContent = q > 0 ? "+" : q < 0 ? "−" : "0";
      text(scene, x, 100 - rad - 8, `${num(q * 1e6, 1)} µC`, { "text-anchor": "middle" });
    });
    text(scene, 8, 16, "arrow length ∝ log F", {});

    // Inverse-square curve.
    plot.replaceChildren();
    const fmax = (K * Math.abs(q1 * q2)) / 0.05 ** 2 || 1;
    const f = frame(plot, { box: [40, 14, 206, 170], x: [0, 100], y: [0, fmax], xticks: [0, 50, 100], yticks: [0, fmax], xlabel: "r (cm)", ylabel: "F", yfmt: (v) => (v ? si(v, "N", 2) : "0") });
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const rr = 5 + (i / 200) * 95;
      pts.push([f.sx(rr), f.sy((K * Math.abs(q1 * q2)) / (rr / 100) ** 2)]);
    }
    polyline(plot, pts, "stroke:var(--foreground);stroke-width:1.5");
    el("circle", { cx: f.sx(Math.max(5, s.r.get())), cy: f.sy(Math.min(fmax, F)), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, plot);
  }
  draw();
}

// ============================================================ DC circuit

// Nodes: 1 = source top (V = Vs), 2 = after R1, 3 = between R3 and R4.
// KCL at nodes 2 and 3 gives a 2×2 system G·v = i.
function solveCircuit({ vs, r1, r2, r3, r4 }) {
  const g1 = 1 / r1, g2 = 1 / r2, g3 = 1 / r3, g4 = 1 / r4;
  const a = g1 + g2 + g3, b = -g3, c = -g3, d = g3 + g4;
  const det = a * d - b * c;
  const v2 = (vs * g1 * d) / det;
  const v3 = (-c * vs * g1) / det;
  const I = [(vs - v2) / r1, v2 / r2, (v2 - v3) / r3, v3 / r4];
  const V = [vs - v2, v2, v2 - v3, v3];
  return { v2, v3, I, V };
}

for (const root of document.querySelectorAll("[data-em-circuit]")) {
  const svg = root.querySelector("[data-schematic]");
  const table = root.querySelector("[data-table]");
  const s = scrubAll(root, draw);

  // A zigzag resistor between two points (horizontal or vertical).
  function resistor(x1, y1, x2, y2, label, value) {
    const g = el("g", {}, svg);
    const horiz = y1 === y2, len = horiz ? x2 - x1 : y2 - y1, body = 46, lead = (len - body) / 2;
    const pts = [];
    pts.push([0, 0], [lead, 0]);
    for (let k = 0; k < 6; k++) pts.push([lead + (body / 6) * (k + 0.5), k % 2 ? -7 : 7]);
    pts.push([lead + body, 0], [len, 0]);
    const map = ([u, w]) => (horiz ? [x1 + u, y1 + w] : [x1 + w, y1 + u]);
    polyline(g, pts.map(map), "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round");
    const [lx, ly] = horiz ? [x1 + len / 2, y1 - 26] : [x1 + 14, y1 + len / 2];
    text(g, lx, ly, label, { "text-anchor": horiz ? "middle" : "start", class: "fill-foreground font-mono text-[11px]" });
    text(g, lx, ly + 12, value, { "text-anchor": horiz ? "middle" : "start" });
    return g;
  }
  const wire = (pts) => polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.75");
  const dot = (x, y, label) => {
    el("circle", { cx: x, cy: y, r: 3.5, style: "fill:var(--foreground)" }, svg);
    if (label) text(svg, x, y - 8, label, { "text-anchor": "middle", class: "fill-brand font-mono text-[11px]" });
  };
  const current = (x, y, dir, amps) => {
    const g = el("g", {}, svg);
    const [dx, dy] = { right: [1, 0], down: [0, 1] }[dir];
    el("path", { d: `M${x - dx * 6 - dy * 5} ${y - dy * 6 - dx * 5} L${x + dx * 6} ${y + dy * 6} L${x - dx * 6 + dy * 5} ${y - dy * 6 + dx * 5}`, style: "fill:none;stroke:var(--brand);stroke-width:2;stroke-linejoin:round" }, g);
    // Horizontal currents label below the arrow, vertical ones to its left.
    text(g, dy ? x - 12 : x, dy ? y + 4 : y + 18, si(amps, "A", 3), { "text-anchor": dy ? "end" : "middle", class: "fill-brand font-mono text-[10px]" });
  };

  function draw() {
    const p = { vs: s.vs.get(), r1: s.r1.get(), r2: s.r2.get(), r3: s.r3.get(), r4: s.r4.get() };
    const { v2, v3, I, V } = solveCircuit(p);
    svg.replaceChildren();
    const L = 60, T = 50, B = 250, X2 = 250, X3 = 470;
    // Source on the left.
    wire([[L, B], [L, 160]]); wire([[L, 130], [L, T], [90, T]]);
    el("line", { x1: L - 16, x2: L + 16, y1: 130, y2: 130, style: "stroke:var(--foreground);stroke-width:2" }, svg);
    el("line", { x1: L - 9, x2: L + 9, y1: 140, y2: 140, style: "stroke:var(--foreground);stroke-width:3.5" }, svg);
    el("line", { x1: L - 16, x2: L + 16, y1: 150, y2: 150, style: "stroke:var(--foreground);stroke-width:2" }, svg);
    el("line", { x1: L - 9, x2: L + 9, y1: 160, y2: 160, style: "stroke:var(--foreground);stroke-width:3.5" }, svg);
    text(svg, L - 22, 128, "+", { "text-anchor": "end", class: "fill-foreground font-mono text-[12px]" });
    text(svg, L - 22, 148, `${num(p.vs, 1)} V`, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
    resistor(90, T, 210, T, "R₁", `${p.r1} Ω`);
    wire([[210, T], [X2 + 20, T]]);
    wire([[X2, T], [X2, 105]]);
    resistor(X2, 105, X2, 205, "R₂", `${p.r2} Ω`);
    wire([[X2, 205], [X2, B]]);
    resistor(X2 + 20, T, X3 - 20, T, "R₃", `${p.r3} Ω`);
    wire([[X3 - 20, T], [X3, T], [X3, 105]]);
    resistor(X3, 105, X3, 205, "R₄", `${p.r4} Ω`);
    wire([[X3, 205], [X3, B], [L, B]]);
    // Ground symbol.
    for (const [w, dy] of [[16, 0], [10, 5], [4, 10]]) el("line", { x1: 160 - w, x2: 160 + w, y1: B + 8 + dy, y2: B + 8 + dy, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
    wire([[160, B], [160, B + 8]]);
    dot(X2, T, `${num(v2, 2)} V`);
    dot(X3, T, `${num(v3, 2)} V`);
    text(svg, 172, B + 26, "0 V", { "text-anchor": "start" });
    current(150, T + 18, "right", I[0]);
    current(X2 - 18, 155, "down", I[1]);
    current(X2 + 110, T + 18, "right", I[2]);
    current(X3 - 18, 155, "down", I[3]);

    const rows = ["R₁", "R₂", "R₃", "R₄"].map((n, i) => {
      const Pw = V[i] * I[i];
      return `<tr class="border-b last:border-b-0"><td class="py-1 pr-3">${n}</td><td class="py-1 pr-3 text-right tabular-nums">${si(V[i], "V")}</td><td class="py-1 pr-3 text-right tabular-nums">${si(I[i], "A")}</td><td class="py-1 text-right tabular-nums">${si(Pw, "W")}</td></tr>`;
    });
    const pIn = p.vs * I[0], pOut = V.reduce((s2, v, i) => s2 + v * I[i], 0);
    const kcl = I[0] - I[1] - I[2];
    table.innerHTML = `<table class="w-full"><thead><tr class="border-b text-muted-foreground"><th class="pb-1 text-left font-normal">part</th><th class="pb-1 text-right font-normal">V</th><th class="pb-1 text-right font-normal">I</th><th class="pb-1 text-right font-normal">P</th></tr></thead><tbody>${rows.join("")}</tbody></table>
      <div class="mt-3 flex flex-col gap-1 text-muted-foreground"><span>source power <span class="text-foreground">${si(pIn, "W")}</span> · dissipated <span class="text-foreground">${si(pOut, "W")}</span></span><span>KCL at node 2: I₁ − I₂ − I₃ = <span class="text-foreground">${si(Math.abs(kcl) < 1e-15 ? 0 : kcl, "A")}</span></span></div>`;
  }
  draw();
}

// ============================================================ RC circuit

for (const root of document.querySelectorAll("[data-em-rc]")) {
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  let phase = "charge";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { phase = e.detail.value; draw(); });

  function draw() {
    const Cap = (EPS0 * s.er.get() * s.area.get() * 1e-4) / (s.gap.get() * 1e-3);
    const R = s.r.get() * 1e3, V0 = s.v0.get(), tau = R * Cap;
    const v = (t) => (phase === "charge" ? V0 * (1 - Math.exp(-t / tau)) : V0 * Math.exp(-t / tau));
    const i = (t) => (V0 / R) * Math.exp(-t / tau) * (phase === "charge" ? 1 : -1);
    o.c.textContent = si(Cap, "F");
    o.tau.textContent = si(tau, "s");
    o.vtau.textContent = `${si(v(tau), "V")} (${num((v(tau) / V0) * 100, 1)}%)`;
    o.energy.textContent = si(0.5 * Cap * V0 * V0, "J");

    plot.replaceChildren();
    const T = 5 * tau;
    const f = frame(plot, { box: [46, 16, 490, 230], x: [0, 5], y: [0, V0], xticks: [0, 1, 2, 3, 4, 5], yticks: [0, V0 * 0.632, V0], xfmt: (x) => (x ? `${x}τ` : "0"), yfmt: (y) => `${num(y, 2)}`, xlabel: `t (τ = ${si(tau, "s")})`, ylabel: "V" });
    for (const m of [1, 5]) el("line", { x1: f.sx(m), x2: f.sx(m), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 4" }, plot);
    const pts = [], ipts = [];
    for (let k = 0; k <= 200; k++) {
      const t = (k / 200) * T;
      pts.push([f.sx(t / tau), f.sy(v(t))]);
      ipts.push([f.sx(t / tau), f.sy(Math.abs(i(t)) * R)]);
    }
    polyline(plot, ipts, "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(plot, pts, "stroke:var(--foreground);stroke-width:2");
    el("circle", { cx: f.sx(1), cy: f.sy(v(tau)), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, plot);
    text(plot, f.sx(1) + 6, f.sy(v(tau)) + (phase === "charge" ? 14 : -8), phase === "charge" ? "63.2% at τ" : "36.8% at τ", { class: "fill-brand font-mono text-[10px]" });
    text(plot, f.L + f.W, 10, "solid: V_C   dashed: |I|·R", { "text-anchor": "end" });
  }
  draw();
}

// ============================================================ RLC

for (const root of document.querySelectorAll("[data-em-rlc]")) {
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  let view = "response";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { view = e.detail.value; draw(); });

  function draw() {
    const R = s.r.get(), L = s.l.get() * 1e-3, Cc = s.c.get() * 1e-6, V0 = s.v0.get();
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * Cc));
    const Q = Math.sqrt(L / Cc) / R;
    const zeta = (R / 2) * Math.sqrt(Cc / L);
    o.f0.textContent = si(f0, "Hz");
    o.q.textContent = num(Q, 2);
    o.bw.textContent = si(f0 / Q, "Hz");
    o.zeta.textContent = `${num(zeta, 3)} · ${zeta < 1 ? "underdamped" : zeta === 1 ? "critical" : "overdamped"}`;
    o.imax.textContent = si(V0 / R, "A");

    plot.replaceChildren();
    if (view === "response") {
      const lo = Math.log10(f0) - 1.5, hi = Math.log10(f0) + 1.5;
      const amp = (fr) => { const w = 2 * Math.PI * fr; return V0 / Math.hypot(R, w * L - 1 / (w * Cc)); };
      const top = V0 / R;
      const ticks = [];
      for (let d = Math.ceil(lo); d <= Math.floor(hi); d++) ticks.push(d);
      const f = frame(plot, { box: [52, 16, 484, 230], x: [lo, hi], y: [0, top * 1.08], xticks: ticks, yticks: [0, top / Math.SQRT2, top], xfmt: (d) => si(10 ** d, "Hz", 2), yfmt: (y) => si(y, "A", 2), xlabel: "frequency (log)", ylabel: "|I|" });
      hline(plot, f, top / Math.SQRT2, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4", "1/√2 · peak");
      const pts = [];
      for (let k = 0; k <= 400; k++) { const x = lo + ((hi - lo) * k) / 400; pts.push([f.sx(x), f.sy(amp(10 ** x))]); }
      polyline(plot, pts, "stroke:var(--foreground);stroke-width:2");
      el("line", { x1: f.sx(Math.log10(f0)), x2: f.sx(Math.log10(f0)), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 4" }, plot);
      text(plot, f.sx(Math.log10(f0)) + 5, f.T + 12, `f₀ = ${si(f0, "Hz")}`, { class: "fill-brand font-mono text-[10px]" });
    } else {
      // Step response of the capacitor voltage, L q'' + R q' + q/C = V0, RK4.
      const tEnd = Math.max(8 / (2 * Math.PI * f0), 6 * Math.min(2 * L / R, 50 * L / R)), n = 1500, dt = tEnd / n;
      let q = 0, i = 0;
      const acc = (q0, i0) => (V0 - R * i0 - q0 / Cc) / L;
      const pts = [[0, 0]];
      let vmax = V0;
      for (let k = 1; k <= n; k++) {
        const k1q = i, k1i = acc(q, i);
        const k2q = i + (dt / 2) * k1i, k2i = acc(q + (dt / 2) * k1q, i + (dt / 2) * k1i);
        const k3q = i + (dt / 2) * k2i, k3i = acc(q + (dt / 2) * k2q, i + (dt / 2) * k2i);
        const k4q = i + dt * k3i, k4i = acc(q + dt * k3q, i + dt * k3i);
        q += (dt / 6) * (k1q + 2 * k2q + 2 * k3q + k4q);
        i += (dt / 6) * (k1i + 2 * k2i + 2 * k3i + k4i);
        pts.push([k * dt, q / Cc]);
        vmax = Math.max(vmax, q / Cc);
      }
      const f = frame(plot, { box: [52, 16, 484, 230], x: [0, tEnd], y: [Math.min(0, ...pts.map((p) => p[1])), vmax * 1.05], xticks: [0, tEnd / 2, tEnd], yticks: [0, V0], xfmt: (t) => si(t, "s", 2), yfmt: (v) => `${num(v, 2)} V`, xlabel: "time", ylabel: "V_C" });
      hline(plot, f, V0, "stroke:var(--brand);stroke-opacity:0.6;stroke-dasharray:3 4", "V₀");
      polyline(plot, pts.map(([t, v]) => [f.sx(t), f.sy(v)]), "stroke:var(--foreground);stroke-width:2");
    }
  }
  draw();
}

// ============================================================ Wire field

for (const root of document.querySelectorAll("[data-em-wire]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  let dir = "out", probePos = [2, 1];
  const layer = el("g", {}, svg);
  const top = el("g", {}, svg);
  const s = scrubAll(root, draw);
  const hd = handle(svg, top, "Field probe", (p) => { probePos = p.map((v) => Math.max(-4.6, Math.min(4.6, v))); draw(); });
  hd.node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
    if (!d) return;
    e.preventDefault();
    probePos = [probePos[0] + d[0], probePos[1] + d[1]];
    draw();
  });
  root.addEventListener("seg-change", (e) => { dir = e.detail.value; draw(); });

  // World units are cm.
  function draw() {
    const I = s.i.get();
    const sign = dir === "out" ? 1 : -1; // out of page → counterclockwise
    layer.replaceChildren();
    for (const r of [0.8, 1.6, 2.4, 3.2, 4.0]) {
      const B = (MU0 * I) / (2 * Math.PI * (r / 100));
      el("circle", { cx: 0, cy: 0, r, style: `fill:none;stroke:var(--vec-u);stroke-opacity:${0.25 + 0.6 * Math.min(1, 0.8 / r)};stroke-width:1.25px`, "vector-effect": "non-scaling-stroke" }, layer);
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const px = r * Math.cos(a + 0.4), py = r * Math.sin(a + 0.4);
        const tx = -Math.sin(a + 0.4) * sign, ty = Math.cos(a + 0.4) * sign;
        const tip = [px + tx * 0.18, py + ty * 0.18], l = [px - ty * 0.1, py + tx * 0.1], rr = [px + ty * 0.1, py - tx * 0.1];
        el("path", { d: `M${P(tip)} L${P(l)} L${P(rr)} Z`, style: "fill:var(--vec-u)" }, layer);
      }
      void B;
    }
    // The wire: a dot (current towards you) or a cross (away).
    el("circle", { cx: 0, cy: 0, r: 0.42, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2px", "vector-effect": "non-scaling-stroke" }, layer);
    if (sign > 0) el("circle", { cx: 0, cy: 0, r: 0.12, style: "fill:var(--foreground)" }, layer);
    else { line(layer, [-0.25, -0.25], [0.25, 0.25], "stroke:var(--foreground);stroke-width:2px"); line(layer, [-0.25, 0.25], [0.25, -0.25], "stroke:var(--foreground);stroke-width:2px"); }
    // B at the probe: tangent vector, magnitude μ0I/(2πr).
    const r = Math.hypot(...probePos) / 100;
    const B = r > 0 ? (MU0 * I) / (2 * Math.PI * r) : Infinity;
    const ux = (-probePos[1] / (r * 100)) * sign, uy = (probePos[0] / (r * 100)) * sign;
    const L = Math.min(1.8, 0.4 + 0.25 * Math.log10(1 + B * 1e6));
    arrow(layer, probePos, [probePos[0] + ux * L, probePos[1] + uy * L], "var(--brand)");
    hd.place(probePos, "var(--brand)");
    o.r.textContent = `${num(r * 100, 2)} cm`;
    o.b.textContent = si(B, "T");
    o.earth.textContent = `≈ 25–65 µT (${num(B / 50e-6, 1)}× 50 µT)`;
    o.sol.textContent = si(MU0 * s.n.get() * I, "T");
  }
  draw();
}

// ============================================================ Faraday

for (const root of document.querySelectorAll("[data-em-faraday]")) {
  const scene = root.querySelector("[data-scene]");
  const plot = root.querySelector("[data-plot]");
  const o = outs(root);
  const setBtn = playToggle(root.querySelector("[data-action=play]"));
  const M = 1, RM = 0.01, A = Math.PI * 0.02 ** 2; // dipole moment A·m², magnet radius m, coil area m²
  let t = 0;
  const s = scrubAll(root, () => { t = 0; draw(); });

  // On-axis field of a dipole modelled as a current loop of radius RM.
  const Bx = (x) => (MU0 * M) / (2 * Math.PI * (x * x + RM * RM) ** 1.5);
  const flux = (tt) => {
    const x = (s.amp.get() / 100) * Math.sin(2 * Math.PI * s.freq.get() * tt) + 0.0;
    return { x, phi: s.turns.get() * Bx(x - 0) * A };
  };
  const emf = (tt) => { const h = 1e-5; return -(flux(tt + h).phi - flux(tt - h).phi) / (2 * h); };

  function draw() {
    const period = 1 / s.freq.get(), span = 2 * period;
    const { x } = flux(t);
    // Scene: coil at the centre, magnet sliding along the axis.
    scene.replaceChildren();
    const cx = 280, scale = 18; // px per cm
    el("line", { x1: 20, x2: 540, y1: 75, y2: 75, style: "stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:3 4" }, scene);
    for (let k = -3; k <= 3; k++) el("ellipse", { cx: cx + k * 5, cy: 75, rx: 6, ry: 34, style: "fill:none;stroke:var(--vec-out);stroke-width:2" }, scene);
    text(scene, cx, 128, `coil, N = ${s.turns.get()}`, { "text-anchor": "middle" });
    const mx = cx + x * 100 * scale;
    el("rect", { x: mx - 50, y: 63, width: 50, height: 24, rx: 3, style: "fill:var(--code-del);fill-opacity:0.85" }, scene);
    el("rect", { x: mx, y: 63, width: 50, height: 24, rx: 3, style: "fill:var(--vec-u);fill-opacity:0.85" }, scene);
    const tn = el("text", { x: mx - 25, y: 79, "text-anchor": "middle", style: "fill:white;font-size:12px;font-weight:600" }, scene); tn.textContent = "N";
    const ts = el("text", { x: mx + 25, y: 79, "text-anchor": "middle", style: "fill:white;font-size:12px;font-weight:600" }, scene); ts.textContent = "S";
    const e = emf(t);
    const meter = Math.max(-1, Math.min(1, e / (peak.emf || 1)));
    el("line", { x1: 480, x2: 480 + 40 * Math.sin(meter * 1.1), y1: 40, y2: 40 - 40 * Math.cos(meter * 1.1), style: "stroke:var(--brand);stroke-width:2.5;stroke-linecap:round" }, scene);
    el("path", { d: "M440 40 A40 40 0 0 1 520 40", style: "fill:none;stroke:currentColor;stroke-opacity:0.3" }, scene);
    text(scene, 480, 54, "ℰ", { "text-anchor": "middle" });

    // Plots over two periods with a moving cursor.
    plot.replaceChildren();
    const n = 300, tt = [], ph = [], em = [];
    for (let k = 0; k <= n; k++) { const ti = (k / n) * span; tt.push(ti); ph.push(flux(ti).phi); em.push(emf(ti)); }
    const pmax = Math.max(...ph), emax = Math.max(...em.map(Math.abs));
    const f1 = frame(plot, { box: [56, 10, 480, 80], x: [0, span], y: [0, pmax * 1.05], xticks: [], yticks: [0, pmax], yfmt: (v) => si(v, "Wb", 2), ylabel: "" });
    text(plot, f1.L + 8, f1.T + 12, "N·Φ (flux linkage)", { class: "fill-foreground font-mono text-[10px]" });
    polyline(plot, tt.map((ti, k) => [f1.sx(ti), f1.sy(ph[k])]), "stroke:var(--vec-out);stroke-width:1.75");
    const f2 = frame(plot, { box: [56, 120, 480, 80], x: [0, span], y: [-emax * 1.05, emax * 1.05], xticks: [0, period, span], yticks: [-emax, 0, emax], xfmt: (v) => si(v, "s", 2), yfmt: (v) => si(v, "V", 2), xlabel: "time" });
    text(plot, f2.L + 8, f2.T + 12, "ℰ = −N dΦ/dt", { class: "fill-foreground font-mono text-[10px]" });
    polyline(plot, tt.map((ti, k) => [f2.sx(ti), f2.sy(em[k])]), "stroke:var(--brand);stroke-width:1.75");
    const cur = t % span;
    for (const [fr, top] of [[f1, 10], [f2, 120]]) el("line", { x1: fr.sx(cur), x2: fr.sx(cur), y1: top, y2: top + 80, style: "stroke:var(--foreground);stroke-opacity:0.5" }, plot);
    peak.emf = emax;
    o.phi.textContent = si(pmax, "Wb");
    o.emf.textContent = si(emax, "V");
    o.now.textContent = `x = ${num(x * 100, 1)} cm, ℰ = ${si(e, "V")}`;
  }
  const peak = { emf: 0 };
  const anim = animator(root, (dt) => { t += dt; draw(); });
  const btn = root.querySelector("[data-action=play]");
  btn.addEventListener("click", () => {
    if (reducedMotion() && !anim.playing) { t += 0.25 / s.freq.get(); draw(); return; }
    anim.set(!anim.playing);
    setBtn(anim.playing);
  });
  draw();
  draw(); // second pass uses the measured peak for the meter scale
}

// ============================================================ EM wave

const BANDS = [
  // [name, min λ (m), max λ (m)] — conventional, approximate edges.
  ["Gamma", 0, 1e-11],
  ["X-ray", 1e-11, 1e-8],
  ["Ultraviolet", 1e-8, 3.8e-7],
  ["Visible", 3.8e-7, 7.5e-7],
  ["Infrared", 7.5e-7, 1e-3],
  ["Microwave", 1e-3, 1],
  ["Radio", 1, Infinity],
];

for (const root of document.querySelectorAll("[data-em-wave]")) {
  const scene = root.querySelector("[data-scene]");
  const spec = root.querySelector("[data-spectrum]");
  const o = outs(root);
  const setBtn = playToggle(root.querySelector("[data-action=play]"));
  let phase = 0;
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { s.logf.set(Number(b.dataset.preset), false); draw(); }));

  function draw() {
    const f = 10 ** s.logf.get(), lambda = C / f, E = H * f;
    const band = BANDS.find(([, a, b]) => lambda >= a && lambda < b)[0];
    o.f.textContent = si(f, "Hz");
    o.lambda.textContent = si(lambda, "m");
    o.energy.textContent = `${si(E / EV, "eV")} (${sci(E)} J)`;
    o.band.textContent = band;

    // Oblique projection: x along the page, E up, B toward the viewer (drawn diagonally).
    scene.replaceChildren();
    const x0 = 40, x1 = 520, y0 = 125, amp = 70, depth = [0.55, 0.35];
    el("line", { x1: x0, x2: x1 + 10, y1: y0, y2: y0, style: "stroke:currentColor;stroke-opacity:0.4" }, scene);
    el("path", { d: `M${x1 + 10} ${y0} l-8 -4 v8 z`, style: "fill:currentColor;fill-opacity:0.5" }, scene);
    text(scene, x1 + 12, y0 + 16, "c", { "text-anchor": "end" });
    const waves = 3, ePts = [], bPts = [];
    for (let k = 0; k <= 240; k++) {
      const u = k / 240, x = x0 + u * (x1 - x0), arg = 2 * Math.PI * (waves * u) - phase;
      const v = Math.sin(arg);
      ePts.push([x, y0 - amp * v]);
      bPts.push([x - depth[0] * amp * 0.75 * v, y0 + depth[1] * amp * 0.75 * v]);
      if (k % 10 === 0) {
        el("line", { x1: x, x2: x, y1: y0, y2: y0 - amp * v, style: "stroke:var(--code-del);stroke-opacity:0.35" }, scene);
        el("line", { x1: x, x2: x - depth[0] * amp * 0.75 * v, y1: y0, y2: y0 + depth[1] * amp * 0.75 * v, style: "stroke:var(--vec-u);stroke-opacity:0.35" }, scene);
      }
    }
    polyline(scene, bPts, "stroke:var(--vec-u);stroke-width:2");
    polyline(scene, ePts, "stroke:var(--code-del);stroke-width:2");
    text(scene, x0, 20, `λ = ${si(lambda, "m")} (not to scale)`);

    // Spectrum bar on a log-λ axis from 1 pm to 1 km.
    spec.replaceChildren();
    const L = 22, W = 516, lo = -12, hi = 3;
    const sx = (lam) => L + ((Math.log10(lam) - lo) / (hi - lo)) * W;
    for (const [name, a, b] of BANDS) {
      const xa = sx(Math.max(a, 10 ** lo)), xb = sx(Math.min(b, 10 ** hi));
      const vis = name === "Visible";
      el("rect", { x: xa, y: 20, width: Math.max(1, xb - xa), height: 22, style: vis ? "fill:url(#em-rainbow)" : `fill:currentColor;fill-opacity:${name === band ? 0.16 : 0.06}` }, spec);
      el("line", { x1: xa, x2: xa, y1: 20, y2: 42, style: "stroke:var(--background);stroke-width:1.5" }, spec);
      if (!vis) text(spec, (xa + xb) / 2, 35, name === "Ultraviolet" ? "UV" : name, { "text-anchor": "middle", class: name === band ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    }
    const defs = el("defs", {}, spec);
    const grad = el("linearGradient", { id: "em-rainbow" }, defs);
    ["#7a00ff", "#0046ff", "#00c8ff", "#00e05a", "#f5e000", "#ff8a00", "#ff2a00"].forEach((c, k) => el("stop", { offset: `${(k / 6) * 100}%`, "stop-color": c }, grad));
    for (let d = lo; d <= hi; d += 3) text(spec, sx(10 ** d), 58, si(10 ** d, "m", 1), { "text-anchor": "middle" });
    const mx = sx(Math.min(10 ** hi, Math.max(10 ** lo, lambda)));
    el("path", { d: `M${mx} 18 l-6 -10 h12 z`, style: "fill:var(--brand)" }, spec);
    el("line", { x1: mx, x2: mx, y1: 18, y2: 44, style: "stroke:var(--brand);stroke-width:2" }, spec);
  }

  const anim = animator(root, (dt) => { phase += dt * 4; draw(); });
  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (reducedMotion()) return;
    anim.set(!anim.playing);
    setBtn(anim.playing);
  });
  draw();
}
