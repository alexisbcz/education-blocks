// Number theory blocks: the Ulam spiral, π(x) against x / ln x and Li(x),
// Goldbach's comet, continued fractions, Farey sequences and Ford circles,
// times tables on a circle, the Chinese remainder theorem, quadratic
// residues, Pythagorean triples and the Collatz problem. Integer work is
// exact (BigInt where sizes need it); nothing leaves the browser.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
const node = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const clear = (svg) => svg.replaceChildren();
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (a, m) => ((a % m) + m) % m;

function short(v) {
  if (v >= 1e6) return +(v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return +(v / 1e3).toFixed(1) + "k";
  return String(+v.toFixed(0));
}
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (k) => String(k).split("").map((d) => SUP[+d]).join("");
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (k) => String(k).split("").map((d) => SUB[+d]).join("");

// Canvas colours: CSS custom properties resolved by painting one pixel.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
const rgba = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
const palette = () => ({
  fg: rgbOf("var(--foreground)"), bg: rgbOf("var(--background)"), brand: rgbOf("var(--brand)"),
  u: rgbOf("var(--vec-u)"), muted: rgbOf("var(--muted-foreground)"),
});

function fit(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return canvas.getContext("2d");
}

// Pointer position in an SVG's viewBox units.
function svgPoint(svg, e) {
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return [pt.x, pt.y];
}

function playButton(btn) {
  const label = btn.querySelector("[data-label]");
  const first = label.textContent;
  return (playing, words = ["Play", "Pause"]) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    label.textContent = playing ? words[1] : words[0] ?? first;
  };
}

// A requestAnimationFrame loop that only runs while its block is on screen.
function loop(root, tick, onState) {
  let raf = 0, playing = false, visible = false, last = 0;
  const step = (now) => {
    const dt = Math.min(50, now - last);
    last = now;
    if (tick(dt) === false) { set(false); return; }
    raf = playing && visible ? requestAnimationFrame(step) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
  const set = (p) => {
    playing = p;
    if (!p && raf) { cancelAnimationFrame(raf); raf = 0; }
    onState?.(p);
    kick();
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; } kick(); }).observe(root);
  return { set, get playing() { return playing; } };
}

// A sieve of Eratosthenes: composite[i] = 1 for composite i (0 and 1 too).
const sieves = new Map();
function sieve(n) {
  for (const [k, s] of sieves) if (k >= n) return s;
  const c = new Uint8Array(n + 1);
  c[0] = c[1] = 1;
  for (let i = 2; i * i <= n; i++) if (!c[i]) for (let j = i * i; j <= n; j += i) c[j] = 1;
  sieves.set(n, c);
  return c;
}
const isPrime = (n) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const smallestFactor = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; };

// ============================================================ Ulam spiral

