// Platform components: the product UI around the lessons. Each section
// finds its own block by a data-plat-* root and does nothing elsewhere.
// Demo data is generated here or embedded by Go; nothing leaves the page.

import { toast } from "../../_shadcn/sonner.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const make = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
};
// A <style> carrying the page's nonce, for rules CSSOM can't scope.
const nonceStyle = (css) => {
  const s = document.createElement("style");
  s.nonce = document.querySelector("script[nonce]")?.nonce ?? "";
  s.textContent = css;
  document.head.append(s);
  return s;
};
const enter = (el) => {
  if (reduced()) return;
  el.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
};
const setIcons = (btn, playing, labels = ["Play", "Pause"]) => {
  btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
  btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !playing);
  const l = btn.querySelector("[data-label]");
  if (l) l.textContent = playing ? labels[1] : labels[0];
};
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ Command palette

// fuzzy scores text against a query: every query letter must appear in
// order. Word starts and runs score higher; gaps cost. Returns the
// matched indices for highlighting, or null.
function fuzzy(q, text) {
  const t = text.toLowerCase();
  let ti = 0, score = 0, run = 0;
  const idx = [];
  for (const ch of q) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return null;
    const start = at === 0 || /[\s\-–·,(/]/.test(t[at - 1]);
    run = at === ti && idx.length ? run + 1 : 0;
    score += 10 + (start ? 15 : 0) + run * 8 - Math.min(10, at - ti);
    idx.push(at);
    ti = at + 1;
  }
  return { score: score - t.length * 0.1, idx };
}

for (const root of document.querySelectorAll("[data-plat-palette]")) {
  const index = JSON.parse(root.dataset.index);
  const base = root.querySelector("[data-plat-base]").getAttribute("href");
  const dialog = root.querySelector("[data-dialog]");
  const input = root.querySelector("[data-query]");
  const results = root.querySelector("[data-results]");
  const count = root.querySelector("[data-count]");
  const recentBox = root.querySelector("[data-recent]");
  const recentLabel = root.querySelector("[data-recent-label]");
  const url = (e) => base + e.p + (e.b ? "#" + e.b : "");
  let items = [], active = 0;

  const subjects = [...new Map(index.map((e) => [e.s, { s: e.s, p: e.p, b: "", t: e.s, d: "", g: [] }])).values()];

  function highlight(text, idx) {
    const span = make("span", "truncate");
    let last = 0;
    for (const i of idx ?? []) {
      if (i > last) span.append(text.slice(last, i));
      span.append(make("mark", "rounded-[2px] bg-transparent font-semibold text-brand", text[i]));
      last = i + 1;
    }
    span.append(text.slice(last));
    return span;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return subjects.map((e) => ({ e, score: 0, idx: null, subjectOnly: true }));
    const out = [];
    for (const e of index) {
      const t = fuzzy(q, e.t);
      let best = t ? { score: t.score * 2, idx: t.idx } : null;
      // A literal substring beats a scattered match: "gel" should find
      // "…gel electrophoresis" before "Geologic".
      const title = e.t.toLowerCase(), at = title.indexOf(q);
      if (at >= 0) {
        const start = at === 0 || /[\s\-–·,(/&]/.test(title[at - 1]);
        const sc = 80 + (start ? 60 : 0) + q.length * 12 - at * 0.5;
        if (!best || sc > best.score) best = { score: sc, idx: [...q].map((_, k) => at + k) };
      } else if (!t && ((e.g ?? []).join(" ").toLowerCase().includes(q) || e.d.toLowerCase().includes(q))) {
        best = { score: 40 + q.length * 4, idx: null };
      }
      for (const [field, w] of [[e.s, 0.8], [(e.g ?? []).join(" "), 0.9]]) {
        const m = fuzzy(q, field);
        if (m && (!best || m.score * w > best.score)) best = { score: m.score * w, idx: null };
      }
      if (!best && e.d.toLowerCase().includes(q)) best = { score: 5, idx: null };
      if (best) out.push({ e, ...best });
    }
    out.sort((a, b) => b.score - a.score);
    // Once something matches literally, scattered letters are noise.
    const literal = out.length && out[0].score >= 80;
    return out.filter((r) => !literal || r.score >= 40).slice(0, 40);
  }

  function render() {
    const found = search(input.value);
    results.replaceChildren();
    // Group by subject, ordered by each group's best result.
    const groups = new Map();
    for (const r of found) {
      const key = r.subjectOnly ? "Jump to a subject" : r.e.s;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    items = [];
    for (const [name, rs] of groups) {
      const g = make("div", "flex flex-col py-1");
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", name);
      g.append(make("div", "px-2 pt-1 pb-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase", name));
      for (const r of rs) {
        const a = make("a", "flex items-center gap-3 rounded-md px-2 py-2 text-sm outline-none data-[active]:bg-accent");
        a.href = url(r.e);
        a.id = `plat-opt-${items.length}`;
        a.setAttribute("role", "option");
        a.tabIndex = -1;
        const text = make("span", "flex min-w-0 flex-1 flex-col");
        text.append(highlight(r.e.t, r.idx));
        if (r.e.d) text.append(make("span", "truncate text-xs text-muted-foreground", r.e.d));
        a.append(text);
        if (r.e.g?.length) a.append(make("span", "hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline", r.e.g.slice(0, 2).join(" · ")));
        const i = items.length;
        a.addEventListener("pointermove", () => setActive(i, false));
        a.addEventListener("click", () => remember());
        items.push(a);
        g.append(a);
      }
      results.append(g);
    }
    if (!items.length) results.append(make("p", "px-3 py-8 text-center text-sm text-muted-foreground", "No block matches. Try fewer letters."));
    count.textContent = input.value.trim() ? `${found.length} result${found.length === 1 ? "" : "s"}` : `${index.length} blocks`;
    setActive(0, false);
  }

  function setActive(i, scroll = true) {
    if (!items.length) return input.removeAttribute("aria-activedescendant");
    active = (i + items.length) % items.length;
    items.forEach((a, k) => (k === active ? a.setAttribute("data-active", "") : a.removeAttribute("data-active")));
    input.setAttribute("aria-activedescendant", items[active].id);
    if (scroll) items[active].scrollIntoView({ block: "nearest" });
  }

  function remember() {
    const q = input.value.trim();
    if (!q) return;
    const recent = [q, ...store.get("plat-recent", []).filter((x) => x !== q)].slice(0, 5);
    store.set("plat-recent", recent);
    showRecent();
  }

  function showRecent() {
    const recent = store.get("plat-recent", []);
    recentBox.replaceChildren();
    recentLabel.hidden = !recent.length;
    for (const q of recent) {
      const b = make("button", "rounded-full border border-dashed px-2.5 py-1 font-mono text-[11px] outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50", q);
      b.type = "button";
      b.addEventListener("click", () => open(q));
      recentBox.append(b);
    }
  }

  function open(q = "") {
    input.value = q;
    render();
    if (!dialog.open) {
      dialog.showModal();
      enter(dialog);
    }
    input.focus();
    input.select();
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); remember(); items[active].click(); dialog.close(); }
  });
  // A click on the backdrop (outside the panel) closes.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  root.querySelector("[data-open]").addEventListener("click", () => open());
  root.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => open(b.dataset.try)));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      dialog.open ? dialog.close() : open();
    }
  });
  showRecent();
}

