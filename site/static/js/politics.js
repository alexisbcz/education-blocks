// Voting and political science blocks. Every ballot, voter, party and state
// is synthetic. Counting rules follow their textbook definitions; ties go
// to the earlier letter (or the larger vote) and are said to.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const COLORS = ["var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)"];
const pct = (v, d = 1) => `${num(v * 100, d)}%`;
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const node = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

// ============================================================ counting rules
// A profile is [{ n, order: ["A", "B", ...] }], candidates sorted letters.

function pairwise(profile, cands) {
  const m = {};
  for (const a of cands) { m[a] = {}; for (const b of cands) m[a][b] = 0; }
  for (const { n, order } of profile) {
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) m[order[i]][order[j]] += n;
  }
  return m;
}

// Highest score wins; ties go to the earlier candidate in `cands`.
const best = (cands, score) => cands.reduce((w, c) => (score(c) > score(w) ? c : w), cands[0]);

function plurality(profile, cands) {
  const t = Object.fromEntries(cands.map((c) => [c, 0]));
  for (const { n, order } of profile) t[order.find((c) => cands.includes(c))] += n;
  return t;
}

// Restrict ballots to a subset of candidates (order preserved).
const restrict = (profile, keep) => profile.map(({ n, order }) => ({ n, order: order.filter((c) => keep.includes(c)) }));

function irv(profile, cands) {
  let alive = [...cands];
  const rounds = [];
  const out = [];
  while (alive.length > 1) {
    const t = plurality(restrict(profile, alive), alive);
    const total = alive.reduce((s, c) => s + t[c], 0);
    rounds.push({ ...t, _alive: [...alive] });
    const top = best(alive, (c) => t[c]);
    if (t[top] * 2 > total) { out.unshift(...alive.filter((c) => c !== top).sort((a, b) => t[b] - t[a])); return { winner: top, rounds, order: [top, ...out] }; }
    // Eliminate the lowest; ties eliminate the later letter.
    const low = alive.reduce((w, c) => (t[c] < t[w] || (t[c] === t[w] && c > w) ? c : w), alive[0]);
    out.unshift(low);
    alive = alive.filter((c) => c !== low);
  }
  return { winner: alive[0], rounds, order: [alive[0], ...out] };
}

function borda(profile, cands) {
  const t = Object.fromEntries(cands.map((c) => [c, 0]));
  for (const { n, order } of profile) order.forEach((c, i) => (t[c] += n * (order.length - 1 - i)));
  return t;
}

function copeland(m, cands) {
  const t = Object.fromEntries(cands.map((c) => [c, 0]));
  for (const a of cands) for (const b of cands) if (a !== b) t[a] += m[a][b] > m[b][a] ? 1 : m[a][b] === m[b][a] ? 0.5 : 0;
  return t;
}

function condorcetWinner(m, cands) {
  return cands.find((a) => cands.every((b) => a === b || m[a][b] > m[b][a])) ?? null;
}

// Schulze: strongest paths by winning votes (Floyd–Warshall widest path).
function schulze(m, cands) {
  const p = {};
  for (const a of cands) { p[a] = {}; for (const b of cands) p[a][b] = a !== b && m[a][b] > m[b][a] ? m[a][b] : 0; }
  for (const k of cands) for (const i of cands) if (i !== k) for (const j of cands) if (j !== k && j !== i)
    p[i][j] = Math.max(p[i][j], Math.min(p[i][k], p[k][j]));
  const wins = Object.fromEntries(cands.map((a) => [a, cands.filter((b) => a !== b && p[a][b] > p[b][a]).length]));
  return { p, wins };
}

function scores(profile, cands) {
  const t = Object.fromEntries(cands.map((c) => [c, 0]));
  const k = cands.length - 1;
  for (const { n, order } of profile) order.forEach((c, i) => (t[c] += n * (5 * (k - i)) / k));
  return t;
}

function parseOrder(s, expected) {
  const order = s.toUpperCase().split(/[>\s,]+/).filter(Boolean);
  if (!order.length || order.some((c) => !/^[A-E]$/.test(c)) || new Set(order).size !== order.length) return null;
  if (expected && (order.length !== expected.length || order.some((c) => !expected.includes(c)))) return null;
  return order;
}

// ============================================================ P1 methods

