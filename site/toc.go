package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// TocBlocks lists the theory of computation gallery in display order. Every
// machine runs for real in static/js/toc*.js: DFAs checked for equivalence
// by product construction, table-filling minimisation, an exhaustive
// pumping-lemma check, a PDA, a Turing machine, the busy beaver champions
// (BB(5) included), a diagonal argument, a 3-SAT reduction and DPLL.
func TocBlocks() []Block {
	return []Block{
		tocDFABlock(),
		tocMinimizeBlock(),
		tocPumpingBlock(),
		tocPDABlock(),
		tocTuringBlock(),
		tocBeaverBlock(),
		tocHaltingBlock(),
		tocChomskyBlock(),
		tocReductionBlock(),
		tocDPLLBlock(),
	}
}

// tocNote is the small print under a panel.
func tocNote(parts ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, parts...)...)
}

// tocChips is an empty container the module fills with preset chips.
func tocChips(label string) h.Node {
	return h.Div(h.Class("flex flex-col gap-2"), panelLabel(label), h.Div(h.Data("presets", ""), h.Class("flex flex-wrap gap-1.5")))
}

func tocButton(act string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", act), icon, label)
}

// tocTape is the strip of cells a machine reads, filled by the module.
func tocTape() h.Node {
	return h.Div(h.Class("scroll-thin overflow-x-auto pb-1"), h.Div(h.Data("tape", ""), h.Class("flex w-max gap-1 font-mono text-sm")))
}

// ---------------------------------------------------------------- 1

