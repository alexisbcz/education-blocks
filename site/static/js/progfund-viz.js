// Shared views of the programming-foundations blocks: the code window,
// the frames-and-objects picture, the stepper and the console. Pure
// exports: importing this module does nothing on its own.

import { lineHTML } from "./highlight.js";
import { trace } from "./progfund-py.js";

const INDENT = "    ";
const LINE = 20; // px, the .code line height
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ------------------------------------------------------------ editor

/**
 * Mounts a [data-ed] code window. Returns an API:
 * value, set(code), markLine(n), markError(n), bps (a Set of line
 * numbers when the gutter takes breakpoints), dirty().
 * opts.onChange(code) runs (debounced) after typing; opts.onRun on ⌘⏎;
 * opts.onBreakpoints(set) when breakpoints change; opts.decorate(html, i)
 * may rewrite each highlighted line.
 */
export function mountEditor(el, opts = {}) {
  const ta = el.querySelector("[data-ed-input]");
  const pre = el.querySelector("[data-ed-hl]");
  const gutter = el.querySelector("[data-ed-gutter]");
  const cur = el.querySelector("[data-ed-cur]");
  const errBar = el.querySelector("[data-ed-err]");
  const dirtyDot = el.querySelector("[data-ed-dirty]");
  const scroller = el.querySelector("[data-ed-scroll]");
  const fileEl = el.querySelector("[data-ed-file]");
  let starter = el.querySelector("template[data-ed-src]").content.textContent;
  let code = starter;
  const bpMode = el.hasAttribute("data-ed-bp");
  const bps = new Set();
  let timer = 0;

  const value = () => (ta ? ta.value : code);
  const render = () => {
    const lines = value().split("\n");
    pre.innerHTML = lines.map((l, i) => `<div class="min-h-5">${opts.decorate ? opts.decorate(lineHTML(l), i + 1, l) : lineHTML(l)}</div>`).join("");
    gutter.innerHTML = lines
      .map((_, i) => {
        const n = i + 1;
        const bp = bps.has(n);
        return `<div data-ln="${n}" class="relative${bpMode ? " hover:text-foreground" : ""}">${bp ? `<span class="absolute top-1/2 left-0.5 size-2 -translate-y-1/2 rounded-full bg-brand"></span>` : ""}${n}</div>`;
      })
      .join("");
    if (ta) {
      ta.style.height = `${lines.length * LINE}px`;
      ta.style.width = `${Math.max(...lines.map((l) => l.length)) + 4}ch`;
    }
    if (dirtyDot) dirtyDot.hidden = value() === starter;
  };

  if (ta) {
    const insert = (text) => document.execCommand("insertText", false, text);
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        opts.onRun?.();
        return;
      }
      if (e.key === "F9" && bpMode) {
        e.preventDefault();
        toggleBp(ta.value.slice(0, ta.selectionStart).split("\n").length);
        return;
      }
      if (e.key === "Escape") {
        ta.blur();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const { selectionStart: s, selectionEnd: t, value: v } = ta;
        const lineStart = v.lastIndexOf("\n", s - 1) + 1;
        if (!e.shiftKey && s === t) {
          insert(INDENT.slice((s - lineStart) % 4));
          return;
        }
        const end = v.indexOf("\n", t - (t > s && v[t - 1] === "\n" ? 1 : 0));
        const blockEnd = end === -1 ? v.length : end;
        const next = v
          .slice(lineStart, blockEnd)
          .split("\n")
          .map((l) => (e.shiftKey ? l.replace(/^ {1,4}/, "") : INDENT + l))
          .join("\n");
        ta.setSelectionRange(lineStart, blockEnd);
        insert(next);
        ta.setSelectionRange(lineStart, lineStart + next.length);
        return;
      }
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const v = ta.value;
        const s = ta.selectionStart;
        const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
        let indent = line.match(/^ */)[0];
        if (/:\s*(#.*)?$/.test(line)) indent += INDENT;
        if (/^\s*(return|pass|break|continue)\b/.test(line)) indent = indent.slice(4);
        insert("\n" + indent);
      }
    });
    ta.addEventListener("input", () => {
      render();
      clearTimeout(timer);
      timer = setTimeout(() => opts.onChange?.(ta.value), 350);
    });
  }

  function toggleBp(n) {
    if (!bpMode) return;
    if (bps.has(n)) bps.delete(n);
    else bps.add(n);
    render();
    opts.onBreakpoints?.(bps);
  }
  if (bpMode) {
    gutter.addEventListener("click", (e) => {
      const ln = e.target.closest("[data-ln]");
      if (ln) toggleBp(Number(ln.dataset.ln));
    });
  }

  const place = (bar, n) => {
    const count = value().split("\n").length;
    if (!n || n > count) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.style.transform = `translateY(${(n - 1) * LINE}px)`;
    // Keep the line in view inside the window, never scrolling the page.
    const top = (n - 1) * LINE + 8;
    if (top < scroller.scrollTop || top + LINE > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 2), behavior: reduced() ? "auto" : "smooth" });
    }
  };

  render();
  return {
    el,
    get value() {
      return value();
    },
    set(src, { asStarter = true, file } = {}) {
      if (asStarter) starter = src;
      if (ta) ta.value = src;
      else code = src;
      if (file && fileEl) fileEl.textContent = file;
      render();
    },
    reset() {
      this.set(starter);
    },
    markLine(n) {
      place(cur, n);
    },
    markError(n) {
      place(errBar, n);
    },
    bps,
    rerender: render,
    get starter() {
      return starter;
    },
  };
}

