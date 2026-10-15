// Lesson prose components, part 1: theorem environments, margin notes,
// the explorable paragraph, linked notation and the code-and-math cell.
// Every block root is data-prose-*, so this module does nothing on other
// pages, and every block is readable before it runs. Part 2 is
// prose-more.js.

import { scrubAll } from "./scrub.js";
import { tokenize } from "./highlight.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const part = (root, name) => root.querySelector(`[data-pz="${name}"]`);
const status = (root, s) => {
  const n = part(root, "status");
  if (n) n.textContent = s;
};
const minus = (s) => String(s).replace("-", "−");
const r1 = (v) => minus(Math.round(v * 10) / 10);

// ============================================================ environments

for (const root of document.querySelectorAll("[data-prose-thm]")) {
  let card = null;
  let owner = null;
  let hideTimer = 0;

  const make = () => {
    card = document.createElement("div");
    card.id = `prose-preview-${Math.random().toString(36).slice(2, 8)}`;
    card.setAttribute("role", "tooltip");
    card.className =
      "absolute z-20 flex flex-col gap-1 rounded-lg border bg-popover p-3 text-sm leading-6 text-popover-foreground shadow-md transition-[opacity,translate] duration-150 ease-[var(--ease-out)] data-closed:pointer-events-none data-closed:translate-y-1 data-closed:opacity-0 motion-reduce:transition-none";
    card.dataset.closed = "";
    card.addEventListener("pointerenter", () => clearTimeout(hideTimer));
    card.addEventListener("pointerleave", () => hide());
    root.append(card);
  };

  const show = (a) => {
    clearTimeout(hideTimer);
    const env = document.getElementById(a.getAttribute("href").slice(1));
    if (!env) return;
    if (!card) make();
    const title = env.querySelector("[id$='-title']").cloneNode(true);
    title.removeAttribute("id");
    const statement = env.querySelector("[data-pz-statement]").cloneNode(true);
    for (const link of statement.querySelectorAll("a")) link.tabIndex = -1;
    card.replaceChildren(title, statement);
    const box = root.getBoundingClientRect();
    const at = a.getBoundingClientRect();
    const w = Math.min(352, box.width - 8);
    card.style.width = `${w}px`;
    card.style.left = `${Math.max(0, Math.min(at.left - box.left, box.width - w))}px`;
    card.style.top = `${at.bottom - box.top + 6}px`;
    if (owner && owner !== a) owner.removeAttribute("aria-describedby");
    owner = a;
    a.setAttribute("aria-describedby", card.id);
    requestAnimationFrame(() => delete card.dataset.closed);
  };

  const hide = (now = false) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!card) return;
      card.dataset.closed = "";
      owner?.removeAttribute("aria-describedby");
      owner = null;
    }, now ? 0 : 140);
  };

  const refs = root.querySelectorAll("[data-pz-ref]");
  for (const a of refs) {
    a.addEventListener("pointerenter", () => show(a));
    a.addEventListener("pointerleave", () => hide());
    a.addEventListener("focus", () => show(a));
    a.addEventListener("blur", () => hide(true));
    a.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hide(true);
    });
  }

  // Proofs open one step at a time.
  for (const proof of root.querySelectorAll('[data-pz="proof"]')) {
    const steps = [...proof.querySelectorAll("[data-pz-step]")];
    const controls = proof.querySelector('[data-pz="proof-controls"]');
    const next = controls.querySelector('[data-pz="next"]');
    const all = controls.querySelector('[data-pz="all"]');
    const count = controls.querySelector('[data-pz="count"]');
    controls.hidden = false;
    let shown = 1;
    const render = (entering) => {
      steps.forEach((s, i) => (s.hidden = i >= shown));
      count.textContent = `Step ${shown} of ${steps.length}`;
      next.disabled = all.disabled = shown >= steps.length;
      if (entering && !reduced()) {
        entering.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], {
          duration: 200,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        });
      }
    };
    next.addEventListener("click", () => {
      shown = Math.min(steps.length, shown + 1);
      render(steps[shown - 1]);
      if (next.disabled) all.focus();
    });
    all.addEventListener("click", () => {
      shown = steps.length;
      render();
      count.focus?.();
    });
    render();
  }

  status(root, `${root.querySelectorAll("[data-pz-env]").length} environments · ${refs.length} references`);
}

// ============================================================ margin notes

