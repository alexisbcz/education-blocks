// Fig · SCARA pick and place: a four-axis SCARA arm on a bench plate moves
// pucks between two trays. Two horizontal links turn about vertical axes
// (θ₁ at the base, θ₂ at the elbow), and a quill at the tip slides up and
// down. Every target is solved by the same planar IK, and each move is
// timed by a quintic s(τ) = 10τ³ − 15τ⁴ + 6τ⁵. In joint mode both angles
// are interpolated together; in Cartesian mode the tool runs a straight
// line and IK is solved on every frame. The tool's path is traced on the
// plate.
// Run from the repo root: node figures/robotics-scara/build.mjs
// Writes site/static/anatomy/robotics-scara.{html,css,js} and
// figures/robotics-scara/preview{,-light}.html. iso.css is not touched.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });
const NAME = "robotics-scara";

// ---------------------------------------------------------------- model (mm, radians)
const ARM = { a1: 55, a2: 45 };
const Z = { link1: [48, 56], link2: [60, 67], safe: 30, puck: 5, trayTop: 3 };
const TRAY_A = [62, 42], TRAY_B = [-30, 68];
const CELLS = [[-16, -8], [0, -8], [16, -8], [-16, 8], [0, 8], [16, 8]];
const slotOf = (tray, i) => [tray[0] + CELLS[i][0], tray[1] + CELLS[i][1]];
// Planar IK, elbow sign fixed (+1): returns [θ₁, θ₂].
function ik([x, y]) {
  const r2 = x * x + y * y;
  const c2 = Math.max(-1, Math.min(1, (r2 - ARM.a1 ** 2 - ARM.a2 ** 2) / (2 * ARM.a1 * ARM.a2)));
  const t2 = Math.acos(c2);
  return [Math.atan2(y, x) - Math.atan2(ARM.a2 * Math.sin(t2), ARM.a1 + ARM.a2 * Math.cos(t2)), t2];
}
function fk([t1, t2]) {
  const e = [ARM.a1 * Math.cos(t1), ARM.a1 * Math.sin(t1)];
  return { e, p: [e[0] + ARM.a2 * Math.cos(t1 + t2), e[1] + ARM.a2 * Math.sin(t1 + t2)] };
}
const quintic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (10 - 15 * t + 6 * t * t));
// The pick-and-place cycle as a list of moves: xy (at safe height), z, wait.
function cycleOf() {
  const moves = [];
  const order = [0, 1, 2, 3, 4, 5];
  for (const [from, to] of [[TRAY_A, TRAY_B], [TRAY_B, TRAY_A]]) {
    for (const i of order) {
      const a = slotOf(from, i), b = slotOf(to, 5 - i);
      moves.push({ kind: "xy", to: a, label: "to pick" });
      moves.push({ kind: "z", to: Z.trayTop + Z.puck, label: "descend" });
      moves.push({ kind: "grip", from, i, label: "grip" });
      moves.push({ kind: "z", to: Z.safe, label: "lift" });
      moves.push({ kind: "xy", to: b, label: "to place" });
      moves.push({ kind: "z", to: Z.trayTop + Z.puck, label: "descend" });
      moves.push({ kind: "release", to, i: 5 - i, label: "release" });
      moves.push({ kind: "z", to: Z.safe, label: "lift" });
    }
  }
  return moves;
}
const DUR = { xy: 1.25, z: 0.45, grip: 0.3, release: 0.3 };

// ---------------------------------------------------------------- layout (world units = mm, z up)
const WIDTH = 660, HEIGHT = 520;
const PLATE = { x: -64, y: -40, w: 172, d: 140, r: 8 };
const PLATE_H = 8, FOOT_H = 4;
const reach = Array.from({ length: 24 }, (_, i) => [100 * Math.cos((i / 24) * 2 * Math.PI), 100 * Math.sin((i / 24) * 2 * Math.PI), 112]);
const P = k.fitProjection([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...reach.filter(([x, y]) => x > -64 && y > -40)], WIDTH, HEIGHT, { pad: 12, azimuth: 40 });
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => v.toFixed(2);

// convex hull (monotone chain) of plan points
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// A link: the hull of two round ends, extruded between z0 and z1.
function linkSolid(c0, r0, c1, r1, z0, z1) {
  const ring = hull([...circleRing(c0[0], c0[1], r0, 28), ...circleRing(c1[0], c1[1], r1, 28)]);
  return extrude(ring, z0, z1 - z0, P, { convex: true, bevel: 0.6 });
}

