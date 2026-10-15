// Teaching tools, part 2: cohort analytics, the experiment decision panel,
// the feedback comment bank, misconception rules, the grade book. Every
// block root is data-teach-*, so this module does nothing on other pages.

import {
  part, mk, svg, svgText, onSwitch, status, fmt, table, row, pill, btn, inputCls,
  rng, gauss, normCdf,
} from "./teach-util.js";
import { parse, equivalent, ParseError } from "./assess-expr.js";

// ============================================================ cohort analytics

for (const root of document.querySelectorAll("[data-teach-cohort]")) {
  const LESSONS = ["Vectors", "Linear combos", "Dot product", "Matrices", "Elimination", "Determinants",
    "Inverses", "Span & basis", "Eigenvalues", "Diagonalising", "SVD", "PCA project"];
  const N = 400, EX = 4;
  // Chance to go on to the next lesson, the median minutes, and how hard
  // each exercise is (chance of success per attempt).
  const CONT = [0.86, 0.95, 0.94, 0.93, 0.77, 0.92, 0.93, 0.9, 0.91, 0.93, 0.92, 1];
  const MED = [14, 16, 15, 20, 31, 22, 19, 21, 26, 23, 28, 45];
  let seed = 5, sel = 4, data;

  function simulate() {
    const r = rng(seed);
    const reached = Array(LESSONS.length).fill(0);
    const times = LESSONS.map(() => []);
    const attempts = LESSONS.map(() => Array.from({ length: EX }, () => [0, 0, 0, 0, 0]));
    const diff = LESSONS.map((_, l) => Array.from({ length: EX }, (_, e) => {
      const base = 0.75 - 0.08 * e;
      return l === 4 && e === 2 ? 0.28 : Math.max(0.3, base + (r() - 0.5) * 0.2);
    }));
    for (let i = 0; i < N; i++) {
      const grit = gauss(r) * 0.04;
      for (let l = 0; l < LESSONS.length; l++) {
        reached[l]++;
        times[l].push(MED[l] * Math.exp(0.55 * gauss(r)));
        for (let e = 0; e < EX; e++) {
          let k = 1;
          while (r() > diff[l][e] && k < 5) k++;
          attempts[l][e][k - 1]++;
        }
        if (r() > Math.min(1, CONT[l] + grit)) break;
      }
    }
    data = { reached, times, attempts };
    const drops = reached.slice(1).map((v, i) => 1 - v / reached[i]);
    data.worst = drops.indexOf(Math.max(...drops)) + 1;
    part(root, "summary").textContent = `${N} started · ${reached[reached.length - 1]} finished (${Math.round(100 * reached[reached.length - 1] / N)}%)`;
    draw();
  }

  function draw(focus) {
    const s = part(root, "funnel");
    const W = 640, H = 220, L = 34, B = 40, T = 34;
    const bw = (W - L - 8) / LESSONS.length;
    s.setAttribute("viewBox", `0 0 ${W} ${H}`);
    s.replaceChildren();
    const y = (v) => T + (H - T - B) * (1 - v / N);
    for (const t of [0, 100, 200, 300, 400]) {
      svg("line", { x1: L, x2: W - 4, y1: y(t), y2: y(t), style: "stroke:currentColor;stroke-opacity:0.07" }, s);
      svgText(s, L - 6, y(t) + 3, String(t), { "text-anchor": "end" });
    }
    data.reached.forEach((v, l) => {
      const x = L + l * bw + 4, isSel = l === sel, worst = l === data.worst;
      const g = svg("g", { tabindex: l === sel ? "0" : "-1", role: "button", "data-lesson": String(l), class: "cursor-pointer outline-none group",
        "aria-pressed": String(isSel), "aria-label": `Lesson ${l + 1}, ${LESSONS[l]}: ${v} learners${worst ? ", steepest drop" : ""}` }, s);
      svg("rect", { x, y: y(v), width: bw - 8, height: y(0) - y(v), rx: 3,
        class: "transition-[fill] duration-150 group-focus-visible:stroke-ring",
        style: `fill:${isSel ? "var(--brand)" : "currentColor"};fill-opacity:${isSel ? 0.75 : 0.18};stroke-width:2` }, g);
      svgText(g, x + (bw - 8) / 2, y(v) - 4, String(v), { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
      svgText(g, x + (bw - 8) / 2, H - B + 14, String(l + 1), { "text-anchor": "middle" });
      if (worst) {
        const prev = data.reached[l - 1];
        svgText(s, x + (bw - 8) / 2, H - B + 28, `−${Math.round(100 * (1 - v / prev))}%`, { "text-anchor": "middle", class: "font-mono text-[10px]", style: "fill:var(--code-del)" });
        svg("line", { x1: x - 4, x2: x - 4, y1: y(prev), y2: y(v), style: "stroke:var(--code-del);stroke-width:1.5;stroke-dasharray:3 2" }, s);
      }
    });
    svgText(s, W - 4, H - 4, "lesson", { "text-anchor": "end" });
    svgText(s, 4, 12, "learners reaching it");
    if (focus) s.querySelector(`[data-lesson="${sel}"]`)?.focus();
    detail();
  }

  function detail() {
    const ts = [...data.times[sel]].sort((a, b) => a - b);
    const q = (p) => ts[Math.min(ts.length - 1, Math.floor(p * ts.length))];
    const mean = ts.reduce((a, b) => a + b, 0) / ts.length;
    const h = part(root, "hist");
    const W = 320, H = 130, L = 8, B = 22, BIN = 5, MAX = 120;
    h.setAttribute("viewBox", `0 0 ${W} ${H}`);
    h.replaceChildren();
    const bins = Array(MAX / BIN).fill(0);
    for (const t of ts) bins[Math.min(bins.length - 1, Math.floor(t / BIN))]++;
    const top = Math.max(...bins);
    const bx = (W - 2 * L) / bins.length;
    const sx = (v) => L + (v / MAX) * (W - 2 * L);
    bins.forEach((c, i) => svg("rect", { x: L + i * bx + 0.5, y: H - B - (H - B - 8) * c / top, width: bx - 1, height: (H - B - 8) * c / top, style: "fill:currentColor;fill-opacity:0.2" }, h));
    for (const t of [0, 30, 60, 90, 120]) svgText(h, sx(t), H - 6, `${t}`, { "text-anchor": "middle" });
    const med = q(0.5);
    svg("line", { x1: sx(med), x2: sx(med), y1: 6, y2: H - B, style: "stroke:var(--brand);stroke-width:1.5" }, h);
    svgText(h, sx(med) + 3, 14, "median", { style: "fill:var(--brand)" });
    svg("line", { x1: sx(mean), x2: sx(mean), y1: 22, y2: H - B, style: "stroke:currentColor;stroke-opacity:0.5;stroke-dasharray:3 2" }, h);
    svgText(h, sx(mean) + 3, 30, "mean");
    part(root, "timeinfo").textContent = `${LESSONS[sel]} · ${ts.length} learners · median ${fmt(med, 0)} min · mean ${fmt(mean, 0)} min · 90th percentile ${fmt(q(0.9), 0)} min`;

    const heat = part(root, "heat");
    const head = ["Exercise", "1", "2", "3", "4", "5+"];
    let worstEx = 0, worstShare = -1;
    const rows = data.attempts[sel].map((a, e) => {
      const tot = a.reduce((s, v) => s + v, 0);
      const three = (a[2] + a[3] + a[4]) / tot;
      if (three > worstShare) { worstShare = three; worstEx = e; }
      return row([mk("span", "font-mono text-xs", `${sel + 1}.${e + 1}`), ...a.map((v) => {
        const c = mk("span", "flex h-7 w-12 items-center justify-center rounded font-mono text-[10px] tabular-nums", `${Math.round(100 * v / tot)}%`);
        c.style.background = `color-mix(in oklab, var(--brand) ${Math.round(85 * v / tot)}%, transparent)`;
        return c;
      })]);
    });
    const t = table(head, rows, "text-sm [&_td]:px-1 [&_td]:py-1 [&_th]:px-1");
    t.setAttribute("aria-label", "Share of learners by number of attempts needed");
    heat.replaceChildren(t);
    part(root, "heatinfo").textContent = worstShare > 0.35
      ? `Exercise ${sel + 1}.${worstEx + 1} took three or more attempts for ${Math.round(100 * worstShare)}% of learners. Check its wording, or add a worked example before it.`
      : `Attempts look healthy: no exercise needs three or more tries for over a third of learners.`;
    status(root, `lesson ${sel + 1} selected · steepest drop before lesson ${data.worst + 1}`);
  }

  const svgEl = part(root, "funnel");
  svgEl.addEventListener("click", (e) => { const g = e.target.closest("[data-lesson]"); if (g) { sel = Number(g.dataset.lesson); draw(true); } });
  svgEl.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-lesson]");
    if (!g) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); sel = (sel + (e.key === "ArrowRight" ? 1 : -1) + LESSONS.length) % LESSONS.length; draw(true); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel = Number(g.dataset.lesson); draw(true); }
  });
  part(root, "resample").addEventListener("click", () => { seed = (seed * 48271 + 3) % 2147483647; simulate(); });
  simulate();
}

