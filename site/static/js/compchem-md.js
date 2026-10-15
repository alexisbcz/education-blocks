// A 2D Lennard-Jones fluid in reduced units (σ = ε = m = k_B = 1):
// velocity Verlet, periodic boundaries with the minimum image, a pair
// potential cut and shifted at r_c = 2.5σ, and a cell list so each step
// costs O(N). This module only exports.

import { rng, gauss } from "./compchem-util.js";

const RC = 2.5, RC2 = RC * RC;
const VC = 4 * (RC ** -12 - RC ** -6); // shift so V(r_c) = 0

export class LJBox {
  /** N particles at number density rho, velocities drawn at temperature T. */
  constructor({ N = 100, rho = 0.7, T = 1, seed = 1 } = {}) {
    this.N = N;
    this.L = Math.sqrt(N / rho);
    this.rho = rho;
    this.x = new Float64Array(N); this.y = new Float64Array(N);
    this.ux = new Float64Array(N); this.uy = new Float64Array(N); // unwrapped
    this.vx = new Float64Array(N); this.vy = new Float64Array(N);
    this.fx = new Float64Array(N); this.fy = new Float64Array(N);
    this.t = 0;
    const r = rng(seed);
    // A triangular lattice, the 2D close packing, fitted to the box.
    const cols = Math.ceil(Math.sqrt(N * 1.15)), rows = Math.ceil(N / cols);
    const dx = this.L / cols, dy = this.L / rows;
    for (let i = 0; i < N; i++) {
      const c = i % cols, w = Math.floor(i / cols);
      this.x[i] = this.ux[i] = (c + 0.25 + (w % 2) * 0.5) * dx;
      this.y[i] = this.uy[i] = (w + 0.5) * dy;
      this.vx[i] = gauss(r); this.vy[i] = gauss(r);
    }
    // Remove the centre-of-mass drift, then scale to T exactly.
    let mx = 0, my = 0;
    for (let i = 0; i < N; i++) { mx += this.vx[i] / N; my += this.vy[i] / N; }
    for (let i = 0; i < N; i++) { this.vx[i] -= mx; this.vy[i] -= my; }
    this.scaleTo(T);
    this.forces();
  }

  /** Kinetic temperature: 2 degrees of freedom per particle, minus 2 for momentum. */
  temperature() {
    let k = 0;
    for (let i = 0; i < this.N; i++) k += this.vx[i] ** 2 + this.vy[i] ** 2;
    return k / (2 * this.N - 2);
  }
  kinetic() {
    let k = 0;
    for (let i = 0; i < this.N; i++) k += 0.5 * (this.vx[i] ** 2 + this.vy[i] ** 2);
    return k;
  }
  scaleTo(T) {
    const t = this.temperature();
    if (t <= 0) return;
    const s = Math.sqrt(T / t);
    for (let i = 0; i < this.N; i++) { this.vx[i] *= s; this.vy[i] *= s; }
  }

  /** Visits every pair closer than r_c once, through a cell list. */
  pairs(fn) {
    const { N, L, x, y } = this;
    const nc = Math.max(1, Math.floor(L / RC)), cs = L / nc;
    const head = new Int32Array(nc * nc).fill(-1), next = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const c = (Math.min(nc - 1, Math.floor(y[i] / cs)) * nc) + Math.min(nc - 1, Math.floor(x[i] / cs));
      next[i] = head[c]; head[c] = i;
    }
    const half = L / 2;
    const visit = (i, j) => {
      let dx = x[i] - x[j], dy = y[i] - y[j];
      if (dx > half) dx -= L; else if (dx < -half) dx += L;
      if (dy > half) dy -= L; else if (dy < -half) dy += L;
      const r2 = dx * dx + dy * dy;
      if (r2 < RC2) fn(i, j, dx, dy, r2);
    };
    if (nc < 3) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) visit(i, j);
      return;
    }
    for (let cy = 0; cy < nc; cy++) for (let cx = 0; cx < nc; cx++) {
      const c = cy * nc + cx;
      // This cell, and four neighbours so each cell pair is seen once.
      for (let i = head[c]; i >= 0; i = next[i]) for (let j = next[i]; j >= 0; j = next[j]) visit(i, j);
      for (const [ox, oy] of [[1, 0], [1, 1], [0, 1], [-1, 1]]) {
        const d = ((cy + oy + nc) % nc) * nc + ((cx + ox + nc) % nc);
        for (let i = head[c]; i >= 0; i = next[i]) for (let j = head[d]; j >= 0; j = next[j]) visit(i, j);
      }
    }
  }

  forces() {
    const { fx, fy } = this;
    fx.fill(0); fy.fill(0);
    let pe = 0, vir = 0;
    this.pairs((i, j, dx, dy, r2) => {
      const ir2 = 1 / r2, ir6 = ir2 * ir2 * ir2;
      const f = 24 * ir6 * (2 * ir6 - 1) * ir2; // F/r
      fx[i] += f * dx; fy[i] += f * dy; fx[j] -= f * dx; fy[j] -= f * dy;
      pe += 4 * ir6 * (ir6 - 1) - VC;
      vir += f * r2;
    });
    this.pe = pe;
    this.virial = vir;
  }

  /** n velocity-Verlet steps of dt; with a target T, Berendsen rescaling (τ = 0.1). */
  step(n = 1, dt = 0.005, Ttarget = null) {
    const { N, L, x, y, ux, uy, vx, vy, fx, fy } = this;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < N; i++) {
        vx[i] += 0.5 * dt * fx[i]; vy[i] += 0.5 * dt * fy[i];
        const ddx = dt * vx[i], ddy = dt * vy[i];
        x[i] += ddx; y[i] += ddy; ux[i] += ddx; uy[i] += ddy;
        x[i] -= L * Math.floor(x[i] / L); y[i] -= L * Math.floor(y[i] / L);
      }
      this.forces();
      for (let i = 0; i < N; i++) { vx[i] += 0.5 * dt * fx[i]; vy[i] += 0.5 * dt * fy[i]; }
      if (Ttarget !== null) {
        const t = this.temperature();
        if (t > 0) {
          const lam = Math.sqrt(1 + (dt / 0.1) * (Ttarget / t - 1));
          for (let i = 0; i < N; i++) { vx[i] *= lam; vy[i] *= lam; }
        }
      }
      this.t += dt;
    }
  }

  /** Pressure from the virial theorem in 2D: P = ρT + Σ r·F / (2A). */
  pressure() {
    return this.rho * this.temperature() + this.virial / (2 * this.L * this.L);
  }

  /** Adds the pair distances to a histogram of g(r) up to rmax. */
  sampleGr(hist, rmax) {
    const { N, L, x, y } = this, dr = rmax / hist.length, half = L / 2;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let dx = x[i] - x[j], dy = y[i] - y[j];
      if (dx > half) dx -= L; else if (dx < -half) dx += L;
      if (dy > half) dy -= L; else if (dy < -half) dy += L;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < rmax) hist[Math.floor(r / dr)] += 2;
    }
  }

  /** Normalises a g(r) histogram from `frames` samples against an ideal gas. */
  normaliseGr(hist, rmax, frames) {
    const dr = rmax / hist.length;
    return Array.from(hist, (h, k) => {
      const r0 = k * dr, shell = Math.PI * ((r0 + dr) ** 2 - r0 * r0);
      return frames ? h / (frames * this.N * this.rho * shell) : 0;
    });
  }
}
