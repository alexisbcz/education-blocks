// Distributed systems blocks driven by randomness or replica state: CRDTs,
// gossip, tail latency and retry backoff. Everything is simulated in the
// page with seeded generators.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";
import { reduced, outs, onToggle, onSeg, h, smallButton, mulberry32, gauss, pct, ms } from "./distsys-util.js";

// ============================================================ CRDTs

const NAMES = ["A", "B", "C"];
const FRUITS = ["apple", "fig"];

const crdt = {
  g: {
    init: () => ({ p: [0, 0, 0] }),
    value: (s) => s.p.reduce((a, b) => a + b, 0),
    merge: (a, b) => ({ p: a.p.map((v, i) => Math.max(v, b.p[i])) }),
    show: (s) => `P = [${s.p.join(", ")}]`,
    ops: [["+1", (s, i) => { s.p[i]++; return 1; }]],
  },
  pn: {
    init: () => ({ p: [0, 0, 0], n: [0, 0, 0] }),
    value: (s) => s.p.reduce((a, b) => a + b, 0) - s.n.reduce((a, b) => a + b, 0),
    merge: (a, b) => ({ p: a.p.map((v, i) => Math.max(v, b.p[i])), n: a.n.map((v, i) => Math.max(v, b.n[i])) }),
    show: (s) => `P = [${s.p.join(", ")}]\nN = [${s.n.join(", ")}]`,
    ops: [["+1", (s, i) => { s.p[i]++; return 1; }], ["−1", (s, i) => { s.n[i]++; return -1; }]],
  },
  orset: {
    init: () => ({ adds: [], tomb: [], seq: 0 }),
    value: (s) => [...new Set(s.adds.filter((a) => !s.tomb.includes(a.tag)).map((a) => a.e))].sort(),
    merge: (a, b) => {
      const adds = [...a.adds];
      for (const x of b.adds) if (!adds.some((y) => y.tag === x.tag)) adds.push(x);
      return { adds, tomb: [...new Set([...a.tomb, ...b.tomb])], seq: Math.max(a.seq, b.seq) };
    },
    show: (s) => (s.adds.length ? s.adds.map((a) => `${s.tomb.includes(a.tag) ? "✕ " : "  "}${a.e} · tag ${a.tag}`).join("\n") : "∅"),
    // Each add gets a unique tag; a remove tombstones the tags it has seen.
    ops: FRUITS.flatMap((f) => [
      [`+${f}`, (s, i) => { s.seq++; s.adds.push({ e: f, tag: `${NAMES[i]}${s.seq}` }); }],
      [`−${f}`, (s) => { s.adds.filter((a) => a.e === f).forEach((a) => { if (!s.tomb.includes(a.tag)) s.tomb.push(a.tag); }); }],
    ]),
  },
};

