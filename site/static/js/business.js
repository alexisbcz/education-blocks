// Business and accounting blocks: accrual against cash, depreciation,
// inventory costing, variance analysis, the cash conversion cycle, ratios,
// markup and discounts, unit economics, runway and the cap table. Ledger
// amounts are integer cents and share counts whole shares, so every check
// on screen is exact, not approximately zero.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value, e.target.getAttribute("aria-label")));
/** The block's switches by name, kept current from their change events
 *  (aria-checked is only updated after the event fires). */
function switches(root, onChange) {
  const state = {};
  root.querySelectorAll("[data-toggle]").forEach((sw) => {
    state[sw.dataset.toggle] = sw.getAttribute("aria-checked") === "true";
    sw.addEventListener("shadcn:checked-change", (e) => { state[sw.dataset.toggle] = e.detail.checked; onChange(); });
  });
  return state;
}

const minus = (s) => s.replace("-", "−");
const eur2 = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
/** Cents to "€1,234.56". */
const cents = (c) => minus(eur2.format(c / 100));
const euros = (v) => (Number.isFinite(v) ? minus(eur0.format(v)) : "—");
const pct = (v, d = 1) => (Number.isFinite(v) ? `${num(v * 100, d)}%` : "—");
const toCents = (v) => Math.round(v * 100);

const good = "tabular-nums text-add";
const bad = "tabular-nums text-[var(--code-del)]";
function verdict(node, ok, yes, no) {
  node.textContent = ok ? yes : no;
  node.className = ok ? good : bad;
}

function niceStep(range, n = 5) {
  const raw = range / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
const niceFloor = (v) => { const st = niceStep(v, 4); return Math.floor(v / st) * st; };
function ticks(lo, hi, n = 5) {
  if (!(hi > lo)) return [lo];
  const s = niceStep(hi - lo, n), out = [];
  for (let t = Math.ceil(lo / s) * s; t <= hi + 1e-9; t += s) out.push(Math.abs(t) < 1e-9 ? 0 : t);
  return out;
}
const short = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return minus(`${num(v / 1e6, a >= 1e7 ? 0 : 1)}M`);
  if (a >= 1e3) return minus(`${num(v / 1e3, a >= 1e4 ? 0 : 1)}k`);
  return minus(String(Math.round(v)));
};

/** Fills a finTable body: first column left, the rest right-aligned. */
function rows(tbody, data, { strong = [], highlight = -1 } = {}) {
  tbody.replaceChildren(
    ...data.map((r, i) => {
      const tr = document.createElement("tr");
      tr.className = [strong.includes(i) ? "border-t font-medium" : "", i === highlight ? "bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]" : ""].join(" ");
      r.forEach((c, j) => {
        const td = document.createElement("td");
        td.className = j === 0 ? "py-1 pr-3 font-sans" : "py-1 pl-3 text-right";
        if (c instanceof Node) td.append(c);
        else td.textContent = c;
        tr.append(td);
      });
      return tr;
    }),
  );
}

const rect = (p, x, y, w, hgt, style, extra = {}) =>
  el("rect", { x, y: hgt < 0 ? y + hgt : y, width: Math.max(0, w), height: Math.abs(hgt), style, ...extra }, p);

// ============================================================ accrual vs cash

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS_LONG = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

/** One year of the studio, in whole euros, with the balances at the end of
 *  month M that make accrual profit and cash differ. */
function studio(on, M) {
  const cashIn = Array(13).fill(0), cashOut = Array(13).fill(0), rev = Array(13).fill(0), exp = Array(13).fill(0);
  for (let m = 1; m <= 12; m++) {
    rev[m] += 4000; cashIn[m] += 4000; exp[m] += 1500; cashOut[m] += 1500;
    if (on.annual) { rev[m] += 1000; if (m === 1) cashIn[m] += 12000; }
    if (on.invoice && m === 11) rev[m] += 6000; // collected in January next year
    if (on.insurance) { if (m === 7) cashOut[m] += 2400; if (m >= 7) exp[m] += 200; }
    if (on.laptop) { if (m === 4) cashOut[m] += 1800; if (m >= 4) exp[m] += 50; } // 1,800 / 36 months
    if (on.bill && m === 12) exp[m] += 300; // paid in January
  }
  const bal = {
    ar: on.invoice && M >= 11 ? 6000 : 0,
    prepaid: on.insurance && M >= 7 ? 2400 - 200 * (M - 6) : 0,
    ppe: on.laptop && M >= 4 ? 1800 - 50 * (M - 3) : 0,
    deferred: on.annual ? 12000 - 1000 * M : 0,
    accrued: on.bill && M >= 12 ? 300 : 0,
  };
  return { cashIn, cashOut, rev, exp, bal };
}

