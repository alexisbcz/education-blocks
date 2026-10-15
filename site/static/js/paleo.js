// Paleoanthropology blocks: the range chart's year line, hover readouts,
// steppers (map, knapping), the parts picker, the exercises, the clade
// highlighter and the admixture genome.

import { el } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const fmtMa = (ma) => (ma >= 1 ? `${+ma.toFixed(2)} Ma` : ma >= 0.0105 ? `${Math.round(ma * 1000)} ka` : "now");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ Time ranges

for (const root of document.querySelectorAll("[data-paleo-ranges]")) {
  const o = outs(root);
  const chart = root.querySelector("[data-chart]");
  const svgs = [...root.querySelectorAll("svg[data-log]")];
  const rows = [...svgs[0].querySelectorAll("[data-species]")];
  let log = true, year = 1.8;

  const scale = (svg) => {
    const d = svg.dataset, old = +d.old, young = +d.young, left = +d.left, width = +d.width;
    if (d.log === "true") {
      const a = Math.log10(old), b = Math.log10(young);
      return { x: (ma) => left + ((a - Math.log10(Math.max(ma, young))) / (a - b)) * width, ma: (x) => 10 ** (a - ((x - left) / width) * (a - b)), lo: young, hi: old };
    }
    return { x: (ma) => left + ((old - ma) / (old - young)) * width, ma: (x) => old - ((x - left) / width) * (old - young), lo: young, hi: old };
  };

  function setYear(ma) {
    year = Math.min(7.9, Math.max(log ? 0.0101 : 0, ma));
    for (const svg of svgs) {
      const sc = scale(svg), x = sc.x(year);
      const line = svg.querySelector("[data-cursor]");
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      const label = svg.querySelector("[data-cursor-label]");
      label.setAttribute("x", x + 4);
      label.textContent = fmtMa(year);
    }
    const alive = rows.filter((g) => +g.dataset.start >= year && +g.dataset.end <= year).map((g) => g.dataset.name);
    o.year.textContent = year < 0.0105 ? "Today" : `At ${fmtMa(year)}`;
    o.alive.textContent = alive.length ? alive.join(" · ") : "No species on this chart is dated to this moment.";
  }

  const fromEvent = (svg, e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const sc = scale(svg);
    return p.x < +svg.dataset.left ? null : sc.ma(p.x);
  };
  for (const svg of svgs) {
    svg.addEventListener("pointermove", (e) => { const ma = fromEvent(svg, e); if (ma !== null) setYear(ma); });
  }
  chart.addEventListener("keydown", (e) => {
    if (e.target.closest("[data-species]") && (e.key === "Enter" || e.key === " ")) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const older = e.key === "ArrowLeft";
    // Log time moves by a constant factor, linear time by a constant step.
    const f = e.shiftKey ? 1.6 : 1.12;
    if (log) setYear(older ? year * f : year / f);
    else setYear(year + (older ? 1 : -1) * (e.shiftKey ? 0.5 : 0.1));
  });
  root.addEventListener("seg-change", (e) => { log = e.detail.value === "log"; setYear(year); });

  // Species details.
  const select = (key) => {
    for (const svg of svgs) for (const g of svg.querySelectorAll("[data-species]")) g.dataset.species === key ? (g.dataset.on = "") : delete g.dataset.on;
    const g = rows.find((r) => r.dataset.species === key);
    o.name.textContent = g.dataset.name;
    o.range.textContent = `${g.dataset.range} · ${g.dataset.genus}`;
    o.fossils.textContent = g.dataset.fossils;
    o.note.textContent = g.dataset.note;
  };
  for (const svg of svgs) {
    for (const g of svg.querySelectorAll("[data-species]")) {
      g.addEventListener("click", () => select(g.dataset.species));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g.dataset.species); } });
    }
  }
  setYear(year);
  select("afarensis");
}

// ============================================================ Crania

