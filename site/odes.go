package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// OdesBlocks lists the differential equations gallery in display order.
// Phase portraits, bifurcation diagrams and PDE solutions are computed in
// the page: exact formulas where they exist, RK4 elsewhere.
func OdesBlocks() []Block {
	return []Block{
		odeTraceDetBlock(),
		odeNullclineBlock(),
		odeBifurcationBlock(),
		odeHopfBlock(),
		odeResonanceBlock(),
		odeLaplaceBlock(),
		odeFirstOrderBlock(),
		odeUniquenessBlock(),
		odeHeatBlock(),
		odeWaveBlock(),
	}
}

// odeSVG is a plot surface; odes.js draws into it.
func odeSVG(name, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[720px] select-none touch-none"),
		h.Role("img"), h.Aria("label", label)}, extra...)...)
}

func odeButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func odePlay() h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), "Play"))
}

func odeLegend(keys ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(keys, func(k [2]string) h.Node { return legendSwatch(k[0], k[1]) }),
	)
}

func odeNote(name string) h.Node {
	return h.P(h.Data("out", name), h.Class("text-xs leading-relaxed text-pretty text-muted-foreground"))
}

// odeInput is a one-line text input for an expression.
func odeInput(name, label, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1 text-sm"),
		h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), label),
		h.Input(h.Type("text"), h.Data("expr", name), h.Value(value), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
			h.Aria("label", label),
			h.Class("h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-[var(--code-del)]")),
	)
}

// ---------------------------------------------------------------- 1

