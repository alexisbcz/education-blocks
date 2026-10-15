package site

import (
	"strconv"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	switchui "github.com/alexisbcz/components/ui/switch"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PharmacologyBlocks lists the pharmacology gallery in display order.
// Every model uses illustrative parameters for a generic drug: these are
// teaching models, never dosing tools.
func PharmacologyBlocks() []Block {
	return []Block{
		pharmSingleDoseBlock(),
		pharmMultipleDoseBlock(),
		pharmInfusionBlock(),
		pharmTwoCompBlock(),
		pharmTherapeuticIndexBlock(),
		pharmBindingBlock(),
		pharmInteractionBlock(),
		pharmSaturableBlock(),
		pharmPopulationBlock(),
		pharmTrialsBlock(),
	}
}

// pharmNote is the warning every dosing-related block carries.
func pharmNote() h.Node {
	return h.P(h.Class("flex gap-2 rounded-lg border border-del/30 bg-del/5 p-2.5 text-xs leading-relaxed text-muted-foreground"),
		hugeicons.Alert02Icon(h.Class("mt-px size-3.5 shrink-0 text-del")),
		h.Span(h.Span(h.Class("font-medium text-foreground"), "Educational model. "),
			"A generic drug with illustrative parameters: not medical advice, never use it for dosing."))
}

func pharmPlot(attr, label string, w, hgt int) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox("0 0 "+strconv.Itoa(w)+" "+strconv.Itoa(hgt)), h.Class("block w-full"), h.Role("img"), h.Aria("label", label))
}

func pharmLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

// ---------------------------------------------------------------- P1

func pharmSingleDoseBlock() Block {
	return Block{
		Slug:        "single-dose",
		Title:       "One-compartment kinetics",
		Description: "A single dose into one well-mixed compartment. An IV bolus starts at D/V and decays as e^(−kt) with k = CL/V; an oral dose climbs and falls along the Bateman curve. Half-life, Cmax, tmax and AUC = F·D/CL are read off the same model.",
		Tags:        []string{"PK", "Bateman", "log scale"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-single",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--foreground)", "selected route"}, [2]string{"var(--vec-u)", "IV bolus (reference)"}),
					pharmPlot("plot", "Plasma concentration over time", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Route"),
					segs("Route", [2]string{"iv", "IV bolus"}, [2]string{"oral", "Oral"}),
					h.Div(h.Class("flex items-center justify-between gap-3 pt-1"),
						h.Span(h.Class("text-sm text-muted-foreground"), "Log scale"),
						pharmSwitch("pharm-single-log", "log", "Log scale"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Drug (illustrative)"),
					field("dose", "Dose", "mg", 500, 10, 2000, 10),
					field("v", "Volume V", "L", 40, 5, 300, 1),
					field("cl", "Clearance", "L/h", 5, 0.2, 50, 0.1),
					field("ka", "Absorption ka", "1/h", 1.2, 0.05, 6, 0.05),
					field("f", "Bioavailability F", "", 0.7, 0.05, 1, 0.01),
				),
				readouts([2]string{"k = CL/V", "k"}, [2]string{"half-life", "thalf"}, [2]string{"Cmax", "cmax"}, [2]string{"tmax", "tmax"}, [2]string{"AUC", "auc"}),
				pharmNote(),
			)
		},
	}
}

// pharmSwitch is a switch whose label sits beside it in the markup.
func pharmSwitch(id, name, label string) h.Node {
	return switchui.Switch(h.ID(id), h.Data("toggle", name), h.Aria("label", label))
}

// ---------------------------------------------------------------- P2

