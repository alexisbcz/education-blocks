package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// SearchBlocks lists the search and information retrieval gallery in display
// order. Every block runs on the same forty short science notes, written for
// this page (static/js/search-corpus.js), so an index, a ranking and a metric
// can be checked by reading the documents themselves.
func SearchBlocks() []Block {
	return []Block{
		srchIndexBlock(),
		srchBooleanBlock(),
		srchTfidfBlock(),
		srchBm25Block(),
		srchEvalBlock(),
		srchPagerankBlock(),
		srchSpellBlock(),
		srchAutocompleteBlock(),
		srchBloomBlock(),
		srchLshBlock(),
	}
}

func srchButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, h.Span(h.Data("label", ""), label))
}

func srchInput(name, value, label string) h.Node {
	return h.Input(h.Type("text"), h.Data("input", name), h.Value(value), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Aria("label", label),
		h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"))
}

func srchNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// srchResults is the list a ranking block fills: one row per document.
func srchResults(label string) h.Node {
	return h.Ol(h.Data("results", ""), h.Aria("label", label), h.Aria("live", "polite"), h.Class("flex flex-col divide-y rounded-lg border bg-background"))
}

func srchCorpusNote() h.Node {
	return srchNote("Corpus: forty short science notes written for this page, one to three sentences each.")
}

// ---------------------------------------------------------------- S1

func srchIndexBlock() Block {
	return Block{
		Slug:        "inverted-index",
		Title:       "The inverted index",
		Description: "The data structure under every search engine. Each document is cut into tokens, lower-cased, stripped of stopwords and stemmed; each resulting term points to the list of documents that contain it, with the positions where it occurs. Switch the steps off to see the vocabulary grow and the postings split.",
		Tags:        []string{"tokens", "stemming", "postings"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-index",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Document → terms"),
						h.Div(h.Class("flex items-center gap-2"),
							h.Button(h.Type("button"), h.Data("action", "prev"), h.Aria("label", "Previous document"), h.Class("rounded-md border px-2 py-1 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"), hugeicons.ArrowLeft01Icon(h.Class("size-4"))),
							h.Span(h.Data("out", "doctitle"), h.Class("min-w-0 flex-1 truncate text-sm font-medium")),
							h.Button(h.Type("button"), h.Data("action", "next"), h.Aria("label", "Next document"), h.Class("rounded-md border px-2 py-1 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"), hugeicons.ArrowRight01Icon(h.Class("size-4"))),
						),
						h.Div(h.Data("tokens", ""), h.Class("flex min-h-20 flex-wrap gap-1 rounded-lg border bg-background p-3 font-mono text-[12px]")),
					),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Postings for a term"),
						srchInput("term", "galaxy", "Term to look up"),
						h.Div(h.Data("postings", ""), h.Aria("live", "polite"), h.Class("scroll-thin flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg border bg-background p-3 font-mono text-[12px]")),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Analysis"),
					toggle("srch-idx-stop", "stop", "Drop stopwords", true),
					toggle("srch-idx-stem", "stem", "Stem (Porter step 1)", true),
				),
				readouts([2]string{"documents", "ndocs"}, [2]string{"tokens", "ntok"}, [2]string{"terms kept", "nkept"}, [2]string{"vocabulary", "vocab"}, [2]string{"postings", "npost"}, [2]string{"index / text", "ratio"}),
				srchNote("Tokens in grey were dropped as stopwords; an arrow shows a word that stemming changed. The stemmer is step 1 of Porter (1980), simplified: plurals and -ed / -ing endings only."),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func srchBooleanBlock() Block {
	return Block{
		Slug:        "boolean-queries",
		Title:       "Boolean queries and skip pointers",
		Description: "Before ranking, a search engine has to find the documents that match. AND walks two sorted postings lists side by side; skip pointers let it jump over runs that cannot match. A phrase in quotes also checks that the words sit at consecutive positions.",
		Tags:        []string{"AND / OR / NOT", "merge", "phrase"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-bool",
				h.Div(h.Class("flex flex-col gap-3"),
					srchInput("query", "light AND NOT magnetic", "Boolean query"),
					h.P(h.Data("parsed", ""), h.Class("font-mono text-[12px] text-muted-foreground")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Merges"),
						h.Div(h.Data("trace", ""), h.Class("flex flex-col gap-2 font-mono text-[12px]")),
					),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Matching documents"),
						srchResults("Matching documents"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Examples"),
					h.Div(h.Class("flex flex-wrap gap-1"),
						h.Map([][2]string{
							{"light AND NOT magnetic", "AND NOT"},
							{"ocean OR sea OR water", "OR"},
							{"energy AND heat", "AND"},
							{`"dark matter"`, "phrase"},
							{`"light" AND (wave OR photon)`, "brackets"},
						}, func(e [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("example", e[0]), h.Class("rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"), e[1])
						}),
					),
				),
				toggle("srch-bool-skip", "skip", "Skip pointers (every √n)", true),
				readouts([2]string{"matches", "nmatch"}, [2]string{"comparisons", "cmp"}, [2]string{"without skips", "cmpplain"}, [2]string{"skips taken", "skips"}),
				srchNote("Operators: AND, OR, NOT, brackets and quotes for phrases. AND binds tighter than OR. A skip check costs a comparison too, so skips only pay off when one list is much longer than the other. Terms are analysed like the documents, so ", inlineCode("Galaxies"), " finds ", inlineCode("galaxy"), "."),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func srchTfidfBlock() Block {
	return Block{
		Slug:        "tf-idf",
		Title:       "TF-IDF and cosine similarity",
		Description: "The vector space model: a document is a vector with one weight per term, high when the term is frequent in the document and rare in the collection. A query is a vector too, and documents are ranked by the cosine of the angle between them. The bars split each score into what every query term contributed.",
		Tags:        []string{"tf × idf", "cosine", "ranking"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-tfidf",
				h.Div(h.Class("flex flex-col gap-3"),
					srchInput("query", "light waves in the ocean", "Query"),
					h.Div(h.Data("terms", ""), h.Class("flex flex-wrap gap-1.5 font-mono text-[11px]")),
					srchResults("Ranked documents"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Term frequency"),
					segs("Term frequency", [2]string{"log", "1 + log tf"}, [2]string{"raw", "raw tf"}, [2]string{"bin", "binary"}),
				),
				toggle("srch-tfidf-idf", "idf", "Weight by idf", true),
				readouts([2]string{"documents", "ndocs"}, [2]string{"matching", "nmatch"}, [2]string{"top score", "top"}),
				srchNote("Weight w = tf′ · log₁₀(N / df), with documents normalised to unit length (lnc.ltc style when both are on). Turn idf off and common words like ", inlineCode("light"), " drown out the rare ones."),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func srchBm25Block() Block {
	return Block{
		Slug:        "bm25",
		Title:       "BM25",
		Description: "The ranking function most search engines started from. It adds two ideas to tf-idf: repeating a word has diminishing returns (k₁), and a long document should not win just by being long (b). Move the sliders and watch the curve of one term's contribution, then the ranking.",
		Tags:        []string{"saturation", "length normalisation", "Robertson"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-bm25",
				h.Div(h.Class("flex flex-col gap-3"),
					srchInput("query", "energy heat", "Query"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Score of one term against its frequency in the document")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-i)", "short doc (½ avg length)"),
						legendSwatch("var(--vec-j)", "average length"),
						legendSwatch("var(--vec-u)", "long doc (2× avg length)"),
						legendSwatch("var(--muted-foreground)", "tf-idf, no saturation")),
					srchResults("Ranked documents"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("k1", "k₁", "", 1.2, 0, 3, 0.05),
					field("b", "b", "", 0.75, 0, 1, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					srchButton("defaults", "1.2 / 0.75", hugeicons.RefreshIcon()),
					srchButton("nolen", "b = 0", hugeicons.ChartLineData01Icon())),
				readouts([2]string{"avg length", "avgdl"}, [2]string{"top doc", "topdoc"}, [2]string{"rank changes", "moved"}),
				srchNote("score = Σ idf · tf (k₁ + 1) / (tf + k₁ (1 − b + b · dl / avgdl)), with idf = ln(1 + (N − n + 0.5) / (n + 0.5)), the always-positive form Lucene uses. Robertson & Zaragoza (2009). Rank changes count documents whose place differs from k₁ = 1.2, b = 0.75."),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func srchEvalBlock() Block {
	return Block{
		Slug:        "evaluation",
		Title:       "Precision, recall, MAP and nDCG",
		Description: "How to tell whether a ranking is good. Mark each result's relevance (click to cycle 0 to 3), and the metrics update: precision and recall at a cut-off, average precision, which rewards finding relevant documents early, and nDCG, which also uses the grades.",
		Tags:        []string{"P@k", "average precision", "nDCG"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-eval",
				h.Div(h.Class("grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-1"),
						panelLabel("Results for “ocean water”, ranked"),
						h.Ol(h.Data("judged", ""), h.Aria("label", "Results with relevance grades"), h.Class("flex flex-col divide-y rounded-lg border bg-background")),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-1"),
						panelLabel("Precision–recall"),
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 300 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Precision against recall down the ranking")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cut-off and pool"),
					field("k", "k", "", 5, 1, 10, 1),
					field("pool", "Relevant in corpus", "", 6, 1, 20, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					srchButton("ideal", "Ideal order", hugeicons.SortingDownIcon()),
					srchButton("shuffle", "Shuffle", hugeicons.ShuffleIcon())),
				readouts([2]string{"P@k", "pk"}, [2]string{"R@k", "rk"}, [2]string{"AP", "ap"}, [2]string{"nDCG@k", "ndcg"}, [2]string{"RR", "rr"}),
				srchNote("A grade above 0 counts as relevant for precision and recall. nDCG uses gain 2ᵍ − 1 and discount 1 / log₂(rank + 1), divided by the best possible order of the same grades. Average precision divides by the relevant documents in the whole corpus, so missing ones cost."),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

func srchPagerankBlock() Block {
	return Block{
		Slug:        "pagerank",
		Title:       "PageRank",
		Description: "A page is important if important pages link to it. PageRank is where a random surfer spends their time: follow a link with probability d, or jump to any page. Power iteration finds the answer; a simulated surfer finds the same one, slowly. Click one page and then another to add or remove a link.",
		Tags:        []string{"power iteration", "random surfer", "damping"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-pr",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"),
					h.Svg(h.Data("graph", ""), h.ViewBox("0 0 360 300"), h.Class("block w-full touch-manipulation"), h.Role("group"), h.Aria("label", "Web graph: click a page, then another to toggle a link")),
					h.Div(h.Class("flex min-w-0 flex-col gap-1"),
						panelLabel("Rank vs surfer visits"),
						h.Svg(h.Data("bars", ""), h.ViewBox("0 0 280 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "PageRank and visit share for each page")),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"),
							legendSwatch("var(--brand)", "PageRank"),
							legendSwatch("var(--vec-u)", "surfer's share of visits")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					field("d", "Damping d", "", 0.85, 0, 0.99, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					srchButton("step", "Iterate once", hugeicons.ArrowRight01Icon()),
					srchButton("solve", "Converge", hugeicons.FastWindIcon()),
					srchButton("surf", "Surf 20,000", hugeicons.Navigation03Icon()),
					srchButton("reset", "Reset graph", hugeicons.RefreshIcon())),
				readouts([2]string{"iteration", "iter"}, [2]string{"change |Δ|₁", "delta"}, [2]string{"sum of ranks", "sum"}, [2]string{"top page", "top"}, [2]string{"surfer steps", "steps"}, [2]string{"surfer vs rank", "gap"}),
				srchNote("Page H links nowhere. A surfer stuck there jumps to a random page, so its rank is spread evenly; without that fix rank would leak out of the graph. Brin & Page (1998)."),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func srchSpellBlock() Block {
	return Block{
		Slug:        "spelling",
		Title:       "Spelling correction",
		Description: "“Did you mean”: find the dictionary words within a small edit distance of what was typed, and pick the most likely one. Edit distance is a dynamic programme: each cell is the cheapest way to turn one prefix into the other. The highlighted path is the sequence of edits.",
		Tags:        []string{"Levenshtein", "dynamic programming", "noisy channel"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-spell",
				h.Div(h.Class("flex flex-col gap-3"),
					srchInput("word", "galaxeis", "Word to correct"),
					h.Div(h.Data("candidates", ""), h.Aria("live", "polite"), h.Class("flex flex-wrap gap-1.5")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Edit distance table"),
						h.Div(h.Data("table", ""), h.Class("scroll-thin overflow-x-auto")),
					),
					h.P(h.Data("ops", ""), h.Class("font-mono text-[12px] text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Compare with"),
					srchInput("target", "", "Dictionary word to compare with"),
				),
				readouts([2]string{"vocabulary", "vocab"}, [2]string{"suggestion", "best"}, [2]string{"distance", "dist"}, [2]string{"within 1", "n1"}, [2]string{"within 2", "n2"}),
				srchNote("The rule follows Norvig's corrector: a known word wins outright, then the most frequent word at distance 1, then at distance 2. Frequencies are counts in the corpus. Click a suggestion to compare its table."),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func srchAutocompleteBlock() Block {
	return Block{
		Slug:        "autocomplete",
		Title:       "Autocomplete with a trie",
		Description: "Type a prefix and get the likeliest completions before you finish the word. A trie stores words letter by letter, so every word with the same prefix sits under one node. Storing the best count found under each node lets the search stop early instead of visiting the whole subtree.",
		Tags:        []string{"trie", "prefix", "best-first"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-trie",
				h.Div(h.Class("flex flex-col gap-3"),
					srchInput("prefix", "co", "Prefix"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "The trie below the prefix")),
					h.Ol(h.Data("completions", ""), h.Aria("live", "polite"), h.Aria("label", "Completions"), h.Class("flex flex-col gap-1")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Suggestions"),
					field("n", "Show", "", 5, 1, 10, 1),
				),
				readouts([2]string{"trie nodes", "nodes"}, [2]string{"words", "words"}, [2]string{"under prefix", "under"}, [2]string{"nodes visited", "visited"}, [2]string{"full scan", "scan"}),
				srchNote("Visited counts the nodes the best-first search takes off its queue. A full scan reads every word in the vocabulary and checks its prefix."),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func srchBloomFields() h.Node {
	return h.Div(h.Class("flex flex-col gap-2"), panelLabel("Filter"),
		field("m", "Bits m", "", 256, 16, 1024, 16),
		field("k", "Hashes k", "", 3, 1, 12, 1),
		field("n", "Words n", "", 40, 1, 300, 1),
	)
}

func srchBloomBlock() Block {
	return Block{
		Slug:        "bloom-filter",
		Title:       "Bloom filter",
		Description: "A few bits that answer “have I seen this?” with no false negatives and a tunable rate of false positives. Each word sets k bits; a query is “maybe” only if all of its k bits are set. Search engines use them to skip disk reads for words a shard cannot contain.",
		Tags:        []string{"hashing", "false positives", "optimal k"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-bloom",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("bits", ""), h.ViewBox("0 0 560 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "The bit array")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Query"),
						srchInput("query", "volcano", "Word to test"),
						h.P(h.Data("verdict", ""), h.Aria("live", "polite"), h.Class("text-sm")),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "False positive rate against the number of hashes")),
				),
				srchBloomFields(),
				srchButton("optimal", "Use optimal k", hugeicons.Target02Icon()),
				readouts([2]string{"bits set", "set"}, [2]string{"predicted FPR", "pred"}, [2]string{"(bits set / m)ᵏ", "fill"}, [2]string{"measured FPR", "meas"}, [2]string{"optimal k", "kopt"}, [2]string{"bits / word", "bpw"}),
				srchNote("Predicted rate (1 − e^(−kn/m))ᵏ, the expected share of bits set raised to k; the line below uses this filter's actual share. Measured on 20,000 made-up strings that are not in the set. The n words are the most frequent in the corpus. Hashes: k positions from two 32-bit hashes, h₁ + i·h₂ (Kirsch & Mitzenmacher 2006)."),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func srchLshBlock() Block {
	return Block{
		Slug:        "lsh",
		Title:       "Approximate nearest neighbours with LSH",
		Description: "Vector search cannot compare a query with every item when there are billions. Locality-sensitive hashing cuts space with random hyperplanes: points on the same side of every plane share a bucket, and only that bucket is searched. More planes make buckets smaller and faster; more tables win back the neighbours that were cut off.",
		Tags:        []string{"random hyperplanes", "recall", "buckets"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("srch-lsh",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 400 400"), h.Class("mx-auto block w-full max-w-[460px] touch-none"), h.Role("img"), h.Attr("tabindex", "0"),
						h.Aria("label", "Points and the query; drag or use the arrow keys to move the query")),
					h.Div(h.Class("flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "query"),
						legendSwatch("var(--vec-j)", "searched (same bucket)"),
						legendSwatch("var(--vec-i)", "true 10 nearest by angle"),
						legendSwatch("var(--vec-u)", "table 1 planes")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Index"),
					field("bits", "Planes per table", "", 4, 1, 10, 1),
					field("tables", "Tables", "", 2, 1, 8, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					srchButton("reseed", "New planes", hugeicons.DiceIcon()),
					srchButton("bench", "200 queries", hugeicons.ChartLineData01Icon())),
				readouts([2]string{"points", "npts"}, [2]string{"searched", "scanned"}, [2]string{"recall@10", "recall"}, [2]string{"avg searched", "avgscan"}, [2]string{"avg recall", "avgrecall"}),
				srchNote(fmt.Sprintf("Similarity is the angle from the centre. One random plane separates two points at angle θ with probability θ / π (Charikar 2002), so close points usually share a bucket. Points: %d in five clusters.", 600)),
			)
		},
	}
}
