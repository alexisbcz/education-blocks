// Fig · Four-stroke engine — a single-cylinder DOHC engine on a bench plate,
// with a glass cylinder so the piston, the valves and the charge are visible.
// Run from the repo root: node figures/car-engine/build.mjs
// Writes site/static/anatomy/{car-engine.html, car-engine.css, car-engine.js}
// and figures/car-engine/preview{,-light}.html. The shared iso.css is not
// touched: car-engine.css carries the kit CSS scoped under
// [data-anatomy="car-engine"], plus the figure's own rules.
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
// One crank angle θ (0–720°, 0 = top dead centre at the start of intake)
// drives everything. Piston: the exact slider-crank, x = r cos θ + √(l² − r² sin² θ).
// Cams turn at half crank speed. Valve events are typical for a road engine.
const MM = { r: 43, l: 143, bore: 86 }; // crank radius, rod length, bore (mm)
const EV = {
  intake: { open: -10, close: 220, lift: 9 }, // opens 10° BTDC, closes 40° ABDC
  exhaust: { open: 500, close: 730, lift: 9 }, // opens 40° BBDC, closes 10° ATDC
  spark: 345, // 15° BTDC on compression
};
const STROKES = ["Intake", "Compression", "Power", "Exhaust"];
const xOf = (deg) => {
  const t = (deg * Math.PI) / 180;
  return MM.r * Math.cos(t) + Math.sqrt(MM.l * MM.l - (MM.r * Math.sin(t)) ** 2);
};
const liftOf = (deg, ev) => {
  // A tangent cam under a flat bucket: base circle, straight flanks and a
  // nose circle. The bucket rides the cam's support function, so the lift at
  // cam angle ψ from the nose is L (cos ψ − cos h) / (1 − cos h), where h is
  // half the event in cam degrees (cam at half crank speed). Cycle 720°.
  const a = (((deg - ev.open) % 720) + 720) % 720;
  const span = ev.close - ev.open;
  if (a > span) return 0;
  const h = (span / 4) * (Math.PI / 180), psi = ((a - span / 2) / 2) * (Math.PI / 180);
  return Math.max(0, (ev.lift * (Math.cos(psi) - Math.cos(h))) / (1 - Math.cos(h)));
};

// ---------------------------------------------------------------- layout (world units, z up; +y toward the viewer)
const WIDTH = 600, HEIGHT = 560;
const S = 18 / MM.r; // world units per mm
const CR = MM.r * S, ROD = MM.l * S; // 18, 59.9
const CX = 0, CZ = 62; // crankshaft axis (along y)
const PIN_TO_CROWN = 12; // gudgeon pin to piston crown
const BORE_R = (MM.bore / 2) * S; // 18
const PISTON_H = 20;
const crownZ = (deg) => CZ + xOf(deg) * S + PIN_TO_CROWN;
const TDC = crownZ(0); // 160
const HEAD_Z = TDC + 6; // underside of the head: a 6-unit clearance at TDC
const HEAD = { x: -26, y: -20, w: 52, d: 40, r: 3 };
const HEAD_H = 18;
const TOP_Z = HEAD_Z + HEAD_H;
const VX = { intake: -9, exhaust: 9 }; // valve axes, x
const VALVE_R = 6; // valve head radius
const CAM_Z = TOP_Z + 22.5; // camshaft axes (along y)
const CAM_BASE = 7, CAM_NOSE = EV.intake.lift * S, CAM_W = 2.6; // base circle, nose rise, half the lobe width
const FLY = { y0: -48, y1: -41, r: 36 };
const YU = [-26, 24]; // bearing uprights
const BELT_Y = -33; // timing belt plane, behind the cylinder
const PULLEY = { crank: 7, cam: 14 }; // 2:1
const PLATE = { x: -96, y: -62, w: 200, d: 118, r: 8 };
const PLATE_H = 10, FOOT_H = 5;
const AXIS = G.frameAlong([CX, 0, CZ], [0, 1, 0]);
const CAMAX = { intake: G.frameAlong([VX.intake, 0, CAM_Z], [0, 1, 0]), exhaust: G.frameAlong([VX.exhaust, 0, CAM_Z], [0, 1, 0]) };
const THETA0 = 300; // degrees: late compression, both valves shut

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CX, FLY.y0, CZ + FLY.r], [CX, FLY.y0, CZ - FLY.r], [0, 0, CAM_Z + 30], [VX.exhaust + 16, BELT_Y, CAM_Z + 16], [-70, 0, TOP_Z - 6], [64, 20, 0]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 40 },
);
const at = (p) => k.iso(p, P);
const { depthOf, iso, pathOf } = k; // used by coilZ, which also ships to the page
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const T = (by) => k.translateAlong(P, by);
const view = k.towardViewer(P);
const f2 = (v) => v.toFixed(2);
const M = (p) => { const q = at(p); return `${f2(q[0])} ${f2(q[1])}`; };

