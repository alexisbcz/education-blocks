package site

import (
	"strconv"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// BiochemBlocks lists the biochemistry gallery in display order. Enzyme
// inhibition lives in Biology and titration in Chemistry; these blocks
// pick up from there.
func BiochemBlocks() []Block {
	return []Block{
		biochemBufferBlock(),
		biochemChargeBlock(),
		biochemA280Block(),
		biochemHydropathyBlock(),
		biochemRamaBlock(),
		biochemOxygenBlock(),
		biochemMeltBlock(),
		biochemGelBlock(),
		biochemEnergyBlock(),
		biochemATPBlock(),
	}
}

func biochemPlot(label string, w, hgt int) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox("0 0 "+strconv.Itoa(w)+" "+strconv.Itoa(hgt)), h.Class("block w-full"), h.Role("img"), h.Aria("label", label))
}

func biochemLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

// biochemSeq is a protein sequence box: one-letter codes, typed or pasted.
func biochemSeq(label, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
		h.Span(h.Class("text-muted-foreground"), label),
		h.Textarea(h.Data("seq", ""), h.Attr("rows", "3"), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"),
			h.Class("w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-base leading-relaxed tracking-wider break-all uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
			value),
	)
}

func biochemNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

// Hen egg-white lysozyme (UniProt P00698, mature chain, 129 residues).
const biochemLysozyme = "KVFGRCELAAAMKRHGLDNYRGYSLGNWVCAAKFESNFNTQATNRNTDGSTDYGILQINSRWWCNDGRTPGSRNLCNIPCSALLSSDITASVNCAKKIVSDGNGMNAWVAWRNRCKGTDVQAWIRGCRL"

// ---------------------------------------------------------------- B1

