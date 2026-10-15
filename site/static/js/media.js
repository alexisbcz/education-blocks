// Media literacy tools. Every block root is prefixed data-media-*, so this
// module does nothing on other pages. User text only reaches the DOM through
// textContent or form values, never innerHTML. All examples are synthetic.

import { scrubAll } from "./scrub.js";
import { el, text, frame, num } from "./plot.js";
import { parseExif, buildSample } from "./media-exif.js";

// ------------------------------------------------------------ helpers

function mk(tag, cls = "", txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
const fields = (root) => Object.fromEntries([...root.querySelectorAll("[data-media-field]")].map((n) => [n.dataset.mediaField, n]));
const setCopy = (root, t) => root.querySelectorAll("[data-media-copy]").forEach((b) => (b.dataset.copy = t));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const intFmt = new Intl.NumberFormat("en");

// A flag row: level "warn" | "info" | "ok".
function flag(level, title, body) {
  const tone = { warn: "border-del/40 bg-del/8", info: "border-border bg-background", ok: "border-add/40 bg-add/8" }[level];
  const mark = { warn: "!", info: "i", ok: "✓" }[level];
  const markTone = { warn: "text-del", info: "text-muted-foreground", ok: "text-add" }[level];
  const li = mk("li", `enter flex gap-2.5 rounded-lg border p-2.5 text-sm ${tone}`);
  li.append(mk("span", `mt-px w-3 shrink-0 text-center font-mono text-xs font-semibold ${markTone}`, mark));
  const d = mk("div", "flex flex-col gap-0.5");
  d.append(mk("span", "font-medium", title));
  if (body) d.append(mk("span", "text-muted-foreground", body));
  li.append(d);
  return li;
}

// ============================================================ 1. SIFT

const SIFT = [
  {
    title: "Stop",
    move: "Before reacting or sharing, pause. Notice the urgency (“Share before they bury this!”) and the anger it asks for. Ask yourself whether you know this account and what you would need to know first.",
    find: "You have never heard of Riverton Watch. The post is built to be shared fast, not checked.",
  },
  {
    title: "Investigate the source",
    move: "Spend a minute on who is behind the claim, using other sites rather than the account's own bio: search the name, look for an organisation, an editor, a track record.",
    find: "Searches show the account is three weeks old. All its posts link to survey-results.example, which names no authors and no organisation.",
  },
  {
    title: "Find better coverage",
    move: "Search the claim itself, not the post. If something this striking were true, trusted local outlets or official sources would have covered it.",
    find: "The Riverton Courier (fictional) reported last year's district health survey: 12% of 2,340 students said they skipped breakfast on most school days. Nobody reports a “1 in 3” figure.",
  },
  {
    title: "Trace the claim",
    move: "Follow the link back to the original source and compare it with what the post says: who was asked, when, how many, and what exactly they were asked.",
    find: "survey-results.example quotes a 2019 class project: 14 of 42 students at one school said they had skipped breakfast that morning. 14 of 42 is 1 in 3, but it is one school, one morning, four years ago, and not “every day”.",
  },
];

for (const root of document.querySelectorAll("[data-media-sift]")) {
  const panel = root.querySelector("[data-media-sift-panel]");
  const pips = [...root.querySelectorAll("[data-media-sift-go]")];
  const count = root.querySelector("[data-media-sift-count]");
  const stamp = root.querySelector("[data-media-sift-stamp]");
  const verdict = root.querySelector("[data-media-sift-verdict]");
  const back = root.querySelector('[data-media-sift-step="-1"]');
  const next = root.querySelector('[data-media-sift-step="1"]');
  const visited = new Set([0]);
  let at = 0;

  const go = (i) => {
    at = Math.max(0, Math.min(SIFT.length - 1, i));
    visited.add(at);
    const s = SIFT[at];
    panel.replaceChildren();
    panel.append(mk("span", "font-mono text-[11px] tracking-wider text-muted-foreground uppercase", `Move ${at + 1} of 4`));
    panel.append(mk("h4", "text-lg font-semibold tracking-tight", s.title));
    panel.append(mk("p", "text-sm leading-relaxed", s.move));
    const f = mk("div", "enter mt-auto flex flex-col gap-1 rounded-lg border border-brand/30 bg-background p-3 text-sm leading-relaxed");
    f.append(mk("span", "font-mono text-[11px] tracking-wider text-brand uppercase", "What a quick check turns up"));
    f.append(mk("span", "", s.find));
    panel.append(f);
    pips.forEach((p, k) => {
      p.toggleAttribute("data-on", k === at);
      p.toggleAttribute("data-done", visited.has(k) && k !== at);
    });
    count.textContent = `${at + 1} / ${SIFT.length}`;
    back.disabled = at === 0;
    next.disabled = at === SIFT.length - 1;
    const all = visited.size === SIFT.length;
    stamp.hidden = !all;
    verdict.textContent = "Missing context: a 2019 class poll of 42 students at one school, presented as a new city-wide study.";
  };

  pips.forEach((p) => p.addEventListener("click", () => go(Number(p.dataset.mediaSiftGo))));
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => go(at + 1));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  });
  go(0);
}

