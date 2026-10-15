// Fig · Planetary gear train on a demonstration stand: a sun gear, three
// planets on a carrier, a ring gear with internal teeth, a handwheel on the
// sun's shaft at the back and one on the carrier's shaft at the front, and a
// brake on each member. Which member is held decides the ratio, through the
// Willis equation (ω_s − ω_c)/(ω_r − ω_c) = −Z_r/Z_s.
// Run from the repo root: node figures/mechanical-planetary/build.mjs
// Writes site/static/anatomy/mechanical-planetary.{html,css,js} and
// figures/mechanical-planetary/preview{,-light}.html. iso.css is not touched.
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
const NAME = "mechanical-planetary";

// ---------------------------------------------------------------- model
// Tooth counts satisfy Z_r = Z_s + 2 Z_p, and (Z_s + Z_r)/3 is a whole
// number, so three equally spaced planets mesh.
const Z = { s: 24, p: 24, r: 72 };
const MODES = [
  { fixed: "ring", input: "sun", output: "carrier", label: "Ring held" },
  { fixed: "carrier", input: "sun", output: "ring", label: "Carrier held" },
  { fixed: "sun", input: "ring", output: "carrier", label: "Sun held" },
];
// Angles of the three members for an input angle th (Willis, solved per mode).
const anglesOf = (mode, th) => {
  if (mode === 0) return { s: th, r: 0, c: (th * Z.s) / (Z.s + Z.r) };
  if (mode === 1) return { s: th, c: 0, r: (-th * Z.s) / Z.r };
  return { r: th, s: 0, c: (th * Z.r) / (Z.r + Z.s) };
};
const ratioOf = (mode) => {
  const a = anglesOf(mode, 1);
  const key = { sun: "s", carrier: "c", ring: "r" };
  return a[key[MODES[mode].input]] / a[key[MODES[mode].output]];
};
const IN_RPM = 60;
const readoutOf = (mode) => {
  const m = MODES[mode];
  const i = ratioOf(mode);
  const out = IN_RPM / i;
  return `${m.label} · ${m.input} → ${m.output} · i = ${i.toFixed(2)} · ${IN_RPM} → ${out.toFixed(1)} rpm`;
};

// ---------------------------------------------------------------- geometry (world units, z up)
const M = 1; // module
const R = { s: (M * Z.s) / 2, p: (M * Z.p) / 2, r: (M * Z.r) / 2 };
const ORBIT = R.s + R.p; // planet centre distance
const RING_OUT = R.r + 8;
const WIDTH = 640, HEIGHT = 480;
const ROLL = { y: 22, r: 4 };
const ROLL_Z = 12;
const AZ = ROLL_Z + Math.sqrt((RING_OUT + ROLL.r) ** 2 - ROLL.y ** 2);
const PLATE = { x: -96, y: -66, w: 192, d: 132, r: 8 };
const PLATE_H = 10, FOOT_H = 5;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, AZ + RING_OUT + 14], [-80, 0, AZ + 18], [80, 0, AZ + 18], [0, -RING_OUT, AZ], [0, RING_OUT, AZ]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 34 },
);
const view = k.towardViewer(P);
const FS = view[0] > 0 ? 1 : -1; // the gear faces we see point along FS·x
const sAt = (v) => FS * v;
const AXIS = G.frameAlong([0, 0, AZ], [FS, 0, 0]); // s grows toward the viewer
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => v.toFixed(2);
// s ranges (along the axis, + toward the viewer)
const RING_S = [-4, 4], GEAR_S = [-3.4, 3.4], CARRIER_S = [4.6, 6.6];
const BACK_SHAFT = [-62, -4], FRONT_SHAFT = [6.6, 62];
const PEDS = [-44, 44];

