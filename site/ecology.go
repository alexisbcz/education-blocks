package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// EcologyBlocks lists the ecology and oceanography gallery in display order.
// Every curve is computed in static/js/ecology.js from the model named in
// the block; synthetic data is labelled as such.
func EcologyBlocks() []Block {
	return []Block{
		ecoCompetitionBlock(),
		ecoFoodWebBlock(),
		ecoIslandBlock(),
		ecoSpeciesAreaBlock(),
		ecoDiversityBlock(),
		ecoMarkRecaptureBlock(),
		ecoForestFireBlock(),
		ecoSeawaterBlock(),
		ecoTidesBlock(),
		ecoCarbonateBlock(),
	}
}

func ecoSvg(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func ecoButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func ecoNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- E1

func ecoCompetitionBlock() Block {
	return Block{
		Slug:        "competition",
		Title:       "Competition between two species",
		Description: "The Lotka–Volterra competition model: each species grows logistically toward its carrying capacity K, slowed by the other through the competition coefficients α. Where the two zero-growth lines (isoclines) sit decides everything: one species wins, the other wins, they coexist, or the winner depends on who starts ahead.",
		Tags:        []string{"ODE", "isoclines", "phase plane"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-comp",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_1fr]"),
						ecoSvg("phase", "0 0 300 300", "Phase plane with isoclines and trajectories"),
						ecoSvg("time", "0 0 300 300", "Both populations over time"),
					),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "species 1 (N₁)"), legendSwatch("var(--brand)", "species 2 (N₂)"),
						legendSwatch("var(--foreground)", "trajectories")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Outcome presets"),
					segs("Outcome", [2]string{"coexist", "Coexist"}, [2]string{"one", "1 wins"}, [2]string{"two", "2 wins"}, [2]string{"bistable", "Either"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Species 1"),
					field("K1", "K₁", "", 100, 10, 200, 1),
					field("a12", "α₁₂ (2 on 1)", "", 0.6, 0, 2.5, 0.05),
					field("r1", "r₁", "/t", 1, 0.1, 3, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Species 2"),
					field("K2", "K₂", "", 80, 10, 200, 1),
					field("a21", "α₂₁ (1 on 2)", "", 0.5, 0, 2.5, 0.05),
					field("r2", "r₂", "/t", 0.8, 0.1, 3, 0.05),
				),
				readouts([2]string{"outcome", "outcome"}, [2]string{"equilibrium", "eq"}),
				ecoNote("Click the phase plane to start a trajectory there. Model after Lotka (1925) and Volterra (1926); tested in the lab by Gause (1934)."),
			)
		},
	}
}

// ---------------------------------------------------------------- E2