// ============================================================ 2. Lateral reading

const LATERAL = {
  vertical: [
    { id: "about", label: "About us", url: "https://cbnr.example/about", delta: 12, fact: null,
      text: "“The Center for Balanced Nutrition Research is an independent, non-profit centre of scientists dedicated to balanced, evidence-based nutrition since 2004.”" },
    { id: "experts", label: "Our experts", url: "https://cbnr.example/experts", delta: 8, fact: null,
      text: "Twelve smiling headshots, each with “Dr.” and a title such as Senior Fellow. No publication lists, no institutions." },
    { id: "research", label: "Research", url: "https://cbnr.example/research", delta: 8, fact: null,
      text: "“Over 200 studies published.” The list links to the centre's own PDFs, none in a journal you can look up." },
    { id: "testimonials", label: "Testimonials", url: "https://cbnr.example/praise", delta: 5, fact: null,
      text: "Quotes praising the centre's “common-sense science”, signed with first names and towns." },
  ],
  lateral: [
    { id: "encyclopedia", label: "encyclopedia.example: Center for Balanced Nutrition Research", url: "https://encyclopedia.example/wiki/CBNR", delta: -25, fact: "It is funded by a sweetener trade association.",
      text: "“The CBNR is an advocacy group funded by the Sweetener Producers Council, a trade association. Its reports are not peer-reviewed.” (All names fictional.)" },
    { id: "factcheck", label: "factcheck.example: CBNR claims rated", url: "https://factcheck.example/tag/cbnr", delta: -15, fact: "Fact-checkers rated three of its claims misleading.",
      text: "Three CBNR claims about sugar and children's health rated “misleading”: each cited the centre's own unpublished reports." },
    { id: "news", label: "Riverton Courier: “Trade group behind nutrition ‘centre’”", url: "https://rivertoncourier.example/2023/cbnr", delta: -12, fact: "A local paper reported who runs it.",
      text: "A 2023 article (fictional) found the centre shares an office and two directors with the Sweetener Producers Council." },
    { id: "registry", label: "charities.example: registry entry", url: "https://charities.example/org/48211", delta: -10, fact: "It is registered as a trade association, not a research body.",
      text: "The public registry lists the CBNR as a trade association, not a research institute or charity." },
  ],
};

for (const root of document.querySelectorAll("[data-media-lateral]")) {
  const list = root.querySelector("[data-media-lat-list]");
  const detail = root.querySelector("[data-media-lat-detail]");
  const url = root.querySelector("[data-media-lat-url]");
  const bar = root.querySelector("[data-media-lat-bar]");
  const take = root.querySelector("[data-media-lat-take]");
  const o = outs(root);
  let mode = "vertical";
  let opened = new Set();

  const score = () => {
    let s = 50;
    for (const m of ["vertical", "lateral"]) for (const it of LATERAL[m]) if (opened.has(it.id)) s += it.delta;
    return Math.max(2, Math.min(98, s));
  };
  const facts = () => LATERAL.lateral.filter((it) => opened.has(it.id) && it.fact).map((it) => it.fact);

  function render() {
    list.replaceChildren();
    for (const it of LATERAL[mode]) {
      const b = mk("button", "flex flex-col items-start gap-1 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[open]:border-brand/50");
      b.type = "button";
      if (opened.has(it.id)) b.dataset.open = "";
      b.append(mk("span", "font-medium", it.label));
      b.append(mk("span", "font-mono text-[11px] text-muted-foreground truncate max-w-full", it.url.replace("https://", "")));
      b.addEventListener("click", () => {
        opened.add(it.id);
        url.textContent = it.url;
        detail.replaceChildren(mk("p", "enter", it.text));
        render();
      });
      list.append(b);
    }
    const s = score();
    bar.style.width = `${s}%`;
    o.read.textContent = String(opened.size);
    const f = facts();
    o.know.textContent = f.length ? `${f.length} fact${f.length > 1 ? "s" : ""} about the source` : "only what it says about itself";
    take.textContent =
      f.length >= 2 ? "Reading laterally, a few minutes on other sites told you who funds the centre, something its own pages never mention."
      : f.length === 1 ? "One outside source already changes the picture. Open another to confirm it."
      : opened.size >= 3 ? "Every page you read made the centre look more credible, because every page was written by the centre. Try opening new tabs instead."
      : "Click pages to investigate. Switch strategy with the tabs above.";
  }

  root.addEventListener("seg-change", (e) => {
    mode = e.detail.value;
    detail.replaceChildren(mk("p", "text-muted-foreground", mode === "lateral" ? "Search results for “Center for Balanced Nutrition Research”, in new tabs. Open one." : "Pages of cbnr.example. Open one."));
    render();
  });
  root.querySelector("[data-media-lat-reset]").addEventListener("click", () => {
    opened = new Set();
    url.textContent = "https://cbnr.example/";
    detail.replaceChildren(mk("p", "text-muted-foreground", "Pages of the site itself. Open one, or switch to new tabs."));
    render();
  });
  detail.replaceChildren(mk("p", "text-muted-foreground", "Pages of the site itself. Open one, or switch to new tabs."));
  render();
}

// ============================================================ 3. URL inspector

