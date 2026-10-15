// Biology blocks: cell explorer, translation with the standard genetic
// code, Punnett squares, Wright–Fisher drift, selection, Lotka–Volterra,
// logistic growth and enzyme kinetics. Every curve comes from its equation.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ Cell explorer

for (const root of document.querySelectorAll("[data-bio-cell]")) {
  const picks = [...root.querySelectorAll("[data-pick]")];
  const parts = [...root.querySelectorAll("[data-part]")];
  const name = root.querySelector("[data-info-name]");
  const role = root.querySelector("[data-info-role]");
  const fact = root.querySelector("[data-info-fact]");
  const show = (key) => {
    const p = picks.find((b) => b.dataset.pick === key);
    if (!p) return;
    for (const b of picks) b === p ? (b.dataset.on = "") : delete b.dataset.on;
    for (const g of parts) g.dataset.part === key ? (g.dataset.on = "") : delete g.dataset.on;
    name.textContent = p.dataset.name;
    role.textContent = p.dataset.role;
    fact.textContent = p.dataset.fact;
  };
  for (const g of parts) {
    g.addEventListener("pointerenter", () => show(g.dataset.part));
    g.addEventListener("focus", () => show(g.dataset.part));
  }
  for (const b of picks) b.addEventListener("click", () => show(b.dataset.pick));
}

// ============================================================ Genetic code

// The standard code, bases in the order U C A G: codon index 16·i + 4·j + k.
const BASES = "UCAG";
const AA1 = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const AA3 = { F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", "*": "Stop", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly" };
const codonAA = (rna) => AA1[16 * BASES.indexOf(rna[0]) + 4 * BASES.indexOf(rna[1]) + BASES.indexOf(rna[2])];

/** Translates coding-strand DNA from the first ATG to the first stop. */
function translate(dna) {
  const start = dna.indexOf("ATG");
  if (start < 0) return { start, codons: [] };
  const codons = [];
  for (let i = start; i + 3 <= dna.length; i += 3) {
    const d = dna.slice(i, i + 3);
    const r = d.replaceAll("T", "U");
    const aa = codonAA(r);
    codons.push({ at: i, d, r, aa });
    if (aa === "*") break;
  }
  return { start, codons };
}

for (const root of document.querySelectorAll("[data-bio-translate]")) {
  const input = root.querySelector("[data-seq]");
  const rowOrig = root.querySelector('[data-row="orig"]');
  const rowMut = root.querySelector('[data-row="mut"]');
  const o = outs(root);
  const s = scrubAll(root, () => render());
  const clean = (v) => v.toUpperCase().replace(/[^ACGT]/g, "");
  let original = clean(input.value), mutant = original, changed = -1, kind = "";

  const row = (t, other, changedAt) => {
    if (!t.codons.length) return `<p class="text-sm text-muted-foreground">No ATG start codon.</p>`;
    return `<div class="flex gap-1">` + t.codons.map((c, i) => {
      const diff = other && (!other.codons[i] || other.codons[i].aa !== c.aa);
      const hit = changedAt >= c.at && changedAt < c.at + 3;
      const stop = c.aa === "*";
      return `<div class="flex min-w-14 flex-col items-center gap-0.5 rounded-md border px-1.5 py-1 font-mono ${diff ? "border-brand bg-brand/10" : hit ? "border-foreground/40" : ""}">
        <span class="text-[10px] text-muted-foreground">${esc(c.d)}</span>
        <span class="text-xs">${esc(c.r)}</span>
        <span class="text-xs font-medium ${stop ? "text-del" : ""}">${AA3[c.aa]}</span>
      </div>`;
    }).join("") + (t.codons.at(-1).aa === "*" ? "" : `<span class="self-center px-2 text-xs text-muted-foreground">no stop</span>`) + `</div>`;
  };

  function classify(a, b) {
    if (kind === "ins" || kind === "del") return "frameshift";
    const pa = a.codons.map((c) => c.aa).join(""), pb = b.codons.map((c) => c.aa).join("");
    if (pa === pb) return "silent";
    if (pb.length < pa.length && pb.endsWith("*")) return "nonsense";
    return "missense";
  }

  function render() {
    s.pos.set(Math.min(s.pos.get(), Math.max(1, mutant.length)), false);
    const a = translate(original), b = translate(mutant);
    rowOrig.innerHTML = row(a, null, -1);
    rowMut.innerHTML = row(b, a, changed);
    if (mutant === original) { o.effect.textContent = "No mutation yet. Pick a position and mutate."; return; }
    const pa = a.codons.map((c) => c.aa).join("").replace("*", ""), pb = b.codons.map((c) => c.aa).join("").replace("*", "");
    const what = {
      silent: "Silent: the codon changed but codes for the same amino acid (the code is redundant).",
      missense: "Missense: one amino acid is replaced by another.",
      nonsense: "Nonsense: the change creates a stop codon and the protein is cut short.",
      frameshift: "Frameshift: inserting or deleting one base shifts every codon after it, usually garbling the protein until a stop appears.",
    }[classify(a, b)];
    o.effect.textContent = `${what} Protein: ${pa.length} → ${pb.length} amino acids.`;
  }

  const transition = { A: "G", G: "A", C: "T", T: "C" };
  root.querySelectorAll("[data-mutate]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = Math.round(s.pos.get()) - 1;
      kind = btn.dataset.mutate;
      if (kind === "reset") { mutant = original; changed = -1; kind = ""; }
      else if (kind === "sub") { mutant = mutant.slice(0, i) + transition[mutant[i]] + mutant.slice(i + 1); changed = i; }
      else if (kind === "ins") { mutant = mutant.slice(0, i) + "G" + mutant.slice(i); changed = i; }
      else if (kind === "del") { mutant = mutant.slice(0, i) + mutant.slice(i + 1); changed = i; }
      render();
    }));
  input.addEventListener("input", () => { original = mutant = clean(input.value); changed = -1; kind = ""; render(); });
  render();
}

