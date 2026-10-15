// Fig 1 · A benchtop open-jet (Eiffel-type) wind tunnel: a bell-mouth
// inlet with honeycomb, a settling chamber, a contraction that speeds the
// air up, an open test section where a small wing sits on a sting above a
// two-component balance (lift and drag dials), a collector and diffuser,
// and the fan with its motor at the end, sucking air through. A pitot tube
// in the jet feeds a U-tube manometer; the AoA knob turns the wing.
// Run from the repo root: node figures/aerospace-tunnel/build.mjs
// Writes site/static/anatomy/aerospace-tunnel.{html,css,js} and
// figures/aerospace-tunnel/preview{,-light}.html.
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

// ---------------------------------------------------------------- model
// One world unit is 5 mm. The wing: chord 50 mm, span 150 mm (S = 0.0075 m²,
// AR = 3). Thin-airfoil theory, CL = 2πα (α in radians), up to stall at
// 15°, then a soft fall; CD = CD0 + CL²/(π e AR) plus separation drag past
// stall. The same model drives the aerospace page's airfoil block.
const MODEL = { rho: 1.225, S: 0.0075, AR: 3, e: 0.85, CD0: 0.02, stall: 15, g: 9.80665, rhoW: 998 };

// ---------------------------------------------------------------- layout (world units, z up, x along the airflow)
const WIDTH = 640;
const HEIGHT = 380;
const PLATE = { x: -176, y: -46, w: 290, d: 118, r: 8 };
const PLATE_H = 9;
const FOOT_H = 5;
const AXZ = 62; // tunnel centreline height
const TY = 0; // tunnel centreline y
const AX = G.frameAlong([0, TY, AXZ], [1, 0, 0]);

// Profile along the axis: s = world x.
const INLET = [-168, -156]; // bell-mouth
const SETTLE = [-156, -116];
const CONTR = [-116, -76];
const EXIT_R = 17;
const SETTLE_R = 30;
const GAP = [-74, -30]; // the open jet
const COLL = [-30, -22];
const DIFF = [-22, 30];
const FAN = [30, 56];
const FAN_R = 31;
const MOTOR = [56, 82];

// The contraction: a 5th-order polynomial between the two radii (zero
// slope and curvature at both ends), as tunnel contractions are designed.
const contrR = (s) => {
  const t = Math.min(1, Math.max(0, (s - CONTR[0]) / (CONTR[1] - CONTR[0])));
  const f = 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;
  return SETTLE_R + (EXIT_R - SETTLE_R) * f;
};
const contrSlope = (s) => {
  const L = CONTR[1] - CONTR[0];
  const t = Math.min(1, Math.max(0, (s - CONTR[0]) / L));
  return ((EXIT_R - SETTLE_R) * (30 * t ** 2 - 60 * t ** 3 + 30 * t ** 4)) / L;
};
// The diffuser opens at about 3.5° half-angle, gently, so the flow stays attached.
const diffR = (s) => 19 + ((s - DIFF[0]) / (DIFF[1] - DIFF[0])) * (FAN_R - 2.6 - 19);
const diffSlope = () => (FAN_R - 2.6 - 19) / (DIFF[1] - DIFF[0]);

const WING = { x: -52, c: 10, span: 30, t: 0.12 }; // pivot at the quarter chord
const BAL = { x: -66, y: -14, w: 30, d: 30, r: 2 };
const BAL_H = 14;
const PITOT = { x: -70.5, y: 9 };
const MANO = { x: -136, y: 46 };
const CTRL = { x: 34, y: 40, w: 30, d: 22, r: 2 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [INLET[0], 0, AXZ + 40], [FAN[1], 0, AXZ + FAN_R + 2], [MOTOR[1], 0, AXZ + 14], [MANO.x, MANO.y + 6, 64]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: Number(process.env.AZ ?? 58) },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (p) => k.depthOf(p, P);

