package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GeneticsBlocks lists the genetics gallery in display order. Biology
// already teaches translation, Punnett squares, drift and selection; these
// blocks start where it stops.
func GeneticsBlocks() []Block {
	return []Block{
		genPedigreeBlock(),
		genLinkageBlock(),
		genChiSquareBlock(),
		genReplicationBlock(),
		genPCRBlock(),
		genDigestBlock(),
		genCRISPRBlock(),
		genLacBlock(),
		genAlignBlock(),
		genGWASBlock(),
	}
}

// genButton is an outline action button with an icon.
func genButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// genPressable is a toggle chip (aria-pressed), for enzymes and options.
func genPressable(attr, value, label string, on bool) h.Node {
	return h.Button(h.Type("button"), h.Data(attr, value), h.Aria("pressed", fmt.Sprint(on)),
		h.Class("rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand"),
		label)
}

// genSvg is a responsive SVG drawing surface filled by genetics.js.
func genSvg(name, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data(name, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// ---------------------------------------------------------------- G1

func genPedigreeBlock() Block {
	return Block{
		Slug:        "pedigree",
		Title:       "Pedigree analyser",
		Description: "Read a family tree like a geneticist. Pick a pedigree or click anyone to change whether they are affected; each mode of inheritance is tested against every family in the tree, and the rule that excludes it is named, down to the individual.",
		Tags:        []string{"inheritance", "exclusion rules", "click to edit"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gen-pedigree",
				h.Div(h.Class("flex flex-col gap-2"),
					genSvg("ped-svg", "0 0 640 400", "Pedigree. Click a person to toggle affected."),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2.5 border border-foreground")), "male"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2.5 rounded-full border border-foreground")), "female"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2.5 bg-foreground")), "affected"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-1.5 w-4 border-y border-foreground")), "consanguineous"),
						h.Span(h.Class("ml-auto"), "Click a person to toggle"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pedigree"),
					segs("Pedigree preset", [2]string{"ad", "A"}, [2]string{"ar", "B"}, [2]string{"xr", "C"}, [2]string{"xd", "D"}, [2]string{"mt", "E"}),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Five families, each drawn to fit one mode. Which one? The verdicts below say."),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Modes of inheritance"),
					h.Ul(h.Data("ped-modes", ""), h.Class("flex flex-col gap-2"), h.Aria("live", "polite")),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Assumes full penetrance, no new mutations and a rare allele, so every unaffected carrier who has to come from outside the tree makes a mode less likely."),
			)
		},
	}
}

// ---------------------------------------------------------------- G2

func genLinkageBlock() Block {
	return Block{
		Slug:        "linkage",
		Title:       "Linkage and mapping",
		Description: "Genes on the same chromosome travel together unless a crossover separates them. Count recombinants in a test cross to get map distance, see why Haldane's function corrects for double crossovers, then order three genes from a three-point cross.",
		Tags:        []string{"recombination", "centimorgans", "three-point cross"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4 sm:p-5"), h.Data("gen-linkage", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Cross", [2]string{"two", "Two-point"}, [2]string{"three", "Three-point"}),
					h.Span(h.Class("text-xs text-muted-foreground"), "Test cross: heterozygote × homozygous recessive"),
				),
				h.Div(h.Data("view", "two"), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.Div(h.Class("rounded-lg border bg-code p-3"),
							genSvg("link-chrom", "0 0 560 200", "Homologous chromosomes through meiosis"),
						),
						h.Div(h.Class("flex items-center justify-between gap-2"),
							h.P(h.Data("link-step-text", ""), h.Class("min-h-10 flex-1 text-sm text-pretty text-muted-foreground"), "—"),
							h.Div(h.Class("flex gap-2"),
								button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
								button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
							),
						),
						h.Div(h.Class("rounded-lg border bg-code p-3"),
							genSvg("link-map", "0 0 560 170", "Map distance against recombination frequency"),
						),
					),
					h.Div(h.Class("flex flex-col gap-4"),
						h.Div(h.Class("flex flex-col gap-2"), panelLabel("Offspring counted"),
							field("rec", "Recombinant", "", 170, 0, 2000, 1),
							field("total", "Total", "", 1000, 1, 5000, 1),
						),
						readouts([2]string{"r", "r"}, [2]string{"naive", "naive"}, [2]string{"Haldane", "haldane"}, [2]string{"verdict", "link"}),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"1 cM = 1% recombinant gametes. r can never pass 50%: unlinked genes assort independently."),
					),
				),
				h.Div(h.Data("view", "three"), h.Hidden(), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.Div(h.Class("scroll-thin overflow-x-auto"),
							h.Table(h.Class("w-full min-w-[420px] text-sm"),
								h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
									h.Th(h.Class("py-2 pr-3 font-normal"), "Offspring class (A B C)"),
									h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Count"),
									h.Th(h.Class("py-2 font-normal"), "Type"),
								)),
								h.Tbody(h.Data("three-rows", "")),
							),
						),
						h.Div(h.Class("rounded-lg border bg-code p-3"), genSvg("three-map", "0 0 560 90", "Deduced gene order and distances")),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						readouts([2]string{"order", "order"}, [2]string{"distance 1", "d1"}, [2]string{"distance 2", "d2"}, [2]string{"expected DCO", "edco"}, [2]string{"coincidence", "coc"}, [2]string{"interference", "interf"}),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"Illustrative counts. The rarest pair of classes are double crossovers: the gene that differs between them and the parentals is in the middle."),
						genButton("reset-three", "Reset counts", hugeicons.RefreshIcon()),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G3

