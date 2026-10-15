// Operating systems blocks: CPU scheduling, process states, paging with a
// TLB, page replacement, a race condition, the banker's algorithm, dining
// philosophers, inode pointers, disk scheduling, contiguous allocation and
// a read() system call. Every number is computed here from the inputs.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { reducedMotion } from "./svg.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const isOn = (root, name) => root.querySelector(`[data-toggle="${name}"]`)?.getAttribute("data-state") === "checked";
const action = (root, name, fn) => root.querySelectorAll(`[data-action="${name}"]`).forEach((b) => b.addEventListener("click", fn));
const segValue = (root) => root.querySelector('[role=tablist] [aria-selected="true"]')?.dataset.seg;
const setSeg = (root, value) => {
  const b = root.querySelector(`[role=tablist] [data-seg="${value}"]`);
  if (b) b.click();
};
const PALETTE = ["var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)"];
const fmtInt = new Intl.NumberFormat("en-US");

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A Back/Next stepper over n steps; arrow keys on root when it has focus.
function stepper(root, count, render) {
  let at = 0;
  const back = root.querySelector("[data-action=back]");
  const next = root.querySelector("[data-action=next]");
  const pos = root.querySelector("[data-out=pos]");
  const go = (i) => {
    at = Math.max(0, Math.min(count() , i));
    back.disabled = at === 0;
    next.disabled = at === count();
    pos.textContent = `${at} / ${count()}`;
    render(at);
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, button")) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: count() }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  });
  return { go, get at() { return at; } };
}

// ============================================================ Scheduling

const POLICY_TEXT = {
  fcfs: "First come, first served: the CPU goes to processes in arrival order, and each runs to completion. Simple, but a long job first makes everyone wait (the convoy effect).",
  sjf: "Shortest job first (non-preemptive): when the CPU is free, the arrived job with the smallest burst runs to completion. Optimal average waiting time among non-preemptive policies.",
  srtf: "Shortest remaining time first: SJF with preemption. A newly arrived job with less remaining time takes the CPU at once.",
  rr: "Round Robin: each process runs for at most one quantum, then goes to the back of the ready queue. Processes arriving at the same instant are queued before the one whose quantum just ended.",
  prio: "Priority (non-preemptive): the arrived job with the smallest priority number runs to completion. Low-priority jobs can starve.",
  mlfq: "Multilevel feedback queue: three levels, quantum q then 2q then FCFS. New jobs start at the top; using a whole quantum demotes a job; a job arriving at a higher level preempts. (No priority boost here.)",
};

function schedule(procs, policy, q) {
  const n = procs.length;
  const rem = procs.map((p) => p.burst);
  const first = new Array(n).fill(-1), done = new Array(n).fill(-1);
  const order = [];
  let finished = 0, t = 0, running = -1, qLeft = 0, level = new Array(n).fill(0);
  const ready = []; // RR: queue; others: set of arrived, unfinished, not running
  const queues = [[], [], []];
  const arrived = (i) => procs[i].arrival <= t;
  while (finished < n && t < 1000) {
    // Arrivals at t, in index order.
    for (let i = 0; i < n; i++) if (procs[i].arrival === t && rem[i] > 0) policy === "mlfq" ? queues[0].push(i) : ready.push(i);
    if (policy === "rr" && running >= 0 && qLeft === 0) { ready.push(running); running = -1; }
    if (policy === "mlfq" && running >= 0) {
      if (qLeft === 0) { level[running] = Math.min(2, level[running] + 1); queues[level[running]].push(running); running = -1; }
      else if (queues.slice(0, level[running]).some((qq) => qq.length)) { queues[level[running]].push(running); running = -1; }
    }
    const pick = (key) => {
      const cands = ready.filter(arrived);
      if (!cands.length) return -1;
      cands.sort((a, b) => key(a) - key(b) || procs[a].arrival - procs[b].arrival || a - b);
      ready.splice(ready.indexOf(cands[0]), 1);
      return cands[0];
    };
    if (policy === "srtf") {
      const cands = ready.filter(arrived).concat(running >= 0 ? [running] : []);
      if (cands.length) {
        cands.sort((a, b) => rem[a] - rem[b] || (b === running) - (a === running) || procs[a].arrival - procs[b].arrival || a - b);
        if (cands[0] !== running) {
          if (running >= 0) ready.push(running);
          running = cands[0];
          ready.splice(ready.indexOf(running), 1);
        }
      }
    } else if (running < 0) {
      if (policy === "fcfs") running = pick((i) => procs[i].arrival);
      else if (policy === "sjf") running = pick((i) => procs[i].burst);
      else if (policy === "prio") running = pick((i) => procs[i].prio);
      else if (policy === "rr") { running = ready.length ? ready.shift() : -1; qLeft = q; }
      else if (policy === "mlfq") {
        const lv = queues.findIndex((qq) => qq.length);
        if (lv >= 0) { running = queues[lv].shift(); qLeft = lv === 2 ? Infinity : lv === 0 ? q : 2 * q; }
      }
    }
    // Run one unit.
    const pid = running;
    if (order.length && order[order.length - 1].pid === pid) order[order.length - 1].end = t + 1;
    else order.push({ pid, start: t, end: t + 1 });
    if (pid >= 0) {
      if (first[pid] < 0) first[pid] = t;
      rem[pid]--; qLeft--;
      if (rem[pid] === 0) { done[pid] = t + 1; finished++; running = -1; }
    }
    t++;
  }
  // Trailing idle never happens; leading idle may.
  let cs = 0, prev = -1;
  for (const s of order) if (s.pid >= 0) { if (prev >= 0 && prev !== s.pid) cs++; prev = s.pid; }
  const stats = procs.map((p, i) => {
    const tat = done[i] - p.arrival;
    return { tat, wait: tat - p.burst, resp: first[i] - p.arrival };
  });
  return { order, stats, cs, end: t };
}

for (const root of document.querySelectorAll("[data-os-sched]")) {
  const svg = root.querySelector("[data-gantt]");
  const o = outs(root);
  const inputs = [...root.querySelectorAll("[data-proc]")];
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-swatch]").forEach((sw) => (sw.style.background = PALETTE[sw.dataset.swatch]));
  const read = () => {
    const ps = [];
    for (const inp of inputs) {
      const i = Number(inp.dataset.proc);
      ps[i] ??= { arrival: 0, burst: 1, prio: 0 };
      const v = Math.max(0, Math.round(Number(inp.value) || 0));
      ps[i][inp.dataset.k] = inp.dataset.k === "burst" ? Math.max(1, v) : v;
    }
    return ps;
  };
  const write = (rows) => rows.forEach((r, i) => ["arrival", "burst", "prio"].forEach((k, j) => {
    root.querySelector(`[data-proc="${i}"][data-k="${k}"]`).value = r[j];
  }));
  inputs.forEach((inp) => inp.addEventListener("input", draw));
  root.addEventListener("seg-change", draw);
  action(root, "convoy", () => { write([[0, 24, 3], [0, 3, 1], [0, 3, 4], [0, 2, 2], [0, 2, 5]]); setSeg(root, "fcfs"); draw(); });
  action(root, "reset", () => { write([[0, 8, 3], [1, 4, 1], [2, 9, 4], [3, 5, 2], [4, 2, 5]]); draw(); });

  function draw() {
    const policy = segValue(root) ?? "fcfs";
    const procs = read();
    const { order, stats, cs, end } = schedule(procs, policy, Math.round(s.quantum.get()));
    svg.replaceChildren();
    const L = 24, R = 624, y = 26, hgt = 44;
    const sx = (t) => L + ((R - L) * t) / end;
    for (const seg of order) {
      const x0 = sx(seg.start), x1 = sx(seg.end);
      if (seg.pid < 0) {
        el("rect", { x: x0, y, width: x1 - x0, height: hgt, style: "fill:none;stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, svg);
        if (x1 - x0 > 26) text(svg, (x0 + x1) / 2, y + hgt / 2 + 3, "idle", { "text-anchor": "middle" });
      } else {
        el("rect", { x: x0 + 0.5, y, width: Math.max(1, x1 - x0 - 1), height: hgt, rx: 3, style: `fill:${PALETTE[seg.pid]};fill-opacity:0.85` }, svg);
        if (x1 - x0 > 18) text(svg, (x0 + x1) / 2, y + hgt / 2 + 4, `P${seg.pid + 1}`, { "text-anchor": "middle", class: "fill-background font-mono text-[11px] font-medium" });
      }
    }
    const ticks = new Set([0, end, ...order.map((g) => g.start)]);
    let lastX = -99;
    for (const t of [...ticks].sort((a, b) => a - b)) {
      el("line", { x1: sx(t), x2: sx(t), y1: y + hgt, y2: y + hgt + 5, style: "stroke:currentColor;stroke-opacity:0.4" }, svg);
      if (sx(t) - lastX > 16) { text(svg, sx(t), y + hgt + 17, String(t), { "text-anchor": "middle" }); lastX = sx(t); }
    }
    text(svg, R, y + hgt + 34, "time (ms)", { "text-anchor": "end" });
    // Arrival marks.
    procs.forEach((p, i) => el("path", { d: `M${sx(p.arrival)} ${y - 3} l-3 -6 h6 z`, style: `fill:${PALETTE[i]}` }, svg));
    text(svg, L, 12, "▼ arrivals", { "text-anchor": "start" });
    stats.forEach((st, i) => {
      o[`w${i}`].textContent = st.wait;
      o[`t${i}`].textContent = st.tat;
      o[`r${i}`].textContent = st.resp;
    });
    const avg = (k) => num(stats.reduce((a, st) => a + st[k], 0) / stats.length, 2);
    o.aw.textContent = `${avg("wait")} ms`;
    o.at.textContent = `${avg("tat")} ms`;
    o.ar.textContent = `${avg("resp")} ms`;
    o.cs.textContent = String(cs);
    o.policy.textContent = POLICY_TEXT[policy];
  }
  draw();
}

// ============================================================ Process states

for (const root of document.querySelectorAll("[data-os-states]")) {
  const steps = [...root.querySelector("template[data-steps]").content.children].map((d) => ({ ...d.dataset }));
  const o = outs(root);
  const nodes = Object.fromEntries([...root.querySelectorAll("[data-node]")].map((n) => [n.dataset.node, n]));
  const edges = [...root.querySelectorAll("[data-edge]")];
  stepper(root, () => steps.length, (at) => {
    const where = {};
    let cs = 0, lastRunner = null;
    for (let i = 0; i < at; i++) {
      const st = steps[i];
      where[st.pid] = st.to;
      if (st.to === "running") { if (lastRunner && lastRunner !== st.pid) cs++; lastRunner = st.pid; }
    }
    const cur = steps[at - 1];
    for (const [name, g] of Object.entries(nodes)) {
      const who = Object.keys(where).filter((p) => where[p] === name);
      g.querySelector("[data-who]").textContent = who.join(" ");
      cur && cur.to === name ? (g.dataset.on = "") : delete g.dataset.on;
    }
    for (const e of edges) cur && e.dataset.edge === `${cur.from}>${cur.to}` ? (e.dataset.on = "") : delete e.dataset.on;
    o.text.textContent = cur ? cur.text : "Press Next to create the first process.";
    o.A.textContent = where.A ?? "—";
    o.B.textContent = where.B ?? "—";
    o.cs.textContent = String(cs);
  }).go(0);
}

// ============================================================ Paging

const PAGING_TRACE = [0x0c2a, 0x0c80, 0x0010, 0x0c00, 0x1404, 0x1700, 0x2bff, 0x3800, 0x0004, 0x0c2a, 0x3804];
const hex = (v, w) => "0x" + v.toString(16).toUpperCase().padStart(w, "0");

for (const root of document.querySelectorAll("[data-os-paging]")) {
  const o = outs(root);
  const bits = root.querySelector("[data-bits]");
  const ptEl = root.querySelector("[data-pt]");
  const tlbEl = root.querySelector("[data-tlb]");
  const framesEl = root.querySelector("[data-frames]");
  const traceEl = root.querySelector("[data-trace]");
  const vaInput = root.querySelector("[data-va]");
  let pt, frames, loadOrder, tlb, stats, traceAt, results, last;

  function reset() {
    pt = Array.from({ length: 16 }, () => ({ valid: false, frame: -1 }));
    frames = [3, null, 0, null]; // frame -> page
    pt[3] = { valid: true, frame: 0 };
    pt[0] = { valid: true, frame: 2 };
    loadOrder = [0, 3]; // FIFO order of loaded pages, oldest first
    tlb = []; // [{vpn, frame}], most recently used first, capacity 2
    stats = { hits: 0, misses: 0, faults: 0 };
    traceAt = 0;
    results = [];
    last = null;
    render();
  }

  function translate(va) {
    va &= 0x3fff;
    const vpn = va >> 10, off = va & 0x3ff;
    const r = { va, vpn, off, tlb: "miss", fault: false, evicted: null };
    const hit = tlb.findIndex((e) => e.vpn === vpn);
    if (hit >= 0) {
      stats.hits++;
      r.tlb = "hit";
      const [e] = tlb.splice(hit, 1);
      tlb.unshift(e);
      r.frame = e.frame;
    } else {
      stats.misses++;
      if (!pt[vpn].valid) {
        stats.faults++;
        r.fault = true;
        let f = frames.indexOf(null);
        if (f < 0) {
          const victim = loadOrder.shift();
          f = pt[victim].frame;
          pt[victim] = { valid: false, frame: -1 };
          tlb = tlb.filter((e) => e.vpn !== victim);
          r.evicted = victim;
        }
        frames[f] = vpn;
        pt[vpn] = { valid: true, frame: f };
        loadOrder.push(vpn);
      }
      r.frame = pt[vpn].frame;
      tlb.unshift({ vpn, frame: r.frame });
      if (tlb.length > 2) tlb.pop();
    }
    r.pa = (r.frame << 10) | off;
    last = r;
    return r;
  }

  const bitRow = (label, value, width, split, colors) => {
    const row = document.createElement("div");
    row.className = "flex flex-wrap items-center gap-2";
    const lab = document.createElement("span");
    lab.className = "w-20 font-mono text-[11px] text-muted-foreground";
    lab.textContent = label;
    const cells = document.createElement("span");
    cells.className = "flex gap-px";
    for (let i = width - 1; i >= 0; i--) {
      const c = document.createElement("span");
      c.className = "flex h-6 w-4 items-center justify-center rounded-sm font-mono text-[11px] sm:w-5";
      c.textContent = (value >> i) & 1;
      c.style.background = i >= split ? colors[0] : colors[1];
      c.style.color = "var(--background)";
      cells.append(c);
    }
    const val = document.createElement("span");
    val.className = "font-mono text-[11px] text-muted-foreground";
    val.textContent = hex(value, width > 12 ? 4 : 3);
    row.append(lab, cells, val);
    return row;
  };

  function render() {
    bits.replaceChildren();
    if (last) {
      bits.append(bitRow("virtual", last.va, 14, 10, ["var(--brand)", "color-mix(in oklab, var(--foreground) 45%, transparent)"]));
      bits.append(bitRow("physical", last.pa, 12, 10, ["var(--vec-u)", "color-mix(in oklab, var(--foreground) 45%, transparent)"]));
      const note = document.createElement("p");
      note.className = "text-xs leading-relaxed text-muted-foreground";
      note.textContent = `Page ${last.vpn}, offset ${hex(last.off, 3)}: TLB ${last.tlb}` +
        (last.fault ? `, page fault${last.evicted !== null ? ` (evicted page ${last.evicted}, the oldest)` : " (loaded into a free frame)"}` : last.tlb === "miss" ? ", found in the page table" : "") +
        ` → frame ${last.frame}, physical ${hex(last.pa, 3)}.`;
      bits.append(note);
    } else {
      const p = document.createElement("p");
      p.className = "text-xs text-muted-foreground";
      p.textContent = "Translate an address or step through the trace. Pink bits are the page number; the offset bits are copied as they are.";
      bits.append(p);
    }
    ptEl.replaceChildren(...pt.map((e, vpn) => {
      const c = document.createElement("span");
      c.className = "rounded border px-1 py-0.5 text-center " + (e.valid ? "" : "text-muted-foreground/50") + (last && last.vpn === vpn ? " border-brand text-brand" : "");
      c.textContent = e.valid ? `${vpn}→f${e.frame}` : `${vpn} –`;
      return c;
    }));
    tlbEl.replaceChildren(...[0, 1].map((i) => {
      const c = document.createElement("span");
      c.className = "rounded border px-2 py-0.5";
      c.textContent = tlb[i] ? `p${tlb[i].vpn} → f${tlb[i].frame}` : "empty";
      if (!tlb[i]) c.classList.add("text-muted-foreground/50");
      return c;
    }));
    framesEl.replaceChildren(...frames.map((p, f) => {
      const c = document.createElement("span");
      c.className = "rounded border px-2 py-0.5";
      c.textContent = p === null ? `f${f}: free` : `f${f}: page ${p}`;
      if (p === null) c.classList.add("text-muted-foreground/50");
      return c;
    }));
    traceEl.replaceChildren(...PAGING_TRACE.map((va, i) => {
      const c = document.createElement("span");
      const r = results[i];
      c.className = "rounded border px-1.5 py-0.5 " + (i === traceAt ? "border-foreground" : "") +
        (r ? (r.fault ? " border-del/50 bg-del/8 text-del" : r.tlb === "hit" ? " border-add/50 bg-add/8 text-add" : " text-muted-foreground") : " text-muted-foreground");
      c.textContent = hex(va, 4);
      c.title = r ? (r.fault ? "page fault" : `TLB ${r.tlb}`) : "not yet";
      return c;
    }));
    o.hits.textContent = stats.hits;
    o.misses.textContent = stats.misses;
    o.faults.textContent = stats.faults;
    o.last.textContent = last ? (last.fault ? "page fault" : `TLB ${last.tlb}`) : "—";
    root.querySelector("[data-action=step]").disabled = traceAt >= PAGING_TRACE.length;
  }

  action(root, "step", () => {
    if (traceAt >= PAGING_TRACE.length) return;
    results[traceAt] = translate(PAGING_TRACE[traceAt]);
    vaInput.value = hex(PAGING_TRACE[traceAt], 4);
    traceAt++;
    render();
  });
  action(root, "translate", () => {
    const v = parseInt(vaInput.value.replace(/^0x/i, ""), 16);
    if (!Number.isFinite(v) || v < 0 || v > 0x3fff) {
      bits.replaceChildren(Object.assign(document.createElement("p"), { className: "text-xs text-del", textContent: "Enter a hex address from 0x0000 to 0x3FFF (14 bits)." }));
      return;
    }
    translate(v);
    render();
  });
  vaInput.addEventListener("keydown", (e) => { if (e.key === "Enter") root.querySelector("[data-action=translate]").click(); });
  action(root, "reset", reset);
  reset();
}

// ============================================================ Page replacement

function replace(refs, nFrames, alg) {
  const frames = new Array(nFrames).fill(null);
  const lastUse = new Map(), bits = new Array(nFrames).fill(0);
  let hand = 0, fifo = 0, faults = 0;
  const cols = [];
  refs.forEach((p, t) => {
    let slot = frames.indexOf(p), fault = false, victim = null;
    if (slot >= 0) {
      if (alg === "clock") bits[slot] = 1;
    } else {
      fault = true;
      faults++;
      slot = frames.indexOf(null);
      if (slot < 0) {
        if (alg === "fifo") { slot = fifo; fifo = (fifo + 1) % nFrames; }
        else if (alg === "lru") slot = frames.reduce((b, q, i) => (lastUse.get(q) < lastUse.get(frames[b]) ? i : b), 0);
        else if (alg === "opt") {
          const nextUse = (q) => { const k = refs.indexOf(q, t + 1); return k < 0 ? Infinity : k; };
          slot = frames.reduce((b, q, i) => (nextUse(q) > nextUse(frames[b]) ? i : b), 0);
        } else {
          while (bits[hand] === 1) { bits[hand] = 0; hand = (hand + 1) % nFrames; }
          slot = hand;
          hand = (hand + 1) % nFrames;
        }
        victim = frames[slot];
      } else if (alg === "fifo") {
        fifo = (slot + 1) % nFrames;
      } else if (alg === "clock") {
        hand = (slot + 1) % nFrames;
      }
      frames[slot] = p;
      if (alg === "clock") bits[slot] = 1;
    }
    lastUse.set(p, t);
    cols.push({ page: p, frames: frames.slice(), fault, slot, victim, bits: bits.slice(), hand });
  });
  return { cols, faults };
}

for (const root of document.querySelectorAll("[data-os-replace]")) {
  const o = outs(root);
  const grid = root.querySelector("[data-grid]");
  const chart = root.querySelector("[data-chart]");
  const refsInput = root.querySelector("[data-refs]");
  const s = scrubAll(root, draw);
  refsInput.addEventListener("input", draw);
  root.addEventListener("seg-change", draw);
  action(root, "belady", () => {
    refsInput.value = "1 2 3 4 1 2 5 1 2 3 4 5";
    s.frames.set(3, false);
    setSeg(root, "fifo");
    draw();
  });

  function draw() {
    const refs = refsInput.value.split(/[\s,]+/).filter(Boolean).slice(0, 40);
    const F = Math.round(s.frames.get());
    const alg = segValue(root) ?? "fifo";
    const { cols, faults } = replace(refs, F, alg);
    // The grid: one column per reference.
    const table = document.createElement("table");
    table.className = "border-separate border-spacing-px font-mono text-[11px]";
    const head = table.insertRow();
    cols.forEach((c) => {
      const th = document.createElement("th");
      th.className = "w-7 px-1 pb-1 text-center font-medium";
      th.textContent = c.page;
      head.append(th);
    });
    for (let f = 0; f < F; f++) {
      const tr = table.insertRow();
      cols.forEach((c) => {
        const td = tr.insertCell();
        td.className = "h-6 w-7 rounded-sm text-center " + (c.frames[f] === null ? "text-muted-foreground/40" : "bg-foreground/5");
        if (c.fault && c.slot === f) td.className += " !bg-brand/15 text-brand";
        td.textContent = c.frames[f] ?? "·";
        if (alg === "clock" && c.frames[f] !== null && c.bits[f]) td.title = "reference bit 1";
      });
    }
    const tr = table.insertRow();
    cols.forEach((c) => {
      const td = tr.insertCell();
      td.className = "pt-1 text-center " + (c.fault ? "text-del" : "text-add");
      td.textContent = c.fault ? "F" : "✓";
      td.title = c.fault ? (c.victim !== null ? `fault, evicted ${c.victim}` : "fault, free frame") : "hit";
    });
    grid.replaceChildren(table);
    o.faults.textContent = String(faults);
    o.hits.textContent = String(refs.length - faults);
    o.rate.textContent = refs.length ? `${num((100 * faults) / refs.length, 1)}%` : "—";

    // Faults against frames for FIFO, LRU and OPT.
    chart.replaceChildren();
    const series = { fifo: [], lru: [], opt: [] };
    let top = 1;
    for (let k = 1; k <= 7; k++) for (const a in series) { const v = replace(refs, k, a).faults; series[a].push(v); top = Math.max(top, v); }
    const fr = frame(chart, { box: [40, 10, 460, 120], x: [1, 7], y: [0, top], xticks: [1, 2, 3, 4, 5, 6, 7], yticks: [0, Math.round(top / 2), top], xlabel: "frames", ylabel: "faults" });
    el("line", { x1: fr.sx(F), x2: fr.sx(F), y1: fr.T, y2: fr.T + fr.H, style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, chart);
    for (const [a, color] of [["fifo", "var(--foreground)"], ["lru", "var(--brand)"], ["opt", "var(--vec-u)"]]) {
      polyline(chart, series[a].map((v, i) => [fr.sx(i + 1), fr.sy(v)]), `stroke:${color};stroke-width:1.75`);
      series[a].forEach((v, i) => el("circle", { cx: fr.sx(i + 1), cy: fr.sy(v), r: 2.5, style: `fill:${color}` }, chart));
    }
    const anomaly = series.fifo.findIndex((v, i) => i > 0 && v > series.fifo[i - 1]);
    if (anomaly > 0) text(chart, fr.sx(anomaly + 1), fr.sy(series.fifo[anomaly]) - 8, `Belady: ${anomaly} → ${anomaly + 1} frames adds a fault`, { "text-anchor": "middle", class: "fill-brand font-mono text-[10px]" });
  }
  draw();
}

// ============================================================ Race condition

for (const root of document.querySelectorAll("[data-os-race]")) {
  const o = outs(root);
  const hist = root.querySelector("[data-hist]");
  const PLAIN = ["load  r ← counter", "add   r ← r + 1", "store counter ← r"];
  const LOCKED = ["lock(m)", ...PLAIN, "unlock(m)"];
  let prog, pc, reg, counter, owner, note;
  const mutex = () => isOn(root, "mutex");

  function reset() {
    prog = mutex() ? LOCKED : PLAIN;
    pc = { 1: 0, 2: 0 };
    reg = { 1: null, 2: null };
    counter = 0;
    owner = null;
    note = "";
    render();
  }

  function step(t) {
    const ins = prog[pc[t]];
    if (ins === undefined) return;
    if (ins.startsWith("lock")) {
      if (owner !== null && owner !== t) { note = `Thread ${t} waits: thread ${owner} holds m.`; return render(); }
      owner = t;
    } else if (ins.startsWith("unlock")) owner = null;
    else if (ins.startsWith("load")) reg[t] = counter;
    else if (ins.startsWith("add")) reg[t] += 1;
    else if (ins.startsWith("store")) counter = reg[t];
    note = "";
    pc[t]++;
    render();
  }

  function render() {
    for (const t of ["1", "2"]) {
      const list = root.querySelector(`[data-code="${t}"]`);
      list.replaceChildren(...prog.map((ins, i) => {
        const li = document.createElement("li");
        li.className = "rounded px-1.5 " + (i < pc[t] ? "text-muted-foreground line-through decoration-foreground/20" : i === pc[t] ? "bg-[var(--code-line-hl)]" : "");
        li.textContent = ins;
        return li;
      }));
      root.querySelector(`[data-reg="${t}"]`).textContent = reg[t] ?? "—";
      root.querySelector(`[data-run="${t}"]`).disabled = pc[t] >= prog.length;
    }
    o.counter.textContent = String(counter);
    const done = pc[1] >= prog.length && pc[2] >= prog.length;
    o.verdict.textContent = note || (done ? (counter === 2 ? "both increments counted" : "lost update: one increment vanished") : "");
    o.verdict.className = "text-xs " + (done && counter !== 2 ? "text-del" : done ? "text-add" : "text-muted-foreground");
  }

  root.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => step(b.dataset.run)));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, button")) return;
    if (e.key === "1" || e.key === "2") { e.preventDefault(); step(e.key); }
  });
  onToggle(root, () => { reset(); hist.replaceChildren(); });
  action(root, "reset", reset);
  action(root, "random", () => {
    // 1,000 runs of two threads doing 3 increments each, with a random
    // interleaving of their instructions.
    const rng = mulberry32(Date.now() & 0xffff);
    const P = mutex() ? LOCKED : PLAIN, N = 3, counts = new Map();
    for (let run = 0; run < 1000; run++) {
      let c = 0, own = null;
      const st = [1, 2].map(() => ({ i: 0, pc: 0, r: 0 }));
      while (st.some((x) => x.i < N)) {
        const live = [0, 1].filter((k) => st[k].i < N);
        const k = live[Math.floor(rng() * live.length)];
        const x = st[k], ins = P[x.pc];
        if (ins.startsWith("lock")) { if (own !== null && own !== k) continue; own = k; }
        else if (ins.startsWith("unlock")) own = null;
        else if (ins.startsWith("load")) x.r = c;
        else if (ins.startsWith("add")) x.r++;
        else c = x.r;
        if (++x.pc === P.length) { x.pc = 0; x.i++; }
      }
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const label = document.createElement("span");
    label.textContent = `3 increments each, 1,000 runs${mutex() ? " with the mutex" : ""}:`;
    hist.replaceChildren(label, ...[...counts].sort((a, b) => a[0] - b[0]).map(([v, n]) => {
      const sp = document.createElement("span");
      sp.className = "rounded border px-1.5 " + (v === 6 ? "border-add/50 text-add" : "border-del/40 text-del");
      sp.textContent = `${v} ×${n}`;
      return sp;
    }));
  });
  reset();
}

