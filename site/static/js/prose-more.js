// Lesson prose components, part 2: the line-by-line derivation, the
// outline with reading progress, checks inside the prose and reading
// settings. (Figures need no script: the dialog is the components'
// runtime.) Every block root is data-prose-*, so this module does nothing
// on other pages.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const part = (root, name) => root.querySelector(`[data-pz="${name}"]`);
const status = (root, s) => {
  const n = part(root, "status");
  if (n) n.textContent = s;
};

// ============================================================ derivation

for (const root of document.querySelectorAll("[data-prose-derive]")) {
  const steps = [...root.querySelectorAll("[data-pz-step]")];
  const controls = part(root, "controls");
  const prev = part(root, "prev");
  const next = part(root, "next");
  const all = part(root, "all");
  const announce = part(root, "announce");
  controls.hidden = false;
  let shown = 1;

  const render = (entered) => {
    steps.forEach((s, i) => {
      s.hidden = i >= shown;
      s.toggleAttribute("data-current", i === shown - 1 && shown < steps.length);
    });
    prev.disabled = shown <= 1;
    next.disabled = all.disabled = shown >= steps.length;
    status(root, `line ${shown} of ${steps.length}`);
    if (entered) {
      announce.textContent = `Line ${shown}. ${entered.querySelector('[data-pz="why"]').textContent}`;
      if (!reduced()) {
        entered.setAttribute("data-enter", "");
        requestAnimationFrame(() => requestAnimationFrame(() => entered.removeAttribute("data-enter")));
      }
    }
  };
  const go = (n) => {
    const before = shown;
    shown = Math.max(1, Math.min(steps.length, n));
    render(shown > before ? steps[shown - 1] : null);
    if (shown < before) announce.textContent = `Back to line ${shown}.`;
    // Keep focus on a usable control when the pressed one becomes disabled.
    if (document.activeElement?.disabled) (shown >= steps.length ? prev : next).focus();
  };
  next.addEventListener("click", () => go(shown + 1));
  prev.addEventListener("click", () => go(shown - 1));
  all.addEventListener("click", () => go(steps.length));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(shown + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(shown - 1);
    }
  });
  render();
}

// ============================================================ outline and progress

for (const root of document.querySelectorAll("[data-prose-toc]")) {
  const article = part(root, "article");
  const sections = [...root.querySelectorAll("[data-pz-section]")];
  const links = [...root.querySelectorAll("[data-pz-toc]")];
  const words = Object.fromEntries(links.map((a) => [a.dataset.pzToc, Number(a.dataset.pzWords)]));
  const bars = root.querySelectorAll('[data-pz="bar"]');
  const fills = root.querySelectorAll('[data-pz="fill"]');
  const lefts = root.querySelectorAll('[data-pz="left"]');
  const current = part(root, "current");
  const sheet = part(root, "sheet");
  const WPM = 230;

  const update = () => {
    const top = article.scrollTop;
    const max = article.scrollHeight - article.clientHeight;
    const progress = max > 0 ? Math.min(1, top / max) : 1;
    let idx = 0;
    sections.forEach((s, i) => {
      if (s.offsetTop <= top + 48) idx = i;
    });
    if (progress >= 0.999) idx = sections.length - 1;
    const cur = sections[idx];
    const frac = Math.min(1, Math.max(0, (top + 48 - cur.offsetTop) / cur.offsetHeight));
    let left = words[cur.dataset.pzSection] * (1 - (progress >= 0.999 ? 1 : frac));
    for (const s of sections.slice(idx + 1)) left += words[s.dataset.pzSection];
    const minutes = Math.ceil(left / WPM);
    for (const a of links) {
      const i = sections.findIndex((s) => s.dataset.pzSection === a.dataset.pzToc);
      if (i === idx) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
      a.toggleAttribute("data-done", i < idx);
    }
    for (const f of fills) f.style.transform = `scaleX(${progress})`;
    for (const b of bars) b.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    const text = left < 1 ? "Finished" : `${minutes} min left`;
    for (const l of lefts) l.textContent = text;
    current.textContent = cur.querySelector("h3").textContent;
    status(root, `${Math.round(progress * 100)}% · ${text}`);
  };

  let queued = false;
  article.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    },
    { passive: true },
  );
  for (const a of links) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const s = sections.find((x) => x.dataset.pzSection === a.dataset.pzToc);
      article.scrollTo({ top: s.offsetTop - 8, behavior: reduced() ? "auto" : "smooth" });
      s.querySelector("h3").focus({ preventScroll: true });
      if (sheet.open) sheet.open = false;
    });
  }
  update();
}

