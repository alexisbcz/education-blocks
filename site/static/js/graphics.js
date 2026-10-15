// Computer graphics, part 1: curves, rasterization, line drawing, the 3D
// pipeline and the depth buffer. graphics-render.js holds the per-pixel
// renderers (shading, ray tracing, texture sampling, colour, SDFs).

import { scrubAll } from "./scrub.js";
import { el, text, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// toSvg converts a pointer event to the SVG's viewBox coordinates.
function toSvg(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

// dragPoint makes an SVG circle draggable by pointer and arrow keys.
// move(x, y) receives viewBox coordinates and returns nothing.
function dragPoint(svg, node, get, move, keyStep = 4) {
  node.setAttribute("tabindex", "0");
  node.style.cursor = "grab";
  node.addEventListener("pointerdown", (e) => {
    node.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  node.addEventListener("pointermove", (e) => {
    if (!node.hasPointerCapture(e.pointerId)) return;
    const p = toSvg(svg, e);
    move(p.x, p.y);
  });
  node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [x, y] = get();
    const k = e.shiftKey ? keyStep * 4 : keyStep;
    move(x + d[0] * k, y + d[1] * k);
  });
}

// A play loop that runs only while the root is on screen.
function loop(root, tick, onState) {
  let raf = 0, last = 0, playing = false, visible = false;
  const frame = (now) => {
    const dt = Math.min(50, now - (last || now));
    last = now;
    if (tick(dt) === false) set(false);
    raf = playing && visible ? requestAnimationFrame(frame) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const set = (p) => { playing = p; onState?.(p); if (!p) { cancelAnimationFrame(raf); raf = 0; } kick(); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return { set, get playing() { return playing; } };
}

function playButton(btn) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !playing);
    const label = btn.querySelector("[data-label]");
    if (label) label.textContent = playing ? "Pause" : "Play";
  };
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

// ============================================================ Bézier

const BZ_DEFAULT = {
  cubic: [[70, 290], [150, 60], [410, 60], [490, 290]],
  quadratic: [[70, 290], [280, 40], [490, 290]],
};
const LEVEL_COLORS = ["var(--vec-u)", "var(--vec-v)", "var(--vec-out)"];

for (const root of document.querySelectorAll("[data-gfx-bezier]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "cubic";
  let pts = BZ_DEFAULT.cubic.map((p) => p.slice());
  const show = { construct: true, hull: true };
  const s = scrubAll(root, draw);
  const btn = root.querySelector("[data-action=play]");
  playButton(btn)(false);
  let dir = 1;
  const runner = loop(root, (dt) => {
    let t = s.t.get() + (dir * dt) / 2500;
    if (t >= 1) { t = 1; dir = -1; }
    if (t <= 0) { t = 0; dir = 1; }
    s.t.set(t, false);
    draw();
  }, playButton(btn));
  btn.addEventListener("click", () => {
    if (reduced()) return; // the scrub is the way to move t without motion
    runner.set(!runner.playing);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => {
    pts = BZ_DEFAULT[kind].map((p) => p.slice());
    draw();
  });
  root.addEventListener("seg-change", (e) => {
    kind = e.detail.value;
    pts = BZ_DEFAULT[kind].map((p) => p.slice());
    draw();
  });
  onToggle(root, (k, on) => { show[k] = on; draw(); });

  // de Casteljau: every level of the construction at parameter t.
  const levels = (t) => {
    const out = [pts];
    while (out.at(-1).length > 1) {
      const prev = out.at(-1);
      out.push(prev.slice(1).map((p, i) => lerp(prev[i], p, t)));
    }
    return out;
  };
  // The same point from the Bernstein form, as a check.
  const bernstein = (t) => {
    const n = pts.length - 1;
    let x = 0, y = 0;
    pts.forEach((p, i) => {
      const b = binom(n, i) * t ** i * (1 - t) ** (n - i);
      x += b * p[0];
      y += b * p[1];
    });
    return [x, y];
  };

  const handles = [];
  function draw() {
    const t = s.t.get();
    const curve = Array.from({ length: 201 }, (_, i) => levels(i / 200).at(-1)[0]);
    svg.querySelectorAll("[data-layer]").forEach((n) => n.remove());
    const g = el("g", { "data-layer": "" });
    svg.prepend(g);
    if (show.hull) el("polyline", { points: pts.map((p) => p.join(",")).join(" "), style: "fill:none;stroke:currentColor;stroke-opacity:0.35;stroke-width:1;stroke-dasharray:4 4" }, g);
    el("polyline", { points: curve.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), style: "fill:none;stroke:var(--foreground);stroke-width:2.25" }, g);
    const L = levels(t);
    if (show.construct) {
      L.slice(1, -1).forEach((lv, k) => {
        const c = LEVEL_COLORS[k % LEVEL_COLORS.length];
        if (lv.length > 1) el("polyline", { points: lv.map((p) => p.join(",")).join(" "), style: `fill:none;stroke:${c};stroke-width:1.5` }, g);
        lv.forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 3.5, style: `fill:${c}` }, g));
      });
    }
    const P = L.at(-1)[0];
    el("circle", { cx: P[0], cy: P[1], r: 6, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, g);

    // Control-point handles are kept between draws so focus survives.
    while (handles.length > pts.length) handles.pop().remove();
    pts.forEach((p, i) => {
      let hnd = handles[i];
      if (!hnd) {
        hnd = el("circle", { r: 8, role: "slider", "aria-label": `Control point P${i}`, class: "outline-none focus-visible:stroke-[3px]", style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.75" }, svg);
        dragPoint(svg, hnd, () => pts[i], (x, y) => {
          pts[i] = [Math.max(8, Math.min(552, x)), Math.max(8, Math.min(352, y))];
          draw();
        });
        handles[i] = hnd;
      }
      hnd.setAttribute("cx", p[0]);
      hnd.setAttribute("cy", p[1]);
    });
    svg.querySelectorAll("[data-label-pt]").forEach((n) => n.remove());
    pts.forEach((p, i) => text(svg, p[0] + 11, p[1] - 9, `P${i}`, { "data-label-pt": "" }));

    const B = bernstein(t);
    let len = 0;
    for (let i = 1; i < curve.length; i++) len += Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]);
    const gap = Math.hypot(B[0] - P[0], B[1] - P[1]);
    o.point.textContent = `(${num(P[0], 1)}, ${num(P[1], 1)})`;
    o.bern.textContent = gap < 1e-9 ? "same point" : `differs by ${gap.toExponential(1)}`;
    o.len.textContent = `≈ ${num(len, 1)} px`;
  }
  draw();
}

// ============================================================ Rasterization

const RS = { W: 24, H: 16, C: 20 };
const VCOLORS = [[234, 88, 94], [24, 164, 108], [0, 140, 230]];

for (const root of document.querySelectorAll("[data-gfx-raster]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let V = [[3.25, 2.5], [20.5, 6.25], [8.5, 14.5]];
  const show = { bary: true, topleft: true, centers: false };
  onToggle(root, (k, on) => { show[k] = on; draw(); });

  const E = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  // Orient so that the interior has E > 0 on every edge.
  const tri = () => (E(V[0], V[1], V[2]) < 0 ? [V[0], V[2], V[1]] : V.slice());
  // An edge owns the pixels exactly on it if it is a top or a left edge:
  // the interior lies below a horizontal edge, or to its right.
  const topLeft = (a, b) => {
    const nx = -(b[1] - a[1]), ny = b[0] - a[0]; // gradient of E: points inside
    return nx > 0 || (nx === 0 && ny > 0);
  };

  const pixels = [];
  const grid = el("g", {}, svg);
  for (let j = 0; j < RS.H; j++) for (let i = 0; i < RS.W; i++) {
    const r = el("rect", { x: i * RS.C, y: j * RS.C, width: RS.C, height: RS.C, style: "fill:transparent;stroke:currentColor;stroke-opacity:0.08" }, grid);
    r.addEventListener("pointerenter", () => probe(i, j));
    pixels.push(r);
  }
  const over = el("g", { class: "pointer-events-none" }, svg);
  const handles = V.map((_, k) => {
    const c = el("circle", { r: 7, role: "slider", "aria-label": `Vertex ${k}`, style: `fill:rgb(${VCOLORS[k].join(",")});stroke:var(--background);stroke-width:2` }, svg);
    dragPoint(svg, c, () => [V[k][0] * RS.C, V[k][1] * RS.C], (x, y) => {
      // Snap to quarter pixels so edges can run exactly through centres.
      V[k] = [Math.max(0, Math.min(RS.W, Math.round((x / RS.C) * 4) / 4)), Math.max(0, Math.min(RS.H, Math.round((y / RS.C) * 4) / 4))];
      draw();
    }, RS.C / 4);
    return c;
  });

  let last = null;
  function weights(i, j) {
    const [a, b, c] = tri();
    const p = [i + 0.5, j + 0.5];
    return { w: [E(b, c, p), E(c, a, p), E(a, b, p)], area: E(a, b, c), edges: [[b, c], [c, a], [a, b]] };
  }
  function covered(i, j) {
    const { w, area, edges } = weights(i, j);
    if (area === 0) return false;
    return w.every((wi, k) => wi > 0 || (wi === 0 && (!show.topleft || topLeft(...edges[k]))));
  }
  function probe(i, j) {
    last = [i, j];
    const { w, area } = weights(i, j);
    o.probe.textContent = `(${i}, ${j}) · ${covered(i, j) ? "covered" : "outside"}`;
    o.weights.textContent = area ? w.map((v) => num(v / area, 2)).join("  ") : "—";
  }
  function draw() {
    const swapped = E(V[0], V[1], V[2]) < 0;
    let count = 0;
    pixels.forEach((r, n) => {
      const i = n % RS.W, j = Math.floor(n / RS.W);
      const { w, area } = weights(i, j);
      const inside = covered(i, j);
      const onEdge = w.some((v) => v === 0) && w.every((v) => v >= 0);
      if (inside) count++;
      let fill = "transparent";
      if (inside) {
        if (show.bary) {
          // Barycentric weights are the edge values divided by the area;
          // w[0] belongs to vertex a, which may be V[0] or swapped.
          const order = swapped ? [0, 2, 1] : [0, 1, 2];
          const rgb = [0, 1, 2].map((ch) => order.reduce((acc, vi, k) => acc + (w[k] / area) * VCOLORS[vi][ch], 0));
          fill = `rgb(${rgb.map((v) => Math.round(v)).join(",")})`;
        } else fill = "color-mix(in oklab, var(--brand) 70%, transparent)";
      }
      r.style.fill = fill;
      r.style.stroke = onEdge ? "var(--foreground)" : "currentColor";
      r.style.strokeOpacity = onEdge ? "0.9" : "0.08";
      r.style.strokeWidth = onEdge ? "1.5" : "1";
    });
    over.replaceChildren();
    el("polygon", { points: V.map((p) => `${p[0] * RS.C},${p[1] * RS.C}`).join(" "), style: "fill:none;stroke:var(--foreground);stroke-width:1.5" }, over);
    if (show.centers) for (let j = 0; j < RS.H; j++) for (let i = 0; i < RS.W; i++)
      el("circle", { cx: (i + 0.5) * RS.C, cy: (j + 0.5) * RS.C, r: 1.3, style: "fill:currentColor;fill-opacity:0.45" }, over);
    handles.forEach((c, k) => { c.setAttribute("cx", V[k][0] * RS.C); c.setAttribute("cy", V[k][1] * RS.C); });
    const area = Math.abs(E(V[0], V[1], V[2])) / 2;
    o.count.textContent = String(count);
    o.area.textContent = `${num(area, 2)} px² (exact)`;
    if (last) probe(...last);
    else { o.probe.textContent = "hover a pixel"; o.weights.textContent = "—"; }
  }
  draw();
}

// ============================================================ Lines

function bresenham(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  const out = [];
  for (;;) {
    out.push({ x, y, note: `err ${err}` });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

function dda(x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const t = steps ? k / steps : 0;
    const fx = x0 + (x1 - x0) * t, fy = y0 + (y1 - y0) * t;
    out.push({ x: Math.round(fx), y: Math.round(fy), note: `${num(fx, 2)}, ${num(fy, 2)}` });
  }
  return out;
}

for (const root of document.querySelectorAll("[data-gfx-lines]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  let A = [2, 13], B = [21, 4], mode = "bresenham", shown = Infinity;
  const C = RS.C;

  const grid = el("g", {}, svg);
  for (let j = 0; j < RS.H; j++) for (let i = 0; i < RS.W; i++)
    el("rect", { x: i * C, y: j * C, width: C, height: C, style: "fill:transparent;stroke:currentColor;stroke-opacity:0.08" }, grid);
  const layer = el("g", { class: "pointer-events-none" }, svg);
  const hA = el("circle", { r: 7, role: "slider", "aria-label": "Start point", style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
  const hB = el("circle", { r: 7, role: "slider", "aria-label": "End point", style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
  const snap = (x, y) => [Math.max(0, Math.min(RS.W - 1, Math.floor(x / C))), Math.max(0, Math.min(RS.H - 1, Math.floor(y / C)))];
  dragPoint(svg, hA, () => [(A[0] + 0.5) * C, (A[1] + 0.5) * C], (x, y) => { A = snap(x, y); shown = Infinity; draw(); }, C);
  dragPoint(svg, hB, () => [(B[0] + 0.5) * C, (B[1] + 0.5) * C], (x, y) => { B = snap(x, y); shown = Infinity; draw(); }, C);

  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  const total = () => Math.max(Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1])) + 1;
  root.querySelector("[data-action=step]").addEventListener("click", () => { shown = Math.min(total(), (shown === Infinity ? 0 : shown) + 1); draw(); });
  root.querySelector("[data-action=back]").addEventListener("click", () => { shown = Math.max(1, (shown === Infinity ? total() : shown) - 1); draw(); });
  root.querySelector("[data-action=all]").addEventListener("click", () => { shown = Infinity; draw(); });

  function draw() {
    const br = bresenham(A[0], A[1], B[0], B[1]);
    const dd = dda(A[0], A[1], B[0], B[1]);
    const n = Math.min(shown, Math.max(br.length, dd.length));
    layer.replaceChildren();
    const key = (p) => `${p.x},${p.y}`;
    const brSet = new Set(br.map(key)), ddSet = new Set(dd.map(key));
    if (mode !== "dda") br.slice(0, n).forEach((p) =>
      el("rect", { x: p.x * C + 1, y: p.y * C + 1, width: C - 2, height: C - 2, rx: 3, style: "fill:var(--brand);fill-opacity:0.8" }, layer));
    if (mode !== "bresenham") dd.slice(0, n).forEach((p) =>
      el("rect", { x: p.x * C + 3, y: p.y * C + 3, width: C - 6, height: C - 6, rx: 2, style: mode === "both" ? "fill:none;stroke:var(--vec-u);stroke-width:2" : "fill:var(--vec-u);fill-opacity:0.8" }, layer));
    el("line", { x1: (A[0] + 0.5) * C, y1: (A[1] + 0.5) * C, x2: (B[0] + 0.5) * C, y2: (B[1] + 0.5) * C, style: "stroke:var(--foreground);stroke-width:1.25;stroke-opacity:0.7" }, layer);
    hA.setAttribute("cx", (A[0] + 0.5) * C); hA.setAttribute("cy", (A[1] + 0.5) * C);
    hB.setAttribute("cx", (B[0] + 0.5) * C); hB.setAttribute("cy", (B[1] + 0.5) * C);

    // The step table, built with textContent only.
    table.replaceChildren();
    const cols = mode === "both" ? "grid-cols-[1.5rem_1fr_1fr]" : "grid-cols-[1.5rem_1fr]";
    const head = document.createElement("div");
    head.className = `grid ${cols} gap-x-2 border-b pb-1 text-muted-foreground`;
    head.append(...["#", mode === "dda" ? "DDA (exact x, y)" : "Bresenham", ...(mode === "both" ? ["DDA (exact x, y)"] : [])].map((s) => Object.assign(document.createElement("span"), { textContent: s })));
    table.append(head);
    const rows = mode === "dda" ? dd : br;
    rows.slice(0, n).forEach((p, i) => {
      const row = document.createElement("div");
      row.className = `grid ${cols} gap-x-2 tabular-nums` + (i === n - 1 && shown !== Infinity ? " text-brand" : "");
      const cells = [String(i), `(${p.x}, ${p.y}) ${mode === "dda" ? "← " : "· "}${p.note}`];
      if (mode === "both") cells.push(`(${dd[i].x}, ${dd[i].y}) ← ${dd[i].note}`);
      row.append(...cells.map((s) => Object.assign(document.createElement("span"), { textContent: s })));
      table.append(row);
    });
    const differ = [...brSet].filter((k) => !ddSet.has(k)).length;
    o.count.textContent = `${br.length}${shown !== Infinity ? ` (showing ${n})` : ""}`;
    o.diff.textContent = differ ? `${differ} pixel${differ > 1 ? "s" : ""} (ties rounded differently)` : "none";
  }
  draw();
}

// ============================================================ 3D pipeline

const mat = {
  mul: (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _, k) => s + A[i][k] * B[k][j], 0))),
  vec: (A, v) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0)),
  rotY: (a) => [[Math.cos(a), 0, Math.sin(a), 0], [0, 1, 0, 0], [-Math.sin(a), 0, Math.cos(a), 0], [0, 0, 0, 1]],
  rotX: (a) => [[1, 0, 0, 0], [0, Math.cos(a), -Math.sin(a), 0], [0, Math.sin(a), Math.cos(a), 0], [0, 0, 0, 1]],
  trans: (x, y, z) => [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]],
  // OpenGL conventions: camera looks down −z, NDC in [−1, 1]³.
  persp: (fovy, aspect, n, f) => {
    const t = 1 / Math.tan(fovy / 2);
    return [[t / aspect, 0, 0, 0], [0, t, 0, 0], [0, 0, (f + n) / (n - f), (2 * f * n) / (n - f)], [0, 0, -1, 0]];
  },
  ortho: (hw, hh, n, f) => [[1 / hw, 0, 0, 0], [0, 1 / hh, 0, 0], [0, 0, -2 / (f - n), -(f + n) / (f - n)], [0, 0, 0, 1]],
};

