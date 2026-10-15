package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GeometryBlocks lists the geometry gallery in display order.
func GeometryBlocks() []Block {
	return []Block{
		constructionBlock(),
		pythagorasBlock(),
		unitCircleBlock(),
		circleTheoremsBlock(),
		exhaustionBlock(),
		conicsBlock(),
		wallpaperBlock(),
		hyperbolicBlock(),
		platonicBlock(),
		angleSumProofBlock(),
	}
}

// planeSVG is a square drawing in world coordinates (y up, see svg.js).
func planeSVG(viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plane", ""), h.ViewBox(viewBox), h.Class("mx-auto block aspect-square w-full max-w-[520px] touch-none select-none"),
		h.Role("img"), h.Aria("label", label)}, extra...)...)
}

func hint(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- G1

func constructionBlock() Block {
	return Block{
		Slug:        "construction",
		Title:       "Triangle centres",
		Description: "A small dynamic-geometry sketchpad. Drag A, B and C; the four classical centres follow. Turn on the Euler line: circumcentre O, centroid G and orthocentre H stay collinear, with HG exactly twice GO, for every triangle.",
		Tags:        []string{"drag", "Euler line", "nine-point circle"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-tri",
				planeSVG("-5 -4.2 10 8.4", "Triangle ABC and its centres", h.Class("mx-auto block aspect-[10/8.4] w-full max-w-[640px] touch-none select-none")),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Show"),
					toggle("gt-circ", "circum", "Circumcircle · O", true),
					toggle("gt-in", "incircle", "Incircle · I", false),
					toggle("gt-cen", "centroid", "Medians · G", false),
					toggle("gt-ort", "ortho", "Altitudes · H", false),
					toggle("gt-eul", "euler", "Euler line", true),
					toggle("gt-nine", "nine", "Nine-point circle", false),
				),
				readouts([2]string{"a · b · c", "sides"}, [2]string{"A · B · C", "angles"}, [2]string{"sum", "sum"},
					[2]string{"area (Heron)", "heron"}, [2]string{"area (shoelace)", "shoe"}, [2]string{"HG / GO", "ratio"}),
				hint("Drag a vertex, or focus it and use the arrow keys."),
			)
		},
	}
}

// ---------------------------------------------------------------- G2

