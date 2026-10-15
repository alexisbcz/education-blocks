// Combinatorics blocks, part two: set partitions with Stirling and Bell
// numbers, making change with generating functions, domino tilings and
// their recurrences, Ramsey's R(3, 3) = 6 and the ballot problem.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";
import { outs, VEC, fmtBig, binom, ratio, node, onToggle, onAction, sup, selectSeg } from "./combinatorics-util.js";

const mix = (c, p) => `color-mix(in oklch, ${c} ${p}%, transparent)`;
const NS = "http://www.w3.org/2000/svg";
const svgNode = (viewBox, label) => {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("class", "block w-full");
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", label);
  return s;
};

// ============================================================ set partitions

// Restricted growth strings: a[i] ≤ 1 + max(a[0..i−1]).
function setPartitions(n) {
  const out = [], a = new Array(n).fill(0);
  const rec = (i, m) => {
    if (i === n) { out.push(a.slice()); return; }
    for (let g = 0; g <= m + 1; g++) { a[i] = g; rec(i + 1, Math.max(m, g)); }
  };
  if (n === 0) return [[]];
  a[0] = 0;
  rec(1, 0);
  return out;
}
const stirling = [[1n]];
function S(n, k) {
  for (let i = stirling.length; i <= n; i++) {
    stirling[i] = [];
    for (let j = 0; j <= i; j++) stirling[i][j] = (j <= i - 1 ? BigInt(j) * (stirling[i - 1][j] ?? 0n) : 0n) + (j >= 1 ? (stirling[i - 1][j - 1] ?? 0n) : 0n);
  }
  return stirling[n][k] ?? 0n;
}
function bell(n) {
  let row = [1n];
  for (let i = 1; i <= n; i++) {
    const next = [row[row.length - 1]];
    for (const v of row) next.push(next[next.length - 1] + v);
    row = next;
  }
  return row[0];
}

for (const root of document.querySelectorAll("[data-comb-stirling]")) {
  const tri = root.querySelector("[data-triangle]"), gallery = root.querySelector("[data-gallery]");
  const o = outs(root);
  let showAll = false;
  const s = scrubAll(root, (name) => (name === "big" ? big() : draw()));
  onToggle(root, (_, on) => { showAll = on; draw(); });

  function table(n, k) {
    const t = node("table", "font-mono text-[11px] tabular-nums");
    const head = node("tr");
    head.append(node("th", "px-1.5 py-1 text-left font-normal text-muted-foreground", "n \\ k"));
    for (let j = 1; j <= 10; j++) head.append(node("th", "px-1.5 py-1 text-right font-normal text-muted-foreground", String(j)));
    head.append(node("th", "px-1.5 py-1 pl-3 text-right font-normal text-muted-foreground", "Bₙ"));
    t.append(head);
    for (let i = 1; i <= 10; i++) {
      const tr = node("tr");
      tr.append(node("td", "px-1.5 py-0.5 text-muted-foreground", String(i)));
      for (let j = 1; j <= 10; j++) {
        const td = node("td", "px-0.5 py-0.5 text-right");
        if (j <= i) {
          const v = fmtBig(S(i, j));
          if (i <= 6) {
            const b = node("button", "w-full rounded px-1 py-0.5 text-right outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50", v);
            b.type = "button";
            b.setAttribute("aria-label", `S(${i}, ${j}) = ${v}`);
            if (i === n && (j === k || showAll)) b.classList.add("ring-2", "ring-[var(--brand)]", "text-foreground");
            else b.classList.add("text-muted-foreground");
            b.addEventListener("click", () => { s.n.set(i, false); s.k.set(j, false); draw(); });
            td.append(b);
          } else td.append(node("span", "px-1 text-muted-foreground/70", v));
        }
        tr.append(td);
      }
      tr.append(node("td", "px-1.5 py-0.5 pl-3 text-right text-foreground", fmtBig(bell(i))));
      t.append(tr);
    }
    tri.replaceChildren(t);
  }

  function chip(group, members) {
    const c = VEC[group % VEC.length];
    const span = node("span", "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] text-foreground");
    span.style.background = mix(c, 22);
    span.style.boxShadow = `inset 0 0 0 1px ${c}`;
    span.textContent = members.join(" ");
    return span;
  }

  function draw() {
    const n = Math.round(s.n.get());
    let k = Math.round(s.k.get());
    if (k > n) { k = n; s.k.set(k, false); }
    table(n, k);
    const parts = setPartitions(n).map((a) => {
      const g = Math.max(-1, ...a) + 1;
      return { g, groups: Array.from({ length: g }, (_, j) => a.map((v, i) => (v === j ? i + 1 : 0)).filter(Boolean)) };
    });
    const shown = (showAll ? parts : parts.filter((p) => p.g === k)).sort((a, b) => a.g - b.g);
    gallery.replaceChildren(...shown.map((p) => {
      const card = node("div", "flex flex-wrap content-start gap-1 rounded-lg border bg-background p-1.5");
      card.setAttribute("aria-label", p.groups.map((g) => `{${g.join(", ")}}`).join(" "));
      p.groups.forEach((members, j) => card.append(chip(j, members)));
      return card;
    }));
    o.snk.textContent = `S(${n}, ${k}) = ${fmtBig(S(n, k))}`;
    o.shown.textContent = `${shown.length} partition${shown.length === 1 ? "" : "s"}`;
    o.bell.textContent = `B${String(n).split("").map((d) => "₀₁₂₃₄₅₆₇₈₉"[d]).join("")} = ${fmtBig(bell(n))}`;
  }
  function big() { o.big.textContent = fmtBig(bell(Math.round(s.big.get()))); }
  draw(); big();
}

