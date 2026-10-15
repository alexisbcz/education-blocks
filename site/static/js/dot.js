// Dot product: two draggable vectors, the projection of v on u, and both
// formulas computed from the same numbers.

import { el, line, arrow, polygon, handle, fmt, P } from "./svg.js";

const R = 4;

for (const root of document.querySelectorAll("[data-dot]")) {
  const svg = root.querySelector("[data-plane]");
  const out = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  let u = [3, 1];
  let v = [1, 2];

  const scene = el("g", {}, svg);
  const top = el("g", {}, svg);

  // Snap to the half grid, magnetically: within 0.12 of a half-integer.
  const snap = (p) => p.map((x) => {
    x = Math.max(-R + 0.3, Math.min(R - 0.3, x));
    const g = Math.round(x * 2) / 2;
    return Math.abs(g - x) < 0.12 ? g : Math.round(x * 10) / 10;
  });
  const keyMove = (get, set) => (e) => {
    const d = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, 0.5], ArrowDown: [0, -0.5] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = get();
    set(snap([p[0] + d[0], p[1] + d[1]]));
    draw();
  };
  const hu = handle(svg, top, "Vector u", (p) => { u = snap(p); draw(); });
  const hv = handle(svg, top, "Vector v", (p) => { v = snap(p); draw(); });
  hu.node.addEventListener("keydown", keyMove(() => u, (p) => (u = p)));
  hv.node.addEventListener("keydown", keyMove(() => v, (p) => (v = p)));

  function draw() {
    scene.replaceChildren();
    for (let k = -R; k <= R; k++) {
      const s = k === 0 ? "stroke:currentColor;stroke-opacity:0.35;stroke-width:1px" : "stroke:currentColor;stroke-opacity:0.07;stroke-width:1px";
      line(scene, [k, -R], [k, R], s);
      line(scene, [-R, k], [R, k], s);
    }
    const dot = u[0] * v[0] + u[1] * v[1];
    const nu = Math.hypot(...u);
    const nv = Math.hypot(...v);
    if (nu > 1e-9) {
      // The line through u, and the foot of v on it.
      const k = dot / (nu * nu);
      const p = [u[0] * k, u[1] * k];
      line(scene, [(-u[0] / nu) * 10, (-u[1] / nu) * 10], [(u[0] / nu) * 10, (u[1] / nu) * 10], "stroke:var(--vec-u);stroke-opacity:0.2;stroke-width:1px");
      line(scene, v, p, "stroke:currentColor;stroke-opacity:0.5;stroke-width:1px;stroke-dasharray:3 3");
      line(scene, [0, 0], p, `stroke:var(--vec-v);stroke-opacity:0.45;stroke-width:6px;stroke-linecap:round`);
      // Right-angle mark at the foot.
      if (Math.hypot(v[0] - p[0], v[1] - p[1]) > 0.3 && Math.hypot(...p) > 0.3) {
        const s = 0.18;
        const a = [(u[0] / nu) * s * -Math.sign(k || 1), (u[1] / nu) * s * -Math.sign(k || 1)];
        const nv2 = Math.hypot(v[0] - p[0], v[1] - p[1]);
        const b = [((v[0] - p[0]) / nv2) * s, ((v[1] - p[1]) / nv2) * s];
        const pts = [[p[0] + a[0], p[1] + a[1]], [p[0] + a[0] + b[0], p[1] + a[1] + b[1]], [p[0] + b[0], p[1] + b[1]]];
        el("path", { d: "M" + pts.map((q) => P(q).join(",")).join(" L"), style: "fill:none;stroke:currentColor;stroke-opacity:0.5;stroke-width:1px", "vector-effect": "non-scaling-stroke" }, scene);
      }
    }
    // The angle between them.
    if (nu > 1e-9 && nv > 1e-9) {
      const a0 = Math.atan2(u[1], u[0]);
      let a1 = Math.atan2(v[1], v[0]);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const r = 0.55;
      const pts = [[0, 0]];
      for (let s = 0; s <= 24; s++) {
        const t = a0 + (d * s) / 24;
        pts.push([Math.cos(t) * r, Math.sin(t) * r]);
      }
      polygon(scene, pts, "fill:currentColor;fill-opacity:0.06;stroke:none");
    }
    arrow(scene, [0, 0], u, "var(--vec-u)");
    arrow(scene, [0, 0], v, "var(--vec-v)");
    hu.place(u, "var(--vec-u)");
    hv.place(v, "var(--vec-v)");

    const cos = nu && nv ? dot / (nu * nv) : 0;
    const theta = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    out.u.textContent = `(${fmt(u[0])}, ${fmt(u[1])})`;
    out.v.textContent = `(${fmt(v[0])}, ${fmt(v[1])})`;
    out.alg.textContent = `${fmt(u[0])}·${fmt(v[0])} + ${fmt(u[1])}·${fmt(v[1])} = ${fmt(dot)}`;
    out.geo.textContent = `${fmt(nu)} × ${fmt(nv)} × cos ${fmt(theta, 0)}° = ${fmt(nu * nv * cos)}`;
    out.dot.textContent = fmt(dot);
    const zero = Math.abs(dot) < 1e-9;
    out.dot.className = out.dot.className.replace(/ ?text-(add|del|foreground)\b/g, "") + (zero ? " text-foreground" : dot > 0 ? " text-add" : " text-del");
    out.sign.textContent = zero ? "perpendicular" : dot > 0 ? "less than 90° apart" : "more than 90° apart";
  }

  draw();
}