func biochemBufferBlock() Block {
	return Block{
		Slug:        "buffers",
		Title:       "Buffers and Henderson–Hasselbalch",
		Description: "A buffer is a weak acid and its conjugate base. pH = pKa + log([A⁻]/[HA]) sets the ratio; the buffer capacity β, how much strong base it takes to move the pH by one unit, peaks at the pKa and is gone a unit or two away. Pick a buffer and a target pH and get the recipe.",
		Tags:        []string{"Henderson–Hasselbalch", "buffer capacity", "recipe"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-buffer",
				h.Div(h.Class("flex flex-col gap-1"),
					biochemLegend([2]string{"var(--vec-u)", "acid form HA"}, [2]string{"var(--vec-v)", "base form A⁻"}, [2]string{"var(--brand)", "buffer capacity β"}),
					biochemPlot("Species fractions and buffer capacity against pH", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Buffer"),
					segs("Buffer", [2]string{"phosphate", "Phosphate"}, [2]string{"acetate", "Acetate"}, [2]string{"tris", "Tris"}, [2]string{"hepes", "HEPES"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Recipe"),
					field("ph", "Target pH", "", 7.4, 2, 12, 0.01),
					field("conc", "Total", "mM", 100, 1, 1000, 1),
					field("vol", "Volume", "mL", 500, 10, 5000, 10),
				),
				readouts([2]string{"pKa (25 °C)", "pka"}, [2]string{"[A⁻]/[HA]", "ratio"}, [2]string{"acid form", "acid"}, [2]string{"base form", "base"}, [2]string{"β", "beta"}, [2]string{"verdict", "verdict"}),
				biochemNote("Activities are taken as concentrations, so real recipes need a final pH check with a meter, especially above 100 mM. pKa values at 25 °C; Tris drops by about 0.03 per °C."),
			)
		},
	}
}

// ---------------------------------------------------------------- B2

func biochemChargeBlock() Block {
	return Block{
		Slug:        "net-charge",
		Title:       "Net charge and isoelectric point",
		Description: "Every ionizable group is protonated below its pKa and not above it. Summing the fractional charges of the termini and the side chains of D, E, C, Y, H, K and R gives the net charge at any pH; the isoelectric point is where it crosses zero. Type a sequence or a single amino acid.",
		Tags:        []string{"pKa", "pI", "electrophoresis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-charge",
				h.Div(h.Class("flex flex-col gap-1"),
					biochemLegend([2]string{"var(--foreground)", "net charge"}, [2]string{"var(--brand)", "isoelectric point"}),
					biochemPlot("Net charge against pH", 640, 300),
				),
				biochemSeq("Sequence (one-letter codes)", "G"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Examples"),
					segs("Example", [2]string{"G", "Glycine"}, [2]string{"H", "Histidine"}, [2]string{"D", "Aspartate"}, [2]string{"lys", "Lysozyme"}, [2]string{"pep", "Peptide"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cysteines"),
					segs("Cysteines", [2]string{"free", "Free thiols"}, [2]string{"ss", "In disulfides"}),
				),
				h.Div(h.Class("border-t pt-4"), field("ph", "pH", "", 7.4, 0, 14, 0.01)),
				readouts([2]string{"residues", "n"}, [2]string{"pI", "pi"}, [2]string{"charge at pH", "q"}, [2]string{"groups", "groups"}),
				biochemNote("pKa values for free amino acids at 25 °C (Lehninger, Principles of Biochemistry, table 3-1). In a peptide the termini come from the first and last residue; real termini and buried side chains shift, so a measured pI can differ by half a unit or more."),
			)
		},
	}
}

// ---------------------------------------------------------------- B3

func biochemA280Block() Block {
	return Block{
		Slug:        "a280",
		Title:       "Protein concentration from A280",
		Description: "Tryptophan, tyrosine and disulfide bonds absorb at 280 nm, so a sequence predicts its own extinction coefficient: ε = 5500·W + 1490·Y + 125·cystines (Pace et al. 1995). Beer–Lambert, A = ε·c·l, then turns an absorbance reading into a concentration.",
		Tags:        []string{"Beer–Lambert", "extinction coefficient", "mass"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("biochem-a280", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					biochemSeq("Sequence (one-letter codes)", biochemLysozyme),
					h.Div(h.Data("composition", ""), h.Class("flex flex-wrap gap-1.5 font-mono text-[11px]"), h.Aria("label", "Absorbing residues")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 140"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Share of the extinction coefficient by residue")),
				),
				h.Div(h.Class("flex flex-col gap-5 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cysteines"),
						segs("Cysteines", [2]string{"ox", "Paired (cystines)"}, [2]string{"red", "All reduced"}),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Measurement"),
						field("abs", "A280", "", 0.75, 0.001, 3, 0.001),
						field("path", "Path length", "cm", 1, 0.01, 10, 0.01),
					),
					readouts([2]string{"W · Y · S–S", "wyc"}, [2]string{"ε280", "eps"}, [2]string{"mass", "mw"}, [2]string{"A280 of 1 mg/mL", "abs01"}, [2]string{"concentration", "molar"}, [2]string{"in mg/mL", "mgml"}),
					biochemNote("Average residue masses plus one water. Above A ≈ 1.5 most spectrophotometers lose linearity: dilute and measure again. A protein with no W or Y needs another assay."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- B4

func biochemHydropathyBlock() Block {
	return Block{
		Slug:        "hydropathy",
		Title:       "Hydropathy plot",
		Description: "Kyte and Doolittle (1982) gave each amino acid a hydropathy score, from isoleucine at +4.5 to arginine at −4.5. Averaged over a sliding window of about 19 residues, stretches above +1.6 are long and greasy enough to be candidate membrane-spanning helices.",
		Tags:        []string{"Kyte–Doolittle", "membrane proteins", "sliding window"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-hydro",
				h.Div(h.Class("flex flex-col gap-1"),
					biochemLegend([2]string{"var(--foreground)", "window average"}, [2]string{"var(--brand)", "candidate transmembrane segment"}),
					biochemPlot("Hydropathy along the sequence", 640, 280),
				),
				biochemSeq("Sequence (one-letter codes)", ""),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Examples"),
					segs("Example", [2]string{"tm7", "7-helix (synthetic)"}, [2]string{"tm1", "1 helix (synthetic)"}, [2]string{"lys", "Lysozyme"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Window"),
					field("win", "Window", "res", 19, 3, 31, 2),
					field("thr", "Threshold", "", 1.6, 0, 3, 0.1),
				),
				readouts([2]string{"residues", "n"}, [2]string{"GRAVY", "gravy"}, [2]string{"segments", "segs"}, [2]string{"where", "where"}),
				biochemNote("A hydropathy plot is a first guess, not a structure: signal peptides and buried cores also score high. Modern predictors use more than one scale."),
			)
		},
	}
}

// ---------------------------------------------------------------- B5

func biochemRamaBlock() Block {
	return Block{
		Slug:        "ramachandran",
		Title:       "Ramachandran plot",
		Description: "A protein backbone has two free rotations per residue, φ and ψ. Most pairs make atoms collide, so only a few regions are allowed: the right-handed α-helix, the β-sheets and the polyproline helix. Click the plot or pick a secondary structure; glycine, with no side chain, is allowed far more.",
		Tags:        []string{"φ and ψ", "secondary structure", "steric clash"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-rama",
				h.Div(h.Class("flex flex-col gap-1"),
					biochemLegend([2]string{"var(--vec-u)", "favoured"}, [2]string{"var(--vec-v)", "allowed"}, [2]string{"var(--brand)", "your residue"}),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 420 420"), h.Class("mx-auto block w-full max-w-[460px] cursor-crosshair touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md"),
						h.TabIndex(0), h.Role("application"), h.Aria("label", "Ramachandran plot. Arrow keys move φ and ψ by 5 degrees; Shift for 30.")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Secondary structure"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"alpha", "α-helix"}, {"310", "3₁₀ helix"}, {"pi", "π-helix"}, {"anti", "β antiparallel"}, {"par", "β parallel"}, {"ppii", "Polyproline II"}, {"left", "Left-handed α"}, {"clash", "A clash"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", p[0]), h.Class("justify-start"), p[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Residue"),
					segs("Residue", [2]string{"general", "General"}, [2]string{"gly", "Glycine"}, [2]string{"pro", "Proline"}),
				),
				readouts([2]string{"φ, ψ", "angles"}, [2]string{"region", "region"}, [2]string{"residues/turn", "turn"}, [2]string{"rise/residue", "rise"}),
				biochemNote("Regions are smooth sketches of the hard-sphere limits, not contours from a structure survey (see Lovell et al. 2003 for those). Helix geometry is for ideal structures."),
			)
		},
	}
}

// ---------------------------------------------------------------- B6

func biochemOxygenBlock() Block {
	return Block{
		Slug:        "oxygen-binding",
		Title:       "Oxygen binding and cooperativity",
		Description: "Myoglobin binds oxygen on a hyperbola and holds on to it. Hemoglobin's four subunits cooperate: its sigmoid curve, Y = pO₂ⁿ/(P₅₀ⁿ + pO₂ⁿ) with n ≈ 2.8, is steep exactly between the lungs and working muscle, so it loads fully and unloads a lot. Acid and CO₂ shift it right: the Bohr effect.",
		Tags:        []string{"Hill equation", "cooperativity", "Bohr effect"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-o2",
				h.Div(h.Class("flex flex-col gap-1"),
					biochemLegend([2]string{"var(--vec-u)", "myoglobin"}, [2]string{"var(--foreground)", "hemoglobin"}, [2]string{"var(--brand)", "O₂ delivered"}),
					biochemPlot("Saturation against oxygen pressure", 640, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("View"),
					segs("View", [2]string{"curve", "Saturation"}, [2]string{"hill", "Hill plot"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Hemoglobin"),
					field("n", "Hill coefficient n", "", 2.8, 1, 4, 0.1),
					field("p50", "P₅₀ at pH 7.4", "mmHg", 26, 5, 60, 0.5),
					field("ph", "Blood pH", "", 7.4, 6.8, 7.8, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Oxygen pressure"),
					field("lung", "Lungs", "mmHg", 100, 40, 150, 1),
					field("tissue", "Tissue", "mmHg", 40, 5, 100, 1),
				),
				readouts([2]string{"P₅₀ now", "p50"}, [2]string{"Y lungs", "yl"}, [2]string{"Y tissue", "yt"}, [2]string{"delivered", "deliv"}, [2]string{"myoglobin would", "mb"}),
				biochemNote("Myoglobin P₅₀ ≈ 2.8 mmHg; Bohr coefficient Δlog P₅₀/ΔpH ≈ −0.48. The Hill equation fits the middle of the curve; the Monod–Wyman–Changeux model explains it."),
			)
		},
	}
}

// ---------------------------------------------------------------- B7

func biochemMeltBlock() Block {
	return Block{
		Slug:        "dna-melting",
		Title:       "DNA melting temperature",
		Description: "A short duplex melts when the free energy of its stacked base pairs, ΔG = ΔH − TΔS, no longer pays for holding two strands together. The nearest-neighbour model sums ten measured stacks (SantaLucia 1998) and gives a whole melt curve; the Wallace rule, 2 °C per A·T and 4 °C per G·C, is the back-of-the-envelope version for primers.",
		Tags:        []string{"nearest neighbour", "Tm", "primers"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-melt",
				h.Div(h.Class("flex flex-col gap-1"),
					biochemLegend([2]string{"var(--foreground)", "fraction in duplex"}, [2]string{"var(--brand)", "Tm (nearest neighbour)"}, [2]string{"var(--vec-u)", "Tm (Wallace)"}),
					biochemPlot("Fraction of strands in duplex against temperature", 640, 280),
				),
				h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
					h.Span(h.Class("text-muted-foreground"), "Oligo, 5′ → 3′"),
					h.Input(h.Type("text"), h.Data("seq", ""), h.Value("GCGTCAGGTCATGCTAGC"), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"), h.Aria("label", "Oligonucleotide sequence"),
						h.Class("h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-base tracking-wider uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Conditions"),
					field("na", "Na⁺", "mM", 50, 10, 1000, 5),
					field("ct", "Strands", "µM", 0.5, 0.01, 100, 0.01),
				),
				readouts([2]string{"length · GC", "gc"}, [2]string{"ΔH°", "dh"}, [2]string{"ΔS°", "ds"}, [2]string{"ΔG°37", "dg"}, [2]string{"Tm (NN)", "tm"}, [2]string{"Tm (Wallace)", "wal"}),
				biochemNote("Non-self-complementary two-state model with the unified parameters of SantaLucia (1998) and his salt correction to ΔS. Mismatches, dangling ends, Mg²⁺ and hairpins are left out."),
			)
		},
	}
}

// ---------------------------------------------------------------- B8

func biochemGelBlock() Block {
	return Block{
		Slug:        "sds-page",
		Title:       "SDS-PAGE: sizing proteins",
		Description: "SDS coats proteins with negative charge in proportion to their length, so in a gel they separate by size alone. Within a gel's range, distance travelled falls with the logarithm of mass: measure the ladder's relative mobility (Rf), fit the line, and read the unknowns off it. Click a band to measure it.",
		Tags:        []string{"electrophoresis", "standard curve", "log scale"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("biochem-gel", ""),
				h.Div(h.Class("grid min-w-0 gap-3 border-b bg-code p-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:border-r lg:border-b-0"),
					h.Svg(h.Data("gel", ""), h.ViewBox("0 0 300 360"), h.Class("block w-full"), h.Role("group"), h.Aria("label", "Gel lanes; bands are buttons")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 340 360"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Standard curve: log mass against relative mobility")),
				),
				h.Div(h.Class("flex flex-col gap-5 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Acrylamide"),
						segs("Gel percentage", [2]string{"8", "8%"}, [2]string{"10", "10%"}, [2]string{"12", "12%"}, [2]string{"15", "15%"}),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
						h.Div(h.Class("flex items-center gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "run"), hugeicons.PlayIcon(), "Run gel"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reveal"), hugeicons.ViewIcon(), "Reveal"),
						),
					),
					readouts([2]string{"fit", "fit"}, [2]string{"R²", "r2"}, [2]string{"selected band", "band"}, [2]string{"Rf", "rf"}, [2]string{"estimate", "est"}, [2]string{"true mass", "truth"}),
					biochemNote("Ladder sizes follow a common prestained standard (10–250 kDa). Glycoproteins, membrane proteins and very basic proteins run anomalously; outside a gel's linear range bands crowd at the top or the dye front."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- B9

func biochemEnergyBlock() Block {
	return Block{
		Slug:        "free-energy",
		Title:       "Free energy in the cell",
		Description: "ΔG°′ is the free energy change at 1 M of everything and pH 7; the cell is nowhere near that. ΔG = ΔG°′ + RT ln Q says what happens at real concentrations: a reaction with positive ΔG°′ runs forward when its products are drained away, and ATP hydrolysis gives about −50 kJ/mol in a cell, not −30.5.",
		Tags:        []string{"ΔG°′", "mass action", "coupling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biochem-dg",
				h.Div(h.Class("flex flex-col gap-3"),
					h.P(h.Data("equation", ""), h.Class("px-1 pt-1 text-center font-mono text-sm text-foreground"), "—"),
					biochemPlot("Free energy against the mass-action ratio", 640, 260),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reaction"),
					h.Select(h.Data("reaction", ""), h.Aria("label", "Reaction"),
						h.Class("h-9 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
						h.Option(h.Value("atp"), "ATP hydrolysis"),
						h.Option(h.Value("g6p"), "Glucose phosphorylation, uncoupled"),
						h.Option(h.Value("hk"), "Hexokinase (coupled to ATP)"),
						h.Option(h.Value("tpi"), "Triose phosphate isomerase"),
						h.Option(h.Value("mdh"), "Malate dehydrogenase"),
						h.Option(h.Value("pk"), "Pyruvate kinase"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Concentrations"),
					h.Map([]string{"r1", "r2", "p1", "p2"}, func(k string) h.Node {
						return h.Div(h.Data("row", k), field(k, "—", "mM", 1, 0.0001, 100, 0.0001))
					}),
					field("temp", "Temperature", "°C", 37, 0, 60, 1),
				),
				readouts([2]string{"ΔG°′", "dg0"}, [2]string{"Q", "q"}, [2]string{"RT ln Q", "rtlnq"}, [2]string{"ΔG", "dg"}, [2]string{"K′eq", "k"}, [2]string{"direction", "dir"}),
				biochemNote("ΔG°′ values from Lehninger, Principles of Biochemistry. Concentrations are typical cytosolic values chosen for teaching; water and H⁺ at pH 7 are folded into ΔG°′."),
			)
		},
	}
}

// ---------------------------------------------------------------- B10

func biochemATPBlock() Block {
	return Block{
		Slug:        "atp-yield",
		Title:       "ATP from one glucose",
		Description: "Follow one glucose through glycolysis, pyruvate oxidation, the citric acid cycle and oxidative phosphorylation, counting ATP and the reduced carriers NADH and FADH₂. The modern total is about 30 to 32, set by how many protons each carrier pumps and by the shuttle that brings cytosolic NADH into the mitochondrion; textbooks used to say 36 to 38.",
		Tags:        []string{"glycolysis", "TCA cycle", "P/O ratio"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("biochem-atp", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Ol(h.Data("steps", ""), h.Class("flex flex-col gap-1.5")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "ATP tally by source")),
				),
				h.Div(h.Class("flex flex-col gap-5 p-5"),
					h.Div(h.Class("flex items-center gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "prev"), h.Aria("label", "Previous stage"), hugeicons.ArrowLeft01Icon()),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), "Next stage", hugeicons.ArrowRight01Icon()),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("NADH shuttle"),
						segs("Shuttle", [2]string{"ma", "Malate–aspartate"}, [2]string{"g3p", "Glycerol phosphate"}),
					),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("P/O ratios"),
						segs("P/O ratios", [2]string{"modern", "2.5 and 1.5"}, [2]string{"old", "3 and 2"}),
					),
					readouts([2]string{"stage", "stage"}, [2]string{"ATP + GTP", "direct"}, [2]string{"NADH", "nadh"}, [2]string{"FADH₂", "fadh"}, [2]string{"total ATP", "total"}, [2]string{"efficiency", "eff"}),
					biochemNote("Counts per glucose. P/O ratios follow from about 10 H⁺ pumped per NADH, 6 per FADH₂ and 4 H⁺ per ATP made and exported (Hinkle 2005). Efficiency uses ΔG°′ = −2870 kJ/mol for glucose and −30.5 per ATP; in the cell both are larger."),
				),
			)
		},
	}
}
