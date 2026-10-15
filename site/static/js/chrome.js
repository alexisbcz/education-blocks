// Page chrome: theme toggle, copy buttons, the active link in the side nav.

const root = document.documentElement;

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-theme-toggle]")) {
    // Switch without transitions: every color would otherwise animate.
    const style = document.createElement("style");
    style.nonce = document.querySelector("script[nonce]")?.nonce ?? "";
    style.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.append(style);
    const dark = root.classList.toggle("dark");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
  }

  const copy = e.target.closest("[data-copy]");
  if (copy) {
    navigator.clipboard?.writeText(copy.dataset.copy).then(() => {
      copy.setAttribute("data-copied", "");
      clearTimeout(copy._t);
      copy._t = setTimeout(() => copy.removeAttribute("data-copied"), 1400);
    });
  }
});

// Side nav: mark the block nearest the top of the viewport.
const links = new Map([...document.querySelectorAll("[data-nav-link]")].map((a) => [a.dataset.navLink, a]));
if (links.size) {
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    const first = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (!first) return;
    for (const [slug, a] of links) a.dataset.active = String(slug === first.dataset.block);
  }, { rootMargin: "-20% 0px -60% 0px" });
  document.querySelectorAll("[data-block]").forEach((s) => io.observe(s));
}

// Segmented controls: [data-seg] buttons switch sibling [data-view] panels
// inside the nearest container that has both.
document.addEventListener("click", (e) => {
  const seg = e.target.closest("[data-seg]");
  if (!seg) return;
  const tablist = seg.closest("[role=tablist]");
  if (!tablist) return;
  for (const b of tablist.querySelectorAll("[data-seg]")) b.setAttribute("aria-selected", String(b === seg));
  tablist.dispatchEvent(new CustomEvent("seg-change", { bubbles: true, detail: { value: seg.dataset.seg } }));
  // Panels switch within the block the control belongs to.
  const scope = tablist.closest("[data-block]");
  if (!scope) return;
  for (const v of scope.querySelectorAll(":scope [data-view]")) {
    if (v.closest("[role=tablist]")) continue;
    v.hidden = v.dataset.view !== seg.dataset.seg;
  }
});

// Keep the current subject visible in the scrolling switcher.
const current = document.querySelector('nav[aria-label="Subjects"] [aria-current="page"]');
if (current) {
  const nav = current.parentElement;
  nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
}
