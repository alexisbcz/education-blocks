// Assessment formats: numeric with units, symbolic answers, code cloze,
// select-all, priced hints, confidence, faded examples. Every block root is
// data-assess-*, so this module does nothing on other pages. Drag-based
// formats live in assess-drag.js.

import { exercise, mk, mark } from "./assess-shell.js";
import { parse, equivalent, isProduct, toMathML, parseQuantity, dimName, siUnit, sameDim, rng, ParseError } from "./assess-expr.js";

const sig = (v, d = 3) => Number(v.toPrecision(d)).toString();
const fix = (v, d = 3) => v.toFixed(d).replace("-", "−");

// ============================================================ numeric · units

for (const root of document.querySelectorAll("[data-assess-numeric]")) {
  const input = root.querySelector("[data-assess-input]");
  const read = root.querySelector("[data-assess-read]");
  const seedOut = root.querySelector("[data-assess-seed]");
  const G = 9.81;
  const SPEED = [1, 0, -1];
  let seed = 0, h = 20;

  // Variant 0 is the authored question; others draw h = 5…80 m in steps of 5.
  function variant(s) {
    seed = s;
    h = s === 0 ? 20 : 5 * (1 + Math.floor(rng(s)() * 16));
    root.querySelectorAll("[data-assess-h]").forEach((n) => (n.textContent = String(h)));
    seedOut.textContent = s === 0 ? "0 (authored)" : `${s.toString(16).toUpperCase().padStart(6, "0")} · h = ${h} m`;
  }
  const exact = () => Math.sqrt(2 * G * h);

  function describe() {
    input.removeAttribute("data-state");
    const t = input.value.trim();
    if (!t) { read.textContent = "Reads as: —"; return; }
    try {
      const q = parseQuantity(t);
      read.textContent = q.unitText
        ? `Reads as: ${q.text} ${q.unitText} · ${q.digits} significant figure${q.digits === 1 ? "" : "s"} · ${dimName(q.dim)} · = ${sig(q.si, 4)} ${siUnit(q.dim)}`
        : `Reads as: ${q.text}, no unit yet`;
    } catch (e) {
      read.textContent = `Reads as: ? ${e.message}`;
    }
  }
  input.addEventListener("input", describe);

  const ex = exercise(root, {
    check() {
      const t = input.value.trim();
      const v = exact();
      if (!t) return { state: "info", title: "Type an answer first.", body: "A number and a unit, for example 12.3 m/s." };
      let q;
      try { q = parseQuantity(t); } catch (e) {
        input.dataset.state = "wrong";
        return { state: "wrong", title: "That doesn't read as a quantity.", body: e.message, shake: input };
      }
      const near = (a, b) => Math.abs(a - b) <= 0.01 * Math.abs(b);
      if (!q.unitText) {
        input.dataset.state = "wrong";
        return { state: "wrong", title: "Add a unit.", body: near(q.value, v) ? `${q.value} what? The number is right in metres per second.` : "Without a unit the number has no meaning: m/s, km/h…", shake: input };
      }
      if (!sameDim(q.dim, SPEED)) {
        input.dataset.state = "wrong";
        return { state: "wrong", title: `That is ${dimName(q.dim)}; the question asks for a speed.`, body: "A speed is a length per time: m/s, km/h, ft/s.", shake: input };
      }
      if (near(q.si, v)) {
        if (q.digits < 2 || q.digits > 4) {
          input.dataset.state = "right";
          return { state: "partial", title: "Right value; adjust the precision.", body: `The data has 3 significant figures, so give 2 to 4: ${sig(v)} m/s. You gave ${q.digits}.` };
        }
        input.dataset.state = "right";
        return { state: "right", title: `Correct: ${sig(v)} m/s.`, body: [`v = √(2gh) = √(2 × 9.81 × ${h}) = ${sig(v, 5)} m/s, about ${sig(v * 3.6)} km/h.`, `Your ${t} is ${sig(q.si, 4)} m/s, within 1%.`] };
      }
      input.dataset.state = "wrong";
      const traps = [
        [2 * G * h, "That is 2gh, a speed squared: take the square root."],
        [Math.sqrt(G * h), "That is √(gh): the ½ in ½mv² puts a 2 under the root."],
        [G * h, "That is g·h: energy per kilogram, not a speed."],
        [Math.sqrt(2 * h / G) * G, null],
      ];
      for (const [val, msg] of traps) if (msg && near(q.si, val)) return { state: "wrong", title: "Not quite.", body: msg, shake: input };
      if (near(q.value, v)) return { state: "wrong", title: "Right number, wrong unit.", body: `${sig(v)} is the speed in m/s; in ${q.unitText} it would be ${sig(v / (q.si / q.value))}.`, shake: input };
      return { state: "wrong", title: "Not within 1% of the answer.", body: `You gave ${sig(q.si, 4)} m/s.`, shake: input };
    },
    reveal() { input.value = `${sig(exact())} m/s`; describe(); input.dataset.state = "right"; },
    reset() { input.value = ""; describe(); },
  });
  root.querySelector("[data-assess-variant]").addEventListener("click", () => {
    variant(1 + Math.floor(Math.random() * 0xfffffe));
    input.value = "";
    describe();
    ex.clear();
    ex.resetHints();
    input.focus();
  });
  variant(0);
}