// ============================================================ experiment decision

for (const root of document.querySelectorAll("[data-teach-decision]")) {
  const v = {
    A: { n: 820, pass: 492, finish: 690, time: 24.0, sd: 9 },
    B: { n: 805, pass: 531, finish: 668, time: 26.5, sd: 10 },
  };
  const FIELDS = [["n", "Learners"], ["pass", "Passed quiz"], ["finish", "Finished lesson"], ["time", "Mean minutes"], ["sd", "SD minutes"]];
  const Z = 1.959964;

  const ins = part(root, "inputs");
  const rows = ["A", "B"].map((k) => row([
    mk("span", "font-medium whitespace-nowrap", k === "A" ? "A · current lesson" : "B · new lesson"),
    ...FIELDS.map(([f, l]) => {
      const i = mk("input", inputCls + " w-20 font-mono tabular-nums");
      i.type = "number"; i.min = "0"; i.step = f === "time" || f === "sd" ? "0.5" : "1";
      i.value = String(v[k][f]); i.dataset.f = `${k}:${f}`;
      i.setAttribute("aria-label", `${l}, variant ${k}`);
      return i;
    }),
  ]));
  ins.replaceChildren(table(["Variant", ...FIELDS.map((f) => f[1])], rows, "w-full min-w-[620px] text-sm"));
  ins.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const [k, name] = f.split(":");
    v[k][name] = Math.max(0, Number(e.target.value) || 0);
    update();
  });

  // One metric row: estimate, 95% interval, the zero line and the margin.
  function metric(title, role, d, lo, hi, unit, lim, margin, marginLabel, good) {
    const box = mk("div", "flex flex-col gap-2 rounded-xl border p-3");
    const headEl = mk("div", "flex flex-wrap items-baseline gap-2");
    headEl.append(mk("span", "text-sm font-medium", title), pill(role, role === "primary" ? "brand" : "muted"),
      mk("span", "ml-auto font-mono text-xs tabular-nums", `${d >= 0 ? "+" : ""}${fmt(d, 1)} ${unit}  [${fmt(lo, 1)}, ${fmt(hi, 1)}]`));
    const s = svg("svg", { viewBox: "0 0 640 36", class: "block h-auto w-full", "aria-hidden": "true" });
    const sx = (x) => 10 + ((x + lim) / (2 * lim)) * 620;
    svg("line", { x1: 10, x2: 630, y1: 16, y2: 16, style: "stroke:currentColor;stroke-opacity:0.15" }, s);
    svg("line", { x1: sx(0), x2: sx(0), y1: 4, y2: 28, style: "stroke:currentColor;stroke-opacity:0.5" }, s);
    svgText(s, sx(0), 33, "0", { "text-anchor": "middle" });
    if (margin !== null) {
      svg("line", { x1: sx(margin), x2: sx(margin), y1: 4, y2: 28, style: "stroke:var(--code-del);stroke-dasharray:3 2" }, s);
      svgText(s, sx(margin) + (margin < 0 ? -3 : 3), 9, marginLabel, { "text-anchor": margin < 0 ? "end" : "start", style: "fill:var(--code-del)" });
    }
    const c = (x) => Math.max(10, Math.min(630, sx(x)));
    const col = good === true ? "var(--brand)" : good === false ? "var(--code-del)" : "currentColor";
    svg("line", { x1: c(lo), x2: c(hi), y1: 16, y2: 16, style: `stroke:${col};stroke-width:4;stroke-linecap:round;stroke-opacity:0.8` }, s);
    svg("circle", { cx: c(d), cy: 16, r: 4.5, style: `fill:var(--background);stroke:${col};stroke-width:2` }, s);
    box.append(headEl, s);
    return box;
  }

  function update() {
    const A = v.A, B = v.B;
    const ok = A.n > 0 && B.n > 0 && A.pass <= A.n && B.pass <= B.n && A.finish <= A.n && B.finish <= B.n;
    const verdictEl = part(root, "verdict");
    if (!ok) {
      part(root, "metrics").replaceChildren();
      verdictEl.className = "rounded-xl border border-del/40 bg-del/5 p-4";
      verdictEl.replaceChildren(mk("p", "text-sm", "Counts can't exceed the number of learners."));
      return;
    }
    const prop = (x1, n1, x2, n2) => {
      const p1 = x1 / n1, p2 = x2 / n2, d = (p2 - p1) * 100;
      const se = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2) * 100;
      return [d, d - Z * se, d + Z * se, se];
    };
    const [dp, lp, hp, sep] = prop(A.pass, A.n, B.pass, B.n);
    const [df, lf, hf] = prop(A.finish, A.n, B.finish, B.n);
    const dt = B.time - A.time, set = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n);
    const lt = dt - Z * set, ht = dt + Z * set;
    const FIN_MARGIN = -3, TIME_MARGIN = 5;
    const finHarm = lf < FIN_MARGIN, timeHarm = ht > TIME_MARGIN;
    const primaryWin = lp > 0, primaryLoss = hp < 0;
    part(root, "metrics").replaceChildren(
      metric("Passed the end-of-lesson quiz", "primary", dp, lp, hp, "pts", 12, null, "", primaryWin ? true : primaryLoss ? false : null),
      metric("Finished the lesson", "guardrail", df, lf, hf, "pts", 12, FIN_MARGIN, "−3 pts limit", finHarm ? false : null),
      metric("Minutes spent", "guardrail", dt, lt, ht, "min", 8, TIME_MARGIN, "+5 min limit", timeHarm ? false : null),
    );
    const p = 2 * (1 - normCdf(Math.abs(dp / sep)));
    let tone, title, body;
    if (primaryWin && !finHarm && !timeHarm) {
      tone = "brand"; title = "Ship B.";
      body = `The pass rate rises by ${fmt(dp, 1)} points (95% interval ${fmt(lp, 1)} to ${fmt(hp, 1)}, p ${p < 0.001 ? "< 0.001" : "= " + fmt(p, 3)}), and neither guardrail could be worse than its limit.`;
    } else if (primaryLoss || ((finHarm || timeHarm) && !primaryWin)) {
      tone = "del"; title = "Keep A.";
      body = primaryLoss ? "B's pass rate is clearly lower." : `B's ${finHarm ? "completion may fall by more than 3 points" : "time cost may exceed 5 extra minutes"} without a clear gain in learning.`;
    } else if (primaryWin) {
      tone = "muted"; title = "B teaches better, but a guardrail is at risk.";
      body = `Pass rate +${fmt(dp, 1)} points, but ${finHarm ? "completion could drop by more than 3 points" : "it could take more than 5 extra minutes"}. Decide whether the gain is worth it, or fix the length of B and test again.`;
    } else {
      tone = "muted"; title = "Keep collecting.";
      body = `The interval for the pass rate (${fmt(lp, 1)} to ${fmt(hp, 1)} points) still includes zero. Stopping now would be a guess; run until the sample size planned in advance.`;
    }
    verdictEl.className = `rounded-xl border p-4 ${tone === "brand" ? "border-brand/50 bg-brand/5" : tone === "del" ? "border-del/40 bg-del/5" : ""}`;
    const tt = mk("p", `text-base font-semibold ${tone === "brand" ? "text-brand" : tone === "del" ? "text-del" : ""}`, title);
    verdictEl.replaceChildren(tt, mk("p", "mt-1 text-sm leading-relaxed text-muted-foreground", body),
      mk("p", "mt-2 font-mono text-[11px] text-muted-foreground", "Rule set before the test: ship if the pass-rate interval is above 0 and neither guardrail interval crosses its limit."));
    status(root, `${A.n + B.n} learners · difference in pass rate ${dp >= 0 ? "+" : ""}${fmt(dp, 1)} pts`);
  }
  update();
}

