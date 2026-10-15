package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LogicBlocks lists the logic gallery.
func LogicBlocks() []Block {
	return []Block{
		logicTruthTableBlock(),
		logicGatesBlock(),
		logicArgumentsBlock(),
		logicVennBlock(),
		logicSetsBlock(),
		logicQuantifiersBlock(),
		logicInductionBlock(),
		logicParadoxesBlock(),
	}
}

// ---------------------------------------------------------------- L1

var logicFormulaPresets = [][2]string{
	{"p → q", "(p → q) ↔ (¬q → ¬p)"},
	{"De Morgan", "¬(p ∧ q) ↔ (¬p ∨ ¬q)"},
	{"excluded middle", "p ∨ ¬p"},
	{"contradiction", "p ∧ ¬p"},
	{"satisfiable", "(p ∨ q) ∧ (¬p ∨ r)"},
}

func logicTruthTableBlock() Block {
	return Block{
		Slug:        "truth-table",
		Title:       "Truth table builder",
		Description: "Type any propositional formula and get its full truth table. ASCII works too: ~ or ! for not, & for and, | for or, -> and <->. The verdict says whether it is a tautology, a contradiction, or merely satisfiable.",
		Tags:        []string{"parser", "tautology", "keyboard"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("truth", ""),
				h.Div(h.Class("flex flex-col gap-2"),
					cryptoTextInput("formula", logicFormulaPresets[0][1], "Formula"),
					h.Div(h.Class("flex flex-wrap items-center gap-1.5"),
						h.Map([]string{"¬", "∧", "∨", "→", "↔", "(", ")"}, func(s string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("insert", s), h.Class("w-9 font-mono"), h.Aria("label", "Insert "+s), s)
						}),
						h.Span(h.Class("mx-1 h-5 w-px bg-border")),
						h.Map(logicFormulaPresets, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", p[1]), h.Class("font-normal text-muted-foreground"), p[0])
						}),
					),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					h.Span(h.Data("out", "verdict"), h.Class("rounded-full border px-2.5 py-0.5 text-xs font-medium"), "—"),
					h.Span(h.Data("out", "parsed"), h.Class("font-mono text-xs text-muted-foreground")),
				),
				h.Div(h.Data("table", ""), h.Class("scroll-thin max-h-80 overflow-auto rounded-lg border bg-code")),
			)
		},
	}
}

// ---------------------------------------------------------------- L2

