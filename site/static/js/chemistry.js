// Chemistry blocks. Every number comes from a computation here or from
// the element table rendered by site/chemistry_elements.go: formulas are
// parsed, equations balanced in exact rational arithmetic, pH solved from
// the charge balance, equilibria solved for the extent of reaction.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const R = 8.314462618; // J/(mol·K)
const NA = 6.02214076e23; // 1/mol, exact
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };

/** Digits in a formula become subscripts: C3H8 → C<sub>3</sub>H<sub>8</sub>. */
const formulaHTML = (f) => esc(f).replace(/(\d+)/g, "<sub>$1</sub>");

/** 6.02e23 → "6.022 × 10²³". */
function sci(v, digits = 4) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return num(v, Math.max(0, digits - 1 - e));
  const m = v / 10 ** e;
  return `${m.toFixed(digits - 1)} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
}

const massTable = (root) => Object.fromEntries(root.dataset.elements.split(",").map((p) => { const [s, m] = p.split(":"); return [s, Number(m)]; }));

// ============================================================ Formulas

/** Parses a formula (parentheses, brackets, hydrates with · . or *) into
 *  element counts. Throws with a readable message. */
function parseFormula(src, masses) {
  const counts = {};
  const add = (into, sym, n) => (into[sym] = (into[sym] ?? 0) + n);
  for (const part0 of src.trim().split(/[·.*]/)) {
    let part = part0.trim();
    if (!part) throw new Error("empty part in formula");
    let mult = 1;
    const m = part.match(/^(\d+)(?=[A-Z(\[])/);
    if (m) { mult = Number(m[1]); part = part.slice(m[1].length); }
    let i = 0;
    const group = (close) => {
      const c = {};
      while (i < part.length) {
        const ch = part[i];
        if (ch === "(" || ch === "[") {
          i++;
          const inner = group(ch === "(" ? ")" : "]");
          const n = readNum();
          for (const [s, k] of Object.entries(inner)) add(c, s, k * n);
        } else if (ch === ")" || ch === "]") {
          if (ch !== close) throw new Error(`unexpected “${ch}”`);
          i++;
          return c;
        } else if (/[A-Z]/.test(ch)) {
          let sym = ch;
          i++;
          if (i < part.length && /[a-z]/.test(part[i])) sym += part[i++];
          if (!(sym in masses)) throw new Error(`unknown element “${sym}”`);
          add(c, sym, readNum());
        } else {
          throw new Error(`unexpected “${ch}”`);
        }
      }
      if (close) throw new Error(`missing “${close}”`);
      return c;
    };
    const readNum = () => {
      const m2 = part.slice(i).match(/^\d+/);
      if (!m2) return 1;
      i += m2[0].length;
      return Number(m2[0]);
    };
    for (const [s, k] of Object.entries(group(null))) add(counts, s, k * mult);
  }
  if (!Object.keys(counts).length) throw new Error("no elements");
  return counts;
}

const molarMass = (counts, masses) => Object.entries(counts).reduce((a, [s, n]) => a + masses[s] * n, 0);

// ============================================================ Exact balancing

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const frac = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
const fsub = (a, b) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fmul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
const fdiv = (a, b) => frac(a[0] * b[1], a[1] * b[0]);

/** Splits "A + B -> C" into species, dropping any coefficients typed in. */
function parseEquation(src) {
  const sides = src.split(/->|→|⇌|=/);
  if (sides.length !== 2) throw new Error("write the equation as reactants -> products");
  const species = (s) => s.split("+").map((x) => x.trim().replace(/^\d+\s*(?=[A-Z(\[])/, "")).filter(Boolean);
  const [l, r] = sides.map(species);
  if (!l.length || !r.length) throw new Error("both sides need at least one species");
  return { reactants: l, products: r };
}

/** Balances an equation; returns integer coefficients or throws. */
function balance(eq, masses) {
  const species = [...eq.reactants, ...eq.products];
  const comps = species.map((f) => parseFormula(f, masses));
  const elementsUsed = [...new Set(comps.flatMap((c) => Object.keys(c)))];
  // Atom-count matrix: reactants positive, products negative.
  const M = elementsUsed.map((e) => comps.map((c, j) => frac(BigInt((c[e] ?? 0) * (j < eq.reactants.length ? 1 : -1)))));
  const rows = M.length, cols = species.length;
  const pivots = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    const p = M.findIndex((row, i) => i >= r && row[c][0] !== 0n);
    if (p < 0) continue;
    [M[r], M[p]] = [M[p], M[r]];
    const pv = M[r][c];
    M[r] = M[r].map((v) => fdiv(v, pv));
    for (let i = 0; i < rows; i++) {
      if (i !== r && M[i][c][0] !== 0n) {
        const f = M[i][c];
        M[i] = M[i].map((v, k) => fsub(v, fmul(f, M[r][k])));
      }
    }
    pivots.push(c);
    r++;
  }
  const free = [...Array(cols).keys()].filter((c) => !pivots.includes(c));
  if (free.length === 0) throw new Error("this equation cannot be balanced: check the formulas");
  if (free.length > 1) throw new Error("more than one independent balance exists: this is probably two reactions written as one");
  const f = free[0];
  const x = Array.from({ length: cols }, () => frac(0n));
  x[f] = frac(1n);
  pivots.forEach((c, i) => (x[c] = frac(-M[i][f][0], M[i][f][1])));
  const lcm = x.reduce((l, [, d]) => (l * d) / gcd(l, d), 1n);
  let ints = x.map(([n, d]) => (n * lcm) / d);
  const g = ints.reduce((a, b) => gcd(a, b), 0n);
  ints = ints.map((v) => v / g);
  if (ints.every((v) => v <= 0n)) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= 0n)) throw new Error("no balance with all coefficients positive: check which side each species is on");
  return { coeffs: ints.map(Number), comps, elementsUsed };
}

const equationHTML = (eq, coeffs) => {
  const term = (f, c) => `${c > 1 ? `<span class="text-brand font-medium">${c}</span>` : ""}${formulaHTML(f)}`;
  const side = (fs, off) => fs.map((f, i) => term(f, coeffs[off + i])).join(' <span class="text-muted-foreground">+</span> ');
  return `${side(eq.reactants, 0)} <span class="text-muted-foreground">→</span> ${side(eq.products, eq.reactants.length)}`;
};

for (const root of document.querySelectorAll("[data-balancer]")) {
  const masses = massTable(root);
  const input = root.querySelector("[data-input=equation]");
  const result = root.querySelector("[data-result]");
  const check = root.querySelector("[data-check]");
  const run = () => {
    input.removeAttribute("aria-invalid");
    try {
      const eq = parseEquation(input.value);
      const { coeffs, comps, elementsUsed } = balance(eq, masses);
      result.innerHTML = `<span class="font-mono enter">${equationHTML(eq, coeffs)}</span>`;
      const nl = eq.reactants.length;
      const count = (e, from, to) => comps.slice(from, to).reduce((a, c, j) => a + (c[e] ?? 0) * coeffs[from + j], 0);
      check.innerHTML = `<table class="w-full text-sm"><thead><tr class="border-b text-left text-xs text-muted-foreground"><th class="py-1.5 font-normal">Element</th><th class="py-1.5 text-right font-normal">Reactants</th><th class="py-1.5 text-right font-normal">Products</th><th class="w-8"></th></tr></thead><tbody class="font-mono">${elementsUsed
        .map((e) => { const a = count(e, 0, nl), b = count(e, nl, comps.length); return `<tr class="border-b last:border-b-0"><td class="py-1.5">${e}</td><td class="py-1.5 text-right tabular-nums">${a}</td><td class="py-1.5 text-right tabular-nums">${b}</td><td class="text-right ${a === b ? "text-add" : "text-del"}">${a === b ? "✓" : "✗"}</td></tr>`; })
        .join("")}</tbody></table>`;
    } catch (err) {
      input.setAttribute("aria-invalid", "true");
      result.innerHTML = `<span class="text-sm text-del enter">${esc(err.message)}</span>`;
      check.innerHTML = "";
    }
  };
  root.addEventListener("submit", (e) => { e.preventDefault(); run(); });
  root.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.example; run(); }));
  run();
}

// ============================================================ Molar mass & limiting reagent

const PALETTE = ["var(--brand)", "var(--vec-u)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)", "var(--ion-ca)"];

for (const root of document.querySelectorAll("[data-molar]")) {
  const masses = massTable(root);
  const o = outs(root);
  const fInput = root.querySelector("[data-input=formula]");
  const rInput = root.querySelector("[data-input=reaction]");
  const bar = root.querySelector("[data-bar]");
  const breakdown = root.querySelector("[data-breakdown]");
  const balancedEl = root.querySelector("[data-balanced]");
  const massesEl = root.querySelector("[data-masses]");
  const yieldEl = root.querySelector("[data-yield]");
  const s = scrubAll(root, () => convert());
  let M = NaN;

  function formula() {
    fInput.removeAttribute("aria-invalid");
    try {
      const c = parseFormula(fInput.value, masses);
      M = molarMass(c, masses);
      o.mm.textContent = num(M, 3);
      const rows = Object.entries(c).map(([e, n], i) => ({ e, n, m: masses[e] * n, color: PALETTE[i % PALETTE.length] }));
      bar.innerHTML = rows.map((r) => `<span title="${r.e}" style="width:${(100 * r.m) / M}%;background:${r.color}"></span>`).join("");
      breakdown.innerHTML = `<div class="grid grid-cols-[auto_auto_1fr_auto] gap-x-4 gap-y-1">${rows
        .map((r) => `<span class="flex items-center gap-1.5"><span class="size-2 rounded-full" style="background:${r.color}"></span>${r.e}</span><span class="text-muted-foreground">× ${r.n}</span><span class="text-right tabular-nums">${num(r.m, 3)} g/mol</span><span class="text-right tabular-nums text-muted-foreground">${num((100 * r.m) / M, 2)}%</span>`)
        .join("")}</div>`;
    } catch (err) {
      fInput.setAttribute("aria-invalid", "true");
      M = NaN;
      o.mm.textContent = "—";
      bar.innerHTML = "";
      breakdown.innerHTML = `<span class="text-del">${esc(err.message)}</span>`;
    }
    convert();
  }
  function convert() {
    const mol = s.grams.get() / M;
    o.mol.textContent = Number.isFinite(mol) ? `${sci(mol)} mol` : "—";
    o.n.textContent = Number.isFinite(mol) ? sci(mol * NA) : "—";
  }

  let eq = null, bal = null;
  function reaction() {
    rInput.removeAttribute("aria-invalid");
    try {
      eq = parseEquation(rInput.value);
      bal = balance(eq, masses);
      balancedEl.innerHTML = `<span class="text-muted-foreground">Balanced: </span>${equationHTML(eq, bal.coeffs)}`;
      massesEl.innerHTML = eq.reactants.map((f, i) => `<label class="flex items-center justify-between gap-3 text-sm"><span class="text-muted-foreground">Mass of ${formulaHTML(f)}</span><span class="flex items-center gap-1"><input data-mass="${i}" type="text" inputmode="decimal" value="${i === 0 ? 4 : 16}" class="h-8 w-20 rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label="Mass of ${esc(f)} in grams"><span class="w-4 font-mono text-[11px] text-muted-foreground">g</span></span></label>`).join("");
      massesEl.querySelectorAll("[data-mass]").forEach((x) => x.addEventListener("input", limiting));
      limiting();
    } catch (err) {
      rInput.setAttribute("aria-invalid", "true");
      balancedEl.innerHTML = `<span class="text-del">${esc(err.message)}</span>`;
      massesEl.innerHTML = yieldEl.innerHTML = "";
    }
  }
  function limiting() {
    const nl = eq.reactants.length;
    const Ms = bal.comps.map((c) => molarMass(c, masses));
    const grams = [...massesEl.querySelectorAll("[data-mass]")].map((x) => parseFloat(x.value.replace(",", ".")));
    if (grams.some((g) => !(g >= 0))) { yieldEl.innerHTML = `<span class="text-del">Enter a mass for every reactant.</span>`; return; }
    // Moles of reaction each reactant allows; the smallest wins.
    const extents = grams.map((g, i) => g / Ms[i] / bal.coeffs[i]);
    const lim = extents.indexOf(Math.min(...extents));
    const xi = extents[lim];
    const rows = eq.products.map((f, j) => `<div class="flex justify-between gap-3"><span>${formulaHTML(f)} formed</span><span class="font-mono tabular-nums">${num(xi * bal.coeffs[nl + j] * Ms[nl + j], 3)} g</span></div>`);
    const left = eq.reactants.map((f, i) => (i === lim ? "" : `<div class="flex justify-between gap-3 text-muted-foreground"><span>${formulaHTML(f)} left over</span><span class="font-mono tabular-nums">${num(grams[i] - xi * bal.coeffs[i] * Ms[i], 3)} g</span></div>`));
    yieldEl.innerHTML = `<div class="flex justify-between gap-3"><span>Limiting reagent</span><span class="font-medium text-brand">${formulaHTML(eq.reactants[lim])}</span></div>${rows.join("")}${left.join("")}`;
  }

  fInput.addEventListener("input", formula);
  rInput.addEventListener("change", reaction);
  rInput.addEventListener("keydown", (e) => { if (e.key === "Enter") reaction(); });
  root.querySelectorAll("[data-formula]").forEach((b) => b.addEventListener("click", () => { fInput.value = b.dataset.formula; formula(); }));
  formula();
  reaction();
}

