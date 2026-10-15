// Teaching tools, part 1: prerequisite graph, item analysis, learning
// objectives, rubric builder, lesson storyboard. Every block root is
// data-teach-*, so this module does nothing on other pages. Part 2 is
// teach-data.js; shared helpers are in teach-util.js.

import {
  part, mk, svg, svgText, onSwitch, status, fmt, table, row, pill, btn, inputCls,
  rng, gauss, topoOrder, pathBetween, corr, cronbach,
} from "./teach-util.js";

// ============================================================ prerequisite graph

for (const root of document.querySelectorAll("[data-teach-graph]")) {
  const CONCEPTS = [
    ["vec", "Vectors"], ["lin", "Linear combos"], ["dot", "Dot product"], ["mat", "Matrices"],
    ["mul", "Matrix product"], ["sys", "Linear systems"], ["elim", "Elimination"], ["det", "Determinants"],
    ["span", "Span & basis"], ["inv", "Inverses"], ["eig", "Eigenvalues"], ["pca", "PCA"],
  ];
  const ids = CONCEPTS.map((c) => c[0]);
  const name = Object.fromEntries(CONCEPTS);
  const START = [["vec", "lin"], ["vec", "dot"], ["lin", "mat"], ["mat", "mul"], ["mul", "sys"], ["sys", "elim"],
    ["elim", "inv"], ["mat", "det"], ["det", "inv"], ["lin", "span"], ["span", "eig"], ["det", "eig"], ["dot", "pca"], ["eig", "pca"]];
  let edges = START.map((e) => [...e]);
  let learner = false, selected = null;
  const mastered = new Set(["vec", "lin", "dot", "mat"]);
  const svgEl = part(root, "svg"), orderEl = part(root, "order"), msg = part(root, "msg");

  const sel = (slot, def) => {
    const s = mk("select", "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30");
    s.setAttribute("aria-label", slot === "from" ? "Prerequisite" : "Concept that needs it");
    for (const [id, n] of CONCEPTS) { const o = mk("option", "", n); o.value = id; s.append(o); }
    s.value = def;
    part(root, slot).append(s);
    return s;
  };
  const fromSel = sel("from", "pca"), toSel = sel("to", "vec");

  const say = (state, text) => {
    msg.replaceChildren(mk("p", state === "del" ? "text-del" : state === "brand" ? "text-brand" : "text-muted-foreground", text));
  };

  const frontier = () => ids.filter((i) => !mastered.has(i) && edges.filter(([, b]) => b === i).every(([a]) => mastered.has(a)));

  function draw(focusId) {
    const { order, depth } = topoOrder(ids, edges);
    const cols = Math.max(...depth.values()) + 1;
    const byCol = Array.from({ length: cols }, () => []);
    for (const id of order) byCol[depth.get(id)].push(id);
    const W = 120, H = 34, GX = 34, GY = 18, PAD = 14;
    const rows = Math.max(...byCol.map((c) => c.length));
    const width = PAD * 2 + cols * W + (cols - 1) * GX, height = PAD * 2 + rows * H + (rows - 1) * GY;
    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svgEl.replaceChildren();
    const pos = new Map();
    byCol.forEach((col, c) => {
      const off = ((rows - col.length) * (H + GY)) / 2;
      col.forEach((id, r) => pos.set(id, [PAD + c * (W + GX), PAD + off + r * (H + GY)]));
    });
    const defs = svg("defs", {}, svgEl);
    const mkr = svg("marker", { id: "teach-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, defs);
    svg("path", { d: "M0 0 L8 4 L0 8 z", fill: "currentColor", "fill-opacity": "0.45" }, mkr);
    const front = new Set(learner ? frontier() : []);
    const related = new Set();
    if (selected) for (const [a, b] of edges) { if (a === selected) related.add(b); if (b === selected) related.add(a); }
    const eg = svg("g", {}, svgEl);
    for (const [a, b] of edges) {
      const [x1, y1] = pos.get(a), [x2, y2] = pos.get(b);
      const sx = x1 + W, sy = y1 + H / 2, tx = x2 - 2, ty = y2 + H / 2, mx = (sx + tx) / 2;
      const hot = selected && (a === selected || b === selected);
      svg("path", {
        d: `M${sx} ${sy} C${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`, fill: "none", "marker-end": "url(#teach-arrow)",
        style: `stroke:${hot ? "var(--brand)" : "currentColor"};stroke-opacity:${hot ? 0.9 : 0.3};stroke-width:${hot ? 1.6 : 1.1}`,
      }, eg);
    }
    for (const id of ids) {
      const [x, y] = pos.get(id);
      const isM = learner && mastered.has(id), isF = front.has(id), locked = learner && !isM && !isF;
      const g = svg("g", {
        tabindex: "0", role: "button", "data-node": id, class: "cursor-pointer outline-none group",
        "aria-label": `${name[id]}${learner ? (isM ? ", mastered" : isF ? ", ready to learn" : ", locked") : ""}`,
        ...(learner ? { "aria-pressed": String(isM) } : {}),
      }, svgEl);
      svg("rect", {
        x, y, width: W, height: H, rx: 7,
        class: "transition-[fill,stroke] duration-150 group-focus-visible:stroke-ring",
        style: `fill:${isM ? "color-mix(in oklab, var(--brand) 16%, var(--background))" : "var(--background)"};stroke:${isM || isF || id === selected ? "var(--brand)" : "var(--border)"};stroke-width:${id === selected ? 2 : 1.2};${isF ? "stroke-dasharray:4 3;" : ""}`,
      }, g);
      svgText(g, x + W / 2, y + H / 2 + 4, name[id], {
        "text-anchor": "middle", class: `font-sans text-[11px] ${locked ? "fill-muted-foreground" : "fill-foreground"}`,
      });
      if (isF) svgText(g, x + W - 5, y - 4, "ready", { "text-anchor": "end", class: "font-mono text-[9px]", style: "fill:var(--brand)" });
    }
    orderEl.replaceChildren(...order.map((id, i) => {
      const li = mk("li", `rounded-md border px-1.5 py-0.5 ${learner && mastered.has(id) ? "border-brand/40 bg-brand/10 text-brand" : "text-muted-foreground"}`);
      li.append(mk("span", "opacity-60", `${i + 1} `), name[id]);
      return li;
    }));
    status(root, learner ? `${mastered.size} mastered · ${front.size} ready · ${ids.length - mastered.size - front.size} locked` : `${ids.length} concepts · ${edges.length} prerequisites`);
    if (focusId) svgEl.querySelector(`[data-node="${focusId}"]`)?.focus();
  }

  function act(id) {
    selected = id;
    if (learner) {
      mastered.has(id) ? mastered.delete(id) : mastered.add(id);
      // Unmastering a concept doesn't unmaster what depends on it: the
      // overlay shows the learner's record, not the course's rules.
    } else {
      fromSel.value = id;
    }
    draw(id);
  }
  svgEl.addEventListener("click", (e) => { const g = e.target.closest("[data-node]"); if (g) act(g.dataset.node); });
  svgEl.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-node]");
    if (g && (e.key === " " || e.key === "Enter")) { e.preventDefault(); act(g.dataset.node); }
  });

  part(root, "add").addEventListener("click", () => {
    const a = fromSel.value, b = toSel.value;
    if (a === b) return say("del", "A concept can't be its own prerequisite.");
    if (edges.some(([x, y]) => x === a && y === b)) return say("muted", `${name[a]} is already a prerequisite of ${name[b]}.`);
    const loop = pathBetween(edges, b, a);
    if (loop) return say("del", `Refused: that makes a cycle, ${[...loop, b].map((i) => name[i]).join(" → ")}. Nobody could ever start.`);
    edges.push([a, b]);
    say("brand", `Added: ${name[a]} before ${name[b]}.`);
    draw();
  });
  part(root, "remove").addEventListener("click", () => {
    const a = fromSel.value, b = toSel.value;
    const i = edges.findIndex(([x, y]) => x === a && y === b);
    if (i < 0) return say("muted", `There is no edge ${name[a]} → ${name[b]} to remove.`);
    edges.splice(i, 1);
    say("brand", `Removed: ${name[a]} → ${name[b]}.`);
    draw();
  });
  part(root, "reset").addEventListener("click", () => {
    edges = START.map((e) => [...e]);
    mastered.clear(); ["vec", "lin", "dot", "mat"].forEach((i) => mastered.add(i));
    selected = null;
    fromSel.value = "pca"; toSel.value = "vec";
    say("muted", "Back to the authored course map.");
    draw();
  });
  learner = onSwitch(root, "learner", (on) => { learner = on; draw(); });
  say("muted", "Try adding PCA before Vectors: the tool will refuse and name the loop.");
  draw();
}

