package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/checkbox"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// MethodsBlocks lists the research methods gallery in display order: how
// studies are designed, analysed and read, one level above the statistics
// collection's tests and intervals.
func MethodsBlocks() []Block {
	return []Block{
		methDAGBlock(),
		methColliderBlock(),
		methRCTBlock(),
		methPHackBlock(),
		methMultipleBlock(),
		methFunnelBlock(),
		methMetaBlock(),
		methWinnersBlock(),
		methReliabilityBlock(),
		methPlannerBlock(),
	}
}

// methInputClass is the shared look of text inputs and text areas: 16 px
// on phones so iOS does not zoom, 14 px from sm up.
const methInputClass = "w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-base tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"

func methTextarea(name string, rows int, label, hint, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5"),
		h.Span(h.Class("text-sm font-medium"), label),
		h.Textarea(h.Data("input", name), h.Attr("rows", fmt.Sprint(rows)), h.Attr("spellcheck", "false"),
			h.Class("resize-y "+methInputClass), value),
		h.If(hint != "", h.Span(h.Data("out", name+"-hint"), h.Class("text-xs text-muted-foreground"), hint)),
	)
}

// ---------------------------------------------------------------- M1

func methDAGBlock() Block {
	return Block{
		Slug:        "causal-dag",
		Title:       "Causal diagrams",
		Description: "Draw the causal story before touching the data. Every path from X to Y is listed and judged open or blocked by d-separation, and the backdoor criterion says which variables to adjust for to estimate X's effect on Y. Adjusting for a collider opens a path that was closed.",
		Tags:        []string{"DAG", "d-separation", "backdoor"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("meth-dag",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("graph", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Causal diagram")),
					h.Div(h.Class("flex flex-col gap-1.5"),
						panelLabel("Paths from X to Y"),
						h.Ul(h.Data("paths", ""), h.Class("flex flex-col gap-1 font-mono text-xs")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Diagram"),
					segs("Diagram", [2]string{"confounder", "Confounder"}, [2]string{"mediator", "Mediator"}, [2]string{"collider", "Collider"}, [2]string{"mbias", "M-bias"}, [2]string{"mixed", "Mixed"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Adjust for"),
					h.Div(h.Data("adjust", ""), h.Class("flex flex-wrap gap-1.5")),
					stNote("Click a variable to condition on it (stratify, match or put it in the regression)."),
				),
				readouts([2]string{"open paths", "open"}, [2]string{"backdoor", "verdict"}, [2]string{"minimal sets", "sets"}),
				stNote("Rules from Pearl (2009), ", h.Em("Causality"), ", §1.2 and §3.3. A path is blocked by a non-collider in the set, or by a collider when neither it nor any of its descendants is in the set."),
			)
		},
	}
}

// ---------------------------------------------------------------- M2

func methColliderBlock() Block {
	return Block{
		Slug:        "collider-bias",
		Title:       "Collider bias",
		Description: "Talent and looks are independent in this synthetic population. Keep only the people whose combined score gets them noticed, and a negative correlation appears out of nothing: selection on a common effect (Berkson's paradox).",
		Tags:        []string{"selection", "Berkson", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("meth-collider",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 360"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Scatter of talent against looks")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Selection"),
					field("keep", "Keep the top", "%", 20, 2, 100, 1),
					toggle("meth-col-all", "all", "Show everyone", true),
				),
				stButton("reseed", hugeicons.ShuffleIcon(), "New population"),
				readouts([2]string{"r, everyone", "rall"}, [2]string{"r, selected", "rsel"}, [2]string{"selected", "n"}),
				stNote("800 synthetic people, talent and looks drawn independently from N(0, 1); selection keeps the highest talent + looks."),
			)
		},
	}
}

// ---------------------------------------------------------------- M3

func methRCTBlock() Block {
	return Block{
		Slug:        "randomized-trial",
		Title:       "Why randomize",
		Description: "The same treatment studied 200 times two ways. In the observational studies healthier people choose the treatment more often, so the naive comparison mixes the treatment's effect with health. Randomization breaks that link: its estimates centre on the true effect.",
		Tags:        []string{"RCT", "confounding", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("meth-rct",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-del)", "observational"),
						legendSwatch("var(--vec-u)", "randomized"),
						legendSwatch("var(--foreground)", "true effect"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Estimates from 200 observational and 200 randomized studies")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("World"),
					field("effect", "True effect", "", 1, -3, 3, 0.1),
					field("conf", "Health → uptake", "", 2, 0, 5, 0.1),
					field("n", "People / study", "", 400, 50, 2000, 50),
				),
				stButton("rerun", hugeicons.RefreshIcon(), "New studies"),
				readouts([2]string{"obs. mean", "obs"}, [2]string{"obs. bias", "obsbias"}, [2]string{"RCT mean", "rct"}, [2]string{"RCT bias", "rctbias"}),
				stNote("Model: hidden health U ~ N(0, 1); outcome Y = effect·T + 2·U + noise. Observational uptake P(T = 1) = 1/(1 + e^(−k·U)); randomized uptake is a fair coin."),
			)
		},
	}
}

// ---------------------------------------------------------------- M4

func methPHackBlock() Block {
	return Block{
		Slug:        "p-hacking",
		Title:       "The garden of forking paths",
		Description: "Simulate studies where nothing is going on, then give the analyst some freedom: several outcomes, peeking at the data, splitting by subgroup. Reporting whichever test reaches p < .05 pushes the false-positive rate far above the advertised 5%.",
		Tags:        []string{"false positives", "simulation", "Simmons 2011"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("meth-phack",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "False-positive rate of null studies")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Analyst's freedom"),
					field("k", "Outcomes tested", "", 3, 1, 20, 1),
					field("n", "n / group", "", 20, 10, 100, 5),
					toggle("meth-ph-stop", "stop", "Peek and add 10 more", true),
					toggle("meth-ph-sub", "sub", "Also test 2 subgroups", false),
				),
				stButton("run", hugeicons.PlayIcon(), "Run 2,000 null studies"),
				readouts([2]string{"false positives", "fp"}, [2]string{"no hacking", "base"}, [2]string{"outcomes only", "analytic"}, [2]string{"studies", "runs"}),
				stNote("Every dataset is pure noise, so every \"finding\" is false. Outcomes are independent here; Simmons, Nelson & Simonsohn (2011, ", h.Em("Psychological Science"), ") used correlated outcomes and reached 60.7% with four combined freedoms."),
			)
		},
	}
}

