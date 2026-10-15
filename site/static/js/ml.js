// Machine learning blocks: a neural network trained with Adam, gradient
// descent with momentum, softmax sampling, classification metrics, and the
// annotated training loop. ml-fit.js holds regression, overfitting,
// activations and k-means.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, hline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// rgbOf resolves any CSS color (oklch, var(), hex) to [r, g, b] by painting
// one pixel: canvases need numbers for ImageData.
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
const onTheme = (fn) => new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

// A play/pause button whose icon and label follow the state.
function playButton(btn, labels = ["Train", "Pause"]) {
  return (playing) => {
    // SVG elements have no .hidden property: toggle the attribute.
    btn.querySelector('[data-icon="play"]').toggleAttribute("hidden", playing);
    btn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !playing);
    btn.querySelector("[data-label]").textContent = playing ? labels[1] : labels[0];
  };
}

// Sizes a canvas to its box at the device pixel ratio (capped at 2).
function fit(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return canvas.getContext("2d");
}

// ============================================================ MLP playground

function dataset(kind, noise, seed) {
  const rng = mulberry32(seed);
  const pts = [];
  const add = (x, y, c) => pts.push([x + noise * gauss(rng), y + noise * gauss(rng), c]);
  for (let i = 0; i < 200; i++) {
    const c = i % 2;
    if (kind === "circles") {
      const r = c ? 0.45 * Math.sqrt(rng()) : 0.65 + 0.3 * rng();
      const a = 2 * Math.PI * rng();
      add(r * Math.cos(a), r * Math.sin(a), c);
    } else if (kind === "xor") {
      const x = rng() * 2 - 1, y = rng() * 2 - 1;
      add(x, y, x * y > 0 ? 1 : 0);
    } else if (kind === "moons") {
      const t = Math.PI * rng();
      const [x, y] = c ? [1 - Math.cos(t), 1 - Math.sin(t) - 0.5] : [Math.cos(t), Math.sin(t)];
      add((x - 0.5) / 1.25, (y - 0.25) / 1.25, c);
    } else {
      const t = rng();
      const a = t * 3.5 * Math.PI + c * Math.PI;
      add(0.9 * t * Math.cos(a), 0.9 * t * Math.sin(a), c);
    }
  }
  return pts;
}

// A 2 → H → H → 1 network: tanh hidden layers, sigmoid output, binary
// cross-entropy, trained full-batch with Adam.
function network(H, seed) {
  const rng = mulberry32(seed);
  const sizes = [2, H, H, 1];
  const L = sizes.slice(1).map((n, i) => {
    const m = sizes[i];
    const s = Math.sqrt(1 / m); // Xavier-style scale for tanh
    const W = Array.from({ length: n * m }, () => gauss(rng) * s);
    return { n, m, W, b: new Array(n).fill(0), mW: new Array(n * m).fill(0), vW: new Array(n * m).fill(0), mb: new Array(n).fill(0), vb: new Array(n).fill(0) };
  });
  const forward = (x) => {
    const acts = [x];
    L.forEach((l, k) => {
      const a = acts[k], z = new Array(l.n);
      for (let i = 0; i < l.n; i++) {
        let s = l.b[i];
        for (let j = 0; j < l.m; j++) s += l.W[i * l.m + j] * a[j];
        z[i] = k === L.length - 1 ? 1 / (1 + Math.exp(-s)) : Math.tanh(s);
      }
      acts.push(z);
    });
    return acts;
  };
  let t = 0;
  const step = (data, lr) => {
    const gW = L.map((l) => new Array(l.W.length).fill(0));
    const gb = L.map((l) => new Array(l.n).fill(0));
    let loss = 0, correct = 0;
    for (const [x, y, c] of data) {
      const acts = forward([x, y]);
      const p = acts[acts.length - 1][0];
      loss += -(c * Math.log(p + 1e-12) + (1 - c) * Math.log(1 - p + 1e-12));
      if ((p > 0.5) === (c === 1)) correct++;
      let delta = [p - c]; // dL/dz for sigmoid + cross-entropy
      for (let k = L.length - 1; k >= 0; k--) {
        const l = L[k], a = acts[k];
        for (let i = 0; i < l.n; i++) {
          gb[k][i] += delta[i];
          for (let j = 0; j < l.m; j++) gW[k][i * l.m + j] += delta[i] * a[j];
        }
        if (k > 0) {
          const prev = new Array(l.m).fill(0);
          for (let j = 0; j < l.m; j++) {
            let s = 0;
            for (let i = 0; i < l.n; i++) s += l.W[i * l.m + j] * delta[i];
            prev[j] = s * (1 - a[j] * a[j]); // tanh'
          }
          delta = prev;
        }
      }
    }
    t++;
    const N = data.length, b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
    L.forEach((l, k) => {
      const upd = (P, G, M, V) => {
        for (let i = 0; i < P.length; i++) {
          const g = G[i] / N;
          M[i] = b1 * M[i] + (1 - b1) * g;
          V[i] = b2 * V[i] + (1 - b2) * g * g;
          P[i] -= (lr * (M[i] / c1)) / (Math.sqrt(V[i] / c2) + eps);
        }
      };
      upd(l.W, gW[k], l.mW, l.vW);
      upd(l.b, gb[k], l.mb, l.vb);
    });
    return { loss: loss / N, acc: correct / N };
  };
  return { forward, step, get t() { return t; } };
}

