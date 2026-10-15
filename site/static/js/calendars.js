// Calendars & timekeeping blocks: leap-year rules, weekday algorithms,
// Julian Day Numbers, the Easter computus, the Metonic cycle, the tabular
// Islamic calendar, ISO weeks, sundials, pendulum clocks and Unix time.
// All calendar arithmetic is in calendars-algo.js (exact integers, UTC).

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import * as C from "./calendars-algo.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const q = (root, k) => root.querySelector(`[data-k="${k}"]`);
const int = (f) => Math.round(f.get());
const fmtInt = (v) => new Intl.NumberFormat("en").format(v).replace("-", "−");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const plural = (n, w) => `${n} ${w}${Math.abs(n) === 1 ? "" : "s"}`;

/** Clamps the day field to the month's length and returns [y, m, d]. */
function readDate(s, julian = false) {
  const y = int(s.y), m = int(s.m);
  const len = C.monthLength(y, m, julian);
  let d = int(s.d);
  if (d > len) {
    d = len;
    s.d.set(d, false);
  }
  return [y, m, d];
}

/** Weekday of a proleptic Gregorian date from the platform's own Date. */
function dateWeekday(y, m, d) {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t.getUTCDay();
}

const SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ============================================================ Leap-year rules

const TROPICAL = 365.24219;
const RULES = {
  gregorian: { leap: C.isLeapGregorian, cycle: 400, start: 1582, why: (y) => (C.mod(y, 400) === 0 ? "divisible by 400" : C.mod(y, 100) === 0 ? "a century not divisible by 400" : C.mod(y, 4) === 0 ? "divisible by 4" : "not divisible by 4") },
  julian: { leap: C.isLeapJulian, cycle: 400, start: -45, why: (y) => (C.mod(y, 4) === 0 ? "divisible by 4" : "not divisible by 4") },
  revised: {
    leap: (y) => C.mod(y, 4) === 0 && (C.mod(y, 100) !== 0 || [200, 600].includes(C.mod(y, 900))),
    cycle: 900, start: 1923,
    why: (y) => (C.mod(y, 100) === 0 ? ([200, 600].includes(C.mod(y, 900)) ? "a century leaving 200 or 600 after division by 900" : "a century not leaving 200 or 600 mod 900") : C.mod(y, 4) === 0 ? "divisible by 4" : "not divisible by 4"),
  },
};

const ADOPTIONS = [
  ["Spain, Portugal, Italy, Poland", [1582, 10, 4], [1582, 10, 15]],
  ["Great Britain and its colonies", [1752, 9, 2], [1752, 9, 14]],
  ["Russia", [1918, 1, 31], [1918, 2, 14]],
  ["Greece", [1923, 2, 15], [1923, 3, 1]],
];

for (const root of document.querySelectorAll("[data-cal-leap]")) {
  const o = outs(root);
  const grid = q(root, "grid"), drift = q(root, "drift");
  let rule = "gregorian";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { rule = e.detail.value; draw(); });

  // The adoption table never changes: weekdays and gaps are computed.
  const table = q(root, "adopt");
  const th = (t) => { const c = document.createElement("th"); c.className = "px-2 py-1 text-left font-normal text-muted-foreground"; c.textContent = t; return c; };
  const head = document.createElement("tr");
  head.className = "border-b";
  head.append(th("Switched"), th("Last Julian day"), th("Next day, Gregorian"), th("Dropped"));
  table.append(head);
  for (const [who, a, b] of ADOPTIONS) {
    const ja = C.toJDN(...a, true), jb = C.toJDN(...b);
    const tr = document.createElement("tr");
    tr.className = "border-b border-border/50";
    const cells = [who, C.longDate(...a, C.weekdayOfJDN(ja)), C.longDate(...b, C.weekdayOfJDN(jb)), jb === ja + 1 ? plural(C.calendarGap(jb), "day") : "check"];
    for (const v of cells) { const c = document.createElement("td"); c.className = "px-2 py-1"; c.textContent = v; tr.append(c); }
    table.append(tr);
  }

  function draw() {
    const r = RULES[rule];
    const y = int(s.y);

    // One full cycle of the rule, a row per century.
    grid.replaceChildren();
    const start = y - C.mod(y, r.cycle);
    const rows = r.cycle / 100, L = 64, W = 640 - L - 8, cw = W / 100, rh = Math.min(48, 222 / rows);
    let count = 0;
    for (let row = 0; row < rows; row++) {
      const top = 6 + row * rh;
      text(grid, L - 8, top + rh / 2 + 3, String(start + row * 100), { "text-anchor": "end" });
      for (let i = 0; i < 100; i++) {
        const yr = start + row * 100 + i, on = r.leap(yr);
        if (on) count++;
        el("rect", {
          x: L + i * cw + 0.5, y: top + 1, width: cw - 1, height: rh - 2, rx: 1,
          style: on ? "fill:var(--brand);fill-opacity:0.75" : "fill:currentColor;fill-opacity:0.07",
        }, grid);
        if (yr === y) el("rect", { x: L + i * cw - 1, y: top - 1, width: cw + 2, height: rh + 2, rx: 2, style: "fill:none;stroke:var(--foreground);stroke-width:1.5" }, grid);
      }
    }
    text(grid, L, 6 + rows * rh + 14, `${count} leap years in this ${r.cycle}-year cycle; the first column holds the century years`, {});

    // Drift of the calendar against the tropical year, aligned at Nicaea (325).
    drift.replaceChildren();
    const f = frame(drift, { box: [56, 22, 560, 132], x: [0, 4000], y: [-5, 30], xticks: [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000], yticks: [0, 10, 20, 30], xfmt: (v) => String(v), yfmt: (v) => `${v} d`, xlabel: "year AD", ylabel: "days the calendar runs late against the Sun" });
    const curve = (k) => {
      const pts = [];
      for (let yr = 325; yr <= 4000; yr += 25) {
        let dd = (365.25 - TROPICAL) * (yr - 325);
        const R = RULES[k];
        if (k !== "julian" && yr >= R.start) {
          const at = (365.25 - TROPICAL) * (R.start - 325);
          dd = at - (k === "gregorian" ? 10 : 13) + (meanOf(k) - TROPICAL) * (yr - R.start);
        }
        pts.push([f.sx(yr), f.sy(Math.max(-5, Math.min(30, dd)))]);
      }
      return pts;
    };
    const colours = { gregorian: "var(--brand)", julian: "var(--vec-u)", revised: "var(--vec-v)" };
    for (const k of ["julian", "gregorian", "revised"]) {
      polyline(drift, curve(k), `stroke:${colours[k]};stroke-width:${k === rule ? 2.25 : 1.25};stroke-opacity:${k === rule ? 1 : 0.55}`);
    }
    text(drift, f.sx(3000), f.sy(26), "Julian", { style: "fill:var(--vec-u)" });
    text(drift, f.sx(3000), f.sy(3.5), "Gregorian", { style: "fill:var(--brand)" });
    text(drift, f.sx(3000), f.sy(-1.5) + 12, "Revised Julian", { style: "fill:var(--vec-v)" });

    const mean = meanOf(rule), err = (mean - TROPICAL) * 86400;
    o.count.textContent = `${count} in ${r.cycle} years`;
    o.mean.textContent = `${mean.toFixed(6)} d`;
    o.err.textContent = `${err >= 0 ? "+" : "−"}${num(Math.abs(err), 1)} s`;
    o.days.textContent = `${fmtInt(Math.round(1 / Math.abs(mean - TROPICAL)))} years`;
    o.verdict.textContent = `${y}: ${r.leap(y) ? "leap" : "common"} (${r.why(y)})`;
  }
  draw();
}