func pythagorasBlock() Block {
	return Block{
		Slug:        "pythagoras",
		Title:       "Pythagoras, two proofs",
		Description: "The same big square, filled two ways with four copies of one right triangle. What is left over is c² in one arrangement and a² + b² in the other, so they are equal. The second tab shows Euclid's version (Elements I.47) with squares on the three sides.",
		Tags:        []string{"proof", "dissection", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pyth",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Data("view", "rearrange"), planeSVG("-0.6 -0.6 8.2 8.2", "Four right triangles rearranged inside a square")),
					h.Div(h.Data("view", "euclid"), h.Hidden(), planeSVG("-5 -4 12 12", "Squares on the sides of a right triangle")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Proof"),
					segs("Proof", [2]string{"rearrange", "Rearrangement"}, [2]string{"euclid", "Euclid I.47"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Legs"),
					field("a", "a", "", 3, 0.5, 5, 0.1),
					field("b", "b", "", 4, 0.5, 5, 0.1),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "swap"), hugeicons.ShuffleIcon(), h.Span(h.Data("label", ""), "Rearrange")),
				readouts([2]string{"a²", "a2"}, [2]string{"b²", "b2"}, [2]string{"a² + b²", "sum"}, [2]string{"c²", "c2"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G3

func unitCircleBlock() Block {
	return Block{
		Slug:        "unit-circle",
		Title:       "Unit circle",
		Description: "Sine and cosine are coordinates, tangent is a length on the tangent line. Drag the point around the circle and the three graphs are traced beside it; special angles snap and show their exact values.",
		Tags:        []string{"trigonometry", "exact values", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trig",
				h.Div(h.Class("grid items-center gap-3 sm:grid-cols-[5fr_7fr]"),
					planeSVG("-1.45 -1.45 2.9 2.9", "Unit circle with the angle θ"),
					h.Svg(h.Data("graph", ""), h.ViewBox("0 0 420 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Graphs of sine, cosine and tangent")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Angle unit"),
					segs("Angle unit", [2]string{"deg", "Degrees"}, [2]string{"rad", "Radians"}),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-j)", "sin θ"), legendSwatch("var(--vec-i)", "cos θ"), legendSwatch("var(--vec-out)", "tan θ"),
				),
				readouts([2]string{"θ", "theta"}, [2]string{"sin θ", "sin"}, [2]string{"cos θ", "cos"}, [2]string{"tan θ", "tan"}),
				hint("Drag the point, or focus it: ←/→ move 1°, Shift 15°."),
			)
		},
	}
}

// ---------------------------------------------------------------- G4

func circleTheoremsBlock() Block {
	return Block{
		Slug:        "circle-theorems",
		Title:       "Circle theorems",
		Description: "Four theorems about angles in a circle, each with points you can drag along the circumference. The measures change; the relation between them does not.",
		Tags:        []string{"inscribed angle", "cyclic quadrilateral", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("circ",
				planeSVG("-1.5 -1.5 3 3", "Circle with draggable points"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Theorem"),
					segs("Theorem", [2]string{"inscribed", "Inscribed"}, [2]string{"segment", "Same segment"}),
					// A second row of the same choice: nothing selected here at first.
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Theorem"),
						segButton("semicircle", "Semicircle", false), segButton("cyclic", "Cyclic quad", false)),
				),
				h.P(h.Data("out", "statement"), h.Class("text-sm leading-relaxed"), "—"),
				h.Div(h.Data("out", "measures"), h.Class("flex flex-col gap-1 border-t pt-4 font-mono text-xs")),
				hint("Drag the pink points along the circle."),
			)
		},
	}
}

// ---------------------------------------------------------------- G5

func exhaustionBlock() Block {
	rows := []int{6, 12, 24, 48, 96}
	return Block{
		Slug:        "exhaustion",
		Title:       "Archimedes and π",
		Description: "Squeeze the circle between two regular polygons and π is trapped between their perimeters. Archimedes doubled from 6 to 96 sides by hand and proved 223/71 < π < 22/7; the table recomputes his bounds.",
		Tags:        []string{"π", "polygons", "limits"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pi",
				planeSVG("-1.3 -1.3 2.6 2.6", "Inscribed and circumscribed polygons around a unit circle"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Polygon"), field("n", "Sides n", "", 6, 3, 96, 1)),
				readouts([2]string{"lower", "lower"}, [2]string{"upper", "upper"}, [2]string{"width", "gap"}),
				h.Table(h.Class("w-full border-t pt-2 font-mono text-[11px]"),
					h.Thead(h.Tr(h.Class("text-left text-muted-foreground"),
						h.Th(h.Class("py-1 font-normal"), "n"), h.Th(h.Class("py-1 text-right font-normal"), "inscribed"), h.Th(h.Class("py-1 text-right font-normal"), "circumscribed"))),
					h.Tbody(h.Map(rows, func(n int) h.Node {
						return h.Tr(h.Data("row", fmt.Sprint(n)), h.Class("data-[on]:text-brand"),
							h.Td(h.Class("py-0.5"), fmt.Sprint(n)),
							h.Td(h.Class("py-0.5 text-right tabular-nums"), h.Data("lo", ""), "—"),
							h.Td(h.Class("py-0.5 text-right tabular-nums"), h.Data("hi", ""), "—"))
					})),
				),
				hint("223/71 = 3.14084…, 22/7 = 3.14285…, π = 3.14159…"),
			)
		},
	}
}

// ---------------------------------------------------------------- G6

func conicsBlock() Block {
	return Block{
		Slug:        "conics",
		Title:       "Conic sections",
		Description: "One rule draws all three: the points whose distance to a focus is e times their distance to a line. Below 1 the curve closes into an ellipse, at 1 it is a parabola, above 1 it splits into a hyperbola. Drag the point along the curve to check the ratio.",
		Tags:        []string{"focus–directrix", "eccentricity", "locus"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("conic",
				planeSVG("-6 -4.5 12 9", "Conic from a focus and a directrix", h.Class("mx-auto block aspect-[4/3] w-full max-w-[640px] touch-none select-none")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Curve"),
					field("e", "Eccentricity e", "", 0.6, 0.05, 2, 0.01),
					field("p", "Focus to line", "", 2, 0.5, 4, 0.1),
				),
				h.Div(h.Class("grid grid-cols-3 gap-1.5"),
					h.Map([][2]string{{"0.6", "Ellipse"}, {"1", "Parabola"}, {"1.6", "Hyperbola"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("e", p[0]), h.Class("px-2 font-normal"), p[1])
					}),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "trace"), hugeicons.PlayIcon(), "Trace the locus"),
				readouts([2]string{"type", "type"}, [2]string{"PF", "pf"}, [2]string{"e · PD", "pd"}, [2]string{"PF + PF′", "sum"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G7

func wallpaperBlock() Block {
	groups := [][2]string{{"p1", "p1"}, {"p2", "p2"}, {"pm", "pm"}, {"pg", "pg"}, {"p4", "p4"}, {"p4m", "p4m"}, {"p3", "p3"}, {"p6", "p6"}, {"p6m", "p6m"}}
	return Block{
		Slug:        "wallpaper",
		Title:       "Wallpaper symmetry",
		Description: "One small motif, copied by a group of symmetries until it tiles the plane. There are exactly 17 wallpaper groups; here are nine of them, in crystallographic notation. Drag the motif to move it inside its cell.",
		Tags:        []string{"symmetry groups", "tiling", "17 groups"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("tile",
				planeSVG("-3 -2.25 6 4.5", "A wallpaper pattern", h.Class("mx-auto block aspect-[4/3] w-full max-w-[640px] touch-none select-none")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Group"),
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Wallpaper group"),
						h.MapIdx(groups, func(i int, g [2]string) h.Node { return segButton(g[0], g[1], i == 5) }),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("tile-cell", "cell", "Lattice cell", true),
					toggle("tile-sym", "symbols", "Rotation centres and mirrors", true),
				),
				readouts([2]string{"lattice", "lattice"}, [2]string{"rotations", "rot"}, [2]string{"reflections", "refl"}, [2]string{"copies / cell", "copies"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G8

func hyperbolicBlock() Block {
	return Block{
		Slug:        "non-euclidean",
		Title:       "Non-Euclidean triangles",
		Description: "Euclid's fifth postulate is not forced. In the Poincaré disk straight lines are arcs meeting the rim at right angles, and a triangle's angles add up to less than 180°. On a sphere they add up to more: the octant triangle has three right angles.",
		Tags:        []string{"Poincaré disk", "sphere", "curvature"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background md:grid-cols-2"), h.Data("hyper", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b bg-code p-4 md:border-r md:border-b-0"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), "Hyperbolic plane"),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "curvature −1")),
					h.Svg(h.Data("disk", ""), h.ViewBox("-1.08 -1.08 2.16 2.16"), h.Class("mx-auto block aspect-square w-full max-w-[380px] touch-none select-none"),
						h.Role("img"), h.Aria("label", "Poincaré disk with a geodesic triangle")),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "angles"), h.Dd(h.Data("out", "h-angles"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "sum"), h.Dd(h.Data("out", "h-sum"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "area = π − sum"), h.Dd(h.Data("out", "h-area"), "—"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 bg-code p-4"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), "Sphere"),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "curvature +1 · drag to turn")),
					h.Svg(h.Data("globe", ""), h.ViewBox("-1.12 -1.12 2.24 2.24"), h.Class("mx-auto block aspect-square w-full max-w-[380px] cursor-grab touch-none select-none"),
						h.TabIndex(0), h.Role("img"), h.Aria("label", "Sphere with a geodesic triangle; arrow keys turn it")),
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border bg-background p-0.5"), h.Role("tablist"), h.Aria("label", "Spherical triangle"),
						segButton("octant", "Octant", true), segButton("small", "Small", false), segButton("wide", "Wide", false)),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "angles"), h.Dd(h.Data("out", "s-angles"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "sum"), h.Dd(h.Data("out", "s-sum"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "area = sum − π"), h.Dd(h.Data("out", "s-area"), "—"),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G9

func platonicBlock() Block {
	solids := [][2]string{{"tetra", "Tetrahedron"}, {"cube", "Cube"}, {"octa", "Octahedron"}, {"dodeca", "Dodecahedron"}, {"icosa", "Icosahedron"}}
	table := [][4]string{{"Tetrahedron", "4", "6", "4"}, {"Cube", "8", "12", "6"}, {"Octahedron", "6", "12", "8"}, {"Dodecahedron", "20", "30", "12"}, {"Icosahedron", "12", "30", "20"}}
	return Block{
		Slug:        "platonic",
		Title:       "Platonic solids",
		Description: "The only five convex solids whose faces are identical regular polygons. Vertices, edges and faces are counted from the coordinates, not typed in, and every row obeys Euler's formula V − E + F = 2. Drag to turn; the dual swaps faces and vertices.",
		Tags:        []string{"3D", "Euler's formula", "duals"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("solids",
				h.Svg(h.Data("view3d", ""), h.ViewBox("-1.6 -1.6 3.2 3.2"), h.Class("mx-auto block aspect-square w-full max-w-[460px] cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"),
					h.TabIndex(0), h.Role("img"), h.Aria("label", "Rotating Platonic solid; arrow keys turn it")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Solid"),
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Solid"),
						h.MapIdx(solids, func(i int, s [2]string) h.Node { return segButton(s[0], s[1], i == 3) }),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("sol-dual", "dual", "Show the dual", false)),
				h.Table(h.Class("w-full font-mono text-[11px]"),
					h.Thead(h.Tr(h.Class("text-left text-muted-foreground"),
						h.Th(h.Class("py-1 font-normal"), ""), h.Th(h.Class("py-1 text-right font-normal"), "V"), h.Th(h.Class("py-1 text-right font-normal"), "E"),
						h.Th(h.Class("py-1 text-right font-normal"), "F"), h.Th(h.Class("py-1 text-right font-normal"), "V−E+F"))),
					h.Tbody(h.MapIdx(table, func(i int, r [4]string) h.Node {
						return h.Tr(h.Data("solid-row", solids[i][0]), h.Class("data-[on]:text-brand"),
							h.Td(h.Class("py-0.5 font-sans"), r[0]),
							h.Td(h.Class("py-0.5 text-right tabular-nums"), h.Data("v", ""), r[1]),
							h.Td(h.Class("py-0.5 text-right tabular-nums"), h.Data("e", ""), r[2]),
							h.Td(h.Class("py-0.5 text-right tabular-nums"), h.Data("f", ""), r[3]),
							h.Td(h.Class("py-0.5 text-right tabular-nums"), h.Data("chi", ""), "2"))
					})),
				),
				h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"), "Drag, or focus and use", kbd.Group(kbd.Kbd("←"), kbd.Kbd("↑"), kbd.Kbd("→"), kbd.Kbd("↓"))),
			)
		},
	}
}

// ---------------------------------------------------------------- G10

// The proof's figure: a triangle with the parallel through C. Each piece
// lists the steps it is visible in (data-steps), so the stepper only flips
// opacity.
func angleSumProofBlock() Block {
	A, B, C := [2]float64{40, 230}, [2]float64{360, 230}, [2]float64{150, 70}
	pt := func(p [2]float64) string { return fmt.Sprintf("%.1f %.1f", p[0], p[1]) }
	piece := func(steps string, children ...any) h.Node {
		return h.El("g", append([]any{h.Data("steps", steps), h.Class("transition-opacity duration-200 ease-[var(--ease-out)] motion-reduce:transition-none")}, children...)...)
	}
	// Angle arcs (precomputed directions, radius 34).
	arc := func(c [2]float64, a1, a2 float64, color string) h.Node {
		r := 34.0
		x1, y1 := c[0]+r*cosd(a1), c[1]-r*sind(a1)
		x2, y2 := c[0]+r*cosd(a2), c[1]-r*sind(a2)
		return h.El("path", h.Attr("d", fmt.Sprintf("M%.1f %.1f L%.1f %.1f A%.0f %.0f 0 0 0 %.1f %.1f Z", c[0], c[1], x1, y1, r, r, x2, y2)),
			h.Attr("style", "fill:"+color+";fill-opacity:0.22;stroke:"+color+";stroke-width:1.5"))
	}
	dir := func(from, to [2]float64) float64 { return atan2d(-(to[1] - from[1]), to[0]-from[0]) }
	steps := []struct{ text, math string }{
		{"Take any triangle ABC, with angles α at A, β at B and γ at C.", ""},
		{"Through C draw the line parallel to AB. By the parallel postulate there is exactly one.", ""},
		{"CA cuts the two parallels, so its alternate angles are equal: the angle between CA and the parallel, on the left, is α.", "α"},
		{"In the same way CB cuts both parallels: the angle on the right is β.", "β"},
		{"At C the three angles α, γ, β fill a straight line, which is 180°. So α + β + γ = 180°.", "∎"},
	}
	return Block{
		Slug:        "angle-sum",
		Title:       "Proof, step by step",
		Description: "Why a triangle's angles add up to 180°, one move at a time. The figure shows only what the current step uses, and the colour of each angle stays the same from the step where it appears to the conclusion.",
		Tags:        []string{"proof", "stepper", "parallel postulate"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("geo-proof", ""), h.TabIndex(0),
				h.Aria("label", "Proof of the angle sum; ← and → step through it"),
				h.Svg(h.ViewBox("0 0 400 260"), h.Class("mx-auto block w-full max-w-[520px]"), h.Role("img"), h.Aria("label", "Triangle ABC with a parallel through C"),
					piece("2,3,4,5", h.El("line", h.Attr("x1", "-10"), h.Attr("y1", "70"), h.Attr("x2", "410"), h.Attr("y2", "70"),
						h.Attr("style", "stroke:var(--brand);stroke-width:1.5;stroke-dasharray:6 4"))),
					piece("1,2,3,4,5", arc(A, 0, dir(A, C), "var(--vec-i)")),
					piece("1,2,3,4,5", arc(B, dir(B, C), 180, "var(--vec-j)")),
					piece("1,2,5", arc(C, dir(C, A), dir(C, B), "var(--vec-u)")),
					piece("3,4,5", arc(C, 180, dir(C, A)+360, "var(--vec-i)")),
					piece("4,5", arc(C, dir(C, B), 0, "var(--vec-j)")),
					piece("3,4,5", arc(C, dir(C, A), dir(C, B), "var(--vec-u)")),
					h.El("path", h.Attr("d", "M"+pt(A)+" L"+pt(B)+" L"+pt(C)+" Z"), h.Attr("style", "fill:none;stroke:var(--foreground);stroke-width:2;stroke-linejoin:round")),
					h.Map([]struct {
						p    [2]float64
						name string
						dx   float64
						dy   float64
					}{{A, "A", -16, 16}, {B, "B", 8, 16}, {C, "C", -4, -12}}, func(v struct {
						p    [2]float64
						name string
						dx   float64
						dy   float64
					}) h.Node {
						return h.El("text", h.Attr("x", fmt.Sprintf("%.0f", v.p[0]+v.dx)), h.Attr("y", fmt.Sprintf("%.0f", v.p[1]+v.dy)),
							h.Class("fill-foreground font-serif text-[15px] italic"), v.name)
					}),
				),
				h.Div(h.Class("grid"),
					h.MapIdx(steps, func(i int, s struct{ text, math string }) h.Node {
						return h.P(h.Data("step-text", fmt.Sprint(i+1)), h.If(i != 0, h.Hidden()),
							h.Class("col-start-1 row-start-1 min-h-12 text-center text-[15px] leading-relaxed text-pretty"),
							h.Span(h.Class("mr-2 font-mono text-xs text-muted-foreground"), fmt.Sprintf("%d/%d", i+1, len(steps))), s.text)
					}),
				),
				h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
					h.Div(h.Class("flex items-center gap-1"), h.Aria("hidden", "true"),
						h.Range(len(steps), func(i int) h.Node {
							return h.Span(h.Data("pip", fmt.Sprint(i)), h.If(i == 0, h.Data("on", "")),
								h.Class("h-1.5 w-1.5 rounded-full bg-foreground/15 transition-[width,background-color] duration-200 ease-[var(--ease-out)] data-[on]:w-4 data-[on]:bg-brand"))
						}),
					),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
				),
			)
		},
	}
}
