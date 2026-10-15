// Applied ethics blocks. Each model is small and stated in its block:
// distributive rules over five welfare levels, certainty equivalents
// behind the veil, principles checked against trolley answers, group
// fairness metrics of a calibrated score, Ramsey discounting, a QALY
// budget, expected choiceworthiness, a Gordon–Schaefer fishery, three
// population axiologies and a consent checklist. None of them gives a
// verdict on the contested question; they show what follows from a rule.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const segOf = (root, label) => root.querySelector(`[role=tablist][aria-label="${label}"] [aria-selected="true"]`)?.dataset.seg;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => sum(xs) / xs.length;
const C3 = ["var(--vec-i)", "var(--vec-j)", "var(--vec-u)"];
const fmt = (v, d = 1) => num(v, d);
const int = (v) => Math.round(v).toLocaleString("en-US");

/** Client coordinates to SVG user units. */
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/** Presses one [data-choice] in a group and releases the others. */
function press(group, v) {
  for (const b of group.querySelectorAll("[data-choice]")) b.setAttribute("aria-pressed", String(b.dataset.choice === v));
}
const pressed = (group) => group.querySelector('[data-choice][aria-pressed="true"]')?.dataset.choice;

// ============================================================ Distribution

/** Gini coefficient: mean absolute difference over twice the mean. */
export function gini(xs) {
  const n = xs.length, m = mean(xs);
  if (m === 0) return 0;
  let s = 0;
  for (const a of xs) for (const b of xs) s += Math.abs(a - b);
  return s / (2 * n * n * m);
}

/** Equally distributed equivalent with inequality aversion eps (Atkinson 1970). */
export function ede(xs, eps) {
  if (eps === 0) return mean(xs);
  if (Math.abs(eps - 1) < 1e-9) return Math.exp(mean(xs.map(Math.log)));
  return mean(xs.map((x) => x ** (1 - eps))) ** (1 / (1 - eps));
}

for (const root of document.querySelectorAll("[data-ethics-dist]")) {
  const o = outs(root);
  const body = root.querySelector("[data-rows]");
  const s = scrubAll(root, draw);
  const fixed = [
    ["Equal", [50, 50, 50, 50, 50]],
    ["Growth", [30, 45, 60, 80, 120]],
    ["Floor", [42, 48, 55, 60, 70]],
    ["Top-heavy", [10, 20, 60, 100, 150]],
  ];
  const theories = [
    { key: "sum", name: "the utilitarian sum", best: Math.max },
    { key: "min", name: "maximin", best: Math.max },
    { key: "ede", name: "prioritarianism", best: Math.max },
    { key: "gini", name: "strict equality", best: Math.min },
    { key: "below", name: "sufficiency", best: Math.min },
  ];
  let chosen = -1;

  body.addEventListener("click", (e) => {
    const tr = e.target.closest("[data-row]");
    if (!tr) return;
    chosen = Number(tr.dataset.row);
    draw();
    body.querySelector(`[data-row="${chosen}"]`)?.focus();
  });
  body.addEventListener("keydown", (e) => {
    const tr = e.target.closest("[data-row]");
    if (!tr) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      tr.click();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = Number(tr.dataset.row) + (e.key === "ArrowDown" ? 1 : -1);
      body.querySelector(`[data-row="${n}"]`)?.focus();
    }
  });

  function draw() {
    const eps = s.eps.get(), t = s.t.get();
    const custom = [1, 2, 3, 4, 5].map((i) => s["p" + i].get());
    const rows = [...fixed, ["Yours", custom]].map(([name, xs]) => {
      const short = sum(xs.map((x) => Math.max(0, t - x)));
      return { name, xs, sum: sum(xs), min: Math.min(...xs), ede: ede(xs, eps), gini: gini(xs), below: xs.filter((x) => x < t).length + short / 1e6, nBelow: xs.filter((x) => x < t).length };
    });
    const winners = Object.fromEntries(theories.map((th) => {
      const b = th.best(...rows.map((r) => r[th.key]));
      return [th.key, rows.map((r) => Math.abs(r[th.key] - b) < 1e-9)];
    }));
    const top = Math.max(...rows.flatMap((r) => r.xs));
    body.replaceChildren();
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.dataset.row = i;
      tr.tabIndex = 0;
      tr.setAttribute("aria-selected", String(i === chosen));
      tr.setAttribute("aria-label", `${r.name}: ${r.xs.join(", ")}`);
      tr.className = "cursor-pointer border-t outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-accent";
      const cell = (content, cls = "") => {
        const td = document.createElement("td");
        td.className = "px-2 py-1.5 " + cls;
        if (typeof content === "string") td.textContent = content;
        else td.append(content);
        tr.append(td);
        return td;
      };
      cell(r.name, "font-medium");
      const svg = el("svg", { viewBox: "0 0 110 34", class: "block h-8 w-28", "aria-hidden": "true" });
      r.xs.forEach((x, k) => {
        const hgt = Math.max(1, (x / top) * 30);
        el("rect", { x: k * 22 + 2, y: 32 - hgt, width: 16, height: hgt, rx: 2, style: `fill:${i === chosen ? "var(--brand)" : "var(--muted-foreground)"};fill-opacity:${i === chosen ? 0.8 : 0.45}` }, svg);
      });
      el("line", { x1: 0, x2: 110, y1: 32 - (t / top) * 30, y2: 32 - (t / top) * 30, style: "stroke:var(--code-del);stroke-dasharray:2 2;stroke-opacity:0.7" }, svg);
      cell(svg);
      const vals = { sum: fmt(r.sum, 0), min: fmt(r.min, 0), ede: fmt(r.ede, 1), gini: fmt(r.gini, 3), below: String(r.nBelow) };
      for (const th of theories) {
        cell(vals[th.key], "text-right font-mono tabular-nums " + (winners[th.key][i] ? "text-brand bg-brand/10 rounded-sm" : ""));
      }
      body.append(tr);
    });
    // Atkinson index of your own row.
    const m = mean(custom), e = ede(custom, eps);
    o.atk.textContent = fmt(1 - e / m, 3);
    o.ede.textContent = fmt(e, 1);
    o.mean.textContent = fmt(m, 1);
    if (chosen < 0) {
      o.verdict.textContent = "Click a row to choose it. Highlighted cells are each theory's first choice.";
      return;
    }
    const firsts = theories.filter((th) => winners[th.key][chosen]).map((th) => th.name);
    const r = rows[chosen];
    o.verdict.textContent = firsts.length
      ? `${r.name} is ranked first by ${list(firsts)}.`
      : `No theory here ranks ${r.name} first. That can still be a coherent choice: it may be a compromise between them.`;
  }
  draw();
}

