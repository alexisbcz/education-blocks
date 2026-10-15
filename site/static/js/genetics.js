// Genetics blocks: pedigrees, linkage, χ² for crosses, the replication
// fork, PCR, restriction digests, Cas9 targets, the lac operon, global
// alignment and a synthetic GWAS. Every block root is data-gen-*, and the
// module does nothing on pages without them.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ROMAN = ["I", "II", "III", "IV", "V"];

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scientific notation with a real superscript exponent: 3.2 × 10⁹.
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
function sci(v, d = 1) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 4) return num(v, v < 10 ? 2 : 0);
  const m = v / 10 ** e;
  return `${num(m, d)} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
}

// Arrow-key and button stepper shared by the fork and the linkage figure.
function stepper(root, count, show) {
  let at = 0;
  const back = root.querySelector('[data-go="-1"]');
  const next = root.querySelector('[data-go="1"]');
  const go = (i) => {
    at = Math.max(0, Math.min(count - 1, i));
    if (back) back.disabled = at === 0;
    if (next) next.disabled = at === count - 1;
    show(at);
  };
  back?.addEventListener("click", () => go(at - 1));
  next?.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, button")) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: count - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  });
  go(0);
  return go;
}

// ============================================================ Pedigrees

// Person: [id, sex, affected, generation, x]. Couple: [a, b, children, consanguineous].
const PEDIGREES = {
  ad: {
    people: [["a", "M", 1, 0, 270], ["b", "F", 0, 0, 370],
      ["c", "F", 1, 1, 130], ["d", "M", 0, 1, 230], ["e", "M", 1, 1, 380], ["f", "F", 0, 1, 490],
      ["g", "M", 1, 2, 360], ["h", "F", 1, 2, 440], ["i", "M", 0, 2, 520]],
    couples: [["a", "b", ["c", "d", "e"]], ["e", "f", ["g", "h", "i"]]],
  },
  ar: {
    people: [["a", "M", 0, 0, 250], ["b", "F", 0, 0, 350],
      ["k", "F", 0, 1, 70], ["c", "M", 0, 1, 170], ["d", "F", 1, 1, 300], ["e", "F", 0, 1, 430], ["l", "M", 0, 1, 540],
      ["f", "F", 0, 2, 60], ["g", "M", 0, 2, 190], ["h", "F", 0, 2, 420], ["i", "M", 0, 2, 560],
      ["m", "M", 1, 3, 270], ["n", "F", 0, 3, 350]],
    couples: [["a", "b", ["c", "d", "e"]], ["c", "k", ["f", "g"]], ["l", "e", ["h", "i"]], ["g", "h", ["m", "n"], true]],
  },
  xr: {
    people: [["a", "M", 0, 0, 270], ["b", "F", 0, 0, 370],
      ["c", "M", 1, 1, 90], ["d", "F", 0, 1, 210], ["k", "M", 0, 1, 300], ["e", "M", 0, 1, 390], ["f", "F", 0, 1, 490], ["l", "M", 0, 1, 590],
      ["g", "M", 1, 2, 190], ["h", "F", 0, 2, 260], ["i", "M", 0, 2, 330], ["j", "M", 1, 2, 500], ["m", "F", 0, 2, 580]],
    couples: [["a", "b", ["c", "d", "e", "f"]], ["k", "d", ["g", "h", "i"]], ["l", "f", ["j", "m"]]],
  },
  xd: {
    people: [["a", "M", 1, 0, 270], ["b", "F", 0, 0, 370],
      ["c", "F", 1, 1, 90], ["d", "M", 0, 1, 190], ["e", "F", 1, 1, 330], ["k", "M", 0, 1, 430], ["f", "M", 0, 1, 560],
      ["g", "M", 1, 2, 290], ["h", "F", 0, 2, 360], ["i", "F", 1, 2, 430], ["j", "M", 0, 2, 500]],
    couples: [["a", "b", ["c", "d", "e", "f"]], ["k", "e", ["g", "h", "i", "j"]]],
  },
  mt: {
    people: [["a", "M", 0, 0, 270], ["b", "F", 1, 0, 370],
      ["c", "M", 1, 1, 110], ["k", "F", 0, 1, 200], ["d", "F", 1, 1, 330], ["l", "M", 0, 1, 430], ["e", "F", 1, 1, 560],
      ["f", "F", 0, 2, 120], ["g", "M", 0, 2, 190], ["h", "M", 1, 2, 330], ["i", "F", 1, 2, 400], ["j", "F", 1, 2, 470]],
    couples: [["a", "b", ["c", "d", "e"]], ["c", "k", ["f", "g"]], ["l", "d", ["h", "i", "j"]]],
  },
};

const MODES = [
  ["ad", "Autosomal dominant"],
  ["ar", "Autosomal recessive"],
  ["xr", "X-linked recessive"],
  ["xd", "X-linked dominant"],
  ["mt", "Mitochondrial"],
];

// analyse tests every mode against every family (couple and children).
// Rules assume full penetrance, no new mutations and a rare allele.
function analyse(P, couples, name) {
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  const hasParents = new Set(couples.flatMap((c) => c.kids));
  const out = {};
  for (const [mode] of MODES) out[mode] = { why: null, ids: [], carriers: new Set() };
  const exclude = (mode, why, ids) => { if (!out[mode].why) { out[mode].why = why; out[mode].ids = ids; } };
  for (const c of couples) {
    const [x, y] = [byId[c.a], byId[c.b]];
    const dad = x.sex === "M" ? x : y, mom = x.sex === "M" ? y : x;
    for (const kid of c.kids.map((k) => byId[k])) {
      const n = name(kid.id);
      // Autosomal dominant: an affected child needs an affected parent.
      if (kid.aff && !dad.aff && !mom.aff) exclude("ad", `${n} is affected but neither parent is.`, [kid.id, dad.id, mom.id]);
      // Autosomal recessive: two affected parents have only affected children.
      if (!kid.aff && dad.aff && mom.aff) exclude("ar", `${n} is unaffected, yet both parents are affected (aa × aa gives only aa).`, [kid.id, dad.id, mom.id]);
      if (kid.aff) for (const p of [dad, mom]) if (!p.aff) out.ar.carriers.add(p.id);
      // X-linked recessive.
      if (kid.aff && kid.sex === "F" && !dad.aff) exclude("xr", `${n} is an affected daughter of an unaffected father, who would have passed her a normal X.`, [kid.id, dad.id]);
      if (!kid.aff && kid.sex === "M" && mom.aff) exclude("xr", `${n} is an unaffected son of an affected mother; her sons get one of her two affected X's.`, [kid.id, mom.id]);
      if (!kid.aff && kid.sex === "F" && mom.aff && dad.aff) exclude("xr", `${n} is unaffected, yet both parents are affected.`, [kid.id, dad.id, mom.id]);
      if (kid.aff && !mom.aff) out.xr.carriers.add(mom.id);
      // X-linked dominant.
      if (!kid.aff && kid.sex === "F" && dad.aff) exclude("xd", `${n} is an unaffected daughter of an affected father, who passes his X to every daughter.`, [kid.id, dad.id]);
      if (kid.aff && kid.sex === "M" && !mom.aff) exclude("xd", `${n} is an affected son of an unaffected mother; a son's X comes from his mother.`, [kid.id, mom.id]);
      if (kid.aff && !dad.aff && !mom.aff) exclude("xd", `${n} is affected but neither parent is.`, [kid.id, dad.id, mom.id]);
      // Mitochondrial: inherited from the mother only, by every child.
      if (!kid.aff && mom.aff) exclude("mt", `${n} is unaffected, yet the mother is: mitochondria pass to all her children.`, [kid.id, mom.id]);
      if (kid.aff && !mom.aff) exclude("mt", `${n} is affected but the mother is not; fathers don't pass on mitochondria.`, [kid.id, mom.id]);
    }
  }
  // Carriers who married in (no parents in the tree) are the improbable part
  // for a rare allele.
  for (const [mode] of MODES) {
    const r = out[mode];
    r.foreign = [...r.carriers].filter((id) => !hasParents.has(id));
  }
  // Signatures that tip a tie: an affected father whose daughters are all
  // affected and sons all unaffected (X-linked dominant); affected mothers
  // passing it to every child while affected fathers pass it to none
  // (mitochondrial).
  const kidsOf = (c) => c.kids.map((k) => byId[k]);
  const parentsOf = (c) => { const [x, y] = [byId[c.a], byId[c.b]]; return x.sex === "M" ? [x, y] : [y, x]; };
  out.xd.signature = couples.some((c) => {
    const [dad] = parentsOf(c), k = kidsOf(c);
    const sons = k.filter((x) => x.sex === "M"), daughters = k.filter((x) => x.sex === "F");
    return dad.aff && sons.length && daughters.length && daughters.every((x) => x.aff) && sons.every((x) => !x.aff);
  });
  out.mt.signature = couples.some((c) => { const [, mom] = parentsOf(c); return mom.aff && kidsOf(c).length >= 2 && kidsOf(c).every((x) => x.aff); })
    && couples.some((c) => { const [dad, mom] = parentsOf(c); return dad.aff && !mom.aff && kidsOf(c).every((x) => !x.aff); });
  return out;
}

