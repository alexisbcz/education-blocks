// Programming foundations, blocks 6–10: the debugger, tests first,
// formula to code, counting with a dict, loop vs comprehension. Each
// block is wired only if it is on the page.

import { trace, evaluate, repr } from "./progfund-py.js";
import { mountEditor, mountMemory, mountTracer, mountStepper, arrowKeys, showConsole, describe, valText, esc } from "./progfund-viz.js";
import { tokenize } from "./highlight.js";

const pyStr = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";

// ------------------------------------------------------------ 6 debugger

{
  const root = document.querySelector("[data-pf-debug]");
  if (root) {
    const TESTS = [
      ["banana", 3n],
      ["apple", 2n],
      ["", 0n],
      ["sky", 0n],
      ["Aero", 3n],
    ];
    const msgEl = root.querySelector("[data-dbg-msg]");
    const list = root.querySelector("[data-tests]");
    const summary = root.querySelector("[data-summary]");
    const btn = (a) => root.querySelector(`[data-act="${a}"]`);
    const memory = mountMemory(root.querySelector("[data-mem]"), { hideFunctions: true, idle: "Press Debug to watch the variables." });
    memory.render(null);
    const editor = mountEditor(root.querySelector("[data-ed]"), {
      onChange: () => {
        if (steps) {
          stop();
          say("The code changed: press Debug to run the new version.");
        }
        for (const li of list.querySelectorAll("[data-status]")) li.dataset.status = "stale";
        renderTests();
      },
      onRun: runTests,
      onBreakpoints: () => {},
    });
    let pick = 1;
    let results = TESTS.map(() => null);
    let steps = null;
    let i = 0;
    let nLines = 0;

    const say = (t, bad = false) => {
      msgEl.textContent = t;
      msgEl.toggleAttribute("data-bad", bad);
    };
    const call = (w) => `count_vowels(${pyStr(w)})`;

    function renderTests() {
      list.innerHTML = TESTS.map(([w, want], k) => {
        const r = results[k];
        const status = !r ? "·" : r.pass ? "✓" : "✗";
        const tone = !r ? "text-muted-foreground" : r.pass ? "text-brand" : "text-del";
        const detail = r && !r.pass ? `<span class="text-del">${esc(r.got)}</span>` : "";
        return `<li><button type="button" role="radio" aria-checked="${k === pick}" data-pick="${k}" class="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left font-mono text-xs transition-colors duration-150 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 aria-checked:border-brand aria-checked:bg-brand/5">
          <span class="w-3 ${tone}">${status}</span><span class="min-w-0 flex-1 truncate">${esc(call(w))} == ${want}</span>${detail}</button></li>`;
      }).join("");
      const done = results.filter(Boolean);
      const passing = done.filter((r) => r.pass).length;
      summary.innerHTML = done.length ? `<span class="${passing === TESTS.length ? "text-brand" : "text-del"}">${passing}/${TESTS.length} passing</span>` : "";
    }

    function runTests() {
      const src = editor.value;
      results = TESTS.map(([w, want]) => {
        const r = trace(`${src}\n\nresult = ${call(w)}`, { record: false, maxSteps: 5000 });
        if (r.error) return { pass: false, got: `${r.error.type}` };
        if (r.stopped) return { pass: false, got: "never stopped" };
        const got = r.globals.get("result");
        return { pass: typeof got === "bigint" && got === want, got: `got ${repr(got)}` };
      });
      renderTests();
      const passing = results.filter((r) => r.pass).length;
      if (passing === TESTS.length) say("All five tests pass: both bugs are fixed.");
      else say(`${TESTS.length - passing} test${TESTS.length - passing === 1 ? "" : "s"} failing. Pick one in the list and press Debug.`, true);
    }

    function setDebugging(on) {
      for (const a of ["continue", "step", "back", "stop"]) btn(a).disabled = !on;
    }

    function debug() {
      const src = editor.value;
      nLines = src.split("\n").length;
      const r = trace(`${src}\n\nresult = ${call(TESTS[pick][0])}`, { maxSteps: 2000 });
      if (!r.steps.length) {
        say(`${r.error.type} on line ${r.error.line}: ${r.error.message}`, true);
        editor.markError(r.error.line);
        return;
      }
      steps = r.steps;
      setDebugging(true);
      // Run to the first breakpoint, or stop at the call.
      const first = nextBreak(-1);
      show(first ?? steps.findIndex((s) => s.ev === "call"));
    }

    const isBreak = (s) => s.ev === "line" && s.line <= nLines && editor.bps.has(s.line);
    function nextBreak(from) {
      for (let k = from + 1; k < steps.length; k++) if (isBreak(steps[k])) return k;
      return null;
    }

    function show(k) {
      i = Math.max(0, Math.min(steps.length - 1, k));
      const s = steps[i];
      editor.markLine(s.error || s.end || s.line > nLines ? 0 : s.line);
      editor.markError(s.error && s.line <= nLines ? s.line : 0);
      memory.render(s, steps[i - 1]);
      btn("back").disabled = i === 0;
      btn("step").disabled = btn("continue").disabled = i === steps.length - 1;
      const [w, want] = TESTS[pick];
      if (s.end) {
        const got = s.frames[0].vars.find(([n]) => n === "result")?.[1];
        const ok = got && got.t === "int" && got.s === String(want);
        say(`${call(w)} returned ${got ? got.s : "None"}; the test expects ${want}.${ok ? " This case passes." : ""}`, !ok);
      } else if (s.line > nLines) say(`The test calls ${call(w)}.`);
      else {
        const d = describe(s, steps, null);
        say(isBreak(s) ? `Paused at the breakpoint on line ${s.line}. ${d.text}` : d.text, d.bad);
      }
    }

    function stop() {
      steps = null;
      setDebugging(false);
      editor.markLine(0);
      editor.markError(0);
      memory.render(null);
    }

    root.addEventListener("click", (e) => {
      const p = e.target.closest("[data-pick]");
      if (p) {
        pick = Number(p.dataset.pick);
        renderTests();
        if (steps) debug();
        return;
      }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      if (act === "test") runTests();
      else if (act === "debug") debug();
      else if (act === "reset") {
        editor.reset();
        stop();
        results = TESTS.map(() => null);
        renderTests();
        say("");
      } else if (!steps) return;
      else if (act === "continue") show(nextBreak(i) ?? steps.length - 1);
      else if (act === "step") show(i + 1);
      else if (act === "back") show(i - 1);
      else if (act === "stop") {
        stop();
        say("Stopped.");
      }
    });
    list.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      pick = (pick + (e.key === "ArrowDown" ? 1 : TESTS.length - 1)) % TESTS.length;
      renderTests();
      list.querySelector(`[data-pick="${pick}"]`).focus();
    });
    root.addEventListener("keydown", (e) => {
      if (!steps || e.target.closest("textarea, input")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        show(i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(i - 1);
      }
    });
    renderTests();
    runTests();
  }
}

