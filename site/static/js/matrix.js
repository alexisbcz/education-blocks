// Matrix explorer: hovering or focusing an entry highlights its row and
// column and names it in the readout. Instant on purpose: hover happens
// dozens of times a minute, so it must not animate.

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).split("").map((d) => SUB[d]).join("");

for (const box of document.querySelectorAll("[data-matrix-explorer]")) {
  const cells = [...box.querySelectorAll("[data-i]")];
  const readout = box.querySelector("[data-readout]");
  const idle = readout.textContent;

  const show = (cell) => {
    for (const c of cells) {
      const hl = c === cell ? "cell" : cell && (c.dataset.i === cell.dataset.i || c.dataset.j === cell.dataset.j) ? "line" : "";
      if (hl) c.dataset.hl = hl; else delete c.dataset.hl;
    }
    readout.textContent = cell
      ? `a${sub(cell.dataset.i)}${sub(cell.dataset.j)} = ${cell.dataset.v} · row ${cell.dataset.i}, column ${cell.dataset.j}`
      : idle;
  };

  for (const c of cells) {
    c.addEventListener("pointerenter", () => show(c));
    c.addEventListener("focus", () => show(c));
  }
  box.querySelector(".matrix")?.addEventListener("pointerleave", () => show(null));
  box.addEventListener("focusout", (e) => { if (!box.contains(e.relatedTarget)) show(null); });
}
