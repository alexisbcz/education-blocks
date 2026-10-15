// Novel engineering tools. Everything stays in the browser: drafts are kept
// in localStorage (when available) and export as Markdown. User text is only
// ever written with textContent, never as HTML.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const fields = (root) => Object.fromEntries([...root.querySelectorAll("[data-nv-field]")].map((n) => [n.dataset.nvField, n]));

// ------------------------------------------------------------ storage

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("novel:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem("novel:" + key, JSON.stringify(value)); } catch {}
  },
};

// Keeps a block's text fields in localStorage, restoring them on load.
function persistFields(root, key, onChange) {
  const f = fields(root);
  const saved = store.get(key, null);
  if (saved) for (const [k, v] of Object.entries(saved)) if (f[k] && typeof v === "string") f[k].value = v;
  const save = () => store.set(key, Object.fromEntries(Object.entries(f).map(([k, n]) => [k, n.value])));
  for (const n of Object.values(f)) n.addEventListener("input", () => { save(); onChange?.(); });
  return { f, save };
}

// ------------------------------------------------------------ export

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "novel";
}

// Wires the Copy / Download buttons of a block to its Markdown.
function exporter(root, name, toMarkdown) {
  const copyBtn = root.querySelector('[data-nv-action="copy-md"]');
  const dlBtn = root.querySelector('[data-nv-action="download-md"]');
  copyBtn?.addEventListener("click", async () => {
    const label = copyBtn.querySelector("[data-nv-copy-label]");
    try {
      await navigator.clipboard.writeText(toMarkdown());
      label.textContent = "Copied";
    } catch {
      label.textContent = "Copy failed";
    }
    clearTimeout(copyBtn._t);
    copyBtn._t = setTimeout(() => (label.textContent = "Copy Markdown"), 1500);
  });
  dlBtn?.addEventListener("click", () => {
    const blob = new Blob([toMarkdown()], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(name())}.md`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
const words = (s) => (s.match(/[A-Za-zÀ-ÿ0-9]+(?:['’][A-Za-zÀ-ÿ]+)*/g) || []).length;

// Makes a small DOM node with classes and text.
function node(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
}

function iconButton(label, glyph) {
  const b = node("button", "flex size-7 items-center justify-center rounded-md border bg-background text-xs text-muted-foreground shadow-xs transition-[color,transform] duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-40", glyph);
  b.type = "button";
  b.setAttribute("aria-label", label);
  return b;
}

// ============================================================ 1 · Beat sheet

// Positions are fractions of the manuscript. Point beats have `at`; spans
// also have `end`.
const STC_PAGES = 110;
const p = (page) => page / STC_PAGES;
const STRUCTURES = {
  "three-act": {
    name: "Three-act structure",
    source: "Three-act structure in the form popularised by Syd Field, Screenplay (1979): plot points turn the story at about a quarter and three quarters of the way through. Positions are conventional approximations.",
    beats: [
      { n: "Setup", at: 0, end: 0.12, d: "The ordinary world, the protagonist and what is at stake." },
      { n: "Inciting incident", at: 0.12, d: "The event that disturbs the ordinary world." },
      { n: "Plot point 1", at: 0.25, d: "The protagonist commits; act two begins." },
      { n: "Midpoint", at: 0.5, d: "A reversal or revelation that raises the stakes." },
      { n: "Plot point 2", at: 0.75, d: "The lowest point or a new piece of information; act three begins." },
      { n: "Climax", at: 0.9, d: "The final confrontation decides the central question." },
      { n: "Resolution", at: 0.95, end: 1, d: "The new normal." },
    ],
  },
  "save-the-cat": {
    name: "Save the Cat! beat sheet",
    source: "Blake Snyder, Save the Cat! (2005): 15 beats placed on the pages of a 110-page screenplay, scaled here to your word count (page ÷ 110).",
    beats: [
      { n: "Opening Image", at: p(1), d: "A snapshot of the hero's world before the story." },
      { n: "Theme Stated", at: p(5), d: "Someone states what the story is really about." },
      { n: "Set-Up", at: p(1), end: p(10), d: "The hero, their world and what is missing." },
      { n: "Catalyst", at: p(12), d: "The life-changing event." },
      { n: "Debate", at: p(12), end: p(25), d: "Should the hero go? The last moment of doubt." },
      { n: "Break into Two", at: p(25), d: "The hero chooses to enter the new world." },
      { n: "B Story", at: p(30), d: "A second story, often a relationship, that carries the theme." },
      { n: "Fun and Games", at: p(30), end: p(55), d: "The promise of the premise." },
      { n: "Midpoint", at: p(55), d: "A false victory or false defeat; stakes rise." },
      { n: "Bad Guys Close In", at: p(55), end: p(75), d: "Pressure from outside and doubt from inside." },
      { n: "All Is Lost", at: p(75), d: "The opposite of the midpoint; a 'whiff of death'." },
      { n: "Dark Night of the Soul", at: p(75), end: p(85), d: "The hero at their lowest." },
      { n: "Break into Three", at: p(85), d: "The solution, found by combining A and B stories." },
      { n: "Finale", at: p(85), end: p(110), d: "The hero applies the lesson." },
      { n: "Final Image", at: p(110), d: "The mirror of the opening image: proof of change." },
    ],
  },
  hero: {
    name: "The hero's journey (Vogler's twelve stages)",
    source: "Christopher Vogler, The Writer's Journey (1992), adapting Joseph Campbell's monomyth from The Hero with a Thousand Faces (1949). Vogler lays the stages over three acts; the positions here are approximate.",
    beats: [
      { n: "Ordinary World", at: 0, end: 0.1, d: "The hero at home, before the adventure." },
      { n: "Call to Adventure", at: 0.1, d: "A problem or challenge appears." },
      { n: "Refusal of the Call", at: 0.15, d: "Fear or reluctance." },
      { n: "Meeting with the Mentor", at: 0.2, d: "Advice, training or a gift." },
      { n: "Crossing the First Threshold", at: 0.25, d: "The hero commits to the special world." },
      { n: "Tests, Allies, Enemies", at: 0.25, end: 0.4, d: "Learning the rules of the special world." },
      { n: "Approach to the Inmost Cave", at: 0.4, end: 0.5, d: "Preparing for the central ordeal." },
      { n: "The Ordeal", at: 0.5, d: "The central crisis: a confrontation with death or deepest fear." },
      { n: "Reward (Seizing the Sword)", at: 0.55, end: 0.65, d: "The hero takes possession of the treasure." },
      { n: "The Road Back", at: 0.75, d: "Recommitment to finishing the journey." },
      { n: "The Resurrection", at: 0.85, end: 0.95, d: "A final test where the hero is transformed." },
      { n: "Return with the Elixir", at: 0.95, end: 1, d: "Home again, changed, with something to share." },
    ],
  },
  freytag: {
    name: "Freytag's pyramid",
    source: "Gustav Freytag, Die Technik des Dramas (1863), describing five-act tragedy: the climax sits near the middle of the play. Novels often place their climax later; positions follow the pyramid.",
    beats: [
      { n: "Exposition", at: 0, end: 0.2, d: "Situation and characters." },
      { n: "Inciting moment", at: 0.2, d: "Freytag's 'exciting force' that starts the rising action." },
      { n: "Rising action", at: 0.2, end: 0.5, d: "Complications build." },
      { n: "Climax", at: 0.5, d: "The turning point of the action." },
      { n: "Falling action", at: 0.5, end: 0.8, d: "Consequences unwind toward the end." },
      { n: "Catastrophe / dénouement", at: 0.8, end: 1, d: "The outcome." },
    ],
  },
  harmon: {
    name: "Dan Harmon's story circle",
    source: "Dan Harmon's story circle: eight steps simplified from Campbell's monomyth, drawn as a circle and laid flat here, an eighth each.",
    beats: ["You", "Need", "Go", "Search", "Find", "Take", "Return", "Change"].map((n, i) => ({
      n: `${i + 1}. ${n}`, at: i / 8, end: (i + 1) / 8,
      d: ["A character in a zone of comfort…", "…but they want something.", "They enter an unfamiliar situation…", "…adapt to it…", "…get what they wanted…", "…pay a heavy price for it…", "…return to their familiar situation…", "…having changed."][i],
    })),
  },
};

for (const root of document.querySelectorAll("[data-novel-beats]")) {
  const svg = root.querySelector("[data-nv-bar]");
  const rows = root.querySelector("[data-nv-beat-rows]");
  const list = root.querySelector("[data-nv-scene-list]");
  const attribution = root.querySelector("[data-nv-attribution]");
  const nameInput = root.querySelector("[data-nv-scene-name]");
  let key = "three-act";
  let scenes = store.get("beats:scenes", [
    { name: "Mara finds the eviction notice", at: 0.1 },
    { name: "She accepts Teo's offer", at: 0.27 },
    { name: "The cellar fire", at: 0.52 },
  ]);
  const s = scrubAll(root, draw);
  const total = () => s.words.get();
  const L = 30, R = 930, W = R - L;
  const X = (f) => L + f * W;

  // The beat a fraction falls in: the narrowest span containing it, else
  // the nearest point beat.
  function beatAt(f) {
    const beats = STRUCTURES[key].beats;
    const inside = beats.filter((b) => b.end !== undefined && f >= b.at && f <= b.end).sort((a, z) => (a.end - a.at) - (z.end - z.at));
    const near = beats.filter((b) => b.end === undefined).sort((a, z) => Math.abs(a.at - f) - Math.abs(z.at - f))[0];
    if (near && Math.abs(near.at - f) <= 0.02) return near;
    return inside[0] ?? near ?? null;
  }

  function draw() {
    const st = STRUCTURES[key];
    attribution.textContent = st.source;
    svg.replaceChildren();
    // Track with quarter guides.
    el("rect", { x: L, y: 52, width: W, height: 10, rx: 5, style: "fill:currentColor;fill-opacity:0.06" }, svg);
    for (const q of [0, 0.25, 0.5, 0.75, 1]) {
      el("line", { x1: X(q), x2: X(q), y1: 46, y2: 68, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
      text(svg, X(q), 82, `${q * 100}%`, { "text-anchor": "middle" });
      text(svg, X(q), 96, fmtInt(q * total()), { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
    }
    // Spans on the track, point beats as ticks with labels in three rows.
    const spans = st.beats.filter((b) => b.end !== undefined);
    spans.forEach((b, i) => el("rect", { x: X(b.at), y: 52, width: Math.max(2, X(b.end) - X(b.at)), height: 10, rx: 3, style: `fill:var(--brand);fill-opacity:${0.12 + (i % 2) * 0.1}` }, svg));
    const labelled = st.beats.map((b, i) => ({ b, i })).sort((a, z) => a.b.at - z.b.at);
    const rowsEnd = [-Infinity, -Infinity, -Infinity];
    for (const { b } of labelled) {
      const x = X(b.end !== undefined ? (b.at + b.end) / 2 : b.at);
      const label = b.n;
      const w = label.length * 5.6 + 6;
      let row = rowsEnd.findIndex((e) => e < x - w / 2);
      if (row < 0) row = rowsEnd.indexOf(Math.min(...rowsEnd));
      rowsEnd[row] = x + w / 2;
      const y = 40 - row * 13;
      if (b.end === undefined) el("line", { x1: X(b.at), x2: X(b.at), y1: y + 2, y2: 62, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
      text(svg, Math.min(R, Math.max(L, x)), y, label, { "text-anchor": "middle", class: b.end === undefined ? "fill-foreground font-sans text-[10px]" : "fill-muted-foreground font-sans text-[10px]" });
    }
    // Your scenes, draggable.
    el("line", { x1: L, x2: R, y1: 130, y2: 130, style: "stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:3 4" }, svg);
    text(svg, L, 150, "your scenes", { class: "fill-muted-foreground font-mono text-[10px]" });
    scenes.forEach((sc, i) => {
      const g = el("g", { tabindex: 0, role: "slider", "aria-label": `${sc.name}, at ${Math.round(sc.at * 100)}%`, "aria-valuenow": Math.round(sc.at * 100), "aria-valuemin": 0, "aria-valuemax": 100, class: "cursor-grab outline-none [&:focus-visible_circle]:stroke-[3px]", "data-nv-scene": i }, svg);
      el("line", { x1: X(sc.at), x2: X(sc.at), y1: 62, y2: 124, style: "stroke:var(--foreground);stroke-opacity:0.25;stroke-dasharray:2 3" }, g);
      el("circle", { cx: X(sc.at), cy: 130, r: 7, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.75" }, g);
      text(g, X(sc.at), 116 - (i % 2) * 0, String(i + 1), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    });

    rows.replaceChildren(...st.beats.map((b) => {
      const tr = node("tr", "border-b last:border-b-0 align-top");
      const td1 = node("td", "px-3 py-2");
      td1.append(node("div", "font-medium", b.n), node("div", "text-xs text-muted-foreground", b.d));
      const at = b.end !== undefined ? `${Math.round(b.at * 100)}–${Math.round(b.end * 100)}%` : `${Math.round(b.at * 100)}%`;
      const wd = b.end !== undefined ? `${fmtInt(b.at * total())}–${fmtInt(b.end * total())}` : fmtInt(b.at * total());
      tr.append(td1, node("td", "px-3 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums", at), node("td", "px-3 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums", wd));
      return tr;
    }));
    drawList();
  }

  function drawList() {
    list.replaceChildren(...scenes.map((sc, i) => {
      const li = node("li", "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm");
      const b = beatAt(sc.at);
      li.append(
        node("span", "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]", String(i + 1)),
        node("span", "min-w-0 flex-1 truncate", sc.name),
        node("span", "shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums", `${Math.round(sc.at * 100)}% · ${fmtInt(sc.at * total())}`),
      );
      if (b) li.append(node("span", "hidden shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand sm:inline", `≈ ${b.n}`));
      const del = iconButton(`Remove ${sc.name}`, "×");
      del.addEventListener("click", () => { scenes.splice(i, 1); save(); draw(); });
      li.append(del);
      return li;
    }));
  }

  const save = () => store.set("beats:scenes", scenes);
  const move = (i, f) => {
    scenes[i].at = Math.min(1, Math.max(0, Math.round(f * 1000) / 1000));
    save();
    draw();
    svg.querySelector(`[data-nv-scene="${i}"]`)?.focus();
  };
  const toFrac = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return (pt.matrixTransform(svg.getScreenCTM().inverse()).x - L) / W;
  };
  let dragging = -1;
  svg.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-nv-scene]");
    if (!g) return;
    dragging = Number(g.dataset.nvScene);
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (dragging < 0) return;
    scenes[dragging].at = Math.min(1, Math.max(0, toFrac(e)));
    draw();
  });
  const end = () => { if (dragging >= 0) { save(); dragging = -1; } };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-nv-scene]");
    if (!g) return;
    const i = Number(g.dataset.nvScene);
    const step = e.shiftKey ? 0.05 : 0.01;
    const to = { ArrowLeft: scenes[i].at - step, ArrowRight: scenes[i].at + step, Home: 0, End: 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    move(i, to);
  });
  root.querySelector("[data-nv-add-scene]").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    scenes.push({ name, at: 0.5 });
    nameInput.value = "";
    save();
    draw();
  });
  root.addEventListener("seg-change", (e) => { key = e.detail.value; draw(); });

  exporter(root, () => `beat sheet ${STRUCTURES[key].name}`, () => {
    const st = STRUCTURES[key];
    const lines = [`# Beat sheet: ${st.name}`, "", `Target length: ${fmtInt(total())} words. ${st.source}`, "", "| Beat | Position | Word |", "| --- | --- | --- |"];
    for (const b of st.beats) {
      lines.push(b.end !== undefined
        ? `| ${b.n} | ${Math.round(b.at * 100)}–${Math.round(b.end * 100)}% | ${fmtInt(b.at * total())}–${fmtInt(b.end * total())} |`
        : `| ${b.n} | ${Math.round(b.at * 100)}% | ${fmtInt(b.at * total())} |`);
    }
    if (scenes.length) {
      lines.push("", "## Scenes", "");
      [...scenes].sort((a, z) => a.at - z.at).forEach((sc) => lines.push(`- ${sc.name}: ${Math.round(sc.at * 100)}% (word ${fmtInt(sc.at * total())}), near ${beatAt(sc.at)?.n ?? "—"}`));
    }
    return lines.join("\n") + "\n";
  });
  draw();
}