// ============================================================ Ideal gas

const GASES = { He: 4.0026, N2: 28.014, O2: 31.998, CO2: 44.009 }; // g/mol

function gaussian(rng = Math.random) {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

for (const root of document.querySelectorAll("[data-gas]")) {
  const o = outs(root);
  const canvas = root.querySelector("[data-box]");
  const mb = root.querySelector("[data-mb]");
  let solve = "V", gas = "N2";
  const s = scrubAll(root, (name) => update(name));
  const inputs = Object.fromEntries([...root.querySelectorAll("[data-scrub]")].map((i) => [i.dataset.scrub, i]));
  let particles = [], lastT = null, lastM = null;

  function update() {
    const P = s.P.get(), V = s.V.get(), T = s.T.get(), n = s.n.get();
    // P in kPa times V in L is J: PV = nRT with R in J/(mol·K).
    const solved = { V: (n * R * T) / P, P: (n * R * T) / V, T: (P * V) / (n * R), n: (P * V) / (R * T) }[solve];
    s[solve].set(solved, false);
    for (const [k, i] of Object.entries(inputs)) {
      i.readOnly = k === solve;
      i.classList.toggle("text-brand", k === solve);
    }
    syncParticles();
    drawMB();
  }

  function syncParticles() {
    const T = s.T.get(), Mkg = GASES[gas] / 1000;
    const want = Math.max(8, Math.min(140, Math.round(40 * s.n.get())));
    const sd = Math.sqrt((R * T) / Mkg); // per-component speed spread, m/s
    if (lastT && lastM && particles.length) {
      const f = Math.sqrt((T / lastT) * (lastM / Mkg));
      for (const p of particles) { p.vx *= f; p.vy *= f; }
    }
    while (particles.length < want) particles.push({ x: Math.random(), y: Math.random(), vx: gaussian() * sd, vy: gaussian() * sd });
    particles.length = want;
    lastT = T; lastM = Mkg;
  }

  function drawMB() {
    const T = s.T.get(), Mkg = GASES[gas] / 1000;
    const vp = Math.sqrt((2 * R * T) / Mkg), vmean = Math.sqrt((8 * R * T) / (Math.PI * Mkg)), vrms = Math.sqrt((3 * R * T) / Mkg);
    const f = (v) => 4 * Math.PI * (Mkg / (2 * Math.PI * R * T)) ** 1.5 * v * v * Math.exp((-Mkg * v * v) / (2 * R * T));
    const xmax = 3.2 * vp, ymax = f(vp) * 1.15;
    mb.replaceChildren();
    const fr = frame(mb, { box: [44, 14, 500, 150], x: [0, xmax], y: [0, ymax], xticks: niceTicks(xmax), yticks: [], xlabel: "speed (m/s)", ylabel: "f(v)" });
    const pts = Array.from({ length: 161 }, (_, i) => { const v = (i / 160) * xmax; return [fr.sx(v), fr.sy(f(v))]; });
    el("path", { d: `M${fr.sx(0)},${fr.sy(0)} L${pts.map((p) => p.join(",")).join(" L")} L${fr.sx(xmax)},${fr.sy(0)} Z`, style: "fill:var(--vec-u);fill-opacity:0.12" }, mb);
    polyline(mb, pts, "stroke:var(--vec-u);stroke-width:1.75");
    for (const [v, label, color, dy] of [[vp, "peak", "var(--foreground)", 5], [vmean, "mean", "var(--brand)", 16], [vrms, "rms", "var(--vec-out)", 27]]) {
      el("line", { x1: fr.sx(v), x2: fr.sx(v), y1: fr.sy(f(v)), y2: fr.T + fr.H, style: `stroke:${color};stroke-width:1.25;stroke-dasharray:3 3` }, mb);
      text(mb, fr.sx(v) + 3, fr.sy(f(v)) + dy, label, { "text-anchor": "start", style: `fill:${color}` });
    }
    o.vp.textContent = `${num(vp, 0)} m/s`;
    o.vmean.textContent = `${num(vmean, 0)} m/s`;
    o.vrms.textContent = `${num(vrms, 0)} m/s`;
  }

  // The box: width follows the volume (log scale), molecules bounce off the
  // walls and the piston. Speeds are scaled so 500 m/s is 120 px/s.
  let raf = 0, last = 0, visible = false;
  function frameBox(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const frac = Math.min(1, Math.max(0.12, 0.12 + (0.88 * Math.log(s.V.get() / 0.1)) / Math.log(2000)));
    const bw = (W - 16 * dpr) * frac;
    const scale = (120 / 500) * dpr; // px per (m/s)
    const cs = getComputedStyle(root);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cs.getPropertyValue("--code-bg") || "#fff";
    ctx.fillRect(8 * dpr, 8 * dpr, bw, H - 16 * dpr);
    ctx.strokeStyle = cs.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = dpr;
    ctx.strokeRect(8 * dpr, 8 * dpr, bw, H - 16 * dpr);
    ctx.globalAlpha = 1;
    // Piston.
    ctx.fillStyle = cs.color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(8 * dpr + bw - 3 * dpr, 4 * dpr, 6 * dpr, H - 8 * dpr);
    ctx.fillRect(8 * dpr + bw, H / 2 - 2 * dpr, W, 4 * dpr);
    ctx.globalAlpha = 1;
    const brand = cs.getPropertyValue("--brand");
    ctx.fillStyle = brand;
    const iw = bw - 6 * dpr, ih = H - 22 * dpr;
    for (const p of particles) {
      let x = 11 * dpr + p.x * iw, y = 11 * dpr + p.y * ih;
      if (dt) {
        x += p.vx * scale * dt; y += p.vy * scale * dt;
        if (x < 11 * dpr) { x = 22 * dpr - x; p.vx = Math.abs(p.vx); }
        if (x > 11 * dpr + iw) { x = 2 * (11 * dpr + iw) - x; p.vx = -Math.abs(p.vx); }
        if (y < 11 * dpr) { y = 22 * dpr - y; p.vy = Math.abs(p.vy); }
        if (y > 11 * dpr + ih) { y = 2 * (11 * dpr + ih) - y; p.vy = -Math.abs(p.vy); }
        p.x = Math.min(1, Math.max(0, (x - 11 * dpr) / iw)); p.y = Math.min(1, Math.max(0, (y - 11 * dpr) / ih));
      }
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * dpr, 0, 2 * Math.PI);
      ctx.fill();
    }
    raf = visible && !reduced() ? requestAnimationFrame(frameBox) : 0;
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frameBox); }
  }).observe(root);

  root.addEventListener("seg-change", (e) => {
    const label = e.target.getAttribute("aria-label");
    if (label === "Solve for") solve = e.detail.value; else gas = e.detail.value;
    update();
    if (!raf) frameBox(performance.now());
  });
  update();
  frameBox(performance.now());
}

