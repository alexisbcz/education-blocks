// Blockchain blocks, part three: coins as unspent outputs, forks under
// network delay, and an escrow contract run as a state machine with gas.

import { scrubAll } from "./scrub.js";
import { el, text, num } from "./plot.js";
import { outs, mk, hashSpan, mulberry32, sha256 } from "./ledger-util.js";

const sat = (v) => `${Math.round(v).toLocaleString("en-US")} sat`;

// ============================================================ UTXO

for (const root of document.querySelectorAll("[data-ledger-utxo]")) {
  const coinBox = root.querySelector("[data-coins]");
  const log = root.querySelector("[data-log]");
  const o = outs(root);
  let coins, picked, last, txCount;
  const f = scrubAll(root, totals);

  function reset() {
    txCount = 0;
    coins = [5000, 3000, 12000, 800].map((value, i) => ({ id: sha256(`coinbase ${i}`).slice(0, 8) + ":0", value, owner: "Alice", spent: null }));
    picked = new Set();
    last = null;
    log.replaceChildren();
    entry("Alice starts with four unspent outputs from earlier payments.", "text-muted-foreground");
    render();
  }

  const entry = (s, cls = "") => {
    const li = mk("li", "rounded-md border bg-background px-2 py-1.5 " + cls);
    if (typeof s === "string") li.textContent = s; else li.append(...s);
    log.prepend(li);
  };

  function render() {
    coinBox.replaceChildren(...coins.filter((c) => c.owner === "Alice").map((c) => {
      const b = mk("button", "flex flex-col items-start gap-0.5 rounded-lg border bg-background px-3 py-2 text-left font-mono text-[11px] outline-none transition-[border-color,background-color,opacity] duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-45");
      b.type = "button";
      b.disabled = !!c.spent;
      b.setAttribute("aria-pressed", String(picked.has(c.id)));
      b.append(mk("span", "text-sm tabular-nums " + (c.spent ? "line-through" : ""), sat(c.value)), mk("span", "text-muted-foreground", c.spent ? `spent in ${c.spent.slice(0, 6)}…` : c.id));
      b.setAttribute("aria-label", `${sat(c.value)}, output ${c.id}${c.spent ? ", spent" : ""}`);
      b.addEventListener("click", () => { picked.has(c.id) ? picked.delete(c.id) : picked.add(c.id); render(); });
      return b;
    }));
    totals();
  }

  function totals() {
    const inputs = coins.filter((c) => picked.has(c.id));
    const sum = inputs.reduce((a, c) => a + c.value, 0);
    const pay = Math.round(f.pay.get()), fee = Math.round(f.fee.get());
    const change = sum - pay - fee;
    o.in.textContent = sat(sum);
    o.pay.textContent = sat(pay);
    o.fee.textContent = sat(fee);
    o.change.textContent = change >= 0 ? sat(change) : "—";
    o.status.className = "min-h-10 text-sm leading-relaxed " + (inputs.length && change < 0 ? "text-[var(--code-del)]" : "text-muted-foreground");
    o.status.textContent = !inputs.length ? "Pick one or more coins." : change < 0 ? `Inputs are ${sat(-change)} short: add a coin.` : change === 0 ? "Exact amount: no change output needed." : `Two outputs: ${sat(pay)} to Bob and ${sat(change)} back to Alice as change.`;
  }

  function broadcast(tx) {
    const spentIn = tx.inputs.map((id) => coins.find((c) => c.id === id)).find((c) => c.spent);
    if (spentIn) {
      entry([mk("span", "text-[var(--code-del)]", "rejected: "), document.createTextNode(`input ${spentIn.id} was already spent in `), hashSpan(spentIn.spent, 6), document.createTextNode(". Every node refuses a second spend of the same output.")], "border-[var(--code-del)]/40");
      return false;
    }
    tx.inputs.forEach((id) => (coins.find((c) => c.id === id).spent = tx.id));
    coins.push({ id: tx.id.slice(0, 8) + ":0", value: tx.pay, owner: "Bob", spent: null });
    if (tx.change > 0) coins.push({ id: tx.id.slice(0, 8) + ":1", value: tx.change, owner: "Alice", spent: null });
    entry([mk("span", "text-brand", "confirmed "), hashSpan(tx.id, 6), document.createTextNode(` · ${tx.inputs.length} in → ${sat(tx.pay)} to Bob${tx.change > 0 ? `, ${sat(tx.change)} change` : ""}, fee ${sat(tx.fee)}`)]);
    return true;
  }

  root.querySelector("[data-action=send]").addEventListener("click", () => {
    const inputs = [...picked];
    const sum = coins.filter((c) => picked.has(c.id)).reduce((a, c) => a + c.value, 0);
    const pay = Math.round(f.pay.get()), fee = Math.round(f.fee.get());
    if (!inputs.length || sum < pay + fee) { totals(); return; }
    const tx = { inputs, pay, fee, change: sum - pay - fee };
    tx.id = sha256(JSON.stringify(tx) + txCount++);
    if (broadcast(tx)) { last = tx; picked.clear(); render(); }
  });
  root.querySelector("[data-action=replay]").addEventListener("click", () => {
    if (!last) { entry("Nothing to replay yet: broadcast a payment first.", "text-muted-foreground"); return; }
    broadcast({ ...last, id: sha256(JSON.stringify(last) + "replay" + txCount++) });
    render();
  });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  reset();
}

