// Immunology blocks. Curves labelled "illustrative" are teaching shapes;
// everything else is computed here: a bit-string clonal selection model
// (Farmer, Packard & Perelson 1986), V(D)J counts, a 4PL fit by
// Levenberg–Marquardt, gating on a synthetic sample, ABO/RhD rules and
// serial dilutions.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// SVG elements have no .hidden property: toggle the attribute.
function playButton(btn, labels) {
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// Pointer position in the SVG's viewBox units.
function viewXY(svg, e) {
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  return [((e.clientX - r.left) / r.width) * vb.width, ((e.clientY - r.top) / r.height) * vb.height];
}

// Marks the segmented button for value as selected (when code switches mode).
function selectSeg(root, value) {
  for (const b of root.querySelectorAll("[data-seg]")) if (b.closest("[role=tablist]")) {
    const list = b.closest("[role=tablist]");
    if ([...list.querySelectorAll("[data-seg]")].some((x) => x.dataset.seg === value)) b.setAttribute("aria-selected", String(b.dataset.seg === value));
  }
}

const sup = (n) => String(n).replace(/[0-9-]/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"["0123456789".indexOf(c)] ?? "⁻");
const big = (n) => (n < 1e6 ? Math.round(n).toLocaleString("en-US") : `${num(n / 10 ** Math.floor(Math.log10(n)), 2)} × 10${sup(Math.floor(Math.log10(n)))}`);

// ============================================================ Primary and secondary response

// A smooth rise and fall that peaks at t0 + tp with height A.
function bump(t, t0, tp, A, k) {
  const x = t - t0;
  if (x <= 0) return 0;
  const u = x / tp;
  return A * u ** k * Math.exp(k * (1 - u));
}
// Long-lived plasma cells keep some IgG after the peak.
const tail = (t, t0, A) => (t <= t0 ? 0 : A * (1 - Math.exp(-(t - t0) / 4)) * Math.exp(-(t - t0) / 150));

for (const root of document.querySelectorAll("[data-immuno-response]")) {
  const svg = root.querySelector("[data-plot]"), o = outs(root);
  let kind = "same";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; draw(); });

  function curves(T2) {
    const same = kind === "same";
    const days = [];
    for (let t = 0; t <= T2 + 60; t += 0.25) days.push(t);
    const innate = days.map((t) => 1 + 25 * bump(t, 0, 2, 1, 2) + 25 * bump(t, T2, 2, 1, 2));
    // Antibody to the antigen of the second exposure: with memory if it is the same one.
    const igm1 = (t) => 40 * bump(t, 4, 6, 1, 3);
    const igg1 = (t) => 60 * bump(t, 6, 9, 1, 3) + tail(t, 15, 8);
    const igm = days.map((t) => 1 + igm1(t) + (same ? 12 * bump(t, T2 + 2, 4, 1, 3) : igm1(t - T2)));
    const igg = days.map((t) => 1 + igg1(t) + (same ? 1500 * bump(t, T2 + 2, 5, 1, 3) + tail(t, T2 + 7, 120) : igg1(t - T2)));
    return { days, innate, igm, igg };
  }

  function draw() {
    const T2 = s.second.get();
    const { days, innate, igm, igg } = curves(T2);
    svg.replaceChildren();
    const xmax = Math.ceil((T2 + 60) / 20) * 20;
    const f = frame(svg, { box: [46, 34, 576, 210], x: [0, xmax], y: [0, 4], xticks: Array.from({ length: xmax / 20 + 1 }, (_, i) => i * 20), yticks: [0, 1, 2, 3, 4], yfmt: (v) => `10${sup(v)}`, xlabel: "days", ylabel: "relative level (log)" });
    const ly = (v) => f.sy(Math.log10(v));
    for (const [t, lbl] of [[0, "1st exposure"], [T2, kind === "same" ? "same antigen again" : "new antigen"]]) {
      el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
      el("path", { d: `M${f.sx(t)} ${f.T - 2} l-5 -8 h10 Z`, style: "fill:var(--code-del)" }, svg);
      text(svg, f.sx(t) + 6, f.T + 10, lbl);
    }
    polyline(svg, days.map((t, i) => [f.sx(t), ly(innate[i])]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 3");
    polyline(svg, days.map((t, i) => [f.sx(t), ly(igm[i])]), "stroke:var(--vec-out);stroke-width:2");
    polyline(svg, days.map((t, i) => [f.sx(t), ly(igg[i])]), "stroke:var(--brand);stroke-width:2.25");

    const peak = (from, to) => days.reduce((b, t, i) => (t >= from && t < to && igg[i] > b.v ? { t, v: igg[i] } : b), { t: 0, v: 0 });
    const p1 = peak(0, T2), p2 = peak(T2, T2 + 60);
    for (const p of [p1, p2]) el("circle", { cx: f.sx(p.t), cy: ly(p.v), r: 3.5, style: "fill:var(--brand)" }, svg);
    o.p1.textContent = `day ${Math.round(p1.t)}, ×${Math.round(p1.v)}`;
    o.p2.textContent = `day ${Math.round(p2.t)}, ×${Math.round(p2.v)}`;
    o.ratio.textContent = `${num(p2.v / p1.v, 1)}×`;
    o.lag.textContent = `${Math.round(p1.t)} d → ${Math.round(p2.t - T2)} d`;
  }
  draw();
}

// ============================================================ Clonal selection

const BITS = 24, POP = 500;
function popcount(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }

for (const root of document.querySelectorAll("[data-immuno-clonal]")) {
  const bitsSvg = root.querySelector('[data-plot="bits"]'), hist = root.querySelector('[data-plot="hist"]'), trend = root.querySelector('[data-plot="trend"]');
  const o = outs(root), playBtn = root.querySelector('[data-action="play"]'), showPlay = playButton(playBtn, ["Run", "Pause"]);
  const s = scrubAll(root, () => {});
  let rng, antigen, pop, round, history, first, timer = null;
  const affinity = (r) => popcount((r ^ antigen) & 0xffffff); // complementary bits

  function reset(seed = (Math.random() * 2 ** 31) | 0) {
    rng = mulberry32(seed);
    antigen = (rng() * 2 ** 24) >>> 0;
    pop = Array.from({ length: POP }, () => (rng() * 2 ** 24) >>> 0);
    round = 0;
    history = [stats()];
    first = counts();
    draw();
  }
  const counts = () => { const c = new Array(BITS + 1).fill(0); for (const r of pop) c[affinity(r)]++; return c; };
  function stats() {
    let sum = 0, best = 0, perfect = 0;
    for (const r of pop) { const a = affinity(r); sum += a; best = Math.max(best, a); if (a === BITS) perfect++; }
    return { mean: sum / POP, best, perfect };
  }
  function step() {
    const p = s.mut.get(), keep = Math.max(1, Math.round((POP * s.keep.get()) / 100));
    // Shuffle first so ties are broken at random, then rank by affinity.
    for (let i = pop.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [pop[i], pop[j]] = [pop[j], pop[i]]; }
    const parents = pop.map((r) => [affinity(r), r]).sort((a, b) => b[0] - a[0]).slice(0, keep).map((x) => x[1]);
    const next = parents.slice();
    for (let i = 0; next.length < POP; i++) {
      let child = parents[i % keep];
      for (let b = 0; b < BITS; b++) if (rng() < p) child ^= 1 << b;
      next.push(child >>> 0);
    }
    pop = next;
    round++;
    history.push(stats());
    draw();
  }

  function draw() {
    // Bits: antigen above, the best receptor below; complementary pairs lit.
    bitsSvg.replaceChildren();
    const best = pop.reduce((b, r) => (affinity(r) > affinity(b) ? r : b), pop[0]);
    const w = 22, x0 = (640 - BITS * w) / 2;
    text(bitsSvg, x0 - 8, 30, "antigen", { "text-anchor": "end" });
    text(bitsSvg, x0 - 8, 72, "best BCR", { "text-anchor": "end" });
    for (let b = 0; b < BITS; b++) {
      const x = x0 + b * w, ab = (antigen >>> b) & 1, rb = (best >>> b) & 1, match = ab !== rb;
      el("rect", { x: x + 2, y: 14, width: w - 4, height: 22, rx: 3, style: `fill:${ab ? "var(--foreground)" : "transparent"};fill-opacity:0.7;stroke:var(--foreground);stroke-opacity:0.4` }, bitsSvg);
      el("rect", { x: x + 2, y: 56, width: w - 4, height: 22, rx: 3, style: `fill:${rb ? "var(--foreground)" : "transparent"};fill-opacity:0.7;stroke:${match ? "var(--brand)" : "var(--foreground)"};stroke-opacity:${match ? 1 : 0.4};stroke-width:${match ? 2 : 1}` }, bitsSvg);
      if (match) el("line", { x1: x + w / 2, x2: x + w / 2, y1: 38, y2: 54, style: "stroke:var(--brand);stroke-width:1.5" }, bitsSvg);
    }

    // Histogram: the starting repertoire outlined, the current one filled.
    hist.replaceChildren();
    const c = counts(), ymax = Math.max(60, ...c, ...first);
    const f = frame(hist, { box: [36, 14, 330, 172], x: [-0.5, BITS + 0.5], y: [0, ymax], xticks: [0, 6, 12, 18, 24], yticks: [0, Math.round(ymax / 2), ymax], xlabel: "affinity (bits)", ylabel: "cells" });
    const bw = f.sx(1) - f.sx(0);
    for (let a = 0; a <= BITS; a++) {
      el("rect", { x: f.sx(a) - bw * 0.4, y: f.sy(c[a]), width: bw * 0.8, height: f.sy(0) - f.sy(c[a]), rx: 1.5, style: "fill:var(--brand);fill-opacity:0.75" }, hist);
      el("rect", { x: f.sx(a) - bw * 0.4, y: f.sy(first[a]), width: bw * 0.8, height: f.sy(0) - f.sy(first[a]), style: "fill:none;stroke:var(--foreground);stroke-opacity:0.45;stroke-dasharray:2 2" }, hist);
    }
    text(hist, f.L + 6, f.T + 8, "dashed: round 0");

    // Trend of mean and best affinity.
    trend.replaceChildren();
    const n = Math.max(20, history.length - 1);
    const g = frame(trend, { box: [30, 14, 218, 172], x: [0, n], y: [0, BITS], xticks: [0, Math.round(n / 2), n], yticks: [0, 12, 24], xlabel: "round" });
    polyline(trend, history.map((h, i) => [g.sx(i), g.sy(h.best)]), "stroke:var(--brand);stroke-width:2");
    polyline(trend, history.map((h, i) => [g.sx(i), g.sy(h.mean)]), "stroke:var(--vec-u);stroke-width:2");
    text(trend, g.L + 4, g.T + 8, "best", { style: "fill:var(--brand)" });
    text(trend, g.L + 34, g.T + 8, "mean", { style: "fill:var(--vec-u)" });

    const st = history.at(-1);
    o.round.textContent = String(round);
    o.mean.textContent = `${num(st.mean, 1)} / ${BITS}`;
    o.best.textContent = `${st.best} / ${BITS}`;
    o.perfect.textContent = `${st.perfect} (${num((100 * st.perfect) / POP, 1)}%)`;
  }

  const stop = () => { clearInterval(timer); timer = null; showPlay(false); };
  playBtn.addEventListener("click", () => {
    if (timer) return stop();
    showPlay(true);
    timer = setInterval(() => (round >= 200 ? stop() : step()), reduced() ? 600 : 260);
  });
  root.querySelector('[data-action="step"]').addEventListener("click", () => { stop(); step(); });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { stop(); reset(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && timer) stop(); }).observe(root);
  reset(2024);
}

// ============================================================ V(D)J recombination

const NT = "ACGT";
for (const root of document.querySelectorAll("[data-immuno-vdj]")) {
  const svg = root.querySelector('[data-plot="locus"]'), o = outs(root);
  const defaults = { hv: 40, hd: 23, hj: 6, kv: 40, kj: 5, lv: 30, lj: 4 };
  const s = scrubAll(root, () => { pick = null; draw(); });
  let pick = null, seq = 0;
  const rng = mulberry32(7);

  root.querySelector('[data-action="defaults"]').addEventListener("click", () => {
    for (const [k, v] of Object.entries(defaults)) s[k].set(v, false);
    pick = null;
    draw();
  });
  const recombine = () => {
    const n = (k) => Math.max(1, Math.round(s[k].get()));
    const rnt = (len) => Array.from({ length: len }, () => NT[(rng() * 4) | 0]).join("");
    // D segments are 11–31 nt; trimming and N additions decide the reading frame.
    const d = 1 + ((rng() * n("hd")) | 0);
    pick = {
      v: 1 + ((rng() * n("hv")) | 0), d, j: 1 + ((rng() * n("hj")) | 0),
      dlen: 11 + ((d * 7) % 21), trim: [0, 1, 2, 3].map(() => (rng() * 5) | 0), n1: rnt((rng() * 7) | 0), n2: rnt((rng() * 7) | 0),
    };
    seq++;
    draw(true);
  };
  root.querySelector('[data-action="recombine"]').addEventListener("click", recombine);

  function draw(animate = false) {
    const v = s.hv.get(), dd = s.hd.get(), j = s.hj.get();
    const heavy = v * dd * j, light = s.kv.get() * s.kj.get() + s.lv.get() * s.lj.get();
    o.heavy.textContent = big(heavy);
    o.light.textContent = big(light);
    o.pairs.textContent = big(heavy * light);

    svg.replaceChildren();
    const region = (x0, x1, count, chosen, label, color, y) => {
      const step = (x1 - x0) / count, w = Math.max(1.5, Math.min(step - 1.5, 14));
      for (let i = 1; i <= count; i++) {
        const on = chosen === i;
        el("rect", { x: x0 + (i - 1) * step, y: y - (on ? 12 : 9), width: w, height: on ? 24 : 18, rx: 1.5, style: `fill:${on ? "var(--brand)" : color};fill-opacity:${on ? 1 : 0.55}` }, svg);
      }
      text(svg, x0, y + 26, `${label} ×${count}`);
    };
    text(svg, 8, 18, "germline heavy-chain locus (chromosome 14)");
    region(10, 380, v, pick?.v, "V", "var(--vec-u)", 52);
    region(400, 490, dd, pick?.d, "D", "var(--vec-out)", 52);
    region(510, 560, j, pick?.j, "J", "var(--vec-i)", 52);
    el("rect", { x: 580, y: 43, width: 50, height: 18, rx: 3, style: "fill:var(--foreground);fill-opacity:0.25" }, svg);
    text(svg, 580, 78, "C (Cμ…)");

    if (!pick) {
      text(svg, 8, 140, "Press Recombine: RAG1/RAG2 cut at recombination signal sequences,");
      text(svg, 8, 156, "first joining one D to one J, then one V to the DJ.");
      o.junction.textContent = "Press Recombine.";
      return;
    }
    // Excised DNA: everything between the chosen segments loops out.
    const g = el("g", { style: animate && !reduced() ? "opacity:0;transition:opacity 300ms var(--ease-out)" : "" }, svg);
    const xV = 10 + ((pick.v - 0.5) * 370) / v, xD = 400 + ((pick.d - 0.5) * 90) / dd, xJ = 510 + ((pick.j - 0.5) * 50) / j;
    for (const [a, b, lbl] of [[xV, xD, "excised V–D"], [xD, xJ, "D–J"]]) {
      el("path", { d: `M${a} 80 C${a} 104 ${b} 104 ${b} 80`, style: "fill:none;stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:3 3" }, g);
      text(g, (a + b) / 2, 112, lbl, { "text-anchor": "middle" });
    }
    text(g, 8, 140, "rearranged gene in this B cell");
    const parts = [
      [`V${pick.v}`, 150, "var(--vec-u)"], [pick.n1 || "–", 8 + pick.n1.length * 7, "var(--code-del)"],
      [`D${pick.d}`, 60, "var(--vec-out)"], [pick.n2 || "–", 8 + pick.n2.length * 7, "var(--code-del)"],
      [`J${pick.j}`, 50, "var(--vec-i)"], ["C", 60, "var(--foreground)"],
    ];
    let x = 10;
    for (const [lbl, w, color] of parts) {
      el("rect", { x, y: 160, width: w, height: 22, rx: 3, style: `fill:${color};fill-opacity:${color === "var(--code-del)" ? 0.25 : 0.4}` }, g);
      text(g, x + w / 2, 175, lbl, { "text-anchor": "middle", style: "fill:var(--foreground)" });
      x += w + 2;
    }
    text(g, 10, 204, "red: N nucleotides added by TdT, not in the germline");
    if (animate && !reduced()) requestAnimationFrame(() => requestAnimationFrame(() => (g.style.opacity = "1")));

    // Reading frame: the junction's net length must keep V and J in frame.
    const [tv, td5, td3, tj] = pick.trim;
    const net = -tv + pick.n1.length + (pick.dlen - td5 - td3) + pick.n2.length - tj;
    const inFrame = ((net % 3) + 3) % 3 === 0;
    o.junction.textContent =
      `#${seq}  V${pick.v} (−${tv}) + N:${pick.n1 || "∅"} + D${pick.d} (${pick.dlen} nt, −${td5}/−${td3}) + N:${pick.n2 || "∅"} + J${pick.j} (−${tj})\n` +
      `junction adds ${net} nt → ${inFrame ? "in frame: productive (about 1 join in 3)" : "out of frame: unproductive, the cell tries its other allele"}`;
  }
  recombine();
}

// ============================================================ Antibody structure

const ISOTYPES = {
  IgG: { form: "monomer", level: "≈ 13.5 mg/mL (IgG1 9)", half: "≈ 21 days (IgG3 ≈ 7)", placenta: "yes", jobs: "neutralisation, opsonisation, complement, ADCC", n: 1 },
  IgA: { form: "monomer; dimer + J chain in secretions", level: "≈ 3.5 mg/mL", half: "≈ 6 days", placenta: "no (into breast milk)", jobs: "neutralisation at mucosal surfaces", n: 2 },
  IgM: { form: "pentamer + J chain", level: "≈ 1.5 mg/mL", half: "≈ 10 days", placenta: "no", jobs: "first antibody made; strongest complement activator", n: 5 },
  IgE: { form: "monomer", level: "≈ 0.00005 mg/mL", half: "≈ 2 days (weeks on mast cells)", placenta: "no", jobs: "arms mast cells and basophils; parasites, allergy", n: 1 },
  IgD: { form: "monomer", level: "≈ 0.03 mg/mL", half: "≈ 3 days", placenta: "no", jobs: "receptor on naive B cells", n: 1 },
};

function yGlyph(parent, x, y, s, rot) {
  const g = el("g", { transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` }, parent);
  el("path", { d: "M0 0 V10 M0 0 L-7 -8 M0 0 L7 -8", style: "fill:none;stroke:var(--brand);stroke-width:2.5;stroke-linecap:round" }, g);
  return g;
}

for (const root of document.querySelectorAll("[data-immuno-antibody]")) {
  const o = outs(root), multimer = root.querySelector('[data-plot="multimer"]');
  const desc = Object.fromEntries([...root.querySelectorAll("[data-desc]")].map((li) => [li.dataset.desc, { title: li.dataset.title, body: li.textContent }]));
  const parts = [...root.querySelectorAll("[data-part]")];
  const show = (key) => {
    for (const p of parts) p.toggleAttribute("data-on", p.dataset.part === key);
    o["part-title"].textContent = desc[key].title;
    o["part-body"].textContent = desc[key].body;
  };
  for (const p of parts) {
    p.addEventListener("pointerenter", () => show(p.dataset.part));
    p.addEventListener("focus", () => show(p.dataset.part));
    p.addEventListener("click", () => show(p.dataset.part));
  }

  function isotype(name) {
    const d = ISOTYPES[name];
    o.form.textContent = d.form;
    o.level.textContent = d.level;
    o.half.textContent = d.half;
    o.placenta.textContent = d.placenta;
    o.jobs.textContent = d.jobs;
    multimer.replaceChildren();
    el("rect", { x: 1, y: 1, width: 118, height: 88, rx: 8, style: "fill:var(--background);stroke:var(--border)" }, multimer);
    text(multimer, 8, 14, name);
    if (d.n === 1) yGlyph(multimer, 60, 52, 1.6, 0);
    else if (d.n === 2) { yGlyph(multimer, 48, 52, 1.4, -90); yGlyph(multimer, 72, 52, 1.4, 90); el("circle", { cx: 60, cy: 52, r: 2.5, style: "fill:var(--vec-out)" }, multimer); }
    else for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
      yGlyph(multimer, 60 + 14 * Math.cos(a), 52 + 14 * Math.sin(a), 1.1, (a * 180) / Math.PI - 90);
    }
    if (d.n === 5) el("circle", { cx: 60, cy: 52, r: 2.5, style: "fill:var(--vec-out)" }, multimer);
  }
  root.addEventListener("seg-change", (e) => isotype(e.detail.value));
  isotype("IgG");
}

// ============================================================ Steppers (MHC, complement keyboard)

for (const root of document.querySelectorAll("[data-immuno-mhc]")) {
  const lists = Object.fromEntries([...root.querySelectorAll("[data-path]")].map((l) => [l.dataset.path, l]));
  const parts = [...root.querySelectorAll("[data-s]")];
  const count = root.querySelector("[data-out=count]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let path = "i", at = 0;
  const items = () => [...lists[path].querySelectorAll("[data-item]")];
  const go = (i) => {
    const its = items();
    at = Math.max(0, Math.min(its.length - 1, i));
    const key = path + at;
    for (const p of parts) p.toggleAttribute("data-on", p.dataset.s.split(" ").includes(key));
    its.forEach((li, k) => li.toggleAttribute("data-on", k === at));
    count.textContent = `${at + 1} / ${its.length}`;
    back.disabled = at === 0;
    next.disabled = at === its.length - 1;
  };
  root.addEventListener("seg-change", (e) => {
    path = e.detail.value;
    for (const [k, l] of Object.entries(lists)) l.hidden = k !== path;
    go(0);
  });
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  for (const l of Object.values(lists)) l.querySelectorAll("[data-item]").forEach((li, k) => li.addEventListener("click", () => go(k)));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: items().length - 1 }[e.key];
    if (to === undefined || e.target.closest("button,a")) return;
    e.preventDefault();
    go(to);
  });
  go(0);
}

// ============================================================ Complement

const C_NODES = {
  ab: [72, 50, "antibody on antigen"], c1: [188, 50, "C1q·C1r·C1s"],
  mbl: [72, 140, "MBL / ficolins"], masp: [188, 140, "MASP-2"],
  tick: [72, 240, "C3 tickover"], fb: [188, 240, "factor B + D"],
  c4b2a: [296, 95, "C4b2a"], c3bbb: [300, 240, "C3bBb + properdin"],
  c3: [400, 168, "C3 → C3a + C3b"], opson: [400, 58, "C3b: opsonisation"],
  c5: [510, 168, "C5 convertase"], inflam: [510, 262, "C3a, C5a: inflammation"],
  mac: [590, 100, "MAC C5b–9"],
};
const C_PATHS = {
  classical: [["ab"], ["c1"], ["c4b2a"], ["c3", "opson"], ["c5", "inflam"], ["mac"]],
  lectin: [["mbl"], ["masp"], ["c4b2a"], ["c3", "opson"], ["c5", "inflam"], ["mac"]],
  alternative: [["tick"], ["fb"], ["c3bbb"], ["c3", "opson", "loop"], ["c5", "inflam"], ["mac"]],
};
const C_TEXT = {
  classical: [
    "IgM or IgG bound to a pathogen's surface gives C1q something to grip; one IgM or several neighbouring IgG are needed.",
    "C1q binding activates C1r, which activates the protease C1s.",
    "C1s cuts C4 and then C2; C4b and the large C2 fragment form the C3 convertase C4b2a on the surface.",
    "Each convertase cuts many C3 molecules: C3b coats the microbe so phagocytes can grab it (opsonisation), C3a is released.",
    "C3b joins the convertase to make the C5 convertase (C4b2a3b). It cuts C5: C5a is a powerful attractant of neutrophils.",
    "C5b recruits C6, C7, C8 and many C9 into a pore, the membrane attack complex, which can lyse bacteria such as Neisseria.",
  ],
  lectin: [
    "Mannose-binding lectin (MBL) or ficolins recognise sugar patterns found on microbes but not on our cells.",
    "Bound MBL activates its associated serine protease MASP-2.",
    "MASP-2 cuts C4 and C2, building the same C3 convertase as the classical pathway, C4b2a.",
    "From here it is shared: C3b opsonises the surface and C3a is released.",
    "The C5 convertase cuts C5 into C5a and C5b.",
    "C5b–C9 assemble the membrane attack complex.",
  ],
  alternative: [
    "C3 is always slowly hydrolysed in plasma (tickover); any C3b that lands on a surface can start the pathway.",
    "Factor B binds C3b and factor D cuts it, leaving Bb attached.",
    "C3bBb is the alternative C3 convertase; properdin stabilises it on microbial surfaces.",
    "Every new C3b can build another C3bBb: an amplification loop that also boosts the other two pathways.",
    "C3bBb3b is the alternative C5 convertase: C5a out, C5b on.",
    "C5b–C9 form the membrane attack complex.",
  ],
};
const C_CONV = { classical: ["C4b2a", "C4b2a3b"], lectin: ["C4b2a", "C4b2a3b"], alternative: ["C3bBb", "C3bBb3b"] };
const C_EDGES = [["ab", "c1"], ["c1", "c4b2a"], ["mbl", "masp"], ["masp", "c4b2a"], ["tick", "fb"], ["fb", "c3bbb"], ["c4b2a", "c3"], ["c3bbb", "c3"], ["c3", "opson"], ["c3", "c5"], ["c5", "inflam"], ["c5", "mac"]];

for (const root of document.querySelectorAll("[data-immuno-complement]")) {
  const svg = root.querySelector("[data-plot]"), o = outs(root);
  const playBtn = root.querySelector('[data-action="play"]'), showPlay = playButton(playBtn, ["Play", "Pause"]);
  let path = "classical", at = 0, reg = false, timer = null;
  // On host cells the regulators stop the cascade at the convertase.
  const last = () => (reg ? 2 : C_PATHS[path].length - 1);

  function draw() {
    const steps = C_PATHS[path], lit = new Set(steps.slice(0, at + 1).flat()), now = new Set(steps[at]);
    svg.replaceChildren();
    const on = (k) => lit.has(k);
    for (const [a, b] of C_EDGES) {
      const [x1, y1] = C_NODES[a], [x2, y2] = C_NODES[b];
      el("line", { x1, y1, x2, y2, style: `stroke:${on(a) && on(b) ? "var(--brand)" : "var(--foreground)"};stroke-opacity:${on(a) && on(b) ? 0.9 : 0.15};stroke-width:${on(a) && on(b) ? 2 : 1.25}` }, svg);
    }
    if (lit.has("loop")) {
      el("path", { d: "M400 186 C380 250 340 262 312 252", style: "fill:none;stroke:var(--brand);stroke-width:1.75;stroke-dasharray:4 3" }, svg);
      text(svg, 330, 284, "amplification loop");
    }
    for (const [k, [x, y, lbl]] of Object.entries(C_NODES)) {
      const w = Math.max(64, lbl.length * 6.2 + 14);
      const cur = now.has(k), was = lit.has(k);
      el("rect", { x: x - w / 2, y: y - 12, width: w, height: 24, rx: 12, style: `fill:${was ? "color-mix(in oklab, var(--brand) " + (cur ? 28 : 12) + "%, var(--code-bg))" : "var(--code-bg)"};stroke:${was ? "var(--brand)" : "var(--foreground)"};stroke-opacity:${was ? 1 : 0.25};stroke-width:${cur ? 2 : 1.25}` }, svg);
      text(svg, x, y + 3.5, lbl, { "text-anchor": "middle", style: `fill:${was ? "var(--foreground)" : "var(--muted-foreground)"}` });
    }
    if (reg && at === 2) {
      const [x, y] = C_NODES[path === "alternative" ? "c3bbb" : "c4b2a"];
      el("path", { d: `M${x - 9} ${y - 22} l18 18 m0 -18 l-18 18`, style: "stroke:var(--code-del);stroke-width:2.5;stroke-linecap:round" }, svg);
      text(svg, x + 14, y - 16, "decayed by CD55 / factor H", { style: "fill:var(--code-del)" });
    }
    o.step.textContent = `${at + 1} / ${last() + 1}`;
    o.c3conv.textContent = at >= 2 ? C_CONV[path][0] : "—";
    o.c5conv.textContent = at >= 4 ? C_CONV[path][1] : "—";
    o.outcome.textContent = reg && at === 2 ? "host cell spared" : at >= 5 ? "lysis, opsonisation, inflammation" : at >= 3 ? "opsonisation" : "—";
    o.explain.textContent = reg && at === 2
      ? "On our own cells, regulators stop the cascade: DAF (CD55) and factor H break up C3 convertases, MCP (CD46) helps factor I destroy C3b, and CD59 blocks C9 from forming the pore."
      : C_TEXT[path][at];
    root.querySelector('[data-go="-1"]').disabled = at === 0;
    root.querySelector('[data-go="1"]').disabled = at >= last();
  }
  const go = (i) => { at = Math.max(0, Math.min(last(), i)); draw(); };
  const stop = () => { clearInterval(timer); timer = null; showPlay(false); };
  root.querySelector('[data-go="-1"]').addEventListener("click", () => { stop(); go(at - 1); });
  root.querySelector('[data-go="1"]').addEventListener("click", () => { stop(); go(at + 1); });
  playBtn.addEventListener("click", () => {
    if (timer) return stop();
    if (at >= last()) at = -1;
    showPlay(true);
    const tick = () => (at >= last() ? stop() : go(at + 1));
    tick();
    timer = setInterval(tick, 1400);
  });
  root.addEventListener("seg-change", (e) => { stop(); path = e.detail.value; go(0); });
  onToggle(root, (_, v) => { reg = v; go(Math.min(at, last())); });
  go(0);
}

// ============================================================ ELISA 4PL

const fourPL = ([a, b, lc, d], x) => d + (a - d) / (1 + (x / 10 ** lc) ** b);

// Levenberg–Marquardt on parameters [a, b, log10 c, d] with a numeric Jacobian.
function fit4PL(xs, ys) {
  let p = [Math.min(...ys), 1, Math.log10(Math.sqrt(Math.min(...xs) * Math.max(...xs))), Math.max(...ys)];
  const sse = (q) => xs.reduce((s, x, i) => s + (ys[i] - fourPL(q, x)) ** 2, 0);
  let lambda = 1e-2, cur = sse(p);
  for (let it = 0; it < 300; it++) {
    const J = xs.map((x) => p.map((_, k) => { const q = p.slice(), hh = 1e-6 * Math.max(1, Math.abs(p[k])); q[k] += hh; return (fourPL(q, x) - fourPL(p, x)) / hh; }));
    const r = xs.map((x, i) => ys[i] - fourPL(p, x));
    const A = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => J.reduce((s, row) => s + row[i] * row[j], 0)));
    const g = [0, 1, 2, 3].map((i) => J.reduce((s, row, n) => s + row[i] * r[n], 0));
    for (let i = 0; i < 4; i++) A[i][i] *= 1 + lambda;
    const dp = solve4(A, g);
    if (!dp) { lambda *= 10; continue; }
    const q = p.map((v, i) => v + dp[i]);
    const next = sse(q);
    if (next < cur) {
      const done = cur - next < 1e-14 * (1 + cur);
      p = q; cur = next; lambda = Math.max(1e-9, lambda / 3);
      if (done) break;
    } else lambda *= 4;
  }
  const mean = ys.reduce((s, y) => s + y, 0) / ys.length;
  const tot = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
  return { p, r2: 1 - cur / tot };
}
function solve4(A, b) {
  const M = A.map((row, i) => [...row, b[i]]), n = 4;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

for (const root of document.querySelectorAll("[data-immuno-elisa]")) {
  const svg = root.querySelector("[data-plot]"), o = outs(root);
  const TRUE = [0.05, 1.2, Math.log10(40), 2.6];
  const conc = Array.from({ length: 8 }, (_, i) => 1000 / 3 ** i);
  let seed = 11, data;
  const s = scrubAll(root, (k) => { if (k === "noise") make(); draw(); });
  root.querySelector('[data-action="plate"]').addEventListener("click", () => { seed++; make(); draw(); });

  function make() {
    const rng = mulberry32(seed), cv = s.noise.get() / 100;
    data = conc.flatMap((x) => [0, 1].map(() => [x, Math.max(0.005, fourPL(TRUE, x) * (1 + cv * gauss(rng)))]));
  }
  let f;
  function draw() {
    const { p, r2 } = fit4PL(data.map((d) => d[0]), data.map((d) => d[1]));
    const [a, b, lc, d] = p, c = 10 ** lc;
    svg.replaceChildren();
    f = frame(svg, { box: [46, 16, 572, 240], x: [-1, 3.5], y: [0, 3], xticks: [-1, 0, 1, 2, 3], yticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], xfmt: (v) => String(10 ** v), yfmt: (v) => num(v, 1), xlabel: "concentration (pg/mL, log)", ylabel: "OD 450 nm" });
    const lo = Math.min(...conc), hi = Math.max(...conc);
    el("rect", { x: f.sx(Math.log10(lo)), y: f.T, width: f.sx(Math.log10(hi)) - f.sx(Math.log10(lo)), height: f.H, style: "fill:var(--foreground);fill-opacity:0.035" }, svg);
    text(svg, f.sx(Math.log10(lo)) + 4, f.T + 10, "range of the standards");
    const pts = [];
    for (let u = -1; u <= 3.5; u += 0.02) pts.push([f.sx(u), f.sy(fourPL(p, 10 ** u))]);
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    for (const [x, y] of data) el("circle", { cx: f.sx(Math.log10(x)), cy: f.sy(y), r: 3.25, style: "fill:var(--code-bg);stroke:var(--foreground);stroke-width:1.5" }, svg);

    const od = s.od.get();
    const inside = (od - a) * (od - d) < 0;
    const x = inside ? c * ((a - d) / (od - d) - 1) ** (1 / b) : NaN;
    const xl = Number.isFinite(x) ? Math.max(-1, Math.min(3.5, Math.log10(x))) : 3.5;
    el("line", { x1: f.L, x2: f.sx(xl), y1: f.sy(od), y2: f.sy(od), style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 3" }, svg);
    if (Number.isFinite(x)) {
      el("line", { x1: f.sx(xl), x2: f.sx(xl), y1: f.sy(od), y2: f.T + f.H, style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:4 3" }, svg);
      el("circle", { cx: f.sx(xl), cy: f.sy(od), r: 4.5, style: "fill:var(--vec-u)" }, svg);
    }
    o.a.textContent = num(a, 3);
    o.b.textContent = num(b, 3);
    o.c.textContent = `${num(c, 2)} pg/mL`;
    o.d.textContent = num(d, 3);
    o.r2.textContent = num(r2, 5);
    o.conc.textContent = !inside ? "OD outside the curve's range" : x < lo || x > hi ? `${num(x, 1)} pg/mL (extrapolated: dilute or re-run)` : `${num(x, 1)} pg/mL`;
  }
  // Drag on the plot to choose the unknown's OD.
  let dragging = false;
  const setOD = (e) => { const [, y] = viewXY(svg, e); s.od.set(Math.max(0.02, Math.min(3, 3 - ((y - f.T) / f.H) * 3))); };
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); setOD(e); });
  svg.addEventListener("pointermove", (e) => dragging && setOD(e));
  svg.addEventListener("pointerup", () => (dragging = false));
  make();
  draw();
}

// ============================================================ Flow cytometry

const FLOW_POPS = [
  { share: 0.45, mx: 3.4, sx: 0.18, my: 1.0, sy: 0.32 }, // CD4+ T
  { share: 0.22, mx: 1.0, sx: 0.32, my: 3.3, sy: 0.2 }, // CD8+ T
  { share: 0.31, mx: 0.9, sx: 0.32, my: 0.9, sy: 0.3 }, // double negative: B and NK cells
  { share: 0.02, mx: 3.2, sx: 0.2, my: 3.1, sy: 0.2 }, // double positive
];

for (const root of document.querySelectorAll("[data-immuno-flow]")) {
  const canvas = root.querySelector("canvas"), o = outs(root);
  let events = [], mode = "rect", gate = null, cross = [2.2, 2.2], seed = 3, drag = null;
  const M = { l: 42, r: 10, t: 10, b: 34 };
  let W = 0, H = 0, ctx;

  function sample() {
    const rng = mulberry32(seed), n = 6000;
    events = [];
    for (const p of FLOW_POPS) for (let i = 0; i < Math.round(n * p.share); i++)
      events.push([Math.max(0, Math.min(5, p.mx + p.sx * gauss(rng))), Math.max(0, Math.min(5, p.my + p.sy * gauss(rng)))]);
  }
  const sx = (v) => M.l + (v / 5) * (W - M.l - M.r), sy = (v) => H - M.b - (v / 5) * (H - M.t - M.b);
  const ix = (px) => Math.max(0, Math.min(5, ((px - M.l) / (W - M.l - M.r)) * 5)), iy = (py) => Math.max(0, Math.min(5, ((H - M.b - py) / (H - M.t - M.b)) * 5));
  const color = (v) => { const p = document.createElement("span"); p.style.color = v; root.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };

  function draw() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fg = color("var(--foreground)"), muted = color("var(--muted-foreground)"), brand = color("var(--brand)");
    ctx.clearRect(0, 0, W, H);
    // Decade grid and labels.
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = muted; ctx.strokeStyle = fg;
    for (let d = 0; d <= 5; d++) {
      ctx.globalAlpha = 0.08;
      ctx.beginPath(); ctx.moveTo(sx(d), M.t); ctx.lineTo(sx(d), H - M.b); ctx.moveTo(M.l, sy(d)); ctx.lineTo(W - M.r, sy(d)); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.textAlign = "center"; ctx.fillText(`10${sup(d)}`, sx(d), H - M.b + 14);
      ctx.textAlign = "right"; ctx.fillText(`10${sup(d)}`, M.l - 6, sy(d) + 3);
    }
    ctx.textAlign = "right"; ctx.fillText("CD4 →", W - M.r, H - 4);
    ctx.save(); ctx.translate(11, M.t + 30); ctx.rotate(-Math.PI / 2); ctx.textAlign = "right"; ctx.fillText("CD8 →", 0, 0); ctx.restore();
    // Events.
    ctx.fillStyle = fg; ctx.globalAlpha = 0.28;
    for (const [x, y] of events) ctx.fillRect(sx(x) - 0.9, sy(y) - 0.9, 1.8, 1.8);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = brand; ctx.fillStyle = brand; ctx.lineWidth = 1.75;
    const total = events.length;
    const quads = () => {
      const q = [0, 0, 0, 0]; // CD4−CD8+, CD4+CD8+, CD4−CD8−, CD4+CD8−
      for (const [x, y] of events) q[(y >= cross[1] ? 0 : 2) + (x >= cross[0] ? 1 : 0)]++;
      return q;
    };
    const q = quads();
    o.ratio.textContent = q[0] ? num(q[3] / q[0], 2) : "—";
    o.events.textContent = total.toLocaleString("en-US");
    if (mode === "quad") {
      ctx.beginPath(); ctx.moveTo(sx(cross[0]), M.t); ctx.lineTo(sx(cross[0]), H - M.b); ctx.moveTo(M.l, sy(cross[1])); ctx.lineTo(W - M.r, sy(cross[1])); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx(cross[0]), sy(cross[1]), 5, 0, 2 * Math.PI); ctx.fill();
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      const pct = q.map((v) => `${num((100 * v) / total, 1)}%`);
      ctx.textAlign = "left"; ctx.fillText(pct[0], M.l + 6, M.t + 14); ctx.fillText(pct[2], M.l + 6, H - M.b - 6);
      ctx.textAlign = "right"; ctx.fillText(pct[1], W - M.r - 6, M.t + 14); ctx.fillText(pct[3], W - M.r - 6, H - M.b - 6);
      o.in.textContent = `Q4 (CD4⁺CD8⁻) ${q[3].toLocaleString("en-US")}`;
      o.pct.textContent = pct.join(" · ");
    } else if (gate) {
      const [x0, x1] = [Math.min(gate[0], gate[2]), Math.max(gate[0], gate[2])], [y0, y1] = [Math.min(gate[1], gate[3]), Math.max(gate[1], gate[3])];
      ctx.globalAlpha = 0.1; ctx.fillRect(sx(x0), sy(y1), sx(x1) - sx(x0), sy(y0) - sy(y1)); ctx.globalAlpha = 1;
      ctx.strokeRect(sx(x0), sy(y1), sx(x1) - sx(x0), sy(y0) - sy(y1));
      const n = events.filter(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1).length;
      o.in.textContent = n.toLocaleString("en-US");
      o.pct.textContent = `${num((100 * n) / total, 1)}%`;
    } else { o.in.textContent = "drag to draw a gate"; o.pct.textContent = "—"; }
  }
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [ix(e.clientX - r.left), iy(e.clientY - r.top)]; };
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = at(e);
    drag = true;
    if (mode === "quad") cross = p; else gate = [...p, ...p];
    draw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = at(e);
    if (mode === "quad") cross = p; else { gate[2] = p[0]; gate[3] = p[1]; }
    draw();
  });
  canvas.addEventListener("pointerup", () => {
    drag = null;
    if (gate && Math.abs(gate[2] - gate[0]) < 0.05 && Math.abs(gate[3] - gate[1]) < 0.05) gate = null;
    draw();
  });
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  root.querySelector('[data-action="cd4"]').addEventListener("click", () => { mode = "rect"; selectSeg(root, "rect"); gate = [2.6, 0, 5, 2.2]; draw(); });
  root.querySelector('[data-action="sample"]').addEventListener("click", () => { seed++; sample(); draw(); });
  new ResizeObserver(draw).observe(canvas);
  onTheme(draw);
  sample();
  draw();
}

// ============================================================ Blood groups

const BLOOD = ["O−", "O+", "A−", "A+", "B−", "B+", "AB−", "AB+"].map((name) => {
  const abo = name.replace(/[+−]/, "");
  return { name, A: abo.includes("A"), B: abo.includes("B"), D: name.endsWith("+") };
});
const antigensOf = (t) => [t.A && "A", t.B && "B"].filter(Boolean);
const antibodiesOf = (t) => [!t.A && "anti-A", !t.B && "anti-B"].filter(Boolean);

function bloodCheck(mode, d, r) {
  if (mode === "rbc") {
    const bad = antigensOf(d).filter((x) => !r[x]);
    const rh = d.D && !r.D;
    return { ok: !bad.length && !rh, bad, rh };
  }
  // Plasma: the donor's antibodies must not meet the recipient's red-cell antigens.
  const bad = antibodiesOf(d).filter((ab) => r[ab.slice(-1)]);
  return { ok: !bad.length, bad, rh: false };
}

for (const root of document.querySelectorAll("[data-immuno-blood]")) {
  const o = outs(root), cells = [...root.querySelectorAll("[data-d]")];
  let mode = "rbc", sel = [0, 7];

  function explain() {
    const d = BLOOD[sel[0]], r = BLOOD[sel[1]], c = bloodCheck(mode, d, r);
    const ag = antigensOf(d).concat(d.D ? ["RhD"] : []);
    if (mode === "rbc") {
      const lines = [`Donor ${d.name} red cells carry ${ag.length ? ag.join(", ") : "no A, B or RhD antigens"}. Recipient ${r.name} plasma has ${antibodiesOf(r).join(" and ") || "neither anti-A nor anti-B"}.`];
      if (c.bad.length) lines.push(`Their anti-${c.bad.join(" and anti-")} would bind the donor cells: agglutination and a haemolytic reaction. Incompatible.`);
      if (c.rh) lines.push("The recipient is RhD−: RhD+ cells could make them produce anti-D, a danger in later transfusions and pregnancies.");
      if (c.ok) lines.push("Nothing in the recipient's plasma recognises the donor cells: compatible.");
      return lines.join(" ");
    }
    const abs = antibodiesOf(d);
    return `Donor ${d.name} plasma contains ${abs.join(" and ") || "no anti-A or anti-B"}. Recipient ${r.name} red cells carry ${antigensOf(r).join(" and ") || "neither A nor B"}. ` +
      (c.ok ? "The donor's antibodies find no target: compatible." : `The donor's ${c.bad.join(" and ")} would attack the recipient's own red cells. Incompatible.`);
  }
  function draw() {
    let pairs = 0;
    for (const b of cells) {
      const d = +b.dataset.d, r = +b.dataset.r, ok = bloodCheck(mode, BLOOD[d], BLOOD[r]).ok;
      pairs += ok;
      b.toggleAttribute("data-ok", ok);
      b.toggleAttribute("data-sel", d === sel[0] && r === sel[1]);
      b.textContent = ok ? "✓" : "·";
      b.setAttribute("aria-label", `Donor ${BLOOD[d].name} to recipient ${BLOOD[r].name}: ${ok ? "compatible" : "incompatible"}`);
    }
    const all = (fn) => BLOOD.filter(fn).map((t) => t.name).join(", ") || "none";
    o.donor.textContent = all((d) => BLOOD.every((r) => bloodCheck(mode, d, r).ok));
    o.recipient.textContent = all((r) => BLOOD.every((d) => bloodCheck(mode, d, r).ok));
    o.pairs.textContent = `${pairs} / 64`;
    o.why.textContent = explain();
  }
  for (const b of cells) {
    b.addEventListener("click", () => { sel = [+b.dataset.d, +b.dataset.r]; draw(); });
    b.addEventListener("keydown", (e) => {
      const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (!mv) return;
      e.preventDefault();
      const d = Math.max(0, Math.min(7, +b.dataset.d + mv[0])), r = Math.max(0, Math.min(7, +b.dataset.r + mv[1]));
      sel = [d, r];
      draw();
      root.querySelector(`[data-d="${d}"][data-r="${r}"]`).focus();
    });
  }
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  draw();
}

// ============================================================ Serial dilution and titer

for (const root of document.querySelectorAll("[data-immuno-titer]")) {
  const svg = root.querySelector("[data-plot]"), o = outs(root);
  let factor = 2;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { factor = Number(e.detail.value); draw(); });
  const label = (x) => (x < 1e5 ? `1:${Math.round(x).toLocaleString("en-US")}` : `1:10${sup(Math.round(Math.log10(x)))}`);
  const fmtTiter = (t) => (t.below ? `< ${t.first}` : t.all ? `≥ ${Math.round(t.last).toLocaleString("en-US")}` : Math.round(t.value).toLocaleString("en-US"));

  function titer(level, dil) {
    const pos = dil.map((x) => level / x >= 1);
    const k = pos.lastIndexOf(true);
    return { pos, k, value: k >= 0 ? dil[k] : NaN, below: k < 0, all: k === dil.length - 1, first: dil[0], last: dil.at(-1) };
  }

  function draw() {
    const start = s.start.get(), V = s.vol.get();
    const dil = Array.from({ length: 12 }, (_, k) => start * factor ** k);
    const rows = [["acute", titer(s.acute.get(), dil)], ["convalescent", titer(s.conv.get(), dil)]];
    svg.replaceChildren();
    dil.forEach((x, k) => text(svg, 74 + k * 47, 22, label(x), { "text-anchor": "middle", style: "font-size:8.5px" }));
    rows.forEach(([name, t], r) => {
      const cy = 70 + r * 92;
      text(svg, 6, cy - 30, name);
      dil.forEach((x, k) => {
        const cx = 74 + k * 47;
        el("circle", { cx, cy, r: 19, style: "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.3" }, svg);
        if (t.pos[k]) {
          // A mat: cells spread evenly over the well bottom.
          el("circle", { cx, cy, r: 15, style: "fill:var(--code-del);fill-opacity:0.28" }, svg);
          for (let i = 0; i < 14; i++) {
            const a = i * 2.4, rr = 3 + (i % 5) * 2.4;
            el("circle", { cx: cx + rr * Math.cos(a), cy: cy + rr * Math.sin(a), r: 1.3, style: "fill:var(--code-del);fill-opacity:0.6" }, svg);
          }
        } else el("circle", { cx, cy, r: 5, style: "fill:var(--code-del);fill-opacity:0.85" }, svg);
        if (k === t.k) el("circle", { cx, cy, r: 22, style: "fill:none;stroke:var(--brand);stroke-width:2" }, svg);
      });
      text(svg, 74, cy + 36, `titer ${fmtTiter(t)}`, { "text-anchor": "start", style: "fill:var(--foreground)" });
    });
    text(svg, 640 - 6, 222, "mat = agglutination (positive) · button = negative", { "text-anchor": "end" });

    const [t1, t2] = [rows[0][1], rows[1][1]];
    o.t1.textContent = fmtTiter(t1);
    o.t2.textContent = fmtTiter(t2);
    const exact = !t1.below && !t1.all && !t2.below && !t2.all;
    const rise = exact ? t2.value / t1.value : NaN;
    o.rise.textContent = exact ? `${num(rise, rise < 10 ? 1 : 0)}×` : "endpoint not reached: extend the series";
    o.reading.textContent = !exact ? "—" : rise >= 4 ? "≥ 4-fold rise: consistent with recent infection" : "no significant rise";
    const tv = V / (factor - 1);
    o.recipe.textContent = `Well 1: ${num(V + tv, 1)} µL serum at 1:${start} · wells 2–12: ${V} µL diluent · move ${num(tv, 1)} µL along, mixing · discard ${num(tv, 1)} µL from well 12`;
  }
  draw();
}