// ============================================================ Streak calendar

const LEVEL = ["color-mix(in oklab,var(--foreground) 8%,transparent)", "color-mix(in oklab,var(--brand) 30%,transparent)",
  "color-mix(in oklab,var(--brand) 52%,transparent)", "color-mix(in oklab,var(--brand) 75%,transparent)", "var(--brand)"];

for (const root of document.querySelectorAll("[data-plat-streak]")) {
  const svg = root.querySelector("[data-grid]");
  const tip = root.querySelector("[data-tip]");
  const out = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  const rng = mulberry32(2026);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  // 53 weeks ending this week; weeks start on Monday.
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dow - 52 * 7);
  const days = [];
  let prev = true;
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const active = rng() < (prev ? 0.86 : 0.45);
    const minutes = active ? Math.round(5 + rng() * 55) : 0;
    days.push({ date: new Date(d), minutes, freeze: false });
    prev = active;
  }
  // A freeze covers a lone missed day between two active ones (2 per month at most).
  let freezes = 0;
  for (let i = 1; i < days.length - 1; i++) {
    if (!days[i].minutes && days[i - 1].minutes && days[i + 1].minutes && rng() < 0.5 && freezes < 24) {
      days[i].freeze = true;
      freezes++;
    }
  }
  const kept = (d) => d.minutes > 0 || d.freeze;
  let current = 0;
  for (let i = days.length - 1; i >= 0 && kept(days[i]); i--) current++;
  let longest = 0, run = 0;
  for (const d of days) { run = kept(d) ? run + 1 : 0; longest = Math.max(longest, run); }
  out.current.textContent = `${current} day${current === 1 ? "" : "s"}`;
  out.longest.textContent = `${longest} days`;
  out.active.textContent = String(days.filter((d) => d.minutes).length);
  out.freezes.textContent = String(freezes);

  const L = 30, T = 18, S = 13;
  const fmtDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "short" });
  for (const [i, lbl] of [[0, "Mon"], [2, "Wed"], [4, "Fri"]]) svgEl("text", { x: 0, y: T + i * S + 9, class: "fill-muted-foreground font-mono text-[9px]" }, svg).textContent = lbl;
  let lastMonth = -1;
  days.forEach((d, i) => {
    const col = Math.floor(i / 7), row = i % 7;
    if (row === 0 && d.date.getMonth() !== lastMonth && col < 52) {
      lastMonth = d.date.getMonth();
      svgEl("text", { x: L + col * S, y: 10, class: "fill-muted-foreground font-mono text-[9px]" }, svg).textContent = fmtMonth.format(d.date);
    }
    const lv = d.minutes === 0 ? 0 : d.minutes < 15 ? 1 : d.minutes < 30 ? 2 : d.minutes < 45 ? 3 : 4;
    const r = svgEl("rect", { x: L + col * S, y: T + row * S, width: 10, height: 10, rx: 2, style: `fill:${LEVEL[lv]}` + (d.freeze ? ";stroke:var(--vec-u);stroke-width:1.2" : "") }, svg);
    r.dataset.i = i;
  });
  svg.addEventListener("pointermove", (e) => {
    const i = e.target.dataset?.i;
    if (i === undefined) return (tip.hidden = true);
    const d = days[i];
    tip.textContent = `${d.minutes ? `${d.minutes} min` : d.freeze ? "Freeze used" : "No practice"} · ${fmtDay.format(d.date)}`;
    tip.hidden = false;
    const box = root.querySelector(".relative").getBoundingClientRect();
    const rr = e.target.getBoundingClientRect();
    tip.style.left = `${Math.min(box.width - tip.offsetWidth - 4, Math.max(4, rr.left - box.left + rr.width / 2 - tip.offsetWidth / 2))}px`;
    tip.style.top = `${rr.top - box.top - tip.offsetHeight - 6}px`;
  });
  svg.addEventListener("pointerleave", () => (tip.hidden = true));
}

