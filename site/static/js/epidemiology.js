// Epidemiology blocks: SIR/SEIR, an agent-based outbreak, flattening the
// curve, exponential growth, 2×2 measures with confidence intervals,
// screening biases, John Snow's map and the incidence/prevalence bathtub.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (v, d = 1) => `${num(v * 100, d)}%`;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RK4 for a vector ODE y' = f(t, y); returns samples every `every` steps. */
function rk4(f, y0, T, dt, every = 10) {
  let y = y0.slice();
  const out = [[0, ...y]];
  for (let i = 1, t = 0; t < T - 1e-9; i++) {
    const k1 = f(t, y);
    const k2 = f(t + dt / 2, y.map((v, j) => v + (dt / 2) * k1[j]));
    const k3 = f(t + dt / 2, y.map((v, j) => v + (dt / 2) * k2[j]));
    const k4 = f(t + dt, y.map((v, j) => v + dt * k3[j]));
    y = y.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    t = i * dt;
    if (i % every === 0) out.push([t, ...y]);
  }
  return out;
}

// SIR on population fractions; beta(t) lets interventions change contact.
const sir = (beta, gamma) => (t, [S, I, R]) => {
  const b = beta(t);
  return [-b * S * I, b * S * I - gamma * I, gamma * I];
};

// Resolves a CSS color to [r,g,b] by painting one pixel.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const probeEl = document.createElement("span");
function rgbOf(css) {
  if (!probeEl.isConnected) { probeEl.hidden = true; document.body.append(probeEl); }
  probeEl.style.color = css;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(probeEl).color;
  probe.fillRect(0, 0, 1, 1);
  return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

// ============================================================ SIR / SEIR

for (const root of document.querySelectorAll("[data-epi-sir]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let model = "sir";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { model = e.detail.value; draw(); });

  function draw() {
    const R0 = s.r0.get(), gamma = 1 / s.inf.get(), sigma = 1 / s.lat.get(), v = s.vax.get() / 100;
    const beta = R0 * gamma, I0 = 1e-4;
    const S0 = (1 - v) * (1 - I0);
    const T = 365;
    const pts = model === "sir"
      ? rk4((t, [S, I, R]) => [-beta * S * I, beta * S * I - gamma * I, gamma * I], [S0, (1 - v) * I0, v], T, 0.1, 10).map(([t, S, I, R]) => [t, S, 0, I, R])
      : rk4((t, [S, E, I, R]) => [-beta * S * I, beta * S * I - sigma * E, sigma * E - gamma * I, gamma * I], [S0, 0, (1 - v) * I0, v], T, 0.1, 10);
    svg.replaceChildren();
    const f = frame(svg, { box: [44, 14, 500, 250], x: [0, T], y: [0, 1], xticks: [0, 90, 180, 270, 365], yticks: [0, 0.5, 1], xlabel: "days", yfmt: (v) => `${v * 100}%` });
    const series = [[1, "var(--vec-u)"], [2, "var(--vec-out)"], [3, "var(--brand)"], [4, "var(--code-add)"]];
    for (const [k, c] of series) {
      if (k === 2 && model === "sir") continue;
      polyline(svg, pts.map((p) => [f.sx(p[0]), f.sy(p[k])]), `stroke:${c};stroke-width:${k === 3 ? 2.25 : 1.5}`);
    }
    const peak = pts.reduce((m, p) => (p[3] > m[3] ? p : m), pts[0]);
    const reff = R0 * S0;
    o.reff.textContent = `${num(reff, 2)} ${reff < 1 ? "(no epidemic)" : ""}`;
    o.herd.textContent = R0 > 1 ? pct(1 - 1 / R0) : "—";
    o.peak.textContent = `${pct(peak[3])} on day ${Math.round(peak[0])}`;
    o.final.textContent = pct(pts.at(-1)[4] - v);
  }
  draw();
}

// ============================================================ Agent-based outbreak

for (const root of document.querySelectorAll("[data-epi-agents]")) {
  const canvas = root.querySelector("[data-canvas]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const btn = root.querySelector("[data-action=play]");
  const W = 90, H = 60, N = W * H;
  let seed = 3, state, timer, day, history, playing = false, handle = 0, visible = false, colors;
  const s = scrubAll(root, () => reset());

  const setPlay = (p) => {
    playing = p;
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", p);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !p);
    btn.querySelector("[data-label]").textContent = p ? "Pause" : "Run";
  };
  const readColors = () => (colors = [rgbOf("var(--vec-u)"), rgbOf("var(--brand)"), rgbOf("var(--code-add)"), rgbOf("var(--code-bg)")]);

  function reset() {
    clearTimeout(handle); handle = 0;
    setPlay(false);
    const rng = mulberry32(seed);
    state = new Uint8Array(N);
    timer = new Uint8Array(N);
    for (let k = 0; k < Math.round(s.seeds.get()); k++) {
      const i = Math.floor(rng() * N);
      state[i] = 1; timer[i] = Math.round(s.days.get());
    }
    root._rng = rng;
    day = 0;
    history = [count()];
    draw();
  }
  const count = () => {
    let I = 0, R = 0;
    for (let i = 0; i < N; i++) state[i] === 1 ? I++ : state[i] === 2 && R++;
    return [N - I - R, I, R];
  };

  function step() {
    const p = s.p.get(), D = Math.round(s.days.get()), rng = root._rng;
    const next = state.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (state[i] !== 1) continue;
      // Each infectious person meets their 8 neighbours once a day.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (state[j] === 0 && next[j] === 0 && rng() < p) { next[j] = 1; timer[j] = D; }
      }
      if (--timer[i] <= 0) next[i] = 2;
    }
    state = next;
    day++;
    history.push(count());
  }

  function draw() {
    const ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = H;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < N; i++) {
      const c = colors[state[i]], a = state[i] === 0 ? 0.25 : 0.9;
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = colors[3][k] * (1 - a) + c[k] * a;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    svg.replaceChildren();
    const T = Math.max(60, history.length);
    const f = frame(svg, { box: [40, 8, 490, 80], x: [0, T], y: [0, 1], xticks: [0, T], yticks: [0, 1], xlabel: "days", yfmt: (v) => `${v * 100}%` });
    // The well-mixed SIR with the same R₀ = 8·(1 − (1 − p)^D), dashed.
    const p = s.p.get(), D = Math.round(s.days.get());
    const R0 = 8 * (1 - (1 - p) ** D);
    const I0 = Math.round(s.seeds.get()) / N;
    const ref = rk4(sir(() => R0 / D, 1 / D), [1 - I0, I0, 0], T, 0.1, 10);
    polyline(svg, ref.map(([t, , I]) => [f.sx(t), f.sy(I)]), "stroke:var(--brand);stroke-width:1;stroke-dasharray:4 3;stroke-opacity:0.7");
    for (const [k, c] of [[0, "var(--vec-u)"], [1, "var(--brand)"], [2, "var(--code-add)"]])
      polyline(svg, history.map((h, t) => [f.sx(t), f.sy(h[k] / N)]), `stroke:${c};stroke-width:1.75`);
    text(svg, f.L + f.W, 20, `dashed: well-mixed SIR, R₀ ≈ ${num(R0, 1)}`, { "text-anchor": "end" });
    const [S, I, R] = history.at(-1);
    o.day.textContent = String(day);
    o.inf.textContent = String(I);
    o.ever.textContent = `${I + R} (${pct((I + R) / N)})`;
  }

  const tick = () => {
    step();
    draw();
    if (history.at(-1)[1] === 0 || day > 400) { setPlay(false); handle = 0; return; }
    handle = playing && visible ? setTimeout(tick, 70) : 0;
  };
  btn.addEventListener("click", () => {
    if (history.at(-1)[1] === 0) reset();
    if (playing) { setPlay(false); clearTimeout(handle); handle = 0; return; }
    setPlay(true);
    if (reduced()) { while (history.at(-1)[1] > 0 && day <= 400) step(); setPlay(false); draw(); return; }
    if (visible && !handle) tick();
  });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; reset(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !handle) tick(); }).observe(root);
  new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  readColors();
  reset();
}

