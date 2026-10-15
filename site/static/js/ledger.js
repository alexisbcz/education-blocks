// Blockchain blocks, part one: the hash chain, the Merkle tree, proof of
// work in the page, difficulty retargeting and Nakamoto's double-spend
// odds. Curves and signatures are in ledger-ecc.js; UTXOs, forks and the
// escrow contract in ledger-sim.js.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import {
  outs, onSeg, onToggle, mk, smallButton, hashSpan, mulberry32,
  sha256, sha256Words, leadingZeroBits, attackerSuccess, confirmationsFor,
} from "./ledger-util.js";

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

// ============================================================ Hash chain

for (const root of document.querySelectorAll("[data-ledger-chain]")) {
  const DATA = ["Genesis", "Alice pays Bob 5", "Bob pays Carol 2", "Carol pays Dan 1", "Dan pays Eve 3"];
  const ZEROS = "000"; // 12 bits
  const wrap = root.querySelector("[data-blocks]");
  const o = outs(root);
  let blocks, work;

  const header = (i, prev, data, nonce) => `${i}|${prev}|${data}|${nonce}`;
  const mine = (i, prev, data) => {
    let n = 0;
    while (!sha256(header(i, prev, data, n)).startsWith(ZEROS)) n++;
    return n;
  };

  function build() {
    blocks = [];
    work = 0;
    let prev = "0".repeat(64);
    DATA.forEach((data, i) => {
      const nonce = mine(i, prev, data);
      const hash = sha256(header(i, prev, data, nonce));
      blocks.push({ data, nonce });
      prev = hash;
    });
    wrap.replaceChildren(...blocks.map((_, i) => card(i)));
    update();
  }

  function card(i) {
    const c = mk("article", "flex min-w-0 flex-col gap-2 rounded-lg border bg-background p-3 text-xs transition-[border-color,box-shadow] duration-200 data-[valid=false]:border-[var(--code-del)] data-[valid=true]:border-brand/50 motion-reduce:transition-none");
    c.setAttribute("aria-label", `Block ${i}`);
    const top = mk("div", "flex items-center justify-between gap-2");
    top.append(mk("span", "font-mono text-[11px] tracking-wider text-muted-foreground uppercase", `Block ${i}`));
    const st = mk("span", "rounded-full border px-2 py-0.5 font-mono text-[10px]");
    st.dataset.status = "";
    top.append(st);
    const ta = mk("input", "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50");
    ta.type = "text";
    ta.value = blocks[i].data;
    ta.setAttribute("aria-label", `Block ${i} data`);
    ta.spellcheck = false;
    ta.addEventListener("input", () => { blocks[i].data = ta.value; update(); });
    const row = (k) => {
      const r = mk("div", "flex min-w-0 items-baseline justify-between gap-2 font-mono text-[11px]");
      r.append(mk("span", "shrink-0 text-muted-foreground", k));
      const v = mk("span", "min-w-0 truncate text-right tabular-nums");
      v.dataset.v = k;
      r.append(v);
      return r;
    };
    const btn = smallButton("Mine", () => {
      const prev = i === 0 ? "0".repeat(64) : hashOf(i - 1);
      const n = mine(i, prev, blocks[i].data);
      work += n + 1;
      blocks[i].nonce = n;
      update();
    });
    btn.dataset.mine = "";
    c.append(top, ta, row("prev"), row("nonce"), row("hash"), btn);
    return c;
  }

  // Hashes follow from the data: prev is always the previous block's
  // current hash, so an edit ripples down the chain.
  const hashes = () => {
    const out = [];
    let prev = "0".repeat(64);
    blocks.forEach((b, i) => {
      const hsh = sha256(header(i, prev, b.data, b.nonce));
      out.push({ prev, hash: hsh });
      prev = hsh;
    });
    return out;
  };
  const hashOf = (i) => hashes()[i].hash;

  function update() {
    const hs = hashes();
    let valid = 0, broken = false;
    [...wrap.children].forEach((c, i) => {
      const worked = hs[i].hash.startsWith(ZEROS);
      if (!worked) broken = true;
      const good = worked && !broken;
      c.dataset.valid = String(good);
      if (good) valid++;
      const st = c.querySelector("[data-status]");
      st.textContent = good ? "valid" : "work missing";
      st.className = "rounded-full border px-2 py-0.5 font-mono text-[10px] " + (good ? "border-brand/40 text-brand" : "border-[var(--code-del)]/40 text-[var(--code-del)]");
      const set = (k, node) => c.querySelector(`[data-v="${k}"]`).replaceChildren(node);
      set("prev", hashSpan(hs[i].prev, 8));
      set("nonce", document.createTextNode(fmtInt(blocks[i].nonce)));
      set("hash", hashSpan(hs[i].hash, 8, worked ? "" : "text-[var(--code-del)]"));
      c.querySelector("[data-mine]").disabled = worked;
    });
    o.valid.textContent = `${valid} of ${blocks.length}`;
    o.work.textContent = fmtInt(work);
  }

  root.querySelector("[data-action=mine-all]").addEventListener("click", () => {
    let prev = "0".repeat(64);
    blocks.forEach((b, i) => {
      if (!sha256(header(i, prev, b.data, b.nonce)).startsWith(ZEROS)) {
        const n = mine(i, prev, b.data);
        work += n + 1;
        b.nonce = n;
      }
      prev = sha256(header(i, prev, b.data, b.nonce));
    });
    update();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", build);
  build();
}

// ============================================================ Merkle tree

for (const root of document.querySelectorAll("[data-ledger-merkle]")) {
  const svg = root.querySelector("[data-tree]");
  const leafBox = root.querySelector("[data-leaves]");
  const proofList = root.querySelector("[data-proof]");
  const o = outs(root);
  const PAYEES = ["Bob", "Carol", "Dan", "Eve", "Frank", "Grace", "Heidi", "Ivan"];
  let n = 8, sel = 2, tamper = false;

  const txOf = (i) => `tx${i}: ${PAYEES[i % 8]} receives ${(i * 7) % 23 + 1}`;
  const pair = (a, b) => sha256(a + b);

  /** levels[0] are the leaf hashes; an odd level duplicates its last node. */
  function tree(leaves) {
    const levels = [leaves];
    while (levels.at(-1).length > 1) {
      const cur = levels.at(-1), next = [];
      for (let i = 0; i < cur.length; i += 2) next.push(pair(cur[i], cur[i + 1] ?? cur[i]));
      levels.push(next);
    }
    return levels;
  }

  function proofOf(levels, idx) {
    const out = [];
    let i = idx;
    for (let l = 0; l < levels.length - 1; l++) {
      const sib = i ^ 1;
      const hash = levels[l][sib] ?? levels[l][i]; // duplicated last node
      out.push({ level: l, index: sib < levels[l].length ? sib : i, hash, right: (i & 1) === 0 });
      i >>= 1;
    }
    return out;
  }

  function leafButtons() {
    leafBox.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const b = mk("button", "h-7 min-w-7 rounded-md border bg-background px-1.5 font-mono text-[11px] tabular-nums outline-none transition-colors duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand", String(i));
      b.type = "button";
      b.setAttribute("aria-pressed", String(i === sel));
      b.setAttribute("aria-label", `Prove ${txOf(i)}`);
      b.addEventListener("click", () => { sel = i; leafButtons(); draw(); });
      return b;
    }));
  }

  function draw() {
    const leaves = Array.from({ length: n }, (_, i) => sha256(txOf(i)));
    const levels = tree(leaves);
    const rootHash = levels.at(-1)[0];
    const proof = proofOf(levels, sel);
    const W = 640, H = 300, top = 24, bottom = 262;
    const dy = (bottom - top) / Math.max(1, levels.length - 1);
    // x of each node: leaves evenly spaced, parents over their children.
    const xs = [leaves.map((_, i) => 20 + ((i + 0.5) * (W - 40)) / n)];
    for (let l = 1; l < levels.length; l++) {
      xs.push(levels[l].map((_, i) => {
        const a = xs[l - 1][2 * i], b = xs[l - 1][2 * i + 1] ?? a;
        return (a + b) / 2;
      }));
    }
    const y = (l) => bottom - l * dy;
    const pathSet = new Set(), sibSet = new Set();
    let pi = sel;
    for (let l = 0; l < levels.length; l++) { pathSet.add(`${l}:${pi}`); pi >>= 1; }
    for (const s of proof) sibSet.add(`${s.level}:${s.index}`);
    svg.replaceChildren();
    const g = el("g", {}, svg);
    for (let l = 1; l < levels.length; l++) {
      levels[l].forEach((_, i) => {
        for (const c of [2 * i, 2 * i + 1]) {
          const cx = xs[l - 1][c] ?? xs[l - 1][2 * i];
          const onPath = pathSet.has(`${l}:${i}`) && pathSet.has(`${l - 1}:${c}`);
          el("line", { x1: xs[l][i], y1: y(l) + 9, x2: cx, y2: y(l - 1) - 9, style: onPath ? "stroke:var(--brand);stroke-width:1.5" : "stroke:currentColor;stroke-opacity:0.18" }, g);
          if (xs[l - 1][c] === undefined) text(g, cx + 14, y(l - 1) + 3, "dup", { "font-size": "8" });
        }
      });
    }
    const chars = n > 8 ? 3 : 6;
    const bw = n > 8 ? 30 : 52;
    levels.forEach((lev, l) => lev.forEach((hsh, i) => {
      const k = `${l}:${i}`;
      const onPath = pathSet.has(k), sib = sibSet.has(k);
      const broken = tamper && onPath;
      const stroke = broken ? "var(--code-del)" : onPath ? "var(--brand)" : sib ? "var(--vec-u)" : "currentColor";
      const w = l === levels.length - 1 ? 72 : bw;
      el("rect", { x: xs[l][i] - w / 2, y: y(l) - 9, width: w, height: 18, rx: 4, style: `fill:var(--background);stroke:${stroke};stroke-opacity:${onPath || sib ? 1 : 0.3};stroke-width:${onPath || sib ? 1.5 : 1}` }, g);
      const label = l === levels.length - 1 ? hsh.slice(0, 8) : hsh.slice(0, chars);
      const t = text(g, xs[l][i], y(l) + 3, label, { "text-anchor": "middle", class: "font-mono text-[9px] " + (onPath || sib ? "fill-foreground" : "fill-muted-foreground") });
      el("title", {}, t).textContent = hsh;
    }));
    text(g, 6, top - 12, "root", {});
    text(g, 6, bottom + 26, `${n} transactions`, {});

    // Verify the proof from the (possibly tampered) leaf.
    const claimed = tamper ? txOf(sel).replace(/\d+$/, (m) => String(Number(m) * 100)) : txOf(sel);
    let acc = sha256(claimed);
    const rows = [mk("li", "", `leaf  H("${claimed}") = ${acc.slice(0, 10)}…`)];
    for (const s of proof) {
      acc = s.right ? pair(acc, s.hash) : pair(s.hash, acc);
      rows.push(mk("li", "", `L${s.level + 1}   H(${s.right ? "· ‖ " + s.hash.slice(0, 6) : s.hash.slice(0, 6) + " ‖ ·"}) = ${acc.slice(0, 10)}…`));
    }
    const ok = acc === rootHash;
    rows.push(mk("li", ok ? "text-brand" : "text-[var(--code-del)]", ok ? "= root ✓" : "≠ root ✗"));
    proofList.replaceChildren(...rows);
    o.size.textContent = `${proof.length} (of ${n} leaves)`;
    o.root.replaceChildren(hashSpan(rootHash, 8));
    o.verdict.textContent = ok ? "included" : "proof fails";
    o.verdict.className = "tabular-nums " + (ok ? "text-brand" : "text-[var(--code-del)]");
  }

  onSeg(root, (v) => { n = Number(v); sel = Math.min(sel, n - 1); leafButtons(); draw(); });
  onToggle(root, (_, on) => { tamper = on; draw(); });
  leafButtons();
  draw();
}