// ============================================================ Banker's algorithm

const BANK = {
  total: [10, 5, 7],
  alloc: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
  max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
};
const vle = (a, b) => a.every((v, i) => v <= b[i]);
const vadd = (a, b) => a.map((v, i) => v + b[i]);
const vsub = (a, b) => a.map((v, i) => v - b[i]);
const vstr = (a) => `(${a.join(", ")})`;

function safety(avail, alloc, need) {
  const n = alloc.length;
  let work = avail.slice(), start = 0;
  const finish = new Array(n).fill(false), seq = [], log = [];
  for (let round = 0; round < n; round++) {
    let chosen = -1;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!finish[i] && vle(need[i], work)) { chosen = i; break; }
    }
    if (chosen < 0) {
      log.push({ ok: false, text: `No unfinished process has Need ≤ Work ${vstr(work)}: unsafe.` });
      return { safe: false, seq, log };
    }
    const before = work;
    work = vadd(work, alloc[chosen]);
    finish[chosen] = true;
    seq.push(chosen);
    log.push({ ok: true, i: chosen, text: `P${chosen}: Need ${vstr(need[chosen])} ≤ Work ${vstr(before)} → it finishes and returns ${vstr(alloc[chosen])}; Work = ${vstr(work)}` });
    start = chosen + 1;
  }
  return { safe: true, seq, log };
}

