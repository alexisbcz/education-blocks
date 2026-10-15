// Assessment formats you move things in: Parsons problems, proof ordering,
// graph sketching, hotspots on a figure, and the BKT mastery tracker. Every
// block root is data-assess-*, so this module does nothing on other pages.

import { exercise, mk, announcer, flip, mark } from "./assess-shell.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { scrubAll } from "./scrub.js";

// ============================================================ Parsons

const PARSONS = [["l1", 0], ["l2", 1], ["l3", 1], ["l4", 2], ["l5", 1]];
const DISTRACT = {
  d1: "x = (x - a / x) / 2 is a distractor: subtracting moves x away from √a.",
  d2: "while … < tol is a distractor: that loop would stop at once, before any step.",
};

for (const root of document.querySelectorAll("[data-assess-parsons]")) {
  const pool = root.querySelector('[data-assess-list="pool"]');
  const ans = root.querySelector('[data-assess-list="answer"]');
  const lines = [...pool.children];
  const initial = lines.slice();
  const say = announcer(root);
  const code = (li) => li.querySelector("[data-assess-code]").textContent;

  // Indent buttons, visible on lines in the program (pointer users' ← →).
  for (const li of lines) {
    const box = mk("span", "ml-auto hidden shrink-0 gap-0.5");
    box.dataset.assessIndentBox = "";
    for (const [d, label, sym] of [[-1, "Outdent", "‹"], [1, "Indent", "›"]]) {
      const b = mk("button", "flex size-6 items-center justify-center rounded border bg-background font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50", sym);
      b.type = "button";
      b.tabIndex = -1;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", (e) => { e.stopPropagation(); indent(li, d); });
      box.append(b);
    }
    li.append(box);
  }

  const indentOf = (li) => +li.dataset.indent;
  function paint() {
    for (const li of lines) {
      const inAns = li.parentElement === ans;
      const n = inAns ? indentOf(li) : 0;
      li.style.marginLeft = `${n * 1.5}rem`;
      li.querySelector("[data-assess-indent-box]").style.display = inAns ? "flex" : "none";
      const where = inAns ? `in your program, line ${[...ans.children].indexOf(li) + 1}, indent ${n}` : "in the available lines";
      li.setAttribute("aria-label", `${code(li).trim()}, ${where}`);
    }
  }
  const icon = (li) => li.querySelector("svg");
  function setState(li, st) { if (st) li.dataset.state = st; else li.removeAttribute("data-state"); mark(icon(li), st); }
  function clearMarks() { lines.forEach((l) => setState(l, null)); }
  function indent(li, d) {
    if (li.parentElement !== ans) return;
    li.dataset.indent = String(Math.max(0, Math.min(3, indentOf(li) + d)));
    clearMarks(); paint();
    say(`indent ${li.dataset.indent}`);
  }
  function moveAcross(li) {
    const to = li.parentElement === pool ? ans : pool;
    flip(lines, () => { to.append(li); if (to === pool) li.dataset.indent = "0"; });
    clearMarks(); paint();
    li.focus();
    say(to === ans ? `added to your program as line ${ans.children.length}` : "moved back to the available lines");
  }
  function reorder(li, d) {
    const list = li.parentElement, sibs = [...list.children], i = sibs.indexOf(li), j = i + d;
    if (j < 0 || j >= sibs.length) return;
    flip(sibs, () => list.insertBefore(li, d < 0 ? sibs[j] : sibs[j].nextSibling));
    clearMarks(); paint();
    li.focus();
    say(`position ${j + 1}`);
  }

  for (const li of lines) {
    li.addEventListener("click", () => moveAcross(li));
    li.addEventListener("keydown", (e) => {
      const sibs = [...li.parentElement.children], i = sibs.indexOf(li);
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); moveAcross(li); }
      else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); reorder(li, e.key === "ArrowUp" ? -1 : 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sibs[i - 1]?.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); sibs[i + 1]?.focus(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); indent(li, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); indent(li, 1); }
    });
    // Native drag and drop for mice; taps move a line across instead.
    li.addEventListener("dragstart", (e) => { li.dataset.dragging = ""; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", li.dataset.assessLine); });
    li.addEventListener("dragend", () => { li.removeAttribute("data-dragging"); pool.removeAttribute("data-over"); ans.removeAttribute("data-over"); });
  }
  for (const list of [pool, ans]) {
    list.addEventListener("dragover", (e) => { e.preventDefault(); list.dataset.over = ""; });
    list.addEventListener("dragleave", (e) => { if (!list.contains(e.relatedTarget)) list.removeAttribute("data-over"); });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.removeAttribute("data-over");
      const li = lines.find((l) => l.dataset.assessLine === e.dataTransfer.getData("text/plain"));
      if (!li) return;
      const after = [...list.children].filter((c) => c !== li).find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      const lr = list.getBoundingClientRect();
      flip(lines, () => list.insertBefore(li, after ?? null));
      li.dataset.indent = list === ans ? String(Math.max(0, Math.min(3, Math.round((e.clientX - lr.left - 40) / 24)))) : "0";
      clearMarks(); paint();
    });
  }

  exercise(root, {
    check() {
      const got = [...ans.children];
      if (!got.length) return { state: "info", title: "Move some lines into your program first." };
      let right = 0;
      const notes = [];
      got.forEach((li, i) => {
        const id = li.dataset.assessLine, want = PARSONS[i];
        if (DISTRACT[id]) { setState(li, "wrong"); notes.push(DISTRACT[id]); return; }
        if (want && want[0] === id) {
          if (want[1] === indentOf(li)) { setState(li, "right"); right++; }
          else { setState(li, "indent"); notes.push(`Line ${i + 1} is in the right place but needs indent ${want[1]}, not ${indentOf(li)}.`); }
        } else setState(li, "wrong");
      });
      const used = got.filter((l) => !DISTRACT[l.dataset.assessLine]).length;
      if (used < PARSONS.length) notes.push(`${PARSONS.length - used} line${PARSONS.length - used === 1 ? " is" : "s are"} still missing.`);
      if (right === PARSONS.length && got.length === PARSONS.length) return { state: "right", title: "Correct: the program runs.", body: "newton_sqrt(2) returns 1.4142135623746899 after 4 steps; each step roughly doubles the number of correct digits." };
      return { state: right ? "partial" : "wrong", title: `${right} of ${PARSONS.length} lines in place.`, body: notes.length ? notes : "Red lines are in the wrong position.", shake: ans };
    },
    reveal() {
      flip(lines, () => {
        for (const [id, n] of PARSONS) { const li = lines.find((l) => l.dataset.assessLine === id); li.dataset.indent = String(n); ans.append(li); }
        for (const id of Object.keys(DISTRACT)) pool.append(lines.find((l) => l.dataset.assessLine === id));
      });
      clearMarks(); paint();
    },
    reset() {
      flip(lines, () => initial.forEach((li) => { li.dataset.indent = "0"; pool.append(li); }));
      clearMarks(); paint();
    },
  });
  paint();
}

