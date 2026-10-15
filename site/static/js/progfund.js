// Programming foundations, blocks 1–5: names and objects, the trace
// table, the call stack, ranges and slices, ints and floats. Each block
// is wired only if it is on the page. Blocks 6–10 live in
// progfund-labs.js; the interpreter in progfund-py.js.

import { trace, evaluate, parseExpression, sliceIndices, floatRepr } from "./progfund-py.js";
import { mountEditor, mountTracer, presets, esc } from "./progfund-viz.js";
import { lineHTML } from "./highlight.js";

const pyStr = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";

// ------------------------------------------------------------ 1 names

{
  const root = document.querySelector("[data-pf-names]");
  if (root) {
    const P = presets(root);
    const tr = mountTracer(root, { hideModules: true });
    const note = root.querySelector("[data-note-out]");
    const load = (k) => {
      tr.run(P[k].prog);
      note.textContent = P[k].note;
    };
    root.addEventListener("seg-change", (e) => load(e.detail.value));
    root.querySelector('[data-act="reset"]').addEventListener("click", () => tr.run(tr.editor.starter));
    load("alias");
  }
}

// ------------------------------------------------------------ 2 trace table

{
  const root = document.querySelector("[data-pf-trace]");
  if (root) {
    const P = presets(root);
    const ed = mountEditor(root.querySelector("[data-ed]"));
    const table = root.querySelector("[data-table]");
    const startIn = root.querySelector("[data-start]");
    const score = root.querySelector("[data-score]");
    const note = root.querySelector("[data-note-out]");
    const MAX_ROWS = 30;
    let cfg = null;
    let rows = [];
    let revealed = 0; // rows 0..revealed-1 are shown

    const load = (key) => {
      const [vars, line, min, max, text] = P[key].note.split("|");
      cfg = { prog: P[key].prog, vars: vars.split(","), line: Number(line), min: Number(min), max: Number(max) };
      note.textContent = text;
      startIn.value = P[key].prog.match(/^n = (\d+)/m)[1];
      build();
    };

    function build() {
      const v = startIn.value.trim();
      const n = Number(v);
      const ok = /^\d+$/.test(v) && n >= cfg.min && n <= cfg.max;
      startIn.toggleAttribute("data-bad", !ok);
      if (!ok) {
        score.textContent = `n must be a whole number from ${cfg.min} to ${cfg.max}`;
        return;
      }
      const src = cfg.prog.replace(/^n = \d+/m, `n = ${n}`);
      ed.set(src);
      ed.markLine(cfg.line);
      const r = trace(src, { maxSteps: 5000 });
      rows = r.steps
        .filter((s) => s.ev === "line" && s.line === cfg.line && s.frames.length === 1)
        .map((s) => cfg.vars.map((name) => s.frames[0].vars.find(([k]) => k === name)?.[1].s ?? "—"));
      const total = rows.length;
      rows = rows.slice(0, MAX_ROWS);
      revealed = 1;
      render(total > MAX_ROWS ? `This start needs ${total} rows; the table shows the first ${MAX_ROWS}.` : "");
    }

    function render(extra = "") {
      const head = `<thead><tr class="border-b bg-muted/40 text-xs text-muted-foreground"><th class="w-12 px-2 py-2 text-right font-normal">check</th>${cfg.vars.map((v) => `<th class="px-2 py-2 font-normal">${esc(v)}</th>`).join("")}</tr></thead>`;
      const body = rows
        .map((row, r) => {
          const shown = r < revealed;
          const cells = row
            .map((val, c) => {
              if (shown) return `<td class="border-l px-2 py-1.5 text-center ${r === 0 ? "text-muted-foreground" : "bg-brand/5"}">${esc(val)}</td>`;
              return `<td class="border-l p-0"><input data-r="${r}" data-c="${c}" aria-label="Check ${r + 1}, ${esc(cfg.vars[c])}" autocomplete="off" spellcheck="false" class="w-full min-w-14 bg-transparent px-2 py-1.5 text-center text-base outline-none placeholder:text-muted-foreground/40 focus-visible:bg-accent data-[ok]:bg-brand/15 data-[ok]:text-foreground data-[bad]:bg-del/10 data-[bad]:text-del sm:text-sm" placeholder="?"></td>`;
            })
            .join("");
          return `<tr class="border-b last:border-b-0"><td class="px-2 py-1.5 text-right text-xs text-muted-foreground">${r + 1}</td>${cells}</tr>`;
        })
        .join("");
      table.innerHTML = head + `<tbody>${body}</tbody>`;
      score.textContent = extra || `${rows.length} rows to fill`;
    }

    const norm = (s) => s.trim().replace(/\s+/g, "").replace(/^-$/, "—").replace(/^"(.*)"$/, "'$1'");
    function check() {
      let right = 0;
      let filled = 0;
      for (const inp of table.querySelectorAll("input")) {
        const truth = rows[Number(inp.dataset.r)][Number(inp.dataset.c)];
        const v = norm(inp.value);
        inp.removeAttribute("data-ok");
        inp.removeAttribute("data-bad");
        if (!v) continue;
        filled++;
        if (v === truth) {
          right++;
          inp.setAttribute("data-ok", "");
        } else inp.setAttribute("data-bad", "");
      }
      const open = table.querySelectorAll("input").length;
      score.textContent = filled ? `${right} of ${filled} filled cells right · ${open - filled} empty` : "Fill some cells first";
    }

    root.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "check") check();
      else if (act === "row") {
        // Keep the learner's guesses for the rows still hidden.
        const kept = [...table.querySelectorAll("input")].map((i) => [i.dataset.r, i.dataset.c, i.value]);
        revealed = Math.min(rows.length, revealed + 1);
        render();
        for (const [r, c, v] of kept) {
          const inp = table.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
          if (inp) inp.value = v;
        }
        if (revealed === rows.length) score.textContent = "All rows revealed.";
      } else if (act === "all") {
        revealed = rows.length;
        render();
        score.textContent = "All rows revealed.";
      } else if (act === "clear") {
        revealed = 1;
        render();
      }
    });
    table.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        check();
      }
    });
    let t = 0;
    startIn.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(build, 300);
    });
    root.addEventListener("seg-change", (e) => load(e.detail.value));
    load("odds");
  }
}

