// Fig · Open differential — an axle demonstrator on a test stand: driveshaft
// and pinion, ring gear on an open carrier, two spider gears on a cross pin,
// two side gears on the half-shafts, and a wheel at each end.
// Run from the repo root: node figures/car-diff/build.mjs
// Writes site/static/anatomy/{car-diff.html, car-diff.css, car-diff.js} and
// figures/car-diff/preview{,-light}.html. The shared iso.css is not touched.
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
// The car drives at v around a corner of radius R (measured to the axle's
// centre; R = ∞ straight). The wheels turn at ω = v_wheel / r_tyre; the
// carrier, and with it the ring gear, turns at their average, and the spider
// gears spin on their pin at (ω_R − ω_L)/2 · (r_side / r_spider).
const CAR = { v: 10, track: 1.6, tyre: 0.32, finalDrive: 3.7, side: 9, spider: 5 }; // m/s, m, m, ratio, teeth-radius units
const wheelsOf = (R) => {
  // R > 0: turning left (left wheel inside); R < 0 right; 0 = straight
  if (!R) return { L: CAR.v / CAR.tyre, R: CAR.v / CAR.tyre };
  const k0 = CAR.track / 2 / R;
  return { L: (CAR.v * (1 - k0)) / CAR.tyre, R: (CAR.v * (1 + k0)) / CAR.tyre };
};

