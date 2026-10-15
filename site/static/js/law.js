// Law blocks. Every block root is prefixed data-law-*, so this module does
// nothing on other pages. Cases and citations are real; fact patterns of
// the hypotheticals, likelihood ratios and money figures are invented and
// say so on the page. User text only reaches the DOM through textContent.

import { scrubAll } from "./scrub.js";
import { el, text, frame, num } from "./plot.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const outs = (root) => Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
function mk(tag, cls = "", txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}
// Segmented controls report through chrome.js's seg-change; lawSegs names them.
function onSeg(root, fn) {
  root.addEventListener("seg-change", (e) => {
    const name = e.target.closest("[data-law-seg]")?.dataset.lawSeg;
    if (name) fn(name, e.detail.value);
  });
}
const segValue = (root, name) => root.querySelector(`[data-law-seg="${name}"] [aria-selected="true"]`)?.dataset.seg;
function setSeg(root, name, value) {
  for (const b of root.querySelectorAll(`[data-law-seg="${name}"] [data-seg]`)) b.setAttribute("aria-selected", String(b.dataset.seg === value));
}
const isOn = (sw) => sw.getAttribute("aria-checked") === "true" || sw.dataset.state === "checked";

// A small pill: met (brand), unmet (del), neutral.
const PILL = "inline-flex shrink-0 items-center self-start whitespace-nowrap gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";
const TONE = {
  brand: "border-brand/50 bg-brand/10 text-[color-mix(in_oklab,var(--brand)_70%,var(--foreground))]",
  del: "border-del/50 bg-del/10 text-[color-mix(in_oklab,var(--code-del)_70%,var(--foreground))]",
  u: "border-vec-u/50 bg-vec-u/10 text-[color-mix(in_oklab,var(--vec-u)_70%,var(--foreground))]",
  muted: "border-border bg-foreground/5 text-muted-foreground",
};
const pill = (tone, t) => mk("span", `${PILL} ${TONE[tone]}`, t);

// ============================================================ L1 IRAC

const IRAC_EXAMPLE = {
  issue: "Whether Ms Lee can recover the £100 promised in BrightBreath Ltd's advertisement, although she never told the company that she accepted its offer.",
  rule: "An advertisement can be an offer to the whole world (a unilateral offer) when its terms are definite and it shows an intention to be bound. It is accepted by performing its conditions, and the offeror may dispense with notice of acceptance; doing what was asked is consideration: Carlill v Carbolic Smoke Ball Co [1893] 1 QB 256 (CA).",
  explanation: "In Carlill, the company promised £100 to anyone who caught influenza after using its smoke ball three times a day for two weeks, and said it had deposited £1,000 with its bank to show its sincerity. The Court of Appeal held that the deposit showed the promise was not mere sales puff, that the offer was made to everyone who performed the conditions, and that by its nature it dispensed with notice of acceptance.",
  application: "Here, BrightBreath promised £100 to anyone who caught a cold after using its inhaler twice a day for a month, and said it had set aside £5,000 for claims, which, like the bank deposit in Carlill, shows an intention to be bound. Ms Lee used the inhaler as directed for a month: that is the performance requested, and it is consideration because the company asked for it. She caught a cold within the period. BrightBreath may argue that the advertisement was a mere puff, but a fixed sum and a fund set aside for claims point the other way.",
  conclusion: "Ms Lee can probably recover £100: the advertisement was a unilateral offer, which she accepted by performing its conditions without needing to give notice.",
};

for (const root of document.querySelectorAll("[data-law-irac]")) {
  const fields = Object.fromEntries([...root.querySelectorAll("[data-law-field]")].map((f) => [f.dataset.lawField, f]));
  const cards = Object.fromEntries([...root.querySelectorAll("[data-law-i-card]")].map((c) => [c.dataset.lawICard, c]));
  const list = root.querySelector("[data-law-i-cards]");
  const checks = root.querySelector("[data-law-i-checks]");
  const md = root.querySelector("[data-law-i-md]");
  const copyBtn = root.querySelector("[data-law-copy]");
  let format = "irac";

  const fill = (ex) => { for (const k in fields) fields[k].value = ex ? IRAC_EXAMPLE[k] : ""; };
  const words = (s) => (s.trim().match(/\S+/g) || []).length;

  function update() {
    const v = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value.trim()]));
    const order = format === "irac" ? ["issue", "rule", "application", "conclusion"] : ["conclusion", "rule", "explanation", "application"];
    // Reorder the cards in place; the ones the format does not use hide.
    for (const k of order) list.append(cards[k]);
    for (const k in cards) {
      cards[k].hidden = !order.includes(k);
      cards[k].toggleAttribute("data-empty", !v[k]);
    }
    const items = [
      ["Issue is framed as a question", /^whether\b|\?$/i.test(v.issue), format === "irac"],
      ["Rule cites an authority (a case or a statute)", /\bv\.? |\[\d{4}\]|\(\d{4}\)|\bAct\b|\bs\.? ?\d/.test(v.rule), true],
      ["Explanation describes how a court applied the rule", words(v.explanation) >= 20, format === "creac"],
      ["Application works through the facts (40+ words)", words(v.application) >= 40, true],
      ["Application ties facts to the rule (because, so, which…)", /\b(because|so|which|since|therefore|thus)\b/i.test(v.application), true],
      ["Application deals with the other side's argument", /\b(may argue|might argue|however|although|but|on the other hand|contend)\b/i.test(v.application), true],
      ["Conclusion answers the issue", words(v.conclusion) >= 5, true],
    ].filter((i) => i[2]);
    checks.replaceChildren(...items.map(([t, ok]) => {
      const li = mk("li", "flex items-start gap-2");
      const dot = mk("span", `mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-200 ${ok ? "bg-brand" : "bg-foreground/15"}`);
      li.append(dot, mk("span", ok ? "" : "text-muted-foreground", t));
      return li;
    }));
    const title = { issue: "Issue", rule: "Rule", explanation: "Explanation", application: "Application", conclusion: "Conclusion" };
    const parts = order.map((k) => `**${title[k]}.** ${v[k] || "…"}`);
    if (format === "creac") parts.push(`**Conclusion.** ${v.conclusion || "…"}`);
    md.textContent = parts.join("\n\n");
    copyBtn.dataset.copy = md.textContent;
  }

  onSeg(root, (name, value) => {
    if (name === "format") format = value;
    if (name === "example") fill(value === "smoke");
    update();
  });
  for (const f of Object.values(fields)) f.addEventListener("input", update);
  fill(true);
  update();
}

// ============================================================ L2 elements

