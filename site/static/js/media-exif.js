// A small EXIF reader for JPEG files, and a builder for a synthetic JPEG
// that carries an EXIF segment (no image data: enough to demonstrate the
// parser without shipping a photo). Everything happens on an ArrayBuffer in
// the page; nothing is uploaded.
//
// JPEG: segments start with 0xFF xx; APP1 (0xFFE1) holds "Exif\0\0" and a
// TIFF structure: byte order, 42, offset of IFD0. Each IFD is a count of
// 12-byte entries (tag, type, count, value or offset) and a next-IFD offset.

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/** Parses EXIF from a JPEG ArrayBuffer. Returns { error } or { tags }. */
export function parseExif(buffer) {
  const v = new DataView(buffer);
  try {
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return { error: "Not a JPEG file (no FFD8 start marker)." };
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffda || marker === 0xffd9) break; // image data or end
      const len = v.getUint16(off + 2);
      if (marker === 0xffe1 && ascii(v, off + 4, 6) === "Exif\0\0") return { tags: readTiff(v, off + 10) };
      off += 2 + len;
    }
    return { tags: null };
  } catch (e) {
    return { error: "The EXIF data is damaged or truncated." };
  }
}

function ascii(v, at, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(at + i));
  return s;
}

function readTiff(v, tiff) {
  const order = v.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) throw new Error("byte order");
  const le = order === 0x4949;
  const u16 = (o) => v.getUint16(o, le);
  const u32 = (o) => v.getUint32(o, le);
  if (u16(tiff + 2) !== 42) throw new Error("magic");

  const readIFD = (start) => {
    const out = {};
    const n = u16(start);
    for (let i = 0; i < n; i++) {
      const e = start + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = (TYPE_SIZE[type] || 1) * count;
      const at = size <= 4 ? e + 8 : tiff + u32(e + 8);
      out[tag] = readValue(type, count, at);
    }
    return out;
  };
  const readValue = (type, count, at) => {
    if (type === 2) return ascii(v, at, count).replace(/\0+$/, "");
    const vals = [];
    for (let i = 0; i < Math.min(count, 16); i++) {
      if (type === 3) vals.push(u16(at + i * 2));
      else if (type === 4) vals.push(u32(at + i * 4));
      else if (type === 9) vals.push(v.getInt32(at + i * 4, le));
      else if (type === 5) vals.push(u32(at + i * 8) / (u32(at + i * 8 + 4) || 1));
      else if (type === 10) vals.push(v.getInt32(at + i * 8, le) / (v.getInt32(at + i * 8 + 4, le) || 1));
      else vals.push(v.getUint8(at + i));
    }
    return count === 1 ? vals[0] : vals;
  };

  const ifd0 = readIFD(tiff + u32(tiff + 4));
  const exif = ifd0[0x8769] ? readIFD(tiff + ifd0[0x8769]) : {};
  const gps = ifd0[0x8825] ? readIFD(tiff + ifd0[0x8825]) : null;
  const dms = (a, ref) => (Array.isArray(a) && a.length === 3 ? (a[0] + a[1] / 60 + a[2] / 3600) * (ref === "S" || ref === "W" ? -1 : 1) : null);
  return {
    byteOrder: le ? "little-endian (II)" : "big-endian (MM)",
    make: ifd0[0x010f] ?? null,
    model: ifd0[0x0110] ?? null,
    software: ifd0[0x0131] ?? null,
    modified: ifd0[0x0132] ?? null,
    orientation: ifd0[0x0112] ?? null,
    taken: exif[0x9003] ?? null,
    gps: gps ? { lat: dms(gps[2], gps[1]), lon: dms(gps[4], gps[3]) } : null,
  };
}

/** Builds a big-endian TIFF/EXIF segment inside a minimal JPEG. */
export function buildSample() {
  const str = (s) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  const ifd0 = [
    { tag: 0x010f, type: 2, bytes: str("ExampleCam") },
    { tag: 0x0110, type: 2, bytes: str("EC-1 (synthetic)") },
    { tag: 0x0131, type: 2, bytes: str("media literacy sample") },
    { tag: 0x0132, type: 2, bytes: str("2023:06:15 09:12:40") },
    { tag: 0x8769, type: 4, long: 0 }, // Exif IFD offset, set below
    { tag: 0x8825, type: 4, long: 0 }, // GPS IFD offset, set below
  ];
  const exif = [{ tag: 0x9003, type: 2, bytes: str("2023:06:14 18:42:07") }];
  const rat = (pairs) => pairs.flatMap(([n, d]) => [...u32be(n), ...u32be(d)]);
  const gps = [
    { tag: 0x0001, type: 2, bytes: str("N") },
    { tag: 0x0002, type: 5, count: 3, bytes: rat([[46, 1], [12, 1], [1584, 100]]) },
    { tag: 0x0003, type: 2, bytes: str("E") },
    { tag: 0x0004, type: 5, count: 3, bytes: rat([[6, 1], [8, 1], [3552, 100]]) },
  ];
  const dataLen = (ifd) => ifd.reduce((s, e) => s + (e.bytes && e.bytes.length > 4 ? e.bytes.length + (e.bytes.length % 2) : 0), 0);
  const size = (ifd) => 2 + ifd.length * 12 + 4 + dataLen(ifd);
  const off0 = 8, offE = off0 + size(ifd0), offG = offE + size(exif);
  ifd0[4].long = offE;
  ifd0[5].long = offG;

  const out = [0x4d, 0x4d, 0, 42, ...u32be(off0)];
  const writeIFD = (ifd, start) => {
    let data = start + 2 + ifd.length * 12 + 4;
    const entries = [], blobs = [];
    for (const e of ifd) {
      const count = e.count ?? (e.bytes ? e.bytes.length : 1);
      entries.push(...u16be(e.tag), ...u16be(e.type), ...u32be(count));
      if (e.type === 4 && !e.bytes) entries.push(...u32be(e.long));
      else if (e.bytes.length <= 4) entries.push(...e.bytes, ...new Array(4 - e.bytes.length).fill(0));
      else {
        entries.push(...u32be(data));
        const b = e.bytes.length % 2 ? [...e.bytes, 0] : e.bytes;
        blobs.push(...b);
        data += b.length;
      }
    }
    out.push(...u16be(ifd.length), ...entries, 0, 0, 0, 0, ...blobs);
  };
  writeIFD(ifd0, off0);
  writeIFD(exif, offE);
  writeIFD(gps, offG);

  const seg = [0x45, 0x78, 0x69, 0x66, 0, 0, ...out]; // "Exif\0\0" + TIFF
  const jpeg = [0xff, 0xd8, 0xff, 0xe1, ...u16be(seg.length + 2), ...seg, 0xff, 0xd9];
  return new Uint8Array(jpeg).buffer;
}

function u16be(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}
function u32be(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
