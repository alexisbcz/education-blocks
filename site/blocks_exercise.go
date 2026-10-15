package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- 12

func quizBlock() Block {
	return Block{
		Slug:        "quiz",
		Title:       "Multiple choice",
		Description: "Choices that are themselves mathematics. Each wrong answer has its own explanation, because a wrong answer is a specific misconception, not just a miss.",
		Tags:        []string{"radio cards", "feedback"},
		Render:      quiz,
	}
}

type choice struct {
	m       [][]string
	correct bool
	why     string
}

func quiz() h.Node {
	choices := []choice{
		{[][]string{{"0", "1"}, {"−1", "0"}}, false, "This sends î to (0, −1): a quarter turn clockwise."},
		{[][]string{{"0", "−1"}, {"1", "0"}}, true, "î lands on (0, 1) and ĵ on (−1, 0): the first column is î's image, the second ĵ's."},
		{[][]string{{"−1", "0"}, {"0", "−1"}}, false, "This sends every vector to its opposite: a half turn, 180°."},
		{[][]string{{"1", "0"}, {"0", "−1"}}, false, "This keeps î and flips ĵ: a reflection across the x-axis, not a rotation."},
	}
	return h.Form(h.Class("flex flex-col gap-5"), h.Data("quiz", ""), h.Action("#"),
		h.Div(h.Class("flex items-center gap-2"),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Question 2 of 5"),
			h.Span(h.Data("attempts", ""), h.Class("text-xs text-muted-foreground")),
		),
		h.Fieldset(h.Class("flex flex-col gap-4"),
			h.Legend(h.Class("mb-4 text-base font-medium text-pretty"), "Which matrix rotates the plane a quarter turn counterclockwise?"),
			h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-4"), h.Data("choices", ""),
				h.MapIdx(choices, func(i int, c choice) h.Node {
					id := fmt.Sprintf("quiz-%d", i)
					return h.Label(h.For(id), h.Data("choice", fmt.Sprint(i)), h.Data("correct", fmt.Sprint(c.correct)), h.Data("why", c.why),
						// Selected reads like a focused input: border-ring plus a 3px
						// ring at half strength. Checked answers swap in green or red.
						h.Class("group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-background px-3 pt-3 pb-4 shadow-xs transition-[border-color,box-shadow,background-color] duration-150 ease-[var(--ease-out)] hover:bg-accent/40 "+
							"has-checked:border-ring has-checked:ring-[3px] has-checked:ring-ring/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 "+
							"data-[state=right]:!border-add data-[state=right]:!ring-add/25 data-[state=wrong]:!border-del data-[state=wrong]:!ring-del/25"),
						h.Input(h.Type("radio"), h.Name("answer"), h.ID(id), h.Value(fmt.Sprint(i)), h.Class("peer sr-only")),
						h.Span(h.Class("flex w-full items-center justify-between"),
							h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), string(rune('A'+i))),
							// The radio itself, drawn like shadcn's RadioGroupItem.
							h.Span(h.Aria("hidden", "true"), h.Class("flex size-4 items-center justify-center rounded-full border border-input shadow-xs transition-[border-color] duration-150 group-has-checked:border-ring group-data-[state=right]:!border-add group-data-[state=wrong]:!border-del"),
								h.Span(h.Class("size-2 scale-50 rounded-full bg-foreground opacity-0 transition-[opacity,scale] duration-150 ease-[var(--ease-out)] group-has-checked:scale-100 group-has-checked:opacity-100 group-data-[state=right]:bg-add group-data-[state=wrong]:bg-del"))),
						),
						htmlMatrix(c.m, "text-sm"),
					)
				}),
			),
		),
		h.Div(h.Data("feedback", ""), h.Aria("live", "polite"), h.Class("empty:hidden")),
		h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
			h.P(h.Class("text-xs text-muted-foreground"), "Pick one, then check."),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), h.Disabled(), "Check answer"),
		),
	)
}

// ---------------------------------------------------------------- 13

func matrixInputBlock() Block {
	return Block{
		Slug:        "matrix-input",
		Title:       "Matrix answer",
		Description: "An answer that is a whole matrix. Cells are checked one by one, and a wrong cell says which row and which column produce it, instead of just 'incorrect'.",
		Tags:        []string{"inputs", "per-cell feedback"},
		Render:      matrixInput,
	}
}

