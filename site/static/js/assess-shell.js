// The frame every assessment block shares: status line, feedback panel,
// and the hint / show answer / try again / check footer. Exports only; the
// block modules call exercise() on their roots. Learner text reaches the DOM
// through textContent only.

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mk(tag, cls = "", txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

/** shake nudges a node sideways once: a wrong answer the eye catches. */
export function shake(node) {
  if (!node || reduced()) return;
  node.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }],
    { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}

const LOOK = {
  right: ["border-brand/40 bg-brand/8", "text-brand", "✓"],
  partial: ["border-dashed border-brand/50 bg-brand/5", "text-brand", "◐"],
  wrong: ["border-del/40 bg-del/8", "text-del", "✗"],
  info: ["bg-muted/40", "text-muted-foreground", "i"],
};

/**
 * panel builds a feedback box. body is a string, a Node, or an array of
 * them; arrays become separate lines.
 */
export function panel(state, title, body = []) {
  const [box, ink, sym] = LOOK[state] ?? LOOK.info;
  const p = mk("div", `enter flex gap-3 rounded-lg border p-3 text-sm ${box}`);
  p.append(mk("span", `mt-px w-3 shrink-0 text-center font-mono text-xs ${ink}`, sym));
  const col = mk("div", "flex min-w-0 flex-col gap-1");
  col.append(mk("span", "font-medium text-pretty", title));
  for (const line of Array.isArray(body) ? body : [body]) {
    if (line === "" || line == null) continue;
    const l = mk("span", "text-muted-foreground text-pretty [&_math]:text-foreground");
    if (typeof line === "string") l.textContent = line;
    else l.append(line);
    col.append(l);
  }
  p.append(col);
  return p;
}

/**
 * exercise wires a block's footer.
 *  check()  → {state: right|partial|wrong|info, title, body, shake?} or null
 *  reveal() → fills in the answer (optional)
 *  reset()  → clears the learner's work (optional)
 *  onHint(i, li) → after hint i is shown (optional)
 * Returns {say(state, title, body), clear(), status(), hintsUsed()}.
 */
export function exercise(root, { check, reveal, reset, onHint, status } = {}) {
  const fb = root.querySelector("[data-assess-feedback]");
  const st = root.querySelector("[data-assess-status]");
  const hints = [...root.querySelectorAll("[data-assess-hint]")];
  const btn = (a) => root.querySelector(`[data-assess-act="${a}"]`);
  let tries = 0, shown = 0, solved = false;

  const writeStatus = () => {
    if (!st) return;
    const parts = [];
    if (tries) parts.push(`${tries} ${tries === 1 ? "check" : "checks"}`);
    if (hints.length) parts.push(`hints ${shown}/${hints.length}`);
    if (solved) parts.push("solved");
    st.textContent = status ? status({ tries, shown, solved }) : parts.join(" · ");
  };
  const say = (state, title, body) => {
    fb.replaceChildren(panel(state, title, body));
  };
  const clear = () => fb.replaceChildren();

  btn("check")?.addEventListener("click", () => {
    const r = check();
    if (!r) return;
    if (r.state !== "info") tries++;
    if (r.state === "right") solved = true;
    say(r.state, r.title, r.body);
    // Wrong fields are announced as invalid, not only coloured.
    for (const f of root.querySelectorAll("input, select")) {
      if (f.dataset.state === "wrong") f.setAttribute("aria-invalid", "true");
      else f.removeAttribute("aria-invalid");
    }
    if (r.state === "wrong") shake(r.shake ?? fb.firstChild);
    writeStatus();
  });
  btn("hint")?.addEventListener("click", () => {
    if (shown >= hints.length) return;
    const li = hints[shown++];
    li.hidden = false;
    onHint?.(shown - 1, li);
    if (shown >= hints.length) btn("hint").disabled = true;
    writeStatus();
  });
  btn("reveal")?.addEventListener("click", () => {
    reveal?.();
    say("info", "Answer shown.", "Read it through, then try again from scratch with Try again.");
    writeStatus();
  });
  btn("retry")?.addEventListener("click", () => {
    reset?.();
    solved = false;
    clear();
    writeStatus();
  });
  // Enter in a text field checks, like submitting a form.
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === "text" && !t.closest("[data-assess-noenter]")) {
      e.preventDefault();
      btn("check")?.click();
    }
  });
  writeStatus();
  return {
    say, clear, status: writeStatus,
    hintsUsed: () => shown,
    resetHints() {
      shown = 0;
      for (const li of hints) li.hidden = true;
      if (btn("hint")) btn("hint").disabled = false;
      writeStatus();
    },
    setSolved(v) { solved = v; writeStatus(); },
  };
}

const MARK = { right: ["✓", "text-brand", "right"], wrong: ["✗", "text-del", "wrong"], indent: ["⇥", "text-del", "wrong indent"], missed: ["○", "text-del", "missed"] };

/**
 * mark puts a ✓ / ✗ glyph after anchor for a checked item, so the state is
 * not told by colour alone (pink and red are close); null clears it.
 */
export function mark(anchor, state) {
  let m = anchor.parentElement.querySelector(":scope > [data-assess-mark]");
  // The focusable item's name says the state too, for screen readers.
  const host = anchor.closest("[tabindex][aria-label]");
  if (host) host.setAttribute("aria-label", host.getAttribute("aria-label").replace(/ — marked .*$/, "") + (state ? ` — marked ${MARK[state][2]}` : ""));
  if (!state) { m?.remove(); return; }
  if (!m) {
    m = mk("span");
    m.dataset.assessMark = "";
    anchor.after(m);
  }
  const [sym, ink, word] = MARK[state];
  m.className = `w-3 shrink-0 text-center font-mono text-xs font-semibold ${ink}`;
  m.textContent = sym;
  m.setAttribute("aria-label", word);
}

/** announcer returns a function that speaks a short message politely. */
export function announcer(root) {
  const live = mk("span", "sr-only");
  live.setAttribute("aria-live", "polite");
  root.append(live);
  return (msg) => { live.textContent = ""; requestAnimationFrame(() => (live.textContent = msg)); };
}

/** flip animates nodes from their old positions (FLIP), 200 ms ease-out. */
export function flip(nodes, mutate) {
  const before = new Map(nodes.map((n) => [n, n.getBoundingClientRect()]));
  mutate();
  if (reduced()) return;
  for (const n of nodes) {
    const a = before.get(n), b = n.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (dx || dy) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }
}
