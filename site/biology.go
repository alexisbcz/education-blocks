package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// BiologyBlocks lists the biology gallery in display order.
func BiologyBlocks() []Block {
	return []Block{
		bioCellBlock(),
		bioTranslateBlock(),
		bioPunnettBlock(),
		bioDriftBlock(),
		bioSelectionBlock(),
		bioPredatorPreyBlock(),
		bioLogisticBlock(),
		bioEnzymeBlock(),
	}
}

// ---------------------------------------------------------------- B1

type bioOrganelle struct {
	key, name, role, fact string
}

var bioAnimalParts = []bioOrganelle{
	{"a-membrane", "Plasma membrane", "A phospholipid bilayer with embedded proteins that controls what enters and leaves the cell.", "It is about 7–10 nm thick."},
	{"a-nucleus", "Nucleus", "Holds the chromosomes inside a double membrane, the nuclear envelope, pierced by nuclear pores.", "Transcription happens here; translation happens outside, in the cytoplasm."},
	{"a-nucleolus", "Nucleolus", "A dense region of the nucleus where ribosomal RNA is made and ribosome subunits are assembled.", "It has no membrane of its own."},
	{"a-er", "Rough endoplasmic reticulum", "Membrane sheets studded with ribosomes that make proteins destined for membranes or for secretion.", "Smooth ER, without ribosomes, makes lipids and detoxifies."},
	{"a-golgi", "Golgi apparatus", "A stack of flattened sacs that modifies, sorts and packages proteins from the ER into vesicles.", "Proteins enter on the cis face and leave from the trans face."},
	{"a-mito", "Mitochondria", "Sites of aerobic respiration, where most of the cell's ATP is made by oxidative phosphorylation.", "They have their own circular DNA, a trace of their bacterial origin."},
	{"a-lysosome", "Lysosome", "A vesicle of digestive enzymes that work at acidic pH, breaking down worn-out parts and engulfed material.", "Plant cells use their vacuole for much of this role."},
	{"a-centrosome", "Centrosome", "The main microtubule-organizing centre; its two centrioles help build the spindle in cell division.", "Most plant cells have no centrioles."},
}

var bioPlantParts = []bioOrganelle{
	{"p-wall", "Cell wall", "A rigid layer of cellulose outside the membrane that gives the cell its shape and resists bursting.", "Fungi and bacteria have walls too, made of other polymers."},
	{"p-membrane", "Plasma membrane", "The selectively permeable bilayer just inside the wall.", "Pressed against the wall by turgor pressure when the vacuole is full."},
	{"p-vacuole", "Central vacuole", "A large sac of water and solutes; its pressure keeps the cell turgid, and it stores and breaks down materials.", "It can fill most of a mature cell's volume."},
	{"p-chloro", "Chloroplasts", "Sites of photosynthesis: light reactions in the thylakoid membranes, carbon fixation in the stroma.", "Like mitochondria, they carry their own DNA."},
	{"p-nucleus", "Nucleus", "Holds the chromosomes; pushed to the side by the central vacuole.", "Same structure as in animal cells."},
	{"p-mito", "Mitochondria", "Plant cells respire too: mitochondria make ATP from the sugars that chloroplasts produce.", "Photosynthesis does not replace respiration."},
	{"p-golgi", "Golgi apparatus", "Packages proteins and also makes polysaccharides for the cell wall.", "Many small Golgi stacks are spread through the cytoplasm."},
}

// bioPart wraps a drawing as a focusable, pickable part.
func bioPart(key, name string, children ...any) h.Node {
	return h.El("g", append([]any{h.Data("part", key), h.TabIndex(0), h.Role("button"), h.Aria("label", name),
		h.Class("cursor-pointer outline-none [&_*]:transition-[stroke,fill] [&_*]:duration-150")}, children...)...)
}

const bioFill = "fill-[color-mix(in_oklab,var(--part)_14%,var(--code-bg))] stroke-[var(--part)]"

func bioShape(tag string, attrs ...any) h.Node {
	return h.El(tag, append([]any{h.Class(bioFill), h.Attr("stroke-width", "1.5")}, attrs...)...)
}

func bioAttrs(kv ...string) []any {
	out := make([]any, 0, len(kv)/2)
	for i := 0; i+1 < len(kv); i += 2 {
		out = append(out, h.Attr(kv[i], kv[i+1]))
	}
	return out
}