// ============================================================ expression

const QS = {
  derivative: {
    lead: "Differentiate f(x) = ", given: "x^2 e^x", lhs: "f′(x) =", target: "e^x (x^2 + 2x)", mode: "exact",
    hint: "Product rule: (uv)′ = u′v + uv′, with u = x² and v = eˣ (which is its own derivative).",
    traps: [["2x e^x", "That is u′v only: the product rule adds uv′ = x²eˣ."], ["2x", "The eˣ factor is not a constant: it has to be differentiated too."], ["x^2 e^x", "eˣ is its own derivative, but x² is not."]],
  },
  simplify: {
    lead: "Simplify ", given: "(x^3 - x)/x", lhs: "=", target: "x^2 - 1", mode: "exact",
    hint: "Factor x out of the numerator: x³ − x = x(x² − 1). Then cancel x (for x ≠ 0).",
    traps: [["x^2", "x³/x = x², but −x/x = −1 is still there."], ["x^2 + 1", "Check the sign: −x divided by x is −1."]],
  },
  factor: {
    lead: "Factor ", given: "x^2 - 5x + 6", lhs: "=", target: "(x - 2)(x - 3)", mode: "factored",
    hint: "Look for two numbers whose product is 6 and whose sum is −5.",
    traps: [["(x + 2)(x + 3)", "Those multiply out to x² + 5x + 6: both signs are flipped."], ["(x - 1)(x - 6)", "Product 6, but the sum is −7, not −5."]],
  },
  integral: {
    lead: "Find an antiderivative of ", given: "2x cos(x^2)", lhs: "F(x) =", target: "sin(x^2)", mode: "constant",
    hint: "Substitute u = x², so du = 2x dx: the integral becomes ∫ cos u du.",
    traps: [["sin(x^2) 2x", "Differentiate it back: the 2x appears twice. The substitution absorbs it."], ["x^2 sin(x^2)", "Differentiate it back to check: the product rule adds extra terms."], ["cos(x^2)", "Its derivative is −2x sin(x²): sine and cosine are swapped."]],
  },
};

