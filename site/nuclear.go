package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NuclearBlocks lists the nuclear and particle physics gallery in display
// order.
func NuclearBlocks() []Block {
	return []Block{
		nucChartBlock(),
		nucBindingBlock(),
		nucMassDefectBlock(),
		nucDecayBlock(),
		nucChainBlock(),
		nucFissionBlock(),
		nucFusionBlock(),
		nucShieldingBlock(),
		nucDoseBlock(),
		nucParticlesBlock(),
	}
}

func nucNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func nucAction(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- N1

// nucNuclide is one cell of the chart: Z, N, decay mode and an approximate
// half-life (empty for stable nuclides).
type nucNuclide struct {
	sym  string
	z, n int
	mode string // stable, b-, b+, ec, a
	half string
}

// A partial chart of light nuclides: every stable nuclide up to calcium and
// well-known radioactive neighbours. Half-lives rounded (NUBASE).
var nucNuclides = []nucNuclide{
	{"H", 1, 0, "stable", ""}, {"H", 1, 1, "stable", ""}, {"H", 1, 2, "b-", "12.3 y"},
	{"He", 2, 1, "stable", ""}, {"He", 2, 2, "stable", ""}, {"He", 2, 4, "b-", "0.81 s"},
	{"Li", 3, 3, "stable", ""}, {"Li", 3, 4, "stable", ""}, {"Li", 3, 5, "b-", "0.84 s"},
	{"Be", 4, 3, "ec", "53.2 d"}, {"Be", 4, 4, "a", "8×10⁻¹⁷ s"}, {"Be", 4, 5, "stable", ""}, {"Be", 4, 6, "b-", "1.39 My"},
	{"B", 5, 3, "b+", "0.77 s"}, {"B", 5, 5, "stable", ""}, {"B", 5, 6, "stable", ""}, {"B", 5, 7, "b-", "20.2 ms"},
	{"C", 6, 4, "b+", "19.3 s"}, {"C", 6, 5, "b+", "20.4 min"}, {"C", 6, 6, "stable", ""}, {"C", 6, 7, "stable", ""}, {"C", 6, 8, "b-", "5,730 y"}, {"C", 6, 9, "b-", "2.45 s"},
	{"N", 7, 6, "b+", "9.97 min"}, {"N", 7, 7, "stable", ""}, {"N", 7, 8, "stable", ""}, {"N", 7, 9, "b-", "7.13 s"},
	{"O", 8, 6, "b+", "70.6 s"}, {"O", 8, 7, "b+", "122 s"}, {"O", 8, 8, "stable", ""}, {"O", 8, 9, "stable", ""}, {"O", 8, 10, "stable", ""}, {"O", 8, 11, "b-", "26.9 s"},
	{"F", 9, 8, "b+", "64.5 s"}, {"F", 9, 9, "b+", "110 min"}, {"F", 9, 10, "stable", ""}, {"F", 9, 11, "b-", "11.0 s"},
	{"Ne", 10, 9, "b+", "17.3 s"}, {"Ne", 10, 10, "stable", ""}, {"Ne", 10, 11, "stable", ""}, {"Ne", 10, 12, "stable", ""}, {"Ne", 10, 13, "b-", "37.2 s"},
	{"Na", 11, 11, "b+", "2.60 y"}, {"Na", 11, 12, "stable", ""}, {"Na", 11, 13, "b-", "15.0 h"},
	{"Mg", 12, 11, "b+", "11.3 s"}, {"Mg", 12, 12, "stable", ""}, {"Mg", 12, 13, "stable", ""}, {"Mg", 12, 14, "stable", ""}, {"Mg", 12, 15, "b-", "9.46 min"},
	{"Al", 13, 13, "b+", "7.2×10⁵ y"}, {"Al", 13, 14, "stable", ""}, {"Al", 13, 15, "b-", "2.24 min"},
	{"Si", 14, 13, "b+", "4.15 s"}, {"Si", 14, 14, "stable", ""}, {"Si", 14, 15, "stable", ""}, {"Si", 14, 16, "stable", ""}, {"Si", 14, 17, "b-", "2.62 h"},
	{"P", 15, 15, "b+", "2.50 min"}, {"P", 15, 16, "stable", ""}, {"P", 15, 17, "b-", "14.3 d"},
	{"S", 16, 16, "stable", ""}, {"S", 16, 17, "stable", ""}, {"S", 16, 18, "stable", ""}, {"S", 16, 19, "b-", "87.4 d"}, {"S", 16, 20, "stable", ""},
	{"Cl", 17, 18, "stable", ""}, {"Cl", 17, 19, "b-", "3.0×10⁵ y"}, {"Cl", 17, 20, "stable", ""},
	{"Ar", 18, 18, "stable", ""}, {"Ar", 18, 19, "ec", "35 d"}, {"Ar", 18, 20, "stable", ""}, {"Ar", 18, 21, "b-", "269 y"}, {"Ar", 18, 22, "stable", ""},
	{"K", 19, 20, "stable", ""}, {"K", 19, 21, "b-", "1.25×10⁹ y"}, {"K", 19, 22, "stable", ""}, {"K", 19, 23, "b-", "12.4 h"},
	{"Ca", 20, 20, "stable", ""}, {"Ca", 20, 21, "ec", "1.0×10⁵ y"}, {"Ca", 20, 22, "stable", ""}, {"Ca", 20, 23, "stable", ""}, {"Ca", 20, 24, "stable", ""}, {"Ca", 20, 25, "b-", "163 d"}, {"Ca", 20, 26, "stable", ""}, {"Ca", 20, 28, "stable", ""},
}

var nucModeColor = map[string]string{
	"stable": "var(--foreground)",
	"b-":     "var(--vec-u)",
	"b+":     "var(--ion-na)",
	"ec":     "var(--ion-na)",
	"a":      "var(--vec-out)",
}

var nucModeName = map[string]string{
	"stable": "stable",
	"b-":     "β⁻ decay",
	"b+":     "β⁺ decay",
	"ec":     "electron capture",
	"a":      "α decay (into two ⁴He)",
}

func nucChartBlock() Block {
	return Block{
		Slug:        "nuclide-chart",
		Title:       "Chart of nuclides",
		Description: "Every nucleus as a cell: protons up, neutrons across. Light stable nuclei sit on the N = Z diagonal; heavier ones need extra neutrons to dilute the protons' repulsion. Too many neutrons and a nucleus β⁻ decays toward the valley; too few and it β⁺ decays or captures an electron. A partial chart, up to calcium.",
		Tags:        []string{"nuclides", "valley of stability", "decay modes"},
		Wide:        true,
		Render: func() h.Node {
			const cell, left, top = 22.0, 34.0, 10.0
			maxN, maxZ := 29, 21
			W, H := left+float64(maxN)*cell+10, top+float64(maxZ)*cell+34
			y := func(z int) float64 { return top + float64(maxZ-1-z)*cell }
			x := func(n int) float64 { return left + float64(n)*cell }
			var cells []h.Node
			for _, c := range nucNuclides {
				a := c.z + c.n
				label := fmt.Sprintf("%s-%d", c.sym, a)
				cells = append(cells, h.El("g", h.Data("nuclide", label), h.Data("z", fmt.Sprint(c.z)), h.Data("n", fmt.Sprint(c.n)),
					h.Data("mode", nucModeName[c.mode]), h.Data("half", c.half), h.TabIndex(0), h.Role("button"), h.Aria("label", label+", "+nucModeName[c.mode]),
					h.Class("cursor-pointer outline-none"),
					h.El("rect", h.Attr("x", fmt.Sprintf("%.1f", x(c.n)+1)), h.Attr("y", fmt.Sprintf("%.1f", y(c.z)+1)), h.Attr("width", fmt.Sprint(cell-2)), h.Attr("height", fmt.Sprint(cell-2)), h.Attr("rx", "3"),
						h.Style(fmt.Sprintf("fill:%s;fill-opacity:%s;stroke:%s;stroke-width:1", nucModeColor[c.mode], h.Ternary(c.mode == "stable", "0.85", "0.28"), nucModeColor[c.mode])),
						h.Class("transition-[stroke-width] duration-100")),
					h.El("text", h.Attr("x", fmt.Sprintf("%.1f", x(c.n)+cell/2)), h.Attr("y", fmt.Sprintf("%.1f", y(c.z)+cell/2+3)), h.Attr("text-anchor", "middle"),
						h.Class(h.Ternary(c.mode == "stable", "pointer-events-none fill-background font-mono text-[7.5px]", "pointer-events-none fill-foreground font-mono text-[7.5px]")), fmt.Sprint(a)),
				))
			}
			var axes []h.Node
			for n := 0; n < maxN; n += 4 {
				axes = append(axes, h.El("text", h.Attr("x", fmt.Sprintf("%.1f", x(n)+cell/2)), h.Attr("y", fmt.Sprintf("%.1f", top+float64(maxZ)*cell+12)), h.Attr("text-anchor", "middle"), h.Class("fill-muted-foreground font-mono text-[10px]"), fmt.Sprint(n)))
			}
			for z := 0; z < maxZ; z += 4 {
				axes = append(axes, h.El("text", h.Attr("x", fmt.Sprint(left-6)), h.Attr("y", fmt.Sprintf("%.1f", y(z)+cell/2+3)), h.Attr("text-anchor", "end"), h.Class("fill-muted-foreground font-mono text-[10px]"), fmt.Sprint(z)))
			}
			diag := h.El("line", h.Attr("x1", fmt.Sprint(x(0))), h.Attr("y1", fmt.Sprint(y(0)+cell)), h.Attr("x2", fmt.Sprint(x(maxZ))), h.Attr("y2", fmt.Sprint(y(maxZ-1))),
				h.Style("stroke:currentColor;stroke-opacity:0.3;stroke-dasharray:4 4"))
			return plotPanel("nuc-chart",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "stable"),
						legendSwatch("var(--vec-u)", "β⁻"),
						legendSwatch("var(--ion-na)", "β⁺ / EC"),
						legendSwatch("var(--vec-out)", "α"),
						h.Span("dashed: N = Z"),
					),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Svg(h.ViewBox(fmt.Sprintf("0 0 %.0f %.0f", W, H)), h.Class("block w-full min-w-[560px]"), h.Role("group"), h.Aria("label", "Chart of light nuclides"),
							diag, h.Group(axes),
							h.El("text", h.Attr("x", fmt.Sprintf("%.0f", W-10)), h.Attr("y", fmt.Sprintf("%.0f", H-4)), h.Attr("text-anchor", "end"), h.Class("fill-muted-foreground font-mono text-[10px]"), "neutrons N →"),
							h.El("text", h.Attr("x", "4"), h.Attr("y", "10"), h.Class("fill-muted-foreground font-mono text-[10px]"), "Z"),
							h.Group(cells),
						),
					),
				),
				h.Div(h.Data("info", ""), h.Aria("live", "polite"), h.Class("flex min-h-36 flex-col gap-2"),
					h.Span(h.Data("name", ""), h.Class("text-lg font-semibold tracking-tight"), "Pick a nuclide"),
					h.P(h.Data("detail", ""), h.Class("text-sm leading-relaxed text-muted-foreground"), "Hover or tab through the cells. Numbers in the cells are the mass number A = Z + N."),
				),
				readouts([2]string{"Z / N / A", "zna"}, [2]string{"N / Z", "ratio"}, [2]string{"half-life", "half"}),
				nucNote("Partial chart: all stable nuclides up to Z = 20 and common radioactive ones. ⁴⁸Ca and ⁴⁰Ca are counted as stable (⁴⁸Ca's double-β half-life is far longer than the age of the Universe). Half-lives rounded from NUBASE; ⁴⁰K also decays by electron capture (≈ 11%)."),
			)
		},
	}
}