func bioMito(x, y, rot float64) h.Node {
	return h.El("g", h.Attr("transform", fmt.Sprintf("translate(%g %g) rotate(%g)", x, y, rot)),
		bioShape("ellipse", bioAttrs("cx", "0", "cy", "0", "rx", "22", "ry", "10")...),
		h.El("path", h.Attr("d", "M-16 0 q4 -7 8 0 t8 0 t8 0 t8 0"), h.Attr("fill", "none"), h.Attr("stroke-width", "1.2"), h.Class("stroke-[var(--part)]")),
	)
}

func bioSVGClass() string {
	return "block w-full [--part:color-mix(in_oklab,var(--foreground)_50%,transparent)] [&_[data-part]:is(:hover,:focus-visible,[data-on])]:[--part:var(--brand)]"
}

func bioAnimalSVG() h.Node {
	return h.Svg(h.ViewBox("0 0 420 280"), h.Class(bioSVGClass()), h.Role("group"), h.Aria("label", "Schematic animal cell"),
		bioPart("a-membrane", "Plasma membrane", bioShape("ellipse", bioAttrs("cx", "210", "cy", "140", "rx", "196", "ry", "126")...)),
		bioPart("a-er", "Rough endoplasmic reticulum",
			h.El("path", h.Attr("d", "M232 70 q40 -6 60 14 M236 84 q34 -4 50 14 M240 98 q26 -2 40 12"), h.Attr("fill", "none"), h.Attr("stroke-width", "4"), h.Attr("stroke-linecap", "round"), h.Class("stroke-[var(--part)]")),
			h.Map([][2]int{{252, 64}, {270, 70}, {286, 80}, {256, 79}, {274, 86}, {260, 94}, {276, 102}}, func(p [2]int) h.Node {
				return h.El("circle", h.Attr("cx", fmt.Sprint(p[0])), h.Attr("cy", fmt.Sprint(p[1])), h.Attr("r", "2"), h.Class("fill-[var(--part)]"))
			}),
		),
		bioPart("a-nucleus", "Nucleus", bioShape("circle", bioAttrs("cx", "190", "cy", "130", "r", "50")...),
			h.Map([][2]int{{150, 112}, {172, 84}, {210, 84}, {236, 116}, {226, 160}, {160, 162}}, func(p [2]int) h.Node {
				return h.El("circle", h.Attr("cx", fmt.Sprint(p[0])), h.Attr("cy", fmt.Sprint(p[1])), h.Attr("r", "2.2"), h.Class("fill-[var(--code-bg)] stroke-[var(--part)]"), h.Attr("stroke-width", "1"))
			})),
		bioPart("a-nucleolus", "Nucleolus", bioShape("circle", bioAttrs("cx", "200", "cy", "126", "r", "14")...)),
		bioPart("a-golgi", "Golgi apparatus",
			h.Map([]int{0, 1, 2, 3}, func(i int) h.Node {
				y := 182 + i*9
				return h.El("path", h.Attr("d", fmt.Sprintf("M%d %d q30 %d 60 0", 268+i*2, y, -10+i)), h.Attr("fill", "none"), h.Attr("stroke-width", "4"), h.Attr("stroke-linecap", "round"), h.Class("stroke-[var(--part)]"))
			}),
			bioShape("circle", bioAttrs("cx", "340", "cy", "180", "r", "4")...), bioShape("circle", bioAttrs("cx", "346", "cy", "196", "r", "3.5")...),
		),
		bioPart("a-mito", "Mitochondria", bioMito(96, 196, -20), bioMito(300, 140, 30), bioMito(120, 74, 15)),
		bioPart("a-lysosome", "Lysosome", bioShape("circle", bioAttrs("cx", "236", "cy", "214", "r", "10")...), bioShape("circle", bioAttrs("cx", "70", "cy", "130", "r", "8")...)),
		bioPart("a-centrosome", "Centrosome",
			h.El("rect", h.Attr("x", "330"), h.Attr("y", "96"), h.Attr("width", "6"), h.Attr("height", "18"), h.Attr("rx", "2"), h.Class(bioFill), h.Attr("stroke-width", "1.5")),
			h.El("rect", h.Attr("x", "340"), h.Attr("y", "104"), h.Attr("width", "18"), h.Attr("height", "6"), h.Attr("rx", "2"), h.Class(bioFill), h.Attr("stroke-width", "1.5")),
		),
	)
}