function niceTicks(max, count = 5) {
  const step = 10 ** Math.floor(Math.log10(max / count));
  const m = [1, 2, 5, 10].find((k) => (max / (k * step)) <= count) * step;
  return Array.from({ length: Math.floor(max / m) + 1 }, (_, i) => i * m);
}

// ============================================================ Titration

const INDICATORS = {
  phenolphthalein: { name: "Phenolphthalein", lo: 8.2, hi: 10.0, a: "#f3f3f3", b: "#e0408f", la: "colourless", lb: "pink" },
  btb: { name: "Bromothymol blue", lo: 6.0, hi: 7.6, a: "#e2cc3a", b: "#2f6fd6", la: "yellow", lb: "blue" },
  mo: { name: "Methyl orange", lo: 3.1, hi: 4.4, a: "#d83a2c", b: "#e9b83a", la: "red", lb: "yellow" },
};

/** pH from the charge balance [H⁺] + [Na⁺] = [A⁻] + [OH⁻], solved by
 *  bisection on log[H⁺] (the residual is monotonic in [H⁺]). */
function pH({ weak, Ka, Ca, Va, Cb, Vb }) {
  const Kw = 1e-14, Vt = Va + Vb;
  const CA = (Ca * Va) / Vt, Na = (Cb * Vb) / Vt;
  const res = (h) => h + Na - (weak ? (CA * Ka) / (Ka + h) : CA) - Kw / h;
  let lo = -15, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    res(10 ** mid) > 0 ? (hi = mid) : (lo = mid);
  }
  return -(lo + hi) / 2;
}

