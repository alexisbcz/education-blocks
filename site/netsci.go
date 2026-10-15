package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NetsciBlocks lists the network science gallery in display order. Every
// network is generated in the browser from a seeded random number
// generator; the models live in static/js/netsci-graph.js.
func NetsciBlocks() []Block {
	return []Block{
		nsGiantBlock(),
		nsPreferentialBlock(),
		nsFriendshipBlock(),
		nsRobustnessBlock(),
		nsPercolationBlock(),
		nsCommunitiesBlock(),
		nsEpidemicBlock(),
		nsAssortativityBlock(),
		nsMotifsBlock(),
		nsLayoutBlock(),
	}
}

func nsButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func nsPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func nsNote(text ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, text...)...)
}

func nsLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

// nsPair is a network drawing beside a chart, stacked on phones.
func nsPair(graphLabel, chartLabel string, chartH string) h.Node {
	return h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
		h.Svg(h.Data("graph", ""), h.ViewBox("0 0 360 360"), h.Class("block w-full"), h.Role("img"), h.Aria("label", graphLabel)),
		h.Svg(h.Data("chart", ""), h.ViewBox("0 0 260 "+chartH), h.Class("block w-full"), h.Role("img"), h.Aria("label", chartLabel)),
	)
}

// ---------------------------------------------------------------- 1

