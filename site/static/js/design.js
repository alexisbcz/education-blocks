// Art & Design blocks: colour harmonies, WCAG contrast, colour-vision
// simulation, type scale and measure, vertical rhythm, layout grid,
// composition guides, perspective, Gestalt examples and an easing editor.
// Colour maths: sRGB transfer function (IEC 61966-2-1), OKLab (Björn
// Ottosson, 2020), WCAG 2.x relative luminance, Machado et al. 2009.

import { scrubAll } from "./scrub.js";
import { el, text } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fx = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace("-", "−");

// ============================================================ colour maths

function hexToRgb(hex) {
  let s = String(hex).trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}
const rgbToHex = (rgb) => "#" + rgb.map((c) => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, "0")).join("");
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const hexToOklab = (hex) => linToOklab(hexToRgb(hex).map(toLinear));
function oklabToLch([L, a, b]) {
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}
const lchToOklab = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
const inGamut = (lin) => lin.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

// OKLCH → hex, lowering chroma at constant L and h until the colour fits
// in sRGB. Returns [hex, mapped?].
function lchToHex(L, C, h) {
  L = clamp(L, 0, 1);
  let lin = oklabToLin(lchToOklab([L, C, h]));
  if (inGamut(lin)) return [rgbToHex(lin.map(toGamma)), false];
  let lo = 0, hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLin(lchToOklab([L, mid, h])))) lo = mid; else hi = mid;
  }
  lin = oklabToLin(lchToOklab([L, lo, h])).map((c) => clamp(c, 0, 1));
  return [rgbToHex(lin.map(toGamma)), true];
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

// WCAG 2.x relative luminance and contrast ratio.
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// Readable label colour on a swatch.
const inkOn = (hex) => (contrast(hex, "#000000") >= contrast(hex, "#ffffff") ? "#000000" : "#ffffff");

// Paired colour picker + hex field, kept in sync. get/set by name.
function bindColors(root, onChange) {
  const pickers = Object.fromEntries([...root.querySelectorAll("[data-dsg-color]")].map((i) => [i.dataset.dsgColor, i]));
  const fields = Object.fromEntries([...root.querySelectorAll("[data-dsg-hex]")].map((i) => [i.dataset.dsgHex, i]));
  const values = Object.fromEntries(Object.entries(pickers).map(([k, i]) => [k, i.value]));
  const set = (name, hex, notify = true) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    values[name] = rgbToHex(rgb);
    pickers[name].value = values[name];
    if (document.activeElement !== fields[name]) fields[name].value = values[name];
    if (notify) onChange(name);
  };
  for (const name of Object.keys(pickers)) {
    pickers[name].addEventListener("input", () => set(name, pickers[name].value));
    fields[name].addEventListener("input", () => set(name, fields[name].value));
    fields[name].addEventListener("blur", () => (fields[name].value = values[name]));
  }
  return { get: (n) => values[n], set };
}

// ============================================================ D1 harmonies

