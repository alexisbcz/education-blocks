package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ChaosBlocks lists the chaos and fractals gallery in display order.
func ChaosBlocks() []Block {
	return []Block{
		chaosLogisticBlock(),
		chaosBifurcationBlock(),
		chaosLorenzBlock(),
		chaosPendulumBlock(),
		chaosMandelbrotBlock(),
		chaosAttractorsBlock(),
		chaosGameBlock(),
		chaosKochBlock(),
		chaosLSystemBlock(),
		chaosAutomataBlock(),
	}
}

// chaosButton is a small outline button carrying a data-action.
func chaosButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// chaosCanvas is a canvas filling a framed box of the given aspect ratio.
func chaosCanvas(aspect, label string, extra ...any) h.Node {
	return h.Div(append([]any{h.Class("relative mx-auto w-full overflow-hidden rounded-lg border bg-background " + aspect)},
		append([]any{h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", label))}, extra...)...)...)
}

// ---------------------------------------------------------------- 1

func chaosLogisticBlock() Block {
	return Block{
		Slug:        "logistic",
		Title:       "Logistic map",
		Description: "x ↦ r·x(1 − x), the simplest equation that goes chaotic. The cobweb follows the iteration graphically; below 3 it settles on one value, then two, four, and past r ≈ 3.57 it never repeats. The readout detects the cycle.",
		Tags:        []string{"cobweb", "iteration", "period doubling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-logistic",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_1.4fr]"),
					h.Svg(h.Data("cobweb", ""), h.ViewBox("0 0 300 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Cobweb diagram")),
					h.Svg(h.Data("series", ""), h.ViewBox("0 0 420 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "x over iterations")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Map"),
					field("r", "r", "", 3.2, 0, 4, 0.001),
					field("x0", "x₀", "", 0.2, 0, 1, 0.001),
					field("n", "Iterations", "", 60, 5, 300, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"2.8", "Fixed point"}, {"3.2", "Period 2"}, {"3.5", "Period 4"}, {"3.83", "Period 3"}, {"3.9", "Chaos"}, {"4", "r = 4"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Class("justify-start font-normal"), h.Data("preset", p[0]), p[1])
						}),
					),
				),
				readouts([2]string{"behaviour", "kind"}, [2]string{"cycle", "cycle"}, [2]string{"fixed point", "fixed"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func chaosBifurcationBlock() Block {
	return Block{
		Slug:        "bifurcation",
		Title:       "Bifurcation and Lyapunov",
		Description: "Every r at once: the long-run values of the logistic map, with its Lyapunov exponent underneath (negative means stable, positive means chaos). The ratios between successive period-doubling points converge to Feigenbaum's δ ≈ 4.6692, computed here from the superstable parameters.",
		Tags:        []string{"Feigenbaum", "Lyapunov", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-bifurcation",
				h.Div(h.Class("flex flex-col gap-2"),
					chaosCanvas("aspect-[16/9]", "Bifurcation diagram of the logistic map", h.Div(h.Data("cursor", ""), h.Class("pointer-events-none absolute inset-y-0 w-px bg-[var(--brand)] opacity-0"))),
					h.Svg(h.Data("lyap", ""), h.ViewBox("0 0 640 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Lyapunov exponent against r")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Window"),
					field("rmin", "r from", "", 2.8, 0, 3.99, 0.01),
					field("rmax", "r to", "", 4, 0.01, 4, 0.01),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "zoom"), hugeicons.ZoomInAreaIcon(), "Zoom into the cascade"),
				),
				h.Div(h.Class("flex flex-col gap-1.5 border-t pt-4"),
					panelLabel("Feigenbaum δ"),
					h.Table(h.Class("w-full font-mono text-xs tabular-nums"),
						h.Thead(h.Tr(h.Class("text-left text-muted-foreground"), h.Th(h.Class("font-normal"), "n"), h.Th(h.Class("font-normal"), "Rₙ (superstable)"), h.Th(h.Class("text-right font-normal"), "ratio"))),
						h.Tbody(h.Data("feigen", "")),
					),
				),
				readouts([2]string{"r at pointer", "r"}, [2]string{"λ", "lambda"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func chaosLorenzBlock() Block {
	return Block{
		Slug:        "lorenz",
		Title:       "Lorenz attractor",
		Description: "Lorenz's 1963 convection model with σ = 10, ρ = 28, β = 8/3, integrated with RK4. Two trajectories start 10⁻⁸ apart; on the log plot their separation grows exponentially until it is as large as the attractor itself. Drag to turn it.",
		Tags:        []string{"RK4", "butterfly effect", "3D"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-lorenz",
				h.Div(h.Class("flex flex-col gap-2"),
					chaosCanvas("aspect-[4/3] cursor-grab touch-none", "Two Lorenz trajectories, drag to rotate"),
					h.Svg(h.Data("sep", ""), h.ViewBox("0 0 640 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Separation of the two trajectories, log scale")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("rho", "ρ", "", 28, 0, 60, 0.1),
					field("sigma", "σ", "", 10, 0, 30, 0.1),
					field("beta", "β", "", 2.6667, 0.1, 6, 0.0001),
					field("eps", "log₁₀ gap", "", -8, -12, -1, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Run"), chaosButton("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"time", "t"}, [2]string{"separation", "d"}, [2]string{"growth rate", "rate"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func chaosPendulumBlock() Block {
	return Block{
		Slug:        "double-pendulum",
		Title:       "Double pendulum",
		Description: "Two identical double pendulums whose upper arms start a millionth of a radian apart, integrated with RK4 from the exact equations of motion. For a few seconds they move as one, then they part ways completely. The energy readout shows the integrator holding total energy.",
		Tags:        []string{"Lagrangian", "RK4", "sensitive dependence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-pendulum",
				chaosCanvas("aspect-[4/3] max-w-[560px]", "Two double pendulums"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Start"),
					field("t1", "θ₁", "°", 120, -180, 180, 1),
					field("t2", "θ₂", "°", -10, -180, 180, 1),
					field("gap", "log₁₀ Δθ₁", "", -6, -12, -1, 1),
				),
				h.Div(h.Class("flex flex-col gap-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--brand)", "pendulum A"), legendSwatch("var(--vec-u)", "pendulum B")),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Release"), chaosButton("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"time", "t"}, [2]string{"|Δθ₁|", "d"}, [2]string{"energy drift", "drift"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func chaosMandelbrotBlock() Block {
	return Block{
		Slug:        "mandelbrot",
		Title:       "Mandelbrot and Julia",
		Description: "The set of c for which z ↦ z² + c stays bounded from z = 0. Scroll or use +/− to zoom, drag or the arrow keys to pan; click a point to see its orbit and the Julia set of that c beside it. Connected Julia sets come from c inside the Mandelbrot set.",
		Tags:        []string{"complex dynamics", "zoom", "smooth colouring"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("chaos-mandelbrot", ""),
				h.Div(h.Class("grid min-w-0 gap-3 border-b bg-code p-3 sm:grid-cols-[3fr_2fr] lg:border-r lg:border-b-0"),
					h.Div(h.Class("relative aspect-[4/3] w-full cursor-crosshair touch-none overflow-hidden rounded-lg border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), h.TabIndex(0),
						h.Data("mview", ""), h.Aria("label", "Mandelbrot set. Arrow keys pan, plus and minus zoom, Enter picks the centre."),
						h.Canvas(h.Data("mandel", ""), h.Class("absolute inset-0 size-full")),
						h.Svg(h.Data("orbit", ""), h.Class("pointer-events-none absolute inset-0 size-full"), h.Attr("preserveAspectRatio", "none")),
					),
					h.Div(h.Class("relative aspect-[4/3] w-full overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("julia", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", "Julia set for the picked c")),
						h.Span(h.Class("absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px]"), "Julia set"),
					),
				),
				h.Div(h.Class("flex flex-col gap-5 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Render"),
						field("iter", "Max iterations", "", 200, 20, 2000, 10),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						chaosButton("in", "Zoom in", hugeicons.ZoomInAreaIcon()),
						chaosButton("home", "Reset view", hugeicons.RefreshIcon()),
					),
					readouts([2]string{"centre", "centre"}, [2]string{"width", "width"}, [2]string{"picked c", "c"}, [2]string{"orbit", "orbit"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func chaosAttractorsBlock() Block {
	return Block{
		Slug:        "attractors",
		Title:       "Strange attractors",
		Description: "Fractal sets that orbits fall onto and never leave: Hénon's map (1976, a = 1.4, b = 0.3), Rössler's flow (1976, a = b = 0.2, c = 5.7) and the Clifford map. Each is drawn as a density of a few hundred thousand points.",
		Tags:        []string{"Hénon", "Rössler", "density plot"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-attractors",
				chaosCanvas("aspect-[4/3] max-w-[560px]", "Strange attractor density"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					segs("Attractor", [2]string{"henon", "Hénon"}, [2]string{"rossler", "Rössler"}, [2]string{"clifford", "Clifford"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("pa", "a", "", 1.4, -3, 3, 0.01),
					field("pb", "b", "", 0.3, -3, 3, 0.01),
				),
				readouts([2]string{"points", "n"}, [2]string{"equations", "eq"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func chaosGameBlock() Block {
	return Block{
		Slug:        "chaos-game",
		Title:       "The chaos game",
		Description: "Pick a corner of a triangle at random, jump halfway there, repeat: the random points draw the Sierpiński triangle. Change the ratio or the number of corners for other fractals, or switch to subdivision to build the same set by removing middle triangles.",
		Tags:        []string{"Sierpiński", "random iteration", "subdivision"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-game",
				chaosCanvas("aspect-square max-w-[520px]", "Points of the chaos game"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Method", [2]string{"game", "Chaos game"}, [2]string{"subdivide", "Subdivision"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rules"),
					field("corners", "Corners", "", 3, 3, 8, 1),
					field("ratio", "Jump ratio", "", 0.5, 0.1, 0.9, 0.01),
					field("depth", "Depth", "", 6, 0, 9, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Play"), chaosButton("reset", "Clear", hugeicons.Delete02Icon())),
				readouts([2]string{"points", "n"}, [2]string{"dimension", "dim"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func chaosKochBlock() Block {
	return Block{
		Slug:        "koch",
		Title:       "Koch snowflake and dimension",
		Description: "Each step replaces every segment by four segments a third as long: the perimeter grows by 4/3 forever while the area converges to 8/5 of the starting triangle. Box counting measures its dimension from the curve itself: the slope of log N(ε) against log 1/ε, against the exact log 4 / log 3.",
		Tags:        []string{"self-similarity", "box counting", "log–log fit"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-koch",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("flake", ""), h.ViewBox("0 0 400 400"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Koch snowflake with the counting grid")),
					h.Svg(h.Data("fit", ""), h.ViewBox("0 0 260 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Box counts on log–log axes")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Curve"),
					field("level", "Iterations", "", 4, 0, 7, 1),
					field("box", "Grid shown", "", 4, 1, 7, 1),
				),
				readouts([2]string{"segments", "segs"}, [2]string{"perimeter", "per"}, [2]string{"area", "area"}, [2]string{"box-count slope", "slope"}, [2]string{"exact", "exact"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func chaosLSystemBlock() Block {
	return Block{
		Slug:        "l-system",
		Title:       "L-systems",
		Description: "Lindenmayer's rewriting systems (1968): every symbol is replaced by its rule at once, then a turtle reads the string (F draws, + and − turn, [ ] save and restore). Edit the rules or start from a plant, the dragon curve, Hilbert's curve or Koch's island.",
		Tags:        []string{"grammar", "turtle graphics", "plants"},
		Wide:        true,
		Render: func() h.Node {
			input := func(name, label, value string) h.Node {
				return h.Label(h.Class("flex flex-col gap-1 text-xs text-muted-foreground"), label,
					h.Input(h.Type("text"), h.Data("lsys", name), h.Value(value), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"),
						h.Class("h-9 rounded-md border border-input bg-background px-2 font-mono text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")))
			}
			return plotPanel("chaos-lsystem",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 420"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "L-system drawing")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"plant", "Fractal plant"}, {"dragon", "Dragon curve"}, {"hilbert", "Hilbert curve"}, {"koch", "Koch island"}, {"sierpinski", "Arrowhead"}, {"bush", "Bush"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Class("justify-start font-normal"), h.Data("lpreset", p[0]), p[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Grammar"),
					input("axiom", "Axiom", "X"),
					input("rule1", "Rule 1", "X=F+[[X]-X]-F[-FX]+X"),
					input("rule2", "Rule 2", "F=FF"),
					field("angle", "Angle", "°", 25, 1, 180, 0.5),
					field("gen", "Generations", "", 5, 0, 12, 1),
				),
				readouts([2]string{"symbols", "len"}, [2]string{"segments", "segs"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func chaosAutomataBlock() Block {
	return Block{
		Slug:        "automata",
		Title:       "Cellular automata",
		Description: "Simple local rules, complex global behaviour. Elementary automata: each cell looks at itself and its two neighbours, and the rule number's 8 bits say what comes next (Rule 30 looks random, Rule 110 is Turing complete). Conway's Game of Life (1970): click cells, or drop in a glider or Gosper's gun.",
		Tags:        []string{"Wolfram rules", "Game of Life", "emergence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("chaos-automata",
				chaosCanvas("aspect-[3/2] cursor-pointer touch-none", "Cellular automaton grid"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Automaton"),
					segs("Automaton", [2]string{"elementary", "Elementary"}, [2]string{"life", "Game of Life"}),
				),
				h.Div(h.Data("mode", "elementary"), h.Class("flex flex-col gap-2"),
					field("rule", "Rule", "", 30, 0, 255, 1),
					h.Div(h.Data("bits", ""), h.Class("grid grid-cols-8 gap-1"), h.Aria("label", "The rule's eight cases")),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"),
						h.Map([]string{"30", "90", "110"}, func(r string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("rule", r), "Rule "+r)
						}),
					),
				),
				h.Div(h.Data("mode", "life"), h.Hidden(), h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"glider", "Glider"}, {"gun", "Gosper gun"}, {"rpent", "R-pentomino"}, {"random", "Random"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Class("justify-start font-normal"), h.Data("pattern", p[0]), p[1])
						}),
					),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"),
						playPauseLabel("Run"),
						chaosButton("step", "Step", hugeicons.NextIcon()),
						chaosButton("clear", "Clear", hugeicons.Delete02Icon()),
					),
				),
				readouts([2]string{"generation", "gen"}, [2]string{"live cells", "live"}),
			)
		},
	}
}