// ---------------------------------------------------------------- base
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
  // label plate, front left
  const label = { x: -84, y: 30, w: 44, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([28, 18, 32].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- crank, flywheel, belt
function upright(y) {
  const out = [];
  const foot = { x: CX - 13, y: y - 6, w: 26, d: 12, r: 1.4 };
  out.push(S_(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(Dots([at([foot.x + 3, y, 4]), at([foot.x + foot.w - 3, y, 4])], { size: 0.45, tone: "lo" }));
  const post = { x: CX - 5, y: y - 2.4, w: 10, d: 4.8, r: 1 };
  out.push(S_(k.slabOf(post, 4, CZ - 4 - 7, P, 3, 0.4), { tone: "mid" }));
  out.push(S_(G.disc(y - 3.2, y + 3.2, 8, AXIS, P), { tone: "mid", inner: L(G.circleOf(AXIS, view[1] > 0 ? y + 3.2 : y - 3.2, 4.2, P), { tone: "lo" }) }));
  return out.join("");
}

const FLY_FACE = view[1] > 0 ? FLY.y1 : FLY.y0;
function flywheel() {
  const out = [];
  const inner = L(G.circleOf(AXIS, FLY_FACE, FLY.r - 5, P), { tone: "lo" }) + L(G.circleOf(AXIS, FLY_FACE, 10, P), { tone: "faint" });
  out.push(S_(G.disc(FLY.y0, FLY.y1, FLY.r, AXIS, P), { tone: "mid", inner }));
  out.push(`<g data-ce-spokes>${spokes(THETA0)}</g>`);
  out.push(S_(G.disc(FLY.y0 - 2, FLY.y1 + 2, 7, AXIS, P), { tone: "mid" }));
  out.push(Dots(G.dotsOf(AXIS, FLY.y1 + 2, 4.6, 4, P, { all: true }), { size: 0.45, tone: "lo" }));
  return out.join("");
}
function spokes(deg) {
  const d = [];
  for (let q = 0; q < 5; q++) {
    const a = (deg * Math.PI) / 180 + (q * 2 * Math.PI) / 5;
    d.push(`M${M([CX + 10 * Math.cos(a), FLY_FACE, CZ + 10 * Math.sin(a)])}L${M([CX + (FLY.r - 5) * Math.cos(a), FLY_FACE, CZ + (FLY.r - 5) * Math.sin(a)])}`);
  }
  return `<path class="ce-spoke" d="${d.join("")}"/>`;
}
const crankshaft = () => S_(G.disc(FLY.y0 - 2, YU[1] + 5, 2.6, AXIS, P), { tone: "hi", crease: "none" });

// Timing belt round the crank pulley and both cam pulleys: the convex hull of
// the three circles, drawn in the belt plane behind the cylinder.
function beltPath() {
  const pts = [];
  const circ = (cx, cz, r) => { for (let i = 0; i < 72; i++) { const a = (i / 72) * 2 * Math.PI; pts.push([cx + (r + 1.2) * Math.cos(a), cz + (r + 1.2) * Math.sin(a)]); } };
  circ(CX, CZ, PULLEY.crank);
  circ(VX.intake, CAM_Z, PULLEY.cam);
  circ(VX.exhaust, CAM_Z, PULLEY.cam);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return "M" + hull.map(([x, z]) => M([x, BELT_Y, z])).join("L") + "Z";
}
function pulleys() {
  const out = [];
  const F = G.frameAlong([CX, 0, CZ], [0, 1, 0]);
  out.push(S_(G.disc(BELT_Y - 3, BELT_Y + 3, PULLEY.crank, F, P), { tone: "mid" }));
  for (const which of ["intake", "exhaust"]) {
    const C = CAMAX[which];
    out.push(S_(G.disc(BELT_Y - 3, BELT_Y + 3, PULLEY.cam, C, P), { tone: "mid", inner: L(G.circleOf(C, view[1] > 0 ? BELT_Y + 3 : BELT_Y - 3, PULLEY.cam - 3.5, P), { tone: "faint" }) }));
  }
  out.push(`<path class="ce-belt" d="${beltPath()}"/>`);
  out.push(`<g data-ce-marks>${timingMarks(THETA0)}</g>`);
  return out.join("");
}
// One timing dot per pulley: the cam dots turn at half the crank's speed.
function timingMarks(deg) {
  const face = view[1] > 0 ? BELT_Y + 3 : BELT_Y - 3;
  const a = (deg * Math.PI) / 180;
  const dots = [[CX + 4.6 * Math.sin(a), face, CZ + 4.6 * Math.cos(a)], [VX.intake + 10 * Math.sin(a / 2), face, CAM_Z + 10 * Math.cos(a / 2)], [VX.exhaust + 10 * Math.sin(a / 2), face, CAM_Z + 10 * Math.cos(a / 2)]];
  return dots.map((p) => { const q = at(p); return `<circle class="ce-mark" cx="${f2(q[0])}" cy="${f2(q[1])}" r="1.4"/>`; }).join("");
}

// ---------------------------------------------------------------- cylinder (glass) and the head
const LINER_Z0 = CZ + 32; // the liner starts above the crank
function linerBack() {
  // the inside of the glass: the far wall, darker
  const out = [];
  out.push(S_(k.cylinder(CX, 0, BORE_R + 4, LINER_Z0 - 4, 4, P, 64, 0.4), { tone: "mid" }));
  out.push(`<path class="ce-bore" d="${k.cylinder(CX, 0, BORE_R + 1, LINER_Z0, HEAD_Z - LINER_Z0, P, 64).fill}"/>`);
  return out.join("");
}
function linerFront() {
  // the near wall of the glass: a tinted sheet with rim lines and two clamp bands
  const cyl = k.cylinder(CX, 0, BORE_R + 1, LINER_Z0, HEAD_Z - LINER_Z0, P, 64);
  return `<path class="ce-glass" d="${cyl.fill}"/>` + L(k.sideArc(CX, 0, BORE_R + 1, LINER_Z0 + 14, P, 64) + k.sideArc(CX, 0, BORE_R + 1, HEAD_Z - 12, P, 64), { tone: "lo" }) + L(k.sideArc(CX, 0, BORE_R + 1, LINER_Z0, P, 64) + k.sideArc(CX, 0, BORE_R + 1, HEAD_Z, P, 64), { tone: "mid" });
}
function tieRods(back) {
  // four studs from the base flange to the head clamp the glass
  const out = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = CX + sx * (BORE_R + 6), y = sy * (BORE_R - 2);
    const isBack = k.depthOf([x, y, 0], P) < k.depthOf([CX, 0, 0], P);
    if (isBack !== back) continue;
    out.push(S_(k.cylinder(x, y, 1.3, LINER_Z0, HEAD_Z - LINER_Z0, P, 12), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}
function crankcase(back) {
  // the base flange stands on four studs (the tie rods carried down to the
  // plate), leaving the crank open to view; a bore hole lets the rod through
  const out = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = CX + sx * (BORE_R + 6), y = sy * (BORE_R - 2);
    const isBack = k.depthOf([x, y, 0], P) < k.depthOf([CX, 0, 0], P);
    if (isBack !== back) continue;
    out.push(S_(k.cylinder(x, y, 3.2, 0, 3, P, 18, 0.3), { tone: "mid" }));
    out.push(S_(k.cylinder(x, y, 1.8, 3, LINER_Z0 - 9, P, 14), { tone: "mid", crease: "none" }));
  }
  if (!back) {
    const flange = { x: CX - BORE_R - 9, y: -BORE_R - 1, w: 2 * BORE_R + 18, d: 2 * BORE_R + 2, r: 2 };
    out.push(S_(k.slabOf(flange, LINER_Z0 - 6, 3, P, 4, 0.4), { tone: "mid", inner: L(k.ring(CX, 0, BORE_R - 1, LINER_Z0 - 3, P, 48), { tone: "lo" }) }));
    out.push(Dots([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => at([CX + sx * (BORE_R + 6), sy * (BORE_R - 2), LINER_Z0 - 3])), { size: 0.5, tone: "lo" }));
  }
  return out.join("");
}
function head() {
  const out = [];
  out.push(S_(k.slabOf(HEAD, HEAD_Z, HEAD_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(HEAD, HEAD_Z + 5, P, 4), { tone: "faint" }) }));
  // cooling fins along the head's sides
  for (const z of [HEAD_Z + 9, HEAD_Z + 13]) out.push(L(k.sideSeam(k.insetPlan(HEAD, -0.01), z, P, 4), { tone: "lo" }));
  out.push(Dots([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => at([CX + sx * (BORE_R + 6), sy * (BORE_R - 2), TOP_Z])), { size: 0.55, tone: "lo" }));
  // two cam towers at the back carry the overhung camshafts (front left open)
  for (const y of [-24, -12]) {
    const tower = { x: -20, y: y - 3, w: 40, d: 6, r: 1 };
    out.push(S_(k.slabOf(tower, TOP_Z, CAM_Z - TOP_Z + 3, P, 3, 0.4), { tone: "mid" }));
  }
  return out.join("");
}
function ports() {
  const out = [];
  // intake: a stub and a round air filter on the left
  const stub = { x: -40, y: -5, w: 14, d: 10, r: 1.5 };
  out.push(S_(k.slabOf(stub, HEAD_Z + 4, 8, P, 3, 0.4), { tone: "mid" }));
  const FX = G.frameAlong([-40, 0, HEAD_Z + 8], [-1, 0, 0]);
  out.push(S_(G.disc(0, 3, 9, FX, P), { tone: "mid" }));
  out.push(S_(G.disc(3, 14, 13, FX, P), { tone: "lo", inner: L(G.ribsOf(FX, 4, 13, 13, 22, P, { least: 0.15, seams: true }), { tone: "faint" }) }));
  out.push(S_(G.disc(14, 16, 13.6, FX, P), { tone: "mid" }));
  // exhaust: a stub and a muffler drum on the right
  const ex = { x: 26, y: -5, w: 14, d: 10, r: 1.5 };
  out.push(S_(k.slabOf(ex, HEAD_Z + 4, 8, P, 3, 0.4), { tone: "mid" }));
  const FE = G.frameAlong([40, 0, HEAD_Z + 8], [1, 0, 0]);
  out.push(S_(G.disc(0, 3, 7, FE, P), { tone: "mid" }));
  out.push(S_(G.disc(3, 26, 9, FE, P), { tone: "mid", inner: L(G.circleOf(FE, 12, 9, P) + G.circleOf(FE, 19, 9, P), { tone: "faint" }) }));
  out.push(S_(G.disc(26, 30, 3, FE, P), { tone: "lo" }));
  return out.join("");
}
function sparkPlug() {
  const out = [];
  out.push(S_(k.cylinder(CX, 0, 3.4, TOP_Z, 3, P, 6, 0.2), { tone: "mid" })); // hex
  out.push(S_(k.cylinder(CX, 0, 2.2, TOP_Z + 3, 9, P, 24), { tone: "hi", crease: "none", inner: L(k.sideArc(CX, 0, 2.2, TOP_Z + 6, P, 24) + k.sideArc(CX, 0, 2.2, TOP_Z + 8.5, P, 24), { tone: "faint" }) }));
  out.push(S_(k.cylinder(CX, 0, 1.2, TOP_Z + 12, 2.4, P, 16), { tone: "mid" }));
  return out.join("");
}
function coilPack() {
  // ignition coil on the plate, with its lead to the plug
  const out = [];
  const box = { x: 46, y: 22, w: 16, d: 12, r: 1.5 };
  out.push(S_(k.slabOf(box, 0, 14, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(box, 10, P, 3), { tone: "faint" }) }));
  out.push(S_(k.cylinder(54, 28, 2, 14, 3, P, 16), { tone: "lo" }));
  out.push(k.wireSvg(at([54, 28, 17]), at([CX, 0, TOP_Z + 14.4]), { via: [at([54, 28, CAM_Z + 26]), at([CX + 6, 0, CAM_Z + 26]), at([CX, 0, CAM_Z + 22])], tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving parts
// Piston: drawn at rest (crank at THETA0), translated along z live.
function piston() {
  const z0 = crownZ(THETA0) - PISTON_H;
  return S_(k.cylinder(CX, 0, BORE_R - 0.6, z0, PISTON_H, P, 56, 0.6), { tone: "hi", lit: true, inner: L(k.sideArc(CX, 0, BORE_R - 0.6, z0 + PISTON_H - 3, P, 56) + k.sideArc(CX, 0, BORE_R - 0.6, z0 + PISTON_H - 5.5, P, 56) + k.sideArc(CX, 0, BORE_R - 0.6, z0 + PISTON_H - 8, P, 56), { tone: "lo" }) });
}
// Crank web, pin and connecting rod, rebuilt each frame.
function links(deg) {
  const a = (deg * Math.PI) / 180;
  const pin = [CX + CR * Math.sin(a), 0, CZ + CR * Math.cos(a)];
  const gudgeon = [CX, 0, crownZ(deg) - PIN_TO_CROWN];
  const c = at([CX, 0, CZ]), p = at(pin), g = at(gudgeon);
  const cw = at([CX - 14 * Math.sin(a), 0, CZ - 14 * Math.cos(a)]);
  return `<path class="ce-web" d="M${f2(cw[0])} ${f2(cw[1])}L${f2(p[0])} ${f2(p[1])}"/>` +
    `<path class="ce-rod" d="M${f2(p[0])} ${f2(p[1])}L${f2(g[0])} ${f2(g[1])}"/>` +
    `<circle class="ce-eye" cx="${f2(p[0])}" cy="${f2(p[1])}" r="2.6"/><circle class="ce-eye" cx="${f2(g[0])}" cy="${f2(g[1])}" r="2.2"/><circle class="ce-hub" cx="${f2(c[0])}" cy="${f2(c[1])}" r="1.6"/>`;
}
// Charge in the cylinder between the crown and the head, tinted by stroke.
function charge(deg) {
  const z0 = crownZ(deg), z1 = HEAD_Z;
  return `<path class="ce-charge" d="${k.cylinder(CX, 0, BORE_R - 0.4, z0, z1 - z0, P, 56).fill}"/>`;
}
// A poppet valve: head disc under the head, stem up through it, the spring
// and the bucket tappet above. Drawn closed; the live code translates it.
const STEM_TOP = CAM_Z - CAM_BASE - 4; // the bucket's top touches the cam's base circle
function valveLow(x) {
  return S_(k.cylinder(x, 0, VALVE_R, HEAD_Z - 2.2, 2.2, P, 32, 0.4), { tone: "hi", crease: "none" }) + S_(k.cylinder(x, 0, 1.1, HEAD_Z, 1.5, P, 12), { tone: "mid", crease: "none" });
}
function valveHigh(x) {
  return S_(k.cylinder(x, 0, 4.4, STEM_TOP, 4, P, 28, 0.4), { tone: "mid" }) + S_(k.cylinder(x, 0, SPRING_R, STEM_TOP - 1.6, 1.6, P, 24), { tone: "lo" });
}
function coilZ(x, z0, z1, radius, turns) {
  const back = [], front = [];
  let run = [], near = null;
  const count = Math.round(turns * 16);
  for (let i = 0; i <= count; i++) {
    const s = i / count, a = s * turns * 2 * Math.PI;
    const pt = [x + radius * Math.cos(a), radius * Math.sin(a), z0 + (z1 - z0) * s];
    const facing = depthOf([Math.cos(a), Math.sin(a), 0], P) > 0;
    const flat = iso(pt, P);
    if (near === null) near = facing;
    if (facing !== near) { run.push(flat); (near ? front : back).push(pathOf(run)); run = [flat]; near = facing; continue; }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(pathOf(run));
  return { back: back.join(""), front: front.join("") };
}
const SPRING_R = 3.6;
const springOf = (x, lift) => coilZ(x, TOP_Z + 1, STEM_TOP - 1.6 - lift, SPRING_R, 5);
function springSeats() {
  return [VX.intake, VX.exhaust].map((x) => S_(k.cylinder(x, 0, SPRING_R, TOP_Z, 1, P, 24), { tone: "lo" })).join("");
}
// A cam lobe: a tangent cam (base circle, two straight flanks, nose circle)
// whose nose points down at the centre of the valve's event, extruded
// ±CAM_W along the camshaft. Its lift matches liftOf exactly: the nose
// circle's centre sits d = L / (1 − cos h) out, with radius Rb − L cos h / (1 − cos h).
function camLobe(which, deg) {
  const ev = EV[which];
  const centre = (ev.open + ev.close) / 2;
  const phi = ((deg - centre) / 2) * (Math.PI / 180); // cam turns at half speed
  const h = ((ev.close - ev.open) / 4) * (Math.PI / 180); // half the event, cam radians
  const d = CAM_NOSE / (1 - Math.cos(h)), rn = CAM_BASE - d + CAM_NOSE;
  const cx = VX[which];
  const ring = [];
  for (let i = 0; i <= 16; i++) ring.push([d, rn, -h + (2 * h * i) / 16]); // nose arc
  for (let i = 0; i <= 40; i++) ring.push([0, CAM_BASE, h + ((2 * Math.PI - 2 * h) * i) / 40]); // base arc
  const face = (y) => ring.map(([off, r, u]) => {
    const a0 = phi, a1 = u + phi; // nose axis, then the point's direction
    return [cx + off * Math.sin(a0) + r * Math.sin(a1), y, CAM_Z - off * Math.cos(a0) - r * Math.cos(a1)];
  });
  const front = face(CAM_W), back = face(-CAM_W);
  // The lobe is convex, so its outline is the hull of both faces.
  const pts = front.concat(back).map(at).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const out = []; for (const p of list) { while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  const hull = half(pts).concat(half(pts.slice().reverse()));
  const P2 = (q) => q[0].toFixed(2) + " " + q[1].toFixed(2);
  return `<path class="ce-cam-side" d="M${hull.map(P2).join("L")}Z"/><path class="ce-cam" d="M${front.map(M).join("L")}Z"/>`;
}
function camshafts() {
  // The shaft behind the lobe; the stub and collar in front come after it.
  return ["intake", "exhaust"].map((w) => S_(G.disc(BELT_Y + 3, -CAM_W, 2.4, CAMAX[w], P), { tone: "hi", crease: "none" })).join("");
}
function camStubs() {
  return ["intake", "exhaust"].map((w) => S_(G.disc(CAM_W, 6, 2.4, CAMAX[w], P), { tone: "hi", crease: "none" }) + S_(G.disc(6, 7.4, 3.2, CAMAX[w], P), { tone: "mid" })).join("");
}

// ---------------------------------------------------------------- assemble
const LABEL =
  "A single-cylinder four-stroke engine on a bench plate. The crankshaft turns on two bearing uprights with a spoked flywheel at the back. A connecting rod drives the piston inside a glass cylinder clamped under the cylinder head by four studs. Two overhead camshafts, turned at half crank speed by a timing belt at the back, open the intake valve on the left and the exhaust valve on the right through bucket tappets and springs. A spark plug sits between the cams; an air filter feeds the intake port and a muffler sits on the exhaust port.";

const stage = (svg) => `<div class="iso-stage ce-stage" tabindex="0" role="group" aria-roledescription="engine control" aria-label="Four-stroke engine. Left and Right arrows turn the crank by 10 degrees, Shift for 90; Space pauses.">${svg}<span class="ce-sr" aria-live="polite" data-say></span></div>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    flywheel(),
    `<g data-ce-belt-back></g>`,
    pulleys(),
    upright(YU[0]),
    crankshaft(),
    crankcase(true),
    tieRods(true),
    linerBack(),
    crankcase(false),
    `<g data-ce-charge>${charge(THETA0)}</g>`,
    `<g data-ce-links>${links(THETA0)}</g>`,
    `<g data-ce-piston>${piston()}</g>`,
    `<g data-ce-valve-low="intake">${valveLow(VX.intake)}</g>`,
    `<g data-ce-valve-low="exhaust">${valveLow(VX.exhaust)}</g>`,
    `<g data-ce-spark><circle class="ce-spark" cx="${f2(at([CX, 0, HEAD_Z - 1])[0])}" cy="${f2(at([CX, 0, HEAD_Z - 1])[1])}" r="7"/></g>`,
    linerFront(),
    tieRods(false),
    ports(),
    head(),
    springSeats(),
    `<g data-ce-spring="intake">${L(springOf(VX.intake, 0).back + springOf(VX.intake, 0).front, { tone: "mid" })}</g>`,
    `<g data-ce-spring="exhaust">${L(springOf(VX.exhaust, 0).back + springOf(VX.exhaust, 0).front, { tone: "mid" })}</g>`,
    `<g data-ce-valve-high="intake">${valveHigh(VX.intake)}</g>`,
    `<g data-ce-valve-high="exhaust">${valveHigh(VX.exhaust)}</g>`,
    camshafts(),
    `<g data-ce-cams>${camLobe("intake", THETA0)}${camLobe("exhaust", THETA0)}</g>`,
    camStubs(),
    sparkPlug(),
    upright(YU[1]),
  ],
});

const strokeOf = (deg) => STROKES[Math.floor((((deg % 720) + 720) % 720) / 180)];
const readoutOf = (deg) => {
  const d = (((deg % 720) + 720) % 720);
  const below = MM.r + MM.l - xOf(d);
  return `${strokeOf(d)} · ${d.toFixed(0)}° · piston −${below.toFixed(1)} mm · valves ${liftOf(d, EV.intake).toFixed(1)}/${liftOf(d, EV.exhaust).toFixed(1)} mm`;
};

const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Four-stroke engine",
  hint: "← → turn crank · space pause",
  readout: readoutOf(THETA0),
  keys: [
    { mark: "lit", label: "Piston: x = r cos θ + √(l² − r² sin² θ)" },
    { mark: "dim", label: "Cams at half crank speed: one spark every two turns" },
  ],
  caption: `One crank angle drives every part. Bore ${MM.bore} mm, stroke ${2 * MM.r} mm, rod ${MM.l} mm (l/r = ${(MM.l / MM.r).toFixed(2)}). Intake opens 10° before TDC and closes 40° after BDC; exhaust opens 40° before BDC and closes 10° after TDC, so both are briefly open at the top of the exhaust stroke (overlap). The spark fires 15° before TDC on compression. At 90° past TDC the piston is ${(MM.r + MM.l - xOf(90)).toFixed(1)} mm down, more than half the stroke: the rod's angle makes the motion uneven.`,
  body: stage(svg),
});
const fragment = `<div class="iso" data-anatomy="car-engine">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="car-engine"]
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
const R_ = '[data-anatomy="car-engine"]';
const FIGURE_CSS = `
.iso${R_}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;--ce-intake:#3b82f6;--ce-comp:#a78bfa;--ce-power:#ff6a2b;--ce-exhaust:#71717a;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso${R_}[data-theme="light"],html:not(.dark) .iso${R_}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7;--ce-intake:#2563eb;--ce-comp:#7c3aed;--ce-power:#e8590c;--ce-exhaust:#71717a}
.iso${R_} .iso-figure{margin:0}
.iso${R_} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R_} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .ce-stage{position:relative;outline:none;cursor:default}
.iso${R_} .ce-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .ce-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .ce-spoke{fill:none;stroke:var(--anatomy-lo);stroke-width:2.4;stroke-linecap:round}
.iso${R_} .ce-web{fill:none;stroke:var(--anatomy-mid);stroke-width:5;stroke-linecap:round}
.iso${R_} .ce-rod{fill:none;stroke:var(--anatomy-hi);stroke-width:3.4;stroke-linecap:round}
.iso${R_} .ce-eye{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:1.2}
.iso${R_} .ce-hub{fill:var(--anatomy-hi)}
.iso${R_} .ce-belt{fill:none;stroke:var(--anatomy-lo);stroke-width:2.6;stroke-linejoin:round}
.iso${R_} .ce-mark{fill:var(--anatomy-hi)}
.iso${R_} .ce-bore{fill:var(--anatomy-paper);opacity:.55}
.iso${R_} .ce-glass{fill:color-mix(in srgb,var(--anatomy-hi) 7%,transparent);stroke:var(--anatomy-mid);stroke-width:.8;pointer-events:none}
.iso${R_} .ce-charge{fill:var(--ce-stroke,var(--ce-comp));opacity:var(--ce-fill,.18)}
.iso${R_} .ce-cam{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:1;stroke-linejoin:round}
.iso${R_} .ce-cam-side{fill:var(--anatomy-shade-0);stroke:var(--anatomy-hi);stroke-width:1;stroke-linejoin:round}
.iso${R_} .ce-spark{fill:#fde68a;opacity:0;filter:blur(1.6px)}
.iso${R_}[data-firing] .ce-spark{opacity:.95}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:10px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script (plain ES module)
const liveSrc = `
const P = ${JSON.stringify(P)};
const MM = ${JSON.stringify(MM)}, EV = ${JSON.stringify(EV)}, STROKES = ${JSON.stringify(STROKES)};
const S = ${S}, CR = ${CR}, CX = ${CX}, CZ = ${CZ}, PIN_TO_CROWN = ${PIN_TO_CROWN}, BORE_R = ${BORE_R};
const HEAD_Z = ${HEAD_Z}, TOP_Z = ${TOP_Z}, STEM_TOP = ${STEM_TOP}, VX = ${JSON.stringify(VX)};
const CAM_Z = ${CAM_Z}, CAM_BASE = ${CAM_BASE}, CAM_NOSE = ${CAM_NOSE}, CAM_W = ${CAM_W}, BELT_Y = ${BELT_Y}, FLY = ${JSON.stringify(FLY)}, FLY_FACE = ${FLY_FACE};
const THETA0 = ${THETA0}, VIEW_Y = ${view[1]};
const view = [0, VIEW_Y, 0];
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const M = (p) => { const q = at(p); return f2(q[0]) + " " + f2(q[1]); };
const xOf = ${xOf.toString()};
const liftOf = ${liftOf.toString()};
const crownZ = (deg) => CZ + xOf(deg) * S + PIN_TO_CROWN;
${spokes.toString()}
${timingMarks.toString()}
${links.toString()}
${coilZ.toString()}
const springOf = (x, lift) => coilZ(x, TOP_Z + 1, STEM_TOP - 1.6 - lift, ${SPRING_R}, 5);
${camLobe.toString()}
const cylinderFill = (z0, h) => cylinder(CX, 0, BORE_R - 0.4, z0, h, P, 56).fill;
const strokeOf = (deg) => STROKES[Math.floor((((deg % 720) + 720) % 720) / 180)];
const readoutOf = ${readoutOf.toString()};
const TINT = { Intake: "var(--ce-intake)", Compression: "var(--ce-comp)", Power: "var(--ce-power)", Exhaust: "var(--ce-exhaust)" };

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".ce-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const parts = {
    spokes: q("[data-ce-spokes]"), marks: q("[data-ce-marks]"), links: q("[data-ce-links]"), piston: q("[data-ce-piston]"),
    charge: q("[data-ce-charge]"), cams: q("[data-ce-cams]"),
    low: { intake: q('[data-ce-valve-low="intake"]'), exhaust: q('[data-ce-valve-low="exhaust"]') },
    high: { intake: q('[data-ce-valve-high="intake"]'), exhaust: q('[data-ce-valve-high="exhaust"]') },
    spring: { intake: q('[data-ce-spring="intake"]'), exhaust: q('[data-ce-spring="exhaust"]') },
  };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let deg = THETA0, paused = false, frame = 0, last = 0, visible = false;

  function draw() {
    const d = ((deg % 720) + 720) % 720;
    const dz = crownZ(d) - crownZ(THETA0);
    parts.piston.setAttribute("transform", translateAlong(P, [0, 0, dz]));
    parts.links.innerHTML = links(d);
    parts.spokes.innerHTML = spokes(d);
    parts.marks.innerHTML = timingMarks(d);
    const z0 = crownZ(d);
    parts.charge.innerHTML = '<path class="ce-charge" d="' + cylinderFill(z0, HEAD_Z - z0) + '"/>';
    const stroke = strokeOf(d);
    const firing = d >= EV.spark && d < EV.spark + 40;
    root.style.setProperty("--ce-stroke", TINT[stroke]);
    root.style.setProperty("--ce-fill", stroke === "Power" ? String(0.42 - 0.3 * ((d - 360) / 180)) : stroke === "Exhaust" ? "0.22" : "0.16");
    root.toggleAttribute("data-firing", firing);
    for (const w of ["intake", "exhaust"]) {
      const lift = liftOf(d, EV[w]) * S;
      parts.low[w].setAttribute("transform", translateAlong(P, [0, 0, -lift]));
      parts.high[w].setAttribute("transform", translateAlong(P, [0, 0, -lift]));
      const sp = springOf(VX[w], lift);
      parts.spring[w].innerHTML = '<path class="iso-line" data-tone="mid" d="' + sp.back + sp.front + '"/>';
    }
    parts.cams.innerHTML = camLobe("intake", d) + camLobe("exhaust", d);
    const text = readoutOf(d);
    if (readout.textContent !== text) readout.textContent = text;
  }

  // One cycle (two turns) every 4 s: slowed so the strokes can be followed.
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && !still.matches) deg = (deg + 180 * dt) % 720;
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") deg = (deg + (event.shiftKey ? 90 : 10)) % 720;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") deg = (deg + 720 - (event.shiftKey ? 90 : 10)) % 720;
    else if (event.key === " ") { paused = !paused; run(); event.preventDefault(); return; }
    else return;
    event.preventDefault();
    paused = true;
    draw();
    say.textContent = readoutOf(deg);
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

function start() { document.querySelectorAll('[data-anatomy="car-engine"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/car-engine/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, "car-engine.html"), fragment + "\n");
writeFileSync(join(OUT, "car-engine.css"), css);
writeFileSync(join(OUT, "car-engine.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Four-stroke engine</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`wrote car-engine.* · x(90°) = ${xOf(90).toFixed(2)} mm, ${(MM.r + MM.l - xOf(90)).toFixed(2)} mm below TDC · TDC crown z ${TDC.toFixed(1)}`);