// ============================================================ 2 · Character arc

// y = how firmly the character holds the Lie (1) versus the Truth (0).
const ARCS = {
  positive: {
    pts: [[0, 0.85], [0.25, 0.8], [0.5, 0.55], [0.75, 0.68], [0.88, 0.2], [1, 0.1]],
    text: "Positive change arc: the character starts in the Lie, glimpses the Truth at the midpoint, falls back at the third plot point, and chooses the Truth at the climax.",
    beats: (c) => [`Act I: ${c.name} believes "${c.lie}" and chases the want: ${c.want}`, `Midpoint: a moment of truth shows what they need: ${c.need}`, `Act III: they reject the Lie and act on the Truth.`],
  },
  flat: {
    pts: [[0, 0.12], [0.25, 0.12], [0.5, 0.15], [0.75, 0.18], [1, 0.1]],
    world: [[0, 0.88], [0.25, 0.85], [0.5, 0.65], [0.75, 0.55], [1, 0.25]],
    text: "Flat arc: the character already holds the Truth and is tested by it; the world around them (dashed) changes instead.",
    beats: (c) => [`Act I: ${c.name} holds a Truth the world denies.`, `Act II: the Truth is tested; ${c.name} is tempted by the Lie but holds.`, `Act III: the world changes because ${c.name} did not.`],
  },
  disillusionment: {
    pts: [[0, 0.8], [0.25, 0.75], [0.5, 0.5], [0.75, 0.62], [0.9, 0.15], [1, 0.12]],
    text: "Disillusionment arc: the character trades the Lie for a Truth, but the Truth is a hard or tragic one.",
    beats: (c) => [`Act I: ${c.name} believes "${c.lie}".`, `Midpoint: the Truth appears, and it is unwelcome.`, `Act III: ${c.name} accepts a sadder, truer view.`],
  },
  fall: {
    pts: [[0, 0.6], [0.25, 0.62], [0.5, 0.45], [0.75, 0.8], [1, 0.97]],
    text: "Fall arc: the character starts in a Lie, rejects the Truth when it is offered, and ends in a worse Lie.",
    beats: (c) => [`Act I: ${c.name} believes "${c.lie}".`, `Midpoint: the Truth is offered: ${c.need}. They refuse it.`, `Act III: they double down into a worse Lie.`],
  },
  corruption: {
    pts: [[0, 0.15], [0.25, 0.25], [0.5, 0.42], [0.75, 0.72], [1, 0.95]],
    text: "Corruption arc: the character starts with the Truth and is seduced by the Lie.",
    beats: (c) => [`Act I: ${c.name} begins with the Truth.`, `Midpoint: the Lie, "${c.lie}", starts to pay off.`, `Act III: they embrace the Lie.`],
  },
};