// ============================================================ item analysis

for (const root of document.querySelectorAll("[data-teach-items]")) {
  const N = 120, OPTS = "ABCD";
  // Item design: discrimination a, difficulty b, key, and the option a
  // learner who gets it right actually picks (differs from the key when
  // the key is wrong). Distractor weights shape the wrong answers.
  const ITEMS = [
    { topic: "Vector addition", a: 1.4, b: -1.2, key: 0, w: [0, 3, 2, 1] },
    { topic: "Dot product", a: 1.6, b: -0.4, key: 2, w: [3, 2, 0, 1] },
    { topic: "Span", a: 0.35, b: 0.2, key: 1, w: [2, 0, 2, 2] },
    { topic: "Matrix product", a: 1.8, b: 0.1, key: 3, w: [2, 3, 1, 0] },
    { topic: "Row reduction", a: 1.5, b: 0.0, key: 1, right: 2, w: [1, 4, 0, 1] },
    { topic: "Rank", a: 1.3, b: 0.6, key: 0, w: [0, 2, 2, 0] },
    { topic: "Determinant 2×2", a: 1.2, b: -0.8, key: 2, w: [1, 3, 0, 2] },
    { topic: "Inverse", a: 1.7, b: 0.9, key: 1, w: [3, 0, 2, 1] },
    { topic: "Identity matrix", a: 1.0, b: -3.2, key: 3, w: [1, 1, 1, 0] },
    { topic: "Basis", a: 1.4, b: 0.4, key: 0, w: [0, 3, 1, 2] },
    { topic: "Eigenvectors", a: 0.25, b: 2.6, key: 2, w: [2, 2, 0, 2] },
    { topic: "Orthogonality", a: 1.3, b: 0.3, key: 3, w: [2, 1, 2, 0] },
  ];
  let seed = 11, sel = 4, resp = [], score = [], stats = [];

  function simulate() {
    const r = rng(seed);
    resp = []; score = [];
    for (let i = 0; i < N; i++) {
      const th = gauss(r);
      const rr = [], ss = [];
      for (const it of ITEMS) {
        const p = 0.2 + 0.8 / (1 + Math.exp(-1.7 * it.a * (th - it.b)));
        let opt;
        if (r() < p) opt = it.right ?? it.key;
        else {
          // Weaker learners favour the most attractive distractor.
          const w = it.w.map((v, j) => (j === (it.right ?? it.key) ? 0 : v * (j === it.w.indexOf(Math.max(...it.w)) ? 1 + Math.max(0, -th) : 1)));
          const tot = w.reduce((s, v) => s + v, 0);
          let u = r() * tot;
          opt = w.findIndex((v) => (u -= v) < 0);
          if (opt < 0) opt = w.length - 1;
        }
        rr.push(opt); ss.push(opt === it.key ? 1 : 0);
      }
      resp.push(rr); score.push(ss);
    }
    const totals = score.map((s) => s.reduce((a, b) => a + b, 0));
    const idx = [...totals.keys()].sort((a, b) => totals[b] - totals[a]);
    const g = Math.round(0.27 * N);
    const upper = new Set(idx.slice(0, g)), lower = new Set(idx.slice(-g));
    const alpha = cronbach(score);
    stats = ITEMS.map((it, j) => {
      const col = score.map((s) => s[j]);
      const rest = totals.map((t, i) => t - col[i]);
      const p = col.reduce((a, b) => a + b, 0) / N;
      const pu = [...upper].reduce((s, i) => s + col[i], 0) / g, pl = [...lower].reduce((s, i) => s + col[i], 0) / g;
      const share = (set) => OPTS.split("").map((_, o) => [...set].filter((i) => resp[i][j] === o).length / set.size);
      const middle = new Set([...totals.keys()].filter((i) => !upper.has(i) && !lower.has(i)));
      const r = corr(col, rest), aDel = cronbach(score, j);
      const flags = [];
      if (r < 0) flags.push(["check key", "del"]);
      else if (r < 0.2) flags.push(["weak", "del"]);
      if (p > 0.9) flags.push(["too easy", "muted"]);
      if (p < 0.2) flags.push(["too hard", "muted"]);
      if (aDel > alpha + 0.005) flags.push(["α rises if dropped", "muted"]);
      const dead = OPTS.split("").filter((_, o) => o !== it.key && resp.every((rr) => rr[j] !== o));
      if (dead.length) flags.push([`option ${dead.join(", ")} never chosen`, "muted"]);
      return { p, r, d: pu - pl, aDel, flags, up: share(upper), mid: share(middle), lo: share(lower) };
    });
    part(root, "n").textContent = String(N);
    part(root, "mean").textContent = `${fmt(totals.reduce((a, b) => a + b, 0) / N, 1)} / ${ITEMS.length}`;
    part(root, "alpha").textContent = fmt(alpha, 2);
    const flagged = stats.filter((s) => s.flags.some((f) => f[1] === "del" || f[0].startsWith("too"))).length;
    status(root, `seed ${seed} · ${flagged} item${flagged === 1 ? "" : "s"} flagged`);
    render();
  }

  const bar = (v, tone) => {
    const w = mk("span", "relative inline-block h-1.5 w-14 overflow-hidden rounded-full bg-muted align-middle");
    const f = mk("span", `absolute inset-y-0 left-0 rounded-full ${tone}`);
    f.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`;
    w.append(f);
    return w;
  };

  function render(focus) {
    const rows = stats.map((s, j) => {
      const it = ITEMS[j];
      const flags = mk("span", "flex flex-wrap gap-1");
      flags.append(...(s.flags.length ? s.flags.map(([t, tone]) => pill(t, tone)) : [mk("span", "text-muted-foreground/60", "—")]));
      const pCell = mk("span", "flex items-center gap-2 tabular-nums");
      pCell.append(bar(s.p, "bg-foreground/50"), fmt(s.p, 2));
      const tr = row([
        mk("span", "font-mono text-xs", `Q${j + 1}`), it.topic, mk("span", "font-mono", OPTS[it.key]), pCell,
        mk("span", `font-mono tabular-nums ${s.r < 0.2 ? "text-del" : ""}`, fmt(s.r, 2)),
        mk("span", "font-mono tabular-nums", fmt(s.d, 2)), mk("span", "font-mono tabular-nums", fmt(s.aDel, 2)), flags,
      ], `cursor-pointer outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:bg-accent aria-selected:bg-brand/8`);
      tr.tabIndex = j === sel ? 0 : -1;
      tr.dataset.item = String(j);
      tr.setAttribute("aria-selected", String(j === sel));
      tr.setAttribute("aria-label", `Question ${j + 1}, ${it.topic}`);
      return tr;
    });
    const t = table(["Item", "Topic", "Key", "Difficulty p", "Item–rest r", "D (27%)", "α if dropped", "Flags"], rows, "w-full min-w-[760px] text-sm");
    t.setAttribute("role", "grid");
    part(root, "table").replaceChildren(t);
    if (focus) t.querySelector(`[data-item="${sel}"]`)?.focus();
    options();
  }

  function options() {
    const s = stats[sel], it = ITEMS[sel];
    const box = part(root, "options");
    box.replaceChildren();
    box.append(mk("p", "text-sm font-medium md:col-span-2", `Q${sel + 1} · ${it.topic}`));
    const legend = mk("div", "flex gap-3 font-mono text-[10px] text-muted-foreground md:col-span-2");
    for (const [l, c] of [["upper 27%", "bg-brand"], ["middle", "bg-foreground/30"], ["lower 27%", "bg-del/70"]]) {
      const sp = mk("span", "flex items-center gap-1"); sp.append(mk("span", `size-2 rounded-sm ${c}`), l); legend.append(sp);
    }
    box.append(legend);
    OPTS.split("").forEach((o, k) => {
      const line = mk("div", "grid grid-cols-[2.5rem_1fr] items-center gap-2");
      const lab = mk("span", `font-mono text-xs ${k === it.key ? "text-brand" : "text-muted-foreground"}`, k === it.key ? `${o} key` : o);
      const bars = mk("div", "flex flex-col gap-0.5");
      for (const [v, c] of [[s.up[k], "bg-brand"], [s.mid[k], "bg-foreground/30"], [s.lo[k], "bg-del/70"]]) {
        const b = mk("div", "flex items-center gap-2");
        const track = mk("span", "relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted");
        const fill = mk("span", `absolute inset-y-0 left-0 rounded-full ${c}`); fill.style.width = `${v * 100}%`;
        track.append(fill);
        b.append(track, mk("span", "w-8 text-right font-mono text-[10px] tabular-nums text-muted-foreground", `${Math.round(v * 100)}%`));
        bars.append(b);
      }
      line.append(lab, bars);
      box.append(line);
    });
    const verdict = s.r < 0
      ? `The strongest learners avoid the key and pick ${OPTS[it.right ?? it.key]}: the key is probably wrong. Check it before anything else.`
      : s.r < 0.2 ? "Strong and weak learners answer alike, so this item says little about who learned the topic. Look for ambiguous wording."
      : s.p > 0.9 ? "Almost everyone gets it right: fine as a warm-up, but it adds little to the score."
      : "A working item: the key draws the upper group, the distractors draw the lower group.";
    box.append(mk("p", "text-xs leading-relaxed text-muted-foreground md:col-span-2", verdict));
  }

  part(root, "table").addEventListener("click", (e) => { const tr = e.target.closest("[data-item]"); if (tr) { sel = Number(tr.dataset.item); render(true); } });
  part(root, "table").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    sel = e.key === "Home" ? 0 : e.key === "End" ? ITEMS.length - 1 : Math.max(0, Math.min(ITEMS.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
    render(true);
  });
  part(root, "resample").addEventListener("click", () => { seed = (seed * 48271 + 7) % 2147483647; simulate(); });
  simulate();
}

// ============================================================ learning objectives

for (const root of document.querySelectorAll("[data-teach-objectives]")) {
  const LEVELS = [
    ["Remember", "define list recall name state identify recognise recognize label match"],
    ["Understand", "explain summarise summarize classify describe interpret paraphrase illustrate exemplify infer"],
    ["Apply", "apply compute calculate solve use implement execute carry demonstrate perform"],
    ["Analyse", "analyse analyze differentiate distinguish organise organize attribute compare contrast decompose debug"],
    ["Evaluate", "evaluate judge critique justify check assess test defend verify"],
    ["Create", "create design construct devise formulate compose derive prove generate plan build write"],
  ].map(([n, v]) => [n, v.split(" ")]);
  const VAGUE = ["understand", "know", "learn", "appreciate", "grasp", "realise", "realize", "believe", "comprehend", "aware", "familiar"];
  const ACTS = ["Worked example", "Coding lab", "Peer explanation"], TESTS = ["Quiz", "Project"];
  const input = part(root, "input");
  const objs = [
    { text: "define eigenvalue and eigenvector", cells: [true, false, false, true, false] },
    { text: "compute the determinant of a 3×3 matrix by cofactor expansion, with no errors in 4 of 5 attempts", cells: [true, true, false, true, false] },
    { text: "understand why a matrix with zero determinant has no inverse", cells: [false, false, true, false, false] },
    { text: "design a small program that uses PCA to compress a dataset", cells: [false, true, false, false, true] },
  ];

  function analyse(text) {
    const words = text.toLowerCase().replace(/[^a-z0-9%×\s-]/g, " ").split(/\s+/).filter(Boolean);
    let verb = null, level = -1;
    for (const w of words.slice(0, 4)) {
      if (VAGUE.includes(w)) { verb = w; break; }
      const l = LEVELS.findIndex(([, vs]) => vs.includes(w));
      if (l >= 0) { verb = w; level = l; break; }
    }
    const vague = verb !== null && level < 0;
    const condition = /\b(given|using|with|by|from|without|in python|on paper)\b/.test(text.toLowerCase());
    const criterion = /\d|%|\bwithin\b|\bat least\b|\bcorrectly\b|\bno errors?\b|\bin under\b|\baccurate/.test(text.toLowerCase());
    return { verb, level, vague, condition, criterion };
  }

  const check = (ok, label, why) => {
    const d = mk("div", "flex gap-2 rounded-lg border p-3 text-sm");
    d.append(mk("span", `mt-0.5 font-mono text-xs ${ok ? "text-brand" : "text-del"}`, ok ? "✓" : "✗"));
    const t = mk("div", "flex flex-col gap-0.5");
    t.append(mk("span", "font-medium", label), mk("span", "text-xs leading-relaxed text-muted-foreground", why));
    d.append(t);
    return d;
  };

  function showAnalysis() {
    const a = analyse(input.value);
    const box = part(root, "analysis");
    box.replaceChildren(
      check(a.level >= 0, a.level >= 0 ? `Verb “${a.verb}” · ${LEVELS[a.level][0]}` : a.vague ? `Verb “${a.verb}” can't be observed` : "No action verb found",
        a.level >= 0 ? "An observable action: you can watch a learner do it." : a.vague ? "Nobody can see understanding. Say what a learner who understands would do: explain, compute, prove…" : "Start with what the learner will do, for example compute, explain or prove."),
      check(a.condition, a.condition ? "Has a condition" : "No condition", a.condition ? "It says with what or under which circumstances." : "Under what conditions? Given a matrix, using Python, without a calculator…"),
      check(a.criterion, a.criterion ? "Has a criterion" : "No criterion", a.criterion ? "It says how well, so you know when it's met." : "How well? 4 of 5 correct, within 10 minutes, with no errors…"),
      check(a.level >= 0 && a.criterion, a.level >= 0 && a.criterion ? "Measurable" : "Not yet measurable", "A measurable objective names an observable action and a standard to meet (Mager, 1962)."),
    );
    const ladder = part(root, "ladder");
    ladder.replaceChildren(panelLabelEl("Revised Bloom taxonomy, lowest to highest"));
    LEVELS.forEach(([n, vs], i) => {
      const li = mk("div", `grid grid-cols-[6.5rem_1fr] gap-3 rounded-md px-2 py-1 text-xs ${i === a.level ? "bg-brand/10 text-foreground" : "text-muted-foreground"}`);
      li.append(mk("span", `font-medium ${i === a.level ? "text-brand" : ""}`, `${i + 1} ${n}`), mk("span", "truncate", vs.slice(0, 7).join(", ")));
      ladder.append(li);
    });
  }
  const panelLabelEl = (s) => mk("span", "px-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase", s);

  function matrix(focusKey) {
    const head = ["Objective", "Level", ...ACTS, ...TESTS, ""];
    let gaps = 0;
    const rows = objs.map((o, i) => {
      const a = analyse(o.text);
      const practised = o.cells.slice(0, ACTS.length).some(Boolean), assessed = o.cells.slice(ACTS.length).some(Boolean);
      const cells = [mk("span", "block min-w-56 max-w-96 text-sm leading-snug", o.text)];
      const lv = mk("span", "flex flex-col gap-1");
      lv.append(a.level >= 0 ? pill(LEVELS[a.level][0], "brand") : pill(a.vague ? "vague verb" : "no verb", "del"));
      if (!practised) { lv.append(pill("not practised", "del")); gaps++; }
      if (!assessed) { lv.append(pill("not assessed", "del")); gaps++; }
      cells.push(lv);
      o.cells.forEach((on, k) => {
        const c = mk("input", "size-4 accent-brand");
        c.type = "checkbox"; c.checked = on; c.dataset.cell = `${i}:${k}`;
        c.setAttribute("aria-label", `${[...ACTS, ...TESTS][k]} for: ${o.text}`);
        cells.push(c);
      });
      const del = btn("Remove", "h-7 px-2");
      del.dataset.remove = String(i);
      del.setAttribute("aria-label", `Remove objective: ${o.text}`);
      cells.push(del);
      return row(cells);
    });
    const t = table(head, rows, "w-full min-w-[720px] text-sm");
    part(root, "matrix").replaceChildren(t);
    part(root, "gaps").textContent = gaps ? `${gaps} gap${gaps === 1 ? "" : "s"}` : "fully aligned";
    part(root, "gaps").className = `font-mono text-xs ${gaps ? "text-del" : "text-brand"}`;
    status(root, `${objs.length} objectives`);
    if (focusKey) part(root, "matrix").querySelector(focusKey)?.focus();
  }

  part(root, "matrix").addEventListener("change", (e) => {
    const c = e.target.closest("[data-cell]");
    if (!c) return;
    const [i, k] = c.dataset.cell.split(":").map(Number);
    objs[i].cells[k] = c.checked;
    matrix(`[data-cell="${i}:${k}"]`);
  });
  part(root, "matrix").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    objs.splice(Number(b.dataset.remove), 1);
    matrix();
    input.focus();
  });
  const add = () => {
    const t = input.value.trim();
    if (!t) return;
    objs.push({ text: t, cells: [false, false, false, false, false] });
    matrix();
  };
  part(root, "add").addEventListener("click", add);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  input.addEventListener("input", showAnalysis);
  showAnalysis();
  matrix();
}

