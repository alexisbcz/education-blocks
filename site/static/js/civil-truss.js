// The method-of-joints solver shared by the truss block (civil.js) and the
// bridge figure (figures/civil-bridge/build.mjs inlines these functions
// into site/static/anatomy/civil-bridge.js), so both show the same forces.
//
// nodes: [[x, z], ...]; members: [[i, j], ...]; supports: [[node, "pin" |
// "roller"], ...] (a roller resists vertical force only); loads: [[node,
// Fx, Fz], ...]. Every joint gives two equilibrium equations, ΣFx = 0 and
// ΣFz = 0, in the unknown member forces (tension positive) and reactions.

export function solveTruss(nodes, members, supports, loads) {
  const unknowns = members.length + supports.reduce((n, [, kind]) => n + (kind === "pin" ? 2 : 1), 0);
  const equations = 2 * nodes.length;
  if (unknowns !== equations) {
    return { ok: false, reason: unknowns > equations ? "indeterminate" : "mechanism", unknowns, equations };
  }
  const A = Array.from({ length: equations }, () => new Array(unknowns + 1).fill(0));
  members.forEach(([i, j], m) => {
    const dx = nodes[j][0] - nodes[i][0], dz = nodes[j][1] - nodes[i][1];
    const L = Math.hypot(dx, dz) || 1;
    // A tension pulls node i toward j and node j toward i.
    A[2 * i][m] += dx / L; A[2 * i + 1][m] += dz / L;
    A[2 * j][m] -= dx / L; A[2 * j + 1][m] -= dz / L;
  });
  let col = members.length;
  const reactionCols = [];
  for (const [node, kind] of supports) {
    if (kind === "pin") { A[2 * node][col] = 1; reactionCols.push([node, "x", col++]); }
    A[2 * node + 1][col] = 1; reactionCols.push([node, "z", col++]);
  }
  for (const [node, fx, fz] of loads) { A[2 * node][unknowns] -= fx; A[2 * node + 1][unknowns] -= fz; }
  // Gaussian elimination with partial pivoting.
  const n = unknowns;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return { ok: false, reason: "unstable", unknowns, equations };
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || !A[r][c]) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = A.map((row, r) => row[n] / row[r]);
  return {
    ok: true,
    forces: x.slice(0, members.length),
    reactions: reactionCols.map(([node, axis, c]) => ({ node, axis, value: x[c] })),
    unknowns,
    equations,
  };
}

// Vertical deflection (positive down) of `node` by the unit-load method:
// δ = Σ N·n·L / (E·A), with N the forces under the real loads and n those
// under a unit downward load at the node. EA in force units (N), lengths in
// the nodes' units: δ comes out in those units.
export function deflectionAt(nodes, members, supports, loads, node, EA) {
  const real = solveTruss(nodes, members, supports, loads);
  const unit = solveTruss(nodes, members, supports, [[node, 0, -1]]);
  if (!real.ok || !unit.ok) return NaN;
  return members.reduce((sum, [i, j], m) => {
    const L = Math.hypot(nodes[j][0] - nodes[i][0], nodes[j][1] - nodes[i][1]);
    return sum + (real.forces[m] * unit.forces[m] * L) / EA;
  }, 0);
}
