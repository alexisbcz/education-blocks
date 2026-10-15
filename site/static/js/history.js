// History blocks: the timeline, lifespans, glossed source, the route of
// the Elements, the lineage graph, the chronology exercise and the
// numeral converter. Data comes from <template> children rendered in Go.

import { el, text } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const rows = (root, name) => [...root.querySelector(`template[data-${name}]`).content.children].map((d) => ({ ...d.dataset }));
const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

// Years are signed (−300 = 300 BCE) and there is no year 0, so BCE years
// shift by one onto the astronomical scale (1 BCE = 0) before placement.
const astro = (y) => (y < 0 ? y + 1 : y);
const yearText = (a) => (a <= 0 ? `${1 - a} BCE` : `${a}`);

// ============================================================ Timeline

const PRESETS = { all: [-1900, 2060], ancient: [-1900, 520], medieval: [450, 1560], early: [1480, 1830], modern: [1780, 2030] };

for (const root of document.querySelectorAll("[data-timeline]")) {
  const stage = root.querySelector("[data-stage]");
  const svg = root.querySelector("[data-svg]");
  const events = rows(root, "events").map((e, i) => ({ ...e, i, a: astro(Number(e.year)) }));
  const lanes = rows(root, "lanes");
  const laneY = Object.fromEntries(lanes.map((l, k) => [l.key, 40 + k * 56]));
  const laneColor = Object.fromEntries(lanes.map((l) => [l.key, l.color]));
  const order = [...events].sort((a, b) => a.a - b.a);
  const d = {
    year: root.querySelector("[data-d-year]"), lane: root.querySelector("[data-d-lane]"),
    title: root.querySelector("[data-d-title]"), note: root.querySelector("[data-d-note]"), link: root.querySelector("[data-d-link]"),
  };
  let view = PRESETS.all.slice();
  let selected = null;
  let anim = 0;

  const W = () => Math.max(320, svg.clientWidth);
  const L = 12, AXIS = 272;

  function draw() {
    const w = W();
    svg.setAttribute("viewBox", `0 0 ${w} 300`);
    svg.replaceChildren();
    const [a0, a1] = view;
    const x = (a) => L + ((a - a0) / (a1 - a0)) * (w - 2 * L);

    // Lanes.
    lanes.forEach((l) => {
      el("line", { x1: 0, x2: w, y1: laneY[l.key], y2: laneY[l.key], style: "stroke:currentColor;stroke-opacity:0.08" }, svg);
      text(svg, 8, laneY[l.key] - 16, l.name.toUpperCase(), { class: "fill-muted-foreground font-mono text-[9px] tracking-wider" });
    });

    // Axis: nice steps in historical years (no year 0).
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = steps.find((s) => (w / ((a1 - a0) / s)) >= 80) ?? 1000;
    el("line", { x1: 0, x2: w, y1: AXIS, y2: AXIS, style: "stroke:currentColor;stroke-opacity:0.3" }, svg);
    for (let k = Math.ceil((a0 - 1) / step); k * step <= a1 + step; k++) {
      if (k === 0) continue;
      const hist = k * step;
      const a = astro(hist);
      if (a < a0 || a > a1) continue;
      el("line", { x1: x(a), x2: x(a), y1: 14, y2: AXIS + 4, style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
      text(svg, x(a), AXIS + 16, hist < 0 ? `${-hist} BCE` : `${hist}`, { "text-anchor": "middle" });
    }
    if (a0 < 1 && a1 > 0) {
      el("line", { x1: x(0.5), x2: x(0.5), y1: 14, y2: AXIS, style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:2 3" }, svg);
      text(svg, x(0.5) + 4, AXIS - 6, "BCE | CE");
    }

    // Events: dots always, labels where there is room (greedy, per lane).
    // The lane captions occupy the left of the "above" row.
    const lastEnd = Object.fromEntries(lanes.map((l) => [l.key + ":a", 8 + l.name.length * 6.2 + 8]));
    for (const e of order) {
      const cx = x(e.a), cy = laneY[e.lane];
      if (cx < -20 || cx > w + 20) continue;
      const on = selected === e.i;
      const g = el("g", { "data-i": e.i, class: "cursor-pointer" }, svg);
      el("circle", { cx, cy, r: 11, style: "fill:transparent" }, g);
      if (on) el("circle", { cx, cy, r: 9, style: "fill:none;stroke:var(--brand);stroke-width:2" }, g);
      el("circle", { cx, cy, r: on ? 5.5 : 4.5, style: `fill:${laneColor[e.lane]};stroke:var(--code-bg);stroke-width:1.5` }, g);
      // Labels go where they fit, below the lane or else above it, never
      // over a neighbour (the selected event's label always shows).
      const width = e.title.length * 5.9 + 10;
      const lx = Math.max(2, Math.min(cx - 4, w - width));
      const cls = on ? "fill-foreground font-sans text-[11px] font-medium" : "fill-muted-foreground font-sans text-[11px]";
      const below = e.lane + ":b", above = e.lane + ":a";
      if (on || lx > (lastEnd[below] ?? -Infinity)) {
        text(g, lx, cy + 20, e.title, { class: cls });
        lastEnd[below] = Math.max(lastEnd[below] ?? -Infinity, lx + width);
      } else if (lx > (lastEnd[above] ?? -Infinity)) {
        text(g, lx, cy - 9, e.title, { class: cls });
        lastEnd[above] = lx + width;
      }
    }
  }

  function select(i, { reveal = false } = {}) {
    selected = i;
    const e = events[i];
    if (reveal && (e.a < view[0] || e.a > view[1])) {
      const span = view[1] - view[0];
      setView([e.a - span / 2, e.a + span / 2], false);
    }
    d.year.textContent = e.label;
    d.lane.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "size-2 rounded-full";
    dot.setAttribute("style", `background:${laneColor[e.lane]}`);
    d.lane.append(dot, lanes.find((l) => l.key === e.lane).name);
    d.title.textContent = e.title;
    d.note.textContent = e.note;
    d.link.hidden = !e.link;
    if (e.link) d.link.href = e.link;
    draw();
  }

  const clampView = ([a, b]) => {
    let span = Math.min(4200, Math.max(12, b - a));
    let mid = (a + b) / 2;
    mid = Math.min(2100 - span / 2, Math.max(-2100 + span / 2, mid));
    return [mid - span / 2, mid + span / 2];
  };
  function setView(to, animate = true) {
    cancelAnimationFrame(anim);
    to = clampView(to);
    if (!animate || reduced()) { view = to; return draw(); }
    const from = view.slice(), t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 320), s = EASE_OUT(t);
      view = [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s];
      draw();
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  const zoom = (f, at = 0.5) => {
    const span = view[1] - view[0], c = view[0] + span * at;
    setView([c - span * f * at, c + span * f * (1 - at)], false);
  };

  root.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => zoom(b.dataset.zoom === "in" ? 0.6 : 1 / 0.6)));
  root.addEventListener("seg-change", (e) => setView(PRESETS[e.detail.value]));

  // Pan by dragging; a press that barely moves is a click on an event.
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, view: view.slice(), moved: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    if (!drag.moved) return;
    const per = (drag.view[1] - drag.view[0]) / (W() - 2 * L);
    setView([drag.view[0] - dx * per, drag.view[1] - dx * per], false);
  });
  stage.addEventListener("pointerup", (e) => {
    const wasClick = drag && !drag.moved;
    drag = null;
    if (!wasClick) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-i]");
    if (hit) select(Number(hit.dataset.i));
  });
  // Ctrl/⌘ + wheel (and trackpad pinch) zooms around the pointer; plain
  // wheel keeps scrolling the page.
  stage.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoom(Math.exp(e.deltaY * 0.01), (e.clientX - r.left) / r.width);
  }, { passive: false });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const k = selected === null ? -1 : order.findIndex((o) => o.i === selected);
      const next = order[Math.max(0, Math.min(order.length - 1, k + (e.key === "ArrowRight" ? 1 : -1)))];
      select(next.i, { reveal: true });
    } else if (e.key === "+" || e.key === "=") zoom(0.6);
    else if (e.key === "-") zoom(1 / 0.6);
  });
  new ResizeObserver(draw).observe(svg);
  draw();
}

