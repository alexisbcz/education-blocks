// Modern cryptography, part two: Shamir's secret sharing, a zero-knowledge
// proof of a graph 3-colouring, PBKDF2 key stretching timed in the page, a
// toy learning-with-errors scheme and the TLS 1.3 handshake.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";
import { hex, utf8, concat, rng, sha256, outs, onSeg, mk, act } from "./moderncrypto-core.js";

const mod = (a, p) => ((a % p) + p) % p;
function inv(a, p) {
  // Fermat: a^(p−2) mod p for prime p.
  let r = 1, b = mod(a, p), e = p - 2;
  while (e > 0) { if (e & 1) r = (r * b) % p; b = (b * b) % p; e >>= 1; }
  return r;
}
/** Lagrange interpolation mod p of the points, evaluated at x. */
function lagrange(points, x, p) {
  let sum = 0;
  for (let j = 0; j < points.length; j++) {
    let num = 1, den = 1;
    for (let m = 0; m < points.length; m++) if (m !== j) {
      num = (num * mod(x - points[m][0], p)) % p;
      den = (den * mod(points[j][0] - points[m][0], p)) % p;
    }
    sum = (sum + points[j][1] * num % p * inv(den, p)) % p;
  }
  return sum;
}

// ============================================================ 6. Shamir

for (const root of document.querySelectorAll("[data-mc-shamir]")) {
  const P = 97;
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  const shareBox = root.querySelector("[data-shares]");
  let seed = 7, coeffs = [], selected = new Set();
  const f = scrubAll(root, (name) => { if (name !== "secret") selected.clear(); build(); });

  function build() {
    const k = Math.round(f.k.get()), n = Math.max(k, Math.round(f.n.get()));
    if (n !== Math.round(f.n.get())) f.n.set(n, false);
    const r = rng(seed);
    coeffs = [Math.round(f.secret.get())];
    for (let i = 1; i < k; i++) coeffs.push(1 + Math.floor(r() * (P - 1)));
    if (selected.size === 0) for (let x = 1; x <= k; x++) selected.add(x);
    for (const x of [...selected]) if (x > n) selected.delete(x);
    shareBox.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const x = i + 1;
      const b = mk("button", "h-7 rounded-md border px-2 font-mono text-xs outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10", `(${x}, ${evalPoly(x)})`);
      b.type = "button";
      b.setAttribute("aria-pressed", String(selected.has(x)));
      b.addEventListener("click", () => { selected.has(x) ? selected.delete(x) : selected.add(x); build(); shareBox.children[i]?.focus(); });
      return b;
    }));
    draw(k, n);
  }
  const evalPoly = (x) => coeffs.reduceRight((acc, c) => (acc * x + c) % P, 0);

  function draw(k, n) {
    svg.replaceChildren();
    const xmax = n + 1;
    const fr = frame(svg, { box: [44, 20, 576, 280], x: [-0.5, xmax + 0.5], y: [0, P - 1], xticks: Array.from({ length: xmax + 1 }, (_, i) => i), yticks: [0, 24, 48, 72, 96], xlabel: "x (share index; the secret sits at x = 0)", ylabel: "f(x) mod 97" });
    const pts = [...selected].sort((a, b) => a - b).map((x) => [x, evalPoly(x)]);
    const enough = pts.length >= k;
    // Other polynomials through the held shares, one per secret they leave open.
    if (!enough) {
      for (let s = 0; s < P; s += 1) {
        const alt = [[0, s], ...pts];
        const show = s % 12 === 3;
        el("circle", { cx: fr.sx(0), cy: fr.sy(s), r: 2, style: "fill:currentColor;fill-opacity:0.18" }, svg);
        if (show && s !== coeffs[0]) {
          const line = Array.from({ length: xmax + 1 }, (_, x) => [fr.sx(x), fr.sy(lagrange(alt, x, P))]);
          polyline(svg, line, "stroke:currentColor;stroke-opacity:0.12;stroke-width:1;stroke-dasharray:3 3");
          line.forEach(([cx, cy]) => el("circle", { cx, cy, r: 2.5, style: "fill:currentColor;fill-opacity:0.25" }, svg));
        }
      }
    }
    // The true polynomial's values at every integer x.
    const truth = Array.from({ length: xmax + 1 }, (_, x) => [fr.sx(x), fr.sy(evalPoly(x))]);
    polyline(svg, truth, "stroke:var(--vec-u);stroke-opacity:0.35;stroke-width:1.25");
    for (let x = 1; x <= n; x++) {
      const held = selected.has(x);
      el("circle", { cx: fr.sx(x), cy: fr.sy(evalPoly(x)), r: held ? 6 : 4, style: held ? "fill:var(--vec-u)" : "fill:var(--background);stroke:var(--vec-u);stroke-width:1.5" }, svg);
    }
    const rec = enough ? lagrange(pts, 0, P) : null;
    if (enough) {
      el("circle", { cx: fr.sx(0), cy: fr.sy(rec), r: 7, style: "fill:var(--brand)" }, svg);
      text(svg, fr.sx(0) + 12, fr.sy(rec) + 4, `secret ${rec}`, { class: "fill-foreground font-mono text-[11px]" });
    }
    o.field.textContent = `ℤ/97, degree ${k - 1}`;
    o.rec.textContent = enough ? `${rec} from ${pts.length} share${pts.length > 1 ? "s" : ""}` : `needs ${k}, have ${pts.length}`;
    o.possible.textContent = enough ? "1" : "all 97";
  }
  act(root, "reshare", () => { seed = (seed * 1103515245 + 12345) >>> 0; build(); });
  build();
}

