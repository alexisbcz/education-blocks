package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/checkbox"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/textarea"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ArgumentationBlocks lists the argumentation tools in display order. They
// are tools, not lectures: each keeps its state in the page and most copy
// their result as Markdown. Validity, soundness and the fallacy quiz live
// in /philosophy; truth tables and valid forms in /logic.
func ArgumentationBlocks() []Block {
	return []Block{
		arguToulminBlock(),
		arguMapBlock(),
		arguSteelmanBlock(),
		arguEvidenceBlock(),
		arguBayesBlock(),
		arguDebateBlock(),
		arguCERBlock(),
		arguDecisionBlock(),
		arguSocraticBlock(),
		arguRogerianBlock(),
	}
}

// arguInputClass is the shadcn input look, at 16px on phones (no iOS zoom).
const arguInputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

func arguArea(name, placeholder, value string, extra ...any) h.Node {
	return textarea.Textarea(append([]any{h.Data("argu-field", name), h.Placeholder(placeholder), h.Class("min-h-14 resize-none bg-background"), value}, extra...)...)
}

func arguLabel(text, hint string) h.Node {
	return h.Div(h.Class("flex items-baseline justify-between gap-2"),
		h.Span(h.Class("text-sm font-medium"), text),
		h.If(hint != "", h.Span(h.Class("text-xs text-muted-foreground"), hint)),
	)
}

// arguCopy is a copy button whose text the module keeps up to date (the
// page's copy handler reads data-copy at click time).
func arguCopy(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("copy", ""), h.Data("argu-copy", ""),
		h.Class("relative"),
		hugeicons.Copy01Icon(h.Class("transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-50 [[data-copied]_&]:opacity-0")),
		hugeicons.Tick02Icon(h.Class("absolute left-2.5 scale-50 opacity-0 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-100 [[data-copied]_&]:opacity-100")),
		label)
}

