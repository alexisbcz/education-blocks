// Computational chemistry, blocks solved by matrix diagonalisation:
// Hückel π orbitals, normal modes of a triatomic, and the hydrogen atom in
// a basis of Gaussians.

import { scrubAll } from "./scrub.js";
import {
  el, text, frame, polyline, outs, plot, fx, minus, C, onSeg, onToggle, toggled, onScreen, reduced, clipped, ticks, tickFmt, path,
} from "./compchem-util.js";
import { HUCKEL, huckel, MOLECULES, normalModes, optimiseGaussians, gaussEnergy, gaussPsi, STO3G } from "./compchem-chem.js";

/** Marks a segment as selected without firing its event. */
function selectSeg(root, label, value) {
  root.querySelector(`[role=tablist][aria-label="${label}"]`)?.querySelectorAll("[data-seg]")
    .forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === value)));
}

// ============================================================ 7 Hückel

for (const root of document.querySelectorAll("[data-cc-huckel]")) {
  const msvg = plot(root, "mol"), lsvg = plot(root, "levels"), o = outs(root);
  let key = "benzene", sel = 0, res;
  lsvg.setAttribute("tabindex", "0");
  const s = scrubAll(root, () => { solve(); draw(); });
  onSeg(root, (_, v) => { key = v; s.q.set(0, false); solve(); sel = res.homo; draw(); });

  function solve() {
    const mol = HUCKEL[key], n = mol.pos.length;
    const ne = Math.max(0, Math.min(2 * n, n - Math.round(s.q.get())));
    res = { ...huckel(mol, ne), ne, mol };
    sel = Math.min(sel, n - 1);
  }

  function drawMolecule() {
    const { mol, levels, bond } = res, n = mol.pos.length;
    msvg.replaceChildren();
    const xs = mol.pos.map((p) => p[0]), ys = mol.pos.map((p) => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.3, 1);
    const sc = Math.min(250 / span, 120), cx = 190 - ((Math.max(...xs) + Math.min(...xs)) / 2) * sc, cy = 150 - ((Math.max(...ys) + Math.min(...ys)) / 2) * sc;
    const X = (p) => cx + p[0] * sc, Y = (p) => cy + p[1] * sc;
    for (const [i, j] of mol.bonds) {
      el("line", { x1: X(mol.pos[i]), y1: Y(mol.pos[i]), x2: X(mol.pos[j]), y2: Y(mol.pos[j]), style: "stroke:currentColor;stroke-opacity:0.55;stroke-width:2.5;stroke-linecap:round" }, msvg);
    }
    // Lobes of the selected orbital: area ∝ c², colour by sign.
    const c = levels[sel].c, R = Math.min(48, sc * 0.62);
    mol.pos.forEach((p, i) => {
      if (Math.abs(c[i]) < 1e-6) return;
      el("circle", { cx: X(p), cy: Y(p), r: R * Math.abs(c[i]), style: `fill:${c[i] > 0 ? C.i : C.j};fill-opacity:0.35;stroke:${c[i] > 0 ? C.i : C.j};stroke-width:1.5` }, msvg);
    });
    mol.pos.forEach((p, i) => {
      el("circle", { cx: X(p), cy: Y(p), r: 3.5, style: "fill:currentColor" }, msvg);
      if (Math.abs(c[i]) < 1e-6) text(msvg, X(p) + 6, Y(p) - 6, "node", { class: "fill-muted-foreground font-mono text-[9px]" });
    });
    // π bond orders on the bonds.
    for (const [i, j] of mol.bonds) {
      const mx = (X(mol.pos[i]) + X(mol.pos[j])) / 2, my = (Y(mol.pos[i]) + Y(mol.pos[j])) / 2;
      const dx = Y(mol.pos[j]) - Y(mol.pos[i]), dy = X(mol.pos[i]) - X(mol.pos[j]), L = Math.hypot(dx, dy) || 1;
      text(msvg, mx + (dx / L) * 13, my + (dy / L) * 13 + 3, fx(bond(i, j), 2), { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
    }
    text(msvg, 8, 292, `ψ${sel + 1}, coefficients ${c.map((v) => fx(v, 2)).join(" ")}`.slice(0, 70), { class: "fill-muted-foreground font-mono text-[10px]" });
  }

  function drawLevels() {
    const { levels, occ } = res, n = levels.length;
    lsvg.replaceChildren();
    const f = frame(lsvg, { box: [40, 16, 190, 264], x: [0, 1], y: [-2.6, 2.6], yticks: [-2, -1, 0, 1, 2], yfmt: (v) => (v === 0 ? "α" : `α${v > 0 ? "−" : "+"}${Math.abs(v)}β`), ylabel: "energy" });
    // Lower energy at the bottom: E = α + xβ with β < 0, so y = −x.
    const yOf = (x) => f.sy(-x);
    el("line", { x1: f.L, x2: f.L + f.W, y1: yOf(0), y2: yOf(0), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, lsvg);
    // Group degenerate levels to draw them side by side.
    const groups = [];
    levels.forEach((l, k) => {
      const g = groups.find((q) => Math.abs(q.x - l.x) < 1e-6);
      g ? g.ks.push(k) : groups.push({ x: l.x, ks: [k] });
    });
    for (const g of groups) {
      const w = 46, gap = 10, total = g.ks.length * w + (g.ks.length - 1) * gap, x0 = f.L + f.W / 2 - total / 2;
      g.ks.forEach((k, m) => {
        const x = x0 + m * (w + gap), y = yOf(g.x), on = k === sel;
        const hit = el("g", { "data-level": String(k), style: "cursor:pointer" }, lsvg);
        el("rect", { x: x - 4, y: y - 12, width: w + 8, height: 20, rx: 4, style: `fill:${on ? C.brand : "transparent"};fill-opacity:${on ? 0.12 : 0}` }, hit);
        el("line", { x1: x, x2: x + w, y1: y, y2: y, style: `stroke:${on ? C.brand : "currentColor"};stroke-width:${on ? 2.5 : 2}` }, hit);
        // Electrons as half-arrows: up, then down.
        const e = occ[k];
        const arrow = (ax, up) => el("path", { d: up ? `M${ax} ${y + 6}V${y - 9}l-3 4` : `M${ax} ${y - 9}V${y + 6}l3 -4`, style: "fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" }, hit);
        if (e >= 0.99) arrow(x + w / 2 - 6, true);
        if (e >= 1.99) arrow(x + w / 2 + 6, false);
        if (e > 0.01 && e < 0.99) text(hit, x + w / 2, y - 4, fx(e, 2), { "text-anchor": "middle", class: "fill-foreground font-mono text-[9px]" });
        if (e > 1.01 && e < 1.99) text(hit, x + w + 10, y + 3, fx(e, 2), { class: "fill-foreground font-mono text-[9px]" });
      });
    }
  }

  function draw() {
    drawMolecule(); drawLevels();
    const { levels, occ, Epi, deloc, homo, lumo, ne, mol } = res, n = levels.length;
    const l = levels[sel], lx = Math.abs(l.x) < 1e-9 ? 0 : l.x;
    o.orb.textContent = `ψ${sel + 1}: E = α ${lx >= 0 ? "+" : "−"} ${fx(Math.abs(lx), 3)}β, ${lx > 1e-6 ? "bonding" : lx < -1e-6 ? "antibonding" : "nonbonding"}, ${fx(occ[sel], 2)} electrons`;
    o.ne.textContent = String(ne);
    o.epi.textContent = `${ne}α + ${fx(Epi, 3)}β`;
    o.deloc.textContent = `${fx(deloc, 3)}β  (${fx(deloc * 75, 0)} kJ/mol at β ≈ −75)`;
    o.gap.textContent = homo >= 0 && lumo >= 0 && lumo < n ? `${fx(Math.max(0, levels[homo].x - levels[lumo].x), 3)}|β|${homo === lumo ? " (half-filled shell)" : ""}` : "—";
    const deg = homo >= 0 && occ[homo] > 0 && occ[homo] < 2;
    o.rule.textContent = !mol.cyclic ? "open chain: no ring current" : mol.fused ? `${ne} π electrons, fused rings (4n+2 strictly applies to one ring)` : ne % 4 === 2 ? `${ne} = 4n + 2: aromatic` : ne % 4 === 0 ? `${ne} = 4n: antiaromatic` : `${ne} π electrons: open shell`;
    o.note.textContent = key === "cyclobutadiene" && ne === 4
      ? "Four electrons, and the two middle orbitals sit exactly at α: Hund's rule puts one electron in each, a diradical with no delocalisation energy at all. Real cyclobutadiene escapes by distorting into a rectangle."
      : key === "benzene" && ne === 6
        ? "Three bonding orbitals hold six electrons for E_π = 6α + 8β, against 6α + 6β for three separate double bonds: the 2β difference is the delocalisation energy, and every C–C bond order is 2/3."
        : deg
          ? "A degenerate shell is partly filled, so the electrons are shared equally between its orbitals: an open-shell system."
          : "β is negative, so levels with positive x lie below α and bond. The numbers on the bonds are π bond orders, Σ nₖ cᵢ cⱼ over the filled orbitals.";
  }

  lsvg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-level]");
    if (!g) return;
    sel = Number(g.dataset.level);
    draw();
  });
  lsvg.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    // Up the diagram is up in energy: towards higher index.
    sel = Math.max(0, Math.min(res.levels.length - 1, sel + (e.key === "ArrowUp" ? 1 : -1)));
    draw();
  });
  solve();
  sel = res.homo;
  draw();
}