// ------------------------------------------------------------ 3 call stack

{
  const root = document.querySelector("[data-pf-stack]");
  if (root) {
    const P = presets(root);
    const svg = root.querySelector("[data-depth]");
    const out = (k, v) => (root.querySelector(`[data-out="${k}"]`).textContent = v);
    let depths = [];
    let calls = [];
    const W = 600;
    const H = 112;
    const tr = mountTracer(root, {
      hideFunctions: true,
      hideModules: true,
      maxDepth: 25,
      maxSteps: 800,
      onStep: (snap, i, steps) => {
        if (!snap) {
          svg.innerHTML = "";
          out("calls", "—");
          out("depth", "—");
          out("max", "—");
          return;
        }
        if (i === 0 || depths.length !== steps.length) {
          depths = steps.map((s) => s.frames.length - 1);
          let c = 0;
          calls = steps.map((s) => (c += s.ev === "call" ? 1 : 0));
        }
        out("calls", String(calls[i]));
        out("depth", String(depths[i]));
        out("max", String(Math.max(...depths)));
        draw(i);
      },
    });

    function draw(i) {
      const n = depths.length;
      const max = Math.max(4, ...depths);
      const x = (k) => (n <= 1 ? 0 : (k / (n - 1)) * W);
      const y = (d) => H - 8 - (d / max) * (H - 18);
      let d = `M0,${y(depths[0])}`;
      for (let k = 1; k < n; k++) d += ` H${x(k)} V${y(depths[k])}`;
      const area = `${d} H${W} V${H} H0 Z`;
      const grid = Array.from({ length: max + 1 }, (_, k) => k)
        .filter((k) => k > 0 && (max <= 8 || k % 5 === 0))
        .map((k) => `<line x1="0" x2="${W}" y1="${y(k)}" y2="${y(k)}" stroke="currentColor" stroke-opacity="0.08" vector-effect="non-scaling-stroke"/>`)
        .join("");
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.innerHTML = `${grid}<path d="${area}" fill="var(--brand)" fill-opacity="0.12"/><path d="${d}" fill="none" stroke="var(--brand)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line x1="${x(i)}" x2="${x(i)}" y1="0" y2="${H}" stroke="currentColor" stroke-opacity="0.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
        <circle cx="${x(i)}" cy="${y(depths[i])}" r="3" fill="var(--brand)" vector-effect="non-scaling-stroke"/>`;
    }
    const jump = (e) => {
      const r = svg.getBoundingClientRect();
      const k = Math.round(((e.clientX - r.left) / r.width) * (depths.length - 1));
      tr.stepper.go(k);
    };
    svg.addEventListener("pointerdown", (e) => {
      svg.setPointerCapture?.(e.pointerId);
      jump(e);
    });
    svg.addEventListener("pointermove", (e) => {
      if (e.buttons & 1) jump(e);
    });

    const note = root.querySelector("[data-note-out]");
    const load = (k) => {
      depths = [];
      tr.run(P[k].prog);
      note.textContent = P[k].note;
    };
    root.addEventListener("seg-change", (e) => load(e.detail.value));
    root.querySelector('[data-act="reset"]').addEventListener("click", () => {
      depths = [];
      tr.run(tr.editor.starter);
    });
    load("fact");
  }
}

