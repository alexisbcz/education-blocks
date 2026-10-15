// Accessibility blocks: every demo is built from the live DOM, and every
// piece of user text goes through textContent (never innerHTML).

import { scrubAll } from "./scrub.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => [...root.querySelectorAll(sel)];
const NS = "http://www.w3.org/2000/svg";

function li(text, cls = "") {
  const el = document.createElement("li");
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
const visible = (el) => !el.closest("[hidden]");

// ---------------------------------------------------------- versions

// Broken/Fixed toggle buttons: aria-pressed, and the matching
// [data-a11y-version] panels shown inside the same block.
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a11y-pick]");
  if (!b) return;
  const scope = b.closest("[data-block]");
  if (!scope) return;
  const v = b.dataset.a11yPick;
  for (const x of $$(b.parentElement, "[data-a11y-pick]")) x.setAttribute("aria-pressed", String(x === b));
  for (const p of $$(scope, "[data-a11y-version]")) p.hidden = p.dataset.a11yVersion !== v;
  scope.dispatchEvent(new CustomEvent("a11y-version", { detail: { value: v } }));
});

// ---------------------------------------------------------- names and roles

// A simplified accessible-name computation (AccName 1.2 order for the
// cases used here): aria-labelledby, aria-label, native label / alt /
// content, title, then placeholder as a last resort.
function nameOf(el) {
  const doc = el.ownerDocument;
  const ids = el.getAttribute("aria-labelledby");
  if (ids) {
    const t = ids.split(/\s+/).map((id) => doc.getElementById(id)?.textContent.trim() ?? "").join(" ").trim();
    if (t) return { name: t, from: "aria-labelledby" };
  }
  const al = el.getAttribute("aria-label");
  if (al && al.trim()) return { name: al.trim(), from: "aria-label" };
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") {
    let label = el.id ? doc.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    label ??= el.closest("label");
    if (label) {
      const t = [...label.childNodes].filter((n) => n !== el && !(n.nodeType === 1 && n.matches?.("input,select,textarea"))).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
      if (t) return { name: t, from: "label" };
    }
  } else if (tag === "img") {
    if (el.hasAttribute("alt")) return { name: el.getAttribute("alt"), from: "alt" };
  } else if (/^(a|button|h[1-6])$/.test(tag) || el.getAttribute("role")) {
    const t = el.textContent.replace(/\s+/g, " ").trim();
    if (t) return { name: t, from: "content" };
  }
  const title = el.getAttribute("title");
  if (title) return { name: title, from: "title" };
  const ph = el.getAttribute("placeholder");
  if (ph) return { name: ph, from: "placeholder" };
  return { name: "", from: "none" };
}

function roleOf(el) {
  const r = el.getAttribute("role");
  if (r) return r === "heading" ? `heading level ${el.getAttribute("aria-level") || 2}` : r;
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return `heading level ${tag[1]}`;
  if (tag === "a") return el.hasAttribute("href") ? "link" : "generic";
  if (tag === "button") return "button";
  if (tag === "img") return el.getAttribute("alt") === "" ? "presentation" : "img";
  if (tag === "form") return el.hasAttribute("aria-labelledby") || el.hasAttribute("aria-label") ? "form" : "generic";
  if (tag === "input") return { checkbox: "checkbox", radio: "radio", range: "slider", button: "button", submit: "button" }[el.type] ?? "textbox";
  if (tag === "nav") return "navigation";
  if (tag === "section") return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") ? "region" : "generic";
  if (tag === "article") return "article";
  return "generic";
}

function statesOf(el) {
  const s = [];
  if (el.required || el.getAttribute("aria-required") === "true") s.push("required");
  if (el.type === "checkbox") s.push(el.checked ? "checked" : "not checked");
  if (el.disabled) s.push("disabled");
  if (el.getAttribute("aria-invalid") === "true") s.push("invalid");
  if (el.hasAttribute("aria-expanded")) s.push(el.getAttribute("aria-expanded") === "true" ? "expanded" : "collapsed");
  if (el.getAttribute("aria-selected") === "true") s.push("selected");
  return s;
}

function descriptionOf(el) {
  const ids = el.getAttribute("aria-describedby");
  if (!ids) return "";
  return ids.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent.trim() ?? "").filter(Boolean).join(" ");
}

// ---------------------------------------------------------- 1 tree