for (const root of document.querySelectorAll("[data-ds-crdt]")) {
  const box = root.querySelector("[data-replicas]");
  const o = outs(root);
  const rng = mulberry32(5);
  let type = "g", reps, naive, ops, truth;

  function reset() {
    const T = crdt[type];
    reps = NAMES.map(() => T.init());
    // The naive replica: one number (or one plain set), merged by max (or union).
    naive = NAMES.map(() => (type === "orset" ? [] : 0));
    ops = 0; truth = 0;
    o.explain.textContent = type === "orset"
      ? "Add on one replica and remove on another, then sync: a remove only deletes the tags it has seen, so a concurrent add survives (add wins). The naive set merges by union, so a removed fruit comes back after a sync."
      : `Increment on different replicas, then send states in any order. Each replica owns its own slot, and merging takes the maximum slot by slot, so nothing is counted twice or lost. The naive counter merges by keeping the larger number and loses concurrent increments.`;
    draw();
  }

  function draw() {
    const T = crdt[type];
    box.replaceChildren();
    reps.forEach((s, i) => {
      const card = h("div", "flex flex-col gap-2 rounded-lg border bg-code p-3");
      const top = h("div", "flex items-baseline justify-between");
      top.append(h("span", "font-mono text-xs text-muted-foreground", `replica ${NAMES[i]}`));
      const v = T.value(s);
      top.append(h("span", "font-mono text-lg tabular-nums", Array.isArray(v) ? `{${v.join(", ")}}` : String(v)));
      card.append(top);
      card.append(h("pre", "code min-h-10 text-[11px] leading-5 whitespace-pre-wrap text-muted-foreground", T.show(s)));
      const row = h("div", "flex flex-wrap gap-1.5");
      for (const [label, fn] of T.ops) {
        row.append(smallButton(label, () => {
          const d = fn(reps[i], i);
          ops++;
          if (type === "orset") {
            const f = label.slice(1);
            naive[i] = label[0] === "+" ? [...new Set([...naive[i], f])] : naive[i].filter((x) => x !== f);
          } else { naive[i] += d; truth += d; }
          draw();
        }));
      }
      card.append(row);
      box.append(card);
    });
    const vals = reps.map((s) => JSON.stringify(T.value(s)));
    const conv = vals.every((v) => v === vals[0]);
    o.conv.textContent = conv ? "yes, all equal" : "not yet";
    o.conv.className = conv ? "text-add" : "";
    o.ops.textContent = String(ops);
    o.naive.textContent = type === "orset"
      ? naive.map((s, i) => `${NAMES[i]} {${s.join(", ")}}`).join(" · ")
      : `${naive.map((v, i) => `${NAMES[i]} ${v}`).join(" · ")} (true total ${truth})`;
  }

  function merge(a, b) {
    const T = crdt[type];
    reps[b] = T.merge(reps[b], reps[a]);
    naive[b] = type === "orset" ? [...new Set([...naive[b], ...naive[a]])] : Math.max(naive[b], naive[a]);
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !root.contains(b)) return;
    if (b.dataset.merge) { const [x, y] = b.dataset.merge.split("-").map(Number); merge(x, y); draw(); }
    if (b.dataset.action === "reset") reset();
    if (b.dataset.action === "gossip") {
      // Two passes over the six directed pairs, shuffled: enough to reach everyone.
      const pairs = [[0, 1], [1, 0], [1, 2], [2, 1], [0, 2], [2, 0]];
      const order = [...pairs, ...pairs].sort(() => rng() - 0.5);
      order.forEach(([x, y]) => merge(x, y));
      draw();
      o.explain.textContent = `Merged in the order ${order.map(([x, y]) => `${NAMES[x]}→${NAMES[y]}`).join(", ")}. Any order gives the same result: the merge is commutative, associative and idempotent.`;
    }
  });
  onSeg(root, (v) => { type = v; reset(); });
  reset();
}

// ============================================================ Gossip

