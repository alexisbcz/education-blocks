// Fig · Cam and follower test bench: a disc cam on a shaft turned by a
// handwheel, a roller follower sliding in a guide bushing, a return spring
// between a collar and the bushing, and a dial gauge on the follower's stem.
// The cam's profile is built from the chosen motion law (rise, dwell,
// return, dwell), so the follower's lift is exactly s(φ).
// Run from the repo root: node figures/mechanical-cam/build.mjs
// Writes site/static/anatomy/mechanical-cam.{html,css,js} and
// figures/mechanical-cam/preview{,-light}.html. iso.css is not touched.
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
const NAME = "mechanical-cam";

// ---------------------------------------------------------------- model (mm, degrees)
const CAM = { rb: 16, rr: 3.5, h: 10, rise: 120, dwell: 60, ret: 120 };
// Lift s(φ) for φ in degrees: rise, dwell at the top, return, dwell at the base.
function liftOf(law, phi) {
  const p = ((phi % 360) + 360) % 360;
  const shape = (x) => (law === "harmonic" ? (1 - Math.cos(Math.PI * x)) / 2 : x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));
  if (p < CAM.rise) return CAM.h * shape(p / CAM.rise);
  if (p < CAM.rise + CAM.dwell) return CAM.h;
  if (p < CAM.rise + CAM.dwell + CAM.ret) return CAM.h * (1 - shape((p - CAM.rise - CAM.dwell) / CAM.ret));
  return 0;
}
const phaseOf = (phi) => {
  const p = ((phi % 360) + 360) % 360;
  return p < CAM.rise ? "rise" : p < CAM.rise + CAM.dwell ? "dwell" : p < CAM.rise + CAM.dwell + CAM.ret ? "return" : "dwell";
};
// The cam's working surface: the roller centre's pitch curve, offset inward
// by the roller radius along its normal (in the cam's own frame).
function profileOf(law) {
  const N = 360;
  const pitch = [];
  for (let q = 0; q < N; q++) {
    const th = (q / N) * 2 * Math.PI;
    const rho = CAM.rb + CAM.rr + liftOf(law, (th * 180) / Math.PI);
    pitch.push([rho * Math.cos(Math.PI / 2 - th), rho * Math.sin(Math.PI / 2 - th)]);
  }
  return pitch.map((p, q) => {
    const a = pitch[(q - 1 + N) % N], b = pitch[(q + 1) % N];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    if (nx * p[0] + ny * p[1] < 0) { nx = -nx; ny = -ny; }
    return [p[0] - CAM.rr * nx, p[1] - CAM.rr * ny];
  });
}
const readoutOf = (law, phi) => {
  const s = liftOf(law, phi);
  const d = 0.5;
  const v = (liftOf(law, phi + d) - liftOf(law, phi - d)) / ((2 * d * Math.PI) / 180);
  return `${law} · φ ${String(Math.round(((phi % 360) + 360) % 360)).padStart(3, " ")}° · ${phaseOf(phi)} · s ${s.toFixed(2)} mm · ds/dφ ${v.toFixed(1)} mm/rad`;
};

// ---------------------------------------------------------------- layout (world units = mm, z up)
const WIDTH = 640, HEIGHT = 520;
const AZ = 34; // shaft height
const CAM_S = [-3.5, 3.5];
const PLATE = { x: -62, y: -40, w: 124, d: 82, r: 7 };
const PLATE_H = 8, FOOT_H = 4;
const ROLLER_Z0 = AZ + CAM.rb + CAM.rr; // roller centre at zero lift
const BUSH = { z0: ROLLER_Z0 + CAM.h + 18, z1: ROLLER_Z0 + CAM.h + 28, r: 4.2 };
const POST_Y = -33;
const DIAL = { z: BUSH.z1 + 34, r: 10, y0: 2, y1: 7 };
const STEM_TOP = 30; // above the roller centre
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, DIAL.z + DIAL.r + 4], [-40, 0, AZ + 16], [44, 0, AZ + 16], [0, -CAM.rb - CAM.h, AZ]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 36 },
);
const view = k.towardViewer(P);
const AXIS = G.frameAlong([0, 0, AZ], [1, 0, 0]);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => v.toFixed(2);
const worldOf = (x, y, s) => [0, 1, 2].map((i) => AXIS.o[i] + AXIS.a[i] * s + AXIS.u[i] * x + AXIS.v[i] * y);
const capPath = (poly, s) => k.pathOf(poly.map(([x, y]) => at(worldOf(x, y, s))), true);
const rot = (poly, a) => poly.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);

