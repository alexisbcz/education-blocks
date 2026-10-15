// Philosophy blocks: argument map, thought-experiment votes, the lineage
// graph, the fallacy quiz, Zeno's series and the glossed Meditation.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

// ============================================================ Argument map

for (const root of document.querySelectorAll("[data-philo-arg]")) {
  const update = (view) => {
    const valid = view.dataset.valid === "true";
    const beliefs = [...view.querySelectorAll("[data-premise]")].map((p) => p.dataset.belief ?? "unsure");
    const out = view.querySelector("[data-verdict]");
    const allTrue = beliefs.every((b) => b === "true");
    const anyFalse = beliefs.includes("false");
    out.textContent = !valid
      ? allTrue
        ? "Invalid: even with every premise true, the conclusion doesn't follow. True premises and a false conclusion are possible here."
        : "Invalid: whatever you think of the premises, they don't support the conclusion."
      : allTrue
        ? "Valid, and you accept every premise: by your lights the argument is sound, so you must accept the conclusion."
        : anyFalse
          ? "Valid but, by your lights, unsound: a false premise means the conclusion may still be false."
          : "Valid. Whether it is sound depends on the premises you're unsure about.";
  };
  root.querySelectorAll("[data-view]").forEach((view) => {
    view.addEventListener("click", (e) => {
      const b = e.target.closest("[data-belief]");
      if (!b) return;
      const premise = b.closest("[data-premise]");
      premise.dataset.belief = b.dataset.belief;
      for (const x of premise.querySelectorAll("[data-belief]")) x.setAttribute("aria-pressed", String(x === b));
      update(view);
    });
    update(view);
  });
}

// ============================================================ Thought experiments

for (const root of document.querySelectorAll("[data-philo-te]")) {
  const tally = root.querySelector("[data-tally]");
  const total = root.querySelectorAll("article[data-view]").length;
  const answered = new Map();
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vote]");
    if (!b) return;
    const card = b.closest("article");
    for (const x of card.querySelectorAll("[data-vote]")) x === b ? (x.dataset.on = "") : delete x.dataset.on;
    card.querySelector("[data-positions]").hidden = false;
    answered.set(card.dataset.view, b.dataset.vote);
    tally.textContent = `${answered.size} of ${total} answered · ` + [...answered].map(([k, v]) => `${k}: ${v}`).join(" · ");
  });
}

// ============================================================ Lineage graph

// Year → x: compress antiquity and the middle ages, stretch the modern era.
const yearX = (y, W) => {
  const stops = [[-500, 0], [500, 0.16], [1500, 0.3], [2000, 1]];
  for (let i = 1; i < stops.length; i++) {
    const [y0, x0] = stops[i - 1], [y1, x1] = stops[i];
    if (y <= y1) return (x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) * W;
  }
  return W;
};

