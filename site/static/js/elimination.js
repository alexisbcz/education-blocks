// Row reduction stepper: Back/Next, ←/→ on the focused stepper, Home/End.
// Keyboard steps happen often and instantly, so the change itself is not
// animated; only the changed row gets a short highlight.

for (const root of document.querySelectorAll("[data-stepper]")) {
  const steps = [...root.querySelectorAll("[data-step]")];
  const dots = [...root.querySelectorAll("[data-pip]")];
  const counter = root.querySelector("[data-counter]");
  const back = root.querySelector('[data-go="-1"]');
  const next = root.querySelector('[data-go="1"]');
  let at = 0;

  const go = (i) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => (s.hidden = k !== at));
    dots.forEach((d, k) => (k === at ? (d.dataset.on = "") : delete d.dataset.on));
    counter.textContent = `${at + 1} / ${steps.length}`;
    back.disabled = at === 0;
    next.disabled = at === steps.length - 1;
  };

  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: steps.length - 1 }[e.key];
    if (to === undefined || e.target.closest("button")) return;
    e.preventDefault();
    go(to);
  });
}
