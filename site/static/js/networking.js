// Networking blocks. Every packet, table and handshake is computed in the
// page; nothing is sent on the network.

import { scrubAll } from "./scrub.js";
import { el, text, frame, polyline, num } from "./plot.js";
import { subnet, formatIPv4, ipv4Kind, ipv4Class, parseIPv6, expandIPv6, compressIPv6 } from "./networking-ip.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const onToggle = (root, fn) =>
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => fn(sw.dataset.toggle, e.detail.checked)));
const h = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
const bytes = (n) => (n >= 1e6 ? `${num(n / 1e6, 2)} MB` : n >= 1e3 ? `${num(n / 1e3, 1)} kB` : `${Math.round(n)} B`);
const secs = (s) => (s >= 1 ? `${num(s, 3)} s` : s >= 1e-3 ? `${num(s * 1e3, 2)} ms` : `${num(s * 1e6, 1)} µs`);

// Wires Back/Next buttons to a step counter.
function stepper(root, count, onStep) {
  const back = root.querySelector('[data-go="-1"]'), next = root.querySelector('[data-go="1"]');
  const label = root.querySelector('[data-out="step"]');
  let at = 0;
  const go = (i) => {
    at = Math.max(0, Math.min(count() - 1, i));
    back.disabled = at === 0;
    next.disabled = at === count() - 1;
    label.textContent = `${at + 1} / ${count()}`;
    onStep(at);
  };
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  return { go, get at() { return at; } };
}

// ============================================================ Encapsulation

const LAYERS = [
  { key: "app", name: "Application data (HTTP)", color: "var(--vec-out)" },
  { key: "tcp", name: "TCP segment", color: "var(--vec-u)" },
  { key: "ip", name: "IPv4 packet", color: "var(--ion-k)" },
  { key: "eth", name: "Ethernet frame", color: "var(--ion-cl)" },
  { key: "wire", name: "On the wire", color: "var(--foreground)" },
];
const FIELDS = {
  app: [["Request line", "GET /index.html HTTP/1.1"], ["Headers", "Host, User-Agent, Accept, …"], ["Blank line", "CRLF ends the header"]],
  tcp: [["Source port", 16], ["Destination port", 16], ["Sequence number", 32], ["Acknowledgment number", 32], ["Data offset", 4], ["Reserved", 4], ["Flags (CWR ECE URG ACK PSH RST SYN FIN)", 8], ["Window", 16], ["Checksum", 16], ["Urgent pointer", 16], ["Options", "0–320"]],
  ip: [["Version (4)", 4], ["IHL", 4], ["DSCP", 6], ["ECN", 2], ["Total length", 16], ["Identification", 16], ["Flags", 3], ["Fragment offset", 13], ["Time to live", 8], ["Protocol (6 = TCP)", 8], ["Header checksum", 16], ["Source address", 32], ["Destination address", 32]],
  eth: [["Destination MAC", 48], ["Source MAC", 48], ["EtherType (0x0800 = IPv4)", 16], ["Payload (46–1500 B, padded)", "…"], ["Frame check sequence (CRC-32)", 32]],
  wire: [["Preamble", 56], ["Start frame delimiter", 8], ["Frame", "…"], ["Interpacket gap (idle)", 96]],
};

for (const root of document.querySelectorAll("[data-net-encap]")) {
  const o = outs(root);
  const bars = root.querySelector("[data-bars]");
  const fields = root.querySelector("[data-fields]");
  const s = scrubAll(root, () => draw(st.at));
  const st = stepper(root, () => LAYERS.length, draw);

  function sizes() {
    const payload = Math.round(s.payload.get());
    const opt = Math.round(s.options.get() / 4) * 4; // options come in 32-bit words
    const tcp = 20 + opt, ip = 20;
    const ipLen = ip + tcp + payload;
    const pad = Math.max(0, 46 - ipLen);
    return { payload, opt, tcp, ip, ipLen, pad, eth: 14, fcs: 4, pre: 8, gap: 12, mss: 1460 - opt };
  }

  function draw(at) {
    const z = sizes();
    bars.replaceChildren();
    // One row per layer up to the current one: each wraps the row above.
    for (let i = 0; i <= at; i++) {
      const row = h("div", "flex flex-col gap-1");
      const head = h("div", "flex items-baseline justify-between gap-2 text-xs");
      head.append(h("span", i === at ? "font-medium" : "text-muted-foreground", LAYERS[i].name));
      const segs = [];
      if (i >= 4) segs.push(["pre", z.pre, "var(--foreground)"]);
      if (i >= 3) segs.push(["Eth", z.eth, LAYERS[3].color]);
      if (i >= 2) segs.push(["IPv4", z.ip, LAYERS[2].color]);
      if (i >= 1) segs.push(["TCP", z.tcp, LAYERS[1].color]);
      segs.push(["data", z.payload, LAYERS[0].color]);
      if (i >= 3 && z.pad) segs.push(["pad", z.pad, "var(--muted-foreground)"]);
      if (i >= 3) segs.push(["FCS", z.fcs, LAYERS[3].color]);
      const total = segs.reduce((a, x) => a + x[1], 0);
      head.append(h("span", "font-mono text-muted-foreground tabular-nums", `${total} B`));
      const bar = h("div", "flex h-7 w-full overflow-hidden rounded-md border");
      for (const [label, n, color] of segs) {
        const seg = h("div", "flex min-w-0 items-center justify-center overflow-hidden border-r px-1 font-mono text-[10px] whitespace-nowrap last:border-r-0");
        // Headers are tiny next to a full payload: give them a visible floor.
        seg.style.flex = `${Math.max(n, total * 0.035)} 1 0`;
        seg.style.background = `color-mix(in oklab, ${color} ${label === "data" ? 14 : 26}%, transparent)`;
        seg.title = `${{ pre: "preamble + SFD", Eth: "Ethernet header" }[label] ?? label}: ${n} B`;
        seg.textContent = `${label} ${n}`;
        bar.append(seg);
      }
      row.append(head, bar);
      bars.append(row);
    }

    fields.replaceChildren();
    const L = LAYERS[at];
    fields.append(h("div", "mb-2 text-xs font-medium", `${L.name}: fields added at this layer`));
    const grid = h("dl", "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-[11px]");
    for (const [name, bits] of FIELDS[L.key]) {
      grid.append(h("dt", "text-muted-foreground", name));
      grid.append(h("dd", "text-right tabular-nums", typeof bits === "number" ? `${bits} bit${bits > 1 ? "s" : ""}` : String(bits)));
    }
    fields.append(grid);

    const frameBytes = z.eth + z.ipLen + z.pad + z.fcs;
    const wire = z.pre + frameBytes;
    o.wire.textContent = `${wire} B (+ ${z.gap} B idle gap)`;
    o.overhead.textContent = `${wire - z.payload} B`;
    o.eff.textContent = `${num((100 * z.payload) / (wire + z.gap), 1)}%`;
    o.note.textContent = z.payload > z.mss ? `over the ${z.mss} B MSS: TCP would split it` : z.pad ? `frame padded by ${z.pad} B to the 64 B minimum` : `MSS ${z.mss} B for a 1500 B MTU`;
  }
  st.go(0);
}