for (const root of document.querySelectorAll("[data-assess-expr]")) {
  const input = root.querySelector("[data-assess-input]");
  const preview = root.querySelector("[data-assess-preview]");
  const prompt = root.querySelector("[data-assess-q]");
  const lhs = root.querySelector("[data-assess-lhs]");
  const hintText = root.querySelector("[data-assess-hint-text]");
  const pts = root.querySelector("[data-assess-points]");
  let q = QS.derivative;

  function show(key) {
    q = QS[key];
    prompt.replaceChildren(q.lead, toMathML(parse(q.given)), ".");
    lhs.textContent = q.lhs;
    hintText.textContent = q.hint;
    input.value = "";
    update();
  }
  function update() {
    input.removeAttribute("data-state");
    pts.hidden = true;
    const t = input.value;
    if (!t.trim()) { preview.replaceChildren(mk("span", "text-xs text-muted-foreground", "Preview")); return; }
    try {
      preview.replaceChildren(toMathML(parse(t), true));
    } catch (e) {
      const msg = mk("span", "font-mono text-xs text-muted-foreground");
      msg.textContent = e instanceof ParseError ? `${e.message}${e.at < t.length ? ` (at “${t.slice(e.at, e.at + 6)}”)` : ""}` : "Cannot read that.";
      preview.replaceChildren(msg);
    }
  }
  input.addEventListener("input", update);

  function table(res) {
    const tb = mk("table", "w-full font-mono text-[11px] tabular-nums");
    const head = mk("tr", "text-muted-foreground");
    for (const h of ["x", "yours", "answer", ""]) head.append(mk("th", "px-2 py-1 text-right font-normal", h));
    tb.append(head);
    for (const p of res.points.slice(0, 5)) {
      const tr = mk("tr", "border-t");
      const ok = Math.abs(p.a - p.b - (res.offset ?? 0)) <= 1e-7 * Math.max(1, Math.abs(p.b));
      tr.append(mk("td", "px-2 py-1 text-right", fix(p.x)), mk("td", "px-2 py-1 text-right", Number.isFinite(p.a) ? fix(p.a, 4) : "undefined"), mk("td", "px-2 py-1 text-right", fix(p.b, 4)), mk("td", `px-2 py-1 text-right ${ok ? "text-brand" : "text-del"}`, ok ? "=" : "≠"));
      tb.append(tr);
    }
    const cap = mk("p", "mt-1 text-[11px] text-muted-foreground", `How it was checked: both expressions evaluated at ${res.points.length} random points in [−2, 2]${res.offset !== undefined ? ", allowing a constant difference" : ""}. First 5 shown.`);
    pts.replaceChildren(tb, cap);
    pts.hidden = false;
  }

  const ex = exercise(root, {
    check() {
      if (!input.value.trim()) return { state: "info", title: "Type an expression first." };
      let tree;
      try { tree = parse(input.value); } catch (e) {
        input.dataset.state = "wrong";
        return { state: "wrong", title: "That doesn't parse yet.", body: e.message, shake: input };
      }
      const target = parse(q.target);
      const mode = q.mode === "constant" ? "constant" : "exact";
      const res = equivalent(tree, target, { mode });
      table(res);
      if (res.ok) {
        input.dataset.state = "right";
        if (q.mode === "factored" && !isProduct(tree)) return { state: "partial", title: "Equal, but not factored.", body: "The question asks for a product of factors, like (x − a)(x − b)." };
        const body = q.mode === "constant" && Math.abs(res.offset) > 1e-9 ? `It differs from sin(x²) by the constant ${fix(res.offset, 3)}, which any antiderivative may: + C.` : "Equal at every test point.";
        return { state: "right", title: "Correct.", body };
      }
      input.dataset.state = "wrong";
      for (const [w, msg] of q.traps) if (equivalent(tree, parse(w)).ok) return { state: "wrong", title: "Not quite.", body: msg, shake: input };
      return { state: "wrong", title: "Not equal to the answer.", body: "The table shows where they differ.", shake: input };
    },
    reveal() { input.value = q.target; update(); input.dataset.state = "right"; },
    reset() { input.value = ""; update(); },
  });
  root.addEventListener("seg-change", (e) => {
    show(e.detail.value);
    ex.clear();
    ex.resetHints();
    ex.setSolved(false);
  });
  show("derivative");
}

