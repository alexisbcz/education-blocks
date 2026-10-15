// Electronics: devices and analog circuits, each block computed from its
// equations (Shockley, Kirchhoff with ideal parts, square law, ideal
// op-amp rules, first-order filters, the 555's RC timing, IEC 60062).

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const onSeg = (root, fn) => root.addEventListener("seg-change", (e) => fn(e.detail.value));

// fmtSI writes a value with an SI prefix and three significant digits.
const PREFIX = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
export function fmtSI(v, unit, sig = 3) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return `0 ${unit}`;
  const a = Math.abs(v);
  const [f, p] = PREFIX.find(([f]) => a >= f * 0.9995) ?? PREFIX.at(-1);
  const x = v / f;
  const d = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(x) + 1e-12)));
  return `${x.toFixed(Math.min(d, 3)).replace("-", "−")} ${p}${unit}`;
}

// E-series preferred values (IEC 60063).
const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
function nextUp(r, series) {
  const dec = 10 ** Math.floor(Math.log10(r));
  const m = r / dec;
  const s = series.find((v) => v >= m - 1e-9);
  return s ? s * dec : series[0] * dec * 10;
}
function nearest(r, series) {
  const dec = 10 ** Math.floor(Math.log10(r));
  const cands = [...series.map((v) => v * dec), series[0] * dec * 10, series.at(-1) * dec / 10];
  return cands.reduce((b, c) => (Math.abs(Math.log(c / r)) < Math.abs(Math.log(b / r)) ? c : b));
}

const K_B = 1.380649e-23, Q_E = 1.602176634e-19;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const logTicks = (lo, hi) => { const t = []; for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) t.push(e); return t; };
const decFmt = (u) => (e) => fmtSI(10 ** e, u, 1).replace(" ", "");

// ============================================================ Diode

for (const root of document.querySelectorAll("[data-elec-diode]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let scale = "lin";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { scale = v; draw(); });

  // Saturation current against temperature, the SPICE model with XTI = 3
  // and the silicon gap Eg = 1.12 eV: roughly −2 mV/K at fixed current.
  const isAt = (is27, n, T) => {
    const T0 = 300.15;
    return is27 * (T / T0) ** (3 / n) * Math.exp(((1.12 * Q_E) / (n * K_B)) * (1 / T0 - 1 / T));
  };

  function draw() {
    const n = s.n.get(), T = s.t.get() + 273.15, is27 = 10 ** s.is.get();
    const vt = (K_B * T) / Q_E;
    const curves = [
      { T: 300.15, style: "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.25;stroke-dasharray:4 4", label: "27 °C" },
      { T, style: "stroke:var(--brand);stroke-width:2", label: `${num(T - 273.15, 0)} °C` },
    ];
    svg.replaceChildren();
    const box = [56, 14, 486, 266];
    if (scale === "lin") {
      const f = frame(svg, { box, x: [0, 1], y: [0, 100], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0, 25, 50, 75, 100], xlabel: "V (V)", ylabel: "I (mA)" });
      for (const c of curves) {
        const is = isAt(is27, n, c.T), vtc = (K_B * c.T) / Q_E;
        const pts = [];
        for (let v = 0; v <= 1; v += 0.002) {
          const i = is * (Math.exp(v / (n * vtc)) - 1) * 1000;
          if (i > 104) break;
          pts.push([f.sx(v), f.sy(i)]);
        }
        polyline(svg, pts, c.style);
      }
    } else {
      const f = frame(svg, { box, x: [0, 1], y: [-12, 0], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [-12, -9, -6, -3, 0], yfmt: decFmt("A"), xlabel: "V (V)", ylabel: "I, log" });
      for (const c of curves) {
        const is = isAt(is27, n, c.T), vtc = (K_B * c.T) / Q_E;
        const pts = [];
        for (let v = 0.005; v <= 1; v += 0.005) {
          const i = is * (Math.exp(v / (n * vtc)) - 1);
          const l = Math.log10(i);
          if (l < -12) continue;
          if (l > 0.2) break;
          pts.push([f.sx(v), f.sy(Math.min(0, l))]);
        }
        polyline(svg, pts, c.style);
      }
    }
    text(svg, box[0] + 8, box[1] + 12, "— this temperature", { style: "fill:var(--brand)" });
    text(svg, box[0] + 8, box[1] + 25, "- - 27 °C reference");
    const is = isAt(is27, n, T);
    const vAt = (i) => n * vt * Math.log(i / is + 1);
    o.vt.textContent = `${num(vt * 1000, 2)} mV`;
    o.v1.textContent = `${num(vAt(1e-3), 3)} V`;
    o.v10.textContent = `${num(vAt(1e-2), 3)} V`;
    o.rd.textContent = `${num((n * vt) / 1e-2, 2)} Ω`;
    o.dec.textContent = `${num(n * vt * Math.LN10 * 1000, 1)} mV`;
  }
  draw();
}

// ============================================================ Rectifier

