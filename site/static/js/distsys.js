// Distributed systems blocks: logical clocks, impossibility, CAP, quorums
// and consistent hashing. Raft lives in distsys-raft.js, the randomized
// simulations in distsys-sim.js. Nothing leaves the page.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline } from "./plot.js";
import { reduced, outs, onToggle, onSeg, h, mulberry32, fnv1a, PALETTE, choose, pct, logLine } from "./distsys-util.js";

// ============================================================ Logical clocks

const EXAMPLE = [["send", 0, 1], ["local", 2], ["send", 2, 1], ["local", 0], ["send", 1, 0], ["local", 2], ["send", 1, 2], ["local", 0]];

for (const root of document.querySelectorAll("[data-ds-clocks]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let actions = EXAMPLE.slice();
  let show = "vector";
  let sel = 4;
  let events = [];

  // Replays the actions: positions, Lamport and vector timestamps.
  function build() {
    events = [];
    const last = [-1, -1, -1];
    const L = [0, 0, 0];
    const V = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    let cursor = 0;
    const tick = (p, kind, from) => {
      const col = Math.max(cursor, last[p] + 1);
      last[p] = col;
      if (kind === "recv") {
        L[p] = Math.max(L[p], from.lam) + 1;
        V[p] = V[p].map((v, i) => Math.max(v, from.vec[i]));
      } else L[p] += 1;
      V[p] = V[p].slice();
      V[p][p] += 1;
      const e = { p, kind, col, lam: L[p], vec: V[p].slice(), n: events.length, from: from?.n };
      events.push(e);
      return e;
    };
    for (const a of actions) {
      if (a[0] === "local") { const e = tick(a[1], "local"); cursor = e.col + 1; }
      else {
        const s = tick(a[1], "send");
        cursor = s.col + 1;
        const r = tick(a[2], "recv", s);
        s.to = r.n;
      }
    }
    if (sel >= events.length) sel = events.length - 1;
  }

  // a → b: every component of V(a) is ≤ V(b), and they differ.
  const before = (a, b) => a !== b && a.vec.every((v, i) => v <= b.vec[i]);

  function draw() {
    svg.replaceChildren();
    const lanes = [60, 140, 220];
    const cols = Math.max(8, ...events.map((e) => e.col + 1));
    const dx = Math.min(56, 500 / cols);
    const X = (c) => 80 + c * dx + dx / 2;
    const defs = el("defs", {}, svg);
    const mk = el("marker", { id: "ds-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", style: "fill:var(--muted-foreground)" }, mk);
    lanes.forEach((y, p) => {
      el("line", { x1: 50, x2: 590, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:.25" }, svg);
      text(svg, 14, y + 4, `P${p + 1}`, { class: "fill-foreground font-mono text-[12px]" });
    });
    text(svg, 590, 270, "time →", { "text-anchor": "end" });
    const S = events[sel];
    const role = (e) => (!S ? "none" : e === S ? "sel" : before(e, S) ? "past" : before(S, e) ? "future" : "conc");
    const color = { sel: "var(--brand)", past: "var(--vec-u)", future: "var(--vec-v)", conc: "var(--muted-foreground)", none: "var(--foreground)" };
    for (const e of events) {
      if (e.kind !== "send") continue;
      const r = events[e.to];
      const on = S && (role(e) !== "conc" && role(r) !== "conc");
      const ax = X(e.col), ay = lanes[e.p], bx = X(r.col), by = lanes[r.p];
      const len = Math.hypot(bx - ax, by - ay);
      el("line", {
        x1: ax, y1: ay, x2: bx - ((bx - ax) / len) * 10, y2: by - ((by - ay) / len) * 10,
        "marker-end": "url(#ds-arrow)", class: on ? "text-foreground" : "text-muted-foreground",
        style: `stroke:currentColor;stroke-width:1.4;stroke-opacity:${on ? 0.8 : 0.35}`,
      }, svg);
    }
    for (const e of events) {
      const r = role(e);
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `Event ${e.n + 1} on P${e.p + 1}, Lamport ${e.lam}, vector [${e.vec}]`, class: "cursor-pointer outline-none [&:focus-visible>circle]:stroke-[3px]" }, svg);
      el("circle", {
        cx: X(e.col), cy: lanes[e.p], r: e === S ? 8 : 6.5,
        style: `fill:${r === "conc" ? "var(--background)" : color[r]};stroke:${color[r]};stroke-width:1.6;transition:r .15s`,
      }, g);
      const label = show === "vector" ? `[${e.vec.join(",")}]` : String(e.lam);
      // A halo in the panel colour keeps labels readable over arrows.
      text(g, X(e.col), lanes[e.p] - 14, label, { "text-anchor": "middle", class: `font-mono text-[10px] ${r === "conc" ? "fill-muted-foreground" : "fill-foreground"}`, style: "paint-order:stroke;stroke:var(--code-bg);stroke-width:4px;stroke-linejoin:round" });
      const pick = () => { sel = e.n; draw(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); pick(); } });
    }
    // Legend.
    [["selected", "sel"], ["happened before", "past"], ["happened after", "future"], ["concurrent", "conc"]].forEach(([t, k], i) => {
      const x = 80 + i * 128;
      el("circle", { cx: x, cy: 18, r: 4.5, style: `fill:${k === "conc" ? "var(--background)" : color[k]};stroke:${color[k]};stroke-width:1.5` }, svg);
      text(svg, x + 9, 21, t);
    });
    readout();
  }

  function readout() {
    const S = events[sel];
    if (!S) { for (const k of ["sel", "lam", "vec", "cone", "conc"]) o[k].textContent = "—"; return; }
    o.sel.textContent = `event ${S.n + 1} on P${S.p + 1} (${S.kind === "recv" ? "receive" : S.kind})`;
    o.lam.textContent = String(S.lam);
    o.vec.textContent = `[${S.vec.join(", ")}]`;
    const past = events.filter((e) => before(e, S)).length, fut = events.filter((e) => before(S, e)).length;
    const conc = events.filter((e) => e !== S && !before(e, S) && !before(S, e));
    o.cone.textContent = `${past} / ${fut}`;
    o.conc.textContent = String(conc.length);
    // Lamport's limit: a smaller timestamp does not mean "happened before".
    const trap = conc.find((e) => e.lam !== S.lam);
    if (trap) {
      const [a, b] = trap.lam < S.lam ? [trap, S] : [S, trap];
      o.trap.textContent = `L = ${a.lam} on P${a.p + 1} is smaller than L = ${b.lam} on P${b.p + 1}, yet the two events are concurrent: [${a.vec}] and [${b.vec}] are not ordered. A Lamport clock only promises that a → b implies L(a) < L(b), never the reverse.`;
    } else o.trap.textContent = conc.length ? "Equal Lamport times, concurrent events: ties are broken by process id when a total order is needed." : "Every other event is causally related to this one.";
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !root.contains(b)) return;
    if (b.dataset.local) actions.push(["local", +b.dataset.local]);
    else if (b.dataset.send) { const [a, c] = b.dataset.send.split("-").map(Number); actions.push(["send", a, c]); }
    else if (b.dataset.action === "undo") actions.pop();
    else if (b.dataset.action === "reset") { actions = EXAMPLE.slice(); sel = 4; build(); draw(); return; }
    else return;
    build();
    if (b.dataset.local || b.dataset.send) sel = events.length - 1;
    draw();
  });
  onSeg(root, (v) => { show = v; draw(); });
  build();
  draw();
}