// ---------------------------------------------------------------- base
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 16), [PLATE.x + PLATE.w / 2, PLATE.y + 16], [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d - 16]]
    .sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 5.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a rail along the back edge with a millimetre ruler: the test section's station marks
  const strip = { x: GAP[0] - 2, y: PLATE.y + 6, w: GAP[1] - GAP[0] + 4, d: 5, r: 0.6 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + strip.d - 0.2, 0.8, [-1.4, -2.8], P, "x");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // label plate, front left, three rule lines standing for text
  const label = { x: 60, y: 54, w: 30, d: 13, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(L([20, 14, 24].map((len, n) => k.lineOnTop([label.x + 4, label.y + 3.6 + n * 2.9], [label.x + 4 + len, label.y + 3.6 + n * 2.9], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.4 }));
  return out.join("");
}

// A cradle stand: a foot, a post and a saddle block touching the duct's underside.
function stand(x, r) {
  const out = [];
  const foot = { x: x - 9, y: TY - 12, w: 18, d: 24, r: 1.6 };
  out.push(S_(k.slabOf(foot, 0, 3, P, 4, 0.5), { tone: "mid" }));
  out.push(D(k.corners(foot, 2.4).map(([px, py]) => at([px, py, 3])), { size: 0.45 }));
  const top = AXZ - r - 4;
  const post = { x: x - 3.5, y: TY - 3.5, w: 7, d: 7, r: 1 };
  out.push(S_(k.slabOf(post, 3, top - 3, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(post, top - 8, P, 3), { tone: "faint" }) }));
  const saddle = { x: x - 6, y: TY - 9, w: 12, d: 18, r: 1.2 };
  out.push(S_(k.slabOf(saddle, top, 4, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- the duct
const seam = (s, r, slope = 0) => G.arcOf(AX, s, r, P, { slope });
const flange = (s, rIn, rOut, w = 2.4) => S_(G.ringBand(s - w / 2, s + w / 2, rIn, rOut, AX, P, { steps: 64 }), { tone: "mid" });
const bolts = (s, r, n) => D(G.dotsOf(AX, s, r, n, P), { size: 0.45, tone: "lo" });

function inlet() {
  // The bell-mouth: a quarter-ellipse flare from 38 down to the chamber's 30.
  const knots = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const s = INLET[0] + t * (INLET[1] - INLET[0]);
    knots.push([s, SETTLE_R + 8 * (1 - Math.sin((t * Math.PI) / 2)), 1]);
  }
  const out = [S_(G.lathe(knots, AX, P, { hole: [INLET[0], SETTLE_R - 1.4], steps: 64 }), { tone: "mid", inner: L(seam(INLET[1] - 0.6, SETTLE_R), { tone: "faint" }) })];
  // The honeycomb seen in the mouth: cells as a dot lattice on the face plane, inside the ring.
  const cells = [];
  for (let a = -SETTLE_R + 3; a <= SETTLE_R - 3; a += 3.4) {
    for (let b = -SETTLE_R + 3; b <= SETTLE_R - 3; b += 3) {
      const yy = a + ((Math.round(b / 3) & 1) ? 1.7 : 0);
      if (Math.hypot(yy, b) < SETTLE_R - 3.2) cells.push(at([INLET[0] + 3, TY + yy, AXZ + b]));
    }
  }
  out.push(D(cells, { size: 0.5, tone: "lo" }));
  out.push(L(G.arcOf(AX, INLET[0] + 3, SETTLE_R - 2.2, P, { least: -1 }), { tone: "lo" }));
  return out.join("");
}

function settling() {
  const bands = [SETTLE[0] + 12, SETTLE[0] + 24].map((s) => seam(s, SETTLE_R)).join("");
  return [
    S_(G.disc(SETTLE[0], SETTLE[1], SETTLE_R, AX, P, { steps: 64 }), { tone: "mid", inner: L(bands, { tone: "faint" }) }),
    flange(SETTLE[0] + 12, SETTLE_R, SETTLE_R + 2), // the screen frames
    bolts(SETTLE[0] + 12, SETTLE_R + 2, 14),
    flange(SETTLE[1], SETTLE_R, SETTLE_R + 2.4),
    bolts(SETTLE[1], SETTLE_R + 2.4, 14),
  ].join("");
}

function contraction() {
  const knots = [];
  for (let s = CONTR[0]; s <= CONTR[1] + 1e-9; s += 2) knots.push([s, contrR(s), 1]);
  const paths = G.solidOf(knots, AX, P, { smooth: { slope: contrSlope, radius: contrR }, rows: 8, steps: 64 });
  return [
    S_(paths, { tone: "mid", inner: L(seam(CONTR[0] + 14, contrR(CONTR[0] + 14), contrSlope(CONTR[0] + 14)), { tone: "faint" }) }),
    // the nozzle lip, with the jet's open mouth drawn as a full ring
    S_(G.disc(CONTR[1], GAP[0], EXIT_R, AX, P, { hole: [GAP[0], EXIT_R - 1.2] }), { tone: "mid" }),
    flange(GAP[0] + 0.6, EXIT_R, EXIT_R + 2),
    bolts(GAP[0] + 0.6, EXIT_R + 2, 10),
  ].join("");
}

function collector() {
  const knots = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    knots.push([COLL[0] + t * (COLL[1] - COLL[0]), 19 + 6 * (1 - Math.sin((t * Math.PI) / 2)), 1]);
  }
  return S_(G.lathe(knots, AX, P, { hole: [COLL[0], 18], steps: 56 }), { tone: "mid" });
}

function diffuser() {
  const knots = [];
  for (let s = DIFF[0]; s <= DIFF[1] + 1e-9; s += 4) knots.push([s, diffR(s), 1]);
  const paths = G.solidOf(knots, AX, P, { smooth: { slope: diffSlope, radius: diffR }, rows: 6, steps: 64 });
  const bands = [DIFF[0] + 18, DIFF[0] + 36].map((s) => seam(s, diffR(s), diffSlope())).join("");
  return [S_(paths, { tone: "mid", inner: L(bands, { tone: "faint" }) }), flange(DIFF[1], diffR(DIFF[1]), FAN_R + 1.4), bolts(DIFF[1], FAN_R + 1.4, 16)].join("");
}

function fanHousing() {
  const bands = [FAN[0] + 8, FAN[0] + 18].map((s) => seam(s, FAN_R)).join("");
  return [
    S_(G.disc(FAN[0], FAN[1], FAN_R, AX, P, { hole: [FAN[1], FAN_R - 1.6], steps: 64 }), { tone: "mid", inner: L(bands, { tone: "faint" }) }),
    flange(FAN[1] - 1, FAN_R, FAN_R + 2),
    bolts(FAN[1] - 1, FAN_R + 2, 16),
  ].join("");
}

// The outlet guard: rings and spokes on the end face, over the fan blades.
const facePoint = (s, r, th) => at([s, TY + r * Math.cos(th), AXZ + r * Math.sin(th)]);
function guard() {
  const s = FAN[1] + 0.4;
  const rings = [9, 17, 25].map((r) => G.arcOf(AX, s, r, P, { least: -1 })).join("");
  const spokes = [0, 1, 2, 3].map((i) => {
    const th = Math.PI / 4 + (i * Math.PI) / 2;
    return `M${facePoint(s, 4.6, th).join(" ")}L${facePoint(s, FAN_R - 1.6, th).join(" ")}`;
  }).join("");
  return L(rings + spokes, { tone: "mid" }) + S_(G.disc(s, s + 1.2, 4.6, AX, P), { tone: "mid" });
}

function motor() {
  const fins = [];
  for (let s = MOTOR[0] + 4; s < MOTOR[1] - 4; s += 3) fins.push(seam(s, 12));
  const out = [];
  // the bracket under the motor, down to the plate
  const br = { x: MOTOR[0] + 2, y: TY - 10, w: MOTOR[1] - MOTOR[0] - 4, d: 20, r: 1.4 };
  out.push(S_(k.slabOf(br, 0, 3, P, 3, 0.4), { tone: "mid" }));
  const web = { x: MOTOR[0] + 10, y: TY - 3, w: 6, d: 6, r: 0.8 };
  out.push(S_(k.slabOf(web, 3, AXZ - 12 - 3, P, 3, 0.4), { tone: "mid" }));
  out.push(S_(G.disc(FAN[1] + 1.6, MOTOR[0], 3, AX, P), { tone: "mid" })); // the shaft
  out.push(S_(G.disc(MOTOR[0], MOTOR[1], 12, AX, P), { tone: "mid", inner: L(fins.join(""), { tone: "faint" }) }));
  out.push(S_(G.disc(MOTOR[1], MOTOR[1] + 3, 9.5, AX, P), { tone: "mid" }));
  out.push(D(G.dotsOf(AX, MOTOR[1] + 3, 7, 6, P), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- the test section
function balance() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BAL, 0, BAL_H, P)}" style="filter:blur(3px)"/>`];
  out.push(S_(k.slabOf(BAL, 0, BAL_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BAL, 3, P, 4), { tone: "faint" }) }));
  const lid = k.insetPlan(BAL, 2.4);
  out.push(L(k.planOutline(lid, BAL_H, P, 4), { tone: "faint" }));
  out.push(D(k.corners(lid, 1.6).map(([x, y]) => at([x, y, BAL_H])), { size: 0.45 }));
  // the lift and drag load cells: two flexure blocks the sting stands on
  const cellL = { x: WING.x - 4, y: TY - 8, w: 8, d: 8, r: 0.8 };
  out.push(S_(k.slabOf(cellL, BAL_H, 6, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(cellL, BAL_H + 3, P, 3), { tone: "faint" }) }));
  const cellD = { x: WING.x + 5, y: TY - 3, w: 5, d: 6, r: 0.6 };
  out.push(S_(k.slabOf(cellD, BAL_H, 4, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}

// Two dials on the balance's front, read live: lift (left) and drag (right).
const DIALS = { lift: [BAL.x + 7, BAL.y + BAL.d - 7], drag: [BAL.x + 21, BAL.y + BAL.d - 7] };
const DIAL_R = 5.2;
const SWEEP = Math.PI * 1.5;
function dials() {
  const out = [];
  for (const [x, y] of Object.values(DIALS)) {
    out.push(S_(k.cylinder(x, y, DIAL_R + 0.8, BAL_H, 1.6, P, 32, 0.4), { tone: "mid" }));
    out.push(S_(k.cylinder(x, y, DIAL_R, BAL_H + 1.6, 0.3, P, 32), { tone: "hi", crease: "none" }));
    const t = k.radialTicks(x, y, DIAL_R - 0.2, 20, 5, BAL_H + 1.9, [-0.9, -1.8], P, -SWEEP / 2, SWEEP);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  }
  return out.join("");
}
// The needles' hubs, drawn over the needles so each needle starts on one.
const hubs = () => D(Object.values(DIALS).map(([x, y]) => at([x, y, BAL_H + 1.95])), { size: 0.9, tone: "hi" });
const needle = (x, y, frac) => {
  const th = -SWEEP / 2 + frac * SWEEP; // 0 at −y, clockwise from above (radialTicks convention)
  return k.lineOnTop([x, y], [x + Math.sin(th) * (DIAL_R - 1), y - Math.cos(th) * (DIAL_R - 1)], BAL_H + 1.95, P);
};

// The angle-of-attack knob on the balance's right side, with its degree scale.
const KNOB = [BAL.x + BAL.w - 6, BAL.y + 7];
function knobBase() {
  const [x, y] = KNOB;
  const t = k.radialTicks(x, y, 5.4, 30, 5, BAL_H, [-0.9, -1.8], P, -Math.PI / 6, (Math.PI * 5) / 6);
  return L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
}
function knob() {
  const [x, y] = KNOB;
  return S_(k.cylinder(x, y, 3.8, BAL_H, 3.4, P, 28, 0.4), { tone: "mid" }) + L(k.knurl(x, y, 3.8, BAL_H, BAL_H + 3.4, 22, P), { tone: "lo" });
}
const knobPointer = (deg) => {
  const [x, y] = KNOB;
  const th = -Math.PI / 6 + ((deg + 6) / 30) * ((Math.PI * 5) / 6);
  return k.lineOnTop([x, y], [x + Math.sin(th) * 3.2, y - Math.cos(th) * 3.2], BAL_H + 3.4, P);
};

function sting() {
  return S_(k.cylinder(WING.x, TY, 1, BAL_H + 6, AXZ - BAL_H - 6 - 0.6, P, 16), { tone: "mid", crease: "none" })
    + S_(k.cylinder(WING.x, TY, 2, BAL_H + 6, 2.4, P, 18, 0.3), { tone: "mid" });
}

// The wing at angle α: a NACA 0012 section extruded along the span, pitched
// about its quarter chord. Built once per whole degree at build time.
function wingAt(deg) {
  const a = (deg * Math.PI) / 180;
  const { c, t } = WING;
  const pts = [];
  const N = 18;
  const half = (xc) => 5 * t * c * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
  for (let i = 0; i <= N; i++) { const xc = (1 - Math.cos((Math.PI * i) / N)) / 2; pts.push([xc * c, half(xc)]); }
  for (let i = N - 1; i >= 1; i--) { const xc = (1 - Math.cos((Math.PI * i) / N)) / 2; pts.push([xc * c, -half(xc)]); }
  // rotate nose-up by α about the quarter chord; world dx = along x, dz = up
  const world = pts.map(([px, pz]) => {
    const dx = px - c / 4;
    return [dx * Math.cos(a) + pz * Math.sin(a), -dx * Math.sin(a) + pz * Math.cos(a)];
  });
  const F = G.frameAlong([WING.x, TY - WING.span / 2, AXZ], [0, 1, 0]); // u = −x, v = +z
  const poly = world.map(([dx, dz]) => [-dx, dz]);
  const paths = G.prismOf(F, poly, 0, WING.span, P);
  const tip = (s) => k.pathOf(world.map(([dx, dz]) => at([WING.x + dx, TY - WING.span / 2 + s, AXZ + dz])), true);
  return S_(paths, { tone: "hi", lit: true, inner: L(tip(WING.span / 2), { tone: "faint" }) });
}
const DEG_MIN = -6, DEG_MAX = 24;
const wings = [];
for (let d = DEG_MIN; d <= DEG_MAX; d++) wings.push(wingAt(d));

function pitot() {
  const out = [];
  const foot = { x: PITOT.x - 4, y: PITOT.y - 4, w: 8, d: 8, r: 1.2 };
  out.push(S_(k.slabOf(foot, 0, 2.4, P, 3, 0.4), { tone: "mid" }));
  out.push(S_(k.cylinder(PITOT.x, PITOT.y, 0.9, 2.4, AXZ - 2.4, P, 14), { tone: "mid", crease: "none" }));
  // the head, pointing upstream into the nozzle's jet
  const F = G.frameAlong([PITOT.x, PITOT.y, AXZ], [-1, 0, 0]);
  out.push(S_(G.disc(-0.9, 3, 0.9, F, P), { tone: "hi" }));
  out.push(S_(G.disc(-0.9, 0.9, 1.4, F, P), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- manometer and controller (front)
const MTUBES = [MANO.x - 4, MANO.x + 4];
const M_REST = 26; // liquid level at rest
const M_Z0 = 6;
const M_TOP = 58;
function manometer() {
  const out = [];
  const foot = { x: MANO.x - 14, y: MANO.y - 4, w: 28, d: 14, r: 1.6 };
  out.push(`<path class="iso-halo" d="${k.haloOf(foot, 0, 3, P)}" style="filter:blur(3px)"/>`);
  out.push(S_(k.slabOf(foot, 0, 3, P, 4, 0.5), { tone: "mid" }));
  const board = { x: MANO.x - 11, y: MANO.y + 4, w: 22, d: 3, r: 0.6 };
  out.push(S_(k.slabOf(board, 3, M_TOP + 4 - 3, P, 2, 0.3), { tone: "mid" }));
  // the scale on the board's face, between the tubes, ticks every 2 units (10 mm)
  const strip = { x: MANO.x - 1.6, y: MANO.y + 3.4, w: 3.2, d: 0.6, r: 0.2 };
  out.push(S_(k.slabOf(strip, M_Z0, M_TOP - M_Z0, P, 1), { tone: "lo", crease: "none" }));
  const ticks = [];
  for (let z = M_Z0 + 2; z <= M_TOP - 2; z += 2) {
    const len = (z - M_REST) % 10 === 0 ? 2.4 : 1.2;
    ticks.push(k.segment([MANO.x - 1.6, MANO.y + 3.4, z], [MANO.x - 1.6 + len, MANO.y + 3.4, z], P));
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  // the U bend at the bottom, joining the tubes
  const bend = { x: MTUBES[0] - 1.6, y: MANO.y - 1.6, w: MTUBES[1] - MTUBES[0] + 3.2, d: 3.2, r: 1.6 };
  out.push(S_(k.slabOf(bend, M_Z0 - 3, 3, P, 3), { tone: "mid" }));
  return out.join("");
}
// Glass tubes and their liquid columns: rebuilt live (the columns change).
function tubes(dh) {
  const out = [];
  MTUBES.forEach((x, i) => {
    const level = M_REST + (i === 0 ? -dh / 2 : dh / 2); // the pitot side is pushed down
    out.push(k.solidSvg(k.cylinder(x, MANO.y, 1.6, M_Z0, M_TOP - M_Z0, P, 18), { tone: "lo", crease: "none" }));
    out.push(k.solidSvg(k.cylinder(x, MANO.y, 1.1, M_Z0, level - M_Z0, P, 16), { tone: "hi", lit: true, crease: "none" }));
    out.push(k.solidSvg(k.cylinder(x, MANO.y, 2.2, M_TOP, 1.4, P, 18, 0.3), { tone: "mid" }));
  });
  return out.join("");
}

function controller() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CTRL, 0, 14, P)}" style="filter:blur(3px)"/>`];
  out.push(S_(k.slabOf(CTRL, 0, 14, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CTRL, 4, P, 4), { tone: "faint" }) }));
  // the display window on the lid, and the speed knob
  const win = { x: CTRL.x + 3, y: CTRL.y + 3, w: 14, d: 7, r: 0.8 };
  out.push(S_(k.slabOf(win, 14, 0.4, P, 2), { tone: "lo", crease: "none" }));
  out.push(D([at([CTRL.x + CTRL.w - 3, CTRL.y + 3, 14]), at([CTRL.x + 3, CTRL.y + CTRL.d - 3, 14])], { size: 0.45 }));
  return out.join("");
}
const SKNOB = [CTRL.x + CTRL.w - 8, CTRL.y + CTRL.d - 8];
function speedKnob() {
  const [x, y] = SKNOB;
  const t = k.radialTicks(x, y, 6, 30, 5, 14, [-0.9, -1.8], P, -Math.PI * 0.75, Math.PI * 1.5);
  return L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" })
    + S_(k.cylinder(x, y, 4.2, 14, 3.6, P, 28, 0.4), { tone: "mid" }) + L(k.knurl(x, y, 4.2, 14, 17.6, 24, P), { tone: "lo" });
}
const speedPointer = (v) => {
  const [x, y] = SKNOB;
  const th = -Math.PI * 0.75 + (v / 30) * Math.PI * 1.5;
  return k.lineOnTop([x, y], [x + Math.sin(th) * 3.6, y - Math.cos(th) * 3.6], 17.6, P);
};
// Bars in the display window: airspeed as a bar graph (no text in the drawing).
const displayBars = (v) => {
  const n = Math.round((v / 30) * 10);
  const out = [];
  for (let i = 0; i < 10; i++) out.push(k.lineOnTop([CTRL.x + 4.5 + i * 1.2, CTRL.y + 8.6], [CTRL.x + 4.5 + i * 1.2, CTRL.y + 8.6 - (i < n ? 4.6 : 0.01)], 14.45, P));
  return out.join("");
};

// ---------------------------------------------------------------- assemble
// Tunnel pieces and the test-section parts are drawn back to front by depth.
const pieces = [
  { key: depth([INLET[0], TY, AXZ]), svg: inlet() },
  { key: depth([SETTLE[0], TY, AXZ]), svg: settling() },
  { key: depth([CONTR[0], TY, AXZ]), svg: contraction() },
  { key: depth([COLL[0] - 6, TY, AXZ]), svg: collector() },
  { key: depth([DIFF[0], TY, AXZ]), svg: diffuser() },
  { key: depth([FAN[0], TY, AXZ]), svg: fanHousing() },
].sort((a, b) => a.key - b.key);

const vectorOf = (p) => p.join(",");
const wireFrom = at([PITOT.x, PITOT.y, 2.4]);
const wireTo = at([MTUBES[0], MANO.y - 1.6, M_Z0 - 1.5]);
const cable = k.wireSvg(at([MOTOR[0] + 8, TY + 10, 3]), at([CTRL.x + 6, CTRL.y, 7]), { via: [at([MOTOR[0] + 8, CTRL.y - 8, 3])], tone: "lo" });

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A benchtop wind tunnel. Air is sucked in through a bell-mouth and a honeycomb, slowed and smoothed in a settling chamber, then sped up through a contraction into an open test section. There a small wing sits on a sting above a balance with two load cells and dials, one for lift and one for drag. A collector and diffuser lead to the fan, driven by a motor on its bracket. A pitot tube in the jet feeds a U-tube manometer, and a knob on the balance sets the wing's angle of attack.",
  body: [
    base(),
    stand(SETTLE[0] + 20, SETTLE_R),
    stand(CONTR[1] - 8, contrR(CONTR[1] - 8)),
    stand(DIFF[0] + 30, diffR(DIFF[0] + 30)),
    stand(FAN[0] + 13, FAN_R),
    balance(),
    knobBase(),
    `<g data-needle-wrap>${dials()}</g>`,
    `<path class="iso-line" data-tone="hi" data-free="" data-needle="lift" d="${needle(...DIALS.lift, 0)}"/>`,
    `<path class="iso-line" data-tone="hi" data-free="" data-needle="drag" d="${needle(...DIALS.drag, 0)}"/>`,
    hubs(),
    pitot(),
    ...pieces.filter((p) => p.key < depth([WING.x, TY, AXZ])).map((p) => p.svg),
    sting(),
    `<g data-wing>${wings[0 - DEG_MIN]}</g>`,
    ...pieces.filter((p) => p.key >= depth([WING.x, TY, AXZ])).map((p) => p.svg),
    `<g data-blades></g>`,
    guard(),
    motor(),
    knob(),
    `<path class="iso-line" data-tone="hi" data-knob d="${knobPointer(0)}"/>`,
    D([at([KNOB[0], KNOB[1], BAL_H + 3.4])], { size: 0.6, tone: "hi" }),
    k.wireSvg(wireFrom, wireTo, { via: [at([PITOT.x, MANO.y - 1.6, 1])], tone: "lo" }),
    manometer(),
    `<g data-tubes>${tubes(0)}</g>`,
    cable,
    controller(),
    `<path class="iso-line" data-tone="hi" data-bars data-free="" d="${displayBars(0)}"/>`,
    speedKnob(),
    `<path class="iso-line" data-tone="hi" data-speed d="${speedPointer(0)}"/>`,
    D([at([SKNOB[0], SKNOB[1], 17.6])], { size: 0.6, tone: "hi" }),
  ],
});

