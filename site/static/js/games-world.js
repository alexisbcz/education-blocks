// Game design and game AI, part 2: procedural worlds (noise terrain, wave
// function collapse), game feel, an NPC state machine and steering.

import { scrubAll } from "./scrub.js";
import { el, text, num } from "./plot.js";

const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Colours: CSS custom properties resolved to [r, g, b] by painting a pixel,
// since ImageData needs numbers.
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
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const palette = () => ({
  fg: rgbOf("var(--foreground)"), bg: rgbOf("var(--background)"), brand: rgbOf("var(--brand)"),
  muted: rgbOf("var(--muted-foreground)"), water: rgbOf("var(--vec-u)"), sand: rgbOf("var(--vec-out)"),
  grass: rgbOf("var(--code-add)"), warn: rgbOf("var(--code-del)"),
});
// Theme or accent changes land as attributes on <html>.
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true });

// Sizes a canvas to its box at the device pixel ratio (capped at 2) and
// returns the context scaled so that 1 unit = `world` / CSS width.
function fit(canvas, worldW) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = canvas.getContext("2d");
  const k = worldW ? (r.width * dpr) / worldW : dpr;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  return { ctx, w: r.width, h: r.height, k };
}

// A requestAnimationFrame loop that only runs while `want()` and its block
// is on screen; `kick()` re-checks after state changes.
function loop(root, tick, want) {
  let raf = 0, visible = false, last = 0;
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt);
    raf = visible && want() ? requestAnimationFrame(step) : 0;
  };
  const kick = () => {
    if (visible && want() && !raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    if ((!visible || !want()) && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(root);
  return kick;
}

function playButton(btn) {
  const label = btn.querySelector("[data-label]");
  const first = label.textContent;
  return (playing) => {
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    label.textContent = playing ? "Pause" : first;
  };
}

function toggles(root) {
  const on = {};
  for (const sw of root.querySelectorAll("[data-toggle]")) {
    on[sw.dataset.toggle] = sw.getAttribute("aria-checked") === "true" || sw.dataset.state === "checked";
    sw.addEventListener("shadcn:checked-change", (e) => { on[sw.dataset.toggle] = e.detail.checked; root.dispatchEvent(new Event("game-toggle")); });
  }
  return on;
}

// ============================================================ Noise terrain

function perlin(seed) {
  const rng = mulberry32(seed * 9973 + 1);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const g = (h, x, y) => GX[h & 7] * x + GY[h & 7] * y;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1], ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const x1 = g(aa, xf, yf) + u * (g(ba, xf - 1, yf) - g(aa, xf, yf));
    const x2 = g(ab, xf, yf - 1) + u * (g(bb, xf - 1, yf - 1) - g(ab, xf, yf - 1));
    return x1 + v * (x2 - x1);
  };
}

for (const root of document.querySelectorAll("[data-game-noise]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  let seed = 1, pal = palette(), queued = 0;
  const s = scrubAll(root, () => queue());
  const off = document.createElement("canvas");

  function render() {
    queued = 0;
    const { ctx, w, h } = fit(canvas);
    if (w < 2) return;
    // One sample per CSS pixel, then scaled to the device pixels.
    const W = Math.round(w), H = Math.round(h);
    const noise = perlin(seed);
    const oct = Math.round(s.octaves.get()), pers = s.persistence.get(), lac = s.lacunarity.get(), scale = s.scale.get(), sea = s.sea.get();
    const hgt = new Float32Array(W * H);
    let lo = Infinity, hi = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let a = 1, f = 1 / scale, v = 0;
      for (let k = 0; k < oct; k++) { v += a * noise(x * f + k * 17.3, y * f + k * 31.7); a *= pers; f *= lac; }
      hgt[y * W + x] = v;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    for (let i = 0; i < hgt.length; i++) hgt[i] = (hgt[i] - lo) / (hi - lo || 1);
    const snowC = lum(pal.fg) > lum(pal.bg) ? pal.fg : pal.bg;
    const rockLine = sea + 0.6 * (1 - sea), snowLine = sea + 0.82 * (1 - sea);
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    const img = octx.createImageData(W, H);
    let land = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, v = hgt[i];
      let c;
      if (v < sea) c = mix(pal.bg, pal.water, 0.45 + 0.5 * ((sea - v) / sea));
      else {
        land++;
        const t = (v - sea) / (1 - sea);
        if (v < sea + 0.012) c = mix(pal.sand, pal.grass, 0.3);
        else if (v < rockLine) c = mix(pal.grass, mix(pal.grass, pal.muted, 0.5), t / 0.6);
        else if (v < snowLine) c = pal.muted;
        else c = snowC;
        // Hill shading from the north-west.
        const dx = hgt[y * W + Math.min(W - 1, x + 1)] - hgt[y * W + Math.max(0, x - 1)];
        const dy = hgt[Math.min(H - 1, y + 1) * W + x] - hgt[Math.max(0, y - 1) * W + x];
        const shade = Math.max(0.55, Math.min(1.25, 1 - (dx + dy) * 12));
        c = [c[0] * shade, c[1] * shade, c[2] * shade];
      }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, W, H);
    // Peaks: local maxima above the rock line within a 9 px radius.
    let peaks = 0;
    const R = 9;
    for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
      const v = hgt[y * W + x];
      if (v < rockLine || v < hgt[y * W + x - 1] || v < hgt[y * W + x + 1] || v < hgt[(y - 1) * W + x] || v < hgt[(y + 1) * W + x]) continue;
      let top = true;
      for (let yy = -R; yy <= R && top; yy++) for (let xx = -R; xx <= R; xx++) if ((xx || yy) && hgt[(y + yy) * W + x + xx] >= v) { top = false; break; }
      if (top) peaks++;
    }
    o.seed.textContent = String(seed);
    o.land.textContent = `${num((100 * land) / (W * H), 0)}%`;
    o.peaks.textContent = String(peaks);
  }
  const queue = () => { if (!queued) queued = requestAnimationFrame(render); };
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; queue(); });
  new ResizeObserver(queue).observe(canvas);
  onTheme(() => { pal = palette(); queue(); });
}