for (const root of document.querySelectorAll("[data-ds-gossip]")) {
  const grid = root.querySelector("[data-grid]");
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => reset());
  const n = 1024;
  let proto = "push", rng, informed, round, curve, msgs, old = [], timer = 0;
  const cells = Array.from({ length: n }, () => {
    const c = h("div", "aspect-square rounded-[1px] transition-colors duration-200");
    grid.append(c);
    return c;
  });

  // One round on a typed array; returns how many know after it.
  function round1(inf, size, fanout, loss, kind, r) {
    const before = inf.slice();
    let sent = 0;
    for (let i = 0; i < size; i++) {
      const pushes = (kind === "push" || kind === "pushpull") && before[i];
      const pulls = (kind === "pull" || kind === "pushpull") && !before[i];
      if (!pushes && !pulls && kind !== "pull" && kind !== "pushpull") continue;
      for (let f = 0; f < fanout; f++) {
        let j = Math.floor(r() * (size - 1));
        if (j >= i) j++;
        if (pushes) { sent++; if (r() >= loss) inf[j] = inf[j] || 1; }
        if (kind === "pull" || kind === "pushpull") {
          // Everyone pulls each round; only the uninformed learn anything.
          sent++;
          if (pulls && before[j] && r() >= loss) inf[i] = 1;
        }
      }
    }
    let k = 0;
    for (let i = 0; i < size; i++) k += inf[i] ? 1 : 0;
    return { k, sent };
  }

  function reset() {
    clearTimeout(timer);
    if (curve && curve.length > 1) old = [curve, ...old].slice(0, 6);
    rng = mulberry32((Math.random() * 1e9) | 0);
    informed = new Uint8Array(n);
    informed[0] = 1;
    round = 0; msgs = 0;
    curve = [[0, 1]];
    paint(); plot(); readout();
  }

  function step() {
    const k = informed.reduce((a, b) => a + (b ? 1 : 0), 0);
    if (k === n) return false;
    if (round >= 80) return false;
    const was = informed.slice();
    const r = round1(informed, n, Math.round(s.fanout.get()), s.loss.get() / 100, proto, rng);
    round++;
    msgs += r.sent;
    for (let i = 0; i < n; i++) if (informed[i] && !was[i]) informed[i] = round + 1; // remember when
    curve.push([round, r.k]);
    paint(); plot(); readout();
    return r.k < n;
  }

  function paint() {
    for (let i = 0; i < n; i++) {
      const v = informed[i];
      const fresh = v === round + 1 && round > 0;
      cells[i].style.background = !v ? "color-mix(in oklab, var(--foreground) 8%, transparent)" : fresh ? "var(--brand)" : "color-mix(in oklab, var(--brand) 45%, transparent)";
    }
  }

  const theory = (m) => Math.log2(m) + Math.log(m);

  function plot() {
    svg.replaceChildren();
    const xmax = Math.max(20, ...curve.map((p) => p[0]), ...old.flat().map((p) => p[0]));
    const f = frame(svg, { box: [52, 16, 490, 150], x: [0, xmax], y: [0, n], xticks: Array.from({ length: Math.floor(xmax / 5) + 1 }, (_, i) => i * 5), yticks: [0, 512, 1024], xlabel: "round", ylabel: "informed" });
    for (const c of old) polyline(svg, c.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:currentColor;stroke-opacity:.18;stroke-width:1.2");
    polyline(svg, curve.map(([x, y]) => [f.sx(x), f.sy(y)]), "stroke:var(--brand);stroke-width:2");
    const t = theory(n);
    el("line", { x1: f.sx(t), x2: f.sx(t), y1: 16, y2: 166, style: "stroke:currentColor;stroke-opacity:.5;stroke-dasharray:4 3" }, svg);
    text(svg, f.sx(t) + 4, 28, "log₂ n + ln n");
  }

  function readout() {
    const k = informed.reduce((a, b) => a + (b ? 1 : 0), 0);
    o.n.textContent = String(n);
    o.round.textContent = String(round);
    o.inf.textContent = `${k} (${pct(k / n)})`;
    o.theory.textContent = `${theory(n).toFixed(1)} rounds (push, fanout 1)`;
    o.msgs.textContent = msgs.toLocaleString("en");
  }

  function run() {
    clearTimeout(timer);
    const go = () => { if (step()) timer = setTimeout(go, reduced() ? 0 : 220); };
    go();
  }

  // Mean rounds to reach everyone, by size, against Pittel's estimate.
  function batch() {
    clearTimeout(timer);
    const sizes = [8, 10, 12, 14, 16];
    const runs = 50, res = [];
    const fan = Math.round(s.fanout.get()), loss = s.loss.get() / 100;
    const r = mulberry32(99);
    let at = 0;
    const btn = root.querySelector('[data-action="batch"]');
    btn.disabled = true;
    const next = () => {
      const size = 2 ** sizes[at];
      let total = 0;
      for (let k = 0; k < runs; k++) {
        const inf = new Uint8Array(size);
        inf[0] = 1;
        let rounds = 0, got = 1;
        while (got < size && rounds < 200) { got = round1(inf, size, fan, loss, proto, r).k; rounds++; }
        total += rounds;
      }
      res.push([sizes[at], total / runs]);
      drawBatch(res, sizes);
      if (++at < sizes.length) timer = setTimeout(next, 0);
      else btn.disabled = false;
    };
    next();
  }

  function drawBatch(res, sizes) {
    svg.replaceChildren();
    const ymax = Math.max(30, ...res.map((p) => p[1]), theory(2 ** 16)) * 1.1;
    const f = frame(svg, { box: [52, 16, 490, 150], x: [sizes[0] - 1, sizes[sizes.length - 1] + 1], y: [0, ymax], xticks: sizes, yticks: [0, 10, 20, 30, 40].filter((v) => v <= ymax), xfmt: (v) => `2^${v}`, xlabel: "nodes n", ylabel: "rounds to reach all (mean of 50)" });
    polyline(svg, Array.from({ length: 41 }, (_, i) => { const e = sizes[0] - 1 + (i / 40) * (sizes.length * 2); return [f.sx(e), f.sy(theory(2 ** e))]; }).filter((p) => p[0] <= 542), "stroke:currentColor;stroke-opacity:.5;stroke-dasharray:4 3");
    for (const [e, m] of res) {
      el("circle", { cx: f.sx(e), cy: f.sy(m), r: 4, style: "fill:var(--brand)" }, svg);
      text(svg, f.sx(e), f.sy(m) - 8, m.toFixed(1), { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px]" });
    }
    text(svg, 60, 28, `dashed: log₂ n + ln n · ${proto}, fanout ${Math.round(s.fanout.get())}`);
  }

  root.querySelector('[data-action="step"]').addEventListener("click", () => step());
  root.querySelector('[data-action="run"]').addEventListener("click", () => { if (curve[curve.length - 1][1] >= n) reset(); run(); });
  root.querySelector('[data-action="batch"]').addEventListener("click", batch);
  onSeg(root, (v) => { proto = v; old = []; curve = null; reset(); });
  reset();
}

// ============================================================ Tail latency

for (const root of document.querySelectorAll("[data-ds-tail]")) {
  const svg = root.querySelector("[data-plot]");
  const hist = root.querySelector("[data-hist]");
  const o = outs(root);
  let hedge = false;
  const s = scrubAll(root, () => update());

  // One server's answer time: lognormal around the typical value, or slow.
  const leaf = (r, fast, slow, p) => (r() < p ? slow * Math.exp(0.2 * gauss(r)) : fast * Math.exp(0.35 * gauss(r)));
  const quant = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];

  function update() {
    const fast = s.fast.get(), slow = s.slow.get(), p = s.pslow.get() / 100, k = Math.round(s.k.get());
    const r = mulberry32(42);
    const singles = Array.from({ length: 20000 }, () => leaf(r, fast, slow, p)).sort((a, b) => a - b);
    const d = quant(singles, 0.95);
    const thresh = Math.sqrt(fast * slow); // "slow" means past the geometric middle
    const hedged = Array.from({ length: 20000 }, () => { const a = leaf(r, fast, slow, p); return a <= d ? a : Math.min(a, d + leaf(r, fast, slow, p)); });
    const pLeaf = p, pHedge = hedged.filter((x) => x > thresh).length / hedged.length;
    // Whole requests: the max over k servers.
    const trials = Math.max(200, Math.min(3000, Math.floor(2e6 / k)));
    const req = (useHedge) => {
      const out = new Float64Array(trials);
      for (let t = 0; t < trials; t++) {
        let m = 0;
        for (let j = 0; j < k; j++) {
          let a = leaf(r, fast, slow, p);
          if (useHedge && a > d) a = Math.min(a, d + leaf(r, fast, slow, p));
          if (a > m) m = a;
        }
        out[t] = m;
      }
      return out.sort();
    };
    const plain = req(false), withH = hedge ? req(true) : null;
    const shown = withH ?? plain;

    // Chart 1: chance a request is slow, against fan-out.
    svg.replaceChildren();
    const f = frame(svg, { box: [52, 18, 480, 160], x: [0, 3.3], y: [0, 1], xticks: [0, 1, 2, 3], yticks: [0, 0.25, 0.5, 0.75, 1], xfmt: (v) => String(10 ** v), yfmt: (v) => `${v * 100}%`, xlabel: "fan-out k (log scale)", ylabel: "P(request is slow)" });
    const curve = (q) => Array.from({ length: 121 }, (_, i) => { const lx = (i / 120) * 3.3; return [f.sx(lx), f.sy(1 - (1 - q) ** 10 ** lx)]; });
    polyline(svg, curve(pLeaf), "stroke:var(--code-del);stroke-width:2");
    if (hedge) polyline(svg, curve(pHedge), "stroke:var(--brand);stroke-width:2");
    const lk = Math.log10(k), y = 1 - (1 - pLeaf) ** k;
    el("line", { x1: f.sx(lk), x2: f.sx(lk), y1: 18, y2: 178, style: "stroke:currentColor;stroke-opacity:.35;stroke-dasharray:2 3" }, svg);
    el("circle", { cx: f.sx(lk), cy: f.sy(y), r: 4, style: "fill:var(--code-del)" }, svg);
    text(svg, f.sx(lk) + 7, f.sy(y) + 12, `${pct(y)} at k = ${k}`, { class: "fill-foreground font-mono text-[10px]" });
    text(svg, 530, 34, "without hedging", { "text-anchor": "end", class: "fill-del font-mono text-[10px]" });
    if (hedge) text(svg, 530, 48, "hedged", { "text-anchor": "end", class: "fill-brand font-mono text-[10px]" });

    // Chart 2: histogram of whole-request latency, log bins.
    hist.replaceChildren();
    const lo = Math.log10(fast / 3), hi = Math.log10(slow * 3), B = 48;
    const bins = (arr) => { const c = new Array(B).fill(0); for (const v of arr) { const b = Math.floor(((Math.log10(v) - lo) / (hi - lo)) * B); c[Math.max(0, Math.min(B - 1, b))]++; } return c.map((x) => x / arr.length); };
    const cp = bins(plain), ch = withH ? bins(withH) : null;
    const top = Math.max(...cp, ...(ch ?? [0])) * 1.1;
    const g = frame(hist, { box: [52, 16, 480, 140], x: [lo, hi], y: [0, top], xticks: [0, 1, 2, 3, 4].filter((v) => v >= lo && v <= hi), xfmt: (v) => ms(10 ** v), yticks: [0], xlabel: "whole-request latency", ylabel: "share of requests" });
    const bw = 480 / B;
    cp.forEach((v, i) => { if (v) el("rect", { x: g.L + i * bw + 0.5, y: g.sy(v), width: bw - 1, height: g.sy(0) - g.sy(v), style: `fill:var(--code-del);fill-opacity:${hedge ? 0.3 : 0.75}` }, hist); });
    ch?.forEach((v, i) => { if (v) el("rect", { x: g.L + i * bw + 0.5, y: g.sy(v), width: bw - 1, height: g.sy(0) - g.sy(v), style: "fill:var(--brand);fill-opacity:.8" }, hist); });
    const p99 = quant(shown, 0.99);
    el("line", { x1: g.sx(Math.log10(p99)), x2: g.sx(Math.log10(p99)), y1: 16, y2: 156, style: "stroke:currentColor;stroke-dasharray:3 3;stroke-opacity:.6" }, hist);
    text(hist, g.sx(Math.log10(p99)) - 4, 28, "p99", { "text-anchor": "end" });

    o.pk.textContent = `${pct(y)}${hedge ? ` → ${pct(1 - (1 - pHedge) ** k)} hedged` : ""}`;
    o.p50.textContent = ms(quant(shown, 0.5));
    o.p99.textContent = hedge ? `${ms(quant(plain, 0.99))} → ${ms(p99)}` : ms(p99);
    o.extra.textContent = hedge ? `${pct(singles.filter((x) => x > d).length / singles.length)} (sent after ${ms(d)})` : "0%";
  }

  onToggle(root, (_, on) => { hedge = on; update(); });
  update();
}

