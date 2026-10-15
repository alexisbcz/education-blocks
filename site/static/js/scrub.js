// Scrubbable numbers: drag sideways to change, arrow keys to step
// (Shift: ×10), click to type. Values are clamped and rounded to the step.

export function scrubbable(input, { min = -5, max = 5, step = 0.1, onChange }) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const show = (v) => (input.value = Number(v.toFixed(decimals)).toString().replace("-", "−"));
  let value = parse(input.value) ?? 0;

  function parse(s) {
    const v = parseFloat(String(s).replace("−", "-").replace(",", "."));
    return Number.isFinite(v) ? v : null;
  }

  const set = (v, notify = true) => {
    value = clamp(v);
    show(value);
    if (notify) onChange?.(value);
  };

  let start = null;
  input.addEventListener("pointerdown", (e) => {
    if (document.activeElement === input || e.button !== 0) return;
    e.preventDefault();
    start = { x: e.clientX, v: value, moved: false };
    input.setPointerCapture(e.pointerId);
  });
  input.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (!start.moved && Math.abs(dx) < 3) return;
    start.moved = true;
    input.dataset.scrubbing = "";
    set(start.v + dx * step * 0.25 * (e.shiftKey ? 0.2 : 1));
  });
  const end = () => {
    if (!start) return;
    const clicked = !start.moved;
    start = null;
    delete input.dataset.scrubbing;
    if (clicked) {
      input.focus();
      input.select();
    }
  };
  input.addEventListener("pointerup", end);
  input.addEventListener("pointercancel", end);

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      set(value + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
      input.select();
    } else if (e.key === "Enter") {
      input.blur();
    } else if (e.key === "Escape") {
      show(value);
      input.blur();
    }
  });
  input.addEventListener("change", () => {
    const v = parse(input.value);
    v === null ? show(value) : set(v);
  });

  return { get: () => value, set };
}

/** Makes every [data-scrub] input under root scrubbable, reading its range
 *  from data-min, data-max and data-step. Returns them by name. */
export function scrubAll(root, onChange) {
  const out = {};
  for (const input of root.querySelectorAll("[data-scrub]")) {
    const d = input.dataset;
    out[d.scrub] = scrubbable(input, {
      min: Number(d.min ?? -5), max: Number(d.max ?? 5), step: Number(d.step ?? 0.1),
      onChange: () => onChange?.(d.scrub),
    });
  }
  return out;
}