func pharmMultipleDoseBlock() Block {
	return Block{
		Slug:        "multiple-dosing",
		Title:       "Repeated dosing to steady state",
		Description: "The same dose every τ hours adds up: each dose rides on what is left of the last ones. The peaks and troughs climb toward a steady state, reached at about 97% after five half-lives, with accumulation factor 1/(1 − e^(−kτ)). The green band is an illustrative therapeutic window.",
		Tags:        []string{"superposition", "accumulation", "window"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-multi",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--foreground)", "concentration"}, [2]string{"var(--code-add)", "therapeutic window"}, [2]string{"var(--code-del)", "toxic range"}),
					pharmPlot("plot", "Concentration under repeated dosing", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Regimen (illustrative)"),
					segs("Route", [2]string{"iv", "IV bolus"}, [2]string{"oral", "Oral"}),
					field("dose", "Dose", "mg", 300, 10, 2000, 10),
					field("tau", "Interval τ", "h", 8, 1, 48, 1),
					field("thalf", "Half-life", "h", 8, 0.5, 72, 0.5),
					field("v", "Volume V", "L", 40, 5, 300, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Window (illustrative)"),
					field("mec", "Min. effective", "mg/L", 4, 0.1, 50, 0.1),
					field("mtc", "Min. toxic", "mg/L", 18, 0.5, 100, 0.5),
				),
				readouts([2]string{"accumulation", "r"}, [2]string{"Css max", "cmax"}, [2]string{"Css min", "cmin"}, [2]string{"after 5 t½", "five"}, [2]string{"verdict", "verdict"}),
				pharmNote(),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func pharmInfusionBlock() Block {
	return Block{
		Slug:        "infusion",
		Title:       "Infusion and loading dose",
		Description: "A constant-rate infusion approaches Css = R₀/CL with the drug's half-life, so it takes hours to get there. A loading dose of Css·V fills the volume at once. Stop the infusion and the concentration decays from wherever it is.",
		Tags:        []string{"steady state", "loading dose"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-infusion",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--foreground)", "infusion only"}, [2]string{"var(--brand)", "with loading dose"}, [2]string{"var(--code-add)", "target Css"}),
					pharmPlot("plot", "Concentration during and after an infusion", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Infusion (illustrative)"),
					field("rate", "Rate R₀", "mg/h", 50, 1, 500, 1),
					field("cl", "Clearance", "L/h", 5, 0.2, 50, 0.1),
					field("v", "Volume V", "L", 40, 5, 300, 1),
					field("stop", "Stop at", "h", 36, 2, 72, 1),
				),
				h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
					h.Span(h.Class("text-sm"), "Give a loading dose"),
					pharmSwitch("pharm-inf-load", "load", "Give a loading dose"),
				),
				readouts([2]string{"Css = R₀/CL", "css"}, [2]string{"loading dose", "ld"}, [2]string{"half-life", "thalf"}, [2]string{"90% of Css", "t90"}),
				pharmNote(),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func pharmTwoCompBlock() Block {
	return Block{
		Slug:        "two-compartment",
		Title:       "Two-compartment model",
		Description: "Many drugs first spread from blood into tissues, then leave the body. After an IV bolus the log-concentration curve bends: a steep distribution phase (α) then a slower elimination phase (β), C(t) = A·e^(−αt) + B·e^(−βt). The dashed lines are the two exponentials.",
		Tags:        []string{"biexponential", "α and β phases"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-two",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--foreground)", "central compartment"}, [2]string{"var(--vec-u)", "peripheral (amount/V₁)"}, [2]string{"var(--brand)", "A·e^(−αt), B·e^(−βt)"}),
					pharmPlot("plot", "Biexponential decline on a log axis", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rate constants (illustrative)"),
					field("dose", "Dose", "mg", 500, 10, 2000, 10),
					field("v1", "Central V₁", "L", 15, 2, 100, 1),
					field("k12", "k₁₂ (to tissue)", "1/h", 1.5, 0, 5, 0.05),
					field("k21", "k₂₁ (back)", "1/h", 0.6, 0.01, 5, 0.01),
					field("k10", "k₁₀ (elimination)", "1/h", 0.3, 0.01, 3, 0.01),
				),
				readouts([2]string{"α", "alpha"}, [2]string{"β", "beta"}, [2]string{"t½ α", "ta"}, [2]string{"t½ β", "tb"}, [2]string{"A, B", "ab"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func pharmTherapeuticIndexBlock() Block {
	return Block{
		Slug:        "therapeutic-index",
		Title:       "Therapeutic index",
		Description: "Three quantal dose–response curves for the same population: the share who respond, who show toxicity, who die. The therapeutic index TD50/ED50 (or LD50/ED50) measures the gap between them; the certain safety factor TD1/ED99 asks whether the curves overlap at their tails.",
		Tags:        []string{"ED50 / TD50 / LD50", "safety margin"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-ti",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--code-add)", "effect (ED)"}, [2]string{"var(--vec-out)", "toxicity (TD)"}, [2]string{"var(--code-del)", "death (LD)"}),
					pharmPlot("plot", "Quantal dose-response curves on a log dose axis", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Median doses (illustrative)"),
					field("ed50", "ED50", "mg", 10, 0.1, 1000, 0.1),
					field("td50", "TD50", "mg", 80, 0.1, 5000, 0.1),
					field("ld50", "LD50", "mg", 400, 0.1, 20000, 1),
					field("slope", "Hill slope", "", 2, 0.5, 6, 0.1),
				),
				readouts([2]string{"TI = TD50/ED50", "ti"}, [2]string{"LD50/ED50", "lti"}, [2]string{"TD1/ED99", "csf"}, [2]string{"reading", "verdict"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

func pharmBindingBlock() Block {
	return Block{
		Slug:        "receptor-binding",
		Title:       "Receptor occupancy",
		Description: "Law of mass action: a ligand at concentration L occupies a fraction L/(L + Kd) of receptors. Half the receptors are bound at L = Kd, 90% only at 9·Kd. The Scatchard view (bound/free against bound) turns the hyperbola into a line of slope −1/Kd.",
		Tags:        []string{"Kd", "Langmuir", "Scatchard"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-bind",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmPlot("plot", "Receptor occupancy against ligand concentration", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("View"),
					segs("Binding view", [2]string{"linear", "Linear"}, [2]string{"log", "Log [L]"}, [2]string{"scatchard", "Scatchard"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Binding"),
					field("kd", "Kd", "nM", 5, 0.01, 1000, 0.01),
					field("bmax", "Bmax", "fmol/mg", 200, 10, 2000, 10),
					field("l", "Ligand [L]", "nM", 10, 0.01, 10000, 0.01),
				),
				readouts([2]string{"occupancy", "occ"}, [2]string{"bound B", "bound"}, [2]string{"for 50%", "c50"}, [2]string{"for 90%", "c90"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func pharmInteractionBlock() Block {
	return Block{
		Slug:        "interaction",
		Title:       "Enzyme inhibition and induction",
		Description: "A second drug changes the first one's clearance. An inhibitor lowers it, so steady-state levels rise; an inducer raises it, so they fall. The new steady state arrives over four to five of the new half-lives, which is why interactions show up days after a change.",
		Tags:        []string{"drug–drug interaction", "clearance"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-ddi",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--foreground)", "concentration"}, [2]string{"var(--brand)", "second drug started"}),
					pharmPlot("plot", "Concentration before and after a second drug", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Second drug"),
					segs("Interaction", [2]string{"inhibitor", "Inhibitor"}, [2]string{"inducer", "Inducer"}),
					field("factor", "Effect on CL", "×", 0.4, 0.1, 5, 0.05),
					field("start", "Started on day", "", 6, 1, 12, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Drug (illustrative)"),
					field("dose", "Dose", "mg", 200, 10, 2000, 10),
					field("tau", "Every", "h", 12, 2, 48, 1),
					field("cl", "Clearance", "L/h", 4, 0.2, 50, 0.1),
					field("v", "Volume V", "L", 60, 5, 300, 1),
				),
				readouts([2]string{"Css avg before", "before"}, [2]string{"Css avg after", "after"}, [2]string{"t½ before → after", "thalf"}, [2]string{"new steady state", "settle"}),
				pharmNote(),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func pharmSaturableBlock() Block {
	return Block{
		Slug:        "saturable-elimination",
		Title:       "Saturable (Michaelis–Menten) elimination",
		Description: "When the eliminating enzymes saturate, the rate is Vmax·C/(Km + C) instead of k·C. Steady state becomes Css = Km·R/(Vmax − R): a small dose increase near Vmax gives a large concentration increase, and past Vmax there is no steady state at all. Some anticonvulsants behave this way; the parameters here are generic.",
		Tags:        []string{"non-linear PK", "Michaelis–Menten"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-mm",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Div(h.Class("flex flex-col gap-1"),
						pharmLegend([2]string{"var(--foreground)", "concentration"}, [2]string{"var(--vec-u)", "if elimination were linear"}),
						pharmPlot("time", "Concentration over time for the chosen dose rate", 400, 300)),
					h.Div(h.Class("flex flex-col gap-1"),
						pharmLegend([2]string{"var(--foreground)", "Css vs dose rate"}),
						pharmPlot("css", "Steady-state concentration against dose rate", 260, 300)),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Dose rate"),
					field("rate", "Rate R", "mg/day", 300, 10, 700, 5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Elimination (illustrative)"),
					field("vmax", "Vmax", "mg/day", 500, 50, 2000, 10),
					field("km", "Km", "mg/L", 4, 0.5, 30, 0.1),
					field("v", "Volume V", "L", 50, 5, 300, 1),
				),
				readouts([2]string{"Css", "css"}, [2]string{"linear guess", "lin"}, [2]string{"+10% dose →", "plus"}, [2]string{"90% of Css at", "t90"}),
				pharmNote(),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

func pharmPopulationBlock() Block {
	return Block{
		Slug:        "population",
		Title:       "Population variability",
		Description: "The same regimen in 400 simulated people. Clearance varies log-normally from person to person, so the average steady-state concentration (F·D/(CL·τ)) spreads out: some land below the window, some above. Widen the variability and watch the tails grow.",
		Tags:        []string{"log-normal", "seeded", "window"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pharm-pop",
				h.Div(h.Class("flex flex-col gap-1"),
					pharmLegend([2]string{"var(--foreground)", "people"}, [2]string{"var(--code-add)", "window"}, [2]string{"var(--code-del)", "toxic"}),
					pharmPlot("plot", "Distribution of steady-state concentrations", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Regimen (illustrative)"),
					field("dose", "Dose", "mg", 300, 10, 2000, 10),
					field("tau", "Every", "h", 12, 2, 48, 1),
					field("cl", "Typical CL", "L/h", 4, 0.2, 50, 0.1),
					field("cv", "CL variability", "% CV", 40, 0, 120, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Window (illustrative)"),
					field("mec", "Min. effective", "mg/L", 4, 0.1, 50, 0.1),
					field("mtc", "Min. toxic", "mg/L", 12, 0.5, 100, 0.5),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.ShuffleIcon(), "New population"),
				readouts([2]string{"below window", "below"}, [2]string{"in window", "in"}, [2]string{"toxic", "above"}, [2]string{"median", "median"}),
				pharmNote(),
			)
		},
	}
}

// ---------------------------------------------------------------- P10

type pharmPhase struct {
	phase, who, question, size string
}

var pharmPhases = []pharmPhase{
	{"Preclinical", "Cells and animals", "Is it plausible and acceptably safe to try in people? Pharmacology, toxicology, first dose estimates.", "lab studies"},
	{"Phase I", "Usually healthy volunteers (patients for toxic drugs such as many cancer treatments)", "Is it safe, and what does the body do to it? Tolerability, dose range, pharmacokinetics.", "tens of people"},
	{"Phase II", "Patients with the condition", "Does it work at all, and at which dose? First efficacy signal, dose finding, side effects.", "dozens to hundreds"},
	{"Phase III", "Large patient groups, usually randomised and controlled", "Does it work better than, or as well as, existing care, with acceptable risk? The evidence for approval.", "hundreds to thousands"},
	{"Phase IV", "Everyone who uses it after approval", "What happens in real-world use? Rare and long-term side effects, new populations, comparative effectiveness.", "post-marketing"},
}

func pharmTrialsBlock() Block {
	return Block{
		Slug:        "clinical-trials",
		Title:       "Clinical trial phases",
		Description: "How a molecule becomes a medicine, phase by phase: who takes part, which question each phase answers, and roughly how big it is. Sizes and boundaries vary by drug and regulator; this is the generic outline.",
		Tags:        []string{"drug development", "stepper"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("pharm-trials", ""),
				h.Div(h.Class("flex items-center gap-2"),
					badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Drug development"),
					h.Span(h.Data("out", "count"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "1 / 5"),
				),
				h.Ol(h.Class("grid grid-cols-5 gap-1"), h.Aria("label", "Phases"),
					h.MapIdx(pharmPhases, func(i int, p pharmPhase) h.Node {
						return h.Li(h.Button(h.Type("button"), h.Data("phase", strconv.Itoa(i)), h.If(i == 0, h.Data("on", "")),
							h.Class("flex w-full flex-col items-start gap-1.5 rounded-md text-left text-[11px] text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:text-foreground"),
							h.Span(h.Class("h-1 w-full rounded-full bg-foreground/10 transition-colors duration-200 [[data-on]_&]:bg-brand")),
							h.Span(h.Class("truncate"), p.phase)))
					}),
				),
				h.Div(h.Class("grid"),
					h.MapIdx(pharmPhases, func(i int, p pharmPhase) h.Node {
						return h.Div(h.Data("phase-card", strconv.Itoa(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-xs"),
							h.Div(h.Class("flex flex-wrap items-baseline justify-between gap-2"),
								h.H3(h.Class("text-lg font-semibold tracking-tight"), p.phase),
								h.Span(h.Class("font-mono text-xs text-muted-foreground"), p.size)),
							h.Dl(h.Class("grid gap-2 text-sm leading-relaxed"),
								h.Div(h.Dt(h.Class("text-xs text-muted-foreground"), "Who"), h.Dd(p.who)),
								h.Div(h.Dt(h.Class("text-xs text-muted-foreground"), "The question"), h.Dd(p.question)),
							),
						)
					}),
				),
				h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
					h.P(h.Class("hidden text-xs text-muted-foreground sm:block"), "Regulators review the evidence between Phase III and approval."),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
				),
			)
		},
	}
}
