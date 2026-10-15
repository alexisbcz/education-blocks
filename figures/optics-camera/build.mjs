// Fig · Camera cutaway — a mirrorless camera on a tripod head, its near
// quarter cut away so the sensor, the focal-plane shutter and the cone of
// light behind the lens are visible. The aperture ring sets the iris (radius
// ∝ 1/N, so area ∝ 1/N²), the top dial sets the shutter time, and the
// readout is the exposure value EV = log2(N²/t) at ISO 100.
// Run from the repo root: node figures/optics-camera/build.mjs
// Writes site/static/anatomy/optics-camera.{html,css,js} and
// figures/optics-camera/preview{,-light}.html. The shared iso.css is not
// touched: optics-camera.css carries the kit CSS scoped under
// [data-anatomy="optics-camera"], plus the figure's own rules.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "/Users/alex/.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- model
// Marked f-numbers and shutter times (the marked values, as printed on real
// rings and dials; EV is computed from them, so f/8 at 1/125 s is 12.97).
const NS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const TS = [1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const tLabel = (t) => (t >= 1 ? `${t} s` : `1/${Math.round(1 / t)} s`);
const evOf = (N, t) => Math.log2((N * N) / t);
const N0 = 5, T0 = 3; // f/8, 1/125 s

// ---------------------------------------------------------------- layout (world units ≈ mm; z up, +y toward the viewer)
const WIDTH = 600, HEIGHT = 540;
const PLATE = { x: -84, y: -54, w: 168, d: 150, r: 8 };
const PLATE_H = 9, FOOT_H = 5;
const BZ = 66; // underside of the camera
const BH = 74; // body height
const TOPZ = BZ + BH;
const LX = 8, LZ = BZ + 38; // lens axis: x and height
const FRONT = 22; // body front face, y
const CUT_Y = -8; // the cut: the near-right quadrant x > LX, y > CUT_Y is removed
const BACK = { x: -62, y: -22, w: 124, d: FRONT - -22 }; // whole body plan
const BACK_SLAB = { x: -62, y: -22, w: 124, d: CUT_Y + 22, r: 4 };
const FRONT_SLAB = { x: -62, y: CUT_Y, w: LX + 62, d: FRONT - CUT_Y, r: 4 };
const GRIP = { x: -60, y: FRONT, w: 24, d: 13, r: 5 };
const HUMP = { x: -20, y: -22, w: LX + 20, d: 30, r: 3 };
const GATE = { w: 36, h: 24 }; // full-frame sensor, mm
const SENSOR_Y = CUT_Y + 1.6; // sensor surface (proud of the cut face)
const SHUTTER_Y = CUT_Y + 4.2; // shutter curtain plane
const LENS = G.frameAlong([LX, FRONT, LZ], [0, 1, 0]);
const IRIS_S = 58.6, IRIS_R = 24.4, BLADES = 7;
const R_OPEN = 21; // iris radius at f/1.4
const rOf = (N) => (R_OPEN * NS[0]) / N; // radius ∝ 1/N → area ∝ 1/N²
const RING = { s0: 12, s1: 21, r: 29.4 }; // aperture ring
const DIAL = { x: -42, y: -8, r: 11, z: TOPZ, h: 6 }; // shutter-speed dial

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [LX, FRONT + 62, LZ + 32], [LX, FRONT + 62, LZ - 32], [-62, -22, TOPZ + 20], [62, -22, TOPZ + 12], [-60, FRONT + 13, TOPZ]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 36 },
);
const view = k.towardViewer(P);
if (!(view[0] > 0 && view[1] > 0)) throw new Error("camera must see the +x and +y faces");
const at = (p) => k.iso(p, P);
const depthOf = k.depthOf;
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => v.toFixed(2);
const M = (p) => { const q = at(p); return `${f2(q[0])} ${f2(q[1])}`; };
const poly = (pts) => "M" + pts.map(M).join("L") + "Z";
// A point on the lens frame: s along the axis, r and angle a around it.
const pointOf = (F, s, r, a) => [0, 1, 2].map((i) => F.o[i] + F.a[i] * s + r * (F.u[i] * Math.cos(a) + F.v[i] * Math.sin(a)));

