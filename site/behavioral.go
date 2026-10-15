package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// BehavioralBlocks lists the behavioral economics gallery in display
// order. The models are computed in static/js/behavioral.js: prospect
// theory (Tversky & Kahneman 1992), hyperbolic and quasi-hyperbolic
// discounting, a default-and-inertia population, a WTA/WTP market, the
// ultimatum and public goods games, and the secretary problem.
func BehavioralBlocks() []Block {
	return []Block{
		behavValueBlock(),
		behavLambdaBlock(),
		behavDiscountBlock(),
		behavProcrastinationBlock(),
		behavDefaultsBlock(),
		behavEndowmentBlock(),
		behavUltimatumBlock(),
		behavPublicGoodsBlock(),
		behavSecretaryBlock(),
		behavReplicationBlock(),
	}
}

func behavSvg(viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func behavButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func behavNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func behavLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }))
}

// ---------------------------------------------------------------- B1

func behavValueBlock() Block {
	return Block{
		Slug:        "prospect-theory",
		Title:       "Prospect theory: value and probability weights",
		Description: "People judge outcomes as gains and losses from a reference point, and losses loom larger. They also overweight small probabilities and underweight large ones. Both curves of cumulative prospect theory, with the parameters Tversky and Kahneman estimated in 1992; change them and see what a coin flip is worth.",
		Tags:        []string{"Tversky & Kahneman", "loss aversion", "weighting"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-value",
				h.Div(h.Class("flex flex-col gap-3"),
					behavSvg("0 0 640 290", "Left: the value function over gains and losses. Right: the probability weighting function."),
					behavLegend([2]string{"var(--brand)", "prospect theory"}, [2]string{"var(--muted-foreground)", "expected value (linear)"}),
					h.Div(h.Class("grid gap-2 px-1 text-sm sm:grid-cols-2"),
						mathBlock(mrow(mi("v"), mo("("), mi("x"), mo(")"), mo("="),
							h.El("mrow", msup(mi("x"), mi("α")), mtext(" if x ≥ 0, "), mo("−"), mi("λ"), msup(mrow(mo("("), mo("−"), mi("x"), mo(")")), mi("α"))))),
						mathBlock(mrow(mi("w"), mo("("), mi("p"), mo(")"), mo("="),
							mfrac(msup(mi("p"), mi("γ")), msup(mrow(mo("("), msup(mi("p"), mi("γ")), mo("+"), msup(mrow(mo("("), mn("1"), mo("−"), mi("p"), mo(")")), mi("γ")), mo(")")), mrow(mn("1"), mo("/"), mi("γ")))))),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("alpha", "Curvature α", "", 0.88, 0.2, 1.2, 0.01),
					field("lambda", "Loss aversion λ", "", 2.25, 0.5, 5, 0.05),
					field("gamma", "Weighting γ", "", 0.61, 0.3, 1.5, 0.01),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "0.88 2.25 0.61"), "Tversky & Kahneman 1992"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "1 1 1"), "Expected value"),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("A gamble"),
					field("p", "Chance to win", "%", 50, 1, 99, 1),
					field("win", "Win", "€", 100, 1, 1000, 1),
					field("lose", "Lose", "€", 100, 0, 1000, 1),
				),
				readouts([2]string{"value of the gamble", "V"}, [2]string{"w(p) / w(1−p)", "w"}, [2]string{"expected value", "ev"}, [2]string{"verdict", "verdict"}),
				behavNote("Tversky & Kahneman (1992), Advances in prospect theory, J. Risk and Uncertainty 5:297–323. They estimated γ = 0.61 for gains and 0.69 for losses; one γ is used here for both."),
			)
		},
	}
}

// ---------------------------------------------------------------- B2

var behavLambdaRows = []int{100, 120, 140, 160, 180, 200, 225, 250, 300, 400}