for (const root of document.querySelectorAll("[data-philo-lineage]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const { people, edges, lanes } = JSON.parse(root.querySelector("template[data-graph]").dataset.graph);
  const L = 92, W = 820, T = 24, LH = 40, GAP = 50;
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  // Keep people in the same lane at least GAP apart (pushing right), and
  // alternate their labels above and below the dot.
  const pos = {};
  const lastInLane = {};
  for (const p of [...people].sort((a, b) => a.born - b.born)) {
    let x = L + yearX(p.born, W);
    const prev = lastInLane[p.lane];
    if (prev && x - prev.x < GAP) x = prev.x + GAP;
    const up = prev ? !prev.up : false;
    pos[p.id] = { x, y: T + p.lane * LH + LH / 2, up };
    lastInLane[p.lane] = pos[p.id];
  }
  const parents = (id) => edges.filter(([, b]) => b === id).map(([a]) => a);
  const children = (id) => edges.filter(([a]) => a === id).map(([, b]) => b);
  const closure = (id, step) => { const seen = new Set(); const go = (x) => step(x).forEach((y) => { if (!seen.has(y)) { seen.add(y); go(y); } }); go(id); return seen; };
  const order = [...people].sort((a, b) => a.born - b.born || a.lane - b.lane).map((p) => p.id);
  let sel = null;

  function draw() {
    svg.replaceChildren();
    lanes.forEach((name, i) => {
      el("line", { x1: L - 4, x2: L + W, y1: T + (i + 1) * LH, y2: T + (i + 1) * LH, style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
      text(svg, 4, T + i * LH + LH / 2 + 3, name);
    });
    for (const [y, label] of [[-400, "400 BCE"], [0, "1"], [500, "500"], [1000, "1000"], [1500, "1500"], [1700, "1700"], [1900, "1900"]]) {
      const x = L + yearX(y, W);
      el("line", { x1: x, x2: x, y1: T, y2: T + lanes.length * LH, style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
      text(svg, x, T - 8, label, { "text-anchor": "middle" });
    }
    const up = sel ? closure(sel, parents) : new Set(), down = sel ? closure(sel, children) : new Set();
    const lit = (id) => !sel || id === sel || up.has(id) || down.has(id);
    for (const [a, b] of edges) {
      const p = pos[a], q = pos[b];
      const on = sel && ((up.has(a) || a === sel) && (up.has(b) || b === sel) || (down.has(a) || a === sel) && (down.has(b) || b === sel));
      const mx = (p.x + q.x) / 2;
      el("path", { d: `M${p.x} ${p.y} C${mx} ${p.y} ${mx} ${q.y} ${q.x} ${q.y}`, style: `fill:none;stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 0.9 : sel ? 0.07 : 0.22};stroke-width:${on ? 1.75 : 1}` }, svg);
    }
    for (const p of people) {
      const { x, y } = pos[p.id];
      const g = el("g", { "data-id": p.id, tabindex: -1, class: "cursor-pointer outline-none", style: `opacity:${lit(p.id) ? 1 : 0.3}` }, svg);
      el("circle", { cx: x, cy: y, r: p.id === sel ? 6.5 : 4.5, style: `fill:${p.id === sel ? "var(--brand)" : up.has(p.id) || down.has(p.id) ? "var(--brand)" : "var(--foreground)"};stroke:var(--background);stroke-width:2` }, g);
      text(g, x, pos[p.id].up ? y - 9 : y + 15, p.name.replace(/ \(.*\)/, "").split(" ").at(-1), { "text-anchor": x > 900 ? "end" : "middle", class: "fill-foreground font-mono text-[9px]" });
    }
  }

  function pick(id) {
    sel = id;
    const p = byId[id];
    o.name.textContent = p.name;
    o.life.textContent = `${p.life} · ${p.school}`;
    o.work.textContent = p.work;
    const names = (ids) => [...ids].map((i) => byId[i].name).join(", ") || "none in this graph";
    o.links.innerHTML = "";
    for (const [label, ids] of [["Drew on", parents(id)], ["Read by", children(id)]]) {
      const d = document.createElement("div");
      d.textContent = `${label}: ${names(ids)}`;
      o.links.append(d);
    }
    draw();
  }

  svg.setAttribute("tabindex", "0");
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-id]"); if (g) pick(g.dataset.id); });
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = sel ? order.indexOf(sel) : -1;
    pick(order[(i + d + order.length) % order.length]);
  });
  draw();
}

// ============================================================ Fallacies

for (const root of document.querySelectorAll("[data-philo-fallacy]")) {
  const items = [...root.querySelector("template[data-items]").content.children].map((d) => ({ ...d.dataset }));
  const ex = root.querySelector("blockquote[data-example]");
  const why = root.querySelector("[data-why]");
  const nextBtn = root.querySelector("[data-action=next]");
  const answers = [...root.querySelectorAll("button[data-answer]")];
  const o = outs(root);
  let i = 0, score = 0, done = false;

  answers.forEach((b) => b.addEventListener("click", () => {
    if (done) return;
    const it = items[i];
    const right = b.dataset.answer === it.answer;
    b.dataset.state = right ? "right" : "wrong";
    if (right) {
      done = true;
      if (!answers.some((x) => x.dataset.state === "wrong")) score++;
      why.textContent = `${it.answer}. ${it.why}`;
      nextBtn.disabled = i === items.length - 1;
      o.score.textContent = `${score} correct`;
      if (i === items.length - 1) why.textContent += `  Quiz done: ${score} of ${items.length} at the first try.`;
    } else {
      why.textContent = "Not that one. Look at what the argument actually does.";
    }
  }));
  nextBtn.addEventListener("click", () => {
    i++;
    done = false;
    for (const b of answers) delete b.dataset.state;
    ex.textContent = items[i].example;
    why.textContent = "";
    nextBtn.disabled = true;
    o.pos.textContent = `${i + 1} / ${items.length}`;
  });
}

// ============================================================ Zeno

for (const root of document.querySelectorAll("[data-philo-zeno]")) {
  const track = root.querySelector("[data-zeno-track]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let k = 0;
  const s = scrubAll(root, () => { k = 0; draw(); });

  // Stage n takes t_n = (d / vA)·(vT/vA)^n: a geometric series with ratio
  // r = vT/vA < 1, summing to d / (vA − vT).
  function stages(n) {
    const d = s.head.get(), va = s.va.get(), vt = s.vt.get();
    const r = vt / va;
    const out = [];
    let t = 0, a = 0, gap = d;
    for (let i = 0; i < n; i++) {
      const dt = gap / va;
      t += dt;
      a += gap;
      gap = gap * r;
      out.push({ t, a, gap });
    }
    return { out, limit: d / (va - vt), meet: (va * d) / (va - vt), r };
  }

  function draw() {
    const d = s.head.get(), va = s.va.get(), vt = s.vt.get();
    if (vt >= va) {
      o.limit.textContent = "never: the tortoise is as fast";
      track.replaceChildren(); svg.replaceChildren();
      return;
    }
    const { out, limit, meet } = stages(Math.max(k, 1));
    const cur = k ? out[k - 1] : { t: 0, a: 0, gap: d };
    // Track: 0 … meeting point.
    track.replaceChildren();
    const X = (m) => 30 + (m / (meet * 1.05)) * 500;
    el("line", { x1: X(0), x2: X(meet * 1.05), y1: 50, y2: 50, style: "stroke:currentColor;stroke-opacity:0.25" }, track);
    el("line", { x1: X(meet), x2: X(meet), y1: 34, y2: 66, style: "stroke:var(--brand);stroke-dasharray:3 3" }, track);
    text(track, X(meet) - 4, 14, `they meet at ${num(meet, 1)} m`, { "text-anchor": "end", style: "fill:var(--brand)" });
    for (const st of out.slice(0, k)) el("line", { x1: X(st.a), x2: X(st.a), y1: 44, y2: 56, style: "stroke:currentColor;stroke-opacity:0.35" }, track);
    el("circle", { cx: X(cur.a), cy: 50, r: 6, style: "fill:var(--vec-u)" }, track);
    el("circle", { cx: X(cur.a + cur.gap), cy: 50, r: 6, style: "fill:var(--code-add)" }, track);
    text(track, X(cur.a), 30, "Achilles", { "text-anchor": "middle", style: "fill:var(--vec-u)" });
    text(track, X(cur.a + cur.gap), 76, "tortoise", { "text-anchor": "middle", style: "fill:var(--code-add)" });

    // Partial sums of time against the stage number.
    svg.replaceChildren();
    const N = 12;
    const all = stages(N).out;
    const f = frame(svg, { box: [44, 12, 496, 150], x: [0, N], y: [0, limit * 1.1], xticks: [0, 3, 6, 9, 12], yticks: [0, limit / 2, limit].map((v) => +v.toFixed(2)), yfmt: (v) => num(v, 1), xlabel: "stage", ylabel: "time (s)" });
    hline(svg, f, limit, "stroke:var(--brand);stroke-dasharray:4 4", `limit ${num(limit, 3)} s`);
    polyline(svg, [[f.sx(0), f.sy(0)], ...all.map((st, i) => [f.sx(i + 1), f.sy(st.t)])], "stroke:currentColor;stroke-opacity:0.25;stroke-width:1.25");
    all.slice(0, k).forEach((st, i) => el("circle", { cx: f.sx(i + 1), cy: f.sy(st.t), r: 3.5, style: "fill:var(--brand)" }, svg));

    o.stage.textContent = String(k);
    o.t.textContent = `${num(cur.t, 4)} s`;
    o.gap.textContent = cur.gap < 0.01 ? `${cur.gap.toExponential(2)} m` : `${num(cur.gap, 3)} m`;
    o.limit.textContent = `${num(limit, 4)} s, ${num(meet, 2)} m`;
  }

  root.querySelector("[data-action=step]").addEventListener("click", () => { k = Math.min(k + 1, 30); draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { k = 0; draw(); });
  draw();
}

// ============================================================ Glossed source

for (const root of document.querySelectorAll("[data-philo-source]")) {
  const passages = [...root.querySelectorAll("[data-passage]")];
  const glosses = [...root.querySelector("template[data-glosses]").content.children].map((d) => d.dataset.gloss);
  const out = root.querySelector("p[data-gloss]");
  const show = (p) => {
    for (const x of passages) x === p ? (x.dataset.on = "") : delete x.dataset.on;
    out.textContent = glosses[Number(p.dataset.passage)];
  };
  for (const p of passages) {
    p.addEventListener("pointerenter", () => show(p));
    p.addEventListener("focus", () => show(p));
  }
}