for (const root of $$(document, "[data-a11y-tree]")) {
  const out = $(root, "[data-a11y-tree-out]");
  const summary = $(root, "[data-a11y-tree-summary]");
  const render = () => {
    const stage = $$(root, "[data-a11y-sample]").find(visible);
    out.replaceChildren();
    let issues = 0;
    const els = $$(stage, "form,h1,h2,h3,h4,h5,h6,[role],input,button,a,img,.cursor-pointer");
    for (const el of els) {
      const role = roleOf(el);
      const { name, from } = nameOf(el);
      const warn = [];
      if (el.matches(".cursor-pointer") && !el.matches("button,a,[role]")) warn.push("looks like a button, but it is a generic element: no role, not focusable");
      if (el.tagName === "IMG" && !el.hasAttribute("alt")) warn.push("no alt: screen readers may read the file name");
      if (/textbox|checkbox/.test(role) && (from === "placeholder" || from === "none")) warn.push(from === "none" ? "no accessible name" : "named only by its placeholder, which vanishes as you type");
      if (role === "link" && /^(here|click here|read more|more)$/i.test(name)) warn.push(`link text “${name}” says nothing out of context`);
      if (role === "presentation") {
        out.append(li(`presentation  (alt="" — skipped by screen readers)`, "text-muted-foreground"));
        continue;
      }
      const row = document.createElement("li");
      row.className = "flex flex-col";
      const head = document.createElement("span");
      const r = document.createElement("span");
      r.className = "text-[var(--tok-keyword)]";
      r.textContent = role;
      const n = document.createElement("span");
      n.textContent = name ? `  “${name}”` : "  (no name)";
      n.className = name ? "" : "text-del";
      const st = document.createElement("span");
      st.className = "text-muted-foreground";
      const states = statesOf(el);
      st.textContent = states.length ? `  ${states.join(", ")}` : "";
      head.append(r, n, st);
      row.append(head);
      for (const w of warn) {
        issues++;
        const wl = document.createElement("span");
        wl.className = "pl-3 text-del";
        wl.textContent = `✗ ${w}`;
        row.append(wl);
      }
      out.append(row);
    }
    summary.textContent = issues ? `${issues} problem${issues > 1 ? "s" : ""} a screen-reader user would hit.` : "✓ Every control has a role and a name.";
    summary.className = `text-sm ${issues ? "text-del" : "text-add"}`;
  };
  root.closest("[data-block]")?.addEventListener("a11y-version", render);
  root.addEventListener("change", render);
  render();
}

// ---------------------------------------------------------- 2 focus order

for (const root of $$(document, "[data-a11y-focus]")) {
  const log = $(root, "[data-a11y-focus-log]");
  const toggle = $(root, "[data-a11y-focus-numbers]");
  let showNumbers = true;
  let trapCount = 0;

  // The order a keyboard user gets: positive tabindex first (ascending, then
  // DOM order), then the rest in DOM order.
  const order = (stage) => {
    const els = $$(stage, "[data-a11y-focusable]");
    const ti = (el) => Number(el.dataset.a11yTabindex || 0);
    const pos = els.filter((el) => ti(el) > 0).sort((a, b) => ti(a) - ti(b));
    return [...pos, ...els.filter((el) => ti(el) <= 0)];
  };
  const stage = () => $$(root, "[data-a11y-focus-stage]").find(visible);
  const label = (el) => nameOf(el).name || el.textContent.trim();

  const drawNumbers = () => {
    for (const b of $$(root, "[data-a11y-badge]")) b.remove();
    if (!showNumbers) return;
    const s = stage();
    const box = s.getBoundingClientRect();
    order(s).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const b = document.createElement("span");
      b.dataset.a11yBadge = "";
      b.setAttribute("aria-hidden", "true");
      b.className = "pointer-events-none absolute flex size-5 items-center justify-center rounded-full bg-brand font-mono text-[10px] font-medium text-white shadow-sm";
      b.style.left = `${r.right - box.left - 12}px`;
      b.style.top = `${r.top - box.top - 8}px`;
      b.textContent = String(i + 1);
      s.append(b);
    });
  };

  root.addEventListener("focusin", (e) => {
    const s = stage();
    const list = order(s);
    const i = list.indexOf(e.target);
    if (i < 0) return;
    log.textContent = `Focus: ${label(e.target)} — stop ${i + 1} of ${list.length}`;
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const s = stage();
    if (!s.contains(e.target)) return;
    if (e.target.hasAttribute("data-a11y-trap")) {
      if (trapCount < 3) {
        e.preventDefault();
        trapCount++;
        log.textContent = `Trapped in “Date”: Tab pressed ${trapCount} time${trapCount > 1 ? "s" : ""}. ${trapCount < 3 ? "Focus can't leave." : "Released for this demo; a real trap would not let go."}`;
        return;
      }
      trapCount = 0;
    }
    // Simulated positive tabindex: move focus by the computed order.
    const list = order(s);
    if (!list.some((el) => el.dataset.a11yTabindex)) return;
    const i = list.indexOf(e.target);
    const j = i + (e.shiftKey ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return;
    e.preventDefault();
    list[j].focus();
  });
  toggle.addEventListener("click", () => {
    showNumbers = !showNumbers;
    toggle.setAttribute("aria-pressed", String(showNumbers));
    drawNumbers();
  });
  root.closest("[data-block]")?.addEventListener("a11y-version", () => {
    trapCount = 0;
    requestAnimationFrame(drawNumbers);
  });
  new ResizeObserver(drawNumbers).observe(root);
}