func bioPlantSVG() h.Node {
	return h.Svg(h.ViewBox("0 0 420 280"), h.Class(bioSVGClass()), h.Role("group"), h.Aria("label", "Schematic plant cell"),
		bioPart("p-wall", "Cell wall", h.El("rect", h.Attr("x", "14"), h.Attr("y", "14"), h.Attr("width", "392"), h.Attr("height", "252"), h.Attr("rx", "10"),
			h.Class("fill-none stroke-[var(--part)]"), h.Attr("stroke-width", "7"))),
		bioPart("p-membrane", "Plasma membrane", h.El("rect", h.Attr("x", "24"), h.Attr("y", "24"), h.Attr("width", "372"), h.Attr("height", "232"), h.Attr("rx", "6"),
			h.Class("fill-[color-mix(in_oklab,var(--part)_6%,var(--code-bg))] stroke-[var(--part)]"), h.Attr("stroke-width", "1.5"))),
		bioPart("p-vacuole", "Central vacuole", bioShape("rect", bioAttrs("x", "120", "y", "60", "width", "220", "height", "150", "rx", "40")...)),
		bioPart("p-nucleus", "Nucleus", bioShape("circle", bioAttrs("cx", "74", "cy", "76", "r", "30")...), bioShape("circle", bioAttrs("cx", "80", "cy", "72", "r", "9")...)),
		bioPart("p-chloro", "Chloroplasts",
			h.Map([][3]float64{{60, 200, 20}, {372, 110, -70}, {200, 236, 0}, {300, 40, 10}, {372, 210, 80}}, func(c [3]float64) h.Node {
				return h.El("g", h.Attr("transform", fmt.Sprintf("translate(%g %g) rotate(%g)", c[0], c[1], c[2])),
					bioShape("ellipse", bioAttrs("cx", "0", "cy", "0", "rx", "22", "ry", "12")...),
					h.Map([]int{-10, -3, 4, 11}, func(x int) h.Node {
						return h.El("rect", h.Attr("x", fmt.Sprint(x-2)), h.Attr("y", "-6"), h.Attr("width", "4"), h.Attr("height", "12"), h.Attr("rx", "1"), h.Class("fill-[var(--part)]"))
					}),
				)
			}),
		),
		bioPart("p-mito", "Mitochondria", bioMito(60, 140, 80), bioMito(140, 238, -10)),
		bioPart("p-golgi", "Golgi apparatus",
			h.Map([]int{0, 1, 2}, func(i int) h.Node {
				y := 40 + i*8
				return h.El("path", h.Attr("d", fmt.Sprintf("M%d %d q24 %d 48 0", 160+i*2, y, -8+i)), h.Attr("fill", "none"), h.Attr("stroke-width", "4"), h.Attr("stroke-linecap", "round"), h.Class("stroke-[var(--part)]"))
			}),
		),
	)
}

func bioPicks(parts []bioOrganelle) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1.5"),
		h.Map(parts, func(p bioOrganelle) h.Node {
			return h.Button(h.Type("button"), h.Data("pick", p.key), h.Data("name", p.name), h.Data("role", p.role), h.Data("fact", p.fact),
				h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"),
				p.name)
		}),
	)
}