// ============================================================ rubric builder

for (const root of document.querySelectorAll("[data-teach-rubric]")) {
  const LEVELS = ["Exemplary", "Proficient", "Developing", "Beginning"];
  const crit = [
    { name: "Correctness", w: 40, d: ["Every result is right and checked against a test case.", "Results are right; one minor slip.", "Several errors, but the method is sound.", "Results are mostly wrong or missing."], g: null },
    { name: "Reasoning", w: 30, d: ["Each step is justified; the argument could convince a sceptic.", "Most steps justified; small gaps.", "Steps listed with little justification.", "No visible reasoning."], g: null },
    { name: "Code quality", w: 20, d: ["Clear names, small functions, tests pass.", "Readable, a few long functions.", "Works but hard to follow.", "Doesn't run."], g: null },
    { name: "Presentation", w: 10, d: ["Figures labelled, write-up concise.", "Mostly clear.", "Hard to follow in places.", "Disorganised."], g: null },
  ];
  const grid = part(root, "grid");

  function render(focusKey) {
    const head = ["Criterion, weight and grade", ...LEVELS.map((l, i) => `${l} · ${4 - i}`)];
    const rows = crit.map((c, i) => {
      const name = mk("input", inputCls + " w-full min-w-36 font-medium");
      name.value = c.name; name.dataset.f = `name:${i}`; name.setAttribute("aria-label", `Criterion ${i + 1} name`);
      const w = mk("input", inputCls + " w-16 min-w-16 font-mono tabular-nums");
      w.type = "number"; w.min = "0"; w.max = "100"; w.step = "5"; w.value = String(c.w); w.dataset.f = `w:${i}`;
      w.setAttribute("aria-label", `Weight of ${c.name}, percent`);
      const first = mk("div", "flex min-w-48 flex-col gap-2");
      const wrow = mk("div", "flex items-center gap-1.5");
      wrow.append(w, mk("span", "font-mono text-[11px] text-muted-foreground", "%"));
      first.append(name, wrow);
      const cells = [first];
      c.d.forEach((txt, l) => {
        const ta = mk("textarea", "min-h-16 w-full min-w-36 resize-y rounded-md border border-transparent bg-transparent px-2 py-1 text-xs leading-relaxed outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 " + (c.g === l ? "bg-brand/10" : ""));
        ta.value = txt; ta.rows = 3; ta.dataset.f = `d:${i}:${l}`;
        ta.setAttribute("aria-label", `${c.name}, ${LEVELS[l]} descriptor`);
        cells.push(ta);
      });
      const radios = mk("div", "flex gap-1");
      radios.setAttribute("role", "radiogroup");
      radios.setAttribute("aria-label", `Grade for ${c.name}`);
      LEVELS.forEach((l, k) => {
        const b = mk("button", `size-7 rounded-md border font-mono text-xs outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${c.g === k ? "border-brand bg-brand/15 text-brand" : "text-muted-foreground"}`, String(4 - k));
        b.type = "button"; b.dataset.g = `${i}:${k}`;
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(c.g === k));
        b.setAttribute("aria-label", `${l}, ${4 - k} points`);
        b.tabIndex = (c.g ?? 0) === k ? 0 : -1;
        radios.append(b);
      });
      const del = btn("✕", "size-7 px-0");
      del.dataset.remove = String(i);
      del.setAttribute("aria-label", `Remove criterion ${c.name}`);
      wrow.append(mk("span", "flex-1"), del);
      first.append(radios);
      return row(cells, "align-top");
    });
    grid.replaceChildren(table(head, rows, "w-full min-w-[860px] text-sm [&_td]:align-top"));
    totals();
    if (focusKey) grid.querySelector(focusKey)?.focus();
  }

  function totals() {
    const W = crit.reduce((s, c) => s + c.w, 0);
    const wEl = part(root, "weights");
    wEl.textContent = W === 100 ? "weights sum to 100%" : `weights sum to ${W}%, should be 100%`;
    wEl.className = `ml-auto font-mono text-xs tabular-nums ${W === 100 ? "text-brand" : "text-del"}`;
    const graded = crit.filter((c) => c.g !== null);
    const gw = graded.reduce((s, c) => s + c.w, 0);
    const score = gw ? graded.reduce((s, c) => s + c.w * ((4 - c.g) / 4), 0) / gw * 100 : NaN;
    part(root, "score").textContent = Number.isFinite(score) ? `${fmt(score, 1)}%` : "—";
    part(root, "detail").textContent = graded.length
      ? `Weighted mean of ${graded.length} of ${crit.length} criteria: ${graded.map((c) => `${c.name} ${4 - c.g}/4 × ${c.w}%`).join(" + ")}${graded.length < crit.length ? ". Ungraded criteria are left out, not counted as zero." : "."}`
      : "Pick a level for each criterion to grade a submission.";
    status(root, `${crit.length} criteria · ${graded.length} graded`);
  }

  grid.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const [k, i, l] = f.split(":");
    if (k === "name") crit[i].name = e.target.value;
    if (k === "w") crit[i].w = Math.max(0, Number(e.target.value) || 0);
    if (k === "d") crit[i].d[l] = e.target.value;
    totals();
  });
  const grade = (i, k, focus) => { crit[i].g = crit[i].g === k && !focus ? null : k; render(`[data-g="${i}:${k}"]`); };
  grid.addEventListener("click", (e) => {
    const g = e.target.closest("[data-g]");
    if (g) { const [i, k] = g.dataset.g.split(":").map(Number); grade(i, k, false); return; }
    const r = e.target.closest("[data-remove]");
    if (r) { crit.splice(Number(r.dataset.remove), 1); render(); part(root, "add").focus(); }
  });
  grid.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-g]");
    if (!g || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const [i, k] = g.dataset.g.split(":").map(Number);
    const n = (k + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + 4) % 4;
    grade(i, n, true);
  });
  part(root, "add").addEventListener("click", () => {
    crit.push({ name: "New criterion", w: 0, d: ["", "", "", ""], g: null });
    render(`[data-f="name:${crit.length - 1}"]`);
  });
  part(root, "clear").addEventListener("click", () => { crit.forEach((c) => (c.g = null)); render(); });
  part(root, "copy").addEventListener("click", () => {
    const esc = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const md = [
      `| Criterion | Weight | ${LEVELS.map((l, i) => `${l} (${4 - i})`).join(" | ")} |`,
      `|---|---:|${LEVELS.map(() => "---").join("|")}|`,
      ...crit.map((c) => `| ${esc(c.name)} | ${c.w}% | ${c.d.map(esc).join(" | ")} |`),
    ].join("\n");
    navigator.clipboard?.writeText(md).then(() => status(root, "Markdown copied"), () => status(root, "Copy blocked by the browser"));
  });
  render();
}

