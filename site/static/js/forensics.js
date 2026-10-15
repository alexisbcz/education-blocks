// Forensic science blocks. Every block root is data-foren-*, so this module
// does nothing on other pages. Cases, profiles, prints and populations are
// synthetic (seeded); the models are the published ones: the product rule,
// Bayes' theorem, sin α = W/L and exact ballistic drops, Henssge's cooling
// formula, Widmark's formula, minutia pairing, Welch's t-test, degree hours
// and least squares with prediction intervals.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const BRAND = "var(--brand)";
const DEL = "var(--code-del)";
const U = "var(--vec-u)";
const V = "var(--vec-v)";
const OUT = "var(--vec-out)";
const G = 9.81;
const D2R = Math.PI / 180;

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const isOn = (root, name) => {
  const sw = root.querySelector(`[data-toggle="${name}"]`);
  return sw?.getAttribute("aria-checked") === "true" || sw?.dataset.state === "checked";
};
const group = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−") : "—");
const onAction = (root, name, fn) => root.querySelectorAll(`[data-action="${name}"]`).forEach((b) => b.addEventListener("click", fn));
function verdict(root, tone, msg) {
  const v = root.querySelector("[data-verdict]");
  if (!v) return;
  v.textContent = msg;
  if (tone) v.dataset.tone = tone;
  else delete v.dataset.tone;
}

// A named segmented control (forenSegs in forensics.go).
function seg(root, name, onChange) {
  const box = root.querySelector(`[data-foren-seg="${name}"]`);
  let v = box.querySelector("[aria-selected=true]")?.dataset.seg;
  box.addEventListener("seg-change", (e) => {
    v = e.detail.value;
    onChange(v);
  });
  return {
    get: () => v,
    set(value) {
      v = value;
      for (const b of box.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b.dataset.seg === value));
    },
  };
}

// Seeded generator: the first render is the same for everyone.
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return next;
}
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

// "1 in 2.3 billion" for a probability.
function oneIn(p) {
  if (!(p > 0)) return "—";
  const n = 1 / p;
  if (n < 1e4) return group(n, 0);
  const units = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  for (const [u, w] of units) if (n >= u) return `${num(n / u, n / u < 10 ? 1 : 0)} ${w}`;
  return group(n, 0);
}
const sci = (p) => {
  if (!(p > 0)) return "0";
  let e = Math.floor(Math.log10(p));
  let m = Math.round((p / 10 ** e) * 100) / 100;
  if (m >= 10) { m /= 10; e += 1; }
  return e >= -2 ? num(p, 4) : `${num(m, 2)} × 10${sup(e)}`;
};
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");
const pct = (v, d = 1) => `${num(v * 100, d)}%`;
const count = (x) => (x < 0.01 ? sci(x) : x < 10 ? num(x, 2) : group(x, 0));

// Student t: CDF through the regularised incomplete beta, and a quantile by bisection.
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const t = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let s = 1.000000000190015;
  for (const k of c) s += k / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}
function betacf(a, b, x) {
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
const tcdf = (t, df) => {
  const p = 0.5 * ibeta(df / 2, 0.5, df / (df + t * t));
  return t > 0 ? 1 - p : p;
};
function tq(p, df) {
  let lo = 0, hi = 100;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    tcdf(m, df) < p ? (lo = m) : (hi = m);
  }
  return (lo + hi) / 2;
}

