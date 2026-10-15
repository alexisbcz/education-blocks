// Topology blocks drawn in SVG: homeomorphic letters, gluing a square,
// knot tricolouring, Borsuk–Ulam on a ring, open sets in three metrics and
// Brouwer's fixed point. Every count shown is computed here from the object
// on screen. (The 3D drawings are in topology-3d.js, persistent homology in
// topology-ph.js.)

import { el, line, polygon, handle } from "./svg.js";
import { frame, polyline, text } from "./plot.js";
import { scrubAll } from "./scrub.js";
import { reduced, outs, onToggle, isOn, mulberry32, num, signed } from "./topology-util.js";

// ============================================================ letters

{
  // Glyph skeletons on a 4 × 6 box, y down. Strokes meet only at shared
  // vertices, so the wire graph is read straight from the coordinates.
  const arc = (cx, cy, rx, ry, a0, a1, step = 10) => {
    const pts = [], n = Math.max(2, Math.round(Math.abs(a1 - a0) / step));
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      pts.push([cx + rx * Math.cos(a), cy - ry * Math.sin(a)]);
    }
    return pts;
  };
  const oval = arc(2, 3, 2, 3, 0, 360);
  const qTail = oval.find((p, i) => i === 31); // the point at 310°
  const G = {
    A: [[[0, 6], [1, 3], [2, 0], [3, 3], [4, 6]], [[1, 3], [3, 3]]],
    B: [[[0, 6], [0, 3], [0, 0]], [[0, 0], ...arc(2.6, 1.5, 1.4, 1.5, 90, -90), [0, 3]], [[0, 3], ...arc(2.8, 4.5, 1.2, 1.5, 90, -90), [0, 6]]],
    C: [arc(2.2, 3, 2, 3, 50, 310)],
    D: [[[0, 0], [0, 6]], [[0, 0], ...arc(1.8, 3, 2.2, 3, 90, -90), [0, 6]]],
    E: [[[4, 0], [0, 0], [0, 3], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
    F: [[[4, 0], [0, 0], [0, 3], [0, 6]], [[0, 3], [3, 3]]],
    G: [[...arc(2.2, 3, 2, 3, 40, 360), [2.4, 3]]],
    H: [[[0, 0], [0, 3], [0, 6]], [[4, 0], [4, 3], [4, 6]], [[0, 3], [4, 3]]],
    I: [[[2, 0], [2, 6]]],
    J: [[[3, 0], ...arc(1.5, 4.5, 1.5, 1.5, 0, -170)]],
    K: [[[0, 0], [0, 4], [0, 6]], [[4, 0], [1.6, 2.4], [0, 4]], [[1.6, 2.4], [4, 6]]],
    L: [[[0, 0], [0, 6], [4, 6]]],
    M: [[[0, 6], [0, 0], [2, 4], [4, 0], [4, 6]]],
    N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
    O: [oval],
    P: [[[0, 6], [0, 3.4], [0, 0]], [[0, 0], ...arc(2.4, 1.7, 1.6, 1.7, 90, -90), [0, 3.4]]],
    Q: [oval, [qTail, [4.2, 6.3]]],
    R: [[[0, 6], [0, 3.4], [0, 0]], [[0, 0], ...arc(2.4, 1.7, 1.6, 1.7, 90, -90), [0, 3.4]], [[2.4, 3.4], [4, 6]]],
    S: [[...arc(2, 1.5, 1.9, 1.5, 30, 270), ...arc(2, 4.5, 1.9, 1.5, 90, -150).slice(1)]],
    T: [[[0, 0], [2, 0], [4, 0]], [[2, 0], [2, 6]]],
    U: [[[0, 0], ...arc(2, 4, 2, 2, 180, 360), [4, 0]]],
    V: [[[0, 0], [2, 6], [4, 0]]],
    W: [[[0, 0], [1, 6], [2, 2], [3, 6], [4, 0]]],
    X: [[[0, 0], [2, 3], [4, 6]], [[4, 0], [2, 3], [0, 6]]],
    Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
    Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  };

  // The wire graph of a glyph and its invariants.
  function graphOf(strokes) {
    const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    const ids = new Map(), pos = [], edges = [];
    const id = (p) => {
      const k = key(p);
      if (!ids.has(k)) { ids.set(k, pos.length); pos.push(p); }
      return ids.get(k);
    };
    for (const s of strokes) {
      for (let i = 1; i < s.length; i++) {
        const a = id(s[i - 1]), b = id(s[i]);
        if (a !== b) edges.push([a, b]);
      }
    }
    const V = pos.length, inc = Array.from({ length: V }, () => []);
    edges.forEach(([a, b], e) => { inc[a].push(e); inc[b].push(e); });
    const deg = inc.map((l) => l.length);
    const parent = [...Array(V).keys()];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const [a, b] of edges) parent[find(a)] = find(b);
    const comps = new Set(pos.map((_, i) => find(i))).size;
    // Smooth away degree-2 vertices: the reduced multigraph is what a
    // homeomorphism preserves.
    const ess = pos.map((_, i) => i).filter((i) => deg[i] !== 2);
    const used = new Set(), red = [];
    for (const u of ess) {
      for (const e0 of inc[u]) {
        if (used.has(e0)) continue;
        used.add(e0);
        let e = e0, cur = edges[e0][0] === u ? edges[e0][1] : edges[e0][0];
        while (deg[cur] === 2) {
          e = inc[cur][0] === e ? inc[cur][1] : inc[cur][0];
          used.add(e);
          cur = edges[e][0] === cur ? edges[e][1] : edges[e][0];
        }
        red.push([u, cur]);
      }
    }
    // Components with no essential vertex are plain circles.
    const essRoots = new Set(ess.map(find));
    const circles = new Set(pos.map((_, i) => find(i)).filter((r) => !essRoots.has(r))).size;
    // Canonical form: the smallest adjacency string over all orderings.
    const n = ess.length, at = new Map(ess.map((v, i) => [v, i]));
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    for (const [a, b] of red) { A[at.get(a)][at.get(b)]++; if (a !== b) A[at.get(b)][at.get(a)]++; }
    let best = null;
    const perm = [], seen = Array(n).fill(false);
    (function go() {
      if (perm.length === n) {
        const s = perm.map((i) => perm.map((j) => A[i][j]).join(".")).join("|");
        if (best === null || s < best) best = s;
        return;
      }
      for (let i = 0; i < n; i++) if (!seen[i]) { seen[i] = true; perm.push(i); go(); perm.pop(); seen[i] = false; }
    })();
    return {
      pos, deg, holes: edges.length - V + comps,
      ends: pos.filter((_, i) => deg[i] === 1),
      branch: pos.map((p, i) => [p, deg[i]]).filter(([, d]) => d >= 3),
      canon: `${best ?? ""}#${circles}`,
    };
  }

  for (const root of document.querySelectorAll("[data-topo-letters]")) {
    const svg = root.querySelector("[data-plot]");
    const o = outs(root);
    const letters = Object.keys(G);
    const info = Object.fromEntries(letters.map((L) => [L, graphOf(G[L])]));
    const classes = [];
    for (const L of letters) {
      let c = classes.find((k) => k.canon === info[L].canon);
      if (!c) classes.push((c = { canon: info[L].canon, letters: [] }));
      c.letters.push(L);
    }
    classes.sort((a, b) => b.letters.length - a.letters.length);
    const classOf = (L) => classes.find((c) => c.letters.includes(L));
    let selected = "A", mode = "alphabet";
    const S = 7; // px per glyph unit
    const labels = el("g", { style: "transition:opacity 240ms var(--ease-out);opacity:0" }, svg);
    const nodes = {};
    for (const L of letters) {
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `Letter ${L}`, class: "cursor-pointer outline-none", style: "transition:transform 420ms var(--ease-in-out), opacity 200ms var(--ease-out)" }, svg);
      el("rect", { x: -10, y: -10, width: 4 * S + 20, height: 6 * S + 20, rx: 8, style: "fill:transparent", "data-focus": "" }, g);
      const wires = el("g", { style: "fill:none;stroke-width:3px;stroke-linecap:round;stroke-linejoin:round" }, g);
      for (const s of G[L]) el("path", { d: "M" + s.map((p) => `${(p[0] * S).toFixed(1)},${(p[1] * S).toFixed(1)}`).join(" L") }, wires);
      const marks = el("g", {}, g);
      for (const p of info[L].ends) el("circle", { cx: p[0] * S, cy: p[1] * S, r: 3, style: "fill:var(--code-bg);stroke:var(--muted-foreground);stroke-width:1.5px" }, marks);
      for (const [p] of info[L].branch) el("circle", { cx: p[0] * S, cy: p[1] * S, r: 3.5, style: "fill:var(--brand)" }, marks);
      g.addEventListener("click", () => select(L));
      g.addEventListener("focus", () => select(L));
      g.addEventListener("keydown", (e) => {
        const i = letters.indexOf(L);
        const j = { ArrowRight: i + 1, ArrowLeft: i - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        nodes[letters[(j + letters.length) % letters.length]].g.focus();
      });
      nodes[L] = { g, wires, marks };
    }

    function layout() {
      labels.replaceChildren();
      if (mode === "alphabet") {
        const cell = 52, x0 = (720 - 13 * cell) / 2 + (cell - 4 * S) / 2;
        letters.forEach((L, i) => {
          const x = x0 + (i % 13) * cell, y = i < 13 ? 64 : 200;
          nodes[L].g.style.transform = `translate(${x}px, ${y}px)`;
        });
        labels.style.opacity = 0;
        return;
      }
      // By class: groups flow left to right and wrap.
      const cell = 42, gap = 24, W = 712;
      let x = 10, y = 40;
      for (const c of classes) {
        const w = c.letters.length * cell;
        if (x + w > W) { x = 10; y += 140; }
        c.letters.forEach((L, i) => { nodes[L].g.style.transform = `translate(${x + i * cell + 4}px, ${y}px)`; });
        const g = info[c.letters[0]];
        text(labels, x + 4, y + 6 * S + 26, `${g.ends.length} end${g.ends.length === 1 ? "" : "s"}`);
        text(labels, x + 4, y + 6 * S + 38, `${g.holes} hole${g.holes === 1 ? "" : "s"}`);
        el("line", { x1: x + 4, x2: x + w - 10, y1: y + 6 * S + 12, y2: y + 6 * S + 12, style: "stroke:currentColor;stroke-opacity:0.25" }, labels);
        x += w + gap;
      }
      labels.style.opacity = 1;
    }

    function select(L) {
      selected = L;
      const c = classOf(L);
      for (const k of letters) {
        const n = nodes[k], mine = k === L, mate = c.letters.includes(k);
        n.wires.style.stroke = mine ? "var(--brand)" : "currentColor";
        n.g.style.opacity = mine || mate ? 1 : 0.3;
        n.g.setAttribute("aria-pressed", String(mine));
      }
      const g = info[L];
      o.letter.textContent = L;
      o.ends.textContent = String(g.ends.length);
      o.branch.textContent = g.branch.length ? `${g.branch.length} (degree ${g.branch.map(([, d]) => d).join(", ")})` : "0";
      o.holes.textContent = String(g.holes);
      o.class.textContent = c.letters.length > 1 ? c.letters.filter((k) => k !== L).join(" ") : "no other letter";
      o.count.textContent = `${classes.length} for 26 letters`;
    }

    const showMarks = () => { for (const L of letters) nodes[L].marks.style.display = isOn(root, "skeleton") ? "" : "none"; };
    root.addEventListener("seg-change", (e) => { mode = e.detail.value; layout(); });
    onToggle(root, showMarks);
    layout();
    showMarks();
    select(selected);
  }
}