// ============================================================ proof order

const PROOF = ["a", "b", "c", "d", "e"];
const REASONS = {
  a: ["Assumption, for contradiction"],
  b: ["Algebra on the previous line"],
  c: ["An odd number squared is odd"],
  d: ["Same argument as for p", "Algebra on the previous line"],
  e: ["Contradicts the assumption"],
};

for (const root of document.querySelectorAll("[data-assess-proof]")) {
  const list = root.querySelector("[data-assess-steps]");
  const steps = [...list.children];
  const initial = steps.slice();
  const say = announcer(root);
  const number = () => [...list.children].forEach((li, i) => (li.querySelector("[data-assess-n]").textContent = String(i + 1)));
  const clearMarks = () => steps.forEach((s) => {
    s.removeAttribute("data-state");
    mark(s.querySelector("[data-assess-n]"), null);
    const sel = s.querySelector("select");
    sel.removeAttribute("data-state");
    mark(sel.closest("[data-slot=native-select-wrapper]") ?? sel, null);
  });

  function move(li, d, focus) {
    const sibs = [...list.children], i = sibs.indexOf(li), j = i + d;
    if (j < 0 || j >= sibs.length) return;
    flip(sibs, () => list.insertBefore(li, d < 0 ? sibs[j] : sibs[j].nextSibling));
    number(); clearMarks();
    focus?.focus();
    say(`step moved to position ${j + 1}`);
  }
  for (const li of steps) {
    li.querySelectorAll("[data-assess-move]").forEach((b) => b.addEventListener("click", () => move(li, +b.dataset.assessMove, b)));
    li.addEventListener("keydown", (e) => {
      if (e.target !== li || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      move(li, e.key === "ArrowUp" ? -1 : 1, li);
    });
    li.querySelector("select").addEventListener("change", clearMarks);
  }
  exercise(root, {
    check() {
      const got = [...list.children];
      let order = 0, why = 0, blank = 0;
      got.forEach((li, i) => {
        const id = li.dataset.assessStep, sel = li.querySelector("select");
        const placed = PROOF[i] === id;
        if (placed) order++;
        li.dataset.state = placed ? "right" : "wrong";
        mark(li.querySelector("[data-assess-n]"), placed ? "right" : "wrong");
        if (!sel.value) { blank++; sel.removeAttribute("data-state"); mark(sel.closest("[data-slot=native-select-wrapper]") ?? sel, null); return; }
        const ok = REASONS[id].includes(sel.value);
        if (ok) why++;
        sel.dataset.state = ok ? "right" : "wrong";
        mark(sel.closest("[data-slot=native-select-wrapper]") ?? sel, ok ? "right" : "wrong");
      });
      const n = PROOF.length;
      if (order === n && why === n) return { state: "right", title: "A complete proof.", body: "Assume, derive p even, then q even, and the shared factor 2 contradicts lowest terms. Aristotle already cites it as the model proof by contradiction (Prior Analytics I.23)." };
      const body = [`Order: ${order} of ${n} steps in place${order < n ? " (red cards are out of place)" : ""}.`, `Reasons: ${why} of ${n} right${blank ? `, ${blank} still to choose` : ""}.`];
      return { state: order + why ? "partial" : "wrong", title: "Not yet a proof.", body, shake: list };
    },
    reveal() {
      flip(steps, () => PROOF.forEach((id) => list.append(steps.find((s) => s.dataset.assessStep === id))));
      steps.forEach((s) => { s.querySelector("select").value = REASONS[s.dataset.assessStep][0]; });
      number(); clearMarks();
    },
    reset() {
      flip(steps, () => initial.forEach((s) => list.append(s)));
      steps.forEach((s) => (s.querySelector("select").value = ""));
      number(); clearMarks();
    },
  });
}

// ============================================================ sketch

for (const root of document.querySelectorAll("[data-assess-sketch]")) {
  const svg = root.querySelector("[data-plot]");
  const key = root.querySelector("[data-assess-band-key]");
  const XS = Array.from({ length: 11 }, (_, i) => -2.5 + i * 0.5);
  const target = (x) => 3 * x * x - 3;
  const f = (x) => x ** 3 - 3 * x;
  const TOL = 1.5, Y0 = -6, Y1 = 16;
  let ys = XS.map(() => 0), showF = true, showBand = false;

  svg.replaceChildren();
  const fr = frame(svg, { box: [40, 10, 590, 270], x: [-2.75, 2.75], y: [Y0, Y1], xticks: [-2, -1, 0, 1, 2], yticks: [-5, 0, 5, 10, 15], xfmt: (v) => num(v, 0), yfmt: (v) => num(v, 0) });
  el("line", { x1: fr.sx(-2.75), x2: fr.sx(2.75), y1: fr.sy(0), y2: fr.sy(0), style: "stroke:var(--foreground);stroke-opacity:0.35" }, svg);
  const clip = el("clipPath", { id: "assess-sketch-clip" }, el("defs", {}, svg));
  el("rect", { x: fr.sx(-2.75), y: fr.sy(Y1), width: fr.sx(2.75) - fr.sx(-2.75), height: fr.sy(Y0) - fr.sy(Y1) }, clip);
  const layer = el("g", { "clip-path": "url(#assess-sketch-clip)" }, svg);
  const handles = el("g", {}, svg);

  const dots = XS.map((x, i) => {
    const c = el("circle", { r: 5.5, tabindex: 0, role: "slider", "aria-valuemin": Y0, "aria-valuemax": Y1, class: "cursor-ns-resize outline-none [&:focus-visible]:stroke-[3px]", style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, handles);
    c.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 1 : 0.25;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); set(i, ys[i] + (e.key === "ArrowUp" ? step : -step)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); dots[i - 1]?.focus(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); dots[i + 1]?.focus(); }
    });
    return c;
  });
  const clamp = (y) => Math.max(Y0, Math.min(Y1, y));
  function set(i, y) { ys[i] = Math.round(clamp(y) * 4) / 4; root.querySelector("[data-assess-feedback]").replaceChildren(); draw(); }

  // Learner curve between points: linear.
  const at = (x) => {
    const t = (x + 2.5) / 0.5, i = Math.min(9, Math.max(0, Math.floor(t))), u = t - i;
    return ys[i] * (1 - u) + ys[i + 1] * u;
  };

  function draw() {
    layer.replaceChildren();
    const S = Array.from({ length: 221 }, (_, i) => -2.75 + (5.5 * i) / 220);
    if (showF) polyline(layer, S.map((x) => [fr.sx(x), fr.sy(f(x))]), "stroke:var(--muted-foreground);stroke-width:1.5;stroke-dasharray:5 4");
    if (showBand) {
      const up = S.map((x) => [fr.sx(x), fr.sy(target(x) + TOL)]), dn = S.map((x) => [fr.sx(x), fr.sy(target(x) - TOL)]).reverse();
      el("polygon", { points: [...up, ...dn].map((p) => p.join(",")).join(" "), style: "fill:var(--foreground);fill-opacity:0.07" }, layer);
      polyline(layer, S.map((x) => [fr.sx(x), fr.sy(target(x))]), "stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.5");
    }
    polyline(layer, XS.map((x, i) => [fr.sx(x), fr.sy(ys[i])]), "stroke:var(--brand);stroke-width:2.25;stroke-linejoin:round");
    dots.forEach((c, i) => {
      c.setAttribute("cx", fr.sx(XS[i]));
      c.setAttribute("cy", fr.sy(ys[i]));
      c.setAttribute("aria-valuenow", ys[i]);
      c.setAttribute("aria-valuetext", `at x = ${num(XS[i], 1)}, y = ${num(ys[i], 2)}`);
      c.setAttribute("aria-label", `Point at x = ${num(XS[i], 1)}`);
    });
    key.hidden = !showBand;
  }

  // Drawing: every point the pointer sweeps past takes the pointer's height.
  const toData = (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [(p.x - fr.sx(-2.75)) / (fr.sx(2.75) - fr.sx(-2.75)) * 5.5 - 2.75, Y0 + (fr.sy(Y0) - p.y) / (fr.sy(Y0) - fr.sy(Y1)) * (Y1 - Y0)];
  };
  let last = null;
  function paintTo(x, y) {
    const [x0, y0] = last ?? [x, y];
    XS.forEach((xi, i) => {
      const lo = Math.min(x0, x) - 0.25, hi = Math.max(x0, x) + 0.25;
      if (xi < lo || xi > hi) return;
      const u = x === x0 ? 1 : Math.max(0, Math.min(1, (xi - x0) / (x - x0)));
      ys[i] = Math.round(clamp(y0 + (y - y0) * u) * 4) / 4;
    });
    last = [x, y];
    draw();
  }
  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture(e.pointerId);
    last = null;
    root.querySelector("[data-assess-feedback]").replaceChildren();
    paintTo(...toData(e));
  });
  svg.addEventListener("pointermove", (e) => { if (svg.hasPointerCapture(e.pointerId)) paintTo(...toData(e)); });
  svg.addEventListener("pointerup", () => (last = null));
  root.querySelector('[data-toggle="f"]')?.addEventListener("shadcn:checked-change", (e) => { showF = e.detail.checked; draw(); });

  exercise(root, {
    check() {
      if (ys.every((y) => y === 0)) return { state: "info", title: "Sketch something first.", body: "Drag across the axes, or move the points with the arrow keys." };
      const S = Array.from({ length: 101 }, (_, i) => -2.5 + (5 * i) / 100);
      const inside = S.filter((x) => Math.abs(at(x) - target(x)) <= TOL).length / S.length;
      // Features: zeros near ±1, negative at 0, lowest point near 0.
      const crossNear = (x0) => S.some((x, i) => i && Math.abs(x - x0) <= 0.4 && Math.sign(at(S[i - 1])) !== Math.sign(at(x)));
      const minAt = XS[ys.indexOf(Math.min(...ys))];
      const feats = [
        [crossNear(-1), "crosses zero near x = −1, where f peaks"],
        [crossNear(1), "crosses zero near x = 1, where f bottoms out"],
        [at(0) < 0, "is negative between them, where f falls"],
        [Math.abs(minAt) <= 0.5, "is lowest at x = 0, where f falls fastest"],
        [ys[0] > 5 && ys[10] > 5, "is large at both ends, where f is steep"],
      ];
      showBand = true;
      draw();
      const body = feats.map(([ok, s]) => `${ok ? "✓" : "✗"} f′ ${s}`);
      const pct = Math.round(inside * 100);
      if (inside >= 0.85) return { state: "right", title: `Good sketch: ${pct}% of it is inside the band.`, body };
      return { state: inside >= 0.5 ? "partial" : "wrong", title: `${pct}% of your sketch is inside the ±${TOL} band (85% passes).`, body, shake: svg.parentElement };
    },
    reveal() { ys = XS.map(target); showBand = true; draw(); },
    reset() { ys = XS.map(() => 0); showBand = false; draw(); },
  });
  draw();
}

