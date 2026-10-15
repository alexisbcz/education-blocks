// Economics blocks: market surplus and policy, elasticity, monopoly,
// Nash equilibria, compounding and inflation, comparative advantage,
// the Solow model and the multiplier. Every area and number is computed
// from the model's closed form.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const money = (v, d = 2) => (Number.isFinite(v) ? `€${num(v, d)}` : "—");
const big = (v) => (Number.isFinite(v) ? "€" + new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(v).replace("-", "−") : "—");
const pct = (v, d = 2) => (Number.isFinite(v) ? `${num(v * 100, d)}%` : "—");

// area draws a filled polygon given in data coordinates through frame f.
function area(svg, f, pts, color, opacity = 0.22) {
  if (pts.length < 3) return;
  el("path", { d: "M" + pts.map(([x, y]) => `${f.sx(x).toFixed(1)},${f.sy(y).toFixed(1)}`).join("L") + "Z", style: `fill:${color};fill-opacity:${opacity};stroke:none` }, svg);
}
// seg draws a line between two data points.
function seg(svg, f, a, b, style) {
  el("line", { x1: f.sx(a[0]), y1: f.sy(a[1]), x2: f.sx(b[0]), y2: f.sy(b[1]), style }, svg);
}
function dot(svg, f, p, color, r = 3.5) {
  el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r, style: `fill:var(--background);stroke:${color};stroke-width:1.75` }, svg);
}
// niceTicks returns about n round tick values covering [0, max].
function niceTicks(max, n = 5) {
  if (!(max > 0)) return [0];
  const raw = max / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const tickFmt = (v) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : String(+v.toFixed(3))).replace("-", "−");

// ============================================================ Supply & demand

