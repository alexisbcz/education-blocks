// Phylogenetics blocks, part three: reading a tree (rotations, monophyly,
// paraphyly, polyphyly) and bootstrap support. Shared code lives in
// phylo-core.js.

import { scrubAll } from "./scrub.js";
import {
  el, text, num, pct, outs, onAction, reduced, chunked, mulberry32, rootAt, tips, splitsOf, sameSplits, nodeSplit,
  simulate, jcMatrix, nj, layout, drawBranches,
} from "./phylo-core.js";

// ============================================================ Reading a tree

const VERT = ["Lamprey", "Shark", "Salmon", "Frog", "Mouse", "Lizard", "Crocodile", "Bird"];
const CLADES = ["Vertebrates", "Jawed vertebrates", "Bony vertebrates", "Tetrapods", "Amniotes", "Sauropsids", "Archosaurs"];
const GROUPS = {
  "g-amniotes": ["Mouse", "Lizard", "Crocodile", "Bird"],
  "g-reptiles": ["Lizard", "Crocodile"],
  "g-fish": ["Lamprey", "Shark", "Salmon"],
  "g-warm": ["Mouse", "Bird"],
};

/** (Lamprey, (Shark, (Salmon, (Frog, (Mouse, (Lizard, (Crocodile, Bird))))))). */
function vertebrateTree() {
  let node = { key: "n6", name: CLADES[6], c: [{ id: 6, key: "t6" }, { id: 7, key: "t7" }] };
  for (let i = 5; i >= 0; i--) node = { key: "n" + i, name: CLADES[i], c: [{ id: i, key: "t" + i }, node] };
  return node;
}

/** Minimum membership changes inside a clade with its root's state fixed. */
function cost(node, sel, rootState) {
  const memo = (n) => {
    if (!n.c) return sel.has(n.id) ? [Infinity, 0] : [0, Infinity];
    const kids = n.c.map(memo);
    return [0, 1].map((st) => kids.reduce((s, k) => s + Math.min(k[st], k[1 - st] + 1), 0));
  };
  return memo(node)[rootState];
}