for (const root of document.querySelectorAll("[data-biz-accrual]")) {
  const svg = root.querySelector("[data-plot]");
  const recon = root.querySelector("[data-biz-recon]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const on = switches(root, draw);

  function draw() {
    const M = s.month.get();
    const y = studio(on, M);
    const cashM = [], profM = [];
    for (let m = 1; m <= 12; m++) { cashM.push(y.cashIn[m] - y.cashOut[m]); profM.push(y.rev[m] - y.exp[m]); }
    const lo = Math.min(0, ...cashM, ...profM), hi = Math.max(...cashM, ...profM) * 1.08;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 12, 530, 252], x: [0, 12], y: [lo, hi], yticks: ticks(lo, hi), yfmt: short, ylabel: "€ per month" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    const bw = f.W / 12;
    for (let i = 0; i < 12; i++) {
      const g = el("g", { style: `opacity:${i < M ? 1 : 0.25};transition:opacity 200ms ease-out` }, svg);
      const x = f.L + i * bw;
      rect(g, x + bw * 0.14, f.sy(0), bw * 0.34, f.sy(cashM[i]) - f.sy(0), "fill:var(--vec-u)", { rx: 1.5 });
      rect(g, x + bw * 0.52, f.sy(0), bw * 0.34, f.sy(profM[i]) - f.sy(0), "fill:var(--brand)", { rx: 1.5 });
      text(g, x + bw / 2, f.T + f.H + 13, MONTHS[i], { "text-anchor": "middle" });
    }

    let cash = 0, profit = 0;
    for (let m = 1; m <= M; m++) { cash += cashM[m - 1]; profit += profM[m - 1]; }
    const b = y.bal;
    const items = [
      [on.invoice, "Receivables (earned, not yet collected)", b.ar],
      [on.insurance, "Prepaid insurance (paid, not yet used)", b.prepaid],
      [on.laptop, "Laptop, net of depreciation", b.ppe],
      [on.annual, "Deferred revenue (collected, not yet earned)", -b.deferred],
      [on.bill, "Unpaid power bill", -b.accrued],
    ].filter((r) => r[0]);
    const sum = items.reduce((a, r) => a + r[2], 0);
    const signed = (v) => (v > 0 ? "+" : "") + euros(v || 0);
    rows(recon, [...items.map((r) => [r[1], signed(r[2])]), ["Total", signed(sum)]], { strong: [items.length] });
    o.cash.textContent = euros(cash);
    o.profit.textContent = euros(profit);
    o.diff.textContent = signed(profit - cash);
    verdict(o.check, sum === profit - cash, "exactly, to the euro", `off by ${euros(profit - cash - sum)}`);
  }
  draw();
}

// ============================================================ depreciation

/** Annual charges in cents; the last year absorbs rounding so the book
 *  value ends exactly on salvage. */
function depreciation(method, C, S, n) {
  const D = Math.max(0, C - S), out = [];
  if (method === "ddb") {
    let bv = C;
    for (let i = 1; i <= n; i++) {
      let c;
      if (i === n) c = bv - S;
      else {
        const ddb = Math.round((bv * 2) / n), sl = Math.round((bv - S) / (n - i + 1));
        c = Math.min(Math.max(ddb, sl), Math.max(0, bv - S));
      }
      c = Math.max(0, c);
      out.push(c); bv -= c;
    }
    return out;
  }
  const w =
    method === "syd" ? Array.from({ length: n }, (_, i) => (n - i) / ((n * (n + 1)) / 2))
    : method === "uop" ? (n === 5 ? [0.3, 0.25, 0.2, 0.15, 0.1] : Array(n).fill(1 / n))
    : Array(n).fill(1 / n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const c = i === n - 1 ? D - acc : Math.round(D * w[i]);
    out.push(c); acc += c;
  }
  return out;
}

const DEP_FORMULA = {
  sl: "charge = (cost − salvage) / life, the same every year",
  ddb: "charge = book value × 2 / life, switching to straight-line on what is left once that is larger; never below salvage",
  syd: "charge = (cost − salvage) × remaining life / (1 + 2 + … + life)",
  uop: "charge = (cost − salvage) × this year's distance / lifetime distance",
};

for (const root of document.querySelectorAll("[data-biz-depreciation]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-biz-dep-table]");
  const o = outs(root);
  let method = "sl";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { method = v; draw(); });

  function draw() {
    const C = toCents(s.cost.get()), S = Math.min(toCents(s.salvage.get()), C), n = s.life.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 12, 520, 232], x: [0, n], y: [0, C / 100], xticks: Array.from({ length: n + 1 }, (_, i) => i), yticks: ticks(0, C / 100), yfmt: short, xlabel: "year", ylabel: "€" });
    const all = ["sl", "ddb", "syd", "uop"].map((m) => [m, depreciation(m, C, S, n)]);
    const bvPts = (ch) => { let bv = C; return [[0, C], ...ch.map((c, i) => [i + 1, (bv -= c)])]; };
    // The selected method's yearly charges as faint bars, under the lines.
    const sel = all.find((a) => a[0] === method)[1];
    sel.forEach((c, i) => rect(svg, f.sx(i + 0.3), f.sy(c / 100), f.sx(0.4) - f.sx(0), f.sy(0) - f.sy(c / 100), "fill:var(--brand);opacity:0.18", { rx: 1.5 }));
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(S / 100), y2: f.sy(S / 100), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4" }, svg);
    text(svg, f.L + 4, f.sy(S / 100) - 4, "salvage", { "text-anchor": "start" });
    for (const [m, ch] of all) {
      if (m === method) continue;
      polyline(svg, bvPts(ch).map(([x, v]) => [f.sx(x), f.sy(v / 100)]), "stroke:var(--muted-foreground);stroke-width:1;stroke-opacity:0.6");
    }
    const pts = bvPts(sel).map(([x, v]) => [f.sx(x), f.sy(v / 100)]);
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2.25");
    for (const [x, y] of pts) el("circle", { cx: x, cy: y, r: 3, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.75" }, svg);

    let acc = 0, bv = C;
    rows(table, sel.map((c, i) => { acc += c; bv -= c; return [String(i + 1), cents(c), cents(acc), cents(bv)]; }));
    o.formula.textContent = DEP_FORMULA[method];
    o.y1.textContent = cents(sel[0]);
    o.yn.textContent = cents(sel[n - 1]);
    verdict(o.total, acc === C - S, `${cents(acc)} = cost − salvage`, `${cents(acc)} ≠ ${cents(C - S)}`);
  }
  draw();
}

// ============================================================ inventory