// ============================================================ Punnett squares

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

for (const root of document.querySelectorAll("[data-bio-punnett]")) {
  const grid = root.querySelector("[data-grid]");
  const pheno = root.querySelector("[data-out=pheno]");
  const sel = (tl) => tl.querySelector('[aria-selected="true"]').dataset.seg;
  root.addEventListener("seg-change", draw);

  function draw() {
    const di = sel(root.querySelector("[data-mode]")) === "di";
    root.querySelectorAll('[data-gene-row="B"]').forEach((r) => (r.hidden = !di));
    const g = (k) => sel(root.querySelector(`[data-geno="${k}"]`));
    const gametes = (p) => {
      const A = [...g(p + "A")];
      if (!di) return A;
      const B = [...g(p + "B")];
      return A.flatMap((a) => B.map((b) => a + b));
    };
    const g1 = gametes("p1"), g2 = gametes("p2");
    // Each cell: a genotype written dominant-first, gene by gene.
    const cross = (x, y) => [...x].map((c, i) => [c, y[i]].sort((u, v) => (u === u.toUpperCase() ? -1 : 1) - (v === v.toUpperCase() ? -1 : 1)).join("")).join(" ");
    const phenotype = (geno) => geno.split(" ").map((pair) => (pair[0] === pair[0].toUpperCase() ? pair[0] + "_" : pair)).join(" ");
    const counts = new Map();
    let html = `<table class="mx-auto border-separate border-spacing-1 font-mono text-sm"><thead><tr><th class="p-1 text-[10px] font-normal text-muted-foreground">♀ \\ ♂</th>${g2.map((x) => `<th class="rounded-md bg-vec-u/10 px-3 py-1.5 font-medium">${esc(x)}</th>`).join("")}</tr></thead><tbody>`;
    for (const x of g1) {
      html += `<tr><th class="rounded-md bg-brand/10 px-3 py-1.5 font-medium">${esc(x)}</th>`;
      for (const y of g2) {
        const geno = cross(x, y), ph = phenotype(geno);
        counts.set(ph, (counts.get(ph) ?? 0) + 1);
        const recessive = !/[A-Z]/.test(geno.replace(/ /g, "")) ? "" : "";
        html += `<td class="rounded-md border bg-background px-3 py-2 text-center ${recessive}">${esc(geno)}</td>`;
      }
      html += "</tr>";
    }
    grid.innerHTML = html + "</tbody></table>";
    const total = g1.length * g2.length;
    const order = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const d = order.reduce((acc, [, n]) => gcd(acc, n), 0);
    const describe = (ph) => ph.split(" ").map((p) => (p.endsWith("_") ? `dominant ${p[0]}` : `recessive ${p[0]}`)).join(", ");
    pheno.innerHTML = order.map(([ph, n]) =>
      `<div class="flex items-center justify-between gap-3"><span>${esc(ph)} <span class="text-muted-foreground">${esc(describe(ph))}</span></span><span class="tabular-nums">${n}/${total}</span></div>`).join("") +
      `<div class="mt-1 border-t pt-1 text-muted-foreground">ratio ${order.map(([, n]) => n / d).join(" : ")}</div>`;
  }
  draw();
}

