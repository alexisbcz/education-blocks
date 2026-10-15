// Garbage collection: the same program run under reference counting and
// under mark-and-sweep. A cycle (A ⇄ B) survives the first and not the
// second.

import { h, s, stext, msg, out, arrowMarker } from "./plt-ui.js";

const OBJECTS = {
  A: { x: 230, y: 90 }, B: { x: 400, y: 90 }, C: { x: 230, y: 250 }, D: { x: 400, y: 250 }, E: { x: 560, y: 170 },
};
const ROOTS = { a: { x: 70, y: 90 }, c: { x: 70, y: 250 } };

// The program, one statement per button.
const PROGRAM = [
  { code: "a = new A()", run: (st) => { st.alloc("A"); st.setRoot("a", "A"); } },
  { code: "a.next = new B()", run: (st) => { st.alloc("B"); st.setField("A", "next", "B"); } },
  { code: "B.next = a  // a cycle", run: (st) => st.setField("B", "next", "A") },
  { code: "c = new C(); c.child = new D()", run: (st) => { st.alloc("C"); st.setRoot("c", "C"); st.alloc("D"); st.setField("C", "child", "D"); } },
  { code: "D.peer = new E()", run: (st) => { st.alloc("E"); st.setField("D", "peer", "E"); } },
  { code: "a = null", run: (st) => st.setRoot("a", null) },
  { code: "c.child = null", run: (st) => st.setField("C", "child", null) },
];

function newState(mode) {
  const st = {
    mode, objs: new Map(), roots: new Map([["a", null], ["c", null]]), freed: [], marked: new Set(), phase: "idle", log: [],
    alloc(name) { st.objs.set(name, { fields: new Map(), rc: 0 }); },
    refs(name) { return [...st.objs.get(name).fields.values()].filter(Boolean); },
    inc(name) { if (name && st.objs.has(name)) st.objs.get(name).rc++; },
    dec(name) {
      if (!name || !st.objs.has(name) || st.mode !== "rc") return;
      const o = st.objs.get(name);
      if (--o.rc === 0) {
        // Count hit zero: free now, and release everything it pointed to.
        const out = st.refs(name);
        st.objs.delete(name);
        st.freed.push(name);
        st.log.push(`${name} freed (count 0)`);
        out.forEach((r) => st.dec(r));
      }
    },
    setRoot(r, target) { const old = st.roots.get(r); st.inc(target); st.roots.set(r, target); st.dec(old); },
    setField(obj, f, target) {
      const o = st.objs.get(obj);
      const old = o.fields.get(f);
      st.inc(target);
      o.fields.set(f, target);
      st.dec(old);
    },
    reachable() {
      const seen = new Set(), stack = [...st.roots.values()].filter(Boolean);
      while (stack.length) { const n = stack.pop(); if (seen.has(n) || !st.objs.has(n)) continue; seen.add(n); stack.push(...st.refs(n)); }
      return seen;
    },
  };
  return st;
}

