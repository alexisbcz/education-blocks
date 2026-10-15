// Fig 1 · y = Ax — a bench "dot-product mill".
// Run from the repo root: node figures/matvec/build.mjs
// Writes site/static/anatomy/{matvec.html, iso.css, matvec.js} and figures/matvec/preview{,-light}.html.
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
// One pure model: A is fixed, x moves, y = A·x. Every part position below is a function of x.
const A = [
  [2, 1],
  [1, 3],
];
const S = 10; // world units per unit of x or y (input racks, feed bars and output rods share it)
const R0 = 5; // pitch radius of every small (input) gear; N0 teeth
const N0 = 10;
const X0 = [1, 0.5]; // rest pose shown before the script runs
const LIMIT = 1; // |x_j| ≤ 1
const yOf = (x) => A.map((row) => row[0] * x[0] + row[1] * x[1]);

// ---------------------------------------------------------------- layout (world units, z up)
const WIDTH = 600;
const HEIGHT = 330;
const PLATE = { x: -128, y: -56, w: 303, d: 138, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;
const COL = [-80, -20]; // shaft x of column 1 and 2
const ROW = [-26, 24]; // shaft y of row 1 and 2
const SMALL_Z = 2; // small gears z 2..6, meshing with the input racks
const GEAR_H = 4;
const BIG_Z = [16, 10]; // big gear (and feed bar) level per column
const RACK = { y0: -44, y1: 58, z: 2, h: 4, w: 4.5 }; // input rack, built at x_j = 0
const TAB_Y = 60; // input index line at x_j = 0
const BOX = { x: 20, w: 30, z: 0, h: 24 }; // summing housings span x 20..50
const BOSS = 2.5; // flange on the housing's output face
const ZX = 110; // output zero on the output rulers
const ROD_Z = 13;
const ROD_T = 4;
const R_OF = (i, j) => A[i][j] * R0; // big gear pitch radius = a_ij · R0  (so feed = a_ij · rack travel)
const barY = (i, j) => ROW[i] - R_OF(i, j) - BAR_W; // feed bar (i,j) runs behind its gear; its toothed edge is y = row - R
const BAR_W = 3;
const rodY = (i) => (Math.min(barY(i, 0), barY(i, 1)) + Math.max(barY(i, 0), barY(i, 1)) + BAR_W) / 2;
const boxPlan = (i) => {
  const lo = Math.min(barY(i, 0), barY(i, 1)) - 4;
  const hi = Math.max(barY(i, 0), barY(i, 1)) + BAR_W + 4;
  return { x: BOX.x, y: lo, w: BOX.w, d: hi - lo, r: 2 };
};

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COL[0], ROW[0], 22], [COL[0] - 7, 75, 13], [PLATE.x + PLATE.w, PLATE.y, 26]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);