for (const root of document.querySelectorAll("[data-elec-rect]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "full";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });

  function draw() {
    const vpk = s.vpk.get(), f = s.f.get(), C = s.c.get() * 1e-6, R = s.rl.get(), vf = s.vf.get();
    const T = 1 / f, cycles = 8, N = 4000 * cycles, dt = (cycles * T) / N;
    // Ideal diodes with a constant drop: the capacitor follows the
    // rectified voltage while it is higher, and otherwise discharges
    // into the load.
    let vc = 0;
    const tr = [];
    for (let k = 0; k <= N; k++) {
      const t = k * dt;
      const vin = vpk * Math.sin(2 * Math.PI * f * t);
      const vs = kind === "full" ? Math.max(0, Math.abs(vin) - 2 * vf) : Math.max(0, vin - vf);
      if (vs > vc) vc = vs; else vc -= (vc / (R * C)) * dt;
      tr.push([t, vin, vs, vc]);
    }
    const last = tr.filter(([t]) => t >= (cycles - 2) * T);
    const hi = Math.max(...last.map((p) => p[3])), lo = Math.min(...last.map((p) => p[3]));
    const avg = last.reduce((a, p) => a + p[3], 0) / last.length;
    const fr = kind === "full" ? 2 * f : f;
    const iL = avg / R;

    svg.replaceChildren();
    const show = tr.filter(([t]) => t >= (cycles - 3) * T);
    const t0 = show[0][0];
    const fr0 = frame(svg, { box: [48, 14, 494, 250], x: [0, 3 * T * 1000], y: [-vpk * 1.05, vpk * 1.05],
      xticks: [0, 1, 2, 3].map((k) => k * T * 1000), xfmt: (v) => num(v, 0), yticks: [-vpk, 0, vpk].map((v) => Math.round(v)), xlabel: "time (ms)", ylabel: "V" });
    const P = (i) => show.map((p) => [fr0.sx((p[0] - t0) * 1000), fr0.sy(p[i])]);
    polyline(svg, P(1), "stroke:currentColor;stroke-opacity:0.25;stroke-width:1");
    polyline(svg, P(2), "stroke:var(--vec-u);stroke-opacity:0.7;stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svg, P(3), "stroke:var(--brand);stroke-width:2");
    text(svg, 330, 278, "input", { style: "fill:currentColor;fill-opacity:0.5" });
    text(svg, 372, 278, "rectified", { style: "fill:var(--vec-u)" });
    text(svg, 434, 278, "across C", { style: "fill:var(--brand)" });

    o.vdc.textContent = `${num(avg, 2)} V`;
    o.rip.textContent = `${num((hi - lo) * 1000, 0)} mV`;
    o.ripx.textContent = `${num((iL / (fr * C)) * 1000, 0)} mV`;
    o.il.textContent = fmtSI(iL, "A");
  }
  draw();
}

// ============================================================ Zener

for (const root of document.querySelectorAll("[data-elec-zener]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  const solve = (vin, rs, vz, rl) => {
    const vth = (vin * rl) / (rs + rl); // output with the Zener open
    if (vth < vz) return { vo: vth, is: vin / (rs + rl), iz: 0 };
    const is = (vin - vz) / rs;
    return { vo: vz, is, iz: is - vz / rl };
  };

  function draw() {
    const vin = s.vin.get(), rs = s.rs.get(), vz = s.vz.get(), rl = s.rl.get(), izmin = s.izmin.get() / 1000;
    svg.replaceChildren();
    const lo = 1.5, hi = 4; // log10 of the load sweep, 32 Ω to 10 kΩ
    const sweep = [];
    for (let l = lo; l <= hi + 1e-9; l += 0.01) sweep.push([l, solve(vin, rs, vz, 10 ** l)]);
    const top = frame(svg, { box: [48, 14, 494, 116], x: [lo, hi], y: [0, Math.max(vz, vin) * 1.05], xticks: [], yticks: [0, Math.round(vz * 10) / 10], ylabel: "V out (V)" });
    polyline(svg, sweep.map(([l, r]) => [top.sx(l), top.sy(r.vo)]), "stroke:var(--brand);stroke-width:2");
    const izMax = Math.max(1e-3, ...sweep.map(([, r]) => r.iz)) * 1000;
    const bot = frame(svg, { box: [48, 158, 494, 110], x: [lo, hi], y: [0, izMax * 1.1], xticks: logTicks(lo, hi).concat([]).map((e) => e), xfmt: decFmt("Ω"), yticks: [0, Math.round(izMax)], xlabel: "load R (log)", ylabel: "I Zener (mA)" });
    hline(svg, bot, izmin * 1000, "stroke:var(--code-del);stroke-dasharray:4 4;stroke-opacity:0.8", "I_Z min");
    polyline(svg, sweep.map(([l, r]) => [bot.sx(l), bot.sy(r.iz * 1000)]), "stroke:var(--vec-u);stroke-width:1.75");
    const lx = clamp(Math.log10(rl), lo, hi);
    for (const f of [top, bot]) el("line", { x1: f.sx(lx), x2: f.sx(lx), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:2 3" }, svg);

    const r = solve(vin, rs, vz, rl);
    o.vo.textContent = `${num(r.vo, 2)} V`;
    o.is.textContent = fmtSI(r.is, "A");
    o.iz.textContent = fmtSI(r.iz, "A");
    o.pz.textContent = fmtSI(vz * r.iz, "W");
    o.pz0.textContent = vin > vz ? fmtSI((vz * (vin - vz)) / rs, "W") : "—";
    const state = r.iz <= 0 ? "out of regulation" : r.iz < izmin ? "marginal: I_Z below minimum" : "regulating";
    o.state.textContent = state;
    o.state.style.color = r.iz <= 0 ? "var(--code-del)" : r.iz < izmin ? "var(--vec-out)" : "var(--code-add)";
  }
  draw();
}

// ============================================================ LED resistor

for (const root of document.querySelectorAll("[data-elec-led]")) {
  const svg = root.querySelector("[data-schematic]");
  const o = outs(root);
  let series = E12;
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { series = v === "e24" ? E24 : E12; draw(); });
  root.querySelectorAll("[data-vf]").forEach((b) => b.addEventListener("click", () => s.vf.set(Number(b.dataset.vf))));

  function schematic(rLabel, iLabel) {
    svg.replaceChildren();
    const w = "stroke:currentColor;stroke-width:1.5;fill:none";
    el("path", { d: "M30 30 H95 M165 30 H210 V50 M210 90 V100 H30 V75 M30 55 V30", style: w }, svg);
    // Battery: long and short plates.
    el("line", { x1: 18, x2: 42, y1: 55, y2: 55, style: "stroke:currentColor;stroke-width:2" }, svg);
    el("line", { x1: 24, x2: 36, y1: 63, y2: 63, style: "stroke:currentColor;stroke-width:3" }, svg);
    el("line", { x1: 30, x2: 30, y1: 63, y2: 75, style: w }, svg);
    text(svg, 46, 62, "V_s");
    // Resistor.
    el("rect", { x: 95, y: 22, width: 70, height: 16, rx: 2, style: "fill:var(--background);stroke:currentColor;stroke-width:1.5" }, svg);
    text(svg, 130, 15, rLabel, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    // LED: triangle, bar, two arrows.
    el("path", { d: "M198 50 H222 L210 70 Z", style: "fill:var(--brand);fill-opacity:0.25;stroke:var(--brand);stroke-width:1.5" }, svg);
    el("line", { x1: 198, x2: 222, y1: 72, y2: 72, style: "stroke:var(--brand);stroke-width:1.5" }, svg);
    el("path", { d: "M228 56 l10 -6 M234 66 l10 -6", style: "stroke:var(--brand);stroke-width:1.2" }, svg);
    el("line", { x1: 210, x2: 210, y1: 72, y2: 90, style: w }, svg);
    text(svg, 120, 116, iLabel, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" });
  }

  function draw() {
    const vs = s.vs.get(), vf = s.vf.get(), i = s.if.get() / 1000;
    if (vs <= vf) {
      for (const k of ["rx", "rs", "ireal", "pr", "rating", "pled"]) o[k].textContent = "—";
      o.rx.textContent = "supply ≤ V_f: the LED won't light";
      schematic("—", "");
      return;
    }
    const rx = (vs - vf) / i;
    const rs = nextUp(rx, series);
    const ir = (vs - vf) / rs, pr = ir * ir * rs;
    const rating = [0.125, 0.25, 0.5, 1, 2, 5].find((w) => w >= 2 * pr);
    o.rx.textContent = fmtSI(rx, "Ω");
    o.rs.textContent = `${fmtSI(rs, "Ω")} (${series === E12 ? "E12" : "E24"}, next up)`;
    o.ireal.textContent = fmtSI(ir, "A");
    o.pr.textContent = fmtSI(pr, "W");
    o.rating.textContent = rating ? `${rating >= 1 ? rating : "1/" + Math.round(1 / rating)} W or more` : "> 5 W: rethink";
    o.pled.textContent = fmtSI(vf * ir, "W");
    schematic(fmtSI(rs, "Ω"), `I = ${fmtSI(ir, "A")}`);
  }
  draw();
}

// ============================================================ BJT

for (const root of document.querySelectorAll("[data-elec-bjt]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let bypass = true;
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { if (k === "bypass") { bypass = on; draw(); } });
  const VBE = 0.7, VSAT = 0.2, VT = 0.02585;

  function draw() {
    const vcc = s.vcc.get(), r1 = s.r1.get() * 1e3, r2 = s.r2.get() * 1e3, rc = s.rc.get() * 1e3, re = s.re.get() * 1e3, beta = s.beta.get();
    const vth = (vcc * r2) / (r1 + r2), rth = (r1 * r2) / (r1 + r2);
    let ib = (vth - VBE) / (rth + (beta + 1) * re);
    let ic, vce, region;
    if (ib <= 0) { ib = 0; ic = 0; vce = vcc; region = "cut-off"; }
    else {
      ic = beta * ib;
      vce = vcc - ic * rc - (beta + 1) * ib * re;
      region = "active";
      if (vce < VSAT) {
        // Saturated: V_CE is pinned, the collector current is set by the
        // resistors rather than by β.
        vce = VSAT;
        ic = (vcc - VSAT - ib * re) / (rc + re);
        region = "saturation";
      }
    }
    const icmax = vcc / (rc + re);
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 486, 266], x: [0, vcc], y: [0, icmax * 1000 * 1.15],
      xticks: [0, vcc / 2, vcc].map((v) => Math.round(v * 10) / 10), yticks: [0, Math.round(icmax * 1000 * 10) / 10], xlabel: "V_CE (V)", ylabel: "I_C (mA)" });
    // Output curves: flat in the active region with a 100 V Early voltage,
    // a soft knee into saturation.
    const VA = 100;
    for (const k of [0.25, 0.5, 0.75, 1, 1.25, 1.5]) {
      const ibk = (ib || icmax / beta / 2) * k;
      const pts = [];
      for (let v = 0; v <= vcc; v += vcc / 200) {
        const iv = beta * ibk * (1 + v / VA) * (1 - Math.exp(-v / 0.08));
        pts.push([f.sx(v), f.sy(Math.min(iv * 1000, icmax * 1000 * 1.15))]);
      }
      polyline(svg, pts, `stroke:currentColor;stroke-opacity:${k === 1 ? 0.55 : 0.18};stroke-width:${k === 1 ? 1.5 : 1}`);
    }
    el("line", { x1: f.sx(0), y1: f.sy(icmax * 1000), x2: f.sx(vcc), y2: f.sy(0), style: "stroke:var(--vec-u);stroke-width:1.75" }, svg);
    text(svg, f.sx(vcc * 0.62), f.sy(icmax * 1000 * 0.38) - 6, "DC load line", { style: "fill:var(--vec-u)" });
    el("circle", { cx: f.sx(vce), cy: f.sy(ic * 1000), r: 5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, f.sx(vce) + 8, f.sy(ic * 1000) - 8, "Q", { class: "fill-foreground font-mono text-[11px]" });

    const gm = ic / VT;
    const gain = region !== "active" ? NaN : bypass ? -gm * rc : -rc / (1 / gm + re);
    o.ic.textContent = fmtSI(ic, "A");
    o.vce.textContent = `${num(vce, 2)} V`;
    o.region.textContent = region;
    o.region.style.color = region === "active" ? "var(--code-add)" : "var(--code-del)";
    o.gm.textContent = fmtSI(gm, "S");
    o.gain.textContent = Number.isFinite(gain) ? `${num(gain, 1)} (${num(20 * Math.log10(Math.abs(gain)), 1)} dB)` : "— (not in the active region)";
  }
  draw();
}

// ============================================================ MOSFET

for (const root of document.querySelectorAll("[data-elec-mos]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const idOf = (k, vth, vgs, vds) => {
    const ov = vgs - vth;
    if (ov <= 0) return 0;
    return vds < ov ? k * (ov * vds - (vds * vds) / 2) : (k / 2) * ov * ov;
  };

  function draw() {
    const vth = s.vth.get(), k = s.k.get(), vgs = s.vgs.get();
    const vdsMax = 10;
    const top = (k / 2) * Math.max(3, vgs - vth + 0.5) ** 2;
    svg.replaceChildren();
    const f = frame(svg, { box: [56, 14, 446, 266], x: [0, vdsMax], y: [0, top * 1.05], xticks: [0, 2, 4, 6, 8, 10], yticks: [0, Math.round(top / 2), Math.round(top)], xlabel: "V_DS (V)", ylabel: "I_D (A)" });
    for (let d = 0.5; d <= 3; d += 0.5) {
      const g = vth + d;
      const pts = [];
      for (let v = 0; v <= vdsMax; v += 0.05) pts.push([f.sx(v), f.sy(idOf(k, vth, g, v))]);
      polyline(svg, pts, "stroke:currentColor;stroke-opacity:0.2;stroke-width:1");
      text(svg, f.sx(vdsMax) + 4, f.sy(idOf(k, vth, g, vdsMax)) + 3, `${num(g, 1)} V`, { "text-anchor": "start" });
    }
    // The saturation boundary V_DS = V_GS − V_th, where I = (k/2)V_DS².
    const edge = [];
    for (let v = 0; v <= vdsMax; v += 0.05) { const i = (k / 2) * v * v; if (i > top * 1.05) break; edge.push([f.sx(v), f.sy(i)]); }
    polyline(svg, edge, "stroke:var(--vec-u);stroke-dasharray:4 4;stroke-width:1.25");
    text(svg, f.L + 8, f.T + 12, "- - edge of saturation", { style: "fill:var(--vec-u)" });
    if (vgs > vth) {
      const pts = [];
      for (let v = 0; v <= vdsMax; v += 0.05) pts.push([f.sx(v), f.sy(Math.min(top * 1.05, idOf(k, vth, vgs, v)))]);
      polyline(svg, pts, "stroke:var(--brand);stroke-width:2");
    }

    const v = s.v.get(), i = s.i.get(), rds = s.rds.get() / 1000, qg = s.qg.get() * 1e-9, ig = s.ig.get(), fsw = s.fsw.get() * 1e3;
    const pcond = i * i * rds, tsw = qg / ig, psw = 0.5 * v * i * (2 * tsw) * fsw;
    o.region.textContent = vgs <= vth ? "cut-off" : `on (saturation above V_DS = ${num(vgs - vth, 2)} V)`;
    o.id.textContent = vgs <= vth ? "0 A" : fmtSI((k / 2) * (vgs - vth) ** 2, "A");
    o.pcond.textContent = fmtSI(pcond, "W");
    o.tsw.textContent = fmtSI(tsw, "s");
    o.psw.textContent = fmtSI(psw, "W");
    o.ptot.textContent = fmtSI(pcond + psw, "W");
  }
  draw();
}

// ============================================================ Op-amp

const OPAMP = {
  inverting: { formula: "V_out = −(R_f/R_in)·V_in", ng: (r) => 1 + r.rf / r.rin },
  noninverting: { formula: "V_out = (1 + R_f/R_in)·V_in", ng: (r) => 1 + r.rf / r.rin },
  follower: { formula: "V_out = V_in", ng: () => 1 },
  summing: { formula: "V_out = −R_f(V₁ + V₂)/R_in", ng: (r) => 1 + (2 * r.rf) / r.rin },
  integrator: { formula: "V_out = −(1/R_in C)∫V_in dt  (R_f ∥ C)", ng: null },
  differentiator: { formula: "V_out = −R_f C·dV_in/dt", ng: null },
  schmitt: { formula: "thresholds ±V_sat·R_in/(R_in + R_f)", ng: null },
};

for (const root of document.querySelectorAll("[data-elec-opamp]")) {
  const sch = root.querySelector("[data-schematic]");
  const svg = root.querySelector("[data-plot]");
  const sel = root.querySelector("[data-config]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  sel.addEventListener("change", draw);

  function schematic(cfg) {
    sch.replaceChildren();
    const w = "stroke:currentColor;stroke-width:1.4;fill:none";
    // The amplifier: inputs on the left, output on the right.
    el("path", { d: "M250 50 V130 L330 90 Z", style: "fill:var(--background);stroke:currentColor;stroke-width:1.6" }, sch);
    text(sch, 258, 72, "−", { class: "fill-foreground font-mono text-[13px]" });
    text(sch, 258, 116, "+", { class: "fill-foreground font-mono text-[13px]" });
    el("path", { d: "M330 90 H420", style: w }, sch);
    text(sch, 426, 94, "V_out", { "text-anchor": "start" });
    const res = (x1, y, x2, label) => {
      el("path", { d: `M${x1} ${y} H${(x1 + x2) / 2 - 22} M${(x1 + x2) / 2 + 22} ${y} H${x2}`, style: w }, sch);
      el("rect", { x: (x1 + x2) / 2 - 22, y: y - 6, width: 44, height: 12, rx: 2, style: "fill:var(--background);stroke:currentColor;stroke-width:1.4" }, sch);
      text(sch, (x1 + x2) / 2, y - 10, label, { "text-anchor": "middle" });
    };
    const cap = (x1, y, x2, label) => {
      const m = (x1 + x2) / 2;
      el("path", { d: `M${x1} ${y} H${m - 3} M${m + 3} ${y} H${x2} M${m - 3} ${y - 9} V${y + 9} M${m + 3} ${y - 9} V${y + 9}`, style: w }, sch);
      text(sch, m, y - 12, label, { "text-anchor": "middle" });
    };
    const ground = (x, y) => el("path", { d: `M${x} ${y} V${y + 8} M${x - 8} ${y + 8} H${x + 8} M${x - 5} ${y + 12} H${x + 5} M${x - 2} ${y + 16} H${x + 2}`, style: w }, sch);
    const fb = (kind) => {
      el("path", { d: "M230 70 V25 M380 90 V25", style: w }, sch);
      if (kind === "R") res(230, 25, 380, "R_f");
      else if (kind === "C") cap(230, 25, 380, "C");
      else { res(230, 25, 380, "R_f"); el("path", { d: "M230 25 V8 M380 25 V8", style: w }, sch); cap(230, 8, 380, "C"); }
    };
    if (cfg === "inverting" || cfg === "summing" || cfg === "integrator" || cfg === "differentiator") {
      el("path", { d: "M230 70 H250 M250 110 H230 V120", style: w }, sch);
      ground(230, 120);
      if (cfg === "differentiator") cap(60, 70, 230, "C"); else res(60, 70, 230, cfg === "summing" ? "R_in (V₁)" : "R_in");
      text(sch, 54, 74, cfg === "summing" ? "V₁" : "V_in", { "text-anchor": "end" });
      if (cfg === "summing") { res(60, 140, 200, "R_in (V₂)"); el("path", { d: "M200 140 H215 V70", style: w }, sch); text(sch, 54, 144, "V₂", { "text-anchor": "end" }); }
      fb(cfg === "integrator" ? "RC" : "R");
    } else if (cfg === "noninverting") {
      el("path", { d: "M60 110 H250 M250 70 H230 V130", style: w }, sch);
      text(sch, 54, 114, "V_in", { "text-anchor": "end" });
      res(150, 130, 230, "R_in"); el("path", { d: "M150 130 V138", style: w }, sch); ground(150, 138);
      fb("R");
    } else if (cfg === "follower") {
      el("path", { d: "M60 110 H250 M250 70 H230 V25 H380 V90", style: w }, sch);
      text(sch, 54, 114, "V_in", { "text-anchor": "end" });
    } else {
      // Inverting Schmitt: input on −, positive feedback divider on +.
      el("path", { d: "M60 70 H250 M250 110 H230", style: w }, sch);
      text(sch, 54, 74, "V_in", { "text-anchor": "end" });
      el("path", { d: "M230 110 V150 M380 90 V150", style: w }, sch);
      res(230, 150, 380, "R_f");
      res(140, 110, 230, "R_in"); el("path", { d: "M140 110 V120", style: w }, sch); ground(140, 120);
    }
  }

  function draw() {
    const cfg = sel.value;
    const r = { rin: s.rin.get() * 1e3, rf: s.rf.get() * 1e3 };
    const C = s.cap.get() * 1e-9, A = s.amp.get(), f = s.freq.get(), rail = s.rail.get(), gbw = s.gbw.get() * 1e6;
    const w = 2 * Math.PI * f;
    const clip = (v) => clamp(v, -rail, rail);
    const T = 1 / f, N = 600;
    const vin = (t) => A * Math.sin(w * t);
    const v2 = (t) => (A / 2) * Math.sin(3 * w * t);
    let gainText = "", vout;
    if (cfg === "inverting") { const g = -r.rf / r.rin; vout = (t) => clip(g * vin(t)); gainText = num(g, 2); }
    else if (cfg === "noninverting") { const g = 1 + r.rf / r.rin; vout = (t) => clip(g * vin(t)); gainText = num(g, 2); }
    else if (cfg === "follower") { vout = (t) => clip(vin(t)); gainText = "1"; }
    else if (cfg === "summing") { vout = (t) => clip((-r.rf / r.rin) * (vin(t) + v2(t))); gainText = `${num(-r.rf / r.rin, 2)} per input`; }
    else if (cfg === "integrator") {
      // Steady state of the practical integrator: R_f across C sets the DC
      // gain; above f = 1/(2πR_f C) it integrates.
      const mag = r.rf / r.rin / Math.sqrt(1 + (w * r.rf * C) ** 2), ph = Math.PI - Math.atan(w * r.rf * C);
      vout = (t) => clip(A * mag * Math.sin(w * t + ph));
      gainText = `${num(mag, 3)} at f (ideal 1/ωR_inC = ${num(1 / (w * r.rin * C), 3)})`;
    } else if (cfg === "differentiator") {
      const g = w * r.rf * C;
      vout = (t) => clip(-A * g * Math.cos(w * t));
      gainText = `${num(g, 3)} at f`;
    } else {
      const th = (rail * r.rin) / (r.rin + r.rf);
      let state = rail;
      const seq = [];
      for (let k = 0; k <= N * 2; k++) {
        const t = (k / N) * T;
        const x = vin(t);
        if (state > 0 && x > th) state = -rail; else if (state < 0 && x < -th) state = rail;
        seq.push(state);
      }
      vout = (t) => seq[Math.round((t / T) * N)] ?? state;
      gainText = `switches at ±${num(th, 2)} V`;
    }

    schematic(cfg);
    svg.replaceChildren();
    const ymax = Math.max(rail, A) * 1.05;
    const fr = frame(svg, { box: [44, 12, 498, 186], x: [0, 2], y: [-ymax, ymax], xticks: [0, 0.5, 1, 1.5, 2], xfmt: (v) => `${v}T`, yticks: [-Math.round(rail), 0, Math.round(rail)], xlabel: "time (periods)", ylabel: "V" });
    hline(svg, fr, rail, "stroke:var(--code-del);stroke-opacity:0.5;stroke-dasharray:3 4", "rail");
    hline(svg, fr, -rail, "stroke:var(--code-del);stroke-opacity:0.5;stroke-dasharray:3 4");
    const pts = (fn) => Array.from({ length: N * 2 + 1 }, (_, k) => { const t = (k / N) * T; return [fr.sx(k / N), fr.sy(fn(t))]; });
    polyline(svg, pts(vin), "stroke:currentColor;stroke-opacity:0.4;stroke-width:1.25");
    if (cfg === "summing") polyline(svg, pts(v2), "stroke:currentColor;stroke-opacity:0.25;stroke-width:1;stroke-dasharray:3 3");
    polyline(svg, pts(vout), "stroke:var(--brand);stroke-width:2");
    if (cfg === "schmitt") { const th = (rail * r.rin) / (r.rin + r.rf); hline(svg, fr, th, "stroke:var(--vec-u);stroke-dasharray:2 3", "+threshold"); hline(svg, fr, -th, "stroke:var(--vec-u);stroke-dasharray:2 3"); }
    text(svg, 44, 224, "in", { style: "fill:currentColor;fill-opacity:0.6" });
    text(svg, 62, 224, "out", { style: "fill:var(--brand)" });

    let peak = 0, clipped = false;
    for (let k = 0; k <= N; k++) { const v = vout((k / N) * T); peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) >= rail - 1e-9 && cfg !== "schmitt") clipped = true; }
    const spec = OPAMP[cfg];
    o.formula.textContent = spec.formula;
    o.gain.textContent = gainText;
    o.vout.textContent = `${num(peak, 2)} V`;
    const bw = spec.ng ? gbw / spec.ng(r) : NaN;
    o.bw.textContent = Number.isFinite(bw) ? `≈ ${fmtSI(bw, "Hz")} (GBW / noise gain ${num(spec.ng(r), 1)})` : "—";
    o.note.textContent = clipped ? "clipping at the rails" : Number.isFinite(bw) && f > bw ? "input above the closed-loop bandwidth: real gain is lower" : "within limits (ideal op-amp)";
    o.note.style.color = clipped || (Number.isFinite(bw) && f > bw) ? "var(--code-del)" : "";
  }
  draw();
}

// ============================================================ Filters

for (const root of document.querySelectorAll("[data-elec-filter]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let kind = "rc-lp";
  const s = scrubAll(root, draw);
  onSeg(root, (v) => { kind = v; draw(); });

  function draw() {
    const fcT = s.fc.get(), comp = s.comp.get();
    const rc = kind.startsWith("rc"), low = kind.endsWith("lp");
    // RC: R = 1/(2π f C) with C in nF. RL: R = 2π f L with L in mH.
    const rx = rc ? 1 / (2 * Math.PI * fcT * comp * 1e-9) : 2 * Math.PI * fcT * comp * 1e-3;
    const r24 = nearest(rx, E24);
    const fc = rc ? 1 / (2 * Math.PI * r24 * comp * 1e-9) : r24 / (2 * Math.PI * comp * 1e-3);
    const H = (f) => { const x = f / fc; return low ? 1 / Math.sqrt(1 + x * x) : x / Math.sqrt(1 + x * x); };
    const ph = (f) => (low ? -Math.atan(f / fc) : Math.PI / 2 - Math.atan(f / fc)) * (180 / Math.PI);

    svg.replaceChildren();
    const lo = Math.log10(fc) - 2, hi = Math.log10(fc) + 2;
    const ticks = logTicks(lo, hi);
    const m = frame(svg, { box: [52, 14, 490, 170], x: [lo, hi], y: [-45, 3], xticks: [], yticks: [-40, -20, -3, 0], ylabel: "|H| (dB)" });
    for (const t of ticks) el("line", { x1: m.sx(t), x2: m.sx(t), y1: m.T, y2: m.T + m.H, style: "stroke:currentColor;stroke-opacity:0.07" }, svg);
    const pts = (fn, fr) => Array.from({ length: 401 }, (_, k) => { const l = lo + ((hi - lo) * k) / 400; return [fr.sx(l), fr.sy(fn(10 ** l))]; });
    polyline(svg, pts((f) => 20 * Math.log10(H(f)), m), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: m.sx(Math.log10(fc)), x2: m.sx(Math.log10(fc)), y1: m.T, y2: m.T + m.H, style: "stroke:var(--vec-u);stroke-dasharray:3 3" }, svg);
    el("circle", { cx: m.sx(Math.log10(fc)), cy: m.sy(-3.0103), r: 4, style: "fill:var(--background);stroke:var(--vec-u);stroke-width:1.75" }, svg);
    text(svg, m.sx(Math.log10(fc)) + 6, m.sy(-3) - 6, "−3 dB", { style: "fill:var(--vec-u)" });
    const p = frame(svg, { box: [52, 206, 490, 100], x: [lo, hi], y: [low ? -90 : 0, low ? 0 : 90], xticks: ticks, xfmt: decFmt("Hz"), yticks: low ? [-90, -45, 0] : [0, 45, 90], xlabel: "frequency", ylabel: "phase (°)" });
    polyline(svg, pts(ph, p), "stroke:var(--vec-v);stroke-width:1.75");

    o.rx.textContent = fmtSI(rx, "Ω");
    o.r24.textContent = fmtSI(r24, "Ω");
    o.fc.textContent = fmtSI(fc, "Hz");
    o.err.textContent = `${num(((fc - fcT) / fcT) * 100, 1)} %`;
    o.dec.textContent = `${num(20 * Math.log10(H(low ? 10 * fc : fc / 10)), 2)} dB at ${low ? "10 f_c" : "f_c/10"}`;
  }
  draw();
}

// ============================================================ 555 astable

for (const root of document.querySelectorAll("[data-elec-555]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const r1 = s.r1.get() * 1e3, r2 = s.r2.get() * 1e3, C = s.c.get() * 1e-6, vcc = s.vcc.get();
    const t1 = (r1 + r2) * C, t2 = r2 * C;
    const th = Math.LN2 * t1, tl = Math.LN2 * t2, T = th + tl;
    // First charge from 0 to ⅔: ln 3 time constants, then the cycle.
    const t0 = Math.log(3) * t1, total = t0 + 3 * T;
    const vc = [], vo = [];
    const N = 900;
    for (let k = 0; k <= N; k++) {
      const t = (k / N) * total;
      let v, out;
      if (t < t0) { v = vcc * (1 - Math.exp(-t / t1)); out = vcc; }
      else {
        const u = (t - t0) % T;
        if (u < tl) { v = ((2 * vcc) / 3) * Math.exp(-u / t2); out = 0; }
        else { v = vcc - ((2 * vcc) / 3) * Math.exp(-(u - tl) / t1); out = vcc; }
      }
      vc.push([t, v]); vo.push([t, out]);
    }
    svg.replaceChildren();
    const unit = total < 1e-3 ? [1e6, "µs"] : total < 1 ? [1e3, "ms"] : [1, "s"];
    const xt = [0, total / 2, total].map((v) => v * unit[0]);
    const a = frame(svg, { box: [48, 14, 494, 120], x: [0, total * unit[0]], y: [0, vcc * 1.08], xticks: [], yticks: [0, Math.round((vcc / 3) * 10) / 10, Math.round(((2 * vcc) / 3) * 10) / 10], ylabel: "capacitor (V)" });
    hline(svg, a, vcc / 3, "stroke:var(--vec-u);stroke-opacity:0.6;stroke-dasharray:3 3");
    hline(svg, a, (2 * vcc) / 3, "stroke:var(--vec-u);stroke-opacity:0.6;stroke-dasharray:3 3");
    polyline(svg, vc.map(([t, v]) => [a.sx(t * unit[0]), a.sy(v)]), "stroke:var(--vec-u);stroke-width:1.75");
    const b = frame(svg, { box: [48, 168, 494, 90], x: [0, total * unit[0]], y: [-0.5, vcc * 1.15], xticks: xt, xfmt: (v) => (v === 0 ? "0" : num(v, v < 10 ? 2 : 0)), yticks: [0, vcc], xlabel: `time (${unit[1]})`, ylabel: "output (V)" });
    const step = [];
    vo.forEach(([t, v], i) => { if (i) step.push([b.sx(t * unit[0]), b.sy(vo[i - 1][1])]); step.push([b.sx(t * unit[0]), b.sy(v)]); });
    polyline(svg, step, "stroke:var(--brand);stroke-width:2");

    o.th.textContent = fmtSI(th, "s");
    o.tl.textContent = fmtSI(tl, "s");
    o.f.textContent = fmtSI(1 / T, "Hz");
    o.duty.textContent = `${num((th / T) * 100, 1)} %`;
  }
  draw();
}

// ============================================================ Colour code

for (const root of document.querySelectorAll("[data-elec-colors]")) {
  const B = JSON.parse(root.querySelector("[data-bands]").textContent);
  const svg = root.querySelector("[data-resistor]");
  const pickers = root.querySelector("[data-pickers]");
  const input = root.querySelector("[data-value-input]");
  const o = outs(root);
  const byName = Object.fromEntries(B.map((b) => [b.name, b]));
  let count = 4;
  // Selected colour per role; digits are kept as three so 4↔5 bands
  // preserves what it can.
  let sel = { d: ["brown", "black", "black"], mult: "red", tol: "gold", tc: "brown" };

  const roles = () => {
    const nd = count === 4 ? 2 : 3;
    const r = [];
    for (let i = 0; i < nd; i++) r.push({ key: `d${i}`, label: `Digit ${i + 1}`, short: ["1st", "2nd", "3rd"][i], ok: (b) => b.digit >= 0 });
    r.push({ key: "mult", label: "Multiplier", short: "×", ok: (b) => b.mult >= -2 && b.mult <= 9 && (b.digit >= 0 || b.mult < 0) });
    r.push({ key: "tol", label: "Tolerance", short: "tol.", ok: (b) => b.tol !== "" });
    if (count === 6) r.push({ key: "tc", label: "Temp. coeff.", short: "ppm", ok: (b) => b.tempco !== "" });
    return r;
  };
  const get = (key) => (key[0] === "d" && key !== "d" ? sel.d[Number(key.slice(1))] : sel[key]);
  const put = (key, name) => { if (key[0] === "d" && /^d\d$/.test(key)) sel.d[Number(key.slice(1))] = name; else sel[key] = name; };

  function value() {
    const nd = count === 4 ? 2 : 3;
    let n = 0;
    for (let i = 0; i < nd; i++) n = n * 10 + byName[sel.d[i]].digit;
    return n * 10 ** byName[sel.mult].mult;
  }

  function render() {
    const rs = roles();
    // The resistor: leads, a beige body, bands spaced with a gap before the
    // tolerance band, as printed.
    svg.replaceChildren();
    el("line", { x1: 10, x2: 550, y1: 70, y2: 70, style: "stroke:currentColor;stroke-opacity:0.45;stroke-width:4;stroke-linecap:round" }, svg);
    el("rect", { x: 130, y: 34, width: 300, height: 72, rx: 30, style: "fill:#d9c39b;stroke:currentColor;stroke-opacity:0.35;stroke-width:1.5" }, svg);
    const xs = rs.map((_, i) => (i < rs.length - (count === 6 ? 2 : 1) ? 170 + i * 40 : 170 + i * 40 + 30));
    rs.forEach((r, i) => {
      const b = byName[get(r.key)];
      el("rect", { x: xs[i] - 9, y: 35, width: 18, height: 70, style: `fill:${b.color};stroke:rgba(0,0,0,0.25);stroke-width:1` }, svg);
      text(svg, xs[i], 126, r.short, { "text-anchor": "middle" });
    });
    // Pickers.
    pickers.replaceChildren();
    for (const r of rs) {
      const row = document.createElement("div");
      row.className = "flex flex-wrap items-center gap-1.5";
      const lab = document.createElement("span");
      lab.className = "w-28 text-xs text-muted-foreground";
      lab.textContent = r.label;
      row.append(lab);
      for (const b of B.filter(r.ok)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "size-6 rounded-full border shadow-xs outline-none transition-[box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-brand aria-pressed:ring-offset-2 aria-pressed:ring-offset-background";
        btn.style.background = b.color;
        btn.setAttribute("aria-label", `${r.label}: ${b.name}`);
        btn.title = b.name;
        btn.setAttribute("aria-pressed", String(get(r.key) === b.name));
        btn.addEventListener("click", () => { put(r.key, b.name); render(); });
        row.append(btn);
      }
      pickers.append(row);
    }
    const v = value();
    o.value.textContent = `${fmtSI(v, "Ω")} ${byName[sel.tol].tol}`;
    o.detail.textContent = rs.map((r) => get(r.key)).join(" · ") + (count === 6 ? ` · ${byName[sel.tc].tempco}` : "");
  }

  // Parses 4k7, 4.7k, 220, 100R, 0R47, 1M, 2.2 kΩ.
  function parse(str) {
    const m = str.trim().replace(/\s|Ω|ohms?/gi, "").match(/^(\d*)(?:[.,](\d+))?([rkmg])?(\d*)$/i);
    if (!m || (!m[1] && !m[2] && !m[4])) return NaN;
    const mult = { r: 1, k: 1e3, m: 1e6, g: 1e9 }[(m[3] || "r").toLowerCase()];
    const frac = m[2] ?? m[4] ?? "";
    return Number(`${m[1] || "0"}.${frac || "0"}`) * mult;
  }

  function encode() {
    const v = parse(input.value);
    const nd = count === 4 ? 2 : 3;
    if (!(v > 0)) { o.detail.textContent = "Couldn't read that value: try 4k7, 220 or 1.5M."; return; }
    let e = Math.floor(Math.log10(v) + 1e-9) - (nd - 1);
    let n = Math.round(v / 10 ** e);
    if (n >= 10 ** nd) { n = Math.round(n / 10); e += 1; }
    // Below the smallest multiplier (silver, ×0.01), pad with leading zero
    // digits: 0R47 on five bands is 0·4·7 × 0.01.
    if (e < -2) { e = -2; n = Math.round(v * 100); }
    if (n < 1 || e > 9) { o.detail.textContent = "Out of range for the colour code."; return; }
    const digits = String(n).padStart(nd, "0").split("").map(Number);
    digits.forEach((d, i) => { sel.d[i] = B.find((b) => b.digit === d).name; });
    sel.mult = B.find((b) => b.mult === e && (b.digit >= 0 || e < 0)).name;
    render();
    const exact = Math.abs(n * 10 ** e - v) / v < 1e-9;
    if (!exact) o.detail.textContent += `  (rounded from ${fmtSI(v, "Ω", 4)})`;
  }

  root.querySelector("[data-encode]").addEventListener("click", encode);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") encode(); });
  onSeg(root, (v) => { count = Number(v); render(); });
  render();
}