// ============================================================ Flattening the curve

for (const root of document.querySelectorAll("[data-epi-flatten]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const R0 = s.r0.get(), gamma = 1 / 7, care = s.care.get() / 100, cap = s.cap.get() / 100;
    const cut = s.cut.get() / 100, start = s.start.get();
    const T = 365, I0 = 1e-4;
    const base = rk4(sir(() => R0 * gamma, gamma), [1 - I0, I0, 0], T, 0.1, 10);
    const dist = rk4(sir((t) => R0 * gamma * (t >= start ? 1 - cut : 1), gamma), [1 - I0, I0, 0], T, 0.1, 10);
    const need = (pts) => pts.map(([t, , I]) => [t, I * care]);
    const a = need(base), b = need(dist);
    const top = Math.max(cap * 1.4, ...a.map((p) => p[1]), ...b.map((p) => p[1])) * 1.1;
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 492, 250], x: [0, T], y: [0, top], xticks: [0, 90, 180, 270, 365], yticks: [0, cap], xlabel: "days", ylabel: "needing care", yfmt: (v) => `${num(v * 100, 2)}%` });
    // Shade where demand exceeds capacity.
    const over = b.filter(([, v]) => v > cap), over0 = a.filter(([, v]) => v > cap);
    for (const [t, v] of over) el("line", { x1: f.sx(t), x2: f.sx(t), y1: f.sy(v), y2: f.sy(cap), style: "stroke:var(--code-del);stroke-opacity:0.25;stroke-width:1.5" }, svg);
    hline(svg, f, cap, "stroke:var(--code-del);stroke-width:1.5", "capacity");
    if (start < T) el("line", { x1: f.sx(start), x2: f.sx(start), y1: f.T, y2: f.T + f.H, style: "stroke:var(--brand);stroke-opacity:0.4;stroke-dasharray:3 4" }, svg);
    polyline(svg, a.map(([t, v]) => [f.sx(t), f.sy(v)]), "stroke:var(--foreground);stroke-width:1.75;stroke-dasharray:6 4");
    polyline(svg, b.map(([t, v]) => [f.sx(t), f.sy(v)]), "stroke:var(--brand);stroke-width:2.25");
    const peak = (pts) => pts.reduce((m, p) => (p[1] > m[1] ? p : m), pts[0]);
    const pa = peak(a), pb = peak(b);
    o.peak0.textContent = `${num(pa[1] * 100, 2)}% on day ${Math.round(pa[0])}`;
    o.peak1.textContent = `${num(pb[1] * 100, 2)}% on day ${Math.round(pb[0])}`;
    o.over.textContent = `${over0.length} → ${over.length}`; // samples are 1 day apart
  }
  draw();
}

