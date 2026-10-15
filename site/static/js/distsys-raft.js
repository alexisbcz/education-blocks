// Raft, the core of it (Ongaro and Ousterhout, "In Search of an
// Understandable Consensus Algorithm", 2014): leader election with
// randomized timeouts, log replication with the AppendEntries consistency
// check, and the commit rule (majority, current term only). Left out:
// membership changes, snapshots and client sessions. Time is simulated in
// milliseconds; the network is a list of messages with random delays.

import { el, text } from "./plot.js";
import { reduced, outs, onToggle, onSeg, h, mulberry32 } from "./distsys-util.js";

const N = 5, MAJ = 3, HEARTBEAT = 50;
const TIMEOUT = [150, 300];
// Neighbouring terms get clearly different colours.
const TERM_COLORS = ["var(--vec-u)", "var(--ion-na)", "var(--vec-v)", "var(--ion-cl)", "var(--ion-k)", "var(--ion-ca)"];

for (const root of document.querySelectorAll("[data-ds-raft]")) {
  const svg = root.querySelector("[data-plot]");
  const logsEl = root.querySelector("[data-logs]");
  const o = outs(root);
  const playBtn = root.querySelector('[data-action="play"]');
  let rng, now, nodes, msgs, part, sel, speed = 0.15, playing = false, visible = false;
  let elections, leadersByTerm, writes, lastEvent, logVersion, drawnVersion;

  const C = [280, 150], RAD = 112;
  const pos = (i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return [C[0] + RAD * Math.cos(a), C[1] + RAD * Math.sin(a)];
  };
  const side = (i) => (part && i >= 2 ? 1 : 0);
  const reachable = (a, b) => side(a) === side(b);
  const name = (i) => `S${i + 1}`;
  const say = (s) => { lastEvent = s; o.event.textContent = s; };

  function resetDeadline(n) {
    n.timeoutLen = TIMEOUT[0] + rng() * (TIMEOUT[1] - TIMEOUT[0]);
    n.deadline = now + n.timeoutLen;
  }

  function reset() {
    rng = mulberry32(2014);
    now = 0;
    msgs = [];
    elections = 0;
    writes = 0;
    leadersByTerm = new Map();
    logVersion = 1; drawnVersion = 0;
    nodes = Array.from({ length: N }, (_, id) => {
      const n = { id, up: true, state: "follower", term: 0, votedFor: null, log: [], commit: 0, votes: new Set(), next: [], match: [], hbAt: 0, leaderId: null };
      resetDeadline(n);
      return n;
    });
    say("All five servers start as followers in term 0. The first one whose timer runs out becomes a candidate.");
    draw();
  }

  const lastIndex = (n) => n.log.length;
  const lastTerm = (n) => (n.log.length ? n.log[n.log.length - 1].term : 0);

  function send(from, to, m) {
    const delay = 10 + rng() * 20;
    msgs.push({ ...m, from, to, sent: now, arrive: now + delay, lost: !reachable(from, to) });
  }

  function stepDown(n, term) {
    if (term > n.term) { n.term = term; n.votedFor = null; }
    if (n.state !== "follower") logVersion++;
    n.state = "follower";
  }

  function startElection(n) {
    n.state = "candidate";
    n.term += 1;
    n.votedFor = n.id;
    n.votes = new Set([n.id]);
    n.leaderId = null;
    resetDeadline(n);
    elections++;
    logVersion++;
    say(`${name(n.id)} timed out: it becomes a candidate for term ${n.term}, votes for itself and asks the others.`);
    for (let j = 0; j < N; j++) if (j !== n.id) send(n.id, j, { type: "rv", term: n.term, lastIndex: lastIndex(n), lastTerm: lastTerm(n) });
  }

  function becomeLeader(n) {
    n.state = "leader";
    n.leaderId = n.id;
    for (let j = 0; j < N; j++) { n.next[j] = n.log.length + 1; n.match[j] = 0; }
    n.hbAt = now;
    if (!leadersByTerm.has(n.term)) leadersByTerm.set(n.term, new Set());
    leadersByTerm.get(n.term).add(n.id);
    logVersion++;
    say(`${name(n.id)} has votes from a majority (${[...n.votes].map(name).join(", ")}): it is leader for term ${n.term}.`);
  }

  function appendEntries(L, j) {
    const prev = L.next[j] - 1;
    send(L.id, j, { type: "ae", term: L.term, prev, prevTerm: prev > 0 ? L.log[prev - 1].term : 0, entries: L.log.slice(prev), commit: L.commit });
  }

  function advanceCommit(L) {
    for (let k = L.log.length; k > L.commit; k--) {
      if (L.log[k - 1].term !== L.term) break; // only entries from the current term commit by counting
      let c = 1;
      for (let j = 0; j < N; j++) if (j !== L.id && L.match[j] >= k) c++;
      if (c >= MAJ) {
        L.commit = k;
        logVersion++;
        say(`Entry ${k} is stored on a majority in term ${L.term}: ${name(L.id)} commits it, and every entry before it.`);
        break;
      }
    }
  }

  function deliver(m) {
    const n = nodes[m.to];
    if (!n.up || m.lost || !reachable(m.from, m.to)) return;
    if (m.term > n.term) stepDown(n, m.term);
    switch (m.type) {
      case "rv": {
        const upToDate = m.lastTerm > lastTerm(n) || (m.lastTerm === lastTerm(n) && m.lastIndex >= lastIndex(n));
        const grant = m.term === n.term && (n.votedFor === null || n.votedFor === m.from) && upToDate;
        if (grant) { n.votedFor = m.from; resetDeadline(n); }
        send(n.id, m.from, { type: "rvr", term: n.term, granted: grant });
        break;
      }
      case "rvr":
        if (n.state === "candidate" && m.term === n.term && m.granted) {
          n.votes.add(m.from);
          if (n.votes.size >= MAJ) becomeLeader(n);
        }
        break;
      case "ae": {
        if (m.term < n.term) { send(n.id, m.from, { type: "aer", term: n.term, ok: false, hint: n.log.length }); break; }
        if (n.state !== "follower") stepDown(n, m.term);
        n.leaderId = m.from;
        resetDeadline(n);
        if (m.prev > n.log.length || (m.prev > 0 && n.log[m.prev - 1].term !== m.prevTerm)) {
          send(n.id, m.from, { type: "aer", term: n.term, ok: false, hint: Math.min(n.log.length, m.prev - 1) });
          break;
        }
        m.entries.forEach((e, i) => {
          const idx = m.prev + 1 + i;
          if (n.log.length >= idx && n.log[idx - 1].term !== e.term) { n.log.length = idx - 1; logVersion++; }
          if (n.log.length < idx) { n.log.push(e); logVersion++; }
        });
        const match = m.prev + m.entries.length;
        if (m.commit > n.commit) { n.commit = Math.min(m.commit, match); logVersion++; }
        send(n.id, m.from, { type: "aer", term: n.term, ok: true, match });
        break;
      }
      case "aer":
        if (n.state !== "leader" || m.term !== n.term) break;
        if (m.ok) {
          n.match[m.from] = Math.max(n.match[m.from], m.match);
          n.next[m.from] = n.match[m.from] + 1;
          advanceCommit(n);
        } else {
          n.next[m.from] = Math.max(1, Math.min(n.next[m.from] - 1, m.hint + 1));
          appendEntries(n, m.from);
        }
        break;
    }
  }

  function tick() {
    now += 1;
    const due = msgs.filter((m) => m.arrive <= now);
    if (due.length) {
      msgs = msgs.filter((m) => m.arrive > now);
      due.sort((a, b) => a.arrive - b.arrive).forEach(deliver);
    }
    for (const n of nodes) {
      if (!n.up) continue;
      if (n.state === "leader") {
        if (now >= n.hbAt) {
          for (let j = 0; j < N; j++) if (j !== n.id) appendEntries(n, j);
          n.hbAt = now + HEARTBEAT;
        }
      } else if (now >= n.deadline) startElection(n);
    }
  }

  // ---- Actions on the selected server.

  function crash() {
    if (sel === undefined) return say("Select a server first.");
    const n = nodes[sel];
    if (n.up) {
      n.up = false;
      say(`${name(sel)} crashed. It keeps its term, vote and log on disk, and loses the rest.`);
    } else {
      n.up = true;
      n.state = "follower";
      n.commit = 0; // volatile: relearned from the leader
      n.votes = new Set();
      n.leaderId = null;
      resetDeadline(n);
      say(`${name(sel)} restarts as a follower in term ${n.term} with its log intact.`);
    }
    logVersion++;
    draw();
  }

  function write() {
    if (sel === undefined) return say("Select a server first.");
    const n = nodes[sel];
    if (!n.up) return say(`${name(sel)} is down: the client gets no answer.`);
    let L = n.state === "leader" ? n : null;
    if (!L && n.leaderId !== null) {
      const cand = nodes[n.leaderId];
      if (cand.up && cand.state === "leader" && reachable(n.id, cand.id)) L = cand;
    }
    if (!L) return say(`${name(sel)} knows no reachable leader. The client must wait and retry.`);
    writes++;
    L.log.push({ term: L.term, cmd: `x←${writes}` });
    logVersion++;
    say(`${L === n ? "" : `${name(sel)} redirects the client. `}${name(L.id)} appends x←${writes} at index ${L.log.length}, term ${L.term}. It is not committed until a majority stores it.`);
    draw();
  }

  function timeoutNow() {
    if (sel === undefined) return say("Select a server first.");
    const n = nodes[sel];
    if (!n.up || n.state === "leader") return say(n.up ? `${name(sel)} is the leader already.` : `${name(sel)} is down.`);
    n.deadline = now;
    if (!playing) { tick(); draw(); }
  }

  // ---- Drawing.

  function arc(cx, cy, r, frac) {
    if (frac <= 0) return "";
    const f = Math.min(frac, 0.9999);
    const a0 = -Math.PI / 2, a1 = a0 + f * 2 * Math.PI;
    const [x0, y0] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const [x1, y1] = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    return `M${x0},${y0} A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1},${y1}`;
  }

  function draw() {
    svg.replaceChildren();
    if (part) {
      // Between {S1, S2} and {S3, S4, S5}.
      const a = (-54 * Math.PI) / 180, d = 0.22 * RAD;
      const mx = C[0] + d * Math.cos(a), my = C[1] + d * Math.sin(a);
      const px = -Math.sin(a), py = Math.cos(a);
      el("line", { x1: mx - 190 * px, y1: my - 190 * py, x2: mx + 190 * px, y2: my + 190 * py, style: "stroke:var(--code-del);stroke-width:2;stroke-dasharray:6 5" }, svg);
    }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const [x1, y1] = pos(i), [x2, y2] = pos(j);
      el("line", { x1, y1, x2, y2, style: `stroke:currentColor;stroke-opacity:${reachable(i, j) ? 0.08 : 0.03}` }, svg);
    }
    for (const m of msgs) {
      const [x1, y1] = pos(m.from), [x2, y2] = pos(m.to);
      let t = (now - m.sent) / (m.arrive - m.sent);
      if (m.lost) t = Math.min(t, 0.5);
      const big = m.type === "ae" && m.entries.length > 0;
      const color = m.lost ? "var(--code-del)" : m.type === "rv" || m.type === "rvr" ? "var(--vec-u)" : big ? "var(--brand)" : "var(--muted-foreground)";
      const reply = m.type === "rvr" || m.type === "aer";
      el("circle", { cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t, r: big ? 4.5 : reply ? 2.4 : 3.2, style: `fill:${reply ? "var(--background)" : color};stroke:${color};stroke-width:1.4;opacity:${m.lost && t >= 0.5 ? 0.4 : 1}` }, svg);
    }
    nodes.forEach((n, i) => {
      const [x, y] = pos(i);
      const col = !n.up ? "var(--code-del)" : n.state === "leader" ? "var(--brand)" : n.state === "candidate" ? "var(--vec-u)" : "currentColor";
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `${name(i)}, ${n.up ? n.state : "crashed"}, term ${n.term}`, "aria-pressed": String(sel === i), class: "cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[3px]" }, svg);
      el("circle", { cx: x, cy: y, r: 41, style: `fill:none;stroke:${sel === i ? "var(--foreground)" : "transparent"};stroke-width:1.2;stroke-dasharray:3 3` }, g);
      el("circle", { cx: x, cy: y, r: 28, style: `fill:${n.state === "leader" && n.up ? "color-mix(in oklab, var(--brand) 16%, var(--background))" : "var(--background)"};stroke:${col};stroke-width:${n.state === "leader" ? 2.4 : 1.4};${n.up ? "" : "stroke-dasharray:4 3"}` }, g);
      if (n.up && n.state !== "leader") {
        const frac = Math.max(0, (n.deadline - now) / n.timeoutLen);
        el("path", { d: arc(x, y, 34, frac), style: `fill:none;stroke:${col};stroke-opacity:.55;stroke-width:2;stroke-linecap:round` }, g);
      }
      text(g, x, y - 4, name(i), { "text-anchor": "middle", class: "fill-foreground font-mono text-[12px]" });
      text(g, x, y + 11, n.up ? `T${n.term}` : "down", { "text-anchor": "middle", class: `font-mono text-[10px] ${n.up ? "fill-muted-foreground" : "fill-del"}` });
      const pick = () => { sel = i; draw(); readout(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); pick(); } });
    });
    text(svg, 116, 312, `t = ${Math.round(now)} ms`, { class: "fill-muted-foreground font-mono text-[10px]" });
    if (logVersion !== drawnVersion) { drawLogs(); drawnVersion = logVersion; }
    readout();
  }

  function drawLogs() {
    const maxLen = Math.max(1, ...nodes.map((n) => n.log.length));
    const from = Math.max(1, maxLen - 15);
    const table = h("div", "flex min-w-max flex-col gap-1 font-mono text-[11px]");
    const head = h("div", "flex items-center gap-1 text-muted-foreground");
    head.append(h("span", "w-24 shrink-0", "index"));
    for (let k = from; k <= maxLen; k++) head.append(h("span", "w-7 text-center tabular-nums", String(k)));
    table.append(head);
    nodes.forEach((n, i) => {
      const row = h("div", "flex items-center gap-1");
      const role = !n.up ? "down" : n.state;
      row.append(h("span", `w-24 shrink-0 ${role === "leader" ? "text-brand" : role === "down" ? "text-del" : "text-muted-foreground"}`, `${name(i)} ${role}`));
      for (let k = from; k <= maxLen; k++) {
        const e = n.log[k - 1];
        const cell = h("span", "flex h-6 w-7 items-center justify-center rounded border text-[10px] tabular-nums", e ? String(e.term) : "");
        if (e) {
          const c = TERM_COLORS[(e.term - 1) % TERM_COLORS.length];
          const done = k <= n.commit;
          cell.style.borderColor = c;
          cell.style.borderStyle = done ? "solid" : "dashed";
          cell.style.background = done ? `color-mix(in oklab, ${c} 28%, transparent)` : "transparent";
          cell.title = `${e.cmd}, term ${e.term}${done ? ", committed" : ""}`;
        } else cell.style.borderColor = "transparent";
        row.append(cell);
      }
      table.append(row);
    });
    const note = h("p", "pt-1 text-[10.5px] text-muted-foreground", "Numbers are the term each entry was created in. Solid: committed on that server; dashed: not yet.");
    logsEl.replaceChildren(table, note);
  }

  function readout() {
    const up = nodes.filter((n) => n.up);
    o.sel.textContent = sel === undefined ? "none (click a server)" : `${name(sel)}, ${nodes[sel].up ? nodes[sel].state : "crashed"}`;
    o.term.textContent = String(Math.max(...nodes.map((n) => n.term)));
    const leaders = up.filter((n) => n.state === "leader").sort((a, b) => b.term - a.term);
    o.leader.textContent = leaders.length ? leaders.map((l) => `${name(l.id)} (term ${l.term})`).join(", ") : "none";
    const commit = Math.max(0, ...up.map((n) => n.commit));
    o.commit.textContent = commit ? `up to index ${commit}` : "nothing yet";
    o.elections.textContent = String(elections);
    const worst = Math.max(0, ...[...leadersByTerm.values()].map((s) => s.size));
    // State machine safety: committed prefixes agree everywhere.
    let agree = true;
    for (const a of nodes) for (const b of nodes) {
      const k = Math.min(a.commit, b.commit);
      for (let i = 0; i < k; i++) if (a.log[i].term !== b.log[i].term || a.log[i].cmd !== b.log[i].cmd) agree = false;
    }
    o.safety.textContent = `${worst <= 1 ? "at most 1 ✓" : `${worst}: violated`} · committed logs ${agree ? "agree ✓" : "differ!"}`;
    const lbl = crashBtn.querySelector("[data-label]");
    lbl.textContent = sel !== undefined && !nodes[sel].up ? "Restart" : "Crash";
  }

  // ---- Loop.

  let raf = 0, last = 0;
  function loop(t) {
    const dt = Math.min(50, t - last);
    last = t;
    const target = now + dt * speed;
    while (now + 1 <= target) tick();
    draw();
    raf = requestAnimationFrame(loop);
  }
  const setIcon = (on) => {
    playBtn.querySelector('[data-icon="play"]').toggleAttribute("hidden", on);
    playBtn.querySelector('[data-icon="pause"]').toggleAttribute("hidden", !on);
    playBtn.querySelector("[data-label]").textContent = on ? "Pause" : "Run";
  };
  function setPlaying(on) {
    playing = on;
    setIcon(on);
    cancelAnimationFrame(raf);
    if (on && visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  const crashBtn = root.querySelector('[data-action="crash"]');
  playBtn.addEventListener("click", () => setPlaying(!playing));
  crashBtn.addEventListener("click", crash);
  root.querySelector('[data-action="write"]').addEventListener("click", write);
  root.querySelector('[data-action="timeout"]').addEventListener("click", timeoutNow);
  root.querySelector('[data-action="reset"]').addEventListener("click", () => { reset(); });
  onSeg(root, (v) => { speed = Number(v); });
  onToggle(root, (k, on) => {
    part = on;
    say(on ? "The network splits: S1 and S2 can no longer reach S3, S4 and S5. Only the side with three servers can elect a leader and commit." : "The network heals. A leader with a stale term steps down as soon as it hears a higher term.");
    draw();
  });

  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    setPlaying(playing);
  }).observe(root);

  reset();
  sel = 0;
  setPlaying(!reduced());
  draw();
}