func behavLambdaBlock() Block {
	return Block{
		Slug:        "loss-aversion",
		Title:       "Measure your own loss aversion",
		Description: "A multiple price list: ten coin flips that lose €100 on heads and win more and more on tails. Accept or reject each one. Where you switch from rejecting to accepting brackets your loss-aversion coefficient λ, assuming a euro gained and a euro lost are otherwise valued alike.",
		Tags:        []string{"price list", "elicitation", "λ"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("behav-lambda", ""), h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"),
				h.Div(h.Class("flex min-w-0 flex-col border-b lg:border-r lg:border-b-0"),
					h.Div(h.Class("grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b bg-muted/40 px-4 py-2 font-mono text-[11px] text-muted-foreground"),
						h.Span("#"), h.Span("50% lose €100 · 50% win"), h.Span("your choice")),
					h.Ol(h.Class("divide-y"),
						h.MapIdx(behavLambdaRows, func(i, x int) h.Node {
							return h.Li(h.Data("row", fmt.Sprint(x)), h.Class("grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-2 transition-colors duration-150 data-[mark]:bg-brand/5"),
								h.Span(h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprint(i+1)),
								h.Span(h.Class("text-sm"), "Win ", h.Span(h.Class("font-mono tabular-nums"), fmt.Sprintf("€%d", x))),
								h.Div(h.Class("flex gap-1 rounded-lg border p-0.5"), h.Role("group"), h.Aria("label", fmt.Sprintf("Gamble %d", i+1)),
									behavChoice("reject", "Reject"), behavChoice("accept", "Accept")),
							)
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-5 p-5"),
					panelLabel("Your λ"),
					h.P(h.Data("out", "lambda"), h.Aria("live", "polite"), h.Class("font-mono text-2xl whitespace-nowrap tabular-nums"), "—"),
					h.P(h.Data("out", "msg"), h.Class("min-h-10 text-sm text-muted-foreground"), "Answer every row, top to bottom."),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 280 92"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Your estimate on a scale with published estimates")),
					h.Div(h.Class("flex gap-2"),
						behavButton("fill", "Fill as λ = 2", hugeicons.MagicWand01Icon()),
						behavButton("clear", "Clear", hugeicons.Delete02Icon()),
					),
					behavNote("Meta-analytic mean λ ≈ 2 (Brown, Imai, Vieider & Camerer 2024, J. Economic Literature). A switch between €X and €Y gives X/100 < λ ≤ Y/100. Curvature, framing and stakes all move the estimate."),
				),
			)
		},
	}
}

func behavChoice(v, label string) h.Node {
	return h.Button(h.Type("button"), h.Data("choice", v), h.Aria("pressed", "false"),
		h.Class("rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground data-[choice=accept]:aria-pressed:bg-brand/15 data-[choice=accept]:aria-pressed:text-brand"),
		label)
}

// ---------------------------------------------------------------- B3