for (const root of document.querySelectorAll("[data-gen-pedigree]")) {
  const svg = root.querySelector("[data-ped-svg]");
  const list = root.querySelector("[data-ped-modes]");
  let P, C, labels;

  const load = (key) => {
    const def = PEDIGREES[key];
    P = def.people.map(([id, sex, aff, g, x]) => ({ id, sex, aff: !!aff, g, x }));
    C = def.couples.map(([a, b, kids, cons]) => ({ a, b, kids, cons: !!cons }));
    labels = {};
    for (let g = 0; g < 5; g++) P.filter((p) => p.g === g).sort((p, q) => p.x - q.x).forEach((p, i) => (labels[p.id] = `${ROMAN[g]}-${i + 1}`));
    draw();
  };

  const Y = (g) => 40 + g * 100;
  function draw(mark = []) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 640 ${Y(Math.max(...P.map((p) => p.g))) + 46}`);
    const ink = "stroke:var(--foreground);stroke-width:1.5;fill:none";
    for (const c of C) {
      const a = P.find((p) => p.id === c.a), b = P.find((p) => p.id === c.b);
      const [l, r] = a.x < b.x ? [a, b] : [b, a];
      const y = Y(a.g);
      for (const dy of c.cons ? [-3, 3] : [0]) el("line", { x1: l.x + 13, x2: r.x - 13, y1: y + dy, y2: y + dy, style: ink }, svg);
      const kids = c.kids.map((k) => P.find((p) => p.id === k));
      const mid = (l.x + r.x) / 2, sib = y + 52;
      const xs = kids.map((k) => k.x);
      el("line", { x1: mid, x2: mid, y1: y + (c.cons ? 3 : 0), y2: sib, style: ink }, svg);
      el("line", { x1: Math.min(mid, ...xs), x2: Math.max(mid, ...xs), y1: sib, y2: sib, style: ink }, svg);
      for (const k of kids) el("line", { x1: k.x, x2: k.x, y1: sib, y2: Y(k.g) - 13, style: ink }, svg);
    }
    for (const p of P) {
      const y = Y(p.g);
      const g = el("g", { "data-person": p.id, tabindex: 0, role: "button", class: "cursor-pointer outline-none",
        "aria-label": `${labels[p.id]}, ${p.sex === "M" ? "male" : "female"}, ${p.aff ? "affected" : "unaffected"}` }, svg);
      const hit = mark.includes(p.id);
      const style = `fill:${p.aff ? "var(--foreground)" : "var(--background)"};stroke:${hit ? "var(--brand)" : "var(--foreground)"};stroke-width:${hit ? 3 : 1.5}`;
      if (p.sex === "M") el("rect", { x: p.x - 13, y: y - 13, width: 26, height: 26, style }, g);
      else el("circle", { cx: p.x, cy: y, r: 13, style }, g);
      text(g, p.x, y + 30, labels[p.id], { "text-anchor": "middle", class: hit ? "fill-brand font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
    }
  }

  function verdicts() {
    const res = analyse(P, C, (id) => labels[id]);
    const ok = MODES.filter(([m]) => !res[m].why);
    const fewest = Math.min(...ok.map(([m]) => res[m].foreign.length));
    const sig = ok.map(([m]) => m).filter((m) => res[m].signature && res[m].foreign.length === fewest);
    list.innerHTML = MODES.map(([m, label]) => {
      const r = res[m];
      const good = !r.why;
      const best = good && ok.length > 1 && (sig.length ? sig.includes(m) : r.foreign.length === fewest);
      const note = good
        ? (r.foreign.length ? `Consistent, if ${r.foreign.map((id) => labels[id]).join(", ")} ${r.foreign.length > 1 ? "are unaffected carriers" : "is an unaffected carrier"} from outside the tree.` : "Consistent with every family in the tree.")
          + (best && r.signature ? (m === "xd" ? " An affected father with only affected daughters and unaffected sons is its signature." : " Affected mothers pass it to all their children, affected fathers to none: its signature.") : "")
        : r.why;
      return `<li data-ids="${(good ? r.foreign : r.ids).join(" ")}" class="flex cursor-default gap-2.5 rounded-lg border p-2.5 text-xs leading-relaxed transition-colors duration-150 hover:bg-accent/40 ${good ? "" : "opacity-80"}">
        <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] ${good ? "bg-add/15 text-add" : "bg-del/12 text-del"}">${good ? "✓" : "✗"}</span>
        <span class="flex flex-col gap-0.5"><span class="flex items-center gap-1.5 font-medium text-foreground">${label}${best ? '<span class="rounded-full bg-brand/12 px-1.5 text-[10px] font-medium text-brand">most likely</span>' : ""}</span>
        <span class="text-muted-foreground">${esc(note)}</span></span></li>`;
    }).join("");
    for (const li of list.children) {
      li.addEventListener("pointerenter", () => draw(li.dataset.ids.split(" ").filter(Boolean)));
      li.addEventListener("pointerleave", () => draw());
    }
  }

  const toggle = (id) => {
    const p = P.find((q) => q.id === id);
    p.aff = !p.aff;
    draw();
    svg.querySelector(`[data-person="${id}"]`)?.focus();
    verdicts();
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-person]"); if (g) toggle(g.dataset.person); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-person]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(g.dataset.person); }
  });
  root.addEventListener("seg-change", (e) => { load(e.detail.value); verdicts(); });
  load("ad");
  verdicts();
}

// ============================================================ Linkage

const LINK_STEPS = [
  "Before meiosis I, each homologous chromosome has replicated into two sister chromatids. One homolog carries alleles A and B, the other a and b.",
  "The homologs pair. A crossover (chiasma) forms between the two loci, joining one chromatid of each homolog.",
  "Crossing over swaps the chromatid ends beyond the chiasma: those two chromatids now carry A b and a B.",
  "The four chromatids end up in four gametes: two parental (A B, a b) and two recombinant (A b, a B). The farther apart two genes are, the more often a crossover falls between them.",
];

const THREE_DEFAULT = [["ABC", 435], ["abc", 424], ["Abc", 46], ["aBC", 44], ["AbC", 25], ["aBc", 23], ["ABc", 2], ["abC", 1]];

for (const root of document.querySelectorAll("[data-gen-linkage]")) {
  const o = outs(root);
  const chrom = root.querySelector("[data-link-chrom]");
  const mapSvg = root.querySelector("[data-link-map]");
  const stepText = root.querySelector("[data-link-step-text]");
  const rows = root.querySelector("[data-three-rows]");
  const threeMap = root.querySelector("[data-three-map]");
  const s = scrubAll(root, twoPoint);

  // The chromosome figure: 4 chromatids, loci at x = 150 and 410.
  function drawChrom(step) {
    chrom.replaceChildren();
    const ys = [42, 72, 122, 152];
    const colA = "var(--brand)", colB = "var(--vec-u)";
    ys.forEach((y, i) => {
      const home = i < 2 ? colA : colB;
      const swapped = step >= 2 && (i === 1 || i === 2);
      const right = swapped ? (i === 1 ? colB : colA) : home;
      el("rect", { x: 40, y: y - 7, width: 240, height: 14, rx: 7, style: `fill:color-mix(in oklab, ${home} 22%, var(--code-bg));stroke:${home}` }, chrom);
      el("rect", { x: 280, y: y - 7, width: 240, height: 14, rx: 7, style: `fill:color-mix(in oklab, ${right} 22%, var(--code-bg));stroke:${right}` }, chrom);
      const upper = i < 2;
      const a = upper ? "A" : "a";
      const b = swapped ? (upper ? "b" : "B") : (upper ? "B" : "b");
      for (const [x, l] of [[150, a], [410, b]]) {
        el("rect", { x: x - 3, y: y - 7, width: 6, height: 14, style: "fill:var(--foreground)" }, chrom);
        text(chrom, x + 10, y + 4, l, { class: "fill-foreground font-mono text-[12px] font-medium" });
      }
      if (step === 3) {
        const rec = swapped;
        text(chrom, 532, y + 4, rec ? "recombinant" : "parental", { class: rec ? "fill-brand font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
      }
    });
    // The chiasma.
    if (step === 1) {
      el("path", { d: "M 268 72 L 292 122 M 292 72 L 268 122", style: "stroke:var(--foreground);stroke-width:2.5;stroke-linecap:round" }, chrom);
      text(chrom, 300, 100, "chiasma", { class: "fill-foreground font-mono text-[10px]" });
    }
    stepText.textContent = LINK_STEPS[step];
  }
  stepper(root.querySelector('[data-view="two"]'), LINK_STEPS.length, drawChrom);

  function twoPoint() {
    const total = Math.max(1, s.total.get());
    const rec = Math.min(s.rec.get(), total);
    const r = rec / total;
    const rc = Math.min(r, 0.4999);
    const naive = 100 * r, hal = -50 * Math.log(1 - 2 * rc);
    o.r.textContent = `${num(r * 100, 1)}%`;
    o.naive.textContent = `${num(naive, 1)} cM`;
    o.haldane.textContent = r >= 0.5 ? "∞" : `${num(hal, 1)} cM`;
    o.link.textContent = r > 0.5 ? "r > 50%: check the counts" : r >= 0.45 ? "looks unlinked (r ≈ 50%)" : "linked";
    mapSvg.replaceChildren();
    const f = frame(mapSvg, { box: [44, 22, 500, 114], x: [0, 0.5], y: [0, 150], xticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yticks: [0, 50, 100, 150], xlabel: "recombination frequency r", ylabel: "cM", xfmt: (v) => `${Math.round(v * 100)}%` });
    polyline(mapSvg, Array.from({ length: 101 }, (_, i) => { const x = i * 0.005; return [f.sx(x), f.sy(100 * x)]; }), "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:1.25;stroke-dasharray:4 4");
    polyline(mapSvg, Array.from({ length: 99 }, (_, i) => i * 0.005).filter((x) => -50 * Math.log(1 - 2 * x) <= 150).map((x) => [f.sx(x), f.sy(-50 * Math.log(1 - 2 * x))]), "stroke:var(--brand);stroke-width:1.75");
    text(mapSvg, f.sx(0.42), f.sy(22), "naive: 1% = 1 cM", { "text-anchor": "middle" });
    text(mapSvg, f.sx(0.36), f.sy(92), "Haldane", { class: "fill-brand font-mono text-[10px]" });
    if (r < 0.5) el("circle", { cx: f.sx(r), cy: f.sy(Math.min(150, hal)), r: 4, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, mapSvg);
  }

  // Three-point cross.
  let counts = THREE_DEFAULT.map((c) => c.slice());
  const isUp = (ch) => ch === ch.toUpperCase();
  const comp = (s) => s.split("").map((c) => (isUp(c) ? c.toLowerCase() : c.toUpperCase())).join("");
  const pretty = (s) => s.split("").map((c) => `<span class="${isUp(c) ? "text-foreground" : "text-muted-foreground"}">${c}</span>`).join(" ");

  function renderRows() {
    rows.innerHTML = counts.map(([cls, n], i) => `<tr class="border-b last:border-b-0">
      <td class="py-1.5 pr-3 font-mono text-[13px] tracking-wider">${pretty(cls)}</td>
      <td class="py-1.5 pr-3 text-right"><input data-three-count="${i}" value="${n}" inputmode="numeric" aria-label="Count for ${cls}"
        class="h-8 w-20 rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"></td>
      <td class="py-1.5 text-xs" data-three-type="${i}"></td></tr>`).join("");
    rows.querySelectorAll("[data-three-count]").forEach((inp) => inp.addEventListener("input", () => {
      counts[inp.dataset.threeCount][1] = Math.max(0, parseInt(inp.value, 10) || 0);
      threePoint();
    }));
  }

  function threePoint() {
    const map = Object.fromEntries(counts);
    const n = counts.reduce((a, c) => a + c[1], 0) || 1;
    const pairs = counts.filter(([c]) => isUp(c[0])).map(([c]) => [c, comp(c), (map[c] ?? 0) + (map[comp(c)] ?? 0)]);
    pairs.sort((a, b) => b[2] - a[2]);
    const parental = pairs[0], dco = pairs[pairs.length - 1];
    const p = parental[0];
    const diff = (a, b) => [0, 1, 2].filter((i) => a[i] !== b[i]);
    const d1 = diff(dco[0], p), d2 = diff(dco[0], comp(p));
    const mid = (d1.length === 1 ? d1 : d2)[0];
    const genes = ["A", "B", "C"];
    const outer = [0, 1, 2].filter((i) => i !== mid);
    const rel = (s, i, j) => isUp(s[i]) === isUp(s[j]);
    const r = (i, j) => counts.reduce((a, [c, k]) => a + (rel(c, i, j) !== rel(p, i, j) ? k : 0), 0) / n;
    const ra = r(outer[0], mid), rb = r(mid, outer[1]);
    const obs = dco[2] / n;
    const exp = ra * rb;
    o.order.textContent = `${genes[outer[0]]} — ${genes[mid]} — ${genes[outer[1]]}`;
    o.d1.textContent = `${genes[outer[0]]}–${genes[mid]}: ${num(ra * 100, 1)} cM`;
    o.d2.textContent = `${genes[mid]}–${genes[outer[1]]}: ${num(rb * 100, 1)} cM`;
    o.edco.textContent = `${num(exp * n, 1)} (observed ${dco[2]})`;
    const coc = exp > 0 ? obs / exp : NaN;
    o.coc.textContent = Number.isFinite(coc) ? num(coc, 2) : "—";
    o.interf.textContent = Number.isFinite(coc) ? num(1 - coc, 2) : "—";
    counts.forEach(([c], i) => {
      const cell = rows.querySelector(`[data-three-type="${i}"]`);
      const pair = [c, comp(c)];
      const type = pair.includes(parental[0]) ? ["parental", "text-muted-foreground"]
        : pair.includes(dco[0]) ? ["double crossover", "text-brand"]
        : rel(c, outer[0], mid) !== rel(p, outer[0], mid) ? [`crossover ${genes[outer[0]]}–${genes[mid]}`, "text-vec-u"]
        : [`crossover ${genes[mid]}–${genes[outer[1]]}`, "text-vec-u"];
      cell.textContent = type[0];
      cell.className = `py-1.5 text-xs ${type[1]}`;
    });
    threeMap.replaceChildren();
    const total = ra + rb || 1;
    const x0 = 40, x1 = 520, xm = x0 + ((x1 - x0) * ra) / total;
    el("line", { x1: x0, x2: x1, y1: 40, y2: 40, style: "stroke:var(--foreground);stroke-width:6;stroke-linecap:round;stroke-opacity:0.15" }, threeMap);
    for (const [x, g] of [[x0, outer[0]], [xm, mid], [x1, outer[1]]]) {
      el("line", { x1: x, x2: x, y1: 30, y2: 50, style: `stroke:${g === mid ? "var(--brand)" : "var(--foreground)"};stroke-width:2.5` }, threeMap);
      text(threeMap, x, 22, genes[g], { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px] font-medium" });
    }
    text(threeMap, (x0 + xm) / 2, 68, `${num(ra * 100, 1)} cM`, { "text-anchor": "middle" });
    text(threeMap, (xm + x1) / 2, 68, `${num(rb * 100, 1)} cM`, { "text-anchor": "middle" });
  }

  root.querySelector("[data-action=reset-three]")?.addEventListener("click", () => { counts = THREE_DEFAULT.map((c) => c.slice()); renderRows(); threePoint(); });
  renderRows();
  twoPoint();
  threePoint();
}

// ============================================================ χ² test

function lnGamma(z) {
  // Lanczos approximation (g = 7, n = 9).
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Regularized upper incomplete gamma Q(a, x): series for x < a + 1,
// continued fraction otherwise (Numerical Recipes 6.2).
function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}
const chiP = (x, df) => gammaQ(df / 2, x / 2);
function chiCrit(alpha, df) {
  let lo = 0, hi = 200;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; chiP(m, df) > alpha ? (lo = m) : (hi = m); }
  return (lo + hi) / 2;
}
const chiPdf = (x, k) => (x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - lnGamma(k / 2)));

const CHI_PRESETS = {
  "9:3:3:1": [["Round yellow", 315], ["Round green", 108], ["Wrinkled yellow", 101], ["Wrinkled green", 32]],
  "3:1": [["Purple flowers", 705], ["White flowers", 224]],
  "1:2:1": [["AA", 30], ["Aa", 62], ["aa", 28]],
  "1:1:1:1": [["AB", 55], ["Ab", 51], ["aB", 49], ["ab", 45]],
  "1:1": [["Dominant", 52], ["Recessive", 48]],
};

for (const root of document.querySelectorAll("[data-gen-chisq]")) {
  const o = outs(root);
  const plot = root.querySelector("[data-chi-plot]");
  const s = scrubAll(root, compute);
  let ratio = [9, 3, 3, 1];

  const preset = (key) => {
    ratio = key.split(":").map(Number);
    const rows = CHI_PRESETS[key];
    for (let i = 0; i < 4; i++) {
      const tr = root.querySelector(`[data-chi-row="${i}"]`);
      const on = i < ratio.length;
      tr.toggleAttribute("data-off", !on);
      tr.querySelectorAll("input").forEach((inp) => (inp.disabled = !on));
      if (on) {
        root.querySelector(`[data-chi-label="${i}"]`).value = rows[i][0];
        root.querySelector(`[data-chi-obs="${i}"]`).value = rows[i][1];
      }
    }
    compute();
  };

  function compute() {
    const k = ratio.length;
    const obs = ratio.map((_, i) => Math.max(0, parseFloat(root.querySelector(`[data-chi-obs="${i}"]`).value) || 0));
    const n = obs.reduce((a, b) => a + b, 0);
    const rsum = ratio.reduce((a, b) => a + b, 0);
    let chi = 0, small = false;
    for (let i = 0; i < 4; i++) {
      const cells = ["ratio", "exp", "part"].map((c) => root.querySelector(`[data-chi-${c}="${i}"]`));
      if (i >= k) { cells.forEach((c) => (c.textContent = "")); continue; }
      const e = (n * ratio[i]) / rsum;
      const part = e > 0 ? (obs[i] - e) ** 2 / e : 0;
      if (e < 5) small = true;
      chi += part;
      cells[0].textContent = `${ratio[i]}/${rsum}`;
      cells[1].textContent = num(e, 2);
      cells[2].textContent = num(part, 3);
    }
    const df = k - 1, alpha = s.alpha.get();
    const p = chiP(chi, df), crit = chiCrit(alpha, df);
    o.chi.textContent = num(chi, 3);
    o.df.textContent = String(df);
    o.p.textContent = p < 0.001 ? p.toExponential(2) : num(p, 3);
    o.crit.textContent = `${num(crit, 2)} at α = ${alpha}`;
    o.verdict.textContent = small ? "expected counts too small" : p < alpha ? "reject the ratio" : "fits the ratio";
    o.verdict.className = small ? "text-del" : p < alpha ? "text-del" : "text-add";

    plot.replaceChildren();
    const xmax = Math.max(crit * 1.6, chi * 1.15, 8);
    const ys = Array.from({ length: 241 }, (_, i) => { const x = (xmax * i) / 240; return [x, chiPdf(x, df)]; });
    const ymax = Math.min(0.5, Math.max(...ys.slice(df <= 2 ? 3 : 0).map((d) => d[1])) * 1.15);
    const f = frame(plot, { box: [40, 22, 490, 140], x: [0, xmax], y: [0, ymax], xticks: Array.from({ length: 5 }, (_, i) => Math.round((xmax * i) / 5)), yticks: [], xlabel: "χ²", ylabel: `χ² density, df = ${df}` });
    const tail = ys.filter(([x]) => x >= chi);
    if (tail.length) el("path", { d: `M${f.sx(chi)},${f.sy(0)} ` + tail.map(([x, y]) => `L${f.sx(x).toFixed(1)},${f.sy(Math.min(y, ymax)).toFixed(1)}`).join(" ") + ` L${f.sx(xmax)},${f.sy(0)} Z`, style: "fill:var(--brand);fill-opacity:0.18" }, plot);
    polyline(plot, ys.map(([x, y]) => [f.sx(x), f.sy(Math.min(y, ymax))]), "stroke:var(--foreground);stroke-width:1.5");
    el("line", { x1: f.sx(crit), x2: f.sx(crit), y1: f.T, y2: f.T + f.H, style: "stroke:var(--code-del);stroke-dasharray:4 4" }, plot);
    text(plot, f.sx(crit) + 4, f.T + 10, `critical ${num(crit, 2)}`, { class: "fill-del font-mono text-[10px]" });
    el("line", { x1: f.sx(chi), x2: f.sx(chi), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-width:2" }, plot);
    text(plot, f.sx(chi) + 4, f.T + f.H - 8, `χ² = ${num(chi, 3)}, p = ${p < 0.001 ? p.toExponential(1) : num(p, 3)}`, { class: "fill-brand font-mono text-[10px]" });
  }

  root.querySelectorAll("[data-chi-obs]").forEach((inp) => inp.addEventListener("input", compute));
  root.addEventListener("seg-change", (e) => preset(e.detail.value));
  preset("9:3:3:1");
}

// ============================================================ Replication fork

const FORK_STEPS = [
  "Helicase unwinds the double helix, opening a fork; topoisomerase relieves the twisting ahead of it and single-strand binding proteins keep the strands apart.",
  "Primase lays down short RNA primers. DNA polymerase can only add to an existing 3' end, so every new strand starts from one.",
  "On the leading strand, DNA polymerase III builds continuously toward the fork, 5' → 3', as the fork opens.",
  "The lagging strand runs the other way, so polymerase III builds it in short Okazaki fragments, each 5' → 3' away from the fork, each from its own primer.",
  "DNA polymerase I replaces the RNA primers with DNA, and ligase seals the nicks between fragments into one strand.",
];

for (const root of document.querySelectorAll("[data-gen-fork]")) {
  const svg = root.querySelector("[data-fork-svg]");
  const textEl = root.querySelector("[data-fork-text]");
  const count = root.querySelector("[data-fork-count]");
  const nameEl = root.querySelector("[data-fork-name]");
  const roleEl = root.querySelector("[data-fork-role]");
  const picks = [...root.querySelectorAll("[data-fork-pick]")];

  // Points along the two template arms, t = 0 at the fork, 1 at the left end.
  const top = (t, off = 0) => [440 - 400 * t - 2.2 * off, 145 - 90 * t + 9.8 * off];
  const bot = (t, off = 0) => [440 - 400 * t - 2.2 * off, 155 + 90 * t - 9.8 * off];
  const seg = (fn, t0, t1, off) => { const a = fn(t0, off), b = fn(t1, off); return `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)}`; };
  const parts = [];
  const add = (from, to, node, part) => { parts.push({ from, to, node }); if (part) node.setAttribute("data-fork-part", part); return node; };
  const strand = (d, color, w = 3.5) => el("path", { d, style: `fill:none;stroke:${color};stroke-width:${w};stroke-linecap:round` }, svg);
  const head = (p, dir, color) => {
    const [x, y] = p, [dx, dy] = dir, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    return el("path", { d: `M${x + ux * 7},${y + uy * 7} L${x - uy * 5},${y + ux * 5} L${x + uy * 5},${y - ux * 5} Z`, style: `fill:${color}` }, svg);
  };
  const label = (x, y, s, cls = "fill-muted-foreground font-mono text-[10px]") => text(svg, x, y, s, { "text-anchor": "middle", class: cls });
  const blob = (x, y, w, hgt, color, txt) => {
    const g = el("g", { class: "cursor-pointer" }, svg);
    el("rect", { x: x - w / 2, y: y - hgt / 2, width: w, height: hgt, rx: hgt / 2, style: `fill:color-mix(in oklab, ${color} 28%, var(--code-bg));stroke:${color};stroke-width:1.5` }, g);
    text(g, x, y + 3.5, txt, { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
    return g;
  };
  const TEMPLATE = "color-mix(in oklab, var(--foreground) 45%, transparent)", NEW = "var(--vec-u)", RNA = "var(--brand)";

  // Templates and the duplex ahead of the fork.
  add(0, 4, strand(`M440,145 L630,145`, TEMPLATE));
  add(0, 4, strand(`M440,155 L630,155`, TEMPLATE));
  add(0, 4, strand(seg(top, 0, 1, 0), TEMPLATE));
  add(0, 4, strand(seg(bot, 0, 1, 0), TEMPLATE));
  add(0, 4, label(28, 58, "3'"));
  add(0, 4, label(28, 250, "5'"));
  add(0, 4, label(634, 136, "5'"));
  add(0, 4, label(634, 172, "3'"));
  add(0, 4, label(530, 132, "parental DNA"));
  add(0, 4, blob(452, 150, 30, 30, "var(--vec-out)", "hel"), "helicase");
  add(0, 4, blob(560, 150, 34, 18, "var(--ion-k)", "topo"), "topo");
  const ssb = el("g", { class: "cursor-pointer" }, svg);
  for (const t of [0.1, 0.22]) { const [x, y] = top(t, -0.9); el("circle", { cx: x, cy: y, r: 4, style: "fill:var(--ion-cl)" }, ssb); }
  add(0, 2, ssb, "ssb");

  // Leading strand: primer at the far 5' end, then continuous DNA to the fork.
  add(1, 3, strand(seg(top, 0.93, 0.86, 1), RNA, 4.5));
  add(4, 4, strand(seg(top, 0.93, 0.86, 1), NEW, 3.5));
  add(2, 4, strand(seg(top, 0.86, 0.12, 1), NEW));
  add(2, 4, head(top(0.12, 1), [400, 90], NEW));
  add(2, 4, blob(...top(0.07, 1.6), 44, 18, "var(--vec-u)", "pol III"), "pol3");
  add(1, 4, label(...top(0.98, 2.6), "5'"));
  add(2, 4, label(...top(0.55, -2.4), "leading strand: continuous →", "fill-vec-u font-mono text-[10px]"));

  // Lagging strand: Okazaki fragments, newest at the fork.
  const frags = [[0.12, 0.33], [0.36, 0.6], [0.63, 0.9]];
  frags.forEach(([t0, t1], i) => {
    add(1, i === 2 ? 3 : 4, strand(seg(bot, t0, t0 + 0.05, 1), RNA, 4.5), "primase");
    const g = el("g", { class: "cursor-pointer" }, svg);
    el("path", { d: seg(bot, t0 + 0.05, t1, 1), style: `fill:none;stroke:${NEW};stroke-width:3.5;stroke-linecap:round` }, g);
    const end = bot(t1, 1);
    const [x, y] = end;
    el("path", { d: `M${x - 7},${y + 1.6} L${x + 1},${y - 4} L${x + 2},${y + 6} Z`, style: `fill:${NEW}` }, g);
    add(3, 4, g, "okazaki");
  });
  add(4, 4, strand(seg(bot, 0.63, 0.68, 1), NEW, 3.5));
  add(1, 1, blob(...bot(0.1, 2.2), 52, 18, "var(--brand)", "primase"), "primase");
  add(3, 4, blob(...bot(0.33, 2.2), 44, 18, "var(--vec-u)", "pol III"), "pol3");
  add(4, 4, blob(...bot(0.38, -2.2), 36, 18, "var(--vec-v)", "pol I"), "pol1");
  add(4, 4, blob(...bot(0.615, -2.2), 40, 18, "var(--ion-na)", "ligase"), "ligase");
  add(1, 4, label(...bot(0.1, -1.6), "5'"));
  add(3, 4, label(...bot(0.72, -4.4), "← lagging strand: Okazaki fragments", "fill-vec-u font-mono text-[10px]"));
  add(1, 4, label(...bot(0.97, 2.4), "3'"));

  const show = (i) => {
    for (const p of parts) {
      const on = i >= p.from && i <= p.to;
      p.node.style.opacity = on ? "1" : "0";
      p.node.style.transition = reduced() ? "none" : "opacity 220ms cubic-bezier(0.23, 1, 0.32, 1)";
      p.node.toggleAttribute("aria-hidden", !on);
    }
    textEl.textContent = FORK_STEPS[i];
    count.textContent = `${i + 1} / ${FORK_STEPS.length}`;
  };
  stepper(root, FORK_STEPS.length, show);

  const pick = (key) => {
    const b = picks.find((x) => x.dataset.forkPick === key);
    if (!b) return;
    for (const x of picks) x.toggleAttribute("data-on", x === b);
    nameEl.textContent = b.dataset.name;
    roleEl.textContent = b.dataset.role;
    for (const n of svg.querySelectorAll("[data-fork-part]")) n.style.filter = n.dataset.forkPart === key ? "drop-shadow(0 0 3px var(--brand))" : "";
  };
  svg.addEventListener("pointerover", (e) => { const n = e.target.closest("[data-fork-part]"); if (n && n.style.opacity !== "0") pick(n.dataset.forkPart); });
  picks.forEach((b) => b.addEventListener("click", () => pick(b.dataset.forkPick)));
}

// ============================================================ PCR

const PCR_K = 1e12; // plateau, copies (illustrative)
const PCR_THRESHOLD = 1e10;

for (const root of document.querySelectorAll("[data-gen-pcr]")) {
  const o = outs(root);
  const tempSvg = root.querySelector("[data-pcr-temp]");
  const copySvg = root.querySelector("[data-pcr-copies]");
  const primer = root.querySelector("[data-pcr-primer]");
  const checks = root.querySelector("[data-pcr-checks]");
  const playBtn = root.querySelector("[data-action=play]");
  const s = scrubAll(root, () => { draw(); checkPrimer(); });
  let cursor = -1, raf = 0, playing = false, visible = false;

  const series = () => {
    const N0 = 10 ** s.start.get(), E = s.eff.get();
    const N = [N0], ideal = [N0];
    for (let n = 1; n <= 40; n++) {
      const prev = N[n - 1];
      N.push(prev * (1 + E * (1 - prev / PCR_K)));
      ideal.push(N0 * 2 ** n);
    }
    let ct = NaN;
    for (let n = 1; n <= 40; n++) if (N[n] >= PCR_THRESHOLD) { ct = n - 1 + Math.log(PCR_THRESHOLD / N[n - 1]) / Math.log(N[n] / N[n - 1]); break; }
    return { N, ideal, ct };
  };

  // One cycle: denature 95 °C 30 s, anneal 30 s, extend 72 °C 60 s, with ramps.
  const profile = (Ta) => [[0, 72], [8, 95], [38, 95], [48, Ta], [78, Ta], [84, 72], [144, 72]];
  const phaseAt = (t) => (t < 8 ? "heating" : t < 38 ? "denature, 95 °C" : t < 78 ? "anneal primers" : "extend, 72 °C");

  function draw() {
    const cyc = Math.round(s.cycle.get());
    const { N, ideal, ct } = series();
    const Ta = s.anneal.get();

    tempSvg.replaceChildren();
    const ft = frame(tempSvg, { box: [40, 22, 504, 94], x: [0, 144], y: [40, 100], xticks: [0, 30, 60, 90, 120], yticks: [50, 72, 95], xlabel: "seconds into the cycle", ylabel: "°C" });
    const pts = profile(Ta).map(([t, T]) => [ft.sx(t), ft.sy(T)]);
    polyline(tempSvg, pts, "stroke:var(--code-del);stroke-width:2;stroke-linejoin:round");
    for (const [t, l] of [[23, "denature"], [63, "anneal"], [114, "extend"]]) text(tempSvg, ft.sx(t), ft.sy(100) + 2, l, { "text-anchor": "middle" });
    if (cursor >= 0) el("line", { x1: ft.sx(cursor), x2: ft.sx(cursor), y1: ft.T, y2: ft.T + ft.H, style: "stroke:var(--brand);stroke-width:2" }, tempSvg);

    copySvg.replaceChildren();
    const f = frame(copySvg, { box: [44, 22, 500, 170], x: [0, 40], y: [0, 13], xticks: [0, 10, 20, 30, 40], yticks: [0, 3, 6, 9, 12], xlabel: "cycle", ylabel: "copies (log₁₀)", yfmt: (v) => `10${String(v).split("").map((c) => SUP[c]).join("")}` });
    hline(copySvg, f, Math.log10(PCR_THRESHOLD), "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4", "threshold");
    polyline(copySvg, ideal.map((v, n) => [f.sx(n), f.sy(Math.min(13, Math.log10(v)))]).filter((_, n) => Math.log10(ideal[n]) <= 13.2), "stroke:var(--foreground);stroke-opacity:0.45;stroke-width:1.25;stroke-dasharray:4 4");
    polyline(copySvg, N.map((v, n) => [f.sx(n), f.sy(Math.log10(v))]), "stroke:var(--brand);stroke-width:2");
    el("circle", { cx: f.sx(cyc), cy: f.sy(Math.log10(N[cyc])), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, copySvg);
    text(copySvg, f.sx(40) - 2, f.sy(12.6), "ideal 2ⁿ", { "text-anchor": "end" });

    o.phase.textContent = cursor >= 0 ? phaseAt(cursor) : cyc === 0 ? "ready" : `after cycle ${cyc}`;
    o.copies.textContent = sci(N[cyc]);
    o.ideal.textContent = sci(ideal[cyc]);
    o.ct.textContent = Number.isFinite(ct) ? num(ct, 1) : "not reached";
  }

  function checkPrimer() {
    const raw = primer.value.toUpperCase();
    const seq = raw.replace(/[^ACGT]/g, "");
    const L = seq.length;
    const gc = (seq.match(/[GC]/g) || []).length;
    const at = L - gc;
    const tm = 2 * at + 4 * gc;
    const tail = seq.slice(-5);
    const tailGC = (tail.match(/[GC]/g) || []).length;
    const run = /(A{4,}|C{4,}|G{4,}|T{4,})/.test(seq);
    const Ta = s.anneal.get();
    const chip = (ok, label) => `<span class="rounded-full border px-2 py-0.5 ${ok ? "border-add/40 text-add" : "border-del/40 text-del"}">${ok ? "✓" : "!"} ${label}</span>`;
    checks.innerHTML = [
      chip(L >= 18 && L <= 25, `${L} nt (aim 18–25)`),
      chip(L && gc / L >= 0.4 && gc / L <= 0.6, `GC ${L ? Math.round((100 * gc) / L) : 0}% (aim 40–60%)`),
      chip(true, `Tm ≈ ${tm} °C (Wallace rule, rough)`),
      chip(tailGC >= 1 && tailGC <= 3, `3' end: ${tailGC} G/C in last 5`),
      chip(!run, run ? "run of 4+ identical bases" : "no long runs"),
      chip(Ta <= tm, Ta > tm ? `anneal ${Ta} °C is above Tm` : `anneal ${Ta} °C ≤ Tm`),
      raw.replace(/\s/g, "").length !== L ? chip(false, "non-ACGT letters ignored") : "",
    ].join("");
  }

  const setPlay = (p) => {
    playing = p;
    playBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    playBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    playBtn.querySelector("[data-label]").textContent = p ? "Pause" : "Run";
    if (!p) { cancelAnimationFrame(raf); raf = 0; cursor = -1; draw(); }
  };
  let last = 0;
  const loop = (now) => {
    const dt = Math.min(50, now - last); last = now;
    cursor += dt * 0.24; // one cycle ≈ 0.6 s
    if (cursor >= 144) {
      cursor = 0;
      const c = Math.round(s.cycle.get()) + 1;
      s.cycle.set(c, false);
      if (c >= 40) return setPlay(false);
    }
    draw();
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  playBtn.addEventListener("click", () => {
    if (playing) return setPlay(false);
    if (Math.round(s.cycle.get()) >= 40) s.cycle.set(0, false);
    if (reduced()) { s.cycle.set(30, false); draw(); return; }
    setPlay(true);
    cursor = 0; last = performance.now();
    if (visible) raf = requestAnimationFrame(loop);
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { setPlay(false); s.cycle.set(0, false); draw(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }).observe(root);
  primer.addEventListener("input", checkPrimer);
  draw();
  checkPrimer();
}

// ============================================================ Restriction digest

const ENZYMES = {
  EcoRI: { site: "GAATTC", cut: 1, color: "var(--brand)" },
  BamHI: { site: "GGATCC", cut: 1, color: "var(--vec-u)" },
  HindIII: { site: "AAGCTT", cut: 1, color: "var(--ion-cl)" },
};
const PLANTED = [["EcoRI", 396], ["BamHI", 1102], ["EcoRI", 1810], ["HindIII", 2400]];
const LADDER = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 500]; // NEB 1 kb ladder

// A deterministic synthetic 3,000 bp sequence: random bases with every
// accidental site removed (also across the circular junction), then the
// planted sites written in.
function plasmid() {
  const rng = mulberry32(2024);
  const L = 3000;
  const b = Array.from({ length: L }, () => "ACGT"[Math.floor(rng() * 4)]);
  for (const [name, at] of PLANTED) ENZYMES[name].site.split("").forEach((c, i) => (b[at + i] = c));
  const protect = new Set(PLANTED.flatMap(([n, at]) => Array.from({ length: 6 }, (_, i) => at + i)));
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    for (const { site } of Object.values(ENZYMES)) {
      for (let i = 0; i < L; i++) {
        let hit = true;
        for (let k = 0; k < 6; k++) if (b[(i + k) % L] !== site[k]) { hit = false; break; }
        if (!hit) continue;
        const planted = PLANTED.some(([n, at]) => at === i && ENZYMES[n].site === site);
        if (planted) continue;
        const k = [2, 3, 1, 4, 0, 5].map((d) => (i + d) % L).find((j) => !protect.has(j));
        b[k] = b[k] === "A" ? "C" : "A";
        changed = true;
      }
    }
    if (!changed) break;
  }
  return b.join("");
}