// ---------------------------------------------------------- 3 screen reader

for (const root of $$(document, "[data-a11y-reader]")) {
  const sample = $(root, "[data-a11y-reader-sample]");
  const out = $(root, "[data-a11y-reader-out]");
  const warn = $(root, "[data-a11y-reader-warn]");
  let mode = "read";

  const items = [];
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.replace(/\s+/g, " ").trim();
        if (t) items.push({ kind: "text", text: t });
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === "nav" || (tag === "section" && n.hasAttribute("aria-label"))) {
        items.push({ kind: "landmark", text: `${roleOf(n)} landmark, ${nameOf(n).name}` });
        walk(n);
        items.push({ kind: "end", text: `end of ${roleOf(n)}` });
      } else if (tag === "article") {
        items.push({ kind: "article", text: "article" });
        walk(n);
      } else if (/^h[1-6]$/.test(tag)) {
        items.push({ kind: "heading", text: `heading level ${tag[1]}, ${n.textContent.trim()}` });
      } else if (tag === "a") {
        items.push({ kind: "link", text: `link, ${n.textContent.trim()}`, name: n.textContent.trim(), href: n.getAttribute("href") });
      } else if (tag === "button") {
        items.push({ kind: "button", text: `button, ${n.textContent.trim()}` });
      } else if (tag === "img") {
        if (n.getAttribute("alt")) items.push({ kind: "image", text: `image, ${n.getAttribute("alt")}` });
      } else walk(n);
    }
  };
  walk(sample);

  const render = () => {
    out.replaceChildren();
    const pick = {
      read: () => items,
      headings: () => items.filter((i) => i.kind === "heading"),
      links: () => items.filter((i) => i.kind === "link"),
      landmarks: () => items.filter((i) => i.kind === "landmark"),
    }[mode]();
    const links = items.filter((i) => i.kind === "link");
    const vague = (l) => /^(click here|here|read more|more)$/i.test(l.name);
    const dupes = (l) => links.filter((x) => x.name === l.name && x.href !== l.href).length > 0;
    for (const it of pick) {
      const bad = it.kind === "link" && (vague(it) || dupes(it));
      const row = li(it.text, bad ? "text-del" : it.kind === "heading" || it.kind === "landmark" ? "text-foreground" : "text-muted-foreground");
      if (bad) row.textContent += dupes(it) ? "   ✗ same text, different destinations" : "   ✗ meaningless out of context";
      out.append(row);
    }
    const n = links.filter((l) => vague(l) || dupes(l)).length;
    warn.textContent = mode === "links" || mode === "read" ? (n ? `${n} links can't be told apart in a links list. Name the destination: “Read more about linear algebra”, “Download the syllabus (PDF)”.` : "") : "";
    warn.className = "text-sm text-del";
  };
  for (const b of $$(root, "[data-a11y-mode]"))
    b.addEventListener("click", () => {
      mode = b.dataset.a11yMode;
      for (const x of $$(root, "[data-a11y-mode]")) x.setAttribute("aria-pressed", String(x === b));
      render();
    });
  render();
}

// ---------------------------------------------------------- 4 headings