// ------------------------------------------------------------ values

const tok = (cls, text, title) => `<span class="tok-${cls}"${title ? ` title="${esc(title)}"` : ""}>${esc(text)}</span>`;

function primHTML(v, max = 20) {
  switch (v.t) {
    case "int":
    case "float":
      return tok("number", v.s);
    case "str": {
      const short = v.s.length > max ? v.s.slice(0, max - 2) + "…" + v.s.slice(-1) : v.s;
      return tok("string", short, short !== v.s ? v.s : "");
    }
    case "bool":
    case "none":
      return tok("constant", v.s);
    default:
      return `<span class="text-muted-foreground">${esc(v.s)}</span>`;
  }
}

/** Plain-text form of a serialised value, following references. */
export function valText(v, heap, depth = 0) {
  if (v.t !== "ref") return v.s;
  const o = heap.get(v.id);
  if (!o || depth > 3) return "…";
  if (o.kind === "list") return `[${o.items.map((x) => valText(x, heap, depth + 1)).join(", ")}]`;
  if (o.kind === "tuple") return o.items.length === 1 ? `(${valText(o.items[0], heap, depth + 1)},)` : `(${o.items.map((x) => valText(x, heap, depth + 1)).join(", ")})`;
  if (o.kind === "dict") return `{${o.entries.map(([k, x]) => `${valText(k, heap, depth + 1)}: ${valText(x, heap, depth + 1)}`).join(", ")}}`;
  if (o.kind === "function") return `function ${o.name}`;
  return "…";
}

// ------------------------------------------------------------ memory

/**
 * Mounts a [data-mem] picture. render(snapshot, previous) draws frames,
 * objects and arrows. opts.hideFunctions draws function objects inline.
 */