// ============================================================ 7. ZKP

for (const root of document.querySelectorAll("[data-mc-zkp]")) {
  const o = outs(root);
  const gsvg = root.querySelector("[data-graph]"), psvg = root.querySelector("[data-plot]");
  const log = root.querySelector("[data-log]");
  // A triangular prism: 6 vertices, 9 edges, 3-colourable.
  const V = [[60, 40], [260, 40], [160, 92], [60, 214], [260, 214], [160, 162]];
  const E = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
  const GOOD = [0, 1, 2, 1, 2, 0];
  const BAD = [0, 1, 2, 1, 0, 0]; // edge 4–5 is monochromatic: the cheater has no valid colouring
  const COL = ["var(--vec-u)", "var(--vec-v)", "var(--vec-out)"];
  let mode = "honest", passed = 0, caught = 0, rounds = [], last = null, r = rng(11);

  onSeg(root, (v) => { mode = v; reset(); });

  function round() {
    const base = mode === "honest" ? GOOD : BAD;
    const perm = [0, 1, 2].sort(() => r() - 0.5);
    const colours = base.map((c) => perm[c]);
    const nonces = colours.map(() => Array.from({ length: 8 }, () => Math.floor(r() * 256)));
    const commits = colours.map((c, v) => hex(sha256(concat(utf8(`${v}:${c}:`), Uint8Array.from(nonces[v])))));
    const e = Math.floor(r() * E.length);
    const [a, b] = E[e];
    // The verifier re-hashes the openings and checks them against the commitments.
    const opensOk = [a, b].every((v) => hex(sha256(concat(utf8(`${v}:${colours[v]}:`), Uint8Array.from(nonces[v])))) === commits[v]);
    const ok = opensOk && colours[a] !== colours[b];
    ok ? passed++ : caught++;
    rounds.push(ok);
    last = { colours, commits, edge: e };
    const li = mk("li", "", `#${rounds.length}  open edge ${a}–${b}: ${["A", "B", "C"][colours[a]]}, ${["A", "B", "C"][colours[b]]}  ${ok ? "✓" : "✗ same colour, caught"}  commit ${commits[a].slice(0, 8)}…`);
    if (!ok) li.style.color = "var(--code-del)";
    log.prepend(li);
    while (log.children.length > 60) log.lastChild.remove();
  }

  function drawGraph() {
    gsvg.replaceChildren();
    E.forEach(([a, b], i) => {
      const open = last && last.edge === i;
      el("line", { x1: V[a][0], y1: V[a][1], x2: V[b][0], y2: V[b][1], style: open ? "stroke:var(--brand);stroke-width:4" : "stroke:currentColor;stroke-opacity:0.3;stroke-width:1.5" }, gsvg);
    });
    V.forEach(([x, y], v) => {
      const open = last && E[last.edge].includes(v);
      el("circle", { cx: x, cy: y, r: 15, style: open ? `fill:${COL[last.colours[v]]};stroke:var(--foreground);stroke-width:1.5` : "fill:var(--background);stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5" }, gsvg);
      text(gsvg, x, y + 4, open ? ["A", "B", "C"][last.colours[v]] : "?", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      text(gsvg, x + (x < 160 ? -22 : x > 160 ? 22 : 24), y + (x === 160 ? 4 : -14), String(v), { "text-anchor": "middle" });
    });
    text(gsvg, 8, 250, last ? "Only the opened edge's colours are revealed; the rest stay committed." : "Run a round: every vertex is committed, one edge is opened.", { class: "fill-muted-foreground text-[10px]" });
  }

  function drawPlot() {
    psvg.replaceChildren();
    const N = 50;
    const fr = frame(psvg, { box: [40, 20, 268, 200], x: [0, N], y: [0, 1], xticks: [0, 10, 20, 30, 40, 50], yticks: [0, 0.25, 0.5, 0.75, 1], xlabel: "rounds", ylabel: "P(cheater survives)" });
    const th = Array.from({ length: N + 1 }, (_, n) => [fr.sx(n), fr.sy((1 - 1 / E.length) ** n)]);
    polyline(psvg, th, "stroke:var(--code-del);stroke-width:1.75");
    text(psvg, fr.sx(N) - 2, fr.sy((1 - 1 / E.length) ** N) - 6, "(1 − 1/9)ⁿ", { "text-anchor": "end" });
    // This run: still passing after n rounds?
    let alive = true;
    const pts = [[fr.sx(0), fr.sy(1)]];
    rounds.slice(0, N).forEach((ok, i) => { if (!ok) alive = false; pts.push([fr.sx(i + 1), fr.sy(alive ? 1 : 0)]); });
    if (rounds.length) polyline(psvg, pts, "stroke:var(--brand);stroke-width:2");
  }

  function draw() {
    drawGraph(); drawPlot();
    o.passed.textContent = `${passed} of ${rounds.length}`;
    o.caught.textContent = caught ? `yes, ${caught} time${caught > 1 ? "s" : ""}` : "no";
    o.psurvive.textContent = mode === "cheat" ? `(8/9)^${rounds.length} = ${((8 / 9) ** rounds.length).toExponential(2)}` : "honest prover always passes";
  }
  function reset() { passed = 0; caught = 0; rounds = []; last = null; log.replaceChildren(); r = rng(11); draw(); }
  act(root, "round", () => { round(); draw(); });
  act(root, "rounds", () => { for (let i = 0; i < 50; i++) round(); draw(); });
  act(root, "reset", reset);
  draw();
}

// ============================================================ 8. PBKDF2

const human = (s) => {
  if (!isFinite(s)) return "∞";
  const units = [["years", 31557600], ["days", 86400], ["hours", 3600], ["minutes", 60], ["seconds", 1]];
  for (const [u, n] of units) if (s >= n) return `${(s / n) >= 1e6 ? (s / n).toExponential(1) : (s / n).toFixed(s / n < 10 ? 1 : 0)} ${u}`;
  return `${(s * 1000).toFixed(1)} ms`;
};

for (const root of document.querySelectorAll("[data-mc-stretch]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  let msPerIter = null; // measured in this browser
  const f = scrubAll(root, draw);
  const subtle = globalThis.crypto?.subtle;

  async function time() {
    if (!subtle) { o.ms.textContent = "WebCrypto unavailable"; return; }
    const iters = Math.round(f.iter.get()) * 1000;
    const base = await subtle.importKey("raw", utf8("correct horse battery staple"), "PBKDF2", false, ["deriveBits"]);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    o.ms.textContent = "timing…";
    const t0 = performance.now();
    await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iters }, base, 256);
    const ms = performance.now() - t0;
    msPerIter = ms / iters;
    draw();
  }

  function draw() {
    const iters = Math.round(f.iter.get()) * 1000, bits = Math.round(f.bits.get()), speed = f.speedup.get();
    svg.replaceChildren();
    const lx = [3, 6.5], ly = [-3, 12];
    const fr = frame(svg, { box: [56, 20, 560, 250], x: lx, y: ly, xticks: [3, 4, 5, 6], yticks: [-3, 0, 3, 6, 9, 12],
      xfmt: (v) => `10${["³", "⁴", "⁵", "⁶"][v - 3]}`, yfmt: (v) => ({ "-3": "1 ms", 0: "1 s", 3: "17 min", 6: "12 d", 9: "32 y", 12: "32 ky" })[v] ?? "",
      xlabel: "PBKDF2 iterations", ylabel: "time to search half the passwords" });
    if (!msPerIter) {
      text(svg, 336, 140, "Press “Time it here” to measure PBKDF2 in this browser.", { "text-anchor": "middle", class: "fill-muted-foreground text-[12px]" });
      o.ms.textContent = "—"; o.rate.textContent = "—"; o.crack.textContent = "—";
      return;
    }
    const secs = (b, it) => 2 ** (b - 1) / (speed / (msPerIter * it / 1000));
    const curve = (b, style, label) => {
      // Only the part of the curve inside the frame; no clamping along the edges.
      const pts = [];
      for (let lg = lx[0]; lg <= lx[1] + 1e-9; lg += 0.05) {
        const y = Math.log10(secs(b, 10 ** lg));
        if (y >= ly[0] && y <= ly[1]) pts.push([fr.sx(lg), fr.sy(y)]);
      }
      if (pts.length > 1) polyline(svg, pts, style);
      const y = Math.log10(secs(b, 10 ** lx[1]));
      if (y > ly[0] && y < ly[1]) text(svg, fr.sx(lx[1]) - 2, fr.sy(y) - 5, label, { "text-anchor": "end" });
    };
    for (const b of [30, 50, 60]) if (b !== bits) curve(b, "stroke:currentColor;stroke-opacity:0.25;stroke-width:1.25", `${b} bits`);
    curve(bits, "stroke:var(--brand);stroke-width:2.25", `${bits} bits`);
    const x = Math.log10(iters), y = Math.log10(secs(bits, iters));
    if (y > ly[0] && y < ly[1] && x >= lx[0] && x <= lx[1]) el("circle", { cx: fr.sx(x), cy: fr.sy(y), r: 5, style: "fill:var(--brand)" }, svg);
    const one = msPerIter * iters;
    o.ms.textContent = `${one.toFixed(1)} ms`;
    o.rate.textContent = `${(speed * 1000 / one).toExponential(2)}`;
    o.crack.textContent = human(secs(bits, iters));
  }
  act(root, "time", time);
  draw();
  // Measure once on load with a short run, so the chart starts filled in.
  setTimeout(() => time().catch(() => {}), 400);
}