// status: true met, false not met, null doubtful (does not end the claim).
const DOCTRINES = {
  negligence: {
    elements: [
      ["duty", "Duty of care", "Donoghue v Stevenson [1932] AC 562; Caparo Industries plc v Dickman [1990] 2 AC 605"],
      ["breach", "Breach of duty", "Blyth v Birmingham Waterworks Co (1856) 11 Ex 781: the reasonable person"],
      ["cause", "Causation in fact", "Barnett v Chelsea and Kensington HMC [1969] 1 QB 428: but for the breach…?"],
      ["remote", "Not too remote", "The Wagon Mound (No 1) [1961] AC 388 (PC): harm of a foreseeable kind"],
      ["damage", "Actionable damage", "Personal injury, damage to property; pure economic loss only narrowly"],
    ],
    facts: {
      donoghue: {
        label: "Snail in the bottle",
        story: "Paisley, 1928. A friend bought May Donoghue a ginger beer in a café. She said the opaque bottle held a decomposed snail and that she suffered shock and gastroenteritis. She had no contract with the manufacturer, David Stevenson.",
        status: { duty: true, breach: true, cause: true, remote: true, damage: true },
        notes: {
          duty: "A manufacturer owes a duty to the ultimate consumer: Lord Atkin's neighbour principle (at 580).",
          breach: "Alleged, never tried: the Lords decided a preliminary point on assumed facts.",
          cause: "Assumed for the preliminary point.",
          remote: "Illness from a contaminated drink is exactly the kind of harm to foresee.",
          damage: "Shock and gastroenteritis: personal injury.",
        },
        outcome: "The House of Lords held (3–2) that these facts, if proved, disclosed a claim. Stevenson died before trial and the claim was settled.",
      },
      barnett: {
        label: "The casualty doctor",
        story: "London, 1966. Three night-watchmen drank tea and began vomiting. At the hospital's casualty department, the nurse phoned the doctor, who said they should go home and call their own doctors. William Barnett died that afternoon of arsenic poisoning.",
        status: { duty: true, breach: true, cause: false, remote: true, damage: true },
        notes: {
          duty: "A casualty department owes a duty to those who present themselves to it.",
          breach: "Sending them away without examination was negligent.",
          cause: "He would probably have died even if examined: treatment could not have come in time.",
          remote: "Not reached.",
          damage: "Death.",
        },
        outcome: "The claim failed on causation, although the hospital was in breach.",
      },
      wagon: {
        label: "Oil in Sydney Harbour",
        story: "Sydney, 1951. The crew of the Wagon Mound carelessly spilled furnace oil, which drifted to Morts Dock, where men were welding. Told the oil would not burn on water, the dock carried on; molten metal set fire to cotton waste floating in the oil and the wharf burned.",
        status: { duty: true, breach: true, cause: true, remote: false, damage: true },
        notes: {
          duty: "Ship operators owe a duty to those nearby who could be harmed by their oil.",
          breach: "Spilling the oil was careless.",
          cause: "But for the spill there would have been no fire.",
          remote: "On the evidence, fire was not a foreseeable kind of harm; fouling of the slipway was, but that was not what happened.",
          damage: "The wharf was burned.",
        },
        outcome: "The Privy Council rejected the direct-consequences test of Re Polemis [1921] 3 KB 560: the claim failed for remoteness. A Privy Council decision, but followed in England.",
      },
    },
  },
  contract: {
    elements: [
      ["offer", "Offer", "A definite promise, made with intent to be bound on acceptance; not an invitation to treat (Fisher v Bell [1961] 1 QB 394)"],
      ["accept", "Acceptance", "Unqualified agreement to the offer's terms; a counter-offer rejects it (Hyde v Wrench (1840) 3 Beav 334)"],
      ["consid", "Consideration", "Each side gives something of value: Currie v Misa (1875) LR 10 Ex 153"],
      ["intent", "Intention to create legal relations", "Presumed in commercial dealings, presumed absent in domestic ones: Balfour v Balfour [1919] 2 KB 571"],
      ["certain", "Certainty of terms", "Scammell and Nephew Ltd v Ouston [1941] AC 251: 'on hire-purchase terms' too vague"],
    ],
    facts: {
      carlill: {
        label: "The smoke ball",
        story: "London, 1891. The Carbolic Smoke Ball Co advertised £100 to anyone who caught influenza after using its smoke ball three times a day for two weeks, adding that £1,000 had been deposited with its bank. Louisa Carlill did so and caught influenza.",
        status: { offer: true, accept: true, consid: true, intent: true, certain: true },
        notes: {
          offer: "A unilateral offer to the world, not an invitation to treat: the deposit showed it was meant.",
          accept: "Accepted by performing the conditions; notice was dispensed with.",
          consid: "Using the ball as directed, at the company's request.",
          intent: "The £1,000 deposit answered the 'mere puff' defence.",
          certain: "The terms were vague about how long the protection lasted, but the court construed them.",
        },
        outcome: "The Court of Appeal held there was a binding contract: Mrs Carlill recovered £100.",
      },
      hyde: {
        label: "The counter-offer",
        story: "1840. Wrench offered to sell his farm to Hyde for £1,000. Hyde replied offering £950, which Wrench refused. Hyde then said he would pay £1,000 after all; Wrench would not sell.",
        status: { offer: true, accept: false, consid: true, intent: true, certain: true },
        notes: {
          offer: "£1,000 for the farm: a definite offer.",
          accept: "Hyde's £950 was a counter-offer that rejected the original offer, which could no longer be accepted.",
          consid: "Would have been present: the price for the land.",
          intent: "A commercial sale of land.",
          certain: "Parties, property and price were settled.",
        },
        outcome: "No contract: Hyde's later 'acceptance' was of an offer that no longer existed.",
      },
      balfour: {
        label: "Husband and wife",
        story: "1916. Mr Balfour, home on leave from Ceylon, agreed to pay his wife £30 a month while she stayed in England for her health. They later separated and he stopped paying.",
        status: { offer: true, accept: true, consid: null, intent: false, certain: true },
        notes: {
          offer: "A promise of £30 a month.",
          accept: "Mrs Balfour agreed to the arrangement.",
          consid: "Doubted by some of the judges; the case is cited for intention.",
          intent: "Arrangements between spouses living together are presumed not to be meant as binding (Atkin LJ).",
          certain: "The amount and the period were clear enough.",
        },
        outcome: "The Court of Appeal held there was no enforceable contract.",
      },
    },
  },
};