func ecoFoodWebBlock() Block {
	return Block{
		Slug:        "food-web",
		Title:       "Food web and energy",
		Description: "An illustrative kelp-forest web, arranged by trophic level (1 + the mean level of what a species eats). Remove a species and the cascade follows the links: consumers left with nothing to eat are lost, and prey left with no predator are flagged as released, as when sea otters declined and urchins grazed kelp forests bare.",
		Tags:        []string{"trophic levels", "cascade", "10% rule"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-web",
				h.Div(h.Class("flex flex-col gap-2"),
					ecoSvg("web", "0 0 560 380", "Food web; click a species to remove it"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "present"), legendSwatch("var(--code-del)", "lost"), legendSwatch("var(--vec-out)", "released from predation")),
				),
				h.Div(h.Data("info", ""), h.Aria("live", "polite"), h.Class("flex min-h-28 flex-col gap-1.5"),
					h.Span(h.Data("info-name", ""), h.Class("text-sm font-medium"), "Click a species"),
					h.P(h.Data("info-text", ""), h.Class("text-xs leading-relaxed text-muted-foreground"), "Removing it shows which species lose all their food. Click a removed species to bring it back."),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Energy up the levels"),
					field("eff", "Transfer efficiency", "%", 10, 1, 30, 0.5),
					field("npp", "Producers", "kJ/m²/yr", 20000, 1000, 50000, 500),
					ecoSvg("pyramid", "0 0 240 130", "Energy reaching each trophic level"),
					ecoNote("10% is a rough rule of thumb (after Lindeman 1942); measured efficiencies range roughly 5–20%."),
				),
				h.Div(h.Class("flex gap-2"), ecoButton("reset", "Restore all", hugeicons.RefreshIcon())),
				readouts([2]string{"species left", "left"}, [2]string{"top level", "top"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E3

func ecoIslandBlock() Block {
	return Block{
		Slug:        "island-biogeography",
		Title:       "Island biogeography",
		Description: "MacArthur and Wilson's equilibrium theory (1967): new species arrive more slowly as the island fills, and species go extinct faster as it fills. The richness settles where the two rates cross. Far islands get fewer immigrants; small islands lose species faster.",
		Tags:        []string{"equilibrium", "immigration", "extinction"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-island",
				h.Div(h.Class("flex flex-col gap-2"),
					ecoSvg("rates", "0 0 560 320", "Immigration and extinction rates against species present"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "immigration"), legendSwatch("var(--code-del)", "extinction"),
						legendSwatch("color-mix(in oklab, var(--foreground) 35%, transparent)", "reference: near, large island")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Island"),
					field("dist", "Distance", "km", 200, 0, 2000, 10),
					field("area", "Area", "km²", 50, 0.1, 10000, 0.1),
					field("pool", "Mainland pool P", "spp.", 200, 20, 500, 5),
				),
				readouts([2]string{"equilibrium Ŝ", "s"}, [2]string{"turnover", "turnover"}, [2]string{"I₀ / E₀", "rates"}),
				ecoNote("Teaching model with straight-line rates: I(S) = I₀(1 − S/P), E(S) = E₀·S/P, I₀ = 2·e^(−d/500 km), E₀ = 2·(A/1 km²)^(−0.3). The equilibrium is Ŝ = P·I₀/(I₀ + E₀). MacArthur and Wilson drew the curves bowed; the crossing logic is the same."),
			)
		},
	}
}

// ---------------------------------------------------------------- E4

func ecoSpeciesAreaBlock() Block {
	return Block{
		Slug:        "species-area",
		Title:       "Species–area relationship",
		Description: "Bigger areas hold more species, following a power law S = cA^z that is a straight line on log–log axes. The exponent z (typically about 0.15–0.35) says how much habitat loss costs: halving the area keeps 2^(−z) of the species.",
		Tags:        []string{"power law", "log–log fit", "habitat loss"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-sar",
				h.Div(h.Class("flex flex-col gap-2"),
					ecoSvg("plot", "0 0 560 320", "Species against area on log–log axes"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "S = cA^z"), legendSwatch("var(--brand)", "least-squares fit to the islands")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Law"),
					field("c", "c", "", 10, 1, 60, 0.5),
					field("z", "z", "", 0.25, 0.05, 0.6, 0.01),
					field("noise", "Scatter", "", 0.15, 0, 0.5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Habitat loss"),
					field("loss", "Area lost", "%", 50, 0, 99, 1),
				),
				ecoButton("reseed", "New islands", hugeicons.ShuffleIcon()),
				readouts([2]string{"fitted z", "fitz"}, [2]string{"species kept", "kept"}),
				ecoNote("The 25 islands are synthetic, drawn around the law with log-normal scatter. Arrhenius (1921) proposed the power form."),
			)
		},
	}
}

// ---------------------------------------------------------------- E5

func ecoDiversityBlock() Block {
	return Block{
		Slug:        "diversity",
		Title:       "Diversity indices",
		Description: "Two communities with the same species can be very differently diverse. Edit the counts and compare richness, Shannon's H′, its evenness J, Simpson's index and the effective numbers of species they imply.",
		Tags:        []string{"Shannon", "Simpson", "evenness"},
		Wide:        true,
		Render: func() h.Node {
			names := []string{"Oak", "Beech", "Ash", "Birch", "Hazel", "Holly"}
			counts := []float64{40, 25, 15, 10, 6, 4}
			return plotPanel("eco-div",
				h.Div(h.Class("flex flex-col gap-2"),
					ecoSvg("bars", "0 0 560 260", "Relative abundance of each species"),
					h.Dl(h.Class("grid grid-cols-2 gap-x-6 gap-y-1.5 px-1 font-mono text-xs sm:grid-cols-4"),
						h.Map([][2]string{{"S (richness)", "S"}, {"H′ (nats)", "H"}, {"J = H′/ln S", "J"}, {"e^H′", "expH"}, {"Simpson D = Σp²", "D"}, {"1 − D", "gini"}, {"1/D", "invD"}, {"N", "N"}},
							func(r [2]string) h.Node {
								return h.Div(h.Class("flex flex-col"), h.Dt(h.Class("text-[11px] text-muted-foreground"), r[0]), h.Dd(h.Data("out", r[1]), h.Class("tabular-nums"), "—"))
							}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Counts"),
					h.MapIdx(names, func(i int, n string) h.Node { return field(fmt.Sprintf("n%d", i), n, "trees", counts[i], 0, 200, 1) }),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					segs("Community", [2]string{"woodland", "Woodland"}, [2]string{"even", "Even"}, [2]string{"dominated", "Dominated"}),
				),
				ecoNote("Shannon (1948) applied to ecology; Simpson (1949). Here D is Σp² (the chance two random individuals share a species, with replacement)."),
			)
		},
	}
}

// ---------------------------------------------------------------- E6

func ecoMarkRecaptureBlock() Block {
	return Block{
		Slug:        "mark-recapture",
		Title:       "Mark and recapture",
		Description: "How to count fish you cannot see: catch M, mark them, release them, then catch C and count how many R are marked. If marks mix evenly, R/C ≈ M/N, so N ≈ MC/R (Lincoln–Petersen). Chapman's correction removes most of that estimator's bias in small samples; repeat the survey to see both spreads.",
		Tags:        []string{"estimation", "simulation", "bias"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-mr",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_1fr]"),
					ecoSvg("pond", "0 0 300 260", "Pond with marked and unmarked fish"),
					ecoSvg("hist", "0 0 300 260", "Estimates over repeated surveys"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Survey"),
					field("N", "True N (hidden)", "fish", 200, 30, 600, 5),
					field("M", "First catch M", "", 50, 5, 200, 1),
					field("C", "Second catch C", "", 40, 5, 200, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					ecoButton("survey", "One survey", hugeicons.ShuffleIcon()),
					ecoButton("repeat", "× 500", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"recaptured R", "R"}, [2]string{"Lincoln–Petersen", "lp"}, [2]string{"Chapman", "ch"}, [2]string{"95% CI (Chapman)", "ci"}, [2]string{"mean of repeats", "means"}),
				ecoNote("Lincoln–Petersen N = MC/R; Chapman (1951) N = (M+1)(C+1)/(R+1) − 1, with Seber's variance. The pond is simulated (seeded)."),
			)
		},
	}
}

// ---------------------------------------------------------------- E7

func ecoForestFireBlock() Block {
	return Block{
		Slug:        "forest-fire",
		Title:       "Forest fire model",
		Description: "The Drossel–Schwabl forest-fire model (1992): trees grow on empty ground with probability p, lightning strikes a tree with a much smaller probability f, and fire spreads to neighbouring trees each step. Fires of every size emerge; slow lightning lets fuel build up into rare huge fires.",
		Tags:        []string{"cellular automaton", "disturbance", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-fire",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative mx-auto aspect-[3/2] w-full max-w-[560px] overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", "Forest grid: trees, fires and empty ground"))),
					ecoSvg("density", "0 0 560 80", "Tree density over time"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rates per step"),
					field("p", "Growth p", "", 0.02, 0.001, 0.2, 0.001),
					field("f", "Lightning f", "", 0.00005, 0, 0.002, 0.00001),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), ecoButton("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"step", "step"}, [2]string{"tree density", "dens"}, [2]string{"burning", "burn"}, [2]string{"largest fire", "big"}),
				ecoNote("A model, not a forecast: 160 × 106 cells, fire spreads to the four nearest neighbours, edges are open. Drossel & Schwabl, Phys. Rev. Lett. 69 (1992)."),
			)
		},
	}
}

// ---------------------------------------------------------------- E8

func ecoSeawaterBlock() Block {
	return Block{
		Slug:        "seawater",
		Title:       "Seawater density and water masses",
		Description: "Cold, salty water is dense and sinks; that is what drives the slow thermohaline circulation. The T–S diagram shows density contours from the UNESCO equation of state. Drag two water masses and mix them: because the contours curve, the mixture can be denser than both parents (cabbeling).",
		Tags:        []string{"EOS-80", "T–S diagram", "thermohaline"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-sea",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					ecoSvg("ts", "0 0 380 320", "Temperature–salinity diagram with density contours"),
					ecoSvg("profile", "0 0 240 320", "Typical open-ocean temperature and salinity profiles"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Water mass A"),
					field("tA", "T", "°C", 25, -2, 30, 0.1),
					field("sA", "S", "g/kg", 36.5, 30, 40, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Water mass B"),
					field("tB", "T", "°C", 2, -2, 30, 0.1),
					field("sB", "S", "g/kg", 34.7, 30, 40, 0.05),
					field("mix", "Share of A", "%", 50, 0, 100, 1),
				),
				readouts([2]string{"ρ A", "rA"}, [2]string{"ρ B", "rB"}, [2]string{"ρ mixture", "rM"}, [2]string{"cabbeling", "cab"}),
				ecoNote("Density at the surface (p = 0) from UNESCO EOS-80 (Millero & Poisson 1981; practical salinity, IPTS-68). Contours are σ = ρ − 1000 kg/m³. The profile on the right is a schematic of a mid-latitude ocean."),
			)
		},
	}
}

// ---------------------------------------------------------------- E9

func ecoTidesBlock() Block {
	return Block{
		Slug:        "tides",
		Title:       "Tides: spring and neap",
		Description: "The tide is a sum of constituents. The Moon's M2 (period 12.42 h) and the Sun's S2 (12.00 h) drift in and out of step, so their sum beats: large spring tides when they align near new and full Moon, small neap tides at the quarters, about every 14.77 days. Add the diurnal K1 and O1 for a mixed tide.",
		Tags:        []string{"harmonics", "beats", "constituents"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-tide",
				h.Div(h.Class("flex flex-col gap-2"),
					ecoSvg("curve", "0 0 560 300", "Sea level over a month"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "sea level"), legendSwatch("var(--brand)", "M2 + S2 envelope")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Amplitudes"),
					field("m2", "M2 (lunar)", "m", 1.2, 0, 3, 0.05),
					field("s2", "S2 (solar)", "m", 0.4, 0, 2, 0.05),
					field("k1", "K1 (diurnal)", "m", 0, 0, 1.5, 0.05),
					field("o1", "O1 (diurnal)", "m", 0, 0, 1.5, 0.05),
					field("days", "Window", "days", 30, 3, 60, 1),
				),
				readouts([2]string{"spring range", "spring"}, [2]string{"neap range", "neap"}, [2]string{"spring–neap period", "period"}, [2]string{"form factor F", "form"}),
				ecoNote("Periods: M2 12.4206 h, S2 12.0000 h, K1 23.9345 h, O1 25.8193 h. The spring–neap period is 1/(1/T_S2 − 1/T_M2). F = (K1 + O1)/(M2 + S2) classifies the tide: below 0.25 semi-diurnal, above 3 diurnal. All phases start at zero."),
			)
		},
	}
}