const HARMONY = {
  complementary: [0, 180],
  analogous: [-60, -30, 0, 30, 60],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

for (const root of document.querySelectorAll("[data-dsg-harmonies]")) {
  const o = outs(root);
  let mode = "complementary";
  const colors = bindColors(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function swatch(hex, mapped, note) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.copy = hex;
    b.setAttribute("aria-label", `Copy ${hex}`);
    b.className = "relative flex h-20 flex-col justify-end rounded-lg border p-2 text-left font-mono text-[11px] leading-tight outline-none transition-[box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 [&[data-copied]]:ring-2 [&[data-copied]]:ring-brand";
    b.style.background = hex;
    b.style.color = inkOn(hex);
    const a = document.createElement("span");
    a.textContent = hex + (mapped ? " ◐" : "");
    const c = document.createElement("span");
    c.className = "opacity-75";
    c.textContent = note;
    b.append(a, c);
    return b;
  }

  function draw() {
    const base = colors.get("base");
    const [L, C, h] = oklabToLch(hexToOklab(base));
    const [hh, s, l] = rgbToHsl(hexToRgb(base));
    const offs = HARMONY[mode];
    for (const space of ["oklch", "hsl"]) {
      const row = root.querySelector(`[data-dsg-row="${space}"]`);
      row.replaceChildren();
      const Ls = [];
      for (const d of offs) {
        let hex, mapped = false;
        if (space === "oklch") [hex, mapped] = lchToHex(L, C, (h + d + 360) % 360);
        else hex = rgbToHex(hslToRgb([(hh + d + 360) % 360, s, l]));
        const Lk = hexToOklab(hex)[0];
        Ls.push(Lk);
        row.append(swatch(hex, mapped, `L ${fx(Lk)}${d === 0 ? " · base" : ` · ${d > 0 ? "+" : "−"}${Math.abs(d)}°`}`));
      }
      o[`spread-${space}`].textContent = `L spread ${fx(Math.max(...Ls) - Math.min(...Ls))}`;
    }
  }
  draw();
}

// ============================================================ D2 contrast

for (const root of document.querySelectorAll("[data-dsg-contrast]")) {
  const o = outs(root);
  const sample = root.querySelector("[data-dsg-sample]");
  const suggest = root.querySelector("[data-dsg-suggest]");
  const colors = bindColors(root, draw);
  root.querySelector("[data-action=swap]").addEventListener("click", () => {
    const f = colors.get("fg"), b = colors.get("bg");
    colors.set("fg", b, false);
    colors.set("bg", f);
  });

  const verdict = (node, ok) => {
    node.textContent = ok ? "Pass" : "Fail";
    node.className = "font-mono font-medium " + (ok ? "text-add" : "text-del");
  };

  // Nearest passing text colour: move OKLCH lightness only, both ways.
  function nearest(fg, bg, target) {
    let [L, C, h] = oklabToLch(hexToOklab(fg));
    if (C < 1e-3) C = 0; // greys stay grey
    let best = null;
    for (const dir of [-1, 1]) {
      const end = dir < 0 ? 0 : 1;
      if (contrast(lchToHex(end, C, h)[0], bg) < target) continue;
      let lo = L, hi = end; // lo fails, hi passes
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (contrast(lchToHex(mid, C, h)[0], bg) >= target) hi = mid; else lo = mid;
      }
      // Rounding to 8-bit can drop just below the target: nudge on.
      let Lp = hi, hex = lchToHex(Lp, C, h)[0];
      for (let k = 0; k < 50 && contrast(hex, bg) < target; k++) hex = lchToHex((Lp += dir * 0.002), C, h)[0];
      const dL = Math.abs(Lp - L);
      if (!best || dL < best.dL) best = { hex, dL };
    }
    return best;
  }

  function draw() {
    const fg = colors.get("fg"), bg = colors.get("bg");
    const r = contrast(fg, bg);
    sample.style.color = fg;
    sample.style.background = bg;
    o.ratio.textContent = `${(Math.round(r * 100) / 100).toFixed(2)}:1`;
    verdict(o.aa, r >= 4.5);
    verdict(o["aa-large"], r >= 3);
    verdict(o.aaa, r >= 7);
    verdict(o["aaa-large"], r >= 4.5);
    o.lfg.textContent = fx(luminance(fg), 4);
    o.lbg.textContent = fx(luminance(bg), 4);

    suggest.replaceChildren();
    for (const [target, label] of [[4.5, "AA"], [7, "AAA"]]) {
      if (r >= target) continue;
      const n = nearest(fg, bg, target);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "inline-flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-xs shadow-xs outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";
      if (!n) {
        const s = document.createElement("span");
        s.className = "text-xs text-muted-foreground";
        s.textContent = `No lightness reaches ${label} on this background.`;
        suggest.append(s);
        continue;
      }
      const dot = document.createElement("span");
      dot.className = "size-4 rounded-sm border";
      dot.style.background = n.hex;
      const t = document.createElement("span");
      t.textContent = `Use ${n.hex} for ${label} (${(Math.floor(contrast(n.hex, bg) * 100) / 100).toFixed(2)}:1)`;
      b.append(dot, t);
      b.addEventListener("click", () => colors.set("fg", n.hex));
      suggest.append(b);
    }
    if (!suggest.childElementCount) {
      const s = document.createElement("span");
      s.className = "text-xs text-muted-foreground";
      s.textContent = "Passes AAA for body text.";
      suggest.append(s);
    }
  }
  draw();
}

// ============================================================ D3 colour vision

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear RGB.
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
function simulate(hex, mode) {
  const lin = hexToRgb(hex).map(toLinear);
  let out;
  if (mode === "normal") out = lin;
  else if (mode === "achro") { const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]; out = [y, y, y]; }
  else out = CVD[mode].map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return rgbToHex(out.map((c) => toGamma(clamp(c, 0, 1))));
}