const stage = `<div class="iso-stage aerospace-tunnel-stage" tabindex="0" role="group" aria-roledescription="wind tunnel" aria-label="Wind tunnel. Left and Right arrows change the angle of attack, Up and Down the airspeed.">${svg}<span class="aerospace-tunnel-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Wind tunnel",
  hint: "← → angle · ↑ ↓ airspeed",
  readout: "α 0° · 0 m/s",
  keys: [
    { mark: "lit", label: "The wing, on the balance's sting" },
    { mark: "raised", label: "The manometer: dynamic pressure from the pitot tube" },
  ],
  caption:
    "The fan sucks air through the contraction into the open jet, where the wing (chord 50 mm, span 150 mm) sits on a two-component balance. Lift and drag follow L = ½ρv²S·CL and D = ½ρv²S·CD, with thin-airfoil CL = 2πα up to stall near 15° and CD = CD0 + CL²/(πeAR). The pitot tube reads the dynamic pressure ½ρv², shown as the manometer's height difference Δh = ½ρv²/(ρ_water·g). The wing's angle and the liquid columns are drawn true to scale; the dial needles are scaled to their faces.",
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="aerospace-tunnel">${plateBody}</div>`;

const css = `
.iso[data-anatomy="aerospace-tunnel"]{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:760px;margin:0 auto;color:var(--anatomy-text)}
.iso[data-anatomy="aerospace-tunnel"][data-theme="light"],html:not(.dark) .iso[data-anatomy="aerospace-tunnel"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso[data-anatomy="aerospace-tunnel"] .iso-figure{margin:0}
.iso[data-anatomy="aerospace-tunnel"] .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso[data-anatomy="aerospace-tunnel"] .iso-plate-corner{font-family:inherit;font-size:11px}
.iso[data-anatomy="aerospace-tunnel"] .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso[data-anatomy="aerospace-tunnel"] .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso[data-anatomy="aerospace-tunnel"] .iso-legend{font-size:13px}
.iso[data-anatomy="aerospace-tunnel"] .aerospace-tunnel-stage{position:relative;outline:none;touch-action:pan-y}
.iso[data-anatomy="aerospace-tunnel"] .aerospace-tunnel-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso[data-anatomy="aerospace-tunnel"] .aerospace-tunnel-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso[data-anatomy="aerospace-tunnel"] [data-blades] path{fill:var(--anatomy-paper);stroke:var(--anatomy-mid,currentColor);stroke-width:.6;stroke-linejoin:round}
@media (max-width:560px){.iso[data-anatomy="aerospace-tunnel"] .iso-plate{padding:40px 4px 64px}}
`.trim() + "\n";

