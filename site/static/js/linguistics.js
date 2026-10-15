// Linguistics blocks: IPA picker, formant plot and a rough vowel synth,
// bracket-notation syntax trees, Zipf's law, and a toy Grimm's law shifter.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const IPA_FONT = '"Charis SIL","Doulos SIL","Gentium Plus","Noto Sans","Lucida Grande","Helvetica Neue","Arial Unicode MS",serif';

// One audio context for the page, created on the first user gesture.
let audio;
function ctx() {
  if (!audio) {
    const c = new AudioContext();
    const master = c.createGain();
    master.gain.value = 0.5;
    master.connect(c.destination);
    audio = { c, master };
  }
  if (audio.c.state === "suspended") audio.c.resume();
  return audio;
}

// ============================================================ IPA chart

for (const root of document.querySelectorAll("[data-ling-ipa]")) {
  const o = outs(root);
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ipa]");
    if (!b) return;
    for (const x of root.querySelectorAll("[data-ipa][data-on]")) delete x.dataset.on;
    b.dataset.on = "";
    o.sym.textContent = b.dataset.ipa;
    o.desc.textContent = b.dataset.desc;
    o.ex.textContent = b.dataset.ex || "No common example in English, French, Spanish or German.";
  });
}

// ============================================================ Formants

// Bark scale (Traunmüller 1990): distances in Bark track perceived vowel
// differences better than Hz.
const bark = (f) => (26.81 * f) / (1960 + f) - 0.53;