// ============================================================ Forks

for (const root of document.querySelectorAll("[data-ledger-forks]")) {
  const svg = root.querySelector("[data-tree]");
  const o = outs(root);
  let seed = 11;
  const f = scrubAll(root, run);

  function simulate(d, T, N) {
    const rng = mulberry32(seed);
    const M = 5;
    const blocks = [{ id: 0, parent: -1, height: 0, t: 0, miner: -1 }];
    const seenAt = (b, m) => (b.miner === m || b.miner === -1 ? b.t : b.t + d);
    const tipOf = (m, t) => {
      let best = blocks[0], bestSeen = 0;
      for (const b of blocks) {
        const s = seenAt(b, m);
        if (s > t) continue;
        if (b.height > best.height || (b.height === best.height && s < bestSeen)) { best = b; bestSeen = s; }
      }
      return best;
    };
    let t = 0;
    for (let i = 1; i <= N; i++) {
      t += -Math.log(1 - rng()) * T;
      const m = Math.floor(rng() * M);
      const parent = tipOf(m, t);
      blocks.push({ id: i, parent: parent.id, height: parent.height + 1, t, miner: m });
    }
    // The main chain ends at the highest block, earliest found on ties.
    let head = blocks[0];
    for (const b of blocks) if (b.height > head.height) head = b;
    const main = new Set();
    for (let b = head; b; b = blocks[b.parent]) main.add(b.id);
    return { blocks, main, head };
  }

  function run() {
    const d = f.delay.get(), T = f.interval.get(), N = Math.round(f.blocks.get());
    const { blocks, main, head } = simulate(d, T, N);
    const orphans = blocks.filter((b) => !main.has(b.id));
    // Longest orphaned branch: orphans whose ancestors up to the main chain are orphans too.
    const depth = new Map();
    let deepest = 0;
    for (const b of blocks) {
      if (main.has(b.id)) continue;
      const dd = (depth.get(b.parent) ?? 0) + 1;
      depth.set(b.id, dd);
      deepest = Math.max(deepest, dd);
    }
    // Layout: one column per height, the main chain on row 0, orphans stacked.
    const cols = head.height + 1;
    const used = new Map();
    const row = new Map([[0, 0]]);
    for (const b of blocks) {
      if (b.id === 0) continue;
      if (main.has(b.id)) { row.set(b.id, 0); continue; }
      const want = row.get(b.parent) || 1;
      let r = want;
      while ((used.get(b.height) ?? new Set()).has(r)) r++;
      if (!used.has(b.height)) used.set(b.height, new Set());
      used.get(b.height).add(r);
      row.set(b.id, r);
    }
    const maxRow = Math.max(0, ...row.values());
    // Fit the whole tree in the width: columns shrink as the chain grows.
    const W = 640, DX = Math.min(26, (W - 30) / Math.max(1, cols)), B = Math.max(4, Math.min(16, DX * 0.72)), DY = Math.max(B + 8, 22);
    const H = Math.max(110, 64 + maxRow * DY);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const X = (b) => 14 + B / 2 + b.height * DX, Y = (b) => 38 + row.get(b.id) * DY;
    for (const b of blocks) {
      if (b.parent < 0) continue;
      const p = blocks[b.parent];
      const onMain = main.has(b.id);
      const x1 = X(p) + B / 2, x2 = X(b) - B / 2, mid = (x1 + x2) / 2;
      el("path", { d: `M${x1},${Y(p)} C${mid},${Y(p)} ${mid},${Y(b)} ${x2},${Y(b)}`, style: `fill:none;stroke:${onMain ? "var(--brand)" : "var(--code-del)"};stroke-opacity:${onMain ? 0.7 : 0.6};stroke-width:1.25` }, svg);
    }
    for (const b of blocks) {
      const onMain = main.has(b.id);
      const r = el("rect", { x: X(b) - B / 2, y: Y(b) - B / 2, width: B, height: B, rx: Math.min(3, B / 4), style: `fill:${onMain ? "var(--brand)" : "var(--background)"};fill-opacity:${onMain ? 0.85 : 1};stroke:${onMain ? "var(--brand)" : "var(--code-del)"};stroke-width:1.25` }, svg);
      el("title", {}, r).textContent = b.id === 0 ? "genesis" : `block ${b.id}, height ${b.height}, miner ${b.miner + 1}, t = ${Math.round(b.t)} s${onMain ? "" : ", orphaned"}`;
    }
    for (let hgt = 0; hgt <= head.height; hgt += 10) text(svg, 14 + B / 2 + hgt * DX, 18, String(hgt), { "text-anchor": "middle" });
    text(svg, W - 4, H - 6, "height →", { "text-anchor": "end" });

    const rate = orphans.length / N;
    o.rate.textContent = `${num(rate * 100, 1)}% (${orphans.length} of ${N})`;
    o.theory.textContent = `${num((1 - Math.exp(-d / T)) * 100, 1)}%`;
    o.height.textContent = String(head.height);
    o.reorg.textContent = deepest ? `${deepest} block${deepest > 1 ? "s" : ""}` : "none";
  }

  root.querySelector("[data-action=run]").addEventListener("click", () => { seed = (seed * 48271) % 2147483647; run(); });
  run();
}

