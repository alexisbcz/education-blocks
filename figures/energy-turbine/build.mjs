// Fig · Wind turbine nacelle, cover removed — a three-blade upwind rotor on
// a geared drivetrain at the top of its tower: hub and pitch bearings, main
// shaft in its bearing, gearbox, brake, coupling, generator, converter, yaw
// drives, and an anemometer and wind vane on the roof mast. The wind speed
// drives everything: rotor speed, blade pitch and power all come from one
// published empirical power-coefficient model.
// Run from the repo root: node figures/energy-turbine/build.mjs
// Writes site/static/anatomy/energy-turbine.{html,css,js} and the previews
// in figures/energy-turbine/. The shared iso.css is not touched: the CSS is
// the kit's, scoped under [data-anatomy="energy-turbine"].
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "/Users/alex/.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });
const NAME = "energy-turbine";

// ---------------------------------------------------------------- model
// A 3.5 MW turbine with a 100 m rotor. The power coefficient is the empirical
// Cp(λ, β) of Heier (Grid Integration of Wind Energy Conversion Systems,
// 1998), widely used in turbine-control studies: it peaks near 0.48 at a tip
// speed ratio of about 8.1 with the blades at 0° pitch, under the Betz
// limit of 16/27. Below rated wind the rotor tracks that best tip speed
// ratio; above it the speed is held and the blades pitch to shed power.
const RHO = 1.225; // kg/m³
const RADIUS = 50; // m
const AREA = Math.PI * RADIUS * RADIUS;
const P_RATED = 3.5e6; // W
const CUT_IN = 3, CUT_OUT = 25; // m/s
const GEAR = 100; // gearbox ratio
function cp(lambda, beta) {
  const li = 1 / (1 / (lambda + 0.08 * beta) - 0.035 / (beta ** 3 + 1));
  return Math.max(0, 0.5176 * (116 / li - 0.4 * beta - 5) * Math.exp(-21 / li) + 0.0068 * lambda);
}
const OPT = (() => { let best = [0, 0]; for (let l = 2; l <= 14; l += 0.001) { const c = cp(l, 0); if (c > best[1]) best = [l, c]; } return best; })();
const LAMBDA_OPT = OPT[0], CP_MAX = OPT[1];
const V_RATED = Math.cbrt(P_RATED / (0.5 * RHO * AREA * CP_MAX));
const OMEGA_RATED = (LAMBDA_OPT * V_RATED) / RADIUS; // rad/s
function turbine(v) {
  const wind = 0.5 * RHO * AREA * v ** 3;
  if (v >= CUT_OUT) return { v, wind, omega: 0, beta: 90, power: 0, cp: 0, state: "stopped (above cut-out)" };
  if (v < CUT_IN) {
    const omega = (0.5 * LAMBDA_OPT * v) / RADIUS;
    return { v, wind, omega, beta: 0, power: 0, cp: 0, state: "idling (below cut-in)" };
  }
  if (v <= V_RATED) return { v, wind, omega: (LAMBDA_OPT * v) / RADIUS, beta: 0, power: wind * CP_MAX, cp: CP_MAX, state: "tracking the best tip speed ratio" };
  // Above rated: hold the speed, pitch until the rotor makes rated power.
  const lambda = (OMEGA_RATED * RADIUS) / v;
  let lo = 0, hi = 45;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (cp(lambda, mid) * wind > P_RATED) lo = mid; else hi = mid; }
  return { v, wind, omega: OMEGA_RATED, beta: (lo + hi) / 2, power: P_RATED, cp: P_RATED / wind, state: "pitching to hold rated power" };
}