// ============================================================ Proof of work

for (const root of document.querySelectorAll("[data-ledger-pow]")) {
  const svg = root.querySelector("[data-plot]");
  const bitsBox = root.querySelector("[data-bits]");
  const headerIn = root.querySelector("[data-text=header]");
  const o = outs(root);
  const bitCells = Array.from({ length: 32 }, () => {
    const s = mk("span", "size-2 rounded-[2px] bg-muted-foreground/25 data-[z=true]:bg-brand data-[t=true]:outline data-[t=true]:outline-1 data-[t=true]:outline-brand/60");
    bitsBox.append(s);
    return s;
  });
  let samples = [], running = false, hashes = 0, elapsed = 0, blockNo = 0;
  const f = scrubAll(root, () => { stop(); samples = []; plot(); summary(); });
  const k = () => Math.round(f.k.get());

  function showHash(nonce, words) {
    o.nonce.textContent = fmtInt(nonce);
    o.hash.textContent = words.map((w) => w.toString(16).padStart(8, "0")).join("");
    const w0 = words[0];
    bitCells.forEach((c, i) => {
      c.dataset.z = String(((w0 >>> (31 - i)) & 1) === 0);
      c.dataset.t = String(i < k());
    });
  }

  function mineBlocks(count) {
    if (running) return;
    running = true;
    let left = count, nonce = 0;
    const kk = k();
    let base = `${headerIn.value}|block ${blockNo}|nonce `;
    const step = () => {
      if (!running) return;
      const t0 = performance.now();
      let words;
      while (performance.now() - t0 < 14) {
        for (let j = 0; j < 256; j++) {
          words = sha256Words(base + nonce);
          if (leadingZeroBits(words) >= kk) {
            samples.push(nonce + 1);
            hashes += nonce + 1;
            elapsed += performance.now() - t0;
            showHash(nonce, words);
            blockNo++;
            plot();
            summary();
            if (--left <= 0) { running = false; return; }
            nonce = 0;
            base = `${headerIn.value}|block ${blockNo}|nonce `;
            return void requestAnimationFrame(step);
          }
          nonce++;
        }
      }
      elapsed += performance.now() - t0;
      showHash(nonce, words);
      o.rate.textContent = rate(nonce);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const rate = (pending) => (elapsed > 0 ? `${fmtInt((hashes + pending) / (elapsed / 1000))} H/s` : "—");
  function stop() { running = false; }

  function summary() {
    const e = 2 ** k();
    o.expected.textContent = fmtInt(e);
    o.blocks.textContent = String(samples.length);
    o.mean.textContent = samples.length ? `${fmtInt(samples.reduce((a, b) => a + b, 0) / samples.length)} (${num(samples.reduce((a, b) => a + b, 0) / samples.length / e, 2)}×)` : "—";
    o.rate.textContent = rate(0);
  }

  function plot() {
    svg.replaceChildren();
    const e = 2 ** k();
    const fr = frame(svg, { box: [44, 18, 536, 168], x: [0, 5], y: [0, 1], xticks: [0, 1, 2, 3, 4, 5], yticks: [0, 0.5, 1], xfmt: (t) => `${t}×2ᵏ`, yfmt: (t) => t.toFixed(1), xlabel: "tries", ylabel: "share of blocks found" });
    const curve = [];
    for (let x = 0; x <= 5; x += 0.05) curve.push([fr.sx(x), fr.sy(1 - Math.exp(-x))]);
    polyline(fr.g, curve, "stroke:var(--vec-u);stroke-width:1.5");
    text(fr.g, fr.sx(2.2), fr.sy(1 - Math.exp(-2.2)) + 16, "1 − e^(−x): geometric", { fill: "var(--vec-u)" });
    if (samples.length) {
      const s = [...samples].sort((a, b) => a - b);
      const pts = [[fr.sx(0), fr.sy(0)]];
      s.forEach((v, i) => {
        const x = Math.min(5, v / e);
        pts.push([fr.sx(x), fr.sy(i / s.length)], [fr.sx(x), fr.sy((i + 1) / s.length)]);
      });
      pts.push([fr.sx(5), fr.sy(s.filter((v) => v / e <= 5).length / s.length)]);
      polyline(fr.g, pts, "stroke:var(--brand);stroke-width:2");
      text(fr.g, fr.sx(0.15), fr.sy(0.92), `your ${s.length} block${s.length > 1 ? "s" : ""}`, { fill: "var(--brand)" });
    }
  }

  root.querySelector("[data-action=one]").addEventListener("click", () => mineBlocks(1));
  root.querySelector("[data-action=twenty]").addEventListener("click", () => mineBlocks(20));
  root.querySelector("[data-action=stop]").addEventListener("click", stop);
  headerIn.addEventListener("input", () => { stop(); samples = []; plot(); summary(); });
  showHash(0, sha256Words(`${headerIn.value}|block 0|nonce 0`));
  plot();
  summary();
}

// ============================================================ Difficulty

for (const root of document.querySelectorAll("[data-ledger-difficulty]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let scenario = "growth", clamp = true, seed = 7;
  const f = scrubAll(root, draw);
  const RATE = {
    growth: (t) => 1.12 ** t,
    halve: (t) => (t < 6 ? 1 : 0.5),
    spike: (t) => (t >= 6 && t < 12 ? 3 : 1),
    crash: (t) => (t < 6 ? 1 : 0.1),
  };

  function simulate(periods) {
    const rng = mulberry32(seed);
    let D = 1;
    const rows = [];
    for (let p = 0; p < periods; p++) {
      const H = RATE[scenario](p);
      const mean = 600 * D / H;
      let actual = 0;
      for (let b = 0; b < 2016; b++) actual += -Math.log(1 - rng()) * mean;
      rows.push({ p, H, D, minutes: actual / 2016 / 60, weeks: actual / 604800 });
      let ratio = 1209600 / actual;
      if (clamp) ratio = Math.min(4, Math.max(0.25, ratio));
      D *= ratio;
    }
    return rows;
  }

  function draw() {
    const P = Math.round(f.periods.get());
    const rows = simulate(P);
    svg.replaceChildren();
    const lg = (v) => Math.log10(v);
    const all = rows.flatMap((r) => [r.H, r.D]);
    const lo = Math.floor(Math.min(...all.map(lg), -0.3)), hi = Math.ceil(Math.max(...all.map(lg), 0.3));
    const ticks = [];
    for (let t = lo; t <= hi; t++) ticks.push(t);
    const xt = [];
    for (let t = 0; t <= P; t += P > 30 ? 10 : 5) xt.push(t);
    const top = frame(svg, { box: [52, 18, 528, 120], x: [0, P], y: [lo, hi], yticks: ticks, yfmt: (t) => (t >= 0 ? `×${10 ** t}` : `×${(10 ** t).toFixed(-t)}`), xticks: [], ylabel: "relative to start (log)" });
    const stepLine = (key, color, fr, fy) => {
      const pts = [];
      rows.forEach((r) => { pts.push([fr.sx(r.p), fy(r[key])], [fr.sx(r.p + 1), fy(r[key])]); });
      polyline(fr.g, pts, `stroke:${color};stroke-width:1.75`);
    };
    stepLine("H", "var(--vec-u)", top, (v) => top.sy(lg(v)));
    stepLine("D", "var(--brand)", top, (v) => top.sy(lg(v)));
    const maxMin = Math.max(20, ...rows.map((r) => r.minutes));
    const yMax = maxMin > 60 ? Math.ceil(maxMin / 30) * 30 : Math.ceil(maxMin / 5) * 5;
    const yt = [0, 10, yMax];
    const bot = frame(svg, { box: [52, 168, 528, 100], x: [0, P], y: [0, yMax], yticks: [...new Set(yt)], yfmt: (t) => `${t} min`, xticks: xt, xlabel: "retarget period (2016 blocks)" });
    el("line", { x1: bot.L, x2: bot.L + bot.W, y1: bot.sy(10), y2: bot.sy(10), style: "stroke:var(--brand);stroke-dasharray:3 3;stroke-opacity:0.6" }, bot.g);
    stepLine("minutes", "var(--vec-v)", bot, (v) => bot.sy(Math.min(v, yMax)));

    const worst = rows.reduce((a, r) => (Math.abs(r.minutes - 10) > Math.abs(a.minutes - 10) ? r : a));
    o.worst.textContent = `${num(worst.minutes, 1)} min (period ${worst.p})`;
    o.off.textContent = `${rows.filter((r) => Math.abs(r.minutes - 10) > 1).length} of ${P}`;
    o.final.textContent = `${num(rows.at(-1).minutes, 2)} min`;
  }

  onSeg(root, (v) => { scenario = v; draw(); });
  onToggle(root, (_, on) => { clamp = on; draw(); });
  root.querySelector("[data-action=reroll]").addEventListener("click", () => { seed = (seed * 48271) % 2147483647; draw(); });
  draw();
}

// ============================================================ Double spend

/** Exact chance with a negative-binomial head start (the paper uses a
 *  Poisson approximation of it). */
function attackerSuccessExact(q, z) {
  const p = 1 - q;
  if (q >= p) return 1;
  let sum = 0, nb = p ** z; // P(k = 0) = p^z
  for (let k = 0; k < 4000; k++) {
    if (k > 0) nb *= (q * (k + z - 1)) / k;
    sum += nb * (k >= z ? 1 : (q / p) ** (z - k));
    if (k > z && nb < 1e-18) break;
  }
  return Math.min(1, sum);
}

for (const root of document.querySelectorAll("[data-ledger-nakamoto]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  let sim = null;
  const f = scrubAll(root, () => { sim = null; draw(); });
  const sci = (v) => (v >= 0.001 ? v.toFixed(7) : v === 0 ? "0" : v.toExponential(2).replace("e-", "×10⁻").replace(/⁻(\d+)/, (_, d) => "⁻" + [...d].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c]).join("")));

  // The paper's second table: confirmations needed for P < 0.1%.
  const QS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
  const cell = (tag, cls, txt) => mk(tag, "px-2 py-1 text-right first:text-left " + cls, txt);
  const head = mk("tr", "border-b text-muted-foreground");
  head.append(cell("th", "font-normal", "q"), ...QS.map((q) => cell("th", "font-normal", q.toFixed(2))));
  const need = mk("tr");
  need.append(cell("td", "text-muted-foreground", "z for P < 0.1%"), ...QS.map((q) => cell("td", "", String(confirmationsFor(q)))));
  table.append(mk("caption", "pb-1 text-left text-muted-foreground", "Nakamoto (2008), section 11: confirmations needed"), head, need);

  function draw() {
    const q = f.q.get(), z = Math.round(f.z.get());
    svg.replaceChildren();
    const Z = 50;
    const fr = frame(svg, { box: [52, 16, 520, 196], x: [0, Z], y: [-12, 0], xticks: [0, 10, 20, 30, 40, 50], yticks: [-12, -9, -6, -3, 0], yfmt: (t) => (t === 0 ? "1" : `10${String(t).replace("-", "⁻").replace("12", "¹²").replace("9", "⁹").replace("6", "⁶").replace("3", "³")}`), xlabel: "confirmations z", ylabel: "P(attacker ever catches up)" });
    const clip = (v) => Math.max(-12, Math.log10(Math.max(v, 1e-300)));
    // Curves stop where they leave the chart rather than run along its floor.
    const curve = (qq, style) => {
      const pts = [];
      for (let zz = 0; zz <= Z; zz++) {
        const lv = Math.log10(Math.max(attackerSuccess(qq, zz), 1e-300));
        if (lv < -12) {
          const prev = Math.log10(attackerSuccess(qq, zz - 1));
          pts.push([fr.sx(zz - 1 + (prev + 12) / (prev - lv)), fr.sy(-12)]);
          break;
        }
        pts.push([fr.sx(zz), fr.sy(lv)]);
      }
      polyline(fr.g, pts, style);
    };
    for (const qq of [0.1, 0.2, 0.3, 0.4]) {
      curve(qq, "stroke:var(--vec-u);stroke-opacity:0.45;stroke-width:1");
      const zl = qq === 0.4 ? 44 : qq === 0.3 ? 38 : qq === 0.2 ? 20 : 11;
      text(fr.g, fr.sx(zl) + 4, fr.sy(clip(attackerSuccess(qq, zl))) - 4, `q=${qq}`, { fill: "var(--vec-u)" });
    }
    curve(q, "stroke:var(--brand);stroke-width:2");
    el("line", { x1: fr.L, x2: fr.L + fr.W, y1: fr.sy(-3), y2: fr.sy(-3), style: "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3" }, fr.g);
    text(fr.g, fr.L + fr.W - 2, fr.sy(-3) - 4, "0.1%", { "text-anchor": "end" });
    const P = attackerSuccess(q, z);
    el("circle", { cx: fr.sx(Math.min(z, Z)), cy: fr.sy(clip(P)), r: 4, style: "fill:var(--brand)" }, fr.g);
    if (sim) el("circle", { cx: fr.sx(Math.min(sim.z, Z)), cy: fr.sy(clip(Math.max(sim.p, 1e-12))), r: 5, style: "fill:none;stroke:var(--vec-v);stroke-width:2" }, fr.g);

    o.p.textContent = q >= 0.5 ? "1 (majority wins)" : sci(P);
    o.exact.textContent = q >= 0.5 ? "1" : sci(attackerSuccessExact(q, z));
    const zn = confirmationsFor(q);
    o.need.textContent = zn === null ? "never" : String(zn);
    o.sim.textContent = sim ? `${sci(sim.p)} ± ${sci(sim.se)} (${sim.wins} of ${sim.n})` : "—";
    need.querySelectorAll("td").forEach((td, i) => { if (i > 0) td.className = "px-2 py-1 text-right " + (Math.abs(QS[i - 1] - q) < 1e-9 ? "text-brand" : ""); });
  }

  root.querySelector("[data-action=simulate]").addEventListener("click", () => {
    const q = f.q.get(), z = Math.round(f.z.get());
    const rng = mulberry32(1234 + Math.round(q * 1000) * 97 + z);
    const N = 20000;
    let wins = 0;
    for (let i = 0; i < N; i++) {
      // While the honest network finds z blocks, the attacker finds k.
      let honest = 0, k = 0;
      while (honest < z) (rng() < q ? k++ : honest++);
      let deficit = z - k;
      while (deficit > 0 && deficit < 200) deficit += rng() < q ? -1 : 1;
      if (deficit <= 0) wins++;
    }
    const p = wins / N;
    sim = { p, se: Math.sqrt(Math.max(p * (1 - p), 1 / N) / N), wins, n: N, z };
    draw();
  });
  draw();
}
