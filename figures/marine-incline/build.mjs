// Fig · Inclining experiment. A box-section model pontoon floats in a glass
// tank on a bench. A weight slides across the beam on a rail; a pendulum
// hangs from a gallows near the stern, over a damping trough, and its string
// crosses a scale batten fixed to the hull. A ballast slider on a threaded
// post moves the centre of gravity up or down. The heel is solved from the
// wall-sided stability formula for the model's real numbers:
//   Δ·sin φ·(GM + ½·BM·tan²φ) = w·d·cos φ.
// Run from the repo root: node figures/marine-incline/build.mjs
// Writes site/static/anatomy/marine-incline.{html,css,js} and
// figures/marine-incline/preview{,-light}.html.
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
const NAME = "marine-incline";

// ---------------------------------------------------------------- model
// The pontoon is 600 × 200 mm with 60 mm draft in fresh water, so it
// displaces 7.2 kg. One drawing unit is 5 mm.
const MODEL = { L: 600, B: 200, T: 60, rho: 1000, w: 0.25 };
const DISP = (MODEL.rho * MODEL.L * MODEL.B * MODEL.T) / 1e9; // kg
const KB = MODEL.T / 2;
const BM = (MODEL.B * MODEL.B) / (12 * MODEL.T);
const KG_OF = (hb) => 56 + (hb - 14) * 1.3; // ballast slider height (units) → KG (mm)
const HB_RANGE = [14, 32];
const GM_OF = (hb) => KB + BM - KG_OF(hb);
// Heel (rad) for a weight w at d mm off the centreline: solve the
// wall-sided equation by bisection. Valid until the deck edge immerses.
function heelOf(d, gm) {
  const f = (p) => DISP * Math.sin(p) * (gm + 0.5 * BM * Math.tan(p) ** 2) - MODEL.w * d * Math.cos(p);
  let a = -0.6, b = 0.6;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (f(a) * f(m) <= 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}
const STOPS = [-70, -35, 0, 35, 70]; // weight positions, mm
const readoutOf = (d, phi, gm) => {
  const deg = (phi * 180) / Math.PI;
  const sgn = (v) => (v > 0.05 ? "+" : v < -0.05 ? "−" : "");
  return `weight ${sgn(d)}${Math.abs(d).toFixed(0)} mm · heel ${sgn(deg)}${Math.abs(deg).toFixed(2)}° · GM ${gm.toFixed(1)} mm`;
};

// ---------------------------------------------------------------- layout (z up, viewer toward +x +y)
const WIDTH = 640, HEIGHT = 500;
const PLATE = { x: -90, y: -50, w: 206, d: 100, r: 7 };
const PLATE_H = 8, FOOT_H = 4;
const TANK = { x: -80, y: -40, w: 160, d: 80, r: 1.5 }; // outer
const TI = { x0: -78, x1: 78, y0: -38, y1: 38 }; // inner
const FLOOR_H = 3, RIM = 30;
const ZW = 23; // water level; the hull's waterline origin
const HB = 20, HT = 12, HF = 12, HL = 60; // half beam, draft, freeboard, half length (units)
const HULL = [[-HB, -HT + 1.5], [-HB + 1.5, -HT], [HB - 1.5, -HT], [HB, -HT + 1.5], [HB, HF - 0.6], [HB - 0.6, HF], [-HB + 0.6, HF], [-HB, HF - 0.6]];
const PIVOT = { s: 48, v: 47.4 }; // pendulum pivot under the gallows arm
const BOB_DROP = 31.4; // pivot to bob centre
const BATTEN_V = 22; // where the string crosses the batten
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [48, -16, ZW + 52], [48, 4, ZW + 52], [30, 0, ZW + 42], [-60, -22, ZW + 14], [60, 22, ZW + 14]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 38 },
);
const view = k.towardViewer(P);
const VIEW3 = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

