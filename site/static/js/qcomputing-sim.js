// An exact state-vector simulator for a few qubits. Amplitudes are complex
// doubles; qubit 0 is the top wire and the LEFTMOST digit of every ket, so
// basis index i holds qubit q in bit (n − 1 − q). Gates are 2×2 complex
// matrices [a, b, c, d] of {re, im}, applied with optional controls.

const C = (re, im = 0) => ({ re, im });
const R2 = Math.SQRT1_2;

export const G = {
  i: [C(1), C(0), C(0), C(1)],
  h: [C(R2), C(R2), C(R2), C(-R2)],
  x: [C(0), C(1), C(1), C(0)],
  y: [C(0), C(0, -1), C(0, 1), C(0)],
  z: [C(1), C(0), C(0), C(-1)],
  s: [C(1), C(0), C(0), C(0, 1)],
  t: [C(1), C(0), C(0), C(R2, R2)],
  rx: (th) => [C(Math.cos(th / 2)), C(0, -Math.sin(th / 2)), C(0, -Math.sin(th / 2)), C(Math.cos(th / 2))],
  ry: (th) => [C(Math.cos(th / 2)), C(-Math.sin(th / 2)), C(Math.sin(th / 2)), C(Math.cos(th / 2))],
  rz: (th) => [C(Math.cos(th / 2), -Math.sin(th / 2)), C(0), C(0), C(Math.cos(th / 2), Math.sin(th / 2))],
  p: (ph) => [C(1), C(0), C(0), C(Math.cos(ph), Math.sin(ph))],
};