const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---------------------------------------------------------------- gears (shared with the page: serialised below)
function gearRing(cx, cy, radius, teeth, angle) {
  const pitch = (Math.PI * 2) / teeth;
  const tip = radius + 0.8;
  const root = radius - 0.9;
  const out = [];
  for (let t = 0; t < teeth; t++) {
    const a = angle + t * pitch;
    for (const [r, f] of [[root, -0.32], [tip, -0.14], [tip, 0.14], [root, 0.32], [root, 0.5]]) {
      out.push([cx + r * Math.cos(a + f * pitch), cy + r * Math.sin(a + f * pitch)]);
    }
  }
  return out;
}
function gearArt(kit, P, g, angle) {
  // g: { cx, cy, r, n, z, big }. Body is a turned blank at tip radius; the teeth are cut into it:
  // the tooth profile engraved on the top face and one flank line per tooth edge down the visible side.
  const tip = g.r + 0.8;
  const top = g.z + 4;
  const paths = kit.cylinder(g.cx, g.cy, tip, g.z, 4, P, 48, 0.3);
  const view = kit.towardViewer(P);
  const pitch = (Math.PI * 2) / g.n;
  const flanks = [];
  for (let t = 0; t < g.n; t++) {
    for (const f of [-0.14, 0.14]) {
      const a = angle + t * pitch + f * pitch;
      const nx = Math.cos(a), ny = Math.sin(a);
      if (nx * view[0] + ny * view[1] < 0.2) continue;
      flanks.push(kit.segment([g.cx + tip * nx, g.cy + tip * ny, g.z + 0.3], [g.cx + tip * nx, g.cy + tip * ny, top], P));
    }
  }
  const profile = kit.onTop(gearRing(g.cx, g.cy, g.r, g.n, angle), top, P, true);
  let inner = kit.lineSvg(flanks.join(""), { tone: "lo" }) + kit.lineSvg(profile, { tone: "mid" });
  if (g.big) {
    const groove = g.r - 2.6;
    const lines = [kit.ring(g.cx, g.cy, groove, top, P, 48)];
    if (g.r >= 10) {
      const hole = (groove + 2.6) / 2;
      for (let q = 0; q < 4; q++) {
        const a = angle + Math.PI / 4 + (q * Math.PI) / 2;
        lines.push(kit.ring(g.cx + hole * Math.cos(a), g.cy + hole * Math.sin(a), g.r >= 15 ? 2.8 : 1.5, top, P, 18));
      }
    }
    inner +=
      kit.lineSvg(lines.join(""), { tone: "lo" }) +
      kit.lineSvg(kit.lineOnTop([g.cx + 2.6 * Math.cos(angle), g.cy + 2.6 * Math.sin(angle)], [g.cx + groove * Math.cos(angle), g.cy + groove * Math.sin(angle)], top, P), { tone: "hi" });
  }
  return kit.solidSvg(paths, { tone: "hi", crease: "lo", inner });
}
const GEARS = [];
for (let i = 0; i < 2; i++)
  for (let j = 0; j < 2; j++) {
    GEARS.push({ id: `s${i}${j}`, col: j, cx: COL[j], cy: ROW[i], r: R0, n: N0, z: SMALL_Z, big: false });
    GEARS.push({ id: `b${i}${j}`, col: j, cx: COL[j], cy: ROW[i], r: R_OF(i, j), n: N0 * A[i][j], z: BIG_Z[j], big: true });
  }
const angleOf = (xj) => (xj * S) / R0; // the rack sits on the +x side: +y travel turns the shaft counter-clockwise seen from above
const gearOf = (id) => GEARS.find((g) => g.id === id);
const gearGroup = (id, x) => {
  const g = gearOf(id);
  return `<g data-gear="${id}">${gearArt(k, P, g, angleOf(x[g.col]))}</g>`;
};