// ============================================================ Lifespans

for (const root of document.querySelectorAll("[data-lifespans]")) {
  const svg = root.querySelector("[data-svg]");
  const stage = root.querySelector("[data-stage]");
  const out = root.querySelector("[data-alive]");
  const yearOut = root.querySelector("[data-year]");
  const lives = rows(root, "lives").map((l) => ({ ...l, born: Number(l.born), died: Number(l.died) }));
  const Y0 = 1550, Y1 = 1880, L = 176, R = 744;
  const x = (y) => L + ((y - Y0) / (Y1 - Y0)) * (R - L);
  const colors = { math: "var(--vec-u)", physics: "var(--ion-k)" };
  let year = 1650;

  function draw() {
    svg.replaceChildren();
    for (let y = 1575; y <= 1875; y += 25) {
      el("line", { x1: x(y), x2: x(y), y1: 22, y2: 30 + lives.length * 22, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, x(y), 14, String(y), { "text-anchor": "middle" });
    }
    lives.forEach((l, k) => {
      const cy = 34 + k * 22;
      const alive = l.born <= year && year <= l.died;
      text(svg, L - 10, cy + 4, l.name, { "text-anchor": "end", class: alive ? "fill-foreground font-sans text-[11px]" : "fill-muted-foreground font-sans text-[11px]" });
      el("rect", { x: x(l.born), y: cy - 6, width: x(l.died) - x(l.born), height: 12, rx: 6,
        style: `fill:${colors[l.field]};fill-opacity:${alive ? 0.85 : 0.25}` }, svg);
    });
    el("line", { x1: x(year), x2: x(year), y1: 20, y2: 30 + lives.length * 22, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    yearOut.textContent = String(year);
    const alive = lives.filter((l) => l.born <= year && year <= l.died);
    out.textContent = alive.length
      ? alive.map((l) => `${l.name.split(" ").at(-1)} (${year - l.born})`).join(", ")
      : "Nobody on this chart.";
  }

  const toYear = (e) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * 760;
    return Math.round(Y0 + ((vx - L) / (R - L)) * (Y1 - Y0));
  };
  svg.addEventListener("pointermove", (e) => { year = Math.max(Y0, Math.min(Y1, toYear(e))); draw(); });
  stage.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    year = Math.max(Y0, Math.min(Y1, year + d * (e.shiftKey ? 10 : 1)));
    draw();
  });
  draw();
}

