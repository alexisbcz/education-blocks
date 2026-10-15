// Topology blocks drawn from 3D on a canvas: the Euler characteristic of
// meshes, the Möbius strip and its cuts, and the hairy ball theorem.
// Counts, linking numbers and indices are computed from the geometry.

import { scrubAll } from "./scrub.js";
import {
  reduced, outs, onToggle, isOn, num, signed, palette, rgba, fitCanvas, orbit,
  dot3, cross3, sub3, add3, scale3, norm3, unit3,
} from "./topology-util.js";

const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

// ============================================================ Euler characteristic

function meshOf(kind, n) {
  const pos = [], faces = [];
  if (kind === "sphere") {
    // A cube cut into n × n squares per face, puffed towards a sphere.
    const ids = new Map();
    const id = (x, y, z) => {
      const k = `${x},${y},${z}`;
      if (!ids.has(k)) {
        ids.set(k, pos.length);
        const c = [x / n - 0.5, y / n - 0.5, z / n - 0.5];
        const s = unit3(c);
        const t = n === 1 ? 0 : 1;
        pos.push(add3(scale3(c, (1 - t) * 1.25), scale3(s, t * 0.95)));
      }
      return ids.get(k);
    };
    for (let axis = 0; axis < 3; axis++) {
      for (const side of [0, n]) {
        for (let a = 0; a < n; a++) {
          for (let b = 0; b < n; b++) {
            const P = (u, v) => { const p = [0, 0, 0]; p[axis] = side; p[(axis + 1) % 3] = u; p[(axis + 2) % 3] = v; return id(...p); };
            faces.push([P(a, b), P(a + 1, b), P(a + 1, b + 1), P(a, b + 1)]);
          }
        }
      }
    }
  } else if (kind === "torus") {
    const U = 4 * n + 4, W = 2 * n + 2;
    for (let i = 0; i < U; i++) for (let j = 0; j < W; j++) {
      const u = (2 * Math.PI * i) / U, v = (2 * Math.PI * j) / W;
      pos.push([(0.72 + 0.32 * Math.cos(v)) * Math.cos(u), (0.72 + 0.32 * Math.cos(v)) * Math.sin(u), 0.32 * Math.sin(v)]);
    }
    const id = (i, j) => (i % U) * W + (j % W);
    for (let i = 0; i < U; i++) for (let j = 0; j < W; j++) faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
  } else if (kind === "tube") {
    const U = 4 * n + 4, H = n + 1;
    for (let i = 0; i < U; i++) for (let j = 0; j <= H; j++) {
      const u = (2 * Math.PI * i) / U;
      pos.push([0.6 * Math.cos(u), 0.6 * Math.sin(u), -0.75 + (1.5 * j) / H]);
    }
    const id = (i, j) => (i % U) * (H + 1) + j;
    for (let i = 0; i < U; i++) for (let j = 0; j < H; j++) faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
  } else {
    // Möbius band: the last column is glued to the first upside down.
    const U = 4 * n + 8, W = n + 1;
    for (let i = 0; i < U; i++) for (let j = 0; j <= W; j++) {
      const u = (2 * Math.PI * i) / U, v = -1 + (2 * j) / W, r = 0.78 + 0.34 * v * Math.cos(u / 2);
      pos.push([r * Math.cos(u), r * Math.sin(u), 0.34 * v * Math.sin(u / 2)]);
    }
    const id = (i, j) => (i === U ? id(0, W - j) : i * (W + 1) + j);
    for (let i = 0; i < U; i++) for (let j = 0; j < W; j++) faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
  }
  return { pos, faces };
}

