// Modern cryptography, part one: AES round by round, block cipher modes on
// an image, nonce reuse, HMAC and authenticated encryption. The AES and
// SHA-256 used here live in moderncrypto-core.js and are checked against
// FIPS-197 and WebCrypto. Secret sharing, the zero-knowledge proof, key
// stretching, LWE and TLS are in moderncrypto-more.js.

import {
  hex, unhex, utf8, fromUtf8, xor, concat,
  aesTrace, aes, ecbEncrypt, cbcEncrypt, ctrKeystream, sha256, hmac,
  outs, onSeg, onToggle, mk, act,
} from "./moderncrypto-core.js";

const subtle = globalThis.crypto?.subtle;
const freshBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// ============================================================ 1. AES rounds

const STEP_TEXT = {
  input: "The 16 input bytes fill the state column by column.",
  AddRoundKey: "AddRoundKey XORs every byte with the round key. It is the only step that uses the key.",
  SubBytes: "SubBytes replaces each byte through the S-box: its inverse in GF(2⁸), then a fixed affine map. This is the non-linear part.",
  ShiftRows: "ShiftRows rotates row r left by r places, so each column now holds bytes from four different columns.",
  MixColumns: "MixColumns multiplies each column by a fixed matrix over GF(2⁸): every output byte depends on all four input bytes of its column.",
};
const VECTORS = {
  b: { pt: "3243f6a8885a308d313198a2e0370734", key: "2b7e151628aed2a6abf7158809cf4f3c", ct: "3925841d02dc09fbdc118597196a0b32" },
  c: { pt: "00112233445566778899aabbccddeeff", key: "000102030405060708090a0b0c0d0e0f", ct: "69c4e0d86a7b0430d8cdb78070b4c55a" },
};

for (const root of document.querySelectorAll("[data-mc-aes]")) {
  const o = outs(root);
  const ptIn = root.querySelector('[data-text="pt"]'), keyIn = root.querySelector('[data-text="key"]');
  const stateEl = root.querySelector("[data-state]"), keyEl = root.querySelector("[data-key]");
  const track = root.querySelector("[data-track]"), explain = root.querySelector("[data-explain]");
  const cellCls = "flex h-9 items-center justify-center rounded-md border font-mono text-xs tabular-nums transition-[border-color,background-color] duration-200 motion-reduce:transition-none";
  const cells = Array.from({ length: 16 }, () => stateEl.appendChild(mk("div", cellCls)));
  const kcells = Array.from({ length: 16 }, () => keyEl.appendChild(mk("div", cellCls)));
  cells.forEach((c) => c.setAttribute("role", "gridcell"));
  let trace = null, idx = 0, buttons = [];

  function parse() {
    const pt = unhex(ptIn.value), key = unhex(keyIn.value);
    ptIn.setAttribute("aria-invalid", String(!pt || pt.length !== 16));
    keyIn.setAttribute("aria-invalid", String(!key || key.length !== 16));
    if (!pt || !key || pt.length !== 16 || key.length !== 16) return false;
    trace = aesTrace(pt, key);
    buttons = trace.steps.map((s, i) => {
      const b = mk("button", "h-6 min-w-6 rounded px-1 font-mono text-[10px] text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-[current=step]:bg-brand/15 aria-[current=step]:text-foreground",
        s.step === "input" ? "in" : `${s.round}${{ AddRoundKey: "k", SubBytes: "s", ShiftRows: "r", MixColumns: "m" }[s.step]}`);
      b.type = "button";
      b.title = `Round ${s.round}: ${s.step}`;
      b.setAttribute("aria-label", `Round ${s.round}, ${s.step}`);
      b.addEventListener("click", () => { idx = i; draw(); });
      return b;
    });
    track.replaceChildren(...buttons);
    o.ct.textContent = hex(trace.steps.at(-1).state);
    const v = Object.values(VECTORS).find((v) => v.pt === hex(pt) && v.key === hex(key));
    o.check.textContent = v ? (v.ct === o.ct.textContent ? "matches FIPS-197 ✓" : "MISMATCH") : "custom input";
    return true;
  }

  function draw() {
    if (!trace) return;
    const s = trace.steps[idx], prev = trace.steps[Math.max(0, idx - 1)].state;
    let changed = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const i = 4 * c + r, cell = cells[4 * r + c];
      cell.textContent = s.state[i].toString(16).padStart(2, "0");
      const diff = idx > 0 && s.state[i] !== prev[i];
      if (diff) changed++;
      cell.style.borderColor = diff ? "var(--brand)" : "";
      cell.style.background = diff ? "color-mix(in oklab, var(--brand) 10%, transparent)" : "";
    }
    const k = trace.keys[s.round], usesKey = s.step === "AddRoundKey";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cell = kcells[4 * r + c];
      cell.textContent = k[4 * c + r].toString(16).padStart(2, "0");
      cell.style.opacity = usesKey ? "1" : "0.45";
    }
    buttons.forEach((b, i) => (i === idx ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
    o.where.textContent = s.step === "input" ? "input" : `round ${s.round} · ${s.step}`;
    o.keyround.textContent = `K${s.round}`;
    o.changed.textContent = idx === 0 ? "—" : `${changed} of 16 bytes`;
    explain.textContent = STEP_TEXT[s.step] + (s.round === 10 && s.step === "ShiftRows" ? " The last round skips MixColumns." : "");
  }

  const go = (d) => { if (!trace) return; idx = Math.max(0, Math.min(trace.steps.length - 1, idx + d)); draw(); };
  act(root, "prev", () => go(-1));
  act(root, "next", () => go(1));
  act(root, "end", () => { if (trace) { idx = trace.steps.length - 1; draw(); } });
  for (const [name, v] of [["fips-b", VECTORS.b], ["fips-c", VECTORS.c]]) act(root, name, () => {
    ptIn.value = v.pt; keyIn.value = v.key; idx = 0;
    if (parse()) draw();
  });
  for (const inp of [ptIn, keyIn]) inp.addEventListener("input", () => { if (parse()) draw(); });
  root.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  if (parse()) draw();
}

