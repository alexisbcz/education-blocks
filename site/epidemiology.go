package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// EpidemiologyBlocks lists the epidemiology gallery in display order.
func EpidemiologyBlocks() []Block {
	return []Block{
		epiSIRBlock(),
		epiAgentsBlock(),
		epiFlattenBlock(),
		epiGrowthBlock(),
		epiTwoByTwoBlock(),
		epiScreeningBlock(),
		epiSnowBlock(),
		epiBathtubBlock(),
	}
}

// ---------------------------------------------------------------- E1

func epiSIRBlock() Block {
	return Block{
		Slug:        "sir",
		Title:       "SIR and SEIR models",
		Description: "The compartment models behind most outbreak forecasts, integrated with RK4. R₀ = β/γ sets whether an epidemic takes off; vaccinating a share v of the population before it starts lowers the effective number to R₀(1 − v), and above the herd-immunity threshold 1 − 1/R₀ it cannot grow.",
		Tags:        []string{"ODE", "R₀", "herd immunity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("epi-sir",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "susceptible"), legendSwatch("var(--vec-out)", "exposed"),
						legendSwatch("var(--brand)", "infectious"), legendSwatch("var(--code-add)", "recovered")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Share of the population in each compartment over time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					segs("Model", [2]string{"sir", "SIR"}, [2]string{"seir", "SEIR"}),
					field("r0", "R₀", "", 3, 0.5, 10, 0.1),
					field("inf", "Infectious period", "days", 7, 1, 30, 0.5),
					field("lat", "Latent period", "days", 4, 0.5, 20, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Before the outbreak"),
					field("vax", "Vaccinated", "%", 0, 0, 99, 1),
				),
				readouts([2]string{"R_eff", "reff"}, [2]string{"herd threshold", "herd"}, [2]string{"peak infectious", "peak"}, [2]string{"ever infected", "final"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E2

func epiAgentsBlock() Block {
	return Block{
		Slug:        "agents",
		Title:       "An outbreak, person by person",
		Description: "The same epidemic as individuals on a grid: each day an infectious person infects each neighbour with some probability, and recovers after a fixed number of days. Chance matters early (some runs fizzle out) and spatial contact makes the wave slower than the well-mixed SIR curve. Synthetic, seeded simulation.",
		Tags:        []string{"agent-based", "stochastic", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("epi-agents",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative mx-auto aspect-[3/2] w-full max-w-[540px] overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", "Grid of people coloured by state"))),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 540 110"), h.Class("mx-auto block w-full max-w-[540px]"), h.Role("img"), h.Aria("label", "Counts over time")),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "susceptible"), legendSwatch("var(--brand)", "infectious"), legendSwatch("var(--code-add)", "recovered")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Disease"),
					field("p", "Daily transmission", "per contact", 0.15, 0.01, 1, 0.01),
					field("days", "Infectious for", "days", 6, 1, 20, 1),
					field("seeds", "Initial cases", "", 3, 1, 50, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.ShuffleIcon(), "New run")),
				readouts([2]string{"day", "day"}, [2]string{"infectious", "inf"}, [2]string{"ever infected", "ever"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E3

func epiFlattenBlock() Block {
	return Block{
		Slug:        "flatten",
		Title:       "Flattening the curve",
		Description: "Distancing cuts contacts, which lowers the transmission rate from the day it starts. The peak drops and arrives later; what matters for hospitals is how much of the curve stays above their capacity. SIR model with an intervention; capacity is a share of the population needing care at once.",
		Tags:        []string{"intervention", "capacity", "SIR"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("epi-flatten",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "no intervention"), legendSwatch("var(--brand)", "with distancing"), legendSwatch("var(--code-del)", "care capacity")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Infectious share over time with and without distancing")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Outbreak"),
					field("r0", "R₀", "", 2.5, 1, 6, 0.1),
					field("care", "Need care", "% of cases", 5, 0.5, 20, 0.5),
					field("cap", "Capacity", "% of pop.", 0.5, 0.05, 5, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Distancing"),
					field("cut", "Contacts cut", "%", 40, 0, 90, 1),
					field("start", "Starts on day", "", 20, 0, 150, 1),
				),
				readouts([2]string{"peak, no action", "peak0"}, [2]string{"peak, distancing", "peak1"}, [2]string{"days over capacity", "over"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E4

func epiGrowthBlock() Block {
	return Block{
		Slug:        "growth",
		Title:       "Exponential growth and doubling time",
		Description: "Early in an outbreak, cases grow by a constant factor per day. A daily growth rate r gives a doubling time ln 2 / ln(1 + r), close to ln 2 / r when r is small; on a linear axis the curve looks flat and then explodes, on a log axis it is a straight line whose slope is r.",
		Tags:        []string{"log scale", "doubling", "intuition"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("epi-growth",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Cases over time")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Growth"),
					field("rate", "Daily growth", "%", 20, 1, 60, 0.5),
					field("c0", "Cases today", "", 10, 1, 1000, 1),
					field("days", "Days shown", "", 40, 10, 90, 1),
				),
				h.Div(h.Class("border-t pt-4"), toggle("epi-log", "log", "Log scale", false)),
				readouts([2]string{"doubling time", "dbl"}, [2]string{"×10 every", "tenfold"}, [2]string{"cases at end", "end"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E5

func epiTwoByTwoBlock() Block {
	cell := func(name string, v float64, label string) h.Node {
		return h.Label(h.Class("flex flex-col items-center gap-1 rounded-md border bg-background p-2"),
			h.Input(h.Type("text"), h.Attr("inputmode", "numeric"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
				h.Data("min", "0"), h.Data("max", "100000"), h.Data("step", "1"), h.Attr("autocomplete", "off"), h.Aria("label", label),
				h.Class("h-8 w-20 cursor-ew-resize rounded-md border border-input bg-background px-2 text-center font-mono text-sm tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
			h.Span(h.Class("text-[10px] text-muted-foreground"), label),
		)
	}
	return Block{
		Slug:        "two-by-two",
		Title:       "Risk ratio and odds ratio",
		Description: "The 2×2 table at the heart of cohort and case-control studies. Edit the counts: risk ratio, odds ratio and risk difference update with 95% confidence intervals (log method for the ratios). When the disease is rare the odds ratio approximates the risk ratio; when it is common, it does not. Illustrative counts.",
		Tags:        []string{"2×2 table", "confidence intervals", "cohort"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("epi-2x2", ""),
				h.Div(h.Class("grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 text-xs text-muted-foreground"),
					h.Span(), h.Span(h.Class("text-center"), "disease"), h.Span(h.Class("text-center"), "no disease"), h.Span(h.Class("text-center"), "risk"),
					h.Span("exposed"), cell("a", 30, "a"), cell("b", 70, "b"), h.Span(h.Data("out", "risk1"), h.Class("w-16 text-center font-mono text-foreground tabular-nums"), "—"),
					h.Span("unexposed"), cell("c", 10, "c"), cell("d", 90, "d"), h.Span(h.Data("out", "risk0"), h.Class("w-16 text-center font-mono text-foreground tabular-nums"), "—"),
				),
				h.Div(h.Class("grid gap-2 sm:grid-cols-3"),
					h.Map([][3]string{{"rr", "Risk ratio", "a/(a+b) ÷ c/(c+d)"}, {"or", "Odds ratio", "(a·d) ÷ (b·c)"}, {"rd", "Risk difference", "a/(a+b) − c/(c+d)"}}, func(m [3]string) h.Node {
						return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3"),
							h.Span(h.Class("text-xs text-muted-foreground"), m[1]),
							h.Span(h.Data("out", m[0]), h.Class("font-mono text-xl font-medium tabular-nums"), "—"),
							h.Span(h.Data("out", m[0]+"-ci"), h.Class("font-mono text-[11px] text-muted-foreground tabular-nums"), "—"),
							h.Span(h.Class("font-mono text-[10px] text-muted-foreground/70"), m[2]),
						)
					}),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Presets"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "30 70 10 90"), "Common outcome"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "30 9970 10 9990"), "Rare outcome"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "12 88 12 88"), "No association"),
				),
				h.P(h.Data("out", "note"), h.Class("text-sm leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- E6

func epiScreeningBlock() Block {
	return Block{
		Slug:        "screening",
		Title:       "Screening and its biases",
		Description: "Why earlier diagnosis can look like longer survival even when nobody lives longer. Lead-time bias: screening moves the diagnosis earlier on the same timeline. Length bias: periodic screening mostly catches slow-growing disease, which had a better outlook anyway. Schematic and simulated.",
		Tags:        []string{"lead time", "length bias", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-2"), h.Data("epi-screen", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), "Lead-time bias"),
						badge.Badge(badge.VariantOutline, h.Class("font-normal"), "one patient, two diagnoses")),
					h.Svg(h.Data("lead", ""), h.ViewBox("0 0 460 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Timeline of one patient with and without screening")),
					field("screen", "Screen at age", "", 60, 50, 69, 1),
					h.P(h.Data("out", "lead"), h.Class("text-sm leading-relaxed text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), "Length bias"),
						badge.Badge(badge.VariantOutline, h.Class("font-normal"), "200 simulated tumours")),
					h.Svg(h.Data("length", ""), h.ViewBox("0 0 460 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Preclinical phases of slow and fast tumours, and screening rounds")),
					field("interval", "Screen every", "years", 3, 1, 10, 1),
					h.P(h.Data("out", "length"), h.Class("text-sm leading-relaxed text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- E7

func epiSnowBlock() Block {
	return Block{
		Slug:        "snow",
		Title:       "John Snow and the Broad Street pump",
		Description: "The founding story of epidemiology, told with a schematic map. In 1854 Snow argued that cholera spread through water, not bad air, by showing that deaths clustered around one public pump. Toggle the nearest-pump regions to see the argument. Map and dots are schematic, not Snow's data.",
		Tags:        []string{"history", "map", "nearest pump"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("epi-snow", ""),
				h.Div(h.Class("relative border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("map", ""), h.ViewBox("0 0 520 380"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Schematic map of Soho with pumps and cases")),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5 text-sm leading-relaxed"),
					h.Div(h.Class("flex flex-col gap-3"), toggle("snow-regions", "regions", "Nearest-pump regions", false)),
					h.Dl(h.Class("flex flex-col gap-3 border-t pt-4"),
						h.Div(h.Dt(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "When and where"),
							h.Dd("Soho, London, from 31 August 1854. The outbreak is commonly cited as killing 616 people.")),
						h.Div(h.Dt(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "The argument"),
							h.Dd("Deaths clustered among people whose nearest pump was Broad Street's. The nearby workhouse and brewery, with their own water, had remarkably few cases.")),
						h.Div(h.Dt(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "The action"),
							h.Dd("On 7 September Snow presented his evidence to the parish Board of Guardians; the pump handle was removed the next day, as the outbreak was already declining.")),
						h.Div(h.Dt(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Source"),
							h.Dd(h.Span(h.Class("text-muted-foreground"), "Snow, J. (1855). "), h.Em("On the Mode of Communication of Cholera"), h.Span(h.Class("text-muted-foreground"), ", 2nd ed. London: John Churchill."))),
					),
					h.Span(h.Data("out", "share"), h.Class("rounded-md border bg-code px-3 py-2 font-mono text-xs")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- E8

func epiBathtubBlock() Block {
	return Block{
		Slug:        "bathtub",
		Title:       "Incidence and prevalence",
		Description: "Prevalence is the water in the tub; incidence is the tap; recovery and death are the drain. With a steady tap and an average illness duration D, the level settles where inflow equals outflow: prevalence ≈ incidence × D. A longer-lasting illness raises prevalence even when incidence is unchanged.",
		Tags:        []string{"stock and flow", "steady state", "intuition"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("epi-bathtub",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					h.Svg(h.Data("tub", ""), h.ViewBox("0 0 240 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Bathtub: inflow incidence, outflow recovery")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 360 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Prevalence over time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Flows"),
					field("inc", "Incidence", "per day", 20, 0, 200, 1),
					field("dur", "Duration D", "days", 10, 1, 120, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "20 10"), "Short illness"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "20 90"), "Chronic illness"),
				),
				readouts([2]string{"prevalence now", "prev"}, [2]string{"steady state", "steady"}, [2]string{"leaving per day", "out"}),
			)
		},
	}
}