// ------------------------------------------------------------ 7 tests first

{
  const root = document.querySelector("[data-pf-tests]");
  if (root) {
    const IMPLS = [
      { name: "Spec", code: "def is_leap(year):\n    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)", hint: "" },
      { name: "Ana", code: "def is_leap(year):\n    return year % 4 == 0", hint: "Ana forgot the century rule. Try a century year that isn't divisible by 400, like 1900." },
      { name: "Ben", code: "def is_leap(year):\n    return year % 4 == 0 and year % 100 != 0", hint: "Ben drops every century year. Try one divisible by 400, like 2000." },
      { name: "Chloé", code: "def is_leap(year):\n    return year % 400 == 0", hint: "Chloé only kept the 400 rule. An ordinary leap year catches it." },
      { name: "Dev", code: "def is_leap(year):\n    if year % 4 != 0:\n        return False\n    if year % 100 == 0:\n        return year % 40 == 0\n    return True", hint: "Dev's version has a typo in a number. Which century years does it get wrong? Try a few: 1700, 1800, 1900, 2100, 2200." },
      { name: "Eli", code: 'def is_leap(year):\n    if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):\n        return "leap"\n    return "common"', hint: 'Eli returns strings, and both are truthy. assert is_leap(2023) alone passes for "common"; compare with == True or == False.' },
    ];
    const matrix = root.querySelector("[data-matrix]");
    const scoreEl = root.querySelector("[data-score]");
    const verdict = root.querySelector("[data-verdict]");
    const versions = root.querySelector("[data-versions]");
    const editor = mountEditor(root.querySelector("[data-ed]"), { onRun: run });

    versions.innerHTML = IMPLS.slice(1)
      .map((m) => `<div class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">${esc(m.name)}</span><pre class="code overflow-x-auto rounded-md border bg-code px-3 py-2">${m.code.split("\n").map((l) => `<div>${hl(l)}</div>`).join("")}</pre></div>`)
      .join("");

    function run() {
      const lines = editor.value.split("\n");
      const asserts = lines.map((l, k) => [l.trim(), k + 1]).filter(([l]) => l.startsWith("assert"));
      const setup = lines.filter((l) => l.trim() && !l.trim().startsWith("assert") && !l.trim().startsWith("#")).join("\n");
      if (!asserts.length) {
        matrix.innerHTML = "";
        scoreEl.textContent = "";
        verdict.textContent = "Write at least one line that starts with assert.";
        return;
      }
      const res = asserts.map(([a]) =>
        IMPLS.map((m) => {
          const r = trace(`${m.code}\n${setup}\n${a}`, { record: false, maxSteps: 3000 });
          return r.error ? { pass: false, why: `${r.error.type}${r.error.message ? ": " + r.error.message : ""}` } : r.stopped ? { pass: false, why: "never stopped" } : { pass: true };
        }),
      );
      // A test the correct version fails is a wrong test: it can't catch anyone.
      const valid = res.map((row) => row[0].pass);
      const caught = IMPLS.map((_, j) => j > 0 && res.some((row, r) => valid[r] && !row[j].pass));
      const head = `<thead><tr class="border-b bg-muted/40 text-muted-foreground"><th class="px-2 py-2 text-left font-normal">test</th>${IMPLS.map(
        (m, j) => `<th class="border-l px-2 py-2 text-center font-normal ${j === 0 ? "" : caught[j] ? "bg-brand/10 text-foreground" : ""}">${esc(m.name)}${j > 0 ? `<div class="font-sans text-[10px] ${caught[j] ? "text-brand" : "text-muted-foreground"}">${caught[j] ? "caught" : "still passes"}</div>` : `<div class="font-sans text-[10px]">correct</div>`}</th>`,
      ).join("")}</tr></thead>`;
      const body = res
        .map(
          (row, r) => `<tr class="border-b last:border-b-0 ${valid[r] ? "" : "bg-del/5"}"><td class="max-w-[16rem] truncate px-2 py-1.5" title="${esc(asserts[r][0])}"><span class="text-muted-foreground">${asserts[r][1]}</span> ${hl(asserts[r][0].replace(/^assert\s+/, ""))}${valid[r] ? "" : `<div class="font-sans text-[11px] text-del">disagrees with the spec: ${esc(row[0].why)}</div>`}</td>${row
            .map((c, j) => {
              const kill = j > 0 && valid[r] && !c.pass;
              return `<td class="border-l px-2 py-1.5 text-center ${kill ? "bg-brand/10 text-brand" : c.pass ? "text-muted-foreground" : "text-del"}" title="${esc(c.pass ? "passes" : c.why)}">${c.pass ? "✓" : "✗"}</td>`;
            })
            .join("")}</tr>`,
        )
        .join("");
      matrix.innerHTML = head + `<tbody>${body}</tbody>`;
      const k = caught.filter(Boolean).length;
      const bad = valid.filter((v) => !v).length;
      scoreEl.innerHTML = `<span class="${k === 5 ? "text-brand" : "text-muted-foreground"}">caught ${k} of 5</span> · ${asserts.length} test${asserts.length === 1 ? "" : "s"}${bad ? ` · <span class="text-del">${bad} wrong</span>` : ""}`;
      const alive = IMPLS.filter((_, j) => j > 0 && !caught[j]);
      verdict.textContent =
        bad && !k
          ? "A test that the correct version fails is testing the wrong rule. Check it against the spec."
          : alive.length
            ? alive[0].hint + (alive.length > 1 ? ` (${alive.length - 1} more still pass after that.)` : "")
            : bad
              ? `Every wrong version is caught, but ${bad} of your tests ${bad === 1 ? "disagrees" : "disagree"} with the spec (the correct version fails ${bad === 1 ? "it" : "them"}). Fix or delete ${bad === 1 ? "that line" : "those lines"}.`
              : `Every wrong version fails at least one of your ${asserts.length} tests, and the correct one passes them all. Edge cases (2000, 1900, 1800) are where the bugs hide.`;
    }

    root.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "run") run();
      if (act === "reset") {
        editor.reset();
        run();
      }
    });
    run();
  }
}