// ============================================================ gluing

for (const root of document.querySelectorAll("[data-topo-gluing]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  // Sides in counter-clockwise order: bottom, right, top, left; each gets a
  // letter and an exponent from the edge word.
  const WORDS = {
    torus: { name: "torus", w: [["a", 1], ["b", 1], ["a", -1], ["b", -1]] },
    klein: { name: "Klein bottle", w: [["a", 1], ["b", 1], ["a", 1], ["b", -1]] },
    rp2: { name: "projective plane", w: [["a", 1], ["b", 1], ["a", 1], ["b", 1]] },
    sphere: { name: "sphere", w: [["a", 1], ["b", 1], ["b", -1], ["a", -1]] },
  };
  const TAU = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const NRM = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const CORNER = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const at = (k, t) => [CORNER[k][0] + TAU[k][0] * t, CORNER[k][1] + TAU[k][1] * t];
  const paramOf = (k, p) => [p[0], p[1], 1 - p[0], 1 - p[1]][k];
  const X = (p) => 50 + 300 * p[0], Y = (p) => 350 - 300 * p[1];
  const d2 = (a, b) => a[0] * b[0] + a[1] * b[1];

  let word = WORDS.torus, playing = !reduced(), visible = false, raf = 0, last = 0, clock = 0;
  let walker, trail, crossings, flips;
  const reset = () => {
    walker = { p: [0.32, 0.38], f: [Math.cos(0.5), Math.sin(0.5)], l: [-Math.sin(0.5), Math.cos(0.5)] };
    trail = [[walker.p.slice()]];
    crossings = 0; flips = 0;
  };
  reset();

  function topology() {
    const parent = [0, 1, 2, 3];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const ends = (k) => (word.w[k][1] === 1 ? [k, (k + 1) % 4] : [(k + 1) % 4, k]);
    for (const L of ["a", "b"]) {
      const [s1, s2] = [0, 1, 2, 3].filter((k) => word.w[k][0] === L);
      const [a1, b1] = ends(s1), [a2, b2] = ends(s2);
      parent[find(a1)] = find(a2);
      parent[find(b1)] = find(b2);
    }
    const cls = [0, 1, 2, 3].map(find);
    const V = new Set(cls).size;
    const orientable = ["a", "b"].every((L) => word.w.filter(([l]) => l === L).reduce((s, [, e]) => s + e, 0) === 0);
    return { cls, V, chi: V - 2 + 1, orientable };
  }

  function step(dt) {
    const w = walker;
    clock += dt;
    if (playing) {
      const turn = (0.9 * Math.sin(0.7 * clock) + 0.5 * Math.sin(1.9 * clock + 1)) * dt;
      rotate(turn);
      move(0.16 * dt);
    }
    return w;
  }
  function rotate(a) {
    const { f, l } = walker, c = Math.cos(a), s = Math.sin(a);
    walker.f = [c * f[0] + s * l[0], c * f[1] + s * l[1]];
    walker.l = [c * l[0] - s * f[0], c * l[1] - s * f[1]];
  }
  function move(dist) {
    const w = walker;
    w.p = [w.p[0] + w.f[0] * dist, w.p[1] + w.f[1] * dist];
    for (let guard = 0; guard < 3; guard++) {
      const over = [-w.p[1], w.p[0] - 1, w.p[1] - 1, -w.p[0]];
      const k = over.indexOf(Math.max(...over));
      if (over[k] <= 0) break;
      const [L, e] = word.w[k];
      const k2 = [0, 1, 2, 3].find((j) => j !== k && word.w[j][0] === L);
      const sigma = e * word.w[k2][1];
      const t = Math.min(1, Math.max(0, paramOf(k, w.p)));
      const t2 = sigma === 1 ? t : 1 - t;
      const q = at(k2, t2);
      w.p = [q[0] - NRM[k2][0] * over[k], q[1] - NRM[k2][1] * over[k]];
      const map = (v) => {
        const a = d2(v, TAU[k]), b = d2(v, NRM[k]);
        return [sigma * a * TAU[k2][0] - b * NRM[k2][0], sigma * a * TAU[k2][1] - b * NRM[k2][1]];
      };
      w.f = map(w.f); w.l = map(w.l);
      crossings++;
      if (sigma === 1) flips++;
      trail.push([]);
    }
    trail.at(-1).push(w.p.slice());
    let total = trail.reduce((s, t) => s + t.length, 0);
    while (total > 700 && trail.length > 1) { total -= trail.shift().length; }
    if (total > 700) trail[0].splice(0, total - 700);
  }

  const scene = el("g", {}, svg);
  function draw() {
    scene.replaceChildren();
    const T = topology();
    el("rect", { x: 50, y: 50, width: 300, height: 300, style: "fill:var(--background);stroke:none" }, scene);
    // Trail, older segments fainter.
    trail.forEach((seg, i) => {
      if (seg.length < 2) return;
      polyline(scene, seg.map((p) => [X(p), Y(p)]), `stroke:var(--brand);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:${(0.25 + (0.6 * (i + 1)) / trail.length).toFixed(2)}`);
    });
    // Sides with their arrows: one chevron for a, two for b.
    word.w.forEach(([L, e], k) => {
      const a = CORNER[k], b = CORNER[(k + 1) % 4];
      const color = L === "a" ? "var(--vec-u)" : "var(--vec-v)";
      el("line", { x1: X(a), y1: Y(a), x2: X(b), y2: Y(b), style: `stroke:${color};stroke-width:2.5px;stroke-linecap:round` }, scene);
      const dir = [TAU[k][0] * e, TAU[k][1] * e];
      const heads = L === "a" ? [0] : [-0.035, 0.035];
      for (const off of heads) {
        const m = at(k, 0.5 + off * e);
        const tip = [X(m) + dir[0] * 9, Y(m) - dir[1] * 9];
        const side = [-dir[1], dir[0]];
        const p1 = [X(m) - dir[0] * 3 + side[0] * 7, Y(m) + dir[1] * 3 - side[1] * 7];
        const p2 = [X(m) - dir[0] * 3 - side[0] * 7, Y(m) + dir[1] * 3 + side[1] * 7];
        el("path", { d: `M${p1} L${tip} L${p2}`, style: `fill:none;stroke:${color};stroke-width:2.5px;stroke-linecap:round;stroke-linejoin:round` }, scene);
      }
      const lp = at(k, 0.5);
      text(scene, X(lp) + NRM[k][0] * 22, Y(lp) - NRM[k][1] * 22 + 4, e === 1 ? L : `${L}⁻¹`, { "text-anchor": "middle", style: `fill:${color};font-size:13px` });
    });
    // Corners coloured by the point they are glued into.
    const cols = ["var(--brand)", "var(--foreground)", "var(--muted-foreground)", "var(--code-add)"];
    const roots = [...new Set(T.cls)];
    CORNER.forEach((c, i) => el("circle", { cx: X(c), cy: Y(c), r: 6, style: `fill:${cols[roots.indexOf(T.cls[i])]};stroke:var(--background);stroke-width:2px` }, scene));
    // The walker: an arrow with a flag on its left.
    const w = walker, P = (u, v) => [X(w.p) + 300 * (w.f[0] * u + w.l[0] * v), Y(w.p) - 300 * (w.f[1] * u + w.l[1] * v)];
    el("path", { d: `M${P(0.045, 0)} L${P(-0.03, 0.025)} L${P(-0.015, 0)} L${P(-0.03, -0.025)} Z`, style: "fill:var(--foreground);stroke:var(--foreground);stroke-width:1px;stroke-linejoin:round" }, scene);
    el("path", { d: `M${P(-0.01, 0.006)} L${P(-0.01, 0.06)} L${P(0.025, 0.05)} L${P(0.005, 0.035)} Z`, style: "fill:var(--brand)" }, scene);
    const mirrored = w.f[0] * w.l[1] - w.f[1] * w.l[0] < 0;
    o.name.textContent = word.name;
    o.vef.textContent = `${T.V}, 2, 1`;
    o.chi.textContent = `${T.V} − 2 + 1 = ${String(T.chi)}`;
    o.orient.textContent = T.orientable ? "yes" : "no";
    o.hand.textContent = mirrored ? "mirrored (flag on its right)" : "as drawn (flag on its left)";
    o.cross.textContent = `${crossings}, ${flips} reversing`;
  }

  const setLabel = () => {
    btn.querySelector("[data-label]").textContent = playing ? "Pause" : "Walk";
    btn.querySelector("[data-icon=play]").toggleAttribute("hidden", playing);
    btn.querySelector("[data-icon=pause]").toggleAttribute("hidden", !playing);
  };
  const tick = (t) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    step(dt);
    draw();
    if (playing && visible) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && playing && visible) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(svg);
  btn.addEventListener("click", () => { playing = !playing; setLabel(); kick(); });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { trail = [[walker.p.slice()]]; draw(); });
  root.addEventListener("seg-change", (e) => { word = WORDS[e.detail.value]; reset(); draw(); });
  svg.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: 0 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    if (k) rotate(k * 0.25);
    else move(0.04);
    if (!playing) move(0.02);
    draw();
  });
  setLabel();
  draw();
}