// ---------------------------------------------------------------- layout (world units, z up; the viewer is toward +x +y)
const WIDTH = 600, HEIGHT = 640;
const BASE = { x: -84, y: -70, w: 168, d: 140, r: 8 };
const BASE_H = 12;
const TOWER_R = 19, TOWER_TOP = 112;
const DECK = TOWER_TOP + 10; // top of the yaw bearing
const BED = { x: -112, y: -30, w: 200, d: 60, r: 4 };
const BED_H = 9;
const FLOOR = DECK + BED_H; // the bedplate's top
const SHAFT_Z = DECK + 9 + 29; // main-shaft axis height
const HS_Z = DECK + 9 + 15; // high-speed shaft axis (the gearbox steps it down)
const HUB = [124, 0, SHAFT_Z];
const HUB_R = 21;
const BLADE = { root: 18, bearing: 24, cylinder: 38, cut: 96, chord: 24, thick: 6 };
const GENR = 17;
const CAB = { x: -110, y: -26, w: 24, d: 52, r: 2 };
const CAB_H = 44;
const MAST = [-98, 0];
const MAST_TOP = FLOOR + CAB_H + 36;
const CUPS = [-98, -15], VANE = [-98, 15];
const AZ = 52;

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H, 0), [HUB[0] + 34, 0, SHAFT_Z + BLADE.cut + 8], [HUB[0], 0, SHAFT_Z - BLADE.cut - 8], [HUB[0], BLADE.cut + 8, SHAFT_Z], [HUB[0], -BLADE.cut - 8, SHAFT_Z], [-112, -30, MAST_TOP + 8], [-112, 30, MAST_TOP + 8]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: AZ },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const vertical = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const SHAFT = G.frameAlong([0, 0, SHAFT_Z], [1, 0, 0]); // s = x on the main shaft
const HS = G.frameAlong([0, 0, HS_Z], [1, 0, 0]); // s = x on the high-speed side

