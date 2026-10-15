package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// EthicsBlocks lists the applied ethics gallery in display order. Each
// block puts a contested question into numbers and lets the learner turn
// the dials; none of them says which answer is right. The models live in
// static/js/ethics.js.
func EthicsBlocks() []Block {
	return []Block{
		ethicsDistributionBlock(),
		ethicsVeilBlock(),
		ethicsTrolleyBlock(),
		ethicsFairnessBlock(),
		ethicsDiscountBlock(),
		ethicsQalyBlock(),
		ethicsUncertaintyBlock(),
		ethicsCommonsBlock(),
		ethicsPopulationBlock(),
		ethicsResearchBlock(),
	}
}

func ethicsSvg(viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func ethicsButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func ethicsPreset(preset, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", preset), label)
}

func ethicsNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func ethicsLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

// ethicsChoice is one pressable answer in a group (aria-pressed).
func ethicsChoice(v, label string) h.Node {
	return h.Button(h.Type("button"), h.Data("choice", v), h.Aria("pressed", "false"),
		h.Class("rounded-md px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-brand/15 aria-pressed:text-brand"),
		label)
}

// ---------------------------------------------------------------- E1

func ethicsDistributionBlock() Block {
	return Block{
		Slug:        "distribution",
		Title:       "Who gets what: five rules for one choice",
		Description: "Five people, five ways to share welfare among them. Pick the one you would choose, then see how each theory of distributive justice ranks them: the utilitarian sum, Rawls's maximin, a prioritarian sum that counts gains to the worse off for more, strict equality, and sufficiency above a threshold. Edit the last row to build your own.",
		Tags:        []string{"utilitarian", "maximin", "prioritarian", "Atkinson"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("ethics-dist", ""), h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Div(h.Class("overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[560px] border-collapse text-sm"),
							h.Thead(h.Tr(h.Class("font-mono text-[11px] text-muted-foreground"),
								h.Th(h.Class("px-2 py-1.5 text-left font-normal"), "Allocation"),
								h.Th(h.Class("px-2 py-1.5 text-left font-normal"), "five people"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "sum"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "min"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "prior. EDE"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "Gini"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "below t"),
							)),
							h.Tbody(h.Data("rows", "")),
						),
					),
					h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("min-h-10 px-1 text-sm text-muted-foreground"), "Click a row to choose it."),
				),
				h.Div(h.Class("flex flex-col gap-5 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Theory settings"),
						field("eps", "Inequality aversion ε", "", 1, 0, 5, 0.1),
						field("t", "Sufficiency threshold", "", 40, 0, 100, 1),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Your own row"),
						h.Map([]int{1, 2, 3, 4, 5}, func(i int) h.Node {
							return field(fmt.Sprintf("p%d", i), fmt.Sprintf("Person %d", i), "", []float64{20, 40, 55, 70, 90}[i-1], 1, 200, 1)
						}),
					),
					readouts([2]string{"Atkinson index", "atk"}, [2]string{"equally-distributed eq.", "ede"}, [2]string{"mean", "mean"}),
					ethicsNote("Prioritarian value Σ u^(1−ε)/(1−ε), or Σ ln u at ε = 1 (Parfit 1991; Atkinson 1970). Higher ε weighs the worse off more; as ε grows it approaches maximin. Welfare here is a single number per person, which every theory below takes as given and many critics do not."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- E2

func ethicsVeilBlock() Block {
	return Block{
		Slug:        "veil",
		Title:       "Behind the veil, how much risk will you take?",
		Description: "Choose a society without knowing which fifth of it you will be born into. Harsanyi argued a rational chooser maximises expected welfare; Rawls argued for maximin. Between them sits risk aversion: the certainty equivalent of each society as ρ grows, and a lottery that draws your place.",
		Tags:        []string{"Rawls", "Harsanyi", "risk aversion"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-veil",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 300", "Left: incomes of the five strata in three societies. Right: certainty equivalent of each society against risk aversion."),
					ethicsLegend([2]string{"var(--vec-i)", "Flat"}, [2]string{"var(--vec-j)", "Ladder"}, [2]string{"var(--vec-u)", "Lottery"}, [2]string{"var(--brand)", "your choice"}),
					h.Div(h.Data("draws", ""), h.Aria("live", "polite"), h.Class("min-h-6 px-1 font-mono text-xs text-muted-foreground"), "No lives drawn yet."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Choose a society"),
					segs("Society", [2]string{"0", "Flat"}, [2]string{"1", "Ladder"}, [2]string{"2", "Lottery"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Your attitude"),
					field("rho", "Risk aversion ρ", "", 1, 0, 12, 0.1),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					ethicsButton("draw", "Draw a life", hugeicons.DiceIcon()),
					ethicsButton("draw20", "Draw 20", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"expected welfare picks", "ev"}, [2]string{"maximin picks", "maximin"}, [2]string{"at your ρ", "ce"}, [2]string{"your draws, mean", "mean"}),
				ethicsNote("Harsanyi (1953, 1955); Rawls, A Theory of Justice (1971) §26, who argued that probabilities should not be used behind the veil at all. Utility x^(1−ρ)/(1−ρ): ρ = 0 is risk neutral, and as ρ → ∞ the choice approaches maximin."),
			)
		},
	}
}

// ---------------------------------------------------------------- E3

var ethicsTrolleyCases = []struct{ id, name, setup string }{
	{"switch", "Switch", "A trolley will kill five. You can pull a lever to send it onto a side track, where it will kill one."},
	{"footbridge", "Footbridge", "You stand on a bridge beside a large stranger. Pushing him onto the track would stop the trolley; he would die and the five would live."},
	{"trapdoor", "Trapdoor", "As Footbridge, but the stranger stands on a trapdoor you can open with a switch, without touching him."},
	{"loop", "Loop", "The side track loops back to the five. Diverting saves them only because the one person on the loop stops the trolley with his body."},
	{"weight", "Loop with a weight", "As Loop, but a heavy weight on the loop stops the trolley. The one person stands in front of it and is killed too."},
	{"surgeon", "Surgeon", "A surgeon could kill one healthy visitor and use their organs to save five patients."},
}

func ethicsTrolleyBlock() Block {
	return Block{
		Slug:        "trolley-family",
		Title:       "The trolley family: which principle fits your answers?",
		Description: "One death against five in six variations. Record whether each act is permissible; the block then checks five candidate principles against all six answers at once. A principle that matches every answer is one way to make your intuitions consistent. None of them is the answer.",
		Tags:        []string{"Foot 1967", "Thomson", "double effect"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("ethics-trolley", ""), h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"),
				h.Ol(h.Class("divide-y border-b lg:border-r lg:border-b-0"),
					h.MapIdx(ethicsTrolleyCases, func(i int, c struct{ id, name, setup string }) h.Node {
						return h.Li(h.Data("case", c.id), h.Class("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"),
							h.Div(h.Class("flex min-w-0 flex-1 flex-col gap-0.5"),
								h.Span(h.Class("text-sm font-medium"), h.Span(h.Class("mr-2 font-mono text-[11px] text-muted-foreground tabular-nums"), fmt.Sprintf("%02d", i+1)), c.name),
								h.Span(h.Class("text-sm text-pretty text-muted-foreground"), c.setup),
							),
							h.Div(h.Class("flex shrink-0 gap-1 self-start rounded-lg border p-0.5 sm:self-center"), h.Role("group"), h.Aria("label", c.name),
								ethicsChoice("yes", "Permissible"), ethicsChoice("no", "Not permissible")),
						)
					}),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Principles against your answers"),
					h.Ul(h.Data("principles", ""), h.Class("flex flex-col gap-2")),
					h.P(h.Data("out", "msg"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm text-muted-foreground"), "Answer the six cases."),
					h.Div(h.Class("flex gap-2"),
						ethicsButton("common", "Fill an example", hugeicons.MagicWand01Icon()),
						ethicsButton("clear", "Clear", hugeicons.Delete02Icon()),
					),
					ethicsNote("Foot (1967) introduced the case; Thomson (1976, 1985) named it and added the footbridge and the loop. Greene et al. (2009) tested personal force. Awad et al. (2018, Nature) gathered about 40 million judgements in the Moral Machine and found broad agreement on some preferences and marked variation across cultures on others. Large majorities in many surveys approve Switch and reject Footbridge; that is a fact about intuitions, not a verdict."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- E4

func ethicsFairnessBlock() Block {
	return Block{
		Slug:        "fairness",
		Title:       "Fair by which definition? Four criteria, one score",
		Description: "A synthetic risk score for two groups that are calibrated by construction: a score of 0.3 means a 30% chance of the outcome in either group. When the groups' base rates differ, matching one rate between the groups unbalances another. Move the thresholds and watch which criteria hold, and which can never hold together.",
		Tags:        []string{"calibration", "equalized odds", "impossibility"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-fair",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 300", "Score distributions of the two groups, split into people with and without the outcome, with each group's threshold."),
					ethicsLegend([2]string{"var(--vec-i)", "outcome occurs"}, [2]string{"var(--vec-j)", "outcome does not occur"}, [2]string{"var(--brand)", "threshold"}),
					h.Div(h.Class("overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[460px] border-collapse font-mono text-xs"),
							h.Thead(h.Tr(h.Class("text-muted-foreground"),
								h.Th(h.Class("px-2 py-1 text-left font-normal"), "criterion"),
								h.Th(h.Class("px-2 py-1 text-right font-normal"), "group A"),
								h.Th(h.Class("px-2 py-1 text-right font-normal"), "group B"),
								h.Th(h.Class("px-2 py-1 text-right font-normal"), "gap"),
								h.Th(h.Class("px-2 py-1 text-right font-normal"), "holds"),
							)),
							h.Tbody(h.Data("table", "")),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Groups"),
					field("baseA", "Base rate A", "%", 30, 5, 95, 1),
					field("baseB", "Base rate B", "%", 50, 5, 95, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Thresholds"),
					field("tA", "Threshold A", "", 0.5, 0.01, 0.99, 0.001),
					field("tB", "Threshold B", "", 0.5, 0.01, 0.99, 0.001),
				),
				h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Move B's threshold to match"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						ethicsPreset("sel", "Selection rate"),
						ethicsPreset("tpr", "True positive rate"),
						ethicsPreset("fpr", "False positive rate"),
						ethicsPreset("same", "One threshold"),
					),
				),
				h.P(h.Data("out", "msg"), h.Aria("live", "polite"), h.Class("min-h-16 text-sm text-muted-foreground"), ""),
				ethicsNote("Chouldechova (2017): with unequal base rates, equal positive predictive value, equal false positive rates and equal false negative rates cannot all hold. Kleinberg, Mullainathan & Raghavan (2016) prove the matching result for a calibrated score itself. Which criterion matters is a moral question the arithmetic leaves open. A gap under 1 point counts as holding here."),
			)
		},
	}
}

// ---------------------------------------------------------------- E5

func ethicsDiscountBlock() Block {
	return Block{
		Slug:        "discounting",
		Title:       "How much is a future harm worth today?",
		Description: "The Ramsey rule r = δ + ηg sets the discount rate from pure time preference δ, the curvature of utility η and growth g. Small changes in δ decide whether preventing a harm a century away is worth a lot or almost nothing today, which is much of what the Stern–Nordhaus debate over climate policy was about.",
		Tags:        []string{"Ramsey 1928", "Stern", "Nordhaus"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-disc",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 290", "Discount factor against years ahead, for your settings and the two presets."),
					ethicsLegend([2]string{"var(--brand)", "your settings"}, [2]string{"var(--vec-i)", "Stern-like"}, [2]string{"var(--vec-j)", "Nordhaus-like"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ramsey rule"),
					field("delta", "Pure time preference δ", "%", 1.5, 0, 5, 0.05),
					field("eta", "Elasticity η", "", 1.45, 0, 4, 0.05),
					field("g", "Growth g", "%", 2, -1, 5, 0.1),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					ethicsPreset("0.1 1 1.3", "Stern 2006"),
					ethicsPreset("1.5 1.45 2", "Nordhaus-like"),
					ethicsPreset("0 0 0", "No discounting"),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("A harm"),
					field("T", "Years from now", "yr", 100, 1, 300, 1),
					field("D", "Damage then", "bn", 1000, 1, 10000, 1),
				),
				readouts([2]string{"discount rate r", "r"}, [2]string{"factor at T", "f"}, [2]string{"worth today", "pv"}, [2]string{"half-life", "half"}),
				ethicsNote("Stern Review (2006): δ = 0.1%, η = 1, growth about 1.3%, so r ≈ 1.4%. The Nordhaus-like preset uses DICE-2016R's δ = 1.5% and η = 1.45 with 2% growth, approximately. Discrete compounding (1 + r)^−T. Weitzman (2001) argued for declining rates under uncertainty; none of this settles whether δ > 0 is defensible."),
			)
		},
	}
}

// ---------------------------------------------------------------- E6

func ethicsQalyBlock() Block {
	return Block{
		Slug:        "qaly",
		Title:       "A fixed health budget and the QALY",
		Description: "Five invented programmes compete for one budget. Ranking by cost per quality-adjusted life year buys the most health, but it is not the only defensible rule: weight gains to the severely ill more, or fund the visible emergency first, and see what each rule costs in QALYs.",
		Tags:        []string{"QALY", "cost-effectiveness", "rule of rescue"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-qaly",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 300", "Each programme as a bar: width is the budget it would take to treat everyone, height its cost per QALY. The funded part is filled."),
					ethicsLegend([2]string{"var(--brand)", "funded"}, [2]string{"var(--muted-foreground)", "not funded"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Budget and rule"),
					field("budget", "Budget", "M", 20, 1, 80, 1),
					field("omega", "Severity weight ω", "", 0, 0, 3, 0.1),
					toggle("ethics-qaly-rescue", "rescue", "Rule of rescue: fund E first", false),
				),
				readouts([2]string{"QALYs gained", "q"}, [2]string{"weighted QALYs", "wq"}, [2]string{"people treated", "n"}, [2]string{"marginal cost / QALY", "icer"}, [2]string{"vs pure ranking", "loss"}),
				ethicsNote("Programmes and numbers are invented. NICE in England has long used a threshold of about £20,000–£30,000 per QALY gained. Critics argue QALYs undervalue the lives of disabled and older people; the US Affordable Care Act (2010) bars its comparative-effectiveness institute from using cost per QALY as a threshold."),
			)
		},
	}
}

// ---------------------------------------------------------------- E7

func ethicsUncertaintyBlock() Block {
	return Block{
		Slug:        "moral-uncertainty",
		Title:       "Acting under moral uncertainty",
		Description: "Unsure which theory is right? Split your credence across three and drag the point in the triangle. Maximising expected choiceworthiness can pick a compromise that no single theory ranks first; following your favourite theory never does. The map shows which act each method chooses for every credence split.",
		Tags:        []string{"MacAskill", "credence", "compromise"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-mu",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 320", "Left: a triangle of credences in three theories, coloured by the act chosen. Right: the choiceworthiness table."),
					ethicsLegend([2]string{"var(--vec-i)", "Act A"}, [2]string{"var(--vec-j)", "Act B"}, [2]string{"var(--vec-u)", "Act C"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Method", [2]string{"mec", "Expected"}, [2]string{"norm", "Normalised"}, [2]string{"mft", "Favourite theory"}),
				),
				readouts([2]string{"credences", "cred"}, [2]string{"expected", "ec"}, [2]string{"chooses", "pick"}),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					ethicsPreset("0.4 0.3 0.3", "40 · 30 · 30"),
					ethicsPreset("0.34 0.33 0.33", "Even"),
					ethicsPreset("0.1 0.8 0.1", "Mostly rights"),
				),
				ethicsNote("Choiceworthiness scores are invented on each theory's own scale. Comparing scales across theories is the hard part (the problem of intertheoretic comparisons); \"Normalised\" rescales each theory to variance 1, one proposal among several (MacAskill, Bykvist & Ord, Moral Uncertainty, 2020). Arrow keys move the point when the triangle has focus."),
			)
		},
	}
}

// ---------------------------------------------------------------- E8

func ethicsCommonsBlock() Block {
	return Block{
		Slug:        "commons",
		Title:       "A fishery and the tragedy of the commons",
		Description: "A logistic fish stock and boats that keep fishing while it pays. Under open access, effort grows until the profit is gone and the stock sits far below the level of maximum sustainable yield (Gordon 1954, Hardin 1968). A catch quota or a single owner stops that, and Ostrom showed that many communities manage commons by their own rules.",
		Tags:        []string{"Hardin 1968", "Ostrom 1990", "MSY"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-commons",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 290", "Fish stock and yearly catch over fifty years, with the stock that gives maximum sustainable yield."),
					ethicsLegend([2]string{"var(--vec-i)", "stock"}, [2]string{"var(--vec-j)", "catch ×5"}, [2]string{"var(--muted-foreground)", "MSY stock"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rules"),
					segs("Regime", [2]string{"open", "Open access"}, [2]string{"quota", "Quota"}, [2]string{"owner", "Sole owner"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Fishers"),
					field("n", "Boats", "", 6, 1, 20, 1),
					field("price", "Price per tonne", "", 1, 0.3, 3, 0.05),
				),
				h.Div(h.Class("flex gap-2"), playPause(), ethicsButton("reset", "Reset", hugeicons.ArrowReloadHorizontalIcon())),
				readouts([2]string{"year", "year"}, [2]string{"stock", "stock"}, [2]string{"catch", "catch"}, [2]string{"profit (rent)", "rent"}),
				ethicsNote("Gordon–Schaefer model: growth 0.4·S(1 − S/1000), catch q·E·S, cost 2 per unit of effort, each boat at most 10 units. MSY is 100 t at S = 500. Ostrom, Governing the Commons (1990), documents commons managed for centuries without privatisation or state control."),
			)
		},
	}
}

// ---------------------------------------------------------------- E9

func ethicsPopulationBlock() Block {
	return Block{
		Slug:        "population",
		Title:       "Population ethics and the repugnant conclusion",
		Description: "Is a world better if it has more people with lives worth living? Total utilitarianism adds welfare up and so ranks a huge population of barely good lives above a small flourishing one: Parfit's repugnant conclusion. The average view avoids it and meets other trouble. Rank Parfit's worlds under three views.",
		Tags:        []string{"Parfit 1984", "total", "average"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ethics-pop",
				h.Div(h.Class("flex flex-col gap-3"),
					ethicsSvg("0 0 640 300", "Four populations drawn as rectangles: width is the number of people, height their welfare."),
					h.Div(h.Data("rank", ""), h.Class("grid gap-2 px-1 font-mono text-xs sm:grid-cols-3")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("World Z"),
					field("zn", "People in Z", "bn", 1000, 20, 5000, 10),
					field("zw", "Welfare in Z", "", 2, -10, 40, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Critical level"),
					field("c", "Critical level c", "", 10, 0, 60, 1),
				),
				h.P(h.Data("out", "msg"), h.Aria("live", "polite"), h.Class("min-h-16 text-sm text-muted-foreground"), ""),
				ethicsNote("Parfit, Reasons and Persons (1984), Part IV. Critical-level views (Blackorby, Bossert & Donaldson) count a life only above c, which avoids the repugnant conclusion but implies that adding lives barely worth living makes things worse. Arrhenius (2000) proved that no view satisfies a set of seemingly mild conditions at once."),
			)
		},
	}
}

// ---------------------------------------------------------------- E10

var ethicsConsentItems = []struct{ id, label, hint string }{
	{"research", "This is research: purpose, duration and procedures", "§46.116(b)(1)"},
	{"risks", "Reasonably foreseeable risks or discomforts", "§46.116(b)(2)"},
	{"benefits", "Benefits to the participant or to others", "§46.116(b)(3)"},
	{"alternatives", "Alternative procedures or treatments, if any", "§46.116(b)(4)"},
	{"confidential", "How records will be kept confidential", "§46.116(b)(5)"},
	{"injury", "Compensation or treatment if injury occurs (more than minimal risk)", "§46.116(b)(6)"},
	{"contacts", "Whom to contact with questions or in case of injury", "§46.116(b)(7)"},
	{"voluntary", "Participation is voluntary; withdrawing carries no penalty", "§46.116(b)(8)"},
	{"future", "Whether identifiable data or samples may be reused in future research", "§46.116(b)(9)"},
}

var ethicsCases = []struct{ id, name, summary string }{
	{"tuskegee", "US Public Health Service syphilis study (1932–1972)", "Black men with syphilis were observed without treatment, and were not offered penicillin after it became standard treatment in the late 1940s."},
	{"milgram", "Milgram's obedience experiments (1961–1962)", "Participants were deceived into believing they were giving painful shocks; many showed severe distress."},
	{"contagion", "The Facebook emotional contagion study (2014)", "News feeds of about 690,000 users were altered to test effects on mood, relying on the terms of service as consent."},
	{"havasupai", "Havasupai blood samples (settled 2010)", "Samples given for diabetes research were reused for studies of schizophrenia, inbreeding and migration without the tribe's consent."},
}

func ethicsResearchBlock() Block {
	return Block{
		Slug:        "research-ethics",
		Title:       "Research ethics: Belmont principles and consent",
		Description: "The Belmont Report (1979) rests human-subjects research on three principles: respect for persons, beneficence and justice. Map four well-known cases to the principles you think are most at stake, then draft a consent form against the basic elements the US Common Rule requires.",
		Tags:        []string{"Belmont 1979", "Common Rule", "consent"},
		Wide:        true,
		Render: func() h.Node {
			principles := [][2]string{{"respect", "Respect for persons"}, {"beneficence", "Beneficence"}, {"justice", "Justice"}}
			return h.Div(h.Data("ethics-research", ""), h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-2"),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-5 lg:border-r lg:border-b-0"),
					panelLabel("Which principle is most at stake?"),
					h.Ol(h.Class("flex flex-col gap-3"),
						h.Map(ethicsCases, func(c struct{ id, name, summary string }) h.Node {
							return h.Li(h.Data("case", c.id), h.Class("flex flex-col gap-2 rounded-lg border p-3"),
								h.Span(h.Class("text-sm font-medium"), c.name),
								h.Span(h.Class("text-sm text-pretty text-muted-foreground"), c.summary),
								h.Div(h.Class("flex flex-wrap gap-1 self-start rounded-lg border p-0.5"), h.Role("group"), h.Aria("label", c.name),
									h.Map(principles, func(p [2]string) h.Node { return ethicsChoice(p[0], p[1]) })),
								h.P(h.Data("discuss", ""), h.Hidden(), h.Class("text-xs leading-relaxed text-muted-foreground")),
							)
						}),
					),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 p-5"),
					panelLabel("Consent form checklist"),
					h.Label(h.Class("flex flex-col gap-1 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "Study title"),
						h.Input(h.Type("text"), h.Data("title", ""), h.Value("Sleep and memory in first-year students"), h.Attr("autocomplete", "off"),
							h.Class("h-8 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
					),
					h.Ul(h.Class("flex flex-col gap-1.5"),
						h.Map(ethicsConsentItems, func(it struct{ id, label, hint string }) h.Node {
							return h.Li(h.Label(h.Class("flex items-start gap-2.5 text-sm"),
								h.Input(h.Type("checkbox"), h.Data("item", it.id), h.Class("mt-0.5 size-4 shrink-0 accent-[var(--brand)]")),
								h.Span(h.Class("flex flex-col"), h.Span(it.label), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), it.hint)),
							))
						}),
					),
					h.P(h.Data("out", "missing"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm text-muted-foreground"), ""),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "copy"), hugeicons.Copy01Icon(), h.Span(h.Data("label", ""), "Copy outline as Markdown")),
					),
					ethicsNote("National Commission, The Belmont Report (1979). Basic elements from the revised Common Rule, 45 CFR 46.116(b) (2018), which also requires concise key information first. A checklist is a floor: rules differ by country and an ethics committee decides. Nothing typed here leaves the page."),
				),
			)
		},
	}
}
