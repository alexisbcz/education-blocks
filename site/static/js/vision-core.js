// Shared pieces of the computer vision blocks: seeded randomness, theme
// colours as numbers, grey images as Float32Arrays, separable Gaussian
// blur, Sobel gradients, and canvas/overlay painting.

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const minus = (s) => String(s).replace(/-/g, "−");
export const NS = "http://www.w3.org/2000/svg";

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// A segmented control by name: current value and a change callback.
export function seg(root, name, onChange) {
  const box = root.querySelector(`[data-cv-seg="${name}"]`);
  let v = box.querySelector("[aria-selected=true]")?.dataset.seg;
  box.addEventListener("seg-change", (e) => { v = e.detail.value; onChange(v); });
  return () => v;
}

export const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));

// Colours: CSS custom properties resolved to [r, g, b] by painting a
// pixel, since ImageData needs numbers.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
export function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
export const palette = () => ({
  fg: rgbOf("var(--foreground)"), bg: rgbOf("var(--code-bg)"), brand: rgbOf("var(--brand)"),
  u: rgbOf("var(--vec-u)"), v: rgbOf("var(--vec-v)"), out: rgbOf("var(--vec-out)"),
  i: rgbOf("var(--vec-i)"), j: rgbOf("var(--vec-j)"), add: rgbOf("var(--code-add)"),
  del: rgbOf("var(--code-del)"), muted: rgbOf("var(--muted-foreground)"),
});
// Theme or accent changes land as attributes on <html>.
export const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true });

/** Paints a grey image (0–255 floats) into a canvas at its own size. */
export function paintGray(canvas, data, W, H) {
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const img = new ImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const v = data[i] < 0 ? 0 : data[i] > 255 ? 255 : data[i];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  canvas.getContext("2d").putImageData(img, 0, 0);
}

/** Paints with a per-pixel colour function returning [r, g, b]. */
export function paintRGB(canvas, W, H, fn) {
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const img = new ImageData(W, H);
  const d = img.data;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const c = fn(x, y, i);
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  canvas.getContext("2d").putImageData(img, 0, 0);
}

export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** An SVG element in the overlay namespace. */
export function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

/** Sets an overlay's coordinates to the image's pixels and clears it. */
export function overlay(svg, W, H) {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.replaceChildren();
  return svg;
}

/** Separable Gaussian blur with clamped edges. */
export function blur(src, W, H, sigma) {
  if (sigma < 0.3) return Float32Array.from(src);
  const r = Math.ceil(sigma * 3);
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += k[i + r] * src[y * W + Math.min(W - 1, Math.max(0, x + i))];
    tmp[y * W + x] = a;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += k[i + r] * tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x];
    out[y * W + x] = a;
  }
  return out;
}

/** Sobel gradients (clamped edges), scaled by 1/8 so they read in grey levels per pixel. */
export function sobel(src, W, H) {
  const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  const at = (x, y) => src[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
    const d = at(x - 1, y), f = at(x + 1, y);
    const g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
    gx[y * W + x] = (c + 2 * f + i - a - 2 * d - g) / 8;
    gy[y * W + x] = (g + 2 * hh + i - a - 2 * b - c) / 8;
  }
  return { gx, gy };
}

/** Pointer position in image pixels over an element drawn at W × H. */
export function pixelAt(e, elem, W, H) {
  const r = elem.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}

/** Runs fn on each animation frame while root is on screen and running() is true. */
export function loop(root, running, fn) {
  let visible = false, raf = 0, last = 0;
  const tick = (t) => {
    raf = 0;
    if (!visible || !running()) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    fn(dt);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && visible && running()) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return kick;
}

/** A play button (data-action=play) whose icon and label follow the state. */
export function playButton(btn, labels) {
  const label = btn.querySelector("[data-label]");
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    label.textContent = playing ? labels[1] : labels[0];
  };
}