// ============================================================ lesson storyboard

for (const root of document.querySelectorAll("[data-teach-story]")) {
  const KINDS = {
    read: { label: "Reading", unit: "words", min: (n) => n / 230, cls: "bg-vec-u/35", passive: true },
    video: { label: "Video", unit: "min", min: (n) => n * 1.3, cls: "bg-vec-v/35", passive: true },
    exercise: { label: "Exercises", unit: "items", min: (n) => n * 3, cls: "bg-brand/45", passive: false },
    quiz: { label: "Quiz", unit: "questions", min: (n) => n * 1, cls: "bg-brand/75", passive: false },
    talk: { label: "Discussion", unit: "min", min: (n) => n, cls: "bg-vec-out/35", passive: false },
  };
  let uid = 0;
  const S = (kind, title, size, terms = 0) => ({ id: ++uid, kind, title, size, terms });
  const secs = [
    S("read", "Why determinants?", 450, 1), S("video", "Area of a parallelogram", 6, 2), S("read", "Cofactor expansion", 900, 4),
    S("read", "Properties of the determinant", 700, 3), S("exercise", "Compute five determinants", 5), S("video", "Determinant and invertibility", 8, 1), S("quiz", "Check your understanding", 6),
  ];
  const list = part(root, "list"), targetIn = part(root, "target");

  function render(focusSel) {
    list.replaceChildren(...secs.map((s, i) => {
      const k = KINDS[s.kind];
      const li = mk("li", "grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2 rounded-xl border bg-background p-2 sm:grid-cols-[1.5rem_8rem_minmax(0,1fr)_auto_auto_auto] sm:items-center");
      li.dataset.sec = String(s.id);
      const dot = mk("span", `mt-2 size-3 rounded-sm sm:mt-0 ${k.cls}`);
      dot.setAttribute("aria-hidden", "true");
      const kind = mk("select", inputCls + " w-full sm:col-auto col-start-2");
      kind.setAttribute("aria-label", `Kind of section ${i + 1}`);
      for (const [v, kk] of Object.entries(KINDS)) { const o = mk("option", "", kk.label); o.value = v; kind.append(o); }
      kind.value = s.kind; kind.dataset.f = `kind:${s.id}`;
      const title = mk("input", inputCls + " w-full col-start-2 sm:col-auto");
      title.value = s.title; title.dataset.f = `title:${s.id}`; title.setAttribute("aria-label", `Title of section ${i + 1}`);
      const size = mk("label", "col-start-2 flex items-center gap-1 sm:col-auto");
      const sizeIn = mk("input", inputCls + " w-20 font-mono tabular-nums");
      sizeIn.type = "number"; sizeIn.min = "0"; sizeIn.value = String(s.size); sizeIn.dataset.f = `size:${s.id}`;
      sizeIn.setAttribute("aria-label", `Size of section ${i + 1} in ${k.unit}`);
      size.append(sizeIn, mk("span", "w-16 font-mono text-[10px] text-muted-foreground", k.unit));
      const terms = mk("label", "col-start-2 flex items-center gap-1 sm:col-auto");
      const termsIn = mk("input", inputCls + " w-14 font-mono tabular-nums");
      termsIn.type = "number"; termsIn.min = "0"; termsIn.max = "20"; termsIn.value = String(s.terms); termsIn.dataset.f = `terms:${s.id}`;
      termsIn.setAttribute("aria-label", `New terms introduced in section ${i + 1}`);
      terms.append(termsIn, mk("span", "font-mono text-[10px] text-muted-foreground", "new terms"));
      const tools = mk("div", "col-start-2 flex items-center gap-1 sm:col-auto");
      const est = mk("span", "w-14 text-right font-mono text-xs tabular-nums", `${fmt(k.min(s.size), 1)} min`);
      const up = btn("↑", "size-7 px-0"), down = btn("↓", "size-7 px-0"), del = btn("✕", "size-7 px-0");
      up.dataset.move = `${s.id}:-1`; down.dataset.move = `${s.id}:1`; del.dataset.remove = String(s.id);
      up.setAttribute("aria-label", `Move ${s.title} up`); down.setAttribute("aria-label", `Move ${s.title} down`); del.setAttribute("aria-label", `Remove ${s.title}`);
      up.disabled = i === 0; down.disabled = i === secs.length - 1;
      tools.append(est, up, down, del);
      li.append(dot, kind, title, size, terms, tools);
      return li;
    }));
    summary();
    if (focusSel) list.querySelector(focusSel)?.focus();
  }

  function summary() {
    const target = Math.max(5, Number(targetIn.value) || 30);
    const mins = secs.map((s) => KINDS[s.kind].min(s.size));
    const total = mins.reduce((a, b) => a + b, 0);
    const span = Math.max(total, target);
    const tl = part(root, "timeline");
    tl.replaceChildren(...secs.map((s, i) => {
      const seg = mk("span", `relative h-full border-r border-background ${KINDS[s.kind].cls}`);
      seg.style.width = `${(mins[i] / span) * 100}%`;
      seg.title = `${s.title}: ${fmt(mins[i], 1)} min`;
      return seg;
    }));
    tl.classList.add("relative");
    const marker = mk("span", "absolute inset-y-0 w-0.5 bg-foreground/70");
    marker.style.left = `calc(${(target / span) * 100}% - 1px)`;
    marker.setAttribute("aria-hidden", "true");
    tl.append(marker);
    tl.setAttribute("role", "img");
    tl.setAttribute("aria-label", `Timeline: ${secs.map((s, i) => `${KINDS[s.kind].label} ${fmt(mins[i], 0)} min`).join(", ")}; target ${target} min`);
    const over = total > target * 1.1;
    const tot = part(root, "total");
    tot.textContent = `${fmt(total, 1)} of ${target} min`;
    tot.className = `ml-auto font-mono text-xs tabular-nums ${over ? "text-del" : "text-brand"}`;

    const warn = [];
    let run = 0, start = 0;
    secs.forEach((s, i) => {
      if (KINDS[s.kind].passive) { if (!run) start = i; run += mins[i]; }
      if (!KINDS[s.kind].passive || i === secs.length - 1) {
        if (run > 15) warn.push(`${fmt(run, 0)} minutes of reading and video in a row (sections ${start + 1}–${KINDS[s.kind].passive ? i + 1 : i}) before any practice. Insert a short exercise to make learners retrieve what they just saw.`);
        run = 0;
      }
      if (s.terms > 3) warn.push(`“${s.title}” introduces ${s.terms} new terms. Working memory holds only a few new elements at once (Sweller, 1988): split it, or define some terms earlier.`);
    });
    if (!secs.some((s) => !KINDS[s.kind].passive)) warn.push("No exercise, quiz or discussion: learners never have to produce anything.");
    if (over) warn.push(`The plan runs ${fmt(total - target, 0)} minutes over the ${target}-minute target.`);
    part(root, "warnings").replaceChildren(...warn.map((w) => {
      const li = mk("li", "flex gap-2 rounded-lg border border-del/30 bg-del/5 p-2.5 text-sm leading-relaxed");
      li.append(mk("span", "font-mono text-xs text-del", "!"), mk("span", "", w));
      return li;
    }));
    status(root, `${secs.length} sections · ${warn.length} warning${warn.length === 1 ? "" : "s"}`);
  }

  const idx = (id) => secs.findIndex((s) => s.id === Number(id));
  function move(id, d) {
    const i = idx(id), j = i + d;
    if (j < 0 || j >= secs.length) return;
    [secs[i], secs[j]] = [secs[j], secs[i]];
    render();
    const same = list.querySelector(`[data-move="${id}:${d}"]`);
    (same && !same.disabled ? same : list.querySelector(`[data-move="${id}:${-d}"]`))?.focus();
  }
  list.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const [k, id] = f.split(":");
    const s = secs[idx(id)];
    if (k === "title") s.title = e.target.value;
    if (k === "size") s.size = Math.max(0, Number(e.target.value) || 0);
    if (k === "terms") s.terms = Math.max(0, Number(e.target.value) || 0);
    if (k === "kind") { s.kind = e.target.value; render(`[data-f="kind:${id}"]`); return; }
    const est = e.target.closest("[data-sec]").querySelector("span.w-14");
    if (est) est.textContent = `${fmt(KINDS[s.kind].min(s.size), 1)} min`;
    summary();
  });
  list.addEventListener("click", (e) => {
    const m = e.target.closest("[data-move]");
    if (m) { const [id, d] = m.dataset.move.split(":"); move(id, Number(d)); return; }
    const r = e.target.closest("[data-remove]");
    if (r) { secs.splice(idx(r.dataset.remove), 1); render(); part(root, "add").focus(); }
  });
  list.addEventListener("keydown", (e) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const li = e.target.closest("[data-sec]");
    if (!li) return;
    e.preventDefault();
    const f = e.target.dataset.f?.split(":")[0];
    const id = li.dataset.sec, d = e.key === "ArrowUp" ? -1 : 1;
    const i = idx(id), j = i + d;
    if (j < 0 || j >= secs.length) return;
    [secs[i], secs[j]] = [secs[j], secs[i]];
    render(f ? `[data-f="${f}:${id}"]` : undefined);
  });
  part(root, "add").addEventListener("click", () => { secs.push(S("exercise", "New section", 3)); render(`[data-f="title:${uid}"]`); });
  targetIn.addEventListener("input", summary);
  render();
}
