// Fig 2 · A horizontal seismograph on a bench: an inertial mass on a rail
// between two springs, an oil dashpot, a stylus arm and a strip-chart
// recorder whose paper feeds toward the viewer.
// Run from the repo root: node figures/seismograph/build.mjs
// Writes site/static/anatomy/{seismograph.html, seismograph.css, seismograph.js}
// and figures/seismograph/preview{,-light}.html.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/alex/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/alex/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "site", "static", "anatomy");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- model
// Ground motion g(t) along x: a P packet, an S packet and slower surface
// waves. The mass obeys x'' + 2ζω0 x' + ω0² x = −g'' (x relative to the
// frame); with a natural period (8 s) longer than the waves, x ≈ −g and the
// stylus writes the ground displacement. Distance from S−P, with
// vP ≈ 6 km/s and vS ≈ 3.5 km/s (typical crustal values).
const MODEL = { vP: 6, vS: 3.5, T0: 8, zeta: 0.7, quiet: 3, distance: 120, speed: 3 };

// ---------------------------------------------------------------- layout (world units, z up)
const WIDTH = 600;
const HEIGHT = 360;
const PLATE = { x: -100, y: -60, w: 132, d: 132, r: 7 };
const PLATE_H = 9;
const FOOT_H = 5;
const RAIL_Y = -38; // the seismometer's axis
const POSTS = [-82, 8]; // spring posts along x
const POST_H = 34;
const AXIS_Z = 22; // spring and rail height
const MASS = { x: -48, y: RAIL_Y - 9, w: 22, d: 18, r: 2 }; // at rest (x = 0)
const MASS_Z = 13;
const MASS_H = 18;
const MASS_X = MASS.x + MASS.w / 2; // −37
const PEN_Y = 14; // the stylus touches the paper here
const PAPER = { x: MASS_X - 20, y: -6, w: 40, d: 66, r: 0.6 };
const PLATEN = { x: PAPER.x - 6, y: -10, w: PAPER.w + 12, d: 74, r: 2 };
const PLATEN_H = 5;
const PAPER_Z = PLATEN_H + 0.5;
const FEED = 1.1; // world units of paper per second of signal
const ARM_Z = 13;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POSTS[0], RAIL_Y, POST_H + 4], [POSTS[1], RAIL_Y, POST_H + 4], [PLATE.x + PLATE.w, PLATE.y + PLATE.d, 0]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 40 },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