// ============================================================ Backoff and jitter

const STRATS = {
  none: { name: "Immediate", formula: "sleep = 0" },
  exp: { name: "Exponential", formula: "sleep = min(cap, base · 2^attempt)" },
  full: { name: "Full jitter", formula: "sleep = random(0, min(cap, base · 2^attempt))" },
  equal: { name: "Equal jitter", formula: "t = min(cap, base · 2^attempt)\nsleep = t/2 + random(0, t/2)" },
  decor: { name: "Decorrelated", formula: "sleep = min(cap, random(base, previous sleep · 3))" },
};
const CAP_SLOTS = 256;

function simulateBackoff(kind, clients, capacity, base, r) {
  const at = new Int32Array(clients); // slot of each client's next call
  const tries = new Int32Array(clients);
  const prev = new Float64Array(clients).fill(base);
  const done = new Uint8Array(clients);
  const perSlot = [];
  let left = clients, calls = 0, fails = 0, t = 0, last = 0;
  while (left > 0 && t < 4000) {
    const now = [];
    for (let i = 0; i < clients; i++) if (!done[i] && at[i] === t) now.push(i);
    // Arrivals in a slot are served in random order, up to capacity.
    for (let i = now.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [now[i], now[j]] = [now[j], now[i]]; }
    let ok = 0, bad = 0;
    now.forEach((c, idx) => {
      calls++;
      if (idx < capacity) { done[c] = 1; left--; ok++; last = t; return; }
      bad++; fails++;
      const a = tries[c]++;
      const ceil = Math.min(CAP_SLOTS, base * 2 ** a);
      let sleep = 0;
      if (kind === "exp") sleep = ceil;
      else if (kind === "full") sleep = r() * ceil;
      else if (kind === "equal") sleep = ceil / 2 + r() * (ceil / 2);
      else if (kind === "decor") { sleep = Math.min(CAP_SLOTS, base + r() * (prev[c] * 3 - base)); prev[c] = sleep; }
      at[c] = t + 1 + Math.floor(sleep);
    });
    perSlot.push([ok, bad]);
    t++;
  }
  return { perSlot, calls, fails, last };
}