// ---------------------------------------------------------------- static parts
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S_(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate, front right
  const label = { x: 2, y: 56, w: 44, d: 15, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[0, 26], [0, 18], [0, 30]].map(([, len], n) => k.lineOnTop([label.x + 5, label.y + 4.4 + n * 3.2], [label.x + 5 + len, label.y + 4.4 + n * 3.2], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

function ruler(strip, axis, zero, step, every, edge, z = 0.6) {
  const out = [S_(k.slabOf(strip, 0, z, P, 3), { tone: "lo", crease: "none" })];
  const from = axis === "x" ? strip.x + 3 : strip.y + 3;
  const to = axis === "x" ? strip.x + strip.w - 3 : strip.y + strip.d - 3;
  const t = k.topTicks(from, to, step, every, edge.at, z, edge.len, P, axis);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const zeroTick = axis === "x" ? k.lineOnTop([zero, edge.at], [zero, edge.at + edge.len[1] * 1.35], z, P) : k.lineOnTop([edge.at, zero], [edge.at + edge.len[1] * 1.35, zero], z, P);
  out.push(L(zeroTick, { tone: "hi" }));
  const ends = axis === "x" ? [[strip.x + 1.6, strip.y + strip.d / 2], [strip.x + strip.w - 1.6, strip.y + strip.d / 2]] : [[strip.x + strip.w / 2, strip.y + 1.6], [strip.x + strip.w / 2, strip.y + strip.d - 1.6]];
  out.push(D(ends.map(([x, y]) => at([x, y, z])), { size: 0.4 }));
  return out.join("");
}

function inputBeds() {
  const out = [];
  for (const cx of COL) {
    // channel the rack slides in, with end screws
    const ch = { x: cx + 5.5 - 1.8, y: RACK.y0 - 4, w: RACK.w + 3.6, d: RACK.y1 - RACK.y0 + 8, r: 1 };
    out.push(S_(k.slabOf(ch, 0, 2, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([ch.x + ch.w / 2, ch.y + 1.6, 2]), at([ch.x + ch.w / 2, ch.y + ch.d - 1.6, 2])], { size: 0.4, tone: "lo" }));
    // input ruler along y, right of the rack
    const strip = { x: cx - 4, y: 45, w: 7, d: 30, r: 1 };
    out.push(ruler(strip, "y", TAB_Y, 1, 5, { at: strip.x + strip.w - 0.2, len: [-1.8, -3.4] }));
  }
  return out.join("");
}

function rack(j) {
  const cx = COL[j];
  const x0 = cx + 5.5;
  const out = [];
  const plan = { x: x0, y: RACK.y0, w: RACK.w, d: RACK.y1 - RACK.y0, r: 0.8 };
  const top = RACK.z + RACK.h;
  const teeth = k.topTicks(RACK.y0 + 2, RACK.y1 - 2, (Math.PI * 2 * R0) / N0, 1000, x0, top, [1.6, 1.6], P, "y");
  out.push(S_(k.slabOf(plan, RACK.z, RACK.h, P, 3, 0.4), { tone: "mid", inner: L(teeth.minor + teeth.major, { tone: "lo" }) }));
  // index tab with a pull knob, reaching over the input ruler
  const tab = { x: cx - 5, y: TAB_Y - 4, w: x0 + RACK.w + 1 - (cx - 5), d: 8, r: 1.2 };
  out.push(S_(k.slabOf(tab, top, 1.4, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.lineOnTop([tab.x, TAB_Y], [x0 + 2.2, TAB_Y], top + 1.4, P), { tone: "hi" }));
  const knob = [x0 + 2.2, TAB_Y];
  out.push(S_(k.cylinder(knob[0], knob[1], 1.6, top + 1.4, 2, P, 16), { tone: "mid", crease: "none" }));
  out.push(S_(k.cylinder(knob[0], knob[1], 3.4, top + 3.4, 4, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 3.4, top + 3.4, top + 7.4, 26, P), { tone: "lo" }));
  out.push(D([at([knob[0], knob[1], top + 7.4])], { size: 0.5, tone: "hi" }));
  out.push(D([at([x0 + RACK.w - 0.6, TAB_Y - 2.6, top + 1.4]), at([x0 + RACK.w - 0.6, TAB_Y + 2.6, top + 1.4])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

function shaft(i, j, x) {
  // pedestal, small gear, shaft, collar, big gear, hub cap
  const cx = COL[j];
  const cy = ROW[i];
  const out = [];
  out.push(S_(k.cylinder(cx, cy, 3.6, 0, SMALL_Z, P, 24, 0.3), { tone: "mid" }));
  out.push(gearGroup(`s${i}${j}`, x));
  out.push(S_(k.cylinder(cx, cy, 1.5, SMALL_Z + GEAR_H, BIG_Z[j] - SMALL_Z - GEAR_H - 1.6, P, 16), { tone: "mid", crease: "none" }));
  out.push(S_(k.cylinder(cx, cy, 2.6, BIG_Z[j] - 1.6, 1.6, P, 20), { tone: "mid" }));
  out.push(gearGroup(`b${i}${j}`, x));
  out.push(S_(k.cylinder(cx, cy, 2.6, BIG_Z[j] + GEAR_H, 1.4, P, 20, 0.3), { tone: "mid" }));
  out.push(D([at([cx, cy, BIG_Z[j] + GEAR_H + 1.4])], { size: 0.55, tone: "hi" }));
  return out.join("");
}

// static clip regions (world boxes projected); moving parts slide inside them
const clipBox = (x0, x1, y0, y1, z0, z1) => k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0 }, z0, z1 - z0, P, 1).fill;

function feedBar(i, j, dx = 0) {
  const cx = COL[j];
  const r = R_OF(i, j);
  const y0 = barY(i, j);
  const travel = A[i][j] * S * LIMIT;
  const left = cx - r - 4 - travel;
  const plan = { x: left, y: y0, w: BOX.x + 40 - left, d: BAR_W, r: 0.6 };
  const z = BIG_Z[j];
  const teeth = k.topTicks(left + 2, BOX.x + 38, (Math.PI * 2 * R0) / N0, 1000, y0 + BAR_W, z + GEAR_H, [-1.4, -1.4], P, "x");
  const body = S_(k.slabOf(plan, z, GEAR_H, P, 3, 0.4), { tone: "mid", inner: L(teeth.minor, { tone: "lo" }) });
  const cap = S_(k.slabOf({ x: left - 1.2, y: y0 - 0.6, w: 2.4, d: BAR_W + 1.2, r: 0.6 }, z - 0.4, GEAR_H + 0.8, P, 3), { tone: "mid" });
  const id = `mv-bar-${i}${j}`;
  return `<clipPath id="${id}"><path d="${clipBox(-400, BOX.x + 0.2, y0 - 3, y0 + BAR_W + 3, z - 2, z + GEAR_H + 2)}"/></clipPath><g clip-path="url(#${id})"><g data-bar="${i}${j}" transform="${k.translateAlong(P, [dx, 0, 0])}">${body}${cap}</g></g>`;
}

function support(i, j) {
  // a steady post the feed bar slides over, always under the bar whatever its travel
  const sx = j === 0 ? -48 : 6;
  const y0 = barY(i, j);
  const z = BIG_Z[j];
  const out = [];
  out.push(S_(k.cylinder(sx, y0 + BAR_W / 2, 4, 0, 1.4, P, 24, 0.3), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: sx - 2, y: y0 - 0.5, w: 4, d: BAR_W + 1, r: 0.6 }, 1.4, z - 2.6, P, 3, 0.3), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: sx - 3, y: y0 - 1.6, w: 6, d: BAR_W + 3.2, r: 0.8 }, z - 1.2, 1.2, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}

function housing(i) {
  const plan = boxPlan(i);
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, 0, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S_(k.slabOf(plan, BOX.z, BOX.h, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 19, P, 4), { tone: "faint" }) }));
  const lid = k.insetPlan(plan, 2.5);
  out.push(S_(k.slabOf(lid, BOX.h, 1.2, P, 4, 0.4), { tone: "mid" }));
  out.push(D(k.corners(lid, 2.2).map(([x, y]) => at([x, y, BOX.h + 1.2])), { size: 0.5 }));
  // a sight window on the lid: a closed slot
  out.push(L(k.planOutline({ x: lid.x + 6, y: lid.y + lid.d / 2 - 1.6, w: lid.w - 12, d: 3.2, r: 1.6 }, BOX.h + 1.2, P, 4), { tone: "lo" }));
  // output flange on the near (+x) face
  const y = rodY(i);
  const flange = { x: BOX.x + BOX.w, y: y - 5, w: BOSS, d: 10, r: 0.8 };
  out.push(S_(k.slabOf(flange, ROD_Z - 3, ROD_T + 6, P, 3, 0.3), { tone: "mid" }));
  out.push(D([at([flange.x + BOSS, y - 3.6, ROD_Z + ROD_T + 2]), at([flange.x + BOSS, y + 3.6, ROD_Z - 2])], { size: 0.4 }));
  return out.join("");
}

function outputBed(i) {
  const y = rodY(i);
  const out = [];
  for (const dy of [-5.5, 2.5]) {
    out.push(S_(k.slabOf({ x: 58, y: y + dy, w: 104, d: 3, r: 0.8 }, 0, 2.4, P, 3, 0.3), { tone: "mid" }));
  }
  for (const x of [55, 162]) {
    out.push(S_(k.slabOf({ x, y: y - 7, w: 3, d: 14, r: 0.8 }, 0, 5, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x + 1.5, y - 4, 5]), at([x + 1.5, y + 4, 5])], { size: 0.4 }));
  }
  const strip = { x: 62, y: y + 9.5, w: 96, d: 7, r: 1 };
  out.push(ruler(strip, "x", ZX, 2.5, 4, { at: strip.y + 0.2, len: [1.8, 3.4] }));
  return out.join("");
}