// ============================================================ cloze · code

const BLANKS = [
  { ok: ["n"], traps: { "n-1": "Dividing by n − 1 makes the steps too long: n steps of (t1 − t0)/n cover the interval exactly.", "n+1": "Dividing by n + 1 leaves the last step short of t1.", h: "h is what this line defines." } },
  { ok: ["n"], traps: { "n+1": "range(n + 1) runs n + 1 times: one step past t1.", "n-1": "range(n − 1) stops one step short of t1.", h: "range needs a count of steps, an integer." } },
  { ok: ["f(t,y)"], traps: { "f(t+h,y)": "That is the slope at the end of the step: implicit (backward) Euler, which needs y at the end too.", "f(y,t)": "The arguments are swapped: f is called as f(t, y).", y: "The update adds h times the slope f(t, y), not y itself.", "f(t)": "f takes both t and y." } },
  { ok: ["t+h", "h+t"], traps: { "t+1": "Time advances by the step h, not by 1.", h: "That sets t to h every time instead of advancing it.", "t+n": "Time advances by the step h, not by the number of steps." } },
];
const norm = (s) => s.replace(/\s+/g, "").replace(/[−–]/g, "-");

for (const root of document.querySelectorAll("[data-assess-cloze]")) {
  const blanks = [...root.querySelectorAll("[data-assess-blank]")];
  const notes = root.querySelector("[data-assess-blank-notes]");
  blanks.forEach((b) => b.addEventListener("input", () => b.removeAttribute("data-state")));
  exercise(root, {
    check() {
      if (blanks.every((b) => !b.value.trim())) return { state: "info", title: "Fill in the blanks first." };
      notes.replaceChildren();
      let right = 0;
      blanks.forEach((b, i) => {
        const v = norm(b.value), spec = BLANKS[i];
        const ok = spec.ok.includes(v);
        b.dataset.state = ok ? "right" : "wrong";
        if (ok) { right++; return; }
        const li = mk("li", "flex gap-2");
        li.append(mk("span", "font-mono text-xs text-del", `${i + 1}`), mk("span", "text-muted-foreground", v ? spec.traps[v] ?? `“${b.value.trim()}” doesn't fit here.` : "Still empty."));
        notes.append(li);
      });
      const state = right === blanks.length ? "right" : right ? "partial" : "wrong";
      return {
        state, shake: notes,
        title: state === "right" ? "All four blanks are right: this is explicit Euler." : `${right} of ${blanks.length} blanks right.`,
        body: state === "right" ? "Error per step is O(h²), so the total error after n steps is O(h): halve h, halve the error." : "The notes under the code say what each wrong blank would do.",
      };
    },
    reveal() {
      blanks.forEach((b, i) => { b.value = BLANKS[i].ok[0].replace(",", ", ").replace("+", " + "); b.dataset.state = "right"; });
      notes.replaceChildren();
    },
    reset() { blanks.forEach((b) => { b.value = ""; b.removeAttribute("data-state"); }); notes.replaceChildren(); },
  });
}

// ============================================================ select all

