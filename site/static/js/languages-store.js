// Shared by the language learning blocks: the deck in localStorage, the
// SM-2 scheduler, answer comparison, French number spelling and speech.
// This module only exports; the page's loader imports it like any other.

const KEY = "lang-srs-v1";
let memory = null; // fallback when storage is unavailable

export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

export function readJSON(root, name) {
  const t = root.querySelector(`template[data-lang-json="${name}"]`);
  try { return JSON.parse(t?.dataset.json ?? "null"); } catch { return null; }
}

export const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));

export function loadState() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return memory;
}

export function saveState(state) {
  memory = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  window.dispatchEvent(new CustomEvent("lang-deck-change"));
}

export const newCard = (front, back) => ({ front, back, ef: 2.5, reps: 0, interval: 0, due: null });

// SM-2 (Wozniak 1987). q is the grade 0–5. Below 3 the card restarts.
// The interval uses the ease factor in effect before this review; the ease
// factor is updated afterwards. Intervals are rounded to the nearest day.
export function review(card, q, day = today()) {
  const c = { ...card };
  if (q < 3) {
    c.reps = 0;
    c.interval = 1;
  } else {
    c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 6 : Math.round(c.interval * c.ef);
    c.reps += 1;
  }
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  c.due = day + c.interval;
  return c;
}

// ------------------------------------------------------------ comparison

export const clean = (s) => s.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
export const strip = (s) => clean(s).normalize("NFD").replace(/\p{M}/gu, "");

// verdict compares an answer with the accepted forms: "right" if it
// matches one exactly, "close" if only accents differ, else "wrong".
export function verdict(answer, accepted) {
  const a = clean(answer);
  if (!a) return "empty";
  if (accepted.some((x) => clean(x) === a)) return "right";
  if (accepted.some((x) => strip(x) === strip(answer))) return "close";
  return "wrong";
}

// ------------------------------------------------------------ numbers

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

// The same rules as langNumber in site/languages_data.go (tested there).
function below100(n, final) {
  if (n <= 16) return UNITS[n];
  if (n < 20) return "dix-" + UNITS[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  if (t <= 6) return u === 0 ? TENS[t] : u === 1 ? TENS[t] + " et un" : TENS[t] + "-" + UNITS[u];
  if (t === 7) return u === 1 ? "soixante et onze" : "soixante-" + below100(10 + u, final);
  if (t === 8) return u === 0 ? (final ? "quatre-vingts" : "quatre-vingt") : "quatre-vingt-" + UNITS[u];
  return "quatre-vingt-" + below100(10 + u, final);
}
function below1000(n, final) {
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 0) return below100(r, final);
  let s = h === 1 ? "cent" : UNITS[h] + " cent" + (r === 0 && final ? "s" : "");
  if (r > 0) s += " " + below100(r, final);
  return s;
}
export function frNumber(n, reform = false) {
  let s;
  if (n < 1000) s = below1000(n, true);
  else {
    const th = Math.floor(n / 1000), r = n % 1000;
    s = (th === 1 ? "mille" : below1000(th, false) + " mille") + (r > 0 ? " " + below1000(r, true) : "");
  }
  return reform ? s.replaceAll(" ", "-") : s;
}
// Feminine for heure and minute: une, vingt et une, quatre-vingt-une.
export const frFem = (n, reform = false) => frNumber(n, reform).replace(/(^|[ -])un$/, "$1une");

// ------------------------------------------------------------ speech

let voice = null;
export function frenchVoice() {
  if (!("speechSynthesis" in window)) return null;
  voice ??= speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr")) ?? null;
  return voice;
}
export function onVoices(fn) {
  if (!("speechSynthesis" in window)) return fn(null);
  fn(frenchVoice());
  speechSynthesis.addEventListener?.("voiceschanged", () => { voice = null; fn(frenchVoice()); });
}
// say speaks French text; it returns false when there is no French voice.
export function say(text) {
  const v = frenchVoice();
  if (!v) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.9;
  speechSynthesis.speak(u);
  return true;
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// setState marks an input right, close or wrong (styles in the markup).
export function mark(input, state) {
  if (state === "empty") delete input.dataset.state;
  else input.dataset.state = state;
}