// ============================================================ 9. LWE

for (const root of document.querySelectorAll("[data-mc-lwe]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-plot]");
  let samples = [];
  const f = scrubAll(root, run);

  function run() {
    const q = Math.round(f.q.get()) | 1, n = Math.round(f.n.get()), m = Math.round(f.m.get()), E = Math.round(f.e.get());
    const r = rng(2024 + q + 7 * n + 13 * m + 31 * E);
    const ri = (k) => Math.floor(r() * k);
    const s = Array.from({ length: n }, () => ri(q));
    const A = Array.from({ length: m }, () => Array.from({ length: n }, () => ri(q)));
    const b = A.map((row) => mod(row.reduce((acc, a, j) => acc + a * s[j], 0) + (ri(2 * E + 1) - E), q));
    const half = Math.floor(q / 2);
    samples = [];
    let errors = 0;
    for (let t = 0; t < 400; t++) {
      const bit = t % 2;
      const u = new Array(n).fill(0);
      let v = bit * half;
      for (let i = 0; i < m; i++) if (r() < 0.5) {
        for (let j = 0; j < n; j++) u[j] += A[i][j];
        v += b[i];
      }
      const d = mod(v - u.reduce((acc, uj, j) => acc + uj * s[j], 0), q);
      const dist0 = Math.min(d, q - d);
      const got = dist0 < q / 4 ? 0 : 1;
      if (got !== bit) errors++;
      samples.push({ bit, d });
    }
    draw(q, m, E, errors);
  }

  function draw(q, m, E, errors) {
    svg.replaceChildren();
    const cx = 200, cy = 160, R = 120;
    const pt = (d, rr) => [cx + rr * Math.sin((2 * Math.PI * d) / q), cy - rr * Math.cos((2 * Math.PI * d) / q)];
    // The half nearest 0 decodes as 0.
    const arc = (a0, a1, rr) => {
      const [x0, y0] = pt(a0, rr), [x1, y1] = pt(a1, rr);
      return `M ${cx} ${cy} L ${x0} ${y0} A ${rr} ${rr} 0 0 1 ${x1} ${y1} Z`;
    };
    el("path", { d: arc(-q / 4, q / 4, R + 18), style: "fill:var(--vec-u);fill-opacity:0.10" }, svg);
    el("path", { d: arc(q / 4, (3 * q) / 4, R + 18), style: "fill:var(--vec-v);fill-opacity:0.10" }, svg);
    el("circle", { cx, cy, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:0.3" }, svg);
    for (const [d, lbl] of [[0, "0"], [q / 4, "q/4"], [q / 2, "q/2"], [(3 * q) / 4, "3q/4"]]) {
      const [x, y] = pt(d, R + 30);
      text(svg, x, y + 4, lbl, { "text-anchor": "middle" });
    }
    const r = rng(5);
    for (const sm of samples) {
      const [x, y] = pt(sm.d, R + (sm.bit ? 8 : -8) + (r() - 0.5) * 8);
      el("circle", { cx: x, cy: y, r: 2.4, style: `fill:${sm.bit ? "var(--vec-v)" : "var(--vec-u)"};fill-opacity:0.75` }, svg);
    }
    text(svg, 420, 60, "bit 0 encrypted", { class: "fill-foreground text-[11px]", style: "fill:var(--vec-u)" });
    text(svg, 420, 80, "bit 1 encrypted", { class: "fill-foreground text-[11px]", style: "fill:var(--vec-v)" });
    text(svg, 420, 112, "Decryption reads 0 inside", { class: "fill-muted-foreground text-[11px]" });
    text(svg, 420, 128, "the half around 0, else 1.", { class: "fill-muted-foreground text-[11px]" });
    text(svg, 420, 160, "Noise spreads each cluster;", { class: "fill-muted-foreground text-[11px]" });
    text(svg, 420, 176, "past q/4 it lands on the", { class: "fill-muted-foreground text-[11px]" });
    text(svg, 420, 192, "wrong side.", { class: "fill-muted-foreground text-[11px]" });
    o.worst.textContent = `m·e = ${m * E}`;
    o.quarter.textContent = (q / 4).toFixed(1);
    o.errors.textContent = `${errors} of 400`;
    o.errors.style.color = errors ? "var(--code-del)" : "";
  }
  act(root, "run", run);
  run();
}

// ============================================================ 10. TLS 1.3

const TLS = [
  { from: "C", name: "ClientHello", enc: "no", what: "The client sends a random value, the cipher suites and groups it supports, and a key share: a fresh ephemeral Diffie–Hellman public key (for example X25519).", proves: "nothing yet" },
  { from: "S", name: "ServerHello", enc: "no", what: "The server picks a suite and sends its own key share. Both sides now compute the same Diffie–Hellman secret and derive handshake keys from it with HKDF. Everything after this is encrypted.", proves: "nothing yet: an attacker could also answer" },
  { from: "S", name: "{EncryptedExtensions}", enc: "handshake keys", what: "Further parameters, such as the application protocol (ALPN). Encrypted, so an eavesdropper sees less than in TLS 1.2.", proves: "—" },
  { from: "S", name: "{Certificate}", enc: "handshake keys", what: "The server's certificate chain: its public key bound to its domain name, signed by a certificate authority the client trusts.", proves: "this public key belongs to this name (if the chain checks out)" },
  { from: "S", name: "{CertificateVerify}", enc: "handshake keys", what: "A signature, with the certificate's private key, over a hash of every message so far.", proves: "the server holds the private key, and saw exactly this transcript" },
  { from: "S", name: "{Finished}", enc: "handshake keys", what: "An HMAC over the transcript with a key derived from the handshake secret.", proves: "the server derived the same keys; nothing was altered" },
  { from: "C", name: "{Finished}", enc: "handshake keys", what: "The client's own HMAC over the transcript. The handshake is complete after one round trip.", proves: "the client derived the same keys" },
  { from: "B", name: "[Application data]", enc: "traffic keys", what: "HTTP requests and responses, protected with AEAD under traffic keys. The ephemeral Diffie–Hellman keys are thrown away, so a later theft of the server's certificate key cannot decrypt this session: forward secrecy.", proves: "every record is authenticated by its AEAD tag" },
];

for (const root of document.querySelectorAll("[data-mc-tls]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-seq]");
  const nameEl = root.querySelector("[data-name]"), whatEl = root.querySelector("[data-what]");
  let i = 0;

  function draw() {
    svg.replaceChildren();
    const L = 110, Rx = 530, top = 50;
    for (const [x, lbl] of [[L, "Client"], [Rx, "Server"]]) {
      el("line", { x1: x, x2: x, y1: top - 10, y2: 400, style: "stroke:currentColor;stroke-opacity:0.3;stroke-width:1.5" }, svg);
      text(svg, x, top - 20, lbl, { "text-anchor": "middle", class: "fill-foreground text-[12px] font-medium" });
    }
    TLS.forEach((m, k) => {
      const y = top + 20 + k * 42;
      const cur = k === i, future = k > i;
      const style = `stroke:${cur ? "var(--brand)" : "currentColor"};stroke-opacity:${future ? 0.15 : cur ? 1 : 0.55};stroke-width:${cur ? 2.5 : 1.5}` + (m.enc === "no" ? "" : ";stroke-dasharray:6 3");
      const head = (x1, x2) => {
        el("line", { x1, x2, y1: y, y2: y, style }, svg);
        const d = x2 > x1 ? -8 : 8;
        el("path", { d: `M ${x2} ${y} l ${d} -4 l 0 8 z`, style: `fill:${cur ? "var(--brand)" : "currentColor"};fill-opacity:${future ? 0.15 : cur ? 1 : 0.55}` }, svg);
      };
      if (m.from === "C") head(L, Rx);
      else if (m.from === "S") head(Rx, L);
      else {
        head(L, Rx);
        el("path", { d: `M ${L} ${y} l 8 -4 l 0 8 z`, style: `fill:${cur ? "var(--brand)" : "currentColor"};fill-opacity:${future ? 0.15 : cur ? 1 : 0.55}` }, svg);
      }
      text(svg, (L + Rx) / 2, y - 7, m.name, { "text-anchor": "middle", class: cur ? "fill-foreground font-mono text-[11px]" : "fill-muted-foreground font-mono text-[11px]", style: future ? "opacity:0.35" : "" });
    });
    text(svg, L, 412, "dashed = encrypted   {…} handshake keys   […] traffic keys", { class: "fill-muted-foreground text-[10px]" });
    const m = TLS[i];
    o.count.textContent = `${i + 1} of ${TLS.length}`;
    nameEl.textContent = m.name;
    whatEl.textContent = m.what;
    o.proves.textContent = m.proves;
    o.enc.textContent = m.enc;
  }
  act(root, "prev", () => { i = Math.max(0, i - 1); draw(); });
  act(root, "next", () => { i = Math.min(TLS.length - 1, i + 1); draw(); });
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); i = Math.min(TLS.length - 1, i + 1); draw(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); i = Math.max(0, i - 1); draw(); }
  });
  draw();
}
