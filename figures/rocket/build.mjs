// Fig · Rocket engine test stand — a liquid-propellant engine hanging nozzle
// down from a load cell, with its turbopump, feed line and gas-generator
// exhaust, and an instrument console that reads chamber pressure and thrust.
// Run from the repo root: node figures/rocket/build.mjs
// Writes site/static/anatomy/{rocket.html, rocket.css, rocket.js} and
// figures/rocket/preview{,-light}.html. The shared iso.css is not touched:
// rocket.css carries the kit CSS scoped under [data-anatomy="rocket"].
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
// World units are centimetres. The drawn nozzle IS the engine: throat radius
// 5.35 cm, exit radius 21.4 cm, so the area ratio is 16. Thrust comes from
// the ideal-rocket thrust coefficient with γ = 1.2, c* = 1780 m/s (kerosene
// and liquid oxygen, approximate), sea-level ambient pressure.
const GAMMA = 1.2;
const CSTAR = 1780; // m/s
const PA = 101325; // Pa, sea level
const PC_MAX = 7e6; // Pa at 100 % throttle
const G0 = 9.80665;
const RT = 5.35, RE = 21.4; // cm
const AT = Math.PI * (RT / 100) ** 2; // m²
const EPS = (RE / RT) ** 2;
const areaMach = (M) => (1 / M) * Math.pow((2 / (GAMMA + 1)) * (1 + ((GAMMA - 1) / 2) * M * M), (GAMMA + 1) / (2 * (GAMMA - 1)));
const ME = (() => { let lo = 1.0001, hi = 12; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (areaMach(m) > EPS) hi = m; else lo = m; } return lo; })();
const PRATIO = Math.pow(1 + ((GAMMA - 1) / 2) * ME * ME, -GAMMA / (GAMMA - 1)); // pe / pc
const CF_MOMENTUM = Math.sqrt(((2 * GAMMA * GAMMA) / (GAMMA - 1)) * Math.pow(2 / (GAMMA + 1), (GAMMA + 1) / (GAMMA - 1)) * (1 - Math.pow(PRATIO, (GAMMA - 1) / GAMMA)));
function engine(throttle) {
  const pc = PC_MAX * throttle;
  const pe = PRATIO * pc;
  const cf = CF_MOMENTUM + ((pe - PA) / pc) * EPS;
  const thrust = cf * pc * AT; // N
  const mdot = (pc * AT) / CSTAR; // kg/s
  return { pc, pe, cf, thrust, mdot, isp: thrust / (mdot * G0), sep: pe / PA };
}

// ---------------------------------------------------------------- layout (cm, z up; the viewer is toward +x +y)
const WIDTH = 600;
const HEIGHT = 640;
const PAD = { x: -122, y: -98, w: 244, d: 206, r: 8 };
const PAD_H = 14;
const POSTS = [[-66, -80], [66, -80]];
const POST_TOP = 346;
const BEAM_Z = 346, BEAM_H = 14;
const ARM = { x: -7, y: -74, w: 14, d: 82, r: 1.2 };
const NOZZLE_S0 = 120, THROAT_S = 212, CHAMBER_S = 236, CHAMBER_TOP = 296;
const PUMP = [32, -14];
const FEED_X = 32, FEED_Z = 242, FEED_RISER_Y = -82;
const EXH = [49, -14];
const CONSOLE = { x: -116, y: 22, w: 68, d: 54, r: 3 };
const CONSOLE_H = 40;
const DIALS = { pc: [-99, 42], thrust: [-68, 42] };
const DIAL_R = 12;
const KNOB = [-57, 67];
const DIAL_FROM = (-3 * Math.PI) / 4, DIAL_SPAN = (3 * Math.PI) / 2;
const PC_FULL = 10e6, F_FULL = 120e3; // dial full scale

const P = k.fitProjection(
  [...k.boxCorners(PAD, -PAD_H, 0), [-72, -86, BEAM_Z + BEAM_H], [72, -86, BEAM_Z + BEAM_H], [0, 8, BEAM_Z + BEAM_H], [-6, -6, 12]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 40 },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const V = k.towardViewer(P);
const ENG = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]); // s = z on the engine axis
const vertical = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const PF = vertical(...PUMP);

