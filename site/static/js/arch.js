// Computer architecture blocks: binary arithmetic, a ripple-carry adder
// with gate delays, a toy CPU, IEEE 754, the memory hierarchy, a cache
// simulator, a 5-stage pipeline and Amdahl's law.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { reducedMotion } from "./svg.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const minus = (s) => String(s).replace("-", "−");
const hex = (v, w = 2) => "0x" + v.toString(16).toUpperCase().padStart(w, "0");
const bin = (v, w) => v.toString(2).padStart(w, "0");

// Bit buttons rendered by archBits: read and write their value.
function bitGroup(root, name, onChange) {
  const btns = [...root.querySelectorAll(`[data-bits="${name}"] [data-bit]`)];
  const get = () => btns.reduce((v, b) => v | ((b.getAttribute("aria-pressed") === "true" ? 1 : 0) << Number(b.dataset.bit)), 0);
  const set = (v) => btns.forEach((b) => {
    const on = (v >> Number(b.dataset.bit)) & 1;
    b.setAttribute("aria-pressed", String(!!on));
    b.querySelector("[data-digit]").textContent = on;
  });
  btns.forEach((b) => b.addEventListener("click", () => { set(get() ^ (1 << Number(b.dataset.bit))); onChange(); }));
  return { get, set };
}

// ============================================================ Binary

for (const root of document.querySelectorAll("[data-arch-binary]")) {
  const o = outs(root);
  const sum = root.querySelector("[data-sum]");
  const flags = Object.fromEntries([...root.querySelectorAll("[data-flag]")].map((n) => [n.dataset.flag, n]));
  const signed = (v) => (v & 0x80 ? v - 256 : v);
  const A = bitGroup(root, "a", draw), B = bitGroup(root, "b", draw);

  function draw() {
    const a = A.get(), b = B.get(), raw = a + b, s = raw & 0xff;
    for (const [k, v] of [["a", a], ["b", b], ["sum", s]]) {
      o[`${k}-u`].textContent = v;
      o[`${k}-s`].textContent = minus(signed(v));
      o[`${k}-h`].textContent = hex(v);
    }
    sum.innerHTML = [...bin(s, 8)].map((d) => `<span class="flex h-10 w-8 items-center justify-center rounded-md border font-mono text-base ${d === "1" ? "border-brand/60 bg-brand/10 text-brand" : ""}">${d}</span>`).join("");
    const c = raw > 0xff;
    const v = ((a ^ s) & (b ^ s) & 0x80) !== 0; // operands share a sign the result lacks
    const on = { c, v, z: s === 0, n: (s & 0x80) !== 0 };
    for (const k in flags) on[k] ? (flags[k].dataset.on = "") : delete flags[k].dataset.on;
    o.note.textContent = v
      ? `Signed overflow: ${signed(a)} + ${signed(b)} = ${signed(a) + signed(b)} does not fit in −128…127, so it wraps to ${signed(s)}.`.replaceAll("-", "−")
      : c ? `Unsigned overflow: ${a} + ${b} = ${raw} does not fit in 0…255; the carry out is the lost 256.` : "";
  }
  root.querySelector("[data-action=negate]").addEventListener("click", () => { A.set((~A.get() + 1) & 0xff); draw(); });
  root.querySelector("[data-action=minus1]").addEventListener("click", () => { A.set(0xff); draw(); });
  draw();
}

// ============================================================ Ripple-carry adder

// Worst-case timing, one unit per gate: p = a⊕b and g = a·b at t = 1;
// c(i+1) = g + c(i)·p arrives two gates after c(i); s = p⊕c one gate after both.
function adderTiming(a, b, cin) {
  const bits = [];
  let c = cin, tc = 0;
  for (let i = 0; i < 4; i++) {
    const ai = (a >> i) & 1, bi = (b >> i) & 1, p = ai ^ bi, g = ai & bi;
    const tand = Math.max(tc, 1) + 1;
    const s = p ^ c, ts = Math.max(tc, 1) + 1;
    const cout = g | (c & p), tcout = tand + 1;
    bits.push({ ai, bi, p, g, cin: c, tcin: tc, s, ts, cout, tcout });
    c = cout; tc = tcout;
  }
  return { bits, cout: c, tdone: tc };
}

