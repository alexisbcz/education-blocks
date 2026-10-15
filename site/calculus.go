package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// CalculusBlocks lists the calculus gallery in display order.
func CalculusBlocks() []Block {
	return []Block{
		calcLimitBlock(),
		calcDerivativeBlock(),
		calcRiemannBlock(),
		calcFTCBlock(),
		calcTaylorBlock(),
		calcNewtonBlock(),
		calcEulerBlock(),
		calcSeriesBlock(),
	}
}

// calcSVG is a plot surface; calculus.js draws into it.
func calcSVG(name, viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[640px] select-none"),
		h.Role("img"), h.Aria("label", label))
}

func calcButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- C1

func calcLimitBlock() Block {
	return Block{
		Slug:        "limits",
		Title:       "Limits, ε and δ",
		Description: "The definition made visible. Pick a tolerance ε around the limit L; the block finds the widest δ such that every x within δ of a (except a itself) lands inside the ε-band. Shrink ε and δ follows; at a hole, f(a) does not even need to exist.",
		Tags:        []string{"ε–δ", "removable hole", "bands"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-limit",
				calcSVG("main", "0 0 560 340", "Graph of f with the epsilon band around L and the delta band around a"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"square", "x² at 2"}, [2]string{"sinc", "sin x / x at 0"}, [2]string{"cubic", "(x³−1)/(x−1) at 1"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Tolerance"),
					field("eps", "ε", "", 0.5, 0.01, 2, 0.01),
				),
				readouts([2]string{"limit L", "L"}, [2]string{"widest δ", "delta"}, [2]string{"f(a)", "fa"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C2

func calcDerivativeBlock() Block {
	return Block{
		Slug:        "derivative",
		Title:       "Derivative as a limit",
		Description: "A secant through (a, f(a)) and (a+h, f(a+h)) turns into the tangent as h shrinks. The secant slope's error against the exact derivative falls in proportion to h, about f″(a)·h/2, until floating point catches up with very small h.",
		Tags:        []string{"secant", "tangent", "h → 0"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-deriv",
				calcSVG("main", "0 0 560 340", "Graph of f with a secant line and the tangent line"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"cubic", "x³ − 3x"}, [2]string{"sin", "sin x"}, [2]string{"exp", "eˣ"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Point and step"),
					field("a", "a", "", 0.5, -2, 2, 0.05),
					field("h", "h", "", 1, 0.001, 2, 0.001),
				),
				h.Div(h.Class("flex gap-2"), calcButton("shrink", "Halve h", hugeicons.ArrowDown01Icon())),
				readouts([2]string{"secant slope", "secant"}, [2]string{"f′(a) exact", "exact"}, [2]string{"error", "err"}, [2]string{"error / h", "ratio"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func calcRiemannBlock() Block {
	return Block{
		Slug:        "riemann",
		Title:       "Riemann sums and quadrature",
		Description: "Area under a curve approximated with n slices: left and right sums (error ∝ 1/n), midpoint and trapezoid (∝ 1/n²), Simpson's rule (∝ 1/n⁴). The log–log plot shows those slopes against the exact integral.",
		Tags:        []string{"integral", "error order", "log–log"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-riemann",
				h.Div(h.Class("flex flex-col gap-2"),
					calcSVG("main", "0 0 560 300", "Curve with the approximating slices"),
					calcSVG("err", "0 0 560 170", "Error against n on log-log axes for every rule"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Integral"),
					segs("Integrand", [2]string{"sq", "x² on [0, 2]"}, [2]string{"sin", "sin x on [0, π]"}, [2]string{"exp", "eˣ on [0, 1]"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Rule"),
					segs("Rule", [2]string{"left", "Left"}, [2]string{"right", "Right"}, [2]string{"mid", "Mid"}, [2]string{"trap", "Trapezoid"}, [2]string{"simpson", "Simpson"}),
					field("n", "Slices n", "", 6, 2, 64, 2),
				),
				readouts([2]string{"approximation", "approx"}, [2]string{"exact", "exact"}, [2]string{"error", "err"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func calcFTCBlock() Block {
	return Block{
		Slug:        "ftc",
		Title:       "Fundamental theorem of calculus",
		Description: "F(x) is the signed area under f from 0 to x. Move x: the area on top becomes a point on the curve below, and the slope of F at x is exactly f(x). Integration and differentiation undo each other.",
		Tags:        []string{"accumulation", "signed area", "F′ = f"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-ftc",
				h.Div(h.Class("flex flex-col gap-2"),
					calcSVG("f", "0 0 560 210", "Graph of f with the area from 0 to x shaded"),
					calcSVG("F", "0 0 560 210", "Graph of the accumulation function F with its tangent at x"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Integrand"),
					segs("Integrand", [2]string{"cos", "cos t"}, [2]string{"lin", "1 − t/2"}, [2]string{"wave", "t·sin t"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Upper limit"),
					field("x", "x", "", 2, 0, 6, 0.05),
				),
				h.Div(h.Class("flex gap-2"), playPauseLabel("Sweep")),
				readouts([2]string{"F(x) = ∫₀ˣ f", "F"}, [2]string{"slope of F", "slope"}, [2]string{"f(x)", "fx"}),
			)
		},
	}
}

// playPauseLabel is playPause with a custom label.
func playPauseLabel(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

// ---------------------------------------------------------------- C5

func calcTaylorBlock() Block {
	return Block{
		Slug:        "taylor",
		Title:       "Taylor polynomials",
		Description: "Polynomials that copy a function's derivatives at 0. For sin x and eˣ they converge everywhere; for ln(1+x) and 1/(1−x) only inside the radius of convergence, and adding terms makes things worse outside it.",
		Tags:        []string{"Maclaurin", "remainder", "radius"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-taylor",
				calcSVG("main", "0 0 560 340", "Function and its Taylor polynomial"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"sin", "sin x"}, [2]string{"exp", "eˣ"}, [2]string{"log", "ln(1+x)"}, [2]string{"geo", "1/(1−x)"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Polynomial"),
					field("deg", "Degree n", "", 3, 0, 25, 1),
					field("x", "Evaluate at x", "", 1, -3, 3, 0.05),
				),
				readouts([2]string{"f(x)", "fx"}, [2]string{"Pₙ(x)", "px"}, [2]string{"|error|", "err"}, [2]string{"radius", "radius"}),
				h.P(h.Data("out", "terms"), h.Class("font-mono text-[11px] leading-relaxed break-words text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func calcNewtonBlock() Block {
	return Block{
		Slug:        "newton",
		Title:       "Newton's method",
		Description: "Follow the tangent to where it hits zero, repeat. Near a simple root the number of correct digits roughly doubles each step (quadratic convergence); from a bad start it can cycle forever, as x³ − 2x + 2 from x₀ = 0 does.",
		Tags:        []string{"root finding", "quadratic convergence", "cycles"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-newton",
				calcSVG("main", "0 0 560 320", "Function with Newton's tangent steps"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Equation"),
					segs("Function", [2]string{"sqrt2", "x² − 2"}, [2]string{"cos", "cos x − x"}, [2]string{"cycle", "x³ − 2x + 2"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Start"),
					field("x0", "x₀", "", 3, -3, 3, 0.05),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					calcButton("step", "Step", hugeicons.ArrowRight01Icon()),
					calcButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				h.Div(h.Class("scroll-thin max-h-56 overflow-auto rounded-lg border bg-code"),
					h.Table(h.Class("w-full font-mono text-[11px] tabular-nums"),
						h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
							h.Th(h.Class("px-2 py-1.5 font-normal"), "k"),
							h.Th(h.Class("px-2 py-1.5 font-normal"), "xₖ"),
							h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "|f(xₖ)|"))),
						h.Tbody(h.Data("rows", "")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

func calcEulerBlock() Block {
	return Block{
		Slug:        "euler-method",
		Title:       "Slope fields and Euler's method",
		Description: "A differential equation gives a slope at every point. Euler's method walks along those slopes in steps of h; its error at the end shrinks in proportion to h, Heun's improved method like h². Both are drawn against the exact solution.",
		Tags:        []string{"ODE", "numerical methods", "error ∝ h"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-euler",
				calcSVG("main", "0 0 560 340", "Slope field with the exact solution and the numerical approximations"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Equation, y(0) = 1"),
					segs("Equation", [2]string{"growth", "y′ = y"}, [2]string{"relax", "y′ = x − y"}, [2]string{"gauss", "y′ = −2xy"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Method"),
					field("h", "Step h", "", 0.5, 0.01, 1, 0.01),
					toggle("calc-heun", "heun", "Show Heun (improved Euler)", true),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "exact"),
					legendSwatch("var(--brand)", "Euler"),
					legendSwatch("var(--vec-u)", "Heun"),
				),
				readouts([2]string{"exact y(2)", "exact"}, [2]string{"Euler y(2)", "euler"}, [2]string{"Euler error", "eerr"}, [2]string{"Heun error", "herr"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func calcSeriesBlock() Block {
	return Block{
		Slug:        "series",
		Title:       "Infinite series",
		Description: "Partial sums Sₙ and where they go. The harmonic series grows without bound (like ln N), the alternating harmonic series creeps to ln 2, the geometric series converges exactly when |r| < 1, and the p-series when p > 1 (π²/6 at p = 2).",
		Tags:        []string{"convergence tests", "partial sums", "ln 2, π²/6, e"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("calc-series",
				calcSVG("main", "0 0 560 320", "Partial sums against the number of terms"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Series"),
					segs("Series", [2]string{"harmonic", "Σ 1/n"}, [2]string{"alt", "Σ (−1)ⁿ⁺¹/n"}, [2]string{"geo", "Σ rⁿ"}, [2]string{"p", "Σ 1/nᵖ"}, [2]string{"fact", "Σ 1/n!"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameters"),
					field("N", "Terms N", "", 40, 1, 400, 1),
					field("r", "r (geometric)", "", 0.5, -1.2, 1.2, 0.01),
					field("p", "p (p-series)", "", 2, 0.5, 4, 0.05),
				),
				readouts([2]string{"S_N", "sum"}, [2]string{"limit", "limit"}, [2]string{"verdict", "verdict"}),
				h.P(h.Data("out", "test"), h.Class("text-xs leading-relaxed text-muted-foreground")),
			)
		},
	}
}
