package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// CombinatoricsBlocks lists the combinatorics gallery in display order.
// Pascal's triangle, pigeonhole, inclusion–exclusion and Fibonacci live in
// Discrete Mathematics and Burnside's lemma in Abstract Algebra; these
// blocks are about bijections, generating functions and exact counts.
func CombinatoricsBlocks() []Block {
	return []Block{
		combStarsBlock(),
		combCatalanBlock(),
		combPartitionsBlock(),
		combGlaisherBlock(),
		combDerangeBlock(),
		combStirlingBlock(),
		combCoinsBlock(),
		combTilingBlock(),
		combRamseyBlock(),
		combBallotBlock(),
	}
}

func combButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func combNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

func combSvg(viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// combStepper is the prev / next / play row shared by the enumerating blocks.
func combStepper() h.Node {
	return h.Div(h.Class("flex flex-wrap gap-2"),
		combButton("prev", hugeicons.ArrowLeft01Icon(), "Prev"),
		combButton("next", hugeicons.ArrowRight01Icon(), "Next"),
		playPauseLabel("Play"),
	)
}

// combLine is a one-line mono display the script fills in.
func combLine(name string) h.Node {
	return h.Div(h.Data("line", name), h.Aria("live", "polite"), h.Class("min-h-6 px-1 font-mono text-base break-all tabular-nums"))
}

// ---------------------------------------------------------------- C1

func combStarsBlock() Block {
	return Block{
		Slug:        "stars-and-bars",
		Title:       "Stars and bars",
		Description: "How many ways can k identical balls go into n boxes? Line the balls up and drop n − 1 bars between them: every arrangement of k stars and n − 1 bars is exactly one distribution, and every distribution is one arrangement. So the count is the number of ways to choose where the bars go, C(k + n − 1, n − 1). Step through every distribution and watch the string and the boxes change together.",
		Tags:        []string{"bijection", "multisets", "binomial coefficients"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-stars",
				h.Div(h.Class("flex flex-col gap-3"),
					combSvg("0 0 640 215", "Balls distributed into boxes"),
					combLine("code"),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Distribution"),
					field("k", "balls k", "", 6, 0, 40, 1),
					field("n", "boxes n", "", 4, 1, 12, 1),
					toggle("comb-stars-pos", "positive", "Every box gets at least one", false),
					combStepper(),
					combButton("random", hugeicons.ShuffleIcon(), "Random"),
				),
				readouts([2]string{"distributions", "total"}, [2]string{"formula", "formula"}, [2]string{"this one", "index"}),
				combNote("With every box non-empty, give each box one ball first; the remaining k − n balls go anywhere, so the count drops to C(k − 1, n − 1). Counts are exact (BigInt) for any size; the picture caps at 40 balls."),
			)
		},
	}
}

// ---------------------------------------------------------------- C2