// ---------------------------------------------------------------- static parts
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 16)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, 1.4, P, 24), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 4.6, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  // a ruler strip along the front edge, ticks every 2 mm
  const strip = { x: -30, y: PLATE.y + PLATE.d - 11, w: 110, d: 6, r: 0.8 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.6, 0.8, [1.6, 3], P);
  out.push(`<path class="rs-tick" d="${ticks.minor + ticks.major}"/>`);
  // a label plate with three rule lines, back left
  const lp = { x: PLATE.x + 9, y: PLATE.y + 9, w: 22, d: 14, r: 1 };
  out.push(S_(k.slabOf(lp, 0, 0.6, P, 3), { tone: "lo" }));
  out.push(L([0, 1, 2].map((q) => k.lineOnTop([lp.x + 3, lp.y + 3.5 + q * 3.5], [lp.x + lp.w - (q === 2 ? 9 : 3), lp.y + 3.5 + q * 3.5], 0.6, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots(k.corners(lp, 1.4).map(([x, y]) => at([x, y, 0.6])), { size: 0.35, tone: "lo" }));
  // an e-stop box, its mushroom button and the cable to the motor block
  const box = { x: -58, y: -6, w: 16, d: 16, r: 1.6 };
  out.push(L(k.pathOf([[-20, 3, 2.5], [-31, 3, 1], [-31, 2, 1], [-42, 2, 2.5]].map((p) => at(p))), { tone: "mid", className: "rs-cable" }));
  out.push(S_(k.slabOf(box, 0, 9, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 6.5, P, 3), { tone: "faint" }) }));
  out.push(Dots(k.corners(box, 2).map(([x, y]) => at([x, y, 9])), { size: 0.3, tone: "lo" }));
  out.push(S_(k.cylinder(-50, 2, 4.8, 9, 1.2, P, 24), { tone: "mid" }));
  out.push(S_(k.cylinder(-50, 2, 2.4, 10.2, 1.8, P, 16), { tone: "mid" }));
  out.push(S_(k.cylinder(-50, 2, 4.2, 12, 2.6, P, 28, 0.6), { tone: "hi" }));
  // the reach circle engraved on the plate (r = a₁ + a₂), as a faint arc
  out.push(L(k.ring(0, 0, ARM.a1 + ARM.a2, 0, P, 96), { tone: "faint", dashed: true }));
  return out.join("");
}
function tray(c, name) {
  const plan = { x: c[0] - 26, y: c[1] - 16, w: 52, d: 32, r: 2.5 };
  const out = [S_(k.slabOf(plan, 0, Z.trayTop, P, 4, 0.6), { tone: "mid" })];
  out.push(L(CELLS.map(([dx, dy]) => k.ring(c[0] + dx, c[1] + dy, 6.8, Z.trayTop, P, 28)).join(""), { tone: "lo" }));
  out.push(Dots(k.corners(plan, 2.2).map(([x, y]) => at([x, y, Z.trayTop])), { size: 0.35, tone: "lo" }));
  // a location pin at one corner, so the tray can only sit one way
  out.push(S_(k.cylinder(plan.x + plan.w - 3, plan.y + 3, 1, Z.trayTop, 1.6, P, 12), { tone: "hi", crease: "none" }));
  return `<g data-tray="${name}">${out.join("")}</g>`;
}
function base() {
  const out = [];
  const blk = { x: -20, y: -20, w: 40, d: 40, r: 4 };
  out.push(S_(k.slabOf(blk, 0, 10, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(blk, 6, P, 6), { tone: "faint" }) }));
  out.push(Dots(k.corners(blk, 4).map(([x, y]) => at([x, y, 10])), { size: 0.45, tone: "lo" }));
  out.push(L(k.corners(blk, 4).map(([x, y]) => k.ring(x, y, 1.6, 10, P, 14)).join(""), { tone: "lo" }));
  // a cable gland on the block's top
  out.push(S_(k.cylinder(-12, 12, 2.6, 10, 2.2, P, 16), { tone: "mid" }));
  out.push(S_(k.cylinder(0, 0, 13, 10, 34, P, 40), { tone: "mid", inner: L(k.sideSeam({ x: -13, y: -13, w: 26, d: 26, r: 13 }, 30, P, 12), { tone: "faint" }) }));
  out.push(S_(k.cylinder(0, 0, 15, 44, 4, P, 40, 0.5), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving parts (also run in the page)
function linkOne(q) {
  const { e } = fk(q);
  const out = [];
  out.push(S_(linkSolid([0, 0], 13, e, 10, Z.link1[0], Z.link1[1]), { tone: "hi" }));
  // the θ₁ motor cap with its bolt circle, and the elbow spacer
  out.push(S_(cylinder(0, 0, 9, Z.link1[1], 4, P, 32, 0.4), { tone: "mid" }));
  out.push(Dots(Array.from({ length: 6 }, (_, i) => iso([6.5 * Math.cos(q[0] + (i * Math.PI) / 3), 6.5 * Math.sin(q[0] + (i * Math.PI) / 3), Z.link1[1] + 4], P)), { size: 0.4, tone: "lo" }));
  out.push(S_(cylinder(e[0], e[1], 7, Z.link1[1], Z.link2[0] - Z.link1[1], P, 28), { tone: "mid" }));
  // a cover seam along the link
  const mid = [e[0] * 0.55, e[1] * 0.55];
  const n = [-Math.sin(q[0]), Math.cos(q[0])], w = 10.5;
  out.push(lineSvg(pathOf([iso([mid[0] - w * n[0], mid[1] - w * n[1], Z.link1[1]], P), iso([mid[0] + w * n[0], mid[1] + w * n[1], Z.link1[1]], P)]), { tone: "faint" }));
  return out.join("");
}
function housingLow(q) {
  const { p } = fk(q);
  return S_(cylinder(p[0], p[1], 6.5, Z.link1[1], Z.link2[0] - Z.link1[1], P, 28), { tone: "mid" });
}
function linkTwo(q) {
  const { e, p } = fk(q);
  const out = [];
  out.push(S_(linkSolid(e, 10, p, 8.5, Z.link2[0], Z.link2[1]), { tone: "hi" }));
  // the θ₂ motor on the elbow, with a bolt circle that turns with link 2
  out.push(S_(cylinder(e[0], e[1], 8, Z.link2[1], 9, P, 32, 0.5), { tone: "mid" }));
  const a = q[0] + q[1];
  out.push(Dots(Array.from({ length: 4 }, (_, i) => iso([e[0] + 5.5 * Math.cos(a + (i * Math.PI) / 2 + Math.PI / 4), e[1] + 5.5 * Math.sin(a + (i * Math.PI) / 2 + Math.PI / 4), Z.link2[1] + 9], P)), { size: 0.4, tone: "lo" }));
  // the ball-spline nut over the quill
  out.push(S_(cylinder(p[0], p[1], 6.5, Z.link2[1], 13, P, 28, 0.5), { tone: "mid", inner: lineSvg(ring(p[0], p[1], 3.2, Z.link2[1] + 13, P, 20), { tone: "lo" }) }));
  return out.join("");
}
// The quill below the nut: the rod, the tool flange, the suction cup and
// (when carried) a puck. zb is the bottom of the cup.
function quillLow(q, zb, carried) {
  const { p } = fk(q);
  const out = [];
  if (carried) out.push(puck(p, zb - Z.puck));
  out.push(S_(cylinder(p[0], p[1], 3.2, zb, 2, P, 20), { tone: "lo" }));
  out.push(S_(cylinder(p[0], p[1], 4.6, zb + 2, 3, P, 24, 0.4), { tone: "mid" }));
  out.push(S_(cylinder(p[0], p[1], 2, zb + 5, Z.link1[1] - zb - 5, P, 16), { tone: "hi", crease: "none", lit: true }));
  return out.join("");
}
const QUILL = 78; // rod length above the flange
function quillTop(q, zb) {
  const { p } = fk(q);
  const top = zb + 5 + QUILL, z0 = Z.link2[1] + 13;
  if (top <= z0) return "";
  return S_(cylinder(p[0], p[1], 2, z0, top - z0, P, 16), { tone: "hi", crease: "none", lit: true }) + S_(cylinder(p[0], p[1], 3, top, 1.4, P, 16), { tone: "mid" });
}
function puck([x, y], z) {
  return S_(cylinder(x, y, 6, z, Z.puck, P, 32, 0.5), { tone: "hi", inner: lineSvg(ring(x, y, 2.4, z + Z.puck, P, 20), { tone: "lo" }) });
}
function pucks(list) {
  return [...list].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P)).map((c) => puck(c, c[2] ?? Z.trayTop)).join("");
}
function trace(pts) {
  if (pts.length < 2) return "";
  return `<path class="rs-trace" d="${pathOf(pts.map(([x, y]) => iso([x, y, 0], P)))}"/>`;
}
// Which slot the low part of the quill goes in: behind the column, between
// the column and link 1, or in front of both.
function slotOfQuill(q) {
  const { e, p } = fk(q);
  const d = depthOf([p[0], p[1], 0], P);
  if (d < depthOf([0, 0, 0], P) && Math.hypot(p[0], p[1]) < 60) return 0;
  // the nearest point on link 1's centre line
  const t = Math.max(0, Math.min(1, (p[0] * e[0] + p[1] * e[1]) / (e[0] ** 2 + e[1] ** 2)));
  const n = [e[0] * t, e[1] * t];
  if (Math.hypot(p[0] - n[0], p[1] - n[1]) < 30 && d < depthOf([n[0], n[1], 0], P)) return 1;
  return 2;
}
const readoutOf = (mode, q, zb, label) => `${mode.padEnd(10, " ")}· θ₁ ${((q[0] * 180) / Math.PI).toFixed(0).padStart(4, " ")}° · θ₂ ${((q[1] * 180) / Math.PI).toFixed(0).padStart(4, " ")}° · z ${zb.toFixed(0).padStart(2, " ")} · ${label}`;

