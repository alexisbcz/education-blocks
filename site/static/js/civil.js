// Civil and structural engineering blocks. Each block's root carries a
// data-civ-* attribute; the module does nothing on pages without them.
// Models: the method of joints (civil-truss.js, shared with the bridge
// figure), Euler–Bernoulli beams integrated numerically, section
// properties, Euler buckling, the catenary, a simplified Eurocode-style
// stress block, tributary areas with EN 1990 factors, the natural
// frequencies of a simply supported beam, and hydrostatics on a dam.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { solveTruss } from "./civil-truss.js";
import "../anatomy/civil-bridge.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const minus = (s) => String(s).replace(/-/g, "−");
const fx = (v, d = 1) => minus(num(v, d));
const TEN = "var(--vec-u)", COMP = "var(--code-del)", BRAND = "var(--brand)";
const svgPoint = (svg, e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};
const arrowHead = (g, x, y, angle, color, size = 7) => {
  const a = angle, s = size;
  el("path", { d: `M${x} ${y} L${x - s * Math.cos(a - 0.4)} ${y - s * Math.sin(a - 0.4)} L${x - s * Math.cos(a + 0.4)} ${y - s * Math.sin(a + 0.4)} Z`, style: `fill:${color}` }, g);
};
const arrow = (g, x0, y0, x1, y1, color, width = 2) => {
  el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style: `stroke:${color};stroke-width:${width}` }, g);
  arrowHead(g, x1, y1, Math.atan2(y1 - y0, x1 - x0), color);
};

// ============================================================ truss solver

const TRUSSES = {
  pratt: {
    nodes: [[-6, 0], [-3, 0], [0, 0], [3, 0], [6, 0], [-3, 3], [0, 3], [3, 3]],
    members: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [0, 5], [4, 7], [1, 5], [2, 6], [3, 7], [5, 2], [7, 2]],
  },
  howe: {
    nodes: [[-6, 0], [-3, 0], [0, 0], [3, 0], [6, 0], [-3, 3], [0, 3], [3, 3]],
    members: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [0, 5], [4, 7], [1, 5], [2, 6], [3, 7], [1, 6], [3, 6]],
  },
  warren: {
    nodes: [[-6, 0], [-3, 0], [0, 0], [3, 0], [6, 0], [-4.5, 3], [-1.5, 3], [1.5, 3], [4.5, 3]],
    members: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [0, 5], [5, 1], [1, 6], [6, 2], [2, 7], [7, 3], [3, 8], [8, 4]],
  },
};

