// Language learning drills: conjugation, gender, cloze, accents, minimal
// pairs, numbers and times. Grading is instant: these are keyboard-paced
// exercises, so nothing animates.

import { readJSON, outs, verdict, mark, pick, say, onVoices, frNumber, frFem, strip, clean } from "./languages-store.js";

const feedbackText = {
  right: "Correct.",
  close: "Almost: check the accents.",
  wrong: "Not quite.",
  empty: "Type an answer first.",
};

function setFeedback(node, state, extra = "") {
  node.textContent = `${feedbackText[state] ?? ""}${extra ? " " + extra : ""}`;
  node.className = "min-h-5 text-sm " + (state === "right" ? "text-add" : state === "close" ? "text-vec-out" : state === "wrong" ? "text-del" : "text-muted-foreground");
}

function score(o, ok, total) {
  if (o.score) o.score.textContent = `${ok} / ${total}`;
}

// ------------------------------------------------------------ conjugation

// Accepted answers for a full form: with or without its pronoun, with any
// agreement the (e)(s) notation allows, and the chosen pronoun of il/elle/on.
function conjVariants(full, pronoun) {
  let forms = [full];
  const expand = (pat, opts) => forms.flatMap((f) => (f.includes(pat) ? opts.map((o) => f.replace(pat, o)) : [f]));
  forms = expand("(e)(s)", ["", "e", "s", "es"]);
  forms = expand("(e)s", ["s", "es"]);
  forms = expand("(e)", ["", "e"]);
  forms = forms.map((f) => f.replace(/il\/elle\/on|ils\/elles/, pronoun));
  const bare = forms.map((f) => f.replace(/^(que |qu')?(j'|je |tu |il |elle |on |nous |vous |ils |elles )/, ""));
  const noQue = forms.map((f) => f.replace(/^que |^qu'/, ""));
  return [...new Set([...forms, ...bare, ...noQue])];
}

for (const root of document.querySelectorAll("[data-lang-conj]")) {
  const data = readJSON(root, "verbs");
  if (!data) continue;
  const o = outs(root);
  const verbSel = root.querySelector('[data-select="verb"]');
  const tenseSel = root.querySelector('[data-select="tense"]');
  const tbody = root.querySelector("[data-conj-table]");
  const note = root.querySelector("[data-conj-note]");
  const prompt = root.querySelector("[data-conj-prompt]");
  const form = root.querySelector("[data-conj-form]");
  const input = form.querySelector("input");
  const fb = root.querySelector("[data-feedback]");
  let ok = 0, total = 0, item = null;

  const verb = () => data.verbs.find((v) => v.Inf === verbSel.value);

  function table() {
    const v = verb();
    note.textContent = `Auxiliary: ${v.Aux}.${v.Note ? " " + v.Note : ""}`;
    tbody.replaceChildren(...v.Tenses[tenseSel.value].map((f) => {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.className = "py-1.5";
      td.textContent = f;
      tr.append(td);
      return tr;
    }));
  }

  function next() {
    const v = verb();
    const i = Math.floor(Math.random() * 6);
    let pronoun = data.persons[i];
    if (i === 2) pronoun = pick(["il", "elle", "on"]);
    if (i === 5) pronoun = pick(["ils", "elles"]);
    const full = v.Tenses[tenseSel.value][i];
    item = { full, pronoun, answers: conjVariants(full, pronoun) };
    prompt.textContent = `${pronoun} · ${v.Inf} · ${tenseSel.value}`;
    input.value = "";
    mark(input, "empty");
    fb.textContent = "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!item) return;
    const st = verdict(input.value, item.answers);
    mark(input, st);
    if (st === "empty") return setFeedback(fb, st);
    total++;
    if (st === "right") ok++;
    score(o, ok, total);
    setFeedback(fb, st, st === "right" ? "" : `Answer: ${item.answers[0].replace(/il\/elle\/on|ils\/elles/, item.pronoun)}`);
  });
  root.querySelector("[data-action=next]").addEventListener("click", () => { next(); input.focus(); });
  for (const s of [verbSel, tenseSel]) s.addEventListener("change", () => { table(); next(); });
  table();
  next();
}

// ------------------------------------------------------------ gender

const ARTICLES = { fr: { m: "le", f: "la" }, de: { m: "der", f: "die", n: "das" } };

for (const root of document.querySelectorAll("[data-lang-gender]")) {
  const nouns = readJSON(root, "nouns") ?? [];
  const o = outs(root);
  const noun = root.querySelector("[data-noun]");
  const gloss = root.querySelector("[data-gloss]");
  const choices = root.querySelector("[data-choices]");
  const fb = root.querySelector("[data-feedback]");
  let lang = "fr", ok = 0, total = 0, item = null, queue = [];

  const elide = (w) => /^[aeiouyhàâéèêîôû]/i.test(w);
  function next() {
    if (!queue.length) queue = nouns.filter((n) => n.Lang === lang).sort(() => Math.random() - 0.5);
    item = queue.pop();
    noun.textContent = item.Word;
    noun.lang = lang;
    gloss.textContent = item.Gloss;
    fb.textContent = "";
    choices.replaceChildren(...Object.entries(ARTICLES[lang]).map(([g, art]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = art;
      b.lang = lang;
      b.dataset.g = g;
      b.className = "h-11 rounded-md border bg-background text-lg shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add data-[state=right]:text-add data-[state=wrong]:border-del data-[state=wrong]:text-del";
      b.addEventListener("click", () => answer(b));
      return b;
    }));
    if (lang === "fr") choices.className = "grid grid-cols-2 gap-2";
    else choices.className = "grid grid-cols-3 gap-2";
  }
  function answer(b) {
    if (!item || item.done) return;
    item.done = true;
    const right = b.dataset.g === item.Gender;
    total++;
    if (right) ok++;
    score(o, ok, total);
    b.dataset.state = right ? "right" : "wrong";
    const art = ARTICLES[lang][item.Gender];
    const written = lang === "fr" && elide(item.Word) ? `l'${item.Word} (${item.Gender === "m" ? "masculine" : "feminine"})` : `${art} ${item.Word}`;
    setFeedback(fb, right ? "right" : "wrong", `${written}. ${item.Rule}.`);
    setTimeout(next, right ? 700 : 1600);
  }
  root.addEventListener("seg-change", (e) => {
    if (!["fr", "de"].includes(e.detail.value)) return;
    lang = e.detail.value;
    queue = [];
    next();
  });
  root.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    const btns = [...choices.children];
    if (n >= 1 && n <= btns.length && !e.target.closest("input, textarea")) answer(btns[n - 1]);
  });
  next();
}