// ---------------------------------------------------------------- base and tripod head
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 22)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate, front right
  const label = { x: 30, y: 70, w: 44, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([28, 18, 32].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}
function tripodHead() {
  const out = [];
  out.push(S_(k.cylinder(0, 0, 26, 0, 5, P, 56, 0.6), { tone: "mid", inner: L(k.ring(0, 0, 20, 5, P, 48), { tone: "faint" }) }));
  out.push(Dots([0, 1, 2, 3, 4, 5].map((n) => at([23 * Math.cos((n * Math.PI) / 3 + 0.3), 23 * Math.sin((n * Math.PI) / 3 + 0.3), 5])), { size: 0.45, tone: "lo" }));
  out.push(S_(k.cylinder(0, 0, 10, 5, 30, P, 40), { tone: "mid", inner: L(k.sideArc(0, 0, 10, 14, P, 40) + k.sideArc(0, 0, 10, 26, P, 40), { tone: "faint" }) }));
  // pan collar with a knurled locking knob
  out.push(S_(k.cylinder(0, 0, 17, 35, 9, P, 48, 0.6), { tone: "mid", inner: L(k.sideArc(0, 0, 17, 39.5, P, 48), { tone: "faint" }) }));
  const KF = G.frameAlong([16.5, 6, 39.5], [1, 0.35, 0]);
  out.push(S_(G.disc(0, 4, 2.2, KF, P), { tone: "mid" }));
  out.push(S_(G.disc(4, 11, 5.2, KF, P), { tone: "lo", inner: L(G.ribsOf(KF, 4.4, 10.6, 5.2, 24, P, { least: 0.15, seams: true }), { tone: "faint" }) }));
  out.push(S_(k.cylinder(0, 0, 13, 44, 12, P, 40), { tone: "mid" }));
  // quick-release plate under the camera, with its clamp screw
  const qr = { x: -34, y: -18, w: 68, d: 36, r: 2 };
  out.push(S_(k.slabOf(qr, 56, BZ - 56, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(qr, 60, P, 4), { tone: "faint" }) }));
  out.push(Dots([at([-28, 18, 59]), at([28, 18, 59])], { size: 0.5, tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- body
const cutTint = (d) => `<path class="cam-cut" d="${d}"/>`;
function bodyBack() {
  const out = [];
  out.push(S_(k.slabOf(BACK_SLAB, BZ, BH, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(BACK_SLAB, BZ + 8, P, 6), { tone: "faint" }) }));
  // the exposed cut face (y = CUT_Y, x > LX): section tint
  out.push(cutTint(poly([[LX, CUT_Y, BZ + 1], [61, CUT_Y, BZ + 1], [61, CUT_Y, TOPZ - 1], [LX, CUT_Y, TOPZ - 1]])));
  // strap lug on the right side
  const LF = G.frameAlong([62, -15, TOPZ - 12], [1, 0, 0]);
  out.push(S_(G.disc(0, 5, 3.6, LF, P), { tone: "mid" }));
  out.push(S_(G.disc(5, 7, 5, LF, P), { tone: "mid", inner: L(G.circleOf(LF, 7, 2, P), { tone: "lo" }) }));
  // exposure-compensation dial on the right shoulder
  out.push(S_(k.cylinder(42, -15, 8, TOPZ, 5, P, 40), { tone: "mid", inner: L(k.knurl(42, -15, 8, TOPZ, TOPZ + 5, 36, P), { tone: "faint" }) }));
  const ec = k.radialTicks(42, -15, 8, 12, 3, TOPZ + 5, [0.9, 1.8], P);
  out.push(L(ec.minor, { tone: "lo" }) + L(ec.major, { tone: "mid" }));
  return out.join("");
}
function sensor(lit) {
  // the sensor in its package; only the half in the cut quadrant shows
  const pkg = { x: LX - GATE.w / 2 - 4, y: CUT_Y, w: GATE.w + 8, d: 1.2, r: 0.6 };
  const out = [S_(k.slabOf(pkg, LZ - GATE.h / 2 - 4, GATE.h + 8, P, 3), { tone: "lo" })];
  const z0 = LZ - GATE.h / 2, z1 = LZ + GATE.h / 2, x0 = LX - GATE.w / 2, x1 = LX + GATE.w / 2;
  out.push(`<path class="cam-sensor${lit ? " is-lit" : ""}" data-cam-sensor d="${poly([[x0, SENSOR_Y, z0], [x1, SENSOR_Y, z0], [x1, SENSOR_Y, z1], [x0, SENSOR_Y, z1]])}"/>`);
  // the photosite grid: lines run edge to edge across the active area
  const d = [];
  for (let i = 1; i < 9; i++) { const x = x0 + (i * GATE.w) / 9; d.push(`M${M([x, SENSOR_Y, z0])}L${M([x, SENSOR_Y, z1])}`); }
  for (let i = 1; i < 6; i++) { const z = z0 + (i * GATE.h) / 6; d.push(`M${M([x0, SENSOR_Y, z])}L${M([x1, SENSOR_Y, z])}`); }
  out.push(`<path class="cam-grid" d="${d.join("")}"/>`);
  return out.join("");
}
// Focal-plane shutter: guide rails and two curtains of three slats each, in
// the plane y = SHUTTER_Y. A mirrorless camera rests with the shutter open
// (live view): the first curtain parked below the gate, the second above.
// The live code translates them.
const SLAT = 8; // slat height; three slats cover the 24 mm gate
const C1_PARK = LZ - GATE.h / 2 - 1; // top of the first curtain, parked below the gate
const C2_PARK = TOPZ - 1; // top of the second curtain, parked above it
const COVER = LZ + GATE.h / 2 + 1; // top of a curtain covering the gate
function curtain(zTop, cls) {
  const out = [];
  for (let n = 0; n < 3; n++) {
    const plan = { x: LX - GATE.w / 2 - 3, y: SHUTTER_Y - 0.4, w: GATE.w + 6, d: 0.8, r: 0.2 };
    out.push(S_(k.slabOf(plan, zTop - (n + 1) * SLAT, SLAT - 0.4, P, 2), { tone: n === 0 ? "hi" : "mid", className: cls }));
  }
  return out.join("");
}
function shutterFrame() {
  const out = [];
  const rails = [LX + GATE.w / 2 + 3.4, LX + GATE.w / 2 + 6];
  // the guide rails lie on the cut face, screwed to it at both ends
  for (const x of rails) {
    out.push(S_(k.cylinder(x, CUT_Y + 0.9, 0.9, BZ + 4, BH - 8, P, 10), { tone: "mid", crease: "none" }));
    out.push(Dots([at([x, CUT_Y + 1.8, BZ + 5]), at([x, CUT_Y + 1.8, TOPZ - 5])], { size: 0.5, tone: "hi" }));
  }
  return out.join("");
}
function bodyFront() {
  const out = [];
  out.push(S_(k.slabOf(FRONT_SLAB, BZ, BH, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(FRONT_SLAB, BZ + 8, P, 6), { tone: "faint" }) }));
  // the cut face x = LX: section tint, then the lens throat seen in section
  out.push(cutTint(poly([[LX, CUT_Y + 1, BZ + 1], [LX, FRONT - 1, BZ + 1], [LX, FRONT - 1, TOPZ - 1], [LX, CUT_Y + 1, TOPZ - 1]])));
  out.push(`<path class="cam-throat" d="${poly([[LX, SENSOR_Y, LZ - 21], [LX, FRONT, LZ - 21], [LX, FRONT, LZ + 21], [LX, SENSOR_Y, LZ + 21]])}"/>`);
  out.push(`<g data-cam-cone>${cone(rOf(NS[N0]))}</g>`);
  return out.join("");
}
// The cone of light from the iris to the centre of the sensor, drawn in the
// section plane: its spread follows the aperture.
function cone(r) {
  const top = at([LX, FRONT, LZ + r]), bot = at([LX, FRONT, LZ - r]), focus = at([LX, SENSOR_Y, LZ]);
  return `<path class="cam-cone" d="M${f2(top[0])} ${f2(top[1])}L${f2(focus[0])} ${f2(focus[1])}L${f2(bot[0])} ${f2(bot[1])}Z"/>` +
    `<path class="cam-ray" d="M${f2(top[0])} ${f2(top[1])}L${f2(focus[0])} ${f2(focus[1])}M${f2(bot[0])} ${f2(bot[1])}L${f2(focus[0])} ${f2(focus[1])}"/>`;
}
function grip() {
  const out = [];
  out.push(S_(k.slabOf(GRIP, BZ + 3, BH - 9, P, 8, 1.2), { tone: "lo", inner: L(k.sideSeam(GRIP, BZ + 14, P, 8) + k.sideSeam(GRIP, TOPZ - 14, P, 8), { tone: "faint" }) }));
  // shutter button on the grip's top
  out.push(S_(k.cylinder(-48, FRONT + 5, 4.6, TOPZ - 6, 2, P, 32, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(-48, FRONT + 5, 3.2, TOPZ - 4, 1.6, P, 28), { tone: "hi", lit: true }));
  return out.join("");
}
function topDeck() {
  const out = [];
  // viewfinder hump, hot shoe on top, eyepiece at the back (hidden)
  out.push(S_(k.slabOf(HUMP, TOPZ, 15, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(HUMP, TOPZ + 4, P, 5), { tone: "faint" }) }));
  const shoe = { x: HUMP.x + 4, y: -14, w: HUMP.w - 8, d: 16, r: 0.8 };
  out.push(S_(k.slabOf(shoe, TOPZ + 15, 2.4, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([shoe.x, shoe.y + 8], [shoe.x + shoe.w, shoe.y + 8], TOPZ + 17.4, P), { tone: "lo" }));
  out.push(Dots([at([shoe.x + shoe.w / 2 - 3, -6, TOPZ + 17.4]), at([shoe.x + shoe.w / 2 + 3, -6, TOPZ + 17.4])], { size: 0.5, tone: "lo" }));
  // shutter-speed dial: knurled edge, engraved ticks, a lit pointer that turns
  out.push(S_(k.cylinder(DIAL.x, DIAL.y, DIAL.r + 1.4, DIAL.z, 1.2, P, 48), { tone: "mid" }));
  out.push(S_(k.cylinder(DIAL.x, DIAL.y, DIAL.r, DIAL.z + 1.2, DIAL.h, P, 48), { tone: "mid", inner: L(k.knurl(DIAL.x, DIAL.y, DIAL.r, DIAL.z + 1.2, DIAL.z + 1.2 + DIAL.h, 48, P), { tone: "faint" }) }));
  const ticks = k.radialTicks(DIAL.x, DIAL.y, DIAL.r, TS.length - 1, 3, DIAL.z + DIAL.h + 1.2, [1.3, 2.2], P, DIAL_FROM, DIAL_SPAN);
  out.push(L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }));
  out.push(`<g data-cam-dial>${dialPointer(T0)}</g>`);
  out.push(Dots([at([DIAL.x, DIAL.y, DIAL.z + DIAL.h + 1.2])], { size: 0.6, tone: "hi" }));
  return out.join("");
}
// Shutter times sit on a 270° arc of the dial (the kit's tick angles: x = sin a, y = −cos a).
const DIAL_FROM = -0.75 * Math.PI, DIAL_SPAN = 1.5 * Math.PI;
const dialAngle = (i) => DIAL_FROM + (i / (TS.length - 1)) * DIAL_SPAN;
function dialPointer(i) {
  const a = dialAngle(i), z = DIAL.z + DIAL.h + 1.2, r = DIAL.r - 2.6;
  return `<path class="cam-pointer" d="M${M([DIAL.x, DIAL.y, z])}L${M([DIAL.x + r * Math.sin(a), DIAL.y - r * Math.cos(a), z])}"/>`;
}

// ---------------------------------------------------------------- lens
const F = LENS;
function lens() {
  const out = [];
  out.push(S_(G.disc(0, 3, 31, F, P), { tone: "mid", inner: L(G.circleOf(F, 3, 28, P), { tone: "lo" }) })); // mount flange
  out.push(Dots(G.dotsOf(F, 3, 29.6, 4, P, { phase: Math.PI / 4, all: true }), { size: 0.5, tone: "lo" }));
  out.push(S_(G.disc(3, RING.s0, 27, F, P), { tone: "mid" })); // rear barrel
  out.push(S_(G.disc(RING.s0, RING.s1, RING.r, F, P), { tone: "mid", inner: L(G.ribsOf(F, RING.s0 + 4.6, RING.s1 - 0.6, RING.r, 72, P, { least: 0.12, seams: true }), { tone: "faint" }) }));
  out.push(`<g data-cam-ring>${ringTicks(NS[N0])}</g>`);
  out.push(S_(G.disc(RING.s1, 28, 27.6, F, P), { tone: "mid" })); // middle barrel with the index dot
  out.push(Dots([at(pointOf(F, 24.5, 27.6, Math.PI / 2))], { size: 0.8, tone: "hi" }));
  out.push(S_(G.disc(28, 46, 31.4, F, P), { tone: "lo", inner: L(G.ribsOf(F, 28.8, 45.2, 31.4, 96, P, { least: 0.12, seams: true }), { tone: "faint" }) })); // focus ring, rubber
  out.push(S_(G.disc(46, 56, 29.6, F, P), { tone: "mid", inner: L(G.circleOf(F, 50, 29.6, P), { tone: "faint" }) }));
  out.push(S_(G.disc(56, 59, 30.6, F, P), { tone: "mid" })); // front rim (filter thread)
  // the opening in the rim, the iris inside it, the front element over it
  out.push(`<path class="cam-bore" d="${G.circleOf(F, 59, IRIS_R, P)}"/>`);
  out.push(`<g data-cam-iris>${iris(rOf(NS[N0]))}</g>`);
  out.push(`<path class="cam-glass" d="${G.circleOf(F, 59, IRIS_R, P)}"/>`);
  out.push(L(G.circleOf(F, 59, IRIS_R, P) + G.circleOf(F, 59, 27.6, P), { tone: "mid" }));
  out.push(`<path class="cam-glint" d="${glint()}"/>`);
  return out.join("");
}
// f-stop ticks engraved on the aperture ring: the ring turns so the chosen
// f-number's tick sits at the index dot (angle π/2).
const STOP_STEP = 0.21; // radians between marked stops on the ring
function ringTicks(N) {
  const pos = Math.log2(N / NS[0]) * 2; // stops from f/1.4
  const d = [];
  const axis = depthOf(pointOf(F, RING.s0, 0, 0), P);
  for (let i = 0; i < NS.length; i++) {
    const a = Math.PI / 2 + (i - pos) * STOP_STEP;
    if (depthOf(pointOf(F, RING.s0, RING.r, a), P) - axis < 0.35 * RING.r) continue; // only ticks on the near side
    const p0 = at(pointOf(F, RING.s0 + 0.8, RING.r, a)), p1 = at(pointOf(F, RING.s0 + (i % 2 ? 2.6 : 3.8), RING.r, a));
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  return `<path class="cam-ticks" d="${d.join("")}"/>`;
}
// Seven blades leave a heptagonal opening of radius r; each blade's edge
// runs from a corner of the opening out to the rim, curving with the blade.
function iris(r) {
  const s = IRIS_S, spin = 0.9 - r / 40;
  const corners = Array.from({ length: BLADES }, (_, i) => pointOf(F, s, r, spin + (i * 2 * Math.PI) / BLADES));
  const rim = Array.from({ length: 72 }, (_, i) => pointOf(F, s, IRIS_R, (i * 2 * Math.PI) / 72));
  const fill = "M" + rim.map(M).join("L") + "Z" + "M" + [...corners].reverse().map(M).join("L") + "Z";
  const edges = corners.map((c, i) => {
    const a = spin + (i * 2 * Math.PI) / BLADES;
    const mid = pointOf(F, s, (r + IRIS_R) / 2, a + 0.55);
    const end = pointOf(F, s, IRIS_R, a + 0.9);
    const q0 = at(c), q1 = at(mid), q2 = at(end);
    return `M${f2(q0[0])} ${f2(q0[1])}Q${f2(q1[0])} ${f2(q1[1])} ${f2(q2[0])} ${f2(q2[1])}`;
  });
  return `<path class="cam-blades" fill-rule="evenodd" d="${fill}"/><path class="cam-blade-edge" d="${edges.join("")}"/><path class="cam-opening" d="${"M" + corners.map(M).join("L") + "Z"}"/>`;
}
function glint() {
  const pts = Array.from({ length: 16 }, (_, i) => pointOf(F, 59, IRIS_R - 3, 2.2 + (i / 15) * 0.9));
  return "M" + pts.map(M).join("L");
}

// ---------------------------------------------------------------- assemble
const LABEL =
  "A mirrorless camera on a tripod head on a bench plate, its near-right quarter cut away. Inside, the image sensor sits at the back with a focal-plane shutter in front of it: two curtains of slats running on guide rails. In the cut face, a cone of light runs from the lens opening to the centre of the sensor. On the front, the lens has a mount flange, a ribbed aperture ring with engraved f-stop ticks, a rubber focus ring and a front element through which the seven-bladed iris is visible. A shutter-speed dial with a pointer sits on the top plate beside the viewfinder hump.";

const stage = (svg) => `<div class="iso-stage cam-stage" tabindex="0" role="group" aria-roledescription="camera control" aria-label="Camera. Left and Right arrows change the aperture, Up and Down the shutter speed, Space fires the shutter.">${svg}<span class="cam-sr" aria-live="polite" data-say></span></div>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    tripodHead(),
    bodyBack(),
    sensor(false),
    `<g data-cam-curtain="1">${curtain(C1_PARK, "cam-curtain-1")}</g>`,
    `<g data-cam-curtain="2">${curtain(C2_PARK, "cam-curtain-2")}</g>`,
    shutterFrame(),
    bodyFront(),
    grip(),
    topDeck(),
    lens(),
  ],
});

const readoutOf = (ni, ti) => {
  const N = NS[ni], t = TS[ti];
  return `f/${N} · ${tLabel(t)} · EV ${evOf(N, t).toFixed(2)}`;
};

const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Camera cutaway",
  hint: "← → aperture · ↑ ↓ shutter · space fire",
  readout: readoutOf(N0, T0),
  keys: [
    { mark: "lit", label: "Iris radius ∝ 1/N: one stop halves the area" },
    { mark: "dim", label: "EV = log₂(N²/t) at ISO 100" },
  ],
  caption: `The aperture ring sets the f-number N = f/D. The iris opening's diameter D falls as 1/N, so its area falls as 1/N²: each marked stop (1.4, 2, 2.8, 4 …) multiplies N by √2 and halves the light. The shutter dial sets the time t; each step also halves or doubles it. Settings with the same exposure value EV = log₂(N²/t) let the same light reach the sensor: f/8 at 1/125 s is EV ${evOf(8, 1 / 125).toFixed(2)}, and so is f/5.6 at 1/250 s (${evOf(5.6, 1 / 250).toFixed(2)}, the marked numbers are rounded). Space fires the focal-plane shutter: the first curtain drops to expose the sensor and the second follows to close it; speeds faster than 1/8 s are slowed down so you can see them.`,
  body: stage(svg),
});
const fragment = `<div class="iso" data-anatomy="optics-camera">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="optics-camera"]
function scope(css, root) {
  const out = [];
  let i = 0;
  const read = () => {
    const open = css.indexOf("{", i);
    if (open < 0) return null;
    let depth = 1, j = open + 1;
    while (depth && j < css.length) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
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
      const sel = prelude.split(",").map((s) => s.trim()).flatMap((s) =>
        s === ".iso" ? [`.iso${root}`]
        : s === '.iso[data-theme="light"]' ? [`.iso${root}[data-theme="light"]`, `html:not(.dark) .iso${root}`]
        : s.startsWith(".iso[") ? [s.replace(".iso[", `.iso${root}[`)]
        : [`.iso${root} ${s}`]).join(",");
      out.push(`${sel}{${body.trim()}}`);
    }
  }
  return out.join("\n");
}
const R_ = '[data-anatomy="optics-camera"]';
const FIGURE_CSS = `
.iso${R_}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;--cam-cut:#1b1b1d;--cam-cavity:#060607;--cam-light:#fde68a;--cam-sensor:#24304a;--cam-sensor-lit:#8fb4ff;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso${R_}[data-theme="light"],html:not(.dark) .iso${R_}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7;--cam-cut:#ececee;--cam-cavity:#3a3a3e;--cam-light:#f59e0b;--cam-sensor:#5b6b8f;--cam-sensor-lit:#2563eb}
.iso${R_} .iso-figure{margin:0}
.iso${R_} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R_} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .cam-stage{position:relative;outline:none;cursor:default}
.iso${R_} .cam-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .cam-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .cam-cut{fill:var(--cam-cut);stroke:var(--anatomy-mid);stroke-width:.8;stroke-linejoin:round}
.iso${R_} .cam-throat{fill:var(--cam-cavity);stroke:var(--anatomy-mid);stroke-width:.8}
.iso${R_} .cam-cone{fill:var(--cam-light);opacity:.16}
.iso${R_} .cam-ray{fill:none;stroke:var(--cam-light);stroke-width:1;opacity:.9}
.iso${R_} .cam-sensor{fill:var(--cam-sensor);stroke:var(--anatomy-hi);stroke-width:.8;transition:fill .08s}
.iso${R_}[data-exposing] .cam-sensor{fill:var(--cam-sensor-lit)}
.iso${R_}[data-exposing] .cam-cone{opacity:.32}
.iso${R_} .cam-grid{fill:none;stroke:var(--anatomy-paper);stroke-width:.5;opacity:.5}
.iso${R_} .cam-pointer{fill:none;stroke:var(--anatomy-hi);stroke-width:1.6;stroke-linecap:round}
.iso${R_} .cam-ticks{fill:none;stroke:var(--anatomy-hi);stroke-width:.9}
.iso${R_} .cam-bore{fill:var(--cam-cavity)}
.iso${R_} .cam-blades{fill:var(--anatomy-lo-side,#2a2a2d);stroke:none}
.iso${R_}[data-theme="light"] .cam-blades,html:not(.dark) .iso${R_} .cam-blades{fill:#55555b}
.iso${R_} .cam-blade-edge{fill:none;stroke:var(--anatomy-mid);stroke-width:.7}
.iso${R_} .cam-opening{fill:none;stroke:var(--anatomy-hi);stroke-width:.9;stroke-linejoin:round}
.iso${R_} .cam-glass{fill:color-mix(in srgb,#9ec5ff 10%,transparent);stroke:none;pointer-events:none}
.iso${R_} .cam-glint{fill:none;stroke:var(--anatomy-hi);stroke-width:1.2;stroke-linecap:round;opacity:.55}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:10px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script (plain ES module)
const liveSrc = `
const P = ${JSON.stringify(P)};
const NS = ${JSON.stringify(NS)}, TS = ${JSON.stringify(TS)};
const N0 = ${N0}, T0 = ${T0}, R_OPEN = ${R_OPEN}, IRIS_S = ${IRIS_S}, IRIS_R = ${IRIS_R}, BLADES = ${BLADES};
const LX = ${LX}, LZ = ${LZ}, FRONT = ${FRONT}, SENSOR_Y = ${SENSOR_Y}, SLAT = ${SLAT};
const C1_PARK = ${C1_PARK}, C2_PARK = ${C2_PARK}, COVER = ${COVER};
const RING = ${JSON.stringify(RING)}, DIAL = ${JSON.stringify(DIAL)}, STOP_STEP = ${STOP_STEP};
const F = ${JSON.stringify(F)};
const DIAL_FROM = ${DIAL_FROM}, DIAL_SPAN = ${DIAL_SPAN};
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const M = (p) => { const q = at(p); return f2(q[0]) + " " + f2(q[1]); };
const pointOf = ${pointOf.toString()};
const rOf = (N) => (R_OPEN * NS[0]) / N;
const tLabel = ${tLabel.toString()};
const evOf = ${evOf.toString()};
const dialAngle = ${dialAngle.toString()};
${dialPointer.toString()}
${ringTicks.toString()}
${iris.toString()}
${cone.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".cam-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const g = { iris: q("[data-cam-iris]"), ring: q("[data-cam-ring]"), cone: q("[data-cam-cone]"), dial: q("[data-cam-dial]"), c1: q('[data-cam-curtain="1"]'), c2: q('[data-cam-curtain="2"]'), sensor: q("[data-cam-sensor]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let ni = N0, ti = T0, logN = Math.log2(NS[N0]), touched = 0, frame = 0, last = 0, visible = false;
  let shot = null; // { t: seconds since the press, open: seconds the gate stays open }

  const text = () => "f/" + NS[ni] + " · " + tLabel(TS[ti]) + " · EV " + evOf(NS[ni], TS[ti]).toFixed(2);
  function draw() {
    const N = 2 ** logN;
    g.iris.innerHTML = iris(rOf(N));
    g.ring.innerHTML = ringTicks(N);
    g.cone.innerHTML = cone(rOf(N));
    g.dial.innerHTML = dialPointer(ti);
    // shutter (mirrorless, open at rest): the first curtain rises to close the
    // gate, then falls to expose; the second falls after t to end the
    // exposure, then rises back to its park. Each run takes 0.12 s.
    let z1 = C1_PARK, z2 = C2_PARK, lit = true;
    if (shot) {
      const run = 0.12, s = shot.t, open = shot.open;
      const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
      const up = ease(s / run), down = ease((s - run - 0.08) / run);
      z1 = C1_PARK + (COVER - C1_PARK) * (up - down);
      const t2 = s - run - 0.08 - open;
      const close = ease(t2 / run), back = ease((t2 - run - 0.25) / 0.3);
      z2 = C2_PARK + (COVER - C2_PARK) * (close - back);
      lit = s < run * 0.4 || (s > run + 0.08 + run * 0.4 && t2 < run * 0.6) || t2 > run + 0.25 + 0.3;
      shot.lit = s > run + 0.08 + run * 0.4 && t2 < run * 0.6;
    }
    g.c1.setAttribute("transform", translateAlong(P, [0, 0, z1 - C1_PARK]));
    g.c2.setAttribute("transform", translateAlong(P, [0, 0, z2 - C2_PARK]));
    root.toggleAttribute("data-exposing", !!shot?.lit);
    g.sensor.classList.toggle("is-dark", !lit);
    const t = text();
    if (readout.textContent !== t) readout.textContent = t;
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const target = Math.log2(NS[ni]);
    logN += (target - logN) * (1 - Math.exp(-dt * 12));
    if (Math.abs(target - logN) < 1e-3) logN = target;
    if (shot) { shot.t += dt; if (shot.t > shot.open + 0.12 * 3 + 0.08 + 0.6) shot = null; }
    // idle tour: walk the aperture through its stops when nobody touches it
    touched += dt;
    if (touched > 6 && !shot) { touched = 4.4; ni = ni >= NS.length - 1 ? 0 : ni + 1; }
    draw();
    frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
  const fire = () => {
    const t = TS[ti];
    shot = { t: 0, open: t >= 1 / 8 ? t : 0.12 + 0.05 * Math.log2(t * 1000) };
    if (still.matches) { shot = null; root.setAttribute("data-exposing", ""); setTimeout(() => root.removeAttribute("data-exposing"), 300); }
    run();
  };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") ni = Math.min(NS.length - 1, ni + 1);
    else if (event.key === "ArrowLeft") ni = Math.max(0, ni - 1);
    else if (event.key === "ArrowUp") ti = Math.max(0, ti - 1);
    else if (event.key === "ArrowDown") ti = Math.min(TS.length - 1, ti + 1);
    else if (event.key === " " || event.key === "Enter") { event.preventDefault(); fire(); return; }
    else return;
    event.preventDefault();
    touched = -1e9; // a person is driving: stop the tour
    if (still.matches) logN = Math.log2(NS[ni]);
    draw();
    run();
    say.textContent = text();
  });
  stage.addEventListener("click", () => { touched = -1e9; fire(); });
  root.addEventListener("optics-camera:set", (e) => {
    if (typeof e.detail?.n === "number") ni = Math.max(0, Math.min(NS.length - 1, e.detail.n));
    if (typeof e.detail?.t === "number") ti = Math.max(0, Math.min(TS.length - 1, e.detail.t));
    touched = -1e9;
    if (still.matches) logN = Math.log2(NS[ni]);
    draw(); run();
  });
  still.addEventListener?.("change", run);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  draw();
}

function start() { document.querySelectorAll('[data-anatomy="optics-camera"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/optics-camera/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, "optics-camera.html"), fragment + "\n");
writeFileSync(join(OUT, "optics-camera.css"), css);
writeFileSync(join(OUT, "optics-camera.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Camera cutaway</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`wrote optics-camera.* · f/8 at 1/125 s → EV ${evOf(8, 1 / 125).toFixed(3)} · iris r(f/8) = ${rOf(8).toFixed(2)}`);
