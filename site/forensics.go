package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ForensicsBlocks lists the forensic science blocks in display order. Every
// case, profile, print and population is synthetic; the models are the
// published ones, and each block says how far its numbers can be trusted.
// The 2009 NAS report and the 2016 PCAST report are the background for the
// notes on error rates. Bayes' rule in general lives in /stats, standards of
// proof in /law, PCR and gels in /genetics.
func ForensicsBlocks() []Block {
	return []Block{
		forenSTRBlock(),
		forenFallacyBlock(),
		forenImpactBlock(),
		forenOriginBlock(),
		forenCoolingBlock(),
		forenWidmarkBlock(),
		forenMinutiaeBlock(),
		forenGlassBlock(),
		forenInsectBlock(),
		forenStatureBlock(),
	}
}

// forenNote is the small print under a model: what it assumes and what
// the literature says about its error.
func forenNote(text ...any) h.Node {
	return h.P(h.Class("flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"),
		hugeicons.InformationCircleIcon(h.Class("mt-px size-3.5 shrink-0")),
		h.Span(append([]any{h.Span(h.Class("font-medium text-foreground"), "Synthetic case. "), "Educational only. "}, text...)...),
	)
}

func forenSvg(name, viewBox, label string) h.Node {
	return h.Svg(h.Data(name, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func forenButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// forenSegs is a segmented control the module tells apart by name.
func forenSegs(name, label string, opts ...[2]string) h.Node {
	return h.Div(h.Data("foren-seg", name), segs(label, opts...))
}

// forenVerdict is a live line the module fills with a short conclusion.
func forenVerdict() h.Node {
	return h.P(h.Data("verdict", ""), h.Aria("live", "polite"),
		h.Class("rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed transition-[border-color] duration-200 data-[tone=brand]:border-brand data-[tone=del]:border-del"))
}

// ---------------------------------------------------------------- F1

func forenSTRBlock() Block {
	return Block{
		Slug:        "str-profile",
		Title:       "STR profile comparison",
		Description: "A DNA profile is a list of repeat counts at short tandem repeat (STR) loci, read off an electropherogram as peaks. Two alleles per locus, one from each parent: one peak if they are the same (homozygote), two if not. Compare the crime-scene profile with a reference locus by locus; if every locus matches, the product rule multiplies the genotype frequencies p² or 2pq into a random match probability.",
		Tags:        []string{"STR", "electropherogram", "product rule", "Hardy–Weinberg"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-str",
				h.Div(h.Class("flex flex-col gap-2"),
					forenSvg("epg", "0 0 640 360", "Electropherograms of the crime-scene sample and the reference, with peaks at each locus"),
					h.Div(h.Class("overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[520px] font-mono text-[11px] tabular-nums"),
							h.Thead(h.Tr(h.Class("text-left text-muted-foreground"),
								h.Th(h.Class("py-1 pr-2 font-normal"), "Locus"),
								h.Th(h.Class("py-1 pr-2 font-normal"), "Scene"),
								h.Th(h.Class("py-1 pr-2 font-normal"), "Reference"),
								h.Th(h.Class("py-1 pr-2 font-normal"), "Allele freq."),
								h.Th(h.Class("py-1 pr-2 font-normal"), "Genotype freq."),
								h.Th(h.Class("py-1 font-normal"), ""),
							)),
							h.Tbody(h.Data("rows", "")),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reference sample from"),
					forenSegs("ref", "Reference", [2]string{"same", "Same person"}, [2]string{"sibling", "Full sibling"}, [2]string{"unrelated", "Unrelated"}),
					forenButton("reseed", "New case", hugeicons.RepeatIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Loci compared"),
					field("loci", "Number of loci", "", 10, 1, 10, 1),
				),
				readouts([2]string{"matching loci", "match"}, [2]string{"random match prob.", "rmp"}, [2]string{"1 in", "inv"}),
				forenVerdict(),
				forenNote("Locus names are real CODIS loci; alleles and frequencies are invented. The product rule assumes independent loci and Hardy–Weinberg proportions; for relatives and subpopulations it overstates rarity, so labs apply a θ correction (NRC II, 1996). A profile from a mixture or degraded sample is far harder to read than these clean peaks."),
			)
		},
	}
}

// ---------------------------------------------------------------- F2

func forenFallacyBlock() Block {
	return Block{
		Slug:        "prosecutors-fallacy",
		Title:       "The prosecutor's fallacy",
		Description: "A random match probability of 1 in 10 million is the chance that an innocent, unrelated person would match. It is not the chance that a person who matches is innocent. That depends on how many people could have left the trace, on how the suspect was found (a database trawl tries many), and on the lab's own error rate, which is usually far larger than the RMP.",
		Tags:        []string{"transposed conditional", "database search", "lab error"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-fallacy",
				h.Div(h.Class("flex flex-col gap-3"),
					forenSvg("bars", "0 0 640 200", "Expected number of people who would match, true source against coincidental matches"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						h.Div(h.Class("rounded-lg border border-del/50 bg-del/5 p-3 text-sm"),
							h.P(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Fallacy"),
							h.P(h.Data("wrong", ""), h.Class("leading-relaxed"))),
						h.Div(h.Class("rounded-lg border border-brand/50 bg-brand/5 p-3 text-sm"),
							h.P(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "What the numbers say"),
							h.P(h.Data("right", ""), h.Class("leading-relaxed"))),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Evidence"),
					field("rmp", "RMP, 1 in 10^", "", 7, 2, 12, 0.5),
					field("lab", "Lab false positive, 1 in 10^", "", 4, 2, 8, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Who could have left it"),
					field("pop", "Possible sources", "thousand", 100, 0.1, 60000, 10),
					forenSegs("found", "How the suspect was found", [2]string{"other", "Other evidence"}, [2]string{"trawl", "Database trawl"}),
					field("db", "Database size", "thousand", 5000, 1, 20000, 100),
				),
				readouts([2]string{"other matches expected", "others"}, [2]string{"P(source | match)", "post"}, [2]string{"with lab error", "postlab"}, [2]string{"trawl hits expected", "hits"}),
				forenNote("A uniform prior over the possible sources, and no other evidence. Thompson & Schumann (1987) named the fallacy; R v Deen (1994) and R v Doheny and Adams (1997) in England & Wales turned on it. Laboratory error rates are hard to measure, which the 2009 NAS report singles out."),
			)
		},
	}
}

// ---------------------------------------------------------------- F3

func forenImpactBlock() Block {
	return Block{
		Slug:        "impact-angle",
		Title:       "Impact angle from a stain",
		Description: "A drop that hits a surface at 90° leaves a circle; the shallower the angle, the longer the ellipse. Measuring the width and length of the ellipse gives the angle: sin α = W / L. The tail points the way the drop was travelling. Small errors in measuring matter most for steep angles, where the curve is flat.",
		Tags:        []string{"sin α = W/L", "directionality", "measurement error"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-impact",
				h.Div(h.Class("grid gap-3 md:grid-cols-2"),
					forenSvg("stain", "0 0 300 260", "The stain seen from above, and the drop's path seen from the side"),
					forenSvg("curve", "0 0 300 260", "Impact angle against the width-to-length ratio, with the band from a measurement error"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Measured stain"),
					field("w", "Width W", "mm", 3.0, 0.5, 8, 0.1),
					field("l", "Length L", "mm", 6.0, 0.5, 20, 0.1),
					field("gamma", "Direction γ", "°", 30, 0, 359, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Ruler"),
					field("err", "Measurement error ±", "mm", 0.1, 0, 0.5, 0.05),
				),
				readouts([2]string{"W / L", "ratio"}, [2]string{"impact angle α", "alpha"}, [2]string{"α range", "range"}),
				forenNote("Length is measured on the ellipse only, without the tail. The relation holds best between about 10° and 75° on smooth, non-absorbent surfaces; rough surfaces distort the shape (SWGSTAIN guidance). The 2009 NAS report calls bloodstain pattern opinions \"more subjective than scientific\"."),
			)
		},
	}
}

// ---------------------------------------------------------------- F4

func forenOriginBlock() Block {
	return Block{
		Slug:        "area-of-origin",
		Title:       "Area of origin",
		Description: "Several stains on the floor, each with its direction and impact angle. Drawn back along their directions, they converge near the point above which the drops were released; each stain's angle then gives a height, h = d · tan α. The tangent method assumes straight flight; real drops fall in curves, so it overestimates the height. Show the true source, drag it on the plan, and compare.",
		Tags:        []string{"convergence", "tangent method", "ballistics"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-origin",
				h.Div(h.Class("grid gap-3 md:grid-cols-[3fr_2fr]"),
					h.Div(h.Attr("tabindex", "0"), h.Class("rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("plan-wrap", ""), forenSvg("plan", "0 0 360 320", "Plan of the floor with stains, their directions and the area of convergence. With the true source shown, drag it or use the arrow keys.")),
					forenSvg("side", "0 0 260 320", "Side view: true heights of release against tangent-method estimates"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Source (hidden)"),
					field("z", "Height", "cm", 100, 20, 180, 5),
					field("v", "Drop speed", "m/s", 3, 1, 10, 0.5),
					field("n", "Stains", "", 10, 3, 20, 1),
					toggle("foren-origin-gravity", "gravity", "Drops fall under gravity", true),
					toggle("foren-origin-true", "truth", "Show the true source", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Analyst"),
					field("noise", "Angle error ±", "°", 2, 0, 10, 0.5),
					forenButton("reseed", "New spatter", hugeicons.RepeatIcon()),
				),
				readouts([2]string{"convergence error", "cerr"}, [2]string{"height estimate", "zest"}, [2]string{"true height", "ztrue"}, [2]string{"overestimate", "over"}),
				forenNote("Drops leave the source in random directions and elevations; the floor positions and impact angles come from their exact paths (no air drag). Convergence is the least-squares point closest to all direction lines. The height estimate is the median of d · tan α over the stains."),
			)
		},
	}
}

// ---------------------------------------------------------------- F5

func forenCoolingBlock() Block {
	return Block{
		Slug:        "time-since-death",
		Title:       "Time since death from body cooling",
		Description: "After death the body cools towards the room, slowly at first (a plateau) and then exponentially. Henssge's model, built on Marshall and Hoare's double exponential, gives the rectal temperature at time t from the ambient temperature and body mass. Inverting it turns one measurement into an estimate, with 95% limits that widen as the body nears room temperature.",
		Tags:        []string{"Henssge", "Marshall–Hoare", "uncertainty"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-cooling",
				forenSvg("plot", "0 0 600 300", "Rectal temperature against time since death, with the measured temperature and the estimate's 95% band"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("At the scene"),
					field("tr", "Rectal temperature", "°C", 28, 10, 37, 0.1),
					field("ta", "Ambient temperature", "°C", 15, -5, 30, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Body"),
					field("m", "Body mass", "kg", 75, 20, 150, 1),
					field("cf", "Corrective factor", "×", 1, 0.7, 1.8, 0.05),
				),
				readouts([2]string{"Q", "q"}, [2]string{"estimate", "t"}, [2]string{"95% limits", "band"}, [2]string{"B", "b"}),
				forenNote("Q = (Tr − Ta)/(37.2 − Ta) = 1.25 e^(Bt) − 0.25 e^(5Bt) for Ta ≤ 23.2 °C (1.11 and 0.11 above), with B = −1.2815 · m^(−0.625) + 0.0284 and m the corrected mass. Corrective factors (clothing, covers, wind, water) multiply the mass. The band follows Henssge's published permissible variation (±2.8 h, ±4.5 h, ±7 h as Q falls), approximately. Fever, hypothermia or a moved body break the model."),
			)
		},
	}
}

// ---------------------------------------------------------------- F6

func forenWidmarkBlock() Block {
	return Block{
		Slug:        "widmark",
		Title:       "Blood alcohol back-calculation",
		Description: "Widmark's formula spreads the ethanol drunk through the body's water: peak BAC = A / (r · W), then the body removes it at a nearly constant rate β. A test taken hours after an incident is projected back by adding β times the delay. β varies between people from about 0.10 to 0.25 g/L per hour, so the back-calculated value is a range, not a number.",
		Tags:        []string{"Widmark", "elimination rate", "interval"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-widmark",
				forenSvg("plot", "0 0 600 300", "Blood alcohol concentration against time, with the back-calculated range at the incident"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Drinker"),
					field("a", "Ethanol drunk", "g", 40, 5, 200, 1),
					field("w", "Body mass", "kg", 80, 40, 150, 1),
					field("r", "Widmark factor r", "", 0.68, 0.45, 0.9, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Test"),
					field("bac", "Measured BAC", "g/L", 0.4, 0, 3, 0.01),
					field("delay", "Hours after incident", "h", 2, 0, 8, 0.25),
					field("limit", "Legal limit", "g/L", 0.8, 0.2, 1, 0.1),
				),
				readouts([2]string{"Widmark peak", "peak"}, [2]string{"at incident, β 0.10", "lo"}, [2]string{"at incident, β 0.25", "hi"}, [2]string{"range used", "used"}, [2]string{"over the limit?", "over"}),
				forenVerdict(),
				forenNote("r is about 0.68 for men and 0.55 for women on average, with wide individual spread. Back-calculation assumes the drinker was already past absorption at the incident; drinking shortly before, or after, the incident makes it overstate the level. 0.8 g/L is the England & Wales driving limit (80 mg/100 mL); many countries use 0.5."),
			)
		},
	}
}

// ---------------------------------------------------------------- F7

func forenMinutiaeBlock() Block {
	return Block{
		Slug:        "minutiae",
		Title:       "Fingerprint minutiae",
		Description: "Examiners compare the places where ridges end or split (minutiae) between a partial mark and a reference print. Rotate and slide the mark over the reference; a minutia pairs when a reference minutia of the same kind lies close by with a similar direction. A different finger also pairs some by chance, which is why the number of agreements alone does not decide.",
		Tags:        []string{"minutiae", "alignment", "error rates"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-minutiae",
				forenSvg("print", "0 0 420 420", "Reference print with ridges and minutiae, and the latent mark's minutiae overlaid"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reference"),
					forenSegs("ref", "Reference", [2]string{"source", "Same finger"}, [2]string{"other", "Different finger"}),
					forenButton("reseed", "New mark", hugeicons.RepeatIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Place the mark"),
					field("rot", "Rotation", "°", 0, -180, 180, 1),
					field("dx", "Shift x", "px", 0, -150, 150, 1),
					field("dy", "Shift y", "px", 0, -150, 150, 1),
					forenButton("align", "Best alignment", hugeicons.Target02Icon()),
				),
				readouts([2]string{"mark minutiae", "nm"}, [2]string{"paired", "paired"}, [2]string{"unpaired", "unpaired"}),
				h.Div(h.Class("flex flex-wrap gap-3 text-xs text-muted-foreground"),
					legendSwatch("var(--foreground)", "reference"), legendSwatch("var(--vec-u)", "mark"), legendSwatch("var(--brand)", "paired")),
				forenNote("Ridges and minutiae are drawn from a simple loop pattern with random minutiae. Ulery et al. (2011), the FBI black-box study, found 0.1% false positives and 7.5% false negatives among examiners; PCAST (2016) cited false-positive rates that could be as high as 1 in 306 and 1 in 18 in two studies. Most jurisdictions no longer use a fixed minimum number of points."),
			)
		},
	}
}

// ---------------------------------------------------------------- F8

func forenGlassBlock() Block {
	return Block{
		Slug:        "glass",
		Title:       "Glass refractive index",
		Description: "Fragments on a suspect's clothing are compared with the broken window by refractive index. Two questions, often confused: are the measurements indistinguishable (a match criterion), and how common is that refractive index among glass in general? Float glass is very uniform, so many windows share a value; a match says little unless the value is rare.",
		Tags:        []string{"refractive index", "match criteria", "likelihood ratio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-glass",
				h.Div(h.Class("flex flex-col gap-3"),
					forenSvg("dots", "0 0 600 140", "Refractive index of the control and recovered fragments with the match windows"),
					forenSvg("pop", "0 0 600 200", "Distribution of refractive index in a reference collection of glass, with the recovered value marked"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Broken window"),
					forenSegs("glass", "Window glass", [2]string{"common", "Common value"}, [2]string{"rare", "Unusual value"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Recovered fragments"),
					field("shift", "Offset from control", "×10⁻⁵", 0, -20, 20, 0.5),
					field("nrec", "Fragments", "", 3, 1, 8, 1),
					forenButton("reseed", "Remeasure", hugeicons.RepeatIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Criterion"),
					forenSegs("crit", "Criterion", [2]string{"range", "Range ±2 sd"}, [2]string{"welch", "Welch t-test"}),
				),
				readouts([2]string{"control mean", "cm"}, [2]string{"recovered mean", "rm"}, [2]string{"criterion", "crit"}, [2]string{"frequency", "freq"}, [2]string{"LR ≈ 1/f", "lr"}),
				forenVerdict(),
				forenNote("Measurements simulate GRIM-style refractive index readings (sd 4×10⁻⁵); the ±2 sd window uses the larger of the control's sample sd and that instrument precision. The reference collection is synthetic. The likelihood ratio here ignores transfer and persistence: how likely it is to find glass on clothing at all, which Evett and others built into fuller models."),
			)
		},
	}
}

// ---------------------------------------------------------------- F9

func forenInsectBlock() Block {
	return Block{
		Slug:        "entomology",
		Title:       "Blowfly development and minimum PMI",
		Description: "Blowflies lay eggs on a body within hours, and their larvae develop at a rate set by temperature. Development is counted in accumulated degree hours (ADH) above a base temperature. Counting backwards from discovery until the hours add up to the oldest stage found gives a minimum post-mortem interval: the eggs cannot be older than that.",
		Tags:        []string{"ADH", "base temperature", "minimum PMI"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-insect",
				forenSvg("plot", "0 0 600 320", "Scene temperature over the days before discovery, and the degree hours accumulated backwards"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Oldest stage found"),
					forenSegs("stage", "Stage",
						[2]string{"egg", "Egg"}, [2]string{"l1", "L1"}, [2]string{"l2", "L2"}, [2]string{"l3", "L3"}, [2]string{"post", "Post-feed"}, [2]string{"pupa", "Pupa"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Scene temperature"),
					field("mean", "Daily mean", "°C", 18, 5, 35, 0.5),
					field("amp", "Day–night swing ±", "°C", 5, 0, 12, 0.5),
					field("base", "Base temperature", "°C", 9, 0, 15, 0.5),
				),
				readouts([2]string{"ADH needed", "need"}, [2]string{"minimum PMI", "pmi"}, [2]string{"at constant mean", "pmic"}),
				forenNote("Stage thresholds are illustrative values of the order reported for Lucilia sericata (e.g. Grassberger & Reiter 2001), not casework data. Real estimates use species-specific curves, weather-station corrections, maggot-mass heat and the delay before flies arrive; the result is a minimum, not the time of death."),
			)
		},
	}
}

// ---------------------------------------------------------------- F10

func forenStatureBlock() Block {
	return Block{
		Slug:        "stature",
		Title:       "Stature from a footprint",
		Description: "Foot length and height are correlated, so a regression on a reference sample predicts the height of whoever left a print. The fitted line is the easy part; the honest answer is the prediction interval, which includes the scatter of individuals around the line and is far wider than the confidence band for the line itself.",
		Tags:        []string{"regression", "prediction interval", "sample size"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("foren-stature",
				forenSvg("plot", "0 0 600 320", "Stature against foot length in a reference sample, with the fitted line, its confidence band and the prediction interval"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Print"),
					field("foot", "Foot length", "cm", 26, 20, 32, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Reference sample"),
					field("n", "People measured", "", 40, 8, 200, 1),
					forenButton("reseed", "New sample", hugeicons.RepeatIcon()),
					toggle("foren-stature-ci", "ci", "Show confidence band", true),
				),
				readouts([2]string{"stature = a + b·foot", "fit"}, [2]string{"r", "r"}, [2]string{"predicted", "pred"}, [2]string{"95% prediction", "pi"}, [2]string{"95% line CI", "ci"}),
				forenNote("The sample is synthetic, drawn around stature ≈ 6.6 × foot length with individual scatter. A print is not a foot: shoes, gait and the surface change its length, and a regression from one population transfers poorly to another."),
			)
		},
	}
}