// A smooth curve through points (Catmull–Rom to cubic Bézier).
function smoothPath(pts) {
  const f = (q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
  let d = `M${f(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d;
}

for (const root of document.querySelectorAll("[data-novel-arc]")) {
  const svg = root.querySelector("[data-nv-arc-chart]");
  const txt = root.querySelector("[data-nv-arc-text]");
  const beats = root.querySelector("[data-nv-arc-beats]");
  let type = store.get("arc:type", "positive");
  const { f } = persistFields(root, "arc:fields", draw);
  const val = (k) => f[k].value.trim() || "…";

  function draw() {
    const a = ARCS[type];
    svg.replaceChildren();
    const fr = frame(svg, { box: [70, 14, 356, 170], x: [0, 1], y: [0, 1], xticks: [], yticks: [] });
    for (const [x, l] of [[0.125, "Act I"], [0.5, "Act II"], [0.875, "Act III"]]) text(svg, fr.sx(x), 206, l, { "text-anchor": "middle" });
    for (const x of [0.25, 0.75]) el("line", { x1: fr.sx(x), x2: fr.sx(x), y1: fr.T, y2: fr.T + fr.H, style: "stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:3 4" }, svg);
    el("line", { x1: fr.sx(0.5), x2: fr.sx(0.5), y1: fr.T, y2: fr.T + fr.H, style: "stroke:currentColor;stroke-opacity:0.12" }, svg);
    text(svg, 64, fr.sy(1) + 4, "the Lie", { "text-anchor": "end" });
    text(svg, 64, fr.sy(0) + 4, "the Truth", { "text-anchor": "end" });
    const map = (pts) => pts.map(([x, y]) => [fr.sx(x), fr.sy(y)]);
    if (a.world) el("path", { d: smoothPath(map(a.world)), style: "fill:none;stroke:var(--foreground);stroke-opacity:0.45;stroke-width:1.5;stroke-dasharray:5 4" }, svg);
    el("path", { d: smoothPath(map(a.pts)), style: "fill:none;stroke:var(--brand);stroke-width:2.25;stroke-linecap:round" }, svg);
    const last = map(a.pts).at(-1);
    el("circle", { cx: last[0], cy: last[1], r: 3.5, style: "fill:var(--brand)" }, svg);
    txt.textContent = a.text;
    const c = { name: val("name"), want: val("want"), need: val("need"), lie: val("lie") };
    beats.replaceChildren(...a.beats(c).map((b, i) => {
      const li = node("li", "flex gap-2");
      li.append(node("span", "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-medium text-brand", String(i + 1)), node("span", "leading-relaxed", b));
      return li;
    }));
  }

  // Restore the saved arc type in the segmented control.
  const seg = root.querySelector(`[data-seg="${type}"]`);
  if (seg && type !== "positive") seg.click();
  root.addEventListener("seg-change", (e) => { type = e.detail.value; store.set("arc:type", type); draw(); });
  exporter(root, () => `character arc ${val("name")}`, () => [
    `# Character arc: ${val("name")}`, "",
    `- **Arc type:** ${type}`, `- **Want:** ${val("want")}`, `- **Need:** ${val("need")}`, `- **Lie:** ${val("lie")}`, `- **Ghost / wound:** ${val("ghost")}`, "",
    ARCS[type].text, "",
    ...ARCS[type].beats({ name: val("name"), want: val("want"), need: val("need"), lie: val("lie") }).map((b, i) => `${i + 1}. ${b}`),
    "", "_After K. M. Weiland, Creating Character Arcs (2016)._", "",
  ].join("\n"));
  draw();
}

// ============================================================ 3 · Scene & sequel

const CARD_FIELDS = {
  scene: [["goal", "Goal", "What the viewpoint character wants in this scene"], ["conflict", "Conflict", "What stands in the way"], ["disaster", "Disaster", "How it goes wrong (or worse)"]],
  sequel: [["reaction", "Reaction", "The emotional response to the disaster"], ["dilemma", "Dilemma", "The options, all bad"], ["decision", "Decision", "The choice that becomes the next goal"]],
};