// ============================================================ comment bank

for (const root of document.querySelectorAll("[data-teach-comments]")) {
  let bank = [
    "{name}, your base case is clear and correctly checked. #praise #proof",
    "The inductive step assumes what it needs to prove. Try writing P(k) and P(k+1) side by side before you start. #proof #next-step",
    "Name variables after what they hold, rows and cols rather than a and b, so the reader can follow. #code",
    "Your function works. Next, add a test for the empty matrix: what should it return? #code #next-step",
    "Watch the notation: A⁻¹ is the inverse matrix, not 1/A. Division by a matrix isn't defined. #notation",
    "Great persistence, {name}: four attempts, and you found the error yourself. #effort #praise",
    "Check the dimensions before multiplying: a (2×3) matrix times a (2×3) matrix isn't defined. #notation #next-step",
    "Your explanation would convince a classmate. Could you say it in three sentences? #praise #next-step",
    "This answer is right, but the method won't scale to 10×10 matrices. Look at row reduction for a faster route. #next-step",
    "Clear plot. Label the axes with units so it stands on its own. #code #next-step",
  ].map((t) => ({ text: t.replace(/\s*#[\w-]+/g, "").trim(), tags: [...t.matchAll(/#([\w-]+)/g)].map((m) => m[1]) }));
  const active = new Set();
  const filter = part(root, "filter"), list = part(root, "bank"), text = part(root, "text"), nameIn = part(root, "name");
  let caret = text.value.length;
  text.addEventListener("select", () => (caret = text.selectionStart));
  text.addEventListener("keyup", () => (caret = text.selectionStart));
  text.addEventListener("click", () => (caret = text.selectionStart));

  function tags() {
    const all = [...new Set(bank.flatMap((b) => b.tags))].sort();
    part(root, "tags").replaceChildren(...all.map((t) => {
      const b = mk("button", `rounded-md border px-2 py-0.5 font-mono text-[11px] outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${active.has(t) ? "border-brand/50 bg-brand/10 text-brand" : "text-muted-foreground"}`, `#${t}`);
      b.type = "button"; b.dataset.tag = t; b.setAttribute("aria-pressed", String(active.has(t)));
      return b;
    }));
  }
  function render() {
    const q = filter.value.trim().toLowerCase();
    const shown = bank.map((b, i) => [b, i]).filter(([b]) => (!q || b.text.toLowerCase().includes(q)) && [...active].every((t) => b.tags.includes(t)));
    list.replaceChildren(...shown.map(([b, i]) => {
      const li = mk("li");
      const bt = mk("button", "flex w-full flex-col gap-1.5 rounded-lg border bg-background p-2.5 text-left text-sm leading-relaxed outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50");
      bt.type = "button"; bt.dataset.insert = String(i);
      bt.setAttribute("aria-label", `Insert: ${b.text}`);
      const tg = mk("span", "flex flex-wrap gap-1");
      tg.append(...b.tags.map((t) => pill(`#${t}`)));
      bt.append(mk("span", "", b.text), tg);
      li.append(bt);
      return li;
    }));
    if (!shown.length) list.append(mk("li", "rounded-lg border border-dashed p-3 text-sm text-muted-foreground", "No saved comment matches."));
    status(root, `${shown.length} of ${bank.length} comments`);
  }

  const RULES = [
    { re: /\b(just|obviously|simply|clearly|easy|trivial(ly)?)\b/gi, msg: (w) => `“${w}” can make a learner who didn't see it feel slow. Leave it out.` },
    { re: /\b[A-Z]{4,}\b|!{2,}/g, msg: (w) => `“${w}” reads as shouting.` },
    { re: /\byou (always|never)\b/gi, msg: (w) => `“${w}” judges the person, not this piece of work.` },
  ];
  const CRIT = /\b(wrong|incorrect|incomplete|missing|error|mistake|skipped|fails?|confused|sloppy)\b/i;
  const NEXT = /\b(try|next|could|consider|check|add|start|look at|rewrite|compare|instead)\b|\?/i;
  const PRAISE = /\b(good|clear|nice|well|great|correct(ly)?|works|right|strong|careful)\b/i;

  function tone() {
    const t = text.value;
    const out = [];
    for (const r of RULES) for (const m of t.matchAll(r.re)) out.push(r.msg(m[0]));
    if (CRIT.test(t) && !NEXT.test(t)) out.push("Says what's wrong but not what to do next. Add one concrete next step.");
    if (CRIT.test(t) && !PRAISE.test(t)) out.push("No strength is named. Feedback lands better when it starts from what works.");
    const words = t.trim().split(/\s+/).filter(Boolean).length;
    if (words > 120) out.push(`${words} words: a learner may not read it all. Keep the one most useful point.`);
    const box = part(root, "tone");
    if (!t.trim()) { box.replaceChildren(mk("li", "text-sm text-muted-foreground", "Write or insert feedback to check its tone.")); return; }
    box.replaceChildren(...(out.length ? [...new Set(out)].map((m) => {
      const li = mk("li", "flex gap-2 rounded-lg border border-del/30 bg-del/5 p-2.5 text-sm leading-relaxed");
      li.append(mk("span", "font-mono text-xs text-del", "!"), mk("span", "", m));
      return li;
    }) : [(() => { const li = mk("li", "flex gap-2 rounded-lg border border-brand/40 bg-brand/5 p-2.5 text-sm"); li.append(mk("span", "font-mono text-xs text-brand", "✓"), mk("span", "", "Nothing flagged by the word lists. Read it once more as the learner would.")); return li; })()]));
  }

  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-insert]");
    if (!b) return;
    const s = bank[Number(b.dataset.insert)].text.replaceAll("{name}", nameIn.value.trim() || "there");
    const v = text.value;
    const at = Math.min(caret, v.length);
    const before = v.slice(0, at), after = v.slice(at);
    const ins = (before && !/\s$/.test(before) ? " " : "") + s + (after && !/^\s/.test(after) ? " " : "");
    text.value = before + ins + after;
    caret = at + ins.length;
    text.focus();
    text.setSelectionRange(caret, caret);
    tone();
  });
  part(root, "tags").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    active.has(b.dataset.tag) ? active.delete(b.dataset.tag) : active.add(b.dataset.tag);
    tags(); render();
    part(root, "tags").querySelector(`[data-tag="${b.dataset.tag}"]`)?.focus();
  });
  part(root, "new").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = e.target.querySelector("input");
    const raw = inp.value.trim();
    if (!raw) return;
    bank.unshift({ text: raw.replace(/\s*#[\w-]+/g, "").trim(), tags: [...raw.matchAll(/#([\w-]+)/g)].map((m) => m[1]) });
    inp.value = "";
    tags(); render();
  });
  filter.addEventListener("input", render);
  text.addEventListener("input", tone);
  tags(); render(); tone();
}

