// Fig · Guarded hot box. A wall specimen stands in a steel clamping frame on
// a test bench, between a heated box (left) and a chilled box (right) that
// run on two rails and are drawn pulled back, as they are when a specimen is
// mounted. Glass thermometers stand in the top of the specimen at every
// joint between layers, so their columns trace the temperature profile; a
// panel meter on the bench reads the heater power per square metre, which
// in steady state is the heat flux through the wall. The specimen and the
// readings come from the U-value block as "bldg-wall" events on document.
// Run from the repo root: node figures/building-hotbox/build.mjs
// Writes site/static/anatomy/building-hotbox.{html,css,js} and
// figures/building-hotbox/preview{,-light}.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });
const NAME = "building-hotbox";

// ---------------------------------------------------------------- model
// The default wall is the U-value block's first preset: a filled cavity
// wall, inside to outside. R per layer in m²K/W; temperatures in °C.
const WALL0 = {
  layers: [
    { name: "Gypsum plaster", mm: 13, r: 0.013 / 0.57, shade: 0.22 },
    { name: "Dense concrete block", mm: 100, r: 0.1 / 1.13, shade: 0.3 },
    { name: "Mineral wool", mm: 100, r: 0.1 / 0.035, shade: 0.06, soft: true },
    { name: "Brick", mm: 102.5, r: 0.1025 / 0.77, shade: 0.34 },
  ],
  ti: 20,
  te: 0,
};
const RSI = 0.13, RSE = 0.04;
function solve(w) {
  const R = RSI + w.layers.reduce((a, l) => a + l.r, 0) + RSE;
  const U = 1 / R, q = U * (w.ti - w.te);
  const temps = [w.ti - q * RSI];
  for (const l of w.layers) temps.push(temps[temps.length - 1] - q * l.r);
  return { ...w, U, q, temps };
}
const readoutOf = (s) => `U ${s.U.toFixed(2)} W/m²K · q ${s.q.toFixed(1)} W/m² · ${s.ti.toFixed(1)} → ${s.te.toFixed(1)} °C`;