// ---------------------------------------------------------------- N2

func nucBindingBlock() Block {
	return Block{
		Slug:        "binding-energy",
		Title:       "Binding energy per nucleon",
		Description: "Why stars fuse light nuclei and reactors split heavy ones: binding energy per nucleon climbs to a peak near iron and nickel, then slowly falls. The semi-empirical mass formula reproduces the curve from five terms (volume, surface, Coulomb, asymmetry, pairing); pick a mass number to see each term's share.",
		Tags:        []string{"SEMF", "liquid drop", "iron peak"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nuc-binding",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "formula (most stable Z)"),
						legendSwatch("var(--brand)", "measured (AME)"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Binding energy per nucleon against mass number")),
					h.Svg(h.Data("terms", ""), h.ViewBox("0 0 560 90"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "The formula's terms for the chosen nucleus")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Nucleus"),
					field("a", "Mass number A", "", 56, 4, 250, 1),
				),
				readouts([2]string{"Z (most stable)", "z"}, [2]string{"B", "b"}, [2]string{"B / A", "ba"}),
				nucNote("Coefficients (MeV), one common fit: a_V 15.8, a_S 18.3, a_C 0.714, a_A 23.2, a_P 12 (± 12/√A for even–even / odd–odd). Measured points from the Atomic Mass Evaluation. The formula is poor for the lightest nuclei: ⁴He is far more bound than a liquid drop."),
			)
		},
	}
}

