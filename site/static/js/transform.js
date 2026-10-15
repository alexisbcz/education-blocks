// Transformation playground: the plane under a 2×2 matrix. Everything is
// redrawn from the matrix on each change (a few dozen elements). Presets
// glide from the current matrix with Emil's ease-in-out: this motion
// explains (the plane deforming), so it may take 700ms.

import { el, line, arrow, polygon, handle, fmt, easeInOut, reducedMotion } from "./svg.js";
import { scrubbable } from "./scrub.js";

const R = 5; // half the visible extent, in world units

for (const root of document.querySelectorAll("[data-transform]")) {
  const svg = root.querySelector("[data-plane]");
  const out = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  let M = { a: 1, b: 0, c: 0, d: 1 };
  let v = [1.5, 1];
  let show = { eigen: true, ghost: true };
  let anim = 0;

  // Static defs: a clip to the view, so stretched lines stop at the edge.
  const clipId = `clip-${Math.random().toString(36).slice(2)}`;
  el("rect", { x: -R, y: -R, width: 2 * R, height: 2 * R }, el("clipPath", { id: clipId }, el("defs", {}, svg)));
  const scene = el("g", { "clip-path": `url(#${clipId})` }, svg);
  const top = el("g", {}, svg);
  const vHandle = handle(svg, top, "Vector v", (p, e) => {
    v = p.map((x) => Math.round(Math.max(-R + 0.3, Math.min(R - 0.3, x)) * 4) / 4);
    draw();
  });
  vHandle.node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
    if (!d) return;
    e.preventDefault();
    v = [v[0] + d[0], v[1] + d[1]];
    draw();
  });

  const apply = (m, [x, y]) => [m.a * x + m.b * y, m.c * x + m.d * y];

  function eigen(m) {
    const tr = m.a + m.d;
    const det = m.a * m.d - m.b * m.c;
    const disc = tr * tr - 4 * det;
    if (disc < -1e-9) return { complex: [tr / 2, Math.sqrt(-disc) / 2] };
    const s = Math.sqrt(Math.max(0, disc));
    const ls = [(tr + s) / 2, (tr - s) / 2];
    const vec = (l) => {
      if (Math.abs(m.b) > 1e-9) return [m.b, l - m.a];
      if (Math.abs(m.c) > 1e-9) return [l - m.d, m.c];
      return null; // diagonal: the axes
    };
    let vs = ls.map(vec);
    if (!vs[0]) vs = Math.abs(m.a - m.d) < 1e-9 ? [] : [[1, 0], [0, 1]];
    return { real: ls, vectors: vs };
  }

  function draw(m = M) {
    scene.replaceChildren();
    const muted = "stroke:currentColor;stroke-opacity:0.08;stroke-width:1px";
    if (show.ghost) {
      for (let k = -R; k <= R; k++) {
        line(scene, [k, -R], [k, R], muted);
        line(scene, [-R, k], [R, k], muted);
      }
    }
    // The transformed grid: images of the lines x = k and y = k.
    const L = 30;
    for (let k = -12; k <= 12; k++) {
      const s = k === 0 ? "stroke:currentColor;stroke-opacity:0.45;stroke-width:1.25px" : "stroke:var(--vec-u);stroke-opacity:0.22;stroke-width:1px";
      line(scene, apply(m, [k, -L]), apply(m, [k, L]), s);
      line(scene, apply(m, [-L, k]), apply(m, [L, k]), s);
    }
    // The unit square's image: its area is |det A|.
    const i = apply(m, [1, 0]);
    const j = apply(m, [0, 1]);
    polygon(scene, [[0, 0], i, [i[0] + j[0], i[1] + j[1]], j], "fill:var(--vec-out);fill-opacity:0.16;stroke:var(--vec-out);stroke-opacity:0.7;stroke-width:1px");

    const e = eigen(m);
    if (show.eigen && e.vectors) {
      for (const ev of e.vectors) {
        const n = Math.hypot(...ev) || 1;
        const u = [(ev[0] / n) * L, (ev[1] / n) * L];
        line(scene, [-u[0], -u[1]], u, "stroke:currentColor;stroke-opacity:0.55;stroke-width:1.25px;stroke-dasharray:5 5");
      }
    }

    arrow(scene, [0, 0], v, "var(--vec-u)", 1.5);
    arrow(scene, [0, 0], apply(m, v), "var(--vec-out)");
    arrow(scene, [0, 0], i, "var(--vec-i)");
    arrow(scene, [0, 0], j, "var(--vec-j)");
    vHandle.place(v, "var(--vec-u)");

    const det = m.a * m.d - m.b * m.c;
    out.i.textContent = `(${fmt(i[0])}, ${fmt(i[1])})`;
    out.j.textContent = `(${fmt(j[0])}, ${fmt(j[1])})`;
    out.area.textContent = fmt(Math.abs(det));
    out.det.textContent = fmt(det) + (Math.abs(det) < 1e-9 ? "  · collapses the plane" : det < 0 ? "  · flips orientation" : "");
    const av = apply(m, v);
    out.av.textContent = `(${fmt(av[0])}, ${fmt(av[1])})`;
    out.eig.textContent = e.complex
      ? `${fmt(e.complex[0])} ± ${fmt(e.complex[1])}i  · no real direction`
      : e.vectors.length === 0
        ? `${fmt(e.real[0])} (every vector)`
        : e.real.map((l) => fmt(l)).join(", ");
  }

  const inputs = {};
  for (const input of root.querySelectorAll("[data-scrub]")) {
    const k = input.dataset.scrub;
    inputs[k] = scrubbable(input, {
      min: -3, max: 3, step: 0.1,
      onChange: (x) => {
        cancelAnimationFrame(anim);
        M = { ...M, [k]: x };
        draw();
      },
    });
  }

  for (const b of root.querySelectorAll("[data-preset]")) {
    b.addEventListener("click", () => {
      const [a, bb, c, d] = b.dataset.preset.split(" ").map(Number);
      glide({ a, b: bb, c, d });
    });
  }

  function glide(to) {
    cancelAnimationFrame(anim);
    const from = { ...M };
    M = to;
    for (const k of "abcd") inputs[k].set(to[k], false);
    if (reducedMotion()) return draw();
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 700);
      const s = easeInOut(t);
      const m = {};
      for (const k of "abcd") m[k] = from[k] + (to[k] - from[k]) * s;
      draw(m);
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  for (const sw of root.querySelectorAll("[data-toggle]")) {
    sw.addEventListener("shadcn:checked-change", (e) => {
      show = { ...show, [sw.dataset.toggle]: e.detail.checked };
      draw();
    });
  }

  draw();
}