for (const root of document.querySelectorAll("[data-law-elements]")) {
  const factsBox = root.querySelector("[data-law-e-facts]");
  const story = root.querySelector("[data-law-e-story]");
  const list = root.querySelector("[data-law-e-list]");
  const verdict = root.querySelector("[data-law-e-verdict]");
  let doctrine = "negligence", factKey = "donoghue", status = {};

  function pickFacts(key) {
    factKey = key;
    status = { ...DOCTRINES[doctrine].facts[key].status };
    for (const b of factsBox.children) b.setAttribute("aria-checked", String(b.dataset.key === key));
    render();
  }
  function buildFacts() {
    const facts = DOCTRINES[doctrine].facts;
    factsBox.replaceChildren(...Object.entries(facts).map(([k, f]) => {
      const b = mk("button", "rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-checked:bg-accent aria-checked:text-foreground", f.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.key = k;
      b.addEventListener("click", () => pickFacts(k));
      return b;
    }));
    pickFacts(Object.keys(facts)[0]);
  }
  function render() {
    const d = DOCTRINES[doctrine], f = d.facts[factKey];
    story.replaceChildren(mk("span", "mr-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase", "Facts"), document.createTextNode(f.story));
    let failed = null;
    list.replaceChildren(...d.elements.map(([key, name, auth], i) => {
      const s = status[key];
      const changed = s !== f.status[key];
      const after = failed !== null;
      if (s === false && failed === null) failed = name;
      const li = mk("li", `grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-background p-3 transition-opacity duration-200 ${after ? "opacity-50" : ""}`);
      li.append(mk("span", "mt-0.5 font-mono text-xs text-muted-foreground tabular-nums", String(i + 1).padStart(2, "0")));
      const body = mk("div", "flex min-w-0 flex-col gap-0.5");
      body.append(mk("span", "text-sm font-medium", name), mk("span", "font-mono text-[11px] leading-relaxed text-muted-foreground", auth),
        mk("span", "text-sm leading-relaxed", changed ? "Changed by you: what if this element came out the other way?" : f.notes[key]));
      li.append(body);
      const b = mk("button", `${PILL} ${s === true ? TONE.brand : s === false ? TONE.del : TONE.u} cursor-pointer outline-none transition-[transform,background-color] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50`,
        s === true ? "met" : s === false ? "not met" : "doubtful");
      b.type = "button";
      b.setAttribute("aria-label", `${name}: ${b.textContent}. Click to flip.`);
      b.addEventListener("click", () => { status[key] = s === true ? false : true; render(); });
      li.append(b);
      return li;
    }));
    const changedAny = d.elements.some(([k]) => status[k] !== f.status[k]);
    verdict.toggleAttribute("data-ok", !failed);
    verdict.replaceChildren(
      mk("span", "font-medium", failed ? `Fails at: ${failed}.` : "Every element is made out."),
      mk("span", "text-muted-foreground", changedAny ? "You changed the facts; the court's actual outcome:" : "What the court held:"),
      mk("span", "", f.outcome),
    );
  }
  onSeg(root, (name, value) => {
    if (name !== "doctrine") return;
    doctrine = value;
    buildFacts();
  });
  buildFacts();
}

// ============================================================ L3 precedent

const COURTS = {
  ew: {
    courts: [
      ["uksc", "UK Supreme Court", "House of Lords before 2009"],
      ["ca", "Court of Appeal", "Civil and Criminal Divisions"],
      ["hc", "High Court", "a single judge"],
      ["lower", "County Court, Crown Court, magistrates", "trial courts"],
      ["pc", "Privy Council", "final appeals from some Commonwealth states"],
      ["echr", "European Court of Human Rights", "Strasbourg"],
      ["foreign", "Courts of other common-law countries", "Australia, Canada, the US…"],
    ],
    deciders: ["uksc", "ca", "hc", "lower"],
    // [status, reason] for (decider, source); "b" binding, "p" persuasive,
    // "x" binding by practice, with exceptions.
    rules: (d, s) => {
      const rank = { uksc: 0, ca: 1, hc: 2, lower: 3 };
      if (s === "echr") return ["p", "Must be taken into account, but does not bind: Human Rights Act 1998 s 2."];
      if (s === "pc") return ["p", "Persuasive, often highly so; it can bind only where the Board expressly directs it (Willers v Joyce [2016] UKSC 44)."];
      if (s === "foreign") return ["p", "Persuasive only: cited where English law has no answer, e.g. Australian or Canadian authority."];
      if (d === s) {
        if (d === "uksc") return ["x", "Normally follows its own decisions but may depart from them when it appears right to do so: Practice Statement [1966] 1 WLR 1234."];
        if (d === "ca") return ["b", "Bound by its own earlier decisions, with the three exceptions in Young v Bristol Aeroplane Co [1944] KB 718 (two of its decisions conflict; one cannot stand with a later Supreme Court decision; one was made per incuriam)."];
        if (d === "hc") return ["x", "Not strictly bound by another High Court judge, but follows one by judicial comity unless convinced it is wrong."];
        return ["p", "Trial-court decisions create no binding precedent."];
      }
      if (rank[s] < rank[d]) return ["b", `Binding: a higher court in the same hierarchy${s === "uksc" ? " (including House of Lords decisions)" : ""}.`];
      return ["p", "A lower court: at most persuasive."];
    },
  },
  us: {
    courts: [
      ["scotus", "US Supreme Court", "final word on federal law"],
      ["own", "Court of Appeals, its own circuit", "e.g. the 9th Circuit, for a court in California"],
      ["other", "Court of Appeals, another circuit", "e.g. the 5th Circuit"],
      ["dist", "District courts", "federal trial courts"],
      ["state", "State supreme court", "on that state's own law"],
      ["foreign", "Foreign courts", "England, Canada…"],
    ],
    deciders: ["scotus", "own", "dist"],
    deciderLabel: { own: "Court of Appeals (a panel)", dist: "District court" },
    rules: (d, s) => {
      if (s === "foreign") return ["p", "Persuasive at most, and cited sparingly."];
      if (s === "state") return d === "scotus"
        ? ["b", "State courts are final on their own state's law; the Supreme Court accepts their reading of it."]
        : ["b", "Binding on questions of that state's law, e.g. in diversity cases: Erie Railroad Co. v. Tompkins, 304 U.S. 64 (1938)."];
      if (d === "scotus") {
        if (s === "scotus") return ["x", "Stare decisis 'is not an inexorable command' (Payne v. Tennessee, 501 U.S. 808, 828 (1991)): overruling needs special justification."];
        return ["p", "Lower federal courts: persuasive only."];
      }
      if (s === "scotus") return ["b", "Binds every federal court, and state courts on federal law."];
      if (d === "own") {
        if (s === "own") return ["b", "Prior-panel rule: a panel follows earlier published panel decisions until the court en banc or the Supreme Court overrules them."];
        if (s === "other") return ["p", "Persuasive: circuits can and do disagree (a circuit split)."];
        return ["p", "A lower court: persuasive only."];
      }
      // district court
      if (s === "own") return ["b", "Binding: the court of appeals for its own circuit."];
      if (s === "other") return ["p", "Persuasive: another circuit's law."];
      return ["p", "Not binding even in the same district or on the same judge: Camreta v. Greene, 563 U.S. 692, 709 n.7 (2011)."];
    },
  },
};

for (const root of document.querySelectorAll("[data-law-precedent]")) {
  const courtsBox = root.querySelector("[data-law-p-courts]");
  const ladder = root.querySelector("[data-law-p-ladder]");
  let sys = "ew", decider = "ca";

  function buildDeciders() {
    const S = COURTS[sys];
    if (!S.deciders.includes(decider)) decider = S.deciders[1];
    courtsBox.replaceChildren(...S.deciders.map((k) => {
      const c = S.courts.find((x) => x[0] === k);
      const b = mk("button", "flex flex-col items-start rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none transition-[border-color,box-shadow] duration-150 hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-brand aria-checked:ring-[3px] aria-checked:ring-brand/20");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(k === decider));
      b.append(mk("span", "font-medium", S.deciderLabel?.[k] ?? c[1]), mk("span", "text-xs text-muted-foreground", c[2]));
      b.addEventListener("click", () => { decider = k; buildDeciders(); });
      b.addEventListener("keydown", (e) => {
        const i = S.deciders.indexOf(k), j = { ArrowDown: i + 1, ArrowUp: i - 1 }[e.key];
        if (j === undefined || j < 0 || j >= S.deciders.length) return;
        e.preventDefault();
        decider = S.deciders[j];
        buildDeciders();
        courtsBox.children[j].focus();
      });
      b.tabIndex = k === decider ? 0 : -1;
      return b;
    }));
    renderLadder();
  }
  function renderLadder() {
    const S = COURTS[sys];
    const label = { b: "binding", x: "by practice", p: "persuasive" };
    const tone = { b: "brand", x: "u", p: "muted" };
    ladder.replaceChildren(...S.courts.map(([k, name, sub]) => {
      const [st, why] = S.rules(decider, k);
      const self = k === decider;
      const li = mk("li", `grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-lg border bg-background p-3 ${self ? "border-brand/60" : ""}`);
      const head = mk("div", "flex min-w-0 flex-wrap items-baseline gap-x-2");
      head.append(mk("span", "text-sm font-medium", self ? `${name}: its own earlier decisions` : name), mk("span", "text-xs text-muted-foreground", sub));
      li.append(head, pill(tone[st], label[st]), mk("p", "col-span-2 text-xs leading-relaxed text-muted-foreground", why));
      return li;
    }));
  }
  onSeg(root, (name, value) => { if (name === "system") { sys = value; buildDeciders(); } });
  buildDeciders();
}