// ---------------------------------------------------------------- N3

func nucMassDefectBlock() Block {
	return Block{
		Slug:        "mass-defect",
		Title:       "Mass defect and Q-values",
		Description: "E = mc² with real numbers. A nucleus weighs less than its separate protons and neutrons; the missing mass, times 931.494 MeV per atomic mass unit, is its binding energy. The same arithmetic on a reaction gives its Q-value: the energy released.",
		Tags:        []string{"E = mc²", "AME masses", "Q-value"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("nuc-mass", ""),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("Binding energy of a nucleus"),
					h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("picks", ""),
						h.Map([]string{"H-2", "He-4", "Li-7", "C-12", "O-16", "Fe-56", "Ni-62", "Pb-208", "U-235", "U-238"}, func(s string) h.Node {
							return h.Button(h.Type("button"), h.Data("pick", s), h.Aria("pressed", fmt.Sprint(s == "He-4")),
								h.Class("rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand"), s)
						}),
					),
					h.Div(h.Data("sum", ""), h.Class("code rounded-lg border bg-code p-3 text-[13px] leading-6 whitespace-pre-wrap")),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					panelLabel("Q-value of a reaction"),
					h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("reactions", ""),
						h.Map([][2]string{{"dt", "D + T → ⁴He + n"}, {"dd1", "D + D → ³He + n"}, {"dd2", "D + D → T + p"}, {"dhe3", "D + ³He → ⁴He + p"}, {"pli7", "p + ⁷Li → 2 ⁴He"}, {"nli6", "n + ⁶Li → T + ⁴He"}}, func(r [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("reaction", r[0]), h.Aria("pressed", fmt.Sprint(r[0] == "dt")),
								h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand"), r[1])
						}),
					),
					h.Div(h.Data("q", ""), h.Class("code rounded-lg border bg-code p-3 text-[13px] leading-6 whitespace-pre-wrap")),
				),
				nucNote("Atomic masses in u (AME 2020, rounded to the digits shown). Using atomic masses with ¹H for protons keeps the electrons balanced. 1 u = 931.494 MeV/c²."),
			)
		},
	}
}