// A small subset of the Public Suffix List (publicsuffix.org), enough for
// the examples. "example" is reserved (RFC 2606) and treated as a TLD here.
const SUFFIXES = new Set(["com", "org", "net", "edu", "gov", "io", "fr", "de", "uk", "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.jp", "ne.jp", "com.br", "github.io", "example"]);
const TLD_LIKE = new Set(["com", "org", "net", "co", "uk", "gov", "edu", "io", "fr", "de"]);

function inspect(input) {
  let raw = input.trim();
  if (!raw) return { error: "Paste a link to inspect." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = "https://" + raw;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { error: "The browser cannot parse this as a URL." };
  }
  const host = u.hostname;
  const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  const labels = host.split(".");
  let suffix = "", registrable = "", sub = "";
  if (!isIP) {
    for (let i = 0; i < labels.length; i++) {
      const cand = labels.slice(i).join(".");
      if (SUFFIXES.has(cand)) {
        suffix = cand;
        if (i > 0) {
          registrable = labels.slice(i - 1).join(".");
          sub = labels.slice(0, i - 1).join(".");
        }
        break;
      }
    }
    if (!suffix) { suffix = labels.at(-1); registrable = labels.slice(-2).join("."); sub = labels.slice(0, -2).join("."); }
  }
  // The host as typed, before the browser's punycode conversion.
  const typedHost = (input.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/:?#]+)/i) || [])[1] || host;
  return { u, host, typedHost, isIP, suffix, registrable, sub };
}

for (const root of document.querySelectorAll("[data-media-url]")) {
  const input = root.querySelector('[data-media-field="url"]');
  const barEl = root.querySelector("[data-media-url-bar]");
  const parts = root.querySelector("[data-media-url-parts]");
  const flagsEl = root.querySelector("[data-media-url-flags]");

  function render() {
    const r = inspect(input.value);
    barEl.replaceChildren();
    parts.replaceChildren();
    flagsEl.replaceChildren();
    if (r.error) {
      barEl.append(mk("span", "text-muted-foreground", r.error));
      return;
    }
    const { u } = r;
    // The address with the owner highlighted.
    barEl.append(mk("span", "text-muted-foreground", u.protocol + "//"));
    if (u.username) barEl.append(mk("span", "text-del line-through decoration-del/50", u.username + (u.password ? ":" + u.password : "") + "@"));
    if (r.isIP) barEl.append(mk("span", "font-semibold text-brand", r.host));
    else {
      if (r.sub) barEl.append(mk("span", "text-muted-foreground", r.sub + "."));
      barEl.append(mk("span", "rounded-sm bg-brand/12 px-0.5 font-semibold text-brand", r.registrable));
    }
    barEl.append(mk("span", "text-muted-foreground", (u.port ? ":" + u.port : "") + u.pathname + u.search + u.hash));

    const row = (k, v) => {
      parts.append(mk("dt", "text-muted-foreground", k));
      parts.append(mk("dd", "break-all", v || "—"));
    };
    row("scheme", u.protocol.replace(":", ""));
    if (u.username) row("user info", u.username + (u.password ? ":••••" : ""));
    row("host (as the browser sees it)", r.host);
    if (r.typedHost !== r.host) row("host (as typed)", r.typedHost);
    row("public suffix", r.isIP ? "— (IP address)" : r.suffix);
    row("registrable domain", r.isIP ? r.host : r.registrable);
    row("subdomain", r.sub);
    row("path", u.pathname);
    row("query", u.search.slice(1));
    row("fragment", u.hash.slice(1));

    let warned = false;
    const warn = (t, b) => { warned = true; flagsEl.append(flag("warn", t, b)); };
    if (u.username) warn("Text before “@” is not the site", `Everything before @ is a user name. This link goes to ${r.host}.`);
    if (r.isIP) warn("Bare IP address", "Real organisations almost always use a domain name for sign-in pages.");
    if ([...r.typedHost].some((c) => c.charCodeAt(0) > 127)) warn("Non-Latin letters in the domain", `It looks like plain text but the browser reads it as ${r.host}: a look-alike (homograph) of another name.`);
    if (!r.isIP && r.sub && r.sub.split(".").some((l) => TLD_LIKE.has(l))) warn("A domain hidden in the subdomain", `“${r.sub}” is only a subdomain. The site belongs to ${r.registrable}.`);
    if (!r.isIP && /[a-z][01][a-z]/i.test(r.registrable.split(".")[0])) warn("Digits standing in for letters", `“${r.registrable}” mixes digits into a word (0 for o, 1 for l): a common look-alike trick.`);
    if (u.protocol === "http:") flagsEl.append(flag("info", "Not encrypted (http)", "Anything typed here travels in the clear."));
    if (/login|verify|account|secure|password/i.test(u.pathname + u.search) && warned) flagsEl.append(flag("info", "Asks for an account", "Sign-in pages are what look-alike links usually imitate."));
    if (!warned) flagsEl.append(flag("ok", "Nothing unusual in the structure", `The site belongs to ${r.isIP ? r.host : r.registrable}. Still ask: is that who you expected?`));
  }

  input.addEventListener("input", render);
  root.querySelectorAll("[data-media-url-preset]").forEach((b) =>
    b.addEventListener("click", () => { input.value = b.dataset.mediaUrlPreset; render(); }));
  render();
}

// ============================================================ 4. Headline vs body

const HEADLINES = [
  {
    h: "Coffee cures memory loss, scientists say",
    b: "A small pilot study of 24 adults, published by researchers at the fictional Riverton University, found that participants who drank two cups of coffee scored slightly higher on one memory test than those who drank none. The authors said the results were preliminary and could be due to chance. “This does not show that coffee prevents or reverses memory loss,” said lead author Dr. Sam Okafor. Larger trials would be needed, according to the paper.",
  },
  {
    h: "Small pilot study: coffee linked to slightly higher memory test scores",
    b: "A small pilot study of 24 adults, published by researchers at the fictional Riverton University, found that participants who drank two cups of coffee scored slightly higher on one memory test than those who drank none. The authors said the results were preliminary and could be due to chance. “This does not show that coffee prevents or reverses memory loss,” said lead author Dr. Sam Okafor. Larger trials would be needed, according to the paper.",
  },
  {
    h: "Riverton rents soar 40% in a year",
    b: "Average advertised rents for one-bedroom flats in Riverton rose 14% between March last year and March this year, according to listings data compiled by the fictional Riverton Housing Office. Rents for larger homes rose less. In the city centre, rents are up by two-fifths since 2018, the office said, while rents on the outskirts were roughly flat.",
  },
];
const CERTAIN = /\b(cures?|proves?|prevents?|causes?|always|never|all|every|guarantees?|destroys?|slams?|soars?|plunges?|shocking|miracle|breakthrough)\b/gi;
const HEDGES = /\b(may|might|could|suggests?|preliminary|early|small|pilot|possible|possibly|likely|associated|linked?|links|correlat\w*|not yet|unclear|appears?|roughly|about|estimated?)\b/gi;
const HEDGE_WORD = new RegExp(`^(?:${HEDGES.source})$`, "i");
const SOURCES = /\b(said|says|according to|told|wrote|reported|stated|the paper|the study)\b/gi;
const STOP = new Set(["about", "after", "their", "there", "these", "those", "which", "while", "would", "could", "scientists", "experts", "study", "says"]);

for (const root of document.querySelectorAll("[data-media-headline]")) {
  const f = fields(root);
  const marked = root.querySelector("[data-media-hl-marked]");
  const findings = root.querySelector("[data-media-hl-findings]");
  const o = outs(root);

  function render() {
    const hl = f.headline.value, body = f.body.value;
    const nums = hl.match(/\d+(?:[.,]\d+)?%?/g) || [];
    const bodyNums = new Set((body.match(/\d+(?:[.,]\d+)?%?/g) || []));
    const missingNums = nums.filter((n) => !bodyNums.has(n));
    const certain = [...new Set((hl.match(CERTAIN) || []).map((w) => w.toLowerCase()))];
    const hedges = body.match(HEDGES) || [];
    const hlHedged = (hl.match(HEDGES) || []).length > 0;
    const sources = (body.match(SOURCES) || []).length;
    const words = (s) => (s.toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !STOP.has(w));
    const bodyText = body.toLowerCase();
    const missingWords = [...new Set(words(hl))].filter((w) => !certain.includes(w) && !HEDGE_WORD.test(w) && !bodyText.includes(w.replace(/s$/, "")));

    // The body with hedges and numbers marked, built from text nodes.
    marked.replaceChildren();
    const re = new RegExp(`${HEDGES.source}|\\d+(?:[.,]\\d+)?%?`, "gi");
    let last = 0;
    for (const m of body.matchAll(re)) {
      marked.append(document.createTextNode(body.slice(last, m.index)));
      const isNum = /\d/.test(m[0]);
      const cls = isNum
        ? (nums.includes(m[0]) ? "rounded-sm bg-add/15 px-0.5 font-medium" : "rounded-sm bg-foreground/8 px-0.5")
        : "rounded-sm bg-vec-out/20 px-0.5";
      marked.append(mk("mark", cls + " text-foreground", m[0]));
      last = m.index + m[0].length;
    }
    marked.append(document.createTextNode(body.slice(last)));
    if (!body.trim()) marked.append(mk("span", "text-muted-foreground", "The article body appears here with hedges and numbers marked."));

    findings.replaceChildren();
    if (missingNums.length) findings.append(flag("warn", `Headline number not in the article: ${missingNums.join(", ")}`, "Check where it comes from: a different period, place or group?"));
    if (certain.length && hedges.length >= 2) findings.append(flag("warn", `Certain headline, cautious article`, `The headline says “${certain.join("”, “")}”; the body hedges ${hedges.length} times.`));
    if (missingWords.length) findings.append(flag("info", "Headline words the article never uses", missingWords.slice(0, 6).join(", ")));
    if (sources === 0 && body.trim()) findings.append(flag("info", "No attribution found", "Nobody is quoted or cited by name."));
    if (!findings.children.length && body.trim()) findings.append(flag("ok", "Headline and article agree", "Its numbers and claims appear in the text."));

    o.nums.textContent = nums.length ? `${nums.length - missingNums.length} of ${nums.length}` : "none in headline";
    o.hedges.textContent = String(hedges.length);
    o.sources.textContent = String(sources);
    o.gap.textContent = certain.length && hedges.length >= 2 ? "high" : certain.length ? "medium" : hlHedged ? "low (hedged headline)" : "low";
  }

  const load = (i) => { f.headline.value = HEADLINES[i].h; f.body.value = HEADLINES[i].b; render(); };
  root.querySelectorAll("[data-media-hl-preset]").forEach((b) => b.addEventListener("click", () => load(Number(b.dataset.mediaHlPreset))));
  f.headline.addEventListener("input", render);
  f.body.addEventListener("input", render);
  load(0);
}

// ============================================================ 5. Relative vs absolute risk

for (const root of document.querySelectorAll("[data-media-risk]")) {
  const o = outs(root);
  const svg = root.querySelector("[data-media-risk-icons]");
  const rel = root.querySelector("[data-media-risk-rel]");
  const abs = root.querySelector("[data-media-risk-abs]");
  const pp = root.querySelector("[data-media-risk-pp]");
  const s = scrubAll(root, draw);
  const per = (p, n) => {
    const v = p * n;
    return v >= 100 ? intFmt.format(Math.round(v)) : num(v, v >= 10 ? 1 : 2).replace(/\.?0+$/, "");
  };

  function draw() {
    const r0 = s.base.get() / 10000, rr = s.rr.get();
    const r1 = Math.min(1, r0 * rr);
    const ard = r1 - r0;
    const relPct = (rr - 1) * 100;
    const word = rr === 2 ? "doubles" : rr === 3 ? "triples" : rr > 1 ? `raises by ${num(relPct, 0)}%` : rr < 1 ? `cuts by ${num(-relPct, 0)}%` : "does not change";
    rel.textContent = `Eating Snack X ${word} the risk of Condition Y`;
    const N = r1 * 1000 >= 5 ? 1000 : 10000;
    abs.textContent = rr === 1 ? `No difference: ${per(r0, N)} in ${intFmt.format(N)} either way`
      : `${cap(per(r0, N))} in ${intFmt.format(N)} people without it, ${per(r1, N)} in ${intFmt.format(N)} with it`;

    o.r0.textContent = `${per(r0, 10000)}\u00a0/\u00a010,000`;
    o.r1.textContent = `${per(r1, 10000)}\u00a0/\u00a010,000`;
    o.ard.textContent = `${ard >= 0 ? "+" : "−"}${num(Math.abs(ard) * 100, Math.abs(ard) < 0.001 ? 3 : 2)}`;
    o.rel.textContent = rr === 1 ? "0%" : `${relPct > 0 ? "+" : "−"}${num(Math.abs(relPct), 0)}%`;
    o.nnh.textContent = ard !== 0 ? intFmt.format(Math.ceil(1 / Math.abs(ard))) + (ard < 0 ? " (to prevent one)" : "") : "—";

    // Icon array: N people, base cases first, then the extra (or avoided) cases.
    svg.replaceChildren();
    const cols = N === 1000 ? 50 : 200, rows = N / cols;
    const W = 720, H = 272, cell = Math.min(W / cols, H / rows), size = cell * (N === 1000 ? 0.74 : 0.8);
    svg.setAttribute("aria-label", `Icon array of ${intFmt.format(N)} people`);
    const base = Math.round(r0 * N), all = Math.round(r1 * N);
    const lo = Math.min(base, all), hi = Math.max(base, all);
    let d0 = "", d1 = "", d2 = "";
    for (let i = 0; i < N; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      const sq = `M${(x + (cell - size) / 2).toFixed(2)} ${(y + (cell - size) / 2).toFixed(2)}h${size.toFixed(2)}v${size.toFixed(2)}h${(-size).toFixed(2)}Z`;
      if (i < lo) d1 += sq;
      else if (i < hi) d2 += sq;
      else d0 += sq;
    }
    el("path", { d: d0, style: "fill:currentColor;fill-opacity:0.1" }, svg);
    el("path", { d: d1, style: "fill:var(--vec-u)" }, svg);
    el("path", { d: d2, style: `fill:${rr >= 1 ? "var(--brand)" : "var(--code-add)"}` }, svg);
    const ty = rows * cell + 22;
    svg.setAttribute("viewBox", `0 0 720 ${Math.ceil(ty + 8)}`);
    text(svg, 0, ty, `${intFmt.format(N)} people, one square each`, { class: "fill-muted-foreground font-mono text-[13px]" });
    text(svg, cols * cell, ty, rr >= 1 ? `${intFmt.format(hi - lo)} extra case${hi - lo === 1 ? "" : "s"}` : `${intFmt.format(hi - lo)} fewer`, { "text-anchor": "end", class: "fill-foreground font-mono text-[13px]" });

    const a = s.from.get(), b = s.to.get();
    const dpp = b - a, dpc = a ? ((b - a) / a) * 100 : NaN;
    pp.textContent = a
      ? `From ${num(a, 1)}% to ${num(b, 1)}% is ${dpp >= 0 ? "a rise" : "a fall"} of ${num(Math.abs(dpp), 1)} percentage points, which is ${num(Math.abs(dpc), 1)}% ${dpp >= 0 ? "more" : "less"} than before. Headlines that say “${num(Math.abs(dpc), 0)}%” and “${num(Math.abs(dpp), 0)} points” describe the same change.`
      : "From 0%, a percent change is undefined; only percentage points make sense.";
  }
  draw();
}

// ============================================================ 6. News chart

const RIDERS = [55.2, 54.6, 54.1, 53.5, 52.9, 52.4, 51.8, 51.3, 50.9, 50.4, 49.8, 50.8]; // millions per quarter, synthetic
const QUARTERS = ["Q1 '21", "Q2", "Q3", "Q4", "Q1 '22", "Q2", "Q3", "Q4", "Q1 '23", "Q2", "Q3", "Q4"];

for (const root of document.querySelectorAll("[data-media-chart]")) {
  const svg = root.querySelector("[data-media-chart-plot]");
  const title = root.querySelector("[data-media-chart-title]");
  const o = outs(root);
  const opt = { zero: false, window: false, calm: false };
  root.querySelectorAll("[data-toggle]").forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { opt[sw.dataset.toggle] = e.detail.checked; draw(); }));

  function draw() {
    const vals = opt.window ? RIDERS : RIDERS.slice(-2);
    const labs = opt.window ? QUARTERS : ["Q3 '23", "Q4 '23"];
    const lo = opt.zero ? 0 : 49, hi = opt.zero ? 60 : 51.2;
    svg.replaceChildren();
    const ticks = opt.zero ? [0, 20, 40, 60] : [49, 50, 51];
    const f = frame(svg, { box: [44, 14, 460, 236], x: [0, vals.length], y: [lo, hi], xticks: [], yticks: ticks, ylabel: "riders (millions)" });
    const bw = (f.W / vals.length) * 0.66;
    vals.forEach((v, i) => {
      const x = f.sx(i + 0.5) - bw / 2, y = f.sy(Math.max(lo, Math.min(hi, v)));
      const last = i === vals.length - 1;
      el("rect", { x, y, width: bw, height: f.T + f.H - y, rx: 2, style: `fill:${last ? "var(--brand)" : "var(--vec-u)"};fill-opacity:${last ? 0.9 : 0.55}` }, svg);
      if (!opt.window || i % 2 === 1 || last) text(svg, f.sx(i + 0.5), f.T + f.H + 14, labs[i], { "text-anchor": "middle" });
      if (!opt.window || last) text(svg, f.sx(i + 0.5), y - 6, num(v, 1), { "text-anchor": "middle", class: "fill-foreground font-mono text-[11px]" });
    });
    const v1 = RIDERS.at(-2), v2 = RIDERS.at(-1);
    const dataChange = (v2 - v1) / v1;
    const drawnChange = (v2 - lo - (v1 - lo)) / (v1 - lo);
    o.data.textContent = `+${num(dataChange * 100, 1)}%`;
    o.drawn.textContent = `+${num(drawnChange * 100, 0)}%`;
    o.lie.textContent = `${num(drawnChange / dataChange, 1)}×`;
    title.textContent = opt.calm
      ? "Ridership ticks up 2% after three years of decline"
      : "Ridership SOARS as new timetable wins riders back";
  }
  draw();
}

