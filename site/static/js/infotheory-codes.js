// Information theory blocks, part two: the binary symmetric channel with
// Hamming(7,4) and repetition codes, parity / checksum / CRC-32, mutual
// information, and JPEG-style DCT quantization.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { wireText } from "./infotheory.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const H2 = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));

// A bit drawn as a small toggle button.
function bitButton(v, { flipped = false, role = "", onClick } = {}) {
  const b = document.createElement(onClick ? "button" : "span");
  if (onClick) {
    b.type = "button";
    b.addEventListener("click", onClick);
  }
  b.textContent = String(v);
  b.title = role;
  b.className =
    "flex size-7 items-center justify-center rounded-md border font-mono text-sm tabular-nums transition-colors duration-100 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
    (flipped ? "border-del bg-del/15 text-del" : role.startsWith("p") ? "bg-vec-u/10 text-vec-u" : "bg-background") +
    (onClick ? " cursor-pointer hover:border-foreground/40" : "");
  return b;
}

// ============================================================ Channel and Hamming(7,4)

// Positions 1..7 hold p1 p2 d1 p3 d2 d3 d4; each parity bit covers the
// positions whose index has its bit set, so the syndrome spells the
// position of a single error in binary.
export function hammingEncode([d1, d2, d3, d4]) {
  const p1 = d1 ^ d2 ^ d4, p2 = d1 ^ d3 ^ d4, p3 = d2 ^ d3 ^ d4;
  return [p1, p2, d1, p3, d2, d3, d4];
}

export function hammingDecode(r) {
  const s1 = r[0] ^ r[2] ^ r[4] ^ r[6];
  const s2 = r[1] ^ r[2] ^ r[5] ^ r[6];
  const s3 = r[3] ^ r[4] ^ r[5] ^ r[6];
  const syn = s1 + 2 * s2 + 4 * s3;
  const c = [...r];
  if (syn) c[syn - 1] ^= 1;
  return { syn, bits: [c[2], c[4], c[5], c[6]], fixed: syn };
}

