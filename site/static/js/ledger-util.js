// Helpers shared by the blockchain modules. No side effects: the page loads
// this file too, and it does nothing on its own.

export const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
export const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value, e.target));
export const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));

export const mk = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

export const smallButton = (label, onClick) => {
  const b = mk("button", "inline-flex h-7 items-center justify-center gap-1 rounded-md border bg-background px-2 font-mono text-xs shadow-xs outline-none transition-colors duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50", label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
};

/** A hash shown short, with the full value on hover and for screen readers. */
export function hashSpan(hex, n = 10, cls = "") {
  const s = mk("span", "font-mono tabular-nums " + cls, hex.slice(0, n) + "…" + hex.slice(-4));
  s.title = hex;
  s.setAttribute("aria-label", "hash " + hex);
  return s;
}

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ SHA-256
// A synchronous SHA-256 (FIPS 180-4). Web Crypto is async, and a miner
// that awaits one promise per nonce spends its time in the event loop.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
const enc = new TextEncoder();

/** SHA-256 of a string (UTF-8) or bytes, as 8 big-endian words. */
export function sha256Words(input) {
  const msg = typeof input === "string" ? enc.encode(input) : input;
  const len = msg.length;
  const blocks = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(blocks);
  buf.set(msg);
  buf[len] = 0x80;
  const bits = len * 8;
  buf[blocks - 4] = bits >>> 24; buf[blocks - 3] = bits >>> 16; buf[blocks - 2] = bits >>> 8; buf[blocks - 1] = bits;
  buf[blocks - 5] = Math.floor(bits / 2 ** 32);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  for (let o = 0; o < blocks; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (buf[o + 4 * i] << 24) | (buf[o + 4 * i + 1] << 16) | (buf[o + 4 * i + 2] << 8) | buf[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x >>> 0);
}

export const toHex = (words) => words.map((w) => w.toString(16).padStart(8, "0")).join("");
export const sha256 = (input) => toHex(sha256Words(input));

/** Number of leading zero bits of a hash given as words. */
export function leadingZeroBits(words) {
  let n = 0;
  for (const w of words) {
    if (w === 0) { n += 32; continue; }
    return n + Math.clz32(w);
  }
  return n;
}

// ------------------------------------------------------------ Nakamoto
// Section 11 of the Bitcoin paper (2008): the probability that an attacker
// with share q of the hash power ever catches up from z blocks behind,
// once the merchant has waited for z confirmations.

export function attackerSuccess(q, z) {
  const p = 1 - q;
  if (q >= p) return 1;
  const lambda = z * (q / p);
  let sum = 1;
  let poisson = Math.exp(-lambda);
  for (let k = 0; k <= z; k++) {
    if (k > 0) poisson *= lambda / k;
    sum -= poisson * (1 - Math.pow(q / p, z - k));
  }
  return sum;
}

/** Smallest z with attackerSuccess(q, z) below target (the paper's 0.1%). */
export function confirmationsFor(q, target = 0.001, zmax = 2000) {
  for (let z = 0; z <= zmax; z++) if (attackerSuccess(q, z) < target) return z;
  return null;
}

// ------------------------------------------------------------ Curves
// y² = x³ + 7 over F_p, the shape of secp256k1 at a size you can draw.
// Points are [x, y]; null is the point at infinity O.

export const mod = (a, p) => ((a % p) + p) % p;
export function inv(a, p) {
  let [r0, r1, s0, s1] = [mod(a, p), p, 1, 0];
  while (r1) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return r0 === 1 ? mod(s0, p) : null;
}

export function ecAdd(P, Q, p, a = 0) {
  if (!P) return Q;
  if (!Q) return P;
  const [x1, y1] = P, [x2, y2] = Q;
  if (x1 === x2 && mod(y1 + y2, p) === 0) return null;
  const l = x1 === x2
    ? mod((3 * x1 * x1 + a) * inv(2 * y1, p), p)
    : mod((y2 - y1) * inv(x2 - x1, p), p);
  const x3 = mod(l * l - x1 - x2, p);
  return [x3, mod(l * (x1 - x3) - y1, p)];
}

/** k·P by double-and-add, with the steps it took (bits read high to low). */
export function ecMul(k, P, p) {
  let R = null;
  const steps = [];
  for (const bit of k.toString(2)) {
    R = ecAdd(R, R, p);
    if (bit === "1") R = ecAdd(R, P, p);
    steps.push({ bit, R });
  }
  return { R, steps };
}

export const onCurve = (P, p, b = 7) => !P || mod(P[1] * P[1] - (P[0] ** 3 + b), p) === 0;

export function curvePoints(p, b = 7) {
  const pts = [];
  for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) if (mod(y * y - (x * x * x + b), p) === 0) pts.push([x, y]);
  return pts;
}

export function orderOf(P, p) {
  let n = 1, R = P;
  while (R) { R = ecAdd(R, P, p); n++; if (n > 4 * p + 10) return null; }
  return n;
}

export const isPrime = (n) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