// ------------------------------------------------------------ cloze

for (const root of document.querySelectorAll("[data-lang-cloze]")) {
  const toks = readJSON(root, "fable") ?? [];
  const o = outs(root);
  const passage = root.querySelector("[data-passage]");
  let pos = "N";
  let gaps = [];

  const noSpaceBefore = (w) => /^[,.]$/.test(w) || w.startsWith(" ");
  function render() {
    passage.replaceChildren();
    gaps = [];
    let prev = null;
    for (const t of toks) {
      if (t.w === "\n") { passage.append(document.createElement("br")); prev = null; continue; }
      if (prev && !prev.endsWith("'") && !noSpaceBefore(t.w)) passage.append(" ");
      if (t.pos === pos) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.setAttribute("autocapitalize", "off");
        inp.setAttribute("autocomplete", "off");
        inp.spellcheck = false;
        inp.lang = "fr";
        inp.setAttribute("aria-label", `Missing word, ${t.w.length} letters`);
        inp.style.width = `${Math.max(4, t.w.length + 1)}ch`;
        inp.className = "mx-0.5 inline-block h-8 rounded-md border border-dashed border-input bg-background px-1.5 text-center text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-solid data-[state=right]:border-add data-[state=wrong]:border-del data-[state=close]:border-vec-out";
        inp.dataset.answer = t.w;
        passage.append(inp);
        gaps.push(inp);
      } else passage.append(t.w);
      prev = t.w;
    }
    o.score.textContent = `${gaps.length} gaps`;
  }
  const check = () => {
    let right = 0;
    for (const g of gaps) {
      const st = verdict(g.value, [g.dataset.answer]);
      mark(g, st === "empty" ? "wrong" : st);
      if (st === "right") right++;
    }
    o.score.textContent = `${right} / ${gaps.length}`;
  };
  root.querySelector("[data-action=check]").addEventListener("click", check);
  root.querySelector("[data-action=hint]").addEventListener("click", () => {
    for (const g of gaps) if (verdict(g.value, [g.dataset.answer]) !== "right") g.placeholder = g.dataset.answer[0] + "…";
  });
  root.querySelector("[data-action=reveal]").addEventListener("click", () => {
    for (const g of gaps) { g.value = g.dataset.answer; mark(g, "right"); }
    o.score.textContent = "revealed";
  });
  root.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input")) { e.preventDefault(); check(); } });
  root.addEventListener("seg-change", (e) => { pos = e.detail.value; render(); });
  render();
}