func behavDiscountBlock() Block {
	return Block{
		Slug:        "preference-reversal",
		Title:       "Hyperbolic discounting and preference reversal",
		Description: "€100 in 60 days or €110 a week later? From afar most people wait for the larger sum; when the smaller one is about to arrive, many grab it. Exponential discounting can never do that, because the ratio of the two values never changes. Hyperbolic discounting does: drag along the timeline and watch the curves cross.",
		Tags:        []string{"Ainslie", "Mazur", "time inconsistency"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-discount",
				h.Div(h.Class("flex flex-col gap-2"),
					behavSvg("0 0 640 300", "Present value of the smaller-sooner and larger-later rewards as the decision date approaches. Drag to move the decision date."),
					behavLegend([2]string{"var(--vec-u)", "smaller, sooner"}, [2]string{"var(--brand)", "larger, later"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Discounting"),
					segs("Model", [2]string{"hyper", "Hyperbolic"}, [2]string{"exp", "Exponential"}),
					field("k", "Rate k", "/day", 0.02, 0.001, 0.5, 0.001),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Rewards"),
					field("a", "Sooner", "€", 100, 1, 1000, 1),
					field("b", "Later", "€", 110, 1, 2000, 1),
					field("gap", "Extra wait", "days", 7, 1, 60, 1),
					field("now", "Decision on day", "", 0, 0, 60, 1),
				),
				readouts([2]string{"you choose", "choice"}, [2]string{"values today", "vals"}, [2]string{"reversal on day", "cross"}),
				behavNote("Hyperbolic: V = A / (1 + kD) (Mazur 1987). Exponential: V = A·e^(−kD). The sooner reward arrives on day 60; D is the remaining delay."),
			)
		},
	}
}

// ---------------------------------------------------------------- B4

func behavProcrastinationBlock() Block {
	return Block{
		Slug:        "procrastination",
		Title:       "Present bias: doing it now or later",
		Description: "A task must be done on one of four days, and it gets harder each day. A present-biased self weighs every future cost by β < 1 but today's in full, so tomorrow always looks cheaper. Compare three people: one with no present bias, a naive one who thinks tomorrow's self will be patient, and a sophisticated one who knows better. Switch to immediate rewards and the bias runs the other way.",
		Tags:        []string{"β–δ", "O'Donoghue & Rabin", "planning"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-procrast",
				h.Div(h.Class("flex flex-col gap-3 p-1"),
					h.Div(h.Data("grid", ""), h.Class("grid grid-cols-[5rem_repeat(4,minmax(0,1fr))] gap-1 text-xs sm:grid-cols-[7.5rem_repeat(4,minmax(0,1fr))] sm:gap-1.5")),
					h.P(h.Data("out", "story"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Situation"),
					segs("Situation", [2]string{"cost", "Costs now"}, [2]string{"reward", "Rewards now"}),
					field("beta", "Present bias β", "", 0.5, 0.1, 1, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Per day"),
					field("c1", "Day 1", "", 3, 0, 50, 1),
					field("c2", "Day 2", "", 5, 0, 50, 1),
					field("c3", "Day 3", "", 8, 0, 50, 1),
					field("c4", "Day 4", "", 13, 0, 50, 1),
				),
				behavNote("Example after O'Donoghue & Rabin (1999), Doing it now or later, AER 89:103–124, with δ = 1. Naive agents procrastinate on costs; sophisticates preproperate on rewards."),
			)
		},
	}
}

// ---------------------------------------------------------------- B5

func behavDefaultsBlock() Block {
	return Block{
		Slug:        "defaults",
		Title:       "Defaults and inertia",
		Description: "400 new employees, each with a private benefit from joining the pension plan and a private cost of filling in the form. Whoever finds the form costlier than the stakes stays with the default. Flip the default and the same people end up in very different places; active choice removes the default altogether.",
		Tags:        []string{"nudge", "opt-out", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-defaults",
				h.Div(h.Class("flex flex-col gap-2"),
					behavSvg("0 0 640 330", "400 people as dots: filled if enrolled, ringed if their choice goes against their own interest"),
					behavLegend([2]string{"var(--brand)", "enrolled"}, [2]string{"var(--muted-foreground)", "not enrolled"}, [2]string{"var(--code-del)", "ring: stuck against their interest"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Policy"),
					segs("Default", [2]string{"in", "Opt-in"}, [2]string{"out", "Opt-out"}, [2]string{"active", "Active choice"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Population"),
					field("share", "Would benefit", "%", 70, 1, 99, 1),
					field("inertia", "Effort of switching", "σ", 0.8, 0, 3, 0.05),
					behavButton("reseed", "New cohort", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"enrolled", "enrolled"}, [2]string{"stuck", "stuck"}, [2]string{"opt-in vs opt-out", "gap"}),
				behavNote("Madrian & Shea (2001), QJE 116:1149–1187: automatic enrolment raised 401(k) participation of new hires from 37% to 86%. Benefits are normal, switching costs exponential, both in units of the benefits' spread."),
			)
		},
	}
}

// ---------------------------------------------------------------- B6

func behavEndowmentBlock() Block {
	return Block{
		Slug:        "endowment",
		Title:       "The endowment effect: a mug market",
		Description: "Half the class is handed a mug, at random. If owning didn't change values, about half the mugs should change hands, since half the time the buyer values the mug more. In the classic experiments owners asked roughly twice what buyers would pay, and far fewer mugs traded. Raise the WTA/WTP ratio and watch the market dry up.",
		Tags:        []string{"WTA vs WTP", "Kahneman, Knetsch & Thaler", "market"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-endow",
				h.Div(h.Class("flex flex-col gap-2"),
					behavSvg("0 0 640 300", "Supply from owners' asking prices and demand from buyers' bids, with the number of trades"),
					behavLegend([2]string{"var(--brand)", "owners' asks (supply)"}, [2]string{"var(--vec-u)", "buyers' bids (demand)"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Class"),
					field("n", "Mugs handed out", "", 22, 4, 60, 1),
					field("ratio", "WTA / WTP", "×", 2.5, 1, 4, 0.05),
					behavButton("reseed", "New class", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"trades", "trades"}, [2]string{"without the effect", "coase"}, [2]string{"median ask", "wta"}, [2]string{"median bid", "wtp"}, [2]string{"price", "price"}),
				behavNote("Kahneman, Knetsch & Thaler (1990), JPE 98:1325–1348: median WTA $7.12 vs WTP $2.87 for a mug. Underlying values are uniform on €0–10, the same for owners and buyers; only ownership multiplies the ask."),
			)
		},
	}
}

// ---------------------------------------------------------------- B7

func behavUltimatumBlock() Block {
	return Block{
		Slug:        "ultimatum",
		Title:       "Ultimatum and dictator games",
		Description: "Split €10 with a stranger. In the ultimatum game they can reject, and then nobody gets anything; game theory says offer a cent, real responders refuse insulting offers. Find the offer that maximises what you expect to keep. In the dictator game they cannot refuse, and people still give.",
		Tags:        []string{"fairness", "game theory", "meta-analysis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-ultimatum",
				h.Div(h.Class("flex flex-col gap-2"),
					behavSvg("0 0 640 300", "Acceptance probability and proposer's expected payoff against the share offered"),
					h.Div(h.Data("legend", "ultimatum"), behavLegend([2]string{"var(--vec-u)", "chance the responder accepts"}, [2]string{"var(--brand)", "what you expect to keep"})),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Game"),
					segs("Game", [2]string{"ultimatum", "Ultimatum"}, [2]string{"dictator", "Dictator"}),
					field("offer", "You offer", "%", 30, 0, 100, 1),
				),
				h.Div(h.Data("ult-only", ""), h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Responders"),
					field("mid", "Half reject below", "%", 20, 0, 50, 1),
					behavButton("play", "Offer to 20 strangers", hugeicons.UserGroupIcon()),
					h.P(h.Data("out", "plays"), h.Class("min-h-5 font-mono text-xs text-muted-foreground")),
				),
				readouts([2]string{"P(accept)", "pa"}, [2]string{"you expect", "ep"}, [2]string{"best offer", "best"}),
				behavNote("Offers under 20% are rejected about half the time (Camerer 2003, Behavioral Game Theory). Ultimatum meta-analysis: mean offer 40%, 16% rejected (Oosterbeek, Sloof & van de Kuilen 2004). Dictator meta-analysis: mean gift 28%; 36% give nothing, 17% give half, 5% give all (Engel 2011)."),
			)
		},
	}
}

// ---------------------------------------------------------------- B8

func behavPublicGoodsBlock() Block {
	return Block{
		Slug:        "public-goods",
		Title:       "Public goods game, with and without punishment",
		Description: "Four players get 20 tokens a round. Every token put in the pot returns 0.4 to each player, so the group gains from giving but each player gains from keeping. You play with three bots: two conditional cooperators who match what others gave, and one free rider. Without punishment, cooperation unravels; let players pay to punish and it holds.",
		Tags:        []string{"cooperation", "Fehr & Gächter", "play"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-pgg",
				h.Div(h.Class("flex flex-col gap-2"),
					behavSvg("0 0 640 300", "Each player's contribution by round"),
					behavLegend([2]string{"var(--brand)", "you"}, [2]string{"var(--vec-u)", "cooperator A"}, [2]string{"var(--vec-v)", "cooperator B"}, [2]string{"var(--muted-foreground)", "free rider"}),
					h.P(h.Data("out", "log"), h.Aria("live", "polite"), h.Class("min-h-5 px-1 font-mono text-xs text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rules"),
					segs("Punishment", [2]string{"off", "No punishment"}, [2]string{"on", "Punishment"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Your move"),
					field("give", "Contribute", "tokens", 10, 0, 20, 1),
					field("punish", "Punish lowest", "points", 2, 0, 10, 1),
					h.Div(h.Class("flex flex-wrap gap-2"),
						behavButton("round", "Play round", hugeicons.PlayIcon()),
						behavButton("auto", "Play to the end", hugeicons.Forward02Icon()),
						behavButton("reset", "Reset", hugeicons.RefreshIcon()),
					),
				),
				readouts([2]string{"round", "round"}, [2]string{"your earnings", "earn"}, [2]string{"group average", "avg"}, [2]string{"all give 20", "opt"}),
				behavNote("Parameters from Fehr & Gächter (2000), AER 90:980–994: groups of four, 20 tokens, return 0.4, 10 rounds; a punishment point costs 1 and removes 3. About half of people are conditional cooperators and a third free riders (Fischbacher, Gächter & Fehr 2001). The bots follow simple rules, not data."),
			)
		},
	}
}

// ---------------------------------------------------------------- B9

func behavSecretaryBlock() Block {
	return Block{
		Slug:        "secretary",
		Title:       "When to stop looking: the secretary problem",
		Description: "Candidates arrive one at a time and you must hire or reject each on the spot. The best strategy for picking the very best one: look at the first 37% without hiring, then take the first who beats them all. Settling for anyone in the top 10%, a satisficing goal, calls for a much shorter search. Then play it yourself.",
		Tags:        []string{"optimal stopping", "1/e", "satisficing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("behav-secretary",
				h.Div(h.Class("flex flex-col gap-3"),
					behavSvg("0 0 640 260", "Probability of success against the length of the look phase"),
					behavLegend([2]string{"var(--brand)", "hire the best (exact)"}, [2]string{"var(--vec-u)", "hire someone in the top 10% (simulated)"}),
					h.Div(h.Class("flex flex-col gap-2 border-t px-1 pt-3"),
						h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
							h.Span(h.Class("text-sm"), "Play: 20 candidates, scores 0–100"),
							h.Div(h.Class("flex gap-2"),
								behavButton("next", "Next", hugeicons.ArrowRight01Icon()),
								button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "hire"), h.Class("text-brand"), hugeicons.CheckmarkCircle02Icon(), "Hire"),
								behavButton("new", "New game", hugeicons.RefreshIcon()),
							),
						),
						h.Div(h.Data("strip", ""), h.Class("grid grid-cols-10 gap-1 sm:grid-cols-20")),
						h.P(h.Data("out", "game"), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Strategy"),
					field("n", "Candidates", "", 20, 3, 100, 1),
					field("r", "Look at first", "", 7, 0, 99, 1),
				),
				readouts([2]string{"P(best)", "pbest"}, [2]string{"P(top 10%)", "ptop"}, [2]string{"best look phase", "rstar"}, [2]string{"your games", "games"}),
				behavNote("P(best | look at r of n) = (r/n) Σ 1/(i−1) for i = r+1…n, which peaks near r = n/e with value 1/e ≈ 37% (Ferguson 1989, Statistical Science 4:282–296). Simon (1955) called aiming for good enough satisficing."),
			)
		},
	}
}

// ---------------------------------------------------------------- B10

type behavFinding struct {
	effect, original, followup, status, label string
}

var behavFindings = []behavFinding{
	{"Loss aversion", "Kahneman & Tversky (1979); λ = 2.25 in Tversky & Kahneman (1992)",
		"Gal & Rucker (2018) argue it is overstated; a meta-analysis of hundreds of estimates finds λ near 2 but very dispersed (Brown, Imai, Vieider & Camerer 2024).", "debated", "Holds, size debated"},
	{"Default effects", "Madrian & Shea (2001); Johnson & Goldstein (2003) on organ donation",
		"A meta-analysis of 58 studies finds a medium effect, larger for consumer choices than for environmental ones (Jachimowicz et al. 2019).", "robust", "Robust"},
	{"Present bias", "Laibson (1997); DellaVigna & Malmendier (2006) on gym contracts",
		"Little present bias over money but clear present bias over effort (Augenblick, Niederle & Sprenger 2015).", "robust", "Robust, domain-dependent"},
	{"Ultimatum rejections", "Güth, Schmittberger & Schwarze (1982)",
		"Replicated across many countries; offers and rejections vary across 15 small-scale societies (Henrich et al. 2001).", "robust", "Robust"},
	{"Endowment effect", "Kahneman, Knetsch & Thaler (1990)",
		"The WTA–WTP gap vanished with careful procedures (Plott & Zeiler 2005); the reply finds it persists for some goods (Isoni, Loomes & Sugden 2011).", "debated", "Debated"},
	{"Nudges, overall", "Thaler & Sunstein (2008)",
		"A meta-analysis reports d ≈ 0.43 (Mertens et al. 2022); corrected for publication bias, evidence for an average effect disappears (Maier et al. 2022).", "debated", "Debated"},
	{"Decoy effect", "Huber, Payne & Puto (1982)",
		"Largely absent when options are described by qualitative or perceptual attributes (Frederick, Lee & Baskin 2014).", "debated", "Fragile"},
	{"Choice overload", "Iyengar & Lepper (2000), the jam study",
		"Meta-analytic mean effect near zero, with large variation between studies (Scheibehenne, Greifeneder & Todd 2010).", "failed", "Weak on average"},
	{"Money priming", "Vohs, Mead & Goode (2006)",
		"Currency priming failed in Many Labs 1 (Klein et al. 2014) and in direct replications (Rohrer, Pashler & Harris 2015).", "failed", "Failed"},
	{"Sign-at-the-top honesty pledge", "Shu, Mazar, Gino, Ariely & Bazerman (2012), PNAS",
		"Failed to replicate (Kristal et al. 2020); the field data were found to be fabricated and the paper was retracted in 2021.", "failed", "Retracted"},
}

func behavReplicationBlock() Block {
	return Block{
		Slug:        "replication",
		Title:       "What held up in behavioral economics",
		Description: "A field built on surprising findings has had to check them. Each card gives the original study, what later work found and a verdict. Filter by status; before teaching a finding, look it up here.",
		Tags:        []string{"replication", "meta-analysis", "sources"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("behav-replication", ""), h.Class("flex flex-col gap-4"),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Filter", [2]string{"all", "All"}, [2]string{"robust", "Robust"}, [2]string{"debated", "Debated"}, [2]string{"failed", "Weak or failed"}),
					h.Span(h.Data("out", "count"), h.Class("font-mono text-xs text-muted-foreground"), fmt.Sprintf("%d findings", len(behavFindings))),
				),
				h.Ul(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Map(behavFindings, func(f behavFinding) h.Node {
						return h.Li(h.Data("status", f.status), h.Class("flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-xs transition-[opacity,transform] duration-200 ease-[var(--ease-out)] starting:opacity-0"),
							h.Div(h.Class("flex items-start justify-between gap-3"),
								h.H3(h.Class("text-sm font-medium"), f.effect),
								behavStatus(f.status, f.label),
							),
							h.P(h.Class("font-mono text-[11px] text-muted-foreground"), f.original),
							h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), f.followup),
						)
					}),
				),
			)
		},
	}
}

func behavStatus(status, label string) h.Node {
	cls := "shrink-0 font-mono text-[11px] font-normal "
	switch status {
	case "robust":
		cls += "border-add/40 text-add"
	case "debated":
		cls += "border-mod/40 text-mod"
	default:
		cls += "border-del/40 text-del"
	}
	return badge.Badge(badge.VariantOutline, h.Class(cls), label)
}