for (const root of document.querySelectorAll("[data-pol-methods]")) {
  const rowsEl = root.querySelector("[data-rows]");
  const tbody = root.querySelector("[data-results]");
  const summary = root.querySelector("[data-summary]");
  const o = outs(root);
  const template = root.querySelector("template[data-row-template]");
  const initial = rowsEl.innerHTML;
  const s = scrubAll(root, draw);

  rowsEl.addEventListener("input", draw);
  rowsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action=remove]");
    if (b && rowsEl.children.length > 1) { b.closest("[data-row]").remove(); draw(); }
  });
  root.querySelector("[data-action=add]").addEventListener("click", () => {
    rowsEl.append(template.content.firstElementChild.cloneNode(true));
    draw();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", () => { rowsEl.innerHTML = initial; draw(); });

  function draw() {
    const rows = [...rowsEl.querySelectorAll("[data-row]")];
    let cands = null;
    const profile = [];
    let bad = false;
    for (const r of rows) {
      const input = r.querySelector("[data-order]");
      const order = parseOrder(input.value, cands);
      input.setAttribute("aria-invalid", String(!order));
      if (!order) { bad = true; continue; }
      cands ??= [...order].sort();
      const n = Math.max(0, Math.round(Number(r.querySelector("[data-count]").value) || 0));
      profile.push({ n, order });
    }
    tbody.replaceChildren();
    summary.replaceChildren();
    const total = profile.reduce((a, b) => a + b.n, 0);
    if (bad || !cands || cands.length < 2 || total === 0) {
      o.error.textContent = bad ? "Each group needs a full ranking of the same candidates, like A>B>C." : "Add some voters.";
      return;
    }
    o.error.textContent = "";
    const k = Math.min(cands.length - 1, Math.round(s.approve.get()));
    const m = pairwise(profile, cands);
    const fmtT = (t) => cands.map((c) => `${c} ${num(t[c], Number.isInteger(t[c]) ? 0 : 1)}`).join(" · ");

    const results = [];
    const pl = plurality(profile, cands);
    results.push(["Plurality", best(cands, (c) => pl[c]), `first choices: ${fmtT(pl)}`]);
    // Two-round runoff.
    const top2 = [...cands].sort((a, b) => pl[b] - pl[a] || (a < b ? -1 : 1)).slice(0, 2);
    const plWinner = best(cands, (c) => pl[c]);
    if (pl[plWinner] * 2 > total) results.push(["Two-round runoff", plWinner, `${plWinner} has a majority in round one`]);
    else {
      const [a, b] = top2;
      const w = m[a][b] >= m[b][a] ? a : b;
      results.push(["Two-round runoff", w, `runoff ${a} ${m[a][b]} – ${m[b][a]} ${b}`]);
    }
    const ir = irv(profile, cands);
    results.push(["Instant runoff", ir.winner, ir.rounds.length > 1 ? `eliminated in order: ${[...ir.order].reverse().slice(0, ir.rounds.length - 1).join(", ")}` : "majority in round one"]);
    const bo = borda(profile, cands);
    results.push(["Borda count", best(cands, (c) => bo[c]), fmtT(bo)]);
    const cw = condorcetWinner(m, cands);
    const co = copeland(m, cands);
    results.push(["Copeland", best(cands, (c) => co[c]), `pairwise wins: ${fmtT(co)}`]);
    const sch = schulze(m, cands);
    results.push(["Schulze", best(cands, (c) => sch.wins[c]), cw ? `${cw} beats everyone head to head` : "beatpath strengths decide"]);
    const ap = plurality([], cands);
    for (const { n, order } of profile) order.slice(0, k).forEach((c) => (ap[c] += n));
    results.push([`Approval (top ${k})`, best(cands, (c) => ap[c]), fmtT(ap)]);
    const sc = scores(profile, cands);
    results.push(["Score", best(cands, (c) => sc[c]), fmtT(sc)]);
    const [s1, s2] = [...cands].sort((a, b) => sc[b] - sc[a] || (a < b ? -1 : 1));
    const star = m[s1][s2] >= m[s2][s1] ? s1 : s2;
    results.push(["STAR", star, `finalists ${s1}, ${s2}: ${m[s1][s2]} – ${m[s2][s1]}`]);

    for (const [name, w, how] of results) {
      const tr = node("tr", "border-b last:border-b-0");
      tr.append(node("td", "py-1.5 pr-3 text-sm", name));
      const td = node("td", "py-1.5 pr-3");
      const chip = node("span", "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs");
      const dot = node("span", "size-2 rounded-full");
      dot.style.background = COLORS[cands.indexOf(w) % COLORS.length];
      chip.append(dot, w);
      td.append(chip);
      tr.append(td, node("td", "py-1.5 font-mono text-[11px] text-muted-foreground", how));
      tbody.append(tr);
    }
    const winners = [...new Set(results.map((r) => r[1]))];
    const msg = node("span", "rounded-full bg-brand/10 px-2.5 py-1 text-xs text-brand",
      winners.length === 1 ? `Every rule agrees: ${winners[0]}` : `${winners.length} different winners from the same ballots`);
    summary.append(msg, node("span", "rounded-full border px-2.5 py-1 text-xs text-muted-foreground",
      cw ? `Condorcet winner: ${cw}` : "No Condorcet winner (a majority cycle or a tie)"));
  }
  draw();
}

// ============================================================ P2 Condorcet cycle

const RANK3 = ["A>B>C", "A>C>B", "B>A>C", "B>C>A", "C>A>B", "C>B>A"];

for (const root of document.querySelectorAll("[data-pol-condorcet]")) {
  const svg = root.querySelector("[data-graph]");
  const matrix = root.querySelector("[data-matrix]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    b.dataset.preset.split(" ").map(Number).forEach((v, i) => s[`r${i}`].set(v, false));
    draw();
  }));
  const pos = { A: [130, 40], B: [40, 195], C: [220, 195] };

  function draw() {
    const cands = ["A", "B", "C"];
    const profile = RANK3.map((r, i) => ({ n: Math.round(s[`r${i}`].get()), order: r.split(">") }));
    const m = pairwise(profile, cands);
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    const mk = el("marker", { id: "pol-arrowhead", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0 L10 5 L0 10 z", style: "fill:currentColor" }, mk);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const a = cands[i], b = cands[j];
      if (m[a][b] === m[b][a]) {
        el("line", { x1: pos[a][0], y1: pos[a][1], x2: pos[b][0], y2: pos[b][1], style: "stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4" }, svg);
        continue;
      }
      const [w, l] = m[a][b] > m[b][a] ? [a, b] : [b, a];
      const [x1, y1] = pos[w], [x2, y2] = pos[l];
      const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      el("line", { x1: x1 + ux * 24, y1: y1 + uy * 24, x2: x2 - ux * 26, y2: y2 - uy * 26, "marker-end": "url(#pol-arrowhead)", style: "stroke:currentColor;stroke-width:1.75" }, svg);
      text(svg, (x1 + x2) / 2 + uy * 14, (y1 + y2) / 2 - ux * 14 + 3, `${m[w][l]}:${m[l][w]}`, { "text-anchor": "middle" });
    }
    cands.forEach((c, i) => {
      el("circle", { cx: pos[c][0], cy: pos[c][1], r: 20, style: `fill:var(--background);stroke:${COLORS[i]};stroke-width:2` }, svg);
      text(svg, pos[c][0], pos[c][1] + 5, c, { "text-anchor": "middle", class: "fill-foreground font-mono text-[14px]" });
    });
    // Matrix.
    matrix.replaceChildren();
    const table = node("table", "mx-auto font-mono text-xs");
    const head = node("tr");
    head.append(node("th", "px-2 py-1 font-normal text-muted-foreground", "beats →"));
    cands.forEach((c) => head.append(node("th", "px-2 py-1 font-normal", c)));
    table.append(head);
    for (const a of cands) {
      const tr = node("tr");
      tr.append(node("th", "px-2 py-1 text-left font-normal", a));
      for (const b of cands) tr.append(node("td", `px-2 py-1 text-right tabular-nums ${a !== b && m[a][b] > m[b][a] ? "text-add" : "text-muted-foreground"}`, a === b ? "—" : String(m[a][b])));
      table.append(tr);
    }
    matrix.append(table);
    const total = profile.reduce((x, y) => x + y.n, 0);
    const cw = condorcetWinner(m, cands);
    const beats = (a, b) => m[a][b] > m[b][a];
    const cycle = (beats("A", "B") && beats("B", "C") && beats("C", "A")) || (beats("B", "A") && beats("C", "B") && beats("A", "C"));
    o.verdict.textContent = total === 0 ? "Give some rankings voters."
      : cw ? `${cw} is the Condorcet winner: a majority prefers ${cw} to each rival.`
      : cycle ? "A majority cycle: every candidate loses to another, so majority rule gives no winner."
      : "No Condorcet winner: at least one pairwise contest is tied.";
  }
  draw();
}