for (const root of document.querySelectorAll("[data-titration]")) {
  const svg = root.querySelector("[data-plot]");
  const flask = root.querySelector("[data-flask]");
  const o = outs(root);
  let weak = true, ind = "phenolphthalein";
  const s = scrubAll(root, draw);
  const pkaInput = root.querySelector('[data-scrub="pka"]');
  root.addEventListener("seg-change", (e) => {
    const label = e.target.getAttribute("aria-label");
    if (label === "Acid strength") weak = e.detail.value === "weak";
    else ind = e.detail.value;
    draw();
  });

  function draw() {
    const p = { weak, Ka: 10 ** -s.pka.get(), Ca: s.ca.get(), Va: s.va.get(), Cb: s.cb.get() };
    pkaInput.disabled = !weak;
    const Veq = (p.Ca * p.Va) / p.Cb;
    const xmax = Math.max(2 * Veq, s.vb.get());
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 500, 280], x: [0, xmax], y: [0, 14], xticks: niceTicks(xmax), yticks: [0, 2, 4, 6, 7, 8, 10, 12, 14], xlabel: "NaOH added (mL)", ylabel: "pH" });
    const I = INDICATORS[ind];
    el("rect", { x: f.L, y: f.sy(I.hi), width: f.W, height: f.sy(I.lo) - f.sy(I.hi), style: `fill:${I.b};fill-opacity:0.14` }, svg);
    text(svg, f.L + f.W - 4, f.sy(I.hi) + 11, `${I.name} ${I.lo}–${I.hi}`, { "text-anchor": "end" });
    el("line", { x1: f.sx(Veq), x2: f.sx(Veq), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 4" }, svg);
    const pts = Array.from({ length: 401 }, (_, i) => { const v = (i / 400) * xmax; return [f.sx(v), f.sy(pH({ ...p, Vb: v }))]; });
    polyline(svg, pts, "stroke:var(--foreground);stroke-width:1.75");
    if (weak) {
      const ph = pH({ ...p, Vb: Veq / 2 });
      el("circle", { cx: f.sx(Veq / 2), cy: f.sy(ph), r: 3.5, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:1.75" }, svg);
      text(svg, f.sx(Veq / 2) + 6, f.sy(ph) + 14, `½ eq: pH ${num(ph, 2)} ≈ pKa`, { style: "fill:var(--vec-u)" });
    }
    const phEq = pH({ ...p, Vb: Veq });
    const phNow = pH({ ...p, Vb: s.vb.get() });
    el("circle", { cx: f.sx(s.vb.get()), cy: f.sy(phNow), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    o.ph.textContent = num(phNow, 2);
    o.eq.textContent = `${num(Veq, 2)} mL`;
    o.pheq.textContent = num(phEq, 2);
    // Indicator colour: a linear blend across its transition range.
    const t = Math.min(1, Math.max(0, (phNow - I.lo) / (I.hi - I.lo)));
    flask.style.background = `color-mix(in oklab, ${I.b} ${Math.round(t * 100)}%, ${I.a})`;
    o.colour.textContent = t <= 0 ? I.la : t >= 1 ? I.lb : `changing (${I.la} → ${I.lb})`;
  }
  draw();
}

// ============================================================ Kinetics

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "—";
  const units = [[3.156e7, "yr"], [86400, "d"], [3600, "h"], [60, "min"], [1, "s"], [1e-3, "ms"], [1e-6, "µs"]];
  for (const [u, name] of units) if (sec >= u) return `${sci(sec / u, 3)} ${name}`;
  return `${sci(sec, 3)} s`;
}

for (const root of document.querySelectorAll("[data-kinetics]")) {
  const conc = root.querySelector("[data-conc]");
  const arr = root.querySelector("[data-arr]");
  const o = outs(root);
  let order = 1;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { order = Number(e.detail.value); draw(); });
  const kAt = (T) => 10 ** s.loga.get() * Math.exp((-s.ea.get() * 1000) / (R * T));

  function draw() {
    const T = s.T.get(), k = kAt(T), A0 = s.a0.get();
    const half = order === 0 ? A0 / (2 * k) : order === 1 ? Math.LN2 / k : 1 / (k * A0);
    const A = (t) => (order === 0 ? Math.max(0, A0 - k * t) : order === 1 ? A0 * Math.exp(-k * t) : A0 / (1 + k * A0 * t));
    const tmax = 4 * half;
    conc.replaceChildren();
    const f = frame(conc, { box: [40, 14, 344, 236], x: [0, 4], y: [0, A0], xticks: [0, 1, 2, 3, 4], yticks: [0, A0 / 2, A0], xfmt: (v) => (v ? `${v}t½` : "0"), yfmt: (v) => num(v, 2), xlabel: `time (t½ = ${fmtTime(half)})`, ylabel: "[A] (M)" });
    hline(conc, f, A0 / 2, "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 4");
    polyline(conc, Array.from({ length: 201 }, (_, i) => { const t = (i / 200) * tmax; return [f.sx(t / half), f.sy(A(t))]; }), "stroke:var(--brand);stroke-width:2");
    for (let n = 1; n <= 3; n++) el("circle", { cx: f.sx(n), cy: f.sy(A(n * half)), r: 3, style: "fill:var(--background);stroke:var(--brand);stroke-width:1.5" }, conc);

    arr.replaceChildren();
    const xs = [1000 / 800, 1000 / 200];
    const ln = (TT) => Math.log(kAt(TT));
    const yLo = Math.min(ln(200), ln(800)), yHi = Math.max(ln(200), ln(800));
    const g = frame(arr, { box: [40, 14, 204, 236], x: xs, y: [yLo, yHi], xticks: [1.5, 2.5, 3.5, 4.5], yticks: [Math.ceil(yLo), Math.floor(yHi)], xfmt: (v) => String(v), yfmt: (v) => num(v, 0), xlabel: "1000/T (K⁻¹)", ylabel: "ln k" });
    polyline(arr, [[g.sx(xs[0]), g.sy(ln(800))], [g.sx(xs[1]), g.sy(ln(200))]], "stroke:var(--foreground);stroke-width:1.5");
    el("circle", { cx: g.sx(1000 / T), cy: g.sy(ln(T)), r: 4, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, arr);
    text(arr, g.L + g.W - 4, g.T + 12, `slope = −Ea/R`, { "text-anchor": "end" });

    const unit = ["M·s⁻¹", "s⁻¹", "M⁻¹·s⁻¹"][order];
    o.k.textContent = `${sci(k, 3)} ${unit}`;
    o.half.textContent = fmtTime(half) + (order === 1 ? "" : " (depends on [A]₀)");
    o.ratio.textContent = `× ${num(kAt(T + 10) / k, 2)}`;
  }
  draw();
}

// ============================================================ Equilibrium

for (const root of document.querySelectorAll("[data-equilibrium]")) {
  const svg = root.querySelector("[data-plot]");
  const gauge = root.querySelector("[data-gauge]");
  const o = outs(root);
  const s = scrubAll(root, () => restart());
  const COL = { n2: "var(--vec-u)", h2: "var(--ion-cl)", nh3: "var(--brand)" };
  let segments = []; // each: {from, to, xi}
  let lastQ = 0;

  const Q = (c) => (c.nh3 ** 2) / (c.n2 * c.h2 ** 3);
  // The extent ξ (mol/L) that brings Q to K; Q rises monotonically with ξ.
  function settle(c, K) {
    const lo0 = -c.nh3 / 2, hi0 = Math.min(c.n2, c.h2 / 3);
    if (hi0 - lo0 < 1e-12) return c;
    let lo = lo0, hi = hi0;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const q = Q({ n2: c.n2 - mid, h2: c.h2 - 3 * mid, nh3: c.nh3 + 2 * mid });
      q > K || !Number.isFinite(q) ? (hi = mid) : (lo = mid);
    }
    const xi = (lo + hi) / 2;
    return { n2: c.n2 - xi, h2: c.h2 - 3 * xi, nh3: c.nh3 + 2 * xi };
  }

  function push(from) {
    lastQ = Q(from);
    segments.push({ from, to: settle(from, s.K.get()) });
    draw();
  }
  function restart() {
    segments = [];
    push({ n2: s.n2.get(), h2: s.h2.get(), nh3: s.nh3.get() });
  }
  const current = () => segments.at(-1).to;
  root.querySelector("[data-action=addN2]").addEventListener("click", () => { const c = current(); push({ ...c, n2: c.n2 + 0.5 }); });
  root.querySelector("[data-action=removeNH3]").addEventListener("click", () => { const c = current(); push({ ...c, nh3: c.nh3 / 2 }); });
  root.querySelector("[data-action=compress]").addEventListener("click", () => { const c = current(); push({ n2: 2 * c.n2, h2: 2 * c.h2, nh3: 2 * c.nh3 }); });

  function draw() {
    // Each segment relaxes exponentially in arbitrary time units.
    const pts = { n2: [], h2: [], nh3: [] };
    segments.forEach((sg, k) => {
      for (let i = 0; i <= 40; i++) {
        // Normalised so each segment ends exactly at the solved equilibrium.
        const t = k + i / 40, w = (1 - Math.exp(-i / 8)) / (1 - Math.exp(-5));
        for (const sp in pts) pts[sp].push([t, sg.from[sp] + (sg.to[sp] - sg.from[sp]) * w]);
      }
    });
    const ymax = Math.max(1, ...Object.values(pts).flat().map((p) => p[1])) * 1.1;
    svg.replaceChildren();
    const f = frame(svg, { box: [40, 14, 500, 210], x: [0, Math.max(1, segments.length)], y: [0, ymax], xticks: [], yticks: [0, ymax / 2, ymax].map((v) => +v.toFixed(2)), yfmt: (v) => num(v, 2), xlabel: "time (arbitrary)", ylabel: "mol/L" });
    for (let k = 1; k < segments.length; k++) el("line", { x1: f.sx(k), x2: f.sx(k), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:2 4" }, svg);
    for (const [sp, label] of [["n2", "N₂"], ["h2", "H₂"], ["nh3", "NH₃"]]) {
      polyline(svg, pts[sp].map(([t, v]) => [f.sx(t), f.sy(v)]), `stroke:${COL[sp]};stroke-width:2`);
      const end = pts[sp].at(-1);
      text(svg, f.sx(end[0]) - 4, f.sy(end[1]) - 6, `${label} ${num(end[1], 3)}`, { "text-anchor": "end", style: `fill:${COL[sp]}` });
    }
    // Gauge: log10(Q) against log10(K) on a −4…+4 window around K.
    const K = s.K.get();
    const d = Math.log10(lastQ / K);
    const pos = (v) => `${50 + Math.max(-4, Math.min(4, v)) * 12}%`;
    gauge.innerHTML = `<div class="absolute inset-x-0 top-5 h-px bg-foreground/20"></div>
      <div class="absolute top-2 h-6 w-0.5 -translate-x-1/2 bg-foreground" style="left:50%"></div>
      <div class="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground" style="left:50%">K</div>
      <div class="absolute top-5 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-brand shadow" style="left:${Number.isFinite(d) ? pos(d) : d > 0 ? "98%" : "2%"}"></div>
      <div class="absolute top-7 -translate-x-1/2 font-mono text-[10px] text-brand" style="left:${Number.isFinite(d) ? pos(d) : d > 0 ? "98%" : "2%"}">Q</div>
      <div class="absolute top-10 left-0 font-mono text-[10px] text-muted-foreground">← Q &lt; K: forms NH₃</div>
      <div class="absolute top-10 right-0 font-mono text-[10px] text-muted-foreground">Q &gt; K: NH₃ breaks down →</div>`;
    const qs = lastQ === 0 ? "0" : Number.isFinite(lastQ) ? sci(lastQ, 3) : "∞";
    o.qk.textContent = `${qs} → ${sci(K, 3)}`;
    o.shift.textContent = !Number.isFinite(d) ? (lastQ === 0 ? "right (toward NH₃)" : "left (toward N₂ + H₂)") : Math.abs(d) < 1e-6 ? "none: already at equilibrium" : d < 0 ? "right (toward NH₃)" : "left (toward N₂ + H₂)";
  }
  restart();
}

// ============================================================ Electron configuration

const SUBSHELL_ORBITALS = { s: 1, p: 3, d: 5, f: 7 };

for (const root of document.querySelectorAll("[data-econfig]")) {
  const o = outs(root);
  const boxes = root.querySelector("[data-boxes]");
  const table = root.dataset.cfg.split("|").map((row) => { const [sym, cfg, ex] = row.split("="); return { sym, cfg, ex: ex === "true" }; });
  const s = scrubAll(root, draw);
  const occOf = (z) => Object.fromEntries(table[z - 1].cfg.split(" ").map((t) => [t.slice(0, 2), Number(t.slice(2))]));

  function draw() {
    const z = Math.round(s.z.get());
    const row = table[z - 1];
    const occ = occOf(z);
    const name = document.querySelector(`[data-ptable] [data-z="${z}"]`)?.dataset.name;
    o.sym.textContent = row.sym;
    o.name.textContent = name ?? `Z = ${z}`;
    o.exception.hidden = !row.ex;
    let unpaired = 0;
    boxes.innerHTML = Object.entries(occ).map(([sub, e]) => {
      const k = SUBSHELL_ORBITALS[sub[1]];
      // Hund: one electron in each orbital first, all spin-up; then pair.
      const cells = Array.from({ length: k }, (_, i) => (e > i ? 1 : 0) + (e > k + i ? 1 : 0));
      unpaired += cells.filter((c) => c === 1).length;
      return `<div class="flex flex-col items-center gap-1"><div class="flex">${cells
        .map((c) => `<span class="flex h-8 w-7 items-center justify-center border border-foreground/30 bg-background font-sans text-sm leading-none -ml-px first:ml-0 ${c ? "text-foreground" : ""}">${c === 2 ? "↑↓" : c === 1 ? '<span class="text-brand">↑</span>' : ""}</span>`)
        .join("")}</div><span class="font-mono text-[11px] text-muted-foreground">${sub}<sup>${e}</sup></span></div>`;
    }).join("");
    // Noble-gas notation in n-then-l order.
    const core = [86, 54, 36, 18, 10, 2].find((c) => c < z);
    const coreOcc = core ? occOf(core) : {};
    const order = Object.keys(occ).sort((a, b) => a[0] - b[0] || "spdf".indexOf(a[1]) - "spdf".indexOf(b[1]));
    const parts = order.filter((sub) => occ[sub] - (coreOcc[sub] ?? 0) > 0).map((sub) => `${sub}${String(occ[sub] - (coreOcc[sub] ?? 0)).split("").map((c) => SUP[c]).join("")}`);
    o.cfg.textContent = (core ? `[${table[core - 1].sym}] ` : "") + parts.join(" ");
    o.unpaired.textContent = String(unpaired);
    o.mag.textContent = unpaired ? "paramagnetic (as a free atom)" : "diamagnetic";
  }
  root.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => { s.z.set(Number(b.dataset.z)); }));
  draw();
}

// ============================================================ VSEPR viewer

const CPK = { H: ["#ffffff", 13], C: ["#909090", 19], N: ["#3050f8", 19], O: ["#ff0d0d", 19], F: ["#90e050", 17], Cl: ["#1ff01f", 22], S: ["#ffff30", 22], P: ["#ff8000", 22], B: ["#ffb5b5", 19] };

function tetra() { const k = 1 / Math.sqrt(3); return [[k, k, k], [k, -k, -k], [-k, k, -k], [-k, -k, k]]; }
function pyramid(alphaDeg, n = 3) {
  const a = (alphaDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => { const p = (2 * Math.PI * i) / n; return [Math.sin(a) * Math.cos(p), -Math.cos(a), Math.sin(a) * Math.sin(p)]; });
}
const scaleV = (v, s) => v.map((x) => x * s);

// Ideal or measured geometries; bond lengths in Å (scaled to fit).
const MOLECULES = {
  H2O: (() => { const h = (104.5 / 2) * (Math.PI / 180);
    return { center: "O", ligands: [["H", [Math.sin(h), -Math.cos(h), 0], 0.96], ["H", [-Math.sin(h), -Math.cos(h), 0], 0.96]], lone: [[0, 0.58, 0.82], [0, 0.58, -0.82]],
      shape: "bent", domains: "4 (tetrahedral)", axe: "AX₂E₂", angle: "104.5°", polar: "yes" }; })(),
  NH3: { center: "N", ligands: pyramid(68.2).map((v) => ["H", v, 1.01]), lone: [[0, 1, 0]], shape: "trigonal pyramidal", domains: "4 (tetrahedral)", axe: "AX₃E", angle: "≈107°", polar: "yes" },
  CH4: { center: "C", ligands: tetra().map((v) => ["H", v, 1.09]), lone: [], shape: "tetrahedral", domains: "4 (tetrahedral)", axe: "AX₄", angle: "109.5°", polar: "no" },
  CO2: { center: "C", ligands: [["O", [1, 0, 0], 1.16], ["O", [-1, 0, 0], 1.16]], lone: [], shape: "linear", domains: "2 (linear)", axe: "AX₂", angle: "180°", polar: "no" },
  BF3: { center: "B", ligands: [0, 1, 2].map((i) => ["F", [Math.cos((2 * Math.PI * i) / 3 + Math.PI / 2), Math.sin((2 * Math.PI * i) / 3 + Math.PI / 2), 0], 1.31]), lone: [], shape: "trigonal planar", domains: "3 (trigonal planar)", axe: "AX₃", angle: "120°", polar: "no" },
  PCl5: { center: "P", ligands: [["Cl", [0, 1, 0], 2.14], ["Cl", [0, -1, 0], 2.14], ...[0, 1, 2].map((i) => ["Cl", [Math.cos((2 * Math.PI * i) / 3), 0, Math.sin((2 * Math.PI * i) / 3)], 2.02])], lone: [], shape: "trigonal bipyramidal", domains: "5 (trigonal bipyramidal)", axe: "AX₅", angle: "90° and 120°", polar: "no" },
  SF6: { center: "S", ligands: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((v) => ["F", v, 1.56]), lone: [], shape: "octahedral", domains: "6 (octahedral)", axe: "AX₆", angle: "90°", polar: "no" },
};

for (const root of document.querySelectorAll("[data-vsepr]")) {
  const svg = root.querySelector("[data-mol]");
  const o = outs(root);
  let mol = MOLECULES.H2O, yaw = 0.6, pitch = -0.35, showLone = true;
  root.querySelector("[data-toggle=lonepairs]")?.addEventListener("shadcn:checked-change", (e) => { showLone = e.detail.checked; draw(); });
  root.addEventListener("seg-change", (e) => { mol = MOLECULES[e.detail.value]; draw(); });

  // Radial gradients per atom colour (ids are unique to this block).
  const defs = `<defs>${Object.entries(CPK).map(([elx, [c]]) => `<radialGradient id="cpk-${elx}" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#fff" stop-opacity="0.9"/><stop offset="35%" stop-color="${c}"/><stop offset="100%" stop-color="${c}" stop-opacity="0.75"/></radialGradient>`).join("")}</defs>`;

  function rot([x, y, z]) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
    return [x1, cp * y - sp * z1, sp * y + cp * z1];
  }
  const project = ([x, y, z]) => { const f = 500 / (500 - z); return [x * f, -y * f, z, f]; };

  function draw() {
    const maxLen = Math.max(...mol.ligands.map((l) => l[2]));
    const L = 95 / maxLen; // px per Å, so the longest bond is 95 px
    const items = [];
    const c = project(rot([0, 0, 0]));
    items.push({ z: c[2], svg: atomSVG(mol.center, c) });
    for (const [elx, dir, len] of mol.ligands) {
      const p = project(rot(scaleV(dir, len * L)));
      const mid = [(c[0] + p[0]) / 2, (c[1] + p[1]) / 2];
      const w = 6 * (c[3] + p[3]) / 2;
      // Trim the bond to the atoms' rims so it never covers an atom behind it.
      const dx = p[0] - c[0], dy = p[1] - c[1], d = Math.hypot(dx, dy) || 1;
      const rc = CPK[mol.center][1] * c[3] * 0.8, rp = CPK[elx][1] * p[3] * 0.8;
      const a0 = [c[0] + (dx / d) * Math.min(rc, d / 2), c[1] + (dy / d) * Math.min(rc, d / 2)];
      const b0 = [p[0] - (dx / d) * Math.min(rp, d / 2), p[1] - (dy / d) * Math.min(rp, d / 2)];
      const bond = (a, b, color, width) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
      // An outline under two half-bonds, each in its atom's colour.
      items.push({ z: (c[2] + p[2]) / 2 - 1, svg: `<g>${bond(a0, b0, "color-mix(in oklab, var(--foreground) 35%, transparent)", w + 2)}${bond(a0, mid, CPK[mol.center][0], w)}${bond(mid, b0, CPK[elx][0], w)}</g>` });
      items.push({ z: p[2], svg: atomSVG(elx, p) });
    }
    if (showLone) for (const dir of mol.lone) {
      const p = project(rot(scaleV(dir, 0.62 * 95)));
      const r = 17 * p[3];
      items.push({ z: p[2], svg: `<g><ellipse cx="${p[0]}" cy="${p[1]}" rx="${r}" ry="${r}" fill="var(--brand)" fill-opacity="0.12" stroke="var(--brand)" stroke-opacity="0.45" stroke-dasharray="3 3"/><circle cx="${p[0] - 4}" cy="${p[1]}" r="2.2" fill="var(--brand)"/><circle cx="${p[0] + 4}" cy="${p[1]}" r="2.2" fill="var(--brand)"/></g>` });
    }
    items.sort((a, b) => a.z - b.z);
    svg.innerHTML = defs + items.map((i) => i.svg).join("");
    o.shape.textContent = mol.shape;
    o.domains.textContent = mol.domains;
    o.axe.textContent = mol.axe;
    o.angle.textContent = mol.angle;
    o.polar.textContent = mol.polar;
  }
  function atomSVG(elx, [x, y, , f]) {
    const [, r] = CPK[elx];
    return `<g><circle cx="${x}" cy="${y}" r="${r * f}" fill="url(#cpk-${elx})" stroke="color-mix(in oklab, var(--foreground) 40%, transparent)" stroke-width="1"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" class="pointer-events-none font-mono text-[10px] font-medium" fill="#111" fill-opacity="0.75">${elx}</text></g>`;
  }

  // Drag to rotate; arrow keys step by 10°. A slow idle spin until touched.
  let drag = null, touched = false, raf = 0, visible = false, last = 0;
  svg.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; touched = true; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.5, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * 0.01));
    draw();
  });
  svg.addEventListener("pointerup", () => (drag = null));
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    touched = true;
    yaw += d[0] * (Math.PI / 18);
    pitch = Math.max(-1.5, Math.min(1.5, pitch + d[1] * (Math.PI / 18)));
    draw();
  });
  const spin = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!touched) { yaw += dt * 0.35; draw(); }
    raf = visible && !touched && !reduced() ? requestAnimationFrame(spin) : 0;
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !touched && !reduced()) { last = performance.now(); raf = requestAnimationFrame(spin); } }).observe(root);
  draw();
}