func tocDFABlock() Block {
	return Block{
		Slug:        "dfa-designer",
		Title:       "Design a DFA",
		Description: "Build a deterministic finite automaton for a target language by editing its transition table: click a cell to change where the machine goes, click a state to make it accepting. The checker compares your machine with the language exactly, by a product construction, and hands you the shortest string they disagree on.",
		Tags:        []string{"DFA", "regular languages", "equivalence"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("toc-dfa", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Target language over {0, 1}"),
						segs("Target", [2]string{"mod3", "binary multiple of 3"}, [2]string{"even1", "even number of 1s"}, [2]string{"ends01", "ends in 01"}, [2]string{"no11", "no 11"}),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						tocButton("add", hugeicons.Add01Icon(), "State"),
						tocButton("remove", hugeicons.MinusSignIcon(), "State"),
						tocButton("clear", hugeicons.RefreshIcon(), "Clear"),
					),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_340px]"),
					h.Div(h.Class("relative min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
						h.Div(h.Class("scroll-thin overflow-x-auto"), h.Svg(h.Data("graph", ""), h.Class("mx-auto block h-auto max-w-full"), h.Role("img"), h.Aria("label", "State diagram of your DFA"))),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						panelLabel("Transition table"),
						h.Div(h.Class("overflow-x-auto rounded-md border"), h.Table(h.Data("table", ""), h.Class("w-full font-mono text-xs"))),
						tocNote("Click a state name to toggle accepting (double ring). Click a cell to send that transition to the next state. q0 is the start."),
						pltInput("str", "Test a string", "110"),
						readouts([2]string{"your DFA", "mine"}, [2]string{"the language", "truth"}, [2]string{"check", "verdict"}),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func tocMinimizeBlock() Block {
	return Block{
		Slug:        "minimize",
		Title:       "Minimising a DFA",
		Description: "Two states are equivalent when no string can tell them apart. The table-filling algorithm marks pairs it can separate: first accepting against rejecting, then any pair whose transitions on some symbol land on a marked pair. Pairs left unmarked merge, and the result is the unique smallest DFA for the language (Myhill–Nerode).",
		Tags:        []string{"table filling", "Myhill–Nerode", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("toc-min", ""), h.TabIndex(0),
				h.Aria("label", "DFA minimisation. Arrow keys step through the rounds."),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"),
					segs("Machine", [2]string{"a", "8 states, ends in ab"}, [2]string{"b", "6 states, mod 3"}, [2]string{"c", "5 states, already minimal"}),
					pltStepper(true),
				),
				h.Div(h.Class("grid lg:grid-cols-2"),
					h.Div(h.Class("flex min-w-0 flex-col gap-2 border-b bg-code p-3 lg:border-r lg:border-b-0"),
						panelLabel("Original"),
						h.Div(h.Class("scroll-thin overflow-x-auto"), h.Svg(h.Data("orig", ""), h.Class("block h-auto min-w-[420px]"), h.Role("img"), h.Aria("label", "Original DFA"))),
						panelLabel("Minimal"),
						h.Div(h.Class("scroll-thin overflow-x-auto"), h.Svg(h.Data("min", ""), h.Class("block h-auto min-w-[300px]"), h.Role("img"), h.Aria("label", "Minimised DFA"))),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						panelLabel("Pairs of states"),
						h.Div(h.Class("overflow-x-auto"), h.Table(h.Data("pairs", ""), h.Class("mx-auto font-mono text-[11px]"))),
						pltMessage(),
						readouts([2]string{"round", "round"}, [2]string{"marked pairs", "marked"}, [2]string{"classes", "classes"}),
						pltKeys(),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func tocPumpingBlock() Block {
	return Block{
		Slug:        "pumping",
		Title:       "The pumping lemma game",
		Description: "If a language is regular, every long enough string in it can be split xyz, with |xy| ≤ p and y non-empty, so that every xyⁱz stays in the language. To prove a language is not regular, you play against that claim: the adversary names p, you choose a string, and the checker tries every legal split for one that survives pumping.",
		Tags:        []string{"pumping lemma", "proof", "game"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("toc-pump", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"),
					segs("Language", [2]string{"anbn", "aⁿbⁿ"}, [2]string{"pal", "palindromes"}, [2]string{"sq", "a^(n²)"}, [2]string{"abstar", "(ab)*"}),
					h.Div(h.Class("flex flex-wrap gap-2"),
						tocButton("newp", hugeicons.ShuffleIcon(), "New p"),
						tocButton("suggest", hugeicons.SparklesIcon(), "Suggest a string"),
					),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_320px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
						h.P(h.Data("out", "claim"), h.Class("text-sm")),
						pltInput("s", "Your string s (must be in the language and have |s| ≥ p)", "aaaabbbb"),
						pltMessage(),
						panelLabel("The adversary's split"),
						h.Div(h.Data("split", ""), h.Class("scroll-thin flex flex-wrap gap-1 overflow-x-auto font-mono text-sm")),
						h.Div(h.Class("flex flex-wrap items-center gap-3"),
							field("i", "Pump i", "", 2, 0, 6, 1),
							h.Span(h.Data("out", "pumped"), h.Class("min-w-0 font-mono text-sm break-all")),
						),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							tocButton("prev", hugeicons.ArrowLeft01Icon(), "Split"),
							tocButton("next", hugeicons.ArrowRight01Icon(), "Split"),
							h.Span(h.Data("out", "which"), h.Class("font-mono text-xs text-muted-foreground")),
						),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						readouts([2]string{"p", "p"}, [2]string{"legal splits", "nsplits"}, [2]string{"splits that survive", "survive"}, [2]string{"verdict", "verdict"}),
						tocNote("A split survives if xyⁱz stays in the language for every i from 0 to 6, a finite stand-in for “all i”. For (ab)*, a regular language, a surviving split always exists: that is what the lemma promises. Winning the game for one string proves the language is not regular; the lemma alone can never prove one is."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func tocPDABlock() Block {
	return Block{
		Slug:        "pda",
		Title:       "Pushdown automaton",
		Description: "A finite automaton with a stack. That one unbounded memory is enough for nested structure: balanced brackets, aⁿbⁿ, a string followed by its mirror. Step through the input and watch each transition read a symbol, pop the top of the stack and push a replacement.",
		Tags:        []string{"PDA", "stack", "context-free"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("toc-pda", ""), h.TabIndex(0),
				h.Aria("label", "Pushdown automaton. Arrow keys step through the input."),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end"),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Machine"),
						segs("Machine", [2]string{"brackets", "balanced ( ) [ ]"}, [2]string{"anbn", "aⁿbⁿ"}, [2]string{"wcw", "w c wᴿ"})),
					pltInput("str", "Input", "([()])()"),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_120px_300px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b bg-code p-4 lg:border-r lg:border-b-0"),
						panelLabel("Input"),
						tocTape(),
						panelLabel("Transitions"),
						h.Div(h.Class("overflow-x-auto rounded-md border bg-background"), h.Table(h.Data("rules", ""), h.Class("w-full font-mono text-xs"))),
					),
					h.Div(h.Class("flex flex-col gap-2 border-b p-4 lg:border-r lg:border-b-0"),
						panelLabel("Stack"),
						h.Div(h.Data("stack", ""), h.Class("flex min-h-8 flex-wrap gap-1 font-mono text-sm lg:flex-col lg:flex-nowrap")),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						pltStepper(true),
						pltMessage(),
						readouts([2]string{"state", "state"}, [2]string{"read", "read"}, [2]string{"stack depth", "depth"}, [2]string{"verdict", "verdict"}),
						pltKeys(),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func tocTuringBlock() Block {
	return Block{
		Slug:        "turing-machine",
		Title:       "Turing machine",
		Description: "A finite table of rules, a head and an unbounded tape: Turing's 1936 model of everything an algorithm can do. Each rule reads the symbol under the head, writes one, moves left or right and changes state. Load a preset or write your own rules.",
		Tags:        []string{"Turing machine", "tape", "simulator"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("toc-tm", ""), h.TabIndex(0),
				h.Aria("label", "Turing machine. Arrow keys step."),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
					tocChips("Presets"),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_320px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
						panelLabel("Tape"),
						tocTape(),
						h.Div(h.Class("grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"),
							pltSource("rules", "Rules: state read write move next (_ is blank, halt stops)", "", 9),
							h.Div(h.Class("flex flex-col gap-3"),
								pltInput("input", "Initial tape", "1011"),
								h.Div(h.Class("overflow-x-auto rounded-md border bg-background"), h.Table(h.Data("trace", ""), h.Class("w-full font-mono text-[11px]"))),
							),
						),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						pltStepper(true),
						pltMessage(),
						readouts([2]string{"state", "state"}, [2]string{"steps", "steps"}, [2]string{"head", "head"}, [2]string{"output", "output"}),
						tocNote("Runs stop after 100,000 steps: a simulator cannot know in general whether a machine will ever halt. The next blocks are about exactly that."),
						pltKeys(),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func tocBeaverBlock() Block {
	return Block{
		Slug:        "busy-beaver",
		Title:       "Busy beavers",
		Description: "Among all n-state, two-symbol Turing machines started on a blank tape that eventually halt, which runs longest? The champions are known up to five states: BB(5) = 47,176,870 steps, proved in 2024 by the bbchallenge collaboration with a Coq-checked proof. BB(n) grows faster than any computable function. Run each champion here, BB(5) included.",
		Tags:        []string{"busy beaver", "uncomputable", "space–time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("toc-bb",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Canvas(h.Data("canvas", ""), h.Class("block w-full rounded-md [image-rendering:pixelated]"), h.Attr("height", "360"), h.Attr("width", "720"), h.Role("img"), h.Aria("label", "Space–time diagram: one row per step, filled cells are 1s, the head is highlighted")),
					h.P(h.Data("out", "caption"), h.Class("font-mono text-[11px] text-muted-foreground")),
				),
				segs("Champion", [2]string{"2", "BB(2)"}, [2]string{"3", "BB(3)"}, [2]string{"4", "BB(4)"}, [2]string{"5", "BB(5)"}),
				h.Div(h.Class("flex flex-wrap gap-2"), playPauseLabel("Run"), tocButton("reset", hugeicons.RefreshIcon(), "Reset")),
				h.Div(h.Class("overflow-x-auto rounded-md border"), h.Table(h.Data("table", ""), h.Class("w-full font-mono text-xs"))),
				readouts([2]string{"steps", "steps"}, [2]string{"1s on tape", "ones"}, [2]string{"state", "state"}, [2]string{"known record", "record"}),
				tocNote("Steps count the halting transition. Champions in standard notation, e.g. 1RB = write 1, move right, go to B; Z halts. BB(2) and BB(3) by Lin and Rado (1965), BB(4) by Brady (1983), BB(5) champion found by Marxen and Buntrock (1989). BB(5) is drawn as about 360 sampled rows, each tape squeezed to the canvas width."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func tocHaltingBlock() Block {
	return Block{
		Slug:        "halting",
		Title:       "Why halting is undecidable",
		Description: "Suppose some program H could decide, for any program P and input x, whether P halts on x. List every program as a row and every input as a column. Build D to do the opposite of the diagonal: D(i) loops exactly when program i halts on i. D differs from every row in at least one cell, so D is not on the list, yet H would let us write it. No such H exists (Turing, 1936).",
		Tags:        []string{"diagonalisation", "halting problem", "proof"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("toc-halt",
				h.Div(h.Class("scroll-thin overflow-x-auto"), h.Table(h.Data("grid", ""), h.Class("mx-auto font-mono text-xs"))),
				tocNote("Click any cell to change what that program does on that input; the diagonal and D follow. Then pick a row to ask whether D is that program."),
				h.Div(h.Class("flex flex-wrap gap-2"), tocButton("shuffle", hugeicons.ShuffleIcon(), "Random table")),
				pltMessage(),
				readouts([2]string{"rows checked", "checked"}, [2]string{"D equals a row?", "found"}),
				tocNote("The table is finite here; the argument runs the same over the infinite list of all programs, which a real H would have to handle."),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func tocChomskyBlock() Block {
	return Block{
		Slug:        "chomsky",
		Title:       "The Chomsky hierarchy",
		Description: "Four nested families of languages, each matched to a grammar and a machine: regular languages and finite automata, context-free languages and pushdown automata, context-sensitive languages and linear bounded automata, recursively enumerable languages and Turing machines. Place each language in the smallest family that holds it.",
		Tags:        []string{"Chomsky", "grammars", "quiz"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("toc-chomsky",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("map", ""), h.Attr("viewBox", "0 0 560 360"), h.Class("block h-auto w-full"), h.Role("img"), h.Aria("label", "Nested regions: regular inside context-free inside context-sensitive inside recursively enumerable")),
					h.Div(h.Data("detail", ""), h.Class("grid gap-x-6 gap-y-1.5 rounded-md border bg-background p-3 text-xs leading-relaxed sm:grid-cols-2")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Family"), h.Div(h.Data("levels", ""), h.Class("flex flex-col gap-1"))),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Place this language"), h.P(h.Data("out", "lang"), h.Class("font-mono text-sm")),
					h.Div(h.Data("answers", ""), h.Class("flex flex-wrap gap-1.5"))),
				pltMessage(),
				readouts([2]string{"score", "score"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func tocReductionBlock() Block {
	return Block{
		Slug:        "reduction",
		Title:       "3-SAT reduces to independent set",
		Description: "Karp's 1972 reduction, built live. Each clause becomes a triangle; each literal is joined to its negation everywhere. The formula is satisfiable exactly when the graph has an independent set with one vertex per clause. Pick vertices yourself: checking a proposed set takes a few steps, while finding one may need a search through every choice.",
		Tags:        []string{"NP-complete", "reduction", "certificate"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("toc-red", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
					pltInput("cnf", "Formula: clauses separated by ;  literals like x1, ¬x2 (or -x2)", "x1 ∨ x2 ∨ ¬x3 ; ¬x1 ∨ x3 ∨ x4 ; ¬x2 ∨ ¬x3 ∨ ¬x4 ; x1 ∨ ¬x2 ∨ x4"),
					tocChips("Formulas"),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_300px]"),
					h.Div(h.Class("min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
						h.Svg(h.Data("graph", ""), h.Class("block h-auto w-full"), h.Role("group"), h.Aria("label", "Graph built from the formula; vertices are buttons")),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						h.Div(h.Class("flex flex-wrap gap-2"),
							tocButton("solve", hugeicons.Search01Icon(), "Search"),
							tocButton("clear", hugeicons.RefreshIcon(), "Clear"),
						),
						pltMessage(),
						readouts([2]string{"vertices · edges", "size"}, [2]string{"k (clauses)", "k"}, [2]string{"chosen", "chosen"}, [2]string{"verifier steps", "verify"}, [2]string{"search tried", "tried"}, [2]string{"assignment", "assign"}),
						tocNote("Verifier steps count the edge checks made to confirm the chosen set: polynomial in the size of the graph. The search tries one vertex per triangle, up to 3ᵐ choices for m clauses."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func tocDPLLBlock() Block {
	return Block{
		Slug:        "dpll",
		Title:       "DPLL: how SAT solvers search",
		Description: "The Davis–Putnam–Logemann–Loveland procedure (1962), the core of modern SAT solvers. Propagate every unit clause (a clause with one free literal left forces it), then guess a variable; on a conflict, undo the latest guess and try the other value. Step through the trail of assignments.",
		Tags:        []string{"SAT", "unit propagation", "backtracking"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("toc-dpll", ""), h.TabIndex(0),
				h.Aria("label", "DPLL solver. Arrow keys step."),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
					pltInput("cnf", "Formula in CNF: clauses separated by ;", "x1 ∨ x2 ; ¬x1 ∨ x3 ; ¬x3 ∨ ¬x2 ; x2 ∨ x4 ; ¬x4 ∨ ¬x1 ; x1 ∨ ¬x3 ∨ x4"),
					tocChips("Formulas"),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_320px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b bg-code p-4 lg:border-r lg:border-b-0"),
						panelLabel("Clauses"),
						h.Div(h.Data("clauses", ""), h.Class("flex flex-col gap-1 font-mono text-sm")),
						panelLabel("Trail"),
						h.Div(h.Data("trail", ""), h.Class("flex flex-wrap gap-1 font-mono text-xs")),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						pltStepper(true),
						pltMessage(),
						readouts([2]string{"step", "step"}, [2]string{"decisions", "decisions"}, [2]string{"propagations", "props"}, [2]string{"backtracks", "backtracks"}, [2]string{"verdict", "verdict"}),
						tocNote("Guesses pick the lowest-numbered free variable and try true first. Struck-through literals are false under the trail; a clause turns green once satisfied and red when every literal is false."),
						pltKeys(),
					),
				),
			)
		},
	}
}
