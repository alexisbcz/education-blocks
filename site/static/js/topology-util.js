// Shared helpers for the topology blocks: readouts, switches, seeded
// randomness, theme colours for canvases, and a small orbit camera for the
// drawings projected from 3D (drag or arrow keys to turn, an idle spin that
// stops offscreen and under reduced motion).

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
// The switch announces its new state before it updates aria-checked, so the
// state from the event is kept on the element for isOn to read.
export const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => {
    sw.dataset.on = String(e.detail.checked);
    fn(sw.dataset.toggle, e.detail.checked);
  }));
export const isOn = (root, name) => {
  const sw = root.querySelector(`[data-toggle="${name}"]`);
  return (sw?.dataset.on ?? sw?.getAttribute("aria-checked")) === "true";
};

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number for a readout, with a real minus sign. */
export const num = (v, d = 2) => {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return (Object.is(r, -0) ? 0 : r).toFixed(d).replace("-", "−");
};
export const signed = (n) => (n > 0 ? "+" + n : String(n).replace("-", "−"));

// CSS colours resolved to rgb for canvas drawing, by painting one pixel:
// the theme defines colours in oklch, which only the browser can convert.
const probe = document.createElement("span");
const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
export function rgbOf(css) {
  if (!probe.isConnected) { probe.hidden = true; document.body.append(probe); }
  probe.style.color = "";
  probe.style.color = css;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = getComputedStyle(probe).color;
  pixel.fillRect(0, 0, 1, 1);
  return [...pixel.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const palette = () => ({
  fg: rgbOf("var(--foreground)"), bg: rgbOf("var(--code-bg)"), muted: rgbOf("var(--muted-foreground)"),
  brand: rgbOf("var(--brand)"), u: rgbOf("var(--vec-u)"), v: rgbOf("var(--vec-v)"),
  add: rgbOf("var(--code-add)"), del: rgbOf("var(--code-del)"),
});
export const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

/** Sizes a canvas to its box at the device pixel ratio; returns the 2D
 *  context scaled so one unit is one CSS pixel, and the box size. */
export function fitCanvas(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), hgt = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

// ------------------------------------------------------------ 3D

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit3 = (a) => scale3(a, 1 / (norm3(a) || 1));

/**
 * orbit wires a canvas to a turntable camera. view(p) returns [x, y, depth]
 * in canvas pixels (depth grows towards the viewer). draw() is called when
 * the view changes; the idle spin runs only while the canvas is on screen.
 */
export function orbit(canvas, draw, { yaw = 0.6, pitch = 0.45, zoom = 0.36, spin = 0.12 } = {}) {
  const cam = { yaw, pitch, zoom, w: 1, h: 1 };
  let spinning = !reduced(), visible = false, last = 0, raf = 0, dragged = false;
  cam.view = (p) => {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    // World z is up. Turn about z by yaw, then tilt by pitch.
    const x1 = cy * p[0] - sy * p[1], y1 = sy * p[0] + cy * p[1];
    const y2 = cp * y1 - sp * p[2], z2 = sp * y1 + cp * p[2];
    const s = Math.min(cam.w, cam.h) * cam.zoom;
    return [cam.w / 2 + x1 * s, cam.h / 2 - z2 * s, -y2];
  };
  /** The direction towards the viewer, in world coordinates. */
  cam.eye = () => {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    // Inverse of the view rotation applied to (0, -1, 0).
    return [-sy * cp, -cy * cp, sp];
  };
  const frame = (t) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (spinning && visible) cam.yaw += spin * dt;
    redraw();
    if (spinning && visible) raf = requestAnimationFrame(frame);
  };
  const redraw = () => {
    const r = canvas.getBoundingClientRect();
    cam.w = r.width; cam.h = r.height;
    draw(cam);
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  cam.redraw = () => { if (!raf) redraw(); };
  cam.kick = kick;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
  new ResizeObserver(() => cam.redraw()).observe(canvas);
  onTheme(() => cam.redraw());
  let start = null;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
    dragged = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!start) return;
    if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 3) dragged = true;
    spinning = false;
    cam.yaw = start.yaw + (e.clientX - start.x) * 0.01;
    cam.pitch = Math.max(-1.4, Math.min(1.4, start.pitch + (e.clientY - start.y) * 0.01));
    cam.redraw();
  });
  const end = () => { start = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (!d) return;
    e.preventDefault();
    spinning = false;
    cam.yaw += d[0];
    cam.pitch = Math.max(-1.4, Math.min(1.4, cam.pitch + d[1]));
    cam.redraw();
  });
  cam.wasDrag = () => dragged;
  return cam;
}
