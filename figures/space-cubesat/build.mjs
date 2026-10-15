// Fig · A 3U CubeSat on an air-bearing table. The satellite stands on a
// turntable that floats on a film of air, so the only torque on it comes
// from its own reaction wheel: when the wheel spins up one way the body
// turns the other way, and the total angular momentum stays zero. The body
// carries corner rails, body-mounted cells, two deployed solar wings, a sun
// sensor, a tape antenna and the wheel itself (shown on the top deck so its
// spokes can be seen). A degree scale on the bearing cup reads the yaw.
// The slew is a PD controller with a torque limit, the same model as the
// attitude block; its settings arrive as "spc-attitude" events on document.
// Run from the repo root: node figures/space-cubesat/build.mjs
// Writes site/static/anatomy/space-cubesat.{html,css,js} and
// figures/space-cubesat/preview{,-light}.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });
const NAME = "space-cubesat";

// ---------------------------------------------------------------- model
// Body inertia about the yaw axis (3U with deployed wings), wheel inertia,
// wheel torque limit and wheel speed limit. The controller commands a
// torque on the body; the wheel takes the opposite torque.
const SAT = { I: 0.05, Iw: 2.0e-5, tmax: 2.0e-3, rpmMax: 6000 };
const CTRL0 = { target: 60, wn: 0.4, zeta: 0.9, tmax: 2.0 }; // deg, rad/s, –, mN·m
function stepAtt(s, c, dt) {
  // s: { th, w } in rad and rad/s; returns the commanded torque (N·m).
  const n = Math.max(1, Math.ceil(dt / 0.01));
  const h = dt / n;
  const kp = c.wn * c.wn * SAT.I, kd = 2 * c.zeta * c.wn * SAT.I;
  const tlim = c.tmax * 1e-3;
  let tau = 0;
  for (let i = 0; i < n; i++) {
    tau = -kp * (s.th - (c.target * Math.PI) / 180) - kd * s.w;
    tau = Math.max(-tlim, Math.min(tlim, tau));
    // The wheel saturates: it cannot absorb more momentum than Iw·ωmax.
    const hMax = SAT.Iw * ((SAT.rpmMax * 2 * Math.PI) / 60);
    const hw = -SAT.I * s.w;
    if ((hw >= hMax && tau < 0) || (hw <= -hMax && tau > 0)) tau = 0;
    s.w += (tau / SAT.I) * h;
    s.th += s.w * h;
  }
  return tau;
}
const wheelRpm = (s) => ((-SAT.I * s.w) / SAT.Iw) * (60 / (2 * Math.PI));
const readoutOf = (s, c) => {
  const deg = (s.th * 180) / Math.PI;
  const rpm = wheelRpm(s);
  return `yaw ${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(1)}° → ${c.target >= 0 ? "+" : "−"}${Math.abs(c.target).toFixed(0)}°\nwheel ${rpm >= 0 ? "+" : "−"}${Math.abs(rpm).toFixed(0).padStart(4, " ")} rpm`;
};

