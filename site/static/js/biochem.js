// Biochemistry blocks: buffers, charge, absorbance, hydropathy, backbone
// angles, oxygen binding, DNA melting, SDS-PAGE, free energy and the ATP
// budget. Constants are cited in each block's note.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
// seg-change events carry the tablist's aria-label so a block can tell its controls apart.
const onSeg = (root, fn) =>
  root.addEventListener("seg-change", (e) => fn(e.target.getAttribute("aria-label"), e.detail.value));
const setSeg = (root, label, value) => {
  const list = root.querySelector(`[role=tablist][aria-label="${label}"]`);
  for (const b of list?.querySelectorAll("[data-seg]") ?? []) b.setAttribute("aria-selected", String(b.dataset.seg === value));
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sign = (v, d = 2) => (v > 0 ? "+" : "") + num(v, d);
const fmt = (v) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return a >= 1000 ? Math.round(v).toLocaleString("en") : a >= 100 ? num(v, 0) : a >= 10 ? num(v, 1) : a >= 0.1 ? num(v, 2) : v.toPrecision(2);
};
const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(6)); return o; };
const cleanProtein = (s) => {
  const up = s.toUpperCase().replace(/\s+/g, "");
  const seq = up.replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
  return { seq, dropped: up.length - seq.length };
};

// ============================================================ buffers

const BUFFERS = {
  phosphate: { pka: 7.21, acid: ["NaH₂PO₄·H₂O", 137.99], base: ["Na₂HPO₄", 141.96] },
  acetate: { pka: 4.76, acid: ["acetic acid", 60.05], base: ["sodium acetate·3H₂O", 136.08] },
  tris: { pka: 8.07, acid: ["Tris-HCl", 157.6], base: ["Tris base", 121.14] },
  hepes: { pka: 7.5, acid: ["HEPES (free acid)", 238.3], base: ["HEPES sodium salt", 260.29] },
};

for (const root of document.querySelectorAll("[data-biochem-buffer]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let buf = "phosphate";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { buf = v; draw(); });

  function draw() {
    const B = BUFFERS[buf], pH = s.ph.get(), C = s.conc.get() / 1000, V = s.vol.get() / 1000;
    const Ka = 10 ** -B.pka, Kw = 1e-14;
    const beta = (p) => { const H = 10 ** -p; return 2.303 * ((C * Ka * H) / (Ka + H) ** 2 + H + Kw / H); };
    const x0 = Math.max(0, Math.floor(B.pka - 4)), x1 = Math.min(14, x0 + 8);
    const xs = range(x0, x1, 0.02);
    const bmax = Math.max(...xs.map(beta));
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 520, 236], x: [x0, x1], y: [0, 1], xticks: range(x0, x1, 1), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => num(v, 2), xlabel: "pH", ylabel: "fraction · β / β max" });
    // The useful range, pKa ± 1.
    el("rect", { x: f.sx(Math.max(x0, B.pka - 1)), y: f.T, width: f.sx(Math.min(x1, B.pka + 1)) - f.sx(Math.max(x0, B.pka - 1)), height: f.H, style: "fill:var(--brand);fill-opacity:0.06" }, svg);
    const fb = (p) => 1 / (1 + 10 ** (B.pka - p));
    polyline(svg, xs.map((p) => [f.sx(p), f.sy(1 - fb(p))]), "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, xs.map((p) => [f.sx(p), f.sy(fb(p))]), "stroke:var(--vec-v);stroke-width:2");
    polyline(svg, xs.map((p) => [f.sx(p), f.sy(beta(p) / bmax)]), "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:5 4");
    text(svg, f.sx(B.pka) + 8, f.T + 12, `pKa ${num(B.pka, 2)}`, { "text-anchor": "start", class: "fill-foreground font-mono text-[10px]" });
    if (pH >= x0 && pH <= x1) {
      el("line", { x1: f.sx(pH), x2: f.sx(pH), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:2 3" }, svg);
      for (const [y, c] of [[1 - fb(pH), "var(--vec-u)"], [fb(pH), "var(--vec-v)"]])
        el("circle", { cx: f.sx(pH), cy: f.sy(y), r: 4, style: `fill:var(--background);stroke:${c};stroke-width:2` }, svg);
    }
    const r = 10 ** (pH - B.pka), n = C * V;
    const nb = (n * r) / (1 + r), na = n - nb;
    const grams = (mol, mw) => { const g = mol * mw; return g >= 1 ? `${num(g, 2)} g` : `${num(g * 1000, 1)} mg`; };
    o.pka.textContent = num(B.pka, 2);
    o.ratio.textContent = r >= 100 || r < 0.01 ? r.toExponential(1) : num(r, 2);
    o.acid.textContent = `${grams(na, B.acid[1])} ${B.acid[0]}`;
    o.base.textContent = `${grams(nb, B.base[1])} ${B.base[0]}`;
    o.beta.textContent = `${fmt(beta(pH) * 1000)} mM/pH`;
    const off = Math.abs(pH - B.pka);
    o.verdict.textContent = off <= 1 ? "good: within 1 of the pKa" : off <= 1.5 ? "weak: near the edge" : "poor: pick another buffer";
  }
  draw();
}

// ============================================================ net charge

// Lehninger table 3-1: [α-COOH, α-NH3+, side chain] at 25 °C.
const PKA = {
  G: [2.34, 9.6], A: [2.34, 9.69], P: [1.99, 10.96], V: [2.32, 9.62], L: [2.36, 9.6], I: [2.36, 9.68],
  M: [2.28, 9.21], F: [1.83, 9.13], Y: [2.2, 9.11, 10.07], W: [2.38, 9.39], S: [2.21, 9.15], T: [2.11, 9.62],
  C: [1.96, 10.28, 8.18], N: [2.02, 8.8], Q: [2.17, 9.13], K: [2.18, 8.95, 10.53], H: [1.82, 9.17, 6.0],
  R: [2.17, 9.04, 12.48], D: [1.88, 9.6, 3.65], E: [2.19, 9.67, 4.25],
};
const POSITIVE = new Set(["K", "H", "R"]);

function groupsOf(seq, bonded = false) {
  if (!seq) return [];
  const g = [{ pka: PKA[seq[0]][1], pos: true, name: "N-term" }, { pka: PKA[seq[seq.length - 1]][0], pos: false, name: "C-term" }];
  // Cysteines in disulfide bonds have no thiol left to ionize.
  for (const a of seq) if (PKA[a][2] !== undefined && !(bonded && a === "C")) g.push({ pka: PKA[a][2], pos: POSITIVE.has(a), name: a });
  return g;
}
const chargeAt = (g, pH) => g.reduce((q, x) => q + (x.pos ? 1 / (1 + 10 ** (pH - x.pka)) : -1 / (1 + 10 ** (x.pka - pH))), 0);
function isoelectric(g) {
  let lo = 0, hi = 14;
  if (chargeAt(g, lo) <= 0 || chargeAt(g, hi) >= 0) return NaN;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; chargeAt(g, m) > 0 ? (lo = m) : (hi = m); }
  return (lo + hi) / 2;
}