// ============================================================ Wave function collapse

// Pipe tiles as bitmasks of the sides they connect: N 1, E 2, S 4, W 8.
// Every tile with a connection has at least two, so no pipe dead-ends.
const TILES = [0, 5, 10, 3, 6, 12, 9, 7, 14, 13, 11, 15];
const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]; // dx, dy, bit, opposite bit
const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

for (const root of document.querySelectorAll("[data-game-wfc]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const GW = 20, GH = 15;
  let pal = palette(), seed = 1, rng, dom, fails, last = -1, playing = false;
  const s = scrubAll(root, () => { init(); solveAll(); draw(); });
  const showPlay = playButton(root.querySelector("[data-action=play]"));

  const weight = (t) => (t === 0 ? s.empty.get() : popcount(t) >= 3 ? s.cross.get() : 1);
  const tileMask = () => TILES.reduce((m, t, i) => (weight(t) > 0 ? m | (1 << i) : m), 0);

  function propagate(stack) {
    while (stack.length) {
      const c = stack.pop(), cx = c % GW, cy = (c / GW) | 0;
      for (const [dx, dy, bit, opp] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        let has = false, not = false;
        for (let i = 0; i < 12; i++) if (dom[c] & (1 << i)) { if (TILES[i] & bit) has = true; else not = true; }
        const n = ny * GW + nx;
        let keep = 0;
        for (let i = 0; i < 12; i++) if (dom[n] & (1 << i)) if (TILES[i] & opp ? has : not) keep |= 1 << i;
        if (keep !== dom[n]) {
          dom[n] = keep;
          if (!keep) return false;
          stack.push(n);
        }
      }
    }
    return true;
  }

  function reset() {
    dom = new Uint16Array(GW * GH).fill(tileMask());
    last = -1;
    // Closed boundary: no pipe leaves the grid.
    const stack = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let ban = 0;
      if (y === 0) ban |= 1; if (x === GW - 1) ban |= 2; if (y === GH - 1) ban |= 4; if (x === 0) ban |= 8;
      if (!ban) continue;
      const c = y * GW + x;
      for (let i = 0; i < 12; i++) if (TILES[i] & ban) dom[c] &= ~(1 << i);
      stack.push(c);
    }
    propagate(stack);
  }
  function init() { rng = mulberry32(seed * 2654435761); fails = 0; reset(); }

  // One observation: collapse the lowest-entropy cell, then propagate.
  // Returns false when every cell is collapsed.
  function step() {
    let best = -1, bestH = Infinity;
    for (let c = 0; c < dom.length; c++) {
      if (popcount(dom[c]) < 2) continue;
      let sw = 0, swl = 0;
      for (let i = 0; i < 12; i++) if (dom[c] & (1 << i)) { const w = weight(TILES[i]); sw += w; swl += w * Math.log(w); }
      const H = Math.log(sw) - swl / sw + rng() * 1e-6;
      if (H < bestH) { bestH = H; best = c; }
    }
    if (best < 0) return false;
    let sw = 0;
    for (let i = 0; i < 12; i++) if (dom[best] & (1 << i)) sw += weight(TILES[i]);
    let r = rng() * sw, pick = 0;
    for (let i = 0; i < 12; i++) if (dom[best] & (1 << i)) { pick = i; r -= weight(TILES[i]); if (r <= 0) break; }
    dom[best] = 1 << pick;
    last = best;
    if (!propagate([best])) { fails++; reset(); }
    return true;
  }
  const done = () => dom.every((d) => popcount(d) === 1);
  function solveAll() { for (let k = 0; k < 20000 && step(); k++); }

  function draw() {
    const { ctx, w, h } = fit(canvas);
    const cs = Math.min(w / GW, h / GH), ox = (w - cs * GW) / 2, oy = (h - cs * GH) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    let n = 0;
    const full = popcount(tileMask());
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const c = y * GW + x, k = popcount(dom[c]), X = ox + x * cs, Y = oy + y * cs;
      if (k === 1) {
        n++;
        const t = TILES[31 - Math.clz32(dom[c])];
        const cx = X + cs / 2, cy = Y + cs / 2;
        ctx.strokeStyle = rgba(pal.brand, 1);
        ctx.lineWidth = cs * 0.26;
        ctx.beginPath();
        for (const [dx, dy, bit] of DIRS) if (t & bit) { ctx.moveTo(cx, cy); ctx.lineTo(cx + (dx * cs) / 2, cy + (dy * cs) / 2); }
        ctx.stroke();
        if (!t) { ctx.fillStyle = rgba(pal.muted, 0.35); ctx.fillRect(cx - 1, cy - 1, 2, 2); }
      } else {
        ctx.fillStyle = rgba(pal.fg, 0.03 + 0.09 * (k / Math.max(1, full)));
        ctx.fillRect(X + 1, Y + 1, cs - 2, cs - 2);
        ctx.fillStyle = rgba(k ? pal.muted : pal.warn, 0.9);
        ctx.font = `${Math.round(cs * 0.36)}px ui-monospace, monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(k), X + cs / 2, Y + cs / 2 + 1);
      }
    }
    if (last >= 0 && !done()) {
      ctx.strokeStyle = rgba(pal.fg, 0.6); ctx.lineWidth = 1;
      ctx.strokeRect(ox + (last % GW) * cs + 0.5, oy + ((last / GW) | 0) * cs + 0.5, cs - 1, cs - 1);
    }
    o.done.textContent = `${n} / ${GW * GH}`;
    o.fails.textContent = String(fails);
    o.seed.textContent = String(seed);
  }

  const kick = loop(root, () => {
    for (let k = 0; k < 2; k++) if (!step()) { playing = false; showPlay(false); break; }
    draw();
  }, () => playing);

  root.querySelector("[data-action=play]").addEventListener("click", () => {
    playing = !playing;
    if (playing && done()) init();
    showPlay(playing);
    kick();
  });
  root.querySelector("[data-action=step]").addEventListener("click", () => {
    if (done()) init(); else step();
    draw();
  });
  root.querySelector("[data-action=restart]").addEventListener("click", () => { seed++; init(); if (!playing) solveAll(); draw(); });
  root.querySelector("[data-action=solve]").addEventListener("click", () => { playing = false; showPlay(false); kick(); solveAll(); draw(); });
  new ResizeObserver(draw).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
  init();
  solveAll();
}

// ============================================================ Game feel

for (const root of document.querySelectorAll("[data-game-feel]")) {
  const stage = root.querySelector("[data-stage]");
  const canvas = root.querySelector("[data-canvas]");
  const hint = root.querySelector("[data-hint]");
  const o = outs(root);
  const on = toggles(root);
  let pal = palette();

  const WW = 640, WH = 360, DT = 1 / 120;
  const G = 2400, JUMP = 760, RUN = 240, FALL = 900, COYOTE = 0.1, BUFFER = 0.1;
  const SOLIDS = [
    [0, 320, 210, 40], [280, 320, 150, 40], [510, 320, 130, 40],
    [90, 250, 80, 12], [330, 236, 70, 12], [205, 175, 70, 12], [450, 175, 90, 12], [560, 250, 60, 12],
  ];
  const START = [40, 290];
  const P = { x: START[0], y: START[1], w: 18, h: 24, vx: 0, vy: 0 };
  const keys = { left: false, right: false, jump: false };
  let t = 0, acc = 0, grounded = true, leftGround = -1, jumped = false, cut = false, pressT = -Infinity;
  let shakeT = 0, shakeA = 0, pops = [];
  const stats = { jumps: 0, coyote: 0, buffered: 0 };

  const hit = (x, y) => SOLIDS.some(([sx, sy, sw, sh]) => x < sx + sw && x + P.w > sx && y < sy + sh && y + P.h > sy);

  function physics() {
    t += DT;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (on.accel) {
      const a = grounded ? (dir ? 2200 : 2800) : 1400;
      const target = dir * RUN;
      P.vx += Math.max(-a * DT, Math.min(a * DT, target - P.vx));
    } else P.vx = dir * RUN;

    // Jump: a press stays valid for the buffer window, or one step without it.
    const pressed = t - pressT <= (on.buffer ? BUFFER : DT * 1.5);
    const coyoteOK = on.coyote && !jumped && t - leftGround <= COYOTE;
    if (pressed && (grounded || coyoteOK)) {
      if (!grounded) { stats.coyote++; pop("coyote!"); }
      if (t - pressT > DT * 1.5) { stats.buffered++; pop("buffered!"); }
      stats.jumps++;
      P.vy = -JUMP; grounded = false; jumped = true; cut = false; pressT = -Infinity;
    }
    // Variable height: letting go early cuts the rise.
    if (on.variable && !keys.jump && P.vy < 0 && !cut) { P.vy *= 0.45; cut = true; }
    P.vy = Math.min(FALL, P.vy + G * DT);

    P.x += P.vx * DT;
    if (hit(P.x, P.y)) { P.x -= P.vx * DT; P.vx = 0; }
    P.x = Math.max(0, Math.min(WW - P.w, P.x));
    const wasGrounded = grounded, impact = P.vy;
    P.y += P.vy * DT;
    grounded = false;
    if (hit(P.x, P.y)) {
      const down = P.vy > 0;
      // Step back out to the contact, half a pixel at a time.
      for (let k = 0; k < 40 && hit(P.x, P.y); k++) P.y += down ? -0.5 : 0.5;
      P.vy = 0;
      if (down) {
        grounded = true; jumped = false;
        if (!wasGrounded && impact > 650 && on.shake && !reduced()) { shakeT = 0.16; shakeA = Math.min(6, impact / 150); }
      }
    }
    if (wasGrounded && !grounded) leftGround = t;
    if (P.y > WH + 60) { P.x = START[0]; P.y = START[1]; P.vx = P.vy = 0; pop("respawn"); }
  }

  function pop(s) { pops.push({ s, x: P.x + P.w / 2, y: P.y - 6, age: 0 }); }

  function draw() {
    const { ctx } = fit(canvas, WW);
    ctx.clearRect(0, 0, WW, WH);
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() * 2 - 1) * shakeA, (Math.random() * 2 - 1) * shakeA);
    for (const [x, y, w, h] of SOLIDS) {
      ctx.fillStyle = rgba(pal.muted, 0.22); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rgba(pal.fg, 0.45); ctx.fillRect(x, y, w, 2);
    }
    ctx.fillStyle = rgba(pal.brand, 0.9);
    ctx.beginPath();
    ctx.roundRect(P.x, P.y, P.w, P.h, 4);
    ctx.fill();
    ctx.fillStyle = rgba(pal.bg, 0.9);
    const eye = P.vx < -1 ? 4 : P.vx > 1 ? 10 : 7;
    ctx.fillRect(P.x + eye, P.y + 7, 3, 4);
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const p of pops) { ctx.fillStyle = rgba(pal.brand, Math.max(0, 1 - p.age / 0.9)); ctx.fillText(p.s, p.x, p.y - p.age * 30); }
    ctx.restore();
  }

  const active = () => document.activeElement === stage || Math.abs(P.vx) > 1 || !grounded || pops.length > 0 || shakeT > 0;
  const kick = loop(root, (dt) => {
    acc += dt;
    while (acc >= DT) { physics(); acc -= DT; }
    shakeT = Math.max(0, shakeT - dt);
    pops.forEach((p) => (p.age += dt));
    pops = pops.filter((p) => p.age < 0.9);
    o.jumps.textContent = String(stats.jumps);
    o.coyote.textContent = String(stats.coyote);
    o.buffered.textContent = String(stats.buffered);
    draw();
  }, active);

  const KEY = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "jump", ArrowUp: "jump", w: "jump", W: "jump" };
  stage.addEventListener("keydown", (e) => {
    const k = KEY[e.key];
    if (!k) return;
    e.preventDefault();
    if (k === "jump" && !keys.jump && !e.repeat) pressT = t;
    keys[k] = true;
    kick();
  });
  stage.addEventListener("keyup", (e) => { const k = KEY[e.key]; if (k) { e.preventDefault(); keys[k] = false; } });
  stage.addEventListener("pointerdown", () => stage.focus());
  stage.addEventListener("focus", () => { hint.toggleAttribute("hidden", true); kick(); });
  stage.addEventListener("blur", () => { keys.left = keys.right = keys.jump = false; hint.toggleAttribute("hidden", false); kick(); });
  for (let k = 0; k < 60; k++) physics(); // settle on the ground
  stats.jumps = stats.coyote = stats.buffered = 0;
  o.jumps.textContent = o.coyote.textContent = o.buffered.textContent = "0";
  new ResizeObserver(draw).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
}

// ============================================================ NPC state machine

const AW = 400, AH = 300;
const WALLS = [[90, 80, 60, 35], [240, 60, 30, 90], [130, 185, 110, 25], [300, 170, 35, 45]];
const ROUTE = [[35, 35], [365, 35], [365, 265], [35, 265]];

// Distance along the ray from (ox, oy) in direction (dx, dy) to a rectangle.
function rayRect(ox, oy, dx, dy, [x, y, w, h]) {
  let t0 = 0, t1 = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, x, x + w], [oy, dy, y, y + h]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return Infinity;
  }
  return t0;
}
const rayCast = (ox, oy, dx, dy) => Math.min(...WALLS.map((r) => rayRect(ox, oy, dx, dy, r)));
const blocked = (x, y, r) => x < r || y < r || x > AW - r || y > AH - r || WALLS.some(([wx, wy, ww, wh]) => x > wx - r && x < wx + ww + r && y > wy - r && y < wy + wh + r);
function moveToward(p, tx, ty, speed, dt, r) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 0.5) return d;
  const st = Math.min(d, speed * dt);
  const mx = (dx / d) * st, my = (dy / d) * st;
  if (!blocked(p.x + mx, p.y, r)) p.x += mx;
  if (!blocked(p.x, p.y + my, r)) p.y += my;
  return d;
}

const STATES = { patrol: [130, 48], chase: [52, 150], search: [130, 252], return: [208, 150] };
const EDGES = [
  ["patrol", "chase", "sees you"], ["chase", "search", "loses sight"], ["search", "chase", "sees you"],
  ["search", "return", "gives up"], ["return", "patrol", "back on route"], ["return", "chase", "sees you"], ["chase", "return", "catches you"],
];

for (const root of document.querySelectorAll("[data-game-npc]")) {
  const canvas = root.querySelector("[data-canvas]");
  const svg = root.querySelector("[data-diagram]");
  const o = outs(root);
  const s = scrubAll(root, () => { see(); draw(); });
  const on = toggles(root);
  let pal = palette();

  const guard = { x: 35, y: 35, a: 0, state: "patrol", wp: 1, last: null, searchT: 0, sweep: 0 };
  const PLAYER0 = [200, 150];
  const player = { x: PLAYER0[0], y: PLAYER0[1] };
  let target = null, idleT = 0, script = 0, lastEdge = null, event = "—", seen = false;
  const SCRIPT = [[200, 150], [200, 20], [120, 20], [120, 150], [60, 150], [60, 240], [200, 240], [280, 150]];

  function see() {
    const range = s.sight.get() * (on.hide ? 0.5 : 1);
    const dx = player.x - guard.x, dy = player.y - guard.y, d = Math.hypot(dx, dy);
    if (d > range) return (seen = false);
    let da = Math.atan2(dy, dx) - guard.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > (s.fov.get() * Math.PI) / 360) return (seen = false);
    return (seen = rayCast(guard.x, guard.y, dx / d, dy / d) >= d);
  }

  function go(to, why) {
    lastEdge = [guard.state, to];
    event = why;
    guard.state = to;
  }

  function turnTo(ang, rate, dt) {
    let d = ang - guard.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    guard.a += Math.max(-rate * dt, Math.min(rate * dt, d));
  }
  function walk(tx, ty, speed, dt) {
    const d = moveToward(guard, tx, ty, speed, dt, 8);
    if (d > 1) turnTo(Math.atan2(ty - guard.y, tx - guard.x), 5, dt);
    return d;
  }

  function update(dt) {
    // The player: the pointer, or a scripted stroll when left alone.
    idleT += dt;
    let tgt = target;
    if (!tgt && !reduced() && idleT > 1.5) {
      tgt = SCRIPT[script];
      if (Math.hypot(player.x - tgt[0], player.y - tgt[1]) < 3) script = (script + 1) % SCRIPT.length;
    }
    if (tgt) moveToward(player, tgt[0], tgt[1], 105, dt, 6);

    const sees = see();
    switch (guard.state) {
      case "patrol": {
        const [wx, wy] = ROUTE[guard.wp];
        if (walk(wx, wy, 55, dt) < 2) guard.wp = (guard.wp + 1) % ROUTE.length;
        if (sees) go("chase", "sees you");
        break;
      }
      case "chase":
        guard.last = [player.x, player.y];
        walk(player.x, player.y, 92, dt);
        if (Math.hypot(player.x - guard.x, player.y - guard.y) < 15) {
          go("return", "catches you");
          player.x = PLAYER0[0]; player.y = PLAYER0[1];
        } else if (!sees) { go("search", "loses sight"); guard.searchT = 0; guard.sweep = guard.a; }
        break;
      case "search":
        if (walk(guard.last[0], guard.last[1], 65, dt) < 3) {
          guard.searchT += dt;
          guard.a = guard.sweep + Math.sin(guard.searchT * 2.4) * 1.3;
        } else guard.sweep = guard.a;
        if (see()) go("chase", "sees you");
        else if (guard.searchT > s.patience.get()) go("return", "gives up");
        break;
      case "return": {
        // Back to the nearest corner of the route.
        let best = 0;
        ROUTE.forEach((p, i) => { if (Math.hypot(p[0] - guard.x, p[1] - guard.y) < Math.hypot(ROUTE[best][0] - guard.x, ROUTE[best][1] - guard.y)) best = i; });
        if (walk(ROUTE[best][0], ROUTE[best][1], 60, dt) < 2) { guard.wp = (best + 1) % ROUTE.length; go("patrol", "back on route"); }
        else if (sees) go("chase", "sees you");
        break;
      }
    }
  }

  function draw() {
    const { ctx } = fit(canvas, AW);
    ctx.clearRect(0, 0, AW, AH);
    // Route.
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = rgba(pal.muted, 0.35); ctx.lineWidth = 1;
    ctx.beginPath(); ROUTE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    // View cone, clipped by walls.
    const range = s.sight.get() * (on.hide ? 0.5 : 1), half = (s.fov.get() * Math.PI) / 360, n = 60;
    ctx.beginPath();
    if (half < Math.PI) ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= n; i++) {
      const a = guard.a - half + (2 * half * i) / n;
      const dx = Math.cos(a), dy = Math.sin(a);
      const r = Math.min(range, rayCast(guard.x, guard.y, dx, dy));
      ctx.lineTo(guard.x + dx * r, guard.y + dy * r);
    }
    ctx.closePath();
    const alert = guard.state === "chase";
    ctx.fillStyle = rgba(alert ? pal.warn : pal.brand, alert ? 0.2 : 0.12); ctx.fill();
    // Walls.
    for (const [x, y, w, h] of WALLS) { ctx.fillStyle = rgba(pal.muted, 0.3); ctx.fillRect(x, y, w, h); }
    // Last known position.
    if (guard.last && guard.state === "search") {
      ctx.strokeStyle = rgba(pal.fg, 0.6); ctx.lineWidth = 1.5;
      const [lx, ly] = guard.last;
      ctx.beginPath(); ctx.moveTo(lx - 5, ly - 5); ctx.lineTo(lx + 5, ly + 5); ctx.moveTo(lx + 5, ly - 5); ctx.lineTo(lx - 5, ly + 5); ctx.stroke();
    }
    // Player.
    ctx.fillStyle = rgba(pal.water, on.hide ? 0.5 : 1);
    ctx.beginPath(); ctx.arc(player.x, player.y, 6, 0, 2 * Math.PI); ctx.fill();
    // Guard.
    ctx.fillStyle = rgba(alert ? pal.warn : pal.fg, 0.9);
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 8, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = rgba(pal.bg, 1); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(guard.x, guard.y); ctx.lineTo(guard.x + Math.cos(guard.a) * 8, guard.y + Math.sin(guard.a) * 8); ctx.stroke();
    if (guard.state === "search" || guard.state === "chase") {
      ctx.fillStyle = rgba(alert ? pal.warn : pal.fg, 1);
      ctx.font = "bold 13px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText(alert ? "!" : "?", guard.x, guard.y - 13);
    }
    drawDiagram();
    o.state.textContent = guard.state[0].toUpperCase() + guard.state.slice(1);
    o.event.textContent = event;
    o.dist.textContent = `${Math.round(Math.hypot(player.x - guard.x, player.y - guard.y))} px`;
  }

  function drawDiagram() {
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    for (const [id, col] of [["game-npc-arrow", "currentColor"], ["game-npc-arrow-on", "var(--brand)"]]) {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0,0 L10,5 L0,10 Z", style: `fill:${col}` }, m);
    }
    for (const [a, b, why] of EDGES) {
      const [x0, y0] = STATES[a], [x1, y1] = STATES[b];
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      // Offset sideways so that two-way pairs don't overlap.
      const off = EDGES.some(([c, e]) => c === b && e === a) ? 7 : 0;
      const px = -uy * off, py = ux * off;
      const sx = x0 + ux * 32 + px, sy = y0 + uy * 32 + py, ex = x1 - ux * 32 + px, ey = y1 - uy * 32 + py;
      const isOn = lastEdge && lastEdge[0] === a && lastEdge[1] === b;
      el("line", {
        x1: sx, y1: sy, x2: ex, y2: ey,
        style: isOn ? "stroke:var(--brand);stroke-width:2.5" : "stroke:currentColor;stroke-opacity:0.35;stroke-width:1.2",
        "marker-end": `url(#${isOn ? "game-npc-arrow-on" : "game-npc-arrow"})`,
      }, svg);
      const lx = (sx + ex) / 2 + px * 1.6, ly = (sy + ey) / 2 + py * 1.6;
      text(svg, lx, ly + 3, why, { "text-anchor": "middle", class: isOn ? "fill-brand font-mono text-[9px]" : "fill-muted-foreground font-mono text-[9px]", style: "paint-order:stroke;stroke:var(--card);stroke-width:3px" });
    }
    for (const [name, [x, y]] of Object.entries(STATES)) {
      const cur = guard.state === name;
      el("circle", { cx: x, cy: y, r: 30, style: cur ? "fill:color-mix(in oklab, var(--brand) 18%, var(--card));stroke:var(--brand);stroke-width:2" : "fill:var(--card);stroke:var(--border);stroke-width:1.5" }, svg);
      const t = el("text", { x, y: y + 4, "text-anchor": "middle", class: cur ? "fill-foreground text-[12px] font-medium" : "fill-muted-foreground text-[12px]" }, svg);
      t.textContent = name[0].toUpperCase() + name.slice(1);
    }
  }

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * AW, ((e.clientY - r.top) / r.height) * AH];
  };
  canvas.addEventListener("pointermove", (e) => { target = toLocal(e); idleT = 0; kick(); });
  canvas.addEventListener("pointerdown", (e) => { target = toLocal(e); idleT = 0; kick(); });
  canvas.addEventListener("pointerleave", () => { target = null; idleT = 0; });
  root.addEventListener("game-toggle", () => { see(); draw(); });

  // Runs whenever on screen, except under reduced motion, where it runs
  // only while the pointer steers the player.
  let lastMove = -Infinity;
  const kick = loop(root, (dt) => { update(dt); draw(); if (target) lastMove = performance.now(); }, () => !reduced() || performance.now() - lastMove < 4000 || !!target);
  new ResizeObserver(draw).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
}