// ============================================================ Precipitation

// Ions are written "Na+", "NO3-" (charge ±1) or "SO4 2-", "Ba 2+".
const ION = (s) => {
  const sign = s.endsWith("+") ? 1 : -1;
  if (s.includes(" ")) { const [sym, q] = s.split(" "); return { sym, q: sign * parseInt(q, 10) }; }
  return { sym: s.slice(0, -1), q: sign };
};
const POLY = new Set(["NO3", "SO4", "CO3", "PO4", "OH", "NH4"]);
const ionHTML = ({ sym, q }) => `${formulaHTML(sym)}<sup>${Math.abs(q) > 1 ? Math.abs(q) : ""}${q > 0 ? "+" : "−"}</sup>`;
const igcd = (a, b) => (b ? igcd(b, a % b) : a);

function compound(cat, an) {
  const g = igcd(cat.q, -an.q);
  const x = -an.q / g, y = cat.q / g;
  const part = (sym, n) => (n === 1 ? formulaHTML(sym) : POLY.has(sym) ? `(${formulaHTML(sym)})<sub>${n}</sub>` : `${formulaHTML(sym)}<sub>${n}</sub>`);
  return { x, y, html: part(cat.sym, x) + part(an.sym, y) };
}

function solubility(cat, an) {
  const c = cat.sym, a = an.sym;
  if (c === "NH4" && a === "OH") return { s: "gas", note: "NH₄⁺ + OH⁻ → NH₃(g) + H₂O: ammonia is released, no precipitate." };
  if ((c === "Cu" || c === "Fe") && a === "I") return { s: "redox", note: "Iodide is oxidised to iodine: a redox reaction, not a simple precipitation." };
  if (a === "NO3" || ["Na", "K", "NH4"].includes(c)) return { s: "s", note: "nitrates and Na⁺, K⁺, NH₄⁺ salts are soluble" };
  if (a === "Cl") return c === "Ag" ? { s: "i", note: "AgCl is insoluble" } : c === "Pb" ? { s: "sl", note: "PbCl₂ is slightly soluble" } : { s: "s", note: "chlorides are soluble" };
  if (a === "I") return ["Ag", "Pb"].includes(c) ? { s: "i", note: `${c}I${c === "Pb" ? "₂" : ""} is insoluble` } : { s: "s", note: "iodides are soluble" };
  if (a === "SO4") return ["Ba", "Pb"].includes(c) ? { s: "i", note: "BaSO₄ and PbSO₄ are insoluble" } : ["Ca", "Ag"].includes(c) ? { s: "sl", note: "CaSO₄ and Ag₂SO₄ are slightly soluble" } : { s: "s", note: "sulfates are soluble" };
  if (a === "OH") {
    if (c === "Ba") return { s: "s", note: "Ba(OH)₂ is soluble" };
    if (c === "Ca") return { s: "sl", note: "Ca(OH)₂ is slightly soluble" };
    if (c === "Ag") return { s: "i", note: "AgOH is unstable: brown Ag₂O precipitates (2Ag⁺ + 2OH⁻ → Ag₂O + H₂O)" };
    return { s: "i", note: "hydroxides are insoluble" };
  }
  if (a === "CO3" && c === "Fe") return { s: "i", note: "Fe³⁺ hydrolyses: Fe(OH)₃ precipitates and CO₂ is released" };
  return { s: "i", note: `${a === "CO3" ? "carbonates" : "phosphates"} are insoluble` };
}

