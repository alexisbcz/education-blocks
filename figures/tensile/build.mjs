// Fig · Tensile test — a twin-column universal testing machine pulling a
// round mild-steel specimen to fracture.
// Run from the repo root: node figures/tensile/build.mjs
// Writes site/static/anatomy/{tensile.html, tensile.css, tensile.js} and
// figures/tensile/preview{,-light}.html. The shared site/static/anatomy/iso.css
// is not touched; tensile.css carries the kit CSS scoped under
// [data-anatomy="tensile"], plus the figure's own rules.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- model
// Engineering stress–strain of a hot-rolled mild steel (typical handbook
// values, AISI 1020 class): E = 207 GPa, upper yield 300 MPa dropping to a
// 280 MPa lower yield, a Lüders plateau to 1.8 %, hardening to the UTS of
// 420 MPa at 20 % (necking starts there), fracture at 30 % and 330 MPa.
// The same knots drive block 2 of the materials page (site/static/js/materials.js).
const E_MPA = 207000;
const KNOTS = [[0.00145, 300], [0.0025, 280], [0.018, 282], [0.06, 360], [0.12, 405], [0.2, 420], [0.25, 395], [0.3, 330]];
const EPS_U = 0.2, EPS_F = 0.3;
const A0 = Math.PI * 6.25 * 6.25; // mm², 12.5 mm diameter
// Monotone cubic (Fritsch–Carlson) through the knots after the elastic line.
function monotone(points) {
  const n = points.length, xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const curve = monotone(KNOTS);
const stressOf = (eps) => (eps <= KNOTS[0][0] ? E_MPA * eps : eps > EPS_F ? 0 : curve(eps));

// ---------------------------------------------------------------- layout (world units ≈ 1 mm; x across, y toward the viewer, z up)
const WIDTH = 600, HEIGHT = 560;
const AZ = 58;
const BASE = { x: -100, y: -26, w: 200, d: 52, r: 4 };
const BASE_H = 44, FOOT_H = 6;
const COL_X = [-72, 72], COL_R = 6.5;
const TOP_Z = 336, TOP_H = 20;
const XH = { x: -86, y: -15, w: 172, d: 30, r: 3 }; // moving crosshead plan
const XH_Z = 222, XH_H = 20; // at rest
const NUT_R = 11, NUT_H = 7;
const GRIP = { x: -17, y: -13, w: 34, d: 26, r: 2 };
const LOW_GRIP_Z = 60, GRIP_H = 30;
const SPEC_Z0 = LOW_GRIP_Z + GRIP_H; // where the specimen leaves the lower grip
const SHOULDER = 6, SHOULDER_UP = 16, FILLET = 9, GAUGE = 50, R_GAUGE = 6.25, R_SHOULDER = 9.5;
// Exposed length at rest; more shoulder shows under the upper grip, whose front corner hides its first few mm.
const SPEC_LEN = SHOULDER + SHOULDER_UP + 2 * FILLET + GAUGE;
const UP_GRIP_Z = SPEC_Z0 + SPEC_LEN; // bottom of the upper grip at rest
const CELL_Z = UP_GRIP_Z + GRIP_H, CELL_H = XH_Z - CELL_Z;
const MARK_LO = SPEC_Z0 + SHOULDER + FILLET, MARK_HI = MARK_LO + GAUGE;
const CTRL = { x: 112, y: -12, w: 44, d: 40, r: 3 };
const CTRL_H = 104;
const SCREEN = { x0: 118, x1: 150, z0: 64, z1: 92 }; // on the controller's front face
const ext = (eps) => GAUGE * Math.min(eps, EPS_F); // crosshead travel = gauge extension (rigid frame)

const P = k.fitProjection(
  [...k.boxCorners(BASE, -FOOT_H, 0), ...k.boxCorners(XH, TOP_Z, TOP_Z + TOP_H + 8), ...k.boxCorners(CTRL, 0, CTRL_H)],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: AZ },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const view = k.towardViewer(P);
const FRONT = view[1] > 0 ? 1 : -1; // the y side the viewer sees
const f2 = (v) => v.toFixed(2);

// ---------------------------------------------------------------- base cabinet
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -FOOT_H, FOOT_H, P)}"/>`];
  const feet = [...k.corners(BASE, 14)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 7, -FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 5, -FOOT_H + 1.6, FOOT_H - 1.6, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(BASE, 0, BASE_H, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(BASE, 8, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 4), BASE_H, P), { tone: "faint" }));
  const screws = k.corners(BASE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, BASE_H, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, BASE_H])), { size: 0.5 }));
  // Front face: vent slots (closed) and a label plate with three rule lines.
  const yf = FRONT > 0 ? BASE.y + BASE.d : BASE.y;
  const slot = (x) => k.pathOf([[x, yf, 16], [x + 3, yf, 16], [x + 3, yf, 30], [x, yf, 30]].map(at), true);
  out.push(L([-88, -82, -76, -70, -64].map(slot).join(""), { tone: "lo" }));
  const plate = [[-34, yf, 14], [34, yf, 14], [34, yf, 34], [-34, yf, 34]];
  out.push(`<path class="ten-panel" d="${k.pathOf(plate.map(at), true)}"/>`);
  out.push(L(k.pathOf(plate.map(at), true), { tone: "lo" }));
  out.push(L([[-28, 29, 34], [-28, 24, 24], [-28, 19, 30]].map(([x, z, len]) => k.pathOf([at([x, yf, z]), at([x + len, yf, z])])).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([30, yf, 30]), at([30, yf, 18])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- columns (split around the moving crosshead, rebuilt live)
function columnLow(x, dz) {
  const top = XH_Z + dz - NUT_H;
  return S_(k.cylinder(x, 0, COL_R, BASE_H, top - BASE_H, P, 28), { tone: "mid", crease: "none", inner: threads(x, BASE_H + 14, top - 4) });
}
function columnHigh(x, dz) {
  const z0 = XH_Z + XH_H + NUT_H + dz;
  return S_(k.cylinder(x, 0, COL_R, z0, TOP_Z - z0, P, 28), { tone: "mid", crease: "none", inner: threads(x, z0 + 4, TOP_Z - 6) });
}
// Lead-screw threads: front arcs every 4 units, faint, on the screw's own face.
function threads(x, z0, z1) {
  const d = [];
  for (let z = Math.ceil(z0 / 4) * 4; z < z1; z += 4) d.push(k.sideArc(x, 0, COL_R, z, P, 16));
  return L(d.join(""), { tone: "faint" });
}
function collar(x) {
  return S_(k.cylinder(x, 0, 10, BASE_H, 6, P, 32, 0.4), { tone: "mid" }) + Dots([at([x - 8, 0, BASE_H + 6]), at([x + 8, 0, BASE_H + 6])].filter((_, i) => i === (FRONT > 0 ? 1 : 0)), { size: 0.4, tone: "lo" });
}

// ---------------------------------------------------------------- grips, load cell, specimen
function gripBody(z, upper) {
  const out = [];
  out.push(S_(k.slabOf(GRIP, z, GRIP_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(GRIP, z + (upper ? GRIP_H - 6 : 6), P, 3), { tone: "faint" }) }));
  // Wedge faces on the visible front: two converging lines, the jaw gap between.
  const yf = FRONT > 0 ? GRIP.y + GRIP.d : GRIP.y;
  const zt = upper ? z : z + GRIP_H, zb = upper ? z + GRIP_H - 4 : z + 4;
  out.push(L(k.pathOf([at([-12, yf, zb]), at([-5, yf, zt])]) + k.pathOf([at([12, yf, zb]), at([5, yf, zt])]), { tone: "lo" }));
  out.push(L(k.pathOf([at([-12, yf, zb]), at([12, yf, zb])]), { tone: "lo" }));
  // Tightening handle on the +x side: a boss and a knurled knob.
  const hz = z + GRIP_H / 2;
  out.push(S_(boxX(GRIP.x + GRIP.w, GRIP.x + GRIP.w + 7, -3.5, 3.5, hz - 3.5, hz + 3.5), { tone: "mid" }));
  out.push(S_(boxX(GRIP.x + GRIP.w + 7, GRIP.x + GRIP.w + 13, -5.5, 5.5, hz - 5.5, hz + 5.5), { tone: "mid", inner: L([-3.5, -1, 1.5, 4].map((t) => k.pathOf([at([GRIP.x + GRIP.w + 7.6, FRONT * 5.5, hz + t]), at([GRIP.x + GRIP.w + 12.4, FRONT * 5.5, hz + t])])).join(""), { tone: "faint" }) }));
  const bolts = [[GRIP.x + 4, -9], [GRIP.x + GRIP.w - 4, -9], [GRIP.x + 4, 9], [GRIP.x + GRIP.w - 4, 9]];
  if (!upper) out.push(Dots(bolts.map(([x, y]) => at([x, y, z + GRIP_H])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
// An axis-aligned box from x0..x1, y0..y1, z0..z1 (a slab with square corners).
const boxX = (x0, x1, y0, y1, z0, z1) => k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0 }, z0, z1 - z0, P, 1, 0.3);

function lowerMount() {
  return S_(k.cylinder(0, 0, 14, BASE_H, LOW_GRIP_Z - BASE_H, P, 40, 0.4), { tone: "mid", inner: L(k.sideArc(0, 0, 14, BASE_H + 7, P, 32), { tone: "faint" }) }) +
    Dots([0, 1, 2, 3].map((i) => at([11 * Math.cos(i * Math.PI / 2 + Math.PI / 4), 11 * Math.sin(i * Math.PI / 2 + Math.PI / 4), LOW_GRIP_Z])), { size: 0.45, tone: "lo" });
}

function loadCell() {
  const out = [];
  out.push(S_(k.cylinder(0, 0, 12, CELL_Z, 3, P, 40, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(0, 0, 10, CELL_Z + 3, CELL_H - 6, P, 40), { tone: "mid", crease: "none", inner: L(k.sideArc(0, 0, 10, CELL_Z + CELL_H / 2, P, 32), { tone: "faint" }) }));
  out.push(S_(k.cylinder(0, 0, 12, CELL_Z + CELL_H - 3, 3, P, 40, 0.3), { tone: "mid" }));
  // Connector boss on the front, a short body and a cap: the load cell's cable gland.
  const yf = FRONT * 10;
  out.push(S_(k.slabOf({ x: 9.2, y: FRONT > 0 ? 1 : -5, w: 5, d: 4, r: 1 }, CELL_Z + CELL_H / 2 - 2.5, 5, P, 2, 0.2), { tone: "lo" }));
  out.push(Dots([at([0, yf, CELL_Z + CELL_H / 2 + 2]), at([-4, FRONT * 9.2, CELL_Z + CELL_H / 2 + 2])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

// The moving crosshead: slab, two lower bushings, two upper nuts, a pointer.
function crossheadLowerNuts() {
  return COL_X.map((x) => S_(k.cylinder(x, 0, NUT_R, XH_Z - NUT_H, NUT_H, P, 36, 0.4), { tone: "mid" })).join("");
}
function crosshead() {
  const out = [S_(k.slabOf(XH, XH_Z, XH_H, P, 4, 1), { tone: "mid", inner: L(k.sideSeam(XH, XH_Z + 6, P, 4), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(XH, 4), XH_Z + XH_H, P), { tone: "faint" }));
  out.push(Dots([[-40, -9], [-40, 9], [40, -9], [40, 9]].map(([x, y]) => at([x, y, XH_Z + XH_H])), { size: 0.45, tone: "lo" }));
  for (const x of COL_X) out.push(S_(k.cylinder(x, 0, NUT_R, XH_Z + XH_H, NUT_H, P, 36, 0.4), { tone: "mid", inner: L(k.knurl(x, 0, NUT_R, XH_Z + XH_H, XH_Z + XH_H + NUT_H, 24, P, 1.2), { tone: "faint" }) }));
  return out.join("");
}

function topCrosshead() {
  const plan = { ...XH, y: -16, d: 32 };
  const out = [S_(k.slabOf(plan, TOP_Z, TOP_H, P, 4, 1.2), { tone: "mid", inner: L(k.sideSeam(plan, TOP_Z + 7, P, 4), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(plan, 4), TOP_Z + TOP_H, P), { tone: "faint" }));
  for (const x of COL_X) {
    out.push(S_(k.cylinder(x, 0, 9.5, TOP_Z + TOP_H, 5, P, 6, 0.3), { tone: "mid" })); // hex cap nut
    out.push(Dots([at([x, 0, TOP_Z + TOP_H + 5])], { size: 0.6, tone: "lo" }));
  }
  // Engraved model plate on the top face.
  const label = { x: -26, y: -7, w: 52, d: 14, r: 1 };
  out.push(S_(k.slabOf(label, TOP_Z + TOP_H, 0.8, P, 3), { tone: "lo" }));
  out.push(L([[-22, -2.5, 30], [-22, 0.5, 40], [-22, 3.5, 22]].map(([x, y, len]) => k.lineOnTop([x, y], [x + len, y], TOP_Z + TOP_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  return out.join("");
}

// ---------------------------------------------------------------- the specimen (the lit part, rebuilt every frame)
// A body of revolution about the vertical axis: its silhouette at height z is
// the screen x of the circle's extremes, cx ± r·k, at the circle centre's
// screen y. Volume is conserved: the gauge thins as r0/√(1+ε) until the UTS,
// then a neck forms in the middle and the bar breaks there at EPS_F.
function profileOf(eps) {
  const e = Math.min(eps, EPS_F);
  const rg = R_GAUGE / Math.sqrt(1 + Math.min(e, EPS_U));
  const neck = e > EPS_U ? (e - EPS_U) / (EPS_F - EPS_U) : 0;
  const gauge = GAUGE * (1 + e);
  const len = SHOULDER + SHOULDER_UP + 2 * FILLET + gauge;
  const mid = SHOULDER + FILLET + gauge / 2;
  const rAt = (s) => {
    if (s < SHOULDER || s > len - SHOULDER_UP) return R_SHOULDER;
    const fil = s < SHOULDER + FILLET ? (s - SHOULDER) / FILLET : s > len - SHOULDER_UP - FILLET ? (len - SHOULDER_UP - s) / FILLET : 1;
    const base = rg + (R_SHOULDER - rg) * (1 + Math.cos(Math.PI * fil)) / 2;
    return base * (1 - 0.35 * neck * Math.exp(-(((s - mid) / 7) ** 2)));
  };
  return { len, mid, rAt };
}

function specimenSvg(eps, k_) {
  const { len, mid, rAt } = profileOf(eps);
  const broken = eps >= EPS_F;
  const gap = broken ? Math.min(4, (eps - EPS_F) * 400) : 0;
  const kk = k_; // screen units per world unit
  const piece = (s0, s1, dz, capTop, capBottom) => {
    const left = [], right = [];
    for (let s = s0; s <= s1 + 1e-9; s += Math.max(0.5, (s1 - s0) / 120)) {
      const [cx, cy] = at([0, 0, SPEC_Z0 + s + dz]);
      const r = rAt(s) * kk;
      left.push([cx - r, cy]);
      right.push([cx + r, cy]);
    }
    const r0 = rAt(s0) * kk, r1 = rAt(s1) * kk;
    const [bx, by] = at([0, 0, SPEC_Z0 + s0 + dz]);
    const [tx, ty] = at([0, 0, SPEC_Z0 + s1 + dz]);
    const ry0 = r0 * Math.sin(P.elevation * Math.PI / 180), ry1 = r1 * Math.sin(P.elevation * Math.PI / 180);
    // Up the left side, across the top (front half or a jagged break), down the right, back along the front of the bottom.
    let d = `M${f2(left[0][0])} ${f2(left[0][1])}`;
    for (const p of left.slice(1)) d += `L${f2(p[0])} ${f2(p[1])}`;
    d += capTop === "break" ? jag(tx, ty, r1, -1) : `L${f2(tx + r1)} ${f2(ty)}`;
    for (const p of right.slice().reverse()) d += `L${f2(p[0])} ${f2(p[1])}`;
    d += capBottom === "break" ? jag(bx, by, r0, 1) : `A${f2(r0)} ${f2(ry0)} 0 0 1 ${f2(bx - r0)} ${f2(by)}`;
    d += "Z";
    void ry1;
    return `<path class="ten-spec" d="${d}"/>`;
  };
  if (!broken) {
    return piece(0, len, 0, "flat", "seat") + marks(eps, 0);
  }
  return piece(0, mid, 0, "break", "seat") + piece(mid, len, gap, "flat", "break") + marks(eps, gap);
}
// A cup-and-cone break: a short zigzag across the bar (left to right when dir < 0).
function jag(cx, cy, r, dir) {
  const xs = [-1, -0.6, -0.25, 0.1, 0.45, 0.8, 1];
  const ys = [0, 0.5, -0.4, 0.6, -0.3, 0.4, 0];
  const pts = (dir < 0 ? xs : xs.slice().reverse()).map((u, i) => [cx + u * r, cy + (dir < 0 ? ys[i] : ys[ys.length - 1 - i]) * 1.4]);
  return pts.map(([x, y]) => `L${f2(x)} ${f2(y)}`).join("");
}
// Punched gauge marks 50 mm apart, drawn as front half-rings that ride the surface.
function marks(eps, gap) {
  const { rAt } = profileOf(eps);
  const e = Math.min(eps, EPS_F);
  const lo = SHOULDER + FILLET, hi = lo + GAUGE * (1 + e);
  const sinE = Math.sin(P.elevation * Math.PI / 180);
  return [lo, hi].map((s, i) => {
    const [cx, cy] = at([0, 0, SPEC_Z0 + s + (i ? gap : 0)]);
    const r = rAt(s) * P.scale * Math.sqrt(1.6);
    return `<path class="ten-mark" d="M${f2(cx - r)} ${f2(cy)}A${f2(r)} ${f2(r * sinE)} 0 0 0 ${f2(cx + r)} ${f2(cy)}"/>`;
  }).join("");
}

// ---------------------------------------------------------------- extensometer (clip-on, on the −x side of the specimen)
// The body hangs off the lower arm; the upper arm rides the upper gauge mark
// and slides up the body's slot as the gauge stretches.
const EXT = { x: -27, y: -4, w: 8, d: 8, r: 1.2 };
const EXT_Z0 = MARK_LO - 5, EXT_Z1 = MARK_HI + 17;
function extBody() {
  const out = [S_(k.slabOf(EXT, EXT_Z0, EXT_Z1 - EXT_Z0, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(EXT, MARK_LO + 8, P, 3), { tone: "faint" }) })];
  // The slot the upper arm slides in, on the body's +x face, and two set screws on the front.
  const xf = EXT.x + EXT.w, yf = FRONT > 0 ? EXT.y + EXT.d : EXT.y;
  out.push(L(k.pathOf([[xf, -1.6, MARK_HI - 3], [xf, 1.6, MARK_HI - 3], [xf, 1.6, MARK_HI + 15], [xf, -1.6, MARK_HI + 15]].map(at), true), { tone: "lo" }));
  out.push(Dots([at([EXT.x + 4, yf, EXT_Z0 + 3]), at([EXT.x + 4, yf, EXT_Z1 - 3])], { size: 0.45, tone: "lo" }));
  return out.join("");
}
// An arm from the body to a knife edge resting on the gauge mark at height z.
function extArm(z) {
  return S_(k.slabOf({ x: EXT.x + EXT.w, y: -1.6, w: -EXT.x - EXT.w - R_GAUGE + 0.6, d: 3.2, r: 0.4 }, z - 1.2, 2.4, P, 2, 0.2), { tone: "hi" });
}

// ---------------------------------------------------------------- controller pedestal with a live σ–ε screen
function controller() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CTRL, 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S_(k.slabOf(CTRL, 0, CTRL_H, P, 4, 1), { tone: "mid", inner: L(k.sideSeam(CTRL, 10, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CTRL, 3.5), CTRL_H, P), { tone: "faint" }));
  const yf = FRONT > 0 ? CTRL.y + CTRL.d : CTRL.y;
  const rect = [[SCREEN.x0, yf, SCREEN.z0], [SCREEN.x1, yf, SCREEN.z0], [SCREEN.x1, yf, SCREEN.z1], [SCREEN.x0, yf, SCREEN.z1]];
  out.push(`<path class="ten-screen" d="${k.pathOf(rect.map(at), true)}"/>`);
  out.push(L(k.pathOf(rect.map(at), true), { tone: "lo" }));
  // Keypad: three buttons and an emergency stop on the top.
  for (const [x, y] of [[121, 18], [128, 18], [135, 18]]) out.push(S_(k.cylinder(x, y, 2.4, CTRL_H, 1.6, P, 16), { tone: "mid" }));
  out.push(S_(k.cylinder(146, 4, 6, CTRL_H, 2, P, 28, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(146, 4, 4.4, CTRL_H + 2, 3, P, 28, 0.4), { tone: "hi", inner: L(k.ring(146, 4, 2.4, CTRL_H + 5, P, 20), { tone: "faint" }) }));
  // Rule lines for a printed label under the screen.
  out.push(L([[SCREEN.x0, 54, 18], [SCREEN.x0, 49, 26]].map(([x, z, len]) => k.pathOf([at([x, yf, z]), at([x + len, yf, z])])).join(""), { tone: "lo", free: true }));
  return out.join("");
}
// The curve as recorded so far, in the plane of the screen.
function screenPlot(eps) {
  const yf = FRONT > 0 ? CTRL.y + CTRL.d : CTRL.y;
  const X = (e) => SCREEN.x0 + 3 + (e / 0.32) * (SCREEN.x1 - SCREEN.x0 - 6);
  const Z = (s) => SCREEN.z0 + 3 + (s / 460) * (SCREEN.z1 - SCREEN.z0 - 6);
  const axes = k.pathOf([at([SCREEN.x0 + 3, yf, SCREEN.z1 - 3]), at([SCREEN.x0 + 3, yf, SCREEN.z0 + 3]), at([SCREEN.x1 - 3, yf, SCREEN.z0 + 3])]);
  const pts = [];
  const top = Math.min(eps, EPS_F);
  for (let e = 0; e <= top + 1e-9; e += top / 90 || 1) pts.push(at([X(e), yf, Z(stressOf(e))]));
  if (!pts.length) pts.push(at([X(0), yf, Z(0)]));
  let d = `<path class="ten-axis" d="${axes}"/>`;
  if (pts.length > 1) d += `<path class="ten-trace" d="${k.pathOf(pts)}"/>`;
  const now = eps >= EPS_F ? at([X(EPS_F), yf, Z(0)]) : at([X(top), yf, Z(stressOf(top))]);
  if (eps >= EPS_F) d += `<path class="ten-trace" d="${k.pathOf([pts[pts.length - 1], now])}"/>`;
  d += `<circle class="ten-dot" cx="${f2(now[0])}" cy="${f2(now[1])}" r="1.3"/>`;
  return d;
}

// ---------------------------------------------------------------- assemble
const KS = P.scale * Math.sqrt(1.6);
const LABEL =
  "A twin-column universal testing machine on a base cabinet. Two lead screws carry a moving crosshead; a load cell hangs from it and holds the upper wedge grip. A round dog-bone specimen runs from the lower grip to the upper one, with a clip-on extensometer touching its two gauge marks. A controller beside the machine plots stress against strain as the test runs.";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    `<defs><linearGradient id="ten-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--anatomy-lit-shade)"/><stop offset="0.38" style="stop-color:var(--anatomy-lit-top)"/><stop offset="1" style="stop-color:var(--anatomy-lit-shade)"/></linearGradient></defs>`,
    base(),
    COL_X.map(collar).join(""),
    `<g data-cols-low>${COL_X.map((x) => columnLow(x, 0)).join("")}</g>`,
    lowerMount(),
    gripBody(LOW_GRIP_Z, false),
    extBody(),
    extArm(MARK_LO),
    `<g data-move-arm>${extArm(MARK_HI)}</g>`,
    `<g data-spec>${specimenSvg(0, KS)}</g>`,
    `<g data-move>${gripBody(UP_GRIP_Z, true)}${loadCell()}${crossheadLowerNuts()}${crosshead()}</g>`,
    `<g data-cols-high>${COL_X.map((x) => columnHigh(x, 0)).join("")}</g>`,
    topCrosshead(),
    controller(),
    `<g data-screen>${screenPlot(0)}</g>`,
  ],
});

const fmt = (v, d) => v.toFixed(d);
const readoutOf = (eps) => {
  if (eps >= EPS_F) return `fracture · ε ${fmt(EPS_F * 100, 0)}% · UTS 420 MPa`;
  const s = stressOf(eps);
  return `ε ${fmt(eps * 100, 1)}% · σ ${fmt(s, 0)} MPa · F ${fmt((s * A0) / 1000, 1)} kN`;
};

const stage = `<div class="iso-stage ten-stage" tabindex="0" role="group" aria-roledescription="tensile test control" aria-label="Tensile test. Right and Left arrows step the crosshead; Space pauses; R restarts with a new specimen.">${svg}<span class="ten-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Tensile test",
  hint: "← → step · space pause · R new bar",
  readout: readoutOf(0),
  keys: [
    { mark: "lit", label: "The specimen: a 12.5 mm steel bar, gauge 50 mm" },
    { mark: "dim", label: "Crosshead, load cell and grips pull it apart" },
  ],
  caption: `The crosshead climbs at a constant rate; the load cell reads the force F and the extensometer the strain ε = ΔL/L₀ between the two gauge marks. Stress is F/A₀ with A₀ = ${fmt(A0, 1)} mm². Typical hot-rolled mild steel: a sharp upper yield, a Lüders plateau, hardening to 420 MPa, then a neck and a cup-and-cone break at about 30 % elongation. The frame is drawn rigid, so the crosshead travel equals the gauge extension.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="tensile">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="tensile"]
function scope(css, root) {
  const out = [];
  let i = 0;
  const read = () => {
    const open = css.indexOf("{", i);
    if (open < 0) return null;
    let depth = 1, j = open + 1;
    while (depth && j < css.length) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const prelude = css.slice(i, open).trim();
    const body = css.slice(open + 1, j - 1);
    i = j;
    return { prelude, body };
  };
  let rule;
  while ((rule = read())) {
    const { prelude, body } = rule;
    if (prelude.startsWith("@keyframes")) out.push(`${prelude}{${body}}`);
    else if (prelude.startsWith("@")) out.push(`${prelude}{${scope(body, root)}}`);
    else {
      const sel = prelude
        .split(",")
        .map((s) => s.trim())
        .flatMap((s) =>
          s === ".iso" ? [`.iso${root}`]
          : s === '.iso[data-theme="light"]' ? [`.iso${root}[data-theme="light"]`, `html:not(.dark) .iso${root}`]
          : s.startsWith(".iso[") ? [s.replace(".iso[", `.iso${root}[`)]
          : [`.iso${root} ${s}`],
        )
        .join(",");
      out.push(`${sel}{${body.trim()}}`);
    }
  }
  return out.join("\n");
}
const ROOTSEL = '[data-anatomy="tensile"]';
const FIGURE_CSS = `
.iso[data-anatomy="tensile"]{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso[data-anatomy="tensile"][data-theme="light"],html:not(.dark) .iso[data-anatomy="tensile"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso[data-anatomy="tensile"] .iso-figure{margin:0}
.iso[data-anatomy="tensile"] .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso[data-anatomy="tensile"] .iso-plate-corner{font-family:inherit;font-size:11px}
.iso[data-anatomy="tensile"] .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso[data-anatomy="tensile"] .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso[data-anatomy="tensile"] .iso-legend{font-size:13px}
.iso[data-anatomy="tensile"] .ten-stage{position:relative;outline:none;cursor:default}
.iso[data-anatomy="tensile"] .ten-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso[data-anatomy="tensile"] .ten-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso[data-anatomy="tensile"] .ten-spec{fill:url(#ten-shine);stroke:var(--anatomy-lit);stroke-width:var(--anatomy-weight);stroke-linejoin:round}
.iso[data-anatomy="tensile"] .ten-mark{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso[data-anatomy="tensile"] .ten-panel{fill:var(--anatomy-face)}
.iso[data-anatomy="tensile"] .ten-screen{fill:var(--anatomy-paper)}
.iso[data-anatomy="tensile"] .ten-axis{fill:none;stroke:var(--anatomy-faint);stroke-width:var(--anatomy-weight)}
.iso[data-anatomy="tensile"] .ten-trace{fill:none;stroke:var(--anatomy-lit);stroke-width:1.1;stroke-linejoin:round;stroke-linecap:round}
.iso[data-anatomy="tensile"] .ten-dot{fill:var(--anatomy-lit)}
@media (max-width:560px){.iso[data-anatomy="tensile"] .iso-plate{padding:40px 4px 60px}}
`;
const css = scope(k.ISO_CSS, ROOTSEL) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script (plain ES module)
const liveSrc = `
const P = ${JSON.stringify(P)};
const KNOTS = ${JSON.stringify(KNOTS)}, E_MPA = ${E_MPA}, EPS_U = ${EPS_U}, EPS_F = ${EPS_F}, A0 = ${A0};
const COL_X = ${JSON.stringify(COL_X)}, COL_R = ${COL_R}, BASE_H = ${BASE_H}, TOP_Z = ${TOP_Z}, XH_Z = ${XH_Z}, XH_H = ${XH_H}, NUT_H = ${NUT_H};
const SPEC_Z0 = ${SPEC_Z0}, SHOULDER = ${SHOULDER}, SHOULDER_UP = ${SHOULDER_UP}, FILLET = ${FILLET}, GAUGE = ${GAUGE}, R_GAUGE = ${R_GAUGE}, R_SHOULDER = ${R_SHOULDER};
const CTRL = ${JSON.stringify(CTRL)}, SCREEN = ${JSON.stringify(SCREEN)}, FRONT = ${FRONT}, KS = ${KS};
const at = (p) => iso(p, P);
const k = { cylinder, sideArc, pathOf };
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const f2 = (v) => v.toFixed(2);
${monotone.toString()}
const curve = monotone(KNOTS);
const stressOf = (eps) => (eps <= KNOTS[0][0] ? E_MPA * eps : eps > EPS_F ? 0 : curve(eps));
const ext = ${ext.toString()};
${columnLow.toString()}
${columnHigh.toString()}
${threads.toString()}
${profileOf.toString()}
${specimenSvg.toString()}
${jag.toString()}
${marks.toString()}
${screenPlot.toString()}
const fmt = (v, d) => v.toFixed(d);
const readoutOf = ${readoutOf.toString()};

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".ten-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const g = (name) => svg.querySelector("[data-" + name + "]");
  const spec = g("spec"), move = g("move"), arm = g("move-arm"), low = g("cols-low"), high = g("cols-high"), screen = g("screen");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // eps is the strain shown; the tour pulls at a constant crosshead rate
  // (the whole test in about 9 s, slowed for reading), holds at fracture,
  // then loads a fresh bar.
  let eps = 0, target = 0, paused = false, frame = 0, last = 0, visible = false, hold = 0, touched = 0;
  const RATE = 0.3 / 9;

  function draw() {
    const dz = ext(eps) + (eps >= EPS_F ? Math.min(4, (eps - EPS_F) * 400) : 0);
    const t = translateAlong(P, [0, 0, dz]);
    move.setAttribute("transform", t);
    arm.setAttribute("transform", translateAlong(P, [0, 0, ext(eps)]));
    low.innerHTML = COL_X.map((x) => columnLow(x, dz)).join("");
    high.innerHTML = COL_X.map((x) => columnHigh(x, dz)).join("");
    spec.innerHTML = specimenSvg(eps, KS);
    screen.innerHTML = screenPlot(eps);
    const text = readoutOf(eps);
    if (readout.textContent !== text) readout.textContent = text;
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && now - touched > 4000) {
      if (eps < EPS_F + 0.01) target = Math.min(EPS_F + 0.01, target + RATE * dt);
      else if ((hold += dt) > 2.4) { target = 0; eps = 0; hold = 0; }
    }
    eps += (target - eps) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(target - eps) < 1e-5) eps = target;
    draw();
    frame = visible && !still.matches && (!paused || eps !== target) ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.02 : 0.005;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") target = Math.min(EPS_F + 0.01, target + step);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") { if (target < EPS_F) target = Math.max(0, target - step); }
    else if (event.key === " ") paused = !paused;
    else if (event.key === "r" || event.key === "R") { target = 0; eps = 0; hold = 0; }
    else return;
    event.preventDefault();
    touched = performance.now();
    say.textContent = readoutOf(target);
    if (still.matches) { eps = target; draw(); }
    run();
  });
  stage.addEventListener("click", () => { paused = !paused; run(); });
  still.addEventListener?.("change", () => { if (still.matches) { eps = target; draw(); } else run(); });
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  // Under reduced motion there is no tour: show the bar at the UTS, still.
  if (still.matches) { eps = target = EPS_U; }
  draw();
}

function start() { document.querySelectorAll('[data-anatomy="tensile"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/tensile/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

// ---------------------------------------------------------------- write
writeFileSync(join(OUT, "tensile.html"), fragment + "\n");
writeFileSync(join(OUT, "tensile.css"), css);
writeFileSync(join(OUT, "tensile.js"), js);

const pose = process.argv.includes("--pose") ? Number(process.argv[process.argv.indexOf("--pose") + 1]) : null;
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tensile test</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${(pose === null ? js : js + `\n`).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`wrote tensile.html/css/js · σ(UTS) = ${stressOf(EPS_U).toFixed(1)} MPa · F(UTS) = ${(stressOf(EPS_U) * A0 / 1000).toFixed(2)} kN · A0 = ${A0.toFixed(1)} mm²`);
