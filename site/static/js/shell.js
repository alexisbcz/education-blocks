// Course shell: "Complete" marks the current lesson done and moves on.
// Finishing a lesson is rare and earned, so it gets a little delight: the
// check pops in (Emil: from 0.5, never 0, strong ease-out), and the
// chapter's "Done" chip fades in when its last lesson falls.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pop = (node, from = 0.5) =>
  !reduced() && node.animate([{ transform: `scale(${from})`, opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });

for (const root of document.querySelectorAll("[data-shell]")) {
  const links = [...root.querySelectorAll("[data-lesson]")];
  const bar = root.querySelector("[data-bar]");
  const count = root.querySelector("[data-count]");
  const progress = root.querySelector("[data-progress]");
  const button = root.querySelector("[data-complete]");
  const label = root.querySelector("[data-complete-label]");

  button.addEventListener("click", () => {
    const i = links.findIndex((a) => a.dataset.active === "true");
    if (i < 0) return;
    const a = links[i];
    const dot = a.querySelector("[data-lesson-dot]");
    dot.dataset.state = "done";
    pop(dot.querySelector("[data-check]"));
    a.dataset.active = "false";
    a.removeAttribute("aria-current");

    const group = a.closest("[data-chapter-group]");
    const dots = [...group.querySelectorAll("[data-lesson-dot]")];
    if (dots.every((d) => d.dataset.state === "done")) {
      const chip = group.querySelector("[data-chapter-check]");
      chip.hidden = false;
      pop(chip, 0.9);
    }

    const done = i + 1;
    bar.style.width = `${(100 * done) / links.length}%`;
    count.textContent = `${done}/${links.length}`;
    progress.setAttribute("aria-valuenow", done);

    const next = links[i + 1];
    if (next) {
      next.dataset.active = "true";
      next.querySelector("[data-lesson-dot]").dataset.state = "current";
      next.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
      label.textContent = `Complete “${next.dataset.lesson}”`;
    } else {
      button.disabled = true;
      label.textContent = "Course complete";
    }
  });
}