// ============================================================ P3 Arrow / IIA

const ARROW = {
  plurality: { profile: [[40, "A>B>C"], [35, "C>B>A"], [25, "B>C>A"]], drop: "B", rank: (p, c) => { const t = plurality(p, c); return [...c].sort((a, b) => t[b] - t[a] || (a < b ? -1 : 1)).map((x) => [x, `${t[x]} first choices`]); } },
  borda: { profile: [[3, "A>B>C"], [2, "B>C>A"]], drop: "C", rank: (p, c) => { const t = borda(p, c); return [...c].sort((a, b) => t[b] - t[a] || (a < b ? -1 : 1)).map((x) => [x, `${t[x]} points`]); } },
  irv: { profile: [[35, "A>C>B"], [33, "B>A>C"], [32, "C>B>A"]], drop: "A", rank: (p, c) => irv(p, c).order.map((x, i) => [x, i === 0 ? "winner" : `out in round ${c.length - i}`]) },
};

for (const root of document.querySelectorAll("[data-pol-arrow]")) {
  const prof = root.querySelector("[data-profile]");
  const rank = root.querySelector("[data-ranking]");
  const drop = root.querySelector("[data-drop]");
  const label = drop.parentElement;
  const o = outs(root);
  let rule = "plurality";
  root.addEventListener("seg-change", (e) => { rule = e.detail.value; drop.checked = false; draw(); });
  drop.addEventListener("change", draw);

  function social(r, removed) {
    const cands = ["A", "B", "C"].filter((c) => c !== removed);
    const profile = restrict(r.profile.map(([n, o2]) => ({ n, order: o2.split(">") })), cands);
    return r.rank(profile, cands);
  }

  function draw() {
    const r = ARROW[rule];
    label.lastChild.textContent = ` Remove ${r.drop}`;
    prof.replaceChildren(...r.profile.map(([n, ord]) => {
      const li = node("li", "flex gap-2");
      li.append(node("span", "w-8 text-right text-muted-foreground tabular-nums", String(n)));
      const shown = drop.checked ? ord.split(">").filter((c) => c !== r.drop).join(" > ") : ord.split(">").join(" > ");
      li.append(node("span", "", shown));
      return li;
    }));
    const before = social(r, null).map((x) => x[0]);
    const after = social(r, drop.checked ? r.drop : null);
    rank.replaceChildren(...after.map(([c, why], i) => {
      const li = node("li", "flex items-baseline gap-2");
      li.append(node("span", "w-4 text-muted-foreground", `${i + 1}.`), node("span", "font-medium", c), node("span", "text-[11px] text-muted-foreground", why));
      return li;
    }));
    const [x, y] = before.filter((c) => c !== r.drop);
    const flipped = after.findIndex((a) => a[0] === x) > after.findIndex((a) => a[0] === y);
    o.verdict.className = `rounded-lg border px-3 py-2 text-sm ${drop.checked && flipped ? "border-del/40 bg-del/8" : ""}`;
    o.verdict.textContent = !drop.checked
      ? `With all three candidates, society ranks ${x} above ${y}. Now remove ${r.drop}, who is not ${x} or ${y}.`
      : flipped
        ? `Removing ${r.drop} flipped ${x} and ${y}: no voter changed their mind about ${x} versus ${y}, yet the rule did. Independence of irrelevant alternatives fails.`
        : `${x} still ranks above ${y}.`;
  }
  draw();
}

// ============================================================ P4 spatial

