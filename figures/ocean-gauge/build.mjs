// Fig · Float tide gauge on a model harbour basin. A glass-fronted basin
// stands on a bench; a stilling well (a pipe open to the basin only through
// a small intake near its foot) holds a float whose rod rises through a
// guide in the well's cap. The rod carries an arm through a carriage on a
// guide post, and the arm's pen writes on a paper drum turned once a day by
// a clockwork housing. The level is a four-constituent harmonic prediction
// (M2, S2, K1, O1), the same model as the tide predictor block; amplitudes
// arrive as "ocean-tide" events on document.
// Run from the repo root: node figures/ocean-gauge/build.mjs
// Writes site/static/anatomy/ocean-gauge.{html,css,js} and
// figures/ocean-gauge/preview{,-light}.html. iso.css is not touched.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });
const NAME = "ocean-gauge";

// ---------------------------------------------------------------- model
// Constituent periods in hours; amplitudes in metres (the predictor's
// semidiurnal preset). Every constituent is in phase at t = 0.
const TIDE = { M2: 12.4206012, S2: 12, K1: 23.9344696, O1: 25.8193417 };
const AMPS0 = { m2: 2.05, s2: 0.75, k1: 0.07, o1: 0.07 };
const etaAt = (a, t) => a.m2 * Math.cos((2 * Math.PI * t) / TIDE.M2) + a.s2 * Math.cos((2 * Math.PI * t) / TIDE.S2) + a.k1 * Math.cos((2 * Math.PI * t) / TIDE.K1) + a.o1 * Math.cos((2 * Math.PI * t) / TIDE.O1);
// The model is 1 : 250, so 1 m of tide is 4 units of basin.
const SCALE = 4, ETA_MAX = 3.4;
const clampEta = (e) => Math.max(-ETA_MAX, Math.min(ETA_MAX, e));
const readoutOf = (a, t) => {
  const e = etaAt(a, t), d = etaAt(a, t + 0.05) - etaAt(a, t - 0.05);
  const day = Math.floor(t / 24), hh = Math.floor(t % 24), mm = Math.floor((t * 60) % 60);
  return `day ${day} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} · ${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(2)} m · ${d >= 0 ? "rising " : "falling"}`;
};