// The hull's frame at heel φ: a along the length, u across the beam (+u
// goes down when φ > 0), v up through the deck; origin on the waterline.
function frameAt(phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return G.frameOf([0, 0, ZW], [1, 0, 0], [0, c, -s], [0, s, c]);
}
function W(F, s, u, v) {
  return [F.o[0] + F.a[0] * s + F.u[0] * u + F.v[0] * v, F.o[1] + F.a[1] * s + F.u[1] * u + F.v[1] * v, F.o[2] + F.a[2] * s + F.u[2] * u + F.v[2] * v];
}
function box(F, s0, s1, u0, u1, v0, v1) {
  return G.prismOf(F, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], s0, s1, P);
}
function seg(F, a, b) {
  return k.pathOf([k.iso(W(F, a[0], a[1], a[2]), P), k.iso(W(F, b[0], b[1], b[2]), P)]);
}
function facing(n) {
  return n[0] * VIEW3[0] + n[1] * VIEW3[1] + n[2] * VIEW3[2] > 1e-6;
}
function along(F, s, u, v, axis) {
  return G.frameAlong(W(F, s, u, v), axis);
}

// ---------------------------------------------------------------- static parts
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 14)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 5.5, -PLATE_H - FOOT_H, 1.4, P, 24), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 4.2, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  return out.join("");
}
// The tank: floor, the two far walls, and the corner post they share.
function tankBack() {
  const out = [];
  out.push(S_(k.slabOf(TANK, 0, FLOOR_H, P, 4, 0.4), { tone: "lo" }));
  out.push(S_(k.slabOf({ x: TANK.x, y: TANK.y, w: TANK.w, d: 2, r: 0.3 }, FLOOR_H, RIM - FLOOR_H, P, 2), { tone: "lo" }));
  out.push(S_(k.slabOf({ x: TANK.x, y: TANK.y, w: 2, d: TANK.d, r: 0.3 }, FLOOR_H, RIM - FLOOR_H, P, 2), { tone: "lo" }));
  // A fill fitting on the far wall, and a level line scribed at the
  // design waterline.
  out.push(S_(G.disc(0, 2.4, 2.6, G.frameAlong([40, TI.y0, 9], [0, 1, 0]), P, { steps: 24 }), { tone: "mid" }));
  out.push(S_(G.disc(2.4, 3.4, 1.4, G.frameAlong([40, TI.y0, 9], [0, 1, 0]), P, { steps: 16 }), { tone: "mid" }));
  out.push(L(k.pathOf([at([TI.x0, TI.y0, ZW]), at([TI.x1, TI.y0, ZW])]), { tone: "faint" }));
  out.push(L(k.pathOf([at([TI.x0, TI.y0, ZW]), at([TI.x0, TI.y1, ZW])]), { tone: "faint" }));
  return out.join("");
}
function waterBack() {
  const plan = { x: TI.x0, y: TI.y0, w: TI.x1 - TI.x0, d: TI.y1 - TI.y0, r: 0.4 };
  return S_(k.slabOf(plan, FLOOR_H, ZW - FLOOR_H, P, 2), { tone: "lo", crease: "none" });
}
function tankFront() {
  const out = [];
  const x1 = TANK.x + TANK.w, y1 = TANK.y + TANK.d;
  const post = (x, y) => S_(k.slabOf({ x: x - 2, y: y - 2, w: 2, d: 2, r: 0.2 }, FLOOR_H, RIM - FLOOR_H, P, 2), { tone: "mid" });
  out.push(post(x1, TANK.y + 2));
  out.push(post(TANK.x + 2, y1));
  out.push(S_(k.slabOf({ x: TANK.x, y: y1 - 2, w: TANK.w, d: 2, r: 0.2 }, FLOOR_H, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: x1 - 2, y: TANK.y, w: 2, d: TANK.d, r: 0.2 }, FLOOR_H, 2, P, 2), { tone: "mid" }));
  out.push(post(x1, y1));
  out.push(S_(k.slabOf({ x: TANK.x, y: y1 - 2, w: TANK.w, d: 2, r: 0.2 }, RIM - 2, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: x1 - 2, y: TANK.y, w: 2, d: TANK.d, r: 0.2 }, RIM - 2, 2, P, 2), { tone: "mid" }));
  const corners = [[x1 - 1, y1 - 1], [TANK.x + 1, y1 - 1], [x1 - 1, TANK.y + 1]];
  out.push(Dots(corners.map(([x, y]) => at([x, y, RIM])), { size: 0.45, tone: "lo" }));
  // A drain cock low on the near end.
  const F = G.frameAlong([x1, 20, 6.5], [1, 0, 0]);
  out.push(S_(G.disc(0, 2.6, 1.3, F, P, { steps: 16 }), { tone: "mid" }));
  out.push(S_(G.disc(2.6, 3.6, 2.2, F, P, { steps: 20 }), { tone: "mid" }));
  return out.join("");
}
// Bench furniture in front of the tank: a spirit level, a stack of spare
// weights, a label plate and a ruler strip.
function bench() {
  const out = [];
  const strip = { x: -72, y: 43, w: 120, d: 4.5, r: 0.6 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.4, 0.8, [1.6, 3], P);
  out.push(`<path class="mi-tick" d="${ticks.minor + ticks.major}"/>`);
  const label = { x: 88, y: 18, w: 22, d: 18, r: 1 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 3, 0.3), { tone: "lo" }));
  const rules = [23, 27, 31].map((y, i) => k.lineOnTop([label.x + 3, y], [label.x + label.w - (i === 2 ? 9 : 3), y], 0.8, P)).join("");
  out.push(L(rules, { tone: "faint", free: true }));
  out.push(Dots(k.corners(label, 1.6).map(([x, y]) => at([x, y, 0.8])), { size: 0.4, tone: "lo" }));
  // Spirit level: a bar with a vial window and its bubble.
  const lvl = { x: 86, y: -6, w: 26, d: 6, r: 0.8 };
  out.push(S_(k.slabOf(lvl, 0, 3, P, 3, 0.4), { tone: "mid" }));
  const vial = { x: 95, y: -4.6, w: 8, d: 3.2, r: 1.2 };
  out.push(S_(k.slabOf(vial, 3, 0.4, P, 6), { tone: "hi", crease: "none" }));
  out.push(Dots([at([99, -3, 3.4])], { size: 0.9, tone: "lo" }));
  out.push(L(k.lineOnTop([97.4, -4.6], [97.4, -1.4], 3.4, P) + k.lineOnTop([100.6, -4.6], [100.6, -1.4], 3.4, P), { tone: "lo" }));
  // Spare weights: three discs on a pin.
  const wx = 100, wy = -30;
  for (let i = 0; i < 3; i++) out.push(S_(k.cylinder(wx, wy, 5 - i * 0.6, i * 2.6, 2.4, P, 32, 0.3), { tone: i === 2 ? "hi" : "mid" }));
  out.push(S_(k.cylinder(wx, wy, 0.9, 7.8, 3.2, P, 14), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving parts
// The hull with its deck gear, at heel phi, weight at dmm (mm) and the
// ballast slider at hb (units).
function hull(phi, dmm, hb) {
  const F = frameAt(phi);
  const out = [];
  out.push(S_(G.prismOf(F, HULL, -HL, HL, P), { tone: "hi" }));
  // Side markings on whichever side faces us: boot-top at the design
  // waterline, a rubbing strake, and draft ticks every 5 mm at the stern.
  const side = facing(F.u) ? 1 : facing(F.u.map((c) => -c)) ? -1 : 0;
  if (side) {
    const u = side * HB;
    const lines = [seg(F, [-HL, u, 0], [HL, u, 0]), seg(F, [-HL, u, 9], [HL, u, 9])];
    out.push(L(lines.join(""), { tone: "lo" }));
    const minor = [], major = [];
    for (let v = -HT + 1; v <= -1; v++) (v % 2 ? minor : major).push(seg(F, [HL, u, v], [HL - (v % 2 ? 1.4 : 2.6), u, v]));
    out.push(L(minor.join(""), { tone: "faint" }) + L(major.join(""), { tone: "lo" }));
  }
  // The transom (the end facing us): waterline and two drain plugs.
  out.push(L(seg(F, [HL, -HB, 0], [HL, HB, 0]), { tone: "lo" }));
  out.push(Dots([W(F, HL, -12, -8), W(F, HL, 12, -8)].map(at), { size: 0.55, tone: "lo" }));
  // Deck: a margin line, the rail's scale and a hatch.
  const m = 1.6;
  out.push(L(k.pathOf([[-HL + m, -HB + m], [HL - m, -HB + m], [HL - m, HB - m], [-HL + m, HB - m]].map(([s, u]) => at(W(F, s, u, HF))), true), { tone: "faint" }));
  out.push(S_(box(F, -40, -20, -10, 10, HF, HF + 1.6), { tone: "mid" }));
  out.push(Dots([[-38.6, -8.6], [-21.4, -8.6], [-38.6, 8.6], [-21.4, 8.6]].map(([s, u]) => at(W(F, s, u, HF + 1.6))), { size: 0.42, tone: "lo" }));
  out.push(L(STOPS.map((d) => seg(F, [-3, d / 5, HF], [-5.4 - (d === 0 ? 1.2 : 0), d / 5, HF])).join(""), { tone: "lo" }));
  const bollard = (s, u) => S_(G.disc(0, 2.6, 1.3, along(F, s, u, HF, F.v), P, { steps: 16 }), { tone: "mid" }) + S_(G.disc(2.6, 3.2, 1.9, along(F, s, u, HF, F.v), P, { steps: 20 }), { tone: "mid" });
  const gear = [];
  gear.push([W(F, -54, -15, HF), bollard(-54, -15)]);
  gear.push([W(F, -54, 15, HF), bollard(-54, 15)]);
  gear.push([W(F, 54, -15, HF), bollard(54, -15)]);
  gear.push([W(F, 54, 15, HF), bollard(54, 15)]);
  gear.sort((a, b) => k.depthOf(a[0], P) - k.depthOf(b[0], P));
  out.push(gear.filter(([p]) => p[0] < 0).map(([, svg]) => svg).join(""));
  // The inclining rail, its end stops and the weight.
  out.push(S_(box(F, -3, 3, -18, 18, HF, HF + 1.2), { tone: "mid" }));
  out.push(Dots([W(F, 0, -12, HF + 1.2), W(F, 0, 12, HF + 1.2)].map(at), { size: 0.4, tone: "lo" }));
  out.push(S_(box(F, -3.6, 3.6, -18.6, -16.6, HF, HF + 3.4), { tone: "mid" }));
  const d = dmm / 5;
  const wt = S_(box(F, -4.5, 4.5, d - 4, d + 4, HF + 1.2, HF + 6.4), { tone: "hi", lit: true });
  const eye = S_(G.disc(0, 1.2, 1.5, along(F, 0, d, HF + 6.4, F.v), P, { steps: 16 }), { tone: "mid" });
  const stopNear = S_(box(F, -3.6, 3.6, 16.6, 18.6, HF, HF + 3.4), { tone: "mid" });
  out.push(side >= 0 ? wt + eye + stopNear : stopNear + wt + eye);
  // Ballast slider on a threaded post.
  const flange = S_(G.disc(0, 1, 3.2, along(F, 30, 0, HF, F.v), P, { steps: 24 }), { tone: "mid" });
  const rodLow = S_(G.disc(1, hb + 2.4 - HF, 0.9, along(F, 30, 0, HF, F.v), P, { steps: 14 }), { tone: "mid", crease: "none" });
  const slider = S_(box(F, 27, 33, -3.5, 3.5, hb - 2.4, hb + 2.4), { tone: "mid", inner: L(seg(F, [33, -3.5, hb], [33, 3.5, hb]), { tone: "faint" }) });
  const knob = S_(G.disc(0, 1.8, 1.2, along(F, 30, 3.5, hb, F.u), P, { steps: 14 }), { tone: "mid" });
  const rodHigh = S_(G.disc(hb + 2.4 - HF, 38 - HF, 0.9, along(F, 30, 0, HF, F.v), P, { steps: 14 }), { tone: "mid", crease: "none" });
  const nut = S_(G.disc(38 - HF, 39.4 - HF, 1.7, along(F, 30, 0, HF, F.v), P, { steps: 6 }), { tone: "mid" });
  out.push(flange + rodLow + (side >= 0 ? slider + knob : knob + slider) + rodHigh + nut);
  // The pendulum gallows, batten and damping trough.
  out.push(S_(box(F, 46.4, 49.6, -16.4, -13.2, HF, HF + 0.8), { tone: "mid" }));
  out.push(Dots([W(F, 47, -15.8, HF + 0.8), W(F, 49, -13.8, HF + 0.8)].map(at), { size: 0.4, tone: "lo" }));
  out.push(S_(box(F, 47.2, 48.8, -15.6, -14, HF + 0.8, PIVOT.v + 1.6), { tone: "mid" }));
  out.push(S_(box(F, 45.8, 46.6, -9.8, -9, HF, BATTEN_V - 0.8), { tone: "mid" }));
  out.push(S_(box(F, 45.8, 46.6, 9, 9.8, HF, BATTEN_V - 0.8), { tone: "mid" }));
  const bminor = [], bmajor = [];
  for (let u = -10; u <= 10; u++) {
    if (u === 0) continue;
    (u % 5 ? bminor : bmajor).push(seg(F, [46.8, u, BATTEN_V - 0.8], [46.8, u, BATTEN_V - 0.8 + (u % 5 ? 0.7 : 1.2)]));
  }
  const zero = L(seg(F, [46.8, 0, BATTEN_V - 0.8], [46.8, 0, BATTEN_V + 0.8]), { tone: "hi" });
  out.push(S_(box(F, 46, 46.8, -11, 11, BATTEN_V - 0.8, BATTEN_V + 0.8), { tone: "hi", inner: L(bminor.join(""), { tone: "lo" }) + L(bmajor.join(""), { tone: "mid" }) + zero }));
  out.push(S_(box(F, 46.9, 49.1, -6, 6, HF, HF + 2.4), { tone: "lo", inner: L(k.pathOf([[47.4, -5.5], [48.6, -5.5], [48.6, 5.5], [47.4, 5.5]].map(([s, u]) => at(W(F, s, u, HF + 2.4))), true), { tone: "faint" }) }));
  out.push(S_(box(F, 47.2, 48.8, -15.6, 1.6, PIVOT.v, PIVOT.v + 1.6), { tone: "mid" }));
  // The string hangs plumb in the world, whatever the heel.
  const pivot = W(F, PIVOT.s, 0, PIVOT.v);
  const bob = [pivot[0], pivot[1], pivot[2] - BOB_DROP];
  out.push(`<path class="mi-string" d="${k.pathOf([at(pivot), at([bob[0], bob[1], bob[2] + 1.2])])}"/>`);
  out.push(Dots([at(pivot)], { size: 0.6, tone: "lo" }));
  out.push(S_(G.sphereOf(bob, 1.3, P, { steps: 32 }), { tone: "hi" }));
  out.push(gear.filter(([p]) => p[0] > 0).map(([, svg]) => svg).join(""));
  return out.join("");
}
// The water in front of the hull, cut around its waterline footprint.
function waterFront(phi) {
  const yb = Math.min(HB / Math.cos(phi), TI.y1 - 1);
  const ring = [[TI.x0, yb], [HL, yb], [HL, -yb], [TI.x1, -yb], [TI.x1, TI.y1], [TI.x0, TI.y1]];
  return S_(k.extrude(ring, FLOOR_H, ZW - FLOOR_H, P, { convex: false }), { tone: "lo", crease: "none" });
}

// ---------------------------------------------------------------- assemble
const HB0 = 22, D0 = 35;
const GM0 = GM_OF(HB0);
const PHI0 = heelOf(D0, GM0);
const LABEL =
  "An inclining experiment on a bench. A box-shaped model pontoon floats in a glass tank. A weight sits on a rail across its deck and can slide toward either side; a ballast slider on a threaded post raises or lowers the model's centre of gravity. Near the stern a gallows holds a pendulum whose string hangs plumb over a damping trough and crosses a scale batten fixed to the hull, so the string's offset on the batten measures the heel. A spirit level, spare weights and a label plate lie on the bench.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    tankBack(),
    `<g class="mi-water">${waterBack()}</g>`,
    `<g data-mi-hull>${hull(PHI0, D0, HB0)}</g>`,
    `<g class="mi-water mi-front" data-mi-water>${waterFront(PHI0)}</g>`,
    tankFront(),
    bench(),
  ],
});
const stage = `<div class="iso-stage mi-stage" tabindex="0" role="group" aria-roledescription="inclining experiment" aria-label="Inclining experiment. Left and right arrows move the weight across the deck, up and down arrows raise or lower the ballast, Space pauses the tour.">${svg}<span class="mi-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Inclining experiment",
  hint: "← → weight · ↑ ↓ ballast",
  readout: readoutOf(D0, PHI0, GM0),
  keys: [
    { mark: "lit", label: "Inclining weight: 250 g, moved across the deck" },
    { mark: "raised", label: "Batten: the plumb string's offset reads the heel" },
  ],
  caption: `The pontoon is 600 × 200 mm and floats 60 mm deep in fresh water, so it displaces ${DISP.toFixed(1)} kg, with KB = ${KB} mm and BM = B²/12T = ${BM.toFixed(1)} mm. Moving the weight w a distance d tips it until the righting moment Δ·GZ balances w·d·cos φ, and at small angles GM = w·d / (Δ·tan φ). The heel is solved from the wall-sided formula, and the hull rolls at its own natural period.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="${NAME}">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS
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
const R_ = `[data-anatomy="${NAME}"]`;
const FIGURE_CSS = `
.iso${R_}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:760px;margin:0 auto;color:var(--anatomy-text)}
.iso${R_}[data-theme="light"],html:not(.dark) .iso${R_}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso${R_} .iso-figure{margin:0}
.iso${R_} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R_} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums;white-space:pre}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .mi-stage{position:relative;outline:none;cursor:default}
.iso${R_} .mi-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .mi-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .mi-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.7;stroke-linecap:round}
.iso${R_} .mi-string{fill:none;stroke:var(--brand,#db2777);stroke-width:.9;stroke-linecap:round}
.iso${R_} .mi-water{opacity:.8}
.iso${R_} .mi-front{opacity:.72}
.iso${R_} .mi-water .iso-fill{fill:color-mix(in oklab,var(--anatomy-blue) 16%,var(--anatomy-paper))}
.iso${R_} .mi-water .iso-top{fill:color-mix(in oklab,var(--anatomy-blue) 34%,var(--anatomy-paper))}
.iso${R_} .mi-water .iso-shade{fill:color-mix(in oklab,var(--anatomy-blue) 22%,var(--anatomy-paper))}
.iso${R_} .mi-water .iso-edge{stroke:color-mix(in oklab,var(--anatomy-blue) 60%,var(--anatomy-paper))}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:9.5px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameOf, frameAlong, disc, prismOf, sphereOf, viewOf }; })();
const k = { pathOf, iso, extrude, depthOf };
const P = ${JSON.stringify(P)};
const VIEW3 = ${JSON.stringify(VIEW3)};
const MODEL = ${JSON.stringify(MODEL)}, DISP = ${DISP}, KB = ${KB}, BM = ${BM};
const HB_RANGE = ${JSON.stringify(HB_RANGE)}, STOPS = ${JSON.stringify(STOPS)};
const TI = ${JSON.stringify(TI)}, FLOOR_H = ${FLOOR_H}, ZW = ${ZW};
const HB = ${HB}, HT = ${HT}, HF = ${HF}, HL = ${HL};
const HULL = ${JSON.stringify(HULL)}, PIVOT = ${JSON.stringify(PIVOT)}, BOB_DROP = ${BOB_DROP}, BATTEN_V = ${BATTEN_V};
const at = (p) => iso(p, P);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const Dots = (points, style) => dotsSvg(points, style);
const KG_OF = ${KG_OF.toString()};
const GM_OF = ${GM_OF.toString()};
const readoutOf = ${readoutOf.toString()};
${heelOf.toString()}
${frameAt.toString()}
${W.toString()}
${box.toString()}
${seg.toString()}
${facing.toString()}
${along.toString()}
${hull.toString()}
${waterFront.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".mi-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const g = { hull: svg.querySelector("[data-mi-hull]"), water: svg.querySelector("[data-mi-water]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  // State: weight target and position (mm), ballast height, heel and roll rate.
  let target = ${D0}, d = ${D0}, hb = ${HB0}, phi = ${PHI0}, rate = 0;
  let touched = false, paused = false, frame = 0, last = 0, visible = false, tourAt = 0, stop = 3;
  const TOUR = [2, 3, 4, 3, 2, 1, 0, 1];
  let tourIndex = 1;
  function draw() {
    g.hull.innerHTML = hull(phi, d, hb);
    g.water.innerHTML = waterFront(phi);
    const text = readoutOf(d, phi, GM_OF(hb));
    if (readout.textContent !== text) readout.textContent = text;
  }
  function settle() {
    d = target;
    phi = heelOf(d, GM_OF(hb));
    rate = 0;
    draw();
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (!touched && !paused) {
      tourAt += dt;
      if (tourAt > 3.2) { tourAt = 0; tourIndex = (tourIndex + 1) % TOUR.length; stop = TOUR[tourIndex]; target = STOPS[stop]; }
    }
    // The weight slides with an exponential follow; the hull rolls as a
    // damped oscillator at its natural period, T = 2π·k / √(g·GM), with
    // the radius of gyration k ≈ 0.4·B.
    d += (target - d) * (1 - Math.exp(-dt * 5));
    const gm = GM_OF(hb) / 1000;
    const wn = Math.sqrt(9.81 * gm) / (0.4 * MODEL.B / 1000);
    const goal = heelOf(d, GM_OF(hb));
    const acc = -wn * wn * (phi - goal) - 2 * 0.16 * wn * rate;
    rate += acc * dt;
    phi += rate * dt;
    draw();
    const moving = Math.abs(target - d) > 0.05 || Math.abs(rate) > 1e-4 || Math.abs(phi - goal) > 1e-4;
    frame = visible && !still.matches && (moving || (!touched && !paused)) ? requestAnimationFrame(tick) : 0;
  }
  const run = () => {
    if (still.matches) { settle(); return; }
    if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); }
  };
  stage.addEventListener("keydown", (event) => {
    let used = true;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      stop = Math.max(0, Math.min(STOPS.length - 1, stop + (event.key === "ArrowRight" ? 1 : -1)));
      target = STOPS[stop];
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      hb = Math.max(HB_RANGE[0], Math.min(HB_RANGE[1], hb + (event.key === "ArrowUp" ? 2 : -2)));
    } else if (event.key === " ") {
      paused = !paused;
    } else used = false;
    if (!used) return;
    event.preventDefault();
    if (event.key !== " ") touched = true;
    run();
    say.textContent = readoutOf(target, heelOf(target, GM_OF(hb)), GM_OF(hb));
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
const js = `// Generated by figures/${NAME}/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit and lathe runtimes (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, `${NAME}.html`), fragment + "\n");
writeFileSync(join(OUT, `${NAME}.css`), css);
writeFileSync(join(OUT, `${NAME}.js`), js);
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inclining experiment</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`Δ ${DISP.toFixed(2)} kg · BM ${BM.toFixed(2)} mm · GM0 ${GM0.toFixed(2)} mm · φ0 ${((PHI0 * 180) / Math.PI).toFixed(2)}° · wrote ${NAME}.*`);
