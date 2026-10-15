// The science behind the computational chemistry blocks, as pure functions
// with no DOM: Lennard-Jones, Müller–Brown and its optimisers, the nudged
// elastic band, the butane torsion, Hückel theory, normal modes and the
// Gaussian basis for hydrogen. This module only exports.

import { jacobi, geneig, nelderMead } from "./compchem-util.js";

// ============================================================ Lennard-Jones

/** V(r) and F(r) = −dV/dr for the 12-6 potential. */
export const ljV = (r, eps = 1, sig = 1) => { const s6 = (sig / r) ** 6; return 4 * eps * (s6 * s6 - s6); };
export const ljF = (r, eps = 1, sig = 1) => { const s6 = (sig / r) ** 6; return (24 * eps * (2 * s6 * s6 - s6)) / r; };
export const LJ_RMIN = 2 ** (1 / 6);
/** V''(r_min) = 72 · 2^(−1/3) ε/σ² ≈ 57.15 ε/σ². */
export const LJ_K = 72 * 2 ** (-1 / 3);

/** The two radii where V(r) = E for −ε < E < 0 (σ = ε = 1). */
export function ljTurning(E) {
  // With u = (1/r)^6: 4(u² − u) = E → u = (1 ± √(1 + E)) / 2.
  const s = Math.sqrt(1 + E);
  return [((1 + s) / 2) ** (-1 / 6), ((1 - s) / 2) ** (-1 / 6)];
}

/** Period of the dimer's relative motion at energy E, μ = 1/2 (m = 1). */
export function ljPeriod(E) {
  // T = 2 ∫ dr / v with v = √(2(E − V)/μ); substitute r = a + (b−a)(1−cos θ)/2.
  const [a, b] = ljTurning(E), mu = 0.5, N = 4000;
  let T = 0;
  for (let k = 0; k < N; k++) {
    const th = (Math.PI * (k + 0.5)) / N, r = a + ((b - a) * (1 - Math.cos(th))) / 2;
    const dr = ((b - a) / 2) * Math.sin(th) * (Math.PI / N);
    const v = Math.sqrt(Math.max(1e-300, (2 * (E - ljV(r))) / mu));
    T += dr / v;
  }
  return 2 * T;
}

// ============================================================ Müller–Brown

const MB = {
  A: [-200, -100, -170, 15], a: [-1, -1, -6.5, 0.7], b: [0, 0, 11, 0.6],
  c: [-10, -10, -6.5, 0.7], x0: [1, 0, -0.5, -1], y0: [0, 0.5, 1.5, 1],
};
/** Müller and Brown's 1979 surface: energy and gradient. */
export function mbV(x, y) {
  let v = 0;
  for (let k = 0; k < 4; k++) {
    const dx = x - MB.x0[k], dy = y - MB.y0[k];
    v += MB.A[k] * Math.exp(MB.a[k] * dx * dx + MB.b[k] * dx * dy + MB.c[k] * dy * dy);
  }
  return v;
}
export function mbG(x, y) {
  let gx = 0, gy = 0;
  for (let k = 0; k < 4; k++) {
    const dx = x - MB.x0[k], dy = y - MB.y0[k];
    const e = MB.A[k] * Math.exp(MB.a[k] * dx * dx + MB.b[k] * dx * dy + MB.c[k] * dy * dy);
    gx += e * (2 * MB.a[k] * dx + MB.b[k] * dy);
    gy += e * (MB.b[k] * dx + 2 * MB.c[k] * dy);
  }
  return [gx, gy];
}
export const MB_MINIMA = [
  { name: "A", x: -0.55822, y: 1.44173 },
  { name: "B", x: -0.05001, y: 0.46669 },
  { name: "C", x: 0.62350, y: 0.02804 },
];
export const MB_VIEW = { x: [-1.5, 1.2], y: [-0.4, 2.0] };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

/** Backtracking (Armijo) line search along d from p; returns the step taken. */
function lineSearch(f, p, g, d, t0 = 0.01) {
  let t = t0, f0 = f(p[0], p[1]), gd = dot(g, d), evals = 1;
  if (gd >= 0) return { t: 0, evals };
  for (let k = 0; k < 60; k++) {
    evals++;
    if (f(p[0] + t * d[0], p[1] + t * d[1]) <= f0 + 1e-4 * t * gd) {
      // Try growing while it keeps improving (a cheap bracket).
      for (let j = 0; j < 30; j++) {
        evals++;
        const t2 = t * 1.6;
        if (f(p[0] + t2 * d[0], p[1] + t2 * d[1]) < f(p[0] + t * d[0], p[1] + t * d[1])) t = t2; else break;
      }
      return { t, evals };
    }
    t *= 0.5;
  }
  return { t: 0, evals };
}