// ---------------------------------------------------------------- layout (z up, viewer toward +x +y)
const WIDTH = 640, HEIGHT = 560;
const PLATE = { x: -82, y: -42, w: 132, d: 86, r: 7 };
const PLATE_H = 8, FOOT_H = 4;
const BASIN = { x: -74, y: -36, w: 78, d: 70, r: 2 };
const FLOOR_H = 3, RIM = 42;
const WATER0 = 22; // mean level
const WELL = { x: -16, y: -8, r: 7, top: 56 };
const ROD_LEN = 51; // float to the arm: the pen rides at the drum's mid line at mean level
const ARM_Y = WELL.y;
const POST = { x: 12, y: ARM_Y, r: 1.1, top: 96 };
const DRUM = { r: 12, z0: 56, z1: 90 };
const PEN_X = 22; // the pen touches the drum here (y = ARM_Y)
const DN = [-0.6, 0.8]; // outward normal of the drum at the pen
DRUM.x = PEN_X - DRUM.r * DN[0];
DRUM.y = ARM_Y - DRUM.r * DN[1];
const HOUSING = { x: 18, y: -30, w: 24, d: 26, r: 1.2 };
const HOUSING_Z = [44, 55];
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POST.x, POST.y, POST.top + 2], [DRUM.x, DRUM.y, DRUM.z1 + 6], [WELL.x, WELL.y, WATER0 + ROD_LEN + ETA_MAX * SCALE + 3]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 40 },
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
  // A ruler strip along the front edge, ticks every 2 units.
  const strip = { x: -66, y: 37, w: 62, d: 4.5, r: 0.6 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.4, 0.8, [1.6, 3], P);
  out.push(`<path class="og-tick" d="${ticks.minor + ticks.major}"/>`);
  // A label plate with three rule lines for its engraving.
  const label = { x: 18, y: 12, w: 26, d: 16, r: 1 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 3, 0.3), { tone: "lo" }));
  const rules = [16, 20, 24].map((y, i) => k.lineOnTop([label.x + 3, y], [label.x + label.w - (i === 2 ? 10 : 3), y], 0.8, P)).join("");
  out.push(L(rules, { tone: "faint", free: true }));
  out.push(Dots(k.corners(label, 1.6).map(([x, y]) => at([x, y, 0.8])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
// The basin's far walls, floor and the stilling well inside it.
function basinBack() {
  const out = [];
  out.push(S_(k.slabOf(BASIN, 0, FLOOR_H, P, 4, 0.4), { tone: "lo" }));
  out.push(S_(k.slabOf({ x: BASIN.x, y: BASIN.y, w: BASIN.w, d: 2, r: 0.3 }, FLOOR_H, RIM - FLOOR_H, P, 2), { tone: "lo" }));
  out.push(S_(k.slabOf({ x: BASIN.x, y: BASIN.y, w: 2, d: BASIN.d, r: 0.3 }, FLOOR_H, RIM - FLOOR_H, P, 2), { tone: "lo" }));
  // The well: a pipe from the floor to above the rim, with a flange at
  // the floor, an intake hole near its foot, a cap and a rod guide.
  out.push(S_(k.cylinder(WELL.x, WELL.y, WELL.r + 2.2, FLOOR_H, 1.4, P, 32), { tone: "mid" }));
  out.push(S_(k.cylinder(WELL.x, WELL.y, WELL.r, FLOOR_H + 1.4, WELL.top - FLOOR_H - 1.4, P, 36), { tone: "mid", inner: L([12, 30, 46].map((z) => k.sideArc(WELL.x, WELL.y, WELL.r, z, P, 20)).join(""), { tone: "faint" }) }));
  const face = Math.atan2(view[1], view[0]);
  out.push(Dots([at([WELL.x + WELL.r * Math.cos(face), WELL.y + WELL.r * Math.sin(face), FLOOR_H + 4])], { size: 1.1, tone: "lo" }));
  out.push(Dots([0, 1, 2, 3].map((q) => face - Math.PI / 2 + ((q + 0.5) * Math.PI) / 4).map((a) => at([WELL.x + (WELL.r + 1.4) * Math.cos(a), WELL.y + (WELL.r + 1.4) * Math.sin(a), FLOOR_H + 1.4])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
function wellTop() {
  const out = [];
  out.push(S_(k.cylinder(WELL.x, WELL.y, WELL.r + 1.2, WELL.top, 2, P, 36, 0.3), { tone: "mid", inner: L(k.ring(WELL.x, WELL.y, WELL.r - 1.5, WELL.top + 2, P, 28), { tone: "faint" }) }));
  out.push(S_(k.cylinder(WELL.x, WELL.y, 2.4, WELL.top + 2, 3, P, 20), { tone: "mid" }));
  out.push(Dots([0, 1, 2, 3].map((q) => (q * Math.PI) / 2 + 0.4).map((a) => at([WELL.x + (WELL.r - 0.2) * Math.cos(a), WELL.y + (WELL.r - 0.2) * Math.sin(a), WELL.top + 2])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
// A tide staff standing in the basin by the front corner: 1 m per 4 units.
function staff() {
  const sx = -40, sy = 29, out = [];
  out.push(S_(k.slabOf({ x: sx, y: sy, w: 4, d: 1.4, r: 0.2 }, FLOOR_H, RIM - FLOOR_H - 1, P, 2), { tone: "mid" }));
  const minor = [], major = [];
  for (let z = WATER0 - ETA_MAX * SCALE; z <= WATER0 + ETA_MAX * SCALE + 1e-9; z += 1) {
    const big = Math.abs(((z - WATER0) / SCALE) % 1) < 1e-9;
    (big ? major : minor).push(k.segment([sx, sy + 1.4, z], [sx + (big ? 2.8 : 1.4), sy + 1.4, z], P));
  }
  out.push(`<path class="og-tick" d="${minor.join("")}"/><path class="og-tick og-major" d="${major.join("")}"/>`);
  return out.join("");
}
// The glass front: corner posts and rails only.
function basinFront() {
  const out = [];
  const x1 = BASIN.x + BASIN.w, y1 = BASIN.y + BASIN.d;
  const post = (x, y) => S_(k.slabOf({ x: x - 2, y: y - 2, w: 2, d: 2, r: 0.2 }, FLOOR_H, RIM - FLOOR_H, P, 2), { tone: "mid" });
  out.push(post(x1, BASIN.y + 2));
  out.push(post(BASIN.x + 2, y1));
  out.push(S_(k.slabOf({ x: BASIN.x, y: y1 - 2, w: BASIN.w, d: 2, r: 0.2 }, FLOOR_H, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: x1 - 2, y: BASIN.y, w: 2, d: BASIN.d, r: 0.2 }, FLOOR_H, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: BASIN.x, y: BASIN.y, w: BASIN.w, d: 2, r: 0.2 }, RIM - 2, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: BASIN.x, y: BASIN.y, w: 2, d: BASIN.d, r: 0.2 }, RIM - 2, 2, P, 2), { tone: "mid" }));
  out.push(post(x1, y1));
  out.push(S_(k.slabOf({ x: BASIN.x, y: y1 - 2, w: BASIN.w, d: 2, r: 0.2 }, RIM - 2, 2, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: x1 - 2, y: BASIN.y, w: 2, d: BASIN.d, r: 0.2 }, RIM - 2, 2, P, 2), { tone: "mid" }));
  const corners = [[x1 - 1, y1 - 1], [BASIN.x + 1, y1 - 1], [x1 - 1, BASIN.y + 1]];
  out.push(Dots(corners.map(([x, y]) => at([x, y, RIM])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
function recorderBase() {
  const out = [];
  out.push(S_(k.slabOf({ x: 20, y: -24, w: 20, d: 16, r: 1.2 }, 0, 2.5, P, 3, 0.4), { tone: "mid" }));
  out.push(Dots(k.corners({ x: 20, y: -24, w: 20, d: 16 }, 2).map(([x, y]) => at([x, y, 2.5])), { size: 0.42, tone: "lo" }));
  out.push(S_(k.slabOf({ x: 25, y: -20, w: 10, d: 8, r: 0.8 }, 2.5, HOUSING_Z[0] - 2.5, P, 3, 0.3), { tone: "mid", inner: L(k.sideSeam({ x: 25, y: -20, w: 10, d: 8, r: 0.8 }, 30, P, 3), { tone: "faint" }) }));
  // The clockwork housing, with a winding arbour and a door seam.
  out.push(S_(k.slabOf(HOUSING, HOUSING_Z[0], HOUSING_Z[1] - HOUSING_Z[0], P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(HOUSING, HOUSING_Z[0] + 2.2, P, 3), { tone: "faint" }) }));
  const fy = HOUSING.y + HOUSING.d;
  out.push(L(k.pathOf([at([HOUSING.x + 4, fy, HOUSING_Z[0] + 2.2]), at([HOUSING.x + 4, fy, HOUSING_Z[1]])]), { tone: "faint" }));
  out.push(Dots([at([HOUSING.x + 14, fy, (HOUSING_Z[0] + HOUSING_Z[1]) / 2 + 1])], { size: 1, tone: "lo" }));
  out.push(Dots([[HOUSING.x + 2, fy, HOUSING_Z[1] - 1.2], [HOUSING.x + HOUSING.w - 2, fy, HOUSING_Z[1] - 1.2]].map(at), { size: 0.4, tone: "lo" }));
  out.push(S_(k.cylinder(DRUM.x, DRUM.y, 4, HOUSING_Z[1], DRUM.z0 - HOUSING_Z[1], P, 20), { tone: "mid" }));
  return out.join("");
}
function guidePost() {
  const out = [];
  out.push(S_(k.cylinder(POST.x, POST.y, 3.6, 0, 1.6, P, 24), { tone: "mid" }));
  out.push(S_(k.cylinder(POST.x, POST.y, POST.r, 1.6, POST.top - 1.6, P, 16), { tone: "hi", crease: "none" }));
  out.push(S_(k.cylinder(POST.x, POST.y, 2, POST.top, 1.6, P, 16), { tone: "mid" }));
  return out.join("");
}
function drumCap() {
  const out = [];
  out.push(S_(k.cylinder(DRUM.x, DRUM.y, DRUM.r + 0.6, DRUM.z1, 1.4, P, 48, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(DRUM.x, DRUM.y, 3, DRUM.z1 + 1.4, 3.4, P, 24), { tone: "mid", inner: k.knurl ? L(k.knurl(DRUM.x, DRUM.y, 3, DRUM.z1 + 1.4, DRUM.z1 + 4.8, 20, P, 0), { tone: "faint" }) : "" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving parts
function water(eta) {
  const top = WATER0 + clampEta(eta) * SCALE;
  const plan = { x: BASIN.x + 2, y: BASIN.y + 2, w: BASIN.w - 4, d: BASIN.d - 4, r: 0.4 };
  return S_(k.slabOf(plan, FLOOR_H, top - FLOOR_H, P, 2), { tone: "lo", crease: "none" });
}
// The drum: paper band with grid lines and the trace. Paper moves from the
// pen toward the viewer, once around per 24 h.
const W_DRUM = (2 * Math.PI) / 24;
const PEN_A = Math.atan2(DN[1], DN[0]);
const facingAt = (a) => Math.cos(a) * view[0] + Math.sin(a) * view[1] > 0.02;
const onDrum = (a, z, r = DRUM.r) => at([DRUM.x + r * Math.cos(a), DRUM.y + r * Math.sin(a), z]);
function drum(a, t) {
  const out = [];
  out.push(S_(k.cylinder(DRUM.x, DRUM.y, DRUM.r, DRUM.z0, DRUM.z1 - DRUM.z0, P, 64), { tone: "hi", crease: "none" }));
  const z0 = DRUM.z0 + 1.5, z1 = DRUM.z1 - 1.5;
  const zMid = (z0 + z1) / 2;
  // Paper edges and a line every metre.
  const arcs = [z0, z1].map((z) => k.sideArc(DRUM.x, DRUM.y, DRUM.r, z, P, 32)).join("");
  out.push(L(arcs, { tone: "lo" }));
  const grid = [];
  for (let m = -3; m <= 3; m++) if (m) grid.push(k.sideArc(DRUM.x, DRUM.y, DRUM.r, zMid + m * SCALE, P, 32));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(k.sideArc(DRUM.x, DRUM.y, DRUM.r, zMid, P, 32), { tone: "lo" }));
  // Hour lines printed on the paper, turning with the drum.
  const hours = [];
  for (let h = 0; h < 24; h++) {
    const a2 = PEN_A - ((((t - h) % 24) + 24) % 24) * W_DRUM;
    if (!facingAt(a2)) continue;
    const p0 = onDrum(a2, z0), p1 = onDrum(a2, z1);
    hours.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  out.push(`<path class="og-hour" d="${hours.join("")}"/>`);
  // The trace: the level written at time t − Δ is now Δ·ω past the pen.
  const runs = [];
  let run = [];
  for (let d = 0; d <= 24; d += 0.1) {
    const ang = PEN_A - d * W_DRUM;
    if (!facingAt(ang)) { if (run.length > 1) runs.push(run); run = []; if (d > 2) break; continue; }
    run.push(onDrum(ang, zMid + clampEta(etaAt(a, t - d)) * SCALE, DRUM.r + 0.05));
  }
  if (run.length > 1) runs.push(run);
  out.push(`<path class="og-trace" d="${runs.map((r) => k.pathOf(r)).join("")}"/>`);
  return out.join("");
}
function rodAndArm(eta) {
  const zr = WATER0 + clampEta(eta) * SCALE + ROD_LEN; // the arm's height
  const out = [];
  const rodBottom = WELL.top + 5;
  out.push(S_(k.cylinder(WELL.x, WELL.y, 0.9, rodBottom, zr - rodBottom - 1, P, 14), { tone: "hi", crease: "none", lit: true }));
  out.push(S_(k.cylinder(WELL.x, WELL.y, 2, zr - 1.6, 3.2, P, 18), { tone: "mid" }));
  // Arm to the carriage on the guide post, then on to the pen.
  out.push(S_(k.slabOf({ x: WELL.x + 1.6, y: ARM_Y - 0.9, w: POST.x - 3 - WELL.x - 1.6, d: 1.8, r: 0.2 }, zr - 0.9, 1.8, P, 2), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: POST.x - 3, y: POST.y - 3, w: 6, d: 6, r: 0.8 }, zr - 2.6, 5.2, P, 3, 0.3), { tone: "mid", inner: Dots([at([POST.x + 3, POST.y + 1.5, zr]), at([POST.x - 1.5, POST.y + 3, zr])], { size: 0.45, tone: "lo" }) }));
  out.push(S_(k.slabOf({ x: POST.x + 3, y: ARM_Y - 0.9, w: PEN_X - 1.6 - POST.x - 3, d: 1.8, r: 0.2 }, zr - 0.9, 1.8, P, 2), { tone: "mid" }));
  out.push(S_(k.cylinder(PEN_X - 1.2, ARM_Y + 0.4, 1.1, zr - 2.2, 4.4, P, 14), { tone: "mid" }));
  const nib = onDrum(PEN_A, zr, DRUM.r + 0.05);
  out.push(`<circle class="og-nib" cx="${f2(nib[0])}" cy="${f2(nib[1])}" r="1.3"/>`);
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const T0 = 14; // hours: enough paper already written to fill the front
const E0 = etaAt(AMPS0, T0);
const LABEL =
  "A float tide gauge beside a model harbour basin on a bench. Inside the glass-fronted basin a stilling well rises from the floor; water enters it only through a small intake near the bottom, so waves are damped. A float in the well carries a rod up through a guide in the cap; the rod holds an arm that slides on a guide post and ends in a pen resting on a paper drum. The drum sits on a clockwork housing and turns once a day, so the pen draws the tide as a curve. A tide staff marked in metres stands at the front of the basin.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    basinBack(),
    staff(),
    `<g data-og-water class="og-water">${water(E0)}</g>`,
    basinFront(),
    wellTop(),
    recorderBase(),
    guidePost(),
    `<g data-og-drum>${drum(AMPS0, T0)}</g>`,
    drumCap(),
    `<g data-og-arm>${rodAndArm(E0)}</g>`,
  ],
});
const stage = `<div class="iso-stage og-stage" tabindex="0" role="group" aria-roledescription="tide gauge" aria-label="Float tide gauge. Left and right arrows move time by one hour, Space pauses.">${svg}<span class="og-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Float tide gauge",
  hint: "← → hours · space pause",
  readout: readoutOf(AMPS0, T0),
  keys: [
    { mark: "lit", label: "Float rod: rises and falls with the water in the well" },
    { mark: "raised", label: "Drum: one turn a day; grid lines every metre of tide" },
  ],
  caption: "The basin is a 1 : 250 model: one metre of tide moves the water, the rod and the pen by the same 4 units, so the trace is the tide drawn at model scale. The level is the same sum of M2, S2, K1 and O1 as the predictor below, starting at a spring tide; one second of animation is one hour.",
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
.iso${R_} .og-stage{position:relative;outline:none;cursor:default}
.iso${R_} .og-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .og-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .og-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.7;stroke-linecap:round}
.iso${R_} .og-major{stroke:var(--anatomy-mid)}
.iso${R_} .og-hour{fill:none;stroke:var(--anatomy-faint);stroke-width:.6}
.iso${R_} .og-trace{fill:none;stroke:var(--brand,#db2777);stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.iso${R_} .og-nib{fill:var(--brand,#db2777)}
.iso${R_} .og-water{opacity:.78}
.iso${R_} .og-water .iso-fill{fill:color-mix(in oklab,var(--anatomy-blue) 16%,var(--anatomy-paper))}
.iso${R_} .og-water .iso-top{fill:color-mix(in oklab,var(--anatomy-blue) 34%,var(--anatomy-paper))}
.iso${R_} .og-water .iso-shade{fill:color-mix(in oklab,var(--anatomy-blue) 22%,var(--anatomy-paper))}
.iso${R_} .og-water .iso-edge{stroke:color-mix(in oklab,var(--anatomy-blue) 60%,var(--anatomy-paper))}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:9.5px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const liveSrc = `
const k = { pathOf, iso, cylinder, slabOf, sideArc };
const P = ${JSON.stringify(P)};
const view = ${JSON.stringify(view)};
const TIDE = ${JSON.stringify(TIDE)};
const SCALE = ${SCALE}, ETA_MAX = ${ETA_MAX}, WATER0 = ${WATER0}, FLOOR_H = ${FLOOR_H}, ROD_LEN = ${ROD_LEN}, ARM_Y = ${ARM_Y}, PEN_X = ${PEN_X};
const BASIN = ${JSON.stringify(BASIN)}, WELL = ${JSON.stringify(WELL)}, POST = ${JSON.stringify(POST)}, DRUM = ${JSON.stringify(DRUM)}, DN = ${JSON.stringify(DN)};
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const Dots = (points, style) => dotsSvg(points, style);
const etaAt = ${etaAt.toString()};
const clampEta = ${clampEta.toString()};
const readoutOf = ${readoutOf.toString()};
const W_DRUM = (2 * Math.PI) / 24;
const PEN_A = Math.atan2(DN[1], DN[0]);
const facingAt = ${facingAt.toString()};
const onDrum = ${onDrum.toString()};
${water.toString()}
${drum.toString()}
${rodAndArm.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".og-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const g = { water: q("[data-og-water]"), drum: q("[data-og-drum]"), arm: q("[data-og-arm]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let amps = ${JSON.stringify(AMPS0)}, t = ${T0}, paused = false, frame = 0, last = 0, visible = false;
  const RATE = 1; // tide hours per second
  function draw() {
    const e = etaAt(amps, t);
    g.water.innerHTML = water(e);
    g.drum.innerHTML = drum(amps, t);
    g.arm.innerHTML = rodAndArm(e);
    const text = readoutOf(amps, t);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (!paused && !still.matches) t += RATE * dt;
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  document.addEventListener("ocean-tide", (event) => { amps = { ...event.detail }; draw(); });
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { t = Math.max(${T0}, t + (event.key === "ArrowRight" ? 1 : -1)); draw(); say.textContent = readoutOf(amps, t); event.preventDefault(); }
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
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Float tide gauge</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`view ${view.map((v) => v.toFixed(2))} · drum at ${DRUM.x.toFixed(1)},${DRUM.y.toFixed(1)} · η(T0) ${E0.toFixed(2)} m · wrote ${NAME}.*`);