for (const root of document.querySelectorAll("[data-dsg-vision]")) {
  const pal = root.querySelector("[data-dsg-palette]");
  const chart = root.querySelector("[data-dsg-chart]");
  const warn = root.querySelector("[data-dsg-warn]");
  let mode = "normal";
  const colors = bindColors(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  const values = [62, 45, 78, 30, 54];

  function draw() {
    const src = [0, 1, 2, 3, 4].map((i) => colors.get(`c${i}`));
    const sim = src.map((c) => simulate(c, mode));
    pal.replaceChildren(...sim.map((c, i) => {
      const d = document.createElement("div");
      d.className = "flex flex-col overflow-hidden rounded-lg border";
      const big = document.createElement("div");
      big.className = "h-14";
      big.style.background = c;
      const strip = document.createElement("div");
      strip.className = "h-2";
      strip.style.background = src[i];
      strip.title = "original";
      const lab = document.createElement("div");
      lab.className = "px-1.5 py-1 font-mono text-[10px] text-muted-foreground";
      lab.textContent = `${i + 1} ${c}`;
      d.append(big, strip, lab);
      return d;
    }));

    chart.replaceChildren();
    const W = 520, H = 200, L = 30, B = 170, bw = 64, gap = (W - L - 20 - 5 * bw) / 4;
    for (let k = 0; k <= 4; k++) {
      const y = B - (k * 150) / 4;
      el("line", { x1: L, x2: W - 10, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.08" }, chart);
    }
    values.forEach((v, i) => {
      const x = L + i * (bw + gap);
      el("rect", { x, y: B - v * 1.5, width: bw, height: v * 1.5, rx: 3, style: `fill:${sim[i]}` }, chart);
      text(chart, x + bw / 2, B + 16, `Series ${i + 1}`, { "text-anchor": "middle" });
    });

    // Pairs that collapse: OKLab distance below 0.06 (≈ 3× a just-noticeable step).
    const lab = sim.map(hexToOklab);
    const close = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const d = Math.hypot(lab[i][0] - lab[j][0], lab[i][1] - lab[j][1], lab[i][2] - lab[j][2]);
      if (d < 0.06) close.push(`${i + 1} & ${j + 1} (ΔE ${fx(d * 100, 1)})`);
    }
    warn.replaceChildren();
    const s = document.createElement("span");
    s.className = close.length ? "text-del" : "text-add";
    s.textContent = close.length ? `Hard to tell apart: ${close.join(", ")}. Add a second cue: labels, patterns or lightness.` : "Every pair stays distinguishable (OKLab ΔE ≥ 6).";
    warn.append(s);
  }
  draw();
}

// ============================================================ D4 type scale

for (const root of document.querySelectorAll("[data-dsg-type]")) {
  const o = outs(root);
  const list = root.querySelector("[data-dsg-scale]");
  const para = root.querySelector("[data-dsg-measure]");
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-ratio]").forEach((b) => b.addEventListener("click", () => s.ratio.set(Number(b.dataset.ratio))));

  // Average characters per full line, measured on the rendered text.
  function measure() {
    const node = para.firstChild;
    if (!node) return 0;
    const range = document.createRange();
    const lines = new Map();
    const t = node.textContent;
    for (let i = 0; i < t.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getClientRects()[0];
      if (!r) continue;
      const key = Math.round(r.top);
      lines.set(key, (lines.get(key) ?? 0) + 1);
    }
    const counts = [...lines.values()];
    counts.pop(); // the last line is short
    return counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : t.length;
  }

  function draw() {
    const base = s.base.get(), ratio = s.ratio.get();
    list.replaceChildren();
    for (let k = 5; k >= -2; k--) {
      const px = base * ratio ** k;
      const row = document.createElement("div");
      row.className = "grid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] items-baseline gap-3 border-b border-dashed py-1 last:border-b-0 sm:grid-cols-[2.5rem_9.5rem_minmax(0,1fr)]";
      const step = document.createElement("span");
      step.className = "font-mono text-[11px] text-muted-foreground";
      step.textContent = k === 0 ? "base" : (k > 0 ? "+" : "−") + Math.abs(k);
      const size = document.createElement("span");
      size.className = "font-mono text-[11px] whitespace-nowrap tabular-nums";
      size.textContent = `${fx(px)} px`;
      const rem = document.createElement("span");
      rem.className = "hidden text-muted-foreground sm:inline";
      rem.textContent = ` · ${fx(px / 16, 3)}rem`;
      size.append(rem);
      const spec = document.createElement("span");
      spec.className = "truncate leading-tight font-medium tracking-tight";
      spec.style.fontSize = `${Math.min(px, 80)}px`;
      spec.textContent = k >= 3 ? "Display" : k >= 1 ? "Heading text" : k === 0 ? "Body text sets the base" : "Small print";
      if (px > 80) spec.title = `shown at 80 px; real size ${fx(px)} px`;
      row.append(step, size, spec);
      list.append(row);
    }
    para.style.fontSize = `${base}px`;
    para.style.maxWidth = `${s.width.get()}px`;
    para.style.lineHeight = String(s.leading.get());
    requestAnimationFrame(() => {
      const n = measure();
      const v = n < 45 ? "short" : n > 75 ? "long" : "comfortable";
      o.measure.textContent = `≈ ${Math.round(n)} characters per line · ${v}`;
      o.measure.className = "font-mono " + (v === "comfortable" ? "text-add" : "text-del");
    });
  }
  draw();
  new ResizeObserver(() => draw()).observe(para.parentElement);
}

// ============================================================ D5 vertical rhythm

for (const root of document.querySelectorAll("[data-dsg-rhythm]")) {
  const o = outs(root);
  const page = root.querySelector("[data-dsg-page]");
  const grid = root.querySelector("[data-dsg-baseline]");
  let showGrid = true;
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { if (k === "grid") { showGrid = on; draw(); } });

  function draw() {
    const unit = s.unit.get(), size = s.size.get(), hsize = s.hsize.get(), gap = s.gap.get();
    // Heading line height: smallest whole number of units ≥ 1.15 × size.
    const hline = Math.ceil((hsize * 1.15) / unit) * unit;
    page.style.fontSize = `${size}px`;
    page.style.lineHeight = `${unit}px`;
    root.querySelectorAll("[data-dsg-p]").forEach((p) => { p.style.margin = `0 0 ${gap * unit}px`; });
    root.querySelectorAll("[data-dsg-h]").forEach((h) => {
      h.style.fontSize = `${hsize}px`;
      h.style.lineHeight = `${hline}px`;
      h.style.fontWeight = "600";
      h.style.letterSpacing = "-0.01em";
      h.style.margin = h.dataset.dsgH === "1" ? "0" : `${unit}px 0 0`;
    });
    const top = parseFloat(getComputedStyle(page).paddingTop);
    grid.style.top = `${top}px`;
    grid.style.backgroundImage = showGrid
      ? `repeating-linear-gradient(to bottom, transparent 0 ${unit - 1}px, color-mix(in oklab, var(--brand) 35%, transparent) ${unit - 1}px ${unit}px)`
      : "none";
    o.hline.textContent = `${hline} px = ${hline / unit} units`;
    o.gapout.textContent = `${fx(gap * unit, 1)} px`;
    const on = Number.isInteger(gap);
    o.ongrid.textContent = on ? "yes" : `no: gaps add ${fx((gap % 1) * unit, 1)} px each`;
    o.ongrid.className = "tabular-nums " + (on ? "text-add" : "text-del");
  }
  draw();
}