// ============================================================ TCP handshake

for (const root of document.querySelectorAll("[data-net-handshake]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  let loss = false;
  const s = scrubAll(root, () => draw(st.at));
  onToggle(root, (k, on) => { loss = on; st.go(Math.min(st.at, msgs().length - 1)); });

  function msgs() {
    const x = Math.round(s.isnc.get()), y = Math.round(s.isns.get());
    const R = Math.round(s.req.get()), S = Math.round(s.resp.get());
    const list = [
      { dir: 1, flags: "SYN", seq: x, ack: null, c: "SYN-SENT", sv: "LISTEN", why: `The client picks an initial sequence number, ${x}, and sends SYN. A SYN consumes one sequence number.` },
    ];
    if (loss) {
      list.push({ dir: -1, flags: "SYN, ACK", seq: y, ack: x + 1, lost: true, c: "SYN-SENT", sv: "SYN-RECEIVED", why: "The SYN-ACK is lost on the way. The client hears nothing." });
      list.push({ dir: 1, flags: "SYN", seq: x, ack: null, retx: true, c: "SYN-SENT", sv: "SYN-RECEIVED", why: "After the initial retransmission timeout of 1 second (RFC 6298), the client sends the same SYN again; the timer then doubles." });
    }
    list.push(
      { dir: -1, flags: "SYN, ACK", seq: y, ack: x + 1, c: "SYN-SENT", sv: "SYN-RECEIVED", why: `The server answers with its own sequence number, ${y}, and acknowledges ${x + 1}: the next byte it expects.` },
      { dir: 1, flags: "ACK", seq: x + 1, ack: y + 1, c: "ESTABLISHED", sv: "ESTABLISHED", why: "The client acknowledges the server's SYN. Three segments, one and a half round trips: the connection is open." },
      { dir: 1, flags: "PSH, ACK", seq: x + 1, ack: y + 1, len: R, c: "ESTABLISHED", sv: "ESTABLISHED", why: `The client sends ${R} bytes of request, numbered from ${x + 1}.` },
      { dir: -1, flags: "PSH, ACK", seq: y + 1, ack: x + 1 + R, len: S, c: "ESTABLISHED", sv: "ESTABLISHED", why: `The server acknowledges ${x + 1 + R} (all ${R} bytes) and sends ${S} bytes of response in the same segment.` },
      { dir: 1, flags: "ACK", seq: x + 1 + R, ack: y + 1 + S, c: "ESTABLISHED", sv: "ESTABLISHED", why: `The client acknowledges the response: next expected byte ${y + 1 + S}.` },
      { dir: 1, flags: "FIN, ACK", seq: x + 1 + R, ack: y + 1 + S, c: "FIN-WAIT-1", sv: "ESTABLISHED", why: "The client is done sending and closes its half of the connection with FIN, which also consumes one sequence number." },
      { dir: -1, flags: "ACK", seq: y + 1 + S, ack: x + 2 + R, c: "FIN-WAIT-2", sv: "CLOSE-WAIT", why: "The server acknowledges the FIN. It may still send data: the connection is half-closed." },
      { dir: -1, flags: "FIN, ACK", seq: y + 1 + S, ack: x + 2 + R, c: "FIN-WAIT-2", sv: "LAST-ACK", why: "The server closes its half too." },
      { dir: 1, flags: "ACK", seq: x + 2 + R, ack: y + 2 + S, c: "TIME-WAIT", sv: "CLOSED", why: "The client acknowledges and waits 2×MSL in TIME-WAIT, so stray old segments die before the port pair is reused." },
    );
    return list;
  }

  const st = stepper(root, () => msgs().length, draw);

  function draw(at) {
    const list = msgs();
    svg.replaceChildren();
    const L = 120, R = 440, top = 50, dy = Math.min(42, 440 / list.length);
    for (const [x, name] of [[L, "Client"], [R, "Server"]]) {
      text(svg, x, 22, name, { "text-anchor": "middle", class: "fill-foreground font-sans text-[13px] font-medium" });
      el("line", { x1: x, x2: x, y1: 32, y2: top + dy * list.length + 10, style: "stroke:currentColor;stroke-opacity:0.25;stroke-width:1.5" }, svg);
    }
    list.forEach((m, i) => {
      if (i > at) return;
      const y0 = top + i * dy, y1 = y0 + dy * 0.8;
      const [x0, x1] = m.dir > 0 ? [L, R] : [R, L];
      const cur = i === at;
      const color = m.lost ? "var(--code-del)" : cur ? "var(--brand)" : "var(--foreground)";
      const xe = m.lost ? (x0 + x1) / 2 : x1;
      const ye = m.lost ? (y0 + y1) / 2 : y1;
      el("line", { x1: x0, y1: y0, x2: xe, y2: ye, style: `stroke:${color};stroke-width:${cur ? 2 : 1.25};${m.lost ? "stroke-dasharray:4 3" : ""}` }, svg);
      if (m.lost) {
        text(svg, xe, ye + 4, "✕", { "text-anchor": "middle", style: "fill:var(--code-del)", class: "font-sans text-[14px]" });
      } else {
        const d = m.dir > 0 ? -1 : 1;
        el("path", { d: `M${x1} ${y1} l${d * 9} -3 l0 6 z`, style: `fill:${color}` }, svg);
      }
      const label = `${m.flags}  seq=${m.seq}${m.ack !== null ? `  ack=${m.ack}` : ""}${m.len ? `  len=${m.len}` : ""}${m.retx ? "  (retransmitted)" : ""}`;
      const lw = label.length * 6.1 + 10;
      el("rect", { x: (L + R) / 2 - lw / 2, y: (y0 + y1) / 2 - 15, width: lw, height: 14, rx: 3, style: "fill:var(--code-bg);fill-opacity:0.95" }, svg);
      text(svg, (L + R) / 2, (y0 + y1) / 2 - 5, label, { "text-anchor": "middle", class: cur ? "fill-foreground font-mono text-[10.5px]" : "fill-muted-foreground font-mono text-[10px]" });
      if (m.retx) text(svg, L - 8, y0 - 6, "RTO 1 s", { "text-anchor": "end", style: "fill:var(--code-del)" });
    });
    const m = list[at];
    text(svg, L - 8, top + at * dy + dy * 0.4, m.c, { "text-anchor": "end", class: "fill-foreground font-mono text-[9.5px]" });
    text(svg, R + 8, top + at * dy + dy * 0.4, m.sv, { class: "fill-foreground font-mono text-[9.5px]" });
    o.explain.textContent = m.why;
  }
  st.go(0);
}

// ============================================================ Congestion control

for (const root of document.querySelectorAll("[data-net-cwnd]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const s = scrubAll(root, draw);

  function draw() {
    const N = Math.round(s.rtts.get()), dup = Math.round(s.dup.get()), to = Math.round(s.timeout.get());
    let cwnd = 1, ss = Math.round(s.ssthresh.get()), sent = 0;
    const pts = [], ssPts = [], events = [];
    for (let r = 1; r <= N; r++) {
      pts.push([r, cwnd]);
      ssPts.push([r, ss]);
      sent += cwnd;
      if (r === dup) {
        // Three duplicate ACKs: halve, and continue from there (fast recovery).
        ss = Math.max(Math.floor(cwnd / 2), 2);
        cwnd = ss;
        events.push([r, "3 dup ACKs"]);
      } else if (r === to) {
        ss = Math.max(Math.floor(cwnd / 2), 2);
        cwnd = 1;
        events.push([r, "timeout"]);
      } else if (cwnd < ss) {
        cwnd = Math.min(cwnd * 2, ss); // slow start: one more segment per ACK
      } else {
        cwnd += 1; // congestion avoidance: one segment per RTT
      }
    }
    svg.replaceChildren();
    const top = Math.max(8, ...pts.map((p) => p[1]), ...ssPts.map((p) => p[1]));
    const yTop = Math.ceil(top / 8) * 8;
    const f = frame(svg, { box: [44, 14, 536, 260], x: [0, N + 1], y: [0, yTop], xticks: Array.from({ length: Math.floor(N / 10) + 1 }, (_, i) => i * 10), yticks: [0, yTop / 2, yTop], xlabel: "round trip", ylabel: "cwnd (MSS)" });
    // Steps: the window is constant during a round trip.
    const step = [];
    for (const [r, c] of pts) step.push([f.sx(r - 0.5), f.sy(c)], [f.sx(r + 0.5), f.sy(c)]);
    polyline(svg, ssPts.flatMap(([r, c]) => [[f.sx(r - 0.5), f.sy(c)], [f.sx(r + 0.5), f.sy(c)]]), "stroke:var(--muted-foreground);stroke-width:1.25;stroke-dasharray:4 3");
    polyline(svg, step, "stroke:var(--brand);stroke-width:2;stroke-linejoin:round");
    for (const [r, label] of events) {
      const c = pts[r - 1][1];
      el("circle", { cx: f.sx(r + 0.5), cy: f.sy(c), r: 4, style: "fill:var(--background);stroke:var(--code-del);stroke-width:2" }, svg);
      text(svg, f.sx(r + 0.5) + 6, f.sy(c) - 6, label, { style: "fill:var(--code-del)" });
    }
    text(svg, f.L + f.W - 4, f.sy(ssPts.at(-1)[1]) - 5, "ssthresh", { "text-anchor": "end" });
    o.sent.textContent = `${sent} segments`;
    o.max.textContent = `${Math.max(...pts.map((p) => p[1]))} MSS`;
    o.ss.textContent = `${ss} MSS`;
  }
  draw();
}

// ============================================================ Subnets

for (const root of document.querySelectorAll("[data-net-subnet]")) {
  const input = root.querySelector('[data-in="cidr"]');
  const v6 = root.querySelector('[data-in="v6"]');
  const bin = root.querySelector("[data-binary]");
  const facts = root.querySelector("[data-facts]");
  const v6facts = root.querySelector("[data-v6facts]");
  const fact = (dl, k, v, cls = "") => {
    const d = h("div", "flex justify-between gap-3 border-b border-dashed py-1 last:border-b-0");
    d.append(h("dt", "text-muted-foreground", k), h("dd", "text-right tabular-nums " + cls, v));
    dl.append(d);
  };

  function draw() {
    const r = subnet(input.value);
    input.toggleAttribute("data-invalid", !r);
    bin.replaceChildren();
    facts.replaceChildren();
    if (!r) {
      bin.append(h("span", "text-del", "Type an address like 192.168.1.130/26 (prefix 0–32)."));
      return;
    }
    const rows = [["address", r.ip], ["mask", r.mask], ["network", r.network], ["broadcast", r.broadcast]];
    for (const [name, n] of rows) {
      const line = h("div", "flex items-center gap-3 whitespace-nowrap");
      line.append(h("span", "w-20 shrink-0 text-muted-foreground", name));
      const bits = h("span", "");
      for (let i = 31; i >= 0; i--) {
        const b = h("span", 31 - i < r.prefix ? "text-brand" : "text-muted-foreground", String((n >>> i) & 1));
        bits.append(b);
        if (i % 8 === 0 && i) bits.append(h("span", "text-muted-foreground/50", "."));
      }
      line.append(bits, h("span", "text-foreground", formatIPv4(n)));
      bin.append(line);
    }
    const legend = h("div", "mt-1 text-[11px] text-muted-foreground");
    legend.append(h("span", "text-brand", `${r.prefix} network bits`), ` · ${32 - r.prefix} host bits`);
    bin.append(legend);

    fact(facts, "subnet mask", `${formatIPv4(r.mask)} (/${r.prefix})`);
    fact(facts, "wildcard", formatIPv4(r.wildcard));
    fact(facts, "network", `${formatIPv4(r.network)}/${r.prefix}`);
    fact(facts, "broadcast", r.prefix >= 31 ? "none" : formatIPv4(r.broadcast));
    fact(facts, "usable hosts", r.prefix === 32 ? formatIPv4(r.first) : `${formatIPv4(r.first)} – ${formatIPv4(r.last)}`);
    fact(facts, "usable count", `${r.usable.toLocaleString("en-US")}${r.prefix === 31 ? " (point-to-point, RFC 3021)" : ""}`, "text-brand");
    fact(facts, "addresses in block", r.total.toLocaleString("en-US"));
    fact(facts, "address kind", ipv4Kind(r.ip));
    fact(facts, "historical class", ipv4Class(r.ip));
  }

  function drawV6() {
    v6facts.replaceChildren();
    const g = parseIPv6(v6.value);
    v6.toggleAttribute("data-invalid", !g);
    if (!g) {
      fact(v6facts, "error", "not a valid IPv6 address (8 groups of up to 4 hex digits, at most one ::)", "text-del");
      return;
    }
    fact(v6facts, "full form", expandIPv6(g));
    fact(v6facts, "canonical (RFC 5952)", compressIPv6(g), "text-brand");
    const doc = g[0] === 0x2001 && g[1] === 0x0db8;
    fact(v6facts, "kind", doc ? "documentation (2001:db8::/32, RFC 3849)" : g[0] >>> 6 === 0x3fa ? "link-local (fe80::/10)" : g.every((x, i) => (i < 7 ? x === 0 : x === 1)) ? "loopback (::1)" : "unicast or other");
  }

  input.addEventListener("input", draw);
  v6.addEventListener("input", drawV6);
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.preset; draw(); }));
  draw();
  drawV6();
}