// ============================================================ L4 interpretation

const WORDING = {
  plain: "No vehicles may be taken into the park.",
  list: "No cars, lorries, motorcycles or other vehicles may be taken into the park.",
  only: "No cars or lorries may be taken into the park.",
};
const APPROACH = {
  literal: "Ordinary meaning: a vehicle is a thing for carrying people or goods, especially on land. Harsh results are Parliament's business.",
  golden: "Ordinary meaning, unless it produces an absurd result the lawmaker cannot have intended.",
  purposive: "Read for the mischief the byelaw targets: noise and danger to people on foot.",
};
// v[approach][wording] = [verdict, reason]; "out" prohibited, "in" allowed, "?" arguable.
const EG = "Ejusdem generis: cars, lorries and motorcycles are motor vehicles, so 'other vehicles' means motor vehicles.";
const EU = "Expressio unius: naming cars and lorries leaves everything else out.";
const CLOSED = "A purpose cannot stretch a closed list to cover what it leaves out.";
const all3 = (v, r) => ({ plain: [v, r], list: [v, r], only: [v, r] });
const ITEMS = [
  { name: "A private car", v: { literal: all3("out", "The core case: every reading catches it."), golden: all3("out", "Applying the rule to a car is not absurd."), purposive: all3("out", "Exactly the noise and danger the rule targets.") } },
  { name: "An ambulance on a 999 call", v: {
    literal: { plain: ["out", "Literally a vehicle."], list: ["out", "A motor vehicle, of the listed kind."], only: ["?", "Neither a car nor a lorry, strictly; most would call it a van."] },
    golden: all3("in", "Keeping an ambulance from someone collapsed in the park is the absurdity the golden rule exists to avoid."),
    purposive: all3("in", "Rescue serves the safety the rule protects.") } },
  { name: "A child's bicycle", v: {
    literal: { plain: ["out", "Ordinary meaning includes bicycles (cf. Corkery v Carpenter [1951] 1 KB 102: a bicycle is a carriage)."], list: ["in", EG], only: ["in", EU] },
    golden: { plain: ["out", "Strict, but not absurd."], list: ["in", EG], only: ["in", EU] },
    purposive: { plain: ["?", "A child pedalling at walking pace hardly endangers anyone; a fast bicycle might."], list: ["?", "The listed kind suggests engines; the purpose suggests speed. Arguable."], only: ["in", CLOSED] } } },
  { name: "A battery ride-on toy car", v: {
    literal: { plain: ["?", "A toy rather than a means of transport, though it carries a child."], list: ["?", "Motorised, so arguably of the genus; but a toy."], only: ["in", "Not a car in the ordinary sense of the word."] },
    golden: { plain: ["?", "A toy rather than a means of transport, though it carries a child."], list: ["?", "Motorised, so arguably of the genus; but a toy."], only: ["in", "Not a car in the ordinary sense of the word."] },
    purposive: all3("in", "Too small and slow to threaten anyone.") } },
  { name: "A war-memorial truck on a plinth", v: {
    literal: { plain: ["out", "Still a vehicle, in working order: Fuller's point."], list: ["out", "A lorry, named in the list."], only: ["out", "A lorry, named in the list."] },
    golden: all3("?", "Fining veterans for a monument may be absurd: that is the argument to make."),
    purposive: all3("in", "It never moves: no noise, no danger. Fuller's point was that the purpose, not the word, decides.") } },
  { name: "A skateboard", v: {
    literal: { plain: ["?", "Carries a person on wheels, but few would call it a vehicle."], list: ["in", EG], only: ["in", EU] },
    golden: { plain: ["?", "Carries a person on wheels, but few would call it a vehicle."], list: ["in", EG], only: ["in", EU] },
    purposive: { plain: ["?", "Fast and silent among walkers: arguable either way."], list: ["?", "Fast and silent among walkers: arguable either way."], only: ["in", CLOSED] } } },
  { name: "A powered wheelchair", v: {
    literal: { plain: ["out", "Literally a motorised means of carrying a person."], list: ["?", "Motorised, so arguably within the genus of motor vehicles."], only: ["in", EU] },
    golden: all3("in", "Shutting disabled visitors out of the park is absurd, and sits badly with the Equality Act 2010."),
    purposive: all3("in", "A mobility aid at walking pace serves the people the park is for.") } },
  { name: "A police car on routine patrol", v: {
    literal: all3("out", "A car, whoever drives it."),
    golden: all3("out", "Applying the rule to routine patrols is not absurd."),
    purposive: all3("?", "Brings an engine among walkers, but for their safety: arguable.") } },
];

for (const root of document.querySelectorAll("[data-law-interpret]")) {
  const quote = root.querySelector("[data-law-n-text]");
  const appr = root.querySelector("[data-law-n-approach]");
  const ul = root.querySelector("[data-law-n-items]");
  let wording = "plain", approach = "literal";
  const label = { out: "prohibited", in: "allowed", "?": "arguable" };
  const tone = { out: "del", in: "brand", "?": "u" };

  function render() {
    quote.textContent = `“${WORDING[wording]}”`;
    appr.textContent = APPROACH[approach];
    const counts = { out: 0, in: 0, "?": 0 };
    ul.replaceChildren(...ITEMS.map((it) => {
      const [v, why] = it.v[approach][wording];
      counts[v]++;
      const li = mk("li", "flex flex-col gap-1.5 rounded-lg border bg-background p-3");
      const head = mk("div", "flex items-start justify-between gap-2");
      head.append(mk("span", "text-sm font-medium", it.name), pill(tone[v], label[v]));
      li.append(head, mk("p", "text-xs leading-relaxed text-muted-foreground", why));
      return li;
    }));
    ul.setAttribute("aria-label", `${counts.out} prohibited, ${counts.in} allowed, ${counts["?"]} arguable`);
  }
  onSeg(root, (name, value) => {
    if (name === "wording") wording = value;
    if (name === "approach") approach = value;
    render();
  });
  render();
}

// ============================================================ L5 proof