function hl(line, syms) {
  return tokenize(line)
    .map((t) => {
      let body;
      if (syms && t.cls === "") body = esc(t.text).replace(/[A-Za-z_]\w*/g, (w) => (syms[w] ? `<span data-sym="${syms[w]}" class="rounded-sm transition-colors duration-150 data-[on]:bg-brand/20 data-[on]:ring-1 data-[on]:ring-brand/60">${w}</span>` : w));
      else if (syms && syms[t.text.trim()]) body = `<span data-sym="${syms[t.text.trim()]}" class="rounded-sm transition-colors duration-150 data-[on]:bg-brand/20 data-[on]:ring-1 data-[on]:ring-brand/60">${esc(t.text)}</span>`;
      else body = esc(t.text);
      return t.cls ? `<span class="tok-${t.cls}">${body}</span>` : body;
    })
    .join("");
}

// ------------------------------------------------------------ 8 formula

{
  const root = document.querySelector("[data-pf-formula]");
  if (root) {
    const PRESETS = {
      mean: {
        params: [["xs", "the data, xs", "[4.0, 8.0, 6.0, 5.0, 3.0]"]],
        code: (p) => `xs = ${p.xs}\nn = len(xs)\nmean = sum(xs) / n\nvar = sum((x - mean) ** 2 for x in xs) / (n - 1)\nprint(f"mean = {mean:.3f}")\nprint(f"variance = {var:.3f}")`,
        syms: { xs: "x", x: "x", n: "n", mean: "mean", var: "var", sum: "sum", "**": "pow" },
      },
      interest: {
        params: [["P", "principal P", "1000.0"], ["r", "yearly rate r", "0.05"], ["n", "periods per year n", "12"], ["t", "years t", "10"]],
        code: (p) => `P = ${p.P}\nr = ${p.r}\nn = ${p.n}\nt = ${p.t}\nA = P * (1 + r / n) ** (n * t)\nprint(f"A = {A:,.2f}")`,
        syms: { P: "P", r: "r", n: "n", t: "t", A: "A", "**": "pow" },
      },
      newton: {
        params: [["a", "square root of a", "2.0"], ["steps", "steps", "5"]],
        code: (p) => `a = ${p.a}\nx = a  # first guess\nfor k in range(${p.steps}):\n    x = (x + a / x) / 2\n    print(k + 1, x)`,
        syms: { a: "a", x: "x" },
      },
    };
    let key = "mean";
    let values = {};
    const paramsEl = root.querySelector("[data-params]");
    const consoleEl = root.querySelector("[data-console]");
    const editor = mountEditor(root.querySelector("[data-ed]"), {
      decorate: (_, n, raw) => hl(raw, PRESETS[key].syms),
    });

    function load(k) {
      key = k;
      values = Object.fromEntries(PRESETS[k].params.map(([n, , v]) => [n, v]));
      paramsEl.innerHTML =
        `<span class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Inputs</span>` +
        PRESETS[k].params
          .map(
            ([n, label, v]) =>
              `<label class="flex items-center justify-between gap-3 text-sm"><span class="text-muted-foreground">${esc(label)}</span><input type="text" data-param="${n}" value="${esc(v)}" aria-label="${esc(label)}" autocomplete="off" spellcheck="false" class="h-8 ${n === "xs" ? "w-56" : "w-24"} min-w-0 rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del"></label>`,
          )
          .join("");
      run();
    }
    function run() {
      const src = PRESETS[key].code(values);
      editor.set(src);
      const r = trace(src, { record: false, maxSteps: 4000 });
      showConsole(consoleEl, r.output, r.error ? `${r.error.type}: ${r.error.message}` : r.stopped ? "Stopped: too many steps." : "");
    }
    let t = 0;
    paramsEl.addEventListener("input", (e) => {
      const inp = e.target.closest("[data-param]");
      if (!inp) return;
      // Only plain number and list literals go into the program.
      const ok = inp.dataset.param === "xs" ? /^\[[\d.,\s+-e]*\]$/.test(inp.value.trim()) : /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(inp.value.trim()) && (inp.dataset.param !== "steps" || /^\d{1,2}$/.test(inp.value.trim()));
      inp.toggleAttribute("data-bad", !ok);
      if (!ok) return;
      values[inp.dataset.param] = inp.value.trim();
      clearTimeout(t);
      t = setTimeout(run, 200);
    });

    // Hovering or focusing a symbol lights up its partners on both sides.
    const light = (k) => {
      for (const el of root.querySelectorAll("[data-sym]")) el.toggleAttribute("data-on", el.dataset.sym === k);
    };
    root.addEventListener("pointerover", (e) => light(e.target.closest("[data-sym]")?.dataset.sym ?? null));
    root.addEventListener("pointerleave", () => light(null));
    root.addEventListener("focusin", (e) => light(e.target.closest("[data-sym]")?.dataset.sym ?? null));
    root.addEventListener("focusout", () => light(null));
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-act]")?.dataset.act === "run") run();
    });
    root.addEventListener("seg-change", (e) => load(e.detail.value));
    load("mean");
  }
}

