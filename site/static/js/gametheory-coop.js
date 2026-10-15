// Game theory blocks, part three: Gale–Shapley deferred acceptance, the
// Shapley value over every ordering, Rubinstein alternating offers and a
// traffic light as a correlated equilibrium.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { Q, Q0, Q1, solve, outs, segOf, minus, h, mulberry32 } from "./gametheory-util.js";

// ============================================================ Stable matching

const RES = ["Ada", "Ben", "Cyd", "Dee"];
const HOS = ["North", "South", "East", "West"];
// Cyclic preferences: each side's first choices conflict, so the two
// proposing orders give different stable matchings.
const PREF_R = [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]];
const PREF_H = [[1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2], [0, 1, 2, 3]];

const permutations = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

/** Blocking pairs of a matching m (resident i ↦ hospital m[i]). */
export function blockingPairs(m, pr, ph) {
  const rankR = pr.map((l) => Object.fromEntries(l.map((x, k) => [x, k])));
  const rankH = ph.map((l) => Object.fromEntries(l.map((x, k) => [x, k])));
  const inv = []; m.forEach((j, i) => (inv[j] = i));
  const out = [];
  for (let i = 0; i < m.length; i++) for (let j = 0; j < m.length; j++) {
    if (m[i] === j) continue;
    if (rankR[i][j] < rankR[i][m[i]] && rankH[j][i] < rankH[j][inv[j]]) out.push([i, j]);
  }
  return out;
}

