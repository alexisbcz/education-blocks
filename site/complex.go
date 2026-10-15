package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ComplexBlocks lists the complex analysis gallery in display order.
func ComplexBlocks() []Block {
	return []Block{
		cxArithmeticBlock(),
		cxEulerBlock(),
		cxRootsBlock(),
		cxDomainBlock(),
		cxConformalBlock(),
		cxContourBlock(),
		cxSphereBlock(),
	}
}

// cxPlane is a square SVG plane in world units (y up, see svg.js).
func cxPlane(attr, view, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(view), h.Class("mx-auto block aspect-square w-full max-w-[520px] touch-none select-none"),
		h.Role("img"), h.Aria("label", label))
}

func cxButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- CX1

func cxArithmeticBlock() Block {
	return Block{
		Slug:        "arithmetic",
		Title:       "Complex arithmetic",
		Description: "Complex numbers as points you can drag. Adding is adding arrows; multiplying multiplies the lengths and adds the angles, so multiplying by w rotates and scales the whole plane. Conjugation reflects across the real axis.",
		Tags:        []string{"drag", "polar form", "rotate and scale"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-arith",
				cxPlane("plane", "-4 -4 8 8", "The complex plane with z, w and the chosen operation"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Operation"),
					segs("Operation", [2]string{"add", "z + w"}, [2]string{"mul", "z · w"}, [2]string{"div", "z / w"}, [2]string{"conj", "z̄"}),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "z"), legendSwatch("var(--vec-v)", "w"), legendSwatch("var(--brand)", "result")),
				readouts([2]string{"z", "z"}, [2]string{"w", "w"}, [2]string{"result", "r"}, [2]string{"|r|, arg r", "polar"}, [2]string{"rule", "rule"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Drag the two tips, or focus one and use the arrow keys."),
			)
		},
	}
}

// ---------------------------------------------------------------- CX2

func cxEulerBlock() Block {
	return Block{
		Slug:        "euler",
		Title:       "Euler's formula",
		Description: "e^(iθ) = cos θ + i sin θ: as θ grows, the point walks the unit circle at unit speed. Its shadow on the real axis is cos θ, on the imaginary axis sin θ, traced out as waves beside it. At θ = π it lands on −1.",
		Tags:        []string{"unit circle", "cos and sin", "e^(iπ) = −1"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-euler",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 720 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Unit circle and the cosine and sine waves it traces")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Angle"),
					field("theta", "θ", "rad", 1, 0, 12.566, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), cxButton("pi", hugeicons.PiIcon(), "θ = π")),
				readouts([2]string{"e^(iθ)", "z"}, [2]string{"cos θ", "cos"}, [2]string{"sin θ", "sin"}, [2]string{"|e^(iθ)|", "mod"}),
			)
		},
	}
}

// ---------------------------------------------------------------- CX3

func cxRootsBlock() Block {
	return Block{
		Slug:        "roots",
		Title:       "Roots of polynomials",
		Description: "Every polynomial of degree n has exactly n complex roots. The n-th roots of a number sit on a regular polygon; for a general polynomial the Durand–Kerner iteration moves n guesses at once until they settle on the roots, which you can watch step by step.",
		Tags:        []string{"roots of unity", "Durand–Kerner", "fundamental theorem"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-roots",
				cxPlane("plane", "-3 -3 6 6", "Roots in the complex plane"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Polynomial"),
					segs("Mode", [2]string{"nth", "zⁿ = c"}, [2]string{"poly", "General"}),
					h.Div(h.Data("mode", "nth"), h.Class("flex flex-col gap-2"),
						field("n", "n", "", 5, 2, 12, 1),
						field("cre", "c, real", "", 1, -4, 4, 0.1),
						field("cim", "c, imag", "", 0, -4, 4, 0.1),
					),
					h.Div(h.Data("mode", "poly"), h.Hidden(), h.Class("flex flex-col gap-2"),
						h.Label(h.Class("flex flex-col gap-1 text-sm"),
							h.Span(h.Class("text-muted-foreground"), "Coefficients, highest first"),
							h.Input(h.Type("text"), h.Data("coeffs", ""), h.Value("1, 0, -2, 2"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
								h.Class("h-9 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"))),
						h.Div(h.Class("grid grid-cols-2 gap-2"),
							cxButton("step", hugeicons.ArrowRight01Icon(), "Step"),
							cxButton("solve", hugeicons.PlayIcon(), "Solve")),
					),
				),
				readouts([2]string{"roots", "count"}, [2]string{"iteration", "iter"}, [2]string{"max |p(z)|", "res"}),
				h.Ol(h.Data("list", ""), h.Class("flex flex-col gap-0.5 font-mono text-xs tabular-nums")),
			)
		},
	}
}

// ---------------------------------------------------------------- CX4

