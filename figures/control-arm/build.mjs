// Fig · Two-joint robot arm — a shoulder and an elbow servo on a turret, on a
// bench plate, carrying a ball in its gripper. One inverse-kinematics model
// (the same one as the 2-link IK block in site/static/js/control.js) turns a
// target point into the two joint angles that move the links.
// Run from the repo root: node figures/control-arm/build.mjs
// Writes site/static/anatomy/{control-arm.html, control-arm.css, control-arm.js}
// and figures/control-arm/preview{,-light}.html. The shared iso.css is not
// touched: control-arm.css carries the kit CSS scoped under
// [data-anatomy="control-arm"], plus the figure's own rules.
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
// World units are millimetres. The arm moves in the plane y = 0 (offsets in
// y only separate the parts). Shoulder axis at (0, Z0); the end effector is
// the ball's centre, L2 from the elbow.
const ARM = { L1: 90, L2: 80, Z0: 70, rMin: 40 };
// Inverse kinematics of a planar 2-link arm. Returns both joint angles in
// radians, the reachable target actually used, and the elbow point.
function ik(tx, tz, up, A) {
  let x = tx, z = tz - A.Z0;
  let r = Math.hypot(x, z);
  const rMax = A.L1 + A.L2 - 0.01;
  if (r > rMax || r < A.rMin) {
    const s = Math.min(rMax, Math.max(A.rMin, r)) / (r || 1);
    x *= s; z *= s; r = Math.hypot(x, z);
  }
  const c = Math.max(-1, Math.min(1, (r * r - A.L1 * A.L1 - A.L2 * A.L2) / (2 * A.L1 * A.L2)));
  const q2 = (up ? -1 : 1) * Math.acos(c);
  const q1 = Math.atan2(z, x) - Math.atan2(A.L2 * Math.sin(q2), A.L1 + A.L2 * Math.cos(q2));
  const ex = A.L1 * Math.cos(q1), ez = A.Z0 + A.L1 * Math.sin(q1);
  return { q1, q2, x, z: z + A.Z0, ex, ez };
}

