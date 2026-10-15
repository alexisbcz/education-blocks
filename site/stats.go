package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// StatsBlocks lists the statistics gallery in display order.
func StatsBlocks() []Block {
	return []Block{
		distributionsBlock(),
		cltBlock(),
		confidenceBlock(),
		tTestBlock(),
		bayesBlock(),
		simpsonBlock(),
		correlationBlock(),
		bootstrapBlock(),
		regressionMeanBlock(),
		describeBlock(),
	}
}

// stNote is a short explanatory paragraph under a block's controls.
func stNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// stButton is a small outline action button.
func stButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- S1

type distParam struct {
	name, label, unit string
	v, min, max, step float64
}

type distSpec struct {
	key, label string
	params     []distParam
}

var distributions = []distSpec{
	{"normal", "Normal", []distParam{{"normal-mu", "Mean μ", "", 0, -5, 5, 0.1}, {"normal-sigma", "SD σ", "", 1, 0.1, 5, 0.1}}},
	{"t", "Student t", []distParam{{"t-df", "df ν", "", 5, 1, 60, 1}}},
	{"chisq", "Chi-square", []distParam{{"chisq-k", "df k", "", 4, 1, 40, 1}}},
	{"binomial", "Binomial", []distParam{{"binomial-n", "Trials n", "", 20, 1, 60, 1}, {"binomial-p", "Success p", "", 0.3, 0.01, 0.99, 0.01}}},
	{"poisson", "Poisson", []distParam{{"poisson-lambda", "Rate λ", "", 4, 0.1, 30, 0.1}}},
	{"exponential", "Exponential", []distParam{{"exponential-lambda", "Rate λ", "", 1, 0.05, 5, 0.05}}},
	{"uniform", "Uniform", []distParam{{"uniform-a", "From a", "", 0, -5, 5, 0.1}, {"uniform-b", "To b", "", 1, -5, 5, 0.1}}},
}