// ============================================================ Two generals

for (const root of document.querySelectorAll("[data-ds-impossible]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, () => {});
  const rng = mulberry32(7);
  let sent = 0, depth = 0, busy = false, label = null;
  const XA = 70, XB = 490, Y = 70;

  function scene() {
    svg.replaceChildren();
    // Two hills and the valley the enemy holds.
    el("path", { d: "M0,200 L0,110 Q40,62 120,96 Q170,120 200,170 L220,200 Z", style: "fill:color-mix(in oklab, var(--foreground) 7%, transparent);stroke:currentColor;stroke-opacity:.3" }, svg);
    el("path", { d: "M560,200 L560,110 Q520,62 440,96 Q390,120 360,170 L340,200 Z", style: "fill:color-mix(in oklab, var(--foreground) 7%, transparent);stroke:currentColor;stroke-opacity:.3" }, svg);
    el("rect", { x: 250, y: 160, width: 60, height: 26, rx: 4, style: "fill:color-mix(in oklab, var(--code-del) 18%, transparent);stroke:var(--code-del);stroke-opacity:.6" }, svg);
    text(svg, 280, 177, "enemy", { "text-anchor": "middle" });
    for (const [x, name] of [[XA, "A"], [XB, "B"]]) {
      el("line", { x1: x, x2: x, y1: Y - 40, y2: Y + 4, style: "stroke:currentColor;stroke-width:1.5" }, svg);
      el("path", { d: `M${x},${Y - 40} l${name === "A" ? 22 : -22},7 l${name === "A" ? -22 : 22},7 z`, style: `fill:${name === "A" ? "var(--vec-u)" : "var(--vec-v)"}` }, svg);
      text(svg, x, Y + 20, `General ${name}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    }
    el("path", { d: `M${XA + 10},${Y + 30} Q280,${Y + 120} ${XB - 10},${Y + 30}`, style: "fill:none;stroke:currentColor;stroke-opacity:.2;stroke-dasharray:3 4" }, svg);
  }

  const fromA = () => depth % 2 === 0;
  const msgName = (d) => (d === 0 ? "“attack at dawn”" : d === 1 ? "“got your plan”" : `ack #${d}`);

  function knows() {
    if (depth === 0) return "Only A knows the plan. A's next messenger carries it.";
    // A chain like: B knows that A knows that B knows the plan.
    const chain = [];
    for (let i = 0; i < depth; i++) chain.push(i % 2 === 0 ? "B" : "A");
    const said = chain.reverse().map((g) => `${g} knows that`).join(" ").replace(/ that$/, "");
    const lastFrom = depth % 2 === 1 ? "A" : "B";
    return `${said} the plan.\n${lastFrom} sent the last messenger and cannot tell whether it got through, so ${lastFrom} still lacks one more level of “knows”.`;
  }

  function readout() {
    o.sent.textContent = String(sent);
    o.depth.textContent = String(depth);
    o.sure.textContent = sent === 0 ? "—" : "no, never";
    o.knows.textContent = knows();
    root.querySelector('[data-action="send"] [data-label]').textContent = fromA() ? "A sends" : "B sends";
  }

  function send() {
    if (busy) return;
    busy = true;
    sent++;
    const caught = rng() < s.loss.get() / 100;
    const a = fromA();
    const x0 = a ? XA + 10 : XB - 10, x1 = a ? XB - 10 : XA + 10;
    const dot = el("circle", { r: 5, style: `fill:${a ? "var(--vec-u)" : "var(--vec-v)"}` }, svg);
    label?.remove();
    label = text(svg, 280, 24, `${a ? "A → B" : "B → A"}: ${msgName(depth)}`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    const stop = caught ? 0.5 : 1;
    const t0 = performance.now(), dur = reduced() ? 0 : 900;
    const at = (t) => {
      const x = x0 + (x1 - x0) * t, y = Y + 30 + 4 * 45 * t * (1 - t); // the dashed road
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
    };
    const frameFn = (now) => {
      const t = dur ? Math.min(stop, ((now - t0) / dur)) : stop;
      at(t);
      if (t < stop) return requestAnimationFrame(frameFn);
      if (caught) {
        dot.style.fill = "var(--code-del)";
        label.textContent += " — caught";
      } else {
        depth++;
        label.textContent += " — arrived";
      }
      setTimeout(() => { dot.remove(); busy = false; }, dur ? 450 : 0);
      readout();
    };
    requestAnimationFrame(frameFn);
  }

  root.querySelector('[data-action="send"]').addEventListener("click", send);
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { sent = 0; depth = 0; busy = false; label = null; scene(); readout(); });
  scene();
  readout();
}

// ============================================================ CAP / PACELC

for (const root of document.querySelectorAll("[data-ds-cap]")) {
  const svg = root.querySelector("[data-plot]");
  const log = root.querySelector("[data-log]");
  const o = outs(root);
  const s = scrubAll(root, () => readout());
  let mode = "cp", part = false, sync = true;
  let reps, clock, counts, history, partWrites, pending;
  const POS = [[110, 70], [280, 70], [450, 70]];
  const CLIENTS = [{ name: "Alice", home: 0, x: 110, tag: "a" }, { name: "Bob", home: 2, x: 450, tag: "b" }];
  const NEAR = 2; // ms between S1 and S2, same region

  function reset() {
    reps = [0, 1, 2].map(() => ({ val: "v0", ts: 0 }));
    clock = 0;
    counts = { refused: 0, stale: 0, lost: 0, w: { a: 0, b: 0 } };
    history = [{ val: "v0", ts: 0 }];
    partWrites = [[], []];
    pending.forEach(clearTimeout);
    pending = [];
    log.replaceChildren();
    logLine(log, "x = v0 on every replica.", "dim");
    draw();
    readout();
  }
  pending = [];

  const side = (i) => (part && i === 2 ? 1 : 0);
  const reach = (i) => [0, 1, 2].filter((j) => side(j) === side(i));
  const latest = () => history.reduce((a, b) => (b.ts > a.ts ? b : a));

  function draw(flash = []) {
    svg.replaceChildren();
    const links = [[0, 1], [1, 2], [0, 2]];
    for (const [a, b] of links) {
      const cut = side(a) !== side(b);
      const [x1, y1] = POS[a], [x2, y2] = POS[b];
      const bend = a === 0 && b === 2 ? 90 : 0;
      el("path", { d: `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - bend} ${x2},${y2}`, style: `fill:none;stroke:${cut ? "var(--code-del)" : "currentColor"};stroke-opacity:${cut ? 0.7 : 0.3};stroke-width:1.5;${cut ? "stroke-dasharray:4 4" : ""}` }, svg);
    }
    if (part) {
      el("line", { x1: 365, x2: 365, y1: 8, y2: 222, style: "stroke:var(--code-del);stroke-width:2;stroke-dasharray:6 5" }, svg);
      text(svg, 371, 216, "partition", { class: "fill-del font-mono text-[10px]" });
    }
    reps.forEach((r, i) => {
      const [x, y] = POS[i];
      const fresh = r.ts === latest().ts;
      el("rect", { x: x - 52, y: y - 24, width: 104, height: 48, rx: 8, style: `fill:var(--background);stroke:${flash.includes(i) ? "var(--brand)" : "currentColor"};stroke-opacity:${flash.includes(i) ? 1 : 0.35};stroke-width:${flash.includes(i) ? 2 : 1}` }, svg);
      text(svg, x, y - 6, `S${i + 1}`, { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[10px]" });
      text(svg, x, y + 12, `x = ${r.val}`, { "text-anchor": "middle", class: `font-mono text-[12px] ${fresh ? "fill-foreground" : "fill-del"}` });
    });
    for (const c of CLIENTS) {
      el("line", { x1: c.x, x2: c.x, y1: 94, y2: 158, style: "stroke:currentColor;stroke-opacity:.3;stroke-dasharray:2 3" }, svg);
      el("circle", { cx: c.x, cy: 176, r: 13, style: `fill:none;stroke:${c.home === 0 ? "var(--vec-u)" : "var(--vec-v)"};stroke-width:1.5` }, svg);
      text(svg, c.x, 180, c.name[0], { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      text(svg, c.x, 206, c.name, { "text-anchor": "middle" });
    }
    text(svg, 195, 212, `S1 ↔ S2: ${NEAR} ms`, { "text-anchor": "middle" });
  }

  const rtt = () => Math.round(s.rtt.get());
  // The slowest replica a write must wait for, from its home replica.
  function writeLatency(home) {
    if (!sync) return 1;
    return rtt() + 1; // every replica, and S1 or S2 is far from S3 either way
  }

  function apply(i, w) { if (w.ts > reps[i].ts) reps[i] = { val: w.val, ts: w.ts }; }

  function op(code) {
    const c = CLIENTS[code[1] === "1" ? 0 : 1];
    const isWrite = code[0] === "w";
    const R = reach(c.home);
    const majority = R.length >= 2;
    const minority = part && !majority;
    if (part && mode === "cp" && minority) {
      counts.refused++;
      logLine(log, `${c.name} ${isWrite ? "writes" : "reads"} at S${c.home + 1}: refused. S${c.home + 1} cannot reach a majority, so a CP store answers “unavailable”.`, "bad");
      return readout();
    }
    if (isWrite) {
      counts.w[c.tag]++;
      const w = { val: `${c.tag}${counts.w[c.tag]}`, ts: ++clock, by: c.home };
      history.push(w);
      if (part) partWrites[side(c.home)].push(w);
      apply(c.home, w);
      const others = R.filter((j) => j !== c.home);
      if (!part && !sync) {
        // Else-Latency: acknowledge now, copy later.
        for (const j of [0, 1, 2].filter((j) => j !== c.home)) {
          const lag = j + c.home === 1 ? NEAR : rtt() / 2;
          pending.push(setTimeout(() => { apply(j, w); draw([j]); readout(); }, reduced() ? 0 : Math.max(250, lag * 20)));
        }
        logLine(log, `${c.name} writes x = ${w.val}: acknowledged in 1 ms by S${c.home + 1}; the copies travel in the background.`);
      } else {
        others.forEach((j) => apply(j, w));
        const lat = part ? (R.length === 1 ? 1 : R.includes(c.home === 2 ? 0 : 2) ? rtt() + 1 : NEAR + 1) : writeLatency(c.home);
        const where = part ? `on ${R.map((j) => `S${j + 1}`).join(", ")}` : "on every replica";
        logLine(log, `${c.name} writes x = ${w.val} ${where} (${lat} ms).${part && mode === "ap" && !majority ? " An AP store accepts it on the minority side." : ""}`, "good");
        counts.lastLat = lat;
      }
      draw([c.home, ...(sync || part ? others : [])]);
    } else {
      // CP reads ask a majority and keep the newest; AP reads ask the local replica.
      const got = mode === "cp" && part ? R.map((j) => reps[j]).reduce((a, b) => (b.ts > a.ts ? b : a)) : reps[c.home];
      const stale = got.ts < latest().ts;
      if (stale) counts.stale++;
      logLine(log, `${c.name} reads x = ${got.val} at S${c.home + 1}${stale ? `: stale, the latest write is ${latest().val}` : ""}.`, stale ? "bad" : "");
      draw([c.home]);
    }
    readout();
  }

  function heal() {
    if (mode === "ap" && partWrites[0].length && partWrites[1].length) {
      // Last writer wins: the side with the newest write keeps it, the other side's writes vanish.
      const win = latest();
      const loser = partWrites[0].includes(win) ? 1 : 0;
      counts.lost += partWrites[loser].length;
      logLine(log, `Healed. Last writer wins keeps ${win.val}; ${partWrites[loser].map((w) => w.val).join(", ")} ${partWrites[loser].length > 1 ? "are" : "is"} silently lost.`, "bad");
    } else logLine(log, "Healed. The lagging replica copies the newest value.", "dim");
    const win = latest();
    reps.forEach((_, i) => apply(i, win));
    partWrites = [[], []];
  }

  function readout() {
    o.refused.textContent = String(counts.refused);
    o.stale.textContent = String(counts.stale);
    o.lost.textContent = String(counts.lost);
    o.lat.textContent = part ? "—" : sync ? `${writeLatency(0)} ms (waits for S3)` : "1 ms (local)";
    if (o.class) o.class.textContent = `P${mode === "cp" ? "C" : "A"}/E${sync ? "C" : "L"}`;
  }

  onSeg(root, (v) => { mode = v; logLine(log, v === "cp" ? "Mode CP: during a partition only a majority side answers." : "Mode AP: every replica answers, even cut off.", "dim"); readout(); });
  onToggle(root, (k, on) => {
    if (k === "partition") { part = on; if (!on) heal(); else logLine(log, "The link to S3 is cut.", "bad"); draw(); }
    if (k === "sync") sync = on;
    readout();
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.op) op(b.dataset.op);
    if (b.dataset.action === "reset") reset();
  });
  reset();
}

// ============================================================ Quorums

for (const root of document.querySelectorAll("[data-ds-quorum]")) {
  const svg = root.querySelector("[data-plot]");
  const av = root.querySelector("[data-avail]");
  const o = outs(root);
  const rng = mulberry32(11);
  const s = scrubAll(root, () => update());

  const vals = () => {
    const N = Math.round(s.n.get());
    if (s.w.get() > N) s.w.set(N, false);
    if (s.r.get() > N) s.r.set(N, false);
    return { N, W: Math.round(s.w.get()), R: Math.round(s.r.get()), p: s.p.get() / 100 };
  };
  const sample = (arr, k) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  };
  const atLeast = (N, k, up) => { let t = 0; for (let j = k; j <= N; j++) t += choose(N, j) * up ** j * (1 - up) ** (N - j); return t; };
  const pStale = (N, W, R) => (R + W > N ? 0 : choose(N - W, R) / choose(N, R));

  let trial;
  function newTrial() {
    const { N, W, R, p } = vals();
    const ids = [...Array(N).keys()];
    const down = new Set(ids.filter(() => rng() < p));
    const up = ids.filter((i) => !down.has(i));
    trial = { N, down, write: up.length >= W ? new Set(sample(up, W)) : null, read: up.length >= R ? new Set(sample(up, R)) : null };
  }

  function drawTrial() {
    svg.replaceChildren();
    const { N, down, write, read } = trial;
    const dx = Math.min(70, 500 / N), x0 = 280 - ((N - 1) * dx) / 2;
    text(svg, 12, 20, write ? `write v2 to ${write.size} replica${write.size > 1 ? "s" : ""}, then read from ${read ? read.size : "—"}` : "not enough replicas up: the write fails", { class: "fill-foreground font-mono text-[11px]" });
    for (let i = 0; i < N; i++) {
      const x = x0 + i * dx, y = 92;
      const isDown = down.has(i), w = write?.has(i), r = read?.has(i);
      el("rect", { x: x - 20, y: y - 22, width: 40, height: 44, rx: 7, style: `fill:${w ? "color-mix(in oklab, var(--brand) 22%, var(--background))" : "var(--background)"};stroke:${isDown ? "var(--code-del)" : "currentColor"};stroke-opacity:${isDown ? 0.8 : 0.35};${isDown ? "stroke-dasharray:3 3" : ""}` }, svg);
      text(svg, x, y + 5, isDown ? "down" : w ? "v2" : "v1", { "text-anchor": "middle", class: `font-mono text-[11px] ${isDown ? "fill-del" : "fill-foreground"}` });
      if (r) el("rect", { x: x - 25, y: y - 27, width: 50, height: 54, rx: 10, style: "fill:none;stroke:var(--vec-u);stroke-width:2" }, svg);
      text(svg, x, y + 40, `n${i + 1}`, { "text-anchor": "middle" });
    }
    let verdict = "—";
    if (write && read) {
      const meet = [...read].some((i) => write.has(i));
      verdict = meet ? "the read set meets the write set: the read returns v2" : "no overlap: the read returns the old v1 (stale)";
    } else if (write && !read) verdict = "too few replicas up to read";
    text(svg, 12, 185, verdict, { class: `font-mono text-[11px] ${verdict.includes("stale") || verdict.includes("fails") ? "fill-del" : "fill-foreground"}` });
    el("rect", { x: 392, y: 172, width: 10, height: 10, rx: 2, style: "fill:color-mix(in oklab, var(--brand) 22%, var(--background));stroke:currentColor;stroke-opacity:.35" }, svg);
    text(svg, 406, 181, "write set");
    el("rect", { x: 476, y: 172, width: 10, height: 10, rx: 2, style: "fill:none;stroke:var(--vec-u);stroke-width:2" }, svg);
    text(svg, 490, 181, "read set");
  }

  function drawAvail() {
    av.replaceChildren();
    const { N, W, R, p } = vals();
    const f = frame(av, { box: [44, 22, 490, 140], x: [0, 0.5], y: [0, 1], xticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yticks: [0, 0.5, 1], xfmt: (v) => `${Math.round(v * 100)}%`, yfmt: (v) => `${v * 100}%`, xlabel: "P(replica down)", ylabel: "available" });
    const curve = (k) => Array.from({ length: 101 }, (_, i) => { const q = i / 200; return [f.sx(q), f.sy(atLeast(N, k, 1 - q))]; });
    polyline(av, curve(W), "stroke:var(--brand);stroke-width:2");
    polyline(av, curve(R), "stroke:var(--vec-u);stroke-width:2;stroke-dasharray:5 4");
    el("line", { x1: f.sx(p), x2: f.sx(p), y1: 22, y2: 162, style: "stroke:currentColor;stroke-opacity:.4;stroke-dasharray:2 3" }, av);
    text(av, 530, 40, `write (W = ${W})`, { "text-anchor": "end", class: "fill-brand font-mono text-[10px]" });
    text(av, 530, 54, `read (R = ${R})`, { "text-anchor": "end", style: "fill:var(--vec-u)" });
  }

  function update(fresh = true) {
    const { N, W, R, p } = vals();
    if (fresh) newTrial();
    drawTrial();
    drawAvail();
    o.strict.textContent = R + W > N ? `yes (${R} + ${W} > ${N}): reads always see the latest write` : `no (${R} + ${W} ≤ ${N})`;
    o.stale.textContent = pct(pStale(N, W, R), 2);
    // Monte Carlo, all replicas up, random quorums.
    let staleN = 0;
    const ids = [...Array(N).keys()];
    for (let t = 0; t < 10000; t++) {
      const w = new Set(sample(ids, W));
      if (!sample(ids, R).some((i) => w.has(i))) staleN++;
    }
    o.sim.textContent = `${pct(staleN / 10000, 2)} (10,000 trials)`;
    o.wa.textContent = pct(atLeast(N, W, 1 - p), 4);
    o.ra.textContent = pct(atLeast(N, R, 1 - p), 4);
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.preset) {
      const [N, W, R] = b.dataset.preset.split(",").map(Number);
      s.n.set(N, false); s.w.set(W, false); s.r.set(R, false);
      update();
    }
    if (b.dataset.action === "trial") update();
  });
  update();
}

// ============================================================ Consistent hashing

for (const root of document.querySelectorAll("[data-ds-hashing]")) {
  const ring = root.querySelector("[data-plot]");
  const load = root.querySelector("[data-load]");
  const o = outs(root);
  let servers = [1, 2, 3, 4];
  let nextId = 5;
  let prev = null, moved = null, modMoved = null;
  const s = scrubAll(root, () => { prev = null; moved = null; modMoved = null; draw(); });
  const U32 = 4294967296;

  function keys() {
    const n = Math.round(s.keys.get());
    return Array.from({ length: n }, (_, i) => fnv1a(`key-${i}`));
  }
  function points(list) {
    const v = Math.round(s.vnodes.get());
    const pts = [];
    for (const id of list) for (let j = 0; j < v; j++) pts.push({ id, at: fnv1a(`S${id}#${j}`) });
    return pts.sort((a, b) => a.at - b.at);
  }
  // The first point clockwise from the key's hash owns it (binary search).
  function owners(pts, ks) {
    return ks.map((k) => {
      let lo = 0, hi = pts.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].at < k) lo = m + 1; else hi = m; }
      return pts[lo % pts.length].id;
    });
  }
  const color = (id) => PALETTE[(id - 1) % PALETTE.length];

  function change(next) {
    const ks = keys();
    const before = owners(points(servers), ks);
    const after = owners(points(next), ks);
    moved = before.filter((x, i) => x !== after[i]).length;
    modMoved = ks.filter((k) => k % servers.length !== k % next.length).length;
    servers = next;
    draw();
  }

  function draw() {
    const ks = keys();
    const pts = points(servers);
    const own = owners(pts, ks);
    ring.replaceChildren();
    const C = 150, R = 112, ang = (u) => (u / U32) * 2 * Math.PI - Math.PI / 2;
    const P = (u, r) => [C + r * Math.cos(ang(u)), C + r * Math.sin(ang(u))];
    el("circle", { cx: C, cy: C, r: R, style: "fill:none;stroke:currentColor;stroke-opacity:.12;stroke-width:10" }, ring);
    // Each arc (previous point, this point] belongs to this point's server.
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length].at, b = pts[i].at;
      const span = (b - a + U32) % U32 || U32;
      const [x1, y1] = P(a, R), [x2, y2] = P(b, R);
      const large = span > U32 / 2 ? 1 : 0;
      if (pts.length === 1) el("circle", { cx: C, cy: C, r: R, style: `fill:none;stroke:${color(pts[i].id)};stroke-width:10` }, ring);
      else el("path", { d: `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2}`, style: `fill:none;stroke:${color(pts[i].id)};stroke-width:10;stroke-opacity:.85` }, ring);
    }
    if (pts.length <= 60) for (const p of pts) { const [x, y] = P(p.at, R); el("circle", { cx: x, cy: y, r: 3, style: "fill:var(--background);stroke:currentColor;stroke-width:1.2" }, ring); }
    // A sample of keys just inside the ring.
    const step = Math.max(1, Math.floor(ks.length / 240));
    for (let i = 0; i < ks.length; i += step) { const [x, y] = P(ks[i], R - 14); el("circle", { cx: x, cy: y, r: 1.4, style: `fill:${color(own[i])}` }, ring); }
    text(ring, C, C - 4, `${servers.length} servers`, { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
    text(ring, C, C + 12, `${pts.length} points on the ring`, { "text-anchor": "middle" });

    // Load per server.
    load.replaceChildren();
    const count = new Map(servers.map((id) => [id, 0]));
    own.forEach((id) => count.set(id, count.get(id) + 1));
    const vals = servers.map((id) => count.get(id));
    const mean = ks.length / servers.length, top = Math.max(...vals, mean) * 1.15;
    const f = frame(load, { box: [40, 28, 250, 178], x: [0, servers.length], y: [0, top], yticks: [0, Math.round(top / 2), Math.round(top)], ylabel: "keys" });
    servers.forEach((id, i) => {
      const bw = (250 / servers.length) * 0.7;
      el("rect", { x: f.sx(i) + (250 / servers.length) * 0.15, y: f.sy(vals[i]), width: bw, height: f.sy(0) - f.sy(vals[i]), rx: 2, style: `fill:${color(id)};fill-opacity:.85` }, load);
      if (servers.length <= 12) text(load, f.sx(i + 0.5), 222, `S${id}`, { "text-anchor": "middle" });
    });
    el("line", { x1: 40, x2: 290, y1: f.sy(mean), y2: f.sy(mean), style: "stroke:currentColor;stroke-dasharray:4 3;stroke-opacity:.6" }, load);
    text(load, 288, f.sy(mean) - 4, "mean", { "text-anchor": "end" });

    o.n.textContent = String(servers.length);
    o.moved.textContent = moved === null ? "—" : `${moved} keys (${pct(moved / ks.length)})`;
    o.modn.textContent = modMoved === null ? "—" : `${modMoved} keys (${pct(modMoved / ks.length)})`;
    o.ideal.textContent = pct(1 / servers.length);
    o.imb.textContent = `${(Math.max(...vals) / mean).toFixed(2)}×`;
    root.querySelector('[data-action="remove"]').disabled = servers.length <= 1;
    root.querySelector('[data-action="add"]').disabled = servers.length >= 20;
  }

  root.querySelector('[data-action="add"]').addEventListener("click", () => change([...servers, nextId++]));
  root.querySelector('[data-action="remove"]').addEventListener("click", () => {
    // Remove a server from the middle, as a failed machine would.
    const i = Math.floor(servers.length / 2);
    change(servers.filter((_, j) => j !== i));
  });
  draw();
}