/** The year's lots in cents: opening stock, then three purchases each
 *  `rise` dearer than the last. */
function helmetLots(rise) {
  const base = 2000, k = 1 + rise;
  return [
    { label: "Opening", units: 100, unit: base },
    { label: "Feb", units: 200, unit: Math.round(base * k) },
    { label: "May", units: 250, unit: Math.round(base * k * k) },
    { label: "Sep", units: 150, unit: Math.round(base * k * k * k) },
  ];
}

/** Units of each lot sold under a cost-flow method (periodic). */
function costFlow(method, lots, sold) {
  const units = lots.reduce((a, l) => a + l.units, 0), cost = lots.reduce((a, l) => a + l.units * l.unit, 0);
  if (method === "avg") {
    const cogs = units ? Math.round((cost * sold) / units) : 0;
    return { cogs, ending: cost - cogs, used: lots.map((l) => (l.units * sold) / units) };
  }
  const order = method === "fifo" ? lots.map((_, i) => i) : lots.map((_, i) => lots.length - 1 - i);
  const used = Array(lots.length).fill(0);
  let left = sold, cogs = 0;
  for (const i of order) {
    const take = Math.min(left, lots[i].units);
    used[i] = take; cogs += take * lots[i].unit; left -= take;
  }
  return { cogs, ending: cost - cogs, used };
}