// ============================================================ 7. Inverted pyramid

for (const root of document.querySelectorAll("[data-media-pyramid]")) {
  const f = fields(root);
  const story = root.querySelector("[data-media-pyr-story]");
  const o = outs(root);

  function render() {
    const v = (k) => f[k].value.trim();
    const ledeParts = [v("who"), v("what"), v("when"), v("where")].filter(Boolean);
    let lede = ledeParts.join(" ");
    if (v("why")) lede += (lede ? ", " : "") + v("why");
    lede = cap(lede) + (lede && !/[.!?]$/.test(lede) ? "." : "");
    const how = v("how") ? cap(v("how")) + (/[.!?]$/.test(v("how")) ? "" : ".") : "";
    const paras = [
      ["Lede: the newest, most important fact", lede],
      ["How, and the quote that carries it", [how, v("quote")].filter(Boolean).join(" ")],
      ["Background: what a reader can skip", v("background")],
    ];
    story.replaceChildren();
    paras.forEach(([label, t], i) => {
      const d = mk("div", "flex min-h-16 flex-col gap-1");
      d.append(mk("span", "font-mono text-[10px] tracking-wider text-muted-foreground uppercase", label));
      d.append(mk("p", i === 0 ? "font-medium" : "text-muted-foreground", t || "—"));
      story.append(d);
    });
    const n = (lede.match(/\S+/g) || []).length;
    o.words.textContent = `${n}${n > 35 ? " (long: aim for about 25–35)" : ""}`;
    const covers = ["who", "what", "when", "where", "why"].filter((k) => v(k));
    o.covers.textContent = covers.length ? covers.join(", ") : "—";
    setCopy(root, paras.map((p) => p[1]).filter(Boolean).join("\n\n"));
  }
  Object.values(f).forEach((x) => x.addEventListener("input", render));
  render();
}