// ============================================================ Escrow contract

for (const root of document.querySelectorAll("[data-ledger-escrow]")) {
  const svg = root.querySelector("[data-fsm]");
  const store = root.querySelector("[data-storage]");
  const log = root.querySelector("[data-log]");
  const o = outs(root);
  // Simplified, illustrative gas: a base cost per transaction, reads,
  // storage writes (the dearest), and value transfers.
  const GAS = { base: 21000, read: 2100, write: 20000, update: 5000, transfer: 9000 };
  const STATES = { Created: [50, 95], Funded: [195, 95], Shipped: [355, 95], Released: [530, 40], Refunded: [530, 152] };
  const EDGES = [
    ["Created", "Funded", "deposit"], ["Funded", "Shipped", "markShipped"], ["Shipped", "Released", "confirmDelivery"],
    ["Funded", "Refunded", "refund · after deadline"], ["Shipped", "Refunded", ""],
  ];
  let s, lastEdge, gasTotal;

  function reset() {
    s = { state: "Created", block: 100, deposit: 0, deadline: null, buyer: 250, seller: 0, contract: 0 };
    lastEdge = null;
    gasTotal = 0;
    log.replaceChildren(mk("li", "text-muted-foreground", "Deployed at block 100. No calls yet."));
    draw();
  }

  function call(who, fn, ok, apply) {
    // Every call reads the state slot; a failed require stops right there.
    let gas = GAS.base + GAS.read;
    const err = ok();
    const li = mk("li", "flex flex-wrap justify-between gap-x-3");
    if (err) {
      li.append(mk("span", "text-[var(--code-del)]", `#${s.block} ${who}.${fn} ✗ revert: ${err}`), mk("span", "text-muted-foreground tabular-nums", `${gas.toLocaleString("en-US")} gas`));
    } else {
      const from = s.state;
      gas += apply();
      lastEdge = [from, s.state];
      li.append(mk("span", "text-brand", `#${s.block} ${who}.${fn} ✓ ${from} → ${s.state}`), mk("span", "text-muted-foreground tabular-nums", `${gas.toLocaleString("en-US")} gas`));
    }
    gasTotal += gas;
    log.prepend(li);
    s.block += 1;
    draw();
  }

  const act = {
    deposit: () => call("buyer", "deposit(100)", () => (s.state !== "Created" ? `state is ${s.state}, not Created` : s.buyer < 100 ? "insufficient balance" : null), () => {
      s.buyer -= 100; s.contract += 100; s.deposit = 100; s.deadline = s.block + 30; s.state = "Funded";
      return GAS.write * 2 + GAS.update; // deposit, deadline, state
    }),
    ship: () => call("seller", "markShipped()", () => (s.state !== "Funded" ? `state is ${s.state}, not Funded` : null), () => { s.state = "Shipped"; return GAS.update; }),
    confirm: () => call("buyer", "confirmDelivery()", () => (s.state !== "Shipped" ? `state is ${s.state}, not Shipped` : null), () => {
      s.seller += s.contract; s.contract = 0; s.state = "Released";
      return GAS.update * 2 + GAS.transfer;
    }),
    refund: () => call("anyone", "refundAfterDeadline()", () => (s.state !== "Funded" && s.state !== "Shipped" ? `state is ${s.state}` : s.block <= s.deadline ? `deadline is block ${s.deadline}, now ${s.block}` : null), () => {
      s.buyer += s.contract; s.contract = 0; s.state = "Refunded";
      return GAS.read + GAS.update * 2 + GAS.transfer;
    }),
  };

  function draw() {
    svg.replaceChildren();
    const defs = el("defs", {}, svg);
    for (const [id, color] of [["ledger-arrow", "currentColor"], ["ledger-arrow-on", "var(--brand)"]]) {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0,0 L10,5 L0,10 z", style: `fill:${color}` }, m);
    }
    for (const [a, b, label] of EDGES) {
      const [x1, y1] = STATES[a], [x2, y2] = STATES[b];
      const on = lastEdge && lastEdge[0] === a && lastEdge[1] === b;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const sx = x1 + (dx / len) * 43, sy = y1 + (dy / len) * 17, ex = x2 - (dx / len) * 47, ey = y2 - (dy / len) * 18;
      const bend = a === "Funded" && b === "Refunded" ? `Q ${(sx + ex) / 2} ${Math.max(sy, ey) + 40} ${ex} ${ey}` : `L ${ex} ${ey}`;
      el("path", { d: `M ${sx} ${sy} ${bend}`, "marker-end": `url(#${on ? "ledger-arrow-on" : "ledger-arrow"})`, style: `fill:none;stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.35};stroke-width:${on ? 1.75 : 1.25}` }, svg);
      if (label) {
        const curved = a === "Funded" && b === "Refunded", diag = a === "Shipped" && b === "Released";
        const lx = curved ? (sx + ex) / 2 : diag ? (sx + ex) / 2 - 6 : (sx + ex) / 2;
        const ly = curved ? Math.max(sy, ey) + 30 : diag ? (sy + ey) / 2 - 6 : (sy + ey) / 2 - 7;
        text(svg, lx, ly, label, { "text-anchor": diag ? "end" : "middle", class: "font-mono text-[9px] " + (on ? "fill-brand" : "fill-muted-foreground") });
      }
    }
    for (const [name, [x, y]] of Object.entries(STATES)) {
      const on = s.state === name;
      el("rect", { x: x - 43, y: y - 17, width: 86, height: 34, rx: 8, style: `fill:${on ? "var(--brand)" : "var(--background)"};fill-opacity:${on ? 0.12 : 1};stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.3};stroke-width:${on ? 2 : 1}` }, svg);
      text(svg, x, y + 4, name, { "text-anchor": "middle", class: "font-mono text-[11px] " + (on ? "fill-brand" : "fill-foreground") });
    }
    const rows = [["state", s.state], ["deposit", s.deposit], ["deadline", s.deadline ?? "unset"], ["contract balance", s.contract], ["buyer wallet", s.buyer], ["seller wallet", s.seller]];
    store.replaceChildren(...rows.flatMap(([k, v]) => [mk("dt", "text-muted-foreground", k), mk("dd", "text-right", String(v))]));
    o.state.textContent = s.state;
    o.block.textContent = s.deadline && (s.state === "Funded" || s.state === "Shipped") ? `${s.block} (deadline ${s.deadline})` : String(s.block);
    o.gas.textContent = gasTotal.toLocaleString("en-US");
  }

  root.querySelector("[data-action=deposit]").addEventListener("click", act.deposit);
  root.querySelector("[data-action=ship]").addEventListener("click", act.ship);
  root.querySelector("[data-action=confirm]").addEventListener("click", act.confirm);
  root.querySelector("[data-action=refund]").addEventListener("click", act.refund);
  root.querySelector("[data-action=wait]").addEventListener("click", () => { s.block += 10; draw(); });
  root.querySelector("[data-action=reset]").addEventListener("click", reset);
  reset();
}