for (const root of document.querySelectorAll("[data-pol-spatial]")) {
  const svg = root.querySelector("[data-plane]");
  const lineSvg = root.querySelector("[data-line]");
  const sharesEl = root.querySelector("[data-shares]");
  const o = outs(root);
  const W = 420, H = 320, PAD = 20;
  let seed = 3, voters = [], n = 3, anim = 0;
  const DEFAULTS = [[0.3, 0.55], [0.5, 0.5], [0.72, 0.45], [0.5, 0.2]];
  let cands = DEFAULTS.slice(0, n).map((p) => [...p]);
  let line = [0.2, 0.85];
  const sx = (x) => PAD + x * (W - 2 * PAD), sy = (y) => H - PAD - y * (H - 2 * PAD);

  function makeVoters() {
    const rng = mulberry32(seed);
    voters = Array.from({ length: 400 }, (_, i) => {
      const [mx, my] = i % 5 < 3 ? [0.35, 0.55] : [0.68, 0.4];
      return [Math.min(1, Math.max(0, mx + 0.14 * gauss(rng))), Math.min(1, Math.max(0, my + 0.14 * gauss(rng)))];
    });
  }
  const nearest = (v, cs) => cs.reduce((bi, c, i) => (Math.hypot(v[0] - c[0], v[1] - c[1]) < Math.hypot(v[0] - cs[bi][0], v[1] - cs[bi][1]) ? i : bi), 0);

  function draw() {
    svg.replaceChildren();
    el("rect", { x: PAD, y: PAD, width: W - 2 * PAD, height: H - 2 * PAD, style: "fill:none;stroke:currentColor;stroke-opacity:0.15" }, svg);
    text(svg, W / 2, H - 4, "economic axis →", { "text-anchor": "middle" });
    text(svg, 6, H / 2, "social axis ↑", { transform: `rotate(-90 6 ${H / 2})`, "text-anchor": "middle" });
    const counts = cands.map(() => 0);
    for (const v of voters) {
      const k = nearest(v, cands);
      counts[k]++;
      el("circle", { cx: sx(v[0]), cy: sy(v[1]), r: 2.2, style: `fill:${COLORS[k]};fill-opacity:0.55` }, svg);
    }
    cands.forEach((c, i) => {
      const g = el("g", { tabindex: 0, role: "slider", "aria-label": `Candidate ${"ABCD"[i]}`, "data-cand": i, class: "cursor-grab outline-none" }, svg);
      el("circle", { cx: sx(c[0]), cy: sy(c[1]), r: 12, style: `fill:var(--background);stroke:${COLORS[i]};stroke-width:2.5` }, g);
      text(g, sx(c[0]), sy(c[1]) + 4, "ABCD"[i], { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px] pointer-events-none" });
    });
    // Shares.
    sharesEl.replaceChildren();
    counts.forEach((c, i) => {
      const row = node("div", "flex items-center gap-2 text-xs");
      row.append(node("span", "w-4 font-mono", "ABCD"[i]));
      const bar = node("div", "h-2 flex-1 overflow-hidden rounded-full bg-foreground/8");
      const fill = node("div", "h-full rounded-full");
      fill.style.width = `${(100 * c) / voters.length}%`;
      fill.style.background = COLORS[i];
      bar.append(fill);
      row.append(bar, node("span", "w-12 text-right font-mono tabular-nums", pct(c / voters.length)));
      sharesEl.append(row);
    });
    const plur = counts.indexOf(Math.max(...counts));
    o.plurality.textContent = `${"ABCD"[plur]} (${pct(counts[plur] / voters.length)})`;
    // Condorcet: pairwise by distance.
    const beats = (a, b) => voters.filter((v) => Math.hypot(v[0] - cands[a][0], v[1] - cands[a][1]) < Math.hypot(v[0] - cands[b][0], v[1] - cands[b][1])).length * 2 > voters.length;
    const cw = cands.findIndex((_, a) => cands.every((_, b) => a === b || beats(a, b)));
    o.condorcet.textContent = cw < 0 ? "none" : "ABCD"[cw];
    drawLine();
  }

  function drawLine() {
    lineSvg.replaceChildren();
    const xs = voters.map((v) => v[0]).sort((a, b) => a - b);
    const med = (xs[199] + xs[200]) / 2;
    const lx = (x) => PAD + x * (W - 2 * PAD);
    el("line", { x1: lx(0), x2: lx(1), y1: 50, y2: 50, style: "stroke:currentColor;stroke-opacity:0.3" }, lineSvg);
    // Histogram of positions.
    const bins = new Array(40).fill(0);
    xs.forEach((x) => bins[Math.min(39, Math.floor(x * 40))]++);
    const top = Math.max(...bins);
    bins.forEach((b, i) => el("rect", { x: lx(i / 40) + 0.5, y: 50 - (28 * b) / top, width: (W - 2 * PAD) / 40 - 1, height: (28 * b) / top, style: "fill:currentColor;fill-opacity:0.12" }, lineSvg));
    el("line", { x1: lx(med), x2: lx(med), y1: 16, y2: 58, style: "stroke:currentColor;stroke-dasharray:3 3" }, lineSvg);
    text(lineSvg, lx(med), 12, "median", { "text-anchor": "middle" });
    const votesL = xs.filter((x) => Math.abs(x - line[0]) < Math.abs(x - line[1])).length;
    line.forEach((x, i) => {
      const g = el("g", { tabindex: 0, role: "slider", "aria-label": `1D candidate ${i ? "R" : "L"}`, "data-line": i, class: "cursor-grab outline-none" }, lineSvg);
      el("circle", { cx: lx(x), cy: 66, r: 9, style: `fill:var(--background);stroke:${COLORS[i]};stroke-width:2.5` }, g);
      text(g, lx(x), 70, i ? "R" : "L", { "text-anchor": "middle", class: "fill-foreground font-mono text-[10px] pointer-events-none" });
    });
    text(lineSvg, PAD, 88, `L ${pct(votesL / 400)} · R ${pct(1 - votesL / 400)}`);
    o.median.textContent = votesL === 200 ? "tie" : votesL > 200 ? "L" : "R";
  }

  // Dragging and keys, for both plots.
  function drag(svgEl, kind) {
    let active = null;
    const toUnit = (e) => {
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      return [(p.x - PAD) / (W - 2 * PAD), kind === "plane" ? (H - PAD - p.y) / (H - 2 * PAD) : 0];
    };
    const clamp = (v) => Math.min(1, Math.max(0, v));
    svgEl.addEventListener("pointerdown", (e) => {
      const g = e.target.closest(kind === "plane" ? "[data-cand]" : "[data-line]");
      if (!g) return;
      active = Number(kind === "plane" ? g.dataset.cand : g.dataset.line);
      svgEl.setPointerCapture(e.pointerId);
    });
    svgEl.addEventListener("pointermove", (e) => {
      if (active === null) return;
      const [x, y] = toUnit(e);
      if (kind === "plane") cands[active] = [clamp(x), clamp(y)]; else line[active] = clamp(x);
      draw();
    });
    const end = () => (active = null);
    svgEl.addEventListener("pointerup", end);
    svgEl.addEventListener("pointercancel", end);
    svgEl.addEventListener("keydown", (e) => {
      const g = e.target.closest(kind === "plane" ? "[data-cand]" : "[data-line]");
      const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key];
      if (!g || !d) return;
      e.preventDefault();
      const i = Number(kind === "plane" ? g.dataset.cand : g.dataset.line);
      if (kind === "plane") cands[i] = [clamp(cands[i][0] + d[0]), clamp(cands[i][1] + d[1])]; else line[i] = clamp(line[i] + d[0]);
      draw();
      svgEl.querySelector(kind === "plane" ? `[data-cand="${i}"]` : `[data-line="${i}"]`)?.focus();
    });
  }
  drag(svg, "plane");
  drag(lineSvg, "line");

  root.addEventListener("seg-change", (e) => {
    n = Number(e.detail.value);
    cands = DEFAULTS.slice(0, n).map((p) => [...p]);
    draw();
  });
  root.querySelector("[data-action=reseed]").addEventListener("click", () => { seed++; makeVoters(); draw(); });
  root.querySelector("[data-action=converge]").addEventListener("click", () => {
    cancelAnimationFrame(anim);
    const xs = voters.map((v) => v[0]).sort((a, b) => a - b);
    const med = (xs[199] + xs[200]) / 2;
    const target = [med - 0.01, med + 0.01];
    if (reduced()) { line = target; draw(); return; }
    const from = [...line], t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 900);
      const k = 1 - Math.pow(1 - t, 3);
      line = from.map((x, i) => x + (target[i] - x) * k);
      drawLine();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  });
  makeVoters();
  draw();
}

