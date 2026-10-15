package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GametheoryBlocks lists the game theory gallery in display order. Every
// model is computed in static/js/gametheory*.js; equilibria of matrix
// games are found with exact rational arithmetic, not floating point.
func GametheoryBlocks() []Block {
	return []Block{
		gtSupportBlock(),
		gtDominanceBlock(),
		gtTreeBlock(),
		gtZeroSumBlock(),
		gtReplicatorBlock(),
		gtAuctionBlock(),
		gtMatchingBlock(),
		gtShapleyBlock(),
		gtBargainingBlock(),
		gtCorrelatedBlock(),
	}
}

func gtSvg(viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func gtButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func gtNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

func gtLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

// gtMatrix is the container a module fills with an editable payoff table.
func gtMatrix() h.Node {
	return h.Div(h.Class("scroll-thin overflow-x-auto"), h.Div(h.Data("matrix", ""), h.Class("mx-auto w-fit")))
}

// gtPlayers names the two players' colours once per block.
func gtPlayers(row, col string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-vec-u")), row),
		h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-vec-v")), col),
		h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-sm ring-2 ring-brand")), "equilibrium"),
	)
}

// ---------------------------------------------------------------- G1

func gtSupportBlock() Block {
	return Block{
		Slug:        "support-enumeration",
		Title:       "Every equilibrium of a 3×3 game",
		Description: "A Nash equilibrium can mix strategies, so a 3×3 game hides equilibria that no cell shows. Support enumeration finds them all: guess which strategies each player uses, make the other player indifferent among exactly those, and keep the guesses whose solution is a valid mixture that no unused strategy beats. All arithmetic is in exact fractions.",
		Tags:        []string{"support enumeration", "mixed strategies", "exact rationals"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("gt-support", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
						segs("Preset game", [2]string{"rps", "Rock–paper–scissors"}, [2]string{"coord", "Coordination"}, [2]string{"shapley", "Shapley's game"}, [2]string{"bos", "Battle of the sexes"}),
					),
					gtPlayers("row player", "column player"),
					gtMatrix(),
					gtNote("Each cell is (row payoff, column payoff). Shaded numbers are pure best responses. Drag or type any payoff."),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Equilibria"),
					h.Ol(h.Data("list", ""), h.Class("flex flex-col gap-2 text-sm"), h.Aria("live", "polite")),
					readouts([2]string{"supports tried", "tried"}, [2]string{"equilibria", "count"}, [2]string{"game", "degenerate"}),
					gtNote("For a nondegenerate game the number of equilibria is odd (Wilson's oddness theorem, 1971). A degenerate game can have whole segments of equilibria; this block then lists the isolated ones it finds and says so."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G2

func gtDominanceBlock() Block {
	return Block{
		Slug:        "dominance",
		Title:       "Iterated elimination of dominated strategies",
		Description: "A strategy is strictly dominated when another one, or a mixture of two others, pays more against everything the opponent might do. No rational player uses it, so strike it out, and then look again: the smaller game may have new dominated strategies. Step through the eliminations until nothing more goes.",
		Tags:        []string{"dominance", "rationalizability", "mixtures"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("gt-dominance", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
						segs("Preset game", [2]string{"gibbons", "Pure dominance"}, [2]string{"mixture", "Needs a mixture"}, [2]string{"pd", "Prisoner's dilemma"}, [2]string{"rps", "Nothing to remove"}),
						h.Div(h.Class("flex flex-wrap gap-2"),
							gtButton("step", "Step", hugeicons.NextIcon()),
							gtButton("all", "All", hugeicons.ArrowRight01Icon()),
							gtButton("reset", "Reset", hugeicons.RefreshIcon()),
						),
					),
					gtPlayers("row player", "column player"),
					gtMatrix(),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Eliminations"),
					h.Ol(h.Data("log", ""), h.Class("flex list-decimal flex-col gap-2 pl-5 text-sm marker:font-mono marker:text-xs marker:text-muted-foreground"), h.Aria("live", "polite")),
					readouts([2]string{"rounds", "rounds"}, [2]string{"left", "left"}, [2]string{"result", "result"}),
					gtNote("Order does not matter for strict dominance: any order of removals ends in the same game. Removing weakly dominated strategies is different, and the order can change the result."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G3

func gtTreeBlock() Block {
	return Block{
		Slug:        "backward-induction",
		Title:       "Backward induction and credible threats",
		Description: "In a game played in turns, solve from the end: at each last decision the mover takes the better payoff, which fixes the value of that node, and so on back to the root. The result is the subgame-perfect equilibrium. Some Nash equilibria rest on threats the threatener would never carry out; backward induction throws them out.",
		Tags:        []string{"extensive form", "subgame perfection", "centipede"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-tree",
				h.Div(h.Class("flex flex-col gap-3"),
					gtSvg("0 0 640 360", "Game tree"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-vec-u")), "player 1 moves"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-vec-v")), "player 2 moves"),
						legendSwatch("var(--brand)", "chosen by backward induction"),
						legendSwatch("var(--code-del)", "non-credible threat"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Game"),
					segs("Game", [2]string{"entry", "Entry"}, [2]string{"centipede", "Centipede"}, [2]string{"sequential", "Who moves first"}),
					h.Div(h.Data("stages", ""), h.Hidden(), field("n", "Moves", "", 6, 2, 10, 1)),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					gtButton("step", "Step", hugeicons.NextIcon()),
					gtButton("solve", "Solve", hugeicons.ArrowRight01Icon()),
					gtButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				h.Div(h.Data("threat-row", ""), toggle("gt-threat", "threat", "Show the threat equilibrium", false)),
				readouts([2]string{"step", "step"}, [2]string{"path", "path"}, [2]string{"payoffs", "pay"}, [2]string{"note", "note"}),
				gtNote(h.Span(h.Data("out", "foot"))),
			)
		},
	}
}

// ---------------------------------------------------------------- G4

func gtZeroSumBlock() Block {
	return Block{
		Slug:        "zero-sum",
		Title:       "Zero-sum games: the graphical method",
		Description: "In a zero-sum game one player's gain is the other's loss. The row player picks a probability p for the first row; against each column that gives a straight line of expected payoff. The opponent will pick the lowest line, so the row player climbs to the top of the lower envelope. Von Neumann's minimax theorem: that height is also the least the column player can concede.",
		Tags:        []string{"minimax", "von Neumann", "lower envelope"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-zerosum",
				h.Div(h.Class("flex flex-col gap-3"),
					gtSvg("0 0 640 330", "Expected payoff against each column as the row mix changes"),
					gtLegend([2]string{"var(--muted-foreground)", "one line per column"}, [2]string{"var(--vec-u)", "lower envelope (row's guarantee)"}, [2]string{"var(--brand)", "maximin point"}),
					gtMatrix(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Game (payoffs to row)"),
					segs("Preset game", [2]string{"mixed", "Mixed"}, [2]string{"saddle", "Saddle point"}, [2]string{"morra", "Two-finger"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Try a mix"),
					field("p", "P(row 1)", "", 0.5, 0, 1, 0.01),
				),
				readouts([2]string{"guarantee at p", "g"}, [2]string{"optimal p*", "pstar"}, [2]string{"value v", "v"}, [2]string{"column mix", "q"}, [2]string{"saddle point", "saddle"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G5

func gtReplicatorBlock() Block {
	return Block{
		Slug:        "replicator",
		Title:       "Replicator dynamics on the simplex",
		Description: "A population plays a three-strategy game against itself. Strategies that earn more than the average grow, the others shrink: ẋᵢ = xᵢ((Ax)ᵢ − x·Ax). Every point of the triangle is a population mix. Click to release a population and follow it: rock–paper–scissors cycles, spirals in or out depending on how wins compare with losses, and Hawk–Dove–Bourgeois settles on a convention.",
		Tags:        []string{"evolutionary game theory", "ESS", "Taylor & Jonker"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-replicator",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 470"), h.Class("mx-auto block w-full max-w-[560px] cursor-crosshair select-none touch-none"), h.Role("img"), h.Aria("label", "Simplex of population mixes; click to start a trajectory")),
					gtLegend([2]string{"var(--muted-foreground)", "direction of change"}, [2]string{"var(--brand)", "trajectories"}, [2]string{"var(--vec-u)", "rest points"}),
					h.Div(h.Class("flex flex-col gap-2 border-t px-1 pt-3"), panelLabel("Payoff matrix A (row strategy against column strategy)"), gtMatrix()),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Game"),
					segs("Game", [2]string{"rps", "RPS"}, [2]string{"hdb", "Hawk–Dove–Bourgeois"}, [2]string{"coord", "Coordination"}),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					playPause(),
					gtButton("clear", "Clear", hugeicons.Delete02Icon()),
				),
				readouts([2]string{"interior rest point", "interior"}, [2]string{"stability", "stab"}, [2]string{"ESS", "ess"}, [2]string{"mean fitness", "fit"}),
				gtNote("Taylor & Jonker (1978) wrote down these dynamics; Maynard Smith & Price (1973) defined the evolutionarily stable strategy. An interior ESS attracts every trajectory that starts inside the triangle."),
			)
		},
	}
}

// ---------------------------------------------------------------- G6

func gtAuctionBlock() Block {
	return Block{
		Slug:        "auctions",
		Title:       "First-price and second-price auctions",
		Description: "Bidders draw private values between 0 and 100. In a second-price auction bidding your value is optimal whatever the others do. In a first-price auction you shade: against equilibrium rivals the best bid is (n−1)/n of your value. The curves show your expected profit for every bid. Then simulate thousands of auctions: on average the seller earns the same in both, the revenue equivalence theorem.",
		Tags:        []string{"Vickrey", "bid shading", "revenue equivalence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-auction",
				h.Div(h.Class("flex flex-col gap-3"),
					gtSvg("0 0 640 270", "Expected profit against your bid"),
					gtLegend([2]string{"var(--vec-u)", "first price"}, [2]string{"var(--vec-v)", "second price"}, [2]string{"var(--brand)", "your bid"}),
					h.Div(h.Class("border-t pt-3"), gtSvg("0 0 640 200", "Seller revenue over simulated auctions")),
					gtLegend([2]string{"var(--vec-u)", "first-price revenue"}, [2]string{"var(--vec-v)", "second-price revenue"}, [2]string{"var(--foreground)", "theory (n−1)/(n+1)·100"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("You"),
					field("n", "Bidders", "", 3, 2, 10, 1),
					field("v", "Your value", "€", 70, 0, 100, 1),
					field("b", "Your bid", "€", 50, 0, 100, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					gtButton("sim", "Simulate 5,000", hugeicons.PlayIcon()),
				),
				readouts([2]string{"first-price profit", "fp"}, [2]string{"best first-price bid", "fpstar"}, [2]string{"second-price profit", "sp"}, [2]string{"mean revenue (1st)", "r1"}, [2]string{"mean revenue (2nd)", "r2"}, [2]string{"theory", "rth"}),
				gtNote("Vickrey (1961); Myerson (1981) and Riley & Samuelson (1981) proved revenue equivalence for independent private values. Rivals here follow the equilibrium bid; values are uniform."),
			)
		},
	}
}

// ---------------------------------------------------------------- G7

func gtMatchingBlock() Block {
	return Block{
		Slug:        "stable-matching",
		Title:       "Stable matching: deferred acceptance",
		Description: "Four residents rank four hospitals and the hospitals rank them back. In Gale and Shapley's algorithm one side proposes in order of preference; the other side holds its best offer so far and rejects the rest. The result is always stable: no resident and hospital both prefer each other to their partners. And it is the best stable matching for the side that proposes.",
		Tags:        []string{"Gale–Shapley", "stability", "market design"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("gt-matching", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
						segs("Who proposes", [2]string{"r", "Residents propose"}, [2]string{"h", "Hospitals propose"}),
						h.Div(h.Class("flex flex-wrap gap-2"),
							gtButton("step", "Step", hugeicons.NextIcon()),
							gtButton("run", "Run", hugeicons.ArrowRight01Icon()),
							gtButton("reset", "Reset", hugeicons.RefreshIcon()),
							gtButton("shuffle", "Shuffle", hugeicons.ShuffleIcon()),
						),
					),
					h.Div(h.Data("board", ""), h.Class("grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center")),
					gtNote("Each list is a ranking, best first. Use the arrows to move a choice up the list."),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					panelLabel("Proposals"),
					h.Ol(h.Data("log", ""), h.Class("scroll-thin flex max-h-56 flex-col gap-1 overflow-y-auto font-mono text-xs"), h.Aria("live", "polite")),
					readouts([2]string{"rounds", "rounds"}, [2]string{"blocking pairs", "blocking"}, [2]string{"residents' avg rank", "rrank"}, [2]string{"hospitals' avg rank", "hrank"}, [2]string{"stable matchings", "nstable"}),
					gtNote("Gale & Shapley (1962), American Mathematical Monthly 69:9–15. A resident-proposing version runs the US medical residency match (Roth & Peranson 1999)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- G8

func gtShapleyBlock() Block {
	return Block{
		Slug:        "shapley-value",
		Title:       "The Shapley value",
		Description: "How to split what a group creates together. Line the players up in every possible order; each one is credited with what they add when they arrive. Average over all orders and you get the Shapley value: the only split that is efficient, symmetric, additive and gives nothing to a player who adds nothing. Every ordering is listed.",
		Tags:        []string{"cooperative games", "marginal contributions", "voting power"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-shapley",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("bars", ""), h.Class("flex flex-col gap-2 px-1")),
					h.Div(h.Class("scroll-thin max-h-80 overflow-auto border-t pt-3"), h.Table(h.Data("orders", ""), h.Class("w-full font-mono text-xs tabular-nums"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Game"),
					segs("Game", [2]string{"gloves", "Gloves"}, [2]string{"airport", "Airport"}, [2]string{"vote", "Weighted vote"}),
				),
				h.Div(h.Data("params", "airport"), h.Hidden(), h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Runway each plane needs"),
					field("c1", "Small plane", "M€", 6, 1, 30, 1),
					field("c2", "Medium plane", "M€", 12, 1, 30, 1),
					field("c3", "Large plane", "M€", 30, 1, 60, 1),
				),
				h.Div(h.Data("params", "vote"), h.Hidden(), h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Seats and quota"),
					field("w1", "Party A", "", 45, 0, 100, 1),
					field("w2", "Party B", "", 35, 0, 100, 1),
					field("w3", "Party C", "", 15, 0, 100, 1),
					field("w4", "Party D", "", 5, 0, 100, 1),
					field("q", "Quota", "", 51, 1, 300, 1),
				),
				readouts([2]string{"orderings", "orders"}, [2]string{"total shared", "total"}, [2]string{"note", "note"}),
				h.P(h.Data("out", "foot"), h.Class("text-xs leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- G9

func gtBargainingBlock() Block {
	return Block{
		Slug:        "bargaining",
		Title:       "Alternating offers: Rubinstein bargaining",
		Description: "Two players split a cake. One proposes, the other accepts or makes a counter-offer next round, and waiting costs: a share is worth δ of itself one round later. With a last round, backward induction pins down every offer; as the deadline recedes the split converges to Rubinstein's (1982) answer, (1−δ₂)/(1−δ₁δ₂) for the first proposer. Patience is bargaining power.",
		Tags:        []string{"Rubinstein", "discounting", "first-mover advantage"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-bargaining",
				h.Div(h.Class("flex flex-col gap-3"),
					gtSvg("0 0 640 280", "First proposer's share against the number of rounds"),
					gtLegend([2]string{"var(--vec-u)", "player 1's share with a deadline"}, [2]string{"var(--brand)", "infinite horizon"}),
					h.Div(h.Class("scroll-thin overflow-x-auto border-t pt-3"), h.Table(h.Data("rounds", ""), h.Class("w-full font-mono text-xs tabular-nums"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Patience"),
					field("d1", "δ₁ player 1", "", 0.9, 0, 0.99, 0.01),
					field("d2", "δ₂ player 2", "", 0.8, 0, 0.99, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Deadline"),
					field("T", "Rounds", "", 5, 1, 30, 1),
				),
				readouts([2]string{"P1 share, T rounds", "fin"}, [2]string{"P1 share, no deadline", "inf"}, [2]string{"P2 share, no deadline", "inf2"}, [2]string{"first offer", "offer"}),
				gtNote("Agreement comes in the first round in equilibrium: the proposer offers the responder exactly what waiting would be worth to them."),
			)
		},
	}
}

// ---------------------------------------------------------------- G10

func gtCorrelatedBlock() Block {
	return Block{
		Slug:        "correlated-equilibrium",
		Title:       "Correlated equilibrium: a traffic light",
		Description: "Two drivers reach a crossing: Stop or Go. Both Going is a crash. The Nash equilibria are unfair (one always goes) or wasteful (random, with crashes). A traffic light draws a joint signal and tells each driver only their own instruction. If obeying is always a best response, that is a correlated equilibrium (Aumann 1974), and it can beat every Nash equilibrium. Set the light's probabilities and the obedience conditions are checked exactly.",
		Tags:        []string{"Aumann", "obedience constraints", "chicken"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gt-correlated",
				h.Div(h.Class("flex flex-col gap-3"),
					gtSvg("0 0 640 330", "Expected payoffs of driver 1 and driver 2"),
					gtLegend([2]string{"var(--vec-u)", "correlated equilibria"}, [2]string{"var(--foreground)", "Nash equilibria"}, [2]string{"var(--brand)", "your light"}),
					h.Div(h.Data("light", ""), h.Class("flex flex-wrap items-center gap-3 border-t px-1 pt-3 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("The light's signals"),
					field("ss", "Stop / Stop", "%", 34, 0, 100, 1),
					field("sg", "Stop / Go", "%", 33, 0, 100, 1),
					field("gs", "Go / Stop", "%", 33, 0, 100, 1),
					h.P(h.Data("out", "gg"), h.Class("font-mono text-xs text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					gtButton("best", "Fairest best", hugeicons.TrafficLightIcon()),
					gtButton("draw", "Draw a signal", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Data("checks", ""), h.Class("flex flex-col gap-1 border-t pt-4 font-mono text-xs")),
				readouts([2]string{"payoffs", "pay"}, [2]string{"total", "total"}, [2]string{"verdict", "verdict"}),
				gtNote("Payoffs: Stop/Stop 6 each, Go against Stop 7 and 2, Go/Go 0 each (the example in Aumann's paper)."),
			)
		},
	}
}