// ============================================================ images

const SIZE = 96;

/** A 96×96 grayscale image with few distinct values, so blocks repeat. */
function makeImage(kind) {
  const img = new Uint8Array(SIZE * SIZE).fill(230);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) img[y * SIZE + x] = v; };
  if (kind === "stripes") {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) img[y * SIZE + x] = ((x >> 4) + (y >> 4)) % 2 ? 40 : 230;
  } else if (kind === "text" && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = "#000"; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("TOP", SIZE / 2, 30); g.font = "bold 21px sans-serif"; g.fillText("SECRET", SIZE / 2, 66);
    const d = g.getImageData(0, 0, SIZE, SIZE).data;
    for (let i = 0; i < SIZE * SIZE; i++) img[i] = d[4 * i] < 128 ? 30 : 230;
  } else {
    // Logo: a ring, a square and a bar, in three grey levels on a light ground.
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const r = Math.hypot(x - 36, y - 40);
      if (r < 26 && r > 14) set(x, y, 40);
      if (x >= 54 && x < 86 && y >= 50 && y < 82) set(x, y, 120);
      if (y >= 86 && y < 92 && x >= 8 && x < 88) set(x, y, 40);
    }
  }
  return img;
}

function paint(canvas, bytes) {
  const g = canvas.getContext("2d");
  const data = g.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const v = bytes[i];
    data.data[4 * i] = data.data[4 * i + 1] = data.data[4 * i + 2] = v;
    data.data[4 * i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
}

const distinctBlocks = (bytes) => {
  const seen = new Set();
  for (let i = 0; i < bytes.length; i += 16) seen.add(hex(bytes.slice(i, i + 16)));
  return seen.size;
};

// ============================================================ 2. modes

for (const root of document.querySelectorAll("[data-mc-modes]")) {
  const o = outs(root);
  const plain = root.querySelector('[data-canvas="plain"]'), cipher = root.querySelector('[data-canvas="cipher"]');
  const cap = root.querySelector('[data-caption="cipher"]');
  let mode = "ecb", kind = "logo", key = freshBytes(16), iv = freshBytes(16);

  function draw() {
    const img = makeImage(kind), c = aes(key);
    const ct = mode === "ecb" ? ecbEncrypt(c, img) : mode === "cbc" ? cbcEncrypt(c, iv, img) : xor(img, ctrKeystream(c, iv, img.length));
    paint(plain, img);
    paint(cipher, ct);
    cap.textContent = `${mode.toUpperCase()} ciphertext bytes as pixels`;
    o.blocks.textContent = String(img.length / 16);
    o.pdistinct.textContent = String(distinctBlocks(img));
    o.cdistinct.textContent = String(distinctBlocks(ct));
  }
  onSeg(root, (v, list) => {
    if (list.getAttribute("aria-label") === "Mode") mode = v; else kind = v;
    draw();
  });
  act(root, "rekey", () => { key = freshBytes(16); iv = freshBytes(16); draw(); });
  draw();
}

// ============================================================ 3. nonce reuse

for (const root of document.querySelectorAll("[data-mc-nonce]")) {
  const o = outs(root);
  const cv = (n) => root.querySelector(`[data-canvas="${n}"]`);
  let fresh = false, key = freshBytes(16), n1 = freshBytes(16), n2fresh = freshBytes(16);
  // Two binary pictures: XOR of two binary images is another binary image.
  const bin = (img) => img.map((v) => (v < 128 ? 0 : 255));
  const p1 = () => bin(makeImage("text")), p2 = () => bin(makeImage("logo"));

  function draw() {
    const c = aes(key), a = p1(), b = p2();
    const n2 = fresh ? n2fresh : n1;
    const c1 = xor(a, ctrKeystream(c, n1, a.length)), c2 = xor(b, ctrKeystream(c, n2, b.length));
    const x = xor(c1, c2);
    paint(cv("p1"), a); paint(cv("c1"), c1); paint(cv("c2"), c2); paint(cv("x"), x);
    o.n1.textContent = hex(n1).slice(0, 12) + "…";
    o.n2.textContent = hex(n2).slice(0, 12) + "…";
    const same = hex(x) === hex(xor(a, b));
    o.same.textContent = same ? "yes: the keystream cancelled" : "no: noise";
  }
  onToggle(root, (_, on) => { fresh = on; draw(); });
  act(root, "rekey", () => { key = freshBytes(16); n1 = freshBytes(16); n2fresh = freshBytes(16); draw(); });
  draw();
}

// ============================================================ 4. HMAC

for (const root of document.querySelectorAll("[data-mc-hmac]")) {
  const t = (n) => root.querySelector(`[data-text="${n}"]`);
  const steps = root.querySelector("[data-steps]"), verdict = root.querySelector("[data-verdict]");
  const short = (b, n = 16) => hex(b).slice(0, n) + "…";

  function row(n, label, value, note) {
    const li = mk("li", "flex min-w-0 flex-col gap-0.5 rounded-lg border bg-background px-3 py-2");
    const top = mk("div", "flex items-baseline gap-2 text-sm");
    top.append(mk("span", "font-mono text-[11px] text-muted-foreground", String(n)), mk("span", "font-medium", label));
    li.append(top, mk("span", "font-mono text-xs break-all", value));
    if (note) li.append(mk("span", "text-xs text-muted-foreground", note));
    return li;
  }

  function senderTag() {
    return hmac(utf8(t("key").value), utf8(t("msg").value));
  }

  function draw() {
    const key = utf8(t("key").value), msg = utf8(t("msg").value);
    let k = key.length > 64 ? sha256(key) : key;
    k = concat(k, new Uint8Array(64 - k.length));
    const ik = k.map((b) => b ^ 0x36), ok = k.map((b) => b ^ 0x5c);
    const inner = sha256(concat(ik, msg)), tag = sha256(concat(ok, inner));
    steps.replaceChildren(
      row(1, "Pad the key to 64 bytes", short(k), key.length > 64 ? "Longer than a block, so it was hashed first." : `${key.length} key bytes, then zeros.`),
      row(2, "Inner hash: SHA-256((K ⊕ ipad) ‖ message)", hex(inner), "ipad is the byte 0x36 repeated."),
      row(3, "Outer hash: SHA-256((K ⊕ opad) ‖ inner)", hex(tag), "opad is 0x5c repeated. This is the tag."),
    );
    const rtag = unhex(t("rtag").value);
    const expect = hmac(key, utf8(t("rmsg").value));
    const valid = rtag && rtag.length === 32 && hex(rtag) === hex(expect);
    verdict.textContent = valid ? "✓ Tag verifies: the message came from someone with the key and was not changed."
      : "✗ Tag does not verify: the message or the tag was changed, or the key is different. Reject it.";
    verdict.style.borderColor = valid ? "var(--brand)" : "var(--code-del)";
  }
  act(root, "copytag", () => { t("rmsg").value = t("msg").value; t("rtag").value = hex(senderTag()); draw(); });
  for (const n of ["key", "msg", "rmsg", "rtag"]) t(n).addEventListener("input", draw);
  t("rtag").value = hex(senderTag());
  draw();
}

// ============================================================ 5. AEAD

for (const root of document.querySelectorAll("[data-mc-aead]")) {
  const o = outs(root);
  const msgIn = root.querySelector('[data-text="msg"]');
  const boxes = { ctr: root.querySelector('[data-bytes="ctr"]'), gcm: root.querySelector('[data-bytes="gcm"]') };
  const results = { ctr: root.querySelector('[data-result="ctr"]'), gcm: root.querySelector('[data-result="gcm"]') };
  let st = null, flips = 0;
  if (!subtle) { results.ctr.textContent = results.gcm.textContent = "WebCrypto is not available in this browser."; continue; }

  async function encrypt() {
    const raw = freshBytes(16), nonce = freshBytes(12), counter = concat(nonce, new Uint8Array(4));
    const kc = await subtle.importKey("raw", raw, "AES-CTR", false, ["encrypt", "decrypt"]);
    const kg = await subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    const pt = utf8(msgIn.value);
    const ctr = new Uint8Array(await subtle.encrypt({ name: "AES-CTR", counter, length: 32 }, kc, pt));
    const gcm = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, kg, pt));
    st = { kc, kg, counter, nonce, pt, ctr, gcm, ctr0: ctr.slice(), gcm0: gcm.slice() };
    flips = 0;
    await draw();
  }

  function byteButtons(kind) {
    const bytes = st[kind], orig = st[kind + "0"];
    boxes[kind].replaceChildren(...Array.from(bytes, (b, i) => {
      const btn = mk("button", "h-6 w-7 rounded border font-mono text-[10px] tabular-nums outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50", b.toString(16).padStart(2, "0"));
      btn.type = "button";
      const isTag = kind === "gcm" && i >= bytes.length - 16;
      btn.setAttribute("aria-label", `${isTag ? "tag" : "ciphertext"} byte ${i}: ${b.toString(16)}`);
      if (isTag) btn.classList.add("border-dashed");
      if (b !== orig[i]) { btn.style.borderColor = "var(--code-del)"; btn.style.color = "var(--code-del)"; }
      btn.addEventListener("click", async () => { bytes[i] ^= 1; flips++; await draw(); boxes[kind].children[i]?.focus(); });
      return btn;
    }));
  }

  async function draw() {
    byteButtons("ctr"); byteButtons("gcm");
    o.flips.textContent = String(flips);
    const ctrPt = new Uint8Array(await subtle.decrypt({ name: "AES-CTR", counter: st.counter, length: 32 }, st.kc, st.ctr));
    const changed = ctrPt.some((b, i) => b !== st.pt[i]);
    results.ctr.textContent = fromUtf8(ctrPt) + (changed ? "   ← changed, and nothing noticed" : "");
    results.ctr.style.borderColor = changed ? "var(--code-del)" : "";
    o.ctrout.textContent = JSON.stringify(fromUtf8(ctrPt));
    try {
      const g = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: st.nonce }, st.kg, st.gcm));
      results.gcm.textContent = fromUtf8(g) + "   ✓ tag verified";
      results.gcm.style.borderColor = "var(--brand)";
      o.gcmout.textContent = JSON.stringify(fromUtf8(g));
    } catch {
      results.gcm.textContent = "Decryption refused: the tag does not match, so no plaintext is returned.";
      results.gcm.style.borderColor = "var(--code-del)";
      o.gcmout.textContent = "error (rejected)";
    }
  }
  act(root, "encrypt", encrypt);
  act(root, "restore", async () => { if (!st) return; st.ctr = st.ctr0.slice(); st.gcm = st.gcm0.slice(); flips = 0; await draw(); });
  msgIn.addEventListener("change", encrypt);
  encrypt();
}