// ============================================================ 8 Normal modes

for (const root of document.querySelectorAll("[data-cc-modes]")) {
  const msvg = plot(root, "mol"), ssvg = plot(root, "spec"), o = outs(root);
  let key = "co2", mode = 0, res, raf = 0, visible = false, t0 = performance.now();
  const s = scrubAll(root, (name) => { if (name !== "amp") solve(); drawSpec(); drawMol(); });
  onSeg(root, (label, v) => {
    if (label === "Molecule") {
      key = v;
      const m = MOLECULES[key];
      s.k.set(m.k, false); s.kth.set(m.kth, false);
      solve();
    } else mode = Number(v);
    drawSpec(); drawMol();
  });

  const name = (q) => {
    // Classify by how the mode changes the internal coordinates.
    const m = MOLECULES[key], X0 = res.X0, d = q.d;
    const len = (a) => Math.hypot(X0[2 * a] - X0[2], X0[2 * a + 1] - X0[3]);
    const dr = (a) => ((X0[2 * a] - X0[2]) * (d[2 * a] - d[2]) + (X0[2 * a + 1] - X0[3]) * (d[2 * a + 1] - d[3])) / len(a);
    const ra = dr(0), rb = dr(2);
    const ax = X0[0] - X0[2], ay = X0[1] - X0[3], bx = X0[4] - X0[2], by = X0[5] - X0[3];
    const perp = (vx, vy, px, py) => (vx * -py + vy * px) / Math.hypot(px, py);
    const bend = Math.abs(perp(d[0] - d[2], d[1] - d[3], ax, ay) - perp(d[4] - d[2], d[5] - d[3], bx, by));
    if (bend > 1.5 * Math.max(Math.abs(ra), Math.abs(rb))) return "bend";
    return ra * rb > 0 ? "symmetric stretch" : "antisymmetric stretch";
  };

  function solve() {
    res = normalModes(MOLECULES[key], s.k.get(), s.kth.get());
    mode = Math.min(mode, res.modes.length - 1);
  }

  const RAD = { O: 15, C: 12, H: 8 };
  function drawMol() {
    const m = MOLECULES[key], X0 = res.X0, q = res.modes[mode];
    const sc = 95, cx = 160, cy = key === "co2" ? 120 : 95;
    const tphase = reduced() ? 0.6 : Math.sin(((performance.now() - t0) / 1000) * 2 * Math.PI * 0.8);
    const A = 0.22 * s.amp.get() * tphase;
    msvg.replaceChildren();
    const P = [0, 1, 2].map((a) => [cx + (X0[2 * a] + A * q.d[2 * a]) * sc, cy - (X0[2 * a + 1] + A * q.d[2 * a + 1]) * sc]);
    for (const a of [0, 2]) el("line", { x1: P[1][0], y1: P[1][1], x2: P[a][0], y2: P[a][1], style: "stroke:currentColor;stroke-opacity:0.6;stroke-width:3;stroke-linecap:round" }, msvg);
    // Displacement arrows from the rest positions (static).
    for (let a = 0; a < 3; a++) {
      const x = cx + X0[2 * a] * sc, y = cy - X0[2 * a + 1] * sc, dx = q.d[2 * a] * 70 * s.amp.get(), dy = -q.d[2 * a + 1] * 70 * s.amp.get();
      if (Math.hypot(dx, dy) < 2) continue;
      el("line", { x1: x, y1: y, x2: x + dx, y2: y + dy, style: `stroke:${C.brand};stroke-width:1.75;stroke-opacity:0.8` }, msvg);
      const ang = Math.atan2(dy, dx);
      el("path", { d: `M${x + dx} ${y + dy}l${-7 * Math.cos(ang - 0.4)} ${-7 * Math.sin(ang - 0.4)}M${x + dx} ${y + dy}l${-7 * Math.cos(ang + 0.4)} ${-7 * Math.sin(ang + 0.4)}`, style: `stroke:${C.brand};stroke-width:1.75;fill:none;stroke-linecap:round` }, msvg);
    }
    m.atoms.forEach((at, a) => {
      el("circle", { cx: P[a][0], cy: P[a][1], r: RAD[at], style: `fill:var(--background);stroke:${at === "O" ? C.j : at === "C" ? C.fg : C.u};stroke-width:2` }, msvg);
      text(msvg, P[a][0], P[a][1] + 4, at, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    });
    text(msvg, 8, 230, `${name(q)}, ${fx(q.nu, 0)} cm⁻¹`, { class: "fill-muted-foreground font-mono text-[11px]" });
  }

  function drawSpec() {
    const m = MOLECULES[key];
    ssvg.replaceChildren();
    const f = frame(ssvg, { box: [36, 24, 306, 180], x: [4200, 300], y: [0, 1.15], xticks: [4000, 3000, 2000, 1000], yticks: [0, 0.5, 1], xfmt: String, yfmt: tickFmt, xlabel: "wavenumber / cm⁻¹", ylabel: "IR intensity (relative)" });
    for (const obs of m.observed) {
      el("path", { d: `M${f.sx(obs)} ${f.T + f.H}v6`, style: "stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5" }, ssvg);
    }
    text(ssvg, f.L + f.W, f.T - 8, "ticks below the axis: observed", { "text-anchor": "end" });
    res.modes.forEach((q, k) => {
      const x = f.sx(q.nu), on = k === mode, inactive = q.irRel < 1e-6;
      const g = el("g", { "data-mode": String(k), style: "cursor:pointer" }, ssvg);
      el("rect", { x: x - 10, y: f.T, width: 20, height: f.H, style: "fill:transparent" }, g);
      el("line", { x1: x, x2: x, y1: f.sy(0), y2: f.sy(inactive ? 0.18 : q.irRel), style: `stroke:${on ? C.brand : C.u};stroke-width:${on ? 4 : 3};${inactive ? "stroke-dasharray:2 3;" : ""}stroke-linecap:round` }, g);
      text(g, x, f.sy(inactive ? 0.18 : q.irRel) - 6, inactive ? "inactive" : fx(q.nu, 0), { "text-anchor": "middle", class: `font-mono text-[10px] ${on ? "fill-foreground" : "fill-muted-foreground"}` });
    });
    const q = res.modes[mode];
    o.name.textContent = `${mode + 1} of 3: ${name(q)}`;
    o.nu.textContent = `${fx(q.nu, 0)} cm⁻¹`;
    const obs = [...m.observed].sort((a, b) => a - b)[mode];
    o.obs.textContent = `${obs} cm⁻¹ (gas phase)`;
    o.ir.textContent = q.irRel < 1e-6 ? "inactive: the dipole does not change" : `active, ${fx(100 * q.irRel, 0)} % of the strongest`;
    o.note.textContent = key === "co2"
      ? "CO₂ is linear, so in the plane it has one bend; the second, identical bend moves out of the plane and is not drawn. The symmetric stretch keeps the molecule's centre of charge fixed, so infrared light cannot drive it (it shows in Raman spectra instead). Observed values include anharmonicity and, for the 1333 band, Fermi resonance."
      : "In water all three modes change the dipole, so all three absorb. This force field has no coupling between the two bonds, so the symmetric and antisymmetric stretches come out closer together than the observed 3657 and 3756 cm⁻¹.";
  }

  ssvg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-mode]");
    if (!g) return;
    mode = Number(g.dataset.mode);
    selectSeg(root, "Mode", String(mode));
    drawSpec(); drawMol();
  });
  const tick = () => { raf = 0; if (!visible || reduced()) return; drawMol(); raf = requestAnimationFrame(tick); };
  onScreen(root, (v) => { visible = v; if (v && !raf) raf = requestAnimationFrame(tick); });
  solve(); drawSpec(); drawMol();
}

