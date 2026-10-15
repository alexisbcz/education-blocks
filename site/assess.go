package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	nativeselect "github.com/alexisbcz/components/ui/native-select"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AssessBlocks lists the exercise formats of the platform: components a
// course author drops into a lesson. They share one shell (format badge,
// status, feedback region, check / hint / answer / try again footer) and
// one checking engine (static/js/assess-expr.js). Correct and selected
// states use the brand pink, wrong ones the deletion red.
func AssessBlocks() []Block {
	return []Block{
		assessNumericBlock(),
		assessExpressionBlock(),
		assessParsonsBlock(),
		assessProofBlock(),
		assessClozeBlock(),
		assessSelectBlock(),
		assessSketchBlock(),
		assessHotspotBlock(),
		assessFadingBlock(),
		assessLadderBlock(),
		assessBKTBlock(),
		assessConfidenceBlock(),
	}
}

// assessInputClass is the shadcn input, at 16px on phones (no iOS zoom).
// A right answer keeps the focus-ring look in brand pink; a wrong one turns red.
const assessInputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 " +
	"data-[state=right]:border-brand data-[state=right]:ring-[3px] data-[state=right]:ring-brand/20 data-[state=wrong]:border-del data-[state=wrong]:ring-[3px] data-[state=wrong]:ring-del/15"

// assessAct is one footer button; the module wires them by name.
func assessAct(act string) h.Node {
	icon, label := map[string]h.Node{
		"hint":   hugeicons.BulbIcon(),
		"reveal": hugeicons.ViewIcon(),
		"retry":  hugeicons.RefreshIcon(),
		"check":  hugeicons.CheckListIcon(),
	}[act], map[string]string{"hint": "Hint", "reveal": "Show answer", "retry": "Try again", "check": "Check"}[act]
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("assess-act", act), icon, label)
}

// assessShell is the frame every exercise shares. kind names the format in
// the badge; help is the line at the bottom left (keyboard hints).
func assessShell(attr, kind string, help h.Node, acts []string, children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-5"), h.Data(attr, ""), h.Data("assess", ""),
		h.Div(h.Class("flex items-center gap-2"),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), kind),
			h.Span(h.Data("assess-status", ""), h.Class("ml-auto font-mono text-xs text-muted-foreground tabular-nums")),
		),
	}, append(children,
		h.Div(h.Data("assess-feedback", ""), h.Aria("live", "polite"), h.Class("empty:hidden")),
		h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
			h.P(h.Class("text-xs text-muted-foreground"), help),
			h.Div(h.Class("flex flex-wrap gap-2"), h.Map(acts, assessAct)),
		),
	)...)...)
}

// assessPrompt is the question itself.
func assessPrompt(children ...any) h.Node {
	return h.Div(append([]any{h.Class("text-base leading-relaxed font-medium text-pretty")}, children...)...)
}

// assessHints is the hidden list the Hint button reveals one at a time.
func assessHints(hints ...h.Node) h.Node {
	return h.Ol(h.Data("assess-hints", ""), h.Class("flex flex-col gap-2 empty:hidden"),
		h.MapIdx(hints, func(i int, s h.Node) h.Node {
			return h.Li(h.Data("assess-hint", fmt.Sprint(i)), h.Hidden(),
				h.Class("enter flex gap-3 rounded-lg border border-dashed bg-background p-3 text-sm leading-relaxed"),
				h.Span(h.Class("flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground"), fmt.Sprint(i+1)),
				h.Div(h.Class("text-muted-foreground [&_math]:text-foreground"), s),
			)
		}),
	)
}

// assessNote is a small print line under a block: the rule an author set.
func assessNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

func assessKbd(keys ...string) h.Node {
	return h.Span(h.Class("inline-flex gap-0.5 align-middle"), h.Map(keys, func(k string) h.Node { return kbd.Kbd(k) }))
}

// ---------------------------------------------------------------- A1