// ============================================================ hotspot

const A = [[2, 1], [1, 2]];
const VECS = [
  { v: [1, 1] },
  { v: [1, 0] },
  { v: [-1, 2] },
  { v: [1, -1] },
  { v: [0, 1] },
];
const mul = ([x, y]) => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y];
const isEigen = (v) => { const w = mul(v); return Math.abs(v[0] * w[1] - v[1] * w[0]) < 1e-9; };

for (const root of document.querySelectorAll("[data-assess-hotspot]")) {
  const svg = root.querySelector("[data-plot]");
  const picked = root.querySelector("[data-assess-picked]");
  const sel = new Set();
  let images = false;
  const name = (v) => `(${v.map((c) => num(c, 0)).join(", ")})`;
  const S = (x, y) => [x, -y];

  svg.replaceChildren();
  const grid = el("g", { style: "stroke:currentColor;stroke-opacity:0.08;stroke-width:0.02" }, svg);
  for (let k = -3; k <= 3; k++) { el("line", { x1: k, x2: k, y1: -3.4, y2: 3.4 }, grid); el("line", { x1: -3.4, x2: 3.4, y1: k, y2: k }, grid); }
  el("line", { x1: -3.4, x2: 3.4, y1: 0, y2: 0, style: "stroke:currentColor;stroke-opacity:0.3;stroke-width:0.025" }, svg);
  el("line", { x1: 0, x2: 0, y1: -3.4, y2: 3.4, style: "stroke:currentColor;stroke-opacity:0.3;stroke-width:0.025" }, svg);
  const imgLayer = el("g", {}, svg);
  const arrow = (g, v, style, head = true) => {
    const [x, y] = S(...v), len = Math.hypot(x, y), ux = x / len, uy = y / len, hl = 0.26;
    el("line", { x1: 0, y1: 0, x2: x - ux * hl * 0.8, y2: y - uy * hl * 0.8, style }, g);
    if (head) el("polygon", { points: `${x},${y} ${x - ux * hl - uy * hl * 0.55},${y - uy * hl + ux * hl * 0.55} ${x - ux * hl + uy * hl * 0.55},${y - uy * hl - ux * hl * 0.55}`, style: style.replace(/stroke-dasharray:[^;]+;?/, "") + ";stroke-width:0" }, g);
  };
  const targets = VECS.map((it, i) => {
    const g = el("g", { tabindex: 0, role: "checkbox", "aria-checked": "false", "aria-label": `Vector ${name(it.v)}`, class: "group cursor-pointer outline-none" }, svg);
    const [x, y] = S(...it.v);
    // A wide invisible hit line, then a focus/selection halo, then the arrow.
    el("line", { x1: 0, y1: 0, x2: x, y2: y, style: "stroke:transparent;stroke-width:0.5;stroke-linecap:round" }, g);
    el("line", { x1: 0, y1: 0, x2: x, y2: y, "data-halo": "", class: "opacity-0 transition-opacity duration-150 group-focus-visible:opacity-100", style: "stroke:var(--ring);stroke-opacity:0.5;stroke-width:0.22;stroke-linecap:round" }, g);
    const body = el("g", { "data-body": "" }, g);
    arrow(body, it.v, "stroke:var(--foreground);fill:var(--foreground);stroke-width:0.055;stroke-linecap:round");
    // Label beside the tip: right of it, left of it, or above it.
    const [vx, vy] = it.v;
    const lx = vx > 0 ? vx + 0.16 : vx < 0 ? vx - 0.16 : 0, ly = vx === 0 ? vy + 0.22 : vy;
    const lab = el("text", { x: lx, y: -ly + 0.1, "text-anchor": vx > 0 ? "start" : vx < 0 ? "end" : "middle", class: "fill-muted-foreground font-mono", style: "font-size:0.28px" }, g);
    lab.textContent = name(it.v);
    const toggle = () => {
      sel.has(i) ? sel.delete(i) : sel.add(i);
      paint();
      root.querySelector("[data-assess-feedback]").replaceChildren();
    };
    g.addEventListener("click", toggle);
    g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
    return { g, body, lab };
  });
  function paint(marks) {
    targets.forEach((t, i) => {
      const on = sel.has(i), m = marks?.[i];
      t.g.setAttribute("aria-checked", String(on));
      const c = m === "wrong" ? "var(--code-del)" : on || m === "right" ? "var(--brand)" : "var(--foreground)";
      t.body.querySelectorAll("line,polygon").forEach((n) => n.setAttribute("style", n.tagName === "line" ? `stroke:${c};stroke-width:${on ? 0.08 : 0.055};stroke-linecap:round${m === "missed" ? ";stroke-dasharray:0.15 0.12" : ""}` : `fill:${c}`));
    });
    imgLayer.replaceChildren();
    if (images) VECS.forEach((it) => {
      const w = mul(it.v);
      arrow(imgLayer, w, `stroke:var(--muted-foreground);fill:var(--muted-foreground);stroke-width:0.04;stroke-dasharray:0.12 0.08;opacity:0.8`);
    });
    picked.textContent = sel.size ? `Picked: ${[...sel].sort().map((i) => name(VECS[i].v)).join(", ")}` : "Picked: none";
    // The images, as text: the dashed arrows are not labelled in the picture.
    if (images) picked.append(mk("span", "mt-1 block", `A·v (dashed): ${VECS.map((it) => `${name(it.v)} → ${name(mul(it.v))}`).join(" · ")}`));
  }
  exercise(root, {
    check() {
      if (!sel.size) return { state: "info", title: "Pick at least one vector." };
      const marks = VECS.map((it, i) => (sel.has(i) ? (isEigen(it.v) ? "right" : "wrong") : isEigen(it.v) ? "missed" : null));
      paint(marks);
      const wrong = VECS.filter((it, i) => marks[i] === "wrong").map((it) => `A sends ${name(it.v)} to ${name(mul(it.v))}: the direction changes.`);
      const missed = marks.filter((m) => m === "missed").length;
      if (!wrong.length && !missed) return { state: "right", title: "Both eigenvectors.", body: ["A(1, 1) = (3, 3): stretched by λ = 3.", "A(1, −1) = (1, −1): left alone, λ = 1."] };
      return { state: marks.includes("right") ? "partial" : "wrong", title: wrong.length ? "Some picks change direction." : `${missed} eigenvector still to find (dashed).`, body: [...wrong, missed && wrong.length ? `${missed} eigenvector missed (dashed).` : ""], shake: svg.parentElement };
    },
    onHint() { images = true; paint(); },
    reveal() { sel.clear(); VECS.forEach((it, i) => isEigen(it.v) && sel.add(i)); images = true; paint(VECS.map((it) => (isEigen(it.v) ? "right" : null))); },
    reset() { sel.clear(); images = false; paint(); },
  });
  paint();
}

