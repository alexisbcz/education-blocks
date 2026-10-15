// Helpers shared by discrete.js and algorithms.js.

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seeded generator. */
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** A play/pause button: returns a setter for its state. SVG icons need
 *  the hidden attribute toggled, not the .hidden property. */
export function playButton(btn, labels) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

/** Client coordinates to SVG user units. */
export function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, p.y];
}

export const NS = "http://www.w3.org/2000/svg";
export function node(tag, attrs = {}, parent, textContent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (textContent !== undefined) e.textContent = textContent;
  parent?.append(e);
  return e;
}

export const action = (root, name, fn) => root.querySelector(`[data-action="${name}"]`)?.addEventListener("click", fn);
export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));

export const PALETTE = ["var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)", "var(--ion-ca)", "var(--vec-j)"];

/** Runs fn every `ms` while playing and on screen; returns controls. */
export function ticker(root, fn, ms) {
  let timer = 0, playing = false, visible = true;
  const tick = () => {
    timer = 0;
    if (!playing || !visible) return;
    if (fn() === false) return stop();
    timer = setTimeout(tick, typeof ms === "function" ? ms() : ms);
  };
  const stop = () => { playing = false; clearTimeout(timer); timer = 0; onChange?.(false); };
  let onChange;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !timer) tick(); }).observe(root);
  return {
    start() { playing = true; onChange?.(true); if (!timer) tick(); },
    stop,
    get playing() { return playing; },
    set onChange(f) { onChange = f; },
  };
}