// ---------------------------------------------------------------- layout (z up)
const WIDTH = 640, HEIGHT = 600;
const PLATE = { x: -80, y: -58, w: 150, d: 116, r: 7 };
const PLATE_H = 8, FOOT_H = 4;
const CUP = { r: 22, z0: 20, z1: 25 }; // bearing cup with the degree scale
const TABLE = { r: 17, z0: 25.6, z1: 29 }; // the floating table
const BODY = { half: 9.4, z0: 31, z1: 97 }; // 3U body (2 units per cm)
const RAIL = { half: 1.2, z0: 29.4, z1: 98.6 };
const WING = { root: 10.6, span: 36, z0: 36, z1: 92, t: 1 };
const DECK = 98.6;
const REG = { x: -68, y: 24, w: 20, d: 18, r: 1.4 }; // air regulator box
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((q) => {
    const a = (q * Math.PI) / 4, r = WING.root + WING.span + 1;
    return [[r * Math.cos(a), r * Math.sin(a), WING.z0], [r * Math.cos(a), r * Math.sin(a), WING.z1]];
  }), [6, 6, DECK + 30]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 40 },
);
const view = k.towardViewer(P);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => v.toFixed(2);

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
  // A ruler along the front edge and a label plate with three rule lines.
  const strip = { x: -10, y: PLATE.y + PLATE.d - 9, w: 84, d: 4.5, r: 0.6 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.4, 0.8, [1.6, 3], P);
  out.push(`<path class="sc-tick" d="${ticks.minor}"/><path class="sc-tick sc-major" d="${ticks.major}"/>`);
  // A spirit level across the front right corner, its bubble centred.
  const lv = { x: 38, y: 34, w: 24, d: 6, r: 1 };
  out.push(S_(k.slabOf(lv, 0, 3, P, 3, 0.3), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: lv.x + 6, y: lv.y + 1.6, w: 12, d: 2.8, r: 1.3 }, 3, 0.4, P, 6), { tone: "hi", crease: "none" }));
  out.push(L(k.lineOnTop([lv.x + 10.6, lv.y + 1.8], [lv.x + 10.6, lv.y + 4.2], 3.45, P) + k.lineOnTop([lv.x + 13.4, lv.y + 1.8], [lv.x + 13.4, lv.y + 4.2], 3.45, P), { tone: "lo" }));
  out.push(Dots([at([lv.x + 12, lv.y + 3, 3.45])], { size: 0.8, tone: "lo" }));
  out.push(Dots([at([lv.x + 2, lv.y + 3, 3]), at([lv.x + lv.w - 2, lv.y + 3, 3])], { size: 0.4, tone: "lo" }));
  const label = { x: 38, y: -50, w: 28, d: 18, r: 1 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 3, 0.3), { tone: "lo" }));
  const rules = [-45, -41, -37].map((y, i) => k.lineOnTop([label.x + 3, y], [label.x + label.w - (i === 2 ? 12 : 3), y], 0.8, P)).join("");
  out.push(L(rules, { tone: "faint", free: true }));
  out.push(Dots(k.corners(label, 1.6).map(([x, y]) => at([x, y, 0.8])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
// The air regulator: a box with a gauge face and a knurled knob, piped to
// the pedestal. The hose is drawn before the pedestal so it tucks under it.
function regulator() {
  const out = [];
  out.push(S_(k.slabOf(REG, 0, 12, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(REG, 3, P, 3), { tone: "faint" }) }));
  out.push(Dots(k.corners(REG, 2).map(([x, y]) => at([x, y, 12])), { size: 0.42, tone: "lo" }));
  // Gauge on the top face with radial ticks and a needle at 3 bar of 6.
  const gx = REG.x + 7, gy = REG.y + 9;
  out.push(S_(k.cylinder(gx, gy, 5, 12, 1.2, P, 32, 0.3), { tone: "hi" }));
  const t = k.radialTicks(gx, gy, 4.4, 12, 3, 13.2, [0.8, 1.5], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(`<path class="sc-tick" d="${t.minor}"/><path class="sc-tick sc-major" d="${t.major}"/>`);
  const na = -Math.PI * 0.75 + Math.PI * 0.75; // 3 of 6 bar: straight up the dial
  out.push(L(k.lineOnTop([gx, gy], [gx + 3.4 * Math.sin(na), gy - 3.4 * Math.cos(na)], 13.25, P), { tone: "mid" }));
  out.push(Dots([at([gx, gy, 13.25])], { size: 0.6 }));
  const kx = REG.x + 15.5, ky = REG.y + 9;
  out.push(S_(k.cylinder(kx, ky, 2.6, 12, 4, P, 24), { tone: "mid", inner: L(k.knurl(kx, ky, 2.6, 12.3, 15.7, 18, P, 0), { tone: "faint" }) }));
  // The hose runs along the plate to the pedestal's inlet.
  out.push(k.wireSvg(at([REG.x + REG.w, REG.y + 9, 4]), at([-17, 13, 4]), { via: [at([-34, 39, 1.5]), at([-24, 24, 1.5])], tone: "lo", size: 1 }));
  return out.join("");
}
function pedestal() {
  const out = [];
  out.push(S_(k.cylinder(0, 0, 28, 0, 3, P, 48, 0.5), { tone: "mid" }));
  out.push(Dots([0, 1, 2, 3, 4, 5].map((q) => (q * Math.PI) / 3 + 0.3).map((a) => at([25 * Math.cos(a), 25 * Math.sin(a), 3])), { size: 0.45, tone: "lo" }));
  // Three levelling screws with knurled heads around the base flange.
  for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3].sort((p, q) => k.depthOf([31 * Math.cos(p), 31 * Math.sin(p), 0], P) - k.depthOf([31 * Math.cos(q), 31 * Math.sin(q), 0], P))) {
    const x = 31 * Math.cos(a), y = 31 * Math.sin(a);
    out.push(S_(k.cylinder(x, y, 2.8, 0, 1.2, P, 20), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 2.2, 1.2, 3.2, P, 20), { tone: "mid", inner: L(k.knurl(x, y, 2.2, 1.5, 4.1, 14, P, 0), { tone: "faint" }) }));
  }
  out.push(S_(k.cylinder(0, 0, 13, 3, CUP.z0 - 3, P, 40), { tone: "mid", inner: L([8, 13].map((z) => k.sideArc(0, 0, 13, z, P, 28)).join(""), { tone: "faint" }) }));
  // Inlet fitting where the hose arrives.
  out.push(S_(k.cylinder(-14, 10.2, 2.2, 2, 4, P, 16), { tone: "mid" }));
  out.push(S_(k.cylinder(0, 0, CUP.r, CUP.z0, CUP.z1 - CUP.z0, P, 64, 0.4), { tone: "mid", inner: L(k.sideArc(0, 0, CUP.r, CUP.z0 + 1.6, P, 40), { tone: "faint" }) }));
  // Degree scale on the cup rim: a tick every 5°, a long one every 30°.
  const t = k.radialTicks(0, 0, CUP.r - 0.4, 72, 6, CUP.z1, [1.3, 2.6], P);
  out.push(`<path class="sc-tick" d="${t.minor}"/><path class="sc-tick sc-major" d="${t.major}"/>`);
  out.push(L(k.ring(0, 0, CUP.r - 3.2, CUP.z1, P, 64), { tone: "faint" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving parts
// Body frame → world: a rotation by ψ about the vertical axis.
const rot = (psi, [x, y]) => [x * Math.cos(psi) - y * Math.sin(psi), x * Math.sin(psi) + y * Math.cos(psi)];
const square = (cx, cy, hx, hy, psi) => [[cx - hx, cy - hy], [cx + hx, cy - hy], [cx + hx, cy + hy], [cx - hx, cy + hy]].map((p) => rot(psi, p));
const facing = (psi, n) => { const [nx, ny] = rot(psi, n); return nx * view[0] + ny * view[1] > 0.02; };
const depthAt = (psi, p, z) => { const [x, y] = rot(psi, p); return k.depthOf([x, y, z], P); };
const seg3 = (psi, a, b) => { const [ax, ay] = rot(psi, a), [bx, by] = rot(psi, b); return k.pathOf([at([ax, ay, a[2]]), at([bx, by, b[2]])]); };
// The table floats and turns with the satellite: a pointer on its rim reads
// the yaw against the cup's scale.
function table(psi) {
  const out = [];
  out.push(S_(k.cylinder(0, 0, TABLE.r, TABLE.z0, TABLE.z1 - TABLE.z0, P, 56, 0.4), { tone: "hi", crease: "none" }));
  const bolts = [0, 1, 2, 3].map((q) => rot(psi, [12 * Math.cos((q * Math.PI) / 2 + Math.PI / 4), 12 * Math.sin((q * Math.PI) / 2 + Math.PI / 4)]));
  out.push(Dots(bolts.map(([x, y]) => at([x, y, TABLE.z1])), { size: 0.45, tone: "lo" }));
  // The pointer: along body +x, out to the scale.
  const [px0, py0] = rot(psi, [TABLE.r - 1, 0]), [px1, py1] = rot(psi, [CUP.r - 0.6, 0]);
  out.push(`<path class="sc-pointer" d="${k.pathOf([at([px0, py0, TABLE.z0 + 0.6]), at([px1, py1, CUP.z1 + 0.15])])}"/>`);
  out.push(`<circle class="sc-nib" cx="${f2(at([px1, py1, CUP.z1 + 0.15])[0])}" cy="${f2(at([px1, py1, CUP.z1 + 0.15])[1])}" r="0.9"/>`);
  return out.join("");
}
// Body faces: the four sides (normals ±x, ±y in the body frame) carry
// body-mounted cells, two per U, with a seam at each U.
const FACES = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function bodyFaceLines(psi) {
  const lines = [], cells = [];
  const h = BODY.half;
  for (const [nx, ny] of FACES) {
    if (!facing(psi, [nx, ny])) continue;
    const tx = -ny, ty = nx; // along the face
    const p = (s, z) => [nx * h + tx * s, ny * h + ty * s, z];
    // U seams at 1/3 and 2/3 of the height.
    for (const f of [1 / 3, 2 / 3]) { const z = BODY.z0 + f * (BODY.z1 - BODY.z0); lines.push(seg3(psi, p(-h, z), p(h, z))); }
    // Cells: inset rectangles, two per U, split down the middle.
    for (let u = 0; u < 3; u++) {
      const z0 = BODY.z0 + (u * (BODY.z1 - BODY.z0)) / 3 + 2.2, z1 = BODY.z0 + ((u + 1) * (BODY.z1 - BODY.z0)) / 3 - 2.2;
      for (const [s0, s1] of [[-h + 1.6, -0.5], [0.5, h - 1.6]]) {
        const ring = [p(s0, z0), p(s1, z0), p(s1, z1), p(s0, z1)].map(([x, y, z]) => { const [rx, ry] = rot(psi, [x, y]); return at([rx, ry, z]); });
        cells.push(k.pathOf(ring, true));
        const zm = (z0 + z1) / 2;
        lines.push(seg3(psi, p(s0, zm), p(s1, zm)));
      }
    }
  }
  return `<path class="sc-cell" d="${cells.join("")}"/>` + L(lines.join(""), { tone: "faint" });
}
function rail(psi, sx, sy) {
  const c = [sx * (BODY.half - RAIL.half + 0.6), sy * (BODY.half - RAIL.half + 0.6)];
  return S_(k.extrude(square(c[0], c[1], RAIL.half, RAIL.half, psi), RAIL.z0, RAIL.z1 - RAIL.z0, P), { tone: "mid" });
}
// A wing hinged on a ±y face: a thin panel out along ±y, with cells on its
// faces and a hinge knuckle at the root.
function wing(psi, side) {
  const out = [];
  const y0 = side * WING.root, y1 = side * (WING.root + WING.span);
  const cy = (y0 + y1) / 2;
  const plan = square(0, cy, WING.t / 2, WING.span / 2, psi);
  out.push(S_(k.extrude(plan, WING.z0, WING.z1 - WING.z0, P), { tone: "hi", className: "sc-wing" }));
  // The face toward the viewer gets the cell grid (2 × 7).
  const nx = facing(psi, [1, 0]) ? 1 : -1;
  const xf = nx * (WING.t / 2 + 0.02);
  const grid = [];
  const ys = [0, 0.5, 1].map((f) => y0 + side * (1.4 + f * (WING.span - 2.8)));
  const zs = [...Array(8)].map((_, i) => WING.z0 + 2 + (i * (WING.z1 - WING.z0 - 4)) / 7);
  for (const y of ys) grid.push(seg3(psi, [xf, y, zs[0]], [xf, y, zs[7]]));
  for (const z of zs) grid.push(seg3(psi, [xf, ys[0], z], [xf, ys[2], z]));
  out.push(`<path class="sc-grid" d="${grid.join("")}"/>`);
  // Hinge knuckles at the root, top and bottom.
  for (const z of [WING.z0 + 6, WING.z1 - 9]) {
    const [hx, hy] = rot(psi, [0, side * (WING.root - 0.3)]);
    out.push(S_(k.cylinder(hx, hy, 1.1, z, 3, P, 12), { tone: "mid" }));
  }
  return out.join("");
}
// Top deck: the wheel (housing, flywheel with spokes), the sun sensor and
// the tape antenna.
function deck(psi, phi) {
  const out = [];
  out.push(S_(k.cylinder(0, 0, 7.2, DECK, 2.2, P, 40, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(0, 0, 6, DECK + 2.2, 1.4, P, 40), { tone: "hi", crease: "none", lit: true }));
  const spokes = [0, 1, 2].map((q) => phi + (q * 2 * Math.PI) / 3).map((a) => k.lineOnTop([1.2 * Math.cos(a), 1.2 * Math.sin(a)], [5.2 * Math.cos(a), 5.2 * Math.sin(a)], DECK + 3.6, P)).join("");
  out.push(`<path class="sc-spoke" d="${spokes}"/>`);
  out.push(Dots([at([0, 0, DECK + 3.6])], { size: 0.7, tone: "lo" }));
  const ss = rot(psi, [-5.6, 5.6]);
  out.push(S_(k.extrude(square(ss[0], ss[1], 2, 2, psi), DECK, 2, P), { tone: "mid" }));
  out.push(Dots([at([ss[0], ss[1], DECK + 2])], { size: 0.55, tone: "lo" }));
  const an = rot(psi, [5.8, -5.8]);
  out.push(S_(k.cylinder(an[0], an[1], 1.4, DECK, 2, P, 14), { tone: "mid" }));
  out.push(S_(k.cylinder(an[0], an[1], 0.35, DECK + 2, 26, P, 8), { tone: "hi", crease: "none" }));
  return out.join("");
}
// The whole satellite in painter's order: things farther from the viewer
// first. Wings and rails are sorted against the body by depth.
function satellite(psi, phi) {
  const items = [];
  const bodyDepth = depthAt(psi, [0, 0], (BODY.z0 + BODY.z1) / 2);
  for (const side of [1, -1]) items.push({ d: depthAt(psi, [0, side * (WING.root + WING.span / 2)], (WING.z0 + WING.z1) / 2), svg: wing(psi, side) });
  const rails = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => ({ d: depthAt(psi, [sx * BODY.half, sy * BODY.half], BODY.z0), svg: rail(psi, sx, sy) }));
  rails.sort((a, b) => a.d - b.d);
  items.push({ d: rails[0].d, svg: rails[0].svg });
  const body = S_(k.extrude(square(0, 0, BODY.half, BODY.half, psi), BODY.z0, BODY.z1 - BODY.z0, P), { tone: "hi", inner: bodyFaceLines(psi) });
  const topPlate = S_(k.extrude(square(0, 0, BODY.half + 0.6, BODY.half + 0.6, psi), BODY.z1, DECK - BODY.z1, P), { tone: "mid" });
  items.push({ d: bodyDepth, svg: body + rails.slice(1).map((r) => r.svg).join("") + topPlate + deck(psi, phi) });
  items.sort((a, b) => a.d - b.d);
  return table(psi) + items.map((i) => i.svg).join("");
}

// ---------------------------------------------------------------- assemble
const PSI0 = (20 * Math.PI) / 180;
const S0 = { th: PSI0, w: 0 };
const LABEL =
  "A 3U CubeSat standing on an air-bearing table on a lab bench. Air from a regulator with a pressure gauge flows through a hose into the pedestal and floats the table, so the satellite can turn freely about the vertical axis. The satellite has corner rails, body-mounted solar cells, two deployed solar wings, a sun sensor, a tape antenna and a reaction wheel on its top deck. When the wheel spins up one way, the satellite turns the other way. A pointer on the table reads the yaw angle against a degree scale on the bearing cup.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [plate(), regulator(), pedestal(), `<g data-sc-sat>${satellite(PSI0, 0)}</g>`],
});
const stage = `<div class="iso-stage sc-stage" tabindex="0" role="group" aria-roledescription="attitude test stand" aria-label="CubeSat on an air-bearing table. Left and right arrows command a slew of 30 degrees, Space pauses.">${svg}<span class="sc-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "CubeSat on an air bearing",
  hint: "← → slew 30° · space pause",
  readout: readoutOf(S0, { ...CTRL0, target: 20 }),
  keys: [
    { mark: "lit", label: "Reaction wheel: spins opposite to the body (spokes slowed 100× to be visible)" },
    { mark: "raised", label: "Pointer on the table: yaw against the 5° scale of the bearing cup" },
  ],
  caption: "A torque-limited PD controller turns the body to the commanded yaw; every newton-metre it applies to the body, the wheel takes the other way, so body and wheel momenta always cancel. Body inertia 0.05 kg·m², wheel 2 × 10⁻⁵ kg·m², up to 6000 rpm: a 60° slew spins the wheel to a few thousand rpm. The wheel sits inside a real CubeSat; it is drawn on the deck here so you can see it.",
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
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums;white-space:pre;text-align:right}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .sc-stage{position:relative;outline:none;cursor:default}
.iso${R_} .sc-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .sc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .sc-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.6;stroke-linecap:round}
.iso${R_} .sc-major{stroke:var(--anatomy-mid);stroke-width:.8}
.iso${R_} .sc-pointer{fill:none;stroke:var(--brand,#db2777);stroke-width:1.2;stroke-linecap:round}
.iso${R_} .sc-nib{fill:var(--brand,#db2777)}
.iso${R_} .sc-spoke{fill:none;stroke:var(--anatomy-card);stroke-width:1;stroke-linecap:round}
.iso${R_} .sc-cell{fill:color-mix(in oklab,var(--anatomy-blue) 20%,var(--anatomy-paper));stroke:color-mix(in oklab,var(--anatomy-blue) 55%,var(--anatomy-paper));stroke-width:.4}
.iso${R_} .sc-grid{fill:none;stroke:color-mix(in oklab,var(--anatomy-blue) 60%,var(--anatomy-paper));stroke-width:.45}
.iso${R_} .sc-wing .iso-fill{fill:color-mix(in oklab,var(--anatomy-blue) 16%,var(--anatomy-paper))}
.iso${R_} .sc-wing .iso-shade{fill:color-mix(in oklab,var(--anatomy-blue) 24%,var(--anatomy-paper))}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:9.5px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const liveSrc = `
const k = { pathOf, iso, cylinder, slabOf, extrude, depthOf, lineOnTop, solidSvg, lineSvg, dotsSvg };
const P = ${JSON.stringify(P)};
const view = ${JSON.stringify(view)};
const SAT = ${JSON.stringify(SAT)};
const BODY = ${JSON.stringify(BODY)}, RAIL = ${JSON.stringify(RAIL)}, WING = ${JSON.stringify(WING)}, TABLE = ${JSON.stringify(TABLE)}, CUP = ${JSON.stringify(CUP)};
const DECK = ${DECK};
const FACES = ${JSON.stringify(FACES)};
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const Dots = (points, style) => dotsSvg(points, style);
const stepAtt = ${stepAtt.toString()};
const wheelRpm = ${wheelRpm.toString()};
const readoutOf = ${readoutOf.toString()};
const rot = ${rot.toString()};
const square = ${square.toString()};
const facing = ${facing.toString()};
const depthAt = ${depthAt.toString()};
const seg3 = ${seg3.toString()};
${table.toString()}
${bodyFaceLines.toString()}
${rail.toString()}
${wing.toString()}
${deck.toString()}
${satellite.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".sc-stage");
  const g = stage.querySelector("[data-sc-sat]");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const ctrl = ${JSON.stringify(CTRL0)};
  const s = { th: ${PSI0}, w: 0 };
  let phi = 0, paused = false, frame = 0, last = 0, visible = false, idle = 0, touched = false;
  const TOUR = [60, -30, 90, 0, -60, 20];
  let tourAt = 0;
  function draw() {
    g.innerHTML = satellite(s.th, phi);
    const text = readoutOf(s, ctrl);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function settle() {
    // Reduced motion: jump straight to the end of the slew.
    s.th = (ctrl.target * Math.PI) / 180; s.w = 0; draw();
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (!paused) {
      stepAtt(s, ctrl, dt);
      phi += ((wheelRpm(s) * 2 * Math.PI) / 60 / 100) * dt;
      // Idle tour: a new target once the slew has settled for a while.
      const settled = Math.abs(s.th - (ctrl.target * Math.PI) / 180) < 0.004 && Math.abs(s.w) < 0.002;
      idle = settled ? idle + dt : 0;
      if (!touched && idle > 3) { tourAt = (tourAt + 1) % TOUR.length; ctrl.target = TOUR[tourAt]; idle = 0; }
    }
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (still.matches) { settle(); return; } if (!frame && visible && !paused) { last = 0; frame = requestAnimationFrame(tick); } };
  const command = (target) => {
    ctrl.target = Math.max(-180, Math.min(180, target));
    touched = true;
    say.textContent = "Slewing to " + ctrl.target + " degrees";
    if (still.matches) settle(); else run();
  };
  document.addEventListener("spc-attitude", (event) => {
    const d = event.detail;
    Object.assign(ctrl, { wn: d.wn, zeta: d.zeta, tmax: d.tmax });
    if (d.restart) { s.th = 0; s.w = 0; }
    command(d.target);
  });
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { command(ctrl.target + (event.key === "ArrowRight" ? 30 : -30)); event.preventDefault(); }
    else if (event.key === " ") { paused = !paused; run(); event.preventDefault(); }
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
const js = `// Generated by figures/${NAME}/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, `${NAME}.html`), fragment + "\n");
writeFileSync(join(OUT, `${NAME}.css`), css);
writeFileSync(join(OUT, `${NAME}.js`), js);
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CubeSat on an air bearing</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
// Model check: a 60° slew from rest settles, and the wheel's peak speed.
{
  const s = { th: 0, w: 0 }, c = { ...CTRL0, target: 60 };
  let peak = 0, t = 0;
  while (t < 40) { stepAtt(s, c, 0.05); t += 0.05; peak = Math.max(peak, Math.abs(wheelRpm(s))); }
  console.log(`60° slew: ${((s.th * 180) / Math.PI).toFixed(2)}° after 40 s, wheel peak ${peak.toFixed(0)} rpm · wrote ${NAME}.*`);
}