func genChiSquareBlock() Block {
	return Block{
		Slug:        "chi-square",
		Title:       "Chi-square test for a cross",
		Description: "Do the offspring fit the ratio Mendel predicts? Type the counts, pick the expected ratio, and the test gives χ², its degrees of freedom and an exact p-value. The defaults are Mendel's own dihybrid peas.",
		Tags:        []string{"χ² test", "p-value", "Mendel 1866"},
		Wide:        true,
		Render: func() h.Node {
			classes := []struct {
				key, label string
				v          int
			}{{"c1", "Round yellow", 315}, {"c2", "Round green", 108}, {"c3", "Wrinkled yellow", 101}, {"c4", "Wrinkled green", 32}}
			return plotPanel("gen-chisq",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[440px] text-sm"),
							h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
								h.Th(h.Class("py-2 pr-3 font-normal"), "Class"),
								h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Observed"),
								h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Ratio"),
								h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Expected"),
								h.Th(h.Class("py-2 text-right font-normal"), "(O − E)² / E"),
							)),
							h.Tbody(h.Class("font-mono text-[13px] tabular-nums"),
								h.MapIdx(classes, func(i int, c struct {
									key, label string
									v          int
								}) h.Node {
									return h.Tr(h.Data("chi-row", fmt.Sprint(i)), h.Class("border-b last:border-b-0 data-[off]:opacity-35"),
										h.Td(h.Class("py-1.5 pr-3 font-sans"), h.Input(h.Type("text"), h.Data("chi-label", fmt.Sprint(i)), h.Value(c.label), h.Aria("label", fmt.Sprintf("Class %d name", i+1)),
											h.Class("w-36 rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"))),
										h.Td(h.Class("py-1.5 pr-3 text-right"), h.Input(h.Type("text"), h.Attr("inputmode", "numeric"), h.Data("chi-obs", fmt.Sprint(i)), h.Value(fmt.Sprint(c.v)), h.Aria("label", fmt.Sprintf("Observed count %d", i+1)),
											h.Class("h-8 w-20 rounded-md border border-input bg-background px-2 text-right shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"))),
										h.Td(h.Class("py-1.5 pr-3 text-right text-muted-foreground"), h.Data("chi-ratio", fmt.Sprint(i)), "—"),
										h.Td(h.Class("py-1.5 pr-3 text-right"), h.Data("chi-exp", fmt.Sprint(i)), "—"),
										h.Td(h.Class("py-1.5 text-right"), h.Data("chi-part", fmt.Sprint(i)), "—"),
									)
								}),
							),
						),
					),
					h.Div(h.Class("rounded-lg border bg-background p-2"), genSvg("chi-plot", "0 0 560 200", "Chi-square distribution with the observed statistic")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Expected ratio"),
					segs("Expected ratio", [2]string{"9:3:3:1", "9:3:3:1"}, [2]string{"3:1", "3:1"}, [2]string{"1:2:1", "1:2:1"}, [2]string{"1:1:1:1", "1:1:1:1"}, [2]string{"1:1", "1:1"}),
					field("alpha", "α", "", 0.05, 0.001, 0.2, 0.001),
				),
				readouts([2]string{"χ²", "chi"}, [2]string{"df", "df"}, [2]string{"p-value", "p"}, [2]string{"critical", "crit"}, [2]string{"verdict", "verdict"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"A large p does not prove the ratio; it only fails to reject it. The approximation wants every expected count ≥ 5."),
			)
		},
	}
}