function meanOf(rule) {
  const r = RULES[rule];
  let n = 0;
  for (let y = 0; y < r.cycle; y++) if (r.leap(y)) n++;
  return 365 + n / r.cycle;
}

// ============================================================ Day of the week

/** A month calendar (Sunday first) as an HTML grid; mark(d) returns extra classes. */
function monthGrid(y, m, mark, { mondayFirst = false, weekCol = false } = {}) {
  const box = document.createElement("div");
  box.className = "flex flex-col gap-1.5";
  const title = document.createElement("div");
  title.className = "font-mono text-xs text-muted-foreground";
  title.textContent = `${C.MONTHS[m - 1]} ${y > 0 ? y : `${1 - y} BC`}`;
  box.append(title);
  const g = document.createElement("div");
  g.className = weekCol ? "grid grid-cols-8 gap-1 font-mono text-[11px] tabular-nums" : "grid grid-cols-7 gap-1 font-mono text-[11px] tabular-nums";
  const names = mondayFirst ? [...SHORT.slice(1), SHORT[0]] : SHORT;
  const cell = (t, cls) => { const c = document.createElement("div"); c.className = "flex h-7 items-center justify-center rounded-md " + cls; c.textContent = t; g.append(c); return c; };
  if (weekCol) cell("Wk", "text-muted-foreground/70");
  for (const n of names) cell(n, "text-muted-foreground");
  const first = C.weekdayOfJDN(C.toJDN(y, m, 1));
  const lead = mondayFirst ? C.mod(first + 6, 7) : first;
  const len = C.monthLength(y, m);
  let day = 1 - lead;
  while (day <= len) {
    if (weekCol) {
      const thursdayOffset = mondayFirst ? 3 : 4;
      const tj = C.toJDN(y, m, 1) + day - 1 + thursdayOffset;
      const t = C.fromJDN(tj);
      cell(String(C.isoWeek(t.y, t.m, t.d).week), "text-muted-foreground/70");
    }
    for (let c = 0; c < 7; c++, day++) {
      if (day < 1 || day > len) cell("", "");
      else cell(String(day), mark(day, c));
    }
  }
  box.append(g);
  return box;
}

