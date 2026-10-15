// Fig · Automatic weather station — a bench model of a synoptic station: a
// louvred Stevenson screen on legs, a mast with a cup anemometer and a wind
// vane on its crossarm, a tipping-bucket rain gauge with its funnel over an
// exposed see-saw, and a data logger wired to both. The wind speed turns the
// cups, the wind direction turns the vane, and rain tips the bucket every
// 0.2 mm.
// Run from the repo root: node figures/weather-station/build.mjs
// Writes site/static/anatomy/weather-station.{html,css,js} and the previews
// in figures/weather-station/. The CSS is the kit's, scoped under
// [data-anatomy="weather-station"].
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
const NAME = "weather-station";

// ---------------------------------------------------------------- model
// Beaufort force B ↔ speed: the WMO band limits, and v = 0.836 B^1.5 for the
// speed a force stands for. A cup anemometer's cups run at about a third of
// the wind speed (its factor, ≈ 3); with 70 mm arms that is ω = v / (3 · 0.07)
// rad/s, shown here ten times slower so the cups can be followed. The bucket
// tips every 0.2 mm of rain.
const BF_LIMITS = [0.2, 1.5, 3.3, 5.4, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
const BF_NAMES = ["calm", "light air", "light breeze", "gentle breeze", "moderate breeze", "fresh breeze", "strong breeze", "near gale", "gale", "strong gale", "storm", "violent storm", "hurricane force"];
const forceOf = (v) => {
  const i = BF_LIMITS.findIndex((l) => v < l + 0.05);
  return i < 0 ? 12 : i;
};
const speedOfForce = (b) => Math.round(0.836 * b ** 1.5 * 10) / 10;
const CUP_ARM = 0.07, CUP_FACTOR = 3, SLOW = 10;
const cupOmega = (v) => v / (CUP_FACTOR * CUP_ARM) / SLOW; // shown rad/s
const TIP_MM = 0.2, RAIN_RATE = 6, RAIN_CLOCK = 60; // mm/h, clock ×60
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const readoutOf = (v, dir, rain, raining) =>
  `force ${forceOf(v)} · ${v.toFixed(1)} m/s from ${Math.round(dir)}° ${COMPASS[Math.round(dir / 22.5) % 16]} · rain ${rain.toFixed(1)} mm${raining ? " ▾" : ""}`;

// ---------------------------------------------------------------- layout (world ≈ 1 mm; x east, y south, z up)
const WIDTH = 640, HEIGHT = 600;
const AZ = 40;
const BENCH = { x: -185, y: -85, w: 370, d: 170, r: 6 };
const BENCH_H = 16, FOOT_H = 6, TOP = BENCH_H;
const MAST = [-78, -34], MAST_R = 3.6, MAST_TOP = 268;
const ARM_HALF = 50, ARM_Z = MAST_TOP + 4;
const CUPS = [MAST[0] + ARM_HALF, MAST[1]], CUP_R = 22, CUP_SIZE = 5.4, CUP_Z = ARM_Z + 24;
const VANE = [MAST[0] - ARM_HALF, MAST[1]], VANE_Z = ARM_Z + 22;
const SCREEN = { x: 22, y: -66, w: 74, d: 56, r: 1.5 };
const SCREEN_Z0 = 122, SCREEN_Z1 = 182;
const GAUGE = [104, 44], GAUGE_R = 17, GAUGE_Z0 = 56, GAUGE_Z1 = 98, PIVOT_Z = 34;
const LOGGER = { x: -128, y: 26, w: 52, d: 34, r: 2.5 }, LOGGER_H = 30;

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -FOOT_H, 0), [MAST[0], MAST[1], CUP_Z + 8], [CUPS[0] + CUP_R + 6, CUPS[1], CUP_Z], [VANE[0] - 30, VANE[1], VANE_Z]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: AZ },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const view = G.viewOf(P);
const toward = k.towardViewer(P);
const depth = (p) => k.depthOf(p, P);
const f2 = (p) => p.map((v) => v.toFixed(2)).join(" ");
const UP = [0, 0, 1];
const vertical = (x, y, z) => G.frameOf([x, y, z], UP, [1, 0, 0], [0, 1, 0]);

