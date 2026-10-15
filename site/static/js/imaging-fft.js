// Numerics for the medical imaging blocks: a radix-2 FFT (1D and 2D), the
// Shepp–Logan head phantom with its exact Radon transform, and grayscale
// canvas output.

// In-place iterative radix-2 FFT on separate real and imaginary arrays.
// inverse = true computes the inverse transform, scaled by 1/n.
export function fft(re, im, inverse = false) {
  const n = re.length;
  if (n & (n - 1)) throw new Error("fft: length must be a power of two");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// 2D FFT of an n×n image stored row-major: rows, then columns.
export function fft2(re, im, n, inverse = false) {
  const r = new Float64Array(n), c = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) { r[x] = re[y * n + x]; c[x] = im[y * n + x]; }
    fft(r, c, inverse);
    for (let x = 0; x < n; x++) { re[y * n + x] = r[x]; im[y * n + x] = c[x]; }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { r[y] = re[y * n + x]; c[y] = im[y * n + x]; }
    fft(r, c, inverse);
    for (let y = 0; y < n; y++) { re[y * n + x] = r[y]; im[y * n + x] = c[y]; }
  }
}

// Shepp & Logan (1974) head phantom, as [ρ, a, b, x0, y0, φ°] on [−1, 1]².
// "modified" uses Toft's higher-contrast intensities, common for display.
const SHEPP = [
  [2.0, 0.69, 0.92, 0, 0, 0],
  [-0.98, 0.6624, 0.874, 0, -0.0184, 0],
  [-0.02, 0.11, 0.31, 0.22, 0, -18],
  [-0.02, 0.16, 0.41, -0.22, 0, 18],
  [0.01, 0.21, 0.25, 0, 0.35, 0],
  [0.01, 0.046, 0.046, 0, 0.1, 0],
  [0.01, 0.046, 0.046, 0, -0.1, 0],
  [0.01, 0.046, 0.023, -0.08, -0.605, 0],
  [0.01, 0.023, 0.023, 0, -0.606, 0],
  [0.01, 0.023, 0.046, 0.06, -0.605, 0],
];
const TOFT = [1, -0.8, -0.2, -0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];

export function sheppLogan(modified) {
  return SHEPP.map((e, i) => {
    const [rho, a, b, x0, y0, phi] = e;
    return { rho: modified ? TOFT[i] : rho, a, b, x0, y0, phi: (phi * Math.PI) / 180 };
  });
}

// Rasterizes ellipses on an n×n grid over [−1, 1]² (y up, row 0 at top).
export function rasterize(ellipses, n) {
  const img = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const y = 1 - ((j + 0.5) * 2) / n;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * 2) / n - 1;
      let v = 0;
      for (const e of ellipses) {
        const dx = x - e.x0, dy = y - e.y0, c = Math.cos(e.phi), s = Math.sin(e.phi);
        const u = dx * c + dy * s, w = -dx * s + dy * c;
        if ((u * u) / (e.a * e.a) + (w * w) / (e.b * e.b) <= 1) v += e.rho;
      }
      img[j * n + i] = v;
    }
  }
  return img;
}

// Exact Radon transform of the ellipses: line integral at angle θ and signed
// distance s, p = 2ρab·√(a²(θ) − (s − s₀)²)/a²(θ).
export function radon(ellipses, theta, s) {
  let p = 0;
  for (const e of ellipses) {
    const t = theta - e.phi;
    const a2 = e.a * e.a * Math.cos(t) ** 2 + e.b * e.b * Math.sin(t) ** 2;
    const d = s - (e.x0 * Math.cos(theta) + e.y0 * Math.sin(theta));
    if (d * d < a2) p += (2 * e.rho * e.a * e.b * Math.sqrt(a2 - d * d)) / a2;
  }
  return p;
}

// Writes values to a canvas as grays; lo..hi maps to black..white.
export function drawGray(canvas, data, w, h, lo, hi) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const span = hi - lo || 1;
  for (let i = 0; i < w * h; i++) {
    const g = Math.max(0, Math.min(255, Math.round(((data[i] - lo) / span) * 255)));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

export function range(data) {
  let lo = Infinity, hi = -Infinity;
  for (const v of data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