const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const CUBE_F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];

for (const root of document.querySelectorAll("[data-gfx-pipeline]")) {
  const svg = root.querySelector("[data-plot]");
  const stages = root.querySelector("[data-stages]");
  let proj = "perspective";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { proj = e.detail.value; draw(); });

  // Drag to turn the cube.
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY, s.yaw.get(), s.pitch.get()]; svg.setPointerCapture(e.pointerId); svg.style.cursor = "grabbing"; });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    let yaw = drag[2] + (e.clientX - drag[0]) * 0.5;
    yaw = ((yaw + 180) % 360 + 360) % 360 - 180;
    s.yaw.set(yaw, false);
    s.pitch.set(Math.max(-89, Math.min(89, drag[3] + (e.clientY - drag[1]) * 0.5)), false);
    draw();
  });
  svg.addEventListener("pointerup", () => { drag = null; svg.style.cursor = ""; });

  const box = (title, v, digits = 2) => {
    const d = document.createElement("div");
    d.className = "rounded-md border bg-background px-2 py-1.5";
    const t = Object.assign(document.createElement("div"), { className: "text-muted-foreground", textContent: title });
    const ds = Array.isArray(digits) ? digits : v.map(() => digits);
    const val = Object.assign(document.createElement("div"), { className: "tabular-nums", textContent: `(${v.map((x, i) => num(x, ds[i])).join(", ")})` });
    d.append(t, val);
    return d;
  };

  function draw() {
    const W = 480, H = 320, aspect = W / H;
    const fov = (s.fov.get() * Math.PI) / 180, dist = s.dist.get();
    const M = mat.mul(mat.rotY((s.yaw.get() * Math.PI) / 180), mat.rotX((s.pitch.get() * Math.PI) / 180));
    const Vw = mat.trans(0, 0, -dist);
    const hh = dist * Math.tan(fov / 2);
    const P = proj === "perspective" ? mat.persp(fov, aspect, 0.1, 100) : mat.ortho(hh * aspect, hh, 0.1, 100);
    const stagesOf = (v) => {
      const obj = [...v, 1];
      const world = mat.vec(M, obj);
      const view = mat.vec(Vw, world);
      const clip = mat.vec(P, view);
      const ndc = clip.slice(0, 3).map((c) => c / clip[3]);
      const scr = [((ndc[0] + 1) / 2) * W, ((1 - ndc[1]) / 2) * H, (ndc[2] + 1) / 2];
      return { obj, world, view, clip, ndc, scr };
    };
    const S = CUBE_V.map(stagesOf);

    svg.replaceChildren();
    // Faces back to front by view depth, lightly filled.
    const faces = CUBE_F.map((f) => ({ f, z: f.reduce((a, i) => a + S[i].view[2], 0) / 4 })).sort((a, b) => a.z - b.z);
    for (const { f } of faces) {
      const pts = f.map((i) => S[i].scr.slice(0, 2).map((v) => v.toFixed(1)).join(",")).join(" ");
      el("polygon", { points: pts, style: "fill:var(--vec-u);fill-opacity:0.06;stroke:var(--foreground);stroke-width:1.25;stroke-linejoin:round" }, svg);
    }
    const t = S[6].scr;
    el("circle", { cx: t[0], cy: t[1], r: 5.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, 8, 16, proj === "perspective" ? "perspective: far edges shrink" : "orthographic: parallel edges stay parallel");

    const v = S[6];
    stages.replaceChildren(
      box("1 · object (x, y, z, 1)", v.obj, 0),
      box("2 · world = M · object", v.world),
      box("3 · view = V · world", v.view),
      box("4 · clip = P · view", v.clip),
      box("5 · NDC = clip.xyz / w", v.ndc),
      box("6 · screen (px, px, depth)", v.scr, [1, 1, 3]),
    );
  }
  draw();
}