function niceTicks(lo, hi, n = 5) {
  const raw = (hi - lo) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// ============================================================ F1 STR profiles

// Real CODIS locus names; allele ranges are plausible, frequencies are invented.
const LOCI = [
  ["D8S1179", 8, 18], ["D21S11", 27, 36], ["D7S820", 6, 14], ["CSF1PO", 7, 15], ["D3S1358", 12, 19],
  ["TH01", 5, 10], ["D13S317", 8, 15], ["D16S539", 8, 15], ["vWA", 13, 20], ["TPOX", 6, 13],
];
const STR_FREQ = (() => {
  const r = rng(1979);
  return LOCI.map(([, lo, hi]) => {
    const n = hi - lo + 1;
    // A hump in the middle of the range, jittered, normalised.
    const w = Array.from({ length: n }, (_, i) => Math.exp(-(((i - (n - 1) / 2) / (n / 3.2)) ** 2)) * (0.5 + r()));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  });
})();

function drawAllele(r, k) {
  let u = r();
  const f = STR_FREQ[k];
  for (let i = 0; i < f.length; i++) if ((u -= f[i]) <= 0) return LOCI[k][1] + i;
  return LOCI[k][2];
}
const sortPair = (a, b) => (a <= b ? [a, b] : [b, a]);
const freqOf = (k, a) => STR_FREQ[k][a - LOCI[k][1]];
const genoFreq = (k, [a, b]) => (a === b ? freqOf(k, a) ** 2 : 2 * freqOf(k, a) * freqOf(k, b));

for (const root of document.querySelectorAll("[data-foren-str]")) {
  const svg = root.querySelector("[data-epg]");
  const rows = root.querySelector("[data-rows]");
  const o = outs(root);
  let seed = 7;
  const ref = seg(root, "ref", draw);
  const s = scrubAll(root, draw);
  onAction(root, "reseed", () => { seed = newSeed(); draw(); });

  function draw() {
    const r = rng(seed);
    const scene = LOCI.map((_, k) => sortPair(drawAllele(r, k), drawAllele(r, k)));
    const peaks = (g) => (g[0] === g[1] ? [[g[0], 2 * (900 + 700 * r())]] : g.map((a) => [a, 800 + 900 * r()]));
    const scenePeaks = scene.map(peaks);
    const rr = rng(seed ^ 0x9e3779b9);
    const kind = ref.get();
    const reference = scene.map((g, k) => {
      if (kind === "same") return g.slice();
      if (kind === "unrelated") return sortPair(drawAllele(rr, k), drawAllele(rr, k));
      // Full sibling: share 2, 1 or 0 alleles identical by descent with
      // probability 1/4, 1/2, 1/4.
      const u = rr();
      if (u < 0.25) return g.slice();
      if (u < 0.75) return sortPair(g[rr() < 0.5 ? 0 : 1], drawAllele(rr, k));
      return sortPair(drawAllele(rr, k), drawAllele(rr, k));
    });
    const refPeaks = reference.map((g) => (g[0] === g[1] ? [[g[0], 2 * (1100 + 600 * rr())]] : g.map((a) => [a, 1000 + 800 * rr()])));
    const n = Math.round(s.loci.get());

    let matches = 0, mismatches = 0, rmp = 1;
    const status = scene.map((g, k) => {
      if (k >= n) return "off";
      const same = g[0] === reference[k][0] && g[1] === reference[k][1];
      same ? matches++ : mismatches++;
      rmp *= genoFreq(k, g);
      return same ? "match" : "diff";
    });

    // Electropherograms: two rows, ten locus windows.
    svg.replaceChildren();
    const L = 40, W = 590, lw = W / LOCI.length;
    const lanes = [["Scene", scenePeaks, 30], ["Reference", refPeaks, 196]];
    for (let k = 0; k < LOCI.length; k++) {
      const x0 = L + k * lw;
      const st = status[k];
      const fill = st === "match" ? BRAND : st === "diff" ? DEL : "currentColor";
      el("rect", { x: x0 + 1, y: 4, width: lw - 2, height: 14, rx: 3, style: `fill:${fill};fill-opacity:${st === "off" ? 0.04 : 0.14}` }, svg);
      text(svg, x0 + lw / 2, 14, LOCI[k][0], { "text-anchor": "middle", class: `font-mono text-[8.5px] ${st === "off" ? "fill-muted-foreground/50" : "fill-foreground"}` });
    }
    const ax = (k, a) => L + k * lw + 6 + ((a - LOCI[k][1]) / (LOCI[k][2] - LOCI[k][1])) * (lw - 12);
    for (const [name, pk, top] of lanes) {
      const H = 130, base = top + H;
      const sy = (rfu) => base - (rfu / 4000) * (H - 8);
      text(svg, 4, top + 10, name, { class: "fill-foreground text-[10px] font-medium" });
      for (const t of [1000, 2000, 3000]) {
        el("line", { x1: L, x2: L + W, y1: sy(t), y2: sy(t), style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
        text(svg, L - 4, sy(t) + 3, `${t / 1000}k`, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[8px]" });
      }
      el("line", { x1: L, x2: L + W, y1: base, y2: base, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
      // Baseline noise plus Gaussian peaks, one path per locus.
      const nr = rng(top * 31 + seed);
      for (let k = 0; k < LOCI.length; k++) {
        const off = status[k] === "off";
        const pts = [];
        for (let x = L + k * lw + 2; x <= L + (k + 1) * lw - 2; x += 0.8) {
          let y = 30 + 25 * nr();
          for (const [a, hgt] of pk[k]) y += hgt * Math.exp(-(((x - ax(k, a)) / 1.3) ** 2));
          pts.push([x, sy(y)]);
        }
        polyline(svg, pts, `stroke:${name === "Scene" ? U : V};stroke-width:1.1;stroke-opacity:${off ? 0.25 : 1}`);
        if (!off) {
          // Adjacent alleles sit a few pixels apart: push their labels apart.
          const close = pk[k].length === 2 && Math.abs(ax(k, pk[k][0][0]) - ax(k, pk[k][1][0])) < 12;
          pk[k].forEach(([a, hgt], i) => text(svg, ax(k, a) + (close ? (i ? 4 : -4) : 0), sy(hgt + 30) - 4, String(a), { "text-anchor": close ? (i ? "start" : "end") : "middle", class: "fill-foreground font-mono text-[8.5px]" }));
        }
      }
      text(svg, L + W, base + 12, "repeat number within each locus →", { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[8px]" });
    }
    text(svg, 4, 182, "RFU", { class: "fill-muted-foreground font-mono text-[8px]" });

    rows.replaceChildren(...LOCI.map(([nm], k) => {
      const tr = document.createElement("tr");
      tr.className = "border-t" + (status[k] === "off" ? " opacity-40" : "");
      const g = scene[k], rf = reference[k];
      const p = freqOf(k, g[0]), q = freqOf(k, g[1]);
      const cells = [
        nm, `${g[0]}, ${g[1]}`, `${rf[0]}, ${rf[1]}`,
        g[0] === g[1] ? `p = ${num(p, 3)}` : `p = ${num(p, 3)}, q = ${num(q, 3)}`,
        g[0] === g[1] ? `p² = ${num(p * p, 4)}` : `2pq = ${num(2 * p * q, 4)}`,
        status[k] === "match" ? "✓ match" : status[k] === "diff" ? "✗ differs" : "not compared",
      ];
      cells.forEach((c, i) => {
        const td = document.createElement("td");
        td.className = "py-1 pr-2" + (i === 5 ? (status[k] === "match" ? " text-brand" : status[k] === "diff" ? " text-del" : " text-muted-foreground") : "");
        td.textContent = c;
        tr.append(td);
      });
      return tr;
    }));

    o.match.textContent = `${matches} of ${n}`;
    if (mismatches) {
      o.rmp.textContent = "—";
      o.inv.textContent = "—";
      verdict(root, "del", `Excluded: the reference differs at ${mismatches} of ${n} loci, so it cannot be the source (barring a mix-up or a mutation). ${kind === "sibling" ? "A brother shares about half his alleles, so he often matches at several loci; that is why relatives are treated separately." : ""}`);
    } else {
      o.rmp.textContent = sci(rmp);
      o.inv.textContent = oneIn(rmp);
      verdict(root, "brand", `Cannot be excluded. An unrelated person picked at random would show this ${n}-locus profile with probability ${sci(rmp)}, about 1 in ${oneIn(rmp)}. That is the chance of a coincidental match, not the chance that the person is innocent (next block).${n < 6 ? " With few loci compared, coincidences are common." : ""}`);
    }
  }
  draw();
}

// ============================================================ F2 Prosecutor's fallacy

for (const root of document.querySelectorAll("[data-foren-fallacy]")) {
  const svg = root.querySelector("[data-bars]");
  const wrong = root.querySelector("[data-wrong]");
  const right = root.querySelector("[data-right]");
  const o = outs(root);
  const found = seg(root, "found", draw);
  const s = scrubAll(root, draw);

  function draw() {
    const rmp = 10 ** -s.rmp.get();
    const lab = 10 ** -s.lab.get();
    const N = Math.max(1, Math.round(s.pop.get() * 1000));
    const D = Math.round(s.db.get() * 1000);
    const trawl = found.get() === "trawl";
    const others = (N - 1) * rmp;
    const labFalse = (N - 1) * lab;
    const post = 1 / (1 + others);
    const postLab = 1 / (1 + others + labFalse);
    const hits = D * rmp;

    o.others.textContent = count(others);
    o.post.textContent = pct(post, post > 0.999 ? 3 : 1);
    o.postlab.textContent = pct(postLab, postLab > 0.999 ? 3 : 1);
    o.hits.textContent = trawl ? count(hits) : "no search";

    wrong.textContent = `“The chance that the defendant is innocent is 1 in ${oneIn(rmp)}.” This swaps P(match | innocent) for P(innocent | match).`;
    let msg = `Among ${group(N)} people who could have left the trace, about ${count(others)} others would match by chance. With nothing else to tell them apart, the chance that a matching person is the source is ${pct(post, 1)}; allowing for a lab false-positive rate of 1 in ${oneIn(lab)}, it is ${pct(postLab, 1)}.`;
    if (lab > rmp * 10) msg += " The lab error rate, not the RMP, dominates.";
    if (trawl) msg += ` A search of ${group(D)} profiles is expected to give ${count(hits)} chance hits. How to weigh a database hit is debated: NRC II (1996) proposed multiplying the RMP by the database size; Balding and Donnelly (1996) argued the search, by ruling others out, slightly strengthens the case. Both agree a hit with no other link to the crime needs care.`;
    right.textContent = msg;

    // One bar: how the probability that a matching person is the source
    // splits between the source, coincidental matches and lab error.
    svg.replaceChildren();
    const L = 20, W = 600, top = 60, Hb = 46;
    const tot = 1 + others + labFalse;
    const parts = [
      ["true source", 1 / tot, BRAND],
      ["coincidental match", others / tot, U],
      ["lab false positive", labFalse / tot, DEL],
    ];
    text(svg, L, 30, "If the person who matches were picked from everyone who matches or is falsely reported to match:", { class: "fill-foreground text-[11px]" });
    let x = L;
    for (const [name, f, c] of parts) {
      const w = f * W;
      if (w > 0.2) el("rect", { x, y: top, width: w, height: Hb, style: `fill:${c};fill-opacity:0.75` }, svg);
      x += w;
    }
    el("rect", { x: L, y: top, width: W, height: Hb, rx: 2, style: "fill:none;stroke:currentColor;stroke-opacity:0.3" }, svg);
    parts.forEach(([name, f, c], i) => {
      const y = top + Hb + 30 + i * 22;
      el("rect", { x: L, y: y - 9, width: 10, height: 10, rx: 2, style: `fill:${c};fill-opacity:0.75` }, svg);
      text(svg, L + 16, y, name, { class: "fill-foreground text-[11px]" });
      text(svg, L + 180, y, pct(f, f > 0.999 || f < 0.001 ? 3 : 1), { class: "fill-foreground font-mono text-[11px]" });
      const cnt = i === 0 ? 1 : i === 1 ? others : labFalse;
      text(svg, L + 260, y, `expected people: ${count(cnt)}`, { class: "fill-muted-foreground font-mono text-[11px]" });
    });
  }
  draw();
}

// ============================================================ F3 Impact angle

for (const root of document.querySelectorAll("[data-foren-impact]")) {
  const stain = root.querySelector("[data-stain]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const W = s.w.get(), Lm = s.l.get(), gam = s.gamma.get(), e = s.err.get();
    const valid = W <= Lm;
    const ratio = Math.min(1, W / Lm);
    const alpha = Math.asin(ratio) / D2R;
    const rlo = Math.max(0, Math.min(1, (W - e) / (Lm + e)));
    const rhi = Math.min(1, (W + e) / Math.max(1e-9, Lm - e));
    const alo = Math.asin(rlo) / D2R, ahi = Math.asin(rhi) / D2R;

    o.ratio.textContent = valid ? num(ratio, 3) : "W > L";
    o.alpha.textContent = valid ? `${num(alpha, 1)}°` : "—";
    o.range.textContent = valid ? `${num(alo, 1)}° – ${num(ahi, 1)}°` : "—";

    // Top view: ellipse with a tail in the direction of travel, and a side view.
    stain.replaceChildren();
    text(stain, 8, 16, "seen from above", { class: "fill-muted-foreground font-mono text-[9px]" });
    const cx = 82, cy = 115, k = Math.min(16, 130 / Lm);
    const gEl = el("g", { transform: `translate(${cx} ${cy}) rotate(${-gam})` }, stain);
    el("ellipse", { cx: 0, cy: 0, rx: (Lm * k) / 2, ry: (W * k) / 2, style: "fill:currentColor;fill-opacity:0.55" }, gEl);
    const tail = (Lm * k) / 2;
    el("path", { d: `M${tail - 2},${-W * k * 0.18} Q${tail + 10},0 ${tail + 16},0 Q${tail + 10},0 ${tail - 2},${W * k * 0.18}Z`, style: "fill:currentColor;fill-opacity:0.55" }, gEl);
    el("line", { x1: -tail, x2: tail, y1: 0, y2: 0, style: `stroke:${BRAND};stroke-width:1;stroke-dasharray:3 2` }, gEl);
    el("line", { x1: 0, x2: 0, y1: (-W * k) / 2, y2: (W * k) / 2, style: `stroke:${U};stroke-width:1;stroke-dasharray:3 2` }, gEl);
    text(stain, 8, 236, `L ${num(Lm, 1)} mm (pink), W ${num(W, 1)} mm (blue)`, { class: "fill-muted-foreground font-mono text-[9px]" });
    text(stain, 8, 250, `travel γ = ${Math.round(gam)}°, tail points onward`, { class: "fill-muted-foreground font-mono text-[9px]" });

    // Side view.
    text(stain, 172, 16, "side view", { class: "fill-muted-foreground font-mono text-[9px]" });
    const sx0 = 250, sy0 = 200;
    el("line", { x1: 165, x2: 295, y1: sy0, y2: sy0, style: "stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5" }, stain);
    if (valid) {
      const a = alpha * D2R, len = 120;
      const x1 = sx0 - len * Math.cos(a), y1 = sy0 - len * Math.sin(a);
      el("line", { x1, y1, x2: sx0, y2: sy0, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 3" }, stain);
      el("circle", { cx: x1 + (sx0 - x1) * 0.55, cy: y1 + (sy0 - y1) * 0.55, r: 5, style: "fill:currentColor;fill-opacity:0.6" }, stain);
      el("path", { d: `M${sx0 - 30},${sy0} A30,30 0 0 1 ${sx0 - 30 * Math.cos(a)},${sy0 - 30 * Math.sin(a)}`, style: `fill:none;stroke:${BRAND};stroke-width:1.5` }, stain);
      text(stain, sx0 - 40, sy0 - 6, `α ${num(alpha, 0)}°`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    }

    // α against W/L.
    curve.replaceChildren();
    const f = frame(curve, { box: [40, 20, 240, 200], x: [0, 1], y: [0, 90], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 30, 60, 90], yfmt: (v) => `${v}°`, xlabel: "W / L", ylabel: "impact angle α" });
    const pts = [];
    for (let r = 0; r <= 1.0001; r += 0.01) pts.push([f.sx(r), f.sy(Math.asin(Math.min(1, r)) / D2R)]);
    polyline(curve, pts, "stroke:currentColor;stroke-width:1.5;stroke-opacity:0.7");
    if (valid) {
      el("rect", { x: f.sx(rlo), y: f.sy(ahi), width: Math.max(1, f.sx(rhi) - f.sx(rlo)), height: Math.max(1, f.sy(alo) - f.sy(ahi)), style: `fill:${BRAND};fill-opacity:0.15` }, curve);
      el("circle", { cx: f.sx(ratio), cy: f.sy(alpha), r: 4, style: `fill:${BRAND}` }, curve);
      text(curve, f.sx(ratio) - 6, f.sy(alpha) - 8, `±${num((ahi - alo) / 2, 1)}°`, { "text-anchor": "end", class: "fill-foreground font-mono text-[10px]" });
    }
  }
  draw();
}

// ============================================================ F4 Area of origin

for (const root of document.querySelectorAll("[data-foren-origin]")) {
  const plan = root.querySelector("[data-plan]");
  const side = root.querySelector("[data-side]");
  const o = outs(root);
  let seed = 11;
  let src = { x: 190, y: 160 }; // cm on the floor plan
  const FW = 400, FD = 340; // floor size, cm
  const s = scrubAll(root, draw);
  onToggle(root, () => queueMicrotask(draw));
  onAction(root, "reseed", () => {
    seed = newSeed();
    const r = rng(seed);
    src = { x: 120 + 160 * r(), y: 100 + 140 * r() };
    draw();
  });

  // Plan coordinates: 360 × 320 box, 10 px margin.
  const px = (x) => 10 + (x / FW) * 340, py = (y) => 10 + (y / FD) * 300;
  const toCm = (e) => {
    const pt = plan.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(plan.getScreenCTM().inverse());
    return { x: Math.max(20, Math.min(FW - 20, ((p.x - 10) / 340) * FW)), y: Math.max(20, Math.min(FD - 20, ((p.y - 10) / 300) * FD)) };
  };
  let dragging = false;
  plan.addEventListener("pointerdown", (e) => {
    if (!isOn(root, "truth")) return;
    dragging = true;
    plan.setPointerCapture(e.pointerId);
    src = toCm(e);
    draw();
  });
  plan.addEventListener("pointermove", (e) => { if (dragging) { src = toCm(e); draw(); } });
  plan.addEventListener("pointerup", () => (dragging = false));
  root.querySelector("[data-plan-wrap]").addEventListener("keydown", (e) => {
    const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (!step || !isOn(root, "truth")) return;
    e.preventDefault();
    src = { x: Math.max(20, Math.min(FW - 20, src.x + step[0])), y: Math.max(20, Math.min(FD - 20, src.y + step[1])) };
    draw();
  });

  function draw() {
    const z = s.z.get(), v = s.v.get(), n = Math.round(s.n.get()), noise = s.noise.get();
    const gravity = isOn(root, "gravity"), truth = isOn(root, "truth");
    const r = rng(seed);
    const stains = [];
    let tries = 0;
    while (stains.length < n && tries++ < 2000) {
      const phi = r() * 2 * Math.PI;
      const sp = v * (0.8 + 0.4 * r());
      let d, alpha, path;
      if (gravity) {
        const e = (-30 + 70 * r()) * D2R;
        const vh = sp * Math.cos(e), vz = sp * Math.sin(e);
        const z0 = z / 100;
        const t = (vz + Math.sqrt(vz * vz + 2 * G * z0)) / G;
        d = vh * t * 100;
        alpha = Math.atan(Math.abs(vz - G * t) / vh);
        path = (u) => [vh * u * t * 100, (z0 + vz * u * t - (G * (u * t) ** 2) / 2) * 100];
      } else {
        const e = (10 + 50 * r()) * D2R;
        d = z / Math.tan(e);
        alpha = e;
        path = (u) => [d * u, z * (1 - u)];
      }
      const x = src.x + d * Math.cos(phi), y = src.y + d * Math.sin(phi);
      if (x < 5 || x > FW - 5 || y < 5 || y > FD - 5 || d < 15) continue;
      const am = Math.min(89, Math.max(1, alpha / D2R + noise * (2 * r() - 1))) * D2R;
      const gm = phi + noise * (2 * r() - 1) * D2R;
      stains.push({ x, y, d, alpha, am, gm, path });
    }

    // Least-squares convergence of the measured direction lines.
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const st of stains) {
      const ux = Math.cos(st.gm), uy = Math.sin(st.gm);
      const m11 = 1 - ux * ux, m12 = -ux * uy, m22 = 1 - uy * uy;
      a11 += m11; a12 += m12; a22 += m22;
      b1 += m11 * st.x + m12 * st.y; b2 += m12 * st.x + m22 * st.y;
    }
    const det = a11 * a22 - a12 * a12;
    const c = Math.abs(det) > 1e-9 ? { x: (a22 * b1 - a12 * b2) / det, y: (a11 * b2 - a12 * b1) / det } : { x: NaN, y: NaN };
    const heights = stains.map((st) => Math.hypot(st.x - c.x, st.y - c.y) * Math.tan(st.am)).sort((a, b) => a - b);
    const zest = heights.length ? heights[Math.floor(heights.length / 2)] * (heights.length % 2 ? 1 : 0.5) + (heights.length % 2 ? 0 : heights[heights.length / 2 - 1] * 0.5) : NaN;

    o.cerr.textContent = Number.isFinite(c.x) ? `${num(Math.hypot(c.x - src.x, c.y - src.y), 0)} cm` : "—";
    o.zest.textContent = Number.isFinite(zest) ? `${num(zest, 0)} cm` : "—";
    o.ztrue.textContent = truth ? `${num(z, 0)} cm` : "hidden";
    o.over.textContent = truth && Number.isFinite(zest) ? `${zest >= z ? "+" : ""}${num(((zest - z) / z) * 100, 0)}%` : "—";

    // Plan.
    plan.replaceChildren();
    plan.style.cursor = truth ? "crosshair" : "default";
    el("rect", { x: 10, y: 10, width: 340, height: 300, rx: 4, style: "fill:currentColor;fill-opacity:0.03;stroke:currentColor;stroke-opacity:0.25" }, plan);
    for (let gx = 50; gx < FW; gx += 50) el("line", { x1: px(gx), x2: px(gx), y1: 10, y2: 310, style: "stroke:currentColor;stroke-opacity:0.05" }, plan);
    for (let gy = 50; gy < FD; gy += 50) el("line", { x1: 10, x2: 350, y1: py(gy), y2: py(gy), style: "stroke:currentColor;stroke-opacity:0.05" }, plan);
    const clip = el("clipPath", { id: "foren-floor" }, el("defs", {}, plan));
    el("rect", { x: 10, y: 10, width: 340, height: 300, rx: 4 }, clip);
    const lines = el("g", { "clip-path": "url(#foren-floor)" }, plan);
    for (const st of stains) {
      const ux = Math.cos(st.gm), uy = Math.sin(st.gm);
      el("line", { x1: px(st.x), y1: py(st.y), x2: px(st.x - ux * 600), y2: py(st.y - uy * 600), style: `stroke:${U};stroke-opacity:0.35;stroke-width:1` }, lines);
    }
    for (const st of stains) {
      const len = 7, wid = len * Math.sin(st.am);
      el("ellipse", { cx: px(st.x), cy: py(st.y), rx: len, ry: Math.max(1.5, wid), transform: `rotate(${st.gm / D2R} ${px(st.x)} ${py(st.y)})`, style: "fill:currentColor;fill-opacity:0.6" }, plan);
    }
    if (Number.isFinite(c.x)) {
      el("circle", { cx: px(c.x), cy: py(c.y), r: 9, style: `fill:${BRAND};fill-opacity:0.15;stroke:${BRAND};stroke-width:1.5` }, plan);
      text(plan, px(c.x) + 12, py(c.y) - 10, "convergence", { class: "fill-foreground text-[10px]" });
    }
    if (truth) {
      const X = px(src.x), Y = py(src.y);
      el("path", { d: `M${X - 6},${Y - 6}L${X + 6},${Y + 6}M${X - 6},${Y + 6}L${X + 6},${Y - 6}`, style: `stroke:${OUT};stroke-width:2` }, plan);
      text(plan, X + 9, Y + 14, "true source (drag)", { class: "fill-foreground text-[10px]" });
    }
    text(plan, 14, 306, "1 square = 50 cm", { class: "fill-muted-foreground font-mono text-[8.5px]" });

    // Side view: estimated straight lines and true flight paths.
    side.replaceChildren();
    const dmax = Math.max(60, ...stains.map((st) => Math.hypot(st.x - c.x, st.y - c.y)));
    const hmax = Math.max(z, zest || 0, ...heights.slice(-2)) * 1.15;
    const f = frame(side, { box: [40, 24, 205, 260], x: [0, dmax], y: [0, hmax], xticks: niceTicks(0, dmax, 3), yticks: niceTicks(0, hmax, 4), xlabel: "distance, cm", ylabel: "height, cm" });
    for (const st of stains) {
      const dd = Math.hypot(st.x - c.x, st.y - c.y);
      const hh = dd * Math.tan(st.am);
      el("line", { x1: f.sx(dd), y1: f.sy(0), x2: f.sx(0), y2: f.sy(Math.min(hh, hmax)), style: `stroke:${U};stroke-opacity:0.45;stroke-dasharray:3 2` }, side);
      if (truth) {
        const pts = [];
        for (let u = 0; u <= 1.0001; u += 0.05) {
          const [dx, hz] = st.path(u);
          pts.push([f.sx(Math.min(dx, dmax)), f.sy(Math.max(0, hz))]);
        }
        polyline(side, pts, `stroke:${OUT};stroke-width:1;stroke-opacity:0.7`);
      }
    }
    if (Number.isFinite(zest)) hline(side, f, Math.min(zest, hmax), `stroke:${BRAND};stroke-width:1.5`, `estimate ${num(zest, 0)}`);
    if (truth) {
      el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(z), y2: f.sy(z), style: `stroke:${OUT};stroke-width:1.5;stroke-dasharray:5 3` }, side);
      text(side, f.L + 4, f.sy(z) + 12, `true ${num(z, 0)}`, { class: "fill-foreground font-mono text-[10px]" });
    }
  }
  draw();
}

// ============================================================ F5 Body cooling

// Henssge (1988): Q(t) for ambient ≤ 23.2 °C and above, B from corrected mass.
const henssgeQ = (t, B, Ta) => (Ta <= 23.2 ? 1.25 * Math.exp(B * t) - 0.25 * Math.exp(5 * B * t) : 1.11 * Math.exp(B * t) - 0.11 * Math.exp(10 * B * t));
const henssgeB = (m) => -1.2815 * m ** -0.625 + 0.0284;

for (const root of document.querySelectorAll("[data-foren-cooling]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const Tr = s.tr.get(), Ta = s.ta.get(), m = s.m.get() * s.cf.get();
    const B = henssgeB(m);
    const Q = (Tr - Ta) / (37.2 - Ta);
    let t = NaN;
    if (Q > 0 && Q < 1) {
      let lo = 0, hi = 200;
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        henssgeQ(mid, B, Ta) > Q ? (lo = mid) : (hi = mid);
      }
      t = (lo + hi) / 2;
    }
    const band = Q >= 0.5 ? 2.8 : Q >= 0.3 ? 4.5 : 7;
    o.q.textContent = num(Q, 3);
    o.b.textContent = num(B, 4);
    o.t.textContent = Number.isFinite(t) ? `${num(t, 1)} h` : "—";
    o.band.textContent = Number.isFinite(t) ? `${num(Math.max(0, t - band), 1)} – ${num(t + band, 1)} h (±${band})` : "—";

    svg.replaceChildren();
    const tmax = Math.max(36, Number.isFinite(t) ? Math.ceil((t + band + 6) / 6) * 6 : 36);
    const ylo = Math.floor(Math.min(Ta, Tr) - 2), yhi = 40;
    const f = frame(svg, { box: [48, 28, 530, 232], x: [0, tmax], y: [ylo, yhi], xticks: niceTicks(0, tmax, 6), yticks: niceTicks(ylo, yhi, 5), xlabel: "hours since death", ylabel: "rectal temperature, °C" });
    if (Number.isFinite(t)) el("rect", { x: f.sx(Math.max(0, t - band)), y: f.T, width: f.sx(Math.min(tmax, t + band)) - f.sx(Math.max(0, t - band)), height: f.H, style: `fill:${BRAND};fill-opacity:0.1` }, svg);
    hline(svg, f, Ta, "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 3", `ambient ${num(Ta, 1)} °C`);
    const pts = [];
    for (let x = 0; x <= tmax; x += tmax / 300) pts.push([f.sx(x), f.sy(Ta + (37.2 - Ta) * henssgeQ(x, B, Ta))]);
    polyline(svg, pts, `stroke:${U};stroke-width:2`);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(Tr), y2: f.sy(Tr), style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    text(svg, f.L + 4, f.sy(Tr) - 4, `measured ${num(Tr, 1)} °C`, { class: "fill-foreground font-mono text-[10px]" });
    if (Number.isFinite(t)) {
      el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:1.5` }, svg);
      el("circle", { cx: f.sx(t), cy: f.sy(Tr), r: 4, style: `fill:${BRAND}` }, svg);
      text(svg, f.sx(t) + 6, f.T + 12, `${num(t, 1)} h`, { class: "fill-foreground font-mono text-[10px]" });
    } else {
      text(svg, f.L + f.W / 2, f.T + 40, Q >= 1 ? "At or above 37.2 °C: no cooling yet to read" : "At or below ambient: the model cannot tell", { "text-anchor": "middle", class: "fill-foreground text-[12px]" });
    }
  }
  draw();
}

// ============================================================ F6 Widmark

for (const root of document.querySelectorAll("[data-foren-widmark]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const A = s.a.get(), W = s.w.get(), r = s.r.get(), bac = s.bac.get(), delay = s.delay.get(), limit = s.limit.get();
    const peak = A / (r * W);
    const lo = bac + 0.1 * delay, hi = bac + 0.25 * delay;
    o.peak.textContent = `${num(peak, 2)} g/L`;
    o.lo.textContent = `${num(lo, 2)} g/L`;
    o.hi.textContent = `${num(hi, 2)} g/L`;
    // The stated drinking caps what the body can have held: a back-calculated
    // value above the Widmark maximum is cut to it.
    const capped = hi > peak && lo <= peak;
    const top = Math.min(hi, peak);
    o.used.textContent = lo > peak + 0.005 ? "inconsistent" : `${num(lo, 2)} – ${num(top, 2)} g/L`;
    o.over.textContent = lo > limit ? "yes, whole range" : top < limit ? "no, whole range" : "range straddles";
    const capMsg = capped ? ` The fast-elimination end (${num(hi, 2)} g/L) is more than ${num(A, 0)} g could produce, so the range is capped at the Widmark maximum, ${num(peak, 2)} g/L.` : "";
    if (lo > peak + 0.005) verdict(root, "del", `Inconsistent: even the slowest elimination puts the incident level (${num(lo, 2)} g/L) above the most that ${num(A, 0)} g of ethanol could produce (${num(peak, 2)} g/L). Either more was drunk than stated, or r or the timing is wrong.`);
    else if (lo > limit) verdict(root, "brand", `At the incident the level was between ${num(lo, 2)} and ${num(top, 2)} g/L: above ${num(limit, 1)} g/L for every elimination rate in the usual range, if the drinker was already past absorption.${capMsg}`);
    else if (top < limit) verdict(root, "brand", `At the incident the level was between ${num(lo, 2)} and ${num(top, 2)} g/L: below ${num(limit, 1)} g/L for every elimination rate in the usual range.${capMsg}`);
    else verdict(root, "", `The range ${num(lo, 2)}–${num(top, 2)} g/L straddles the ${num(limit, 1)} g/L limit: back-calculation alone cannot say which side the drinker was on.${capMsg}`);

    svg.replaceChildren();
    const ymax = Math.max(1.2, hi, peak, limit) * 1.15;
    const f = frame(svg, { box: [48, 20, 530, 240], x: [-0.5, delay + 1], y: [0, ymax], xticks: niceTicks(0, delay + 1, 6), yticks: niceTicks(0, ymax, 5), xlabel: "hours after the incident", ylabel: "BAC, g/L" });
    el("polygon", { points: `${f.sx(0)},${f.sy(lo)} ${f.sx(0)},${f.sy(hi)} ${f.sx(delay)},${f.sy(bac)}`, style: `fill:${BRAND};fill-opacity:0.12` }, svg);
    for (const [b, w] of [[0.1, 1.2], [0.15, 1], [0.25, 1.2]]) {
      el("line", { x1: f.sx(0), y1: f.sy(bac + b * delay), x2: f.sx(delay), y2: f.sy(bac), style: `stroke:${BRAND};stroke-width:${w};stroke-opacity:${b === 0.15 ? 0.5 : 1}` }, svg);
      text(svg, f.sx(0) - 4, f.sy(bac + b * delay) + 3, `β ${b.toFixed(2)}`, { "text-anchor": "end", class: "fill-foreground font-mono text-[9px]" });
    }
    hline(svg, f, limit, `stroke:${DEL};stroke-dasharray:5 3;stroke-width:1.2`, `limit ${num(limit, 1)} g/L`);
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(peak), y2: f.sy(peak), style: `stroke:${U};stroke-dasharray:2 3` }, svg);
    text(svg, f.L + f.W - 2, f.sy(peak) + 12, `Widmark maximum ${num(peak, 2)}`, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[10px]" });
    el("line", { x1: f.sx(0), x2: f.sx(0), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    text(svg, f.sx(0) + 4, f.T + 10, "incident", { class: "fill-muted-foreground text-[10px]" });
    el("circle", { cx: f.sx(delay), cy: f.sy(bac), r: 4.5, style: "fill:currentColor" }, svg);
    text(svg, f.sx(delay) + 6, f.sy(bac) - 6, `test ${num(bac, 2)}`, { class: "fill-foreground font-mono text-[10px]" });
  }
  draw();
}

// ============================================================ F7 Minutiae

// A loop pattern: nested U-shaped ridges around a core, arches outside.
const CORE = { x: 210, y: 175 };
function ridgePoint(k, s) {
  // k: ridge index, s ∈ [0, 1] along the ridge from its left end to its right end.
  const rad = 16 + k * 9;
  const legs = 230; // length of each straight leg
  const arc = Math.PI * rad;
  const total = 2 * legs + arc;
  const d = s * total;
  if (d < legs) return { x: CORE.x - rad, y: CORE.y + legs - d, a: -90 };
  if (d < legs + arc) {
    const th = Math.PI - (d - legs) / rad;
    return { x: CORE.x + rad * Math.cos(th), y: CORE.y - rad * Math.sin(th), a: Math.atan2(Math.cos(th), Math.sin(th)) / D2R };
  }
  return { x: CORE.x + rad, y: CORE.y + (d - legs - arc), a: 90 };
}
function makePrint(seed) {
  const r = rng(seed);
  const pts = [];
  while (pts.length < 34) {
    const k = Math.floor(r() * 18);
    const p = ridgePoint(k, r());
    if (Math.hypot(p.x - 210, (p.y - 215) * 1.15) > 175) continue;
    if (pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 16)) continue;
    // Direction: along the ridge, either way; type: ending or bifurcation.
    const dir = (r() < 0.5 ? p.a : p.a + 180) + 10 * r.gauss();
    pts.push({ x: p.x, y: p.y, a: ((dir % 360) + 360) % 360, type: r() < 0.55 ? "end" : "bif" });
  }
  return pts;
}
const angDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
function pairUp(mark, ref) {
  const used = new Set();
  const pairs = [];
  for (let i = 0; i < mark.length; i++) {
    let best = -1, bd = 1e9;
    for (let j = 0; j < ref.length; j++) {
      if (used.has(j) || ref[j].type !== mark[i].type) continue;
      const d = Math.hypot(ref[j].x - mark[i].x, ref[j].y - mark[i].y);
      if (d < 10 && angDiff(ref[j].a, mark[i].a) < 25 && d < bd) { bd = d; best = j; }
    }
    if (best >= 0) { used.add(best); pairs.push([i, best]); }
  }
  return pairs;
}

for (const root of document.querySelectorAll("[data-foren-minutiae]")) {
  const svg = root.querySelector("[data-print]");
  const o = outs(root);
  const ref = seg(root, "ref", () => { build(); draw(); });
  const s = scrubAll(root, draw);
  let seed = 23;
  let source, other, raw, cen;
  onAction(root, "reseed", () => { seed = newSeed(); build(); for (const k of ["rot", "dx", "dy"]) s[k].set(0); draw(); });
  onAction(root, "align", () => { align(); draw(); });

  function build() {
    const r = rng(seed);
    source = makePrint(seed);
    other = makePrint(seed ^ 0x5bd1e995);
    // The mark: minutiae of one region of the source, noisy, some missed,
    // a few spurious, then rotated and shifted by an unknown amount.
    const c = { x: 150 + 120 * r(), y: 150 + 100 * r() };
    const inside = source.filter((p) => Math.hypot(p.x - c.x, p.y - c.y) < 105 && r() > 0.15);
    const pts = inside.map((p) => ({ x: p.x + 2.5 * r.gauss(), y: p.y + 2.5 * r.gauss(), a: p.a + 6 * r.gauss(), type: p.type }));
    for (let i = 0; i < 2; i++) {
      const th = r() * 2 * Math.PI, rr = 90 * Math.sqrt(r());
      pts.push({ x: c.x + rr * Math.cos(th), y: c.y + rr * Math.sin(th), a: 360 * r(), type: r() < 0.5 ? "end" : "bif" });
    }
    const th = (-50 + 100 * r()) * D2R, tx = -60 + 120 * r(), ty = -60 + 120 * r();
    raw = pts.map((p) => {
      const x = p.x - c.x, y = p.y - c.y;
      return { x: c.x + tx + x * Math.cos(th) - y * Math.sin(th), y: c.y + ty + x * Math.sin(th) + y * Math.cos(th), a: p.a + th / D2R, type: p.type };
    });
    cen = { x: raw.reduce((a, p) => a + p.x, 0) / raw.length, y: raw.reduce((a, p) => a + p.y, 0) / raw.length };
  }
  const place = (rot, dx, dy) => raw.map((p) => {
    const t = rot * D2R, x = p.x - cen.x, y = p.y - cen.y;
    return { x: cen.x + dx + x * Math.cos(t) - y * Math.sin(t), y: cen.y + dy + x * Math.sin(t) + y * Math.cos(t), a: p.a + rot, type: p.type };
  });
  function align() {
    const target = ref.get() === "source" ? source : other;
    let best = { n: -1 };
    for (const p of raw) for (const q of target) {
      if (p.type !== q.type) continue;
      let rot = q.a - p.a;
      rot = ((rot % 360) + 540) % 360 - 180;
      const t = rot * D2R, x = p.x - cen.x, y = p.y - cen.y;
      const dx = q.x - cen.x - (x * Math.cos(t) - y * Math.sin(t));
      const dy = q.y - cen.y - (x * Math.sin(t) + y * Math.cos(t));
      if (Math.abs(dx) > 150 || Math.abs(dy) > 150) continue;
      const n = pairUp(place(rot, dx, dy), target).length;
      if (n > best.n) best = { n, rot, dx, dy };
    }
    if (best.n >= 0) { s.rot.set(Math.round(best.rot)); s.dx.set(Math.round(best.dx)); s.dy.set(Math.round(best.dy)); }
  }

  function minutia(g, p, color, w) {
    const ex = p.x + 9 * Math.cos(p.a * D2R), ey = p.y + 9 * Math.sin(p.a * D2R);
    el("line", { x1: p.x, y1: p.y, x2: ex, y2: ey, style: `stroke:${color};stroke-width:${w}` }, g);
    if (p.type === "end") el("circle", { cx: p.x, cy: p.y, r: 3, style: `fill:none;stroke:${color};stroke-width:${w}` }, g);
    else el("rect", { x: p.x - 2.8, y: p.y - 2.8, width: 5.6, height: 5.6, style: `fill:none;stroke:${color};stroke-width:${w}` }, g);
  }

  function draw() {
    const target = ref.get() === "source" ? source : other;
    const mark = place(s.rot.get(), s.dx.get(), s.dy.get());
    const pairs = pairUp(mark, target);
    const pm = new Set(pairs.map((p) => p[0])), pr = new Set(pairs.map((p) => p[1]));

    svg.replaceChildren();
    const clip = el("clipPath", { id: "foren-tip" }, el("defs", {}, svg));
    el("ellipse", { cx: 210, cy: 215, rx: 180, ry: 200 }, clip);
    const g = el("g", { "clip-path": "url(#foren-tip)" }, svg);
    el("ellipse", { cx: 210, cy: 215, rx: 180, ry: 200, style: "fill:currentColor;fill-opacity:0.03" }, g);
    for (let k = 0; k < 18; k++) {
      const pts = [];
      for (let u = 0; u <= 1.0001; u += 0.01) { const p = ridgePoint(k, u); pts.push([p.x, p.y]); }
      polyline(g, pts, "stroke:currentColor;stroke-opacity:0.18;stroke-width:3.2;stroke-linecap:round");
    }
    // Arches above the loop.
    for (let k = 0; k < 6; k++) {
      const y0 = 10 + k * 9;
      el("path", { d: `M0,${y0 + 60} Q210,${y0 - 30} 420,${y0 + 60}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.18;stroke-width:3.2" }, g);
    }
    el("ellipse", { cx: 210, cy: 215, rx: 180, ry: 200, style: "fill:none;stroke:currentColor;stroke-opacity:0.3" }, svg);
    target.forEach((p, j) => minutia(svg, p, pr.has(j) ? BRAND : "var(--foreground)", pr.has(j) ? 1.8 : 1));
    // The mark's outline and minutiae.
    const mc = { x: mark.reduce((a, p) => a + p.x, 0) / mark.length, y: mark.reduce((a, p) => a + p.y, 0) / mark.length };
    el("circle", { cx: mc.x, cy: mc.y, r: 115, style: `fill:${U};fill-opacity:0.05;stroke:${U};stroke-dasharray:5 4;stroke-opacity:0.6` }, svg);
    mark.forEach((p, i) => minutia(svg, p, pm.has(i) ? BRAND : U, 1.6));

    o.nm.textContent = String(mark.length);
    o.paired.textContent = String(pairs.length);
    o.unpaired.textContent = String(mark.length - pairs.length);
  }
  build();
  draw();
}

// ============================================================ F8 Glass

// Synthetic reference collection: float glass, containers, others.
const GLASS_POP = [[0.8, 1.5180, 0.0012], [0.15, 1.5200, 0.0015], [0.05, 1.5235, 0.003]];
const normCdf = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};
const popPdf = (x) => GLASS_POP.reduce((a, [w, m, sd]) => a + (w * Math.exp(-0.5 * ((x - m) / sd) ** 2)) / (sd * Math.sqrt(2 * Math.PI)), 0);
const popIn = (lo, hi) => GLASS_POP.reduce((a, [w, m, sd]) => a + w * (normCdf((hi - m) / sd) - normCdf((lo - m) / sd)), 0);

for (const root of document.querySelectorAll("[data-foren-glass]")) {
  const dots = root.querySelector("[data-dots]");
  const pop = root.querySelector("[data-pop]");
  const o = outs(root);
  let seed = 5;
  const glass = seg(root, "glass", draw);
  const crit = seg(root, "crit", draw);
  const s = scrubAll(root, draw);
  onAction(root, "reseed", () => { seed = newSeed(); draw(); });
  const SD = 4e-5;

  function draw() {
    const r = rng(seed);
    const mu = glass.get() === "rare" ? 1.5248 : 1.5180;
    const ctrl = Array.from({ length: 6 }, () => mu + SD * r.gauss());
    const nrec = Math.round(s.nrec.get());
    const rec = Array.from({ length: nrec }, () => mu + s.shift.get() * 1e-5 + SD * r.gauss());
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : SD; };
    const cm = mean(ctrl), cs = Math.max(sdv(ctrl), SD), rm = mean(rec), rs = nrec > 1 ? sdv(rec) : SD;
    let pass, critText;
    if (crit.get() === "range") {
      pass = rec.every((x) => Math.abs(x - cm) <= 2 * cs);
      critText = pass ? "all within ±2 sd" : "outside ±2 sd";
    } else {
      const v1 = cs * cs / ctrl.length, v2 = rs * rs / nrec;
      const t = (rm - cm) / Math.sqrt(v1 + v2);
      const df = (v1 + v2) ** 2 / (v1 * v1 / (ctrl.length - 1) + v2 * v2 / Math.max(1, nrec - 1));
      const p = 2 * (1 - tcdf(Math.abs(t), df));
      pass = p > 0.05;
      critText = `t = ${num(t, 2)}, p = ${num(p, 3)}`;
    }
    const f = popIn(rm - 1e-4, rm + 1e-4);
    o.cm.textContent = cm.toFixed(5);
    o.rm.textContent = rm.toFixed(5);
    o.crit.textContent = critText;
    o.freq.textContent = pct(f, 2);
    o.lr.textContent = pass ? `≈ ${group(1 / f, 0)}` : "—";
    if (!pass) verdict(root, "del", "The recovered fragments are distinguishable from the window: by this criterion they did not come from it. (With few fragments and strict criteria, glass from the window is also sometimes rejected.)");
    else verdict(root, "brand", `Indistinguishable from the window. But ${pct(f, 1)} of glass in the reference collection lies within ±1×10⁻⁴ of this value, so the match supports a common source by a factor of only about ${group(1 / f, 0)}${f > 0.02 ? ": many other windows would match too" : ""}.`);

    // Strip of measurements.
    dots.replaceChildren();
    const lo = mu - 30e-5, hi = mu + 30e-5;
    const sx = (x) => 30 + ((x - lo) / (hi - lo)) * 540;
    el("rect", { x: sx(cm - 2 * cs), y: 20, width: sx(cm + 2 * cs) - sx(cm - 2 * cs), height: 90, style: `fill:${BRAND};fill-opacity:0.12` }, dots);
    el("line", { x1: 30, x2: 570, y1: 110, y2: 110, style: "stroke:currentColor;stroke-opacity:0.3" }, dots);
    for (let t = -30; t <= 30; t += 10) {
      el("line", { x1: sx(mu + t * 1e-5), x2: sx(mu + t * 1e-5), y1: 110, y2: 114, style: "stroke:currentColor;stroke-opacity:0.4" }, dots);
      text(dots, sx(mu + t * 1e-5), 126, (mu + t * 1e-5).toFixed(4), { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[8.5px]" });
    }
    ctrl.forEach((x, i) => el("circle", { cx: sx(Math.max(lo, Math.min(hi, x))), cy: 45 + (i % 3) * 7, r: 4, style: "fill:currentColor;fill-opacity:0.7" }, dots));
    rec.forEach((x, i) => el("circle", { cx: sx(Math.max(lo, Math.min(hi, x))), cy: 82 + (i % 3) * 7, r: 4, style: `fill:${U}` }, dots));
    text(dots, 30, 14, "window (control)", { class: "fill-foreground text-[10px]" });
    text(dots, 30, 104, "recovered", { class: "fill-foreground text-[10px]", style: `fill:${U}` });
    text(dots, sx(cm + 2 * cs) + 4, 14, "control ±2 sd", { class: "fill-muted-foreground text-[10px]" });

    // Population density.
    pop.replaceChildren();
    const fr = frame(pop, { box: [30, 16, 540, 150], x: [1.512, 1.53], y: [0, 300], xticks: [1.512, 1.515, 1.518, 1.521, 1.524, 1.527, 1.53], xfmt: (v) => v.toFixed(3), xlabel: "refractive index", ylabel: "reference collection (density)" });
    const pts = [];
    for (let x = 1.512; x <= 1.5300001; x += 0.00005) pts.push([fr.sx(x), fr.sy(Math.min(300, popPdf(x)))]);
    el("polygon", { points: `${fr.sx(1.512)},${fr.sy(0)} ${pts.map((p) => p.join(",")).join(" ")} ${fr.sx(1.53)},${fr.sy(0)}`, style: "fill:currentColor;fill-opacity:0.08" }, pop);
    polyline(pop, pts, "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.2");
    el("line", { x1: fr.sx(rm), x2: fr.sx(rm), y1: fr.T, y2: fr.T + fr.H, style: `stroke:${BRAND};stroke-width:2` }, pop);
    text(pop, fr.sx(rm) + 5, fr.T + 10, `recovered, ${pct(f, 1)} of glass within ±1×10⁻⁴`, { class: "fill-foreground font-mono text-[9.5px]", "text-anchor": rm > 1.524 ? "end" : "start", dx: rm > 1.524 ? -10 : 0 });
  }
  draw();
}

// ============================================================ F9 Entomology

// Accumulated degree hours to reach each stage, illustrative values of the
// order reported for Lucilia sericata.
const STAGE_ADH = { egg: 0, l1: 250, l2: 600, l3: 1100, post: 2300, pupa: 3500 };
const STAGE_NAME = { egg: "eggs", l1: "first instar", l2: "second instar", l3: "third instar", post: "post-feeding larvae", pupa: "pupae" };

for (const root of document.querySelectorAll("[data-foren-insect]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const stage = seg(root, "stage", draw);
  stage.set("l3");
  const s = scrubAll(root, draw);

  function draw() {
    const mean = s.mean.get(), amp = s.amp.get(), base = s.base.get();
    const need = STAGE_ADH[stage.get()];
    // Discovery at noon; walk back hour by hour.
    const temp = (h) => mean + amp * Math.sin((2 * Math.PI * (12 - h - 9)) / 24);
    let acc = 0, h = 0;
    const accum = [[0, 0]];
    const LIMIT = 24 * 60;
    while (acc < need && h < LIMIT) {
      acc += Math.max(0, temp(h + 0.5) - base);
      h++;
      accum.push([h, acc]);
    }
    const reached = acc >= need;
    const pmiC = mean > base ? need / (mean - base) : Infinity;
    o.need.textContent = `${group(need)} °C·h`;
    o.pmi.textContent = need === 0 ? "≈ 0 (eggs laid)" : reached ? `${num(h / 24, 1)} days (${group(h)} h)` : "> 60 days";
    o.pmic.textContent = need === 0 ? "—" : Number.isFinite(pmiC) ? `${num(pmiC / 24, 1)} days` : "never";

    svg.replaceChildren();
    const days = Math.max(3, Math.ceil(((reached ? h : 72) + 12) / 24));
    const hmax = days * 24;
    // Top: temperature; bottom: accumulated degree hours.
    const ft = frame(svg, { box: [52, 16, 520, 110], x: [hmax, 0], y: [Math.min(0, mean - amp - 3), Math.max(35, mean + amp + 3)], xticks: [], yticks: niceTicks(Math.min(0, mean - amp - 3), Math.max(35, mean + amp + 3), 3), ylabel: "scene temperature, °C" });
    const tp = [];
    for (let x = 0; x <= hmax; x += 1) tp.push([ft.sx(x), ft.sy(temp(x))]);
    const yb = Math.max(ft.T, Math.min(ft.T + ft.H, ft.sy(base)));
    el("rect", { x: ft.L, y: yb, width: ft.W, height: ft.T + ft.H - yb, style: "fill:currentColor;fill-opacity:0.05" }, svg);
    text(svg, ft.L + 4, ft.T + ft.H - 4, "no development below base", { class: "fill-muted-foreground font-mono text-[9px]" });
    hline(svg, ft, base, `stroke:${DEL};stroke-dasharray:4 3`, `base ${num(base, 1)} °C`);
    polyline(svg, tp, `stroke:${OUT};stroke-width:1.5`);
    const ymax = Math.max(need, 100) * 1.15;
    const fb = frame(svg, { box: [52, 170, 520, 110], x: [hmax, 0], y: [0, ymax], xticks: niceTicks(0, days, Math.min(days, 8)).map((d) => d * 24), xfmt: (v) => `${v / 24}`, yticks: niceTicks(0, ymax, 3), xlabel: "days before discovery", ylabel: "degree hours accumulated, °C·h" });
    polyline(svg, accum.map(([x, y]) => [fb.sx(x), fb.sy(Math.min(y, ymax))]), `stroke:${U};stroke-width:2`);
    if (need > 0) hline(svg, fb, need, `stroke:${BRAND};stroke-dasharray:5 3`, `${STAGE_NAME[stage.get()]}: ${group(need)}`);
    if (reached && need > 0) {
      for (const f of [ft, fb]) el("line", { x1: f.sx(h), x2: f.sx(h), y1: f.T, y2: f.T + f.H, style: `stroke:${BRAND};stroke-width:1.5` }, svg);
      text(svg, fb.sx(h) + 4, fb.T + 12, `min PMI ${num(h / 24, 1)} d`, { class: "fill-foreground font-mono text-[10px]" });
    }
  }
  draw();
}

// ============================================================ F10 Stature

for (const root of document.querySelectorAll("[data-foren-stature]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 3;
  const s = scrubAll(root, draw);
  onToggle(root, () => queueMicrotask(draw));
  onAction(root, "reseed", () => { seed = newSeed(); draw(); });

  function draw() {
    const r = rng(seed);
    const n = Math.round(s.n.get());
    const xs = [], ys = [];
    for (let i = 0; i < n; i++) {
      const x = 25.5 + 1.6 * r.gauss();
      xs.push(x);
      ys.push(6.6 * x + 7 * r.gauss());
    }
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
    const b = sxy / sxx, a = my - b * mx;
    const sse = syy - b * sxy;
    const se = Math.sqrt(sse / (n - 2));
    const t = tq(0.975, n - 2);
    const x0 = s.foot.get();
    const pred = a + b * x0;
    const half = (x, extra) => t * se * Math.sqrt(extra + 1 / n + (x - mx) ** 2 / sxx);
    o.fit.textContent = `${num(a, 1)} + ${num(b, 2)}·foot`;
    o.r.textContent = num(sxy / Math.sqrt(sxx * syy), 3);
    o.pred.textContent = `${num(pred, 1)} cm`;
    o.pi.textContent = `${num(pred - half(x0, 1), 0)} – ${num(pred + half(x0, 1), 0)} cm`;
    o.ci.textContent = `${num(pred - half(x0, 0), 1)} – ${num(pred + half(x0, 0), 1)} cm`;

    svg.replaceChildren();
    const f = frame(svg, { box: [52, 16, 520, 250], x: [20, 32], y: [130, 215], xticks: [20, 22, 24, 26, 28, 30, 32], yticks: [140, 160, 180, 200], xlabel: "foot length, cm", ylabel: "stature, cm" });
    const band = (extra) => {
      const up = [], dn = [];
      for (let x = 20; x <= 32.0001; x += 0.2) { up.push([f.sx(x), f.sy(a + b * x + half(x, extra))]); dn.push([f.sx(x), f.sy(a + b * x - half(x, extra))]); }
      return [...up, ...dn.reverse()].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
    };
    const clip = el("clipPath", { id: "foren-stat-clip" }, el("defs", {}, svg));
    el("rect", { x: f.L, y: f.T, width: f.W, height: f.H }, clip);
    const g = el("g", { "clip-path": "url(#foren-stat-clip)" }, svg);
    el("polygon", { points: band(1), style: `fill:${BRAND};fill-opacity:0.1` }, g);
    if (isOn(root, "ci")) el("polygon", { points: band(0), style: `fill:${U};fill-opacity:0.25` }, g);
    xs.forEach((x, i) => el("circle", { cx: f.sx(x), cy: f.sy(ys[i]), r: 2.6, style: "fill:currentColor;fill-opacity:0.55" }, g));
    el("line", { x1: f.sx(20), y1: f.sy(a + b * 20), x2: f.sx(32), y2: f.sy(a + b * 32), style: "stroke:currentColor;stroke-width:1.5" }, g);
    el("line", { x1: f.sx(x0), x2: f.sx(x0), y1: f.sy(pred - half(x0, 1)), y2: f.sy(pred + half(x0, 1)), style: `stroke:${BRAND};stroke-width:3;stroke-linecap:round` }, g);
    el("circle", { cx: f.sx(x0), cy: f.sy(pred), r: 4.5, style: `fill:${BRAND}` }, g);
    text(svg, f.sx(x0) + 8, f.sy(pred + half(x0, 1)) + 4, `${num(pred - half(x0, 1), 0)}–${num(pred + half(x0, 1), 0)} cm`, { class: "fill-foreground font-mono text-[10px]" });
  }
  draw();
}