export function mountMemory(el, opts = {}) {
  const framesEl = el.querySelector("[data-mem-frames]");
  const objsEl = el.querySelector("[data-mem-objects]");
  const svg = el.querySelector("[data-mem-arrows]");
  let last = null;

  const refHTML = (v, heap) => {
    const o = heap.get(v.id);
    if (opts.hideFunctions && o && o.kind === "function") return `<span class="text-muted-foreground">function ${esc(o.name)}(${esc(o.params)})</span>`;
    return `<span data-src="${v.id}" class="inline-block size-2.5 rounded-full bg-[var(--code-mod)] align-middle" aria-label="arrow to ${o ? o.kind : "object"} #${v.id}"></span>`;
  };
  const valHTML = (v, heap) => (v.t === "ref" ? refHTML(v, heap) : primHTML(v));

  function objHTML(o, heap, changed) {
    const head = `<div class="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">${o.kind}</div>`;
    const ring = changed ? " ring-2 ring-brand/70" : "";
    let body = "";
    if (o.kind === "list" || o.kind === "tuple") {
      if (!o.items.length) body = `<div class="rounded-md border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground">empty</div>`;
      else
        body = `<div class="flex flex-wrap">${o.items
          .map(
            (x, i) =>
              `<div class="flex min-w-9 flex-col items-center border-y border-r first:rounded-l-md first:border-l last:rounded-r-md ${o.kind === "tuple" ? "bg-muted/40" : "bg-code"}"><span class="w-full border-b px-1.5 text-center font-mono text-[10px] text-muted-foreground">${i}</span><span class="flex min-h-7 items-center px-2 font-mono text-[13px]">${valHTML(x, heap)}</span></div>`,
          )
          .join("")}</div>`;
    } else if (o.kind === "dict") {
      if (!o.entries.length) body = `<div class="rounded-md border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground">empty</div>`;
      else
        body = `<div class="grid grid-cols-[auto_auto] overflow-hidden rounded-md border bg-code font-mono text-[13px]">${o.entries
          .map(([k, x]) => `<div class="border-b px-2 py-1 [&:nth-last-child(-n+2)]:border-b-0 border-r">${valHTML(k, heap)}</div><div class="flex items-center border-b px-2 py-1 [&:nth-last-child(-n+2)]:border-b-0">${valHTML(x, heap)}</div>`)
          .join("")}</div>`;
    } else if (o.kind === "function") {
      body = `<div class="rounded-md border bg-code px-2 py-1 font-mono text-[13px]"><span class="tok-keyword">def</span> <span class="tok-function">${esc(o.name)}</span>(${esc(o.params)})</div>`;
    }
    return `<div data-obj="${o.id}" class="rounded-lg p-1.5 transition-shadow duration-200 motion-reduce:transition-none${ring}">${head}${body}</div>`;
  }

  function render(snap, prev) {
    last = snap;
    if (!snap) {
      framesEl.innerHTML = `<span class="text-xs text-muted-foreground/70 italic">${esc(opts.idle ?? "Nothing is running.")}</span>`;
      objsEl.innerHTML = "";
      svg.innerHTML = "";
      return;
    }
    const heap = new Map(snap.heap.map((o) => [o.id, o]));
    const prevHeap = prev ? new Map(prev.heap.map((o) => [o.id, JSON.stringify(o)])) : null;
    const topId = snap.frames[snap.frames.length - 1].id;
    framesEl.innerHTML = snap.frames
      .map((f) => {
        const isTop = f.id === topId && !snap.end;
        const rows = f.vars
          .filter(([, v]) => !(opts.hideModules && v.t === "other" && v.s.startsWith("module")))
          .map(([k, v]) => `<div class="contents"><span class="py-0.5 pr-3 text-right text-muted-foreground">${esc(k)}</span><span class="flex min-w-0 items-center py-0.5">${valHTML(v, heap)}</span></div>`)
          .join("");
        const extra = [
          f.result ? `<div class="contents"><span class="py-0.5 pr-3 text-right text-muted-foreground italic">result</span><span class="flex items-center py-0.5">${valHTML(f.result, heap)}</span></div>` : "",
          f.ret ? `<div class="contents"><span class="py-0.5 pr-3 text-right font-medium text-brand">return</span><span class="flex items-center py-0.5">${valHTML(f.ret, heap)}</span></div>` : "",
        ].join("");
        const empty = !rows && !extra ? `<span class="col-span-2 text-muted-foreground/70 italic">no names yet</span>` : "";
        return `<div class="min-w-0 rounded-lg border ${isTop ? "border-brand/60 bg-brand/5" : "bg-background opacity-80"} px-3 py-2">
          <div class="mb-1 flex items-center gap-2 font-mono text-xs"><span class="${isTop ? "text-foreground" : "text-muted-foreground"}">${esc(f.name)}</span>${f.name !== "Global frame" ? `<span class="ml-auto text-[10px] text-muted-foreground">line ${f.line}</span>` : ""}</div>
          <div class="grid grid-cols-[auto_minmax(0,1fr)] font-mono text-[13px]">${rows}${extra}${empty}</div></div>`;
      })
      .join("");
    // Columns by distance from the frames: what a name points at goes in
    // the first column, what those objects point at in the next, so every
    // arrow runs left to right (Python Tutor's layout).
    const level = new Map();
    const order = [];
    const visit = (v, l) => {
      if (v.t !== "ref" || level.has(v.id)) return;
      const o = heap.get(v.id);
      if (!o || (opts.hideFunctions && o.kind === "function")) return;
      level.set(v.id, l);
      order.push(o);
    };
    for (const f of snap.frames) {
      for (const [, v] of f.vars) visit(v, 0);
      if (f.result) visit(f.result, 0);
      if (f.ret) visit(f.ret, 0);
    }
    for (let k = 0; k < order.length; k++) {
      const o = order[k];
      const l = level.get(o.id) + 1;
      for (const x of o.items ?? []) visit(x, l);
      for (const [a, b] of o.entries ?? []) {
        visit(a, l);
        visit(b, l);
      }
    }
    const cols = [];
    for (const o of order) (cols[level.get(o.id)] ??= []).push(o);
    objsEl.innerHTML = order.length
      ? `<div class="flex flex-wrap items-start gap-x-12 gap-y-4">${cols
          .map((col) => `<div class="flex flex-col items-start gap-3">${col.map((o) => objHTML(o, heap, prevHeap && prevHeap.get(o.id) !== JSON.stringify(o))).join("")}</div>`)
          .join("")}</div>`
      : `<span class="text-xs text-muted-foreground/70 italic">Lists, dicts and tuples appear here.</span>`;
    requestAnimationFrame(drawArrows);
  }

  function drawArrows() {
    const base = el.getBoundingClientRect();
    svg.setAttribute("width", base.width);
    svg.setAttribute("height", base.height);
    svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
    let paths = "";
    for (const dot of el.querySelectorAll("[data-src]")) {
      const target = el.querySelector(`[data-obj="${dot.dataset.src}"]`);
      if (!target) continue;
      const a = dot.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - base.left;
      const y1 = a.top + a.height / 2 - base.top;
      let x2 = b.left - base.left;
      let y2 = b.top - base.top + 22;
      let d;
      if (x2 > x1 + 16) {
        const dx = Math.max(24, (x2 - x1) * 0.45);
        d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2 - 2},${y2}`;
      } else if (dot.closest("[data-mem-objects]")) {
        // An object pointing at another object in the same column: go
        // round the right-hand side and come into the target's right edge.
        x2 = b.right - base.left;
        const reach = Math.max(x1, x2) + 28 + Math.min(60, Math.abs(y2 - y1) * 0.15);
        d = `M${x1},${y1} C${reach},${y1} ${reach},${y2} ${x2 + 2},${y2}`;
      } else {
        // Narrow screens: the objects sit under the frames; swing round the
        // left edge and come into the object's side.
        x2 = b.left - base.left;
        const out = x2 - 18;
        d = `M${x1},${y1} C${x1 + 30},${y1 + 24} ${out},${(y1 + y2) / 2} ${out},${y2 - 16} S${out + 4},${y2} ${x2 - 2},${y2}`;
      }
      paths += `<path d="${d}" fill="none" stroke="var(--code-mod)" stroke-opacity="0.75" stroke-width="1.5" marker-end="url(#${markerId})"/>`;
    }
    svg.innerHTML = `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--code-mod)"/></marker></defs>${paths}`;
  }
  const markerId = "pf-arrow-" + Math.random().toString(36).slice(2, 8);
  new ResizeObserver(() => last && drawArrows()).observe(el);
  return { render, redraw: drawArrows };
}