// ============================================================ knots

for (const root of document.querySelectorAll("[data-topo-knots]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const COLORS = ["var(--vec-u)", "var(--vec-v)", "var(--brand)"];
  const torus = (p, q) => (t) => [(1.9 + 0.95 * Math.cos(q * t)) * Math.cos(p * t), (1.9 + 0.95 * Math.cos(q * t)) * Math.sin(p * t), Math.sin(q * t)];
  const KNOTS = {
    trefoil: torus(2, 3),
    unknot: torus(3, 1),
    eight: (t) => [(1.9 + 0.95 * Math.cos(2 * t)) * Math.cos(3 * t), (1.9 + 0.95 * Math.cos(2 * t)) * Math.sin(3 * t), Math.sin(4 * t)],
    cinque: torus(2, 5),
  };
  let brush = 0, K = null, colour = [];

  function analyse(curve) {
    const N = 900, pts = [];
    for (let i = 0; i < N; i++) pts.push(curve((2 * Math.PI * i) / N));
    const at = (s) => {
      const i = Math.floor(s) % N, f = s - Math.floor(s), a = pts[i], b = pts[(i + 1) % N];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
    const X = [];
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[(i + 1) % N];
      for (let j = i + 2; j < N; j++) {
        if (i === 0 && j === N - 1) continue;
        const c = pts[j], d = pts[(j + 1) % N];
        const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
        if (Math.abs(den) < 1e-12) continue;
        const u = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
        const v = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const si = i + u, sj = j + v;
        const over = at(si)[2] > at(sj)[2] ? si : sj;
        X.push({ over, under: over === si ? sj : si, xy: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u] });
      }
    }
    const U = X.map((c) => c.under).sort((a, b) => a - b);
    const arcOf = (s) => {
      if (!U.length) return 0;
      s = ((s % N) + N) % N;
      for (let k = U.length - 1; k >= 0; k--) if (s >= U[k]) return k;
      return U.length - 1;
    };
    for (const c of X) { c.o = arcOf(c.over); c.in = arcOf(c.under - 0.01); c.out = arcOf(c.under + 0.01); }
    const arcs = (U.length ? U : [0]).map((s, k, arr) => {
      const e = U.length ? (k + 1 < arr.length ? arr[k + 1] : arr[0] + N) : N;
      const gap = U.length ? 7 : 0, line = [];
      for (let t = s + gap; t <= e - gap; t += 1) line.push(at(t));
      line.push(at(e - gap));
      return line;
    });
    return { arcs, X, N };
  }

  const ok = (c, col) => {
    const a = col[c.o], b = col[c.in], d = col[c.out];
    if (a < 0 || b < 0 || d < 0) return null;
    return (a === b && b === d) || (a !== b && b !== d && a !== d);
  };
  function count() {
    const n = K.arcs.length, col = Array(n).fill(0);
    let valid = 0, multi = null;
    for (let m = 0; m < 3 ** n; m++) {
      let x = m;
      for (let i = 0; i < n; i++) { col[i] = x % 3; x = Math.floor(x / 3); }
      if (K.X.every((c) => ok(c, col))) {
        valid++;
        if (!multi && new Set(col).size > 1) multi = col.slice();
      }
    }
    return { valid, multi };
  }

  const scene = el("g", {}, svg);
  let census = null;
  function build(name) {
    K = analyse(KNOTS[name]);
    colour = Array(K.arcs.length).fill(-1);
    census = count();
    draw();
  }
  function draw() {
    scene.replaceChildren();
    K.arcs.forEach((pts, k) => {
      const d = "M" + pts.map((p) => `${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`).join(" L");
      el("path", { d, style: "fill:none;stroke:var(--code-bg);stroke-width:0.3;stroke-linecap:round;stroke-linejoin:round" }, scene);
      const vis = el("path", { d, style: `fill:none;stroke:${colour[k] < 0 ? "currentColor" : COLORS[colour[k]]};stroke-opacity:${colour[k] < 0 ? 0.45 : 1};stroke-width:0.13;stroke-linecap:round;stroke-linejoin:round;transition:stroke 200ms var(--ease-out)` }, scene);
      const hit = el("path", { d, tabindex: 0, role: "button", "aria-label": `Arc ${k + 1}, ${colour[k] < 0 ? "uncoloured" : ["first", "second", "third"][colour[k]] + " colour"}`, class: "cursor-pointer outline-none", style: "fill:none;stroke:transparent;stroke-width:0.5;pointer-events:stroke" }, scene);
      const paint = () => { colour[k] = colour[k] === brush ? -1 : brush; draw(); scene.querySelectorAll("[role=button]")[k]?.focus(); };
      hit.addEventListener("click", paint);
      hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); paint(); } });
      hit.addEventListener("focus", () => vis.style.strokeWidth = "0.2");
      hit.addEventListener("blur", () => vis.style.strokeWidth = "0.13");
    });
    let good = 0, bad = 0;
    for (const c of K.X) {
      const r = ok(c, colour);
      if (r === true) good++;
      if (r === false) bad++;
      if (r !== null) el("circle", { cx: c.xy[0], cy: -c.xy[1], r: 0.2, style: `fill:none;stroke:${r ? "var(--brand)" : "var(--code-del)"};stroke-width:0.05` }, scene);
    }
    const used = new Set(colour.filter((c) => c >= 0)).size, done = colour.every((c) => c >= 0);
    o.cross.textContent = String(K.X.length);
    o.arcs.textContent = String(K.arcs.length);
    o.ok.textContent = `${good} of ${K.X.length}`;
    o.used.textContent = String(used);
    o.count.textContent = `${census.valid} (${census.multi ? "tricolourable" : "only the 3 one-colour ones"})`;
    o.verdict.textContent = !done ? "colour every arc"
      : bad ? `${bad} crossing${bad > 1 ? "s" : ""} break the rule`
      : used > 1 ? "a valid tricolouring: this knot is not the unknot"
      : "valid, but with one colour only";
    o.verdict.style.color = done && !bad && used > 1 ? "var(--brand)" : bad ? "var(--code-del)" : "";
  }

  root.addEventListener("seg-change", (e) => {
    if (e.target.closest("[data-brush]")) brush = Number(e.detail.value);
    else build(e.detail.value);
  });
  root.querySelector("[data-action=clear]").addEventListener("click", () => { colour.fill(-1); draw(); });
  root.querySelector("[data-action=solve]").addEventListener("click", () => {
    if (census.multi) colour = census.multi.slice();
    else colour = Array(K.arcs.length).fill(brush);
    draw();
    if (!census.multi) o.verdict.textContent = "no tricolouring exists: one colour is the only way";
  });
  build("trefoil");
}

