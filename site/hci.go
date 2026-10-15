package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// HciBlocks lists the HCI & UX research gallery: laws of movement measured
// on the learner's own pointer, models that predict task time, and the
// statistics of small usability studies and A/B tests. Everything is
// computed in the page; no response leaves it.
func HciBlocks() []Block {
	return []Block{
		hciFittsBlock(),
		hciSteerBlock(),
		hciKlmBlock(),
		hciFoundBlock(),
		hciSusBlock(),
		hciTimeBlock(),
		hciAbBlock(),
		hciPeekBlock(),
		hciSortBlock(),
		hciHeuristicsBlock(),
	}
}

func hciButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// hciNote is the small print under a block's controls.
func hciNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

const hciSelectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

// ---------------------------------------------------------------- H1

func hciFittsBlock() Block {
	return Block{
		Slug:        "fitts",
		Title:       "Fitts's law, measured on you",
		Description: "Click back and forth between two bars as fast as you can without missing. Far, thin targets take longer: movement time grows with the index of difficulty ID = log₂(D/W + 1) in bits (Fitts 1954, in MacKenzie's Shannon form, 1992). The block fits MT = a + b·ID to your own clicks and reports your throughput.",
		Tags:        []string{"experiment", "your data", "least squares"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hci-fitts",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("rounded-lg border bg-background"),
						h.Svg(h.Data("arena", ""), h.ViewBox("0 0 600 160"), h.Class("block w-full touch-none select-none"), h.Role("img"),
							h.Aria("label", "Two target bars. Click the highlighted bar.")),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Mean movement time against index of difficulty, with the fitted line")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Session"),
					h.P(h.Data("prompt", ""), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground"),
						"9 conditions (3 distances × 3 widths), 6 clicks each. Press Start, then click the pink bar."),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					hciButton("start", "Start", hugeicons.PlayIcon()),
					hciButton("clear", "Clear", hugeicons.RefreshIcon()),
				),
				hciButton("simulate", "Simulate a participant", hugeicons.UserGroupIcon()),
				readouts([2]string{"clicks", "n"}, [2]string{"misses", "miss"}, [2]string{"a (intercept)", "a"}, [2]string{"b (slope)", "b"}, [2]string{"R²", "r2"}, [2]string{"throughput", "tp"}),
				hciNote("Throughput is the mean of ID/MT over the nine conditions. Nominal widths are used; ISO 9241-9 would use the effective width from the spread of your clicks. Your clicks stay in this page."),
			)
		},
	}
}

// ---------------------------------------------------------------- H2

func hciSteerBlock() Block {
	return Block{
		Slug:        "steering",
		Title:       "The steering law",
		Description: "Fitts's law for paths: steering the pointer through a tunnel of length A and width W takes T = a + b·A/W (Accot & Zhai 1997). It is why cascading menus that close when you slip out are slow, and why wide, short paths feel easy. Press inside the left circle and drag through the tunnel without touching its walls.",
		Tags:        []string{"experiment", "your data", "menus"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hci-steer",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("rounded-lg border bg-background"),
						h.Svg(h.Data("arena", ""), h.ViewBox("0 0 600 140"), h.Class("block w-full touch-none select-none"), h.Role("img"),
							h.Aria("label", "A horizontal tunnel. Drag from the circle on the left to the line on the right.")),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Steering time against A over W, with the fitted line")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Session"),
					h.P(h.Data("prompt", ""), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground"),
						"6 tunnels (2 lengths × 3 widths), 3 runs each. Touching a wall voids the run."),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					hciButton("clear", "Clear", hugeicons.RefreshIcon()),
					hciButton("simulate", "Simulate", hugeicons.UserGroupIcon()),
				),
				readouts([2]string{"runs", "n"}, [2]string{"wall hits", "miss"}, [2]string{"a", "a"}, [2]string{"b per A/W", "b"}, [2]string{"R²", "r2"}),
				hciNote("Timing runs from the start line to the finish line, so the press itself is not counted."),
			)
		},
	}
}

// ---------------------------------------------------------------- H3

type hciKlmDesign struct{ key, name, seq string }