/**
 * Runs one optimiser from (x, y) on Müller–Brown. method: "sd", "cg", "bfgs".
 * Returns the path and counts of gradient and energy evaluations.
 */
export function optimise(method, x, y, maxIter = 400, gtol = 1e-3) {
  let p = [x, y], g = mbG(x, y), d = [-g[0], -g[1]], H = [[1, 0], [0, 1]];
  const pts = [[x, y]];
  let grads = 1, energies = 0, it = 0;
  for (; it < maxIter && Math.hypot(g[0], g[1]) > gtol; it++) {
    if (method === "sd") d = [-g[0], -g[1]];
    if (method === "bfgs") d = [-(H[0][0] * g[0] + H[0][1] * g[1]), -(H[1][0] * g[0] + H[1][1] * g[1])];
    if (dot(d, g) >= 0) d = [-g[0], -g[1]];
    // Scale the first trial step so it moves about 0.05 in x, y.
    const t0 = method === "bfgs" && it > 0 ? 1 : 0.05 / Math.hypot(d[0], d[1]);
    const ls = lineSearch(mbV, p, g, d, t0);
    energies += ls.evals;
    if (ls.t === 0) break;
    const s = [ls.t * d[0], ls.t * d[1]];
    const pn = [p[0] + s[0], p[1] + s[1]], gn = mbG(pn[0], pn[1]);
    grads++;
    if (method === "cg") {
      // Polak–Ribière with automatic restart (β ≥ 0).
      const beta = Math.max(0, (gn[0] * (gn[0] - g[0]) + gn[1] * (gn[1] - g[1])) / dot(g, g));
      d = [-gn[0] + beta * d[0], -gn[1] + beta * d[1]];
    }
    if (method === "bfgs") {
      const yv = [gn[0] - g[0], gn[1] - g[1]], sy = dot(s, yv);
      if (it === 0 && sy > 0) { const sc = sy / dot(yv, yv); H = [[sc, 0], [0, sc]]; }
      if (sy > 1e-12) {
        const Hy = [H[0][0] * yv[0] + H[0][1] * yv[1], H[1][0] * yv[0] + H[1][1] * yv[1]];
        const yHy = dot(yv, Hy), r = 1 / sy;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
          H[i][j] += (1 + yHy * r) * r * s[i] * s[j] - r * (Hy[i] * s[j] + s[i] * Hy[j]);
      }
    }
    p = pn; g = gn;
    pts.push(p.slice());
  }
  return { pts, iters: it, grads, energies, end: p, E: mbV(p[0], p[1]), gnorm: Math.hypot(g[0], g[1]) };
}

/**
 * Nudged elastic band: images between fixed end points, the true force
 * perpendicular to the path plus a spring force along it (Henkelman &
 * Jónsson 2000 tangent). With climb, the highest image climbs uphill
 * along the tangent instead (climbing image, Henkelman et al. 2000).
 */
export function nebInit(a, b, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    // A slight bow off the straight line so the band starts away from the ridge.
    const bow = Math.sin(Math.PI * t) * 0.15;
    return [a.x + t * (b.x - a.x) - bow * (b.y - a.y) * 0.3, a.y + t * (b.y - a.y) + bow * (b.x - a.x) * 0.3];
  });
}