func logicGatesBlock() Block {
	return Block{
		Slug:        "gates",
		Title:       "Logic gates: a full adder",
		Description: "Two XOR gates, two AND gates and an OR gate add three bits. Click the inputs; live wires light up, and the outputs read as a two-bit number: A + B + Cin = 2·Cout + S. Chain 64 of these and you have the adder in a CPU.",
		Tags:        []string{"circuit", "binary", "click"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_240px]"), h.Data("gates", ""),
				h.Div(h.Class("border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("circuit", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full select-none"), h.Role("group"), h.Aria("label", "Full adder circuit"))),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Inputs"),
					h.Div(h.Class("grid grid-cols-3 gap-2"),
						h.Map([]string{"A", "B", "Cin"}, func(s string) h.Node {
							return h.Button(h.Type("button"), h.Data("input", s), h.Aria("pressed", "false"),
								h.Class("flex flex-col items-center gap-0.5 rounded-lg border py-2 font-mono text-lg tabular-nums shadow-xs transition-[border-color,background-color,color] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand"),
								h.Span(h.Data("bit", ""), "0"), h.Span(h.Class("font-sans text-[10px] text-muted-foreground"), s))
						}),
					),
					readouts([2]string{"S (sum)", "s"}, [2]string{"Cout (carry)", "c"}, [2]string{"A + B + Cin", "sum"}),
					h.Div(h.Data("truthrow", ""), h.Class("scroll-thin overflow-x-auto")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L3

type logicArgument struct {
	key, name, form string
	premises        []string // formulas in the parser's syntax
	conclusion      string
	example         []string
}

var logicArguments = []logicArgument{
	{"mp", "Modus ponens", "If P then Q. P. So Q.", []string{"p → q", "p"}, "q",
		[]string{"If it rains, the street is wet.", "It rains.", "So the street is wet."}},
	{"mt", "Modus tollens", "If P then Q. Not Q. So not P.", []string{"p → q", "¬q"}, "¬p",
		[]string{"If it rains, the street is wet.", "The street is not wet.", "So it did not rain."}},
	{"hs", "Hypothetical syllogism", "If P then Q. If Q then R. So if P then R.", []string{"p → q", "q → r"}, "p → r",
		[]string{"If I study, I pass.", "If I pass, I graduate.", "So if I study, I graduate."}},
	{"ds", "Disjunctive syllogism", "P or Q. Not P. So Q.", []string{"p ∨ q", "¬p"}, "q",
		[]string{"The key is in the bag or the car.", "It is not in the bag.", "So it is in the car."}},
	{"ac", "Affirming the consequent", "If P then Q. Q. So P.", []string{"p → q", "q"}, "p",
		[]string{"If it rains, the street is wet.", "The street is wet.", "So it rained. (A street cleaner could have passed.)"}},
	{"da", "Denying the antecedent", "If P then Q. Not P. So not Q.", []string{"p → q", "¬p"}, "¬q",
		[]string{"If it rains, the street is wet.", "It does not rain.", "So the street is not wet."}},
}

func logicArgumentsBlock() Block {
	return Block{
		Slug:        "arguments",
		Title:       "Valid forms and fallacies",
		Description: "An argument is valid when no assignment makes every premise true and the conclusion false. The checker searches the truth table for such a row; the two classic fallacies each have one, and it is shown as a counterexample.",
		Tags:        []string{"validity", "counterexample", "fallacies"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("arguments", ""),
				h.Div(h.Class("flex flex-wrap gap-1.5"), h.Role("tablist"), h.Aria("label", "Argument"),
					h.MapIdx(logicArguments, func(i int, a logicArgument) h.Node {
						return h.Button(h.Type("button"), h.Role("tab"), h.Data("arg", a.key), h.Aria("selected", fmt.Sprint(i == 0)),
							h.Data("premises", joinArgs(a.premises)), h.Data("conclusion", a.conclusion), h.Data("form", a.form), h.Data("example", joinArgs(a.example)),
							h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:border-brand aria-selected:bg-brand/10 aria-selected:text-brand"),
							a.name)
					}),
				),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-4"),
						h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Form"),
						h.P(h.Data("out", "form"), h.Class("text-sm font-medium"), "—"),
						h.Ol(h.Data("out", "symbolic"), h.Class("flex flex-col gap-1 font-mono text-sm")),
					),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-4"),
						h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "In words"),
						h.Ol(h.Data("out", "example"), h.Class("flex flex-col gap-1 text-sm text-muted-foreground")),
					),
				),
				h.Div(h.Data("out", "verdict"), h.Class("rounded-lg border p-3 text-sm"), "—"),
			)
		},
	}
}

func joinArgs(xs []string) string {
	out := ""
	for i, x := range xs {
		if i > 0 {
			out += "|"
		}
		out += x
	}
	return out
}

// ---------------------------------------------------------------- L4

type logicSyllogism struct {
	key, name string
	lines     [3]string
	// Premises and conclusion as (type, subject, predicate) with types A
	// (all), E (no), I (some), O (some … not); terms S, M, P.
	spec string
}

var logicSyllogisms = []logicSyllogism{
	{"barbara", "Barbara (valid)", [3]string{"All M are P.", "All S are M.", "So all S are P."}, "A M P|A S M|A S P"},
	{"celarent", "Celarent (valid)", [3]string{"No M are P.", "All S are M.", "So no S are P."}, "E M P|A S M|E S P"},
	{"darii", "Darii (valid)", [3]string{"All M are P.", "Some S are M.", "So some S are P."}, "A M P|I S M|I S P"},
	{"ferio", "Ferio (valid)", [3]string{"No M are P.", "Some S are M.", "So some S are not P."}, "E M P|I S M|O S P"},
	{"undistributed", "Undistributed middle", [3]string{"All P are M.", "All S are M.", "So all S are P."}, "A P M|A S M|A S P"},
	{"illicit", "Illicit minor", [3]string{"All M are P.", "All M are S.", "So all S are P."}, "A M P|A M S|A S P"},
}