// ============================================================ 8. Sourcing and corrections

const LADDER = [
  { name: "On the record", def: "Everything can be published and attributed to the source by name. The default, and the most accountable.",
    ex: "“We want people back on the buses,” said council member Ana Ruiz." },
  { name: "On background", def: "The information and quotes can be used, but attributed only to a description agreed with the source, never by name.",
    ex: "“The grant only covers one year,” said a city official familiar with the budget." },
  { name: "Deep background", def: "The reporter may use the information but attribute it to no one, not even a description: it reads as the reporter's own knowledge, so it must be solid.",
    ex: "The grant is expected to cover only one year." },
  { name: "Off the record", def: "Nothing can be published. Many reporters use such material only as a lead, to find someone who will confirm it on the record.",
    ex: "(Nothing is printed. The reporter asks other officials to confirm it on the record.)" },
  { name: "Anonymous source", def: "A source granted anonymity is named only by a description. Many style guides require an editor's approval and an explanation of why anonymity was granted.",
    ex: "…said a transit employee, who asked not to be named because they were not authorised to speak publicly." },
];

for (const root of document.querySelectorAll("[data-media-sourcing]")) {
  const ladder = root.querySelector("[data-media-src-ladder]");
  const name = root.querySelector("[data-media-src-name]");
  const def = root.querySelector("[data-media-src-def]");
  const ex = root.querySelector("[data-media-src-example]");
  const btns = LADDER.map((l, i) => {
    const b = mk("button", "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/8");
    b.type = "button";
    b.append(mk("span", "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground", String(i + 1)));
    b.append(mk("span", "", l.name));
    const li = mk("li");
    li.append(b);
    ladder.append(li);
    b.addEventListener("click", () => pick(i));
    return b;
  });
  function pick(i) {
    btns.forEach((b, k) => b.toggleAttribute("data-on", k === i));
    name.textContent = LADDER[i].name;
    def.textContent = LADDER[i].def;
    ex.textContent = LADDER[i].ex;
  }
  pick(0);

  const f = fields(root);
  const note = root.querySelector("[data-media-corr-note]");
  const today = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  function renderNote() {
    const story = f.story.value.trim(), wrong = f.wrong.value.trim(), right = f.right.value.trim();
    const t = `Correction (${today}): An earlier version of “${story || "this story"}” said ${wrong || "…"}. In fact, ${right || "…"}. The story has been updated.`;
    note.textContent = t;
    setCopy(root, t);
  }
  ["story", "wrong", "right"].forEach((k) => f[k].addEventListener("input", renderNote));
  renderNote();
}