// ============================================================ Wright–Fisher drift

const PALETTE = ["var(--brand)", "var(--vec-u)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)"];

for (const root of document.querySelectorAll("[data-bio-drift]")) {
  const svg = root.querySelector("[data-plot]");
  const hw = root.querySelector("[data-hw]");
  const o = outs(root);
  let seed = 1;
  const s = scrubAll(root, draw);
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; draw(); });

  function draw() {
    const N = Math.round(s.n.get()), p0 = s.p0.get(), G = Math.round(s.gens.get());
    const rng = mulberry32(seed * 7919 + N);
    const runs = [];
    for (let r = 0; r < 12; r++) {
      let p = p0;
      const path = [p];
      for (let t = 0; t < G; t++) {
        if (p > 0 && p < 1) {
          // 2N gene copies, each drawn from the parents' pool.
          let k = 0;
          for (let i = 0; i < 2 * N; i++) if (rng() < p) k++;
          p = k / (2 * N);
        }
        path.push(p);
      }
      runs.push(path);
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 504, 250], x: [0, G], y: [0, 1], xticks: [0, Math.round(G / 2), G], yticks: [0, 0.5, 1], xlabel: "generation", ylabel: "p" });
    hline(svg, f, p0, "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4");
    runs.forEach((path, i) => polyline(svg, path.map((p, t) => [f.sx(t), f.sy(p)]), `stroke:${PALETTE[i % PALETTE.length]};stroke-width:1.4;stroke-opacity:0.85`));
    const ends = runs.map((r) => r.at(-1));
    o.fixed.textContent = `${ends.filter((p) => p === 1).length} / 12`;
    o.lost.textContent = `${ends.filter((p) => p === 0).length} / 12`;
    o.seg.textContent = `${ends.filter((p) => p > 0 && p < 1).length} / 12`;
    o.mean.textContent = num(ends.reduce((a, b) => a + b, 0) / 12, 3);

    const q = 1 - p0;
    const seg = (label, f, color) =>
      `<div class="flex items-center justify-center overflow-hidden whitespace-nowrap" style="width:${(f * 100).toFixed(2)}%;background:color-mix(in oklab, ${color} 22%, transparent)">${f > 0.08 ? `${label} ${num(f * 100, 1)}%` : ""}</div>`;
    hw.innerHTML = seg("AA", p0 * p0, "var(--brand)") + seg("Aa", 2 * p0 * q, "var(--vec-out)") + seg("aa", q * q, "var(--vec-u)");
    hw.title = `Hardy–Weinberg at p = ${p0}: AA ${num(p0 * p0, 3)}, Aa ${num(2 * p0 * q, 3)}, aa ${num(q * q, 3)}`;
  }
  draw();
}

// ============================================================ Selection

for (const root of document.querySelectorAll("[data-bio-selection]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const [a, ab, bb] = b.dataset.preset.split(" ").map(Number);
      s.waa.set(a, false); s.wab.set(ab, false); s.wbb.set(bb, false);
      draw();
    }));

  function draw() {
    const wAA = s.waa.get(), wAa = s.wab.get(), waa = s.wbb.get(), G = Math.round(s.gens.get());
    let p = s.p0.get();
    const path = [p];
    for (let t = 0; t < G; t++) {
      const q = 1 - p;
      const wbar = p * p * wAA + 2 * p * q * wAa + q * q * waa;
      p = wbar > 0 ? (p * (p * wAA + q * wAa)) / wbar : p;
      path.push(p);
    }
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 504, 250], x: [0, G], y: [0, 1], xticks: [0, Math.round(G / 2), G], yticks: [0, 0.5, 1], xlabel: "generation", ylabel: "p (A)" });
    polyline(svg, path.map((v, t) => [f.sx(t), f.sy(v)]), "stroke:var(--brand);stroke-width:2");
    o.pend.textContent = num(path.at(-1), 3);
    const denom = 2 * wAa - wAA - waa;
    let eq;
    if (wAa > wAA && wAa > waa) eq = `stable at p* = ${num((wAa - waa) / denom, 3)} (heterozygote advantage)`;
    else if (wAa < wAA && wAa < waa) eq = `unstable at p* = ${num((wAa - waa) / denom, 3)} (heterozygote disadvantage)`;
    else if (wAA === wAa && wAa === waa) eq = "none: no selection";
    else eq = wAA >= waa ? "A fixes (p → 1)" : "a fixes (p → 0)";
    o.eq.textContent = eq;
    if (wAa > wAA && wAa > waa) hline(svg, f, (wAa - waa) / denom, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4", "p*");
  }
  draw();
}