func bioCellBlock() Block {
	return Block{
		Slug:        "cell",
		Title:       "Cell explorer",
		Description: "An animal cell and a plant cell, schematic and not to scale. Point at an organelle (or Tab through them) to read what it does; switch cells to see what plants add (a wall, a central vacuole, chloroplasts) and what they lack.",
		Tags:        []string{"SVG", "parts picker", "keyboard"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("bio-cell", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					segs("Cell type", [2]string{"animal", "Animal cell"}, [2]string{"plant", "Plant cell"}),
					h.Div(h.Data("view", "animal"), bioAnimalSVG()),
					h.Div(h.Data("view", "plant"), h.Hidden(), bioPlantSVG()),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Aria("live", "polite"), h.Class("flex min-h-40 flex-col gap-2"),
						h.Span(h.Data("info-name", ""), h.Class("text-base font-semibold tracking-tight"), "Point at an organelle"),
						h.P(h.Data("info-role", ""), h.Class("text-sm leading-relaxed text-muted-foreground"), "Hover the drawing, or press Tab to step through the cell."),
						h.P(h.Data("info-fact", ""), h.Class("text-xs leading-relaxed text-muted-foreground empty:hidden")),
					),
					h.Div(h.Class("border-t pt-4"),
						h.Div(h.Data("view", "animal"), bioPicks(bioAnimalParts)),
						h.Div(h.Data("view", "plant"), h.Hidden(), bioPicks(bioPlantParts)),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- B2

func bioTranslateBlock() Block {
	return Block{
		Slug:        "translation",
		Title:       "From DNA to protein",
		Description: "Type a coding-strand DNA sequence and follow it to mRNA and protein with the standard genetic code: reading starts at the first AUG and stops at UAA, UAG or UGA. Then mutate it and see whether the change is silent, missense, nonsense or a frameshift.",
		Tags:        []string{"genetic code", "mutations", "codons"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 overflow-hidden rounded-xl border bg-background p-4 sm:p-5"), h.Data("bio-translate", ""),
				h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
					h.Span(h.Class("text-muted-foreground"), "Coding strand, 5′ → 3′"),
					h.Input(h.Type("text"), h.Data("seq", ""), h.Value("ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG"), h.Attr("spellcheck", "false"), h.Attr("autocomplete", "off"),
						h.Class("h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-base tracking-wider uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
				),
				h.Div(h.Class("flex flex-wrap items-end gap-3 border-y py-3"),
					h.Div(h.Class("w-48"), field("pos", "Position", "", 8, 1, 200, 1)),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("mutate", "sub"), "Substitute"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("mutate", "ins"), "Insert a base"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("mutate", "del"), "Delete a base"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("mutate", "reset"), hugeicons.RefreshIcon(), "Reset"),
				),
				h.Div(h.Class("scroll-thin flex flex-col gap-4 overflow-x-auto pb-1"),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Original"), h.Div(h.Data("row", "orig"))),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Mutant"), h.Div(h.Data("row", "mut"))),
				),
				h.P(h.Data("out", "effect"), h.Aria("live", "polite"), h.Class("rounded-lg border bg-code p-3 text-sm"), "Mutate the sequence to compare."),
			)
		},
	}
}

// ---------------------------------------------------------------- B3

func bioGenoPicker(label, group string) h.Node {
	return h.Div(h.Class("flex items-center justify-between gap-3 text-sm"), h.Data("gene-row", group[len(group)-1:]),
		h.Span(h.Class("text-muted-foreground"), label),
		h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", label), h.Data("geno", group),
			h.MapIdx([]string{"XX", "Xx", "xx"}, func(i int, g string) h.Node {
				gene := group[len(group)-1:]
				lo := map[string]string{"A": "a", "B": "b"}[gene]
				txt := map[string]string{"XX": gene + gene, "Xx": gene + lo, "xx": lo + lo}[g]
				return segButton(txt, txt, i == 1)
			}),
		),
	)
}

func bioPunnettBlock() Block {
	return Block{
		Slug:        "punnett",
		Title:       "Punnett squares",
		Description: "Mendel's crosses, counted. Pick each parent's genotype; the grid lists every combination of gametes, and the counts give the classic ratios: 3 : 1 for Aa × Aa, and 9 : 3 : 3 : 1 when two independent genes are crossed.",
		Tags:        []string{"Mendel", "genotypes", "ratios"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("bio-punnett", ""),
				h.Div(h.Class("scroll-thin min-w-0 overflow-x-auto border-b bg-code p-4 lg:border-r lg:border-b-0"), h.Div(h.Data("grid", ""))),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Cross"), h.Data("mode", ""),
						segButton("mono", "One gene", true), segButton("di", "Two genes", false)),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parent 1"), bioGenoPicker("Gene A", "p1A"), bioGenoPicker("Gene B", "p1B")),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parent 2"), bioGenoPicker("Gene A", "p2A"), bioGenoPicker("Gene B", "p2B")),
					h.Div(h.Class("flex flex-col gap-1.5 border-t pt-4"), panelLabel("Offspring phenotypes"), h.Div(h.Data("out", "pheno"), h.Class("flex flex-col gap-1 font-mono text-xs"))),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Capital letters are dominant alleles. Genes assumed on different chromosomes (independent assortment)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- B4