// A gear outline: trapezoid teeth on the pitch circle. Internal gears have
// their tips inside the pitch circle (the outline is then the hole's edge).
function gearPoly(z, r, phase, internal = false) {
  const tip = internal ? r - M : r + M;
  const root = internal ? r + 1.25 * M : r - 1.25 * M;
  const h = Math.PI / (2 * z);
  const pts = [];
  for (let q = 0; q < z; q++) {
    const a = phase + (q * 2 * Math.PI) / z;
    for (const [rr, da] of [[root, -2 * h], [root, -1.22 * h], [tip, -0.6 * h], [tip, 0.6 * h], [root, 1.22 * h]]) pts.push([rr * Math.cos(a + da), rr * Math.sin(a + da)]);
  }
  return pts;
}
const worldOf = (x, y, s) => [0, 1, 2].map((i) => AXIS.o[i] + AXIS.a[i] * s + AXIS.u[i] * x + AXIS.v[i] * y);
const capPath = (poly, s, cx = 0, cy = 0) => k.pathOf(poly.map(([x, y]) => at(worldOf(x + cx, y + cy, s))), true);
function gearSolid(poly, cx, cy, s0, s1, tone) {
  const moved = poly.map(([x, y]) => [x + cx, y + cy]);
  const paths = G.prismOf(AXIS, moved, s0, s1, P);
  const front = capPath(poly, s1, cx, cy);
  paths.fill = front + capPath(poly, s0, cx, cy);
  paths.outline = front;
  return S_(paths, { tone, crease: "faint" });
}

