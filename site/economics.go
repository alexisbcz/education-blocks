package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// EconomicsBlocks lists the economics gallery in display order.
func EconomicsBlocks() []Block {
	return []Block{
		econMarketBlock(),
		econElasticityBlock(),
		econMonopolyBlock(),
		econGamesBlock(),
		econInterestBlock(),
		econRicardoBlock(),
		econSolowBlock(),
		econMultiplierBlock(),
	}
}

// econSvg is a plot surface for the economics blocks.
func econSvg(attr, label string, w, hgt int) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(fmt.Sprintf("0 0 %d %d", w, hgt)), h.Class("mx-auto block w-full max-w-[640px] select-none"),
		h.Role("img"), h.Aria("label", label))
}

// econFormulaLabel is a panel label followed by its formula, which keeps
// its case (the label itself is set in small caps).
func econFormulaLabel(label, formula string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-baseline justify-between gap-x-2"),
		panelLabel(label),
		h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), formula))
}

// econNumber is a compact scrub input without a label row, for matrices.
func econNumber(name, aria string, v, min, max, step float64) h.Node {
	return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
		h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)),
		h.Attr("autocomplete", "off"), h.Aria("label", aria),
		h.Class("h-8 w-9 cursor-ew-resize rounded-md border border-input bg-background px-1 text-center sm:w-12 sm:px-1.5 font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring"))
}

// ---------------------------------------------------------------- E1

