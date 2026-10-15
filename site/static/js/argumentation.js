// Argumentation tools. Every block root is prefixed data-argu-*, so this
// module does nothing on other pages. User text only ever reaches the DOM
// through textContent or form values, never innerHTML.

import { scrubAll } from "./scrub.js";
import { el as svgEl, text as svgText, num } from "./plot.js";

// ------------------------------------------------------------ helpers

function mk(tag, cls = "", text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const INPUT = "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";
const SELECT = "h-8 rounded-md border border-input bg-background px-1.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";
const ICONBTN = "inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-xs text-muted-foreground shadow-xs outline-none transition-[color,border-color,transform] duration-150 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-40";

function iconButton(label, glyph, cls = "") {
  const b = mk("button", ICONBTN + " " + cls, glyph);
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.title = label;
  return b;
}

function select(options, value, label) {
  const s = mk("select", SELECT);
  s.setAttribute("aria-label", label);
  for (const [v, t] of options) {
    const o = mk("option", "", t);
    o.value = v;
    if (String(v) === String(value)) o.selected = true;
    s.append(o);
  }
  return s;
}

const setCopy = (root, text) => root.querySelectorAll("[data-argu-copy]").forEach((b) => (b.dataset.copy = text));

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem("argu:" + key)); } catch { return null; } },
  set(key, v) { try { localStorage.setItem("argu:" + key, JSON.stringify(v)); } catch {} },
};

// Restores and saves a block's [data-argu-field] text areas.
function persistFields(root, key, onChange) {
  const fields = Object.fromEntries([...root.querySelectorAll("[data-argu-field]")].map((f) => [f.dataset.arguField, f]));
  const saved = store.get(key);
  if (saved) for (const k in saved) if (fields[k] && typeof saved[k] === "string") fields[k].value = saved[k];
  for (const f of Object.values(fields)) {
    f.addEventListener("input", () => {
      store.set(key, Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value])));
      onChange();
    });
  }
  return fields;
}

const sentence = (s) => {
  s = s.trim();
  return !s || /[.!?…]["”’)]?$/.test(s) ? s : s + ".";
};
// Lower-case the first letter unless it starts an acronym or "I".
const lcFirst = (s) => (s.length > 1 && /^[A-Z][a-z]/.test(s) && !/^I\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

const STOP = new Set(("that this with from have were they their there which what when will would could should about into than then them these those more most such some other only also been being does very much many your just over under after before while where because since").split(" "));

// Words that dismiss or overclaim. A heuristic: they flag places to look.
const LOADED = ["obviously", "clearly", "just", "simply", "only", "idiots?", "stupid", "ridiculous", "absurd", "crazy", "hates?", "everyone knows", "nobody", "always", "never", "so-called", "naive", "brainwashed", "sheep", "extremists?", "you always", "you never"];
const LOADED_RE = new RegExp(`\\b(${LOADED.join("|")})\\b`, "gi");
const loadedIn = (text) => [...new Set((text.match(LOADED_RE) || []).map((w) => w.toLowerCase()))];

function flagChips(target, words) {
  target.replaceChildren(...words.map((w) => mk("span", "rounded-full border border-vec-out/50 bg-vec-out/10 px-1.5 py-px text-[11px] text-[color-mix(in_oklab,var(--vec-out)_65%,var(--foreground))]", w)));
}

function checkItem(ok, text, warn = false) {
  const li = mk("li", "flex gap-2 leading-snug");
  const mark = mk("span", "mt-px w-4 shrink-0 text-center font-mono text-xs " + (ok ? "text-add" : warn ? "text-[var(--vec-out)]" : "text-muted-foreground"), ok ? "✓" : warn ? "!" : "○");
  li.append(mark, mk("span", ok ? "" : "text-muted-foreground", text));
  return li;
}

// ============================================================ Toulmin

const TOULMIN = {
  harry: {
    data: "Harry was born in Bermuda.",
    qualifier: "presumably",
    claim: "Harry is a British subject.",
    warrant: "A man born in Bermuda will generally be a British subject.",
    backing: "The statutes and other legal provisions on the nationality of people born in British colonies.",
    rebuttal: "Both his parents were aliens, or he has become a naturalised American.",
  },
  school: {
    data: "Teenagers' sleep cycles shift later at puberty, and most get less than the 8–10 hours a night recommended for their age.",
    qualifier: "in most cases",
    claim: "Secondary schools should start no earlier than 8:30 am.",
    warrant: "A timetable that lets students sleep closer to their biological needs should improve their health and learning.",
    backing: "Research on adolescent circadian rhythms, summarised in the American Academy of Pediatrics' 2014 policy statement on school start times.",
    rebuttal: "Later starts make school transport or after-school work impossible for many families.",
  },
  blank: { data: "", qualifier: "", claim: "", warrant: "", backing: "", rebuttal: "" },
};

for (const root of document.querySelectorAll("[data-argu-toulmin]")) {
  const svg = root.querySelector("[data-argu-t-lines]");
  const checks = root.querySelector("[data-argu-t-checks]");
  const bar = root.querySelector("[data-argu-t-bar]");
  const score = root.querySelector("[data-argu-t-score]");
  const cards = Object.fromEntries([...root.querySelectorAll("[data-argu-t-card]")].map((c) => [c.dataset.arguTCard, c]));
  const fields = persistFields(root, "toulmin", update);
  if (!store.get("toulmin")) for (const k in fields) fields[k].value = TOULMIN.harry[k];

  root.addEventListener("seg-change", (e) => {
    const p = TOULMIN[e.detail.value];
    if (!p) return;
    for (const k in fields) fields[k].value = p[k];
    store.set("toulmin", p);
    update();
  });

  function lines() {
    svg.replaceChildren();
    if (getComputedStyle(svg).display === "none") return;
    const box = svg.getBoundingClientRect();
    const r = (k) => {
      const b = cards[k].getBoundingClientRect();
      return { l: b.left - box.left, r: b.right - box.left, t: b.top - box.top, b: b.bottom - box.top, cx: (b.left + b.right) / 2 - box.left, cy: (b.top + b.bottom) / 2 - box.top };
    };
    const [d, q, c, w, bk, rb] = ["data", "qualifier", "claim", "warrant", "backing", "rebuttal"].map(r);
    const style = "fill:none;stroke:currentColor;stroke-opacity:0.35;stroke-width:1.5";
    const line = (path) => svgEl("path", { d: path, style }, svg);
    const head = (x, y, dir) => svgEl("path", { d: dir === "right" ? `M${x - 7} ${y - 4} L${x} ${y} L${x - 7} ${y + 4}` : `M${x - 4} ${y + 7} L${x} ${y} L${x + 4} ${y + 7}`, style }, svg);
    const y = d.cy;
    line(`M${d.r} ${y} H${q.l}`);
    line(`M${q.r} ${y} H${c.l - 1}`);
    head(c.l - 1, y, "right");
    // The warrant licenses the step from data to claim: it hangs under it.
    const mid = (d.r + q.l) / 2;
    line(`M${w.cx} ${w.t} V${(y + q.b) / 2} H${mid} V${y}`);
    head(mid, y + 1, "up");
    line(`M${bk.cx} ${bk.t} V${w.b}`);
    head(bk.cx, w.b + 1, "up");
    line(`M${rb.cx} ${rb.t} V${c.b}`);
    head(rb.cx, c.b + 1, "up");
  }

  function update() {
    const v = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value.trim()]));
    for (const k in cards) cards[k].toggleAttribute("data-empty", !v[k]);
    const absolute = /\b(all|always|never|every|everyone|no one|nobody|must)\b/i.test(v.claim);
    const items = [
      [!!v.claim, "A claim: what you want accepted."],
      [!!v.data, "Data: facts the claim rests on."],
      [!!v.warrant, "A warrant, stated: the step most often left unsaid."],
      [!!v.backing, "Backing: why the warrant should be trusted."],
      [!!v.qualifier, "A qualifier: how sure the claim is."],
      [!!v.rebuttal, "A rebuttal: when the claim would fail."],
    ];
    const n = items.filter(([ok]) => ok).length;
    checks.replaceChildren(...items.map(([ok, t]) => checkItem(ok, t)));
    if (absolute && !v.qualifier) checks.append(checkItem(false, "The claim says all, never or must without a qualifier: is it really that certain?", true));
    bar.style.width = `${(100 * n) / 6}%`;
    score.textContent = `${n} of 6 parts`;
    setCopy(root, [
      `**Claim:** ${v.qualifier ? v.qualifier + ", " : ""}${v.claim || "—"}`,
      `- **Data:** ${v.data || "—"}`,
      `- **Warrant (since):** ${v.warrant || "—"}`,
      `- **Backing (on account of):** ${v.backing || "—"}`,
      `- **Rebuttal (unless):** ${v.rebuttal || "—"}`,
    ].join("\n"));
    lines();
  }

  new ResizeObserver(lines).observe(root);
  update();
}