function list(xs) {
  return xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs.at(-1);
}

// ============================================================ Veil of ignorance

/** Certainty equivalent of equally likely incomes under CRRA utility. */
export function ce(xs, rho) {
  if (Math.abs(rho - 1) < 1e-9) return Math.exp(mean(xs.map(Math.log)));
  return mean(xs.map((x) => x ** (1 - rho))) ** (1 / (1 - rho));
}

for (const root of document.querySelectorAll("[data-ethics-veil]")) {
  const svg = root.querySelector("[data-plot]");
  const log = root.querySelector("[data-draws]");
  const o = outs(root);
  const soc = [
    { name: "Flat", xs: [40, 40, 40, 40, 40] },
    { name: "Ladder", xs: [25, 35, 45, 60, 85] },
    { name: "Lottery", xs: [10, 30, 50, 80, 130] },
  ];
  let draws = [];
  const s = scrubAll(root, draw);
  const pick = () => Number(segOf(root, "Society") ?? 0);
  root.addEventListener("seg-change", () => { draws = []; draw(); });
  root.querySelector('[data-action="draw"]').addEventListener("click", () => drawLives(1));
  root.querySelector('[data-action="draw20"]').addEventListener("click", () => drawLives(20));

  function drawLives(n) {
    const xs = soc[pick()].xs;
    for (let i = 0; i < n; i++) {
      const k = Math.floor(Math.random() * 5);
      draws.push({ k, x: xs[k] });
    }
    draw();
  }

  function draw() {
    const rho = s.rho.get(), p = pick();
    svg.replaceChildren();
    // Left: strata bars.
    const L = 36, T = 24, W = 230, H = 220;
    const sy = (v) => T + H - (v / 140) * H;
    for (const v of [0, 40, 80, 120]) {
      el("line", { x1: L, x2: L + W, y1: sy(v), y2: sy(v), style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, L - 6, sy(v) + 3, String(v), { "text-anchor": "end" });
    }
    text(svg, L, T - 10, "income by fifth", {});
    soc.forEach((so, j) => {
      const gx = L + 8 + j * 76;
      so.xs.forEach((x, k) => {
        const hit = j === p && draws.length && draws.at(-1).k === k;
        el("rect", {
          x: gx + k * 13, y: sy(x), width: 10, height: sy(0) - sy(x), rx: 1.5,
          style: `fill:${C3[j]};fill-opacity:${j === p ? 0.85 : 0.3};${hit ? "stroke:var(--brand);stroke-width:2" : ""}`,
        }, svg);
      });
      text(svg, gx + 31, T + H + 14, so.name, { "text-anchor": "middle", class: j === p ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    });
    el("line", { x1: L, x2: L + W, y1: sy(0), y2: sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    // Right: certainty equivalents against rho.
    const f = frame(svg, { box: [330, 24, 290, 220], x: [0, 12], y: [0, 70], xticks: [0, 3, 6, 9, 12], yticks: [0, 20, 40, 60], xlabel: "risk aversion ρ" });
    text(svg, f.L, f.T - 10, "certainty equivalent", {});
    soc.forEach((so, j) => {
      const pts = [];
      for (let r = 0; r <= 12.001; r += 0.1) pts.push([f.sx(r), f.sy(ce(so.xs, r))]);
      polyline(svg, pts, `stroke:${C3[j]};stroke-width:${j === p ? 2.25 : 1.5};stroke-opacity:${j === p ? 1 : 0.6}`);
    });
    el("line", { x1: f.sx(rho), x2: f.sx(rho), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    const ces = soc.map((so) => ce(so.xs, rho));
    ces.forEach((v, j) => el("circle", { cx: f.sx(rho), cy: f.sy(v), r: 3.5, style: `fill:var(--background);stroke:${C3[j]};stroke-width:1.75` }, svg));
    const best = ces.indexOf(Math.max(...ces));
    o.ev.textContent = "Lottery";
    o.maximin.textContent = "Flat";
    o.ce.textContent = `${soc[best].name} (${fmt(ces[best], 1)})`;
    if (draws.length) {
      const last = draws.at(-1);
      o.mean.textContent = `${fmt(mean(draws.map((d) => d.x)), 1)} over ${draws.length}`;
      log.textContent = `In ${soc[p].name} you were born into fifth ${last.k + 1}, with income ${last.x}. Lowest so far: ${Math.min(...draws.map((d) => d.x))}.`;
    } else {
      o.mean.textContent = "—";
      log.textContent = "No lives drawn yet.";
    }
  }
  draw();
}

// ============================================================ Trolley family

const trolleyFacts = {
  switch: { means: false, force: false, redirect: true },
  footbridge: { means: true, force: true, redirect: false },
  trapdoor: { means: true, force: false, redirect: false },
  loop: { means: true, force: false, redirect: true },
  weight: { means: false, force: false, redirect: true },
  surgeon: { means: true, force: true, redirect: false },
};
const trolleyNames = { switch: "Switch", footbridge: "Footbridge", trapdoor: "Trapdoor", loop: "Loop", weight: "Loop with a weight", surgeon: "Surgeon" };
const principles = [
  { name: "Minimise deaths", who: "act-consequentialism", ok: () => true },
  { name: "Double effect", who: "harm only as a side effect, never as a means", ok: (f) => !f.means },
  { name: "No personal force", who: "Greene et al. 2009", ok: (f) => !f.force },
  { name: "Redirect an existing threat", who: "Thomson 1976", ok: (f) => f.redirect },
  { name: "Never kill", who: "killing is worse than letting die", ok: () => false },
];

for (const root of document.querySelectorAll("[data-ethics-trolley]")) {
  const list_ = root.querySelector("[data-principles]");
  const o = outs(root);
  const groups = [...root.querySelectorAll("[data-case]")];
  for (const g of groups) {
    g.addEventListener("click", (e) => {
      const b = e.target.closest("[data-choice]");
      if (!b) return;
      press(g, b.dataset.choice);
      draw();
    });
  }
  root.querySelector('[data-action="common"]').addEventListener("click", () => {
    const ex = { switch: "yes", footbridge: "no", trapdoor: "no", loop: "yes", weight: "yes", surgeon: "no" };
    for (const g of groups) press(g, ex[g.dataset.case]);
    draw();
  });
  root.querySelector('[data-action="clear"]').addEventListener("click", () => {
    for (const g of groups) press(g, "");
    draw();
  });

  function draw() {
    const answers = Object.fromEntries(groups.map((g) => [g.dataset.case, pressed(g)]));
    const done = Object.values(answers).filter(Boolean).length;
    list_.replaceChildren();
    const fits = [];
    for (const p of principles) {
      const miss = groups.map((g) => g.dataset.case).filter((id) => answers[id] && (answers[id] === "yes") !== p.ok(trolleyFacts[id]));
      const match = done - miss.length;
      const all = done === 6 && miss.length === 0;
      if (all) fits.push(p.name);
      const li = document.createElement("li");
      li.className = "flex flex-col gap-0.5 rounded-lg border px-3 py-2 transition-colors duration-150 " + (all ? "border-brand/50 bg-brand/5" : "");
      const head = document.createElement("div");
      head.className = "flex items-center justify-between gap-3 text-sm";
      const nm = document.createElement("span");
      nm.className = all ? "font-medium text-brand" : "font-medium";
      nm.textContent = p.name;
      const sc = document.createElement("span");
      sc.className = "font-mono text-xs tabular-nums " + (all ? "text-brand" : "text-muted-foreground");
      sc.textContent = done ? `${match}/${done}` : "—";
      head.append(nm, sc);
      const sub = document.createElement("span");
      sub.className = "text-xs text-muted-foreground";
      sub.textContent = miss.length ? `Disagrees on ${list(miss.map((id) => trolleyNames[id]))}` : p.who;
      li.append(head, sub);
      list_.append(li);
    }
    if (done < 6) o.msg.textContent = `${done} of 6 answered.`;
    else if (fits.length) o.msg.textContent = `Fits every answer: ${list(fits)}. Another principle not listed here could fit too.`;
    else o.msg.textContent = "No principle listed fits all six. Either one answer gives way under reflection, or the principle you use is not on this list.";
  }
  draw();
}

// ============================================================ Fairness

const BINS = 1000;

/** A calibrated score distribution: Beta with the given mean and P(y | s) = s. */
function scoreDist(mu, k = 5) {
  const a = mu * k, b = (1 - mu) * k;
  const s = [], w = [];
  for (let i = 0; i < BINS; i++) {
    const x = (i + 0.5) / BINS;
    s.push(x);
    w.push(x ** (a - 1) * (1 - x) ** (b - 1));
  }
  const z = sum(w);
  return { s, w: w.map((v) => v / z), mu };
}

/** Group metrics at threshold t. */
export function fairMetrics(d, t) {
  let sel = 0, tp = 0, fp = 0, base = 0;
  for (let i = 0; i < BINS; i++) {
    base += d.s[i] * d.w[i];
    if (d.s[i] >= t) {
      sel += d.w[i];
      tp += d.s[i] * d.w[i];
      fp += (1 - d.s[i]) * d.w[i];
    }
  }
  return { sel, tpr: tp / base, fpr: fp / (1 - base), ppv: sel ? tp / sel : NaN, base };
}

for (const root of document.querySelectorAll("[data-ethics-fair]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  let note = "";
  const s = scrubAll(root, () => { note = ""; draw(); });
  for (const b of root.querySelectorAll("[data-preset]")) {
    b.addEventListener("click", () => {
      const key = b.dataset.preset;
      const A = scoreDist(s.baseA.get() / 100), B = scoreDist(s.baseB.get() / 100);
      const tA = s.tA.get();
      if (key === "same") s.tB.set(tA, false);
      else {
        const goal = fairMetrics(A, tA)[key];
        let best = 0.5, err = Infinity;
        for (let t = 0.01; t <= 0.99; t += 0.001) {
          const e = Math.abs(fairMetrics(B, t)[key] - goal);
          if (e < err) { err = e; best = t; }
        }
        s.tB.set(best, false);
      }
      note = { sel: "Selection rates now match.", tpr: "True positive rates now match.", fpr: "False positive rates now match.", same: "Both groups now use one threshold." }[key];
      draw();
    });
  }

  function draw() {
    const A = scoreDist(s.baseA.get() / 100), B = scoreDist(s.baseB.get() / 100);
    const tA = s.tA.get(), tB = s.tB.get();
    const mA = fairMetrics(A, tA), mB = fairMetrics(B, tB);
    svg.replaceChildren();
    const panel = (d, t, top, name) => {
      const L = 44, W = 580, H = 100;
      const ymax = Math.max(...d.w) * 1.1;
      const sx = (x) => L + x * W, sy = (v) => top + H - (v / ymax) * H;
      el("rect", { x: sx(t), y: top, width: L + W - sx(t), height: H, style: "fill:var(--brand);fill-opacity:0.06" }, svg);
      const yes = [[sx(0), sy(0)]], all = [[sx(0), sy(0)]];
      for (let i = 0; i < BINS; i += 4) {
        yes.push([sx(d.s[i]), sy(d.s[i] * d.w[i])]);
        all.push([sx(d.s[i]), sy(d.w[i])]);
      }
      yes.push([sx(1), sy(0)]);
      all.push([sx(1), sy(0)]);
      el("polygon", { points: all.map((p) => p.join(",")).join(" "), style: "fill:var(--vec-j);fill-opacity:0.35;stroke:var(--vec-j);stroke-width:1" }, svg);
      el("polygon", { points: yes.map((p) => p.join(",")).join(" "), style: "fill:var(--vec-i);fill-opacity:0.55;stroke:var(--vec-i);stroke-width:1" }, svg);
      el("line", { x1: L, x2: L + W, y1: top + H, y2: top + H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      el("line", { x1: sx(t), x2: sx(t), y1: top - 4, y2: top + H, style: "stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, sx(t) + 4, top + 6, `t = ${num(t, 3)}`, { class: "fill-brand font-mono text-[10px]" });
      text(svg, 4, top + 12, name, { class: "fill-foreground font-mono text-[11px]" });
      text(svg, 4, top + 26, `base ${num(d.mu * 100, 0)}%`, {});
    };
    panel(A, tA, 16, "A");
    panel(B, tB, 150, "B");
    for (const x of [0, 0.25, 0.5, 0.75, 1]) text(svg, 44 + x * 580, 266, String(x), { "text-anchor": "middle" });
    text(svg, 624, 282, "risk score", { "text-anchor": "end" });
    const pts = (v) => num(v * 100, 1);
    const rows = [
      ["selection rate (parity)", mA.sel, mB.sel],
      ["true positive rate (opportunity)", mA.tpr, mB.tpr],
      ["false positive rate", mA.fpr, mB.fpr],
      ["predictive value (PPV)", mA.ppv, mB.ppv],
    ];
    const holds = rows.map((r) => Math.abs(r[1] - r[2]) * 100 < 1);
    table.replaceChildren();
    const row = (cells, ok) => {
      const tr = document.createElement("tr");
      tr.className = "border-t";
      cells.forEach((c, i) => {
        const td = document.createElement("td");
        td.className = "px-2 py-1 " + (i ? "text-right tabular-nums" : "") + (i === 4 ? (ok ? " text-brand" : " text-[var(--code-del)]") : "");
        td.textContent = c;
        tr.append(td);
      });
      table.append(tr);
    };
    rows.forEach((r, i) => row([r[0], pts(r[1]) + "%", pts(r[2]) + "%", pts(Math.abs(r[1] - r[2])), holds[i] ? "yes" : "no"], holds[i]));
    const odds = holds[1] && holds[2], all3 = odds && holds[3];
    row(["equalized odds (TPR and FPR)", "", "", "", odds ? "yes" : "no"], odds);
    row(["PPV, FPR and FNR together", "", "", "", all3 ? "yes" : "no"], all3);
    row(["score calibrated in each group", "", "", "0.0", "yes"], true);
    const unequal = Math.abs(A.mu - B.mu) > 0.005;
    o.msg.textContent = (note ? note + " " : "") + (unequal
      ? `Base rates differ (${num(A.mu * 100, 0)}% vs ${num(B.mu * 100, 0)}%), so equal PPV, equal false positive rates and equal false negative rates cannot all hold, except when almost no one is flagged.`
      : "With equal base rates, one threshold satisfies every criterion here at once.");
  }
  draw();
}

// ============================================================ Discounting

/** Ramsey rule in percent and the discrete discount factor. */
export const ramsey = (delta, eta, g) => delta + eta * g;
export const discount = (rPct, T) => (1 + rPct / 100) ** -T;

for (const root of document.querySelectorAll("[data-ethics-disc]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  for (const b of root.querySelectorAll("[data-preset]")) {
    b.addEventListener("click", () => {
      const [d, e, g] = b.dataset.preset.split(" ").map(Number);
      s.delta.set(d, false); s.eta.set(e, false); s.g.set(g, false);
      draw();
    });
  }
  function draw() {
    const r = ramsey(s.delta.get(), s.eta.get(), s.g.get());
    const T = s.T.get(), D = s.D.get();
    const xmax = Math.max(200, Math.ceil(T / 50) * 50);
    svg.replaceChildren();
    const ymax = r < 0 ? Math.min(4, Math.max(1.2, discount(r, xmax) * 1.05)) : 1.05;
    const f = frame(svg, { box: [44, 22, 576, 230], x: [0, xmax], y: [0, ymax], xticks: [0, xmax / 4, xmax / 2, (3 * xmax) / 4, xmax], yticks: ymax > 1.5 ? [0, 1, 2, 3, 4].filter((v) => v <= ymax) : [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => String(v), xlabel: "years ahead", ylabel: "value today of 1 then" });
    const curve = (rate, style) => {
      const pts = [];
      for (let t = 0; t <= xmax; t += xmax / 200) pts.push([f.sx(t), f.sy(Math.min(ymax, discount(rate, t)))]);
      polyline(svg, pts, style);
    };
    curve(r, "stroke:var(--brand);stroke-width:2.5");
    curve(ramsey(0.1, 1, 1.3), "stroke:var(--vec-i);stroke-width:1.5;stroke-dasharray:5 3");
    curve(ramsey(1.5, 1.45, 2), "stroke:var(--vec-j);stroke-width:1.5;stroke-dasharray:5 3");
    const fT = discount(r, T);
    el("line", { x1: f.sx(T), x2: f.sx(T), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(T), cy: f.sy(Math.min(ymax, fT)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(T) + 6, f.sy(Math.min(ymax, fT)) - 6, num(fT, 3), { class: "fill-foreground font-mono text-[10px]" });
    o.r.textContent = `${num(r, 2)}%`;
    o.f.textContent = num(fT, 4);
    o.pv.textContent = `${num(D * fT, D * fT < 10 ? 2 : 0)} bn`;
    o.half.textContent = r > 0 ? `${num(Math.log(2) / Math.log(1 + r / 100), 0)} years` : r < 0 ? "value grows" : "never";
  }
  draw();
}

// ============================================================ QALY budget

const programmes = [
  { id: "A", name: "Vaccines", n: 200000, cost: 40, q: 0.01, sev: 0.1 },
  { id: "B", name: "BP screening", n: 50000, cost: 150, q: 0.02, sev: 0.2 },
  { id: "C", name: "Hips", n: 2000, cost: 8000, q: 0.8, sev: 0.4 },
  { id: "D", name: "Dialysis", n: 300, cost: 40000, q: 0.6, sev: 0.9 },
  { id: "E", name: "Rare-disease drug", n: 40, cost: 200000, q: 1.5, sev: 1 },
];

/** Greedy allocation by cost per (weighted) QALY; partial funding allowed. */
export function allocate(budget, omega, rescue) {
  const w = (p) => 1 + omega * p.sev;
  const order = [...programmes].sort((a, b) => a.cost / (a.q * w(a)) - b.cost / (b.q * w(b)));
  if (rescue) order.unshift(...order.splice(order.findIndex((p) => p.id === "E"), 1));
  let left = budget * 1e6;
  const out = order.map((p) => {
    const full = p.n * p.cost;
    const spend = Math.min(full, Math.max(0, left));
    left -= spend;
    const treated = spend / p.cost;
    return { p, spend, full, treated, qalys: treated * p.q, wq: treated * p.q * w(p) };
  });
  return out;
}

for (const root of document.querySelectorAll("[data-ethics-qaly]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let rescue = false;
  const s = scrubAll(root, draw);
  root.querySelector('[data-toggle="rescue"]').addEventListener("shadcn:checked-change", (e) => { rescue = e.detail.checked; draw(); });

  function draw() {
    const budget = s.budget.get(), omega = s.omega.get();
    const res = allocate(budget, omega, rescue);
    const pure = allocate(budget, 0, false);
    svg.replaceChildren();
    const L = 52, T = 26, W = 568, H = 220;
    const total = sum(programmes.map((p) => p.n * p.cost));
    const ly = (v) => T + H - ((Math.log10(v) - 3) / (Math.log10(300000) - 3)) * H;
    for (const v of [1000, 3000, 10000, 30000, 100000, 300000]) {
      el("line", { x1: L, x2: L + W, y1: ly(v), y2: ly(v), style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, L - 6, ly(v) + 3, v >= 1000 ? `${v / 1000}k` : String(v), { "text-anchor": "end" });
    }
    text(svg, 4, T - 10, "cost per QALY (€, log)", {});
    let x = L;
    for (const r of res) {
      const w = (r.full / total) * W;
      const y = ly(r.p.cost / r.p.q);
      el("rect", { x, y, width: w, height: T + H - y, style: "fill:var(--muted-foreground);fill-opacity:0.18;stroke:var(--muted-foreground);stroke-opacity:0.4" }, svg);
      const fw = (r.spend / total) * W;
      if (fw > 0) el("rect", { x, y, width: fw, height: T + H - y, style: "fill:var(--brand);fill-opacity:0.55" }, svg);
      text(svg, x + Math.max(w, 10) / 2, y - 5, r.p.id, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      x += w;
    }
    const bx = L + ((budget * 1e6) / total) * W;
    el("line", { x1: Math.min(bx, L + W), x2: Math.min(bx, L + W), y1: T - 4, y2: T + H, style: "stroke:var(--brand);stroke-dasharray:4 3" }, svg);
    text(svg, Math.min(bx, L + W) - 4, T + 8, `budget €${budget}M`, { "text-anchor": "end", class: "fill-brand font-mono text-[10px]" });
    el("line", { x1: L, x2: L + W, y1: T + H, y2: T + H, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    text(svg, L + W, T + H + 14, `width = cost to treat everyone (total €${num(total / 1e6, 1)}M)`, { "text-anchor": "end" });
    text(svg, L, T + H + 30, res.map((r) => `${r.p.id} ${r.p.name}`).join(" · "), {});
    const q = sum(res.map((r) => r.qalys)), wq = sum(res.map((r) => r.wq)), n = sum(res.map((r) => r.treated));
    const qPure = sum(pure.map((r) => r.qalys));
    const last = [...res].reverse().find((r) => r.spend > 0);
    o.q.textContent = int(q);
    o.wq.textContent = int(wq);
    o.n.textContent = int(n);
    o.icer.textContent = last ? `€${int(last.p.cost / last.p.q)}` : "—";
    const loss = q - qPure;
    o.loss.textContent = Math.abs(loss) < 0.5 ? "same" : `${loss < 0 ? "−" : "+"}${num(Math.abs(loss), 0)} QALYs (${num((loss / qPure) * 100, 1)}%)`;
  }
  draw();
}

// ============================================================ Moral uncertainty

// Choiceworthiness of acts A, B, C on each theory's own scale (invented).
const theoriesMU = [
  { name: "Consequences", cw: [90, 60, -20] },
  { name: "Rights", cw: [-100, 10, 20] },
  { name: "Virtue", cw: [0, 40, 30] },
];

function normalised() {
  return theoriesMU.map((t) => {
    const m = mean(t.cw), sd = Math.sqrt(mean(t.cw.map((v) => (v - m) ** 2))) || 1;
    return t.cw.map((v) => (v - m) / sd);
  });
}

/** The act each method picks, with the expected choiceworthiness. */
export function muPick(cred, method) {
  const table = method === "norm" ? normalised() : theoriesMU.map((t) => t.cw);
  if (method === "mft") {
    const k = cred.indexOf(Math.max(...cred));
    const row = theoriesMU[k].cw;
    return { pick: row.indexOf(Math.max(...row)), ec: null };
  }
  const ec = [0, 1, 2].map((a) => sum(cred.map((c, t) => c * table[t][a])));
  return { pick: ec.indexOf(Math.max(...ec)), ec };
}

for (const root of document.querySelectorAll("[data-ethics-mu]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let cred = [0.4, 0.3, 0.3];
  svg.setAttribute("tabindex", "0");
  svg.classList.add("outline-none", "focus-visible:ring-2", "focus-visible:ring-ring/50", "rounded-md");
  // Triangle: T1 top, T2 bottom left, T3 bottom right.
  const V = [[150, 22], [22, 262], [278, 262]];
  const toXY = (c) => [0, 1].map((k) => c[0] * V[0][k] + c[1] * V[1][k] + c[2] * V[2][k]);
  function fromXY(x, y) {
    const [[x1, y1], [x2, y2], [x3, y3]] = V;
    const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    let a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
    let b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
    a = clamp(a, 0, 1); b = clamp(b, 0, 1 - a);
    return [a, b, 1 - a - b];
  }
  const method = () => segOf(root, "Method") ?? "mec";
  root.addEventListener("seg-change", draw);
  for (const b of root.querySelectorAll("[data-preset]")) {
    b.addEventListener("click", () => { cred = b.dataset.preset.split(" ").map(Number); draw(); });
  }
  let drag = false;
  svg.addEventListener("pointerdown", (e) => {
    const p = svgPoint(svg, e);
    if (p.x > 300) return;
    drag = true;
    svg.setPointerCapture(e.pointerId);
    cred = fromXY(p.x, p.y);
    draw();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = svgPoint(svg, e);
    cred = fromXY(p.x, p.y);
    draw();
  });
  svg.addEventListener("pointerup", () => (drag = false));
  svg.addEventListener("keydown", (e) => {
    const st = e.shiftKey ? 0.1 : 0.02;
    const [x, y] = toXY(cred);
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!mv) return;
    e.preventDefault();
    cred = fromXY(x + mv[0] * st * 256, y + mv[1] * st * 240);
    draw();
  });

  function draw() {
    const m = method();
    svg.replaceChildren();
    // Map of picks.
    const N = 30;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N - i; j++) {
        const tri = (pts) => {
          const c = [0, 1, 2].map((k) => mean(pts.map((p) => p[k])));
          const { pick } = muPick(c, m);
          el("polygon", { points: pts.map((p) => toXY(p).join(",")).join(" "), style: `fill:${C3[pick]};fill-opacity:0.28;stroke:${C3[pick]};stroke-opacity:0.28;stroke-width:0.5` }, svg);
        };
        const P = (a, b) => [a / N, b / N, 1 - (a + b) / N];
        tri([P(i, j), P(i + 1, j), P(i, j + 1)]);
        if (i + j < N - 1) tri([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
      }
    }
    el("polygon", { points: V.map((p) => p.join(",")).join(" "), style: "fill:none;stroke:currentColor;stroke-opacity:0.4" }, svg);
    text(svg, V[0][0], V[0][1] - 8, theoriesMU[0].name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    text(svg, V[1][0], V[1][1] + 16, theoriesMU[1].name, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    text(svg, V[2][0], V[2][1] + 16, theoriesMU[2].name, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    const [px, py] = toXY(cred);
    el("circle", { cx: px, cy: py, r: 7, style: "fill:var(--background);stroke:var(--brand);stroke-width:2.5" }, svg);
    // Table.
    const { pick, ec } = muPick(cred, m);
    const tx = 318, cw = 58, top = 40;
    const tab = m === "norm" ? normalised() : theoriesMU.map((t) => t.cw);
    ["credence", "A", "B", "C"].forEach((hd, k) => text(svg, tx + 140 + k * cw, top, hd, { "text-anchor": "end", class: k && k - 1 === pick ? "fill-brand font-mono text-[11px]" : "fill-muted-foreground font-mono text-[11px]" }));
    theoriesMU.forEach((t, r) => {
      const y = top + 26 + r * 26;
      text(svg, tx, y, t.name, { class: "fill-foreground font-mono text-[11px]" });
      text(svg, tx + 140, y, `${num(cred[r] * 100, 0)}%`, { "text-anchor": "end", class: "fill-foreground font-mono text-[11px]" });
      const best = Math.max(...tab[r]);
      tab[r].forEach((v, a) => {
        text(svg, tx + 140 + (a + 1) * cw, y, num(v, m === "norm" ? 2 : 0), { "text-anchor": "end", class: v === best ? "fill-foreground font-mono text-[11px] underline" : "fill-muted-foreground font-mono text-[11px]" });
      });
    });
    const yE = top + 26 + 3 * 26 + 8;
    el("line", { x1: tx, x2: tx + 140 + 3 * cw, y1: yE - 16, y2: yE - 16, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
    text(svg, tx, yE, m === "mft" ? "favourite" : "expected", { class: "fill-muted-foreground font-mono text-[11px]" });
    [0, 1, 2].forEach((a) => {
      const v = ec ? num(ec[a], m === "norm" ? 2 : 1) : a === pick ? "chosen" : "";
      text(svg, tx + 140 + (a + 1) * cw, yE, v, { "text-anchor": "end", class: a === pick ? "fill-brand font-mono text-[11px]" : "fill-muted-foreground font-mono text-[11px]" });
    });
    text(svg, tx, yE + 40, "Underlined: each theory's own first choice.", {});
    text(svg, tx, yE + 56, "Act B is never first, yet often wins on expectation.", {});
    o.cred.textContent = cred.map((c) => num(c * 100, 0)).join(" · ");
    o.ec.textContent = ec ? ec.map((v, a) => `${"ABC"[a]} ${num(v, m === "norm" ? 2 : 1)}`).join("  ") : "—";
    o.pick.textContent = `Act ${"ABC"[pick]}`;
    svg.setAttribute("aria-label", `Credences ${o.cred.textContent}; the method picks act ${"ABC"[pick]}.`);
  }
  draw();
}

// ============================================================ Commons

const FISH = { K: 1000, r: 0.4, q: 0.01, c: 2, cap: 10 };

/** Fifty years of a Gordon–Schaefer fishery under one regime. */
export function fishery(regime, n, p, years = 50) {
  const { K, r, q, c, cap } = FISH;
  const msy = (r * K) / 4;
  let S = 900, E = 5;
  if (regime === "owner") {
    const sStar = Math.min(K, (K + c / (p * q)) / 2);
    E = Math.max(0, Math.min(cap * n, (r * (1 - sStar / K)) / q));
  }
  const out = [{ t: 0, S, H: 0, rent: 0, E }];
  for (let t = 1; t <= years; t++) {
    let H = Math.min(S, q * E * S);
    if (regime === "quota") H = Math.min(H, 0.9 * msy);
    const rent = p * H - c * E;
    S = Math.max(0, S + r * S * (1 - S / K) - H);
    if (regime !== "owner") E = clamp(E + (0.05 * rent) / c, 0.5, cap * n);
    out.push({ t, S, H, rent, E });
  }
  return out;
}

for (const root of document.querySelectorAll("[data-ethics-commons]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const play = root.querySelector('[data-action="play"]');
  play.querySelector("[data-label]").textContent = "Run";
  let year = 50, timer = null, last = 0;
  const s = scrubAll(root, () => draw());
  const regime = () => segOf(root, "Regime") ?? "open";
  root.addEventListener("seg-change", () => draw());
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { stop(); year = 50; draw(); });
  play.addEventListener("click", () => (timer ? stop() : start()));
  const setIcon = (on) => {
    play.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    play.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    play.querySelector("[data-label]").textContent = on ? "Pause" : "Run";
  };
  function start() {
    if (reduced()) { year = 50; draw(); return; }
    if (year >= 50) year = 0;
    setIcon(true);
    last = performance.now();
    const step = (now) => {
      if (now - last > 140) { year++; last = now; draw(); }
      if (year >= 50) return stop();
      timer = requestAnimationFrame(step);
    };
    timer = requestAnimationFrame(step);
  }
  function stop() {
    if (timer) cancelAnimationFrame(timer);
    timer = null;
    setIcon(false);
  }
  new IntersectionObserver((es) => { if (!es[0].isIntersecting) stop(); }).observe(root);

  function draw() {
    const run = fishery(regime(), s.n.get(), s.price.get());
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 22, 576, 230], x: [0, 50], y: [0, 1000], xticks: [0, 10, 20, 30, 40, 50], yticks: [0, 250, 500, 750, 1000], xlabel: "year", ylabel: "tonnes" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(500), y2: f.sy(500), style: "stroke:var(--muted-foreground);stroke-dasharray:4 3;stroke-opacity:0.7" }, svg);
    text(svg, f.L + f.W - 2, f.sy(500) - 4, "MSY stock", { "text-anchor": "end" });
    const shown = run.slice(0, year + 1);
    polyline(svg, shown.map((d) => [f.sx(d.t), f.sy(d.S)]), "stroke:var(--vec-i);stroke-width:2");
    polyline(svg, shown.slice(1).map((d) => [f.sx(d.t), f.sy(Math.min(1000, d.H * 5))]), "stroke:var(--vec-j);stroke-width:1.75");
    const d = run[year];
    el("circle", { cx: f.sx(d.t), cy: f.sy(d.S), r: 4, style: "fill:var(--background);stroke:var(--vec-i);stroke-width:2" }, svg);
    o.year.textContent = String(d.t);
    o.stock.textContent = `${num(d.S, 0)} t`;
    o.catch.textContent = `${num(d.H, 1)} t`;
    o.rent.textContent = num(d.rent, 1);
  }
  draw();
}

// ============================================================ Population ethics

for (const root of document.querySelectorAll("[data-ethics-pop]")) {
  const svg = root.querySelector("[data-plot]");
  const rank = root.querySelector("[data-rank]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const c = s.c.get();
    const worlds = [
      { name: "A", groups: [[10, 80]] },
      { name: "A+", groups: [[10, 80], [10, 30]] },
      { name: "B", groups: [[20, 60]] },
      { name: "Z", groups: [[s.zn.get(), s.zw.get()]] },
    ];
    for (const w of worlds) {
      w.n = sum(w.groups.map((g) => g[0]));
      w.total = sum(w.groups.map((g) => g[0] * g[1]));
      w.avg = w.total / w.n;
      w.crit = sum(w.groups.map((g) => g[0] * (g[1] - c)));
    }
    svg.replaceChildren();
    const base = 220, top = 30;
    const maxW = Math.max(...worlds.flatMap((w) => w.groups.map((g) => g[1])), 1);
    const minW = Math.min(0, ...worlds.flatMap((w) => w.groups.map((g) => g[1])));
    const sy = (v) => base - (v / Math.max(maxW, 1)) * (base - top);
    const maxN = Math.max(...worlds.map((w) => w.n));
    const width = (n) => 12 + Math.sqrt(n / maxN) * 120;
    let x = 20;
    el("line", { x1: 10, x2: 630, y1: base, y2: base, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    if (c > 0) {
      el("line", { x1: 10, x2: 630, y1: sy(c), y2: sy(c), style: "stroke:var(--code-del);stroke-dasharray:4 3;stroke-opacity:0.7" }, svg);
      text(svg, 628, sy(c) - 4, `critical level ${c}`, { "text-anchor": "end" });
    }
    for (const w of worlds) {
      const W = width(w.n);
      let gx = x;
      for (const [n, v] of w.groups) {
        const gw = (n / w.n) * W;
        const y = sy(Math.max(v, 0)), y0 = sy(Math.min(v, 0));
        el("rect", { x: gx, y: Math.min(y, base), width: gw, height: Math.max(1, Math.abs(y0 - y) || Math.abs(base - y)), style: `fill:${v < 0 ? "var(--code-del)" : "var(--vec-i)"};fill-opacity:0.5;stroke:var(--vec-i);stroke-opacity:0.6` }, svg);
        gx += gw;
      }
      text(svg, x + W / 2, base + 16, w.name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      text(svg, x + W / 2, base + 30, `${num(w.n, 0)} bn`, { "text-anchor": "middle" });
      x += W + 26;
    }
    text(svg, 12, 16, "height = welfare per person · width grows with √people", {});
    if (minW < 0) text(svg, 12, 296, "negative welfare is drawn below the line", {});
    const views = [
      { name: "Total", key: "total" },
      { name: "Average", key: "avg" },
      { name: `Critical level (c = ${c})`, key: "crit" },
    ];
    rank.replaceChildren();
    const order = {};
    for (const v of views) {
      const sorted = [...worlds].sort((a, b) => b[v.key] - a[v.key]);
      order[v.key] = sorted.map((w) => w.name);
      const div = document.createElement("div");
      div.className = "flex flex-col gap-1 rounded-lg border p-2";
      const h = document.createElement("span");
      h.className = "text-muted-foreground";
      h.textContent = v.name;
      const r = document.createElement("span");
      r.className = "text-foreground";
      r.textContent = sorted.map((w) => w.name).join(" > ");
      const vals = document.createElement("span");
      vals.className = "text-[11px] text-muted-foreground";
      vals.textContent = sorted.map((w) => `${w.name} ${num(w[v.key], v.key === "avg" ? 1 : 0)}`).join(" · ");
      div.append(h, r, vals);
      rank.append(div);
    }
    const Z = worlds[3], A = worlds[0];
    const msgs = [];
    if (Z.total > A.total && Z.avg > 0) msgs.push("The total view ranks Z above A: Parfit's repugnant conclusion.");
    else msgs.push("At these settings the total view does not rank Z above A.");
    if (worlds[1].avg < A.avg) msgs.push("The average view ranks A+ below A, though A+ only adds lives worth living and harms no one in A.");
    if (Z.avg > 0 && Z.avg < c) msgs.push("The critical-level view counts Z's lives, each worth living, against it.");
    o.msg.textContent = msgs.join(" ");
  }
  draw();
}

// ============================================================ Research ethics

const caseNotes = {
  tuskegee: "Usually cited under all three: no informed consent (respect for persons), treatment withheld (beneficence), and the burden placed on poor Black men (justice). The Belmont Report itself names it in its discussion of justice.",
  milgram: "Discussion centres on deception and distress: consent obtained under deception (respect for persons) and harm weighed against knowledge (beneficence). Participants were debriefed; critics question whether that was enough.",
  contagion: "Most debate is about respect for persons: whether agreeing to terms of service is informed consent. PNAS published an editorial expression of concern in 2014.",
  havasupai: "Consent given for one purpose was stretched to others (respect for persons), and harm fell on a whole community (justice). The 2010 settlement returned the samples to the tribe.",
};
const principleNames = { respect: "respect for persons", beneficence: "beneficence", justice: "justice" };

for (const root of document.querySelectorAll("[data-ethics-research]")) {
  const o = outs(root);
  for (const li of root.querySelectorAll("[data-case]")) {
    const disc = li.querySelector("[data-discuss]");
    li.addEventListener("click", (e) => {
      const b = e.target.closest("[data-choice]");
      if (!b) return;
      press(li, b.dataset.choice);
      disc.hidden = false;
      disc.textContent = `You chose ${principleNames[b.dataset.choice]}. ${caseNotes[li.dataset.case]}`;
    });
  }
  const items = [...root.querySelectorAll("[data-item]")];
  const label = (cb) => cb.closest("label").querySelector("span > span").textContent;
  const title = root.querySelector("[data-title]");
  const update = () => {
    const missing = items.filter((cb) => !cb.checked);
    const have = items.length - missing.length;
    o.missing.textContent = !missing.length
      ? "All nine basic elements are covered. An ethics committee may still require more."
      : missing.length > 3
        ? `${have} of ${items.length} basic elements covered. Tick what your draft already says.`
        : `${have} of ${items.length} covered. Missing: ${missing.map((cb) => label(cb).toLowerCase()).join("; ")}.`;
  };
  items.forEach((cb) => cb.addEventListener("change", update));
  const copy = root.querySelector('[data-action="copy"]');
  copy.addEventListener("click", async () => {
    const md = [`# Consent form: ${title.value.trim() || "Untitled study"}`, "", "## Key information", "", "_A concise summary of the most important points comes first._", ""];
    for (const cb of items) md.push(`## ${label(cb)}`, "", cb.checked ? "_Write this section._" : "**TODO: missing**", "");
    try {
      await navigator.clipboard.writeText(md.join("\n"));
      copy.querySelector("[data-label]").textContent = "Copied";
    } catch {
      copy.querySelector("[data-label]").textContent = "Copy failed";
    }
    setTimeout(() => (copy.querySelector("[data-label]").textContent = "Copy outline as Markdown"), 1600);
  });
  update();
}