// ============================================================ Lotka–Volterra

for (const root of document.querySelectorAll("[data-bio-lv]")) {
  const tSvg = root.querySelector("[data-time]");
  const pSvg = root.querySelector("[data-phase]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const a = s.alpha.get(), b = s.beta.get(), d = s.delta.get(), g = s.gamma.get();
    const T = 60, dt = 0.005;
    const fdx = (x, y) => [a * x - b * x * y, d * x * y - g * y];
    let x = s.x0.get(), y = s.y0.get();
    const V = (x, y) => d * x - g * Math.log(x) + b * y - a * Math.log(y);
    const V0 = V(x, y);
    const pts = [[0, x, y]];
    for (let i = 1, t = 0; t < T; i++) {
      const k1 = fdx(x, y);
      const k2 = fdx(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1]);
      const k3 = fdx(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1]);
      const k4 = fdx(x + dt * k3[0], y + dt * k3[1]);
      x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      t = i * dt;
      if (i % 20 === 0) pts.push([t, x, y]);
    }
    const top = Math.max(...pts.map((p) => Math.max(p[1], p[2]))) * 1.1;
    tSvg.replaceChildren();
    const f = frame(tSvg, { box: [36, 12, 352, 230], x: [0, T], y: [0, top], xticks: [0, 20, 40, 60], yticks: [0, Math.round(top / 2), Math.round(top)], xlabel: "time" });
    polyline(tSvg, pts.map((p) => [f.sx(p[0]), f.sy(p[1])]), "stroke:var(--vec-u);stroke-width:1.75");
    polyline(tSvg, pts.map((p) => [f.sx(p[0]), f.sy(p[2])]), "stroke:var(--brand);stroke-width:1.75");

    pSvg.replaceChildren();
    const xm = Math.max(...pts.map((p) => p[1])) * 1.1, ym = Math.max(...pts.map((p) => p[2])) * 1.1;
    const q = frame(pSvg, { box: [36, 12, 212, 230], x: [0, xm], y: [0, ym], xticks: [0, Math.round(xm)], yticks: [0, Math.round(ym)], xlabel: "prey x", ylabel: "y" });
    polyline(pSvg, pts.map((p) => [q.sx(p[1]), q.sy(p[2])]), "stroke:var(--foreground);stroke-width:1.5");
    const ex = g / d, ey = a / b;
    if (ex < xm && ey < ym) el("circle", { cx: q.sx(ex), cy: q.sy(ey), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.75" }, pSvg);

    // Period: time between successive prey maxima.
    const peaks = [];
    for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] > pts[i - 1][1] && pts[i][1] >= pts[i + 1][1]) peaks.push(pts[i][0]);
    o.eq.textContent = `x = ${num(ex, 1)}, y = ${num(ey, 1)}`;
    o.period.textContent = peaks.length > 1 ? num(peaks.at(-1) - peaks.at(-2), 2) : "—";
    o.drift.textContent = `${((Math.abs(V(x, y) - V0) / Math.abs(V0)) * 100).toExponential(1)} %`;
  }
  draw();
}

// ============================================================ Logistic growth