// ---------------------------------------------------------------- N4

func nucDecayBlock() Block {
	return Block{
		Slug:        "half-life",
		Title:       "Half-life, one atom at a time",
		Description: "Radioactive decay is random for each atom and smooth for a crowd. 400 atoms each have the same chance to decay in every time step; none of them ages. The count still halves every half-life, and the smaller the sample, the noisier the curve around the exponential.",
		Tags:        []string{"stochastic", "exponential", "seeded"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nuc-decay",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"),
					h.Svg(h.Data("atoms", ""), h.ViewBox("0 0 200 200"), h.Class("mx-auto block w-full max-w-[260px]"), h.Role("img"), h.Aria("label", "Atoms, decayed ones faded")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 360 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Atoms remaining against time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sample"),
					field("atoms", "Atoms", "", 400, 16, 400, 1),
					field("step", "Step", "× t½", 0.1, 0.02, 0.5, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(),
					nucAction("reset", "New sample", hugeicons.ShuffleIcon())),
				readouts([2]string{"time", "t"}, [2]string{"remaining", "left"}, [2]string{"expected", "expected"}),
				nucNote("Each step, every undecayed atom decays with probability p = 1 − 2^(−Δt/t½). Seeded: New sample draws a different random sequence."),
			)
		},
	}
}

