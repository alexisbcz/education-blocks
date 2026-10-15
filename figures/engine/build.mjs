// Fig · Heat engine — a gamma-type Stirling engine on a bench plate.
// Run from the repo root: node figures/engine/build.mjs
// Writes site/static/anatomy/{engine.html, engine.css, engine.js} and figures/engine/preview{,-light}.html.
// The shared site/static/anatomy/iso.css (kit CSS, written by the matvec build) is not touched;
// engine.css carries the kit CSS again, scoped under [data-anatomy="engine"], plus the figure's own rules.
import { mkdirSync, writeFileSync } from "node:fs";
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
// One crank angle θ drives everything: the power piston follows the crank,
// the displacer leads it by 90°. The readout is the ideal Stirling work per
// cycle for this engine's own volumes: W = n R (Th − Tc) ln(Vmax/Vmin).
const R = 8.314462618;
const TC = 300; // K, cooling fins at room temperature
const TH0 = 600; // K, hot cap over the lamp at rest
const BORE = 0.018, STROKE = 0.018, DEAD = 12e-6; // m, m, m³ (bore 18 mm, stroke 18 mm, dead volume 12 cm³)
const SWEPT = Math.PI * (BORE / 2) ** 2 * STROKE;
const VMIN = DEAD, VMAX = DEAD + SWEPT;
const N_MOL = (101325 * VMAX) / (R * TC); // filled with air at 1 atm, room temperature, piston out
const workOf = (th) => N_MOL * R * (th - TC) * Math.log(VMAX / VMIN);

// ---------------------------------------------------------------- layout (world units, z up; +y toward the viewer)
const WIDTH = 600;
const HEIGHT = 470;
const PLATE = { x: -112, y: -58, w: 232, d: 116, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;
const D = [-56, 0]; // displacer cylinder axis
const PW = [34, 0]; // power cylinder axis
const CX = -12, CZ = 150; // crankshaft axis (along y)
const THROW = 9; // crank radius
const ROD = 58; // connecting-rod length
const YD = -6, YP = 6; // crank throws: displacer, power
const YU = [-26, 26]; // uprights
const FLY = { y0: -42, y1: -35, r: 34 }; // flywheel
const D_GLAND = 91; // top of the displacer gland
const P_GLAND = 70; // top of the power-cylinder gland
const AXIS = G.frameAlong([CX, 0, CZ], [0, 1, 0]); // s = y

const pinOf = (phi, y) => [CX + THROW * Math.cos(phi), y, CZ + THROW * Math.sin(phi)];
const headZ = (pin, x) => pin[2] - Math.sqrt(ROD * ROD - (pin[0] - x) ** 2);
const anglesOf = (theta) => ({ power: theta, displacer: theta + Math.PI / 2 });
const THETA0 = 0.6;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CX, FLY.y0, CZ + FLY.r + 2], [CX, FLY.y0, CZ - FLY.r], [CX, YU[1], CZ + 8], [D[0], -24, 92], [PW[0] + 14, 12, 70]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 48 },
);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const T = (by) => k.translateAlong(P, by);
const view = k.towardViewer(P);
const FLY_FACE = view[1] > 0 ? FLY.y1 : FLY.y0; // the flywheel face the viewer sees