// ============================================================ Borsuk–Ulam

for (const root of document.querySelectorAll("[data-topo-borsuk]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let seed = 7, T;
  const weather = () => {
    const r = mulberry32(seed);
    const h = [1, 2, 3, 4].map((k) => ({ k, a: (7 / k) * (0.4 + r()), p: r() * 2 * Math.PI }));
    T = (t) => 14 + h.reduce((s, { k, a, p }) => s + a * Math.cos(k * t + p), 0);
  };
  weather();
  const g = (t) => T(t) - T(t + Math.PI);
  const rad = (d) => (d * Math.PI) / 180, degOf = (r) => (((r * 180) / Math.PI) % 360 + 360) % 360;
  const root1 = (a, b) => {
    let ga = g(a);
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2, gm = g(m);
      if (Math.sign(gm) === Math.sign(ga)) { a = m; ga = gm; } else b = m;
    }
    return (a + b) / 2;
  };
  const zeros = () => {
    const z = [], n = 1440;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n, b = (Math.PI * (i + 1)) / n;
      if (g(a) === 0) z.push(a);
      else if (Math.sign(g(a)) !== Math.sign(g(b)) && g(b) !== 0) z.push(root1(a, b));
    }
    return z;
  };
  // The probe angle is kept exactly; the field shows it rounded.
  let deg = 40;
  const s = scrubAll(root, () => { deg = s.theta.get(); draw(); });
  const setDeg = (d) => { deg = ((d % 360) + 360) % 360; s.theta.set(deg, false); draw(); };
  const scene = el("g", {}, svg);
  const C = [160, 160], R = 112;
  const ringPt = (t, r = R) => [C[0] + r * Math.cos(t), C[1] - r * Math.sin(t)];
  let anim = 0;

  function draw() {
    scene.replaceChildren();
    const th = rad(deg);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 360; i++) { const v = T(rad(i)); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    // The ring, coloured from cold to warm.
    for (let i = 0; i < 180; i++) {
      const a = rad(i * 2), b = rad(i * 2 + 2.4);
      const k = Math.round((100 * (T(a + rad(1)) - lo)) / (hi - lo));
      const [x1, y1] = ringPt(a), [x2, y2] = ringPt(b);
      el("path", { d: `M${x1},${y1} A${R},${R} 0 0 0 ${x2},${y2}`, style: `fill:none;stroke:color-mix(in oklab, var(--code-del) ${k}%, var(--vec-u));stroke-width:14px` }, scene);
    }
    const zs = zeros();
    for (const z of zs) {
      for (const t of [z, z + Math.PI]) {
        const [x, y] = ringPt(t, R + 16);
        el("circle", { cx: x, cy: y, r: 3, style: "fill:var(--brand)" }, scene);
      }
    }
    const p = ringPt(th), q = ringPt(th + Math.PI);
    el("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, scene);
    const equal = Math.abs(g(th)) < 0.01;
    for (const [pt, t] of [[p, th], [q, th + Math.PI]]) {
      el("circle", { cx: pt[0], cy: pt[1], r: 9, style: `fill:var(--background);stroke:${equal ? "var(--brand)" : "var(--foreground)"};stroke-width:2.5px` }, scene);
      const lab = ringPt(t, R - 34);
      text(scene, lab[0], lab[1] + 4, `${num(T(t), 1)}°`, { "text-anchor": "middle", style: "fill:var(--foreground);font-size:12px" });
    }

    // Right: T and its antipode, then g.
    const xt = [0, 90, 180, 270, 360];
    const f1 = frame(scene, { box: [372, 20, 330, 124], x: [0, 360], y: [Math.floor(lo - 1), Math.ceil(hi + 1)], xticks: xt, yticks: [Math.floor(lo - 1), Math.ceil(hi + 1)], xfmt: (v) => v + "°" });
    text(scene, f1.L, f1.T - 4, "T (°C)");
    const f2 = frame(scene, { box: [372, 186, 330, 104], x: [0, 360], y: [-(hi - lo), hi - lo], xticks: xt, yticks: [0], xfmt: (v) => v + "°" });
    text(scene, f2.L, f2.T - 6, "g(θ) = T(θ) − T(θ + π)");
    const series = (fn, fr) => Array.from({ length: 361 }, (_, i) => [fr.sx(i), fr.sy(fn(rad(i)))]);
    polyline(scene, series(T, f1), "stroke:var(--foreground);stroke-width:1.75");
    polyline(scene, series((t) => T(t + Math.PI), f1), "stroke:var(--muted-foreground);stroke-width:1.5;stroke-dasharray:4 3");
    el("line", { x1: f2.L, x2: f2.L + f2.W, y1: f2.sy(0), y2: f2.sy(0), style: "stroke:currentColor;stroke-opacity:0.35" }, scene);
    polyline(scene, series(g, f2), "stroke:var(--vec-u);stroke-width:1.75");
    for (const z of zs) for (const t of [z, z + Math.PI]) el("circle", { cx: f2.sx(degOf(t)), cy: f2.sy(0), r: 3.5, style: "fill:var(--brand)" }, scene);
    const d = deg;
    for (const fr of [f1, f2]) el("line", { x1: fr.sx(d), x2: fr.sx(d), y1: fr.T, y2: fr.T + fr.H, style: "stroke:var(--brand);stroke-opacity:0.6" }, scene);
    text(scene, f1.L + f1.W, f1.T - 4, "T(θ) solid · T(θ + π) dashed", { "text-anchor": "end" });

    o.t.textContent = `${num(T(th), 2)} °C`;
    o.ta.textContent = `${num(T(th + Math.PI), 2)} °C`;
    o.g.textContent = num(g(th), 3);
    o.ga.textContent = `${num(g(th + Math.PI), 3)}, always −g(θ)`;
    o.pairs.textContent = `${zs.length} pair${zs.length === 1 ? "" : "s"}${equal ? " · probe is on one" : ""}`;
  }

  // Drag the probe around the ring.
  svg.addEventListener("pointerdown", (e) => {
    const pt = svg.createSVGPoint();
    const set = (ev) => {
      pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (Math.hypot(p.x - C[0], p.y - C[1]) > R + 40) return false;
      setDeg(degOf(Math.atan2(C[1] - p.y, p.x - C[0])));
      return true;
    };
    if (!set(e)) return;
    svg.setPointerCapture(e.pointerId);
    const mv = (ev) => set(ev);
    svg.addEventListener("pointermove", mv);
    svg.addEventListener("pointerup", () => svg.removeEventListener("pointermove", mv), { once: true });
  });
  root.querySelector("[data-action=find]").addEventListener("click", () => {
    const a = rad(deg);
    const target = degOf(Math.sign(g(a)) === Math.sign(g(a + Math.PI)) ? a : root1(a, a + Math.PI));
    cancelAnimationFrame(anim);
    const from = deg;
    let to = target;
    if (to - from > 180) to -= 360;
    if (from - to > 180) to += 360;
    if (reduced()) return setDeg(target);
    const t0 = performance.now();
    const stepA = (now) => {
      const k = Math.min(1, (now - t0) / 600), e = 1 - (1 - k) ** 3;
      setDeg(k < 1 ? from + (to - from) * e : target);
      if (k < 1) anim = requestAnimationFrame(stepA);
    };
    anim = requestAnimationFrame(stepA);
  });
  root.querySelector("[data-action=new]").addEventListener("click", () => { seed = (seed * 48271) % 2147483647; weather(); draw(); });
  draw();
}