for (const root of document.querySelectorAll("[data-cal-weekday]")) {
  const o = outs(root);
  const month = q(root, "month"), steps = q(root, "steps");
  let method = "doomsday";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { method = e.detail.value; draw(); });

  function draw() {
    const [y, m, d] = readDate(s);
    const dm = C.doomsday(y, m, d), z = C.zeller(y, m, d);
    month.replaceChildren(monthGrid(y, m, (day) =>
      day === d ? "bg-brand/15 text-brand ring-1 ring-brand" :
      day === dm.md ? "border border-dashed border-brand/60 text-foreground" : "text-foreground/80"));

    const W = C.WEEKDAYS;
    const rows = method === "doomsday" ? [
      ["Century anchor", `c = ⌊${y}/100⌋ = ${dm.c};  (2 + 5·(c mod 4)) mod 7 = ${dm.anchor}`, W[dm.anchor]],
      ["Year in century", `y = ${dm.yy};  ⌊y/12⌋ = ${dm.a},  y mod 12 = ${dm.b},  ⌊${dm.b}/4⌋ = ${dm.cc}`, ""],
      ["Year's doomsday", `(${dm.anchor} + ${dm.a} + ${dm.b} + ${dm.cc}) mod 7 = ${dm.dd}`, W[dm.dd]],
      ["Month's doomsday", `${dm.md} ${C.MONTHS[m - 1]}${m <= 2 ? (C.isLeapGregorian(y) ? " (leap year)" : " (common year)") : ""}`, W[dm.dd]],
      ["Count", `${d} − ${dm.md} = ${d - dm.md} days;  (${dm.dd} + ${d - dm.md}) mod 7 = ${dm.weekday}`, W[dm.weekday]],
    ] : [
      ["Shift Jan, Feb", m < 3 ? `month ${m} → ${z.mm} of year ${z.yy}` : `month ${m}, year ${y} unchanged`, ""],
      ["Split the year", `K = ${z.yy} mod 100 = ${z.K};  J = ⌊${z.yy}/100⌋ = ${z.J}`, ""],
      ["Terms", `⌊13(${z.mm}+1)/5⌋ = ${z.t1};  ⌊K/4⌋ = ${z.t2};  ⌊J/4⌋ = ${z.t3};  5J = ${5 * z.J}`, ""],
      ["Sum mod 7", `h = (${d} + ${z.t1} + ${z.K} + ${z.t2} + ${z.t3} + ${5 * z.J}) mod 7 = ${z.h}`, ""],
      ["Read h", "0 = Saturday, 1 = Sunday … 6 = Friday", W[z.weekday]],
    ];
    steps.replaceChildren(...rows.map(([label, work, res], i) => {
      const li = document.createElement("li");
      li.className = "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 rounded-md border bg-background/60 px-2.5 py-1.5";
      const n = document.createElement("span"); n.className = "text-muted-foreground"; n.textContent = String(i + 1);
      const body = document.createElement("div"); body.className = "flex flex-col gap-0.5";
      const a = document.createElement("span"); a.className = "text-muted-foreground"; a.textContent = label;
      const b = document.createElement("span"); b.className = "text-foreground"; b.textContent = work + (res ? `  →  ${res}` : "");
      body.append(a, b); li.append(n, body);
      return li;
    }));

    const wd = method === "doomsday" ? dm.weekday : z.weekday;
    const ok = dm.weekday === z.weekday && wd === dateWeekday(y, m, d);
    o.wd.textContent = C.WEEKDAYS[wd];
    o.dd.textContent = C.WEEKDAYS[dm.dd];
    o.check.textContent = ok ? "✓ agrees" : "✗ disagrees";
    o.check.style.color = ok ? "var(--brand)" : "var(--code-del)";
  }
  draw();
}

// ============================================================ Julian Day Numbers

const LANDMARKS = [
  [0, "JD 0", "1 Jan 4713 BC (Julian)"],
  [2299161, "Gregorian reform", "15 Oct 1582"],
  [2400001, "MJD 0", "17 Nov 1858"],
  [2440588, "Unix epoch", "1 Jan 1970"],
  [2451545, "J2000", "1 Jan 2000"],
];

