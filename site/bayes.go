package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// BayesBlocks lists the Bayesian inference gallery in display order. The
// colours are fixed across blocks: prior var(--vec-u), likelihood
// var(--vec-out), posterior var(--vec-v).
func BayesBlocks() []Block {
	return []Block{
		bayesCoinBlock(),
		bayesGridBlock(),
		bayesShrinkBlock(),
		bayesSchoolsBlock(),
		bayesABBlock(),
		bayesFactorBlock(),
		bayesStoppingBlock(),
		bayesMHBlock(),
		bayesHMCBlock(),
		bayesBanditBlock(),
	}
}

// bayesNote is a short explanatory paragraph under a block's controls.
func bayesNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// bayesButton is a small outline action button.
func bayesButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// bayesRun is a play/pause button whose label the module swaps.
func bayesRun(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

// bayesLegend is the prior / likelihood / posterior key shared by blocks.
func bayesLegend(extra ...h.Node) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		legendSwatch("var(--vec-u)", "prior"),
		legendSwatch("var(--vec-out)", "likelihood (scaled)"),
		legendSwatch("var(--vec-v)", "posterior"),
		h.Group(extra),
	)
}

func bayesSvg(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", label))
}

// ---------------------------------------------------------------- B1

func bayesCoinBlock() Block {
	return Block{
		Slug:        "beta-binomial",
		Title:       "Updating a coin, flip by flip",
		Description: "A Beta(a, b) prior on the coin's bias θ, a binomial likelihood, and the posterior Beta(a + heads, b + tails): the conjugate update is just counting. Flip a hidden coin or enter flips yourself, compare priors, and read the 95% credible interval two ways: equal-tailed and highest density.",
		Tags:        []string{"conjugate prior", "credible interval", "HPD"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-coin",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						h.Span(h.Data("out", "formula"), "—"),
						h.Span(h.Class("ml-auto truncate"), h.Data("out", "seq"), ""),
					),
					bayesSvg("plot", "0 0 600 320", "Prior, scaled likelihood and posterior for the coin's bias"),
					bayesLegend(legendSwatch("var(--brand)", "95% interval")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Prior"),
					segs("Prior", [2]string{"flat", "Flat"}, [2]string{"jeffreys", "Jeffreys"}, [2]string{"fair", "Fair"}, [2]string{"low", "Low θ"}),
					field("a", "a (prior heads)", "", 1, 0.5, 200, 0.5),
					field("b", "b (prior tails)", "", 1, 0.5, 200, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Data"),
					field("p", "Hidden coin θ", "", 0.7, 0.01, 0.99, 0.01),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						bayesButton("flip1", hugeicons.Coins01Icon(), "Flip once"),
						bayesButton("flip10", hugeicons.RepeatIcon(), "Flip 10"),
						bayesButton("heads", hugeicons.PlusSignIcon(), "Heads"),
						bayesButton("tails", hugeicons.PlusSignIcon(), "Tails"),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						bayesButton("seven-three", hugeicons.NextIcon(), "7 H, 3 T"),
						bayesButton("reset", hugeicons.RefreshIcon(), "Clear"),
					),
					toggle("bayes-coin-hpd", "hpd", "Highest-density interval", false),
				),
				readouts([2]string{"posterior", "post"}, [2]string{"mean", "mean"}, [2]string{"mode", "mode"}, [2]string{"95% interval", "ci"}, [2]string{"P(θ > 0.5)", "pgt"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B2

func bayesGridBlock() Block {
	return Block{
		Slug:        "grid-approximation",
		Title:       "Any prior, by grid approximation",
		Description: "Draw a prior with the pointer, any shape at all. On a grid of 101 values of θ the posterior is prior × likelihood, renormalised: no conjugacy needed. Below, the posterior predictive: how many heads to expect in the next flips, averaging over everything the posterior still believes.",
		Tags:        []string{"grid approximation", "posterior predictive", "drawing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-grid",
				h.Div(h.Class("flex flex-col gap-1"),
					h.P(h.Class("px-1 pt-1 font-mono text-[11px] text-muted-foreground"), "Drag across the top plot to draw the prior"),
					bayesSvg("prior", "0 0 600 150", "Prior drawn by the learner"),
					bayesSvg("plot", "0 0 600 170", "Likelihood and posterior on the grid"),
					bayesSvg("pred", "0 0 600 150", "Posterior predictive distribution of heads in the next flips"),
					bayesLegend(legendSwatch("var(--foreground)", "binomial at the posterior mean")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Prior shape"),
					segs("Prior shape", [2]string{"bimodal", "Two humps"}, [2]string{"flat", "Flat"}, [2]string{"ramp", "Ramp"}, [2]string{"spike", "Spike"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Data"),
					field("k", "Heads", "", 6, 0, 200, 1),
					field("n", "Flips", "", 9, 0, 200, 1),
					field("m", "Next flips", "", 10, 1, 40, 1),
				),
				readouts([2]string{"posterior mean", "mean"}, [2]string{"95% interval", "ci"}, [2]string{"P(next is heads)", "next"}, [2]string{"predictive SD", "psd"}, [2]string{"plug-in SD", "bsd"}),
				bayesNote("The predictive spreads wider than a binomial at the posterior mean because it also carries the uncertainty about θ itself."),
			)
		},
	}
}

// ---------------------------------------------------------------- B3

func bayesShrinkBlock() Block {
	return Block{
		Slug:        "normal-normal",
		Title:       "Precision-weighted shrinkage",
		Description: "A Normal prior on a mean μ and n measurements with known noise σ. The posterior mean is a weighted average of the prior mean and the sample mean, with weights proportional to their precisions (one over variance). More data or less noise moves the weight to the data; drag the sample mean on the plot.",
		Tags:        []string{"Normal–Normal", "precision", "shrinkage"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-shrink",
				h.Div(h.Class("flex flex-col gap-2"),
					bayesSvg("plot", "0 0 600 290", "Prior, likelihood and posterior for a normal mean"),
					h.Div(h.Class("flex flex-col gap-1 px-1"),
						h.Div(h.Class("flex justify-between font-mono text-[11px] text-muted-foreground"),
							h.Span(h.Data("out", "wprior"), "prior —"), h.Span(h.Data("out", "wdata"), "data —")),
						h.Div(h.Class("flex h-2.5 overflow-hidden rounded-full border"),
							h.Div(h.Data("bar", "prior"), h.Class("h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"), h.Style("width:50%;background:var(--vec-u)")),
							h.Div(h.Data("bar", "data"), h.Class("h-full flex-1"), h.Style("background:var(--vec-out)")),
						),
					),
					bayesLegend(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Prior"),
					field("mu0", "Prior mean μ₀", "", 0, -10, 10, 0.1),
					field("tau0", "Prior SD τ₀", "", 2, 0.1, 10, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Data"),
					field("xbar", "Sample mean", "", 4, -10, 10, 0.1),
					field("n", "Measurements n", "", 4, 1, 400, 1),
					field("sigma", "Noise σ", "", 3, 0.1, 20, 0.1),
				),
				readouts([2]string{"posterior mean", "mean"}, [2]string{"posterior SD", "sd"}, [2]string{"95% interval", "ci"}, [2]string{"shrinkage", "shrink"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B4

func bayesSchoolsBlock() Block {
	return Block{
		Slug:        "eight-schools",
		Title:       "Partial pooling: the eight schools",
		Description: "Coaching effects measured in eight schools (Rubin 1981; Gelman et al., Bayesian Data Analysis, ch. 5). No pooling trusts each noisy estimate; complete pooling gives every school the same effect. A hierarchical model lets the between-school spread τ decide: each estimate is pulled toward the common mean by its own precision. The right panel shows how far, for every τ, and the posterior of τ itself.",
		Tags:        []string{"hierarchical model", "partial pooling", "real data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-schools",
				h.Div(h.Class("grid gap-2 md:grid-cols-2"),
					bayesSvg("forest", "0 0 300 300", "Estimates for eight schools: raw and pooled"),
					h.Div(h.Class("flex flex-col gap-1"),
						bayesSvg("paths", "0 0 300 200", "Conditional posterior means of the eight schools as τ grows"),
						bayesSvg("tau", "0 0 300 100", "Marginal posterior of τ under a flat prior"),
					),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground md:col-span-2"),
						legendSwatch("var(--vec-out)", "raw y ± σ"),
						legendSwatch("var(--vec-v)", "pooled estimate"),
						legendSwatch("var(--brand)", "current τ"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pooling"),
					segs("Pooling", [2]string{"partial", "Given τ"}, [2]string{"avg", "Average τ"}, [2]string{"none", "None"}, [2]string{"complete", "Complete"}),
					field("tau", "Between-school SD τ", "", 6, 0, 30, 0.5),
				),
				readouts([2]string{"common mean", "mu"}, [2]string{"school A", "a"}, [2]string{"A pulled to mean", "pull"}, [2]string{"P(τ < 5 | y)", "ptau"}),
				bayesNote("“Average τ” uses the posterior mean of each school's effect, integrating τ over its posterior with a flat prior (BDA3, eqs 5.17–5.21)."),
			)
		},
	}
}

// ---------------------------------------------------------------- B5

func bayesABBlock() Block {
	return Block{
		Slug:        "ab-test",
		Title:       "A Bayesian A/B test",
		Description: "Two conversion rates, each with a Beta(1, 1) prior and its own posterior. The question a product team asks, the probability that B beats A, is computed exactly from the two Betas, along with the expected loss of shipping the wrong one. The z-test's p-value sits alongside for comparison: it answers a different question.",
		Tags:        []string{"Beta posteriors", "P(B > A)", "expected loss"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-ab",
				h.Div(h.Class("flex flex-col gap-1"),
					bayesSvg("plot", "0 0 600 200", "Posterior distributions of the two conversion rates"),
					bayesSvg("lift", "0 0 600 140", "Posterior distribution of the relative lift of B over A"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-i)", "A posterior"),
						legendSwatch("var(--vec-v)", "B posterior"),
						legendSwatch("var(--brand)", "lift > 0"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Variant A"),
					field("na", "Visitors", "", 1000, 1, 100000, 1),
					field("ka", "Conversions", "", 100, 0, 100000, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Variant B"),
					field("nb", "Visitors", "", 1000, 1, 100000, 1),
					field("kb", "Conversions", "", 120, 0, 100000, 1),
				),
				readouts([2]string{"P(B > A)", "pb"}, [2]string{"loss, ship B", "lossb"}, [2]string{"loss, ship A", "lossa"}, [2]string{"lift (95%)", "lift"}, [2]string{"z-test p", "p"}),
				bayesNote("Losses are the expected conversion-rate points given up by shipping that variant if the other is better. The z-test is two-sided with a pooled rate. P(B > A) uses the closed-form sum for Beta variables with integer parameters; the lift and losses use 20 000 seeded posterior draws."),
			)
		},
	}
}

// ---------------------------------------------------------------- B6

func bayesFactorBlock() Block {
	return Block{
		Slug:        "bayes-factor",
		Title:       "Bayes factors and Lindley's paradox",
		Description: "Is the coin fair? H₀ says θ = 0.5 exactly; H₁ spreads θ over a Beta(c, c) prior. The Bayes factor is the Savage–Dickey ratio: the posterior density at 0.5 over the prior density there, both under H₁. With a huge sample, a result can be “significant” at p < 0.05 and still favour H₀: Lindley's paradox.",
		Tags:        []string{"Savage–Dickey", "Lindley", "p-value"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-bf",
				h.Div(h.Class("flex flex-col gap-1"),
					bayesSvg("plot", "0 0 600 210", "Prior and posterior under H1 with their densities at one half"),
					bayesSvg("sweep", "0 0 600 150", "Bayes factor for H0 as the sample grows at a fixed z of 2"),
					bayesLegend(legendSwatch("var(--brand)", "density at θ = 0.5")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Data"),
					field("n", "Flips n", "", 100, 1, 1000000, 1),
					field("k", "Heads k", "", 61, 0, 1000000, 1),
					field("c", "H₁ prior Beta(c, c)", "", 1, 0.5, 50, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					bayesButton("small", hugeicons.Coins01Icon(), "61 of 100"),
					bayesButton("lindley", hugeicons.NextIcon(), "Lindley"),
				),
				readouts([2]string{"BF₀₁", "bf01"}, [2]string{"BF₁₀", "bf10"}, [2]string{"P(H₀ | data)", "ph0"}, [2]string{"binomial p", "p"}, [2]string{"verdict", "verdict"}),
				bayesNote("P(H₀ | data) assumes prior odds of 1. The p-value is the exact two-sided binomial test up to n = 5000, the normal approximation above. The lower chart keeps z = 2 (p ≈ 0.046) fixed and lets n grow: the same p-value means ever stronger evidence for H₀."),
			)
		},
	}
}

// ---------------------------------------------------------------- B7

func bayesStoppingBlock() Block {
	return Block{
		Slug:        "optional-stopping",
		Title:       "Peeking and optional stopping",
		Description: "Simulated experiments on a fair coin, checked after every flip. Stopping at the first p < 0.05 inflates the false-positive rate far past 5%. Stopping when the Bayes factor for a bias passes 3 also produces false alarms, but at most one in three (a universal bound), and the posterior it reports stays calibrated: in a world drawn from the prior, the stated probabilities match the frequencies.",
		Tags:        []string{"stopping rules", "calibration", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-stop",
				h.Div(h.Class("grid gap-2 md:grid-cols-2"),
					bayesSvg("rate", "0 0 300 240", "False alarm rate against the maximum number of looks"),
					bayesSvg("calib", "0 0 300 240", "Calibration of the reported posterior probability"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground md:col-span-2"),
						legendSwatch("var(--vec-out)", "stop at p < 0.05"),
						legendSwatch("var(--vec-v)", "stop at BF₁₀ > 3"),
						legendSwatch("var(--foreground)", "nominal / perfect calibration"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Simulation"),
					field("runs", "Experiments", "", 2000, 200, 10000, 100),
					field("max", "Maximum flips", "", 500, 20, 2000, 10),
					field("seed", "Seed", "", 1, 1, 9999, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					bayesButton("run", hugeicons.PlayIcon(), "Simulate"),
					bayesButton("reseed", hugeicons.ShuffleIcon(), "New seed"),
				),
				readouts([2]string{"p-hacking false alarms", "fp"}, [2]string{"BF > 3 false alarms", "fb"}, [2]string{"bound 1/3", "bound"}, [2]string{"calibration error", "cal"}),
				bayesNote("Left: a fair coin, peeking after every flip from the 10th. Right: θ = 0.5 with probability ½, otherwise θ ~ U(0, 1); each run stops when P(H₀ | data) leaves [0.1, 0.9], and the reported P(H₀) is checked against how often H₀ was true; hollow dots are bins with fewer than 30 runs. The p-value uses the normal approximation."),
			)
		},
	}
}

// ---------------------------------------------------------------- B8

func bayesMHBlock() Block {
	return Block{
		Slug:        "metropolis",
		Title:       "Metropolis–Hastings",
		Description: "A random walk that only needs the target density up to a constant: propose a jump, accept it with probability min(1, p(new)/p(old)), otherwise stay. Tune the proposal width and watch the trade-off: tiny steps are accepted but crawl, huge steps are rejected and stick. The trace, the autocorrelation and the effective sample size say how many independent draws the chain is really worth.",
		Tags:        []string{"MCMC", "acceptance rate", "effective sample size"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-mh",
				h.Div(h.Class("grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					bayesSvg("plot", "0 0 300 300", "Target density contours with the chain's samples"),
					h.Div(h.Class("flex flex-col gap-1"),
						bayesSvg("trace", "0 0 300 140", "Trace of the first coordinate"),
						bayesSvg("acf", "0 0 300 140", "Autocorrelation of the first coordinate"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Target"),
					segs("Target", [2]string{"normal", "N(0, I)"}, [2]string{"corr", "ρ = 0.9"}, [2]string{"banana", "Banana"}),
					field("w", "Proposal SD", "", 0.8, 0.02, 8, 0.02),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					bayesRun("Run"),
					bayesButton("burst", hugeicons.NextIcon(), "+1000"),
					bayesButton("reset", hugeicons.RefreshIcon(), "Restart"),
				),
				readouts([2]string{"samples", "n"}, [2]string{"acceptance", "acc"}, [2]string{"mean x", "mx"}, [2]string{"SD x", "sx"}, [2]string{"ESS of x", "ess"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B9

func bayesHMCBlock() Block {
	return Block{
		Slug:        "hamiltonian",
		Title:       "Hamiltonian Monte Carlo",
		Description: "Give the sampler a momentum and let it glide along the density, with the gradient as its force, using leapfrog steps. Long, curved moves are still accepted because energy is nearly conserved. Too large a step and the simulation blows up: a divergence. Side by side, a random walk given the same budget: L proposals per iteration, one density evaluation each.",
		Tags:        []string{"HMC", "leapfrog", "divergences"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-hmc",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						bayesSvg("hmc", "0 0 300 300", "Hamiltonian Monte Carlo trajectory and samples"),
						bayesSvg("rw", "0 0 300 300", "Random-walk Metropolis samples"),
					),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-v)", "samples"),
						legendSwatch("var(--brand)", "last leapfrog path"),
						legendSwatch("var(--vec-j)", "divergence"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Target"),
					segs("Target", [2]string{"corr", "ρ = 0.95"}, [2]string{"banana", "Banana"}),
					field("eps", "Step size ε", "", 0.15, 0.01, 1, 0.01),
					field("L", "Leapfrog steps L", "", 20, 1, 100, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					bayesRun("Run"),
					bayesButton("step", hugeicons.NextIcon(), "One move"),
					bayesButton("reset", hugeicons.RefreshIcon(), "Restart"),
				),
				readouts([2]string{"iterations", "n"}, [2]string{"HMC acceptance", "acc"}, [2]string{"last |ΔH|", "dh"}, [2]string{"divergences", "div"}, [2]string{"ESS of x, HMC", "ess"}, [2]string{"ESS of x, random walk", "essrw"}),
				bayesNote("ESS can exceed the number of draws: successive HMC draws are often negatively correlated, which makes their average more precise than independent draws. With ρ = 0.95, leapfrog becomes unstable above ε ≈ 0.45 (twice the narrow SD)."),
			)
		},
	}
}

// ---------------------------------------------------------------- B10

func bayesBanditBlock() Block {
	return Block{
		Slug:        "thompson",
		Title:       "Thompson sampling",
		Description: "Three slot machines with unknown payout rates. Thompson sampling keeps a Beta posterior per arm, draws one plausible rate from each and plays the best draw: it explores exactly as much as it is still unsure. Its regret grows like log T, against the straight line of ε-greedy, which keeps exploring at a fixed rate forever.",
		Tags:        []string{"bandits", "exploration", "regret"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes-bandit",
				h.Div(h.Class("flex flex-col gap-1"),
					bayesSvg("post", "0 0 600 170", "Posterior of each arm's payout rate after one Thompson run"),
					bayesSvg("regret", "0 0 600 190", "Average cumulative regret against the number of pulls"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-v)", "Thompson"),
						legendSwatch("var(--vec-out)", "ε-greedy"),
						legendSwatch("var(--vec-u)", "greedy"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Arms"),
					field("p1", "Arm 1 rate", "", 0.3, 0, 1, 0.01),
					field("p2", "Arm 2 rate", "", 0.5, 0, 1, 0.01),
					field("p3", "Arm 3 rate", "", 0.55, 0, 1, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Run"),
					field("T", "Pulls", "", 2000, 100, 10000, 100),
					field("eps", "ε for ε-greedy", "", 0.1, 0, 1, 0.01),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						bayesButton("run", hugeicons.PlayIcon(), "Run 100×"),
						bayesButton("reseed", hugeicons.ShuffleIcon(), "New seed"),
					),
				),
				readouts([2]string{"regret, Thompson", "rt"}, [2]string{"regret, ε-greedy", "re"}, [2]string{"regret, greedy", "rg"}, [2]string{"best arm found", "best"}),
			)
		},
	}
}