// ------------------------------------------------------------ 9 dict

{
  const root = document.querySelector("[data-pf-dict]");
  if (root) {
    const textIn = root.querySelector("[data-text]");
    const bars = root.querySelector("[data-bars]");
    const totals = root.querySelector("[data-totals]");
    let style = "get";
    let finalMax = 1;
    const code = (text) =>
      style === "get"
        ? `text = ${pyStr(text)}\ncounts = {}\nfor word in text.lower().split():\n    counts[word] = counts.get(word, 0) + 1\nprint(counts)`
        : `text = ${pyStr(text)}\ncounts = {}\nfor word in text.lower().split():\n    if word in counts:\n        counts[word] += 1\n    else:\n        counts[word] = 1\nprint(counts)`;

    const tr = mountTracer(root, {
      hideModules: true,
      maxSteps: 900,
      onStep: (snap) => {
        if (!snap) return;
        const g = snap.frames[0];
        const heap = new Map(snap.heap.map((o) => [o.id, o]));
        const c = g.vars.find(([k]) => k === "counts")?.[1];
        const w = g.vars.find(([k]) => k === "word")?.[1];
        const d = c && c.t === "ref" ? heap.get(c.id) : null;
        const entries = d ? d.entries.map(([k, v]) => [k.s, Number(v.s)]) : [];
        const sum = entries.reduce((a, [, v]) => a + v, 0);
        totals.textContent = d ? `${sum} words counted · ${entries.length} different` : "counts doesn't exist yet";
        bars.innerHTML = entries.length
          ? entries
              .map(([k, v]) => {
                const on = w && w.s === k && snap.ev === "line";
                return `<div class="grid grid-cols-[minmax(4rem,auto)_1fr_2rem] items-center gap-2 font-mono text-xs"><span class="truncate text-right ${on ? "text-foreground" : "text-muted-foreground"}">${esc(k.slice(1, -1))}</span><span class="h-4 rounded-sm ${on ? "bg-brand" : "bg-brand/35"} transition-[width] duration-200 ease-out motion-reduce:transition-none" style="width:${(v / finalMax) * 100}%"></span><span class="tabular-nums">${v}</span></div>`;
              })
              .join("")
          : `<span class="text-xs text-muted-foreground/70 italic">No words counted yet.</span>`;
      },
    });
    function run() {
      const words = textIn.value.trim().split(/\s+/).filter(Boolean);
      const text = words.slice(0, 16).join(" ");
      const r = trace(code(text), { record: false, maxSteps: 900 });
      const d = r.globals?.get("counts");
      finalMax = d ? Math.max(1, ...[...d.map.values()].map(([, v]) => Number(v))) : 1;
      tr.run(code(text));
      if (words.length > 16) tr.stepper.message("Only the first 16 words are counted, to keep the steps short.");
    }
    let t = 0;
    textIn.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(run, 300);
    });
    root.addEventListener("seg-change", (e) => {
      style = e.detail.value;
      run();
    });
    run();
  }
}