// ---------------------------------------------------------------- N5

func nucChainBlock() Block {
	return Block{
		Slug:        "decay-chain",
		Title:       "Decay chains",
		Description: "A parent decays into a radioactive daughter, which decays into a stable granddaughter. The Bateman equations give the exact amounts. When the parent lives longer than the daughter, the daughter's activity catches up and then follows the parent: transient or secular equilibrium. A medical isotope generator (⁹⁹Mo → ⁹⁹ᵐTc) works exactly like this.",
		Tags:        []string{"Bateman", "equilibrium", "activity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nuc-chain",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "parent"),
						legendSwatch("var(--brand)", "daughter"),
						legendSwatch("var(--vec-u)", "stable end"),
						h.Span(h.Data("view-label", ""), "activity"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Decay chain over time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Half-lives"),
					field("t1", "Parent", "h", 66, 0.1, 10000, 0.1),
					field("t2", "Daughter", "h", 6, 0.1, 10000, 0.1),
					h.Div(h.Class("grid grid-cols-2 gap-1.5 pt-1"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "66 6"), h.Class("justify-start font-normal"), "⁹⁹Mo → ⁹⁹ᵐTc"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "1000 5"), h.Class("justify-start font-normal"), "Secular"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "2 10"), h.Class("justify-start font-normal"), "No equilibrium"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Show"),
					segs("Quantity", [2]string{"activity", "Activity"}, [2]string{"amounts", "Amounts"}),
				),
				readouts([2]string{"regime", "regime"}, [2]string{"daughter peak", "peak"}, [2]string{"A₂/A₁ late", "ratio"}),
				nucNote("Exact Bateman solution for N₁(0) = 1, N₂(0) = N₃(0) = 0. ⁹⁹Mo t½ ≈ 66 h, ⁹⁹ᵐTc ≈ 6.0 h (the small branch of ⁹⁹Mo that skips the metastable state is ignored)."),
			)
		},
	}
}

// ---------------------------------------------------------------- N6