for (const root of document.querySelectorAll("[data-novel-scenes]")) {
  const list = root.querySelector("[data-nv-cards]");
  const count = root.querySelector("[data-nv-scene-count]");
  let cards = store.get("scenes:cards", [
    { type: "scene", goal: "Mara asks the bank for three more months.", conflict: "The new manager has orders to sell.", disaster: "He moves the auction forward to next week." },
    { type: "sequel", reaction: "Panic, then anger at her father.", dilemma: "Sell the vines herself, or ask Teo, who ruined him.", decision: "" },
    { type: "scene", goal: "", conflict: "", disaster: "" },
  ]);
  const save = () => store.set("scenes:cards", cards);

  function hints(i) {
    const c = cards[i], out = [];
    const missing = CARD_FIELDS[c.type].filter(([k]) => !(c[k] || "").trim()).map(([, l]) => l.toLowerCase());
    if (missing.length) out.push(`Missing: ${missing.join(", ")}.`);
    const prev = cards[i - 1], next = cards[i + 1];
    if (c.type === "scene" && prev?.type === "scene") out.push("Two scenes in a row: Swain's chain puts a sequel between them, or the reaction happens off the page.");
    if (c.type === "sequel" && prev && prev.type !== "scene") out.push("A sequel reacts to a scene's disaster; there is none just before it.");
    if (c.type === "sequel" && (c.decision || "").trim() && next?.type === "scene" && !(next.goal || "").trim()) out.push("The decision should become the next scene's goal: fill that goal in.");
    if (c.type === "scene" && (c.disaster || "").trim() && /\b(succeeds?|wins?|gets? what)\b/i.test(c.disaster)) out.push("Swain's disaster is a setback: if the character simply succeeds, the scene loses its hook.");
    return out;
  }

  function render(focus = -1) {
    list.replaceChildren(...cards.map((c, i) => {
      const li = node("li", "flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50");
      li.tabIndex = 0;
      li.dataset.nvCard = i;
      const head = node("div", "flex items-center gap-2");
      head.append(
        node("span", "font-mono text-[11px] text-muted-foreground tabular-nums", String(i + 1).padStart(2, "0")),
        node("span", c.type === "scene" ? "rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-medium text-brand" : "rounded-full bg-vec-u/12 px-2 py-0.5 text-[11px] font-medium text-vec-u", c.type === "scene" ? "Scene" : "Sequel"),
        node("span", "flex-1"),
      );
      const up = iconButton("Move up", "↑"), down = iconButton("Move down", "↓"), del = iconButton("Delete card", "×");
      up.disabled = i === 0;
      down.disabled = i === cards.length - 1;
      up.addEventListener("click", () => swap(i, i - 1));
      down.addEventListener("click", () => swap(i, i + 1));
      del.addEventListener("click", () => { cards.splice(i, 1); save(); render(); });
      head.append(up, down, del);
      li.append(head);
      const grid = node("div", "grid gap-2 sm:grid-cols-3");
      for (const [k, label, ph] of CARD_FIELDS[c.type]) {
        const lab = node("label", "flex flex-col gap-1 text-xs text-muted-foreground");
        lab.append(label);
        const ta = node("textarea", "min-h-16 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-base leading-snug text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm");
        ta.rows = 2;
        ta.placeholder = ph;
        ta.value = c[k] || "";
        ta.addEventListener("input", () => { c[k] = ta.value; save(); updateHints(); });
        lab.append(ta);
        grid.append(lab);
      }
      li.append(grid, node("ul", "flex flex-col gap-1 text-xs text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))] empty:hidden"));
      li.lastChild.dataset.nvHints = i;
      return li;
    }));
    updateHints();
    const sc = cards.filter((c) => c.type === "scene").length;
    count.textContent = `${sc} scene${sc === 1 ? "" : "s"} · ${cards.length - sc} sequel${cards.length - sc === 1 ? "" : "s"}`;
    if (focus >= 0) list.querySelector(`[data-nv-card="${focus}"]`)?.focus();
  }
  function updateHints() {
    for (const ul of list.querySelectorAll("[data-nv-hints]")) {
      ul.replaceChildren(...hints(Number(ul.dataset.nvHints)).map((t) => node("li", "flex gap-1.5", "• " + t)));
    }
  }
  function swap(i, j) {
    if (j < 0 || j >= cards.length) return;
    [cards[i], cards[j]] = [cards[j], cards[i]];
    save();
    render(j);
  }
  list.addEventListener("keydown", (e) => {
    const li = e.target.closest("[data-nv-card]");
    if (!li || e.target !== li || !e.altKey) return;
    const i = Number(li.dataset.nvCard);
    if (e.key === "ArrowUp") { e.preventDefault(); swap(i, i - 1); }
    if (e.key === "ArrowDown") { e.preventDefault(); swap(i, i + 1); }
  });
  for (const t of ["scene", "sequel"]) {
    root.querySelector(`[data-nv-action="add-${t}"]`).addEventListener("click", () => {
      cards.push({ type: t });
      save();
      render(cards.length - 1);
    });
  }
  exporter(root, () => "scene and sequel", () => {
    const lines = ["# Scene and sequel plan", ""];
    cards.forEach((c, i) => {
      lines.push(`## ${i + 1}. ${c.type === "scene" ? "Scene" : "Sequel"}`, "");
      for (const [k, label] of CARD_FIELDS[c.type]) lines.push(`- **${label}:** ${(c[k] || "").trim() || "_(empty)_"}`);
      lines.push("");
    });
    lines.push("_Dwight V. Swain, Techniques of the Selling Writer (1965)._", "");
    return lines.join("\n");
  });
  render();
}

// ============================================================ 4 · Pacing

// Illustrative tension shapes (0–10) by position; not a rule.
const SHAPES = {
  "three-act": [[0, 2], [0.12, 4], [0.25, 5.5], [0.37, 5], [0.5, 6.5], [0.62, 6], [0.75, 7.5], [0.9, 9.5], [1, 4]],
  "save-the-cat": [[0, 2], [0.11, 4], [0.23, 4.5], [0.27, 5], [0.5, 6.5], [0.68, 7.5], [0.75, 8], [0.82, 5], [0.95, 9.5], [1, 3]],
};
const SAMPLE_CHAPTERS = [[3200, 2], [4100, 3], [3600, 4], [2800, 4], [4500, 6], [3900, 5], [3300, 3], [4200, 2], [3800, 3], [3100, 2], [4400, 7], [3600, 6], [3000, 5], [4700, 7], [3900, 8], [2600, 4], [3400, 6], [4100, 8], [3700, 9], [2200, 3]];