for (const root of $$(document, "[data-a11y-headings]")) {
  const input = $(root, "[data-a11y-headings-in]");
  const out = $(root, "[data-a11y-headings-out]");
  const findings = $(root, "[data-a11y-headings-findings]");
  let t = 0;
  const check = () => {
    // Parsed into an inert document: nothing here runs or is inserted.
    const doc = new DOMParser().parseFromString(input.value, "text/html");
    const hs = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].map((el) => ({
      level: /^H\d$/.test(el.tagName) ? Number(el.tagName[1]) : Number(el.getAttribute("aria-level") || 2),
      text: el.textContent.replace(/\s+/g, " ").trim(),
      aria: el.getAttribute("role") === "heading",
    }));
    out.replaceChildren();
    findings.replaceChildren();
    const issues = [];
    let prev = 0;
    for (const hd of hs) {
      const row = document.createElement("li");
      row.className = "flex items-baseline gap-2";
      row.style.paddingLeft = `${(hd.level - 1) * 14}px`;
      const lv = document.createElement("span");
      lv.className = "rounded border px-1 font-mono text-[10px] text-muted-foreground";
      lv.textContent = `h${hd.level}${hd.aria ? " (aria)" : ""}`;
      const tx = document.createElement("span");
      tx.textContent = hd.text || "(empty)";
      if (!hd.text) tx.className = "text-del";
      row.append(lv, tx);
      out.append(row);
      if (!hd.text) issues.push(["bad", `An empty h${hd.level}: it is announced as a heading with no name.`]);
      if (prev && hd.level > prev + 1) issues.push(["bad", `“${hd.text || "(empty)"}”: h${prev} → h${hd.level} skips level ${prev + 1}.`]);
      prev = hd.level;
    }
    const h1 = hs.filter((x) => x.level === 1).length;
    if (h1 > 1) issues.push(["advice", `${h1} level-one headings: usually one h1 names the page.`]);
    if (!hs.length) issues.push(["advice", "No headings found."]);
    if (!issues.length) issues.push(["ok", "A clean outline: no skipped levels or empty headings."]);
    for (const [kind, text] of issues) {
      const row = li(`${kind === "ok" ? "✓" : kind === "bad" ? "✗" : "•"} ${text}`, kind === "ok" ? "text-add" : kind === "bad" ? "text-del" : "text-muted-foreground");
      findings.append(row);
    }
  };
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(check, 150);
  });
  check();
}

// ---------------------------------------------------------- 5 alt decision tree

const ALT = {
  start: { q: "Does the image contain text?", a: [["Yes", "text-dup"], ["No", "link"]] },
  "text-dup": { q: "Is the same text also present as real text nearby?", a: [["Yes", "r-empty-dup"], ["No", "text-effect"]] },
  "text-effect": { q: "Is the text only there for visual effect, like decorative lettering?", a: [["Yes", "r-empty-effect"], ["No", "text-function"]] },
  "text-function": { q: "Does the text have a specific function, for example an icon such as a magnifier labelled “Search”?", a: [["Yes", "r-function"], ["No", "r-text"]] },
  link: { q: "Is the image used in a link or a button, and would its purpose be unclear without the image?", a: [["Yes", "r-functional"], ["No", "meaning"]] },
  meaning: { q: "Does the image contribute meaning to the page or its context?", a: [["Yes", "meaning-kind"], ["No", "decorative"]] },
  "meaning-kind": {
    q: "Which describes it best?",
    a: [["A simple graphic or photograph", "r-informative"], ["A graph or other complex information", "r-complex"], ["It repeats real text nearby", "r-empty-dup"]],
  },
  decorative: { q: "Is the image purely decorative, or not meant for users?", a: [["Yes", "r-decorative"], ["No", "r-unclear"]] },
  "r-empty-dup": { kind: "Redundant image", alt: 'alt=""', why: "The information is already in the text; repeating it would make screen readers say it twice.", ex: '<img src="award.png" alt=""> Winner of the 2026 Teaching Prize' },
  "r-empty-effect": { kind: "Decorative text", alt: 'alt=""', why: "Lettering used only for its look carries no information of its own.", ex: '<img src="flourish-title.png" alt="">' },
  "r-function": { kind: "Functional icon", alt: "alt describes the function", why: "Users need to know what activating it does, not what it looks like.", ex: '<button><img src="magnifier.svg" alt="Search"></button>' },
  "r-text": { kind: "Image of text", alt: "alt repeats the text in the image", why: "The text exists nowhere else, so the alt must carry it word for word.", ex: '<img src="sale-banner.png" alt="Spring sale: 30% off all courses">' },
  "r-functional": { kind: "Functional image", alt: "alt describes the destination or action", why: "Describe where the link goes or what the button does, not the picture.", ex: '<a href="/"><img src="logo.svg" alt="Hypercode home"></a>' },
  "r-informative": { kind: "Informative image", alt: "a short description that conveys the meaning", why: "Say what the image means in this context, briefly; leave out “image of”.", ex: '<img src="chart.png" alt="Sign-ups doubled between January and June">' },
  "r-complex": { kind: "Complex image", alt: "a short alt plus a full description elsewhere", why: "Charts and diagrams need the data or explanation as text on the page (a table, a caption, or a linked description).", ex: '<figure><img src="chart.png" alt="Sign-ups by month, 2026; data in the table below"><figcaption>…</figcaption></figure>' },
  "r-decorative": { kind: "Decorative image", alt: 'alt="" (empty, not missing)', why: "An empty alt tells assistive technology to skip it; a missing alt may make it read the file name.", ex: '<img src="divider.svg" alt="">' },
  "r-unclear": { kind: "Not covered", alt: "see the W3C WAI Images Tutorial", why: "When the use doesn't fit these cases, ask what information or function the image provides.", ex: "" },
};

