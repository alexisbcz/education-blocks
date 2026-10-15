// Fig · Truss bridge load test — a model Pratt truss on a test bench: a
// load pan hangs from a chosen panel point, a dial gauge reads the midspan
// deflection, and every member is tinted by the force the method of joints
// gives it (blue tension, red compression).
// Run from the repo root: node figures/civil-bridge/build.mjs
// Writes site/static/anatomy/civil-bridge.{html,css,js} and
// figures/civil-bridge/preview{,-light}.html. The shared iso.css is not
// touched; civil-bridge.css carries the kit CSS scoped under
// [data-anatomy="civil-bridge"].
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "/Users/alex/.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";
import { solveTruss, deflectionAt } from "../../site/static/js/civil-truss.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- model (mm, N)
// A four-panel Pratt truss, 240 mm span, 60 mm deep, of 5 × 4 mm aluminium
// bars (A = 20 mm², E ≈ 70 GPa). Pin at the left bearing, roller at the
// right: m + r = 13 + 3 = 16 = 2j, statically determinate.
const SPAN = 240, PANEL = 60, H = 60;
const NODES = [[-120, 0], [-60, 0], [0, 0], [60, 0], [120, 0], [-60, H], [0, H], [60, H]];
const MEMBERS = [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [0, 5], [4, 7], [1, 5], [2, 6], [3, 7], [5, 2], [7, 2]];
const SUPPORTS = [[0, "pin"], [4, "roller"]];
const E = 70000, AREA = 20, EA = E * AREA; // N/mm² × mm² = N
const WEIGHT = 100, MAX_W = 8; // slotted weights of 100 N each
const LOAD_NODES = [1, 2, 3];
const MID_TOP = 6; // the gauge's plunger rests on the top strut over node 6
const stateOf = (node, count) => {
  const P = count * WEIGHT;
  const r = solveTruss(NODES, MEMBERS, SUPPORTS, P ? [[node, 0, -P]] : []);
  const forces = r.ok ? r.forces : MEMBERS.map(() => 0);
  const delta = P ? deflectionAt(NODES, MEMBERS, SUPPORTS, [[node, 0, -P]], MID_TOP, EA) : 0;
  return { P, forces, delta };
};

// ---------------------------------------------------------------- layout (world ≈ 1 mm; x along the span, y across, z up)
const WIDTH = 640, HEIGHT = 520;
const AZ = 38; // look at the long side
const BENCH = { x: -175, y: -62, w: 350, d: 124, r: 5 };
const BENCH_H = 16, FOOT_H = 6;
const Y = 22; // truss planes at y = ±Y
const ZB = 80.5; // bottom-chord centreline (underside at 78)
const ZT = ZB + H; // top-chord centreline
const W_IN = 5, T_OUT = 4; // member depth in the plane, thickness across it
const PED_TOP = 66;
const PED = (x) => ({ x: x - 16, y: -36, w: 32, d: 72, r: 2 });
const STRUT_TOP = ZT + 2.5 + 2.5;
const POST = [0, -Y - 30]; // gauge stand behind the bridge
const DIAL = [0, 0], DIAL_R = 13, DIAL_Z = 182, DIAL_H = 8, DIAL_TOP = DIAL_Z + DIAL_H;
const PAN_Z = 26; // top of the pan
const DISC_H = 4.4;

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -FOOT_H, 0), ...k.boxCorners({ x: -130, y: -40, w: 260, d: 80, r: 0 }, 0, DIAL_TOP + 6)],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: AZ },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const view = k.towardViewer(P);
const FRONT = view[1] > 0 ? 1 : -1; // the y side the viewer sees
const KS = P.scale * Math.sqrt(1.6);

// An oriented bar from a to b (world points) with a W × T section, the T
// side across the truss plane: a prism along the member's own axis.
function bar(a, b, w = W_IN, t = T_OUT) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const ax = d.map((c) => c / len);
  const u = [0, 1, 0];
  const v = [-ax[2], 0, ax[0]];
  const F = G.frameOf(a, ax, u, v);
  return G.prismOf(F, [[-t / 2, -w / 2], [t / 2, -w / 2], [t / 2, w / 2], [-t / 2, w / 2]], 0, len, P);
}
const node3 = (i, y) => [NODES[i][0], y, NODES[i][1] + ZB];

