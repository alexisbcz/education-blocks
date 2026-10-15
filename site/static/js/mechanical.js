// Mechanical engineering blocks: involute gears, cam motion laws (the same
// rise–dwell–return–dwell as the cam bench), the four-bar linkage, rolling
// bearing life, helical springs, belt friction, shaft torsion and flywheel
// sizing. The two isometric figures live in ../anatomy/mechanical-*.js.

import "../anatomy/mechanical-planetary.js";
import "../anatomy/mechanical-cam.js";
import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const path = (pts, close = false) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + (close ? "Z" : "");
// Engineering numbers: three significant figures, thin grouping.
const sig = (v, n = 3) => {
  if (!Number.isFinite(v)) return "∞";
  if (v === 0) return "0";
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return Number(v.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d }).replace("-", "−");
};

// A requestAnimationFrame loop behind a play/pause button that stops when
// the block is off screen and never starts under reduced motion.
function animate(root, step, { autoplay = true } = {}) {
  const btn = root.querySelector('[data-action="play"]');
  const label = btn?.querySelector("[data-label]");
  let playing = autoplay && !reduced(), visible = false, raf = 0, last = 0;
  const show = () => {
    if (!btn) return;
    btn.querySelector('[data-icon="play"]')?.toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]')?.toggleAttribute("hidden", !playing);
    if (label) label.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-pressed", String(playing));
  };
  const loop = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    step(dt);
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  btn?.addEventListener("click", () => { playing = !playing; show(); kick(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  show();
}

// ---------------------------------------------------------------- ME2 involute gears

const inv = (a) => Math.tan(a) - a;
// One gear's outline: z teeth, module m, 20° pressure angle, the tooth
// centred on `angle` (radians, y up), drawn at centre (cx, cy), sc px/mm.
function gearOutline(z, m, angle, cx, cy, sc) {
  const alpha = rad(20);
  const r = (m * z) / 2, rb = r * Math.cos(alpha), ra = r + m, rf = r - 1.25 * m;
  const half = Math.PI / (2 * z) + inv(alpha); // half-angle of the tooth at the base circle
  const psi = (rho) => (rho <= rb ? half : half - inv(Math.acos(rb / rho)));
  const flank = [];
  if (rf < rb) flank.push(rf);
  const r0 = Math.max(rf, rb);
  for (let i = 0; i <= 10; i++) flank.push(r0 + ((ra - r0) * i) / 10);
  const pt = (rho, a) => [cx + rho * sc * Math.cos(a), cy - rho * sc * Math.sin(a)];
  const pts = [];
  for (let k = 0; k < z; k++) {
    const c = angle + (2 * Math.PI * k) / z;
    for (const rho of flank) pts.push(pt(rho, c - Math.max(0, psi(rho))));
    for (const rho of [...flank].reverse()) pts.push(pt(rho, c + Math.max(0, psi(rho))));
    // the root arc to the next tooth
    const a0 = c + psi(flank[0]), a1 = c + (2 * Math.PI) / z - psi(flank[0]);
    for (let i = 1; i < 4; i++) pts.push(pt(rf, a0 + ((a1 - a0) * i) / 4));
  }
  return { d: path(pts, true), r, rb, ra, rf };
}

for (const root of document.querySelectorAll("[data-mech-gears]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let stage = false, theta = 0;
  const s = scrubAll(root, () => { layout(); draw(); });
  onToggle(root, (_, on) => { stage = on; draw(); });
  let L;
  function layout() {
    const m = s.m.get(), z1 = Math.round(s.z1.get()), z2 = Math.round(s.z2.get());
    const r1 = (m * z1) / 2, r2 = (m * z2) / 2, a = r1 + r2;
    const span = r1 + m + a + r2 + m, tall = 2 * (Math.max(r1, r2) + m);
    const sc = Math.min(520 / span, 290 / tall);
    const x1 = 20 + (520 - span * sc) / 2 + (r1 + m) * sc;
    L = { m, z1, z2, r1, r2, a, sc, x1, x2: x1 + a * sc, y: 160 };
  }
  function draw() {
    const { m, z1, z2, r1, r2, a, sc, x1, x2, y } = L;
    const alpha = rad(20);
    svg.replaceChildren();
    const g1 = gearOutline(z1, m, theta, x1, y, sc);
    const g2 = gearOutline(z2, m, Math.PI + Math.PI / z2 - (theta * z1) / z2, x2, y, sc);
    const circle = (cx, r, style) => el("circle", { cx, cy: y, r: r * sc, style: "fill:none;" + style }, svg);
    el("path", { d: g2.d, style: "fill:var(--muted);fill-opacity:0.6;stroke:var(--foreground);stroke-opacity:0.55;stroke-width:1;stroke-linejoin:round" }, svg);
    el("path", { d: g1.d, style: "fill:var(--brand);fill-opacity:0.14;stroke:var(--brand);stroke-width:1.2;stroke-linejoin:round" }, svg);
    for (const [cx, g] of [[x1, g1], [x2, g2]]) {
      circle(cx, g.r, "stroke:var(--foreground);stroke-opacity:0.45;stroke-dasharray:5 4");
      circle(cx, g.rb, "stroke:var(--foreground);stroke-opacity:0.2");
      el("circle", { cx, cy: y, r: Math.max(3, g.rf * sc * 0.18), style: "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.5" }, svg);
    }
    // the line of action, tangent to both base circles, and the path of contact on it
    const u = [Math.sin(alpha), Math.cos(alpha)], n = [Math.cos(alpha), -Math.sin(alpha)];
    const P = [x1 + r1 * sc, y];
    const scr = (q) => [q[0], q[1]];
    const T1 = [x1 + g1.rb * n[0] * sc, y - g1.rb * n[1] * sc], T2 = [x2 - g2.rb * n[0] * sc, y + g2.rb * n[1] * sc];
    polyline(svg, [scr(T1), scr(T2)], "stroke:var(--foreground);stroke-opacity:0.35;stroke-width:1");
    const s0 = -(Math.sqrt(g2.ra ** 2 - g2.rb ** 2) - r2 * Math.sin(alpha)), s1 = Math.sqrt(g1.ra ** 2 - g1.rb ** 2) - r1 * Math.sin(alpha);
    const along = (t) => [P[0] + t * u[0] * sc, P[1] - t * u[1] * sc];
    polyline(svg, [along(s0), along(s1)], "stroke:var(--brand);stroke-width:3;stroke-linecap:round");
    el("circle", { cx: P[0], cy: P[1], r: 3, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
    text(svg, 10, 16, `pinion z₁ = ${z1} (driver)`, { class: "fill-foreground font-mono text-[11px]" });
    text(svg, 550, 16, `gear z₂ = ${z2}`, { class: "fill-foreground font-mono text-[11px]", "text-anchor": "end" });
    text(svg, 10, 330, "dashed: pitch circles · thin: base circles · pink: path of contact on the 20° line of action", {});

    const eps = (Math.sqrt(g1.ra ** 2 - g1.rb ** 2) + Math.sqrt(g2.ra ** 2 - g2.rb ** 2) - a * Math.sin(alpha)) / (Math.PI * m * Math.cos(alpha));
    const i1 = z2 / z1;
    o.d.textContent = `${num(m * z1, 1)} / ${num(m * z2, 1)} mm`;
    o.eps.textContent = `${num(eps, 2)}${eps < 1.2 ? " (too low)" : ""}`;
    const zmin = 2 / Math.sin(alpha) ** 2; // 17.1
    const cut = [z1, z2].filter((z) => z < zmin);
    o.cut.textContent = cut.length ? `yes, z < 17 (${cut.join(", ")})` : "none (z ≥ 17)";
    if (stage) {
      const z3 = Math.round(s.z3.get()), z4 = Math.round(s.z4.get()), i2 = z4 / z3;
      o.a.textContent = `${num(a, 1)} + ${num((m * (z3 + z4)) / 2, 1)} mm`;
      o.i.textContent = `${num(i1, 2)} × ${num(i2, 2)} = ${num(i1 * i2, 2)}`;
    } else {
      o.a.textContent = `${num(a, 1)} mm`;
      o.i.textContent = `${num(i1, 3)} (out ${i1 > 1 ? "slower" : "faster"})`;
    }
  }
  layout();
  draw();
  animate(root, (dt) => { theta += dt * 0.35; draw(); });
}

// ---------------------------------------------------------------- ME4 cam motion laws

// Each law on a normalised stroke x ∈ [0, 1]: [s, s′, s″, s‴].
const LAWS = {
  uniform: (x) => [x, 1, 0, 0],
  harmonic: (x) => [(1 - Math.cos(Math.PI * x)) / 2, (Math.PI / 2) * Math.sin(Math.PI * x), (Math.PI ** 2 / 2) * Math.cos(Math.PI * x), -(Math.PI ** 3 / 2) * Math.sin(Math.PI * x)],
  cycloidal: (x) => [x - Math.sin(2 * Math.PI * x) / (2 * Math.PI), 1 - Math.cos(2 * Math.PI * x), 2 * Math.PI * Math.sin(2 * Math.PI * x), 4 * Math.PI ** 2 * Math.cos(2 * Math.PI * x)],
  345: (x) => [10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5, 30 * x ** 2 - 60 * x ** 3 + 30 * x ** 4, 60 * x - 180 * x ** 2 + 120 * x ** 3, 60 - 360 * x + 360 * x ** 2],
};
// The bench's cycle (degrees): rise, dwell, return, dwell.
const CYCLE = [[0, 120, 1], [120, 180, 0], [180, 300, -1], [300, 360, 0]];
const ENDS = {
  uniform: "velocity jumps: a → ∞",
  harmonic: "acceleration jumps: jerk → ∞",
  cycloidal: "a = 0, finite jerk step",
  345: "a = 0, finite jerk step",
};
function camAt(law, phi, h, w) {
  for (const [p0, p1, dir] of CYCLE) {
    if (phi < p0 || phi > p1) continue;
    if (!dir) return [dir === 0 && p0 === 120 ? h : 0, 0, 0, 0];
    const beta = rad(p1 - p0), x = (phi - p0) / (p1 - p0);
    const [s, v, a, j] = LAWS[law](x);
    const k = w / beta;
    return dir > 0 ? [h * s, h * v * k, h * a * k * k, h * j * k ** 3] : [h * (1 - s), -h * v * k, -h * a * k * k, -h * j * k ** 3];
  }
  return [0, 0, 0, 0];
}

for (const root of document.querySelectorAll("[data-mech-camlaw]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  let law = "cycloidal", benchLaw = null, cursor = null, benchPhi = null;
  const bench = () => document.querySelector('[data-anatomy="mechanical-cam"]');
  const select = (v) => root.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.seg === v)));
  onSeg(root, (v) => {
    law = v;
    if (v === "cycloidal" || v === "harmonic") bench()?.dispatchEvent(new CustomEvent("mech-cam-law", { detail: v }));
    draw();
  });
  document.addEventListener("mech-cam", (e) => {
    const { law: l, phi } = e.detail;
    if (l !== benchLaw) {
      const first = benchLaw === null;
      benchLaw = l;
      if (!first && l !== law) { law = l; select(l); draw(); }
    }
    benchPhi = phi;
    cursor?.removeAttribute("visibility");
    if (cursor) cursor.setAttribute("transform", `translate(${cursor.sx(phi).toFixed(1)} 0)`);
  });

  function draw() {
    const h = s.h.get() / 1000, w = (s.rpm.get() * 2 * Math.PI) / 60;
    const N = 721;
    const rows = Array.from({ length: N }, (_, i) => camAt(law, (360 * i) / (N - 1), h, w));
    const peak = (c) => Math.max(...rows.map((r) => Math.abs(r[c])));
    const pv = peak(1), pa = peak(2), pj = peak(3);
    svg.replaceChildren();
    const strips = [
      { c: 0, label: "s (mm)", scale: 1000, max: h * 1000, pos: true, color: "var(--brand)" },
      { c: 1, label: "v (m/s)", scale: 1, max: pv, color: "var(--foreground)" },
      { c: 2, label: "a (m/s²)", scale: 1, max: pa || 1, color: "var(--vec-u)" },
      { c: 3, label: "jerk (m/s³)", scale: 1, max: pj || 1, color: "var(--muted-foreground)" },
    ];
    const H = 72, gap = 22;
    let f0 = null;
    strips.forEach((st, k) => {
      const top = 14 + k * (H + gap);
      const y = st.pos ? [0, st.max * 1.1] : [-st.max * 1.15, st.max * 1.15];
      const f = frame(svg, { box: [58, top, 486, H], x: [0, 360], y, xticks: k === 3 ? [0, 120, 180, 300, 360] : [], yticks: st.pos ? [0, st.max] : [0], yfmt: (v) => sig(v, 2), xlabel: k === 3 ? "cam angle φ (°)" : undefined });
      f0 = f;
      for (const p of [120, 180, 300]) el("line", { x1: f.sx(p), x2: f.sx(p), y1: top, y2: top + H, style: "stroke:currentColor;stroke-opacity:0.1" }, svg);
      text(svg, 62, top + 10, st.label, { class: "fill-foreground font-mono text-[10px]" });
      text(svg, 540, top + 10, st.pos ? `max ${sig(st.max, 3)}` : `±${sig(st.max * st.scale, 3)}`, { "text-anchor": "end" });
      polyline(svg, rows.map((r, i) => [f.sx((360 * i) / (N - 1)), f.sy(r[st.c] * st.scale)]), `stroke:${st.color};stroke-width:1.6`);
      // impulses: infinite acceleration (uniform) or infinite jerk (harmonic, uniform)
      const spikes = (law === "uniform" && st.c >= 2) || (law === "harmonic" && st.c === 3);
      if (spikes) {
        for (const [p, sgn] of [[0, 1], [120, -1], [180, -1], [300, 1]]) {
          const y0 = f.sy(0), y1 = sgn > 0 ? top + 2 : top + H - 2;
          el("line", { x1: f.sx(p), x2: f.sx(p), y1: y0, y2: y1, style: "stroke:var(--brand);stroke-width:2" }, svg);
          el("path", { d: `M${f.sx(p) - 3.5},${y1 + sgn * 6}L${f.sx(p)},${y1}L${f.sx(p) + 3.5},${y1 + sgn * 6}`, style: "fill:none;stroke:var(--brand);stroke-width:2" }, svg);
        }
        text(svg, f.sx(150), top + 22, "∞ impulses", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
      }
    });
    // the bench's angle, kept in sync by the figure's "mech-cam" events
    cursor = el("g", {}, svg);
    cursor.sx = f0.sx;
    el("line", { x1: f0.sx(0), x2: f0.sx(0), y1: 10, y2: 14 + 4 * H + 3 * gap, style: "stroke:var(--foreground);stroke-opacity:0.5;stroke-dasharray:3 3" }, cursor);
    if (benchPhi === null) cursor.setAttribute("visibility", "hidden");
    else cursor.setAttribute("transform", `translate(${f0.sx(benchPhi).toFixed(1)} 0)`);

    o.v.textContent = `${sig(pv)} m/s`;
    o.a.textContent = law === "uniform" ? "∞ (impulses)" : `${sig(pa)} m/s²`;
    o.j.textContent = law === "uniform" || law === "harmonic" ? "∞ (impulses)" : `${sig(pj)} m/s³`;
    o.ends.textContent = ENDS[law];
  }
  draw();
}

// ---------------------------------------------------------------- ME5 four-bar linkage

for (const root of document.querySelectorAll("[data-mech-fourbar]")) {
  const svg = root.querySelector("[data-plot]");
  svg.setAttribute("tabindex", "0");
  const o = outs(root);
  const s = scrubAll(root, () => { prepare(); draw(); });
  let theta = rad(30), dir = 1, P;

  // Loop closure: B is on the circle of radius b about A and of radius c about O₄.
  const solve = (th) => {
    const a = s.a.get(), b = s.b.get(), c = s.c.get(), d = s.d.get();
    const A = [a * Math.cos(th), a * Math.sin(th)];
    const ex = d - A[0], ey = -A[1], e = Math.hypot(ex, ey);
    if (e > b + c || e < Math.abs(b - c) || e === 0) return null;
    const along = (b * b - c * c + e * e) / (2 * e), hgt = Math.sqrt(Math.max(0, b * b - along * along));
    const ux = ex / e, uy = ey / e;
    const B = [A[0] + along * ux - hgt * uy, A[1] + along * uy + hgt * ux]; // the open branch, B above A→O₄
    const ab = [B[0] - A[0], B[1] - A[1]];
    const u = s.u.get(), w = s.w.get();
    const C = [A[0] + u * ab[0] - w * ab[1], A[1] + u * ab[1] + w * ab[0]];
    const mu = Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - e * e) / (2 * b * c))));
    return { A, B, C, mu };
  };
  function prepare() {
    const a = s.a.get(), d = s.d.get();
    const curve = [];
    let run = [];
    for (let i = 0; i <= 360; i++) {
      const q = solve(rad(i));
      if (q) run.push(q.C);
      else if (run.length) { curve.push(run); run = []; }
    }
    if (run.length) curve.push(run);
    const pts = [...curve.flat(), [-a, -a], [a, a], [d, 0], [0, 0]];
    for (let i = 0; i < 360; i += 10) { const q = solve(rad(i)); if (q) pts.push(q.B); }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min(500 / (x1 - x0 || 1), 300 / (y1 - y0 || 1));
    const ox = 280 - ((x0 + x1) / 2) * sc, oy = 175 + ((y0 + y1) / 2) * sc;
    P = { curve, map: (p) => [ox + p[0] * sc, oy - p[1] * sc] };
    if (!solve(theta)) { // start where the linkage assembles
      for (let i = 0; i < 360; i++) if (solve(rad(i))) { theta = rad(i); break; }
    }
  }
  function classify() {
    const L = { crank: s.a.get(), coupler: s.b.get(), rocker: s.c.get(), ground: s.d.get() };
    const sorted = Object.entries(L).sort((x, y) => x[1] - y[1]);
    const sl = sorted[0][1] + sorted[3][1], pq = sorted[1][1] + sorted[2][1];
    const short = sorted[0][0];
    let kind;
    if (Math.abs(sl - pq) < 1e-9) kind = "change point (folds flat)";
    else if (sl > pq) kind = "non-Grashof: triple rocker";
    else kind = { ground: "Grashof: double crank", crank: "Grashof: crank-rocker", coupler: "Grashof: double rocker", rocker: "Grashof: rocker-crank" }[short];
    return { sl, pq, kind, sorted };
  }
  function draw() {
    const q = solve(theta);
    const m = P.map;
    svg.replaceChildren();
    for (const run of P.curve) polyline(svg, run.map(m), "stroke:var(--brand);stroke-width:1.5;stroke-opacity:0.8");
    const O2 = m([0, 0]), O4 = m([s.d.get(), 0]);
    // ground: hatched mounts and the fixed link
    polyline(svg, [O2, O4], "stroke:var(--foreground);stroke-opacity:0.25;stroke-width:2;stroke-dasharray:6 4");
    for (const g of [O2, O4]) {
      el("path", { d: `M${g[0]},${g[1]}l-9,14h18z`, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.5" }, svg);
      polyline(svg, [[g[0] - 13, g[1] + 14], [g[0] + 13, g[1] + 14]], "stroke:var(--foreground);stroke-opacity:0.5;stroke-width:1.2");
    }
    if (q) {
      const A = m(q.A), B = m(q.B), C = m(q.C);
      el("path", { d: path([A, B, C], true), style: "fill:var(--brand);fill-opacity:0.1;stroke:var(--brand);stroke-opacity:0.4;stroke-linejoin:round" }, svg);
      polyline(svg, [O4, B], "stroke:var(--vec-u);stroke-width:5;stroke-linecap:round");
      polyline(svg, [A, B], "stroke:var(--foreground);stroke-width:5;stroke-linecap:round");
      polyline(svg, [O2, A], "stroke:var(--brand);stroke-width:5;stroke-linecap:round");
      for (const p of [O2, O4, A, B]) el("circle", { cx: p[0], cy: p[1], r: 3.2, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, svg);
      el("circle", { cx: C[0], cy: C[1], r: 4, style: "fill:var(--brand)" }, svg);
    }
    text(svg, 10, 16, "crank", { style: "fill:var(--brand)", class: "font-mono text-[11px]" });
    text(svg, 56, 16, "coupler", { class: "fill-foreground font-mono text-[11px]" });
    text(svg, 116, 16, "rocker", { style: "fill:var(--vec-u)", class: "font-mono text-[11px]" });
    text(svg, 168, 16, "· coupler curve", { style: "fill:var(--brand)", class: "font-mono text-[11px]" });

    const k = classify();
    o.sl.textContent = `${num(k.sorted[0][1], 1)} + ${num(k.sorted[3][1], 1)} = ${num(k.sl, 1)}`;
    o.pq.textContent = `${num(k.sorted[1][1], 1)} + ${num(k.sorted[2][1], 1)} = ${num(k.pq, 1)}`;
    o.kind.textContent = k.kind;
    o.th.textContent = `${num(((deg(theta) % 360) + 360) % 360, 0)}°`;
    o.mu.textContent = q ? `μ = ${num(deg(q.mu), 0)}°${deg(q.mu) < 40 || deg(q.mu) > 140 ? " (poor)" : ""}` : "no assembly";
  }
  // The crank turns; where the loop cannot close it bounces back (a dead point).
  function step(dth) {
    const next = theta + dir * dth;
    if (solve(next)) theta = next;
    else dir = -dir;
  }
  svg.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const t = theta + rad(e.key === "ArrowRight" ? 5 : -5);
    if (solve(t)) theta = t;
    draw();
  });
  prepare();
  draw();
  animate(root, (dt) => { step(dt * 1.2); draw(); });
}

// ---------------------------------------------------------------- ME6 bearing life

for (const root of document.querySelectorAll("[data-mech-bearing]")) {
  const svg = root.querySelector("[data-plot]"), surv = root.querySelector("[data-surv]");
  const o = outs(root);
  let kind = "ball";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });
  const BETA = 1.5; // Weibull shape typical of rolling contact fatigue
  const pow = (k) => (k === "ball" ? 3 : 10 / 3);
  const life = (cp, k) => cp ** pow(k);
  const pretty = (v) => (v >= 1000 ? `${sig(v / 1000, 3)}k` : sig(v, 2));

  function draw() {
    const C = s.C.get(), P = s.P.get(), rpm = s.rpm.get();
    const cp = C / P, L10 = life(cp, kind);
    const hours = (L10 * 1e6) / (60 * rpm);
    const eta = L10 / Math.log(1 / 0.9) ** (1 / BETA);
    const L50 = eta * Math.log(2) ** (1 / BETA);

    svg.replaceChildren();
    const lx = Math.log10;
    const f = frame(svg, { box: [58, 16, 480, 196], x: [lx(0.5), lx(30)], y: [-1, 5], xticks: [1, 2, 5, 10, 20].map(lx), yticks: [-1, 0, 1, 2, 3, 4, 5], xfmt: (v) => sig(10 ** v, 1), yfmt: (v) => pretty(10 ** v), xlabel: "C / P (log)", ylabel: "L₁₀ (million revolutions, log)" });
    for (const k of ["roller", "ball"]) {
      const pts = Array.from({ length: 80 }, (_, i) => { const x = lx(0.5) + ((lx(30) - lx(0.5)) * i) / 79; return [f.sx(x), f.sy(Math.min(5.2, lx(life(10 ** x, k))))]; });
      polyline(svg, pts, k === kind ? "stroke:var(--brand);stroke-width:2.2" : "stroke:var(--muted-foreground);stroke-width:1.2;stroke-dasharray:4 4");
    }
    text(svg, f.sx(lx(14)), f.sy(lx(life(14, "roller"))) - 8, "roller, p = 10/3", { "text-anchor": "end" });
    text(svg, f.sx(lx(22)), f.sy(lx(life(22, "ball"))) + 16, "ball, p = 3", { "text-anchor": "end" });
    const cx = Math.max(lx(0.5), Math.min(lx(30), lx(cp))), cy = Math.max(-1, Math.min(5, lx(L10)));
    el("line", { x1: f.sx(cx), x2: f.sx(cx), y1: f.sy(-1), y2: f.sy(cy), style: "stroke:var(--foreground);stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
    el("line", { x1: f.sx(lx(0.5)), x2: f.sx(cx), y1: f.sy(cy), y2: f.sy(cy), style: "stroke:var(--foreground);stroke-opacity:0.3;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(cx), cy: f.sy(cy), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);

    surv.replaceChildren();
    const xmax = L10 * 6;
    const g = frame(surv, { box: [58, 14, 480, 100], x: [0, xmax], y: [0, 1], xticks: [0, L10, L50].map((v) => Math.round(v * 100) / 100), yticks: [0, 0.5, 0.9, 1], xfmt: (v) => sig(v, 2), yfmt: (v) => `${Math.round(v * 100)}%`, xlabel: "life (million revolutions)", ylabel: "still running" });
    const pts = Array.from({ length: 120 }, (_, i) => { const L = (xmax * i) / 119; return [g.sx(L), g.sy(Math.exp(-((L / eta) ** BETA)))]; });
    el("path", { d: path([...pts, [g.sx(xmax), g.sy(0)], [g.sx(0), g.sy(0)]], true), style: "fill:var(--brand);fill-opacity:0.1;stroke:none" }, surv);
    polyline(surv, pts, "stroke:var(--brand);stroke-width:1.8");
    for (const [L, R, lab] of [[L10, 0.9, "L₁₀"], [L50, 0.5, "L₅₀"]]) {
      el("circle", { cx: g.sx(L), cy: g.sy(R), r: 3.5, style: "fill:var(--background);stroke:var(--foreground);stroke-width:1.5" }, surv);
      text(surv, g.sx(L) + 7, g.sy(R) - 5, lab, { class: "fill-foreground font-mono text-[10px]" });
    }

    o.cp.textContent = num(cp, 2);
    o.l10.textContent = `${sig(L10)} million rev`;
    o.hours.textContent = `${sig(hours)} h${hours > 8760 ? ` (${sig(hours / 8760, 2)} years nonstop)` : ""}`;
    o.l50.textContent = `${sig(L50)} million rev`;
  }
  draw();
}

// ---------------------------------------------------------------- ME7 helical springs

for (const root of document.querySelectorAll("[data-mech-spring]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let mode = "one";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { mode = v; draw(); });

  // A side view of a coil spring between y0 (bottom) and y1 (top).
  function coil(cx, y0, y1, Dpx, dpx, n) {
    const turns = n + 2, steps = Math.ceil(turns * 24);
    const back = [], front = [];
    let run = [], near = null;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns * 2 * Math.PI;
      const p = [cx + (Dpx / 2) * Math.sin(t), y0 - ((y0 - y1 - dpx) * i) / steps - dpx / 2 + 0.18 * dpx * Math.cos(t) * 0];
      const facing = Math.cos(t) > 0;
      if (near === null) near = facing;
      if (facing !== near) { run.push(p); (near ? front : back).push(run); run = [p]; near = facing; } else run.push(p);
    }
    if (run.length > 1) (near ? front : back).push(run);
    for (const r of back) polyline(svg, r, `stroke:var(--muted-foreground);stroke-opacity:0.5;stroke-width:${Math.max(1, dpx).toFixed(1)};stroke-linecap:round`);
    for (const r of front) polyline(svg, r, `stroke:var(--brand);stroke-width:${Math.max(1.2, dpx).toFixed(1)};stroke-linecap:round`);
  }

  function draw() {
    const d = s.d.get(), D = s.D.get(), n = s.n.get(), G = s.G.get() * 1000, F = s.F.get();
    const C = D / d;
    const k = (G * d ** 4) / (8 * D ** 3 * n); // N/mm
    const Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C;
    const kset = mode === "series" ? k / 2 : mode === "parallel" ? 2 * k : k;
    const Fone = mode === "parallel" ? F / 2 : F;
    const tau = (Kw * 8 * Fone * D) / (Math.PI * d ** 3);
    const L0 = n * (d + 0.3 * D) + 2 * d, travel = n * 0.3 * D; // free length, travel to solid
    const xone = Fone / k, solid = xone >= travel;
    const x = F / kset;

    svg.replaceChildren();
    // the springs, to scale
    const stack = mode === "series" ? 2 : 1, side = mode === "parallel" ? 2 : 1;
    const sc = Math.min(230 / (stack * L0 + 10), 90 / ((D + d) * side));
    const base = 296, Dpx = D * sc, dpx = d * sc;
    const xc = 120;
    const xs = side === 2 ? [xc - Dpx * 0.75, xc + Dpx * 0.75] : [xc];
    const each = Math.min(xone, travel);
    let top = base;
    for (let k2 = 0; k2 < stack; k2++) {
      const h = (L0 - each) * sc;
      for (const cx of xs) coil(cx, top, top - h, Dpx, dpx, n);
      top -= h;
      if (k2 < stack - 1) { el("rect", { x: xc - Dpx * 0.7, y: top - 4, width: Dpx * 1.4, height: 4, rx: 1, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.4" }, svg); top -= 4; }
    }
    const wide = side === 2 ? Dpx * 2.4 : Dpx * 1.5;
    el("rect", { x: xc - wide / 2, y: base, width: wide, height: 6, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.4" }, svg);
    el("rect", { x: xc - wide / 2, y: top - 6, width: wide, height: 6, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.4" }, svg);
    const ay = top - 8;
    polyline(svg, [[xc, ay - 34], [xc, ay]], "stroke:var(--foreground);stroke-width:2");
    el("path", { d: `M${xc - 5},${ay - 8}L${xc},${ay}L${xc + 5},${ay - 8}`, style: "fill:none;stroke:var(--foreground);stroke-width:2" }, svg);
    text(svg, xc + 8, ay - 22, `F = ${sig(F)} N`, { class: "fill-foreground font-mono text-[11px]" });
    // free height, dashed
    const freeTop = base - stack * L0 * sc - (stack - 1) * 4 - 6;
    el("line", { x1: xc + wide / 2 + 6, x2: xc + wide / 2 + 22, y1: freeTop, y2: freeTop, style: "stroke:var(--foreground);stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
    text(svg, xc + wide / 2 + 24, freeTop + 3, "free", {});

    // force–deflection
    const xmax = Math.max(travel * (mode === "series" ? 2 : 1), x) * 1.1;
    const ytop = Math.max(F, kset * xmax) * 1.05;
    const f = frame(svg, { box: [290, 24, 250, 250], x: [0, xmax], y: [0, ytop], xticks: [0, Math.round(xmax / 2), Math.round(xmax)], yticks: [0, Math.round(F)], xfmt: (v) => sig(v, 2), yfmt: (v) => sig(v, 3), xlabel: "deflection (mm)" });
    text(svg, f.L, f.T - 8, "force (N)", {});
    const xk = Math.min(xmax, ytop / k);
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(xk), f.sy(k * xk)]], "stroke:var(--muted-foreground);stroke-width:1.2;stroke-dasharray:4 4");
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(xmax), f.sy(kset * xmax)]], "stroke:var(--brand);stroke-width:2");
    const solidX = travel * (mode === "series" ? 2 : 1);
    el("line", { x1: f.sx(solidX), x2: f.sx(solidX), y1: f.T, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);
    text(svg, f.sx(solidX) - 4, f.T + 10, "solid", { "text-anchor": "end" });
    el("circle", { cx: f.sx(Math.min(x, xmax)), cy: f.sy(F), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    if (mode !== "one") text(svg, f.sx(xk) - 6, f.sy(k * xk) + (mode === "series" ? 12 : 14), "one spring", { "text-anchor": "end" });

    o.c.textContent = `${num(C, 1)}${C < 4 ? " (hard to coil)" : C > 12 ? " (prone to buckle/tangle)" : ""}`;
    o.k.textContent = `${sig(k)} N/mm`;
    o.kset.textContent = `${sig(kset)} N/mm`;
    o.x.textContent = solid ? `${sig(x)} mm — goes solid` : `${sig(x)} mm`;
    o.kw.textContent = num(Kw, 3);
    o.tau.textContent = `${sig(tau)} MPa`;
  }
  draw();
}

// ---------------------------------------------------------------- ME8 belt friction

for (const root of document.querySelectorAll("[data-mech-belt]")) {
  const drive = root.querySelector("[data-drive]"), svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let vbelt = false;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { vbelt = on; draw(); });
  const GROOVE = rad(40);

  function draw() {
    const mu = s.mu.get(), th = rad(s.theta.get()), T1 = s.T1.get(), v = s.v.get();
    const me = vbelt ? mu / Math.sin(GROOVE / 2) : mu;
    const ratio = Math.exp(me * th), T2 = T1 / ratio;

    // The pulley, the belt wrapped θ around it (a spiral past one turn), its
    // width growing with the tension e^(μφ) from the slack side.
    drive.replaceChildren();
    const c = [300, 95], R = 58;
    const rOf = (phi) => R + 7 * (phi / (2 * Math.PI)) + 3;
    const ptOf = (phi) => { const a = Math.PI / 2 - phi, r = rOf(phi); return [c[0] + r * Math.cos(a), c[1] - r * Math.sin(a)]; };
    el("circle", { cx: c[0], cy: c[1], r: R, style: "fill:var(--muted);stroke:var(--foreground);stroke-opacity:0.5" }, drive);
    el("circle", { cx: c[0], cy: c[1], r: 6, style: "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.5" }, drive);
    const wOf = (T) => 1.5 + 9 * (T / T1);
    const N = Math.max(20, Math.ceil(th / rad(4)));
    for (let i = 0; i < N; i++) {
      const p0 = (th * i) / N, p1 = (th * (i + 1)) / N;
      const T = T2 * Math.exp(me * (p0 + p1) / 2);
      polyline(drive, [ptOf(p0), ptOf(p1)], `stroke:var(--brand);stroke-width:${wOf(T).toFixed(1)};stroke-linecap:round`);
    }
    // the slack tail leaves the top going left; the tight tail leaves along the tangent at θ
    const p0 = ptOf(0);
    polyline(drive, [[p0[0] - 230, p0[1]], p0], `stroke:var(--brand);stroke-opacity:0.35;stroke-width:${wOf(T2).toFixed(1)};stroke-linecap:round`);
    const pe = ptOf(th), a = Math.PI / 2 - th, tang = [Math.sin(a), Math.cos(a)];
    const tail = [pe[0] + tang[0] * 230, pe[1] + tang[1] * 230];
    polyline(drive, [pe, tail], `stroke:var(--brand);stroke-width:${wOf(T1).toFixed(1)};stroke-linecap:round`);
    text(drive, p0[0] - 220, p0[1] - 10, `T₂ = ${sig(T2)} N (slack)`, { class: "fill-foreground font-mono text-[11px]" });
    const lab = [pe[0] + tang[0] * 120, pe[1] + tang[1] * 120];
    text(drive, Math.max(10, Math.min(550, lab[0])), Math.max(14, Math.min(184, lab[1] + 18)), `T₁ = ${sig(T1)} N (tight)`, { class: "fill-foreground font-mono text-[11px]", "text-anchor": lab[0] > 300 ? "end" : "start" });
    text(drive, c[0] + R + 40, 20, `wrap θ = ${num(s.theta.get(), 0)}°`, { "text-anchor": "start" });

    svg.replaceChildren();
    const ymax = Math.exp(me * rad(720));
    const f = frame(svg, { box: [58, 14, 480, 120], x: [0, 720], y: [0, Math.min(ymax, 60) * 1.05], xticks: [0, 180, 360, 540, 720], yticks: [1, Math.round(Math.min(ymax, 60) / 2), Math.round(Math.min(ymax, 60))], xfmt: (v) => `${v}°`, xlabel: "wrap angle θ", ylabel: "T₁ / T₂" });
    const top = Math.min(ymax, 60) * 1.05;
    const curve = (m) => Array.from({ length: 145 }, (_, i) => Math.exp(m * rad(i * 5))).map((y, i) => [f.sx(i * 5), y]).filter(([, y]) => y <= top).map(([x, y]) => [x, f.sy(y)]);
    polyline(svg, curve(mu), vbelt ? "stroke:var(--muted-foreground);stroke-width:1.2;stroke-dasharray:4 4" : "stroke:var(--brand);stroke-width:2");
    polyline(svg, curve(mu / Math.sin(GROOVE / 2)), vbelt ? "stroke:var(--brand);stroke-width:2" : "stroke:var(--muted-foreground);stroke-width:1.2;stroke-dasharray:4 4");
    if (ratio <= Math.min(ymax, 60) * 1.05) el("circle", { cx: f.sx(s.theta.get()), cy: f.sy(ratio), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:1.5" }, svg);
    text(svg, f.sx(290), 26, vbelt ? "dashed: flat belt" : "dashed: V-belt, 40° groove", {});

    o.ratio.textContent = `${num(ratio, 3)}${vbelt ? ` (μ′ = ${num(me, 3)})` : ""}`;
    o.T2.textContent = `${sig(T2)} N`;
    o.pull.textContent = `${sig(T1 - T2)} N`;
    o.pw.textContent = `${sig(((T1 - T2) * v) / 1000)} kW`;
  }
  draw();
}

// ---------------------------------------------------------------- ME9 shaft torsion

for (const root of document.querySelectorAll("[data-mech-torsion]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function section(cx, cy, Rpx, rpx, label, sub) {
    // shear grows with radius: rings tinted by r/R
    const rings = 14;
    for (let i = rings; i >= 1; i--) {
      const r = (Rpx * i) / rings;
      if (r <= rpx) break;
      el("circle", { cx, cy, r, style: `fill:var(--brand);fill-opacity:${(0.06 + 0.5 * (i / rings) ** 1.2).toFixed(3)};stroke:none` }, svg);
    }
    el("circle", { cx, cy, r: Rpx, style: "fill:none;stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.2" }, svg);
    if (rpx > 0) el("circle", { cx, cy, r: rpx, style: "fill:var(--background);stroke:var(--foreground);stroke-opacity:0.6;stroke-width:1.2" }, svg);
    text(svg, cx, cy + 92, label, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    text(svg, cx, cy + 106, sub, { "text-anchor": "middle" });
  }

  function draw() {
    const T = s.T.get(), D = s.D.get(), k = s.k.get(), L = s.L.get(), G = s.G.get();
    const d = k * D;
    const J = (Math.PI * (D ** 4 - d ** 4)) / 32; // mm⁴
    const tau = (T * 1000 * (D / 2)) / J; // MPa
    const phi = (T * L) / (G * 1e9 * J * 1e-12); // rad
    const Ds = Math.sqrt(D * D - d * d); // same area, so the same mass
    const Js = (Math.PI * Ds ** 4) / 32;
    const tauS = (T * 1000 * (Ds / 2)) / Js;

    svg.replaceChildren();
    const sc = 70 / (D / 2);
    section(85, 120, 70, (d / 2) * sc, "hollow", `D ${sig(D)} · d ${sig(d)} mm`);
    section(215, 120, (Ds / 2) * sc, 0, "solid, same mass", `D ${sig(Ds)} mm`);

    const f = frame(svg, { box: [320, 20, 220, 220], x: [0, D / 2], y: [0, Math.max(tau, tauS) * 1.1], xticks: [0, Math.round(d / 2), Math.round(Ds / 2), Math.round(D / 2)].filter((v, i, a) => a.indexOf(v) === i), yticks: [0, Math.round(tau), Math.round(tauS)], xfmt: (v) => sig(v, 2), yfmt: (v) => sig(v, 3), xlabel: "radius r (mm)", ylabel: "shear τ (MPa)" });
    polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(Ds / 2), f.sy(tauS)]], "stroke:var(--muted-foreground);stroke-width:1.6;stroke-dasharray:4 4");
    if (d > 0) polyline(svg, [[f.sx(0), f.sy(0)], [f.sx(d / 2), f.sy((tau * d) / D)]], "stroke:var(--brand);stroke-opacity:0.3;stroke-width:1;stroke-dasharray:2 3");
    polyline(svg, [[f.sx(d / 2), f.sy((tau * d) / D)], [f.sx(D / 2), f.sy(tau)]], "stroke:var(--brand);stroke-width:2.2");
    text(svg, f.sx(D / 2) - 4, f.sy(tau) - 6, "hollow", { "text-anchor": "end", style: "fill:var(--brand)" });
    text(svg, f.sx(Ds / 2) + 4, f.sy(tauS) + 2, "solid", {});
    text(svg, 330, 290, "τ = T·r / J, largest at the skin", {});

    o.J.textContent = `${sig(J)} mm⁴`;
    o.tau.textContent = `${sig(tau)} MPa`;
    o.phi.textContent = `${sig(deg(phi))}° over ${num(L, 1)} m`;
    o.solid.textContent = `τ ${sig(tauS)} MPa (${tauS >= tau ? "+" : "−"}${sig(Math.abs(tauS / tau - 1) * 100, 2)}%)`;
    o.save.textContent = `${sig(k * k * 100, 2)}% lighter, ${sig(k ** 4 * 100, 2)}% less stiff than solid D`;
  }
  draw();
}

// ---------------------------------------------------------------- ME10 flywheel

// Synthetic single-cylinder four-stroke torque over 720°, in arbitrary units:
// power, exhaust, intake, compression.
function strokeShape(t) {
  const x = (t % 720) / 180, k = Math.floor(x), f = x - k, sn = Math.sin(Math.PI * f);
  if (k === 0) return 8 * sn * (1 - 0.72 * f);
  if (k === 1) return -0.45 * sn;
  if (k === 2) return -0.3 * sn;
  return -2.4 * sn * f;
}
const SHAPE = Array.from({ length: 721 }, (_, i) => strokeShape(i));
const SHAPE_MEAN = SHAPE.slice(0, 720).reduce((a, b) => a + b, 0) / 720;

for (const root of document.querySelectorAll("[data-mech-flywheel]")) {
  const svg = root.querySelector("[data-plot]"), spd = root.querySelector("[data-speed]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const rpm = s.rpm.get(), tq = s.tq.get(), I = s.I.get();
    const wm = (rpm * 2 * Math.PI) / 60;
    const T = SHAPE.map((v) => (tq * v) / SHAPE_MEAN);
    // surplus energy, integrated over the crank angle in radians
    const E = [0];
    for (let i = 1; i <= 720; i++) E.push(E[i - 1] + ((T[i - 1] + T[i]) / 2 - tq) * rad(1));
    const Emean = E.reduce((a, b) => a + b, 0) / E.length;
    const dE = Math.max(...E) - Math.min(...E);
    const w2 = E.map((e) => wm * wm + (2 * (e - Emean)) / I);
    const stalls = w2.some((v) => v <= 0);
    const w = w2.map((v) => Math.sqrt(Math.max(v, 0)));
    const wmax = Math.max(...w), wmin = Math.min(...w);
    const cs = (wmax - wmin) / wm;

    svg.replaceChildren();
    const tmax = Math.max(...T), tmin = Math.min(...T);
    const f = frame(svg, { box: [58, 14, 480, 160], x: [0, 720], y: [tmin * 1.1, tmax * 1.05], xticks: [0, 180, 360, 540, 720], yticks: [Math.round(tmin), Math.round(tq), Math.round(tmax)], xfmt: (v) => `${v}°`, ylabel: "torque (N·m)" });
    // surplus above the load shaded brand, deficit muted
    const area = (above) => {
      const pts = T.map((t, i) => [f.sx(i), f.sy(above ? Math.max(t, tq) : Math.min(t, tq))]);
      return path([[f.sx(0), f.sy(tq)], ...pts, [f.sx(720), f.sy(tq)]], true);
    };
    el("path", { d: area(true), style: "fill:var(--brand);fill-opacity:0.18;stroke:none" }, svg);
    el("path", { d: area(false), style: "fill:var(--muted-foreground);fill-opacity:0.15;stroke:none" }, svg);
    polyline(svg, T.map((t, i) => [f.sx(i), f.sy(t)]), "stroke:var(--brand);stroke-width:1.8");
    polyline(svg, [[f.sx(0), f.sy(tq)], [f.sx(720), f.sy(tq)]], "stroke:var(--foreground);stroke-width:1.2;stroke-dasharray:5 4");
    text(svg, f.sx(716), f.sy(tq) - 5, "load", { "text-anchor": "end" });
    ["power", "exhaust", "intake", "compression"].forEach((n, i) => text(svg, f.sx(90 + 180 * i), 196, n, { "text-anchor": "middle" }));

    spd.replaceChildren();
    const r = (x) => (x * 60) / (2 * Math.PI);
    const pad = Math.max((wmax - wmin) * 0.2, wm * 0.002);
    const g = frame(spd, { box: [58, 12, 480, 90], x: [0, 720], y: [r(wmin - pad), r(wmax + pad)], xticks: [0, 180, 360, 540, 720], yticks: [r(wmin), r(wm), r(wmax)], xfmt: (v) => `${v}°`, yfmt: (v) => sig(v, 4), xlabel: "crank angle", ylabel: "speed (rpm)" });
    polyline(spd, w.map((x, i) => [g.sx(i), g.sy(r(x))]), "stroke:var(--vec-u);stroke-width:1.8");

    o.E.textContent = `${sig((0.5 * I * wm * wm) / 1000)} kJ`;
    o.dE.textContent = `${sig(dE)} J per cycle`;
    o.cs.textContent = stalls ? "stalls: wheel too light" : `${sig(cs * 100, 2)}% (≈ ΔE/Iω² = ${sig((dE / (I * wm * wm)) * 100, 2)}%)`;
    o.range.textContent = stalls ? "—" : `${sig(r(wmin), 4)} – ${sig(r(wmax), 4)} rpm`;
    o.need.textContent = `${sig(dE / (0.01 * wm * wm))} kg·m²`;
  }
  draw();
}