func assessNumericBlock() Block {
	return Block{
		Slug:        "numeric-units",
		Title:       "Numeric answer with units",
		Description: "A number is only an answer with its unit. Any unit of the right kind is accepted (m/s, km/h, ft/s, m·s⁻¹), converted, and compared within a tolerance; the significant figures are checked separately, and common slips get their own feedback. New variant draws another height from a seed.",
		Tags:        []string{"tolerance", "units", "variants"},
		Render: func() h.Node {
			return assessShell("assess-numeric", "Numeric · units",
				h.Group("Type a number and a unit, then ", assessKbd("Enter"), "."),
				[]string{"hint", "reveal", "retry", "check"},
				assessPrompt("A stone is dropped from rest from a height of ",
					h.Span(h.Data("assess-h", ""), h.Class("tabular-nums"), "20"), " m. How fast is it moving when it hits the ground? Ignore air resistance and take ",
					mathml(mi("g"), mo("="), mn("9.81"), mtext(" m/s"), msup(mrow(), mn("2"))), "."),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex items-center gap-2"),
						h.Label(h.For("assess-numeric-in"), h.Class("sr-only"), "Your answer"),
						h.Input(h.ID("assess-numeric-in"), h.Type("text"), h.Data("assess-input", ""), h.Placeholder("e.g. 12.3 m/s"),
							h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Aria("describedby", "assess-numeric-read"),
							h.Class(assessInputClass+" max-w-64")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("assess-variant", ""), hugeicons.DiceIcon(), "New variant"),
					),
					h.P(h.ID("assess-numeric-read"), h.Data("assess-read", ""), h.Class("min-h-4 font-mono text-xs text-muted-foreground"), "Reads as: —"),
				),
				assessHints(
					h.Span("Energy is conserved: the potential energy ", mathml(mi("m"), mi("g"), mi("h")), " becomes kinetic energy ", mathml(mfrac(mn("1"), mn("2")), mi("m"), msup(mi("v"), mn("2"))), "."),
					h.Span("The mass cancels, leaving ", mathml(mi("v"), mo("="), h.El("msqrt", mn("2"), mi("g"), mi("h"))), "."),
					h.Span("Here ", mathml(mi("v"), mo("="), h.El("msqrt", mn("2"), mo("×"), mn("9.81"), mo("×"), h.El("mn", h.Data("assess-h", ""), "20"))), " m/s. Round to 3 significant figures."),
				),
				h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-dashed p-3 font-mono text-[11px]"),
					h.Dt(h.Class("text-muted-foreground"), "variant"), h.Dd(h.Data("assess-seed", ""), h.Class("tabular-nums"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "tolerance"), h.Dd("±1% of the exact value"),
					h.Dt(h.Class("text-muted-foreground"), "precision"), h.Dd("2 to 4 significant figures"),
					h.Dt(h.Class("text-muted-foreground"), "units"), h.Dd("any speed: m/s, km/h, cm/s, ft/s, mph, m·s⁻¹"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func assessExpressionBlock() Block {
	return Block{
		Slug:        "expression",
		Title:       "Symbolic answer",
		Description: "The learner types a formula; a small parser (never eval) reads it, renders it as MathML while they type, and compares it with the answer at a dozen random points. The author picks the rule: equal everywhere, equal and factored, or equal up to a constant.",
		Tags:        []string{"Pratt parser", "MathML", "random points"},
		Render: func() h.Node {
			return assessShell("assess-expr", "Expression",
				h.Group("Write ", h.Code(h.Class("font-mono"), "x^2"), ", ", h.Code(h.Class("font-mono"), "2x"), ", ", h.Code(h.Class("font-mono"), "e^x"), ", ", h.Code(h.Class("font-mono"), "sin(x)"), "."),
				[]string{"hint", "reveal", "retry", "check"},
				segs("Question", [2]string{"derivative", "Derivative"}, [2]string{"simplify", "Simplify"}, [2]string{"factor", "Factor"}, [2]string{"integral", "Antiderivative"}),
				assessPrompt(h.Data("assess-q", ""), "Differentiate ", mathml(mi("f"), mo("("), mi("x"), mo(")"), mo("="), msup(mi("x"), mn("2")), msup(mi("e"), mi("x"))), "."),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex items-center gap-2"),
						h.Label(h.For("assess-expr-in"), h.Data("assess-lhs", ""), h.Class("shrink-0 font-serif text-base italic"), "f′(x) ="),
						h.Input(h.ID("assess-expr-in"), h.Type("text"), h.Data("assess-input", ""), h.Placeholder("type an expression"),
							h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Attr("autocapitalize", "off"), h.Aria("describedby", "assess-expr-preview"),
							h.Class(assessInputClass)),
					),
					h.Div(h.ID("assess-expr-preview"), h.Data("assess-preview", ""), h.Class("flex min-h-12 items-center justify-center rounded-lg border bg-code px-3 py-2 text-lg"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Preview")),
				),
				assessHints(h.Span(h.Data("assess-hint-text", ""), "")),
				h.Div(h.Data("assess-points", ""), h.Hidden(), h.Class("overflow-x-auto")),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

type assessLine struct {
	id, code string
	indent   int
}

// The pool, in the order the learner first sees it: the program shuffled,
// with two distractors that look right.
var assessParsonsPool = []assessLine{
	{"d1", "x = (x - a / x) / 2", 2},
	{"l5", "return x", 1},
	{"l3", "while abs(x * x - a) > tol:", 1},
	{"l1", "def newton_sqrt(a, tol=1e-10):", 0},
	{"d2", "while abs(x * x - a) < tol:", 1},
	{"l4", "x = (x + a / x) / 2", 2},
	{"l2", "x = a", 1},
}

func assessParsonsBlock() Block {
	return Block{
		Slug:        "parsons",
		Title:       "Parsons problem",
		Description: "Rebuild a program from its shuffled lines, indentation included, with two distractors that look almost right. It checks understanding of the algorithm without the friction of typing it. Drag with a pointer, or use the keyboard: every move is a key.",
		Tags:        []string{"reorder", "indentation", "distractors"},
		Wide:        true,
		Render: func() h.Node {
			list := func(name, label string, items []assessLine) h.Node {
				return h.Div(h.Class("flex min-w-0 flex-col gap-2"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), label),
					h.Ol(h.Data("assess-list", name), h.Aria("label", label),
						h.Class("flex min-h-56 flex-col gap-1.5 rounded-lg border border-dashed bg-code p-2 data-[over]:border-ring"),
						h.Map(items, func(l assessLine) h.Node {
							return h.Li(h.Data("assess-line", l.id), h.Data("indent", "0"), h.TabIndex(0), h.Attr("draggable", "true"),
								h.Class("group flex cursor-grab items-center gap-2 rounded-md border bg-background py-1.5 pr-2 font-mono text-[13px] shadow-xs outline-none transition-[border-color,box-shadow,margin] duration-150 ease-[var(--ease-out)] select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[dragging]:opacity-40 "+
									"data-[state=right]:border-brand data-[state=right]:bg-brand/8 data-[state=wrong]:border-del data-[state=wrong]:bg-del/8 data-[state=indent]:border-del data-[state=indent]:border-dashed"),
								hugeicons.DragDropVerticalIcon(h.Class("ml-1 size-3.5 shrink-0 text-muted-foreground/60")),
								h.Span(h.Data("assess-code", ""), h.Class("min-w-0 whitespace-pre"), highlightLine(l.code)),
							)
						}),
					),
				)
			}
			return assessShell("assess-parsons", "Parsons",
				h.Group(assessKbd("Space"), " moves a line across, ", assessKbd("Alt", "↑"), assessKbd("Alt", "↓"), " reorders, ", assessKbd("←"), assessKbd("→"), " indents."),
				[]string{"hint", "reveal", "retry", "check"},
				assessPrompt("Build ", h.Code(h.Class("font-mono text-[0.9em]"), "newton_sqrt(a)"), ": start from x = a and replace x by the average of x and a/x until x² is within tol of a."),
				h.Div(h.Class("grid gap-4 md:grid-cols-2"),
					list("pool", "Lines", assessParsonsPool),
					list("answer", "Your program", nil),
				),
				assessHints(
					h.Span("A Python function starts with its ", h.Code("def"), " line and ends with ", h.Code("return"), "; everything between is indented once."),
					h.Span("The loop runs while the error is still too ", h.Em("large"), ". Newton's update for x² = a averages x and a/x: it moves toward √a from either side."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

var assessProofSteps = []struct{ id, text string }{
	{"c", "So p² is even, and therefore p is even: write p = 2k."},
	{"a", "Suppose √2 = p/q, where p and q are integers with no common factor and q ≠ 0."},
	{"e", "Then p and q are both even, so they share the factor 2."},
	{"b", "Squaring and multiplying by q² gives p² = 2q²."},
	{"d", "Substituting, 4k² = 2q², so q² = 2k² and q is even too."},
}

var assessProofReasons = []string{
	"Assumption, for contradiction",
	"Algebra on the previous line",
	"An odd number squared is odd",
	"Same argument as for p",
	"Contradicts the assumption",
	"Definition of a prime number",
}

func assessProofBlock() Block {
	return Block{
		Slug:        "proof-order",
		Title:       "Order the proof",
		Description: "A proof is an order and a reason for each step. Put the steps of the classic proof that √2 is irrational in order and justify each one; the order and the reasons are marked separately, so a right order with a wrong reason still shows where the gap is.",
		Tags:        []string{"reorder", "justification", "proof"},
		Render: func() h.Node {
			return assessShell("assess-proof", "Proof",
				h.Group("Reorder: arrows, or ", assessKbd("Alt", "↑"), assessKbd("Alt", "↓"), "."),
				[]string{"hint", "reveal", "retry", "check"},
				assessPrompt("Prove that √2 is irrational."),
				h.Ol(h.Data("assess-steps", ""), h.Class("flex flex-col gap-2"),
					h.MapIdx(assessProofSteps, func(i int, s struct{ id, text string }) h.Node {
						return h.Li(h.Data("assess-step", s.id), h.TabIndex(0), h.Aria("label", s.text),
							h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs outline-none transition-[border-color,box-shadow,translate] duration-200 ease-[var(--ease-out)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-brand data-[state=right]:bg-brand/5 data-[state=wrong]:border-del data-[state=wrong]:bg-del/5 sm:flex-row sm:items-center"),
							h.Div(h.Class("flex min-w-0 flex-1 items-start gap-3"),
								h.Span(h.Data("assess-n", ""), h.Class("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground tabular-nums"), fmt.Sprint(i+1)),
								h.P(h.Class("text-sm leading-relaxed text-pretty"), s.text),
							),
							h.Div(h.Class("flex shrink-0 items-center gap-1.5 pl-8 sm:pl-0"),
								nativeselect.NativeSelect(nativeselect.SizeSm, h.Data("assess-reason", ""), h.Aria("label", "Reason for this step"), h.Class("w-40 text-xs sm:w-52 data-[state=right]:border-brand data-[state=wrong]:border-del"),
									nativeselect.Option(h.Value(""), "Reason…"),
									h.Map(assessProofReasons, func(r string) h.Node { return nativeselect.Option(h.Value(r), r) }),
								),
								button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("assess-move", "-1"), h.Aria("label", "Move up"), hugeicons.ArrowUp01Icon()),
								button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("assess-move", "1"), h.Aria("label", "Move down"), hugeicons.ArrowDown01Icon()),
							),
						)
					}),
				),
				assessHints(
					h.Span("A proof by contradiction starts by assuming the opposite of what it proves."),
					h.Span("The argument that makes p even is reused for q: once both are even, the \"no common factor\" assumption fails."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

// assessClozeCode is the program with ¶n marking blank n.
var assessClozeCode = []string{
	"def euler(f, y0, t0, t1, n):",
	"    h = (t1 - t0) / ¶0",
	"    t, y = t0, y0",
	"    for _ in range(¶1):",
	"        y = y + h * ¶2",
	"        t = ¶3",
	"    return y",
}

var assessClozeWidth = []int{5, 5, 11, 7}

func assessClozeBlock() Block {
	return Block{
		Slug:        "cloze-code",
		Title:       "Fill in the code",
		Description: "Blanks inside real code. Each blank accepts several spellings (spaces never matter), is marked on its own, and has feedback written for the likely wrong answers — here, the implicit Euler step and the off-by-one range.",
		Tags:        []string{"cloze", "per-blank", "misconceptions"},
		Render: func() h.Node {
			blank := 0
			line := func(src string) h.Node {
				var parts []any
				rest := src
				for {
					i := strings.Index(rest, "¶")
					if i < 0 {
						parts = append(parts, highlightLine(rest))
						break
					}
					parts = append(parts, highlightLine(rest[:i]))
					n := int(rest[i+len("¶")] - '0')
					parts = append(parts, h.Input(h.Type("text"), h.Data("assess-blank", fmt.Sprint(n)), h.Aria("label", fmt.Sprintf("Blank %d", n+1)),
						h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Attr("autocapitalize", "off"),
						h.Style(fmt.Sprintf("width:%dch", assessClozeWidth[n]+2)),
						h.Class("mx-0.5 inline-block h-6 rounded-[5px] border border-input bg-background px-1 align-baseline font-mono text-[13px] outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-brand data-[state=right]:text-brand data-[state=wrong]:border-del data-[state=wrong]:text-del")))
					blank++
					rest = rest[i+len("¶")+1:]
				}
				return h.Div(h.Class("min-h-7 whitespace-pre"), parts)
			}
			return assessShell("assess-cloze", "Cloze · code",
				h.Group(assessKbd("Tab"), " moves to the next blank."),
				[]string{"hint", "reveal", "retry", "check"},
				assessPrompt("Complete Euler's method for ", mathml(mi("y′"), mo("="), mi("f"), mo("("), mi("t"), mo(","), mi("y"), mo(")")), ", taking n equal steps from t0 to t1."),
				h.Div(h.Class("overflow-x-auto rounded-lg border bg-code p-3 font-mono text-[13px] leading-7"), h.Map(assessClozeCode, line)),
				h.Ul(h.Data("assess-blank-notes", ""), h.Class("flex flex-col gap-1.5 text-sm empty:hidden")),
				assessHints(
					h.Span("The step size h splits the interval [t0, t1] into n equal pieces, and the loop takes one step per piece."),
					h.Span("Explicit Euler uses the slope at the start of the step: the current t and y."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

var assessSelectItems = []struct {
	m       [][]string
	correct bool
	why     string
}{
	{[][]string{{"2", "1"}, {"4", "2"}}, false, "det = 2·2 − 1·4 = 0: the second row is twice the first."},
	{[][]string{{"1", "2"}, {"3", "4"}}, true, "det = 4 − 6 = −2 ≠ 0."},
	{[][]string{{"0", "1"}, {"1", "0"}}, true, "A swap of the axes: det = −1, and it is its own inverse."},
	{[][]string{{"3", "0"}, {"0", "0"}}, false, "A zero row: everything lands on the x-axis, det = 0."},
	{[][]string{{"1", "−1"}, {"1", "1"}}, true, "det = 1 + 1 = 2: a rotation by 45° scaled by √2."},
	{[][]string{{"−2", "4"}, {"1", "−2"}}, false, "det = 4 − 4 = 0: the columns are parallel."},
}

func assessSelectBlock() Block {
	return Block{
		Slug:        "select-all",
		Title:       "Select all that apply",
		Description: "Several right answers, and a scoring rule the author chooses and the learner can see. All-or-nothing is harsh, per-option rewards leaving wrong boxes empty, right-minus-wrong discourages ticking everything. The three scores are shown side by side for the same answer.",
		Tags:        []string{"multiple response", "partial credit", "scoring"},
		Render: func() h.Node {
			return assessShell("assess-select", "Multiple response",
				h.Group(assessKbd("Space"), " ticks the focused card."),
				[]string{"retry", "check"},
				assessPrompt("Which of these matrices are invertible? Select all that apply."),
				h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-3"), h.Role("group"), h.Aria("label", "Matrices"),
					h.MapIdx(assessSelectItems, func(i int, it struct {
						m       [][]string
						correct bool
						why     string
					}) h.Node {
						id := fmt.Sprintf("assess-select-%d", i)
						return h.Label(h.For(id), h.Data("assess-option", fmt.Sprint(i)), h.Data("correct", fmt.Sprint(it.correct)), h.Data("why", it.why),
							h.Class("group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-background px-3 pt-3 pb-4 shadow-xs transition-[border-color,box-shadow,background-color] duration-150 ease-[var(--ease-out)] hover:bg-accent/40 "+
								"has-checked:border-ring has-checked:ring-[3px] has-checked:ring-ring/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 "+
								"data-[state=right]:!border-brand data-[state=right]:!ring-brand/25 data-[state=wrong]:!border-del data-[state=wrong]:!ring-del/25 data-[state=missed]:!border-del data-[state=missed]:border-dashed"),
							h.Input(h.Type("checkbox"), h.ID(id), h.Class("peer sr-only")),
							h.Span(h.Class("flex w-full items-center justify-between"),
								h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), string(rune('A'+i))),
								h.Span(h.Aria("hidden", "true"), h.Class("flex size-4 items-center justify-center rounded-[4px] border border-input shadow-xs transition-[border-color,background-color] duration-150 group-has-checked:border-brand group-has-checked:bg-brand"),
									hugeicons.Tick02Icon(h.Class("size-3 scale-50 text-white opacity-0 transition-[opacity,scale] duration-150 ease-[var(--ease-out)] group-has-checked:scale-100 group-has-checked:opacity-100"))),
							),
							htmlMatrix(it.m, "text-sm"),
							h.Span(h.Data("assess-why", ""), h.Hidden(), h.Class("text-center text-xs leading-snug text-muted-foreground")),
						)
					}),
				),
				h.Div(h.Class("flex flex-col gap-2 rounded-lg border border-dashed p-3"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
						panelLabel("Scoring rule"),
						segs("Scoring rule", [2]string{"right-wrong", "Right minus wrong"}, [2]string{"per-option", "Per option"}, [2]string{"all", "All or nothing"}),
					),
					h.Dl(h.Class("grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-1 font-mono text-xs"),
						h.Map([][3]string{
							{"right-wrong", "Right minus wrong", "+1/3 per right tick, −1/3 per wrong one, not below 0"},
							{"per-option", "Per option", "1/6 for each box in the right state"},
							{"all", "All or nothing", "1 only if every box is right"},
						}, func(r [3]string) h.Node {
							return h.Group(
								h.Dt(h.Data("assess-rule", r[0]), h.Class("text-muted-foreground data-[on]:text-foreground"), r[1]),
								h.Dd(h.Class("font-sans text-muted-foreground"), r[2]),
								h.Dd(h.Data("assess-score", r[0]), h.Class("text-right tabular-nums"), "—"),
							)
						}),
					),
				),
			)
		},
	}
}
