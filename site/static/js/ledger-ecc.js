// Blockchain blocks, part two: y² = x³ + 7 over the reals and over a small
// prime field, double-and-add, and toy ECDSA with the nonce-reuse attack.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";
import { outs, onSeg, onToggle, mk, sha256, ecAdd, ecMul, curvePoints, inv, mod } from "./ledger-util.js";

const pt = (P) => (P ? `(${P[0]}, ${P[1]})` : "O");
// Generators of prime order for y² = x³ + 7: the whole group is cyclic of
// prime order for these p, as it is for secp256k1.
const FIELDS = { 67: { G: [2, 22], n: 79 }, 43: { G: [2, 12], n: 31 }, 97: { G: [1, 28], n: 79 } };

// ============================================================ Curve

for (const root of document.querySelectorAll("[data-ledger-curve]")) {
  const real = root.querySelector("[data-real]");
  const field = root.querySelector("[data-field]");
  const steps = root.querySelector("[data-steps]");
  const o = outs(root);
  let p = 67, qneg = false;
  const f = scrubAll(root, draw);
  const X0 = -Math.cbrt(7);

  function drawReal() {
    real.replaceChildren();
    const fr = frame(real, { box: [28, 10, 262, 262], x: [-3, 5], y: [-10, 10], xticks: [-2, 0, 2, 4], yticks: [-8, -4, 0, 4, 8] });
    const up = [], down = [];
    for (let x = X0; x <= 5.001; x += 0.02) {
      const y = Math.sqrt(Math.max(0, x ** 3 + 7));
      if (y > 10.5) break;
      up.push([fr.sx(x), fr.sy(y)]);
      down.push([fr.sx(x), fr.sy(-y)]);
    }
    polyline(fr.g, [...down.reverse(), [fr.sx(X0), fr.sy(0)], ...up], "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5");
    const yOf = (x, neg) => (neg ? -1 : 1) * Math.sqrt(Math.max(0, x ** 3 + 7));
    const px = Math.max(X0, f.px.get()), qx = Math.max(X0, f.qx.get());
    const P = [px, yOf(px, false)], Q = [qx, yOf(qx, qneg)];
    let sum = null, lam = null;
    const same = Math.abs(px - qx) < 1e-9;
    if (same && Math.abs(P[1] + Q[1]) < 1e-9) sum = null;
    else {
      lam = same ? (3 * px * px) / (2 * P[1]) : (Q[1] - P[1]) / (qx - px);
      const x3 = lam * lam - px - qx;
      sum = [x3, lam * (px - x3) - P[1]];
    }
    const clipY = (y) => Math.max(-10, Math.min(10, y));
    if (lam === null) {
      el("line", { x1: fr.sx(px), x2: fr.sx(px), y1: fr.sy(10), y2: fr.sy(-10), style: "stroke:var(--brand);stroke-opacity:0.6" }, fr.g);
    } else {
      const line = (x) => P[1] + lam * (x - px);
      // Clip the chord to the frame by sampling.
      const seg = [];
      for (let x = -3; x <= 5; x += 0.02) { const y = line(x); if (y >= -10 && y <= 10) seg.push([fr.sx(x), fr.sy(y)]); }
      if (seg.length) polyline(fr.g, seg, "stroke:var(--brand);stroke-opacity:0.55;stroke-width:1.25");
      const R = [sum[0], -sum[1]];
      if (Math.abs(R[1]) <= 10 && sum[0] <= 5) {
        el("line", { x1: fr.sx(sum[0]), x2: fr.sx(sum[0]), y1: fr.sy(clipY(R[1])), y2: fr.sy(clipY(sum[1])), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, fr.g);
        el("circle", { cx: fr.sx(R[0]), cy: fr.sy(R[1]), r: 3.5, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.6" }, fr.g);
        text(fr.g, fr.sx(R[0]) + 6, fr.sy(R[1]) - 4, "−(P+Q)");
      }
    }
    const dot = (A, color, label, dx = 6) => {
      if (!A || Math.abs(A[1]) > 10 || A[0] > 5) return;
      el("circle", { cx: fr.sx(A[0]), cy: fr.sy(A[1]), r: 4.5, style: `fill:${color}` }, fr.g);
      text(fr.g, fr.sx(A[0]) + dx, fr.sy(A[1]) + (A[1] >= 0 ? -6 : 14), label, { fill: color, class: "font-mono text-[11px]" });
    };
    dot(P, "var(--vec-u)", "P");
    dot(Q, "var(--vec-v)", same && !qneg ? "" : "Q");
    dot(sum, "var(--brand)", same && !qneg ? "2P" : "P+Q");
    o.sum.textContent = sum ? `(${sum[0].toFixed(2)}, ${sum[1].toFixed(2)})${same ? " tangent" : ""}` : "O (vertical line)";
    if (sum && (Math.abs(sum[1]) > 10 || sum[0] > 5)) o.sum.textContent += " off chart";
  }

  function drawField() {
    field.replaceChildren();
    const { G, n } = FIELDS[p];
    const pts = curvePoints(p);
    const k = Math.round(f.k.get());
    const s = 270 / p;
    const X = (x) => 20 + (x + 0.5) * s, Y = (y) => 280 - (y + 0.5) * s;
    el("rect", { x: 20, y: 10, width: 270, height: 270, style: "fill:none;stroke:currentColor;stroke-opacity:0.15" }, field);
    for (const [x, y] of pts) el("circle", { cx: X(x), cy: Y(y), r: Math.max(1.6, s * 0.28), style: "fill:currentColor;fill-opacity:0.3" }, field);
    // The walk G, 2G, …, kG jumps all over the field: that is the point.
    const walk = [];
    let R = null;
    for (let i = 1; i <= Math.min(k, n); i++) { R = ecAdd(R, G, p); if (R) walk.push(R); }
    const recent = walk.slice(-12);
    if (recent.length > 1) polyline(field, recent.map(([x, y]) => [X(x), Y(y)]), "stroke:var(--brand);stroke-opacity:0.35;stroke-width:1");
    el("circle", { cx: X(G[0]), cy: Y(G[1]), r: 4.5, style: "fill:var(--vec-u)" }, field);
    text(field, X(G[0]) + 6, Y(G[1]) - 5, "G", { fill: "var(--vec-u)", class: "font-mono text-[11px]" });
    const { R: kG, steps: st } = ecMul(k, G, p);
    if (kG) {
      el("circle", { cx: X(kG[0]), cy: Y(kG[1]), r: 5.5, style: "fill:none;stroke:var(--brand);stroke-width:2" }, field);
      text(field, X(kG[0]) + 7, Y(kG[1]) + 14, `${k}G`, { fill: "var(--brand)", class: "font-mono text-[11px]" });
    }
    text(field, 20, 296, "0", {});
    text(field, 290, 296, String(p - 1), { "text-anchor": "end" });
    o.fieldlabel.textContent = `Over F_${p}: ${pts.length} points + O`;
    let doubles = 0, adds = 0;
    steps.replaceChildren(...st.map((s2, i) => {
      if (i > 0) doubles++;
      if (s2.bit === "1" && i > 0) adds++;
      const what = i === 0 ? "R = G" : s2.bit === "1" ? "R = 2R + G" : "R = 2R";
      return mk("li", "flex justify-between gap-2", `${s2.bit}  ${what}`.padEnd(14) + "  " + pt(s2.R));
    }));
    o.order.textContent = `${n} (prime)`;
    o.kg.textContent = kG ? pt(kG) : `O (k is a multiple of ${n})`;
    o.ops.textContent = `${doubles} + ${adds}, bits of ${k} = ${k.toString(2)}`;
  }

  function draw() { drawReal(); drawField(); }
  onSeg(root, (v) => { p = Number(v); drawField(); });
  onToggle(root, (_, on) => { qneg = on; drawReal(); });
  draw();
}

// ============================================================ ECDSA

for (const root of document.querySelectorAll("[data-ledger-ecdsa]")) {
  const P = 67, { G, n } = FIELDS[67];
  const o = outs(root);
  const work = root.querySelector("[data-work]");
  const attack = root.querySelector("[data-attack]");
  const m1 = root.querySelector("[data-text=m1]"), m2 = root.querySelector("[data-text=m2]");
  let reuse = false, forge = false;
  const f = scrubAll(root, draw);
  const zOf = (m) => Number(BigInt("0x" + sha256(m)) % BigInt(n));
  const mul = (k, A) => ecMul(k, A, P).R;

  function sign(z, d, k) {
    const R = mul(k, G);
    if (!R) return { err: "k·G = O; pick another k" };
    const r = mod(R[0], n);
    if (r === 0) return { err: "r = 0; pick another k" };
    const s = mod(inv(k, n) * mod(z + r * d, n), n);
    if (s === 0) return { err: "s = 0; pick another k" };
    return { r, s, R };
  }
  function verify(z, sig, Q) {
    const w = inv(sig.s, n);
    const u1 = mod(z * w, n), u2 = mod(sig.r * w, n);
    const X = ecAdd(mul(u1, G), mul(u2, Q), P);
    return { ok: !!X && mod(X[0], n) === sig.r, u1, u2, X };
  }

  function column(title, m, z, k, sig, vz, vsig, Q) {
    const c = mk("div", "flex flex-col gap-0.5 rounded-lg border bg-background p-3");
    c.append(mk("div", "pb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase", title));
    const line = (s, cls = "") => c.append(mk("div", "tabular-nums " + cls, s));
    line(`z = H("${m}") mod ${n} = ${z}`);
    if (sig.err) { line(sig.err, "text-[var(--code-del)]"); return c; }
    line(`R = ${k}·G = ${pt(sig.R)}`);
    line(`r = R.x mod n = ${sig.r}`);
    line(`s = k⁻¹(z + r·d) mod n = ${sig.s}`);
    const v = verify(vz, vsig, Q);
    line(`u₁ = ${v.u1}, u₂ = ${v.u2}, u₁G + u₂Q = ${pt(v.X)}`, "text-muted-foreground");
    line(v.ok ? "verify: x ≡ r ✓ valid" : "verify: x ≠ r ✗ invalid", v.ok ? "text-brand" : "text-[var(--code-del)]");
    return c;
  }

  function draw() {
    const d = Math.round(f.d.get()), k1 = Math.round(f.k1.get());
    const k2 = reuse ? k1 : Math.round(f.k2.get());
    const Q = mul(d, G);
    const z1 = zOf(m1.value), z2 = zOf(m2.value);
    const s1 = sign(z1, d, k1), s2 = sign(z2, d, k2);
    o.pub.textContent = `Q = ${d}·G = ${pt(Q)}`;
    o.sig1.textContent = s1.err ? "—" : `(${s1.r}, ${s1.s})`;
    o.sig2.textContent = s2.err ? "—" : `(${s2.r}, ${s2.s})`;
    const c1 = column("Sign and verify message 1", m1.value, z1, k1, s1, z1, s1, Q);
    const c2 = forge && !s1.err
      ? column("Message 2 with signature 1", m2.value, z2, k1, s1, z2, s1, Q)
      : column("Sign and verify message 2", m2.value, z2, k2, s2, z2, s2, Q);
    work.replaceChildren(c1, c2);

    const rows = [mk("div", "pb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase", "What an observer can do with the two signatures")];
    const add = (s, cls = "") => rows.push(mk("div", "tabular-nums " + cls, s));
    if (s1.err || s2.err) add("—");
    else if (s1.r !== s2.r) add(`r₁ = ${s1.r} ≠ r₂ = ${s2.r}: different nonces, nothing to exploit.`, "text-muted-foreground");
    else if (z1 === z2) add("Same z for both messages (a collision mod 79): try another message.", "text-muted-foreground");
    else if (s1.s === s2.s) add("Same r and s: nothing new to solve for.", "text-muted-foreground");
    else {
      const k = mod(mod(z1 - z2, n) * inv(mod(s1.s - s2.s, n), n), n);
      const dr = mod(mod(s1.s * k - z1, n) * inv(s1.r, n), n);
      add(`r₁ = r₂ = ${s1.r}, so both used the same k.`);
      add(`k = (z₁ − z₂) / (s₁ − s₂) mod n = (${z1} − ${z2}) / (${s1.s} − ${s2.s}) = ${k}`);
      add(`d = (s₁·k − z₁) / r₁ mod n = ${dr}`, dr === d ? "text-[var(--code-del)]" : "");
      add(dr === d ? "Private key recovered: anyone can now sign as you." : "Mismatch.", dr === d ? "text-[var(--code-del)]" : "");
    }
    attack.replaceChildren(...rows);
  }

  onToggle(root, (name, on) => { if (name === "reuse") reuse = on; else forge = on; draw(); });
  for (const i of [m1, m2]) i.addEventListener("input", draw);
  draw();
}
