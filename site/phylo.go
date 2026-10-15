package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PhyloBlocks lists the evolution and phylogenetics gallery in display
// order. Every sequence, tree and trait is simulated in the page from a
// seeded generator; nothing is fetched.
func PhyloBlocks() []Block {
	return []Block{
		phyloDistBlock(),
		phyloFitchBlock(),
		phyloLBABlock(),
		phyloJCBlock(),
		phyloClockBlock(),
		phyloCoalBlock(),
		phyloFixBlock(),
		phyloReadBlock(),
		phyloBootBlock(),
		phyloPICBlock(),
	}
}

// phyloNote is a short explanatory paragraph under a block's controls.
func phyloNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// phyloButton is a small outline action button.
func phyloButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// phyloRun is a play/pause button whose label the module swaps.
func phyloRun(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func phyloSvg(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", label))
}

// ---------------------------------------------------------------- P1

func phyloDistBlock() Block {
	names := []string{"A", "B", "C", "D", "E"}
	return Block{
		Slug:        "distance-trees",
		Title:       "UPGMA and neighbour joining",
		Description: "Two ways to turn a table of pairwise distances into a tree. UPGMA joins the closest pair and assumes every lineage evolved at the same rate, so all tips end level. Neighbour joining corrects each distance by how far both taxa sit from everyone else. Edit the matrix, or load data where one lineage evolves fast, and step through both.",
		Tags:        []string{"UPGMA", "neighbour joining", "molecular clock"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-dist",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid gap-3 md:grid-cols-3"),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("True tree"), phyloSvg("truth", "0 0 220 170", "The tree the distances came from")),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("UPGMA"), phyloSvg("upgma", "0 0 220 170", "UPGMA tree")),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Neighbour joining"), phyloSvg("nj", "0 0 220 170", "Neighbour-joining tree")),
					),
					h.Div(h.Class("overflow-x-auto"),
						h.Table(h.Class("mx-auto border-separate border-spacing-1 font-mono text-xs"), h.Aria("label", "Distance matrix"),
							h.Thead(h.Tr(h.Th(), h.Map(names, func(n string) h.Node { return h.Th(h.Class("px-1 font-medium text-muted-foreground"), n) }))),
							h.Tbody(h.MapIdx(names, func(i int, n string) h.Node {
								return h.Tr(h.Th(h.Class("pr-1 font-medium text-muted-foreground"), n),
									h.MapIdx(names, func(j int, m string) h.Node {
										if j <= i {
											return h.Td(h.Data("mirror", fmt.Sprintf("%d-%d", j, i)), h.Class("h-7 w-12 text-center text-muted-foreground/60 tabular-nums"), "")
										}
										return h.Td(h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("cell", fmt.Sprintf("%d-%d", i, j)),
											h.Aria("label", "Distance "+n+" to "+m), h.Attr("autocomplete", "off"),
											h.Class("h-7 w-12 rounded-md border border-input bg-background px-1 text-center font-mono text-xs tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-[var(--code-del)]")))
									}),
								)
							})),
						),
					),
					h.Ol(h.Data("log", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-0.5 px-1 font-mono text-[11px] text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Data"),
					segs("Distance data", [2]string{"rates", "Unequal rates"}, [2]string{"clock", "Clock-like"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Steps"),
					h.Div(h.Class("grid grid-cols-3 gap-2"),
						phyloButton("step", hugeicons.StepIntoIcon(), "Step"),
						phyloButton("all", hugeicons.NextIcon(), "All"),
						phyloButton("reset", hugeicons.RefreshIcon(), "Reset"),
					),
				),
				readouts([2]string{"ultrametric", "ultra"}, [2]string{"additive (4-point)", "additive"}, [2]string{"UPGMA topology", "upgmaok"}, [2]string{"NJ topology", "njok"}, [2]string{"NJ max misfit", "fit"}),
				phyloNote("Topologies are compared as unrooted splits. Both trees are drawn rooted on A for reading only; UPGMA's root is its own, at half the last join."),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func phyloFitchBlock() Block {
	return Block{
		Slug:        "parsimony",
		Title:       "Maximum parsimony, all 15 trees",
		Description: "Five taxa can be joined into exactly 15 unrooted trees. Fitch's algorithm counts the fewest base changes each tree needs to explain the alignment, site by site; the most parsimonious tree needs the fewest. Click a base to change it and watch the scores move.",
		Tags:        []string{"Fitch algorithm", "parsimony", "tree space"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-fitch",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("align", ""), h.Class("overflow-x-auto"), h.Role("group"), h.Aria("label", "Alignment: click a base to change it")),
					h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"),
						h.Div(h.Data("thumbs", ""), h.Class("grid grid-cols-3 gap-1.5 sm:grid-cols-5"), h.Role("listbox"), h.Aria("label", "The 15 unrooted trees")),
						h.Div(h.Class("flex flex-col gap-1"),
							h.P(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), h.Data("out", "title"), "—"),
							phyloSvg("big", "0 0 360 220", "Selected tree with the Fitch state sets for the selected site"),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Alignment"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("example", hugeicons.RefreshIcon(), "Example"),
						phyloButton("random", hugeicons.DiceIcon(), "Random"),
					),
				),
				readouts([2]string{"best score", "best"}, [2]string{"best trees", "nbest"}, [2]string{"selected tree", "sel"}, [2]string{"selected site", "site"}, [2]string{"informative sites", "inf"}),
				phyloNote("Sets at the internal nodes are Fitch's first pass: an intersection of the children's sets when it is not empty, otherwise their union, which costs one change. Only parsimony-informative sites, with two bases each seen twice or more, can tell trees apart."),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func phyloLBABlock() Block {
	return Block{
		Slug:        "long-branch",
		Title:       "Long-branch attraction",
		Description: "Simulate DNA on a four-taxon tree where A and C sit on long branches but are not each other's closest relatives (the Felsenstein zone). As those branches grow, parallel changes pile up, and parsimony starts to group A with C, more confidently with more data. A distance method that corrects for multiple hits with Jukes–Cantor does far better, and is statistically consistent: give it more sites and it finds the true tree.",
		Tags:        []string{"long-branch attraction", "consistency", "Felsenstein zone"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-lba",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]"),
						phyloSvg("quartet", "0 0 240 200", "The true four-taxon tree with long branches to A and C"),
						phyloSvg("plot", "0 0 520 260", "Share of replicates recovering the true tree against long-branch length"),
					),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-del)", "parsimony"),
						legendSwatch("var(--vec-v)", "JC distances, four-point"),
						legendSwatch("var(--brand)", "current length"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Tree"),
					field("long", "Long branches", "subs/site", 0.8, 0.1, 2, 0.05),
					field("short", "Short branches", "subs/site", 0.05, 0.01, 0.3, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Simulation"),
					field("sites", "Sites", "", 1000, 100, 10000, 100),
					field("reps", "Replicates", "per point", 40, 10, 200, 10),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("once", hugeicons.DiceIcon(), "One alignment"),
						phyloButton("sweep", hugeicons.PlayIcon(), "Sweep lengths"),
					),
				),
				readouts([2]string{"AB|CD sites", "xxyy"}, [2]string{"AC|BD sites", "xyxy"}, [2]string{"AD|BC sites", "xyyx"}, [2]string{"parsimony picks", "pars"}, [2]string{"JC distances pick", "dist"}),
				phyloNote("The true tree is AB|CD. Parsimony picks the split backed by most informative sites; the distance method picks the pairing with the smallest sum of corrected distances (the four-point rule, which is what neighbour joining does with four taxa)."),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func phyloJCBlock() Block {
	return Block{
		Slug:        "jukes-cantor",
		Title:       "Multiple hits and the Jukes–Cantor correction",
		Description: "Let two sequences drift apart one substitution at a time. Early on, every change is a visible difference. Later, sites change twice or change back, so the share of differing sites p falls behind the true number of substitutions d and stalls at 3/4. Jukes and Cantor's model undoes that: d = −¾ ln(1 − 4p/3).",
		Tags:        []string{"JC69", "saturation", "substitution model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-jc",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Data("seqs", ""), h.Class("overflow-hidden px-1 font-mono text-[11px] leading-5 tracking-[0.12em]"), h.Aria("label", "The first 64 sites of both sequences")),
					phyloSvg("plot", "0 0 600 280", "Observed difference p and the Jukes–Cantor estimate against the true distance"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "p, observed differences"),
						legendSwatch("var(--vec-v)", "JC estimate"),
						legendSwatch("var(--foreground)", "truth (y = d)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Simulation"),
					field("sites", "Sites", "", 500, 50, 5000, 50),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloRun("Run"),
						phyloButton("reset", hugeicons.RefreshIcon(), "Reset"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Calculator"),
					field("p", "Observed p", "", 0.3, 0, 0.74, 0.01),
					h.P(h.Class("px-1 font-mono text-xs tabular-nums"), h.Data("out", "calc"), "—"),
				),
				readouts([2]string{"true d", "d"}, [2]string{"observed p", "p"}, [2]string{"JC estimate", "jc"}, [2]string{"substitutions", "hits"}, [2]string{"hidden by multiple hits", "hidden"}),
				phyloNote("Each site changes at rate 1 per unit of d, always to one of the three other bases with equal chance: exactly the Jukes–Cantor model. Past p ≈ 0.75 the logarithm has no answer and the distance is saturated."),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func phyloClockBlock() Block {
	return Block{
		Slug:        "molecular-clock",
		Title:       "Dating an outbreak with a molecular clock",
		Description: "A synthetic virus spreads from one infection and is sequenced on different dates. Plot each sample's genetic distance from the root against its sampling date: the slope is the substitution rate, and where the line meets zero distance is the date of the common ancestor. Loosen the clock and see the estimate wobble.",
		Tags:        []string{"root-to-tip regression", "tMRCA", "serial sampling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-clock",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 md:grid-cols-2"),
						phyloSvg("tree", "0 0 300 280", "Time-scaled tree of the sampled genomes"),
						phyloSvg("plot", "0 0 300 280", "Root-to-tip distance against sampling date with the fitted line"),
					),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-v)", "least-squares fit"),
						legendSwatch("var(--brand)", "true root date"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Outbreak"),
					field("n", "Samples", "", 30, 8, 80, 1),
					field("rate", "True rate", "×10⁻³/yr", 1, 0.2, 5, 0.1),
					field("sites", "Genome", "sites", 30000, 5000, 100000, 5000),
					field("relax", "Rate noise", "SD", 0, 0, 0.8, 0.05),
					phyloButton("new", hugeicons.DiceIcon(), "New outbreak"),
				),
				readouts([2]string{"estimated rate", "rate"}, [2]string{"true rate", "true"}, [2]string{"estimated root", "root"}, [2]string{"true root", "troot"}, [2]string{"R²", "r2"}),
				phyloNote("Substitutions on each branch are Poisson with mean rate × time × sites; rate noise multiplies each branch's rate by a log-normal factor (a relaxed clock). Real studies root the tree to maximise the clock signal and then use Bayesian dating; the regression is the exploratory first look."),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

func phyloCoalBlock() Block {
	return Block{
		Slug:        "coalescent",
		Title:       "The coalescent: genealogies backwards in time",
		Description: "Pick n gene copies from a population of N and trace them back. With k lineages left, two of them meet at rate C(k, 2)/N per generation, so early mergers come fast and the last two lineages take about N generations on their own. The expected time to the common ancestor is 2N(1 − 1/n), whatever n. In a growing population, mergers bunch near the root and the tree looks like a star.",
		Tags:        []string{"Kingman coalescent", "TMRCA", "population growth"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-coal",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"),
						phyloSvg("tree", "0 0 340 280", "Simulated genealogy with time running back up the page"),
						phyloSvg("hist", "0 0 300 280", "Histogram of times to the common ancestor over many runs"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Population"),
					segs("Population history", [2]string{"constant", "Constant"}, [2]string{"growth", "Growing"}),
					field("n", "Samples n", "", 12, 2, 40, 1),
					field("N", "Size N", "today", 1000, 50, 10000, 50),
					field("r", "Growth rate", "/gen", 0.005, 0.0005, 0.05, 0.0005),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("new", hugeicons.DiceIcon(), "New tree"),
						phyloButton("many", hugeicons.RepeatIcon(), "Run 2,000"),
					),
				),
				readouts([2]string{"this TMRCA", "t"}, [2]string{"last two lineages", "t2"}, [2]string{"mean of runs", "mean"}, [2]string{"theory, constant N", "theory"}, [2]string{"runs", "runs"}),
				phyloNote("Time is in generations of a haploid Wright–Fisher population of N copies (for diploids, put 2N in place of N). Growth means the size was N·e^(−rt) t generations ago."),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func phyloFixBlock() Block {
	return Block{
		Slug:        "fixation",
		Title:       "Will a new mutation take over?",
		Description: "One new copy of an allele among 2N in a Wright–Fisher population, with selection s per copy. Most new mutations are lost in a few generations, even helpful ones: drift rules while they are rare. Kimura's diffusion result gives the chance of fixation, (1 − e^(−2s)) / (1 − e^(−4Ns)); the simulation checks it.",
		Tags:        []string{"Wright–Fisher", "Kimura", "fixation probability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-fix",
				h.Div(h.Class("flex flex-col gap-2"),
					phyloSvg("traj", "0 0 600 200", "Allele frequency trajectories, fixed ones highlighted"),
					phyloSvg("curve", "0 0 600 200", "Fixation probability against selection coefficient"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "fixed"),
						legendSwatch("var(--vec-v)", "Kimura"),
						legendSwatch("var(--muted-foreground)", "neutral 1/2N"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Population"),
					field("N", "Diploid size N", "", 100, 10, 1000, 10),
					field("s", "Selection s", "", 0.02, -0.02, 0.1, 0.002),
					field("reps", "Mutations", "", 2000, 100, 20000, 100),
					phyloButton("run", hugeicons.PlayIcon(), "Simulate"),
				),
				readouts([2]string{"fixed / run", "fixed"}, [2]string{"simulated", "sim"}, [2]string{"95% interval", "ci"}, [2]string{"Kimura", "kimura"}, [2]string{"neutral 1/2N", "neutral"}, [2]string{"mean time to fix", "tfix"}),
				phyloNote("Each generation the expected frequency is p(1 + s)/(1 + ps), then 2N copies are drawn binomially. The interval is a 95% Wilson interval for the simulated share. For 4Ns ≫ 1 the chance tends to about 2s: a mutation 2% better is still lost about 96% of the time."),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func phyloReadBlock() Block {
	return Block{
		Slug:        "reading-trees",
		Title:       "Reading a tree: rotations and groups",
		Description: "Click any branch point to rotate it: the tips swap sides, yet every relationship stays the same, because a tree is about who shares the most recent ancestor, not about left and right. Then pick tips and the checker names the group: monophyletic (a whole clade), paraphyletic (a clade with some lineages taken out, like the traditional 'reptiles' or 'fish') or polyphyletic (gathered from separate branches).",
		Tags:        []string{"clades", "tree thinking", "paraphyly"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-read",
				h.Div(h.Class("flex flex-col gap-2"),
					phyloSvg("tree", "0 0 560 300", "Vertebrate tree: click a node to rotate it, click a name to select it"),
					h.P(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "Nodes and names are buttons: Tab to them, Enter to rotate or select."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Groups to try"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("g-amniotes", hugeicons.ArrowRight01Icon(), "Amniotes"),
						phyloButton("g-reptiles", hugeicons.ArrowRight01Icon(), "'Reptiles'"),
						phyloButton("g-fish", hugeicons.ArrowRight01Icon(), "'Fish'"),
						phyloButton("g-warm", hugeicons.ArrowRight01Icon(), "Warm blood"),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("shuffle", hugeicons.ShuffleIcon(), "Shuffle"),
						phyloButton("clear", hugeicons.RefreshIcon(), "Clear"),
					),
				),
				h.Div(h.Class("flex flex-col gap-1.5 border-t pt-4"),
					h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("text-sm font-medium"), "Select some tips."),
					h.P(h.Data("out", "why"), h.Class("text-xs leading-relaxed text-muted-foreground"), ""),
				),
				readouts([2]string{"selected", "n"}, [2]string{"common ancestor", "mrca"}, [2]string{"left out", "left"}),
				phyloNote("The checker treats membership as a character and asks which costs fewer changes inside the common ancestor's clade: the ancestor being a member with later losses (paraphyly) or independent gains (polyphyly). A tie is called polyphyletic."),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

func phyloBootBlock() Block {
	return Block{
		Slug:        "bootstrap",
		Title:       "Bootstrap support",
		Description: "How sure is a tree? Felsenstein's bootstrap resamples the alignment's columns with replacement, rebuilds the tree each time, and counts how often each branch comes back. Short alignments give shaky support; branches that are wrong usually get low numbers, though high support is not proof.",
		Tags:        []string{"bootstrap", "neighbour joining", "uncertainty"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-boot",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 md:grid-cols-2"),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("True tree"), phyloSvg("truth", "0 0 300 220", "The tree the alignment was simulated on")),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Estimate with support"), phyloSvg("est", "0 0 300 220", "Neighbour-joining tree with bootstrap percentages")),
					),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "branch in the true tree"),
						legendSwatch("var(--code-del)", "branch not in the true tree"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Alignment"),
					field("sites", "Sites", "", 300, 30, 3000, 10),
					field("reps", "Bootstrap reps", "", 200, 20, 1000, 20),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("new", hugeicons.DiceIcon(), "New alignment"),
						phyloButton("boot", hugeicons.RepeatIcon(), "Bootstrap"),
					),
				),
				readouts([2]string{"topology", "topo"}, [2]string{"true branches", "good"}, [2]string{"wrong branches", "bad"}, [2]string{"reps done", "done"}),
				phyloNote("Sequences evolve under Jukes–Cantor on the true tree; each tree is neighbour joining on JC-corrected distances, rooted on the outgroup for display."),
			)
		},
	}
}

// ---------------------------------------------------------------- P10

func phyloPICBlock() Block {
	return Block{
		Slug:        "independent-contrasts",
		Title:       "Species are not independent data",
		Description: "Two traits that evolve independently, by Brownian motion, on a tree with two old clades. Each clade drifts as a unit, so across species the traits often look correlated, and an ordinary test is fooled far more than 5% of the time. Felsenstein's independent contrasts compare sister lineages instead, and the false alarms drop back to the nominal rate.",
		Tags:        []string{"comparative method", "independent contrasts", "pseudoreplication"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phylo-pic",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 md:grid-cols-3"),
						phyloSvg("tree", "0 0 200 240", "The tree: two clades split long ago"),
						phyloSvg("raw", "0 0 240 240", "Trait Y against trait X across species"),
						phyloSvg("pic", "0 0 240 240", "Independent contrasts of Y against contrasts of X"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Tree"),
					field("n", "Species", "per clade", 10, 4, 30, 1),
					field("stem", "Clade age", "share", 0.8, 0.1, 0.95, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						phyloButton("new", hugeicons.DiceIcon(), "New traits"),
						phyloButton("many", hugeicons.RepeatIcon(), "Run 1,000"),
					),
				),
				readouts([2]string{"species r", "raw"}, [2]string{"species p", "rawp"}, [2]string{"contrasts r", "picr"}, [2]string{"contrasts p", "picp"}, [2]string{"p < 0.05, species", "fpraw"}, [2]string{"p < 0.05, contrasts", "fppic"}),
				phyloNote("Clade age is how much of the tree's depth lies before the two clades start branching. Contrasts are standardised by branch length and correlated through the origin, with n − 2 degrees of freedom for n species."),
			)
		},
	}
}