// ============================================================ Routing

const RT_NODES = { A: [70, 70], B: [220, 50], C: [180, 200], D: [360, 90], E: [330, 240], F: [470, 170] };
const RT_EDGES = [["A", "B", 2], ["A", "C", 5], ["B", "C", 1], ["B", "D", 4], ["C", "E", 3], ["D", "E", 1], ["D", "F", 5], ["E", "F", 2]];
const INF = 16; // RIP's infinity

for (const root of document.querySelectorAll("[data-net-routing]")) {
  const svg = root.querySelector("[data-plot]");
  const table = root.querySelector("[data-table]");
  const o = outs(root);
  const label = root.querySelector('[data-action="round"] [data-label]');
  let mode = "ls", split = false;
  let edges = RT_EDGES.map((e) => [...e]);
  let src = "A";
  let ls, dv, inf;
  const names = Object.keys(RT_NODES);
  const nbrs = (n) => edges.filter((e) => e[0] === n || e[1] === n).map((e) => [e[0] === n ? e[1] : e[0], e[2]]);

  function resetLS() {
    ls = { dist: Object.fromEntries(names.map((n) => [n, Infinity])), prev: {}, done: new Set(), order: [] };
    ls.dist[src] = 0;
  }
  function stepLS() {
    const open = names.filter((n) => !ls.done.has(n) && ls.dist[n] < Infinity);
    if (!open.length) return false;
    const u = open.sort((a, b) => ls.dist[a] - ls.dist[b] || a.localeCompare(b))[0];
    ls.done.add(u);
    ls.order.push(u);
    for (const [v, w] of nbrs(u)) {
      if (!ls.done.has(v) && ls.dist[u] + w < ls.dist[v]) {
        ls.dist[v] = ls.dist[u] + w;
        ls.prev[v] = u;
      }
    }
    return true;
  }
  function resetDV() {
    dv = { round: 0, changed: new Set(), t: {} };
    for (const a of names) {
      dv.t[a] = {};
      for (const b of names) dv.t[a][b] = a === b ? { d: 0, via: "—" } : { d: Infinity, via: "" };
      for (const [n, w] of nbrs(a)) dv.t[a][n] = { d: w, via: n };
    }
  }
  function stepDV() {
    const next = {};
    dv.changed = new Set();
    for (const a of names) {
      next[a] = {};
      for (const b of names) {
        let best = a === b ? { d: 0, via: "—" } : { d: Infinity, via: "" };
        for (const [n, w] of nbrs(a)) {
          const d = w + dv.t[n][b].d;
          if (d < best.d) best = { d, via: n };
        }
        next[a][b] = best;
        if (best.d !== dv.t[a][b].d) dv.changed.add(`${a}${b}`);
      }
    }
    dv.t = next;
    dv.round++;
    return dv.changed.size > 0;
  }
  function resetInf() {
    inf = { round: 0, a: 2, b: 1, rows: [[0, 2, 1, "converged: A reaches C through B"]] };
  }
  function stepInf() {
    if (inf.a >= INF && inf.b >= INF) return false;
    // Synchronous exchange after the B–C link fails. B's only neighbour
    // left is A; A's is B. With poisoned reverse, A tells B "C: ∞" because
    // A's own route to C goes through B.
    const fromA = split ? INF : inf.a;
    const nb = Math.min(INF, 1 + fromA);
    const na = Math.min(INF, 1 + (inf.round === 0 ? INF : inf.b)); // B's first update says the link is gone
    inf.round++;
    [inf.a, inf.b] = [inf.round === 1 ? 1 + inf.b : na, nb];
    if (inf.round === 1 && split) inf.a = INF;
    inf.a = Math.min(INF, inf.a);
    const note = inf.a >= INF && inf.b >= INF ? "both routes are ∞: C is unreachable" : split ? "" : "A and B each believe the other can still reach C";
    inf.rows.push([inf.round, inf.a, inf.b, note]);
    return true;
  }

  function reset() {
    resetLS();
    resetDV();
    resetInf();
    draw();
  }

  const dist = (d) => (d === Infinity || d >= INF ? "∞" : String(d));

  function drawGraph(nodes, links, hl) {
    svg.replaceChildren();
    for (const [a, b, w, i] of links) {
      const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
      const on = hl.edges.has(`${a}${b}`) || hl.edges.has(`${b}${a}`);
      const g = el("g", { class: i !== undefined ? "cursor-pointer" : "" }, svg);
      el("line", { x1, y1, x2, y2, style: `stroke:${on ? "var(--brand)" : "currentColor"};stroke-opacity:${on ? 1 : 0.35};stroke-width:${on ? 3 : 1.5};${w === null ? "stroke-dasharray:5 4" : ""}` }, g);
      el("line", { x1, y1, x2, y2, style: "stroke:transparent;stroke-width:16" }, g);
      if (w !== null) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        el("rect", { x: mx - 10, y: my - 9, width: 20, height: 18, rx: 4, style: "fill:var(--code-bg);stroke:currentColor;stroke-opacity:0.25" }, g);
        text(g, mx, my + 4, String(w), { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
      } else {
        text(g, (x1 + x2) / 2, (y1 + y2) / 2 - 8, "✕ link down", { "text-anchor": "middle", style: "fill:var(--code-del)" });
      }
      if (i !== undefined) g.dataset.edge = i;
    }
    for (const [n, [x, y]] of Object.entries(nodes)) {
      const g = el("g", { "data-node": n, class: "cursor-pointer", tabindex: 0, role: "button", "aria-label": `Router ${n}` }, svg);
      const on = hl.nodes.has(n);
      el("circle", { cx: x, cy: y, r: 17, style: `fill:${n === hl.src ? "var(--brand)" : "var(--background)"};stroke:${on || n === hl.src ? "var(--brand)" : "currentColor"};stroke-width:${on ? 2.5 : 1.5}` }, g);
      text(g, x, y + 5, n, { "text-anchor": "middle", class: n === hl.src ? "fill-background font-sans text-[13px] font-medium" : "fill-foreground font-sans text-[13px] font-medium" });
      if (hl.labels[n] !== undefined) text(g, x, y - 23, hl.labels[n], { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    }
  }

  function tableOf(head, rows, changed = () => false) {
    const t = h("table", "w-full min-w-[420px] font-mono text-[11px]");
    const tr = h("tr", "border-b text-left text-muted-foreground");
    for (const c of head) tr.append(h("th", "px-2 py-1 font-normal", c));
    t.append(tr);
    rows.forEach((r, i) => {
      const row = h("tr", "border-b last:border-b-0");
      r.forEach((c, j) => row.append(h("td", "px-2 py-1 tabular-nums" + (changed(i, j) ? " bg-brand/10 text-brand" : ""), String(c))));
      t.append(row);
    });
    return t;
  }

  function draw() {
    table.replaceChildren();
    if (mode === "ls") {
      const tree = new Set(Object.entries(ls.prev).filter(([v]) => ls.done.has(v)).map(([v, u]) => `${u}${v}`));
      drawGraph(RT_NODES, edges.map((e, i) => [...e, i]), { edges: tree, nodes: ls.done, src, labels: Object.fromEntries(names.map((n) => [n, dist(ls.dist[n])])) });
      table.append(tableOf(["router", "distance from " + src, "previous hop", "settled"], names.map((n) => [n, dist(ls.dist[n]), ls.prev[n] ?? (n === src ? "—" : ""), ls.done.has(n) ? `#${ls.order.indexOf(n) + 1}` : ""])));
      o.round.textContent = `${ls.done.size} of ${names.length} settled`;
      o.status.textContent = ls.done.size === names.length ? "shortest-path tree complete" : "settling the closest open router";
      label.textContent = "Settle next";
    } else if (mode === "dv") {
      drawGraph(RT_NODES, edges.map((e, i) => [...e, i]), { edges: new Set(), nodes: new Set(), src: null, labels: {} });
      table.append(tableOf(["from \\ to", ...names], names.map((a) => [a, ...names.map((b) => `${dist(dv.t[a][b].d)}${dv.t[a][b].via && dv.t[a][b].via !== "—" ? " " + dv.t[a][b].via : ""}`)]), (i, j) => j > 0 && dv.changed.has(`${names[i]}${names[j - 1]}`)));
      o.round.textContent = `round ${dv.round}`;
      o.status.textContent = dv.round > 0 && dv.changed.size === 0 ? "converged: no table changed" : dv.round === 0 ? "each router knows only its neighbours" : `${dv.changed.size} entries changed`;
      label.textContent = "Exchange";
    } else {
      const nodes = { A: [110, 150], B: [260, 150], C: [410, 150] };
      drawGraph(nodes, [["A", "B", 1], ["B", "C", inf.round > 0 ? null : 1]], { edges: new Set(), nodes: new Set(["A", "B"]), src: null, labels: { A: `C: ${dist(inf.a)}`, B: `C: ${dist(inf.b)}` } });
      table.append(tableOf(["round", "A's distance to C", "B's distance to C", ""], inf.rows.map((r) => [r[0], dist(r[1]), dist(r[2]), r[3]])));
      o.round.textContent = `round ${inf.round}`;
      o.status.textContent = inf.a >= INF && inf.b >= INF ? `unreachable after ${inf.round} rounds` : inf.round === 0 ? "the B–C link is about to fail" : "counting up…";
      label.textContent = inf.round === 0 ? "Cut B–C" : "Exchange";
    }
  }

  root.querySelector('[data-action="round"]').addEventListener("click", () => {
    if (mode === "ls") stepLS();
    else if (mode === "dv") stepDV();
    else stepInf();
    draw();
  });
  root.querySelector('[data-action="reset"]').addEventListener("click", reset);
  root.addEventListener("seg-change", (e) => { mode = e.detail.value; draw(); });
  onToggle(root, (k, on) => { split = on; resetInf(); draw(); });
  svg.addEventListener("click", (e) => {
    if (mode === "inf") return;
    const node = e.target.closest("[data-node]");
    const edge = e.target.closest("[data-edge]");
    if (node && mode === "ls") { src = node.dataset.node; reset(); }
    else if (edge) {
      const ed = edges[Number(edge.dataset.edge)];
      ed[2] = Math.max(1, Math.min(9, ed[2] + (e.shiftKey ? -1 : 1)));
      reset();
    }
  });
  svg.addEventListener("keydown", (e) => {
    const node = e.target.closest("[data-node]");
    if (node && (e.key === "Enter" || e.key === " ") && mode === "ls") { e.preventDefault(); src = node.dataset.node; reset(); }
  });
  reset();
}

// ============================================================ DNS

const DNS_DATA = {
  A: { name: "www.example.com.", ttl: 3600, rdata: "192.0.2.10" },
  AAAA: { name: "www.example.com.", ttl: 3600, rdata: "2001:db8::10" },
  MX: { name: "example.com.", ttl: 86400, rdata: "10 mail.example.com." },
  CNAME: { name: "docs.example.com.", ttl: 3600, rdata: "www.example.com." },
  TXT: { name: "example.com.", ttl: 3600, rdata: '"v=spf1 -all"' },
};
const DNS_POS = { stub: [70, 150], resolver: [250, 150], root: [470, 50], tld: [490, 150], auth: [470, 250] };
const DNS_LABEL = { stub: ["Your device", "stub resolver"], resolver: ["Recursive", "resolver"], root: ["Root server", "a.root-servers.net"], tld: [".com server", "a.gtld-servers.net"], auth: ["example.com", "ns1.example.com"] };

for (const root of document.querySelectorAll("[data-net-dns]")) {
  const svg = root.querySelector("[data-plot]");
  const log = root.querySelector("[data-log]");
  const o = outs(root);
  let type = "A", clock = 0, sent = 0, path = [], busy = false;
  // The resolver's cache: answers, and the .com delegation (2 days).
  const cache = new Map();

  function cached(key) {
    const c = cache.get(key);
    return c && c.until > clock ? c : null;
  }

  function draw(lit = path.length) {
    svg.replaceChildren();
    path.slice(0, lit).forEach(([a, b], i) => {
      const [x1, y1] = DNS_POS[a], [x2, y2] = DNS_POS[b];
      // The query and the final answer share the stub–resolver link.
      const off = i === 0 ? -8 : i === path.length - 1 ? 8 : 0;
      const cur = i === lit - 1;
      el("line", { x1, y1: y1 + off, x2, y2: y2 + off, style: `stroke:${cur ? "var(--brand)" : "currentColor"};stroke-opacity:${cur ? 1 : 0.45};stroke-width:${cur ? 2 : 1.25}` }, svg);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + off * 1.4;
      el("circle", { cx: mx, cy: my, r: 8, style: `fill:${cur ? "var(--brand)" : "var(--code-bg)"};stroke:${cur ? "var(--brand)" : "currentColor"};stroke-opacity:0.6` }, svg);
      text(svg, mx, my + 3.5, String(i + 1), { "text-anchor": "middle", class: cur ? "fill-background font-mono text-[10px]" : "fill-foreground font-mono text-[10px]" });
    });
    for (const [k, [x, y]] of Object.entries(DNS_POS)) {
      el("rect", { x: x - 62, y: y - 22, width: 124, height: 44, rx: 8, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.3" }, svg);
      text(svg, x, y - 3, DNS_LABEL[k][0], { "text-anchor": "middle", class: "fill-foreground font-sans text-[11.5px] font-medium" });
      text(svg, x, y + 12, DNS_LABEL[k][1], { "text-anchor": "middle", class: "fill-muted-foreground font-mono text-[9px]" });
    }
    o.sent.textContent = String(sent);
    o.clock.textContent = `t + ${clock / 3600} h`;
    const c = cached(type);
    o.ttl.textContent = c ? `${c.until - clock} s` : "not cached";
  }

  const line = (s, cls = "") => log.append(h("div", cls, s));

  async function resolve() {
    if (busy) return;
    busy = true;
    log.replaceChildren();
    const rec = DNS_DATA[type];
    line(`; query ${rec.name} ${type}`, "text-muted-foreground");
    path = [["stub", "resolver"]];
    const steps = [];
    const hit = cached(type);
    if (hit) {
      steps.push(() => line(`resolver: cache hit, ${hit.until - clock} s of TTL left`, "text-add"));
    } else {
      if (!cached("com-ns")) {
        path.push(["resolver", "root"]);
        sent++;
        steps.push(() => line(`root → referral: com. 172800 IN NS a.gtld-servers.net.`));
        path.push(["resolver", "tld"]);
        sent++;
        steps.push(() => line(`.com → referral: example.com. 172800 IN NS ns1.example.com.`));
        cache.set("com-ns", { until: clock + 172800 });
      } else {
        steps.push(() => line("resolver: already knows the example.com servers (cached referral)", "text-muted-foreground"));
      }
      path.push(["resolver", "auth"]);
      sent++;
      steps.push(() => line(`ns1.example.com → answer (authoritative)`));
      cache.set(type, { until: clock + rec.ttl });
    }
    path.push(["resolver", "stub"]);
    steps.push(() => line(`${rec.name} ${hit ? hit.until - clock : rec.ttl} IN ${type} ${rec.rdata}`, "text-foreground"));
    o.from.textContent = hit ? "resolver cache" : "authoritative server";
    for (let i = 0; i < steps.length; i++) {
      steps[i]();
      draw(Math.min(path.length, i + 2));
      if (!reduced()) await new Promise((r) => setTimeout(r, 350));
    }
    draw();
    busy = false;
  }

  root.querySelector('[data-action="query"]').addEventListener("click", resolve);
  root.querySelector('[data-action="wait"]').addEventListener("click", () => { clock += 3600; draw(); line(`(one hour passes: cached TTLs count down)`, "text-muted-foreground"); });
  root.querySelector('[data-action="flush"]').addEventListener("click", () => { cache.clear(); line("(cache flushed)", "text-muted-foreground"); draw(); });
  root.addEventListener("seg-change", (e) => { type = e.detail.value; draw(); });
  draw();
  line("Press Resolve.", "text-muted-foreground");
}

// ============================================================ TLS

const TLS_FLOWS = {
  full: {
    rtts: 1, rtt: "1 RTT", first: "client, after 1 RTT",
    note: "The client sends a key share in its very first message, guessing the group (usually X25519). The server picks it up, so both sides derive handshake keys after one message each: everything from EncryptedExtensions on is encrypted. The client can send application data with its Finished, one round trip after it started.",
    msgs: [
      [1, [["ClientHello", "c"], ["+ key_share, supported_versions", "c"], ["+ signature_algorithms", "c"]]],
      [-1, [["ServerHello + key_share", "c"], ["{EncryptedExtensions}", "e"], ["{Certificate}", "e"], ["{CertificateVerify}", "e"], ["{Finished}", "e"]]],
      [1, [["{Finished}", "e"], ["[Application Data]", "a"]]],
      [-1, [["[Application Data]", "a"]]],
    ],
  },
  zero: {
    rtts: 0, rtt: "0 RTT for early data", first: "client, in its first flight",
    note: "Resuming with a pre-shared key from an earlier session, the client can send early data straight away, encrypted with a key derived from that PSK. The catch (RFC 8446 §8): early data has no replay protection across connections and is not forward secret, so servers should only accept it for idempotent requests such as a GET.",
    msgs: [
      [1, [["ClientHello", "c"], ["+ early_data, key_share", "c"], ["+ pre_shared_key", "c"], ["(Application Data)", "a"]]],
      [-1, [["ServerHello + pre_shared_key", "c"], ["{EncryptedExtensions + early_data}", "e"], ["{Finished}", "e"], ["[Application Data]", "a"]]],
      [1, [["(EndOfEarlyData)", "e"], ["{Finished}", "e"], ["[Application Data]", "a"]]],
    ],
  },
  tls12: {
    rtts: 2, rtt: "2 RTT", first: "client, after 2 RTT",
    note: "TLS 1.2 (RFC 5246) needs two round trips before application data: the key exchange only starts in the server's second message, and the certificate travels in the clear. TLS 1.3 removed RSA key transport and static Diffie-Hellman, so every full handshake is forward secret.",
    msgs: [
      [1, [["ClientHello", "c"]]],
      [-1, [["ServerHello", "c"], ["Certificate", "c"], ["ServerKeyExchange", "c"], ["ServerHelloDone", "c"]]],
      [1, [["ClientKeyExchange", "c"], ["ChangeCipherSpec", "c"], ["{Finished}", "e"]]],
      [-1, [["ChangeCipherSpec", "c"], ["{Finished}", "e"]]],
      [1, [["[Application Data]", "a"]]],
    ],
  },
};

for (const root of document.querySelectorAll("[data-net-tls]")) {
  const svg = root.querySelector("[data-plot]");
  const note = root.querySelector("[data-note]");
  const o = outs(root);
  const COLOR = { c: "var(--foreground)", e: "var(--brand)", a: "var(--code-add)" };

  function draw(mode) {
    const flow = TLS_FLOWS[mode];
    svg.replaceChildren();
    const L = 110, R = 450;
    for (const [x, name] of [[L, "Client"], [R, "Server"]]) {
      text(svg, x, 22, name, { "text-anchor": "middle", class: "fill-foreground font-sans text-[13px] font-medium" });
      el("line", { x1: x, x2: x, y1: 32, y2: 470, style: "stroke:currentColor;stroke-opacity:0.25;stroke-width:1.5" }, svg);
    }
    let y = 50;
    const tops = [];
    for (const [dir, lines] of flow.msgs) {
      const hgt = 18 + lines.length * 15;
      const [x0, x1] = dir > 0 ? [L, R] : [R, L];
      tops.push(y);
      el("line", { x1: x0, y1: y, x2: x1, y2: y + hgt, style: "stroke:currentColor;stroke-opacity:0.55;stroke-width:1.25" }, svg);
      el("path", { d: `M${x1} ${y + hgt} l${dir > 0 ? -9 : 9} -4 l0 7 z`, style: "fill:currentColor;fill-opacity:0.6" }, svg);
      lines.forEach(([t, kind], i) => {
        const tx = (L + R) / 2;
        const ty = y + 8 + i * 15 + hgt * 0.1;
        el("rect", { x: tx - 115, y: ty - 10, width: 230, height: 14, rx: 3, style: "fill:var(--code-bg);fill-opacity:0.92" }, svg);
        text(svg, tx, ty + 1, t, { "text-anchor": "middle", style: `fill:${COLOR[kind]}`, class: "font-mono text-[10.5px]" });
      });
      y += hgt + 14;
    }
    // Round trips before the client's first application data: one bracket
    // per client→server→client exchange, and only those.
    for (let k = 0; k < flow.rtts; k++) {
      const i = 2 * k;
      const y0 = tops[i], y1 = tops[i + 1] + 18 + flow.msgs[i + 1][1].length * 15;
      el("path", { d: `M${L - 14} ${y0} h-6 V${y1} h6`, style: "fill:none;stroke:var(--brand);stroke-width:1.25" }, svg);
      text(svg, L - 26, (y0 + y1) / 2 + 3, `RTT ${k + 1}`, { "text-anchor": "end", style: "fill:var(--brand)" });
    }
    const first = flow.rtts === 0 ? tops[0] : tops[2 * flow.rtts];
    text(svg, L - 26, first + 14, "data →", { "text-anchor": "end", style: "fill:var(--code-add)" });
    note.textContent = flow.note;
    o.rtt.textContent = flow.rtt;
    o.first.textContent = flow.first;
  }

  root.addEventListener("seg-change", (e) => draw(e.detail.value));
  draw("full");
}

// ============================================================ HTTP

for (const root of document.querySelectorAll("[data-net-http]")) {
  const method = root.querySelector('[data-in="method"]');
  const url = root.querySelector('[data-in="url"]');
  const parts = root.querySelector("[data-url]");
  const req = root.querySelector('[data-raw="req"]');
  const resp = root.querySelector('[data-raw="resp"]');
  const o = outs(root);
  let inm = false, gzip = true, version = 1;
  const date = new Date().toUTCString();
  const etagOf = (v) => `"v${v}-${(0x3f2a + v * 977).toString(16)}"`;
  // The client's cache holds version 1, fetched earlier: If-None-Match
  // always sends that copy's ETag.
  const cachedEtag = etagOf(1);
  const resource = () => ({
    etag: etagOf(version),
    body: `<!doctype html>\n<title>Café</title>\n<h1>Docs, version ${version}</h1>\n<p>${"Bonjour. ".repeat(20 + version * 3)}</p>\n`,
  });
  const KNOWN = new Set(["/", "/docs/", "/docs/caf%C3%A9"]);

  const fact = (k, v) => {
    const d = h("div", "flex min-w-0 justify-between gap-3");
    d.append(h("dt", "text-muted-foreground", k), h("dd", "min-w-0 truncate text-right", v));
    parts.append(d);
  };

  async function gzipSize(s) {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"));
    return (await new Response(stream).arrayBuffer()).byteLength;
  }

  async function draw() {
    parts.replaceChildren();
    let u;
    try {
      u = new URL(url.value);
    } catch {
      url.toggleAttribute("data-invalid", true);
      fact("error", "not an absolute URL (try https://…)");
      req.textContent = resp.textContent = "";
      o.explain.textContent = "The WHATWG URL parser rejected this URL.";
      return;
    }
    url.toggleAttribute("data-invalid", false);
    const defPort = { "http:": "80", "https:": "443" }[u.protocol];
    fact("scheme", u.protocol.replace(":", ""));
    fact("host", u.hostname);
    fact("port", u.port || `${defPort ?? "—"} (default)`);
    fact("path", u.pathname);
    fact("path, decoded", decodeURIComponent(u.pathname));
    fact("query", [...u.searchParams].map(([k, v]) => `${k}=${v}`).join(" · ") || "—");
    fact("fragment", u.hash ? `${u.hash} (never sent to the server)` : "—");

    const m = method.value;
    const r = resource();
    const hostHeader = u.port ? `${u.hostname}:${u.port}` : u.hostname;
    const reqLines = [`${m} ${u.pathname}${u.search} HTTP/1.1`, `Host: ${hostHeader}`, "User-Agent: blocks-demo/1.0", "Accept: text/html"];
    if (gzip) reqLines.push("Accept-Encoding: gzip");
    if (inm) reqLines.push(`If-None-Match: ${cachedEtag}`);
    if (m === "POST" || m === "PUT") reqLines.push("Content-Type: application/x-www-form-urlencoded", "Content-Length: 11", "", "title=Hello");
    req.textContent = reqLines.join("\n") + (m === "POST" || m === "PUT" ? "" : "\n");

    const head = (status) => [`HTTP/1.1 ${status}`, `Date: ${date}`];
    let lines, explain;
    if (!KNOWN.has(u.pathname)) {
      lines = [...head("404 Not Found"), "Content-Type: text/html; charset=utf-8", "Content-Length: 22", "", "<h1>Not found</h1>"];
      explain = "No resource at this path: 404. (The demo server knows /, /docs/ and /docs/café.)";
    } else if (m !== "GET" && m !== "HEAD") {
      lines = [...head("405 Method Not Allowed"), "Allow: GET, HEAD", "Content-Length: 0", ""];
      explain = `${m} is not allowed on this resource: 405, with an Allow header listing what is (RFC 9110 §15.5.6).`;
    } else if (inm && cachedEtag === r.etag) {
      lines = [...head("304 Not Modified"), `ETag: ${r.etag}`, "Cache-Control: max-age=3600", "Vary: Accept-Encoding", ""];
      explain = "The ETag of the client's cached copy matches the current one, so the server answers 304 Not Modified with no body: the cached copy is still good. Change the resource and the same request gets a full 200.";
    } else {
      const raw = new TextEncoder().encode(r.body).byteLength;
      const gz = gzip ? await gzipSize(r.body) : null;
      lines = [...head("200 OK"), "Content-Type: text/html; charset=utf-8", ...(gz ? ["Content-Encoding: gzip"] : []), `Content-Length: ${gz ?? raw}`, `ETag: ${r.etag}`, "Cache-Control: max-age=3600", "Vary: Accept-Encoding", ""];
      if (m === "GET") lines.push(gz ? `<${gz} bytes of gzip>` : r.body.trimEnd());
      const stale = inm ? `The cached copy (${cachedEtag}) is out of date, so the server sends the new version in full. ` : "";
      explain = `200 OK. ${stale}${m === "HEAD" ? "HEAD gets the same headers as GET but no body. " : ""}${gz ? `Gzip (computed in your browser) shrinks the ${raw}-byte body to ${gz} bytes. ` : ""}Cache-Control lets any cache reuse it for an hour; after that, the ETag lets the client revalidate cheaply with If-None-Match.`;
    }
    resp.textContent = lines.join("\n");
    o.explain.textContent = explain;
  }

  method.addEventListener("change", draw);
  url.addEventListener("input", draw);
  root.querySelector('[data-action="edit"]').addEventListener("click", () => { version++; draw(); });
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => {
    if (sw.dataset.toggle === "inm") inm = e.detail.checked;
    else gzip = e.detail.checked;
    draw();
  }));
  draw();
}

// ============================================================ Latency

for (const root of document.querySelectorAll("[data-net-latency]")) {
  const svg = root.querySelector("[data-plot]");
  const pipe = root.querySelector("[data-pipe]");
  const o = outs(root);
  let speed = 2e8; // m/s in fibre (refractive index ≈ 1.5)
  const s = scrubAll(root, draw);

  function draw() {
    const d = s.dist.get() * 1000, bw = s.bw.get() * 1e6, size = s.size.get() * 1000;
    const prop = d / speed, trans = (size * 8) / bw, total = prop + trans, rtt = 2 * prop;
    const bdp = (bw * rtt) / 8;
    svg.replaceChildren();
    const max = Math.max(total, 1e-6);
    const f = frame(svg, { box: [90, 20, 450, 110], x: [0, max * 1.05], y: [0, 2], xticks: [0, max / 2, max].map((v) => v), xfmt: secs, yticks: [] });
    const bar = (row, x0, x1, color, label) => {
      const y = f.sy(row + 0.85), hgt = f.sy(row + 0.15) - y;
      el("rect", { x: f.sx(x0), y, width: Math.max(1.5, f.sx(x1) - f.sx(x0)), height: hgt, rx: 3, style: `fill:${color};fill-opacity:0.75` }, svg);
      text(svg, 84, y + hgt / 2 + 3, label, { "text-anchor": "end" });
    };
    bar(1, 0, trans, "var(--vec-u)", "transmission");
    bar(0, trans, trans + prop, "var(--brand)", "propagation");
    text(svg, f.L, 168, `last bit leaves after ${secs(trans)}, arrives ${secs(total)} after the first left`, { class: "fill-muted-foreground font-mono text-[10px]" });

    o.prop.textContent = secs(prop);
    o.trans.textContent = secs(trans);
    o.total.textContent = secs(total);
    o.rtt.textContent = secs(rtt);
    o.bdp.textContent = bytes(bdp);
    const win = 65535; // the largest window without scaling (RFC 7323)
    const capped = (win * 8) / rtt;
    pipe.replaceChildren();
    pipe.append(
      h("span", "", `To keep this link busy, ${bytes(bdp)} must be in flight before the first acknowledgement returns. `),
      h("span", capped < bw ? "text-foreground" : "", `Without TCP window scaling (RFC 7323) the window stops at 64 KiB, which caps throughput at ${num(capped / 1e6, capped < 1e7 ? 2 : 0)} Mbit/s${capped < bw ? `, ${num((100 * capped) / bw, 0)}% of the link` : ", more than the link"}.`),
    );
  }

  root.addEventListener("seg-change", (e) => { speed = e.detail.value === "fibre" ? 2e8 : 299792458; draw(); });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    s.dist.set(Number(b.dataset.preset), false);
    const want = Number(b.dataset.preset) > 50000 ? "radio" : "fibre";
    root.querySelector(`[data-seg="${want}"]`)?.click();
    draw();
  }));
  draw();
}