func nucFissionBlock() Block {
	return Block{
		Slug:        "fission",
		Title:       "Fission and the chain reaction",
		Description: "A ²³⁵U nucleus that absorbs a slow neutron splits into two fragments and a few new neutrons, releasing about 200 MeV, mostly as the fragments' kinetic energy. If on average each fission causes k more, the neutron population multiplies by k every generation: k < 1 dies out, k = 1 is a steady reactor, k > 1 grows.",
		Tags:        []string{"²³⁵U", "criticality", "energy budget"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nuc-fission",
				h.Div(h.Class("grid gap-4 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Span(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "Where ≈ 200 MeV goes"),
						h.Div(h.Data("budget", ""), h.Class("flex flex-col gap-1.5")),
					),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Span(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "Neutrons per generation (log scale)"),
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 320 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Neutron population by generation")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Chain"),
					field("k", "k", "", 1.05, 0.5, 2.5, 0.01),
					field("gens", "Generations", "", 60, 5, 120, 1),
				),
				readouts([2]string{"state", "state"}, [2]string{"after n gens", "after"}, [2]string{"per kg ²³⁵U", "perkg"}),
				nucNote("Typical textbook budget, ≈ values per fission: fragments 169, prompt neutrons 5, prompt γ 7, β from products 7, delayed γ 6, antineutrinos ≈ 10 MeV (lost). Energy per kilogram assumes every nucleus fissions at 200 MeV."),
			)
		},
	}
}

// ---------------------------------------------------------------- N7

func nucFusionBlock() Block {
	return Block{
		Slug:        "fusion",
		Title:       "Fusion and the Coulomb barrier",
		Description: "Two nuclei must come within a few femtometres to fuse, but their charges repel. The barrier is hundreds of keV high, while a 100-million-kelvin plasma has an average thermal energy near 10 keV: fusion happens only through quantum tunnelling, by the fastest ions. The triple product says how hot, dense and well confined a plasma must be.",
		Tags:        []string{"Coulomb barrier", "tunnelling", "triple product"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nuc-fusion",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "potential energy"),
						legendSwatch("var(--brand)", "thermal kT"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Potential energy against separation")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reaction"),
					segs("Reaction", [2]string{"dt", "D–T"}, [2]string{"dd", "D–D"}, [2]string{"dhe3", "D–³He"}, [2]string{"pp", "p–p"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Plasma"),
					field("temp", "Temperature", "MK", 150, 1, 1000, 1),
				),
				readouts([2]string{"barrier", "barrier"}, [2]string{"kT", "kt"}, [2]string{"barrier / kT", "ratio"}, [2]string{"Q", "q"}),
				nucNote("Barrier at contact, U = 1.44 MeV·fm · Z₁Z₂ / (r₁ + r₂), with r = 1.2 fm · A^(1/3): a simple estimate. D–T ignition needs roughly n·T·τ_E ≳ 3×10²¹ keV·s/m³ (simplified Lawson criterion)."),
			)
		},
	}
}

// ---------------------------------------------------------------- N8

func nucShieldingBlock() Block {
	return Block{
		Slug:        "shielding",
		Title:       "Penetration and shielding",
		Description: "Alpha particles stop in a sheet of paper, beta particles in a few millimetres of aluminium; gamma rays are never fully stopped, only thinned: each half-value layer halves the intensity, I = I₀·e^(−μx). Choose a material and a thickness.",
		Tags:        []string{"attenuation", "half-value layer", "α β γ"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nuc-shield",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("ranges", ""), h.Class("grid gap-1.5")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "lead"),
						legendSwatch("var(--vec-u)", "steel"),
						legendSwatch("var(--ion-cl)", "concrete"),
						legendSwatch("var(--ion-ca)", "water"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Gamma intensity against shield thickness")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Gamma shield"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Photons ≈ 1.25 MeV (⁶⁰Co)"),
					segs("Material", [2]string{"lead", "Lead"}, [2]string{"steel", "Steel"}, [2]string{"concrete", "Concrete"}, [2]string{"water", "Water"}),
					field("x", "Thickness", "cm", 5, 0, 60, 0.1),
				),
				readouts([2]string{"HVL", "hvl"}, [2]string{"μ", "mu"}, [2]string{"transmitted", "trans"}, [2]string{"layers", "layers"}),
				nucNote("Narrow-beam attenuation at 1.25 MeV from NIST mass attenuation coefficients (≈): lead μ/ρ 0.059, iron 0.054, ordinary concrete 0.058, water 0.063 cm²/g. Real shields also scatter photons back into the beam (build-up), so practical half-value layers are larger, e.g. ≈ 1.2 cm of lead."),
			)
		},
	}
}

