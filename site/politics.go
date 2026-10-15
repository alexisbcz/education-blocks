package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PoliticsBlocks lists the voting and political science gallery in display
// order. Every voter, party and state here is synthetic.
func PoliticsBlocks() []Block {
	return []Block{
		polMethodsBlock(),
		polCondorcetBlock(),
		polArrowBlock(),
		polSpatialBlock(),
		polStrategicBlock(),
		polApportionBlock(),
		polAlabamaBlock(),
		polGerrymanderBlock(),
		polPollingBlock(),
		polSystemsBlock(),
	}
}

func polButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func polNote(s ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, s...)...)
}

// ---------------------------------------------------------------- P1

// polProfile is the default ballot profile: plurality, instant runoff and
// Condorcet methods each pick a different winner.
var polProfile = []struct {
	n     int
	order string
}{{40, "A>B>C"}, {35, "C>B>A"}, {25, "B>C>A"}}

func polMethodsBlock() Block {
	return Block{
		Slug:        "voting-methods",
		Title:       "One profile, many winners",
		Description: "The same ballots counted eight ways. With the default profile, plurality elects A, instant runoff elects C and every Condorcet method elects B: the rule, not the voters, decides. Edit the groups (orders like A>B>C, up to five candidates) and watch the table.",
		Tags:        []string{"plurality", "IRV", "Borda", "Condorcet"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"), h.Data("pol-methods", ""),
				h.Div(h.Class("flex flex-col gap-4 border-b p-5 lg:border-r lg:border-b-0"),
					panelLabel("Ballot profile (synthetic)"),
					h.Div(h.Data("rows", ""), h.Class("flex flex-col gap-2"),
						h.MapIdx(polProfile, func(i int, r struct {
							n     int
							order string
						}) h.Node {
							return polProfileRow(i, r.n, r.order)
						}),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						polButton("add", "Add group", hugeicons.Add01Icon()),
						polButton("reset", "Reset", hugeicons.RefreshIcon()),
					),
					h.Template(h.Data("row-template", ""), polProfileRow(0, 10, "A>B>C")),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
						field("approve", "Approve top", "", 1, 1, 4, 1),
					),
					h.P(h.Data("out", "error"), h.Aria("live", "polite"), h.Class("min-h-4 text-xs text-del")),
					polNote("Score and STAR turn a ranking into scores 5 for first down to 0 for last, spaced evenly. Ties in a count go to the earlier letter."),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 bg-code p-5"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[440px] text-sm"),
							h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
								h.Th(h.Class("py-2 pr-3 font-normal"), "Method"),
								h.Th(h.Class("py-2 pr-3 font-normal"), "Winner"),
								h.Th(h.Class("py-2 font-normal"), "How it was decided"),
							)),
							h.Tbody(h.Data("results", "")),
						),
					),
					h.Div(h.Data("summary", ""), h.Class("flex flex-wrap gap-2")),
				),
			)
		},
	}
}

func polProfileRow(i, n int, order string) h.Node {
	return h.Div(h.Data("row", ""), h.Class("flex items-center gap-2"),
		h.Input(h.Type("number"), h.Data("count", ""), h.Value(fmt.Sprint(n)), h.Attr("min", "0"), h.Attr("max", "999"), h.Aria("label", "Number of voters"),
			h.Class("h-8 w-20 rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
		h.Span(h.Class("text-xs text-muted-foreground"), "voters rank"),
		h.Input(h.Type("text"), h.Data("order", ""), h.Value(order), h.Aria("label", "Ranking, best first"),
			h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "characters"), h.Attr("spellcheck", "false"),
			h.Class("h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-del sm:text-sm")),
		button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("action", "remove"), h.Aria("label", "Remove group"),
			hugeicons.Delete02Icon()),
	)
}

// ---------------------------------------------------------------- P2

var polRankings3 = []string{"A>B>C", "A>C>B", "B>A>C", "B>C>A", "C>A>B", "C>B>A"}

