package site

import (
	"strconv"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// SpectroBlocks lists the spectroscopy and analytical chemistry gallery in
// display order. Titration lives in Chemistry, A280 and gels in
// Biochemistry and vibrational normal modes in Computational Chemistry;
// these blocks read spectra and calibrate instruments.
func SpectroBlocks() []Block {
	return []Block{
		specUnsaturationBlock(),
		specIsotopeBlock(),
		specFragmentBlock(),
		specSplittingBlock(),
		specAssignBlock(),
		specIRBlock(),
		specBeerBlock(),
		specChromBlock(),
		specCalibrationBlock(),
		specXRDBlock(),
	}
}

func specPlot(label string, w, hgt int) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox("0 0 "+strconv.Itoa(w)+" "+strconv.Itoa(hgt)), h.Class("block w-full"), h.Role("img"), h.Aria("label", label))
}

func specLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

func specNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

// specFormula is a molecular formula box such as C6H6 or CH2Cl2.
func specFormula(label, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
		h.Span(h.Class("text-muted-foreground"), label),
		h.Input(h.Type("text"), h.Data("formula", ""), h.Value(value), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"), h.Aria("label", label),
			h.Class("h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-base tracking-wide shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
	)
}

func specSelect(label string, opts ...[2]string) h.Node {
	return h.Select(h.Data("pick", ""), h.Aria("label", label),
		h.Class("h-9 w-full rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
		h.Map(opts, func(o [2]string) h.Node { return h.Option(h.Value(o[0]), o[1]) }),
	)
}

func specButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", action), icon, label)
}

// specWideField is field with room for more digits.
func specWideField(name, lbl, unit, v string, min, max, step float64) h.Node {
	return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
		h.Span(h.Class("text-muted-foreground"), lbl),
		h.Span(h.Class("flex items-center gap-1"),
			h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(v),
				h.Data("min", strconv.FormatFloat(min, 'f', -1, 64)), h.Data("max", strconv.FormatFloat(max, 'f', -1, 64)), h.Data("step", strconv.FormatFloat(step, 'f', -1, 64)),
				h.Attr("autocomplete", "off"),
				h.Class("h-8 w-20 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
			h.Span(h.Class("w-12 font-mono text-[11px] text-muted-foreground"), unit),
		),
	)
}

// specFeedback is the polite live region a quiz block writes its verdicts to.
func specFeedback() h.Node {
	return h.P(h.Data("feedback", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground"))
}

// ---------------------------------------------------------------- S1

func specUnsaturationBlock() Block {
	return Block{
		Slug:        "unsaturation",
		Title:       "Degree of unsaturation",
		Description: "Before looking at a single spectrum, the molecular formula already says how many rings and π bonds the molecule has. Each ring or double bond removes two hydrogens from the saturated maximum, so DoU = (2C + 2 + N − H − X)/2. Oxygen and sulfur don't change it; halogens count as hydrogens.",
		Tags:        []string{"rings plus double bonds", "molecular formula", "first step"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-dou",
				h.Div(h.Class("flex flex-col gap-3 p-1"),
					h.Div(h.Data("atoms", ""), h.Class("flex flex-wrap gap-1.5 font-mono text-[11px]"), h.Aria("label", "Atom counts")),
					specPlot("Hydrogens present against the saturated maximum", 640, 170),
					h.Ul(h.Data("ideas", ""), h.Class("flex flex-col gap-1 px-1 text-sm text-muted-foreground")),
				),
				specFormula("Molecular formula", "C6H6"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Examples"),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"),
						h.Map([][2]string{{"C6H6", "Benzene"}, {"C2H4O2", "Acetic acid"}, {"C6H12", "C₆H₁₂"}, {"C3H3N", "Acrylonitrile"}, {"C7H5ClO", "Benzoyl Cl"}, {"C8H10N4O2", "Caffeine"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("example", p[0]), h.Class("justify-start"), p[1])
						}),
					),
				),
				readouts([2]string{"formula", "formula"}, [2]string{"saturated H", "hmax"}, [2]string{"H equivalents", "heq"}, [2]string{"DoU", "dou"}, [2]string{"status", "status"}),
				specNote("Silicon counts like carbon, phosphorus like nitrogen (trivalent). A half-integer or negative DoU means the formula cannot be a neutral closed-shell molecule: check it."),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func specIsotopeBlock() Block {
	return Block{
		Slug:        "isotope-pattern",
		Title:       "Isotope patterns in mass spectra",
		Description: "A mass spectrometer weighs single molecules, and each molecule carries its own mix of isotopes. Convolving the natural abundances of every atom gives the whole cluster: about 1.1% per carbon at M+1, a 3:1 pair two apart for chlorine and 1:1 for bromine. The pattern alone often tells you which halogens are present.",
		Tags:        []string{"M+1 and M+2", "monoisotopic mass", "Cl and Br"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-iso",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--foreground)", "relative intensity"}, [2]string{"var(--brand)", "monoisotopic peak M"}),
					specPlot("Isotope cluster as a stick spectrum", 640, 300),
				),
				specFormula("Molecular formula", "CH2Cl2"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Examples"),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"),
						h.Map([][2]string{{"CH2Cl2", "CH₂Cl₂"}, {"Br2", "Br₂"}, {"C60", "C₆₀"}, {"C2H5Br", "C₂H₅Br"}, {"C8H10N4O2", "Caffeine"}, {"C2H6S", "C₂H₆S"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("example", p[0]), h.Class("justify-start"), p[1])
						}),
					),
				),
				readouts([2]string{"nominal mass", "nominal"}, [2]string{"monoisotopic", "mono"}, [2]string{"average (MW)", "avg"}, [2]string{"M+1 / M", "m1"}, [2]string{"M+2 / M", "m2"}, [2]string{"most abundant", "top"}),
				specNote("Abundances and exact masses from IUPAC (CIAAW) tables for H, C, N, O, F, Si, P, S, Cl, Br and I. Peaks are summed by nominal mass, which is what a unit-resolution instrument sees; the label shows each cluster member's mean exact mass."),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func specFragmentBlock() Block {
	return Block{
		Slug:        "fragment-losses",
		Title:       "Reading fragment losses",
		Description: "Electron impact knocks an electron out of the molecule and the radical cation falls apart in predictable ways. The gaps between the molecular ion and the big fragments are neutral losses: 15 for a methyl, 18 for water, 29 for ethyl or CHO, 31 for methoxy, 45 for COOH. Click a fragment peak, then name what was lost.",
		Tags:        []string{"electron impact", "neutral losses", "base peak"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-frag",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--foreground)", "fragment"}, [2]string{"var(--vec-u)", "molecular ion M⁺·"}, [2]string{"var(--brand)", "selected"}),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("group"), h.Aria("label", "Mass spectrum; peaks are buttons")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Compound"),
					specSelect("Compound", [2]string{"butanone", "Butan-2-one, C₄H₈O"}, [2]string{"ethanol", "Ethanol, C₂H₆O"}, [2]string{"propanoic", "Propanoic acid, C₃H₆O₂"}, [2]string{"butanol", "Butan-1-ol, C₄H₁₀O"}, [2]string{"acetophenone", "Acetophenone, C₈H₈O"}, [2]string{"mebenzoate", "Methyl benzoate, C₈H₈O₂"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("The neutral lost from M"),
					h.Div(h.Data("losses", ""), h.Class("grid grid-cols-2 gap-1.5")),
				),
				specFeedback(),
				readouts([2]string{"peak", "peak"}, [2]string{"Δ from M", "delta"}, [2]string{"named", "score"}),
				specNote("Spectra are simplified sketches of the main peaks, with rounded intensities in the spirit of the NIST/EPA/NIH library; small peaks are left out. A loss can have two readings (28 is CO or C₂H₄): the compound decides."),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func specSplittingBlock() Block {
	return Block{
		Slug:        "nmr-splitting",
		Title:       "Spin–spin splitting trees",
		Description: "A proton feels the spins of its neighbours a few bonds away, each one up or down. n equivalent neighbours split its signal into n + 1 lines with Pascal's-triangle intensities, spaced by the coupling constant J. Neighbours with different J split in turn, giving a doublet of doublets, a doublet of triplets and so on; when the Js are equal the lines merge back into n + 1.",
		Tags:        []string{"n + 1 rule", "coupling constant J", "multiplets"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-split",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--muted-foreground)", "splitting tree"}, [2]string{"var(--foreground)", "spectrum"}, [2]string{"var(--brand)", "lines and intensities"}),
					specPlot("Splitting tree and resulting multiplet", 640, 380),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"ethyl", "Ethyl CH₂"}, {"ipr", "Isopropyl CH"}, {"vinyl", "Vinyl dd"}, {"propyl", "Propyl CH₂"}, {"dt", "dt"}, {"single", "Singlet"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", p[0]), h.Class("justify-start"), p[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Neighbour sets"),
					field("n1", "Set 1: protons", "", 3, 0, 6, 1),
					field("j1", "Set 1: J", "Hz", 7, 0, 20, 0.1),
					field("n2", "Set 2: protons", "", 0, 0, 6, 1),
					field("j2", "Set 2: J", "Hz", 7, 0, 20, 0.1),
					field("n3", "Set 3: protons", "", 0, 0, 3, 1),
					field("j3", "Set 3: J", "Hz", 4, 0, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Spectrometer"),
					field("mhz", "Field", "MHz", 400, 60, 1000, 10),
					field("lw", "Line width", "Hz", 0.8, 0.2, 6, 0.1),
				),
				readouts([2]string{"pattern", "name"}, [2]string{"lines", "lines"}, [2]string{"intensities", "ints"}, [2]string{"total width", "width"}),
				specNote("First-order rules: they hold when the shift difference between coupled protons is much larger than J (Δν/J ≳ 10). Closer than that, roofing and extra lines appear. Typical ³J: 7 Hz in free alkyl chains, 10 Hz cis and 17 Hz trans across a C=C."),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func specAssignBlock() Block {
	return Block{
		Slug:        "nmr-assign",
		Title:       "Assign a ¹H NMR spectrum",
		Description: "Three things identify each signal: where it sits (the chemical shift, set by nearby electronegative atoms and π systems), how big it is (the integral, proportional to the number of protons) and how it is split (the neighbours). Click a signal, then the protons it belongs to; check when every signal is placed.",
		Tags:        []string{"chemical shift", "integration", "structure"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-assign",
				h.Div(h.Class("flex flex-col gap-2"),
					h.P(h.Data("structure", ""), h.Class("px-1 pt-1 text-center font-mono text-sm text-foreground"), "—"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("group"), h.Aria("label", "¹H NMR spectrum; signals are buttons")),
					h.Svg(h.Data("ranges", ""), h.ViewBox("0 0 640 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Typical chemical shift ranges")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Compound"),
					specSelect("Compound", [2]string{"ethanol", "Ethanol"}, [2]string{"ethylacetate", "Ethyl acetate"}, [2]string{"toluene", "Toluene"}, [2]string{"butanone", "Butan-2-one"}, [2]string{"propanoic", "Propanoic acid"}, [2]string{"isopropanol", "Propan-2-ol"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Protons"),
					h.Div(h.Data("groups", ""), h.Class("flex flex-col gap-1.5")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					specButton("check", "Check", hugeicons.Tick02Icon()),
					specButton("reveal", "Reveal", hugeicons.ViewIcon()),
					specButton("reset", "Clear", hugeicons.Undo02Icon()),
				),
				specFeedback(),
				readouts([2]string{"signal", "signal"}, [2]string{"δ", "shift"}, [2]string{"integral", "integral"}, [2]string{"splitting", "mult"}, [2]string{"assigned", "done"}),
				specNote("Synthetic spectra at 400 MHz in CDCl₃ with rounded literature shifts. OH and COOH positions move with concentration, temperature and water; exchange usually hides their coupling. Toluene's five ring protons are drawn as one multiplet."),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

func specIRBlock() Block {
	return Block{
		Slug:        "ir-bands",
		Title:       "Functional groups from an IR spectrum",
		Description: "Bonds absorb infrared light at the frequencies they vibrate at, so the region above 1500 cm⁻¹ reads like a checklist of functional groups: a broad O–H, a sharp C=O near 1700, a C≡N at 2250, N–H pairs near 3350. Click a band, then the group in the correlation chart that explains it.",
		Tags:        []string{"wavenumber", "correlation chart", "functional groups"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-ir",
				h.Div(h.Class("flex flex-col gap-2"),
					specLegend([2]string{"var(--foreground)", "% transmittance"}, [2]string{"var(--brand)", "selected band"}, [2]string{"var(--vec-u)", "identified"}),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 280"), h.Class("block w-full"), h.Role("group"), h.Aria("label", "Infrared spectrum; bands are buttons")),
					h.Div(h.Data("chart", ""), h.Class("grid gap-1 sm:grid-cols-2"), h.Role("group"), h.Aria("label", "Correlation chart")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Compound"),
					specSelect("Compound", [2]string{"ethanol", "Ethanol"}, [2]string{"acetone", "Acetone"}, [2]string{"propanoic", "Propanoic acid"}, [2]string{"ethylacetate", "Ethyl acetate"}, [2]string{"propylamine", "Propylamine"}, [2]string{"acetonitrile", "Acetonitrile"}, [2]string{"benzaldehyde", "Benzaldehyde"}, [2]string{"hexyne", "Hex-1-yne"}),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					specButton("reveal", "Reveal all", hugeicons.ViewIcon()),
					specButton("reset", "Clear", hugeicons.Undo02Icon()),
				),
				specFeedback(),
				readouts([2]string{"band", "band"}, [2]string{"shape", "shape"}, [2]string{"identified", "score"}),
				specNote("Synthetic spectra drawn from typical band positions, widths and strengths; the fingerprint region below 1500 cm⁻¹ is simplified to its strongest bands. Real spectra of liquids show hydrogen-bonded O–H far broader than in the gas phase."),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func specBeerBlock() Block {
	return Block{
		Slug:        "beer-lambert",
		Title:       "UV-Vis calibration and stray light",
		Description: "Absorbance rises in proportion to concentration, A = εlc, so a line through a few standards turns any reading into a concentration. Real instruments let a little stray light reach the detector; at high absorbance it dominates, the curve bends over and readings far up the curve are underestimated. Fit only the linear range.",
		Tags:        []string{"Beer–Lambert", "calibration curve", "linear range"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-beer",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--muted-foreground)", "ideal A = εlc"}, [2]string{"var(--foreground)", "standards (measured)"}, [2]string{"var(--vec-u)", "least-squares fit"}, [2]string{"var(--brand)", "unknown"}),
					specPlot("Absorbance against concentration", 640, 320),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sample"),
					field("eps", "ε", "L/mol·cm", 15000, 100, 100000, 100),
					field("path", "Path length", "cm", 1, 0.1, 10, 0.1),
					field("cmax", "Top standard", "µM", 200, 10, 1000, 5),
					field("cx", "Unknown (true)", "µM", 150, 1, 1000, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Instrument"),
					field("stray", "Stray light", "%", 0.5, 0, 5, 0.05),
					field("noise", "Noise", "mAU", 3, 0, 30, 0.5),
					segs("Fit", [2]string{"all", "All standards"}, [2]string{"lin", "Only A < 1"}),
				),
				readouts([2]string{"slope", "slope"}, [2]string{"R²", "r2"}, [2]string{"unknown A", "ax"}, [2]string{"estimate", "est"}, [2]string{"error", "err"}),
				specNote("Measured A = −log₁₀((T + s)/(1 + s)) with T = 10^(−εlc) and stray-light fraction s, plus Gaussian noise from a fixed seed. Most spectrophotometers are trustworthy between about 0.1 and 1 absorbance unit."),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func specChromBlock() Block {
	return Block{
		Slug:        "chromatography",
		Title:       "Chromatography: resolution and van Deemter",
		Description: "Two compounds separate on a column because they spend different fractions of time stuck to it; how cleanly they separate depends on how much each band spreads. The van Deemter equation, H = A + B/u + C·u, gives the spreading per unit length against flow speed: too slow and the bands diffuse, too fast and they can't keep up. Move the flow and watch the resolution.",
		Tags:        []string{"plate height", "resolution", "optimal flow"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-chrom",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--vec-u)", "compound 1"}, [2]string{"var(--vec-v)", "compound 2"}, [2]string{"var(--foreground)", "detector signal"}, [2]string{"var(--brand)", "your flow"}),
					specPlot("Chromatogram and van Deemter curve", 640, 420),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Column"),
					field("len", "Length", "mm", 150, 20, 500, 5),
					field("u", "Flow velocity", "mm/s", 1.5, 0.1, 8, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("van Deemter"),
					field("a", "A (eddy)", "µm", 6, 0, 40, 0.5),
					field("b", "B (diffusion)", "µm·mm/s", 12, 0, 80, 0.5),
					field("c", "C (mass transfer)", "µm·s/mm", 4, 0, 40, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Retention"),
					field("k1", "k₁", "", 2, 0.2, 20, 0.05),
					field("alpha", "Selectivity α = k₂/k₁", "", 1.1, 1, 2, 0.005),
				),
				readouts([2]string{"plate height H", "hh"}, [2]string{"plates N", "n"}, [2]string{"u optimum", "uopt"}, [2]string{"t₁ · t₂", "times"}, [2]string{"resolution Rs", "rs"}, [2]string{"verdict", "verdict"}),
				specNote("Rs = 2(t₂ − t₁)/(w₁ + w₂) with baseline widths w = 4σ and σ = t_R/√N, N = L/H; dead time t₀ = L/u and t_R = t₀(1 + k). Rs = 1.5 is baseline separation. The coefficients are typical of a 5 µm HPLC column, not a fitted one."),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func specCalibrationBlock() Block {
	return Block{
		Slug:        "detection-limits",
		Title:       "Detection limits and standard addition",
		Description: "A calibration line gives a slope S and a scatter σ about the line. The smallest concentration you can tell from a blank is the limit of detection, LOD = 3.3σ/S; the smallest you can report with confidence is the limit of quantification, LOQ = 10σ/S. When the sample's own matrix weakens the signal, an external calibration reads low; adding standards to the sample itself, standard addition, cancels the matrix.",
		Tags:        []string{"LOD and LOQ", "regression", "matrix effects"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-cal",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--foreground)", "measurements"}, [2]string{"var(--vec-u)", "fitted line"}, [2]string{"var(--vec-v)", "LOD · LOQ"}, [2]string{"var(--brand)", "sample"}),
					specPlot("Signal against concentration", 640, 320),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Method", [2]string{"external", "External"}, [2]string{"addition", "Standard addition"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Measurement"),
					field("noise", "Noise σ", "a.u.", 0.6, 0.05, 5, 0.05),
					field("matrix", "Matrix response", "%", 70, 20, 130, 1),
					field("cx", "Sample (true)", "ppb", 12, 0.5, 40, 0.5),
				),
				h.Div(h.Class("flex items-center gap-2"), specButton("reseed", "New data", hugeicons.DiceIcon())),
				readouts([2]string{"slope S", "slope"}, [2]string{"σ about line", "sy"}, [2]string{"LOD", "lod"}, [2]string{"LOQ", "loq"}, [2]string{"sample found", "found"}, [2]string{"error", "err"}),
				specNote("LOD and LOQ by the calibration-curve method of ICH Q2(R1), with σ the residual standard deviation. Matrix response is the signal per ppb in the sample relative to clean standards: 70% means the matrix suppresses the signal by 30%."),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func specXRDBlock() Block {
	return Block{
		Slug:        "powder-xrd",
		Title:       "Powder X-ray diffraction",
		Description: "X-rays reflect off planes of atoms where the path difference fits a whole wavelength: 2d sin θ = nλ. In a cubic crystal the spacing of the (hkl) planes is a/√(h² + k² + l²), and the lattice type silences some reflections: body-centred keeps only h + k + l even, face-centred only all-odd or all-even. The missing peaks tell you the lattice.",
		Tags:        []string{"Bragg's law", "Miller indices", "systematic absences"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spec-xrd",
				h.Div(h.Class("flex flex-col gap-1"),
					specLegend([2]string{"var(--foreground)", "diffraction pattern"}, [2]string{"var(--vec-u)", "allowed reflection"}, [2]string{"var(--brand)", "selected"}),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("group"), h.Aria("label", "Powder pattern; reflections are buttons")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Crystal"),
					specSelect("Crystal", [2]string{"cu", "Copper, fcc"}, [2]string{"fe", "α-iron, bcc"}, [2]string{"po", "Polonium, simple cubic"}, [2]string{"si", "Silicon, diamond"}, [2]string{"al", "Aluminium, fcc"}, [2]string{"w", "Tungsten, bcc"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Lattice"),
					segs("Lattice", [2]string{"sc", "SC"}, [2]string{"bcc", "BCC"}, [2]string{"fcc", "FCC"}, [2]string{"dia", "Diamond"}),
					specWideField("a", "Lattice a", "Å", "3.615", 2, 7, 0.001),
					specWideField("lam", "Wavelength λ", "Å", "1.5406", 0.5, 2.5, 0.0001),
				),
				readouts([2]string{"reflection", "hkl"}, [2]string{"h² + k² + l²", "s"}, [2]string{"d spacing", "d"}, [2]string{"2θ", "tt"}, [2]string{"first three", "first"}, [2]string{"N sequence", "seq"}),
				specNote("Intensities are approximate: multiplicity × Lorentz–polarisation × |F|² for one atom type, with a smooth fall-off for the atomic form factor and thermal motion. λ = 1.5406 Å is Cu Kα₁. Lattice parameters at room temperature."),
			)
		},
	}
}
