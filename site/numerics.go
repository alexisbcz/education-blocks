package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NumericsBlocks lists the numerical methods gallery in display order.
// Every block measures what it claims: errors are computed against exact
// values, and convergence orders are fitted from the iterates themselves.
func NumericsBlocks() []Block {
	return []Block{
		numCancelBlock(),
		numSumBlock(),
		numCondBlock(),
		numRootsBlock(),
		numInterpBlock(),
		numDiffBlock(),
		numQuadBlock(),
		numODEBlock(),
		numStiffBlock(),
		numPoissonBlock(),
	}
}

// numSVG is a plot surface; numerics.js draws into it.
func numSVG(name, viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[640px] select-none"),
		h.Role("img"), h.Aria("label", label))
}

func numButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// numLegend is a row of colour keys under a plot.
func numLegend(keys ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(keys, func(k [2]string) h.Node { return legendSwatch(k[0], k[1]) }),
	)
}

// numNote is the small explanatory line under the readouts.
func numNote(name string) h.Node {
	return h.P(h.Data("out", name), h.Class("text-xs leading-relaxed text-pretty text-muted-foreground"))
}

// numWithCode stacks a live panel over the Python it implements.
func numWithCode(panel h.Node, path, src string, hl ...int) h.Node {
	return h.Div(h.Class("flex flex-col gap-4"), panel, codeBlock(path, src, hl))
}

// ---------------------------------------------------------------- 1