for (const root of document.querySelectorAll("[data-novel-pacing]")) {
  const svg = root.querySelector("[data-nv-pace-chart]");
  const tbody = root.querySelector("[data-nv-pace-rows]");
  const flags = root.querySelector("[data-nv-pace-flags]");
  const o = outs(root);
  let shape = "three-act";
  let chapters = store.get("pacing:chapters", SAMPLE_CHAPTERS.map(([w, t]) => ({ w, t })));
  const save = () => store.set("pacing:chapters", chapters);

  function rowsRender() {
    tbody.replaceChildren(...chapters.map((c, i) => {
      const tr = node("tr", "border-b last:border-b-0");
      const mk = (k, min, max, step, label) => {
        const inp = node("input", "h-8 w-full rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm");
        Object.assign(inp, { type: "number", min, max, step, value: c[k] });
        inp.setAttribute("aria-label", `${label}, chapter ${i + 1}`);
        inp.addEventListener("input", () => {
          const v = Number(inp.value);
          if (Number.isFinite(v)) { c[k] = Math.min(max, Math.max(min, v)); save(); draw(); }
        });
        const td = node("td", "px-2 py-1");
        td.append(inp);
        return td;
      };
      const del = iconButton(`Remove chapter ${i + 1}`, "×");
      del.addEventListener("click", () => { chapters.splice(i, 1); save(); rowsRender(); draw(); });
      const tdDel = node("td", "px-1 py-1");
      tdDel.append(del);
      tr.append(node("td", "px-2 py-1 font-mono text-xs text-muted-foreground tabular-nums", String(i + 1)), mk("w", 0, 50000, 100, "Words"), mk("t", 0, 10, 1, "Tension"), tdDel);
      return tr;
    }));
  }

  function draw() {
    svg.replaceChildren();
    const total = chapters.reduce((a, c) => a + c.w, 0) || 1;
    const f = frame(svg, { box: [36, 14, 590, 240], x: [0, 1], y: [0, 10], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, 5, 10], xfmt: (v) => `${v * 100}%`, xlabel: "position in the book", ylabel: "tension" });
    // Long low-tension stretches: consecutive chapters at ≤ 3 covering > 10%.
    const stretches = [];
    let start = -1, acc = 0, pos = 0;
    const spans = chapters.map((c) => { const s = { a: pos / total, b: (pos + c.w) / total, t: c.t }; pos += c.w; return s; });
    chapters.forEach((c, i) => {
      if (c.t <= 3) { if (start < 0) { start = i; acc = 0; } acc += c.w; }
      if ((c.t > 3 || i === chapters.length - 1) && start >= 0) {
        const endI = c.t <= 3 ? i : i - 1;
        if (acc / total > 0.1) stretches.push({ from: start, to: endI, share: acc / total });
        start = -1;
      }
    });
    for (const st of stretches) el("rect", { x: f.sx(spans[st.from].a), y: f.T, width: f.sx(spans[st.to].b) - f.sx(spans[st.from].a), height: f.H, style: "fill:var(--vec-out);fill-opacity:0.18" }, svg);
    for (const s of spans) el("rect", { x: f.sx(s.a) + 0.5, y: f.sy(s.t), width: Math.max(0.5, f.sx(s.b) - f.sx(s.a) - 1), height: f.T + f.H - f.sy(s.t), style: "fill:var(--brand);fill-opacity:0.18" }, svg);
    polyline(svg, SHAPES[shape].map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1.5;stroke-dasharray:5 4");
    polyline(svg, spans.map((s) => [f.sx((s.a + s.b) / 2), f.sy(s.t)]), "stroke:var(--brand);stroke-width:2;stroke-linejoin:round");
    for (const s of spans) el("circle", { cx: f.sx((s.a + s.b) / 2), cy: f.sy(s.t), r: 2.5, style: "fill:var(--brand)" }, svg);

    flags.replaceChildren(...(stretches.length
      ? stretches.map((st) => node("li", "flex gap-2 text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))]", `▲ Chapters ${st.from + 1}–${st.to + 1} (${Math.round(st.share * 100)}% of the book) stay at tension 3 or below.`))
      : [node("li", "text-muted-foreground", "No stretch of low tension longer than 10% of the book.")]));
    o.count.textContent = String(chapters.length);
    o.total.textContent = fmtInt(total);
    o.mean.textContent = chapters.length ? num(chapters.reduce((a, c) => a + c.t * c.w, 0) / total, 1) + " (by words)" : "—";
  }

  root.addEventListener("seg-change", (e) => { shape = e.detail.value; draw(); });
  root.querySelector('[data-nv-action="add-chapter"]').addEventListener("click", () => { chapters.push({ w: 3000, t: 5 }); save(); rowsRender(); draw(); });
  root.querySelector('[data-nv-action="sample"]').addEventListener("click", () => { chapters = SAMPLE_CHAPTERS.map(([w, t]) => ({ w, t })); save(); rowsRender(); draw(); });
  rowsRender();
  draw();
}

// ============================================================ 5 · Deadline

const DAY = 86400000;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

// Writing days in [from, to], counting the first n weekdays (Mon…) of each week.
function writingDays(from, to, perWeek) {
  let n = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const wd = (new Date(t).getDay() + 6) % 7; // Monday = 0
    if (wd < perWeek) n++;
  }
  return n;
}