// ============================================================ D6 layout grid

for (const root of document.querySelectorAll("[data-dsg-grid]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-dsg-cols]");
  const pre = root.querySelector("[data-dsg-css]");
  const copy = root.querySelector("[data-dsg-copy-wrap] [data-copy]");
  const s = scrubAll(root, draw);

  function draw() {
    const W = s.width.get(), n = Math.round(s.cols.get()), g = s.gutter.get(), m = s.margin.get();
    const start = clamp(Math.round(s.start.get()), 1, n);
    const span = clamp(Math.round(s.span.get()), 1, n - start + 1);
    const col = (W - 2 * m - (n - 1) * g) / n;
    const card = span * col + (span - 1) * g;
    const k = 620 / W, X = 10;
    svg.replaceChildren();
    el("rect", { x: X, y: 20, width: W * k, height: 200, rx: 4, style: "fill:none;stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (const x of [X, X + (W - m) * k])
      el("rect", { x, y: 20, width: m * k, height: 200, style: "fill:currentColor;fill-opacity:0.05" }, svg);
    if (col > 0) {
      for (let i = 0; i < n; i++)
        el("rect", { x: X + (m + i * (col + g)) * k, y: 20, width: col * k, height: 200, style: "fill:var(--brand);fill-opacity:0.12" }, svg);
      el("rect", { x: X + (m + (start - 1) * (col + g)) * k, y: 70, width: card * k, height: 100, rx: 6, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, svg);
      text(svg, X + (m + (start - 1) * (col + g) + card / 2) * k, 124, `${fx(card, 1)} px`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    } else {
      text(svg, 320, 124, "No room: margins and gutters exceed the width", { "text-anchor": "middle", class: "fill-del font-mono text-[12px]" });
    }
    text(svg, X, 14, `0`, {});
    text(svg, X + W * k, 14, `${W} px`, { "text-anchor": "end" });
    o.col.textContent = col > 0 ? `${fx(col, 2)} px` : "—";
    o.card.textContent = col > 0 ? `${fx(card, 2)} px (${span} cols)` : "—";
    o.content.textContent = `${W - 2 * m} px`;
    const css = `.container {
  max-width: ${W}px;
  padding-inline: ${m}px;
  display: grid;
  grid-template-columns: repeat(${n}, minmax(0, 1fr));
  column-gap: ${g}px;
}
.card {
  grid-column: ${start} / span ${span}; /* ${fx(card, 1)}px at full width */
}`;
    pre.textContent = css;
    copy.dataset.copy = css;
  }
  draw();
}

// ============================================================ D7 composition

for (const root of document.querySelectorAll("[data-dsg-compose]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-dsg-scene]");
  const W = 600, H = 371, PHI = (1 + Math.sqrt(5)) / 2;
  let sun = { x: 400, y: 120 }, hz = 245, overlay = "thirds", drag = null;
  root.addEventListener("seg-change", (e) => { overlay = e.detail.value; draw(); });

  const toSvg = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };

  function spiral() {
    let x = 0, y = 0, w = W, h = H, d = "";
    for (let i = 0; i < 10; i++) {
      const dir = i % 4;
      if (dir === 0) { const s = h; d += `${i ? "" : `M${x} ${y + s}`} A${s} ${s} 0 0 1 ${x + s} ${y}`; x += s; w -= s; }
      else if (dir === 1) { const s = w; d += ` A${s} ${s} 0 0 1 ${x + s} ${y + s}`; y += s; h -= s; }
      else if (dir === 2) { const s = h; d += ` A${s} ${s} 0 0 1 ${x + w - s} ${y + s}`; w -= s; }
      else { const s = w; d += ` A${s} ${s} 0 0 1 ${x} ${y + h - s}`; h -= s; }
      if (w < 1 || h < 1) break;
    }
    return d;
  }

  const guides = () => {
    const g = [];
    if (overlay === "thirds" || overlay === "both") g.push({ name: "third", xs: [W / 3, (2 * W) / 3], ys: [H / 3, (2 * H) / 3], color: "var(--brand)" });
    if (overlay === "golden" || overlay === "both") g.push({ name: "golden", xs: [W / PHI ** 2, W / PHI], ys: [H / PHI ** 2, H / PHI], color: "var(--vec-u)" });
    return g;
  };

  function nearestLine(v, size, axis) {
    const all = [
      { at: size / 3, label: `${axis === "x" ? "left" : "upper"} third` },
      { at: (2 * size) / 3, label: `${axis === "x" ? "right" : "lower"} third` },
      { at: size / PHI ** 2, label: `golden ${axis === "x" ? "left" : "upper"} line` },
      { at: size / PHI, label: `golden ${axis === "x" ? "right" : "lower"} line` },
    ];
    const best = all.reduce((a, b) => (Math.abs(b.at - v) < Math.abs(a.at - v) ? b : a));
    return Math.abs(best.at - v) / size < 0.025 ? best.label : null;
  }

  function draw() {
    svg.replaceChildren();
    el("rect", { x: 0, y: 0, width: W, height: hz, style: "fill:color-mix(in oklab, var(--vec-u) 14%, var(--background))" }, svg);
    el("rect", { x: 0, y: hz, width: W, height: H - hz, style: "fill:color-mix(in oklab, var(--ion-cl) 22%, var(--background))" }, svg);
    el("path", { d: `M0 ${hz} Q 150 ${hz - 40} 300 ${hz} T 600 ${hz}`, style: "fill:color-mix(in oklab, var(--ion-cl) 30%, var(--background));stroke:none" }, svg);
    const sunEl = el("circle", { cx: sun.x, cy: sun.y, r: 26, tabindex: 0, role: "slider", "aria-label": "Sun", class: "cursor-grab outline-none focus-visible:stroke-[3px]", style: "fill:var(--vec-out);stroke:var(--foreground);stroke-opacity:0.4;stroke-width:1.5" }, svg);
    for (const g of guides()) {
      for (const x of g.xs) el("line", { x1: x, x2: x, y1: 0, y2: H, style: `stroke:${g.color};stroke-width:1.25;stroke-dasharray:5 4` }, svg);
      for (const y of g.ys) el("line", { x1: 0, x2: W, y1: y, y2: y, style: `stroke:${g.color};stroke-width:1.25;stroke-dasharray:5 4` }, svg);
      if (g.name === "golden") el("path", { d: spiral(), style: `fill:none;stroke:${g.color};stroke-width:1.5;stroke-opacity:0.8` }, svg);
    }
    const hzEl = el("line", { x1: 0, x2: W, y1: hz, y2: hz, tabindex: 0, role: "slider", "aria-label": "Horizon", class: "cursor-ns-resize outline-none", style: "stroke:transparent;stroke-width:16" }, svg);
    el("line", { x1: 0, x2: W, y1: hz, y2: hz, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1", class: "pointer-events-none" }, svg);
    el("rect", { x: W - 26, y: hz - 7, width: 20, height: 14, rx: 4, class: "pointer-events-none", style: "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.5" }, svg);
    bind(sunEl, "sun");
    bind(hzEl, "hz");
    sunEl.parentNode.append(sunEl); // keep the sun above the guides
    o.sun.textContent = `${fx(sun.x / W)} × ${fx(sun.y / H)}`;
    o.horizon.textContent = `${fx(hz / H)} of height`;
    const parts = [];
    const sx = nearestLine(sun.x, W, "x"), sy = nearestLine(sun.y, H, "y"), hy = nearestLine(hz, H, "y");
    if (sx || sy) parts.push(`sun on ${[sx, sy].filter(Boolean).join(" & ")}`);
    if (hy) parts.push(`horizon on ${hy}`);
    o.near.textContent = parts.join("; ") || "on no guide line";
  }

  function bind(node, what) {
    node.addEventListener("pointerdown", (e) => { drag = what; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
    node.addEventListener("keydown", (e) => {
      const d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
      if (!d) return;
      e.preventDefault();
      if (what === "sun") sun = { x: clamp(sun.x + d[0], 26, W - 26), y: clamp(sun.y + d[1], 26, H - 26) };
      else hz = clamp(hz + d[1], 40, H - 30);
      draw();
      svg.querySelector(`[aria-label="${what === "sun" ? "Sun" : "Horizon"}"]`)?.focus();
    });
  }
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toSvg(e);
    if (drag === "sun") sun = { x: clamp(p.x, 26, W - 26), y: clamp(p.y, 26, H - 26) };
    else hz = clamp(p.y, 40, H - 30);
    draw();
  });
  svg.addEventListener("pointerup", () => (drag = null));
  svg.addEventListener("pointercancel", () => (drag = null));
  draw();
}

// ============================================================ D8 perspective

for (const root of document.querySelectorAll("[data-dsg-persp]")) {
  const svg = root.querySelector("[data-dsg-canvas]");
  const W = 640, H = 400;
  let mode = "two", lines = true, drag = null;
  const st = { hz: 160, v1: 50, v2: 590, vc: 330, cx: 300, cy: 300 };
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  onToggle(root, (k, on) => { if (k === "lines") { lines = on; draw(); } });

  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  // Intersection of lines p1→p2 and p3→p4.
  function cross(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-9) return null;
    const a = p1.x * p2.y - p1.y * p2.x, b = p3.x * p4.y - p3.y * p4.x;
    return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d };
  }
  const poly = (pts, style) => el("path", { d: "M" + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L") + " Z", style }, svg);
  const seg = (a, b, style) => el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, style }, svg);
  const guide = "stroke:var(--vec-u);stroke-opacity:0.45;stroke-width:1;stroke-dasharray:4 4";
  const edge = "stroke:var(--foreground);stroke-width:1.75;stroke-linejoin:round";
  const hidden = "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1;stroke-dasharray:3 3";

  function draw() {
    svg.replaceChildren();
    const bh = s.bh.get(), bw = s.bw.get(), bd = s.bd.get();
    seg({ x: 0, y: st.hz }, { x: W, y: st.hz }, "stroke:var(--foreground);stroke-opacity:0.4;stroke-width:1");
    text(svg, W - 8, st.hz - 6, "horizon (eye level)", { "text-anchor": "end" });
    const C = { x: st.cx, y: st.cy }, T0 = { x: st.cx, y: st.cy - bh };
    const face = (pts, k) => poly(pts, `fill:color-mix(in oklab, var(--brand) ${k}%, var(--background));stroke:none`);
    if (mode === "two") {
      const V1 = { x: st.v1, y: st.hz }, V2 = { x: st.v2, y: st.hz };
      const Br = lerp(C, V2, bw), Tr = lerp(T0, V2, bw), Bl = lerp(C, V1, bd), Tl = lerp(T0, V1, bd);
      const Bb = cross(Br, V1, Bl, V2), Tb = cross(Tr, V1, Tl, V2);
      if (lines) for (const p of [C, T0, Br, Tr, Bl, Tl]) { seg(p, V1, guide); seg(p, V2, guide); }
      face([C, Bl, Tl, T0], 18);
      face([C, Br, Tr, T0], 30);
      if (Tb && T0.y > st.hz) face([T0, Tl, Tb, Tr], 10);
      if (Bb && C.y < st.hz) face([C, Bl, Bb, Br], 10);
      for (const [a, b] of [[C, T0], [C, Br], [C, Bl], [T0, Tr], [T0, Tl], [Br, Tr], [Bl, Tl]]) seg(a, b, edge);
      if (Tb) for (const [a, b] of [[Tl, Tb], [Tr, Tb]]) seg(a, b, T0.y > st.hz ? edge : hidden);
      if (Bb) for (const [a, b] of [[Bl, Bb], [Br, Bb]]) seg(a, b, C.y < st.hz ? edge : hidden);
      if (Tb && Bb) seg(Bb, Tb, hidden);
      handles([{ id: "v1", x: V1.x, y: V1.y, label: "Left vanishing point" }, { id: "v2", x: V2.x, y: V2.y, label: "Right vanishing point" }]);
    } else {
      const V = { x: st.vc, y: st.hz };
      const w = bw * 360;
      const F = [C, { x: C.x + w, y: C.y }, { x: C.x + w, y: C.y - bh }, T0];
      const Bk = F.map((p) => lerp(p, V, bd));
      if (lines) for (const p of F) seg(p, V, guide);
      if (T0.y > st.hz) face([F[3], F[2], Bk[2], Bk[3]], 10);
      if (C.y < st.hz) face([F[0], F[1], Bk[1], Bk[0]], 10);
      if (V.x > C.x + w) face([F[1], F[2], Bk[2], Bk[1]], 18);
      if (V.x < C.x) face([F[0], F[3], Bk[3], Bk[0]], 18);
      face(F, 30);
      for (let i = 0; i < 4; i++) {
        seg(F[i], F[(i + 1) % 4], edge);
        seg(Bk[i], Bk[(i + 1) % 4], hidden);
        seg(F[i], Bk[i], edge);
      }
      handles([{ id: "vc", x: V.x, y: V.y, label: "Vanishing point" }]);
    }
    handles([{ id: "hz", x: 18, y: st.hz, label: "Horizon" }, { id: "c", x: C.x, y: C.y, label: "Near corner" }]);
  }

  function handles(list) {
    for (const hd of list) {
      const c = el("circle", { cx: hd.x, cy: hd.y, r: 8, tabindex: 0, role: "slider", "aria-label": hd.label, "data-h": hd.id,
        class: "cursor-grab outline-none focus-visible:stroke-[3px]", style: "fill:var(--background);stroke:var(--brand);stroke-width:2" }, svg);
      c.addEventListener("pointerdown", (e) => { drag = hd.id; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
      c.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
        if (!d) return;
        e.preventDefault();
        move(hd.id, hd.x + d[0], hd.y + d[1]);
        svg.querySelector(`[data-h="${hd.id}"]`)?.focus();
      });
    }
  }
  function move(id, x, y) {
    x = clamp(x, 0, W); y = clamp(y, 0, H);
    if (id === "hz") st.hz = clamp(y, 30, H - 30);
    else if (id === "v1") st.v1 = Math.min(x, st.cx - 20);
    else if (id === "v2") st.v2 = Math.max(x, st.cx + 20);
    else if (id === "vc") st.vc = x;
    else if (id === "c") { st.cx = clamp(x, st.v1 + 20, st.v2 - 20); st.cy = clamp(y, 40, H - 10); }
    draw();
  }
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    move(drag, q.x, q.y);
  });
  for (const ev of ["pointerup", "pointercancel"]) svg.addEventListener(ev, () => (drag = null));
  draw();
}

// ============================================================ D9 Gestalt

const GESTALT = {
  proximity(svg, flip) {
    const dx = flip ? 44 : 22, dy = flip ? 18 : 30;
    const ox = 120 - (5 * dx) / 2, oy = 70 - (3 * dy) / 2;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) el("circle", { cx: ox + c * dx, cy: oy + r * dy, r: 5, style: "fill:var(--foreground)" }, svg);
  },
  similarity(svg, flip) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const odd = flip ? r % 2 : c % 2;
      el("circle", { cx: 50 + c * 28, cy: 28 + r * 28, r: 6, style: `fill:${odd ? "var(--brand)" : "var(--foreground)"}` }, svg);
    }
  },
  closure(svg, flip) {
    const n = 8, gap = flip ? 0.6 : 0.18, R = 48;
    for (let i = 0; i < n; i++) {
      const a0 = ((i + gap / 2) / n) * 2 * Math.PI, a1 = ((i + 1 - gap / 2) / n) * 2 * Math.PI;
      const p = (a) => `${120 + R * Math.cos(a)} ${70 + R * Math.sin(a)}`;
      el("path", { d: `M${p(a0)} A${R} ${R} 0 0 1 ${p(a1)}`, style: "fill:none;stroke:var(--foreground);stroke-width:4;stroke-linecap:round" }, svg);
    }
  },
  continuity(svg, flip) {
    const curve = Array.from({ length: 41 }, (_, i) => [20 + i * 5, 70 - 45 * Math.sin((i / 40) * Math.PI * 1.5)]);
    const line = Array.from({ length: 41 }, (_, i) => [20 + i * 5, 110 - i * 2]);
    const path = (pts) => "M" + pts.map((p) => p.join(" ")).join(" L");
    if (!flip) {
      el("path", { d: path(curve), style: "fill:none;stroke:var(--foreground);stroke-width:3" }, svg);
      el("path", { d: path(line), style: "fill:none;stroke:var(--foreground);stroke-width:3" }, svg);
      return;
    }
    // Same strokes, coloured as two bent paths: the smooth reading resists.
    // Swap partners exactly where the two strokes cross.
    let k = 1;
    for (let i = 1; i < curve.length; i++) if (Math.abs(curve[i][1] - line[i][1]) < Math.abs(curve[k][1] - line[k][1])) k = i;
    el("path", { d: path([...curve.slice(0, k), ...line.slice(k)]), style: "fill:none;stroke:var(--brand);stroke-width:3" }, svg);
    el("path", { d: path([...line.slice(0, k), ...curve.slice(k)]), style: "fill:none;stroke:var(--vec-u);stroke-width:3" }, svg);
  },
  "figure-ground"(svg, flip) {
    // A symmetric vase whose two edges are facing profiles (after Rubin,
    // 1915): forehead, nose, lips and chin are where the vase narrows.
    const prof = [[36, 0], [33, 14], [30, 30], [16, 42], [27, 50], [22, 58], [28, 64], [24, 72], [30, 84], [38, 100], [44, 120], [48, 140]];
    const smooth = (pts) => {
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        d += ` Q${x0} ${(y0 + y1) / 2} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
        if (i === pts.length - 1) d += ` L${x1} ${y1}`;
      }
      return d;
    };
    const right = prof.map(([x, y]) => [120 + x, y]);
    const left = prof.map(([x, y]) => [120 - x, y]).reverse();
    const vase = smooth(right) + " L" + smooth(left).slice(1) + " Z";
    el("rect", { x: 30, y: 0, width: 180, height: 140, style: `fill:${flip ? "var(--foreground)" : "var(--background)"};stroke:currentColor;stroke-opacity:0.15` }, svg);
    el("path", { d: vase, style: `fill:${flip ? "var(--background)" : "var(--foreground)"}` }, svg);
  },
};

for (const root of document.querySelectorAll("[data-dsg-gestalt]")) {
  for (const card of root.querySelectorAll("[data-dsg-gestalt-card]")) {
    const key = card.dataset.dsgGestaltCard;
    const svg = card.querySelector("[data-dsg-g]");
    const btn = card.querySelector("[data-action=flip]");
    let flip = false;
    const draw = () => { svg.replaceChildren(); GESTALT[key](svg, flip); };
    btn.addEventListener("click", () => {
      flip = !flip;
      btn.setAttribute("aria-pressed", String(flip));
      btn.textContent = flip ? "Restore" : "Change";
      draw();
    });
    draw();
  }
}

// ============================================================ D10 easing

// y(x) of a CSS cubic-bezier, by solving x(t) = x with Newton then bisection.
function bezierY(p, x) {
  const [x1, y1, x2, y2] = p;
  const bx = (t) => 3 * x1 * (1 - t) ** 2 * t + 3 * x2 * (1 - t) * t * t + t ** 3;
  const by = (t) => 3 * y1 * (1 - t) ** 2 * t + 3 * y2 * (1 - t) * t * t + t ** 3;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 30; i++) {
    const v = bx(t) - x;
    if (Math.abs(v) < 1e-7) break;
    if (v > 0) hi = t; else lo = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

for (const root of document.querySelectorAll("[data-dsg-easing]")) {
  const svg = root.querySelector("[data-dsg-curve]");
  const ball = root.querySelector("[data-dsg-ball]");
  const box = root.querySelector("[data-dsg-box]");
  const pre = root.querySelector("[data-dsg-easing-css]");
  const copy = pre.parentElement.querySelector("[data-copy]");
  const warn = root.querySelector("[data-dsg-easing-warn]");
  const S = 240;
  let p = [0.23, 1, 0.32, 1], drag = -1, forward = true;
  const s = scrubAll(root, () => draw());
  const easing = () => `cubic-bezier(${p.map((v) => +v.toFixed(3)).join(", ")})`;
  const X = (v) => v * S, Y = (v) => (1 - v) * S;

  function draw() {
    svg.replaceChildren();
    el("rect", { x: 0, y: 0, width: S, height: S, style: "fill:none;stroke:currentColor;stroke-opacity:0.2" }, svg);
    for (let k = 1; k < 4; k++) {
      el("line", { x1: (k * S) / 4, x2: (k * S) / 4, y1: 0, y2: S, style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
      el("line", { y1: (k * S) / 4, y2: (k * S) / 4, x1: 0, x2: S, style: "stroke:currentColor;stroke-opacity:0.06" }, svg);
    }
    text(svg, 0, S + 16, "time →", {});
    text(svg, -6, 4, "progress", { "text-anchor": "end", transform: `rotate(-90 -6 4)` });
    el("line", { x1: 0, y1: S, x2: X(p[0]), y2: Y(p[1]), style: "stroke:var(--vec-u);stroke-width:1.25" }, svg);
    el("line", { x1: S, y1: 0, x2: X(p[2]), y2: Y(p[3]), style: "stroke:var(--vec-u);stroke-width:1.25" }, svg);
    const pts = Array.from({ length: 101 }, (_, i) => { const x = i / 100; return `${X(x)},${Y(bezierY(p, x))}`; });
    el("polyline", { points: pts.join(" "), style: "fill:none;stroke:var(--brand);stroke-width:2.5;stroke-linecap:round" }, svg);
    [[p[0], p[1]], [p[2], p[3]]].forEach(([x, y], i) => {
      const c = el("circle", { cx: X(x), cy: Y(y), r: 8, tabindex: 0, role: "slider", "aria-label": `Handle ${i + 1}: ${fx(x)}, ${fx(y)}`, "data-h": i,
        class: "cursor-grab outline-none focus-visible:stroke-[3px]", style: "fill:var(--background);stroke:var(--vec-u);stroke-width:2" }, svg);
      c.addEventListener("pointerdown", (e) => { drag = i; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
      c.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] }[e.key];
        if (!d) return;
        e.preventDefault();
        set(i, p[i * 2] + d[0], p[i * 2 + 1] + d[1]);
        svg.querySelector(`[data-h="${i}"]`)?.focus();
      });
    });
    const css = `transition: transform ${s.dur.get()}ms ${easing()};`;
    pre.textContent = css;
    copy.dataset.copy = css;
    const notes = [];
    if (p[1] < p[0] - 0.05 && p[3] >= 0.95 && p[2] > 0.6) notes.push("Starts slowly (ease-in): avoid it for interface motion; it feels sluggish to respond.");
    if (s.dur.get() > 300) notes.push("Longer than 300 ms: fine for explanatory motion, slow for frequent interface feedback.");
    warn.textContent = notes.join(" ");
    warn.className = "min-h-4 text-xs " + (notes.length ? "text-del" : "text-muted-foreground");
  }

  function set(i, x, y) {
    p[i * 2] = clamp(+x.toFixed(3), 0, 1);
    p[i * 2 + 1] = clamp(+y.toFixed(3), -0.5, 1.5);
    draw();
  }

  function play() {
    if (reduced()) return;
    const dist = ball.parentElement.clientWidth - ball.offsetWidth - 16;
    const opts = { duration: s.dur.get(), easing: easing(), fill: "forwards" };
    const a = forward ? 0 : dist, b = forward ? dist : 0;
    ball.animate([{ transform: `translate(${a}px, -50%)` }, { transform: `translate(${b}px, -50%)` }], opts);
    box.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "scale(1)" }], opts);
    forward = !forward;
  }

  svg.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    const q = svg.createSVGPoint();
    q.x = e.clientX; q.y = e.clientY;
    const r = q.matrixTransform(svg.getScreenCTM().inverse());
    set(drag, r.x / S, 1 - r.y / S);
  });
  for (const ev of ["pointerup", "pointercancel"]) svg.addEventListener(ev, () => { if (drag >= 0) { drag = -1; play(); } });
  root.querySelectorAll("[data-easing]").forEach((b) => b.addEventListener("click", () => {
    p = b.dataset.easing.split(" ").map(Number);
    draw();
    play();
  }));
  root.querySelector("[data-action=play]").addEventListener("click", play);
  draw();
}