func cxDomainBlock() Block {
	return Block{
		Slug:        "domain-colouring",
		Title:       "Domain colouring",
		Description: "A picture of a complex function: each point z is coloured by f(z), hue for the argument (red at angle 0, through yellow, green, cyan, blue, magenta), with contour rings where |f| crosses a power of 2. Zeros are where every hue meets counter-clockwise; poles where they meet the other way round.",
		Tags:        []string{"canvas", "zeros and poles", "zoom"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-domain",
				h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-lg border"),
					h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full cursor-crosshair"), h.Role("img"), h.Aria("label", "Domain colouring of f"))),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"sq", "z²"}, [2]string{"inv", "1/z"}, [2]string{"rat", "(z²−1)/(z²+1)"}, [2]string{"exp", "eᶻ"}, [2]string{"sin", "sin z"}, [2]string{"cube", "z³ − 1"}),
				),
				h.Div(h.Class("grid grid-cols-3 gap-2"),
					cxButton("zoom-in", hugeicons.ZoomInAreaIcon(), "In"),
					cxButton("zoom-out", hugeicons.ZoomOutAreaIcon(), "Out"),
					cxButton("reset", hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"view", "view"}, [2]string{"z", "z"}, [2]string{"f(z)", "fz"}, [2]string{"|f|, arg f", "polar"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Hover to read f; click to centre the view there."),
			)
		},
	}
}

// ---------------------------------------------------------------- CX5

func cxConformalBlock() Block {
	return Block{
		Slug:        "conformal",
		Title:       "Conformal maps",
		Description: "A square grid and its image under a complex function. Grid lines stay perpendicular wherever f′ ≠ 0: analytic maps preserve angles. The Joukowski map z + 1/z turns an offset circle into an airfoil, the trick behind the earliest wing theory.",
		Tags:        []string{"angles preserved", "Möbius", "Joukowski airfoil"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-conformal",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "z plane"),
						cxPlane("from", "-2.5 -2.5 5 5", "The grid before the map")),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "w = f(z)"),
						cxPlane("to", "-3 -3 6 6", "The grid after the map")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Map"),
					segs("Map", [2]string{"sq", "z²"}, [2]string{"exp", "eᶻ"}, [2]string{"mobius", "Möbius"}, [2]string{"joukowski", "Joukowski"}),
				),
				h.Div(h.Data("params", "mobius"), h.Hidden(), h.Class("flex flex-col gap-2"),
					h.P(h.Class("font-mono text-[11px] text-muted-foreground"), "(z − a) / (1 − ā z), a disk automorphism"),
					field("are", "a, real", "", 0.4, -0.95, 0.95, 0.05),
					field("aim", "a, imag", "", 0.2, -0.95, 0.95, 0.05),
				),
				h.Div(h.Data("params", "joukowski"), h.Hidden(), h.Class("flex flex-col gap-2"),
					h.P(h.Class("font-mono text-[11px] text-muted-foreground"), "circle through z = 1, centre c"),
					field("jre", "c, real", "", -0.1, -0.4, 0.2, 0.01),
					field("jim", "c, imag", "", 0.12, -0.3, 0.4, 0.01),
				),
				readouts([2]string{"map", "map"}, [2]string{"f′ = 0 at", "crit"}),
			)
		},
	}
}

// ---------------------------------------------------------------- CX6

func cxContourBlock() Block {
	return Block{
		Slug:        "contour",
		Title:       "Contour integrals and residues",
		Description: "Integrate f around a circle you can drag and resize. The numerical integral (2,000 trapezoid steps) matches 2πi times the sum of the residues inside, each counted by its winding number: poles outside the circle contribute nothing.",
		Tags:        []string{"residue theorem", "winding number", "numeric vs exact"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-contour",
				cxPlane("plane", "-3 -3 6 6", "The contour and the poles of f"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"inv", "1/z"}, [2]string{"two", "1/(z²+1)"}, [2]string{"expz", "eᶻ/z"}, [2]string{"double", "1/z²"}, [2]string{"entire", "z²"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Circle"),
					field("r", "Radius", "", 1.5, 0.1, 2.9, 0.05),
				),
				readouts([2]string{"∮ f dz (numeric)", "num"}, [2]string{"2πi Σ Res", "exact"}, [2]string{"poles inside", "inside"}, [2]string{"error", "err"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Drag the centre handle; arrow keys move it too."),
			)
		},
	}
}

// ---------------------------------------------------------------- CX7

func cxSphereBlock() Block {
	return Block{
		Slug:        "riemann-sphere",
		Title:       "Riemann sphere",
		Description: "Stereographic projection wraps the whole plane onto a sphere: draw a line from the north pole through z and see where it pierces the sphere. The unit circle becomes the equator, 0 the south pole, and every direction to infinity meets at the single north pole ∞.",
		Tags:        []string{"stereographic", "point at infinity", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cx-sphere",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("sphere", ""), h.ViewBox("-1.6 -1.6 3.2 3.2"), h.Class("block aspect-square w-full touch-none select-none"), h.Role("img"), h.Aria("label", "The Riemann sphere; drag to turn it")),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "z plane"),
						cxPlane("plane", "-4 -4 8 8", "The complex plane; drag z")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					toggle("cx-sphere-grid", "grid", "Circles |z| = ½, 1, 2", true),
					toggle("cx-sphere-ray", "ray", "Ray from the north pole", true),
				),
				readouts([2]string{"z", "z"}, [2]string{"point (X, Y, Z)", "xyz"}, [2]string{"|z|", "mod"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Drag z in the plane, or drag the sphere to turn it. X = 2Re z/(1+|z|²), Y = 2Im z/(1+|z|²), Z = (|z|²−1)/(1+|z|²)."),
			)
		},
	}
}