// ------------------------------------------------------------ 4 slices

{
  const root = document.querySelector("[data-pf-slices]");
  if (root) {
    const field = (k) => root.querySelector(`[data-in="${k}"]`);
    const svg = root.querySelector("[data-ruler]");
    const exprEl = root.querySelector("[data-expr]");
    const resultEl = root.querySelector("[data-result]");
    const explain = root.querySelector("[data-explain]");
    const textField = root.querySelector("[data-text-field]");
    const challenges = root.querySelector("[data-challenges]");
    let mode = "slice";
    let target = null;

    const intOrBlank = (inp) => {
      const v = inp.value.trim();
      const ok = v === "" || /^[+-]?\d{1,3}$/.test(v);
      inp.toggleAttribute("data-bad", !ok);
      return ok ? (v === "" ? null : Number(v)) : undefined;
    };

    function update() {
      const s = field("text").value;
      const a = intOrBlank(field("start"));
      const b = intOrBlank(field("stop"));
      const c = intOrBlank(field("step"));
      if (a === undefined || b === undefined || c === undefined) {
        resultEl.innerHTML = `<span class="text-del">start, stop and step must be whole numbers or blank.</span>`;
        return;
      }
      const part = (v) => (v === null ? "" : String(v));
      let expr;
      if (mode === "slice") {
        expr = `s[${part(a)}:${part(b)}${c === null ? "" : ":" + c}]`;
      } else {
        if (b === null) {
          exprEl.textContent = "list(range(…))";
          resultEl.innerHTML = `<span class="text-del">range() needs a stop.</span>`;
          svg.innerHTML = "";
          explain.textContent = "";
          return;
        }
        const args = a === null ? [b] : c === null ? [a, b] : [a, b, c];
        expr = `list(range(${args.join(", ")}))`;
      }
      exprEl.innerHTML = lineHTML(expr);
      const r = evaluate(expr, `s = ${pyStr(s)}`);
      if (r.error) {
        resultEl.innerHTML = `<span class="text-del">${esc(r.error.type)}: ${esc(r.error.message)}</span>`;
        svg.innerHTML = "";
        explain.textContent = c === 0 ? "A step of 0 would never move, so Python refuses it." : "";
        return;
      }
      const hit = mode === "slice" && target && r.repr === target;
      resultEl.innerHTML = `<span class="tok-${r.type === "str" ? "string" : "number"}">${esc(r.repr)}</span>${hit ? ` <span class="ml-2 font-sans text-xs text-brand">✓ that's the one</span>` : ""}`;
      if (mode === "slice") drawSlice(s, a, b, c);
      else drawRange(a, b, c, r.value);
    }

    function drawSlice(s, a, b, c) {
      const chars = [...s];
      const n = chars.length;
      const big = (v) => (v === null ? null : BigInt(v));
      const { start, stop, step, idx } = sliceIndices(n, big(a), big(b), big(c));
      const order = new Map(idx.map((k, j) => [k, j + 1]));
      const cw = 44;
      const x0 = 56;
      const width = x0 * 2 + (n + 0) * cw;
      const y = 36;
      let g = "";
      // Ghost cells just outside the string, where a stop can point.
      for (const k of [-1, n]) {
        if (stop !== k) continue;
        g += `<rect x="${x0 + k * cw + 2}" y="${y}" width="${cw - 4}" height="40" rx="6" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="4 3"/>`;
      }
      chars.forEach((ch, k) => {
        const on = order.has(k);
        g += `<rect x="${x0 + k * cw + 2}" y="${y}" width="${cw - 4}" height="40" rx="6" fill="${on ? "var(--brand)" : "currentColor"}" fill-opacity="${on ? 0.18 : 0.04}" stroke="${on ? "var(--brand)" : "currentColor"}" stroke-opacity="${on ? 0.9 : 0.2}"/>`;
        g += `<text x="${x0 + k * cw + cw / 2}" y="${y + 26}" text-anchor="middle" class="font-mono text-[15px]" fill="currentColor">${esc(ch)}</text>`;
        if (on) g += `<text x="${x0 + k * cw + cw - 6}" y="${y + 12}" text-anchor="end" class="font-mono text-[9px]" fill="var(--brand)">${order.get(k)}</text>`;
        g += `<text x="${x0 + k * cw + cw / 2}" y="${y - 10}" text-anchor="middle" class="font-mono text-[11px]" fill="currentColor" fill-opacity="0.65">${k}</text>`;
        g += `<text x="${x0 + k * cw + cw / 2}" y="${y + 58}" text-anchor="middle" class="font-mono text-[11px]" fill="currentColor" fill-opacity="0.45">${k - n}</text>`;
      });
      g += `<text x="${x0 - 10}" y="${y - 10}" text-anchor="end" class="text-[10px]" fill="currentColor" fill-opacity="0.5">index</text>`;
      g += `<text x="${x0 - 10}" y="${y + 58}" text-anchor="end" class="text-[10px]" fill="currentColor" fill-opacity="0.5">from end</text>`;
      // start and stop markers
      const mark = (k, label, solid) => {
        const cx = x0 + k * cw + cw / 2;
        return `<path d="M${cx - 5},${y + 70} L${cx},${y + 63} L${cx + 5},${y + 70}" fill="${solid ? "var(--brand)" : "none"}" stroke="${solid ? "var(--brand)" : "currentColor"}" stroke-opacity="${solid ? 1 : 0.6}"/><text x="${cx}" y="${y + 84}" text-anchor="middle" class="text-[10px]" fill="currentColor" fill-opacity="0.7">${label}</text>`;
      };
      if (start >= 0 && start < n && idx.length) g += mark(start, "start", true);
      if (stop >= -1 && stop <= n) g += mark(stop, "stop", false);
      svg.setAttribute("viewBox", `0 0 ${width} ${y + 92}`);
      svg.style.maxWidth = `${width}px`;
      svg.innerHTML = g;
      const dir = step > 0 ? "forwards" : "backwards";
      explain.textContent = idx.length
        ? `Start at index ${start} (${chars[start]}), move ${dir} ${Math.abs(step) === 1 ? "one position" : Math.abs(step) + " positions"} at a time, and stop before index ${stop}${stop >= 0 && stop < n ? ` (${chars[stop]})` : stop === n ? ", just past the end" : ", just before the start"}: ${idx.length} character${idx.length === 1 ? "" : "s"}. Blank start and stop mean "from the edge", which edge depending on the step's sign.`
        : `Nothing is taken: going ${dir} from index ${start} never reaches anything before index ${stop}. That gives an empty result, not an error.`;
    }

    function drawRange(a, b, c, list) {
      const values = list.items.map((v) => Number(v));
      const start = a ?? 0;
      const step = c ?? 1;
      const lo = Math.min(start, b, 0) - 1;
      const hi = Math.max(start, b) + 1;
      if (hi - lo > 41) {
        svg.innerHTML = `<text x="10" y="24" class="text-[12px]" fill="currentColor" fill-opacity="0.6">Too wide to draw; the list above is the result.</text>`;
        svg.setAttribute("viewBox", "0 0 420 40");
        explain.textContent = "";
        return;
      }
      const unit = 30;
      const x0 = 30;
      const xs = (v) => x0 + (v - lo) * unit;
      const width = x0 * 2 + (hi - lo) * unit;
      const y = 50;
      const set = new Map(values.map((v, j) => [v, j + 1]));
      let g = `<line x1="${xs(lo)}" x2="${xs(hi)}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity="0.35"/>`;
      for (let v = lo; v <= hi; v++) {
        g += `<line x1="${xs(v)}" x2="${xs(v)}" y1="${y - 4}" y2="${y + 4}" stroke="currentColor" stroke-opacity="0.35"/>`;
        g += `<text x="${xs(v)}" y="${y + 22}" text-anchor="middle" class="font-mono text-[11px]" fill="currentColor" fill-opacity="${set.has(v) ? 0.95 : 0.45}">${v}</text>`;
        if (set.has(v)) {
          g += `<circle cx="${xs(v)}" cy="${y}" r="7" fill="var(--brand)" fill-opacity="0.85"/>`;
          g += `<text x="${xs(v)}" y="${y - 14}" text-anchor="middle" class="font-mono text-[9px]" fill="var(--brand)">${set.get(v)}</text>`;
        }
      }
      g += `<circle cx="${xs(b)}" cy="${y}" r="7" fill="none" stroke="currentColor" stroke-opacity="0.7" stroke-dasharray="3 2"/>`;
      g += `<text x="${xs(b)}" y="${y + 40}" text-anchor="middle" class="text-[10px]" fill="currentColor" fill-opacity="0.7">stop</text>`;
      svg.setAttribute("viewBox", `0 0 ${width} ${y + 50}`);
      svg.style.maxWidth = `${width}px`;
      svg.innerHTML = g;
      explain.textContent = values.length
        ? `Counts from ${start} in steps of ${step} and stops before reaching ${b}: ${values.length} number${values.length === 1 ? "" : "s"}. range(${b}) alone means 0 up to ${b} − 1, which is why for i in range(len(xs)) visits every index exactly once.`
        : `Empty: starting at ${start} and stepping by ${step} never gets closer to ${b}${step > 0 ? " (stop is below start, so use a negative step)" : ""}.`;
    }

    for (const k of ["text", "start", "stop", "step"]) {
      field(k).addEventListener("input", update);
      if (k !== "text")
        field(k).addEventListener("keydown", (e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const v = Number(field(k).value || 0) + (e.key === "ArrowUp" ? 1 : -1);
          field(k).value = String(v);
          update();
        });
    }
    challenges.addEventListener("click", (e) => {
      const b = e.target.closest("[data-target]");
      if (!b) return;
      const on = b.getAttribute("aria-pressed") !== "true";
      for (const x of challenges.querySelectorAll("[data-target]")) x.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-pressed", String(on));
      // The targets are written for PYTHONIC.
      if (on && field("text").value !== "PYTHONIC") field("text").value = "PYTHONIC";
      target = on ? b.dataset.target : null;
      update();
    });
    root.addEventListener("seg-change", (e) => {
      mode = e.detail.value;
      textField.hidden = mode !== "slice";
      challenges.hidden = mode !== "slice";
      if (mode === "range") {
        field("start").value = "2";
        field("stop").value = "11";
        field("step").value = "3";
      } else {
        field("start").value = "2";
        field("stop").value = "6";
        field("step").value = "";
      }
      update();
    });
    update();
  }
}