/** Counts, boundary loops and orientability of a face list. */
function census(faces) {
  const verts = new Set(faces.flat());
  const edges = new Map();
  faces.forEach((f, fi) => f.forEach((a, k) => {
    const b = f[(k + 1) % f.length], key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([fi, a < b ? 1 : -1]);
  }));
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const bnd = [...edges].filter(([, l]) => l.length === 1).map(([k]) => k.split("-").map(Number));
  for (const [a, b] of bnd) { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); }
  for (const [a, b] of bnd) parent.set(find(a), find(b));
  const loops = new Set([...parent.keys()].map(find)).size;
  // Try to orient every face consistently: neighbours must cross a shared
  // edge in opposite directions.
  const adj = faces.map(() => []);
  for (const l of edges.values()) if (l.length === 2) { const [[f, d], [g, e]] = l; adj[f].push([g, d * e]); adj[g].push([f, d * e]); }
  const s = Array(faces.length).fill(0);
  let orientable = true;
  for (let start = 0; start < faces.length && orientable; start++) {
    if (s[start]) continue;
    s[start] = 1;
    const q = [start];
    while (q.length && orientable) {
      const f = q.pop();
      for (const [g, de] of adj[f]) {
        const want = -s[f] * de;
        if (!s[g]) { s[g] = want; q.push(g); } else if (s[g] !== want) { orientable = false; break; }
      }
    }
  }
  return { V: verts.size, E: edges.size, F: faces.length, b: loops, orientable, bnd };
}

function surfaceName(chi, b, orientable) {
  const holes = b ? ` with ${b} hole${b > 1 ? "s" : ""}` : "";
  if (orientable) {
    const g = (2 - chi - b) / 2;
    if (g === 0) return b === 0 ? "sphere" : b === 1 ? "disc" : b === 2 ? "annulus (a tube)" : "sphere" + holes;
    return (g === 1 ? "torus" : `surface of genus ${g}`) + holes;
  }
  const k = 2 - chi - b;
  if (k === 1 && b === 1) return "Möbius band";
  return (k === 1 ? "projective plane" : k === 2 ? "Klein bottle" : `${k} cross-caps`) + holes;
}

for (const root of document.querySelectorAll("[data-topo-euler]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let kind = "sphere", removed = [], mesh, info;
  const sc = scrubAll(root, () => { removed = []; rebuild(); });
  function rebuild() {
    mesh = meshOf(kind, Math.round(sc.n.get()));
    let faces = mesh.faces.filter((_, i) => !removed.includes(i));
    if (isOn(root, "tri")) faces = faces.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]);
    mesh.shown = faces;
    info = census(faces);
    const chi = info.V - info.E + info.F;
    o.vef.textContent = `${info.V} − ${info.E} + ${info.F}`;
    o.chi.textContent = String(chi).replace("-", "−");
    o.b.textContent = String(info.b);
    o.orient.textContent = info.orientable ? "yes" : "no";
    o.name.textContent = surfaceName(chi, info.b, info.orientable);
    cam.redraw();
  }
  function punch() {
    // A face that touches neither an earlier hole nor the boundary, so each
    // hole is a clean new boundary loop.
    const full = census(mesh.faces.filter((_, i) => !removed.includes(i)));
    const busy = new Set(full.bnd.flat());
    const order = mesh.faces.map((_, i) => (i * 7919 + 13) % mesh.faces.length);
    const pick = order.find((i) => !removed.includes(i) && mesh.faces[i].every((v) => !busy.has(v)));
    if (pick === undefined) return false;
    removed.push(pick);
    rebuild();
    return true;
  }
  const cam = orbit(canvas, (c) => {
    const { ctx, w, h } = fitCanvas(canvas);
    const col = palette();
    ctx.clearRect(0, 0, w, h);
    const eye = c.eye(), light = unit3(add3(eye, [0.3, -0.2, 0.6]));
    const P = mesh.pos.map((p) => c.view(p));
    const bset = new Set(info.bnd.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
    const order = mesh.shown.map((f, i) => [f.reduce((s, v) => s + P[v][2], 0) / f.length, i]).sort((a, b) => a[0] - b[0]);
    ctx.lineJoin = "round";
    for (const [, i] of order) {
      const f = mesh.shown[i];
      const nrm = unit3(cross3(sub3(mesh.pos[f[1]], mesh.pos[f[0]]), sub3(mesh.pos[f[2]], mesh.pos[f[0]])));
      const lit = Math.abs(dot3(nrm, light));
      ctx.beginPath();
      f.forEach((v, k) => (k ? ctx.lineTo(P[v][0], P[v][1]) : ctx.moveTo(P[v][0], P[v][1])));
      ctx.closePath();
      ctx.fillStyle = rgba(mix(col.bg, col.fg, 0.04 + 0.16 * lit));
      ctx.fill();
      ctx.strokeStyle = rgba(col.fg, 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
      f.forEach((a, k) => {
        const b = f[(k + 1) % f.length];
        if (!bset.has(a < b ? `${a}-${b}` : `${b}-${a}`)) return;
        ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]);
        ctx.strokeStyle = rgba(col.brand); ctx.lineWidth = 2.25; ctx.stroke();
      });
    }
  }, { zoom: 0.38 });
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; removed = []; rebuild(); });
  onToggle(root, rebuild);
  root.querySelector("[data-action=hole]").addEventListener("click", (e) => {
    if (!punch()) e.currentTarget.setAttribute("aria-label", "No room for another hole");
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { removed = []; rebuild(); });
  rebuild();
}

