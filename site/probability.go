package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ProbabilityBlocks lists the probability gallery in display order.
func ProbabilityBlocks() []Block {
	return []Block{
		probAreaBlock(),
		probBirthdayBlock(),
		probMontyBlock(),
		probRuinBlock(),
		probLLNBlock(),
		probGaltonBlock(),
		probMarkovBlock(),
		probDiceBlock(),
	}
}

func probSVG(name, viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[640px] select-none"),
		h.Role("img"), h.Aria("label", label))
}

func probButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- P1

func probAreaBlock() Block {
	return Block{
		Slug:        "area-model",
		Title:       "Events as areas",
		Description: "Probability as area in the unit square. A takes a vertical slice; inside each slice, B takes a share given by its conditional probability. Every rule falls out of the picture: the addition rule, Bayes' rule, and independence (B takes the same share of both slices).",
		Tags:        []string{"conditional", "addition rule", "independence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-area",
				probSVG("main", "0 0 520 340", "Unit square split into A and not A, with B shaded inside each part"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Events"),
					field("pa", "P(A)", "", 0.4, 0, 1, 0.01),
					field("pba", "P(B | A)", "", 0.7, 0, 1, 0.01),
					field("pbna", "P(B | not A)", "", 0.25, 0, 1, 0.01),
				),
				h.Div(h.Class("flex gap-2"), probButton("independent", "Make independent", hugeicons.GitMergeIcon())),
				readouts([2]string{"P(A ∩ B)", "and"}, [2]string{"P(B)", "pb"}, [2]string{"P(A ∪ B)", "or"}, [2]string{"P(A | B)", "bayes"}, [2]string{"independent?", "indep"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func probBirthdayBlock() Block {
	return Block{
		Slug:        "birthday",
		Title:       "The birthday problem",
		Description: "How many people before two share a birthday? With 365 equally likely days (no 29 February), 23 people already give 50.7%. The exact product formula is checked against a simulation of random classrooms.",
		Tags:        []string{"complement", "exact vs simulated", "surprise"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-birthday",
				probSVG("main", "0 0 560 320", "Probability of a shared birthday against group size"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Group"),
					field("n", "People n", "", 23, 1, 80, 1),
				),
				h.Div(h.Class("flex gap-2"), probButton("simulate", "Simulate 2,000 groups", hugeicons.DiceIcon())),
				readouts([2]string{"exact", "exact"}, [2]string{"simulated", "sim"}, [2]string{"pairs", "pairs"}),
				h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), "P(shared) = 1 − (365·364·…·(365−n+1)) / 365ⁿ"),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func probMontyBlock() Block {
	door := func(i int) h.Node {
		return h.Button(h.Type("button"), h.Data("door", fmt.Sprint(i)), h.Aria("label", fmt.Sprintf("Door %d", i+1)),
			h.Class("group relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border bg-background text-sm shadow-xs transition-[border-color,box-shadow,background-color] duration-150 outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default data-[picked]:border-ring data-[picked]:ring-[3px] data-[picked]:ring-ring/50 data-[open]:bg-code"),
			h.Span(h.Class("font-mono text-xs text-muted-foreground"), fmt.Sprintf("Door %d", i+1)),
			h.Span(h.Data("content", ""), h.Class("text-2xl"), "?"),
		)
	}
	return Block{
		Slug:        "monty-hall",
		Title:       "Monty Hall",
		Description: "Pick a door; the host, who knows where the car is, opens another door with a goat and offers a switch. Switching wins 2/3 of the time. Play a few rounds, then let the simulation run both strategies a thousand times.",
		Tags:        []string{"conditional", "simulation", "game"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-monty",
				h.Div(h.Class("flex flex-col gap-4 p-2"),
					h.Div(h.Class("mx-auto grid w-full max-w-md grid-cols-3 gap-3"), door(0), door(1), door(2)),
					h.P(h.Data("out", "prompt"), h.Aria("live", "polite"), h.Class("min-h-5 text-center text-sm"), "Pick a door."),
					h.Div(h.Class("flex justify-center gap-2"),
						probButton("stay", "Stay", hugeicons.Tick02Icon()),
						probButton("switch", "Switch", hugeicons.ArrowDataTransferHorizontalIcon()),
						probButton("again", "New round", hugeicons.RefreshIcon()),
					),
					probSVG("main", "0 0 560 170", "Win rate of staying and switching over simulated rounds"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Your rounds"),
					readouts([2]string{"stayed, won", "stay"}, [2]string{"switched, won", "switch"}),
				),
				h.Div(h.Class("flex gap-2"), probButton("simulate", "Simulate 1,000 each", hugeicons.DiceIcon())),
				readouts([2]string{"stay (sim)", "simstay"}, [2]string{"switch (sim)", "simswitch"}, [2]string{"exact", "exactmh"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func probRuinBlock() Block {
	return Block{
		Slug:        "gamblers-ruin",
		Title:       "Random walks and gambler's ruin",
		Description: "Start with i chips, bet one at a time, win each bet with probability p, stop at 0 or at N. The ruin probability has an exact formula; a slightly unfair game (p = 0.48) ruins you far more often than intuition says. Twenty walks are drawn against it.",
		Tags:        []string{"random walk", "absorbing states", "exact formula"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-ruin",
				probSVG("main", "0 0 560 320", "Random walks between 0 and N"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Game"),
					field("i", "Start i", "", 10, 1, 49, 1),
					field("N", "Target N", "", 20, 2, 50, 1),
					field("p", "Win prob. p", "", 0.48, 0.3, 0.7, 0.01),
				),
				h.Div(h.Class("flex gap-2"), probButton("reseed", "New walks", hugeicons.ShuffleIcon())),
				readouts([2]string{"ruin (exact)", "ruin"}, [2]string{"ruin (walks)", "simruin"}, [2]string{"mean length", "dur"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func probLLNBlock() Block {
	return Block{
		Slug:        "law-of-large-numbers",
		Title:       "Law of large numbers",
		Description: "Running averages of coin flips or die rolls settle on the expected value. Each path wanders early and steadies later; the shaded band ±2σ/√n shows how fast the typical deviation shrinks. The average converges, not the count of heads minus tails.",
		Tags:        []string{"convergence", "running mean", "log axis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-lln",
				probSVG("main", "0 0 560 320", "Running averages of five independent sequences"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Experiment"),
					segs("Experiment", [2]string{"coin", "Coin"}, [2]string{"die", "Die"}),
					field("pc", "P(heads)", "", 0.5, 0.05, 0.95, 0.01),
				),
				h.Div(h.Class("flex gap-2"), probButton("reseed", "New sequences", hugeicons.ShuffleIcon())),
				readouts([2]string{"expected", "mu"}, [2]string{"after 10", "m10"}, [2]string{"after 10,000", "m10k"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

func probGaltonBlock() Block {
	return Block{
		Slug:        "galton-board",
		Title:       "Galton board",
		Description: "Each ball bounces left or right at every peg, so its bin is a binomial count. Drop a few hundred and the histogram traces the binomial distribution, which the normal curve approximates as the rows increase (de Moivre–Laplace).",
		Tags:        []string{"binomial", "normal approximation", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-galton",
				probSVG("main", "0 0 520 400", "Galton board with falling balls and the bin histogram"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Board"),
					field("rows", "Rows", "", 10, 2, 16, 1),
					field("p", "P(right)", "", 0.5, 0.1, 0.9, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					playPauseLabel("Drop"),
					probButton("burst", "+500 at once", hugeicons.FlashIcon()),
					probButton("clear", "Clear", hugeicons.RefreshIcon()),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--brand)", "binomial"),
					legendSwatch("var(--vec-u)", "normal"),
				),
				readouts([2]string{"balls", "n"}, [2]string{"mean bin", "mean"}, [2]string{"expected", "expect"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

var probStates = []string{"Sunny", "Cloudy", "Rainy"}

func probMarkovBlock() Block {
	defaults := [3][3]float64{{0.7, 0.2, 0.1}, {0.3, 0.4, 0.3}, {0.2, 0.4, 0.4}}
	return Block{
		Slug:        "markov-chain",
		Title:       "Markov chain",
		Description: "A toy weather model where tomorrow depends only on today. Edit the transition probabilities (each row is renormalised to sum to 1) and watch the forecast from a given day forget where it started and settle on the stationary distribution π = πP.",
		Tags:        []string{"transition matrix", "stationary distribution", "illustrative"},
		Wide:        true,
		Render: func() h.Node {
			cell := func(i, j int) h.Node {
				return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", fmt.Sprintf("p%d%d", i, j)), h.Value(fmt.Sprint(defaults[i][j])),
					h.Data("min", "0"), h.Data("max", "1"), h.Data("step", "0.01"), h.Attr("autocomplete", "off"),
					h.Aria("label", fmt.Sprintf("P(%s → %s)", probStates[i], probStates[j])),
					h.Class("h-8 w-full min-w-0 cursor-ew-resize rounded-md border border-input bg-background px-1.5 text-right font-mono text-sm tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring"))
			}
			return plotPanel("prob-markov",
				h.Div(h.Class("flex flex-col gap-2"),
					probSVG("graph", "0 0 520 262", "State diagram with transition probabilities"),
					probSVG("conv", "0 0 520 170", "Forecast distribution converging over days"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Today → tomorrow"),
					h.Div(h.Class("grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-1.5 text-[11px] text-muted-foreground"),
						h.Span(),
						h.Map(probStates, func(s string) h.Node { return h.Span(h.Class("text-center"), s[:1]) }),
						h.Range(3, func(i int) h.Node {
							return h.Group(h.Span(probStates[i]), cell(i, 0), cell(i, 1), cell(i, 2))
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Start"),
					segs("Start state", [2]string{"0", "Sunny"}, [2]string{"1", "Cloudy"}, [2]string{"2", "Rainy"}),
				),
				readouts([2]string{"π (stationary)", "pi"}, [2]string{"day 1", "d1"}, [2]string{"day 10", "d10"}),
				h.P(h.Data("out", "strip"), h.Class("font-mono text-sm tracking-widest break-all")),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func probDiceBlock() Block {
	return Block{
		Slug:        "dice-sums",
		Title:       "Sums of dice",
		Description: "The exact distribution of the sum of n dice, by convolving one die with itself n times. Mean n(s+1)/2 and variance n(s²−1)/12 add up die by die; shade a tail to read P(sum ≥ k), and roll for real to compare.",
		Tags:        []string{"convolution", "expected value", "variance"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("prob-dice",
				probSVG("main", "0 0 560 320", "Exact distribution of the sum with simulated rolls"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Dice"),
					segs("Faces", [2]string{"6", "d6"}, [2]string{"4", "d4"}, [2]string{"8", "d8"}, [2]string{"20", "d20"}),
					field("n", "Number n", "", 2, 1, 10, 1),
					field("k", "Tail: sum ≥ k", "", 10, 1, 200, 1),
				),
				h.Div(h.Class("flex gap-2"), probButton("roll", "Roll 1,000 times", hugeicons.DiceIcon())),
				readouts([2]string{"mean", "mean"}, [2]string{"variance", "var"}, [2]string{"P(sum ≥ k)", "tail"}, [2]string{"most likely", "mode"}),
			)
		},
	}
}