// ============================================================ Argument map

let nodeId = 0;
const node = (kind, text, weight = 2, children = []) => ({ id: ++nodeId, kind, text, weight, collapsed: false, children });

function exampleMap() {
  return node("claim", "Our city should close its centre to private cars.", 2, [
    node("reason", "It would cut air pollution where most people walk.", 3, [
      node("copremise", "Road traffic is a major source of nitrogen dioxide in city centres.", 2),
    ]),
    node("reason", "Streets would be safer for people on foot and on bikes.", 2),
    node("objection", "Shops would lose customers who drive in.", 2, [
      node("objection", "Pedestrianised streets often see more people on foot, who shop more often.", 2),
    ]),
    node("objection", "People with reduced mobility need to reach the centre by car.", 3, [
      node("reason", "Many already depend on a car or taxi to get anywhere.", 2),
    ]),
  ]);
}

const KIND = {
  claim: { label: "Claim", dot: "bg-brand", line: "border-brand" },
  reason: { label: "Reason", dot: "bg-add", line: "border-add" },
  objection: { label: "Objection", dot: "bg-del", line: "border-del" },
  copremise: { label: "Co-premise", dot: "bg-foreground/40", line: "border-foreground/30" },
};

// Toy score: weight × (1 + ¼·support below − ¼·attack below), at least 0.
function effective(n) {
  let up = 0, down = 0;
  for (const c of n.children) {
    if (c.kind === "reason") up += effective(c);
    if (c.kind === "objection") down += effective(c);
  }
  return Math.max(0, n.weight * (1 + 0.25 * up - 0.25 * down));
}

function revive(n) {
  if (!n || typeof n !== "object" || typeof n.text !== "string" || !KIND[n.kind]) return null;
  const kids = Array.isArray(n.children) ? n.children.map(revive).filter(Boolean) : [];
  const out = node(n.kind, n.text, Math.min(3, Math.max(1, Number(n.weight) || 2)), kids);
  out.collapsed = !!n.collapsed;
  return out;
}