func combCatalanBlock() Block {
	return Block{
		Slug:        "catalan",
		Title:       "Catalan numbers, four ways",
		Description: "1, 1, 2, 5, 14, 42, 132… The Catalan numbers count dozens of different things, and they are equal because there are bijections between them. Here one object is drawn four ways at once: a mountain path that never dips below the ground, a balanced string of brackets, a binary tree, and a triangulation of a polygon. Step through all of them for n up to 6; every view stays in sync.",
		Tags:        []string{"Catalan", "Dyck paths", "bijections"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-catalan",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-2"), panelLabel("Dyck path"), combSvg("0 0 300 150", "Dyck path", h.Data("view", "path"))),
						h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-2"), panelLabel("Brackets"),
							h.Div(h.Data("view", "parens"), h.Class("flex min-h-[150px] items-center justify-center font-mono text-2xl tracking-[0.2em] sm:text-3xl"))),
						h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-2"), panelLabel("Binary tree"), combSvg("0 0 300 170", "Binary tree", h.Data("view", "tree"))),
						h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-2"), panelLabel("Triangulated polygon"), combSvg("0 0 300 170", "Triangulated polygon", h.Data("view", "poly"))),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Objects"),
					segs("n", [2]string{"1", "n = 1"}, [2]string{"2", "2"}, [2]string{"3", "3"}, [2]string{"4", "4"}, [2]string{"5", "5"}, [2]string{"6", "6"}),
					combStepper(),
				),
				readouts([2]string{"C(n)", "cn"}, [2]string{"this one", "index"}, [2]string{"distinct, each", "distinct"}, [2]string{"formula", "formula"}),
				combNote("The bracket string is the path: ( is a step up, ) a step down. The first ( and its matching ) split the string into ( A ) B, and A becomes the left subtree, B the right. The root of the tree is the triangle standing on the bottom edge of the polygon; its left subtree triangulates the polygon on its left side, the right subtree the other. The “distinct, each” row counts the different paths, trees and triangulations actually drawn; all three equal C(n) = C(2n, n)/(n + 1)."),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func combPartitionsBlock() Block {
	return Block{
		Slug:        "partitions",
		Title:       "Partitions and Young diagrams",
		Description: "A partition of n writes it as a sum of positive integers, order ignored: 5 = 3 + 1 + 1. Draw each part as a row of boxes and you get a Young diagram. Flip it across the diagonal and you get the conjugate partition, which turns 'at most k parts' into 'parts at most k'. Counting them has no simple formula, but Euler's pentagonal number theorem gives an exact recurrence fast enough for p(1000).",
		Tags:        []string{"partitions", "conjugation", "pentagonal numbers"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-part",
				h.Div(h.Class("flex flex-col gap-3"),
					combSvg("0 0 640 260", "A partition's Young diagram and its conjugate"),
					combLine("sum"),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Partition"),
					field("n", "n", "", 7, 1, 30, 1),
					combStepper(),
					toggle("comb-part-self", "self", "Only self-conjugate ones", false),
					h.Div(h.Class("border-t pt-4"), panelLabel("Count p(N) exactly")),
					field("big", "N", "", 100, 1, 2000, 1),
				),
				readouts([2]string{"p(n)", "pn"}, [2]string{"this one", "index"}, [2]string{"self-conjugate", "selfc"}, [2]string{"p(N)", "big"}, [2]string{"digits", "digits"}),
				combNote("p(N) uses p(N) = Σ (−1)^(k+1) [p(N − k(3k−1)/2) + p(N − k(3k+1)/2)], whose offsets 1, 2, 5, 7, 12, 15… are the generalised pentagonal numbers. Self-conjugate partitions are as many as partitions into distinct odd parts: peel off the diagonal hooks."),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func combGlaisherBlock() Block {
	return Block{
		Slug:        "distinct-odd",
		Title:       "Distinct parts equal odd parts",
		Description: "Euler proved that partitions of n into distinct parts are exactly as many as partitions into odd parts. Glaisher's bijection makes it concrete: split every even part in half, again and again, until all parts are odd. Going back, merge equal odd parts in pairs until no two are equal. Pick a partition into distinct parts and watch it split, one halving at a time.",
		Tags:        []string{"Euler", "Glaisher", "bijection"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-glaisher",
				h.Div(h.Class("flex flex-col gap-3"),
					combSvg("0 0 640 250", "Parts as bars, halving even parts"),
					combLine("from"),
					combLine("to"),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Partition"),
					field("n", "n", "", 12, 1, 40, 1),
					h.Div(h.Class("flex flex-wrap gap-2"),
						combButton("prev", hugeicons.ArrowLeft01Icon(), "Prev"),
						combButton("next", hugeicons.ArrowRight01Icon(), "Next"),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						combButton("split", hugeicons.SparklesIcon(), "Halve one part"),
						combButton("reset", hugeicons.RefreshIcon(), "Reset"),
					),
				),
				readouts([2]string{"distinct parts", "distinct"}, [2]string{"odd parts", "odd"}, [2]string{"this one", "index"}, [2]string{"halvings left", "left"}),
				combNote("Every part is 2ᵃ·m with m odd; it becomes 2ᵃ copies of m. Because the parts were distinct, the copies of each m come from different powers of 2, so writing their number in binary recovers them: the map is one-to-one. Both counts above are computed by enumeration."),
			)
		},
	}
}

// ---------------------------------------------------------------- C5

func combDerangeBlock() Block {
	return Block{
		Slug:        "derangements",
		Title:       "Derangements and the hat check",
		Description: "n people check their hats and get them back at random. What is the chance nobody gets their own? The permutations with no fixed point are the derangements, counted by !n = n! Σ (−1)ᵏ/k!, and their share settles on 1/e ≈ 0.3679 almost at once: with 10 people or with a million, about 37% of shuffles leave everyone with the wrong hat.",
		Tags:        []string{"derangements", "fixed points", "1/e"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-derange",
				h.Div(h.Class("flex flex-col gap-3"),
					combSvg("0 0 640 190", "People and the hats they got back"),
					h.Div(h.Class("flex flex-col gap-2"),
						combSvg("0 0 640 200", "Share of derangements and the simulation against n", h.Data("chart", "")),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--brand)", "!n / n!, exact"), legendSwatch("var(--vec-u)", "simulated"), legendSwatch("var(--muted-foreground)", "1/e"),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Hat check"),
					field("n", "people n", "", 8, 1, 26, 1),
					h.Div(h.Class("flex flex-wrap gap-2"),
						combButton("shuffle", hugeicons.ShuffleIcon(), "Shuffle once"),
						combButton("many", hugeicons.RepeatIcon(), "10 000 shuffles"),
					),
					field("big", "exact !N for N", "", 20, 1, 200, 1),
				),
				readouts([2]string{"fixed points", "fixed"}, [2]string{"!n", "dn"}, [2]string{"!n / n!", "share"}, [2]string{"simulated", "sim"}, [2]string{"!N", "big"}),
				combNote("Recurrence: !n = (n − 1)(!(n − 1) + !(n − 2)), with !0 = 1 and !1 = 0. !n is also n!/e rounded to the nearest integer for n ≥ 1. The simulation uses a Fisher–Yates shuffle."),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func combStirlingBlock() Block {
	return Block{
		Slug:        "set-partitions",
		Title:       "Set partitions, Stirling and Bell",
		Description: "Split the set {1, …, n} into k non-empty groups: the number of ways is the Stirling number of the second kind S(n, k), and summing over k gives the Bell number Bₙ. The recurrence S(n, k) = k·S(n−1, k) + S(n−1, k−1) says where element n goes: into one of the k existing groups, or alone into a new one. Click a cell of the triangle to see every partition it counts.",
		Tags:        []string{"Stirling numbers", "Bell numbers", "set partitions"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-stirling",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("triangle", ""), h.Class("scroll-thin overflow-x-auto")),
					h.Div(h.Data("gallery", ""), h.Class("scroll-thin grid max-h-[320px] grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2 overflow-y-auto")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Set"),
					field("n", "n", "", 4, 1, 6, 1),
					field("k", "groups k", "", 2, 1, 6, 1),
					toggle("comb-stirling-all", "all", "Show every k", false),
					h.Div(h.Class("border-t pt-4"), panelLabel("Bell number")),
					field("big", "Bₙ for n", "", 10, 1, 120, 1),
				),
				readouts([2]string{"S(n, k)", "snk"}, [2]string{"shown", "shown"}, [2]string{"Bₙ (n above)", "bell"}, [2]string{"Bₙ (big n)", "big"}),
				combNote("Partitions are drawn with each group as a coloured bubble, elements 1…n left to right. Enumeration uses restricted growth strings: element i joins an existing group or opens the next one."),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

func combCoinsBlock() Block {
	return Block{
		Slug:        "making-change",
		Title:       "Making change with generating functions",
		Description: "The number of ways to pay N cents with coins of value c₁, c₂, … is the coefficient of xᴺ in 1/((1 − x^c₁)(1 − x^c₂)…). Each factor 1 + x^c + x^2c + … stands for 'use this coin 0, 1, 2… times', and multiplying the series adds up the exponents. Turn coins on and off, multiply one factor at a time, and read the answer off the coefficients.",
		Tags:        []string{"generating functions", "coin change", "polynomials"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-coins",
				h.Div(h.Class("flex flex-col gap-3"),
					combLine("product"),
					combSvg("0 0 640 280", "Coefficients of the product series"),
					h.Div(h.Data("ways", ""), h.Class("scroll-thin max-h-28 overflow-auto rounded-lg border bg-background p-2 font-mono text-[11px] leading-relaxed text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Coins"),
					h.Div(h.Data("coins", ""), h.Class("flex flex-wrap gap-1.5"),
						h.Map([]string{"1", "2", "5", "10", "20", "25", "50", "100"}, func(c string) h.Node {
							on := c == "1" || c == "5" || c == "10" || c == "25" || c == "50"
							return h.Button(h.Type("button"), h.Data("coin", c), h.Aria("pressed", h.Ternary(on, "true", "false")),
								h.Class("h-8 min-w-10 rounded-md border px-2 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-[var(--brand)] aria-pressed:text-foreground aria-pressed:ring-[3px] aria-pressed:ring-[color-mix(in_oklch,var(--brand)_25%,transparent)]"),
								c)
						}),
					),
					field("amount", "amount N", "cents", 100, 1, 2000, 1),
					h.Div(h.Class("flex flex-wrap gap-2"),
						combButton("step", hugeicons.ArrowRight01Icon(), "Multiply next factor"),
						combButton("all", hugeicons.Tick02Icon(), "All factors"),
					),
				),
				readouts([2]string{"factors used", "used"}, [2]string{"[xᴺ]", "coef"}, [2]string{"largest coefficient ≤ N", "max"}),
				combNote("Multiplying by 1/(1 − xᶜ) is one pass a[i] += a[i − c], the same loop as the dynamic-programming solution. Counts are exact BigInts. The list shows the first ways, largest coins first."),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func combTilingBlock() Block {
	return Block{
		Slug:        "domino-tilings",
		Title:       "Domino tilings and recurrences",
		Description: "Tile a 2 × n board with dominoes. The left edge is covered either by one upright domino, leaving a 2 × (n−1) board, or by two flat ones, leaving 2 × (n−2): so T(n) = T(n−1) + T(n−2), the Fibonacci numbers. A 3 × n board obeys T(n) = 4T(n−2) − T(n−4). The roots of each recurrence's characteristic polynomial give a closed form; see every tiling drawn and compare the formula with the count.",
		Tags:        []string{"tilings", "linear recurrences", "characteristic roots"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-tiling",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("gallery", ""), h.Class("scroll-thin grid max-h-[360px] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-y-auto")),
					h.Div(h.Data("table", ""), h.Class("scroll-thin overflow-x-auto")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Board"),
					segs("Height", [2]string{"2", "2 × n"}, [2]string{"3", "3 × n"}),
					field("n", "length n", "", 6, 1, 12, 1),
				),
				readouts([2]string{"tilings drawn", "drawn"}, [2]string{"recurrence", "rec"}, [2]string{"characteristic", "char"}, [2]string{"roots", "roots"}, [2]string{"closed form", "closed"}),
				combNote("Every tiling is found by covering the first empty cell, column by column, with a flat or an upright domino. A 3 × n board with n odd has an odd number of cells, so it has no tiling at all. The table compares the recurrence with the closed form evaluated in floating point."),
			)
		},
	}
}

// ---------------------------------------------------------------- C9

func combRamseyBlock() Block {
	return Block{
		Slug:        "ramsey",
		Title:       "Ramsey: R(3, 3) = 6",
		Description: "Colour every edge between n points with one of two colours. With 5 points you can avoid a triangle of one colour: draw the pentagon in one colour and the star in the other. With 6 points you cannot, however you try. Click edges to colour them, let the checker hunt for single-colour triangles, then check all 32 768 colourings of K₆ in one go.",
		Tags:        []string{"Ramsey theory", "graph colouring", "exhaustive search"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-ramsey",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("mx-auto w-full max-w-[420px]"), combSvg("-1.25 -1.25 2.5 2.5", "Complete graph with coloured edges")),
					h.Div(h.Class("flex flex-wrap justify-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "colour A"), legendSwatch("var(--vec-v)", "colour B"), legendSwatch("var(--brand)", "one-colour triangle"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Graph"),
					segs("Points", [2]string{"6", "K₆"}, [2]string{"5", "K₅"}),
					h.Div(h.Class("flex flex-wrap gap-2"),
						combButton("random", hugeicons.DiceIcon(), "Random"),
						combButton("pentagon", hugeicons.SparklesIcon(), "Pentagon and star"),
						combButton("clear", hugeicons.Delete02Icon(), "Clear"),
					),
					combButton("all", hugeicons.Search01Icon(), "Check every colouring"),
				),
				readouts([2]string{"edges coloured", "edges"}, [2]string{"one-colour triangles", "tri"}, [2]string{"every colouring", "all"}),
				combNote("Click an edge (or focus it and press Enter) to cycle uncoloured → A → B. Why 6 forces a triangle: one point has 5 edges, so at least 3 share a colour; if any two of those 3 far ends are joined in that colour you have a triangle, and if none are, those three form a triangle of the other colour."),
			)
		},
	}
}

// ---------------------------------------------------------------- C10

func combBallotBlock() Block {
	return Block{
		Slug:        "ballot",
		Title:       "The ballot problem and reflection",
		Description: "Candidate A gets a votes, B gets b, with a > b, and the ballots are counted in random order. The chance that A leads at every moment of the count is (a − b)/(a + b) (Bertrand, 1887). The proof is a picture: count as a lattice path, and reflect the start of any bad path up to its first visit to zero. Reflection pairs bad paths that start with an A vote with bad paths that start with B.",
		Tags:        []string{"ballot theorem", "reflection principle", "lattice paths"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("comb-ballot",
				h.Div(h.Class("flex flex-col gap-2"),
					combSvg("0 0 640 300", "Vote count as a lattice path, with its reflection"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "count path"), legendSwatch("var(--vec-v)", "reflected start"), legendSwatch("var(--muted-foreground)", "tie line"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Votes"),
					field("a", "for A", "", 7, 1, 60, 1),
					field("b", "for B", "", 4, 0, 59, 1),
					h.Div(h.Class("flex flex-wrap gap-2"),
						combButton("count", hugeicons.ShuffleIcon(), "Count once"),
						combButton("many", hugeicons.RepeatIcon(), "10 000 counts"),
					),
				),
				readouts([2]string{"orders", "total"}, [2]string{"A always ahead", "good"}, [2]string{"(a − b)/(a + b)", "formula"}, [2]string{"simulated", "sim"}, [2]string{"this count", "verdict"}),
				combNote("All orders: C(a + b, a). Bad paths starting with a B vote are all C(a + b − 1, a) of them; reflection shows bad paths starting with A are just as many, which leaves C(a + b, a) − 2·C(a + b − 1, a) good paths."),
			)
		},
	}
}