for (const root of document.querySelectorAll("[data-assess-select]")) {
  const opts = [...root.querySelectorAll("[data-assess-option]")];
  const boxes = opts.map((o) => o.querySelector("input"));
  const outs = Object.fromEntries([...root.querySelectorAll("[data-assess-score]")].map((n) => [n.dataset.assessScore, n]));
  const rules = [...root.querySelectorAll("[data-assess-rule]")];
  let rule = "right-wrong";

  function scores() {
    const k = opts.filter((o) => o.dataset.correct === "true").length;
    let R = 0, W = 0, same = 0;
    opts.forEach((o, i) => {
      const c = o.dataset.correct === "true", t = boxes[i].checked;
      if (t && c) R++;
      if (t && !c) W++;
      if (t === c) same++;
    });
    return { "right-wrong": Math.max(0, (R - W) / k), "per-option": same / opts.length, all: same === opts.length ? 1 : 0, R, W, k };
  }
  function paint() {
    const s = scores();
    for (const [key, n] of Object.entries(outs)) n.textContent = s[key].toFixed(2);
    rules.forEach((r) => r.toggleAttribute("data-on", r.dataset.assessRule === rule));
  }
  root.addEventListener("change", () => { opts.forEach((o) => o.removeAttribute("data-state")); paint(); });
  root.addEventListener("seg-change", (e) => { rule = e.detail.value; paint(); });
  exercise(root, {
    check() {
      if (!boxes.some((b) => b.checked)) return { state: "info", title: "Tick at least one matrix." };
      opts.forEach((o, i) => {
        const c = o.dataset.correct === "true", t = boxes[i].checked;
        o.dataset.state = t ? (c ? "right" : "wrong") : c ? "missed" : "";
        if (!o.dataset.state) o.removeAttribute("data-state");
        const why = o.querySelector("[data-assess-why]");
        why.textContent = o.dataset.why;
        why.hidden = !(t || c);
      });
      const s = scores();
      const name = { "right-wrong": "right minus wrong", "per-option": "per option", all: "all or nothing" }[rule];
      const score = s[rule];
      return {
        state: score === 1 ? "right" : score > 0 ? "partial" : "wrong",
        title: `Score ${score.toFixed(2)} under ${name}.`,
        body: [`${s.R} of ${s.k} invertible matrices ticked, ${s.W} singular ${s.W === 1 ? "one" : "ones"} ticked. A matrix is invertible exactly when its determinant is not 0.`, "Dashed red: an invertible matrix you missed."],
      };
    },
    reset() {
      boxes.forEach((b) => (b.checked = false));
      opts.forEach((o) => { o.removeAttribute("data-state"); o.querySelector("[data-assess-why]").hidden = true; });
      paint();
    },
  });
  paint();
}

// ============================================================ hint ladder

for (const root of document.querySelectorAll("[data-assess-ladder]")) {
  const input = root.querySelector("[data-assess-input]");
  const left = root.querySelector("[data-assess-points-left]");
  const next = root.querySelector("[data-assess-next-cost]");
  const pips = [...root.querySelector("[data-assess-meter]").children];
  const costs = [...root.querySelectorAll("[data-assess-hint]")].map((li) => +li.dataset.cost);
  const X = Math.log2(10);
  let max = 10, used = 0, done = false;

  function paint() {
    left.textContent = `${max} / 10`;
    pips.forEach((p, i) => p.toggleAttribute("data-spent", i >= max));
    next.textContent = done ? "Solved." : used < costs.length ? `Next hint: −${Math.min(costs[used], max)} point${costs[used] === 1 ? "" : "s"}${used === costs.length - 1 ? " (it gives the answer away)" : ""}.` : "No hints left.";
  }
  input.addEventListener("input", () => input.removeAttribute("data-state"));
  exercise(root, {
    status: ({ tries }) => `${tries} ${tries === 1 ? "check" : "checks"} · ${max} pts available`,
    check() {
      if (done) return { state: "info", title: `Already solved, for ${max} of 10 points.` };
      const t = input.value.trim().replace(",", ".").replace("−", "-");
      if (!t) return { state: "info", title: "Type a value for x first." };
      const v = Number(t);
      if (!Number.isFinite(v)) { input.dataset.state = "wrong"; return { state: "wrong", title: "That isn't a number.", shake: input }; }
      const dec = (t.split(".")[1] ?? "").length;
      if (dec < 3 && Math.abs(v - X) <= 0.5 * 10 ** -dec) { input.dataset.state = "right"; return { state: "partial", title: "Right, to fewer decimals.", body: "Give 3 decimal places: no points lost." }; }
      if (Math.abs(v - X) <= 0.0006) {
        done = true;
        input.dataset.state = "right";
        paint();
        return { state: "right", title: `Correct: x = log₂ 10 ≈ 3.322. You earn ${max} of 10 points.`, body: max === 0 ? "The bottom-out hint gave it away, so the exercise counts as completed but scores 0." : used ? `${used} hint${used === 1 ? "" : "s"} used.` : "No hints: full marks." };
      }
      max = Math.max(0, max - 1);
      paint();
      input.dataset.state = "wrong";
      const why = Math.abs(v - 5) < 1e-9 ? "10 / 2 = 5 divides; the unknown is an exponent, not a factor." : Math.abs(v - Math.log10(2)) < 0.001 ? "That is log 2 / log 10: the ratio is upside down." : "Check: 2 to the power of your answer should give 10.";
      return { state: "wrong", title: "Not quite: −1 point.", body: why, shake: input };
    },
    onHint(i) { max = Math.max(0, max - costs[i]); used = i + 1; paint(); },
    reset() { input.value = ""; input.removeAttribute("data-state"); },
  });
  paint();
}