// ---------------------------------------------------------------- camera and layout
const WIDTH = 600, HEIGHT = 470;
const PLATE = { x: -70, y: -52, w: 280, d: 104, r: 8 };
const PLATE_H = 10, FOOT_H = 5;
const POST = { x: 186, y: -40, w: 10, d: 8, r: 1 }, POST_H = 168;
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POST.x + 10, POST.y, POST_H + 6], [40, 0, 172], [150, 0, 172]],
  WIDTH,
  HEIGHT,
  { pad: 10, azimuth: 58 },
);
const view = k.towardViewer(P);
const SY = view[1] > 0 ? 1 : -1; // +1 when the viewer is on the +y side
const at = (p) => k.iso(p, P);
const f2 = (v) => v.toFixed(2);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
// y offsets of each layer, measured toward the viewer.
const Y = { servoBack: -23, servoFront: -10, yokeBack: [-10, -6], link1: [-5, 5], elbowServo: [-14, -5], spacer: [5, 11], link2: [11, 18], yokeFront: [6, 10], cap: [10, 12] };
const yy = (v) => v * SY;
const span = ([a, b]) => (SY > 0 ? [a, b] : [-b, -a]);
// A frame whose (u, v) are world (x, z), with its axis toward the viewer, so a
// prism between s0 and s1 occupies y = s0·SY … s1·SY.
// frameOf is (o, a, u, v) and must be right-handed (u × v = a), so the
// polygon's (x, z) map to (u, v) or (v, u) depending on the viewer's side.
const PLANE = SY > 0 ? G.frameOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]) : G.frameOf([0, 0, 0], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
const prismXZ = (poly, s0, s1) => G.prismOf(PLANE, SY > 0 ? poly.map(([x, z]) => [z, x]) : poly, s0, s1, P);
const AXLE = (x, z) => G.frameAlong([x, 0, z], [0, SY, 0]);

// ---------------------------------------------------------------- base
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf ? k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P) : ""}"/>`];
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
  // label plate, back left
  const label = { x: -60, y: yy(-36) - 8, w: 44, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([28, 18, 32].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

// The back post: a height scale with ticks every 10 mm (major every 50) on
// its face toward the viewer, and a collar that marks the target's height.
const POST_PLAN = { ...POST, y: yy(-40) - POST.d / 2, r: 0 };
const POST_FACE = SY > 0 ? POST_PLAN.y + POST_PLAN.d : POST_PLAN.y;
function backPost() {
  const out = [];
  const foot = { x: POST.x - 6, y: POST_PLAN.y - 6, w: 22, d: 20, r: 1.6 };
  out.push(S_(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(Dots(k.corners(foot, 3).map(([x, y]) => at([x, y, 4])), { size: 0.45, tone: "lo" }));
  out.push(S_(k.slabOf(POST_PLAN, 4, POST_H - 4, P, 1, 0), { tone: "mid" }));
  const ticks = [];
  for (let z = 10; z <= 150; z += 10) {
    const len = z % 50 === 0 ? 5 : 2.6;
    ticks.push(k.pathOf([at([POST.x, POST_FACE, z]), at([POST.x + len, POST_FACE, z])]));
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  // an index dot at the end of each major tick (every 50 mm)
  out.push(Dots([50, 100, 150].map((z) => at([POST.x + 5.6, POST_FACE, z])), { size: 0.55, tone: "mid" }));
  out.push(S_(k.cylinder(POST.x + POST.w / 2, POST_PLAN.y + POST.d / 2, 6, POST_H, 3, P, 24), { tone: "mid" }));
  return out.join("");
}
function collar(z) {
  const c = { x: POST.x - 2, y: POST_PLAN.y - 2, w: POST.w + 4, d: POST.d + 4, r: 0 };
  return S_(k.slabOf(c, z - 3, 6, P, 1, 0), { tone: "hi" }) + L(k.lineOnTop([c.x + c.w / 2, c.y], [c.x + c.w / 2, c.y + c.d], z + 3, P), { tone: "lit" });
}

// The front ruler: a strip along x with ticks every 5 mm (major every 25),
// and a carriage that marks the target's x.
const RULER = { x: 10, y: yy(36) - 5, w: 170, d: 10, r: 1 };
const RULER_EDGE = SY > 0 ? RULER.y : RULER.y + RULER.d;
function ruler() {
  const out = [S_(k.slabOf(RULER, 0, 1.6, P, 3, 0.3), { tone: "lo" })];
  const t = k.topTicks(15, 175, 5, 5, RULER_EDGE, 1.6, [2.5 * SY, 5 * SY], P, "x");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  return out.join("");
}
function carriage(x) {
  const c = { x: x - 5, y: RULER.y - 1, w: 10, d: RULER.d + 2, r: 1.2 };
  return S_(k.slabOf(c, 1.6, 4.4, P, 3, 0.4), { tone: "hi" }) + L(k.lineOnTop([x, c.y], [x, c.y + c.d], 6, P), { tone: "lit" });
}

// The turret: a flange with a bolt circle, a column and a saddle block that
// carries the two yoke plates.
const TOP_COL = ARM.Z0 - 26;
function turret() {
  const out = [];
  out.push(S_(k.cylinder(0, 0, 26, 0, 5, P, 48, 0.6), { tone: "mid" }));
  const bolts = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; bolts.push(at([20 * Math.cos(a), 20 * Math.sin(a), 5])); }
  out.push(Dots(bolts, { size: 0.5, tone: "lo" }));
  out.push(S_(k.cylinder(0, 0, 15, 5, TOP_COL - 5, P, 40, 0.4), { tone: "mid", inner: L(k.sideArc(0, 0, 15, 14, P, 40) + k.sideArc(0, 0, 15, TOP_COL - 8, P, 40), { tone: "faint" }) }));
  const saddle = { x: -13, y: -12, w: 26, d: 24, r: 2 };
  out.push(S_(k.slabOf(saddle, TOP_COL, 5, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(saddle, TOP_COL + 2.5, P, 4), { tone: "faint" }) }));
  return out.join("");
}
function yokePlate([a, b]) {
  const [y0, y1] = span([a, b]);
  const plan = { x: -11, y: y0, w: 22, d: y1 - y0, r: 1 };
  return S_(k.slabOf(plan, TOP_COL + 5, ARM.Z0 + 13 - (TOP_COL + 5), P, 3, 0.4), { tone: "mid" });
}
function shoulderServo() {
  const [y0, y1] = span([Y.servoBack, Y.servoFront]);
  const box = { x: -15, y: y0, w: 30, d: y1 - y0, r: 1.6 };
  const out = [S_(k.slabOf(box, ARM.Z0 - 18, 32, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(box, ARM.Z0 + 6, P, 4), { tone: "faint" }) })];
  // mounting ears and screws, left and right
  for (const ex of [-21, 15]) {
    const ear = { x: ex, y: y0 + 2, w: 6, d: y1 - y0 - 4, r: 0.8 };
    out.push(S_(k.slabOf(ear, ARM.Z0 + 2, 2, P, 3), { tone: "lo" }));
    out.push(Dots([at([ex + 3, (y0 + y1) / 2, ARM.Z0 + 4])], { size: 0.5, tone: "lo" }));
  }
  return out.join("");
}
function shoulderCap() {
  const F = AXLE(0, ARM.Z0);
  const [s0, s1] = Y.cap;
  return S_(G.disc(s0, s1, 7, F, P), { tone: "mid" }) + Dots(G.dotsOf(F, s1, 4.4, 4, P, { all: true }), { size: 0.45, tone: "lo" });
}

// ---------------------------------------------------------------- moving parts
// A link is a capsule between two points of the plane, extruded across y.
function capsule(ax, az, bx, bz, w, n = 10) {
  const d = Math.atan2(bz - az, bx - ax);
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = d + Math.PI / 2 + (i / n) * Math.PI; pts.push([bx + w * Math.cos(a - Math.PI), bz + w * Math.sin(a - Math.PI)]); }
  for (let i = 0; i <= n; i++) { const a = d + Math.PI / 2 + (i / n) * Math.PI; pts.push([ax + w * Math.cos(a), az + w * Math.sin(a)]); }
  return pts;
}
// The outline of a polygon of the plane, drawn on the face y = s·SY.
const faceLine = (poly, s) => k.pathOf(poly.map(([x, z]) => iso([x, s * SY, z], P)), true);
function poseOf(tx, tz, up) {
  const s = ik(tx, tz, up, ARM);
  const a2 = s.q1 + s.q2;
  return { ...s, a2, bx: s.ex + ARM.L2 * Math.cos(a2), bz: s.ez + ARM.L2 * Math.sin(a2) };
}
// Behind the front yoke: the elbow servo, link 1, its cable connector and the cable.
function armBack(pose) {
  const out = [];
  const { ex, ez, q1 } = pose;
  const dx = Math.cos(q1), dz = Math.sin(q1);
  const Fe = AXLE(ex, ez);
  out.push(S_(G.disc(Y.elbowServo[0], Y.elbowServo[1], 13, Fe, P), { tone: "mid", inner: L(G.circleOf(Fe, Y.elbowServo[0], 9.5, P), { tone: "faint" }) }));
  const link = capsule(0, ARM.Z0, ex, ez, 9);
  out.push(S_(prismXZ(link, Y.link1[0], Y.link1[1]), { tone: "hi" }));
  // lightening slot on the near face
  const slot = capsule(dx * 24, ARM.Z0 + dz * 24, dx * 60, ARM.Z0 + dz * 60, 3.6, 8);
  out.push(L(faceLine(slot, Y.link1[1]), { tone: "lo" }));
  // four screws holding the link's horn plates, two at each end
  const nx1 = -dz, nz1 = dx;
  const screws = [12, 78].flatMap((d) => [1, -1].map((side) => iso([dx * d + nx1 * 5 * side, Y.link1[1] * SY, ARM.Z0 + dz * d + nz1 * 5 * side], P)));
  out.push(Dots(screws, { size: 0.5, tone: "lo" }));
  // connector block near the elbow, and the cable from the saddle to it
  const cx = dx * 72, cz = ARM.Z0 + dz * 72;
  const box = capsule(cx - dx * 4, cz - dz * 4, cx + dx * 4, cz + dz * 4, 3.4, 4);
  out.push(S_(prismXZ(box, Y.link1[1], Y.link1[1] + 2.4), { tone: "mid" }));
  const nx = -dz, nz = dx; // normal to the link, upward side
  const from = at([0, (SY > 0 ? 12 : -12), TOP_COL + 2.5]);
  const clip = at([dx * 34 + nx * 4.6, Y.link1[1] * SY, ARM.Z0 + dz * 34 + nz * 4.6]);
  const to = at([cx - dx * 4.2, (Y.link1[1] + 1.2) * SY, cz - dz * 4.2]);
  out.push(k.wireSvg(from, to, { via: [clip], tone: "mid", size: 1.1 }));
  return out.join("");
}
// In front of the yoke: the elbow spacer, link 2, the wrist, the jaws and the ball.
function armFront(pose) {
  const out = [];
  const { ex, ez, a2, bx, bz } = pose;
  const dx = Math.cos(a2), dz = Math.sin(a2), nx = -dz, nz = dx;
  const Fe = AXLE(ex, ez);
  out.push(S_(G.disc(Y.spacer[0], Y.spacer[1], 7, Fe, P), { tone: "mid" }));
  const end = ARM.L2 - 17;
  out.push(S_(prismXZ(capsule(ex, ez, ex + dx * end, ez + dz * end, 7.5), Y.link2[0], Y.link2[1]), { tone: "hi" }));
  // a stiffening groove along the near face of link 2
  out.push(L(faceLine(capsule(ex + dx * 14, ez + dz * 14, ex + dx * (end - 8), ez + dz * (end - 8), 2.6, 8), Y.link2[1]), { tone: "lo" }));
  out.push(S_(G.disc(Y.link2[1], Y.link2[1] + 1.6, 4, Fe, P), { tone: "mid" }) + Dots([iso([ex, (Y.link2[1] + 1.6) * SY, ez], P)], { size: 0.55, tone: "lo" }));
  // wrist block across the end of link 2
  const wx = ex + dx * (ARM.L2 - 15), wz = ez + dz * (ARM.L2 - 15);
  const wrist = [[wx + nx * 11, wz + nz * 11], [wx + nx * 11 + dx * 6, wz + nz * 11 + dz * 6], [wx - nx * 11 + dx * 6, wz - nz * 11 + dz * 6], [wx - nx * 11, wz - nz * 11]];
  out.push(S_(prismXZ(wrist, Y.link2[0] - 0.5, Y.link2[1] + 0.5), { tone: "mid" }));
  out.push(Dots([1, -1].map((side) => iso([wx + dx * 3 + nx * 8 * side, (Y.link2[1] + 0.5) * SY, wz + dz * 3 + nz * 8 * side], P)), { size: 0.45, tone: "lo" }));
  // two jaws closed on the ball
  for (const side of [1, -1]) {
    const o = 8.4 * side;
    const j0 = [wx + dx * 6 + nx * o, wz + dz * 6 + nz * o];
    const jaw = [[j0[0] - nx * 1.4 * side, j0[1] - nz * 1.4 * side], [j0[0] + nx * 1.6 * side, j0[1] + nz * 1.6 * side], [bx + dx * 5 + nx * (o + 1.8 * side), bz + dz * 5 + nz * (o + 1.8 * side)], [bx + dx * 5 + nx * (o - 1.4 * side), bz + dz * 5 + nz * (o - 1.4 * side)]];
    out.push(S_(prismXZ(jaw, Y.link2[0] + 1, Y.link2[1] - 1), { tone: "mid" }));
  }
  out.push(S_(G.sphereOf([bx, ((Y.link2[0] + Y.link2[1]) / 2) * SY, bz], 6.6, P), { tone: "hi", lit: true }));
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const T0 = { x: 120, z: 70 }; // the resting target
const iso = k.iso;
const pose0 = poseOf(T0.x, T0.z, true);
const deg = (r) => (r * 180) / Math.PI;
const readoutOf = (pose, up) => `x ${pose.bx.toFixed(0)} · z ${pose.bz.toFixed(0)} mm · θ1 ${deg(pose.q1).toFixed(1)}° · θ2 ${deg(pose.q2).toFixed(1)}° · elbow ${up ? "up" : "down"}`;

const LABEL =
  "A two-joint robot arm on a bench plate. A turret column carries a saddle and two yoke plates; the shoulder servo sits behind them and turns the first link. An elbow servo at the end of the first link turns the second link, which ends in a wrist block and two jaws holding a ball. A cable runs from the saddle along the first link to a connector near the elbow. A height post at the back and a ruler at the front each carry a marker at the target's height and position.";

const stage = (svg) => `<div class="iso-stage ca-stage" tabindex="0" role="group" aria-roledescription="robot arm control" aria-label="Two-joint robot arm. Arrow keys move the target 4 millimetres (Shift: 20); E switches elbow up and down; Space pauses the tour.">${svg}<span class="ca-sr" aria-live="polite" data-say></span></div>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    backPost(),
    `<g data-ca-collar>${collar(pose0.bz)}</g>`,
    turret(),
    shoulderServo(),
    yokePlate(Y.yokeBack),
    `<g data-ca-back>${armBack(pose0)}</g>`,
    yokePlate(Y.yokeFront),
    shoulderCap(),
    `<g data-ca-front>${armFront(pose0)}</g>`,
    ruler(),
    `<g data-ca-carriage>${carriage(pose0.bx)}</g>`,
  ],
});

const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Two-joint robot arm",
  hint: "point · arrows move target · E elbow",
  readout: readoutOf(pose0, true),
  keys: [
    { mark: "lit", label: "End effector: the ball, at the target" },
    { mark: "dim", label: "Markers: the target's x on the ruler, z on the post" },
  ],
  caption: `Link lengths ${ARM.L1} mm and ${ARM.L2} mm, shoulder ${ARM.Z0} mm above the bench. For a target (x, z), the elbow angle comes from the law of cosines, cos θ2 = (r² − L1² − L2²) / (2 L1 L2) with r the distance from the shoulder, and θ1 = atan2(z, x) − atan2(L2 sin θ2, L1 + L2 cos θ2). Every reachable target has two solutions, elbow up and elbow down; targets outside the annulus ${ARM.rMin}–${ARM.L1 + ARM.L2} mm are pulled to its edge.`,
  body: stage(svg),
});
const fragment = `<div class="iso" data-anatomy="control-arm">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="control-arm"]
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
const R_ = '[data-anatomy="control-arm"]';
const FIGURE_CSS = `
.iso${R_}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso${R_}[data-theme="light"],html:not(.dark) .iso${R_}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso${R_} .iso-figure{margin:0}
.iso${R_} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R_} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .ca-stage{position:relative;outline:none;cursor:crosshair;touch-action:pan-y}
.iso${R_} .ca-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .ca-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:10px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script (plain ES module)
// Screen → plane y = 0: iso() is affine, so two basis vectors invert it.
const o0 = at([0, 0, 0]), ex0 = at([1, 0, 0]), ez0 = at([0, 0, 1]);
const INV = { o: o0, ax: [ex0[0] - o0[0], ex0[1] - o0[1]], az: [ez0[0] - o0[0], ez0[1] - o0[1]] };
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameOf, frameAlong, disc, circleOf, dotsOf, prismOf, sphereOf }; })();
const k = { solidSvg, lineSvg, dotsSvg, wireSvg, pathOf, depthOf, iso, slabOf, lineOnTop };
const P = ${JSON.stringify(P)};
const ARM = ${JSON.stringify(ARM)}, Y = ${JSON.stringify(Y)}, SY = ${SY}, TOP_COL = ${TOP_COL};
const POST = ${JSON.stringify(POST)}, POST_PLAN = ${JSON.stringify(POST_PLAN)}, POST_FACE = ${POST_FACE}, RULER = ${JSON.stringify(RULER)};
const INV = ${JSON.stringify(INV)};
const PLANE = SY > 0 ? G.frameOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]) : G.frameOf([0, 0, 0], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
const prismXZ = (poly, s0, s1) => G.prismOf(PLANE, SY > 0 ? poly.map(([x, z]) => [z, x]) : poly, s0, s1, P);
const AXLE = (x, z) => G.frameAlong([x, 0, z], [0, SY, 0]);
const at = (p) => iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const faceLine = (poly, s) => k.pathOf(poly.map(([x, z]) => iso([x, s * SY, z], P)), true);
const ik = ${ik.toString()};
${capsule.toString()}
${poseOf.toString()}
${armBack.toString()}
${armFront.toString()}
${collar.toString()}
${carriage.toString()}
const deg = (r) => (r * 180) / Math.PI;
const readoutOf = ${readoutOf.toString()};

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".ca-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const back = svg.querySelector("[data-ca-back]"), front = svg.querySelector("[data-ca-front]");
  const col = svg.querySelector("[data-ca-collar]"), car = svg.querySelector("[data-ca-carriage]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  // The target follows the goal smoothly (exponential follow, ~0.25 s).
  let goal = { x: 120, z: 70 }, cur = { ...goal }, up = true, paused = false, held = 0, t = 0, frame = 0, last = 0, visible = false;

  function draw() {
    const pose = poseOf(cur.x, cur.z, up);
    back.innerHTML = armBack(pose);
    front.innerHTML = armFront(pose);
    col.innerHTML = collar(pose.bz);
    car.innerHTML = carriage(pose.bx);
    const text = readoutOf(pose, up);
    if (readout.textContent !== text) readout.textContent = text;
    return pose;
  }
  // Idle tour: an ellipse through the reachable workspace, one lap in 12 s.
  const tour = (s) => ({ x: 105 + 50 * Math.cos(s), z: 85 + 45 * Math.sin(s) });
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (!paused && performance.now() > held) { t += dt * (Math.PI * 2) / 12; goal = tour(t); }
    const a = 1 - Math.exp(-dt / 0.25);
    cur.x += (goal.x - cur.x) * a; cur.z += (goal.z - cur.z) * a;
    draw();
    const moving = Math.abs(goal.x - cur.x) + Math.abs(goal.z - cur.z) > 0.05;
    frame = visible && (moving || (!paused && !still.matches)) ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  const setGoal = (g, instant) => {
    goal = { x: Math.max(-40, Math.min(175, g.x)), z: Math.max(8, Math.min(165, g.z)) };
    held = performance.now() + 4000;
    if (instant || still.matches) { cur = { ...goal }; draw(); }
    run();
  };
  stage.addEventListener("pointermove", (event) => {
    const m = svg.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    // solve o + x·ax + z·az = pt for (x, z)
    const px = pt.x - INV.o[0], py = pt.y - INV.o[1];
    const det = INV.ax[0] * INV.az[1] - INV.ax[1] * INV.az[0];
    setGoal({ x: (px * INV.az[1] - py * INV.az[0]) / det, z: (INV.ax[0] * py - INV.ax[1] * px) / det });
  });
  stage.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 20 : 4;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
    if (d) { event.preventDefault(); setGoal({ x: goal.x + d[0], z: goal.z + d[1] }, true); say.textContent = readout.textContent; return; }
    if (event.key === "e" || event.key === "E") { up = !up; draw(); say.textContent = readout.textContent; return; }
    if (event.key === " ") { event.preventDefault(); paused = !paused; held = 0; run(); }
  });
  still.addEventListener?.("change", run);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  draw();
}

function start() { document.querySelectorAll('[data-anatomy="control-arm"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/control-arm/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit and lathe runtimes (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, "control-arm.html"), fragment + "\n");
writeFileSync(join(OUT, "control-arm.css"), css);
writeFileSync(join(OUT, "control-arm.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Two-joint robot arm</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
// Self-check: forward kinematics of the IK solution must land on the target.
const chk = poseOf(T0.x, T0.z, true);
console.log(`wrote control-arm.* · SY ${SY} · FK(IK(${T0.x}, ${T0.z})) = (${chk.bx.toFixed(3)}, ${chk.bz.toFixed(3)}) · θ1 ${deg(chk.q1).toFixed(2)}° θ2 ${deg(chk.q2).toFixed(2)}°`);