// ============================================================ open sets

for (const root of document.querySelectorAll("[data-topo-open]")) {
  const svg = root.querySelector("[data-plane]");
  const o = outs(root);
  const B = [];
  for (let i = 0; i < 1440; i++) {
    const a = (2 * Math.PI * i) / 1440, r = 1.85 + 0.38 * Math.cos(3 * a) + 0.22 * Math.sin(2 * a + 0.6);
    B.push([r * Math.cos(a) + 0.1, r * Math.sin(a)]);
  }
  const inside = (p) => {
    let c = false;
    for (let i = 0, j = B.length - 1; i < B.length; j = i++) {
      const [xi, yi] = B[i], [xj, yj] = B[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const dist = (m, a, b) => {
    const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
    return m === "1" ? dx + dy : m === "inf" ? Math.max(dx, dy) : Math.hypot(dx, dy);
  };
  const nearest = (m, p) => {
    let best = Infinity, at = B[0];
    for (const b of B) { const d = dist(m, p, b); if (d < best) { best = d; at = b; } }
    return [best, at];
  };
  let metric = "2", x = [0.4, 0.3];
  const scene = el("g", {}, svg), top = el("g", {}, svg);
  const hx = handle(svg, top, "point x", (p) => set(p));
  hx.node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const st = e.shiftKey ? 0.25 : 0.05;
    set([x[0] + d[0] * st, x[1] + d[1] * st]);
  });
  function set(p) {
    p = p.map((v) => Math.max(-2.9, Math.min(2.9, v)));
    const [d, b] = nearest("2", p);
    x = d < 0.06 ? b.slice() : p;
    draw();
  }
  function ball(m, c, r, style) {
    if (m === "2") return el("circle", { cx: c[0], cy: -c[1], r, style, "vector-effect": "non-scaling-stroke" }, scene);
    const pts = m === "1" ? [[r, 0], [0, r], [-r, 0], [0, -r]] : [[r, r], [-r, r], [-r, -r], [r, -r]];
    return polygon(scene, pts.map(([u, v]) => [c[0] + u, c[1] + v]), style);
  }
  function draw() {
    scene.replaceChildren();
    const closed = isOn(root, "closed");
    polygon(scene, B, `fill:var(--brand);fill-opacity:0.08;stroke:var(--brand);stroke-width:1.75px;${closed ? "" : "stroke-dasharray:5 4"}`);
    const [dE] = nearest("2", x);
    const onEdge = dE < 1e-9, inSet = onEdge ? closed : inside(x);
    let r = 0;
    if (inSet && !onEdge) {
      const [d, b] = nearest(metric, x);
      r = d;
      ball(metric, x, r, "fill:var(--foreground);fill-opacity:0.08;stroke:var(--foreground);stroke-width:1.5px");
      if (isOn(root, "nest")) {
        // The largest balls of the other two metrics inside this one.
        const inner = { "2": [["1", r], ["inf", r / Math.SQRT2]], "1": [["inf", r / 2], ["2", r / Math.SQRT2]], inf: [["2", r], ["1", r]] }[metric];
        inner.forEach(([m, rr], i) => ball(m, x, rr, `fill:none;stroke:${i ? "var(--vec-v)" : "var(--vec-u)"};stroke-width:1.25px;stroke-dasharray:4 3`));
      }
      line(scene, x, b, "stroke:var(--brand);stroke-width:1px;stroke-dasharray:2 3");
      el("circle", { cx: b[0], cy: -b[1], r: 0.05, style: "fill:var(--brand)" }, scene);
    } else if (onEdge) {
      ball(metric, x, 0.35, "fill:var(--code-del);fill-opacity:0.12;stroke:var(--code-del);stroke-width:1.5px;stroke-dasharray:3 3");
    }
    hx.place(x, inSet ? "var(--foreground)" : "var(--code-del)");
    o.x.textContent = `(${num(x[0])}, ${num(x[1])})`;
    o.r.textContent = inSet && !onEdge ? `${num(r, 3)} (${{ "2": "L²", "1": "L¹", inf: "L∞" }[metric]})` : "none";
    o.inside.textContent = !inSet ? "no: x is not in the set" : onEdge ? "no: every ball pokes outside" : "yes";
    o.open.textContent = closed ? "no: its boundary points are not interior" : "yes: every point is interior";
  }
  root.addEventListener("seg-change", (e) => { metric = e.detail.value; draw(); });
  onToggle(root, draw);
  root.querySelector("[data-action=edge]").addEventListener("click", () => { const [, b] = nearest("2", x); x = b.slice(); draw(); });
  draw();
}

// ============================================================ Brouwer

for (const root of document.querySelectorAll("[data-topo-brouwer]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => draw());
  // Left: a piecewise-linear f on [0, 1].
  const ys = [0.8, 0.95, 0.3, 0.62, 0.12, 0.4];
  const box = { L: 46, T: 24, W: 280, H: 280 };
  const sx = (v) => box.L + v * box.W, sy = (v) => box.T + box.H - v * box.H;
  // Right: the disc map.
  const DC = [548, 172], DR = 136;
  const dx = (p) => DC[0] + p[0] * DR, dy = (p) => DC[1] - p[1] * DR;
  const fmap = (p) => {
    const r2 = p[0] * p[0] + p[1] * p[1];
    const a = ((s.rot.get() + s.swirl.get() * (1 - Math.min(1, r2))) * Math.PI) / 180, k = s.squash.get();
    let q = [k * (Math.cos(a) * p[0] - Math.sin(a) * p[1]) + s.dx.get(), k * (Math.sin(a) * p[0] + Math.cos(a) * p[1]) + s.dy.get()];
    const n = Math.hypot(q[0], q[1]);
    if (n > 1) q = [q[0] / n, q[1] / n];
    return q;
  };
  // f extended to the plane through the radial retraction, so f(p) − p
  // has no zero outside the disc.
  const D = (p) => {
    const n = Math.hypot(p[0], p[1]);
    const r = n > 1 ? [p[0] / n, p[1] / n] : p;
    const q = fmap(r);
    return [q[0] - p[0], q[1] - p[1]];
  };
  const winding = (pts) => {
    let w = 0, prev = Math.atan2(...D(pts[0]).reverse());
    for (let i = 1; i <= pts.length; i++) {
      const v = D(pts[i % pts.length]), a = Math.atan2(v[1], v[0]);
      let d = a - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      w += d; prev = a;
    }
    return Math.round(w / (2 * Math.PI));
  };
  const squarePts = (c, h, n = 48) => {
    const pts = [];
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]])
      for (let i = 0; i < n; i++) pts.push([c[0] + h * (a[0] + ((b[0] - a[0]) * i) / n), c[1] + h * (a[1] + ((b[1] - a[1]) * i) / n)]);
    return pts;
  };
  function fixedPoint() {
    let c = [0, 0], h = 1.2;
    for (let depth = 0; depth < 26; depth++) {
      const kids = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [c[0] + (u * h) / 2, c[1] + (v * h) / 2]);
      let next = kids.find((k) => winding(squarePts(k, h / 2)) !== 0);
      if (!next) next = kids.reduce((b, k) => (Math.hypot(...D(k)) < Math.hypot(...D(b)) ? k : b));
      c = next; h /= 2;
    }
    return c;
  }
  const scene = el("g", {}, svg);
  const handles = el("g", {}, svg);
  const knobs = ys.map((_, i) => {
    const k = el("circle", { r: 7, tabindex: 0, role: "slider", "aria-label": `f at ${i / 5}`, "aria-valuemin": 0, "aria-valuemax": 1, class: "cursor-ns-resize outline-none", style: "fill:var(--background);stroke:var(--foreground);stroke-width:2px" }, handles);
    const setY = (v) => { ys[i] = Math.max(0, Math.min(1, v)); draw(); };
    k.addEventListener("pointerdown", (e) => {
      k.setPointerCapture(e.pointerId);
      const pt = svg.createSVGPoint();
      const mv = (ev) => { pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); setY((box.T + box.H - p.y) / box.H); };
      mv(e);
      k.addEventListener("pointermove", mv);
      k.addEventListener("pointerup", () => k.removeEventListener("pointermove", mv), { once: true });
    });
    k.addEventListener("keydown", (e) => {
      const d = { ArrowUp: 0.02, ArrowDown: -0.02 }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      setY(ys[i] + d * (e.shiftKey ? 5 : 1));
    });
    k.addEventListener("focus", () => k.style.strokeWidth = "3.5px");
    k.addEventListener("blur", () => k.style.strokeWidth = "2px");
    return k;
  });

  function draw() {
    scene.replaceChildren();
    // ---- interval
    const f = frame(scene, { box: [box.L, box.T, box.W, box.H], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], xlabel: "x", ylabel: "f(x)" });
    el("line", { x1: sx(0), y1: sy(0), x2: sx(1), y2: sy(1), style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:4 4" }, scene);
    text(scene, sx(0.92), sy(0.98), "y = x", { "text-anchor": "end" });
    polyline(scene, ys.map((v, i) => [sx(i / 5), sy(v)]), "stroke:var(--vec-u);stroke-width:2;stroke-linejoin:round");
    const fixed1 = [];
    for (let i = 0; i < 5; i++) {
      const x0 = i / 5, x1 = (i + 1) / 5, a = ys[i] - x0, b = ys[i + 1] - x1;
      if (a === 0) fixed1.push(x0);
      if (a * b < 0) fixed1.push(x0 + ((x1 - x0) * a) / (a - b));
    }
    if (ys[5] === 1) fixed1.push(1);
    for (const x of fixed1) {
      el("line", { x1: sx(x), x2: sx(x), y1: sy(0), y2: sy(x), style: "stroke:var(--brand);stroke-opacity:0.45;stroke-dasharray:2 3" }, scene);
      el("circle", { cx: sx(x), cy: sy(x), r: 5, style: "fill:var(--brand)" }, scene);
    }
    knobs.forEach((k, i) => { k.setAttribute("cx", sx(i / 5)); k.setAttribute("cy", sy(ys[i])); k.setAttribute("aria-valuenow", ys[i].toFixed(2)); });
    void f;

    // ---- disc
    el("circle", { cx: DC[0], cy: DC[1], r: DR, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.5;stroke-width:1.5px" }, scene);
    const lines = [];
    for (let k = -4; k <= 4; k++) {
      const c = k / 5, h = Math.sqrt(1 - c * c);
      lines.push(Array.from({ length: 41 }, (_, i) => [c, -h + (2 * h * i) / 40]));
      lines.push(Array.from({ length: 41 }, (_, i) => [-h + (2 * h * i) / 40, c]));
    }
    for (const L of lines) polyline(scene, L.map((p) => [dx(p), dy(p)]), "stroke:currentColor;stroke-opacity:0.1;stroke-width:1");
    for (const L of lines) polyline(scene, L.map((p) => fmap(p)).map((p) => [dx(p), dy(p)]), "stroke:var(--vec-u);stroke-opacity:0.5;stroke-width:1");
    const fp = fixedPoint(), err = Math.hypot(...D(fp));
    el("circle", { cx: dx(fp), cy: dy(fp), r: 11, style: "fill:none;stroke:var(--brand);stroke-width:1.5px" }, scene);
    el("circle", { cx: dx(fp), cy: dy(fp), r: 4.5, style: "fill:var(--brand)" }, scene);
    text(scene, DC[0] - DR, DC[1] + DR + 22, "grid: the disc · blue: its image under f");
    const circle = Array.from({ length: 360 }, (_, i) => [Math.cos((i * Math.PI) / 180), Math.sin((i * Math.PI) / 180)]);
    o.n1.textContent = String(fixed1.length);
    o.p.textContent = `(${num(fp[0], 4)}, ${num(fp[1], 4)})`;
    o.err.textContent = err < 1e-6 ? "< 0.000001" : num(err, 6);
    o.wind.textContent = signed(winding(circle.map(([a, b]) => [a * 1.0001, b * 1.0001])));
  }
  draw();
}