func distributionsBlock() Block {
	return Block{
		Slug:        "distributions",
		Title:       "Distribution explorer",
		Description: "Seven distributions with their density (or mass) and cumulative curves. Set two bounds and read the probability between them: the shaded area is P(a ≤ X ≤ b), computed from accurate CDFs (incomplete gamma and beta functions), not by counting pixels.",
		Tags:        []string{"PDF / PMF", "CDF", "probability"},
		Wide:        true,
		Render: func() h.Node {
			opts := make([][2]string, len(distributions))
			for i, d := range distributions {
				opts[i] = [2]string{d.key, d.label}
			}
			return plotPanel("dist",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						h.Span(h.Data("out", "formula"), "—"),
						h.Span(h.Class("ml-auto"), h.Data("out", "support"), ""),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 330"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Distribution with the area between two bounds shaded")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Distribution"), segs("Distribution", opts...)),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameters"),
					h.Map(distributions, func(d distSpec) h.Node {
						return h.Div(h.Data("params", d.key), h.If(d.key != "normal", h.Hidden()), h.Class("flex flex-col gap-2"),
							h.Map(d.params, func(p distParam) h.Node { return field(p.name, p.label, p.unit, p.v, p.min, p.max, p.step) }),
						)
					}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Bounds"),
					field("lo", "From a", "", -1.96, -100, 100, 0.01),
					field("hi", "To b", "", 1.96, -100, 100, 0.01),
					toggle("dist-cdf", "cdf", "Show the CDF", false),
				),
				readouts([2]string{"P(a ≤ X ≤ b)", "prob"}, [2]string{"mean", "mean"}, [2]string{"variance", "var"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func cltBlock() Block {
	return Block{
		Slug:        "clt",
		Title:       "Central limit theorem",
		Description: "Draw samples of size n from a lopsided distribution, keep only each sample's mean, and repeat. The means pile up into a bell curve around μ with spread σ/√n, whatever the source looked like; their skewness shrinks like 1/√n.",
		Tags:        []string{"sampling distribution", "animation", "skewness"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("clt",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Svg(h.Data("clt-source", ""), h.ViewBox("0 0 600 100"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Source distribution")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Histogram of sample means with the normal approximation")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "sample means"),
						legendSwatch("var(--foreground)", "Normal(μ, σ²/n)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Source"),
					segs("Source distribution", [2]string{"exponential", "Exponential"}, [2]string{"bernoulli", "Coin p = 0.1"}, [2]string{"uniform", "Uniform"}),
					field("n", "Sample size n", "", 5, 1, 100, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
						hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Sample")),
					stButton("reset", hugeicons.RefreshIcon(), "Clear")),
				readouts([2]string{"samples drawn", "draws"}, [2]string{"mean of means", "mean"}, [2]string{"SD of means", "sd"}, [2]string{"σ/√n", "se"}, [2]string{"skewness", "skew"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func confidenceBlock() Block {
	return Block{
		Slug:        "confidence",
		Title:       "Confidence intervals",
		Description: "One hundred samples from the same population, each with its own t-interval. About 95 of them catch the true mean; the rest, in red, miss it. The 95% describes the method across repeated samples, not any single interval.",
		Tags:        []string{"t-interval", "coverage", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ci",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 420"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "One hundred confidence intervals around the true mean")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Design"),
					field("n", "Sample size n", "", 10, 2, 100, 1),
					field("level", "Confidence", "%", 95, 50, 99.9, 0.1),
				),
				stButton("reseed", hugeicons.ShuffleIcon(), "Draw 100 new samples"),
				readouts([2]string{"this run", "cover"}, [2]string{"all runs", "total"}, [2]string{"t critical", "tcrit"}),
				stNote("Population: Normal with μ = 50, σ = 10, unknown to the intervals. Each interval is x̄ ± t·s/√n with n − 1 degrees of freedom."),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func tTestBlock() Block {
	return Block{
		Slug:        "t-test",
		Title:       "Hypothesis test and power",
		Description: "A two-sample t-test on simulated groups. The top plot is the null distribution with the observed t and its p-value tail; the bottom plot shows why small studies miss real effects: power is the share of the alternative beyond the critical value.",
		Tags:        []string{"p-value", "power", "Type I / II"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ttest",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Svg(h.Data("null", ""), h.ViewBox("0 0 600 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Null distribution with the observed statistic")),
					h.Svg(h.Data("power", ""), h.ViewBox("0 0 600 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Null and alternative distributions with error regions")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-del)", "α: Type I error"),
						legendSwatch("var(--vec-out)", "β: Type II error"),
						legendSwatch("var(--code-add)", "power"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Study"),
					field("d", "Effect size d", "", 0.5, 0, 2, 0.05),
					field("n", "n per group", "", 20, 2, 200, 1),
					field("alpha", "α", "", 0.05, 0.001, 0.2, 0.001),
					segs("Alternative hypothesis", [2]string{"two", "Two-sided"}, [2]string{"one", "One-sided"}),
				),
				stButton("reseed", hugeicons.ShuffleIcon(), "Run the study again"),
				readouts([2]string{"t", "t"}, [2]string{"df", "df"}, [2]string{"p-value", "p"}, [2]string{"decision", "decision"}, [2]string{"power", "pow"}),
				stNote("Groups are Normal(0, 1) and Normal(d, 1). Power uses the noncentral t distribution, computed by numerical integration."),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func bayesBlock() Block {
	key := func(color, label string, outline bool) h.Node {
		dot := "size-2.5 rounded-full"
		style := "background:" + color
		if outline {
			style = "box-shadow: inset 0 0 0 1.5px " + color
		}
		return h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class(dot), h.Style(style)), label)
	}
	return Block{
		Slug:        "bayes",
		Title:       "Bayes and the medical test",
		Description: "A test that is 90% sensitive and 91% specific sounds reliable, yet when the disease is rare most positives are false. Counting 1,000 people instead of multiplying probabilities makes the answer obvious.",
		Tags:        []string{"Bayes' theorem", "natural frequencies", "PPV"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bayes",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("grid", ""), h.ViewBox("0 0 600 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "1,000 people coloured by disease and test result")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						key("var(--brand)", "sick, test +", false),
						key("var(--brand)", "sick, test −", true),
						key("var(--vec-u)", "healthy, test +", false),
						key("color-mix(in oklab, var(--foreground) 18%, transparent)", "healthy, test −", false),
					),
					h.Svg(h.Data("tree", ""), h.ViewBox("0 0 600 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Frequency tree")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Test"),
					field("prev", "Prevalence", "%", 1, 0.1, 50, 0.1),
					field("sens", "Sensitivity", "%", 90, 50, 100, 0.1),
					field("spec", "Specificity", "%", 91, 50, 100, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3"),
					h.Span(h.Class("text-xs text-muted-foreground"), "If you test positive, the chance you are sick is"),
					h.Span(h.Data("out", "ppvbig"), h.Class("font-mono text-2xl font-medium tabular-nums text-brand"), "—"),
				),
				readouts([2]string{"PPV", "ppv"}, [2]string{"NPV", "npv"}, [2]string{"positives", "pos"}),
				stNote("PPV = P(sick | +) = sens·prev / (sens·prev + (1 − spec)·(1 − prev)). The grid rounds to whole people; the percentages are exact."),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

type stoneRow struct {
	group   string
	aOK, aN int
	bOK, bN int
}

// Charig et al., BMJ 1986: A = open surgery, B = percutaneous nephrolithotomy.
var stones = []stoneRow{
	{"Small stones", 81, 87, 234, 270},
	{"Large stones", 192, 263, 55, 80},
}

func pct(ok, n int) string { return fmt.Sprintf("%.1f%%", 100*float64(ok)/float64(n)) }

func simpsonBlock() Block {
	return Block{
		Slug:        "simpson",
		Title:       "Simpson's paradox",
		Description: "Real data from a 1986 kidney stone study. Treatment A wins for small stones and for large stones, yet B wins overall. A was given mostly to the harder, large-stone cases: stone size confounds the comparison.",
		Tags:        []string{"confounding", "real data", "aggregation"},
		Render: func() h.Node {
			var aOK, aN, bOK, bN int
			for _, r := range stones {
				aOK += r.aOK
				aN += r.aN
				bOK += r.bOK
				bN += r.bN
			}
			bar := func(label string, ok, n int, color string, win bool) h.Node {
				return h.Div(h.Class("grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-xs"),
					h.Span(h.Class("font-mono font-medium"), label),
					h.Div(h.Class("h-5 overflow-hidden rounded bg-foreground/5"),
						h.Div(h.Class("h-full rounded"), h.Style(fmt.Sprintf("width:%.2f%%;background:%s", 100*float64(ok)/float64(n), color)))),
					h.Span(h.Class("w-28 text-right font-mono tabular-nums"),
						pct(ok, n), h.Span(h.Class("text-muted-foreground"), fmt.Sprintf(" %d/%d", ok, n)),
						h.If(win, h.Span(h.Class("ml-1 text-brand"), "★"))),
				)
			}
			group := func(title, sub string, aOK, aN, bOK, bN int) h.Node {
				aWins := float64(aOK)/float64(aN) > float64(bOK)/float64(bN)
				return h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-4"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), title),
						h.Span(h.Class("text-xs text-muted-foreground"), sub)),
					bar("A", aOK, aN, "var(--brand)", aWins),
					bar("B", bOK, bN, "var(--vec-u)", !aWins),
				)
			}
			return h.Div(h.Class("flex flex-col gap-4"),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Div(h.Class("flex items-center gap-2"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Charig et al., BMJ 1986"),
						h.Span(h.Class("text-xs text-muted-foreground"), "success rate by treatment"),
					),
					h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "View"),
						segButton("pooled", "All patients", true),
						segButton("strata", "By stone size", false),
					),
				),
				h.Div(h.Data("view", "pooled"),
					group("All patients", "350 per treatment", aOK, aN, bOK, bN)),
				h.Div(h.Data("view", "strata"), h.Hidden(), h.Class("grid gap-3 sm:grid-cols-2"),
					h.Map(stones, func(r stoneRow) h.Node {
						return group(r.group, fmt.Sprintf("A: %d patients · B: %d", r.aN, r.bN), r.aOK, r.aN, r.bOK, r.bN)
					})),
				h.Div(h.Class("grid gap-3 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2"),
					h.P(h.Span(h.Class("font-medium text-foreground"), "A: open surgery. "), "Used on 263 large stones and 87 small ones."),
					h.P(h.Span(h.Class("font-medium text-foreground"), "B: percutaneous nephrolithotomy. "), "Used on 270 small stones and only 80 large ones."),
				),
				stNote("Large stones fail more often under either treatment. Because A got most of them, its pooled rate is dragged down: compare like with like, or adjust for the confounder."),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func correlationBlock() Block {
	return Block{
		Slug:        "correlation",
		Title:       "Correlation",
		Description: "Pearson's r measures linear association; Spearman's ρ ranks the data first. Then Anscombe's quartet: four datasets with the same means, variances, correlation and regression line, and four completely different pictures. Always plot the data.",
		Tags:        []string{"Pearson", "Spearman", "Anscombe"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3"), h.Data("corr", ""),
				h.Div(h.Class("flex justify-end"),
					h.Div(h.Class("flex items-center gap-1 rounded-lg border bg-background p-0.5"), h.Role("tablist"), h.Aria("label", "View"),
						segButton("bivariate", "Simulated", true),
						segButton("anscombe", "Anscombe's quartet", false),
					),
				),
				h.Div(h.Data("view", "bivariate"),
					plotPanel("corr-sim",
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 380"), h.Class("mx-auto block w-full max-w-[600px]"), h.Role("img"), h.Aria("label", "Scatter plot of a bivariate normal sample")),
						h.Div(h.Class("flex flex-col gap-2"), panelLabel("Population"),
							field("rho", "Correlation ρ", "", 0.6, -1, 1, 0.01),
							field("n", "Points n", "", 100, 5, 1000, 1),
							toggle("corr-outlier", "outlier", "Add one outlier", false),
						),
						stButton("reseed", hugeicons.ShuffleIcon(), "New sample"),
						readouts([2]string{"Pearson r", "r"}, [2]string{"Spearman ρ", "rs"}, [2]string{"fitted line", "line"}),
					),
				),
				h.Div(h.Data("view", "anscombe"), h.Hidden(),
					h.Div(h.Class("grid gap-3 sm:grid-cols-2"), h.Data("anscombe", ""),
						h.Map([]string{"I", "II", "III", "IV"}, func(k string) h.Node {
							return h.Div(h.Class("flex flex-col gap-1 rounded-xl border bg-code p-3"),
								h.Div(h.Class("flex items-baseline justify-between px-1"),
									h.Span(h.Class("font-mono text-xs font-medium"), "Dataset "+k),
									h.Span(h.Data("stats", k), h.Class("font-mono text-[11px] text-muted-foreground"), "—")),
								h.Svg(h.Data("set", k), h.ViewBox("0 0 440 250"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Anscombe dataset "+k)),
							)
						}),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func bootstrapBlock() Block {
	return Block{
		Slug:        "bootstrap",
		Title:       "Bootstrap",
		Description: "Fifteen observations and no formula: resample them with replacement thousands of times, recompute the statistic each time, and read the uncertainty off the spread. It works for the median too, where the textbook t-interval has nothing to say.",
		Tags:        []string{"resampling", "percentile CI", "median"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("boot",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Svg(h.Data("sample", ""), h.ViewBox("0 0 600 70"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "The original sample")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Bootstrap distribution of the statistic")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "95% percentile interval"),
						legendSwatch("var(--vec-u)", "95% t-interval (mean only)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Statistic"),
					segs("Statistic", [2]string{"mean", "Mean"}, [2]string{"median", "Median"}),
					field("B", "Resamples B", "", 2000, 100, 20000, 100),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					stButton("resample", hugeicons.RefreshIcon(), "Resample"),
					stButton("reseed", hugeicons.ShuffleIcon(), "New data")),
				readouts([2]string{"observed", "obs"}, [2]string{"bootstrap SE", "se"}, [2]string{"percentile CI", "pci"}, [2]string{"t CI", "tci"}),
				stNote("Data: 15 draws from a right-skewed (log-normal) population, so the median and mean differ."),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func regressionMeanBlock() Block {
	return Block{
		Slug:        "regression-to-mean",
		Title:       "Regression to the mean",
		Description: "Take a test twice. Pick the top scorers on the first try: on the second, they score lower, with no intervention at all. Part of their first score was luck, and luck does not repeat. The more noise in the test, the stronger the pull back.",
		Tags:        []string{"selection", "measurement noise", "scatter"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("rtm",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 400"), h.Class("mx-auto block w-full max-w-[600px]"), h.Role("img"), h.Aria("label", "First test against second test, top scorers highlighted")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Test"),
					field("noise", "Noise SD", "", 8, 0, 20, 0.5),
					field("top", "Select top", "%", 10, 1, 50, 1),
				),
				stButton("reseed", hugeicons.ShuffleIcon(), "New cohort"),
				readouts([2]string{"selected, test 1", "t1"}, [2]string{"same people, test 2", "t2"}, [2]string{"pulled back", "drop"}, [2]string{"expected pull", "exp"}, [2]string{"reliability", "rel"}),
				stNote("500 people. Ability ~ Normal(100, 10); each test adds independent Normal(0, noise) error. Expected test 2 = 100 + reliability × (test 1 − 100), reliability = 10² / (10² + noise²)."),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func describeBlock() Block {
	return Block{
		Slug:        "describe",
		Title:       "Descriptive statistics",
		Description: "Paste numbers, get the summary a report would print: centre, spread and shape, with a box plot whose whiskers and outliers follow Tukey's 1.5 × IQR rule.",
		Tags:        []string{"summary", "box plot", "outliers"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("describe", ""),
				h.Label(h.Class("flex flex-col gap-1.5"),
					h.Span(h.Class("text-sm font-medium"), "Data"),
					h.Textarea(h.Data("input", ""), h.Attr("rows", "3"), h.Attr("spellcheck", "false"),
						h.Class("w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-base tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
						"12, 15, 14, 10, 18, 21, 15, 16, 13, 15, 11, 19, 14, 45"),
					h.Span(h.Data("out", "parse"), h.Class("text-xs text-muted-foreground"), "Separate numbers with commas, spaces or new lines."),
				),
				h.Svg(h.Data("box", ""), h.ViewBox("0 0 600 110"), h.Class("block w-full rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Box plot with the data points")),
				h.Dl(h.Class("grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-xs sm:grid-cols-3"),
					h.Map([][2]string{{"n", "n"}, {"mean", "mean"}, {"median", "median"}, {"mode", "mode"}, {"SD (sample, n−1)", "sd"}, {"SD (population, n)", "sdp"}, {"min / max", "range"}, {"Q1 / Q3", "quart"}, {"IQR", "iqr"}, {"outliers", "outliers"}}, func(r [2]string) h.Node {
						return h.Div(h.Class("flex justify-between gap-3 border-b border-dashed py-1"),
							h.Dt(h.Class("text-muted-foreground"), r[0]), h.Dd(h.Data("out", r[1]), h.Class("text-right tabular-nums"), "—"))
					}),
				),
				stNote("Quartiles by linear interpolation (type 7, the default in R and NumPy). Whiskers reach the most extreme points within 1.5 × IQR of the box."),
			)
		},
	}
}
