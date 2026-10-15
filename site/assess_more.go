package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- A7

func assessSketchBlock() Block {
	return Block{
		Slug:        "sketch-graph",
		Title:       "Sketch the graph",
		Description: "The answer is a shape. Draw the derivative straight onto the axes, or move its eleven points with the keyboard; the sketch is scored by how much of it stays inside a tolerance band around the true curve, and the feedback names the features that are off: zeros, sign, the minimum.",
		Tags:        []string{"drawing", "tolerance band", "features"},
		Wide:        true,
		Render: func() h.Node {
			return assessShell("assess-sketch", "Sketch",
				h.Group("Draw with a pointer, or focus a point and use ", assessKbd("↑"), assessKbd("↓"), " (", assessKbd("Shift"), " for big steps)."),
				[]string{"hint", "reveal", "retry", "check"},
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					assessPrompt("Here is ", mathml(mi("f"), mo("("), mi("x"), mo(")"), mo("="), msup(mi("x"), mn("3")), mo("−"), mn("3"), mi("x")), ". Sketch its derivative ", mathml(mi("f′"), mo("("), mi("x"), mo(")")), "."),
					h.Div(h.Class("w-48"), toggle("assess-sketch-f", "f", "Show f", true)),
				),
				h.Div(h.Class("relative rounded-lg border bg-code p-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 310"), h.Class("block w-full touch-none select-none"), h.Role("group"), h.Aria("label", "Axes for your sketch of f′. Eleven points, from x = −2.5 to 2.5.")),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"),
					legendSwatch("var(--brand)", "your sketch"),
					legendSwatch("var(--muted-foreground)", "f, for reference"),
					h.Span(h.Data("assess-band-key", ""), h.Hidden(), legendSwatch("var(--foreground)", "f′ with its ±1.5 band")),
				),
				assessHints(
					h.Span("Where f has a peak or a valley, its slope is 0: f′ crosses zero there. f turns at x = −1 and x = 1."),
					h.Span("Between the turns f goes down, so f′ is negative; outside them f rises steeper and steeper. f′ is a parabola: ", mathml(mi("f′"), mo("("), mi("x"), mo(")"), mo("="), mn("3"), msup(mi("x"), mn("2")), mo("−"), mn("3")), "."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func assessHotspotBlock() Block {
	return Block{
		Slug:        "hotspot",
		Title:       "Click on the figure",
		Description: "The answer is a place in a picture. Five vectors are drawn; the learner picks every one that the matrix only stretches. Each vector is a focusable target, so the format works with a keyboard and a screen reader too, and a wrong pick is answered with where A actually sends it.",
		Tags:        []string{"hotspot", "SVG targets", "eigenvectors"},
		Render: func() h.Node {
			return assessShell("assess-hotspot", "Hotspot",
				h.Group(assessKbd("Tab"), " to a vector, ", assessKbd("Space"), " to pick it."),
				[]string{"hint", "reveal", "retry", "check"},
				assessPrompt("Pick every vector that ", mathml(mi("A"), mo("=")), " ", htmlMatrix([][]string{{"2", "1"}, {"1", "2"}}, "text-sm align-middle"), " only stretches (or shrinks): its eigenvectors."),
				h.Div(h.Class("mx-auto w-full max-w-sm rounded-lg border bg-code p-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("-3.6 -3.6 7.2 7.2"), h.Class("block w-full select-none"), h.Role("group"), h.Aria("label", "Five vectors from the origin")),
				),
				h.P(h.Data("assess-picked", ""), h.Class("text-center font-mono text-xs text-muted-foreground"), "Picked: none"),
				assessHints(h.Span("An eigenvector keeps its direction: A·v is a multiple of v. The hint draws A·v next to each vector, dashed.")),
			)
		},
	}
}

// ---------------------------------------------------------------- A9

type assessFadeStep struct{ label, expr string }

var assessFadeProblems = []struct {
	f     string
	steps []assessFadeStep
	blank int // the last `blank` steps are left to the learner
}{
	{"(2x+1)^3", []assessFadeStep{{"Inner function u", "2x+1"}, {"Outer derivative, at u", "3(2x+1)^2"}, {"Inner derivative u′", "2"}, {"Multiply", "6(2x+1)^2"}}, 0},
	{"(5x-2)^4", []assessFadeStep{{"Inner function u", "5x-2"}, {"Outer derivative, at u", "4(5x-2)^3"}, {"Inner derivative u′", "5"}, {"Multiply", "20(5x-2)^3"}}, 1},
	{"(x^2+1)^3", []assessFadeStep{{"Inner function u", "x^2+1"}, {"Outer derivative, at u", "3(x^2+1)^2"}, {"Inner derivative u′", "2x"}, {"Multiply", "6x(x^2+1)^2"}}, 2},
	{"(3-x^2)^5", []assessFadeStep{{"Inner function u", "3-x^2"}, {"Outer derivative, at u", "5(3-x^2)^4"}, {"Inner derivative u′", "-2x"}, {"Multiply", "-10x(3-x^2)^4"}}, 4},
}

func assessFadingBlock() Block {
	return Block{
		Slug:        "faded-examples",
		Title:       "Worked examples that fade",
		Description: "The first example is fully worked; each next one leaves one more step to the learner, until the last is theirs alone. Studying worked examples and then fading them helps novices more than solving problems from the start (Renkl & Atkinson, 2003). Every blank is checked by the expression engine, so any equivalent form counts.",
		Tags:        []string{"fading", "chain rule", "scaffolding"},
		Wide:        true,
		Render: func() h.Node {
			return assessShell("assess-fade", "Faded examples",
				h.Group("Type expressions in x; ", assessKbd("Enter"), " checks the current example."),
				[]string{"hint", "reveal", "retry", "check"},
				assessPrompt("Differentiate with the chain rule: ", mathml(mfrac(mi("d"), mrow(mi("d"), mi("x"))), mi("g"), mo("("), mi("u"), mo("("), mi("x"), mo(")"), mo(")"), mo("="), mi("g′"), mo("("), mi("u"), mo(")"), mo("·"), mi("u′")), "."),
				h.Div(h.Class("grid gap-3 lg:grid-cols-4 sm:grid-cols-2"),
					h.MapIdx(assessFadeProblems, func(p int, pr struct {
						f     string
						steps []assessFadeStep
						blank int
					}) h.Node {
						return h.Div(h.Data("assess-problem", fmt.Sprint(p)), h.Data("open", fmt.Sprint(p <= 1)),
							h.Class("flex flex-col gap-3 rounded-lg border bg-background p-3 transition-[opacity,border-color] duration-200 ease-[var(--ease-out)] data-[open=false]:opacity-45 data-[done]:border-brand"),
							h.Div(h.Class("flex items-center justify-between gap-2"),
								h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), fmt.Sprintf("Example %d · %s", p+1, []string{"worked", "1 step to you", "2 steps to you", "all yours"}[p])),
								hugeicons.CheckmarkCircle02Icon(h.Data("assess-done", ""), h.Class("size-4 text-brand opacity-0 transition-opacity duration-200 [[data-done]_&]:opacity-100")),
							),
							h.Div(h.Class("text-center text-base"), h.Span(h.Data("assess-tex", "d/dx "+pr.f), h.Class("font-mono text-sm"), "d/dx "+pr.f)),
							h.Ol(h.Class("flex flex-col gap-2"),
								h.MapIdx(pr.steps, func(i int, s assessFadeStep) h.Node {
									given := i < len(pr.steps)-pr.blank
									return h.Li(h.Class("flex flex-col gap-1"),
										h.Span(h.Class("text-xs text-muted-foreground"), s.label),
										h.Iff(given, func() h.Node {
											return h.Span(h.Data("assess-tex", s.expr), h.Class("flex min-h-9 items-center rounded-md bg-code px-2 font-mono text-sm"), s.expr)
										}),
										h.Iff(!given, func() h.Node {
											return h.Input(h.Type("text"), h.Data("assess-fill", s.expr), h.Aria("label", fmt.Sprintf("Example %d, %s", p+1, s.label)),
												h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Attr("autocapitalize", "off"),
												h.If(p > 1, h.Disabled()), h.Class(assessInputClass+" h-9 disabled:opacity-100"))
										}),
									)
								}),
							),
						)
					}),
				),
				assessHints(h.Span("Work from the outside in: the outer function is a power ", mathml(msup(mi("u"), mi("n"))), ", whose derivative is ", mathml(mi("n"), msup(mi("u"), mrow(mi("n"), mo("−"), mn("1")))), "; then multiply by the derivative of what is inside the brackets.")),
			)
		},
	}
}

// ---------------------------------------------------------------- A10

func assessLadderBlock() Block {
	return Block{
		Slug:        "hint-ladder",
		Title:       "Hints that cost points",
		Description: "Help is always there, but it is priced: each rung lowers the most the learner can still earn, and the last rung is a bottom-out hint that gives the answer away and leaves only the credit for typing it. The price of the next hint is shown before it is taken.",
		Tags:        []string{"hint ladder", "scoring", "bottom-out"},
		Render: func() h.Node {
			return assessShell("assess-ladder", "Numeric · hints",
				h.Group("A wrong check costs 1 point; ", assessKbd("Enter"), " checks."),
				[]string{"hint", "retry", "check"},
				assessPrompt("Solve ", mathml(msup(mn("2"), mi("x")), mo("="), mn("10")), ". Give x to 3 decimal places."),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					h.Label(h.For("assess-ladder-in"), h.Class("font-serif text-base italic"), "x ="),
					h.Input(h.ID("assess-ladder-in"), h.Type("text"), h.Data("assess-input", ""), h.Attr("inputmode", "decimal"), h.Placeholder("0.000"),
						h.Attr("autocomplete", "off"), h.Class(assessInputClass+" max-w-36")),
				),
				h.Div(h.Class("flex flex-col gap-2 rounded-lg border border-dashed p-3"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						panelLabel("Points still available"),
						h.Span(h.Data("assess-points-left", ""), h.Class("font-mono text-sm tabular-nums"), "10 / 10"),
					),
					h.Div(h.Data("assess-meter", ""), h.Class("grid grid-cols-10 gap-1"), h.Aria("hidden", "true"),
						h.Range(10, func(i int) h.Node {
							return h.Span(h.Class("h-2 rounded-full bg-brand transition-[opacity,background-color] duration-300 ease-[var(--ease-out)] data-[spent]:bg-muted-foreground/25"))
						}),
					),
					h.P(h.Data("assess-next-cost", ""), h.Class("text-xs text-muted-foreground"), "Next hint: −2 points."),
				),
				h.Ol(h.Data("assess-hints", ""), h.Class("flex flex-col gap-2 empty:hidden"),
					h.MapIdx([]struct {
						cost int
						body h.Node
					}{
						{2, h.Span("Take a logarithm of both sides: the unknown is in the exponent.")},
						{3, h.Span(mathml(mi("x"), mo("·"), mi("ln"), mo("⁡"), mn("2"), mo("="), mi("ln"), mo("⁡"), mn("10")), ", so ", mathml(mi("x"), mo("="), mfrac(mrow(mi("ln"), mo("⁡"), mn("10")), mrow(mi("ln"), mo("⁡"), mn("2")))), ".")},
						{5, h.Span("Bottom-out hint: ", mathml(mi("x"), mo("="), mfrac(mn("2.302585"), mn("0.693147")), mo("="), mn("3.32193…")), ", which is 3.322 to 3 decimals. Type it to finish.")},
					}, func(i int, hnt struct {
						cost int
						body h.Node
					}) h.Node {
						return h.Li(h.Data("assess-hint", fmt.Sprint(i)), h.Data("cost", fmt.Sprint(hnt.cost)), h.Hidden(),
							h.Class("enter flex gap-3 rounded-lg border border-dashed bg-background p-3 text-sm leading-relaxed"),
							h.Span(h.Class("flex h-5 shrink-0 items-center justify-center rounded-full border px-1.5 font-mono text-[10px] text-muted-foreground"), fmt.Sprintf("−%d", hnt.cost)),
							h.Div(h.Class("text-muted-foreground [&_math]:text-foreground"), hnt.body),
						)
					}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A11

func assessBKTBlock() Block {
	return Block{
		Slug:        "mastery-bkt",
		Title:       "Mastery from answers (BKT)",
		Description: "Bayesian Knowledge Tracing (Corbett & Anderson, 1995) turns a stream of right and wrong answers into the probability that a skill is learned. Each answer updates the belief by Bayes' rule, allowing for lucky guesses and careless slips, then adds the chance of learning from the practice. Answer the drill or log answers directly; the parameters are editable.",
		Tags:        []string{"Bayes", "mastery", "learner model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("assess-bkt",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Probability the skill is learned after each answer")),
					h.Div(h.Class("flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center"),
						h.Div(h.Class("flex items-center gap-2"),
							h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Drill"),
							h.Label(h.For("assess-bkt-in"), h.Data("assess-bkt-q", ""), h.Class("font-mono text-base whitespace-nowrap tabular-nums"), "7 × 8 ="),
							h.Input(h.ID("assess-bkt-in"), h.Type("text"), h.Attr("inputmode", "numeric"), h.Data("assess-input", ""), h.Attr("autocomplete", "off"), h.Class(assessInputClass+" max-w-20")),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("assess-bkt-act", "answer"), "Answer"),
						),
						h.P(h.Data("assess-bkt-said", ""), h.Aria("live", "polite"), h.Class("min-h-4 text-xs text-muted-foreground sm:ml-auto")),
					),
					h.Div(h.Class("flex flex-col gap-1 text-sm [&_math]:text-[0.95em]"),
						h.P(h.Class("text-muted-foreground"), "After a right answer, then after a wrong one, then the learning step:"),
						h.Div(h.Class("flex flex-col gap-2 overflow-x-auto py-1"),
							mathBlock(msub(mi("P"), mtext("right")), mo("="), mfrac(mrow(mi("L"), mo("("), mn("1"), mo("−"), mi("S"), mo(")")), mrow(mi("L"), mo("("), mn("1"), mo("−"), mi("S"), mo(")"), mo("+"), mo("("), mn("1"), mo("−"), mi("L"), mo(")"), mi("G")))),
							mathBlock(msub(mi("P"), mtext("wrong")), mo("="), mfrac(mrow(mi("L"), mi("S")), mrow(mi("L"), mi("S"), mo("+"), mo("("), mn("1"), mo("−"), mi("L"), mo(")"), mo("("), mn("1"), mo("−"), mi("G"), mo(")")))),
							mathBlock(mi("L′"), mo("="), mi("P"), mo("+"), mo("("), mn("1"), mo("−"), mi("P"), mo(")"), mi("T")),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("L0", "P(L₀) prior", "", 0.2, 0, 1, 0.01),
					field("T", "P(T) learn", "", 0.15, 0, 1, 0.01),
					field("G", "P(G) guess", "", 0.2, 0, 0.5, 0.01),
					field("S", "P(S) slip", "", 0.1, 0, 0.5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Log an answer"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("assess-bkt-act", "right"), hugeicons.Tick02Icon(), "Right"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("assess-bkt-act", "wrong"), hugeicons.Cancel01Icon(), "Wrong"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("assess-bkt-act", "reset"), hugeicons.RefreshIcon(), "Reset"),
					),
					h.Div(h.Data("assess-bkt-seq", ""), h.Class("flex min-h-5 flex-wrap gap-1"), h.Aria("label", "Answers so far")),
				),
				readouts([2]string{"P(learned) now", "now"}, [2]string{"after Bayes, last", "post"}, [2]string{"answers", "n"}, [2]string{"mastery (≥ 0.95)", "mastery"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A12

var assessClaims = []struct {
	text  string
	truth bool
	why   string
}{
	{"The product of two invertible matrices is invertible.", true, "(AB)⁻¹ = B⁻¹A⁻¹."},
	{"det(A + B) = det A + det B for all square matrices.", false, "Take A = B = I₂: det(2I) = 4, but 1 + 1 = 2."},
	{"Every real symmetric matrix can be diagonalised.", true, "The spectral theorem: it even has an orthonormal basis of eigenvectors."},
	{"Every real square matrix has a real eigenvalue.", false, "A quarter-turn rotation of the plane has eigenvalues ±i."},
	{"A 3 × 3 matrix of rank 2 sends some nonzero vector to 0.", true, "Rank–nullity: the null space has dimension 3 − 2 = 1."},
}

func assessConfidenceBlock() Block {
	return Block{
		Slug:        "confidence",
		Title:       "Answer with confidence",
		Description: "True or false, plus how sure you are. The score is the Brier score, a proper scoring rule: reporting your honest confidence is the strategy that minimises your expected penalty, so neither bluffing nor hedging pays. It also shows whether your confidence matches your accuracy.",
		Tags:        []string{"Brier score", "calibration", "true/false"},
		Render: func() h.Node {
			return assessShell("assess-conf", "Confidence",
				h.Group("Pick True or False and set how sure you are."),
				[]string{"retry", "check"},
				assessPrompt("Five claims about matrices. For each: true or false, and your confidence from 50% (a guess) to 100% (certain)."),
				h.Ol(h.Class("flex flex-col gap-2"),
					h.MapIdx(assessClaims, func(i int, c struct {
						text  string
						truth bool
						why   string
					}) h.Node {
						name := fmt.Sprintf("assess-conf-%d", i)
						opt := func(v, label string) h.Node {
							return h.Label(h.Class("cursor-pointer rounded-md border bg-background px-2.5 py-1 text-xs shadow-xs transition-[border-color,box-shadow,background-color] duration-150 has-checked:border-ring has-checked:ring-[3px] has-checked:ring-ring/50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"),
								h.Input(h.Type("radio"), h.Name(name), h.Value(v), h.Class("sr-only")), label)
						}
						return h.Li(h.Data("assess-claim", fmt.Sprint(i)), h.Data("truth", fmt.Sprint(c.truth)), h.Data("why", c.why),
							h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3 transition-[border-color] duration-150 data-[state=right]:border-brand data-[state=wrong]:border-del"),
							h.Div(h.Class("flex items-start gap-3"),
								h.Span(h.Data("assess-claim-n", ""), h.Class("mt-0.5 font-mono text-[11px] text-muted-foreground"), fmt.Sprint(i+1)),
								h.P(h.Class("flex-1 text-sm leading-relaxed text-pretty"), c.text),
							),
							h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-2 pl-6"),
								h.Div(h.Role("radiogroup"), h.Aria("label", fmt.Sprintf("Claim %d: true or false", i+1)), h.Class("flex gap-1.5"), opt("true", "True"), opt("false", "False")),
								h.Label(h.Class("flex flex-1 items-center gap-2 text-xs text-muted-foreground"),
									h.Span("sure"),
									h.Input(h.Type("range"), h.Min("50"), h.Max("100"), h.Step("5"), h.Value("75"), h.Data("assess-conf-range", ""), h.Aria("label", fmt.Sprintf("Claim %d: confidence", i+1)),
										h.Class("h-1.5 min-w-24 flex-1 cursor-pointer accent-[var(--brand)]")),
									h.Span(h.Data("assess-conf-out", ""), h.Class("w-9 text-right font-mono text-foreground tabular-nums"), "75%"),
								),
								h.Span(h.Data("assess-brier", ""), h.Class("font-mono text-[11px] text-muted-foreground tabular-nums empty:hidden")),
							),
							h.P(h.Data("assess-why", ""), h.Hidden(), h.Class("pl-6 text-xs text-muted-foreground")),
						)
					}),
				),
				h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-dashed p-3 font-mono text-xs"),
					h.Dt(h.Class("text-muted-foreground"), "Brier score"), h.Dd(h.Data("out", "brier"), h.Class("tabular-nums"), "— (0 is perfect, 0.25 is always saying 50%)"),
					h.Dt(h.Class("text-muted-foreground"), "accuracy"), h.Dd(h.Data("out", "acc"), h.Class("tabular-nums"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "mean confidence"), h.Dd(h.Data("out", "conf"), h.Class("tabular-nums"), "—"),
				),
				assessNote("For a claim you call true with confidence c, you forecast p = c that it is true (1 − c if you call it false). The penalty is (p − outcome)², outcome 1 if true, 0 if false: a sure wrong answer costs 1, a 50% guess always 0.25."),
			)
		},
	}
}