for (const root of document.querySelectorAll("[data-mlp]")) {
  const canvas = root.querySelector("[data-canvas]");
  const lossSvg = root.querySelector("[data-loss]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"));
  let kind = "circles", data, net, history = [], last = { loss: NaN, acc: NaN }, playing = false, raf = 0, visible = false;
  let colors;
  const s = scrubAll(root, (name) => (name === "lr" ? 0 : rebuild(name === "noise")));
  const readColors = () => (colors = { a: rgbOf("var(--vec-u)"), b: rgbOf("var(--brand)"), bg: rgbOf("var(--code-bg)") });

  function rebuild(newData = true) {
    if (newData) data = dataset(kind, s.noise.get(), 11);
    net = network(Math.round(s.hidden.get()), 5);
    history = [];
    last = net.step(data, 0); // loss and accuracy before training
    draw();
  }

  function draw() {
    const ctx = fit(canvas);
    const W = canvas.width, Hh = canvas.height;
    const G = 64;
    const img = ctx.createImageData(G, G);
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const x = (gx + 0.5) / G * 2.4 - 1.2, y = 1.2 - (gy + 0.5) / G * 2.4;
        const p = net.forward([x, y]).at(-1)[0];
        const c = p > 0.5 ? colors.b : colors.a;
        const a = Math.min(1, Math.abs(p - 0.5) * 2) * 0.42;
        const i = (gy * G + gx) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[i + ch] = colors.bg[ch] * (1 - a) + c[ch] * a;
        img.data[i + 3] = 255;
      }
    }
    // Upscale the 64×64 field smoothly.
    const off = new OffscreenCanvas(G, G);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, W, Hh);
    const px = (x) => ((x + 1.2) / 2.4) * W, py = (y) => ((1.2 - y) / 2.4) * Hh;
    const r = Math.max(2.5, W / 140);
    for (const [x, y, c] of data) {
      ctx.beginPath();
      ctx.arc(px(x), py(y), r, 0, 2 * Math.PI);
      ctx.fillStyle = `rgb(${(c ? colors.b : colors.a).join(",")})`;
      ctx.fill();
      ctx.lineWidth = Math.max(1, r / 3);
      ctx.strokeStyle = `rgb(${colors.bg.join(",")})`;
      ctx.stroke();
    }
    lossSvg.replaceChildren();
    const f = frame(lossSvg, { box: [36, 6, 418, 48], x: [0, Math.max(50, history.length)], y: [0, Math.max(0.8, ...history)], yticks: [0], xticks: [], ylabel: "" });
    text(lossSvg, 4, 14, "loss");
    if (history.length > 1) polyline(lossSvg, history.map((l, i) => [f.sx(i), f.sy(l)]), "stroke:var(--brand);stroke-width:1.5");
    o.epoch.textContent = String(net.t - 1);
    o.loss.textContent = num(last.loss, 3);
    o.acc.textContent = `${num(last.acc * 100, 1)}%`;
  }

  const loop = () => {
    for (let k = 0; k < 4; k++) { last = net.step(data, s.lr.get()); history.push(last.loss); }
    if (history.length > 600) history = history.filter((_, i) => i % 2 === 0);
    draw();
    raf = playing && visible ? requestAnimationFrame(loop) : 0;
  };
  const setPlaying = (p) => {
    playing = p;
    setPlay(p);
    if (p && visible && !raf) raf = requestAnimationFrame(loop);
  };
  root.querySelector("[data-action=play]").addEventListener("click", () => setPlaying(!playing));
  root.querySelector("[data-action=reset]").addEventListener("click", () => { setPlaying(false); rebuild(false); });
  root.addEventListener("seg-change", (e) => { kind = e.detail.value; rebuild(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && playing && !raf) raf = requestAnimationFrame(loop); }).observe(root);
  new ResizeObserver(() => net && draw()).observe(canvas);
  onTheme(() => { readColors(); draw(); });
  readColors();
  rebuild();
}