// The nozzle contour: a hyperbolic converging section, then a bell whose
// slope eases off toward the exit. One analytic radius and slope, so the
// shading runs as clean curves.
const AC = Math.sqrt(15.5 ** 2 - RT ** 2) / (CHAMBER_S - THROAT_S);
const ALPHA = 0.36, DD = THROAT_S - NOZZLE_S0;
const BETA = (Math.sqrt(RT ** 2 + (ALPHA * DD) ** 2) - RE) / (DD * DD);
function nozzleR(s) {
  if (s >= THROAT_S) return Math.sqrt(RT * RT + (AC * (s - THROAT_S)) ** 2);
  const d = THROAT_S - s;
  return Math.sqrt(RT * RT + (ALPHA * d) ** 2) - BETA * d * d;
}
function nozzleSlope(s) {
  if (s >= THROAT_S) { const x = s - THROAT_S; return (AC * AC * x) / Math.sqrt(RT * RT + (AC * x) ** 2); }
  const d = THROAT_S - s;
  return -((ALPHA * ALPHA * d) / Math.sqrt(RT * RT + (ALPHA * d) ** 2) - 2 * BETA * d);
}
const DOME_R = 17, DOME_S0 = 300, DOME_S1 = 318;
const domeR = (s) => DOME_R * Math.sqrt(Math.max(0, 1 - ((s - DOME_S0) / 19) ** 2));
const domeSlope = (s) => { const t = (s - DOME_S0) / 19; return (-DOME_R * t) / (19 * Math.sqrt(Math.max(1e-6, 1 - t * t))); };