// ============================================================ Glossed source

for (const root of document.querySelectorAll("[data-source]")) {
  const passages = [...root.querySelectorAll("[data-passage]")];
  const glosses = rows(root, "glosses");
  const label = root.querySelector("[data-g-label]");
  const note = root.querySelector("[data-g-note]");
  const show = (i) => {
    passages.forEach((p, k) => (k === i ? (p.dataset.lit = "") : delete p.dataset.lit));
    label.textContent = glosses[i].label;
    note.textContent = glosses[i].note;
  };
  passages.forEach((p, i) => {
    p.addEventListener("pointerenter", () => show(i));
    p.addEventListener("focus", () => show(i));
  });
}

// ============================================================ Route of the Elements

for (const root of document.querySelectorAll("[data-route]")) {
  const svg = root.querySelector("[data-svg]");
  const places = rows(root, "places").map((p) => ({ ...p, lon: Number(p.lon), lat: Number(p.lat) }));
  const legs = rows(root, "legs");
  const date = root.querySelector("[data-r-date]"), body = root.querySelector("[data-r-text]"), count = root.querySelector("[data-r-count]");
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  // Equirectangular projection, with longitude scaled by cos(38°) so the
  // region keeps roughly its true proportions.
  const LON = [-12, 52], LAT = [27, 49], k = Math.cos((38 * Math.PI) / 180);
  const VW = 640, VH = 330, pad = 30, padL = 52;
  const sxRaw = (lon) => (lon - LON[0]) * k, syRaw = (lat) => LAT[1] - lat;
  const scale = Math.min((VW - padL - pad) / sxRaw(LON[1]), (VH - 2 * pad) / syRaw(LAT[0]));
  const P = (lon, lat) => [padL + sxRaw(lon) * scale, pad + syRaw(lat) * scale];
  const at = Object.fromEntries(places.map((p) => [p.key, P(p.lon, p.lat)]));
  let step = 0;

  function arc(a, b) {
    const [x1, y1] = a, [x2, y2] = b;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    return `M${x1} ${y1} Q${mx + (dy / len) * len * 0.18} ${my - (dx / len) * len * 0.18} ${x2} ${y2}`;
  }

  function draw() {
    svg.replaceChildren();
    for (let lon = -10; lon <= 50; lon += 10) {
      const [x] = P(lon, 0);
      el("line", { x1: x, x2: x, y1: pad - 10, y2: VH - pad + 6, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, x, VH - pad + 18, `${Math.abs(lon)}°${lon < 0 ? "W" : "E"}`, { "text-anchor": "middle" });
    }
    for (let lat = 30; lat <= 45; lat += 5) {
      const [, y] = P(0, lat);
      el("line", { x1: padL - 10, x2: VW - pad + 6, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
      text(svg, padL - 14, y + 3, `${lat}°N`, { "text-anchor": "end" });
    }
    const visited = new Set(legs.slice(0, step + 1).flatMap((l) => [l.from, l.to]).filter(Boolean));
    legs.slice(1, step + 1).forEach((l, i) => {
      const current = i + 1 === step;
      const path = el("path", { d: arc(at[l.from], at[l.to]), style: `fill:none;stroke:var(--brand);stroke-width:${current ? 2.25 : 1.5};stroke-opacity:${current ? 1 : 0.45};stroke-linecap:round` }, svg);
      if (current && !reduced()) {
        const len = path.getTotalLength();
        path.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: "0" }], { duration: 700, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      }
    });
    for (const p of places) {
      const [x, y] = at[p.key];
      const on = visited.has(p.key), here = legs[step].to === p.key;
      if (here) el("circle", { cx: x, cy: y, r: 10, style: "fill:var(--brand);fill-opacity:0.15" }, svg);
      el("circle", { cx: x, cy: y, r: on ? 5 : 4, style: on ? "fill:var(--brand);stroke:var(--code-bg);stroke-width:2" : "fill:var(--code-bg);stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5" }, svg);
      text(svg, x + 9, y - 7, p.name, { class: on ? "fill-foreground font-sans text-[12px] font-medium" : "fill-muted-foreground font-sans text-[12px]" });
    }
    const l = legs[step];
    date.textContent = l.date;
    body.textContent = l.text;
    count.textContent = `${step + 1} / ${legs.length}`;
    back.disabled = step === 0;
    next.disabled = step === legs.length - 1;
  }
  back.addEventListener("click", () => { step = Math.max(0, step - 1); draw(); });
  next.addEventListener("click", () => { step = Math.min(legs.length - 1, step + 1); draw(); });
  draw();
}

// ============================================================ Lineage

for (const root of document.querySelectorAll("[data-lineage]")) {
  const svg = root.querySelector("[data-svg]");
  const ideas = rows(root, "ideas").map((n) => ({ ...n, x: Number(n.x), y: Number(n.y), parents: n.parents ? n.parents.split(" ") : [] }));
  const by = Object.fromEntries(ideas.map((n) => [n.key, n]));
  const title = root.querySelector("[data-i-title]"), date = root.querySelector("[data-i-date]"), body = root.querySelector("[data-i-text]");
  const BW = 138, BH = 46;
  let selected = "gr";

  const ancestors = (key, acc = new Set()) => {
    for (const p of by[key].parents) if (!acc.has(p)) { acc.add(p); ancestors(p, acc); }
    return acc;
  };

  function draw() {
    svg.replaceChildren();
    const lit = ancestors(selected);
    lit.add(selected);
    for (const n of ideas) for (const p of n.parents) {
      const a = by[p], on = lit.has(n.key) && lit.has(p);
      const x1 = a.x + BW / 2, x2 = n.x - BW / 2, mx = (x1 + x2) / 2;
      el("path", { d: `M${x1} ${a.y} C${mx} ${a.y} ${mx} ${n.y} ${x2} ${n.y}`, style: `fill:none;stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 0.9 : 0.15};stroke-width:${on ? 1.75 : 1.25}` }, svg);
    }
    for (const n of ideas) {
      const on = lit.has(n.key), sel = n.key === selected;
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `${n.title}, ${n.date}`, "aria-pressed": String(sel), "data-key": n.key, class: "cursor-pointer outline-none [&:focus-visible_rect]:stroke-[var(--ring)]" }, svg);
      el("rect", { x: n.x - BW / 2, y: n.y - BH / 2, width: BW, height: BH, rx: 8,
        style: `fill:var(--background);stroke:${sel ? "var(--brand)" : on ? "color-mix(in oklab, var(--brand) 55%, transparent)" : "var(--border)"};stroke-width:${sel ? 2 : 1.25};opacity:${on ? 1 : 0.6}` }, g);
      text(g, n.x, n.y - 2, n.title, { "text-anchor": "middle", class: on ? "fill-foreground font-sans text-[11px] font-medium" : "fill-muted-foreground font-sans text-[11px]" });
      text(g, n.x, n.y + 13, n.date, { "text-anchor": "middle" });
    }
    const n = by[selected];
    title.textContent = n.title;
    date.textContent = n.date;
    body.textContent = n.text;
  }
  svg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-key]");
    if (g) { selected = g.dataset.key; draw(); svg.querySelector(`[data-key="${selected}"]`)?.focus(); }
  });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-key]");
    if (g && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      selected = g.dataset.key;
      draw();
      svg.querySelector(`[data-key="${selected}"]`)?.focus();
    }
  });
  draw();
}

