// Minimal SVG plotting for the science blocks: linear or log axes in a
// pixel viewBox, ticks, labels, polylines. Redraws are cheap: callers clear
// the layer and draw again.

const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

export function text(parent, x, y, s, attrs = {}) {
  const t = el("text", { x, y, class: "fill-muted-foreground font-mono text-[10px]", ...attrs }, parent);
  t.textContent = s;
  return t;
}

/**
 * frame draws axes and returns scales.
 * opts: { box: [left, top, width, height], x: [x0, x1], y: [y0, y1],
 *         xticks, yticks, xfmt, yfmt, xlabel, ylabel, logx }
 */
export function frame(svg, opts) {
  const [L, T, W, H] = opts.box;
  const [x0, x1] = opts.x;
  const [y0, y1] = opts.y;
  const sx = (v) => L + ((v - x0) / (x1 - x0)) * W;
  const sy = (v) => T + H - ((v - y0) / (y1 - y0)) * H;
  const g = el("g", {}, svg);
  const grid = "stroke:currentColor;stroke-opacity:0.07";
  for (const t of opts.yticks ?? []) {
    el("line", { x1: L, x2: L + W, y1: sy(t), y2: sy(t), style: grid }, g);
    text(g, L - 6, sy(t) + 3, (opts.yfmt ?? String)(t), { "text-anchor": "end" });
  }
  for (const t of opts.xticks ?? []) {
    el("line", { x1: sx(t), x2: sx(t), y1: T, y2: T + H, style: grid }, g);
    text(g, sx(t), T + H + 13, (opts.xfmt ?? String)(t), { "text-anchor": "middle" });
  }
  el("line", { x1: L, x2: L + W, y1: T + H, y2: T + H, style: "stroke:currentColor;stroke-opacity:0.3" }, g);
  if (opts.xlabel) text(g, L + W, T + H + 26, opts.xlabel, { "text-anchor": "end" });
  if (opts.ylabel) text(g, 4, T - 6, opts.ylabel, { "text-anchor": "start" });
  return { sx, sy, g, L, T, W, H };
}

export function polyline(parent, pts, style) {
  return el("polyline", { points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), style: "fill:none;" + style }, parent);
}

export function hline(parent, f, y, style, label) {
  el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(y), y2: f.sy(y), style }, parent);
  if (label) text(parent, f.L + f.W - 2, f.sy(y) - 4, label, { "text-anchor": "end" });
}

/** A minus sign that lines up with digits. */
export const num = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace("-", "−");