export function nebStep(P, { k = 100, climb = false, dt = 4e-5 } = {}) {
  const n = P.length, E = P.map((p) => mbV(p[0], p[1]));
  const top = E.slice(1, -1).indexOf(Math.max(...E.slice(1, -1))) + 1;
  const F = P.map(() => [0, 0]);
  let fmax = 0;
  for (let i = 1; i < n - 1; i++) {
    const tp = [P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]], tm = [P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]];
    let tau;
    if (E[i + 1] > E[i] && E[i] > E[i - 1]) tau = tp;
    else if (E[i + 1] < E[i] && E[i] < E[i - 1]) tau = tm;
    else {
      const dmax = Math.max(Math.abs(E[i + 1] - E[i]), Math.abs(E[i - 1] - E[i]));
      const dmin = Math.min(Math.abs(E[i + 1] - E[i]), Math.abs(E[i - 1] - E[i]));
      tau = E[i + 1] > E[i - 1] ? [tp[0] * dmax + tm[0] * dmin, tp[1] * dmax + tm[1] * dmin] : [tp[0] * dmin + tm[0] * dmax, tp[1] * dmin + tm[1] * dmax];
    }
    const tn = Math.hypot(tau[0], tau[1]) || 1;
    tau = [tau[0] / tn, tau[1] / tn];
    const g = mbG(P[i][0], P[i][1]), gpar = dot(g, tau);
    let f;
    if (climb && i === top) f = [-g[0] + 2 * gpar * tau[0], -g[1] + 2 * gpar * tau[1]];
    else {
      const fs = k * (Math.hypot(tp[0], tp[1]) - Math.hypot(tm[0], tm[1]));
      f = [-(g[0] - gpar * tau[0]) + fs * tau[0], -(g[1] - gpar * tau[1]) + fs * tau[1]];
    }
    F[i] = f;
    fmax = Math.max(fmax, Math.hypot(f[0], f[1]));
  }
  // A capped steepest-descent move per image.
  const Q = P.map((p, i) => {
    const s = Math.min(dt, 0.01 / Math.max(1e-12, Math.hypot(F[i][0], F[i][1])));
    return [p[0] + s * F[i][0], p[1] + s * F[i][1]];
  });
  return { P: Q, fmax, top, E };
}

// ============================================================ Butane

/**
 * The butane torsion, V(φ) = Σ aₙ cos nφ for n = 0…3, fitted exactly
 * through McMurry's textbook values: anti (180°) 0, gauche (60°) 3.8,
 * eclipsed H/CH₃ (120°) 16 and syn (0°) 19 kJ/mol.
 */
export const BUTANE_ANCHORS = [[0, 19], [60, 3.8], [120, 16], [180, 0]];
export const butaneCoeffs = (() => {
  const M = BUTANE_ANCHORS.map(([d]) => [0, 1, 2, 3].map((n) => Math.cos((n * d * Math.PI) / 180)));
  const b = BUTANE_ANCHORS.map(([, v]) => v);
  // Gaussian elimination on the 4×4 system.
  const A = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 4; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 5; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, i) => r[4] / r[i]);
})();
export const butaneV = (deg) => butaneCoeffs.reduce((s, a, n) => s + a * Math.cos((n * deg * Math.PI) / 180), 0);

/** Boltzmann populations of anti (120–240°) and both gauche wells at T (K). */
export function butanePop(T) {
  const RT = (8.314462618 * T) / 1000;
  let anti = 0, gauche = 0;
  for (let k = 0; k < 3600; k++) {
    const d = (k + 0.5) / 10, w = Math.exp(-butaneV(d) / RT);
    if (d > 120 && d < 240) anti += w; else gauche += w;
  }
  return { anti: anti / (anti + gauche), gauche: gauche / (anti + gauche) };
}

// ============================================================ Hückel

const ring = (n, r = 1, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [r * Math.cos(rot + (2 * Math.PI * i) / n), r * Math.sin(rot + (2 * Math.PI * i) / n)]);
const chain = (n) => Array.from({ length: n }, (_, i) => [i * 0.87, i % 2 ? -0.5 : 0]);
const chainBonds = (n) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
const ringBonds = (n) => [...chainBonds(n), [n - 1, 0]];

export const HUCKEL = {
  ethylene: { name: "Ethylene", pos: chain(2), bonds: chainBonds(2), cyclic: false },
  allyl: { name: "Allyl", pos: chain(3), bonds: chainBonds(3), cyclic: false },
  butadiene: { name: "Butadiene", pos: chain(4), bonds: chainBonds(4), cyclic: false },
  hexatriene: { name: "Hexatriene", pos: chain(6), bonds: chainBonds(6), cyclic: false },
  cyclobutadiene: { name: "Cyclobutadiene", pos: ring(4, 0.71, -Math.PI / 4), bonds: ringBonds(4), cyclic: true },
  cp: { name: "Cyclopentadienyl", pos: ring(5, 0.85), bonds: ringBonds(5), cyclic: true },
  benzene: { name: "Benzene", pos: ring(6), bonds: ringBonds(6), cyclic: true },
  naphthalene: {
    name: "Naphthalene",
    // Two hexagons sharing the bond 1–2 on the y axis.
    pos: [[-0.866, -1], [0, -0.5], [0, 0.5], [-0.866, 1], [-1.732, 0.5], [-1.732, -0.5], [0.866, -1], [1.732, -0.5], [1.732, 0.5], [0.866, 1]],
    bonds: [...ringBonds(6), [1, 6], [6, 7], [7, 8], [8, 9], [9, 2]],
    cyclic: true, fused: true,
  },
};