// ---------------------------------------------------------------- M5

func methMultipleBlock() Block {
	return Block{
		Slug:        "multiple-comparisons",
		Title:       "Multiple comparisons",
		Description: "Test many hypotheses and some will pass by chance. Edit a list of p-values and compare three corrections: Bonferroni and Holm control the chance of any false positive, Benjamini–Hochberg controls the expected share of false discoveries.",
		Tags:        []string{"FWER", "FDR", "Benjamini–Hochberg"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("meth-multiple", ""),
				h.Div(h.Class("flex flex-col gap-4 border-b p-5 lg:border-r lg:border-b-0"),
					methTextarea("p", 3, "p-values", "Separate with commas, spaces or new lines.", "0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205"),
					field("q", "α / q", "", 0.05, 0.001, 0.2, 0.001),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 420 240"), h.Class("block w-full rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Sorted p-values against the correction thresholds")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "sorted p"),
						legendSwatch("var(--brand)", "BH line i·q/m"),
						legendSwatch("var(--vec-u)", "Bonferroni q/m"),
					),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[420px] font-mono text-xs tabular-nums"),
							h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "rank"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "p"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "Bonferroni"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "Holm"),
								h.Th(h.Class("py-1.5 font-normal"), "BH"),
							)),
							h.Tbody(h.Data("rows", "")),
						),
					),
					readouts([2]string{"tests", "m"}, [2]string{"Bonferroni rejects", "bonf"}, [2]string{"Holm rejects", "holm"}, [2]string{"BH rejects", "bh"}),
					stNote("Cells show adjusted p-values; a filled dot means rejected at the chosen level. Holm (1979) is uniformly more powerful than Bonferroni; Benjamini & Hochberg (1995) control the false discovery rate for independent tests."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- M6

func methFunnelBlock() Block {
	return Block{
		Slug:        "publication-bias",
		Title:       "Publication bias",
		Description: "Simulated studies of one true effect, plotted by effect against standard error. With every study published the funnel is symmetric; let the file drawer swallow most non-significant results and the small studies that survive all overestimate the effect.",
		Tags:        []string{"funnel plot", "file drawer", "Egger"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("meth-funnel",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "published"),
						legendSwatch("color-mix(in oklab, var(--foreground) 25%, transparent)", "file drawer"),
						legendSwatch("var(--brand)", "pooled, published"),
						legendSwatch("var(--vec-u)", "true effect"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Funnel plot of simulated studies")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Literature"),
					field("delta", "True effect d", "", 0.2, 0, 1, 0.05),
					field("k", "Studies run", "", 80, 20, 300, 10),
					toggle("meth-fun-drawer", "drawer", "File drawer (10% of null results published)", true),
				),
				stButton("reseed", hugeicons.ShuffleIcon(), "New studies"),
				readouts([2]string{"published", "pub"}, [2]string{"pooled, all", "all"}, [2]string{"pooled, published", "published"}, [2]string{"Egger intercept", "egger"}),
				stNote("Each study's n per group is drawn between 10 and 200; SE ≈ √(2/n). A study is published if it is significant in the expected direction, otherwise with probability 0.1. Egger's intercept (Egger et al. 1997) regresses d/SE on 1/SE; far from 0 suggests asymmetry. Pooled estimates are fixed-effect."),
			)
		},
	}
}