// ---------------------------------------------------------------- bench
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -FOOT_H, FOOT_H, P)}"/>`];
  const feet = [...k.corners(BENCH, 16)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 8, -FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 6, -FOOT_H + 1.6, FOOT_H - 1.6, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(BENCH, 0, BENCH_H, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(BENCH, 6, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), BENCH_H, P), { tone: "faint" }));
  const screws = k.corners(BENCH, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, BENCH_H, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, BENCH_H])), { size: 0.5 }));
  // Ruler strip along the near edge, ticks every 5 mm, a major every 50.
  const yEdge = FRONT > 0 ? BENCH.y + BENCH.d - 14 : BENCH.y + 4;
  const strip = { x: -150, y: yEdge, w: 300, d: 10, r: 1 };
  out.push(S_(k.slabOf(strip, BENCH_H, 0.8, P, 2), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 10, FRONT > 0 ? strip.y : strip.y + strip.d - 4.2, BENCH_H + 0.8, [2.2, 4.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // Label plate on the near side face, three rule lines.
  const yf = FRONT > 0 ? BENCH.y + BENCH.d : BENCH.y;
  const plate = [[-30, yf, 4], [30, yf, 4], [30, yf, 12.5], [-30, yf, 12.5]];
  out.push(`<path class="cb-panel" d="${k.pathOf(plate.map(at), true)}"/>`);
  out.push(L(k.pathOf(plate.map(at), true), { tone: "lo" }));
  out.push(L([[-26, 10, 30], [-26, 8, 40], [-26, 6, 22]].map(([x, z, len]) => k.pathOf([at([x, yf, z]), at([x + len, yf, z])])).join(""), { tone: "lo", free: true }));
  return out.join("");
}

// ---------------------------------------------------------------- pedestals and bearings
function pedestal(x) {
  const plan = PED(x);
  const out = [S_(k.slabOf(plan, BENCH_H, PED_TOP - BENCH_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, BENCH_H + 10, P, 3), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(plan, 3), PED_TOP, P, 3), { tone: "faint" }));
  out.push(Dots([[x - 11, -30], [x + 11, -30], [x - 11, 30], [x + 11, 30]].map(([px, py]) => at([px, py, PED_TOP])), { size: 0.45, tone: "lo" }));
  // Bearing plate under both truss planes.
  const bp = { x: x - 11, y: -Y - 7, w: 22, d: 2 * Y + 14, r: 1 };
  out.push(S_(k.slabOf(bp, PED_TOP, 3, P, 2, 0.4), { tone: "mid" }));
  return out.join("");
}
// A cylinder lying along y: a pin or a roller.
const along = (x, z, y0, y1, r) => G.disc(0, y1 - y0, r, G.frameOf([x, y0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P);
function pinBearing(x) {
  const out = [];
  for (const y of [-Y, Y].sort((a, b) => k.depthOf([0, a, 0], P) - k.depthOf([0, b, 0], P))) {
    // Two cheek plates either side of each chord, the pin through them.
    for (const dy of [-1, 1].sort((a, b) => k.depthOf([0, y + a, 0], P) - k.depthOf([0, y + b, 0], P))) {
      const cheek = { x: x - 6, y: y + dy * 3.6 - 1, w: 12, d: 2, r: 0.5 };
      out.push(S_(k.slabOf(cheek, PED_TOP + 3, 9.5, P, 2, 0.3), { tone: "mid" }));
    }
  }
  out.push(S_(along(x, PED_TOP + 8.5, -Y - 6, Y + 6, 2.2), { tone: "mid" }));
  return out.join("");
}
function rollerBearing(x) {
  const out = [];
  for (const dx of [-5, 5]) out.push(S_(along(x + dx, PED_TOP + 3 + 3, -Y - 6, Y + 6, 3), { tone: "mid" }));
  const rocker = { x: x - 10, y: -Y - 6, w: 20, d: 2 * Y + 12, r: 1 };
  out.push(S_(k.slabOf(rocker, PED_TOP + 9, 2, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- the truss
// Members in one plane, painted bottom chord → verticals → diagonals → top
// chord, each wrapped in a group the live code tints by its force.
const ORDER = [0, 1, 2, 3, 8, 9, 10, 6, 7, 11, 12, 4, 5];
function plane(y, gussetSide) {
  const out = [];
  for (const m of ORDER) {
    const [i, j] = MEMBERS[m];
    out.push(`<g class="cb-mem" data-m="${m}" data-sense="z">${S_(bar(node3(i, y), node3(j, y)), { tone: "hi", crease: "lo" })}</g>`);
  }
  // Gusset plates on the face toward the viewer, four bolts each.
  const face = y + gussetSide * (T_OUT / 2 + 0.4);
  NODES.forEach(([x, z], i) => {
    const F = G.frameOf([x, face, z + ZB], [0, gussetSide, 0], [1, 0, 0], [0, 0, 1]);
    const top = z > 0, end = Math.abs(x) === 120;
    const poly = [];
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * Math.PI * 2 + Math.PI / 8;
      let px = Math.cos(a) * 8.5, pz = Math.sin(a) * 8.5;
      if (end && Math.sign(px) === Math.sign(x)) px *= 0.55;
      poly.push([px, top ? Math.min(pz, 4) : Math.max(pz, -4)]);
    }
    out.push(S_(G.prismOf(F, poly, -0.4, 0.4, P), { tone: "mid", crease: "faint" }));
    const bolts = [[-4.6, 0], [4.6, 0], [0, top ? -4.6 : 4.6]].filter(([bx]) => !(end && Math.sign(bx) === Math.sign(x)));
    out.push(Dots(bolts.map(([bx, bz]) => at([x + bx, face + gussetSide * 0.45, z + ZB + bz])), { size: 0.5, tone: "lo" }));
  });
  return out.join("");
}
// Floor beams under the bottom nodes and struts over the top nodes tie the
// two planes together; a thin deck runs on the floor beams.
function crossTies() {
  const out = [];
  const xs = [-120, -60, 0, 60, 120].sort((a, b) => k.depthOf([a, 0, 0], P) - k.depthOf([b, 0, 0], P));
  for (const x of xs) out.push(S_(k.slabOf({ x: x - 3, y: -Y + T_OUT / 2, w: 6, d: 2 * Y - T_OUT, r: 0.5 }, ZB - 4, 6, P, 2, 0.3), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: -118, y: -Y + T_OUT / 2 + 1, w: 236, d: 2 * Y - T_OUT - 2, r: 1 }, ZB + 2, 1.2, P, 2, 0.3), { tone: "lo", inner: L([-60, 0, 60].map((x) => k.lineOnTop([x, -Y + T_OUT / 2 + 1], [x, Y - T_OUT / 2 - 1], ZB + 3.2, P)).join(""), { tone: "faint" }) }));
  return out.join("");
}
function topStruts() {
  return [-60, 0, 60].sort((a, b) => k.depthOf([a, 0, 0], P) - k.depthOf([b, 0, 0], P))
    .map((x) => S_(k.slabOf({ x: x - 3, y: -Y - T_OUT / 2, w: 6, d: 2 * Y + T_OUT, r: 0.5 }, ZT + 2.5, 2.5, P, 2, 0.3), { tone: "mid" }))
    .join("");
}

// ---------------------------------------------------------------- load pan (built at x = 0, moved to its panel point)
function hanger() {
  const out = [];
  // Hook block clamped under the floor beam, the rod down to the pan hub.
  out.push(S_(k.slabOf({ x: -4, y: -4, w: 8, d: 8, r: 1 }, ZB - 9, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(Dots([at([FRONT * 0, FRONT * 4, ZB - 6.5])], { size: 0.45, tone: "lo" }));
  out.push(S_(k.cylinder(0, 0, 1.3, PAN_Z, ZB - 9 - PAN_Z, P, 16), { tone: "mid", crease: "none" }));
  // The pan: a dish with a rim and a hub.
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -20, y: -20, w: 40, d: 40, r: 20 }, BENCH_H, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S_(k.cylinder(0, 0, 20, PAN_Z - 3, 3, P, 64, 0.6), { tone: "mid", inner: L(k.sideArc(0, 0, 20, PAN_Z - 1.5, P, 40), { tone: "faint" }) }));
  out.push(L(k.ring(0, 0, 17.5, PAN_Z, P, 56), { tone: "faint" }));
  out.push(S_(k.cylinder(0, 0, 4, PAN_Z, 2, P, 24), { tone: "mid" }));
  return out.join("");
}
// Slotted 100 N weights stacked on the pan; the live code shows as many as are loaded.
function weight(i) {
  const z = PAN_Z + 2 + i * DISC_H;
  const d = S_(k.cylinder(0, 0, 14, z, DISC_H - 0.3, P, 56, 0.4), { tone: "lo", inner: L(k.sideArc(0, 0, 14, z + DISC_H / 2, P, 40), { tone: "faint" }) });
  const slot = L(k.lineOnTop([0, 1.3 * FRONT], [0, FRONT * 14], z + DISC_H - 0.3, P), { tone: "faint" });
  return `<g data-w="${i}">${d}${slot}</g>`;
}

// ---------------------------------------------------------------- dial gauge on a stand behind the bridge
function gaugeStand() {
  const out = [];
  const base = { x: POST[0] - 14, y: POST[1] - 9, w: 28, d: 18, r: 2 };
  out.push(S_(k.slabOf(base, BENCH_H, 12, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(base, BENCH_H + 6, P, 3), { tone: "faint" }) }));
  out.push(S_(k.cylinder(POST[0] + 9, POST[1], 3, BENCH_H + 12, 3, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(POST[0] + 9, POST[1], 3, BENCH_H + 12, BENCH_H + 15, 14, P), { tone: "lo" }));
  out.push(S_(k.cylinder(POST[0], POST[1], 3.2, BENCH_H + 12, DIAL_Z + 6 - BENCH_H - 12, P, 24), { tone: "mid", crease: "none", inner: L([60, 110, 160].map((z) => k.sideArc(POST[0], POST[1], 3.2, z, P, 16)).join(""), { tone: "faint" }) }));
  out.push(S_(k.cylinder(POST[0], POST[1], 3.8, DIAL_Z + 6, 2, P, 24), { tone: "mid" }));
  return out.join("");
}
function gaugeArm() {
  const out = [];
  const clamp = { x: POST[0] - 6, y: POST[1] - 6, w: 12, d: 12, r: 2 };
  out.push(S_(k.slabOf(clamp, DIAL_Z - 4, 10, P, 3, 0.5), { tone: "mid" }));
  const arm = { x: -3, y: POST[1] + 6, w: 6, d: DIAL[1] - DIAL_R - POST[1] - 6 + 2, r: 1.5 };
  out.push(S_(k.slabOf(arm, DIAL_Z + 1, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(Dots([at([0, arm.y + 4, DIAL_Z + 5]), at([0, arm.y + arm.d - 5, DIAL_Z + 5])], { size: 0.45 }));
  out.push(S_(k.cylinder(POST[0] + 6 + 2.6, POST[1], 2.6, DIAL_Z - 2, 6, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(POST[0] + 6 + 2.6, POST[1], 2.6, DIAL_Z - 2, DIAL_Z + 4, 14, P), { tone: "lo" }));
  return out.join("");
}
function plunger() {
  return S_(k.cylinder(0, 0, 2.6, STRUT_TOP, 1.6, P, 18), { tone: "hi", lit: true }) +
    S_(k.cylinder(0, 0, 1.2, STRUT_TOP + 1.6, DIAL_Z - 6 - STRUT_TOP - 1.6, P, 14), { tone: "hi", crease: "none", lit: true });
}
function dial() {
  const out = [];
  const [x, y] = DIAL;
  out.push(S_(k.cylinder(x, y, 2.8, DIAL_Z - 6, 6, P, 18), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 84, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 2.2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 3, 50, 5, DIAL_TOP, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.5, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 6.5], DIAL_TOP, P, "x"), "0.01 mm", { size: 2.2, tone: "lo", anchor: "middle" }));
  return out.join("");
}
// One turn of the needle is 1 mm (100 divisions of 0.01 mm; 50 ticks of 0.02).
const needleAt = (delta) => {
  const angle = delta * Math.PI * 2;
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 3, y + Math.cos(angle) * 3], [x + Math.sin(angle) * (DIAL_R - 4), y - Math.cos(angle) * (DIAL_R - 4)], DIAL_TOP + 0.2, P);
};

// ---------------------------------------------------------------- assemble
const BACK_Y = -FRONT * Y, FRONT_Y = FRONT * Y;
const LABEL =
  "A model Pratt truss bridge, 240 mm long, on a test bench. Its left end sits on a pin bearing and its right end on two rollers. A pan of slotted weights hangs from one of the bottom panel points. A dial gauge on a stand behind the bridge rests its plunger on the top strut at midspan. Each bar of the truss is tinted by its force: blue in tension, red in compression.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    bench(),
    gaugeStand(),
    pedestal(-120),
    pedestal(120),
    pinBearing(-120),
    rollerBearing(120),
    `<g data-plane="back">${plane(BACK_Y, FRONT)}</g>`,
    crossTies(),
    `<g data-pan>${hanger()}${Array.from({ length: MAX_W }, (_, i) => weight(i)).join("")}</g>`,
    topStruts(),
    gaugeArm(),
    plunger(),
    dial(),
    `<path data-needle class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
    `<g data-plane="front">${plane(FRONT_Y, FRONT)}</g>`,
  ],
});

const nodeName = (i) => `L${i}`;
const readoutOf = (s, node) =>
  s.P === 0 ? "no load · δ 0.000 mm" : `P ${s.P} N at ${nodeName(node)} · δ ${s.delta.toFixed(3)} mm · max |N| ${Math.max(...s.forces.map(Math.abs)).toFixed(0)} N`;

const stage = `<div class="iso-stage cb-stage" tabindex="0" role="group" aria-roledescription="bridge load test" aria-label="Truss bridge load test. Left and Right arrows move the load pan between panel points L1, L2 and L3; Up and Down add or remove a 100 newton weight; Space pauses the tour.">${svg}<span class="cb-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Truss bridge load test",
  hint: "← → panel · ↑ ↓ weights · space pause",
  readout: readoutOf(stateOf(2, 0), 2),
  keys: [
    { mark: "blue", label: "Tension" },
    { mark: "red", label: "Compression" },
    { mark: "lit", label: "Dial gauge plunger: midspan deflection" },
  ],
  caption: `Forces from the method of joints (two equilibrium equations per joint, 13 members + 3 reactions = 16 = 2 × 8 joints). The deflection is the unit-load sum δ = Σ N·n·L / EA for 5 × 4 mm aluminium bars (EA ≈ 1.4 MN), linear elastic; the drawing itself is not deflected. Bottom panel points L0–L4 from the pin bearing; the dial reads 0.01 mm per division.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="civil-bridge">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="civil-bridge"]
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
const R = '[data-anatomy="civil-bridge"]';
const tint = (part, base, amount) => `.iso${R} .cb-mem[data-sense="t"] ${part},.iso${R} .cb-mem[data-sense="c"] ${part}{fill:color-mix(in oklab,var(--cb-c) calc(var(--cb-k,0) * ${amount}%),${base})}`;
const FIGURE_CSS = `
.iso${R}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;--cb-t:var(--vec-u,#009fff);--cb-cmp:var(--code-del,#ff2e3f);width:100%;max-width:760px;margin:0 auto;color:var(--anatomy-text)}
.iso${R}[data-theme="light"],html:not(.dark) .iso${R}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7;--cb-t:var(--vec-u,#009fff);--cb-cmp:var(--code-del,#d52c36)}
.iso${R} .iso-figure{margin:0}
.iso${R} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R} .iso-legend{font-size:13px}
.iso${R} .cb-stage{position:relative;outline:none;cursor:default}
.iso${R} .cb-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R} .cb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R} .cb-panel{fill:var(--anatomy-face)}
.iso${R} .cb-mem[data-sense="t"]{--cb-c:var(--cb-t)}
.iso${R} .cb-mem[data-sense="c"]{--cb-c:var(--cb-cmp)}
${[0, 1, 2, 3].map((s) => tint(`.iso-shade[data-shade="${s}"]`, `var(--anatomy-shade-${s})`, 75)).join("\n")}
${tint(".iso-top", "var(--anatomy-top)", 75)}
.iso${R} .cb-mem[data-sense="t"] .iso-edge,.iso${R} .cb-mem[data-sense="c"] .iso-edge{stroke:color-mix(in oklab,var(--cb-c) calc(var(--cb-k,0) * 100%),var(--anatomy-hi))}
.iso${R} .cb-mem[data-sense="z"] .iso-edge{stroke:var(--anatomy-mid)}
@media (max-width:560px){.iso${R} .iso-plate{padding:40px 4px 60px}}
`;
const css = scope(k.ISO_CSS, R) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const liveSrc = `
const P = ${JSON.stringify(P)};
const NODES = ${JSON.stringify(NODES)}, MEMBERS = ${JSON.stringify(MEMBERS)}, SUPPORTS = ${JSON.stringify(SUPPORTS)};
const EA = ${EA}, WEIGHT = ${WEIGHT}, MAX_W = ${MAX_W}, MID_TOP = ${MID_TOP};
const LOAD_NODES = ${JSON.stringify(LOAD_NODES)}, DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const k = { lineOnTop };
${solveTruss.toString()}
${deflectionAt.toString()}
const stateOf = ${stateOf.toString()};
const needleAt = ${needleAt.toString()};
const nodeName = ${nodeName.toString()};
const readoutOf = ${readoutOf.toString()};

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".cb-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const pan = svg.querySelector("[data-pan]");
  const needle = svg.querySelector("[data-needle]");
  const weights = [...svg.querySelectorAll("[data-w]")];
  const mems = [...svg.querySelectorAll(".cb-mem")];
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // The load is discrete (a panel point, a number of weights); the pan
  // glides to its panel point and the dial needle follows the deflection.
  let node = 2, count = 0, panX = 0, shown = 0, paused = false, frame = 0, last = 0, visible = false, touched = 0, tourAt = 0;
  const TOUR = [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [1, 6], [1, 6], [3, 6], [3, 6], [2, 6], [2, 4], [2, 2], [2, 0]];
  let state = stateOf(node, count);

  function apply() {
    state = stateOf(node, count);
    const peak = Math.max(1, ...state.forces.map(Math.abs));
    for (const g of mems) {
      const f = state.forces[+g.dataset.m];
      const sense = Math.abs(f) < 0.5 ? "z" : f > 0 ? "t" : "c";
      g.dataset.sense = sense;
      g.style.setProperty("--cb-k", sense === "z" ? "0" : (0.35 + 0.65 * Math.abs(f) / peak).toFixed(3));
    }
    weights.forEach((w, i) => (i < count ? w.removeAttribute("display") : w.setAttribute("display", "none")));
    const text = readoutOf(state, node);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function draw() {
    pan.setAttribute("transform", translateAlong(P, [panX, 0, 0]));
    needle.setAttribute("d", needleAt(shown));
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && now - touched > 5000 && now - tourAt > 1100) {
      tourAt = now;
      const step = TOUR[(TOUR.findIndex(([n, c]) => n === node && c === count) + 1) % TOUR.length];
      if (step) { [node, count] = step; apply(); }
    }
    const goalX = NODES[node][0];
    panX += (goalX - panX) * (1 - Math.exp(-dt / 0.18));
    shown += (state.delta - shown) * (1 - Math.exp(-dt / 0.25));
    if (Math.abs(goalX - panX) < 0.01) panX = goalX;
    if (Math.abs(state.delta - shown) < 1e-5) shown = state.delta;
    draw();
    frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
  const settle = () => { panX = NODES[node][0]; shown = state.delta; draw(); };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") node = LOAD_NODES[Math.min(LOAD_NODES.length - 1, LOAD_NODES.indexOf(node) + 1)];
    else if (event.key === "ArrowLeft") node = LOAD_NODES[Math.max(0, LOAD_NODES.indexOf(node) - 1)];
    else if (event.key === "ArrowUp") count = Math.min(MAX_W, count + 1);
    else if (event.key === "ArrowDown") count = Math.max(0, count - 1);
    else if (event.key === " ") paused = !paused;
    else return;
    event.preventDefault();
    touched = performance.now();
    apply();
    say.textContent = readoutOf(state, node);
    if (still.matches) settle();
    run();
  });
  stage.addEventListener("click", () => { paused = !paused; run(); });
  still.addEventListener?.("change", () => (still.matches ? settle() : run()));
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  // Under reduced motion there is no tour: show 400 N at midspan, still.
  if (still.matches) count = 4;
  apply();
  settle();
}

function start() { document.querySelectorAll('[data-anatomy="civil-bridge"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/civil-bridge/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT), the shared truss solver\n// (site/static/js/civil-truss.js) and the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, "civil-bridge.html"), fragment + "\n");
writeFileSync(join(OUT, "civil-bridge.css"), css);
writeFileSync(join(OUT, "civil-bridge.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Truss bridge load test</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
const s = stateOf(2, 8);
console.log(`wrote civil-bridge.html/css/js · 800 N at L2: δ = ${s.delta.toFixed(4)} mm, top chord ${s.forces[4].toFixed(1)} N, diagonal ${s.forces[11].toFixed(1)} N`);
