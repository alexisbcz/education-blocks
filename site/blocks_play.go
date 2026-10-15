package site

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/label"
	switchui "github.com/alexisbcz/components/ui/switch"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- 09

func transformBlock() Block {
	return Block{
		Slug:        "transform",
		Title:       "Transformation playground",
		Description: "The lesson's centerpiece. Scrub any entry of the matrix (drag it sideways, use the arrow keys or type) and watch the plane move: the basis vectors land on the columns, and the shaded square's area is the determinant.",
		Tags:        []string{"SVG", "scrub input", "eigenvectors"},
		Wide:        true,
		Render:      transformPlayground,
	}
}

type preset struct {
	name       string
	a, b, c, d float64
}

var presets = []preset{
	{"Identity", 1, 0, 0, 1},
	{"Rotate 90°", 0, -1, 1, 0},
	{"Shear", 1, 1, 0, 1},
	{"Stretch", 2, 0, 0, 0.5},
	{"Reflect", 0, 1, 1, 0},
	{"Collapse", 1, 2, 0.5, 1},
}

func transformPlayground() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("transform", ""),
		h.Div(h.Class("relative border-b bg-code lg:border-r lg:border-b-0"),
			h.Svg(h.Data("plane", ""), h.ViewBox("-5 -5 10 10"), h.Class("mx-auto block aspect-square w-full max-w-[560px] touch-none select-none"),
				h.Role("img"), h.Aria("label", "The plane under the matrix A"),
			),
			h.Div(h.Class("pointer-events-none absolute top-3 left-3 flex flex-col gap-1 rounded-md border bg-background/80 px-2.5 py-2 font-mono text-[11px] backdrop-blur-sm"),
				h.Span(h.Class("flex items-center gap-2"), h.Span(h.Class("h-0.5 w-3 rounded-full bg-vec-i")), "î → ", h.Span(h.Data("out", "i"), "(1, 0)")),
				h.Span(h.Class("flex items-center gap-2"), h.Span(h.Class("h-0.5 w-3 rounded-full bg-vec-j")), "ĵ → ", h.Span(h.Data("out", "j"), "(0, 1)")),
				h.Span(h.Class("flex items-center gap-2"), h.Span(h.Class("size-2.5 rounded-[2px] bg-vec-out/30 ring-1 ring-vec-out")), "area ", h.Span(h.Data("out", "area"), "1")),
			),
			h.P(h.Class("pointer-events-none absolute right-3 bottom-3 hidden rounded-md bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm sm:block"),
				"Drag the blue vector"),
		),
		h.Div(h.Class("flex flex-col gap-6 p-5"),
			h.Div(h.Class("flex flex-col gap-3"),
				h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Matrix"),
				h.Div(h.Class("flex items-center gap-3"),
					h.Span(h.Class("font-serif text-xl italic"), "A", h.Span(h.Class("ml-2 not-italic"), "=")),
					h.Div(h.Class("matrix grid-cols-2 gap-1.5"),
						scrub("a", 1, "text-vec-i"), scrub("b", 0, "text-vec-j"),
						scrub("c", 0, "text-vec-i"), scrub("d", 1, "text-vec-j"),
					),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Column 1 is where î lands, column 2 is where ĵ lands."),
			),
			h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-y py-4 font-mono text-xs"),
				h.Dt(h.Class("text-muted-foreground"), "det A"), h.Dd(h.Data("out", "det"), h.Class("tabular-nums"), "1"),
				h.Dt(h.Class("text-muted-foreground"), "eigenvalues"), h.Dd(h.Data("out", "eig"), h.Class("tabular-nums"), "1, 1"),
				h.Dt(h.Class("text-muted-foreground"), "A v"), h.Dd(h.Data("out", "av"), h.Class("tabular-nums"), "(1.5, 1)"),
			),
			h.Div(h.Class("flex flex-col gap-3"),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					label.Label(h.For("tf-eigen"), h.Class("font-normal"), "Eigenvector lines"),
					switchui.Switch(h.ID("tf-eigen"), h.Data("toggle", "eigen"), switchui.Checked(true)),
				),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					label.Label(h.For("tf-ghost"), h.Class("font-normal"), "Original grid"),
					switchui.Switch(h.ID("tf-ghost"), h.Data("toggle", "ghost"), switchui.Checked(true)),
				),
			),
			h.Div(h.Class("flex flex-col gap-2"),
				h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Presets"),
				h.Div(h.Class("grid grid-cols-2 gap-1.5"),
					h.Map(presets, func(p preset) h.Node {
						return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Class("justify-start font-normal"),
							h.Data("preset", fmt.Sprintf("%g %g %g %g", p.a, p.b, p.c, p.d)), p.name)
					}),
				),
			),
		),
	)
}