for (const root of document.querySelectorAll("[data-law-proof]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const LR = { e1: 4, e2: 2, e3: 50, e4: 0.2 };
  const NAMES = { e1: "eyewitness", e2: "motive", e3: "fingerprint", e4: "alibi" };
  const sws = [...root.querySelectorAll("[data-toggle]")];
  const on = Object.fromEntries(sws.map((s) => [s.dataset.toggle, isOn(s)]));
  sws.forEach((sw) => sw.addEventListener("shadcn:checked-change", (e) => { on[sw.dataset.toggle] = e.detail.checked; draw(); }));
  const s = scrubAll(root, () => draw());
  let shown = null;

  function draw() {
    const prior = s.prior.get() / 100, r = s.ratio.get();
    // The path from prior to posterior, one likelihood ratio at a time.
    const path = [["prior", prior]];
    let odds = prior / (1 - prior);
    for (const k of Object.keys(LR)) if (on[k]) { odds *= LR[k]; path.push([NAMES[k], odds / (1 + odds)]); }
    const post = odds / (1 + odds);
    const thr = r / (1 + r);
    const pct = (p) => `${num(p * 100, p > 0.995 || p < 0.005 ? 2 : 1)}%`;
    o.post.textContent = pct(post);
    o.civil.textContent = post > 0.5 ? "proved" : "not proved";
    o.cc.textContent = post > 0.75 ? "proved" : "not proved";
    o.crim.textContent = post > 0.9 ? "proved (illustrative 90%)" : "not proved";
    o.thr.textContent = `${pct(thr)} for ${r}:1`;

    svg.replaceChildren();
    const L = 30, W = 500, Y = 96;
    const sx = (p) => L + p * W;
    const g = el("g", {}, svg);
    // Zones: below 50%, 50–75, 75–90, above 90.
    const zones = [[0, 0.5, 0.04], [0.5, 0.75, 0.08], [0.75, 0.9, 0.12], [0.9, 1, 0.18]];
    for (const [a, b, op] of zones) el("rect", { x: sx(a), y: Y - 14, width: sx(b) - sx(a), height: 28, rx: 3, style: `fill:var(--brand);fill-opacity:${op}` }, g);
    // Each standard's label on its own row, so the three never collide.
    [[0.5, "50% · balance of probabilities"], [0.75, "75% · clear and convincing"], [0.9, "90% · beyond reasonable doubt"]].forEach(([p, t], i) => {
      const y = Y + 30 + i * 16;
      el("line", { x1: sx(p), x2: sx(p), y1: Y - 16, y2: y - 9, style: "stroke:currentColor;stroke-opacity:0.45" }, g);
      text(g, sx(p) - 4, y, t, { "text-anchor": "end" });
    });
    text(g, L, Y - 22, "0%", { "text-anchor": "start", style: "fill-opacity:0.7" });
    text(g, L + W, Y - 22, "100%", { "text-anchor": "end", style: "fill-opacity:0.7" });
    // Decision-theory threshold.
    const ty = Y + 30 + 3 * 16 + 6;
    el("line", { x1: sx(thr), x2: sx(thr), y1: Y - 16, y2: ty - 9, style: "stroke:var(--vec-u);stroke-width:1.5;stroke-dasharray:3 3" }, g);
    text(g, sx(thr) - 4, ty, `${num(thr * 100, 1)}% · cost threshold r/(1+r)`, { "text-anchor": "end", style: "fill:var(--vec-u)" });
    // The evidence path as hops above the bar.
    const hop = el("g", {}, svg);
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [sx(path[i - 1][1]), sx(path[i][1])];
      const h = 14 + Math.min(40, Math.abs(b - a) * 0.25);
      el("path", { d: `M${a},${Y - 16} Q${(a + b) / 2},${Y - 16 - h} ${b},${Y - 16}`, style: "fill:none;stroke:currentColor;stroke-opacity:0.35" }, hop);
      text(hop, (a + b) / 2, Y - 18 - h / 2 - 4, path[i][0], { "text-anchor": "middle" });
    }
    el("circle", { cx: sx(prior), cy: Y, r: 4, style: "fill:var(--background);stroke:currentColor;stroke-opacity:0.6;stroke-width:1.5" }, svg);
    const dot = el("circle", { cx: sx(shown ?? post), cy: Y, r: 6.5, style: "fill:var(--brand);stroke:var(--background);stroke-width:2" }, svg);
    text(svg, L, 16, "probability the fact is true, given the evidence", {});
    // Ease the posterior marker towards its new place.
    if (shown !== null && !reduced() && Math.abs(shown - post) > 0.002) {
      const from = shown, t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 280), e = 1 - (1 - k) ** 3;
        dot.setAttribute("cx", sx(from + (post - from) * e));
        if (k < 1 && dot.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else dot.setAttribute("cx", sx(post));
    shown = post;
  }
  draw();
}

// ============================================================ L6 Hand formula

for (const root of document.querySelectorAll("[data-law-hand]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const PRESETS = { barge: { B: 300, P: 5, L: 50000 }, cricket: { B: 5000, P: 0.01, L: 50000 } };
  const s = scrubAll(root, () => { setSeg(root, "preset", "custom"); draw(); });
  const box = [74, 32, 460, 258];
  const P0 = -4, P1 = 0, L0 = 1, L1 = 6; // log10 ranges: P 0.01%–100%, L $10–$1M
  let f;
  const money = (v) => "$" + Math.round(v).toLocaleString("en");

  function draw() {
    const B = s.B.get(), P = s.P.get() / 100, Lv = s.L.get();
    const pl = P * Lv;
    o.pl.textContent = money(pl);
    o.b.textContent = money(B);
    o.ratio.textContent = num(B / pl, B / pl < 10 ? 2 : 0);
    o.verdict.textContent = B < pl ? "negligent not to take it" : "not negligent";

    svg.replaceChildren();
    f = frame(svg, { box, x: [P0, P1], y: [L0, L1], xticks: [-4, -3, -2, -1, 0], yticks: [1, 2, 3, 4, 5, 6],
      xfmt: (v) => `${num(100 * 10 ** v, Math.max(0, -(v + 2)))}%`, yfmt: (v) => "$" + (10 ** v).toLocaleString("en"),
      xlabel: "probability of harm P (log)" });
    text(svg, f.L, f.T - 14, "loss L (log)", { "text-anchor": "start" });
    // The boundary P·L = B: log L = log B − log P, clipped to the box.
    // In log space the line is straight: draw only the part inside the box.
    const lb = Math.log10(B);
    const xa = Math.max(P0, lb - L1), xb = Math.min(P1, lb - L0);
    if (xa < xb) {
      const a = [f.sx(xa), f.sy(lb - xa)], b = [f.sx(xb), f.sy(lb - xb)];
      const pts = [a, b];
      if (xb < P1) pts.push([f.sx(P1), f.sy(L0)]);
      pts.push([f.sx(P1), f.sy(L1)], [f.sx(xa), f.sy(L1)]);
      el("path", { d: `M${pts.map((p) => p.join(",")).join(" L")} Z`, style: "fill:var(--code-del);fill-opacity:0.1" }, svg);
      el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], style: "stroke:var(--code-del);stroke-width:2" }, svg);
    } else if (lb < P0 + L0) {
      el("rect", { x: f.L, y: f.T, width: f.W, height: f.H, style: "fill:var(--code-del);fill-opacity:0.1" }, svg);
    }
    text(svg, f.sx(P1) - 6, f.sy(L1) + 14, "P·L > B: negligent", { "text-anchor": "end", style: "fill:var(--code-del)" });
    text(svg, f.sx(P0) + 6, f.sy(L0) - 8, "P·L < B: precaution not required", { "text-anchor": "start" });
    const cx = f.sx(Math.log10(P)), cy = f.sy(Math.log10(Lv));
    el("circle", { cx, cy, r: 13, style: "fill:var(--brand);fill-opacity:0.15" }, svg);
    el("circle", { cx, cy, r: 6, style: "fill:var(--brand);stroke:var(--background);stroke-width:2;cursor:grab" }, svg);
  }

  // Drag the point: P and L follow the pointer on log scales.
  let dragging = false;
  const move = (e) => {
    const r = svg.getBoundingClientRect(), k = 560 / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    const lp = P0 + ((x - box[0]) / box[2]) * (P1 - P0);
    const ll = L0 + ((box[1] + box[3] - y) / box[3]) * (L1 - L0);
    // Two significant figures: a dragged point is a rough estimate.
    const sig = (v) => Number(v.toPrecision(2));
    s.P.set(sig(100 * 10 ** Math.max(P0, Math.min(P1, lp))), false);
    s.L.set(sig(10 ** Math.max(L0, Math.min(L1, ll))), false);
    setSeg(root, "preset", "custom");
    draw();
  };
  svg.addEventListener("pointerdown", (e) => { e.preventDefault(); dragging = true; svg.setPointerCapture(e.pointerId); move(e); });
  svg.addEventListener("pointermove", (e) => dragging && move(e));
  svg.addEventListener("pointerup", () => (dragging = false));
  svg.addEventListener("pointercancel", () => (dragging = false));

  onSeg(root, (name, value) => {
    if (name !== "preset" || !PRESETS[value]) return;
    for (const [k, v] of Object.entries(PRESETS[value])) s[k].set(v, false);
    draw();
  });
  for (const [k, v] of Object.entries(PRESETS.barge)) s[k].set(v, false);
  draw();
}