for (const root of document.querySelectorAll("[data-gt-matching]")) {
  const o = outs(root);
  const board = root.querySelector("[data-board]");
  const log = root.querySelector("[data-log]");
  let pr = PREF_R.map((l) => [...l]), ph = PREF_H.map((l) => [...l]);
  let side = "r", st, seed = 11;

  function reset() {
    const n = RES.length;
    st = { next: Array(n).fill(0), held: Array(n).fill(null), free: [...Array(n).keys()], rejected: Array.from({ length: n }, () => new Set()), count: 0, done: false };
    log.replaceChildren();
    render();
  }
  // Proposers and receivers in the current orientation.
  const P = () => (side === "r" ? { pp: pr, rp: ph, pn: RES, rn: HOS } : { pp: ph, rp: pr, pn: HOS, rn: RES });

  function step() {
    if (st.done) return false;
    const { pp, rp, pn, rn } = P();
    const i = st.free[0];
    if (i === undefined) { finish(); return false; }
    const j = pp[i][st.next[i]++];
    st.count++;
    const cur = st.held[j];
    const rank = (r, x) => rp[r].indexOf(x);
    let msg;
    if (cur === null) { st.held[j] = i; st.free.shift(); msg = [`${pn[i]} → ${rn[j]}`, "held", "text-brand"]; }
    else if (rank(j, i) < rank(j, cur)) {
      st.held[j] = i; st.free.shift(); st.free.push(cur); st.rejected[cur].add(j);
      msg = [`${pn[i]} → ${rn[j]}`, `held, ${pn[cur]} released`, "text-brand"];
    } else { st.rejected[i].add(j); msg = [`${pn[i]} → ${rn[j]}`, "rejected", "text-muted-foreground"]; }
    log.append(h("li", { class: "flex justify-between gap-3" }, h("span", { text: `${st.count}. ${msg[0]}` }), h("span", { class: msg[2], text: msg[1] })));
    log.scrollTop = log.scrollHeight;
    if (!st.free.length) finish();
    render();
    return true;
  }
  function finish() {
    st.done = true;
    if (!log.querySelector("[data-end]")) log.append(h("li", { "data-end": "", class: "pt-1 text-muted-foreground", text: "Everyone is held: the offers become final." }));
  }
  /** Current matching as resident ↦ hospital, or null if not complete. */
  function matching() {
    if (!st.done) return null;
    const m = Array(RES.length);
    st.held.forEach((i, j) => { if (side === "r") m[i] = j; else m[j] = i; });
    return m;
  }

  function prefCard(name, list, names, who, idx, partner) {
    return h("div", { class: "flex flex-col gap-1.5 rounded-lg border bg-background p-2.5" },
      h("div", { class: "flex items-center justify-between gap-2" },
        h("span", { class: `text-sm font-medium ${who === "r" ? "text-vec-u" : "text-vec-v"}`, text: name }),
        h("span", { class: "font-mono text-[11px] text-brand", text: partner != null ? `with ${partner}` : "" })),
      h("ol", { class: "flex flex-wrap gap-1" }, list.map((x, k) => {
        const isPartner = names[x] === partner;
        const rejected = (side === who && st.rejected[idx].has(x));
        return h("li", { class: `flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${isPartner ? "border-brand ring-2 ring-brand/25" : ""} ${rejected ? "line-through opacity-50" : ""}` },
          h("span", { class: "text-muted-foreground", text: `${k + 1}` }), ` ${names[x]}`,
          k > 0 ? h("button", { type: "button", "data-up": `${who}:${idx}:${k}`, "aria-label": `Move ${names[x]} up in ${name}'s ranking`, class: "ml-0.5 rounded px-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50", text: "↑" }) : null);
      })));
  }

  function render() {
    const m = matching();
    // Partners from current holds, shown live.
    const partnerOfR = Array(RES.length).fill(null), partnerOfH = Array(HOS.length).fill(null);
    st.held.forEach((i, j) => {
      if (i === null) return;
      if (side === "r") { partnerOfR[i] = HOS[j]; partnerOfH[j] = RES[i]; } else { partnerOfH[i] = RES[j]; partnerOfR[j] = HOS[i]; }
    });
    const pairs = h("div", { class: "flex flex-row flex-wrap justify-center gap-2 sm:flex-col" },
      RES.map((r, i) => h("div", { class: `rounded-md border px-2 py-1 text-center font-mono text-[11px] ${partnerOfR[i] ? "border-brand/50" : "opacity-50"}`, text: `${r} — ${partnerOfR[i] ?? "…"}` })));
    board.replaceChildren(
      h("div", { class: "flex flex-col gap-2" }, h("span", { class: "font-mono text-[11px] tracking-wider text-muted-foreground uppercase", text: "Residents" }), RES.map((r, i) => prefCard(r, pr[i], HOS, "r", i, partnerOfR[i]))),
      pairs,
      h("div", { class: "flex flex-col gap-2" }, h("span", { class: "font-mono text-[11px] tracking-wider text-muted-foreground uppercase", text: "Hospitals" }), HOS.map((x, j) => prefCard(x, ph[j], RES, "h", j, partnerOfH[j]))));
    o.rounds.textContent = `${st.count} proposals`;
    // All stable matchings by brute force (4! = 24 candidates).
    const stable = permutations([0, 1, 2, 3]).filter((mm) => blockingPairs(mm, pr, ph).length === 0);
    o.nstable.textContent = String(stable.length);
    if (m) {
      const bp = blockingPairs(m, pr, ph);
      o.blocking.textContent = bp.length ? bp.map(([i, j]) => `${RES[i]}–${HOS[j]}`).join(", ") : "none: stable";
      const rr = m.reduce((s, j, i) => s + pr[i].indexOf(j) + 1, 0) / RES.length;
      const inv = []; m.forEach((j, i) => (inv[j] = i));
      const hr = inv.reduce((s, i, j) => s + ph[j].indexOf(i) + 1, 0) / HOS.length;
      const bestR = Math.min(...stable.map((mm) => mm.reduce((s, j, i) => s + pr[i].indexOf(j) + 1, 0) / RES.length));
      const bestH = Math.min(...stable.map((mm) => { const iv = []; mm.forEach((j, i) => (iv[j] = i)); return iv.reduce((s, i, j) => s + ph[j].indexOf(i) + 1, 0) / HOS.length; }));
      o.rrank.textContent = `${num(rr, 2)}${rr === bestR ? " (best stable)" : ""}`;
      o.hrank.textContent = `${num(hr, 2)}${hr === bestH ? " (best stable)" : ""}`;
    } else {
      o.blocking.textContent = "—"; o.rrank.textContent = "—"; o.hrank.textContent = "—";
    }
  }

  board.addEventListener("click", (e) => {
    const b = e.target.closest("[data-up]");
    if (!b) return;
    const [who, idx, k] = b.dataset.up.split(":");
    const list = (who === "r" ? pr : ph)[+idx];
    [list[k - 1], list[k]] = [list[k], list[k - 1]];
    reset();
    root.querySelector(`[data-up="${who}:${idx}:${k - 1}"]`)?.focus();
  });
  root.addEventListener("seg-change", (e) => { side = e.detail.value; reset(); });
  root.querySelector("[data-action=step]").addEventListener("click", step);
  root.querySelector("[data-action=run]").addEventListener("click", () => { for (let g = 0; g < 64 && step(); g++); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  root.querySelector("[data-action=shuffle]").addEventListener("click", () => {
    const rnd = mulberry32(seed++);
    const shuf = () => { const a = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    pr = RES.map(shuf); ph = HOS.map(shuf);
    reset();
  });
  reset();
}

// ============================================================ Shapley value

function shapleyGame(kind, s) {
  if (kind === "gloves") {
    const names = ["Left glove 1", "Left glove 2", "Right glove"];
    return { names, unit: "", v: (S) => Math.min(S.filter((i) => i < 2).length, S.includes(2) ? 1 : 0),
      foot: "A pair of gloves is worth 1. The right glove is scarce, so its owner gets 2/3. The core is harsher: it gives the right glove everything, (0, 0, 1)." };
  }
  if (kind === "airport") {
    const c = [s.c1.get(), s.c2.get(), s.c3.get()];
    return { names: ["Small plane", "Medium plane", "Large plane"], unit: " M€", cost: true, v: (S) => (S.length ? Math.max(...S.map((i) => c[i])) : 0),
      foot: "A runway long enough for the largest plane in a group costs that plane's requirement. Littlechild & Owen (1973): the Shapley value splits each stretch of runway equally among the planes that use it." };
  }
  const w = [s.w1.get(), s.w2.get(), s.w3.get(), s.w4.get()], q = s.q.get();
  return { names: ["Party A", "Party B", "Party C", "Party D"], unit: "", vote: true, w, q,
    v: (S) => (S.reduce((t, i) => t + w[i], 0) >= q ? 1 : 0),
    foot: "The Shapley–Shubik power index (1954): the share of orderings in which a party's arrival turns a losing coalition into a winning one. Seats are not power." };
}

for (const root of document.querySelectorAll("[data-gt-shapley]")) {
  const o = outs(root);
  const bars = root.querySelector("[data-bars]");
  const table = root.querySelector("[data-orders]");
  const s = scrubAll(root, () => draw());
  let kind = "gloves";

  function draw() {
    for (const p of root.querySelectorAll("[data-params]")) p.hidden = p.dataset.params !== kind;
    const g = shapleyGame(kind, s);
    const n = g.names.length;
    const orders = permutations([...Array(n).keys()]);
    const sums = Array(n).fill(Q0);
    const rows = orders.map((ord) => {
      const marg = Array(n);
      const S = [];
      for (const i of ord) { const before = g.v(S); S.push(i); marg[i] = g.v(S) - before; }
      marg.forEach((m, i) => (sums[i] = sums[i].add(Q.of(m))));
      return { ord, marg };
    });
    const phi = sums.map((x) => x.div(Q.of(orders.length)));
    const total = g.v([...Array(n).keys()]);
    const fmt = (x) => `${x}${g.unit}`;
    bars.replaceChildren(...g.names.map((name, i) => {
      const share = total ? phi[i].toNumber() / total : 0;
      return h("div", { class: "flex flex-col gap-1" },
        h("div", { class: "flex items-baseline justify-between gap-3 text-sm" },
          h("span", { text: name + (g.vote ? ` (${g.w[i]} seats)` : "") }),
          h("span", { class: "font-mono text-xs tabular-nums", text: `${fmt(phi[i])}${g.cost || g.vote || kind === "gloves" ? `  ·  ${num(share * 100, 1)}%` : ""}` })),
        h("div", { class: "h-2 overflow-hidden rounded-full bg-muted" },
          h("div", { class: "h-full rounded-full bg-brand transition-[width] duration-300 ease-out", style: `width:${(share * 100).toFixed(2)}%` })));
    }));
    // Orderings table.
    const head = h("tr", { class: "text-muted-foreground" }, h("th", { class: "py-1 pr-3 text-left font-normal", text: "order of arrival" }),
      g.names.map((nm) => h("th", { class: "px-2 py-1 text-right font-normal", text: nm.replace("Left glove ", "L").replace("Right glove", "R").replace("Party ", "").replace(" plane", "") })));
    const body = rows.map((r) => h("tr", { class: "border-t border-border/50" },
      h("td", { class: "py-1 pr-3 text-left", text: r.ord.map((i) => g.names[i].replace("Left glove ", "L").replace("Right glove", "R").replace("Party ", "").replace(" plane", "")).join(" → ") }),
      r.marg.map((m) => h("td", { class: `px-2 py-1 text-right ${g.vote && m ? "font-medium text-brand" : m ? "" : "text-muted-foreground"}`, text: minus(`${m}`) }))));
    const avg = h("tr", { class: "border-t" }, h("td", { class: "py-1 pr-3 text-left font-medium", text: "average = Shapley value" }), phi.map((x) => h("td", { class: "px-2 py-1 text-right font-medium text-brand", text: `${x}` })));
    table.replaceChildren(h("thead", {}, head), h("tbody", {}, body, avg));
    o.orders.textContent = `${orders.length} = ${n}!`;
    o.total.textContent = fmt(total);
    if (g.vote) {
      const dummies = g.names.filter((_, i) => phi[i].isZero());
      o.note.textContent = total ? (dummies.length ? `${dummies.join(", ")}: no power at all` : "every party is pivotal sometimes") : "no coalition reaches the quota";
    } else o.note.textContent = g.cost ? "shares of the runway cost" : "shares of one pair";
    o.foot.textContent = g.foot;
  }
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });
  draw();
}

// ============================================================ Rubinstein bargaining

/** Proposer's share at each round t = 1…T with a deadline after round T. */
export function rubinsteinFinite(d1, d2, T) {
  const s = Array(T + 2).fill(0);
  s[T] = 1;
  for (let t = T - 1; t >= 1; t--) {
    const responder = t % 2 === 1 ? d2 : d1; // P1 proposes in odd rounds
    s[t] = 1 - responder * s[t + 1];
  }
  return s;
}

for (const root of document.querySelectorAll("[data-gt-bargaining]")) {
  const svg = root.querySelector("[data-plot]");
  const tbl = root.querySelector("[data-rounds]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());

  function draw() {
    const d1 = s.d1.get(), d2 = s.d2.get(), T = Math.round(s.T.get());
    const inf = (1 - d2) / (1 - d1 * d2);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 560, 224], x: [0.5, 30.5], y: [0, 1], xticks: [1, 5, 10, 15, 20, 25, 30], yticks: [0, 0.25, 0.5, 0.75, 1], xlabel: "rounds before the deadline T", ylabel: "player 1's share" });
    el("line", { x1: f.sx(0.5), x2: f.sx(30.5), y1: f.sy(inf), y2: f.sy(inf), style: "stroke:var(--brand);stroke-width:2;stroke-dasharray:6 4" }, svg);
    text(svg, f.sx(30.5) - 2, f.sy(inf) + (inf > 0.85 ? 14 : -6), `(1−δ₂)/(1−δ₁δ₂) = ${num(inf, 4)}`, { "text-anchor": "end", class: "fill-brand font-mono text-[10px]" });
    const pts = [];
    for (let k = 1; k <= 30; k++) pts.push([k, rubinsteinFinite(d1, d2, k)[1]]);
    polyline(svg, pts.map(([k, v]) => [f.sx(k), f.sy(v)]), "stroke:var(--vec-u);stroke-width:1.25;stroke-opacity:0.6");
    for (const [k, v] of pts) el("circle", { cx: f.sx(k), cy: f.sy(v), r: k === T ? 5 : 2.75, style: k === T ? "fill:var(--vec-u);stroke:var(--background);stroke-width:2" : "fill:var(--vec-u)" }, svg);
    const sh = rubinsteinFinite(d1, d2, T);
    // Round-by-round table.
    const head = h("tr", { class: "text-muted-foreground" }, ["round", "proposer", "proposer keeps", "offers the other", "responder's discount"].map((c) => h("th", { class: "px-2 py-1 text-right font-normal first:text-left", text: c })));
    const rows = [];
    for (let t = 1; t <= T; t++) {
      const p1 = t % 2 === 1;
      rows.push(h("tr", { class: `border-t border-border/50 ${t === 1 ? "text-foreground" : "text-muted-foreground"}` },
        h("td", { class: "px-2 py-1 text-left", text: String(t) }),
        h("td", { class: `px-2 py-1 text-right ${p1 ? "text-vec-u" : "text-vec-v"}`, text: p1 ? "player 1" : "player 2" }),
        h("td", { class: "px-2 py-1 text-right", text: num(sh[t], 4) }),
        h("td", { class: "px-2 py-1 text-right", text: num(1 - sh[t], 4) }),
        h("td", { class: "px-2 py-1 text-right", text: t === T ? "last round: take it or leave it" : `δ${p1 ? "₂" : "₁"} = ${num(p1 ? d2 : d1, 2)}` })));
    }
    tbl.replaceChildren(h("thead", {}, head), h("tbody", {}, rows));
    o.fin.textContent = num(sh[1], 4);
    o.inf.textContent = num(inf, 4);
    o.inf2.textContent = num(1 - inf, 4) + ` = δ₂(1−δ₁)/(1−δ₁δ₂)`;
    o.offer.textContent = `player 1 keeps ${num(sh[1] * 100, 1)}%, player 2 accepts`;
  }
  draw();
}