// ============================================================ P5 strategic voting

for (const root of document.querySelectorAll("[data-pol-strategic]")) {
  const roundsEl = root.querySelector("[data-rounds]");
  const o = outs(root);
  let mode = "irv";
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });

  function bars(title, t, alive, out) {
    const box = node("div", "flex flex-col gap-1.5 rounded-lg border bg-code p-3");
    box.append(node("span", "font-mono text-[11px] text-muted-foreground", title));
    const total = alive.reduce((a, c) => a + t[c], 0);
    for (const c of alive) {
      const row = node("div", "flex items-center gap-2 text-xs");
      row.append(node("span", "w-4 font-mono", c));
      const bar = node("div", "h-2 flex-1 overflow-hidden rounded-full bg-foreground/8");
      const f = node("div", "h-full rounded-full");
      f.style.width = `${(100 * t[c]) / total}%`;
      f.style.background = COLORS["ABC".indexOf(c)];
      if (c === out) f.style.opacity = "0.4";
      bar.append(f);
      row.append(bar, node("span", "w-10 text-right font-mono tabular-nums", String(t[c])));
      if (c === out) row.append(node("span", "text-[10px] text-del", "out"));
      box.append(row);
    }
    return box;
  }

  function draw() {
    const d = Math.round(s.defect.get());
    const profile = [
      { n: 40 - d, order: ["A", "B", "C"] },
      { n: d, order: ["B", "A", "C"] },
      { n: 35, order: ["C", "B", "A"] },
      { n: 25, order: ["B", "C", "A"] },
    ].filter((b) => b.n > 0);
    const cands = ["A", "B", "C"];
    roundsEl.replaceChildren();
    let winner;
    if (mode === "irv") {
      const r = irv(profile, cands);
      r.rounds.forEach((t, i) => {
        const alive = t._alive;
        const total = alive.reduce((a, c) => a + t[c], 0);
        const top = best(alive, (c) => t[c]);
        const out = t[top] * 2 > total ? null : alive.reduce((w, c) => (t[c] < t[w] || (t[c] === t[w] && c > w) ? c : w), alive[0]);
        roundsEl.append(bars(`Round ${i + 1}`, t, alive, out));
      });
      winner = r.winner;
    } else {
      const t = plurality(profile, cands);
      roundsEl.append(bars("First choices", t, cands, null));
      winner = best(cands, (c) => t[c]);
    }
    const honest = mode === "irv" ? "C" : "A";
    const pref = { A: 3, B: 2, C: 1 }; // the A voters' sincere ranking
    o.verdict.textContent = d === 0
      ? `Honest ballots elect ${winner}${winner === "C" ? ", the A voters' last choice" : ""}.`
      : winner === honest
        ? `${d} A voters ranked B first, but ${winner} still wins.`
        : pref[winner] > pref[honest]
          ? `${d} A voters ranked B first and ${winner} wins: by voting insincerely they got a result they prefer.`
          : `${d} A voters ranked B first and ${winner} wins: the defection backfired on them.`;
  }
  draw();
}

// ============================================================ P6 apportionment
// Exact: quotients are compared as fractions with BigInt.

function divisorMethod(votes, seats, div) {
  const alloc = votes.map(() => 0);
  for (let s = 0; s < seats; s++) {
    let bi = -1;
    for (let i = 0; i < votes.length; i++) {
      if (votes[i] <= 0n) continue;
      if (bi < 0) { bi = i; continue; }
      // votes[i]/div(alloc[i]) > votes[bi]/div(alloc[bi]) as fractions [num, den].
      const [ni, di] = div(alloc[i]), [nb, db] = div(alloc[bi]);
      const lhs = votes[i] * di * nb, rhs = votes[bi] * db * ni;
      if (lhs > rhs || (lhs === rhs && votes[i] > votes[bi])) bi = i;
    }
    if (bi < 0) break;
    alloc[bi]++;
  }
  return alloc;
}

// Divisors as fractions [num, den] meaning num/den.
const DHONDT = (k) => [BigInt(k + 1), 1n];
const WEBSTER = (k) => [BigInt(2 * k + 1), 2n];

function hamilton(votes, seats) {
  const total = votes.reduce((a, b) => a + b, 0n);
  if (total === 0n) return votes.map(() => 0);
  const S = BigInt(seats);
  const alloc = votes.map((v) => Number((v * S) / total));
  const rem = votes.map((v, i) => ({ i, r: (v * S) % total, v }));
  let left = seats - alloc.reduce((a, b) => a + b, 0);
  rem.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : b.v > a.v ? 1 : b.v < a.v ? -1 : 0));
  for (const { i, v } of rem) { if (left <= 0) break; if (v > 0n) { alloc[i]++; left--; } }
  return alloc;
}