const VERDICT = { s: ["soluble", "text-muted-foreground border-border"], i: ["precipitate", "text-brand border-brand/50 bg-brand/8"], sl: ["slightly soluble", "text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))] border-vec-out/50 bg-vec-out/10"], gas: ["gas", "text-vec-u border-vec-u/50"], redox: ["redox", "text-ion-k border-ion-k/50"] };

for (const root of document.querySelectorAll("[data-precip]")) {
  const result = root.querySelector("[data-result]");
  const [A, B] = ["a", "b"].map((k) => root.querySelector(`[data-salt="${k}"]`));
  const pick = (sel) => { const o = sel.selectedOptions[0]; return { formula: o.value, cat: ION(o.dataset.cation), an: ION(o.dataset.anion) }; };

  function draw() {
    const a = pick(A), b = pick(B);
    if (a.formula === b.formula || (a.cat.sym === b.cat.sym && a.an.sym === b.an.sym)) {
      result.innerHTML = `<p class="text-sm text-muted-foreground">Pick two different solutions.</p>`;
      return;
    }
    const pairs = a.cat.sym === b.cat.sym || a.an.sym === b.an.sym ? [] : [[a.cat, b.an], [b.cat, a.an]];
    const rows = pairs.map(([c, n]) => {
      const sol = solubility(c, n);
      const comp = compound(c, n);
      // No stable compound forms for these pairings: show what does happen.
      if (sol.s === "gas") comp.html = "NH<sub>3</sub>(g) + H<sub>2</sub>O";
      if (sol.s === "redox") comp.html = `${ionHTML(c)} + ${ionHTML(n)}`;
      return { c, n, comp, sol };
    });
    const solids = rows.filter((r) => r.sol.s === "i" || r.sol.s === "sl");
    const card = (r) => { const [label, cls] = VERDICT[r.sol.s]; return `<div class="enter flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background p-3"><span class="font-mono text-base">${r.comp.html}</span><span class="rounded-full border px-2 py-px text-[11px] font-medium ${cls}">${label}</span><span class="w-full text-[13px] text-muted-foreground">${r.sol.note.replace(/\.?$/, ".")}</span></div>`; };
    let net = "";
    if (solids.length) {
      net = solids.map((r) => {
        if (r.c.sym === "Ag" && r.n.sym === "OH") return `2Ag<sup>+</sup>(aq) + 2OH<sup>−</sup>(aq) → Ag<sub>2</sub>O(s) + H<sub>2</sub>O(l)`;
        if (r.c.sym === "Fe" && r.n.sym === "CO3") return `2Fe<sup>3+</sup>(aq) + 3CO<sub>3</sub><sup>2−</sup>(aq) + 3H<sub>2</sub>O(l) → 2Fe(OH)<sub>3</sub>(s) + 3CO<sub>2</sub>(g)`;
        return `${r.comp.x > 1 ? r.comp.x : ""}${ionHTML(r.c)}(aq) + ${r.comp.y > 1 ? r.comp.y : ""}${ionHTML(r.n)}(aq) → ${r.comp.html}(s)`;
      }).map((e) => `<div class="font-mono text-sm">${e}</div>`).join("");
      const spect = [[a.cat, a], [a.an, a], [b.cat, b], [b.an, b]].map(([ion]) => ion).filter((ion) => !solids.some((r) => r.c.sym === ion.sym || r.n.sym === ion.sym));
      net = `<div class="enter flex flex-col gap-1.5 rounded-lg border bg-code p-3"><span class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Net ionic equation</span>${net}${spect.length ? `<span class="text-xs text-muted-foreground">Spectators: ${spect.map(ionHTML).join(", ")}</span>` : ""}</div>`;
    } else if (rows.some((r) => r.sol.s === "gas" || r.sol.s === "redox")) {
      net = "";
    } else {
      net = `<p class="enter text-sm text-muted-foreground">No precipitate: every ion stays in solution as a spectator.</p>`;
    }
    result.innerHTML = (pairs.length ? `<div class="grid gap-2 sm:grid-cols-2">${rows.map(card).join("")}</div>` : `<p class="text-sm text-muted-foreground">Both solutions share an ion, so no new pairing forms.</p>`) + net;
  }
  A.addEventListener("change", draw);
  B.addEventListener("change", draw);
  draw();
}

