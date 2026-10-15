package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// DiscreteBlocks lists the discrete mathematics gallery in display order.
func DiscreteBlocks() []Block {
	return []Block{
		discreteGraphBlock(),
		discreteColoringBlock(),
		discreteCountingBlock(),
		discretePigeonholeBlock(),
		discreteHanoiBlock(),
		discreteFibonacciBlock(),
		discreteSpanningBlock(),
		discreteVennBlock(),
	}
}

func discreteButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// discretePlayButton toggles between Run and Pause (static/js/discrete.js).
func discretePlayButton(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func discreteSvg(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[640px] touch-none select-none"),
		h.Role("img"), h.Aria("label", label))
}

// ---------------------------------------------------------------- D1

func discreteGraphBlock() Block {
	return Block{
		Slug:        "graph-editor",
		Title:       "Graph editor",
		Description: "Build a graph and read its properties as you go. Click empty space to add a vertex, click two vertices to join them, drag to move, Shift-click to delete. The Königsberg preset is Euler's 1736 problem: four land masses, seven bridges, no walk crossing each bridge once.",
		Tags:        []string{"graphs", "Euler paths", "bipartite"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dgraph",
				discreteSvg("plot", "0 0 560 380", "Graph editor: click to add vertices and edges"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"konigsberg", "Königsberg"}, {"k4", "K₄"}, {"k33", "K₃,₃"}, {"petersen", "Petersen"}, {"cycle", "Cycle C₆"}, {"empty", "Clear"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", p[0]), h.Class("justify-start font-normal"), p[1])
						}),
					),
				),
				readouts([2]string{"vertices", "v"}, [2]string{"edges", "e"}, [2]string{"degrees", "deg"}, [2]string{"connected", "conn"}, [2]string{"bipartite", "bip"}, [2]string{"Euler", "euler"}),
				h.P(h.Data("out", "why"), h.Class("text-xs leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- D2

func discreteColoringBlock() Block {
	return Block{
		Slug:        "coloring",
		Title:       "Graph colouring",
		Description: "Colour the vertices so that no edge joins two of the same colour. Greedy colouring is fast but depends on the order it visits vertices; backtracking finds the true chromatic number χ, which is hard in general (NP-hard) but instant on small graphs.",
		Tags:        []string{"greedy", "backtracking", "χ(G)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dcolor",
				discreteSvg("plot", "0 0 560 360", "Graph colouring"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Graph"),
					segs("Graph", [2]string{"petersen", "Petersen"}, [2]string{"wheel", "Wheel W₅"}, [2]string{"crown", "Crown"}, [2]string{"map", "Map"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Greedy order"),
					segs("Order", [2]string{"index", "By index"}, [2]string{"degree", "Largest first"}, [2]string{"random", "Random"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discreteButton("step", "Step", hugeicons.ArrowRight01Icon()),
					discreteButton("exact", "Find χ", hugeicons.Search01Icon()),
				),
				readouts([2]string{"greedy colours", "greedy"}, [2]string{"χ (exact)", "chi"}, [2]string{"coloured", "done"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Every planar map needs at most four colours: the four colour theorem, proved with computer help by Appel and Haken in 1976."),
			)
		},
	}
}

// ---------------------------------------------------------------- D3

func discreteCountingBlock() Block {
	return Block{
		Slug:        "counting",
		Title:       "Counting and Pascal's triangle",
		Description: "The four ways to choose k things from n: order matters or not, repetition allowed or not. Exact big integers, and C(n, k) found in Pascal's triangle along with the two entries that add up to it.",
		Tags:        []string{"combinatorics", "BigInt", "Pascal"},
		Wide:        true,
		Render: func() h.Node {
			card := func(key, title, formula string) h.Node {
				return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-3"),
					h.Span(h.Class("text-xs text-muted-foreground"), title),
					h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), formula),
					h.Span(h.Data("out", key), h.Class("font-mono text-lg font-medium break-all tabular-nums"), "—"),
				)
			}
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("dcount", ""),
				h.Div(h.Class("relative min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
					discreteSvg("plot", "0 0 560 340", "Pascal's triangle")),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Choose"),
						field("n", "n (items)", "", 6, 0, 40, 1),
						field("k", "k (chosen)", "", 2, 0, 40, 1),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						card("perm", "Ordered, no repeats", "n! / (n−k)!"),
						card("comb", "Unordered, no repeats", "n! / (k!(n−k)!)"),
						card("seq", "Ordered, repeats", "nᵏ"),
						card("multi", "Unordered, repeats", "C(n+k−1, k)"),
					),
					h.P(h.Data("out", "rule"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D4

func discretePigeonholeBlock() Block {
	return Block{
		Slug:        "pigeonhole",
		Title:       "Pigeonhole and birthdays",
		Description: "Put n pigeons in m holes and some hole holds at least ⌈n/m⌉: a certainty. Its probabilistic cousin is the birthday problem: with just 23 people, a shared birthday is more likely than not.",
		Tags:        []string{"pigeonhole", "probability", "exact"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dpigeon",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					discreteSvg("holes", "0 0 300 260", "Pigeons in holes"),
					discreteSvg("birthday", "0 0 300 260", "Probability of a shared birthday"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pigeonhole"),
					field("n", "Pigeons n", "", 13, 1, 40, 1),
					field("m", "Holes m", "", 4, 1, 12, 1),
					discreteButton("shuffle", "Throw again", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Birthdays"),
					field("people", "People", "", 23, 1, 80, 1),
				),
				readouts([2]string{"guaranteed", "guar"}, [2]string{"fullest hole", "max"}, [2]string{"P(shared)", "pb"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D5

func discreteHanoiBlock() Block {
	return Block{
		Slug:        "hanoi",
		Title:       "Tower of Hanoi",
		Description: "Move the stack to the last peg, one disk at a time, never a larger disk on a smaller one. The recursion T(n) = 2T(n−1) + 1 gives exactly 2ⁿ − 1 moves, and the animation plays them in order.",
		Tags:        []string{"recursion", "recurrence", "2ⁿ − 1"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dhanoi",
				discreteSvg("plot", "0 0 560 260", "Tower of Hanoi"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Disks"),
					field("n", "Disks n", "", 4, 1, 8, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discretePlayButton("Solve"),
					discreteButton("step", "Step", hugeicons.ArrowRight01Icon()),
					discreteButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"move", "move"}, [2]string{"2ⁿ − 1", "total"}, [2]string{"last", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D6

func discreteFibonacciBlock() Block {
	return Block{
		Slug:        "fibonacci",
		Title:       "Fibonacci and the golden ratio",
		Description: "F(n) = F(n−1) + F(n−2), computed exactly with big integers. The ratio of neighbours converges to φ = (1 + √5)/2, and Binet's formula F(n) = (φⁿ − ψⁿ)/√5 agrees with the recurrence to the last digit while floating point lasts.",
		Tags:        []string{"recurrence", "φ", "BigInt"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dfib",
				discreteSvg("plot", "0 0 560 300", "Ratio of consecutive Fibonacci numbers"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Term"),
					field("n", "n", "", 20, 1, 300, 1),
				),
				readouts([2]string{"F(n)", "f"}, [2]string{"digits", "digits"}, [2]string{"F(n)/F(n−1)", "ratio"}, [2]string{"φ − ratio", "err"}, [2]string{"Binet", "binet"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D7

func discreteSpanningBlock() Block {
	return Block{
		Slug:        "spanning-tree",
		Title:       "Minimum spanning tree",
		Description: "Connect every vertex at the lowest total cost. Kruskal takes edges cheapest first and skips any that would close a cycle (tracked with union–find); Prim grows one tree from a start vertex. Different routes, same total.",
		Tags:        []string{"Kruskal", "Prim", "union–find"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dmst",
				discreteSvg("plot", "0 0 560 360", "Weighted graph and its spanning tree"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Algorithm"),
					segs("Algorithm", [2]string{"kruskal", "Kruskal"}, [2]string{"prim", "Prim"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discreteButton("step", "Step", hugeicons.ArrowRight01Icon()),
					discretePlayButton("Run"),
					discreteButton("reset", "Reset", hugeicons.RefreshIcon()),
					discreteButton("shuffle", "New weights", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"tree edges", "count"}, [2]string{"total weight", "total"}, [2]string{"last move", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D8

func discreteVennBlock() Block {
	return Block{
		Slug:        "inclusion-exclusion",
		Title:       "Inclusion–exclusion",
		Description: "Count a union without counting twice: |A ∪ B ∪ C| = |A| + |B| + |C| − |A∩B| − |A∩C| − |B∩C| + |A∩B∩C|. Set the size of each of the seven regions, and hover a term to see which regions it counts.",
		Tags:        []string{"sets", "Venn", "counting"},
		Wide:        true,
		Render: func() h.Node {
			regions := [][3]string{{"a", "A only", "6"}, {"b", "B only", "5"}, {"c", "C only", "4"}, {"ab", "A∩B only", "3"}, {"ac", "A∩C only", "2"}, {"bc", "B∩C only", "2"}, {"abc", "A∩B∩C", "1"}}
			return plotPanel("dvenn",
				h.Div(h.Class("flex flex-col gap-3"),
					discreteSvg("plot", "0 0 420 320", "Venn diagram of three sets"),
					h.Div(h.Data("terms", ""), h.Class("flex flex-wrap justify-center gap-1.5 font-mono text-xs")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Region sizes"),
					h.Map(regions, func(r [3]string) h.Node {
						return field(r[0], r[1], "", float64(r[2][0]-'0'), 0, 99, 1)
					}),
				),
				readouts([2]string{"|A ∪ B ∪ C|", "union"}, [2]string{"by the formula", "formula"}),
			)
		},
	}
}