func hciKlmBlock() Block {
	designs := []hciKlmDesign{
		{"a", "Three dropdowns", "M P B B P B B M P B B P B B M P B B P B B P B B"},
		{"b", "One typed field", "M P B B H M K*10 K"},
	}
	return Block{
		Slug:        "klm",
		Title:       "Keystroke-level model",
		Description: "Predict how long an expert takes before building anything (Card, Moran & Newell 1980). Write a task as operators: K keystroke, P point with the mouse, B button press or release, H move the hand between mouse and keyboard, M mental preparation, W0.5 wait for the system. Here: entering a date with three dropdowns against typing it into one field.",
		Tags:        []string{"model", "GOMS", "compare designs"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hci-klm",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Map(designs, func(d hciKlmDesign) h.Node {
						return h.Div(h.Class("flex flex-col gap-1.5"),
							h.Label(h.For("hci-klm-"+d.key), h.Class("flex items-center justify-between gap-3 text-sm"),
								h.Span(h.Class("font-medium"), d.name),
								h.Span(h.Data("total", d.key), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
							),
							h.Input(h.ID("hci-klm-"+d.key), h.Type("text"), h.Data("seq", d.key), h.Value(d.seq), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
								h.Class("h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[invalid=true]:border-[var(--code-del)]")),
							h.Svg(h.Data("bar", d.key), h.ViewBox("0 0 520 34"), h.Class("block w-full"), h.Role("img"), h.Aria("label", d.name+" timeline")),
						)
					}),
					h.Div(h.Data("legend", ""), h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Keystroke time K"),
					h.Select(h.Data("typist", ""), h.Aria("label", "Typing skill"), h.Class(hciSelectClass),
						h.Option(h.Value("0.08"), "Best typist, 0.08 s"),
						h.Option(h.Value("0.12"), "Good typist, 0.12 s"),
						h.Option(h.Value("0.20"), "Average skilled, 0.20 s"),
						h.Option(h.Value("0.28"), h.Selected(), "Average non-secretary, 0.28 s"),
						h.Option(h.Value("0.50"), "Random letters, 0.50 s"),
						h.Option(h.Value("1.20"), "Worst typist, 1.20 s"),
					),
				),
				readouts([2]string{"dropdowns", "a"}, [2]string{"typed field", "b"}, [2]string{"difference", "diff"}),
				hciNote("P 1.10 s, B 0.10 s, H 0.40 s, M 1.35 s (Card, Moran & Newell 1980). K*10 repeats an operator. The model assumes an expert who makes no errors; where to put M is a judgement, guided by the original placement rules."),
			)
		},
	}
}

// ---------------------------------------------------------------- H4