// ---------------------------------------------------------------- layout (z up, viewer toward +x +y)
const WIDTH = 640, HEIGHT = 470;
const PLATE = { x: -104, y: -34, w: 208, d: 84, r: 6 };
const PLATE_H = 8, FOOT_H = 4;
const RAIL_Y = [-20, 20], RAIL = { x0: -98, x1: 98, w: 3, h: 3 };
const SPEC = { x0: -21, x1: 21, y0: -17, y1: 17, z0: 8, z1: 56 };
const SILL = { x: -32, y: -21, w: 57, d: 42, r: 0.6 };
const WARM = { x: -94, y: -28, w: 36, d: 56, r: 1.2 };
const COLD = { x: 58, y: -28, w: 36, d: 56, r: 1.2 };
const BOX_Z = [6, 60];
const STEM = 30, TMIN = -20, TMAX = 30;
const STEM_Z = SPEC.z1 + 1.4;
const levelOf = (t) => STEM_Z + (Math.max(TMIN, Math.min(TMAX, t)) - TMIN) / (TMAX - TMIN) * STEM;
const SCALE_POST = { x: -30.5, y: -1, w: 3, d: 2, r: 0.3 };
const METER = { x: -66, y: 31, w: 30, d: 15, r: 1.2 };
const METER_H = 9;
const DIAL = [-51, 38.5], DIAL_R = 5.6, DIAL_Z = METER_H, DIAL_H = 1.6;
const DIAL_TOP = DIAL_Z + DIAL_H;
const Q_FULL = 60; // W/m² at full scale (300° of the dial)
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [WARM.x, WARM.y, BOX_Z[1] + 16], [COLD.x + COLD.w, COLD.y, BOX_Z[1] + 14], [0, 0, STEM_Z + STEM + 3], [SCALE_POST.x, 0, STEM_Z + STEM + 4]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 52 },
);
const view = k.towardViewer(P);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

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
  // Ruler along the front edge, every 2 units, a major every 10.
  const strip = { x: 4, y: 43, w: 92, d: 4.5, r: 0.6 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.4, 0.8, [1.6, 3], P);
  out.push(`<path class="hb-tick" d="${ticks.minor}"/><path class="hb-tick hb-major" d="${ticks.major}"/>`);
  // Label plate with three engraving rules.
  const label = { x: -26, y: 33, w: 24, d: 13, r: 1 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 3, 0.3), { tone: "lo" }));
  const rules = [36.5, 39.5, 42.5].map((y, i) => k.lineOnTop([label.x + 3, y], [label.x + label.w - (i === 2 ? 9 : 3), y], 0.8, P)).join("");
  out.push(L(rules, { tone: "faint", free: true }));
  out.push(Dots(k.corners(label, 1.6).map(([x, y]) => at([x, y, 0.8])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
function rail(y) {
  const out = [];
  const plan = { x: RAIL.x0, y: y - RAIL.w / 2, w: RAIL.x1 - RAIL.x0, d: RAIL.w, r: 0.3 };
  out.push(S_(k.slabOf(plan, 0, RAIL.h, P, 2, 0.3), { tone: "mid" }));
  // Hold-down screws along the rail and an end stop at each end.
  const xs = [];
  for (let x = RAIL.x0 + 6; x < RAIL.x1 - 2; x += 16) xs.push(x);
  out.push(Dots(xs.map((x) => at([x, y, RAIL.h])), { size: 0.4, tone: "lo" }));
  for (const x of [RAIL.x0 - 1.5, RAIL.x1 - 1.5]) out.push(S_(k.slabOf({ x, y: y - 3, w: 3, d: 6, r: 0.4 }, 0, 5.5, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}
// A box on two carriages: shell, gasket frame on the face toward the
// specimen, top plate details passed in.
function carriages(box) {
  const out = [];
  for (const y of RAIL_Y) for (const x of [box.x + 5, box.x + box.w - 13]) {
    const c = { x, y: y - 3.5, w: 8, d: 7, r: 0.6 };
    out.push(S_(k.slabOf(c, RAIL.h - 1, BOX_Z[0] - RAIL.h + 1, P, 2, 0.3), { tone: "mid" }));
    out.push(Dots([at([x + 2, y + 3.5, BOX_Z[0] - 1.2]), at([x + 6, y + 3.5, BOX_Z[0] - 1.2])], { size: 0.35, tone: "lo" }));
  }
  return out.join("");
}
function boxShell(box, face) {
  const out = [];
  const z0 = BOX_Z[0], h = BOX_Z[1] - BOX_Z[0];
  const inner = [];
  inner.push(L(k.sideSeam(box, z0 + 4, P, 3), { tone: "faint" }));
  inner.push(L(k.sideSeam(box, BOX_Z[1] - 4, P, 3), { tone: "faint" }));
  out.push(S_(k.slabOf(box, z0, h, P, 3, 0.6), { tone: "mid", inner: inner.join("") }));
  // Gasket frame and opening on the face toward the specimen (+x for the
  // warm box, which faces the viewer; the cold box's is hidden).
  if (face === "+x") {
    const x = box.x + box.w;
    const rect = (m) => k.pathOf([[x, box.y + m, z0 + m], [x, box.y + box.d - m, z0 + m], [x, box.y + box.d - m, BOX_Z[1] - m], [x, box.y + m, BOX_Z[1] - m]].map(at), true);
    out.push(`<path class="hb-opening" d="${rect(7)}"/>`);
    out.push(L(rect(4), { tone: "lo" }));
    out.push(L(rect(7), { tone: "mid" }));
    out.push(Dots([[x, box.y + 5.5, z0 + 5.5], [x, box.y + box.d - 5.5, z0 + 5.5], [x, box.y + 5.5, BOX_Z[1] - 5.5], [x, box.y + box.d - 5.5, BOX_Z[1] - 5.5]].map(at), { size: 0.45, tone: "lo" }));
  }
  // Latches on the +y face.
  const fy = box.y + box.d;
  for (const z of [z0 + 12, BOX_Z[1] - 12]) {
    out.push(S_(k.slabOf({ x: box.x + box.w - 7, y: fy, w: 4, d: 1.2, r: 0.2 }, z - 2, 4, P, 2), { tone: "mid" }));
  }
  // Handle on the +y face.
  out.push(S_(k.slabOf({ x: box.x + 8, y: fy, w: 2, d: 3, r: 0.3 }, 30, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: box.x + 18, y: fy, w: 2, d: 3, r: 0.3 }, 30, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: box.x + 7, y: fy + 2, w: 14, d: 1.6, r: 0.4 }, 29.8, 2.4, P, 2), { tone: "hi" }));
  return out.join("");
}
// Warm box: a fan housing and a cable gland on the lid.
function warmTop() {
  const out = [];
  const [cx, cy] = [WARM.x + 14, WARM.y + 26];
  out.push(S_(k.cylinder(cx, cy, 9, BOX_Z[1], 2.2, P, 40, 0.4), { tone: "mid" }));
  out.push(S_(k.cylinder(cx, cy, 7.4, BOX_Z[1] + 2.2, 4, P, 40, 0.3), { tone: "mid", inner: L(k.knurl(cx, cy, 7.4, BOX_Z[1] + 2.2, BOX_Z[1] + 6.2, 36, P, 0.6), { tone: "faint" }) }));
  out.push(L([1.6, 3.4, 5.2].map((r) => k.ring(cx, cy, r, BOX_Z[1] + 6.2, P, 28)).join(""), { tone: "lo" }));
  out.push(Dots([at([cx, cy, BOX_Z[1] + 6.2])], { size: 0.7, tone: "mid" }));
  out.push(Dots([0, 1, 2, 3].map((q) => (q * Math.PI) / 2 + 0.6).map((a) => at([cx + 8.2 * Math.cos(a), cy + 8.2 * Math.sin(a), BOX_Z[1] + 2.2])), { size: 0.4, tone: "lo" }));
  // Cable gland the power lead enters through.
  out.push(S_(k.cylinder(WARM.x + 29, WARM.y + 48, 2.2, BOX_Z[1], 2.6, P, 18), { tone: "mid" }));
  out.push(S_(k.cylinder(WARM.x + 29, WARM.y + 48, 1.4, BOX_Z[1] + 2.6, 1.2, P, 14), { tone: "mid" }));
  return out.join("");
}
// Cold box: a finned chiller on the lid with a fan disc.
function coldTop() {
  const out = [];
  const fins = { x: COLD.x + 6, y: COLD.y + 8, w: 24, d: 30, r: 0.8 };
  out.push(S_(k.slabOf(fins, BOX_Z[1], 2, P, 3, 0.3), { tone: "mid" }));
  const ribs = [];
  for (let y = fins.y + 3; y <= fins.y + fins.d - 3; y += 3) ribs.push({ x: fins.x + 2, y: y - 0.5, w: fins.w - 4, d: 1, r: 0.1 });
  ribs.sort((a, b) => a.y - b.y);
  for (const r of ribs) out.push(S_(k.slabOf(r, BOX_Z[1] + 2, 6, P, 2), { tone: "hi", crease: "none" }));
  const [cx, cy] = [COLD.x + 18, COLD.y + 46];
  out.push(S_(k.cylinder(cx, cy, 6, BOX_Z[1], 3, P, 36, 0.3), { tone: "mid" }));
  out.push(L([2, 4].map((r) => k.ring(cx, cy, r, BOX_Z[1] + 3, P, 24)).join(""), { tone: "lo" }));
  out.push(Dots([at([cx, cy, BOX_Z[1] + 3])], { size: 0.6, tone: "mid" }));
  return out.join("");
}
function sill() {
  const out = [];
  out.push(S_(k.slabOf(SILL, RAIL.h, SPEC.z0 - RAIL.h, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(SILL, RAIL.h + 2.5, P, 2), { tone: "faint" }) }));
  out.push(Dots([[SILL.x + 3, SILL.y + SILL.d, RAIL.h + 1.2], [SILL.x + SILL.w - 3, SILL.y + SILL.d, RAIL.h + 1.2]].map(at), { size: 0.4, tone: "lo" }));
  return out.join("");
}
// Clamping angles at the specimen's vertical edges: one leaf along the
// face, one along the side, with clamp screws through the face leaf.
function angle(xEdge, yEdge) {
  const out = [];
  const sx = xEdge < 0 ? -1 : 1, sy = yEdge < 0 ? -1 : 1;
  const faceLeaf = { x: sx < 0 ? xEdge - 1.6 : xEdge - 3.4, y: sy < 0 ? yEdge - 1.6 : yEdge, w: 5, d: 1.6, r: 0.2 };
  const sideLeaf = { x: sx < 0 ? xEdge - 1.6 : xEdge, y: sy < 0 ? yEdge - 1.6 : yEdge - 3.4, w: 1.6, d: 5, r: 0.2 };
  const leaves = [faceLeaf, sideLeaf].sort((a, b) => k.depthOf([a.x + a.w / 2, a.y + a.d / 2, 0], P) - k.depthOf([b.x + b.w / 2, b.y + b.d / 2, 0], P));
  for (const leaf of leaves) out.push(S_(k.slabOf(leaf, SPEC.z0, SPEC.z1 - SPEC.z0 + 1.2, P, 2), { tone: "mid" }));
  if (sy > 0) {
    const fy = yEdge + 1.6, xs = faceLeaf.x + 2.5;
    out.push(Dots([8, 20, 32, 44].map((z) => at([xs, fy, SPEC.z0 + z])), { size: 0.42, tone: "lo" }));
  }
  return out.join("");
}
// A graduated post: every 5 °C from −20 to 30, a major tick every 10.
function scalePost() {
  const out = [];
  out.push(S_(k.slabOf(SCALE_POST, SPEC.z0, STEM_Z + STEM + 2 - SPEC.z0, P, 2, 0.2), { tone: "mid" }));
  const face = SCALE_POST.y + SCALE_POST.d;
  const minor = [], major = [], zero = [];
  for (let t = TMIN; t <= TMAX; t += 5) {
    const z = levelOf(t);
    const big = t % 10 === 0;
    (t === 0 ? zero : big ? major : minor).push(k.segment([SCALE_POST.x + SCALE_POST.w, face, z], [SCALE_POST.x + SCALE_POST.w - (big ? 2.4 : 1.4), face, z], P));
  }
  out.push(`<path class="hb-tick" d="${minor.join("")}"/><path class="hb-tick hb-major" d="${major.join("")}"/><path class="hb-tick hb-zero" d="${zero.join("")}"/>`);
  out.push(S_(k.slabOf({ x: SCALE_POST.x - 0.6, y: SCALE_POST.y - 0.6, w: SCALE_POST.w + 1.2, d: SCALE_POST.d + 1.2, r: 0.3 }, STEM_Z + STEM + 2, 1, P, 2), { tone: "mid" }));
  return out.join("");
}
function meter() {
  const out = [];
  out.push(S_(k.slabOf(METER, 0, METER_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(METER, 2.4, P, 3), { tone: "faint" }) }));
  const [x, y] = DIAL;
  out.push(S_(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 56, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, DIAL_R - 1, DIAL_TOP, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 1.4, 30, 5, DIAL_TOP, [0.8, 1.6], P, -Math.PI * 5 / 6, Math.PI * 5 / 3);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 0.9, DIAL_TOP, P, 14), { tone: "mid" }));
  // Two terminals and a range switch on the meter top.
  for (const [tx, ty] of [[METER.x + 6, METER.y + 4.5], [METER.x + 6, METER.y + 10.5]]) {
    out.push(S_(k.cylinder(tx, ty, 1.5, METER_H, 2, P, 16), { tone: "mid" }));
    out.push(Dots([at([tx, ty, METER_H + 2])], { size: 0.5, tone: "lo" }));
  }
  out.push(S_(k.cylinder(METER.x + 26, METER.y + 4, 1.8, METER_H, 1.6, P, 18), { tone: "mid", inner: L(k.knurl(METER.x + 26, METER.y + 4, 1.8, METER_H, METER_H + 1.6, 16, P, 0.3), { tone: "faint" }) }));
  out.push(Dots([[METER.x + 1.6, METER.y + 1.6], [METER.x + METER.w - 1.6, METER.y + 1.6], [METER.x + 1.6, METER.y + METER.d - 1.6], [METER.x + METER.w - 1.6, METER.y + METER.d - 1.6]].map(([a, b]) => at([a, b, METER_H])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
// Full scale is 300°, starting at the lower left.
const needleAt = (q) => {
  const f = Math.max(0, Math.min(1, q / Q_FULL));
  const angle = -Math.PI * 5 / 6 + f * Math.PI * 5 / 3;
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 1.2, y + Math.cos(angle) * 1.2], [x + Math.sin(angle) * (DIAL_R - 1.6), y - Math.cos(angle) * (DIAL_R - 1.6)], DIAL_TOP + 0.2, P);
};
// A socket low on the warm box's front face, and the heater lead from the
// meter's back terminal to it, lying on the bench.
const SOCKET = [WARM.x + 30, WARM.y + WARM.d, 13];
function socket() {
  const [x, y, z] = SOCKET;
  return S_(k.slabOf({ x: x - 2.5, y, w: 5, d: 1.2, r: 0.3 }, z - 2.5, 5, P, 2), { tone: "mid", inner: Dots([at([x, y + 1.2, z])], { size: 0.6, tone: "lo" }) });
}
function lead() {
  const from = at([METER.x + 6, METER.y + 4.5, METER_H + 2]);
  const to = at([SOCKET[0], SOCKET[1] + 1.2, SOCKET[2]]);
  const via = [at([METER.x + 6, METER.y + 1, METER_H + 3]), at([METER.x + 10, SOCKET[1] + 1.5, 0.6]), at([SOCKET[0], SOCKET[1] + 2.2, 4])];
  return k.wireSvg(from, to, { via, tone: "lo", ends: "both", size: 0.7 });
}

// ---------------------------------------------------------------- moving parts
// Layer widths follow the thickness, with a floor so films show.
function spans(layers) {
  const total = layers.reduce((a, l) => a + l.mm, 0);
  const W = SPEC.x1 - SPEC.x0;
  const raw = layers.map((l) => Math.max(1.4, (l.mm / total) * W));
  const k2 = W / raw.reduce((a, b) => a + b, 0);
  const xs = [SPEC.x0];
  for (const w of raw) xs.push(xs[xs.length - 1] + w * k2);
  return xs;
}
function specimen(w) {
  const xs = spans(w.layers);
  const out = [];
  const order = w.layers.map((l, i) => i).sort((a, b) => k.depthOf([(xs[a] + xs[a + 1]) / 2, 0, 0], P) - k.depthOf([(xs[b] + xs[b + 1]) / 2, 0, 0], P));
  for (const i of order) {
    const l = w.layers[i];
    const x0 = xs[i], x1 = xs[i + 1];
    const plan = { x: x0, y: SPEC.y0, w: x1 - x0, d: SPEC.y1 - SPEC.y0, r: 0.1 };
    const tone = l.film ? "hb-film" : l.soft ? "hb-soft" : l.shade > 0.29 ? "hb-heavy" : "hb-board";
    const fy = SPEC.y1, inner = [];
    const zline = (z) => k.segment([x0, fy, z], [x1, fy, z], P);
    if (l.soft) {
      // Wool: a zigzag of fibres across the face, end to end.
      const pts = [];
      for (let z = SPEC.z0 + 2, j = 0; z <= SPEC.z1 - 2; z += 2.2, j++) pts.push(at([j % 2 ? x1 : x0, fy, z]));
      if (x1 - x0 > 2.5) inner.push(L(k.pathOf(pts), { tone: "faint" }));
    } else if (/brick/i.test(l.name)) {
      // Brick courses every 6.5 units, perpends staggered.
      const lines = [];
      for (let z = SPEC.z0 + 6.5, c = 0; z < SPEC.z1; z += 6.5, c++) {
        lines.push(zline(z));
        const xp = c % 2 ? x0 + (x1 - x0) * 0.5 : x0 + (x1 - x0) * 0.2;
        if (x1 - x0 > 3) lines.push(k.segment([xp, fy, z], [xp, fy, Math.min(SPEC.z1, z + 6.5)], P));
      }
      inner.push(L(lines.join(""), { tone: "lo" }));
    } else if (/block|concrete|aerated/i.test(l.name)) {
      inner.push(L([SPEC.z0 + 21.5, SPEC.z0 + 43].map(zline).join(""), { tone: "lo" }));
    }
    out.push(`<g class="${tone}">${S_(k.slabOf(plan, SPEC.z0, SPEC.z1 - SPEC.z0, P, 2), { tone: "mid", crease: "none", inner: inner.join("") })}</g>`);
  }
  return out.join("");
}
// Thermometers at each surface and joint, alternating front and back so
// close joints do not collide; the column is the lit part.
function thermometers(w, shown) {
  const xs = spans(w.layers);
  const items = xs.map((x, i) => ({ x, y: i % 2 ? -6 : 6, t: shown[i] }));
  items.sort((a, b) => k.depthOf([a.x, a.y, 0], P) - k.depthOf([b.x, b.y, 0], P));
  const out = [];
  for (const it of items) {
    out.push(S_(k.cylinder(it.x, it.y, 1.9, SPEC.z1, 1.4, P, 18, 0.2), { tone: "mid" }));
    const lv = levelOf(it.t);
    out.push(S_(k.cylinder(it.x, it.y, 0.85, STEM_Z, lv - STEM_Z, P, 14), { tone: "hi", crease: "none", lit: true }));
    out.push(`<g class="hb-glass">${S_(k.cylinder(it.x, it.y, 1.25, lv, STEM_Z + STEM - lv, P, 16), { tone: "lo", crease: "none" })}</g>`);
    out.push(S_(k.cylinder(it.x, it.y, 1.4, STEM_Z + STEM, 1, P, 16), { tone: "mid" }));
  }
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const S0 = solve(WALL0);
const LABEL =
  "A guarded hot box on a test bench. A slice of wall stands in a steel clamping frame between two insulated boxes on rails, both pulled back: a heated box on the left with a fan on its lid and a gasketed opening facing the wall, and a chilled box on the right with a finned cooler on top. Glass thermometers stand in the top edge of the wall at every joint between its layers; their red columns step down from the warm side to the cold side, falling most across the insulation. A graduated post beside the wall reads the columns, and a panel meter on the bench, wired to the heater, reads the heat flow per square metre.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    rail(RAIL_Y[0]),
    rail(RAIL_Y[1]),
    carriages(WARM),
    boxShell(WARM, "+x"),
    socket(),
    warmTop(),
    sill(),
    scalePost(),
    angle(SPEC.x0, SPEC.y0),
    angle(SPEC.x1, SPEC.y0),
    `<g data-hb-spec>${specimen(S0)}</g>`,
    angle(SPEC.x0, SPEC.y1),
    angle(SPEC.x1, SPEC.y1),
    `<g data-hb-therm>${thermometers(S0, S0.temps)}</g>`,
    carriages(COLD),
    boxShell(COLD, "-x"),
    coldTop(),
    meter(),
    `<path data-hb-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(S0.q)}" style="stroke-width:1"/>`,
    lead(),
  ],
});
const stage = `<div class="iso-stage hb-stage" role="group" aria-roledescription="hot box" aria-label="Guarded hot box with the wall from the U-value block">${svg}<span class="hb-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Guarded hot box",
  hint: "edit the wall below",
  readout: readoutOf(S0),
  keys: [
    { mark: "lit", label: "Thermometer columns: −20 to 30 °C over the stem" },
    { mark: "raised", label: "Specimen layers, drawn in proportion" },
  ],
  caption: "In a real test (ISO 8990) the boxes close on the specimen and a guard ring around the metering box stops heat leaking sideways; the heater power that keeps the warm side steady, divided by the area, is the heat flux. Each column reads the temperature at its joint, so the step between two neighbours is the drop across one layer.",
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
.iso${R_} .hb-stage{position:relative}
.iso${R_} .hb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .hb-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.6;stroke-linecap:round}
.iso${R_} .hb-major{stroke:var(--anatomy-mid)}
.iso${R_} .hb-zero{stroke:var(--anatomy-hi);stroke-width:.8}
.iso${R_} .hb-opening{fill:color-mix(in oklab,var(--anatomy-paper) 70%,#000)}
.iso${R_} .hb-soft .iso-fill,.iso${R_} .hb-soft .iso-shade{fill:color-mix(in oklab,var(--anatomy-mid) 22%,var(--anatomy-paper))}
.iso${R_} .hb-soft .iso-top{fill:color-mix(in oklab,var(--anatomy-mid) 30%,var(--anatomy-paper))}
.iso${R_} .hb-heavy .iso-fill,.iso${R_} .hb-heavy .iso-shade{fill:color-mix(in oklab,var(--anatomy-paper) 88%,#000)}
.iso${R_} .hb-film .iso-fill,.iso${R_} .hb-film .iso-top,.iso${R_} .hb-film .iso-shade{fill:var(--anatomy-hi)}
.iso${R_} .hb-glass .iso-fill,.iso${R_} .hb-glass .iso-top,.iso${R_} .hb-glass .iso-shade{fill:color-mix(in oklab,var(--anatomy-blue) 10%,var(--anatomy-paper))}
.iso${R_} .iso-solid[data-lit]>.iso-fill,.iso${R_} .iso-solid[data-lit]>.iso-top,.iso${R_} .iso-solid[data-lit]>.iso-shade{fill:var(--brand,#db2777)}
.iso${R_} .iso-solid[data-lit]>.iso-edge{stroke:color-mix(in oklab,var(--brand,#db2777) 70%,var(--anatomy-lit))}
.iso${R_} [data-hb-needle]{stroke:var(--brand,#db2777)}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:9.5px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const liveSrc = `
const P = ${JSON.stringify(P)};
const SPEC = ${JSON.stringify(SPEC)};
const STEM = ${STEM}, TMIN = ${TMIN}, TMAX = ${TMAX}, STEM_Z = ${STEM_Z};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP}, Q_FULL = ${Q_FULL};
const k = { iso, pathOf, slabOf, cylinder, segment, lineOnTop, depthOf };
const at = (p) => iso(p, P);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const levelOf = ${levelOf.toString()};
const readoutOf = ${readoutOf.toString()};
${spans.toString()}
${specimen.toString()}
${thermometers.toString()}
const needleAt = ${needleAt.toString()};

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const svg = root.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const g = { spec: svg.querySelector("[data-hb-spec]"), therm: svg.querySelector("[data-hb-therm]"), needle: svg.querySelector("[data-hb-needle]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let wall = ${JSON.stringify(S0)};
  let shown = wall.temps.slice(), shownQ = wall.q, frame = 0, last = 0, visible = false, key = "";
  function draw() {
    g.therm.innerHTML = thermometers(wall, shown);
    g.needle.setAttribute("d", needleAt(shownQ));
  }
  function settle(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const a = 1 - Math.exp(-dt * 7);
    let moving = Math.abs(wall.q - shownQ) > 0.01;
    shownQ += (wall.q - shownQ) * a;
    shown = shown.map((t, i) => { const d = wall.temps[i] - t; if (Math.abs(d) > 0.02) moving = true; return t + d * a; });
    draw();
    frame = moving && visible ? requestAnimationFrame(settle) : 0;
    if (!moving) { shown = wall.temps.slice(); shownQ = wall.q; draw(); }
  }
  document.addEventListener("bldg-wall", (event) => {
    const d = event.detail;
    const temps = [d.temps[1], ...d.temps.slice(2, -1)];
    const next = { layers: d.layers, ti: d.ti, te: d.te, U: d.U, q: d.q, temps };
    const sig = next.layers.map((l) => l.name + l.mm).join("|");
    const rebuilt = sig !== key || shown.length !== temps.length;
    wall = next;
    if (rebuilt) { key = sig; g.spec.innerHTML = specimen(wall); shown = temps.slice(); }
    readout.textContent = readoutOf(wall);
    say.textContent = readoutOf(wall);
    if (still.matches || !visible || rebuilt) { shown = temps.slice(); shownQ = wall.q; draw(); }
    else if (!frame) { last = 0; frame = requestAnimationFrame(settle); }
  });
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; }, { rootMargin: "120px 0px" }).observe(svg);
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
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Guarded hot box</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`view ${view.map((v) => v.toFixed(2))} · U ${S0.U.toFixed(3)} · q ${S0.q.toFixed(2)} · wrote ${NAME}.*`);
