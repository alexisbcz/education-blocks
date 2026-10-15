// Pure helpers for the modern cryptography blocks: AES-128 with a step
// trace, SHA-256, HMAC, PKCS#7, hex and a seeded RNG. No side
// effects: the page loads this file too, and it does nothing on its own.

// ------------------------------------------------------------ bytes

export const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export function unhex(s) {
  const clean = s.replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(2 * i, 2 * i + 2), 16);
  return out;
}
export const utf8 = (s) => new TextEncoder().encode(s);
export const fromUtf8 = (b) => new TextDecoder("utf-8", { fatal: false }).decode(b);
export const xor = (a, b) => a.map((v, i) => v ^ b[i]);
export const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
export const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Seeded PRNG (mulberry32) returning floats in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randomBytes = (n, r) => {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(r() * 256);
  return out;
};

// ------------------------------------------------------------ AES (FIPS-197)

// GF(2⁸) with the AES polynomial x⁸ + x⁴ + x³ + x + 1.
export const xtime = (b) => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
export function gmul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    a = xtime(a);
    b >>= 1;
  }
  return p;
}

// The S-box is built, not typed: multiplicative inverse, then the affine map.
export const SBOX = new Uint8Array(256);
export const INV_SBOX = new Uint8Array(256);
{
  const inv = new Uint8Array(256);
  for (let a = 1; a < 256; a++) for (let b = 1; b < 256; b++) if (gmul(a, b) === 1) { inv[a] = b; break; }
  const rotl = (x, s) => ((x << s) | (x >> (8 - s))) & 0xff;
  for (let a = 0; a < 256; a++) {
    const x = inv[a];
    const s = x ^ rotl(x, 1) ^ rotl(x, 2) ^ rotl(x, 3) ^ rotl(x, 4) ^ 0x63;
    SBOX[a] = s;
    INV_SBOX[s] = a;
  }
}

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

/** Eleven 16-byte round keys from a 16-byte key. */
export function expandKey(key) {
  const w = [];
  for (let i = 0; i < 4; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1].slice();
    if (i % 4 === 0) {
      t = [t[1], t[2], t[3], t[0]].map((b) => SBOX[b]);
      t[0] ^= RCON[i / 4 - 1];
    }
    w.push(w[i - 4].map((b, j) => b ^ t[j]));
  }
  const keys = [];
  for (let r = 0; r < 11; r++) keys.push(Uint8Array.from(w.slice(4 * r, 4 * r + 4).flat()));
  return keys;
}