for (const root of document.querySelectorAll("[data-paleo-crania]")) {
  const o = outs(root);
  for (const g of root.querySelectorAll("[data-skull]")) {
    const show = () => { o.name.textContent = g.dataset.name; o.info.textContent = g.dataset.info; o.note.textContent = g.dataset.note; };
    g.addEventListener("pointerenter", show);
    g.addEventListener("focus", show);
  }
}

// ============================================================ Steppers

function stepper(root, onStep) {
  const panels = [...root.querySelectorAll("[data-step]")];
  const n = Math.max(...panels.map((p) => +p.dataset.step)) + 1;
  const pips = [...root.querySelectorAll("[data-pip]")];
  const count = root.querySelector("[data-out=count]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(n - 1, i));
    panels.forEach((p) => (p.hidden = +p.dataset.step !== at));
    pips.forEach((p) => (+p.dataset.pip === at ? (p.dataset.on = "") : delete p.dataset.on));
    if (count) count.textContent = `${at + 1} / ${n}`;
    back.disabled = at === 0;
    next.disabled = at === n - 1;
    onStep?.(at);
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  go(0);
}

for (const root of document.querySelectorAll("[data-paleo-map]")) {
  const marks = [...root.querySelectorAll("svg [data-at]")];
  // Solid routes (pathLength 1) draw themselves in when their step arrives;
  // dashed ones only fade.
  for (const m of marks) {
    if (m.tagName === "path" && !m.style.strokeDasharray) {
      m.dataset.draw = "";
      m.style.strokeDasharray = "1 1";
      m.style.strokeDashoffset = "1";
    }
  }
  stepper(root, (at) => {
    for (const m of marks) {
      const s = +m.dataset.at;
      m.style.opacity = s > at ? "0" : s === at ? "1" : "0.4";
      if ("draw" in m.dataset) m.style.strokeDashoffset = s > at ? "1" : "0";
    }
  });
}

for (const root of document.querySelectorAll("[data-paleo-stepper]")) stepper(root);

// ============================================================ Parts picker

for (const root of document.querySelectorAll("[data-paleo-parts]")) {
  const o = outs(root);
  const parts = [...root.querySelectorAll("[data-part]")];
  const show = (b) => {
    for (const p of parts) p === b ? (p.dataset.on = "") : delete p.dataset.on;
    o.name.textContent = b.dataset.name;
    o.why.textContent = b.dataset.why;
  };
  for (const b of parts) {
    b.addEventListener("click", () => show(b));
    b.addEventListener("focus", () => show(b));
    b.addEventListener("pointerenter", () => show(b));
  }
}

// ============================================================ Exercises

function checkable(form, sets, verdict) {
  const score = form.querySelector("[data-out=score]");
  form.addEventListener("change", (e) => {
    const f = e.target.closest("fieldset");
    if (f) { delete f.dataset.state; f.querySelector("[data-feedback]").textContent = ""; }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let right = 0;
    for (const f of sets) {
      const picked = f.querySelector("input:checked");
      const fb = f.querySelector("[data-feedback]");
      if (!picked) { delete f.dataset.state; fb.textContent = "Pick an answer."; fb.className = "text-xs leading-relaxed text-muted-foreground"; continue; }
      const ok = verdict(f, picked.value);
      if (ok) right++;
      f.dataset.state = ok ? "right" : "wrong";
      fb.textContent = (ok ? "✓ " : "✗ Not quite. ") + f.dataset.why;
      fb.className = "text-xs leading-relaxed " + (ok ? "text-add" : "text-del");
    }
    score.textContent = `${right} / ${sets.length} right`;
  });
}

for (const form of document.querySelectorAll("[data-paleo-exercise]")) {
  checkable(form, [...form.querySelectorAll("[data-scenario]")], (f, v) => v === f.dataset.answer);
}

// ============================================================ Cladogram

for (const root of document.querySelectorAll("[data-paleo-tree]")) {
  const o = outs(root);
  const nodes = [...root.querySelectorAll("[data-node]")];
  const members = [...root.querySelectorAll("[data-in]")];
  const pick = (n) => {
    const id = n.dataset.node;
    const was = n.hasAttribute("data-on");
    for (const x of nodes) delete x.dataset.on;
    for (const m of members) delete m.dataset.on;
    if (was) { o.clade.textContent = "Click a branching point."; return; }
    n.dataset.on = "";
    for (const m of members) if (m.dataset.in.split(" ").includes(id)) m.dataset.on = "";
    o.clade.textContent = `Clade: ${n.dataset.label}. Everything lit shares this one common ancestor.`;
  };
  for (const n of nodes) {
    n.addEventListener("click", () => pick(n));
    n.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n); } });
  }
  const quiz = root.querySelector("[data-paleo-quiz]");
  checkable(quiz, [...quiz.querySelectorAll("[data-question]")], (f, v) => v === f.dataset.answer);
}