func polCondorcetBlock() Block {
	return Block{
		Slug:        "condorcet",
		Title:       "Condorcet's paradox",
		Description: "Majorities need not be transitive. Each of the six possible rankings of three candidates gets a number of voters; an arrow means a majority prefers one candidate to the other. When the arrows go round in a circle, every candidate loses to someone, as the Marquis de Condorcet noticed in 1785.",
		Tags:        []string{"pairwise", "majority cycle"},
		Render: func() h.Node {
			defaults := []float64{1, 0, 0, 1, 1, 0}
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("pol-condorcet", ""),
				h.Div(h.Class("grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("Voters per ranking"),
						h.MapIdx(polRankings3, func(i int, r string) h.Node {
							return field(fmt.Sprintf("r%d", i), r, "", defaults[i], 0, 50, 1)
						}),
						h.Div(h.Class("flex flex-wrap gap-2 pt-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "1 0 0 1 1 0"), "Cycle"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "4 0 0 3 0 2"), "Winner"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "2 0 0 2 0 0"), "Tie"),
						),
					),
					h.Div(h.Class("flex flex-col items-center gap-3"),
						h.Svg(h.Data("graph", ""), h.ViewBox("0 0 260 230"), h.Class("block w-full max-w-[300px]"), h.Role("img"), h.Aria("label", "Majority graph between A, B and C")),
						h.Div(h.Data("matrix", ""), h.Class("w-full")),
					),
				),
				h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("rounded-lg border bg-code px-3 py-2 text-sm")),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func polArrowBlock() Block {
	return Block{
		Slug:        "arrow",
		Title:       "Arrow's theorem, tested",
		Description: "Kenneth Arrow (1951): with three or more candidates, no ranked rule satisfies unrestricted domain, Pareto efficiency, independence of irrelevant alternatives and non-dictatorship all at once. This block does not prove it; it finds, for each common rule, a profile where removing a losing candidate flips the order of two others.",
		Tags:        []string{"social choice", "IIA", "spoiler"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("pol-arrow", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Rule", [2]string{"plurality", "Plurality"}, [2]string{"borda", "Borda"}, [2]string{"irv", "Instant runoff"}),
					h.Label(h.Class("flex items-center gap-2 text-sm"),
						h.Input(h.Type("checkbox"), h.Data("drop", ""), h.Class("size-4 accent-[var(--brand)]")),
						"Remove the third candidate"),
				),
				h.Div(h.Class("grid gap-4 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"),
						panelLabel("Profile"),
						h.Ul(h.Data("profile", ""), h.Class("flex flex-col gap-1 font-mono text-sm")),
					),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"),
						panelLabel("Social ranking"),
						h.Ol(h.Data("ranking", ""), h.Class("flex flex-col gap-1 font-mono text-sm")),
					),
				),
				h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("rounded-lg border px-3 py-2 text-sm")),
				h.Ul(h.Class("grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"),
					polArrowCondition("Unrestricted domain", "Any set of individual rankings is allowed."),
					polArrowCondition("Pareto efficiency", "If everyone prefers X to Y, so does society."),
					polArrowCondition("Independence of irrelevant alternatives", "Society's order of X and Y depends only on how voters rank X and Y."),
					polArrowCondition("Non-dictatorship", "No single voter always decides."),
				),
				polNote("Ranked rules only: Arrow's theorem is about rankings. Cardinal methods such as approval or score voting sit outside it, though Gibbard's theorem (1973) still shows that any deterministic rule with three or more possible outcomes either rewards tactical voting in some situation or is dictatorial; Satterthwaite (1975) proved the ranked-ballot case independently."),
			)
		},
	}
}

func polArrowCondition(title, body string) h.Node {
	return h.Li(h.Class("rounded-lg border p-2.5"), h.Span(h.Class("block font-medium text-foreground"), title), body)
}

// ---------------------------------------------------------------- P4