// The state is 16 bytes in column order: byte i is row i % 4, column ⌊i/4⌋.
const subBytes = (s) => s.map((b) => SBOX[b]);
const invSubBytes = (s) => s.map((b) => INV_SBOX[b]);
function shiftRows(s) {
  const o = new Uint8Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[4 * c + r] = s[4 * ((c + r) % 4) + r];
  return o;
}
function invShiftRows(s) {
  const o = new Uint8Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[4 * ((c + r) % 4) + r] = s[4 * c + r];
  return o;
}
function mixColumns(s) {
  const o = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    const [a0, a1, a2, a3] = s.slice(4 * c, 4 * c + 4);
    o[4 * c] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
    o[4 * c + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
    o[4 * c + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
    o[4 * c + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
  }
  return o;
}
function invMixColumns(s) {
  const o = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    const [a0, a1, a2, a3] = s.slice(4 * c, 4 * c + 4);
    o[4 * c] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
    o[4 * c + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
    o[4 * c + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
    o[4 * c + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
  }
  return o;
}
const addRoundKey = (s, k) => s.map((b, i) => b ^ k[i]);

/** Encrypts one block and records every step: [{round, step, state}]. */
export function aesTrace(block, key) {
  const keys = expandKey(key);
  const steps = [{ round: 0, step: "input", state: Uint8Array.from(block) }];
  let s = addRoundKey(Uint8Array.from(block), keys[0]);
  steps.push({ round: 0, step: "AddRoundKey", state: s });
  for (let r = 1; r <= 10; r++) {
    s = subBytes(s); steps.push({ round: r, step: "SubBytes", state: s });
    s = shiftRows(s); steps.push({ round: r, step: "ShiftRows", state: s });
    if (r < 10) { s = mixColumns(s); steps.push({ round: r, step: "MixColumns", state: s }); }
    s = addRoundKey(s, keys[r]); steps.push({ round: r, step: "AddRoundKey", state: s });
  }
  return { steps, keys };
}

/** A block cipher object with the expanded key cached. */
export function aes(key) {
  const keys = expandKey(key);
  return {
    encrypt(block) {
      let s = addRoundKey(block, keys[0]);
      for (let r = 1; r <= 10; r++) {
        s = shiftRows(subBytes(s));
        if (r < 10) s = mixColumns(s);
        s = addRoundKey(s, keys[r]);
      }
      return s;
    },
    decrypt(block) {
      let s = addRoundKey(block, keys[10]);
      for (let r = 9; r >= 0; r--) {
        s = invSubBytes(invShiftRows(s));
        s = addRoundKey(s, keys[r]);
        if (r > 0) s = invMixColumns(s);
      }
      return s;
    },
  };
}

// ------------------------------------------------------------ modes

export function pkcs7(data) {
  const n = 16 - (data.length % 16);
  return concat(data, new Uint8Array(n).fill(n));
}
/** Strips PKCS#7 padding, or returns null when it is malformed. */
export function unpkcs7(data) {
  if (!data.length || data.length % 16) return null;
  const n = data[data.length - 1];
  if (n < 1 || n > 16) return null;
  for (let i = data.length - n; i < data.length; i++) if (data[i] !== n) return null;
  return data.slice(0, data.length - n);
}

export function ecbEncrypt(cipher, data) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 16) out.set(cipher.encrypt(data.slice(i, i + 16)), i);
  return out;
}
export function cbcEncrypt(cipher, iv, data) {
  const out = new Uint8Array(data.length);
  let prev = iv;
  for (let i = 0; i < data.length; i += 16) {
    prev = cipher.encrypt(xor(data.slice(i, i + 16), prev));
    out.set(prev, i);
  }
  return out;
}
export function cbcDecrypt(cipher, iv, data) {
  const out = new Uint8Array(data.length);
  let prev = iv;
  for (let i = 0; i < data.length; i += 16) {
    const c = data.slice(i, i + 16);
    out.set(xor(cipher.decrypt(c), prev), i);
    prev = c;
  }
  return out;
}
/** CTR with a 16-byte initial counter block, incremented big-endian. */
export function ctrKeystream(cipher, counter, n) {
  const out = new Uint8Array(n);
  const ctr = Uint8Array.from(counter);
  for (let i = 0; i < n; i += 16) {
    const ks = cipher.encrypt(ctr);
    out.set(ks.slice(0, Math.min(16, n - i)), i);
    for (let j = 15; j >= 0; j--) if (++ctr[j] <= 255) break; else ctr[j] = 0;
  }
  return out;
}
export const ctrCrypt = (cipher, counter, data) => xor(data, ctrKeystream(cipher, counter, data.length));

// ------------------------------------------------------------ SHA-256

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
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

function compress(h, block) {
  const w = new Uint32Array(64);
  for (let i = 0; i < 16; i++) w[i] = (block[4 * i] << 24) | (block[4 * i + 1] << 16) | (block[4 * i + 2] << 8) | block[4 * i + 3];
  for (let i = 16; i < 64; i++) {
    const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
    const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let [a, b, c, d, e, f, g, hh] = h;
  for (let i = 0; i < 64; i++) {
    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  return [a, b, c, d, e, f, g, hh].map((v, i) => (v + h[i]) >>> 0);
}

function shaPadding(len) {
  const k = (64 - ((len + 9) % 64)) % 64;
  const pad = new Uint8Array(1 + k + 8);
  pad[0] = 0x80;
  const bits = BigInt(len) * 8n;
  for (let i = 0; i < 8; i++) pad[pad.length - 1 - i] = Number((bits >> BigInt(8 * i)) & 0xffn);
  return pad;
}

/** SHA-256 of a byte array (FIPS 180-4). */
export function sha256(data) {
  let h = H0.slice();
  const msg = concat(data, shaPadding(data.length));
  for (let i = 0; i < msg.length; i += 64) h = compress(h, msg.slice(i, i + 64));
  const out = new Uint8Array(32);
  h.forEach((v, i) => { out[4 * i] = v >>> 24; out[4 * i + 1] = (v >>> 16) & 255; out[4 * i + 2] = (v >>> 8) & 255; out[4 * i + 3] = v & 255; });
  return out;
}

export function hmac(key, msg) {
  let k = key.length > 64 ? sha256(key) : key;
  k = concat(k, new Uint8Array(64 - k.length));
  const ipad = k.map((b) => b ^ 0x36), opad = k.map((b) => b ^ 0x5c);
  return sha256(concat(opad, sha256(concat(ipad, msg))));
}

// ------------------------------------------------------------ DOM bits

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
export const act = (root, name, fn) => root.querySelectorAll(`[data-action="${name}"]`).forEach((b) => b.addEventListener("click", fn));
/** Calls fn once the root is near the viewport, then never again. */
export function whenVisible(root, fn) {
  if (typeof IntersectionObserver !== "function") return fn();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: "200px" });
  io.observe(root);
}