// ---------------------------------------------------------------- base and stands
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
  // label plate near the front corner
  const label = { x: 40, y: 44, w: 40, d: 13, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([26, 16, 30].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.2 + n * 3.1], [label.x + 5 + len, label.y + 4.2 + n * 3.1], 0.8, P)).join(""), { tone: "lo", free: true }));
  return out.join("");
}
// A bearing pedestal under a shaft at axial position x, with a lock knob on top.
function pedestal(x, member) {
  const out = [];
  const foot = { x: x - 8, y: -13, w: 16, d: 26, r: 1.4 };
  out.push(S_(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(Dots([at([x, -10, 4]), at([x, 10, 4])], { size: 0.45, tone: "lo" }));
  out.push(S_(k.slabOf({ x: x - 3.5, y: -5, w: 7, d: 10, r: 1 }, 4, AZ - 4 - 9, P, 3, 0.4), { tone: "mid" }));
  const face = x + FS * 4.5;
  out.push(S_(G.disc(x - 4.5, x + 4.5, 10, G.frameAlong([0, 0, AZ], [1, 0, 0]), P), { tone: "mid", inner: L(G.circleOf(G.frameAlong([0, 0, AZ], [1, 0, 0]), face, 6.5, P), { tone: "lo" }) }));
  // lock: a knob on a short screw on top of the bearing housing
  out.push(S_(k.cylinder(x, 0, 1.2, AZ + 9.6, 4, P, 16), { tone: "mid" }));
  out.push(`<g class="mp-lock" data-mp-lock="${member}">${S_(k.cylinder(x, 0, 3.2, AZ + 13.6, 3, P, 28), { tone: "hi" })}</g>`);
  return out.join("");
}
// The ring rests on two rollers on a cradle.
function roller(sy) {
  const out = [];
  const pad = { x: -10, y: sy * ROLL.y - 5, w: 20, d: 10, r: 1.2 };
  out.push(S_(k.slabOf(pad, 0, 4, P, 3, 0.5), { tone: "lo" }));
  for (const ex of [-9, 7]) out.push(S_(k.slabOf({ x: ex, y: sy * ROLL.y - 2, w: 2, d: 4, r: 0.4 }, 4, ROLL_Z - 4 + 1.5, P, 2), { tone: "mid" }));
  out.push(S_(G.disc(-7, 7, ROLL.r, G.frameAlong([0, sy * ROLL.y, ROLL_Z], [1, 0, 0]), P), { tone: "mid", crease: "none" }));
  return out.join("");
}
// The ring's brake: a post behind, an arm over the top, a shoe on the rim.
const BRAKE_Y = -RING_OUT - 12;
function brakePost() {
  const out = [];
  out.push(S_(k.slabOf({ x: -6, y: BRAKE_Y - 6, w: 12, d: 12, r: 1.2 }, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(S_(k.cylinder(0, BRAKE_Y, 3, 4, AZ + RING_OUT + 6 - 4, P, 24), { tone: "mid" }));
  return out.join("");
}
function brakeArm() {
  const out = [];
  const top = AZ + RING_OUT + 6;
  out.push(S_(k.slabOf({ x: -3, y: BRAKE_Y - 2, w: 6, d: -BRAKE_Y + 2, r: 1 }, top, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(`<g class="mp-lock" data-mp-lock="ring">${S_(k.slabOf({ x: -5, y: -7, w: 10, d: 14, r: 1.4 }, AZ + RING_OUT + 0.4, 5.6, P, 3, 0.5), { tone: "hi" })}</g>`);
  out.push(Dots([at([0, BRAKE_Y, top + 3])], { size: 0.5 }));
  return out.join("");
}

// ---------------------------------------------------------------- shafts and handwheels
function shaft(range, r) {
  return S_(G.disc(sAt(range[0]), sAt(range[1]), r, G.frameAlong([0, 0, AZ], [1, 0, 0]), P), { tone: "hi", crease: "none", lit: true });
}
function handwheelRim(s0, s1, r) {
  const F = G.frameAlong([0, 0, AZ], [1, 0, 0]);
  const near = FS > 0 ? Math.max(sAt(s0), sAt(s1)) : Math.min(sAt(s0), sAt(s1));
  return S_(G.disc(Math.min(sAt(s0), sAt(s1)), Math.max(sAt(s0), sAt(s1)), r, F, P), { tone: "mid", inner: L(G.circleOf(F, near, r - 3, P), { tone: "lo" }) + L(G.ribsOf(F, Math.min(sAt(s0), sAt(s1)) + 0.6, Math.max(sAt(s0), sAt(s1)) - 0.6, r, 40, P, { least: 0.15, seams: true }), { tone: "faint" }) });
}
function spokes(s, r, angle) {
  const d = [];
  for (let q = 0; q < 4; q++) {
    const a = angle + (q * Math.PI) / 2;
    const p0 = at(G.pointOf(AXIS, s, 3.5, a));
    const p1 = at(G.pointOf(AXIS, s, r - 3, a));
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  const knob = at(G.pointOf(AXIS, s, r - 6, angle));
  return `<path class="mp-spoke" d="${d.join("")}"/><circle class="mp-knob" cx="${f2(knob[0])}" cy="${f2(knob[1])}" r="2.4"/>`;
}

// ---------------------------------------------------------------- the gear set (rebuilt each frame)
function ringBody() {
  return S_(G.disc(RING_S[0], RING_S[1], RING_OUT, AXIS, P), { tone: "mid", inner: L(G.ribsOf(AXIS, RING_S[0] + 0.8, RING_S[1] - 0.8, RING_OUT, 48, P, { least: 0.18, seams: true }), { tone: "faint" }) });
}
function gearSet(a) {
  const out = [];
  const ringPhase = a.r - Math.PI / Z.r;
  const inner = gearPoly(Z.r, R.r, ringPhase, true);
  // the cavity: the ring's back wall seen through the hole, and the inner
  // tooth flanks receding to the back face
  out.push(`<path class="mp-cavity" d="${capPath(inner, RING_S[1])}"/>`);
  out.push(L(capPath(inner, RING_S[0] + 0.4), { tone: "faint" }));
  // sun and planets
  out.push(gearSolid(gearPoly(Z.s, R.s, a.s), 0, 0, GEAR_S[0], GEAR_S[1], "hi"));
  for (let j = 0; j < 3; j++) {
    const alpha = a.c + (j * 2 * Math.PI) / 3;
    const phase = alpha + Math.PI - Math.PI / Z.p - ((a.s - a.c) * Z.s) / Z.p;
    out.push(gearSolid(gearPoly(Z.p, R.p, phase), ORBIT * Math.cos(alpha), ORBIT * Math.sin(alpha), GEAR_S[0], GEAR_S[1], "mid"));
  }
  // the ring's front face: an annulus with internal teeth
  const outer = Array.from({ length: 96 }, (_, q) => [RING_OUT * Math.cos((q / 96) * 2 * Math.PI), RING_OUT * Math.sin((q / 96) * 2 * Math.PI)]);
  out.push(`<path class="mp-ringface" fill-rule="evenodd" d="${capPath(outer, RING_S[1])}${capPath(inner, RING_S[1])}"/>`);
  // index marks on the ring face and a crank knob, to show its turn
  const marks = [];
  for (let q = 0; q < 12; q++) {
    const ang = a.r + (q * Math.PI) / 6;
    const p0 = at(G.pointOf(AXIS, RING_S[1], RING_OUT - 1.5, ang)), p1 = at(G.pointOf(AXIS, RING_S[1], RING_OUT - (q % 3 ? 3.5 : 5.5), ang));
    marks.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  out.push(`<path class="mp-tick" d="${marks.join("")}"/>`);
  const crank = G.frameAlong(G.pointOf(AXIS, RING_S[1], RING_OUT - 4.2, a.r + Math.PI / 4), [FS, 0, 0]);
  out.push(S_(G.disc(0, 3, 1.4, crank, P), { tone: "mid", crease: "none" }));
  out.push(S_(G.disc(3, 7, 2.6, crank, P), { tone: "hi" }));
  return out.join("");
}
function carrier(a) {
  const items = [];
  for (let j = 0; j < 3; j++) {
    const alpha = a.c + (j * 2 * Math.PI) / 3;
    const cx = ORBIT * Math.cos(alpha), cy = ORBIT * Math.sin(alpha);
    // planet pin, from the planet's face to the carrier
    const pinF = G.frameAlong(worldOf(cx, cy, 0), [FS, 0, 0]);
    items.push(S_(G.disc(GEAR_S[1] - 0.01, CARRIER_S[0], 2, pinF, P), { tone: "hi", crease: "none" }));
  }
  // the three arms, each a stadium from the hub to a planet pin
  for (let j = 0; j < 3; j++) {
    const alpha = a.c + (j * 2 * Math.PI) / 3;
    const arm = G.stadium(4.2, 3.2, ORBIT, 24).map(([x, y]) => [x * Math.cos(alpha) - y * Math.sin(alpha), x * Math.sin(alpha) + y * Math.cos(alpha)]);
    items.push(gearSolid(arm, 0, 0, CARRIER_S[0], CARRIER_S[1], "mid"));
    const pin = at(G.pointOf(AXIS, CARRIER_S[1], ORBIT, alpha));
    items.push(`<circle class="mp-pin" cx="${f2(pin[0])}" cy="${f2(pin[1])}" r="1.1"/>`);
  }
  const hub = at(G.pointOf(AXIS, CARRIER_S[1], 0, 0));
  items.push(`<circle class="mp-pin" cx="${f2(hub[0])}" cy="${f2(hub[1])}" r="1.6"/>`);
  return items.join("");
}

// ---------------------------------------------------------------- assemble
const A0 = anglesOf(0, 0);
const backY = view[1] > 0 ? -1 : 1;
const LABEL =
  "A planetary gear train on a demonstration stand. A sun gear in the middle meshes with three planet gears, which ride on pins of a three-armed carrier and also mesh with the internal teeth of a large ring gear. The ring rests on two rollers and has a brake shoe over its rim; the sun's shaft runs to a handwheel at the back and the carrier's shaft to a handwheel at the front, each through a bearing pedestal with a lock knob.";
const back = FS > 0 ? "back" : "front";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    brakePost(),
    pedestal(sAt(PEDS[0]), "sun"),
    shaft(BACK_SHAFT, 2.6),
    handwheelRim(-66, -62, 15),
    `<g data-mp-back>${spokes(-62, 15, 0)}</g>`,
    roller(backY),
    ringBody(),
    `<g data-mp-gears>${gearSet(A0)}</g>`,
    brakeArm(),
    roller(-backY),
    `<g data-mp-carrier>${carrier(A0)}</g>`,
    shaft(FRONT_SHAFT, 3),
    pedestal(sAt(PEDS[1]), "carrier"),
    handwheelRim(62, 66, 17),
    `<g data-mp-front>${spokes(66, 17, 0)}</g>`,
  ],
});

const stage = `<div class="iso-stage mp-stage" tabindex="0" role="group" aria-roledescription="planetary gear control" aria-label="Planetary gear train. Keys 1, 2 and 3 choose which member is held; Space pauses.">${svg}<span class="mp-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Planetary gear train",
  hint: "1 2 3 hold ring · carrier · sun · space pause",
  readout: readoutOf(0),
  keys: [
    { mark: "lit", label: `Sun ${Z.s} teeth, planets ${Z.p}, ring ${Z.r}` },
    { mark: "lit", label: "Highlighted knob or shoe: the member held still" },
  ],
  caption: `One gear set, three ratios. The Willis equation (ω_s − ω_c)/(ω_r − ω_c) = −Z_r/Z_s links the three speeds; hold one member and the other two are geared. Ring held: sun → carrier, i = 1 + Z_r/Z_s = 4. Carrier held: sun → ring, i = −Z_r/Z_s = −3 (reversed). Sun held: ring → carrier, i = 1 + Z_s/Z_r = 1.33. Input shown at ${IN_RPM} rpm, slowed.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="${NAME}" data-mp-mode="0">${plateBody}</div>`;

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
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .mp-stage{position:relative;outline:none;cursor:default}
.iso${R_} .mp-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .mp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .mp-spoke{fill:none;stroke:var(--anatomy-mid);stroke-width:2;stroke-linecap:round}
.iso${R_} .mp-knob{fill:var(--anatomy-hi);stroke:var(--anatomy-mid);stroke-width:.8}
.iso${R_} .mp-cavity{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:.7;stroke-linejoin:round}
.iso${R_} .mp-ringface{fill:var(--anatomy-top);stroke:var(--anatomy-mid);stroke-width:.8;stroke-linejoin:round}
.iso${R_} .mp-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.8;stroke-linecap:round}
.iso${R_} .mp-pin{fill:var(--anatomy-lit)}
.iso${R_} .mp-lock .iso-edge{transition:stroke 160ms ease}
.iso${R_} .mp-lock[data-on] .iso-fill,.iso${R_} .mp-lock[data-on] .iso-top,.iso${R_} .mp-lock[data-on] .iso-shade{fill:var(--brand,#db2777)}
.iso${R_} .mp-lock[data-on] .iso-edge{stroke:var(--brand,#db2777)}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:10px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameAlong, disc, circleOf, pointOf, prismOf, stadium, ribsOf }; })();
const k = { pathOf, iso, depthOf };
const P = ${JSON.stringify(P)};
const Z = ${JSON.stringify(Z)}, R = ${JSON.stringify(R)}, M = ${M}, ORBIT = ${ORBIT}, RING_OUT = ${RING_OUT}, FS = ${FS};
const RING_S = ${JSON.stringify(RING_S)}, GEAR_S = ${JSON.stringify(GEAR_S)}, CARRIER_S = ${JSON.stringify(CARRIER_S)};
const MODES = ${JSON.stringify(MODES)}, IN_RPM = ${IN_RPM};
const AXIS = ${JSON.stringify(AXIS)};
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const anglesOf = ${anglesOf.toString()};
const ratioOf = ${ratioOf.toString()};
const readoutOf = ${readoutOf.toString()};
${gearPoly.toString()}
const worldOf = ${worldOf.toString()};
const capPath = ${capPath.toString()};
${gearSolid.toString()}
${spokes.toString()}
${gearSet.toString()}
${carrier.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".mp-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const g = { gears: q("[data-mp-gears]"), carrier: q("[data-mp-carrier]"), back: q("[data-mp-back]"), front: q("[data-mp-front]") };
  const locks = [...svg.querySelectorAll("[data-mp-lock]")];
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let mode = 0, th = 0, paused = false, frame = 0, last = 0, visible = false, idle = 0, touched = false;
  // Input at IN_RPM, shown at a quarter of real speed.
  const W = (IN_RPM / 60) * 2 * Math.PI * 0.25;

  function setMode(m) {
    mode = m;
    root.dataset.mpMode = String(m);
    for (const l of locks) l.toggleAttribute("data-on", l.dataset.mpLock === MODES[m].fixed);
    th = 0;
    draw();
    say.textContent = readoutOf(m);
  }
  function draw() {
    const a = anglesOf(mode, th);
    g.gears.innerHTML = gearSet(a);
    g.carrier.innerHTML = carrier(a);
    g.back.innerHTML = spokes(-62, 15, a.s);
    g.front.innerHTML = spokes(66, 17, a.c);
    const text = readoutOf(mode);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && !still.matches) {
      th += W * dt;
      if (!touched) { idle += dt; if (idle > 6) { idle = 0; setMode((mode + 1) % 3); } }
    }
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "1" || event.key === "2" || event.key === "3") { touched = true; setMode(Number(event.key) - 1); event.preventDefault(); }
    else if (event.key === "ArrowRight" || event.key === "ArrowLeft") { touched = true; th += (event.key === "ArrowRight" ? 1 : -1) * 0.2; draw(); event.preventDefault(); }
    else if (event.key === " ") { paused = !paused; run(); event.preventDefault(); }
  });
  stage.addEventListener("click", () => { touched = true; setMode((mode + 1) % 3); run(); });
  still.addEventListener?.("change", run);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  setMode(0);
}
function start() { document.querySelectorAll('[data-anatomy="${NAME}"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;
const js = `// Generated by figures/${NAME}/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit and lathe runtimes (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, `${NAME}.html`), fragment + "\n");
writeFileSync(join(OUT, `${NAME}.css`), css);
writeFileSync(join(OUT, `${NAME}.js`), js);
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Planetary gear train</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`view ${view.map((v) => v.toFixed(2))} · wrote ${NAME}.* · FS ${FS} · ratios ${[0, 1, 2].map((m) => ratioOf(m).toFixed(3)).join(" / ")} · AZ ${AZ.toFixed(1)}`);
