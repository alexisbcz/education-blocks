// Finance and accounting blocks: double entry, linked statements,
// break-even, NPV/IRR, amortization, bonds, Black–Scholes, option
// strategies, binomial trees and the efficient frontier. Every number is
// computed from its closed form or an exact recursion; nothing is a
// forecast.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const eur = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const minus = (s) => s.replace("-", "−");
const money = (v) => (Number.isFinite(v) ? minus(eur.format(v)) : "—");
const money0 = (v) => (Number.isFinite(v) ? minus(eur0.format(v)) : "—");
const pct = (v, d = 2) => (Number.isFinite(v) ? `${num(v * 100, d)}%` : "—");
const fmt = (v, d = 2) => (Number.isFinite(v) ? num(v, d) : "—");

// The segmented control's value arrives as a bubbling "seg-change" from its
// tablist; the aria-label tells two controls in one block apart.
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value, e.target.getAttribute("aria-label")));

// Standard normal CDF, W. J. Cody's rational approximation as given by
// Hart (1968) and West (2005): double precision, error below 1e-14.
function normCdf(x) {
  const a = Math.abs(x);
  let c;
  if (a > 37) c = 0;
  else {
    const e = Math.exp((-a * a) / 2);
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688;
      b = b * a + 6.37396220353165;
      b = b * a + 33.912866078383;
      b = b * a + 112.079291497871;
      b = b * a + 221.213596169931;
      b = b * a + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-2 * a + 1.75566716318264;
      b = b * a + 16.064177579207;
      b = b * a + 86.7807322029461;
      b = b * a + 296.564248779674;
      b = b * a + 637.333633378831;
      b = b * a + 793.826512519948;
      b = b * a + 440.413735824752;
      c /= b;
    } else {
      let b = a + 0.65;
      b = a + 4 / b;
      b = a + 3 / b;
      b = a + 2 / b;
      b = a + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}
const normPdf = (x) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

// Black–Scholes–Merton for a European option, no dividends.
function bs(S, K, T, r, v) {
  if (T <= 0 || v <= 0) {
    const call = Math.max(S - K, 0), put = Math.max(K - S, 0);
    return { call, put, d1: NaN, d2: NaN };
  }
  const sq = v * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / sq;
  const d2 = d1 - sq;
  const disc = K * Math.exp(-r * T);
  return {
    d1, d2,
    call: S * normCdf(d1) - disc * normCdf(d2),
    put: disc * normCdf(-d2) - S * normCdf(-d1),
    deltaC: normCdf(d1), deltaP: normCdf(d1) - 1,
    gamma: normPdf(d1) / (S * sq),
    vega: (S * normPdf(d1) * Math.sqrt(T)) / 100, // per volatility point
    thetaC: (-(S * normPdf(d1) * v) / (2 * Math.sqrt(T)) - r * disc * normCdf(d2)) / 365, // per calendar day
    thetaP: (-(S * normPdf(d1) * v) / (2 * Math.sqrt(T)) + r * disc * normCdf(-d2)) / 365,
    rhoC: (K * T * Math.exp(-r * T) * normCdf(d2)) / 100, // per rate point
    rhoP: (-K * T * Math.exp(-r * T) * normCdf(-d2)) / 100,
  };
}

// niceTicks returns about n round values covering [lo, hi].
function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const tickFmt = (v) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${+(v / 1e6).toFixed(2)}M` : a >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(+v.toFixed(3));
  return minus(s);
};
const line = (svg, f, a, b, style) => el("line", { x1: f.sx(a[0]), y1: f.sy(a[1]), x2: f.sx(b[0]), y2: f.sy(b[1]), style }, svg);
const dot = (svg, f, p, color, r = 3.5) =>
  el("circle", { cx: f.sx(p[0]), cy: f.sy(p[1]), r, style: `fill:var(--background);stroke:${color};stroke-width:1.75` }, svg);
function area(svg, f, pts, color, opacity = 0.18) {
  if (pts.length < 3) return;
  el("path", { d: "M" + pts.map(([x, y]) => `${f.sx(x).toFixed(1)},${f.sy(y).toFixed(1)}`).join("L") + "Z", style: `fill:${color};fill-opacity:${opacity};stroke:none` }, svg);
}

// ============================================================ Double entry

const ACCOUNTS = [
  ["Cash", "A"], ["Accounts receivable", "A"], ["Inventory", "A"], ["Equipment", "A"],
  ["Accounts payable", "L"], ["Bank loan", "L"], ["Owner's capital", "E"],
  ["Revenue", "R"], ["Cost of goods sold", "X"], ["Rent expense", "X"],
];
const TYPE = { A: "asset", L: "liability", E: "equity", R: "revenue", X: "expense" };
const TXS = [
  { text: "The owner invests €20,000 in the business.", lines: [["Cash", 20000, 0], ["Owner's capital", 0, 20000]] },
  { text: "Buys an oven for €8,000 in cash.", lines: [["Equipment", 8000, 0], ["Cash", 0, 8000]] },
  { text: "Buys €1,500 of flour on credit.", lines: [["Inventory", 1500, 0], ["Accounts payable", 0, 1500]] },
  { text: "Borrows €5,000 from the bank.", lines: [["Cash", 5000, 0], ["Bank loan", 0, 5000]] },
  { text: "Sells bread for €3,200 cash; the flour used cost €900.", lines: [["Cash", 3200, 0], ["Revenue", 0, 3200], ["Cost of goods sold", 900, 0], ["Inventory", 0, 900]] },
  { text: "Pays the month's rent, €1,000.", lines: [["Rent expense", 1000, 0], ["Cash", 0, 1000]] },
  { text: "Pays the flour supplier €1,000.", lines: [["Accounts payable", 1000, 0], ["Cash", 0, 1000]] },
  { text: "Caters an event for €600, to be paid next month.", lines: [["Accounts receivable", 600, 0], ["Revenue", 0, 600]] },
];

function td(tr, s, cls = "") {
  const c = document.createElement("td");
  c.className = cls;
  c.textContent = s;
  tr.append(c);
  return c;
}

for (const root of document.querySelectorAll("[data-fin-ledger]")) {
  const o = outs(root);
  const list = root.querySelector("[data-fin-txs]");
  const journal = root.querySelector("[data-fin-journal]");
  const taccts = root.querySelector("[data-fin-taccounts]");
  const trial = root.querySelector("[data-fin-trial]");
  let posted = 0;

  const items = TXS.map((t, i) => {
    const li = document.createElement("li");
    li.className = "flex gap-2 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 data-[posted]:text-foreground data-[next]:border-brand/50 data-[next]:bg-brand/5";
    const n = document.createElement("span");
    n.className = "font-mono text-[11px] text-muted-foreground tabular-nums";
    n.textContent = String(i + 1);
    const s = document.createElement("span");
    s.textContent = t.text;
    li.append(n, s);
    list.append(li);
    return li;
  });

  function draw(animateLast) {
    items.forEach((li, i) => {
      li.toggleAttribute("data-posted", i < posted);
      li.toggleAttribute("data-next", i === posted);
    });
    o.step.textContent = `${posted} / ${TXS.length} posted`;

    // Journal: debits first, credits indented ("to ...").
    journal.replaceChildren();
    TXS.slice(0, posted).forEach((t, i) => {
      const head = document.createElement("tr");
      const c = td(head, `${i + 1}. ${t.text}`, "pt-2 pb-0.5 font-sans text-[11px] text-muted-foreground");
      c.colSpan = 3;
      journal.append(head);
      for (const [acct, dr, cr] of [...t.lines.filter((l) => l[1]), ...t.lines.filter((l) => l[2])]) {
        const tr = document.createElement("tr");
        if (animateLast && i === posted - 1 && !reduced()) tr.className = "enter";
        td(tr, dr ? acct : `    to ${acct}`, "py-0.5 pr-3 whitespace-pre font-sans");
        td(tr, dr ? int.format(dr) : "", "py-0.5 pl-3 text-right");
        td(tr, cr ? int.format(cr) : "", "py-0.5 pl-3 text-right");
        journal.append(tr);
      }
    });
    if (!posted) {
      const tr = document.createElement("tr");
      td(tr, "Nothing posted yet.", "py-2 font-sans text-muted-foreground").colSpan = 3;
      journal.append(tr);
    }

    // Balances.
    const bal = Object.fromEntries(ACCOUNTS.map(([a]) => [a, { dr: [], cr: [] }]));
    TXS.slice(0, posted).forEach((t, i) => {
      for (const [a, dr, cr] of t.lines) {
        if (dr) bal[a].dr.push([i + 1, dr]);
        if (cr) bal[a].cr.push([i + 1, cr]);
      }
    });
    const net = (a) => bal[a].dr.reduce((s, x) => s + x[1], 0) - bal[a].cr.reduce((s, x) => s + x[1], 0);
    const justPosted = new Set(posted ? TXS[posted - 1].lines.map((l) => l[0]) : []);

    // T-accounts.
    taccts.replaceChildren();
    for (const [a, type] of ACCOUNTS) {
      const card = document.createElement("div");
      const used = bal[a].dr.length || bal[a].cr.length;
      card.className = "flex flex-col rounded-md border bg-code p-2 text-[11px] transition-[border-color,opacity] duration-200 " +
        (used ? "" : "opacity-40 ") + (justPosted.has(a) && animateLast ? "border-brand/60" : "");
      const title = document.createElement("div");
      title.className = "flex items-baseline justify-between gap-1 border-b border-foreground/40 pb-1";
      const name = document.createElement("span");
      name.className = "truncate font-medium";
      name.textContent = a;
      const kind = document.createElement("span");
      kind.className = "font-mono text-[10px] text-muted-foreground";
      kind.textContent = TYPE[type];
      title.append(name, kind);
      const body = document.createElement("div");
      body.className = "grid grid-cols-2 font-mono tabular-nums";
      for (const side of ["dr", "cr"]) {
        const col = document.createElement("div");
        col.className = side === "dr" ? "border-r border-foreground/40 pr-1.5 pt-1" : "pl-1.5 pt-1 text-right";
        for (const [n, v] of bal[a][side]) {
          const r = document.createElement("div");
          r.textContent = side === "dr" ? `${n}  ${int.format(v)}` : `${int.format(v)}  ${n}`;
          r.className = "whitespace-pre";
          col.append(r);
        }
        body.append(col);
      }
      const b = net(a);
      const foot = document.createElement("div");
      foot.className = "mt-1 border-t pt-1 font-mono text-muted-foreground tabular-nums";
      foot.textContent = used ? `balance ${int.format(Math.abs(b))} ${b >= 0 ? "Dr" : "Cr"}` : "no entries";
      card.append(title, body, foot);
      taccts.append(card);
    }

    // Trial balance.
    trial.replaceChildren();
    let tdr = 0, tcr = 0;
    for (const [a] of ACCOUNTS) {
      const b = net(a);
      if (!b) continue;
      const tr = document.createElement("tr");
      td(tr, a, "py-0.5 pr-3 font-sans");
      td(tr, b > 0 ? int.format(b) : "", "py-0.5 pl-3 text-right");
      td(tr, b < 0 ? int.format(-b) : "", "py-0.5 pl-3 text-right");
      trial.append(tr);
      if (b > 0) tdr += b;
      else tcr -= b;
    }
    const tot = document.createElement("tr");
    tot.className = "border-t font-medium";
    td(tot, "Total", "py-1 pr-3 font-sans");
    td(tot, int.format(tdr), "py-1 pl-3 text-right");
    td(tot, int.format(tcr), "py-1 pl-3 text-right");
    trial.append(tot);

    const sum = (t) => ACCOUNTS.filter((x) => x[1] === t).reduce((s, [a]) => s + net(a), 0);
    const A = sum("A"), L = 0 - sum("L") + 0, E = 0 - sum("E") + 0, R = 0 - sum("R") + 0, X = sum("X");
    o.equation.textContent = `Assets ${int.format(A)} = Liabilities ${int.format(L)} + Equity ${int.format(E)} + (Revenue ${int.format(R)} − Expenses ${int.format(X)})`;
    const ok = tdr === tcr && A === L + E + R - X;
    o.check.textContent = ok ? `Debits equal credits (${int.format(tdr)}), and the equation holds.` : "Out of balance.";
    o.check.className = ok ? "text-sm text-add" : "text-sm text-[var(--code-del)]";
    root.querySelector("[data-action=next]").disabled = posted === TXS.length;
    root.querySelector("[data-action=all]").disabled = posted === TXS.length;
  }
  root.querySelector("[data-action=next]").addEventListener("click", () => { posted = Math.min(TXS.length, posted + 1); draw(true); });
  root.querySelector("[data-action=all]").addEventListener("click", () => { posted = TXS.length; draw(false); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { posted = 0; draw(false); });
  draw(false);
}

// ============================================================ Linked statements

for (const root of document.querySelectorAll("[data-fin-statements]")) {
  const o = outs(root);
  const s = scrubAll(root, draw);
  const k = (v) => minus(v.toFixed(1));
  let first = true;

  function draw() {
    const g = (n) => s[n].get();
    const rev = g("rev"), cogs = g("cogs"), opex = g("opex"), dep = g("dep"), intr = g("int"), t = g("tax") / 100;
    const gp = rev - cogs, ebit = gp - opex - dep, ebt = ebit - intr;
    const tax = Math.max(0, ebt * t), ni = ebt - tax;
    const dar = g("dar"), dinv = g("dinv"), dap = g("dap"), capex = g("capex"), debt = g("debt"), div = g("div");
    const cfo = ni + dep - dar - dinv + dap, dcash = cfo - capex + debt - div;
    const bs = {
      cash: 20 + dcash, ar: 15 + dar, inv: 10 + dinv, ppe: 60 + capex - dep,
      ap: 12 + dap, debt: 30 + debt, eq: 63 + ni - div,
    };
    const ta = bs.cash + bs.ar + bs.inv + bs.ppe, tle = bs.ap + bs.debt + bs.eq;
    const values = {
      "is-rev": rev, "is-cogs": -cogs, "is-gp": gp, "is-opex": -opex, "is-dep": -dep, "is-ebit": ebit, "is-int": -intr, "is-tax": -tax, "is-ni": ni,
      "cf-ni": ni, "cf-dep": dep, "cf-ar": -dar, "cf-inv": -dinv, "cf-ap": dap, "cf-cfo": cfo, "cf-capex": -capex, "cf-debt": debt, "cf-div": -div, "cf-dcash": dcash,
      "bs-cash": bs.cash, "bs-ar": bs.ar, "bs-inv": bs.inv, "bs-ppe": bs.ppe, "bs-ta": ta, "bs-ap": bs.ap, "bs-debt": bs.debt, "bs-eq": bs.eq, "bs-tle": tle,
    };
    for (const [key, v] of Object.entries(values)) {
      const cell = o[key];
      const txt = k(v);
      if (cell.textContent !== txt) {
        cell.textContent = txt;
        // The ripple: a brief tint on every figure the change touched.
        if (!first) {
          cell.setAttribute("data-changed", "");
          requestAnimationFrame(() => requestAnimationFrame(() => cell.removeAttribute("data-changed")));
        }
      }
    }
    first = false;
    const ok = Math.abs(ta - tle) < 1e-9;
    o.check.textContent = ok
      ? `Assets ${k(ta)} = liabilities + equity ${k(tle)}. Cash from the cash-flow statement (20 + ${k(dcash)}) is the balance-sheet cash.` + (bs.cash < 0 ? " Cash is negative: the business would need more financing." : "")
      : "The balance sheet does not balance.";
    o.check.className = "text-sm xl:col-span-3 " + (ok && bs.cash >= 0 ? "text-add" : "text-[var(--code-del)]");
  }
  draw();
}

// ============================================================ Break-even

for (const root of document.querySelectorAll("[data-fin-breakeven]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const F = s.fixed.get(), p = s.price.get(), v = s.var.get(), q = s.q.get();
    const cm = p - v, be = cm > 0 ? F / cm : Infinity;
    const xmax = Math.max(10, Number.isFinite(be) ? Math.max(be * 2, q * 1.25) : q * 1.5);
    const ymax = Math.max(p * xmax, F + v * xmax) * 1.05;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 486, 286], x: [0, xmax], y: [0, ymax], xticks: niceTicks(0, xmax), yticks: niceTicks(0, ymax), xfmt: tickFmt, yfmt: tickFmt, xlabel: "units per month", ylabel: "€" });
    if (Number.isFinite(be)) {
      area(svg, f, [[0, 0], [0, F], [be, F + v * be]], "var(--code-del)");
      area(svg, f, [[be, p * be], [xmax, p * xmax], [xmax, F + v * xmax]], "var(--code-add)");
    } else {
      area(svg, f, [[0, 0], [0, F], [xmax, F + v * xmax], [xmax, p * xmax]], "var(--code-del)");
    }
    line(svg, f, [0, F], [xmax, F], "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4");
    text(svg, f.sx(xmax) - 4, f.sy(F) - 5, "fixed costs", { "text-anchor": "end" });
    line(svg, f, [0, F], [xmax, F + v * xmax], "stroke:var(--foreground);stroke-width:2");
    line(svg, f, [0, 0], [xmax, p * xmax], "stroke:var(--vec-u);stroke-width:2");
    line(svg, f, [q, 0], [q, ymax], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:3 3");
    text(svg, f.sx(q) + 4, f.T + 12, `sold ${int.format(q)}`, { style: "fill:var(--brand)" });
    if (Number.isFinite(be) && be <= xmax) {
      dot(svg, f, [be, p * be], "var(--foreground)", 4.5);
      text(svg, f.sx(be) + 7, f.sy(p * be) + 14, `break-even ${int.format(Math.ceil(be))}`);
    }
    const profit = cm * q - F;
    o.cm.textContent = `${money(cm)} / unit`;
    o.cmr.textContent = p > 0 ? pct(cm / p, 1) : "—";
    o.be.textContent = Number.isFinite(be) ? `${int.format(Math.ceil(be))} units` : "never (price ≤ variable cost)";
    o.bes.textContent = Number.isFinite(be) ? money0(be * p) : "—";
    o.profit.textContent = money0(profit);
    o.profit.className = "tabular-nums " + (profit >= 0 ? "text-add" : "text-[var(--code-del)]");
    o.mos.textContent = Number.isFinite(be) && q > 0 ? pct((q - be) / q, 1) : "—";
    o.dol.textContent = profit > 0 ? `${fmt((cm * q) / profit, 2)}×` : "— (no profit)";
  }
  draw();
}

// ============================================================ NPV and IRR

const NPV_PRESETS = {
  standard: [-1000, 300, 300, 300, 300, 300, 0],
  two: [-1000, 2300, -1320, 0, 0, 0, 0],
  none: [100, -250, 160, 0, 0, 0, 0],
};
const npvAt = (cf, r) => cf.reduce((s, c, t) => s + c / (1 + r) ** t, 0);

// irrs finds every rate in (−90%, 300%] where the NPV changes sign, refined
// by bisection.
function irrs(cf) {
  const roots = [];
  let a = -0.9, fa = npvAt(cf, a);
  for (let b = a + 0.0025; b <= 3 + 1e-9; b += 0.0025) {
    const fb = npvAt(cf, b);
    if (fa === 0) roots.push(a);
    else if (fa * fb < 0) {
      let lo = a, hi = b, flo = fa;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2, fm = npvAt(cf, m);
        if (flo * fm <= 0) hi = m;
        else { lo = m; flo = fm; }
      }
      roots.push((lo + hi) / 2);
    }
    a = b;
    fa = fb;
  }
  return roots;
}

for (const root of document.querySelectorAll("[data-fin-npv]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  onSeg(root, (v) => {
    NPV_PRESETS[v].forEach((c, i) => s[`c${i}`].set(c, false));
    draw();
  });

  function draw() {
    const cf = Array.from({ length: 7 }, (_, i) => s[`c${i}`].get());
    const r = s.rate.get() / 100;
    const roots = irrs(cf);
    const R = Array.from({ length: 241 }, (_, i) => i * 0.0025); // 0..60%
    const vals = R.map((x) => npvAt(cf, x));
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 10;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 486, 252], x: [0, 0.6], y: [lo - pad, hi + pad], xticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], yticks: niceTicks(lo - pad, hi + pad), xfmt: (x) => `${Math.round(x * 100)}%`, yfmt: tickFmt, xlabel: "discount rate", ylabel: "NPV €" });
    line(svg, f, [0, 0], [0.6, 0], "stroke:currentColor;stroke-opacity:0.45");
    polyline(svg, R.map((x, i) => [f.sx(x), f.sy(vals[i])]), "stroke:var(--foreground);stroke-width:2");
    for (const x of roots) if (x >= 0 && x <= 0.6) {
      dot(svg, f, [x, 0], "var(--brand)", 4.5);
      text(svg, f.sx(x) + 7, f.sy(0) + 15, `IRR ${num(x * 100, 1)}%`, { "text-anchor": "start", style: "fill:var(--brand)" });
    }
    const npv = npvAt(cf, r);
    if (r <= 0.6) {
      line(svg, f, [r, lo - pad], [r, hi + pad], "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:3 3");
      el("circle", { cx: f.sx(r), cy: f.sy(npv), r: 4, style: "fill:var(--vec-u)" }, svg);
    }
    let changes = 0, last = 0;
    for (const c of cf) if (c) { if (last && Math.sign(c) !== last) changes++; last = Math.sign(c); }
    o.npv.textContent = money(npv);
    o.npv.className = "tabular-nums " + (npv >= 0 ? "text-add" : "text-[var(--code-del)]");
    o.irr.textContent = roots.length === 0 ? "none (NPV never crosses 0)" : roots.map((x) => pct(x, 2)).join(" and ");
    o.signs.textContent = String(changes) + (changes > 1 ? " · up to that many IRRs" : "");
    // Payback: when the running total of undiscounted cash first turns positive.
    let cum = 0, pb = null;
    for (let t = 0; t < cf.length; t++) {
      const prev = cum;
      cum += cf[t];
      if (pb === null && t > 0 && prev < 0 && cum >= 0) pb = t - 1 + -prev / cf[t];
    }
    o.payback.textContent = pb === null ? "—" : `${num(pb, 2)} years`;
    o.verdict.textContent = roots.length > 1
      ? "use NPV: the IRR is ambiguous"
      : npv >= 0 ? `accept at ${num(r * 100, 2)}%` : `reject at ${num(r * 100, 2)}%`;
  }
  draw();
}

// ============================================================ Amortization

function amortize(P, annual, years, extra) {
  const i = annual / 12, n = years * 12;
  const pmt = i === 0 ? P / n : (P * i) / (1 - (1 + i) ** -n);
  const rows = [];
  let bal = P, month = 0, totI = 0;
  while (bal > 1e-6 && month < n + 1) {
    const interest = bal * i;
    const pay = Math.min(bal + interest, pmt + extra);
    const principal = pay - interest;
    bal -= principal;
    totI += interest;
    const y = Math.floor(month / 12);
    rows[y] ??= { paid: 0, interest: 0, principal: 0, balance: 0 };
    rows[y].paid += pay;
    rows[y].interest += interest;
    rows[y].principal += principal;
    rows[y].balance = Math.max(0, bal);
    month++;
  }
  return { pmt, rows, months: month, totI };
}

for (const root of document.querySelectorAll("[data-fin-loan]")) {
  const svg = root.querySelector("[data-plot]");
  const body = root.querySelector("[data-fin-schedule]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const P = s.p.get() * 1000, r = s.r.get() / 100, Y = Math.round(s.y.get()), x = s.x.get();
    const base = amortize(P, r, Y, 0), run = amortize(P, r, Y, x);
    const ymax = Math.max(...run.rows.map((d) => d.paid)) * 1.1;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 26, 446, 240], x: [0, Y], y: [0, ymax], xticks: niceTicks(0, Y), yticks: niceTicks(0, ymax), xfmt: (v) => String(v), yfmt: tickFmt, xlabel: "year", ylabel: "€ / year" });
    const bw = (f.sx(1) - f.sx(0)) * 0.72;
    run.rows.forEach((d, yr) => {
      const x0 = f.sx(yr + 0.5) - bw / 2;
      el("rect", { x: x0, y: f.sy(d.principal), width: bw, height: f.T + f.H - f.sy(d.principal), style: "fill:var(--vec-u);fill-opacity:0.75" }, svg);
      el("rect", { x: x0, y: f.sy(d.principal + d.interest), width: bw, height: f.sy(d.principal) - f.sy(d.principal + d.interest), style: "fill:var(--code-del);fill-opacity:0.75" }, svg);
    });
    // Remaining balance on its own scale, right axis.
    const by = (b) => f.T + f.H - (b / P) * f.H;
    polyline(svg, [[f.sx(0), by(P)], ...run.rows.map((d, yr) => [f.sx(yr + 1), by(d.balance)])], "stroke:var(--foreground);stroke-width:1.75");
    for (const b of [0, P / 2, P]) text(svg, f.L + f.W + 6, by(b) + 3, tickFmt(b), { "text-anchor": "start" });
    text(svg, f.L + f.W + 6, f.T - 14, "balance", { "text-anchor": "start" });

    body.replaceChildren();
    run.rows.forEach((d, yr) => {
      if (run.rows.length > 12 && yr > 4 && yr < run.rows.length - 3) {
        if (yr === 5) { const tr = document.createElement("tr"); td(tr, "…", "py-0.5 text-muted-foreground").colSpan = 5; body.append(tr); }
        return;
      }
      const tr = document.createElement("tr");
      td(tr, String(yr + 1), "py-0.5 pr-3");
      td(tr, int.format(d.paid), "py-0.5 pl-3 text-right");
      td(tr, int.format(d.interest), "py-0.5 pl-3 text-right");
      td(tr, int.format(d.principal), "py-0.5 pl-3 text-right");
      td(tr, int.format(d.balance), "py-0.5 pl-3 text-right");
      body.append(tr);
    });
    o.pmt.textContent = x ? `${money(run.pmt)} + ${money(x)}` : money(run.pmt);
    o.ti.textContent = money0(run.totI);
    const yrs = Math.floor(run.months / 12), mo = run.months % 12;
    o.months.textContent = `${run.months} months (${yrs} y${mo ? ` ${mo} m` : ""})`;
    o.saved.textContent = x ? `${base.months - run.months} months, ${money0(base.totI - run.totI)} interest` : "—";
  }
  draw();
}

// ============================================================ Bonds

function bond(c, y, n, freq) {
  const N = Math.round(n * freq), C = (100 * c) / freq, i = y / freq;
  let P = 0, D = 0, Cx = 0;
  for (let k = 1; k <= N; k++) {
    const cf = C + (k === N ? 100 : 0);
    const pv = cf / (1 + i) ** k;
    P += pv;
    D += (k / freq) * pv;
    Cx += (k / freq) * ((k + 1) / freq) * pv;
  }
  const mac = D / P;
  return { P, mac, mod: mac / (1 + i), cx: Cx / (P * (1 + i) ** 2) };
}

for (const root of document.querySelectorAll("[data-fin-bond]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let freq = 1;
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { freq = Number(v); draw(); });

  function draw() {
    const c = s.c.get() / 100, y0 = s.y.get() / 100, n = s.n.get();
    const b = bond(c, y0, n, freq);
    const Y = Array.from({ length: 151 }, (_, i) => i * 0.001); // 0..15%
    const exact = Y.map((y) => bond(c, y, n, freq).P);
    const durOnly = Y.map((y) => b.P * (1 - b.mod * (y - y0)));
    const withCx = Y.map((y) => b.P * (1 - b.mod * (y - y0) + 0.5 * b.cx * (y - y0) ** 2));
    const hi = Math.max(...exact) * 1.05, lo = Math.min(...exact) * 0.9;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 490, 270], x: [0, 0.15], y: [lo, hi], xticks: [0, 0.03, 0.06, 0.09, 0.12, 0.15], yticks: niceTicks(lo, hi), xfmt: (x) => `${Math.round(x * 100)}%`, yfmt: tickFmt, xlabel: "yield", ylabel: "price" });
    // Approximations that leave the frame are cut, not flattened on its edge.
    const clip = (arr) => arr.map((p, i) => [Y[i], p]).filter(([, p]) => p >= lo && p <= hi).map(([y, p]) => [f.sx(y), f.sy(p)]);
    polyline(svg, clip(durOnly), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, clip(withCx), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:2 3");
    polyline(svg, clip(exact), "stroke:var(--foreground);stroke-width:2");
    line(svg, f, [0, 100], [0.15, 100], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4");
    text(svg, f.sx(0.15) - 4, f.sy(100) - 5, "par", { "text-anchor": "end" });
    dot(svg, f, [y0, b.P], "var(--foreground)", 4.5);
    o.price.textContent = `${fmt(b.P, 3)} ${b.P > 100.0005 ? "(premium)" : b.P < 99.9995 ? "(discount)" : "(par)"}`;
    o.mac.textContent = `${fmt(b.mac, 3)} years`;
    o.mod.textContent = `${fmt(b.mod, 3)}`;
    o.cx.textContent = fmt(b.cx, 2);
    const up = bond(c, y0 + 0.01, n, freq).P;
    const approx = b.P * (1 - b.mod * 0.01 + 0.5 * b.cx * 0.0001);
    o.shock.textContent = `${fmt(up, 3)} exact, ${fmt(approx, 3)} approx.`;
  }
  draw();
}

// ============================================================ Black–Scholes

for (const root of document.querySelectorAll("[data-fin-bs]")) {
  const svg = root.querySelector("[data-plot]");
  const greeks = root.querySelector("[data-fin-greeks]");
  const o = outs(root);
  let kind = "call";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });

  function draw() {
    const S = s.s.get(), K = s.k.get(), T = s.t.get(), v = s.v.get() / 100, r = s.r.get() / 100;
    const b = bs(S, K, T, r, v);
    const lo = Math.max(0.01, Math.min(S, K) * 0.4), hi = Math.max(S, K) * 1.6;
    const X = Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160);
    const val = X.map((x) => bs(x, K, T, r, v)[kind]);
    const pay = X.map((x) => (kind === "call" ? Math.max(x - K, 0) : Math.max(K - x, 0)));
    const ymax = Math.max(...val, ...pay) * 1.08 || 1;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 490, 270], x: [lo, hi], y: [0, ymax], xticks: niceTicks(lo, hi), yticks: niceTicks(0, ymax), xfmt: tickFmt, yfmt: tickFmt, xlabel: "stock price S", ylabel: kind });
    area(svg, f, [...X.map((x, i) => [x, val[i]]), ...X.map((x, i) => [x, pay[i]]).reverse()], "var(--brand)", 0.1);
    polyline(svg, X.map((x, i) => [f.sx(x), f.sy(pay[i])]), "stroke:var(--foreground);stroke-width:1.5");
    polyline(svg, X.map((x, i) => [f.sx(x), f.sy(val[i])]), "stroke:var(--brand);stroke-width:2");
    line(svg, f, [K, 0], [K, ymax], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4");
    text(svg, f.sx(K) + 4, f.T + 10, "K");
    dot(svg, f, [S, b[kind]], "var(--brand)", 4.5);
    const isC = kind === "call";
    const rows = [
      ["d₁ / d₂", `${fmt(b.d1, 4)} / ${fmt(b.d2, 4)}`],
      ["delta", fmt(isC ? b.deltaC : b.deltaP, 4)],
      ["gamma", fmt(b.gamma, 5)],
      ["vega / vol pt", fmt(b.vega, 4)],
      ["theta / day", fmt(isC ? b.thetaC : b.thetaP, 4)],
      ["rho / rate pt", fmt(isC ? b.rhoC : b.rhoP, 4)],
    ];
    greeks.replaceChildren();
    for (const [k, val2] of rows) {
      const d = document.createElement("div");
      d.className = "flex justify-between gap-3";
      const dt = document.createElement("dt");
      dt.className = "text-muted-foreground";
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.className = "tabular-nums";
      dd.textContent = val2;
      d.append(dt, dd);
      greeks.append(d);
    }
    o.call.textContent = fmt(b.call, 4);
    o.put.textContent = fmt(b.put, 4);
    o.parity.textContent = fmt(b.call - b.put, 4);
    o.parity2.textContent = fmt(S - K * Math.exp(-r * T), 4);
  }
  draw();
}

// ============================================================ Strategies

const STRATS = {
  straddle: (K, w) => [["call", K, 1], ["put", K, 1]],
  strangle: (K, w) => [["put", K - w, 1], ["call", K + w, 1]],
  bull: (K, w) => [["call", K, 1], ["call", K + w, -1]],
  bear: (K, w) => [["put", K, 1], ["put", K - w, -1]],
  covered: (K, w) => [["stock", 0, 1], ["call", K + w, -1]],
  condor: (K, w) => [["put", K - 2 * w, 1], ["put", K - w, -1], ["call", K + w, -1], ["call", K + 2 * w, 1]],
};
const RATE = 0.03; // fixed for this block, stated in the legs

for (const root of document.querySelectorAll("[data-fin-strat]")) {
  const svg = root.querySelector("[data-plot]");
  const legsEl = root.querySelector("[data-fin-legs]");
  const o = outs(root);
  let strat = "straddle";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { strat = v; draw(); });

  function draw() {
    const S0 = s.s.get(), w = s.w.get(), T = s.t.get(), v = s.v.get() / 100;
    const K = Math.round(S0);
    const legs = STRATS[strat](K, w).map(([type, k, q]) => {
      const prem = type === "stock" ? S0 : bs(S0, k, T, RATE, v)[type];
      return { type, k, q, prem };
    }).filter((l) => l.type === "stock" || l.k > 0);
    const payoff = (l, x) => (l.type === "stock" ? x : l.type === "call" ? Math.max(x - l.k, 0) : Math.max(l.k - x, 0));
    const profit = (x) => legs.reduce((sum, l) => sum + l.q * (payoff(l, x) - l.prem), 0);
    const today = (x) => legs.reduce((sum, l) => sum + l.q * ((l.type === "stock" ? x : bs(x, l.k, T, RATE, v)[l.type]) - l.prem), 0);
    const span = Math.max(3.5 * w, 0.35 * S0);
    const lo = Math.max(0.01, S0 - span), hi = S0 + span;
    const X = Array.from({ length: 241 }, (_, i) => lo + ((hi - lo) * i) / 240);
    const P = X.map(profit), Tv = X.map(today);
    const ylo = Math.min(...P, ...Tv), yhi = Math.max(...P, ...Tv);
    const pad = (yhi - ylo) * 0.1 || 1;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 490, 270], x: [lo, hi], y: [ylo - pad, yhi + pad], xticks: niceTicks(lo, hi), yticks: niceTicks(ylo - pad, yhi + pad), xfmt: tickFmt, yfmt: tickFmt, xlabel: "stock price at expiry", ylabel: "profit" });
    area(svg, f, [[lo, 0], ...X.map((x, i) => [x, Math.max(0, P[i])]), [hi, 0]], "var(--code-add)", 0.16);
    area(svg, f, [[lo, 0], ...X.map((x, i) => [x, Math.min(0, P[i])]), [hi, 0]], "var(--code-del)", 0.16);
    line(svg, f, [lo, 0], [hi, 0], "stroke:currentColor;stroke-opacity:0.45");
    polyline(svg, X.map((x, i) => [f.sx(x), f.sy(Tv[i])]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 3");
    polyline(svg, X.map((x, i) => [f.sx(x), f.sy(P[i])]), "stroke:var(--brand);stroke-width:2");
    line(svg, f, [S0, ylo - pad], [S0, yhi + pad], "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4");
    text(svg, f.sx(S0) + 4, f.T + 10, "today");

    // Break-evens on a fine grid from 0 to well past the strikes.
    const G = Array.from({ length: 4001 }, (_, i) => (i * 3 * S0) / 4000);
    const bes = [];
    for (let i = 1; i < G.length; i++) {
      const a = profit(G[i - 1]), b2 = profit(G[i]);
      if (a === 0 && i === 1) bes.push(G[0]);
      if (a * b2 < 0) bes.push(G[i - 1] + (G[i] - G[i - 1]) * (a / (a - b2)));
    }
    const slope = legs.reduce((sum, l) => sum + (l.type === "put" ? 0 : l.q), 0); // dProfit/dS far right
    // Profit at expiry is piecewise linear with kinks at the strikes: test those too.
    const vals = [...G, ...legs.filter((l) => l.type !== "stock").map((l) => l.k)].map(profit);
    const maxP = slope > 0 ? Infinity : Math.max(...vals), minP = slope < 0 ? -Infinity : Math.min(...vals);
    const net = legs.reduce((sum, l) => sum + l.q * l.prem, 0);

    legsEl.replaceChildren();
    for (const l of legs) {
      const li = document.createElement("li");
      li.className = "rounded-full border px-2 py-0.5 " + (l.q > 0 ? "" : "text-muted-foreground");
      li.textContent = `${l.q > 0 ? "long" : "short"} ${l.type === "stock" ? "stock" : `${l.type} K ${num(l.k, 1)}`} @ ${fmt(l.prem, 2)}`;
      legsEl.append(li);
    }
    const note = document.createElement("li");
    note.className = "px-1 py-0.5 text-muted-foreground";
    note.textContent = `r = ${RATE * 100}%`;
    legsEl.append(note);

    o.net.textContent = net >= 0 ? `${fmt(net, 2)} paid` : `${fmt(-net, 2)} received`;
    o.be.textContent = bes.length ? bes.map((x) => fmt(x, 2)).join(" and ") : "none";
    o.maxp.textContent = Number.isFinite(maxP) ? fmt(maxP, 2) : "unlimited";
    o.maxl.textContent = Number.isFinite(minP) ? fmt(-minP, 2) : "unlimited";
  }
  draw();
}

// ============================================================ Binomial

// crr prices an option on an n-step Cox–Ross–Rubinstein tree. With keep,
// it also returns every node for drawing.
function crr(kind, S, K, T, v, r, n, keep) {
  const dt = T / n, u = Math.exp(v * Math.sqrt(dt)), d = 1 / u;
  const p = (Math.exp(r * dt) - d) / (u - d), disc = Math.exp(-r * dt);
  const isCall = kind === "ec";
  const pay = (x) => (isCall ? Math.max(x - K, 0) : Math.max(K - x, 0));
  let V = Array.from({ length: n + 1 }, (_, j) => pay(S * u ** j * d ** (n - j)));
  const nodes = keep ? [V.map((val, j) => ({ s: S * u ** j * d ** (n - j), v: val, ex: false }))] : null;
  for (let i = n - 1; i >= 0; i--) {
    const next = [];
    for (let j = 0; j <= i; j++) {
      const st = S * u ** j * d ** (i - j);
      let val = disc * (p * V[j + 1] + (1 - p) * V[j]);
      let ex = false;
      if (kind === "ap" && pay(st) > val + 1e-12) { val = pay(st); ex = true; }
      next.push(val);
      if (keep) (nodes[n - i] ??= []).push({ s: st, v: val, ex });
    }
    V = next;
  }
  return { price: V[0], u, d, p, nodes: keep ? nodes.reverse() : null };
}

for (const root of document.querySelectorAll("[data-fin-binom]")) {
  const tree = root.querySelector("[data-tree]");
  const conv = root.querySelector("[data-conv]");
  const o = outs(root);
  let kind = "ec";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });

  function draw() {
    const S = s.s.get(), K = s.k.get(), T = s.t.get(), v = s.v.get() / 100, r = s.r.get() / 100;
    const n = Math.round(s.n.get());
    const res = crr(kind, S, K, T, v, r, n, true);
    const b = bs(S, K, T, r, v);
    const euro = kind === "ec" ? b.call : b.put;

    tree.replaceChildren();
    const W = 560, H = 300, padX = 40, padY = 22;
    const pos = (i, j) => [padX + (i * (W - 2 * padX)) / n, H / 2 + ((i / 2 - j) * (H - 2 * padY)) / Math.max(n, 2)];
    res.nodes.forEach((col, i) => col.forEach((_, j) => {
      if (i < n) for (const k of [j, j + 1]) {
        const [x1, y1] = pos(i, j), [x2, y2] = pos(i + 1, k);
        el("line", { x1, y1, x2, y2, style: "stroke:currentColor;stroke-opacity:0.2" }, tree);
      }
    }));
    const fs = n > 4 ? 8.5 : 10;
    res.nodes.forEach((col, i) => col.forEach((nd, j) => {
      const [x, y] = pos(i, j);
      el("rect", { x: x - 22, y: y - 13, width: 44, height: 26, rx: 4, style: `fill:var(--background);stroke:${nd.ex ? "var(--brand)" : "currentColor"};stroke-opacity:${nd.ex ? 1 : 0.3}` }, tree);
      text(tree, x, y - 2, num(nd.s, 1), { "text-anchor": "middle", style: `font-size:${fs}px` });
      text(tree, x, y + 9, num(nd.v, 2), { "text-anchor": "middle", class: "font-mono", style: `font-size:${fs}px;fill:${nd.ex ? "var(--brand)" : "var(--foreground)"}` });
    }));
    text(tree, 4, 12, "S above, option value below" + (kind === "ap" ? "; pink: exercise early" : ""), { "text-anchor": "start" });

    const N = Array.from({ length: 100 }, (_, i) => i + 1);
    const prices = N.map((m) => crr(kind, S, K, T, v, r, m).price);
    const lo = Math.min(...prices, euro), hi = Math.max(...prices, euro), pad = (hi - lo) * 0.15 || 0.1;
    conv.replaceChildren();
    const f = frame(conv, { box: [52, 22, 490, 118], x: [1, 100], y: [lo - pad, hi + pad], xticks: [1, 25, 50, 75, 100], yticks: niceTicks(lo - pad, hi + pad, 3), yfmt: (x) => num(x, 2), xlabel: "steps", ylabel: "price" });
    line(conv, f, [1, euro], [100, euro], "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    text(conv, f.L + f.W - 4, f.sy(euro) - 5, kind === "ap" ? "European BS (lower bound)" : "Black–Scholes", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    polyline(conv, N.map((m, i) => [f.sx(m), f.sy(prices[i])]), "stroke:var(--brand);stroke-width:1.5");

    o.tree.textContent = fmt(res.price, 4);
    o.fine.textContent = fmt(crr(kind, S, K, T, v, r, 500).price, 4);
    o.bs.textContent = fmt(euro, 4) + (kind === "ap" ? " (European)" : "");
    o.udp.textContent = `${fmt(res.u, 4)}, ${fmt(res.d, 4)}, ${fmt(res.p, 4)}`;
  }
  draw();
}

// ============================================================ Portfolio

for (const root of document.querySelectorAll("[data-fin-port]")) {
  const svg = root.querySelector("[data-plot]");
  const wEl = root.querySelector("[data-fin-weights]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const NAMES = ["Stocks", "Bonds", "Gold"];

  function draw() {
    const m = [s.m1.get(), s.m2.get(), s.m3.get()].map((x) => x / 100);
    const sd = [s.s1.get(), s.s2.get(), s.s3.get()].map((x) => x / 100);
    const r12 = s.r12.get(), r13 = s.r13.get(), r23 = s.r23.get(), rf = s.rf.get() / 100;
    const rho = [[1, r12, r13], [r12, 1, r23], [r13, r23, 1]];
    const det = 1 + 2 * r12 * r13 * r23 - r12 ** 2 - r13 ** 2 - r23 ** 2;
    o.warn.textContent = det < -1e-12 ? "These three correlations cannot happen together (the correlation matrix is not positive semidefinite); impossible mixes are skipped." : "";

    // Every long-only mix on a 1% grid.
    const pts = [];
    for (let a = 0; a <= 100; a++) for (let b = 0; a + b <= 100; b++) {
      const w = [a / 100, b / 100, (100 - a - b) / 100];
      let varp = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) varp += w[i] * w[j] * sd[i] * sd[j] * rho[i][j];
      if (varp < 0) continue;
      pts.push({ w, mu: w[0] * m[0] + w[1] * m[1] + w[2] * m[2], sig: Math.sqrt(varp) });
    }
    if (!pts.length) return;
    const mv = pts.reduce((a, p) => (p.sig < a.sig ? p : a));
    const tan = pts.reduce((a, p) => ((p.mu - rf) / p.sig > (a.mu - rf) / a.sig ? p : a));

    // Upper envelope above the minimum-variance mix: the efficient frontier.
    const bins = new Map();
    for (const p of pts) if (p.mu >= mv.mu - 1e-12) {
      const k = Math.round(p.sig * 400);
      if (!bins.has(k) || bins.get(k).mu < p.mu) bins.set(k, p);
    }
    const env = [...bins.values()].sort((a, b) => a.sig - b.sig);
    // Along the frontier, more risk must buy more return.
    const front = [];
    let best = -Infinity;
    for (const p of env) if (p.mu > best) { best = p.mu; front.push(p); }

    const smax = Math.max(...pts.map((p) => p.sig)) * 1.1;
    const mus = pts.map((p) => p.mu);
    const ylo = Math.min(rf, ...mus) - 0.01, yhi = Math.max(...mus) + 0.015;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 490, 290], x: [0, smax], y: [ylo, yhi], xticks: niceTicks(0, smax), yticks: niceTicks(ylo, yhi), xfmt: (x) => `${Math.round(x * 100)}%`, yfmt: (y) => `${+(y * 100).toFixed(1)}%`, xlabel: "volatility σ", ylabel: "expected return" });
    let d = "";
    for (const p of pts) d += `M${f.sx(p.sig).toFixed(1)} ${f.sy(p.mu).toFixed(1)}h0.01`;
    el("path", { d, style: "stroke:var(--vec-u);stroke-opacity:0.35;stroke-width:3;stroke-linecap:round" }, svg);
    polyline(svg, front.map((p) => [f.sx(p.sig), f.sy(p.mu)]), "stroke:var(--foreground);stroke-width:2");
    // Capital market line from the risk-free rate through the tangency mix.
    const slope = (tan.mu - rf) / tan.sig;
    const xEnd = Math.min(smax, (yhi - rf) / slope);
    line(svg, f, [0, rf], [xEnd, rf + slope * xEnd], "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 4");
    for (let i = 0; i < 3; i++) {
      dot(svg, f, [sd[i], m[i]], "var(--foreground)", 3.5);
      text(svg, f.sx(sd[i]) + 6, f.sy(m[i]) + 3, NAMES[i], { "text-anchor": "start" });
    }
    dot(svg, f, [mv.sig, mv.mu], "var(--vec-u)", 5);
    text(svg, f.sx(mv.sig) - 7, f.sy(mv.mu) + 3, "min variance", { "text-anchor": "end" });
    dot(svg, f, [tan.sig, tan.mu], "var(--brand)", 5);
    text(svg, f.sx(tan.sig) - 7, f.sy(tan.mu) - 6, "tangency", { "text-anchor": "end", style: "fill:var(--brand)" });

    const mix = (p) => p.w.map((x, i) => `${NAMES[i]} ${Math.round(x * 100)}%`).join(" · ");
    const rows = [
      ["min variance", mix(mv)], ["", `return ${pct(mv.mu, 2)}, σ ${pct(mv.sig, 2)}`],
      ["tangency", mix(tan)], ["", `return ${pct(tan.mu, 2)}, σ ${pct(tan.sig, 2)}, Sharpe ${fmt(slope, 3)}`],
    ];
    wEl.replaceChildren();
    for (const [k, val] of rows) {
      const dt = document.createElement("dt");
      dt.className = "text-muted-foreground";
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.className = "tabular-nums";
      dd.textContent = val;
      wEl.append(dt, dd);
    }
  }
  draw();
}
