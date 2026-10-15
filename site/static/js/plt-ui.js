// Shared DOM helpers for the programming-languages blocks. Pure exports:
// importing this module does nothing on its own.

const SVGNS = "http://www.w3.org/2000/svg";

/** Builds an element. props: class, text, attrs {}, style; kids: nodes or strings. */
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  if (props.class) e.className = props.class;
  if (props.text !== undefined) e.textContent = props.text;
  if (props.style) e.setAttribute("style", props.style);
  for (const [k, v] of Object.entries(props.attrs ?? {})) if (v !== undefined && v !== false) e.setAttribute(k, v === true ? "" : v);
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

export function s(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

export function stext(parent, x, y, str, attrs = {}) {
  const t = s("text", { x, y, class: "font-mono text-[11px]", "text-anchor": "middle", ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** An arrowhead marker; returns its url(#id). */
export function arrowMarker(svg, color = "currentColor", opacity = 0.6) {
  const id = "plt-m-" + Math.random().toString(36).slice(2, 8);
  const defs = svg.querySelector("defs") ?? s("defs", {}, svg);
  const m = s("marker", { id, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, defs);
  s("path", { d: "M0,0 L10,5 L0,10 z", style: `fill:${color};fill-opacity:${opacity}` }, m);
  return `url(#${id})`;
}

/** Sets the block's status line; kind is "bad", "good" or empty. */
export function msg(root, text, kind = "") {
  const el = root.querySelector('[data-out="msg"]');
  if (!el) return;
  el.textContent = text;
  el.toggleAttribute("data-bad", kind === "bad");
  el.toggleAttribute("data-good", kind === "good");
}

export function out(root, key, text) {
  const el = root.querySelector(`[data-out="${key}"]`);
  if (el) el.textContent = text;
}

/** Calls fn on input, debounced. */
export function onInput(el, fn, delay = 160) {
  let t = 0;
  el.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(fn, delay);
  });
}

/**
 * Wires the Reset / Back / Step / Run buttons and ←/→ on the focused root.
 * Stepping is instant on purpose: it happens many times in a row.
 */
export function stepper(root, { reset, back, step, run }) {
  const act = (a) => ({ reset, back, step, run })[a]?.();
  root.querySelectorAll("[data-act]").forEach((b) => {
    if (["reset", "back", "step", "run"].includes(b.dataset.act)) b.addEventListener("click", () => act(b.dataset.act));
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, button")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step?.(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); back?.(); }
  });
}

/** Small preset chips; onPick receives the preset's value. */
export function presets(container, list, onPick) {
  if (!container) return;
  container.replaceChildren(
    ...list.map(([label, value]) => {
      const b = h("button", {
        class: "rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        text: label,
        attrs: { type: "button" },
      });
      b.addEventListener("click", () => onPick(value));
      return b;
    }),
  );
}

/** Sets an input's value and fires its input handlers. */
export function setInput(el, value) {
  el.value = value;
  el.dispatchEvent(new Event("input"));
}

/**
 * Lays out a directed graph left to right by BFS depth from start.
 * Returns positions {x, y} per node index plus the drawing size.
 */
export function layered(n, start, edges, { dx = 110, dy = 78, pad = 48 } = {}) {
  const depth = new Array(n).fill(-1);
  depth[start] = 0;
  const q = [start];
  const adj = Array.from({ length: n }, () => []);
  for (const e of edges) adj[e.from].push(e.to);
  while (q.length) {
    const u = q.shift();
    for (const v of adj[u]) if (depth[v] < 0) { depth[v] = depth[u] + 1; q.push(v); }
  }
  let maxD = Math.max(0, ...depth);
  for (let i = 0; i < n; i++) if (depth[i] < 0) depth[i] = ++maxD;
  const cols = [];
  for (let i = 0; i < n; i++) (cols[depth[i]] ??= []).push(i);
  const rows = Math.max(...cols.map((c) => c?.length ?? 0));
  const pos = [];
  cols.forEach((c, d) => c?.forEach((i, k) => {
    pos[i] = { x: pad + d * dx, y: pad + (k + (rows - c.length) / 2) * dy };
  }));
  return { pos, width: pad * 2 + (cols.length - 1) * dx, height: pad * 2 + (rows - 1) * dy };
}

/** Draws a state graph (automaton) into svg. nodes: [{label, accept}], edges: [{from, to, label}]. */
export function drawAutomaton(svg, nodes, edges, start, active = new Set(), activeEdges = new Set()) {
  svg.replaceChildren();
  const { pos, width, height } = layered(nodes.length, start, edges);
  svg.setAttribute("viewBox", `0 0 ${Math.max(width, 200)} ${Math.max(height, 120)}`);
  svg.setAttribute("width", Math.max(width, 200));
  const mDim = arrowMarker(svg, "currentColor", 0.55);
  const mHot = arrowMarker(svg, "var(--brand)", 1);
  const R = 17;
  // Group parallel edges so labels merge and opposite pairs bend apart.
  const key = (e) => e.from + ">" + e.to;
  const has = new Set(edges.map(key));
  edges.forEach((e, k) => {
    const a = pos[e.from], b = pos[e.to];
    const hot = activeEdges.has(k);
    const style = `fill:none;stroke:${hot ? "var(--brand)" : "currentColor"};stroke-opacity:${hot ? 1 : 0.45};stroke-width:${hot ? 2 : 1.2}`;
    let lx, ly;
    if (e.from === e.to) {
      const d = `M${a.x - 8},${a.y - R + 2} C${a.x - 26},${a.y - R - 34} ${a.x + 26},${a.y - R - 34} ${a.x + 8},${a.y - R + 2}`;
      s("path", { d, style, "marker-end": hot ? mHot : mDim }, svg);
      lx = a.x; ly = a.y - R - 30;
    } else {
      const dxv = b.x - a.x, dyv = b.y - a.y, len = Math.hypot(dxv, dyv) || 1;
      const ux = dxv / len, uy = dyv / len;
      // The perpendicular flips with direction, so one sign separates a
      // pair of opposite edges; long back edges arc wide to clear the row.
      const pair = has.has(e.to + ">" + e.from);
      const bend = pair && b.x > a.x ? -24 : b.x <= a.x ? -(26 + len * 0.22) : pair ? -24 : 0;
      const sx = a.x + ux * R, sy = a.y + uy * R, ex = b.x - ux * R, ey = b.y - uy * R;
      const mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
      s("path", { d: `M${sx},${sy} Q${mx},${my} ${ex},${ey}`, style, "marker-end": hot ? mHot : mDim }, svg);
      lx = (sx + 2 * mx + ex) / 4; ly = (sy + 2 * my + ey) / 4 - 4;
    }
    const t = stext(svg, lx, ly, e.label, { class: "font-mono text-[11px]", style: `fill:${hot ? "var(--brand)" : "var(--muted-foreground)"};paint-order:stroke;stroke:var(--code-bg);stroke-width:4px` });
    t.setAttribute("dominant-baseline", "middle");
  });
  // Start arrow.
  const s0 = pos[start];
  s("path", { d: `M${s0.x - R - 26},${s0.y} L${s0.x - R - 2},${s0.y}`, style: "stroke:currentColor;stroke-opacity:.6;stroke-width:1.2", "marker-end": mDim }, svg);
  nodes.forEach((n, i) => {
    const p = pos[i], on = active.has(i);
    s("circle", { cx: p.x, cy: p.y, r: R, style: `fill:${on ? "color-mix(in oklab, var(--brand) 18%, var(--code-bg))" : "var(--code-bg)"};stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.7};stroke-width:${on ? 2 : 1.2}` }, svg);
    if (n.accept) s("circle", { cx: p.x, cy: p.y, r: R - 4, style: `fill:none;stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.7};stroke-width:1.1` }, svg);
    const t = stext(svg, p.x, p.y, n.label, { style: `fill:${on ? "var(--brand)" : "var(--foreground)"}` });
    t.setAttribute("dominant-baseline", "central");
  });
}

/** Compresses a sorted list of characters into "a-c, x" form. */
export function charRanges(chars) {
  const cs = [...new Set(chars)].sort();
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    let j = i;
    while (j + 1 < cs.length && cs[j + 1].charCodeAt(0) === cs[j].charCodeAt(0) + 1) j++;
    out.push(j - i >= 2 ? `${show(cs[i])}-${show(cs[j])}` : cs.slice(i, j + 1).map(show).join(","));
    i = j;
  }
  return out.join(",");
}

export const show = (c) => (c === " " ? "␣" : c === "\n" ? "↵" : c);