function cutPositions(seq, names, circular) {
  const L = seq.length, cuts = [];
  for (const n of names) {
    const { site, cut } = ENZYMES[n];
    const end = circular ? L : L - site.length + 1;
    for (let i = 0; i < end; i++) {
      let hit = true;
      for (let k = 0; k < site.length; k++) if (seq[(i + k) % L] !== site[k]) { hit = false; break; }
      if (hit) cuts.push({ n, at: i, pos: (i + cut) % L });
    }
  }
  return cuts.sort((a, b) => a.pos - b.pos);
}

function fragments(L, cuts, circular) {
  const p = [...new Set(cuts.map((c) => c.pos))].sort((a, b) => a - b);
  if (circular) {
    if (p.length === 0) return [];
    if (p.length === 1) return [L];
    return p.map((x, i) => (i + 1 < p.length ? p[i + 1] - x : L - x + p[0]));
  }
  const edges = [0, ...p, L];
  return edges.slice(1).map((x, i) => x - edges[i]).filter((v) => v > 0);
}

for (const root of document.querySelectorAll("[data-gen-digest]")) {
  const seq = plasmid();
  const L = seq.length;
  const map = root.querySelector("[data-digest-map]");
  const gel = root.querySelector("[data-digest-gel]");
  const fragsEl = root.querySelector("[data-digest-frags]");
  const note = root.querySelector("[data-digest-note]");
  const chips = [...root.querySelectorAll("[data-enzyme]")];
  let circular = true, ran = 0;
  root._seq = seq; // for checks in the console

  const selected = () => chips.filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.dataset.enzyme);
  const yOf = (bp) => 40 + (Math.log10(10000) - Math.log10(Math.max(200, bp))) / (Math.log10(10000) - Math.log10(400)) * 250;

  function draw(animate = false) {
    const names = selected();
    const all = cutPositions(seq, Object.keys(ENZYMES), circular);
    const cuts = all.filter((c) => names.includes(c.n));
    const frs = fragments(L, cuts, circular).sort((a, b) => b - a);

    map.replaceChildren();
    if (circular) {
      el("circle", { cx: 160, cy: 160, r: 94, style: "fill:none;stroke:currentColor;stroke-opacity:0.35;stroke-width:6" }, map);
      text(map, 160, 156, `${L.toLocaleString("en")} bp`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
      text(map, 160, 172, "synthetic plasmid", { "text-anchor": "middle" });
      for (let k = 0; k < L; k += 500) {
        const a = (k / L) * 2 * Math.PI - Math.PI / 2;
        el("line", { x1: 160 + 84 * Math.cos(a), y1: 160 + 84 * Math.sin(a), x2: 160 + 88 * Math.cos(a), y2: 160 + 88 * Math.sin(a), style: "stroke:currentColor;stroke-opacity:0.4" }, map);
      }
      for (const c of all) {
        const on = names.includes(c.n);
        const a = (c.pos / L) * 2 * Math.PI - Math.PI / 2;
        const [x1, y1, x2, y2] = [160 + 88 * Math.cos(a), 160 + 88 * Math.sin(a), 160 + 106 * Math.cos(a), 160 + 106 * Math.sin(a)];
        el("line", { x1, y1, x2, y2, style: `stroke:${ENZYMES[c.n].color};stroke-width:${on ? 2.5 : 1.25};stroke-opacity:${on ? 1 : 0.35}` }, map);
        const lx = 160 + 114 * Math.cos(a), ly = 160 + 114 * Math.sin(a);
        text(map, lx, ly + 3, `${c.n} ${c.pos}`, { "text-anchor": Math.cos(a) > 0.2 ? "start" : Math.cos(a) < -0.2 ? "end" : "middle", class: on ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]", style: on ? "" : "opacity:0.5" });
      }
    } else {
      el("line", { x1: 20, x2: 300, y1: 160, y2: 160, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:6;stroke-linecap:round" }, map);
      text(map, 160, 200, `${L.toLocaleString("en")} bp, linear`, { "text-anchor": "middle" });
      all.forEach((c, i) => {
        const on = names.includes(c.n), x = 20 + (280 * c.pos) / L;
        el("line", { x1: x, x2: x, y1: 146, y2: 174, style: `stroke:${ENZYMES[c.n].color};stroke-width:${on ? 2.5 : 1.25};stroke-opacity:${on ? 1 : 0.35}` }, map);
        text(map, x, i % 2 ? 190 : 138, `${c.n}`, { "text-anchor": "middle", class: on ? "fill-foreground font-mono text-[9px]" : "fill-muted-foreground font-mono text-[9px]" });
      });
    }

    // The gel: ladder, uncut, digest.
    gel.replaceChildren();
    el("rect", { x: 10, y: 20, width: 200, height: 290, rx: 6, style: "fill:color-mix(in oklab, var(--vec-u) 6%, var(--code-bg));stroke:currentColor;stroke-opacity:0.15" }, gel);
    const lanes = [["ladder", 55], ["uncut", 110], ["digest", 165]];
    for (const [l, x] of lanes) {
      el("rect", { x: x - 18, y: 26, width: 36, height: 6, rx: 1.5, style: "fill:currentColor;fill-opacity:0.25" }, gel);
      text(gel, x, 16, l, { "text-anchor": "middle" });
    }
    const band = (x, bp, weight, label, delay) => {
      const y = yOf(bp);
      const r = el("rect", { x: x - 17, y: y - 2, width: 34, height: 4, rx: 2, style: `fill:var(--foreground);fill-opacity:${Math.min(0.95, 0.25 + 0.25 * weight)}` }, gel);
      if (label) text(gel, x - 21, y + 3, label, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[8px]" });
      if (animate && !reduced()) r.animate([{ transform: `translateY(${29 - y}px)`, opacity: 0.2 }, { transform: "none", opacity: 1 }], { duration: 1100 + delay, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    };
    LADDER.forEach((bp) => band(55, bp, bp === 3000 || bp === 1000 ? 2.2 : 1.2, bp >= 1000 ? `${bp / 1000}k` : `${bp}`, 0));
    // Supercoiled circles run ahead of their linear size; drawn at ~2 kb.
    band(110, circular ? 2000 : L, 2.5, "", 80);
    const counts = {};
    for (const f of frs) counts[f] = (counts[f] || 0) + 1;
    if (!names.length || (circular && !cuts.length)) band(165, circular ? 2000 : L, 2.5, "", 160);
    else Object.entries(counts).forEach(([bp, k]) => band(165, +bp, (k * bp) / 1000, "", 160));

    fragsEl.textContent = !names.length ? "No enzyme selected." : cuts.length === 0 ? "No sites: nothing is cut." : `${frs.map((f) => f.toLocaleString("en")).join(" + ")} = ${frs.reduce((a, b) => a + b, 0).toLocaleString("en")} bp`;
    note.textContent = circular
      ? (cuts.length === 0 ? "An uncut plasmid is supercoiled and runs faster than a linear molecule of the same size." : cuts.length === 1 ? "One cut opens the circle: a single linear band of full length." : `${cuts.length} cuts in a circle give ${cuts.length} fragments.`)
      : `${cuts.length} cuts in a line give ${cuts.length + 1} fragments.`;
    note.textContent += " Distance is drawn falling with log(size), the usual approximation.";
  }

  chips.forEach((c) => c.addEventListener("click", () => { c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true")); draw(); }));
  root.addEventListener("seg-change", (e) => { circular = e.detail.value === "circular"; draw(); });
  root.querySelector("[data-action=run]").addEventListener("click", () => draw(true));
  draw();
}

// ============================================================ CRISPR

const RC = { A: "T", C: "G", G: "C", T: "A", N: "N" };
const revcomp = (s) => s.split("").reverse().map((c) => RC[c] || "N").join("");

function cas9Targets(seq) {
  const L = seq.length, hits = [];
  const scan = (s, strand) => {
    for (let i = 0; i + 23 <= L; i++) {
      if (s[i + 21] !== "G" || s[i + 22] !== "G") continue;
      const guide = s.slice(i, i + 20), pam = s.slice(i + 20, i + 23);
      if (/[^ACGT]/.test(guide + pam)) continue;
      if (strand === "+") hits.push({ strand, guide, pam, start: i, end: i + 20, pamStart: i + 20, cut: i + 17 });
      else hits.push({ strand, guide, pam, start: L - (i + 20), end: L - i, pamStart: L - (i + 23), cut: L - (i + 17) });
    }
  };
  scan(seq, "+");
  scan(revcomp(seq), "−");
  return hits.sort((a, b) => a.cut - b.cut);
}

for (const root of document.querySelectorAll("[data-gen-crispr]")) {
  const ta = root.querySelector("[data-crispr-seq]");
  const view = root.querySelector("[data-crispr-view]");
  const tbody = root.querySelector("[data-crispr-hits]");
  const countEl = root.querySelector("[data-crispr-count]");
  const lenEl = root.querySelector("[data-crispr-len]");
  let hits = [], seq = "";

  function render(only = null) {
    const show = only === null ? hits : [hits[only]];
    const guide = new Uint8Array(seq.length), pam = new Uint8Array(seq.length), cut = new Set();
    for (const h of show) {
      for (let i = h.start; i < h.end; i++) guide[i] = 1;
      for (let i = h.pamStart; i < h.pamStart + 3; i++) pam[i] = 1;
      cut.add(h.cut);
    }
    let html = "";
    for (let i = 0; i < seq.length; i++) {
      if (cut.has(i)) html += '<span class="mx-px inline-block h-4 w-0.5 translate-y-0.5 bg-foreground"></span>';
      const cls = pam[i] ? "bg-vec-u/25" : guide[i] ? "bg-brand/20" : "";
      html += cls ? `<span class="${cls}">${seq[i]}</span>` : seq[i];
    }
    view.innerHTML = html;
  }

  function scan() {
    seq = ta.value.toUpperCase().replace(/[^ACGTN]/g, "");
    lenEl.textContent = `${seq.length} bp`;
    hits = cas9Targets(seq);
    countEl.textContent = `${hits.length} target${hits.length === 1 ? "" : "s"}: ${hits.filter((h) => h.strand === "+").length} on +, ${hits.filter((h) => h.strand === "−").length} on −`;
    tbody.innerHTML = hits.map((h, i) => {
      const gc = (h.guide.match(/[GC]/g) || []).length / 20;
      const notes = [];
      if (/TTTT/.test(h.guide)) notes.push("TTTT ends U6 transcription");
      if (gc < 0.4) notes.push("low GC");
      if (gc > 0.8) notes.push("high GC");
      if (/(A{5,}|C{5,}|G{5,}|T{5,})/.test(h.guide)) notes.push("homopolymer run");
      if (h.guide[0] !== "G") notes.push("U6 needs a 5' G (add one)");
      return `<tr data-hit="${i}" class="border-b last:border-b-0 transition-colors duration-100 hover:bg-accent/40">
        <td class="py-1.5 pr-3">${h.strand}</td>
        <td class="py-1.5 pr-3 tracking-wide"><span class="text-brand">${h.guide}</span><span class="text-vec-u">${h.pam}</span></td>
        <td class="py-1.5 pr-3 text-right tabular-nums">${h.cut}</td>
        <td class="py-1.5 pr-3 text-right tabular-nums">${Math.round(gc * 100)}%</td>
        <td class="py-1.5 font-sans text-xs text-muted-foreground">${notes.join(" · ") || "—"}</td></tr>`;
    }).join("") || '<tr><td colspan="5" class="py-3 text-center font-sans text-sm text-muted-foreground">No NGG PAM in this sequence.</td></tr>';
    for (const tr of tbody.querySelectorAll("[data-hit]")) {
      tr.addEventListener("pointerenter", () => render(+tr.dataset.hit));
      tr.addEventListener("pointerleave", () => render());
    }
    render();
  }
  ta.addEventListener("input", scan);
  scan();
}

// ============================================================ lac operon

for (const root of document.querySelectorAll("[data-gen-lac]")) {
  const svg = root.querySelector("[data-lac-svg]");
  const txt = root.querySelector("[data-lac-text]");
  const state = { lactose: true, glucose: false };
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { state[sw.dataset.toggle] = e.detail.checked; draw(); }));

  const box = (x, w, label, color, sub, row = 0) => {
    el("rect", { x, y: 160, width: w, height: 26, rx: 4, style: `fill:color-mix(in oklab, ${color} 18%, var(--code-bg));stroke:${color};stroke-width:1.25` }, svg);
    text(svg, x + w / 2, 177, label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    if (sub) text(svg, x + w / 2, 202 + 13 * row, sub, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
  };
  const protein = (x, y, w, label, color, title) => {
    const g = el("g", {}, svg);
    el("rect", { x: x - w / 2, y: y - 14, width: w, height: 28, rx: 14, style: `fill:color-mix(in oklab, ${color} 30%, var(--code-bg));stroke:${color};stroke-width:1.5` }, g);
    text(g, x, y + 4, label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    if (title) el("title", {}, g).textContent = title;
    return g;
  };

  function draw() {
    const { lactose, glucose } = state;
    const bound = !lactose; // allolactose releases the repressor
    const cap = !glucose; // low glucose → high cAMP → CAP binds
    const level = bound ? "off" : cap ? "high" : "low";
    svg.replaceChildren();
    el("line", { x1: 16, x2: 624, y1: 173, y2: 173, style: "stroke:currentColor;stroke-opacity:0.4;stroke-width:2" }, svg);
    box(24, 76, "lacI", "var(--ion-k)", "repressor gene");
    box(140, 52, "CAP", "var(--vec-out)", "CAP site");
    box(198, 52, "P", "var(--foreground)", "promoter", 1);
    box(254, 40, "O", "var(--code-del)", "operator");
    box(300, 140, "lacZ", "var(--vec-u)", "β-galactosidase");
    box(440, 92, "lacY", "var(--vec-u)", "permease");
    box(532, 84, "lacA", "var(--vec-u)", "transacetylase");
    // The repressor: on the operator, or lifted off by allolactose.
    if (bound) protein(274, 136, 64, "repressor", "var(--ion-k)", "LacI tetramer bound to the operator");
    else {
      protein(140, 60, 64, "repressor", "var(--ion-k)", "LacI with allolactose bound: it can no longer hold the operator");
      el("circle", { cx: 176, cy: 48, r: 6, style: "fill:var(--vec-out)" }, svg);
      text(svg, 186, 40, "allolactose", {});
    }
    if (cap) protein(164, 136, 50, "CAP", "var(--vec-out)", "CAP with cAMP bound, recruiting RNA polymerase"), el("circle", { cx: 186, cy: 124, r: 5, style: "fill:var(--vec-out)" }, svg), text(svg, 194, 116, "cAMP", {});
    else text(svg, 166, 140, "no CAP", { "text-anchor": "middle" });
    protein(224, bound ? 100 : 136, 52, "RNAP", "var(--foreground)", "RNA polymerase");
    if (level !== "off") {
      const pts = Array.from({ length: 61 }, (_, i) => { const x = 300 + i * 5.3; return `${i ? "L" : "M"}${x.toFixed(1)},${(128 + 6 * Math.sin(i * 0.8)).toFixed(1)}`; }).join(" ");
      el("path", { d: pts, style: `fill:none;stroke:var(--brand);stroke-width:${level === "high" ? 3 : 1.5};stroke-dasharray:${level === "high" ? "none" : "4 5"};stroke-linecap:round` }, svg);
      text(svg, 616, 112, level === "high" ? "lots of lacZYA mRNA" : "a little mRNA", { "text-anchor": "end", class: "fill-brand font-mono text-[10px]" });
    }
    text(svg, 62, 150, "always on", { "text-anchor": "middle" });
    root.querySelectorAll("[data-lac-row]").forEach((r) => r.toggleAttribute("data-on", r.dataset.lacRow === (lactose ? "+" : "−") + (glucose ? "+" : "−")));
    txt.textContent = bound
      ? "No lactose: the repressor sits on the operator and blocks RNA polymerase, whatever the glucose. No point making enzymes for a sugar that isn't there."
      : cap
        ? "Lactose and no glucose: allolactose lifts the repressor, and with glucose low, cAMP rises and CAP·cAMP helps RNA polymerase bind. Transcription is high."
        : "Lactose but also glucose: the repressor is off, but glucose keeps cAMP low, so CAP doesn't help. Only a little transcription: the cell prefers glucose. (Inducer exclusion also limits lactose uptake; simplified here.)";
  }
  draw();
}

// ============================================================ Alignment

for (const root of document.querySelectorAll("[data-gen-align]")) {
  const o = outs(root);
  const grid = root.querySelector("[data-align-grid]");
  const outEl = root.querySelector("[data-align-out]");
  const inputs = { a: root.querySelector('[data-align-seq="a"]'), b: root.querySelector('[data-align-seq="b"]') };
  const s = scrubAll(root, () => compute(false));
  let timer = 0;

  function compute(animate) {
    clearInterval(timer);
    const A = inputs.a.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 20);
    const B = inputs.b.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 20);
    const ma = s.match.get(), mm = s.mismatch.get(), gp = s.gap.get();
    const m = A.length, n = B.length;
    const F = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) F[i][0] = i * gp;
    for (let j = 0; j <= n; j++) F[0][j] = j * gp;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      F[i][j] = Math.max(F[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? ma : mm), F[i - 1][j] + gp, F[i][j - 1] + gp);
    // Traceback: diagonal first, then up, then left.
    const path = new Set([`${m},${n}`]);
    let i = m, j = n, ra = "", rb = "", mid = "";
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && F[i][j] === F[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? ma : mm)) {
        ra = A[i - 1] + ra; rb = B[j - 1] + rb; mid = (A[i - 1] === B[j - 1] ? "|" : "·") + mid; i--; j--;
      } else if (i > 0 && F[i][j] === F[i - 1][j] + gp) { ra = A[i - 1] + ra; rb = "-" + rb; mid = " " + mid; i--; }
      else { ra = "-" + ra; rb = B[j - 1] + rb; mid = " " + mid; j--; }
      path.add(`${i},${j}`);
    }
    const matches = mid.split("").filter((c) => c === "|").length;
    o.score.textContent = String(F[m][n]).replace("-", "−");
    o.identity.textContent = ra.length ? `${num((100 * matches) / ra.length, 1)}% (${matches}/${ra.length})` : "—";
    o.gaps.textContent = String((ra + rb).split("").filter((c) => c === "-").length);
    outEl.textContent = `${ra}\n${mid}\n${rb}`;

    grid.style.gridTemplateColumns = `repeat(${n + 2}, 2rem)`;
    let html = '<span></span><span class="flex h-7 items-center justify-center text-muted-foreground">–</span>';
    for (const c of B) html += `<span class="flex h-7 items-center justify-center font-medium">${c}</span>`;
    for (let r = 0; r <= m; r++) {
      html += `<span class="flex h-7 items-center justify-center font-medium">${r ? A[r - 1] : '<span class="text-muted-foreground">–</span>'}</span>`;
      for (let c = 0; c <= n; c++) {
        const on = path.has(`${r},${c}`);
        html += `<span data-cell="${r * (n + 1) + c}" class="flex h-7 items-center justify-center rounded-[4px] ${on ? "bg-brand/15 text-brand font-medium" : "bg-foreground/[0.04]"}">${String(F[r][c]).replace("-", "−")}</span>`;
      }
    }
    grid.innerHTML = html;
    if (animate && !reduced()) {
      const cells = [...grid.querySelectorAll("[data-cell]")];
      cells.forEach((c) => (c.style.opacity = "0"));
      let k = 0;
      timer = setInterval(() => {
        if (k >= cells.length) return clearInterval(timer);
        cells[k++].style.opacity = "1";
      }, Math.max(12, 900 / cells.length));
    }
  }
  inputs.a.addEventListener("input", () => compute(false));
  inputs.b.addEventListener("input", () => compute(false));
  root.querySelector("[data-action=fill]").addEventListener("click", () => compute(true));
  root.querySelector("[data-action=instant]").addEventListener("click", () => compute(false));
  compute(false);
}

// ============================================================ GWAS

// Approximate GRCh38 autosome lengths, Mb.
const CHROM_MB = [248.96, 242.19, 198.3, 190.21, 181.54, 170.81, 159.35, 145.14, 138.39, 133.8, 135.09, 133.28, 114.36, 107.04, 101.99, 90.34, 83.26, 80.37, 58.62, 64.44, 46.71, 50.82];
const GWAS_N = 12000;

for (const root of document.querySelectorAll("[data-gen-gwas]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-gwas-plot]");
  const tip = root.querySelector("[data-gwas-tip]");
  let seed = 3, snps = [], f = null;
  const s = scrubAll(root, build);
  const total = CHROM_MB.reduce((a, b) => a + b, 0);
  const offset = CHROM_MB.map((_, i) => CHROM_MB.slice(0, i).reduce((a, b) => a + b, 0));

  function build() {
    const rng = mulberry32(seed);
    const k = Math.round(s.signals.get()), eff = s.effect.get();
    const loci = Array.from({ length: k }, () => { const c = Math.floor(rng() * 22); return { c, mb: 5 + rng() * (CHROM_MB[c] - 10), peak: eff * (8 + 6 * rng()) }; });
    snps = [];
    const near = loci.flatMap((L) => Array.from({ length: 60 }, () => offset[L.c] + L.mb + (rng() - 0.5) * 3));
    for (let i = 0; i < GWAS_N; i++) {
      const g = i < near.length ? near[i] : rng() * total;
      let c = 0;
      while (c < 21 && g >= offset[c + 1]) c++;
      const mb = g - offset[c];
      let lp = -Math.log10(1 - rng()); // null: p uniform
      for (const L of loci) if (L.c === c) {
        const d = Math.abs(L.mb - mb);
        if (d < 2) lp = Math.max(lp, L.peak * Math.exp(-((d / 0.35) ** 2)) * (0.55 + 0.45 * rng()));
      }
      snps.push({ c, mb, lp, g });
    }
    draw();
  }

  function draw() {
    svg.replaceChildren();
    const top = Math.max(10, Math.ceil(Math.max(...snps.map((d) => d.lp)) + 1));
    f = frame(svg, { box: [40, 22, 590, 230], x: [0, total], y: [0, top], xticks: [], yticks: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].filter((v) => v <= top), ylabel: "−log₁₀ p" });
    const paths = ["", "", ""];
    let nominal = 0, hits = [];
    for (const d of snps) {
      const x = f.sx(d.g).toFixed(1), y = f.sy(d.lp).toFixed(1);
      const sig = d.lp >= -Math.log10(5e-8);
      paths[sig ? 2 : d.c % 2] += `M${x} ${y}h0`;
      if (d.lp >= -Math.log10(0.05)) nominal++;
      if (sig) hits.push(d);
    }
    el("path", { d: paths[0], style: "stroke:var(--vec-u);stroke-opacity:0.55;stroke-width:2.6;stroke-linecap:round" }, svg);
    el("path", { d: paths[1], style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:2.6;stroke-linecap:round" }, svg);
    el("path", { d: paths[2], style: "stroke:var(--brand);stroke-width:3.2;stroke-linecap:round" }, svg);
    hline(svg, f, -Math.log10(5e-8), "stroke:var(--code-del);stroke-dasharray:5 4", "p = 5 × 10⁻⁸");
    hline(svg, f, 5, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:2 4", "suggestive 10⁻⁵");
    CHROM_MB.forEach((mb, i) => { if (i < 19 || i % 2 === 1) text(svg, f.sx(offset[i] + mb / 2), f.T + f.H + 13, String(i + 1), { "text-anchor": "middle" }); });
    text(svg, f.L + f.W, f.T + f.H + 26, "chromosome", { "text-anchor": "end" });
    hits.sort((a, b) => a.g - b.g);
    let loci = 0, last = -Infinity, lastC = -1;
    for (const d of hits) { if (d.c !== lastC || d.mb - last > 1) loci++; last = d.mb; lastC = d.c; }
    o.n.textContent = `${GWAS_N.toLocaleString("en")} shown`;
    o.nominal.textContent = `${nominal.toLocaleString("en")} (≈5% by chance)`;
    o.hits.textContent = String(hits.length);
    o.loci.textContent = String(loci);
  }

  svg.addEventListener("pointermove", (e) => {
    if (!f) return;
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * 640, vy = ((e.clientY - r.top) / r.height) * 300;
    let best = null, bd = 64;
    for (const d of snps) {
      const dx = f.sx(d.g) - vx, dy = f.sy(d.lp) - vy, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = d; }
    }
    if (!best) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.textContent = `chr${best.c + 1}:${num(best.mb, 2)} Mb · p = ${(10 ** -best.lp).toExponential(1)}`;
    tip.style.left = `${Math.min(r.width - 170, (f.sx(best.g) / 640) * r.width + 8)}px`;
    tip.style.top = `${(f.sy(best.lp) / 300) * r.height - 28}px`;
  });
  svg.addEventListener("pointerleave", () => (tip.hidden = true));
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; build(); });
  build();
}