for (const root of document.querySelectorAll("[data-econ-market]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let policy = "none";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    policy = e.detail.value;
    const { a, b, c, d } = params();
    const q = (a - c) / (b + d), p = a - b * q;
    // Start each policy where it bites.
    if (policy === "ceiling") s.level.set(p - (p - c) / 2, false);
    if (policy === "floor") s.level.set(p + (a - p) / 2, false);
    if (policy === "tax") s.level.set((a - c) / 4, false);
    draw();
  });
  const params = () => ({ a: s.a.get(), b: s.b.get(), c: s.c.get(), d: s.d.get() });

  function draw() {
    const { a, b, c, d } = params();
    const L = s.level.get();
    svg.replaceChildren();
    const qmax = (a / b) * 1.05, pmax = Math.max(a, c) * 1.12;
    const f = frame(svg, { box: [52, 18, 488, 316], x: [0, qmax], y: [0, pmax], xticks: niceTicks(qmax), yticks: niceTicks(pmax), xfmt: tickFmt, yfmt: tickFmt, xlabel: "quantity Q", ylabel: "price P (€)" });
    const D = (q) => a - b * q, S = (q) => c + d * q;
    const sEnd = Math.min(qmax, (pmax - c) / d);
    if (!(a > c)) {
      seg(svg, f, [0, a], [a / b, 0], "stroke:var(--foreground);stroke-width:2");
      seg(svg, f, [0, c], [sEnd, S(sEnd)], "stroke:var(--ion-k);stroke-width:2");
      for (const k of ["q", "p", "cs", "ps", "rev", "dwl"]) o[k].textContent = "—";
      o.note.textContent = "no trade: even the first buyer values the good below its cost";
      return;
    }
    const qe = (a - c) / (b + d), pe = D(qe);
    let r = { q: qe, p: pe, cs: 0.5 * (a - pe) * qe, ps: 0.5 * (pe - c) * qe, rev: 0, dwl: 0, note: "market clears" };

    if (policy === "tax" && L > 0) {
      const qt = Math.max(0, (a - c - L) / (b + d)), pd = D(qt), ps = pd - L;
      area(svg, f, [[0, a], [0, pd], [qt, pd]], "var(--vec-u)");
      area(svg, f, [[0, pd], [qt, pd], [qt, ps], [0, ps]], "var(--vec-out)", 0.3);
      area(svg, f, [[0, ps], [0, c], [qt, ps]], "var(--brand)");
      area(svg, f, [[qt, pd], [qt, ps], [qe, pe]], "var(--code-del)", 0.35);
      const tEnd = Math.min(qmax, (pmax - c - L) / d);
      seg(svg, f, [0, c + L], [tEnd, c + L + d * tEnd], "stroke:var(--ion-k);stroke-width:1.5;stroke-dasharray:5 4");
      r = { q: qt, p: pd, cs: 0.5 * (a - pd) * qt, ps: 0.5 * Math.max(0, ps - c) * qt, rev: L * qt, dwl: 0.5 * L * (qe - qt),
        note: `buyers pay ${money(pd)}, sellers keep ${money(ps)}` };
    } else if (policy === "ceiling" && L < pe) {
      const qs = Math.max(0, (L - c) / d), pdq = D(qs);
      area(svg, f, [[0, a], [0, L], [qs, L], [qs, pdq]], "var(--vec-u)");
      area(svg, f, [[0, L], [0, Math.min(L, c)], [qs, L]], "var(--brand)");
      area(svg, f, [[qs, pdq], [qs, Math.max(L, c)], [qe, pe]], "var(--code-del)", 0.35);
      seg(svg, f, [0, L], [qmax, L], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:2 3");
      const shortage = Math.max(0, (a - L) / b - qs);
      r = { q: qs, p: L, cs: (a - L) * qs - 0.5 * b * qs * qs, ps: 0.5 * Math.max(0, L - c) * qs, rev: 0, dwl: 0.5 * (pdq - Math.max(L, c)) * (qe - qs),
        note: `shortage of ${num(shortage, 2)} units` };
    } else if (policy === "floor" && L > pe) {
      const qd = Math.max(0, (a - L) / b), psq = S(qd);
      area(svg, f, [[0, a], [0, L], [qd, L]], "var(--vec-u)");
      area(svg, f, [[0, L], [0, c], [qd, psq], [qd, L]], "var(--brand)");
      area(svg, f, [[qd, L], [qd, psq], [qe, pe]], "var(--code-del)", 0.35);
      seg(svg, f, [0, L], [qmax, L], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:2 3");
      const surplus = Math.max(0, (L - c) / d - qd);
      r = { q: qd, p: L, cs: 0.5 * (a - L) * qd, ps: (L - c) * qd - 0.5 * d * qd * qd, rev: 0, dwl: 0.5 * (L - psq) * (qe - qd),
        note: `unsold surplus of ${num(surplus, 2)} units` };
    } else {
      area(svg, f, [[0, a], [0, pe], [qe, pe]], "var(--vec-u)");
      area(svg, f, [[0, pe], [0, c], [qe, pe]], "var(--brand)");
      if (policy !== "none") {
        seg(svg, f, [0, L], [qmax, L], "stroke:currentColor;stroke-opacity:0.4;stroke-width:1.25;stroke-dasharray:2 3");
        r.note = policy === "tax" ? "no tax" : `${policy} at ${money(L)} does not bind`;
      }
    }
    seg(svg, f, [0, a], [Math.min(qmax, a / b), D(Math.min(qmax, a / b))], "stroke:var(--foreground);stroke-width:2");
    seg(svg, f, [0, c], [sEnd, S(sEnd)], "stroke:var(--ion-k);stroke-width:2");
    text(svg, f.sx(Math.min(qmax, a / b) * 0.92), f.sy(D(Math.min(qmax, a / b) * 0.92)) - 8, "D", { class: "fill-foreground font-mono text-[11px]" });
    text(svg, f.sx(sEnd * 0.95) + 6, f.sy(S(sEnd * 0.95)), "S", { style: "fill:var(--ion-k)", class: "font-mono text-[11px]" });
    seg(svg, f, [qe, 0], [qe, pe], "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3");
    dot(svg, f, [qe, pe], "var(--foreground)");
    o.q.textContent = num(r.q, 2);
    o.p.textContent = money(r.p);
    o.cs.textContent = money(r.cs);
    o.ps.textContent = money(r.ps);
    o.rev.textContent = money(r.rev);
    o.dwl.textContent = money(r.dwl);
    o.note.textContent = r.note;
  }
  draw();
}

// ============================================================ Elasticity

for (const root of document.querySelectorAll("[data-econ-elasticity]")) {
  const dSvg = root.querySelector("[data-demand]"), rSvg = root.querySelector("[data-revenue]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const a = s.a.get(), b = s.b.get();
    const P1 = Math.min(s.p1.get(), a), P2 = Math.min(s.p2.get(), a);
    const Q = (p) => (a - p) / b, TR = (p) => p * Q(p);
    const q1 = Q(P1), q2 = Q(P2);

    dSvg.replaceChildren();
    const qmax = (a / b) * 1.05;
    const f = frame(dSvg, { box: [40, 16, 268, 248], x: [0, qmax], y: [0, a * 1.08], xticks: niceTicks(qmax, 4), yticks: niceTicks(a, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "Q", ylabel: "P (€)" });
    // Upper half of a straight demand line is elastic, lower half inelastic.
    seg(dSvg, f, [0, a], [a / (2 * b), a / 2], "stroke:var(--brand);stroke-width:2.5");
    seg(dSvg, f, [a / (2 * b), a / 2], [a / b, 0], "stroke:var(--vec-u);stroke-width:2.5");
    text(dSvg, f.sx(a / (4 * b)) + 8, f.sy(a * 0.75), "elastic", { style: "fill:var(--brand)" });
    text(dSvg, f.sx(a * 0.75 / b) + 8, f.sy(a / 4), "inelastic", { style: "fill:var(--vec-u)" });
    for (const [p, q] of [[P1, q1], [P2, q2]]) {
      seg(dSvg, f, [0, p], [q, p], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3");
      seg(dSvg, f, [q, 0], [q, p], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3");
      dot(dSvg, f, [q, p], "var(--foreground)");
    }
    dot(dSvg, f, [a / (2 * b), a / 2], "var(--vec-out)", 3);

    rSvg.replaceChildren();
    const trMax = TR(a / 2);
    const g = frame(rSvg, { box: [44, 16, 264, 248], x: [0, a], y: [0, trMax * 1.12], xticks: niceTicks(a, 4), yticks: niceTicks(trMax * 1.1, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "price P (€)", ylabel: "revenue (€)" });
    polyline(rSvg, Array.from({ length: 101 }, (_, i) => { const p = (a * i) / 100; return [g.sx(p), g.sy(TR(p))]; }), "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: g.sx(a / 2), x2: g.sx(a / 2), y1: g.T, y2: g.T + g.H, style: "stroke:var(--vec-out);stroke-dasharray:3 3" }, rSvg);
    text(rSvg, g.sx(a / 2) + 4, g.T + 10, "|ε| = 1", { style: "fill:var(--vec-out)" });
    dot(rSvg, g, [P1, TR(P1)], "var(--foreground)");
    dot(rSvg, g, [P2, TR(P2)], "var(--brand)");

    const point = q1 > 0 ? -(1 / b) * (P1 / q1) : -Infinity;
    const arc = (q1 + q2) > 0 && P1 + P2 > 0 && P1 !== P2 ? ((q2 - q1) / ((q1 + q2) / 2)) / ((P2 - P1) / ((P1 + P2) / 2)) : NaN;
    o.qs.textContent = `${num(q1, 2)} → ${num(q2, 2)}`;
    o.point.textContent = Number.isFinite(point) ? num(point, 2) : "−∞";
    o.arc.textContent = Number.isFinite(arc) ? num(arc, 2) : "—";
    o.tr.textContent = `${money(TR(P1))} → ${money(TR(P2))}`;
    const m = Math.abs(arc);
    o.verdict.textContent = !Number.isFinite(arc) ? "pick two different prices"
      : Math.abs(m - 1) < 0.005 ? "unit elastic: revenue unchanged"
      : m > 1 ? `elastic: a price ${P2 > P1 ? "rise" : "cut"} ${TR(P2) > TR(P1) ? "raises" : "lowers"} revenue`
      : `inelastic: a price ${P2 > P1 ? "rise" : "cut"} ${TR(P2) > TR(P1) ? "raises" : "lowers"} revenue`;
  }
  draw();
}

// ============================================================ Monopoly

for (const root of document.querySelectorAll("[data-econ-monopoly]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "monopoly";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function draw() {
    const a = s.a.get(), b = s.b.get(), c = s.c.get();
    svg.replaceChildren();
    const qmax = (a / b) * 1.05, pmax = Math.max(a, c) * 1.1;
    const f = frame(svg, { box: [52, 18, 488, 300], x: [0, qmax], y: [0, pmax], xticks: niceTicks(qmax), yticks: niceTicks(pmax), xfmt: tickFmt, yfmt: tickFmt, xlabel: "quantity Q", ylabel: "€" });
    const ok = a > c;
    const qc = ok ? (a - c) / b : 0, qm = ok ? (a - c) / (2 * b) : 0, pm = ok ? (a + c) / 2 : NaN;
    if (ok && mode === "monopoly") {
      area(svg, f, [[0, a], [0, pm], [qm, pm]], "var(--vec-u)");
      area(svg, f, [[0, pm], [qm, pm], [qm, c], [0, c]], "var(--brand)", 0.25);
      area(svg, f, [[qm, pm], [qm, c], [qc, c]], "var(--code-del)", 0.35);
      seg(svg, f, [qm, 0], [qm, pm], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3");
      seg(svg, f, [0, pm], [qm, pm], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 3");
      dot(svg, f, [qm, pm], "var(--brand)");
      dot(svg, f, [qm, c], "var(--ion-cl)", 3);
      text(svg, f.sx(qm / 2) - 14, f.sy((pm + c) / 2) + 4, "profit", { class: "fill-foreground font-mono text-[10px]" });
    } else if (ok) {
      area(svg, f, [[0, a], [0, c], [qc, c]], "var(--vec-u)");
      dot(svg, f, [qc, c], "var(--foreground)");
    }
    seg(svg, f, [0, a], [a / b, 0], "stroke:var(--foreground);stroke-width:2");
    seg(svg, f, [0, a], [a / (2 * b), 0], "stroke:var(--ion-cl);stroke-width:1.75;stroke-dasharray:6 4");
    seg(svg, f, [0, c], [qmax, c], "stroke:var(--ion-k);stroke-width:2");
    text(svg, f.sx(qmax) - 4, f.sy(c) - 6, "MC", { "text-anchor": "end", style: "fill:var(--ion-k)" });
    text(svg, f.sx(a / (2 * b)) + 4, f.sy(0) - 6, "MR", { style: "fill:var(--ion-cl)" });

    if (!ok) {
      for (const k of ["q", "p", "profit", "cs", "dwl", "lerner"]) o[k].textContent = "—";
      o.q.textContent = "no sales: cost above every buyer's value";
      return;
    }
    const mono = mode === "monopoly";
    const q = mono ? qm : qc, p = mono ? pm : c;
    o.q.textContent = `${num(q, 2)}${mono ? `  (competitive ${num(qc, 2)})` : ""}`;
    o.p.textContent = money(p);
    o.profit.textContent = money((p - c) * q);
    o.cs.textContent = money(0.5 * (a - p) * q);
    o.dwl.textContent = money(mono ? 0.5 * (pm - c) * (qc - qm) : 0);
    o.lerner.textContent = num(p > 0 ? (p - c) / p : 0, 3);
  }
  draw();
}

// ============================================================ Nash equilibrium

const GAMES = {
  pd: { rows: ["Cooperate", "Defect"], cols: ["Cooperate", "Defect"], pay: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]] },
  stag: { rows: ["Stag", "Hare"], cols: ["Stag", "Hare"], pay: [[[4, 4], [0, 3]], [[3, 0], [3, 3]]] },
  chicken: { rows: ["Swerve", "Straight"], cols: ["Swerve", "Straight"], pay: [[[0, 0], [-1, 1]], [[1, -1], [-10, -10]]] },
  pennies: { rows: ["Heads", "Tails"], cols: ["Heads", "Tails"], pay: [[[1, -1], [-1, 1]], [[-1, 1], [1, -1]]] },
};

// frac writes x as a small fraction when one fits exactly.
function frac(x) {
  for (let d = 1; d <= 24; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return d === 1 ? String(n) : `${n}/${d}`;
  }
  return num(x, 3);
}

for (const root of document.querySelectorAll("[data-econ-nash]")) {
  const o = outs(root);
  const labels = Object.fromEntries([...root.querySelectorAll("[data-label]")].map((n) => [n.dataset.label, n]));
  const s = scrubAll(root, draw);
  const name = (k) => labels[k].textContent;
  root.addEventListener("seg-change", (e) => {
    const g = GAMES[e.detail.value];
    g.rows.forEach((v, i) => (labels[`r${i}`].textContent = v));
    g.cols.forEach((v, i) => (labels[`c${i}`].textContent = v));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      s[`r${r}${c}`].set(g.pay[r][c][0], false);
      s[`c${r}${c}`].set(g.pay[r][c][1], false);
    }
    draw();
  });

  function draw() {
    const R = (r, c) => s[`r${r}${c}`].get(), C = (r, c) => s[`c${r}${c}`].get();
    const pure = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const rowBest = R(r, c) >= R(1 - r, c); // row's best reply to column c
      const colBest = C(r, c) >= C(r, 1 - c); // column's best reply to row r
      const key = `${r}${c}`;
      root.querySelector(`[data-br="r${key}"]`).toggleAttribute("data-on", rowBest);
      root.querySelector(`[data-br="c${key}"]`).toggleAttribute("data-on", colBest);
      root.querySelector(`[data-cell="${key}"]`).toggleAttribute("data-nash", rowBest && colBest);
      if (rowBest && colBest) pure.push(`(${name(`r${r}`)}, ${name(`c${c}`)})`);
    }
    o.pure.textContent = pure.length ? pure.join(" and ") : "none";

    // Fully mixed: each player mixes so the other is indifferent.
    const [a1, b1, c1, d1] = [R(0, 0), R(0, 1), R(1, 0), R(1, 1)];
    const [a2, b2, c2, d2] = [C(0, 0), C(0, 1), C(1, 0), C(1, 1)];
    const dq = a1 - b1 - c1 + d1, dp = a2 - c2 - b2 + d2;
    const q = dq !== 0 ? (d1 - b1) / dq : NaN; // P(column plays its first strategy)
    const p = dp !== 0 ? (d2 - c2) / dp : NaN; // P(row plays its first strategy)
    if (p > 0 && p < 1 && q > 0 && q < 1) {
      o.mixed.textContent = `Row: ${name("r0")} ${frac(p)} · Column: ${name("c0")} ${frac(q)}`;
      const vr = q * a1 + (1 - q) * b1, vc = p * a2 + (1 - p) * c2;
      o.mixednote.textContent = `Expected payoffs: row ${num(vr, 2)}, column ${num(vc, 2)}.`;
    } else {
      o.mixed.textContent = "none fully mixed";
      o.mixednote.textContent = "No mix makes both players indifferent; a dominant strategy or a tie usually explains why.";
    }
  }
  draw();
}

// ============================================================ Compound interest

for (const root of document.querySelectorAll("[data-econ-interest]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let n = 1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { n = e.detail.value === "inf" ? Infinity : Number(e.detail.value); draw(); });

  function draw() {
    const P = s.p.get(), r = s.r.get() / 100, T = Math.round(s.t.get()), pi = s.pi.get() / 100;
    const growth = (t) => (n === Infinity ? Math.exp(r * t) : (1 + r / n) ** (n * t));
    const fv = (t) => P * growth(t);
    const simple = (t) => P * (1 + r * t);
    const realv = (t) => fv(t) / (1 + pi) ** t;
    svg.replaceChildren();
    const ymax = Math.max(fv(T), simple(T), realv(T), P) * 1.08;
    const f = frame(svg, { box: [60, 16, 480, 280], x: [0, T], y: [0, ymax], xticks: niceTicks(T, 6), yticks: niceTicks(ymax, 5), xfmt: tickFmt, yfmt: tickFmt, xlabel: "years", ylabel: "balance (€)" });
    const curve = (fn) => Array.from({ length: 121 }, (_, i) => { const t = (T * i) / 120; return [f.sx(t), f.sy(fn(t))]; });
    el("line", { x1: f.sx(0), x2: f.sx(T), y1: f.sy(P), y2: f.sy(P), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
    polyline(svg, curve(simple), "stroke:var(--foreground);stroke-width:1.5;stroke-dasharray:6 4");
    polyline(svg, curve(realv), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(svg, curve(fv), "stroke:var(--brand);stroke-width:2.25");
    // Doubling marks along the compound curve.
    const ear = growth(1) - 1;
    const dbl = n === Infinity ? Math.LN2 / r : Math.LN2 / (n * Math.log(1 + r / n));
    for (let k = 1; Number.isFinite(dbl) && dbl * k <= T; k++) {
      el("circle", { cx: f.sx(dbl * k), cy: f.sy(P * 2 ** k), r: 3, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, svg);
    }
    const real = (1 + ear) / (1 + pi) - 1;
    o.fv.textContent = big(fv(T));
    o.simple.textContent = big(simple(T));
    o.ear.textContent = pct(ear, 3);
    o.dbl.textContent = r > 0 ? `${num(dbl, 2)} yr` : "never";
    o.r72.textContent = r > 0 ? `${num(72 / (r * 100), 2)} yr` : "—";
    o.real.textContent = `${pct(real, 2)} (≈ ${pct(ear - pi, 2)} by subtraction)`;
    o.rv.textContent = `${big(realv(T))} in today's prices`;
  }
  draw();
}

// ============================================================ Comparative advantage

for (const root of document.querySelectorAll("[data-econ-ricardo]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const C = (k) => ({ w: s[`${k}w`].get(), c: s[`${k}c`].get(), L: s[`${k}l`].get() });
    const pt = C("pt"), en = C("en"), tot = s.tot.get();
    const ocP = pt.w / pt.c, ocE = en.w / en.c; // cloth given up per unit of wine
    // Autarky: each country makes equal amounts of both goods.
    const autP = pt.L / (pt.w + pt.c), autE = en.L / (en.w + en.c);
    svg.replaceChildren();
    const m = Math.max(pt.L / pt.w, pt.L / pt.c, en.L / en.w, en.L / en.c) * 1.12;
    const f = frame(svg, { box: [52, 16, 488, 280], x: [0, m], y: [0, m], xticks: niceTicks(m, 6), yticks: niceTicks(m, 5), xfmt: tickFmt, yfmt: tickFmt, xlabel: "wine (units)", ylabel: "cloth (units)" });
    const ppf = (c, color) => seg(svg, f, [c.L / c.w, 0], [0, c.L / c.c], `stroke:${color};stroke-width:2`);
    ppf(pt, "var(--ion-na)");
    ppf(en, "var(--vec-u)");
    dot(svg, f, [autP, autP], "var(--ion-na)");
    dot(svg, f, [autE, autE], "var(--vec-u)");

    if (Math.abs(ocP - ocE) < 1e-12) {
      o.ptoc.textContent = `${num(ocP, 3)} cloth`;
      o.enoc.textContent = `${num(ocE, 3)} cloth`;
      o.spec.textContent = "same opportunity costs: no gain from trade";
      o.world.textContent = o.gain.textContent = "—";
      return;
    }
    // The country with the lower opportunity cost of wine makes wine.
    const wineMaker = ocP < ocE ? "pt" : "en";
    const wm = wineMaker === "pt" ? pt : en, cm = wineMaker === "pt" ? en : pt;
    const W = wm.L / wm.w, Cl = cm.L / cm.c;
    // Trade at `tot` cloth per wine: the wine maker keeps its autarky wine
    // amount and sells the rest; the cloth maker gets that wine.
    const aW = wineMaker === "pt" ? autP : autE, aC = wineMaker === "pt" ? autE : autP;
    // (The wine maker keeps exactly its autarky wine, so its gain is in cloth.)
    const exported = W - aW;
    const consW = [aW, tot * exported], consC = [exported, Cl - tot * exported];
    const colorW = wineMaker === "pt" ? "var(--ion-na)" : "var(--vec-u)", colorC = wineMaker === "pt" ? "var(--vec-u)" : "var(--ion-na)";
    seg(svg, f, [W, 0], [0, W * tot], "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:5 4");
    seg(svg, f, [0, Cl], [Cl / tot, 0], "stroke:var(--brand);stroke-width:1.25;stroke-dasharray:5 4");
    el("circle", { cx: f.sx(consW[0]), cy: f.sy(consW[1]), r: 4.5, style: `fill:${colorW};stroke:var(--background);stroke-width:2` }, svg);
    el("circle", { cx: f.sx(consC[0]), cy: f.sy(consC[1]), r: 4.5, style: `fill:${colorC};stroke:var(--background);stroke-width:2` }, svg);

    const name = (k) => (k === "pt" ? "Portugal" : "England");
    o.ptoc.textContent = `${num(ocP, 3)} cloth`;
    o.enoc.textContent = `${num(ocE, 3)} cloth`;
    o.spec.textContent = `${name(wineMaker)} → wine\n${name(wineMaker === "pt" ? "en" : "pt")} → cloth`;
    for (const k of ["spec", "world", "gain"]) o[k].style.whiteSpace = "pre-line";
    o.world.textContent = `${num(W, 3)} wine, ${num(Cl, 3)} cloth\n(autarky: ${num(autP + autE, 3)} of each)`;
    const lo = Math.min(ocP, ocE), hi = Math.max(ocP, ocE);
    const sign = (v) => (v >= 0 ? "+" : "−") + num(Math.abs(v), 3);
    const other = wineMaker === "pt" ? "en" : "pt";
    o.gain.textContent = tot <= lo || tot >= hi
      ? `price outside ${num(lo, 3)}–${num(hi, 3)} cloth per wine: one side would rather not trade`
      : `${name(wineMaker)}: ${sign(consW[1] - aW)} cloth\n${name(other)}: ${sign(consC[0] - aC)} wine, ${sign(consC[1] - aC)} cloth`;
  }
  draw();
}

// ============================================================ Solow

for (const root of document.querySelectorAll("[data-econ-solow]")) {
  const phase = root.querySelector("[data-phase]"), path = root.querySelector("[data-path]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const sv = s.s.get(), al = s.alpha.get(), n = s.n.get(), dl = s.delta.get(), k0 = s.k0.get();
    const nd = n + dl;
    const kstar = nd > 0 ? (sv / nd) ** (1 / (1 - al)) : Infinity;
    const ystar = kstar ** al;
    const kmax = Math.max(Number.isFinite(kstar) ? kstar * 1.8 : 10, k0 * 1.15);

    phase.replaceChildren();
    const f = frame(phase, { box: [40, 16, 268, 248], x: [0, kmax], y: [0, Math.max(kmax ** al, nd * kmax) * 1.05], xticks: niceTicks(kmax, 4), yticks: [], xfmt: tickFmt, xlabel: "capital per worker k" });
    const curve = (fn) => Array.from({ length: 151 }, (_, i) => { const k = (kmax * i) / 150; return [f.sx(k), f.sy(fn(k))]; });
    polyline(phase, curve((k) => k ** al), "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.25");
    polyline(phase, curve((k) => sv * k ** al), "stroke:var(--brand);stroke-width:2");
    polyline(phase, curve((k) => nd * k), "stroke:var(--foreground);stroke-width:2");
    text(phase, f.sx(kmax) - 2, f.sy(kmax ** al) - 6, "f(k)", { "text-anchor": "end" });
    text(phase, f.sx(kmax * 0.55), f.sy(sv * (kmax * 0.55) ** al) + 14, "s·f(k)", { style: "fill:var(--brand)" });
    text(phase, f.sx(kmax) - 2, f.sy(nd * kmax) + 14, "(n+δ)k", { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    if (Number.isFinite(kstar) && kstar <= kmax) {
      el("line", { x1: f.sx(kstar), x2: f.sx(kstar), y1: f.sy(nd * kstar), y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, phase);
      dot(phase, f, [kstar, nd * kstar], "var(--brand)");
      text(phase, f.sx(kstar) + 4, f.T + f.H - 4, "k*", { style: "fill:var(--brand)" });
    }

    // The path from k₀, one year at a time.
    const T = 200, ks = [k0];
    for (let t = 0; t < T; t++) { const k = ks[t]; ks.push(k + sv * k ** al - nd * k); }
    path.replaceChildren();
    const ymax = Math.max(...ks, Number.isFinite(kstar) ? kstar : 0) * 1.1;
    const g = frame(path, { box: [40, 16, 268, 248], x: [0, T], y: [0, ymax], xticks: [0, 50, 100, 150, 200], yticks: niceTicks(ymax, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "years", ylabel: "k" });
    if (Number.isFinite(kstar)) el("line", { x1: g.L, x2: g.L + g.W, y1: g.sy(kstar), y2: g.sy(kstar), style: "stroke:var(--brand);stroke-dasharray:3 3" }, path);
    polyline(path, ks.map((k, t) => [g.sx(t), g.sy(k)]), "stroke:var(--foreground);stroke-width:2");

    const gap0 = Math.abs(k0 - kstar);
    const half = ks.findIndex((k) => Math.abs(k - kstar) <= gap0 / 2);
    o.k.textContent = Number.isFinite(kstar) ? num(kstar, 3) : "∞";
    o.y.textContent = Number.isFinite(ystar) ? num(ystar, 3) : "∞";
    o.c.textContent = Number.isFinite(ystar) ? num((1 - sv) * ystar, 3) : "∞";
    o.gold.textContent = `${num(al, 2)} (maximises c*)`;
    o.half.textContent = gap0 < 1e-9 ? "already there" : half > 0 ? `${half} years` : "> 200 years";
  }
  draw();
}

// ============================================================ Multiplier

for (const root of document.querySelectorAll("[data-econ-multiplier]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw(false));
  root.querySelector("[data-action=replay]").addEventListener("click", () => draw(true));

  function draw(animate) {
    const G = s.g.get(), m = s.mpc.get();
    const rounds = 20;
    const spend = Array.from({ length: rounds }, (_, i) => G * m ** i);
    const total = m < 1 ? G / (1 - m) : Infinity;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 490, 170], x: [0, rounds], y: [0, Math.max(total, G) * 1.05], xticks: [0, 5, 10, 15, 20], yticks: niceTicks(total * 1.05, 4), xfmt: tickFmt, yfmt: tickFmt, xlabel: "round", ylabel: "€bn" });
    let run = 0;
    const totals = [];
    spend.forEach((v, i) => {
      run += v;
      totals.push([f.sx(i + 0.5), f.sy(run)]);
      const x0 = f.sx(i) + 2, w = f.sx(1) - f.sx(0) - 4;
      const bar = el("rect", { x: x0, y: f.sy(v), width: w, height: f.T + f.H - f.sy(v), rx: 2, style: "fill:var(--brand);fill-opacity:0.75;transform-box:fill-box;transform-origin:bottom" }, svg);
      // A short stagger shows the rounds as a sequence (rare, explanatory).
      if (animate && !reduced()) bar.animate([{ transform: "scaleY(0)", opacity: 0 }, { transform: "scaleY(1)", opacity: 1 }], { duration: 260, delay: i * 45, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
    });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(total), y2: f.sy(total), style: "stroke:var(--vec-u);stroke-dasharray:4 4" }, svg);
    text(svg, f.L + f.W - 2, f.sy(total) - 5, `limit ${num(total, 1)}`, { "text-anchor": "end", style: "fill:var(--vec-u)" });
    polyline(svg, totals, "stroke:var(--foreground);stroke-width:1.5");
    o.k.textContent = m < 1 ? `1 / (1 − ${num(m, 2)}) = ${num(1 / (1 - m), 2)}` : "∞";
    o.total.textContent = `€${num(total, 2)}bn`;
    o.ten.textContent = `€${num(G * (1 - m ** 10) / (1 - m), 2)}bn`;
  }
  draw(false);
}