for (const root of document.querySelectorAll("[data-civ-truss]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  let kind = "pratt", nodes, members, removed, loadNode, selected = null;
  const SUPPORTS = () => [[0, "pin"], [4, "roller"]];
  const VX = (x) => 320 + x * 44, VZ = (z) => 250 - z * 44;
  const WX = (px) => (px - 320) / 44, WZ = (py) => (250 - py) / 44;

  function reset() {
    nodes = TRUSSES[kind].nodes.map((p) => p.slice());
    members = TRUSSES[kind].members.map((m) => m.slice());
    removed = new Set();
    loadNode = 2;
    selected = null;
    draw();
  }

  function draw() {
    const P = s.load.get();
    const active = members.filter((_, i) => !removed.has(i));
    const index = members.map((_, i) => (removed.has(i) ? -1 : active.indexOf(members[i])));
    const r = solveTruss(nodes, active, SUPPORTS(), P ? [[loadNode, 0, -P]] : []);
    svg.replaceChildren();
    const g = el("g", {}, svg);
    // Ground under the supports.
    for (const n of [0, 4]) {
      const [x, z] = nodes[n];
      const cx = VX(x), cy = VZ(z);
      el("path", { d: `M${cx} ${cy + 4} L${cx - 11} ${cy + 22} L${cx + 11} ${cy + 22} Z`, style: "fill:none;stroke:currentColor;stroke-opacity:.55;stroke-width:1.2" }, g);
      if (n === 4) for (const dx of [-6, 0, 6]) el("circle", { cx: cx + dx, cy: cy + 26, r: 3, style: "fill:none;stroke:currentColor;stroke-opacity:.55" }, g);
      el("line", { x1: cx - 18, y1: cy + (n === 4 ? 30 : 23), x2: cx + 18, y2: cy + (n === 4 ? 30 : 23), style: "stroke:currentColor;stroke-opacity:.4" }, g);
    }
    const peak = r.ok ? Math.max(1e-9, ...r.forces.map(Math.abs)) : 1;
    members.forEach(([i, j], m) => {
      const x1 = VX(nodes[i][0]), y1 = VZ(nodes[i][1]), x2 = VX(nodes[j][0]), y2 = VZ(nodes[j][1]);
      const gone = removed.has(m);
      const f = !gone && r.ok ? r.forces[index[m]] : 0;
      const sense = gone ? "gone" : !r.ok ? "none" : Math.abs(f) < 1e-6 ? "zero" : f > 0 ? "t" : "c";
      const color = sense === "t" ? TEN : sense === "c" ? COMP : "currentColor";
      const k = sense === "t" || sense === "c" ? 0.45 + 0.55 * Math.abs(f) / peak : 0.35;
      const line = el("line", {
        x1, y1, x2, y2, "data-member": m,
        style: `stroke:${color};stroke-opacity:${gone ? 0.25 : k};stroke-width:${gone ? 2 : 6};stroke-linecap:round;${gone ? "stroke-dasharray:4 5;" : ""}${m === selected ? "filter:drop-shadow(0 0 3px var(--brand));" : ""}`,
      }, g);
      line.style.cursor = "pointer";
      // A wide transparent hit line over each bar.
      el("line", { x1, y1, x2, y2, "data-member": m, style: "stroke:transparent;stroke-width:16;cursor:pointer" }, g);
      if (r.ok && !gone) {
        // Labels sit beside the bar, offset along its normal.
        const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
        const side = ny > 0 ? -1 : 1;
        const mx = (x1 + x2) / 2 + side * nx * 11, my = (y1 + y2) / 2 + side * ny * 11 + 3;
        text(g, mx, my, `${f > 0 ? "+" : ""}${fx(f, 1)}`, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px] pointer-events-none" });
      }
    });
    // Load and reactions.
    if (P) {
      const [x, z] = nodes[loadNode];
      arrow(g, VX(x), VZ(z) - 46, VX(x), VZ(z) - 9, BRAND, 2.2);
      text(g, VX(x) + 6, VZ(z) - 40, `${fx(P, 1)} kN`, { class: "font-mono text-[10px]", style: `fill:${BRAND}` });
    }
    if (r.ok) {
      for (const { node, axis, value } of r.reactions) {
        if (Math.abs(value) < 1e-9) continue;
        const [x, z] = nodes[node];
        const cx = VX(x), cy = VZ(z) + 36;
        if (axis === "z") {
          arrow(g, cx, cy + 34, cx, cy + 4, BRAND, 1.6);
          text(g, cx + 6, cy + 30, `${fx(value, 2)} kN`, { class: "font-mono text-[10px]", style: `fill:${BRAND}` });
        } else {
          arrow(g, cx - Math.sign(value) * 34, cy - 10, cx, cy - 10, BRAND, 1.6);
        }
      }
    }
    nodes.forEach(([x, z], n) => {
      const c = el("circle", { cx: VX(x), cy: VZ(z), r: 6.5, tabindex: 0, role: "button", "data-node": n, "aria-label": `Joint ${n}${n === loadNode ? ", loaded" : ""}`,
        style: `fill:var(--background);stroke:${n === loadNode ? BRAND : "currentColor"};stroke-width:${n === loadNode ? 2.4 : 1.6};cursor:grab` }, g);
      void c;
    });

    const m = active.length, rr = SUPPORTS().reduce((a, [, t]) => a + (t === "pin" ? 2 : 1), 0);
    o.count.textContent = `${m} + ${rr} = ${m + rr}`;
    o.joints.textContent = String(2 * nodes.length);
    if (r.ok) {
      // Joint equilibrium check: the largest leftover force at any joint.
      let worst = 0;
      nodes.forEach((_, n) => {
        let sx = 0, sz = 0;
        active.forEach(([i, j], k) => {
          if (i !== n && j !== n) return;
          const o2 = i === n ? j : i;
          const dx = nodes[o2][0] - nodes[n][0], dz = nodes[o2][1] - nodes[n][1], len = Math.hypot(dx, dz);
          sx += r.forces[k] * dx / len; sz += r.forces[k] * dz / len;
        });
        for (const { node, axis, value } of r.reactions) if (node === n) axis === "x" ? (sx += value) : (sz += value);
        if (n === loadNode) sz -= P;
        worst = Math.max(worst, Math.hypot(sx, sz));
      });
      o.status.textContent = `solved · residual ${worst < 1e-9 ? "< 10⁻⁹" : worst.toExponential(1)} kN`;
      o.status.className = "tabular-nums text-add";
      o.reactions.textContent = r.reactions.filter((x) => x.axis === "z").map((x) => `${fx(x.value, 2)}`).join(" · ") + " kN";
      const t = Math.max(0, ...r.forces), c = Math.min(0, ...r.forces);
      o.maxt.textContent = `${fx(t, 2)} kN`;
      o.maxc.textContent = `${fx(c, 2)} kN`;
    } else {
      o.status.textContent = r.reason === "mechanism" ? "mechanism: m + r < 2j, it collapses" : r.reason === "indeterminate" ? "indeterminate: m + r > 2j" : "unstable geometry";
      o.status.className = "tabular-nums text-del";
      o.reactions.textContent = o.maxt.textContent = o.maxc.textContent = "—";
    }
    if (selected !== null) {
      const [i, j] = members[selected];
      const len = Math.hypot(nodes[j][0] - nodes[i][0], nodes[j][1] - nodes[i][1]);
      const f = r.ok && !removed.has(selected) ? r.forces[index[selected]] : null;
      o.sel.textContent = `bar ${i}–${j}, ${num(len, 2)} m${f === null ? (removed.has(selected) ? ", removed" : "") : `, ${f > 0 ? "+" : ""}${fx(f, 2)} kN`}`;
    } else o.sel.textContent = "click a bar";
  }

  // Drag joints; a click without movement loads the joint.
  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    const n = e.target.dataset?.node;
    if (n !== undefined) {
      drag = { n: +n, moved: false, x: e.clientX, y: e.clientY };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return;
    drag.moved = true;
    const p = svgPoint(svg, e);
    nodes[drag.n] = [Math.round(Math.max(-7, Math.min(7, WX(p.x))) * 4) / 4, Math.round(Math.max(-0.5, Math.min(5, WZ(p.y))) * 4) / 4];
    draw();
  });
  svg.addEventListener("pointerup", () => {
    if (drag && !drag.moved) { loadNode = drag.n; draw(); }
    drag = null;
  });
  svg.addEventListener("click", (e) => {
    const m = e.target.dataset?.member;
    if (m === undefined) return;
    const i = +m;
    selected = i;
    removed.has(i) ? removed.delete(i) : removed.add(i);
    draw();
  });
  svg.addEventListener("keydown", (e) => {
    const n = e.target.dataset?.node;
    if (n === undefined) return;
    const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
    if (d) {
      nodes[+n] = [nodes[+n][0] + d[0], nodes[+n][1] + d[1]];
    } else if (e.key === "Enter" || e.key === " ") {
      loadNode = +n;
    } else return;
    e.preventDefault();
    draw();
    svg.querySelector(`[data-node="${n}"]`)?.focus();
  });
  onSeg(root, (_, v) => { kind = v; reset(); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  root.querySelector("[data-action=restore]").addEventListener("click", () => { removed.clear(); draw(); });
  reset();
}

// ============================================================ beam

for (const root of document.querySelectorAll("[data-civ-beam]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "simple";
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { mode = v; draw(); });

  function solve(L, P, a, w, EI) {
    const N = 600, xs = [], V = [], M = [];
    let RA, RB, M0 = 0;
    if (mode === "simple") {
      RA = P * (L - a) / L + w * L / 2;
      RB = P * a / L + w * L / 2;
    } else {
      RA = P + w * L; // fixed end at x = 0
      M0 = -(P * a + w * L * L / 2);
      RB = 0;
    }
    for (let i = 0; i <= N; i++) {
      const x = (L * i) / N;
      xs.push(x);
      const right = x > a ? 1 : 0;
      V.push(RA - w * x - P * right);
      M.push(mode === "simple" ? RA * x - w * x * x / 2 - P * Math.max(0, x - a) : -P * Math.max(0, a - x) - w * (L - x) ** 2 / 2);
    }
    // EI·v'' = M with v positive up: integrate twice (trapezoid rule).
    const dx = L / N, slope = [0], v = [0];
    for (let i = 1; i <= N; i++) {
      slope.push(slope[i - 1] + ((M[i - 1] + M[i]) / 2 / EI) * dx);
      v.push(v[i - 1] + ((slope[i - 1] + slope[i]) / 2) * dx);
    }
    if (mode === "simple") {
      const c = v[N] / L; // add a rigid rotation so v(L) = 0
      for (let i = 0; i <= N; i++) v[i] -= c * xs[i];
    }
    return { xs, V, M, v, RA, RB, M0 };
  }

  function draw() {
    const L = s.span.get(), P = s.p.get(), w = s.w.get(), EI = s.ei.get() * 1000; // kN·m²
    const a = Math.min(L, s.a.get());
    const r = solve(L, P, a, w, EI);
    svg.replaceChildren();
    const box = (top, hgt) => [70, top, 540, hgt];
    // Beam diagram.
    const bx = (x) => 70 + (x / L) * 540;
    const g = el("g", {}, svg);
    el("rect", { x: 70, y: 46, width: 540, height: 8, rx: 2, style: "fill:color-mix(in oklab,currentColor 10%,transparent);stroke:currentColor;stroke-opacity:.6" }, g);
    if (mode === "simple") {
      for (const [x, roller] of [[0, false], [L, true]]) {
        const cx = bx(x);
        el("path", { d: `M${cx} 54 L${cx - 9} 70 L${cx + 9} 70 Z`, style: "fill:none;stroke:currentColor;stroke-opacity:.6" }, g);
        if (roller) el("line", { x1: cx - 12, y1: 74, x2: cx + 12, y2: 74, style: "stroke:currentColor;stroke-opacity:.5" }, g);
      }
    } else {
      el("rect", { x: 58, y: 34, width: 12, height: 32, style: "fill:color-mix(in oklab,currentColor 18%,transparent)" }, g);
      for (let k = 0; k < 5; k++) el("line", { x1: 58, y1: 36 + k * 7, x2: 52, y2: 42 + k * 7, style: "stroke:currentColor;stroke-opacity:.5" }, g);
    }
    if (w > 0) for (let k = 0; k <= 12; k++) arrow(g, bx((L * k) / 12), 22, bx((L * k) / 12), 44, "var(--vec-v)", 1);
    if (w > 0) el("line", { x1: 70, y1: 22, x2: 610, y2: 22, style: "stroke:var(--vec-v)" }, g);
    if (P > 0) { arrow(g, bx(a), 4, bx(a), 44, BRAND, 2.2); text(g, bx(a) + 6, 14, `P ${fx(P, 1)} kN`, { class: "font-mono text-[10px]", style: `fill:${BRAND}` }); }
    // Diagrams.
    const panel = (top, hgt, data, label, color, unit, flip = false) => {
      const lo = Math.min(0, ...data), hi = Math.max(0, ...data);
      const pad = (hi - lo) * 0.12 || 1;
      const f = frame(svg, { box: box(top, hgt), x: [0, L], y: flip ? [hi + pad, lo - pad] : [lo - pad, hi + pad], xticks: [], yticks: [0] });
      const pts = r.xs.map((x, i) => [f.sx(x), f.sy(data[i])]);
      el("path", { d: `M${f.sx(0)} ${f.sy(0)} ` + pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + ` L${f.sx(L)} ${f.sy(0)} Z`, style: `fill:${color};fill-opacity:.14` }, svg);
      polyline(svg, pts, `stroke:${color};stroke-width:1.6`);
      hline(svg, f, 0, "stroke:currentColor;stroke-opacity:.35");
      text(svg, 4, top + 10, label, { "text-anchor": "start" });
      const iMax = data.reduce((b, v, i) => (Math.abs(v) > Math.abs(data[b]) ? i : b), 0);
      if (Math.abs(data[iMax]) > 1e-9) text(svg, f.sx(r.xs[iMax]), f.sy(data[iMax]) + (data[iMax] >= 0 !== flip ? -5 : 13), `${fx(data[iMax], 2)} ${unit}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      return f;
    };
    panel(96, 76, r.V, "V (kN)", "var(--vec-u)", "kN");
    panel(196, 90, r.M, "M (kN·m)", "var(--code-del)", "kN·m", true);
    const vmm = r.v.map((v) => v * 1000);
    const fd = panel(310, 90, vmm, "δ (mm)", BRAND, "mm");
    text(svg, 610, 418, "x (m) →", { "text-anchor": "end" });
    void fd;

    const maxV = Math.max(...r.V.map(Math.abs)), maxM = Math.max(...r.M.map(Math.abs)), maxD = Math.max(...vmm.map(Math.abs));
    o.reactions.textContent = mode === "simple" ? `${fx(r.RA, 2)} · ${fx(r.RB, 2)} kN` : `${fx(r.RA, 2)} kN, ${fx(r.M0, 2)} kN·m`;
    o.vmax.textContent = `${fx(maxV, 2)} kN`;
    o.mmax.textContent = `${fx(maxM, 2)} kN·m`;
    o.dmax.textContent = `${fx(maxD, 2)} mm`;
    // A closed-form check when the load case has one.
    let check = "—";
    if (mode === "simple" && w === 0 && P > 0 && Math.abs(a - L / 2) < 1e-9) check = `PL³/48EI = ${fx((P * L ** 3 / (48 * EI)) * 1000, 2)} mm`;
    else if (mode === "simple" && P === 0 && w > 0) check = `5wL⁴/384EI = ${fx((5 * w * L ** 4 / (384 * EI)) * 1000, 2)} mm`;
    else if (mode === "cantilever" && w === 0 && P > 0 && Math.abs(a - L) < 1e-9) check = `PL³/3EI = ${fx((P * L ** 3 / (3 * EI)) * 1000, 2)} mm`;
    else if (mode === "cantilever" && P === 0 && w > 0) check = `wL⁴/8EI = ${fx((w * L ** 4 / (8 * EI)) * 1000, 2)} mm`;
    o.check.textContent = check;
  }
  draw();
}

// ============================================================ sections

const STEEL_RHO = 7850; // kg/m³

function sectionProps(shape, hgt, b, t) {
  const tw = Math.max(1, 0.6 * t);
  switch (shape) {
    case "ibeam": {
      const tf = Math.min(t, hgt / 2 - 1), web = Math.min(tw, b);
      return { A: 2 * b * tf + (hgt - 2 * tf) * web, I: (b * hgt ** 3 - (b - web) * (hgt - 2 * tf) ** 3) / 12, ymax: hgt / 2 };
    }
    case "rect":
      return { A: b * hgt, I: (b * hgt ** 3) / 12, ymax: hgt / 2 };
    case "tube": {
      const tt = Math.min(t, b / 2 - 1, hgt / 2 - 1);
      return { A: b * hgt - (b - 2 * tt) * (hgt - 2 * tt), I: (b * hgt ** 3 - (b - 2 * tt) * (hgt - 2 * tt) ** 3) / 12, ymax: hgt / 2 };
    }
    default: // solid round bar of diameter h
      return { A: (Math.PI * hgt ** 2) / 4, I: (Math.PI * hgt ** 4) / 64, ymax: hgt / 2 };
  }
}

for (const root of document.querySelectorAll("[data-civ-section]")) {
  const shapeSvg = root.querySelector("[data-shape]"), cmp = root.querySelector("[data-compare]");
  const o = outs(root);
  let shape = "ibeam";
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { shape = v; draw(); });

  function draw() {
    const hgt = s.depth.get(), b = s.width.get(), t = s.t.get(), M = s.m.get();
    const p = sectionProps(shape, hgt, b, t);
    const W = p.I / p.ymax, sigma = (M * 1e6) / W; // N·mm / mm³ = MPa
    shapeSvg.replaceChildren();
    const scale = 220 / Math.max(hgt, b), cx = 120, cy = 150;
    const R = (x0, y0, w, hh) => el("rect", { x: cx + x0 * scale, y: cy + y0 * scale, width: w * scale, height: hh * scale, style: "fill:color-mix(in oklab,currentColor 16%,transparent);stroke:currentColor;stroke-opacity:.7" }, shapeSvg);
    const tw = Math.max(1, 0.6 * t);
    if (shape === "ibeam") {
      const tf = Math.min(t, hgt / 2 - 1);
      R(-b / 2, -hgt / 2, b, tf); R(-b / 2, hgt / 2 - tf, b, tf); R(-tw / 2, -hgt / 2 + tf, tw, hgt - 2 * tf);
    } else if (shape === "rect") R(-b / 2, -hgt / 2, b, hgt);
    else if (shape === "tube") {
      const tt = Math.min(t, b / 2 - 1, hgt / 2 - 1);
      el("path", { d: `M${cx - (b / 2) * scale} ${cy - (hgt / 2) * scale} h${b * scale} v${hgt * scale} h${-b * scale} Z M${cx - (b / 2 - tt) * scale} ${cy - (hgt / 2 - tt) * scale} v${(hgt - 2 * tt) * scale} h${(b - 2 * tt) * scale} v${-(hgt - 2 * tt) * scale} Z`, "fill-rule": "evenodd", style: "fill:color-mix(in oklab,currentColor 16%,transparent);stroke:currentColor;stroke-opacity:.7" }, shapeSvg);
    } else el("circle", { cx, cy, r: (hgt / 2) * scale, style: "fill:color-mix(in oklab,currentColor 16%,transparent);stroke:currentColor;stroke-opacity:.7" }, shapeSvg);
    el("line", { x1: 4, y1: cy, x2: 236, y2: cy, style: "stroke:var(--brand);stroke-dasharray:5 4" }, shapeSvg);
    text(shapeSvg, 6, cy - 5, "neutral axis", { "text-anchor": "start" });
    // Stress through the depth: compression above (sagging), tension below.
    const sx0 = 268, smax = 48, top = cy - (hgt / 2) * scale, bot = cy + (hgt / 2) * scale;
    el("line", { x1: sx0, y1: top - 8, x2: sx0, y2: bot + 8, style: "stroke:currentColor;stroke-opacity:.4" }, shapeSvg);
    el("path", { d: `M${sx0} ${cy} L${sx0 - smax} ${top} L${sx0} ${top} Z`, style: `fill:${COMP};fill-opacity:.28;stroke:${COMP}` }, shapeSvg);
    el("path", { d: `M${sx0} ${cy} L${sx0 + smax} ${bot} L${sx0} ${bot} Z`, style: `fill:${TEN};fill-opacity:.28;stroke:${TEN}` }, shapeSvg);
    text(shapeSvg, sx0 - smax, top - 4, `−${num(sigma, 0)}`, { "text-anchor": "middle" });
    text(shapeSvg, sx0 + smax, bot + 12, `+${num(sigma, 0)} MPa`, { "text-anchor": "middle" });

    // I per kilogram of the four shapes at these dimensions.
    cmp.replaceChildren();
    const shapes = [["ibeam", "I-beam"], ["tube", "Box"], ["rect", "Rectangle"], ["round", "Round"]];
    const vals = shapes.map(([k2]) => { const q = sectionProps(k2, hgt, b, t); return q.I / (q.A * 1e-6 * STEEL_RHO); });
    const best = Math.max(...vals);
    text(cmp, 4, 14, "I per kg/m (relative)", { "text-anchor": "start" });
    shapes.forEach(([k2, label], i) => {
      const y = 40 + i * 62, wbar = (vals[i] / best) * 230;
      el("rect", { x: 4, y, width: Math.max(2, wbar), height: 18, rx: 3, style: `fill:${k2 === shape ? BRAND : "currentColor"};fill-opacity:${k2 === shape ? 0.8 : 0.18}` }, cmp);
      text(cmp, 4, y + 34, `${label} · ${num((vals[i] / best) * 100, 0)}%`, { "text-anchor": "start", class: k2 === shape ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    });

    o.area.textContent = `${num(p.A, 0)} mm²`;
    o.mass.textContent = `${num(p.A * 1e-6 * STEEL_RHO, 1)} kg/m`;
    o.i.textContent = `${num(p.I / 1e6, 2)} × 10⁶ mm⁴`;
    o.w.textContent = `${num(W / 1e3, 1)} × 10³ mm³`;
    o.sigma.textContent = `${num(sigma, 1)} MPa`;
    const u = sigma / 355;
    o.util.textContent = `${num(u * 100, 0)}%${u > 1 ? " · yields" : ""}`;
    o.util.className = u > 1 ? "tabular-nums text-del" : "tabular-nums";
  }
  draw();
}

// ============================================================ buckling

const KS = { pp: 1, ff: 0.5, fp: 0.7, fr: 2 };
const E_STEEL = 210000, FY = 355; // MPa

function modeShape(kind, u) {
  // u from 0 (base) to 1 (top); returns the normalised lateral deflection.
  if (kind === "pp") return Math.sin(Math.PI * u);
  if (kind === "ff") return (1 - Math.cos(2 * Math.PI * u)) / 2;
  if (kind === "fr") return 1 - Math.cos((Math.PI * u) / 2);
  // Fixed at the base, pinned at the top: kL = 4.4934 (tan kL = kL).
  const kL = 4.493409, y = (q) => kL - kL * q - kL * Math.cos(kL * q) + Math.sin(kL * q);
  let peak = 0;
  for (let q = 0; q <= 1; q += 0.01) peak = Math.max(peak, Math.abs(y(q)));
  return y(u) / peak;
}

for (const root of document.querySelectorAll("[data-civ-buckle]")) {
  const col = root.querySelector("[data-column]"), curve = root.querySelector("[data-curve]");
  const o = outs(root);
  let kind = "pp";
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { kind = v; draw(); });

  function props() {
    const D = s.d.get(), t = Math.min(s.t.get(), D / 2 - 0.5), d = D - 2 * t;
    return { I: (Math.PI / 64) * (D ** 4 - d ** 4), A: (Math.PI / 4) * (D ** 2 - d ** 2) };
  }
  function draw() {
    const L = s.len.get() * 1000, K = KS[kind];
    const { I, A } = props();
    const pcr = (Math.PI ** 2 * E_STEEL * I) / (K * L) ** 2 / 1000; // kN
    const squash = (A * FY) / 1000;
    const lambda = (K * L) / Math.sqrt(I / A);

    col.replaceChildren();
    const base = 296, topY = 24, cx = 100;
    // Supports drawn by end condition.
    const fixed = (y, up) => { el("rect", { x: cx - 26, y: up ? y - 8 : y, width: 52, height: 8, style: "fill:color-mix(in oklab,currentColor 18%,transparent)" }, col); };
    const pin = (y, up) => el("path", { d: up ? `M${cx} ${y} L${cx - 10} ${y - 14} L${cx + 10} ${y - 14} Z` : `M${cx} ${y} L${cx - 10} ${y + 14} L${cx + 10} ${y + 14} Z`, style: "fill:none;stroke:currentColor;stroke-opacity:.6" }, col);
    if (kind === "pp") { pin(base, false); pin(topY, true); }
    if (kind === "ff") { fixed(base, false); fixed(topY, true); }
    if (kind === "fp") { fixed(base, false); pin(topY, true); }
    if (kind === "fr") fixed(base, false);
    const amp = 34;
    const pts = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60; pts.push([cx + amp * modeShape(kind, u), base - u * (base - topY)]); }
    polyline(col, pts.map(([x, y]) => [cx, y]), "stroke:currentColor;stroke-opacity:.25;stroke-dasharray:4 4");
    polyline(col, pts, `stroke:${COMP};stroke-width:3;stroke-linecap:round`);
    arrow(col, pts[60][0], topY - 20 - (kind === "pp" || kind === "fp" ? 14 : kind === "ff" ? 8 : 0), pts[60][0], topY - 2 - (kind === "pp" || kind === "fp" ? 14 : kind === "ff" ? 8 : 0), BRAND, 2);
    text(col, cx - 70, 14, `K = ${K}`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });

    curve.replaceChildren();
    const Ls = Array.from({ length: 120 }, (_, i) => 0.5 + (i * 11.5) / 119);
    const euler = Ls.map((l) => (Math.PI ** 2 * E_STEEL * I) / (K * l * 1000) ** 2 / 1000);
    const yMax = Math.min(squash * 2.2, Math.max(...euler));
    const f = frame(curve, { box: [52, 14, 356, 270], x: [0.5, 12], y: [0, yMax], xticks: [2, 4, 6, 8, 10, 12], yticks: [0, yMax / 2, yMax], yfmt: (v) => num(v, 0), xlabel: "L (m)", ylabel: "kN" });
    polyline(curve, Ls.map((l, i) => [f.sx(l), f.sy(Math.min(euler[i], yMax))]), `stroke:${COMP};stroke-width:1.6;stroke-dasharray:5 4`);
    hline(curve, f, squash, "stroke:var(--vec-u);stroke-dasharray:5 4", "squash A·f_y");
    polyline(curve, Ls.map((l, i) => [f.sx(l), f.sy(Math.min(euler[i], squash))]), "stroke:var(--foreground);stroke-width:2");
    const cur = Math.min(pcr, squash);
    el("circle", { cx: f.sx(L / 1000), cy: f.sy(Math.min(cur, yMax)), r: 4.5, style: `fill:${BRAND};stroke:var(--background);stroke-width:2` }, curve);
    text(curve, f.sx(1.2), f.sy(yMax) + 12, "Euler P_cr", { "text-anchor": "start", style: `fill:${COMP}` });

    o.k.textContent = String(K);
    o.i.textContent = `${num(I / 1e6, 2)} × 10⁶ mm⁴`;
    o.pcr.textContent = `${num(pcr, 0)} kN`;
    o.squash.textContent = `${num(squash, 0)} kN`;
    o.lambda.textContent = num(lambda, 0);
    o.mode.textContent = pcr < squash ? "buckling (Euler)" : "crushing (squash load)";
  }
  draw();
}

// ============================================================ arch / catenary

for (const root of document.querySelectorAll("[data-civ-arch]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let orient = "chain";
  const s = scrubAll(root, () => draw());
  onSeg(root, (_, v) => { orient = v; draw(); });

  // a such that a·(cosh(S/2a) − 1) = f, by bisection on log a.
  function catenaryA(S, f) {
    let lo = Math.log(1e-3), hi = Math.log(1e6);
    const g = (la) => { const a = Math.exp(la); return a * (Math.cosh(S / (2 * a)) - 1) - f; };
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; g(mid) > 0 ? (lo = mid) : (hi = mid); }
    return Math.exp((lo + hi) / 2);
  }
  function draw() {
    const S = s.span.get(), sag = s.sag.get(), q = s.q.get();
    const a = catenaryA(S, sag);
    const cat = (x) => a * (Math.cosh(x / a) - 1), par = (x) => (4 * sag * x * x) / (S * S);
    svg.replaceChildren();
    const sc = Math.min(560 / S, 270 / sag), cx = 320;
    const up = orient === "arch";
    // The chain hangs from supports at the top; the arch stands on them.
    const X = (x) => cx + x * sc;
    const yOf = (v) => (up ? 312 - (sag - v) * sc : 30 + (sag - v) * sc);
    const xs = Array.from({ length: 121 }, (_, i) => -S / 2 + (S * i) / 120);
    polyline(svg, xs.map((x) => [X(x), yOf(par(x))]), "stroke:var(--vec-v);stroke-width:1.4;stroke-dasharray:6 4");
    polyline(svg, xs.map((x) => [X(x), yOf(cat(x))]), `stroke:${up ? COMP : TEN};stroke-width:3.2;stroke-linecap:round`);
    const H = q * a, half = a * Math.sinh(S / (2 * a)), V = q * half, T = Math.hypot(H, V);
    for (const side of [-1, 1]) {
      const xe = (side * S) / 2, px = X(xe), py = yOf(cat(xe));
      el("rect", { x: px - 12, y: up ? py : py - 10, width: 24, height: 10, style: "fill:color-mix(in oklab,currentColor 18%,transparent)" }, svg);
      // Unit tangent from the support into the curve.
      const qx = X(xe - side * S * 0.002), qy = yOf(cat(xe - side * S * 0.002));
      const len = Math.hypot(qx - px, qy - py) || 1, ux = (qx - px) / len, uy = (qy - py) / len;
      // A chain pulls its support inward along the tangent; an arch pushes into it.
      if (up) arrow(svg, px + ux * 50, py + uy * 50, px + ux * 4, py + uy * 4, BRAND, 1.8);
      else arrow(svg, px + ux * 4, py + uy * 4, px + ux * 50, py + uy * 50, BRAND, 1.8);
    }
    text(svg, 8, 16, up ? "arch (compression): solid · parabola: dashed" : "hanging chain (tension): solid · parabola: dashed", { "text-anchor": "start" });
    let gap = 0;
    for (const x of xs) gap = Math.max(gap, Math.abs(cat(x) - par(x)));
    o.a.textContent = `${num(a, 2)} m`;
    o.h.textContent = `${num(H, 1)} kN`;
    o.tend.textContent = `${num(T, 1)} kN`;
    o.len.textContent = `${num(2 * half, 2)} m`;
    o.gap.textContent = `${num(gap * 100, 1)} cm`;
  }
  draw();
}

// ============================================================ reinforced concrete

for (const root of document.querySelectorAll("[data-civ-rc]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const b = s.b.get(), h = s.h.get(), n = Math.round(s.n.get()), phi = s.phi.get(), fck = s.fck.get(), fyk = s.fyk.get();
    const As = (n * Math.PI * phi * phi) / 4;
    const d = h - 50 - phi / 2;
    const fcd = (0.85 * fck) / 1.5, fyd = fyk / 1.15, Es = 200000, ecu = 0.0035;
    // Assume the steel yields: C = 0.8·x·b·fcd = T = As·fyd.
    let x = (As * fyd) / (0.8 * b * fcd);
    let es = (ecu * (d - x)) / x;
    let fs = fyd;
    if (es < fyd / Es) {
      // The steel doesn't yield: solve 0.8·b·fcd·x = As·Es·ecu·(d − x)/x.
      const A = 0.8 * b * fcd, B = As * Es * ecu, C = -As * Es * ecu * d;
      x = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
      es = (ecu * (d - x)) / x;
      fs = Es * es;
    }
    const z = d - 0.4 * x, Mrd = (As * fs * z) / 1e6; // kN·m

    svg.replaceChildren();
    const sc = 280 / h, ox = 40, oy = 24;
    const w = b * sc;
    el("rect", { x: ox, y: oy, width: w, height: h * sc, style: "fill:color-mix(in oklab,currentColor 10%,transparent);stroke:currentColor;stroke-opacity:.7" }, svg);
    el("rect", { x: ox, y: oy, width: w, height: 0.8 * x * sc, style: `fill:${COMP};fill-opacity:.22` }, svg);
    el("line", { x1: ox - 6, y1: oy + x * sc, x2: ox + w + 6, y2: oy + x * sc, style: "stroke:var(--brand);stroke-dasharray:5 4" }, svg);
    text(svg, ox + w + 8, oy + x * sc + 3, "NA", { "text-anchor": "start" });
    for (let i = 0; i < n; i++) {
      const bxp = n === 1 ? ox + w / 2 : ox + (50 + phi / 2) * sc + (i * (w - 2 * (50 + phi / 2) * sc)) / (n - 1);
      el("circle", { cx: bxp, cy: oy + d * sc, r: Math.max(2.5, (phi / 2) * sc), style: `fill:${TEN};stroke:var(--background);stroke-width:1` }, svg);
    }
    // Strain diagram.
    const sx = 330, ew = 70 / Math.max(ecu, es);
    el("line", { x1: sx, y1: oy, x2: sx, y2: oy + h * sc, style: "stroke:currentColor;stroke-opacity:.4" }, svg);
    el("path", { d: `M${sx} ${oy + x * sc} L${sx - ecu * ew} ${oy} L${sx} ${oy} Z`, style: `fill:${COMP};fill-opacity:.25;stroke:${COMP}` }, svg);
    el("path", { d: `M${sx} ${oy + x * sc} L${sx + es * ew} ${oy + d * sc} L${sx} ${oy + d * sc} Z`, style: `fill:${TEN};fill-opacity:.25;stroke:${TEN}` }, svg);
    text(svg, sx - ecu * ew, oy - 6, "ε_cu 3.5‰", { "text-anchor": "middle" });
    text(svg, sx + es * ew, oy + d * sc + 14, `ε_s ${num(es * 1000, 2)}‰`, { "text-anchor": "middle" });
    text(svg, sx, oy + h * sc + 18, "strain", { "text-anchor": "middle" });
    // Forces and lever arm.
    const fxp = 490;
    const yc = oy + 0.4 * x * sc, yt = oy + d * sc;
    arrow(svg, fxp + 50, yc, fxp, yc, COMP, 2.2);
    arrow(svg, fxp, yt, fxp + 50, yt, TEN, 2.2);
    el("line", { x1: fxp + 70, y1: yc, x2: fxp + 70, y2: yt, style: "stroke:currentColor;stroke-opacity:.5" }, svg);
    text(svg, fxp + 74, (yc + yt) / 2, `z ${num(z, 0)} mm`, { "text-anchor": "start" });
    text(svg, fxp + 25, yc - 6, `C ${num((As * fs) / 1000, 0)} kN`, { "text-anchor": "middle" });
    text(svg, fxp + 25, yt + 14, `T ${num((As * fs) / 1000, 0)} kN`, { "text-anchor": "middle" });

    const xd = x / d;
    o.as.textContent = `${num(As, 0)} mm²`;
    o.d.textContent = `${num(d, 0)} mm`;
    o.x.textContent = `${num(x, 0)} mm`;
    o.xd.textContent = num(xd, 2);
    o.z.textContent = `${num(z, 0)} mm`;
    o.mrd.textContent = `${num(Mrd, 1)} kN·m`;
    const yields = fs >= fyd - 1e-6;
    o.duct.textContent = !yields ? "over-reinforced: concrete crushes first" : xd <= 0.45 ? "ductile: steel yields first" : "steel yields, but x/d > 0.45";
    o.duct.className = !yields || xd > 0.45 ? "tabular-nums text-del" : "tabular-nums text-add";
  }
  draw();
}

// ============================================================ loads

for (const root of document.querySelectorAll("[data-civ-loads]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const NX = 4, NY = 4; // columns: 3 × 3 bays
  let sel = [1, 1];

  function draw() {
    const sx = s.sx.get(), sy = s.sy.get(), G = s.g.get(), Q = s.q.get(), n = Math.round(s.storeys.get());
    svg.replaceChildren();
    const W = (NX - 1) * sx, D = (NY - 1) * sy;
    const sc = Math.min(560 / W, 290 / D), ox = 320 - (W * sc) / 2, oy = 22;
    const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
    el("rect", { x: X(0) - 8, y: Y(0) - 8, width: W * sc + 16, height: D * sc + 16, rx: 4, style: "fill:color-mix(in oklab,currentColor 6%,transparent);stroke:currentColor;stroke-opacity:.35" }, svg);
    // Tributary area of the selected column: halfway to its neighbours.
    const [ci, cj] = sel;
    const x0 = Math.max(0, (ci - 0.5) * sx), x1 = Math.min(W, (ci + 0.5) * sx);
    const y0 = Math.max(0, (cj - 0.5) * sy), y1 = Math.min(D, (cj + 0.5) * sy);
    el("rect", { x: X(x0), y: Y(y0), width: (x1 - x0) * sc, height: (y1 - y0) * sc, style: `fill:${BRAND};fill-opacity:.18;stroke:${BRAND};stroke-dasharray:5 4` }, svg);
    for (let i = 0; i < NX; i++) el("line", { x1: X(i * sx), y1: Y(0), x2: X(i * sx), y2: Y(D), style: "stroke:currentColor;stroke-opacity:.45;stroke-width:2" }, svg);
    for (let j = 0; j < NY; j++) el("line", { x1: X(0), y1: Y(j * sy), x2: X(W), y2: Y(j * sy), style: "stroke:currentColor;stroke-opacity:.45;stroke-width:2" }, svg);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const on = i === ci && j === cj;
      const c = el("rect", { x: X(i * sx) - 7, y: Y(j * sy) - 7, width: 14, height: 14, rx: 2, tabindex: 0, role: "button", "data-col": `${i},${j}`, "aria-label": `Column ${String.fromCharCode(65 + i)}${j + 1}`,
        style: `fill:${on ? BRAND : "var(--background)"};stroke:${on ? BRAND : "currentColor"};stroke-width:1.6;cursor:pointer` }, svg);
      void c;
    }
    for (let i = 0; i < NX; i++) text(svg, X(i * sx), Y(D) + 26, String.fromCharCode(65 + i), { "text-anchor": "middle" });
    for (let j = 0; j < NY; j++) text(svg, X(0) - 18, Y(j * sy) + 3, String(j + 1), { "text-anchor": "end" });
    const A = (x1 - x0) * (y1 - y0);
    const where = (ci === 0 || ci === NX - 1) && (cj === 0 || cj === NY - 1) ? "corner" : ci === 0 || ci === NX - 1 || cj === 0 || cj === NY - 1 ? "edge" : "interior";
    o.col.textContent = `${String.fromCharCode(65 + ci)}${cj + 1} · ${where}`;
    o.area.textContent = `${num(A, 2)} m²`;
    o.sls.textContent = `${num((G + Q) * A, 1)} kN / storey`;
    o.uls.textContent = `${num((1.35 * G + 1.5 * Q) * A, 1)} kN / storey`;
    o.base.textContent = `${num((1.35 * G + 1.5 * Q) * A * n, 0)} kN ULS`;
  }
  const pick = (t) => { const c = t.dataset?.col; if (!c) return false; sel = c.split(",").map(Number); draw(); svg.querySelector(`[data-col="${c}"]`)?.focus(); return true; };
  svg.addEventListener("click", (e) => pick(e.target));
  svg.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && pick(e.target)) e.preventDefault(); });
  draw();
}

// ============================================================ footbridge

for (const root of document.querySelectorAll("[data-civ-foot]")) {
  const mode = root.querySelector("[data-mode]"), bands = root.querySelector("[data-bands]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  let n = 1, playing = false, raf = 0, t0 = 0, visible = false;
  const s = scrubAll(root, () => draw(0));
  onSeg(root, (_, v) => { n = +v; draw(0); });
  const freq = (k) => {
    const L = s.span.get(), EI = s.ei.get() * 1e9, m = s.mass.get() * 1000;
    return ((k * k * Math.PI) / (2 * L * L)) * Math.sqrt(EI / m);
  };

  function draw(time) {
    const f = [1, 2, 3].map(freq);
    mode.replaceChildren();
    const x0 = 30, x1 = 610, yb = 80, amp = 34;
    for (const x of [x0, x1]) el("path", { d: `M${x} ${yb + 4} L${x - 9} ${yb + 20} L${x + 9} ${yb + 20} Z`, style: "fill:none;stroke:currentColor;stroke-opacity:.6" }, mode);
    const phase = Math.cos(2 * Math.PI * f[n - 1] * 0.25 * time);
    const pts = Array.from({ length: 121 }, (_, i) => { const u = i / 120; return [x0 + u * (x1 - x0), yb - amp * Math.sin(n * Math.PI * u) * (time ? phase : 1)]; });
    polyline(mode, pts.map(([x]) => [x, yb]), "stroke:currentColor;stroke-opacity:.25;stroke-dasharray:4 4");
    polyline(mode, pts, `stroke:${BRAND};stroke-width:3;stroke-linecap:round`);
    text(mode, x0, 18, `mode ${n} · f = ${num(f[n - 1], 2)} Hz${playing ? " · shown at ¼ speed" : ""}`, { "text-anchor": "start" });

    bands.replaceChildren();
    const fr = frame(bands, { box: [30, 10, 580, 100], x: [0, 6], y: [0, 1], xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [], xlabel: "Hz" });
    el("rect", { x: fr.sx(1.6), y: fr.T, width: fr.sx(2.4) - fr.sx(1.6), height: fr.H, style: `fill:${COMP};fill-opacity:.16` }, bands);
    el("rect", { x: fr.sx(0.5), y: fr.T, width: fr.sx(1.2) - fr.sx(0.5), height: fr.H, style: "fill:var(--vec-v);fill-opacity:.14" }, bands);
    text(bands, fr.sx(2), fr.T + 12, "vertical walking", { "text-anchor": "middle" });
    text(bands, fr.sx(0.85), fr.T + 12, "lateral", { "text-anchor": "middle" });
    f.forEach((v, i) => {
      if (v > 6) return;
      el("line", { x1: fr.sx(v), x2: fr.sx(v), y1: fr.T + 20, y2: fr.T + fr.H, style: `stroke:${i + 1 === n ? BRAND : "currentColor"};stroke-width:${i + 1 === n ? 2.4 : 1.4}` }, bands);
      text(bands, fr.sx(v), fr.T + fr.H - 4 - i * 12, `f${"₁₂₃"[i]}`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    });
    f.forEach((v, i) => (o[`f${i + 1}`].textContent = `${num(v, 2)} Hz`));
    const inBand = f.findIndex((v) => v >= 1.6 && v <= 2.4);
    o.verdict.textContent = inBand >= 0 ? `f${"₁₂₃"[inBand]} is in the walking band: risk of resonance` : f[0] < 1.6 ? "below walking pace: check lateral and higher harmonics" : "clear of the vertical walking band";
    o.verdict.className = inBand >= 0 ? "tabular-nums text-del" : "tabular-nums";
  }
  const loop = (now) => { draw((now - t0) / 1000); raf = playing && visible ? requestAnimationFrame(loop) : 0; };
  const setPlay = (p) => {
    playing = p && !reduced();
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? "Pause" : "Animate";
    if (playing && !raf && visible) { t0 = performance.now(); raf = requestAnimationFrame(loop); }
    if (!playing) draw(0);
  };
  btn.addEventListener("click", () => setPlay(!playing));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(loop); }).observe(root);
  btn.querySelector("[data-label]").textContent = "Animate";
  draw(0);
}

// ============================================================ dam

for (const root of document.querySelectorAll("[data-civ-dam]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const GW = 9.81, GC = 24; // kN/m³

  function draw() {
    const hd = s.hd.get(), top = Math.min(s.top.get(), s.base.get()), base = s.base.get(), mu = s.mu.get();
    const hw = Math.min(s.hw.get(), hd);
    // Upstream face vertical at x = 0, crest from 0 to `top`, toe at x = base.
    const Arect = top * hd, Atri = ((base - top) * hd) / 2;
    const W = GC * (Arect + Atri);
    const xc = (Arect * (top / 2) + Atri * (top + (base - top) / 3)) / (Arect + Atri);
    const Fw = 0.5 * GW * hw * hw;
    const Mo = Fw * (hw / 3), Mr = W * (base - xc);
    const fo = Mo > 0 ? Mr / Mo : Infinity, fsl = Fw > 0 ? (mu * W) / Fw : Infinity;

    svg.replaceChildren();
    const sc = Math.min(330 / (base + hd * 0.6), 290 / hd), ox = 300 - (base * sc) / 2 + 40, oy = 310;
    const X = (x) => ox + x * sc, Y = (y) => oy - y * sc;
    el("line", { x1: 10, y1: oy, x2: 630, y2: oy, style: "stroke:currentColor;stroke-opacity:.5" }, svg);
    // Water on the upstream side.
    if (hw > 0) el("rect", { x: 10, y: Y(hw), width: X(0) - 10, height: hw * sc, style: "fill:var(--vec-u);fill-opacity:.16" }, svg);
    // Pressure triangle on the face: p = ρgh, drawn outward to the left.
    if (hw > 0) {
      const pmax = GW * hw, k = 120 / Math.max(pmax, 1);
      el("path", { d: `M${X(0)} ${Y(hw)} L${X(0)} ${Y(0)} L${X(0) - pmax * k} ${Y(0)} Z`, style: "fill:var(--vec-u);fill-opacity:.25;stroke:var(--vec-u)" }, svg);
      for (let i = 1; i <= 5; i++) { const y = (hw * i) / 6, p = GW * (hw - y); arrow(svg, X(0) - p * k, Y(y), X(0) - 2, Y(y), "var(--vec-u)", 1); }
      text(svg, X(0) - pmax * k, Y(0) + 14, `p = ${num(pmax, 0)} kPa`, { "text-anchor": "start" });
      arrow(svg, X(0) - 70, Y(hw / 3), X(0) + 30, Y(hw / 3), BRAND, 2.4);
      text(svg, X(0) - 70, Y(hw / 3) - 6, `F ${num(Fw, 0)} kN/m`, { "text-anchor": "start", style: `fill:${BRAND}` });
    }
    el("path", { d: `M${X(0)} ${Y(0)} L${X(0)} ${Y(hd)} L${X(top)} ${Y(hd)} L${X(base)} ${Y(0)} Z`, style: "fill:color-mix(in oklab,currentColor 14%,transparent);stroke:currentColor;stroke-opacity:.75" }, svg);
    arrow(svg, X(xc), Y(hd * 0.35), X(xc), Y(hd * 0.35) + 60, "var(--foreground)", 2.2);
    text(svg, X(xc) + 6, Y(hd * 0.35) + 14, `W ${num(W, 0)} kN/m`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    el("circle", { cx: X(base), cy: Y(0), r: 4, style: `fill:${BRAND}` }, svg);
    text(svg, X(base) + 6, Y(0) - 6, "toe", { "text-anchor": "start" });

    o.fw.textContent = `${num(Fw, 0)} kN/m`;
    o.wd.textContent = `${num(W, 0)} kN/m`;
    o.mo.textContent = `${num(Mo, 0)} kN·m/m`;
    o.mr.textContent = `${num(Mr, 0)} kN·m/m`;
    const fmt = (v) => (Number.isFinite(v) ? num(v, 2) : "∞");
    o.fo.textContent = fmt(fo);
    o.fs.textContent = fmt(fsl);
    o.fo.className = fo < 1.5 ? "tabular-nums text-del" : "tabular-nums";
    o.fs.className = fsl < 1.5 ? "tabular-nums text-del" : "tabular-nums";
  }
  draw();
}