// ============================================================ Möbius strip

/** Gauss's linking integral between two closed polygons. */
function linking(A, B) {
  let s = 0;
  for (let i = 0; i < A.length; i++) {
    const a0 = A[i], a1 = A[(i + 1) % A.length], am = scale3(add3(a0, a1), 0.5), da = sub3(a1, a0);
    for (let j = 0; j < B.length; j++) {
      const b0 = B[j], b1 = B[(j + 1) % B.length], bm = scale3(add3(b0, b1), 0.5), db = sub3(b1, b0);
      const r = sub3(am, bm), d = norm3(r);
      s += dot3(r, cross3(da, db)) / (d * d * d);
    }
  }
  return s / (4 * Math.PI);
}

for (const root of document.querySelectorAll("[data-topo-mobius]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let t = 1, cut = "none", ant = 0, antRaf = 0, pieces = [];
  const R = 0.82, Wd = 0.3;
  const X = (u, v) => {
    const r = R + Wd * v * Math.cos((t * u) / 2);
    return [r * Math.cos(u), r * Math.sin(u), Wd * v * Math.sin((t * u) / 2)];
  };
  const normal = (u, v) => {
    const e = 1e-4;
    return unit3(cross3(sub3(X(u + e, v), X(u - e, v)), sub3(X(u, v + e), X(u, v - e))));
  };
  function analyse() {
    const levels = { none: [], half: [0], third: [-1 / 3, 1 / 3] }[cut];
    const bounds = [-1, ...levels, 1];
    const regions = bounds.slice(0, -1).map((a, i) => [a, bounds[i + 1]]);
    const flip = (i) => (t % 2 ? regions.length - 1 - i : i);
    const seen = new Set();
    pieces = [];
    regions.forEach((_, i) => {
      if (seen.has(i)) return;
      const orbit = [];
      for (let j = i; !seen.has(j); j = flip(j)) { seen.add(j); orbit.push(j); }
      const [a, b] = regions[i], loops = orbit.length, mid = (a + b) / 2;
      const curve = (v) => Array.from({ length: 240 * loops }, (_, k) => X((2 * Math.PI * k) / 240, v));
      const oneSided = loops === 1 && t % 2 === 1;
      pieces.push({ regions: orbit.map((j) => regions[j]), loops, oneSided, centre: curve(mid), edges: oneSided ? null : Math.round(Math.abs(linking(curve(a), curve(b)))) });
    });
    const sides = t % 2 ? 1 : 2, edges = t % 2 ? 1 : 2;
    o.sides.textContent = String(sides);
    o.edges.textContent = edges === 1 ? "1 (a single closed curve)" : "2";
    o.pieces.textContent = String(pieces.length);
    o.each.textContent = pieces.map((p) => `${p.loops === 1 ? "1 lap" : p.loops + " laps"}, ${p.oneSided ? "one-sided" : `two-sided, edges linked ${p.edges}×`}`).join(" · ");
    o.link.textContent = pieces.length < 2 ? "—" : `linking number ${Math.round(Math.abs(linking(pieces[0].centre, pieces[1].centre)))}`;
  }
  const antText = () => {
    if (ant === 0) return "waiting";
    const lap = ant / (2 * Math.PI);
    if (t % 2) return lap < 1 ? "first lap" : lap < 2 ? "above its start, on the opposite face" : "home, after two laps";
    return lap < 1 ? "first lap" : "home after one lap, never on the other face";
  };

  const cam = orbit(canvas, (c) => {
    const { ctx, w, h } = fitCanvas(canvas);
    const col = palette();
    ctx.clearRect(0, 0, w, h);
    const eye = c.eye(), light = unit3(add3(eye, [0.3, -0.2, 0.7]));
    const prims = [];
    const tints = pieces.length > 1 ? [col.u, col.v] : [cut === "none" ? col.fg : col.u];
    const Nu = 140;
    pieces.forEach((pc, pi) => {
      const tint = tints[pi % tints.length];
      // Draw each region over one lap; together they are the whole piece.
      for (const [a0, b0] of pc.regions) {
        const gap = 0.05, a = a0 === -1 ? a0 : a0 + gap, b = b0 === 1 ? b0 : b0 - gap;
        const Nv = Math.max(1, Math.round((b - a) * 4));
        for (let i = 0; i < Nu; i++) {
          for (let j = 0; j < Nv; j++) {
            const u0 = (2 * Math.PI * i) / Nu, u1 = (2 * Math.PI * (i + 1)) / Nu;
            const v0 = a + ((b - a) * j) / Nv, v1 = a + ((b - a) * (j + 1)) / Nv;
            const q = [X(u0, v0), X(u1, v0), X(u1, v1), X(u0, v1)];
            const lit = Math.abs(dot3(normal((u0 + u1) / 2, (v0 + v1) / 2), light));
            const P = q.map((p) => c.view(p));
            prims.push({ z: (P[0][2] + P[1][2] + P[2][2] + P[3][2]) / 4, P, fill: rgba(mix(col.bg, tint, (cut === "none" ? 0.05 : 0.2) + (cut === "none" ? 0.22 : 0.4) * lit)), edge: [j === 0 && a0 === a, j === Nv - 1 && b0 === b] });
          }
        }
      }
    });
    // The ant's painted trail, a hair above the face it walks on.
    const trail = [];
    for (let s = 0; s <= ant; s += 0.04) trail.push(add3(X(s, 0), scale3(normal(s, 0), 0.025)));
    trail.push(add3(X(ant, 0), scale3(normal(ant, 0), 0.025)));
    for (let i = 1; i < trail.length; i++) {
      const A = c.view(trail[i - 1]), B = c.view(trail[i]);
      prims.push({ z: (A[2] + B[2]) / 2 + 0.01, seg: [A, B] });
    }
    prims.sort((p, q) => p.z - q.z);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const p of prims) {
      if (p.seg) {
        ctx.beginPath(); ctx.moveTo(...p.seg[0].slice(0, 2)); ctx.lineTo(...p.seg[1].slice(0, 2));
        ctx.strokeStyle = rgba(col.brand); ctx.lineWidth = 3; ctx.stroke();
        continue;
      }
      ctx.beginPath();
      p.P.forEach((v, k) => (k ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])));
      ctx.closePath();
      ctx.fillStyle = p.fill;
      ctx.fill();
      ctx.strokeStyle = p.fill;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.strokeStyle = rgba(col.fg, 0.8);
      ctx.lineWidth = 1.25;
      if (p.edge[0]) { ctx.beginPath(); ctx.moveTo(p.P[0][0], p.P[0][1]); ctx.lineTo(p.P[1][0], p.P[1][1]); ctx.stroke(); }
      if (p.edge[1]) { ctx.beginPath(); ctx.moveTo(p.P[3][0], p.P[3][1]); ctx.lineTo(p.P[2][0], p.P[2][1]); ctx.stroke(); }
    }
    if (ant > 0) {
      const A = c.view(add3(X(ant, 0), scale3(normal(ant, 0), 0.03)));
      ctx.beginPath(); ctx.arc(A[0], A[1], 5, 0, 2 * Math.PI);
      ctx.fillStyle = rgba(col.brand); ctx.fill();
      ctx.strokeStyle = rgba(col.bg); ctx.lineWidth = 2; ctx.stroke();
    }
    o.ant.textContent = antText();
  }, { zoom: 0.4, pitch: 0.75 });

  const run = () => {
    cancelAnimationFrame(antRaf);
    const end = t % 2 ? 4 * Math.PI : 2 * Math.PI;
    if (reduced()) { ant = end; cam.redraw(); return; }
    ant = 0.001;
    let last = 0;
    const step = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      ant = Math.min(end, ant + dt * 1.6);
      cam.redraw();
      if (ant < end) antRaf = requestAnimationFrame(step);
    };
    antRaf = requestAnimationFrame(step);
  };
  root.addEventListener("seg-change", (e) => {
    if (e.target.closest("[data-cuts]")) cut = e.detail.value;
    else t = Number(e.detail.value);
    cancelAnimationFrame(antRaf);
    ant = 0;
    analyse();
    cam.redraw();
  });
  root.querySelector("[data-action=ant]").addEventListener("click", run);
  root.querySelector("[data-action=reset]").addEventListener("click", () => { cancelAnimationFrame(antRaf); ant = 0; cam.redraw(); });
  analyse();
  cam.redraw();
}