// ---------------------------------------------------------------- layout (world units, z up; +y toward the viewer)
const WIDTH = 640, HEIGHT = 470;
const ROLLER = { y: 10, r: 3, z: 7 }; // two rollers per pad, along x
const AZ = ROLLER.z + ROLLER.r + Math.sqrt(30 ** 2 - ROLLER.y ** 2) + 0.2; // tyre rests on the rollers
const AXIS = G.frameAlong([0, 0, AZ], [1, 0, 0]); // s = x
const RING = { s0: -21, s1: -17, r: 25, rIn: 15 }; // ring gear (x span, radius)
const SIDE = { s: 9, w: 4, r: 8 }; // side gears at x = ±(9 … 13)
const SPIDER = { d: 9.5, w: 3.6, r: 5 }; // spider centre's distance from the axle, thickness, radius
const PIN = { y0: 18, y1: 24, r: 6, x: -11 }; // pinion: along y, meshing on the ring gear's face (x = −17)
const SHAFT_X = [13, 74]; // half-shaft extent (each side)
const WHEEL = { s0: 76, s1: 90, r: 30, rim: 19 }; // each side, |x|
const PEDESTALS = [-46, 46];
const PLATE = { x: -112, y: -40, w: 224, d: 92, r: 8 };
const PLATE_H = 10, FOOT_H = 5;
const PINAX = G.frameAlong([PIN.x, 0, AZ], [0, 1, 0]); // s = y
const PHI0 = 0.5; // carrier angle at rest (rad)

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-WHEEL.s1, 0, AZ + WHEEL.r], [WHEEL.s1, 0, AZ + WHEEL.r], [-WHEEL.s1, -WHEEL.r, AZ], [WHEEL.s1, WHEEL.r, AZ], [PIN.x, 48, AZ]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 38 },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const view = k.towardViewer(P);
const f2 = (v) => v.toFixed(2);

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
  return out.join("");
}
// Roller pads: each tyre rests on two rollers, so the wheels spin freely.
function rollers(sx, back) {
  const out = [];
  const pad = { x: sx * 83 - 13, y: -16, w: 26, d: 32, r: 2 };
  if (back) {
    out.push(S_(k.slabOf(pad, 0, 4, P, 4, 0.5), { tone: "lo" }));
    for (const ex of [pad.x + 2, pad.x + pad.w - 4]) for (const ry of [-ROLLER.y, ROLLER.y]) out.push(S_(k.slabOf({ x: ex, y: ry - 2.5, w: 2, d: 5, r: 0.5 }, 4, ROLLER.z - 4 + 1, P, 2), { tone: "mid" }));
  }
  const RX = (ry) => G.frameAlong([0, ry, ROLLER.z], [1, 0, 0]);
  for (const ry of back ? [-ROLLER.y] : [ROLLER.y]) out.push(S_(G.disc(pad.x + 2, pad.x + pad.w - 2, ROLLER.r, RX(ry), P), { tone: "mid", crease: "none" }));
  return out.join("");
}
function labelPlate() {
  const out = [];
  const label = { x: -100, y: 34, w: 44, d: 14, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([28, 18, 32].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}
function pedestal(x) {
  const out = [];
  const foot = { x: x - 7, y: -11, w: 14, d: 22, r: 1.4 };
  out.push(S_(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(Dots([at([x, -8, 4]), at([x, 8, 4])], { size: 0.45, tone: "lo" }));
  const post = { x: x - 3, y: -4, w: 6, d: 8, r: 1 };
  out.push(S_(k.slabOf(post, 4, AZ - 4 - 8, P, 3, 0.4), { tone: "mid" }));
  const face = view[0] > 0 ? x + 4 : x - 4;
  out.push(S_(G.disc(x - 4, x + 4, 9, AXIS, P), { tone: "mid", inner: L(G.circleOf(AXIS, face, 5.5, P), { tone: "lo" }) }));
  return out.join("");
}
function pinionStand() {
  const out = [];
  const y = 36;
  const foot = { x: PIN.x - 9, y: y - 6, w: 18, d: 12, r: 1.4 };
  out.push(S_(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }));
  const post = { x: PIN.x - 3, y: y - 3, w: 6, d: 6, r: 1 };
  out.push(S_(k.slabOf(post, 4, AZ - 4 - 7, P, 3, 0.4), { tone: "mid" }));
  out.push(S_(G.disc(y - 3.5, y + 3.5, 8, PINAX, P), { tone: "mid", inner: L(G.circleOf(PINAX, view[1] > 0 ? y + 3.5 : y - 3.5, 4.8, P), { tone: "lo" }) }));
  return out.join("");
}

// ---------------------------------------------------------------- shafts, wheels, gears
const shaft = (sx) => S_(G.disc(sx * SHAFT_X[0], sx * SHAFT_X[1], 2.4, AXIS, P), { tone: "hi", crease: "none", lit: true });
function wheel(sx) {
  const out = [];
  const s0 = sx * WHEEL.s0, s1 = sx * WHEEL.s1;
  const outer = sx > 0 ? s1 : s0; // the wheel's outside face
  const face = (view[0] > 0) === (sx > 0) ? outer : sx > 0 ? s0 : s1;
  out.push(S_(G.disc(Math.min(s0, s1), Math.max(s0, s1), WHEEL.r, AXIS, P), { tone: "lo", inner: L(G.ribsOf(AXIS, Math.min(s0, s1) + 2, Math.max(s0, s1) - 2, WHEEL.r, 36, P, { least: 0.15, seams: true }), { tone: "faint" }) }));
  out.push(L(G.circleOf(AXIS, face, WHEEL.rim, P), { tone: "mid" }));
  out.push(L(G.circleOf(AXIS, face, WHEEL.rim - 6, P), { tone: "faint" }));
  out.push(`<g data-cd-spokes="${sx > 0 ? "R" : "L"}">${wheelSpokes(sx, 0)}</g>`);
  out.push(S_(G.disc(face - sx * 0.01, face + sx * 2.5, 4.5, AXIS, P), { tone: "mid" }));
  return out.join("");
}
function wheelSpokes(sx, angle) {
  const s0 = sx * WHEEL.s0, s1 = sx * WHEEL.s1;
  const face = (view[0] > 0) === (sx > 0) ? (sx > 0 ? s1 : s0) : sx > 0 ? s0 : s1;
  const d = [];
  for (let q = 0; q < 5; q++) {
    const a = angle + (q * 2 * Math.PI) / 5;
    const p0 = at([face, 4.5 * Math.cos(a), AZ + 4.5 * Math.sin(a)]);
    const p1 = at([face, (WHEEL.rim - 6) * Math.cos(a), AZ + (WHEEL.rim - 6) * Math.sin(a)]);
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  return `<path class="cd-spoke" d="${d.join("")}"/>`;
}
// Ring gear: an annulus bolted to the carrier, teeth as ribs on its face.
const RING_FACE = view[0] > 0 ? RING.s1 : RING.s0;
function ringGear() {
  const out = [];
  out.push(S_(G.disc(RING.s0, RING.s1, RING.r, AXIS, P), { tone: "mid", inner: L(G.circleOf(AXIS, RING_FACE, RING.r - 6, P) + G.circleOf(AXIS, RING_FACE, RING.rIn, P), { tone: "lo" }) }));
  out.push(`<g data-cd-teeth>${ringTeeth(PHI0)}</g>`);
  out.push(Dots(G.dotsOf(AXIS, RING_FACE, RING.rIn + 3, 8, P, { all: true, phase: PHI0 }), { size: 0.5, tone: "lo" }));
  return out.join("");
}
function ringTeeth(phi) {
  // 37 radial tooth lines between r − 6 and r on the visible face
  const d = [];
  for (let q = 0; q < 37; q++) {
    const a = phi + (q * 2 * Math.PI) / 37;
    const p0 = at([RING_FACE, (RING.r - 6) * Math.cos(a), AZ + (RING.r - 6) * Math.sin(a)]);
    const p1 = at([RING_FACE, RING.r * Math.cos(a), AZ + RING.r * Math.sin(a)]);
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  return `<path class="cd-tooth" d="${d.join("")}"/>`;
}
function sideGear(sx) {
  const s0 = sx * SIDE.s, s1 = sx * (SIDE.s + SIDE.w);
  return S_(G.disc(Math.min(s0, s1), Math.max(s0, s1), SIDE.r, AXIS, P), { tone: "mid" }) + `<g data-cd-side="${sx > 0 ? "R" : "L"}">${sideTeeth(sx, 0)}</g>`;
}
function sideTeeth(sx, angle) {
  const s = sx * SIDE.s; // the toothed face looks inward, at the spiders
  const near = (view[0] > 0) === (sx < 0) ? s : sx * (SIDE.s + SIDE.w);
  const d = [];
  for (let q = 0; q < 16; q++) {
    const a = angle + (q * 2 * Math.PI) / 16;
    const p0 = at([near, (SIDE.r - 3) * Math.cos(a), AZ + (SIDE.r - 3) * Math.sin(a)]);
    const p1 = at([near, SIDE.r * Math.cos(a), AZ + SIDE.r * Math.sin(a)]);
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  return `<path class="cd-tooth" d="${d.join("")}"/>`;
}
function pinion() {
  const out = [];
  out.push(S_(G.disc(PIN.y1, 44, 2.6, PINAX, P), { tone: "hi", crease: "none", lit: true }));
  out.push(S_(G.disc(PIN.y0, PIN.y1, PIN.r, PINAX, P), { tone: "mid" }));
  out.push(`<g data-cd-pinion>${pinionTeeth(0)}</g>`);
  // the driveshaft's flange at the front, with four bolts
  out.push(S_(G.disc(44, 47, 7, PINAX, P), { tone: "mid" }));
  out.push(Dots(G.dotsOf(PINAX, view[1] > 0 ? 47 : 44, 4.8, 4, P, { all: true }), { size: 0.45, tone: "lo" }));
  return out.join("");
}
function pinionTeeth(angle) {
  const face = view[1] > 0 ? PIN.y1 : PIN.y0;
  const d = [];
  for (let q = 0; q < 10; q++) {
    const a = angle + (q * 2 * Math.PI) / 10;
    const p0 = at([PIN.x + (PIN.r - 2.5) * Math.cos(a), face, AZ + (PIN.r - 2.5) * Math.sin(a)]);
    const p1 = at([PIN.x + PIN.r * Math.cos(a), face, AZ + PIN.r * Math.sin(a)]);
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  return `<path class="cd-tooth" d="${d.join("")}"/>`;
}
// The carrier: two arms from the ring gear to the cross pin, the pin, and the
// two spider gears on it, all turning with the carrier angle phi. The spiders
// also spin on the pin (spin). Rebuilt each frame, back to front.
function carrier(phi, spin) {
  const items = [];
  for (const q of [0, 1]) {
    const a = phi + q * Math.PI;
    const dir = [0, Math.cos(a), Math.sin(a)];
    const c = [0, SPIDER.d * dir[1], AZ + SPIDER.d * dir[2]];
    const F = G.frameAlong([0, 0, AZ], dir);
    const spider = S_(G.disc(SPIDER.d - SPIDER.w / 2, SPIDER.d + SPIDER.w / 2, SPIDER.r, F, P), { tone: "hi" }) + spiderMarks(F, spin * (q ? -1 : 1));
    items.push({ depth: k.depthOf(c, P), svg: spider });
    // the carrier arm: from the ring gear's inner edge to the pin's end, parallel to the axle
    const r = SPIDER.d + SPIDER.w / 2 + 2.5;
    const a0 = at([RING.s1, r * dir[1], AZ + r * dir[2]]), a1 = at([3, r * dir[1], AZ + r * dir[2]]);
    items.push({ depth: k.depthOf([-8, r * dir[1], AZ + r * dir[2]], P) + 0.5, svg: `<path class="cd-arm" d="M${f2(a0[0])} ${f2(a0[1])}L${f2(a1[0])} ${f2(a1[1])}"/>` });
  }
  // the cross pin through both spiders
  const pin = S_(G.disc(-SPIDER.d - 4, SPIDER.d + 4, 1.6, G.frameAlong([0, 0, AZ], [0, Math.cos(phi), Math.sin(phi)]), P), { tone: "hi", crease: "none" });
  items.push({ depth: k.depthOf([0, 0, AZ], P), svg: pin });
  items.sort((a, b) => a.depth - b.depth);
  return items.map((i) => i.svg).join("");
}
function spiderMarks(F, spin) {
  // a timing mark on the spider's outer face shows its spin on the pin
  const s = SPIDER.d + SPIDER.w / 2;
  const p = G.pointOf(F, s, SPIDER.r - 1.6, spin);
  const q = at(p);
  return `<circle class="cd-mark" cx="${f2(q[0])}" cy="${f2(q[1])}" r="1.1"/>`;
}

// ---------------------------------------------------------------- assemble
const LABEL =
  "An open differential on a test stand. A driveshaft flange at the front turns a small pinion, which meshes with the face of a large ring gear. The ring gear is bolted to an open carrier whose two arms hold a cross pin; two spider gears ride on the pin and mesh with two side gears, one on each half-shaft. The half-shafts run through bearing pedestals to a wheel at each end, both resting on roller pads so they can spin at different speeds.";

const back = view[0] > 0 ? -1 : 1; // which side is farther from the viewer
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    labelPlate(),
    rollers(back, true),
    rollers(-back, true),
    wheel(back),
    rollers(back, false),
    pedestal(PEDESTALS[back > 0 ? 1 : 0]),
    shaft(back),
    ringGear(),
    sideGear(back),
    `<g data-cd-carrier>${carrier(PHI0, 0)}</g>`,
    pinionStand(),
    pinion(),
    sideGear(-back),
    shaft(-back),
    pedestal(PEDESTALS[back > 0 ? 0 : 1]),
    wheel(-back),
    rollers(-back, false),
  ],
});

const fmt = (v, d) => v.toFixed(d);
const readoutOf = (R) => {
  const w = wheelsOf(R);
  const c = (w.L + w.R) / 2;
  const turn = !R ? "straight" : `R ${Math.abs(R).toFixed(0)} m ${R > 0 ? "left" : "right"}`;
  return `${turn} · ωL ${fmt(w.L, 1)} · ωR ${fmt(w.R, 1)} · carrier ${fmt(c, 1)} rad/s`;
};

const stage = `<div class="iso-stage cd-stage" tabindex="0" role="group" aria-roledescription="differential control" aria-label="Open differential. Left and Right arrows steer into a tighter turn, 0 drives straight; Space pauses.">${svg}<span class="cd-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 2",
  title: "Open differential",
  hint: "← → steer · 0 straight · space pause",
  readout: readoutOf(12),
  keys: [
    { mark: "lit", label: "Carrier = (ωL + ωR)/2, always" },
    { mark: "lit", label: "Half-shafts: each wheel's own speed" },
    { mark: "dim", label: "Spider gears spin only when the wheels differ" },
  ],
  caption: `In a turn the outer wheel travels farther than the inner one. The ring gear drives the carrier, and the spider gears let the two side gears share its motion unevenly: the carrier always turns at the average, ω_c = (ω_L + ω_R)/2. Car at ${CAR.v} m/s, track ${CAR.track} m, tyre radius ${CAR.tyre} m, final drive ${CAR.finalDrive}:1; the pinion turns ${CAR.finalDrive} times faster than the carrier. Driving straight, the spiders do not spin on their pin and the whole carrier turns as one block.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="car-diff">${plateBody}</div>`;

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
const R_ = '[data-anatomy="car-diff"]';
const FIGURE_CSS = `
.iso${R_}{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:760px;margin:0 auto;color:var(--anatomy-text)}
.iso${R_}[data-theme="light"],html:not(.dark) .iso${R_}{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso${R_} .iso-figure{margin:0}
.iso${R_} .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso${R_} .iso-plate-corner{font-family:inherit;font-size:11px}
.iso${R_} .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso${R_} .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso${R_} .iso-legend{font-size:13px}
.iso${R_} .cd-stage{position:relative;outline:none;cursor:default}
.iso${R_} .cd-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .cd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .cd-spoke{fill:none;stroke:var(--anatomy-mid);stroke-width:2.2;stroke-linecap:round}
.iso${R_} .cd-tooth{fill:none;stroke:var(--anatomy-lo);stroke-width:1.1;stroke-linecap:round}
.iso${R_} .cd-arm{fill:none;stroke:var(--anatomy-mid);stroke-width:3.4;stroke-linecap:round}
.iso${R_} .cd-mark{fill:var(--anatomy-lit)}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:10px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
// lathe.mjs ships inside a closure: its one import (cameraOf, iso, pathOf)
// is satisfied by the inlined kit, and its names cannot clash with the kit's.
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameAlong, disc, circleOf, pointOf, dotsOf }; })();
const k = { depthOf };
const P = ${JSON.stringify(P)};
const CAR = ${JSON.stringify(CAR)};
const AZ = ${AZ}, SPIDER = ${JSON.stringify(SPIDER)}, SIDE = ${JSON.stringify(SIDE)}, RING = ${JSON.stringify(RING)}, PIN = ${JSON.stringify(PIN)}, WHEEL = ${JSON.stringify(WHEEL)}, RING_FACE = ${RING_FACE};
const view = ${JSON.stringify(view)};
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const S_ = (paths, style) => solidSvg(paths, style);
const AXIS = G.frameAlong([0, 0, AZ], [1, 0, 0]);
const wheelsOf = ${wheelsOf.toString()};
const fmt = (v, d) => v.toFixed(d);
const readoutOf = ${readoutOf.toString()};
${wheelSpokes.toString()}
${ringTeeth.toString()}
${sideTeeth.toString()}
${pinionTeeth.toString()}
${carrier.toString()}
${spiderMarks.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".cd-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const g = { L: q('[data-cd-spokes="L"]'), R: q('[data-cd-spokes="R"]'), sL: q('[data-cd-side="L"]'), sR: q('[data-cd-side="R"]'), teeth: q("[data-cd-teeth]"), carrier: q("[data-cd-carrier]"), pinion: q("[data-cd-pinion]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  // Turn radii the arrows step through (m; positive = left turn).
  const RADII = [6, 8, 12, 20, 40, 0, -40, -20, -12, -8, -6];
  let step = 2, aL = 0, aR = 0, paused = false, frame = 0, last = 0, visible = false;
  // Shown slowed: one wheel turn about every 3 s at ${CAR.v} m/s.
  const SLOW = 1 / ((CAR.v / CAR.tyre) * 3 / (2 * Math.PI));

  function draw() {
    const phi = (aL + aR) / 2 + ${PHI0};
    const spin = ((aR - aL) / 2) * (SIDE.r / SPIDER.r);
    g.L.innerHTML = wheelSpokes(-1, aL);
    g.R.innerHTML = wheelSpokes(1, aR);
    g.sL.innerHTML = sideTeeth(-1, aL);
    g.sR.innerHTML = sideTeeth(1, aR);
    g.teeth.innerHTML = ringTeeth(phi);
    g.carrier.innerHTML = carrier(phi, spin);
    g.pinion.innerHTML = pinionTeeth(phi * CAR.finalDrive);
    const text = readoutOf(RADII[step]);
    if (readout.textContent !== text) readout.textContent = text;
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const w = wheelsOf(RADII[step]);
    if (!paused && !still.matches) { aL += w.L * dt * SLOW; aR += w.R * dt * SLOW; }
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") step = Math.max(0, step - 1);
    else if (event.key === "ArrowRight") step = Math.min(RADII.length - 1, step + 1);
    else if (event.key === "0") step = RADII.indexOf(0);
    else if (event.key === " ") { paused = !paused; run(); event.preventDefault(); return; }
    else return;
    event.preventDefault();
    draw();
    say.textContent = readoutOf(RADII[step]);
    if (still.matches) { const w = wheelsOf(RADII[step]); aL += w.L * 0.05; aR += w.R * 0.05; draw(); }
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
function start() { document.querySelectorAll('[data-anatomy="car-diff"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;
const js = `// Generated by figures/car-diff/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit and lathe runtimes (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, "car-diff.html"), fragment + "\n");
writeFileSync(join(OUT, "car-diff.css"), css);
writeFileSync(join(OUT, "car-diff.js"), js);
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Open differential</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
const w = wheelsOf(12);
console.log(`wrote car-diff.* · R 12 m: ωL ${w.L.toFixed(3)} ωR ${w.R.toFixed(3)} carrier ${((w.L + w.R) / 2).toFixed(3)} = straight ${(CAR.v / CAR.tyre).toFixed(3)}`);