func nsGiantBlock() Block {
	return Block{
		Slug:        "giant-component",
		Title:       "The giant component",
		Description: "Erdős and Rényi (1959): link n people at random. Below one friend per person on average the network is dust, small islands and trees. Just past ⟨k⟩ = 1 a giant component appears and swallows most of the network, following S = 1 − e^(−⟨k⟩S).",
		Tags:        []string{"Erdős–Rényi", "phase transition", "union–find"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-giant",
				nsPair("150 people linked at random; the largest component is highlighted",
					"Share of people in the largest component against mean degree: simulation and theory", "300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network"),
					field("k", "Mean degree ⟨k⟩", "", 1.4, 0, 4, 0.05),
				),
				nsLegend([2]string{"var(--brand)", "largest component"}, [2]string{"var(--foreground)", "theory"}, [2]string{"var(--vec-u)", "simulated, n = 4000"}),
				nsButton("reseed", "New network", hugeicons.ShuffleIcon()),
				readouts([2]string{"links drawn", "links"}, [2]string{"largest, of 150", "drawn"}, [2]string{"largest, n = 4000", "sim"}, [2]string{"theory S", "theory"}, [2]string{"components", "comps"}),
				nsNote("The drawing keeps every pair's random number, so raising ⟨k⟩ only adds links. The curve uses G(n, M) with M = ⟨k⟩n/2 links, three networks per point."),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func nsPreferentialBlock() Block {
	return Block{
		Slug:        "preferential-attachment",
		Title:       "Preferential attachment",
		Description: "Barabási and Albert (1999): each newcomer links to m people, choosing the well-connected more often. The rich get richer, and the degrees follow a power law with a tail falling as k⁻³, unlike the thin Poisson tail of a random network with the same number of links.",
		Tags:        []string{"Barabási–Albert", "power law", "log–log"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-ba",
				nsPair("A network growing by preferential attachment; bigger circles have more links",
					"Share of nodes with at least k links, on log–log axes, for preferential attachment and a random network", "300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Growth"),
					field("m", "Links per newcomer m", "", 2, 1, 4, 1),
				),
				nsLegend([2]string{"var(--brand)", "preferential, n = 10 000"}, [2]string{"var(--vec-u)", "random, same ⟨k⟩"}, [2]string{"var(--foreground)", "m(m+1)/k(k+1)"}),
				h.Div(h.Class("grid grid-cols-2 gap-2"), nsPlay("Grow"), nsButton("reset", "Restart", hugeicons.RefreshIcon())),
				readouts([2]string{"nodes drawn", "nodes"}, [2]string{"biggest hub", "hub"}, [2]string{"max k, preferential", "maxba"}, [2]string{"max k, random", "maxer"}, [2]string{"fitted γ (theory 3)", "gamma"}),
				nsNote("γ is the discrete maximum-likelihood exponent for k ≥ 5m (Clauset, Shalizi & Newman 2009). The exact distribution bends at small k, so fits come out a little under 3 at this size."),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func nsFriendshipBlock() Block {
	return Block{
		Slug:        "friendship-paradox",
		Title:       "Your friends have more friends",
		Description: "Feld (1991): on average, your friends have more friends than you do. A random friend is reached through a link, and people with many links are reached more often, so the mean degree of a friend is ⟨k²⟩/⟨k⟩, not ⟨k⟩. The more unequal the degrees, the bigger the gap.",
		Tags:        []string{"friendship paradox", "sampling bias", "configuration model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-friends",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("chart", ""), h.ViewBox("0 0 560 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Degree of a random person against degree of a random friend")),
					h.Div(h.Data("person", ""), h.Class("min-h-[3.5rem] rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"), h.Aria("live", "polite"), "Pick a person to compare them with their friends."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network, n = 5000"),
					segs("Network", [2]string{"er", "Random"}, [2]string{"ba", "Preferential"}, [2]string{"pl", "γ = 2.3"}),
				),
				nsLegend([2]string{"var(--vec-u)", "a random person"}, [2]string{"var(--brand)", "a random friend"}),
				h.Div(h.Class("grid grid-cols-2 gap-2"), nsButton("pick", "Pick a person", hugeicons.UserIcon()), nsButton("reseed", "New network", hugeicons.ShuffleIcon())),
				readouts([2]string{"⟨k⟩", "k"}, [2]string{"⟨k²⟩ / ⟨k⟩", "kk"}, [2]string{"friends’ mean, per person", "ff"}, [2]string{"outnumbered", "share"}),
				nsNote("“Outnumbered” is the share of people whose friends have more friends than they do, on average. The γ = 2.3 network is a configuration model with degrees from 2 to √n·2."),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func nsRobustnessBlock() Block {
	return Block{
		Slug:        "robustness",
		Title:       "Failure and attack",
		Description: "Albert, Jeong and Barabási (2000): a network with hubs shrugs off random failures but falls apart when the hubs are removed first. Remove a fraction f of nodes and watch the largest connected piece. The random network fails the same way whichever nodes go.",
		Tags:        []string{"robustness", "percolation", "hubs"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-robust",
				nsPair("200 nodes with the removed ones faded; the largest remaining piece is highlighted",
					"Largest component against the fraction of nodes removed, for random failure and targeted attack", "300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network, n = 3000, ⟨k⟩ ≈ 4"),
					segs("Network", [2]string{"ba", "Preferential"}, [2]string{"er", "Random"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Removal"),
					segs("Strategy", [2]string{"attack", "Hubs first"}, [2]string{"random", "At random"}),
					field("f", "Removed f", "%", 10, 0, 100, 1),
				),
				nsLegend([2]string{"var(--vec-u)", "random failure"}, [2]string{"var(--brand)", "attack on hubs"}),
				readouts([2]string{"S, random", "rand"}, [2]string{"S, attack", "att"}, [2]string{"collapse, random", "fcr"}, [2]string{"collapse, attack", "fca"}, [2]string{"Molloy–Reed f_c", "mr"}),
				nsNote("S is the largest component as a share of the original network. “Collapse” is where S first drops below 5%. Molloy–Reed: random failure breaks the network at f_c = 1 − 1/(κ − 1), κ = ⟨k²⟩/⟨k⟩. Curves are computed by adding nodes back in reverse order with union–find (Newman & Ziff 2000)."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func nsPercolationBlock() Block {
	return Block{
		Slug:        "percolation",
		Title:       "Percolation on a lattice",
		Description: "Open each site (or each bond) of a square grid with probability p. Below a critical p the open clusters are small; at p_c a cluster first spans the grid. For sites p_c ≈ 0.5927; for bonds it is exactly 1/2 (Kesten 1980).",
		Tags:        []string{"percolation", "critical point", "Newman–Ziff"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-perc",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[400px] overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full [image-rendering:pixelated]"), h.Role("img"),
							h.Aria("label", "Square grid with open sites or bonds; the largest cluster is highlighted"))),
					h.Svg(h.Data("chart", ""), h.ViewBox("0 0 260 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Largest cluster share and spanning against p")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Lattice, 80 × 80"),
					segs("Kind", [2]string{"site", "Sites"}, [2]string{"bond", "Bonds"}),
					field("p", "Open p", "", 0.55, 0, 1, 0.005),
				),
				nsLegend([2]string{"var(--brand)", "largest cluster"}, [2]string{"var(--vec-u)", "other clusters"}),
				h.Div(h.Class("grid grid-cols-2 gap-2"), nsButton("pc", "Go to p_c", hugeicons.ArrowRight01Icon()), nsButton("reseed", "New grid", hugeicons.ShuffleIcon())),
				readouts([2]string{"open sites or bonds", "open"}, [2]string{"largest cluster, of sites", "largest"}, [2]string{"clusters", "clusters"}, [2]string{"spans top to bottom", "spans"}),
				nsNote("Each site or bond keeps one random number, so raising p only opens more. The curve averages 8 grids, each built in one pass by opening in random order (Newman & Ziff 2000)."),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func nsCommunitiesBlock() Block {
	return Block{
		Slug:        "communities",
		Title:       "Finding communities",
		Description: "Four hidden groups of 32, each person with about k_in friends inside their group and k_out outside. The Louvain method (Blondel et al. 2008) climbs modularity Q by moving nodes between communities and merging them. Push k_out up and the groups dissolve into noise.",
		Tags:        []string{"Louvain", "modularity", "planted partition"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-comm",
				nsPair("128 people coloured by community, laid out by force simulation",
					"Modularity and recovery of the planted groups as k_out grows", "300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Planted groups"),
					field("kin", "Inside k_in", "", 10, 1, 20, 0.5),
					field("kout", "Outside k_out", "", 2, 0, 20, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Colour by"),
					segs("Colour by", [2]string{"found", "Found"}, [2]string{"planted", "Planted"}),
				),
				nsLegend([2]string{"var(--brand)", "NMI"}, [2]string{"var(--foreground)", "Q found"}, [2]string{"var(--muted-foreground)", "detectability limit"}),
				nsButton("reseed", "New network", hugeicons.ShuffleIcon()),
				readouts([2]string{"Q found", "qf"}, [2]string{"Q planted", "qp"}, [2]string{"communities", "nc"}, [2]string{"NMI with planted", "nmi"}),
				nsNote("NMI is 1 when the found communities match the planted ones exactly and near 0 when they are unrelated. Modularity has a resolution limit (Fortunato & Barthélemy 2007): in large networks it can merge small real groups, and random networks also reach Q > 0."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func nsEpidemicBlock() Block {
	return Block{
		Slug:        "epidemic-threshold",
		Title:       "Epidemics on networks",
		Description: "An SIR outbreak on a network spreads along each link with probability T. It becomes large only above T_c = ⟨k⟩ / (⟨k²⟩ − ⟨k⟩) (Newman 2002), and hubs push T_c down. Vaccinating at random barely helps; vaccinating a random friend of a random person finds the hubs without knowing who they are (Cohen, Havlin & ben-Avraham 2003).",
		Tags:        []string{"SIR", "bond percolation", "vaccination"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-epi",
				h.Svg(h.Data("chart", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Final outbreak size against transmissibility for two networks")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Disease"),
					field("T", "Transmissibility T", "", 0.2, 0, 1, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Vaccination"),
					segs("Strategy", [2]string{"none", "None"}, [2]string{"random", "Random"}, [2]string{"friend", "A friend"}, [2]string{"hubs", "Hubs"}),
					field("g", "Coverage", "%", 15, 0, 60, 1),
				),
				nsLegend([2]string{"var(--brand)", "preferential"}, [2]string{"var(--vec-u)", "random"}),
				readouts([2]string{"outbreak, preferential", "ba"}, [2]string{"outbreak, random", "er"}, [2]string{"T_c, preferential", "tcba"}, [2]string{"T_c, random", "tcer"}, [2]string{"hubs reached", "hub"}),
				nsNote("Both networks have n = 3000 and ⟨k⟩ ≈ 6. The final size of a large outbreak equals the giant cluster when each link is kept with probability T, so each curve is one pass of union–find over links among unvaccinated people, averaged over 4 orders. T_c is computed for the unvaccinated network. “Hubs reached” is the share of the top 1% by degree that the strategy vaccinates."),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func nsAssortativityBlock() Block {
	return Block{
		Slug:        "assortativity",
		Title:       "Who links to whom",
		Description: "Newman (2002): in social networks the well-connected befriend each other (assortative, r > 0); in the internet and food webs hubs link to small nodes (disassortative, r < 0). Swapping link ends keeps everyone's degree but can move r either way.",
		Tags:        []string{"assortativity", "rewiring", "degree correlation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-assort",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("knn", ""), h.ViewBox("0 0 280 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Mean degree of a node's neighbours against its own degree, log–log")),
					h.Svg(h.Data("trace", ""), h.ViewBox("0 0 280 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Assortativity r against number of swaps")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Swap toward"),
					segs("Target", [2]string{"assort", "Assortative"}, [2]string{"disassort", "Disassortative"}, [2]string{"random", "Random"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), nsPlay("Swap"), nsButton("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"r", "r"}, [2]string{"swaps", "swaps"}, [2]string{"degrees kept", "kept"}, [2]string{"links", "links"}),
				nsNote("A preferential-attachment network with n = 2000 and m = 2. Each swap picks two links a–b and c–d and rejoins their four ends: the two highest degrees together (assortative) or highest with lowest (disassortative). Swaps that would duplicate a link are skipped."),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func nsMotifsBlock() Block {
	return Block{
		Slug:        "triangles-null-model",
		Title:       "Triangles against a null model",
		Description: "Is a count of triangles high? Only compared with something. Shuffle the links many times while keeping every degree, count again, and turn the difference into a z-score (Milo et al. 2002). Towns linked by distance are full of triangles; a random network of the same degrees is not.",
		Tags:        []string{"clustering", "motifs", "null model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-motif",
				nsPair("300 nodes; brighter nodes have more triangles among their neighbours",
					"z-scores of motif counts against degree-preserving shuffles", "300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network, n = 300"),
					segs("Network", [2]string{"geo", "Towns"}, [2]string{"hk", "Clustered hubs"}, [2]string{"er", "Random"}),
				),
				nsButton("reseed", "New network", hugeicons.ShuffleIcon()),
				readouts([2]string{"triangles", "tri"}, [2]string{"transitivity", "trans"}, [2]string{"mean local C", "local"}, [2]string{"null transitivity", "null"}, [2]string{"z, triangles", "z"}),
				nsNote("Towns: nodes in a square linked when closer than 0.1. Clustered hubs: Holme–Kim growth with triad formation p = 0.8. Each null is 20 shuffles of 10 swaps per link. Shuffles keep every degree, hence every connected triple, so the triple count itself never changes. Transitivity is 3 × triangles / connected triples; local C averages each node's share of linked neighbour pairs."),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func nsLayoutBlock() Block {
	return Block{
		Slug:        "force-layout",
		Title:       "Force-directed layout",
		Description: "Fruchterman and Reingold (1991): every pair of nodes repels like charges, every link pulls like a spring, and a cooling temperature caps how far a node may move. The drawing settles where the forces balance. Drag a node to pin it while the rest follows.",
		Tags:        []string{"graph drawing", "simulation", "Fruchterman–Reingold"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ns-layout",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("graph", ""), h.ViewBox("0 0 520 400"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Graph drawn by force simulation; drag nodes to move them")),
					h.Svg(h.Data("energy", ""), h.ViewBox("0 0 520 70"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Energy per iteration")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Graph"),
					segs("Graph", [2]string{"grid", "Grid"}, [2]string{"tree", "Tree"}, [2]string{"cliques", "Ring of cliques"}, [2]string{"cube", "Hypercube"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Forces"),
					field("scale", "Ideal length ×", "", 0.6, 0.2, 1.5, 0.05),
					field("gravity", "Gravity", "", 2, 0, 8, 0.1),
					field("cooling", "Cooling", "", 0.97, 0.8, 0.999, 0.001),
				),
				h.Div(h.Class("grid grid-cols-3 gap-2"), nsPlay("Run"), nsButton("reheat", "Reheat", hugeicons.RefreshIcon()), nsButton("scramble", "Scramble", hugeicons.ShuffleIcon())),
				readouts([2]string{"iteration", "iter"}, [2]string{"temperature", "temp"}, [2]string{"energy", "energy"}, [2]string{"crossings", "cross"}),
				nsNote("Energy is the sum of spring energy d³/3k and repulsion k² ln d; a good layout sits near a minimum. The 4-dimensional hypercube cannot be drawn without crossings in the plane."),
			)
		},
	}
}