// ============================================================ Gradient descent

const SURFACES = {
  ravine: {
    f: (x, y) => 0.5 * (x * x + 20 * y * y),
    g: (x, y) => [x, 20 * y],
    box: [-4, 4, -3, 3], start: [-3.5, 2], min: [0, 0], lr: 0.09, beta: 0, steps: 120,
  },
  rosenbrock: {
    f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
    box: [-2, 2, -1, 3], start: [-1.5, 2], min: [1, 1], lr: 0.001, beta: 0.9, steps: 3000,
  },
};

for (const root of document.querySelectorAll("[data-gd]")) {
  const canvas = root.querySelector("[data-canvas]");
  const svg = root.querySelector("[data-path]");
  const lossSvg = root.querySelector("[data-loss]");
  const o = outs(root);
  const setPlay = playButton(root.querySelector("[data-action=play]"), ["Run", "Pause"]);
  let S = SURFACES.ravine, start = S.start.slice(), path, vel, playing = false, raf = 0;
  const s = scrubAll(root, () => reset());

  const [VW, VH] = [400, 300];
  const sx = (x) => ((x - S.box[0]) / (S.box[1] - S.box[0])) * VW;
  const sy = (y) => VH - ((y - S.box[2]) / (S.box[3] - S.box[2])) * VH;

  function reset() {
    path = [start.slice()];
    vel = [0, 0];
    setPlaying(false);
    drawPath();
  }

  function stepOnce() {
    const p = path.at(-1);
    if (!Number.isFinite(p[0]) || Math.abs(p[0]) > 1e6) return false;
    const g = S.g(...p), lr = s.lr.get(), b = s.beta.get();
    vel = [b * vel[0] - lr * g[0], b * vel[1] - lr * g[1]];
    path.push([p[0] + vel[0], p[1] + vel[1]]);
    return true;
  }

  function status() {
    const p = path.at(-1), f = S.f(...p), g = Math.hypot(...S.g(...p));
    if (!Number.isFinite(f) || f > 1e8) return { f, g, text: "diverged", done: true };
    if (g < 1e-4) return { f, g, text: "converged", done: true };
    return { f, g, text: playing ? "running" : path.length > 1 ? "paused" : "ready", done: false };
  }

  function drawSurface() {
    const ctx = fit(canvas);
    const W = canvas.width, H = canvas.height;
    // Sample at canvas resolution (capped) so iso-lines stay crisp.
    const G = [Math.min(W, 640), Math.min(H, 480)];
    const img = ctx.createImageData(G[0], G[1]);
    const ink = rgbOf("var(--foreground)"), tint = rgbOf("var(--vec-u)"), bg = rgbOf("var(--code-bg)");
    const vals = new Float32Array(G[0] * G[1]);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < G[1]; j++) for (let i = 0; i < G[0]; i++) {
      const x = S.box[0] + ((i + 0.5) / G[0]) * (S.box[1] - S.box[0]);
      const y = S.box[3] - ((j + 0.5) / G[1]) * (S.box[3] - S.box[2]);
      const v = Math.log10(S.f(x, y) + 1e-3);
      vals[j * G[0] + i] = v;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    // Shade by log loss, and draw an iso-line wherever the band changes.
    const bands = 14;
    const band = (v) => Math.floor(((v - lo) / (hi - lo)) * bands);
    for (let j = 0; j < G[1]; j++) for (let i = 0; i < G[0]; i++) {
      const k = j * G[0] + i, v = vals[k], t = (v - lo) / (hi - lo);
      const edge = (i + 1 < G[0] && band(vals[k + 1]) !== band(v)) || (j + 1 < G[1] && band(vals[k + G[0]]) !== band(v));
      const a = 0.04 + 0.32 * (1 - t);
      for (let ch = 0; ch < 3; ch++) {
        let c = bg[ch] * (1 - a) + tint[ch] * a;
        if (edge) c = c * 0.7 + ink[ch] * 0.3;
        img.data[k * 4 + ch] = c;
      }
      img.data[k * 4 + 3] = 255;
    }
    const off = new OffscreenCanvas(G[0], G[1]);
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, W, H);
  }

  function drawPath() {
    svg.replaceChildren();
    const clip = (v, a, b) => Math.max(a - 50, Math.min(b + 50, v));
    const pts = path.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [clip(sx(p[0]), 0, VW), clip(sy(p[1]), 0, VH)]);
    el("path", { d: `M${sx(S.min[0]) - 5} ${sy(S.min[1])}h10M${sx(S.min[0])} ${sy(S.min[1]) - 5}v10`, style: "stroke:var(--foreground);stroke-width:1.5", "vector-effect": "non-scaling-stroke" }, svg);
    polyline(svg, pts, "stroke:var(--brand);stroke-width:1.75;stroke-linejoin:round");
    if (pts.length < 200) for (const [x, y] of pts.slice(1)) el("circle", { cx: x, cy: y, r: 1.8, style: "fill:var(--brand)" }, svg);
    el("circle", { cx: pts[0][0], cy: pts[0][1], r: 4.5, style: "fill:var(--background);stroke:var(--brand);stroke-width:2", "vector-effect": "non-scaling-stroke" }, svg);
    const end = pts.at(-1);
    el("circle", { cx: end[0], cy: end[1], r: 3.5, style: "fill:var(--brand)" }, svg);

    lossSvg.replaceChildren();
    const ls = path.map((p) => Math.log10(Math.max(1e-12, S.f(...p)))).filter(Number.isFinite);
    const top = Math.max(1, ...ls.map((v) => Math.min(v, 12))), bottom = Math.min(-4, ...ls);
    const f = frame(lossSvg, { box: [36, 6, 518, 48], x: [0, Math.max(S.steps, path.length - 1)], y: [bottom, top], xticks: [], yticks: [] });
    text(lossSvg, 4, 14, "log f");
    polyline(lossSvg, ls.map((v, i) => [f.sx(i), f.sy(Math.min(v, top))]), "stroke:var(--brand);stroke-width:1.5");

    const st = status();
    o.step.textContent = String(path.length - 1);
    o.f.textContent = Number.isFinite(st.f) ? (st.f > 1e5 || st.f < 1e-3 ? st.f.toExponential(2) : num(st.f, 4)) : "∞";
    o.grad.textContent = Number.isFinite(st.g) ? (st.g > 1e5 || st.g < 1e-3 ? st.g.toExponential(2) : num(st.g, 4)) : "∞";
    o.status.textContent = st.text;
    o.status.className = st.text === "diverged" ? "text-del" : st.text === "converged" ? "text-add" : "";
    return st;
  }

  const loop = () => {
    const perFrame = S === SURFACES.rosenbrock ? 30 : 1;
    let ok = true;
    for (let k = 0; k < perFrame && ok; k++) ok = stepOnce();
    const st = drawPath();
    if (st.done || !ok || path.length > S.steps * 4) return setPlaying(false);
    raf = playing ? (S === SURFACES.ravine ? setTimeout(() => (raf = requestAnimationFrame(loop)), 60) : requestAnimationFrame(loop)) : 0;
  };
  function setPlaying(p) {
    playing = p;
    setPlay(p);
    if (!p) { cancelAnimationFrame(raf); clearTimeout(raf); raf = 0; }
    if (p && !raf) {
      if (reduced()) { // no animation: compute the whole run at once
        for (let k = 0; k < S.steps && stepOnce() && !status().done; k++);
        playing = false; setPlay(false); drawPath(); return;
      }
      raf = requestAnimationFrame(loop);
    }
    drawPath();
  }

  root.querySelector("[data-action=play]").addEventListener("click", () => {
    if (status().done) reset();
    setPlaying(!playing);
  });
  root.querySelector("[data-action=step]").addEventListener("click", () => { setPlaying(false); stepOnce(); drawPath(); });
  root.addEventListener("seg-change", (e) => {
    S = SURFACES[e.detail.value];
    start = S.start.slice();
    s.lr.set(S.lr, false);
    s.beta.set(S.beta, false);
    drawSurface();
    reset();
  });
  svg.addEventListener("click", (e) => {
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    start = [S.box[0] + fx * (S.box[1] - S.box[0]), S.box[3] - fy * (S.box[3] - S.box[2])];
    reset();
  });
  new ResizeObserver(drawSurface).observe(canvas);
  onTheme(drawSurface);
  drawSurface();
  reset();
}