func polSpatialBlock() Block {
	return Block{
		Slug:        "spatial",
		Title:       "Spatial voting",
		Description: "Voters as points on two issue axes, each voting for the nearest candidate. Drag the candidates: plurality shares change with every move, and a candidate placed between two others can be squeezed out even if a majority prefers them to either rival. Below, the one-dimensional case: two candidates converge on the median voter (Black 1948, Downs 1957).",
		Tags:        []string{"Downs", "median voter", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pol-spatial",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plane", ""), h.ViewBox("0 0 420 320"), h.Class("mx-auto block w-full max-w-[560px] touch-none select-none"), h.Role("img"),
						h.Aria("label", "Synthetic voters on two issue axes, coloured by nearest candidate; drag the candidates")),
					h.Svg(h.Data("line", ""), h.ViewBox("0 0 420 90"), h.Class("mx-auto block w-full max-w-[560px] touch-none select-none"), h.Role("img"),
						h.Aria("label", "One-dimensional electorate with two candidates and the median voter")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Candidates"),
					segs("Number of candidates", [2]string{"3", "Three"}, [2]string{"4", "Four"}, [2]string{"2", "Two"}),
				),
				h.Div(h.Data("shares", ""), h.Class("flex flex-col gap-1.5 border-t pt-4")),
				readouts([2]string{"plurality winner", "plurality"}, [2]string{"Condorcet winner", "condorcet"}, [2]string{"1D winner", "median"}),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					polButton("reseed", "New voters", hugeicons.ShuffleIcon()),
					polButton("converge", "Converge (1D)", hugeicons.ArrowRight01Icon())),
				polNote("400 synthetic voters in two loose clusters. Candidates move by pointer or arrow keys once focused."),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func polStrategicBlock() Block {
	return Block{
		Slug:        "strategic",
		Title:       "Strategic voting",
		Description: "Forty voters rank A > B > C, thirty-five rank C > B > A, twenty-five rank B > C > A. Under instant runoff, B is eliminated first and C wins, the A voters' last choice. If some of them rank B first instead, B survives and wins. Slide how many defect.",
		Tags:        []string{"IRV", "tactical voting", "Gibbard–Satterthwaite"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("pol-strategic", ""),
				h.Div(h.Class("grid gap-4 sm:grid-cols-[240px_minmax(0,1fr)]"),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("A voters who rank B first"),
						field("defect", "Defectors", "of 40", 0, 0, 40, 1),
						segs("Count", [2]string{"irv", "Instant runoff"}, [2]string{"plurality", "Plurality"}),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Div(h.Data("rounds", ""), h.Class("flex flex-col gap-3")),
					),
				),
				h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("rounded-lg border bg-code px-3 py-2 text-sm")),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

var polParties = []struct {
	name  string
	votes int
}{{"Party 1", 100000}, {"Party 2", 80000}, {"Party 3", 30000}, {"Party 4", 20000}}

func polApportionBlock() Block {
	return Block{
		Slug:        "apportionment",
		Title:       "Seats from votes",
		Description: "Four ways of turning votes into whole seats, in exact arithmetic: largest remainder (Hamilton), D'Hondt (Jefferson), Sainte-Laguë (Webster) and Huntington–Hill. D'Hondt favours large parties, Sainte-Laguë is closer to proportional. Add a legal threshold and small parties vanish.",
		Tags:        []string{"D'Hondt", "Sainte-Laguë", "threshold"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pol-apportion",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[520px] text-sm"),
							h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
								h.Th(h.Class("py-2 pr-3 font-normal"), "Party (synthetic)"),
								h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Votes"),
								h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Share"),
								h.Th(h.Class("py-2 pr-2 text-right font-normal"), "Hamilton"),
								h.Th(h.Class("py-2 pr-2 text-right font-normal"), "D'Hondt"),
								h.Th(h.Class("py-2 pr-2 text-right font-normal"), "S-Laguë"),
								h.Th(h.Class("py-2 text-right font-normal"), "H-Hill"),
							)),
							h.Tbody(h.Data("rows", ""),
								h.MapIdx(polParties, func(i int, p struct {
									name  string
									votes int
								}) h.Node {
									return h.Tr(h.Data("party", fmt.Sprint(i)), h.Class("border-b last:border-b-0"),
										h.Td(h.Class("py-1.5 pr-3"), h.Span(h.Class("flex items-center gap-2"),
											h.Span(h.Class("size-2.5 rounded-full"), h.Style(fmt.Sprintf("background:%s", polColor(i)))), p.name)),
										h.Td(h.Class("py-1.5 pr-3 text-right"),
											h.Input(h.Type("number"), h.Data("votes", ""), h.Value(fmt.Sprint(p.votes)), h.Attr("min", "0"), h.Attr("step", "1000"), h.Aria("label", "Votes for "+p.name),
												h.Class("h-8 w-28 rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"))),
										h.Td(h.Data("share", ""), h.Class("py-1.5 pr-3 text-right font-mono text-xs text-muted-foreground tabular-nums")),
										h.Td(h.Data("m", "hamilton"), h.Class("py-1.5 pr-2 text-right font-mono tabular-nums")),
										h.Td(h.Data("m", "dhondt"), h.Class("py-1.5 pr-2 text-right font-mono tabular-nums")),
										h.Td(h.Data("m", "webster"), h.Class("py-1.5 pr-2 text-right font-mono tabular-nums")),
										h.Td(h.Data("m", "hill"), h.Class("py-1.5 text-right font-mono tabular-nums")),
									)
								}),
							),
						),
					),
					h.Svg(h.Data("bars", ""), h.ViewBox("0 0 560 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Seat shares by method against vote shares")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Assembly"),
					field("seats", "Seats", "", 8, 1, 60, 1),
					field("threshold", "Threshold", "%", 0, 0, 20, 0.5),
				),
				readouts([2]string{"Gallagher index", "lsq"}, [2]string{"excluded votes", "wasted"}),
				polNote("Huntington–Hill here gives every party at least one seat first, as it does for states in the US House; with fewer seats than parties it is skipped. Gallagher's least-squares index is for Sainte-Laguë. Ties go to the larger vote."),
			)
		},
	}
}