// ------------------------------------------------------------ accents

const NBSP = " ", NNBSP = " ";
const visible = (s) => s.replaceAll(NBSP, "⍽").replaceAll(NNBSP, "·");

for (const root of document.querySelectorAll("[data-lang-accent]")) {
  const drills = readJSON(root, "drills") ?? [];
  const pad = root.querySelector("[data-pad]");
  const target = root.querySelector("[data-target]");
  const answer = root.querySelector('[data-answer="drill"]');
  const fb = root.querySelector("[data-feedback]");
  let typo = true, last = pad, at = -1;

  for (const f of [pad, answer]) f.addEventListener("focus", () => (last = f));
  const insert = (field, s) => {
    const a = field.selectionStart ?? field.value.length, b = field.selectionEnd ?? a;
    field.setRangeText(s, a, b, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  root.querySelectorAll("[data-key]").forEach((k) =>
    k.addEventListener("click", () => { insert(last, k.dataset.key); last.focus(); }));

  // French spacing as you type: before ; ! ? a narrow no-break space, before
  // : a no-break space, and no-break spaces inside « ».
  const fix = (e) => {
    if (!typo || e.inputType !== "insertText" || !e.data) return;
    const f = e.target, i = f.selectionStart, v = f.value;
    const ch = e.data, before = v.slice(0, i - 1);
    const space = ch === ":" ? NBSP : NNBSP;
    if (";!?:".includes(ch) && before && !before.endsWith(space)) {
      const trimmed = before.replace(/[   ]$/, "");
      f.value = trimmed + space + ch + v.slice(i);
      f.setSelectionRange(trimmed.length + 2, trimmed.length + 2);
    } else if (ch === "«") {
      f.setRangeText(NBSP, i, i, "end");
    } else if (ch === "»" && before && !before.endsWith(NBSP)) {
      const trimmed = before.replace(/[  ]$/, "");
      f.value = trimmed + NBSP + "»" + v.slice(i);
      f.setSelectionRange(trimmed.length + 2, trimmed.length + 2);
    }
  };
  pad.addEventListener("input", fix);
  answer.addEventListener("input", fix);
  root.querySelector('[data-toggle="typo"]')?.addEventListener("shadcn:checked-change", (e) => (typo = e.detail.checked));

  const next = () => {
    at = (at + 1) % drills.length;
    target.textContent = visible(drills[at]);
    answer.value = "";
    mark(answer, "empty");
    fb.textContent = "";
  };
  answer.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const want = drills[at], got = answer.value.normalize("NFC").replace(/[’]/g, "'");
    if (got === want) { mark(answer, "right"); return setFeedback(fb, "right", "Letters and spaces match."); }
    const spaces = (s) => s.replace(/[   ]/g, " ");
    if (spaces(got) === spaces(want)) {
      mark(answer, "close");
      fb.className = "min-h-5 text-sm text-vec-out";
      fb.textContent = `The letters are right; the spaces differ. Yours: ${visible(got)}`;
      return;
    }
    const st = strip(got) === strip(want) ? "close" : "wrong";
    mark(answer, st);
    setFeedback(fb, st);
  });
  root.querySelector("[data-action=next]").addEventListener("click", next);
  next();
}