// ============================================================ inline checks

for (const root of document.querySelectorAll("[data-prose-checks]")) {
  const groups = [...root.querySelectorAll("[data-pz-check]")];
  const tried = new Set();
  const first = new Map();

  for (const d of root.querySelectorAll('[data-pz="answer"]')) d.hidden = true;
  const tally = () =>
    status(root, `${tried.size} of ${groups.length} tried · ${[...first.values()].filter(Boolean).length} right first time`);

  for (const g of groups) {
    g.hidden = false;
    const id = g.dataset.pzCheck;
    const fb = root.querySelector(`[data-pz-fb="${id}"]`);
    const opts = [...g.querySelectorAll("[data-pz-opt]")];
    for (const o of opts) {
      o.setAttribute("aria-pressed", "false");
      o.addEventListener("click", () => {
        const right = o.dataset.pzOpt === g.dataset.correct;
        for (const x of opts) {
          x.removeAttribute("data-right");
          x.removeAttribute("data-wrong");
          x.setAttribute("aria-pressed", String(x === o));
        }
        o.toggleAttribute(right ? "data-right" : "data-wrong", true);
        fb.toggleAttribute("data-right", right);
        fb.toggleAttribute("data-wrong", !right);
        fb.textContent = `${right ? "✓" : "✗"} ${o.dataset.feedback}`;
        if (!first.has(id)) first.set(id, right);
        tried.add(id);
        tally();
        if (!reduced()) {
          o.animate([{ transform: "scale(0.96)" }, { transform: "none" }], { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
        }
      });
    }
  }

  const spoiler = part(root, "spoiler");
  const setSpoiler = (open) => {
    spoiler.setAttribute("aria-expanded", String(open));
    spoiler.setAttribute("aria-label", open ? `Answer: ${spoiler.textContent.trim()}. Press to hide.` : "Reveal the answer");
  };
  setSpoiler(false);
  spoiler.addEventListener("click", () => setSpoiler(spoiler.getAttribute("aria-expanded") !== "true"));
  tally();
}

// ============================================================ reading settings

const KEY = "hypercode.reading";
const DEFAULTS = { size: "m", measure: "medium", face: "sans", spacing: "normal" };
const SIZES = { s: "14px", m: "16px", l: "18px", xl: "21px" };
const MEASURES = { narrow: "45ch", medium: "60ch", wide: "80ch" };

for (const root of document.querySelectorAll("[data-prose-settings]")) {
  const passage = part(root, "passage");
  const measure = part(root, "measure");
  const saved = part(root, "saved");
  const radios = [...root.querySelectorAll("[data-pz-set]")];
  let storage = true;
  let state = { ...DEFAULTS };
  let restored = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      for (const k of Object.keys(DEFAULTS)) if (typeof s?.[k] === "string") state[k] = s[k];
      restored = true;
    }
  } catch {
    storage = false;
  }

  const apply = () => {
    passage.style.fontSize = SIZES[state.size] ?? SIZES.m;
    measure.style.maxWidth = MEASURES[state.measure] ?? MEASURES.medium;
    passage.style.fontFamily = state.face === "serif" ? 'ui-serif, Georgia, Cambria, "Times New Roman", serif' : "";
    const open = state.spacing === "open";
    passage.style.letterSpacing = open ? "0.05em" : "";
    passage.style.wordSpacing = open ? "0.16em" : "";
    passage.style.lineHeight = open ? "1.9" : "1.7";
    for (const r of radios) r.checked = state[r.dataset.pzSet] === r.value;
    status(root, `${state.size.toUpperCase()} · ${state.measure} · ${state.face}${open ? " · open" : ""}`);
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storage = true;
    } catch {
      storage = false;
    }
    saved.textContent = storage ? "Saved on this device" : "Applied for this visit (storage is blocked)";
  };

  for (const r of radios) {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      state[r.dataset.pzSet] = r.value;
      apply();
      save();
    });
  }
  part(root, "reset").addEventListener("click", () => {
    state = { ...DEFAULTS };
    apply();
    try {
      localStorage.removeItem(KEY);
      saved.textContent = "Back to the defaults";
    } catch {
      saved.textContent = "Back to the defaults for this visit";
    }
  });
  apply();
  saved.textContent = !storage ? "Storage is blocked: settings last until you leave" : restored ? "Restored from this device" : "";
}
