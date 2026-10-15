// Shared helpers for the GIS blocks (gis.js, gis-maps.js): seeded random
// numbers and noise, controls, pointer coordinates, colours resolved for
// canvas drawing, the shoelace formula, point in polygon and a
// Bowyer–Watson Delaunay triangulation. Imports nothing from the page.

export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

// mulberry32: a small seeded generator, so first renders are the same for everyone.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// Value noise on a lattice, summed over octaves: smooth synthetic terrain.
export function fbm(seed, octaves = 5) {
  const rand = rng(seed);
  const P = 256, table = Float64Array.from({ length: P * P }, rand);
  const at = (i, j) => table[(((i % P) + P) % P) * P + (((j % P) + P) % P)];
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), u = fade(x - i), v = fade(y - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      s += amp * noise(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / norm;
  };
}

// A named segmented control (gisSegs in gis.go).
export function seg(root, name, onChange) {
  const box = root.querySelector(`[data-gis-seg="${name}"]`);
  let v = box.querySelector("[aria-selected=true]")?.dataset.seg;
  box.addEventListener("seg-change", (e) => {
    e.stopPropagation();
    v = e.detail.value;
    onChange(v);
  });
  return {
    get: () => v,
    set(value) {
      v = value;
      for (const b of box.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b.dataset.seg === value));
    },
  };
}

// Switch states by name; onChange(name, on).
export function toggles(root, onChange) {
  const state = {};
  for (const sw of root.querySelectorAll("[data-toggle]")) {
    state[sw.dataset.toggle] = sw.getAttribute("aria-checked") === "true" || sw.dataset.state === "checked";
    sw.addEventListener("shadcn:checked-change", (e) => {
      state[sw.dataset.toggle] = e.detail.checked;
      onChange(sw.dataset.toggle, e.detail.checked);
    });
  }
  return state;
}

// Pointer position in the SVG's viewBox units.
export function svgPoint(svg, e) {
  const m = svg.getScreenCTM();
  if (!m) return [0, 0];
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return [p.x, p.y];
}

// Resolves a CSS colour (often a var() in oklch) to [r, g, b] for pixel work.
const probeCanvas = document.createElement("canvas");
probeCanvas.width = probeCanvas.height = 1;
const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
export function rgbOf(host, css) {
  const span = document.createElement("span");
  span.style.color = css;
  span.style.display = "none";
  host.append(span);
  const c = getComputedStyle(span).color;
  span.remove();
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = "#000";
  probeCtx.fillStyle = c;
  probeCtx.fillRect(0, 0, 1, 1);
  const d = probeCtx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Calls fn whenever the theme class on <html> flips.
export function onTheme(fn) {
  let dark = document.documentElement.classList.contains("dark");
  new MutationObserver(() => {
    const now = document.documentElement.classList.contains("dark");
    if (now !== dark) {
      dark = now;
      fn();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// Signed area with y pointing up (SVG y points down, so it is negated):
// positive for a counter-clockwise ring as seen on the map.
export function signedArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n];
    s += x1 * -y2 - x2 * -y1;
  }
  return s / 2;
}

// Even–odd ray casting to +x. Each edge is half-open in y, so a ray through
// a vertex counts the two edges meeting there once between them.
export function crossings(ring, [px, py]) {
  const hits = [];
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n];
    if ((y1 > py) !== (y2 > py)) {
      const x = x1 + ((py - y1) / (y2 - y1)) * (x2 - x1);
      if (x > px) hits.push({ x, edge: i });
    }
  }
  return hits;
}
export const inside = (ring, p) => crossings(ring, p).length % 2 === 1;

export function circumcircle(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a[0] ** 2 + a[1] ** 2, b2 = b[0] ** 2 + b[1] ** 2, c2 = c[0] ** 2 + c[1] ** 2;
  const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { x, y, r2: (a[0] - x) ** 2 + (a[1] - y) ** 2 };
}

// Bowyer–Watson. Returns triangles as index triples into pts, each with its
// circumcircle. Duplicate points are skipped.
export function delaunay(pts) {
  const n = pts.length;
  if (n < 3) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const d = Math.max(maxX - minX, maxY - minY) * 20 + 1, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const all = pts.concat([[cx - d, cy - d], [cx + d, cy - d], [cx, cy + d]]);
  let tris = [{ v: [n, n + 1, n + 2], c: circumcircle(all[n], all[n + 1], all[n + 2]) }];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const p = all[i], key = p[0] + "," + p[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const bad = [], keep = [];
    for (const t of tris) ((t.c && (p[0] - t.c.x) ** 2 + (p[1] - t.c.y) ** 2 < t.c.r2 - 1e-9) ? bad : keep).push(t);
    // The hole's boundary: edges of bad triangles that only one of them has.
    const edges = new Map();
    for (const t of bad) for (let k = 0; k < 3; k++) {
      const a = t.v[k], b = t.v[(k + 1) % 3], key2 = a < b ? a + "_" + b : b + "_" + a;
      edges.has(key2) ? edges.delete(key2) : edges.set(key2, [a, b]);
    }
    for (const [a, b] of edges.values()) {
      const c = circumcircle(all[a], all[b], p);
      if (c) keep.push({ v: [a, b, i], c });
    }
    tris = keep;
  }
  return tris.filter((t) => t.v.every((k) => k < n));
}

// Linear interpolation inside a triangle (barycentric), or null outside.
export function bary(a, b, c, p) {
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(det) < 1e-12) return null;
  const l1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / det;
  const l2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / det;
  const l3 = 1 - l1 - l2;
  return l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9 ? [l1, l2, l3] : null;
}

// Distance from p to segment ab.
export function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export const fmtInt = (v) => new Intl.NumberFormat("en").format(Math.round(v));