// ============================================================ making change

for (const root of document.querySelectorAll("[data-comb-coins]")) {
  const svg = root.querySelector("[data-plot]");
  const product = root.querySelector('[data-line="product"]'), waysBox = root.querySelector("[data-ways]");
  const o = outs(root);
  const coinBtns = [...root.querySelectorAll("[data-coin]")];
  let used = 0;
  const active = () => coinBtns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => Number(b.dataset.coin)).sort((a, b) => a - b);
  const s = scrubAll(root, () => draw());
  coinBtns.forEach((b) => b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
    used = active().length;
    draw();
  }));
  onAction(root, (a) => {
    const c = active();
    if (a === "step") used = used >= c.length ? 1 : used + 1;
    if (a === "all") used = c.length;
    draw();
  });
  used = active().length;

  function series(coins, N) {
    const a = new Array(N + 1).fill(0n);
    a[0] = 1n;
    for (const c of coins) for (let i = c; i <= N; i++) a[i] += a[i - c];
    return a;
  }
  // First ways, largest coins first.
  function ways(coins, N, limit = 12) {
    const out = [], desc = coins.slice().sort((a, b) => b - a), acc = [];
    const rec = (rest, from) => {
      if (out.length >= limit) return;
      if (rest === 0) { out.push(acc.slice()); return; }
      for (let i = from; i < desc.length; i++) if (desc[i] <= rest) { acc.push(desc[i]); rec(rest - desc[i], i); acc.pop(); }
    };
    rec(N, 0);
    return out;
  }

  function draw() {
    const coins = active(), N = Math.round(s.amount.get());
    used = Math.min(used, coins.length);
    const usedCoins = coins.slice(0, used);
    product.replaceChildren(...(coins.length ? coins.map((c, i) => node("span", i < used ? "text-foreground" : "text-muted-foreground/50", `(1 + x${c === 1 ? "" : sup(c)} + x${sup(2 * c)} + …)`)) : [node("span", "text-muted-foreground", "Turn on at least one coin.")]));
    const a = series(usedCoins, N);
    o.used.textContent = `${used} of ${coins.length}`;
    o.coef.textContent = fmtBig(a[N]);
    const max = a.reduce((m, v) => (v > m ? v : m), 0n);
    o.max.textContent = fmtBig(max);

    svg.replaceChildren();
    const lg = (v) => Math.log10(1 + Number(v));
    const top = Math.max(1, Math.ceil(lg(max)));
    const f = frame(svg, { box: [56, 16, 564, 230], x: [0, N], y: [0, top], yticks: Array.from({ length: top + 1 }, (_, i) => i).filter((i) => top <= 8 || i % 2 === 0), yfmt: (v) => (v === 0 ? "0" : v <= 3 ? String(10 ** v) : `10${sup(v)}`), xticks: [0, Math.round(N / 2), N], xlabel: "exponent of x", ylabel: "coefficient (log scale)" });
    if (N <= 160) {
      const w = Math.max(1, (f.W / (N + 1)) * 0.7);
      a.forEach((v, i) => {
        if (v === 0n) return;
        el("rect", { x: f.sx(i) - w / 2, y: f.sy(lg(v)), width: w, height: f.T + f.H - f.sy(lg(v)), style: i === N ? "fill:var(--brand)" : `fill:${mix("var(--vec-u)", 60)}` }, svg);
      });
    } else {
      const pts = a.map((v, i) => [f.sx(i), f.sy(lg(v))]);
      el("polygon", { points: [[f.sx(0), f.T + f.H], ...pts, [f.sx(N), f.T + f.H]].map((p) => p.join(",")).join(" "), style: `fill:${mix("var(--vec-u)", 30)}` }, svg);
      polyline(svg, pts, "stroke:var(--vec-u);stroke-width:1");
      el("line", { x1: f.sx(N), x2: f.sx(N), y1: f.sy(lg(a[N])), y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:2.5" }, svg);
    }
    text(svg, f.sx(N) - 4, Math.max(f.T + 10, f.sy(lg(a[N])) - 6), `[x${sup(N)}] = ${fmtBig(a[N], 18)}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });

    const list = used ? ways(usedCoins, N) : [];
    const group = (w) => [...new Set(w)].map((v) => { const k = w.filter((x) => x === v).length; return k > 1 ? `${v} (×${k})` : String(v); }).join(" + ");
    waysBox.textContent = !used ? "Multiply a factor to start: with no factors the series is just 1." : list.length ? list.map((w) => `${N} = ${group(w)}`).join("\n") + (a[N] > BigInt(list.length) ? `\n… ${fmtBig(a[N] - BigInt(list.length))} more` : "") : `No way to make ${N} with ${usedCoins.join(", ")}.`;
    waysBox.style.whiteSpace = "pre-line";
  }
  draw();
}

// ============================================================ domino tilings

function tilings(H, n, cap) {
  const grid = new Int8Array(H * n).fill(0), out = [], dom = [];
  let count = 0;
  const rec = () => {
    if (out.length >= cap) return;
    let c = -1;
    for (let col = 0; col < n && c < 0; col++) for (let r = 0; r < H; r++) if (!grid[r * n + col]) { c = r * n + col; break; }
    if (c < 0) { out.push(dom.slice()); count++; return; }
    const r = Math.floor(c / n), col = c % n;
    if (r + 1 < H && !grid[c + n]) { grid[c] = grid[c + n] = 1; dom.push([r, col, "v"]); rec(); dom.pop(); grid[c] = grid[c + n] = 0; }
    if (col + 1 < n && !grid[c + 1]) { grid[c] = grid[c + 1] = 1; dom.push([r, col, "h"]); rec(); dom.pop(); grid[c] = grid[c + 1] = 0; }
  };
  rec();
  return out;
}
function tileCount(H, n) {
  if (H === 2) { let a = 1n, b = 1n; for (let i = 2; i <= n; i++) [a, b] = [b, a + b]; return n === 0 ? 1n : b; }
  if (n % 2) return 0n;
  const t = [1n, 3n];
  for (let m = 2; m <= n / 2; m++) t[m] = 4n * t[m - 1] - t[m - 2];
  return t[n / 2];
}
const phi = (1 + Math.sqrt(5)) / 2, psi = (1 - Math.sqrt(5)) / 2, r3 = Math.sqrt(3);
const closed = (H, n) => (H === 2 ? (phi ** (n + 1) - psi ** (n + 1)) / Math.sqrt(5) : n % 2 ? 0 : ((1 + 1 / r3) * (2 + r3) ** (n / 2) + (1 - 1 / r3) * (2 - r3) ** (n / 2)) / 2);

for (const root of document.querySelectorAll("[data-comb-tiling]")) {
  const gallery = root.querySelector("[data-gallery]"), tableBox = root.querySelector("[data-table]");
  const o = outs(root);
  let H = 2;
  const CAP = 240;
  const s = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => { H = Number(e.detail.value); draw(); });

  function draw() {
    const n = Math.round(s.n.get());
    const list = tilings(H, n, CAP), total = tileCount(H, n);
    o.drawn.textContent = total === 0n ? "0: odd number of cells" : BigInt(list.length) < total ? `first ${list.length} of ${fmtBig(total)}` : `${list.length} of ${fmtBig(total)}`;
    if (H === 2) {
      o.rec.textContent = "T(n) = T(n−1) + T(n−2)";
      o.char.textContent = "x² − x − 1 = 0";
      o.roots.textContent = "φ ≈ 1.618, ψ ≈ −0.618";
      o.closed.textContent = "(φⁿ⁺¹ − ψⁿ⁺¹)/√5";
    } else {
      o.rec.textContent = "T(n) = 4T(n−2) − T(n−4)";
      o.char.textContent = "y² − 4y + 1 = 0, y = x²";
      o.roots.textContent = "2 ± √3 ≈ 3.732, 0.268";
      o.closed.textContent = "½[(1 + 1/√3)(2+√3)ᵐ + (1 − 1/√3)(2−√3)ᵐ], n = 2m";
    }
    gallery.replaceChildren(...list.map((t, i) => {
      const card = node("div", "rounded-lg border bg-background p-1.5");
      const sv = svgNode(`-1 -1 ${n * 10 + 2} ${H * 10 + 2}`, `Tiling ${i + 1}`);
      for (const [r, c, d] of t) {
        const w = d === "h" ? 20 : 10, hh = d === "v" ? 20 : 10;
        const col = d === "h" ? "var(--vec-u)" : "var(--vec-v)";
        const rect = document.createElementNS(NS, "rect");
        for (const [k, v] of Object.entries({ x: c * 10 + 0.8, y: r * 10 + 0.8, width: w - 1.6, height: hh - 1.6, rx: 1.6, style: `fill:${mix(col, 35)};stroke:${col};stroke-width:0.8` })) rect.setAttribute(k, v);
        sv.append(rect);
      }
      card.append(sv);
      return card;
    }));
    if (!list.length) gallery.replaceChildren(node("p", "p-2 text-sm text-muted-foreground", `A 3 × ${n} board has ${3 * n} cells, an odd number, and each domino covers 2: no tiling exists.`));

    const t = node("table", "w-full font-mono text-[11px] tabular-nums");
    const hr = node("tr");
    for (const hcol of ["n", "recurrence (exact)", "closed form (float)", "difference"]) hr.append(node("th", "px-2 py-1 text-right font-normal text-muted-foreground", hcol));
    t.append(hr);
    for (let k = 1; k <= 12; k++) {
      const ex = tileCount(H, k), cf = closed(H, k);
      const tr = node("tr", k === n ? "bg-accent text-foreground" : "text-muted-foreground");
      for (const v of [String(k), fmtBig(ex), cf.toFixed(6), (cf - Number(ex)).toExponential(1)]) tr.append(node("td", "px-2 py-0.5 text-right", v));
      t.append(tr);
    }
    tableBox.replaceChildren(t);
  }
  draw();
}

// ============================================================ Ramsey

for (const root of document.querySelectorAll("[data-comb-ramsey]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let n = 6, edges = [], colour = [];
  root.addEventListener("seg-change", (e) => { n = Number(e.detail.value); reset(); });

  function reset() {
    edges = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j]);
    colour = edges.map(() => 0);
    o.all.textContent = "—";
    colour = edges.map(([i, j]) => (i < 5 && j < 5 ? ((j - i) % 5 === 1 || (j - i) % 5 === 4 ? 1 : 2) : 0));
    draw();
  }
  const pos = (i) => [Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n), Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n)];
  const eid = (i, j) => edges.findIndex(([a, b]) => (a === i && b === j) || (a === j && b === i));
  function triangles() {
    const out = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      const c = colour[eid(i, j)];
      if (c && c === colour[eid(i, k)] && c === colour[eid(j, k)]) out.push([i, j, k, c]);
    }
    return out;
  }
  const NAMES = ["uncoloured", "colour A", "colour B"];
  function cycle(e) { colour[e] = (colour[e] + 1) % 3; draw(); svg.querySelector(`[data-edge="${e}"]`)?.focus(); }

  function draw() {
    svg.replaceChildren();
    const tris = triangles();
    for (const [i, j, k] of tris) el("polygon", { points: [i, j, k].map((v) => pos(v).join(",")).join(" "), style: `fill:${mix("var(--brand)", 18)};stroke:var(--brand);stroke-width:0.07;stroke-linejoin:round` }, svg);
    edges.forEach(([i, j], e) => {
      const [x1, y1] = pos(i), [x2, y2] = pos(j);
      const c = colour[e];
      el("line", { x1, y1, x2, y2, style: c ? `stroke:${c === 1 ? "var(--vec-u)" : "var(--vec-v)"};stroke-width:0.045;stroke-linecap:round` : "stroke:currentColor;stroke-opacity:0.25;stroke-width:0.02;stroke-dasharray:0.06 0.05" }, svg);
      const hit = el("line", { x1, y1, x2, y2, tabindex: 0, role: "button", "data-edge": e, "aria-label": `Edge ${i + 1}–${j + 1}, ${NAMES[c]}`, style: "stroke:transparent;stroke-width:0.16;cursor:pointer;outline:none", class: "focus-visible:[stroke:var(--ring)] focus-visible:[stroke-opacity:0.35]" }, svg);
      hit.addEventListener("click", () => cycle(e));
      hit.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); cycle(e); } });
    });
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(i);
      el("circle", { cx: x, cy: y, r: 0.09, style: "fill:var(--background);stroke:currentColor;stroke-width:0.025" }, svg);
      const t = el("text", { x, y: y + 0.035, "text-anchor": "middle", style: "font-size:0.1px", class: "fill-foreground font-mono" }, svg);
      t.textContent = String(i + 1);
    }
    o.edges.textContent = `${colour.filter(Boolean).length} of ${edges.length}`;
    o.tri.textContent = tris.length ? `${tris.length}: ${tris.slice(0, 3).map(([i, j, k, c]) => `${i + 1}–${j + 1}–${k + 1} (${c === 1 ? "A" : "B"})`).join(", ")}${tris.length > 3 ? ", …" : ""}` : "none";
  }

  onAction(root, (a) => {
    if (a === "clear") colour = edges.map(() => 0);
    if (a === "random") colour = edges.map(() => 1 + Math.floor(Math.random() * 2));
    if (a === "pentagon") colour = edges.map(([i, j]) => (i < 5 && j < 5 ? ((j - i) % 5 === 1 || (j - i) % 5 === 4 ? 1 : 2) : 0));
    if (a === "all") {
      const E = edges.length, T = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) T.push([eid(i, j), eid(i, k), eid(j, k)]);
      let free = 0;
      for (let m = 0; m < 1 << E; m++) {
        let mono = false;
        for (const [x, y, z] of T) {
          const bx = (m >> x) & 1;
          if (bx === ((m >> y) & 1) && bx === ((m >> z) & 1)) { mono = true; break; }
        }
        if (!mono) free++;
      }
      const total = fmtBig(1 << E);
      o.all.textContent = free ? `${free} of ${total} avoid one: R(3, 3) > ${n}` : `all ${total} have one: R(3, 3) ≤ ${n}`;
    }
    if (a !== "all") draw();
  });
  reset();
}

// ============================================================ ballot

for (const root of document.querySelectorAll("[data-comb-ballot]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let order = [], sim = null;
  const s = scrubAll(root, () => { sim = null; fresh(); });
  onAction(root, (a) => {
    if (a === "count") fresh();
    if (a === "many") {
      const A = Math.round(s.a.get()), B = Math.round(s.b.get());
      let ok = 0;
      for (let t = 0; t < 10000; t++) if (alwaysAhead(shuffled(A, B)) < 0) ok++;
      sim = ok / 10000;
      exact();
    }
  });
  const shuffled = (A, B) => {
    const v = [...Array(A).fill(1), ...Array(B).fill(-1)];
    for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
    return v;
  };
  // Index of the first vote after which the lead is ≤ 0, or −1.
  const alwaysAhead = (v) => { let y = 0; for (let i = 0; i < v.length; i++) { y += v[i]; if (y <= 0) return i + 1; } return -1; };
  function fresh() { order = shuffled(Math.round(s.a.get()), Math.round(s.b.get())); exact(); draw(); }
  // The first count shown is a bad one that starts with an A vote, so the
  // reflection is on screen from the start.

  function exact() {
    const A = Math.round(s.a.get()), B = Math.round(s.b.get());
    const total = binom(A + B, A);
    const good = A > B ? total - 2n * binom(A + B - 1, A) : 0n;
    o.total.textContent = fmtBig(total);
    o.good.textContent = `${fmtBig(good)} (${(ratio(good, total) * 100).toFixed(2)} %)`;
    o.formula.textContent = A > B ? `${A - B}/${A + B} = ${((A - B) / (A + B)).toFixed(4)}` : "0: A never leads all the way";
    o.sim.textContent = sim === null ? "—" : `${(sim * 100).toFixed(2)} % of 10 000`;
  }

  function draw() {
    svg.replaceChildren();
    const A = Math.round(s.a.get()), B = Math.round(s.b.get()), T = A + B;
    const ys = [0];
    for (const v of order) ys.push(ys[ys.length - 1] + v);
    const bad = alwaysAhead(order);
    const lo = Math.min(-1, ...ys, ...(bad > 0 ? ys.slice(0, bad + 1).map((y) => -y) : [])), hi = Math.max(1, ...ys);
    const f = frame(svg, { box: [44, 14, 580, 250], x: [0, T], y: [lo, hi], xticks: [0, Math.round(T / 2), T], yticks: [lo, 0, hi], yfmt: (v) => (v > 0 ? `A +${v}` : v < 0 ? `B +${-v}` : "tie"), xlabel: "ballots counted" });
    el("line", { x1: f.sx(0), x2: f.sx(T), y1: f.sy(0), y2: f.sy(0), style: "stroke:var(--muted-foreground);stroke-dasharray:4 4" }, svg);
    if (bad > 0) {
      const ref = ys.slice(0, bad + 1).map((y, i) => [f.sx(i), f.sy(-y)]);
      polyline(svg, ref, "stroke:var(--vec-v);stroke-width:2;stroke-dasharray:6 4;stroke-linejoin:round");
      el("circle", { cx: f.sx(bad), cy: f.sy(0), r: 5, style: "fill:none;stroke:var(--brand);stroke-width:2" }, svg);
    }
    polyline(svg, ys.map((y, i) => [f.sx(i), f.sy(y)]), "stroke:var(--brand);stroke-width:2.25;stroke-linejoin:round");
    el("circle", { cx: f.sx(T), cy: f.sy(ys[T]), r: 3.5, style: "fill:var(--brand)" }, svg);
    o.verdict.textContent = A <= B ? "A cannot lead throughout" : bad < 0 ? "A led all the way" : `tied after ${bad} votes; its reflection starts with ${order[0] > 0 ? "B" : "A"}`;
  }
  fresh();
  for (let t = 0; t < 200 && !(order[0] > 0 && alwaysAhead(order) > 0); t++) order = shuffled(Math.round(s.a.get()), Math.round(s.b.get()));
  draw();
}