for (const root of document.querySelectorAll("[data-novel-deadline]")) {
  const svg = root.querySelector("[data-nv-burn]");
  const o = outs(root);
  const dates = Object.fromEntries([...root.querySelectorAll("[data-nv-date]")].map((n) => [n.dataset.nvDate, n]));
  const s = scrubAll(root, () => { persist(); draw(); });
  const saved = store.get("deadline", null);
  const t0 = today();
  // Default: a book started a month ago, due in three months.
  dates.start.value = saved?.start ?? iso(new Date(t0.getTime() - 30 * DAY));
  dates.end.value = saved?.end ?? iso(new Date(t0.getTime() + 90 * DAY));
  if (saved) for (const k of ["target", "done", "days"]) if (typeof saved[k] === "number") s[k].set(saved[k], false);
  const persist = () => store.set("deadline", { start: dates.start.value, end: dates.end.value, target: s.target.get(), done: s.done.get(), days: s.days.get() });
  for (const d of Object.values(dates)) d.addEventListener("change", () => { persist(); draw(); });

  function draw() {
    svg.replaceChildren();
    const start = dates.start.value ? parseDate(dates.start.value) : t0;
    const end = dates.end.value ? parseDate(dates.end.value) : t0;
    const target = s.target.get(), done = Math.min(s.done.get(), target), per = Math.round(s.days.get());
    if (end < start) { o.left.textContent = "—"; o.quota.textContent = "—"; o.weekly.textContent = "—"; o.status.textContent = "deadline before start"; return; }
    const from = t0 > start ? t0 : start;
    const left = from > end ? 0 : writingDays(from, end, per);
    const all = writingDays(start, end, per);
    const remaining = target - done;
    const quota = left ? Math.ceil(remaining / left) : NaN;
    o.left.textContent = String(left);
    o.quota.textContent = Number.isFinite(quota) ? `${fmtInt(quota)} words` : "—";
    o.weekly.textContent = Number.isFinite(quota) ? `${fmtInt(quota * per)} words` : "—";
    // Where the plan says you should be today, counting writing days.
    const elapsed = t0 < start ? 0 : writingDays(start, t0 > end ? end : new Date(t0.getTime() - DAY), per);
    const planned = all ? (target * elapsed) / all : 0;
    const diff = done - planned;
    o.status.textContent = remaining <= 0 ? "done" : t0 < start ? "not started" : left === 0 ? "past the deadline" : Math.abs(diff) < 1 ? "on the line" : diff > 0 ? `${fmtInt(diff)} ahead` : `${fmtInt(-diff)} behind`;
    o.status.className = "tabular-nums " + (remaining <= 0 || diff >= 0 ? "text-add" : "text-del");

    const span = Math.max(1, (end - start) / DAY);
    const f = frame(svg, { box: [56, 14, 568, 240], x: [0, span], y: [0, target], xticks: [0, span / 2, span], yticks: [0, target / 2, target], xfmt: (v) => iso(new Date(start.getTime() + v * DAY)).slice(5), yfmt: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))), ylabel: "words left" });
    // The ideal line drops only on writing days.
    const ideal = [];
    let w = 0;
    for (let d = 0; d <= span; d++) {
      const t = new Date(start.getTime() + d * DAY);
      if ((t.getDay() + 6) % 7 < per) w++;
      ideal.push([f.sx(d), f.sy(target - (all ? (target * w) / all : 0))]);
    }
    polyline(svg, [[f.sx(0), f.sy(target)], ...ideal], "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:1.5;stroke-dasharray:5 4");
    const td = Math.min(span, Math.max(0, (t0 - start) / DAY));
    el("line", { x1: f.sx(td), x2: f.sx(td), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.2" }, svg);
    text(svg, f.sx(td) + (td > span * 0.85 ? -4 : 4), f.T + f.H - 6, "today", { "text-anchor": td > span * 0.85 ? "end" : "start" });
    polyline(svg, [[f.sx(0), f.sy(target)], [f.sx(td), f.sy(remaining)]], "stroke:var(--brand);stroke-width:2");
    el("circle", { cx: f.sx(td), cy: f.sy(remaining), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    if (left && Number.isFinite(quota)) polyline(svg, [[f.sx(td), f.sy(remaining)], [f.sx(span), f.sy(0)]], "stroke:var(--brand);stroke-opacity:0.4;stroke-width:1.5;stroke-dasharray:2 3");
  }

  root.querySelector('[data-nv-action="nano"]').addEventListener("click", () => {
    // The next November (this one if it isn't over yet).
    let y = t0.getFullYear();
    if (t0 > new Date(y, 10, 30)) y++;
    dates.start.value = iso(new Date(y, 10, 1));
    dates.end.value = iso(new Date(y, 10, 30));
    s.target.set(50000, false);
    s.done.set(0, false);
    s.days.set(7, false);
    persist();
    draw();
  });
  draw();
}

// ============================================================ 6 · Prose analyser

// Syllables: vowel groups (a e i o u y), minus a silent final e (but not
// "-le"), at least one per word. A heuristic; dictionaries differ.
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  let n = (w.match(/[aeiouy]+/g) || []).length;
  if (n > 1 && w.endsWith("e") && !w.endsWith("le") && !/[aeiouy]e$/.test(w)) n--;
  return Math.max(1, n);
}

const LY_EXCEPTIONS = new Set("only family reply apply supply early holy belly jelly july italy ugly silly lily rely ally bully fly daily weekly monthly yearly friendly lonely lovely likely costly elderly holly folly rally assembly anomaly melancholy monopoly curly woolly chilly hilly smelly sly imply comply multiply butterfly".split(" "));
const FILTER = new Set("feel feels felt feeling see sees saw seeing seen hear hears heard hearing notice notices noticed noticing realise realises realised realize realizes realized wonder wonders wondered think thinks thought know knows knew seem seems seemed watch watches watched decide decides decided".split(" "));
const BE = new Set("am is are was were be been being".split(" "));
const IRREGULAR_PP = new Set("given taken written done seen made known shown told left found held kept brought built bought caught taught sent spent lost paid put set cut hit hurt read run won broken chosen driven eaten fallen forgotten frozen hidden ridden shaken spoken stolen sworn torn worn woken beaten bitten born borne drawn flown grown thrown blown sung sunk drunk begun swum bent burnt dealt heard meant slept swept wept laid led said sold struck stuck shut split spread bound wound ground forbidden".split(" "));
const STOP = new Set("that this with from they them their there then than have were what when where which while your yours would could should about into just like also some only very even over more most much many such been being after before because again still here than these those each other both".split(" "));

export function analyse(textIn) {
  const tokens = [...textIn.matchAll(/[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)*/g)];
  const sentences = textIn.split(/(?<=[.!?])["'”’)\]]*\s+/).map((s) => s.trim()).filter((s) => /[A-Za-z]/.test(s));
  const wordsN = tokens.length;
  const syl = tokens.reduce((a, t) => a + syllables(t[0]), 0);
  const sN = Math.max(1, sentences.length);
  const fre = wordsN ? 206.835 - 1.015 * (wordsN / sN) - 84.6 * (syl / wordsN) : NaN;
  const fk = wordsN ? 0.39 * (wordsN / sN) + 11.8 * (syl / wordsN) - 15.59 : NaN;
  const marks = new Map(); // token index → set of kinds
  const mark = (i, k) => { if (!marks.has(i)) marks.set(i, new Set()); marks.get(i).add(k); };
  const lower = tokens.map((t) => t[0].toLowerCase());
  let ly = 0, filter = 0, passive = 0, repeats = 0;
  const last = new Map();
  lower.forEach((w, i) => {
    if (w.length > 4 && w.endsWith("ly") && !LY_EXCEPTIONS.has(w)) { mark(i, "ly"); ly++; }
    if (FILTER.has(w)) { mark(i, "filter"); filter++; }
    if (BE.has(w)) {
      let j = i + 1;
      if (lower[j]?.endsWith("ly")) j++;
      const nx = lower[j];
      if (nx && ((nx.length > 3 && nx.endsWith("ed")) || IRREGULAR_PP.has(nx))) { mark(i, "passive"); mark(j, "passive"); passive++; }
    }
    if (w.length >= 4 && !STOP.has(w)) {
      if (last.has(w) && i - last.get(w) <= 30) { mark(i, "repeat"); repeats++; }
      last.set(w, i);
    }
  });
  return { tokens, sentences, wordsN, sentN: sentences.length, syl, fre, fk, marks, ly, filter, passive, repeats };
}

const BANDS = [[90, "very easy"], [80, "easy"], [70, "fairly easy"], [60, "plain English"], [50, "fairly difficult"], [30, "difficult"], [-Infinity, "very difficult"]];
const MARK_CLASS = { ly: "rounded-sm bg-vec-out/25", filter: "rounded-sm bg-vec-u/20", passive: "rounded-sm bg-brand/20", repeat: "underline decoration-del decoration-wavy underline-offset-4" };

for (const root of document.querySelectorAll("[data-novel-prose]")) {
  const { f } = persistFields(root, "prose", () => schedule());
  const marked = root.querySelector("[data-nv-marked]");
  const rhythm = root.querySelector("[data-nv-rhythm]");
  const band = root.querySelector("[data-nv-band]");
  const o = outs(root);
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 150); };

  function run() {
    const t = f.text.value;
    const a = analyse(t);
    o.words.textContent = fmtInt(a.wordsN);
    o.sentences.textContent = fmtInt(a.sentN);
    o.syllables.textContent = fmtInt(a.syl);
    o.fre.textContent = Number.isFinite(a.fre) ? num(a.fre, 1) : "—";
    o.fk.textContent = Number.isFinite(a.fk) ? num(a.fk, 1) : "—";
    o.msl.textContent = a.sentN ? `${num(a.wordsN / a.sentN, 1)} words` : "—";
    o.ly.textContent = String(a.ly);
    o.filter.textContent = String(a.filter);
    o.passive.textContent = String(a.passive);
    o.repeats.textContent = String(a.repeats);
    band.textContent = Number.isFinite(a.fre) ? `Flesch band: ${BANDS.find(([lo]) => a.fre >= lo)[1]}.` : "—";

    // Rebuild the text with marks, as text nodes and spans only.
    const frag = document.createDocumentFragment();
    let pos = 0;
    a.tokens.forEach((tok, i) => {
      if (tok.index > pos) frag.append(t.slice(pos, tok.index));
      const kinds = a.marks.get(i);
      if (kinds) {
        const sp = node("span", [...kinds].map((k) => MARK_CLASS[k]).join(" "), tok[0]);
        sp.title = [...kinds].map((k) => ({ ly: "-ly adverb", filter: "filter word", passive: "possible passive", repeat: "repeated nearby" })[k]).join(", ");
        frag.append(sp);
      } else frag.append(tok[0]);
      pos = tok.index + tok[0].length;
    });
    frag.append(t.slice(pos));
    marked.replaceChildren(frag);

    rhythm.replaceChildren();
    const lens = a.sentences.map((s) => words(s));
    const max = Math.max(10, ...lens);
    const fr = frame(rhythm, { box: [30, 8, 600, 80], x: [0, Math.max(1, lens.length)], y: [0, max], xticks: [], yticks: [0, max] });
    const bw = fr.W / Math.max(1, lens.length);
    lens.forEach((l, i) => el("rect", { x: fr.L + i * bw + 1, y: fr.sy(l), width: Math.max(1, bw - 2), height: fr.T + fr.H - fr.sy(l), rx: 1.5, style: "fill:var(--brand);fill-opacity:0.55" }, rhythm));
    if (lens.length) {
      const mean = lens.reduce((x, y) => x + y, 0) / lens.length;
      el("line", { x1: fr.L, x2: fr.L + fr.W, y1: fr.sy(mean), y2: fr.sy(mean), style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:4 4" }, rhythm);
      text(rhythm, fr.L + fr.W, fr.sy(mean) - 4, `mean ${num(mean, 1)}`, { "text-anchor": "end" });
    }
  }
  run();
}

// ============================================================ 7 · Dialogue

const SPEECH = new Set("said says say asked asks ask replied replies answered answers whispered whispers told tells called shouted yelled cried muttered murmured".split(" "));
const BOOKISMS = new Set("exclaimed retorted growled hissed snapped barked snarled bellowed intoned opined queried interjected ejaculated declared stated proclaimed announced uttered quipped purred cooed sneered spat mused chortled hollered rasped huffed gasped".split(" "));
const ACTIONS = new Set("smiled laughed grinned nodded shrugged frowned chuckled giggled winked sighed beamed smirked scoffed".split(" "));
const PRONOUNS = new Set("he she they i we you it".split(" "));

export function checkDialogue(src) {
  const issues = [];
  let quotes = 0, tags = 0, saidTags = 0;
  const lines = src.split("\n");
  lines.forEach((line, li) => {
    const re = /(["“])([^"“”]*)(["”])/g;
    let m;
    while ((m = re.exec(line))) {
      quotes++;
      const inner = m[2];
      const after = line.slice(m.index + m[0].length);
      const tag = after.match(/^(\s*)([A-Za-z]+)\s+([A-Za-z]+)\b/);
      const lastChar = inner.trimEnd().slice(-1);
      if (!tag) continue;
      const [, space, who, verb] = tag;
      const v = verb.toLowerCase();
      const isTag = SPEECH.has(v) || BOOKISMS.has(v) || ACTIONS.has(v);
      if (!isTag || !(PRONOUNS.has(who.toLowerCase()) || /^[A-Z]/.test(who))) continue;
      tags++;
      if (v === "said" || v === "says") saidTags++;
      const excerpt = (m[0] + after).trim().slice(0, 90);
      if (ACTIONS.has(v)) {
        issues.push({ line: li + 1, kind: "beat", excerpt, msg: `"${verb}" is an action, not a way of speaking: make it a beat in its own sentence.`, fix: `${m[1]}${inner.replace(/[,]$/, ".")}${m[3]} ${who[0].toUpperCase() + who.slice(1)} ${verb}.` });
        continue;
      }
      if (lastChar === ".") {
        issues.push({ line: li + 1, kind: "punct", excerpt, msg: "A full stop before a speech tag: use a comma (or ? or ! if the line asks or exclaims).", fix: `${m[1]}${inner.trimEnd().slice(0, -1)},${m[3]}${space}${who.toLowerCase() === "i" || !PRONOUNS.has(who.toLowerCase()) ? who : who.toLowerCase()} ${verb}` });
      } else if (/[A-Za-z0-9]/.test(lastChar)) {
        issues.push({ line: li + 1, kind: "punct", excerpt, msg: "Missing punctuation inside the quotation marks before the tag.", fix: `${m[1]}${inner},${m[3]}${space}${who} ${verb}` });
      }
      if (/[,?!—…-]/.test(lastChar) && PRONOUNS.has(who.toLowerCase()) && who !== "I" && /^[A-Z]/.test(who)) {
        issues.push({ line: li + 1, kind: "case", excerpt, msg: "The tag continues the sentence: lowercase the pronoun after the comma.", fix: `${m[1]}${inner}${m[3]}${space}${who.toLowerCase()} ${verb}` });
      }
      if (BOOKISMS.has(v)) {
        issues.push({ line: li + 1, kind: "style", excerpt, msg: `Said-bookism "${verb}": "said" usually disappears on the page; let the line carry the feeling.`, fix: `… ${who} said.` });
      }
    }
  });
  return { issues, quotes, tags, saidTags };
}

const KIND_LABEL = { punct: ["Punctuation", "bg-del/12 text-del"], case: ["Capitalisation", "bg-del/12 text-del"], beat: ["Action, not a tag", "bg-vec-out/20 text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))]"], style: ["Style", "bg-vec-u/12 text-vec-u"] };

for (const root of document.querySelectorAll("[data-novel-dialogue]")) {
  const { f } = persistFields(root, "dialogue", () => schedule());
  const list = root.querySelector("[data-nv-dlg-issues]");
  const count = root.querySelector("[data-nv-dlg-count]");
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 150); };
  function run() {
    const r = checkDialogue(f.text.value);
    count.textContent = `${r.quotes} quotations · ${r.tags} tags (${r.saidTags} "said") · ${r.issues.length} findings`;
    list.replaceChildren(...(r.issues.length ? r.issues.map((it) => {
      const li = node("li", "flex flex-col gap-1.5 rounded-lg border bg-background p-3");
      const head = node("div", "flex flex-wrap items-center gap-2");
      const [lab, cls] = KIND_LABEL[it.kind];
      head.append(node("span", "rounded-full px-2 py-0.5 text-[11px] font-medium " + cls, lab), node("span", "font-mono text-[11px] text-muted-foreground", `line ${it.line}`));
      li.append(head, node("p", "font-mono text-[12px] text-muted-foreground", it.excerpt), node("p", "text-sm", it.msg));
      const fix = node("p", "font-mono text-[12px]");
      fix.append(node("span", "text-muted-foreground", "→ "), node("span", "text-add", it.fix));
      li.append(fix);
      return li;
    }) : [node("li", "text-sm text-muted-foreground", "No findings.")]));
  }
  run();
}

// ============================================================ 8 · POV & tense

const FIRST = new Set("i me my mine myself we us our ours ourselves".split(" "));
const THIRD = new Set("he him his himself she her hers herself they them their theirs themselves".split(" "));
const PAST = new Set("was were had did said went came saw took made knew thought felt got gave told became left stood sat ran found kept held brought began seemed looked wanted needed".split(" "));
const PRESENT = new Set("am is are has does says goes comes sees takes makes knows thinks feels gets gives tells becomes stands sits runs walks watches wonders waits looks turns opens holds keeps begins seems wants needs likes".split(" "));
const BASE_AFTER_I = new Set("walk watch wonder wait look turn feel think know see say go come stand want need like hold keep begin hear".split(" "));
const NOT_PAST_ED = new Set("need feed seed speed breed bleed indeed proceed succeed exceed red bed shed wed sled hundred naked wicked sacred beloved kindred".split(" "));

export function povTense(src) {
  const paras = src.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paras.map((p) => {
    const narration = p.replace(/["“][^"”]*["”]/g, " ");
    const toks = (narration.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []);
    let first = 0, third = 0, past = 0, present = 0;
    toks.forEach((w, i) => {
      if (FIRST.has(w)) first++;
      if (THIRD.has(w)) third++;
      if (PAST.has(w) || (w.length > 4 && w.endsWith("ed") && !NOT_PAST_ED.has(w))) past++;
      if (PRESENT.has(w)) present++;
      if (BASE_AFTER_I.has(w) && (toks[i - 1] === "i" || toks[i - 1] === "we")) present++;
    });
    // Any first-person pronoun in the narration makes a first-person narrator:
    // first-person narrators talk about other people all the time.
    const pov = first > 0 ? "first" : third > 0 ? "third" : "unclear";
    const tense = past === 0 && present === 0 ? "unclear" : present > past ? "present" : "past";
    return { text: p, first, third, past, present, pov, tense };
  });
}

for (const root of document.querySelectorAll("[data-novel-pov]")) {
  const { f } = persistFields(root, "pov", () => schedule());
  const rows = root.querySelector("[data-nv-pov-rows]");
  const mainPov = root.querySelector("[data-nv-main-pov]");
  const mainTense = root.querySelector("[data-nv-main-tense]");
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 150); };
  const majority = (arr) => {
    const c = {};
    for (const x of arr) if (x !== "unclear") c[x] = (c[x] || 0) + 1;
    return Object.entries(c).sort((a, z) => z[1] - a[1])[0]?.[0] ?? "unclear";
  };
  function run() {
    const ps = povTense(f.text.value);
    const mp = majority(ps.map((p) => p.pov));
    // Tense ties are broken by the total verb counts.
    let mt = majority(ps.map((p) => p.tense));
    const tally = ps.reduce((a, p) => ({ past: a.past + p.past, present: a.present + p.present }), { past: 0, present: 0 });
    const tenseCounts = ps.reduce((a, p) => ((a[p.tense] = (a[p.tense] || 0) + 1), a), {});
    if (tenseCounts.past === tenseCounts.present) mt = tally.present > tally.past ? "present" : "past";
    mainPov.textContent = mp === "unclear" ? "—" : `${mp} person`;
    mainTense.textContent = mt === "unclear" ? "—" : mt;
    rows.replaceChildren(...ps.map((p, i) => {
      const povShift = p.pov !== "unclear" && mp !== "unclear" && p.pov !== mp;
      const tenseShift = p.tense !== "unclear" && mt !== "unclear" && p.tense !== mt;
      const li = node("li", "flex flex-col gap-1.5 rounded-lg border p-3 " + (povShift || tenseShift ? "border-vec-out/50 bg-vec-out/8" : "bg-background"));
      const head = node("div", "flex flex-wrap items-center gap-2");
      head.append(
        node("span", "font-mono text-[11px] text-muted-foreground", `¶ ${i + 1}`),
        node("span", "rounded-full border px-2 py-0.5 text-[11px]", p.pov === "unclear" ? "POV ?" : `${p.pov} person`),
        node("span", "rounded-full border px-2 py-0.5 text-[11px]", p.tense === "unclear" ? "tense ?" : p.tense),
        node("span", "font-mono text-[11px] text-muted-foreground", `1st ${p.first} · 3rd ${p.third} · past ${p.past} · present ${p.present}`),
      );
      if (povShift) head.append(node("span", "rounded-full bg-vec-out/20 px-2 py-0.5 text-[11px] font-medium", "POV shift"));
      if (tenseShift) head.append(node("span", "rounded-full bg-vec-out/20 px-2 py-0.5 text-[11px] font-medium", "tense shift"));
      li.append(head, node("p", "text-sm leading-relaxed text-muted-foreground", p.text.length > 160 ? p.text.slice(0, 157) + "…" : p.text));
      return li;
    }));
  }
  run();
}

// ============================================================ 9 · Snowflake

for (const root of document.querySelectorAll("[data-novel-snowflake]")) {
  const steps = [...root.querySelectorAll("[data-nv-step]")];
  const pips = [...root.querySelectorAll("[data-nv-pip]")];
  const back = root.querySelector('[data-nv-go="-1"]'), next = root.querySelector('[data-nv-go="1"]');
  const { f } = persistFields(root, "snowflake", () => counts());
  let at = 0;
  const keys = steps.map((s) => s.querySelector("[data-nv-field]").dataset.nvField);
  function counts() {
    for (const k of keys) {
      const n = words(f[k].value);
      const wc = root.querySelector(`[data-nv-wc="${k}"]`);
      let note = `${n} word${n === 1 ? "" : "s"}`;
      if (k === "sentence" && n > 15) note += " · over 15";
      if (k === "paragraph" && f[k].value.trim()) {
        const sN = f[k].value.split(/(?<=[.!?])\s+/).filter((x) => /[A-Za-z]/.test(x)).length;
        note += ` · ${sN} sentence${sN === 1 ? "" : "s"} (5 suggested)`;
      }
      wc.textContent = note;
    }
    pips.forEach((p, i) => p.toggleAttribute("data-done", i !== at && f[keys[i]].value.trim().length > 0));
  }
  const go = (i) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => (s.hidden = k !== at));
    pips.forEach((p, k) => p.toggleAttribute("data-on", k === at));
    back.disabled = at === 0;
    next.disabled = at === steps.length - 1;
    counts();
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.querySelectorAll("[data-nv-goto]").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.nvGoto))));
  const titles = steps.map((s) => s.querySelector("h3").textContent);
  exporter(root, () => "snowflake", () => [
    "# Snowflake outline", "",
    ...keys.flatMap((k, i) => [`## ${titles[i]}`, "", f[k].value.trim() || "_(empty)_", ""]),
    "_After Randy Ingermanson's Snowflake Method (steps 1–5 of 10)._", "",
  ].join("\n"));
  go(0);
}

