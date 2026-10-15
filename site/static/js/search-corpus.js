// The search collection's corpus: forty short science notes written for this
// page. Small enough to read in full, large enough that ranking matters.

export const DOCS = [
  { title: "Black holes", text: "A black hole is a region of space where gravity is so strong that nothing, not even light, can escape. The boundary is called the event horizon." },
  { title: "Neutron stars", text: "When a massive star collapses, its core can become a neutron star: a city-sized ball of neutrons so dense that a teaspoon would weigh billions of tonnes." },
  { title: "Exoplanets", text: "Astronomers find exoplanets by watching a star dim as a planet crosses in front of it, or by measuring the star's wobble as the planet pulls on it." },
  { title: "The expanding universe", text: "Distant galaxies are moving away from us, and the farther they are, the faster they recede. The universe is expanding, and light from far galaxies is stretched toward red." },
  { title: "Dark matter", text: "Galaxies spin too fast for the matter we can see. Most astronomers think an invisible dark matter holds them together, though no particle has been detected yet." },
  { title: "Solar wind", text: "The Sun blows a constant stream of charged particles into space. When this solar wind hits the magnetic field of Earth, it can light up the sky as aurora." },
  { title: "DNA", text: "DNA stores genetic information as a sequence of four bases. Two strands wind around each other in a double helix, held together by base pairs." },
  { title: "Proteins", text: "A protein is a chain of amino acids that folds into a precise shape. The shape decides what the protein does, from carrying oxygen to copying DNA." },
  { title: "Cells", text: "Every living thing is made of cells. A cell keeps its inside separate from the outside with a thin membrane and copies itself by dividing." },
  { title: "Evolution", text: "Organisms vary, some variations help them survive and reproduce, and those variations become more common. Over many generations, populations evolve." },
  { title: "The immune system", text: "White blood cells patrol the body. Antibodies bind to invaders and mark them for destruction, and memory cells remember a pathogen for years." },
  { title: "Neurons", text: "A neuron sends signals as brief electrical spikes. At a synapse, chemical messengers carry the signal from one neuron to the next." },
  { title: "Photosynthesis", text: "Plants capture light with chlorophyll and use its energy to turn carbon dioxide and water into sugar, releasing oxygen as a by-product." },
  { title: "Ecosystems", text: "In an ecosystem, energy flows from plants to the animals that eat them and on to predators. Nutrients cycle back through decomposers in the soil." },
  { title: "Atoms", text: "An atom has a small dense nucleus of protons and neutrons, surrounded by electrons. The number of protons decides which element it is." },
  { title: "Chemical bonds", text: "Atoms bond by sharing or transferring electrons. A covalent bond shares a pair of electrons; an ionic bond holds charged ions together." },
  { title: "Acids and bases", text: "An acid gives up hydrogen ions in water and a base takes them. The pH scale measures how acidic a solution is, from strong acid to strong base." },
  { title: "Catalysts", text: "A catalyst speeds up a chemical reaction without being used up. Enzymes are the catalysts of living cells, each shaped for one reaction." },
  { title: "Energy", text: "Energy cannot be created or destroyed, only changed from one form to another. A falling ball turns potential energy into kinetic energy." },
  { title: "Entropy", text: "Entropy measures how many ways a system can be arranged. Left alone, an isolated system drifts toward higher entropy, which is why heat flows from hot to cold." },
  { title: "Light", text: "Light is an electromagnetic wave and also arrives in packets called photons. Its colour depends on its wavelength, from red to violet." },
  { title: "Magnetism", text: "Moving charges create magnetic fields. A magnetic field in turn pushes on moving charges, which is how an electric motor turns." },
  { title: "Quantum mechanics", text: "At small scales, particles behave like waves. Quantum mechanics predicts only probabilities, and measuring a system changes it." },
  { title: "Relativity", text: "Moving clocks run slow and gravity bends space and time. Relativity explains why GPS satellites must correct their clocks every day." },
  { title: "Plate tectonics", text: "The surface of Earth is broken into plates that drift a few centimetres a year. Where plates meet, they build mountains, trenches and volcanoes." },
  { title: "Earthquakes", text: "An earthquake happens when stress built up along a fault is released suddenly. Seismic waves spread out and are recorded by seismometers." },
  { title: "Volcanoes", text: "A volcano erupts when molten rock rises from deep inside Earth. Some volcanoes flow gently; others explode when gas trapped in the magma escapes." },
  { title: "Climate", text: "Climate is the long-term average of weather. Carbon dioxide traps heat in the atmosphere, and rising levels are warming the planet." },
  { title: "Ocean currents", text: "Winds and differences in temperature and salt drive ocean currents. The currents carry heat from the tropics toward the poles." },
  { title: "Tides", text: "The Moon pulls on the ocean, raising two bulges of water. As Earth turns, coasts pass through the bulges and see two high tides a day." },
  { title: "The water cycle", text: "Water evaporates from the ocean, condenses into clouds, falls as rain and flows back to the sea through rivers and groundwater." },
  { title: "Neural networks", text: "A neural network is a stack of layers of simple units. It learns from examples by adjusting its weights with gradient descent." },
  { title: "Search engines", text: "A search engine builds an inverted index that maps each word to the documents that contain it, then ranks the matching documents for a query." },
  { title: "Cryptography", text: "Cryptography keeps messages secret. Public key systems let anyone encrypt a message that only the holder of the private key can read." },
  { title: "Compilers", text: "A compiler translates source code into machine code. It parses the program into a tree, checks it, optimises it and emits instructions." },
  { title: "The internet", text: "The internet splits data into packets that travel independently across many networks and are put back together at the destination." },
  { title: "Algorithms", text: "An algorithm is a precise recipe for solving a problem. Its running time tells us how the work grows as the input gets larger." },
  { title: "Probability", text: "Probability measures how likely an event is, from zero to one. Flip a fair coin many times and the share of heads approaches one half." },
  { title: "Statistics", text: "Statistics turns data into conclusions. A sample can estimate a population, and a confidence interval says how precise the estimate is." },
  { title: "Graph theory", text: "A graph is a set of nodes joined by edges. Road maps, social networks and the links between web pages are all graphs." },
];