func odeTraceDetBlock() Block {
	return Block{
		Slug:        "trace-determinant",
		Title:       "The trace–determinant plane",
		Description: "Every 2×2 linear system x′ = Ax is decided by two numbers: the trace τ (the sum of the eigenvalues) and the determinant Δ (their product). Drag the point across the plane and the phase portrait on the right changes type at the boundaries: saddles below the axis, nodes outside the parabola Δ = τ²/4, spirals inside it, centres on the line τ = 0.",
		Tags:        []string{"eigenvalues", "phase portrait", "stability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-tracedet",
				odeSVG("main", "0 0 720 340", "Trace–determinant plane with a draggable point, and the phase portrait of the matching system"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					field("tr", "trace τ", "", -1, -4, 4, 0.05),
					field("det", "determinant Δ", "", 2, -3, 5, 0.05),
				),
				h.P(h.Class("text-xs text-muted-foreground"), "Drag the point, or focus the plane and use the arrow keys (Shift: finer)."),
				odeLegend([2]string{"var(--vec-i)", "eigenvector"}, [2]string{"var(--brand)", "τ, Δ"}),
				readouts([2]string{"matrix A", "mat"}, [2]string{"eigenvalues", "eig"}, [2]string{"τ² − 4Δ", "disc"}, [2]string{"type", "type"}),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func odeNullclineBlock() Block {
	return Block{
		Slug:        "nullclines",
		Title:       "Nullclines and linearisation",
		Description: "For a nonlinear system x′ = f(x, y), y′ = g(x, y), the curves f = 0 and g = 0 cut the plane into regions where the flow points one way. Equilibria sit where they cross. At each one, the Jacobian gives a linear system whose type (by the trace–determinant test) is the local picture, unless it lands on a boundary. Click the plane to release a trajectory.",
		Tags:        []string{"nullclines", "Jacobian", "competing species"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-nullcline",
				odeSVG("main", "0 0 560 400", "Phase plane with nullclines, equilibria and trajectories"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					segs("Preset", [2]string{"compete", "Competition"}, [2]string{"coexist", "Coexistence"}, [2]string{"pendulum", "Damped pendulum"}, [2]string{"own", "Your own"}),
					odeInput("f", "x′ = f(x, y)", "x*(3 - x - 2*y)"),
					odeInput("g", "y′ = g(x, y)", "y*(2 - x - y)"),
					h.P(h.Data("out", "err"), h.Aria("live", "polite"), h.Class("min-h-4 font-mono text-[11px] text-[var(--code-del)]")),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					odeButton("clear", "Clear trajectories", hugeicons.Delete02Icon(h.Class("size-4"))),
				),
				odeLegend([2]string{"var(--vec-j)", "f = 0"}, [2]string{"var(--vec-u)", "g = 0"}, [2]string{"var(--brand)", "trajectory"}),
				h.Div(h.Data("out", "eqs"), h.Class("flex flex-col gap-1.5 border-t pt-4 font-mono text-xs")),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func odeBifurcationBlock() Block {
	return Block{
		Slug:        "bifurcations",
		Title:       "Bifurcations on a line",
		Description: "In one dimension x′ = f(x, r), equilibria are the roots of f, and they are stable where f slopes down. As the parameter r moves, equilibria are born, collide, swap stability or split. The diagram plots every equilibrium against r (solid stable, dashed unstable); the phase line on the right is the slice at the current r.",
		Tags:        []string{"saddle-node", "pitchfork", "hysteresis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-bif",
				odeSVG("main", "0 0 640 340", "Bifurcation diagram and the phase line at the current parameter"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Normal form"),
					segs("Normal form", [2]string{"sn", "Saddle-node"}, [2]string{"tc", "Transcritical"}, [2]string{"pf", "Pitchfork"}, [2]string{"sub", "Subcritical"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameter"),
					field("r", "r", "", -0.5, -2, 2, 0.01),
					odePlay(),
				),
				odeLegend([2]string{"var(--vec-v)", "stable"}, [2]string{"var(--vec-j)", "unstable"}, [2]string{"var(--brand)", "current r"}),
				readouts([2]string{"equation", "eq"}, [2]string{"equilibria", "eqs"}, [2]string{"stable", "stable"}),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func odeHopfBlock() Block {
	return Block{
		Slug:        "hopf",
		Title:       "Hopf bifurcation and limit cycles",
		Description: "When a pair of complex eigenvalues crosses the imaginary axis, a stable spiral can turn into an unstable one surrounded by a closed orbit: a limit cycle that every nearby trajectory approaches. In the normal form r′ = μr − r³ the cycle has radius √μ; the Van der Pol oscillator shows a cycle shaped by strong nonlinearity.",
		Tags:        []string{"limit cycle", "Van der Pol", "oscillation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-hopf",
				odeSVG("main", "0 0 640 340", "Phase plane with trajectories approaching a limit cycle, and cycle amplitude against the parameter"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					segs("System", [2]string{"normal", "Normal form"}, [2]string{"vdp", "Van der Pol"}),
					field("mu", "μ", "", 0.5, -1, 3, 0.01),
					odePlay(),
				),
				odeLegend([2]string{"var(--vec-i)", "from inside"}, [2]string{"var(--vec-u)", "from outside"}, [2]string{"var(--brand)", "limit cycle"}),
				readouts([2]string{"equations", "eq"}, [2]string{"origin", "origin"}, [2]string{"cycle radius", "amp"}, [2]string{"√μ", "theory"}, [2]string{"period", "period"}),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func odeResonanceBlock() Block {
	return Block{
		Slug:        "resonance",
		Title:       "Forced oscillations and resonance",
		Description: "x″ + 2ζω₀x′ + ω₀²x = cos ωt. The response is a transient that decays at the rate ζω₀ plus a steady state at the driving frequency, with amplitude 1/√((ω₀² − ω²)² + (2ζω₀ω)²) and a phase lag that passes 90° at ω₀. With little damping the peak is tall and sharp; with none, driving near ω₀ produces beats.",
		Tags:        []string{"resonance", "phase lag", "beats"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-res",
				odeSVG("main", "0 0 720 380", "Amplitude and phase response curves, and the time response split into transient and steady state"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Oscillator, natural frequency 1"),
					field("zeta", "damping ζ", "", 0.1, 0, 1.5, 0.01),
					field("w", "drive ω", "", 0.9, 0.05, 3, 0.01),
				),
				odeLegend([2]string{"var(--brand)", "x(t)"}, [2]string{"var(--vec-v)", "steady state"}, [2]string{"var(--vec-u)", "transient"}),
				readouts([2]string{"amplitude", "amp"}, [2]string{"phase lag", "phase"}, [2]string{"peak at ω", "peak"}, [2]string{"peak gain", "gain"}, [2]string{"decay time", "decay"}),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func odeLaplaceBlock() Block {
	return Block{
		Slug:        "laplace",
		Title:       "Solving with the Laplace transform",
		Description: "y″ + a y′ + b y = forcing, with y(0) and y′(0) given. The transform turns derivatives into powers of s and folds the initial values in, so the ODE becomes algebra. Solve for Y(s), split it into partial fractions, and read each term back from the table. The poles of Y(s) in the s-plane are the exponents of the answer: their real parts decide growth or decay, their imaginary parts the oscillation.",
		Tags:        []string{"Laplace transform", "partial fractions", "poles"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-laplace",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Ol(h.Data("out", "steps"), h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed")),
					odeSVG("main", "0 0 720 260", "Poles in the s-plane and the solution y(t), checked against a numerical solution"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Equation"),
					field("a", "a", "", 3, -2, 6, 0.1),
					field("b", "b", "", 2, 0.1, 12, 0.1),
					segs("Forcing", [2]string{"step", "Step u(t)"}, [2]string{"impulse", "Impulse δ(t)"}, [2]string{"none", "None"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Initial values"),
					field("y0", "y(0)", "", 0, -2, 2, 0.1),
					field("v0", "y′(0)", "", 0, -2, 2, 0.1),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					odeButton("preset", "y″ + 3y′ + 2y = u(t)", hugeicons.RefreshIcon(h.Class("size-4"))),
				),
				odeLegend([2]string{"var(--brand)", "formula"}, [2]string{"var(--vec-v)", "RK4 check"}),
				readouts([2]string{"poles", "poles"}, [2]string{"max |formula − RK4|", "check"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func odeFirstOrderBlock() Block {
	return Block{
		Slug:        "first-order",
		Title:       "Separable and linear first-order equations",
		Description: "A first-order equation has a family of solutions, one for each constant of integration. Separating variables or multiplying by an integrating factor gives the whole family in closed form; an initial condition picks one member. Click the plane to set (t₀, y₀) and watch the constant C get solved for.",
		Tags:        []string{"separation of variables", "integrating factor", "initial value problem"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-first",
				odeSVG("main", "0 0 560 380", "Solution family of the chosen equation, with the solution through a clicked point highlighted"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Equation"),
					segs("Equation", [2]string{"growth", "y′ = 0.5y"}, [2]string{"gauss", "y′ = −ty"}, [2]string{"logistic", "y′ = y(1 − y)"}, [2]string{"linear", "y′ + y = t"}, [2]string{"circle", "y′ = −t/y"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Initial point"),
					field("t0", "t₀", "", 0, -3, 3, 0.05),
					field("y0", "y₀", "", 1, -3, 3, 0.05),
				),
				h.Ol(h.Data("out", "steps"), h.Class("flex list-decimal flex-col gap-1.5 border-t pt-4 pl-4 font-mono text-xs leading-relaxed")),
				readouts([2]string{"C", "c"}, [2]string{"solution", "sol"}, [2]string{"defined for", "dom"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func odeUniquenessBlock() Block {
	return Block{
		Slug:        "existence-uniqueness",
		Title:       "When solutions fail to be unique, or to exist",
		Description: "Picard–Lindelöf guarantees exactly one solution near t₀ when f is continuous and Lipschitz in y. Drop the Lipschitz condition and y′ = √|y| from y(0) = 0 has infinitely many solutions: rest for any time c, then lift off. Keep it only locally and y′ = y² is fine near the start but its solution runs to infinity at the finite time 1/y₀.",
		Tags:        []string{"Picard–Lindelöf", "Lipschitz", "blow-up"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-unique",
				odeSVG("main", "0 0 560 360", "Solutions of the chosen equation"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Equation"),
					segs("Equation", [2]string{"sqrt", "y′ = √|y|"}, [2]string{"square", "y′ = y²"}),
				),
				h.Div(h.Data("view", "sqrt"), h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Lift-off time"),
					field("c", "c", "", 1, 0, 4, 0.05),
				),
				h.Div(h.Data("view", "square"), h.Hidden(), h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Initial value"),
					field("y0", "y(0)", "", 0.5, 0.1, 2, 0.05),
				),
				odeLegend([2]string{"var(--brand)", "chosen solution"}, [2]string{"var(--vec-u)", "RK4 attempt"}),
				readouts([2]string{"solution", "sol"}, [2]string{"Lipschitz near y = 0", "lip"}, [2]string{"special time", "tstar"}),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func odeHeatBlock() Block {
	return Block{
		Slug:        "heat-equation",
		Title:       "The heat equation on a rod",
		Description: "u_t = k u_xx on 0 ≤ x ≤ 1 with both ends held at 0. Write the initial temperature as a sine series Σ bₙ sin nπx; each mode then decays on its own as e^(−n²π²kt). High modes die first, so corners smooth out at once and the profile ends as a single sine arch. Draw your own initial profile on the rod.",
		Tags:        []string{"Fourier sine series", "diffusion", "separation of variables"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-heat",
				odeSVG("main", "0 0 720 340", "Temperature along the rod over time, and the size of each sine mode"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Initial profile"),
					segs("Profile", [2]string{"tri", "Triangle"}, [2]string{"step", "Block"}, [2]string{"two", "Two bumps"}, [2]string{"draw", "Draw"}),
					h.P(h.Class("text-xs text-muted-foreground"), "Drag on the rod to draw a profile."),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Time"),
					field("k", "diffusivity k", "", 0.05, 0.01, 0.5, 0.01),
					field("t", "t", "", 0, 0, 5, 0.01),
					odePlay(),
				),
				odeLegend([2]string{"var(--vec-v)", "u(x, 0)"}, [2]string{"var(--brand)", "u(x, t)"}),
				readouts([2]string{"modes kept", "modes"}, [2]string{"slowest rate π²k", "rate"}, [2]string{"peak u", "peak"}, [2]string{"mode 3 left", "m3"}),
				odeNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func odeWaveBlock() Block {
	return Block{
		Slug:        "wave-equation",
		Title:       "A plucked string",
		Description: "u_tt = c² u_xx with fixed ends. A string plucked at p and released is a sum of standing waves bₙ sin nπx cos nπct, and also, by d'Alembert, two copies of the initial shape travelling left and right and reflecting upside down at the ends. Pluck at 1/n of the length and every n-th harmonic vanishes.",
		Tags:        []string{"standing waves", "d'Alembert", "harmonics"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ode-wave",
				odeSVG("main", "0 0 720 340", "Displacement of the string, its two travelling halves, and the harmonic amplitudes"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pluck"),
					field("p", "pluck at p", "", 0.3, 0.05, 0.95, 0.01),
					field("t", "time ct", "", 0, 0, 2, 0.005),
					odePlay(),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Show"),
					toggle("ode-wave-halves", "halves", "Travelling halves", true),
				),
				odeLegend([2]string{"var(--brand)", "u(x, t)"}, [2]string{"var(--vec-i)", "right-moving"}, [2]string{"var(--vec-u)", "left-moving"}),
				readouts([2]string{"b₁, b₂, b₃", "b"}, [2]string{"missing harmonics", "missing"}, [2]string{"period", "period"}),
				odeNote("note"),
			)
		},
	}
}