// ============================================================ Depth buffer

for (const root of document.querySelectorAll("[data-gfx-zbuffer]")) {
  const color = root.querySelector("[data-plot]");
  const depthSvg = root.querySelector("[data-depth]");
  const o = outs(root);
  const W = 24, H = 18, C = 10;
  let method = "zbuffer", swapped = false, anim = 0;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { method = e.detail.value; draw(); });
  root.querySelector("[data-action=swap]").addEventListener("click", () => { swapped = !swapped; draw(); });
  root.querySelector("[data-action=replay]").addEventListener("click", () => replay());

  // Two triangles with a depth per vertex (0 near, 1 far). The red one is
  // flat at 0.5; the blue one tilts across it, so each is in front of the
  // other somewhere.
  const tris = (tilt) => [
    { name: "red", color: "var(--code-del)", v: [[2, 2, 0.5], [21, 4, 0.5], [6, 16, 0.5]] },
    { name: "blue", color: "var(--vec-u)", v: [[4, 9, 0.5 - tilt * 0.4], [22, 15, 0.5 + tilt * 0.4], [20, 1, 0.5 + tilt * 0.4]] },
  ];
  const E = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  function fragments(t) {
    let [a, b, c] = t.v;
    if (E(a, b, c) < 0) [b, c] = [c, b];
    const area = E(a, b, c), out = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const p = [i + 0.5, j + 0.5];
      const w0 = E(b, c, p), w1 = E(c, a, p), w2 = E(a, b, p);
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) out.push({ i, j, z: (w0 * a[2] + w1 * b[2] + w2 * c[2]) / area });
    }
    return out;
  }

  const cells = (svg) => {
    const g = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++)
      g.push(el("rect", { x: i * C, y: j * C, width: C, height: C, style: "fill:transparent;stroke:currentColor;stroke-opacity:0.06" }, svg));
    return g;
  };
  const colorCells = cells(color), depthCells = cells(depthSvg);

  // resolve renders up to `limit` fragments (in draw order) and returns the
  // colour and depth buffers plus counts.
  function resolve(limit = Infinity) {
    const T = tris(s.tilt.get());
    const mean = (t) => t.v.reduce((a, v) => a + v[2], 0) / 3;
    let order = method === "painter" ? T.slice().sort((a, b) => mean(b) - mean(a)) : T.slice();
    if (swapped) order = order.reverse();
    const col = new Array(W * H).fill(null), dep = new Array(W * H).fill(1);
    const truth = new Array(W * H).fill(null), tdep = new Array(W * H).fill(1);
    let tests = 0, drawn = 0;
    for (const t of T) for (const f of fragments(t)) { const k = f.j * W + f.i; if (f.z < tdep[k]) { tdep[k] = f.z; truth[k] = t; } }
    for (const t of order) for (const f of fragments(t)) {
      if (drawn++ >= limit) break;
      const k = f.j * W + f.i;
      if (method === "zbuffer") { tests++; if (f.z < dep[k]) { dep[k] = f.z; col[k] = t; } }
      else { col[k] = t; dep[k] = f.z; }
    }
    const wrong = col.filter((c, k) => c && truth[k] && c !== truth[k]).length;
    return { col, dep, tests, wrong, order, total: T.reduce((a, t) => a + fragments(t).length, 0) };
  }

  function paint(r) {
    r.col.forEach((t, k) => { colorCells[k].style.fill = t ? `color-mix(in oklab, ${t.color} 75%, transparent)` : "transparent"; });
    r.dep.forEach((z, k) => { depthCells[k].style.fill = r.col[k] ? `color-mix(in oklab, var(--foreground) ${Math.round((1 - z) * 90)}%, transparent)` : "transparent"; });
    o.order.textContent = r.order.map((t) => t.name).join(" → ");
    o.wrong.textContent = method === "zbuffer" ? `${r.wrong} (the depth test picks per pixel)` : `${r.wrong} (whole triangles in one order)`;
    o.tests.textContent = method === "zbuffer" ? String(r.tests) : "none";
  }

  function draw() { cancelAnimationFrame(anim); paint(resolve()); }
  function replay() {
    cancelAnimationFrame(anim);
    const full = resolve();
    if (reduced()) return paint(full);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.floor(((now - t0) / 1600) * full.total);
      paint(resolve(k));
      if (k < full.total) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  draw();
}