for (const root of $$(document, "[data-a11y-alt]")) {
  const card = $(root, "[data-a11y-alt-card]");
  const pathEl = $(root, "[data-a11y-alt-path]");
  const stepEl = $(root, "[data-a11y-alt-step]");
  let path = [];

  const show = (id, focus) => {
    const node = ALT[id];
    card.replaceChildren();
    const h = document.createElement("p");
    h.tabIndex = -1;
    h.className = "text-base font-medium outline-none";
    if (node.q) {
      stepEl.textContent = `Question ${path.length + 1}`;
      h.textContent = node.q;
      const row = document.createElement("div");
      row.className = "flex flex-wrap gap-2";
      for (const [label, next] of node.a) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm shadow-xs outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";
        b.textContent = label;
        b.addEventListener("click", () => {
          path.push([id, label]);
          renderPath();
          show(next, true);
        });
        row.append(b);
      }
      card.append(h, row);
    } else {
      stepEl.textContent = "Answer";
      h.textContent = node.kind;
      const alt = document.createElement("p");
      alt.className = "font-mono text-sm text-brand";
      alt.textContent = node.alt;
      const why = document.createElement("p");
      why.className = "text-sm text-muted-foreground";
      why.textContent = node.why;
      card.append(h, alt, why);
      if (node.ex) {
        const ex = document.createElement("code");
        ex.className = "block overflow-x-auto rounded-md border bg-background p-2 font-mono text-[12px]";
        ex.textContent = node.ex;
        card.append(ex);
      }
    }
    if (focus) h.focus({ preventScroll: true });
  };
  const renderPath = () => {
    pathEl.replaceChildren();
    path.forEach(([id, ans], i) => {
      const row = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "text-left underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50";
      b.textContent = `${i + 1}. ${ALT[id].q} — ${ans}`;
      b.setAttribute("aria-label", `Go back to question ${i + 1}`);
      b.addEventListener("click", () => {
        path = path.slice(0, i);
        renderPath();
        show(id, true);
      });
      row.append(b);
      pathEl.append(row);
    });
  };
  $(root, "[data-a11y-alt-restart]").addEventListener("click", () => {
    path = [];
    renderPath();
    show("start", true);
  });
  show("start", false);
}

// ---------------------------------------------------------- 6 target size