function outputSlide(i) {
  // built at y_i = 0 (carriage at ZX); moved with translateAlong
  const y = rodY(i);
  const out = [];
  const car = { x: ZX - 7, y: y - 7, w: 14, d: 14, r: 1.6 };
  out.push(S_(k.slabOf(car, 2.4, 3.6, P, 4, 0.5), { tone: "mid" }));
  out.push(D(k.corners(car, 1.8).map(([x, yy]) => at([x, yy, 6])), { size: 0.4, tone: "lo" }));
  out.push(S_(k.slabOf({ x: ZX - 1.5, y: y + 6.6, w: 3, d: 9.4, r: 0.6 }, 4.8, 1.2, P, 3), { tone: "hi", lit: true }));
  out.push(L(k.lineOnTop([ZX, y + 7], [ZX, y + 16], 6, P), { tone: "lit" }));
  out.push(S_(k.cylinder(ZX, y, 1.8, 6, ROD_Z - 6, P, 16), { tone: "mid", crease: "none" }));
  return out.join("");
}

function outputRod(i) {
  const y = rodY(i);
  const id = `mv-rod-${i}`;
  const rodPlan = { x: ZX - 118, y: y - ROD_T / 2, w: 121, d: ROD_T, r: 0.8 };
  const rod = S_(k.slabOf(rodPlan, ROD_Z, ROD_T, P, 3, 0.4), { tone: "hi", lit: true });
  const end = S_(k.slabOf({ x: ZX - 3, y: y - 3, w: 6, d: 6, r: 1 }, ROD_Z - 0.6, ROD_T + 1.2, P, 3, 0.3), { tone: "mid" });
  const dot = D([at([ZX, y, ROD_Z + ROD_T + 0.6])], { size: 0.5, tone: "hi" });
  return `<clipPath id="${id}"><path d="${clipBox(BOX.x + BOX.w + BOSS - 0.1, 400, y - 4, y + 4, ROD_Z - 2, ROD_Z + ROD_T + 3)}"/></clipPath><g clip-path="url(#${id})"><g data-rod="${i}a">${rod}</g></g><g data-rod="${i}b">${end}${dot}</g>`;
}