// ============================================================ confidence

for (const root of document.querySelectorAll("[data-assess-conf]")) {
  const claims = [...root.querySelectorAll("[data-assess-claim]")];
  const outs = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  for (const c of claims) {
    const r = c.querySelector("[data-assess-conf-range]"), o = c.querySelector("[data-assess-conf-out]");
    r.addEventListener("input", () => (o.textContent = `${r.value}%`));
  }
  const blank = () => { outs.brier.textContent = "— (0 is perfect, 0.25 is always saying 50%)"; outs.acc.textContent = "—"; outs.conf.textContent = "—"; };
  exercise(root, {
    check() {
      const said = claims.map((c) => c.querySelector("input[type=radio]:checked")?.value);
      const missing = said.filter((s) => !s).length;
      if (missing) return { state: "info", title: `Answer all five first: ${missing} left.` };
      let sum = 0, right = 0, conf = 0;
      claims.forEach((c, i) => {
        const truth = c.dataset.truth === "true", callTrue = said[i] === "true";
        const k = +c.querySelector("[data-assess-conf-range]").value / 100;
        const p = callTrue ? k : 1 - k, o = truth ? 1 : 0;
        const b = (p - o) ** 2;
        sum += b; conf += k;
        const ok = callTrue === truth;
        if (ok) right++;
        c.dataset.state = ok ? "right" : "wrong";
        mark(c.querySelector("[data-assess-claim-n]"), ok ? "right" : "wrong");
        c.querySelector("[data-assess-brier]").textContent = `(${p.toFixed(2)} − ${o})² = ${b.toFixed(3)}`;
        const why = c.querySelector("[data-assess-why]");
        why.textContent = `${truth ? "True" : "False"}. ${c.dataset.why}`;
        why.hidden = false;
      });
      const n = claims.length, brier = sum / n, acc = right / n, mc = conf / n;
      outs.brier.textContent = `${brier.toFixed(3)} (0 is perfect, 0.25 is always saying 50%)`;
      outs.acc.textContent = `${Math.round(acc * 100)}% (${right} of ${n})`;
      outs.conf.textContent = `${Math.round(mc * 100)}%`;
      const gap = mc - acc;
      const cal = Math.abs(gap) < 0.1 ? "Your confidence matches your accuracy: well calibrated." : gap > 0 ? `You were ${Math.round(gap * 100)} points more confident than accurate: overconfident.` : `You were right more often than you claimed: underconfident by ${Math.round(-gap * 100)} points.`;
      return { state: brier < 0.1 ? "right" : brier < 0.25 ? "partial" : "wrong", title: `Brier score ${brier.toFixed(3)}${brier < 0.25 ? ": better than guessing" : ": no better than always saying 50%"}.`, body: cal };
    },
    reset() {
      claims.forEach((c) => {
        c.querySelectorAll("input[type=radio]").forEach((r) => (r.checked = false));
        const r = c.querySelector("[data-assess-conf-range]");
        r.value = "75";
        c.querySelector("[data-assess-conf-out]").textContent = "75%";
        c.querySelector("[data-assess-brier]").textContent = "";
        c.querySelector("[data-assess-why]").hidden = true;
        c.removeAttribute("data-state");
        mark(c.querySelector("[data-assess-claim-n]"), null);
      });
      blank();
    },
  });
}