func numCancelBlock() Block {
	return Block{
		Slug:        "cancellation",
		Title:       "Catastrophic cancellation",
		Description: "Subtracting two nearly equal numbers keeps their rounding errors and throws away their agreeing digits. The same quantity written two ways can be accurate or worthless: the plot measures the relative error of each form against a correctly rounded reference, in double precision, as the input shrinks.",
		Tags:        []string{"floating point", "relative error", "rewriting formulas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("numx-cancel",
				numSVG("main", "0 0 560 320", "Relative error of the naive and stable formulas against the input, log-log"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Quantity"),
					segs("Quantity", [2]string{"cos", "(1 − cos x)/x²"}, [2]string{"sqrt", "√(x+1) − √x"}, [2]string{"quad", "root of t² − 2bt + 1"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Probe"),
					field("e", "input = 10^e, e", "", -6, -15, 15, 0.1),
				),
				numLegend([2]string{"var(--vec-j)", "naive"}, [2]string{"var(--vec-u)", "rewritten"}),
				readouts([2]string{"formula", "form"}, [2]string{"naive", "naive"}, [2]string{"rewritten", "stable"}, [2]string{"reference", "ref"}, [2]string{"correct digits", "digits"}),
				numNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

const numKahanPy = `def kahan_sum(xs):
    s = 0.0
    c = 0.0                 # the low-order bits lost so far
    for x in xs:
        y = x - c           # add back what was lost last time
        t = s + y           # big + small: the small part's tail is rounded off
        c = (t - s) - y     # recover exactly what was rounded off
        s = t
    return s`

func numSumBlock() Block {
	return Block{
		Slug:        "summation",
		Title:       "Summing a million numbers",
		Description: "Adding numbers one by one rounds after every addition, and the errors pile up roughly in proportion to n. Pairwise summation (what NumPy does) grows like log n, and Kahan's compensated sum carries the lost bits along so its error stays near one rounding. Errors are measured against the exact sum of the doubles, rounded once, from Shewchuk's error-free algorithm (the one behind Python's math.fsum).",
		Tags:        []string{"rounding", "Kahan", "pairwise", "exact reference"},
		Wide:        true,
		Render: func() h.Node {
			return numWithCode(plotPanel("numx-sum",
				numSVG("main", "0 0 560 320", "Absolute error of each summation method against the number of terms, log-log"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Data"),
					segs("Data", [2]string{"tenth", "0.1, 0.1, …"}, [2]string{"uniform", "random in [0, 1)"}, [2]string{"harmonic", "1/k"}, [2]string{"mixed", "± mixed scales"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Size"),
					field("p", "n = 10^p", "", 6, 2, 6.5, 0.5),
				),
				h.Div(h.Class("flex gap-2"), numButton("reseed", "New numbers", hugeicons.RefreshIcon())),
				numLegend([2]string{"var(--vec-j)", "naive loop"}, [2]string{"var(--vec-out)", "pairwise"}, [2]string{"var(--vec-u)", "Kahan"}),
				readouts([2]string{"exact sum", "exact"}, [2]string{"naive error", "naive"}, [2]string{"pairwise error", "pair"}, [2]string{"Kahan error", "kahan"}, [2]string{"1 ulp of sum", "ulp"}),
			), "numerics/kahan.py", numKahanPy, 5, 6, 7)
		},
	}
}

// ---------------------------------------------------------------- 3

func numCondBlock() Block {
	return Block{
		Slug:        "conditioning",
		Title:       "Condition number and the Hilbert matrix",
		Description: "Solve Hx = b where H is the Hilbert matrix, Hᵢⱼ = 1/(i+j−1), and x is all ones. Gaussian elimination with partial pivoting is backward stable, yet the answer loses about log₁₀ κ digits, because the problem itself amplifies the rounding of b by the condition number κ. κ here is exact: Hilbert matrices have an integer inverse with a closed form.",
		Tags:        []string{"conditioning", "stability", "κ(A)", "digits lost"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("numx-cond",
				h.Div(h.Class("flex flex-col gap-2"),
					numSVG("main", "0 0 560 300", "Condition number, forward error and the kappa times epsilon bound against matrix size"),
					numSVG("bars", "0 0 560 120", "The computed solution, entry by entry, against the true value 1"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Matrix size"),
					field("n", "n", "", 8, 2, 14, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Perturbation"),
					field("pert", "nudge b by 10^p", "", -16, -16, -4, 1),
				),
				numLegend([2]string{"var(--vec-v)", "κ∞(H)"}, [2]string{"var(--vec-j)", "forward error"}, [2]string{"var(--vec-out)", "κ · ε bound"}, [2]string{"var(--vec-u)", "residual"}),
				readouts([2]string{"κ∞(H)", "kappa"}, [2]string{"‖x̂ − x‖∞", "ferr"}, [2]string{"‖b − Hx̂‖∞ / ‖b‖∞", "res"}, [2]string{"digits left", "digits"}),
				numNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

const numSecantPy = `def secant(f, x0, x1, tol=1e-15, maxit=50):
    for _ in range(maxit):
        f0, f1 = f(x0), f(x1)
        if f1 == f0:
            break
        # the root of the line through the last two points
        x0, x1 = x1, x1 - f1 * (x1 - x0) / (f1 - f0)
        if abs(x1 - x0) < tol * abs(x1):
            break
    return x1`

func numRootsBlock() Block {
	return Block{
		Slug:        "root-race",
		Title:       "Root-finding race and convergence order",
		Description: "Five methods chase the same root. On a log scale, linear convergence is a straight line down; superlinear methods curve away. The order p is fitted from the iterates as the slope of log|eₖ₊₁| against log|eₖ|: bisection 1, secant the golden ratio 1.618, Newton 2, and regula falsi stuck at 1 when one end never moves.",
		Tags:        []string{"bisection", "secant", "Newton", "order p"},
		Wide:        true,
		Render: func() h.Node {
			return numWithCode(plotPanel("numx-roots",
				h.Div(h.Class("flex flex-col gap-2"),
					numSVG("main", "0 0 560 280", "Absolute error of each method against the iteration number, log scale"),
					numSVG("order", "0 0 560 170", "log of the next error against log of the current error; the slope is the order"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Equation"),
					segs("Equation", [2]string{"cubic", "x³ − 2x − 5"}, [2]string{"cos", "cos x − x"}, [2]string{"exp", "eˣ − 3"}, [2]string{"triple", "(x − 1)³ (x + 2)"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Bracket [a, b]"),
					field("a", "a", "", 1, -3, 3, 0.05),
					field("b", "b", "", 3, -3, 4, 0.05),
				),
				numLegend([2]string{"var(--vec-j)", "bisection"}, [2]string{"var(--vec-v)", "regula falsi"}, [2]string{"var(--vec-i)", "Illinois"}, [2]string{"var(--vec-out)", "secant"}, [2]string{"var(--vec-u)", "Newton"}),
				h.Div(h.Class("scroll-thin overflow-auto rounded-lg border bg-code"),
					h.Table(h.Class("w-full font-mono text-[11px] tabular-nums"),
						h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
							h.Th(h.Class("px-2 py-1.5 font-normal"), "method"),
							h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "steps to 10⁻¹⁰"),
							h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "f evals"),
							h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "order"))),
						h.Tbody(h.Data("rows", "")),
					),
				),
				numNote("note"),
			), "numerics/secant.py", numSecantPy, 6)
		},
	}
}

// ---------------------------------------------------------------- 5

func numInterpBlock() Block {
	return Block{
		Slug:        "interpolation",
		Title:       "Interpolation and the Runge phenomenon",
		Description: "A polynomial through n + 1 equally spaced points of 1/(1 + 25x²) swings wildly near the ends, and more points make it worse. Chebyshev points, crowded toward the ends, make the error fall geometrically; a cubic spline stays tame by using low-degree pieces. The Lebesgue constant Λ measures how much each node set can amplify errors in the data.",
		Tags:        []string{"Runge", "Chebyshev nodes", "splines", "Lebesgue constant"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("numx-interp",
				h.Div(h.Class("flex flex-col gap-2"),
					numSVG("main", "0 0 560 300", "The function, the interpolant and the nodes"),
					numSVG("err", "0 0 560 160", "Maximum error against the number of nodes for each method, log scale"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"runge", "1/(1+25x²)"}, [2]string{"abs", "|x|"}, [2]string{"sin", "sin(3x)"}, [2]string{"step", "tanh(20x)"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Interpolant"),
					segs("Nodes", [2]string{"equi", "Equispaced"}, [2]string{"cheb", "Chebyshev"}, [2]string{"spline", "Cubic spline"}),
					field("n", "Degree n", "", 10, 2, 40, 1),
				),
				numLegend([2]string{"var(--vec-j)", "equispaced"}, [2]string{"var(--vec-u)", "Chebyshev"}, [2]string{"var(--vec-i)", "cubic spline"}),
				readouts([2]string{"max error", "err"}, [2]string{"Lebesgue Λ", "leb"}, [2]string{"nodes", "nodes"}),
				numNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func numDiffBlock() Block {
	return Block{
		Slug:        "differentiation",
		Title:       "Numerical derivatives: the error U-curve",
		Description: "Shrinking h cuts the truncation error (∝ h for forward differences, h² for central) but the subtraction f(x+h) − f(x) loses digits like ε/h. The total is a U whose bottom sits near √ε ≈ 10⁻⁸ for forward and ∛ε ≈ 10⁻⁵ for central differences. The complex-step derivative Im f(x + ih)/h has no subtraction at all, so it reaches full precision and stays there.",
		Tags:        []string{"truncation", "round-off", "optimal h", "complex step"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("numx-diff",
				numSVG("main", "0 0 560 340", "Error of each difference formula against the step h, log-log"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Function"),
					segs("Function", [2]string{"exp", "eˣ"}, [2]string{"sin", "sin x"}, [2]string{"mix", "eˣ / √(sin³x + cos³x)"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Probe"),
					field("x", "x", "", 1, -0.5, 1.5, 0.05),
					field("lh", "h = 10^k", "", -5, -16, 0, 0.25),
				),
				numLegend([2]string{"var(--vec-j)", "forward"}, [2]string{"var(--vec-out)", "central"}, [2]string{"var(--vec-v)", "five-point"}, [2]string{"var(--vec-u)", "complex step"}),
				readouts([2]string{"f′(x) exact", "exact"}, [2]string{"forward error", "fwd"}, [2]string{"central error", "cen"}, [2]string{"five-point error", "five"}, [2]string{"complex-step error", "cs"}, [2]string{"best h (central)", "best"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func numQuadBlock() Block {
	return Block{
		Slug:        "adaptive-quadrature",
		Title:       "Adaptive quadrature",
		Description: "Adaptive Simpson compares one Simpson estimate on an interval with two on its halves; where they disagree by more than the tolerance it splits again. Function evaluations pile up only where the integrand is hard (the √x cusp, the narrow spike) and the recursion tree shows where. A fixed grid that wants the same accuracy has to be fine everywhere.",
		Tags:        []string{"Simpson", "error estimate", "recursion", "Gauss–Legendre"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("numx-quad",
				h.Div(h.Class("flex flex-col gap-2"),
					numSVG("main", "0 0 560 260", "The integrand with every evaluation point"),
					numSVG("tree", "0 0 560 170", "The recursion tree: each row is a depth, each bar an interval"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Integrand on [0, 1]"),
					segs("Integrand", [2]string{"sqrt", "√x"}, [2]string{"spike", "spike at 0.3"}, [2]string{"osc", "sin(1/(x+0.05))"}, [2]string{"smooth", "eˣ"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Tolerance"),
					field("tol", "tol = 10^k", "", -6, -12, -2, 1),
				),
				readouts([2]string{"adaptive result", "res"}, [2]string{"exact", "exact"}, [2]string{"actual error", "err"}, [2]string{"f evaluations", "evals"}, [2]string{"max depth", "depth"}, [2]string{"uniform Simpson for same error", "uni"}, [2]string{"Gauss–Legendre, 10 nodes", "gl"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

const numVerletPy = `def leapfrog(x, v, accel, h, steps):
    a = accel(x)
    for _ in range(steps):
        v = v + 0.5 * h * a     # half kick
        x = x + h * v           # drift
        a = accel(x)
        v = v + 0.5 * h * a     # half kick
    return x, v`

func numODEBlock() Block {
	return Block{
		Slug:        "ode-orbits",
		Title:       "ODE solvers on an orbit",
		Description: "A planet on a Kepler orbit, integrated with four methods and the same step. Euler spirals outward and RK2 drifts; RK4 is far more accurate per step but its energy still creeps. Leapfrog is only second order, yet symplectic: its energy error stays bounded for ever. The lower plot fits each method's global order from the error at a fixed time.",
		Tags:        []string{"Euler", "RK4", "symplectic", "energy drift"},
		Wide:        true,
		Render: func() h.Node {
			return numWithCode(plotPanel("numx-ode",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						numSVG("orbit", "0 0 300 300", "Orbits computed by each method around the sun"),
						numSVG("energy", "0 0 300 300", "Relative energy error against time for each method"),
					),
					numSVG("order", "0 0 560 170", "Error after one period against the step size, log-log, with fitted slopes"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Orbit"),
					field("ecc", "eccentricity", "", 0.5, 0, 0.9, 0.05),
					field("steps", "steps per period", "", 200, 20, 2000, 10),
					field("periods", "periods", "", 5, 1, 30, 1),
				),
				h.Div(h.Class("flex gap-2"), playPauseLabel("Run")),
				numLegend([2]string{"var(--vec-j)", "Euler"}, [2]string{"var(--vec-out)", "RK2"}, [2]string{"var(--vec-u)", "RK4"}, [2]string{"var(--vec-i)", "leapfrog"}),
				readouts([2]string{"Euler |ΔE/E|", "e1"}, [2]string{"RK2 |ΔE/E|", "e2"}, [2]string{"RK4 |ΔE/E|", "e4"}, [2]string{"leapfrog |ΔE/E|", "el"}, [2]string{"fitted orders", "orders"}),
			), "numerics/leapfrog.py", numVerletPy, 4, 5, 7)
		},
	}
}

// ---------------------------------------------------------------- 9

func numStiffBlock() Block {
	return Block{
		Slug:        "stiffness",
		Title:       "Stiffness and regions of absolute stability",
		Description: "For y′ = λy a one-step method multiplies y by R(hλ) each step, so it decays only when hλ lies in the region |R| ≤ 1. Explicit Euler's region is the disc around −1: with λ = −50 it needs h < 0.04 even though the solution is smooth. Backward Euler is stable for the whole left half-plane. Drag hλ in the complex plane, or set λ and h, and watch the solutions.",
		Tags:        []string{"stiff ODEs", "A-stability", "implicit methods", "step limits"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("numx-stiff",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"),
						numSVG("plane", "0 0 300 300", "Regions of absolute stability in the complex plane, with the point h lambda"),
						numSVG("sol", "0 0 340 300", "The solution of y prime = lambda (y − cos t) by each method against the exact solution"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Problem"),
					h.P(h.Class("font-mono text-xs text-muted-foreground"), "y′ = λ(y − cos t) − sin t, y(0) = 0"),
					field("lam", "λ", "", -50, -200, -1, 1),
					field("h", "step h", "", 0.045, 0.002, 0.2, 0.001),
				),
				numLegend([2]string{"var(--vec-j)", "explicit Euler"}, [2]string{"var(--vec-out)", "RK2"}, [2]string{"var(--vec-u)", "RK4"}, [2]string{"var(--vec-i)", "backward Euler"}),
				readouts([2]string{"hλ", "z"}, [2]string{"|R| Euler", "r1"}, [2]string{"|R| RK2", "r2"}, [2]string{"|R| RK4", "r4"}, [2]string{"|R| backward Euler", "rb"}, [2]string{"Euler needs h <", "hmax"}),
				numNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

const numCGPy = `def conjugate_gradient(A, b, tol=1e-10):
    x = np.zeros_like(b)
    r = b - A @ x
    p = r.copy()
    rr = r @ r
    while math.sqrt(rr) > tol * np.linalg.norm(b):
        Ap = A @ p
        alpha = rr / (p @ Ap)       # exact line search along p
        x += alpha * p
        r -= alpha * Ap
        rr_new = r @ r
        p = r + (rr_new / rr) * p   # next direction, A-conjugate to the last
        rr = rr_new
    return x`

func numPoissonBlock() Block {
	return Block{
		Slug:        "iterative-solvers",
		Title:       "Iterative solvers on the Poisson equation",
		Description: "−∇²u = f on an N × N grid is a sparse linear system with N² unknowns. Jacobi averages the neighbours, Gauss–Seidel uses new values as soon as it has them, SOR over-relaxes with the optimal ω = 2/(1 + sin πh), and conjugate gradient picks A-orthogonal search directions. The residual curves show iterations growing like N² for Jacobi but only like N for SOR and CG.",
		Tags:        []string{"Jacobi", "Gauss–Seidel", "SOR", "conjugate gradient"},
		Wide:        true,
		Render: func() h.Node {
			return numWithCode(plotPanel("numx-poisson",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"),
						numSVG("field", "0 0 240 240", "The current error of the selected method across the grid"),
						numSVG("res", "0 0 340 240", "Relative residual against iteration for each method, log scale"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Grid"),
					field("N", "N (interior)", "", 24, 8, 48, 4),
					field("omega", "SOR ω", "", 1.78, 1, 1.99, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Show error of"),
					segs("Method", [2]string{"jacobi", "Jacobi"}, [2]string{"gs", "Gauss–Seidel"}, [2]string{"sor", "SOR"}, [2]string{"cg", "CG"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					playPauseLabel("Iterate"),
					numButton("optimal", "Optimal ω", hugeicons.Target02Icon()),
				),
				numLegend([2]string{"var(--vec-j)", "Jacobi"}, [2]string{"var(--vec-out)", "Gauss–Seidel"}, [2]string{"var(--vec-v)", "SOR"}, [2]string{"var(--vec-u)", "CG"}),
				readouts([2]string{"iteration", "it"}, [2]string{"Jacobi to 10⁻⁸", "jac"}, [2]string{"Gauss–Seidel to 10⁻⁸", "gs"}, [2]string{"SOR to 10⁻⁸", "sor"}, [2]string{"CG to 10⁻⁸", "cg"}, [2]string{"ρ(Jacobi) = cos πh", "rho"}),
			), "numerics/cg.py", numCGPy, 8, 12)
		},
	}
}
