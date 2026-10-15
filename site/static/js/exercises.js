// Exercises: multiple choice, matrix answers and progressive hints.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A short shake for a wrong answer: feedback the eye catches without
// reading. Skipped under reduced motion (the colors still say it).
function shake(node) {
  if (reduced()) return;
  node.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }],
    { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}

const panel = (ok, title, body) => `
  <div class="enter flex gap-3 rounded-lg border p-3 text-sm ${ok ? "border-add/40 bg-add/8" : "border-del/40 bg-del/8"}">
    <span class="mt-px font-mono text-xs ${ok ? "text-add" : "text-del"}">${ok ? "✓" : "✗"}</span>
    <div class="flex flex-col gap-1"><span class="font-medium">${title}</span><span class="text-muted-foreground">${body}</span></div>
  </div>`;

// ------------------------------------------------------------ quiz

for (const form of document.querySelectorAll("[data-quiz]")) {
  const submit = form.querySelector("[type=submit]");
  const feedback = form.querySelector("[data-feedback]");
  const attempts = form.querySelector("[data-attempts]");
  let tries = 0;
  let solved = false;

  form.addEventListener("change", () => {
    if (solved) return;
    submit.disabled = false;
    for (const c of form.querySelectorAll("[data-choice]")) delete c.dataset.state;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const picked = form.querySelector("input:checked");
    if (!picked || solved) return;
    const card = picked.closest("[data-choice]");
    const ok = card.dataset.correct === "true";
    tries++;
    attempts.textContent = `${tries} ${tries === 1 ? "attempt" : "attempts"}`;
    card.dataset.state = ok ? "right" : "wrong";
    feedback.innerHTML = ok
      ? panel(true, "Correct: a quarter turn counterclockwise.", card.dataset.why)
      : panel(false, "Not quite.", card.dataset.why);
    submit.disabled = true;
    if (ok) {
      solved = true;
      submit.textContent = "Solved";
      for (const i of form.querySelectorAll("input")) i.disabled = true;
    } else {
      shake(card);
    }
  });
}

// ------------------------------------------------------------ matrix answer

for (const form of document.querySelectorAll("[data-matrix-answer]")) {
  const cells = [...form.querySelectorAll("[data-cell]")];
  const feedback = form.querySelector("[data-feedback]");

  for (const c of cells) {
    c.addEventListener("input", () => {
      delete c.dataset.state;
      c.value = c.value.replace(/[^\d\-−]/g, "");
    });
  }
  form.addEventListener("reset", () => {
    for (const c of cells) delete c.dataset.state;
    feedback.innerHTML = "";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const wrong = [];
    for (const c of cells) {
      const v = parseInt(c.value.replace("−", "-"), 10);
      const ok = v === Number(c.dataset.answer);
      c.dataset.state = ok ? "right" : "wrong";
      if (!ok) wrong.push(c);
    }
    if (!wrong.length) {
      feedback.innerHTML = `<span class="enter inline-block text-add">All four entries are right.</span>`;
      return;
    }
    const [i, j] = wrong[0].dataset.cell;
    feedback.innerHTML = `<span class="enter inline-block text-muted-foreground">${wrong.length === 4 ? "None" : `${4 - wrong.length} of 4`} right. For entry (${i}, ${j}): row ${i} of A · column ${j} of B.</span>`;
    shake(wrong[0].parentElement);
    wrong[0].focus();
    wrong[0].select();
  });
}

// ------------------------------------------------------------ hints

for (const root of document.querySelectorAll("[data-hints]")) {
  const list = [...root.querySelectorAll("[data-hint]")];
  const answer = root.querySelector("[data-answer]");
  const next = root.querySelector("[data-next]");
  const count = root.querySelector("[data-count]");
  const hold = root.querySelector("[data-hold]");
  const fill = hold.querySelector("[data-fill]");
  let shown = 0;

  next.addEventListener("click", () => {
    if (shown >= list.length) return;
    list[shown++].hidden = false;
    count.textContent = `${shown} of ${list.length} hints`;
    if (shown === list.length) next.disabled = true;
  });

  // Hold to reveal: 1.2s linear fill while pressed, 200ms ease-out back.
  let timer = 0;
  const press = (e) => {
    if (e.type === "keydown" && e.key !== " " && e.key !== "Enter") return;
    if (e.type === "keydown") {
      if (e.repeat) return;
      e.preventDefault();
    }
    fill.style.transition = "clip-path 1200ms linear";
    fill.style.clipPath = "inset(0 0 0 0)";
    timer = setTimeout(reveal, 1200);
  };
  const release = () => {
    clearTimeout(timer);
    fill.style.transition = "clip-path 200ms cubic-bezier(0.23, 1, 0.32, 1)";
    fill.style.clipPath = "inset(0 100% 0 0)";
  };
  const reveal = () => {
    answer.hidden = false;
    hold.disabled = true;
    hold.firstElementChild.textContent = "Answer revealed";
    release();
  };
  hold.addEventListener("pointerdown", press);
  hold.addEventListener("keydown", press);
  for (const ev of ["pointerup", "pointerleave", "pointercancel", "keyup", "blur"]) hold.addEventListener(ev, release);
}