// ------------------------------------------------------------ 5 numbers

{
  const root = document.querySelector("[data-pf-numbers]");
  if (root) {
    const hist = root.querySelector("[data-history]");
    const input = root.querySelector("[data-repl]");
    const decIn = root.querySelector("[data-dec]");
    const out = (k, v) => (root.querySelector(`[data-out="${k}"]`).innerHTML = v);
    const setup = ["import math"];
    let base = "";
    const past = [];
    let back = 0;

    function submit(src) {
      src = src.trim();
      if (!src) return;
      past.push(src);
      back = past.length;
      let isExpr = true;
      try {
        parseExpression(src);
      } catch {
        isExpr = false;
      }
      let html = `<div class="flex flex-col gap-0.5"><div><span class="text-muted-foreground select-none">&gt;&gt;&gt; </span>${lineHTML(src)}</div>`;
      if (isExpr) {
        const r = evaluate(src, setup.join("\n"));
        const printed = (r.output ?? "").slice(base.length);
        if (printed) html += `<div class="whitespace-pre-wrap">${esc(printed.replace(/\n$/, ""))}</div>`;
        if (r.error) html += `<div class="text-del">${esc(r.error.type)}: ${esc(r.error.message)}</div>`;
        else if (!(r.type === "NoneType" && printed)) {
          html += `<div class="flex items-baseline gap-2"><span class="${r.type === "str" ? "tok-string" : r.type === "bool" || r.type === "NoneType" ? "tok-constant" : "tok-number"} break-all">${esc(r.repr)}</span><span class="rounded border px-1 font-sans text-[10px] text-muted-foreground">${esc(r.type)}</span></div>`;
        }
      } else {
        const full = [...setup, src].join("\n");
        const r = trace(full, { record: false, maxSteps: 5000 });
        if (r.error) html += `<div class="text-del">${esc(r.error.type)}: ${esc(r.error.message)}</div>`;
        else {
          const printed = r.output.slice(base.length);
          if (printed) html += `<div class="whitespace-pre-wrap">${esc(printed.replace(/\n$/, ""))}</div>`;
          setup.push(src);
          base = r.output;
        }
      }
      html += "</div>";
      hist.insertAdjacentHTML("beforeend", html);
      hist.scrollTop = hist.scrollHeight;
      // A float result feeds the inspector.
      if (isExpr) {
        const r = evaluate(src, setup.join("\n"));
        if (!r.error && r.type === "float" && Number.isFinite(r.value)) {
          decIn.value = r.repr;
          inspect();
        }
      }
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit(input.value);
        input.value = "";
      } else if (e.key === "ArrowUp" && past.length) {
        e.preventDefault();
        back = Math.max(0, back - 1);
        input.value = past[back];
      } else if (e.key === "ArrowDown" && past.length) {
        e.preventDefault();
        back = Math.min(past.length, back + 1);
        input.value = past[back] ?? "";
      }
    });
    root.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-expr]");
      if (chip) submit(chip.dataset.expr);
    });

    // --- the exact value of a double, as a decimal

    function exactOf(x) {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setFloat64(0, x);
      const hi = dv.getUint32(0);
      const lo = dv.getUint32(4);
      const neg = hi >>> 31 === 1;
      const expBits = (hi >>> 20) & 0x7ff;
      let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
      let e;
      if (expBits === 0) e = -1074;
      else {
        mant |= 1n << 52n;
        e = expBits - 1075;
      }
      let num;
      let scale;
      if (e >= 0) {
        num = mant << BigInt(e);
        scale = 0;
      } else {
        num = mant * 5n ** BigInt(-e);
        scale = -e;
      }
      while (scale > 0 && num % 10n === 0n) {
        num /= 10n;
        scale--;
      }
      return { num: neg ? -num : num, scale };
    }
    function parseDec(s) {
      const m = s.trim().match(/^([+-])?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
      if (!m || (!m[2] && !m[3])) return null;
      const digits = (m[2] || "") + (m[3] || "");
      let scale = (m[3] || "").length - Number(m[4] || 0);
      let num = BigInt(digits || "0");
      if (scale < 0) {
        num *= 10n ** BigInt(-scale);
        scale = 0;
      }
      return { num: m[1] === "-" ? -num : num, scale };
    }
    function decString({ num, scale }) {
      const neg = num < 0n;
      let s = (neg ? -num : num).toString();
      if (scale > 0) {
        s = s.padStart(scale + 1, "0");
        s = s.slice(0, s.length - scale) + "." + s.slice(s.length - scale);
      }
      return (neg ? "-" : "") + s;
    }
    function sci({ num, scale }) {
      if (num === 0n) return "0";
      const neg = num < 0n;
      const s = (neg ? -num : num).toString();
      const exp = s.length - 1 - scale;
      const mant = s[0] + (s.length > 1 ? "." + s.slice(1, 4) : "");
      return `${neg ? "−" : "+"}${mant}e${exp}`;
    }
    function nextUp(x) {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setFloat64(0, Math.abs(x));
      dv.setBigUint64(0, dv.getBigUint64(0) + 1n);
      return dv.getFloat64(0);
    }

    function inspect() {
      const typed = parseDec(decIn.value);
      const x = Number(decIn.value.trim());
      const ok = typed && Number.isFinite(x);
      decIn.toggleAttribute("data-bad", !ok);
      if (!ok) {
        root.querySelector("[data-exact]").textContent = "Type a decimal number like 0.1, 2.675 or 1e-7.";
        for (const k of ["repr", "err", "ulp", "rel"]) out(k, "—");
        return;
      }
      const ex = exactOf(x);
      const exStr = decString(ex);
      const tyStr = decString(typed);
      let common = 0;
      while (common < exStr.length && exStr[common] === tyStr[common]) common++;
      const shown = exStr.length > 420 ? exStr.slice(0, 420) + "…" : exStr;
      const same = exStr === tyStr;
      root.querySelector("[data-exact]").innerHTML = same
        ? `<span>${esc(shown)}</span> <span class="font-sans text-xs text-brand">exactly what you wrote</span>`
        : `<span>${esc(shown.slice(0, common))}</span><span class="text-brand">${esc(shown.slice(common))}</span>${exStr.length > 60 ? ` <span class="font-sans text-xs text-muted-foreground">(${exStr.replace(/[-.]/g, "").length} digits)</span>` : ""}`;
      // stored − typed, exactly
      const K = Math.max(ex.scale, typed.scale);
      const diff = ex.num * 10n ** BigInt(K - ex.scale) - typed.num * 10n ** BigInt(K - typed.scale);
      out("repr", `<span class="tok-number">${esc(floatRepr(x))}</span>`);
      out("err", diff === 0n ? "0, exact" : sci({ num: diff, scale: K }));
      const gap = nextUp(x) - Math.abs(x);
      out("ulp", gap.toExponential(3).replace(/e\+?/, "e"));
      out("rel", x === 0 ? "—" : (gap / Math.abs(x)).toExponential(2).replace(/e\+?/, "e"));
    }
    decIn.addEventListener("input", inspect);

    for (const e of ["0.1 + 0.2", "0.1 + 0.2 == 0.3", "7 / 2", "-7 // 2"]) submit(e);
    decIn.value = "0.1";
    inspect();
  }
}