for (const root of document.querySelectorAll("[data-biz-inventory]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-biz-inv-table]");
  const o = outs(root);
  let method = "fifo";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { method = v; draw(); });

  function draw() {
    const lots = helmetLots(s.rise.get() / 100);
    const units = lots.reduce((a, l) => a + l.units, 0), cost = lots.reduce((a, l) => a + l.units * l.unit, 0);
    const sold = Math.min(s.sold.get(), units);
    const res = Object.fromEntries(["fifo", "lifo", "avg"].map((m) => [m, costFlow(m, lots, sold)]));
    const r = res[method];

    svg.replaceChildren();
    const W = 600, top = 28, base = 196, maxU = 250, colW = 96, gap = (W - 40 - colW * 4) / 3;
    const sy = (u) => (u / maxU) * (base - top);
    lots.forEach((l, i) => {
      const x = 20 + i * (colW + gap), hAll = sy(l.units), hSold = sy(r.used[i]);
      rect(svg, x, base - hAll, colW, hAll - hSold, "fill:var(--code-add);opacity:0.75", { rx: 2 });
      rect(svg, x, base - hSold, colW, hSold, "fill:var(--code-del);opacity:0.75", { rx: 2 });
      rect(svg, x, base - hAll, colW, hAll, "fill:none;stroke:currentColor;stroke-opacity:0.35", { rx: 2 });
      text(svg, x + colW / 2, base - hAll - 8, `${l.units} @ ${cents(l.unit)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      text(svg, x + colW / 2, base + 16, l.label, { "text-anchor": "middle" });
      const soldTxt = method === "avg" ? `${num((r.used[i] / l.units) * 100, 0)}% sold` : `${r.used[i]} sold`;
      text(svg, x + colW / 2, base + 29, soldTxt, { "text-anchor": "middle" });
    });

    const revC = sold * toCents(s.price.get());
    const names = { fifo: "FIFO", lifo: "LIFO", avg: "Weighted average" };
    rows(table, ["fifo", "lifo", "avg"].map((m) => {
      const gp = revC - res[m].cogs;
      return [names[m], cents(res[m].cogs), cents(res[m].ending), cents(gp), cents(gp > 0 ? Math.round(gp / 4) : 0)];
    }), { highlight: ["fifo", "lifo", "avg"].indexOf(method) });
    o.avail.textContent = `${int.format(units)} helmets${s.sold.get() > units ? ` (sold capped at ${units})` : ""}`;
    o.costavail.textContent = cents(cost);
    verdict(o.check, r.cogs + r.ending === cost, `${cents(r.cogs + r.ending)}, all accounted for`, "mismatch");
  }
  draw();
}

// ============================================================ variance analysis

const STD = { q: 1000, price: 5000, kg: 2, kgp: 500, hrs: 0.5, rate: 2000, fixed: 1500000 }; // cents
const STD_CM = STD.price - STD.kg * STD.kgp - STD.hrs * STD.rate; // per candle

for (const root of document.querySelectorAll("[data-biz-variance]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const Q = s.units.get(), P = toCents(s.price.get()), kg = s.kg.get(), kgp = toCents(s.kgp.get());
    const hrs = s.hrs.get(), rate = toCents(s.rate.get()), F = toCents(s.fixed.get());
    const budget = STD.q * STD_CM - STD.fixed;
    const actual = Q * P - kg * kgp - Math.round(hrs * rate) - F;
    const v = [
      ["volume", (Q - STD.q) * STD_CM],
      ["price", (P - STD.price) * Q],
      ["wax €", (STD.kgp - kgp) * kg],
      ["wax kg", Math.round((STD.kg * Q - kg) * STD.kgp)],
      ["wage", Math.round((STD.rate - rate) * hrs)],
      ["hours", Math.round((STD.hrs * Q - hrs) * STD.rate)],
      ["fixed", STD.fixed - F],
    ];
    const sum = v.reduce((a, x) => a + x[1], 0);

    // Waterfall: running total from budget to actual.
    const steps = [];
    let run = budget;
    for (const [k, d] of v) { steps.push({ k, a: run, b: run + d, d }); run += d; }
    const vals = [0, budget, actual, ...steps.flatMap((x) => [x.a, x.b])].map((c) => c / 100);
    const tot = vals.slice(1), lo = Math.min(...tot), hi = Math.max(...tot);
    const spread = Math.max(hi - lo, Math.abs(hi) * 0.05, 1);
    // When every running total is a profit, start the axis near them so the
    // variances are visible, and say so.
    const floor = lo - spread * 0.9 > 0 ? niceFloor(lo - spread * 0.9) : Math.min(0, lo - spread * 0.15);
    const top = hi + spread * 0.15;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 548, 262], x: [0, 9], y: [floor, top], yticks: ticks(floor, top), yfmt: short, ylabel: floor > 0 ? "€ profit (axis starts above zero)" : "€ profit" });
    if (floor <= 0) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    const base = Math.max(0, floor) * 100;
    const bw = f.W / 9;
    const bar = (i, a, b, fill, label, val) => {
      const x = f.L + i * bw + bw * 0.16, w = bw * 0.68;
      rect(svg, x, f.sy(Math.max(a, b) / 100), w, Math.max(1, Math.abs(f.sy(a / 100) - f.sy(b / 100))), `fill:${fill}`, { rx: 1.5 });
      text(svg, x + w / 2, f.T + f.H + 13, label, { "text-anchor": "middle" });
      text(svg, x + w / 2, f.sy(Math.max(a, b) / 100) - 4, val, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    };
    bar(0, base, budget, "var(--foreground)", "budget", short(budget / 100));
    steps.forEach((x, i) => {
      const fav = x.d >= 0;
      bar(i + 1, x.a, x.b, fav ? "var(--brand)" : "var(--code-del)", x.k, x.d === 0 ? "0" : `${fav ? "+" : ""}${short(x.d / 100)}`);
      const nx = f.L + (i + 2) * bw + bw * 0.16;
      el("line", { x1: f.L + (i + 1) * bw + bw * 0.84, x2: nx, y1: f.sy(x.b / 100), y2: f.sy(x.b / 100), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 2" }, svg);
    });
    bar(8, base, actual, "var(--foreground)", "actual", short(actual / 100));

    o.budget.textContent = cents(budget);
    o.actual.textContent = cents(actual);
    verdict(o.sum, budget + sum === actual, `${sum >= 0 ? "+" : ""}${cents(sum)} = actual − budget`, `${cents(sum)}, does not reconcile`);
  }
  draw();
}

// ============================================================ cash conversion cycle

const CCC_PRESETS = {
  maker: { rev: 3650, cogs: 2190, inv: 480, ar: 450, ap: 240 },
  grocer: { rev: 10950, cogs: 8200, inv: 450, ar: 30, ap: 900 },
  agency: { rev: 2000, cogs: 1200, inv: 0, ar: 330, ap: 65 },
};

for (const root of document.querySelectorAll("[data-biz-ccc]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let loading = false;
  const s = scrubAll(root, () => !loading && draw());
  onSeg(root, (v) => {
    loading = true;
    for (const [k, val] of Object.entries(CCC_PRESETS[v])) s[k].set(val);
    loading = false;
    draw();
  });

  function draw() {
    const rev = s.rev.get(), cogs = s.cogs.get(), inv = s.inv.get(), ar = s.ar.get(), ap = s.ap.get();
    const dio = cogs > 0 ? (inv / cogs) * 365 : 0, dso = rev > 0 ? (ar / rev) * 365 : 0, dpo = cogs > 0 ? (ap / cogs) * 365 : 0;
    const ccc = dio + dso - dpo, end = dio + dso;
    const xmax = Math.max(30, end, dpo) * 1.1;
    svg.replaceChildren();
    const f = frame(svg, { box: [96, 20, 486, 160], x: [0, xmax], y: [0, 4], xticks: ticks(0, xmax, 6), xlabel: "days after the stock arrives" });
    const lane = (i, a, b, fill, label, note) => {
      const y = f.T + 8 + i * 38;
      text(svg, f.L - 8, y + 15, label, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
      if (b - a > 0.01) {
        rect(svg, f.sx(a), y, f.sx(b) - f.sx(a), 22, `fill:${fill};opacity:0.85`, { rx: 3 });
        if (f.sx(b) - f.sx(a) > 60) text(svg, (f.sx(a) + f.sx(b)) / 2, y + 15, note, { "text-anchor": "middle", class: "fill-background font-mono text-[10px]" });
      }
    };
    lane(0, 0, dio, "var(--vec-u)", "inventory", `${num(dio, 0)} days`);
    lane(1, dio, end, "var(--vec-v)", "receivables", `${num(dso, 0)} days`);
    lane(2, 0, dpo, "var(--muted-foreground)", "payables", `${num(dpo, 0)} days`);
    lane(3, Math.min(dpo, end), Math.max(dpo, end), ccc >= 0 ? "var(--brand)" : "var(--code-add)", ccc >= 0 ? "cash gap" : "float", ccc >= 0 ? `${num(ccc, 0)} days funded by you` : `${num(-ccc, 0)} days of suppliers' cash`);
    for (const [d, label] of [[dpo, "pay supplier"], [end, "customer pays"]]) {
      el("line", { x1: f.sx(d), x2: f.sx(d), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
      text(svg, f.sx(d), f.T - 6, label, { "text-anchor": d === end && Math.abs(end - dpo) < xmax * 0.15 ? "start" : "middle" });
    }

    o.dio.textContent = `${num(dio, 1)} days`;
    o.dso.textContent = `${num(dso, 1)} days`;
    o.dpo.textContent = `${num(dpo, 1)} days`;
    o.ccc.textContent = `${num(ccc, 1)} days`;
    o.ccc.className = "tabular-nums " + (ccc < 0 ? "text-add" : "");
    o.wc.textContent = `${int.format(inv + ar - ap)} k€`;
    o.ten.textContent = `frees ${num((rev / 365) * 10, 0)} k€`;
  }
  draw();
}

// ============================================================ ratios and DuPont

const RATIO_PRESETS = {
  software: { rev: 400, ebit: 100, interest: 2, ni: 74, assets: 600, equity: 450, ca: 300, stock: 0, cl: 120 },
  grocer: { rev: 5000, ebit: 150, interest: 20, ni: 97, assets: 2000, equity: 600, ca: 800, stock: 400, cl: 1000 },
  utility: { rev: 1200, ebit: 300, interest: 110, ni: 142, assets: 6000, equity: 900, ca: 400, stock: 50, cl: 450 },
};
const dupont = (d) => ({ margin: d.ni / d.rev, turnover: d.rev / d.assets, mult: d.assets / d.equity });

for (const root of document.querySelectorAll("[data-biz-ratios]")) {
  const svg = root.querySelector("[data-plot]");
  const grid = root.querySelector("[data-biz-ratio-grid]");
  let loading = false, company = "software";
  const s = scrubAll(root, () => !loading && draw());
  onSeg(root, (v) => {
    company = v;
    loading = true;
    for (const [k, val] of Object.entries(RATIO_PRESETS[v])) s[k].set(val);
    loading = false;
    draw();
  });

  function draw() {
    const d = Object.fromEntries(Object.keys(RATIO_PRESETS.software).map((k) => [k, s[k].get()]));
    const cur = dupont(d), roe = cur.margin * cur.turnover * cur.mult;
    svg.replaceChildren();
    const factors = [
      ["net margin", "margin", (v) => pct(v), 0.25],
      ["asset turnover", "turnover", (v) => `${num(v, 2)}×`, 3],
      ["equity multiplier", "mult", (v) => `${num(v, 2)}×`, 8],
    ];
    // Narrow screens get a 2 × 2 layout in a smaller viewBox, so the text
    // keeps its size instead of shrinking with the drawing.
    const compact = svg.getBoundingClientRect().width < 460;
    svg.setAttribute("viewBox", compact ? "0 0 330 330" : "0 0 600 200");
    const colW = compact ? 130 : 118, x0 = 14, step = colW + (compact ? 40 : 34);
    const at = (i) => (compact ? [x0 + (i % 2) * step, Math.floor(i / 2) * 140] : [x0 + i * step, 0]);
    const names = { software: "software", grocer: "supermarket", utility: "utility" };
    factors.forEach(([label, key, fmt, max], i) => {
      const [x, y0] = at(i);
      text(svg, x, y0 + 24, compact && i === 2 ? `× ${label}` : label);
      text(svg, x, y0 + 60, fmt(cur[key]), { class: "fill-foreground font-mono text-[24px] tabular-nums" });
      // A scale with all three made-up companies on it, one row of names each.
      const sx = (v) => x + Math.min(1, Math.max(0, v / max)) * colW;
      el("line", { x1: x, x2: x + colW, y1: y0 + 88, y2: y0 + 88, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
      Object.entries(RATIO_PRESETS).forEach(([name, p], j) => {
        const v = sx(dupont(p)[key]);
        el("circle", { cx: v, cy: y0 + 88, r: 2.75, style: "fill:var(--muted-foreground)" }, svg);
        el("line", { x1: v, x2: v, y1: y0 + 92, y2: y0 + 98 + j * 12, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
        text(svg, Math.min(Math.max(v, x + 4), x + colW - 4), y0 + 107 + j * 12, names[name], { "text-anchor": v < x + 30 ? "start" : v > x + colW - 30 ? "end" : "middle", class: "fill-muted-foreground font-mono text-[9px]" });
      });
      el("circle", { cx: sx(cur[key]), cy: y0 + 88, r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
      if (!(compact && i === 1)) text(svg, x + colW + 12, y0 + 56, i < 2 ? "×" : "=", { class: "fill-muted-foreground font-mono text-[18px]" });
    });
    const [xr, yr] = at(3);
    text(svg, xr, yr + 24, "ROE");
    text(svg, xr, yr + 60, pct(roe), { class: "font-mono text-[24px] tabular-nums", style: "fill:var(--brand)" });
    const yc = compact ? 300 : 168;
    text(svg, x0, yc, `check: net income / equity = ${pct(d.ni / d.equity)}`, { class: "fill-muted-foreground font-mono text-[11px]" });
    text(svg, x0, yc + 18, `${company === "software" ? "software: thick margins, light assets" : company === "grocer" ? "supermarket: thin margins, fast turnover" : "utility: heavy assets, mostly borrowed"}`, { class: "fill-muted-foreground font-mono text-[11px]" });

    const liab = d.assets - d.equity;
    const cards = [
      ["Return on assets", pct(d.ni / d.assets), "net income / assets"],
      ["Operating margin", pct(d.ebit / d.rev), "operating profit / revenue"],
      ["Interest cover", d.interest > 0 ? `${num(d.ebit / d.interest, 1)}×` : "no interest", "operating profit / interest"],
      ["Current ratio", `${num(d.ca / d.cl, 2)}`, "current assets / current liabilities"],
      ["Quick ratio", `${num((d.ca - d.stock) / d.cl, 2)}`, "(current assets − inventory) / current liabilities"],
      ["Liabilities / equity", `${num(liab / d.equity, 2)}`, "what is owed per euro owned"],
      ["Equity ratio", pct(d.equity / d.assets), "equity / assets"],
      ["Net income", `${num(d.ni, 0)} M€`, "after interest and tax"],
    ];
    grid.replaceChildren(...cards.map(([k, v, hint]) => {
      const c = document.createElement("div");
      c.className = "flex flex-col gap-0.5 rounded-lg border bg-background p-2.5";
      c.title = hint;
      const a = document.createElement("span"); a.className = "text-[11px] text-muted-foreground"; a.textContent = k;
      const b = document.createElement("span"); b.className = "font-mono text-sm tabular-nums"; b.textContent = v;
      c.append(a, b);
      return c;
    }));
  }
  draw();
  let lastCompact = null;
  new ResizeObserver(() => {
    const c = svg.getBoundingClientRect().width < 460;
    if (c !== lastCompact) { lastCompact = c; draw(); }
  }).observe(svg);
}

// ============================================================ markup, margin, discounts

for (const root of document.querySelectorAll("[data-biz-markup]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  const need = (m, d) => (m > d ? m / (m - d) : Infinity);

  function draw() {
    const c = s.cost.get(), p = s.price.get(), d = s.disc.get() / 100;
    const m = (p - c) / p;
    svg.replaceChildren();
    const ymax = 400;
    const f = frame(svg, { box: [56, 14, 520, 252], x: [0, 60], y: [0, ymax], xticks: [0, 10, 20, 30, 40, 50, 60], yticks: [0, 100, 200, 300, 400], xfmt: (v) => `${v}%`, yfmt: (v) => `+${v}%`, xlabel: "discount", ylabel: "extra volume needed" });
    const curve = (mm, style, label) => {
      const pts = [];
      for (let x = 0; x <= 60; x += 0.25) {
        const y = (need(mm, x / 100) - 1) * 100;
        if (!Number.isFinite(y) || y > ymax) break;
        pts.push([f.sx(x), f.sy(y)]);
      }
      if (pts.length > 1) polyline(svg, pts, style);
      if (label && pts.length) text(svg, pts.at(-1)[0] + 5, Math.max(f.T + 9, pts.at(-1)[1] + 4), label);
    };
    for (const mm of [0.2, 0.4, 0.6]) curve(mm, "stroke:var(--muted-foreground);stroke-width:1;stroke-opacity:0.6", `${mm * 100}%`);
    if (m > 0) {
      curve(m, "stroke:var(--brand);stroke-width:2.25");
      if (m * 100 <= 60) {
        el("line", { x1: f.sx(m * 100), x2: f.sx(m * 100), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:3 3" }, svg);
        text(svg, f.sx(m * 100) + 4, f.T + f.H - 8, "discount = margin", { style: "fill:var(--brand)" });
      }
      const y = (need(m, d) - 1) * 100;
      if (Number.isFinite(y) && y <= ymax) el("circle", { cx: f.sx(d * 100), cy: f.sy(y), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    }

    const pd = p * (1 - d);
    o.markup.textContent = c > 0 ? pct((p - c) / c) : "—";
    o.margin.textContent = pct(m);
    o.after.textContent = pct((pd - c) / pd);
    o.after.className = "tabular-nums " + (pd < c ? "text-[var(--code-del)]" : "");
    const n = need(m, d);
    if (m <= 0) { o.need.textContent = "no profit to protect"; o.need.className = "tabular-nums"; }
    else if (Number.isFinite(n)) { o.need.textContent = `+${num((n - 1) * 100, 1)}%`; o.need.className = "tabular-nums"; }
    else { o.need.textContent = "impossible: every sale loses money"; o.need.className = bad; }
    o.lose.textContent = m > -0.1 ? `${num((1 - m / (m + 0.1)) * 100, 1)}%` : "—";
  }
  draw();
}

// ============================================================ unit economics

for (const root of document.querySelectorAll("[data-biz-unit]")) {
  const svg = root.querySelector("[data-plot]");
  const cohorts = root.querySelector("[data-biz-cohorts]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const A = s.arpu.get(), g = s.gm.get() / 100, c = s.churn.get() / 100, K = s.cac.get();
    const G = A * g, ltv = G / c;
    const cum = (t) => (G * (1 - (1 - c) ** t)) / c;
    let pay = Infinity;
    if (ltv > K) for (let t = 1; t <= 1200; t++) if (cum(t) >= K) { pay = t; break; }
    const xmax = Math.min(120, Math.max(36, Number.isFinite(pay) ? Math.ceil(pay * 1.4) : 60));
    const ymax = Math.max(ltv, K) * 1.15;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 520, 232], x: [0, xmax], y: [0, ymax], xticks: ticks(0, xmax, 6), yticks: ticks(0, ymax), yfmt: short, xlabel: "months since acquisition", ylabel: "€ per customer" });
    const pts = [];
    for (let t = 0; t <= xmax; t++) pts.push([f.sx(t), f.sy(cum(t))]);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(ltv), y2: f.sy(ltv), style: "stroke:var(--muted-foreground);stroke-dasharray:4 4" }, svg);
    text(svg, f.L + 4, f.sy(ltv) - 5, `LTV ${euros(ltv)}`);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(K), y2: f.sy(K), style: "stroke:var(--code-del);stroke-width:1.5" }, svg);
    text(svg, f.L + f.W - 2, f.sy(K) - 5, `CAC ${euros(K)}`, { "text-anchor": "end", style: "fill:var(--code-del)" });
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2.25");
    if (Number.isFinite(pay) && pay <= xmax) {
      el("circle", { cx: f.sx(pay), cy: f.sy(cum(pay)), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
      text(svg, f.sx(pay) + 6, f.sy(cum(pay)) + 16, `paid back, month ${pay}`, { class: "fill-foreground font-mono text-[10px]" });
    }

    // Cohort triangle: six monthly cohorts, each 5% larger.
    const N = 6, table = document.createElement("table");
    table.className = "w-full text-[12px] tabular-nums";
    const head = document.createElement("tr");
    head.className = "text-[11px] text-muted-foreground";
    ["Cohort", "Start", ...Array.from({ length: N - 1 }, (_, k) => `M${k + 1}`)].forEach((t, j) => {
      const th = document.createElement("th"); th.className = "py-1 font-normal " + (j === 0 ? "pr-2 text-left" : "px-1 text-right"); th.textContent = t; head.append(th);
    });
    table.append(head);
    for (let i = 0; i < N; i++) {
      const tr = document.createElement("tr");
      const start = Math.round(200 * 1.05 ** i);
      const th = document.createElement("td"); th.className = "py-0.5 pr-2 text-muted-foreground"; th.textContent = MONTHS_LONG[i]; tr.append(th);
      for (let k = 0; k < N; k++) {
        const td = document.createElement("td");
        td.className = "px-1 py-0.5 text-right font-mono";
        if (k < N - i) {
          const n = Math.round(start * (1 - c) ** k);
          td.textContent = int.format(n);
          td.style.background = `color-mix(in oklab, var(--brand) ${Math.round((n / start) * 28)}%, transparent)`;
        }
        tr.append(td);
      }
      table.append(tr);
    }
    cohorts.replaceChildren(table);

    o.life.textContent = `${num(1 / c, 1)} months`;
    o.ltv.textContent = euros(ltv);
    const ratio = K > 0 ? ltv / K : Infinity;
    o.ratio.textContent = K > 0 ? `${num(ratio, 2)} : 1` : "∞ (free customers)";
    o.ratio.className = "tabular-nums " + (ratio >= 3 ? "text-add" : ratio < 1 ? "text-[var(--code-del)]" : "");
    o.payback.textContent = G > 0 ? `${num(K / G, 1)} months` : "never";
    verdict(o.epayback, Number.isFinite(pay), `month ${pay}`, "never: LTV is below CAC");
    if (Number.isFinite(pay)) o.epayback.className = "tabular-nums";
  }
  draw();
}

// ============================================================ runway

/** 48 months of a startup, in k€. Hiring stops once a month is profitable. */
function runway(p) {
  const out = [];
  let cash = p.cash, team = p.team, frozen = false, runout = null, profitFrom = null, low = cash;
  for (let t = 1; t <= 48; t++) {
    if (!frozen && t > 1 && (t - 1) % 3 === 0) team += p.hires;
    const rev = p.mrr * (1 + p.growth) ** (t - 1), gp = rev * p.gm, costs = team * p.salary + p.opex;
    cash += gp - costs;
    if (gp >= costs) { frozen = true; if (profitFrom === null) profitFrom = t; }
    if (cash < 0 && runout === null) runout = t;
    low = Math.min(low, cash);
    out.push({ t, cash, gp, costs, team });
  }
  return { months: out, runout, profitFrom, low };
}

for (const root of document.querySelectorAll("[data-biz-runway]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const p = { cash: s.cash.get(), mrr: s.mrr.get(), growth: s.growth.get() / 100, gm: s.gm.get() / 100, team: s.team.get(), hires: s.hires.get(), salary: s.salary.get(), opex: s.opex.get() };
    const r = runway(p), m = r.months;
    svg.replaceChildren();
    const last = r.runout ?? 48;
    const shown = m.slice(0, last);
    const cmax = Math.max(p.cash, ...shown.map((x) => x.cash)) * 1.05 || 1;
    const top = frame(svg, { box: [56, 14, 520, 156], x: [0, 48], y: [0, cmax], yticks: ticks(0, cmax, 4), yfmt: (v) => `${short(v * 1000)}`, ylabel: "cash, €" });
    const cashPts = [[top.sx(0), top.sy(p.cash)], ...shown.map((x) => [top.sx(x.t), top.sy(Math.max(0, x.cash))])];
    polyline(svg, cashPts, "stroke:var(--brand);stroke-width:2.25");
    if (r.runout) {
      el("circle", { cx: top.sx(r.runout), cy: top.sy(0), r: 4.5, style: "fill:var(--code-del);stroke:var(--background);stroke-width:1.5" }, svg);
      text(svg, top.sx(r.runout) + 8, top.sy(0) - 8, `out of cash, month ${r.runout}`, { style: "fill:var(--code-del)" });
    }
    const fmax = Math.max(...m.map((x) => Math.max(x.gp, x.costs))) * 1.08 || 1;
    const bot = frame(svg, { box: [56, 196, 520, 96], x: [0, 48], y: [0, fmax], xticks: [0, 6, 12, 18, 24, 30, 36, 42, 48], yticks: ticks(0, fmax, 3), yfmt: (v) => short(v * 1000), xlabel: "month", ylabel: "per month, €" });
    polyline(svg, m.map((x) => [bot.sx(x.t), bot.sy(x.costs)]), "stroke:var(--foreground);stroke-width:1.5");
    polyline(svg, m.map((x) => [bot.sx(x.t), bot.sy(x.gp)]), "stroke:var(--vec-u);stroke-width:1.75");
    if (r.profitFrom) {
      for (const f of [top, bot]) el("line", { x1: f.sx(r.profitFrom), x2: f.sx(r.profitFrom), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-add);stroke-opacity:0.7;stroke-dasharray:3 3" }, svg);
      text(svg, bot.sx(r.profitFrom) + 4, bot.T + 10, "profitable", { style: "fill:var(--code-add)" });
    }

    const burn = m[0].costs - m[0].gp;
    o.burn.textContent = burn > 0 ? `${euros(burn * 1000)} / month` : "none: profitable";
    o.runway.textContent = r.runout ? `${r.runout} months` : "beyond 48 months";
    o.profit.textContent = r.profitFrom ? `month ${r.profitFrom} (team of ${m[r.profitFrom - 1].team})` : "not within 48 months";
    if (r.low < 0) { o.low.textContent = `${euros(-r.low * 1000)} more needed`; o.low.className = bad; }
    else { o.low.textContent = `none (cash bottoms at ${euros(r.low * 1000)})`; o.low.className = "tabular-nums"; }
    const alive = !r.runout && r.profitFrom !== null && m.at(-1).gp >= m.at(-1).costs;
    verdict(o.verdict, alive, "default alive", r.runout ? "default dead" : "alive for now, not yet profitable");
  }
  draw();
}

// ============================================================ cap table

const HOLDERS = [
  ["a", "Founder A", "var(--vec-u)"],
  ["b", "Founder B", "var(--vec-v)"],
  ["pool", "Option pool", "var(--muted-foreground)"],
  ["seed", "Seed investors", "var(--vec-i)"],
  ["sa", "Series A investors", "var(--brand)"],
];
const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);

/** One priced round on a table of whole shares. The pool is topped up to
 *  `poolT` of the post-money count, either before the new money comes in
 *  (counted in the pre-money, diluting only existing holders) or after. */
function priceRound(table, key, pre, inv, poolT, poolInPre) {
  const S = total(table), poolOld = table.pool ?? 0, f = inv / (pre + inv);
  let x, y, price;
  if (poolInPre) {
    let post = (S - poolOld) / (1 - poolT - f);
    if (poolOld > poolT * post) post = S / (1 - f);
    x = Math.max(0, Math.round(poolT * post - poolOld));
    y = Math.round(f * (S + x) / (1 - f));
    price = pre / (S + x);
  } else {
    y = Math.round((S * f) / (1 - f));
    price = pre / S;
    x = Math.max(0, Math.round((poolT * (S + y) - poolOld) / (1 - poolT)));
  }
  return { table: { ...table, pool: poolOld + x, [key]: y }, price, inv, poolAdded: x, effPre: price * S, newShares: y };
}

/** Each holder's share in basis points, rounded on its own. */
const shares10k = (t, keys) => { const T = total(t); return keys.map((k) => Math.round(((t[k] ?? 0) * 10000) / T)); };

for (const root of document.querySelectorAll("[data-biz-captable]")) {
  const bars = root.querySelector("[data-biz-cap-bars]");
  const tbody = root.querySelector("[data-biz-cap-table]");
  const rounds = root.querySelector("[data-biz-cap-rounds]");
  const s = scrubAll(root, draw);
  const sw = switches(root, draw);

  function draw() {
    const pre = sw.pre;
    const t0 = { a: 4_000_000, b: 4_000_000 };
    const seed = priceRound(t0, "seed", s.sPre.get() * 1e6, s.sInv.get() * 1e6, s.sPool.get() / 100, pre);
    const a = priceRound(seed.table, "sa", s.aPre.get() * 1e6, s.aInv.get() * 1e6, s.aPool.get() / 100, pre);
    const stages = [["Founding", t0], ["After seed", seed.table], ["After Series A", a.table]];
    const keys = HOLDERS.map((x) => x[0]);
    const bp = stages.map(([, t]) => shares10k(t, keys));

    bars.replaceChildren(...stages.map(([name], si) => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-[104px_minmax(0,1fr)] items-center gap-2";
      const l = document.createElement("span"); l.className = "font-mono text-[11px] text-muted-foreground"; l.textContent = name;
      const bar = document.createElement("div"); bar.className = "flex h-6 overflow-hidden rounded-md border";
      HOLDERS.forEach(([, label, color], i) => {
        if (!bp[si][i]) return;
        const seg = document.createElement("div");
        seg.className = "h-full transition-[width] duration-300 ease-out motion-reduce:transition-none";
        seg.style.width = `${bp[si][i] / 100}%`;
        seg.style.background = color;
        seg.style.opacity = "0.85";
        seg.title = `${label}: ${num(bp[si][i] / 100, 2)}%`;
        bar.append(seg);
      });
      row.append(l, bar);
      return row;
    }));

    const cell = (t, k, b) => {
      const n = t[k] ?? 0;
      if (!n) return "—";
      const wrap = document.createElement("span");
      wrap.className = "flex flex-col items-end leading-tight";
      const p = document.createElement("span"); p.textContent = `${num(b / 100, 2)}%`;
      const q = document.createElement("span"); q.className = "text-[10px] text-muted-foreground"; q.textContent = int.format(n);
      wrap.append(p, q);
      return wrap;
    };
    const swatch = (label, color) => {
      const w = document.createElement("span"); w.className = "inline-flex items-center gap-1.5";
      const d = document.createElement("span"); d.className = "size-2 rounded-full"; d.style.background = color;
      w.append(d, label);
      return w;
    };
    rows(tbody, [
      ...HOLDERS.map(([k, label, color], i) => [swatch(label, color), ...stages.map(([, t], si) => cell(t, k, bp[si][i]))]),
      ["Total", ...stages.map(([, t]) => `${num((HOLDERS.reduce((a, [k]) => a + (t[k] ?? 0), 0) / total(t)) * 100, 2)}% · ${int.format(total(t))}`)],
    ], { strong: [HOLDERS.length] });

    const line = (name, r) => {
      const p = document.createElement("p");
      p.textContent = `${name}: ${euros(r.inv)} for ${int.format(r.newShares)} shares at €${num(r.price, 4)}; pool +${int.format(r.poolAdded)}; effective pre-money for existing holders ${euros(r.effPre)}`;
      return p;
    };
    rounds.replaceChildren(line("Seed", seed), line("Series A", a));
  }
  draw();
}