// ---------------------------------------------------------------- bench
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -FOOT_H, FOOT_H, P)}"/>`];
  const feet = [...k.corners(BENCH, 18)].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 9, -FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 7, -FOOT_H + 1.6, FOOT_H - 1.6, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(BENCH, 0, BENCH_H, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(BENCH, 6, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), TOP, P), { tone: "faint" }));
  const screws = k.corners(BENCH, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, TOP])), { size: 0.5 }));
  // A ruler strip along the near long edge, ticks every 5, major every 50.
  const strip = { x: -150, y: BENCH.y + BENCH.d - 15, w: 300, d: 10, r: 1 };
  out.push(S_(k.slabOf(strip, TOP, 0.8, P, 2), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 10, strip.y, TOP + 0.8, [2.2, 4.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // Label plate on the near side face, three rule lines.
  const yf = BENCH.y + BENCH.d;
  const plate = [[60, yf, 4], [130, yf, 4], [130, yf, 12.5], [60, yf, 12.5]];
  out.push(`<path class="ws-panel" d="${k.pathOf(plate.map(at), true)}"/>`);
  out.push(L(k.pathOf(plate.map(at), true), { tone: "lo" }));
  out.push(L([[64, 10, 34], [64, 8, 46], [64, 6, 24]].map(([x, z, len]) => k.pathOf([at([x, yf, z]), at([x + len, yf, z])])).join(""), { tone: "lo", free: true }));
  // An engraved compass rose: north is −y, toward the back of the bench.
  const C = [-30, 52], CR = 15;
  out.push(L(k.ring(C[0], C[1], CR, TOP, P, 48), { tone: "lo" }));
  out.push(L(k.ring(C[0], C[1], 1.6, TOP, P, 12), { tone: "lo" }));
  const rt = k.radialTicks(C[0], C[1], CR, 16, 4, TOP, [2, 4.5], P);
  out.push(L(rt.minor, { tone: "lo" }), L(rt.major, { tone: "mid" }));
  out.push(L(k.pathOf([at([C[0], C[1] - 1.6, TOP]), at([C[0], C[1] - CR + 5, TOP])]), { tone: "mid" }));
  out.push(Dots([at([C[0], C[1] - CR + 5, TOP])], { size: 0.9, tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([C[0] - 2.2, C[1] - CR - 8], TOP, P), "N", { size: 6, tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- mast, crossarm, anemometer, vane
function mastBase() {
  const [x, y] = MAST;
  const out = [];
  out.push(S_(k.cylinder(x, y, 17, TOP, 2.4, P, 48, 0.5), { tone: "mid" }));
  out.push(L(k.ring(x, y, 13, TOP + 2.4, P, 40), { tone: "faint" }));
  const bolts = [0, 1, 2, 3].map((i) => [x + 13 * Math.cos(Math.PI / 4 + (i * Math.PI) / 2), y + 13 * Math.sin(Math.PI / 4 + (i * Math.PI) / 2)]);
  out.push(Dots(bolts.map(([bx, by]) => at([bx, by, TOP + 2.4])), { size: 0.75, tone: "hi" }));
  out.push(S_(k.cylinder(x, y, 6.5, TOP + 2.4, 7, P, 32, 0.4), { tone: "mid" }));
  return out.join("");
}
function mastPole() {
  const [x, y] = MAST;
  const out = [];
  const bands = [92, 180].map((z) => L(k.sideArc(x, y, MAST_R, z, P, 20), { tone: "faint" })).join("");
  out.push(S_(k.cylinder(x, y, MAST_R, TOP + 9.4, MAST_TOP - TOP - 9.4, P, 28), { tone: "mid", inner: bands }));
  // Junction box clamped on the pole's near side, with a gland underneath.
  const jb = { x: x - 7, y: y + MAST_R, w: 14, d: 9, r: 1 };
  out.push(S_(k.slabOf(jb, 58, 22, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(jb, 75, P, 2), { tone: "faint" }) }));
  out.push(Dots([[jb.x + 2.5, jb.y + jb.d - 2], [jb.x + jb.w - 2.5, jb.y + jb.d - 2]].map(([px, py]) => at([px, py, 80])), { size: 0.5, tone: "lo" }));
  out.push(S_(k.cylinder(x, y + MAST_R + 4.5, 2.2, 52, 6, P, 16), { tone: "lo" }));
  // Clamp block and the crossarm along x at the top.
  out.push(S_(k.slabOf({ x: x - 6, y: y - 6, w: 12, d: 12, r: 1 }, MAST_TOP - 6, 10, P, 2, 0.5), { tone: "mid" }));
  return out.join("");
}
function crossarm() {
  const [x, y] = MAST;
  const F = G.frameOf([x - ARM_HALF - 4, y, ARM_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const out = [S_(G.prismOf(F, [[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]], 0, 2 * ARM_HALF + 8, P), { tone: "mid" })];
  out.push(Dots([at([x - 3, y + 2.5, ARM_Z + 2.5]), at([x + 3, y + 2.5, ARM_Z + 2.5])], { size: 0.5, tone: "lo" }));
  return out.join("");
}
// A small solar panel on a bracket, facing south (+y) at 45°, charging the
// logger's battery.
function solarPanel() {
  const [x, y] = MAST;
  const out = [];
  const z = 196;
  out.push(S_(k.slabOf({ x: x - 3, y: y + MAST_R - 0.5, w: 6, d: 9, r: 0.5 }, z - 3, 6, P, 2), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, MAST_R + 1.2, z - 4, 8, P, 24), { tone: "mid" }));
  const tilt = Math.PI / 4;
  const u = [1, 0, 0], v = [0, -Math.cos(tilt), Math.sin(tilt)], n = [0, Math.sin(tilt), Math.cos(tilt)];
  const F = G.frameOf([x, y + MAST_R + 12, z + 2], n, u, v);
  out.push(S_(G.prismOf(F, [[-17, -11], [17, -11], [17, 11], [-17, 11]], -1.2, 1.2, P), { tone: "mid" }));
  // Cells: a 4 × 3 grid of lines on the face that looks up and south.
  const face = (a, b) => at([F.o[0] + u[0] * a + v[0] * b + n[0] * 1.25, F.o[1] + u[1] * a + v[1] * b + n[1] * 1.25, F.o[2] + u[2] * a + v[2] * b + n[2] * 1.25]);
  const lines = [];
  for (const a of [-8.5, 0, 8.5]) lines.push(k.pathOf([face(a, -10), face(a, 10)]));
  for (const b of [-3.4, 3.4]) lines.push(k.pathOf([face(-16, b), face(16, b)]));
  lines.push(k.pathOf([face(-16, -10), face(16, -10), face(16, 10), face(-16, 10)], true));
  out.push(L(lines.join(""), { tone: "lo" }));
  return out.join("");
}

// The anemometer housing and spindle on the east end of the arm.
function cupBody() {
  const [x, y] = CUPS;
  const out = [];
  out.push(S_(k.cylinder(x, y, 6, ARM_Z + 2.5, 3, P, 32, 0.4), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 4.6, ARM_Z + 5.5, 12, P, 28), { tone: "mid", inner: L(k.sideArc(x, y, 4.6, ARM_Z + 11, P, 18), { tone: "faint" }) }));
  out.push(S_(k.cylinder(x, y, 1.6, ARM_Z + 17.5, CUP_Z - ARM_Z - 18.5, P, 16), { tone: "lo" }));
  return out.join("");
}
// The rotor: hub, three arms and three cups at angle a. A cup's mouth faces
// backwards along its path, so the wind pushes on its hollow side.
function cupRotor(a) {
  const [x, y] = CUPS;
  const z = CUP_Z;
  const hub = [x, y, z];
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const t = a + (i * 2 * Math.PI) / 3;
    const c = [x + CUP_R * Math.cos(t), y + CUP_R * Math.sin(t), z];
    parts.push({ t, c, d: depth(c) });
  }
  parts.sort((p, q) => p.d - q.d);
  const hubDepth = depth(hub);
  const draw = ({ t, c }) => {
    const out = [];
    const inner = [x + 3 * Math.cos(t), y + 3 * Math.sin(t), z];
    const near = [c[0] - (CUP_SIZE - 1) * Math.cos(t), c[1] - (CUP_SIZE - 1) * Math.sin(t), z];
    out.push(`<path class="ws-arm" d="M${f2(at(inner))}L${f2(at(near))}"/>`);
    // A turned cup: a shallow cone-and-dome shell whose mouth faces back
    // along its path, so the wind pushes on its hollow side.
    const tangent = [-Math.sin(t), Math.cos(t), 0];
    const mouthN = tangent.map((v) => -v);
    const F = G.frameAlong(c, mouthN);
    out.push(S_(G.solidOf([[-4.6, 0], [-4.3, 2.2, 1], [-3.2, 4, 1], [-1.5, 5.1, 1], [0.6, CUP_SIZE]], F, P, { steps: 28 }), { tone: "hi" }));
    if (mouthN[0] * view[0] + mouthN[1] * view[1] + mouthN[2] * view[2] > 0.02) {
      const ring = Array.from({ length: 28 }, (_, j) => at(G.pointOf(F, 0.6, CUP_SIZE - 0.7, (j / 28) * 2 * Math.PI)));
      out.push(`<path class="ws-mouth" d="M${ring.map(f2).join("L")}Z"/>`);
    }
    return out.join("");
  };
  const back = parts.filter((p) => p.d <= hubDepth).map(draw).join("");
  const front = parts.filter((p) => p.d > hubDepth).map(draw).join("");
  const hubSvg = S_(G.sphereOf([x, y, z + 0.5], 3.2, P, { steps: 24 }), { tone: "mid" });
  return back + hubSvg + front;
}
function vaneBody() {
  const [x, y] = VANE;
  const out = [];
  out.push(S_(k.cylinder(x, y, 5.4, ARM_Z + 2.5, 3, P, 28, 0.4), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 4, ARM_Z + 5.5, 10, P, 24), { tone: "mid", inner: L(k.sideArc(x, y, 4, ARM_Z + 10, P, 16), { tone: "faint" }) }));
  out.push(S_(k.cylinder(x, y, 1.5, ARM_Z + 15.5, VANE_Z - ARM_Z - 16, P, 16), { tone: "lo" }));
  return out.join("");
}
// The vane at wind direction dir (degrees the wind comes from; north = −y):
// the counterweight points into the wind, the fin trails downwind.
function vaneRotor(dir) {
  const [x, y] = VANE;
  const z = VANE_Z;
  const r = (dir * Math.PI) / 180;
  const into = [Math.sin(r), -Math.cos(r), 0];
  const F = G.frameOf([x, y, z], into, [-into[1], into[0], 0], UP);
  const rod = G.prismOf(F, [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]], -26, 14, P);
  const fin = G.prismOf(F, [[-0.5, -5], [0.5, -5], [0.5, 9], [-0.5, 9]], -34, -18, P);
  const weight = G.sphereOf(G.pointOf(F, 16, 0, 0), 3.4, P, { steps: 24 });
  const hub = G.sphereOf([x, y, z], 2.4, P, { steps: 20 });
  const items = [
    { d: depth(G.pointOf(F, -26, 0, 0)), svg: S_(fin, { tone: "hi" }) },
    { d: depth([x, y, z]) - 0.1, svg: S_(rod, { tone: "mid" }) },
    { d: depth([x, y, z]), svg: S_(hub, { tone: "mid" }) },
    { d: depth(G.pointOf(F, 16, 0, 0)), svg: S_(weight, { tone: "mid" }) },
  ];
  // The fin and weight sit at the two ends of the rod: the far end first.
  items.sort((a, b) => a.d - b.d);
  return items.map((i) => i.svg).join("");
}

// ---------------------------------------------------------------- Stevenson screen
function screen() {
  const out = [];
  const legs = k.corners(SCREEN, 5).sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  const backLegs = legs.slice(0, 3), frontLeg = legs[3];
  const leg = ([lx, ly]) => S_(k.slabOf({ x: lx - 2.2, y: ly - 2.2, w: 4.4, d: 4.4, r: 0.4 }, TOP, SCREEN_Z0 - TOP, P, 2), { tone: "mid" });
  for (const p of backLegs) out.push(leg(p));
  // Feet plates and a cross brace on the visible sides.
  for (const [lx, ly] of legs) out.push(Dots([at([lx, ly, TOP])], { size: 0.5, tone: "lo" }));
  out.push(leg(frontLeg));
  // The box, louvred: one slat line every 5 mm on the visible sides.
  const louvres = [];
  for (let z = SCREEN_Z0 + 5; z < SCREEN_Z1 - 2; z += 4.2) louvres.push(k.sideSeam(SCREEN, z, P, 2));
  out.push(S_(k.slabOf(SCREEN, SCREEN_Z0, SCREEN_Z1 - SCREEN_Z0, P, 2, 0.6), { tone: "hi", inner: L(louvres.join(""), { tone: "faint" }) }));
  // Door on the near (+y) face: a frame seam, hinges and a latch.
  const yf = SCREEN.y + SCREEN.d;
  const door = [[SCREEN.x + 6, yf, SCREEN_Z0 + 3], [SCREEN.x + SCREEN.w - 6, yf, SCREEN_Z0 + 3], [SCREEN.x + SCREEN.w - 6, yf, SCREEN_Z1 - 3], [SCREEN.x + 6, yf, SCREEN_Z1 - 3]];
  out.push(L(k.pathOf(door.map(at), true), { tone: "lo" }));
  out.push(Dots([[SCREEN.x + 6, yf, SCREEN_Z0 + 12], [SCREEN.x + 6, yf, SCREEN_Z1 - 12]].map(at), { size: 0.9, tone: "mid" }));
  out.push(S_(k.slabOf({ x: SCREEN.x + SCREEN.w - 12, y: yf, w: 3, d: 2, r: 0.3 }, (SCREEN_Z0 + SCREEN_Z1) / 2 - 4, 8, P, 2), { tone: "hi", lit: true }));
  // Double roof: a ventilated gap between two overhanging plates.
  const roof1 = k.insetPlan(SCREEN, -5), roof2 = k.insetPlan(SCREEN, -7);
  out.push(S_(k.slabOf(roof1, SCREEN_Z1, 2.4, P, 2, 0.4), { tone: "mid" }));
  const spacers = k.corners(roof1, 8).sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [sx, sy] of spacers) out.push(S_(k.slabOf({ x: sx - 2, y: sy - 2, w: 4, d: 4, r: 0.4 }, SCREEN_Z1 + 2.4, 4.6, P, 2), { tone: "lo" }));
  out.push(S_(k.slabOf(roof2, SCREEN_Z1 + 7, 2.6, P, 2, 0.5), { tone: "hi" }));
  out.push(L(k.planOutline(k.insetPlan(roof2, 4), SCREEN_Z1 + 9.6, P, 2), { tone: "faint" }));
  out.push(Dots(k.corners(roof2, 4).map(([px, py]) => at([px, py, SCREEN_Z1 + 9.6])), { size: 0.5, tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- rain gauge
function gaugeBack() {
  const [x, y] = GAUGE;
  const out = [];
  out.push(S_(k.cylinder(x, y, 25, TOP, 2.6, P, 48, 0.5), { tone: "mid" }));
  out.push(L(k.ring(x, y, 21, TOP + 2.6, P, 40), { tone: "faint" }));
  const screws = [0, 1, 2].map((i) => [x + 21 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 3), y + 21 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 3)]);
  out.push(Dots(screws.map(([sx, sy]) => at([sx, sy, TOP + 2.6])), { size: 0.7, tone: "hi" }));
  // Back post (−y side) holding the collector, and the two end stops the
  // bucket rests on.
  out.push(post(y - 13));
  for (const sx of [-15, 15]) out.push(S_(k.slabOf({ x: x + sx - 2, y: y - 6, w: 4, d: 12, r: 0.5 }, TOP + 2.6, 30.5 - TOP - 2.6, P, 2), { tone: "lo" }));
  return out.join("");
}
const post = (py) => S_(k.slabOf({ x: GAUGE[0] - 3, y: py - 2, w: 6, d: 4, r: 0.5 }, TOP + 2.6, GAUGE_Z0 - TOP - 2.6, P, 2), { tone: "mid" });
// The tipping bucket on its pivot at tilt (radians, + tips toward +x).
function bucket(tilt, fill) {
  const [x, y] = GAUGE;
  const u = [Math.cos(tilt), 0, Math.sin(tilt)], v = [-Math.sin(tilt), 0, Math.cos(tilt)];
  const F = G.frameOf([x, y, PIVOT_Z], [0, 1, 0], u, v);
  const out = [];
  out.push(S_(G.prismOf(F, [[-15, 1], [15, 1], [0, 12]], -8, 8, P), { tone: "hi" }));
  // The divider and the two bucket mouths on the near face.
  const face = (px, pz) => at([x + u[0] * px + v[0] * pz, y + 8, PIVOT_Z + u[2] * px + v[2] * pz]);
  out.push(L(k.pathOf([face(0, 1), face(0, 12)]), { tone: "mid" }));
  // Water in the upper bucket: a wedge that grows with the fill (0..1).
  if (fill > 0.02) {
    const side = tilt > 0 ? -1 : 1; // the raised side collects
    const h = 1 + 9 * Math.sqrt(fill) * 0.9;
    const pts = [face(0, 1.6), face(side * (14 - 1.5 * (h - 1)), 1.6), face(0, h)];
    out.push(`<path class="ws-water" d="M${pts.map(f2).join("L")}Z"/>`);
  }
  // Pivot axle through both posts.
  out.push(S_(G.disc(-13, 13, 1.4, G.frameOf([x, y, PIVOT_Z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "mid" }));
  return out.join("");
}
function gaugeFront() {
  const [x, y] = GAUGE;
  const out = [post(y + 13)];
  // Spout under the funnel, dripping into the bucket.
  out.push(S_(k.cylinder(x, y, 1.8, GAUGE_Z0 - 7, 7, P, 16), { tone: "mid" }));
  // Collector: body, a rim collar and the dark funnel mouth.
  out.push(S_(k.cylinder(x, y, GAUGE_R, GAUGE_Z0, GAUGE_Z1 - GAUGE_Z0, P, 48), { tone: "hi", inner: L(k.sideArc(x, y, GAUGE_R, GAUGE_Z0 + 8, P, 32), { tone: "faint" }) }));
  out.push(S_(G.ringBand(0, 3, GAUGE_R - 1.2, GAUGE_R + 1, vertical(x, y, GAUGE_Z1), P), { tone: "mid" }));
  const mouth = Array.from({ length: 48 }, (_, i) => at([x + (GAUGE_R - 1.2) * Math.cos((i / 48) * 2 * Math.PI), y + (GAUGE_R - 1.2) * Math.sin((i / 48) * 2 * Math.PI), GAUGE_Z1 + 3]));
  out.push(`<path class="ws-mouth" d="M${mouth.map(f2).join("L")}Z"/>`);
  out.push(L(k.ring(x, y, 3, GAUGE_Z1 + 3, P, 16), { tone: "lo" }));
  return out.join("");
}

// ---------------------------------------------------------------- logger and cables
function logger() {
  const out = [];
  out.push(S_(k.slabOf(LOGGER, TOP, LOGGER_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(LOGGER, TOP + LOGGER_H - 6, P, 3), { tone: "faint" }) }));
  const lcd = { x: LOGGER.x + 6, y: LOGGER.y + 6, w: LOGGER.w - 12, d: 14, r: 1 };
  out.push(`<path class="ws-lcd" d="${k.pathOf(k.ringOf(lcd, 2).map(([px, py]) => at([px, py, TOP + LOGGER_H])), true)}"/>`);
  out.push(L(k.planOutline(lcd, TOP + LOGGER_H, P, 2), { tone: "lo" }));
  out.push(`<g data-ws-lcd>${lcdText("9.0 m/s 240°")}</g>`);
  // Two buttons and a status LED.
  for (const [bx, by] of [[LOGGER.x + 10, LOGGER.y + 27], [LOGGER.x + 20, LOGGER.y + 27]]) out.push(S_(k.cylinder(bx, by, 2.6, TOP + LOGGER_H, 1.2, P, 16), { tone: "hi" }));
  out.push(`<circle data-ws-led class="ws-led" cx="${at([LOGGER.x + LOGGER.w - 9, LOGGER.y + 27, TOP + LOGGER_H])[0].toFixed(2)}" cy="${at([LOGGER.x + LOGGER.w - 9, LOGGER.y + 27, TOP + LOGGER_H])[1].toFixed(2)}" r="1.5"/>`);
  out.push(Dots(k.corners(LOGGER, 3).map(([px, py]) => at([px, py, TOP + LOGGER_H])), { size: 0.5, tone: "lo" }));
  // Antenna on the back corner.
  out.push(S_(k.cylinder(LOGGER.x + LOGGER.w - 6, LOGGER.y + 6, 1.4, TOP + LOGGER_H, 26, P, 12), { tone: "lo" }));
  out.push(S_(G.sphereOf([LOGGER.x + LOGGER.w - 6, LOGGER.y + 6, TOP + LOGGER_H + 26], 2, P, { steps: 16 }), { tone: "mid" }));
  return out.join("");
}
function lcdText(s) {
  return k.faceTextSvg(k.topMatrix([LOGGER.x + 9, LOGGER.y + 15.5], TOP + LOGGER_H, P), s, { size: 4.6, tone: "hi" });
}
function cables() {
  // From the mast's junction box gland down to the bench and across to the
  // logger's back face; from the rain gauge base along the bench.
  const z = TOP + 0.6;
  const gland = [MAST[0], MAST[1] + MAST_R + 4.5, 52];
  const a = k.wireSvg(at(gland), at([LOGGER.x + 18, LOGGER.y, TOP + 8]), {
    via: [at([MAST[0], MAST[1] + MAST_R + 4.5, z + 4]), at([MAST[0], MAST[1] + 16, z]), at([LOGGER.x + 18, MAST[1] + 16, z]), at([LOGGER.x + 18, LOGGER.y - 4, z])],
    tone: "mid", size: 1.1,
  });
  const b = k.wireSvg(at([GAUGE[0] - 24, GAUGE[1] + 2, TOP + 1.2]), at([LOGGER.x + LOGGER.w, LOGGER.y + 22, TOP + 8]), {
    via: [at([GAUGE[0] - 40, GAUGE[1] + 2, z]), at([GAUGE[0] - 40, LOGGER.y + 22, z]), at([LOGGER.x + LOGGER.w + 4, LOGGER.y + 22, z])],
    tone: "mid", size: 1.1,
  });
  // From the screen's sensor gland, down its back-left leg and across.
  const leg = [SCREEN.x + 5, SCREEN.y + 5];
  const c = k.wireSvg(at([leg[0] + 3, leg[1], SCREEN_Z0 - 1]), at([LOGGER.x + 40, LOGGER.y, TOP + 8]), {
    via: [at([leg[0] + 3, leg[1], z + 3]), at([leg[0] + 3, leg[1], z]), at([leg[0] + 3, LOGGER.y - 10, z]), at([LOGGER.x + 40, LOGGER.y - 10, z])],
    tone: "mid", size: 1.1,
  });
  return a + b + c;
}

// ---------------------------------------------------------------- rain streaks (live)
// Short streaks around the gauge, slanted downwind; the live code moves them.
const STREAKS = Array.from({ length: 22 }, (_, i) => {
  const r = 8 + ((i * 37) % 40);
  const t = i * 2.39996;
  return [GAUGE[0] - 10 + r * Math.cos(t), GAUGE[1] - 6 + r * Math.sin(t) * 0.8, (i * 53) % 100];
});

// ---------------------------------------------------------------- assemble
const A0 = 0.4, DIR0 = 240;
const body = [
  bench(),
  mastBase(),
  cables(),
  mastPole(),
  solarPanel(),
  crossarm(),
  vaneBody(),
  `<g data-ws-vane>${vaneRotor(DIR0)}</g>`,
  cupBody(),
  `<g data-ws-cups>${cupRotor(A0)}</g>`,
  logger(),
  screen(),
  gaugeBack(),
  `<g data-ws-bucket>${bucket(-0.26, 0)}</g>`,
  `<g data-ws-drops></g>`,
  gaugeFront(),
  `<g data-ws-rain class="ws-rain" hidden></g>`,
].join("");

const label =
  "A model automatic weather station on a bench. At the back left a mast on a bolted base plate carries a crossarm: a three-cup anemometer turns on its east end and a wind vane with a counterweight and a tail fin turns on its west end. At the back right a white louvred Stevenson screen with a double roof stands on four legs, its door on the near side. At the front right a tipping-bucket rain gauge: a funnel collector on two posts over a small see-saw of two buckets on a pivot. At the front left a data logger with a display, buttons and an antenna is wired to the mast and the gauge. A compass rose is engraved on the bench, north toward the back.";
const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label, body });
const stage = `<div class="ws-stage" tabindex="0" role="group" aria-label="Weather station. Left and right arrows change the wind force, up and down turn the wind, R starts or stops the rain.">${svg}<p class="ws-sr" aria-live="polite" data-say></p></div>`;
const plateBody = k.plateHtml({
  fig: "Fig · Station",
  title: "Automatic weather station",
  hint: "←/→ force · ↑/↓ direction · R rain",
  readout: readoutOf(9, DIR0, 0, false),
  keys: [
    { mark: "raised", label: "Stevenson screen, mast and rain gauge" },
    { mark: "lit", label: "Door latch: the thermometers are inside" },
  ],
  caption: `The cups turn at about a third of the wind speed (an anemometer factor of ≈ 3) on 70 mm arms, so ω = v / 0.21 rad/s; they are drawn ${SLOW} times slower. The vane's counterweight points into the wind, north toward the back of the bench. Rain falls at ${RAIN_RATE} mm/h on a clock running ${RAIN_CLOCK}× fast; each tip of the bucket is ${TIP_MM} mm. Forces come from the WMO Beaufort limits, and ←/→ set the speed a force stands for, v = 0.836·B^1.5.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="${NAME}">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="weather-station"]
function scope(css, root) {
  const out = [];
  let i = 0;
  const read = () => {
    const open = css.indexOf("{", i);
    if (open < 0) return null;
    let d = 1, j = open + 1;
    while (d && j < css.length) {
      if (css[j] === "{") d++;
      else if (css[j] === "}") d--;
      j++;
    }
    const prelude = css.slice(i, open).trim();
    const bodyText = css.slice(open + 1, j - 1);
    i = j;
    return { prelude, body: bodyText };
  };
  let rule;
  while ((rule = read())) {
    const { prelude, body: b } = rule;
    if (prelude.startsWith("@keyframes")) out.push(`${prelude}{${b}}`);
    else if (prelude.startsWith("@")) out.push(`${prelude}{${scope(b, root)}}`);
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
      out.push(`${sel}{${b.trim()}}`);
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
.iso${R_} .ws-stage{position:relative;outline:none}
.iso${R_} .ws-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .ws-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .ws-panel{fill:var(--anatomy-face)}
.iso${R_} .ws-arm{fill:none;stroke:var(--anatomy-mid);stroke-width:1.3;stroke-linecap:round}
.iso${R_} .ws-mouth{fill:var(--anatomy-shade-0);stroke:var(--anatomy-mid);stroke-width:.6}
.iso${R_} .ws-lcd{fill:var(--anatomy-shade-0)}
.iso${R_} .ws-led{fill:var(--anatomy-mid)}
.iso${R_} .ws-led[data-on]{fill:var(--brand,#e8559a)}
.iso${R_} .ws-water{fill:var(--vec-u,#009fff);fill-opacity:.55}
.iso${R_} .ws-drop{fill:var(--vec-u,#009fff)}
.iso${R_} .ws-rain[hidden]{display:none}
.iso${R_} .ws-rain line{stroke:var(--vec-u,#009fff);stroke-opacity:.55;stroke-width:.8;stroke-linecap:round}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
// lathe.mjs ships inside a closure: its one import comes from the kit above.
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameAlong, frameOf, disc, prismOf, pointOf, sphereOf, viewOf, solidOf }; })();
const P = ${JSON.stringify(P)};
const k = { iso, depthOf, solidSvg, lineSvg, dotsSvg, pathOf, faceTextSvg, topMatrix };
const view = ${JSON.stringify(view)};
const BF_LIMITS = ${JSON.stringify(BF_LIMITS)}, COMPASS = ${JSON.stringify(COMPASS)};
const CUP_ARM = ${CUP_ARM}, CUP_FACTOR = ${CUP_FACTOR}, SLOW = ${SLOW}, TIP_MM = ${TIP_MM}, RAIN_RATE = ${RAIN_RATE}, RAIN_CLOCK = ${RAIN_CLOCK};
const CUPS = ${JSON.stringify(CUPS)}, CUP_R = ${CUP_R}, CUP_SIZE = ${CUP_SIZE}, CUP_Z = ${CUP_Z}, VANE = ${JSON.stringify(VANE)}, VANE_Z = ${VANE_Z};
const GAUGE = ${JSON.stringify(GAUGE)}, PIVOT_Z = ${PIVOT_Z}, GAUGE_Z0 = ${GAUGE_Z0}, GAUGE_Z1 = ${GAUGE_Z1}, TOP = ${TOP};
const LOGGER = ${JSON.stringify(LOGGER)}, LOGGER_H = ${LOGGER_H};
const STREAKS = ${JSON.stringify(STREAKS)};
const UP = [0, 0, 1];
const at = (p) => iso(p, P);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const depth = (p) => depthOf(p, P);
const f2 = (p) => p.map((v) => v.toFixed(2)).join(" ");
const forceOf = ${forceOf.toString()};
const speedOfForce = ${speedOfForce.toString()};
const cupOmega = ${cupOmega.toString()};
const readoutOf = ${readoutOf.toString()};
${cupRotor.toString()}
${vaneRotor.toString()}
${bucket.toString()}
${lcdText.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".ws-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const g = { cups: svg.querySelector("[data-ws-cups]"), vane: svg.querySelector("[data-ws-vane]"), bucket: svg.querySelector("[data-ws-bucket]"), drops: svg.querySelector("[data-ws-drops]"), rain: svg.querySelector("[data-ws-rain]"), lcd: svg.querySelector("[data-ws-lcd]"), led: svg.querySelector("[data-ws-led]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let v = 9, dir = 240, shownDir = 240, angle = ${A0}, omega = 0, raining = false, rain = 0, fill = 0;
  let tilt = -0.26, tiltGoal = -0.26, frame = 0, last = 0, visible = false, flash = 0;
  // Streak lines for the rain, built once.
  g.rain.innerHTML = STREAKS.map(() => '<line/>').join("");
  const streaks = [...g.rain.querySelectorAll("line")];

  const text = () => readoutOf(v, dir, rain, raining);
  function apply() {
    const t = text();
    if (readout.textContent !== t) readout.textContent = t;
    g.lcd.innerHTML = lcdText(v.toFixed(1) + " m/s " + String(Math.round(dir)).padStart(3, "0") + "°");
    g.rain.toggleAttribute("hidden", !raining);
  }
  function drawRain(time) {
    const lean = Math.min(1.2, v / 14);
    const r = (dir * Math.PI) / 180;
    // Rain is blown downwind: away from where the wind comes from.
    const dx = -Math.sin(r) * lean * 14, dy = Math.cos(r) * lean * 14;
    streaks.forEach((line, i) => {
      const [x, y, phase] = STREAKS[i];
      const h = 175 - ((phase + time * 140) % 100) * 1.0;
      const a = at([x - dx * (h / 175), y - dy * (h / 175), h + 14]), b = at([x - dx * ((h - 10) / 175), y - dy * ((h - 10) / 175), h + 4]);
      line.setAttribute("x1", a[0].toFixed(1)); line.setAttribute("y1", a[1].toFixed(1));
      line.setAttribute("x2", b[0].toFixed(1)); line.setAttribute("y2", b[1].toFixed(1));
    });
  }
  function drawDrops(time) {
    if (!raining) { g.drops.innerHTML = ""; return; }
    const top = GAUGE_Z0 - 7, bottom = PIVOT_Z + 13;
    const zs = [0, 0.5].map((p) => top - ((time * 1.6 + p) % 1) * (top - bottom));
    g.drops.innerHTML = zs.map((z) => { const p = at([GAUGE[0], GAUGE[1], z]); return '<circle class="ws-drop" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1.1"/>'; }).join("");
  }
  function drawBucket() { g.bucket.innerHTML = bucket(tilt, fill); }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const time = now / 1000;
    // The cups spin up and down with a 1.5 s time constant.
    omega += (cupOmega(v) - omega) * (1 - Math.exp(-dt / 1.5));
    angle += omega * dt;
    g.cups.innerHTML = cupRotor(angle);
    // The vane swings toward the wind, a little underdamped.
    let d = ((dir - shownDir + 540) % 360) - 180;
    shownDir += d * (1 - Math.exp(-dt / 0.35));
    g.vane.innerHTML = vaneRotor(shownDir);
    if (raining) {
      const mm = (RAIN_RATE * RAIN_CLOCK * dt) / 3600;
      fill += mm / TIP_MM;
      if (fill >= 1) {
        fill -= 1;
        rain += TIP_MM;
        tiltGoal = -tiltGoal;
        flash = 0.25;
        apply();
      }
      drawRain(time);
    }
    drawDrops(time);
    tilt += (tiltGoal - tilt) * (1 - Math.exp(-dt / 0.06));
    drawBucket();
    flash = Math.max(0, flash - dt);
    g.led.toggleAttribute("data-on", flash > 0);
    frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
  const settle = () => { shownDir = dir; g.vane.innerHTML = vaneRotor(dir); tilt = tiltGoal; drawBucket(); drawRain(0); };
  const send = () => window.dispatchEvent(new CustomEvent("wx-wind", { detail: { ms: v, source: "station" } }));
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") { v = speedOfForce(Math.min(12, forceOf(v) + 1)); send(); }
    else if (event.key === "ArrowLeft") { v = speedOfForce(Math.max(0, forceOf(v) - 1)); send(); }
    else if (event.key === "ArrowUp") dir = (dir + 10) % 360;
    else if (event.key === "ArrowDown") dir = (dir + 350) % 360;
    else if (event.key === "r" || event.key === "R" || event.key === " ") {
      raining = !raining;
      // Under reduced motion each press is one tip instead of a shower.
      if (still.matches && raining) { rain += TIP_MM; tiltGoal = -tiltGoal; raining = false; }
    }
    else return;
    event.preventDefault();
    apply();
    say.textContent = text();
    if (still.matches) settle();
    run();
  });
  window.addEventListener("wx-wind", (e) => {
    if (e.detail.source === "station") return;
    v = e.detail.ms;
    apply();
    if (still.matches) settle();
  });
  still.addEventListener?.("change", () => (still.matches ? settle() : run()));
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  apply();
  settle();
}

function start() { document.querySelectorAll('[data-anatomy="${NAME}"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/${NAME}/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit and lathe runtime (MIT) and the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, `${NAME}.html`), fragment + "\n");
writeFileSync(join(OUT, `${NAME}.css`), css);
writeFileSync(join(OUT, `${NAME}.js`), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Weather station</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`wrote ${NAME}.html/css/js · force ${forceOf(9)} at 9 m/s, cups ${(cupOmega(9) * SLOW).toFixed(1)} rad/s real`);
