// Geology blocks: the seismograph figure, the ICS time scale, radiometric
// dating, epicentre triangulation, magnitude and energy, plate boundaries,
// the rock cycle, a stratigraphy puzzle and the Mohs scratch test.

import "../anatomy/seismograph.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Ages: Ma below 1 Ga, Ga above, ka below 1 Ma.
const age = (ma) => (ma >= 1000 ? `${+(ma / 1000).toFixed(3)} Ga` : ma >= 1 ? `${+ma.toFixed(3)} Ma` : ma > 0 ? `${Math.round(ma * 1000)} ka` : "today");

// ============================================================ Time scale

const RANGES = { earth: [4567, 0], phanerozoic: [538.8, 0], cenozoic: [66, 0] };

for (const root of document.querySelectorAll("[data-timescale]")) {
  const units = JSON.parse(root.dataset.units);
  const events = JSON.parse(root.dataset.events);
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let range = RANGES.earth, picked = null;

  function draw() {
    svg.replaceChildren();
    const [old, young] = range;
    const L = 16, W = 868;
    const sx = (ma) => L + ((old - ma) / (old - young)) * W;
    const rows = [[0, 18, 30], [1, 52, 30], [2, 86, 30]];
    for (const [rank, y, hgt] of rows) {
      for (const u of units.filter((u) => u.rank === rank && u.end < old && u.start > young)) {
        const x0 = sx(Math.min(u.start, old)), x1 = sx(Math.max(u.end, young));
        const g = el("g", { tabindex: 0, role: "button", "aria-label": u.name, class: "cursor-pointer outline-none", "data-unit": u.name }, svg);
        el("rect", { x: x0, y, width: Math.max(0.5, x1 - x0), height: hgt, style: `fill:${u.color};stroke:var(--background);stroke-width:1` }, g);
        if (picked === u.name) el("rect", { x: x0 + 1, y: y + 1, width: Math.max(0.5, x1 - x0 - 2), height: hgt - 2, style: "fill:none;stroke:var(--foreground);stroke-width:2" }, g);
        const label = x1 - x0 > u.name.length * 6.2 + 8 ? u.name : x1 - x0 > 18 ? u.name.slice(0, 2) : "";
        if (label) text(g, (x0 + x1) / 2, y + hgt / 2 + 3.5, label, { "text-anchor": "middle", class: "pointer-events-none font-sans text-[11px]", style: "fill:#111" });
        g.addEventListener("click", () => pick(u));
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(u); } });
      }
    }
    // Event lane: ticks for events, triangles for mass extinctions.
    const ey = 132;
    el("line", { x1: L, x2: L + W, y1: ey, y2: ey, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (const e of events.filter((e) => e.age <= old && e.age >= young)) {
      const x = sx(e.age);
      const g = el("g", {}, svg);
      el("title", {}, g).textContent = `${e.label} · ${age(e.age)}`;
      if (e.mass) el("path", { d: `M${x} ${ey - 2} l-5 -9 h10 z`, style: "fill:var(--brand)" }, g);
      else el("circle", { cx: x, cy: ey - 5, r: 3, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.25" }, g);
    }
    // Age axis.
    const step = old > 1000 ? 500 : old > 100 ? 50 : 10;
    for (let a = Math.floor(old / step) * step; a >= young; a -= step) {
      const x = sx(a);
      el("line", { x1: x, x2: x, y1: ey + 4, y2: ey + 10, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
      text(svg, x, ey + 24, String(a), { "text-anchor": "middle" });
    }
    text(svg, L + W, ey + 40, "Ma ago", { "text-anchor": "end" });
  }

  function pick(u) {
    picked = u.name;
    o.name.textContent = u.name;
    o.dates.textContent = `${age(u.start)} – ${age(u.end)} · lasted ${age(u.start - u.end).replace("today", "—")}`;
    o.about.textContent = u.about;
    const inside = events.filter((e) => e.age <= u.start && e.age >= u.end);
    o.events.replaceChildren(...(inside.length ? inside : [{ label: "No marked events in this unit.", age: null }]).map((e) => {
      const li = document.createElement("li");
      li.className = "flex items-baseline gap-2";
      li.innerHTML = e.age === null ? "" : `<span class="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">${age(e.age)}</span>`;
      const s = document.createElement("span");
      s.textContent = e.label;
      if (e.mass) s.className = "text-brand";
      li.append(s);
      return li;
    }));
    draw();
  }

  root.addEventListener("seg-change", (e) => { range = RANGES[e.detail.value]; draw(); });
  draw();
  pick(units.find((u) => u.name === "Cretaceous"));
}

// ============================================================ Radiometric dating

// Half-lives in years. K-40 decays to Ar-40 in only ≈ 10.48 % of decays
// (the rest give Ca-40), so the K–Ar age scales D/P by that branching.
const SYSTEMS = {
  c14: { half: 5730, mode: "fraction", note: "Radiocarbon measures the ¹⁴C left, not a daughter: ¹⁴N is everywhere. Beyond ≈ 50,000 years too little remains to measure; real ages are calibrated against tree rings and other records." },
  k40: { half: 1.248e9, mode: "ratio", branch: 0.1048, note: "Only ≈ 10.5 % of ⁴⁰K decays produce ⁴⁰Ar (the rest give ⁴⁰Ca); the age accounts for it. Argon escapes from melted rock, so the clock starts when lava cools." },
  u235: { half: 7.04e8, mode: "ratio", note: "Usually measured in zircon, together with ²³⁸U: two clocks in one crystal check each other." },
  u238: { half: 4.468e9, mode: "ratio", note: "The workhorse for the oldest rocks: the Jack Hills zircons and meteorites that date Earth to ≈ 4.57 Ga." },
  rb87: { half: 4.96e10, mode: "ratio", note: "So slow that even the age of the Earth is less than a tenth of a half-life: good for very old rocks only." },
};
const years = (y) => (y >= 1e9 ? `${num(y / 1e9, 2)} Ga` : y >= 1e6 ? `${num(y / 1e6, 1)} Ma` : y >= 1e4 ? `${num(y / 1e3, 1)} ka` : `${Math.round(y).toLocaleString("en")} y`);

for (const root of document.querySelectorAll("[data-dating]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let sys = SYSTEMS.c14;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    sys = SYSTEMS[e.detail.value];
    root.querySelectorAll("[data-mode]").forEach((m) => (m.hidden = m.dataset.mode !== sys.mode));
    draw();
  });

  function draw() {
    const lam = Math.LN2 / sys.half;
    let t, left;
    if (sys.mode === "fraction") {
      left = Math.max(1e-6, s.fraction.get() / 100);
      t = -Math.log(left) / lam;
    } else {
      const r = s.ratio.get() / (sys.branch ?? 1);
      t = Math.log(1 + r) / lam;
      left = 1 / (1 + r);
    }
    const n = t / sys.half;
    svg.replaceChildren();
    const span = Math.max(4, Math.ceil(n + 1));
    const f = frame(svg, { box: [44, 14, 500, 260], x: [0, span], y: [0, 1], xticks: Array.from({ length: span + 1 }, (_, i) => i), yticks: [0, 0.25, 0.5, 0.75, 1], xlabel: "time (half-lives)", ylabel: "fraction", yfmt: (v) => `${v * 100}%` });
    const pts = Array.from({ length: 201 }, (_, i) => (i / 200) * span);
    polyline(svg, pts.map((x) => [f.sx(x), f.sy(2 ** -x)]), "stroke:var(--brand);stroke-width:2");
    polyline(svg, pts.map((x) => [f.sx(x), f.sy(1 - 2 ** -x)]), "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:6 4");
    const x = Math.min(n, span);
    el("line", { x1: f.sx(x), x2: f.sx(x), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.4;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(x), cy: f.sy(left), r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
    text(svg, f.sx(x) + 6, f.T + 10, years(t), { class: "fill-foreground font-mono text-[10px]" });
    o.half.textContent = years(sys.half);
    o.age.textContent = years(t);
    o.n.textContent = num(n, 2);
    o.left.textContent = `${num(left * 100, 1)}%`;
    const warn = sys.mode === "fraction" && t > 50000 ? " This sample is past the method's range." : "";
    o.note.textContent = sys.note + warn;
    o.age.className = warn ? "tabular-nums text-del" : "tabular-nums";
  }
  draw();
}

// ============================================================ Triangulation

const VP = 6, VS = 3.5; // km/s
for (const root of document.querySelectorAll("[data-triangulate]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const KM = 400 / 400; // viewBox units per km: the map square is 400 km
  const OX = 40, OY = 0;
  const STATIONS = [["A", 70, 300], ["B", 330, 340], ["C", 250, 60]];
  let epi = [190, 200], show = { circles: true, hide: false };
  const clip = el("clipPath", { id: "tri-map" }, el("defs", {}, svg));
  el("rect", { x: OX, y: OY, width: 400, height: 400, rx: 6 }, clip);
  const scene = el("g", { "clip-path": "url(#tri-map)" }, svg);
  // The epicentre handle: a focusable target, dragged in map km.
  const hd = el("circle", { r: 12, tabindex: 0, role: "slider", "aria-label": "Epicentre: drag, or use the arrow keys", class: "cursor-grab outline-none", style: "fill:transparent" }, svg);
  const ring = el("circle", { r: 6, class: "pointer-events-none", style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
  const toMap = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.max(0, Math.min(400, p.x - OX)), Math.max(0, Math.min(400, p.y - OY))];
  };
  hd.addEventListener("pointerdown", (e) => { hd.setPointerCapture(e.pointerId); epi = toMap(e); draw(); });
  hd.addEventListener("pointermove", (e) => { if (hd.hasPointerCapture(e.pointerId)) { epi = toMap(e); draw(); } });
  hd.addEventListener("focus", () => (ring.style.strokeWidth = "3.5"));
  hd.addEventListener("blur", () => (ring.style.strokeWidth = "2"));
  hd.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (!d) return;
    e.preventDefault();
    epi = [Math.max(0, Math.min(400, epi[0] + d[0])), Math.max(0, Math.min(400, epi[1] + d[1]))];
    draw();
  });
  onToggle(root, (k, on) => { show[k] = on; draw(); });

  function draw() {
    scene.replaceChildren();
    el("rect", { x: OX, y: OY, width: 400, height: 400, rx: 6, style: "fill:color-mix(in oklab, var(--ion-cl) 6%, var(--code-bg));stroke:currentColor;stroke-opacity:0.2" }, scene);
    for (let k = 100; k < 400; k += 100) {
      el("line", { x1: OX + k, x2: OX + k, y1: OY, y2: OY + 400, style: "stroke:currentColor;stroke-opacity:0.06" }, scene);
      el("line", { x1: OX, x2: OX + 400, y1: OY + k, y2: OY + k, style: "stroke:currentColor;stroke-opacity:0.06" }, scene);
    }
    // Scale bar: 100 km.
    el("path", { d: `M${OX + 290} ${OY + 386} h100 m-100 -4 v8 m100 -8 v8`, style: "stroke:currentColor;stroke-opacity:0.5;fill:none" }, scene);
    text(scene, OX + 340, OY + 378, "100 km", { "text-anchor": "middle" });
    for (const [name, x, y] of STATIONS) {
      const d = Math.hypot(epi[0] - x, epi[1] - y); // km
      const sp = d / VS - d / VP;
      o[`sp-${name}`].textContent = `${num(sp, 1)} s`;
      o[`d-${name}`].textContent = `${Math.round(d)} km`;
      if (show.circles) el("circle", { cx: OX + x, cy: OY + y, r: d * KM, style: "fill:var(--vec-u);fill-opacity:0.04;stroke:var(--vec-u);stroke-opacity:0.7;stroke-width:1.25" }, scene);
      el("path", { d: `M${OX + x} ${OY + y - 8} l7 12 h-14 z`, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, scene);
      text(scene, OX + x + 10, OY + y + 4, name, { class: "fill-foreground font-mono text-[11px] font-medium" });
    }
    if (!show.hide) {
      el("path", { d: `M${OX + epi[0] - 7} ${OY + epi[1]} h14 M${OX + epi[0]} ${OY + epi[1] - 7} v14`, style: "stroke:var(--brand);stroke-width:2" }, scene);
    }
    for (const c of [hd, ring]) { c.setAttribute("cx", OX + epi[0]); c.setAttribute("cy", OY + epi[1]); }
    ring.style.opacity = show.hide ? "0" : "1";
  }
  draw();
}

// ============================================================ Magnitude and energy

const sci = (v) => {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  const sup = String(e).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]);
  return `${num(m, 2)} × 10${sup}`;
};
for (const root of document.querySelectorAll("[data-magnitude]")) {
  const refs = JSON.parse(root.dataset.refs);
  const bars = root.querySelector("[data-bars]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const E = (mw) => 10 ** (1.5 * mw + 4.8);
  const lo = Math.log10(E(2)), hi = Math.log10(E(9.6));
  const width = (mw) => `${(100 * (Math.log10(E(mw)) - lo)) / (hi - lo)}%`;

  function row(label, mw, current) {
    const li = document.createElement("li");
    li.className = "grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3rem] items-center gap-3 text-xs";
    const name = document.createElement("span");
    name.className = current ? "truncate font-medium text-brand" : "truncate text-muted-foreground";
    name.textContent = label;
    const track = document.createElement("div");
    track.className = "h-2 rounded-full bg-foreground/5";
    const fill = document.createElement("div");
    fill.className = current ? "h-full rounded-full bg-brand transition-[width] duration-200 ease-[var(--ease-out)]" : "h-full rounded-full bg-foreground/35";
    fill.style.width = width(mw);
    track.append(fill);
    const v = document.createElement("span");
    v.className = "text-right font-mono tabular-nums";
    v.textContent = `${num(mw, 1)}`;
    li.append(name, track, v);
    return li;
  }

  function draw() {
    const mw = s.mw.get();
    const m0 = 10 ** (1.5 * mw + 9.1);
    const e = E(mw);
    o.m0.textContent = `${sci(m0)} N·m`;
    o.e.textContent = `${sci(e)} J`;
    const t = e / 4.184e9;
    o.tnt.textContent = t >= 1e6 ? `${num(t / 1e6, 2)} Mt` : t >= 1e3 ? `${num(t / 1e3, 1)} kt` : `${num(t, 1)} t`;
    const all = [...refs.map((r) => ({ ...r, current: false })), { name: "Your earthquake", mw, current: true }].sort((a, b) => b.mw - a.mw);
    bars.replaceChildren(...all.map((r) => row(r.name, r.mw, r.current)));
  }
  draw();
}

// ============================================================ Pickers (plates, rock cycle)

for (const root of document.querySelectorAll("[data-plates]")) {
  const name = root.querySelector("[data-info-name]");
  const about = root.querySelector("[data-info-about]");
  const show = (view, key) => {
    const b = view.closest("[data-plates]").querySelector(`[data-view="${view.dataset.view}"] [data-pick="${key}"]`);
    if (!b) return;
    root.querySelectorAll("[data-pick]").forEach((x) => (x === b ? (x.dataset.on = "") : delete x.dataset.on));
    root.querySelectorAll("[data-feature]").forEach((g) => (g.dataset.feature === key && g.closest("[data-view]") === view ? (g.dataset.on = "") : delete g.dataset.on));
    name.textContent = b.dataset.name;
    about.textContent = b.dataset.about;
  };
  root.querySelectorAll("[data-feature]").forEach((g) => {
    const view = g.closest("[data-view]");
    g.addEventListener("pointerenter", () => show(view, g.dataset.feature));
    g.addEventListener("focus", () => show(view, g.dataset.feature));
  });
  root.querySelectorAll("[data-pick]").forEach((b) => {
    b.addEventListener("click", () => {
      const view = [...root.querySelectorAll(`[data-view="${b.closest("[data-view]").dataset.view}"]`)].find((v) => v.querySelector("svg"));
      show(view, b.dataset.pick);
    });
  });
  root.addEventListener("seg-change", () => {
    name.textContent = "Point at a feature";
    about.textContent = "Hover the drawing, or press Tab to step through its parts.";
  });
}

for (const root of document.querySelectorAll("[data-rockcycle]")) {
  const name = root.querySelector("[data-info-name]");
  const about = root.querySelector("[data-info-about]");
  const arrows = [...root.querySelectorAll("[data-arrow]")];
  const buttons = [...root.querySelectorAll("[data-process]")];
  const rocks = [...root.querySelectorAll("[data-rock]")];
  const clear = () => [...arrows, ...buttons, ...rocks].forEach((x) => delete x.dataset.on);
  for (const b of buttons) {
    b.addEventListener("click", () => {
      clear();
      b.dataset.on = "";
      arrows.find((a) => a.dataset.arrow === b.dataset.process).dataset.on = "";
      name.textContent = b.dataset.name;
      about.textContent = b.dataset.about;
    });
  }
  const NODES = {
    magma: ["Magma", "Molten rock below the surface; lava when it erupts. Leads to: cooling and crystallisation."],
    igneous: ["Igneous rock", "Granite (cooled slowly, coarse crystals) and basalt (cooled fast, fine-grained)."],
    sediment: ["Sediment", "Sand, mud, gravel and shells, carried by water, wind and ice."],
    sedimentary: ["Sedimentary rock", "Sandstone, shale, limestone; often holds fossils."],
    metamorphic: ["Metamorphic rock", "Slate (from shale), marble (from limestone), quartzite (from sandstone), gneiss."],
  };
  for (const r of rocks) {
    const pickRock = () => {
      clear();
      r.dataset.on = "";
      const [n, a] = NODES[r.dataset.rock];
      name.textContent = n;
      about.textContent = a;
    };
    r.addEventListener("click", pickRock);
    r.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickRock(); } });
  }
}

// ============================================================ Stratigraphy

const ANSWER = ["A", "B", "C", "F", "D", "E"];
for (const root of document.querySelectorAll("[data-strat]")) {
  const list = root.querySelector("[data-list]");
  const feedback = root.querySelector("[data-feedback]");
  const score = root.querySelector("[data-out=score]");
  const clearMarks = () => {
    list.querySelectorAll("[data-item]").forEach((li) => { delete li.dataset.state; li.querySelector("[data-mark]").textContent = ""; });
    feedback.replaceChildren();
    score.textContent = "";
  };
  const move = (li, by) => {
    const items = [...list.children];
    const i = items.indexOf(li), j = i + by;
    if (j < 0 || j >= items.length) return;
    by < 0 ? list.insertBefore(li, items[j]) : list.insertBefore(li, items[j].nextSibling);
    clearMarks();
    if (!reduced()) li.animate([{ transform: `translateY(${by * -100}%)` }, { transform: "none" }], { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-move]");
    if (!b) return;
    const li = b.closest("[data-item]");
    move(li, Number(b.dataset.move));
    b.focus();
  });
  list.addEventListener("keydown", (e) => {
    const li = e.target.closest("[data-item]");
    if (!li || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    move(li, e.key === "ArrowUp" ? -1 : 1);
    li.focus();
  });
  root.querySelector("[data-action=check]").addEventListener("click", () => {
    const items = [...list.children];
    let right = 0;
    feedback.replaceChildren();
    items.forEach((li, i) => {
      const ok = li.dataset.item === ANSWER[i];
      if (ok) right++;
      li.dataset.state = ok ? "right" : "wrong";
      li.querySelector("[data-mark]").textContent = ok ? "✓" : "✗";
      li.querySelector("[data-mark]").className = ok ? "font-mono text-xs text-add" : "font-mono text-xs text-del";
    });
    score.textContent = `${right} / ${items.length}`;
    const lines = right === items.length ? items.map((li) => `${li.dataset.item}: ${li.dataset.why}`) : items.filter((li) => li.dataset.state === "wrong").map((li) => `${li.dataset.item}: ${li.dataset.why}`);
    for (const l of lines) {
      const p = document.createElement("p");
      p.className = "enter";
      p.textContent = l;
      feedback.append(p);
    }
  });
}

// ============================================================ Mohs

for (const root of document.querySelectorAll("[data-mohs]")) {
  const minerals = JSON.parse(root.dataset.minerals);
  const o = outs(root);
  const levels = [...root.querySelectorAll("[data-level]")];
  const answers = {};
  root.querySelectorAll("[data-tool]").forEach((row) => {
    row.querySelectorAll("[data-answer]").forEach((b) =>
      b.addEventListener("click", () => {
        row.querySelectorAll("[data-answer]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        answers[row.dataset.tool] = { h: Number(row.dataset.h), a: b.dataset.answer };
        draw();
      }));
  });

  function draw() {
    // A tool that scratches the sample is harder than it: hardness < h.
    // One that does not is softer or equal: hardness ≥ h.
    let lo = 1, hi = 10;
    for (const { h, a } of Object.values(answers)) {
      if (a === "yes") hi = Math.min(hi, h - 0.01);
      if (a === "no") lo = Math.max(lo, h);
    }
    const ok = lo <= hi;
    // "≥ lo" from tools that fail to scratch, "< h" from tools that do.
    const top = Math.min(10, hi + 0.01);
    o.range.textContent = !ok ? "contradictory answers" : `${+lo.toFixed(2)} ≤ H ${top < 10 ? "< " + +top.toFixed(2) : "≤ 10"}`;
    const tested = Object.values(answers).some((x) => x.a);
    levels.forEach((l) => {
      const v = Number(l.dataset.level);
      const inside = ok && v >= lo - 1e-9 && v <= hi + 1e-9;
      tested && inside ? (l.dataset.in = "") : delete l.dataset.in;
      tested && !inside ? (l.dataset.out = "") : delete l.dataset.out;
    });
    const cand = ok ? minerals.filter((m) => m.range[1] >= lo && m.range[0] <= hi) : [];
    o.count.textContent = `${cand.length} candidate${cand.length === 1 ? "" : "s"}`;
    o.candidates.replaceChildren(...cand.map((m) => {
      const s = document.createElement("span");
      s.className = "enter rounded-full border bg-background px-2 py-0.5 text-xs";
      s.textContent = `${m.name} ${m.range[0] === m.range[1] ? m.range[0] : m.range.join("–")}`;
      return s;
    }));
  }
  draw();
}