// ============================================================ faded examples

const MML = "http://www.w3.org/1998/Math/MathML";
function texNode(src) {
  if (src.startsWith("d/dx ")) {
    const m = toMathML(parse(src.slice(5)));
    const frac = document.createElementNS(MML, "mfrac");
    const d = document.createElementNS(MML, "mi"); d.textContent = "d";
    const dx = document.createElementNS(MML, "mrow");
    const d2 = document.createElementNS(MML, "mi"); d2.textContent = "d";
    const x = document.createElementNS(MML, "mi"); x.textContent = "x";
    dx.append(d2, x);
    frac.append(d, dx);
    m.prepend(frac);
    return m;
  }
  return toMathML(parse(src));
}

for (const root of document.querySelectorAll("[data-assess-fade]")) {
  const probs = [...root.querySelectorAll("[data-assess-problem]")];
  root.querySelectorAll("[data-assess-tex]").forEach((n) => n.replaceChildren(texNode(n.dataset.assessTex)));
  const fills = (p) => [...p.querySelectorAll("[data-assess-fill]")];
  let cur = 1;
  root.addEventListener("input", (e) => e.target.removeAttribute?.("data-state"));

  function open(k) {
    cur = k;
    probs.forEach((p, i) => {
      p.dataset.open = String(i <= k);
      fills(p).forEach((f) => (f.disabled = i !== k || p.hasAttribute("data-done")));
    });
  }
  const ex = exercise(root, {
    status: () => (cur < probs.length ? `example ${cur + 1} of ${probs.length}` : "all examples done"),
    check() {
      if (cur >= probs.length) return { state: "info", title: "All four examples are done." };
      const p = probs[cur], fs = fills(p);
      if (fs.some((f) => !f.value.trim())) return { state: "info", title: `Fill in every step of example ${cur + 1}.` };
      const wrong = [];
      for (const f of fs) {
        let ok = false;
        try { ok = equivalent(parse(f.value), parse(f.dataset.assessFill)).ok; } catch { ok = false; }
        f.dataset.state = ok ? "right" : "wrong";
        if (!ok) wrong.push(f.getAttribute("aria-label").split(", ")[1]);
      }
      if (wrong.length) return { state: "wrong", title: `Example ${cur + 1}: ${wrong.join(" and ")} ${wrong.length === 1 ? "is" : "are"} not right yet.`, body: "Compare with the worked example to the left: the same steps, new numbers.", shake: p };
      p.setAttribute("data-done", "");
      const k = cur + 1;
      open(k);
      if (k < probs.length) {
        fills(probs[k])[0]?.focus();
        return { state: "right", title: `Example ${cur} done.`, body: `Example ${k + 1} leaves ${fills(probs[k]).length === 4 ? "every step" : `${fills(probs[k]).length} steps`} to you.` };
      }
      return { state: "right", title: "All four done, the last one on your own.", body: "That is the point of fading: the support is withdrawn one step at a time." };
    },
    reveal() {
      if (cur >= probs.length) return;
      fills(probs[cur]).forEach((f) => { f.value = f.dataset.assessFill; f.dataset.state = "right"; });
    },
    reset() {
      probs.forEach((p) => { p.removeAttribute("data-done"); fills(p).forEach((f) => { f.value = ""; f.removeAttribute("data-state"); }); });
      open(1);
    },
  });
  open(1);
  ex.status();
}