// ============================================================ Lesson player

for (const root of document.querySelectorAll("[data-plat-player]")) {
  const D = Number(root.dataset.duration);
  const btn = root.querySelector("[data-action=play]");
  const scrub = root.querySelector("[data-scrub]");
  const fill = root.querySelector("[data-fill]");
  const knob = root.querySelector("[data-knob]");
  const time = root.querySelector("[data-time]");
  const chapterLabel = root.querySelector("[data-chapter]");
  const chapters = [...root.querySelectorAll("[data-chapter-seek]")];
  const lines = [...root.querySelectorAll("[data-t]")];
  const box = root.querySelector("[data-transcript]");
  const stage = root.querySelector("[data-stage]");
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  let t = 0, rate = 1, playing = false, raf = 0, last = 0, visible = true, lastLine = -1;

  function drawStage() {
    stage.replaceChildren();
    for (let k = -4; k <= 4; k++) svgEl("line", { x1: k, y1: -2.25, x2: k, y2: 2.25, style: "stroke:currentColor;stroke-opacity:0.07;stroke-width:0.02" }, stage);
    for (let k = -2; k <= 2; k++) svgEl("line", { x1: -4, y1: k, x2: 4, y2: k, style: "stroke:currentColor;stroke-opacity:0.07;stroke-width:0.02" }, stage);
    // The shear [[1,1],[0,1]]: its only eigen-direction is the x-axis.
    svgEl("line", { x1: -4, y1: 0, x2: 4, y2: 0, style: "stroke:var(--brand);stroke-width:0.04;stroke-dasharray:0.15 0.1" }, stage);
    const a = (t / 12) % (2 * Math.PI);
    const v = [Math.cos(a) * 1.4, Math.sin(a) * 1.4];
    const w = [v[0] + v[1], v[1]];
    const arrow = (p, color, wdt) => svgEl("line", { x1: 0, y1: 0, x2: p[0], y2: -p[1], style: `stroke:${color};stroke-width:${wdt};stroke-linecap:round` }, stage);
    arrow(v, "var(--vec-u)", 0.06);
    arrow(w, "var(--vec-out)", 0.06);
    svgEl("circle", { cx: 0, cy: 0, r: 0.06, style: "fill:var(--foreground)" }, stage);
  }

  function update() {
    const f = t / D;
    fill.style.width = `${f * 100}%`;
    knob.style.left = `${f * 100}%`;
    scrub.setAttribute("aria-valuenow", Math.round(t));
    scrub.setAttribute("aria-valuetext", clock(t));
    time.textContent = `${clock(t)} / ${clock(D)}`;
    let ci = 0;
    chapters.forEach((c, i) => { if (Number(c.dataset.chapterSeek) <= t) ci = i; });
    chapters.forEach((c, i) => c.toggleAttribute("data-on", i === ci));
    chapterLabel.textContent = `${ci + 1} · ${chapters[ci].querySelector(".truncate").textContent}`;
    let li = 0;
    lines.forEach((l, i) => { if (Number(l.dataset.t) <= t) li = i; });
    if (li !== lastLine) {
      lines.forEach((l, i) => l.toggleAttribute("data-on", i === li));
      lastLine = li;
      const el = lines[li];
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior: reduced() ? "auto" : "smooth" });
    }
    drawStage();
  }

  const seek = (s) => { t = Math.max(0, Math.min(D, s)); update(); };
  const loop = (now) => {
    t += ((now - last) / 1000) * rate;
    last = now;
    if (t >= D) { t = D; setPlaying(false); }
    update();
    if (playing && visible) raf = requestAnimationFrame(loop);
    else raf = 0;
  };
  function setPlaying(p) {
    playing = p;
    setIcons(btn, p);
    if (p && t >= D) t = 0;
    if (p && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  btn.addEventListener("click", () => setPlaying(!playing));
  root.querySelectorAll("[data-seek]").forEach((b) => b.addEventListener("click", () => seek(t + Number(b.dataset.seek))));
  chapters.forEach((c) => c.addEventListener("click", () => seek(Number(c.dataset.chapterSeek))));
  lines.forEach((l) => l.addEventListener("click", () => seek(Number(l.dataset.t))));
  root.addEventListener("seg-change", (e) => (rate = Number(e.detail.value)));
  const fromPointer = (e) => { const r = scrub.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * D); };
  scrub.addEventListener("pointerdown", (e) => { scrub.setPointerCapture(e.pointerId); fromPointer(e); });
  scrub.addEventListener("pointermove", (e) => { if (scrub.hasPointerCapture(e.pointerId)) fromPointer(e); });
  scrub.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 5, ArrowLeft: -5, ArrowUp: 5, ArrowDown: -5 }[e.key];
    if (d) { e.preventDefault(); seek(t + d); }
    if (e.key === "Home") { e.preventDefault(); seek(0); }
    if (e.key === "End") { e.preventDefault(); seek(D); }
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === "k") { e.preventDefault(); setPlaying(!playing); }
    else if (k === "j") { e.preventDefault(); seek(t - 10); }
    else if (k === "l") { e.preventDefault(); seek(t + 10); }
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && playing && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(root);
  root.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === "1")));
  update();
}

