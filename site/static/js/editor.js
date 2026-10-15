// Exercise editor: a transparent <textarea> over a highlighted <pre>.
// The textarea keeps native editing (selection, undo, IME, mobile
// keyboards); the <pre> only paints. The run is simulated: it inspects
// the code instead of executing it, and says so.

import { lineHTML } from "./highlight.js";

const INDENT = "    ";

for (const root of document.querySelectorAll("[data-editor]")) {
  const ta = root.querySelector("[data-input]");
  const pre = root.querySelector("[data-highlight]");
  const gutter = root.querySelector("[data-gutter]");
  const active = root.querySelector("[data-active-line]");
  const cursor = root.querySelector("[data-cursor]");
  const dirty = root.querySelector("[data-dirty]");
  const out = root.querySelector("[data-console]");
  const summary = root.querySelector("[data-summary]");
  const runBtn = root.querySelector("[data-action=run]");
  const starter = root.querySelector("template[data-starter]").content.textContent;
  const solution = root.querySelector("template[data-solution]").content.textContent;

  let lastLines = -1;
  const render = () => {
    const lines = ta.value.split("\n");
    pre.innerHTML = lines.map((l) => `<div class="min-h-5">${lineHTML(l)}</div>`).join("");
    if (lines.length !== lastLines) {
      gutter.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join("");
      lastLines = lines.length;
    }
    // The textarea grows with its content; the scroller scrolls both.
    ta.style.height = `${lines.length * 20}px`;
    ta.style.width = `${Math.max(...lines.map((l) => l.length)) + 4}ch`;
    dirty.hidden = ta.value === starter;
    moveCaret();
  };

  const moveCaret = () => {
    const before = ta.value.slice(0, ta.selectionStart).split("\n");
    const line = before.length;
    const col = before[before.length - 1].length + 1;
    active.style.transform = `translateY(${(line - 1) * 20}px)`;
    if (cursor) cursor.textContent = `Ln ${line}, Col ${col}`;
  };

  // Edits go through execCommand so the browser's undo stack keeps them.
  const insert = (text) => document.execCommand("insertText", false, text);

  ta.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
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
      // Indent or dedent every selected line.
      const end = v.indexOf("\n", t - (t > s && v[t - 1] === "\n" ? 1 : 0));
      const blockEnd = end === -1 ? v.length : end;
      const block = v.slice(lineStart, blockEnd);
      const next = block
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
      if (/^\s*(return|pass|break|continue|raise)\b/.test(line)) indent = indent.slice(4);
      insert("\n" + indent);
    }
  });

  ta.addEventListener("input", render);
  for (const ev of ["keyup", "click", "select", "focus"]) ta.addEventListener(ev, moveCaret);

  const setCode = (code) => {
    ta.focus();
    ta.select();
    insert(code);
    ta.setSelectionRange(0, 0);
    render();
  };
  root.querySelector("[data-action=reset]").addEventListener("click", () => setCode(starter));
  root.querySelector("[data-action=solution]").addEventListener("click", () => setCode(solution));
  runBtn.addEventListener("click", run);

  function run() {
    const idle = runBtn.querySelector("[data-icon=idle]");
    const busy = runBtn.querySelector("[data-icon=busy]");
    runBtn.disabled = true;
    idle.hidden = true;
    busy.hidden = false;
    out.innerHTML = `<span class="text-muted-foreground">Running 4 tests…</span>`;
    summary.textContent = "";
    setTimeout(() => {
      runBtn.disabled = false;
      idle.hidden = false;
      busy.hidden = true;
      report(check(ta.value));
    }, 450);
  }

  function report(r) {
    const line = (ok, name, extra = "") =>
      `<div class="enter"><span class="${ok ? "text-add" : "text-del"}">${ok ? "✓" : "✗"}</span> ${name}${extra}</div>`;
    const names = ["identity leaves x alone", "2×3 matrix times a 3-vector", "matches numpy on random matrices", "rotation by 90°"];
    let html = "";
    if (r.error) {
      html += `<div class="text-del">${r.error}</div>`;
    } else {
      names.forEach((n, i) => {
        const ok = i < r.passed;
        html += line(ok, n, ok ? "" : ` <span class="text-muted-foreground">— ${r.why}</span>`);
      });
    }
    html += `<div class="mt-2 text-muted-foreground">Simulated run: the platform executes this in the browser with Pyodide.</div>`;
    out.innerHTML = html;
    summary.innerHTML = r.error
      ? `<span class="text-del">error</span>`
      : `<span class="${r.passed === 4 ? "text-add" : "text-del"}">${r.passed}/4 passed</span>`;
  }

  // A stand-in for the real runner: read the body of matvec and decide.
  function check(code) {
    if (/@|np\.dot|\.dot\(/.test(code.replace(/"""[\s\S]*?"""/g, "").replace(/#.*$/gm, "")))
      return { error: "Don't use @ or np.dot: write the loop." };
    const body = code.split(/def matvec\(.*\):/)[1] ?? "";
    if (!body) return { error: "NameError: name 'matvec' is not defined" };
    if (/^\s*pass\s*$/m.test(body) && !/for /.test(body)) return { passed: 0, why: "returns zeros: the loop is missing" };
    if (!/for /.test(body)) return { passed: 1, why: "y is never filled in" };
    if (/A\[\s*j\s*,\s*i\s*\]/.test(body)) return { passed: 1, why: "A[j, i] reads a column: that's Aᵀx" };
    if (/y\[i\]\s*=/.test(body) || /y\[i\]\s*\+=/.test(body)) return { passed: 4 };
    return { passed: 2, why: "check how y[i] is assigned" };
  }

  render();
}
