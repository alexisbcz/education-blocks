// Probability blocks: events as areas, birthdays, Monty Hall, gambler's
// ruin, the law of large numbers, a Galton board, a Markov chain and dice
// sums. Exact results first; simulations (seeded) check them.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const plot = (root, name = "main") => root.querySelector(`[data-plot="${name}"]`);
const minus = (s) => String(s).replace(/-/g, "−");
const pct = (v, d = 1) => `${num(100 * v, d)}%`;
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playButton(btn) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
  };
}

// ============================================================ Area model

for (const root of document.querySelectorAll("[data-prob-area]")) {
  const svg = plot(root), o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=independent]").addEventListener("click", () => { s.pbna.set(s.pba.get(), false); draw(); });

  function draw() {
    const pa = s.pa.get(), pba = s.pba.get(), pbna = s.pbna.get();
    const and = pa * pba, pb = and + (1 - pa) * pbna, or = pa + pb - and;
    svg.replaceChildren();
    const X = 40, Y = 20, S = 290;
    const xa = X + pa * S;
    // Columns: A and not A. Inside each, B fills a share from the bottom.
    el("rect", { x: X, y: Y, width: S, height: S, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.4" }, svg);
    el("rect", { x: X, y: Y, width: xa - X, height: S, style: "fill:var(--vec-u);fill-opacity:0.10" }, svg);
    el("rect", { x: X, y: Y + S * (1 - pba), width: xa - X, height: S * pba, style: "fill:var(--brand);fill-opacity:0.45" }, svg);
    el("rect", { x: xa, y: Y + S * (1 - pbna), width: X + S - xa, height: S * pbna, style: "fill:var(--brand);fill-opacity:0.22" }, svg);
    el("line", { x1: xa, x2: xa, y1: Y, y2: Y + S, style: "stroke:var(--vec-u);stroke-width:2" }, svg);
    const label = (x, y, w, h, s1, s2) => {
      if (w < 34 || h < 26) return;
      text(svg, x + w / 2, y + h / 2 - 2, s1, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      text(svg, x + w / 2, y + h / 2 + 11, s2, { "text-anchor": "middle" });
    };
    label(X, Y + S * (1 - pba), xa - X, S * pba, "A∩B", num(and, 3));
    label(X, Y, xa - X, S * (1 - pba), "A∩Bᶜ", num(pa * (1 - pba), 3));
    label(xa, Y + S * (1 - pbna), X + S - xa, S * pbna, "Aᶜ∩B", num((1 - pa) * pbna, 3));
    label(xa, Y, X + S - xa, S * (1 - pbna), "Aᶜ∩Bᶜ", num((1 - pa) * (1 - pbna), 3));
    text(svg, X + (xa - X) / 2, Y + S + 16, "A", { "text-anchor": "middle", style: "fill:var(--vec-u)" });
    text(svg, xa + (X + S - xa) / 2, Y + S + 16, "not A", { "text-anchor": "middle" });
    // The addition rule as bars on the right.
    const bx = 370, bw = 130, rows = [["P(A)", pa, "var(--vec-u)"], ["P(B)", pb, "var(--brand)"], ["P(A∩B)", and, "var(--brand)"], ["P(A∪B)", or, "var(--foreground)"]];
    rows.forEach(([name, v, c], i) => {
      const y = Y + 30 + i * 52;
      text(svg, bx, y, name, { class: "fill-foreground font-mono text-[11px]" });
      el("rect", { x: bx, y: y + 6, width: bw, height: 10, rx: 3, style: "fill:currentColor;fill-opacity:0.07" }, svg);
      el("rect", { x: bx, y: y + 6, width: bw * v, height: 10, rx: 3, style: `fill:${c};fill-opacity:0.6` }, svg);
      text(svg, bx + bw, y, num(v, 3), { "text-anchor": "end" });
    });
    text(svg, bx, Y + 236, "P(A∪B) = P(A) + P(B)");
    text(svg, bx, Y + 250, "            − P(A∩B)");
    o.and.textContent = num(and, 4);
    o.pb.textContent = num(pb, 4);
    o.or.textContent = num(or, 4);
    o.bayes.textContent = pb > 0 ? num(and / pb, 4) : "undefined";
    const indep = Math.abs(pba - pbna) < 1e-9;
    o.indep.textContent = indep ? "yes: P(B|A) = P(B)" : "no: P(B|A) ≠ P(B|not A)";
    o.indep.className = "tabular-nums " + (indep ? "text-add" : "");
  }
  draw();
}

// ============================================================ Birthday

const birthday = (n) => { let q = 1; for (let k = 0; k < n; k++) q *= (365 - k) / 365; return 1 - q; };

for (const root of document.querySelectorAll("[data-prob-birthday]")) {
  const svg = plot(root), o = outs(root);
  let seed = 1, sim = null;
  const s = scrubAll(root, () => { sim = null; draw(); });
  root.querySelector("[data-action=simulate]").addEventListener("click", () => {
    const n = Math.round(s.n.get()), rng = mulberry32(seed++ * 7919);
    let hits = 0;
    const seen = new Uint16Array(365);
    for (let t = 1; t <= 2000; t++) {
      let dup = false;
      for (let k = 0; k < n && !dup; k++) {
        const d = Math.floor(rng() * 365);
        if (seen[d] === t) dup = true;
        seen[d] = t;
      }
      if (dup) hits++;
    }
    sim = { n, p: hits / 2000 };
    draw();
  });

  function draw() {
    const n = Math.round(s.n.get());
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 270], x: [0, 80], y: [0, 1], xticks: [0, 10, 20, 23, 30, 40, 50, 60, 70, 80], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${v * 100}%`, xlabel: "people in the room", ylabel: "P(at least one shared birthday)" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0.5), y2: f.sy(0.5), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4" }, svg);
    polyline(svg, Array.from({ length: 81 }, (_, k) => [f.sx(k), f.sy(birthday(k))]), "stroke:var(--foreground);stroke-width:2");
    el("line", { x1: f.sx(n), x2: f.sx(n), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(n), cy: f.sy(birthday(n)), r: 4.5, style: "fill:var(--brand)" }, svg);
    if (sim && sim.n === n) el("rect", { x: f.sx(n) - 4, y: f.sy(sim.p) - 4, width: 8, height: 8, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
    o.exact.textContent = pct(birthday(n), 2);
    o.sim.textContent = sim && sim.n === n ? `${pct(sim.p, 1)} (2,000 groups)` : "—";
    o.pairs.textContent = String((n * (n - 1)) / 2);
  }
  draw();
}

// ============================================================ Monty Hall

for (const root of document.querySelectorAll("[data-prob-monty]")) {
  const svg = plot(root), o = outs(root);
  const doors = [...root.querySelectorAll("[data-door]")];
  const btn = (a) => root.querySelector(`[data-action=${a}]`);
  const rng = mulberry32(2024);
  const tally = { stay: [0, 0], switch: [0, 0] };
  let car, pick, opened, phase;

  function newRound() {
    car = Math.floor(rng() * 3); pick = null; opened = null; phase = "pick";
    doors.forEach((d) => { d.disabled = false; delete d.dataset.picked; delete d.dataset.open; d.querySelector("[data-content]").textContent = "?"; });
    o.prompt.textContent = "Pick a door.";
    btn("stay").disabled = btn("switch").disabled = true;
  }
  const show = (i) => { doors[i].dataset.open = ""; doors[i].querySelector("[data-content]").textContent = i === car ? "Car" : "Goat"; };

  doors.forEach((d, i) => d.addEventListener("click", () => {
    if (phase !== "pick") return;
    pick = i;
    d.dataset.picked = "";
    // The host opens a goat door other than yours, at random if he can choose.
    const options = [0, 1, 2].filter((k) => k !== pick && k !== car);
    opened = options[Math.floor(rng() * options.length)];
    show(opened);
    phase = "decide";
    doors.forEach((x) => (x.disabled = true));
    btn("stay").disabled = btn("switch").disabled = false;
    o.prompt.textContent = `The host opens door ${opened + 1}: a goat. Stay with door ${pick + 1}, or switch?`;
  }));
  for (const choice of ["stay", "switch"]) {
    btn(choice).addEventListener("click", () => {
      if (phase !== "decide") return;
      const final = choice === "stay" ? pick : [0, 1, 2].find((k) => k !== pick && k !== opened);
      [0, 1, 2].forEach(show);
      delete doors[pick].dataset.picked;
      doors[final].dataset.picked = "";
      const won = final === car;
      tally[choice][0] += won; tally[choice][1]++;
      o.prompt.textContent = won ? `You ${choice === "stay" ? "stayed" : "switched"} and won the car.` : `You ${choice === "stay" ? "stayed" : "switched"} and got a goat.`;
      o.stay.textContent = `${tally.stay[0]} / ${tally.stay[1]}`;
      o.switch.textContent = `${tally.switch[0]} / ${tally.switch[1]}`;
      phase = "done";
      btn("stay").disabled = btn("switch").disabled = true;
    });
  }
  btn("again").addEventListener("click", newRound);

  btn("simulate").addEventListener("click", () => {
    const r = mulberry32(99), N = 1000, runs = { stay: [], switch: [] };
    let ws = 0, wsw = 0;
    for (let t = 1; t <= N; t++) {
      const c = Math.floor(r() * 3), p = Math.floor(r() * 3);
      if (p === c) ws++; else wsw++; // switching wins exactly when the first pick was wrong
      runs.stay.push(ws / t); runs.switch.push(wsw / t);
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 10, 500, 128], x: [1, N], y: [0, 1], xticks: [1, 250, 500, 750, 1000], yticks: [0, 1 / 3, 2 / 3, 1], yfmt: (v) => (v === 0 ? "0" : v === 1 ? "1" : v < 0.5 ? "1/3" : "2/3"), xlabel: "rounds", ylabel: "win rate" });
    for (const v of [1 / 3, 2 / 3]) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(v), y2: f.sy(v), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4" }, svg);
    polyline(svg, runs.switch.map((v, i) => [f.sx(i + 1), f.sy(v)]), "stroke:var(--brand);stroke-width:1.75");
    polyline(svg, runs.stay.map((v, i) => [f.sx(i + 1), f.sy(v)]), "stroke:var(--vec-u);stroke-width:1.75");
    text(svg, f.L + f.W, f.sy(runs.switch.at(-1)) - 6, "switch", { "text-anchor": "end", style: "fill:var(--brand)" });
    text(svg, f.L + f.W, f.sy(runs.stay.at(-1)) - 6, "stay", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    o.simstay.textContent = pct(ws / N);
    o.simswitch.textContent = pct(wsw / N);
  });
  o.exactmh.textContent = "stay 1/3 · switch 2/3";
  // An empty chart until the first simulation.
  const f0 = frame(svg, { box: [44, 10, 500, 128], x: [1, 1000], y: [0, 1], xticks: [1, 250, 500, 750, 1000], yticks: [0, 1 / 3, 2 / 3, 1], yfmt: (v) => (v === 0 ? "0" : v === 1 ? "1" : v < 0.5 ? "1/3" : "2/3"), xlabel: "rounds", ylabel: "win rate" });
  text(svg, f0.L + f0.W / 2, f0.T + f0.H / 2, "Simulate to plot both strategies", { "text-anchor": "middle" });
  newRound();
}

// ============================================================ Gambler's ruin

// Ruin probability and expected duration, starting at i, absorbing at 0, N.
function ruin(i, N, p) {
  const q = 1 - p;
  if (Math.abs(p - 0.5) < 1e-12) return { ruin: 1 - i / N, dur: i * (N - i) };
  const r = q / p;
  const ruinP = (r ** i - r ** N) / (1 - r ** N);
  const dur = i / (q - p) - (N / (q - p)) * ((1 - r ** i) / (1 - r ** N));
  return { ruin: ruinP, dur };
}

for (const root of document.querySelectorAll("[data-prob-ruin]")) {
  const svg = plot(root), o = outs(root);
  let seed = 3;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const N = Math.round(s.N.get()), i = Math.min(Math.round(s.i.get()), N - 1), p = s.p.get();
    const rng = mulberry32(seed * 131 + N * 7 + i);
    const walks = [];
    for (let w = 0; w < 20; w++) {
      const path = [i];
      let x = i;
      while (x > 0 && x < N && path.length < 20000) { x += rng() < p ? 1 : -1; path.push(x); }
      walks.push(path);
    }
    const longest = Math.max(...walks.map((w) => w.length));
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 270], x: [0, longest], y: [0, N], xticks: [0, Math.round(longest / 2), longest], yticks: [0, i, N], xlabel: "bets", ylabel: "chips" });
    for (const [y, c] of [[0, "var(--code-del)"], [N, "var(--code-add)"]]) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(y), y2: f.sy(y), style: `stroke:${c};stroke-width:2` }, svg);
    let ruined = 0;
    for (const w of walks) {
      const lost = w.at(-1) === 0;
      ruined += lost;
      // Thin long paths so the polyline stays light.
      const stepK = Math.max(1, Math.floor(w.length / 600));
      const pts = w.filter((_, k) => k % stepK === 0 || k === w.length - 1).map((y, k, arr) => [f.sx(k === arr.length - 1 ? w.length - 1 : k * stepK), f.sy(y)]);
      polyline(svg, pts, `stroke:${lost ? "var(--code-del)" : "var(--brand)"};stroke-opacity:0.55;stroke-width:1.1`);
    }
    const ex = ruin(i, N, p);
    o.ruin.textContent = pct(ex.ruin, 1);
    o.simruin.textContent = `${ruined} of 20`;
    o.dur.textContent = `${num(ex.dur, 1)} bets`;
  }
  draw();
}

// ============================================================ Law of large numbers

for (const root of document.querySelectorAll("[data-prob-lln]")) {
  const svg = plot(root), o = outs(root);
  let kind = "coin", seed = 5;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { kind = v; draw(); });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const p = s.pc.get();
    const mu = kind === "coin" ? p : 3.5, sd = kind === "coin" ? Math.sqrt(p * (1 - p)) : Math.sqrt(35 / 12);
    const draw1 = (rng) => (kind === "coin" ? (rng() < p ? 1 : 0) : 1 + Math.floor(rng() * 6));
    const N = 10000;
    const lo = kind === "coin" ? 0 : 1, hi = kind === "coin" ? 1 : 6;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 270], x: [0, 4], y: [lo, hi], xticks: [0, 1, 2, 3, 4], yticks: kind === "coin" ? [0, 0.25, 0.5, 0.75, 1] : [1, 2, 3, 3.5, 4, 5, 6], xfmt: (t) => String(10 ** t), xlabel: "n (log scale)", ylabel: "running average" });
    // ±2σ/√n band around the expected value.
    let band = "";
    const xs = Array.from({ length: 121 }, (_, k) => (4 * k) / 120);
    xs.forEach((t, k) => { const w = (2 * sd) / Math.sqrt(10 ** t); band += `${k ? "L" : "M"}${f.sx(t)} ${f.sy(Math.min(hi, mu + w))}`; });
    [...xs].reverse().forEach((t) => { const w = (2 * sd) / Math.sqrt(10 ** t); band += `L${f.sx(t)} ${f.sy(Math.max(lo, mu - w))}`; });
    el("path", { d: band + "Z", style: "fill:var(--vec-u);fill-opacity:0.1" }, svg);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(mu), y2: f.sy(mu), style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4" }, svg);
    const colors = ["var(--brand)", "var(--foreground)", "var(--ion-k)", "var(--ion-cl)", "var(--vec-out)"];
    let first;
    for (let w = 0; w < 5; w++) {
      const rng = mulberry32(seed * 1000 + w);
      let sum = 0;
      const pts = [];
      const means = {};
      for (let n = 1; n <= N; n++) {
        sum += draw1(rng);
        if (n === 10 || n === N) means[n] = sum / n;
        // Sample log-spaced points for the polyline.
        if (n < 30 || n % Math.ceil(n / 40) === 0) pts.push([f.sx(Math.log10(n)), f.sy(sum / n)]);
      }
      if (!w) first = means;
      polyline(svg, pts, `stroke:${colors[w]};stroke-width:1.3;stroke-opacity:0.85`);
    }
    o.mu.textContent = num(mu, 3);
    o.m10.textContent = num(first[10], 3);
    o.m10k.textContent = num(first[N], 4);
  }
  draw();
}

// ============================================================ Galton board

const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

for (const root of document.querySelectorAll("[data-prob-galton]")) {
  const svg = plot(root), o = outs(root);
  const playBtn = root.querySelector("[data-action=play]"), setPlay = playButton(playBtn);
  const rng = mulberry32(17);
  let bins = [], balls = [], playing = false, raf = 0, visible = false, lastDrop = 0, last = 0;
  const s = scrubAll(root, () => { clear(); });

  const W = 520, cx = 260, top = 24, pegH = 220;
  const geom = () => {
    const R = Math.round(s.rows.get());
    const dx = Math.min(30, 440 / (R + 1)), dy = pegH / R;
    return { R, dx, dy };
  };
  function clear() { const { R } = geom(); bins = new Array(R + 1).fill(0); balls = []; render(); }

  function drop() {
    const { R } = geom(), p = s.p.get();
    const path = [];
    for (let r = 0; r < R; r++) path.push(rng() < p ? 1 : 0);
    balls.push({ path, t: 0 });
  }
  const binOf = (path) => path.reduce((a, b) => a + b, 0);

  function render() {
    const { R, dx, dy } = geom(), p = s.p.get();
    svg.replaceChildren();
    // Pegs.
    for (let r = 0; r < R; r++) for (let k = 0; k <= r; k++)
      el("circle", { cx: cx + (k - r / 2) * dx, cy: top + r * dy + dy / 2, r: 2.2, style: "fill:currentColor;fill-opacity:0.35" }, svg);
    // Bins and histogram.
    const n = bins.reduce((a, b) => a + b, 0);
    const expected = bins.map((_, k) => n * choose(R, k) * p ** k * (1 - p) ** (R - k));
    const yBase = 388, Hmax = 130;
    const peak = Math.max(1, ...bins, ...expected);
    const bx = (k) => cx + (k - R / 2) * dx;
    // Bin walls, so the empty board already shows where balls land.
    for (let k = 0; k <= R + 1; k++) el("line", { x1: bx(k) - dx / 2, x2: bx(k) - dx / 2, y1: yBase - Hmax - 6, y2: yBase, style: "stroke:currentColor;stroke-opacity:0.1" }, svg);
    bins.forEach((c, k) => {
      const hgt = (c / peak) * Hmax;
      el("rect", { x: bx(k) - dx / 2 + 1, y: yBase - hgt, width: dx - 2, height: hgt, rx: 1.5, style: "fill:var(--foreground);fill-opacity:0.18" }, svg);
    });
    el("line", { x1: 20, x2: W - 20, y1: yBase, y2: yBase, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    if (n > 0) {
      polyline(svg, expected.map((v, k) => [bx(k), yBase - (v / peak) * Hmax]), "stroke:var(--brand);stroke-width:1.5");
      expected.forEach((v, k) => el("circle", { cx: bx(k), cy: yBase - (v / peak) * Hmax, r: 2.5, style: "fill:var(--brand)" }, svg));
      // Normal approximation with the same mean and variance, scaled to counts.
      const mu = R * p, sd = Math.sqrt(R * p * (1 - p));
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const k = -0.5 + ((R + 1) * i) / 160;
        const dens = (n / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-((k - mu) ** 2) / (2 * sd * sd));
        pts.push([cx + (k - R / 2) * dx, yBase - (dens / peak) * Hmax]);
      }
      polyline(svg, pts, "stroke:var(--vec-u);stroke-width:1.25;stroke-dasharray:4 3");
    }
    // Balls in flight.
    for (const b of balls) {
      const r = Math.floor(b.t), frac = b.t - r;
      const right = b.path.slice(0, r).reduce((a, c) => a + c, 0);
      const x0 = cx + (right - r / 2) * dx;
      const x1 = r < R ? cx + (right + b.path[r] - (r + 1) / 2) * dx : x0;
      const y = top + Math.min(R, b.t) * dy + dy / 2 - Math.sin(Math.PI * frac) * dy * 0.25;
      el("circle", { cx: x0 + (x1 - x0) * frac, cy: y, r: 3.2, style: "fill:var(--brand)" }, svg);
    }
    o.n.textContent = String(n);
    o.mean.textContent = n ? num(bins.reduce((a, c, k) => a + c * k, 0) / n, 3) : "—";
    o.expect.textContent = `${num(R * p, 3)} (= rows × p)`;
  }

  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing && now - lastDrop > 70) { drop(); lastDrop = now; }
    const { R } = geom();
    for (const b of balls) b.t += dt * 14;
    const landed = balls.filter((b) => b.t >= R);
    for (const b of landed) bins[binOf(b.path)]++;
    balls = balls.filter((b) => b.t < R);
    render();
    raf = visible && (playing || balls.length) ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const setPlaying = (p) => { playing = p; setPlay(p); if (p) start(); };
  playBtn.addEventListener("click", () => {
    if (reduced()) { for (let k = 0; k < 100; k++) { drop(); bins[binOf(balls.pop().path)]++; } return render(); }
    setPlaying(!playing);
  });
  root.querySelector("[data-action=burst]").addEventListener("click", () => {
    for (let k = 0; k < 500; k++) { drop(); bins[binOf(balls.pop().path)]++; }
    render();
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { setPlaying(false); clear(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && (playing || balls.length)) start(); }).observe(root);
  clear();
}

// ============================================================ Markov chain

const STATES = [
  { name: "Sunny", sym: "☀", color: "var(--vec-out)" },
  { name: "Cloudy", sym: "☁", color: "var(--foreground)" },
  { name: "Rainy", sym: "☂", color: "var(--vec-u)" },
];

// Solves π P = π with Σπ = 1 by Gaussian elimination on (Pᵀ − I) with one
// row replaced by the normalisation.
function stationary(P) {
  const n = P.length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (j === n ? 0 : P[j][i] - (i === j ? 1 : 0))));
  A[n - 1] = Array.from({ length: n + 1 }, () => 1);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j]; }
  }
  return A.map((row, i) => row[n] / row[i]);
}

for (const root of document.querySelectorAll("[data-prob-markov]")) {
  const g = plot(root, "graph"), conv = plot(root, "conv"), o = outs(root);
  let startState = 0;
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { startState = Number(v); draw(); });

  const matrix = () => [0, 1, 2].map((i) => {
    const row = [0, 1, 2].map((j) => s[`p${i}${j}`].get());
    const sum = row.reduce((a, b) => a + b, 0);
    return sum > 0 ? row.map((v) => v / sum) : [1 / 3, 1 / 3, 1 / 3];
  });
  const fmtDist = (d) => d.map((v, i) => `${STATES[i].name[0]} ${num(v, 2)}`).join(" · ");

  function draw() {
    const P = matrix();
    // State diagram: three nodes, curved edges both ways, self-loops.
    g.replaceChildren();
    const pos = [[110, 92], [410, 92], [260, 172]];
    const defs = el("defs", {}, g);
    const mk = el("marker", { id: "prob-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0L10 5L0 10Z", style: "fill:currentColor;fill-opacity:0.6" }, mk);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const w = P[i][j];
      if (w < 0.005) continue;
      const [x1, y1] = pos[i], [x2, y2] = pos[j];
      if (i === j) {
        const up = i < 2 ? -1 : 1;
        el("path", { d: `M${x1 - 12} ${y1 + up * 20} C${x1 - 40} ${y1 + up * 70}, ${x1 + 40} ${y1 + up * 70}, ${x1 + 12} ${y1 + up * 20}`, "marker-end": "url(#prob-arrow)", style: `fill:none;stroke:currentColor;stroke-opacity:0.5;stroke-width:${0.75 + 3 * w}` }, g);
        text(g, x1, y1 + up * 66 + (up > 0 ? 10 : 0), num(w, 2), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
        continue;
      }
      // Offset each direction so the two arrows don't overlap.
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, off = 14;
      const sx = x1 + (dx / len) * 26 + nx * off, sy = y1 + (dy / len) * 26 + ny * off;
      const ex = x2 - (dx / len) * 26 + nx * off, ey = y2 - (dy / len) * 26 + ny * off;
      const qx = (sx + ex) / 2 + nx * 18, qy = (sy + ey) / 2 + ny * 18;
      el("path", { d: `M${sx} ${sy} Q${qx} ${qy} ${ex} ${ey}`, "marker-end": "url(#prob-arrow)", style: `fill:none;stroke:currentColor;stroke-opacity:0.5;stroke-width:${0.75 + 3 * w}` }, g);
      text(g, qx + nx * 6, qy + ny * 6 + 3, num(w, 2), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    }
    pos.forEach(([x, y], i) => {
      el("circle", { cx: x, cy: y, r: 22, style: `fill:var(--background);stroke:${STATES[i].color};stroke-width:${i === startState ? 3 : 1.5}` }, g);
      text(g, x, y + 5, STATES[i].sym, { "text-anchor": "middle", class: "fill-foreground text-[16px]" });
    });

    // Forecast from the start state, day by day.
    const days = 20, hist = [[0, 1, 2].map((k) => (k === startState ? 1 : 0))];
    for (let d = 1; d <= days; d++) {
      const prev = hist.at(-1);
      hist.push([0, 1, 2].map((j) => prev.reduce((a, v, i) => a + v * P[i][j], 0)));
    }
    const pi = stationary(P);
    conv.replaceChildren();
    const f = frame(conv, { box: [44, 18, 460, 122], x: [0, days], y: [0, 1], xticks: [0, 5, 10, 15, 20], yticks: [0, 0.5, 1], xlabel: "days ahead", ylabel: "forecast probability" });
    STATES.forEach((st, k) => {
      if (pi) el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(pi[k]), y2: f.sy(pi[k]), style: `stroke:${st.color};stroke-opacity:0.5;stroke-dasharray:4 4` }, conv);
      polyline(conv, hist.map((d, i) => [f.sx(i), f.sy(d[k])]), `stroke:${st.color};stroke-width:1.75`);
      text(conv, f.L + f.W + 4, f.sy(hist.at(-1)[k]) + 3, st.sym, { class: "fill-foreground text-[11px]" });
    });
    o.pi.textContent = pi ? fmtDist(pi) : "not unique";
    o.d1.textContent = fmtDist(hist[1]);
    o.d10.textContent = fmtDist(hist[10]);
    // A simulated month.
    const rng = mulberry32(31 + startState);
    let x = startState, strip = "";
    for (let d = 0; d < 30; d++) {
      strip += STATES[x].sym;
      let r = rng(), j = 0;
      while (j < 2 && (r -= P[x][j]) > 0) j++;
      x = j;
    }
    o.strip.textContent = strip;
  }
  draw();
}

// ============================================================ Dice sums

function diceDist(n, faces) {
  let d = [1]; // distribution of the sum of zero dice: 0 with probability 1
  const die = new Array(faces + 1).fill(1 / faces);
  die[0] = 0;
  for (let k = 0; k < n; k++) {
    const next = new Array(d.length + faces).fill(0);
    d.forEach((p, i) => { if (p) for (let f = 1; f <= faces; f++) next[i + f] += p / faces; });
    d = next;
  }
  return d;
}

for (const root of document.querySelectorAll("[data-prob-dice]")) {
  const svg = plot(root), o = outs(root);
  let faces = 6, rolled = null, seed = 1;
  const s = scrubAll(root, () => { rolled = null; draw(); });
  onSeg(root, (_, v) => { faces = Number(v); rolled = null; draw(); });
  root.querySelector("[data-action=roll]").addEventListener("click", () => {
    const n = Math.round(s.n.get()), rng = mulberry32(seed++ * 911);
    const counts = new Array(n * faces + 1).fill(0);
    for (let t = 0; t < 1000; t++) { let sum = 0; for (let k = 0; k < n; k++) sum += 1 + Math.floor(rng() * faces); counts[sum]++; }
    rolled = { n, faces, counts };
    draw();
  });

  function draw() {
    const n = Math.round(s.n.get()), lo = n, hi = n * faces;
    const k = Math.max(lo, Math.min(hi, Math.round(s.k.get())));
    const d = diceDist(n, faces);
    const peak = Math.max(...d.slice(lo, hi + 1), ...(rolled && rolled.n === n && rolled.faces === faces ? rolled.counts.map((c) => c / 1000) : [0]));
    svg.replaceChildren();
    const span = hi - lo;
    const step = span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : 1;
    const f = frame(svg, { box: [52, 14, 492, 270], x: [lo - 0.6, hi + 0.6], y: [0, peak * 1.12], xticks: Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => lo + i * step), yticks: [0, peak / 2, peak].map((v) => Math.round(v * 1000) / 1000), yfmt: (v) => num(v, 3), xlabel: "sum", ylabel: "probability" });
    const bw = Math.max(1, (f.sx(1) - f.sx(0)) * 0.8);
    for (let x = lo; x <= hi; x++) {
      const p = d[x];
      el("rect", { x: f.sx(x) - bw / 2, y: f.sy(p), width: bw, height: f.sy(0) - f.sy(p), rx: Math.min(2, bw / 3), style: x >= k ? "fill:var(--brand);fill-opacity:0.7" : "fill:var(--foreground);fill-opacity:0.2" }, svg);
    }
    if (rolled && rolled.n === n && rolled.faces === faces)
      for (let x = lo; x <= hi; x++) if (rolled.counts[x]) el("circle", { cx: f.sx(x), cy: f.sy(rolled.counts[x] / 1000), r: 2.5, style: "fill:var(--vec-u)" }, svg);
    const mean = d.reduce((a, p, x) => a + p * x, 0);
    const variance = d.reduce((a, p, x) => a + p * (x - mean) ** 2, 0);
    const tail = d.slice(k).reduce((a, b) => a + b, 0);
    const maxP = Math.max(...d);
    const modes = d.map((p, x) => [p, x]).filter(([p]) => Math.abs(p - maxP) < 1e-12).map(([, x]) => x);
    o.mean.textContent = `${num(mean, 3)}  (n(s+1)/2 = ${num((n * (faces + 1)) / 2, 3)})`;
    o.var.textContent = `${num(variance, 3)}  (n(s²−1)/12 = ${num((n * (faces * faces - 1)) / 12, 3)})`;
    o.tail.textContent = `${pct(tail, 2)} for k = ${k}`;
    o.mode.textContent = modes.join(" and ");
  }
  draw();
}