// ============================================================ 9. EXIF

for (const root of document.querySelectorAll("[data-media-exif]")) {
  const out = root.querySelector("[data-media-exif-out]");
  const file = root.querySelector("[data-media-exif-file]");
  const row = (k, v, cls = "") => {
    out.append(mk("dt", "text-muted-foreground", k));
    out.append(mk("dd", "break-all " + cls, v ?? "—"));
  };
  const fmtDate = (s) => {
    const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} (camera clock, no time zone)` : s;
  };
  function show(name, buffer) {
    out.replaceChildren();
    row("file", name);
    const r = parseExif(buffer);
    if (r.error) { row("result", r.error, "text-del"); return; }
    if (!r.tags) { row("result", "No EXIF segment: stripped, or never written.", "text-muted-foreground"); return; }
    const t = r.tags;
    row("camera", [t.make, t.model].filter(Boolean).join(" ") || null);
    row("software", t.software);
    row("taken", fmtDate(t.taken));
    row("modified", fmtDate(t.modified));
    row("orientation", t.orientation != null ? String(t.orientation) : null);
    row("byte order", t.byteOrder);
    if (t.gps && t.gps.lat != null) row("GPS", `${num(t.gps.lat, 4)}, ${num(t.gps.lon, 4)}: the place is in the file`, "text-del");
    else row("GPS", "none");
  }
  show("(nothing opened yet)", new ArrayBuffer(0));
  out.replaceChildren();
  row("file", "Open a JPEG, or load the synthetic sample.");

  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => show(`${f.name} (${intFmt.format(f.size)} bytes)`, reader.result);
    reader.onerror = () => { out.replaceChildren(); row("result", "Could not read the file.", "text-del"); };
    reader.readAsArrayBuffer(f);
  });
  root.querySelector("[data-media-exif-sample]").addEventListener("click", () => {
    const b = buildSample();
    show(`synthetic-sample.jpg (${b.byteLength} bytes, EXIF only, no picture)`, b);
  });
}

// ============================================================ 10. Persuasion

const TECHNIQUES = [
  { key: "name", name: "Name-calling", def: "Attach a bad label so the idea is rejected without being examined.", ex: "Only the tax-crazy crowd would back the new budget." },
  { key: "glitter", name: "Glittering generalities", def: "Virtue words nobody can disagree with, standing in for an argument.", ex: "Vote Yes for freedom, family and a brighter tomorrow." },
  { key: "transfer", name: "Transfer", def: "Borrow the prestige of a symbol (a flag, science, a church) for something unrelated.", ex: "A white lab coat and a flag behind an ad for Riverton Pure Water." },
  { key: "testimonial", name: "Testimonial", def: "A famous or admired person endorses something outside their expertise.", ex: "Olympic swimmer Jo Marsh trusts VitaBoost. Shouldn't you?" },
  { key: "folks", name: "Plain folks", def: "Present the speaker as an ordinary person like you, to borrow your trust.", ex: "I'm just a regular guy who fixes his own car, same as you." },
  { key: "stacking", name: "Card stacking", def: "Show only the facts that help and leave out the rest.", ex: "Our phone has the longest battery life in its class (a class of two phones)." },
  { key: "bandwagon", name: "Bandwagon", def: "Everyone is doing it, so you should too.", ex: "All of Riverton is switching. Don't be left behind." },
  { key: "loaded", name: "Loaded language", def: "Emotionally charged words that judge before they describe.", ex: "The council's reckless scheme will gut our parks." },
  { key: "dilemma", name: "False dilemma", def: "Only two options are offered when more exist.", ex: "Either we build the new road or the town dies." },
  { key: "whatabout", name: "Whataboutism", def: "Answer a criticism by pointing to someone else's fault instead.", ex: "Why worry about our factory's emissions when the next town pollutes more?" },
];
const QUIZ = [
  { q: "“Nine out of ten Riverton families already shop at FreshMart.”", a: "bandwagon" },
  { q: "“You're either with our plan or you don't care about children.”", a: "dilemma" },
  { q: "“The so-called ‘experts’ pushing this are career bureaucrats.”", a: "name" },
  { q: "“Our candidate stands for hope, strength and real change.”", a: "glitter" },
  { q: "“Famous chef Lina Park drinks VoltCola before every match.”", a: "testimonial" },
  { q: "“Critics of our bank's fees should look at the other banks' fees first.”", a: "whatabout" },
  { q: "“This vicious tax grab will strangle small businesses.”", a: "loaded" },
  { q: "“Ninety-nine reviewers loved it.” (Four hundred others were not shown.)", a: "stacking" },
  { q: "“Like you, I grew up on a farm and know what hard work means.”", a: "folks" },
  { q: "An insurance ad set against a hospital and a nurse's uniform.", a: "transfer" },
];

for (const root of document.querySelectorAll("[data-media-persuasion]")) {
  const grid = root.querySelector("[data-media-tech-grid]");
  const qEl = root.querySelector("[data-media-quiz-q]");
  const opts = root.querySelector("[data-media-quiz-options]");
  const fb = root.querySelector("[data-media-quiz-feedback]");
  const score = root.querySelector("[data-media-quiz-score]");
  const byKey = Object.fromEntries(TECHNIQUES.map((t) => [t.key, t]));

  const cards = TECHNIQUES.map((t) => {
    const c = mk("div", "flex flex-col gap-1 rounded-lg border bg-background p-3 transition-colors duration-150 data-[on]:border-brand data-[on]:bg-brand/8");
    c.append(mk("span", "text-sm font-medium", t.name));
    c.append(mk("span", "text-xs leading-relaxed text-muted-foreground", t.def));
    c.append(mk("span", "text-xs leading-relaxed italic", `“${t.ex}”`));
    grid.append(c);
    return [t.key, c];
  });

  let i = 0, right = 0, done = 0, answered = false;
  // A fixed shuffle so the quiz order is the same on every load.
  const order = [3, 0, 7, 5, 1, 9, 4, 8, 2, 6];

  function ask() {
    const item = QUIZ[order[i % QUIZ.length]];
    answered = false;
    qEl.textContent = item.q;
    fb.textContent = "";
    cards.forEach(([, c]) => c.removeAttribute("data-on"));
    // The answer plus three others, rotated by position.
    const keys = TECHNIQUES.map((t) => t.key).filter((k) => k !== item.a);
    const pickd = [item.a, keys[(i * 3) % keys.length], keys[(i * 3 + 4) % keys.length], keys[(i * 3 + 7) % keys.length]];
    const uniq = [...new Set(pickd)];
    while (uniq.length < 4) uniq.push(keys.find((k) => !uniq.includes(k)));
    const shown = uniq.sort((a, b) => byKey[a].name.localeCompare(byKey[b].name));
    opts.replaceChildren();
    for (const k of shown) {
      const b = mk("button", "rounded-md border bg-background px-2 py-1.5 text-left text-xs outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add data-[state=right]:bg-add/10 data-[state=wrong]:border-del data-[state=wrong]:bg-del/10", byKey[k].name);
      b.type = "button";
      b.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        done++;
        const ok = k === item.a;
        if (ok) right++;
        b.dataset.state = ok ? "right" : "wrong";
        if (!ok) [...opts.children].find((x) => x.textContent === byKey[item.a].name).dataset.state = "right";
        fb.textContent = ok ? `Right: ${byKey[item.a].def}` : `It's ${byKey[item.a].name}: ${byKey[item.a].def}`;
        score.textContent = `${right} / ${done}`;
        const card = cards.find(([key]) => key === item.a);
        if (card) card[1].dataset.on = "";
      });
      opts.append(b);
    }
  }
  root.querySelector("[data-media-quiz-next]").addEventListener("click", () => { i++; ask(); });
  ask();
}
