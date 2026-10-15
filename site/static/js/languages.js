// Language learning: the spaced-repetition deck, frequency coverage,
// interlinear glossing and the CEFR planner. The drills are in
// languages-drills.js; shared pieces in languages-store.js.

import { readJSON, outs, loadState, saveState, newCard, review, today, clean } from "./languages-store.js";
import { scrubAll } from "./scrub.js";
import { el, text } from "./plot.js";

const NEW_PER_DAY = 10;
const GRADES = { 1: "1", 2: "3", 3: "4", 4: "5" }; // keys 1–4 → SM-2 q

function starterState(root) {
  const deck = readJSON(root, "deck") ?? [];
  return { cards: deck.map(([f, b]) => newCard(f, b)), newDay: today(), newSeen: 0 };
}

const days = (n) => (n === 1 ? "1 day" : `${n} days`);

// ------------------------------------------------------------ deck

for (const root of document.querySelectorAll("[data-lang-srs]")) {
  const o = outs(root);
  const front = root.querySelector("[data-front]");
  const back = root.querySelector("[data-back]");
  const done = root.querySelector("[data-done]");
  const show = root.querySelector("[data-action=show]");
  const grades = [...root.querySelectorAll("[data-grade]")];
  const forecast = root.querySelector("[data-forecast]");
  const tsv = root.querySelector("[data-tsv]");
  const msg = root.querySelector("[data-deck-msg]");
  let state = loadState() ?? starterState(root);
  let current = -1;
  let revealed = false;

  const due = () => {
    const d = today();
    if (state.newDay !== d) { state.newDay = d; state.newSeen = 0; }
    const old = state.cards.map((c, i) => [c, i]).filter(([c]) => c.due !== null && c.due <= d).sort((a, b) => a[0].due - b[0].due);
    const fresh = state.cards.map((c, i) => [c, i]).filter(([c]) => c.due === null).slice(0, Math.max(0, NEW_PER_DAY - state.newSeen));
    return { old, fresh };
  };

  function draw() {
    const { old, fresh } = due();
    o.new.textContent = String(fresh.length);
    o.due.textContent = String(old.length);
    o.learned.textContent = String(state.cards.filter((c) => c.reps > 0).length);
    const next = old[0] ?? fresh[0];
    current = next ? next[1] : -1;
    revealed = false;
    back.hidden = true;
    show.disabled = current < 0;
    grades.forEach((g) => (g.disabled = true));
    done.hidden = current >= 0;
    front.hidden = current < 0;
    if (current >= 0) {
      const c = state.cards[current];
      front.textContent = c.front;
      back.textContent = c.back;
      o.ef.textContent = c.ef.toFixed(2);
      for (const g of grades) {
        const r = review(c, Number(g.dataset.grade));
        g.querySelector("[data-preview]").textContent = days(r.interval);
      }
    } else {
      o.ef.textContent = "—";
    }
    drawForecast();
  }

  function drawForecast() {
    forecast.replaceChildren();
    const d = today();
    const counts = Array.from({ length: 14 }, (_, i) => state.cards.filter((c) => c.due !== null && Math.max(c.due, d) === d + i).length);
    const max = Math.max(4, ...counts);
    const W = 320, H = 120, L = 8, B = 100, bw = (W - 2 * L) / 14;
    counts.forEach((n, i) => {
      const hgt = (n / max) * 84;
      el("rect", { x: L + i * bw + 2, y: B - hgt, width: bw - 4, height: Math.max(n ? 2 : 0.5, hgt), rx: 2, style: `fill:${i === 0 ? "var(--brand)" : "var(--foreground)"};fill-opacity:${n ? (i === 0 ? 0.85 : 0.35) : 0.12}` }, forecast);
      if (n) text(forecast, L + i * bw + bw / 2, B - hgt - 4, String(n), { "text-anchor": "middle" });
    });
    text(forecast, L, 114, "today");
    text(forecast, W - L, 114, "+13 d", { "text-anchor": "end" });
  }

  const reveal = () => {
    if (current < 0 || revealed) return;
    revealed = true;
    back.hidden = false;
    grades.forEach((g) => (g.disabled = false));
  };
  const grade = (q) => {
    if (current < 0 || !revealed) return;
    const wasNew = state.cards[current].due === null;
    state.cards[current] = review(state.cards[current], q);
    if (wasNew) state.newSeen += 1;
    saveState(state);
    draw();
  };

  show.addEventListener("click", reveal);
  grades.forEach((g) => g.addEventListener("click", () => grade(Number(g.dataset.grade))));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("textarea, input")) return;
    if (e.key === " ") { e.preventDefault(); reveal(); }
    else if (GRADES[e.key]) { e.preventDefault(); grade(Number(GRADES[e.key])); }
  });

  root.querySelector("[data-action=export]").addEventListener("click", () => {
    const d = today();
    tsv.value = state.cards.map((c) => [c.front, c.back, c.interval, c.ef.toFixed(2), c.reps, c.due === null ? "" : c.due - d].join("\t")).join("\n");
    msg.textContent = `${state.cards.length} cards: front, back, interval, ease, repetitions, due in (days).`;
  });
  root.querySelector("[data-action=import]").addEventListener("click", () => {
    const have = new Set(state.cards.map((c) => clean(c.front)));
    let added = 0, skipped = 0;
    for (const line of tsv.value.split(/\r?\n/)) {
      const [f, b] = line.split("\t");
      if (!f?.trim() || !b?.trim()) { if (line.trim()) skipped++; continue; }
      if (have.has(clean(f))) { skipped++; continue; }
      state.cards.push(newCard(f.trim(), b.trim()));
      have.add(clean(f));
      added++;
    }
    saveState(state);
    msg.textContent = `Imported ${added} new card${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} (duplicates or lines without a tab)` : ""}.`;
    draw();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => {
    state = starterState(root);
    saveState(state);
    msg.textContent = "Deck reset to the 40 starter cards.";
    draw();
  });
  window.addEventListener("lang-deck-change", () => {
    const s = loadState();
    if (s && s !== state && s.cards.length !== state.cards.length) { state = s; draw(); }
  });

  draw();
}

// ------------------------------------------------------------ coverage

// Word forms: letters, inner hyphens (week-end), elided articles split off
// (l'eau → l' + eau), with aujourd'hui kept whole.
const WORD = /aujourd'hui|\p{L}+(?:-\p{L}+)*'?/giu;
const words = (s) => (s.normalize("NFC").replace(/[’]/g, "'").toLowerCase().match(WORD) ?? []);

// The learner's deck, or the starter deck when nothing is saved yet.
function knownWords() {
  let fronts = loadState()?.cards?.map((c) => c.front);
  if (!fronts) {
    const t = document.querySelector('template[data-lang-json="deck"]');
    try { fronts = JSON.parse(t?.dataset.json ?? "[]").map((c) => c[0]); } catch { fronts = []; }
  }
  const set = new Set();
  for (const f of fronts) for (const w of words(f.replace(/\(.*?\)/g, ""))) set.add(w);
  return set;
}

for (const root of document.querySelectorAll("[data-lang-coverage]")) {
  const o = outs(root);
  const input = root.querySelector("[data-text]");
  const marked = root.querySelector("[data-marked]");
  const curve = root.querySelector("[data-curve]");
  const top = root.querySelector("[data-top]");
  let timer = 0;

  function run() {
    const raw = input.value;
    const toks = words(raw);
    const freq = new Map();
    for (const t of toks) freq.set(t, (freq.get(t) ?? 0) + 1);
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
    const cum = [];
    let acc = 0;
    for (const [, n] of ranked) { acc += n; cum.push(acc / Math.max(1, toks.length)); }
    const need = (p) => (toks.length ? cum.findIndex((c) => c >= p) + 1 : 0);
    o.tokens.textContent = String(toks.length);
    o.forms.textContent = String(ranked.length);
    o.c80.textContent = String(need(0.8));
    o.c90.textContent = String(need(0.9));
    o.c95.textContent = String(need(0.95));

    curve.replaceChildren();
    const W = 360, H = 180, L = 30, R = 10, T = 12, B = 30;
    const sx = (i) => L + (i / Math.max(1, ranked.length)) * (W - L - R);
    const sy = (p) => T + (1 - p) * (H - T - B);
    for (const p of [0.5, 0.8, 0.9, 1]) {
      el("line", { x1: L, x2: W - R, y1: sy(p), y2: sy(p), style: "stroke:currentColor;stroke-opacity:0.08" }, curve);
      text(curve, L - 4, sy(p) + 3, `${p * 100}%`, { "text-anchor": "end" });
    }
    if (cum.length) {
      el("polyline", { points: [[sx(0), sy(0)], ...cum.map((c, i) => [sx(i + 1), sy(c)])].map((p) => p.join(",")).join(" "), style: "fill:none;stroke:var(--brand);stroke-width:2" }, curve);
      for (const p of [0.8, 0.9]) {
        const i = need(p);
        el("circle", { cx: sx(i), cy: sy(cum[i - 1]), r: 3.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, curve);
      }
    }
    text(curve, W - R, H - 8, `word forms by rank (1 to ${ranked.length})`, { "text-anchor": "end" });

    top.replaceChildren(...ranked.slice(0, 18).map(([w, n]) => {
      const li = document.createElement("li");
      li.className = "flex justify-between gap-2";
      const a = document.createElement("span");
      a.textContent = w;
      const b = document.createElement("span");
      b.className = "text-muted-foreground tabular-nums";
      b.textContent = String(n);
      li.append(a, b);
      return li;
    }));

    // The text again, with words outside the deck marked.
    const known = knownWords();
    marked.replaceChildren();
    const norm = raw.normalize("NFC").replace(/[’]/g, "'");
    let last = 0, unknown = 0;
    for (const m of norm.matchAll(WORD)) {
      marked.append(document.createTextNode(norm.slice(last, m.index)));
      const w = m[0];
      if (known.has(w.toLowerCase())) marked.append(document.createTextNode(w));
      else {
        const s = document.createElement("mark");
        s.className = "rounded-sm bg-vec-out/25 px-0.5 text-foreground";
        s.textContent = w;
        marked.append(s);
        unknown++;
      }
      last = m.index + w.length;
    }
    marked.append(document.createTextNode(norm.slice(last)));
    marked.dataset.unknown = String(unknown);
  }

  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 200); });
  window.addEventListener("lang-deck-change", run);
  run();
}

// ------------------------------------------------------------ gloss

const DEFAULT_GLOSS = { je: "1SG", ne: "NEG", mange: "eat.PRS.1SG", pas: "NEG", de: "of", pommes: "apple.F.PL" };

for (const root of document.querySelectorAll("[data-lang-gloss]")) {
  const sentence = root.querySelector("[data-sentence]");
  const translation = root.querySelector("[data-translation]");
  const columns = root.querySelector("[data-columns]");
  const preview = root.querySelector("[data-preview]");
  const copy = root.querySelector("[data-copy]");
  const msg = root.querySelector("[data-msg]");
  let glosses = { ...DEFAULT_GLOSS };

  const tokens = () => sentence.value.normalize("NFC").replace(/[’]/g, "'").match(/aujourd'hui|\p{L}+(?:-\p{L}+)*'?|\d+/gu) ?? [];

  function lines() {
    const toks = tokens();
    const gl = toks.map((t) => glosses[t.toLowerCase()] ?? "");
    const widths = toks.map((t, i) => Math.max(t.length, gl[i].length));
    const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.length));
    return [toks.map((t, i) => pad(t, widths[i])).join("  "), gl.map((g, i) => pad(g, widths[i])).join("  "), `‘${translation.value.trim()}’`];
  }

  function drawPreview() {
    const toks = tokens();
    const grid = document.createElement("div");
    grid.className = "inline-grid gap-x-4";
    grid.style.gridTemplateColumns = `repeat(${Math.max(1, toks.length)}, auto)`;
    for (const t of toks) {
      const d = document.createElement("span");
      d.lang = "fr";
      d.className = "italic";
      d.textContent = t;
      grid.append(d);
    }
    for (const t of toks) {
      const d = document.createElement("span");
      d.className = "text-muted-foreground";
      d.textContent = glosses[t.toLowerCase()] || "—";
      grid.append(d);
    }
    const tr = document.createElement("div");
    tr.className = "mt-1";
    tr.textContent = `‘${translation.value.trim()}’`;
    preview.replaceChildren(grid, tr);
    copy.dataset.copy = lines().join("\n");
  }

  function build() {
    columns.replaceChildren(...tokens().map((t) => {
      const col = document.createElement("label");
      col.className = "flex shrink-0 flex-col gap-1";
      const w = document.createElement("span");
      w.lang = "fr";
      w.className = "px-1 text-sm font-medium";
      w.textContent = t;
      const g = document.createElement("input");
      g.type = "text";
      g.value = glosses[t.toLowerCase()] ?? "";
      g.placeholder = "gloss";
      g.setAttribute("aria-label", `Gloss for ${t}`);
      g.setAttribute("autocapitalize", "off");
      g.spellcheck = false;
      g.className = "h-8 w-28 rounded-md border border-input bg-background px-2 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-xs";
      g.addEventListener("input", () => { glosses[t.toLowerCase()] = g.value.trim(); drawPreview(); });
      col.append(w, g);
      return col;
    }));
    drawPreview();
  }

  sentence.addEventListener("input", build);
  translation.addEventListener("input", drawPreview);
  root.querySelector("[data-action=save]").addEventListener("click", () => {
    const s = sentence.value.trim(), t = translation.value.trim();
    if (!s || !t) { msg.textContent = "Write a sentence and its translation first."; return; }
    const state = loadState() ?? { cards: [], newDay: today(), newSeen: 0 };
    if (state.cards.some((c) => clean(c.front) === clean(s))) { msg.textContent = "Already in your deck."; return; }
    state.cards.push(newCard(s, `${t}  ·  ${lines()[1].replace(/\s+/g, " ").trim()}`));
    saveState(state);
    msg.textContent = `Added. Your deck has ${state.cards.length} cards.`;
  });
  build();
}

// ------------------------------------------------------------ CEFR

const CEFR_KEY = "lang-cefr-v1";

for (const root of document.querySelectorAll("[data-lang-cefr]")) {
  const o = outs(root);
  const levels = readJSON(root, "levels") ?? [];
  const sets = [...root.querySelectorAll("[data-level]")];
  const target = root.querySelector('[data-select="target"]');
  const mid = (code) => { const l = levels.find((x) => x.Code === code); return l ? (l.Hours[0] + l.Hours[1]) / 2 : 0; };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CEFR_KEY) ?? "{}"); } catch {}
  for (const box of root.querySelectorAll("input[type=checkbox]")) box.checked = !!saved[box.id];

  const s = scrubAll(root, draw);
  target.value = "B2";

  function draw() {
    // The level is the highest one whose boxes are all ticked, counting
    // up from A1 without gaps.
    let level = null;
    for (const fs of sets) {
      const boxes = [...fs.querySelectorAll("input")];
      if (boxes.every((b) => b.checked)) level = fs.dataset.level; else break;
    }
    o.level.textContent = level ?? "pre-A1";
    const order = levels.map((l) => l.Code);
    const tgt = target.value;
    const left = order.indexOf(tgt) <= order.indexOf(level ?? "") ? 0 : Math.max(0, mid(tgt) - (level ? mid(level) : 0));
    const perWeek = s.hours.get();
    o.left.textContent = left ? `≈ ${Math.round(left)} h` : "reached";
    o.weeks.textContent = left ? `≈ ${Math.ceil(left / perWeek)}` : "—";
    o.months.textContent = left ? `≈ ${(left / perWeek / 4.35).toFixed(1)}` : "—";
    const store = {};
    for (const box of root.querySelectorAll("input[type=checkbox]")) if (box.checked) store[box.id] = true;
    try { localStorage.setItem(CEFR_KEY, JSON.stringify(store)); } catch {}
  }
  root.addEventListener("change", draw);
  draw();
}