// ---------------------------------------------------------------- live script
const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const WINGS = ${JSON.stringify(wings)};
const DEG_MIN = ${DEG_MIN}, DEG_MAX = ${DEG_MAX};
const DIALS = ${JSON.stringify(DIALS)}, DIAL_R = ${DIAL_R}, SWEEP = ${SWEEP}, BAL_H = ${BAL_H};
const KNOB = ${JSON.stringify(KNOB)}, SKNOB = ${JSON.stringify(SKNOB)}, CTRL = ${JSON.stringify(CTRL)};
const MTUBES = ${JSON.stringify(MTUBES)}, MANO = ${JSON.stringify(MANO)}, M_REST = ${M_REST}, M_Z0 = ${M_Z0}, M_TOP = ${M_TOP};
const AXZ = ${AXZ}, TY = ${TY}, FAN = ${JSON.stringify(FAN)}, FAN_R = ${FAN_R};
const k = { solidSvg, cylinder, lineOnTop, iso };
const at = (p) => iso(p, P);
const needle = ${needle.toString()};
const knobPointer = ${knobPointer.toString()};
const speedPointer = ${speedPointer.toString()};
const displayBars = ${displayBars.toString()};
${tubes.toString()}

// The aerodynamics: shared with the airfoil block on the page.
const rad = (d) => (d * Math.PI) / 180;
function cl(deg) {
  const lin = 2 * Math.PI * rad(deg);
  if (Math.abs(deg) <= M.stall) return lin;
  const top = 2 * Math.PI * rad(M.stall) * Math.sign(deg);
  return top * (0.62 + 0.38 * Math.exp(-(Math.abs(deg) - M.stall) / 2.5));
}
function cd(deg) {
  const c = cl(deg);
  const sep = Math.abs(deg) > M.stall ? 0.035 * (Math.abs(deg) - M.stall) : 0;
  return M.CD0 + (c * c) / (Math.PI * M.e * M.AR) + sep;
}
const LIFT_FS = 6, DRAG_FS = 1.6; // dial full scale, N