func arguCard(children ...any) *h.Element {
	return h.Div(append([]any{h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5")}, children...)...)
}

// ---------------------------------------------------------------- A1

func arguToulminBlock() Block {
	return Block{
		Slug:        "toulmin",
		Title:       "Toulmin argument builder",
		Description: "Stephen Toulmin's layout of a practical argument (The Uses of Argument, 1958): data lead to a claim, licensed by a warrant, supported by backing, softened by a qualifier and limited by a rebuttal. Fill the six cards; the checklist says what is still missing.",
		Tags:        []string{"Toulmin", "Markdown", "checklist"},
		Wide:        true,
		Render: func() h.Node {
			card := func(key, title, connective, hint, placeholder string) h.Node {
				return h.Div(h.Data("argu-t-card", key),
					h.Class("relative z-10 flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs transition-[border-color] duration-150 has-focus-visible:border-ring data-[empty]:border-dashed"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("font-mono text-[11px] font-medium tracking-wider uppercase"), title),
						h.If(connective != "", h.Span(h.Class("text-xs text-brand italic"), connective)),
					),
					// The card is the frame: the text area inside it stays bare.
					arguArea(key, placeholder, "", h.Aria("label", title), h.Class("min-h-0 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 dark:bg-transparent")),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), hint),
				)
			}
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"), h.Data("argu-toulmin", ""),
				h.Div(h.Class("relative flex flex-col gap-3 rounded-xl border bg-code p-3 sm:p-4"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
						segs("Example", [2]string{"harry", "Toulmin's Harry"}, [2]string{"school", "School start times"}, [2]string{"blank", "Blank"}),
						arguCopy("Copy as Markdown"),
					),
					// The connectors are drawn by the module from the cards'
					// boxes, under the cards; on phones the cards stack.
					h.Div(h.Class("relative"),
						h.Svg(h.Data("argu-t-lines", ""), h.Class("pointer-events-none absolute inset-0 hidden size-full md:block"), h.Aria("hidden", "true")),
						h.Div(h.Class("relative grid gap-3 md:grid-cols-3 md:gap-x-10 md:gap-y-4"),
							h.Div(h.Class("md:col-start-1 md:row-start-1"), card("data", "Data", "", "The facts you start from.", "What do you have to go on?")),
							h.Div(h.Class("md:col-start-2 md:row-start-1"), card("qualifier", "Qualifier", "so,", "How sure: presumably, probably, certainly.", "presumably")),
							h.Div(h.Class("md:col-start-3 md:row-start-1"), card("claim", "Claim", "", "What you want accepted.", "So what are you claiming?")),
							h.Div(h.Class("md:col-start-2 md:row-start-2"), card("warrant", "Warrant", "since", "Why the data support the claim: often unstated.", "Since…")),
							h.Div(h.Class("md:col-start-3 md:row-start-2"), card("rebuttal", "Rebuttal", "unless", "When the claim would not hold.", "Unless…")),
							h.Div(h.Class("md:col-start-2 md:row-start-3"), card("backing", "Backing", "on account of", "Why the warrant itself should be trusted.", "On account of…")),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("Checklist"),
					h.Ul(h.Data("argu-t-checks", ""), h.Class("flex flex-col gap-2 text-sm")),
					h.Div(h.Class("flex flex-col gap-1 border-t pt-3"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Completeness"),
						h.Div(h.Class("h-1.5 overflow-hidden rounded-full bg-foreground/10"),
							h.Div(h.Data("argu-t-bar", ""), h.Class("h-full w-0 rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)]"))),
						h.Span(h.Data("argu-t-score", ""), h.Class("font-mono text-xs tabular-nums"), "—"),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Whether the step from data to claim is formally valid is a different question: see ",
						h.A(h.Href("/philosophy#argument"), h.Class("underline underline-offset-4"), "validity and soundness"), "."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func arguMapBlock() Block {
	return Block{
		Slug:        "argument-map",
		Title:       "Argument map",
		Description: "A claim with the reasons for it and the objections to it, each of which can have its own reasons and objections. Add, reorder (buttons, Alt+↑/↓ or drag), collapse and weigh the nodes; the balance is a toy score, there to make you look at which branches carry the weight.",
		Tags:        []string{"tree", "drag", "keyboard"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"), h.Data("argu-map", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 rounded-xl border bg-code p-3 sm:p-4"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						h.Span(h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"), h.Span(h.Class("size-2 rounded-full bg-add")), "reason"),
						h.Span(h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"), h.Span(h.Class("size-2 rounded-full bg-del")), "objection"),
						h.Span(h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"), h.Span(h.Class("size-2 rounded-full bg-foreground/40")), "co-premise"),
						h.Div(h.Class("flex-1")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-m-action", "reset"), hugeicons.RefreshIcon(), "Example"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-m-action", "clear"), "Blank"),
					),
					h.Div(h.Data("argu-m-tree", ""), h.Role("tree"), h.Aria("label", "Argument map"), h.Class("flex flex-col gap-1.5 [--argu-indent:0.5rem] sm:[--argu-indent:1.1rem]")),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					panelLabel("Balance"),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Div(h.Class("flex h-2 overflow-hidden rounded-full bg-foreground/10"),
							h.Div(h.Data("argu-m-for", ""), h.Class("h-full bg-add transition-[width] duration-300 ease-[var(--ease-out)]")),
							h.Div(h.Data("argu-m-against", ""), h.Class("h-full bg-del transition-[width] duration-300 ease-[var(--ease-out)]")),
						),
						h.Div(h.Class("flex justify-between font-mono text-xs tabular-nums"),
							h.Span(h.Data("argu-m-for-n", ""), h.Class("text-add"), "—"),
							h.Span(h.Data("argu-m-against-n", ""), h.Class("text-del"), "—"),
						),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Toy score: each node counts its weight (1–3), scaled up by the reasons under it and down by the objections under it (×(1 + ¼·for − ¼·against), never below 0). A co-premise only counts with the node it completes."),
					h.Ul(h.Class("flex flex-col gap-1.5 border-t pt-3 text-xs text-muted-foreground"),
						h.Li(h.Class("flex items-center gap-1.5"), kbd.Group(kbd.Kbd("Alt"), kbd.Kbd("↑"), kbd.Kbd("↓")), "move"),
						h.Li(h.Class("flex items-center gap-1.5"), kbd.Group(kbd.Kbd("Alt"), kbd.Kbd("←"), kbd.Kbd("→")), "collapse, expand"),
					),
					arguCopy("Copy as Markdown"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func arguSteelmanBlock() Block {
	rules := []string{
		"Restate the other side's position so clearly and fairly that they would wish they had put it that way.",
		"List the points where you agree, especially the ones that are not widely shared.",
		"Mention anything you have learned from them.",
		"Only then say a word of rebuttal or criticism.",
	}
	checks := [][2]string{
		{"words", "Uses words its proponents would use, not yours"},
		{"evidence", "Includes their strongest evidence, not the weakest"},
		{"values", "Names the value or worry that drives the view"},
		{"proponent", "Is the version its best proponent would defend"},
		{"concede", "Concedes what is true in it"},
	}
	return Block{
		Slug:        "steelman",
		Title:       "Steelman workshop",
		Description: "Before arguing against a view, write the strongest version of it. Start from the version you would naturally write, rewrite it, and compare the two side by side; the tool flags loaded words. The order of moves follows Rapoport's rules, as popularised by Daniel Dennett.",
		Tags:        []string{"charity", "compare", "checklist"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("argu-steelman", ""),
				h.Div(h.Class("grid gap-3 md:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2 rounded-xl border bg-code p-3"),
						arguLabel("First draft", "how you would put it"),
						arguArea("straw", "The other side thinks…", "People who want to ban cars from city centres just hate drivers and obviously don't care about anyone who lives outside the city.", h.Class("min-h-32")),
						h.Div(h.Data("argu-s-flags", "straw"), h.Class("flex min-h-5 flex-wrap gap-1")),
					),
					h.Div(h.Class("flex flex-col gap-2 rounded-xl border border-brand/30 bg-code p-3"),
						arguLabel("Steelman", "how they would put it"),
						arguArea("steel", "The strongest version is…", "Car-free centres cut air pollution and road deaths where people are most concentrated, and free street space for walking, cycling and buses. Proponents accept the cost to people who drive in, and argue it should be met with better public transport and delivery exemptions, not by keeping the centre open to through traffic.", h.Class("min-h-32")),
						h.Div(h.Data("argu-s-flags", "steel"), h.Class("flex min-h-5 flex-wrap gap-1")),
					),
					h.Div(h.Class("flex flex-col gap-2 md:col-span-2"),
						panelLabel("Strengthen it"),
						h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
							h.Map(checks, func(c [2]string) h.Node {
								id := "argu-s-" + c[0]
								return h.Label(h.For(id), h.Class("flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5 text-sm"),
									checkbox.Checkbox(h.ID(id), h.Data("argu-s-check", c[0]), h.Class("mt-0.5 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white")),
									c[1])
							}),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("Rapoport's rules"),
					h.Ol(h.Class("flex flex-col gap-2"),
						h.MapIdx(rules, func(i int, r string) h.Node {
							return h.Li(h.Class("flex gap-2.5 text-sm leading-relaxed"),
								h.Span(h.Class("flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-medium text-brand"), fmt.Sprint(i+1)),
								h.Span(h.Class("text-muted-foreground"), r))
						}),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Paraphrased from Anatol Rapoport's rules, as set out by Daniel Dennett in ", h.Em("Intuition Pumps and Other Tools for Thinking"), " (2013)."),
					h.Div(h.Class("flex flex-col gap-1 border-t pt-3"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Charity"),
						h.Span(h.Data("argu-s-score", ""), h.Class("font-mono text-sm tabular-nums"), "—"),
					),
					arguCopy("Copy both versions"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func arguEvidenceBlock() Block {
	return Block{
		Slug:        "evidence",
		Title:       "Evidence strength grader",
		Description: "List the evidence for a claim and grade each piece: what kind it is, how relevant, how recent, whether it is independent of the others. The overall confidence is a heuristic that rewards strong, independent, relevant evidence and explains its reasoning; it is no substitute for reading the sources.",
		Tags:        []string{"evidence hierarchy", "heuristic", "table"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("argu-evidence", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 rounded-xl border bg-code p-3 sm:p-4"),
					h.Div(h.Class("flex flex-col gap-1.5"),
						arguLabel("Claim", ""),
						h.Input(h.Type("text"), h.Data("argu-e-claim", ""), h.Value("Regular exercise reduces the risk of depression."), h.Aria("label", "Claim"), h.Class(arguInputClass+" bg-background")),
					),
					h.Div(h.Data("argu-e-rows", ""), h.Class("flex flex-col gap-2")),
					h.Div(h.Class("flex flex-wrap gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-e-action", "add"), hugeicons.Add01Icon(), "Add evidence"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-e-action", "reset"), hugeicons.RefreshIcon(), "Example"),
					),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					panelLabel("Overall"),
					h.Div(h.Class("flex items-baseline gap-2"),
						h.Span(h.Data("argu-e-level", ""), h.Class("text-2xl font-semibold tracking-tight"), "—"),
						h.Span(h.Data("argu-e-score", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums")),
					),
					h.Ul(h.Data("argu-e-why", ""), h.Class("flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground")),
					h.P(h.Class("border-t pt-3 text-xs leading-relaxed text-muted-foreground"),
						"Ranking kinds of study (anecdote < expert opinion < observational study < randomised trial < systematic review) is a rule of thumb from evidence-based medicine. A well-run observational study can beat a poor trial."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func arguBayesBlock() Block {
	return Block{
		Slug:        "belief-update",
		Title:       "Belief updater",
		Description: "Bayes' rule in odds form: posterior odds = prior odds × the likelihood ratio of each piece of evidence. Start from how likely the claim seemed before, then add evidence as 'how many times more likely would I see this if the claim were true?'.",
		Tags:        []string{"Bayes", "log-odds", "likelihood ratio"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("argu-bayes", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 rounded-xl border bg-code p-3 sm:p-4"),
					h.Svg(h.Data("argu-b-bar", ""), h.ViewBox("0 0 640 110"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Belief on a log-odds scale")),
					h.Div(h.Data("argu-b-rows", ""), h.Class("flex flex-col gap-2")),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Add evidence:"),
						h.Map([][3]string{{"1.5", "weak for", "add"}, {"3", "moderate for", "add"}, {"10", "strong for", "add"}, {"0.6667", "weak against", "del"}, {"0.3333", "moderate against", "del"}, {"0.1", "strong against", "del"}},
							func(p [3]string) h.Node {
								return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("argu-b-add", p[0]),
									h.Span(h.Class("size-1.5 rounded-full bg-"+p[2])), p[1])
							}),
					),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					field("prior", "Prior", "%", 10, 0.1, 99.9, 0.1),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "prior odds"), h.Dd(h.Data("argu-b-out", "prior"), h.Class("tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "× evidence"), h.Dd(h.Data("argu-b-out", "lr"), h.Class("tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "posterior odds"), h.Dd(h.Data("argu-b-out", "odds"), h.Class("tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "posterior"), h.Dd(h.Data("argu-b-out", "post"), h.Class("tabular-nums text-brand"), "—"),
					),
					h.Div(h.Data("argu-b-warn", ""), h.Class("empty:hidden")),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Multiplying likelihood ratios assumes the pieces of evidence are independent given the claim. Two reports of the same rumour are one piece of evidence: mark them as the same source."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

func arguDebateBlock() Block {
	return Block{
		Slug:        "debate-flow",
		Title:       "Debate flow sheet",
		Description: "The sheet debaters keep during a round: one column per speech, one row per argument, so you can see what was answered, extended or dropped. The timer marks protected time in British Parliamentary format, or runs a simple configurable format.",
		Tags:        []string{"flow", "timer", "BP format"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3"), h.Data("argu-debate", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-xs sm:flex-row sm:items-center sm:p-4"),
					h.Div(h.Class("flex flex-col gap-1"),
						segs("Format", [2]string{"simple", "Two sides"}, [2]string{"bp", "British Parliamentary"}),
					),
					h.Div(h.Class("flex-1")),
					h.Div(h.Class("flex items-center gap-3"),
						h.Div(h.Class("flex flex-col items-end"),
							h.Span(h.Data("argu-d-speech", ""), h.Class("text-xs text-muted-foreground"), "—"),
							h.Span(h.Data("argu-d-clock", ""), h.Aria("live", "off"), h.Class("font-mono text-2xl font-medium tabular-nums"), "0:00"),
						),
						h.Span(h.Data("argu-d-phase", ""), h.Class("w-28 rounded-full border px-2 py-0.5 text-center text-[11px] text-muted-foreground"), "ready"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-d-action", "time"),
							hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Start")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-d-action", "next"), "Next speech", hugeicons.ArrowRight01Icon()),
						button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("argu-d-action", "reset"), h.Aria("label", "Reset timer"), hugeicons.RefreshIcon()),
					),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto rounded-xl border bg-code"),
					h.Table(h.Data("argu-d-sheet", ""), h.Class("w-full min-w-[720px] border-collapse text-sm")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2 text-xs text-muted-foreground"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-d-action", "row"), hugeicons.Add01Icon(), "Add argument"),
					arguCopy("Copy flow"),
					h.Span(h.Data("argu-d-note", ""), h.Class("ml-auto text-right")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func arguCERBlock() Block {
	return Block{
		Slug:        "cer",
		Title:       "Claim, evidence, reasoning",
		Description: "The paragraph structure taught in science classes: a claim, the evidence for it, and the reasoning that explains why that evidence supports that claim. Write the three parts; the tool assembles the paragraph and asks the questions a teacher would.",
		Tags:        []string{"writing", "paragraph", "prompts"},
		Render: func() h.Node {
			return arguCard(h.Data("argu-cer", ""),
				h.Div(h.Class("grid gap-3"),
					h.Div(h.Class("flex flex-col gap-1.5"), arguLabel("Claim", "one sentence, arguable"),
						arguArea("claim", "Answer the question in one sentence.", "Plants grow taller when they get more light.")),
					h.Div(h.Class("flex flex-col gap-1.5"), arguLabel("Evidence", "data, observations, sources"),
						arguArea("evidence", "What did you observe or measure?", "In our experiment, the bean plants by the window grew 14 cm in two weeks, while the ones in the cupboard grew 5 cm.")),
					h.Div(h.Class("flex flex-col gap-1.5"), arguLabel("Reasoning", "why the evidence supports the claim"),
						arguArea("reasoning", "Connect the evidence to the claim with a principle.", "Plants use light energy for photosynthesis, which makes the sugars they need to build new cells, so more light allows more growth.")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Transitions:"),
					segs("Transitions", [2]string{"plain", "Plain"}, [2]string{"formal", "Formal"}, [2]string{"none", "None"}),
				),
				h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Paragraph"),
					h.P(h.Data("argu-c-out", ""), h.Class("text-[15px] leading-relaxed")),
				),
				h.Ul(h.Data("argu-c-prompts", ""), h.Class("flex flex-col gap-1.5 text-sm")),
				h.Div(h.Class("flex justify-end border-t pt-3"), arguCopy("Copy paragraph")),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func arguDecisionBlock() Block {
	return Block{
		Slug:        "decision-matrix",
		Title:       "Decision matrix",
		Description: "Weighted pros and cons, made explicit: score each option on each criterion (1–5), weight the criteria (0–10), and see the ranking. The sensitivity check finds, for each criterion, the weight at which the winner would change, which tells you which judgement the decision really rests on.",
		Tags:        []string{"weights", "sensitivity", "table"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("argu-decision", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 rounded-xl border bg-code p-3 sm:p-4"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Data("argu-x-table", ""), h.Class("w-full min-w-[520px] border-collapse text-sm")),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-x-action", "option"), hugeicons.Add01Icon(), "Option"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-x-action", "criterion"), hugeicons.Add01Icon(), "Criterion"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-x-action", "reset"), hugeicons.RefreshIcon(), "Example"),
					),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					panelLabel("Ranking"),
					h.Ol(h.Data("argu-x-rank", ""), h.Class("flex flex-col gap-2")),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-3"),
						panelLabel("Sensitivity"),
						h.Ul(h.Data("argu-x-sens", ""), h.Class("flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A9

func arguSocraticBlock() Block {
	return Block{
		Slug:        "socratic",
		Title:       "Socratic questions",
		Description: "Questions that test a claim from six directions: what it means, what it assumes, what supports it, how others see it, where it leads, and whether it is the right question. Type a claim; the questions are filled in for it. The six kinds follow Richard Paul's taxonomy of Socratic questioning.",
		Tags:        []string{"Paul & Elder", "templates", "shuffle"},
		Render: func() h.Node {
			return arguCard(h.Data("argu-socratic", ""),
				h.Div(h.Class("flex flex-col gap-1.5"),
					arguLabel("Claim", ""),
					h.Input(h.Type("text"), h.Data("argu-q-claim", ""), h.Value("social media makes teenagers less happy"), h.Aria("label", "Claim"), h.Class(arguInputClass+" bg-background")),
				),
				h.Div(h.Data("argu-q-list", ""), h.Class("grid gap-2 sm:grid-cols-2")),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2 border-t pt-3"),
					h.P(h.Class("text-xs text-muted-foreground"),
						"After Richard Paul and Linda Elder, ", h.Em("The Thinker's Guide to the Art of Socratic Questioning"), " (2006)."),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("argu-q-action", "shuffle"), hugeicons.ShuffleIcon(), "Other questions"),
						arguCopy("Copy"),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A10

func arguRogerianBlock() Block {
	parts := [][4]string{
		{"problem", "1 · The problem", "State the issue in terms both sides accept.", "Our town's centre is congested and its air quality is poor, and people disagree about whether to close it to cars."},
		{"theirs", "2 · Their position, and where it holds", "Describe the other view fairly, and the situations where it is right.", "Shop owners worry that customers who drive in will go elsewhere. Where there is no good bus or tram link, that worry is well founded."},
		{"mine", "3 · Your position, and where it holds", "Describe your view and the situations where it is right.", "Closing streets to through traffic has, in many cities, brought more people on foot, and walkers visit shops more often."},
		{"common", "4 · Common ground and a proposal", "Show how your proposal serves their interests too.", "Close the centre on weekends first, add parking with a shuttle at the edge, and measure footfall together before deciding the next step."},
	}
	return Block{
		Slug:        "rogerian",
		Title:       "Rogerian argument",
		Description: "An argument designed to persuade someone who disagrees, by showing first that you understand them. Four moves: the problem as both sides see it, their position and where it holds, yours and where it holds, then common ground. Based on Carl Rogers' work, adapted for rhetoric by Young, Becker and Pike (1970).",
		Tags:        []string{"Rogers", "template", "tone check"},
		Render: func() h.Node {
			return arguCard(h.Data("argu-rogerian", ""),
				h.Map(parts, func(p [4]string) h.Node {
					return h.Div(h.Class("flex flex-col gap-1.5"),
						arguLabel(p[1], ""),
						h.P(h.Class("text-xs text-muted-foreground"), p[2]),
						arguArea(p[0], p[2], p[3]),
						h.Div(h.Data("argu-r-flags", p[0]), h.Class("flex min-h-5 flex-wrap gap-1")),
					)
				}),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2 border-t pt-3"),
					h.Span(h.Data("argu-r-tone", ""), h.Class("text-xs text-muted-foreground"), "—"),
					arguCopy("Copy as Markdown"),
				),
				h.P(h.Class("text-xs text-muted-foreground"),
					"Richard E. Young, Alton L. Becker and Kenneth L. Pike, ", h.Em("Rhetoric: Discovery and Change"), " (1970)."),
			)
		},
	}
}