// ============================================================ CSS layout

for (const root of document.querySelectorAll("[data-net-css]")) {
  const diagram = root.querySelector("[data-boxdiagram]");
  const boxcss = root.querySelector("[data-boxcss]");
  const flexbox = root.querySelector("[data-flexbox]");
  const flexcss = root.querySelector("[data-flexcss]");
  const items = [...flexbox.querySelectorAll("[data-item]")];
  const o = outs(root);
  let borderBox = false;
  const s = scrubAll(root, draw);
  onToggle(root, (k, on) => { borderBox = on; draw(); });
  root.querySelectorAll("[data-css]").forEach((sel) => sel.addEventListener("change", draw));

  function draw() {
    // Box model: a real element styled with the chosen values.
    const W = s.width.get(), H = s.height.get(), p = s.padding.get(), b = s.border.get(), m = s.margin.get();
    const rw = borderBox ? Math.max(W, 2 * p + 2 * b) : W + 2 * p + 2 * b;
    const rh = borderBox ? Math.max(H, 2 * p + 2 * b) : H + 2 * p + 2 * b;
    diagram.replaceChildren();
    const marginBox = h("div", "inline-block rounded-sm");
    marginBox.style.cssText = `padding:${m}px;background:color-mix(in oklab, var(--vec-out) 22%, transparent);`;
    marginBox.title = `margin ${m}px`;
    const box = h("div", "relative");
    box.style.cssText = `box-sizing:${borderBox ? "border-box" : "content-box"};width:${W}px;height:${H}px;padding:${p}px;border:${b}px solid color-mix(in oklab, var(--brand) 70%, transparent);background:color-mix(in oklab, var(--ion-cl) 22%, transparent);`;
    const content = h("div", "flex size-full items-center justify-center overflow-hidden font-mono text-[11px] text-foreground");
    content.style.background = "color-mix(in oklab, var(--vec-u) 24%, var(--code-bg))";
    content.textContent = `${Math.max(0, rw - 2 * p - 2 * b)} × ${Math.max(0, rh - 2 * p - 2 * b)}`;
    box.append(content);
    marginBox.append(box);
    const legend = h("div", "mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground");
    for (const [c, t] of [["var(--vec-u)", "content"], ["var(--ion-cl)", "padding"], ["var(--brand)", "border"], ["var(--vec-out)", "margin"]]) {
      const it = h("span", "flex items-center gap-1.5");
      const sw = h("span", "size-2.5 rounded-sm");
      sw.style.background = c;
      it.append(sw, t);
      legend.append(it);
    }
    diagram.append(marginBox, legend);
    boxcss.textContent = `.box {\n  box-sizing: ${borderBox ? "border-box" : "content-box"};\n  width: ${W}px;\n  height: ${H}px;\n  padding: ${p}px;\n  border: ${b}px solid;\n  margin: ${m}px;\n}`;
    o.rw.textContent = `${rw} px`;
    o.rh.textContent = `${rh} px`;
    o.space.textContent = `${rw + 2 * m} × ${rh + 2 * m} px`;

    // Flexbox: the container takes the chosen properties directly.
    const v = Object.fromEntries([...root.querySelectorAll("[data-css]")].map((sel) => [sel.dataset.css, sel.value]));
    const gap = Math.round(s.gap.get()), grow = Math.round(s.grow2.get());
    flexbox.style.cssText = `display:flex;flex-direction:${v["flex-direction"]};justify-content:${v["justify-content"]};align-items:${v["align-items"]};flex-wrap:${v["flex-wrap"]};gap:${gap}px;`;
    const heights = [40, 64, 48, 80], sizes = [13, 18, 13, 22];
    items.forEach((it, i) => {
      it.style.minHeight = `${heights[i]}px`;
      it.style.fontSize = `${sizes[i]}px`; // different baselines for align-items: baseline
      it.style.flexGrow = i === 1 ? String(grow) : "0";
    });
    flexcss.textContent = `.container {\n  display: flex;\n  flex-direction: ${v["flex-direction"]};\n  justify-content: ${v["justify-content"]};\n  align-items: ${v["align-items"]};\n  flex-wrap: ${v["flex-wrap"]};\n  gap: ${gap}px;\n}\n.item:nth-child(2) { flex-grow: ${grow}; }`;
  }
  draw();
}