// scrub is a number the learner drags sideways to change (static/js/scrub.js).
func scrub(name string, v float64, color string) h.Node {
	return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
		h.Aria("label", "Entry "+name), h.Attr("autocomplete", "off"),
		h.Class("h-9 w-16 cursor-ew-resize rounded-md border border-transparent bg-transparent text-center font-mono text-base tabular-nums outline-none transition-colors duration-150 hover:bg-accent focus:cursor-text focus:border-input focus:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:bg-accent "+color))
}

// ---------------------------------------------------------------- 10

func dotProductBlock() Block {
	return Block{
		Slug:        "dot-product",
		Title:       "Dot product",
		Description: "Two vectors you can drag. The projection, the angle and both formulas update together, so the algebra (sum of products) and the geometry (lengths and cosine) visibly agree.",
		Tags:        []string{"SVG", "drag", "keyboard"},
		Render:      dotProduct,
	}
}

func dotProduct() h.Node {
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background sm:flex-row"), h.Data("dot", ""),
		h.Div(h.Class("relative border-b bg-code sm:w-[58%] sm:border-r sm:border-b-0"),
			h.Svg(h.Data("plane", ""), h.ViewBox("-4 -4 8 8"), h.Class("block aspect-square w-full touch-none select-none"),
				h.Role("img"), h.Aria("label", "Vectors u and v"),
			),
		),
		h.Div(h.Class("flex flex-1 flex-col justify-between gap-5 p-5"),
			h.Div(h.Class("flex flex-col gap-4"),
				h.Div(h.Class("flex flex-col gap-1 font-mono text-xs"),
					h.Span(h.Class("flex items-center gap-2"), h.Span(h.Class("h-0.5 w-3 rounded-full bg-vec-u")), "u = ", h.Span(h.Data("out", "u"), "(3, 1)")),
					h.Span(h.Class("flex items-center gap-2"), h.Span(h.Class("h-0.5 w-3 rounded-full bg-vec-v")), "v = ", h.Span(h.Data("out", "v"), "(1, 2)")),
				),
				h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3 font-mono text-xs"),
					h.Div(h.Class("text-muted-foreground"), "algebra"),
					h.Div(h.Data("out", "alg"), h.Class("tabular-nums"), "3·1 + 1·2 = 5"),
					h.Div(h.Class("mt-2 text-muted-foreground"), "geometry"),
					h.Div(h.Data("out", "geo"), h.Class("tabular-nums"), "|u||v| cos θ = 5"),
				),
				h.Div(h.Class("flex items-baseline gap-2"),
					h.Span(h.Class("font-serif text-lg italic"), "u · v ="),
					h.Span(h.Data("out", "dot"), h.Class("font-mono text-2xl font-medium tabular-nums transition-colors duration-200"), "5"),
					h.Span(h.Data("out", "sign"), h.Class("text-xs text-muted-foreground"), "same direction"),
				),
			),
			h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
				"Drag a tip, or focus it and use", kbd.Group(kbd.Kbd("←"), kbd.Kbd("↑"), kbd.Kbd("→"), kbd.Kbd("↓"))),
		),
	)
}

// ---------------------------------------------------------------- 11

func eliminationBlock() Block {
	return Block{
		Slug:        "elimination",
		Title:       "Row reduction stepper",
		Description: "Gauss–Jordan elimination one row operation at a time. Every step is computed in Go with exact fractions; the stepper names the operation, marks the pivot and the row that changed.",
		Tags:        []string{"stepper", "exact fractions", "kbd"},
		Render:      elimination,
	}
}

