package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// SociologyBlocks lists the sociology gallery in display order.
func SociologyBlocks() []Block {
	return []Block{
		schellingBlock(),
		smallWorldBlock(),
		centralityBlock(),
		giniBlock(),
		diffusionBlock(),
		dilemmaBlock(),
		samplingBlock(),
		mobilityBlock(),
		thinkersBlock(),
	}
}

func socButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- S1

func schellingBlock() Block {
	return Block{
		Slug:        "schelling",
		Title:       "Schelling's segregation model",
		Description: "Thomas Schelling's 1971 model: two groups on a grid, and each household moves if too few of its neighbours are like it. Even a mild preference, say a third of neighbours, adds up to strongly segregated neighbourhoods that nobody chose.",
		Tags:        []string{"agent-based", "emergence", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("schelling",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full [image-rendering:pixelated]"), h.Role("img"),
							h.Aria("label", "Grid of households from two groups; empty cells are blank")),
					),
					h.Svg(h.Data("trend", ""), h.ViewBox("0 0 460 70"), h.Class("mx-auto block w-full max-w-[460px]"), h.Role("img"), h.Aria("label", "Share of like neighbours over rounds")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Preferences"),
					field("want", "Wants like", "%", 30, 0, 100, 1),
					field("empty", "Empty cells", "%", 10, 2, 50, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "group A"), legendSwatch("var(--brand)", "group B")),
				h.Div(h.Class("grid grid-cols-3 gap-2"), playPause(),
					socButton("step", "Step", hugeicons.ArrowRight01Icon()),
					socButton("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"round", "round"}, [2]string{"unhappy", "unhappy"}, [2]string{"like neighbours", "similar"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Each round, every unhappy household moves to a random empty cell. Neighbours are the 8 surrounding cells; the grid wraps around."),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func smallWorldBlock() Block {
	return Block{
		Slug:        "small-world",
		Title:       "Small worlds",
		Description: "Watts and Strogatz (1998): start from a ring where everyone knows only their neighbours, then rewire a few ties at random. A handful of shortcuts collapses the distance between people while friends of friends stay friends: high clustering, short paths.",
		Tags:        []string{"networks", "Watts–Strogatz", "BFS"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("smallworld",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("graph", ""), h.ViewBox("0 0 360 360"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Ring network; click a person to see distances")),
					h.Svg(h.Data("curves", ""), h.ViewBox("0 0 260 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Path length and clustering against rewiring probability")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network"),
					field("logp", "log₁₀ p", "", -1.3, -4, 0, 0.1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "L(p) / L(0)"), legendSwatch("var(--brand)", "C(p) / C(0)")),
				socButton("reseed", "Rewire again", hugeicons.ShuffleIcon()),
				readouts([2]string{"p", "p"}, [2]string{"avg path L", "L"}, [2]string{"clustering C", "C"}, [2]string{"selected", "sel"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "40 people, each first tied to their 4 nearest neighbours. Curves average 8 random networks per p."),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

// A synthetic friendship network: two friend groups joined by a broker.
var socNames = []string{"Ada", "Ben", "Cleo", "Dan", "Eve", "Finn", "Gus", "Hana", "Ivo", "Jade",
	"Kai", "Lea", "Max", "Nia", "Omar", "Pia", "Quinn", "Rae", "Sam", "Tess"}

var socEdges = [][2]int{
	{0, 1}, {0, 2}, {0, 3}, {1, 2}, {1, 3}, {2, 3}, {2, 4}, {3, 4}, {4, 5}, {1, 5}, {5, 6}, {0, 6},
	{6, 7}, // Gus to Hana: the bridge
	{7, 8}, {7, 9}, {8, 9}, {8, 10}, {9, 10}, {9, 11}, {10, 11}, {10, 12}, {11, 12}, {12, 13}, {11, 13},
	{7, 14}, {14, 15}, {15, 16}, {14, 16}, {16, 17}, {15, 17}, {17, 18}, {18, 19}, {16, 19}, {3, 18},
}

func centralityBlock() Block {
	edges := ""
	for i, e := range socEdges {
		if i > 0 {
			edges += " "
		}
		edges += fmt.Sprintf("%d-%d", e[0], e[1])
	}
	return Block{
		Slug:        "centrality",
		Title:       "Who matters in a network",
		Description: "Three answers to “who is central?”: degree counts friends, closeness measures how quickly someone reaches everyone, betweenness counts the shortest paths that run through them. Brokers between groups often have few friends but high betweenness.",
		Tags:        []string{"centrality", "Brandes", "synthetic data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("centrality",
				h.Svg(h.Data("graph", ""), h.Data("names", joinNames()), h.Data("edges", edges), h.ViewBox("0 0 520 380"),
					h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Friendship network; node size shows the selected centrality")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Measure"),
					segs("Centrality", [2]string{"degree", "Degree"}, [2]string{"betweenness", "Betweenness"}, [2]string{"closeness", "Closeness"}),
				),
				h.Ol(h.Data("ranking", ""), h.Class("flex flex-col gap-1 border-t pt-4 font-mono text-xs")),
				h.P(h.Data("out", "sel"), h.Class("min-h-10 text-xs leading-relaxed text-muted-foreground"), "Click a person to see all three scores."),
				h.P(h.Class("text-xs text-muted-foreground"), "A made-up network of 20 people, normalised scores (0 to 1)."),
			)
		},
	}
}

func joinNames() string {
	s := ""
	for i, n := range socNames {
		if i > 0 {
			s += ","
		}
		s += n
	}
	return s
}

// ---------------------------------------------------------------- S4

func giniBlock() Block {
	return Block{
		Slug:        "inequality",
		Title:       "Lorenz curve and Gini coefficient",
		Description: "How unequal is a distribution? Line people up from poorest to richest and plot the share of income held by the bottom x%: the Lorenz curve. The Gini coefficient is twice the area between it and the line of equality, from 0 (everyone equal) to 1 (one person has everything).",
		Tags:        []string{"inequality", "Gini", "synthetic population"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gini",
				h.Svg(h.Data("lorenz", ""), h.ViewBox("0 0 400 360"), h.Class("mx-auto block w-full max-w-[460px]"), h.Role("img"), h.Aria("label", "Lorenz curve")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Population"),
					field("sigma", "Spread σ", "", 0.7, 0, 2.5, 0.05),
					field("n", "People", "", 1000, 4, 5000, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "equal"), "Perfect equality"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "one"), "One has everything"),
				),
				h.Div(h.Data("quintiles", ""), h.Class("flex flex-col gap-1 border-t pt-4")),
				readouts([2]string{"Gini (sample)", "gini"}, [2]string{"Gini (theory)", "theory"}, [2]string{"top 10% share", "top"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Incomes are drawn from a log-normal distribution, a common stylised model; theory: G = 2Φ(σ/√2) − 1."),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func diffusionBlock() Block {
	return Block{
		Slug:        "diffusion",
		Title:       "Diffusion of innovations",
		Description: "The Bass model (1969): some people adopt a new idea on their own (innovation, p), most because others already have (imitation, q). Together they give the familiar S-curve, with Rogers' adopter categories marked along it.",
		Tags:        []string{"Bass model", "S-curve", "Rogers"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bass",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Adoption over time")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					field("p", "Innovation p", "", 0.03, 0.001, 0.2, 0.001),
					field("q", "Imitation q", "", 0.38, 0, 1, 0.01),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "cumulative adopters"), legendSwatch("var(--brand)", "new adopters per year")),
				readouts([2]string{"peak year", "peak"}, [2]string{"adopted at peak", "atpeak"}, [2]string{"half adopted", "half"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"p ≈ 0.03 and q ≈ 0.38 are average estimates across many products (Sultan, Farley & Lehmann, 1990). Rogers' categories split adopters in order of adoption: the first 2.5%, the next 13.5%, then 34%, 34% and the last 16%."),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

var strategies = [][2]string{
	{"allc", "Always cooperate"}, {"alld", "Always defect"}, {"tft", "Tit for Tat"},
	{"grim", "Grim trigger"}, {"pavlov", "Win-stay, lose-shift"}, {"random", "Random"},
}

func dilemmaBlock() Block {
	return Block{
		Slug:        "prisoners-dilemma",
		Title:       "Iterated prisoner's dilemma",
		Description: "How cooperation survives among self-interested players. A round-robin tournament like Robert Axelrod's (1980), which Tit for Tat won: nice, retaliatory, forgiving, clear. Add noise and watch unforgiving strategies collapse.",
		Tags:        []string{"game theory", "tournament", "cooperation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ipd",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid grid-cols-[auto_auto_auto] gap-x-4 gap-y-1 self-start rounded-lg border bg-background p-3 font-mono text-[11px]"),
						h.Span(), h.Span(h.Class("text-center text-muted-foreground"), "they C"), h.Span(h.Class("text-center text-muted-foreground"), "they D"),
						h.Span(h.Class("text-muted-foreground"), "you C"), h.Span(h.Class("text-center"), "3, 3"), h.Span(h.Class("text-center"), "0, 5"),
						h.Span(h.Class("text-muted-foreground"), "you D"), h.Span(h.Class("text-center"), "5, 0"), h.Span(h.Class("text-center"), "1, 1"),
					),
					h.Div(h.Data("results", ""), h.Class("flex flex-col gap-1.5")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Players"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map(strategies, func(s [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("strategy", s[0]), h.Aria("pressed", "true"),
								h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand/50 aria-pressed:bg-brand/10 aria-pressed:text-brand"),
								s[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Tournament"),
					field("rounds", "Rounds", "", 200, 10, 1000, 10),
					field("noise", "Noise", "%", 0, 0, 20, 1),
				),
				socButton("replay", "Play again", hugeicons.ShuffleIcon()),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Everyone plays everyone, themselves included. Noise flips a move by mistake. Scores are average points per round. The winner depends on the field: Axelrod's first tournament had 14 entries plus Random, so a small field like this one can crown Grim."),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func samplingBlock() Block {
	return Block{
		Slug:        "sampling",
		Title:       "Survey sampling and bias",
		Description: "A synthetic town of 10,000 people where support for a policy differs by neighbourhood. Draw samples again and again: random and stratified samples scatter around the truth, while convenience and voluntary samples miss it however large they get.",
		Tags:        []string{"sampling", "margin of error", "bias"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sampling",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("hoods", ""), h.Class("grid grid-cols-2 gap-2 sm:grid-cols-4")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Estimates with 95% intervals against the true value")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Sampling method", [2]string{"random", "Random"}, [2]string{"stratified", "Stratified"}, [2]string{"convenience", "Convenience"}, [2]string{"voluntary", "Voluntary"}),
					field("size", "Sample size", "", 400, 20, 3000, 10),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					socButton("draw", "Draw 1", hugeicons.ArrowRight01Icon()),
					socButton("draw20", "Draw 20", hugeicons.FlashIcon())),
				socButton("clear", "Clear", hugeicons.RefreshIcon()),
				readouts([2]string{"truth", "truth"}, [2]string{"last estimate", "est"}, [2]string{"± margin", "moe"}, [2]string{"intervals hit", "cover"}),
				h.P(h.Data("out", "note"), h.Class("min-h-12 text-xs leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func mobilityBlock() Block {
	classes := []string{"Working", "Middle", "Upper"}
	init := [][]float64{{0.6, 0.3, 0.1}, {0.25, 0.5, 0.25}, {0.1, 0.35, 0.55}}
	return Block{
		Slug:        "mobility",
		Title:       "Social mobility as a Markov chain",
		Description: "Each row says where children of one class end up. Applied generation after generation, any such matrix drifts to the same long-run mix, whatever the starting point: the stationary distribution. The numbers are illustrative, not data.",
		Tags:        []string{"Markov chain", "transition matrix", "illustrative"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mobility",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Class distribution by generation")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parents → children"),
					h.Div(h.Class("grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-1 text-[11px]"),
						h.Span(),
						h.Map(classes, func(c string) h.Node { return h.Span(h.Class("text-center text-muted-foreground"), c) }),
						h.MapIdx(classes, func(i int, c string) h.Node {
							return h.Group(
								h.Span(h.Class("pr-1 text-muted-foreground"), c),
								h.MapIdx(classes, func(j int, _ string) h.Node {
									return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", fmt.Sprintf("m%d%d", i, j)), h.Value(fmt.Sprint(init[i][j])),
										h.Data("min", "0"), h.Data("max", "1"), h.Data("step", "0.01"), h.Attr("autocomplete", "off"),
										h.Aria("label", fmt.Sprintf("%s to %s", c, classes[j])),
										h.Class("h-8 w-full min-w-0 cursor-ew-resize rounded-md border border-input bg-background px-1 text-center font-mono text-xs tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring"))
								}),
							)
						}),
					),
					h.P(h.Class("text-[11px] text-muted-foreground"), "Rows always sum to 1: editing one entry rescales the others."),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Start"),
					segs("Starting population", [2]string{"working", "All working"}, [2]string{"upper", "All upper"}, [2]string{"mixed", "Mixed"}),
				),
				readouts([2]string{"long run", "stationary"}, [2]string{"stay in class", "stay"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

type thinker struct {
	name, life, work, concept string
}

var thinkers = []thinker{
	{"Karl Marx", "1818–1883", "Capital, vol. 1 (1867)", "Class conflict: who owns the means of production shapes the rest of society."},
	{"Émile Durkheim", "1858–1917", "Suicide (1897)", "Social facts: even suicide rates follow social integration and regulation; anomie is normlessness."},
	{"Max Weber", "1864–1920", "The Protestant Ethic and the Spirit of Capitalism (1904–05)", "Ideal types and rationalisation; ideas, not only interests, drive history."},
	{"W. E. B. Du Bois", "1868–1963", "The Souls of Black Folk (1903)", "Double consciousness, and “the problem of the twentieth century is the problem of the color-line.”"},
	{"Erving Goffman", "1922–1982", "The Presentation of Self in Everyday Life (1956)", "Dramaturgy: social life as performance, with a front stage and a back stage."},
	{"Pierre Bourdieu", "1930–2002", "Distinction (1979)", "Cultural capital and habitus: taste marks and reproduces class."},
}

func thinkersBlock() Block {
	return Block{
		Slug:        "thinkers",
		Title:       "Founding ideas",
		Description: "The concepts later blocks lean on, each tied to the person and book that introduced it. The paragraph below shows how they combine; hover a term for its definition.",
		Tags:        []string{"cards", "glossary", "sources"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2 lg:grid-cols-3"),
					h.Map(thinkers, func(t thinker) h.Node {
						return h.Article(h.Class("flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-xs"),
							h.Div(h.Class("flex items-baseline justify-between gap-2"),
								h.H3(h.Class("text-sm font-semibold tracking-tight"), t.name),
								h.Span(h.Class("font-mono text-[11px] text-muted-foreground tabular-nums"), t.life)),
							h.P(h.Class("text-[13px] leading-relaxed text-pretty"), t.concept),
							h.P(h.Class("mt-auto flex items-center gap-1.5 text-xs text-muted-foreground"), hugeicons.Book02Icon(h.Class("size-3.5 shrink-0")), h.Em(t.work)),
						)
					}),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-5"),
					badge.Badge(badge.VariantOutline, h.Class("self-start font-mono text-[11px] font-normal"), "Reading"),
					h.P(h.Class("text-[16px] leading-8 text-pretty text-muted-foreground"),
						"Why do children of graduates tend to graduate? Part of the answer is money, but Bourdieu pointed to ",
						term("cultural capital", "Knowledge, tastes and manners valued by schools and elites, passed down in families like money is."),
						", absorbed early as a ",
						term("habitus", "Bourdieu: lasting dispositions, ways of perceiving and acting, shaped by one's social position."),
						". Networks matter too: Granovetter showed that jobs often come through ",
						term("weak ties", "Acquaintances rather than close friends. They bridge circles and so carry new information (Granovetter, 1973)."),
						", the acquaintances who connect otherwise separate circles. And where rules break down, Durkheim's ",
						term("anomie", "A state of normlessness, when shared rules no longer regulate what people expect or want."),
						" describes the strain that follows.",
					),
				),
			)
		},
	}
}