func bioDriftBlock() Block {
	return Block{
		Slug:        "drift",
		Title:       "Hardy–Weinberg and genetic drift",
		Description: "Without selection, mutation or migration, genotype frequencies sit at p², 2pq and q². In a finite population chance still moves allele frequencies: twelve Wright–Fisher populations drift from the same start, and small ones fix or lose the allele fast.",
		Tags:        []string{"Wright–Fisher", "Hardy–Weinberg", "seeded"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bio-drift",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Allele frequency over generations")),
					h.Div(h.Data("hw", ""), h.Class("flex h-7 overflow-hidden rounded-md border font-mono text-[10px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Population"),
					field("n", "Size N", "", 50, 2, 1000, 1),
					field("p0", "Start p", "", 0.5, 0.01, 0.99, 0.01),
					field("gens", "Generations", "", 150, 10, 500, 10),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.ShuffleIcon(), "New run"),
				readouts([2]string{"fixed (p = 1)", "fixed"}, [2]string{"lost (p = 0)", "lost"}, [2]string{"still varying", "seg"}, [2]string{"mean p", "mean"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B5

func bioSelectionBlock() Block {
	return Block{
		Slug:        "selection",
		Title:       "Natural selection",
		Description: "One gene, two alleles, three genotypes with different fitness. The allele frequency follows the exact recursion p′ = p(p·w_AA + q·w_Aa) / w̄. Give the heterozygote the highest fitness and both alleles are kept, as with sickle-cell and malaria.",
		Tags:        []string{"population genetics", "fitness", "recursion"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bio-selection",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Frequency of allele A over generations")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Fitness"),
					field("waa", "w_AA", "", 1, 0, 1.5, 0.01),
					field("wab", "w_Aa", "", 1, 0, 1.5, 0.01),
					field("wbb", "w_aa", "", 0.9, 0, 1.5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Start"),
					field("p0", "p (allele A)", "", 0.05, 0.001, 0.999, 0.001),
					field("gens", "Generations", "", 200, 10, 1000, 10),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "1 1 0.9"), "Dominant A"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "0.8 1 0.6"), "Overdominance"),
				),
				readouts([2]string{"p at end", "pend"}, [2]string{"equilibrium", "eq"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B6

func bioPredatorPreyBlock() Block {
	return Block{
		Slug:        "predator-prey",
		Title:       "Predator and prey",
		Description: "The Lotka–Volterra equations, integrated with RK4: prey x grow at rate α and are eaten at βxy; predators y grow by δxy and die at γ. Populations cycle out of phase around the equilibrium (γ/δ, α/β); the conserved quantity V confirms the integration is accurate.",
		Tags:        []string{"ODE", "RK4", "phase portrait"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bio-lv",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("time", ""), h.ViewBox("0 0 400 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Populations over time")),
					h.Svg(h.Data("phase", ""), h.ViewBox("0 0 260 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Phase portrait")),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "prey x"), legendSwatch("var(--brand)", "predators y")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rates"),
					field("alpha", "α prey growth", "", 1, 0.1, 3, 0.05),
					field("beta", "β predation", "", 0.1, 0.01, 0.5, 0.005),
					field("delta", "δ conversion", "", 0.075, 0.01, 0.5, 0.005),
					field("gamma", "γ predator death", "", 1.5, 0.1, 3, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Start"),
					field("x0", "x₀", "", 10, 1, 100, 1),
					field("y0", "y₀", "", 5, 1, 100, 1),
				),
				readouts([2]string{"equilibrium", "eq"}, [2]string{"period ≈", "period"}, [2]string{"V drift", "drift"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B7

func bioLogisticBlock() Block {
	return Block{
		Slug:        "logistic",
		Title:       "Population growth",
		Description: "Exponential growth cannot last. The logistic model dN/dt = rN(1 − N/K) starts exponential, slows as N nears the carrying capacity K, and grows fastest at N = K/2. Curves are the exact solutions.",
		Tags:        []string{"logistic", "carrying capacity", "closed form"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bio-logistic",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Population size over time")),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "logistic"), legendSwatch("var(--brand)", "exponential"), legendSwatch("var(--vec-u)", "growth rate dN/dt")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					field("r", "r", "per year", 0.5, 0.05, 2, 0.05),
					field("k", "K", "", 1000, 50, 5000, 10),
					field("n0", "N₀", "", 20, 1, 4000, 1),
				),
				readouts([2]string{"fastest growth at", "tstar"}, [2]string{"max dN/dt", "maxrate"}, [2]string{"doubling time (early)", "double"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B8

func bioEnzymeBlock() Block {
	return Block{
		Slug:        "enzyme",
		Title:       "Enzyme kinetics",
		Description: "Michaelis–Menten: v = V_max[S] / (K_m + [S]). Add an inhibitor and watch how each kind changes the curve, then switch to the Lineweaver–Burk double-reciprocal plot, where competitive inhibitors meet on the y-axis and non-competitive ones on the x-axis.",
		Tags:        []string{"Michaelis–Menten", "inhibition", "Lineweaver–Burk"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bio-enzyme",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Reaction rate against substrate")),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "no inhibitor"), legendSwatch("var(--brand)", "with inhibitor")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Enzyme"),
					field("vmax", "V_max", "µM/s", 10, 1, 50, 0.5),
					field("km", "K_m", "mM", 2, 0.1, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Inhibitor"),
					field("inh", "[I] / K_i", "", 1, 0, 10, 0.1),
					segs("Inhibition", [2]string{"competitive", "Comp."}, [2]string{"noncompetitive", "Non-comp."}, [2]string{"uncompetitive", "Uncomp."}),
				),
				h.Div(h.Class("border-t pt-4"), toggle("bio-lb", "lb", "Lineweaver–Burk plot", false)),
				readouts([2]string{"apparent V_max", "vapp"}, [2]string{"apparent K_m", "kapp"}),
			)
		},
	}
}