// polColor is the i-th candidate or party colour (synthetic groups only).
func polColor(i int) string {
	return []string{"var(--vec-u)", "var(--brand)", "var(--ion-cl)", "var(--vec-out)", "var(--ion-k)", "var(--ion-na)"}[i%6]
}

// ---------------------------------------------------------------- P7

func polAlabamaBlock() Block {
	return Block{
		Slug:        "alabama-paradox",
		Title:       "The Alabama paradox",
		Description: "Under Hamilton's method, adding a seat to the house can take a seat away from a state. It was noticed in 1880, when a 299-seat house gave Alabama 8 seats and a 300-seat one gave it 7. Three synthetic states show it: grow the house from 10 to 11 and state C loses a seat.",
		Tags:        []string{"Hamilton", "paradox", "exact"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("pol-alabama", ""),
				h.Div(h.Class("grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]"),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("Populations (synthetic)"),
						field("pa", "State A", "", 6000, 100, 20000, 100),
						field("pb", "State B", "", 6000, 100, 20000, 100),
						field("pc", "State C", "", 2000, 100, 20000, 100),
						field("house", "House", "seats", 10, 3, 30, 1),
					),
					h.Svg(h.Data("chart", ""), h.ViewBox("0 0 440 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Hamilton seats for each state against house size; paradoxes ringed")),
				),
				h.Div(h.Data("table", ""), h.Class("scroll-thin overflow-x-auto")),
				h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("rounded-lg border bg-code px-3 py-2 text-sm")),
				polNote("Divisor methods (D'Hondt, Sainte-Laguë, Huntington–Hill) are house-monotone and never show this paradox; Balinski and Young (1982) proved that no method can avoid every paradox while always staying within its quota."),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func polGerrymanderBlock() Block {
	return Block{
		Slug:        "gerrymandering",
		Title:       "Drawing districts",
		Description: "The same 64 neighbourhoods, split into eight districts three ways. Pick a district, then paint cells: districts must be contiguous and hold eight cells each. Packing and cracking turn a narrow vote majority into a lopsided seat count, and the efficiency gap measures the wasted votes.",
		Tags:        []string{"packing", "cracking", "efficiency gap"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pol-gerry",
				h.Div(h.Class("flex flex-col items-center gap-3"),
					h.Div(h.Data("grid", ""), h.Class("grid aspect-square w-full max-w-[420px] grid-cols-8 gap-px overflow-hidden rounded-lg border bg-border select-none"),
						h.Role("grid"), h.Aria("label", "Neighbourhoods; click to assign to the selected district")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "Blue majority"), legendSwatch("var(--brand)", "Pink majority")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Maps"),
					segs("Preset map", [2]string{"columns", "Columns"}, [2]string{"rows", "Rows"}, [2]string{"packed", "Packed"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Paint district"),
					h.Div(h.Data("palette", ""), h.Class("grid grid-cols-4 gap-1.5"),
						h.Range(8, func(i int) h.Node {
							return h.Button(h.Type("button"), h.Data("district", fmt.Sprint(i)), h.Aria("pressed", fmt.Sprint(i == 0)),
								h.Class("h-8 rounded-md border font-mono text-xs transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand"),
								fmt.Sprint(i+1))
						}),
					),
				),
				h.Div(h.Data("districts", ""), h.Class("flex flex-col gap-1 border-t pt-4 font-mono text-xs")),
				readouts([2]string{"votes", "votes"}, [2]string{"seats", "seats"}, [2]string{"efficiency gap", "gap"}, [2]string{"map", "valid"}),
				polNote("Each cell is 100 synthetic voters. Wasted votes are every vote for a loser plus a winner's votes beyond 50% + 1 of the district; the gap is (pink wasted − blue wasted) ÷ all votes."),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

func polPollingBlock() Block {
	return Block{
		Slug:        "polling",
		Title:       "Margins of error",
		Description: "What a poll's ± means. The margin of error of one share, of the lead between two candidates in the same poll (wider than you might think), and the sample size a target margin needs, with a design effect for weighting. Only random sampling error: no formula fixes a biased sample.",
		Tags:        []string{"confidence", "sample size", "design effect"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pol-polling",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Margin of error against sample size")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Poll"),
					field("n", "Sample", "people", 1000, 50, 20000, 50),
					field("p1", "Candidate 1", "%", 48, 0, 100, 0.5),
					field("p2", "Candidate 2", "%", 44, 0, 100, 0.5),
					field("deff", "Design effect", "", 1, 1, 3, 0.05),
					segs("Confidence", [2]string{"95", "95%"}, [2]string{"90", "90%"}, [2]string{"99", "99%"}),
				),
				readouts([2]string{"effective n", "neff"}, [2]string{"± share 1", "moe1"}, [2]string{"lead", "lead"}, [2]string{"± lead", "moelead"}, [2]string{"verdict", "verdict"}, [2]string{"n for ±2 pts", "need"}),
				polNote("Margin of a share: z·√(p(1−p)/n_eff). Margin of the lead p₁ − p₂ in one poll: z·√((p₁ + p₂ − (p₁ − p₂)²)/n_eff). The survey-sampling block in Sociology simulates how samples go wrong."),
			)
		},
	}
}

// ---------------------------------------------------------------- P10

type polStep struct{ title, body string }

var polBillSteps = []polStep{
	{"Drafting and introduction", "A member, a committee or the government introduces a bill; it is given a number and a first reading."},
	{"Committee", "A committee studies the bill, hears witnesses and may amend it. Most bills stop here."},
	{"First chamber vote", "After debate on the floor, the chamber votes. A simple majority of those voting usually passes it."},
	{"Second chamber", "In a bicameral legislature, the other chamber repeats the process and may amend the bill."},
	{"Reconciling the texts", "If the chambers passed different versions, a joint committee or a back-and-forth (shuttle) settles one text."},
	{"Executive assent", "The head of state or government signs it, or (in some systems) vetoes it and sends it back."},
	{"Override or review", "Some legislatures can override a veto with a supermajority; courts may later review whether the law is constitutional."},
	{"Promulgation", "The law is published officially and takes effect on the date it sets."},
}

func polSystemsBlock() Block {
	return Block{
		Slug:        "systems",
		Title:       "How a bill becomes law",
		Description: "A generic legislative process, step by step, and the two main ways of arranging executive and legislature. Real countries differ in every detail: treat this as a map of the questions to ask about any one of them.",
		Tags:        []string{"stepper", "separation of powers", "generic"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("pol-systems", ""), h.TabIndex(0),
				h.Aria("label", "Legislative process; use the arrow keys to step"),
				h.Ol(h.Class("grid grid-cols-8 gap-1"), h.Aria("hidden", "true"),
					h.Range(len(polBillSteps), func(i int) h.Node {
						return h.Li(h.Data("pip", fmt.Sprint(i)), h.Class("h-1.5 rounded-full bg-foreground/10 transition-colors duration-200 data-[on]:bg-brand"), h.If(i == 0, h.Data("on", "")))
					}),
				),
				h.Div(h.Class("grid"),
					h.MapIdx(polBillSteps, func(i int, s polStep) h.Node {
						return h.Div(h.Data("step", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col gap-1.5 rounded-lg border bg-code p-4"),
							h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), fmt.Sprintf("Step %d of %d", i+1, len(polBillSteps))),
							h.Span(h.Class("text-base font-medium"), s.title),
							h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), s.body),
						)
					}),
				),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
				),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					polSystemCard("Parliamentary", hugeicons.Building03Icon(), []string{
						"The government is drawn from, and answers to, the legislature.",
						"It can fall on a vote of no confidence; elections may come early.",
						"Head of state (monarch or president) is often separate and largely ceremonial.",
					}),
					polSystemCard("Presidential", hugeicons.Legal01Icon(), []string{
						"The president is elected separately and serves a fixed term.",
						"The legislature cannot dismiss the president for policy reasons; removal needs impeachment.",
						"Separation of powers relies on checks: vetoes, overrides, confirmations, judicial review.",
					}),
				),
				polNote("Semi-presidential systems mix the two, with both a directly elected president and a prime minister answerable to parliament."),
			)
		},
	}
}

func polSystemCard(title string, icon h.Node, points []string) h.Node {
	return h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-4"),
		h.Div(h.Class("flex items-center gap-2"),
			h.Span(h.Class("text-muted-foreground [&_svg]:size-4"), icon),
			h.Span(h.Class("font-medium"), title),
			badge.Badge(badge.VariantOutline, h.Class("ml-auto font-normal text-muted-foreground"), "generic")),
		h.Ul(h.Class("flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground"),
			h.Map(points, func(p string) h.Node { return h.Li(p) })),
	)
}