func logicVennBlock() Block {
	return Block{
		Slug:        "syllogisms",
		Title:       "Syllogisms on a Venn diagram",
		Description: "Aristotle's categorical syllogisms, checked the way Venn did it (1880): shade what a universal premise says is empty, mark an × where a particular premise says something exists, then read the conclusion off the picture.",
		Tags:        []string{"Venn", "Aristotle", "validity"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("venn", ""),
				h.Div(h.Class("flex items-center justify-center border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 420 330"), h.Class("block w-full max-w-[460px]"), h.Role("img"), h.Aria("label", "Venn diagram of S, P and M"))),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Syllogism"),
					h.Div(h.Class("flex flex-wrap gap-1.5"), h.Role("tablist"), h.Aria("label", "Syllogism"),
						h.MapIdx(logicSyllogisms, func(i int, s logicSyllogism) h.Node {
							return h.Button(h.Type("button"), h.Role("tab"), h.Data("syl", s.key), h.Data("spec", s.spec), h.Data("lines", s.lines[0]+"|"+s.lines[1]+"|"+s.lines[2]),
								h.Aria("selected", fmt.Sprint(i == 0)),
								h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:border-brand aria-selected:bg-brand/10 aria-selected:text-brand"),
								s.name)
						}),
					),
					h.Ol(h.Data("out", "lines"), h.Class("flex flex-col gap-1 border-t pt-4 text-sm")),
					h.Div(h.Data("out", "verdict"), h.Class("rounded-lg border p-3 text-sm"), "—"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L5

func logicSetsBlock() Block {
	ops := [][2]string{{"union", "A ∪ B"}, {"inter", "A ∩ B"}, {"diff", "A − B"}, {"sym", "A △ B"}, {"compA", "Aᶜ"}}
	return Block{
		Slug:        "sets",
		Title:       "Set operations",
		Description: "Sets of numbers from a universe of 1 to 20. Edit A and B as comma-separated lists, pick an operation, and the Venn region shades while the result is listed and counted. |A ∪ B| = |A| + |B| − |A ∩ B| is checked live.",
		Tags:        []string{"Venn", "union", "inclusion–exclusion"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("sets", ""),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
					h.Label(h.Class("flex flex-col gap-1.5 text-xs text-muted-foreground"), "A", cryptoTextInput("A", "2, 4, 6, 8, 10, 12", "Set A")),
					h.Label(h.Class("flex flex-col gap-1.5 text-xs text-muted-foreground"), "B", cryptoTextInput("B", "3, 6, 9, 12, 15", "Set B")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5 self-start"), h.Role("tablist"), h.Aria("label", "Operation"),
					h.MapIdx(ops, func(i int, o [2]string) h.Node { return segButton(o[0], o[1], i == 0) })),
				h.Div(h.Class("grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 320 210"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Venn diagram of A and B")),
					h.Div(h.Class("flex flex-col gap-2"),
						h.P(h.Data("out", "result"), h.Class("rounded-lg border bg-code p-3 font-mono text-sm break-words"), "—"),
						h.P(h.Data("out", "count"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L6

func logicQuantifiersBlock() Block {
	statements := [][2]string{
		{"allCircleRed", "∀x (Circle(x) → Red(x))"},
		{"someSquareBlue", "∃x (Square(x) ∧ Blue(x))"},
		{"allRedOrBig", "∀x (Red(x) ∨ Big(x))"},
		{"noTriangleBig", "¬∃x (Triangle(x) ∧ Big(x))"},
		{"everyBlueHasRed", "∀x (Blue(x) → ∃y (Red(y) ∧ Same shape(x, y)))"},
	}
	return Block{
		Slug:        "quantifiers",
		Title:       "Quantifiers in a small world",
		Description: "First-order statements evaluated over a domain of six objects. Click an object to change its colour, Shift-click to change its size; each statement re-evaluates and points at its witness or its counterexample.",
		Tags:        []string{"∀ ∃", "models", "counterexamples"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"), h.Data("quant", ""),
				h.Div(h.Class("flex flex-col gap-2 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("world", ""), h.ViewBox("0 0 360 240"), h.Class("block w-full select-none"), h.Role("group"), h.Aria("label", "The domain: six objects")),
					h.P(h.Class("text-xs text-muted-foreground"), "Click: change colour · Shift-click: change size")),
				h.Ul(h.Class("flex flex-col gap-1 p-3"),
					h.Map(statements, func(s [2]string) h.Node {
						return h.Li(h.Data("stmt", s[0]), h.TabIndex(0),
							h.Class("flex items-center gap-3 rounded-lg border border-transparent p-2.5 outline-none transition-colors duration-100 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[active]:border-border data-[active]:bg-background"),
							h.Span(h.Data("val", ""), h.Class("w-12 shrink-0 rounded-full border px-1.5 py-0.5 text-center font-mono text-[11px]"), "—"),
							h.Div(h.Class("flex min-w-0 flex-col gap-0.5"),
								h.Span(h.Class("font-mono text-sm"), s[1]),
								h.Span(h.Data("why", ""), h.Class("text-xs text-muted-foreground"))),
						)
					}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L7

func logicInductionBlock() Block {
	return Block{
		Slug:        "induction",
		Title:       "Proof by induction",
		Description: "1 + 3 + 5 + … + (2n − 1) = n². The picture proves it at a glance: each odd number is an L-shaped layer that turns an n × n square into an (n + 1) × (n + 1) one. The stepper walks through the formal proof beside it.",
		Tags:        []string{"induction", "stepper", "proof without words"},
		Render: func() h.Node {
			n := mi("n")
			steps := []h.Node{
				h.Div(h.Class("flex flex-col gap-2"), h.Span(h.Class("font-medium"), "Claim"),
					h.P("For every n ≥ 1, the sum of the first n odd numbers is n²:"),
					mathBlock(h.El("munderover", mo("∑"), mrow(mi("k"), mo("="), mn("1")), n), mrow(mo("("), mn("2"), mi("k"), mo("−"), mn("1"), mo(")")), mo("="), msup(n, mn("2")))),
				h.Div(h.Class("flex flex-col gap-2"), h.Span(h.Class("font-medium"), "Base case, n = 1"),
					h.P("The sum has one term, 1, and 1² = 1. The claim holds.")),
				h.Div(h.Class("flex flex-col gap-2"), h.Span(h.Class("font-medium"), "Inductive hypothesis"),
					h.P("Assume it holds for some n: 1 + 3 + … + (2n − 1) = n².")),
				h.Div(h.Class("flex flex-col gap-2"), h.Span(h.Class("font-medium"), "Inductive step"),
					h.P("Add the next odd number, 2(n + 1) − 1 = 2n + 1:"),
					mathBlock(msup(n, mn("2")), mo("+"), mn("2"), n, mo("+"), mn("1"), mo("="), msup(mrow(mo("("), n, mo("+"), mn("1"), mo(")")), mn("2"))),
					h.P("So the claim holds for n + 1.")),
				h.Div(h.Class("flex flex-col gap-2"), h.Span(h.Class("font-medium"), "Conclusion"),
					h.P("It holds for 1, and holding for n forces it for n + 1, so it holds for every n ≥ 1. ∎")),
			}
			return h.Div(h.Class("grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("induction", ""),
				h.Div(h.Class("flex flex-col items-center gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 220 220"), h.Class("block w-full max-w-[260px]"), h.Role("img"), h.Aria("label", "Odd numbers as L-shaped layers of a square")),
					h.Div(h.Class("w-48"), field("n", "n", "", 5, 1, 10, 1)),
					h.P(h.Data("out", "sum"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid min-h-44 rounded-lg border bg-background p-4 text-sm leading-relaxed"),
						h.MapIdx(steps, func(i int, s h.Node) h.Node {
							return h.Div(h.Data("proof", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1"), s)
						})),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
						h.Span(h.Data("counter", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("1 / %d", len(steps))),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L8

type logicParadox struct {
	name, who, statement, why string
}

var logicParadoxes = []logicParadox{
	{"The liar", "Attributed to Eubulides of Miletus, 4th century BCE",
		"“This sentence is false.”",
		"If it is true, then it is false; if it is false, then it is true. Tarski (1933) concluded that a language cannot define truth for its own sentences."},
	{"Russell's paradox", "Bertrand Russell, 1901; sent to Frege in 1902",
		"Let R be the set of all sets that are not members of themselves. Is R a member of R?",
		"Either answer implies the other, so unrestricted comprehension (any property defines a set) is inconsistent. Zermelo's axioms (1908) avoid it by building sets only inside existing sets."},
	{"The barber", "Popularised by Russell (1918) as an illustration",
		"A village barber shaves exactly those villagers who do not shave themselves. Who shaves the barber?",
		"Unlike Russell's set, the conclusion here is simply that no such barber can exist; the story is an analogy, not a paradox of logic itself."},
	{"Incompleteness", "Kurt Gödel, 1931",
		"A sentence that says, in effect, “I am not provable in this system.”",
		"In any consistent, effectively axiomatised system strong enough for basic arithmetic, such a sentence can be neither proved nor refuted, though it is true of the ordinary natural numbers: not a contradiction, a limit."},
}

func logicParadoxesBlock() Block {
	return Block{
		Slug:        "paradoxes",
		Title:       "Paradoxes",
		Description: "Self-reference breaks naive logic. Four cards, each with who stated it, the paradox in one line, and what it forced logicians to change.",
		Tags:        []string{"self-reference", "history", "cards"},
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
				h.Map(logicParadoxes, func(p logicParadox) h.Node {
					return h.Article(h.Class("flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-xs"),
						h.H3(h.Class("text-sm font-semibold"), p.name),
						h.P(h.Class("text-xs text-muted-foreground"), p.who),
						h.P(h.Class("border-l-2 border-brand/50 pl-3 text-[15px] leading-relaxed"), p.statement),
						h.P(h.Class("text-[13px] leading-relaxed text-muted-foreground"), p.why),
					)
				}),
			)
		},
	}
}