// ============================================================ BKT

for (const root of document.querySelectorAll("[data-assess-bkt]")) {
  const svg = root.querySelector("[data-plot]");
  const seqBox = root.querySelector("[data-assess-bkt-seq]");
  const said = root.querySelector("[data-assess-bkt-said]");
  const input = root.querySelector("[data-assess-input]");
  const q = root.querySelector("[data-assess-bkt-q]");
  const outs = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  const s = scrubAll(root, draw);
  let obs = [];
  let a = 7, b = 8;

  // One BKT step: Bayes on the observation, then the learning transition.
  function run() {
    const L0 = s.L0.get(), T = s.T.get(), G = s.G.get(), S = s.S.get();
    const Ls = [L0], posts = [];
    let L = L0;
    for (const right of obs) {
      const post = right ? (L * (1 - S)) / (L * (1 - S) + (1 - L) * G) : (L * S) / (L * S + (1 - L) * (1 - G));
      posts.push(post);
      L = post + (1 - post) * T;
      Ls.push(L);
    }
    return { Ls, posts };
  }
  function draw() {
    const { Ls, posts } = run();
    const n = Math.max(10, obs.length);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 580, 232], x: [0, n], y: [0, 1], xticks: Array.from({ length: 6 }, (_, i) => Math.round((n * i) / 5)), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => v.toFixed(2), xlabel: "answers", ylabel: "P(learned)" });
    el("line", { x1: f.sx(0), x2: f.sx(n), y1: f.sy(0.95), y2: f.sy(0.95), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:4 4" }, svg);
    text(svg, f.sx(n) - 4, f.sy(0.95) - 5, "mastery 0.95", { "text-anchor": "end", style: "fill:var(--brand)" });
    // Posterior (after Bayes) as small marks, L after learning as the line.
    polyline(svg, Ls.map((L, i) => [f.sx(i), f.sy(L)]), "stroke:var(--foreground);stroke-width:2");
    posts.forEach((p, i) => el("circle", { cx: f.sx(i + 1), cy: f.sy(p), r: 3, style: `fill:${obs[i] ? "var(--brand)" : "var(--code-del)"}` }, svg));
    Ls.forEach((L, i) => el("circle", { cx: f.sx(i), cy: f.sy(L), r: 2, style: "fill:var(--foreground)" }, svg));
    const now = Ls[Ls.length - 1];
    outs.now.textContent = now.toFixed(4);
    outs.post.textContent = posts.length ? posts[posts.length - 1].toFixed(4) : "—";
    outs.n.textContent = `${obs.length} (${obs.filter(Boolean).length} right)`;
    const first = Ls.findIndex((L) => L >= 0.95);
    outs.mastery.textContent = first >= 0 ? `reached after answer ${first}` : "not yet";
    seqBox.replaceChildren(...obs.map((r, i) => {
      const c = mk("span", `flex size-5 items-center justify-center rounded-full border font-mono text-[10px] ${r ? "border-brand bg-brand/10 text-brand" : "border-del bg-del/10 text-del"}`, r ? "✓" : "✗");
      c.setAttribute("aria-label", `answer ${i + 1}: ${r ? "right" : "wrong"}`);
      return c;
    }));
  }
  function log(right) { obs.push(right); draw(); }
  function nextItem() {
    const r = Math.random;
    a = 3 + Math.floor(r() * 7); b = 3 + Math.floor(r() * 7);
    q.textContent = `${a} × ${b} =`;
    input.value = "";
  }
  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-assess-bkt-act]")?.dataset.assessBktAct;
    if (act === "right" || act === "wrong") log(act === "right");
    if (act === "reset") { obs = []; said.textContent = ""; draw(); }
    if (act === "answer") answer();
  });
  function answer() {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    const ok = Number(v) === a * b;
    said.textContent = ok ? `${a} × ${b} = ${a * b}: right, logged.` : `${a} × ${b} = ${a * b}, not ${v}: logged as wrong.`;
    log(ok);
    nextItem();
    input.focus();
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); answer(); } });
  draw();
}