for (const root of document.querySelectorAll("[data-arch-adder]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let cin = 0, timer = 0;
  const A = bitGroup(root, "a", draw), B = bitGroup(root, "b", draw);
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { cin = on ? 1 : 0; draw(); });

  const wireStyle = (valid, v) => valid ? `stroke:${v ? "var(--brand)" : "var(--foreground)"};stroke-width:2` : "stroke:currentColor;stroke-opacity:0.25;stroke-width:2;stroke-dasharray:4 3";
  const label = (x, y, valid, v, anchor = "middle") =>
    text(svg, x, y, valid ? String(v) : "?", { "text-anchor": anchor, class: valid ? (v ? "fill-brand font-mono text-[12px]" : "fill-foreground font-mono text-[12px]") : "fill-muted-foreground font-mono text-[12px]" });

  function draw() {
    const t = s.t.get();
    const { bits, cout, tdone } = adderTiming(A.get(), B.get(), cin);
    svg.replaceChildren();
    // Bit 3 on the left, bit 0 on the right; carries flow right to left.
    const X = (i) => 470 - i * 130, Y = 110, W = 86, Hh = 80;
    bits.forEach((bt, i) => {
      const x = X(i);
      el("rect", { x: x - W / 2, y: Y, width: W, height: Hh, rx: 8, style: "fill:var(--code-bg);stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.5" }, svg);
      text(svg, x, Y + 26, `FA${i}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
      text(svg, x, Y + 44, `p=${t >= 1 ? bt.p : "?"} g=${t >= 1 ? bt.g : "?"}`, { "text-anchor": "middle" });
      text(svg, x, Y + 60, `ready at t=${bt.tcout}`, { "text-anchor": "middle" });
      // Inputs a, b from the top (valid from t = 0).
      for (const [dx, v, n] of [[-20, bt.ai, "a"], [20, bt.bi, "b"]]) {
        el("line", { x1: x + dx, x2: x + dx, y1: 46, y2: Y, style: wireStyle(true, v) }, svg);
        label(x + dx, 40, true, v);
        text(svg, x + dx, 26, `${n}${i}`, { "text-anchor": "middle" });
      }
      // Sum out the bottom.
      const sv = t >= bt.ts;
      el("line", { x1: x, x2: x, y1: Y + Hh, y2: 232, style: wireStyle(sv, bt.s) }, svg);
      label(x, 250, sv, bt.s);
      text(svg, x, 266, `s${i}`, { "text-anchor": "middle" });
      // Carry in from the right.
      const cv = t >= bt.tcin;
      el("line", { x1: x + W / 2, x2: x + W / 2 + 22, y1: Y + Hh / 2, y2: Y + Hh / 2, style: wireStyle(cv, bt.cin) }, svg);
      if (i === 0) { label(x + W / 2 + 32, Y + Hh / 2 + 4, cv, bt.cin, "start"); text(svg, x + W / 2 + 32, Y + Hh / 2 - 10, "cin", {}); }
      else label(x + W / 2 + 22, Y + Hh / 2 - 8, cv, bt.cin);
    });
    // Final carry out on the left.
    const cov = t >= tdone;
    el("line", { x1: X(3) - W / 2 - 30, x2: X(3) - W / 2, y1: Y + Hh / 2, y2: Y + Hh / 2, style: wireStyle(cov, cout) }, svg);
    label(X(3) - W / 2 - 38, Y + Hh / 2 + 4, cov, cout, "end");
    text(svg, X(3) - W / 2 - 38, Y + Hh / 2 - 10, "cout", { "text-anchor": "end" });
    text(svg, 12, 292, `t = ${t} gate delay${t === 1 ? "" : "s"}`, { class: "fill-foreground font-mono text-[11px]" });

    const total = A.get() + B.get() + cin;
    o.sum.textContent = `${A.get()} + ${B.get()}${cin ? " + 1" : ""} = ${total} (${cout}${bits.map((b) => b.s).reverse().join("")}₂)`;
    o.settled.textContent = t >= tdone ? "all outputs valid" : `${bits.filter((b) => t >= b.ts).length}/4 sums, carry ${t >= tdone ? "ready" : "pending"}`;
    o.path.textContent = `${tdone} gate delays = 2n + 1 for n = 4`;
  }

  const replay = () => {
    clearInterval(timer);
    if (reducedMotion()) { s.t.set(9, false); draw(); return; }
    let t = 0;
    s.t.set(0, false); draw();
    timer = setInterval(() => {
      t++;
      s.t.set(t, false); draw();
      if (t >= 9) clearInterval(timer);
    }, 260);
  };
  root.querySelector("[data-action=replay]").addEventListener("click", replay);
  root.querySelector("[data-action=settle]").addEventListener("click", () => { clearInterval(timer); s.t.set(9, false); draw(); });
  draw();
}

// ============================================================ Tiny CPU

const OPS = ["HALT", "LOAD", "STORE", "ADD", "SUB", "JMP", "JZ", "OUT"];
const enc = (op, a = 0) => (OPS.indexOf(op) << 5) | a;
const PROGRAMS = {
  add: { code: [enc("LOAD", 10), enc("ADD", 11), enc("STORE", 12), enc("OUT"), enc("HALT")], data: { 10: 7, 11: 5, 12: 0 }, labels: { 10: "x", 11: "y", 12: "sum" } },
  count: {
    code: [enc("LOAD", 10), enc("OUT"), enc("SUB", 11), enc("STORE", 10), enc("JZ", 6), enc("JMP", 0), enc("HALT")],
    data: { 10: 3, 11: 1 }, labels: { 10: "n", 11: "one" },
  },
  mul: {
    code: [enc("LOAD", 20), enc("JZ", 9), enc("SUB", 22), enc("STORE", 20), enc("LOAD", 21), enc("ADD", 23), enc("STORE", 21), enc("JMP", 0), enc("HALT"), enc("LOAD", 21), enc("OUT"), enc("HALT")],
    data: { 20: 4, 21: 0, 22: 1, 23: 6 }, labels: { 20: "count", 21: "result", 22: "one", 23: "a" },
  },
};
const disasm = (b) => { const op = OPS[b >> 5]; return ["HALT", "OUT"].includes(op) ? op : `${op} ${b & 31}`; };

for (const root of document.querySelectorAll("[data-arch-cpu]")) {
  const regs = Object.fromEntries([...root.querySelectorAll("[data-register]")].map((n) => [n.dataset.register, n]));
  const mem = root.querySelector("[data-memory]");
  const phaseEl = root.querySelector("[data-cpu-phase]");
  const explain = root.querySelector("[data-explain]");
  const output = root.querySelector("[data-output]");
  const runBtn = root.querySelector("[data-action=run]");
  let prog = PROGRAMS.add, st, timer = 0;

  function reset() {
    clearInterval(timer); timer = 0; setRun(false);
    const M = new Array(32).fill(0);
    prog.code.forEach((b, i) => (M[i] = b));
    for (const a in prog.data) M[a] = prog.data[a];
    st = { M, pc: 0, ir: 0, acc: 0, z: 1, cycle: 0, phase: "fetch", out: [], halted: false, touched: -1, wrote: -1 };
    explain.textContent = "IR ← M[PC], then PC ← PC + 1";
    draw();
  }

  function step() {
    if (st.halted) return;
    st.touched = -1; st.wrote = -1;
    if (st.phase === "fetch") {
      st.ir = st.M[st.pc];
      explain.textContent = `fetched M[${st.pc}] = ${bin(st.ir, 8)}; PC → ${(st.pc + 1) & 31}`;
      st.pc = (st.pc + 1) & 31;
      st.phase = "decode";
    } else if (st.phase === "decode") {
      const op = st.ir >> 5, a = st.ir & 31;
      explain.textContent = `opcode ${bin(op, 3)} = ${OPS[op]}${["HALT", "OUT"].includes(OPS[op]) ? "" : `, address ${bin(a, 5)} = ${a}`}`;
      st.phase = "execute";
    } else {
      const op = OPS[st.ir >> 5], a = st.ir & 31;
      const setAcc = (v) => { st.acc = v & 0xff; st.z = st.acc === 0 ? 1 : 0; };
      switch (op) {
        case "HALT": st.halted = true; explain.textContent = "halted"; break;
        case "LOAD": setAcc(st.M[a]); st.touched = a; explain.textContent = `ACC ← M[${a}] = ${st.acc}`; break;
        case "STORE": st.M[a] = st.acc; st.wrote = a; explain.textContent = `M[${a}] ← ${st.acc}`; break;
        case "ADD": setAcc(st.acc + st.M[a]); st.touched = a; explain.textContent = `ACC ← ACC + M[${a}] = ${st.acc}`; break;
        case "SUB": setAcc(st.acc - st.M[a]); st.touched = a; explain.textContent = `ACC ← ACC − M[${a}] = ${st.acc}`; break;
        case "JMP": st.pc = a; explain.textContent = `PC ← ${a}`; break;
        case "JZ": if (st.z) st.pc = a; explain.textContent = st.z ? `Z = 1, jump: PC ← ${a}` : "Z = 0, no jump"; break;
        case "OUT": st.out.push(st.acc); explain.textContent = `output ${st.acc}`; break;
      }
      st.cycle++;
      st.phase = st.halted ? "halted" : "fetch";
    }
    draw();
  }

  function draw() {
    regs.pc.textContent = st.pc;
    regs.ir.textContent = st.phase === "fetch" && st.cycle === 0 ? "—" : bin(st.ir, 8);
    regs.acc.textContent = st.acc;
    regs.z.textContent = st.z;
    regs.cycle.textContent = st.cycle;
    phaseEl.textContent = st.phase;
    output.textContent = st.out.join("  ");
    mem.innerHTML = st.M.map((b, i) => {
      const code = i < prog.code.length;
      const label = prog.labels[i];
      const cls = [
        "flex flex-col gap-0.5 rounded-md border px-1.5 py-1 font-mono text-[10px] leading-tight",
        i === st.pc && !st.halted ? "border-brand ring-1 ring-brand bg-brand/5" : "",
        i === st.touched ? "border-vec-u bg-vec-u/10" : "",
        i === st.wrote ? "border-vec-out bg-vec-out/15" : "",
        !code && !label && b === 0 ? "opacity-40" : "",
      ].join(" ");
      return `<div class="${cls}"><span class="flex justify-between text-muted-foreground"><span>${i}</span><span>${label ?? ""}</span></span><span class="text-[11px] text-foreground">${code ? disasm(b) : b}</span><span class="text-muted-foreground">${bin(b, 8)}</span></div>`;
    }).join("");
  }

  function setRun(on) {
    runBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    runBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    const l = runBtn.querySelector("[data-label]");
    l.textContent = on ? "Pause" : l.dataset.idle;
  }
  runBtn.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = 0; setRun(false); return; }
    if (st.halted) reset();
    if (reducedMotion()) { for (let k = 0; k < 3000 && !st.halted; k++) step(); return; }
    setRun(true);
    timer = setInterval(() => { step(); if (st.halted) { clearInterval(timer); timer = 0; setRun(false); } }, 220);
  });
  root.querySelector("[data-action=step]").addEventListener("click", step);
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  root.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" && !e.target.closest("button, input")) { e.preventDefault(); step(); } });
  root.addEventListener("seg-change", (e) => { prog = PROGRAMS[e.detail.value]; reset(); });
  reset();
}

// ============================================================ IEEE 754

for (const root of document.querySelectorAll("[data-arch-float]")) {
  const input = root.querySelector("input");
  const bitsEl = root.querySelector("[data-bits]");
  const o = outs(root);
  const dv = new DataView(new ArrayBuffer(4));
  let bits = 0, source = 0.1;

  // exactDecimal prints a float32 exactly: value = M × 2^E with integer M.
  function exactDecimal(u) {
    const sgn = u >>> 31, e = (u >>> 23) & 0xff, f = u & 0x7fffff;
    if (e === 0xff) return f ? "NaN" : sgn ? "−∞" : "∞";
    let M = BigInt(e ? f | 0x800000 : f), E = (e ? e : 1) - 127 - 23;
    if (M === 0n) return sgn ? "−0" : "0";
    let s;
    if (E >= 0) s = (M << BigInt(E)).toString();
    else {
      const digits = (M * 5n ** BigInt(-E)).toString().padStart(-E + 1, "0");
      s = `${digits.slice(0, digits.length + E)}.${digits.slice(digits.length + E)}`.replace(/0+$/, "").replace(/\.$/, "");
    }
    return (sgn ? "−" : "") + s;
  }
  const valueOf = (u) => { dv.setUint32(0, u >>> 0); return dv.getFloat32(0); };

  function fromNumber(x) {
    source = x;
    dv.setFloat32(0, x);
    bits = dv.getUint32(0);
    draw();
  }

  function draw() {
    const sgn = bits >>> 31, e = (bits >>> 23) & 0xff, f = bits & 0x7fffff;
    bitsEl.innerHTML = [...bin(bits >>> 0, 32)].map((d, i) => {
      const color = i === 0 ? "var(--code-del)" : i < 9 ? "var(--vec-out)" : "var(--vec-u)";
      const gap = i === 1 || i === 9 ? "ml-1.5" : "";
      return `<button type="button" data-i="${31 - i}" aria-label="bit ${31 - i}" aria-pressed="${d === "1"}" class="${gap} flex h-9 w-5 shrink-0 items-center justify-center rounded-[4px] border font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50" style="border-color:color-mix(in oklab, ${color} ${d === "1" ? 70 : 30}%, transparent);background:color-mix(in oklab, ${color} ${d === "1" ? 22 : 4}%, transparent)">${d}</button>`;
    }).join("");
    const v = valueOf(bits);
    const kind = e === 0xff ? (f ? "NaN" : "infinity") : e === 0 ? (f ? "subnormal (no implicit 1, exponent −126)" : "zero") : "normal";
    o.kind.textContent = kind;
    o.formula.textContent = e === 0xff ? "exponent all ones" : minus(`(−1)^${sgn} × ${e ? "1" : "0"}.${bin(f, 23).replace(/0+$/, "") || "0"}₂ × 2^${e ? e - 127 : -126}${e ? `  (stored exponent ${e} = ${e - 127} + 127)` : ""}`).replaceAll("-", "−");
    o.exact.textContent = exactDecimal(bits);
    const err = v - source;
    o.error.textContent = Number.isFinite(err) ? (err === 0 ? "0 (exact)" : `${minus(err.toExponential(3))} (relative ${minus((err / source).toExponential(2))})`) : "—";
    o.next.textContent = e === 0xff ? "—" : exactDecimal(sgn ? bits - 1 : bits + 1);
  }

  input.addEventListener("input", () => {
    const x = Number(input.value.replace("−", "-"));
    if (input.value.trim() !== "" && !Number.isNaN(x)) fromNumber(x);
  });
  root.querySelectorAll("[data-value]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.value; fromNumber(Number(b.dataset.value)); }));
  bitsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    bits = (bits ^ (1 << Number(b.dataset.i))) >>> 0;
    source = valueOf(bits);
    input.value = String(source);
    draw();
    bitsEl.querySelector(`[data-i="${b.dataset.i}"]`)?.focus();
  });
  fromNumber(0.1);
}

// ============================================================ Memory hierarchy

const LEVELS = [
  ["Register", 0.3, "≈ 1 clock cycle"],
  ["L1 cache", 1, "≈ 1 ns, tens of KB"],
  ["L2 cache", 4, "≈ 3–5 ns, hundreds of KB"],
  ["L3 cache", 20, "≈ 10–40 ns, megabytes"],
  ["Main memory (DRAM)", 100, "≈ 100 ns, gigabytes"],
  ["SSD (NVMe) read", 1e5, "≈ 10–100 µs"],
  ["Hard disk seek", 1e7, "≈ 10 ms"],
  ["Packet CA → Europe → CA", 1.5e8, "≈ 150 ms"],
];

function humanTime(sec) {
  const units = [[31557600, "years"], [86400, "days"], [3600, "hours"], [60, "minutes"], [1, "seconds"]];
  for (const [s, u] of units) if (sec >= s) return `${num(sec / s, sec / s < 10 ? 1 : 0)} ${u}`;
  return `${num(sec, 1)} seconds`;
}
const nsLabel = (ns) => (ns >= 1e6 ? `${num(ns / 1e6, 0)} ms` : ns >= 1e3 ? `${num(ns / 1e3, 0)} µs` : `${num(ns, ns < 1 ? 1 : 0)} ns`);

for (const root of document.querySelectorAll("[data-arch-memory]")) {
  const rows = root.querySelector("[data-rows]");
  let human = false;
  onToggle(root, (_, on) => { human = on; draw(); });
  function draw() {
    const lo = -1, hi = 9; // log10 ns
    rows.innerHTML = LEVELS.map(([name, ns, note]) => {
      const w = ((Math.log10(ns) - lo) / (hi - lo)) * 100;
      const val = human ? humanTime(ns) : nsLabel(ns);
      return `<div class="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_7rem]">
        <span class="truncate">${name}</span>
        <span class="relative h-5 rounded-sm bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(10%-1px),color-mix(in_oklab,var(--foreground)_10%,transparent)_calc(10%-1px),color-mix(in_oklab,var(--foreground)_10%,transparent)_10%)]">
          <span class="absolute inset-y-0 left-0 rounded-sm bg-brand/70 transition-[width] duration-300 ease-[var(--ease-out)]" style="width:${w.toFixed(1)}%"></span>
        </span>
        <span class="text-right font-mono text-xs tabular-nums" title="${note}">${val}</span></div>`;
    }).join("");
  }
  draw();
}

// ============================================================ Cache simulator

const TRACES = {
  scan: [...Array(32).keys(), ...Array(32).keys()].map((i) => (i % 32) * 4),
  stride: Array.from({ length: 16 }, (_, i) => (i % 4) * 64),
  conflict: Array.from({ length: 16 }, (_, i) => (i % 2) * 128),
};

for (const root of document.querySelectorAll("[data-arch-cache]")) {
  const linesEl = root.querySelector("[data-lines]");
  const traceEl = root.querySelector("[data-log]");
  const o = outs(root);
  let ways = 1, block = 16, trace = "scan", pos, sets, log;

  const geom = () => {
    const lines = 128 / block, nsets = lines / ways;
    return { lines, nsets, ob: Math.log2(block), ib: Math.log2(nsets) };
  };

  function reset() {
    const { nsets } = geom();
    sets = Array.from({ length: nsets }, () => []); // each: [{tag, used}]
    pos = 0; log = [];
    draw();
  }

  function access() {
    const list = TRACES[trace];
    if (pos >= list.length) return false;
    const addr = list[pos++];
    const { nsets, ob, ib } = geom();
    const blk = addr >> ob, idx = blk % nsets, tag = blk >> ib;
    const set = sets[idx];
    const hit = set.find((l) => l.tag === tag);
    if (hit) hit.used = pos;
    else {
      if (set.length < ways) set.push({ tag, used: pos });
      else { const lru = set.reduce((a, b) => (a.used <= b.used ? a : b)); lru.tag = tag; lru.used = pos; }
    }
    log.push({ addr, idx, tag, hit: !!hit });
    return true;
  }

  function draw() {
    const { nsets, ob, ib } = geom();
    const last = log.at(-1);
    linesEl.innerHTML = sets.map((set, i) => {
      const cells = Array.from({ length: ways }, (_, w) => {
        const l = set[w];
        const active = last && last.idx === i && l && l.tag === last.tag;
        const tone = active ? (last.hit ? "border-add bg-add/10" : "border-del bg-del/10") : "";
        return `<span class="flex-1 rounded-md border px-2 py-1 font-mono text-[11px] ${tone}">${l ? `tag ${l.tag} · bytes ${((l.tag << ib) | i) << ob}–${((((l.tag << ib) | i) + 1) << ob) - 1}` : '<span class="text-muted-foreground">empty</span>'}</span>`;
      }).join("");
      return `<div class="flex items-center gap-2"><span class="w-12 font-mono text-[11px] text-muted-foreground">set ${i}</span>${cells}</div>`;
    }).join("");
    traceEl.innerHTML = `<table class="w-full"><thead class="sticky top-0 bg-background"><tr class="border-b text-muted-foreground"><th class="px-2 py-1 text-left font-normal">#</th><th class="px-2 py-1 text-left font-normal">address</th><th class="px-2 py-1 text-left font-normal">tag | index | offset</th><th class="px-2 py-1 text-right font-normal">result</th></tr></thead><tbody>${
      log.map((r, k) => {
        const b = bin(r.addr, 8), tb = 8 - ib - ob;
        return `<tr class="border-b last:border-b-0"><td class="px-2 py-0.5 text-muted-foreground">${k + 1}</td><td class="px-2 py-0.5">${r.addr}</td><td class="px-2 py-0.5">${b.slice(0, tb)}<span class="text-muted-foreground">|</span>${b.slice(tb, tb + ib) || "·"}<span class="text-muted-foreground">|</span>${b.slice(tb + ib)}</td><td class="px-2 py-0.5 text-right ${r.hit ? "text-add" : "text-del"}">${r.hit ? "hit" : "miss"}</td></tr>`;
      }).reverse().join("")
    }</tbody></table>`;
    const hits = log.filter((r) => r.hit).length;
    o.split.textContent = `${8 - ib - ob} tag · ${ib} index · ${ob} offset bits (${nsets} sets × ${ways})`;
    o.n.textContent = `${log.length} / ${TRACES[trace].length}`;
    o.hits.textContent = String(hits);
    o.rate.textContent = log.length ? `${num((100 * hits) / log.length, 1)}%` : "—";
  }

  root.addEventListener("seg-change", (e) => { ways = Number(e.detail.value); reset(); });
  root.querySelectorAll("[data-bsize]").forEach((b) => b.addEventListener("click", () => {
    block = Number(b.dataset.bsize);
    root.querySelectorAll("[data-bsize]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    reset();
  }));
  root.querySelectorAll("button[data-trace]").forEach((b) => b.addEventListener("click", () => {
    trace = b.dataset.trace;
    root.querySelectorAll("button[data-trace]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    reset();
  }));
  root.querySelector("[data-action=step]").addEventListener("click", () => { access(); draw(); });
  root.querySelector("[data-action=all]").addEventListener("click", () => { if (pos >= TRACES[trace].length) reset(); while (access()); draw(); });
  reset();
}

// ============================================================ Pipeline

const PROGRAM = [
  { asm: "lw  r1, 0(r2)", dst: "r1", src: ["r2"], load: true },
  { asm: "add r3, r1, r4", dst: "r3", src: ["r1", "r4"] },
  { asm: "sub r5, r3, r6", dst: "r5", src: ["r3", "r6"] },
  { asm: "and r7, r8, r9", dst: "r7", src: ["r8", "r9"] },
  { asm: "sw  r5, 4(r2)", dst: null, src: ["r5", "r2"] },
];

// schedule returns the EX cycle of each instruction. Without forwarding a
// consumer decodes no earlier than the producer's write-back (register file
// written in the first half of the cycle, read in the second); with
// forwarding an ALU result feeds the next EX directly and a load's result
// is available one cycle later (the load-use stall). sw's data is treated
// as needed at EX, a simplification.
function schedule(fwd) {
  const ex = [];
  PROGRAM.forEach((ins, i) => {
    let e = i === 0 ? 3 : ex[i - 1] + 1;
    PROGRAM.slice(0, i).forEach((p, j) => {
      if (!p.dst || !ins.src.includes(p.dst)) return;
      const need = fwd ? ex[j] + (p.load ? 2 : 1) : ex[j] + 3;
      e = Math.max(e, need);
    });
    ex.push(e);
  });
  return ex;
}

for (const root of document.querySelectorAll("[data-arch-pipeline]")) {
  const grid = root.querySelector("[data-grid]");
  const o = outs(root);
  let fwd = true;
  onToggle(root, (_, on) => { fwd = on; draw(); });

  function draw() {
    const ex = schedule(fwd);
    const cycles = ex.at(-1) + 2;
    const stalls = ex.reduce((s, e, i) => s + (e - (i === 0 ? 3 : ex[i - 1] + 1)), 0);
    const tone = { IF: "var(--vec-u)", ID: "var(--vec-v)", EX: "var(--brand)", MEM: "var(--vec-out)", WB: "var(--ion-cl)" };
    const head = Array.from({ length: cycles }, (_, c) => `<th class="w-11 px-0.5 pb-1 text-center font-normal">${c + 1}</th>`).join("");
    // In order: instruction i enters IF when i−1 leaves it (moves to ID)
    // and enters ID when i−1 moves to EX; a stall holds everything behind.
    const idStart = PROGRAM.map((_, i) => (i === 0 ? 2 : ex[i - 1]));
    const ifStart = PROGRAM.map((_, i) => (i === 0 ? 1 : idStart[i - 1]));
    const rows = PROGRAM.map((ins, i) => {
      const cells = Array.from({ length: cycles }, (_, k) => {
        const c = k + 1;
        let st = "";
        if (c === ifStart[i]) st = "IF";
        else if (c > ifStart[i] && c < idStart[i]) st = "stall";
        else if (c >= idStart[i] && c < ex[i] - 1) st = "stall";
        else if (c === ex[i] - 1) st = "ID";
        else if (c === ex[i]) st = "EX";
        else if (c === ex[i] + 1) st = "MEM";
        else if (c === ex[i] + 2) st = "WB";
        if (!st) return `<td class="px-0.5 py-0.5"></td>`;
        if (st === "stall") return `<td class="px-0.5 py-0.5"><span class="flex h-7 items-center justify-center rounded-md border border-dashed border-del/50 text-[10px] text-del">stall</span></td>`;
        return `<td class="px-0.5 py-0.5"><span class="flex h-7 items-center justify-center rounded-md text-[11px] font-medium" style="background:color-mix(in oklab, ${tone[st]} 18%, transparent);color:color-mix(in oklab, ${tone[st]} 75%, var(--foreground))">${st}</span></td>`;
      }).join("");
      return `<tr><td class="pr-3 whitespace-pre text-foreground">${ins.asm}</td>${cells}</tr>`;
    }).join("");
    grid.innerHTML = `<table class="font-mono text-xs"><thead><tr class="text-muted-foreground"><th class="pr-3 pb-1 text-left font-normal">cycle →</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    o.cycles.textContent = String(cycles);
    o.stalls.textContent = String(stalls);
    o.cpi.textContent = num(cycles / PROGRAM.length, 2) + ` (ideal ${num((PROGRAM.length + 4) / PROGRAM.length, 2)})`;
    o.note.textContent = fwd
      ? "With forwarding, add still waits one cycle for lw's data (it only exists after MEM): the load-use hazard. sub gets add's result straight from EX."
      : "Without forwarding, each dependent instruction waits in decode until its source register has been written back: add waits for lw, sub for add, and sw for sub.";
  }
  draw();
}

// ============================================================ Amdahl

for (const root of document.querySelectorAll("[data-arch-amdahl]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const speedup = (p, n) => 1 / ((1 - p) + p / n);

  function draw() {
    const p = s.p.get() / 100, n = s.n.get();
    svg.replaceChildren();
    const f = frame(svg, { box: [46, 14, 490, 236], x: [0, 10], y: [0, 3], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 1, 2, 3], xfmt: (k) => String(2 ** k), yfmt: (k) => String(10 ** k), xlabel: "cores n (log₂)", ylabel: "speedup (log)" });
    for (const q of [0.5, 0.75, 0.9, 0.95, 0.99]) {
      const pts = [];
      for (let k = 0; k <= 100; k++) { const x = k / 10; pts.push([f.sx(x), f.sy(Math.log10(speedup(q, 2 ** x)))]); }
      polyline(svg, pts, "stroke:currentColor;stroke-opacity:0.18;stroke-width:1");
      text(svg, f.L + f.W + 4, f.sy(Math.log10(speedup(q, 1024))) + 3, `${q * 100}%`, {});
    }
    const pts = [];
    for (let k = 0; k <= 100; k++) { const x = k / 10; pts.push([f.sx(x), f.sy(Math.log10(speedup(p, 2 ** x)))]); }
    polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(Math.log10(Math.min(1000, 1 / Math.max(1e-9, 1 - p)))), y2: f.sy(Math.log10(Math.min(1000, 1 / Math.max(1e-9, 1 - p)))), style: "stroke:var(--brand);stroke-opacity:0.5;stroke-dasharray:4 4" }, svg);
    el("circle", { cx: f.sx(Math.log2(n)), cy: f.sy(Math.log10(speedup(p, n))), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    const S = speedup(p, n);
    o.s.textContent = `${num(S, 2)}×`;
    o.limit.textContent = p >= 1 ? "∞ (perfectly parallel)" : `${num(1 / (1 - p), 1)}×`;
    o.eff.textContent = `${num((100 * S) / n, 1)}% per core`;
  }
  draw();
}