// ============================================================ Notes and highlights

for (const root of document.querySelectorAll("[data-plat-notes]")) {
  const text = root.querySelector("[data-text]");
  const article = text.parentElement;
  const bar = root.querySelector("[data-toolbar]");
  const list = root.querySelector("[data-list]");
  const empty = root.querySelector("[data-empty]");
  const count = root.querySelector("[data-count]");
  const exportBtn = root.querySelector("[data-export]");
  const notes = []; // { id, color, mark, note }
  let range = null, nextId = 1;

  function currentRange() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!text.contains(r.commonAncestorContainer)) return null;
    // Keep the highlight inside one paragraph.
    const para = (n) => (n.nodeType === 1 ? n : n.parentElement).closest("p");
    const p0 = para(r.startContainer), p1 = para(r.endContainer);
    if (p0 && p1 && p0 !== p1) r.setEnd(p0, p0.childNodes.length);
    return r.toString().trim() ? r : null;
  }

  function showBar() {
    range = currentRange();
    if (!range) return (bar.hidden = true);
    const rr = range.getBoundingClientRect(), ar = article.getBoundingClientRect();
    bar.hidden = false;
    bar.style.left = `${Math.max(8, Math.min(ar.width - bar.offsetWidth - 8, rr.left - ar.left + rr.width / 2 - bar.offsetWidth / 2))}px`;
    bar.style.top = `${rr.top - ar.top - bar.offsetHeight - 8}px`;
  }

  function wrap(color, withNote) {
    if (!range) return;
    const frag = range.extractContents();
    // Fold any highlight already inside the selection into the new one.
    frag.querySelectorAll?.("mark").forEach((m) => {
      const n = notes.find((x) => x.mark === m);
      if (n) remove(n, false);
      m.replaceWith(...m.childNodes);
    });
    const mark = make("mark", "transition-[box-shadow] duration-300");
    mark.style.background = `color-mix(in oklab, var(--${color}) 28%, transparent)`;
    mark.append(frag);
    range.insertNode(mark);
    getSelection().removeAllRanges();
    bar.hidden = true;
    const n = { id: nextId++, color, mark, note: "" };
    notes.push(n);
    renderList(withNote ? n : null);
  }

  function remove(n, rerender = true) {
    const parent = n.mark.parentNode;
    if (parent) { n.mark.replaceWith(...n.mark.childNodes); parent.normalize(); }
    notes.splice(notes.indexOf(n), 1);
    if (rerender) renderList();
  }

  function renderList(focus) {
    list.replaceChildren();
    // In reading order.
    notes.sort((a, b) => (a.mark.compareDocumentPosition(b.mark) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    for (const n of notes) {
      const li = make("li", "enter flex flex-col gap-2 rounded-lg border p-3");
      const head = make("div", "flex items-start gap-2");
      const dot = make("span", "mt-1.5 size-2 shrink-0 rounded-full");
      dot.style.background = `var(--${n.color})`;
      const quote = make("button", "line-clamp-2 flex-1 text-left text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50", `“${n.mark.textContent.trim()}”`);
      quote.type = "button";
      quote.title = "Show in the lesson";
      quote.addEventListener("click", () => {
        n.mark.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
        n.mark.style.boxShadow = `0 0 0 2px var(--${n.color})`;
        setTimeout(() => (n.mark.style.boxShadow = ""), 900);
      });
      const del = make("button", "rounded-md px-1.5 py-0.5 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50", "Remove");
      del.type = "button";
      del.addEventListener("click", () => remove(n));
      head.append(dot, quote, del);
      const area = make("textarea", "min-h-9 resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm");
      area.rows = 1;
      area.placeholder = "Add a note…";
      area.value = n.note;
      area.setAttribute("aria-label", "Note");
      area.addEventListener("input", () => (n.note = area.value));
      li.append(head, area);
      list.append(li);
      if (focus === n) requestAnimationFrame(() => area.focus());
    }
    empty.hidden = notes.length > 0;
    count.textContent = String(notes.length);
  }

  text.addEventListener("mouseup", () => setTimeout(showBar));
  text.addEventListener("keyup", (e) => { if (e.shiftKey || e.key.startsWith("Arrow")) showBar(); });
  document.addEventListener("selectionchange", () => { if (!bar.hidden && !currentRange()) bar.hidden = true; });
  bar.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection
  bar.querySelectorAll("[data-color]").forEach((b) => b.addEventListener("click", () => wrap(b.dataset.color, b.hasAttribute("data-with-note"))));
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") bar.hidden = true; });
  exportBtn.addEventListener("click", () => {
    const md = notes.map((n) => `> ${n.mark.textContent.trim()}\n${n.note ? `\n${n.note}\n` : ""}`).join("\n");
    navigator.clipboard?.writeText(`# Notes · Vectors that stay on their line\n\n${md}`).then(() => {
      const l = exportBtn.lastChild;
      const was = l.textContent;
      l.textContent = "Copied";
      setTimeout(() => (l.textContent = was), 1200);
    });
  });
  renderList();
}

// ============================================================ Discussion

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(ms) {
  const s = Math.round((ms - Date.now()) / 1000);
  for (const [u, n] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  }
  return "just now";
}

for (const root of document.querySelectorAll("[data-plat-discussion]")) {
  const now = Date.now();
  const hydrate = (p) => ({ ...p, at: now - p.m * 60000, voted: false, re: (p.re ?? []).map(hydrate) });
  const posts = JSON.parse(root.dataset.thread).map(hydrate);
  const list = root.querySelector("[data-posts]");
  const total = root.querySelector("[data-total]");
  const form = root.querySelector("[data-compose]");
  const body = root.querySelector("[data-body]");
  let sort = "top", nextId = 100, replyTo = null;

  const order = (arr) => [...arr].sort((a, b) => (b.ans ? 1 : 0) - (a.ans ? 1 : 0) || (sort === "top" ? b.v + (b.voted ? 1 : 0) - (a.v + (a.voted ? 1 : 0)) : b.at - a.at));

  function bodyText(text) {
    const p = make("p", "text-sm leading-relaxed whitespace-pre-wrap");
    for (const part of text.split(/(@[\p{L}\d_]+)/u)) {
      if (part.startsWith("@")) p.append(make("span", "font-medium text-brand", part));
      else if (part) p.append(part);
    }
    return p;
  }

  function postEl(p, parent) {
    const li = make("li", "flex gap-3");
    const av = make("span", "flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-xs font-medium", p.a[0]);
    const col = make("div", "flex min-w-0 flex-1 flex-col gap-1.5");
    const head = make("div", "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs");
    head.append(make("span", "text-sm font-medium", p.a));
    if (p.r) head.append(make("span", "rounded-full border px-1.5 py-px text-[10px] text-muted-foreground", p.r));
    const when = make("time", "text-muted-foreground", ago(p.at));
    when.dateTime = new Date(p.at).toISOString();
    when.dataset.at = p.at;
    head.append(when);
    if (p.ans) head.append(make("span", "flex items-center gap-1 rounded-full bg-add/12 px-1.5 py-px text-[10px] font-medium text-add", "✓ Answer"));
    const actions = make("div", "flex items-center gap-1 text-xs text-muted-foreground");
    const vote = make("button", "flex items-center gap-1 rounded-md px-1.5 py-0.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:text-brand");
    vote.type = "button";
    vote.setAttribute("aria-pressed", String(p.voted));
    vote.setAttribute("aria-label", `Upvote, ${p.v + (p.voted ? 1 : 0)} votes`);
    vote.append("▲ ", make("span", "tabular-nums", String(p.v + (p.voted ? 1 : 0))));
    vote.addEventListener("click", () => { p.voted = !p.voted; render(); });
    actions.append(vote);
    const reply = make("button", "rounded-md px-1.5 py-0.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50", "Reply");
    reply.type = "button";
    reply.addEventListener("click", () => { replyTo = parent ?? p; render(); });
    actions.append(reply);
    if (parent) {
      const mark = make("button", "rounded-md px-1.5 py-0.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50", p.ans ? "Unmark answer" : "Mark as answer");
      mark.type = "button";
      mark.addEventListener("click", () => { const was = p.ans; parent.re.forEach((r) => (r.ans = false)); p.ans = !was; render(); });
      actions.append(mark);
    }
    col.append(head, bodyText(p.t), actions);
    if (!parent && (p.re.length || replyTo === p)) {
      const sub = make("ol", "mt-2 flex flex-col gap-3 border-l pl-4");
      for (const r of order(p.re)) sub.append(postEl(r, p));
      if (replyTo === p) sub.append(replyForm(p));
      col.append(sub);
    }
    li.append(av, col);
    return li;
  }

  function replyForm(p) {
    const f = make("form", "enter flex flex-col gap-2 rounded-lg border p-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50");
    const ta = make("textarea", "min-h-10 resize-none bg-transparent text-base outline-none sm:text-sm");
    ta.rows = 2;
    ta.placeholder = `Reply to ${p.a}…`;
    ta.setAttribute("aria-label", `Reply to ${p.a}`);
    ta.value = `@${p.a} `;
    const row = make("div", "flex justify-end gap-2");
    const cancel = make("button", "rounded-md px-2 py-1 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => { replyTo = null; render(); });
    const send = make("button", "rounded-md border px-2.5 py-1 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50", "Reply");
    send.type = "submit";
    row.append(cancel, send);
    f.append(ta, row);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!ta.value.trim()) return;
      p.re.push({ id: nextId++, a: "You", t: ta.value.trim(), v: 0, at: Date.now(), voted: false, re: [] });
      replyTo = null;
      render();
    });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
    return f;
  }

  function render() {
    list.replaceChildren(...order(posts).map((p) => postEl(p)));
    const n = posts.reduce((s, p) => s + 1 + p.re.length, 0);
    total.textContent = `Discussion · ${n} posts`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!body.value.trim()) return;
    posts.push({ id: nextId++, a: "You", t: body.value.trim(), v: 0, at: Date.now(), voted: false, re: [] });
    body.value = "";
    sort = "new";
    root.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === "new")));
    render();
  });
  body.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") form.requestSubmit(); });
  root.addEventListener("seg-change", (e) => { sort = e.detail.value; render(); });
  setInterval(() => root.querySelectorAll("time[data-at]").forEach((t) => (t.textContent = ago(Number(t.dataset.at)))), 30000);
  render();
}