for (const root of document.querySelectorAll("[data-argu-map]")) {
  const treeEl = root.querySelector("[data-argu-m-tree]");
  const forBar = root.querySelector("[data-argu-m-for]");
  const againstBar = root.querySelector("[data-argu-m-against]");
  const forN = root.querySelector("[data-argu-m-for-n]");
  const againstN = root.querySelector("[data-argu-m-against-n]");
  let tree = revive(store.get("map")) || exampleMap();
  let dragId = null;

  const find = (id, n = tree, parent = null) => {
    if (n.id === id) return { n, parent };
    for (const c of n.children) {
      const r = find(id, c, n);
      if (r) return r;
    }
    return null;
  };

  function save() { store.set("map", tree); }

  function render(focusId) {
    const rows = [];
    const walk = (n, depth) => {
      rows.push(row(n, depth));
      if (!n.collapsed) for (const c of n.children) walk(c, depth + 1);
    };
    walk(tree, 0);
    treeEl.replaceChildren(...rows);
    if (focusId) treeEl.querySelector(`[data-node="${focusId}"] input`)?.focus();
    score();
  }

  function row(n, depth) {
    const k = KIND[n.kind];
    // On phones the controls wrap under the text and indents shrink.
    const r = mk("div", `flex flex-wrap items-center gap-1.5 rounded-lg border-l-2 bg-background py-1 pr-1 pl-2 shadow-xs sm:flex-nowrap ${k.line} data-[over]:ring-2 data-[over]:ring-brand/40`);
    r.style.marginLeft = `calc(${Math.min(depth, 6)} * var(--argu-indent))`;
    r.dataset.node = n.id;
    r.setAttribute("role", "treeitem");
    r.setAttribute("aria-level", depth + 1);
    if (n.children.length) r.setAttribute("aria-expanded", String(!n.collapsed));

    const grip = mk("span", "hidden cursor-grab touch-none px-0.5 text-muted-foreground/60 select-none sm:inline", "⋮⋮");
    grip.setAttribute("aria-hidden", "true");
    if (depth > 0) {
      grip.addEventListener("pointerdown", () => (r.draggable = true));
      r.addEventListener("dragstart", (e) => { dragId = n.id; e.dataTransfer.effectAllowed = "move"; });
      r.addEventListener("dragend", () => { r.draggable = false; dragId = null; });
    } else grip.style.visibility = "hidden";
    r.addEventListener("dragover", (e) => {
      const a = dragId && find(dragId), b = find(n.id);
      if (a && b && a.parent && a.parent === b.parent && a.n !== b.n) { e.preventDefault(); r.dataset.over = ""; }
    });
    r.addEventListener("dragleave", () => delete r.dataset.over);
    r.addEventListener("drop", (e) => {
      e.preventDefault();
      delete r.dataset.over;
      const a = find(dragId), b = find(n.id);
      if (!a || !b || a.parent !== b.parent) return;
      const sib = a.parent.children;
      sib.splice(sib.indexOf(a.n), 1);
      sib.splice(sib.indexOf(b.n), 0, a.n);
      save(); render();
    });

    const toggle = iconButton(n.collapsed ? "Expand" : "Collapse", n.children.length ? (n.collapsed ? "▸" : "▾") : "");
    toggle.disabled = !n.children.length;
    toggle.classList.add("border-transparent", "shadow-none");
    toggle.addEventListener("click", () => { n.collapsed = !n.collapsed; save(); render(n.id); });

    const dot = mk("span", `size-2 shrink-0 rounded-full ${k.dot}`);
    dot.title = k.label;
    const input = mk("input", INPUT + " h-8 min-w-36 flex-1 basis-40 border-transparent shadow-none focus-visible:border-ring" + (n.kind === "claim" ? " font-medium" : ""));
    input.value = n.text;
    input.setAttribute("aria-label", k.label);
    input.addEventListener("input", () => { n.text = input.value; save(); });
    input.addEventListener("keydown", (e) => {
      if (!e.altKey) return;
      const f = find(n.id);
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && f.parent) {
        e.preventDefault();
        const sib = f.parent.children, i = sib.indexOf(n), j = i + (e.key === "ArrowUp" ? -1 : 1);
        if (j < 0 || j >= sib.length) return;
        [sib[i], sib[j]] = [sib[j], sib[i]];
        save(); render(n.id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        n.collapsed = e.key === "ArrowLeft" && n.children.length > 0;
        save(); render(n.id);
      }
    });

    r.append(grip, toggle, dot, input);
    if (n.kind !== "claim") {
      const w = select([[1, "w1"], [2, "w2"], [3, "w3"]], n.weight, "Weight");
      w.classList.add("w-14", "font-mono", "text-xs");
      w.addEventListener("change", () => { n.weight = Number(w.value); save(); score(); });
      r.append(w);
    }
    const add = (kind, glyph, cls) => {
      const b = iconButton(`Add ${KIND[kind].label.toLowerCase()}`, glyph, cls);
      b.addEventListener("click", () => {
        const c = node(kind, "");
        n.children.push(c);
        n.collapsed = false;
        save(); render(c.id);
      });
      return b;
    };
    r.append(add("reason", "+", "text-add"), add("objection", "−", "text-del"));
    if (n.kind !== "claim") r.append(add("copremise", "&", ""));
    if (n.kind !== "claim") {
      const del = iconButton("Delete", "×");
      del.addEventListener("click", () => {
        const f = find(n.id);
        f.parent.children.splice(f.parent.children.indexOf(n), 1);
        save(); render(f.parent.id);
      });
      r.append(del);
    }
    return r;
  }

  function score() {
    let pro = 0, con = 0;
    for (const c of tree.children) {
      if (c.kind === "reason") pro += effective(c);
      if (c.kind === "objection") con += effective(c);
    }
    const t = pro + con || 1;
    forBar.style.width = `${(100 * pro) / t}%`;
    againstBar.style.width = `${(100 * con) / t}%`;
    forN.textContent = `for ${num(pro, 1)}`;
    againstN.textContent = `against ${num(con, 1)}`;
    const md = [];
    const walk = (n, d) => {
      const tag = n.kind === "claim" ? "Claim" : n.kind === "reason" ? "For" : n.kind === "objection" ? "Against" : "And";
      md.push(`${"  ".repeat(d)}- **${tag}**${n.kind === "claim" ? "" : ` (w${n.weight})`}: ${n.text || "…"}`);
      for (const c of n.children) walk(c, d + 1);
    };
    walk(tree, 0);
    setCopy(root, md.join("\n"));
  }

  root.querySelectorAll("[data-argu-m-action]").forEach((b) =>
    b.addEventListener("click", () => {
      tree = b.dataset.arguMAction === "reset" ? exampleMap() : node("claim", "");
      save();
      render(tree.id);
    }));
  render();
}

// ============================================================ Steelman