// ---------------------------------------------------------------- M7

func methMetaBlock() Block {
	return Block{
		Slug:        "meta-analysis",
		Title:       "Meta-analysis",
		Description: "Combine studies into one estimate. A forest plot of editable studies, pooled two ways: fixed effect assumes one true effect, random effects (DerSimonian–Laird) lets it vary between studies. Q and I² say how much they disagree.",
		Tags:        []string{"forest plot", "heterogeneity", "random effects"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("meth-meta", ""),
				h.Div(h.Class("scroll-thin min-w-0 overflow-x-auto border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 320"), h.Class("block w-full min-w-[520px]"), h.Role("img"), h.Aria("label", "Forest plot")),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					methTextarea("studies", 7, "Studies: name, effect, SE", "One study per line. Illustrative numbers.",
						"Ames 2015, 0.42, 0.18\nBorg 2016, 0.15, 0.10\nCruz 2017, 0.30, 0.22\nDahl 2018, 0.05, 0.08\nEllis 2020, 0.55, 0.25\nFaye 2021, 0.12, 0.07"),
					readouts([2]string{"fixed", "fe"}, [2]string{"random", "re"}, [2]string{"Q (df)", "q"}, [2]string{"I²", "i2"}, [2]string{"τ²", "tau2"}),
					stNote("Weights 1/SE² (fixed) and 1/(SE² + τ²) (random). I² = max(0, (Q − df)/Q) after Higgins & Thompson (2002)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- M8

func methWinnersBlock() Block {
	return Block{
		Slug:        "winners-curse",
		Title:       "The winner's curse",
		Description: "When studies are underpowered, the ones that reach significance are the ones that got lucky: they overestimate the effect, sometimes with the wrong sign. 5,000 simulated studies of one small effect, with the significant ones highlighted.",
		Tags:        []string{"power", "type M error", "replication"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("meth-winners",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "significant"),
						legendSwatch("color-mix(in oklab, var(--foreground) 30%, transparent)", "not significant"),
						legendSwatch("var(--vec-u)", "true effect"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Distribution of estimated effects")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Study"),
					field("d", "True effect d", "", 0.3, 0.05, 1.5, 0.05),
					field("n", "n / group", "", 20, 5, 400, 5),
				),
				stButton("reseed", hugeicons.ShuffleIcon(), "New studies"),
				readouts([2]string{"power", "power"}, [2]string{"significant", "sig"}, [2]string{"mean sig. estimate", "msig"}, [2]string{"exaggeration", "type-m"}, [2]string{"wrong sign", "type-s"}),
				stNote("Estimates d̂ ~ N(d, 2/n) (normal approximation), significant at two-sided α = .05. Exaggeration ratio and sign errors after Gelman & Carlin (2014). An exact replication with the same n succeeds with probability equal to the power."),
			)
		},
	}
}

// ---------------------------------------------------------------- M9

func methReliabilityBlock() Block {
	return Block{
		Slug:        "reliability",
		Title:       "Reliability and validity",
		Description: "A measure can be consistent without measuring the right thing. Paste item scores to get Cronbach's alpha with each item's contribution, and see the difference between reliability and validity as hits on a target.",
		Tags:        []string{"Cronbach's α", "measurement", "validity"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("meth-reliability", ""),
				h.Div(h.Class("flex flex-col gap-4 border-b p-5 lg:border-r lg:border-b-0"),
					methTextarea("items", 8, "Item scores (one person per line, one item per column)",
						"Illustrative 1–5 answers to a 5-item scale; item 5 was meant to be reverse-coded and wasn't.",
						"4 5 4 4 2\n2 2 3 2 4\n5 4 5 5 1\n3 3 3 4 3\n1 2 1 2 5\n4 4 5 4 2\n2 3 2 2 4\n5 5 4 5 1\n3 2 3 3 3\n4 4 4 3 2"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[360px] font-mono text-xs tabular-nums"),
							h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "item"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "variance"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "item–rest r"),
								h.Th(h.Class("py-1.5 font-normal"), "α if dropped"),
							)),
							h.Tbody(h.Data("rows", "")),
						),
					),
					readouts([2]string{"people × items", "shape"}, [2]string{"Cronbach's α", "alpha"}),
					stNote("α = k/(k−1) · (1 − Σ item variances / total variance), sample variances (Cronbach 1951). Common rules of thumb call α ≥ .7 acceptable; α also rises with the number of items, so it is not proof of a single construct."),
				),
				h.Div(h.Class("flex flex-col gap-3 p-5"),
					panelLabel("Reliability is not validity"),
					h.Svg(h.Data("targets", ""), h.ViewBox("0 0 400 400"), h.Class("block w-full max-w-[400px] self-center"), h.Role("img"), h.Aria("label", "Four targets: reliable and valid combinations")),
					stButton("reseed", hugeicons.ShuffleIcon(), "Shoot again"),
					stNote("Each target is a measuring instrument; the centre is the true value. Reliability is how tightly the shots group (random error); validity is whether they centre on the truth (no systematic error). Internal validity asks whether the study shows cause; external validity whether it holds beyond the sample."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- M10

var methChecklist = []string{
	"Hypotheses stated before seeing the data",
	"One primary outcome named, with how it is measured",
	"Sample size justified by a power analysis",
	"Stopping rule fixed in advance",
	"Exclusion criteria written down",
	"Analysis plan (test, covariates, α) fixed",
	"Plan registered with a timestamp (e.g. OSF, ClinicalTrials.gov)",
}

func methPlannerBlock() Block {
	return Block{
		Slug:        "study-planner",
		Title:       "Study planner",
		Description: "Plan the study before running it: the hypothesis, the primary outcome, the sample size from an exact power calculation, and a preregistration checklist, exported as Markdown to paste into a registry.",
		Tags:        []string{"power", "preregistration", "export"},
		Wide:        true,
		Render: func() h.Node {
			input := func(name, label, value string) h.Node {
				return h.Label(h.Class("flex flex-col gap-1.5"),
					h.Span(h.Class("text-sm font-medium"), label),
					h.Input(h.Type("text"), h.Data("input", name), h.Value(value), h.Attr("autocomplete", "off"), h.Class(methInputClass+" font-sans")),
				)
			}
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("meth-planner", ""),
				h.Div(h.Class("flex flex-col gap-4 border-b p-5 lg:border-r lg:border-b-0"),
					input("title", "Study", "Retrieval practice and exam scores"),
					h.Label(h.Class("flex flex-col gap-1.5"),
						h.Span(h.Class("text-sm font-medium"), "Hypothesis"),
						h.Textarea(h.Data("input", "hypothesis"), h.Attr("rows", "2"), h.Class("resize-y "+methInputClass+" font-sans"),
							"Students who quiz themselves score higher on the final exam than students who reread."),
					),
					input("outcome", "Primary outcome", "Final exam score (0–100)"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Design"),
						segs("Design", [2]string{"two", "Two groups"}, [2]string{"paired", "Paired"}),
						field("d", "Effect size d", "", 0.5, 0.05, 2, 0.05),
						field("alpha", "α (two-sided)", "", 0.05, 0.001, 0.2, 0.001),
						field("power", "Power", "", 0.8, 0.5, 0.99, 0.01),
						field("attrition", "Attrition", "%", 10, 0, 50, 1),
					),
					readouts([2]string{"n (exact t)", "nexact"}, [2]string{"n (normal approx.)", "napprox"}, [2]string{"to recruit", "recruit"}, [2]string{"achieved power", "achieved"}),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Preregistration checklist"),
					h.Ul(h.Class("flex flex-col gap-2"),
						h.MapIdx(methChecklist, func(i int, s string) h.Node {
							id := fmt.Sprintf("meth-pre-%d", i)
							return h.Li(h.Class("flex items-start gap-2.5 text-sm"),
								checkbox.Checkbox(h.ID(id), h.Data("check", s), h.Class("mt-0.5")),
								h.Label(h.For(id), h.Class("cursor-pointer leading-snug"), s))
						}),
					),
					h.Div(h.Class("flex items-center justify-between gap-2 border-t pt-4"),
						panelLabel("Markdown"),
						h.Div(h.Class("flex items-center gap-2"),
							badge.Badge(badge.VariantOutline, h.Data("out", "done"), h.Class("font-mono text-[11px] font-normal"), "0 / 7"),
							h.Span(h.Data("copy-host", ""), copyButton("", "")),
						),
					),
					h.Pre(h.Data("markdown", ""), h.Class("code scroll-thin max-h-72 overflow-auto rounded-lg border bg-code p-3 text-[12px] whitespace-pre-wrap")),
					stNote("Exact power uses the noncentral t distribution (two-sided, both tails); the normal approximation n = 2((z₁₋α/₂ + z₁₋β)/d)² is shown for comparison."),
				),
			)
		},
	}
}