const STOP = new Set(("a an and are as at be by can for from has have in into is it its of on one or so some that the their them then they this those to too up was we what when where which while who why will with would not no nor only than very also each every how our out over under until were what yet you your about after again all any because been before being both but did do does down during few further here more most other own same should such these through").split(" "));

/** Splits text into lower-case word tokens with their character spans. */
export function tokenize(text) {
  const out = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)) {
    out.push({ raw: m[0], word: m[0].toLowerCase().replace(/['’]s$/, "").replace(/['’]/g, ""), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export const isStop = (w) => STOP.has(w);

const vowelIn = (s) => /[aeiou]|[^aeiou]y/.test(s);
// Porter's measure m: the number of vowel–consonant runs after any leading consonants.
const measure = (s) => (s.replace(/^[^aeiou]+/, "").match(/[aeiouy]+[^aeiouy]+/g) ?? []).length;

/** Step 1 of the Porter stemmer (1980), slightly simplified: plurals and
 *  -ed / -ing endings. Enough to join "galaxies" and "galaxy". */
export function stem(w) {
  if (w.length <= 3) return w;
  if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("ies")) w = w.slice(0, -2);
  else if (w.endsWith("ss")) { /* keep */ }
  else if (w.endsWith("s") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  // (m > 0) EED → EE: "agreed" → "agree", but "speed" and "feed" stay.
  if (w.endsWith("eed")) { if (/[aeiou][^aeiou]/.test(w.slice(0, -3))) w = w.slice(0, -1); }
  else {
    for (const suf of ["ed", "ing"]) {
      if (w.endsWith(suf) && vowelIn(w.slice(0, -suf.length)) && w.length - suf.length >= 3) {
        w = w.slice(0, -suf.length);
        if (/(at|bl|iz)$/.test(w)) w += "e";
        else if (/([^aeiouslz])\1$/.test(w)) w = w.slice(0, -1);
        else if (measure(w) === 1 && /[^aeiou][aeiouy][^aeiouwxy]$/.test(w)) w += "e";
        break;
      }
    }
  }
  if (w.endsWith("y") && w.length > 3 && vowelIn(w.slice(0, -1))) w = w.slice(0, -1) + "i";
  return w;
}

/** Turns text into index terms with positions, under the given options. */
export function analyse(text, opts = { stop: true, stem: true }) {
  const terms = [];
  let pos = 0;
  for (const t of tokenize(text)) {
    const p = pos++;
    if (opts.stop && isStop(t.word)) continue;
    terms.push({ term: opts.stem ? stem(t.word) : t.word, pos: p, start: t.start, end: t.end, word: t.word });
  }
  return terms;
}

/** The searchable text of a document. */
export const docText = (d) => `${d.title}. ${d.text}`;

/** Builds an inverted index: term → sorted postings [{doc, tf, positions}]. */
export function buildIndex(docs, opts) {
  const index = new Map();
  const lengths = [];
  docs.forEach((d, i) => {
    const terms = analyse(docText(d), opts);
    lengths.push(terms.length);
    for (const t of terms) {
      let list = index.get(t.term);
      if (!list) index.set(t.term, (list = []));
      let last = list[list.length - 1];
      if (!last || last.doc !== i) list.push((last = { doc: i, tf: 0, positions: [] }));
      last.tf++;
      last.positions.push(t.pos);
    }
  });
  return { index, lengths, N: docs.length, avgdl: lengths.reduce((a, b) => a + b, 0) / docs.length };
}

/** Query terms after the same analysis as the documents, without duplicates. */
export function queryTerms(q, opts) {
  return [...new Set(analyse(q, opts).map((t) => t.term))];
}

/** Fills el with text, wrapping words whose analysed term is in `terms` in a mark. */
export function highlight(el, text, terms, opts = { stop: true, stem: true }) {
  el.replaceChildren();
  const want = new Set(terms);
  let at = 0;
  for (const t of analyse(text, opts)) {
    if (!want.has(t.term)) continue;
    if (t.start > at) el.append(text.slice(at, t.start));
    const m = document.createElement("mark");
    m.className = "rounded-[3px] bg-brand/20 px-0.5 text-foreground";
    m.textContent = text.slice(t.start, t.end);
    el.append(m);
    at = t.end;
  }
  el.append(text.slice(at));
}