for (const root of document.querySelectorAll("[data-os-banker]")) {
  const o = outs(root);
  const tables = root.querySelector("[data-tables]");
  const stepsEl = root.querySelector("[data-steps]");
  const pSel = root.querySelector("[data-req-p]");
  const reqIn = [...root.querySelectorAll("[data-req]")];
  let alloc, avail, verdict = "";
  const need = () => BANK.max.map((m, i) => vsub(m, alloc[i]));

  function reset() {
    alloc = BANK.alloc.map((r) => r.slice());
    avail = vsub(BANK.total, alloc.reduce((a, r) => vadd(a, r), [0, 0, 0]));
    verdict = "";
    render();
  }

  function render(highlight = null) {
    const nd = need();
    const res = safety(avail, alloc, nd);
    const t = document.createElement("table");
    t.className = "w-full min-w-[460px] font-mono text-xs";
    const h1 = t.insertRow();
    for (const [label, span] of [["", 1], ["Allocation", 3], ["Max", 3], ["Need", 3]]) {
      const th = document.createElement("th");
      th.colSpan = span;
      th.className = "pb-1 text-left font-sans text-[11px] font-normal text-muted-foreground";
      th.textContent = label;
      h1.append(th);
    }
    const h2 = t.insertRow();
    for (const l of ["", "A", "B", "C", "A", "B", "C", "A", "B", "C"]) {
      const th = document.createElement("th");
      th.className = "pb-1 text-left font-normal text-muted-foreground";
      th.textContent = l;
      h2.append(th);
    }
    alloc.forEach((row, i) => {
      const tr = t.insertRow();
      tr.className = "border-t " + (highlight === i ? "bg-brand/8" : "");
      const cells = [`P${i}`, ...row, ...BANK.max[i], ...nd[i]];
      cells.forEach((v, k) => {
        const td = tr.insertCell();
        td.className = "py-1 pr-2 tabular-nums " + (k >= 7 ? "text-brand" : "");
        td.textContent = v;
      });
    });
    tables.replaceChildren(t);
    stepsEl.replaceChildren(...res.log.map((l) => {
      const d = document.createElement("div");
      d.className = l.ok ? "" : "text-del";
      d.textContent = l.text;
      return d;
    }));
    o.avail.textContent = vstr(avail);
    o.state.textContent = res.safe ? "safe" : "unsafe";
    o.state.className = "tabular-nums " + (res.safe ? "text-add" : "text-del");
    o.seq.textContent = res.safe ? res.seq.map((i) => `P${i}`).join(", ") : "none";
    o.verdict.textContent = verdict;
  }

  function request() {
    const p = Number(pSel.value);
    const req = reqIn.map((i) => Math.max(0, Math.round(Number(i.value) || 0)));
    const nd = need();
    if (!vle(req, nd[p])) verdict = `Error: P${p} asks ${vstr(req)} but its remaining Need is only ${vstr(nd[p])}.`;
    else if (!vle(req, avail)) verdict = `P${p} must wait: ${vstr(req)} exceeds Available ${vstr(avail)}.`;
    else {
      const a2 = alloc.map((r, i) => (i === p ? vadd(r, req) : r.slice()));
      const av2 = vsub(avail, req);
      const res = safety(av2, a2, BANK.max.map((m, i) => vsub(m, a2[i])));
      if (res.safe) {
        alloc = a2;
        avail = av2;
        verdict = `Granted: the new state is safe (sequence ${res.seq.map((i) => `P${i}`).join(", ")}).`;
      } else verdict = `Denied: granting ${vstr(req)} to P${p} would leave an unsafe state, so P${p} waits.`;
    }
    render(p);
  }

  action(root, "request", request);
  action(root, "reset", reset);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const [p, v] = b.dataset.preset.split(":");
    pSel.value = p;
    v.split(",").forEach((x, i) => (reqIn[i].value = x));
    request();
  }));
  reset();
}

