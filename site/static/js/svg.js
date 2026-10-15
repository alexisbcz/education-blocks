// Small SVG helpers shared by the plane-based blocks. World coordinates
// have y up; the SVG's viewBox has y down, so every point goes through P.

const NS = "http://www.w3.org/2000/svg";

export const P = ([x, y]) => [x, -y];

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

export function line(parent, a, b, style, extra = {}) {
  const [x1, y1] = P(a);
  const [x2, y2] = P(b);
  return el("line", { x1, y1, x2, y2, style, "vector-effect": "non-scaling-stroke", ...extra }, parent);
}

/** An arrow from a to b in world units, head drawn in world units too. */
export function arrow(parent, a, b, color, width = 2.25, head = 0.26) {
  const g = el("g", {}, parent);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    el("circle", { cx: P(b)[0], cy: P(b)[1], r: 0.07, style: `fill:${color}` }, g);
    return g;
  }
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.45);
  const base = [b[0] - ux * h, b[1] - uy * h];
  line(g, a, base, `stroke:${color};stroke-width:${width}px;stroke-linecap:round`);
  const left = [base[0] - uy * h * 0.5, base[1] + ux * h * 0.5];
  const right = [base[0] + uy * h * 0.5, base[1] - ux * h * 0.5];
  el("path", { d: `M${P(b)} L${P(left)} L${P(right)} Z`, style: `fill:${color};stroke:${color};stroke-width:1px;stroke-linejoin:round`, "vector-effect": "non-scaling-stroke" }, g);
  return g;
}

export function polygon(parent, pts, style) {
  return el("path", { d: "M" + pts.map((p) => P(p).join(",")).join(" L") + " Z", style, "vector-effect": "non-scaling-stroke" }, parent);
}

/** Formats a number for a readout: two decimals at most, a real minus sign. */
export function fmt(n, digits = 2) {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  const s = String(Object.is(r, -0) ? 0 : r);
  return s.replace("-", "−");
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Emil's ease-in-out (0.77, 0, 0.175, 1), sampled for JS-driven motion. */
export function easeInOut(t) {
  // Solve the cubic bezier for x = t by Newton's method, then return y.
  const [x1, y1, x2, y2] = [0.77, 0, 0.175, 1];
  const bez = (a, b, s) => 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s * s + s ** 3;
  let s = t;
  for (let i = 0; i < 6; i++) {
    const x = bez(x1, x2, s) - t;
    const d = 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * (1 - s) * s + 3 * (1 - x2) * s * s;
    if (Math.abs(d) < 1e-6) break;
    s -= x / d;
  }
  return bez(y1, y2, Math.min(1, Math.max(0, s)));
}

/** A draggable, focusable handle. onMove gets world coordinates. */
export function handle(svg, parent, label, onMove) {
  const c = el("circle", { r: 0.22, tabindex: 0, role: "slider", "aria-label": label, class: "cursor-grab outline-none", style: "fill:transparent" }, parent);
  const ring = el("circle", { r: 0.11, style: "fill:var(--background);stroke:currentColor;stroke-width:1.5px", "vector-effect": "non-scaling-stroke", class: "pointer-events-none" }, parent);
  const toWorld = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, -p.y];
  };
  c.addEventListener("pointerdown", (e) => {
    c.setPointerCapture(e.pointerId);
    c.classList.replace("cursor-grab", "cursor-grabbing");
    onMove(toWorld(e), e);
  });
  c.addEventListener("pointermove", (e) => {
    if (c.hasPointerCapture(e.pointerId)) onMove(toWorld(e), e);
  });
  c.addEventListener("pointerup", () => c.classList.replace("cursor-grabbing", "cursor-grab"));
  c.addEventListener("focus", () => ring.style.strokeWidth = "3px");
  c.addEventListener("blur", () => ring.style.strokeWidth = "1.5px");
  return {
    node: c,
    place([x, y], color) {
      for (const n of [c, ring]) {
        n.setAttribute("cx", x);
        n.setAttribute("cy", -y);
      }
      ring.style.stroke = color;
    },
  };
}