// ============================================================ Leaderboard

for (const root of document.querySelectorAll("[data-plat-leaderboard]")) {
  const you = root.querySelector("[data-you]");
  const sticky = root.querySelector("[data-sticky]");
  const scroller = sticky?.parentElement;
  if (!you || !sticky) continue;
  // The pinned copy shows only while your real row is scrolled away.
  new IntersectionObserver(([e]) => (sticky.hidden = e.isIntersecting), { root: scroller, threshold: 0.9 }).observe(you);
}

// ============================================================ Achievements

const SUBJECTS = ["Linear Algebra", "Genetics", "Rocket Engineering"];
for (const root of document.querySelectorAll("[data-plat-achievements]")) {
  const out = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  const badges = Object.fromEntries([...root.querySelectorAll("[data-badge]")].map((b) => [b.dataset.badge, b]));
  const fresh = () => ({ lessons: 0, days: 0, quizzes: 0, subjects: [], unlocked: [] });
  let s = store.get("plat-achievements", fresh());
  const rules = {
    first: () => s.lessons >= 1,
    five: () => s.lessons >= 5,
    streak: () => s.days >= 3,
    perfect: () => s.quizzes >= 1,
    night: () => { const hr = new Date().getHours(); return hr < 5; },
    polymath: () => s.subjects.length >= 3,
  };
  function sync(announce) {
    for (const [id, ok] of Object.entries(rules)) {
      if (!s.unlocked.includes(id) && ok()) {
        s.unlocked.push(id);
        if (announce) {
          const name = badges[id].querySelector(".truncate").textContent;
          const rule = badges[id].querySelectorAll(".truncate")[1].textContent;
          toast.success(`Achievement unlocked: ${name}`, { description: rule });
          if (!reduced()) badges[id].animate([{ transform: "scale(0.94)" }, { transform: "scale(1.03)" }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
        }
      }
    }
    for (const [id, b] of Object.entries(badges)) b.toggleAttribute("data-on", s.unlocked.includes(id));
    out.lessons.textContent = s.lessons;
    out.days.textContent = s.days;
    out.unlocked.textContent = s.unlocked.length;
    store.set("plat-achievements", s);
  }
  root.querySelectorAll("[data-event]").forEach((b) => b.addEventListener("click", () => {
    const ev = b.dataset.event;
    if (ev === "lesson") {
      const subject = SUBJECTS[s.lessons % SUBJECTS.length];
      s.lessons++;
      if (!s.subjects.includes(subject)) s.subjects.push(subject);
    } else if (ev === "day") s.days++;
    else if (ev === "quiz") s.quizzes++;
    else if (ev === "reset") { s = fresh(); toast("Progress reset"); }
    sync(true);
  }));
  sync(false);
}

// ============================================================ Certificate

for (const root of document.querySelectorAll("[data-plat-certificate]")) {
  const name = root.querySelector("[data-name]");
  const course = root.querySelector("[data-course]");
  const sheet = root.querySelector("[data-sheet]");
  const o = { name: root.querySelector("[data-out-name]"), course: root.querySelector("[data-out-course]"), date: root.querySelector("[data-out-date]"), code: root.querySelector("[data-out-code]") };
  const today = new Date();
  const dateText = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(today);
  const iso = today.toISOString().slice(0, 10);

  async function update() {
    const n = name.value.trim() || "Your name";
    o.name.textContent = n;
    o.course.textContent = course.value;
    o.date.textContent = dateText;
    try {
      const bytes = new TextEncoder().encode(`${n}|${course.value}|${iso}`);
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10).toUpperCase();
      o.code.textContent = `${hex.slice(0, 5)}-${hex.slice(5)}`;
    } catch {
      o.code.textContent = "unavailable";
    }
  }
  name.addEventListener("input", update);
  course.addEventListener("change", update);

  root.querySelector("[data-print]").addEventListener("click", () => {
    // Print only the certificate: a copy at the top of <body>, everything
    // else hidden by a print-only rule.
    const holder = document.createElement("div");
    holder.id = "plat-print-root";
    holder.append(sheet.cloneNode(true));
    document.body.append(holder);
    const style = nonceStyle(`#plat-print-root{display:none}@media print{body>*:not(#plat-print-root){display:none!important}#plat-print-root{display:block!important;padding:0}#plat-print-root>*{box-shadow:none;border:none}@page{size:A4 landscape;margin:12mm}}`);
    const done = () => { holder.remove(); style.remove(); removeEventListener("afterprint", done); };
    addEventListener("afterprint", done);
    print();
    setTimeout(done, 1000);
  });

  root.querySelector("[data-png]").addEventListener("click", () => {
    const W = 1414, H = 1000;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    const css = getComputedStyle(sheet);
    const fg = getComputedStyle(root).color;
    const muted = getComputedStyle(o.date.previousElementSibling).color;
    const brand = getComputedStyle(sheet.querySelector(".text-brand")).color;
    g.fillStyle = css.backgroundColor;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = muted;
    g.lineWidth = 3;
    g.strokeRect(56, 56, W - 112, H - 112);
    g.lineWidth = 1.5;
    g.strokeRect(68, 68, W - 136, H - 136);
    g.textAlign = "center";
    g.fillStyle = fg;
    g.font = "500 30px Geist, sans-serif";
    g.fillText("Hypercode", W / 2, 170);
    g.fillStyle = muted;
    g.font = "500 22px 'Geist Mono', monospace";
    g.fillText("C E R T I F I C A T E   O F   C O M P L E T I O N", W / 2, 330);
    g.font = "26px Geist, sans-serif";
    g.fillText("This certifies that", W / 2, 400);
    g.fillStyle = fg;
    g.font = "italic 72px Georgia, serif";
    g.fillText(o.name.textContent, W / 2, 500);
    g.fillStyle = muted;
    g.font = "26px Geist, sans-serif";
    g.fillText("has completed the course", W / 2, 570);
    g.fillStyle = fg;
    g.font = "600 46px Geist, sans-serif";
    g.fillText(o.course.textContent, W / 2, 640);
    g.textAlign = "left";
    g.font = "22px Geist, sans-serif";
    g.fillStyle = muted;
    g.fillText("Date", 130, 840);
    g.fillStyle = fg;
    g.fillText(o.date.textContent, 130, 872);
    g.textAlign = "right";
    g.fillStyle = muted;
    g.fillText("Verification", W - 130, 840);
    g.fillStyle = fg;
    g.font = "22px 'Geist Mono', monospace";
    g.fillText(o.code.textContent, W - 130, 872);
    g.beginPath();
    g.arc(W / 2, 850, 34, 0, 2 * Math.PI);
    g.strokeStyle = brand;
    g.lineWidth = 4;
    g.stroke();
    g.beginPath();
    g.moveTo(W / 2 - 14, 851);
    g.lineTo(W / 2 - 3, 862);
    g.lineTo(W / 2 + 16, 840);
    g.stroke();
    c.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `certificate-${o.name.textContent.toLowerCase().replace(/[^\p{L}\d]+/gu, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  });
  update();
}

// ============================================================ Onboarding tour

for (const root of document.querySelectorAll("[data-plat-tour]")) {
  const steps = JSON.parse(root.dataset.steps);
  const overlay = root.querySelector("[data-overlay]");
  const hole = root.querySelector("[data-hole]");
  const card = root.querySelector("[data-card]");
  const startBtn = root.querySelector("[data-start]");
  const checks = [...root.querySelectorAll("[data-check]")];
  const bar = root.querySelector("[data-bar]");
  const progress = root.querySelector("[data-progress-label]");
  const prev = card.querySelector("[data-prev]"), next = card.querySelector("[data-next]");
  const seen = new Set();
  let at = 0, opener = null;

  function place() {
    const target = root.querySelector(`[data-tour-target="${steps[at].target}"]`);
    const r = target.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const below = r.bottom + pad + 12 + ch < innerHeight;
    card.style.top = `${below ? r.bottom + pad + 12 : Math.max(8, r.top - pad - 12 - ch)}px`;
    card.style.left = `${Math.max(8, Math.min(innerWidth - cw - 8, r.left + r.width / 2 - cw / 2))}px`;
  }

  function show(i) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[at];
    card.querySelector("[data-step-label]").textContent = `Step ${at + 1} of ${steps.length}`;
    card.querySelector("[data-step-title]").textContent = s.title;
    card.querySelector("[data-step-body]").textContent = s.body;
    prev.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? "Done" : "Next";
    seen.add(at);
    checks.forEach((c, k) => c.toggleAttribute("data-done", seen.has(k)));
    bar.style.width = `${(100 * seen.size) / steps.length}%`;
    progress.textContent = `${seen.size}/${steps.length}`;
    // "instant" overrides the page's smooth scrolling, so the rect below is final.
    root.querySelector(`[data-tour-target="${s.target}"]`).scrollIntoView({ block: "center", behavior: "instant" });
    place();
    card.focus();
  }

  function open() {
    opener = document.activeElement;
    overlay.hidden = false;
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    enter(card);
    show(0);
  }
  function close() {
    overlay.hidden = true;
    removeEventListener("resize", place);
    removeEventListener("scroll", place, true);
    (opener ?? startBtn).focus();
  }
  startBtn.addEventListener("click", open);
  card.querySelector("[data-close]").addEventListener("click", close);
  prev.addEventListener("click", () => show(at - 1));
  next.addEventListener("click", () => (at === steps.length - 1 ? close() : show(at + 1)));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); at === steps.length - 1 ? close() : show(at + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    else if (e.key === "Tab") {
      // Keep focus inside the card while the tour is open.
      const f = [...card.querySelectorAll("button:not(:disabled)")];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
}

// ============================================================ Pricing

for (const root of document.querySelectorAll("[data-plat-pricing]")) {
  let yearly = false, student = false;
  const money = (v) => (Number.isInteger(v) ? `€${v}` : `€${v.toFixed(2)}`);
  const pct = (v) => `${Number(v.toFixed(2))}%`;
  function render() {
    const k = student ? 0.5 : 1;
    for (const plan of root.querySelectorAll("[data-plan]")) {
      const m = Number(plan.dataset.monthly) * k, y = Number(plan.dataset.yearly) * k;
      const price = plan.querySelector("[data-price]"), per = plan.querySelector("[data-per]"), note = plan.querySelector("[data-note]");
      const seat = plan.dataset.plan === "team" ? " per learner" : "";
      if (m === 0) { price.textContent = "€0"; per.textContent = "forever"; note.textContent = ""; continue; }
      if (yearly) {
        price.textContent = money(y);
        per.textContent = "/ year" + seat;
        note.textContent = `${money(Math.round((y / 12) * 100) / 100)}/month · save ${pct(100 * (1 - y / (12 * m)))} vs monthly`;
      } else {
        price.textContent = money(m);
        per.textContent = "/ month" + seat;
        note.textContent = student ? "Student price, with a valid school email" : "";
      }
    }
  }
  root.addEventListener("seg-change", (e) => { yearly = e.detail.value === "yearly"; render(); });
  root.querySelector("[data-toggle=student]").addEventListener("shadcn:checked-change", (e) => { student = e.detail.checked; render(); });
  render();
}

// ============================================================ Settings

for (const root of document.querySelectorAll("[data-plat-settings]")) {
  const html = document.documentElement;
  const status = root.querySelector("[data-status]");
  const motion = root.querySelector("[data-toggle=motion]");
  const mq = matchMedia("(prefers-color-scheme: dark)");
  let motionStyle = null;
  const say = (m) => (status.textContent = m);
  const select = (label, value) => root.querySelectorAll(`[role=tablist][aria-label="${label}"] [data-seg]`).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));

  const applyTheme = (mode) => {
    if (mode === "system") { store.del("theme"); html.classList.toggle("dark", mq.matches); }
    else { try { localStorage.setItem("theme", mode); } catch {} html.classList.toggle("dark", mode === "dark"); }
  };
  mq.addEventListener("change", () => { if (themeMode() === "system") html.classList.toggle("dark", mq.matches); });
  const themeMode = () => { try { return localStorage.getItem("theme") ?? "system"; } catch { return "system"; } };
  const applySize = (v) => { html.style.fontSize = v === "100" ? "" : `${v}%`; store.set("plat-text-size", v); };
  const applyMotion = (on) => {
    motionStyle?.remove();
    motionStyle = on ? nonceStyle("*,*::before,*::after{animation-duration:0.001ms!important;animation-iteration-count:1!important;transition-duration:0.001ms!important;scroll-behavior:auto!important}") : null;
    store.set("plat-reduce-motion", on);
  };

  root.addEventListener("seg-change", (e) => {
    const label = e.target.getAttribute("aria-label");
    if (label === "Theme") { applyTheme(e.detail.value); say(`Theme: ${e.detail.value}.`); }
    if (label === "Text size") { applySize(e.detail.value); say(`Text size: ${e.detail.value}%.`); }
  });
  motion.addEventListener("shadcn:checked-change", (e) => { applyMotion(e.detail.checked); say(e.detail.checked ? "Motion reduced on this page." : "Motion follows your system again."); });

  root.querySelector("[data-export]").addEventListener("click", () => {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === "theme" || k.startsWith("plat-")) data[k] = localStorage.getItem(k);
      }
    } catch {}
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "hypercode-settings.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`Exported ${Object.keys(data).length} saved item${Object.keys(data).length === 1 ? "" : "s"}.`);
  });
  root.querySelector("[data-reset]").addEventListener("click", () => {
    try {
      for (const k of Object.keys(localStorage)) if (k === "theme" || k.startsWith("plat-")) localStorage.removeItem(k);
    } catch {}
    applyTheme("system");
    applySize("100");
    store.del("plat-text-size");
    applyMotion(false);
    store.del("plat-reduce-motion");
    if (motion.getAttribute("data-state") === "checked") motion.click();
    select("Theme", "system");
    select("Text size", "100");
    say("Saved settings and progress were removed from this browser.");
  });

  // Restore.
  select("Theme", themeMode());
  const size = store.get("plat-text-size", "100");
  select("Text size", size);
  if (size !== "100") applySize(size);
  if (store.get("plat-reduce-motion", false)) { applyMotion(true); if (motion.getAttribute("data-state") !== "checked") motion.click(); }
}