// ============================================================ Steering

for (const root of document.querySelectorAll("[data-game-steer]")) {
  const canvas = root.querySelector("[data-canvas]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  let pal = palette(), mode = "seek", W = 640, H = 480, pointer = null, clock = 0;
  const rng = mulberry32(7);
  let agents = [];

  function spawn() {
    const n = mode === "flock" ? 90 : 40;
    agents = Array.from({ length: n }, () => {
      const a = rng() * 2 * Math.PI;
      return { x: rng() * W, y: rng() * H, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, wa: rng() * 2 * Math.PI };
    });
  }

  const limit = (x, y, m) => { const l = Math.hypot(x, y); return l > m ? [(x / l) * m, (y / l) * m] : [x, y]; };

  function target() {
    if (pointer) return pointer;
    // With no pointer, the target circles the middle.
    return [W / 2 + Math.cos(clock * 0.6) * W * 0.3, H / 2 + Math.sin(clock * 0.9) * H * 0.28];
  }

  function update(dt) {
    clock += dt;
    const maxV = s.speed.get(), maxF = s.force.get();
    const [tx, ty] = target();
    const grid = new Map();
    if (mode === "flock") for (const a of agents) { const k = `${Math.floor(a.x / 50)},${Math.floor(a.y / 50)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(a); }
    for (const a of agents) {
      let fx = 0, fy = 0;
      // Steering = desired velocity − current velocity, capped at max force.
      const steer = (dx, dy, w = 1) => { const [sx, sy] = limit(dx - a.vx, dy - a.vy, maxF); fx += sx * w; fy += sy * w; };
      const toward = (x, y, sp = maxV) => { const d = Math.hypot(x, y) || 1; return [(x / d) * sp, (y / d) * sp]; };
      const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      if (mode === "seek") steer(...toward(dx, dy));
      else if (mode === "flee") { if (d < 180) steer(...toward(-dx, -dy)); }
      else if (mode === "arrive") steer(...toward(dx, dy, maxV * Math.min(1, d / 120)));
      else if (mode === "wander") {
        a.wa += (rng() * 2 - 1) * 4 * dt;
        const [hx, hy] = toward(a.vx, a.vy, 1);
        steer(...toward(hx * 50 + Math.cos(a.wa) * 25, hy * 50 + Math.sin(a.wa) * 25));
      } else {
        let n = 0, sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0;
        const gx = Math.floor(a.x / 50), gy = Math.floor(a.y / 50);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of grid.get(`${gx + i},${gy + j}`) ?? []) {
          if (b === a) continue;
          const ex = a.x - b.x, ey = a.y - b.y, e = Math.hypot(ex, ey);
          if (e > 50) continue;
          n++; ax += b.vx; ay += b.vy; cx += b.x; cy += b.y;
          if (e < 22 && e > 0) { sx += ex / (e * e); sy += ey / (e * e); }
        }
        if (n) {
          if (sx || sy) steer(...toward(sx, sy), s.sep.get());
          steer(...toward(ax, ay), s.ali.get());
          steer(...toward(cx / n - a.x, cy / n - a.y), s.coh.get());
        }
      }
      // Soft walls (wrap for the flock and the wanderers).
      if (mode !== "flock" && mode !== "wander") {
        const m = 30;
        if (a.x < m) steer(maxV, a.vy, 2); else if (a.x > W - m) steer(-maxV, a.vy, 2);
        if (a.y < m) steer(a.vx, maxV, 2); else if (a.y > H - m) steer(a.vx, -maxV, 2);
      }
      [fx, fy] = limit(fx, fy, maxF);
      a.vx += fx * dt; a.vy += fy * dt;
      [a.vx, a.vy] = limit(a.vx, a.vy, maxV);
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (mode === "flock" || mode === "wander") { a.x = (a.x + W) % W; a.y = (a.y + H) % H; }
      else { a.x = Math.max(0, Math.min(W, a.x)); a.y = Math.max(0, Math.min(H, a.y)); }
    }
  }

  function draw() {
    const f = fit(canvas);
    const { ctx } = f;
    if (Math.abs(f.w - W) > 1 || Math.abs(f.h - H) > 1) {
      const kx = f.w / W, ky = f.h / H;
      for (const a of agents) { a.x *= kx; a.y *= ky; }
      W = f.w; H = f.h;
    }
    ctx.clearRect(0, 0, W, H);
    if (mode !== "flock" && mode !== "wander") {
      const [tx, ty] = target();
      ctx.strokeStyle = rgba(pal.fg, 0.55); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty); ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8); ctx.stroke();
      const r = mode === "arrive" ? 120 : mode === "flee" ? 180 : 0;
      if (r) { ctx.setLineDash([3, 5]); ctx.strokeStyle = rgba(pal.muted, 0.4); ctx.beginPath(); ctx.arc(tx, ty, r, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.fillStyle = rgba(pal.brand, 0.9);
    let sv = 0, svx = 0, svy = 0;
    for (const a of agents) {
      const sp = Math.hypot(a.vx, a.vy);
      sv += sp; svx += a.vx; svy += a.vy;
      const ang = Math.atan2(a.vy, a.vx);
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4); ctx.lineTo(-3, 0); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    o.n.textContent = String(agents.length);
    o.speed.textContent = `${Math.round(sv / agents.length)} px/s`;
    o.order.textContent = num(Math.hypot(svx, svy) / (sv || 1), 2);
  }

  canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); pointer = [e.clientX - r.left, e.clientY - r.top]; kick(); });
  canvas.addEventListener("pointerleave", () => { pointer = null; kick(); });
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; spawn(); draw(); kick(); });

  // Autoplays when on screen, except under reduced motion, where it moves
  // only while the pointer is over it.
  const kick = loop(root, (dt) => { update(dt); draw(); }, () => !reduced() || !!pointer);
  const r0 = canvas.getBoundingClientRect();
  if (r0.width) { W = r0.width; H = r0.height; }
  spawn();
  new ResizeObserver(draw).observe(canvas);
  onTheme(() => { pal = palette(); draw(); });
}