for (const root of document.querySelectorAll("[data-phylo-read]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-tree]");
  const tree = vertebrateTree();
  const all = [];
  const index = (n) => { all.push(n); if (n.c) n.c.forEach(index); };
  index(tree);
  const sel = new Set();
  const parts = new Map(); // key → { path, dot, label }
  let anim = 0;

  // Persistent elements, so focus survives redraws.
  for (const n of all) {
    const p = { path: el("path", { style: "fill:none;stroke-linecap:round" }, svg) };
    parts.set(n.key, p);
  }
  for (const n of all) {
    const p = parts.get(n.key);
    if (n.c) {
      p.g = el("g", { role: "button", tabindex: 0, "data-key": n.key, class: "cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--ring)]", "aria-label": `${n.name}: rotate this node` }, svg);
      p.hit = el("circle", { r: 11, style: "fill:transparent;stroke:transparent;stroke-width:3" }, p.g);
      p.dot = el("circle", { r: 4.5 }, p.g);
      p.name = text(svg, 0, 0, n.name, { class: "pointer-events-none fill-muted-foreground font-mono text-[9px]", style: "paint-order:stroke;stroke:var(--code-bg);stroke-width:4px;stroke-linejoin:round" });
    } else {
      p.g = el("g", { role: "button", tabindex: 0, "data-key": n.key, class: "cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--ring)]", "aria-label": `${VERT[n.id]}: select` }, svg);
      p.box = el("rect", { height: 18, rx: 5, style: "stroke:transparent;stroke-width:2" }, p.g);
      p.label = text(p.g, 0, 0, VERT[n.id], { class: "font-mono text-[12px]" });
    }
  }

  const activate = (key) => {
    const n = all.find((x) => x.key === key);
    if (!n) return;
    if (n.c) rotate(n);
    else { sel.has(n.id) ? sel.delete(n.id) : sel.add(n.id); paint(); }
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-key]"); if (g) activate(g.dataset.key); });
  svg.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const g = e.target.closest("[data-key]");
    if (!g) return;
    e.preventDefault();
    activate(g.dataset.key);
  });
  onAction(root, (act) => {
    if (GROUPS[act]) { sel.clear(); for (const nm of GROUPS[act]) sel.add(VERT.indexOf(nm)); paint(); }
    else if (act === "clear") { sel.clear(); paint(); }
    else if (act === "shuffle") {
      for (const n of all) if (n.c && Math.random() < 0.5) n.c.reverse();
      move();
    }
  });

  function rotate(n) { n.c.reverse(); move(); }

  /** Animates leaves to their new rows. */
  function move() {
    const before = new Map(all.map((n) => [n.key, n.y]));
    layout(tree, { x: 24, y: 22, w: 360, h: 256, phylogram: false });
    const after = new Map(all.map((n) => [n.key, n.y]));
    cancelAnimationFrame(anim);
    if (reduced()) { paint(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 260), e = 1 - (1 - k) ** 3;
      for (const n of all) n.y = before.get(n.key) + (after.get(n.key) - before.get(n.key)) * e;
      paint();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function mrcaOf(ids) {
    let best = null;
    const walk = (n) => {
      const ts = tips(n).map((t) => t.id);
      if (ids.every((i) => ts.includes(i))) { best = n; if (n.c) n.c.forEach(walk); }
    };
    walk(tree);
    return best;
  }

  function paint() {
    const ids = [...sel];
    const m = ids.length >= 1 ? mrcaOf(ids) : null;
    const inClade = new Set(m ? tips(m).map((t) => t.id) : []);
    const branchIn = (n) => tips(n).every((t) => sel.has(t.id)) && sel.size > 0;
    const walk = (n, parent) => {
      const p = parts.get(n.key);
      if (parent) {
        p.path.setAttribute("d", `M${parent.x.toFixed(1)},${parent.y.toFixed(1)}V${n.y.toFixed(1)}H${n.x.toFixed(1)}`);
        p.path.setAttribute("style", `fill:none;stroke-linecap:round;stroke:${branchIn(n) ? "var(--brand)" : "currentColor"};stroke-opacity:${branchIn(n) ? 1 : 0.6};stroke-width:${branchIn(n) ? 2.2 : 1.5}`);
      }
      if (n.c) {
        p.hit.setAttribute("cx", n.x); p.hit.setAttribute("cy", n.y);
        p.dot.setAttribute("cx", n.x); p.dot.setAttribute("cy", n.y);
        const isM = m && m.c && n.key === m.key;
        p.dot.setAttribute("style", isM ? "fill:var(--brand);stroke:var(--brand);stroke-width:2" : "fill:var(--background);stroke:currentColor;stroke-opacity:0.7;stroke-width:1.5");
        p.name.setAttribute("x", n.x + 6);
        p.name.setAttribute("y", n.y + 14);
        n.c.forEach((c) => walk(c, n));
      } else {
        const on = sel.has(n.id);
        p.label.setAttribute("x", n.x + 10);
        p.label.setAttribute("y", n.y + 4);
        p.label.setAttribute("class", `font-mono text-[12px] ${on ? "fill-[var(--brand)] font-semibold" : "fill-foreground"}`);
        p.box.setAttribute("x", n.x + 4);
        p.box.setAttribute("y", n.y - 9);
        p.box.setAttribute("width", VERT[n.id].length * 7.4 + 12);
        p.box.setAttribute("style", `stroke:transparent;stroke-width:2;fill:${on ? "var(--brand)" : "transparent"};fill-opacity:0.12`);
        p.g.setAttribute("aria-pressed", String(on));
      }
    };
    walk(tree, null);

    o.n.textContent = String(sel.size);
    if (!sel.size) {
      o.verdict.textContent = "Select some tips.";
      o.why.textContent = "Or try a group on the right. Click a round node to rotate it.";
      o.mrca.textContent = "—";
      o.left.textContent = "—";
      return;
    }
    const left = [...inClade].filter((i) => !sel.has(i)).map((i) => VERT[i]);
    o.mrca.textContent = m.c ? m.name : VERT[m.id];
    o.left.textContent = left.length ? left.join(", ") : "none";
    if (sel.size === 1) {
      o.verdict.textContent = "One tip is trivially monophyletic.";
      o.why.textContent = "Select two or more to test a group.";
      return;
    }
    if (!left.length) {
      o.verdict.textContent = `Monophyletic: the ${m.name.toLowerCase()} clade.`;
      o.why.textContent = "A common ancestor and all of its descendants, nothing left out.";
      return;
    }
    const keep = cost(m, sel, 1), gain = cost(m, sel, 0) + 0;
    if (keep < gain) {
      o.verdict.textContent = "Paraphyletic.";
      o.why.textContent = `It contains the common ancestor (${m.name.toLowerCase()}) but leaves out ${left.join(", ")}. The cheapest story: the ancestor was a member and ${keep === 1 ? "one lineage was" : `${keep} lineages were`} taken out.`;
    } else {
      o.verdict.textContent = "Polyphyletic.";
      o.why.textContent = `The members sit on separate branches of the ${m.name.toLowerCase()}. The cheapest story has the shared trait arising ${gain} times independently${keep === gain ? " (or as cheaply, lost as often)" : ""}: convergence, not common descent.`;
    }
  }

  layout(tree, { x: 24, y: 22, w: 360, h: 256, phylogram: false });
  paint();
}

// ============================================================ Bootstrap

const BOOT_NAMES = ["A", "B", "C", "D", "E", "F"];
// A short internal branch (EF) and a modest one (AB) make support vary.
const BOOT_TREE = { n: 6, edges: [[0, 6, 0.1], [1, 6, 0.15], [6, 7, 0.04], [2, 7, 0.12], [7, 8, 0.08], [3, 8, 0.2], [8, 9, 0.02], [4, 9, 0.1], [5, 9, 0.15]] };

for (const root of document.querySelectorAll("[data-phylo-boot]")) {
  const o = outs(root);
  const tsvg = root.querySelector("[data-truth]"), esvg = root.querySelector("[data-est]");
  const rng = mulberry32(1985);
  const truthRooted = rootAt(BOOT_TREE, 0);
  const truth = splitsOf(truthRooted, 6);
  let seqs, est, estSplits, support = null, done = 0, stop = null;
  let started = false;
  const s = scrubAll(root, (name) => { if (name === "sites") { fresh(); if (started) boot(); } });
  onAction(root, (act) => {
    if (act === "new") fresh();
    else if (act === "boot") boot();
  });

  function fresh() {
    stop?.();
    seqs = simulate(rng, truthRooted, s.sites.get());
    est = rootAt(nj(jcMatrix(seqs)).g, 0);
    estSplits = splitsOf(est, 6);
    support = null;
    done = 0;
    draw();
  }

  function boot() {
    stop?.();
    const L = seqs[0].length, reps = s.reps.get();
    support = new Map([...estSplits].map((k) => [k, 0]));
    done = 0;
    stop = chunked(reps, () => {
      const cols = Array.from({ length: L }, () => Math.floor(rng() * L));
      const sp = splitsOf(rootAt(nj(jcMatrix(seqs, cols)).g, 0), 6);
      for (const k of sp) if (support.has(k)) support.set(k, support.get(k) + 1);
      done++;
    }, () => draw(), () => draw());
  }

  function drawTree(svg, t, marks) {
    svg.replaceChildren();
    const { leaves, nodes } = layout(t, { x: 14, y: 18, w: 230, h: 184 });
    drawBranches(svg, t, (c) => {
      if (!marks || !c.c) return "stroke:currentColor;stroke-opacity:0.65;stroke-width:1.5";
      const k = nodeSplit(c, 6);
      if (!estSplits.has(k)) return "stroke:currentColor;stroke-opacity:0.65;stroke-width:1.5";
      return `stroke:${truth.has(k) ? "var(--brand)" : "var(--code-del)"};stroke-width:2.2`;
    });
    for (const l of leaves) text(svg, l.x + 5, l.y + 4, BOOT_NAMES[l.id], { class: "fill-foreground font-mono text-[12px]" });
    if (!marks) return;
    for (const n of nodes) {
      if (!n.c || n === t) continue;
      const k = nodeSplit(n, 6);
      if (!estSplits.has(k) || !support || !done) continue;
      const v = support.get(k) / done;
      text(svg, n.x - 4, n.y - 5, `${Math.round(100 * v)}`, { "text-anchor": "end", class: `${truth.has(k) ? "fill-[var(--brand)]" : "fill-[var(--code-del)]"} font-mono text-[11px] font-semibold` });
    }
  }

  function draw() {
    drawTree(tsvg, truthRooted, false);
    drawTree(esvg, est, true);
    const ok = sameSplits(estSplits, truth);
    o.topo.textContent = ok ? "correct" : "wrong";
    o.topo.style.color = ok ? "" : "var(--code-del)";
    const list = (want) => {
      const ks = [...estSplits].filter((k) => truth.has(k) === want);
      if (!ks.length) return "none";
      if (!support || !done) return `${ks.length}`;
      return ks.map((k) => pct(support.get(k) / done, 0)).join(", ");
    };
    o.good.textContent = list(true);
    o.bad.textContent = list(false);
    o.done.textContent = support ? `${done} of ${s.reps.get()}` : "—";
  }

  fresh();
  new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting) && !started) { started = true; boot(); }
  }, { rootMargin: "100px" }).observe(root);
}