// ============================================================ L7 limitation

const CLAIMS = {
  contract: { years: 6, name: "simple contract", s: "s 5" },
  tort: { years: 6, name: "tort", s: "s 2" },
  pi: { years: 3, name: "personal injury", s: "s 11" },
  deed: { years: 12, name: "action on a deed", s: "s 8" },
  defamation: { years: 1, name: "defamation", s: "s 4A" },
};

for (const root of document.querySelectorAll("[data-law-limitation]")) {
  const svg = root.querySelector("[data-plot]");
  const o = outs(root);
  const claim = root.querySelector("[data-law-l-claim]");
  const dates = Object.fromEntries([...root.querySelectorAll("[data-law-l-date]")].map((d) => [d.dataset.lawLDate, d]));
  const piBox = root.querySelector("[data-law-l-pi]"), dobBox = root.querySelector("[data-law-l-dob]");
  const summary = root.querySelector("[data-law-l-summary]");
  const minorSw = root.querySelector("[data-toggle=minor]");
  let minor = isOn(minorSw);

  // Dates are calendar days, handled in UTC to avoid DST shifts.
  const today = (() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const DAY = 86400000;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const parse = (s) => (s ? Date.parse(s + "T00:00:00Z") : NaN);
  const addYears = (t, n) => {
    const d = new Date(t), y = d.getUTCFullYear() + n, m = d.getUTCMonth();
    // 29 February in a common year rolls to 1 March, the usual reading of
    // a leap-day anniversary in England and Wales.
    return Date.UTC(y, m, d.getUTCDate());
  };
  const human = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  dates.accrual.value = iso(addYears(today, -2));
  dates.knowledge.value = dates.accrual.value;
  dates.dob.value = iso(addYears(today, -17));

  function draw() {
    const c = CLAIMS[claim.value];
    piBox.hidden = claim.value !== "pi";
    dobBox.hidden = !minor;
    const accrual = parse(dates.accrual.value);
    if (!Number.isFinite(accrual)) { summary.textContent = "Enter the date the cause of action accrued."; return; }
    let start = accrual, why = "the date of accrual";
    const knowledge = parse(dates.knowledge.value);
    if (claim.value === "pi" && Number.isFinite(knowledge) && knowledge > start) { start = knowledge; why = "the date of knowledge (s 14)"; }
    const dob = parse(dates.dob.value);
    let eighteen = NaN;
    if (minor && Number.isFinite(dob)) {
      eighteen = addYears(dob, 18);
      if (eighteen > accrual && eighteen > start) { start = eighteen; why = "the 18th birthday (s 28)"; }
    }
    const last = addYears(start, c.years);
    const left = Math.round((last - today) / DAY);
    o.from.textContent = human(start);
    o.period.textContent = `${c.years} year${c.years > 1 ? "s" : ""} (${c.s})`;
    o.last.textContent = human(last);
    o.left.textContent = left >= 0 ? left.toLocaleString("en") : `expired ${(-left).toLocaleString("en")} days ago`;
    summary.textContent = `A ${c.name} claim: time runs from ${why}, ${human(start)}, so the last day to issue is ${human(last)}. ` +
      (left >= 0 ? `That is ${left.toLocaleString("en")} days from today.` : "That day has passed: the defendant could plead limitation.");

    svg.replaceChildren();
    // One mark per date; the one time runs from says so.
    const marks = [["accrual", accrual], ["last day", last], ["today", today]];
    if (claim.value === "pi" && Number.isFinite(knowledge) && knowledge !== accrual) marks.push(["knowledge", knowledge]);
    if (Number.isFinite(eighteen) && minor) marks.push(["18th birthday", eighteen]);
    const own = marks.find((m) => m[1] === start);
    if (own) own[0] += ", time starts";
    const ts = marks.map((m) => m[1]);
    const t0 = Math.min(...ts) - 120 * DAY, t1 = Math.max(...ts) + 120 * DAY;
    const L = 20, W = 520, Y = 78;
    const sx = (t) => L + ((t - t0) / (t1 - t0)) * W;
    el("line", { x1: L, x2: L + W, y1: Y, y2: Y, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
    for (let y = new Date(t0).getUTCFullYear() + 1; Date.UTC(y, 0, 1) < t1; y++) {
      const x = sx(Date.UTC(y, 0, 1));
      el("line", { x1: x, x2: x, y1: Y - 4, y2: Y + 4, style: "stroke:currentColor;stroke-opacity:0.25" }, svg);
      if ((t1 - t0) / DAY / 365 < 16 || y % 2 === 0) text(svg, x, Y + 16, String(y), { "text-anchor": "middle", style: "fill-opacity:0.7" });
    }
    el("rect", { x: sx(start), y: Y - 7, width: Math.max(1, sx(last) - sx(start)), height: 14, rx: 3, style: `fill:${left >= 0 ? "var(--brand)" : "var(--code-del)"};fill-opacity:0.25` }, svg);
    // Labels alternate above and below and are nudged apart.
    // Rows above and below the line; each label takes the first row where
    // its estimated width does not overlap a label already placed.
    const rows = [Y - 22, Y + 40, Y - 36, Y + 54, Y - 50, Y + 68];
    const placed = rows.map(() => []);
    marks.sort((a, b) => a[1] - b[1]).forEach(([name, t]) => {
      const x = sx(t);
      const w = (name.length + 14) * 6.6;
      const anchor0 = x < L + w / 2 ? "start" : x > L + W - w / 2 ? "end" : "middle";
      const span = anchor0 === "start" ? [x, x + w] : anchor0 === "end" ? [x - w, x] : [x - w / 2, x + w / 2];
      let r = rows.findIndex((_, k) => placed[k].every(([a, b]) => span[1] + 8 < a || span[0] - 8 > b));
      if (r < 0) r = rows.length - 1;
      placed[r].push(span);
      const y = rows[r], up = y < Y;
      const col = name === "last day" ? (left >= 0 ? "var(--brand)" : "var(--code-del)") : name === "today" ? "var(--vec-u)" : "currentColor";
      el("line", { x1: x, x2: x, y1: Y, y2: up ? y + 4 : y - 10, style: `stroke:${col};stroke-opacity:0.6` }, svg);
      el("circle", { cx: x, cy: Y, r: 3.5, style: `fill:${col}` }, svg);
      text(svg, x, y, `${name} · ${human(t)}`, { "text-anchor": anchor0, style: col === "currentColor" ? "" : `fill:${col}` });
    });
  }
  claim.addEventListener("change", draw);
  for (const d of Object.values(dates)) d.addEventListener("input", draw);
  minorSw.addEventListener("shadcn:checked-change", (e) => { minor = e.detail.checked; draw(); });
  draw();
}

// ============================================================ L8 clause annotator

const CLAUSE_SAMPLE = `1. Definitions. "Supplier" means Northwind Components Ltd and "Customer" means Hale Robotics Ltd.

2. Delivery. The Supplier shall deliver the Goods to the Customer's premises within 30 days of each Order. If delivery is delayed by more than 10 days, the Customer may cancel the Order, provided that it gives written notice before the Goods are dispatched.

3. Payment. The Customer shall pay each invoice within 45 days of receipt. The Customer shall not withhold payment unless the Goods are defective.

4. Quality. The Supplier will use reasonable endeavours to ensure that the Goods are free from material defects.

5. Termination. Either party may terminate this Agreement on 90 days' written notice. The Supplier may terminate this Agreement immediately if the Customer fails to pay any sum when due.`;

const CATS = [
  // [key, label, color, regex source] in priority order: earlier wins overlaps.
  ["prohibition", "prohibition", "var(--code-del)", String.raw`\b(?:shall not|must not|may not|will not)\b`],
  ["duty", "duty", "var(--brand)", String.raw`\b(?:shall|must|agrees? to|undertakes? to|is obliged to)\b`],
  ["will", "duty or prediction?", "var(--vec-out)", String.raw`\bwill\b`],
  ["permission", "permission", "var(--code-add)", String.raw`\bmay\b`],
  ["condition", "condition", "var(--vec-u)", String.raw`\b(?:if|unless|provided that|subject to|in the event that|on condition that)\b`],
  ["time", "time limit", "var(--ion-k)", String.raw`\b(?:within \d+ (?:business |working )?days?|\d+ days'|on or before|no later than|immediately|when due)\b`],
  ["termination", "termination", "var(--ion-na)", String.raw`\b(?:terminat\w*|cancel\w*|expir\w*)\b`],
  ["vague", "vague", "var(--muted-foreground)", String.raw`\b(?:reasonable endeavou?rs|best endeavou?rs|reasonabl[ey]|material|promptly|as soon as (?:reasonably )?practicable|substantially|appropriate)\b`],
];

for (const root of document.querySelectorAll("[data-law-clause]")) {
  const input = root.querySelector("[data-law-c-input]");
  const out = root.querySelector("[data-law-c-out]");
  const legend = root.querySelector("[data-law-c-legend]");
  const flags = root.querySelector("[data-law-c-flags]");
  const hidden = new Set();

  function render() {
    const src = input.value;
    const owner = new Array(src.length).fill(null);
    const counts = {};
    // Defined terms: "Term" means… ; their later uses count as parties/terms.
    const defined = [...src.matchAll(/["“]([A-Z][\w ]{0,40}?)["”]\s+(?:means|shall mean|refers to)/g)].map((m) => m[1]);
    const cats = [["defined", "defined term", "var(--ion-cl)", defined.length ? String.raw`\b(?:` + defined.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + String.raw`)\b` : null], ...CATS];
    // Defined terms first, so "Supplier" is not swallowed by anything else.
    for (const [key, , , re] of cats) {
      if (!re) continue;
      counts[key] = 0;
      for (const m of src.matchAll(new RegExp(re, key === "defined" ? "g" : "gi"))) {
        const a = m.index, b = a + m[0].length;
        if (owner.slice(a, b).some((x) => x !== null)) continue;
        owner.fill(key, a, b);
        counts[key]++;
      }
    }
    const color = Object.fromEntries(cats.map((c) => [c[0], c[2]]));
    out.replaceChildren();
    let i = 0;
    while (i < src.length) {
      const k = owner[i];
      let j = i;
      while (j < src.length && owner[j] === k) j++;
      const chunk = src.slice(i, j);
      if (k && !hidden.has(k)) {
        const m = mk("mark", "rounded-[3px] px-0.5 text-foreground", chunk);
        m.style.background = `color-mix(in oklab, ${color[k]} ${k === "vague" ? 14 : 22}%, transparent)`;
        if (k === "vague" || k === "will") m.style.textDecoration = `underline wavy ${color[k]}`;
        m.title = cats.find((c) => c[0] === k)[1];
        out.append(m);
      } else out.append(document.createTextNode(chunk));
      i = j;
    }
    legend.replaceChildren(...cats.filter((c) => counts[c[0]] !== undefined).map(([key, label, col]) => {
      const b = mk("button", "inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] outline-none transition-[opacity,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50 aria-[pressed=false]:opacity-45");
      b.type = "button";
      b.setAttribute("aria-pressed", String(!hidden.has(key)));
      const sw = mk("span", "size-2 rounded-full");
      sw.style.background = col;
      b.append(sw, mk("span", "", label), mk("span", "font-mono text-muted-foreground tabular-nums", String(counts[key])));
      b.addEventListener("click", () => { hidden.has(key) ? hidden.delete(key) : hidden.add(key); render(); legend.querySelector(`[data-key="${key}"]`)?.focus(); });
      b.dataset.key = key;
      return b;
    }));

    // Review notes, by clause number where there is one.
    const notes = [];
    const clauseAt = (idx) => { const before = src.slice(0, idx); const m = [...before.matchAll(/(?:^|\n)\s*(\d+(?:\.\d+)*)\./g)].pop(); return m ? `cl ${m[1]}` : "text"; };
    for (const m of src.matchAll(/\bwill\b/gi)) notes.push(`${clauseAt(m.index)}: "will" can read as a prediction; for a duty, drafting guides prefer "shall" or "must".`);
    for (const m of src.matchAll(new RegExp(CATS.find((c) => c[0] === "vague")[3], "gi"))) notes.push(`${clauseAt(m.index)}: "${m[0]}" leaves the standard to a court to decide.`);
    const caps = new Set([...src.matchAll(/\bthe ([A-Z][a-z]+)\b/g)].map((m) => m[1]).filter((w) => !defined.includes(w)));
    if (caps.size) notes.push(`Capitalised but never defined: ${[...caps].join(", ")}.`);
    if (!/terminat/i.test(src)) notes.push("No termination clause found.");
    flags.replaceChildren(...notes.slice(0, 8).map((n) => {
      const li = mk("li", "flex items-start gap-1.5");
      li.append(mk("span", "mt-1.5 size-1.5 shrink-0 rounded-full bg-vec-out"), mk("span", "", n));
      return li;
    }));
  }
  root.querySelector("[data-law-c-reset]").addEventListener("click", () => { input.value = CLAUSE_SAMPLE; render(); });
  input.addEventListener("input", render);
  input.value = CLAUSE_SAMPLE;
  render();
}

// ============================================================ L9 legal systems

const SYSTEMS = [
  { place: "England & Wales", tradition: "common", code: "—", year: null, court: "UK Supreme Court" },
  { place: "United States", tradition: "common", code: "— (Louisiana excepted)", year: null, court: "State supreme courts; US Supreme Court on federal law" },
  { place: "India", tradition: "common", code: "— (codifying statutes; religious personal laws)", year: null, court: "Supreme Court of India" },
  { place: "Australia", tradition: "common", code: "—", year: null, court: "High Court of Australia" },
  { place: "France", tradition: "civil", code: "Code civil", year: 1804, court: "Cour de cassation" },
  { place: "Germany", tradition: "civil", code: "Bürgerliches Gesetzbuch", year: 1896, court: "Bundesgerichtshof" },
  { place: "Switzerland", tradition: "civil", code: "Zivilgesetzbuch", year: 1907, court: "Federal Supreme Court" },
  { place: "Japan", tradition: "civil", code: "Civil Code (Minpō)", year: 1896, court: "Supreme Court of Japan" },
  { place: "Brazil", tradition: "civil", code: "Código Civil", year: 2002, court: "Superior Tribunal de Justiça" },
  { place: "Scotland", tradition: "mixed", code: "— (uncodified civilian law)", year: null, court: "Court of Session; UK Supreme Court on appeal" },
  { place: "Louisiana", tradition: "mixed", code: "Civil Code", year: 1825, court: "Louisiana Supreme Court" },
  { place: "Québec", tradition: "mixed", code: "Civil Code of Québec", year: 1991, court: "Supreme Court of Canada" },
  { place: "South Africa", tradition: "mixed", code: "— (Roman-Dutch common law)", year: null, court: "Supreme Court of Appeal; Constitutional Court" },
  { place: "Iran", tradition: "religious", code: "Civil Code", year: 1928, court: "Supreme Court of Iran" },
  { place: "Saudi Arabia", tradition: "religious", code: "Civil Transactions Law", year: 2023, court: "Supreme Court" },
];
const TRAD = { common: "Common law", civil: "Civil law", mixed: "Mixed", religious: "Religious law" };

for (const root of document.querySelectorAll("[data-law-systems]")) {
  const body = root.querySelector("[data-law-s-body]");
  const ths = [...root.querySelectorAll("[data-law-s-col]")];
  let filter = "all", sortKey = null, dir = 1;

  function render() {
    let rows = SYSTEMS.filter((r) => filter === "all" || r.tradition === filter);
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        if (x === null || x === "—" || String(x).startsWith("—")) return 1;
        if (y === null || y === "—" || String(y).startsWith("—")) return -1;
        return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
      });
    }
    body.replaceChildren(...rows.map((r) => {
      const tr = mk("tr", "transition-colors duration-150 hover:bg-foreground/[0.03]");
      const td = (t, cls = "") => { const c = mk("td", "px-3 py-2 align-top " + cls); c.append(typeof t === "string" ? document.createTextNode(t) : t); return c; };
      tr.append(td(r.place, "font-medium"), td(pill(r.tradition === "common" ? "brand" : r.tradition === "civil" ? "u" : "muted", TRAD[r.tradition])),
        td(r.code, "text-muted-foreground"), td(r.year ? String(r.year) : "—", "font-mono text-xs tabular-nums"), td(r.court, "text-muted-foreground"));
      return tr;
    }));
    for (const th of ths) th.setAttribute("aria-sort", th.dataset.lawSCol === sortKey ? (dir > 0 ? "ascending" : "descending") : "none");
  }
  for (const th of ths) th.querySelector("button").addEventListener("click", () => {
    const k = th.dataset.lawSCol;
    dir = sortKey === k ? -dir : 1;
    sortKey = k;
    render();
  });
  onSeg(root, (name, value) => { if (name === "tradition") { filter = value; render(); } });
  render();
}