// ---------------------------------------------------------------- assemble the rest pose
const { circleRing, extrude, cylinder, iso, depthOf, pathOf, lineSvg, ring } = k;
const Q0 = ik([20, 70]);
const PUCKS0 = CELLS.map((_, i) => slotOf(TRAY_A, i));
const slot0 = slotOfQuill(Q0);
const LABEL =
  "A SCARA robot on a bench plate. A motor block and round column carry the first link, which turns about a vertical axis; the second link sits on top of it and turns at the elbow. At its tip a quill slides up and down through a ball-spline nut and carries a suction cup. Six pucks sit in a tray on the right, and an empty tray waits on the left; the arm moves them one by one, and a pink line on the plate traces the path of the tool.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    `<g data-rs-trace></g>`,
    tray(TRAY_A, "a"),
    tray(TRAY_B, "b"),
    `<g data-rs-pucks>${pucks(PUCKS0)}</g>`,
    `<g data-rs-q0>${slot0 === 0 ? quillLow(Q0, Z.safe, false) : ""}</g>`,
    base(),
    `<g data-rs-q1>${slot0 === 1 ? quillLow(Q0, Z.safe, false) : ""}</g>`,
    `<g data-rs-link1>${linkOne(Q0)}</g>`,
    `<g data-rs-q2>${slot0 === 2 ? quillLow(Q0, Z.safe, false) : ""}</g>`,
    `<g data-rs-hlow>${housingLow(Q0)}</g>`,
    `<g data-rs-link2>${linkTwo(Q0)}</g>`,
    `<g data-rs-qtop>${quillTop(Q0, Z.safe)}</g>`,
  ],
});
const stage = `<div class="iso-stage rs-stage" tabindex="0" role="group" aria-roledescription="robot control" aria-label="SCARA arm. J switches between joint and Cartesian interpolation; Space pauses.">${svg}<span class="rs-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "SCARA pick and place",
  hint: "J joint / Cartesian · space pause",
  readout: readoutOf("joint", Q0, Z.safe, "ready"),
  keys: [
    { mark: "lit", label: `Links a₁ = ${ARM.a1} mm, a₂ = ${ARM.a2} mm; reach ${ARM.a1 + ARM.a2} mm` },
    { mark: "lit", label: "Pink: the tool's path, projected on the plate" },
  ],
  caption: "Both modes use the same quintic timing and the same IK at the end points. In joint mode, θ₁ and θ₂ each change linearly in s, so the tool sweeps an arc. In Cartesian mode, the tool's (x, y) changes linearly in s, and the joints follow whatever IK demands, so the path is straight.",
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
.iso${R_} .rs-stage{position:relative;outline:none;cursor:default}
.iso${R_} .rs-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .rs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .rs-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.7;stroke-linecap:round}
.iso${R_} .rs-cable{stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}
.iso${R_} .rs-trace{fill:none;stroke:var(--brand,#db2777);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:9px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const liveSrc = `
const P = ${JSON.stringify(P)};
const ARM = ${JSON.stringify(ARM)}, Z = ${JSON.stringify(Z)}, TRAY_A = ${JSON.stringify(TRAY_A)}, TRAY_B = ${JSON.stringify(TRAY_B)}, CELLS = ${JSON.stringify(CELLS)}, DUR = ${JSON.stringify(DUR)}, QUILL = ${QUILL};
const S_ = (paths, style) => solidSvg(paths, style);
const Dots = (points, style) => dotsSvg(points, style);
const slotOf = ${slotOf.toString()};
${ik.toString()}
${fk.toString()}
const quintic = ${quintic.toString()};
${cycleOf.toString()}
${hull.toString()}
${linkSolid.toString()}
${linkOne.toString()}
${housingLow.toString()}
${linkTwo.toString()}
${quillLow.toString()}
${quillTop.toString()}
${puck.toString()}
${pucks.toString()}
${trace.toString()}
${slotOfQuill.toString()}
const readoutOf = ${readoutOf.toString()};

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".rs-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const g = Object.fromEntries(["trace", "pucks", "q0", "q1", "link1", "q2", "hlow", "link2", "qtop"].map((n) => [n, svg.querySelector("[data-rs-" + n + "]")]));
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const moves = cycleOf();
  let mode = "joint", m = 0, t = 0, q = ik([20, 70]), zb = Z.safe, xy = fk(q).p, carried = false, paused = false, frame = 0, last = 0, visible = false;
  let held = { a: CELLS.map((_, i) => true), b: CELLS.map(() => false) };
  let start = null, path = [];
  const trays = { a: TRAY_A, b: TRAY_B };
  const trayName = (tr) => (tr === TRAY_A ? "a" : "b");
  function begin() {
    const mv = moves[m];
    start = { q: [...q], xy: [...xy], z: zb };
    if (mv.kind === "xy") {
      const goal = ik(mv.to);
      // the shortest way round for θ₁
      let d1 = goal[0] - q[0];
      d1 = Math.atan2(Math.sin(d1), Math.cos(d1));
      start.qGoal = [q[0] + d1, goal[1]];
      path = [[...xy]];
    }
  }
  function advance(dt) {
    let mv = moves[m];
    if (!start) begin();
    t += dt;
    const T = DUR[mv.kind];
    const s = quintic(t / T);
    if (mv.kind === "xy") {
      if (mode === "joint") q = [start.q[0] + s * (start.qGoal[0] - start.q[0]), start.q[1] + s * (start.qGoal[1] - start.q[1])];
      else q = ik([start.xy[0] + s * (mv.to[0] - start.xy[0]), start.xy[1] + s * (mv.to[1] - start.xy[1])]);
      xy = fk(q).p;
      path.push([...xy]);
    } else if (mv.kind === "z") {
      zb = start.z + s * (mv.to - start.z);
    }
    if (t >= T) {
      if (mv.kind === "grip") { carried = true; held[trayName(mv.from)][mv.i] = false; }
      if (mv.kind === "release") { carried = false; held[trayName(mv.to)][mv.i] = true; }
      t = 0; start = null;
      m = (m + 1) % moves.length;
    }
  }
  function draw() {
    const low = carried && zb < Z.trayTop + Z.puck + 6;
    const list = [];
    for (const name of ["a", "b"]) held[name].forEach((h, i) => { if (h) list.push(slotOf(trays[name], i)); });
    const tip = fk(q).p;
    g.trace.innerHTML = trace(path);
    // a carried puck near the tray sorts with the others 
    g.pucks.innerHTML = low ? pucks([...list, [tip[0], tip[1], zb - Z.puck]]) : pucks(list);
    const slot = slotOfQuill(q);
    const ql = quillLow(q, zb, carried && !low);
    g.q0.innerHTML = slot === 0 ? ql : "";
    g.q1.innerHTML = slot === 1 ? ql : "";
    g.q2.innerHTML = slot === 2 ? ql : "";
    g.link1.innerHTML = linkOne(q);
    g.hlow.innerHTML = housingLow(q);
    g.link2.innerHTML = linkTwo(q);
    g.qtop.innerHTML = quillTop(q, zb);
    const text = readoutOf(mode === "joint" ? "joint" : "Cartesian", q, zb, moves[m].label);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && !still.matches) advance(dt);
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  const toggleMode = () => {
    mode = mode === "joint" ? "cartesian" : "joint";
    say.textContent = mode === "joint" ? "Joint interpolation: the tool sweeps an arc." : "Cartesian interpolation: the tool runs a straight line.";
    draw();
  };
  root.addEventListener("robo-scara-mode", (e) => { if (e.detail !== mode) toggleMode(); });
  stage.addEventListener("keydown", (event) => {
    if (event.key === "j" || event.key === "J") { toggleMode(); event.preventDefault(); }
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
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SCARA pick and place</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
// checks: IK round trip on every slot, every slot within reach
let worst = 0;
for (const tr of [TRAY_A, TRAY_B]) for (let i = 0; i < 6; i++) { const s = slotOf(tr, i); const p = fk(ik(s)).p; worst = Math.max(worst, Math.hypot(p[0] - s[0], p[1] - s[1])); }
console.log(`wrote ${NAME}.* · FK(IK) worst ${worst.toExponential(2)} mm · slot0 ${slot0}`);