function vowelSynth(f1, f2, f0, dur = 0.9, glide) {
  const { c, master } = ctx();
  const t0 = c.currentTime + 0.02;
  const src = c.createOscillator();
  src.type = "sawtooth"; // a crude stand-in for the glottal pulse train
  src.frequency.value = f0;
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(0.35, t0 + 0.04);
  env.gain.setValueAtTime(0.35, t0 + dur - 0.08);
  env.gain.linearRampToValueAtTime(0, t0 + dur);
  const formants = [[f1, 80, 1], [f2, 100, 0.6], [2500, 140, 0.25]].map(([f, bw, g]) => {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(f, t0);
    bp.Q.value = f / bw;
    const gain = c.createGain();
    gain.gain.value = g * 4;
    src.connect(bp).connect(gain).connect(env);
    return bp;
  });
  if (glide) {
    // glide: [[t, f1, f2], ...] relative times.
    for (const [t, a, b] of glide) {
      formants[0].frequency.linearRampToValueAtTime(a, t0 + t);
      formants[1].frequency.linearRampToValueAtTime(b, t0 + t);
    }
  }
  env.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

for (const root of document.querySelectorAll("[data-ling-formant]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const pts = root.querySelector("template[data-points]").dataset.points.split(";").map((s) => {
    const [sym, word, f1, f2] = s.split("|");
    return { sym, word, f1: +f1, f2: +f2 };
  });
  const s = scrubAll(root, () => draw());
  let f;

  function draw() {
    svg.replaceChildren();
    f = frame(svg, { box: [52, 22, 488, 312], x: [2600, 700], y: [950, 250], xticks: [2500, 2000, 1500, 1000], yticks: [300, 500, 700, 900], xlabel: "F2 (Hz)  ← front · back →", ylabel: "F1 (Hz)" });
    text(svg, f.L + f.W, f.T - 6, "close ↑ · open ↓", { "text-anchor": "end" });
    for (const p of pts) {
      el("circle", { cx: f.sx(p.f2), cy: f.sy(p.f1), r: 3, style: "fill:var(--foreground);fill-opacity:0.6" }, svg);
      const t = text(svg, f.sx(p.f2) + 6, f.sy(p.f1) - 5, p.sym, { class: "fill-foreground text-[15px]", style: `font-family:${IPA_FONT}` });
      t.dataset.vowel = p.sym;
      text(svg, f.sx(p.f2) + 6, f.sy(p.f1) + 9, p.word);
    }
    const f1 = s.f1.get(), f2 = s.f2.get();
    el("circle", { cx: f.sx(f2), cy: f.sy(f1), r: 12, style: "fill:var(--brand);fill-opacity:0.15;stroke:var(--brand);stroke-width:1.5" }, svg);
    el("circle", { cx: f.sx(f2), cy: f.sy(f1), r: 3, style: "fill:var(--brand)" }, svg);
    let best, bd = Infinity;
    for (const p of pts) {
      const d = Math.hypot(bark(p.f1) - bark(f1), bark(p.f2) - bark(f2));
      if (d < bd) { bd = d; best = p; }
    }
    o.nearest.textContent = `${best.sym} (${best.word})`;
    o.nearest.style.fontFamily = IPA_FONT;
    o.dist.textContent = `${num(bd, 2)} Bark`;
  }

  // Drag (or click) on the plot moves the target.
  const toData = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const f2 = 2600 + ((p.x - f.L) / f.W) * (700 - 2600);
    const f1 = 950 + ((f.T + f.H - p.y) / f.H) * (250 - 950);
    return [f1, f2];
  };
  let dragging = false;
  const move = (e) => {
    const [a, b] = toData(e);
    s.f1.set(a, false); s.f2.set(b, false);
    draw();
  };
  svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); move(e); });
  svg.addEventListener("pointermove", (e) => dragging && move(e));
  svg.addEventListener("pointerup", () => { if (dragging) vowelSynth(s.f1.get(), s.f2.get(), s.f0.get()); dragging = false; });

  root.querySelector("[data-action=play]").addEventListener("click", () => vowelSynth(s.f1.get(), s.f2.get(), s.f0.get()));
  root.querySelector("[data-action=glide]").addEventListener("click", () => {
    const path = ["i", "ɑ", "u"].map((v) => pts.find((p) => p.sym === v));
    const dur = 1.8;
    vowelSynth(path[0].f1, path[0].f2, s.f0.get(), dur, [[0.3, path[0].f1, path[0].f2], [0.9, path[1].f1, path[1].f2], [1.5, path[2].f1, path[2].f2]]);
    if (reduced()) return;
    const t0 = performance.now();
    const keys = [[0, path[0]], [300, path[0]], [900, path[1]], [1500, path[2]], [1800, path[2]]];
    const step = (now) => {
      const t = now - t0;
      let i = 0;
      while (i < keys.length - 2 && keys[i + 1][0] < t) i++;
      const [ta, a] = keys[i], [tb, b] = keys[i + 1];
      const k = Math.min(1, Math.max(0, (t - ta) / (tb - ta || 1)));
      s.f1.set(a.f1 + (b.f1 - a.f1) * k, false);
      s.f2.set(a.f2 + (b.f2 - a.f2) * k, false);
      draw();
      if (t < 1800) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  draw();
}

// ============================================================ Syntax trees

// parseBrackets reads labelled bracket notation: [Label child child ...],
// where a child is another bracket or a word.
function parseBrackets(src) {
  const toks = src.match(/\[|\]|[^\s[\]]+/g) || [];
  let i = 0;
  const node = () => {
    if (toks[i] !== "[") throw new Error(`expected "[" but found "${toks[i] ?? "end of input"}"`);
    i++;
    const label = toks[i];
    if (!label || label === "[" || label === "]") throw new Error("every bracket needs a label right after it, like [NP …]");
    i++;
    const kids = [];
    while (toks[i] !== "]") {
      if (i >= toks.length) throw new Error(`bracket [${label} … is never closed`);
      kids.push(toks[i] === "[" ? node() : { word: toks[i++] });
    }
    i++;
    if (!kids.length) throw new Error(`[${label}] has no children`);
    return { label, kids };
  };
  const tree = node();
  if (i < toks.length) throw new Error(`unexpected "${toks[i]}" after the closing bracket`);
  return tree;
}

for (const root of document.querySelectorAll("[data-ling-syntax]")) {
  const input = root.querySelector("[data-input]");
  const svg = root.querySelector("svg[data-tree]");
  const o = outs(root);

  function draw() {
    let tree;
    try {
      tree = parseBrackets(input.value);
      o.error.textContent = "";
    } catch (err) {
      o.error.textContent = err.message;
      return;
    }
    // Leaves get x slots wide enough for their word; parents sit over the
    // middle of their children.
    const LEVEL = 54, PAD = 14;
    let x = PAD, maxDepth = 0;
    const layout = (n, depth) => {
      n.depth = depth;
      maxDepth = Math.max(maxDepth, depth);
      if (n.word) {
        const w = Math.max(44, n.word.length * 8 + 14);
        n.x = x + w / 2;
        x += w;
        return;
      }
      n.kids.forEach((k) => layout(k, depth + 1));
      n.x = (n.kids[0].x + n.kids.at(-1).x) / 2;
    };
    layout(tree, 0);
    const W = x + PAD, H = maxDepth * LEVEL + 40;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.replaceChildren();
    const yOf = (n) => (n.word ? maxDepth * LEVEL + 24 : n.depth * LEVEL + 18);
    const paint = (n) => {
      if (n.word) {
        text(svg, n.x, yOf(n), n.word, { "text-anchor": "middle", class: "fill-foreground text-[14px]" });
        return;
      }
      for (const k of n.kids) {
        el("line", { x1: n.x, y1: yOf(n) + 5, x2: k.x, y2: yOf(k) - 13, style: `stroke:currentColor;stroke-opacity:0.35;stroke-width:1${k.word ? ";stroke-dasharray:2 3" : ""}` }, svg);
        paint(k);
      }
      text(svg, n.x, yOf(n), n.label, { "text-anchor": "middle", class: "fill-brand font-mono text-[12px] font-medium" });
    };
    paint(tree);
  }
  let t = 0;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(draw, 120); });
  root.querySelectorAll("[data-tree]").forEach((b) => b.tagName === "BUTTON" && b.addEventListener("click", () => { input.value = b.dataset.tree; draw(); }));
  draw();
}