// Huntington–Hill: everyone with votes starts at 1 seat; priority v/√(n(n+1)),
// compared through squares to stay exact.
function hill(votes, seats) {
  const eligible = votes.filter((v) => v > 0n).length;
  if (seats < eligible) return null;
  const alloc = votes.map((v) => (v > 0n ? 1 : 0));
  for (let s = eligible; s < seats; s++) {
    let bi = -1;
    for (let i = 0; i < votes.length; i++) {
      if (votes[i] <= 0n) continue;
      if (bi < 0) { bi = i; continue; }
      const a = BigInt(alloc[i]), b = BigInt(alloc[bi]);
      const lhs = votes[i] * votes[i] * b * (b + 1n), rhs = votes[bi] * votes[bi] * a * (a + 1n);
      if (lhs > rhs || (lhs === rhs && votes[i] > votes[bi])) bi = i;
    }
    alloc[bi]++;
  }
  return alloc;
}

for (const root of document.querySelectorAll("[data-pol-apportion]")) {
  const rows = [...root.querySelectorAll("[data-party]")];
  const bars = root.querySelector("[data-bars]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  rows.forEach((r) => r.querySelector("[data-votes]").addEventListener("input", draw));

  function draw() {
    const raw = rows.map((r) => BigInt(Math.max(0, Math.round(Number(r.querySelector("[data-votes]").value) || 0))));
    const total = raw.reduce((a, b) => a + b, 0n);
    const seats = Math.round(s.seats.get());
    const th = s.threshold.get() / 100;
    const shares = raw.map((v) => (total ? Number(v) / Number(total) : 0));
    const votes = raw.map((v, i) => (shares[i] >= th ? v : 0n));
    const res = {
      hamilton: hamilton(votes, seats),
      dhondt: divisorMethod(votes, seats, DHONDT),
      webster: divisorMethod(votes, seats, WEBSTER),
      hill: hill(votes, seats),
    };
    rows.forEach((r, i) => {
      r.querySelector("[data-share]").textContent = pct(shares[i]);
      r.classList.toggle("opacity-50", votes[i] === 0n && raw[i] > 0n);
      for (const k of Object.keys(res)) r.querySelector(`[data-m=${k}]`).textContent = res[k] ? String(res[k][i]) : "—";
    });
    // Gallagher least-squares index for Sainte-Laguë.
    const lsq = Math.sqrt(0.5 * shares.reduce((a, v, i) => a + (100 * v - (100 * res.webster[i]) / seats) ** 2, 0));
    o.lsq.textContent = num(lsq, 2);
    const wasted = shares.reduce((a, v, i) => a + (votes[i] === 0n ? v : 0), 0);
    o.wasted.textContent = pct(wasted);

    bars.replaceChildren();
    const methods = [["votes", null], ["Hamilton", "hamilton"], ["D'Hondt", "dhondt"], ["S-Laguë", "webster"], ["H-Hill", "hill"]];
    const W = 560, L = 70, BW = W - L - 10, RH = 22;
    methods.forEach(([label, key], j) => {
      const y = 8 + j * (RH + 6);
      text(bars, L - 8, y + RH / 2 + 3, label, { "text-anchor": "end" });
      let x = L;
      const parts = key ? (res[key] ?? []).map((n) => n / seats) : shares;
      if (key && !res[key]) { text(bars, L, y + RH / 2 + 3, "needs a seat per party"); return; }
      parts.forEach((f, i) => {
        if (f <= 0) return;
        el("rect", { x: x + 0.5, y, width: Math.max(0, f * BW - 1), height: RH, rx: 3, style: `fill:${COLORS[i]};fill-opacity:${key ? 0.85 : 0.45}` }, bars);
        if (f * BW > 26) text(bars, x + (f * BW) / 2, y + RH / 2 + 3, key ? String(res[key][i]) : pct(f, 0), { "text-anchor": "middle", class: "fill-background font-mono text-[10px]" });
        x += f * BW;
      });
    });
  }
  draw();
}

// ============================================================ P7 Alabama paradox

for (const root of document.querySelectorAll("[data-pol-alabama]")) {
  const svg = root.querySelector("[data-chart]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  const s = scrubAll(root, draw);
  const names = ["A", "B", "C"];

  function draw() {
    const pops = ["pa", "pb", "pc"].map((k) => BigInt(Math.round(s[k].get())));
    const house = Math.round(s.house.get());
    const H0 = 3, H1 = 30;
    const series = [];
    for (let hs = H0; hs <= H1; hs++) series.push(hamilton(pops, hs));
    const paradoxes = [];
    for (let hs = H0 + 1; hs <= H1; hs++) {
      names.forEach((nm, i) => {
        if (series[hs - H0][i] < series[hs - H0 - 1][i]) paradoxes.push({ hs, i });
      });
    }
    svg.replaceChildren();
    const maxSeats = Math.max(...series.flat());
    const f = frame(svg, { box: [36, 12, 390, 196], x: [H0, H1], y: [0, maxSeats + 1], xticks: [5, 10, 15, 20, 25, 30], yticks: [0, Math.ceil((maxSeats + 1) / 2), maxSeats + 1], xlabel: "house size", ylabel: "seats" });
    names.forEach((_, i) => {
      const pts = [];
      series.forEach((a, k) => { const x = H0 + k; pts.push([f.sx(x - 0.5), f.sy(a[i])], [f.sx(x + 0.5), f.sy(a[i])]); });
      polyline(svg, pts, `stroke:${COLORS[i]};stroke-width:1.75`);
    });
    el("line", { x1: f.sx(house), x2: f.sx(house), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.4;stroke-dasharray:3 3" }, svg);
    for (const p of paradoxes) el("circle", { cx: f.sx(p.hs - 0.5), cy: f.sy((series[p.hs - H0][p.i] + series[p.hs - H0 - 1][p.i]) / 2), r: 7, style: "fill:none;stroke:var(--code-del);stroke-width:2" }, svg);
    names.forEach((nm, i) => text(svg, f.L + 6 + i * 52, f.T + 10, `■ ${nm}`, { style: `fill:${COLORS[i]}` }));

    // Table around the chosen house size.
    const total = pops.reduce((a, b) => a + b, 0n);
    table.replaceChildren();
    const t = node("table", "w-full min-w-[420px] text-sm");
    const head = node("tr", "border-b text-left text-xs text-muted-foreground");
    ["State", "Population", `Quota at ${house}`, `${house - 1} seats`, `${house} seats`, `${house + 1} seats`].forEach((c, k) => head.append(node("th", `py-1.5 pr-3 font-normal ${k ? "text-right" : ""}`, c)));
    t.append(head);
    const at = (hs) => (hs >= H0 && hs <= H1 ? series[hs - H0] : hamilton(pops, hs));
    names.forEach((nm, i) => {
      const tr = node("tr", "border-b last:border-b-0 font-mono");
      const q = total ? (Number(pops[i]) * house) / Number(total) : 0;
      const prev = at(house - 1)[i], cur = at(house)[i], next = at(house + 1)[i];
      [nm, pops[i].toLocaleString("en"), num(q, 3), String(prev), String(cur), String(next)].forEach((c, k) => {
        const td = node("td", `py-1.5 pr-3 tabular-nums ${k ? "text-right" : "font-sans"}`, c);
        if ((k === 4 && cur < prev) || (k === 5 && next < cur)) td.classList.add("text-del", "font-semibold");
        tr.append(td);
      });
      t.append(tr);
    });
    table.append(t);
    o.verdict.textContent = paradoxes.length
      ? `Alabama paradox: ${paradoxes.map((p) => `state ${names[p.i]} drops from ${series[p.hs - H0 - 1][p.i]} to ${series[p.hs - H0][p.i]} seats when the house grows from ${p.hs - 1} to ${p.hs}`).slice(0, 3).join("; ")}${paradoxes.length > 3 ? `; and ${paradoxes.length - 3} more` : ""}.`
      : "No paradox for these populations between 3 and 30 seats.";
  }
  draw();
}

// ============================================================ P8 gerrymandering

const GERRY_PINK = 64, GERRY_BLUE = 40; // pink voters (of 100) in pink / blue cells

function gerryPreset(name) {
  const d = new Array(64);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (name === "columns") d[r * 8 + c] = c;
    else if (name === "rows") d[r * 8 + c] = r;
  }
  if (name === "packed") {
    for (let r = 0; r < 8; r++) { d[r * 8] = 0; d[r * 8 + 1] = 1; }
    // Rows 0–3 and 4–7 of columns 2–7, each split into three districts with
    // at most three pink cells, so blue wins all six while pink fills two.
    const blocks = [
      [[0, 2], [0, 3], [1, 2], [0, 4], [0, 5], [0, 6], [0, 7], [1, 7]],
      [[1, 3], [2, 3], [2, 2], [1, 4], [1, 5], [1, 6], [2, 4], [2, 5]],
      [[2, 6], [2, 7], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7]],
    ];
    [0, 4].forEach((off, half) => blocks.forEach((cells, k) => cells.forEach(([r, c]) => (d[(r + off) * 8 + c] = 2 + half * 3 + k))));
  }
  return d;
}

for (const root of document.querySelectorAll("[data-pol-gerry]")) {
  const grid = root.querySelector("[data-grid]");
  const list = root.querySelector("[data-districts]");
  const o = outs(root);
  const pink = Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? GERRY_PINK : GERRY_BLUE));
  let district = gerryPreset("columns");
  let brush = 0;
  const cells = pink.map((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.cell = i;
    b.title = `${p} pink, ${100 - p} blue voters`;
    b.className = "relative flex items-center justify-center font-mono text-[10px] outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring";
    b.style.background = p > 50 ? "color-mix(in oklab, var(--brand) 26%, var(--background))" : "color-mix(in oklab, var(--vec-u) 26%, var(--background))";
    grid.append(b);
    return b;
  });

  grid.addEventListener("pointerdown", (e) => paint(e));
  grid.addEventListener("pointerover", (e) => { if (e.buttons === 1) paint(e); });
  grid.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); paint(e); } });
  function paint(e) {
    const c = e.target.closest("[data-cell]");
    if (!c) return;
    district[Number(c.dataset.cell)] = brush;
    draw();
  }
  root.querySelector("[data-palette]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-district]");
    if (!b) return;
    brush = Number(b.dataset.district);
    root.querySelectorAll("[data-district]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
  root.addEventListener("seg-change", (e) => { district = gerryPreset(e.detail.value); draw(); });

  function contiguous(ids) {
    if (!ids.length) return false;
    const set = new Set(ids), seen = new Set([ids[0]]), q = [ids[0]];
    while (q.length) {
      const i = q.pop(), r = Math.floor(i / 8), c = i % 8;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc, j = rr * 8 + cc;
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
    return seen.size === ids.length;
  }

  function draw() {
    const res = [];
    let wastedP = 0, wastedB = 0, seatsP = 0, seatsB = 0, ok = true, ties = 0;
    for (let d = 0; d < 8; d++) {
      const ids = district.map((x, i) => (x === d ? i : -1)).filter((i) => i >= 0);
      const p = ids.reduce((a, i) => a + pink[i], 0), b = ids.length * 100 - p;
      const valid = ids.length === 8 && contiguous(ids);
      if (!valid) ok = false;
      const need = Math.floor((p + b) / 2) + 1;
      let win = p > b ? "pink" : b > p ? "blue" : "tie";
      if (win === "pink") { seatsP++; wastedP += p - need; wastedB += b; }
      else if (win === "blue") { seatsB++; wastedB += b - need; wastedP += p; }
      else ties++;
      res.push({ d, ids, p, b, valid, win });
    }
    cells.forEach((c, i) => {
      const d = district[i];
      c.textContent = String(d + 1);
      const r = Math.floor(i / 8), col = i % 8;
      const edge = (rr, cc) => rr < 0 || rr > 7 || cc < 0 || cc > 7 || district[rr * 8 + cc] !== d;
      const w = (x) => (x ? "2px" : "0px");
      c.style.boxShadow = `inset 0 ${w(edge(r - 1, col))} 0 currentColor, inset ${"-" + w(edge(r, col + 1))} 0 0 currentColor, inset 0 ${"-" + w(edge(r + 1, col))} 0 currentColor, inset ${w(edge(r, col - 1))} 0 0 currentColor`;
      c.style.color = res[d].valid ? "color-mix(in oklab, var(--foreground) 70%, transparent)" : "var(--code-del)";
      c.setAttribute("aria-label", `Cell ${r + 1},${col + 1}: district ${d + 1}, ${pink[i]} pink voters`);
    });
    list.replaceChildren(...res.map((x) => {
      const row = node("div", "flex items-center gap-2");
      row.append(node("span", "w-5 text-muted-foreground", String(x.d + 1)));
      const tag = node("span", `w-12 ${x.win === "pink" ? "text-brand" : x.win === "blue" ? "text-vec-u" : "text-muted-foreground"}`, x.win);
      row.append(tag, node("span", "tabular-nums text-muted-foreground", `${x.p} – ${x.b}`));
      if (!x.valid) row.append(node("span", "text-del", x.ids.length !== 8 ? `${x.ids.length} cells` : "split"));
      return row;
    }));
    const total = 6400;
    const pinkVotes = pink.reduce((a, b) => a + b, 0);
    o.votes.textContent = `pink ${pct(pinkVotes / total)} · blue ${pct(1 - pinkVotes / total)}`;
    o.seats.textContent = `pink ${seatsP} · blue ${seatsB}${ties ? ` · ${ties} tied` : ""}`;
    const gap = (wastedP - wastedB) / total;
    o.gap.textContent = `${pct(Math.abs(gap))} ${gap > 0 ? "against pink" : gap < 0 ? "against blue" : ""}`;
    o.valid.textContent = ok ? "valid: 8 contiguous districts of 8" : "invalid: fix the red districts";
    o.valid.className = ok ? "text-add" : "text-del";
  }
  draw();
}

// Exposed for checks: the efficiency gap of a list of [pink, blue] districts.
export function efficiencyGap(districts) {
  let wp = 0, wb = 0, total = 0;
  for (const [p, b] of districts) {
    const need = Math.floor((p + b) / 2) + 1;
    total += p + b;
    if (p > b) { wp += p - need; wb += b; } else { wb += b - need; wp += p; }
  }
  return (wp - wb) / total;
}

// ============================================================ P9 polling

const Z = { 90: 1.6449, 95: 1.96, 99: 2.5758 };

for (const root of document.querySelectorAll("[data-pol-polling]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let conf = 95;
  const s = scrubAll(root, draw);
  root.addEventListener("seg-change", (e) => { conf = Number(e.detail.value); draw(); });

  function draw() {
    const n = s.n.get(), p1 = s.p1.get() / 100, p2 = s.p2.get() / 100, deff = s.deff.get(), z = Z[conf];
    const neff = n / deff;
    const moe = (p, m) => z * Math.sqrt((p * (1 - p)) / m);
    const moeLead = (m) => z * Math.sqrt((p1 + p2 - (p1 - p2) ** 2) / m);
    o.neff.textContent = Math.round(neff).toLocaleString("en");
    o.moe1.textContent = `± ${num(100 * moe(p1, neff), 1)} pts`;
    o.lead.textContent = `${num(100 * (p1 - p2), 1)} pts`;
    o.moelead.textContent = `± ${num(100 * moeLead(neff), 1)} pts`;
    const sig = Math.abs(p1 - p2) > moeLead(neff);
    o.verdict.textContent = p1 + p2 > 1 ? "shares exceed 100%" : sig ? `lead beyond the ${conf}% margin` : "within the margin";
    o.verdict.className = sig ? "text-add" : "text-muted-foreground";
    o.need.textContent = Math.ceil((z * z * p1 * (1 - p1) * deff) / 0.02 ** 2).toLocaleString("en");

    svg.replaceChildren();
    const lx = (v) => Math.log10(v);
    const f = frame(svg, { box: [44, 14, 500, 240], x: [lx(50), lx(20000)], y: [0, 15], xticks: [2, 3, 4].map((e) => e), yticks: [0, 5, 10, 15], xfmt: (v) => (10 ** v).toLocaleString("en"), yfmt: (v) => `±${v}`, xlabel: "sample size (log)", ylabel: "points" });
    const pts = (fn) => Array.from({ length: 121 }, (_, i) => { const nn = 50 * (20000 / 50) ** (i / 120); return [f.sx(lx(nn)), f.sy(Math.min(15, 100 * fn(nn / deff)))]; });
    polyline(svg, pts((m) => moe(p1, m)), "stroke:var(--vec-u);stroke-width:2");
    polyline(svg, pts((m) => moeLead(m)), "stroke:var(--brand);stroke-width:2");
    el("line", { x1: f.sx(lx(n)), x2: f.sx(lx(n)), y1: f.T, y2: f.T + f.H, style: "stroke:currentColor;stroke-opacity:0.35;stroke-dasharray:3 3" }, svg);
    el("circle", { cx: f.sx(lx(n)), cy: f.sy(Math.min(15, 100 * moe(p1, neff))), r: 4, style: "fill:var(--vec-u)" }, svg);
    el("circle", { cx: f.sx(lx(n)), cy: f.sy(Math.min(15, 100 * moeLead(neff))), r: 4, style: "fill:var(--brand)" }, svg);
    text(svg, f.L + f.W, f.T + 10, "■ margin of one share", { "text-anchor": "end", style: "fill:var(--vec-u)" });
    text(svg, f.L + f.W, f.T + 24, "■ margin of the lead", { "text-anchor": "end", style: "fill:var(--brand)" });
  }
  draw();
}

// ============================================================ P10 stepper

for (const root of document.querySelectorAll("[data-pol-systems]")) {
  const steps = [...root.querySelectorAll("[data-step]")];
  const pips = [...root.querySelectorAll("[data-pip]")];
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => (s.hidden = k !== at));
    pips.forEach((p, k) => p.toggleAttribute("data-on", k <= at));
    back.disabled = at === 0;
    next.disabled = at === steps.length - 1;
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: steps.length - 1 }[e.key];
    if (to === undefined || e.target.closest("button,input")) return;
    e.preventDefault();
    go(to);
  });
}