for (const root of $$(document, "[data-a11y-target]")) {
  const svg = $(root, "[data-a11y-target-svg]");
  const verdict = $(root, "[data-a11y-target-verdict]");
  const s = scrubAll(root, draw);
  const K = 2; // drawn at 2 SVG units per CSS px

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.append(e);
    return e;
  }
  function draw() {
    const w = s.w.get(), hh = s.hgt.get(), gap = s.gap.get();
    svg.replaceChildren();
    const total = (2 * w + gap) * K;
    const x0 = 160 - total / 2, cy = 70;
    const centers = [x0 + (w * K) / 2, x0 + (w + gap) * K + (w * K) / 2];
    const small = w < 24 || hh < 24;
    for (const cx of centers) {
      el("rect", { x: cx - (w * K) / 2, y: cy - (hh * K) / 2, width: w * K, height: hh * K, rx: 4, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" });
      if (small) el("circle", { cx, cy, r: 12 * K, style: "fill:none;stroke:var(--brand);stroke-width:1.25;stroke-dasharray:4 3" });
    }
    const centerDist = w + gap;
    const sizeOK = w >= 24 && hh >= 24;
    const spacingOK = centerDist >= 24;
    const aa = sizeOK || spacingOK;
    const aaa = w >= 44 && hh >= 44;
    verdict.replaceChildren(
      li(`${aa ? "✓" : "✗"} 2.5.8 (AA): ${sizeOK ? `${w}×${hh} px meets 24×24` : spacingOK ? `under 24 px, but the 24 px circles don't overlap (centres ${centerDist} px apart): spacing exception` : `${w}×${hh} px and centres only ${centerDist} px apart: the circles overlap`}`, aa ? "text-add" : "text-del"),
      li(`${aaa ? "✓" : "✗"} 2.5.5 (AAA): ${aaa ? "at least 44×44 px" : "needs 44×44 px"}`, aaa ? "text-add" : "text-muted-foreground"),
    );
  }
  draw();
}

// ---------------------------------------------------------- 7 forms

for (const root of $$(document, "[data-a11y-forms]")) {
  const announce = $(root, "[data-a11y-form-announce]");
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  root.addEventListener("focusin", (e) => {
    const f = e.target;
    if (!f.matches("input")) return;
    const { name, from } = nameOf(f);
    const parts = [`edit text, ${name || "(no name)"}`];
    const st = statesOf(f);
    if (st.length) parts.push(st.map((x) => (x === "invalid" ? "invalid entry" : x)).join(", "));
    const d = descriptionOf(f);
    if (d) parts.push(d);
    let text = parts.join(", ");
    if (from === "placeholder") text += f.value ? "\n✗ the placeholder is gone once you type: now it has no visible label" : "\n✗ named by its placeholder only";
    announce.textContent = text;
  });

  for (const form of $$(root, "[data-a11y-form]")) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const good = form.dataset.a11yForm === "good";
      const fields = $$(form, "input");
      const errors = [];
      for (const f of fields) {
        const v = f.value.trim();
        let msg = "";
        if (!v) msg = f.name === "name" ? "Enter your full name." : "Enter an email address.";
        else if (f.name === "email" && !email.test(v)) msg = "Enter an email address like name@example.com.";
        if (good) {
          f.setAttribute("aria-invalid", msg ? "true" : "false");
          const err = $(form, `[data-a11y-err="${f.name}"]`);
          err.textContent = msg ? `✗ ${msg}` : "";
        } else {
          f.style.borderColor = msg ? "#e5484d" : "";
        }
        if (msg) errors.push(f);
      }
      if (good) {
        const status = $(form, "[data-a11y-form-status]");
        status.textContent = errors.length ? `${errors.length} error${errors.length > 1 ? "s" : ""}: fix the marked field${errors.length > 1 ? "s" : ""}.` : "✓ Message sent (demo: nothing leaves this page).";
        status.className = `text-sm ${errors.length ? "text-del" : "text-add"}`;
        errors[0]?.focus();
      }
    });
  }
}

// ---------------------------------------------------------- 8 patterns

for (const root of $$(document, "[data-a11y-patterns]")) {
  const log = $(root, "[data-a11y-patterns-log]");
  let first = true;
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!(root.contains(t) || t.closest('[role="dialog"]'))) return;
    if (first) {
      log.replaceChildren();
      first = false;
    }
    const st = statesOf(t);
    const role = t.getAttribute("role") || roleOf(t);
    const where = t.closest('[role="dialog"]') ? " (inside the dialog)" : "";
    log.append(li(`${role}, ${nameOf(t).name || t.textContent.trim()}${st.length ? ", " + st.join(", ") : ""}${where}`));
    while (log.children.length > 30) log.firstElementChild.remove();
  });
}

// ---------------------------------------------------------- 9 colour