// ============================================================ Admixture

// Chromosome lengths in megabases (GRCh38, rounded), for proportions.
const CHR = [248, 242, 198, 190, 181, 171, 159, 145, 138, 134, 135, 133, 114, 107, 102, 90, 83, 80, 59, 64, 47, 51];
const POPS = {
  eurasian: { nea: 0.02, den: 0.001, neaText: "≈ 1.5–2.5%", denText: "trace (slightly more in East and South Asia)",
    note: "All non-African populations carry roughly 2% Neanderthal DNA from interbreeding soon after leaving Africa; East Asians a little more than Europeans." },
  papuan: { nea: 0.02, den: 0.04, neaText: "≈ 2%", denText: "≈ 3–6%",
    note: "Papuans and Aboriginal Australians carry the most Denisovan ancestry known, from at least one encounter in Asia or Wallacea." },
  african: { nea: 0.003, den: 0, neaText: "much lower", denText: "none detected",
    note: "Sub-Saharan Africans carry much less Neanderthal ancestry; Chen et al. (2020) found some, largely brought back by later migrations into Africa." },
};

for (const root of document.querySelectorAll("[data-paleo-dna]")) {
  const svg = root.querySelector("[data-genome]");
  const o = outs(root);
  const draw = (pop) => {
    const p = POPS[pop];
    svg.replaceChildren();
    const rng = mulberry32(2010);
    const maxLen = 248, colW = 350, rowH = 19;
    CHR.forEach((len, i) => {
      const col = i < 11 ? 0 : 1, row = i % 11;
      const x0 = 30 + col * (colW + 20), y = 6 + row * rowH, w = (len / maxLen) * (colW - 30);
      const t = el("text", { x: x0 - 6, y: y + 10, "text-anchor": "end", class: "fill-muted-foreground font-mono text-[9px]" }, svg);
      t.textContent = String(i + 1);
      el("rect", { x: x0, y: y + 2, width: w, height: 10, rx: 5, style: "fill:color-mix(in oklab, var(--foreground) 10%, transparent)" }, svg);
      // Random segments until each archaic fraction of this chromosome is covered.
      for (const [frac, color] of [[p.nea, "var(--vec-out)"], [p.den, "var(--ion-cl)"]]) {
        let covered = 0;
        while (covered < frac * len) {
          const seg = 0.6 + rng() * 1.6; // Mb, widened to be visible
          const at = rng() * (len - seg);
          el("rect", { x: x0 + (at / maxLen) * (colW - 30), y: y + 2, width: Math.max(1.5, (seg / maxLen) * (colW - 30)), height: 10, style: `fill:${color}` }, svg);
          covered += seg;
        }
      }
    });
    o.nea.textContent = p.neaText;
    o.den.textContent = p.denText;
    o.note.textContent = p.note;
  };
  root.addEventListener("seg-change", (e) => draw(e.detail.value));
  draw("eurasian");
}