// ============================================================ 10 · Design brief

const BRIEF_EXAMPLE = {
  book: "Any survival story your class is reading",
  character: "The castaway",
  problem: "There is no reliable fresh water on the island; rain falls only in short storms.",
  constraints: "Only what washed ashore: a plastic sheet, rope, three bottles, a knife, palm leaves. One person, no power, must work at night.",
  ideas: "Sloped sheet funnelling into bottles\nHollow log cistern\nPalm-leaf gutters along the shelter roof\nSolar still from the sheet and a bottle",
  design: "A plastic sheet tied between four stakes, lower at one corner, draining through a funnel cut from a bottle into the other two bottles.",
  test: "Model at 1:10 scale: poured 1 L of water over it; 0.7 L collected. A leaf in the funnel blocked it, so we added a cloth filter.",
  reflect: "With water secured, the character can spend the second act on signalling for rescue. The story's tension would move from survival to being found.",
};

for (const root of document.querySelectorAll("[data-novel-brief]")) {
  const { f, save } = persistFields(root, "brief");
  const val = (k) => f[k].value.trim();
  root.querySelector('[data-nv-action="example"]').addEventListener("click", () => {
    for (const [k, v] of Object.entries(BRIEF_EXAMPLE)) if (f[k]) f[k].value = v;
    save();
  });
  root.querySelector('[data-nv-action="clear"]').addEventListener("click", () => {
    for (const n of Object.values(f)) n.value = "";
    save();
    f.book.focus();
  });
  // Print just this block: hide everything that isn't on its path from
  // <body>, restore after printing.
  root.querySelector('[data-nv-action="print"]').addEventListener("click", () => {
    const hidden = [];
    for (let n = root; n && n !== document.body; n = n.parentElement) {
      for (const sib of n.parentElement.children) {
        if (sib !== n && sib.style.display !== "none") { hidden.push([sib, sib.style.display]); sib.style.display = "none"; }
      }
    }
    const restore = () => { for (const [n, d] of hidden) n.style.display = d; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 1000);
  });
  const SECTIONS = [["problem", "1. The problem"], ["constraints", "2. Constraints from the story"], ["ideas", "3. Brainstorm"], ["design", "4. Chosen design"], ["test", "5. Test plan and results"], ["reflect", "6. Reflection"]];
  exporter(root, () => `design brief ${val("character") || "novel engineering"}`, () => [
    "# Novel Engineering design brief", "",
    `- **Book:** ${val("book") || "_(empty)_"}`, `- **Character:** ${val("character") || "_(empty)_"}`, "",
    ...SECTIONS.flatMap(([k, t]) => [`## ${t}`, "", k === "ideas" ? (val(k) ? val(k).split("\n").filter(Boolean).map((l) => `- ${l}`).join("\n") : "_(empty)_") : val(k) || "_(empty)_", ""]),
    "_Novel Engineering is a project of the Tufts University Center for Engineering Education and Outreach (novelengineering.org)._", "",
  ].join("\n"));
}