// ============================================================ hairy ball

for (const root of document.querySelectorAll("[data-topo-hairy]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let mode = "mix";
  const s = scrubAll(root, () => { solve(); cam.redraw(); });
  const field = (p) => {
    if (mode === "one") {
      // The constant field ∂/∂u on the plane, carried to the sphere by
      // inverse stereographic projection from the north pole.
      const den = 1 - p[2];
      if (den < 1e-9) return [0, 0, 0];
      const u = p[0] / den, v = p[1] / den, r2 = u * u + v * v, q = (1 + r2) ** 2;
      return [(2 * (1 + r2) - 4 * u * u) / q, (-4 * u * v) / q, (4 * u) / q];
    }
    const ph = (s.phi.get() * Math.PI) / 180, ti = (s.tilt.get() * Math.PI) / 180;
    const w = [Math.sin(ti), 0, Math.cos(ti)];
    return add3(scale3(cross3(w, p), Math.cos(ph)), scale3(sub3(w, scale3(p, dot3(w, p))), Math.sin(ph)));
  };
  // A cube-sphere grid, turned by a fixed odd rotation so that zeros at
  // special places do not sit on cell edges.
  const rot = (() => {
    const a = 0.37, b = 0.61, c = 0.23;
    const Rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
    const Ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
    const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
    const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const M = mul(Rz, mul(Ry, Rx));
    return (p) => M.map((r) => dot3(r, p));
  })();
  const G = 15;
  const facePt = (f, a, b) => {
    const axis = f >> 1, sgn = f & 1 ? -1 : 1, p = [0, 0, 0];
    p[axis] = sgn; p[(axis + 1) % 3] = a; p[(axis + 2) % 3] = b;
    return unit3(rot(p));
  };
  let zeros = [];
  function solve() {
    zeros = [];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
        const a0 = -1 + (2 * i) / G, a1 = a0 + 2 / G, b0 = -1 + (2 * j) / G, b1 = b0 + 2 / G;
        const c = facePt(f, (a0 + a1) / 2, (b0 + b1) / 2);
        const e1 = unit3(cross3(Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], c)), e2 = cross3(c, e1);
        const loop = [];
        const n = 12;
        for (let k = 0; k < n; k++) loop.push([a0 + ((a1 - a0) * k) / n, b0]);
        for (let k = 0; k < n; k++) loop.push([a1, b0 + ((b1 - b0) * k) / n]);
        for (let k = 0; k < n; k++) loop.push([a1 - ((a1 - a0) * k) / n, b1]);
        for (let k = 0; k < n; k++) loop.push([a0, b1 - ((b1 - b0) * k) / n]);
        let wsum = 0, prev = null;
        for (let k = 0; k <= loop.length; k++) {
          const F = field(facePt(f, ...loop[k % loop.length]));
          const ang = Math.atan2(dot3(F, e2), dot3(F, e1));
          if (prev !== null) {
            let d = ang - prev;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            wsum += d;
          }
          prev = ang;
        }
        // The loop runs counter-clockwise seen from outside only on half the
        // faces; the orientation of (e1, e2) fixes the sign per cell.
        const da = sub3(facePt(f, a1, b0), facePt(f, a0, b0)), db = sub3(facePt(f, a0, b1), facePt(f, a0, b0));
        const orient = Math.sign(dot3(cross3(da, db), c));
        const idx = Math.round((wsum / (2 * Math.PI)) * orient);
        if (!idx) continue;
        // Locate the zero inside the cell.
        let best = c, bm = Infinity;
        for (let u = 0; u <= 10; u++) for (let v = 0; v <= 10; v++) {
          const p = facePt(f, a0 + ((a1 - a0) * u) / 10, b0 + ((b1 - b0) * v) / 10), m = norm3(field(p));
          if (m < bm) { bm = m; best = p; }
        }
        zeros.push({ p: best, idx });
      }
    }
    const sum = zeros.reduce((t, z) => t + z.idx, 0);
    o.zeros.textContent = String(zeros.length);
    o.idx.textContent = zeros.map((z) => signed(z.idx)).join(", ") || "—";
    o.sum.textContent = signed(sum);
    o.chi.textContent = "2";
  }
  const fib = Array.from({ length: 520 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 520, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    return [r * Math.cos(a), r * Math.sin(a), y];
  });
  const cam = orbit(canvas, (c) => {
    const { ctx, w, h } = fitCanvas(canvas);
    const col = palette();
    ctx.clearRect(0, 0, w, h);
    const eye = c.eye();
    const C = c.view([0, 0, 0]), rad = Math.min(w, h) * c.zoom;
    const g = ctx.createRadialGradient(C[0] - rad * 0.3, C[1] - rad * 0.35, rad * 0.1, C[0], C[1], rad);
    g.addColorStop(0, rgba(mix(col.bg, col.fg, 0.1)));
    g.addColorStop(1, rgba(mix(col.bg, col.fg, 0.03)));
    ctx.beginPath(); ctx.arc(C[0], C[1], rad, 0, 2 * Math.PI);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(col.fg, 0.35); ctx.lineWidth = 1; ctx.stroke();
    // Front halves of the parallels and meridians.
    ctx.lineWidth = 0.75;
    const curve = (fn) => {
      ctx.beginPath();
      let on = false;
      for (let k = 0; k <= 96; k++) {
        const p = fn((2 * Math.PI * k) / 96);
        if (dot3(p, eye) < 0) { on = false; continue; }
        const v = c.view(p);
        on ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]);
        on = true;
      }
      ctx.strokeStyle = rgba(col.fg, 0.12); ctx.stroke();
    };
    for (let la = -60; la <= 60; la += 30) { const z = Math.sin((la * Math.PI) / 180), r = Math.cos((la * Math.PI) / 180); curve((a) => [r * Math.cos(a), r * Math.sin(a), z]); }
    for (let lo = 0; lo < 180; lo += 30) { const b = (lo * Math.PI) / 180; curve((a) => [Math.cos(b) * Math.cos(a), Math.sin(b) * Math.cos(a), Math.sin(a)]); }
    // The field.
    let max = 0;
    const F = fib.map((p) => { const v = field(p); max = Math.max(max, norm3(v)); return v; });
    fib.forEach((p, i) => {
      const depth = dot3(p, eye);
      if (depth < 0.05) return;
      const m = norm3(F[i]);
      const len = 0.11 * Math.tanh((3 * m) / (max || 1));
      if (len < 0.004) return;
      const dir = scale3(F[i], 1 / m);
      const tip = unit3(add3(p, scale3(dir, len)));
      const A = c.view(p), B = c.view(tip);
      const a = rgba(col.fg, 0.25 + 0.6 * depth);
      ctx.strokeStyle = a; ctx.fillStyle = a; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      const ang = Math.atan2(B[1] - A[1], B[0] - A[0]), hl = Math.min(4, Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.45);
      ctx.beginPath();
      ctx.moveTo(B[0], B[1]);
      ctx.lineTo(B[0] - hl * Math.cos(ang - 0.45), B[1] - hl * Math.sin(ang - 0.45));
      ctx.lineTo(B[0] - hl * Math.cos(ang + 0.45), B[1] - hl * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    });
    // Zeros with their indices.
    ctx.font = "600 12px var(--font-mono), ui-monospace, monospace";
    for (const z of zeros) {
      const front = dot3(z.p, eye) >= 0, V = c.view(z.p);
      ctx.beginPath(); ctx.arc(V[0], V[1], 6, 0, 2 * Math.PI);
      ctx.fillStyle = rgba(col.brand, front ? 1 : 0.3); ctx.fill();
      ctx.strokeStyle = rgba(col.bg); ctx.lineWidth = 2; ctx.stroke();
      if (front) { ctx.fillStyle = rgba(col.brand); ctx.fillText(signed(z.idx), V[0] + 10, V[1] - 8); }
    }
  }, { zoom: 0.4, pitch: 0.35 });
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; solve(); cam.redraw(); });
  solve();
  cam.redraw();
}