// ---------------------------------------------------------------- base
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
  // label plate, front right
  const label = { x: 58, y: 34, w: 46, d: 16, r: 1.2 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([28, 18, 32].map((len, n) => k.lineOnTop([label.x + 5, label.y + 4.6 + n * 3.3], [label.x + 5 + len, label.y + 4.6 + n * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- crank frame
function flywheel() {
  const out = [];
  const F = AXIS;
  const inner =
    L(G.circleOf(F, FLY_FACE, FLY.r - 5, P), { tone: "lo" }) +
    L(G.circleOf(F, FLY_FACE, 9.5, P), { tone: "faint" });
  out.push(S_(G.disc(FLY.y0, FLY.y1, FLY.r, F, P), { tone: "mid", inner }));
  out.push(`<g data-spokes>${spokes(THETA0)}</g>`);
  out.push(S_(G.disc(FLY.y0 - 2, FLY.y1 + 2, 7, F, P), { tone: "mid" }));
  out.push(Dots(G.dotsOf(F, FLY.y1 + 2, 4.6, 4, P, { all: true }), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// Four spokes on the visible face, rebuilt each frame (a rotation can't be a screen transform).
function spokes(theta) {
  const d = [];
  for (let q = 0; q < 4; q++) {
    const a = theta + (q * Math.PI) / 2;
    const p0 = at([CX + 7 * Math.cos(a), FLY_FACE, CZ + 7 * Math.sin(a)]);
    const p1 = at([CX + (FLY.r - 5) * Math.cos(a), FLY_FACE, CZ + (FLY.r - 5) * Math.sin(a)]);
    d.push(`M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}L${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
  }
  return `<path class="eng-spoke" d="${d.join("")}"/>`;
}

function upright(y) {
  const out = [];
  const foot = { x: CX - 11, y: y - 6, w: 22, d: 12, r: 1.4 };
  out.push(S_(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(Dots([at([foot.x + 3, y, 4]), at([foot.x + foot.w - 3, y, 4])], { size: 0.45, tone: "lo" }));
  const post = { x: CX - 4, y: y - 2.2, w: 8, d: 4.4, r: 1 };
  out.push(S_(k.slabOf(post, 4, CZ - 4 - 6, P, 3, 0.4), { tone: "mid" }));
  out.push(S_(G.disc(y - 3, y + 3, 6.5, AXIS, P), { tone: "mid", inner: L(G.circleOf(AXIS, view[1] > 0 ? y + 3 : y - 3, 3.2, P), { tone: "lo" }) }));
  return out.join("");
}

const crankshaft = () => S_(G.disc(FLY.y0 - 2, YU[1] + 5, 2, AXIS, P), { tone: "hi", crease: "none" });

// ---------------------------------------------------------------- lamp and stand
function lamp(theta = THETA0, heat = 1) {
  const [x, y] = D;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 13, y: y - 13, w: 26, d: 26, r: 13 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S_(k.cylinder(x, y, 11, 0, 5, P, 40, 0.5), { tone: "mid", inner: L(k.sideArc(x, y, 11, 2.5, P, 40), { tone: "faint" }) }));
  out.push(S_(k.cylinder(x, y, 6, 5, 2, P, 28, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 1.8, 7, 2.5, P, 16), { tone: "lo", crease: "none" }));
  out.push(`<g data-flame>${flame(heat)}</g>`);
  return out.join("");
}

// The flame: a teardrop from the wick up toward the hot cap, taller when the
// lamp is turned up. Sized in world units, so it scales with the figure.
function flame(heat) {
  const [bx, by] = at([D[0], D[1], 9.5]);
  const top = at([D[0], D[1], 20 + 12 * heat]);
  const h = by - top[1];
  const w = (2.6 + 1.4 * heat) * (h / (10.5 + 12 * heat));
  const d = `M${bx.toFixed(2)} ${(by + 0.6).toFixed(2)} C${(bx - w * 1.6).toFixed(2)} ${(by - h * 0.25).toFixed(2)} ${(bx - w * 0.3).toFixed(2)} ${(by - h * 0.7).toFixed(2)} ${bx.toFixed(2)} ${(by - h).toFixed(2)} C${(bx + w * 0.3).toFixed(2)} ${(by - h * 0.7).toFixed(2)} ${(bx + w * 1.6).toFixed(2)} ${(by - h * 0.25).toFixed(2)} ${bx.toFixed(2)} ${(by + 0.6).toFixed(2)} Z`;
  return `<path class="eng-flame" d="${d}"/><path class="eng-flame-core" d="${d}" transform="translate(${bx.toFixed(2)} ${by.toFixed(2)}) scale(0.45 0.55) translate(${(-bx).toFixed(2)} ${(-by).toFixed(2)})"/>`;
}

function stand(back) {
  // three legs and a ring that carries the displacer cylinder over the lamp
  const [x, y] = D;
  const out = [];
  const legs = [90, 210, 330].map((deg) => [x + 18 * Math.cos((deg * Math.PI) / 180), y + 18 * Math.sin((deg * Math.PI) / 180)]);
  for (const [lx, ly] of legs) {
    const isBack = k.depthOf([lx, ly, 0], P) < k.depthOf([x, y, 0], P);
    if (isBack !== back) continue;
    out.push(S_(k.cylinder(lx, ly, 2.6, 0, 1.4, P, 16), { tone: "mid" }));
    out.push(S_(k.cylinder(lx, ly, 1.4, 1.4, 28.6, P, 14), { tone: "mid", crease: "none" }));
  }
  if (!back) {
    out.push(S_(k.cylinder(x, y, 21, 30, 3, P, 56, 0.4), { tone: "mid" }));
    out.push(Dots(legs.map(([lx, ly]) => at([lx, ly, 33])), { size: 0.45, tone: "lo" }));
  }
  return out.join("");
}

// ---------------------------------------------------------------- displacer cylinder
const FINS_LOW = [55, 58.3, 61.6];
const FINS_HIGH = [75, 78.3];
function displacerCylinder() {
  const [x, y] = D;
  const out = [];
  // hot cap: dark with heat, two rolled seams
  out.push(S_(k.cylinder(x, y, 16, 33, 19, P, 56, 0.4), { tone: "lo", inner: L(k.sideArc(x, y, 16, 38, P, 56) + k.sideArc(x, y, 16, 46, P, 56), { tone: "faint" }) }));
  out.push(`<path class="eng-glow" d="${k.cylinder(x, y, 16, 33, 19, P, 56).fill}"/>`);
  out.push(S_(k.cylinder(x, y, 18, 52, 2, P, 56, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 14, 54, 28, P, 56), { tone: "mid", crease: "none" }));
  for (const z of FINS_LOW) out.push(S_(k.cylinder(x, y, 22, z, 1.4, P, 64, 0.3), { tone: "mid" }));
  for (const z of FINS_HIGH) out.push(S_(k.cylinder(x, y, 22, z, 1.4, P, 64, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 18, 82, 3, P, 56, 0.4), { tone: "mid" }));
  const bolts = Array.from({ length: 6 }, (_, i) => [x + 15.5 * Math.cos((i * Math.PI) / 3 + 0.3), y + 15.5 * Math.sin((i * Math.PI) / 3 + 0.3)]);
  out.push(L(bolts.map(([bx, by]) => k.ring(bx, by, 1.3, 85, P, 12)).join(""), { tone: "lo" }));
  out.push(Dots(bolts.map(([bx, by]) => at([bx, by, 85])), { size: 0.4 }));
  out.push(S_(k.cylinder(x, y, 5, 85, D_GLAND - 85, P, 24, 0.3), { tone: "mid" }));
  return out.join("");
}

// A rod that slides out of a gland: drawn long, clipped above the gland face, translated along z.
const clipBox = (x0, x1, y0, y1, z0, z1) => k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0 }, z0, z1 - z0, P, 1).fill;
function slidingRod(id, x, y, gland, rest, lit) {
  const travel = 2 * THROW + 6;
  const body = S_(k.cylinder(x, y, 1.6, gland - travel, rest - (gland - travel), P, 16), { tone: lit ? "hi" : "mid", crease: "none", lit });
  const knuckle = S_(k.cylinder(x, y, 2.8, rest - 1.5, 3.4, P, 18, 0.3), { tone: "mid" });
  return `<clipPath id="${id}-clip"><path d="${clipBox(x - 6, x + 6, y - 6, y + 6, gland, gland + 200)}"/></clipPath><g clip-path="url(#${id}-clip)"><g data-rod="${id}">${body}</g></g><g data-knuckle="${id}">${knuckle}</g>`;
}

// ---------------------------------------------------------------- transfer duct and power cylinder
function duct() {
  const out = [];
  const x0 = D[0] + 13.5, x1 = PW[0] - 9.5;
  out.push(S_(k.slabOf({ x: x0, y: -3, w: x1 - x0, d: 6, r: 1 }, 66, 6, P, 3, 0.4), { tone: "mid" }));
  for (const fx of [x0, x1 - 3]) {
    out.push(S_(k.slabOf({ x: fx, y: -5, w: 3, d: 10, r: 0.8 }, 64.5, 9, P, 3, 0.3), { tone: "mid" }));
    out.push(Dots([at([fx + 1.5, -3.2, 73.5]), at([fx + 1.5, 3.2, 73.5])], { size: 0.4, tone: "lo" }));
  }
  return out.join("");
}

function powerCylinder() {
  const [x, y] = PW;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 14, y: y - 14, w: 28, d: 28, r: 14 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S_(k.cylinder(x, y, 14, 0, 4, P, 48, 0.4), { tone: "mid" }));
  const bolts = [0, 1, 2, 3].map((i) => [x + 11.5 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), y + 11.5 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)]);
  out.push(Dots(bolts.map(([bx, by]) => at([bx, by, 4])), { size: 0.45 }));
  out.push(S_(k.cylinder(x, y, 10, 4, 60, P, 48, 0.3), { tone: "mid", inner: L(k.sideArc(x, y, 10, 20, P, 48) + k.sideArc(x, y, 10, 50, P, 48), { tone: "faint" }) }));
  out.push(S_(k.cylinder(x, y, 12, 64, 2, P, 48, 0.3), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 4, 66, P_GLAND - 66, P, 20, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- moving links (rebuilt each frame)
function links(theta) {
  const a = anglesOf(theta);
  const parts = [];
  for (const [phi, y, x] of [[a.displacer, YD, D[0]], [a.power, YP, PW[0]]]) {
    const pin = pinOf(phi, y);
    const head = [x, 0, headZ(pin, x)];
    const c = at([CX, y, CZ]), p = at(pin), h = at(head);
    parts.push(`<path class="eng-web" d="M${c[0].toFixed(2)} ${c[1].toFixed(2)}L${p[0].toFixed(2)} ${p[1].toFixed(2)}"/>`);
    parts.push(`<path class="eng-rod-bar" d="M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${h[0].toFixed(2)} ${h[1].toFixed(2)}"/>`);
    parts.push(`<circle class="eng-eye" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="2.1"/><circle class="eng-eye" cx="${h[0].toFixed(2)}" cy="${h[1].toFixed(2)}" r="2.1"/>`);
  }
  return parts.join("");
}

const restHead = (which) => {
  const a = anglesOf(THETA0);
  return which === "d" ? headZ(pinOf(a.displacer, YD), D[0]) : headZ(pinOf(a.power, YP), PW[0]);
};

// ---------------------------------------------------------------- assemble
const LABEL =
  "A gamma-type Stirling engine on a bench plate. A spirit lamp heats the dark lower cap of a finned displacer cylinder; the fins keep its upper end cool. A duct joins it to a smaller power cylinder. Both rods drive one crankshaft on two uprights, the displacer leading the power piston by a quarter turn, and a spoked flywheel at the back carries the engine through the cycle.";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    `<defs><linearGradient id="eng-flame-grad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3b82f6"/><stop offset="0.28" stop-color="#f59e0b"/><stop offset="1" stop-color="#f97316" stop-opacity="0.15"/></linearGradient></defs>`,
    plate(),
    flywheel(),
    upright(YU[0]),
    crankshaft(),
    stand(true),
    lamp(),
    stand(false),
    displacerCylinder(),
    slidingRod("eng-d", D[0], D[1], D_GLAND, restHead("d"), false),
    duct(),
    powerCylinder(),
    slidingRod("eng-p", PW[0], PW[1], P_GLAND, restHead("p"), true),
    `<g data-links>${links(THETA0)}</g>`,
    upright(YU[1]),
  ],
});

const fmt = (v, d) => v.toFixed(d);
const readoutOf = (th) => `Th ${fmt(th, 0)} K · W ≈ ${fmt(workOf(th), 2)} J/cycle · Carnot ${fmt(100 * (1 - TC / th), 0)}%`;

const stage = `<div class="iso-stage eng-stage" tabindex="0" role="group" aria-roledescription="engine control" aria-label="Stirling engine. Up and Down arrows turn the flame up or down; Space pauses.">${svg}<span class="eng-sr" aria-live="polite" data-say></span></div>`;
const plateBody = k.plateHtml({
  fig: "Fig 2",
  title: "Stirling engine",
  hint: "↑ ↓ flame · space pause",
  readout: readoutOf(TH0),
  keys: [
    { mark: "lit", label: "Power piston rod: the work comes out here" },
    { mark: "dim", label: "Hot cap over the lamp, finned cold end above" },
  ],
  caption: `The displacer shuttles the air between the hot cap and the cold fins, a quarter turn ahead of the power piston, so the gas is mostly hot while it expands and mostly cold while it is compressed. Ideal Stirling cycle for this engine (bore 18 mm, stroke 18 mm, ${fmt(DEAD * 1e6, 0)} cm³ dead volume, ${fmt(N_MOL * 1000, 2)} mmol of air): W = nR(Th − Tc) ln(Vmax/Vmin) with Tc = ${TC} K; a real engine delivers much less.`,
  body: stage,
});
const fragment = `<div class="iso" data-anatomy="engine">${plateBody}</div>`;

// ---------------------------------------------------------------- CSS, scoped under [data-anatomy="engine"]
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
const ROOTSEL = '[data-anatomy="engine"]';
const FIGURE_CSS = `
.iso[data-anatomy="engine"]{--anatomy-card:#0e0e0f;--anatomy-paper:#0e0e0f;--anatomy-plate-line:#262628;--eng-glow:#ff6a2b;width:100%;max-width:720px;margin:0 auto;color:var(--anatomy-text)}
.iso[data-anatomy="engine"][data-theme="light"],html:not(.dark) .iso[data-anatomy="engine"]{--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-plate-line:#e4e4e7;--eng-glow:#e8590c}
.iso[data-anatomy="engine"] .iso-figure{margin:0}
.iso[data-anatomy="engine"] .iso-plate{box-shadow:0 0 0 1px var(--anatomy-plate-line);border-radius:10px;padding:46px 18px 50px}
.iso[data-anatomy="engine"] .iso-plate-corner{font-family:inherit;font-size:11px}
.iso[data-anatomy="engine"] .iso-plate-corner[data-corner="readout"]{font-variant-numeric:tabular-nums}
.iso[data-anatomy="engine"] .iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.04em}
.iso[data-anatomy="engine"] .iso-legend{font-size:13px}
.iso[data-anatomy="engine"] .eng-stage{position:relative;outline:none;cursor:default}
.iso[data-anatomy="engine"] .eng-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.iso[data-anatomy="engine"] .eng-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso[data-anatomy="engine"] .eng-spoke{fill:none;stroke:var(--anatomy-lo);stroke-width:2.4;stroke-linecap:round}
.iso[data-anatomy="engine"] .eng-web{fill:none;stroke:var(--anatomy-mid);stroke-width:4.2;stroke-linecap:round}
.iso[data-anatomy="engine"] .eng-rod-bar{fill:none;stroke:var(--anatomy-hi);stroke-width:2.6;stroke-linecap:round}
.iso[data-anatomy="engine"] .eng-eye{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:1.2}
.iso[data-anatomy="engine"] .eng-flame{fill:url(#eng-flame-grad);opacity:.9;transform-box:fill-box;transform-origin:50% 100%;animation:eng-flicker 1.6s ease-in-out infinite alternate}
.iso[data-anatomy="engine"] .eng-flame-core{fill:#fde68a;opacity:.85}
.iso[data-anatomy="engine"] .eng-glow{fill:var(--eng-glow);opacity:calc(var(--eng-heat,0.5)*0.32);mix-blend-mode:normal;pointer-events:none}
@keyframes eng-flicker{0%{transform:scaleY(1) skewX(0deg)}50%{transform:scaleY(.93) skewX(2deg)}100%{transform:scaleY(1.04) skewX(-1.5deg)}}
@media (prefers-reduced-motion:reduce){.iso[data-anatomy="engine"] .eng-flame{animation:none}}
@media (max-width:560px){.iso[data-anatomy="engine"] .iso-plate{padding:40px 4px 60px}}
`;
const css = scope(k.ISO_CSS, ROOTSEL) + "\n" + FIGURE_CSS.trim() + "\n";

// ---------------------------------------------------------------- live script (plain ES module)
// pinOf etc. are arrow functions: serialise them as source.
const liveSrc = `
const P = ${JSON.stringify(P)};
const CX = ${CX}, CZ = ${CZ}, THROW = ${THROW}, ROD = ${ROD}, YD = ${YD}, YP = ${YP};
const D = ${JSON.stringify(D)}, PW = ${JSON.stringify(PW)};
const FLY = ${JSON.stringify(FLY)}, FLY_FACE = ${FLY_FACE};
const R = ${R}, TC = ${TC}, N_MOL = ${N_MOL}, VMIN = ${VMIN}, VMAX = ${VMAX};
const REST = { d: ${restHead("d")}, p: ${restHead("p")} };
const at = (p) => iso(p, P);
const pinOf = ${pinOf.toString()};
const headZ = ${headZ.toString()};
const anglesOf = ${anglesOf.toString()};
const workOf = (th) => N_MOL * R * (th - TC) * Math.log(VMAX / VMIN);
const fmt = (v, d) => v.toFixed(d);
const readoutOf = (th) => "Th " + fmt(th, 0) + " K \\u00b7 W \\u2248 " + fmt(workOf(th), 2) + " J/cycle \\u00b7 Carnot " + fmt(100 * (1 - TC / th), 0) + "%";
${spokes.toString()}
${links.toString()}
${flame.toString()}

function mount(root) {
  if (root.dataset.live) return;
  root.dataset.live = "1";
  const html = document.documentElement;
  const sync = () => (html.classList.contains("dark") ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", "light"));
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });

  const stage = root.querySelector(".eng-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const say = root.querySelector("[data-say]");
  const spokeG = svg.querySelector("[data-spokes]");
  const linkG = svg.querySelector("[data-links]");
  const flameG = svg.querySelector("[data-flame]");
  const rods = { d: svg.querySelector('[data-rod="eng-d"]'), p: svg.querySelector('[data-rod="eng-p"]') };
  const knuckles = { d: svg.querySelector('[data-knuckle="eng-d"]'), p: svg.querySelector('[data-knuckle="eng-p"]') };
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let theta = ${THETA0}, th = ${TH0}, shown = th, paused = false, frame = 0, last = 0, visible = false;

  function draw() {
    const a = anglesOf(theta);
    const dz = headZ(pinOf(a.displacer, YD), D[0]) - REST.d;
    const pz = headZ(pinOf(a.power, YP), PW[0]) - REST.p;
    rods.d.setAttribute("transform", translateAlong(P, [0, 0, dz]));
    knuckles.d.setAttribute("transform", translateAlong(P, [0, 0, dz]));
    rods.p.setAttribute("transform", translateAlong(P, [0, 0, pz]));
    knuckles.p.setAttribute("transform", translateAlong(P, [0, 0, pz]));
    spokeG.innerHTML = spokes(theta);
    linkG.innerHTML = links(theta);
    const heat = (shown - 400) / 500;
    flameG.innerHTML = flame(Math.max(0, Math.min(1, heat)));
    root.style.setProperty("--eng-heat", String(Math.max(0, Math.min(1, heat)).toFixed(3)));
    const text = readoutOf(shown);
    if (readout.textContent !== text) readout.textContent = text;
  }

  // Speed grows with the temperature difference (shown slowed: about one turn per 1.5 s at 600 K).
  const omega = () => (2 * Math.PI / 1.5) * Math.max(0, (shown - TC) / 300);
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    shown += (th - shown) * (1 - Math.exp(-dt / 0.6));
    if (!paused && !still.matches) theta += omega() * dt;
    draw();
    frame = visible && (!paused && !still.matches || Math.abs(th - shown) > 0.5) ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") th = Math.min(900, th + (event.shiftKey ? 100 : 25));
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft") th = Math.max(325, th - (event.shiftKey ? 100 : 25));
    else if (event.key === " ") paused = !paused;
    else return;
    event.preventDefault();
    say.textContent = readoutOf(th);
    if (still.matches) { shown = th; draw(); }
    run();
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

function start() { document.querySelectorAll('[data-anatomy="engine"]').forEach(mount); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
`;

const js = `// Generated by figures/engine/build.mjs — do not edit by hand.\n// Inlined: anatomy iso-kit runtime (MIT) + the figure's live code.\n${kitScript()}\n${liveSrc}`;

// ---------------------------------------------------------------- write
writeFileSync(join(OUT, "engine.html"), fragment + "\n");
writeFileSync(join(OUT, "engine.css"), css);
writeFileSync(join(OUT, "engine.js"), js);

const preview = (dark) => `<!doctype html><html lang="en"${dark ? ' class="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stirling engine</title><style>
*{box-sizing:border-box}html{color-scheme:${dark ? "dark" : "light"}}
body{margin:0;background:${dark ? "#0b0b0c" : "#fafafa"};color:${dark ? "#ddd" : "#222"};font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(760px,100% - 24px);margin:40px auto;padding:20px;border-radius:14px;background:${dark ? "#0b0b0c" : "#ffffff"};border:1px solid ${dark ? "#1f1f22" : "#e7e7ea"}}
${css}</style></head><body><main>${fragment}</main><script type="module">${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview(true));
writeFileSync(join(HERE, "preview-light.html"), preview(false));
console.log(`wrote engine.html, engine.css, engine.js, previews · W(600 K) = ${workOf(TH0).toFixed(3)} J · n = ${(N_MOL * 1000).toFixed(3)} mmol`);