// ============================================================ Exponential growth

for (const root of document.querySelectorAll("[data-epi-growth]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let log = false;
  const s = scrubAll(root, draw);
  onToggle(root, (_, on) => { log = on; draw(); });

  function draw() {
    const r = s.rate.get() / 100, c0 = s.c0.get(), T = Math.round(s.days.get());
    const pts = Array.from({ length: T + 1 }, (_, t) => [t, c0 * (1 + r) ** t]);
    const end = pts.at(-1)[1];
    svg.replaceChildren();
    if (!log) {
      const f = frame(svg, { box: [64, 14, 480, 250], x: [0, T], y: [0, end * 1.05], xticks: [0, T / 2, T], yticks: [0, end / 2, end], xlabel: "days", ylabel: "cases", yfmt: (v) => fmtBig(v) });
      polyline(svg, pts.map(([t, c]) => [f.sx(t), f.sy(c)]), "stroke:var(--brand);stroke-width:2");
    } else {
      const lo = Math.floor(Math.log10(c0)), hi = Math.ceil(Math.log10(end));
      const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const f = frame(svg, { box: [64, 14, 480, 250], x: [0, T], y: [lo, Math.max(hi, lo + 1)], xticks: [0, T / 2, T], yticks: ticks, xlabel: "days", ylabel: "cases (log)", yfmt: (v) => fmtBig(10 ** v) });
      polyline(svg, pts.map(([t, c]) => [f.sx(t), f.sy(Math.log10(c))]), "stroke:var(--brand);stroke-width:2");
    }
    const dbl = Math.LN2 / Math.log(1 + r);
    o.dbl.textContent = `${num(dbl, 1)} days`;
    o.tenfold.textContent = `${num(Math.LN10 / Math.log(1 + r), 1)} days`;
    o.end.textContent = fmtBig(end);
  }
  draw();
}

function fmtBig(v) {
  if (v >= 1e9) return `${num(v / 1e9, 1)}B`;
  if (v >= 1e6) return `${num(v / 1e6, 1)}M`;
  if (v >= 1e4) return `${num(v / 1e3, 0)}k`;
  return num(v, v < 10 ? 1 : 0);
}

// ============================================================ 2×2 table

for (const root of document.querySelectorAll("[data-epi-2x2]")) {
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const [a, bb, c, d] = b.dataset.preset.split(" ").map(Number);
      s.a.set(a, false); s.b.set(bb, false); s.c.set(c, false); s.d.set(d, false);
      draw();
    }));

  function draw() {
    const a = s.a.get(), b = s.b.get(), c = s.c.get(), d = s.d.get();
    const n1 = a + b, n0 = c + d;
    const p1 = n1 ? a / n1 : NaN, p0 = n0 ? c / n0 : NaN;
    o.risk1.textContent = Number.isFinite(p1) ? pct(p1) : "—";
    o.risk0.textContent = Number.isFinite(p0) ? pct(p0) : "—";
    const ci = (est, se) => [est * Math.exp(-1.96 * se), est * Math.exp(1.96 * se)];
    const show = (key, est, lohi, d = 2) => {
      o[key].textContent = Number.isFinite(est) ? num(est, d) : "—";
      o[key + "-ci"].textContent = lohi && lohi.every(Number.isFinite) ? `95% CI ${num(lohi[0], d)} to ${num(lohi[1], d)}` : "CI needs all cells > 0";
    };
    const ok = a > 0 && b > 0 && c > 0 && d > 0;
    const rr = p1 / p0, or = (a * d) / (b * c), rd = p1 - p0;
    show("rr", rr, ok ? ci(rr, Math.sqrt(1 / a - 1 / n1 + 1 / c - 1 / n0)) : null);
    show("or", or, ok ? ci(or, Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)) : null);
    const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p0 * (1 - p0)) / n0);
    o.rd.textContent = Number.isFinite(rd) ? `${num(rd * 100, 1)} pts` : "—";
    o["rd-ci"].textContent = Number.isFinite(se) ? `95% CI ${num((rd - 1.96 * se) * 100, 1)} to ${num((rd + 1.96 * se) * 100, 1)} pts` : "—";
    let note = "";
    if (Number.isFinite(rr) && Number.isFinite(or)) {
      note = p0 < 0.1 && p1 < 0.1
        ? `The outcome is rare (risks under 10%), so the odds ratio (${num(or, 2)}) is close to the risk ratio (${num(rr, 2)}).`
        : `The outcome is common, so the odds ratio (${num(or, 2)}) is further from 1 than the risk ratio (${num(rr, 2)}): reading an OR as a risk ratio would exaggerate the effect.`;
      if (ok) {
        const lo = rr * Math.exp(-1.96 * Math.sqrt(1 / a - 1 / n1 + 1 / c - 1 / n0)), hi = rr * Math.exp(1.96 * Math.sqrt(1 / a - 1 / n1 + 1 / c - 1 / n0));
        note += lo > 1 || hi < 1 ? " The risk ratio's 95% CI excludes 1." : " The risk ratio's 95% CI includes 1: no clear association.";
      }
    }
    o.note.textContent = note;
  }
  draw();
}

