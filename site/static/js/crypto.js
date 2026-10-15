// Number theory and cryptography blocks: the sieve, Euclid, clock
// arithmetic, square-and-multiply, RSA, Diffie–Hellman, Caesar/Vigenère
// with frequency analysis, and SHA-256's avalanche effect. Integer work that
// can overflow 2^53 uses BigInt.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const minus = (s) => String(s).replace("-", "−");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Extended Euclid on Numbers: rows of [q, r, s, t], with r = s·a + t·b. */
export function egcdRows(a, b) {
  const rows = [[null, a, 1, 0], [null, b, 0, 1]];
  while (rows.at(-1)[1] !== 0) {
    const [, r0, s0, t0] = rows.at(-2), [, r1, s1, t1] = rows.at(-1);
    const q = Math.floor(r0 / r1);
    rows.push([q, r0 - q * r1, s0 - q * s1, t0 - q * t1]);
  }
  return rows;
}
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return Math.abs(a); };
const inverse = (a, n) => {
  const rows = egcdRows(((a % n) + n) % n, n);
  const [, g, s] = rows.at(-2);
  return g === 1 ? ((s % n) + n) % n : null;
};
const isPrime = (n) => {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const modpow = (a, e, m) => {
  let r = 1n, b = BigInt(a) % BigInt(m), x = BigInt(e);
  const M = BigInt(m);
  while (x > 0n) {
    if (x & 1n) r = (r * b) % M;
    b = (b * b) % M;
    x >>= 1n;
  }
  return r;
};

function fillRows(tbody, rows) {
  tbody.innerHTML = rows
    .map((cells) => `<tr class="border-b last:border-b-0">${cells.map((c, i) => `<td class="px-3 py-1.5 ${i === 0 ? "text-left text-muted-foreground" : "text-right"}">${c}</td>`).join("")}</tr>`)
    .join("");
}

// ============================================================ Sieve

for (const root of document.querySelectorAll("[data-sieve]")) {
  const grid = root.querySelector("[data-grid]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const N = 200;
  const playBtn = root.querySelector("[data-action=play]");
  const cells = [];
  for (let i = 1; i <= N; i++) {
    const c = document.createElement("span");
    c.textContent = i;
    c.className = "flex h-6 items-center justify-center rounded-[4px] border border-transparent transition-[background-color,color,opacity] duration-200 data-[s=prime]:bg-brand data-[s=prime]:font-medium data-[s=prime]:text-white data-[s=hit]:bg-brand/15 data-[s=hit]:text-brand data-[s=crossed]:text-muted-foreground/40 data-[s=crossed]:line-through data-[s=one]:text-muted-foreground/40 motion-reduce:transition-none";
    grid.append(c);
    cells.push(c);
  }
  let crossed, primes, p, timer = 0;
  const set = (n, s) => (cells[n - 1].dataset.s = s);

  function reset() {
    crossed = new Uint8Array(N + 1);
    primes = [];
    p = 1;
    cells.forEach((c, i) => (c.dataset.s = i === 0 ? "one" : ""));
    o.step.textContent = "Press Step to cross out the multiples of 2.";
    o.found.textContent = "0";
    stop();
  }

  // One step: the next surviving number is prime; cross out its multiples
  // from p² (smaller ones were crossed by smaller primes).
  function step() {
    for (const c of cells) if (c.dataset.s === "hit") c.dataset.s = "crossed";
    do p++; while (p <= N && crossed[p]);
    if (p > N) return false;
    if (p * p > N) {
      // Every survivor left is prime.
      for (let k = p; k <= N; k++) if (!crossed[k]) { primes.push(k); set(k, "prime"); }
      o.step.textContent = `${p}² = ${p * p} > ${N}: every number still standing is prime. ${primes.length} primes up to ${N}.`;
      o.found.textContent = String(primes.length);
      p = N + 1;
      return false;
    }
    primes.push(p);
    set(p, "prime");
    const hits = [];
    for (let k = p * p; k <= N; k += p) if (!crossed[k]) { crossed[k] = 1; set(k, "hit"); hits.push(k); }
    o.step.textContent = `${p} is prime. Cross out ${hits.slice(0, 4).join(", ")}${hits.length > 4 ? ", …" : ""} (${hits.length} new).`;
    o.found.textContent = String(primes.length);
    return true;
  }

  const setPlay = (on) => {
    playBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    playBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    playBtn.querySelector("[data-label]").textContent = on ? "Pause" : "Run";
  };
  function stop() { clearInterval(timer); timer = 0; setPlay(false); }
  playBtn.querySelector("[data-label]").textContent = "Run";
  playBtn.addEventListener("click", () => {
    if (timer) return stop();
    if (p > N) reset();
    if (reduced()) { while (step()); return; }
    setPlay(true);
    timer = setInterval(() => { if (!step()) stop(); }, 700);
  });
  root.querySelector("[data-action=step]").addEventListener("click", () => { stop(); if (p > N) reset(); step(); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) stop(); }).observe(root);

  // π(x) against x/ln x and the logarithmic integral Li(x) = ∫₂ˣ dt/ln t.
  const s = scrubAll(root, plot);
  function plot() {
    const n = Math.max(100, Math.round(s.n.get()));
    const comp = new Uint8Array(n + 1);
    for (let i = 2; i * i <= n; i++) if (!comp[i]) for (let k = i * i; k <= n; k += i) comp[k] = 1;
    const S = 160, pi = [], approx = [], li = [];
    let count = 0, x = 1, Li = 0;
    for (let j = 1; j <= S; j++) {
      const target = Math.round((n * j) / S);
      for (x++; x <= target; x++) {
        if (!comp[x] && x >= 2) count++;
        if (x > 2) Li += 1 / Math.log(x - 0.5); // midpoint rule, step 1
      }
      x--;
      pi.push([target, count]); approx.push([target, target / Math.log(target)]); li.push([target, Li]);
    }
    svg.replaceChildren();
    const top = Math.max(count, Li) * 1.05;
    const f = frame(svg, { box: [52, 10, 510, 140], x: [0, n], y: [0, top], xticks: [0, n / 2, n], yticks: [0, Math.round(top / 2), Math.round(top)], xfmt: (v) => v.toLocaleString("en-US"), yfmt: (v) => v.toLocaleString("en-US") });
    polyline(svg, li.map(([a, b]) => [f.sx(a), f.sy(b)]), "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svg, approx.map(([a, b]) => [f.sx(a), f.sy(b)]), "stroke:var(--muted-foreground);stroke-width:1.25");
    polyline(svg, pi.map(([a, b]) => [f.sx(a), f.sy(b)]), "stroke:var(--brand);stroke-width:1.75");
    text(svg, 60, 22, "π(x)", { style: "fill:var(--brand)" });
    text(svg, 100, 22, "x / ln x");
    text(svg, 160, 22, "Li(x)", { style: "fill:var(--vec-u)" });
    o.pi.textContent = count.toLocaleString("en-US");
    o.approx.textContent = Math.round(n / Math.log(n)).toLocaleString("en-US");
    o.ratio.textContent = num(count / (n / Math.log(n)), 4);
  }
  reset();
  plot();
}

// ============================================================ Euclid

for (const root of document.querySelectorAll("[data-euclid]")) {
  const o = outs(root);
  const tbody = root.querySelector("[data-rows]");
  const s = scrubAll(root, draw);
  function draw() {
    const a = Math.round(s.a.get()), b = Math.round(s.b.get());
    const rows = egcdRows(a, b);
    fillRows(tbody, rows.map(([q, r, si, ti], i) => [i, q ?? "", r.toLocaleString("en-US"), minus(si), minus(ti)]));
    const [, g, x, y] = rows.at(-2);
    o.result.innerHTML = `gcd(${a}, ${b}) = <span class="text-brand">${g}</span> = ${minus(x)}·${a} ${y < 0 ? "−" : "+"} ${Math.abs(y)}·${b}`;
  }
  draw();
}

// ============================================================ Clock arithmetic

for (const root of document.querySelectorAll("[data-modular]")) {
  const svg = root.querySelector("[data-clock]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  function draw() {
    const n = Math.round(s.n.get());
    const k = ((Math.round(s.k.get()) % n) + n) % n;
    const units = [...Array(n).keys()].filter((a) => gcd(a, n) === 1);
    const pos = (i, r = 92) => [r * Math.sin((2 * Math.PI * i) / n), -r * Math.cos((2 * Math.PI * i) / n)];
    svg.replaceChildren();
    el("circle", { cx: 0, cy: 0, r: 92, style: "fill:none;stroke:currentColor;stroke-opacity:0.15" }, svg);
    // Walk 0, k, 2k, … until it comes back to 0.
    const walk = [0];
    for (let x = k % n; x !== 0 && walk.length <= n; x = (x + k) % n) walk.push(x);
    if (k !== 0) el("polygon", { points: walk.map((i) => pos(i).join(",")).join(" "), style: "fill:var(--brand);fill-opacity:0.07;stroke:var(--brand);stroke-width:1.5;stroke-linejoin:round" }, svg);
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(i);
      const on = walk.includes(i) && k !== 0;
      el("circle", { cx: x, cy: y, r: 4, style: on ? "fill:var(--brand)" : "fill:var(--background);stroke:currentColor;stroke-opacity:0.4" }, svg);
      const [lx, ly] = pos(i, 108);
      text(svg, lx, ly + 3.5, String(i), { "text-anchor": "middle", class: units.includes(i) ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    }

    let html = `<table class="mx-auto border-separate border-spacing-px"><thead><tr><th class="px-1 text-muted-foreground">×</th>`;
    for (let b = 0; b < n; b++) html += `<th class="px-1 font-normal text-muted-foreground">${b}</th>`;
    html += "</tr></thead><tbody>";
    for (let a = 0; a < n; a++) {
      const unit = units.includes(a);
      html += `<tr><th class="px-1 font-normal ${unit ? "text-brand" : "text-muted-foreground"}">${a}</th>`;
      for (let b = 0; b < n; b++) {
        const v = (a * b) % n;
        const cls = v === 1 ? "bg-brand text-white" : unit ? "bg-brand/10" : "";
        html += `<td class="min-w-5 rounded-[3px] px-1 text-center ${cls}">${v}</td>`;
      }
      html += "</tr>";
    }
    table.innerHTML = html + "</tbody></table>";
    const g = gcd(k, n), inv = inverse(k, n);
    o.gcd.textContent = String(g);
    o.inv.textContent = inv === null ? "none (gcd ≠ 1)" : String(inv);
    o.phi.textContent = String(units.length);
    o.units.textContent = units.join(", ");
  }
  draw();
}

// ============================================================ Square and multiply

for (const root of document.querySelectorAll("[data-modpow]")) {
  const o = outs(root);
  const tbody = root.querySelector("[data-rows]");
  const s = scrubAll(root, draw);
  function draw() {
    const a = BigInt(Math.round(s.base.get())), e = Math.round(s.exp.get()), m = BigInt(Math.round(s.mod.get()));
    const bits = e.toString(2);
    o.bits.textContent = `${e.toLocaleString("en-US")} = ${bits}₂ · ${bits.length} bits`;
    const rows = [];
    let r = 1n, mults = 0;
    for (const bit of bits) {
      r = (r * r) % m; mults++;
      rows.push([bit, "square", r.toString()]);
      if (bit === "1") {
        r = (r * (a % m)) % m; mults++;
        rows.push(["", `× ${a}`, r.toString()]);
      }
    }
    fillRows(tbody, rows.map(([b, op, v]) => [b ? `<span class="${b === "1" ? "text-brand" : ""}">${b}</span>` : "", op, v]));
    const check = modpow(a, e, m);
    let note = "";
    const M = Number(m);
    if (check === 1n && e === M - 1 && !isPrime(M) && gcd(Number(a), M) === 1)
      note = ` · ${M} is not prime, yet a^(m−1) ≡ 1: a Fermat liar${M === 561 ? " (561 = 3·11·17 is the smallest Carmichael number)" : ""}.`;
    o.result.innerHTML = `${a}<sup>${e}</sup> mod ${m} = <span class="text-brand">${check}</span> · ${mults} multiplications instead of ${Math.max(0, e - 1).toLocaleString("en-US")}${esc(note)}`;
  }
  draw();
}

// ============================================================ RSA

for (const root of document.querySelectorAll("[data-rsa]")) {
  const o = outs(root);
  const s = scrubAll(root, draw);
  let key = null;
  function draw() {
    const p = Math.round(s.p.get()), q = Math.round(s.q.get()), e = Math.round(s.e.get()), m = Math.round(s.m.get());
    const n = p * q, phi = (p - 1) * (q - 1);
    let err = "";
    if (!isPrime(p) || !isPrime(q)) err = `${!isPrime(p) ? p : q} is not prime.`;
    else if (p === q) err = "p and q must be different.";
    else if (gcd(e, phi) !== 1 || e >= phi) err = `e must be smaller than φ(n) and share no factor with it (gcd(${e}, ${phi}) = ${gcd(e, phi)}).`;
    o.keyerr.textContent = err;
    o.n.textContent = n.toLocaleString("en-US");
    o.phi.textContent = phi.toLocaleString("en-US");
    for (const k of ["fp", "tries", "fd"]) o[k].textContent = "—";
    o.verdict.textContent = "";
    if (err) {
      key = null;
      for (const k of ["d", "c", "back"]) o[k].textContent = "—";
      o.check.textContent = "";
      return;
    }
    const d = inverse(e, phi);
    key = { n, e, d };
    o.d.textContent = d.toLocaleString("en-US");
    if (m >= n) {
      o.c.textContent = o.back.textContent = "—";
      o.check.className = "min-h-4 text-xs text-del";
      o.check.textContent = `m must be smaller than n = ${n}.`;
      return;
    }
    const c = modpow(m, e, n), back = modpow(c, d, n);
    o.c.textContent = c.toLocaleString("en-US");
    o.back.textContent = back.toLocaleString("en-US");
    o.check.className = "min-h-4 text-xs " + (back === BigInt(m) ? "text-add" : "text-del");
    o.check.textContent = back === BigInt(m) ? `✓ decrypts back to m = ${m}` : "✗ mismatch";
  }
  root.querySelector("[data-action=factor]").addEventListener("click", () => {
    if (!key) return;
    let tries = 0, f = 0;
    for (let k = 2; k * k <= key.n; k++) { tries++; if (key.n % k === 0) { f = k; break; } }
    const phi = (f - 1) * (key.n / f - 1);
    o.fp.textContent = `${f} (and ${key.n / f})`;
    o.tries.textContent = tries.toLocaleString("en-US");
    o.fd.textContent = String(inverse(key.e, phi));
    o.verdict.textContent = `n has ${String(key.n).length} digits, so trial division took ${tries} steps. Real moduli have 617 digits (2048 bits); the largest RSA challenge number factored so far, RSA-250 (829 bits), took about 2,700 core-years in 2020.`;
  });
  draw();
}

// ============================================================ Diffie–Hellman

for (const root of document.querySelectorAll("[data-dh]")) {
  const o = outs(root);
  const sw = Object.fromEntries([...root.querySelectorAll("[data-swatch]")].map((n) => [n.dataset.swatch, n]));
  // The paint: a shared yellow; Alice's secret pink, Bob's secret blue.
  // Mixing in thirds makes both final mixes exactly the same paint.
  const C = "var(--vec-out)", A = "var(--brand)", B = "var(--vec-u)";
  const mix = (x, y) => `color-mix(in oklab, ${x}, ${y})`;
  const third = (pair, c) => `color-mix(in oklab, ${pair} 66.667%, ${c})`;
  sw.common.style.background = C;
  sw["a-secret"].style.background = A;
  sw["b-secret"].style.background = B;
  sw["a-public"].style.background = mix(C, A);
  sw["b-public"].style.background = mix(C, B);
  sw.shared.style.background = third(mix(C, B), A);

  const s = scrubAll(root, draw);
  function draw() {
    const p = Math.round(s.p.get()), g = Math.round(s.g.get()), a = Math.round(s.a.get()), b = Math.round(s.b.get());
    const Apub = modpow(g, a, p), Bpub = modpow(g, b, p);
    o["a-pub"].textContent = Apub.toString();
    o["b-pub"].textContent = Bpub.toString();
    o["a-shared"].textContent = modpow(Bpub, a, p).toString();
    o["b-shared"].textContent = modpow(Apub, b, p).toString();
    let note;
    if (!isPrime(p)) note = `p = ${p} is not prime; Diffie–Hellman needs a prime modulus.`;
    else {
      // Order of g in (Z/pZ)*: g is a generator when its order is p − 1.
      let ord = 1, x = g % p;
      if (x === 0) note = "g must not be a multiple of p.";
      else {
        for (let y = x; y !== 1 && ord < p; ord++) y = (y * x) % p;
        note = ord === p - 1 ? `g = ${g} generates all ${p - 1} non-zero residues mod ${p}.` : `g = ${g} has order ${ord} mod ${p}, not ${p - 1}: fewer possible secrets.`;
      }
    }
    o.gnote.textContent = note;
  }
  draw();
}

// ============================================================ Caesar / Vigenère

for (const root of document.querySelectorAll("[data-vigenere]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const plain = root.querySelector('[data-text="plain"]');
  const keyIn = root.querySelector('[data-text="key"]');
  const english = JSON.parse(root.querySelector("template[data-english]").dataset.freq.replaceAll(" ", ","));
  let mode = "caesar";

  const shifts = () => {
    const k = keyIn.value.trim();
    if (mode === "caesar") {
      const n = /^-?\d+$/.test(k) ? Number(k) : k ? k.toUpperCase().charCodeAt(0) - 65 : 0;
      return [((n % 26) + 26) % 26];
    }
    const letters = k.toUpperCase().replace(/[^A-Z]/g, "");
    return letters ? [...letters].map((c) => c.charCodeAt(0) - 65) : [0];
  };
  // Letters advance through the key; everything else passes through.
  const encrypt = (t, ks, sign = 1) => {
    let i = 0;
    return t.replace(/[a-z]/gi, (c) => {
      const base = c <= "Z" ? 65 : 97;
      const sft = ks[i++ % ks.length] * sign;
      return String.fromCharCode(((c.charCodeAt(0) - base + sft + 26 * 26) % 26) + base);
    });
  };
  const freq = (t) => {
    const n = new Array(26).fill(0);
    let total = 0;
    for (const c of t.toUpperCase()) { const k = c.charCodeAt(0) - 65; if (k >= 0 && k < 26) { n[k]++; total++; } }
    return { pct: n.map((v) => (total ? (100 * v) / total : 0)), n, total };
  };

  let cipher = "";
  function draw() {
    cipher = encrypt(plain.value, shifts());
    o.cipher.textContent = cipher || "—";
    const { pct, n, total } = freq(cipher);
    svg.replaceChildren();
    const top = Math.max(14, ...pct);
    const f = frame(svg, { box: [30, 10, 480, 170], x: [0, 26], y: [0, top], yticks: [0, 5, 10], xticks: [], yfmt: (v) => `${v}%` });
    for (let i = 0; i < 26; i++) {
      const x0 = f.sx(i);
      const w = (f.sx(1) - f.sx(0)) / 2 - 1;
      el("rect", { x: x0 + 1, y: f.sy(pct[i]), width: w, height: f.T + f.H - f.sy(pct[i]), style: "fill:var(--brand);fill-opacity:0.8" }, svg);
      el("rect", { x: x0 + 1 + w, y: f.sy(english[i]), width: w, height: f.T + f.H - f.sy(english[i]), style: "fill:var(--vec-u);fill-opacity:0.45" }, svg);
      text(svg, x0 + w + 1, f.T + f.H + 13, String.fromCharCode(65 + i), { "text-anchor": "middle" });
    }
    // Index of coincidence: ≈ 0.067 for English text, 0.0385 for uniform letters.
    const ic = total > 1 ? n.reduce((s, v) => s + v * (v - 1), 0) / (total * (total - 1)) : 0;
    o.crack.textContent = `index of coincidence ${num(ic, 4)}`;
  }
  root.querySelector("[data-action=crack]").addEventListener("click", () => {
    const { pct } = freq(cipher);
    let best = 0, bestChi = Infinity;
    for (let sft = 0; sft < 26; sft++) {
      let chi = 0;
      for (let i = 0; i < 26; i++) { const e = english[i]; chi += (pct[(i + sft) % 26] - e) ** 2 / e; }
      if (chi < bestChi) { bestChi = chi; best = sft; }
    }
    const preview = encrypt(cipher.slice(0, 40), [best], -1);
    o.crack.innerHTML = mode === "caesar"
      ? `best shift <span class="text-brand">${best}</span> (χ² ${num(bestChi, 1)}) → “${esc(preview)}…”`
      : `no single shift fits (best χ² ${num(bestChi, 1)}): a Vigenère key needs Kasiski's method or the index of coincidence first.`;
  });
  root.addEventListener("seg-change", (e) => {
    mode = e.detail.value;
    if (mode === "vigenere" && /^-?\d*$/.test(keyIn.value.trim())) keyIn.value = "LEMON";
    if (mode === "caesar" && /[a-z]{2,}/i.test(keyIn.value)) keyIn.value = "3";
    draw();
  });
  plain.addEventListener("input", draw);
  keyIn.addEventListener("input", draw);
  draw();
}

// ============================================================ SHA-256 avalanche

for (const root of document.querySelectorAll("[data-hash]")) {
  const o = outs(root);
  const ins = { a: root.querySelector('[data-text="a"]'), b: root.querySelector('[data-text="b"]') };
  const grid = root.querySelector("[data-bits]");
  const cells = Array.from({ length: 256 }, () => {
    const c = document.createElement("span");
    c.className = "aspect-square bg-background transition-colors duration-150 data-[b=one]:bg-foreground/15 data-[d]:!bg-brand motion-reduce:transition-none";
    grid.append(c);
    return c;
  });
  const bitsOf = (buf) => [...new Uint8Array(buf)].flatMap((byte) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => (byte >> k) & 1));
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  async function draw() {
    if (!crypto?.subtle) {
      o.diff.textContent = "Web Crypto needs a secure context (https or localhost).";
      return;
    }
    const enc = new TextEncoder();
    const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(ins.a.value)), crypto.subtle.digest("SHA-256", enc.encode(ins.b.value))]);
    o["hex-a"].textContent = hex(ha);
    o["hex-b"].textContent = hex(hb);
    const A = bitsOf(ha), B = bitsOf(hb);
    let d = 0;
    cells.forEach((c, i) => {
      c.dataset.b = A[i] ? "one" : "zero";
      if (A[i] !== B[i]) { c.dataset.d = ""; d++; } else delete c.dataset.d;
    });
    o.diff.textContent = `${d} of 256 (${num((100 * d) / 256, 1)}%)`;
  }
  for (const i of Object.values(ins)) i.addEventListener("input", draw);
  draw();
}
