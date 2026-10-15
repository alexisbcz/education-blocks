// HCI & UX research blocks, part 2: the statistics of usability studies
// and experiments. Problem discovery, small-sample task metrics, A/B test
// planning and analysis, the peeking simulation and card sorting. All data
// is either typed by the learner or generated here from a seeded PRNG.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";
import { outs, mean, rng, gauss, probit, phi, t975, pct } from "./hci-util.js";

const toggles = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));

// ============================================================ Problem discovery

for (const root of document.querySelectorAll("[data-hci-found]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let het = false;
  const f = scrubAll(root, () => draw());
  toggles(root, (_, on) => { het = on; draw(); });

  const equal = (p, n) => 1 - (1 - p) ** n;
  // Unequal problems: each problem's p ~ Beta(2p, 2(1 − p)), mean p.
  // E[(1 − p)ⁿ] = Πₖ (β + k)/(α + β + k), exactly.
  const unequal = (p, n) => {
    const a = 2 * p, b = 2 * (1 - p);
    let m = 1;
    for (let k = 0; k < n; k++) m *= (b + k) / (a + b + k);
    return 1 - m;
  };
  const usersFor = (fn, p, target) => {
    for (let n = 1; n <= 500; n++) if (fn(p, n) >= target) return String(n);
    return "> 500";
  };

  function draw() {
    const p = f.p.get(), n = f.n.get();
    svg.replaceChildren();
    const fr = frame(svg, { box: [44, 16, 456, 200], x: [0, 20], y: [0, 1], xticks: [0, 5, 10, 15, 20], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${v * 100}%`, xlabel: "users", ylabel: "problems found" });
    hline(svg, fr, 0.85, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3", "85 %");
    const curve = (fn) => Array.from({ length: 201 }, (_, i) => [fr.sx(i / 10), fr.sy(fn(p, i / 10))]);
    polyline(svg, curve(equal), "stroke:var(--brand);stroke-width:2");
    if (het) polyline(svg, curve(unequal), "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:5 3");
    el("line", { x1: fr.sx(n), x2: fr.sx(n), y1: fr.sy(0), y2: fr.sy(1), style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (let k = 1; k <= 20; k++) el("circle", { cx: fr.sx(k), cy: fr.sy(equal(p, k)), r: k === n ? 4.5 : 2, style: "fill:var(--brand)" }, svg);
    if (het) el("circle", { cx: fr.sx(n), cy: fr.sy(unequal(p, n)), r: 4.5, style: "fill:var(--vec-u)" }, svg);
    const lg = el("g", {}, svg);
    el("line", { x1: 330, x2: 348, y1: 168, y2: 168, style: "stroke:var(--brand);stroke-width:2" }, lg);
    text(lg, 352, 171, "every problem has p");
    if (het) {
      el("line", { x1: 330, x2: 348, y1: 184, y2: 184, style: "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:5 3" }, lg);
      text(lg, 352, 187, "p varies, same mean");
    }
    o.eq.textContent = pct(equal(p, n));
    o.het.textContent = het ? pct(unequal(p, n)) : "switch on";
    const fn = het ? unequal : equal;
    o.n85.textContent = usersFor(fn, p, 0.85);
    o.n95.textContent = usersFor(fn, p, 0.95);
  }
  draw();
}

// ============================================================ Time on task

for (const root of document.querySelectorAll("[data-hci-time]")) {
  const svg = root.querySelector("[data-plot]");
  const area = root.querySelector("[data-times]");
  const o = outs(root);
  const f = scrubAll(root, () => draw());

  function draw() {
    const ts = area.value.split(/[\s,;]+/).map((s) => parseFloat(s.replace(",", "."))).filter((v) => Number.isFinite(v) && v > 0);
    area.setAttribute("aria-invalid", String(ts.length < 2));
    svg.replaceChildren();
    // Completion: adjusted-Wald interval (Agresti & Coull 1998).
    const tn = f.tn.get(), x = Math.min(f.x.get(), tn), z = 1.959964;
    const na = tn + z * z, pa = (x + (z * z) / 2) / na, hw = z * Math.sqrt((pa * (1 - pa)) / na);
    o.rate.textContent = `${x} / ${tn} = ${pct(x / tn, 0)}`;
    o.rateci.textContent = `${pct(Math.max(0, pa - hw), 0)} to ${pct(Math.min(1, pa + hw), 0)}`;
    if (ts.length < 2) {
      for (const k of ["mean", "median", "geo", "geoci"]) o[k].textContent = "—";
      text(svg, 260, 110, "type at least two positive times", { "text-anchor": "middle" });
      return;
    }
    const n = ts.length, sorted = [...ts].sort((a, b) => a - b);
    const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const logs = ts.map(Math.log), ml = mean(logs);
    const sl = Math.sqrt(logs.reduce((s, v) => s + (v - ml) ** 2, 0) / (n - 1));
    const geo = Math.exp(ml), t = t975(n - 1);
    const lo = Math.exp(ml - (t * sl) / Math.sqrt(n)), hi = Math.exp(ml + (t * sl) / Math.sqrt(n));
    const am = mean(ts);
    o.mean.textContent = `${num(am, 1)} s`;
    o.median.textContent = `${num(med, 1)} s`;
    o.geo.textContent = `${num(geo, 1)} s`;
    o.geoci.textContent = `${num(lo, 1)} to ${num(hi, 1)} s`;

    const L = Math.log10;
    const x0 = Math.floor(L(Math.min(sorted[0], lo)) * 2) / 2 - 0.1, x1 = Math.ceil(L(Math.max(sorted[n - 1], hi)) * 2) / 2 + 0.1;
    const ticks = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter((v) => L(v) >= x0 && L(v) <= x1).map(L);
    const fr = frame(svg, { box: [20, 20, 484, 170], x: [x0, x1], y: [0, 1], xticks: ticks, xfmt: (v) => String(Math.round(10 ** v)), xlabel: "seconds (log scale)" });
    el("rect", { x: fr.sx(L(lo)), y: fr.sy(0.92), width: fr.sx(L(hi)) - fr.sx(L(lo)), height: fr.sy(0.08) - fr.sy(0.92), style: "fill:var(--brand);fill-opacity:0.1" }, svg);
    // Dots, stacked where they would overlap.
    const placed = [];
    for (const v of sorted) {
      const cx = fr.sx(L(v));
      let row = 0;
      while (placed.some((p) => p.row === row && Math.abs(p.cx - cx) < 9)) row++;
      placed.push({ cx, row });
      el("circle", { cx, cy: fr.sy(0.2) - row * 9, r: 3.6, style: "fill:currentColor;fill-opacity:0.55" }, svg);
    }
    const mark = (v, color, label, y) => {
      el("line", { x1: fr.sx(L(v)), x2: fr.sx(L(v)), y1: fr.sy(0.92), y2: fr.sy(0.08), style: `stroke:${color};stroke-width:2` }, svg);
      text(svg, fr.sx(L(v)) + 4, fr.sy(y), label, { fill: color, class: "font-mono text-[10px]", style: `fill:${color}` });
    };
    mark(med, "var(--vec-u)", `median ${num(med, 1)}`, 0.86);
    mark(geo, "var(--brand)", `geometric ${num(geo, 1)}`, 0.72);
    mark(am, "var(--vec-out)", `mean ${num(am, 1)}`, 0.58);
  }
  area.addEventListener("input", draw);
  draw();
}

// ============================================================ A/B test

for (const root of document.querySelectorAll("[data-hci-ab]")) {
  const o = outs(root);
  const pw = root.querySelector("[data-power]");
  const ciSvg = root.querySelector("[data-ci]");
  let alpha = 0.05, power = 0.8, planned = 0;
  const f = scrubAll(root, () => draw());
  root.addEventListener("seg-change", (e) => {
    const g = e.target.closest("[data-seg-group]")?.dataset.segGroup;
    if (g === "alpha") alpha = Number(e.detail.value);
    if (g === "power") power = Number(e.detail.value);
    draw();
  });

  function draw() {
    // Plan: n per arm for a two-sided two-proportion z-test.
    const p1 = f.p1.get() / 100, p2 = f.p2.get() / 100;
    const za = probit(1 - alpha / 2), zb = probit(power);
    const pbar = (p1 + p2) / 2, d = Math.abs(p2 - p1);
    const s0 = Math.sqrt(2 * pbar * (1 - pbar)), s1 = Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    pw.replaceChildren();
    if (d < 1e-9) {
      planned = Infinity;
      o.n.textContent = o.total.textContent = "∞";
      o.lift.textContent = "no difference to detect";
    } else {
      planned = Math.ceil(((za * s0 + zb * s1) / d) ** 2);
      o.n.textContent = planned.toLocaleString("en-US");
      o.total.textContent = (2 * planned).toLocaleString("en-US");
      o.lift.textContent = `${p2 > p1 ? "+" : "−"}${num((100 * d) / p1, 1)} %`;
      const pow = (n) => phi((d * Math.sqrt(n) - za * s0) / s1);
      const nmax = planned * 2.5;
      const fr = frame(pw, { box: [44, 14, 360, 120], x: [0, nmax], y: [0, 1], xticks: [0, nmax / 2, nmax].map(Math.round), yticks: [0, 0.5, power, 1], yfmt: (v) => v.toFixed(2), xfmt: (v) => v.toLocaleString("en-US"), xlabel: "visitors per arm", ylabel: "power" });
      polyline(pw, Array.from({ length: 121 }, (_, i) => [fr.sx((nmax * i) / 120), fr.sy(Math.max(0, pow((nmax * i) / 120)))]), "stroke:var(--brand);stroke-width:2");
      el("line", { x1: fr.sx(planned), x2: fr.sx(planned), y1: fr.sy(0), y2: fr.sy(power), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, pw);
      el("circle", { cx: fr.sx(planned), cy: fr.sy(power), r: 4, style: "fill:var(--brand)" }, pw);
    }

    // Analyse: pooled z-test, unpooled Wald interval.
    const na = f.na.get(), nb = f.nb.get();
    const xa = Math.min(f.xa.get(), na), xb = Math.min(f.xb.get(), nb);
    const ra = xa / na, rb = xb / nb, diff = rb - ra;
    const pp = (xa + xb) / (na + nb);
    const se0 = Math.sqrt(pp * (1 - pp) * (1 / na + 1 / nb));
    const se = Math.sqrt((ra * (1 - ra)) / na + (rb * (1 - rb)) / nb);
    const zz = se0 ? diff / se0 : 0, p = 2 * (1 - phi(Math.abs(zz)));
    const lo = diff - 1.959964 * se, hi = diff + 1.959964 * se;
    o.rates.textContent = `A ${pct(ra, 2)} · B ${pct(rb, 2)}`;
    o.diff.textContent = `${diff >= 0 ? "+" : "−"}${num(Math.abs(diff) * 100, 2)} pts`;
    o.ci.textContent = `${num(lo * 100, 2)} to ${num(hi * 100, 2)} pts`;
    o.z.textContent = num(zz, 2);
    o.p.textContent = p < 0.0001 ? "< 0.0001" : p.toFixed(4);

    ciSvg.replaceChildren();
    const span = Math.max(Math.abs(lo), Math.abs(hi), 0.005) * 1.3;
    const fr = frame(ciSvg, { box: [20, 10, 380, 60], x: [-span, span], y: [0, 1], xticks: [-span, -span / 2, 0, span / 2, span].map((v) => +v.toFixed(4)), xfmt: (v) => `${num(v * 100, 1)}`, xlabel: "B − A, percentage points" });
    el("line", { x1: fr.sx(0), x2: fr.sx(0), y1: fr.sy(0), y2: fr.sy(1), style: "stroke:currentColor;stroke-opacity:0.5" }, ciSvg);
    const excl = lo > 0 || hi < 0;
    const col = excl ? "var(--brand)" : "currentColor";
    el("line", { x1: fr.sx(lo), x2: fr.sx(hi), y1: fr.sy(0.5), y2: fr.sy(0.5), style: `stroke:${col};stroke-width:3;stroke-linecap:round` }, ciSvg);
    el("circle", { cx: fr.sx(diff), cy: fr.sy(0.5), r: 5, style: `fill:${col};stroke:var(--background);stroke-width:2` }, ciSvg);

    const verdict = root.querySelector("[data-out=verdict]");
    const small = Number.isFinite(planned) && Math.min(na, nb) < planned;
    verdict.textContent = (excl
      ? `The interval excludes zero: at α = 0.05 the difference is significant, and B is plausibly ${num(lo * 100, 2)} to ${num(hi * 100, 2)} points ${diff > 0 ? "better" : "worse"} than A.`
      : "The interval includes zero: these data cannot tell A and B apart. That is not evidence that they are equal.")
      + (small ? ` Each arm has fewer visitors than the plan's ${planned.toLocaleString("en-US")}, so a real lift of that size could easily be missed.` : "");
  }
  draw();
}

// ============================================================ Peeking

for (const root of document.querySelectorAll("[data-hci-peek]")) {
  const rateSvg = root.querySelector("[data-rate]");
  const pathSvg = root.querySelector("[data-path]");
  const o = outs(root);
  const f = scrubAll(root, () => { run(); one(); });
  const LOOKS = 100, KS = [1, 2, 4, 5, 10, 20, 25, 50, 100];
  let job = 0, seed = 1;

  // |z| of a pooled two-proportion test with equal arms of size n.
  const zOf = (ca, cb, n) => {
    const pp = (ca + cb) / (2 * n);
    return pp > 0 && pp < 1 ? Math.abs(ca - cb) / n / Math.sqrt((pp * (1 - pp) * 2) / n) : 0;
  };
  const Z = 1.959964;
  // Conversions among m visitors: exact Bernoulli sum.
  const binom = (rand, m, q) => { let c = 0; for (let i = 0; i < m; i++) if (rand() < q) c++; return c; };

  const drawRate = (fp, done, R) => {
    rateSvg.replaceChildren();
    const L = Math.log10;
    const fr = frame(rateSvg, { box: [44, 16, 356, 170], x: [0, 2], y: [0, 0.5], xticks: [0, L(2), L(5), 1, L(20), L(50), 2], xfmt: (v) => String(Math.round(10 ** v)), yticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "looks at the data", ylabel: "A/A tests called significant" });
    hline(rateSvg, fr, 0.05, "stroke:currentColor;stroke-opacity:0.45;stroke-dasharray:3 3", "α = 5 %");
    if (!fp) return;
    const pts = KS.map((k, i) => [fr.sx(L(k)), fr.sy(fp[i] / Math.max(1, done))]);
    polyline(rateSvg, pts, "stroke:var(--brand);stroke-width:2");
    for (const p of pts) el("circle", { cx: p[0], cy: p[1], r: 3.5, style: "fill:var(--brand)" }, rateSvg);
    text(rateSvg, 398, 30, done < R ? `${done} / ${R} tests…` : `${R} tests`, { "text-anchor": "end" });
  };

  function run() {
    const my = ++job;
    const R = f.runs.get(), N = f.n.get(), q = f.rate.get() / 100, m = N / LOOKS;
    const rand = rng(1000 + seed++);
    const fp = KS.map(() => 0);
    let done = 0;
    const sig = new Uint8Array(LOOKS);
    const step = () => {
      if (my !== job) return;
      const until = Math.min(R, done + Math.max(20, Math.floor(400000 / (N * 2))));
      for (; done < until; done++) {
        let ca = 0, cb = 0;
        for (let j = 0; j < LOOKS; j++) {
          ca += binom(rand, m, q);
          cb += binom(rand, m, q);
          sig[j] = zOf(ca, cb, m * (j + 1)) > Z ? 1 : 0;
        }
        KS.forEach((k, i) => {
          const every = LOOKS / k;
          for (let j = every - 1; j < LOOKS; j += every) if (sig[j]) { fp[i]++; break; }
        });
      }
      drawRate(fp, done, R);
      const at = (k) => pct(fp[KS.indexOf(k)] / done, 1);
      o.k1.textContent = at(1);
      o.k5.textContent = at(5);
      o.k20.textContent = at(20);
      o.k100.textContent = at(100);
      if (done < R) setTimeout(step, 0);
    };
    step();
  }

  function one() {
    const N = f.n.get(), q = f.rate.get() / 100;
    const rand = rng((Date.now() & 0xffff) + 7);
    const STEP = Math.max(10, N / 200);
    const pts = [];
    let ca = 0, cb = 0, first = null;
    for (let n = STEP; n <= N; n += STEP) {
      ca += binom(rand, STEP, q);
      cb += binom(rand, STEP, q);
      const p = 2 * (1 - phi(zOf(ca, cb, n)));
      pts.push([n, p]);
      if (first === null && p < 0.05) first = [n, p];
    }
    pathSvg.replaceChildren();
    const fr = frame(pathSvg, { box: [44, 16, 356, 170], x: [0, N], y: [0, 1], xticks: [0, N / 2, N], yticks: [0.05, 0.25, 0.5, 0.75, 1], yfmt: (v) => v.toFixed(2), xfmt: (v) => v.toLocaleString("en-US"), xlabel: "visitors per arm", ylabel: "p-value, one A/A test" });
    el("rect", { x: fr.sx(0), y: fr.sy(0.05), width: fr.W, height: fr.sy(0) - fr.sy(0.05), style: "fill:var(--code-del);fill-opacity:0.12" }, pathSvg);
    polyline(pathSvg, pts.map(([n, p]) => [fr.sx(n), fr.sy(p)]), "stroke:currentColor;stroke-opacity:0.7;stroke-width:1.5");
    if (first) {
      el("circle", { cx: fr.sx(first[0]), cy: fr.sy(first[1]), r: 4.5, style: "fill:var(--code-del)" }, pathSvg);
      const px = fr.sx(first[0]), right = px < 250;
      text(pathSvg, right ? px + 8 : px - 8, fr.sy(0.05) - 8, `a peeker stops here: n = ${first[0].toLocaleString("en-US")}`, { "text-anchor": right ? "start" : "end" });
    } else text(pathSvg, 398, 30, "this test never crossed 0.05", { "text-anchor": "end" });
  }

  root.querySelector("[data-action=run]").addEventListener("click", run);
  root.querySelector("[data-action=one]").addEventListener("click", one);
  drawRate(null, 0, 0);
  one();
  // Start the simulation when the block first comes into view.
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
  });
  io.observe(root);
}

// ============================================================ Card sorting

for (const root of document.querySelectorAll("[data-hci-sort]")) {
  const o = outs(root);
  const cardsBox = root.querySelector("[data-cards]");
  const groupsBox = root.querySelector("[data-groups]");
  const matrix = root.querySelector("[data-matrix]");
  const tree = root.querySelector("[data-tree]");
  const f = scrubAll(root, () => draw());
  let withMe = false;
  toggles(root, (_, on) => { withMe = on; draw(); });

  // Twelve cards of a learning platform and how likely a synthetic
  // participant is to file each one under Learn, Progress, Account or
  // Community. Some cards are deliberately ambiguous.
  const CARDS = [
    ["Lessons", [0.92, 0.03, 0.02, 0.03]], ["Exercises", [0.85, 0.1, 0, 0.05]], ["Quizzes", [0.62, 0.33, 0, 0.05]],
    ["Progress", [0.08, 0.88, 0.04, 0]], ["Streaks", [0.05, 0.8, 0.05, 0.1]], ["Certificates", [0.15, 0.6, 0.25, 0]],
    ["Profile", [0, 0.05, 0.9, 0.05]], ["Billing", [0, 0, 0.97, 0.03]], ["Notifications", [0.02, 0.08, 0.65, 0.25]],
    ["Forums", [0.03, 0, 0.02, 0.95]], ["Study groups", [0.2, 0.05, 0, 0.75]], ["Help center", [0.05, 0, 0.45, 0.5]],
  ];
  const N = CARDS.length, P = 30;
  const rand = rng(42);
  const people = Array.from({ length: P }, () => CARDS.map(([, pr]) => {
    let u = rand(), g = 0;
    while (g < 3 && u >= pr[g]) u -= pr[g++];
    return g;
  }));
  const mine = Array(N).fill(-1);

  // The learner's sort: one select per card.
  for (const [i, [name]] of CARDS.entries()) {
    const lab = document.createElement("label");
    lab.className = "flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm";
    const s = document.createElement("span");
    s.textContent = name;
    const sel = document.createElement("select");
    sel.className = "h-7 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
    sel.setAttribute("aria-label", `Group for ${name}`);
    sel.dataset.card = String(i);
    for (const [v, t] of [["-1", "—"], ["0", "Group 1"], ["1", "Group 2"], ["2", "Group 3"], ["3", "Group 4"]]) sel.add(new Option(t, v));
    sel.addEventListener("change", () => { mine[i] = Number(sel.value); draw(); });
    lab.append(s, sel);
    cardsBox.append(lab);
  }
  root.querySelector("[data-action=reset]").addEventListener("click", () => {
    mine.fill(-1);
    for (const sel of cardsBox.querySelectorAll("select")) sel.value = "-1";
    draw();
  });

  const sims = (rows) => {
    const S = Array.from({ length: N }, () => Array(N).fill(0));
    for (const r of rows) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (r[i] >= 0 && r[i] === r[j]) S[i][j]++;
    return S.map((row, i) => row.map((v, j) => (i === j ? 1 : v / rows.length)));
  };

  // Average-linkage (UPGMA) clustering on similarity; returns the tree.
  const cluster = (S) => {
    let nodes = CARDS.map((_, i) => ({ leaves: [i], h: 1, id: i }));
    while (nodes.length > 1) {
      let best = null;
      for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
        let s = 0;
        for (const i of nodes[a].leaves) for (const j of nodes[b].leaves) s += S[i][j];
        s /= nodes[a].leaves.length * nodes[b].leaves.length;
        if (!best || s > best.s) best = { a, b, s };
      }
      const A = nodes[best.a], B = nodes[best.b];
      const m = { leaves: [...A.leaves, ...B.leaves], h: best.s, l: A, r: B };
      nodes = nodes.filter((_, k) => k !== best.a && k !== best.b).concat(m);
    }
    return nodes[0];
  };

  function draw() {
    const cut = f.cut.get() / 100;
    // Groups panel for the learner's sort.
    groupsBox.replaceChildren();
    for (let g = 0; g < 4; g++) {
      const box = document.createElement("div");
      box.className = "flex min-h-16 flex-col gap-1.5 rounded-lg border border-dashed p-2";
      const h = document.createElement("span");
      h.className = "font-mono text-[11px] tracking-wider text-muted-foreground uppercase";
      h.textContent = `Group ${g + 1}`;
      const list = document.createElement("div");
      list.className = "flex flex-wrap gap-1";
      for (const [i, [name]] of CARDS.entries()) if (mine[i] === g) {
        const c = document.createElement("span");
        c.className = "rounded-md border border-brand/50 bg-brand/10 px-1.5 py-0.5 text-xs";
        c.textContent = name;
        list.append(c);
      }
      box.append(h, list);
      groupsBox.append(box);
    }

    const sorted = mine.filter((g) => g >= 0).length;
    const rows = withMe && sorted ? [...people, mine] : people;
    const S = sims(rows), base = sims(people);
    const root0 = cluster(S);
    const order = root0.leaves;

    // Similarity matrix, rows and columns in dendrogram order.
    matrix.replaceChildren();
    const M0 = 92, cell = (420 - M0 - 30) / N;
    for (const [r, i] of order.entries()) {
      text(matrix, M0 - 4, M0 + r * cell + cell / 2 + 3, CARDS[i][0], { "text-anchor": "end" });
      const tx = M0 + r * cell + cell / 2;
      text(matrix, tx, M0 - 4, CARDS[i][0], { transform: `rotate(-55 ${tx} ${M0 - 4})` });
      for (const [c, j] of order.entries()) {
        const v = S[i][j];
        el("rect", { x: M0 + c * cell + 0.5, y: M0 + r * cell + 0.5, width: cell - 1, height: cell - 1, rx: 2, style: `fill:${i === j ? "currentColor" : "var(--brand)"};fill-opacity:${i === j ? 0.08 : (0.06 + 0.94 * v).toFixed(3)}` }, matrix);
        if (i !== j && v >= 0.1) text(matrix, M0 + c * cell + cell / 2, M0 + r * cell + cell / 2 + 3, String(Math.round(v * 100)), { "text-anchor": "middle", class: `font-mono text-[8px] ${v > 0.55 ? "fill-white" : "fill-muted-foreground"}` });
      }
    }

    // Dendrogram: leaves on the left, similarity from 100 % to 0 % rightward.
    tree.replaceChildren();
    const TL = 100, TW = 300, TT = 14, row = (330 - TT) / N;
    const xs = (s) => TL + (1 - s) * TW;
    for (const t of [1, 0.75, 0.5, 0.25, 0]) {
      el("line", { x1: xs(t), x2: xs(t), y1: TT - 4, y2: 336, style: "stroke:currentColor;stroke-opacity:0.07" }, tree);
      text(tree, xs(t), 350, `${Math.round(t * 100)}%`, { "text-anchor": "middle" });
    }
    const ypos = new Map(order.map((i, r) => [i, TT + r * row + row / 2]));
    const place = (n) => {
      if (!n.l) return { x: xs(1), y: ypos.get(n.id) };
      const a = place(n.l), b = place(n.r), x = xs(n.h);
      const style = `stroke:${n.h >= cut ? "var(--brand)" : "currentColor"};stroke-opacity:${n.h >= cut ? 1 : 0.5};stroke-width:1.5;fill:none`;
      el("path", { d: `M${a.x},${a.y}H${x}V${b.y}H${b.x}`, style }, tree);
      return { x, y: (a.y + b.y) / 2 };
    };
    place(root0);
    for (const [r, i] of order.entries()) text(tree, TL - 6, TT + r * row + row / 2 + 3, CARDS[i][0], { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    el("line", { x1: xs(cut), x2: xs(cut), y1: TT - 6, y2: 336, style: "stroke:var(--brand);stroke-dasharray:4 3" }, tree);

    let merges = 0;
    const count = (n) => { if (n.l) { if (n.h >= cut) merges++; count(n.l); count(n.r); } };
    count(root0);
    o.people.textContent = String(rows.length);
    o.k.textContent = String(N - merges);

    // Agreement: pairs where your same/different call matches the
    // majority of the synthetic participants.
    let agree = 0, pairs = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      if (mine[i] < 0 || mine[j] < 0) continue;
      pairs++;
      if ((mine[i] === mine[j]) === (base[i][j] >= 0.5)) agree++;
    }
    o.agree.textContent = pairs ? `${agree} / ${pairs} pairs (${Math.round((100 * agree) / pairs)} %)` : "sort some cards";
  }
  draw();
}