// ============================================================ Softmax

for (const root of document.querySelectorAll("[data-softmax]")) {
  const o = outs(root);
  const bars = [...root.querySelectorAll("[data-bar]")];
  const probs = [...root.querySelectorAll("[data-prob]")];
  const words = [...root.querySelectorAll("[data-scrub^=logit]")].map((i) => i.getAttribute("aria-label").replace("Logit of ", ""));
  const s = scrubAll(root, draw);
  let p = [];

  function draw() {
    const T = s.temp.get();
    const z = words.map((_, i) => s[`logit-${i}`].get() / T);
    const m = Math.max(...z); // subtract the max: exp never overflows
    const e = z.map((v) => Math.exp(v - m));
    const sum = e.reduce((a, b) => a + b, 0);
    p = e.map((v) => v / sum);
    p.forEach((v, i) => {
      bars[i].style.width = `${(v * 100).toFixed(2)}%`;
      probs[i].textContent = `${num(v * 100, 1)}%`;
    });
    const H = -p.reduce((a, v) => a + (v > 0 ? v * Math.log2(v) : 0), 0);
    o.entropy.textContent = `${num(H, 2)} bits`;
  }

  const sample = () => {
    let r = Math.random();
    for (let i = 0; i < p.length; i++) if ((r -= p[i]) <= 0) return i;
    return p.length - 1;
  };
  const show = (i) => {
    o.pick.textContent = words[i];
    if (!reduced()) o.pick.animate([{ transform: "translateY(4px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  };
  root.querySelector("[data-action=sample]").addEventListener("click", () => {
    show(sample());
    o.tally.textContent = "";
  });
  root.querySelector("[data-action=sample100]").addEventListener("click", () => {
    const n = new Array(words.length).fill(0);
    for (let k = 0; k < 100; k++) n[sample()]++;
    show(n.indexOf(Math.max(...n)));
    o.tally.textContent = "100 samples: " + words.map((w, i) => `${w} ${n[i]}`).join(" · ");
  });
  draw();
}

// ============================================================ Threshold and ROC

for (const root of document.querySelectorAll("[data-roc]")) {
  const hist = root.querySelector("[data-hist]");
  const curve = root.querySelector("[data-curve]");
  const o = outs(root);
  const rng = mulberry32(42);
  const N = 300, SD = 0.12;
  const zNeg = Array.from({ length: N }, () => gauss(rng));
  const zPos = Array.from({ length: N }, () => gauss(rng));
  const clamp = (v) => Math.min(0.999, Math.max(0, v));
  const s = scrubAll(root, draw);

  function draw() {
    const sep = s.sep.get(), th = s.threshold.get();
    const neg = zNeg.map((z) => clamp(0.5 - sep / 2 + SD * z));
    const pos = zPos.map((z) => clamp(0.5 + sep / 2 + SD * z));
    const tp = pos.filter((v) => v >= th).length, fn = N - tp;
    const fp = neg.filter((v) => v >= th).length, tn = N - fp;

    // Histograms.
    hist.replaceChildren();
    const B = 40;
    const count = (arr) => { const c = new Array(B).fill(0); for (const v of arr) c[Math.min(B - 1, Math.floor(v * B))]++; return c; };
    const cn = count(neg), cp = count(pos);
    const top = Math.ceil(Math.max(...cn, ...cp) / 10) * 10;
    const f = frame(hist, { box: [30, 12, 356, 210], x: [0, 1], y: [0, top], xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [0, top], xlabel: "score", ylabel: "count" });
    for (const [c, color] of [[cn, "var(--vec-u)"], [cp, "var(--brand)"]])
      c.forEach((v, i) => el("rect", { x: f.sx(i / B) + 0.5, y: f.sy(v), width: f.sx(1 / B) - f.sx(0) - 1, height: f.T + f.H - f.sy(v), style: `fill:${color};fill-opacity:0.5` }, hist));
    el("line", { x1: f.sx(th), x2: f.sx(th), y1: f.T - 4, y2: f.T + f.H, style: "stroke:var(--foreground);stroke-width:1.5" }, hist);
    text(hist, f.sx(th) + 4, f.T + 6, `t = ${num(th, 2)}`, { class: "fill-foreground font-mono text-[10px]" });
    text(hist, f.L + 4, f.T + 22, "■ negatives", { style: "fill:var(--vec-u)" });
    text(hist, f.L + 4, f.T + 34, "■ positives", { style: "fill:var(--brand)" });

    // ROC: sweep the threshold over every score.
    curve.replaceChildren();
    const g = frame(curve, { box: [34, 12, 210, 210], x: [0, 1], y: [0, 1], xticks: [0, 0.5, 1], yticks: [0, 0.5, 1], xlabel: "FPR", ylabel: "TPR" });
    el("line", { x1: g.sx(0), y1: g.sy(0), x2: g.sx(1), y2: g.sy(1), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 4" }, curve);
    const all = [...neg.map((v) => [v, 0]), ...pos.map((v) => [v, 1])].sort((a, b) => b[0] - a[0]);
    const roc = [[0, 0]];
    let TP = 0, FP = 0, auc = 0;
    for (let i = 0; i < all.length; i++) {
      all[i][1] ? TP++ : FP++;
      if (i + 1 === all.length || all[i + 1][0] !== all[i][0]) {
        const [px, py] = roc.at(-1), x = FP / N, y = TP / N;
        auc += (x - px) * (y + py) / 2; // trapezoid
        roc.push([x, y]);
      }
    }
    polyline(curve, roc.map(([x, y]) => [g.sx(x), g.sy(y)]), "stroke:var(--foreground);stroke-width:1.75");
    el("circle", { cx: g.sx(fp / N), cy: g.sy(tp / N), r: 4.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, curve);

    const precision = tp + fp ? tp / (tp + fp) : NaN, recall = tp / N;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : NaN;
    o.tp.textContent = tp; o.fn.textContent = fn; o.fp.textContent = fp; o.tn.textContent = tn;
    o.precision.textContent = Number.isFinite(precision) ? num(precision, 3) : "—";
    o.recall.textContent = num(recall, 3);
    o.f1.textContent = Number.isFinite(f1) ? num(f1, 3) : "—";
    o.acc.textContent = num((tp + tn) / (2 * N), 3);
    o.auc.textContent = num(auc, 3);
  }
  draw();
}

// ============================================================ Annotated code

for (const root of document.querySelectorAll("[data-annotated]")) {
  const lines = [...root.querySelectorAll(".line[data-note]")];
  const items = [...root.querySelectorAll("[data-note-item]")];
  const light = (n) => {
    for (const l of lines) l.dataset.note === n ? (l.dataset.lit = "") : delete l.dataset.lit;
    for (const i of items) i.dataset.noteItem === n ? (i.dataset.lit = "") : delete i.dataset.lit;
  };
  for (const l of lines) l.addEventListener("pointerenter", () => light(l.dataset.note));
  for (const i of items) {
    i.addEventListener("pointerenter", () => light(i.dataset.noteItem));
    i.addEventListener("focus", () => light(i.dataset.noteItem));
  }
  root.addEventListener("pointerleave", () => light(null));
}