// ============================================================ Periodic table

for (const root of document.querySelectorAll("[data-ptable]")) {
  const cells = [...root.querySelectorAll("[data-grid] [data-z]")];
  const o = outs(root);
  const swatch = root.querySelector("[data-swatch]");
  const at = new Map(cells.map((c) => [`${c.dataset.row},${c.dataset.col}`, c]));

  function select(cell, focus = false) {
    for (const c of cells) { c.removeAttribute("aria-pressed"); c.tabIndex = -1; }
    cell.setAttribute("aria-pressed", "true");
    cell.tabIndex = 0;
    if (focus) cell.focus();
    const d = cell.dataset;
    o.z.textContent = d.z; o.sym.textContent = d.sym; o.weight.textContent = d.weight; o.name.textContent = d.name;
    o.cat.textContent = d.cat; o.config.textContent = d.config;
    o.exception.hidden = d.exception !== "true";
    o.pg.textContent = `${d.period} · ${d.group}`;
    o.en.textContent = d.en;
    o.ie.textContent = d.ie === "—" ? "—" : `${d.ie} eV`;
    swatch.style.setProperty("--c", cell.style.getPropertyValue("--c") || "#8a8a8a");
  }
  // Arrow keys: the nearest element in that direction (rows 8 is the gap).
  function move(cell, dr, dc) {
    let r = +cell.dataset.row, c = +cell.dataset.col;
    for (let k = 0; k < 20; k++) {
      r += dr; c += dc;
      if (r < 1 || r > 10 || c < 1 || c > 18) return null;
      const hit = at.get(`${r},${c}`);
      if (hit) return hit;
      if (dr && !dc) continue; // vertical: keep going through gaps
      if (dc && !dr) continue;
    }
    return null;
  }
  root.addEventListener("click", (e) => { const c = e.target.closest("[data-grid] [data-z]"); if (c) select(c); });
  root.addEventListener("keydown", (e) => {
    const c = e.target.closest("[data-grid] [data-z]");
    if (!c) return;
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (d) { e.preventDefault(); const n = move(c, ...d); if (n) select(n, true); }
    if (e.key === "Home") { e.preventDefault(); select(cells[0], true); }
    if (e.key === "End") { e.preventDefault(); select(cells.at(-1), true); }
  });

  // Colour modes: category (server colours) or a property heat scale.
  const original = new Map(cells.map((c) => [c, c.getAttribute("style")]));
  root.addEventListener("seg-change", (e) => {
    const mode = e.detail.value;
    if (mode === "category") {
      for (const c of cells) c.setAttribute("style", original.get(c));
      o.scale.textContent = "Arrow keys move · Enter selects";
      return;
    }
    const vals = cells.map((c) => parseFloat(c.dataset[mode])).filter(Number.isFinite);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    for (const c of cells) {
      const v = parseFloat(c.dataset[mode]);
      const base = original.get(c);
      // Heat scale: the brand colour, deeper for larger values; blank cells
      // have no established value.
      const fill = Number.isFinite(v)
        ? `background:color-mix(in oklab, var(--brand) ${Math.round(6 + 64 * ((v - lo) / (hi - lo)))}%, var(--background));border-color:color-mix(in oklab, var(--brand) 30%, transparent)`
        : "background:var(--background);border-style:dashed;border-color:var(--border)";
      c.setAttribute("style", `${base};${fill}`);
    }
    o.scale.textContent = mode === "en" ? `Pauling ${lo} (pale) – ${hi} (deep); blank = not established` : `${lo} – ${hi} eV; blank = not listed`;
  });
}