for (const root of $$(document, "[data-a11y-color]")) {
  const svg = $(root, "[data-a11y-color-chart]");
  const stage = $(root, "[data-a11y-color-stage]");
  const grey = $(root, "[data-a11y-grey]");
  const a = [12, 18, 15, 26, 30, 34];
  const b = [20, 16, 22, 21, 28, 25];
  const mk = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text) e.textContent = text;
    svg.append(e);
    return e;
  };
  const draw = (good) => {
    svg.replaceChildren();
    const x = (i) => 30 + i * 46, y = (v) => 175 - v * 4.4;
    mk("line", { x1: 30, x2: 280, y1: 175, y2: 175, style: "stroke:currentColor;stroke-opacity:0.3" });
    const series = [
      { d: a, color: "#e5484d", name: "Course A", dash: "", marker: "circle" },
      { d: b, color: "#30a46c", name: "Course B", dash: "6 4", marker: "square" },
    ];
    series.forEach((s, k) => {
      mk("polyline", { points: s.d.map((v, i) => `${x(i)},${y(v)}`).join(" "), style: `fill:none;stroke:${s.color};stroke-width:2.5${good && s.dash ? `;stroke-dasharray:${s.dash}` : ""}` });
      if (good) {
        s.d.forEach((v, i) => {
          if (s.marker === "circle") mk("circle", { cx: x(i), cy: y(v), r: 4, style: `fill:${s.color}` });
          else mk("rect", { x: x(i) - 4, y: y(v) - 4, width: 8, height: 8, style: `fill:${s.color}` });
        });
        mk("text", { x: x(5) + 6, y: y(s.d[5]) + 4, class: "fill-foreground text-[11px]" }, s.name);
      } else {
        mk("circle", { cx: 40 + k * 80, cy: 18, r: 5, style: `fill:${s.color}` });
        mk("text", { x: 50 + k * 80, y: 22, class: "fill-muted-foreground text-[11px]" }, s.name);
      }
    });
  };
  let good = false;
  root.closest("[data-block]")?.addEventListener("a11y-version", (e) => {
    good = e.detail.value === "good";
    draw(good);
  });
  grey.addEventListener("click", () => {
    const on = grey.getAttribute("aria-pressed") !== "true";
    grey.setAttribute("aria-pressed", String(on));
    stage.toggleAttribute("data-grey", on);
  });
  draw(good);
}

// ---------------------------------------------------------- 10 motion

for (const root of $$(document, "[data-a11y-motion]")) {
  const pref = $(root, "[data-a11y-motion-pref]");
  const sim = $(root, "[data-a11y-motion-sim]");
  const pause = $(root, "[data-a11y-motion-pause]");
  const pauseLabel = $(root, "[data-a11y-motion-pause-label]");
  const orb = $(root, "[data-a11y-motion-orb]");
  const state = $(root, "[data-a11y-motion-state]");
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  let anim = null, paused = false, simulated = false, onScreen = false;

  const update = () => {
    const reduce = mq.matches || simulated;
    pref.textContent = mq.matches ? "reduce" : "no-preference";
    if (reduce) {
      anim?.cancel();
      anim = null;
      orb.style.left = "50%";
      orb.style.transform = "translate(-50%, -50%)";
      state.textContent = "Reduced motion: the orb stays still. Information that motion carried must be available without it.";
      pause.disabled = true;
      return;
    }
    pause.disabled = false;
    orb.style.left = "";
    orb.style.transform = "";
    if (!anim) {
      const track = root.querySelector("[data-a11y-motion-orb]").parentElement.clientWidth - 72;
      anim = orb.animate(
        [{ transform: "translate(0, -50%)" }, { transform: `translate(${track}px, -50%)` }],
        { duration: 2600, iterations: Infinity, direction: "alternate", easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
      );
    }
    if (paused || !onScreen) anim.pause();
    else anim.play();
    state.textContent = paused ? "Paused. Moving content that lasts more than five seconds needs this control (2.2.2)." : "Animating, with a Pause button (2.2.2).";
  };
  sim.addEventListener("click", () => {
    simulated = !simulated;
    sim.setAttribute("aria-pressed", String(simulated));
    update();
  });
  pause.addEventListener("click", () => {
    paused = !paused;
    pause.setAttribute("aria-pressed", String(paused));
    pauseLabel.textContent = paused ? "Play" : "Pause";
    update();
  });
  mq.addEventListener("change", update);
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    update();
  }).observe(root);
  update();
}