function blades(phase) {
  const s = FAN[1] - 2;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const th = phase + (i * 2 * Math.PI) / 5;
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const r = 5 + ((FAN_R - 4 - 5) * j) / 6;
      pts.push([r, th - 0.12 - 0.22 * (j / 6)]);
    }
    for (let j = 6; j >= 0; j--) {
      const r = 5 + ((FAN_R - 4 - 5) * j) / 6;
      pts.push([r, th + 0.12 + 0.05 * (j / 6)]);
    }
    const d = pts.map(([r, a], n) => (n ? "L" : "M") + at([s, TY + r * Math.cos(a), AXZ + r * Math.sin(a)]).join(" ")).join("") + "Z";
    out.push('<path d="' + d + '"/>');
  }
  return out.join("");
}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".aerospace-tunnel-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const wingEl = svg.querySelector("[data-wing]");
  const needleL = svg.querySelector('[data-needle="lift"]');
  const needleD = svg.querySelector('[data-needle="drag"]');
  const knobEl = svg.querySelector("[data-knob]");
  const speedEl = svg.querySelector("[data-speed]");
  const barsEl = svg.querySelector("[data-bars]");
  const tubesEl = svg.querySelector("[data-tubes]");
  const bladesEl = svg.querySelector("[data-blades]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // Targets and the shown values, which follow them smoothly.
  let alpha = 6, v = 18, shownA = 6, shownV = 18, phase = 0;
  let touched = 0, frame = 0, last = 0, visible = false, tourT = 0, wingDeg = null;
  const TOUR = [[0, 12], [6, 18], [12, 22], [17, 22], [8, 26], [2, 14]];

  function render() {
    const deg = Math.round(shownA);
    if (deg !== wingDeg) { wingDeg = deg; wingEl.innerHTML = WINGS[Math.min(DEG_MAX, Math.max(DEG_MIN, deg)) - DEG_MIN]; }
    const q = 0.5 * M.rho * shownV * shownV;
    const Lf = q * M.S * cl(shownA), Df = q * M.S * cd(shownA);
    needleL.setAttribute("d", needle(...DIALS.lift, Math.min(1, Math.max(0, Lf / LIFT_FS))));
    needleD.setAttribute("d", needle(...DIALS.drag, Math.min(1, Math.max(0, Df / DRAG_FS))));
    knobEl.setAttribute("d", knobPointer(shownA));
    speedEl.setAttribute("d", speedPointer(shownV));
    barsEl.setAttribute("d", displayBars(shownV));
    const dh = (q / (M.rhoW * M.g)) * 1000 / 5; // metres → mm → world units (5 mm)
    tubesEl.innerHTML = tubes(dh);
    bladesEl.innerHTML = blades(phase);
    const text = "α " + Math.round(shownA) + "° · " + shownV.toFixed(0) + " m/s · L " + Lf.toFixed(2) + " N · D " + Df.toFixed(2) + " N" + (Math.abs(shownA) > M.stall ? " · stalled" : "");
    if (readout.textContent !== text) readout.textContent = text;
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (performance.now() - touched > 6000) {
      tourT += dt;
      const step = TOUR[Math.floor(tourT / 3.2) % TOUR.length];
      alpha = step[0]; v = step[1];
    }
    const f = 1 - Math.exp(-dt * 3);
    shownA += (alpha - shownA) * f;
    shownV += (v - shownV) * f;
    phase += dt * shownV * 0.35; // the fan's speed follows the airspeed (slowed to be readable)
    render();
    frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => {
    if (still.matches) { shownA = alpha; shownV = v; render(); return; }
    if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); }
  };
  stage.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowRight") alpha = Math.min(DEG_MAX, alpha + step);
    else if (e.key === "ArrowLeft") alpha = Math.max(DEG_MIN, alpha - step);
    else if (e.key === "ArrowUp") v = Math.min(30, v + step);
    else if (e.key === "ArrowDown") v = Math.max(0, v - step);
    else return;
    e.preventDefault();
    touched = performance.now();
    say.textContent = "Angle " + alpha + " degrees, " + v + " metres per second";
    run();
  });
  // Pointer: drag sideways to set the angle, up and down for the airspeed.
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, a: alpha, v }; stage.setPointerCapture(e.pointerId); touched = performance.now(); });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    alpha = Math.round(Math.min(DEG_MAX, Math.max(DEG_MIN, drag.a + (e.clientX - drag.x) / 8)));
    v = Math.round(Math.min(30, Math.max(0, drag.v - (e.clientY - drag.y) / 6)));
    touched = performance.now();
    run();
  });
  const end = () => (drag = null);
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  still.addEventListener?.("change", run);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  render();
}

function start() { document.querySelectorAll('[data-anatomy="aerospace-tunnel"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/aerospace-tunnel/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${live}`;

writeFileSync(join(OUT, "aerospace-tunnel.html"), fragment + "\n");
writeFileSync(join(OUT, "aerospace-tunnel.css"), css);
writeFileSync(join(OUT, "aerospace-tunnel.js"), js);

const shared = readFileSync(join(OUT, "iso.css"), "utf8");
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wind tunnel</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${shared}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log("wrote aerospace-tunnel.html, .css, .js, previews · wing frames", wings.length, "· bytes", fragment.length, js.length);
void vectorOf;
