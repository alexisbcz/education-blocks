// Persistent homology of a point cloud: the Vietoris–Rips filtration up to
// triangles, reduced over ℤ/2 by the standard column algorithm. H₀ and H₁
// bars are the pairs the reduction finds, not an approximation.

import { el, text, polyline } from "./plot.js";
import { scrubAll } from "./scrub.js";
import { reduced, outs, onToggle, isOn, mulberry32, num } from "./topology-util.js";

const EMAX = 0.8;

function sample(kind, seed) {
  const r = mulberry32(seed), pts = [];
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const ring = (cx, cy, rad, n, noise) => {
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * r();
      pts.push([cx + rad * Math.cos(a) + noise * gauss(), cy + rad * Math.sin(a) + noise * gauss()]);
    }
  };
  if (kind === "circle") ring(0.5, 0.5, 0.33, 30, 0.025);
  else if (kind === "two") { ring(0.28, 0.5, 0.19, 18, 0.015); ring(0.72, 0.5, 0.19, 18, 0.015); }
  else if (kind === "blobs") for (const [cx, cy] of [[0.25, 0.3], [0.7, 0.28], [0.5, 0.75]]) for (let i = 0; i < 11; i++) pts.push([cx + 0.045 * gauss(), cy + 0.045 * gauss()]);
  else for (let i = 0; i < 32; i++) pts.push([0.08 + 0.84 * r(), 0.08 + 0.84 * r()]);
  return pts.map(([x, y]) => [Math.min(0.98, Math.max(0.02, x)), Math.min(0.98, Math.max(0.02, y))]);
}

/** Bars of H₀ and H₁ for the Rips filtration of pts, up to EMAX. */
export function barcode(pts) {
  const n = pts.length, d = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  const S = [];
  for (let i = 0; i < n; i++) S.push({ dim: 0, val: 0, v: [i] });
  const edgeAt = new Map();
  // The filtration stops at EMAX: no edge or triangle longer than that.
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (d(i, j) <= EMAX) S.push({ dim: 1, val: d(i, j), v: [i, j] });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const val = Math.max(d(i, j), d(i, k), d(j, k));
    if (val <= EMAX) S.push({ dim: 2, val, v: [i, j, k] });
  }
  S.sort((a, b) => a.val - b.val || a.dim - b.dim);
  S.forEach((s, idx) => { if (s.dim === 0) s.key = `${s.v[0]}`; else if (s.dim === 1) s.key = `${s.v[0]},${s.v[1]}`; edgeAt.set(s.key, idx); });
  const vIdx = (i) => edgeAt.get(`${i}`), eIdx = (a, b) => edgeAt.get(`${a},${b}`);
  const xor = (a, b) => {
    const out = [];
    let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (j >= b.length || (i < a.length && a[i] < b[j])) out.push(a[i++]);
      else if (i >= a.length || b[j] < a[i]) out.push(b[j++]);
      else { i++; j++; }
    }
    return out;
  };
  const cols = new Array(S.length), owner = new Map(), paired = new Set();
  const bars = [[], []];
  for (let j = 0; j < S.length; j++) {
    const s = S[j];
    let col = s.dim === 0 ? [] : s.dim === 1 ? [vIdx(s.v[0]), vIdx(s.v[1])] : [eIdx(s.v[0], s.v[1]), eIdx(s.v[0], s.v[2]), eIdx(s.v[1], s.v[2])];
    col.sort((a, b) => a - b);
    while (col.length && owner.has(col[col.length - 1])) col = xor(col, cols[owner.get(col[col.length - 1])]);
    cols[j] = col;
    if (col.length) {
      const low = col[col.length - 1];
      owner.set(low, j);
      paired.add(low); paired.add(j);
      const b = S[low];
      if (s.val - b.val > 1e-9) bars[b.dim].push({ birth: b.val, death: s.val, simplex: b.v });
    }
  }
  for (let j = 0; j < S.length; j++) {
    const s = S[j];
    if (!paired.has(j) && s.dim < 2) bars[s.dim].push({ birth: s.val, death: Infinity, simplex: s.v });
  }
  for (const b of bars) b.sort((p, q) => p.birth - q.birth || q.death - p.death);
  return { bars, S };
}