// ============================================================ L10 citations

const CASES = {
  donoghue: { parties: "Donoghue v Stevenson", year: "1932", volume: "", reporter: "AC", page: "562", pin: "580", court: "HL", neutral: "", square: true },
  carlill: { parties: "Carlill v Carbolic Smoke Ball Co", year: "1893", volume: "1", reporter: "QB", page: "256", pin: "", court: "CA", neutral: "", square: true },
  marbury: { parties: "Marbury v. Madison", year: "1803", volume: "5", reporter: "U.S. (1 Cranch)", page: "137", pin: "177", court: "", neutral: "", square: false },
  brown: { parties: "Brown v. Board of Education", year: "1954", volume: "347", reporter: "U.S.", page: "483", pin: "495", court: "", neutral: "", square: false },
  miller: { parties: "R (Miller) v Secretary of State for Exiting the European Union", year: "2018", volume: "", reporter: "AC", page: "61", pin: "", court: "", neutral: "[2017] UKSC 5", square: true },
};

for (const root of document.querySelectorAll("[data-law-citation]")) {
  const ins = Object.fromEntries([...root.querySelectorAll("[data-law-t-in]")].map((i) => [i.dataset.lawTIn, i]));
  const outEl = Object.fromEntries([...root.querySelectorAll("[data-law-t-out]")].map((i) => [i.dataset.lawTOut, i]));
  const whyEl = Object.fromEntries([...root.querySelectorAll("[data-law-t-why]")].map((i) => [i.dataset.lawTWhy, i]));
  const copyEl = Object.fromEntries([...root.querySelectorAll("[data-law-t-copy]")].map((i) => [i.dataset.lawTCopy, i]));

  const load = (c) => { for (const k in ins) ins[k].type === "checkbox" ? (ins[k].checked = c[k]) : (ins[k].value = c[k]); };
  const val = () => Object.fromEntries(Object.entries(ins).map(([k, i]) => [k, i.type === "checkbox" ? i.checked : i.value.trim()]));

  // Each style returns [name, rest] (the name goes in italics) and its reasons.
  function bluebook(v) {
    const why = ["Case name in italics, with \"v.\" (a full stop)", "A comma after the case name"];
    const name = v.parties.replace(/\s+v\.?\s+/, " v. ");
    const usReports = /^U\.?\s?S\.?(\s|$)/.test(v.reporter);
    const report = [v.volume, v.reporter, v.page].filter(Boolean).join(" ");
    let rest = ", ";
    if (v.neutral) { rest += `${v.neutral}, `; why.push("Neutral citation before the report"); }
    rest += v.square ? `[${v.year}] ${report}` : report;
    if (v.pin) { rest += `, ${v.pin}`; why.push("Pinpoint page after a comma"); }
    if (v.square) rest += v.court && !v.neutral ? ` (${v.court})` : "";
    else rest += ` (${!usReports && v.court ? v.court + " " : ""}${v.year})`;
    why.push(usReports ? "U.S. Reports: the Supreme Court is implied, so the parenthetical holds only the year" : v.square ? "Year in square brackets identifies the volume, so it is not repeated" : "Court and year in the closing parenthetical");
    if (/\(\d+ \w+\)/.test(v.reporter)) why.push("Early reports: the nominative reporter (Cranch) in parentheses");
    return [name, rest, why];
  }
  function oscola(v) {
    const why = ["Case name in italics; \"v\" with no full stop", "No full stops in abbreviations"];
    const name = v.parties.replace(/\s+v\.?\s+/, " v ");
    const reporter = v.reporter.replace(/\./g, "");
    const us = /^US(\s|$)/.test(reporter) || /^F\s?\d?d/.test(reporter);
    const report = [v.volume, reporter, v.page].filter(Boolean).join(" ");
    let rest = " ";
    if (v.neutral) { rest += `${v.neutral}, `; why.push("Neutral citation first, then the best report"); }
    if (us) { rest += report; why.push("A foreign case keeps its home citation, year at the end"); }
    else if (v.square) { rest += `[${v.year}] ${report}`; why.push("Year in square brackets: it is needed to find the volume"); }
    else { rest += `(${v.year}) ${report}`; why.push("Year in round brackets: the volumes are numbered on their own"); }
    if (v.pin) { rest += `, ${v.pin}`; why.push("Pinpoint after a comma"); }
    if (us) rest += ` (${v.year})`;
    else if (v.court && !v.neutral) { rest += ` (${v.court})`; why.push("Court in brackets at the end, as there is no neutral citation"); }
    return [name, rest, why];
  }
  function render() {
    const v = val();
    if (!v.parties || !v.page) {
      for (const k of ["bluebook", "oscola"]) { outEl[k].textContent = "Enter at least the parties and the first page."; whyEl[k].replaceChildren(); copyEl[k].dataset.copy = ""; }
      return;
    }
    for (const [k, fn] of [["bluebook", bluebook], ["oscola", oscola]]) {
      const [name, rest, why] = fn(v);
      outEl[k].replaceChildren(mk("i", "", name), document.createTextNode(rest));
      whyEl[k].replaceChildren(...why.map((w) => mk("li", "", w)));
      copyEl[k].dataset.copy = name + rest;
    }
  }
  onSeg(root, (name, value) => { if (name === "case" && CASES[value]) { load(CASES[value]); render(); } });
  for (const i of Object.values(ins)) i.addEventListener(i.type === "checkbox" ? "change" : "input", render);
  load(CASES.donoghue);
  render();
}