for (const root of document.querySelectorAll("[data-info-channel]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const q = (k) => root.querySelector(`[data-${k}]`);
  let code = "hamming";
  let data = [1, 0, 1, 1];
  let err = [];
  const sc = scrubAll(root, () => draw());
  const ROLES = ["p1", "p2", "d1", "p3", "d2", "d3", "d4"];

  const sentBits = () => (code === "hamming" ? hammingEncode(data) : data.flatMap((b) => [b, b, b]));
  const resetErr = () => (err = new Array(sentBits().length).fill(0));
  resetErr();

  function draw() {
    const p = sc.p.get();
    // Capacity curve.
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 12, 540, 150], x: [0, 1], y: [0, 1], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 0.5, 1], xlabel: "flip probability p", ylabel: "bits" });
    const pts = Array.from({ length: 201 }, (_, i) => i / 200);
    polyline(svg, pts.map((x) => [f.sx(x), f.sy(1 - H2(x))]), "stroke:var(--brand);stroke-width:2");
    polyline(svg, pts.map((x) => [f.sx(x), f.sy(H2(x))]), "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:4 3");
    el("line", { x1: f.sx(p), x2: f.sx(p), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(p), cy: f.sy(1 - H2(p)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(0.035), f.sy(0.86), "C = 1 − H(p)", { style: "fill:var(--brand)", class: "font-mono text-[10px]" });
    text(svg, f.sx(0.3), f.sy(0.94), "H(p)", { style: "fill:var(--vec-u)", class: "font-mono text-[10px]" });

    // The message through the channel.
    const sent = sentBits();
    const recv = sent.map((b, i) => b ^ err[i]);
    q("data").replaceChildren(...data.map((b, i) => bitButton(b, { role: `d${i + 1}`, onClick: () => { data[i] ^= 1; draw(); } })));
    q("sent").replaceChildren(...sent.map((b, i) => bitButton(b, { role: code === "hamming" ? ROLES[i] : `bit ${Math.floor(i / 3) + 1}` })));
    q("received").replaceChildren(...recv.map((b, i) => bitButton(b, { flipped: !!err[i], role: "click to flip", onClick: () => { err[i] ^= 1; draw(); } })));
    let decoded, detail;
    if (code === "hamming") {
      const d = hammingDecode(recv);
      decoded = d.bits;
      detail = d.syn ? `syndrome ${d.syn.toString(2).padStart(3, "0")}₂ = ${d.syn}: flip position ${d.syn} (${ROLES[d.syn - 1]})` : "syndrome 000: no error seen";
    } else {
      decoded = data.map((_, i) => (recv[3 * i] + recv[3 * i + 1] + recv[3 * i + 2] >= 2 ? 1 : 0));
      detail = "each bit decided by majority vote of its three copies";
    }
    q("decoded").replaceChildren(...decoded.map((b, i) => bitButton(b, { flipped: b !== data[i] })));
    const flips = err.reduce((a, b) => a + b, 0);
    const ok = decoded.every((b, i) => b === data[i]);
    const v = q("verdict");
    v.textContent = ok ? `correct (${flips} flip${flips === 1 ? "" : "s"})` : `wrong: ${flips} flips is more than the code can fix`;
    v.className = "text-xs " + (ok ? "text-add" : "text-del");
    q("syndrome").textContent = detail;

    const hp = H2(p);
    o.hp.textContent = `${num(hp, 4)} bits`;
    o.cap.textContent = `${num(1 - hp, 4)} bits per use`;
    o.rate.textContent = code === "hamming" ? "4/7 = 0.571" : "1/3 = 0.333";
    const fail = code === "hamming"
      ? 1 - (1 - p) ** 7 - 7 * p * (1 - p) ** 6
      : 1 - (1 - (3 * p * p * (1 - p) + p ** 3)) ** 4;
    o.fail.textContent = `${num(100 * fail, 2)}% (uncoded ${num(100 * (1 - (1 - p) ** 4), 2)}%)`;
  }

  root.addEventListener("seg-change", (e) => { code = e.detail.value; resetErr(); draw(); });
  root.querySelector("[data-action=noise]").addEventListener("click", () => {
    const p = sc.p.get();
    err = sentBits().map(() => (Math.random() < p ? 1 : 0));
    draw();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { resetErr(); draw(); });
  draw();
}

// ============================================================ Parity, checksum, CRC-32

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const hex = (n) => n.toString(16).toUpperCase().padStart(8, "0");

for (const root of document.querySelectorAll("[data-info-crc]")) {
  const bitsEl = root.querySelector("[data-bits]");
  const o = outs(root);
  let orig = new Uint8Array(), recv = new Uint8Array();

  const checks = (b) => {
    let ones = 0, sum = 0;
    for (const x of b) {
      sum = (sum + x) & 0xff;
      for (let k = 0; k < 8; k++) ones += (x >> k) & 1;
    }
    return { parity: ones & 1, sum, crc: crc32(b) };
  };

  function draw() {
    bitsEl.replaceChildren();
    recv.forEach((byte, i) => {
      const g = document.createElement("span");
      g.className = "flex gap-px";
      for (let k = 7; k >= 0; k--) {
        const bit = (byte >> k) & 1;
        const changed = ((orig[i] >> k) & 1) !== bit;
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = String(bit);
        b.setAttribute("aria-label", `byte ${i + 1} bit ${7 - k}`);
        b.className = "w-3.5 rounded-sm text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50 " + (changed ? "bg-del/20 text-del" : "hover:bg-accent");
        b.addEventListener("click", () => { recv[i] ^= 1 << k; draw(); });
        g.append(b);
      }
      bitsEl.append(g);
    });
    const a = checks(orig), r = checks(recv);
    const damaged = recv.some((x, i) => x !== orig[i]);
    const verdict = (key, same) => {
      const e = o[`${key}-ok`];
      e.textContent = !damaged ? "matches the message" : same ? "error missed" : "error detected";
      e.className = "text-xs " + (!damaged ? "text-muted-foreground" : same ? "text-del" : "text-add");
    };
    o.parity.textContent = `${r.parity} (sent ${a.parity})`;
    o.sum.textContent = `${r.sum} (sent ${a.sum})`;
    o.crc.textContent = hex(r.crc);
    verdict("parity", a.parity === r.parity);
    verdict("sum", a.sum === r.sum);
    verdict("crc", a.crc === r.crc);
  }

  const set = (s) => {
    orig = new TextEncoder().encode(s).slice(0, 64);
    recv = orig.slice();
    draw();
  };
  const input = wireText(root, "text", set);
  // "Swapped" compares a transposition against the original check values.
  for (const b of root.querySelectorAll('[data-info-preset="text"]')) {
    if (b.dataset.value === "213456789") b.addEventListener("click", () => {
      orig = new TextEncoder().encode("123456789");
      recv = new TextEncoder().encode("213456789");
      draw();
    });
  }
  set(input.value);
}

// ============================================================ Mutual information

const PRESETS = { "30,5,10,55": [30, 5, 10, 55], "20,30,20,30": [20, 30, 20, 30], "50,0,0,50": [50, 0, 0, 50] };

for (const root of document.querySelectorAll("[data-info-mutual]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const sc = scrubAll(root, () => draw());
  const keys = ["c00", "c01", "c10", "c11"];
  for (const b of root.querySelectorAll('[data-info-preset="joint"]')) {
    b.addEventListener("click", () => {
      PRESETS[b.dataset.value].forEach((v, i) => sc[keys[i]].set(v, false));
      draw();
    });
  }

  function draw() {
    const c = keys.map((k) => Math.max(0, sc[k].get()));
    const n = c.reduce((a, b) => a + b, 0);
    svg.replaceChildren();
    if (!n) {
      for (const k of ["hx", "hy", "hxy", "hxgy", "mi", "kl"]) o[k].textContent = "—";
      return;
    }
    const p = c.map((x) => x / n);
    const px = [p[0] + p[1], p[2] + p[3]], py = [p[0] + p[2], p[1] + p[3]];
    const Hs = (arr) => -arr.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0);
    const hx = Hs(px), hy = Hs(py), hxy = Hs(p);
    const mi = hx + hy - hxy;
    let kl = 0;
    [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([i, j], k) => {
      if (p[k] > 0) kl += p[k] * Math.log2(p[k] / (px[i] * py[j]));
    });
    // The information diagram, drawn to scale: H(X) from the left, H(Y)
    // from the right of H(X,Y); their overlap is I(X;Y).
    const L = 40, W = 520, scale = W / 2;
    const bar = (y, a, b, color, label, sub) => {
      el("rect", { x: L + a * scale, y, width: Math.max(0, (b - a) * scale), height: 30, rx: 4, style: `fill:${color};fill-opacity:0.18;stroke:${color};stroke-opacity:0.7` }, svg);
      text(svg, L + a * scale + 6, y + 19, label, { class: "fill-foreground font-mono text-[11px]" });
      if (sub) text(svg, L + b * scale - 6, y + 19, sub, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" });
    };
    for (let t = 0; t <= 2; t += 0.5) {
      el("line", { x1: L + t * scale, x2: L + t * scale, y1: 16, y2: 250, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, L + t * scale, 266, `${t} bit${t === 1 ? "" : "s"}`, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" });
    }
    bar(24, 0, hxy, "var(--foreground)", "H(X,Y)", num(hxy, 3));
    bar(70, 0, hx, "var(--vec-u)", "H(X)", num(hx, 3));
    bar(116, hxy - hy, hxy, "var(--ion-cl)", "H(Y)", num(hy, 3));
    if (mi > 1e-9) bar(162, hxy - hy, hx, "var(--brand)", "I(X;Y)", num(mi, 3));
    else text(svg, L, 182, "I(X;Y) = 0: independent", { class: "fill-muted-foreground font-mono text-[11px]" });
    bar(208, 0, hxy - hy, "var(--vec-out)", "H(X|Y)", num(hxy - hy, 3));
    o.hx.textContent = `${num(hx, 4)} bits`;
    o.hy.textContent = `${num(hy, 4)} bits`;
    o.hxy.textContent = `${num(hxy, 4)} bits`;
    o.hxgy.textContent = `${num(hxy - hy, 4)} bits`;
    o.mi.textContent = `${num(mi, 4)} bits`;
    o.kl.textContent = `${num(kl, 4)} bits`;
  }
  draw();
}

// ============================================================ DCT and quantization

// The example luminance table of JPEG (ITU-T T.81, Annex K, Table K.1).
const LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

// IJG libjpeg quality scaling.
export function quantTable(q) {
  const s = q < 50 ? Math.floor(5000 / q) : 200 - 2 * q;
  return { s, t: LUMA.map((v) => Math.min(255, Math.max(1, Math.floor((v * s + 50) / 100)))) };
}

const COS = Array.from({ length: 64 }, (_, i) => Math.cos(((2 * (i >> 3) + 1) * (i & 7) * Math.PI) / 16)); // [x][u]
const Cf = (u) => (u === 0 ? Math.SQRT1_2 : 1);

function dct8(block) {
  const out = new Float64Array(64);
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) s += block[y * 8 + x] * COS[x * 8 + u] * COS[y * 8 + v];
    out[v * 8 + u] = 0.25 * Cf(u) * Cf(v) * s;
  }
  return out;
}

function idct8(F) {
  const out = new Float64Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    let s = 0;
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) s += Cf(u) * Cf(v) * F[v * 8 + u] * COS[x * 8 + u] * COS[y * 8 + v];
    out[y * 8 + x] = 0.25 * s;
  }
  return out;
}