// ---------------------------------------------------------------- assemble
const T = (by) => k.translateAlong(P, by);
function rowArt(i, x) {
  const y = yOf(x);
  const out = [];
  // feed bars run behind their own gears; bar (2,1) passes over gear (2,2), so row 2 interleaves
  const plan = i === 0 ? [["bar", 0], ["bar", 1], ["shaft", 0], ["shaft", 1]] : [["bar", 1], ["shaft", 1], ["bar", 0], ["shaft", 0]];
  for (const [kind, j] of plan) out.push(kind === "bar" ? support(i, j) + feedBar(i, j, A[i][j] * x[j] * S) : shaft(i, j, x));
  out.push(outputBed(i));
  out.push(housing(i));
  out.push(`<g data-slide="${i}" transform="${T([y[i] * S, 0, 0])}">${outputSlide(i)}</g>`);
  out.push(outputRod(i).replace(/data-rod="(\d)(a|b)"/g, (m) => `${m} transform="${T([y[i] * S, 0, 0])}"`));
  return out.join("");
}

const rackGroup = (j, x) => `<g data-rack="${j}" transform="${T([0, x[j] * S, 0])}">${rack(j)}</g>`;

const LABEL =
  "A bench machine that multiplies a vector by a 2 by 2 matrix. Two input racks slide toward the viewer by x1 and x2. Each turns a column of two shafts; every shaft carries a small gear on the rack and a larger gear whose radius is the matrix entry times the small one, so the feed bar it drives moves by a_ij times x_j. Each row's two feed bars go into a summing housing whose output rod carries a pointer over a ruler reading y_i.";

function svgFor(x) {
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: LABEL,
    body: [plate(), inputBeds(), rackGroup(0, x), rackGroup(1, x), rowArt(0, x), rowArt(1, x)],
  });
}

const fmt = (v) => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
const readoutOf = (x) => {
  const xr = x.map((v) => Math.round(v * 10) / 10);
  const y = yOf(xr);
  return `x = (${fmt(xr[0])}, ${fmt(xr[1])}) → y = (${fmt(y[0])}, ${fmt(y[1])})`;
};

