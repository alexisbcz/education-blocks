package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// OptimizationBlocks lists the optimization gallery in display order.
func OptimizationBlocks() []Block {
	return []Block{
		optmLPBlock(),
		optmSimplexBlock(),
		optmBranchBoundBlock(),
		optmLagrangeBlock(),
		optmNewtonBlock(),
		optmAnnealBlock(),
		optmDPBlock(),
		optmRegularBlock(),
		optmParetoBlock(),
		optmFlowBlock(),
	}
}

// optmButton is an outline action button with an icon.
func optmButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// optmStepper is Back / Next with a position readout, for the step-through blocks.
func optmStepper() h.Node {
	return h.Div(h.Class("flex items-center justify-between gap-2"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "back"), hugeicons.ArrowLeft01Icon(), "Back"),
		h.Span(h.Data("out", "step"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), "Next", hugeicons.ArrowRight01Icon()),
	)
}

// ---------------------------------------------------------------- O1

func optmLPBlock() Block {
	return Block{
		Slug:        "linear-program",
		Title:       "Linear programming in 2D",
		Description: "Every constraint is a half-plane; together they cut out the feasible polygon. Slide the objective's direction and watch the optimum jump from vertex to vertex: a linear program is always solved at a corner. Vertices are computed in exact fractions.",
		Tags:        []string{"LP", "feasible region", "exact"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-lp",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 400"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Feasible region and objective line")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Maximise c₁x + c₂y"),
					field("c1", "c₁", "", 3, -10, 10, 1),
					field("c2", "c₂", "", 5, -10, 10, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Constraint 3: a x + b y ≤ r"),
					field("a3", "a", "", 3, 0, 10, 1),
					field("b3", "b", "", 2, 0, 10, 1),
					field("r3", "r", "", 18, 1, 40, 1),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Also x ≤ 4, 2y ≤ 12, x ≥ 0, y ≥ 0 (Hillier & Lieberman's Wyndor Glass example)."),
				readouts([2]string{"optimum", "opt"}, [2]string{"value", "val"}, [2]string{"vertices", "nv"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O2

func optmSimplexBlock() Block {
	return Block{
		Slug:        "simplex",
		Title:       "Simplex tableau",
		Description: "The same problem solved the way computers do: start at the origin, pick the column that improves the objective most, use the ratio test to find which constraint stops you, pivot. Every entry is an exact fraction.",
		Tags:        []string{"simplex", "pivots", "fractions"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("optm-simplex", ""),
				h.Div(h.Class("scroll-thin min-w-0 overflow-x-auto border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Div(h.Data("tableau", ""), h.Class("font-mono text-[13px]")),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					optmStepper(),
					h.P(h.Data("out", "explain"), h.Aria("live", "polite"), h.Class("min-h-24 text-sm leading-relaxed text-muted-foreground")),
					readouts([2]string{"basis", "basis"}, [2]string{"objective", "z"}, [2]string{"vertex", "vertex"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- O3

func optmBranchBoundBlock() Block {
	return Block{
		Slug:        "branch-and-bound",
		Title:       "Branch and bound",
		Description: "A 0/1 knapsack solved exactly by splitting on one item at a time. Each node's bound comes from the fractional (LP) relaxation, so whole subtrees whose bound can't beat the best answer so far are pruned without being explored.",
		Tags:        []string{"integer programming", "knapsack", "tree"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("optm-bnb", ""),
				h.Div(h.Class("scroll-thin min-w-0 overflow-x-auto border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("tree", ""), h.ViewBox("0 0 720 360"), h.Class("block w-full min-w-[560px]"), h.Role("img"), h.Aria("label", "Branch and bound tree")),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Data("items", ""), h.Class("font-mono text-xs")),
					field("cap", "Capacity", "kg", 10, 1, 25, 1),
					optmStepper(),
					optmButton("all", hugeicons.PlayIcon(), "Solve to the end"),
					h.P(h.Data("out", "explain"), h.Aria("live", "polite"), h.Class("min-h-16 text-sm leading-relaxed text-muted-foreground")),
					readouts([2]string{"best", "best"}, [2]string{"nodes", "nodes"}, [2]string{"pruned", "pruned"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- O4

func optmLagrangeBlock() Block {
	return Block{
		Slug:        "lagrange",
		Title:       "Lagrange multipliers",
		Description: "Optimise f along a constraint g = c. At the optimum the level curve of f just touches the constraint, so their gradients are parallel: ∇f = λ∇g. Drag the point along the constraint and watch the two arrows line up.",
		Tags:        []string{"constrained", "gradients", "level sets"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-lagrange",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 440 400"), h.Class("mx-auto block w-full max-w-[520px] touch-none select-none"), h.Role("img"), h.Aria("label", "Level sets of f and the constraint curve")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Problem"),
					segs("Problem", [2]string{"xy", "max xy, x + y = c"}, [2]string{"circle", "max x + 2y, x² + y² = c"}, [2]string{"dist", "min x² + y², xy = c"}),
					field("c", "c", "", 10, 1, 16, 0.5),
					field("t", "Point on curve", "", 0.3, 0, 1, 0.005),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--brand)", "∇f"), legendSwatch("var(--vec-u)", "∇g"), legendSwatch("var(--foreground)", "g = c")),
				readouts([2]string{"point", "pt"}, [2]string{"f", "f"}, [2]string{"angle ∇f, ∇g", "ang"}, [2]string{"optimum", "opt"}, [2]string{"λ", "lam"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O5

func optmNewtonBlock() Block {
	return Block{
		Slug:        "newton-vs-gradient",
		Title:       "Newton versus gradient descent",
		Description: "Both methods on the Rosenbrock function, both with Armijo backtracking line search. Gradient descent only sees the slope: from this start one long backtracked step lands near the valley floor, then it crawls along it for thousands of tiny steps. Newton's method also uses curvature (the Hessian) and reaches the minimum at (1, 1) in about twenty.",
		Tags:        []string{"second order", "line search", "Rosenbrock"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-newton",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 480 380"), h.Class("mx-auto block w-full max-w-[560px] cursor-crosshair"), h.Role("img"), h.Aria("label", "Rosenbrock contours with both paths. Click to move the start.")),
					h.Svg(h.Data("conv", ""), h.ViewBox("0 0 480 120"), h.Class("mx-auto block w-full max-w-[560px]"), h.Role("img"), h.Aria("label", "Error per iteration on a log scale")),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "gradient descent"), legendSwatch("var(--brand)", "Newton")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Line search"),
					field("c1exp", "Armijo c = 10^", "", -4, -6, -1, 1),
					field("tolexp", "Stop at |∇f| < 10^", "", -4, -8, -2, 1),
				),
				h.P(h.Class("text-xs text-muted-foreground"), "Click the plot to choose the starting point."),
				readouts([2]string{"GD iterations", "gd"}, [2]string{"Newton iter.", "nt"}, [2]string{"GD end", "gdx"}, [2]string{"Newton end", "ntx"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O6

func optmAnnealBlock() Block {
	return Block{
		Slug:        "simulated-annealing",
		Title:       "Simulated annealing on a tour",
		Description: "A travelling salesman tour over 25 seeded cities, improved by 2-opt moves (reverse a stretch of the tour). Annealing also accepts worse moves with probability e^(−Δ/T), which lets it escape local minima while the temperature is high, then cools into a good tour.",
		Tags:        []string{"metaheuristic", "TSP", "2-opt"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-anneal",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 440 360"), h.Class("mx-auto block w-full max-w-[520px]"), h.Role("img"), h.Aria("label", "Cities and the current tour")),
					h.Svg(h.Data("hist", ""), h.ViewBox("0 0 440 110"), h.Class("mx-auto block w-full max-w-[520px]"), h.Role("img"), h.Aria("label", "Tour length and temperature over time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Schedule"),
					field("t0", "Start T", "", 40, 0, 200, 1),
					field("alpha", "Cooling ×", "", 0.995, 0.9, 0.9999, 0.0005),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					playPause(),
					optmButton("reseed", hugeicons.ShuffleIcon(), "New cities"),
					optmButton("greedy", hugeicons.Route01Icon(), "Greedy only"),
					optmButton("reset", hugeicons.RefreshIcon(), "Restart"),
				),
				readouts([2]string{"length", "len"}, [2]string{"best", "best"}, [2]string{"greedy + 2-opt", "greedy"}, [2]string{"temperature", "temp"}, [2]string{"moves", "moves"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O7

var optmProjects = []struct {
	name    string
	returns []int // return for 0..4 units
}{
	{"Lab", []int{0, 4, 6, 7, 7}},
	{"Library", []int{0, 2, 5, 8, 9}},
	{"Outreach", []int{0, 3, 5, 6, 8}},
}

func optmDPBlock() Block {
	return Block{
		Slug:        "resource-allocation",
		Title:       "Dynamic programming: allocating a budget",
		Description: "Split a budget of whole units between three projects with diminishing returns. Dynamic programming solves it stage by stage: the best value for the last k projects with b units left is stored and reused, so no allocation is ever evaluated twice.",
		Tags:        []string{"DP", "Bellman", "stages"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5"), h.Data("optm-dp", ""),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					h.Table(h.Class("w-full min-w-[420px] font-mono text-xs"),
						h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
							h.Th(h.Class("py-1.5 pr-3 font-normal"), "units →"),
							h.Map([]int{0, 1, 2, 3, 4}, func(u int) h.Node { return h.Th(h.Class("py-1.5 pr-3 text-right font-normal"), fmt.Sprint(u)) }),
						)),
						h.Tbody(h.Map(optmProjects, func(p struct {
							name    string
							returns []int
						}) h.Node {
							return h.Tr(h.Class("border-b last:border-b-0"),
								h.Td(h.Class("py-1.5 pr-3 font-sans text-sm"), p.name),
								h.Map(p.returns, func(r int) h.Node { return h.Td(h.Class("py-1.5 pr-3 text-right tabular-nums"), fmt.Sprint(r)) }),
							)
						})),
					),
				),
				h.Div(h.Class("w-64"), field("budget", "Budget", "units", 4, 0, 8, 1)),
				h.Div(h.Data("table", ""), h.Class("scroll-thin overflow-x-auto")),
				optmStepper(),
				h.P(h.Data("out", "explain"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground")),
				h.P(h.Data("out", "answer"), h.Class("font-mono text-sm")),
			)
		},
	}
}

// ---------------------------------------------------------------- O8

func optmRegularBlock() Block {
	return Block{
		Slug:        "regularization-paths",
		Title:       "Ridge and lasso paths",
		Description: "Least squares with a penalty on the coefficients. As λ grows, ridge (squared penalty) shrinks every coefficient smoothly toward zero; lasso (absolute-value penalty) sets them exactly to zero one by one, which is why it selects features. Synthetic data with three real effects among six features.",
		Tags:        []string{"ridge", "lasso", "sparsity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-reg",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 340"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Coefficient paths against log lambda")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Penalty"),
					segs("Penalty", [2]string{"lasso", "Lasso (L1)"}, [2]string{"ridge", "Ridge (L2)"}),
					field("loglam", "log₁₀ λ", "", -1, -3, 1, 0.05),
				),
				h.Div(h.Data("coefs", ""), h.Class("flex flex-col gap-1 font-mono text-xs")),
				readouts([2]string{"non-zero", "nz"}, [2]string{"train MSE", "mse"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O9

func optmParetoBlock() Block {
	return Block{
		Slug:        "pareto-front",
		Title:       "Pareto front",
		Description: "Forty seeded design options, each with a cost and a delivery time, both to minimise. An option is on the Pareto front if no other option beats it on both. Weighted sums w·cost + (1−w)·time can only ever pick points on the front's convex hull; the others need another method.",
		Tags:        []string{"multi-objective", "dominance", "trade-off"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-pareto",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 500 380"), h.Class("mx-auto block w-full max-w-[600px]"), h.Role("img"), h.Aria("label", "Options by cost and time with the Pareto front")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Weighted sum"),
					field("w", "Weight on cost", "", 0.5, 0, 1, 0.01),
				),
				optmButton("reseed", hugeicons.ShuffleIcon(), "New options"),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Pink: on the front. Ringed: front points no weighted sum can select (they sit inside the hull)."),
				readouts([2]string{"on the front", "front"}, [2]string{"unsupported", "unsup"}, [2]string{"weighted pick", "pick"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O10

func optmFlowBlock() Block {
	return Block{
		Slug:        "max-flow",
		Title:       "Maximum flow, minimum cut",
		Description: "Edmonds–Karp pushes flow along the shortest augmenting path until none is left. The vertices it can still reach then form one side of a cut whose capacity equals the flow: the max-flow min-cut theorem. Click an edge to change its capacity.",
		Tags:        []string{"networks", "Edmonds–Karp", "duality"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("optm-flow",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px] select-none"), h.Role("img"), h.Aria("label", "Flow network")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Selected edge"),
					h.P(h.Data("out", "edge"), h.Class("font-mono text-xs text-muted-foreground"), "Click an edge"),
					field("cap", "Capacity", "", 10, 0, 30, 1),
				),
				optmStepper(),
				h.P(h.Data("out", "explain"), h.Aria("live", "polite"), h.Class("min-h-12 text-sm leading-relaxed text-muted-foreground")),
				h.P(h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"), "Keys", kbd.Kbd("←"), kbd.Kbd("→"), "step the augmenting paths."),
				readouts([2]string{"flow", "flow"}, [2]string{"min cut", "cut"}, [2]string{"paths", "paths"}),
			)
		},
	}
}