// ============================================================ misconception rules

for (const root of document.querySelectorAll("[data-teach-rules]")) {
  let uid = 0;
  const rules = [
    ["2x cos(x)", "Product rule: you differentiated both factors and multiplied them. Use (uv)′ = u′v + uv′."],
    ["x^2 cos(x)", "You differentiated sin x but treated x² as a constant. Both factors change."],
    ["2x sin(x) - x^2 cos(x)", "Check the sign: the derivative of sin x is +cos x."],
    ["2x sin(x)", "That's only the first half of the product rule. Add u·v′."],
  ].map(([expr, msg]) => ({ id: ++uid, expr, msg }));
  const keyIn = part(root, "key"), tests = part(root, "tests"), list = part(root, "rules");
  const tryParse = (s) => { try { return { tree: parse(s, ["x"]) }; } catch (e) { return { err: e instanceof ParseError ? e.message : "Can't read this." }; } };
  const same = (a, b) => equivalent(a, b, { lo: -2, hi: 2, n: 12, seed: 7 }).ok;

  function renderRules(focusSel) {
    list.replaceChildren(...rules.map((r, i) => {
      const li = mk("li", "flex flex-col gap-1.5 rounded-xl border bg-background p-2.5");
      li.dataset.rule = String(r.id);
      const top = mk("div", "flex items-center gap-2");
      top.append(mk("span", "w-6 font-mono text-[11px] text-muted-foreground", `R${i + 1}`));
      const ex = mk("input", inputCls + " w-full font-mono");
      ex.value = r.expr; ex.dataset.f = `expr:${r.id}`; ex.spellcheck = false;
      ex.setAttribute("aria-label", `Rule ${i + 1} expression`);
      const del = btn("✕", "size-7 px-0");
      del.dataset.remove = String(r.id); del.setAttribute("aria-label", `Remove rule ${i + 1}`);
      top.append(ex, del);
      const msg = mk("input", inputCls + " w-full");
      msg.value = r.msg; msg.dataset.f = `msg:${r.id}`;
      msg.setAttribute("aria-label", `Rule ${i + 1} feedback`);
      const note = mk("p", "min-h-4 pl-8 font-mono text-[10px] text-muted-foreground");
      note.dataset.note = String(r.id);
      li.append(top, msg, note);
      return li;
    }));
    evaluate();
    if (focusSel) list.querySelector(focusSel)?.focus();
  }

  function evaluate() {
    const key = tryParse(keyIn.value);
    keyIn.toggleAttribute("aria-invalid", !!key.err);
    keyIn.classList.toggle("border-del", !!key.err);
    const parsed = rules.map((r) => ({ ...r, ...tryParse(r.expr) }));
    parsed.forEach((r, i) => {
      const n = list.querySelector(`[data-note="${r.id}"]`);
      if (!n) return;
      let t = "", bad = false;
      if (r.err) { t = r.err; bad = true; }
      else if (key.tree && same(r.tree, key.tree)) { t = "Equals the accepted answer: it can never fire."; bad = true; }
      else {
        const earlier = parsed.slice(0, i).findIndex((p) => p.tree && same(r.tree, p.tree));
        if (earlier >= 0) { t = `Same as R${earlier + 1}, which is checked first: unreachable.`; bad = true; }
      }
      n.textContent = t;
      n.className = `min-h-4 pl-8 font-mono text-[10px] ${bad ? "text-del" : "text-muted-foreground"}`;
    });
    const lines = tests.value.split("\n").map((l) => l.trim()).filter(Boolean);
    let wrong = 0, caught = 0;
    const rows = lines.map((l) => {
      const a = tryParse(l);
      let out;
      if (a.err) out = [pill("can't read", "muted"), mk("span", "text-xs text-muted-foreground", "The learner is asked to check their syntax.")];
      else if (key.tree && same(a.tree, key.tree)) out = [pill("accepted", "brand"), mk("span", "text-xs text-muted-foreground", "Equal to the answer at every test point.")];
      else {
        wrong++;
        const k = parsed.findIndex((r) => r.tree && !(key.tree && same(r.tree, key.tree)) && same(a.tree, r.tree));
        if (k >= 0) { caught++; out = [pill(`R${k + 1}`, "muted"), mk("span", "text-xs leading-snug", rules[k].msg)]; }
        else out = [pill("no rule", "del"), mk("span", "text-xs text-muted-foreground", "Gets only the generic “not quite”. Worth a rule?")];
      }
      return row([mk("span", "font-mono text-xs whitespace-nowrap", l), ...out]);
    });
    part(root, "results").replaceChildren(table(["Answer", "Outcome", "Learner sees"], rows, "w-full min-w-[460px] text-sm"));
    const cov = part(root, "coverage");
    cov.textContent = wrong ? `${caught} of ${wrong} wrong answers caught` : "no wrong answers";
    cov.className = `font-mono text-xs tabular-nums ${wrong && caught < wrong ? "text-del" : "text-brand"}`;
    status(root, `${rules.length} rules · ${lines.length} test answers`);
  }

  list.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const [k, id] = f.split(":");
    const r = rules.find((x) => x.id === Number(id));
    r[k] = e.target.value;
    evaluate();
  });
  list.addEventListener("click", (e) => {
    const d = e.target.closest("[data-remove]");
    if (!d) return;
    rules.splice(rules.findIndex((x) => x.id === Number(d.dataset.remove)), 1);
    renderRules();
    part(root, "add").focus();
  });
  part(root, "add").addEventListener("click", () => {
    rules.push({ id: ++uid, expr: "2x + cos(x)", msg: "The derivative of a product isn't the product of derivatives, nor their sum." });
    renderRules(`[data-f="expr:${uid}"]`);
  });
  keyIn.addEventListener("input", evaluate);
  tests.addEventListener("input", evaluate);
  renderRules();
}