const svg = svgFor(X0);
const stage = `<div class="iso-stage mv-stage" tabindex="0" role="group" aria-roledescription="vector control" aria-label="Matrix-vector machine. Left and Right arrows change x1, Up and Down change x2, Shift for bigger steps, Home resets to zero.">${svg}<span class="mv-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "y = Ax",
  hint: "Hover · drag · arrow keys",
  readout: readoutOf(X0),
  keys: [
    { mark: "raised", label: "Gear pairs: big radius = a_ij × small radius, A = [[2, 1], [1, 3]]" },
    { mark: "lit", label: "Output rods: each reads one y_i" },
  ],
  caption:
    "Each input rack moves by x_j and turns its column of shafts. On every shaft the big gear is a_ij times the small one, so its feed bar moves a_ij·x_j. A row's housing adds its two feeds, and the rod that leaves it reads y_i = a_i1·x1 + a_i2·x2.",
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="matvec">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under .iso
function scope(css) {
  const out = [];
  let i = 0;
  const read = () => {
    // read one top-level rule: prelude { body }
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
    else if (prelude.startsWith("@")) out.push(`${prelude}{${scope(body)}}`);
    else {
      const sel = prelude
        .split(",")
        .map((s) => s.trim())
        .flatMap((s) => (s === ".iso" ? [s] : s === '.iso[data-theme="light"]' ? [s, "html:not(.dark) .iso[data-anatomy]"] : s.startsWith(".iso[") ? [s] : [`.iso ${s}`]))
        .join(",");
      out.push(`${sel}{${body.trim()}}`);
    }
  }
  return out.join("\n");
}
const FIGURE_CSS = `
.iso[data-anatomy="matvec"]{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso[data-anatomy="matvec"][data-theme="light"],html:not(.dark) .iso[data-anatomy="matvec"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso[data-anatomy="matvec"] .iso-figure{margin:0}
.iso[data-anatomy="matvec"] .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso[data-anatomy="matvec"] .iso-plate-corner{font-family:inherit;font-size:11px}
.iso[data-anatomy="matvec"] .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso[data-anatomy="matvec"] .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso[data-anatomy="matvec"] .iso-legend{font-size:13px}
.iso .mv-stage{position:relative;outline:none;touch-action:pan-y;cursor:crosshair}
.iso .mv-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso .mv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:560px){.iso[data-anatomy="matvec"] .iso-plate{padding:40px 4px 60px}}
`;
const css = scope(k.ISO_CSS) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script (plain ES module)
const live = `
const P = ${JSON.stringify(P)};
const A = ${JSON.stringify(A)};
const S = ${S}, R0 = ${R0}, LIMIT = ${LIMIT};
const GEARS = ${JSON.stringify(GEARS)};
const kit = { cylinder, towardViewer, segment, onTop, ring, lineOnTop, lineSvg, solidSvg };
${gearRing.toString()}
${gearArt.toString()}
const T = (by) => translateAlong(P, by);
const yOf = (x) => A.map((row) => row[0] * x[0] + row[1] * x[1]);
const fmt = ${fmt.toString()};
const readoutOf = (x) => {
  const xr = x.map((v) => Math.round(v * 10) / 10);
  const y = yOf(xr);
  return "x = (" + fmt(xr[0]) + ", " + fmt(xr[1]) + ") \\u2192 y = (" + fmt(y[0]) + ", " + fmt(y[1]) + ")";
};
const TOUR = [[1, 0], [0, 1], [1, 0.5], [-0.5, 1], [1, -1], [0, 0]];
const DWELL = 2.6;

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  // theme: host toggles "dark" on <html>; the kit wants data-theme="light" for light
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".mv-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (sel) => svg.querySelector(sel);
  const racks = [0, 1].map((j) => q('[data-rack="' + j + '"]'));
  const bars = [[0, 1], [0, 1]].map((cols, i) => cols.map((j) => q('[data-bar="' + i + j + '"]')));
  const slides = [0, 1].map((i) => q('[data-slide="' + i + '"]'));
  const rods = [0, 1].map((i) => [q('[data-rod="' + i + 'a"]'), q('[data-rod="' + i + 'b"]')]);
  const gears = GEARS.map((g) => ({ g, el: q('[data-gear="' + g.id + '"]'), last: null }));
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v) => Math.max(-LIMIT, Math.min(LIMIT, v));
  const snap = (v) => Math.round(v * 10) / 10;

  let x = ${JSON.stringify(X0)}.slice(), target = x.slice();
  let frame = 0, last = 0, clock = 0, visible = false, touring = !still.matches, idle = 0, dragging = false;

  function draw() {
    const y = yOf(x);
    racks.forEach((el, j) => el.setAttribute("transform", T([0, x[j] * S, 0])));
    bars.forEach((row, i) => row.forEach((el, j) => el.setAttribute("transform", T([A[i][j] * x[j] * S, 0, 0]))));
    slides.forEach((el, i) => el.setAttribute("transform", T([y[i] * S, 0, 0])));
    rods.forEach((pair, i) => pair.forEach((el) => el.setAttribute("transform", T([y[i] * S, 0, 0]))));
    for (const item of gears) {
      const angle = (x[item.g.col] * S) / R0;
      if (item.last !== null && Math.abs(angle - item.last) < 1e-4) continue;
      item.last = angle;
      item.el.innerHTML = gearArt(kit, P, item.g, angle);
    }
    const text = readoutOf(x);
    if (readout.textContent !== text) readout.textContent = text;
  }
  const announce = () => { say.textContent = readoutOf(target); };

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (touring) {
      clock += dt;
      target = TOUR[Math.floor(clock / DWELL) % TOUR.length].slice();
    }
    const calm = still.matches;
    const ease = 1 - Math.exp(-dt / 0.32);
    for (let j = 0; j < 2; j++) {
      x[j] = calm ? target[j] : x[j] + (target[j] - x[j]) * ease;
      if (Math.abs(target[j] - x[j]) < 5e-4) x[j] = target[j];
    }
    draw();
    const settled = !touring && x[0] === target[0] && x[1] === target[1];
    frame = visible && !settled ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  const resumeLater = () => {
    clearTimeout(idle);
    idle = setTimeout(() => { if (still.matches || dragging) return; touring = true; clock = 0; run(); }, 3600);
  };
  const steer = (next, speak) => {
    touring = false;
    target = next.map((v) => snap(clamp(v)));
    if (speak) announce();
    resumeLater();
    run();
  };

  const fromPointer = (event) => {
    const box = svg.getBoundingClientRect();
    const fx = (event.clientX - box.left) / box.width;
    const fy = (event.clientY - box.top) / box.height;
    // left-right sets x1, up-down sets x2 (up is +)
    return [((fx - 0.2) / 0.6) * 2 - 1, 1 - ((fy - 0.15) / 0.7) * 2];
  };
  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || dragging) steer(fromPointer(event));
  });
  stage.addEventListener("pointerdown", (event) => {
    dragging = true;
    try { stage.setPointerCapture(event.pointerId); } catch {}
    steer(fromPointer(event));
  });
  const release = () => { dragging = false; resumeLater(); };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("pointerleave", () => { if (!dragging) resumeLater(); });
  stage.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.5 : 0.1;
    const next = target.slice();
    if (event.key === "ArrowRight") next[0] += step;
    else if (event.key === "ArrowLeft") next[0] -= step;
    else if (event.key === "ArrowUp") next[1] += step;
    else if (event.key === "ArrowDown") next[1] -= step;
    else if (event.key === "Home") { next[0] = 0; next[1] = 0; }
    else if (event.key === "End") { next[0] = 1; next[1] = 1; }
    else if (event.key === "Escape") { touring = !still.matches; clock = 0; run(); return; }
    else return;
    event.preventDefault();
    steer(next, true);
  });
  still.addEventListener?.("change", () => { if (still.matches) touring = false; run(); });
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  draw();
}

function start() { document.querySelectorAll('[data-anatomy="matvec"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/matvec/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${live}`;

// ---------------------------------------------------------------- write
writeFileSync(join(OUT, "matvec.html"), fragment + "\n");
writeFileSync(join(OUT, "iso.css"), css);
writeFileSync(join(OUT, "matvec.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>y = Ax</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main><p>Preview of the matvec figure as the site embeds it.</p>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log("wrote matvec.html, iso.css, matvec.js, preview.html, preview-light.html");