for (const root of document.querySelectorAll("[data-plt-gc]")) {
  const svg = root.querySelector("[data-heap]");
  const opsEl = root.querySelector("[data-ops]");
  const collectBtn = root.querySelector('[data-act="collect"]');
  let mode = "rc", st, done;

  function reset() {
    st = newState(mode);
    done = 0;
    render();
    msg(root, mode === "rc" ? "each object counts the references pointing at it" : "allocations never free anything until the collector runs");
  }

  function render() {
    opsEl.replaceChildren(...PROGRAM.map((op, i) => {
      const b = h("button", {
        class: "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left font-mono text-[12px] transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default " +
          (i < done ? "border-transparent text-muted-foreground line-through decoration-foreground/30" : i === done ? "border-brand text-foreground hover:bg-brand/10" : "text-muted-foreground/50"),
        attrs: { type: "button", disabled: i !== done },
      }, h("span", { class: "w-4 text-muted-foreground tabular-nums", text: i + 1 }), op.code);
      b.addEventListener("click", () => {
        op.run(st);
        done++;
        st.marked.clear(); st.phase = "idle";
        const freed = st.log.splice(0);
        msg(root, freed.length ? freed.join(", ") : `ran ${op.code.replace(/\s*\/\/.*/, "")}`);
        render();
      });
      return b;
    }));
    collectBtn.querySelector("[data-label]").textContent = mode === "rc" ? "Collect" : st.phase === "marked" ? "Sweep" : "Mark";
    draw();
    const reach = st.reachable();
    const live = [...st.objs.keys()];
    const leaked = live.filter((n) => !reach.has(n));
    out(root, "live", live.join(", ") || "none");
    out(root, "reach", [...reach].join(", ") || "none");
    out(root, "leaked", leaked.length ? leaked.join(", ") : "none");
    root.querySelector('[data-out="leaked"]').className = "tabular-nums " + (leaked.length ? "text-del" : "");
  }

  function draw() {
    svg.replaceChildren();
    const mk = arrowMarker(svg, "currentColor", 0.6);
    const reach = st.reachable();
    const edge = (a, b, label) => {
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      // The perpendicular flips with the direction, so one sign keeps a
      // pair of opposite edges (A ⇄ B) on opposite sides.
      const bend = -22;
      const sx = a.x + ux * 30, sy = a.y + uy * 30, ex = b.x - ux * 32, ey = b.y - uy * 32;
      const mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
      s("path", { d: `M${sx},${sy} Q${mx},${my} ${ex},${ey}`, style: "fill:none;stroke:currentColor;stroke-opacity:.55;stroke-width:1.4", "marker-end": mk }, svg);
      if (label) stext(svg, mx, my - 4, label, { class: "font-mono text-[10px]", style: "fill:var(--muted-foreground)" });
    };
    for (const [r, target] of st.roots) {
      const p = ROOTS[r];
      s("rect", { x: p.x - 24, y: p.y - 16, width: 48, height: 32, rx: 6, style: "fill:var(--background);stroke:currentColor;stroke-opacity:.6" }, svg);
      const t = stext(svg, p.x, p.y, r, { class: "font-mono text-[13px]", style: "fill:var(--foreground)" });
      t.setAttribute("dominant-baseline", "central");
      if (target && st.objs.has(target)) edge({ x: p.x - 4, y: p.y }, OBJECTS[target]);
      else stext(svg, p.x, p.y + 30, "null", { class: "font-mono text-[10px]", style: "fill:var(--muted-foreground)" });
    }
    stext(svg, 70, 40, "roots", { class: "font-mono text-[10px] uppercase", style: "fill:var(--muted-foreground);letter-spacing:.08em" });
    for (const [name, o] of st.objs) for (const [f, target] of o.fields) if (target && st.objs.has(target)) edge(OBJECTS[name], OBJECTS[target], f);
    for (const [name, p] of Object.entries(OBJECTS)) {
      const alive = st.objs.has(name), freed = st.freed.includes(name);
      if (!alive && !freed) continue;
      const marked = st.marked.has(name), unreachable = alive && !reach.has(name);
      const stroke = marked ? "var(--brand)" : unreachable ? "var(--code-del)" : "currentColor";
      s("circle", { cx: p.x, cy: p.y, r: 28, style: `fill:${marked ? "color-mix(in oklab, var(--brand) 16%, var(--code-bg))" : "var(--code-bg)"};stroke:${stroke};stroke-opacity:${freed ? 0.3 : 1};stroke-width:${marked || unreachable ? 2 : 1.3};stroke-dasharray:${freed ? "4 4" : "none"}` }, svg);
      const t = stext(svg, p.x, p.y - (st.mode === "rc" && alive ? 5 : 0), name, { class: "font-mono text-[15px]", style: `fill:${freed ? "var(--muted-foreground)" : stroke === "currentColor" ? "var(--foreground)" : stroke};opacity:${freed ? 0.5 : 1}` });
      t.setAttribute("dominant-baseline", "central");
      if (st.mode === "rc" && alive) stext(svg, p.x, p.y + 12, `rc ${st.objs.get(name).rc}`, { class: "font-mono text-[10px]", style: "fill:var(--muted-foreground)" });
      if (freed) stext(svg, p.x, p.y + 44, "freed", { class: "font-mono text-[10px]", style: "fill:var(--muted-foreground)" });
      else if (unreachable) stext(svg, p.x, p.y + 44, st.mode === "rc" ? "leaked" : "garbage", { class: "font-mono text-[10px]", style: "fill:var(--code-del)" });
    }
  }

  collectBtn.addEventListener("click", () => {
    if (mode === "rc") {
      const leaked = [...st.objs.keys()].filter((n) => !st.reachable().has(n));
      msg(root, leaked.length ? `reference counting has nothing to collect: ${leaked.join(" and ")} still count each other (a cycle leaks)` : "nothing to collect: every object was freed when its count reached zero", leaked.length ? "bad" : "");
      return;
    }
    if (st.phase !== "marked") {
      st.marked = st.reachable();
      st.phase = "marked";
      msg(root, `mark: from the roots, ${[...st.marked].join(", ") || "nothing"} ${st.marked.size === 1 ? "is" : "are"} reachable`);
    } else {
      const garbage = [...st.objs.keys()].filter((n) => !st.marked.has(n));
      garbage.forEach((n) => { st.objs.delete(n); st.freed.push(n); });
      st.marked.clear();
      st.phase = "idle";
      msg(root, garbage.length ? `sweep: freed ${garbage.join(", ")}, cycle or not` : "sweep: nothing unmarked to free", garbage.length ? "good" : "");
    }
    render();
  });
  root.querySelector('[data-act="reset"]').addEventListener("click", reset);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; reset(); });
  reset();
}
