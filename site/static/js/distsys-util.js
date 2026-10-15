// Small helpers shared by the distributed systems modules. No side effects:
// the page loads this file too, and it does nothing on its own.

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value, e.target));

export const h = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

// A small outline button built in the page (same look as the server's).
export const smallButton = (label, onClick) => {
  const b = h("button", "inline-flex h-7 items-center justify-center gap-1 rounded-md border bg-background px-2 font-mono text-xs shadow-xs outline-none transition-colors duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50", label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
};

// Seeded PRNG so a run can be replayed.
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal from two uniforms (Box–Muller).
export const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// FNV-1a, 32 bits: a fast, well-spread string hash.
export function fnv1a(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  // A final avalanche (from murmur3) so similar names land far apart.
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return x >>> 0;
}

// Colours for servers and processes, all theme variables.
export const PALETTE = ["var(--vec-u)", "var(--vec-v)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)", "var(--ion-cl)", "var(--ion-ca)", "var(--vec-i)", "var(--vec-j)", "var(--brand)"];

export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export const pct = (x, d = 1) => `${(100 * x).toFixed(d)}%`;
export const ms = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${x < 10 ? x.toFixed(1) : Math.round(x)} ms`);

// Appends a line to an <ol data-log>, keeping the newest in view.
export function logLine(list, text, tone) {
  const li = h("li", tone === "bad" ? "text-del" : tone === "good" ? "text-add" : tone === "dim" ? "text-muted-foreground" : "", text);
  list.append(li);
  while (list.children.length > 60) list.firstChild.remove();
  list.scrollTop = list.scrollHeight;
}