for (const root of document.querySelectorAll("[data-ds-backoff]")) {
  const svg = root.querySelector("[data-plot]");
  const cmp = root.querySelector("[data-compare]");
  const o = outs(root);
  let kind = "full", seed = 1;
  const s = scrubAll(root, () => update());

  function update() {
    const clients = Math.round(s.clients.get()), capacity = Math.round(s.cap.get()), base = Math.round(s.base.get());
    root.querySelector("[data-formula]").textContent = `${STRATS[kind].formula}\nbase = ${base} slot${base > 1 ? "s" : ""}, cap = ${CAP_SLOTS} slots`;
    const run = simulateBackoff(kind, clients, capacity, base, mulberry32(seed));
    svg.replaceChildren();
    const T = Math.max(20, run.last + 2), shown = run.perSlot.slice(0, T);
    const top = Math.max(capacity * 1.5, ...shown.map(([a, b]) => a + b)) * 1.05;
    const f = frame(svg, { box: [48, 16, 490, 160], x: [0, T], y: [0, top], xticks: [0, Math.round(T / 4), Math.round(T / 2), Math.round((3 * T) / 4), T], yticks: [0, capacity, Math.round(top)], xlabel: "time slot", ylabel: "calls per slot" });
    const bw = 490 / T;
    shown.forEach(([ok, bad], i) => {
      if (ok) el("rect", { x: f.sx(i), y: f.sy(ok), width: Math.max(0.6, bw - 0.6), height: f.sy(0) - f.sy(ok), style: "fill:var(--code-add);fill-opacity:.8" }, svg);
      if (bad) el("rect", { x: f.sx(i), y: f.sy(ok + bad), width: Math.max(0.6, bw - 0.6), height: f.sy(ok) - f.sy(ok + bad), style: "fill:var(--code-del);fill-opacity:.8" }, svg);
    });
    el("line", { x1: 48, x2: 538, y1: f.sy(capacity), y2: f.sy(capacity), style: "stroke:currentColor;stroke-opacity:.6;stroke-dasharray:4 3" }, svg);
    text(svg, 536, f.sy(capacity) - 4, "capacity", { "text-anchor": "end" });
    text(svg, 536, 28, "succeeded", { "text-anchor": "end", class: "fill-add font-mono text-[10px]" });
    text(svg, 536, 42, "failed", { "text-anchor": "end", class: "fill-del font-mono text-[10px]" });
    o.calls.textContent = `${run.calls} (${(run.calls / clients).toFixed(2)} per client)`;
    o.fails.textContent = String(run.fails);
    o.done.textContent = `slot ${run.last}`;

    // All strategies, averaged over 20 seeds.
    const table = h("table", "w-full min-w-[420px] font-mono text-[11px]");
    const head = h("tr", "text-left text-muted-foreground");
    for (const c of ["strategy", "calls (mean of 20)", "failed calls", "all done by slot"]) head.append(h("th", "py-1 pr-3 font-normal", c));
    table.append(head);
    for (const [k, v] of Object.entries(STRATS)) {
      let c = 0, fl = 0, d = 0;
      for (let i = 0; i < 20; i++) { const x = simulateBackoff(k, clients, capacity, base, mulberry32(1000 + i)); c += x.calls; fl += x.fails; d += x.last; }
      const tr = h("tr", `border-t ${k === kind ? "text-brand" : ""}`);
      for (const cell of [v.name, (c / 20).toFixed(0), (fl / 20).toFixed(0), (d / 20).toFixed(1)]) tr.append(h("td", "py-1 pr-3 tabular-nums", cell));
      table.append(tr);
    }
    const note = h("p", "pt-2 text-[11px] leading-relaxed text-muted-foreground", "This model never degrades under overload, so immediate retry finishes early, but it fails the most calls; a real server spending work on rejected calls gets slower, which is how retries turn a blip into an outage. Plain exponential backoff keeps the herd together; jitter breaks it up.");
    cmp.replaceChildren(table, note);
  }

  onSeg(root, (v) => { kind = v; update(); });
  root.querySelector('[data-action="rerun"]').addEventListener("click", () => { seed++; update(); });
  update();
}