// ---------------------------------------------------------------- base and frame (move with the ground)
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 16).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 6.5, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 4.8, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 24), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a spirit level, back right: the instrument must sit level
  const lv = { x: 12, y: 0, w: 9, d: 26, r: 4.5 };
  out.push(S_(k.slabOf(lv, 0, 3, P, 6, 0.4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(lv, 1.6), 3, P, 6), { tone: "faint" }));
  out.push(L(k.lineOnTop([lv.x + 1.6, lv.y + 11], [lv.x + lv.w - 1.6, lv.y + 11], 3, P) + k.lineOnTop([lv.x + 1.6, lv.y + 15], [lv.x + lv.w - 1.6, lv.y + 15], 3, P), { tone: "lo" }));
  out.push(D([at([lv.x + lv.w / 2, lv.y + 13, 3])], { size: 0.9, tone: "hi" }));
  // label plate, front right, three rule lines standing for text
  const label = { x: -6, y: 48, w: 30, d: 13, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(L([20, 14, 24].map((len, n) => k.lineOnTop([label.x + 4, label.y + 3.6 + n * 2.9], [label.x + 4 + len, label.y + 3.6 + n * 2.9], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.4 }));
  return out.join("");
}

function trough() {
  // the oil dashpot under the mass: a long open tray
  const tray = { x: MASS.x - 12, y: RAIL_Y - 6, w: MASS.w + 24, d: 12, r: 1.4 };
  const out = [S_(k.slabOf(tray, 0, 7, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(tray, 2, P, 4), { tone: "faint" }) })];
  out.push(S_(k.slabOf(k.insetPlan(tray, 1.4), 6.2, 0.8, P, 4), { tone: "lo", flat: true }));
  out.push(L(k.planOutline(k.insetPlan(tray, 2.6), 7, P, 4), { tone: "faint" }));
  out.push(D([at([tray.x + 1.6, tray.y + tray.d / 2, 7]), at([tray.x + tray.w - 1.6, tray.y + tray.d / 2, 7])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

function post(x) {
  const out = [];
  const foot = { x: x - 7, y: RAIL_Y - 9, w: 14, d: 18, r: 1.6 };
  out.push(S_(k.slabOf(foot, 0, 3, P, 4, 0.5), { tone: "mid" }));
  out.push(D(k.corners(foot, 2.2).map(([px, py]) => at([px, py, 3])), { size: 0.45 }));
  const col = { x: x - 4, y: RAIL_Y - 5, w: 8, d: 10, r: 1 };
  out.push(S_(k.slabOf(col, 3, POST_H - 3, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(col, POST_H - 6, P, 3), { tone: "faint" }) }));
  out.push(S_(k.slabOf(k.insetPlan(col, -1), POST_H, 2, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([x, RAIL_Y, POST_H + 2])], { size: 0.5, tone: "hi" }));
  // spring anchor boss on the inner face
  const dir = x < MASS_X ? 1 : -1;
  out.push(S_(k.cylinder(x + dir * 3.8, RAIL_Y, 3.2, AXIS_Z - 3.6, 7.2, P, 20), { tone: "mid", crease: "none" }));
  // the spring's seat: a washer ring where the coil starts
  out.push(L(k.sideRing([x + dir * 7, RAIL_Y, AXIS_Z], 2.6, "x", P), { tone: "lo" }));
  return out.join("");
}

function rail() {
  // a ground rod the mass's bushings ride on, between the posts at the axis height
  const plan = { x: POSTS[0] + 4, y: RAIL_Y - 1.2, w: POSTS[1] - POSTS[0] - 8, d: 2.4, r: 1.2 };
  return S_(k.slabOf(plan, MASS_Z - 3.2, 2.4, P, 4, 0.3), { tone: "mid", crease: "none" });
}

// ---------------------------------------------------------------- recorder (moves with the ground)
function recorder() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PLATEN, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S_(k.slabOf(PLATEN, 0, PLATEN_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(PLATEN, 1.6, P, 4), { tone: "faint" }) }));
  // paper strip
  out.push(S_(k.slabOf(PAPER, PLATEN_H, 0.5, P, 2), { tone: "hi", crease: "none" }));
  // feed rollers: a supply cassette at the back, a take-up at the front
  for (const [y0, label] of [[PLATEN.y - 7, "supply"], [PLATEN.y + PLATEN.d - 4, "take"]]) {
    const box = { x: PLATEN.x - 2, y: y0, w: PLATEN.w + 4, d: 11, r: 2 };
    out.push(S_(k.slabOf(box, 0, 8, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 6, P, 4), { tone: "faint" }) }));
    out.push(L(k.planOutline({ x: box.x + 3, y: box.y + box.d / 2 - 1.2, w: box.w - 6, d: 2.4, r: 1.2 }, 8, P, 4), { tone: "lo" }));
    out.push(D(k.corners(box, 2).map(([px, py]) => at([px, py, 8])), { size: 0.4, tone: label === "take" ? "mid" : "lo" }));
  }
  // drive motor and its speed knob, beside the take-up
  const motor = { x: PLATEN.x - 20, y: PLATEN.y + PLATEN.d - 8, w: 14, d: 15, r: 2 };
  out.push(S_(k.slabOf(motor, 0, 10, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(motor, 3, P, 4), { tone: "faint" }) }));
  const kx = motor.x + motor.w / 2, ky = motor.y + motor.d / 2;
  out.push(S_(k.cylinder(kx, ky, 4.2, 10, 3, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(kx, ky, 4.2, 10, 13, 26, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([kx, ky], [kx + 2.8, ky - 2.8], 13, P), { tone: "hi" }));
  out.push(D([at([kx, ky, 13])], { size: 0.5, tone: "hi" }));
  // amplitude scale along the paper's left edge: the zero line under the pen and ticks
  const strip = { x: PAPER.x - 5.4, y: PLATEN.y + 2, w: 4.2, d: PLATEN.d - 4, r: 0.6 };
  out.push(S_(k.slabOf(strip, PLATEN_H, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.y + 2, strip.y + strip.d - 2, FEED * 2, 5, strip.x + strip.w - 0.2, PLATEN_H + 0.6, [-1.4, -2.8], P, "y");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- mass, vane, arm, pen (move with mass)
function massGroup() {
  const out = [];
  // vane into the oil
  out.push(S_(k.slabOf({ x: MASS_X - 7, y: RAIL_Y - 0.8, w: 14, d: 1.6, r: 0.3 }, 7, MASS_Z - 7, P, 2), { tone: "lo", crease: "none" }));
  // bushings on the rail
  for (const dx of [-7, 7]) out.push(S_(k.slabOf({ x: MASS_X + dx - 2.4, y: RAIL_Y - 3, w: 4.8, d: 6, r: 1 }, MASS_Z - 4, 4, P, 3), { tone: "mid" }));
  out.push(`<path class="iso-halo" d="${k.haloOf(MASS, MASS_Z, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S_(k.slabOf(MASS, MASS_Z, MASS_H, P, 4, 0.8), { tone: "hi", lit: true, inner: L(k.sideSeam(MASS, MASS_Z + 4, P, 4), { tone: "faint" }) }));
  const lid = k.insetPlan(MASS, 2.4);
  out.push(L(k.planOutline(lid, MASS_Z + MASS_H, P, 4), { tone: "lo" }));
  out.push(D(k.corners(lid, 2).map(([x, y]) => at([x, y, MASS_Z + MASS_H])), { size: 0.5 }));
  return out.join("");
}

function armGroup() {
  const out = [];
  const mount = { x: MASS_X - 3, y: MASS.y + MASS.d - 0.5, w: 6, d: 4, r: 0.8 };
  out.push(S_(k.slabOf(mount, ARM_Z - 2, 6, P, 3, 0.3), { tone: "mid" }));
  const arm = { x: MASS_X - 1.2, y: mount.y + mount.d, w: 2.4, d: PEN_Y - (mount.y + mount.d) + 1.5, r: 0.6 };
  out.push(S_(k.slabOf(arm, ARM_Z, 1.6, P, 2, 0.2), { tone: "hi", lit: true }));
  // pen holder and the stylus down to the paper
  out.push(S_(k.cylinder(MASS_X, PEN_Y, 2.2, ARM_Z - 3, 6, P, 18, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(MASS_X, PEN_Y, 0.8, PAPER_Z, ARM_Z - 3 - PAPER_Z, P, 12), { tone: "hi", lit: true, crease: "none" }));
  out.push(D([at([MASS_X, PEN_Y, ARM_Z + 3])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// springs are rebuilt each frame (their length changes)
function springs(mx, gx) {
  const left = k.coil(POSTS[0] + 7 + gx, MASS.x + mx, [RAIL_Y, AXIS_Z], 2.6, 7, "x", P);
  const right = k.coil(MASS.x + MASS.w + mx, POSTS[1] - 7 + gx, [RAIL_Y, AXIS_Z], 2.6, 7, "x", P);
  return { left, right };
}

// ---------------------------------------------------------------- assemble
const T = (by) => k.translateAlong(P, by);
const paperClip = k.slabOf({ ...PAPER, r: 0 }, PAPER_Z, 0.01, P, 1).fill;

function svgAt(g, x) {
  const sp = springs(g + x, g);
  const line = (d) => `<path class="iso-line" data-tone="lo" d="${d}"/>`;
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A horizontal seismograph on a bench. A heavy mass rides a rail between two springs, with a vane dipping into an oil tray to damp it. When the ground shakes along the rail, the frame moves but the mass, by inertia, stays nearly still; a stylus arm on the mass writes the relative motion onto a paper strip that feeds toward the viewer, so the P, S and surface waves appear as wiggles in order.",
    body: [
      `<g data-ground transform="${T([g, 0, 0])}">${base()}${trough()}${post(POSTS[0])}${rail()}</g>`,
      `<g data-spring="lb">${line(sp.left.back)}</g>`,
      `<g data-mass transform="${T([g + x, 0, 0])}">${massGroup()}</g>`,
      `<g data-spring="lf">${line(sp.left.front)}</g>`,
      `<g data-spring="rb">${line(sp.right.back)}</g>`,
      `<g data-ground transform="${T([g, 0, 0])}">${post(POSTS[1])}${recorder()}</g>`,
      `<clipPath id="seis-paper"><path d="${paperClip}"/></clipPath>`,
      `<g data-ground transform="${T([g, 0, 0])}"><g clip-path="url(#seis-paper)" data-trace></g></g>`,
      `<g data-mass transform="${T([g + x, 0, 0])}">${armGroup()}</g>`,
      `<g data-spring="rf">${line(sp.right.front)}</g>`,
    ],
  });
}

const stage = `<div class="iso-stage seis-stage" tabindex="0" role="group" aria-roledescription="seismograph" aria-label="Seismograph. Left and Right arrows change the distance to the earthquake; Space restarts the record.">${svgAt(0, 0)}<span class="seis-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 2",
  title: "Seismograph",
  hint: "← → distance · space restarts",
  readout: "waiting for the P wave",
  keys: [
    { mark: "lit", label: "The mass and its stylus: held still by inertia" },
    { mark: "raised", label: "The paper: moves with the ground" },
  ],
  caption:
    "The frame shakes with the ground; the mass, hung between soft springs (natural period 8 s, damped by oil), barely moves, so the stylus writes the ground's motion. The P wave arrives first, the S wave later; their gap gives the distance, d = Δt · vP·vS / (vP − vS), with vP ≈ 6 km/s and vS ≈ 3.5 km/s. Motion is exaggerated.",
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="seismograph">${plateBody}</div>`;

const css = `
.iso[data-anatomy="seismograph"]{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso[data-anatomy="seismograph"][data-theme="light"],html:not(.dark) .iso[data-anatomy="seismograph"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7}
.iso[data-anatomy="seismograph"] .iso-figure{margin:0}
.iso[data-anatomy="seismograph"] .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso[data-anatomy="seismograph"] .iso-plate-corner{font-family:inherit;font-size:11px}
.iso[data-anatomy="seismograph"] .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso[data-anatomy="seismograph"] .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso[data-anatomy="seismograph"] .iso-legend{font-size:13px}
.iso[data-anatomy="seismograph"] .seis-stage{position:relative;outline:none}
.iso[data-anatomy="seismograph"] .seis-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso[data-anatomy="seismograph"] .seis-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso[data-anatomy="seismograph"] [data-trace] .iso-line{stroke-width:.9}
.iso[data-anatomy="seismograph"] [data-trace] .seis-mark{stroke:var(--brand,#e0447f);stroke-width:1}
@media (max-width:560px){.iso[data-anatomy="seismograph"] .iso-plate{padding:40px 4px 60px}}
`.trim() + "\n";

// ---------------------------------------------------------------- live script
const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const MASS = ${JSON.stringify(MASS)}, POSTS = ${JSON.stringify(POSTS)}, RAIL_Y = ${RAIL_Y}, AXIS_Z = ${AXIS_Z};
const PAPER = ${JSON.stringify(PAPER)}, PAPER_Z = ${PAPER_Z}, PEN_Y = ${PEN_Y}, FEED = ${FEED}, MASS_X = ${MASS_X};
const T = (by) => translateAlong(P, by);
${springs.toString()}
const k = { coil };

// One wave packet: a smooth rise then decay, times a sine.
const packet = (t, t0, amp, f, tau) => {
  const s = t - t0;
  if (s <= 0) return 0;
  const env = (s / tau) * Math.exp(1 - s / tau);
  return amp * env * Math.sin(2 * Math.PI * f * s);
};
function ground(t, d) {
  const tp = M.quiet + d / M.vP, ts = M.quiet + d / M.vS, tr = M.quiet + d / 3.0;
  const a = Math.sqrt(120 / d);
  return packet(t, tp, 2.2 * a, 0.9, 1.6) + packet(t, ts, 5 * a, 0.55, 2.4) + packet(t, tr, 7 * a, 0.26, 5);
}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".seis-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const groundEls = [...svg.querySelectorAll("[data-ground]")];
  const massEls = [...svg.querySelectorAll("[data-mass]")];
  const springEls = Object.fromEntries([...svg.querySelectorAll("[data-spring]")].map((e) => [e.dataset.spring, e.firstElementChild]));
  const trace = svg.querySelector("[data-trace]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let d = M.distance, t = 0, x = 0, v = 0, samples = [], frame = 0, last = 0, visible = false;
  const w0 = (2 * Math.PI) / M.T0;
  const DT = 0.005;
  const END = () => M.quiet + d / 3.0 + 28;
  const gAcc = (s) => (ground(s + DT, d) - 2 * ground(s, d) + ground(s - DT, d)) / (DT * DT);

  function reset() { t = 0; x = 0; v = 0; samples = []; }
  function advance(seconds) {
    for (let n = 0; n < seconds / DT; n++) {
      const a = -2 * M.zeta * w0 * v - w0 * w0 * x - gAcc(t);
      v += a * DT;
      x += v * DT; // semi-implicit Euler: stable for this oscillator
      t += DT;
      if (n % 8 === 0) samples.push([t, x]);
    }
    const keep = t - (PAPER.d + 4) / FEED;
    while (samples.length && samples[0][0] < keep) samples.shift();
  }
  // Simulate a whole record at once (reduced motion, or a restart while hidden).
  function complete() { reset(); advance(END()); }

  const tp = () => d / M.vP, ts = () => d / M.vS;
  function draw() {
    const g = ground(t, d);
    groundEls.forEach((e) => e.setAttribute("transform", T([g, 0, 0])));
    massEls.forEach((e) => e.setAttribute("transform", T([g + x, 0, 0])));
    const sp = springs(g + x, g);
    springEls.lb.setAttribute("d", sp.left.back);
    springEls.lf.setAttribute("d", sp.left.front);
    springEls.rb.setAttribute("d", sp.right.back);
    springEls.rf.setAttribute("d", sp.right.front);
    // The trace: pen offset across the paper (x), time along the feed (+y toward the viewer).
    const pts = samples.map(([s, xr]) => [MASS_X - xr, PEN_Y + (t - s) * FEED]).filter(([, y]) => y <= PAPER.y + PAPER.d);
    let d1 = pts.length > 1 ? onTop(pts, PAPER_Z, P) : "";
    // Arrival marks across the strip, where P and S were written.
    const marks = [M.quiet + tp(), M.quiet + ts()].filter((s) => s <= t).map((s) => PEN_Y + (t - s) * FEED).filter((y) => y < PAPER.y + PAPER.d - 1)
      .map((y) => lineOnTop([PAPER.x + 1, y], [PAPER.x + 6, y], PAPER_Z, P)).join("");
    trace.innerHTML = '<path class="iso-line" data-tone="hi" data-free="" d="' + d1 + '"/>' + (marks ? '<path class="seis-mark" data-free="" fill="none" d="' + marks + '"/>' : "");
    const sp_ = (ts() - tp()).toFixed(1);
    const text = t < M.quiet + tp() ? "d = " + d + " km · waiting for the P wave"
      : t < M.quiet + ts() ? "P arrived · waiting for S"
      : "S − P = " + sp_ + " s → d ≈ " + Math.round((ts() - tp()) * M.vP * M.vS / (M.vP - M.vS)) + " km";
    if (readout.textContent !== text) readout.textContent = text;
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    advance(dt * M.speed);
    if (t > END()) reset();
    draw();
    frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  }
  const run = () => {
    if (still.matches) { complete(); draw(); return; }
    if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); }
  };
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      d = Math.max(40, Math.min(300, d + (e.key === "ArrowRight" ? 20 : -20)));
      say.textContent = "Distance " + d + " km";
    } else if (e.key !== " ") return;
    e.preventDefault();
    reset();
    if (still.matches) complete();
    draw();
    run();
  });
  still.addEventListener?.("change", run);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px 0px" }).observe(stage);
  if (still.matches) complete();
  draw();
}

function start() { document.querySelectorAll('[data-anatomy="seismograph"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/seismograph/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${live}`;

writeFileSync(join(OUT, "seismograph.html"), fragment + "\n");
writeFileSync(join(OUT, "seismograph.css"), css);
writeFileSync(join(OUT, "seismograph.js"), js);

// Previews: the shared iso.css plus this figure's CSS, inlined.
const shared = readFileSync(join(OUT, "iso.css"), "utf8");
const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Seismograph</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${shared}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log("wrote seismograph.html, seismograph.css, seismograph.js, previews");