// ============================================================ Correlated equilibrium

// Payoffs (driver 1, driver 2) for (S,S), (S,G), (G,S), (G,G), from Aumann (1974).
const CE_PAY = { ss: [6, 6], sg: [2, 7], gs: [7, 2], gg: [0, 0] };

/** The four obedience constraints for probabilities in whole percent. */
export function obedience(p) {
  return [
    { who: 1, told: "Stop", alt: "Go", slack: 2 * p.sg - p.ss },  // p_ss(6−7) + p_sg(2−0)
    { who: 1, told: "Go", alt: "Stop", slack: p.gs - 2 * p.gg },  // p_gs(7−6) + p_gg(0−2)
    { who: 2, told: "Stop", alt: "Go", slack: 2 * p.gs - p.ss },
    { who: 2, told: "Go", alt: "Stop", slack: p.sg - 2 * p.gg },
  ];
}

/** Vertices of the correlated-equilibrium polytope, projected to payoffs. */
function cePolytope() {
  // Variables (ss, sg, gs); gg = 1 − ss − sg − gs. Constraints c·x ≥ b.
  const C = [
    [[-1, 2, 0], 0], [[2, 2, 3], 2], [[-1, 0, 2], 0], [[2, 3, 2], 2], // obedience with gg substituted
    [[1, 0, 0], 0], [[0, 1, 0], 0], [[0, 0, 1], 0], [[-1, -1, -1], -1],
  ];
  const pts = [];
  for (let a = 0; a < C.length; a++) for (let b = a + 1; b < C.length; b++) for (let c = b + 1; c < C.length; c++) {
    const x = solve([C[a][0], C[b][0], C[c][0]], [C[a][1], C[b][1], C[c][1]]);
    if (!x) continue;
    const xs = x.map((q) => q.toNumber());
    if (C.every(([v, r]) => v[0] * xs[0] + v[1] * xs[1] + v[2] * xs[2] >= r - 1e-12)) {
      const [ss, sg, gs] = xs;
      pts.push([6 * ss + 2 * sg + 7 * gs, 6 * ss + 7 * sg + 2 * gs]);
    }
  }
  return hull(pts);
}
function hull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), q) <= 1e-12) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up.at(-2), up.at(-1), q) <= 1e-12) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

