package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// Data visualization: the craft of charts. Chart colours come from the
// dataviz skill's validated reference palette (categorical slots 1–8, a
// one-hue blue ramp, a blue↔red diverging pair with a grey midpoint),
// picked per theme in dataviz.js; UI chrome keeps the site's tokens.

// DatavizBlocks lists the data visualization gallery in display order.
func DatavizBlocks() []Block {
	return []Block{
		dvPerceptionBlock(),
		dvChooserBlock(),
		dvMisleadBlock(),
		dvColorBlock(),
		dvMultiplesBlock(),
		dvOverplotBlock(),
		dvLogBlock(),
		dvUncertaintyBlock(),
		dvSameStatsBlock(),
		dvGrammarBlock(),
	}
}

// dvTip is the hover tooltip every chart in this collection shares.
func dvTip() h.Node {
	return h.Div(h.Data("tip", ""), h.Hidden(), h.Aria("hidden", "true"),
		h.Class("pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 font-mono text-[11px] whitespace-pre text-popover-foreground shadow-md"))
}

func dvSvg(view, label string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(view), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func dvButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func dvNote(s ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, s...)...)
}

// ---------------------------------------------------------------- DV1

func dvPerceptionBlock() Block {
	return Block{
		Slug:        "perception",
		Title:       "Which encoding can you read?",
		Description: "Cleveland & McGill (1984) ranked how accurately people judge values: position on a common scale beats length, which beats angle, which beats area. Run the experiment on yourself: estimate what percentage the smaller mark is of the larger, five times per encoding.",
		Tags:        []string{"perception", "self-test", "Cleveland & McGill"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-perception",
				h.Div(h.Class("relative flex flex-col gap-3"),
					h.Div(h.Class("flex items-center justify-between gap-3 px-1 pt-1 text-xs text-muted-foreground"),
						h.Span(h.Data("out", "trial"), "—"),
						h.Span(h.Data("out", "encoding"), h.Class("font-mono"), "—"),
					),
					h.Div(h.Class("mx-auto w-full max-w-[460px] rounded-lg border bg-background"), dvSvg("0 0 460 260", "Two marks to compare")),
					h.Div(h.Class("mx-auto w-full max-w-[460px]"), h.Svg(h.Data("result", ""), h.ViewBox("0 0 460 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Your error per encoding"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Your estimate"),
					h.P(h.Class("text-sm"), "The smaller mark is what percent of the larger?"),
					h.Form(h.Data("guess", ""), h.Class("flex items-center gap-2"),
						h.Input(h.Type("number"), h.Attr("inputmode", "numeric"), h.Attr("min", "0"), h.Attr("max", "100"), h.Name("pct"), h.Aria("label", "Percent"),
							h.Class("h-9 w-24 rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
						h.Span(h.Class("text-sm text-muted-foreground"), "%"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), "Answer"),
					),
					h.P(h.Data("out", "feedback"), h.Aria("live", "polite"), h.Class("min-h-5 font-mono text-xs text-muted-foreground")),
				),
				h.Div(h.Class("flex gap-2"), dvButton("restart", "Restart", hugeicons.RefreshIcon())),
				dvNote("Error is Cleveland & McGill's log₂(|judged − true| + ⅛), averaged per encoding; lower is better. Your own run, 5 trials each, so expect noise."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV2

func dvChooserBlock() Block {
	return Block{
		Slug:        "chart-chooser",
		Title:       "Chart chooser",
		Description: "The data's job picks the form, not taste. Pick what you want the reader to see and the shape of your data; the block recommends a form, says why, and draws it on a synthetic dataset. Sometimes the best chart is a number.",
		Tags:        []string{"form", "decision", "synthetic data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-chooser",
				h.Div(h.Class("relative flex flex-col gap-2"),
					h.Div(h.Class("flex items-baseline justify-between gap-3 px-1 pt-1"),
						h.Span(h.Data("out", "form"), h.Class("text-sm font-medium"), "—"),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "synthetic data"),
					),
					dvSvg("0 0 560 300", "Recommended chart"),
					dvTip(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("The reader should see"),
					h.Div(h.Class("flex flex-col gap-1.5"), h.Role("radiogroup"), h.Data("tasks", ""),
						h.Map([][2]string{
							{"headline", "One number that matters"},
							{"compare", "Which category is bigger"},
							{"trend", "Change over time"},
							{"part", "Parts of a whole"},
							{"distribution", "How values are spread"},
							{"relation", "How two measures relate"},
							{"polarity", "Above or below a reference"},
						}, func(o [2]string) h.Node {
							return h.Button(h.Type("button"), h.Role("radio"), h.Data("task", o[0]), h.Aria("checked", h.Ternary(o[0] == "compare", "true", "false")),
								h.Class("rounded-md border px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-foreground/40 aria-checked:text-foreground"),
								o[1])
						}),
					),
				),
				h.P(h.Data("out", "why"), h.Class("border-t pt-4 text-sm leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- DV3

func dvMisleadBlock() Block {
	return Block{
		Slug:        "misleading",
		Title:       "Misleading charts lab",
		Description: "Five ways a chart lies with true numbers: a truncated axis, a second y-axis, area scaled like length, a cherry-picked window, and 3D. Each trick on the left, the honest chart of the same data on the right.",
		Tags:        []string{"honesty", "before / after", "axes"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"), h.Data("dv-mislead", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Trick", [2]string{"truncated", "Truncated axis"}, [2]string{"dual", "Two y-axes"}, [2]string{"area", "Area as length"}, [2]string{"window", "Cherry-picked window"}, [2]string{"threed", "3D pie"}),
				),
				h.Div(h.Class("grid gap-3 md:grid-cols-2"),
					h.Figure(h.Class("relative flex flex-col gap-1 rounded-lg border bg-code p-2"),
						h.Figcaption(h.Class("flex items-center gap-1.5 px-1 text-xs font-medium text-del"), hugeicons.Alert02Icon(h.Class("size-3.5")), "Misleading"),
						h.Svg(h.Data("bad", ""), h.ViewBox("0 0 420 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Misleading version")),
					),
					h.Figure(h.Class("relative flex flex-col gap-1 rounded-lg border bg-code p-2"),
						h.Figcaption(h.Class("flex items-center gap-1.5 px-1 text-xs font-medium text-add"), hugeicons.CheckmarkCircle02Icon(h.Class("size-3.5")), "Honest"),
						h.Svg(h.Data("good", ""), h.ViewBox("0 0 420 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Honest version")),
					),
				),
				h.P(h.Data("out", "explain"), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- DV4

func dvColorBlock() Block {
	return Block{
		Slug:        "color-scales",
		Title:       "Colour scales",
		Description: "Colour has a job: magnitude wants one hue from light to dark, polarity wants two hues around a grey midpoint, identity wants distinct hues in a fixed order. The OKLab lightness profile under the map shows why a rainbow fails: its lightness jumps, so the eye sees edges that aren't in the data.",
		Tags:        []string{"OKLab", "colour-blind check", "heatmap"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-color",
				h.Div(h.Class("relative flex flex-col gap-2"),
					dvSvg("0 0 560 300", "Synthetic field coloured by the chosen scale"),
					h.Svg(h.Data("profile", ""), h.ViewBox("0 0 560 90"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "OKLab lightness across the scale")),
					dvTip(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scale"),
					segs("Scale", [2]string{"sequential", "Sequential"}, [2]string{"diverging", "Diverging"}, [2]string{"rainbow", "Rainbow"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Vision"),
					segs("Simulation", [2]string{"normal", "Normal"}, [2]string{"deutan", "Deuteranopia"}, [2]string{"protan", "Protanopia"}),
				),
				readouts([2]string{"lightness", "mono"}, [2]string{"steps", "steps"}, [2]string{"verdict", "verdict"}),
				dvNote("Colour-blind simulation uses the Machado, Oliveira & Fernandes (2009) matrices at full severity, applied in linear RGB."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV5

func dvMultiplesBlock() Block {
	return Block{
		Slug:        "small-multiples",
		Title:       "Spaghetti or small multiples",
		Description: "Eight series on one plot become spaghetti: no line can be followed and eight hues blur. Two fixes: give every series its own panel on a shared scale (Tufte's small multiples), or keep one plot and highlight the series that matters while the rest recede to grey.",
		Tags:        []string{"small multiples", "emphasis", "crosshair"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-multiples",
				h.Div(h.Class("relative"), dvSvg("0 0 560 320", "Eight synthetic series"), dvTip()),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Layout"),
					segs("Layout", [2]string{"spaghetti", "Spaghetti"}, [2]string{"multiples", "Small multiples"}, [2]string{"highlight", "Highlight one"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Highlight"),
					h.Div(h.Data("series-picks", ""), h.Class("flex flex-wrap gap-1.5")),
				),
				dvNote("Synthetic monthly series, seeded. Panels share one y-scale, so heights compare across them."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV6

func dvOverplotBlock() Block {
	return Block{
		Slug:        "overplotting",
		Title:       "Twenty thousand points",
		Description: "A scatter of 20,000 points is a black blob: the dense core hides how dense it is. Transparency, hexagonal binning and a 2D histogram turn the same points into a readable density, and reveal the second cluster the raw plot buries.",
		Tags:        []string{"canvas", "hexbin", "density"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-overplot",
				h.Div(h.Class("relative mx-auto aspect-[4/3] w-full max-w-[560px] overflow-hidden rounded-lg border bg-background"),
					h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", "Scatter of 20,000 synthetic points")),
					dvTip(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mark"),
					segs("Mark", [2]string{"raw", "Raw dots"}, [2]string{"alpha", "Transparency"}, [2]string{"hexbin", "Hexbin"}, [2]string{"hist2d", "2D histogram"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Settings"),
					field("alpha", "Opacity", "", 0.05, 0.01, 1, 0.01),
					field("bin", "Bin size", "px", 14, 6, 40, 1),
				),
				readouts([2]string{"points", "n"}, [2]string{"densest bin", "max"}),
				dvNote("Seeded synthetic mixture: a large correlated cluster and a small offset one (15% of points)."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV7

func dvLogBlock() Block {
	return Block{
		Slug:        "log-scale",
		Title:       "Linear or log",
		Description: "On a linear axis exponential growth looks flat, then explodes, and the early series are invisible. On a log axis a constant growth rate is a straight line, so slopes compare rates directly and a change of rate shows as a bend. Hover to read the values.",
		Tags:        []string{"log scale", "growth", "crosshair"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-log",
				h.Div(h.Class("relative"), dvSvg("0 0 560 320", "Three growing series"), dvTip()),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Y axis"),
					segs("Y axis", [2]string{"linear", "Linear"}, [2]string{"log", "Log"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Growth per step"),
					field("ra", "Series A", "%", 20, 1, 60, 1),
					field("rb", "Series B", "%", 10, 1, 60, 1),
					field("rc", "Series C", "%", 35, 1, 60, 1),
				),
				readouts([2]string{"doubling A", "da"}, [2]string{"doubling B", "db"}, [2]string{"doubling C", "dc"}),
				dvNote("Series C slows to 5% from step 18: on the log axis that is a visible bend; on the linear axis it hides in the curve."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV8

func dvUncertaintyBlock() Block {
	return Block{
		Slug:        "uncertainty",
		Title:       "Showing uncertainty",
		Description: "The same four estimates, each with a normal sampling distribution, drawn four ways. Error bars are read as hard edges; a gradient fades with probability; a quantile dotplot (Kay et al. 2016) shows 20 equally likely outcomes, so 'how often would this be below zero?' becomes counting dots.",
		Tags:        []string{"intervals", "quantile dotplot", "gradient"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-uncert",
				h.Div(h.Class("relative"), dvSvg("0 0 560 300", "Four estimates with uncertainty"), dvTip()),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Encoding"),
					segs("Encoding", [2]string{"bars", "Error bars"}, [2]string{"band", "Interval band"}, [2]string{"gradient", "Gradient"}, [2]string{"dots", "Quantile dots"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Interval"),
					field("level", "Confidence", "%", 95, 50, 99, 1),
				),
				readouts([2]string{"z", "z"}, [2]string{"P(D < 0)", "pbelow"}),
				dvNote("Estimates: A 2.0 ± 1.0, B 1.2 ± 0.8, C 0.4 ± 0.6, D −0.3 ± 1.2 (mean ± standard error, illustrative)."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV9

func dvSameStatsBlock() Block {
	return Block{
		Slug:        "same-stats",
		Title:       "Same statistics, different shapes",
		Description: "Any point cloud can be bent to share exact summary statistics with another. Pick shapes and target statistics: each set is standardised, its y made exactly r-correlated with x by Gram–Schmidt, then rescaled. Every panel then reports identical means, standard deviations and correlation, and looks nothing alike.",
		Tags:        []string{"summary statistics", "Gram–Schmidt", "plot your data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dv-samestats",
				h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-4"), h.Data("panels", "")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Target statistics"),
					field("mx", "Mean x", "", 50, 0, 100, 1),
					field("my", "Mean y", "", 50, 0, 100, 1),
					field("sx", "SD x", "", 15, 2, 40, 0.5),
					field("sy", "SD y", "", 15, 2, 40, 0.5),
					field("r", "Correlation", "", -0.1, -0.95, 0.95, 0.01),
				),
				dvButton("reseed", "New noise", hugeicons.ShuffleIcon()),
				dvNote("Method: for each shape, z-score x; z-score y, remove its projection on x, renormalise (w), then y = mean + sd·(r·zx + √(1−r²)·w). Means, SDs and r match to rounding; the shapes are sheared versions of the originals. Not the Datasaurus Dozen data (Matejka & Fitzmaurice 2017), which uses simulated annealing; see /stats for Anscombe's quartet."),
			)
		},
	}
}

// ---------------------------------------------------------------- DV10

const dvGrammarSpec = `{
  "data": [
    {"month": 1, "sales": 12, "region": "North"},
    {"month": 2, "sales": 18, "region": "North"},
    {"month": 3, "sales": 15, "region": "North"},
    {"month": 4, "sales": 24, "region": "North"},
    {"month": 1, "sales": 8,  "region": "South"},
    {"month": 2, "sales": 11, "region": "South"},
    {"month": 3, "sales": 17, "region": "South"},
    {"month": 4, "sales": 19, "region": "South"}
  ],
  "mark": "line",
  "encoding": {
    "x": {"field": "month"},
    "y": {"field": "sales"},
    "color": {"field": "region"}
  }
}`

func dvGrammarBlock() Block {
	return Block{
		Slug:        "grammar",
		Title:       "A grammar of graphics",
		Description: "A chart is data, a mark and encodings that map fields to channels (Wilkinson 1999; the idea behind ggplot2 and Vega-Lite). Edit the spec: change the mark to bar or point, map color to a field, swap x and y. The chart is rebuilt from the JSON on every keystroke.",
		Tags:        []string{"spec", "JSON", "Vega-Lite style"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"), h.Data("dv-grammar", ""),
				h.Div(h.Class("flex min-w-0 flex-col border-b lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex h-10 items-center justify-between gap-2 border-b bg-code-panel px-3 text-[13px]"),
						h.Span("spec.json"),
						h.Div(h.Class("flex items-center gap-1 rounded-lg border bg-background p-0.5"), h.Role("tablist"), h.Aria("label", "Example"),
							segButton("line", "Line", true), segButton("bar", "Bar", false), segButton("point", "Point", false)),
					),
					h.Textarea(h.Data("spec", ""), h.Aria("label", "Chart specification (JSON)"), h.Attr("spellcheck", "false"), h.Attr("autocapitalize", "off"),
						h.Class("code min-h-[340px] w-full flex-1 resize-y bg-code p-3 text-base outline-none md:text-[13px]"), dvGrammarSpec),
					h.P(h.Data("out", "error"), h.Aria("live", "polite"), h.Class("min-h-6 border-t bg-code px-3 py-1.5 font-mono text-[11px] text-muted-foreground"), "valid spec"),
				),
				h.Div(h.Class("relative min-w-0 bg-code p-3"), dvSvg("0 0 520 340", "Chart drawn from the spec"), dvTip()),
			)
		},
	}
}
