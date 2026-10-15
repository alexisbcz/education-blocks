package site

import (
	"strconv"

	h "github.com/alexisbcz/libhtml"
)

// MathML Core, rendered by the browser itself: no KaTeX, no JavaScript.
// These helpers keep formulas readable in Go.

func mathml(children ...any) h.Node { return h.El("math", children...) }
func mathBlock(children ...any) h.Node {
	return h.El("math", append([]any{h.Attr("display", "block")}, children...)...)
}
func mrow(children ...any) h.Node { return h.El("mrow", children...) }
func mi(s string, children ...any) h.Node {
	return h.El("mi", append([]any{s}, children...)...)
}
func mn(s string) h.Node          { return h.El("mn", s) }
func mo(s string) h.Node          { return h.El("mo", s) }
func mtext(s string) h.Node       { return h.El("mtext", s) }
func msup(base, sup any) h.Node   { return h.El("msup", base, sup) }
func msub(base, sub any) h.Node   { return h.El("msub", base, sub) }
func mfrac(num, den any) h.Node   { return h.El("mfrac", num, den) }
func mover(base, over any) h.Node { return h.El("mover", base, over) }

// vecSym is a bold vector name (v, x, ...). MathML Core only supports
// mathvariant="normal", so bold italic letters come from Unicode's
// Mathematical Alphanumeric Symbols block.
func vecSym(s string) h.Node {
	out := []rune{}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
			out = append(out, 0x1D482+(r-'a'))
		case r >= 'A' && r <= 'Z':
			out = append(out, 0x1D468+(r-'A'))
		default:
			out = append(out, r)
		}
	}
	return h.El("mi", string(out))
}

// mspace is a thin space after an operator name such as dim or rank.
func mspace() h.Node { return h.El("mspace", h.Attr("width", "0.2em")) }

// opname is an upright operator name followed by a thin space.
func opname(s string) h.Node { return mrow(h.El("mi", h.Attr("mathvariant", "normal"), s), mspace()) }

// hat is a unit basis vector: i-hat, j-hat.
func hat(s string) h.Node { return mover(mi(s), h.El("mo", h.Attr("accent", "true"), "^")) }

// htmlMatrix is a bracketed matrix laid out in HTML, so it matches the
// other matrices of the platform (MathML Core tables have no spacing).
func htmlMatrix(rows [][]string, class string) h.Node {
	return h.Div(h.Class("matrix gap-x-3 gap-y-1 font-mono tabular-nums "+class),
		h.Style("grid-template-columns: repeat("+strconv.Itoa(len(rows[0]))+", auto)"),
		h.Map(rows, func(r []string) h.Node {
			return h.Map(r, func(c string) h.Node { return h.Span(h.Class("text-center"), c) })
		}),
	)
}