export class State {
  constructor(n) {
    this.n = n;
    this.re = new Float64Array(1 << n);
    this.im = new Float64Array(1 << n);
    this.re[0] = 1;
  }
  clone() {
    const s = new State(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }
  get size() { return 1 << this.n; }
  mask(q) { return 1 << (this.n - 1 - q); }
  bit(i, q) { return (i >> (this.n - 1 - q)) & 1; }

  // apply M to qubit q when every control qubit is 1.
  apply(q, M, controls = []) {
    const m = this.mask(q);
    const cm = controls.reduce((a, c) => a | this.mask(c), 0);
    const { re, im } = this;
    for (let i = 0; i < this.size; i++) {
      if (i & m || (i & cm) !== cm) continue;
      const j = i | m;
      const ar = re[i], ai = im[i], br = re[j], bi = im[j];
      re[i] = M[0].re * ar - M[0].im * ai + M[1].re * br - M[1].im * bi;
      im[i] = M[0].re * ai + M[0].im * ar + M[1].re * bi + M[1].im * br;
      re[j] = M[2].re * ar - M[2].im * ai + M[3].re * br - M[3].im * bi;
      im[j] = M[2].re * ai + M[2].im * ar + M[3].re * bi + M[3].im * br;
    }
    return this;
  }
  swap(a, b) {
    const ma = this.mask(a), mb = this.mask(b);
    for (let i = 0; i < this.size; i++) {
      if (i & ma && !(i & mb)) {
        const j = (i & ~ma) | mb;
        [this.re[i], this.re[j]] = [this.re[j], this.re[i]];
        [this.im[i], this.im[j]] = [this.im[j], this.im[i]];
      }
    }
    return this;
  }
  prob(i) { return this.re[i] ** 2 + this.im[i] ** 2; }
  probs() { return Array.from({ length: this.size }, (_, i) => this.prob(i)); }
  norm() { return Math.sqrt(this.probs().reduce((a, b) => a + b, 0)); }

  // measure qubit q: sample, collapse and renormalise. Returns the bit.
  measure(q, rng) {
    const m = this.mask(q);
    let p1 = 0;
    for (let i = 0; i < this.size; i++) if (i & m) p1 += this.prob(i);
    const b = rng() < p1 ? 1 : 0;
    this.collapse(q, b);
    return b;
  }
  collapse(q, b) {
    const m = this.mask(q);
    let p = 0;
    for (let i = 0; i < this.size; i++) if (((i & m) ? 1 : 0) === b) p += this.prob(i);
    const k = p > 0 ? 1 / Math.sqrt(p) : 0;
    for (let i = 0; i < this.size; i++) {
      if (((i & m) ? 1 : 0) === b) { this.re[i] *= k; this.im[i] *= k; } else { this.re[i] = 0; this.im[i] = 0; }
    }
    return p;
  }
  // purity Tr(ρ_q²) of one qubit's reduced state: 1 for a product.
  purity(q) {
    const m = this.mask(q);
    let p0 = 0, p1 = 0, cr = 0, ci = 0;
    for (let i = 0; i < this.size; i++) {
      if (i & m) { p1 += this.prob(i); continue; }
      p0 += this.prob(i);
      const j = i | m; // ρ01 += a_i · conj(a_j)
      cr += this.re[i] * this.re[j] + this.im[i] * this.im[j];
      ci += this.im[i] * this.re[j] - this.re[i] * this.im[j];
    }
    return p0 * p0 + p1 * p1 + 2 * (cr * cr + ci * ci);
  }
}

// A single-qubit state cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩.
export const blochAmps = (theta, phi) => [C(Math.cos(theta / 2)), C(Math.sin(theta / 2) * Math.cos(phi), Math.sin(theta / 2) * Math.sin(phi))];

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample(probs, rng) {
  let r = rng();
  for (let i = 0; i < probs.length; i++) if ((r -= probs[i]) <= 0) return i;
  return probs.length - 1;
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const sub = (n) => String(n).split("").map((d) => SUB[d]).join("");
export const ket = (i, n) => "|" + i.toString(2).padStart(n, "0") + "⟩";
const r3 = (v) => { const s = (Math.abs(v) < 5e-10 ? 0 : v).toFixed(3); return s === "-0.000" ? "0.000" : s; };
export const cfmt = (re, im) => {
  const a = r3(re).replace("-", "−");
  const b = r3(Math.abs(im));
  return `${a} ${im < -5e-10 ? "−" : "+"} ${b}i`;
};
// Phase as a hue: 0 rad red-ish pink, turning through the wheel (OKLCH,
// fixed lightness so it reads in both themes).
export const phaseColor = (re, im) => `oklch(0.68 0.15 ${(((Math.atan2(im, re) * 180) / Math.PI + 360) % 360).toFixed(0)})`;

// Compact Dirac notation of the non-zero terms, e.g. "0.707|00⟩ + 0.707|11⟩".
export function dirac(s) {
  const terms = [];
  for (let i = 0; i < s.size; i++) {
    const re = s.re[i], im = s.im[i];
    if (re * re + im * im < 1e-12) continue;
    let coef;
    if (Math.abs(im) < 1e-9) coef = r3(re);
    else if (Math.abs(re) < 1e-9) coef = r3(im) + "i";
    else coef = "(" + cfmt(re, im).replace(/ /g, "") + ")";
    terms.push(coef.replace("-", "−") + ket(i, s.n));
  }
  return terms.join(" + ").replace(/\+ −/g, "− ") || "0";
}

// stateTable fills container with one row per basis state: ket, amplitude,
// probability bar and a phase swatch. Built with textContent only.
export function stateTable(container, s, { hideZero = false } = {}) {
  container.replaceChildren();
  const table = document.createElement("table");
  table.className = "w-full text-xs";
  const head = table.createTHead().insertRow();
  for (const [t, cls] of [["basis", "text-left"], ["amplitude", "text-right"], ["probability", "text-left"], ["phase", "text-center"]]) {
    const th = document.createElement("th");
    th.className = `sticky top-0 bg-background px-2 py-1.5 font-normal text-muted-foreground ${cls}`;
    th.textContent = t;
    head.append(th);
  }
  const body = table.createTBody();
  for (let i = 0; i < s.size; i++) {
    const p = s.prob(i);
    if (hideZero && p < 1e-12) continue;
    const row = body.insertRow();
    row.className = "border-t " + (p < 1e-12 ? "text-muted-foreground/50" : "");
    const k = row.insertCell(); k.className = "px-2 py-1 font-mono"; k.textContent = ket(i, s.n);
    const a = row.insertCell(); a.className = "px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap"; a.textContent = cfmt(s.re[i], s.im[i]);
    const pc = row.insertCell(); pc.className = "w-2/5 px-2 py-1";
    const wrap = document.createElement("div"); wrap.className = "flex items-center gap-2";
    const bar = document.createElement("div"); bar.className = "h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-foreground/8";
    const fill = document.createElement("div"); fill.className = "h-full rounded-full bg-brand"; fill.style.width = `${(p * 100).toFixed(2)}%`;
    bar.append(fill);
    const pt = document.createElement("span"); pt.className = "w-12 text-right font-mono tabular-nums"; pt.textContent = (p * 100).toFixed(1) + "%";
    wrap.append(bar, pt); pc.append(wrap);
    const ph = row.insertCell(); ph.className = "px-2 py-1 text-center";
    if (p >= 1e-12) {
      const dot = document.createElement("span");
      dot.className = "inline-block size-2.5 rounded-full align-middle";
      dot.style.background = phaseColor(s.re[i], s.im[i]);
      dot.title = `arg = ${((Math.atan2(s.im[i], s.re[i]) * 180) / Math.PI).toFixed(1)}°`;
      ph.append(dot);
    }
  }
  container.append(table);
}

// Expectation ⟨ψ|O|ψ⟩ of a product of 2×2 Hermitian operators, one per
// listed qubit: copy, apply each operator, take the inner product.
export function expect(s, ops) {
  const t = s.clone();
  for (const [q, M] of ops) t.apply(q, M);
  let e = 0;
  for (let i = 0; i < s.size; i++) e += s.re[i] * t.re[i] + s.im[i] * t.im[i];
  return e;
}

// The observable cos a·Z + sin a·X: a spin measurement at Bloch angle a
// in the x–z plane.
export const axisOp = (a) => [C(Math.cos(a)), C(Math.sin(a)), C(Math.sin(a)), C(-Math.cos(a))];