/** Size of a maximum matching of a small graph (brute force over edges). */
function maxMatching(n, bonds) {
  let best = 0;
  const rec = (k, used, size) => {
    if (size + (bonds.length - k) <= best) return;
    if (k === bonds.length) { best = Math.max(best, size); return; }
    const [i, j] = bonds[k];
    if (!(used & (1 << i)) && !(used & (1 << j))) rec(k + 1, used | (1 << i) | (1 << j), size + 1);
    rec(k + 1, used, size);
  };
  rec(0, 0, 0);
  return best;
}

/**
 * Solves the Hückel problem: H = αI + βA, so with E = α + xβ the
 * coefficients are the eigenvectors of A and x its eigenvalues. Since β < 0,
 * larger x is lower energy: levels are returned lowest energy first.
 */
export function huckel(mol, electrons) {
  const n = mol.pos.length, A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [i, j] of mol.bonds) A[i][j] = A[j][i] = 1;
  const { values, vectors } = jacobi(A);
  const levels = values.map((x, k) => ({ x, c: vectors[k] })).reverse();
  // Fill pairs from the bottom; a degenerate shell shares its electrons
  // equally (Hund's rule for the occupation numbers).
  let left = electrons;
  const occ = new Array(n).fill(0);
  for (let k = 0; k < n && left > 0;) {
    let m = k;
    while (m + 1 < n && Math.abs(levels[m + 1].x - levels[k].x) < 1e-6) m++;
    const size = m - k + 1, take = Math.min(left, 2 * size);
    for (let q = k; q <= m; q++) occ[q] = take / size;
    left -= take;
    k = m + 1;
  }
  const Epi = levels.reduce((s, l, k) => s + occ[k] * l.x, 0); // in units of β, plus Nα
  const homo = occ.reduce((h, o, k) => (o > 0 ? k : h), -1);
  const lumo = occ.findIndex((o) => o < 2);
  const bond = (i, j) => levels.reduce((s, l, k) => s + occ[k] * l.c[i] * l.c[j], 0);
  const charge = Array.from({ length: n }, (_, i) => 1 - levels.reduce((s, l, k) => s + occ[k] * l.c[i] ** 2, 0));
  // The localized reference: as many isolated ethylene bonds (2β each) as
  // the electrons and the bond graph allow; the rest sit in p orbitals (0).
  const local = 2 * Math.min(Math.floor(electrons / 2), maxMatching(n, mol.bonds));
  return { levels, occ, Epi, homo, lumo, bond, charge, local, deloc: Epi - local };
}

// ============================================================ Normal modes

const AMU = 1.66053906660e-27, C_CM = 2.99792458e10;
/** ω in cm⁻¹ from an eigenvalue of the mass-weighted Hessian in aJ/(Å²·amu). */
export const wavenumber = (lam) => Math.sign(lam) * Math.sqrt((Math.abs(lam) * 1e-18) / 1e-20 / AMU) / (2 * Math.PI * C_CM);

export const MOLECULES = {
  co2: {
    name: "CO₂", atoms: ["O", "C", "O"], mass: [15.995, 12.0, 15.995], charge: [-0.35, 0.7, -0.35],
    r0: 1.16, theta0: 180, k: 15.5, kth: 0.77, observed: [667, 1333, 2349],
  },
  h2o: {
    name: "H₂O", atoms: ["H", "O", "H"], mass: [1.008, 15.995, 1.008], charge: [0.4, -0.8, 0.4],
    r0: 0.9572, theta0: 104.52, k: 7.7, kth: 0.645, observed: [1595, 3657, 3756],
  },
};

/** Planar geometry: the central atom at the origin, the arms symmetric. */
export function geometry(m) {
  const h = ((m.theta0 / 2) * Math.PI) / 180;
  return [-m.r0 * Math.sin(h), -m.r0 * Math.cos(h), 0, 0, m.r0 * Math.sin(h), -m.r0 * Math.cos(h)];
}

/** Valence force field energy in aJ: two stretches and one bend. */
function vff(m, X, k, kth) {
  const ax = X[0] - X[2], ay = X[1] - X[3], bx = X[4] - X[2], by = X[5] - X[3];
  const ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by);
  // The signed angle via atan2 stays smooth through 180° (linear CO₂).
  const th = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  const dth = th - (m.theta0 * Math.PI) / 180;
  return 0.5 * k * ((ra - m.r0) ** 2 + (rb - m.r0) ** 2) + 0.5 * kth * dth * dth;
}

