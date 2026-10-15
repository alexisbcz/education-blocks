// Pure address arithmetic for the networking blocks (no DOM), so it can be
// checked outside the browser:
//   node -e 'import("./site/static/js/networking-ip.js").then(m => console.log(m.subnet("192.168.1.130/26")))'

const u32 = (n) => n >>> 0;

/** "a.b.c.d" → 32-bit unsigned number, or null. */
export function parseIPv4(s) {
  const parts = String(s).trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

export const formatIPv4 = (n) => [24, 16, 8, 0].map((s) => (u32(n) >>> s) & 255).join(".");

/**
 * subnet("192.168.1.130/26") → network, broadcast, mask, wildcard, usable
 * host range and counts. /31 follows RFC 3021 (two usable addresses, no
 * network or broadcast); /32 is a single host.
 */
export function subnet(cidr) {
  const m = String(cidr).trim().match(/^([\d.]+)\s*\/\s*(\d{1,2})$/);
  if (!m) return null;
  const ip = parseIPv4(m[1]);
  const prefix = Number(m[2]);
  if (ip === null || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : u32(0xffffffff << (32 - prefix));
  const network = u32(ip & mask);
  const broadcast = u32(network | u32(~mask));
  const total = 2 ** (32 - prefix);
  let first, last, usable;
  if (prefix === 32) [first, last, usable] = [network, network, 1];
  else if (prefix === 31) [first, last, usable] = [network, broadcast, 2];
  else [first, last, usable] = [network + 1, broadcast - 1, total - 2];
  return { ip, prefix, mask, wildcard: u32(~mask), network, broadcast, first, last, usable, total };
}

/** The special-purpose block an address belongs to, if any. */
export function ipv4Kind(n) {
  const inBlock = (net, p) => (p === 0 ? true : u32(n & u32(0xffffffff << (32 - p))) === parseIPv4(net));
  const blocks = [
    ["10.0.0.0", 8, "private (RFC 1918)"],
    ["172.16.0.0", 12, "private (RFC 1918)"],
    ["192.168.0.0", 16, "private (RFC 1918)"],
    ["127.0.0.0", 8, "loopback (RFC 1122)"],
    ["169.254.0.0", 16, "link-local (RFC 3927)"],
    ["100.64.0.0", 10, "shared address space, carrier-grade NAT (RFC 6598)"],
    ["192.0.2.0", 24, "documentation, TEST-NET-1 (RFC 5737)"],
    ["198.51.100.0", 24, "documentation, TEST-NET-2 (RFC 5737)"],
    ["203.0.113.0", 24, "documentation, TEST-NET-3 (RFC 5737)"],
    ["224.0.0.0", 4, "multicast (RFC 5771)"],
    ["240.0.0.0", 4, "reserved (RFC 1112)"],
  ];
  for (const [net, p, label] of blocks) if (inBlock(net, p)) return label;
  return "public unicast";
}

/** The pre-CIDR class of an address (historical, RFC 791). */
export function ipv4Class(n) {
  const a = u32(n) >>> 24;
  return a < 128 ? "A" : a < 192 ? "B" : a < 224 ? "C" : a < 240 ? "D (multicast)" : "E (reserved)";
}

/** Parses an IPv6 address (with or without ::) into 8 numbers, or null. */
export function parseIPv6(s) {
  s = String(s).trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) return null;
  const [head, tail] = s.includes("::") ? s.split("::") : [s, null];
  const part = (x) => (x === "" ? [] : x.split(":"));
  const h = part(head);
  const t = tail === null ? [] : part(tail);
  const groups = tail === null ? h : [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  if (groups.length !== 8 || (tail !== null && h.length + t.length > 7)) return null;
  const out = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

/** The full form: eight four-digit groups. */
export const expandIPv6 = (g) => g.map((x) => x.toString(16).padStart(4, "0")).join(":");

/**
 * The canonical text form of RFC 5952: lowercase, no leading zeros, the
 * longest run of two or more zero groups replaced by "::" (the first one
 * on a tie), a lone zero group left as "0".
 */
export function compressIPv6(g) {
  let best = [-1, 0];
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > best[1]) best = [i, j - i];
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (best[1] < 2) return hex.join(":");
  const left = hex.slice(0, best[0]).join(":");
  const right = hex.slice(best[0] + best[1]).join(":");
  return `${left}::${right}`;
}