for (const root of document.querySelectorAll("[data-prose-side]")) {
  const narrow = matchMedia("(max-width: 1023.98px)");
  const notes = new Map([...root.querySelectorAll("[data-pz-note]")].map((n) => [n.dataset.pzNote, n]));
  const marks = [...root.querySelectorAll("[data-pz-sn]")];

  const layout = () => {
    for (const m of marks) {
      const n = notes.get(m.dataset.pzSn);
      if (narrow.matches) {
        const open = m.dataset.open === "1";
        m.setAttribute("role", "button");
        m.setAttribute("aria-expanded", String(open));
        m.setAttribute("aria-controls", n.id);
        n.hidden = !open;
      } else {
        m.removeAttribute("role");
        m.removeAttribute("aria-expanded");
        m.removeAttribute("aria-controls");
        n.hidden = false;
      }
    }
    status(root, narrow.matches ? "notes open in the text" : "notes in the margin");
  };

  const activate = (m) => {
    const n = notes.get(m.dataset.pzSn);
    if (narrow.matches) {
      m.dataset.open = m.dataset.open === "1" ? "0" : "1";
      layout();
      if (m.dataset.open === "1" && !reduced()) {
        n.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], {
          duration: 180,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        });
      }
    } else {
      n.dataset.flash = "";
      setTimeout(() => delete n.dataset.flash, 900);
    }
  };

  for (const m of marks) {
    m.addEventListener("click", (e) => {
      e.preventDefault();
      activate(m);
    });
    m.addEventListener("keydown", (e) => {
      if (e.key === " " && narrow.matches) {
        e.preventDefault();
        activate(m);
      }
    });
    m.addEventListener("pointerenter", () => {
      if (!narrow.matches) notes.get(m.dataset.pzSn).dataset.flash = "";
    });
    m.addEventListener("pointerleave", () => delete notes.get(m.dataset.pzSn).dataset.flash);
  }
  narrow.addEventListener("change", layout);
  layout();
}

// ============================================================ explorable paragraph

for (const root of document.querySelectorAll("[data-prose-explore]")) {
  const out = (n) => root.querySelector(`[data-pz-out="${n}"]`);
  const shape = part(root, "shape");
  const e1 = part(root, "e1");
  const e2 = part(root, "e2");
  const px = (x, y) => [160 + 40 * x, 130 - 40 * y];

  let s;
  const update = () => {
    const a = s.a.get();
    const b = s.b.get();
    const d = s.d.get();
    const det = Math.round(a * d * 100) / 100;
    out("matrix").textContent = `[${r1(a)} ${r1(b)}; 0 ${r1(d)}]`;
    out("area").textContent = Math.abs(det).toFixed(2);
    out("shift").textContent = r1(b);
    out("det").textContent = minus(det.toFixed(2));
    out("verdict").textContent =
      det > 0 ? "keeps its orientation" : det < 0 ? "is mirrored: turning left becomes turning right" : "collapses onto a line, and the square has no area left";
    const pts = [px(0, 0), px(a, 0), px(a + b, d), px(b, d)];
    shape.setAttribute("points", pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "));
    const [x1, y1] = px(a, 0);
    const [x2, y2] = px(b, d);
    e1.setAttribute("x2", x1.toFixed(1));
    e1.setAttribute("y2", y1.toFixed(1));
    e2.setAttribute("x2", x2.toFixed(1));
    e2.setAttribute("y2", y2.toFixed(1));
    status(root, `det ${minus(det.toFixed(2))}`);
  };
  s = scrubAll(root, update);
  update();
}

// ============================================================ linked notation

for (const root of document.querySelectorAll("[data-prose-notation]")) {
  const syms = [...root.querySelectorAll("[data-pz-sym]")];
  const light = (name) => {
    for (const el of syms) el.toggleAttribute("data-lit", name !== null && el.dataset.pzSym === name);
    status(root, name ? `showing ${name === "scale" ? "the scale factor" : name === "r" ? "v − p" : name}` : "");
  };
  for (const el of syms) {
    el.addEventListener("pointerenter", () => light(el.dataset.pzSym));
    el.addEventListener("pointerleave", () => light(null));
    if (el.tagName === "BUTTON") {
      el.addEventListener("focus", () => light(el.dataset.pzSym));
      el.addEventListener("blur", () => light(null));
    }
  }

  const fig = part(root, "fig");
  const handle = part(root, "handle");
  const readout = part(root, "readout");
  const u = [4, 1];
  let v = [2, 3];
  const X = (x) => 40 + 40 * x;
  const Y = (y) => 200 - 40 * y;
  const set = (el, attrs) => {
    for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, typeof val === "number" ? val.toFixed(1) : val);
  };

  const draw = () => {
    const scale = (v[0] * u[0] + v[1] * u[1]) / (u[0] * u[0] + u[1] * u[1]);
    const p = [scale * u[0], scale * u[1]];
    set(part(root, "line-v"), { x2: X(v[0]), y2: Y(v[1]) });
    set(part(root, "line-p"), { x2: X(p[0]), y2: Y(p[1]) });
    set(part(root, "line-r"), { x1: X(p[0]), y1: Y(p[1]), x2: X(v[0]), y2: Y(v[1]) });
    set(part(root, "label-v"), { x: X(v[0] - 0.45), y: Y(v[1] + 0.1) });
    set(part(root, "label-p"), { x: X(p[0] - 0.1), y: Y(p[1] - 0.4) });
    set(handle, { cx: X(v[0]), cy: Y(v[1]) });
    const vt = `v = (${minus(v[0].toFixed(1))}, ${minus(v[1].toFixed(1))})`;
    handle.setAttribute("aria-valuetext", vt);
    readout.textContent = `${vt} · u = (4.0, 1.0) · scale = ${minus(scale.toFixed(3))} · p = (${minus(p[0].toFixed(2))}, ${minus(p[1].toFixed(2))})`;
  };
  const clampV = (x, y) => [Math.min(6.5, Math.max(-0.75, x)), Math.min(4.6, Math.max(-0.5, y))];

  let dragging = false;
  const toWorld = (e) => {
    const pt = fig.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(fig.getScreenCTM().inverse());
    return clampV((q.x - 40) / 40, (200 - q.y) / 40);
  };
  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    handle.classList.replace("cursor-grab", "cursor-grabbing");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    v = toWorld(e).map((c) => Math.round(c * 20) / 20);
    draw();
  });
  const end = () => {
    dragging = false;
    handle.classList.replace("cursor-grabbing", "cursor-grab");
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 1 : 0.25;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    v = clampV(v[0] + d[0], v[1] + d[1]);
    draw();
  });
  handle.addEventListener("focus", () => light("v"));
  handle.addEventListener("blur", () => light(null));
  draw();
}