for (const root of document.querySelectorAll("[data-cal-jdn]")) {
  const o = outs(root);
  const svg = q(root, "line");
  let cal = "gregorian";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { cal = e.detail.value; draw(); });

  function axis(y0, x0, x1, landmarks, j, labelsBelow) {
    const L = 24, W = 592;
    const sx = (v) => L + ((v - x0) / (x1 - x0)) * W;
    el("line", { x1: L, x2: L + W, y1: y0, y2: y0, style: "stroke:currentColor;stroke-opacity:0.35" }, svg);
    landmarks.forEach(([v, name], i) => {
      if (v < x0 || v > x1) return;
      const x = sx(v), dy = labelsBelow ? 14 + (i % 2) * 11 : -8 - (i % 3) * 11;
      el("line", { x1: x, x2: x, y1: y0 - 4, y2: y0 + 4, style: "stroke:currentColor;stroke-opacity:0.6" }, svg);
      text(svg, x, y0 + dy, name, { "text-anchor": x > 560 ? "end" : x < 70 ? "start" : "middle" });
    });
    if (j >= x0 && j <= x1) {
      el("circle", { cx: sx(j), cy: y0, r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    }
    return sx;
  }

  function draw() {
    const julian = cal === "julian";
    const [y, m, d] = readDate(s, julian);
    const j = C.toJDN(y, m, d, julian) + int(s.add);
    const g = C.fromJDN(j), jl = C.fromJDN(j, true), wd = C.weekdayOfJDN(j);

    svg.replaceChildren();
    text(svg, 24, 14, "all of history (JD 0 → 3000 AD)", {});
    axis(56, 0, 2817152, [...LANDMARKS.slice(0, 2), [2440588, "1858–2000: see the zoom"]], j, false);
    text(svg, 24, 92, "zoom: 1850 → 2050", {});
    const z0 = C.toJDN(1850, 1, 1), z1 = C.toJDN(2050, 1, 1);
    const sx = axis(112, z0, z1, LANDMARKS.slice(2), j, true);
    for (const yr of [1900, 1950, 2000]) text(svg, sx(C.toJDN(yr, 1, 1)), 106, String(yr), { "text-anchor": "middle", class: "fill-muted-foreground/60 font-mono text-[9px]" });

    o.jdn.textContent = fmtInt(j);
    o.jd0.textContent = new Intl.NumberFormat("en", { minimumFractionDigits: 1 }).format(j - 0.5).replace("-", "−");
    o.mjd.textContent = fmtInt(j - 2400001);
    o.wd.textContent = C.WEEKDAYS[wd];
    o.greg.textContent = C.isoString(g, false);
    o.jul.textContent = C.isoString(jl, false);
    const gap = C.calendarGap(j);
    o.gap.textContent = gap < 0 ? `−${plural(-gap, "day")} (Julian ahead)` : plural(gap, "day");
    o.j2k.textContent = fmtInt(j - 2451545);
  }
  draw();
}

// ============================================================ Easter

// Easter dates from 1600 to 2599, counted by day from 22 March (index 0).
const EASTER_HIST = (() => {
  const n = new Array(35).fill(0);
  for (let y = 1600; y < 2600; y++) {
    const e = C.easterGregorian(y);
    n[(e.month === 3 ? e.day : 31 + e.day) - 22]++;
  }
  return n;
})();

for (const root of document.querySelectorAll("[data-cal-easter]")) {
  const o = outs(root);
  const table = q(root, "steps"), hist = q(root, "hist");
  const s = scrubAll(root, draw);

  function draw() {
    const Y = int(s.y), e = C.easterGregorian(Y);
    const rows = [
      ["a", "Y mod 19", e.a, `year of the 19-year lunar cycle: golden number ${e.golden}`],
      ["b, c", "Y div 100, Y mod 100", `${e.b}, ${e.c}`, "century and year in the century"],
      ["d, e", "b div 4, b mod 4", `${e.d}, ${e.e}`, "leap days skipped by the Gregorian rule"],
      ["f", "(b + 8) div 25", e.f, "correction for the lunar table's drift"],
      ["g", "(b − f + 1) div 3", e.g, "lunar correction"],
      ["h", "(19a + b − d − g + 15) mod 30", e.h, "days from 21 March to the full moon"],
      ["i, k", "c div 4, c mod 4", `${e.i}, ${e.k}`, "leap years in the century so far"],
      ["l", "(32 + 2e + 2i − h − k) mod 7", e.l, "days from the full moon to the Sunday, minus one"],
      ["m", "(a + 11h + 22l) div 451", e.m, e.m ? "late case: the full moon moves a day earlier" : "0 except in two rare late cases"],
      ["date", "(h + l − 7m + 114) div 31, mod 31 + 1", `${e.month}, ${e.day}`, `${e.day} ${C.MONTHS[e.month - 1]}`],
    ];
    table.replaceChildren();
    const hr = document.createElement("tr");
    hr.className = "border-b";
    for (const t of ["", "formula", "value", "meaning"]) { const c = document.createElement("th"); c.className = "px-2 py-1 text-left font-normal text-muted-foreground"; c.textContent = t; hr.append(c); }
    table.append(hr);
    for (const [v, f, val, mean] of rows) {
      const tr = document.createElement("tr");
      tr.className = "border-b border-border/50";
      const cls = ["px-2 py-1 text-foreground", "px-2 py-1 text-muted-foreground", "px-2 py-1 text-right tabular-nums text-foreground", "px-2 py-1 font-sans text-muted-foreground"];
      [v, f, String(val), mean].forEach((t, i) => { const c = document.createElement("td"); c.className = cls[i]; c.textContent = t; tr.append(c); });
      if (v === "h" || v === "date") tr.className += " bg-brand/5";
      table.append(tr);
    }

    // Histogram of Easter dates.
    hist.replaceChildren();
    const max = Math.max(...EASTER_HIST);
    const f = frame(hist, { box: [44, 22, 576, 110], x: [0, 35], y: [0, max * 1.1], yticks: [0, 20, 40], yfmt: String, ylabel: "Easters, 1600–2599" });
    const idx = (e.month === 3 ? e.day : 31 + e.day) - 22;
    EASTER_HIST.forEach((n, i) => {
      el("rect", { x: f.sx(i) + 1, y: f.sy(n), width: f.W / 35 - 2, height: f.sy(0) - f.sy(n), rx: 1, style: i === idx ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.18" }, hist);
    });
    for (const [i, t] of [[0, "22 Mar"], [9, "31 Mar"], [19, "10 Apr"], [29, "20 Apr"], [34, "25 Apr"]]) text(hist, f.sx(i + 0.5), f.sy(0) + 13, t, { "text-anchor": "middle" });

    const west = C.toJDN(Y, e.month, e.day);
    const ej = C.easterJulian(Y), east = C.toJDN(Y, ej.month, ej.day, true);
    const eg = C.fromJDN(east), pf = C.fromJDN(e.pfm);
    o.west.textContent = `Sun ${e.day} ${C.MONTHS[e.month - 1]}`;
    o.pfm.textContent = `${C.WEEKDAYS[C.weekdayOfJDN(e.pfm)].slice(0, 3)} ${pf.d} ${MON[pf.m - 1]}`;
    o.golden.textContent = String(e.golden);
    o.east.textContent = `Sun ${eg.d} ${C.MONTHS[eg.m - 1]}`;
    const gap = (east - west) / 7;
    o.gap.textContent = gap === 0 ? "same Sunday" : `Orthodox ${plural(gap, "week")} later`;
  }
  draw();
}

// ============================================================ Metonic cycle

const SYNODIC = 29.530589;
const LEAP_CYCLE = [3, 6, 8, 11, 14, 17, 19];

for (const root of document.querySelectorAll("[data-cal-metonic]")) {
  const o = outs(root);
  const wheel = q(root, "wheel"), drift = q(root, "drift");
  const s = scrubAll(root, draw);

  function draw() {
    const am = int(s.y), cyc = C.hebrewCycleYear(am), leap = C.hebrewIsLeap(am);

    wheel.replaceChildren();
    const cx = 120, cy = 120, R1 = 104, R0 = 70;
    for (let i = 1; i <= 19; i++) {
      const a0 = ((i - 1) / 19) * 2 * Math.PI - Math.PI / 2, a1 = (i / 19) * 2 * Math.PI - Math.PI / 2, gap = 0.012;
      const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      const on = LEAP_CYCLE.includes(i);
      el("path", {
        d: `M${p(R0, a0 + gap)}L${p(R1, a0 + gap)}A${R1},${R1} 0 0 1 ${p(R1, a1 - gap)}L${p(R0, a1 - gap)}A${R0},${R0} 0 0 0 ${p(R0, a0 + gap)}Z`,
        style: (on ? "fill:var(--brand);fill-opacity:0.7;" : "fill:currentColor;fill-opacity:0.08;") + (i === cyc ? "stroke:var(--foreground);stroke-width:2" : "stroke:none"),
      }, wheel);
      const am_ = (a0 + a1) / 2;
      text(wheel, cx + (R1 + 10) * Math.cos(am_), cy + (R1 + 10) * Math.sin(am_) + 3, String(i), { "text-anchor": "middle", class: i === cyc ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[9px]" });
    }
    text(wheel, cx, cy - 4, `year ${cyc}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    text(wheel, cx, cy + 12, leap ? "13 months" : "12 months", { "text-anchor": "middle" });

    // Where the lunar year starts against the solar year, over three cycles.
    drift.replaceChildren();
    const f = frame(drift, { box: [44, 16, 360, 190], x: [0, 57], y: [-25, 25], xticks: [0, 19, 38, 57], yticks: [-20, -10, 0, 10, 20], yfmt: (v) => `${v > 0 ? "+" : ""}${v} d`, xlabel: "years", ylabel: "lunar year starts early (−) or late (+)" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:3 3" }, drift);
    const pts = [[f.sx(0), f.sy(0)]];
    let off = 0;
    for (let n = 1; n <= 57; n++) {
      const months = LEAP_CYCLE.includes(C.mod(n - 1, 19) + 1) ? 13 : 12;
      off += months * SYNODIC - TROPICAL;
      pts.push([f.sx(n), f.sy(off)]);
    }
    polyline(drift, pts, "stroke:var(--vec-u);stroke-width:1.5");
    pts.forEach(([x, yv], n) => {
      if (n === 0) return;
      const here = n === cyc;
      el("circle", { cx: x, cy: yv, r: here ? 4.5 : 2, style: here ? "fill:var(--brand);stroke:var(--background);stroke-width:2" : LEAP_CYCLE.includes(C.mod(n - 1, 19) + 1) ? "fill:var(--brand)" : "fill:currentColor;fill-opacity:0.5" }, drift);
    });
    text(drift, f.sx(57), f.sy(25) + 12, `months run ${(off * 24).toFixed(1)} h ahead after 57 years`, { "text-anchor": "end" });

    const solar = 19 * TROPICAL, lunar = 235 * SYNODIC, diff = lunar - solar;
    o.cyc.textContent = `${cyc} of 19`;
    o.months.textContent = leap ? "13 (Adar I added)" : "12";
    o.solar.textContent = `${solar.toFixed(2)} d`;
    o.lunar.textContent = `${lunar.toFixed(2)} d`;
    o.diff.textContent = `+${num(diff * 24, 2)} h (months longer)`;
    o.drift.textContent = `${fmtInt(Math.round(19 / diff))} years`;
  }
  draw();
}

// ============================================================ Islamic calendar

for (const root of document.querySelectorAll("[data-cal-hijri]")) {
  const o = outs(root);
  const drift = q(root, "drift"), months = q(root, "months");
  const s = scrubAll(root, draw);
  const len = (y, m) => (m === 12 ? (C.hijriIsLeap(y) ? 30 : 29) : m % 2 ? 30 : 29);

  function draw() {
    const y = int(s.y), m = int(s.m);
    let d = int(s.d);
    if (d > len(y, m)) { d = len(y, m); s.d.set(d, false); }
    const j = C.hijriToJDN(y, m, d), g = C.fromJDN(j);

    // Day of the Gregorian year on which Ramadan begins, year by year.
    drift.replaceChildren();
    const y0 = Math.max(1, y - 50), y1 = y0 + 100;
    const f = frame(drift, { box: [52, 14, 568, 180], x: [y0, y1], y: [366, 1], xticks: [0, 25, 50, 75, 100].map((k) => y0 + k), yticks: [1, 91, 182, 274, 366], yfmt: (v) => ({ 1: "1 Jan", 91: "1 Apr", 182: "1 Jul", 274: "1 Oct", 366: "31 Dec" })[v], xlabel: "year AH", ylabel: "1 Ramadan falls on" });
    let run = [];
    const flush = () => { if (run.length > 1) polyline(drift, run, "stroke:var(--vec-u);stroke-width:1.5"); run = []; };
    let prev = null;
    for (let yr = y0; yr <= y1; yr++) {
      const r = C.fromJDN(C.hijriToJDN(yr, 9, 1));
      const doy = C.toJDN(r.y, r.m, r.d) - C.toJDN(r.y, 1, 1) + 1;
      if (prev !== null && doy > prev) flush();
      run.push([f.sx(yr), f.sy(doy)]);
      if (yr === y) {
        el("circle", { cx: f.sx(yr), cy: f.sy(doy), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, drift);
      }
      prev = doy;
    }
    flush();

    months.replaceChildren(...C.HIJRI_MONTHS.map((name, i) => {
      const c = document.createElement("div");
      const on = i + 1 === m;
      c.className = "flex flex-col rounded-md border px-2 py-1 font-mono text-[10px] " + (on ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground");
      const a = document.createElement("span"); a.className = "truncate font-sans text-[11px] " + (on ? "" : "text-foreground"); a.textContent = name;
      const b = document.createElement("span"); b.textContent = `${len(y, i + 1)} days`;
      c.append(a, b);
      return c;
    }));

    const ylen = C.hijriToJDN(y + 1, 1, 1) - C.hijriToJDN(y, 1, 1);
    o.name.textContent = `${d} ${C.HIJRI_MONTHS[m - 1]} ${y} AH`;
    o.greg.textContent = `${C.WEEKDAYS[C.weekdayOfJDN(j)].slice(0, 3)} ${C.isoString(g, false)}`;
    o.len.textContent = `${ylen} days${ylen === 355 ? " (leap)" : ""}`;
    const mean = 354 + 11 / 30;
    o.cycle.textContent = `${num(365.2422 / (365.2422 - mean), 1)} years`;
  }
  draw();
}

// ============================================================ ISO weeks

for (const root of document.querySelectorAll("[data-cal-isoweek]")) {
  const o = outs(root);
  const box = q(root, "months");
  const s = scrubAll(root, draw);
  const presets = { "p-0103": [2021, 1, 3], "p-1229": [2008, 12, 29], "p-1231": [2026, 12, 31] };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    const p = b && presets[b.dataset.k];
    if (!p) return;
    s.y.set(p[0], false); s.m.set(p[1], false); s.d.set(p[2], false);
    draw();
  });

  function draw() {
    const [y, m, d] = readDate(s);
    const w = C.isoWeek(y, m, d);
    const pair = m === 12 ? [[y, 12], [y + 1, 1]] : m === 1 ? [[y - 1, 12], [y, 1]] : [[y, m - 1], [y, m]];
    box.replaceChildren(...pair.map(([yy, mm]) => monthGrid(yy, mm, (day, col) => {
      const sel = yy === y && mm === m && day === d;
      const thu = col === 3;
      return sel ? "bg-brand/15 text-brand ring-1 ring-brand" : thu ? "bg-muted text-foreground" : "text-foreground/80";
    }, { mondayFirst: true, weekCol: true })));

    const next = [];
    for (let yy = y + 1; next.length < 4; yy++) if (C.isoWeeksInYear(yy) === 53) next.push(yy);
    o.iso.textContent = `${w.year}-W${String(w.week).padStart(2, "0")}-${w.day}`;
    o.wy.textContent = w.year === y ? String(w.year) : `${w.year} (not ${y})`;
    o.weeks.textContent = String(C.isoWeeksInYear(w.year));
    o.next.textContent = next.join(", ");
  }
  draw();
}

// ============================================================ Sundial

for (const root of document.querySelectorAll("[data-cal-sundial]")) {
  const o = outs(root);
  const svg = q(root, "dial");
  let plane = "horizontal";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { plane = e.detail.value; draw(); });

  const rad = (v) => (v * Math.PI) / 180, deg = (v) => (v * 180) / Math.PI;
  /** Angle of an hour line from the noon line, degrees, signed (+ = afternoon). */
  const lineAngle = (phi, hr) => {
    const H = rad(15 * (hr - 12));
    if (Math.abs(hr - 12) >= 6) return Math.sign(hr - 12) * 90;
    const k = plane === "horizontal" ? Math.sin(rad(Math.abs(phi))) : Math.cos(rad(phi));
    return deg(Math.atan(k * Math.tan(H)));
  };

  function draw() {
    const phi = s.lat.get(), hr = s.hr.get();
    const south = phi < 0, mirror = south ? -1 : 1;
    const horiz = plane === "horizontal";
    svg.replaceChildren();

    // Dial plate: the style's foot at (cx, cy); hour lines fan out.
    const cx = 230, cy = horiz ? 296 : 34, R = horiz ? 210 : 240, dir = horiz ? -1 : 1;
    el("rect", { x: 14, y: horiz ? 70 : 16, width: 432, height: horiz ? 246 : 296, rx: 10, style: "fill:currentColor;fill-opacity:0.03;stroke:currentColor;stroke-opacity:0.2" }, svg);
    const end = (theta, r) => {
      // Afternoon shadows point east: to the right on a plate seen from
      // above with north up, and on a south-facing wall seen from the front.
      // South of the equator both pictures are mirrored.
      return [cx + mirror * r * Math.sin(rad(theta)), cy + dir * r * Math.cos(rad(theta))];
    };
    const clip = (theta) => {
      // Stop each line at the plate edge.
      const [x, y] = end(theta, 1);
      const dx = x - cx, dy = y - cy;
      const tx = dx > 1e-9 ? (440 - cx) / dx : dx < -1e-9 ? (20 - cx) / dx : Infinity;
      const ty = dy > 1e-9 ? ((horiz ? 310 : 306) - cy) / dy : dy < -1e-9 ? ((horiz ? 76 : 22) - cy) / dy : Infinity;
      return Math.min(R, tx, ty);
    };
    for (let t = 6; t <= 18; t += 0.5) {
      const th = lineAngle(phi, t), r = clip(th);
      const whole = t % 1 === 0;
      const [x, y] = end(th, r);
      const [x2, y2] = end(th, r - (whole ? 18 : 6));
      el("line", { x1: cx, y1: cy, x2, y2, style: `stroke:currentColor;stroke-opacity:${whole ? 0.45 : 0.15}` }, svg);
      if (whole) {
        const [lx, ly] = end(th, r - 8);
        const lab = t === 12 ? "XII" : String(t > 12 ? t - 12 : t);
        text(svg, lx, ly + 3, lab, { "text-anchor": "middle", class: t === 12 ? "fill-foreground font-mono text-[10px]" : "fill-muted-foreground font-mono text-[10px]" });
      }
    }
    const th = lineAngle(phi, hr), [sx, sy] = end(th, clip(th) - 18);
    el("line", { x1: cx, y1: cy, x2: sx, y2: sy, style: "stroke:var(--brand);stroke-width:3;stroke-linecap:round" }, svg);
    el("circle", { cx, cy, r: 4, style: "fill:var(--foreground)" }, svg);
    text(svg, 14, horiz ? 62 : 326, horiz ? (south ? "south ↑ (plate seen from above)" : "north ↑ (plate seen from above)") : `wall facing ${south ? "north" : "south"}, seen from the front`, {});

    // Side view of the style (gnomon): it leans at the latitude.
    const ax = 500, ay = 260, len = 110;
    const a = horiz ? Math.abs(phi) : 90 - Math.abs(phi);
    el("line", { x1: ax - 20, y1: ay, x2: 630, y2: ay, style: "stroke:currentColor;stroke-opacity:0.5;stroke-width:2" }, svg);
    const tipx = ax + len * Math.cos(rad(a)), tipy = ay - len * Math.sin(rad(a));
    el("path", { d: `M${ax},${ay}L${tipx.toFixed(1)},${tipy.toFixed(1)}L${tipx.toFixed(1)},${ay}Z`, style: "fill:var(--vec-u);fill-opacity:0.15;stroke:var(--vec-u);stroke-width:1.5" }, svg);
    const ar = 34;
    el("path", { d: `M${ax + ar},${ay}A${ar},${ar} 0 0 0 ${(ax + ar * Math.cos(rad(a))).toFixed(1)},${(ay - ar * Math.sin(rad(a))).toFixed(1)}`, style: "fill:none;stroke:var(--brand);stroke-width:1.5" }, svg);
    text(svg, ax + ar + 6, ay - 8, `${num(a, 1)}°`, { class: "fill-foreground font-mono text-[10px]" });
    text(svg, 630, 290, horiz ? "side view: style and plate" : "side view: style and wall", { "text-anchor": "end" });
    text(svg, 630, Math.min(tipy, ay - 40) - 10, `↗ ${south ? "south" : "north"} celestial pole`, { "text-anchor": "end" });

    const hFromNoon = hr - 12;
    o.style.textContent = horiz ? `${num(Math.abs(phi), 1)}° above the plate` : `${num(90 - Math.abs(phi), 1)}° from the wall`;
    o.ha.textContent = `${hFromNoon >= 0 ? "+" : "−"}${num(Math.abs(15 * hFromNoon), 2)}°`;
    o.theta.textContent = `${num(Math.abs(th), 1)}°`;
    o.three.textContent = `${num(Math.abs(lineAngle(phi, 15)), 1)}° (45° ${horiz ? "at a pole" : "on the equator"})`;
  }
  draw();
}

// ============================================================ Pendulum clock

const GRAVITY = { std: 9.80665, equator: 9.7803, pole: 9.8322 };
const EXPANSION = { brass: 19e-6, steel: 11.5e-6, invar: 1.2e-6 }; // per kelvin, typical
const ROD_COLOUR = { brass: "var(--vec-out)", steel: "var(--vec-u)", invar: "var(--vec-v)" };

for (const root of document.querySelectorAll("[data-cal-pendulum]")) {
  const o = outs(root);
  const bob = q(root, "bob"), errSvg = q(root, "error");
  let gKey = "std", rod = "brass";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => {
    const v = e.detail.value;
    if (v in GRAVITY) gKey = v; else rod = v;
    draw();
  });

  let T = 2, amp = 3, raf = 0, visible = false;
  const pivot = [100, 20];
  const arm = el("line", { style: "stroke:currentColor;stroke-opacity:0.6;stroke-width:2" });
  const ball = el("circle", { r: 13, style: "fill:var(--brand);fill-opacity:0.85" });
  function pose(theta, rlen) {
    const x = pivot[0] + rlen * Math.sin(theta), y = pivot[1] + rlen * Math.cos(theta);
    arm.setAttribute("x1", pivot[0]); arm.setAttribute("y1", pivot[1]);
    arm.setAttribute("x2", x.toFixed(1)); arm.setAttribute("y2", y.toFixed(1));
    ball.setAttribute("cx", x.toFixed(1)); ball.setAttribute("cy", y.toFixed(1));
  }
  const rlen = () => 40 + 70 * Math.min(3, s.L.get());
  function tick(now) {
    const theta = ((amp * Math.PI) / 180) * Math.cos((2 * Math.PI * now) / 1000 / T);
    pose(theta, rlen());
    raf = visible && !reduced.matches ? requestAnimationFrame(tick) : 0;
  }
  const start = () => { if (!raf && visible && !reduced.matches) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(root);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden && visible; start(); });

  function draw() {
    const g = GRAVITY[gKey], L = s.L.get();
    amp = s.amp.get();
    const dT = s.dT.get(), t0 = (amp * Math.PI) / 180;
    T = 2 * Math.PI * Math.sqrt(L / g);
    const circ = 1 + t0 ** 2 / 16 + (11 * t0 ** 4) / 3072;

    bob.replaceChildren();
    el("line", { x1: 40, x2: 160, y1: pivot[1], y2: pivot[1], style: "stroke:currentColor;stroke-opacity:0.5;stroke-width:3" }, bob);
    const r = rlen(), a = (amp * Math.PI) / 180;
    el("path", { d: `M${(pivot[0] - r * Math.sin(a)).toFixed(1)},${(pivot[1] + r * Math.cos(a)).toFixed(1)}A${r},${r} 0 0 0 ${(pivot[0] + r * Math.sin(a)).toFixed(1)},${(pivot[1] + r * Math.cos(a)).toFixed(1)}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.2;stroke-dasharray:3 3" }, bob);
    bob.append(arm, ball);
    pose(reduced.matches ? a : 0, r);
    text(bob, 100, 254, "not to scale", { "text-anchor": "middle" });

    errSvg.replaceChildren();
    const f = frame(errSvg, { box: [52, 16, 352, 200], x: [-20, 30], y: [-25, 25], xticks: [-20, -10, 0, 10, 20, 30], yticks: [-20, -10, 0, 10, 20], xfmt: (v) => `${v > 0 ? "+" : ""}${v}`, yfmt: (v) => `${v > 0 ? "+" : ""}${v}`, xlabel: "°C warmer", ylabel: "seconds gained per day" });
    el("line", { x1: f.L, x2: f.L + f.W, y1: f.sy(0), y2: f.sy(0), style: "stroke:currentColor;stroke-opacity:0.3" }, errSvg);
    for (const k of Object.keys(EXPANSION)) {
      const rate = (t) => (-86400 * EXPANSION[k] * t) / 2;
      polyline(errSvg, [[f.sx(-20), f.sy(rate(-20))], [f.sx(30), f.sy(rate(30))]], `stroke:${ROD_COLOUR[k]};stroke-width:${k === rod ? 2.25 : 1.25};stroke-opacity:${k === rod ? 1 : 0.5}`);
      const yEnd = rate(30);
      text(errSvg, f.sx(30) - 2, f.sy(yEnd) - 5, k, { "text-anchor": "end", style: `fill:${ROD_COLOUR[k]}` });
    }
    const here = (-86400 * EXPANSION[rod] * dT) / 2;
    el("circle", { cx: f.sx(dT), cy: f.sy(here), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, errSvg);

    const rate = 86400 * (2 / T - 1);
    o.T.textContent = `${num(T, 4)} s`;
    o.sec.textContent = `${num(g / Math.PI ** 2, 4)} m`;
    o.rate.textContent = `${rate >= 0 ? "+" : "−"}${num(Math.abs(rate), 1)} s/day`;
    o.temp.textContent = `${here >= 0 ? "+" : "−"}${num(Math.abs(here), 2)} s/day`;
    o.circ.textContent = `−${num(86400 * (1 - 1 / circ), 2)} s/day`;
    start();
  }
  draw();
}

// ============================================================ Unix time

const TWO31 = 2 ** 31, TWO32 = 2 ** 32;

for (const root of document.querySelectorAll("[data-cal-unix]")) {
  const o = outs(root);
  const bits = q(root, "bits"), tai = q(root, "tai");
  let width = "i32";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { width = e.detail.value; draw(); });
  const presets = { "p-last": 7, "p-next": 8 };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (!b || !(b.dataset.k in presets)) return;
    for (const [k, v] of Object.entries({ y: 2038, m: 1, d: 19, h: 3, mi: 14, s: presets[b.dataset.k] })) s[k].set(v, false);
    draw();
  });

  function draw() {
    const [y, m, d] = readDate(s);
    const t = C.toUnix(y, m, d, int(s.h), int(s.mi), int(s.s));
    const stored = width === "i32" ? C.mod(t + TWO31, TWO32) - TWO31 : width === "u32" ? C.mod(t, TWO32) : t;
    const n = width === "i64" ? 64 : 32;
    const raw = BigInt.asUintN(n, BigInt(stored)).toString(2).padStart(n, "0");

    bits.replaceChildren();
    for (let row = 0; row < n / 32; row++) {
      const line = document.createElement("div");
      line.className = "grid grid-cols-[repeat(16,minmax(0,1fr))] gap-px sm:grid-cols-[repeat(32,minmax(0,1fr))]";
      for (let i = 0; i < 32; i++) {
        const b = raw[row * 32 + i], sign = width !== "u32" && row === 0 && i === 0;
        const c = document.createElement("div");
        c.className = "flex h-6 items-center justify-center rounded-[3px] font-mono text-[9px] " +
          (b === "1" ? (sign ? "bg-[var(--code-del)] text-background" : "bg-brand text-background") : "border text-muted-foreground");
        c.textContent = b;
        line.append(c);
      }
      bits.append(line);
    }
    const cap = document.createElement("div");
    cap.className = "flex justify-between font-mono text-[10px] text-muted-foreground";
    const l = document.createElement("span"); l.textContent = width === "u32" ? "bit 31" : `bit ${n - 1} (sign)`;
    const r = document.createElement("span"); r.textContent = "bit 0";
    cap.append(l, r);
    bits.append(cap);

    // TAI − UTC staircase from 1972.
    tai.replaceChildren();
    const x0 = C.toUnix(1970, 1, 1), x1 = C.toUnix(2030, 1, 1);
    const yr = (Y) => C.toUnix(Y, 1, 1);
    const f = frame(tai, { box: [52, 14, 568, 140], x: [x0, x1], y: [0, 40], xticks: [1970, 1980, 1990, 2000, 2010, 2020, 2030].map(yr), yticks: [0, 10, 20, 30, 40], xfmt: (v) => String(C.fromUnix(v).y), yfmt: (v) => `${v} s`, ylabel: "TAI − UTC" });
    const pts = [[f.sx(yr(1972)), f.sy(10)]];
    let k = 10;
    for (const ds of C.LEAP_SECONDS) {
      const [a, b, c] = ds.split("-").map(Number), u = C.toUnix(a, b, c);
      pts.push([f.sx(u), f.sy(k)], [f.sx(u), f.sy(++k)]);
    }
    pts.push([f.sx(x1), f.sy(k)]);
    polyline(tai, pts, "stroke:var(--vec-u);stroke-width:1.5");
    const off = C.taiMinusUtc(t);
    if (off !== null && t <= x1) el("circle", { cx: f.sx(t), cy: f.sy(off), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, tai);

    const back = C.fromUnix(stored), wrapped = stored !== t;
    o.unix.textContent = fmtInt(t);
    o.stored.textContent = `${fmtInt(stored)}${wrapped ? " (overflow)" : ""}`;
    o.stored.style.color = wrapped ? "var(--code-del)" : "";
    o.back.textContent = C.isoString(back);
    o.back.style.color = wrapped ? "var(--code-del)" : "";
    o.tai.textContent = off === null ? "— (before 1972)" : `${off} s`;
    const gps = t >= C.toUnix(1980, 1, 6) && off !== null ? off - 19 : null;
    o.gps.textContent = gps === null ? "— (GPS starts 1980-01-06)" : `${gps} s`;
  }
  draw();
}