// ------------------------------------------------------------ minimal pairs

for (const root of document.querySelectorAll("[data-lang-pairs]")) {
  const pairs = readJSON(root, "pairs") ?? [];
  const o = outs(root);
  const status = root.querySelector("[data-voice]");
  const question = root.querySelector("[data-question]");
  const ipa = root.querySelector("[data-quiz-ipa]");
  const choices = root.querySelector("[data-choices]");
  const fb = root.querySelector("[data-feedback]");
  const replay = root.querySelector("[data-action=replay]");
  let hasVoice = false, item = null, ok = 0, total = 0;

  onVoices((v) => {
    hasVoice = !!v;
    status.textContent = v ? `Speaking with ${v.name} (${v.lang}).` : "No French voice in this browser: the quiz asks you to read the IPA instead. Your system's language settings can add one.";
  });
  root.querySelectorAll("[data-say]").forEach((b) =>
    b.addEventListener("click", () => { if (!say(b.dataset.say)) status.textContent = "No French voice available in this browser."; }));

  function start() {
    const p = pick(pairs);
    const first = Math.random() < 0.5;
    item = { p, word: first ? p.A : p.B, ipa: first ? p.AIPA : p.BIPA, done: false };
    fb.textContent = "";
    if (hasVoice) {
      question.textContent = "Which word did you hear?";
      ipa.textContent = "";
      say(item.word);
    } else {
      question.textContent = "Which word is pronounced like this?";
      ipa.textContent = item.ipa;
    }
    replay.disabled = !hasVoice;
    choices.replaceChildren(...[p.A, p.B].map((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.lang = "fr";
      b.textContent = w;
      b.className = "h-11 rounded-md border bg-background text-lg shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add data-[state=right]:text-add data-[state=wrong]:border-del data-[state=wrong]:text-del";
      b.addEventListener("click", () => {
        if (item.done) return;
        item.done = true;
        total++;
        const right = w === item.word;
        if (right) ok++;
        b.dataset.state = right ? "right" : "wrong";
        score(o, ok, total);
        setFeedback(fb, right ? "right" : "wrong", `${p.A} ${p.AIPA}, ${p.B} ${p.BIPA}: ${p.Contrast}.`);
      });
      return b;
    }));
  }
  root.querySelector("[data-action=start]").addEventListener("click", start);
  replay.addEventListener("click", () => item && say(item.word));
}

// ------------------------------------------------------------ numbers

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);

function formalTime(h, m, reform) {
  const hours = (h === 0 ? "zéro" : frFem(h, reform)) + (h <= 1 ? " heure" : " heures");
  return m ? `${hours} ${frFem(m, reform)}` : hours;
}

function informalTimes(h, m, reform) {
  const hh = m > 30 ? (h + 1) % 24 : h;
  const name = hh === 0 ? "minuit" : hh === 12 ? "midi" : (hh % 12 === 1 ? "une heure" : `${frNumber(hh % 12, reform)} heures`);
  let s;
  if (m === 0) s = name;
  else if (m === 15) s = `${name} et quart`;
  else if (m === 30) s = `${name} ${hh === 0 || hh === 12 ? "et demi" : "et demie"}`;
  else if (m < 30) s = `${name} ${frFem(m, reform)}`;
  else if (m === 45) s = `${name} moins le quart`;
  else s = `${name} moins ${frFem(60 - m, reform)}`;
  const period = hh === 0 || hh === 12 ? "" : hh < 12 ? " du matin" : hh < 18 ? " de l'après-midi" : " du soir";
  return period ? [s, s + period] : [s];
}