// ---------------------------------------------------------------- G4

type genPart struct{ key, name, role string }

var genForkParts = []genPart{
	{"helicase", "Helicase", "Unwinds the double helix at the fork by breaking the hydrogen bonds between bases, using ATP."},
	{"topo", "Topoisomerase", "Works ahead of the fork, cutting and rejoining DNA to relieve the supercoiling that unwinding builds up."},
	{"ssb", "Single-strand binding proteins", "Coat the exposed single strands so they don't snap back together or fold on themselves."},
	{"primase", "Primase", "Lays down short RNA primers: DNA polymerase can only extend an existing 3' end, never start from nothing."},
	{"pol3", "DNA polymerase III", "Adds nucleotides to the 3' end only, so every new strand grows 5' → 3'. On the leading strand it runs continuously toward the fork."},
	{"okazaki", "Okazaki fragments", "On the lagging strand, synthesis runs away from the fork in short pieces (≈1,000–2,000 nt in E. coli), each starting at its own primer."},
	{"pol1", "DNA polymerase I", "Removes the RNA primers with its 5'→3' exonuclease and fills the gaps with DNA."},
	{"ligase", "DNA ligase", "Seals the remaining nick between adjacent fragments with a phosphodiester bond."},
}

func genReplicationBlock() Block {
	return Block{
		Slug:        "replication",
		Title:       "DNA replication fork",
		Description: "Why one strand is copied smoothly and the other in pieces: polymerases only build 5' → 3'. Step through the fork, or point at any enzyme to see its job.",
		Tags:        []string{"stepper", "5' → 3'", "parts picker"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("gen-fork", ""), h.TabIndex(0),
				h.Aria("label", "Replication fork. Arrow keys step through it."),
				h.Div(h.Class("min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"), genSvg("fork-svg", "0 0 640 300", "Replication fork")),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex items-center justify-between"),
						panelLabel("Step"),
						h.Span(h.Data("fork-count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "1 / 5"),
					),
					h.P(h.Data("fork-text", ""), h.Class("min-h-24 text-sm leading-relaxed text-pretty"), "—"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
						h.Span(h.Data("fork-name", ""), h.Class("text-sm font-medium"), "Point at a part"),
						h.P(h.Data("fork-role", ""), h.Class("min-h-16 text-xs leading-relaxed text-muted-foreground"), "Hover an enzyme in the drawing, or pick one below."),
						h.Div(h.Class("flex flex-wrap gap-1.5"),
							h.Map(genForkParts, func(p genPart) h.Node {
								return h.Button(h.Type("button"), h.Data("fork-pick", p.key), h.Data("name", p.name), h.Data("role", p.role),
									h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"),
									p.name)
							}),
						),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G5

func genPCRBlock() Block {
	return Block{
		Slug:        "pcr",
		Title:       "PCR, cycle by cycle",
		Description: "Each cycle melts the DNA, lets primers anneal and extends them, ideally doubling the target. Real reactions copy less than 100% per cycle and level off as reagents run out. Check a primer too: length, GC content and a rough melting temperature.",
		Tags:        []string{"exponential", "efficiency", "primer check"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gen-pcr",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("rounded-lg border bg-background p-2"), genSvg("pcr-temp", "0 0 560 150", "Block temperature during the current cycle")),
					h.Div(h.Class("rounded-lg border bg-background p-2"), genSvg("pcr-copies", "0 0 560 230", "Copies of the target against cycle number, log scale")),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3"),
						h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
							h.Span(h.Class("text-muted-foreground"), "Primer (5' → 3')"),
							h.Input(h.Type("text"), h.Data("pcr-primer", ""), h.Value("AGCGGATAACAATTTCACACAGGA"), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"),
								h.Class("h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-[15px] tracking-wide uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
						),
						h.Div(h.Data("pcr-checks", ""), h.Class("flex flex-wrap gap-1.5 text-xs")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reaction"),
					field("cycle", "Cycle", "", 0, 0, 40, 1),
					field("eff", "Efficiency", "", 0.9, 0.3, 1, 0.01),
					field("start", "Start copies", "log₁₀", 3, 0, 8, 0.1),
					field("anneal", "Anneal", "°C", 58, 45, 72, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
						hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Run")),
					genButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"step", "phase"}, [2]string{"copies", "copies"}, [2]string{"ideal 2ⁿ", "ideal"}, [2]string{"Ct", "ct"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G6

func genDigestBlock() Block {
	return Block{
		Slug:        "digest",
		Title:       "Restriction digest and gel",
		Description: "Cut a 3,000 bp synthetic plasmid with real enzymes, then run the pieces on a gel. A circle cut once gives one band; a line cut once gives two. Small fragments run furthest: distance falls roughly with the logarithm of size.",
		Tags:        []string{"EcoRI · BamHI · HindIII", "circular vs linear", "gel"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gen-digest",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Div(h.Class("rounded-lg border bg-background p-2"), genSvg("digest-map", "-40 0 400 320", "Plasmid map with restriction sites")),
					h.Div(h.Class("rounded-lg border bg-background p-2"), genSvg("digest-gel", "0 0 220 320", "Agarose gel")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Enzymes"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						genPressable("enzyme", "EcoRI", "EcoRI  G^AATTC", true),
						genPressable("enzyme", "BamHI", "BamHI  G^GATCC", false),
						genPressable("enzyme", "HindIII", "HindIII  A^AGCTT", false),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("DNA"),
					segs("Topology", [2]string{"circular", "Circular plasmid"}, [2]string{"linear", "Linear"}),
				),
				genButton("run", "Run the gel", hugeicons.PlayIcon()),
				h.Div(h.Class("flex flex-col gap-1.5 border-t pt-4"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Fragments"),
					h.P(h.Data("digest-frags", ""), h.Class("font-mono text-xs leading-relaxed tabular-nums"), "—"),
					h.P(h.Data("digest-note", ""), h.Class("text-xs leading-relaxed text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G7

const genCRISPRDefault = "ATGCCTGACTTCGATCAGGTAACCGGTACGATCCATGGCAAGCTTGTTCGAAGGCTACCGTTTTGACTGGAACGGTCAGATCCCTTCAGGAGCTAAGTCGTCCACCGATCAGCCGTAGCAATGGACTTGCAGTACCTCGAGAACGTTAGC"

func genCRISPRBlock() Block {
	return Block{
		Slug:        "crispr",
		Title:       "CRISPR guide finder",
		Description: "SpCas9 cuts where a 20-letter guide matches the DNA right next to an NGG PAM, 3 bp before the PAM. Paste a sequence and every target on both strands is found, with its cut site and a few warnings. Educational: real guide design also scores off-target matches genome-wide.",
		Tags:        []string{"NGG PAM", "both strands", "paste a sequence"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 overflow-hidden rounded-xl border bg-background p-4 sm:p-5"), h.Data("gen-crispr", ""),
				h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
					h.Span(h.Class("flex items-center justify-between gap-2 text-muted-foreground"), "Target DNA, 5' → 3' (synthetic example)",
						h.Span(h.Data("crispr-len", ""), h.Class("font-mono text-[11px] tabular-nums"))),
					h.Textarea(h.Data("crispr-seq", ""), h.Attr("rows", "3"), h.Attr("spellcheck", "false"), h.Aria("label", "DNA sequence"),
						h.Class("w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-6 tracking-wide break-all uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						genCRISPRDefault),
				),
				h.Div(h.Class("rounded-lg border bg-code p-3"),
					h.Div(h.Data("crispr-view", ""), h.Class("font-mono text-[13px] leading-7 tracking-wide break-all"), h.Aria("hidden", "true")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-3 w-4 rounded-sm bg-brand/20")), "protospacer"),
					h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-3 w-4 rounded-sm bg-vec-u/25")), "PAM"),
					h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-3 w-0.5 bg-foreground")), "cut"),
					h.Span(h.Data("crispr-count", ""), h.Class("ml-auto")),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					h.Table(h.Class("w-full min-w-[620px] text-sm"),
						h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
							h.Th(h.Class("py-2 pr-3 font-normal"), "Strand"),
							h.Th(h.Class("py-2 pr-3 font-normal"), "Guide (20 nt) + PAM"),
							h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Cut after"),
							h.Th(h.Class("py-2 pr-3 text-right font-normal"), "GC"),
							h.Th(h.Class("py-2 font-normal"), "Notes"),
						)),
						h.Tbody(h.Data("crispr-hits", ""), h.Class("font-mono text-[12px]")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G8

func genLacBlock() Block {
	return Block{
		Slug:        "lac-operon",
		Title:       "The lac operon",
		Description: "E. coli makes lactose-digesting enzymes only when it pays: lactose must be present (to lift the repressor) and glucose absent (so CAP can boost the promoter). Flip the two sugars and watch the switches.",
		Tags:        []string{"gene regulation", "Jacob & Monod 1961", "truth table"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gen-lac",
				genSvg("lac-svg", "0 0 640 250", "The lac operon and its regulators"),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Medium"),
					toggle("gen-lac-lactose", "lactose", "Lactose present", true),
					toggle("gen-lac-glucose", "glucose", "Glucose present", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					h.Table(h.Class("w-full text-xs"),
						h.Thead(h.Tr(h.Class("text-left text-muted-foreground"),
							h.Th(h.Class("pb-1.5 font-normal"), "Lactose"), h.Th(h.Class("pb-1.5 font-normal"), "Glucose"), h.Th(h.Class("pb-1.5 font-normal"), "Transcription"))),
						h.Tbody(h.Class("font-mono"),
							h.Map([][3]string{{"−", "+", "off"}, {"−", "−", "off"}, {"+", "+", "low"}, {"+", "−", "high"}}, func(r [3]string) h.Node {
								return h.Tr(h.Data("lac-row", r[0]+r[1]), h.Class("data-[on]:bg-brand/10 data-[on]:text-brand"),
									h.Td(h.Class("rounded-l-md px-1 py-1"), r[0]), h.Td(h.Class("px-1 py-1"), r[1]), h.Td(h.Class("rounded-r-md px-1 py-1"), r[2]))
							}),
						),
					),
				),
				h.P(h.Data("lac-text", ""), h.Aria("live", "polite"), h.Class("min-h-24 text-xs leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- G9

func genAlignBlock() Block {
	return Block{
		Slug:        "alignment",
		Title:       "Global sequence alignment",
		Description: "Needleman–Wunsch (1970): the best alignment of two whole sequences, built by dynamic programming. Each cell takes the best of a match or mismatch from the diagonal or a gap from above or left; the traceback reads the alignment off the arrows.",
		Tags:        []string{"Needleman–Wunsch", "dynamic programming", "traceback"},
		Wide:        true,
		Render: func() h.Node {
			seqInput := func(name, v string) h.Node {
				return h.Input(h.Type("text"), h.Data("align-seq", name), h.Value(v), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"), h.Aria("label", "Sequence "+name),
					h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-[15px] tracking-[0.2em] uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"))
			}
			return plotPanel("gen-align",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"), h.Div(h.Data("align-grid", ""), h.Class("inline-grid gap-px font-mono text-[12px] tabular-nums"))),
					h.Pre(h.Data("align-out", ""), h.Class("scroll-thin overflow-x-auto rounded-lg border bg-background px-3 py-2 font-mono text-[15px] leading-6 tracking-[0.2em]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sequences"), seqInput("a", "GCATGCG"), seqInput("b", "GATTACA")),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Scores"),
					field("match", "Match", "", 1, -5, 10, 1),
					field("mismatch", "Mismatch", "", -1, -10, 5, 1),
					field("gap", "Gap", "", -1, -10, 0, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					genButton("fill", "Fill step by step", hugeicons.PlayIcon()),
					genButton("instant", "Fill at once", hugeicons.FlashIcon()),
				),
				readouts([2]string{"score", "score"}, [2]string{"identity", "identity"}, [2]string{"gaps", "gaps"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G10

func genGWASBlock() Block {
	return Block{
		Slug:        "gwas",
		Title:       "GWAS Manhattan plot",
		Description: "A genome-wide association study tests a million variants one by one, so most \"hits\" at p = 0.05 are noise. Synthetic data: a few real signals among chance; only peaks above the genome-wide line, p < 5 × 10⁻⁸, count.",
		Tags:        []string{"multiple testing", "synthetic data", "hover"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gen-gwas",
				h.Div(h.Class("relative"),
					genSvg("gwas-plot", "0 0 640 300", "Manhattan plot of synthetic association p-values", h.Class("block w-full cursor-crosshair select-none")),
					h.Div(h.Data("gwas-tip", ""), h.Hidden(), h.Class("pointer-events-none absolute rounded-md border bg-popover px-2 py-1 font-mono text-[11px] shadow-md")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Study"),
					field("signals", "True signals", "", 4, 0, 10, 1),
					field("effect", "Signal strength", "", 1, 0.2, 2, 0.1),
				),
				genButton("reseed", "New study", hugeicons.ShuffleIcon()),
				readouts([2]string{"variants", "n"}, [2]string{"p < 0.05", "nominal"}, [2]string{"genome-wide", "hits"}, [2]string{"loci", "loci"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"5 × 10⁻⁸ ≈ 0.05 / 1,000,000, a Bonferroni correction for about a million independent tests. Common-variant hits usually explain only a small part of a trait's heritability."),
			)
		},
	}
}