/**
 * Normal modes in the molecular plane from a numerical Hessian. Returns
 * the vibrational modes (translations and rotation removed), each with
 * its wavenumber, Cartesian displacement and IR intensity (relative).
 */
export function normalModes(m, k = m.k, kth = m.kth) {
  const X0 = geometry(m), n = 6, h = 1e-4, E = (X) => vff(m, X, k, kth);
  const H = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const at = (di, dj) => { const X = X0.slice(); X[i] += di; X[j] += dj; return E(X); };
    H[i][j] = H[j][i] = (at(h, h) - at(h, -h) - at(-h, h) + at(-h, -h)) / (4 * h * h);
  }
  const msq = [0, 0, 1, 1, 2, 2].map((a) => Math.sqrt(m.mass[a]));
  const Hm = H.map((r, i) => r.map((v, j) => v / (msq[i] * msq[j])));
  const { values, vectors } = jacobi(Hm);
  const modes = [];
  values.forEach((lam, idx) => {
    const nu = wavenumber(lam);
    if (Math.abs(nu) < 50) return; // translation or rotation
    const disp = vectors[idx].map((v, i) => v / msq[i]);
    const norm = Math.hypot(...disp);
    const d = disp.map((v) => v / norm);
    // Dipole derivative along the mode with fixed partial charges.
    let mx = 0, my = 0;
    for (let a = 0; a < 3; a++) { mx += m.charge[a] * vectors[idx][2 * a] / msq[2 * a]; my += m.charge[a] * vectors[idx][2 * a + 1] / msq[2 * a]; }
    modes.push({ nu, d, ir: mx * mx + my * my });
  });
  modes.sort((a, b) => a.nu - b.nu);
  const irMax = Math.max(...modes.map((q) => q.ir), 1e-12);
  for (const q of modes) q.irRel = q.ir / irMax;
  return { X0, modes };
}

// ============================================================ Gaussian basis

/**
 * Hydrogen 1s with n s-type Gaussians e^(−α r²), in hartree. Matrix
 * elements over unnormalised primitives (atomic units):
 * S = (π/p)^{3/2}, T = 3ab/p · S, V = −2π/p, with p = a + b.
 */
export function gaussEnergy(alphas) {
  const n = alphas.length;
  const S = [], H = [];
  for (let i = 0; i < n; i++) {
    S.push([]); H.push([]);
    for (let j = 0; j < n; j++) {
      const a = alphas[i], b = alphas[j], p = a + b, s = (Math.PI / p) ** 1.5;
      S[i].push(s);
      H[i].push((3 * a * b) / p * s - (2 * Math.PI) / p);
    }
  }
  const r = geneig(H, S);
  if (!r) return { E: NaN };
  const c = r.vectors[0];
  // Normalise ⟨ψ|ψ⟩ = 1.
  let nn = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) nn += c[i] * c[j] * S[i][j];
  const cs = c.map((v) => v / Math.sqrt(nn) * Math.sign(c.reduce((a, b) => a + b, 0) || 1));
  return { E: r.values[0], c: cs };
}

/** ψ(r) for the expansion, to compare with the exact e^(−r)/√π. */
export const gaussPsi = (alphas, c, r) => alphas.reduce((s, a, i) => s + c[i] * Math.exp(-a * r * r), 0);

/** Optimises all exponents (in log space) for n Gaussians. */
export function optimiseGaussians(n, start) {
  // Even-tempered start: α_k = a·b^k, a good basin for every n.
  const x0 = start ?? Array.from({ length: n }, (_, k) => Math.log(0.12 * 3.6 ** k));
  const f = (lx) => { const e = gaussEnergy(lx.map(Math.exp)).E; return Number.isFinite(e) ? e : 1e9; };
  let best = nelderMead(f, x0, 0.4, 6000);
  // Restart once from the result: Nelder–Mead stalls in long valleys.
  best = nelderMead(f, best.x, 0.15, 6000);
  const alphas = best.x.map(Math.exp).sort((a, b) => a - b);
  return { alphas, ...gaussEnergy(alphas) };
}

/** STO-3G for ζ = 1 (Hehre, Stewart & Pople 1969): fixed exponents. */
export const STO3G = [0.109818, 0.405771, 2.22766];