// ------------------------------------------------------------ stepper

/** Wires the [data-st] buttons and slider in root. onMove(i) shows step i. */
export function mountStepper(root, onMove) {
  const range = root.querySelector("[data-st-range]");
  const label = root.querySelector("[data-st-label]");
  const msgEl = root.querySelector("[data-st-msg]");
  let n = 0;
  let i = 0;
  const go = (k) => {
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, k));
    range.value = String(i);
    label.textContent = `Step ${i + 1} of ${n}`;
    for (const b of root.querySelectorAll("[data-st]")) {
      const act = b.dataset.st;
      b.disabled = (act === "first" || act === "back") ? i === 0 : i === n - 1;
    }
    onMove(i);
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-st]");
    if (!b || !root.contains(b)) return;
    const act = b.dataset.st;
    go(act === "first" ? 0 : act === "back" ? i - 1 : act === "next" ? i + 1 : n - 1);
  });
  range.addEventListener("input", () => go(Number(range.value)));
  return {
    setCount(count, at = 0) {
      n = count;
      range.max = String(Math.max(0, n - 1));
      go(at);
      if (!n) {
        label.textContent = "Step 0 of 0";
        range.value = "0";
      }
    },
    go,
    get index() {
      return i;
    },
    get count() {
      return n;
    },
    message(text, bad = false) {
      msgEl.textContent = text;
      msgEl.toggleAttribute("data-bad", bad);
    },
  };
}