// ============================================================ Chronology

for (const root of document.querySelectorAll("[data-chronology]")) {
  const list = root.querySelector("[data-list]");
  const feedback = root.querySelector("[data-feedback]");
  const hint = feedback.innerHTML;
  const items = () => [...list.querySelectorAll("[data-item]")];

  const renumber = () => items().forEach((li, i) => (li.querySelector("[data-pos]").textContent = i + 1));
  const clear = () => {
    for (const li of items()) { delete li.dataset.state; li.querySelector("[data-reveal]").hidden = true; }
    feedback.innerHTML = hint;
  };
  const move = (li, d) => {
    const sib = d < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!sib) return;
    d < 0 ? sib.before(li) : sib.after(li);
    clear();
    renumber();
    li.focus();
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-move]");
    if (b) move(b.closest("[data-item]"), Number(b.dataset.move));
  });
  list.addEventListener("keydown", (e) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const li = e.target.closest("[data-item]");
    if (!li) return;
    e.preventDefault();
    move(li, e.key === "ArrowUp" ? -1 : 1);
  });
  root.querySelector("[data-action=check]").addEventListener("click", () => {
    const cur = items();
    const sorted = [...cur].sort((a, b) => Number(a.dataset.year) - Number(b.dataset.year));
    let right = 0;
    cur.forEach((li, i) => {
      const ok = li === sorted[i];
      if (ok) right++;
      li.dataset.state = ok ? "right" : "wrong";
      li.querySelector("[data-reveal]").hidden = false;
    });
    feedback.textContent = right === cur.length ? "All five in order." : `${right} of ${cur.length} in the right place. The dates are shown; try again.`;
    feedback.className = `text-xs ${right === cur.length ? "text-add" : "text-muted-foreground"}`;
  });
  root.querySelector("[data-action=shuffle]").addEventListener("click", () => {
    const cur = items();
    let perm;
    do perm = [...cur].sort(() => Math.random() - 0.5);
    while (perm.every((li, i) => li === [...cur].sort((a, b) => a.dataset.year - b.dataset.year)[i]));
    list.append(...perm);
    clear();
    renumber();
  });
  renumber();
}