type elimStep struct {
	op      string // e.g. "R₂ ← R₂ + 3/2 R₁"
	why     string
	m       [][]*big.Rat
	pivot   [2]int // -1 when none
	changed int    // row that changed, -1 for none
}

var subDigits = []string{"₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"}

func rowName(i int) string { return "R" + subDigits[i+1] }

func ratString(r *big.Rat) string {
	if r.IsInt() {
		return minusStr(r.Num().String())
	}
	return minusStr(r.Num().String()) + "/" + r.Denom().String()
}

func minusStr(s string) string { return strings.Replace(s, "-", "−", 1) }

func cloneM(m [][]*big.Rat) [][]*big.Rat {
	out := make([][]*big.Rat, len(m))
	for i, r := range m {
		out[i] = make([]*big.Rat, len(r))
		for j, v := range r {
			out[i][j] = new(big.Rat).Set(v)
		}
	}
	return out
}

// gaussJordan reduces an augmented matrix to reduced row echelon form and
// records every row operation.
func gaussJordan(in [][]int64) []elimStep {
	m := make([][]*big.Rat, len(in))
	for i, r := range in {
		m[i] = make([]*big.Rat, len(r))
		for j, v := range r {
			m[i][j] = big.NewRat(v, 1)
		}
	}
	steps := []elimStep{{op: "Start", why: "The augmented matrix [A | b] of the system.", m: cloneM(m), pivot: [2]int{-1, -1}, changed: -1}}
	rows, cols := len(m), len(m[0])-1
	coef := func(k *big.Rat) string {
		a := new(big.Rat).Abs(k)
		if a.Cmp(big.NewRat(1, 1)) == 0 {
			return ""
		}
		return ratString(a) + " "
	}
	// Forward elimination.
	for c := 0; c < min(rows, cols); c++ {
		if m[c][c].Sign() == 0 {
			continue
		}
		for r := c + 1; r < rows; r++ {
			if m[r][c].Sign() == 0 {
				continue
			}
			k := new(big.Rat).Quo(m[r][c], m[c][c])
			k.Neg(k)
			for j := range m[r] {
				m[r][j].Add(m[r][j], new(big.Rat).Mul(k, m[c][j]))
			}
			sign := "+"
			if k.Sign() < 0 {
				sign = "−"
			}
			steps = append(steps, elimStep{
				op:  fmt.Sprintf("%s ← %s %s %s%s", rowName(r), rowName(r), sign, coef(k), rowName(c)),
				why: fmt.Sprintf("Clear the entry under the pivot in column %d.", c+1),
				m:   cloneM(m), pivot: [2]int{c, c}, changed: r,
			})
		}
	}
	// Scale pivots to 1, bottom up, and clear above them.
	for c := min(rows, cols) - 1; c >= 0; c-- {
		if m[c][c].Sign() == 0 {
			continue
		}
		if m[c][c].Cmp(big.NewRat(1, 1)) != 0 {
			k := new(big.Rat).Inv(m[c][c])
			for j := range m[c] {
				m[c][j].Mul(m[c][j], k)
			}
			steps = append(steps, elimStep{
				op:  fmt.Sprintf("%s ← %s%s", rowName(c), h.Ternary(k.IsInt(), ratString(k)+" ", "("+ratString(k)+") "), rowName(c)),
				why: "Scale the row so its pivot is 1.",
				m:   cloneM(m), pivot: [2]int{c, c}, changed: c,
			})
		}
		for r := c - 1; r >= 0; r-- {
			if m[r][c].Sign() == 0 {
				continue
			}
			k := new(big.Rat).Neg(m[r][c])
			for j := range m[r] {
				m[r][j].Add(m[r][j], new(big.Rat).Mul(k, m[c][j]))
			}
			sign := "+"
			if k.Sign() < 0 {
				sign = "−"
			}
			steps = append(steps, elimStep{
				op:  fmt.Sprintf("%s ← %s %s %s%s", rowName(r), rowName(r), sign, coef(k), rowName(c)),
				why: fmt.Sprintf("Clear the entry above the pivot in column %d.", c+1),
				m:   cloneM(m), pivot: [2]int{c, c}, changed: r,
			})
		}
	}
	last := steps[len(steps)-1]
	sol := make([]string, rows)
	for i := range sol {
		sol[i] = ratString(last.m[i][cols])
	}
	steps = append(steps, elimStep{
		op:  "Done",
		why: fmt.Sprintf("Reduced row echelon form: x = %s, y = %s, z = %s.", sol[0], sol[1], sol[2]),
		m:   cloneM(last.m), pivot: [2]int{-1, -1}, changed: -1,
	})
	return steps
}