const CHARGE_EXAMPLES = { G: "G", H: "H", D: "D", lys: null, pep: "DRVYIHPF" };

for (const root of document.querySelectorAll("[data-biochem-charge]")) {
  const svg = root.querySelector("[data-plot]");
  const ta = root.querySelector("[data-seq]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let bonded = false;
  ta.addEventListener("input", draw);
  onSeg(root, (label, v) => {
    if (label === "Cysteines") bonded = v === "ss";
    else {
      ta.value = CHARGE_EXAMPLES[v] ?? LYSOZYME;
      bonded = v === "lys";
      setSeg(root, "Cysteines", bonded ? "ss" : "free");
    }
    draw();
  });

  function draw() {
    const { seq, dropped } = cleanProtein(ta.value);
    const pH = s.ph.get();
    svg.replaceChildren();
    if (!seq) { o.n.textContent = "type a sequence"; o.pi.textContent = o.q.textContent = o.groups.textContent = "—"; return; }
    const g = groupsOf(seq, bonded);
    const xs = range(0, 14, 0.05);
    const qs = xs.map((p) => chargeAt(g, p));
    const top = Math.max(1, Math.ceil(Math.max(...qs))), bot = Math.min(-1, Math.floor(Math.min(...qs)));
    const step = (top - bot) / 6 > 2 ? Math.ceil((top - bot) / 6 / 5) * 5 : (top - bot) > 4 ? 1 : 0.5;
    const f = frame(svg, { box: [44, 16, 560, 240], x: [0, 14], y: [bot, top], xticks: range(0, 14, 2), yticks: range(bot, top, step), yfmt: (v) => sign(v, step < 1 ? 1 : 0), xlabel: "pH", ylabel: "net charge" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    polyline(svg, xs.map((p, i) => [f.sx(p), f.sy(qs[i])]), "stroke:var(--foreground);stroke-width:2");
    const pI = isoelectric(g);
    if (Number.isFinite(pI)) {
      el("line", { x1: f.sx(pI), x2: f.sx(pI), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-dasharray:4 3" }, svg);
      text(svg, f.sx(pI) + (pI > 11 ? -5 : 5), f.T + 12, `pI ${num(pI, 2)}`, { "text-anchor": pI > 11 ? "end" : "start", class: "fill-foreground font-mono text-[10px]" });
    }
    const q = chargeAt(g, pH);
    el("circle", { cx: f.sx(pH), cy: f.sy(q), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    const counts = {};
    for (const x of g.slice(2)) counts[x.name] = (counts[x.name] ?? 0) + 1;
    o.n.textContent = seq.length + (dropped ? ` (${dropped} other chars ignored)` : "");
    o.pi.textContent = Number.isFinite(pI) ? num(pI, 2) : "—";
    o.q.textContent = sign(q, 2);
    o.groups.textContent = ["D", "E", "C", "Y", "H", "K", "R"].filter((k) => counts[k]).map((k) => `${k} ${counts[k]}`).join(" · ") || "termini only";
  }
  draw();
}

// ============================================================ A280

// Average residue masses (Da); a chain adds one water.
const MASS = {
  G: 57.05, A: 71.08, S: 87.08, P: 97.12, V: 99.13, T: 101.1, C: 103.14, L: 113.16, I: 113.16, N: 114.1,
  D: 115.09, Q: 128.13, K: 128.17, E: 129.12, M: 131.19, H: 137.14, F: 147.18, R: 156.19, Y: 163.18, W: 186.21,
};
const LYSOZYME = "KVFGRCELAAAMKRHGLDNYRGYSLGNWVCAAKFESNFNTQATNRNTDGSTDYGILQINSRWWCNDGRTPGSRNLCNIPCSALLSSDITASVNCAKKIVSDGNGMNAWVAWRNRCKGTDVQAWIRGCRL";
const massOf = (seq) => [...seq].reduce((m, a) => m + MASS[a], 18.02);

for (const root of document.querySelectorAll("[data-biochem-a280]")) {
  const svg = root.querySelector("[data-plot]");
  const ta = root.querySelector("[data-seq]");
  const comp = root.querySelector("[data-composition]");
  const o = outs(root);
  let paired = true;
  const s = scrubAll(root, draw);
  ta.addEventListener("input", draw);
  onSeg(root, (_, v) => { paired = v === "ox"; draw(); });

  function chip(label, value, color) {
    const c = document.createElement("span");
    c.className = "flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-muted-foreground";
    const dot = document.createElement("span");
    dot.className = "size-2 rounded-full";
    dot.style.background = color;
    const t = document.createElement("span");
    t.textContent = `${label} ${value}`;
    c.append(dot, t);
    return c;
  }

  function draw() {
    const { seq } = cleanProtein(ta.value);
    const cnt = (a) => [...seq].filter((x) => x === a).length;
    const W = cnt("W"), Y = cnt("Y"), C = cnt("C");
    const cys = paired ? Math.floor(C / 2) : 0;
    const parts = [["Trp", W * 5500, "var(--vec-u)"], ["Tyr", Y * 1490, "var(--vec-v)"], ["cystine", cys * 125, "var(--brand)"]];
    const eps = parts.reduce((t, p) => t + p[1], 0);
    const mw = seq ? massOf(seq) : NaN;
    comp.replaceChildren(chip("length", seq.length, "var(--muted-foreground)"), chip("W", W, "var(--vec-u)"), chip("Y", Y, "var(--vec-v)"), chip("C", C, "var(--brand)"));

    svg.replaceChildren();
    const L = 8, R = 632, y = 46, hgt = 26;
    text(svg, L, 22, "Share of ε280", {});
    if (eps > 0) {
      let x = L;
      for (const [name, v, color] of parts) {
        if (!v) continue;
        const w = ((R - L) * v) / eps;
        el("rect", { x, y, width: Math.max(1, w - 2), height: hgt, rx: 3, style: `fill:${color};fill-opacity:0.8` }, svg);
        if (w > 60) text(svg, x + 6, y + hgt + 16, `${name} ${Math.round((100 * v) / eps)}%`, { class: "fill-foreground font-mono text-[10px]" });
        x += w;
      }
    } else {
      el("rect", { x: L, y, width: R - L, height: hgt, rx: 3, style: "fill:none;stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:4 3" }, svg);
      text(svg, (L + R) / 2, y + hgt / 2 + 4, "no Trp or Tyr: invisible at 280 nm", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    }

    const A = s.abs.get(), l = s.path.get();
    o.wyc.textContent = `${W} · ${Y} · ${cys}`;
    o.eps.textContent = eps ? `${eps.toLocaleString("en")} M⁻¹cm⁻¹` : "0";
    o.mw.textContent = seq ? `${fmt(mw)} Da` : "—";
    o.abs01.textContent = eps && seq ? num(eps / mw, 3) : "—";
    const M = eps ? A / (eps * l) : NaN;
    o.molar.textContent = Number.isFinite(M) ? `${fmt(M * 1e6)} µM` : "—";
    o.mgml.textContent = Number.isFinite(M) && seq ? `${num(M * mw, 3)} mg/mL` + (A > 1.5 ? " (dilute!)" : "") : "—";
  }
  draw();
}

// ============================================================ hydropathy

// Kyte & Doolittle (1982).
const KD = {
  I: 4.5, V: 4.2, L: 3.8, F: 2.8, C: 2.5, M: 1.9, A: 1.8, G: -0.4, T: -0.7, S: -0.8,
  W: -0.9, Y: -1.3, P: -1.6, H: -3.2, E: -3.5, Q: -3.5, D: -3.5, N: -3.5, K: -3.9, R: -4.5,
};
// Synthetic teaching sequences: hydrophobic 21-mers between polar loops.
const HELICES = ["LIVAFLLGAVIALFLVGLIAV", "AVLFIGLMVAILSLFAVLIGA", "FLAIVGLLWAVFIALGVLMIL", "IGALVFLAVILGTLFVAMLAI", "VLLAFGIVAMLIAGFLLVSAI", "LAVIFGLLAMVIGFLAVLAIW", "GIFLVAALIVGMLFAVLSIAL"];
const LOOPS = ["MSEQKTDRNGSPEKDQ", "KDPNGSREQTDKNERS", "TRDKNGEPSQKDRNES", "QSNDKRGTEPDKSQNR", "EKPDGNRSTQEDKRSN", "SRNDKGTEPQNDERKS", "NKDGRSPEQTKDNRSE", "GSKDERNQTPSKEDR"];
const HYDRO_EXAMPLES = {
  tm7: LOOPS[0] + HELICES.map((hx, i) => hx + LOOPS[i + 1]).join(""),
  tm1: "MSDEKRPTNGSQEDKNRSTPEGKDSQNRTEKPDSGNKERQTDSPKNGEDRSQTKPNDEGSR" + "LLAVIFGLMIAVLGAFIVLAL" + "KRRSEDNGTPQKDESRNGKTPEDQSRKNDGETPSKQRDNEGSTKPQ",
  lys: null,
};

for (const root of document.querySelectorAll("[data-biochem-hydro]")) {
  const svg = root.querySelector("[data-plot]");
  const ta = root.querySelector("[data-seq]");
  const o = outs(root);
  ta.value = HYDRO_EXAMPLES.tm7;
  const s = scrubAll(root, draw);
  ta.addEventListener("input", draw);
  onSeg(root, (_, v) => { ta.value = HYDRO_EXAMPLES[v] ?? LYSOZYME; draw(); });

  function draw() {
    const { seq } = cleanProtein(ta.value);
    const win = Math.round(s.win.get()) | 1, half = (win - 1) / 2, thr = s.thr.get();
    svg.replaceChildren();
    const n = seq.length;
    o.n.textContent = String(n);
    o.gravy.textContent = n ? sign([...seq].reduce((t, a) => t + KD[a], 0) / n, 3) : "—";
    if (n < win) {
      const f = frame(svg, { box: [40, 16, 580, 220], x: [1, Math.max(win, 2)], y: [-4, 4], yticks: [-4, -2, 0, 2, 4], yfmt: (v) => sign(v, 0), xlabel: "residue", ylabel: "hydropathy" });
      text(svg, f.L + f.W / 2, f.T + f.H / 2, `need at least ${win} residues`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      o.segs.textContent = "—"; o.where.textContent = "—";
      return;
    }
    // Window averages, centred on each residue (1-based positions).
    const pts = [];
    let sum = 0;
    for (let i = 0; i < win; i++) sum += KD[seq[i]];
    pts.push([half + 1, sum / win]);
    for (let i = win; i < n; i++) { sum += KD[seq[i]] - KD[seq[i - win]]; pts.push([i - half + 1, sum / win]); }
    const f = frame(svg, { box: [40, 16, 580, 220], x: [1, n], y: [-4, 4], xticks: tickAt(n), yticks: [-4, -2, 0, 2, 4], yfmt: (v) => sign(v, 0), xlabel: "residue", ylabel: "hydropathy" });
    // Runs above the threshold become segments spanning their windows.
    const segs = [];
    let start = null;
    pts.forEach(([p, v], i) => {
      if (v > thr && start === null) start = p;
      if ((v <= thr || i === pts.length - 1) && start !== null) { const end = v > thr ? p : pts[i - 1][0]; segs.push([Math.max(1, start - (half >> 1)), Math.min(n, end + (half >> 1))]); start = null; }
    });
    for (const [a, b] of segs) el("rect", { x: f.sx(a), y: f.T, width: Math.max(1, f.sx(b) - f.sx(a)), height: f.H, style: "fill:var(--brand);fill-opacity:0.1" }, svg);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(thr), y2: f.sy(thr), style: "stroke:var(--brand);stroke-dasharray:5 4" }, svg);
    text(svg, f.L + f.W - 2, f.sy(thr) - 4, `threshold ${num(thr, 1)}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    polyline(svg, pts.map(([p, v]) => [f.sx(p), f.sy(Math.max(-4, Math.min(4, v)))]), "stroke:var(--foreground);stroke-width:1.75");
    o.segs.textContent = String(segs.length);
    o.where.textContent = segs.length ? segs.map(([a, b]) => `${a}–${b}`).join(", ") : "none: likely soluble";
  }
  draw();
}

function tickAt(n) {
  const step = n > 400 ? 100 : n > 200 ? 50 : n > 80 ? 20 : n > 30 ? 10 : 5;
  return range(step, n, step);
}

// ============================================================ Ramachandran

// Hand-drawn region sketches in (φ, ψ) degrees for a general residue.
const RAMA_GENERAL = [
  { name: "β region", fav: true, pts: [[-180, 180], [-45, 180], [-45, 150], [-60, 115], [-95, 100], [-150, 100], [-180, 115]] },
  { name: "β region", fav: true, pts: [[-180, -180], [-45, -180], [-45, -170], [-180, -168]] },
  { name: "right-handed helix", fav: true, pts: [[-105, -10], [-45, -10], [-35, -30], [-45, -72], [-80, -78], [-112, -48]] },
  { name: "bridge / allowed", fav: false, pts: [[-180, 180], [-30, 180], [-30, 120], [-50, 60], [-30, 0], [-25, -40], [-40, -82], [-95, -85], [-150, -60], [-180, -40]] },
  { name: "β region", fav: false, pts: [[-180, -180], [-40, -180], [-40, -158], [-180, -150]] },
  { name: "left-handed helix", fav: false, pts: [[42, 18], [72, 18], [82, 58], [64, 92], [46, 72], [38, 42]] },
];
const RAMA_PRO = [
  { name: "polyproline / β", fav: true, pts: [[-82, 115], [-50, 115], [-50, 180], [-82, 180]] },
  { name: "right-handed helix", fav: true, pts: [[-82, -55], [-50, -55], [-50, -15], [-82, -15]] },
  { name: "allowed", fav: false, pts: [[-95, 60], [-40, 60], [-40, 180], [-95, 180]] },
  { name: "allowed", fav: false, pts: [[-95, -70], [-40, -70], [-40, 10], [-95, 10]] },
  { name: "allowed", fav: false, pts: [[-95, -180], [-40, -180], [-40, -160], [-95, -160]] },
];
const mirror = (rs) => rs.map((r) => ({ ...r, name: r.name.replace("right-handed", "left-handed (mirror)"), pts: r.pts.map(([a, b]) => [-a, -b]) }));
const RAMA = {
  general: RAMA_GENERAL,
  gly: [...RAMA_GENERAL.map((r) => ({ ...r, fav: r.fav || r.name === "left-handed helix" })), ...mirror(RAMA_GENERAL.filter((r) => r.name !== "left-handed helix"))],
  pro: RAMA_PRO,
};
const RAMA_PRESETS = {
  alpha: { phi: -57, psi: -47, label: "α", turn: "3.6", rise: "1.50 Å" },
  310: { phi: -49, psi: -26, label: "3₁₀", turn: "3.0", rise: "2.0 Å" },
  pi: { phi: -57, psi: -70, label: "π", turn: "4.4", rise: "1.15 Å" },
  anti: { phi: -139, psi: 135, label: "β↑↓", turn: "2 (flat zig-zag)", rise: "3.4 Å" },
  par: { phi: -119, psi: 113, label: "β↑↑", turn: "2 (flat zig-zag)", rise: "3.2 Å" },
  ppii: { phi: -75, psi: 145, label: "PPII", turn: "3.0 (left-handed)", rise: "3.1 Å" },
  left: { phi: 57, psi: 47, label: "αL", turn: "3.6 (left-handed)", rise: "1.50 Å" },
  clash: { phi: 0, psi: 0, label: "", turn: "—", rise: "—" },
};

function inside([x, y], pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

for (const root of document.querySelectorAll("[data-biochem-rama]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let res = "general", phi = -57, psi = -47;
  const box = [44, 12, 364, 364];
  const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  onSeg(root, (_, v) => { res = v; draw(); });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = RAMA_PRESETS[b.dataset.preset];
    phi = p.phi; psi = p.psi; draw();
  }));
  const toAngles = (e) => {
    const r = svg.getBoundingClientRect(), k = 420 / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    phi = Math.round(Math.max(-180, Math.min(180, -180 + ((x - box[0]) / box[2]) * 360)));
    psi = Math.round(Math.max(-180, Math.min(180, 180 - ((y - box[1]) / box[3]) * 360)));
    draw();
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); toAngles(e); });
  svg.addEventListener("pointermove", (e) => dragging && toAngles(e));
  svg.addEventListener("pointerup", () => (dragging = false));
  svg.addEventListener("keydown", (e) => {
    const d = e.shiftKey ? 30 : 5;
    const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (!k) return;
    e.preventDefault();
    phi = wrap(phi + k[0]); psi = wrap(psi + k[1]); draw();
  });

  function draw() {
    svg.replaceChildren();
    const f = frame(svg, { box, x: [-180, 180], y: [-180, 180], xticks: [-180, -90, 0, 90, 180], yticks: [-180, -90, 0, 90, 180], xfmt: (v) => num(v, 0), yfmt: (v) => num(v, 0), xlabel: "φ (°)", ylabel: "ψ (°)" });
    const regions = RAMA[res];
    const path = (pts) => pts.map(([a, b], i) => `${i ? "L" : "M"}${f.sx(a).toFixed(1)},${f.sy(b).toFixed(1)}`).join("") + "Z";
    for (const r of regions.filter((r) => !r.fav)) el("path", { d: path(r.pts), style: "fill:var(--vec-v);fill-opacity:0.16;stroke:var(--vec-v);stroke-opacity:0.5;stroke-width:1" }, svg);
    for (const r of regions.filter((r) => r.fav)) el("path", { d: path(r.pts), style: "fill:var(--vec-u);fill-opacity:0.3;stroke:var(--vec-u);stroke-width:1" }, svg);
    for (const p of Object.values(RAMA_PRESETS)) {
      if (!p.label) continue;
      el("circle", { cx: f.sx(p.phi), cy: f.sy(p.psi), r: 2.5, style: "fill:var(--foreground);fill-opacity:0.6" }, svg);
      text(svg, f.sx(p.phi) + 5, f.sy(p.psi) - 4, p.label, { class: "fill-foreground font-mono text-[10px]" });
    }
    el("circle", { cx: f.sx(phi), cy: f.sy(psi), r: 7, style: "fill:var(--brand);fill-opacity:0.2;stroke:var(--brand);stroke-width:2" }, svg);
    el("circle", { cx: f.sx(phi), cy: f.sy(psi), r: 2, style: "fill:var(--brand)" }, svg);

    const fav = regions.find((r) => r.fav && inside([phi, psi], r.pts));
    const ok = fav ?? regions.find((r) => inside([phi, psi], r.pts));
    o.angles.textContent = `${num(phi, 0)}°, ${num(psi, 0)}°`;
    o.region.textContent = fav ? `favoured · ${fav.name}` : ok ? `allowed · ${ok.name}` : "disallowed: atoms collide";
    const near = Object.values(RAMA_PRESETS).find((p) => p.label && Math.hypot(p.phi - phi, p.psi - psi) <= 12);
    o.turn.textContent = near ? near.turn : "—";
    o.rise.textContent = near ? near.rise : "—";
    svg.setAttribute("aria-valuetext", `phi ${phi}, psi ${psi}: ${o.region.textContent}`);
  }
  draw();
}

// ============================================================ oxygen binding

for (const root of document.querySelectorAll("[data-biochem-o2]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let view = "curve";
  const s = scrubAll(root, draw);
  onSeg(root, (_, v) => { view = v; draw(); });
  const hill = (p, p50, n) => (p <= 0 ? 0 : 1 / (1 + (p50 / p) ** n));

  function draw() {
    const n = s.n.get(), p50ref = s.p50.get(), ph = s.ph.get();
    const p50 = p50ref * 10 ** (-0.48 * (ph - 7.4));
    const lung = s.lung.get(), tis = Math.min(s.tissue.get(), lung);
    const MB = 2.8;
    svg.replaceChildren();
    if (view === "curve") {
      const f = frame(svg, { box: [44, 16, 560, 236], x: [0, 150], y: [0, 1], xticks: range(0, 150, 25), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "pO₂ (mmHg)", ylabel: "saturation" });
      const xs = range(0, 150, 0.5);
      const yl = hill(lung, p50, n), yt = hill(tis, p50, n);
      el("rect", { x: f.sx(tis), y: f.T, width: f.sx(lung) - f.sx(tis), height: f.H, style: "fill:currentColor;fill-opacity:0.04" }, svg);
      text(svg, f.sx(tis) + 4, f.T + f.H - 6, "tissue", {});
      text(svg, f.sx(lung) - 4, f.T + f.H - 6, "lungs", { "text-anchor": "end" });
      polyline(svg, xs.map((p) => [f.sx(p), f.sy(hill(p, MB, 1))]), "stroke:var(--vec-u);stroke-width:1.75");
      if (Math.abs(ph - 7.4) > 0.005) polyline(svg, xs.map((p) => [f.sx(p), f.sy(hill(p, p50ref, n))]), "stroke:var(--foreground);stroke-opacity:0.4;stroke-width:1.25;stroke-dasharray:4 4");
      polyline(svg, xs.map((p) => [f.sx(p), f.sy(hill(p, p50, n))]), "stroke:var(--foreground);stroke-width:2");
      el("line", { x1: f.sx(tis), x2: f.sx(tis), y1: f.sy(yt), y2: f.sy(yl), style: "stroke:var(--brand);stroke-width:3;stroke-linecap:round" }, svg);
      el("line", { x1: f.sx(tis), x2: f.sx(lung), y1: f.sy(yl), y2: f.sy(yl), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
      for (const [p, y] of [[lung, yl], [tis, yt]]) el("circle", { cx: f.sx(p), cy: f.sy(y), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
      text(svg, f.sx(tis) - 6, f.sy((yl + yt) / 2), `${Math.round((yl - yt) * 100)}%`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
      el("circle", { cx: f.sx(p50), cy: f.sy(0.5), r: 3, style: "fill:var(--foreground)" }, svg);
      text(svg, f.sx(p50) + 6, f.sy(0.5) + 12, `P₅₀ ${num(p50, 1)}`, { class: "fill-foreground font-mono text-[10px]" });
    } else {
      // Hill plot: log(Y/(1−Y)) against log pO2, slope n in the middle.
      const f = frame(svg, { box: [44, 16, 560, 236], x: [-0.5, 2.5], y: [-3, 3], xticks: [0, 1, 2], xfmt: (v) => String(10 ** v), yticks: [-3, -2, -1, 0, 1, 2, 3], yfmt: (v) => sign(v, 0), xlabel: "pO₂ (mmHg, log)", ylabel: "log Y/(1−Y)" });
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      const xs = range(-0.5, 2.5, 0.01);
      const line = (p50v, nv) => xs.map((x) => [x, nv * (x - Math.log10(p50v))]).filter(([, y]) => y >= -3 && y <= 3).map(([x, y]) => [f.sx(x), f.sy(y)]);
      polyline(svg, line(MB, 1), "stroke:var(--vec-u);stroke-width:1.75");
      polyline(svg, line(p50, n), "stroke:var(--foreground);stroke-width:2");
      text(svg, f.sx(Math.log10(p50)) + 8, f.sy(0) - 8, `slope ${num(n, 1)}`, { class: "fill-foreground font-mono text-[10px]" });
      text(svg, f.sx(Math.log10(MB)) + 8, f.sy(0) + 14, "slope 1", { class: "fill-foreground font-mono text-[10px]" });
    }
    const yl = hill(lung, p50, n), yt = hill(tis, p50, n);
    o.p50.textContent = `${num(p50, 1)} mmHg`;
    o.yl.textContent = `${num(yl * 100, 1)}%`;
    o.yt.textContent = `${num(yt * 100, 1)}%`;
    o.deliv.textContent = `${num((yl - yt) * 100, 1)}% of capacity`;
    o.mb.textContent = `${num((hill(lung, MB, 1) - hill(tis, MB, 1)) * 100, 1)}%`;
  }
  draw();
}

// ============================================================ DNA melting

// SantaLucia (1998) unified nearest-neighbour parameters: ΔH kcal/mol, ΔS cal/(K·mol).
const NN = {
  AA: [-7.9, -22.2], AT: [-7.2, -20.4], TA: [-7.2, -21.3], CA: [-8.5, -22.7], GT: [-8.4, -22.4],
  CT: [-7.8, -21.0], GA: [-8.2, -22.2], CG: [-10.6, -27.2], GC: [-9.8, -24.4], GG: [-8.0, -19.9],
};
const COMP = { A: "T", T: "A", G: "C", C: "G" };
const revcomp = (s) => [...s].reverse().map((c) => COMP[c]).join("");
const R_CAL = 1.987;

export function nearestNeighbour(seq, naM) {
  let dh = 0, ds = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const d = seq.slice(i, i + 2);
    const [h, s] = NN[d] ?? NN[revcomp(d)];
    dh += h; ds += s;
  }
  for (const end of [seq[0], seq[seq.length - 1]]) {
    if (end === "G" || end === "C") { dh += 0.1; ds += -2.8; } else { dh += 2.3; ds += 4.1; }
  }
  const self = seq === revcomp(seq);
  if (self) ds += -1.4;
  ds += 0.368 * (seq.length - 1) * Math.log(naM);
  return { dh, ds, self };
}

for (const root of document.querySelectorAll("[data-biochem-melt]")) {
  const svg = root.querySelector("[data-plot]");
  const input = root.querySelector("[data-seq]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  input.addEventListener("input", draw);

  function draw() {
    const seq = input.value.toUpperCase().replace(/[^ACGT]/g, "");
    const na = s.na.get() / 1000, ct = s.ct.get() * 1e-6;
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 16, 560, 220], x: [20, 100], y: [0, 1], xticks: range(20, 100, 10), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "temperature (°C)", ylabel: "duplex" });
    if (seq.length < 6) {
      text(svg, f.L + f.W / 2, f.T + f.H / 2, "type at least 6 bases (A, C, G, T)", { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      for (const k of ["gc", "dh", "ds", "dg", "tm", "wal"]) o[k].textContent = "—";
      return;
    }
    const { dh, ds, self } = nearestNeighbour(seq, na);
    const tmK = (1000 * dh) / (ds + R_CAL * Math.log(self ? ct : ct / 4));
    const tm = tmK - 273.15;
    const frac = (tc) => {
      const T = tc + 273.15, K = Math.exp(-(1000 * dh - T * ds) / (R_CAL * T));
      if (self) { const a = 2 * K * ct; return (2 * a + 1 - Math.sqrt(4 * a + 1)) / (2 * a); }
      const a = K * ct; return (a + 1 - Math.sqrt(2 * a + 1)) / a;
    };
    const xs = range(20, 100, 0.25);
    polyline(svg, xs.map((t) => [f.sx(t), f.sy(Math.min(1, Math.max(0, frac(t))))]), "stroke:var(--foreground);stroke-width:2");
    const at = [...seq].filter((c) => c === "A" || c === "T").length, gc = seq.length - at;
    const wal = 2 * at + 4 * gc;
    const vline = (t, style, label, dy, left) => {
      if (t < 20 || t > 100) return;
      el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.T, y2: f.T + f.H, style }, svg);
      text(svg, f.sx(t) + (left ? -4 : 4), f.T + dy, label, { "text-anchor": left ? "end" : "start", class: "fill-foreground font-mono text-[10px]" });
    };
    vline(tm, "stroke:var(--brand);stroke-dasharray:4 3", `Tm ${num(tm, 1)} °C`, 12, wal >= tm);
    vline(wal, "stroke:var(--vec-u);stroke-dasharray:2 3", `Wallace ${wal} °C`, 12, wal < tm);
    o.gc.textContent = `${seq.length} nt · ${Math.round((100 * gc) / seq.length)}% GC${self ? " · self-compl." : ""}`;
    o.dh.textContent = `${num(dh, 1)} kcal/mol`;
    o.ds.textContent = `${num(ds, 1)} cal/K·mol`;
    o.dg.textContent = `${num(dh - (310.15 * ds) / 1000, 2)} kcal/mol`;
    o.tm.textContent = `${num(tm, 1)} °C`;
    o.wal.textContent = `${wal} °C` + (seq.length > 14 ? " (too long for the rule)" : "");
  }
  draw();
}

// ============================================================ SDS-PAGE

const LADDER = [250, 150, 100, 75, 50, 37, 25, 20, 15, 10];
const GEL_RANGE = { 8: [25, 200], 10: [15, 120], 12: [10, 80], 15: [8, 50] };
const UNKNOWNS = [["BSA", 66.4], ["ovalbumin", 42.9], ["carbonic anhydrase", 29.0], ["β-lactoglobulin", 18.4], ["lysozyme", 14.3], ["phosphorylase b", 97.2], ["GAPDH", 35.9], ["myoglobin", 17.0], ["β-galactosidase", 116.3], ["trypsinogen", 24.0]];

function mobility(m, gel) {
  const [lo, hi] = GEL_RANGE[gel];
  const b = 0.8 / Math.log10(hi / lo), a = 0.92 + b * Math.log10(lo);
  const u = a - b * Math.log10(m);
  if (u < 0.12) return 0.04 + 0.08 * Math.exp((u - 0.12) / 0.08);
  if (u > 0.92) return 0.98 - 0.06 * Math.exp(-(u - 0.92) / 0.06);
  return u;
}

function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}

for (const root of document.querySelectorAll("[data-biochem-gel]")) {
  const gelSvg = root.querySelector("[data-gel]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let gel = 8, seed = 7, unknowns = [], noise = {}, selected = null, revealed = false, progress = 1, raf = 0;
  onSeg(root, (_, v) => { gel = +v; run(); });
  root.querySelector("[data-action=run]").addEventListener("click", () => { seed++; pick(); run(); });
  root.querySelector("[data-action=reveal]").addEventListener("click", () => { revealed = !revealed; drawAll(); });

  function pick() {
    const r = rng(seed * 9973);
    const pool = UNKNOWNS.slice();
    unknowns = [0, 1, 2].map(() => pool.splice(Math.floor(r() * pool.length), 1)[0]);
    noise = {};
    for (const m of [...LADDER, ...unknowns.map((u) => u[1])]) noise[m] = (r() - 0.5) * 0.012;
    selected = { lane: 1, mass: unknowns[0][1] };
    revealed = false;
  }
  const rf = (m) => Math.min(0.985, Math.max(0.03, mobility(m, gel) + noise[m]));

  function run() {
    cancelAnimationFrame(raf);
    if (reduced()) { progress = 1; drawAll(); return; }
    const t0 = performance.now();
    const step = (t) => {
      progress = Math.min(1, (t - t0) / 1100);
      progress = 1 - (1 - progress) ** 3;
      drawGel();
      if (progress < 1) raf = requestAnimationFrame(step);
      else drawAll();
    };
    raf = requestAnimationFrame(step);
  }

  const lanes = () => [{ name: "M", bands: LADDER }, ...unknowns.map((u, i) => ({ name: "ABC"[i], bands: [u[1]] }))];
  const TOP = 26, LEN = 300, X0 = 46, LW = 62;

  function drawGel() {
    gelSvg.replaceChildren();
    el("rect", { x: X0 - 4, y: TOP - 8, width: LW * 4 + 4, height: LEN + 18, rx: 6, style: "fill:currentColor;fill-opacity:0.035;stroke:currentColor;stroke-opacity:0.15" }, gelSvg);
    el("line", { x1: X0 - 4, x2: X0 + LW * 4, y1: TOP + LEN * 0.985 * progress, y2: TOP + LEN * 0.985 * progress, style: "stroke:var(--vec-u);stroke-opacity:0.6;stroke-width:2" }, gelSvg);
    let lastLabel = -Infinity;
    lanes().forEach((lane, li) => {
      const x = X0 + li * LW + 4;
      el("rect", { x: x + 6, y: TOP - 6, width: LW - 20, height: 6, rx: 1.5, style: "fill:currentColor;fill-opacity:0.18" }, gelSvg);
      text(gelSvg, x + (LW - 8) / 2, TOP - 12, lane.name, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      for (const m of lane.bands) {
        const y = TOP + LEN * rf(m) * progress;
        const sel = selected && selected.lane === li && selected.mass === m;
        const g = el("g", { tabindex: progress === 1 ? 0 : -1, role: "button", "aria-label": `Lane ${lane.name} band${li === 0 ? ` ${m} kDa` : ""}`, "aria-pressed": String(!!sel), class: "cursor-pointer outline-none" }, gelSvg);
        el("rect", { x: x - 2, y: y - 7, width: LW - 4, height: 14, style: "fill:transparent" }, g);
        el("rect", { x: x + 2, y: y - 2.5, width: LW - 12, height: 5, rx: 2, style: `fill:${sel ? "var(--brand)" : "var(--foreground)"};fill-opacity:${sel ? 1 : li === 0 ? 0.6 : 0.85}` }, g);
        if (sel) el("rect", { x: x - 1, y: y - 6, width: LW - 6, height: 12, rx: 3, style: "fill:none;stroke:var(--brand);stroke-width:1.25" }, g);
        const choose = () => { selected = { lane: li, mass: m }; drawAll(); gelSvg.querySelector(`[aria-pressed=true]`)?.focus(); };
        g.addEventListener("click", choose);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
        if (li === 0 && progress === 1 && y - lastLabel >= 10) { text(gelSvg, X0 - 8, y + 3, String(m), { "text-anchor": "end" }); lastLabel = y; }
      }
    });
    if (progress === 1) text(gelSvg, X0 - 8, TOP - 12, "kDa", { "text-anchor": "end" });
  }

  function drawAll() {
    drawGel();
    // Standard curve from ladder bands inside the linear range.
    const used = LADDER.filter((m) => { const r = rf(m); return r > 0.12 && r < 0.92; });
    const xs = used.map(rf), ys = used.map((m) => Math.log10(m));
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const slope = sxy / sxx, icpt = my - slope * mx;
    const ssr = ys.reduce((a, y, i) => a + (y - (icpt + slope * xs[i])) ** 2, 0), sst = ys.reduce((a, y) => a + (y - my) ** 2, 0);

    svg.replaceChildren();
    const f = frame(svg, { box: [40, 16, 286, 300], x: [0, 1], y: [0.8, 2.5], xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => num(v, 2), yticks: [1, Math.log10(20), Math.log10(50), 2, Math.log10(200)], yfmt: (v) => String(Math.round(10 ** v)), xlabel: "Rf", ylabel: "kDa (log)" });
    polyline(svg, [[0.05, icpt + slope * 0.05], [0.98, icpt + slope * 0.98]].filter(([, y]) => true).map(([x, y]) => [f.sx(x), f.sy(Math.max(0.8, Math.min(2.5, y)))]), "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:5 4");
    for (const m of LADDER) {
      const inFit = used.includes(m);
      el("circle", { cx: f.sx(rf(m)), cy: f.sy(Math.log10(m)), r: 3.5, style: inFit ? "fill:var(--foreground)" : "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.6" }, svg);
    }
    const sr = selected ? rf(selected.mass) : null;
    const est = sr === null ? NaN : 10 ** (icpt + slope * sr);
    if (sr !== null) {
      const y = Math.max(0.8, Math.min(2.5, Math.log10(est)));
      el("line", { x1: f.sx(sr), x2: f.sx(sr), y1: f.T + f.H, y2: f.sy(y), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
      el("line", { x1: f.L, x2: f.sx(sr), y1: f.sy(y), y2: f.sy(y), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
      el("circle", { cx: f.sx(sr), cy: f.sy(y), r: 5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    }
    const lane = selected ? lanes()[selected.lane] : null;
    o.fit.textContent = `log M = ${num(icpt, 2)} − ${num(-slope, 2)}·Rf (${n} bands)`;
    o.r2.textContent = num(1 - ssr / sst, 4);
    o.band.textContent = lane ? (selected.lane === 0 ? `ladder, ${selected.mass} kDa` : `lane ${lane.name}`) : "—";
    o.rf.textContent = sr === null ? "—" : num(sr, 3);
    o.est.textContent = Number.isFinite(est) ? `${fmt(est)} kDa${sr < 0.12 || sr > 0.92 ? " (outside linear range)" : ""}` : "—";
    const truth = selected && selected.lane > 0 ? unknowns[selected.lane - 1] : null;
    o.truth.textContent = !selected ? "—" : selected.lane === 0 ? `${selected.mass} kDa` : revealed ? `${truth[0]}, ${truth[1]} kDa` : "press Reveal";
  }

  pick();
  progress = 1;
  drawAll();
}

// ============================================================ free energy

const REACTIONS = {
  atp: { eq: "ATP + H₂O → ADP + Pᵢ", dg0: -30.5, r: [["ATP", 2.25]], p: [["ADP", 0.25], ["Pᵢ", 1.65]] },
  g6p: { eq: "glucose + Pᵢ → glucose 6-phosphate + H₂O", dg0: 13.8, r: [["glucose", 5], ["Pᵢ", 1.65]], p: [["G6P", 0.083]] },
  hk: { eq: "glucose + ATP → glucose 6-phosphate + ADP", dg0: -16.7, r: [["glucose", 5], ["ATP", 2.25]], p: [["G6P", 0.083], ["ADP", 0.25]] },
  tpi: { eq: "DHAP → glyceraldehyde 3-phosphate", dg0: 7.5, r: [["DHAP", 0.14]], p: [["GAP", 0.019]] },
  mdh: { eq: "malate + NAD⁺ → oxaloacetate + NADH", dg0: 29.7, r: [["malate", 0.5], ["NAD⁺", 0.8]], p: [["oxaloacetate", 0.0001], ["NADH", 0.05]] },
  pk: { eq: "PEP + ADP → pyruvate + ATP", dg0: -31.4, r: [["PEP", 0.023], ["ADP", 0.25]], p: [["pyruvate", 0.051], ["ATP", 2.25]] },
};

for (const root of document.querySelectorAll("[data-biochem-dg]")) {
  const svg = root.querySelector("[data-plot]");
  const sel = root.querySelector("[data-reaction]");
  const eqn = root.querySelector("[data-equation]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  sel.addEventListener("change", load);

  function load() {
    const rx = REACTIONS[sel.value];
    const slots = [["r1", rx.r[0]], ["r2", rx.r[1]], ["p1", rx.p[0]], ["p2", rx.p[1]]];
    for (const [k, sp] of slots) {
      const row = root.querySelector(`[data-row="${k}"]`);
      row.hidden = !sp;
      if (!sp) continue;
      row.querySelector("label > span").textContent = `[${sp[0]}]`;
      s[k].set(sp[1], false);
    }
    eqn.textContent = rx.eq;
    draw();
  }

  function draw() {
    const rx = REACTIONS[sel.value];
    const T = s.temp.get() + 273.15, RT = 8.314e-3 * T;
    const val = (k, on) => (on ? s[k].get() / 1000 : 1);
    const Q = (val("p1", rx.p[0]) * val("p2", rx.p[1])) / (val("r1", rx.r[0]) * val("r2", rx.r[1]));
    const lq = Math.log10(Q), dg = rx.dg0 + RT * Math.log(Q), K = Math.exp(-rx.dg0 / RT);
    svg.replaceChildren();
    const xlo = -12, xhi = 8;
    const yAt = (x) => rx.dg0 + RT * Math.LN10 * x;
    const ylo = Math.floor(Math.min(yAt(xlo), yAt(xhi), -10) / 20) * 20, yhi = Math.ceil(Math.max(yAt(xlo), yAt(xhi), 10) / 20) * 20;
    const f = frame(svg, { box: [52, 16, 552, 206], x: [xlo, xhi], y: [ylo, yhi], xticks: range(xlo, xhi, 4), xfmt: (v) => (v === 0 ? "1" : `10${v < 0 ? "⁻" : ""}${String(Math.abs(v)).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join("")}`), yticks: range(ylo, yhi, 20), yfmt: (v) => num(v, 0), xlabel: "Q (mass-action ratio, log)", ylabel: "ΔG (kJ/mol)" });
    el("rect", { x: f.L, y: f.sy(0), width: f.W, height: f.T + f.H - f.sy(0), style: "fill:var(--brand);fill-opacity:0.06" }, svg);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.4" }, svg);
    text(svg, f.L + 6, f.T + f.H - 6, "runs forward", { class: "fill-foreground font-mono text-[10px]" });
    polyline(svg, [[f.sx(xlo), f.sy(yAt(xlo))], [f.sx(xhi), f.sy(yAt(xhi))]], "stroke:var(--foreground);stroke-width:2");
    const lk = Math.log10(K);
    if (lk >= xlo && lk <= xhi) {
      el("circle", { cx: f.sx(lk), cy: f.sy(0), r: 3.5, style: "fill:var(--foreground)" }, svg);
      text(svg, f.sx(lk) + 6, f.sy(0) + 14, "Q = K′eq", { class: "fill-foreground font-mono text-[10px]" });
    }
    el("circle", { cx: f.sx(0), cy: f.sy(rx.dg0), r: 3, style: "fill:var(--background);stroke:var(--foreground)" }, svg);
    text(svg, f.sx(0) + 6, f.sy(rx.dg0) + (rx.dg0 > 0 ? -6 : 14), "ΔG°′ (all at 1 M)", {});
    const cx = f.sx(Math.max(xlo, Math.min(xhi, lq)));
    el("line", { x1: cx, x2: cx, y1: f.sy(0), y2: f.sy(Math.max(ylo, Math.min(yhi, dg))), style: "stroke:var(--brand);stroke-dasharray:3 3" }, svg);
    el("circle", { cx, cy: f.sy(Math.max(ylo, Math.min(yhi, dg))), r: 5.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2.5" }, svg);
    text(svg, cx + 9, f.sy(Math.max(ylo, Math.min(yhi, dg))) + 4, `cell: ${num(dg, 1)}`, { class: "fill-foreground font-mono text-[10px]" });
    o.dg0.textContent = `${sign(rx.dg0, 1)} kJ/mol`;
    o.q.textContent = Q.toExponential(2);
    o.rtlnq.textContent = `${sign(RT * Math.log(Q), 1)} kJ/mol`;
    o.dg.textContent = `${sign(dg, 1)} kJ/mol`;
    o.k.textContent = K.toExponential(2);
    o.dir.textContent = dg < -2 ? "forward" : dg > 2 ? "backward" : "near equilibrium";
  }
  load();
}

// ============================================================ ATP yield

const STAGES = [
  { name: "Glycolysis", where: "cytosol", what: "glucose → 2 pyruvate. 2 ATP spent, 4 made.", atp: 2, nadhC: 2, nadhM: 0, fadh: 0 },
  { name: "Pyruvate oxidation", where: "mitochondrial matrix", what: "2 pyruvate → 2 acetyl-CoA + 2 CO₂.", atp: 0, nadhC: 0, nadhM: 2, fadh: 0 },
  { name: "Citric acid cycle", where: "matrix, two turns", what: "2 acetyl-CoA → 4 CO₂. One GTP per turn.", atp: 2, nadhC: 0, nadhM: 6, fadh: 2 },
  { name: "Oxidative phosphorylation", where: "inner membrane", what: "NADH and FADH₂ feed the electron transport chain; the proton gradient drives ATP synthase.", atp: 0, nadhC: 0, nadhM: 0, fadh: 0 },
];

for (const root of document.querySelectorAll("[data-biochem-atp]")) {
  const list = root.querySelector("[data-steps]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let stage = 0, shuttle = "ma", ratios = "modern";
  root.querySelector("[data-action=prev]").addEventListener("click", () => { stage = Math.max(0, stage - 1); draw(); });
  root.querySelector("[data-action=next]").addEventListener("click", () => { stage = Math.min(STAGES.length - 1, stage + 1); draw(); });
  onSeg(root, (label, v) => { if (label === "Shuttle") shuttle = v; else ratios = v; draw(); });

  const items = STAGES.map((st, i) => {
    const li = document.createElement("li");
    li.className = "flex flex-col gap-0.5 rounded-lg border bg-background px-3 py-2 transition-[border-color,opacity] duration-200 data-[state=future]:opacity-45 data-[state=current]:border-brand";
    const head = document.createElement("div");
    head.className = "flex items-baseline justify-between gap-3";
    const name = document.createElement("span");
    name.className = "text-sm font-medium";
    name.textContent = `${i + 1}. ${st.name}`;
    const where = document.createElement("span");
    where.className = "font-mono text-[11px] text-muted-foreground";
    where.textContent = st.where;
    head.append(name, where);
    const what = document.createElement("p");
    what.className = "text-xs leading-relaxed text-muted-foreground";
    what.textContent = st.what;
    const gain = document.createElement("p");
    gain.className = "font-mono text-[11px] text-foreground";
    li.append(head, what, gain);
    list.append(li);
    return { li, gain, what };
  });

  function draw() {
    const pN = ratios === "modern" ? 2.5 : 3, pF = ratios === "modern" ? 1.5 : 2;
    const pC = shuttle === "ma" ? pN : pF;
    const done = STAGES.slice(0, stage + 1);
    const sum = (k) => done.reduce((t, st) => t + st[k], 0);
    const direct = sum("atp"), nadhC = sum("nadhC"), nadhM = sum("nadhM"), fadh = sum("fadh");
    const ox = stage === 3;
    items.forEach(({ li, gain }, i) => {
      li.dataset.state = i < stage ? "done" : i === stage ? "current" : "future";
      if (i === stage) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      const st = STAGES[i];
      gain.textContent = i < 3
        ? [st.atp && `+${st.atp} ${i === 2 ? "GTP" : "ATP"}`, st.nadhC && `+${st.nadhC} NADH (cytosol)`, st.nadhM && `+${st.nadhM} NADH`, st.fadh && `+${st.fadh} FADH₂`].filter(Boolean).join(" · ")
        : `8 NADH × ${pN} + 2 FADH₂ × ${pF} + 2 cytosolic NADH × ${pC}`;
    });
    const parts = [
      ["glycolysis ATP", 2, "var(--vec-u)", stage >= 0],
      ["TCA GTP", 2, "var(--vec-v)", stage >= 2],
      ["cytosolic NADH", 2 * pC, "var(--vec-i)", ox],
      ["matrix NADH", 8 * pN, "var(--brand)", ox],
      ["FADH₂", 2 * pF, "var(--vec-j)", ox],
    ];
    const total = parts.filter((p) => p[3]).reduce((t, p) => t + p[1], 0);
    const maxTotal = 2 + 2 + 8 * 3 + 2 * 2 + 2 * 3;
    svg.replaceChildren();
    const L = 8, R = 632, y = 30, hgt = 30, k = (R - L) / maxTotal;
    text(svg, L, 18, "ATP per glucose", {});
    el("rect", { x: L, y, width: R - L, height: hgt, rx: 4, style: "fill:currentColor;fill-opacity:0.04;stroke:currentColor;stroke-opacity:0.12" }, svg);
    let x = L;
    for (const [name, v, color, on] of parts) {
      if (!on) continue;
      const w = v * k;
      el("rect", { x: x + 1, y: y + 1, width: Math.max(1, w - 2), height: hgt - 2, rx: 3, style: `fill:${color};fill-opacity:0.75` }, svg);
      if (w > 34) text(svg, x + w / 2, y + hgt / 2 + 4, num(v, v % 1 ? 1 : 0), { "text-anchor": "middle", class: "fill-background font-mono text-[10px] font-medium" });
      if (w > 70) text(svg, x + 2, y + hgt + 16, name, {});
      x += w;
    }
    o.stage.textContent = `${stage + 1} of 4: ${STAGES[stage].name}`;
    o.direct.textContent = String(direct);
    o.nadh.textContent = `${nadhC + nadhM}${nadhC ? ` (${nadhC} cytosolic)` : ""}`;
    o.fadh.textContent = String(fadh);
    o.total.textContent = ox ? num(total, total % 1 ? 1 : 0) : `${direct} so far`;
    o.eff.textContent = ox ? `${Math.round((total * 30.5 * 100) / 2870)}%` : "—";
  }
  draw();
}