func hciFoundBlock() Block {
	return Block{
		Slug:        "five-users",
		Title:       "How many test users?",
		Description: "If each user runs into a given problem with probability p, n users find a share 1 − (1 − p)ⁿ of the problems (Nielsen & Landauer 1993). With their average p = 0.31, five users find about 85 %: the source of the famous rule. Switch on unequal problems to see why real studies often find much less.",
		Tags:        []string{"probability", "sample size", "caveats"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"),
				plotPanel("hci-found",
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Share of problems found against number of users")),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Study"),
						field("p", "Detection p", "", 0.31, 0.01, 0.9, 0.01),
						field("n", "Users", "", 5, 1, 20, 1),
					),
					toggle("hci-found-het", "het", "Problems differ", false),
					readouts([2]string{"found, equal p", "eq"}, [2]string{"found, unequal p", "het"}, [2]string{"users for 85 %", "n85"}, [2]string{"users for 95 %", "n95"}),
				),
				h.Div(h.Class("rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-pretty"),
					h.P(h.Class("mb-1 font-medium"), "Why the rule is contested"),
					h.P(h.Class("text-muted-foreground"),
						"p is an average over problems, products and tasks, not a constant. When some problems are rare (the unequal case draws each problem's p from a Beta distribution with the same mean), the curve rises much more slowly. Spool & Schroeder (2001) found only about a third of the problems on large websites after five users, and Faulkner (2003) showed that different groups of five found anywhere from 55 % to almost all of them. Five users per round, repeated over several rounds of design, is the defensible reading."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- H5

var hciSusItems = []string{
	"I think that I would like to use this system frequently.",
	"I found the system unnecessarily complex.",
	"I thought the system was easy to use.",
	"I think that I would need the support of a technical person to be able to use this system.",
	"I found the various functions in this system were well integrated.",
	"I thought there was too much inconsistency in this system.",
	"I would imagine that most people would learn to use this system very quickly.",
	"I found the system very cumbersome to use.",
	"I felt very confident using the system.",
	"I needed to learn a lot of things before I could get going with this system.",
}

func hciSusBlock() Block {
	return Block{
		Slug:        "sus",
		Title:       "System Usability Scale",
		Description: "Ten statements, five points each (Brooke 1996). Odd items are positive and score r − 1; even items are negative and score 5 − r; the sum times 2.5 gives 0–100. That is not a percentage: the average across hundreds of studies is about 68, so the block also shows a percentile, a letter grade and the adjective that people with that score tend to choose.",
		Tags:        []string{"questionnaire", "scoring", "benchmarks"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("hci-sus", ""),
				h.Ol(h.Class("flex flex-col divide-y rounded-xl border bg-background"),
					h.MapIdx(hciSusItems, func(i int, s string) h.Node {
						name := fmt.Sprintf("hci-sus-%d", i+1)
						return h.Li(h.Class("flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"),
							h.Span(h.ID(name+"-q"), h.Class("text-sm leading-snug text-pretty"),
								h.Span(h.Class("mr-2 font-mono text-[11px] text-muted-foreground tabular-nums"), fmt.Sprintf("%02d", i+1)), s),
							h.Div(h.Role("radiogroup"), h.Aria("labelledby", name+"-q"), h.Class("flex shrink-0 items-center gap-1"),
								h.Span(h.Class("mr-1 hidden text-[10px] text-muted-foreground sm:inline"), "disagree"),
								h.Map([]int{1, 2, 3, 4, 5}, func(r int) h.Node {
									return h.Label(h.Class("relative flex size-8 cursor-pointer items-center justify-center rounded-md border font-mono text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"),
										h.Input(h.Type("radio"), h.Name(name), h.Value(fmt.Sprint(r)), h.Data("item", fmt.Sprint(i+1)), h.Class("sr-only"),
											h.Aria("label", fmt.Sprintf("%d of 5", r))),
										fmt.Sprint(r))
								}),
								h.Span(h.Class("ml-1 hidden text-[10px] text-muted-foreground sm:inline"), "agree"),
							),
						)
					}),
				),
				h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
					panelLabel("Score"),
					h.Div(h.Class("flex items-baseline gap-2"),
						h.Span(h.Data("out", "score"), h.Class("font-mono text-4xl font-semibold tabular-nums"), "—"),
						h.Span(h.Class("text-sm text-muted-foreground"), "/ 100"),
					),
					h.Svg(h.Data("scale", ""), h.ViewBox("0 0 260 64"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Score on the 0 to 100 scale with adjective anchors")),
					readouts([2]string{"answered", "answered"}, [2]string{"percentile", "pct"}, [2]string{"grade", "grade"}, [2]string{"adjective", "adj"}),
					h.Div(h.Class("grid grid-cols-3 gap-2"),
						hciButton("neutral", "Neutral", hugeicons.Target02Icon()),
						hciButton("random", "Random", hugeicons.ShuffleIcon()),
						hciButton("clear", "Clear", hugeicons.RefreshIcon()),
					),
					hciNote("Percentile: normal approximation with mean 68 and SD 12.5 (Sauro 2011). Grade: Sauro & Lewis's curved scale (2016). Adjectives: the mean SUS of people choosing each word (Bangor, Kortum & Miller 2009)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- H6

func hciTimeBlock() Block {
	return Block{
		Slug:        "time-on-task",
		Title:       "Small-sample task metrics",
		Description: "Usability tests have few participants and skewed task times: a few people get lost and take much longer. For samples under about 25, the geometric mean estimates the median better than the arithmetic mean, with its confidence interval computed on log times; completion rates get the adjusted-Wald interval (Sauro & Lewis 2016).",
		Tags:        []string{"statistics", "confidence intervals", "your data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hci-time",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Task times on a log axis with mean, median and geometric mean")),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Label(h.For("hci-time-in"), h.Class("text-sm text-muted-foreground"), "Task times, seconds"),
					h.Textarea(h.ID("hci-time-in"), h.Data("times", ""), h.Attr("rows", "3"), h.Attr("spellcheck", "false"),
						h.Class("w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						"34 41 29 88 52 37 45 160 39 47"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Completion"),
					field("x", "Succeeded", "", 8, 0, 100, 1),
					field("tn", "Attempted", "", 10, 1, 100, 1),
				),
				readouts([2]string{"mean", "mean"}, [2]string{"median", "median"}, [2]string{"geometric mean", "geo"}, [2]string{"95 % CI", "geoci"}, [2]string{"completion", "rate"}, [2]string{"95 % CI", "rateci"}),
			)
		},
	}
}

// ---------------------------------------------------------------- H7

func hciAbBlock() Block {
	return Block{
		Slug:        "ab-test",
		Title:       "A/B test: plan, then analyse",
		Description: "Decide the sample size before the test: it depends on the baseline rate, the smallest lift worth detecting, the false-positive rate α and the power. Then read the result with a two-proportion z-test and a confidence interval for the difference, not just a p-value.",
		Tags:        []string{"statistics", "power", "experiment"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-2"), h.Data("hci-ab", ""),
				h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
					panelLabel("1 · Plan"),
					h.Div(h.Class("flex flex-col gap-2"),
						field("p1", "Baseline rate", "%", 10, 0.1, 90, 0.1),
						field("p2", "Rate to detect", "%", 12, 0.1, 99, 0.1),
					),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "α (two-sided)"),
						h.Div(h.Data("seg-group", "alpha"), segs("Alpha", [2]string{"0.05", "0.05"}, [2]string{"0.01", "0.01"}, [2]string{"0.1", "0.10"})),
					),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "Power"),
						h.Div(h.Data("seg-group", "power"), segs("Power", [2]string{"0.8", "0.80"}, [2]string{"0.9", "0.90"}, [2]string{"0.95", "0.95"})),
					),
					h.Svg(h.Data("power", ""), h.ViewBox("0 0 420 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Power against visitors per arm")),
					readouts([2]string{"per arm", "n"}, [2]string{"total", "total"}, [2]string{"relative lift", "lift"}),
				),
				h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
					panelLabel("2 · Analyse"),
					h.Div(h.Class("grid gap-x-4 gap-y-2 sm:grid-cols-2"),
						field("na", "Visitors A", "", 4000, 1, 1000000, 1),
						field("nb", "Visitors B", "", 4000, 1, 1000000, 1),
						field("xa", "Conversions A", "", 400, 0, 1000000, 1),
						field("xb", "Conversions B", "", 468, 0, 1000000, 1),
					),
					h.Svg(h.Data("ci", ""), h.ViewBox("0 0 420 110"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Confidence interval of the difference B minus A")),
					readouts([2]string{"rates", "rates"}, [2]string{"difference", "diff"}, [2]string{"95 % CI", "ci"}, [2]string{"z", "z"}, [2]string{"p (two-sided)", "p"}),
					h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed text-pretty"), ""),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- H8

func hciPeekBlock() Block {
	return Block{
		Slug:        "peeking",
		Title:       "The cost of peeking",
		Description: "Run A/A tests, where both arms are identical, and stop the first time p < 0.05. Checked once, about 5 % come out 'significant', as designed. Checked after every batch of visitors, far more do: each look is another chance for noise to cross the line (Armitage, McPherson & Rowe 1969).",
		Tags:        []string{"simulation", "false positives", "sequential testing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hci-peek",
				h.Div(h.Class("grid gap-3 xl:grid-cols-2"),
					h.Svg(h.Data("rate", ""), h.ViewBox("0 0 420 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "False positive rate against number of looks")),
					h.Svg(h.Data("path", ""), h.ViewBox("0 0 420 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "p-value of one A/A test as visitors arrive")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("A/A test"),
					field("rate", "True rate, both", "%", 10, 1, 50, 1),
					field("n", "Visitors per arm", "", 2000, 200, 10000, 100),
					field("runs", "Simulated tests", "", 2000, 200, 5000, 100),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					hciButton("run", "Run", hugeicons.PlayIcon()),
					hciButton("one", "One test", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"1 look", "k1"}, [2]string{"5 looks", "k5"}, [2]string{"20 looks", "k20"}, [2]string{"100 looks", "k100"}),
				hciNote("Remedies: fix the sample size and look once, or use a sequential design that spends α across the looks (Pocock, O'Brien–Fleming) or always-valid p-values."),
			)
		},
	}
}

// ---------------------------------------------------------------- H9

func hciSortBlock() Block {
	return Block{
		Slug:        "card-sort",
		Title:       "Card sorting and its dendrogram",
		Description: "Open card sorting asks people to group a site's content the way they think about it. Sort the twelve cards yourself, then compare with 30 synthetic participants: the similarity matrix counts how often each pair landed in the same group, and average-linkage clustering turns it into a tree whose cut suggests the menu.",
		Tags:        []string{"research method", "clustering", "information architecture"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("hci-sort", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
						panelLabel("Your sort: pick a group for each card"),
						h.Div(h.Class("flex gap-2"),
							hciButton("reset", "Reset", hugeicons.RefreshIcon()),
						),
					),
					h.Div(h.Data("cards", ""), h.Class("grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4")),
					h.Div(h.Data("groups", ""), h.Class("grid gap-2 sm:grid-cols-2 lg:grid-cols-4")),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-2"),
					h.Div(h.Class("rounded-xl border bg-code p-3"),
						h.Svg(h.Data("matrix", ""), h.ViewBox("0 0 420 420"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Similarity matrix: share of participants grouping each pair")),
					),
					h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-code p-3"),
						h.Svg(h.Data("tree", ""), h.ViewBox("0 0 420 360"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Dendrogram from average-linkage clustering")),
						h.Div(h.Class("flex flex-col gap-3 px-2 pb-2"),
							toggle("hci-sort-me", "me", "Include my sort", false),
							field("cut", "Cut at similarity", "%", 50, 5, 95, 5),
							readouts([2]string{"participants", "people"}, [2]string{"groups at cut", "k"}, [2]string{"your agreement", "agree"}),
						),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- H10

var hciHeuristics = []string{
	"Visibility of system status",
	"Match between system and the real world",
	"User control and freedom",
	"Consistency and standards",
	"Error prevention",
	"Recognition rather than recall",
	"Flexibility and efficiency of use",
	"Aesthetic and minimalist design",
	"Help users recognize, diagnose, and recover from errors",
	"Help and documentation",
}

// hciFlaw wraps one deliberately flawed part of the mock form so it can be
// selected for a finding.
func hciFlaw(id, label string, children ...any) h.Node {
	return h.Div(append([]any{h.Data("flaw", id), h.TabIndex(0), h.Role("button"), h.Aria("label", "Select: "+label), h.Aria("pressed", "false"),
		h.Class("relative cursor-pointer rounded-md p-1.5 outline-none transition-shadow duration-150 hover:ring-1 hover:ring-border focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-brand data-[found]:after:absolute data-[found]:after:-top-1.5 data-[found]:after:-right-1.5 data-[found]:after:size-3 data-[found]:after:rounded-full data-[found]:after:bg-brand data-[found]:after:content-['']")}, children...)...)
}

func hciHeuristicsBlock() Block {
	mockInput := func(placeholder string) h.Node {
		return h.Div(h.Class("h-8 rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-400"), placeholder)
	}
	return Block{
		Slug:        "heuristic-evaluation",
		Title:       "Heuristic evaluation",
		Description: "Inspect a sign-up form against Nielsen's ten usability heuristics (1994). Select a part of the form that breaks one, name the heuristic and rate its severity from 0 (not a problem) to 4 (usability catastrophe). Then reveal the eight planted problems and see which you caught.",
		Tags:        []string{"inspection", "severity", "practice"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("hci-heur", ""),
				// The mock is a picture of a bad form, so it keeps its own light
				// palette in both themes.
				h.Div(h.Class("rounded-xl border bg-neutral-100 p-4 text-neutral-900 sm:p-6"),
					h.Div(h.Class("mx-auto flex max-w-md flex-col gap-2 rounded-lg bg-white p-4 shadow-sm"),
						hciFlaw("jargon", "form title",
							h.P(h.Class("text-base font-semibold"), "FORM 7B – USR_REG"),
							h.P(h.Class("text-[11px] text-neutral-500"), "Complete all mandatory fields of the registration object."),
						),
						hciFlaw("legal", "block of legal text",
							h.P(h.Class("text-[9px] leading-tight text-neutral-500"), "By proceeding the registrant acknowledges and agrees that all information supplied hereunder is subject to processing in accordance with the applicable terms, the conditions thereof, the policies referenced therein and any amendments, which may be made at any time without notice, and that the registrant has read, understood and accepted the same in their entirety, including clauses 4.2(b), 7.1 and Annex III."),
						),
						h.Div(h.Class("grid grid-cols-2 gap-2"),
							h.Div(h.Class("flex flex-col gap-1 p-1.5"), h.Span(h.Class("text-[11px]"), "Name"), mockInput("")),
							hciFlaw("dob", "date of birth field",
								h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("text-[11px]"), "D.O.B."), mockInput("")),
							),
						),
						hciFlaw("country", "country code field",
							h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("text-[11px]"), "Country code (numeric, see annex)"), mockInput("")),
						),
						hciFlaw("password", "password error",
							h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("text-[11px]"), "Password"),
								h.Div(h.Class("h-8 rounded border border-[var(--code-del)] bg-white px-2 py-1.5 text-xs text-neutral-900"), "••••••"),
								h.Span(h.Class("text-[11px] font-medium text-[var(--code-del)]"), "ERR_0x45: INVALID INPUT"),
							),
						),
						hciFlaw("status", "avatar upload",
							h.Div(h.Class("flex items-center gap-2 text-[11px] text-neutral-500"),
								h.Span(h.Class("size-3 rounded-full border-2 border-neutral-300")), "Processing…"),
						),
						hciFlaw("consistency", "instruction text",
							h.P(h.Class("text-[11px] text-neutral-500"), "When you are done, click Register to continue."),
						),
						hciFlaw("clear", "the two buttons",
							h.Div(h.Class("flex gap-2"),
								h.Div(h.Class("flex h-9 flex-1 items-center justify-center rounded bg-neutral-900 text-xs font-semibold text-white"), "Clear form"),
								h.Div(h.Class("flex h-9 w-20 items-center justify-center rounded border border-neutral-300 text-xs text-neutral-600"), "Submit"),
							),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
					panelLabel("Finding"),
					h.P(h.Data("selected", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground"), "Select a part of the form."),
					h.Label(h.Class("flex flex-col gap-1.5 text-xs text-muted-foreground"), "Heuristic",
						h.Select(h.Data("heuristic", ""), h.Class(hciSelectClass),
							h.MapIdx(hciHeuristics, func(i int, s string) h.Node {
								return h.Option(h.Value(fmt.Sprint(i+1)), fmt.Sprintf("H%d · %s", i+1, s))
							}),
						),
					),
					h.Label(h.Class("flex flex-col gap-1.5 text-xs text-muted-foreground"), "Severity",
						h.Select(h.Data("severity", ""), h.Class(hciSelectClass),
							h.Option(h.Value("0"), "0 · Not a usability problem"),
							h.Option(h.Value("1"), "1 · Cosmetic"),
							h.Option(h.Value("2"), h.Selected(), "2 · Minor"),
							h.Option(h.Value("3"), "3 · Major"),
							h.Option(h.Value("4"), "4 · Catastrophe"),
						),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						hciButton("add", "Add finding", hugeicons.Flag02Icon()),
						hciButton("reveal", "Reveal", hugeicons.EyeIcon()),
					),
					h.Ol(h.Data("findings", ""), h.Class("flex flex-col gap-2 text-sm")),
					readouts([2]string{"problems found", "found"}, [2]string{"right heuristic", "match"}),
				),
			)
		},
	}
}