for (const root of document.querySelectorAll("[data-bio-logistic]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const r = s.r.get(), K = s.k.get(), N0 = Math.min(s.n0.get(), K * 0.99);
    const logistic = (t) => K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
    const tstar = N0 < K / 2 ? Math.log((K - N0) / N0) / r : 0;
    const T = Math.max(10, Math.ceil((tstar + 6 / r) / 5) * 5);
    const ts = Array.from({ length: 301 }, (_, i) => (i * T) / 300);
    svg.replaceChildren();
    const top = K * 1.25;
    const f = frame(svg, { box: [48, 14, 496, 250], x: [0, T], y: [0, top], xticks: [0, T / 2, T], yticks: [0, K / 2, K], xlabel: "years", ylabel: "N", yfmt: (v) => num(v, 0) });
    hline(svg, f, K, "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4", "K");
    const exp = ts.map((t) => [t, N0 * Math.exp(r * t)]).filter(([, n]) => n <= top);
    polyline(svg, exp.map(([t, n]) => [f.sx(t), f.sy(n)]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 4");
    // Growth rate, scaled so its maximum rK/4 sits at K/2 on the axis.
    const scale = (K / 2) / (r * K / 4);
    polyline(svg, ts.map((t) => { const n = logistic(t); return [f.sx(t), f.sy(r * n * (1 - n / K) * scale)]; }), "stroke:var(--vec-u);stroke-width:1.25;stroke-opacity:0.8");
    polyline(svg, ts.map((t) => [f.sx(t), f.sy(logistic(t))]), "stroke:var(--foreground);stroke-width:2");
    if (tstar > 0) el("circle", { cx: f.sx(tstar), cy: f.sy(K / 2), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    o.tstar.textContent = tstar > 0 ? `t = ${num(tstar, 1)} y (N = K/2)` : "already past K/2";
    o.maxrate.textContent = `${num((r * K) / 4, 1)} per year`;
    o.double.textContent = `${num(Math.LN2 / r, 2)} years`;
  }
  draw();
}

// ============================================================ Enzyme kinetics

for (const root of document.querySelectorAll("[data-bio-enzyme]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "competitive", lb = false;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  onToggle(root, (_, on) => { lb = on; draw(); });

  function draw() {
    const V = s.vmax.get(), Km = s.km.get(), i = s.inh.get();
    const f1 = 1 + i;
    const [Vi, Ki] = mode === "competitive" ? [V, Km * f1] : mode === "noncompetitive" ? [V / f1, Km] : [V / f1, Km / f1];
    svg.replaceChildren();
    if (!lb) {
      const Smax = Math.max(20, 6 * Ki);
      const f = frame(svg, { box: [48, 14, 496, 250], x: [0, Smax], y: [0, V * 1.15], xticks: [0, Smax / 2, Smax], yticks: [0, V / 2, V], xlabel: "[S] (mM)", ylabel: "v (µM/s)", xfmt: (v) => num(v, 0), yfmt: (v) => num(v, 1) });
      hline(svg, f, V, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4", "V_max");
      const curve = (Vm, K) => Array.from({ length: 201 }, (_, k) => { const S = (k * Smax) / 200; return [f.sx(S), f.sy((Vm * S) / (K + S))]; });
      if (i > 0) polyline(svg, curve(Vi, Ki), "stroke:var(--brand);stroke-width:2;stroke-dasharray:6 4");
      polyline(svg, curve(V, Km), "stroke:var(--foreground);stroke-width:2");
      el("line", { x1: f.sx(Km), x2: f.sx(Km), y1: f.sy(V / 2), y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
      el("circle", { cx: f.sx(Km), cy: f.sy(V / 2), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    } else {
      // 1/v = (K_m/V_max)(1/[S]) + 1/V_max: straight lines.
      const xMin = -1.2 / Math.min(Km, Ki), xMax = 2;
      const line = (Vm, K) => [[xMin, K / Vm * xMin + 1 / Vm], [xMax, K / Vm * xMax + 1 / Vm]];
      const ys = [...line(V, Km), ...line(Vi, Ki)].map((p) => p[1]);
      const yMax = Math.max(...ys) * 1.1, yMin = Math.min(0, ...ys);
      const f = frame(svg, { box: [48, 14, 496, 250], x: [xMin, xMax], y: [yMin, yMax], xticks: [Math.round(xMin * 10) / 10, 0, 1, 2], yticks: [0, Math.round(yMax * 50) / 100], xlabel: "1/[S] (1/mM)", ylabel: "1/v", xfmt: (v) => num(v, 1), yfmt: (v) => num(v, 2) });
      el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4" }, svg);
      hline(svg, f, 0, "stroke:currentColor;stroke-opacity:0.4");
      if (i > 0) polyline(svg, line(Vi, Ki).map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:2;stroke-dasharray:6 4");
      polyline(svg, line(V, Km).map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-width:2");
      for (const [Vm, K] of [[V, Km], [Vi, Ki]]) {
        el("circle", { cx: f.sx(-1 / K), cy: f.sy(0), r: 3, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.25" }, svg);
        el("circle", { cx: f.sx(0), cy: f.sy(1 / Vm), r: 3, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.25" }, svg);
      }
    }
    o.vapp.textContent = `${num(Vi, 2)} µM/s`;
    o.kapp.textContent = `${num(Ki, 2)} mM`;
  }
  draw();
}