// ---------------------------------------------------------------- E10

func ecoCarbonateBlock() Block {
	return Block{
		Slug:        "carbonate",
		Title:       "Ocean acidification",
		Description: "Dissolved CO₂ reacts with seawater to form bicarbonate and carbonate. The Bjerrum plot shows how the dissolved inorganic carbon splits between the three forms at each pH. As the ocean absorbs CO₂ its pH falls, and carbonate ions, which shells and corals are built from, become scarcer.",
		Tags:        []string{"Bjerrum plot", "equilibria", "pH"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("eco-co3",
				h.Div(h.Class("flex flex-col gap-2"),
					ecoSvg("plot", "0 0 560 320", "Fractions of CO2, bicarbonate and carbonate against pH"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "CO₂(aq)"), legendSwatch("var(--foreground)", "HCO₃⁻"), legendSwatch("var(--brand)", "CO₃²⁻")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Seawater"),
					field("ph", "pH", "", 8.1, 4, 11, 0.01),
					field("dic", "DIC", "µmol/kg", 2000, 500, 3000, 10),
					field("pk1", "pK₁*", "", 5.86, 5, 7, 0.01),
					field("pk2", "pK₂*", "", 8.92, 8, 10, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("ph", "8.2"), "Pre-industrial ≈ 8.2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("ph", "8.1"), "Today ≈ 8.1"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("ph", "7.8"), h.Class("col-span-2"), "A future ≈ 7.8"),
				),
				readouts([2]string{"CO₂(aq)", "co2"}, [2]string{"HCO₃⁻", "hco3"}, [2]string{"CO₃²⁻", "co3"}, [2]string{"[H⁺] vs pH 8.2", "h"}),
				ecoNote("Approximate stoichiometric constants for surface seawater (about 25 °C, salinity 35). The ≈0.1 unit drop since pre-industrial times is the IPCC AR6 assessment; 7.8 is an illustrative future value."),
			)
		},
	}
}