func matrixInput() h.Node {
	A := [][]int{{1, 2}, {0, 1}}
	B := [][]int{{3, 0}, {1, 2}}
	ans := [2][2]int{}
	for i := range 2 {
		for j := range 2 {
			ans[i][j] = A[i][0]*B[0][j] + A[i][1]*B[1][j]
		}
	}
	small := func(name string, m [][]int) h.Node {
		return h.Div(h.Class("flex items-center gap-2"),
			h.Span(h.Class("font-serif text-lg italic"), name),
			h.Div(h.Class("matrix grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-sm tabular-nums"),
				h.Map(m, func(r []int) h.Node {
					return h.Map(r, func(v int) h.Node { return h.Span(h.Class("text-center"), minus(v)) })
				})),
		)
	}
	return h.Form(h.Class("flex flex-col gap-6"), h.Data("matrix-answer", ""), h.Action("#"), h.Attr("novalidate", ""),
		h.Div(h.Class("flex flex-col gap-1"),
			h.P(h.Class("text-base font-medium"), "Compute the product AB."),
			h.P(h.Class("text-sm text-muted-foreground"), "Entry (i, j) is row i of A dotted with column j of B."),
		),
		h.Div(h.Class("flex flex-wrap items-center justify-center gap-x-6 gap-y-4"),
			small("A", A), small("B", B),
			h.Div(h.Class("flex items-center gap-2"),
				h.Span(h.Class("font-serif text-lg italic"), "AB", h.Span(h.Class("ml-2 not-italic"), "=")),
				h.Div(h.Class("matrix grid-cols-2 gap-1.5"),
					h.Range(4, func(k int) h.Node {
						i, j := k/2, k%2
						return h.Input(h.Type("text"), h.Attr("inputmode", "numeric"), h.Attr("autocomplete", "off"),
							h.Data("cell", fmt.Sprintf("%d%d", i+1, j+1)), h.Data("answer", fmt.Sprint(ans[i][j])),
							h.Aria("label", fmt.Sprintf("Row %d, column %d", i+1, j+1)), h.Placeholder("?"),
							h.Class("h-11 w-14 rounded-md border border-input bg-background text-center font-mono text-base tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add data-[state=right]:text-add data-[state=wrong]:border-del data-[state=wrong]:text-del"))
					}),
				),
			),
		),
		h.Div(h.Data("feedback", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-center text-sm empty:min-h-0")),
		h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("reset"), h.Class("text-muted-foreground"), "Clear"),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), "Check"),
		),
	)
}

// ---------------------------------------------------------------- 14

func hintsBlock() Block {
	return Block{
		Slug:        "hints",
		Title:       "Progressive hints",
		Description: "Help in small doses. Each hint gives away a little more; the answer itself sits behind a hold-to-reveal, so it is never one stray click away.",
		Tags:        []string{"reveal", "hold to confirm"},
		Render:      hints,
	}
}

func hints() h.Node {
	steps := []h.Node{
		h.P("The determinant measures how much the matrix scales areas. What does that tell you about a matrix whose columns are parallel?"),
		h.P("If the columns are parallel, the unit square is squashed onto a line: its area is 0. So ", mathml(opname("det"), mi("A"), mo("="), mn("0")), "."),
		h.P("Write the second column as k times the first: ", mathml(mn("2"), mo("="), mi("k"), mo("·"), mn("1")), " gives ", mathml(mi("k"), mo("="), mn("2")), ". Now apply the same k to the bottom row."),
	}
	return h.Div(h.Class("flex flex-col gap-5"), h.Data("hints", ""),
		h.Div(h.Class("flex flex-col gap-2"),
			h.P(h.Class("text-base font-medium"), "For which value of t is this matrix not invertible?"),
			h.Div(h.Class("flex items-center justify-center gap-3 py-2"),
				h.Span(h.Class("font-serif text-lg italic"), "A", h.Span(h.Class("ml-2 not-italic"), "=")),
				htmlMatrix([][]string{{"1", "2"}, {"3", "t"}}, "text-base"),
			),
		),
		h.Ol(h.Class("flex flex-col gap-2"), h.Data("list", ""),
			h.MapIdx(steps, func(i int, s h.Node) h.Node {
				return h.Li(h.Data("hint", fmt.Sprint(i)), h.Hidden(),
					h.Class("enter flex gap-3 rounded-lg border bg-background p-3 text-sm leading-relaxed"),
					h.Span(h.Class("flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground"), fmt.Sprint(i+1)),
					h.Div(h.Class("text-muted-foreground [&_math]:text-foreground"), s),
				)
			}),
			h.Li(h.Data("answer", ""), h.Hidden(),
				h.Class("enter flex items-center gap-3 rounded-lg border border-add/40 bg-add/8 p-3 text-sm"),
				hugeicons.CheckmarkCircle02Icon(h.Class("size-5 shrink-0 text-add")),
				h.Span(h.Class("font-medium"), "t = 6"),
				h.Span(h.Class("text-muted-foreground"), "since det A = t − 6."),
			),
		),
		h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
			h.Span(h.Data("count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("0 of %d hints", len(steps))),
			h.Div(h.Class("flex items-center gap-2"),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("next", ""), hugeicons.BulbIcon(), "Show a hint"),
				// Hold to confirm: a clip-path fill over the button, linear while
				// pressed (the user is deciding), quick ease-out when released.
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("hold", ""), h.Class("relative overflow-hidden"),
					h.Aria("label", "Hold to reveal the answer"),
					h.Span(h.Class("relative"), "Hold to reveal answer"),
					h.Span(h.Data("fill", ""), h.Aria("hidden", "true"),
						h.Class("absolute inset-0 flex items-center justify-center bg-foreground text-background [clip-path:inset(0_100%_0_0)]"),
						"Hold to reveal answer"),
				),
			),
		),
	)
}