// ============================================================ Number systems

function roman(n) {
  const t = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
function digits(n, base) {
  const d = [];
  do { d.unshift(n % base); n = Math.floor(n / base); } while (n > 0);
  return d;
}

// One cuneiform unit wedge (a vertical stroke with a triangular head).
function unitWedge(g, x, y) {
  el("path", { d: `M${x - 3.5} ${y} L${x + 3.5} ${y} L${x} ${y + 5} Z M${x} ${y + 4} L${x} ${y + 15}`, style: "fill:currentColor;stroke:currentColor;stroke-width:1.4;stroke-linejoin:round" }, g);
}
// One "ten" (Winkelhaken): a corner wedge shaped like <.
function tenWedge(g, x, y) {
  el("path", { d: `M${x} ${y} L${x + 11} ${y - 7} L${x + 7} ${y} L${x + 11} ${y + 7} Z`, style: "fill:currentColor;stroke:currentColor;stroke-width:1;stroke-linejoin:round" }, g);
}

function drawBabylonian(svg, n) {
  svg.replaceChildren();
  const ds = digits(n, 60);
  let x = 6;
  const groups = [];
  for (const d of ds) {
    const g = el("g", {}, svg);
    const tens = Math.floor(d / 10), units = d % 10;
    // Tens stack two to a row, units three to a row, as scribes wrote them.
    for (let t = 0; t < tens; t++) tenWedge(g, x + (t % 2) * 11, 14 + Math.floor(t / 2) * 16);
    const gx = x + (tens ? 26 : 0);
    for (let u = 0; u < units; u++) unitWedge(g, gx + (u % 3) * 9, 10 + Math.floor(u / 3) * 18);
    const w = (tens ? 26 : 0) + (units ? Math.min(3, units) * 9 : 0);
    if (d === 0) el("rect", { x, y: 8, width: 18, height: 40, rx: 3, style: "fill:none;stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, g);
    groups.push([x, Math.max(w, d === 0 ? 18 : 0)]);
    x += Math.max(w, d === 0 ? 18 : 0) + 18;
  }
  svg.setAttribute("viewBox", `0 0 ${Math.max(60, x)} 70`);
  return ds;
}

function drawMaya(svg, n) {
  svg.replaceChildren();
  const ds = digits(n, 20);
  const H = 34;
  ds.forEach((d, i) => {
    const y0 = 6 + i * H;
    if (d === 0) {
      // The shell glyph for zero, schematic.
      el("ellipse", { cx: 40, cy: y0 + 14, rx: 16, ry: 8, style: "fill:none;stroke:currentColor;stroke-width:1.5" }, svg);
      el("path", { d: `M28 ${y0 + 14} Q40 ${y0 + 8} 52 ${y0 + 14} M30 ${y0 + 17} Q40 ${y0 + 12} 50 ${y0 + 17}`, style: "fill:none;stroke:currentColor;stroke-width:1" }, svg);
      return;
    }
    const bars = Math.floor(d / 5), dots = d % 5;
    for (let b = 0; b < bars; b++) el("rect", { x: 16, y: y0 + 26 - b * 7 - 4, width: 48, height: 4.5, rx: 2, style: "fill:currentColor" }, svg);
    const top = y0 + 26 - bars * 7 - 3;
    for (let k = 0; k < dots; k++) el("circle", { cx: 40 + (k - (dots - 1) / 2) * 10, cy: top - 1, r: 3.2, style: "fill:currentColor" }, svg);
  });
  // Separators between places.
  for (let i = 1; i < ds.length; i++) el("line", { x1: 8, x2: 72, y1: 6 + i * H - 2, y2: 6 + i * H - 2, style: "stroke:currentColor;stroke-opacity:0.15;stroke-dasharray:2 3" }, svg);
  svg.setAttribute("viewBox", `0 0 80 ${ds.length * H + 8}`);
  return ds;
}

for (const root of document.querySelectorAll("[data-numerals]")) {
  const input = root.querySelector("[data-input]");
  const error = root.querySelector("[data-error]");
  const sys = Object.fromEntries([...root.querySelectorAll("[data-sys]")].map((n) => [n.dataset.sys, n]));
  const ex = Object.fromEntries([...root.querySelectorAll("[data-explain]")].map((n) => [n.dataset.explain, n]));

  function render() {
    const n = Number(input.value.trim());
    const ok = Number.isInteger(n) && n >= 1 && n <= 3999;
    input.setAttribute("aria-invalid", String(!ok));
    error.textContent = ok ? "" : "Enter a whole number from 1 to 3999.";
    if (!ok) return;
    sys.arabic.firstElementChild.textContent = String(n);
    const dec = digits(n, 10);
    ex.arabic.textContent = dec.map((d, i) => `${d}×${10 ** (dec.length - 1 - i)}`).join(" + ");
    sys.roman.firstElementChild.textContent = roman(n);
    ex.roman.textContent = "M 1000 · D 500 · C 100 · L 50 · X 10 · V 5 · I 1; a smaller symbol before a larger one subtracts.";
    const b = drawBabylonian(sys.babylonian.firstElementChild, n);
    ex.babylonian.textContent = `${b.map((d, i) => `${d}×${60 ** (b.length - 1 - i)}`).join(" + ")}. No zero sign until a late placeholder: an empty place was just a gap.`;
    const m = drawMaya(sys.maya.firstElementChild, n);
    ex.maya.textContent = `Read top to bottom: ${m.map((d, i) => `${d}×${20 ** (m.length - 1 - i)}`).join(" + ")}. Dots are 1, bars 5, the shell 0. (The calendar's Long Count used 18×20 in its third place.)`;
  }
  input.addEventListener("input", render);
  root.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.set; render(); }));
  render();
}