/** ← and → on the block step, unless typing in a field. */
export function arrowKeys(root, stepper) {
  root.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.closest("textarea, input, select, [contenteditable]")) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepper.go(stepper.index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepper.go(stepper.index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      stepper.go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      stepper.go(stepper.count - 1);
    }
  });
}

// ------------------------------------------------------------ console

export function showConsole(el, text, error) {
  if (!el) return;
  const body = text ? esc(text) : "";
  const err = error ? `<span class="text-del">${esc(error)}</span>` : "";
  el.innerHTML = body || err ? body + err : `<span class="text-muted-foreground">Nothing printed yet.</span>`;
  el.scrollTop = el.scrollHeight;
}

/** One sentence about what step snap does next. */
export function describe(snap, steps, result) {
  if (snap.error) return { text: `${snap.error.type}: ${snap.error.message} (line ${snap.line})`, bad: true };
  if (snap.end) return { text: `Done: the program finished after ${steps.length - 1} steps.`, bad: false };
  const top = snap.frames[snap.frames.length - 1];
  if (snap.ev === "call") {
    const args = top.vars.map(([k, v]) => `${k}=${v.t === "ref" ? "…" : v.s}`).join(", ");
    return { text: `Calling ${top.name}(${args}): a new frame goes on top of the stack.`, bad: false };
  }
  if (snap.ev === "return") return { text: `${top.name} returns ${top.ret ? (top.ret.t === "ref" ? "an object" : top.ret.s) : "None"}; its frame is about to disappear.`, bad: false };
  const last = steps[steps.length - 1] === snap && result && result.stopped;
  if (last) return { text: `Stopped after ${steps.length} steps: is there a loop that never ends?`, bad: true };
  const where = top.name === "Global frame" ? "" : top.name.startsWith("<") ? ` inside the comprehension` : ` in ${top.name}`;
  return { text: `Line ${snap.line}${where} runs next.`, bad: false };
}

// ------------------------------------------------------------ tracer

/**
 * The complete Python Tutor view in a block: editor, stepper, memory and
 * console. Returns { run(src?), go(i), steps, result, editor }.
 */
export function mountTracer(root, opts = {}) {
  const editor = mountEditor(root.querySelector("[data-ed]"), {
    onChange: () => api.run(undefined, true),
    onRun: () => api.run(),
  });
  const memory = mountMemory(root.querySelector("[data-mem]"), opts);
  const consoleEl = root.querySelector("[data-console]");
  let steps = [];
  let result = null;
  const stepper = mountStepper(root, (i) => show(i));
  arrowKeys(root, stepper);

  function show(i) {
    const snap = steps[i];
    if (!snap) return;
    editor.markLine(snap.error || snap.end ? 0 : snap.line);
    editor.markError(snap.error ? snap.line : 0);
    memory.render(snap, steps[i - 1]);
    const out = result.output.slice(0, snap.out);
    showConsole(consoleEl, out, snap.error ? `${snap.error.type}: ${snap.error.message}` : "");
    const d = describe(snap, steps, result);
    stepper.message(d.text, d.bad);
    opts.onStep?.(snap, i, steps);
  }

  const api = {
    editor,
    memory,
    stepper,
    run(src, keep = false) {
      if (src !== undefined) editor.set(src);
      const at = stepper.index;
      result = trace(editor.value, { maxSteps: opts.maxSteps ?? 600, maxDepth: opts.maxDepth ?? 60 });
      steps = result.steps;
      if (!steps.length) {
        // A syntax error: nothing ran.
        editor.markLine(0);
        editor.markError(result.error?.line ?? 0);
        memory.render(null);
        showConsole(consoleEl, "", result.error ? `${result.error.type}: ${result.error.message} (line ${result.error.line})` : "");
        stepper.setCount(0);
        stepper.message(result.error ? `${result.error.type} on line ${result.error.line}: ${result.error.message}` : "", true);
        opts.onStep?.(null, 0, steps);
        return;
      }
      stepper.setCount(steps.length, keep ? Math.min(at, steps.length - 1) : 0);
    },
    get steps() {
      return steps;
    },
    get result() {
      return result;
    },
  };
  return api;
}

/** Reads the preset templates of a block: key → { prog, note }. */
export function presets(root) {
  const out = {};
  for (const t of root.querySelectorAll("template[data-prog]")) out[t.dataset.prog] = { prog: t.content.textContent };
  for (const t of root.querySelectorAll("template[data-note]")) (out[t.dataset.note] ??= {}).note = t.content.textContent;
  return out;
}