func econMarketBlock() Block {
	return Block{
		Slug:        "market",
		Title:       "Supply, demand and surplus",
		Description: "Linear demand and supply curves, their equilibrium, and the gains from trade as areas: consumer surplus above the price, producer surplus below it. Add a price ceiling, a floor or a per-unit tax and the lost trades appear as the deadweight-loss triangle.",
		Tags:        []string{"equilibrium", "surplus", "deadweight loss"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("econ-market",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "consumer surplus"),
						legendSwatch("var(--brand)", "producer surplus"),
						legendSwatch("var(--vec-out)", "tax revenue"),
						legendSwatch("var(--code-del)", "deadweight loss"),
					),
					econSvg("plot", "Supply and demand diagram", 560, 380),
				),
				h.Div(h.Class("flex flex-col gap-2"), econFormulaLabel("Demand", "P = a − bQ"),
					field("a", "Intercept a", "€", 10, 2, 20, 0.5),
					field("b", "Slope b", "€/unit", 1, 0.1, 5, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), econFormulaLabel("Supply", "P = c + dQ"),
					field("c", "Intercept c", "€", 2, 0, 15, 0.5),
					field("d", "Slope d", "€/unit", 1, 0.1, 5, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Policy"),
					segs("Policy", [2]string{"none", "None"}, [2]string{"ceiling", "Ceiling"}, [2]string{"floor", "Floor"}, [2]string{"tax", "Tax"}),
					field("level", "Level", "€", 5, 0, 20, 0.25),
				),
				readouts([2]string{"quantity", "q"}, [2]string{"price", "p"}, [2]string{"consumer surplus", "cs"}, [2]string{"producer surplus", "ps"},
					[2]string{"tax revenue", "rev"}, [2]string{"deadweight loss", "dwl"}, [2]string{"note", "note"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E2

func econElasticityBlock() Block {
	return Block{
		Slug:        "elasticity",
		Title:       "Price elasticity",
		Description: "How strongly quantity responds to price, on a straight demand line. The point elasticity changes all along the line; the midpoint (arc) formula measures a move between two prices. Where demand is elastic a price cut raises revenue; where it is inelastic it lowers it.",
		Tags:        []string{"point & arc", "revenue", "linear demand"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("econ-elasticity",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("demand", ""), h.ViewBox("0 0 320 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Demand line")),
					h.Svg(h.Data("revenue", ""), h.ViewBox("0 0 320 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Total revenue against price")),
				),
				h.Div(h.Class("flex flex-col gap-2"), econFormulaLabel("Demand", "Q = (a − P) / b"),
					field("a", "Choke price a", "€", 20, 5, 50, 0.5),
					field("b", "Slope b", "€/unit", 0.5, 0.05, 5, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Price change"),
					field("p1", "From P₁", "€", 12, 0, 50, 0.25),
					field("p2", "To P₂", "€", 16, 0, 50, 0.25),
				),
				readouts([2]string{"Q₁ → Q₂", "qs"}, [2]string{"point ε at P₁", "point"}, [2]string{"arc ε", "arc"}, [2]string{"revenue", "tr"}, [2]string{"verdict", "verdict"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E3

func econMonopolyBlock() Block {
	return Block{
		Slug:        "monopoly",
		Title:       "Monopoly vs competition",
		Description: "Same demand, same constant marginal cost. A competitive market sells where price equals marginal cost; a monopolist sells where marginal revenue equals marginal cost, charges more, sells less, and the trades that no longer happen are the deadweight loss.",
		Tags:        []string{"MR = MC", "market power", "welfare"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("econ-monopoly",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "demand"),
						legendSwatch("var(--ion-cl)", "marginal revenue"),
						legendSwatch("var(--ion-k)", "marginal cost"),
					),
					econSvg("plot", "Monopoly pricing diagram", 560, 360),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Market"),
					segs("Market structure", [2]string{"monopoly", "Monopoly"}, [2]string{"competition", "Competition"}),
					field("a", "Demand intercept", "€", 10, 2, 30, 0.5),
					field("b", "Demand slope", "€/unit", 1, 0.1, 5, 0.1),
					field("c", "Marginal cost", "€", 2, 0, 25, 0.25),
				),
				readouts([2]string{"quantity", "q"}, [2]string{"price", "p"}, [2]string{"profit", "profit"}, [2]string{"consumer surplus", "cs"}, [2]string{"deadweight loss", "dwl"}, [2]string{"Lerner index", "lerner"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E4

type econGame struct {
	key, name string
	rows      [2]string
	cols      [2]string
	pay       [2][2][2]float64 // [row][col] = {row player, column player}
}

var econGames = []econGame{
	{"pd", "Prisoner's dilemma", [2]string{"Cooperate", "Defect"}, [2]string{"Cooperate", "Defect"},
		[2][2][2]float64{{{3, 3}, {0, 5}}, {{5, 0}, {1, 1}}}},
	{"stag", "Stag hunt", [2]string{"Stag", "Hare"}, [2]string{"Stag", "Hare"},
		[2][2][2]float64{{{4, 4}, {0, 3}}, {{3, 0}, {3, 3}}}},
	{"chicken", "Chicken", [2]string{"Swerve", "Straight"}, [2]string{"Swerve", "Straight"},
		[2][2][2]float64{{{0, 0}, {-1, 1}}, {{1, -1}, {-10, -10}}}},
	{"pennies", "Matching pennies", [2]string{"Heads", "Tails"}, [2]string{"Heads", "Tails"},
		[2][2][2]float64{{{1, -1}, {-1, 1}}, {{-1, 1}, {1, -1}}}},
}

func econGamesBlock() Block {
	g := econGames[0]
	return Block{
		Slug:        "nash",
		Title:       "Nash equilibrium",
		Description: "A two-player game in one table: each cell holds the row player's and the column player's payoff. Best responses are marked; a cell where both are best-responding is a pure Nash equilibrium. Mixed equilibria come from making the other player indifferent, solved exactly.",
		Tags:        []string{"game theory", "best response", "mixed strategies"},
		Render: func() h.Node {
			cell := func(r, c int) h.Node {
				key := fmt.Sprintf("%d%d", r, c)
				return h.Td(h.Data("cell", key), h.Class("rounded-lg border bg-background p-1 transition sm:p-2-[border-color,box-shadow] duration-150 data-[nash]:border-brand data-[nash]:ring-[3px] data-[nash]:ring-brand/25"),
					h.Div(h.Class("flex items-center justify-center gap-0.5 sm:gap-1.5"),
						h.Span(h.Data("br", "r"+key), h.Class("rounded-md p-0.5 data-[on]:bg-vec-u/15"), econNumber("r"+key, fmt.Sprintf("Row payoff, row %d column %d", r+1, c+1), g.pay[r][c][0], -20, 20, 1)),
						h.Span(h.Class("text-muted-foreground"), ","),
						h.Span(h.Data("br", "c"+key), h.Class("rounded-md p-0.5 data-[on]:bg-brand/15"), econNumber("c"+key, fmt.Sprintf("Column payoff, row %d column %d", r+1, c+1), g.pay[r][c][1], -20, 20, 1)),
					),
				)
			}
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("econ-nash", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Preset game", [2]string{"pd", "Prisoner's dilemma"}, [2]string{"stag", "Stag hunt"}, [2]string{"chicken", "Chicken"}, [2]string{"pennies", "Pennies"}),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					h.Table(h.Class("mx-auto border-separate border-spacing-1 text-sm sm:border-spacing-2"),
						h.Thead(h.Tr(
							h.Th(h.Class("text-left text-[11px] font-normal text-muted-foreground"), h.Span(h.Class("text-vec-u"), "Row"), " / ", h.Span(h.Class("text-brand"), "Column")),
							h.Th(h.Data("label", "c0"), h.Class("text-center text-xs font-medium text-brand"), g.cols[0]),
							h.Th(h.Data("label", "c1"), h.Class("text-center text-xs font-medium text-brand"), g.cols[1]),
						)),
						h.Tbody(
							h.Tr(h.Th(h.Data("label", "r0"), h.Class("pr-1 text-right text-[11px] font-medium text-vec-u sm:pr-2 sm:text-xs"), g.rows[0]), cell(0, 0), cell(0, 1)),
							h.Tr(h.Th(h.Data("label", "r1"), h.Class("pr-1 text-right text-[11px] font-medium text-vec-u sm:pr-2 sm:text-xs"), g.rows[1]), cell(1, 0), cell(1, 1)),
						),
					),
				),
				h.Div(h.Class("grid gap-3 border-t pt-4 text-sm sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Pure equilibria"),
						h.Span(h.Data("out", "pure"), h.Class("font-medium"), "—"),
					),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Mixed equilibrium"),
						h.Span(h.Data("out", "mixed"), h.Class("font-medium"), "—"),
						h.Span(h.Data("out", "mixednote"), h.Class("text-xs text-muted-foreground")),
					),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Shaded payoffs are best responses: blue for the row player given the column, pink for the column player given the row. Drag or type any payoff to build your own game."),
			)
		},
	}
}

// ---------------------------------------------------------------- E5

func econInterestBlock() Block {
	return Block{
		Slug:        "interest",
		Title:       "Compound interest and inflation",
		Description: "Money growing at a fixed rate, compounded yearly, monthly, daily or continuously, next to simple interest. The rule of 72 against the exact doubling time, and what the final sum is worth once inflation is taken out (the exact Fisher relation, not the subtraction shortcut).",
		Tags:        []string{"compounding", "rule of 72", "real vs nominal"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("econ-interest",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "compound (selected)"),
						legendSwatch("var(--foreground)", "simple interest"),
						legendSwatch("var(--vec-u)", "real value after inflation"),
					),
					econSvg("plot", "Balance over time", 560, 340),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Deposit"),
					field("p", "Principal", "€", 1000, 1, 100000, 10),
					field("r", "Nominal rate", "%/yr", 5, 0, 30, 0.1),
					field("t", "Years", "yr", 30, 1, 60, 1),
					segs("Compounding", [2]string{"1", "Yearly"}, [2]string{"12", "Monthly"}, [2]string{"365", "Daily"}, [2]string{"inf", "Continuous"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Prices"),
					field("pi", "Inflation", "%/yr", 2, -5, 30, 0.1),
				),
				readouts([2]string{"final balance", "fv"}, [2]string{"simple interest", "simple"}, [2]string{"effective rate", "ear"},
					[2]string{"doubling (exact)", "dbl"}, [2]string{"rule of 72", "r72"}, [2]string{"real rate", "real"}, [2]string{"real value", "rv"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E6

func econRicardoBlock() Block {
	return Block{
		Slug:        "ricardo",
		Title:       "Comparative advantage",
		Description: "Ricardo's own example (Principles of Political Economy and Taxation, 1817, chapter 7): Portugal needs fewer hours for both wine and cloth, yet both countries gain when each specialises where its opportunity cost is lower and they trade at a price between the two.",
		Tags:        []string{"Ricardo 1817", "PPF", "gains from trade"},
		Wide:        true,
		Render: func() h.Node {
			hours := func(country, prefix string, wine, cloth, labour float64) h.Node {
				return h.Div(h.Class("flex flex-col gap-2"), panelLabel(country+" (hours per unit)"),
					field(prefix+"w", "Wine", "h", wine, 1, 300, 1),
					field(prefix+"c", "Cloth", "h", cloth, 1, 300, 1),
					field(prefix+"l", "Labour", "h", labour, 10, 2000, 10),
				)
			}
			return plotPanel("econ-ricardo",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--ion-na)", "Portugal"),
						legendSwatch("var(--vec-u)", "England"),
						legendSwatch("var(--brand)", "after specialisation and trade"),
					),
					econSvg("plot", "Production possibility frontiers", 560, 340),
				),
				hours("Portugal", "pt", 80, 90, 170),
				h.Div(h.Class("border-t pt-4"), hours("England", "en", 120, 100, 220)),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Trade"),
					field("tot", "Price of wine", "cloth", 1, 0.1, 3, 0.01),
				),
				readouts([2]string{"Portugal, 1 wine", "ptoc"}, [2]string{"England, 1 wine", "enoc"}, [2]string{"specialise", "spec"},
					[2]string{"world output", "world"}, [2]string{"gain vs autarky", "gain"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E7

func econSolowBlock() Block {
	return Block{
		Slug:        "solow",
		Title:       "Solow growth model",
		Description: "Capital per worker grows when saving s·f(k) exceeds what is needed to equip new workers and replace worn-out machines, (n + δ)·k. Where the two curves cross is the steady state; start anywhere and the economy converges to it. Cobb–Douglas output f(k) = k^α, no technical progress.",
		Tags:        []string{"steady state", "phase diagram", "golden rule"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("econ-solow",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("phase", ""), h.ViewBox("0 0 320 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Saving and break-even investment against capital per worker")),
					h.Svg(h.Data("path", ""), h.ViewBox("0 0 320 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Capital per worker over time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("s", "Saving rate s", "", 0.25, 0.01, 0.95, 0.01),
					field("alpha", "Capital share α", "", 0.33, 0.1, 0.9, 0.01),
					field("n", "Population n", "/yr", 0.01, 0, 0.1, 0.005),
					field("delta", "Depreciation δ", "/yr", 0.05, 0, 0.2, 0.005),
					field("k0", "Start k₀", "", 1, 0.1, 50, 0.1),
				),
				readouts([2]string{"steady k*", "k"}, [2]string{"output y*", "y"}, [2]string{"consumption c*", "c"}, [2]string{"golden-rule s", "gold"}, [2]string{"half-way in", "half"}),
			)
		},
	}
}

// ---------------------------------------------------------------- E8

func econMultiplierBlock() Block {
	return Block{
		Slug:        "multiplier",
		Title:       "The spending multiplier",
		Description: "A simple Keynesian model: extra spending becomes someone's income, who spends a fraction of it (the marginal propensity to consume), and so on. The rounds form a geometric series that sums to the first injection divided by 1 − MPC. A model with no taxes, imports or price effects.",
		Tags:        []string{"geometric series", "MPC", "macro"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("econ-multiplier", ""),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					field("g", "New spending", "€bn", 10, 1, 100, 1),
					field("mpc", "MPC", "", 0.8, 0, 0.95, 0.01),
				),
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Spending in each round, and the running total")),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
					h.Dl(h.Class("flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs"),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "multiplier"), h.Dd(h.Data("out", "k"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "total"), h.Dd(h.Data("out", "total"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "after 10 rounds"), h.Dd(h.Data("out", "ten"), "—")),
					),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "replay"), hugeicons.RefreshIcon(), "Replay rounds"),
				),
			)
		},
	}
}