// ============================================================ grade book

for (const root of document.querySelectorAll("[data-teach-grades]")) {
  const CATS = [
    { name: "Homework", w: 25, items: [["HW 1", 92, 0], ["HW 2", 78, 0], ["HW 3", 55, 0], ["HW 4", 88, 2], ["HW 5", 95, 0], ["HW 6", 81, 0]], cls: "bg-vec-u/50" },
    { name: "Quizzes", w: 20, items: [["Quiz 1", 70, 0], ["Quiz 2", 85, 0], ["Quiz 3", 90, 0], ["Quiz 4", 65, 0]], cls: "bg-vec-v/50" },
    { name: "Project", w: 25, items: [["PCA project", 88, 1]], cls: "bg-vec-out/50" },
    { name: "Final exam", w: 30, items: [["Final", null, 0]], cls: "bg-brand/60", final: true },
  ];
  const finalIn = part(root, "final"), target = part(root, "target");
  let drop = true, late = true;
  drop = onSwitch(root, "drop", (on) => { drop = on; compute(); });
  late = onSwitch(root, "late", (on) => { late = on; compute(); });

  const eff = (score, days) => (score === null ? null : late ? score * (1 - Math.min(0.5, 0.1 * days)) : score);

  function build() {
    const rows = [];
    CATS.forEach((c, ci) => {
      const head = row([mk("span", "font-medium", c.name), mk("span", "font-mono text-xs text-muted-foreground", `${c.w}%`), "", "", mk("span", "font-mono text-xs tabular-nums", "—"), ""], "bg-muted/30");
      head.dataset.cat = String(ci);
      rows.push(head);
      c.items.forEach(([n, s, d], ii) => {
        const sc = mk("input", inputCls + " w-20 font-mono tabular-nums");
        sc.type = "number"; sc.min = "0"; sc.max = "100"; sc.value = s === null ? "" : String(s); sc.dataset.f = `s:${ci}:${ii}`;
        sc.setAttribute("aria-label", `${n} score`);
        if (c.final) { sc.disabled = true; sc.placeholder = "what-if"; }
        const dl = mk("input", inputCls + " w-16 font-mono tabular-nums");
        dl.type = "number"; dl.min = "0"; dl.max = "10"; dl.value = String(d); dl.dataset.f = `d:${ci}:${ii}`;
        dl.setAttribute("aria-label", `${n} days late`);
        if (c.final) dl.disabled = true;
        const r = row([mk("span", "pl-3 text-muted-foreground", n), "", sc, dl, mk("span", "font-mono text-xs tabular-nums"), mk("span", "flex flex-wrap gap-1")]);
        r.dataset.item = `${ci}:${ii}`;
        rows.push(r);
      });
    });
    part(root, "table").replaceChildren(table(["Category", "Weight", "Score", "Days late", "Counts as", "Note"], rows, "w-full min-w-[600px] text-sm"));
  }

  function compute() {
    const fin = Number(finalIn.value);
    part(root, "finalv").textContent = `${fin}%`;
    const avgs = CATS.map((c, ci) => {
      const vals = c.items.map(([, s, d], ii) => ({ ii, v: c.final ? fin : eff(s, d), raw: s, d }));
      const graded = vals.filter((x) => x.v !== null);
      let dropped = -1;
      if (drop && ci === 0 && graded.length >= 2) dropped = graded.reduce((m, x) => (x.v < m.v ? x : m)).ii;
      const kept = graded.filter((x) => x.ii !== dropped);
      const avg = kept.length ? kept.reduce((s, x) => s + x.v, 0) / kept.length : null;
      vals.forEach((x) => {
        const r = part(root, "table").querySelector(`[data-item="${ci}:${x.ii}"]`);
        const cells = r.querySelectorAll("td");
        cells[4].firstChild.textContent = x.v === null ? "not graded" : fmt(x.v, 1);
        const notes = cells[5].firstChild;
        notes.replaceChildren();
        if (x.ii === dropped) notes.append(pill("dropped", "muted"));
        if (late && !c.final && x.raw !== null && x.d > 0) notes.append(pill(`−${Math.min(50, 10 * x.d)}% late`, "del"));
        if (c.final) notes.append(pill("what-if", "brand"));
        r.classList.toggle("opacity-50", x.ii === dropped);
      });
      const head = part(root, "table").querySelector(`[data-cat="${ci}"] td:nth-child(5) span`);
      head.textContent = avg === null ? "—" : `${fmt(avg, 1)} avg`;
      return avg;
    });
    const used = CATS.map((c, i) => [c, avgs[i]]).filter(([, a]) => a !== null);
    const W = used.reduce((s, [c]) => s + c.w, 0);
    const grade = used.reduce((s, [c, a]) => s + c.w * a, 0) / W;
    const letter = grade >= 90 ? "A" : grade >= 80 ? "B" : grade >= 70 ? "C" : grade >= 60 ? "D" : "F";
    part(root, "grade").textContent = `${fmt(grade, 1)}% · ${letter}`;
    // Score needed on the final for the target, other categories fixed.
    const tgt = Number(target.value);
    const fc = CATS.findIndex((c) => c.final);
    const others = used.filter(([c]) => !c.final);
    const need = (tgt * W - others.reduce((s, [c, a]) => s + c.w * a, 0)) / CATS[fc].w;
    part(root, "needed").textContent = need > 100
      ? `Even 100% on the final gives ${fmt((others.reduce((s, [c, a]) => s + c.w * a, 0) + CATS[fc].w * 100) / W, 1)}%: a ${tgt} is out of reach.`
      : need <= 0 ? `A ${tgt} is secured whatever the final score.`
      : `To reach ${tgt}, the final needs at least ${fmt(Math.ceil(need * 10) / 10, 1)}%.`;
    part(root, "breakdown").replaceChildren(...used.map(([c, a]) => {
      const s = mk("span", `h-full ${c.cls}`);
      s.style.width = `${(c.w * a) / W}%`;
      s.title = `${c.name}: ${fmt((c.w * a) / W, 1)} points`;
      return s;
    }));
    part(root, "breakdown").setAttribute("role", "img");
    part(root, "breakdown").setAttribute("aria-label", `Points by category: ${used.map(([c, a]) => `${c.name} ${fmt((c.w * a) / W, 1)}`).join(", ")}`);
    status(root, `${drop ? "drop lowest on" : "drop lowest off"} · ${late ? "late penalty on" : "late penalty off"}`);
  }

  part(root, "table").addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const [k, ci, ii] = f.split(":");
    const it = CATS[ci].items[ii];
    if (k === "s") it[1] = e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value)));
    if (k === "d") it[2] = Math.max(0, Number(e.target.value) || 0);
    compute();
  });
  finalIn.addEventListener("input", compute);
  target.addEventListener("change", compute);
  target.value = "80";
  build();
  compute();
}