// ---------------------------------------------------------------- base
function pad() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PAD, -PAD_H, PAD_H, P)}"/>`];
  out.push(S_(k.slabOf(PAD, -PAD_H, PAD_H, P, 8, 1.4), { tone: "lo", inner: L(k.sideSeam(PAD, -6, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PAD, 6), 0, P), { tone: "faint" }));
  const bolts = k.corners(PAD, 13);
  out.push(L(bolts.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(bolts.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // label plate, front right
  const label = { x: 58, y: 80, w: 48, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([30, 20, 34].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

// The flame deflector: a steel plate on the pad, ribbed edge to edge.
function deflector() {
  const plate = { x: -40, y: -36, w: 80, d: 72, r: 3 };
  const out = [S_(k.slabOf(plate, 0, 5, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plate, 2.5, P, 4), { tone: "faint" }) })];
  const ribs = [];
  for (let x = plate.x + 8; x < plate.x + plate.w - 4; x += 8) ribs.push(k.lineOnTop([x, plate.y + 0.6], [x, plate.y + plate.d - 0.6], 5, P));
  out.push(L(ribs.join(""), { tone: "faint" }));
  const bolts = k.corners(plate, 4);
  out.push(Dots(bolts.map(([x, y]) => at([x, y, 5])), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- structure
function post([x, y]) {
  const base = { x: x - 9, y: y - 9, w: 18, d: 18, r: 1 };
  const out = [S_(k.slabOf(base, 0, 2.2, P, 3, 0.4), { tone: "mid" })];
  out.push(Dots(k.corners(base, 2.6).map(([bx, by]) => at([bx, by, 2.2])), { size: 0.45, tone: "lo" }));
  const col = { x: x - 6, y: y - 6, w: 12, d: 12, r: 1 };
  out.push(S_(k.slabOf(col, 2.2, POST_TOP - 2.2, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(col, 120, P, 3) + k.sideSeam(col, 240, P, 3), { tone: "faint" }) }));
  return out.join("");
}

function crossbeam() {
  const beam = { x: -72, y: -86, w: 144, d: 12, r: 1 };
  const out = [S_(k.slabOf(beam, BEAM_Z, BEAM_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(beam, BEAM_Z + 7, P, 3), { tone: "faint" }) })];
  out.push(Dots([[-66, -80], [66, -80]].flatMap(([x, y]) => [at([x - 3, y - 3, BEAM_Z + BEAM_H]), at([x + 3, y + 3, BEAM_Z + BEAM_H])]), { size: 0.45, tone: "lo" }));
  return out.join("");
}

function arm() {
  const out = [S_(k.slabOf(ARM, BEAM_Z, BEAM_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(ARM, BEAM_Z + 7, P, 3), { tone: "faint" }) })];
  out.push(Dots([[-3, -68], [3, -68], [-3, -62], [3, -62], [-3, -4], [3, -4], [-3, 4], [3, 4]].map(([x, y]) => at([x, y, BEAM_Z + BEAM_H])), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- feed line (behind the engine)
function feed() {
  const out = [];
  const riserTop = FEED_Z - 4.2;
  out.push(S_(k.cylinder(FEED_X, FEED_RISER_Y, 6, 0, 2, P, 28, 0.3), { tone: "mid" }));
  out.push(Dots(G.dotsOf(vertical(FEED_X, FEED_RISER_Y), 2, 4.6, 4, P, { all: true }), { size: 0.4, tone: "lo" }));
  out.push(S_(k.cylinder(FEED_X, FEED_RISER_Y, 3.4, 2, riserTop - 2, P, 24), { tone: "mid", inner: L(k.sideArc(FEED_X, FEED_RISER_Y, 3.4, 120, P, 24), { tone: "faint" }) }));
  // elbow, then the horizontal run toward the pump with the main valve on it
  out.push(S_(G.sphereOf([FEED_X, FEED_RISER_Y, FEED_Z], 4.4, P), { tone: "mid" }));
  const run = G.frameAlong([FEED_X, FEED_RISER_Y, FEED_Z], [0, 1, 0]);
  const VALVE = -48 - FEED_RISER_Y; // s of the valve centre
  out.push(S_(G.disc(4.2, VALVE - 6, 3.4, run, P), { tone: "mid" }));
  out.push(S_(G.disc(VALVE - 7.2, VALVE - 5.4, 5, run, P), { tone: "mid" }));
  out.push(S_(G.sphereOf([FEED_X, -48, FEED_Z], 6.2, P), { tone: "mid" }));
  out.push(S_(G.disc(VALVE + 5.4, VALVE + 7.2, 5, run, P), { tone: "mid" }));
  out.push(S_(G.disc(VALVE + 6, PUMP[1] - 6.6 - FEED_RISER_Y, 3.4, run, P), { tone: "mid" }));
  // valve actuator on the bonnet
  out.push(S_(k.cylinder(FEED_X, -48, 2.2, FEED_Z + 5.6, 4, P, 18), { tone: "mid" }));
  out.push(S_(k.cylinder(FEED_X, -48, 4.6, FEED_Z + 9.6, 7, P, 28, 0.3), { tone: "mid", inner: L(k.sideArc(FEED_X, -48, 4.6, FEED_Z + 13, P, 28), { tone: "faint" }) }));
  return out.join("");
}

// The load-cell cable: from the cell, under the arm and the crossbeam, down
// the left post and along the pad to the console.
function cable() {
  const pts = [[-8, 0, 339], [-8, -71.5, 339], [-59, -71.5, 339], [-59, -71.5, 0.6], [-59, CONSOLE.y + 6, 0.6]];
  const screen = pts.map(at);
  return k.wireSvg(screen[0], screen[screen.length - 1], { via: screen.slice(1, -1), tone: "lo", ends: "from", size: 1.1 });
}

// ---------------------------------------------------------------- engine (bottom to top)
function exitLip() {
  return S_(G.ringBand(NOZZLE_S0 - 3, NOZZLE_S0, RE - 0.4, RE + 1.4, ENG, P), { tone: "mid" });
}

function nozzle() {
  const knots = [];
  for (let s = NOZZLE_S0; s <= CHAMBER_S + 1e-9; s += 2) knots.push([s, nozzleR(s), 1]);
  const paths = G.solidOf(knots, ENG, P, { smooth: { slope: nozzleSlope, radius: nozzleR }, rows: 8 });
  const seam = (s) => G.arcOf(ENG, s, nozzleR(s), P, { slope: nozzleSlope(s) });
  return S_(paths, { tone: "hi", lit: true, inner: L(seam(176) + seam(150) + seam(152.4) + seam(THROAT_S + 10), { tone: "faint" }) });
}

function chamber() {
  const bands = [248, 260, 272, 284].map((s) => G.arcOf(ENG, s, 15.5, P)).join("");
  return S_(G.disc(CHAMBER_S, CHAMBER_TOP, 15.5, ENG, P), { tone: "mid", inner: L(bands, { tone: "faint" }) });
}

function manifold() {
  const out = [S_(G.disc(CHAMBER_TOP, DOME_S0, 20, ENG, P), { tone: "mid", inner: L(G.arcOf(ENG, CHAMBER_TOP + 2, 20, P), { tone: "faint" }) })];
  out.push(Dots(G.dotsOf(ENG, DOME_S0, 18.6, 16, P, { all: true }), { size: 0.45, tone: "lo" }));
  return out.join("");
}

function dome() {
  const knots = [];
  for (let s = DOME_S0; s <= DOME_S1 + 1e-9; s += 1.5) knots.push([s, domeR(s), 1]);
  return S_(G.solidOf(knots, ENG, P, { smooth: { slope: domeSlope, radius: domeR } }), { tone: "mid" });
}

function gimbal() {
  const out = [S_(k.cylinder(0, 0, 5, DOME_S1, 6, P, 28, 0.3), { tone: "mid" })];
  const block = { x: -8, y: -8, w: 16, d: 16, r: 1 };
  out.push(S_(k.slabOf(block, 324, 8, P, 3, 0.4), { tone: "mid" }));
  out.push(Dots(k.corners(block, 2.4).map(([x, y]) => at([x, y, 332])), { size: 0.45, tone: "lo" }));
  // the load cell: the part that measures thrust
  out.push(S_(k.cylinder(0, 0, 8, 332, 12, P, 40, 0.3), { tone: "hi", inner: L(k.sideArc(0, 0, 8, 335, P, 40) + k.sideArc(0, 0, 8, 341, P, 40), { tone: "faint" }) }));
  out.push(S_(k.cylinder(0, 0, 10, 344, 2, P, 40, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- turbopump and exhaust
function pump() {
  // bottom to top: inlet, volute, bearing housing, turbine housing, cap
  const out = [];
  out.push(S_(G.disc(238, 246, 6.8, PF, P), { tone: "mid" }));
  out.push(S_(G.disc(246, 256, 12.5, PF, P, { bevel: 0.4 }), { tone: "mid", inner: L(G.arcOf(PF, 251, 12.5, P), { tone: "faint" }) }));
  out.push(Dots(G.dotsOf(PF, 256, 11.2, 12, P, { all: true }), { size: 0.4, tone: "lo" }));
  out.push(S_(G.disc(256, 264, 6.5, PF, P), { tone: "mid" }));
  out.push(S_(G.disc(264, 276, 10.5, PF, P), { tone: "mid", inner: L(G.arcOf(PF, 270, 10.5, P), { tone: "faint" }) }));
  out.push(Dots(G.dotsOf(PF, 276, 9.3, 10, P, { all: true }), { size: 0.4, tone: "lo" }));
  out.push(S_(G.disc(276, 282, 7, PF, P), { tone: "mid" }));
  return out.join("");
}

function exhaust() {
  const out = [];
  const EF = vertical(...EXH);
  const flare = [[140, 5.6, 1], [143, 5, 1], [147, 3.9, 1], [150, 3.2]];
  out.push(S_(G.solidOf(flare, EF, P), { tone: "mid" }));
  out.push(S_(k.cylinder(EXH[0], EXH[1], 3.2, 150, 116, P, 24), { tone: "mid", inner: L(k.sideArc(EXH[0], EXH[1], 3.2, 200, P, 24), { tone: "faint" }) }));
  const stub = G.frameAlong([PUMP[0] + 10.2, PUMP[1], 270], [1, 0, 0]);
  out.push(S_(G.disc(0, EXH[0] - 4 - PUMP[0] - 10.2, 3, stub, P), { tone: "mid" }));
  out.push(S_(G.sphereOf([EXH[0], EXH[1], 270], 4.2, P), { tone: "mid" }));
  return out.join("");
}

function discharge() {
  const out = [S_(k.cylinder(PUMP[0], PUMP[1], 2.6, 282, 13, P, 20), { tone: "mid" })];
  const ring = Math.sqrt(20 * 20 - PUMP[1] * PUMP[1]); // where the pipe meets the manifold
  const F = G.frameAlong([ring, PUMP[1], 298], [1, 0, 0]);
  out.push(S_(G.disc(0, PUMP[0] - 3.4 - ring, 2.6, F, P), { tone: "mid" }));
  out.push(S_(G.disc(1.2, 3, 4, F, P), { tone: "mid" }));
  out.push(S_(G.sphereOf([PUMP[0], PUMP[1], 298], 3.6, P), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- console
function consoleDesk() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CONSOLE, 0, 1, P)}" style="filter:blur(2px)"/>`];
  out.push(S_(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 6, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CONSOLE, 2.4), CONSOLE_H, P, 3), { tone: "faint" }));
  for (const [x, y] of Object.values(DIALS)) {
    out.push(S_(k.cylinder(x, y, DIAL_R + 1.4, CONSOLE_H, 2.6, P, 48, 0.4), { tone: "mid" }));
    const z = CONSOLE_H + 2.6;
    out.push(L(k.ring(x, y, DIAL_R, z, P, 64), { tone: "lo" }));
    const t = k.radialTicks(x, y, DIAL_R, 20, 5, z, [1.6, 3.2], P, DIAL_FROM, DIAL_SPAN);
    out.push(L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }));
    // a red-line tick at the top of the scale
    out.push(L(k.lineOnTop([x + Math.sin(DIAL_FROM + DIAL_SPAN) * (DIAL_R - 3), y - Math.cos(DIAL_FROM + DIAL_SPAN) * (DIAL_R - 3)], [x + Math.sin(DIAL_FROM + DIAL_SPAN) * DIAL_R, y - Math.cos(DIAL_FROM + DIAL_SPAN) * DIAL_R], z, P), { tone: "red" }));
    // label plate under each dial
    const label = { x: x - 7, y: y + 15, w: 14, d: 5, r: 0.8 };
    out.push(S_(k.slabOf(label, CONSOLE_H, 0.6, P, 3), { tone: "lo" }));
    out.push(L(k.lineOnTop([label.x + 2.4, label.y + 2.5], [label.x + 12, label.y + 2.5], CONSOLE_H + 0.6, P), { tone: "lo", free: true }));
  }
  // throttle knob: knurled, on a collar
  out.push(S_(k.cylinder(KNOB[0], KNOB[1], 4.6, CONSOLE_H, 1.2, P, 28), { tone: "mid" }));
  out.push(S_(k.cylinder(KNOB[0], KNOB[1], 3.6, CONSOLE_H + 1.2, 5, P, 32, 0.3), { tone: "mid", inner: L(k.knurl(KNOB[0], KNOB[1], 3.6, CONSOLE_H + 1.6, CONSOLE_H + 5.8, 16, P), { tone: "faint" }) }));
  out.push(Dots(k.corners(CONSOLE, 3).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving parts (rebuilt each frame)
function needle(which, value) {
  const [x, y] = which === "pc" ? DIALS.pc : DIALS.thrust;
  const full = which === "pc" ? PC_FULL : F_FULL;
  const a = DIAL_FROM + DIAL_SPAN * Math.max(0, Math.min(1, value / full));
  const z = CONSOLE_H + 2.6;
  const tip = [x + Math.sin(a) * (DIAL_R - 1.6), y - Math.cos(a) * (DIAL_R - 1.6)];
  const tail = [x - Math.sin(a) * 2.2, y + Math.cos(a) * 2.2];
  const c = iso([x, y, z], P);
  return `<path class="rkt-needle" data-free="end" d="${lineOnTop(tail, tip, z, P)}"/><circle class="rkt-hub" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="1.3"/>`;
}

function knobIndex(throttle) {
  const a = DIAL_FROM + DIAL_SPAN * ((throttle - 0.5) / 0.5);
  const z = CONSOLE_H + 6.2;
  const p0 = [KNOB[0] + Math.sin(a) * 0.6, KNOB[1] - Math.cos(a) * 0.6];
  const p1 = [KNOB[0] + Math.sin(a) * 3.4, KNOB[1] - Math.cos(a) * 3.4];
  return `<path class="rkt-index" d="${lineOnTop(p0, p1, z, P)}"/>`;
}

// The plume: the hull of the exit ring and a tip below it, its length set by
// the thrust; a hot core inside it, and shock diamonds along the axis.
function plume(thrust) {
  const len = 30 + 78 * Math.max(0, Math.min(1, thrust / 100e3));
  const ring = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    ring.push([Math.cos(t), Math.sin(t)]);
  }
  const hull = (r, z0, tipZ) => {
    const pts = ring.map(([c, s]) => iso([r * c, r * s, z0], P));
    pts.push(iso([0, 0, tipZ], P));
    // convex hull (monotone chain)
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    const h = lower.slice(0, -1).concat(upper.slice(0, -1));
    return "M" + h.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L") + "Z";
  };
  const z0 = 119;
  const out = [`<path class="rkt-plume" d="${hull(RE - 1.2, z0, z0 - len)}"/>`, `<path class="rkt-core" d="${hull(RE * 0.42, z0, z0 - len * 0.72)}"/>`];
  for (let n = 1; n <= 3; n++) {
    const zc = z0 - len * (0.16 + n * 0.17);
    const c = iso([0, 0, zc], P), up = iso([0, 0, zc + 4], P), dn = iso([0, 0, zc - 4], P);
    const w = 3.2 * (1 - n * 0.18);
    out.push(`<path class="rkt-diamond" d="M${up[0].toFixed(2)} ${up[1].toFixed(2)}L${(c[0] + w).toFixed(2)} ${c[1].toFixed(2)}L${dn[0].toFixed(2)} ${dn[1].toFixed(2)}L${(c[0] - w).toFixed(2)} ${c[1].toFixed(2)}Z"/>`);
  }
  return out.join("");
}

// The build has no iso/lineOnTop in scope by those names: alias them so the
// same function source runs here and in the page.
const iso = k.iso;
const lineOnTop = k.lineOnTop;

// ---------------------------------------------------------------- assemble
const THROTTLE0 = 0.85;
const E0 = engine(THROTTLE0);
const LABEL =
  "A liquid-propellant rocket engine on a vertical test stand. Two posts and a crossbeam carry a thrust arm; the engine hangs nozzle down from a load cell under it. A turbopump on the engine's side feeds the injector manifold, fed in turn by a line with a main valve from the back of the pad; the pump's turbine exhaust runs down a pipe beside the bell. The flame strikes a ribbed deflector plate. An instrument console at the front left reads chamber pressure and thrust on two dials and carries the throttle knob.";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    `<defs><linearGradient id="rkt-plume-grad" gradientUnits="userSpaceOnUse" x1="0" y1="${iso([0, 0, 119], P)[1].toFixed(1)}" x2="0" y2="${iso([0, 0, 10], P)[1].toFixed(1)}"><stop offset="0" class="rkt-stop-a"/><stop offset="0.45" class="rkt-stop-b"/><stop offset="1" class="rkt-stop-c"/></linearGradient></defs>`,
    pad(),
    deflector(),
    post(POSTS[0]),
    post(POSTS[1]),
    crossbeam(),
    cable(),
    feed(),
    `<g data-plume>${plume(E0.thrust)}</g>`,
    exitLip(),
    nozzle(),
    chamber(),
    pump(),
    exhaust(),
    discharge(),
    manifold(),
    dome(),
    gimbal(),
    arm(),
    consoleDesk(),
    `<g data-needles>${needle("pc", E0.pc)}${needle("thrust", E0.thrust)}</g>`,
    `<g data-knob>${knobIndex(THROTTLE0)}</g>`,
  ],
});

const fmt = (v, d) => v.toFixed(d);
const readoutOf = (t) => {
  const e = engine(t);
  return `${fmt(t * 100, 0)}% · Pc ${fmt(e.pc / 1e6, 2)} MPa · F ${fmt(e.thrust / 1e3, 1)} kN · Isp ${fmt(e.isp, 0)} s`;
};

const stage = `<div class="iso-stage rkt-stage" tabindex="0" role="group" aria-roledescription="engine test stand" aria-label="Rocket engine test stand. Up and Down arrows change the throttle; Space pauses the tour.">${svg}<span class="rkt-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Engine test stand",
  hint: "↑ ↓ throttle · space pause",
  readout: readoutOf(THROTTLE0),
  keys: [
    { mark: "lit", label: "Nozzle: throat 10.7 cm across, exit 42.8 cm, area ratio 16" },
    { mark: "raised", label: "Load cell under the arm: it measures the thrust" },
    { mark: "dim", label: "Dials: chamber pressure 0–10 MPa (left), thrust 0–120 kN (right)" },
  ],
  caption: `Throttle sets the chamber pressure (7 MPa at 100%) and so the mass flow ṁ = Pc·At/c*. Thrust is F = Cf·Pc·At with the ideal thrust coefficient for γ = ${GAMMA}, exit Mach ${fmt(ME, 2)} and sea-level ambient pressure, so Isp falls as you throttle down: the nozzle is overexpanded (exit pressure below ambient), and below about 0.4 of ambient (Summerfield's rule of thumb) the flow would separate from the wall. c* = ${CSTAR} m/s is a typical kerosene/oxygen value; the plume is drawn, not simulated.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="rocket">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="rocket"]
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
const ROOTSEL = '[data-anatomy="rocket"]';
const FIGURE_CSS = `
.iso[data-anatomy="rocket"]{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;--rkt-a:#fff3c4;--rkt-b:#ff9a3c;--rkt-c:#ff5a1f;--rkt-core:#fffbe8;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso[data-anatomy="rocket"][data-theme="light"],html:not(.dark) .iso[data-anatomy="rocket"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7;--rkt-a:#ffd166;--rkt-b:#f77f00;--rkt-c:#e63900;--rkt-core:#fff4cc}
.iso[data-anatomy="rocket"] .iso-figure{margin:0}
.iso[data-anatomy="rocket"] .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso[data-anatomy="rocket"] .iso-plate-corner{font-family:inherit;font-size:11px}
.iso[data-anatomy="rocket"] .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso[data-anatomy="rocket"] .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso[data-anatomy="rocket"] .iso-legend{font-size:13px}
.iso[data-anatomy="rocket"] .rkt-stage{position:relative;outline:none;cursor:default}
.iso[data-anatomy="rocket"] .rkt-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso[data-anatomy="rocket"] .rkt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso[data-anatomy="rocket"] .rkt-stop-a{stop-color:var(--rkt-a);stop-opacity:.95}
.iso[data-anatomy="rocket"] .rkt-stop-b{stop-color:var(--rkt-b);stop-opacity:.75}
.iso[data-anatomy="rocket"] .rkt-stop-c{stop-color:var(--rkt-c);stop-opacity:0}
.iso[data-anatomy="rocket"] .rkt-plume{fill:url(#rkt-plume-grad);transform-box:fill-box;transform-origin:50% 0;animation:rkt-flicker .18s ease-in-out infinite alternate}
.iso[data-anatomy="rocket"] .rkt-core{fill:var(--rkt-core);opacity:.7}
.iso[data-anatomy="rocket"] .rkt-diamond{fill:var(--rkt-core);opacity:.85}
.iso[data-anatomy="rocket"] .rkt-needle{fill:none;stroke:var(--anatomy-lit);stroke-width:1.1;stroke-linecap:round}
.iso[data-anatomy="rocket"] .rkt-hub{fill:var(--anatomy-paper);stroke:var(--anatomy-lit);stroke-width:1}
.iso[data-anatomy="rocket"] .rkt-index{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2;stroke-linecap:round}
@keyframes rkt-flicker{0%{transform:scaleY(1)}100%{transform:scaleY(.965)}}
@media (prefers-reduced-motion:reduce){.iso[data-anatomy="rocket"] .rkt-plume{animation:none}}
@media (max-width:560px){.iso[data-anatomy="rocket"] .iso-plate{padding:40px 4px 64px}}
`;
const css = scope(k.ISO_CSS, ROOTSEL) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const liveSrc = `
const P = ${JSON.stringify(P)};
const GAMMA = ${GAMMA}, CSTAR = ${CSTAR}, PA = ${PA}, PC_MAX = ${PC_MAX}, G0 = ${G0}, AT = ${AT}, EPS = ${EPS};
const PRATIO = ${PRATIO}, CF_MOMENTUM = ${CF_MOMENTUM}, RE = ${RE};
const DIALS = ${JSON.stringify(DIALS)}, DIAL_R = ${DIAL_R}, KNOB = ${JSON.stringify(KNOB)}, CONSOLE_H = ${CONSOLE_H};
const DIAL_FROM = ${DIAL_FROM}, DIAL_SPAN = ${DIAL_SPAN}, PC_FULL = ${PC_FULL}, F_FULL = ${F_FULL};
${engine.toString()}
${needle.toString()}
${knobIndex.toString()}
${plume.toString()}
const fmt = (v, d) => v.toFixed(d);
const readoutOf = (t) => { const e = engine(t); return fmt(t * 100, 0) + "% \\u00b7 Pc " + fmt(e.pc / 1e6, 2) + " MPa \\u00b7 F " + fmt(e.thrust / 1e3, 1) + " kN \\u00b7 Isp " + fmt(e.isp, 0) + " s"; };

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".rkt-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const plumeG = svg.querySelector("[data-plume]");
  const needleG = svg.querySelector("[data-needles]");
  const knobG = svg.querySelector("[data-knob]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // An idle tour moves the throttle through the range; a key takes over.
  const TOUR = [0.85, 1, 0.7, 0.5, 0.9];
  let target = ${THROTTLE0}, shown = target, step = 0, paused = false, manual = 0, frame = 0, last = 0, hold = 0, visible = false;

  function draw() {
    const e = engine(shown);
    plumeG.innerHTML = plume(e.thrust);
    needleG.innerHTML = needle("pc", e.pc) + needle("thrust", e.thrust);
    knobG.innerHTML = knobIndex(shown);
    const text = readoutOf(shown);
    if (readout.textContent !== text) readout.textContent = text;
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && !still.matches && now > manual) {
      hold += dt;
      if (hold > 2.6) { hold = 0; step = (step + 1) % TOUR.length; target = TOUR[step]; }
    }
    shown += (target - shown) * (1 - Math.exp(-dt / 0.45));
    draw();
    const moving = Math.abs(target - shown) > 0.0005;
    frame = visible && (moving || (!paused && !still.matches)) ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") target = Math.min(1, Math.round((target + (event.shiftKey ? 0.1 : 0.05)) * 100) / 100);
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft") target = Math.max(0.5, Math.round((target - (event.shiftKey ? 0.1 : 0.05)) * 100) / 100);
    else if (event.key === " ") paused = !paused;
    else return;
    event.preventDefault();
    manual = performance.now() + 6000;
    say.textContent = readoutOf(target);
    if (still.matches) { shown = target; draw(); }
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

function start() { document.querySelectorAll('[data-anatomy="rocket"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;
const js = `// Generated by figures/rocket/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, "rocket.html"), fragment + "\n");
writeFileSync(join(OUT, "rocket.css"), css);
writeFileSync(join(OUT, "rocket.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rocket engine test stand</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
const e1 = engine(1);
console.log(`wrote rocket.* · Me ${ME.toFixed(3)} · pe/pc ${PRATIO.toFixed(5)} · 100%: F ${(e1.thrust / 1e3).toFixed(1)} kN, Isp ${e1.isp.toFixed(0)} s, pe/pa ${e1.sep.toFixed(2)}`);