// ---------------------------------------------------------------- N9

func nucDoseBlock() Block {
	return Block{
		Slug:        "dose",
		Title:       "Dose: gray and sievert",
		Description: "The gray measures energy absorbed (1 Gy = 1 J/kg). The sievert weights it by how damaging the radiation is: the same energy from alpha particles counts twenty times that from gamma rays. Compare a dose with a few well-established reference levels.",
		Tags:        []string{"Gy", "Sv", "ICRP 103"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("nuc-dose", ""),
				h.Div(h.Class("grid gap-4 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("Absorbed dose"),
						field("mgy", "Dose", "mGy", 1, 0, 1000, 0.01),
						h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Radiation type"),
							segButton("1", "γ / X / β", true), segButton("2", "protons", false), segButton("20", "α", false),
						),
					),
					h.Div(h.Class("flex flex-col justify-center gap-1 rounded-lg border bg-code p-4"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Equivalent dose H = w_R · D"),
						h.Span(h.Data("out", "sv"), h.Class("font-mono text-2xl font-medium tabular-nums"), "—"),
						h.Span(h.Data("out", "wr"), h.Class("font-mono text-xs text-muted-foreground")),
					),
				),
				h.Div(h.Data("scale", ""), h.Class("flex flex-col gap-1.5")),
				nucNote("Radiation weighting factors from ICRP Publication 103 (2007); neutrons have an energy-dependent factor (2.5–20) and are left out. References: world-average natural background ≈ 2.4 mSv/yr (UNSCEAR 2008); ICRP public limit 1 mSv/yr above background and occupational limit 20 mSv/yr averaged over 5 years. Medical doses vary widely; the values shown are typical."),
			)
		},
	}
}

// ---------------------------------------------------------------- N10

func nucParticlesBlock() Block {
	return Block{
		Slug:        "standard-model",
		Title:       "The Standard Model and hadrons",
		Description: "Twelve matter particles, four force carriers and the Higgs boson. Quarks never appear alone: they bind in threes (baryons) or quark–antiquark pairs (mesons) with whole-number charge. Build one and see which hadron it is.",
		Tags:        []string{"quarks", "leptons", "hadron builder"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("nuc-sm", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Span(h.Class("text-sm font-medium"), "Elementary particles"),
					segs("View", [2]string{"table", "Particles"}, [2]string{"builder", "Hadron builder"}),
				),
				h.Div(h.Data("view", "table"), h.Class("flex flex-col gap-3"),
					h.Div(h.Data("grid", ""), h.Class("grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-5")),
					h.Div(h.Data("card", ""), h.Aria("live", "polite"), h.Class("min-h-16 rounded-lg border bg-code p-3 text-sm text-muted-foreground"), "Pick a particle."),
				),
				h.Div(h.Data("view", "builder"), h.Hidden(), h.Class("flex flex-col gap-3"),
					h.P(h.Class("text-sm text-muted-foreground"), "Add two (quark + antiquark) or three quarks. Click a slot to clear it."),
					h.Div(h.Data("palette", ""), h.Class("flex flex-wrap gap-1.5")),
					h.Div(h.Data("slots", ""), h.Class("flex min-h-12 flex-wrap items-center gap-2")),
					h.Div(h.Data("result", ""), h.Aria("live", "polite"), h.Class("min-h-20 rounded-lg border bg-code p-3 text-sm")),
				),
				nucNote("Masses ≈ PDG values (light-quark masses are scheme-dependent, MS-bar at 2 GeV). Neutrinos have tiny, non-zero masses (< 1 eV). For quark combinations with several known states, the lightest (ground state) is shown."),
			)
		},
	}
}