for (const root of document.querySelectorAll("[data-argu-steelman]")) {
  const flags = Object.fromEntries([...root.querySelectorAll("[data-argu-s-flags]")].map((f) => [f.dataset.arguSFlags, f]));
  const out = root.querySelector("[data-argu-s-score]");
  const boxes = [...root.querySelectorAll("[data-argu-s-check]")];
  const fields = persistFields(root, "steelman", update);

  function update() {
    for (const k of ["straw", "steel"]) flagChips(flags[k], loadedIn(fields[k].value));
    const ticked = boxes.filter((b) => b.dataset.state === "checked").length;
    const loaded = loadedIn(fields.steel.value).length;
    out.textContent = `${ticked} of ${boxes.length} checks · ${loaded} loaded word${loaded === 1 ? "" : "s"} in the steelman`;
    setCopy(root, `**First draft:** ${fields.straw.value.trim()}\n\n**Steelman:** ${fields.steel.value.trim()}`);
  }
  new MutationObserver(update).observe(root, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
  update();
}

// ============================================================ Evidence grader

const ETYPES = [["anecdote", "Anecdote", 1], ["expert", "Expert opinion", 2], ["observational", "Observational study", 3], ["rct", "Randomised trial", 4], ["review", "Systematic review", 5]];
const ETYPE = Object.fromEntries(ETYPES.map(([k, t, w]) => [k, { t, w }]));
const RELEVANCE = { low: 0.4, medium: 0.7, high: 1 };
const RECENCY = { old: 0.75, recent: 1 };

const exampleEvidence = () => [
  { text: "A friend says running lifted her low mood.", type: "anecdote", rel: "high", rec: "recent", ind: true },
  { text: "A psychiatrist recommends exercise in a newspaper column.", type: "expert", rel: "medium", rec: "recent", ind: true },
  { text: "A large cohort study: people who were more active had fewer depressive episodes.", type: "observational", rel: "high", rec: "recent", ind: true },
  { text: "A meta-analysis of randomised trials of exercise for depressive symptoms.", type: "review", rel: "high", rec: "recent", ind: true },
];

for (const root of document.querySelectorAll("[data-argu-evidence]")) {
  const rowsEl = root.querySelector("[data-argu-e-rows]");
  const level = root.querySelector("[data-argu-e-level]");
  const scoreEl = root.querySelector("[data-argu-e-score]");
  const why = root.querySelector("[data-argu-e-why]");
  let items = store.get("evidence");
  if (!Array.isArray(items)) items = exampleEvidence();
  const save = () => store.set("evidence", items);

  const itemScore = (it) => (ETYPE[it.type]?.w ?? 1) * (RELEVANCE[it.rel] ?? 0.7) * (RECENCY[it.rec] ?? 1) * (it.ind ? 1 : 0.5);

  function render() {
    rowsEl.replaceChildren(...items.map((it, i) => {
      const r = mk("div", "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border bg-background p-2 shadow-xs sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]");
      const t = mk("input", INPUT + " col-span-2 sm:col-span-1");
      t.value = it.text;
      t.placeholder = "Describe the evidence";
      t.setAttribute("aria-label", "Evidence");
      t.addEventListener("input", () => { it.text = t.value; save(); });
      const type = select(ETYPES.map(([k, txt]) => [k, txt]), it.type, "Kind of evidence");
      const rel = select([["low", "low relevance"], ["medium", "relevant"], ["high", "directly relevant"]], it.rel, "Relevance");
      const rec = select([["old", "dated"], ["recent", "recent"]], it.rec, "Recency");
      // On phones the selects share two columns and must be allowed to shrink.
      for (const s of [type, rel, rec]) s.classList.add("min-w-0", "w-full", "sm:w-auto");
      const indL = mk("label", "flex items-center gap-1.5 text-xs text-muted-foreground");
      const ind = mk("input", "size-4 accent-[var(--brand)]");
      ind.type = "checkbox";
      ind.checked = it.ind;
      indL.append(ind, document.createTextNode("independent"));
      const del = iconButton("Remove", "×");
      for (const [elx, key] of [[type, "type"], [rel, "rel"], [rec, "rec"]]) elx.addEventListener("change", () => { it[key] = elx.value; save(); update(); });
      ind.addEventListener("change", () => { it.ind = ind.checked; save(); update(); });
      del.addEventListener("click", () => { items.splice(i, 1); save(); render(); });
      r.append(t, type, rel, rec, indL, del);
      return r;
    }));
    update();
  }

  function update() {
    const scored = items.map((it) => ({ it, s: itemScore(it) })).sort((a, b) => b.s - a.s);
    // Diminishing returns: each further piece counts 60% of the one before.
    const total = scored.reduce((a, { s }, k) => a + s * 0.6 ** k, 0);
    const lv = total === 0 ? "None" : total < 2 ? "Weak" : total < 4 ? "Moderate" : total < 6.5 ? "Strong" : "Very strong";
    level.textContent = lv;
    level.className = "text-2xl font-semibold tracking-tight " + (total >= 4 ? "text-add" : total >= 2 ? "" : "text-del");
    scoreEl.textContent = items.length ? `score ${num(total, 1)} / 12.5` : "";
    const reasons = [];
    if (!items.length) reasons.push("No evidence yet.");
    else {
      const best = scored[0].it;
      reasons.push(`Strongest: ${ETYPE[best.type].t.toLowerCase()}${best.text ? ` (“${best.text.slice(0, 60)}${best.text.length > 60 ? "…" : ""}”)` : ""}.`);
      const top = Math.max(...items.map((it) => ETYPE[it.type].w));
      if (top <= 2) reasons.push("Only anecdotes or opinions: look for a study.");
      else if (top === 3) reasons.push("Best is observational: it shows association, not necessarily cause.");
      const dep = items.filter((it) => !it.ind).length;
      if (dep) reasons.push(`${dep} piece${dep > 1 ? "s" : ""} not independent: counted at half weight.`);
      const low = items.filter((it) => it.rel === "low").length;
      if (low) reasons.push(`${low} piece${low > 1 ? "s" : ""} of low relevance to the claim.`);
      if (items.length > 1) reasons.push("Each extra piece adds less than the one before it.");
    }
    why.replaceChildren(...reasons.map((t) => mk("li", "", t)));
  }

  root.querySelector('[data-argu-e-action="add"]').addEventListener("click", () => {
    items.push({ text: "", type: "observational", rel: "medium", rec: "recent", ind: true });
    save(); render();
    rowsEl.lastElementChild?.querySelector("input")?.focus();
  });
  root.querySelector('[data-argu-e-action="reset"]').addEventListener("click", () => { items = exampleEvidence(); save(); render(); });
  render();
}

// ============================================================ Belief updater

const LR_PRESETS = [[10, "strong for ×10"], [3, "moderate for ×3"], [1.5, "weak for ×1.5"], [1, "neutral ×1"], [1 / 1.5, "weak against ÷1.5"], [1 / 3, "moderate against ÷3"], [0.1, "strong against ÷10"]];

for (const root of document.querySelectorAll("[data-argu-bayes]")) {
  const svg = root.querySelector("[data-argu-b-bar]");
  const rowsEl = root.querySelector("[data-argu-b-rows]");
  const warn = root.querySelector("[data-argu-b-warn]");
  const out = Object.fromEntries([...root.querySelectorAll("[data-argu-b-out]")].map((n) => [n.dataset.arguBOut, n]));
  let items = [{ label: "A reliable witness says it happened", lr: 10, same: false }];
  const s = scrubAll(root, update);

  function render() {
    rowsEl.replaceChildren(...items.map((it, i) => {
      const r = mk("div", "flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2 shadow-xs");
      const t = mk("input", INPUT + " min-w-40 flex-1");
      t.value = it.label;
      t.placeholder = "What did you learn?";
      t.setAttribute("aria-label", "Evidence");
      t.addEventListener("input", () => (it.label = t.value));
      const nearest = LR_PRESETS.reduce((a, p) => (Math.abs(Math.log(p[0] / it.lr)) < Math.abs(Math.log(a[0] / it.lr)) ? p : a));
      const lr = select(LR_PRESETS.map(([v, txt]) => [v, txt]), nearest[0], "Likelihood ratio");
      lr.addEventListener("change", () => { it.lr = Number(lr.value); update(); });
      const sameL = mk("label", "flex items-center gap-1.5 text-xs text-muted-foreground");
      const same = mk("input", "size-4 accent-[var(--brand)]");
      same.type = "checkbox";
      same.checked = it.same;
      same.disabled = i === 0;
      sameL.append(same, document.createTextNode("same source as above"));
      same.addEventListener("change", () => { it.same = same.checked; update(); });
      const del = iconButton("Remove", "×");
      del.addEventListener("click", () => { items.splice(i, 1); render(); });
      r.append(t, lr, sameL, del);
      return r;
    }));
    update();
  }

  function update() {
    const p = s.prior.get() / 100;
    const prior = p / (1 - p);
    const lr = items.reduce((a, it) => a * it.lr, 1);
    const odds = prior * lr;
    const post = odds / (1 + odds);
    const fmtOdds = (o) => (o >= 1 ? `${num(o, o < 10 ? 2 : 1)} : 1` : `1 : ${num(1 / o, 1 / o < 10 ? 2 : 1)}`);
    out.prior.textContent = fmtOdds(prior);
    out.lr.textContent = `× ${lr >= 1 ? num(lr, 2) : "1/" + num(1 / lr, 2)}`;
    out.odds.textContent = fmtOdds(odds);
    out.post.textContent = `${num(post * 100, 1)}%`;
    const dup = items.filter((it) => it.same).length;
    warn.replaceChildren();
    if (dup) warn.append(mk("p", "rounded-lg border border-vec-out/40 bg-vec-out/10 p-2.5 text-xs leading-relaxed", `${dup} piece${dup > 1 ? "s are" : " is"} marked as the same source as the one above, yet still multiplied in. Correlated evidence counts roughly once: remove the duplicates, or combine them into a single, weaker ratio.`));
    if (items.length >= 5) warn.append(mk("p", "mt-2 text-xs text-muted-foreground", "Five or more pieces: check that none of them share a cause or a source."));
    drawBar(Math.log10(prior), items.map((it) => Math.log10(it.lr)), Math.log10(odds));
  }

  // Log-odds axis from 0.1% to 99.9%: every factor of 10 is the same length.
  function drawBar(lp, steps, lpost) {
    svg.replaceChildren();
    const L = 30, R = 610, lo = -3, hi = 3;
    const x = (v) => L + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (R - L);
    const y = 62;
    svgEl("line", { x1: L, x2: R, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.2;stroke-width:6;stroke-linecap:round" }, svg);
    for (const pr of [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999]) {
      const v = Math.log10(pr / (1 - pr));
      svgEl("line", { x1: x(v), x2: x(v), y1: y + 6, y2: y + 11, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
      svgText(svg, x(v), y + 24, `${pr * 100}%`, { "text-anchor": "middle" });
    }
    svgText(svg, L, 14, "probability (log-odds scale)");
    // The path of belief: one arrow per piece of evidence.
    let cur = lp;
    const ys = 40;
    steps.forEach((st, i) => {
      const a = x(cur), b = x(cur + st);
      const c = st >= 0 ? "var(--brand)" : "var(--code-del)";
      const yy = ys - (i % 3) * 7;
      svgEl("line", { x1: a, x2: b, y1: yy, y2: yy, style: `stroke:${c};stroke-width:2;stroke-linecap:round` }, svg);
      if (Math.abs(b - a) > 6) svgEl("path", { d: `M${b - Math.sign(b - a) * 6} ${yy - 4} L${b} ${yy} L${b - Math.sign(b - a) * 6} ${yy + 4}`, style: `fill:none;stroke:${c};stroke-width:2` }, svg);
      cur += st;
    });
    svgEl("circle", { cx: x(lp), cy: y, r: 6, style: "fill:var(--background);stroke:var(--foreground);stroke-width:2" }, svg);
    svgEl("circle", { cx: x(lpost), cy: y, r: 7, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    svgText(svg, x(lp), y + 40, "prior", { "text-anchor": "middle" });
    svgText(svg, x(lpost), y + 40, "posterior", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
  }

  root.querySelectorAll("[data-argu-b-add]").forEach((b) =>
    b.addEventListener("click", () => {
      items.push({ label: "", lr: Number(b.dataset.arguBAdd), same: false });
      render();
      rowsEl.lastElementChild?.querySelector("input")?.focus();
    }));
  render();
}

// ============================================================ Debate flow

const FORMATS = {
  simple: {
    note: "Simple two-sided format; durations are editable.",
    speeches: [
      { name: "Affirmative constructive", side: "aff", min: 6 },
      { name: "Negative constructive", side: "neg", min: 6 },
      { name: "Affirmative rebuttal", side: "aff", min: 4 },
      { name: "Negative rebuttal", side: "neg", min: 4 },
    ],
    protectedMin: 0,
  },
  bp: {
    note: "British Parliamentary: 7 minutes each; points of information only between 1:00 and 6:00.",
    speeches: [
      ["Prime Minister", "OG"], ["Leader of the Opposition", "OO"], ["Deputy Prime Minister", "OG"], ["Deputy Leader of the Opposition", "OO"],
      ["Member of the Government", "CG"], ["Member of the Opposition", "CO"], ["Government Whip", "CG"], ["Opposition Whip", "CO"],
    ].map(([name, team]) => ({ name, team, side: team.endsWith("G") ? "aff" : "neg", min: 7 })),
    protectedMin: 1,
  },
};
const MARKS = ["", "answered", "extended", "dropped"];
const MARK_GLYPH = { "": "·", answered: "↳", extended: "→", dropped: "✕" };

for (const root of document.querySelectorAll("[data-argu-debate]")) {
  const sheet = root.querySelector("[data-argu-d-sheet]");
  const clock = root.querySelector("[data-argu-d-clock]");
  const phase = root.querySelector("[data-argu-d-phase]");
  const speechLabel = root.querySelector("[data-argu-d-speech]");
  const timeBtn = root.querySelector('[data-argu-d-action="time"]');
  let fmt = "simple";
  let flows = { simple: newFlow("simple"), bp: newFlow("bp") };
  const saved = store.get("flow");
  if (saved && saved.simple && saved.bp) flows = saved;
  let current = 0, startAt = 0, elapsed = 0, timer = 0;

  function newFlow(f) {
    const n = FORMATS[f].speeches.length;
    return { mins: FORMATS[f].speeches.map((s) => s.min), rows: [
      { cells: Array.from({ length: n }, (_, i) => ({ text: i === 0 ? "Main argument 1" : "", mark: "" })) },
      { cells: Array.from({ length: n }, () => ({ text: "", mark: "" })) },
    ] };
  }
  const save = () => store.set("flow", flows);

  function render() {
    const F = FORMATS[fmt], flow = flows[fmt];
    const head = mk("tr");
    head.append(mk("th", "w-8 border-b p-2"));
    F.speeches.forEach((sp, i) => {
      const th = mk("th", "border-b border-l p-2 text-left align-top font-normal " + (i === current ? "bg-brand/8" : ""));
      const side = mk("span", "mb-1 flex items-center gap-1.5 text-[10px] tracking-wider uppercase text-muted-foreground");
      side.append(mk("span", "size-1.5 rounded-full " + (sp.side === "aff" ? "bg-vec-u" : "bg-ion-k")), document.createTextNode(sp.team ?? (sp.side === "aff" ? "Affirmative" : "Negative")));
      th.append(side, mk("span", "block text-xs " + (i === current ? "font-medium text-brand" : "font-medium"), sp.name));
      if (fmt === "simple") {
        const m = mk("input", "mt-1 h-6 w-12 rounded border border-input bg-background px-1 text-right font-mono text-base tabular-nums md:text-xs");
        m.type = "number"; m.min = "1"; m.max = "20"; m.value = flow.mins[i];
        m.setAttribute("aria-label", `${sp.name} minutes`);
        m.addEventListener("change", () => { flow.mins[i] = Math.max(1, Math.min(20, Number(m.value) || sp.min)); save(); tick(); });
        const wrap = mk("span", "flex items-center gap-1 text-[11px] text-muted-foreground");
        wrap.append(m, document.createTextNode("min"));
        th.append(wrap);
      } else th.append(mk("span", "font-mono text-[11px] text-muted-foreground", `${flow.mins[i]} min`));
      head.append(th);
    });
    const body = flow.rows.map((rw, ri) => {
      const tr = mk("tr");
      const del = iconButton("Remove argument", "×", "size-6 border-transparent shadow-none");
      del.addEventListener("click", () => { flow.rows.splice(ri, 1); save(); render(); });
      const td0 = mk("td", "border-t p-1 align-top");
      td0.append(del);
      tr.append(td0);
      rw.cells.forEach((c, ci) => {
        const td = mk("td", "border-t border-l p-1 align-top " + (ci === current ? "bg-brand/5" : ""));
        const wrap = mk("div", "flex items-start gap-1");
        const mark = mk("button", "mt-1 w-5 shrink-0 rounded font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 " + (c.mark === "dropped" ? "text-del" : c.mark === "extended" ? "text-add" : c.mark === "answered" ? "text-[var(--vec-u)]" : "text-muted-foreground/50"), MARK_GLYPH[c.mark]);
        mark.type = "button";
        mark.title = mark.ariaLabel = c.mark ? `Marked ${c.mark}` : "Unmarked";
        mark.addEventListener("click", () => { c.mark = MARKS[(MARKS.indexOf(c.mark) + 1) % MARKS.length]; save(); render(); });
        const t = mk("textarea", "field-sizing-content min-h-8 w-full min-w-0 resize-none rounded border border-transparent bg-transparent px-1 py-1 text-base outline-none focus-visible:border-ring md:text-xs" + (c.mark === "dropped" ? " text-muted-foreground line-through" : ""));
        t.value = c.text;
        t.setAttribute("aria-label", `${F.speeches[ci].name}, argument ${ri + 1}`);
        t.addEventListener("input", () => { c.text = t.value; save(); copy(); });
        wrap.append(mark, t);
        td.append(wrap);
        tr.append(td);
      });
      return tr;
    });
    const thead = mk("thead"), tbody = mk("tbody");
    thead.append(head);
    tbody.append(...body);
    sheet.replaceChildren(thead, tbody);
    speechLabel.textContent = F.speeches[current].name;
    root.querySelector("[data-argu-d-note]").textContent = `${F.note} Click a cell's mark to cycle: answered → extended → dropped.`;
    copy();
  }

  function copy() {
    const F = FORMATS[fmt], flow = flows[fmt];
    const esc = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const lines = [`| ${F.speeches.map((s) => s.name).join(" | ")} |`, `|${F.speeches.map(() => " --- ").join("|")}|`];
    for (const r of flow.rows) lines.push(`| ${r.cells.map((c) => `${c.mark ? `(${c.mark}) ` : ""}${esc(c.text)}`).join(" | ")} |`);
    setCopy(root, lines.join("\n"));
  }

  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${s < 0 ? "−" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
  };

  function tick() {
    const ms = elapsed + (timer ? performance.now() - startAt : 0);
    const limit = flows[fmt].mins[current] * 60000;
    const prot = FORMATS[fmt].protectedMin * 60000;
    clock.textContent = fmtTime(ms);
    let p = "speaking", cls = "";
    if (ms >= limit) { p = "time"; cls = "border-del/50 bg-del/10 text-del"; }
    else if (prot && (ms < prot || ms >= limit - prot)) { p = "protected"; cls = "border-vec-out/50 bg-vec-out/10"; }
    else if (prot) { p = "POIs open"; cls = "border-add/50 bg-add/10 text-add"; }
    if (!timer && ms === 0) { p = "ready"; cls = ""; }
    phase.textContent = p;
    phase.className = "w-28 rounded-full border px-2 py-0.5 text-center text-[11px] text-muted-foreground " + cls;
    clock.className = "font-mono text-2xl font-medium tabular-nums " + (ms >= limit ? "text-del" : "");
  }

  function setRunning(on) {
    if (on && !timer) { startAt = performance.now(); timer = setInterval(tick, 200); }
    if (!on && timer) { elapsed += performance.now() - startAt; clearInterval(timer); timer = 0; }
    timeBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    timeBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    timeBtn.querySelector("[data-label]").textContent = on ? "Pause" : elapsed ? "Resume" : "Start";
    tick();
  }
  const resetTimer = () => { setRunning(false); elapsed = 0; setRunning(false); };

  timeBtn.addEventListener("click", () => setRunning(!timer));
  root.querySelector('[data-argu-d-action="reset"]').addEventListener("click", resetTimer);
  root.querySelector('[data-argu-d-action="next"]').addEventListener("click", () => {
    current = (current + 1) % FORMATS[fmt].speeches.length;
    resetTimer();
    render();
  });
  root.querySelector('[data-argu-d-action="row"]').addEventListener("click", () => {
    flows[fmt].rows.push({ cells: FORMATS[fmt].speeches.map(() => ({ text: "", mark: "" })) });
    save(); render();
  });
  root.addEventListener("seg-change", (e) => {
    fmt = e.detail.value;
    current = 0;
    resetTimer();
    render();
  });
  render();
  tick();
}

// ============================================================ CER

for (const root of document.querySelectorAll("[data-argu-cer]")) {
  const out = root.querySelector("[data-argu-c-out]");
  const prompts = root.querySelector("[data-argu-c-prompts]");
  let mode = "plain";
  const f = persistFields(root, "cer", update);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; update(); });

  const words = (s) => new Set((s.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).filter((w) => !STOP.has(w)));

  function update() {
    const c = f.claim.value.trim(), e = f.evidence.value.trim(), r = f.reasoning.value.trim();
    const join = {
      plain: [sentence(c), e && "For example, " + sentence(lcFirst(e)), r && "This matters because " + sentence(lcFirst(r))],
      formal: [sentence(c), e && "This is supported by the following evidence: " + sentence(lcFirst(e)), r && "The evidence supports the claim because " + sentence(lcFirst(r))],
      none: [sentence(c), sentence(e), sentence(r)],
    }[mode];
    const para = join.filter(Boolean).join(" ");
    out.textContent = para || "Write the three parts above.";
    setCopy(root, para);

    const sentences = (c.match(/[.!?](\s|$)/g) || []).length;
    const ev = words(e), cl = words(c), re = words(r);
    const overlap = re.size ? [...re].filter((w) => ev.has(w)).length / re.size : 0;
    const items = [
      [!!c && sentences <= 1, "The claim is a single sentence."],
      [!!c && !/^(i think|i believe|i feel|in my opinion)\b/i.test(c), "The claim stands on its own: no “I think” needed."],
      [/\d|according to|study|data|survey|measured|observed|source/i.test(e), "The evidence is specific: a number, an observation or a source."],
      [[...cl].some((w) => ev.has(w)), "The evidence talks about the same thing as the claim."],
      [/\b(because|since|therefore|so|which means|explains|causes?|due to|principle)\b/i.test(r), "The reasoning names a principle or a mechanism."],
      [!!r && overlap < 0.6, "The reasoning explains the evidence instead of repeating it."],
    ];
    prompts.replaceChildren(...items.map(([ok, t]) => checkItem(ok, t, !ok)));
  }
  update();
}


// ============================================================ Decision matrix

const exampleDecision = () => ({
  options: ["Flat near campus", "Live with family", "Shared house"],
  criteria: [{ name: "Cost", w: 8 }, { name: "Commute", w: 5 }, { name: "Independence", w: 4 }, { name: "Quiet to study", w: 6 }],
  scores: [[2, 5, 3], [5, 2, 4], [4, 2, 4], [4, 4, 2]], // [criterion][option], 1–5
});

for (const root of document.querySelectorAll("[data-argu-decision]")) {
  const table = root.querySelector("[data-argu-x-table]");
  const rank = root.querySelector("[data-argu-x-rank]");
  const sens = root.querySelector("[data-argu-x-sens]");
  let d = store.get("decision");
  if (!d || !Array.isArray(d.options) || !Array.isArray(d.criteria)) d = exampleDecision();
  const save = () => store.set("decision", d);

  const totals = (w = d.criteria.map((c) => c.w)) => {
    const W = w.reduce((a, b) => a + b, 0) || 1;
    return d.options.map((_, o) => d.criteria.reduce((a, _, c) => a + w[c] * d.scores[c][o], 0) / (5 * W));
  };
  const winnerOf = (t) => t.indexOf(Math.max(...t));

  function render() {
    const head = mk("tr");
    head.append(mk("th", "p-2 text-left text-xs font-normal text-muted-foreground", "Criterion"), mk("th", "p-2 text-left text-xs font-normal text-muted-foreground", "Weight"));
    d.options.forEach((name, o) => {
      const th = mk("th", "p-1.5 text-left align-bottom font-normal");
      const wrap = mk("div", "flex items-center gap-1");
      const inp = mk("input", INPUT + " font-medium");
      inp.value = name;
      inp.setAttribute("aria-label", `Option ${o + 1}`);
      inp.addEventListener("input", () => { d.options[o] = inp.value; save(); summary(); });
      wrap.append(inp);
      if (d.options.length > 2) {
        const del = iconButton("Remove option", "×", "size-6");
        del.addEventListener("click", () => { d.options.splice(o, 1); d.scores.forEach((r) => r.splice(o, 1)); save(); render(); });
        wrap.append(del);
      }
      th.append(wrap);
      head.append(th);
    });
    const rows = d.criteria.map((cr, c) => {
      const tr = mk("tr", "border-t");
      const td = mk("td", "p-1.5");
      const wrap = mk("div", "flex items-center gap-1");
      const name = mk("input", INPUT);
      name.value = cr.name;
      name.setAttribute("aria-label", `Criterion ${c + 1}`);
      name.addEventListener("input", () => { cr.name = name.value; save(); summary(); });
      wrap.append(name);
      if (d.criteria.length > 1) {
        const del = iconButton("Remove criterion", "×", "size-6");
        del.addEventListener("click", () => { d.criteria.splice(c, 1); d.scores.splice(c, 1); save(); render(); });
        wrap.append(del);
      }
      td.append(wrap);
      const wtd = mk("td", "p-1.5");
      const w = mk("input", INPUT + " w-16 text-right font-mono tabular-nums");
      w.type = "number"; w.min = "0"; w.max = "10"; w.step = "1"; w.value = cr.w;
      w.setAttribute("aria-label", `Weight of ${cr.name}`);
      w.addEventListener("input", () => { cr.w = Math.max(0, Math.min(10, Number(w.value) || 0)); save(); summary(); });
      wtd.append(w);
      tr.append(td, wtd);
      d.options.forEach((_, o) => {
        const s = select([1, 2, 3, 4, 5].map((v) => [v, String(v)]), d.scores[c][o], `${cr.name} score for ${d.options[o]}`);
        s.classList.add("w-full", "font-mono");
        s.addEventListener("change", () => { d.scores[c][o] = Number(s.value); save(); summary(); });
        const std = mk("td", "p-1.5");
        std.append(s);
        tr.append(std);
      });
      return tr;
    });
    const foot = mk("tr", "border-t");
    foot.append(mk("td", "p-2 text-xs text-muted-foreground", "Weighted score"), mk("td"));
    d.options.forEach(() => foot.append(mk("td", "p-2 font-mono text-sm tabular-nums")));
    const thead = mk("thead"), tbody = mk("tbody"), tfoot = mk("tfoot");
    thead.append(head); tbody.append(...rows); tfoot.append(foot);
    table.replaceChildren(thead, tbody, tfoot);
    summary();
  }

  function summary() {
    const t = totals();
    const win = winnerOf(t);
    const cells = table.querySelectorAll("tfoot td");
    t.forEach((v, o) => {
      const c = cells[o + 2];
      c.textContent = `${num(v * 100, 0)}%`;
      c.className = "p-2 font-mono text-sm tabular-nums " + (o === win ? "font-semibold text-brand" : "");
    });
    const order = t.map((v, o) => [v, o]).sort((a, b) => b[0] - a[0]);
    rank.replaceChildren(...order.map(([v, o], k) => {
      const li = mk("li", "flex flex-col gap-1");
      const top = mk("div", "flex items-baseline justify-between gap-2 text-sm");
      top.append(mk("span", k === 0 ? "font-medium text-brand" : "", `${k + 1}. ${d.options[o] || "Option"}`), mk("span", "font-mono text-xs tabular-nums", `${num(v * 100, 0)}%`));
      const bar = mk("div", "h-1.5 overflow-hidden rounded-full bg-foreground/10");
      const fill = mk("div", "h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out)] " + (k === 0 ? "bg-brand" : "bg-foreground/40"));
      fill.style.width = `${v * 100}%`;
      bar.append(fill);
      li.append(top, bar);
      return li;
    }));

    // Sensitivity: change one weight, keep the others; the winner changes
    // where two options' weighted sums cross (the denominator is shared).
    const w = d.criteria.map((c) => c.w);
    const lines = [];
    let closest = null;
    d.criteria.forEach((cr, c) => {
      const cands = [];
      d.options.forEach((_, b) => {
        if (b === win) return;
        const sA = d.scores[c][win], sB = d.scores[c][b];
        if (sA === sB) return;
        const rest = (o) => d.criteria.reduce((a, _, k) => a + (k === c ? 0 : w[k] * d.scores[k][o]), 0);
        const ws = (rest(b) - rest(win)) / (sA - sB);
        if (ws >= 0 && ws <= 10 && Math.abs(ws - w[c]) > 1e-9) cands.push(ws);
      });
      // Of the crossings, the nearest one where someone else really leads.
      cands.sort((a, b) => Math.abs(a - w[c]) - Math.abs(b - w[c]));
      let found = null;
      for (const ws of cands) {
        const probe = ws + (ws > w[c] ? 0.01 : -0.01);
        if (probe < 0 || probe > 10) continue;
        const ww = w.slice(); ww[c] = probe;
        const nw = winnerOf(totals(ww));
        if (nw !== win) { found = { ws, nw }; break; }
      }
      if (found) {
        const dir = found.ws > w[c] ? "rises above" : "drops below";
        lines.push([Math.abs(found.ws - w[c]), `${cr.name || "Criterion"}: ${d.options[found.nw] || "another option"} wins if its weight ${dir} ${num(found.ws, 1)} (now ${w[c]}).`]);
        if (!closest || Math.abs(found.ws - w[c]) < closest) closest = Math.abs(found.ws - w[c]);
      } else lines.push([Infinity, `${cr.name || "Criterion"}: no weight from 0 to 10 changes the winner.`]);
    });
    lines.sort((a, b) => a[0] - b[0]);
    sens.replaceChildren(...lines.map(([dist, t], k) => mk("li", k === 0 && Number.isFinite(dist) ? "text-foreground" : "", t)));
  }

  root.querySelectorAll("[data-argu-x-action]").forEach((b) =>
    b.addEventListener("click", () => {
      const a = b.dataset.arguXAction;
      if (a === "reset") d = exampleDecision();
      if (a === "option") { d.options.push(`Option ${d.options.length + 1}`); d.scores.forEach((r) => r.push(3)); }
      if (a === "criterion") { d.criteria.push({ name: "New criterion", w: 5 }); d.scores.push(d.options.map(() => 3)); }
      save(); render();
    }));
  render();
}

// ============================================================ Socratic questions

const SOCRATIC = [
  ["Clarification", ["What exactly do you mean by {c}?", "Can you give an example of {c}?", "How would you put {c} in other words?", "Which part of {c} matters most to you?"]],
  ["Assumptions", ["What are you taking for granted when you say {c}?", "Is {c} always true, or only under some conditions?", "What would have to be true for {c} to hold?", "Why would someone accept {c} without evidence?"]],
  ["Reasons and evidence", ["What evidence supports {c}?", "How do you know {c}?", "What would change your mind about {c}?", "Is the evidence for {c} strong enough to act on?"]],
  ["Viewpoints", ["How would someone who disagrees describe {c}?", "Who gains and who loses if {c} is true?", "What is the strongest objection to {c}?", "Why might a reasonable person reject {c}?"]],
  ["Implications", ["If {c} is true, what follows?", "What would we do differently if {c}?", "What are the unintended consequences of acting on {c}?", "How does {c} fit with what we already know?"]],
  ["The question itself", ["Why does it matter whether {c}?", "Is {c} the right question to ask?", "What question should we answer before {c}?", "How would we recognise a good answer about {c}?"]],
];

for (const root of document.querySelectorAll("[data-argu-socratic]")) {
  const claim = root.querySelector("[data-argu-q-claim]");
  const list = root.querySelector("[data-argu-q-list]");
  let pick = SOCRATIC.map(() => 0);
  const saved = store.get("socratic");
  if (typeof saved === "string") claim.value = saved;

  function render() {
    const c = claim.value.trim().replace(/[.?!]+$/, "") || "this claim";
    const q = SOCRATIC.map(([cat, t], i) => [cat, t[pick[i] % t.length].replace("{c}", `“${c}”`)]);
    list.replaceChildren(...q.map(([cat, text]) => {
      const card = mk("div", "enter flex flex-col gap-1 rounded-lg border bg-code p-3");
      card.append(mk("span", "font-mono text-[10px] tracking-wider text-muted-foreground uppercase", cat), mk("span", "text-sm leading-relaxed", text));
      return card;
    }));
    setCopy(root, q.map(([cat, text]) => `- **${cat}:** ${text}`).join("\n"));
  }
  claim.addEventListener("input", () => { store.set("socratic", claim.value); render(); });
  root.querySelector('[data-argu-q-action="shuffle"]').addEventListener("click", () => {
    pick = pick.map((p, i) => p + 1 + Math.floor(Math.random() * (SOCRATIC[i][1].length - 1)));
    render();
  });
  render();
}

// ============================================================ Rogerian

for (const root of document.querySelectorAll("[data-argu-rogerian]")) {
  const flags = Object.fromEntries([...root.querySelectorAll("[data-argu-r-flags]")].map((f) => [f.dataset.arguRFlags, f]));
  const tone = root.querySelector("[data-argu-r-tone]");
  const heads = { problem: "The problem", theirs: "Their position, and where it holds", mine: "My position, and where it holds", common: "Common ground and a proposal" };
  const f = persistFields(root, "rogerian", update);

  function update() {
    let total = 0;
    for (const k in flags) {
      const w = loadedIn(f[k].value);
      total += w.length;
      flagChips(flags[k], w);
    }
    tone.textContent = total ? `${total} word${total > 1 ? "s" : ""} to reconsider: a Rogerian argument keeps a neutral tone.` : "Tone check: no loaded or absolute words found.";
    tone.className = "text-xs " + (total ? "text-foreground" : "text-muted-foreground");
    setCopy(root, Object.entries(heads).map(([k, h]) => `### ${h}\n\n${f[k].value.trim()}`).join("\n\n"));
  }
  update();
}