// ============================================================ 9 Gaussian basis

for (const root of document.querySelectorAll("[data-cc-basis]")) {
  const psvg = plot(root, "psi"), csvg = plot(root, "conv"), o = outs(root);
  let which = "1", cache = null;
  onSeg(root, (_, v) => { which = v; draw(); });
  onToggle(root, () => requestAnimationFrame(draw));

  // Optimising six bases takes a moment; do it once, when first needed.
  const fits = () => {
    if (!cache) {
      cache = {};
      for (let n = 1; n <= 6; n++) cache[n] = optimiseGaussians(n);
      cache.sto3g = { alphas: STO3G, ...gaussEnergy(STO3G) };
    }
    return cache;
  };

  function draw() {
    const F = fits(), b = F[which], r2 = toggled(root, "r2");
    psvg.replaceChildren();
    const fy = (r, v) => (r2 ? 4 * Math.PI * r * r * v * v : v);
    const ymax = r2 ? 0.62 : 0.6;
    const f = frame(psvg, { box: [48, 18, 296, 210], x: [0, 4], y: [0, ymax], xticks: [0, 1, 2, 3, 4], yticks: ticks(0, ymax, 4), xfmt: String, yfmt: tickFmt, xlabel: "r / bohr", ylabel: r2 ? "radial density 4πr²ψ²" : "ψ(r)" });
    const g = clipped(psvg, f), rs = Array.from({ length: 241 }, (_, k) => (4 * k) / 240);
    if (!r2) b.alphas.forEach((a, i) => path(g, rs.map((r) => [f.sx(r), f.sy(b.c[i] * Math.exp(-a * r * r))]), `stroke:${C.j};stroke-width:1;stroke-dasharray:3 3;stroke-opacity:0.8`));
    polyline(g, rs.map((r) => [f.sx(r), f.sy(fy(r, Math.exp(-r) / Math.sqrt(Math.PI)))]), `stroke:${C.u};stroke-width:2`);
    polyline(g, rs.map((r) => [f.sx(r), f.sy(fy(r, gaussPsi(b.alphas, b.c, r)))]), `stroke:${C.brand};stroke-width:2`);
    // Convergence: error above the exact −1/2 hartree, log scale.
    csvg.replaceChildren();
    const cf = frame(csvg, { box: [52, 18, 290, 210], x: [0.6, 6.4], y: [-5, -0.5], xticks: [1, 2, 3, 4, 5, 6], yticks: [-5, -4, -3, -2, -1], xfmt: String, yfmt: (k) => `10${String(k).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`, xlabel: "Gaussians n", ylabel: "E − E_exact / hartree" });
    const cg = clipped(csvg, cf), lg = (v) => Math.log10(v);
    const chem = 1.5936e-3; // 1 kcal/mol
    el("line", { x1: cf.L, x2: cf.L + cf.W, y1: cf.sy(lg(chem)), y2: cf.sy(lg(chem)), style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:4 4" }, cg);
    text(cg, cf.L + cf.W - 4, cf.sy(lg(chem)) - 4, "1 kcal/mol", { "text-anchor": "end" });
    const pts = [1, 2, 3, 4, 5, 6].map((n) => [cf.sx(n), cf.sy(lg(F[n].E + 0.5))]);
    polyline(cg, pts, `stroke:${C.brand};stroke-width:1.75`);
    pts.forEach((p, k) => el("circle", { cx: p[0], cy: p[1], r: String(k + 1) === which ? 5.5 : 3.5, style: `fill:${String(k + 1) === which ? "var(--background)" : C.brand};stroke:${C.brand};stroke-width:2` }, cg));
    const sp = [cf.sx(3), cf.sy(lg(F.sto3g.E + 0.5))];
    el("rect", { x: sp[0] - 4, y: sp[1] - 4, width: 8, height: 8, style: `fill:${which === "sto3g" ? "var(--background)" : C.u};stroke:${C.u};stroke-width:2` }, cg);
    text(cg, sp[0] + 8, sp[1] + 4, "STO-3G", { style: `fill:${C.u}` });
    const err = b.E + 0.5;
    o.E.textContent = `${fx(b.E, 6)} hartree (${fx(b.E * 27.211386, 4)} eV)`;
    o.err.textContent = `${fx(err * 1000, 3)} mhartree, ${fx(err * 627.5095, 2)} kcal/mol`;
    o.alpha.textContent = b.alphas.map((a) => a.toPrecision(4)).join(", ");
    o.coef.textContent = b.c.map((c) => fx(c, 4)).join(", ");
    o.note.textContent = which === "sto3g"
      ? `STO-3G keeps the exponents Hehre, Stewart and Pople fitted to a Slater 1s (ζ = 1) and lets the variational method choose the coefficients here: ${fx(b.E, 5)} hartree, above the ${fx(F[3].E, 5)} of three fully optimised Gaussians, because its exponents were fitted to the orbital's shape, not to the energy.`
      : `Each extra Gaussian cuts the error by roughly a factor of four or five. Even six miss the cusp: the true orbital has a kink at the nucleus (slope −ψ there), and every Gaussian is flat at r = 0. The error stays above zero, as the variational principle guarantees.`;
  }
  draw();
}