// ============================================================ Dining philosophers

for (const root of document.querySelectorAll("[data-os-dining]")) {
  const svg = root.querySelector("[data-table]");
  const o = outs(root);
  const playBtn = root.querySelector("[data-action=play]");
  const N = 5;
  let rng, ph, forks, tick, timer = 0, playing = false, visible = false, deadlocked = false;
  const left = (i) => i, right = (i) => (i + 1) % N;

  function reset() {
    rng = mulberry32(17);
    ph = Array.from({ length: N }, () => ({ state: "thinking", t: 1 + Math.floor(rng() * 8), meals: 0 }));
    forks = new Array(N).fill(null);
    tick = 0;
    deadlocked = false;
    setPlaying(false);
    render();
  }

  function want(i, strat) {
    // Forks in the order philosopher i picks them up.
    const a = left(i), b = right(i);
    return strat === "ordered" ? [Math.min(a, b), Math.max(a, b)] : [a, b];
  }

  function stepOnce() {
    const strat = segValue(root) ?? "naive";
    tick++;
    const start = tick % N;
    for (let k = 0; k < N; k++) {
      const i = (start + k) % N, p = ph[i];
      if (p.state === "thinking") {
        if (--p.t <= 0) p.state = "hungry";
      } else if (p.state === "hungry") {
        const [f1, f2] = want(i, strat);
        if (forks[f1] !== i) {
          const seated = forks.reduce((s, h) => s.add(h), new Set()).size - (forks.includes(null) ? 1 : 0);
          if (forks[f1] === null && !(strat === "waiter" && seated >= N - 1)) forks[f1] = i;
        } else if (forks[f2] === null) {
          forks[f2] = i;
          p.state = "eating";
          p.t = 2 + Math.floor(rng() * 3);
        }
      } else if (p.state === "eating") {
        if (--p.t <= 0) {
          forks.forEach((h, f) => { if (h === i) forks[f] = null; });
          p.meals++;
          p.state = "thinking";
          p.t = 2 + Math.floor(rng() * 6);
        }
      }
    }
    deadlocked = ph.every((p) => p.state === "hungry") && forks.every((h) => h !== null);
    if (deadlocked) setPlaying(false);
    render();
  }

  function render() {
    svg.replaceChildren();
    el("circle", { cx: 0, cy: 0, r: 62, style: "fill:color-mix(in oklab, var(--foreground) 4%, transparent);stroke:var(--border)" }, svg);
    const ang = (k) => -Math.PI / 2 + (2 * Math.PI * k) / N;
    for (let f = 0; f < N; f++) {
      // Fork f lies between philosopher f and f+1, or next to its holder.
      const h = forks[f];
      const a = h === null ? ang(f + 0.5) : ang(h) + (f === left(h) ? 0.32 : -0.32);
      const r1 = h === null ? 40 : 70, r2 = h === null ? 60 : 88;
      el("line", { x1: Math.cos(a) * r1, y1: Math.sin(a) * r1, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2,
        style: `stroke:${h === null ? "var(--muted-foreground)" : "var(--foreground)"};stroke-width:3;stroke-linecap:round` }, svg);
    }
    ph.forEach((p, i) => {
      const a = ang(i), x = Math.cos(a) * 115, y = Math.sin(a) * 115;
      const color = { thinking: "var(--muted-foreground)", hungry: "var(--vec-out)", eating: "var(--brand)" }[p.state];
      el("circle", { cx: x, cy: y, r: 25, style: `fill:var(--background);stroke:${color};stroke-width:2.5` }, svg);
      text(svg, x, y - 1, `P${i}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px] font-medium" });
      text(svg, x, y + 11, p.state, { "text-anchor": "middle", style: `fill:${color}`, class: "font-mono text-[8px]" });
    });
    o.meals.textContent = ph.map((p, i) => `P${i} ${p.meals}`).join(" · ");
    o.tick.textContent = String(tick);
    const strat = segValue(root) ?? "naive";
    o.status.textContent = deadlocked
      ? "Deadlock: every philosopher holds one fork and waits for the other, a circular wait. Nobody can ever eat."
      : { naive: "Everyone takes the left fork, then the right. Press All hungry to see them deadlock.",
          ordered: "Each takes the lower-numbered fork first; P4 reaches for fork 0 before fork 4, so no cycle of waits can form.",
          waiter: "A waiter lets at most four philosophers hold forks at once, so at least one can always get both." }[strat];
    o.status.className = "min-h-10 text-xs leading-relaxed " + (deadlocked ? "text-del" : "text-muted-foreground");
  }

  function loop() {
    timer = 0;
    if (!playing || !visible) return;
    stepOnce();
    if (playing) timer = setTimeout(loop, reducedMotion() ? 120 : 260);
  }
  function setPlaying(p) {
    playing = p;
    playBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    playBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    playBtn.querySelector("[data-label]").textContent = p ? "Pause" : "Run";
    clearTimeout(timer);
    if (p) loop();
  }
  playBtn.addEventListener("click", () => { if (deadlocked) reset(); setPlaying(!playing); });
  action(root, "hungry", () => {
    if (deadlocked) reset();
    ph.forEach((p) => { if (p.state === "thinking") { p.state = "hungry"; p.t = 0; } });
    stepOnce();
  });
  action(root, "reset", reset);
  root.addEventListener("seg-change", reset);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !timer) loop(); }).observe(root);
  reset();
}

// ============================================================ Inode

const human = (b) => {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${i ? num(v, 2) : v} ${u[i]}`;
};

for (const root of document.querySelectorAll("[data-os-inode]")) {
  const svg = root.querySelector("[data-diagram]");
  const o = outs(root);
  const offIn = root.querySelector("[data-offset]");
  const unitSel = root.querySelector("[data-unit]");
  offIn.addEventListener("input", draw);
  unitSel.addEventListener("change", draw);
  root.addEventListener("seg-change", draw);

  function locate(lb, k) {
    if (lb < 12) return { level: 0, idx: [lb] };
    lb -= 12;
    if (lb < k) return { level: 1, idx: [lb] };
    lb -= k;
    if (lb < k * k) return { level: 2, idx: [Math.floor(lb / k), lb % k] };
    lb -= k * k;
    return { level: 3, idx: [Math.floor(lb / (k * k)), Math.floor(lb / k) % k, lb % k] };
  }

  function draw() {
    const B = Number(segValue(root) ?? 1024), k = B / 4;
    const maxBlocks = 12 + k + k * k + k * k * k;
    const off = Math.max(0, Number(offIn.value) || 0) * Number(unitSel.value);
    const lb = Math.floor(off / B);
    const beyond = lb >= maxBlocks;
    const loc = beyond ? null : locate(lb, k);
    o.k.textContent = fmtInt.format(k);
    o.max.textContent = `${human(maxBlocks * B)} (${fmtInt.format(maxBlocks * B)} B)`;
    o.lb.textContent = beyond ? "beyond the maximum" : fmtInt.format(lb);
    o.path.textContent = beyond ? "—" : ["direct", "single", "double", "triple"][loc.level] + loc.idx.map((x) => `[${fmtInt.format(x)}]`).join("");
    o.reads.textContent = beyond ? "—" : `${loc.level + 2} (inode, ${loc.level ? `${loc.level} indirect block${loc.level > 1 ? "s" : ""}, ` : ""}data)`;

    // Diagram: the inode's 15 pointers, the chain to the target block.
    svg.replaceChildren();
    const on = "var(--brand)", off_ = "color-mix(in oklab, var(--foreground) 30%, transparent)";
    el("rect", { x: 10, y: 20, width: 120, height: 260, rx: 8, style: "fill:var(--background);stroke:var(--border)" }, svg);
    text(svg, 70, 14, "inode", { "text-anchor": "middle", class: "fill-foreground text-[11px] font-medium" });
    const slotY = (s) => 32 + s * 16;
    for (let s = 0; s < 15; s++) {
      const active = loc && ((s < 12 && loc.level === 0 && loc.idx[0] === s) || (s === 11 + loc.level && loc.level > 0));
      el("rect", { x: 22, y: slotY(s), width: 96, height: 13, rx: 3, style: `fill:${active ? "color-mix(in oklab, var(--brand) 15%, transparent)" : "transparent"};stroke:${active ? on : "var(--border)"}` }, svg);
      text(svg, 28, slotY(s) + 10, s < 12 ? `direct ${s}` : ["single indirect", "double indirect", "triple indirect"][s - 12], { class: "fill-muted-foreground font-mono text-[8.5px]" });
    }
    // Columns of indirect blocks then the data block.
    const levels = loc ? loc.level : 0;
    const colX = (c) => 190 + c * 120;
    let prevX = 118, prevY = loc ? (loc.level === 0 ? slotY(loc.idx[0]) + 6 : slotY(11 + loc.level) + 6) : 0;
    for (let c = 0; c < levels; c++) {
      const x = colX(c), y = 60 + c * 50;
      el("rect", { x, y, width: 92, height: 90, rx: 6, style: `fill:var(--background);stroke:${on}` }, svg);
      text(svg, x + 46, y - 6, `indirect (${fmtInt.format(k)} ptrs)`, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[8.5px]" });
      text(svg, x + 46, y + 50, `[${fmtInt.format(loc.idx[c])}]`, { "text-anchor": "middle", class: "fill-brand font-mono text-[11px]" });
      el("path", { d: `M${prevX} ${prevY} C${(prevX + x) / 2} ${prevY} ${(prevX + x) / 2} ${y + 45} ${x} ${y + 45}`, style: `fill:none;stroke:${on};stroke-width:1.5` }, svg);
      prevX = x + 92; prevY = y + 45;
    }
    if (loc) {
      const x = colX(levels), y = 70 + levels * 50;
      el("rect", { x, y, width: 92, height: 50, rx: 6, style: `fill:color-mix(in oklab, var(--brand) 12%, transparent);stroke:${on}` }, svg);
      text(svg, x + 46, y + 22, "data block", { "text-anchor": "middle", class: "fill-foreground text-[10px]" });
      text(svg, x + 46, y + 36, `byte ${fmtInt.format(off % B)} of ${fmtInt.format(B)}`, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[8.5px]" });
      el("path", { d: `M${prevX} ${prevY} C${(prevX + x) / 2} ${prevY} ${(prevX + x) / 2} ${y + 25} ${x} ${y + 25}`, style: `fill:none;stroke:${on};stroke-width:1.5` }, svg);
    } else {
      text(svg, 330, 150, "Offset beyond the largest possible file", { "text-anchor": "middle", class: "fill-del text-[11px]" });
    }
    // Capacity of each level, as a reminder.
    const caps = [12, k, k * k, k * k * k].map((n) => human(n * B));
    text(svg, 610, 290, `reach: direct ${caps[0]} · single ${caps[1]} · double ${caps[2]} · triple ${caps[3]}`, { "text-anchor": "end", class: "fill-muted-foreground font-mono text-[8.5px]" });
    void off_;
  }
  draw();
}

// ============================================================ Disk scheduling

function diskPath(queue, head, alg, up, max = 199) {
  const path = [{ c: head }];
  const rest = queue.slice();
  const go = (c, jump = false) => path.push({ c, jump });
  const take = (c) => { rest.splice(rest.indexOf(c), 1); go(c); };
  if (alg === "fcfs") queue.forEach((c) => go(c));
  else if (alg === "sstf") {
    let at = head;
    while (rest.length) {
      const c = rest.reduce((b, x) => (Math.abs(x - at) < Math.abs(b - at) || (Math.abs(x - at) === Math.abs(b - at) && x < b) ? x : b));
      take(c);
      at = c;
    }
  } else {
    const lower = rest.filter((c) => c < head).sort((a, b) => b - a);
    const upper = rest.filter((c) => c >= head).sort((a, b) => a - b);
    const first = up ? upper : lower, second = up ? lower : upper;
    first.forEach((c) => go(c));
    const end = up ? max : 0, other = up ? 0 : max;
    if (alg === "scan") { if (second.length) { go(end); second.forEach((c) => go(c)); } }
    else if (alg === "look") second.forEach((c) => go(c));
    else if (alg === "cscan") {
      if (second.length) { go(end); go(other, true); second.slice().reverse().forEach((c) => go(c)); }
    } else if (alg === "clook") {
      if (second.length) { const s2 = second.slice().reverse(); go(s2[0], true); s2.slice(1).forEach((c) => go(c)); }
    }
  }
  return path;
}

for (const root of document.querySelectorAll("[data-os-disk]")) {
  const svg = root.querySelector("[data-chart]");
  const o = outs(root);
  const qIn = root.querySelector("[data-queue]");
  const s = scrubAll(root, draw);
  qIn.addEventListener("input", draw);
  root.addEventListener("seg-change", draw);
  onToggle(root, draw);

  function draw() {
    const queue = qIn.value.split(/[\s,]+/).map(Number).filter((c) => Number.isInteger(c) && c >= 0 && c <= 199).slice(0, 30);
    const head = Math.round(s.head.get());
    const alg = segValue(root) ?? "fcfs";
    const path = diskPath(queue, head, alg, isOn(root, "up"));
    const countJump = isOn(root, "jump");
    let total = 0;
    for (let i = 1; i < path.length; i++) if (!path[i].jump || countJump) total += Math.abs(path[i].c - path[i - 1].c);
    svg.replaceChildren();
    const f = frame(svg, { box: [30, 22, 556, 250], x: [0, 199], y: [path.length - 1 || 1, 0], xticks: [0, 50, 100, 150, 199], yticks: [], xlabel: "cylinder" });
    // Requests as faint guide lines.
    for (const c of queue) el("line", { x1: f.sx(c), x2: f.sx(c), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.08" }, svg);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      el("line", { x1: f.sx(a.c), y1: f.sy(i - 1), x2: f.sx(b.c), y2: f.sy(i),
        style: `stroke:var(--brand);stroke-width:1.75;${b.jump ? "stroke-dasharray:4 4;stroke-opacity:0.6" : ""}` }, svg);
    }
    path.forEach((p, i) => {
      const isReq = i > 0 && queue.includes(p.c);
      el("circle", { cx: f.sx(p.c), cy: f.sy(i), r: isReq ? 3.5 : 2.5, style: `fill:${i === 0 ? "var(--foreground)" : isReq ? "var(--brand)" : "var(--background)"};stroke:var(--brand);stroke-width:1.25` }, svg);
      if (i === 0 || isReq) text(svg, f.sx(p.c) + 7, f.sy(i) - 5, String(p.c));
    });
    text(svg, 30, 12, "time ↓", { "text-anchor": "start" });
    o.total.textContent = `${total} cylinders`;
    o.order.textContent = path.map((p) => (p.jump ? `⤳${p.c}` : p.c)).join(" → ");
  }
  draw();
}

// ============================================================ Contiguous allocation

const ALLOC_SCRIPT = [
  ["A", 212], ["B", 417], ["C", 112], ["D", 180], ["free", "B"], ["E", 300], ["free", "D"],
  ["F", 90], ["free", "A"], ["G", 150], ["H", 260], ["free", "C"], ["I", 420],
];
const HEAP = 1000;

for (const root of document.querySelectorAll("[data-os-alloc]")) {
  const o = outs(root);
  const bar = root.querySelector("[data-bar]");
  const scriptEl = root.querySelector("[data-script]");
  let segsM, at, rover, failed, results, event;

  function reset() {
    segsM = [{ start: 0, size: HEAP, owner: null }];
    at = 0;
    rover = 0;
    failed = 0;
    results = [];
    event = "";
    render();
  }

  function stepOnce() {
    if (at >= ALLOC_SCRIPT.length) return;
    const [a, b] = ALLOC_SCRIPT[at];
    const policy = segValue(root) ?? "first";
    if (a === "free") {
      const sgm = segsM.find((x) => x.owner === b);
      if (sgm) {
        sgm.owner = null;
        // Merge neighbouring holes.
        segsM = segsM.reduce((acc, x) => {
          const prev = acc[acc.length - 1];
          if (prev && prev.owner === null && x.owner === null) prev.size += x.size;
          else acc.push({ ...x });
          return acc;
        }, []);
        event = `free(${b}): ${sgm.size} KB returned${segsM.length ? "" : ""}.`;
      } else event = `free(${b}): ${b} was never allocated.`;
      results[at] = "ok";
    } else {
      const holes = segsM.map((x, i) => ({ ...x, i })).filter((x) => x.owner === null && x.size >= b);
      let pick = null;
      if (policy === "first") pick = holes[0];
      else if (policy === "best") pick = holes.reduce((m, x) => (!m || x.size < m.size ? x : m), null);
      else if (policy === "worst") pick = holes.reduce((m, x) => (!m || x.size > m.size ? x : m), null);
      else pick = holes.find((x) => x.start >= rover) ?? holes[0];
      if (!pick) {
        failed++;
        results[at] = "fail";
        const freeTotal = segsM.filter((x) => x.owner === null).reduce((s, x) => s + x.size, 0);
        const largest = Math.max(0, ...segsM.filter((x) => x.owner === null).map((x) => x.size));
        event = freeTotal >= b
          ? `${a} (${b} KB) fails: ${freeTotal} KB are free in total, but the largest hole is ${largest} KB. External fragmentation.`
          : `${a} (${b} KB) fails: only ${freeTotal} KB are free.`;
      } else {
        const hole = segsM[pick.i];
        const used = { start: hole.start, size: b, owner: a };
        const restSize = hole.size - b;
        segsM.splice(pick.i, 1, used, ...(restSize ? [{ start: hole.start + b, size: restSize, owner: null }] : []));
        rover = hole.start + b;
        results[at] = "ok";
        event = `${a} (${b} KB) placed at ${hole.start} KB in a ${hole.size} KB hole${restSize ? `, leaving ${restSize} KB` : ""}.`;
      }
    }
    at++;
    render();
  }

  function render() {
    bar.replaceChildren(...segsM.map((x) => {
      const d = document.createElement("div");
      d.className = "absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-background font-mono text-[11px] " +
        (x.owner === null ? "bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--foreground)_8%,transparent)_5px_6px)] text-muted-foreground" : "text-background");
      d.style.left = `${(100 * x.start) / HEAP}%`;
      d.style.width = `${(100 * x.size) / HEAP}%`;
      if (x.owner !== null) d.style.background = PALETTE["ABCDEFGHI".indexOf(x.owner) % PALETTE.length];
      d.textContent = x.size >= 60 ? (x.owner ? `${x.owner} ${x.size}` : `${x.size}`) : "";
      d.title = `${x.owner ?? "hole"}: ${x.size} KB at ${x.start} KB`;
      return d;
    }));
    scriptEl.replaceChildren(...ALLOC_SCRIPT.map(([a, b], i) => {
      const c = document.createElement("span");
      const r = results[i];
      c.className = "rounded border px-1.5 py-0.5 " + (i === at ? "border-foreground" : "") +
        (r === "fail" ? " border-del/50 bg-del/8 text-del" : r ? " text-muted-foreground line-through decoration-foreground/20" : "");
      c.textContent = a === "free" ? `free ${b}` : `${a} ${b}`;
      return c;
    }));
    const holes = segsM.filter((x) => x.owner === null);
    o.free.textContent = `${holes.reduce((s, x) => s + x.size, 0)} KB`;
    o.largest.textContent = `${Math.max(0, ...holes.map((x) => x.size))} KB`;
    o.holes.textContent = String(holes.length);
    o.failed.textContent = String(failed);
    o.event.textContent = event;
    root.querySelector("[data-action=step]").disabled = at >= ALLOC_SCRIPT.length;
  }

  action(root, "step", stepOnce);
  action(root, "run", () => { while (at < ALLOC_SCRIPT.length) stepOnce(); });
  action(root, "reset", reset);
  root.addEventListener("seg-change", reset);
  reset();
}

// ============================================================ System call

for (const root of document.querySelectorAll("[data-os-syscall]")) {
  const all = [...root.querySelector("template[data-steps]").content.children].map((d) => ({ ...d.dataset, miss: d.hasAttribute("data-miss") }));
  const o = outs(root);
  const lanes = Object.fromEntries([...root.querySelectorAll("[data-lane]")].filter((n) => n.tagName === "DIV").map((n) => [n.dataset.lane, n]));
  let steps = all.filter((s) => !s.miss);
  const st = stepper(root, () => steps.length, (at) => {
    for (const l of Object.values(lanes)) l.replaceChildren();
    steps.slice(0, at).forEach((s, i) => {
      const chip = document.createElement("span");
      chip.className = "rounded-md border px-2 py-1 font-mono text-[11px] " + (i === at - 1 ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground");
      chip.textContent = `${i + 1}. ${s.title}`;
      lanes[s.lane].append(chip);
    });
    o.text.textContent = at ? steps[at - 1].text : "Press Next to follow the call.";
  });
  onToggle(root, (k, miss) => { steps = all.filter((s) => miss || !s.miss); st.go(0); });
  st.go(0);
}