// ============================================================ code ⇄ math cell

const pyFloat = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

for (const root of document.querySelectorAll("[data-prose-cell]")) {
  const rows = [...root.querySelectorAll("[data-pz-line]")];
  const outs = rows.map((r) => r.querySelector('[data-pz="out"]'));
  const input = part(root, "data");
  const msg = part(root, "data-msg");
  const code0 = rows[0].querySelector('[data-pz="code"]');
  let step = -1;

  const render = () => {
    rows.forEach((r, i) => {
      r.toggleAttribute("data-dim", step >= 0 && i > step);
      r.toggleAttribute("data-lit", i === step);
      outs[i].style.visibility = step >= 0 && i > step ? "hidden" : "";
    });
    status(root, step < 0 ? `${rows.length} lines` : `line ${step + 1} of ${rows.length}`);
  };

  for (const r of rows) {
    r.addEventListener("pointerenter", () => step < 0 && r.setAttribute("data-lit", ""));
    r.addEventListener("pointerleave", () => step < 0 && r.removeAttribute("data-lit"));
  }

  const recompute = () => {
    const parts = input.value.split(/[,\s]+/).filter(Boolean);
    const xs = parts.map(Number);
    if (xs.length < 2 || xs.some((x) => !Number.isFinite(x))) {
      input.setAttribute("aria-invalid", "true");
      msg.textContent = "Two or more numbers, separated by commas.";
      return;
    }
    input.removeAttribute("aria-invalid");
    msg.textContent = `${xs.length} values.`;
    const floats = parts.some((p) => /[.eE]/.test(p));
    const lit = floats ? xs.map(pyFloat) : xs.map(String);
    const n = xs.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const sq = xs.map((x) => (x - mean) ** 2);
    const variance = sq.reduce((a, b) => a + b, 0) / (n - 1);
    const vals = [`[${lit.join(", ")}]`, String(n), pyFloat(mean), `[${sq.map(pyFloat).join(", ")}]`, pyFloat(variance), pyFloat(Math.sqrt(variance))];
    vals.forEach((v, i) => {
      outs[i].textContent = v;
      outs[i].title = v;
    });
    const number = code0.firstElementChild;
    code0.replaceChildren(number);
    for (const t of tokenize(`xs = [${lit.join(", ")}]`)) {
      if (!t.cls) {
        code0.append(t.text);
        continue;
      }
      const span = document.createElement("span");
      span.className = `tok-${t.cls}`;
      span.textContent = t.text;
      code0.append(span);
    }
    rows[0].setAttribute("aria-label", `Line 1: xs = [${lit.join(", ")}]`);
  };

  input.addEventListener("input", recompute);
  part(root, "run").addEventListener("click", () => {
    step = step < 0 || step >= rows.length - 1 ? 0 : step + 1;
    render();
  });
  part(root, "reset").addEventListener("click", () => {
    step = -1;
    render();
  });
  render();
}