// ============================================================ Zipf

for (const root of document.querySelectorAll("[data-ling-zipf]")) {
  const svg = root.querySelector("[data-plot]");
  const input = root.querySelector("[data-input]");
  const o = outs(root);

  function draw() {
    const words = input.value.toLowerCase().match(/\p{L}+(?:['’]\p{L}+)*/gu) || [];
    const counts = new Map();
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    svg.replaceChildren();
    o.tokens.textContent = String(words.length);
    o.types.textContent = String(ranked.length);
    if (ranked.length < 3) { o.slope.textContent = "—"; o.top.textContent = "—"; return; }
    const pts = ranked.map(([, c], i) => [Math.log10(i + 1), Math.log10(c)]);
    const xmax = Math.ceil(Math.log10(ranked.length) * 2) / 2 || 0.5;
    const ymax = Math.ceil(Math.log10(ranked[0][1]) * 2) / 2 || 0.5;
    const f = frame(svg, { box: [52, 16, 488, 284], x: [0, xmax], y: [0, ymax],
      xticks: Array.from({ length: Math.floor(xmax) + 1 }, (_, i) => i), yticks: Array.from({ length: Math.floor(ymax) + 1 }, (_, i) => i),
      xfmt: (v) => String(10 ** v), yfmt: (v) => String(10 ** v), xlabel: "rank (log)", ylabel: "frequency (log)" });
    // Least squares on log–log.
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0), sxy = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
    const b = sxy / sxx, a = my - b * mx;
    // Reference slope −1 from the top word, stopped where it meets frequency 1.
    const xe = Math.min(xmax, pts[0][1]);
    polyline(svg, [[f.sx(0), f.sy(pts[0][1])], [f.sx(xe), f.sy(pts[0][1] - xe)]], "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4");
    text(svg, f.sx(xe) + 4, f.sy(pts[0][1] - xe) - 6, "slope −1");
    for (const [x, y] of pts) el("circle", { cx: f.sx(x), cy: f.sy(y), r: 2.4, style: "fill:var(--brand);fill-opacity:0.55" }, svg);
    polyline(svg, [[f.sx(0), f.sy(a)], [f.sx(xmax), f.sy(a + b * xmax)]], "stroke:var(--foreground);stroke-width:1.5");
    o.slope.textContent = `${num(b, 2)} (fit)`;
    o.top.textContent = ranked.slice(0, 5).map(([w, c]) => `${w} ${c}`).join(" · ");
  }
  let t = 0;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(draw, 150); });
  draw();
}

// ============================================================ Grimm's law

for (const root of document.querySelectorAll("[data-ling-grimm]")) {
  const input = root.querySelector("[data-input]");
  const out = root.querySelector("[data-out=shifted]");
  // Only the consonant shifts. Stops after s stay (Latin piscis keeps its
  // sc; Germanic st, sp, sk never shifted), and in a cluster like pt or ct
  // only the first stop shifts (Latin octō, Gothic ahtau).
  const run = () => {
    const w = input.value.toLowerCase();
    let res = "";
    for (let i = 0; i < w.length; i++) {
      const c = w[i], prev = w[i - 1], next = w[i + 1];
      const afterS = prev === "s";
      const afterStop = "pck".includes(prev ?? "-") && c === "t";
      if (c === "q" && next === "u") { res += afterS ? "qu" : "hw"; i++; continue; }
      const map = { p: "f", t: "th", c: "h", k: "h", d: "t", g: "k", b: "p" };
      res += map[c] && !afterS && !afterStop ? map[c] : c;
    }
    out.textContent = res || "—";
  };
  input.addEventListener("input", run);
  run();
}