for (const root of document.querySelectorAll("[data-topo-persistence]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  let kind = "circle", seed = 11, pts = sample(kind, seed), ph = barcode(pts);
  let playing = false, raf = 0, last = 0, visible = false;
  // ε is kept exactly; the field shows it rounded to its step.
  let eps = 0.3;
  const s = scrubAll(root, () => { eps = s.eps.get(); draw(); });
  const L = 14, T = 14, SZ = 332;
  const sx = (x) => L + x * SZ, sy = (y) => T + (1 - y) * SZ;
  const BX = 384, BW = 316;
  const bx = (v) => BX + (Math.min(v, EMAX) / EMAX) * BW;
  const scene = el("g", {}, svg);

  const recompute = () => { ph = barcode(pts); draw(); };
  function draw() {
    scene.replaceChildren();
    el("rect", { x: L, y: T, width: SZ, height: SZ, rx: 8, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.15" }, scene);
    if (isOn(root, "balls")) {
      for (const p of pts) el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: (eps / 2) * SZ, style: "fill:var(--brand);fill-opacity:0.05;stroke:var(--brand);stroke-opacity:0.2" }, scene);
    }
    let tri = "", edges = "", nt = 0, ne = 0;
    for (const sp of ph.S) {
      if (sp.val > eps) break;
      if (sp.dim === 1) {
        const [a, b] = sp.v.map((i) => pts[i]);
        edges += `M${sx(a[0]).toFixed(1)},${sy(a[1]).toFixed(1)}L${sx(b[0]).toFixed(1)},${sy(b[1]).toFixed(1)}`;
        ne++;
      } else if (sp.dim === 2) {
        const [a, b, c] = sp.v.map((i) => pts[i]);
        tri += `M${sx(a[0]).toFixed(1)},${sy(a[1]).toFixed(1)}L${sx(b[0]).toFixed(1)},${sy(b[1]).toFixed(1)}L${sx(c[0]).toFixed(1)},${sy(c[1]).toFixed(1)}Z`;
        nt++;
      }
    }
    if (tri) el("path", { d: tri, style: "fill:var(--vec-u);fill-opacity:0.07;stroke:none" }, scene);
    if (edges) el("path", { d: edges, style: "fill:none;stroke:currentColor;stroke-opacity:0.45;stroke-width:1" }, scene);
    for (const p of pts) el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: 3.5, style: "fill:var(--foreground)" }, scene);

    // Barcode.
    const lanes = [{ name: "H₀", bars: ph.bars[0], y0: 26, h: 150, col: "var(--foreground)" }, { name: "H₁", bars: ph.bars[1], y0: 206, h: 110, col: "var(--vec-u)" }];
    let betti = [0, 0];
    for (const [k, lane] of lanes.entries()) {
      text(scene, BX, lane.y0 - 10, `${lane.name} · ${lane.bars.length} bar${lane.bars.length === 1 ? "" : "s"}`);
      const step = Math.min(10, lane.h / Math.max(1, lane.bars.length));
      lane.bars.forEach((b, i) => {
        const alive = b.birth <= eps && eps < b.death;
        if (alive) betti[k]++;
        const y = lane.y0 + i * step + step / 2;
        el("line", { x1: bx(b.birth), x2: Math.max(bx(b.birth) + 1.5, bx(b.death)), y1: y, y2: y, style: `stroke:${lane.col};stroke-opacity:${alive ? 1 : 0.35};stroke-width:${Math.max(1.5, Math.min(4, step - 1.5))}px;stroke-linecap:round` }, scene);
        if (b.death === Infinity) text(scene, BX + BW + 4, y + 3, "∞");
      });
      if (!lane.bars.length) text(scene, BX, lane.y0 + 14, "none yet");
    }
    const ax = 336;
    el("line", { x1: BX, x2: BX + BW, y1: ax, y2: ax, style: "stroke:currentColor;stroke-opacity:0.3" }, scene);
    for (const v of [0, 0.2, 0.4, 0.6, 0.8]) text(scene, bx(v), ax + 14, String(v), { "text-anchor": "middle" });
    text(scene, BX + BW, ax + 14 + 12, "ε", { "text-anchor": "end" });
    el("line", { x1: bx(eps), x2: bx(eps), y1: 10, y2: ax, style: "stroke:var(--brand);stroke-width:1.5" }, scene);

    const span = (b) => Math.min(b.death, EMAX) - b.birth;
    const life = ph.bars[1].reduce((m, b) => (!m || span(b) > span(m) ? b : m), null);
    o.n.textContent = String(pts.length);
    o.simp.textContent = `${ne}, ${nt}`;
    o.b0.textContent = String(betti[0]);
    o.b1.textContent = String(betti[1]);
    o.life.textContent = life ? `${life.death === Infinity ? "> " : ""}${num(span(life), 3)} (ε ${num(life.birth, 2)} → ${life.death === Infinity ? "past 0.8" : num(life.death, 2)})` : "no loops";
  }

  const toWorld = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [(p.x - L) / SZ, 1 - (p.y - T) / SZ];
  };
  svg.addEventListener("click", (e) => {
    const [x, y] = toWorld(e);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (e.shiftKey) {
      let bi = -1, bd = 14 / SZ;
      pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) return;
      pts.splice(bi, 1);
    } else {
      if (pts.length >= 48) return;
      pts.push([x, y]);
    }
    recompute();
  });
  const setLabel = () => {
    btn.querySelector("[data-label]").textContent = playing ? "Pause" : "Grow ε";
    btn.querySelector("[data-icon=play]").toggleAttribute("hidden", playing);
    btn.querySelector("[data-icon=pause]").toggleAttribute("hidden", !playing);
  };
  const tick = (t) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    eps += dt * 0.12;
    if (eps > EMAX) eps = 0;
    s.eps.set(eps, false);
    draw();
    if (playing && visible) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && playing && visible) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(svg);
  btn.addEventListener("click", () => {
    playing = !playing;
    if (playing && reduced()) { playing = false; eps = Math.min(EMAX, eps + 0.1); s.eps.set(eps, false); draw(); }
    setLabel();
    kick();
  });
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; pts = sample(kind, seed); recompute(); });
  root.querySelector("[data-action=new]").addEventListener("click", () => { seed = (seed * 16807) % 2147483647; pts = sample(kind, seed); recompute(); });
  onToggle(root, draw);
  setLabel();
  draw();
}