// A 64×64 test image with smooth and sharp regions.
function testImage() {
  const N = 64, img = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 40 + 2.2 * x + 0.8 * y; // smooth gradient
    if ((x - 22) ** 2 + (y - 22) ** 2 < 13 ** 2) v = 225; // a bright disc
    if (x >= 40 && y >= 8 && y < 30) v = ((x >> 1) + (y >> 1)) % 2 ? 30 : 210; // fine checker
    if (y >= 40 && x < 30) v = 90 + 60 * Math.sin(x * 0.9); // stripes
    if (x >= 36 && y >= 38 && x < 60 && y < 60 && Math.abs(x - y) < 2) v = 250; // a diagonal line
    img[y * N + x] = Math.max(0, Math.min(255, v));
  }
  return img;
}

for (const root of document.querySelectorAll("[data-info-dct]")) {
  const o = outs(root);
  const canvases = Object.fromEntries([...root.querySelectorAll("[data-canvas]")].map((c) => [c.dataset.canvas, c]));
  const coeffs = root.querySelector("[data-coeffs]");
  const N = 64;
  const img = testImage();
  let blockAt = [1, 1], quantized = []; // starts on the disc edge, where high frequencies live
  const sc = scrubAll(root, () => run());

  const paint = (canvas, data) => {
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext("2d");
    const im = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = Math.max(0, Math.min(255, Math.round(data[i])));
      im.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(im, 0, 0);
  };

  function run() {
    const { s, t } = quantTable(Math.round(sc.quality.get()));
    const out = new Float64Array(N * N);
    quantized = [];
    let nonzero = 0;
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
      const blk = new Float64Array(64);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blk[y * 8 + x] = img[(by * 8 + y) * N + bx * 8 + x] - 128;
      const F = dct8(blk);
      const Q = F.map((v, i) => Math.round(v / t[i]));
      quantized.push(Q);
      nonzero += Q.reduce((a, v) => a + (v !== 0), 0);
      const back = idct8(Q.map((v, i) => v * t[i]));
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[(by * 8 + y) * N + bx * 8 + x] = Math.max(0, Math.min(255, Math.round(back[y * 8 + x] + 128)));
    }
    let mse = 0;
    const errImg = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) {
      mse += (img[i] - out[i]) ** 2;
      errImg[i] = 128 + 4 * (out[i] - img[i]);
    }
    mse /= N * N;
    paint(canvases.original, img);
    paint(canvases.decoded, out);
    paint(canvases.error, errImg);
    o.nonzero.textContent = `${nonzero} of 4096`;
    o.kept.textContent = `${num((100 * nonzero) / 4096, 1)}%`;
    o.psnr.textContent = mse ? `${num(10 * Math.log10((255 * 255) / mse), 2)} dB` : "∞ (lossless)";
    o.scale.textContent = `${s}% of Table K.1`;
    showBlock();
  }

  function showBlock() {
    const Q = quantized[blockAt[1] * 8 + blockAt[0]];
    coeffs.replaceChildren(...Array.from(Q, (v, i) => {
      const c = document.createElement("span");
      c.textContent = String(v);
      c.title = `(u, v) = (${i & 7}, ${i >> 3})`;
      c.className = "rounded-sm py-0.5 text-center " + (v ? "bg-brand/15 text-foreground" : "text-muted-foreground/50");
      return c;
    }));
  }

  for (const c of [canvases.original, canvases.decoded, canvases.error]) {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      const bx = Math.min(7, Math.floor(((e.clientX - r.left) / r.width) * 8));
      const by = Math.min(7, Math.floor(((e.clientY - r.top) / r.height) * 8));
      if (bx !== blockAt[0] || by !== blockAt[1]) {
        blockAt = [bx, by];
        showBlock();
      }
    });
  }
  run();
}