for (const root of document.querySelectorAll("[data-lang-num]")) {
  const o = outs(root);
  const ask = root.querySelector("[data-ask]");
  const prompt = root.querySelector("[data-prompt]");
  const form = root.querySelector("[data-num-form]");
  const input = form.querySelector("input");
  const fb = root.querySelector("[data-feedback]");
  const range = root.querySelector('[data-select="range"]');
  let mode = "write", item = null, ok = 0, total = 0;

  function next() {
    const max = Number(range.value);
    if (mode === "write" || mode === "read") {
      const n = Math.random() < 0.3 ? pick([70, 71, 77, 80, 81, 88, 90, 91, 99].filter((x) => x <= max)) : Math.floor(Math.random() * (max + 1));
      const words = [frNumber(n), frNumber(n, true)];
      item = mode === "write"
        ? { ask: "Write this number in words.", prompt: group(n), answers: words, say: words[0], show: words[0] }
        : { ask: "Write this number in digits.", prompt: words[0], answers: [String(n), group(n), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")], say: words[0], show: String(n) };
      input.inputMode = mode === "read" ? "numeric" : "text";
    } else if (mode === "time") {
      const h = Math.floor(Math.random() * 24), m = 5 * Math.floor(Math.random() * 12);
      const answers = [formalTime(h, m), formalTime(h, m, true), ...informalTimes(h, m), ...informalTimes(h, m, true)];
      if (m === 0 && h === 12) answers.push("midi");
      if (m === 0 && h === 0) answers.push("minuit");
      item = { ask: "Say this time in words (24-hour or spoken).", prompt: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, answers, say: answers[0], show: `${answers[0]} / ${answers[2]}` };
      input.inputMode = "text";
    } else {
      const d = 1 + Math.floor(Math.random() * 28), mo = Math.floor(Math.random() * 12);
      const day = d === 1 ? "premier" : frNumber(d);
      const dayR = d === 1 ? "premier" : frNumber(d, true);
      const answers = [`le ${day} ${MONTHS[mo]}`, `${day} ${MONTHS[mo]}`, `le ${dayR} ${MONTHS[mo]}`, `${dayR} ${MONTHS[mo]}`];
      item = { ask: "Say this date in words.", prompt: `${String(d).padStart(2, "0")}/${String(mo + 1).padStart(2, "0")}`, answers, say: answers[0], show: answers[0] };
      input.inputMode = "text";
    }
    ask.textContent = item.ask;
    prompt.textContent = item.prompt;
    input.value = "";
    mark(input, "empty");
    fb.textContent = "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!item) return;
    const st = verdict(input.value, item.answers);
    mark(input, st);
    if (st === "empty") return setFeedback(fb, st);
    total++;
    if (st === "right") ok++;
    score(o, ok, total);
    setFeedback(fb, st, st === "right" && mode === "write" ? `1990 spelling: ${item.answers[1]}` : st === "right" ? "" : `Answer: ${item.show}`);
  });
  root.querySelector("[data-action=next]").addEventListener("click", () => { next(); input.focus(); });
  root.querySelector("[data-action=listen]").addEventListener("click", () => {
    if (item && !say(item.say)) fb.textContent = "No French voice available in this browser.";
  });
  root.addEventListener("seg-change", (e) => { if (["write", "read", "time", "date"].includes(e.detail.value)) { mode = e.detail.value; next(); } });
  range.addEventListener("change", next);
  next();
}

// Exposed for checks from the console: the same speller the drills use.
export { frNumber, clean };