// ============================================================ Screening biases

for (const root of document.querySelectorAll("[data-epi-screen]")) {
  const lead = root.querySelector("[data-lead]");
  const len = root.querySelector("[data-length]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  // One schematic patient: biology fixed, only the diagnosis moves.
  const ONSET = 52, DETECTABLE = 55, SYMPTOMS = 70, DEATH = 78;

  // 200 synthetic tumours: half slow (long preclinical phase), half fast.
  const rng = mulberry32(9);
  const tumours = Array.from({ length: 200 }, (_, i) => {
    const slow = i % 2 === 0;
    const onset = rng() * 30;
    const dur = slow ? 4 + rng() * 6 : 0.3 + rng() * 1.2;
    return { slow, onset, dur };
  }).sort((a, b) => a.onset - b.onset);

  function draw() {
    const at = s.screen.get();
    lead.replaceChildren();
    const sx = (age) => 30 + ((age - 45) / 40) * 410;
    const row = (y, label, diag) => {
      text(lead, 4, y - 14, label, { class: "fill-muted-foreground text-[10px]" });
      el("line", { x1: sx(45), x2: sx(85), y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:0.15" }, lead);
      el("rect", { x: sx(ONSET), y: y - 5, width: sx(DEATH) - sx(ONSET), height: 10, rx: 3, style: "fill:currentColor;fill-opacity:0.07" }, lead);
      el("rect", { x: sx(diag), y: y - 5, width: sx(DEATH) - sx(diag), height: 10, rx: 3, style: "fill:var(--brand);fill-opacity:0.35" }, lead);
      el("circle", { cx: sx(diag), cy: y, r: 4.5, style: "fill:var(--brand)" }, lead);
      el("path", { d: `M${sx(DEATH) - 4} ${y - 4}l8 8m0 -8l-8 8`, style: "stroke:var(--foreground);stroke-width:1.5" }, lead);
    };
    const detected = at >= DETECTABLE && at < SYMPTOMS;
    const diag = detected ? at : SYMPTOMS;
    row(60, "No screening: diagnosed at symptoms", SYMPTOMS);
    row(130, `Screened at ${Math.round(at)}`, diag);
    for (const [age, lbl, anchor] of [[ONSET, "onset", "end"], [DETECTABLE, "detectable", "start"], [SYMPTOMS, "symptoms", "middle"], [DEATH, "death", "middle"]]) {
      el("line", { x1: sx(age), x2: sx(age), y1: 30, y2: 150, style: "stroke:currentColor;stroke-opacity:0.18;stroke-dasharray:2 3" }, lead);
      const dx = anchor === "end" ? 3 : anchor === "start" ? -3 : 0;
      text(lead, sx(age) + dx, 176, lbl, { "text-anchor": anchor });
      text(lead, sx(age) + dx, 190, String(age), { "text-anchor": anchor });
    }
    o.lead.textContent = detected
      ? `Survival after diagnosis rises from ${DEATH - SYMPTOMS} to ${num(DEATH - diag, 0)} years, yet death still comes at ${DEATH}: the extra ${num(SYMPTOMS - diag, 0)} years are lead time, not life gained.`
      : at < DETECTABLE
        ? `At ${Math.round(at)} the disease is not yet detectable: the screen misses it and diagnosis waits for symptoms.`
        : "Too late to make a difference.";

    // Length bias: screening rounds every k years from year 0.
    const k = s.interval.get();
    const screens = [];
    for (let t = 0; t <= 40; t += k) screens.push(t);
    len.replaceChildren();
    const tx = (t) => 20 + (t / 40) * 430;
    for (const t of screens) el("line", { x1: tx(t), x2: tx(t), y1: 8, y2: 188, style: "stroke:currentColor;stroke-opacity:0.25" }, len);
    let caughtSlow = 0, caughtFast = 0;
    tumours.forEach((u, i) => {
      const caught = screens.some((t) => t >= u.onset && t < u.onset + u.dur);
      if (caught) u.slow ? caughtSlow++ : caughtFast++;
      const y = 10 + (i / tumours.length) * 176;
      el("line", { x1: tx(u.onset), x2: tx(Math.min(40, u.onset + u.dur)), y1: y, y2: y,
        style: `stroke:${u.slow ? "var(--vec-u)" : "var(--brand)"};stroke-width:1.2;stroke-opacity:${caught ? 1 : 0.22}` }, len);
    });
    text(len, 20, 198, "years →");
    const caught = caughtSlow + caughtFast;
    o.length.textContent = caught
      ? `Screens caught ${caught} of 200 tumours; ${pct(caughtSlow / caught, 0)} of them were slow-growing (blue), though slow ones are only half of all tumours. Screen-detected cases look healthier partly because of what screening selects.`
      : "No tumour was caught.";
  }
  draw();
}

// ============================================================ John Snow

for (const root of document.querySelectorAll("[data-epi-snow]")) {
  const svg = root.querySelector("[data-map]");
  const o = outs(root);
  let regions = false;
  onToggle(root, (_, on) => { regions = on; draw(); });

  // Schematic layout (not to scale); pumps and dots are illustrative.
  const pumps = [[250, 190, true], [90, 80, false], [430, 70, false], [450, 300, false], [120, 320, false], [330, 330, false]];
  const workhouse = [100, 104, 76, 40], brewery = [292, 204, 52, 26];
  const inside = ([x, y], [rx, ry, w, hh]) => x >= rx && x <= rx + w && y >= ry && y <= ry + hh;
  const rng = mulberry32(1854);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const cases = [];
  while (cases.length < 260) {
    const near = rng() < 0.8;
    const p = near ? [250 + 55 * gauss(), 190 + 45 * gauss()] : [20 + rng() * 480, 20 + rng() * 340];
    if (p[0] < 10 || p[0] > 510 || p[1] < 10 || p[1] > 370) continue;
    if (inside(p, workhouse) || inside(p, brewery)) continue;
    cases.push(p);
  }
  const nearest = (p) => pumps.reduce((best, q, i) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(pumps[best][0] - p[0], pumps[best][1] - p[1]) ? i : best), 0);

  function draw() {
    svg.replaceChildren();
    if (regions) {
      for (let y = 0; y < 380; y += 10) for (let x = 0; x < 520; x += 10) {
        const k = nearest([x + 5, y + 5]);
        el("rect", { x, y, width: 10, height: 10, style: `fill:${k === 0 ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${k === 0 ? 0.12 : (k % 2 ? 0.04 : 0.08)}` }, svg);
      }
    }
    const street = "stroke:currentColor;stroke-opacity:0.2;stroke-width:9;stroke-linecap:round";
    for (const d of ["M20 190 H500", "M20 70 H500", "M20 310 H500", "M70 20 V360", "M200 20 V360", "M370 20 V360", "M470 20 V360"]) el("path", { d, style: street }, svg);
    text(svg, 30, 184, "Broad Street", { class: "fill-foreground font-mono text-[10px]" });
    text(svg, 206, 34, "Poland Street", { class: "fill-muted-foreground font-mono text-[10px]" });
    for (const [r, label] of [[workhouse, "workhouse (own well)"], [brewery, "brewery"]]) {
      el("rect", { x: r[0], y: r[1], width: r[2], height: r[3], rx: 3, style: "fill:var(--code-bg);stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 2" }, svg);
      text(svg, r[0] + r[2] / 2, label === "brewery" ? r[1] + r[3] + 12 : r[1] - 6, label, { "text-anchor": "middle" });
    }
    for (const p of cases) {
      const k = nearest(p);
      el("rect", { x: p[0] - 2, y: p[1] - 2, width: 4, height: 4, style: `fill:${regions && k !== 0 ? "var(--vec-u)" : "var(--foreground)"};fill-opacity:0.8` }, svg);
    }
    pumps.forEach(([x, y, main]) => {
      el("circle", { cx: x, cy: y, r: main ? 8 : 5.5, style: `fill:var(--background);stroke:${main ? "var(--brand)" : "var(--vec-u)"};stroke-width:2.5` }, svg);
      if (main) text(svg, x + 12, y - 12, "Broad Street pump", { class: "fill-foreground font-mono text-[10px] font-medium" });
    });
    text(svg, 510, 374, "schematic · not to scale · dots illustrative", { "text-anchor": "end" });
    const share = cases.filter((p) => nearest(p) === 0).length / cases.length;
    o.share.textContent = `${pct(share, 0)} of the illustrated cases lived nearest the Broad Street pump.`;
  }
  draw();
}

// ============================================================ Bathtub

for (const root of document.querySelectorAll("[data-epi-bathtub]")) {
  const tub = root.querySelector("[data-tub]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let P = 0, hist = [P], raf = 0, visible = false;
  const s = scrubAll(root, () => start());
  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const [i, d] = b.dataset.preset.split(" ").map(Number);
      s.inc.set(i, false); s.dur.set(d, false);
      start();
    }));

  // dP/dt = incidence − P / D, one day per step.
  const step = () => { P += s.inc.get() - P / s.dur.get(); hist.push(P); if (hist.length > 240) hist.shift(); };
  const steady = () => s.inc.get() * s.dur.get();

  function draw() {
    const top = Math.max(steady(), ...hist) * 1.15 || 1;
    tub.replaceChildren();
    const inflow = s.inc.get(), outflow = P / s.dur.get();
    const w = (v) => Math.max(1.5, Math.min(14, 1.5 + Math.sqrt(v) * 1.2));
    el("rect", { x: 46, y: 6, width: 30, height: 14, rx: 3, style: "fill:currentColor;fill-opacity:0.15" }, tub);
    if (inflow > 0) el("rect", { x: 61 - w(inflow) / 2, y: 20, width: w(inflow), height: 50, style: "fill:var(--vec-u);fill-opacity:0.7" }, tub);
    const level = 210 - (P / top) * 140;
    el("rect", { x: 30, y: Math.max(70, level), width: 180, height: 210 - Math.max(70, level), style: "fill:var(--vec-u);fill-opacity:0.25" }, tub);
    el("path", { d: "M30 60 V210 H210 V60", style: "fill:none;stroke:currentColor;stroke-opacity:0.6;stroke-width:2" }, tub);
    el("rect", { x: 170 - w(outflow) / 2, y: 210, width: w(outflow), height: 40, style: "fill:var(--vec-u);fill-opacity:0.45" }, tub);
    text(tub, 84, 18, "incidence");
    text(tub, 160, 246, "recovery + death", { "text-anchor": "end" });
    text(tub, 36, Math.max(84, level + 14), "prevalence");

    svg.replaceChildren();
    const f = frame(svg, { box: [52, 14, 296, 210], x: [0, 239], y: [0, top], xticks: [], yticks: [0, Math.round(top / 2), Math.round(top)], xlabel: "last 240 days", ylabel: "cases" });
    hline(svg, f, steady(), "stroke:var(--brand);stroke-dasharray:4 4", `steady ${Math.round(steady())}`);
    polyline(svg, hist.map((v, i) => [f.sx(i + 240 - hist.length), f.sy(v)]), "stroke:var(--vec-u);stroke-width:2");
    o.prev.textContent = String(Math.round(P));
    o.steady.textContent = `${Math.round(steady())} (= ${num(s.inc.get(), 0)} × ${num(s.dur.get(), 0)})`;
    o.out.textContent = num(outflow, 1);
  }

  // Runs until the level settles; instant under reduced motion.
  function start() {
    if (reduced()) { for (let i = 0; i < 2000 && Math.abs(P - steady()) > 0.5; i++) step(); draw(); return; }
    if (!raf && visible) raf = requestAnimationFrame(loop);
    draw();
  }
  let last = 0;
  const loop = (now) => {
    if (now - last > 40) { step(); draw(); last = now; }
    raf = visible && Math.abs(P - steady()) > 0.5 ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(root);
  draw();
}
