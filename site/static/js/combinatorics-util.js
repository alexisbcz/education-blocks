// Shared helpers for the combinatorics blocks: exact BigInt counting,
// number formatting and the prev / next / play stepper. No side effects:
// the page loads this file too, and it does nothing on its own.

export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const VEC = ["var(--vec-u)", "var(--vec-v)", "var(--vec-i)", "var(--vec-j)", "var(--vec-out)", "var(--brand)"];

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (k) => String(k).split("").map((d) => SUP[+d] ?? d).join("");

// fmtBig groups digits with thin spaces; very long numbers become
// "d.dddddd × 10ⁿ (k digits)" so a readout never overflows.
export function fmtBig(v, max = 30) {
  const s = String(v);
  const neg = s.startsWith("-");
  const d = neg ? s.slice(1) : s;
  if (d.length <= max) return (neg ? "−" : "") + d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "−" : ""}${d[0]}.${d.slice(1, 7)} × 10${sup(d.length - 1)} (${d.length} digits)`;
}

const factCache = [1n];
export function fact(n) {
  for (let i = factCache.length; i <= n; i++) factCache[i] = factCache[i - 1] * BigInt(i);
  return factCache[n];
}
export function binom(n, k) {
  if (k < 0 || n < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}
// ratio of two BigInts as a float, safe for huge values.
export function ratio(a, b, digits = 12) {
  if (b === 0n) return NaN;
  const s = 10n ** BigInt(digits);
  return Number((a * s) / b) / Number(s);
}

export const node = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

export function onToggle(root, fn) {
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
}

export function onAction(root, fn) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b && root.contains(b)) fn(b.dataset.action, b);
  });
}

function playButton(btn) {
  const label = btn.querySelector("[data-label]");
  const first = label.textContent;
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    label.textContent = playing ? "Pause" : first;
  };
}

// player wires the prev / next / play buttons of a block to step(±1).
// Play steps on a timer, only while the block is on screen.
export function player(root, step, ms = 750) {
  let timer = 0, playing = false, visible = false;
  const btn = root.querySelector('[data-action="play"]');
  const paint = btn ? playButton(btn) : () => {};
  const sync = () => {
    clearInterval(timer);
    timer = playing && visible ? setInterval(() => step(1), reduced() ? ms * 2 : ms) : 0;
  };
  const setPlaying = (p) => { playing = p; paint(p); sync(); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(root);
  root.querySelector('[data-action="prev"]')?.addEventListener("click", () => { setPlaying(false); step(-1); });
  root.querySelector('[data-action="next"]')?.addEventListener("click", () => { setPlaying(false); step(1); });
  btn?.addEventListener("click", () => setPlaying(!playing));
  return { stop: () => setPlaying(false) };
}

// stepper is player over an index in [0, size()).
export function stepper(root, size, show, ms = 750) {
  let i = 0;
  const go = (j) => { const n = size(); if (!n) return; i = ((j % n) + n) % n; show(i); };
  const p = player(root, (d) => go(i + d), ms);
  return { go, get i() { return i; }, stop: p.stop };
}

// selectSeg marks one segmented-control option as chosen without firing.
export function selectSeg(root, value) {
  root.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));
}

// Partitions of n as non-increasing arrays, largest first.
export function partitions(n, maxPart = n, out = [], acc = []) {
  if (n === 0) { out.push(acc.slice()); return out; }
  for (let p = Math.min(n, maxPart); p >= 1; p--) {
    acc.push(p);
    partitions(n - p, p, out, acc);
    acc.pop();
  }
  return out;
}

export const conjugate = (lam) => {
  const c = [];
  for (let j = 0; j < (lam[0] ?? 0); j++) c.push(lam.filter((x) => x > j).length);
  return c;
};