func ratCell(r *big.Rat) h.Node {
	if r.IsInt() {
		return h.Span(minusStr(r.Num().String()))
	}
	num := new(big.Int).Abs(r.Num())
	return h.Span(h.Class("inline-flex items-center gap-0.5"),
		h.If(r.Sign() < 0, h.Span("−")),
		h.Span(h.Class("inline-flex flex-col items-center text-[11px] leading-[13px]"),
			h.Span(num.String()), h.Span(h.Class("w-full border-t border-current text-center"), r.Denom().String())))
}

func elimination() h.Node {
	steps := gaussJordan([][]int64{{2, 1, -1, 8}, {-3, -1, 2, -11}, {-2, 1, 2, -3}})
	return h.Div(h.Class("flex flex-col gap-5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("stepper", ""), h.TabIndex(0),
		h.Aria("label", "Row reduction, use the arrow keys to step"),
		h.Div(h.Class("flex items-center justify-between gap-3"),
			h.Div(h.Class("flex flex-col"),
				h.Span(h.Class("text-sm font-medium"), "Solve the system"),
				h.Span(h.Class("font-mono text-xs text-muted-foreground"), "2x + y − z = 8 · −3x − y + 2z = −11 · −2x + y + 2z = −3"),
			),
			h.Span(h.Data("counter", ""), h.Class("shrink-0 font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("1 / %d", len(steps))),
		),
		h.Div(h.Class("grid"),
			h.MapIdx(steps, func(s int, st elimStep) h.Node {
				return h.Div(h.Data("step", fmt.Sprint(s)), h.If(s != 0, h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col items-center gap-4"),
					h.Div(h.Class("flex h-8 items-center gap-2"),
						h.Span(h.Class("rounded-md border bg-code px-2.5 py-1 font-mono text-sm"), st.op),
					),
					h.Div(h.Class("matrix gap-x-1 gap-y-1"), h.Style("grid-template-columns: repeat(3, 3.25rem) 1px 3.25rem"),
						h.MapIdx(st.m, func(i int, row []*big.Rat) h.Node {
							return h.MapIdx(row, func(j int, v *big.Rat) h.Node {
								cls := "flex h-10 items-center justify-center rounded-md font-mono tabular-nums"
								if i == st.changed {
									cls += " bg-vec-out/12 enter"
								}
								if st.pivot[0] == i && st.pivot[1] == j {
									cls += " ring-1 ring-foreground ring-inset"
								}
								cell := h.Div(h.Class(cls), ratCell(v))
								if j == len(row)-1 {
									return h.Group(h.Div(h.Class("my-1 border-l border-dashed border-foreground/30")), cell)
								}
								return cell
							})
						}),
					),
					h.P(h.Class("min-h-10 max-w-md text-center text-sm text-pretty text-muted-foreground"), st.why),
				)
			}),
		),
		h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
			h.Div(h.Class("flex items-center gap-1"), h.Aria("hidden", "true"),
				h.Range(len(steps), func(i int) h.Node {
					return h.Span(h.Data("pip", fmt.Sprint(i)),
						h.Class("h-1.5 w-1.5 rounded-full bg-foreground/15 transition-[width,background-color] duration-200 ease-[var(--ease-out)] data-[on]:w-4 data-[on]:bg-foreground"),
						h.If(i == 0, h.Data("on", "")))
				}),
			),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
		),
	)
}