// ------------------------------------------------------------ 10 comprehension

{
  const root = document.querySelector("[data-pf-comp]");
  if (root) {
    const PRE = {
      squares: {
        label: "nums =", src: "[3, 8, 5, 12, 7]", v: "x", out: "squares", forLine: 3, addLine: 4,
        loop: (s) => `nums = ${s}\nsquares = []\nfor x in nums:\n    squares.append(x * x)`,
        comp: (s) => `nums = ${s}\nsquares = [x * x for x in nums]`,
      },
      evens: {
        label: "nums =", src: "[3, 8, 5, 12, 7]", v: "x", out: "evens", forLine: 3, testLine: 4, addLine: 5,
        loop: (s) => `nums = ${s}\nevens = []\nfor x in nums:\n    if x % 2 == 0:\n        evens.append(x)`,
        comp: (s) => `nums = ${s}\nevens = [x for x in nums if x % 2 == 0]`,
      },
      lengths: {
        label: "words =", src: '["apple", "kiwi", "fig", "banana"]', v: "w", out: "lengths", forLine: 3, addLine: 4,
        loop: (s) => `words = ${s}\nlengths = []\nfor w in words:\n    lengths.append(len(w))`,
        comp: (s) => `words = ${s}\nlengths = [len(w) for w in words]`,
      },
    };
    const srcIn = root.querySelector("[data-src]");
    const srcLabel = root.querySelector("[data-src-label]");
    const pane = (k) => root.querySelector(`[data-pane="${k}"]`);
    const ed = { loop: mountEditor(pane("loop").querySelector("[data-ed]")), comp: mountEditor(pane("comp").querySelector("[data-ed]")) };
    let key = "squares";
    let states = { loop: [], comp: [] };
    const stepper = mountStepper(root, (i) => show(i));
    arrowKeys(root, stepper);

    const read = (snap, frame, name) => {
      const heap = new Map(snap.heap.map((o) => [o.id, o]));
      const e = frame.vars.find(([k]) => k === name)?.[1];
      return e ? valText(e, heap) : null;
    };
    const listOf = (snap, v) => {
      if (!v) return [];
      const heap = new Map(snap.heap.map((o) => [o.id, o]));
      const o = heap.get(v.id);
      return o ? o.items.map((x) => valText(x, heap)) : [];
    };

    function build() {
      const p = PRE[key];
      const s = srcIn.value.trim();
      const check = evaluate(s);
      const ok = !check.error && check.type === "list" && check.value.items.length <= 12 && check.value.items.length > 0;
      srcIn.toggleAttribute("data-bad", !ok);
      if (!ok) {
        stepper.message(check.error ? `${check.error.type}: ${check.error.message}` : "Give a list of 1 to 12 items.", true);
        return;
      }
      const loopSrc = p.loop(s);
      const compSrc = p.comp(s);
      ed.loop.set(loopSrc);
      ed.comp.set(compSrc);
      const lt = trace(loopSrc, { maxSteps: 2000 });
      const ct = trace(compSrc, { maxSteps: 2000 });
      if (lt.error || ct.error) {
        const err = lt.error || ct.error;
        stepper.message(`${err.type}: ${err.message}`, true);
        stepper.setCount(0);
        return;
      }
      // Loop: the for line is checked once before each pass and once at the end.
      states.loop = lt.steps
        .filter((st) => st.ev === "line" && st.line === p.forLine && st.frames.length === 1)
        .map((st) => {
          const g = st.frames[0];
          const out = g.vars.find(([k]) => k === p.out)?.[1];
          return { x: read(st, g, p.v), list: listOf(st, out) };
        });
      // Comprehension: one event after each pass, inside its own frame.
      const inside = ct.steps.filter((st) => st.frames.length === 2 && st.frames[1].name === "<listcomp>");
      states.comp = [{ x: null, list: [] }, ...inside.map((st) => ({ x: read(st, st.frames[1], p.v), list: listOf(st, st.frames[1].result) }))];
      pane("loop").querySelector("[data-pane-steps]").textContent = `${lt.steps.length - 1} steps in all`;
      pane("comp").querySelector("[data-pane-steps]").textContent = `${ct.steps.length - 1} steps in all`;
      stepper.setCount(states.loop.length, 0);
    }

    function show(i) {
      const p = PRE[key];
      for (const k of ["loop", "comp"]) {
        const st = states[k][i];
        const prev = states[k][i - 1];
        const el = pane(k);
        if (!st) continue;
        const added = prev && st.list.length > prev.list.length;
        if (k === "loop") ed.loop.markLine(i === 0 ? p.forLine : added ? p.addLine : (p.testLine ?? p.forLine));
        else ed.comp.markLine(2);
        el.querySelector("[data-pane-x]").innerHTML = st.x === null ? `<span class="text-muted-foreground">${p.v} isn't set yet</span>` : `${p.v} = <span class="tok-${st.x.startsWith("'") ? "string" : "number"}">${esc(st.x)}</span>`;
        el.querySelector("[data-pane-kept]").innerHTML = i === 0 ? "before the first item" : added ? `<span class="text-brand">added ${esc(st.list[st.list.length - 1])}</span>` : "skipped";
        el.querySelector("[data-pane-list]").innerHTML =
          `<span class="mr-1 text-xs text-muted-foreground">${p.out} =</span>` +
          (st.list.length
            ? `[${st.list.map((v, j) => `<span class="rounded px-1 ${added && j === st.list.length - 1 ? "bg-brand/15 text-foreground" : ""}">${esc(v)}</span>`).join(", ")}]`
            : "[]");
      }
      const n = states.loop.length - 1;
      stepper.message(i === 0 ? "Both start with an empty result and the first item." : i === n ? `Done: both visited ${n} item${n === 1 ? "" : "s"} and built the same list.` : `Item ${i} of ${n}: the same value, the same decision, in both versions.`);
    }

    let t = 0;
    srcIn.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(build, 300);
    });
    root.addEventListener("seg-change", (e) => {
      key = e.detail.value;
      srcIn.value = PRE[key].src;
      srcLabel.textContent = PRE[key].label;
      build();
    });
    build();
  }
}