for (const root of document.querySelectorAll("[data-nt-ulam]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let start = 1, pal = palette(), cells = null, side = 0, hover = -1;
  const euler = root.querySelector('[data-toggle="euler"]');
  const s = scrubAll(root, () => build());
  root.addEventListener("seg-change", (e) => { start = Number(e.detail.value); build(); });
  let showEuler = true;
  euler.addEventListener("shadcn:checked-change", (e) => { showEuler = e.detail.checked; draw(); });
  onTheme(() => { pal = palette(); draw(); });
  new ResizeObserver(() => draw()).observe(canvas);

  // vals[y * side + x] is the integer written in that cell.
  function build() {
    side = Math.round(s.side.get()) | 1;
    if (side !== s.side.get()) s.side.set(side, false);
    const vals = new Int32Array(side * side);
    let x = (side - 1) >> 1, y = x, v = start, len = 1, dir = 0;
    const dx = [1, 0, -1, 0], dy = [0, -1, 0, 1];
    vals[y * side + x] = v++;
    outer: for (;;) {
      for (let rep = 0; rep < 2; rep++) {
        for (let k = 0; k < len; k++) {
          x += dx[dir]; y += dy[dir];
          if (x < 0 || y < 0 || x >= side || y >= side) break outer;
          vals[y * side + x] = v++;
        }
        dir = (dir + 1) % 4;
      }
      len++;
    }
    const max = start + side * side - 1;
    const comp = sieve(Math.max(1000, max));
    const eul = new Set();
    for (let n = 0; n * n + n + 41 <= max; n++) eul.add(n * n + n + 41);
    let primes = 0;
    for (const v of vals) if (!comp[v]) primes++;
    cells = { vals, comp, eul, max };
    o.count.textContent = `${fmtInt(start)} to ${fmtInt(max)}`;
    o.primes.textContent = fmtInt(primes);
    o.share.textContent = (100 * primes / (side * side)).toFixed(1) + " %";
    o.expect.textContent = (100 / Math.log(max)).toFixed(1) + " %";
    draw();
  }

  function draw() {
    if (!cells) return;
    const ctx = fit(canvas);
    const W = canvas.width, c = W / side;
    ctx.fillStyle = rgba(pal.bg);
    ctx.fillRect(0, 0, W, canvas.height);
    const { vals, comp, eul } = cells;
    const big = c >= 22;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      const x = (i % side) * c, y = ((i / side) | 0) * c;
      const e = showEuler && eul.has(v);
      if (!comp[v]) {
        ctx.fillStyle = e ? rgba(pal.brand) : rgba(pal.fg, big ? 0.16 : 0.85);
        const pad = c > 4 ? c * 0.08 : 0;
        ctx.fillRect(x + pad, y + pad, c - 2 * pad, c - 2 * pad);
      } else if (e) {
        ctx.strokeStyle = rgba(pal.brand);
        ctx.lineWidth = Math.max(1, c * 0.08);
        ctx.strokeRect(x + c * 0.15, y + c * 0.15, c * 0.7, c * 0.7);
      }
      if (big) {
        ctx.fillStyle = !comp[v] ? rgba(e ? pal.bg : pal.fg) : rgba(pal.muted, 0.7);
        ctx.font = `${Math.min(c * 0.36, 22)}px "Geist Mono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(v), x + c / 2, y + c / 2 + 0.5);
      }
    }
    if (hover >= 0) {
      ctx.strokeStyle = rgba(pal.brand);
      ctx.lineWidth = Math.max(1.5, c * 0.1);
      ctx.strokeRect((hover % side) * c, ((hover / side) | 0) * c, c, c);
    }
  }

  canvas.addEventListener("pointermove", (e) => {
    if (!cells) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * side), y = Math.floor(((e.clientY - r.top) / r.height) * side);
    if (x < 0 || y < 0 || x >= side || y >= side) return;
    hover = y * side + x;
    const v = cells.vals[hover];
    const tag = cells.eul.has(v) ? ` = n² + n + 41, n = ${(Math.sqrt(4 * v - 163) - 1) / 2}` : "";
    o.hover.textContent = v === 1 ? "1, a unit: neither prime nor composite" : cells.comp[v] ? `${fmtInt(v)} = ${smallestFactor(v)} × ${fmtInt(v / smallestFactor(v))}${tag}` : `${fmtInt(v)}, prime${tag}`;
    draw();
  });
  canvas.addEventListener("pointerleave", () => { hover = -1; o.hover.textContent = "—"; draw(); });
  build();
}

// ============================================================ prime counting

// li(x) by Ramanujan's series; Li(x) = li(x) − li(2).
function li(x) {
  const L = Math.log(x);
  let sum = 0, term = 1;
  for (let n = 1; n < 200; n++) {
    term *= L / n;
    let s2 = 0;
    for (let k = 0; k <= (n - 1) >> 1; k++) s2 += 1 / (2 * k + 1);
    const t = ((n - 1) % 2 ? -1 : 1) * term / (2 ** (n - 1)) * s2;
    sum += t;
    if (Math.abs(t) < 1e-17 * Math.abs(sum)) break;
  }
  return 0.5772156649015329 + Math.log(L) + Math.sqrt(x) * sum;
}
const LI2 = li(2);
const Li = (x) => li(x) - LI2;

for (const root of document.querySelectorAll("[data-nt-pi]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let X = 10000, view = "count", table = null, hoverX = null;
  root.addEventListener("seg-change", (e) => {
    const v = e.detail.value;
    if (v === "count" || v === "ratio") view = v; else X = Number(v);
    hoverX = null;
    prepare();
  });

  // π at every multiple of 1000 (and every integer below 1000), so π(x)
  // for any x is a table lookup plus at most 1000 sieve reads.
  function prepare() {
    const t0 = performance.now();
    const comp = sieve(X);
    const blocks = new Int32Array(Math.floor(X / 1000) + 2);
    let c = 0;
    for (let i = 0; i <= X; i++) {
      if (i % 1000 === 0) blocks[i / 1000] = c;
      if (!comp[i]) c++;
    }
    table = { comp, blocks, ms: performance.now() - t0 };
    draw();
  }
  const pi = (x) => {
    x = Math.floor(x);
    const k = Math.floor(x / 1000);
    let c = table.blocks[k];
    for (let i = k * 1000; i <= x; i++) if (!table.comp[i]) c++;
    return c;
  };

  function draw() {
    clear(svg);
    const box = [62, 18, 556, 286];
    const n = 320;
    let f;
    if (view === "count") {
      const ymax = Li(X) * 1.04;
      const xt = [0, X / 4, X / 2, (3 * X) / 4, X];
      f = frame(svg, { box, x: [0, X], y: [0, ymax], xticks: xt, yticks: ticks(ymax), xfmt: short, yfmt: short, xlabel: "x", ylabel: "count" });
      const P = [], A = [], B = [];
      for (let i = 0; i <= n; i++) {
        const x = Math.max(2, (X * i) / n);
        P.push([f.sx(x), f.sy(pi(x))]);
        A.push([f.sx(x), f.sy(Li(x))]);
        B.push([f.sx(x), f.sy(x / Math.log(x))]);
      }
      polyline(svg, B, "stroke:var(--vec-v);stroke-width:1.5");
      polyline(svg, A, "stroke:var(--vec-u);stroke-width:1.5");
      polyline(svg, P, "stroke:var(--brand);stroke-width:2;stroke-linejoin:round");
    } else {
      // Ratios on a log x axis from 10 to X.
      const lx0 = 2, lx1 = Math.log10(X);
      const xt = []; for (let k = 2; k <= lx1; k++) xt.push(k);
      f = frame(svg, { box, x: [lx0, lx1], y: [0.8, 1.6], xticks: xt, yticks: [0.8, 1, 1.2, 1.4, 1.6], xfmt: (k) => "10" + sup(k), yfmt: (v) => v.toFixed(1), xlabel: "x (log scale)", ylabel: "ratio" });
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(1), y2: f.sy(1), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
      const A = [], B = [];
      for (let i = 0; i <= n; i++) {
        const lx = lx0 + ((lx1 - lx0) * i) / n, x = 10 ** lx, p = pi(x);
        A.push([f.sx(lx), f.sy(Li(x) / p)]);
        B.push([f.sx(lx), f.sy(Math.min(1.6, (p * Math.log(x)) / x))]);
      }
      polyline(svg, B, "stroke:var(--vec-v);stroke-width:1.5");
      polyline(svg, A, "stroke:var(--vec-u);stroke-width:1.5");
      text(svg, f.L + f.W - 4, f.sy(1.12) , "π · ln x / x → 1, slowly", { "text-anchor": "end", style: "fill:var(--vec-v)" });
      text(svg, f.L + f.W - 4, f.sy(1) - 6, "Li(x) / π(x)", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    }
    const x = hoverX ?? X;
    if (hoverX !== null) {
      const px = view === "count" ? f.sx(x) : f.sx(Math.log10(x));
      el("line", { x1: px, x2: px, y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, svg);
    }
    const p = pi(x);
    o.x.textContent = fmtInt(Math.floor(x));
    o.pi.textContent = fmtInt(p);
    o.xln.textContent = fmtInt(Math.round(x / Math.log(x))) + `  (${signed(x / Math.log(x) - p)})`;
    o.li.textContent = fmtInt(Math.round(Li(x))) + `  (${signed(Li(x) - p)})`;
    o.ratio.textContent = ((p * Math.log(x)) / x).toFixed(4);
    o.time.textContent = `${fmtInt(X)} in ${Math.max(1, Math.round(table.ms))} ms`;
    // The overlay that catches the pointer.
    const hit = el("rect", { x: f.L, y: f.T, width: f.W, height: f.H, style: "fill:transparent;cursor:crosshair" }, svg);
    hit.addEventListener("pointermove", (e) => {
      const [px] = svgPoint(svg, e);
      const t = Math.min(1, Math.max(0, (px - f.L) / f.W));
      hoverX = view === "count" ? Math.max(2, t * X) : 10 ** (2 + t * (Math.log10(X) - 2));
      draw();
    });
    hit.addEventListener("pointerleave", () => { hoverX = null; draw(); });
  }
  const signed = (v) => (v >= 0 ? "+" : "−") + fmtInt(Math.round(Math.abs(v)));
  prepare();
}


// ============================================================ Goldbach

for (const root of document.querySelectorAll("[data-nt-goldbach]")) {
  const svg = root.querySelector("[data-plot]");
  const list = root.querySelector("[data-list]");
  const o = outs(root);
  const LIMIT = 20000;
  const comp = sieve(LIMIT);
  const primes = [];
  for (let i = 2; i <= LIMIT; i++) if (!comp[i]) primes.push(i);
  // ways[n] for even n: pairs p ≤ q, both prime, p + q = n.
  const ways = new Int32Array(LIMIT + 1);
  for (let n = 4; n <= LIMIT; n += 2) {
    let w = 0;
    for (const p of primes) { if (p > n / 2) break; if (!comp[n - p]) w++; }
    ways[n] = w;
  }
  const s = scrubAll(root, (name) => { if (name === "max" && s.n.get() > s.max.get()) s.n.set(s.max.get(), false); draw(); });
  let f;

  function draw() {
    const max = Math.round(s.max.get());
    let n = Math.round(s.n.get());
    if (n % 2) n += 1;
    n = Math.max(4, Math.min(max, n));
    clear(svg);
    let ymax = 0;
    for (let k = 4; k <= max; k += 2) ymax = Math.max(ymax, ways[k]);
    ymax = Math.ceil(ymax * 1.08);
    const step = niceStep(ymax / 4);
    const yt = []; for (let v = 0; v <= ymax; v += step) yt.push(v);
    const xs = niceStep(max / 5);
    const xt = []; for (let v = 0; v <= max; v += xs) xt.push(v);
    f = frame(svg, { box: [52, 16, 566, 290], x: [0, max], y: [0, ymax], xticks: xt, yticks: yt, xfmt: short, ylabel: "ways", xlabel: "even n" });
    const r = max > 8000 ? 0.9 : max > 2000 ? 1.2 : 1.8;
    // Two paths, one per colour, keep the DOM small.
    let d3 = "", dOther = "";
    for (let k = 4; k <= max; k += 2) {
      const seg = `M${f.sx(k).toFixed(1)} ${f.sy(ways[k]).toFixed(1)}h0`;
      if (k % 3 === 0) d3 += seg; else dOther += seg;
    }
    el("path", { d: dOther, style: `stroke:var(--muted-foreground);stroke-opacity:0.7;stroke-width:${2 * r};stroke-linecap:round` }, svg);
    el("path", { d: d3, style: `stroke:var(--vec-u);stroke-width:${2 * r};stroke-linecap:round` }, svg);
    el("circle", { cx: f.sx(n), cy: f.sy(ways[n]), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    const hit = el("rect", { x: f.L, y: f.T, width: f.W, height: f.H, style: "fill:transparent;cursor:crosshair" }, svg);
    hit.addEventListener("click", (e) => {
      const [px, py] = svgPoint(svg, e);
      // Nearest even n to the click, in screen distance.
      const guess = Math.round(((px - f.L) / f.W) * max / 2) * 2;
      let best = guess, bd = Infinity;
      for (let k = Math.max(4, guess - 40); k <= Math.min(max, guess + 40); k += 2) {
        const d = Math.hypot(f.sx(k) - px, f.sy(ways[k]) - py);
        if (d < bd) { bd = d; best = k; }
      }
      s.n.set(best);
    });
    const pairs = [];
    for (const p of primes) { if (p > n / 2) break; if (!comp[n - p]) pairs.push(`${p} + ${n - p}`); }
    o.n.textContent = fmtInt(n) + (n % 3 === 0 ? "  (divisible by 3)" : "");
    o.ways.textContent = String(ways[n]);
    o.small.textContent = pairs.length ? pairs[0].split(" + ")[0] : "—";
    let lo = Infinity, at = 0;
    for (let k = Math.max(8, (max >> 2) << 1); k <= max; k += 2) if (ways[k] < lo) { lo = ways[k]; at = k; }
    o.min.textContent = `${lo} (n = ${fmtInt(at)})`;
    list.textContent = `${n} = ` + pairs.join(" = ");
  }
  draw();
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// ============================================================ continued fractions

const PI_CF = [3, 7, 15, 1, 292, 1, 1, 1, 2, 1, 3, 1, 14, 2, 1, 1, 2, 2, 2, 2, 1, 84, 2, 1, 1, 15, 3, 13, 1, 4];
// e = [2; 1, 2, 1, 1, 4, 1, 1, 6, …]
const E_CF = [2, ...Array.from({ length: 29 }, (_, i) => ((i % 3) === 1 ? 2 * ((i + 2) / 3) : 1))];

// √n exactly, by the m, d, a recurrence; periodic after a₀.
function sqrtCF(n, count) {
  const a0 = Math.floor(Math.sqrt(n));
  if (a0 * a0 === n) return { terms: [a0], period: 0 };
  const terms = [a0];
  let m = 0, d = 1, a = a0, period = 0;
  while (terms.length < count) {
    m = d * a - m;
    d = (n - m * m) / d;
    a = Math.floor((a0 + m) / d);
    terms.push(a);
    if (!period && a === 2 * a0) period = terms.length - 1;
  }
  return { terms, period };
}
function fracCF(p, q) {
  const terms = [];
  while (q) { terms.push(Math.floor(p / q)); [p, q] = [q, p % q]; }
  return terms;
}

for (const root of document.querySelectorAll("[data-nt-cf]")) {
  const svg = root.querySelector("[data-plot]");
  const exp = root.querySelector("[data-expansion]");
  const host = root.querySelector("[data-table]");
  const o = outs(root);
  let kind = "pi";
  const s = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });

  function source() {
    if (kind === "pi") return { name: "π", x: Math.PI, terms: PI_CF, note: "" };
    if (kind === "e") return { name: "e", x: Math.E, terms: E_CF, note: "" };
    if (kind === "phi") return { name: "φ", x: (1 + Math.sqrt(5)) / 2, terms: Array(30).fill(1), note: "" };
    if (kind === "sqrt") {
      const n = Math.round(s.n.get());
      const { terms, period } = sqrtCF(n, 30);
      return { name: `√${n}`, x: Math.sqrt(n), terms, period, exact: terms.length === 1 };
    }
    const p = Math.round(s.p.get()), q = Math.round(s.q.get());
    return { name: `${p}/${q}`, x: p / q, terms: fracCF(p, q), exact: true };
  }

  function draw() {
    for (const n of root.querySelectorAll("[data-needs]")) n.hidden = n.dataset.needs !== kind;
    const src = source();
    const K = Math.min(src.terms.length - 1, 14);
    let k = Math.min(Math.round(s.k.get()), K);
    // Convergents with BigInt: p_k = a_k p_{k−1} + p_{k−2}.
    const conv = [];
    let p2 = 0n, p1 = 1n, q2 = 1n, q1 = 0n;
    for (let i = 0; i <= K; i++) {
      const a = BigInt(src.terms[i]);
      const p = a * p1 + p2, q = a * q1 + q2;
      conv.push({ a: src.terms[i], p, q, v: Number(p) / Number(q) });
      [p2, p1, q2, q1] = [p1, p, q1, q];
    }
    // Past ~1e−15 the error is below what a double can show.
    while (k > 0 && Math.abs(conv[k].v - src.x) < 4e-16 && !(src.exact && k === K)) k--;
    if (k !== Math.round(s.k.get())) s.k.set(k, false);

    exp.replaceChildren();
    exp.append(node("span", "text-muted-foreground", `${src.name} = [`));
    const shown = src.terms.slice(0, Math.max(K + 1, Math.min(src.terms.length, 12)));
    shown.forEach((a, i) => {
      exp.append(node("span", i === k ? "rounded bg-brand/15 px-0.5 text-brand" : i > k ? "text-muted-foreground" : "", String(a)));
      if (i < shown.length - 1) exp.append(node("span", "text-muted-foreground", i === 0 ? "; " : ", "));
    });
    exp.append(node("span", "text-muted-foreground", src.exact ? "]" : ", …]"));
    if (src.period) exp.append(node("span", "ml-3 text-xs text-muted-foreground", `period ${src.period}`));

    const tbl = node("table", "w-full font-mono text-[11px] tabular-nums");
    const head = node("tr", "text-muted-foreground");
    for (const t of ["k", "aₖ", "pₖ / qₖ", "value", "error", "side"]) head.append(node("th", "sticky top-0 bg-background px-2 py-1 text-left font-normal", t));
    tbl.append(head);
    conv.forEach((c, i) => {
      const err = c.v - src.x;
      const tr = node("tr", "border-t " + (i === k ? "bg-brand/10 text-foreground" : i > k ? "text-muted-foreground/60" : ""));
      tr.append(node("td", "px-2 py-0.5", String(i)), node("td", "px-2 py-0.5", String(c.a)), node("td", "px-2 py-0.5", `${c.p}/${c.q}`),
        node("td", "px-2 py-0.5", c.v.toPrecision(12)), node("td", "px-2 py-0.5", Math.abs(err) < 4e-16 ? "0" : expo(err)),
        node("td", "px-2 py-0.5", Math.abs(err) < 4e-16 ? "exact" : err > 0 ? "above" : "below"));
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => { s.k.set(i); });
      tbl.append(tr);
    });
    host.replaceChildren(tbl);

    const c = conv[k], err = c.v - src.x;
    o.conv.textContent = `${c.p}/${c.q}`;
    o.err.textContent = Math.abs(err) < 4e-16 ? "0 (exact)" : expo(err);
    o.bound.textContent = expo(1 / Number(c.q) ** 2) + (Math.abs(err) <= 1 / Number(c.q) ** 2 ? "  ≥ |error|" : "");
    o.digits.textContent = Math.abs(err) < 4e-16 ? "all" : String(Math.max(0, Math.floor(-Math.log10(Math.abs(err)))));

    // The zooming number line.
    clear(svg);
    const L = 30, R = 610, Y = 78;
    const half = Math.max(Math.abs(err) * 2.6, k === 0 ? 1.2 : 1e-15, Math.abs(src.x) * 1e-14);
    const lo = src.x - half, hi = src.x + half;
    const X = (v) => L + ((v - lo) / (hi - lo)) * (R - L);
    el("line", { x1: L, x2: R, y1: Y, y2: Y, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    const st = niceStep((hi - lo) / 6);
    for (let t = Math.ceil(lo / st) * st; t <= hi; t += st) {
      el("line", { x1: X(t), x2: X(t), y1: Y - 4, y2: Y + 4, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    }
    text(svg, L, Y + 22, lo.toPrecision(Math.min(17, 4 + Math.max(0, -Math.floor(Math.log10(half))))), { "text-anchor": "start" });
    text(svg, R, Y + 22, hi.toPrecision(Math.min(17, 4 + Math.max(0, -Math.floor(Math.log10(half))))), { "text-anchor": "end" });
    el("line", { x1: X(src.x), x2: X(src.x), y1: Y - 30, y2: Y + 10, style: "stroke:var(--foreground);stroke-width:1.5" }, svg);
    text(svg, X(src.x), Y - 36, src.name, { "text-anchor": "middle", style: "fill:var(--foreground)", class: "font-mono text-[12px]" });
    conv.slice(0, k + 1).forEach((cv, i) => {
      if (cv.v < lo || cv.v > hi) return;
      const cur = i === k;
      el("circle", { cx: X(cv.v), cy: Y, r: cur ? 5.5 : 3.5, style: cur ? "fill:var(--brand)" : "fill:var(--muted-foreground);opacity:0.6" }, svg);
      if (cur || i === k - 1) text(svg, X(cv.v), cur ? Y + 40 : Y - 14, `${cv.p}/${cv.q}`, { "text-anchor": "middle", style: cur ? "fill:var(--brand)" : "", class: "font-mono text-[11px]" });
    });
    text(svg, 320, 142, `window ±${expo(half)}`, { "text-anchor": "middle" });
  }
  draw();
}

function expo(v) {
  const a = Math.abs(v);
  if (a === 0) return "0";
  const sign = v < 0 ? "−" : "";
  if (a >= 1e-3 && a < 1e4) return sign + a.toPrecision(3);
  const e = Math.floor(Math.log10(a));
  return `${sign}${(a / 10 ** e).toFixed(2)}×10${e < 0 ? "⁻" : ""}${sup(Math.abs(e))}`;
}

// ============================================================ Ford circles

for (const root of document.querySelectorAll("[data-nt-ford]")) {
  const svg = root.querySelector("[data-plot]");
  const seq = root.querySelector("[data-seq]");
  const tan = root.querySelector('[data-toggle="tangent"]');
  const o = outs(root);
  let picked = [1, 2];
  const s = scrubAll(root, () => draw());
  let showTan = true;
  tan.addEventListener("shadcn:checked-change", (e) => { showTan = e.detail.checked; draw(); });

  function farey(n) {
    // The next-term recurrence: a/b, c/d → (k c − a)/(k d − b).
    const out = [[0, 1]];
    let [a, b, c, d] = [0, 1, 1, n];
    while (c <= n) {
      const k = Math.floor((n + b) / d);
      [a, b, c, d] = [c, d, k * c - a, k * d - b];
      out.push([a, b]);
    }
    return out;
  }

  function draw() {
    const n = Math.round(s.n.get());
    const F = farey(n);
    let idx = F.findIndex(([p, q]) => p === picked[0] && q === picked[1]);
    if (idx < 0) { picked = F[Math.floor(F.length / 2)]; idx = Math.floor(F.length / 2); }
    clear(svg);
    const L = 20, S = 600, base = 330;
    const X = (v) => L + v * S;
    const nb = new Set([idx - 1, idx + 1]);
    // Labels, small denominators first, skipping any that would collide.
    const labelled = new Set(), placed = [];
    [...F.keys()].sort((i, j) => F[i][1] - F[j][1] || (i === idx ? -1 : 0)).forEach((i) => {
      const x = X(F[i][0] / F[i][1]), w = F[i][1] >= 10 ? 26 : 20;
      if (placed.every(([px, pw]) => Math.abs(px - x) > (pw + w) / 2 + 2)) { placed.push([x, w]); labelled.add(i); }
    });
    F.forEach(([p, q], i) => {
      const r = S / (2 * q * q);
      const isPick = i === idx, isNb = nb.has(i);
      const c = el("circle", {
        cx: X(p / q), cy: base - r, r,
        style: isPick ? "fill:var(--brand);fill-opacity:0.22;stroke:var(--brand);stroke-width:1.5"
          : isNb ? "fill:var(--vec-u);fill-opacity:0.14;stroke:var(--vec-u);stroke-width:1.2"
            : "fill:var(--foreground);fill-opacity:0.03;stroke:currentColor;stroke-opacity:0.45;stroke-width:0.8",
        tabindex: q <= 8 ? "0" : undefined, role: "button", "aria-label": `${p}/${q}`,
      }, svg);
      c.style.cursor = "pointer";
      c.addEventListener("click", () => { picked = [p, q]; draw(); });
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picked = [p, q]; draw(); } });
      if (labelled.has(i)) text(svg, X(p / q), base + 14, `${p}/${q}`, { "text-anchor": "middle", class: "font-mono " + (q <= 4 ? "text-[10px]" : "text-[8px]"), style: isPick ? "fill:var(--brand)" : "" });
    });
    if (showTan) {
      for (let i = 0; i + 1 < F.length; i++) {
        const [a, b] = F[i], [c, d] = F[i + 1];
        const r1 = S / (2 * b * b), r2 = S / (2 * d * d);
        const x1 = X(a / b), y1 = base - r1, x2 = X(c / d), y2 = base - r2;
        const t = r1 / (r1 + r2);
        el("circle", { cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t, r: 1.6, style: "fill:var(--foreground)" }, svg);
      }
    }
    el("line", { x1: L - 10, x2: L + S + 10, y1: base, y2: base, style: "stroke:currentColor;stroke-opacity:0.45" }, svg);

    const [p, q] = picked;
    const left = F[idx - 1], right = F[idx + 1];
    o.size.textContent = String(F.length);
    o.pick.textContent = `${p}/${q}, diameter 1/${q * q}`;
    o.nb.textContent = `${left ? left.join("/") : "—"}  and  ${right ? right.join("/") : "—"}`;
    const det = (u, v) => u[1] * v[0] - u[0] * v[1];
    o.det.textContent = [left && `${left.join("/")}: ${det(left, picked)}`, right && `${right.join("/")}: ${det(picked, right)}`].filter(Boolean).join(", ");
    o.med.textContent = right ? `${p + right[0]}/${q + right[1]} (enters F${sub(q + right[1])})` : left ? `${p + left[0]}/${q + left[1]} (enters F${sub(q + left[1])})` : "—";
    seq.textContent = `F${sub(n)} = ` + F.map((f) => f.join("/")).join(", ");
  }
  draw();
}

// ============================================================ times tables

for (const root of document.querySelectorAll("[data-nt-times]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const btn = root.querySelector('[data-action="play"]');
  const show = playButton(btn);
  show(false);
  const s = scrubAll(root, () => draw());
  let acc = 0;
  const lp = loop(root, (dt) => {
    if (reduced()) {
      acc += dt;
      if (acc < 400) return;
      acc = 0;
      step(0.1);
    } else step(dt * 0.00035);
  }, (p) => show(p));
  const step = (d) => { let t = s.t.get() + d; if (t > 100) t = 2; s.t.set(t, false); draw(); };
  btn.addEventListener("click", () => lp.set(!lp.playing));
  root.querySelector('[data-action="cardioid"]').addEventListener("click", () => { lp.set(false); s.t.set(2, false); s.m.set(200, false); draw(); });

  function draw() {
    const t = s.t.get(), m = Math.round(s.m.get());
    clear(svg);
    const R = 100;
    const pt = (x) => { const a = Math.PI + (2 * Math.PI * x) / m; return [R * Math.cos(a), -R * Math.sin(a)]; };
    el("circle", { cx: 0, cy: 0, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:0.3;stroke-width:0.6" }, svg);
    let d = "";
    for (let k = 0; k < m; k++) {
      const [x1, y1] = pt(k), [x2, y2] = pt(mod(k * t, m));
      d += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
    }
    el("path", { d, style: `fill:none;stroke:var(--brand);stroke-opacity:${m > 300 ? 0.35 : 0.55};stroke-width:${m > 300 ? 0.25 : 0.4}` }, svg);
    if (m <= 120) {
      let dots = "";
      for (let k = 0; k < m; k++) { const [x, y] = pt(k); dots += `M${x.toFixed(2)} ${y.toFixed(2)}h0`; }
      el("path", { d: dots, style: "stroke:var(--foreground);stroke-width:1.8;stroke-linecap:round" }, svg);
    }
    const ti = Math.round(t);
    const whole = Math.abs(t - ti) < 1e-9;
    o.t.textContent = t.toFixed(2);
    o.cusps.textContent = whole ? String(ti - 1) : "—";
    o.curve.textContent = whole ? (ti === 2 ? "cardioid" : ti === 3 ? "nephroid" : `epicycloid, ${ti - 1} cusps`) : "between two tables";
    o.fixed.textContent = whole ? String(mod(ti - 1, m) === 0 ? m : gcd(ti - 1, m)) : "—";
  }
  draw();
}

// ============================================================ CRT

function egcd(a, b) {
  // Returns [g, u, v] with a u + b v = g.
  if (!b) return [a, 1, 0];
  const [g, u, v] = egcd(b, a % b);
  return [g, v, u - Math.floor(a / b) * v];
}

for (const root of document.querySelectorAll("[data-nt-crt]")) {
  const host = root.querySelector("[data-grid]");
  const work = root.querySelector("[data-work]");
  const o = outs(root);
  const btn = root.querySelector('[data-action="play"]');
  const show = playButton(btn);
  let walk = -1, acc = 0;
  const s = scrubAll(root, () => { lp.set(false); draw(); });
  const lp = loop(root, (dt) => {
    acc += dt;
    if (acc < (reduced() ? 400 : 160)) return;
    acc = 0;
    const m = Math.round(s.m.get()), n = Math.round(s.n.get());
    walk++;
    draw();
    if (walk >= (m * n) / gcd(m, n) - 1) return false;
  }, (p) => { show(p, ["Walk 0, 1, 2, …", "Pause"]); if (!p && walk >= 0) { walk = -1; draw(); } });
  show(false, ["Walk 0, 1, 2, …", "Pause"]);
  btn.addEventListener("click", () => { if (lp.playing) lp.set(false); else { walk = 0; lp.set(true); draw(); } });
  root.querySelector('[data-action="random"]').addEventListener("click", () => {
    lp.set(false);
    const r = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const m = r(2, 12), n = r(2, 12);
    s.m.set(m, false); s.n.set(n, false); s.a.set(r(0, m - 1), false); s.b.set(r(0, n - 1), false);
    draw();
  });

  function draw() {
    const m = Math.round(s.m.get()), n = Math.round(s.n.get());
    const a = mod(Math.round(s.a.get()), m), b = mod(Math.round(s.b.get()), n);
    const [g, u, v] = egcd(m, n);
    const lcm = (m * n) / g;
    const cell = Array.from({ length: m }, () => Array(n).fill(-1));
    for (let x = 0; x < lcm; x++) cell[x % m][x % n] = x;
    let sol = -1;
    if ((b - a) % g === 0) {
      const t = mod(((b - a) / g) * u, n / g);
      sol = mod(a + m * t, lcm);
    }
    const tbl = node("table", "mx-auto my-4 border-separate border-spacing-1 font-mono text-[11px] tabular-nums");
    const head = node("tr");
    head.append(node("th", "px-1 text-[10px] font-normal whitespace-nowrap text-muted-foreground", "m ↓  n →"));
    for (let j = 0; j < n; j++) head.append(node("th", "min-w-7 px-1 font-normal " + (j === b ? "text-brand" : "text-muted-foreground"), String(j)));
    tbl.append(head);
    for (let i = 0; i < m; i++) {
      const tr = node("tr");
      tr.append(node("th", "px-1 text-right font-normal " + (i === a ? "text-brand" : "text-muted-foreground"), String(i)));
      for (let j = 0; j < n; j++) {
        const x = cell[i][j];
        const hidden = walk >= 0 && x > walk;
        const td = node("td", "h-8 min-w-8 rounded px-1 text-center text-xs transition-colors duration-150", x < 0 ? "·" : hidden ? "" : String(x));
        if (x < 0) td.className += " text-muted-foreground/40";
        else if (walk >= 0 && x === walk) td.className += " bg-brand text-background";
        else if (!hidden) td.className += " bg-muted/60";
        if (i === a && j === b) td.style.boxShadow = `inset 0 0 0 1.5px ${sol >= 0 ? "var(--brand)" : "var(--code-del)"}`;
        tr.append(td);
      }
      tbl.append(tr);
    }
    host.replaceChildren(tbl);
    o.gcd.textContent = String(g);
    o.x.textContent = sol >= 0 ? String(sol) : "none";
    o.all.textContent = sol >= 0 ? `x ≡ ${sol} (mod ${lcm})` : `${a} ≢ ${b} (mod ${g})`;
    o.reach.textContent = `${walk >= 0 ? Math.min(walk + 1, lcm) : lcm} of ${m * n}`;
    const sg = (k) => (k < 0 ? `(−${-k})` : String(k));
    work.replaceChildren(
      node("div", "", `Bézout: ${m}·${sg(u)} + ${n}·${sg(v)} = ${g}`),
      node("div", "", g === 1
        ? `x = a·n·v + b·m·u = ${a}·${n}·${sg(v)} + ${b}·${m}·${sg(u)} ≡ ${sol} (mod ${m * n})`
        : sol >= 0
          ? `gcd ${g} divides b − a = ${b - a}: one solution mod lcm = ${lcm}`
          : `gcd ${g} does not divide b − a = ${b - a}: no solution`),
      node("div", "", sol >= 0 ? `check: ${sol} mod ${m} = ${sol % m}, ${sol} mod ${n} = ${sol % n}` : `only ${lcm} of the ${m * n} cells are ever reached`),
    );
  }
  draw();
}

// ============================================================ quadratic residues

function powmod(b, e, m) {
  let r = 1n, x = BigInt(b) % BigInt(m), k = BigInt(e);
  const M = BigInt(m);
  while (k > 0n) { if (k & 1n) r = (r * x) % M; x = (x * x) % M; k >>= 1n; }
  return Number(r);
}
const legendre = (a, p) => { a = mod(a, p); if (!a) return 0; return powmod(a, (p - 1) / 2, p) === 1 ? 1 : -1; };

for (const root of document.querySelectorAll("[data-nt-qr]")) {
  const ring = root.querySelector("[data-ring]");
  const recip = root.querySelector("[data-recip]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const ODD = []; for (let p = 3; p <= 37; p++) if (isPrime(p)) ODD.push(p);

  function snap(v) {
    v = Math.round(v);
    for (let d = 0; d < 100; d++) { if (v - d >= 3 && isPrime(v - d)) return v - d; if (v + d <= 97 && isPrime(v + d)) return v + d; }
    return 3;
  }

  function draw() {
    const p = snap(s.p.get());
    if (p !== Math.round(s.p.get())) s.p.set(p, false);
    const a = mod(Math.round(s.a.get()), p);
    const res = new Set();
    for (let x = 1; x < p; x++) res.add((x * x) % p);
    clear(ring);
    const R = 92;
    const pt = (k, r = R) => { const t = -Math.PI / 2 + (2 * Math.PI * k) / p; return [r * Math.cos(t), r * Math.sin(t)]; };
    el("circle", { cx: 0, cy: 0, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:0.2" }, ring);
    // Chords x → x² for every x; the ones into a are highlighted.
    let d = "", dHot = "";
    for (let x = 1; x < p; x++) {
      const [x1, y1] = pt(x), [x2, y2] = pt((x * x) % p);
      const seg = `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
      if ((x * x) % p === a && a) dHot += seg; else d += seg;
    }
    el("path", { d, style: "fill:none;stroke:var(--vec-u);stroke-opacity:0.3;stroke-width:0.6" }, ring);
    el("path", { d: dHot, style: "fill:none;stroke:var(--brand);stroke-width:1.6" }, ring);
    const dotR = p > 60 ? 2.2 : p > 30 ? 3 : 4;
    for (let k = 0; k < p; k++) {
      const [x, y] = pt(k);
      const isRes = res.has(k);
      el("circle", {
        cx: x, cy: y, r: k === a ? dotR + 1.6 : dotR,
        style: k === 0 ? "fill:var(--muted-foreground)" : isRes ? `fill:var(--vec-u)${k === a ? ";stroke:var(--brand);stroke-width:1.5" : ""}` : `fill:var(--background);stroke:${k === a ? "var(--brand)" : "var(--muted-foreground)"};stroke-width:${k === a ? 1.5 : 0.8}`,
      }, ring);
      if (p <= 43) { const [lx, ly] = pt(k, R + 11); text(ring, lx, ly + 3, String(k), { "text-anchor": "middle", class: "font-mono text-[8px]", style: k === a ? "fill:var(--brand)" : "" }); }
    }

    const tbl = node("table", "border-separate border-spacing-0.5 font-mono text-[10px] tabular-nums");
    const head = node("tr");
    head.append(node("th", "px-1 font-normal whitespace-nowrap text-muted-foreground", "p \\ q"));
    for (const q of ODD) head.append(node("th", "min-w-6 px-0.5 font-normal " + (q === p ? "text-brand" : "text-muted-foreground"), String(q)));
    tbl.append(head);
    for (const r of ODD) {
      const tr = node("tr");
      tr.append(node("th", "px-1 text-right font-normal " + (r === p ? "text-brand" : "text-muted-foreground"), String(r)));
      for (const q of ODD) {
        if (q === r) { tr.append(node("td", "h-6 text-center text-muted-foreground/40", "·")); continue; }
        const v = legendre(r, q) * legendre(q, r);
        const td = node("td", "h-6 min-w-6 rounded text-center " + (v < 0 ? "bg-brand/20 text-brand" : "bg-muted/60 text-muted-foreground"), v < 0 ? "−" : "+");
        td.title = `(${r}/${q}) = ${legendre(r, q)}, (${q}/${r}) = ${legendre(q, r)}`;
        if (r === p || q === p) td.style.boxShadow = "inset 0 0 0 1px color-mix(in oklab, var(--foreground) 35%, transparent)";
        tr.append(td);
      }
      tbl.append(tr);
    }
    recip.replaceChildren(tbl);

    const sorted = [...res].sort((x, y) => x - y);
    o.p.textContent = `${p} ≡ ${p % 4} (mod 4)`;
    o.res.textContent = p <= 31 ? `${sorted.join(", ")}  (${sorted.length})` : `${sorted.length} = (p − 1)/2`;
    const e = a ? powmod(a, (p - 1) / 2, p) : 0;
    o.euler.textContent = a ? (e === 1 ? "1" : `${e} ≡ −1`) : "0";
    o.leg.textContent = String(legendre(a, p)).replace("-", "−");
    const roots = [];
    for (let x = 1; x <= (p - 1) / 2; x++) if ((x * x) % p === a) roots.push(x);
    o.roots.textContent = !a ? "0" : roots.length ? roots.map((x) => `±${x} (${x}, ${p - x})`).join(" ") : "none";
  }
  draw();
}

// ============================================================ Pythagorean triples

for (const root of document.querySelectorAll("[data-nt-pyth]")) {
  const svg = root.querySelector('[data-plot]:not([data-tri])');
  const tri = root.querySelector("[data-tri]");
  const o = outs(root);
  const s = scrubAll(root, (name) => {
    if (name === "n" && s.n.get() >= s.m.get()) s.m.set(s.n.get() + 1, false);
    if (name === "m" && s.n.get() >= s.m.get()) s.n.set(s.m.get() - 1, false);
    draw();
  });

  function draw() {
    const m = Math.round(s.m.get()), n = Math.round(s.n.get()), lim = Math.round(s.limit.get());
    clear(svg);
    const L = 34, T = 10, S = 356;
    const X = (v) => L + (v / lim) * S, Y = (v) => T + S - (v / lim) * S;
    el("rect", { x: L, y: T, width: S, height: S, style: "fill:none;stroke:currentColor;stroke-opacity:0.15" }, svg);
    for (const t of [0, lim / 2, lim]) {
      text(svg, X(t), T + S + 13, String(t), { "text-anchor": "middle" });
      text(svg, L - 5, Y(t) + 3, String(t), { "text-anchor": "end" });
    }
    text(svg, L + S, T + S + 24, "a", { "text-anchor": "end" });
    text(svg, L - 5, Y(lim * 0.75) + 3, "b", { "text-anchor": "end" });
    let count = 0, pcount = 0, rays = "", dots = "", pdots = "";
    for (let mm = 2; mm * mm - 1 <= lim * 2 && mm < 400; mm++) {
      for (let nn = 1; nn < mm; nn++) {
        if ((mm - nn) % 2 === 0 || gcd(mm, nn) !== 1) continue;
        const a = mm * mm - nn * nn, b = 2 * mm * nn;
        if (a > lim && b > lim) continue;
        if (Math.min(a, b) > lim) continue;
        for (const [x, y] of [[a, b], [b, a]]) {
          if (x > lim || y > lim) continue;
          const far = lim / Math.max(x, y);
          rays += `M${X(0)} ${Y(0)}L${X(x * far).toFixed(1)} ${Y(y * far).toFixed(1)}`;
          pdots += `M${X(x).toFixed(1)} ${Y(y).toFixed(1)}h0`;
          pcount++; count++;
          for (let k = 2; k * x <= lim && k * y <= lim; k++) { dots += `M${X(k * x).toFixed(1)} ${Y(k * y).toFixed(1)}h0`; count++; }
        }
      }
    }
    el("path", { d: rays, style: "stroke:var(--brand);stroke-opacity:0.08;stroke-width:0.6" }, svg);
    el("path", { d: dots, style: "stroke:var(--muted-foreground);stroke-opacity:0.7;stroke-width:3;stroke-linecap:round" }, svg);
    el("path", { d: pdots, style: "stroke:var(--brand);stroke-width:4.2;stroke-linecap:round" }, svg);

    const a = m * m - n * n, b = 2 * m * n, c = m * m + n * n;
    const g = gcd(gcd(a, b), c);
    if (a <= lim && b <= lim) {
      el("circle", { cx: X(a), cy: Y(b), r: 7, style: "fill:none;stroke:var(--foreground);stroke-width:1.5" }, svg);
    }
    const hit = el("rect", { x: L, y: T, width: S, height: S, style: "fill:transparent;cursor:crosshair" }, svg);
    hit.addEventListener("click", (e) => {
      const [px, py] = svgPoint(svg, e);
      // Nearest primitive triple to the click; load its m, n.
      let best = null, bd = 14;
      for (let mm = 2; mm * mm - 1 <= lim * 2 && mm < 400; mm++) for (let nn = 1; nn < mm; nn++) {
        if ((mm - nn) % 2 === 0 || gcd(mm, nn) !== 1) continue;
        const A = mm * mm - nn * nn, B = 2 * mm * nn;
        for (let k = 1; k * Math.max(A, B) <= lim * 1.0001 || (k === 1 && Math.min(A, B) <= lim); k++) {
          for (const [x, y] of [[k * A, k * B], [k * B, k * A]]) {
            if (x > lim || y > lim) continue;
            const d = Math.hypot(X(x) - px, Y(y) - py);
            if (d < bd) { bd = d; best = [mm, nn]; }
          }
          if (k > 200) break;
        }
      }
      if (best) { s.m.set(best[0], false); s.n.set(best[1], false); draw(); }
    });

    // The triangle itself.
    clear(tri);
    const sc = 200 / Math.max(a, b);
    const ox = 30, oy = 230;
    const A = [ox, oy], B = [ox + a * sc, oy], C = [ox + a * sc, oy - b * sc];
    el("path", { d: `M${A}L${B}L${C}Z`, style: "fill:var(--brand);fill-opacity:0.12;stroke:var(--brand);stroke-width:1.6;stroke-linejoin:round" }, tri);
    const q = Math.min(12, a * sc * 0.3, b * sc * 0.3);
    el("path", { d: `M${B[0] - q} ${B[1]}V${B[1] - q}H${B[0]}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.6" }, tri);
    text(tri, (A[0] + B[0]) / 2, oy + 16, `a = ${a}`, { "text-anchor": "middle", class: "font-mono text-[11px]" });
    text(tri, Math.min(B[0] + 6, 214), (B[1] + C[1]) / 2, `b = ${b}`, { "text-anchor": B[0] + 6 > 214 ? "end" : "start", class: "font-mono text-[11px]" });
    text(tri, (A[0] + C[0]) / 2 - 8, (A[1] + C[1]) / 2 - 6, `c = ${c}`, { "text-anchor": "end", class: "font-mono text-[11px]", style: "fill:var(--brand)" });

    o.abc.textContent = `(${a}, ${b}, ${c})`;
    o.prim.textContent = g === 1 ? "yes" : gcd(m, n) !== 1 ? `no: gcd(m, n) = ${gcd(m, n)}, divide by ${g}` : `no: m, n both odd, divide by ${g}`;
    o.check.textContent = `${a}² + ${b}² = ${a * a + b * b} = ${c}²`;
    o.count.textContent = String(count);
    o.pcount.textContent = String(pcount);
  }
  draw();
}

// ============================================================ Collatz

const log10Big = (v) => { const s = v.toString(); return s.length - 1 + Math.log10(Number(s.slice(0, 15)) / 10 ** (Math.min(15, s.length) - 1)); };
const bigShort = (v) => { const s = v.toString(); return s.length <= 15 ? fmtInt(s) : `${s[0]}.${s.slice(1, 4)}×10${sup(s.length - 1)}`; };

for (const root of document.querySelectorAll("[data-nt-collatz]")) {
  const orbitSvg = root.querySelector("[data-orbit]");
  const timesSvg = root.querySelector("[data-times]");
  const dots = root.querySelector("[data-dots]");
  const input = root.querySelector("[data-start]");
  const o = outs(root);
  let pal = palette(), steps = null, Ncur = 0, records = null;
  const s = scrubAll(root, () => scatter());
  onTheme(() => { pal = palette(); paintDots(); });
  new ResizeObserver(() => paintDots()).observe(timesSvg);
  input.addEventListener("input", () => orbit());

  // Stopping times for every start up to N, memoised (Numbers stay exact
  // here: peaks for starts below 10⁶ stay under 2⁴⁰).
  function stoppingTimes(N) {
    const t = new Uint16Array(N + 1);
    for (let n = 2; n <= N; n++) {
      let x = n, k = 0;
      while (x >= n) { x = x % 2 ? 3 * x + 1 : x / 2; k++; }
      t[n] = k + t[x];
    }
    return t;
  }

  function orbit() {
    const raw = input.value.trim().replace(/[\s_ ]/g, "");
    const ok = /^[1-9]\d{0,299}$/.test(raw);
    input.setAttribute("aria-invalid", String(!ok));
    if (!ok) return;
    let x = BigInt(raw);
    const start = x;
    const pts = [log10Big(x)];
    let peak = x, odd = 0;
    while (x !== 1n && pts.length < 200000) {
      if (x & 1n) { x = 3n * x + 1n; odd++; } else x >>= 1n;
      if (x > peak) peak = x;
      pts.push(log10Big(x));
    }
    clear(orbitSvg);
    const n = pts.length - 1;
    const ymax = Math.max(1, Math.ceil(Math.max(...pts)));
    const yt = []; for (let k = 0; k <= ymax; k += Math.max(1, Math.ceil(ymax / 4))) yt.push(k);
    const f = frame(orbitSvg, { box: [52, 14, 570, 172], x: [0, Math.max(1, n)], y: [0, ymax], xticks: ticks(n), yticks: yt, yfmt: (k) => "10" + sup(k), xlabel: "step" });
    const P = pts.map((v, i) => [f.sx(i), f.sy(v)]);
    polyline(orbitSvg, P, "stroke:var(--brand);stroke-width:1.5;stroke-linejoin:round");
    const pi = pts.indexOf(Math.max(...pts));
    el("circle", { cx: f.sx(pi), cy: f.sy(pts[pi]), r: 3.5, style: "fill:var(--brand)" }, orbitSvg);
    text(orbitSvg, f.sx(pi) + (pi > n * 0.7 ? -6 : 6), f.sy(pts[pi]) + 4, "peak " + bigShort(peak), { "text-anchor": pi > n * 0.7 ? "end" : "start", style: "fill:var(--brand)" });
    o.steps.textContent = fmtInt(n);
    o.peak.textContent = bigShort(peak);
    const ratio = log10Big(peak) - log10Big(start);
    o.ratio.textContent = ratio < 6 ? (10 ** ratio).toFixed(1) + "×" : "10" + sup(Math.floor(ratio)) + "×";
    o.odd.textContent = `${fmtInt(odd)} of ${fmtInt(n)}`;
    scatterMark(start);
  }

  let fT = null;
  function scatter() {
    const N = Math.round(s.N.get());
    if (!steps || steps.length <= N) steps = stoppingTimes(Math.max(N, 100000));
    Ncur = N;
    clear(timesSvg);
    let ymax = 0, rec = 1;
    for (let n = 1; n <= N; n++) if (steps[n] > ymax) { ymax = steps[n]; rec = n; }
    ymax = Math.ceil(ymax / 50) * 50;
    const yt = []; for (let v = 0; v <= ymax; v += niceStep(ymax / 4)) yt.push(v);
    fT = frame(timesSvg, { box: [52, 14, 570, 172], x: [1, N], y: [0, ymax], xticks: ticks(N), yticks: yt, xfmt: short, xlabel: "start" });
    o.record.textContent = `${fmtInt(rec)}: ${steps[rec]} steps`;
    const hit = el("rect", { x: fT.L, y: fT.T, width: fT.W, height: fT.H, style: "fill:transparent;cursor:crosshair" }, timesSvg);
    hit.addEventListener("click", (e) => {
      const [px, py] = svgPoint(timesSvg, e);
      const guess = Math.round(1 + ((px - fT.L) / fT.W) * (N - 1));
      let best = guess, bd = Infinity;
      const span = Math.max(3, Math.round(N / 300));
      for (let k = Math.max(1, guess - span); k <= Math.min(N, guess + span); k++) {
        const d = Math.hypot(fT.sx(k) - px, fT.sy(steps[k]) - py);
        if (d < bd) { bd = d; best = k; }
      }
      input.value = String(best);
      orbit();
    });
    paintDots();
    orbit();
  }

  function paintDots() {
    if (!fT) return;
    const ctx = fit(dots);
    const k = dots.width / 640;
    ctx.clearRect(0, 0, dots.width, dots.height);
    ctx.fillStyle = rgba(pal.u, Ncur > 30000 ? 0.45 : 0.7);
    const r = Math.max(1, (Ncur > 30000 ? 0.9 : 1.4) * k);
    for (let n = 1; n <= Ncur; n++) ctx.fillRect(fT.sx(n) * k - r / 2, fT.sy(steps[n]) * k - r / 2, r, r);
  }

  function scatterMark(start) {
    timesSvg.querySelector("[data-mark]")?.remove();
    if (!fT || start > BigInt(Ncur)) return;
    const n = Number(start);
    el("circle", { "data-mark": "", cx: fT.sx(n), cy: fT.sy(steps[n]), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5;pointer-events:none" }, timesSvg);
  }

  root.querySelector('[data-action="next"]').addEventListener("click", () => {
    if (!records) {
      // Starts whose orbit is longer than every smaller start's, below 10⁶.
      const t = stoppingTimes(1000000);
      records = [];
      let best = -1;
      for (let n = 1; n <= 1000000; n++) if (t[n] > best) { best = t[n]; records.push(n); }
    }
    const raw = input.value.trim();
    const cur = /^\d{1,15}$/.test(raw) ? Number(raw) : 0;
    const next = records.find((r) => r > cur) ?? records[0];
    input.value = String(next);
    if (next > Ncur && next <= 100000) s.N.set(Math.ceil(next / 100) * 100 * 1.25);
    orbit();
  });
  scatter();
}

function ticks(n) {
  const st = niceStep(Math.max(1, n) / 5);
  const out = [];
  for (let v = 0; v <= n; v += st) out.push(v);
  return out;
}