// ---------------------------------------------------------------- static parts
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 16)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 5.5, -PLATE_H - FOOT_H, 1.4, P, 24), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 4.2, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  // a ruler strip along the front edge, ticks every 2 mm
  const strip = { x: -40, y: 30, w: 80, d: 6, r: 0.8 };
  out.push(S_(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 4, 5, strip.y + 0.6, 0.8, [1.8, 3.2], P);
  out.push(`<path class="mc-tick" d="${ticks.minor + ticks.major}"/>`);
  return out.join("");
}
function pedestal(x) {
  const out = [];
  out.push(S_(k.slabOf({ x: x - 6, y: -10, w: 12, d: 20, r: 1.2 }, 0, 3.5, P, 3, 0.4), { tone: "mid" }));
  out.push(Dots([at([x, -7.5, 3.5]), at([x, 7.5, 3.5])], { size: 0.42, tone: "lo" }));
  out.push(S_(k.slabOf({ x: x - 2.5, y: -4, w: 5, d: 8, r: 0.8 }, 3.5, AZ - 3.5 - 7, P, 3, 0.3), { tone: "mid" }));
  const F = G.frameAlong([0, 0, AZ], [1, 0, 0]);
  out.push(S_(G.disc(x - 3.5, x + 3.5, 8, F, P), { tone: "mid", inner: L(G.circleOf(F, view[0] > 0 ? x + 3.5 : x - 3.5, 5, P), { tone: "lo" }) }));
  return out.join("");
}
const shaft = () => S_(G.disc(-34, 44, 2.4, AXIS, P), { tone: "hi", crease: "none", lit: true });
// The column at the back, an arm to the guide bushing, an arm to the dial.
function column() {
  const out = [];
  out.push(S_(k.slabOf({ x: -6, y: POST_Y - 6, w: 12, d: 12, r: 1.2 }, 0, 3.5, P, 3, 0.4), { tone: "mid" }));
  out.push(S_(k.cylinder(0, POST_Y, 3, 3.5, DIAL.z + 4 - 3.5, P, 24), { tone: "mid" }));
  return out.join("");
}
function bushingArm() {
  const out = [];
  out.push(S_(k.slabOf({ x: -2.5, y: POST_Y, w: 5, d: -POST_Y, r: 0.6 }, BUSH.z0 + 3, 4, P, 3, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(0, 0, BUSH.r, BUSH.z0, BUSH.z1 - BUSH.z0, P, 28, 0.4), { tone: "mid", inner: L(k.ring(0, 0, 2.2, BUSH.z1, P, 20), { tone: "lo" }) }));
  out.push(S_(k.cylinder(0, POST_Y, 4.2, BUSH.z0 + 2, 6, P, 24), { tone: "mid" })); // clamp on the column
  return out.join("");
}
function dialArm() {
  const out = [];
  out.push(S_(k.cylinder(0, POST_Y, 4.2, DIAL.z - 4, 6, P, 24), { tone: "mid" }));
  out.push(S_(k.slabOf({ x: -2.5, y: POST_Y, w: 5, d: -POST_Y + DIAL.y0, r: 0.6 }, DIAL.z - 3, 4, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}
const DIALF = G.frameAlong([0, 0, DIAL.z], [0, 1, 0]); // the dial faces +y
function dialBody() {
  const out = [];
  // the stem sleeve under the body, then the body, bezel and face ticks
  out.push(S_(k.cylinder(0, (DIAL.y0 + DIAL.y1) / 2, 2, DIAL.z - DIAL.r - 6, 6, P, 16), { tone: "mid" }));
  out.push(S_(G.disc(DIAL.y0, DIAL.y1, DIAL.r, DIALF, P), { tone: "mid", inner: L(G.circleOf(DIALF, DIAL.y1, DIAL.r - 1.4, P), { tone: "lo" }) }));
  const d = [];
  for (let q = 0; q < 50; q++) {
    const a = Math.PI / 2 - (q / 50) * 2 * Math.PI;
    const r1 = DIAL.r - 1.8, r0 = r1 - (q % 5 ? 1.2 : 2.4);
    const p0 = at(G.pointOf(DIALF, DIAL.y1, r0, a)), p1 = at(G.pointOf(DIALF, DIAL.y1, r1, a));
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  out.push(`<path class="mc-tick" d="${d.join("")}"/>`);
  return out.join("");
}
function handwheel() {
  const F = G.frameAlong([0, 0, AZ], [1, 0, 0]);
  return S_(G.disc(40, 44, 14, F, P), { tone: "mid", inner: L(G.circleOf(F, 44, 11, P), { tone: "lo" }) + L(G.ribsOf(F, 40.6, 43.4, 14, 40, P, { least: 0.15, seams: true }), { tone: "faint" }) });
}

// ---------------------------------------------------------------- moving parts
function spokes(phi) {
  const d = [];
  for (let q = 0; q < 3; q++) {
    const a = (phi * Math.PI) / 180 + (q * 2 * Math.PI) / 3;
    const p0 = at(G.pointOf(AXIS, 44, 3, a)), p1 = at(G.pointOf(AXIS, 44, 11, a));
    d.push(`M${f2(p0[0])} ${f2(p0[1])}L${f2(p1[0])} ${f2(p1[1])}`);
  }
  const knob = at(G.pointOf(AXIS, 44, 9, (phi * Math.PI) / 180));
  return `<path class="mc-spoke" d="${d.join("")}"/><circle class="mc-knob" cx="${f2(knob[0])}" cy="${f2(knob[1])}" r="2.2"/>`;
}
function cam(profile, phi) {
  const poly = rot(profile, (phi * Math.PI) / 180);
  const paths = G.prismOf(AXIS, poly, CAM_S[0], CAM_S[1], P);
  const near = view[0] > 0 ? CAM_S[1] : CAM_S[0];
  paths.fill = capPath(poly, CAM_S[0]) + capPath(poly, CAM_S[1]);
  paths.outline = capPath(poly, near);
  // a keyway mark and the base circle, to see the cam turn
  const key = rot([[0, 0], [CAM.rb - 4, 0]], (phi * Math.PI) / 180 - Math.PI / 2);
  const k0 = at(worldOf(...key[0], near)), k1 = at(worldOf(...key[1], near));
  return S_(paths, { tone: "hi", inner: L(capPath(Array.from({ length: 48 }, (_, q) => [5 * Math.cos((q / 48) * 2 * Math.PI), 5 * Math.sin((q / 48) * 2 * Math.PI)]), near), { tone: "lo" }) }) + `<path class="mc-key" d="M${f2(k0[0])} ${f2(k0[1])}L${f2(k1[0])} ${f2(k1[1])}"/>`;
}
// A vertical helix split into the half behind the stem and the half in front.
function helix(z0, z1, r, turns) {
  const n = Math.round(turns * 24);
  const back = [], front = [];
  let run = [], near = null;
  for (let q = 0; q <= n; q++) {
    const a = (q / n) * turns * 2 * Math.PI;
    const p = at([r * Math.cos(a), r * Math.sin(a), z0 + ((z1 - z0) * q) / n]);
    const facing = k.depthOf([Math.cos(a), Math.sin(a), 0], P) > 0;
    if (near === null) near = facing;
    if (facing !== near) { run.push(p); (near ? front : back).push(k.pathOf(run)); run = [p]; near = facing; continue; }
    run.push(p);
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}
function followerLow(s) {
  const zc = ROLLER_Z0 + s;
  const out = [];
  // the roller on its pin, in the cam's plane
  const RF = G.frameAlong([0, 0, zc], [1, 0, 0]);
  out.push(S_(G.disc(-2.6, 2.6, CAM.rr, RF, P), { tone: "mid", inner: Dots([at([view[0] > 0 ? 2.6 : -2.6, 0, zc])], { size: 0.5, tone: "lo" }) }));
  // the fork that holds the roller, and the stem up to the collar
  out.push(S_(k.slabOf({ x: -3.6, y: -1.6, w: 7.2, d: 3.2, r: 0.4 }, zc + 1.5, 4, P, 2), { tone: "mid" }));
  const collar = zc + 9;
  out.push(S_(k.cylinder(0, 0, 1.6, zc + 5.5, collar - zc - 5.5, P, 16), { tone: "hi", crease: "none" }));
  const coil = helix(collar + 1.6, BUSH.z0, 3.4, 6);
  out.push(L(coil.back, { tone: "lo" }));
  out.push(S_(k.cylinder(0, 0, 1.6, collar, BUSH.z0 - collar, P, 16), { tone: "hi", crease: "none" }));
  out.push(S_(k.cylinder(0, 0, 4, collar, 1.6, P, 24), { tone: "mid" }));
  out.push(`<path class="mc-coil" d="${coil.front}"/>`);
  return out.join("");
}
function followerHigh(s) {
  const zc = ROLLER_Z0 + s;
  const top = zc + STEM_TOP;
  const out = [];
  out.push(S_(k.cylinder(0, 0, 1.6, BUSH.z1, top - BUSH.z1, P, 16), { tone: "hi", crease: "none", lit: true }));
  out.push(S_(k.cylinder(0, 0, 2.6, top, 1.4, P, 20), { tone: "mid" }));
  // the dial's plunger rests on the cap and slides up into its sleeve
  const y = (DIAL.y0 + DIAL.y1) / 2;
  out.push(S_(k.cylinder(0, y, 0.9, top + 1.4, DIAL.z - DIAL.r - 6 - top - 1.4 + 0.5, P, 12), { tone: "hi", crease: "none" }));
  return out.join("");
}
function needle(s) {
  // 10 mm of travel = one turn of the needle
  const a = Math.PI / 2 - (s / 10) * 2 * Math.PI;
  const c = at(G.pointOf(DIALF, DIAL.y1, 0, 0)), tip = at(G.pointOf(DIALF, DIAL.y1, DIAL.r - 2.6, a)), tail = at(G.pointOf(DIALF, DIAL.y1, 2.2, a + Math.PI));
  return `<path class="mc-needle" d="M${f2(tail[0])} ${f2(tail[1])}L${f2(tip[0])} ${f2(tip[1])}"/><circle class="mc-hub" cx="${f2(c[0])}" cy="${f2(c[1])}" r="1"/>`;
}

// ---------------------------------------------------------------- assemble
const LAW0 = "cycloidal", PHI0 = 60;
const PROFILE0 = profileOf(LAW0);
const S0 = liftOf(LAW0, PHI0);
const LABEL =
  "A cam and follower test bench. A disc cam is keyed to a shaft running through two bearing pedestals, turned by a handwheel. A roller follower rides on the cam: its stem slides up through a guide bushing held by an arm from a column at the back, and a coil spring between a collar on the stem and the bushing keeps the roller on the cam. A dial gauge on a second arm rests its plunger on the top of the stem and reads the lift.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    column(),
    pedestal(-26),
    shaft(),
    `<g data-mc-cam>${cam(PROFILE0, PHI0)}</g>`,
    `<g data-mc-low>${followerLow(S0)}</g>`,
    bushingArm(),
    `<g data-mc-high>${followerHigh(S0)}</g>`,
    dialArm(),
    dialBody(),
    `<g data-mc-needle>${needle(S0)}</g>`,
    pedestal(30),
    handwheel(),
    `<g data-mc-spokes>${spokes(PHI0)}</g>`,
  ],
});
const stage = `<div class="iso-stage mc-stage" tabindex="0" role="group" aria-roledescription="cam control" aria-label="Cam and follower. Left and right arrows turn the cam by 5 degrees, L switches the motion law, Space pauses.">${svg}<span class="mc-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 2",
  title: "Cam and follower",
  hint: "← → turn · L law · space pause",
  readout: readoutOf(LAW0, PHI0),
  keys: [
    { mark: "lit", label: `Rise ${CAM.rise}°, dwell ${CAM.dwell}°, return ${CAM.ret}°, dwell ${360 - CAM.rise - CAM.dwell - CAM.ret}°` },
    { mark: "lit", label: `Lift ${CAM.h} mm, base circle ${CAM.rb} mm, roller ${CAM.rr} mm` },
  ],
  caption: "The cam is drawn from its motion law: the roller centre follows the pitch curve r = r_b + r_r + s(φ), and the working surface is that curve moved in by the roller radius along its normal. So the dial reads exactly s(φ). Press L to switch between cycloidal motion (zero acceleration at both ends of the rise) and simple harmonic motion (an acceleration jump where rise meets dwell).",
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
.iso${R_} .mc-stage{position:relative;outline:none;cursor:default}
.iso${R_} .mc-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso${R_} .mc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso${R_} .mc-spoke{fill:none;stroke:var(--anatomy-mid);stroke-width:2;stroke-linecap:round}
.iso${R_} .mc-knob{fill:var(--anatomy-hi);stroke:var(--anatomy-mid);stroke-width:.8}
.iso${R_} .mc-key{fill:none;stroke:var(--anatomy-lo);stroke-width:1.2;stroke-linecap:round}
.iso${R_} .mc-tick{fill:none;stroke:var(--anatomy-lo);stroke-width:.7;stroke-linecap:round}
.iso${R_} .mc-coil{fill:none;stroke:var(--anatomy-hi);stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.iso${R_} .mc-needle{fill:none;stroke:var(--brand,#db2777);stroke-width:1.4;stroke-linecap:round}
.iso${R_} .mc-hub{fill:var(--anatomy-lit)}
@media (max-width:560px){.iso${R_} .iso-plate{padding:40px 4px 60px}.iso${R_} .iso-plate-corner[data-corner="hint"]{display:none}.iso${R_} .iso-plate-corner[data-corner="readout"]{font-size:9.5px}}
`;
const css = scope(k.ISO_CSS, R_) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script
const latheSrc = readFileSync("/Users/alex/.claude/skills/anatomy/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const liveSrc = `
const G = (() => { ${latheSrc}
return { frameAlong, disc, circleOf, pointOf, prismOf }; })();
const k = { pathOf, iso, depthOf, cylinder, slabOf };
const P = ${JSON.stringify(P)};
const view = ${JSON.stringify(view)};
const CAM = ${JSON.stringify(CAM)}, CAM_S = ${JSON.stringify(CAM_S)}, ROLLER_Z0 = ${ROLLER_Z0}, BUSH = ${JSON.stringify(BUSH)}, DIAL = ${JSON.stringify(DIAL)}, STEM_TOP = ${STEM_TOP};
const AXIS = ${JSON.stringify(AXIS)}, DIALF = ${JSON.stringify(DIALF)};
const at = (p) => iso(p, P);
const f2 = (v) => v.toFixed(2);
const S_ = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const Dots = (points, style) => dotsSvg(points, style);
const worldOf = ${worldOf.toString()};
const capPath = ${capPath.toString()};
const rot = ${rot.toString()};
${liftOf.toString()}
const phaseOf = ${phaseOf.toString()};
${profileOf.toString()}
const readoutOf = ${readoutOf.toString()};
${spokes.toString()}
${cam.toString()}
${helix.toString()}
${followerLow.toString()}
${followerHigh.toString()}
${needle.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  const stage = root.querySelector(".mc-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const q = (s) => svg.querySelector(s);
  const g = { cam: q("[data-mc-cam]"), low: q("[data-mc-low]"), high: q("[data-mc-high]"), needle: q("[data-mc-needle]"), spokes: q("[data-mc-spokes]") };
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let law = "${LAW0}", profile = profileOf(law), phi = ${PHI0}, paused = false, frame = 0, last = 0, visible = false;
  const W = 45; // degrees per second, slowed
  function draw() {
    const s = liftOf(law, phi);
    g.cam.innerHTML = cam(profile, phi);
    g.low.innerHTML = followerLow(s);
    g.high.innerHTML = followerHigh(s);
    g.needle.innerHTML = needle(s);
    g.spokes.innerHTML = spokes(phi);
    const text = readoutOf(law, phi);
    if (readout.textContent !== text) readout.textContent = text;
    root.dispatchEvent(new CustomEvent("mech-cam", { bubbles: true, detail: { law, phi } }));
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (!paused && !still.matches) phi = (phi + W * dt) % 360;
    draw();
    frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  const setLaw = (l) => { law = l; profile = profileOf(law); draw(); say.textContent = readoutOf(law, phi); };
  root.addEventListener("mech-cam-law", (e) => setLaw(e.detail));
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { phi = (phi + (event.key === "ArrowRight" ? 5 : -5) + 360) % 360; draw(); say.textContent = readoutOf(law, phi); event.preventDefault(); }
    else if (event.key === "l" || event.key === "L") { setLaw(law === "cycloidal" ? "harmonic" : "cycloidal"); event.preventDefault(); }
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
const js = `// Generated by figures/${NAME}/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit and lathe runtimes (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

writeFileSync(join(OUT, `${NAME}.html`), fragment + "\n");
writeFileSync(join(OUT, `${NAME}.css`), css);
writeFileSync(join(OUT, `${NAME}.js`), js);
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cam and follower</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(800px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`view ${view.map((v) => v.toFixed(2))} · wrote ${NAME}.* · s(60°) ${S0.toFixed(3)} · s(120..180) ${liftOf(LAW0, 150)} · max r ${Math.max(...PROFILE0.map(([x, y]) => Math.hypot(x, y))).toFixed(2)}`);