for (const root of document.querySelectorAll("[data-gt-correlated]")) {
  const svg = root.querySelector("[data-plot]");
  const light = root.querySelector("[data-light]");
  const checks = root.querySelector("[data-checks]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  const poly = cePolytope();
  let seed = 3, signal = null;

  const probs = () => {
    const ss = Math.round(s.ss.get()), sg = Math.round(s.sg.get()), gs = Math.round(s.gs.get());
    return { ss, sg, gs, gg: 100 - ss - sg - gs };
  };

  function draw() {
    const p = probs();
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 300, 270], x: [0, 8], y: [0, 8], xticks: [0, 2, 4, 6, 8], yticks: [0, 2, 4, 6, 8], xlabel: "driver 1", ylabel: "driver 2" });
    // Feasible payoffs and the CE polytope.
    const outcomes = [[6, 6], [2, 7], [7, 2], [0, 0]];
    el("polygon", { points: hull(outcomes).map(([x, y]) => `${f.sx(x)},${f.sy(y)}`).join(" "), style: "fill:none;stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, svg);
    el("polygon", { points: poly.map(([x, y]) => `${f.sx(x).toFixed(1)},${f.sy(y).toFixed(1)}`).join(" "), style: "fill:var(--vec-u);fill-opacity:0.2;stroke:var(--vec-u);stroke-width:1.5" }, svg);
    // Nash equilibria: two pure, one mixed (each Goes with probability 1/3).
    for (const [x, y, lbl] of [[7, 2, "Nash"], [2, 7, "Nash"], [14 / 3, 14 / 3, "mixed Nash"]]) {
      el("circle", { cx: f.sx(x), cy: f.sy(y), r: 4, style: "fill:var(--foreground)" }, svg);
      text(svg, f.sx(x) + 7, f.sy(y) + 4, lbl, { class: "fill-foreground font-mono text-[10px]" });
    }
    const valid = p.gg >= 0;
    const e1 = valid ? (6 * p.ss + 2 * p.sg + 7 * p.gs) / 100 : NaN, e2 = valid ? (6 * p.ss + 7 * p.sg + 2 * p.gs) / 100 : NaN;
    if (valid) {
      el("circle", { cx: f.sx(e1), cy: f.sy(e2), r: 6, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    }
    // Side panel: the payoff table.
    const tx = 400, ty = 40, cw = 90, chh = 46;
    text(svg, tx + cw, ty - 14, "driver 2", { "text-anchor": "middle", class: "fill-vec-v font-mono text-[10px]" });
    const labels = [["ss", 0, 0], ["sg", 0, 1], ["gs", 1, 0], ["gg", 1, 1]];
    ["Stop", "Go"].forEach((nm, k) => {
      text(svg, tx + cw / 2 + k * cw, ty + 4, nm, { "text-anchor": "middle", class: "fill-vec-v font-mono text-[10px]" });
      text(svg, tx - 8, ty + 14 + chh / 2 + k * chh, nm, { "text-anchor": "end", class: "fill-vec-u font-mono text-[10px]" });
    });
    text(svg, tx - 8, ty - 14, "driver 1", { "text-anchor": "end", class: "fill-vec-u font-mono text-[10px]" });
    for (const [key, r, c] of labels) {
      const x = tx + c * cw, y = ty + 10 + r * chh, pr = Math.max(0, p[key]);
      el("rect", { x, y, width: cw - 4, height: chh - 4, rx: 6, style: `fill:var(--brand);fill-opacity:${(0.05 + 0.5 * pr / 100).toFixed(3)};stroke:currentColor;stroke-opacity:${signal === key ? 0.9 : 0.15};stroke-width:${signal === key ? 2 : 1}` }, svg);
      text(svg, x + (cw - 4) / 2, y + 18, `(${CE_PAY[key].join(", ")})`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      text(svg, x + (cw - 4) / 2, y + 34, `${p[key]}%`, { "text-anchor": "middle", class: `font-mono text-[10px] ${p[key] < 0 ? "fill-del" : "fill-muted-foreground"}` });
    }
    text(svg, tx + cw, ty + 10 + 2 * chh + 18, "payoffs and the light's odds", { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" });

    o.gg.textContent = valid ? `Go / Go: ${p.gg}% (the remainder)` : `the three add up to ${100 - p.gg}%: more than 100%`;
    const cs = obedience(p);
    checks.replaceChildren(...cs.map((c) => {
      const ok = c.slack >= 0;
      return h("div", { class: "flex items-center justify-between gap-2" },
        h("span", {}, h("span", { class: c.who === 1 ? "text-vec-u" : "text-vec-v", text: `driver ${c.who}` }), ` told ${c.told}`),
        h("span", { class: ok ? "text-foreground" : "text-del", text: ok ? `obeys (${c.slack === 0 ? "indifferent" : `+${num(c.slack / 100, 2)}`})` : `would ${c.alt} (+${num(-c.slack / 100, 2)})` }));
    }));
    if (!valid) { o.pay.textContent = "—"; o.total.textContent = "—"; o.verdict.textContent = "probabilities exceed 100%"; return; }
    o.pay.textContent = `(${num(e1, 2)}, ${num(e2, 2)})`;
    o.total.textContent = `${num(e1 + e2, 2)} (pure Nash: 9, mixed Nash: ${num(28 / 3, 2)})`;
    const bad = cs.filter((c) => c.slack < 0);
    o.verdict.textContent = bad.length ? `not an equilibrium: ${bad.length} instruction${bad.length > 1 ? "s are" : " is"} not worth obeying` : "a correlated equilibrium";
    renderLight();
  }
  function renderLight() {
    const lamp = (who, sig) => h("div", { class: "flex items-center gap-2" },
      h("span", { class: `font-mono text-[11px] ${who === 1 ? "text-vec-u" : "text-vec-v"}`, text: `driver ${who}` }),
      h("span", { class: `rounded-md border px-2 py-0.5 font-mono text-xs transition-colors duration-200 ${sig === "Go" ? "border-add text-add" : sig === "Stop" ? "border-del text-del" : "text-muted-foreground"}`, text: sig ?? "—" }));
    const k = signal;
    light.replaceChildren(
      h("span", { class: "text-muted-foreground", text: "Light says:" }),
      lamp(1, k ? (k[0] === "s" ? "Stop" : "Go") : null),
      lamp(2, k ? (k[1] === "s" ? "Stop" : "Go") : null),
      h("span", { class: "text-xs text-muted-foreground", text: k ? "each driver sees only their own lamp" : "draw a signal to see one" }));
  }
  root.querySelector("[data-action=best]").addEventListener("click", () => {
    // The symmetric CE maximising the total: ss 1/2, sg = gs = 1/4 → 5.25 each.
    s.ss.set(50, false); s.sg.set(25, false); s.gs.set(25, false);
    signal = null; draw();
  });
  root.querySelector("[data-action=draw]").addEventListener("click", () => {
    const p = probs();
    if (p.gg < 0) return;
    const r = mulberry32(seed++)() * 100;
    signal = r < p.ss ? "ss" : r < p.ss + p.sg ? "sg" : r < p.ss + p.sg + p.gs ? "gs" : "gg";
    draw();
  });
  draw();
}