// ---------------------------------------------------------------- base
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H, BASE_H, P)}"/>`];
  out.push(S_(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "lo", inner: L(k.sideSeam(BASE, -5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "faint" }));
  const bolts = k.corners(BASE, 13);
  out.push(L(bolts.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(bolts.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  const label = { x: 30, y: 44, w: 44, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([30, 18, 26].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- tower
function tower() {
  const out = [];
  // foot flange bolted to the stand
  out.push(S_(k.cylinder(0, 0, TOWER_R + 9, 0, 4, P, 64, 0.4), { tone: "mid" }));
  out.push(Dots(G.dotsOf(vertical(0, 0), 4, TOWER_R + 5.5, 16, P, { all: true }), { size: 0.45, tone: "lo" }));
  // the tower section, with its welded can seams and a door frame
  out.push(S_(k.cylinder(0, 0, TOWER_R, 4, TOWER_TOP - 4, P, 64), { tone: "mid", inner: L(k.sideArc(0, 0, TOWER_R, TOWER_TOP * 0.36, P, 64) + k.sideArc(0, 0, TOWER_R, TOWER_TOP * 0.72, P, 64), { tone: "faint" }) }));
  // top flange with its bolt circle, then the yaw bearing
  out.push(S_(k.cylinder(0, 0, TOWER_R + 6, TOWER_TOP, 4, P, 64, 0.4), { tone: "mid" }));
  out.push(Dots(G.dotsOf(vertical(0, 0), TOWER_TOP + 4, TOWER_R + 3.5, 20, P, { all: true }), { size: 0.4, tone: "lo" }));
  out.push(S_(k.cylinder(0, 0, TOWER_R + 4, TOWER_TOP + 4, DECK - TOWER_TOP - 4, P, 64, 0.3), { tone: "mid", inner: L(k.sideArc(0, 0, TOWER_R + 4, TOWER_TOP + 7, P, 64), { tone: "faint" }) }));
  return out.join("");
}

// ---------------------------------------------------------------- nacelle structure
function bedplate() {
  const out = [S_(k.slabOf(BED, DECK, BED_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BED, DECK + 4.5, P, 4), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(BED, 3), FLOOR, P, 4), { tone: "faint" }));
  out.push(Dots(k.corners(BED, 5).map(([x, y]) => at([x, y, FLOOR])), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// Two yaw drives standing on the bedplate beside the tower axis: a motor on
// a planetary gearbox each, pinions down through the deck to the yaw ring.
function yawDrive([x, y]) {
  const out = [S_(k.cylinder(x, y, 6, FLOOR, 7, P, 32, 0.3), { tone: "mid", inner: L(k.sideArc(x, y, 6, FLOOR + 3.5, P, 32), { tone: "faint" }) })];
  out.push(Dots(G.dotsOf(vertical(x, y), FLOOR + 7, 4.8, 6, P, { all: true }), { size: 0.35, tone: "lo" }));
  out.push(S_(k.cylinder(x, y, 4.6, FLOOR + 7, 14, P, 28, 0.3), { tone: "mid", inner: L(k.knurl(x, y, 4.6, FLOOR + 7, FLOOR + 21, 14, P), { tone: "faint" }) }));
  out.push(S_(k.cylinder(x, y, 2.6, FLOOR + 21, 2, P, 20), { tone: "mid" }));
  return out.join("");
}

// The main bearing: a pillow block bolted to the bedplate, the shaft through it.
function mainBearing() {
  const block = { x: 52, y: -17, w: 26, d: 34, r: 2 };
  const out = [S_(k.slabOf(block, FLOOR, SHAFT_Z - FLOOR - 4, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(block, FLOOR + 6, P, 3), { tone: "faint" }) })];
  out.push(Dots(k.corners(block, 3.4).map(([x, y]) => at([x, y, SHAFT_Z - 4])), { size: 0.45, tone: "lo" }));
  out.push(S_(G.disc(54, 76, 15, SHAFT, P, { bevel: 0.5 }), { tone: "mid", inner: L(G.arcOf(SHAFT, 60, 15, P) + G.arcOf(SHAFT, 70, 15, P), { tone: "faint" }) }));
  return out.join("");
}

function mainShaft() {
  const out = [S_(G.disc(30, 54, 9.5, SHAFT, P), { tone: "mid" })];
  out.push(S_(G.disc(76, 104, 9.5, SHAFT, P), { tone: "mid" }));
  // the shrink disc that locks the shaft into the gearbox's hollow input
  out.push(S_(G.disc(26, 34, 14, SHAFT, P, { bevel: 0.4 }), { tone: "mid" }));
  out.push(Dots(G.dotsOf(SHAFT, 34, 11.6, 12, P, { all: true }), { size: 0.35, tone: "lo" }));
  // hub flange
  out.push(S_(G.disc(100, 106, 17, SHAFT, P, { bevel: 0.4 }), { tone: "mid" }));
  out.push(Dots(G.dotsOf(SHAFT, 106, 14.4, 12, P, { all: true }), { size: 0.4, tone: "lo" }));
  return out.join("");
}

// The gearbox: a cast housing with its seam, torque arms each side on
// rubber mounts, an oil filler and a breather on top.
function gearbox() {
  const box = { x: -12, y: -25, w: 38, d: 50, r: 7 };
  const top = SHAFT_Z + 22;
  const out = [S_(k.slabOf(box, FLOOR, top - FLOOR, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(box, SHAFT_Z, P, 6) + k.sideSeam(box, FLOOR + 8, P, 6), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(box, 3.4), top, P, 6), { tone: "faint" }));
  out.push(Dots(k.corners(box, 4.2).map(([x, y]) => at([x, y, top])), { size: 0.45, tone: "lo" }));
  for (const side of [-1, 1]) {
    const arm = { x: 0, y: side > 0 ? 25 : -33, w: 14, d: 8, r: 1.2 };
    out.push(S_(k.slabOf(arm, SHAFT_Z - 10, 8, P, 2, 0.3), { tone: "mid" }));
    out.push(S_(k.cylinder(7, side * 29, 3.2, FLOOR, SHAFT_Z - 10 - FLOOR, P, 20), { tone: "mid", inner: L(k.sideArc(7, side * 29, 3.2, FLOOR + 6, P, 20), { tone: "faint" }) }));
  }
  out.push(S_(k.cylinder(6, -8, 4, top, 3, P, 24, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(6, -8, 2.4, top + 3, 3.4, P, 20), { tone: "mid", inner: L(k.knurl(6, -8, 2.4, top + 3.6, top + 6, 10, P), { tone: "faint" }) }));
  out.push(S_(k.cylinder(14, 12, 1.8, top, 5, P, 16), { tone: "mid" }));
  return out.join("");
}

// High-speed side: shaft, brake disc with its caliper, flexible coupling.
function highSpeed() {
  const out = [S_(G.disc(-30, -12, 3.6, HS, P), { tone: "mid" })];
  out.push(S_(G.disc(-21, -18.6, 12, HS, P, { bevel: 0.3 }), { tone: "mid" }));
  const cal = { x: -23, y: -6, w: 7, d: 12, r: 1 };
  out.push(S_(k.slabOf(cal, HS_Z + 9, 7, P, 2, 0.3), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: -23, y: -5, w: 7, d: 10, r: 1 }, FLOOR, HS_Z + 9 - FLOOR, P, 2), { tone: "mid" }));
  out.push(S_(G.disc(-36, -30, 7.5, HS, P, { bevel: 0.4 }), { tone: "mid" }));
  out.push(S_(G.disc(-40, -36, 5, HS, P), { tone: "mid" }));
  out.push(S_(G.disc(-46, -40, 7.5, HS, P, { bevel: 0.4 }), { tone: "mid" }));
  return out.join("");
}

// The generator: a ribbed cylindrical frame on two feet, a terminal box on top.
function generator() {
  const out = [];
  for (const x of [-54, -84]) out.push(S_(k.slabOf({ x: x - 4, y: -14, w: 8, d: 28, r: 1 }, FLOOR, HS_Z - GENR - FLOOR + 3, P, 2, 0.3), { tone: "mid" }));
  const ribs = [-52, -58, -64, -70, -76, -82].map((s) => G.arcOf(HS, s, GENR, P)).join("");
  out.push(S_(G.disc(-90, -48, GENR, HS, P, { bevel: 0.6 }), { tone: "mid", inner: L(ribs, { tone: "faint" }) }));
  out.push(Dots(G.dotsOf(HS, -48, GENR - 3, 10, P, { all: true }), { size: 0.35, tone: "lo" }));
  const tb = { x: -76, y: -8, w: 14, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(tb, HS_Z + GENR - 2, 8, P, 2, 0.3), { tone: "mid" }));
  out.push(Dots(k.corners(tb, 2).map(([x, y]) => at([x, y, HS_Z + GENR + 6])), { size: 0.35, tone: "lo" }));
  return out.join("");
}

// The converter cabinet at the back, with vent slots, and the roof mast.
function cabinet() {
  const out = [S_(k.slabOf(CAB, FLOOR, CAB_H, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(CAB, FLOOR + CAB_H - 6, P, 2), { tone: "faint" }) })];
  // vents: closed slots on the front face
  const slots = [];
  const fx = CAB.x + CAB.w;
  for (let z = FLOOR + 10; z < FLOOR + CAB_H - 12; z += 5) {
    const q = [[fx, -14, z], [fx, 14, z], [fx, 14, z + 1.4], [fx, -14, z + 1.4]].map(at);
    slots.push("M" + q.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L") + "Z");
  }
  out.push(L(slots.join(""), { tone: "faint" }));
  out.push(Dots(k.corners(CAB, 2.4).map(([x, y]) => at([x, y, FLOOR + CAB_H])), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function mast() {
  const top = FLOOR + CAB_H;
  const out = [S_(k.cylinder(MAST[0], MAST[1], 3.4, top, 2, P, 20), { tone: "mid" })];
  out.push(S_(k.cylinder(MAST[0], MAST[1], 1.6, top + 2, MAST_TOP - top - 2, P, 14), { tone: "mid" }));
  // crossbar along y with a sensor at each end
  const bar = G.frameAlong([MAST[0], -16, MAST_TOP], [0, 1, 0]);
  out.push(S_(G.disc(0, 32, 1.4, bar, P), { tone: "mid" }));
  out.push(S_(G.sphereOf([MAST[0], MAST[1], MAST_TOP], 2.6, P), { tone: "mid" }));
  for (const [x, y] of [CUPS, VANE]) out.push(S_(k.cylinder(x, y, 1.6, MAST_TOP - 1, 6, P, 14), { tone: "mid" }));
  return out.join("");
}

// The power cable: from the converter cabinet down the deck into the tower.
function cable() {
  const pts = [[-96, 26, FLOOR + 8], [-96, 32, FLOOR + 8], [-96, 32, DECK + 2], [-12, 32, DECK + 2], [-12, 22.4, DECK + 2]];
  const s = pts.map(at);
  return k.wireSvg(s[0], s[s.length - 1], { via: s.slice(1, -1), tone: "lo", ends: "both", size: 1.1 });
}

// ---------------------------------------------------------------- rotor (static parts)
function hubBody() {
  return S_(G.sphereOf(HUB, HUB_R, P), { tone: "hi", lit: true });
}
// The spinner: a nose cone over the hub, pointing into the wind (+x).
const NOSE = (s) => HUB_R * 1.02 * Math.sqrt(Math.max(0, 1 - ((s - 4) / 30) ** 2));
const NOSE_SLOPE = (s) => { const t = (s - 4) / 30; return (-HUB_R * 1.02 * t) / (30 * Math.sqrt(Math.max(1e-6, 1 - t * t))); };
const NOSE_F = G.frameAlong(HUB, [1, 0, 0]);
function spinner() {
  const knots = [];
  for (let s = 4; s <= 34 + 1e-9; s += 1.5) knots.push([s, NOSE(s), 1]);
  return S_(G.solidOf(knots, NOSE_F, P, { smooth: { slope: NOSE_SLOPE, radius: NOSE } }), { tone: "hi", lit: true });
}

// ---------------------------------------------------------------- moving parts (rebuilt each frame)
// One blade at rotor angle phi and pitch beta (degrees): pitch bearing and
// root cylinder on the hub, then the blade cut away at BLADE.cut to show its
// section. The chord lies in the rotor plane at 0° pitch and turns toward
// the wind as the pitch rises (90° = feathered).
function bladeParts(phi, beta) {
  const radial = [0, Math.cos(phi), Math.sin(phi)];
  const tangent = [0, -Math.sin(phi), Math.cos(phi)];
  const b = (beta * Math.PI) / 180;
  const chord = [Math.sin(b), tangent[1] * Math.cos(b), tangent[2] * Math.cos(b)];
  const thick = [chord[1] * radial[2] - chord[2] * radial[1], chord[2] * radial[0] - chord[0] * radial[2], chord[0] * radial[1] - chord[1] * radial[0]];
  const F = G.frameOf(HUB, radial, chord, thick);
  const R0 = G.frameAlong(HUB, radial);
  // a cambered section: rounded leading edge, sharp trailing edge
  const foil = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = BLADE.chord * (0.3 - t);
    const y = BLADE.thick * 0.5 * (2.9 * Math.sqrt(t) - 1.2 * t - 3.5 * t * t + 2.8 * t ** 3 - 1 * t ** 4);
    foil.push([x, y + 1.2 * Math.sin(Math.PI * t)]);
  }
  for (let i = n - 1; i > 0; i--) {
    const t = i / n, x = BLADE.chord * (0.3 - t);
    const y = BLADE.thick * 0.5 * (2.9 * Math.sqrt(t) - 1.2 * t - 3.5 * t * t + 2.8 * t ** 3 - 1 * t ** 4);
    foil.push([x, -y + 1.2 * Math.sin(Math.PI * t)]);
  }
  return {
    mid: [HUB[0], HUB[1] + radial[1] * 60, HUB[2] + radial[2] * 60],
    svg: [
      S_(G.disc(BLADE.root, BLADE.bearing, 10.5, R0, P, { bevel: 0.4 }), { tone: "mid" }),
      Dots(G.dotsOf(R0, BLADE.bearing, 9, 10, P, { all: true }), { size: 0.35, tone: "lo" }),
      S_(G.disc(BLADE.bearing, BLADE.cylinder, 8, R0, P), { tone: "mid" }),
      S_(G.prismOf(F, foil, BLADE.cylinder, BLADE.cut, P), { tone: "mid" }),
    ].join(""),
  };
}

// The rotor: blades behind the hub's centre are drawn before it, the others
// after it, and the spinner last. Bolt heads on the hub flange turn with it.
function rotor(angle, beta) {
  const depth = (p) => depthOf(p, P);
  const hubDepth = depth(HUB);
  const blades = [0, 1, 2].map((i) => bladeParts(angle + (i * 2 * Math.PI) / 3, beta));
  blades.sort((a, b) => depth(a.mid) - depth(b.mid));
  const back = blades.filter((b) => depth(b.mid) <= hubDepth).map((b) => b.svg).join("");
  const front = blades.filter((b) => depth(b.mid) > hubDepth).map((b) => b.svg).join("");
  return { back, front };
}

function spinnerMarks(angle) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * 2 * Math.PI) / 3 + Math.PI / 3;
    const p = G.pointOf(NOSE_F, 22, NOSE(22), a);
    const c = iso(p, P);
    const facing = view[0] * (p[0] - HUB[0] - 22) + view[1] * (p[1] - HUB[1]) + view[2] * (p[2] - HUB[2]);
    if (facing > 0) out.push(`<circle class="et-bolt" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="0.9"/>`);
  }
  return out.join("");
}

// A painted index stripe on the coupling: it turns with the generator.
function couplingMark(angle) {
  const p0 = G.pointOf(HS, -36, 5.6, angle), p1 = G.pointOf(HS, -36, 7.4, angle);
  const facing = (p1[1] - 0) * view[1] + (p1[2] - HS_Z) * view[2] - 0.0;
  return facing > 0 ? `<path class="et-mark" d="M${iso(p0, P).map((v) => v.toFixed(2)).join(" ")}L${iso(p1, P).map((v) => v.toFixed(2)).join(" ")}"/>` : "";
}

// The cup anemometer: three arms and cups turning about a vertical axis.
function cups(angle) {
  const [x, y] = CUPS;
  const z = MAST_TOP + 6;
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * 2 * Math.PI) / 3;
    const tip = [x + Math.cos(a) * 8, y + Math.sin(a) * 8, z];
    parts.push({ a, tip, d: tip[0] * view[0] + tip[1] * view[1] });
  }
  parts.sort((p, q) => p.d - q.d);
  const hub = iso([x, y, z], P);
  const out = [];
  for (const { tip } of parts) {
    const t = iso(tip, P);
    out.push(`<path class="et-arm" d="M${hub[0].toFixed(2)} ${hub[1].toFixed(2)}L${t[0].toFixed(2)} ${t[1].toFixed(2)}"/>`);
    out.push(`<circle class="et-cup" cx="${t[0].toFixed(2)}" cy="${t[1].toFixed(2)}" r="2.2"/>`);
  }
  out.push(`<circle class="et-cap" cx="${hub[0].toFixed(2)}" cy="${hub[1].toFixed(2)}" r="1.4"/>`);
  return out.join("");
}

// The wind vane: a tail fin pointing downwind (−x), with a counterweight.
function vane() {
  const [x, y] = VANE;
  const z = MAST_TOP + 6;
  const a = iso([x + 6, y, z], P), b = iso([x - 9, y, z], P);
  const f0 = iso([x - 6, y, z - 3], P), f1 = iso([x - 12, y, z - 3], P), f2 = iso([x - 12, y, z + 4], P), f3 = iso([x - 8, y, z + 4], P);
  return `<path class="et-arm" d="M${a.map((v) => v.toFixed(2)).join(" ")}L${b.map((v) => v.toFixed(2)).join(" ")}"/><path class="et-fin" d="M${[f0, f1, f2, f3].map((p) => p.map((v) => v.toFixed(2)).join(" ")).join("L")}Z"/><circle class="et-cup" cx="${a[0].toFixed(2)}" cy="${a[1].toFixed(2)}" r="1.6"/>`;
}

const iso = k.iso;
const depthOf = k.depthOf;
const view = G.viewOf(P);

// ---------------------------------------------------------------- assemble
const V0 = 9;
const T0 = turbine(V0);
const A0 = 0.35;
const R0 = rotor(A0, T0.beta);
const LABEL =
  "A wind turbine nacelle with its cover removed, at the top of a tower section on a display stand. At the front, the hub and spinner carry three blades on pitch bearings, cut away near the root to show their airfoil section. The main shaft runs back through a main bearing into the gearbox, which steps the speed up a hundred times to a high-speed shaft with a brake disc, a flexible coupling and the generator. A converter cabinet stands at the back, with a mast on its roof carrying a cup anemometer and a wind vane. Two yaw drives stand on the bedplate over the yaw bearing, and the power cable runs down into the tower.";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    base(),
    tower(),
    bedplate(),
    cable(),
    yawDrive([-30, -18]),
    yawDrive([-30, 18]),
    cabinet(),
    mast(),
    `<g data-et-cups>${cups(0)}</g>`,
    vane(),
    generator(),
    highSpeed(),
    `<g data-et-coupling>${couplingMark(0)}</g>`,
    gearbox(),
    mainShaft(),
    mainBearing(),
    `<g data-et-back>${R0.back}</g>`,
    hubBody(),
    `<g data-et-front>${R0.front}</g>`,
    spinner(),
    `<g data-et-marks>${spinnerMarks(A0)}</g>`,
  ],
});

const fmt = (v, d) => v.toFixed(d);
const readoutOf = (v) => {
  const t = turbine(v);
  const rpm = (t.omega * 60) / (2 * Math.PI);
  return `${fmt(v, 1)} m/s · ${fmt(rpm, 1)} rpm · pitch ${fmt(t.beta, 1)}° · ${fmt(t.power / 1e6, 2)} MW · Cp ${fmt(t.cp, 2)}`;
};

const stage = `<div class="iso-stage et-stage" tabindex="0" role="group" aria-roledescription="wind turbine nacelle" aria-label="Wind turbine nacelle. Left and Right arrows change the wind speed; Space pauses the tour.">${svg}<span class="et-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Wind turbine nacelle",
  hint: "← → wind speed · space pause",
  readout: readoutOf(V0),
  keys: [
    { mark: "lit", label: "Hub and spinner: the rotor, 100 m across at full scale" },
    { mark: "raised", label: "Blades cut away near the root: watch the section pitch above rated wind" },
    { mark: "dim", label: `Gearbox 1:${GEAR}: the generator turns ${GEAR}× faster (drawn slower)` },
  ],
  caption: `Rotor power is P = ½ρAv³·Cp with ρ = ${RHO} kg/m³ and A = π·(${RADIUS} m)². Cp(λ, β) is Heier's empirical model: it peaks at ${fmt(CP_MAX, 3)} at a tip speed ratio λ = ${fmt(LAMBDA_OPT, 2)}, below the Betz limit 16/27 ≈ 0.593. From cut-in (${CUT_IN} m/s) to rated wind (${fmt(V_RATED, 1)} m/s) the rotor speed follows the wind to hold that λ; above rated it is held at ${fmt((OMEGA_RATED * 60) / (2 * Math.PI), 1)} rpm and the blades pitch to keep the power at ${P_RATED / 1e6} MW; above cut-out (${CUT_OUT} m/s) they feather and the rotor stops. Generator and converter losses are ignored: the power shown is what the rotor takes from the wind.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="${NAME}">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="energy-turbine"]
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
const R_ = `[data-anatomy="${NAME}"]`;
const FIGURE_CSS = `
.iso${R_}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso${R_}[data-theme="light"],html:not(.dark) .iso${R_}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso${R_} .iso-figure{margin:0}
.iso${R_} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R_} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .et-stage{position:relative;outline:none;cursor:default}
.iso${R_} .et-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .et-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .et-arm{fill:none;stroke:var(--anatomy-mid);stroke-width:1.1;stroke-linecap:round}
.iso${R_} .et-cup{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:1}
.iso${R_} .et-cap{fill:var(--anatomy-mid)}
.iso${R_} .et-fin{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:1;stroke-linejoin:round}
.iso${R_} .et-mark{fill:none;stroke:var(--anatomy-lit);stroke-width:1.4;stroke-linecap:round}
.iso${R_} .et-bolt{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:.6}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 64px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:10px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
// lathe.mjs ships inside a closure: its one import (cameraOf, iso, pathOf)
// is satisfied by the inlined kit, and its names cannot clash with the kit's.
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameAlong, frameOf, disc, dotsOf, prismOf, pointOf }; })();
const P = ${JSON.stringify(P)};
const view = ${JSON.stringify(view)};
const RHO = ${RHO}, RADIUS = ${RADIUS}, AREA = ${AREA}, P_RATED = ${P_RATED}, CUT_IN = ${CUT_IN}, CUT_OUT = ${CUT_OUT}, GEAR = ${GEAR};
const LAMBDA_OPT = ${LAMBDA_OPT}, CP_MAX = ${CP_MAX}, V_RATED = ${V_RATED}, OMEGA_RATED = ${OMEGA_RATED};
const HUB = ${JSON.stringify(HUB)}, HUB_R = ${HUB_R}, BLADE = ${JSON.stringify(BLADE)}, HS_Z = ${HS_Z}, CUPS = ${JSON.stringify(CUPS)}, MAST_TOP = ${MAST_TOP};
const S_ = (paths, style) => solidSvg(paths, style);
const Dots = (points, style) => dotsSvg(points, style);
const HS = G.frameAlong([0, 0, HS_Z], [1, 0, 0]);
const NOSE = ${NOSE.toString()};
const NOSE_F = G.frameAlong(HUB, [1, 0, 0]);
${cp.toString()}
${turbine.toString()}
${bladeParts.toString()}
${rotor.toString()}
${spinnerMarks.toString()}
${couplingMark.toString()}
${cups.toString()}
const fmt = (v, d) => v.toFixed(d);
const readoutOf = ${readoutOf.toString()};

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".et-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const g = { back: q("[data-et-back]"), front: q("[data-et-front]"), marks: q("[data-et-marks]"), cups: q("[data-et-cups]"), coupling: q("[data-et-coupling]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  // An idle tour through the operating regions; the arrows take over.
  const TOUR = [9, 6, 11, 14, 20, 26, 4];
  let target = ${V0}, shown = target, step = 0, hold = 0, manual = 0;
  let angle = ${A0}, beta = turbine(target).beta, cupAngle = 0, genAngle = 0;
  let paused = false, frame = 0, last = 0, visible = false;

  function draw() {
    const r = rotor(angle, beta);
    g.back.innerHTML = r.back;
    g.front.innerHTML = r.front;
    g.marks.innerHTML = spinnerMarks(angle);
    g.cups.innerHTML = cups(cupAngle);
    g.coupling.innerHTML = couplingMark(genAngle);
    const text = readoutOf(shown);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && now > manual) {
      hold += dt;
      if (hold > 4) { hold = 0; step = (step + 1) % TOUR.length; target = TOUR[step]; }
    }
    // The wind eases toward the target; the pitch follows the controller.
    shown += (target - shown) * (1 - Math.exp(-dt / 0.8));
    const t = turbine(shown);
    beta += (t.beta - beta) * (1 - Math.exp(-dt / 0.6));
    if (!paused) {
      angle -= t.omega * dt; // turning clockwise seen from upwind
      genAngle -= t.omega * dt * 6; // the generator really turns ${GEAR}x faster
      cupAngle += shown * dt * 0.35;
    }
    draw();
    frame = visible && !paused ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    const d = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") target = Math.min(30, Math.round(target) + d);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") target = Math.max(0, Math.round(target) - d);
    else if (event.key === " ") { paused = !paused; run(); event.preventDefault(); return; }
    else return;
    event.preventDefault();
    manual = performance.now() + 8000;
    say.textContent = readoutOf(target);
    if (still.matches) { shown = target; beta = turbine(target).beta; draw(); }
    run();
  });
  stage.addEventListener("click", () => { paused = !paused; run(); });
  still.addEventListener?.("change", run);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  draw();
}

function start() { document.querySelectorAll('[data-anatomy="${NAME}"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;
const js = `// Generated by figures/${NAME}/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime and lathe kit (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, `${NAME}.html`), fragment + "\n");
writeFileSync(join(OUT, `${NAME}.css`), css);
writeFileSync(join(OUT, `${NAME}.js`), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wind turbine nacelle</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
const t10 = turbine(10);
console.log(`wrote ${NAME}.* · λopt ${LAMBDA_OPT.toFixed(2)} · Cp max ${CP_MAX.toFixed(4)} · v rated ${V_RATED.toFixed(2)} m/s · rated ${(OMEGA_RATED * 60 / (2 * Math.PI)).toFixed(2)} rpm · 10 m/s: ${(t10.power / 1e6).toFixed(3)} MW · 18 m/s pitch ${turbine(18).beta.toFixed(2)}°`);
