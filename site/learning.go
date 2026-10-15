package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/textarea"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LearningBlocks lists the learning science tools in display order. They
// put evidence-based techniques in the learner's hands; the spaced-repetition
// deck itself lives in /languages, memory experiments in /psychology.
func LearningBlocks() []Block {
	return []Block{
		learnForgettingBlock(),
		learnSpacingBlock(),
		learnRetrievalBlock(),
		learnInterleavingBlock(),
		learnElaborationBlock(),
		learnCalibrationBlock(),
		learnFocusBlock(),
		learnFeynmanBlock(),
		learnConceptMapBlock(),
		learnEvidenceBlock(),
	}
}

// learnInputClass is the shadcn input look, at 16px on phones (no iOS zoom).
const learnInputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

func learnArea(name, placeholder, value string, extra ...any) h.Node {
	return textarea.Textarea(append([]any{h.Data("learn-field", name), h.Placeholder(placeholder), h.Class("min-h-20 resize-y bg-background text-base md:text-sm"), value}, extra...)...)
}

func learnCard(children ...any) *h.Element {
	return h.Div(append([]any{h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5")}, children...)...)
}

func learnBtn(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("learn-action", action), icon, label)
}

// learnCopy is a copy button whose text the module keeps up to date.
func learnCopy(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("copy", ""), h.Data("learn-copy", ""),
		h.Class("relative"),
		hugeicons.Copy01Icon(h.Class("transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-50 [[data-copied]_&]:opacity-0")),
		hugeicons.Tick02Icon(h.Class("absolute left-2.5 scale-50 opacity-0 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-100 [[data-copied]_&]:opacity-100")),
		label)
}

func learnSource(text string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), text)
}

// ---------------------------------------------------------------- L1

func learnForgettingBlock() Block {
	return Block{
		Slug:        "forgetting-curve",
		Title:       "Forgetting curve and spaced reviews",
		Description: "Ebbinghaus (1885) measured how fast he forgot nonsense syllables. Here retention follows a simple exponential model, and each review makes the memory more stable — more so when it comes after some forgetting. Edit the review days and compare schedules.",
		Tags:        []string{"Ebbinghaus", "spacing", "model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("learn-forgetting",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Retention over 60 days with and without reviews")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Schedule"),
					segs("Schedule preset", [2]string{"expanding", "Expanding"}, [2]string{"uniform", "Uniform"}, [2]string{"massed", "Massed"}, [2]string{"none", "None"}),
					h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "Review days (comma-separated)"),
						h.Input(h.Type("text"), h.Data("learn-days", ""), h.Value("1, 3, 7, 14, 30"), h.Attr("inputmode", "numeric"), h.Attr("autocomplete", "off"), h.Class(learnInputClass+" font-mono")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Model"),
					field("s0", "First stability", "days", 1.5, 0.5, 10, 0.1),
					field("gain", "Boost", "×", 2.5, 1, 6, 0.1),
				),
				readouts([2]string{"average, 60 days", "avg"}, [2]string{"no reviews", "base"}, [2]string{"at day 60", "r60"}, [2]string{"reviews", "count"}),
				learnSource("R(t) = e^(−t/S). At each review S becomes S·(1 + (gain − 1)·(1 − R)): a review after more forgetting strengthens more. A toy model in the spirit of spacing research, not fitted to Ebbinghaus's data."),
			)
		},
	}
}

// ---------------------------------------------------------------- L2

func learnSpacingBlock() Block {
	return Block{
		Slug:        "spacing-gap",
		Title:       "How far apart to space",
		Description: "Cepeda et al. (2008) varied the gap between two study sessions and the delay to the final test. The best gap grew with the delay but shrank as a share of it: roughly 10–20% of the retention interval for delays of weeks to months. Enter when you need to remember something; get a schedule.",
		Tags:        []string{"Cepeda", "rule of thumb", "planner"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("learn-spacing",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Schematic final recall against the gap between sessions")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Goal"),
					field("ri", "Remember for", "days", 60, 3, 365, 1),
					field("gap", "Your gap", "days", 3, 0, 120, 1),
				),
				readouts([2]string{"suggested gap", "range"}, [2]string{"your gap", "share"}, [2]string{"plan", "plan"}),
				learnSource("Curve is schematic (an inverted U peaking near 15% of the interval), drawn to show the shape Cepeda et al. found, not their data. Spacing helps most when the test is far away; for a test tomorrow, a short gap is fine."),
			)
		},
	}
}

// ---------------------------------------------------------------- L3

const learnRetrievalNotes = `The testing effect: retrieving information from memory strengthens it more than restudying it. In Roediger and Karpicke (2006), students who read a prose passage once and then took three recall tests remembered more after one week than students who read it four times, even though rereading felt more effective. Retrieval works best when it is effortful, followed by feedback, and spaced over time. Practice tests, flashcards and free recall onto a blank page are all forms of retrieval practice.`

func learnRetrievalBlock() Block {
	return Block{
		Slug:        "retrieval-practice",
		Title:       "Retrieval practice",
		Description: "Read your notes, hide them, and write down everything you remember before looking again. Comparing afterwards shows which key ideas you recalled and which you missed — the missed ones are what to study next.",
		Tags:        []string{"testing effect", "free recall", "feedback"},
		Render: func() h.Node {
			return learnCard(h.Data("learn-retrieval", ""),
				h.Div(h.Class("flex items-center justify-between gap-2"),
					h.Span(h.Data("learn-stage", ""), h.Class("text-sm font-medium"), "1 · Read your notes"),
					h.Span(h.Class("font-mono text-xs text-muted-foreground"), h.Data("learn-timer", ""), ""),
				),
				h.Div(h.Data("learn-pane", "notes"), learnArea("notes", "Paste your notes here", learnRetrievalNotes, h.Aria("label", "Notes"), h.Class("min-h-36"))),
				h.Div(h.Data("learn-pane", "recall"), h.Hidden(), learnArea("recall", "Write everything you remember, in your own words…", "", h.Aria("label", "Recall"), h.Class("min-h-36"))),
				h.Div(h.Data("learn-pane", "result"), h.Hidden(), h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex items-baseline gap-2"),
						h.Span(h.Data("learn-score", ""), h.Class("font-mono text-2xl font-semibold tabular-nums"), "—"),
						h.Span(h.Class("text-sm text-muted-foreground"), "of the key ideas recalled"),
					),
					h.Div(h.Data("learn-chips", ""), h.Class("flex flex-wrap gap-1.5")),
					h.P(h.Class("text-xs text-muted-foreground"), "Key ideas are the notes' distinctive words (long, non-common words). Green: in your recall. Dashed: missed."),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					learnBtn("hide", "Hide notes and recall", hugeicons.ViewOffIcon()),
					learnBtn("compare", "Compare", hugeicons.CheckListIcon()),
					learnBtn("restart", "Start again", hugeicons.RefreshIcon()),
				),
				learnSource("Roediger & Karpicke (2006), Psychological Science 17(3): after one week, a study–test–test–test group recalled ≈ 61% of idea units against ≈ 40% for four study periods. Dunlosky et al. (2013) rate practice testing \"high utility\"."),
			)
		},
	}
}

// ---------------------------------------------------------------- L4

func learnInterleavingBlock() Block {
	return Block{
		Slug:        "interleaving",
		Title:       "Interleaved practice",
		Description: "Blocked practice does all problems of one kind, then the next; interleaved practice mixes them, so you must first decide which method applies. Generate a practice set both ways, solve it, and check your answers.",
		Tags:        []string{"Rohrer & Taylor", "practice set", "math"},
		Render: func() h.Node {
			return learnCard(h.Data("learn-interleave", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					segs("Order", [2]string{"interleaved", "Interleaved"}, [2]string{"blocked", "Blocked"}),
					h.Div(h.Class("flex gap-2"),
						learnBtn("new", "New set", hugeicons.ShuffleIcon()),
						learnBtn("check", "Check", hugeicons.CheckListIcon()),
					),
				),
				h.Div(h.Data("learn-seq", ""), h.Class("flex gap-1"), h.Aria("hidden", "true")),
				h.Ol(h.Data("learn-problems", ""), h.Class("grid gap-2 sm:grid-cols-2")),
				h.P(h.Data("learn-result", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground")),
				learnSource("Areas of rectangles, triangles, circles (use π ≈ 3.14) and trapezoids; round to 1 decimal. Rohrer & Taylor (2007) found interleaved practice of volume problems gave ≈ 63% on a test a week later against ≈ 20% for blocked practice, despite worse scores during practice. Benefits are clearest when problem types are easy to confuse."),
			)
		},
	}
}

// ---------------------------------------------------------------- L5

func learnElaborationBlock() Block {
	return Block{
		Slug:        "elaboration",
		Title:       "Why and how prompts",
		Description: "Elaborative interrogation asks why a fact is true; self-explanation asks how each step follows. Type what you are learning and get prompts to answer in your own words.",
		Tags:        []string{"elaboration", "self-explanation", "prompts"},
		Render: func() h.Node {
			return learnCard(h.Data("learn-elaboration", ""),
				h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
					h.Span(h.Class("font-medium"), "What are you learning?"),
					h.Input(h.Type("text"), h.Data("learn-topic", ""), h.Value("Plants need sunlight to make sugar"), h.Attr("autocomplete", "off"), h.Class(learnInputClass)),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					segs("Kind of prompt", [2]string{"why", "Why? (elaborative)"}, [2]string{"how", "How? (self-explanation)"}),
					learnBtn("shuffle", "Other prompts", hugeicons.ShuffleIcon()),
				),
				h.Ol(h.Data("learn-prompts", ""), h.Class("flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed")),
				h.Div(h.Class("flex justify-end"), learnCopy("Copy prompts")),
				learnSource("Dunlosky et al. (2013, Psychological Science in the Public Interest) rate both techniques \"moderate utility\": they help, best for learners with some prior knowledge, and evidence is thinner for long delays."),
			)
		},
	}
}

// ---------------------------------------------------------------- L6

type learnFact struct {
	text string
	true bool
	note string
}

var learnFacts = []learnFact{
	{"The Pacific is the largest ocean on Earth.", true, "It covers about a third of Earth's surface."},
	{"Venus is the closest planet to the Sun.", false, "Mercury is."},
	{"Humans normally have 23 pairs of chromosomes.", true, "46 in total."},
	{"Sound travels faster in air than in water.", false, "About 343 m/s in air against about 1,480 m/s in water."},
	{"The Great Wall of China is easily visible to the naked eye from the Moon.", false, "It is far too narrow; astronauts have said so."},
	{"Sunlight takes about 8 minutes to reach Earth.", true, "About 8 min 20 s."},
	{"Bats are blind.", false, "All bat species can see; many also echolocate."},
	{"An octopus has three hearts.", true, "Two pump blood through the gills, one through the body."},
	{"Glass is a slow-flowing liquid at room temperature.", false, "It is an amorphous solid; old windows are uneven from manufacturing."},
	{"Mount Everest is the highest mountain above sea level.", true, "8,849 m (2020 survey)."},
}

func learnCalibrationBlock() Block {
	return Block{
		Slug:        "calibration",
		Title:       "Are you calibrated?",
		Description: "Knowing what you know is a skill. Answer ten true-or-false statements and say how sure you are; the calibration curve compares your confidence with how often you were right, and the Brier score sums it up (0 is perfect).",
		Tags:        []string{"metacognition", "Brier score", "quiz"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("learn-calibration", ""),
				learnCard(
					h.Ol(h.Class("flex flex-col divide-y"),
						h.MapIdx(learnFacts, func(i int, f learnFact) h.Node {
							return h.Li(h.Data("learn-q", fmt.Sprint(i)), h.Data("truth", fmt.Sprint(f.true)), h.Data("note", f.note),
								h.Class("flex flex-col gap-2 py-3 first:pt-0 last:pb-0"),
								h.P(h.Class("text-sm"), h.Span(h.Class("mr-2 font-mono text-xs text-muted-foreground"), fmt.Sprintf("%02d", i+1)), f.text),
								h.Div(h.Class("flex flex-wrap items-center gap-2"),
									h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("radiogroup"), h.Aria("label", "Your answer"),
										h.Button(h.Type("button"), h.Data("learn-ans", "true"), h.Aria("pressed", "false"), h.Class("rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"), "True"),
										h.Button(h.Type("button"), h.Data("learn-ans", "false"), h.Aria("pressed", "false"), h.Class("rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"), "False"),
									),
									h.Label(h.Class("flex items-center gap-2 text-xs text-muted-foreground"), "Sure:",
										h.Select(h.Data("learn-conf", ""), h.Aria("label", "Confidence"),
											h.Class("h-8 rounded-md border border-input bg-background px-1.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"),
											h.Map([]int{50, 60, 70, 80, 90, 100}, func(c int) h.Node {
												return h.Option(h.Value(fmt.Sprint(c)), h.If(c == 70, h.Selected()), fmt.Sprintf("%d%%", c))
											}),
										),
									),
									h.Span(h.Data("learn-mark", ""), h.Class("text-xs")),
								),
							)
						}),
					),
					h.Div(h.Class("flex flex-wrap gap-2 border-t pt-4"),
						learnBtn("score", "Score me", hugeicons.Target02Icon()),
						learnBtn("reset", "Reset", hugeicons.RefreshIcon()),
					),
				),
				learnCard(
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 320 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Calibration curve")),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "answered"), h.Dd(h.Data("out", "answered"), h.Class("tabular-nums"), "0 / 10"),
						h.Dt(h.Class("text-muted-foreground"), "accuracy"), h.Dd(h.Data("out", "acc"), h.Class("tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "mean confidence"), h.Dd(h.Data("out", "conf"), h.Class("tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "Brier score"), h.Dd(h.Data("out", "brier"), h.Class("tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "verdict"), h.Dd(h.Data("out", "verdict"), "—"),
					),
					learnSource("Brier score = mean of (p − o)², where p is your stated probability of being right and o is 1 if you were right, 0 if not (Brier, 1950). Answering 50% on everything scores 0.25."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L7

func learnFocusBlock() Block {
	return Block{
		Slug:        "focus-timer",
		Title:       "Focus timer",
		Description: "Work in focused blocks with short breaks and a longer break after four — the Pomodoro Technique Francesco Cirillo developed in the late 1980s. The log keeps today's sessions in this browser.",
		Tags:        []string{"Pomodoro", "timer", "log"},
		Render: func() h.Node {
			return learnCard(h.Data("learn-focus", ""),
				h.Div(h.Class("flex flex-col items-center gap-4 sm:flex-row sm:items-center"),
					h.Div(h.Class("relative grid size-44 shrink-0 place-items-center"),
						h.Svg(h.Data("ring", ""), h.ViewBox("0 0 120 120"), h.Class("absolute inset-0 size-full -rotate-90"), h.Aria("hidden", "true"),
							h.El("circle", h.Attr("cx", "60"), h.Attr("cy", "60"), h.Attr("r", "54"), h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.1"), h.Attr("stroke-width", "6")),
							h.El("circle", h.Data("arc", ""), h.Attr("cx", "60"), h.Attr("cy", "60"), h.Attr("r", "54"), h.Attr("fill", "none"), h.Attr("stroke", "var(--brand)"), h.Attr("stroke-width", "6"), h.Attr("stroke-linecap", "round"), h.Attr("stroke-dasharray", "339.29 339.29"), h.Attr("stroke-dashoffset", "0")),
						),
						h.Div(h.Class("relative flex flex-col items-center"),
							h.Span(h.Data("learn-clock", ""), h.Role("timer"), h.Aria("live", "off"), h.Class("font-mono text-3xl font-semibold tabular-nums"), "25:00"),
							h.Span(h.Data("learn-phase", ""), h.Class("text-xs text-muted-foreground"), "Focus · 1 of 4"),
						),
					),
					h.Div(h.Class("flex w-full flex-col gap-3"),
						h.Div(h.Class("flex flex-wrap gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("learn-action", "toggle"),
								hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
								h.Span(h.Data("label", ""), "Start")),
							learnBtn("skip", "Skip", hugeicons.NextIcon()),
							learnBtn("reset", "Reset", hugeicons.RefreshIcon()),
						),
						h.Div(h.Class("grid grid-cols-1 gap-1"),
							field("work", "Focus", "min", 25, 5, 90, 1),
							field("short", "Short break", "min", 5, 1, 30, 1),
							field("long", "Long break", "min", 15, 5, 60, 1),
						),
						h.P(h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"), kbd.Kbd("Space"), "start or pause while the timer is focused"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					h.Div(h.Class("flex items-center justify-between"),
						panelLabel("Today"),
						h.Span(h.Data("learn-total", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0 sessions · 0 min"),
					),
					h.Ol(h.Data("learn-log", ""), h.Class("flex flex-col gap-1 font-mono text-xs")),
				),
				learnSource("The original technique uses a 25-minute kitchen timer. There is little controlled research on the exact durations; the useful parts are a clear start, protection from interruptions, and regular breaks."),
			)
		},
	}
}

// ---------------------------------------------------------------- L8

func learnFeynmanBlock() Block {
	step := func(n int, title, hint, field, placeholder, value string) h.Node {
		return h.Div(h.Data("learn-step", fmt.Sprint(n)), h.If(n != 1, h.Hidden()), h.Class("flex flex-col gap-2"),
			h.Div(h.Class("flex items-baseline justify-between gap-2"),
				h.Span(h.Class("text-sm font-medium"), fmt.Sprintf("%d · %s", n, title)),
				h.Span(h.Class("font-mono text-xs text-muted-foreground"), fmt.Sprintf("%d / 4", n)),
			),
			h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), hint),
			learnArea(field, placeholder, value, h.Aria("label", title)),
		)
	}
	return Block{
		Slug:        "feynman",
		Title:       "Explain it simply",
		Description: "The \"Feynman technique\": pick a concept, explain it as if to a twelve-year-old, notice where your explanation breaks down, then go back to the source and simplify. The jargon meter flags long words and long sentences while you write.",
		Tags:        []string{"Feynman technique", "explanation", "Markdown"},
		Render: func() h.Node {
			return learnCard(h.Data("learn-feynman", ""),
				step(1, "Concept", "Name the idea you want to understand.", "concept", "e.g. Why the sky is blue", "Why the sky is blue"),
				step(2, "Explain it simply", "Write as if to a curious twelve-year-old. No jargon you couldn't define.", "explain", "Sunlight is made of all colours…", ""),
				step(3, "Find the gaps", "Where did you hand-wave, use a term you can't define, or skip a step? List them.", "gaps", "- I said \"scattering\" but can't explain why blue scatters more", ""),
				step(4, "Refine", "Fill the gaps from your source, then rewrite the explanation more simply.", "refine", "Light is a wave…", ""),
				h.Div(h.Data("learn-meter", ""), h.Class("flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-code p-3 font-mono text-xs"),
					h.Span(h.Span(h.Class("text-muted-foreground"), "words "), h.Span(h.Data("out", "words"), "0")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "words/sentence "), h.Span(h.Data("out", "wps"), "—")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "long words "), h.Span(h.Data("out", "long"), "—")),
					h.Span(h.Data("out", "flagged"), h.Class("basis-full text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("learn-go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("learn-go", "1"), "Next", hugeicons.ArrowRight01Icon()),
					),
					learnCopy("Copy as Markdown"),
				),
				learnSource("Named after the physicist Richard Feynman, known for clear explanations; the four-step recipe is a popular summary, not something he wrote down. \"Long words\" are words of 12+ letters, a rough proxy for jargon."),
			)
		},
	}
}

// ---------------------------------------------------------------- L9

func learnConceptMapBlock() Block {
	sel := "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
	return Block{
		Slug:        "concept-map",
		Title:       "Concept map",
		Description: "Concepts as nodes, relations as labelled arrows: each link reads as a proposition (\"plants — make → sugar\"). Drag nodes to arrange them, add concepts and links, and export the propositions.",
		Tags:        []string{"Novak", "SVG", "export"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("learn-cmap", ""),
				h.Div(h.Class("overflow-hidden rounded-xl border bg-code"),
					h.Svg(h.Data("canvas", ""), h.ViewBox("0 0 640 420"), h.Class("block w-full touch-none select-none"), h.Role("group"), h.Aria("label", "Concept map; Tab to a concept and use the arrow keys to move it")),
				),
				learnCard(
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Add concept"),
						h.Div(h.Class("flex gap-2"),
							h.Input(h.Type("text"), h.Data("learn-new", ""), h.Placeholder("e.g. chlorophyll"), h.Attr("autocomplete", "off"), h.Class(learnInputClass)),
							button.Button(button.VariantOutline, button.SizeIcon, h.Type("button"), h.Data("learn-action", "add"), h.Aria("label", "Add concept"), hugeicons.Add01Icon()),
						),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Link"),
						h.Div(h.Class("flex gap-2"),
							h.Select(h.Data("learn-from", ""), h.Aria("label", "From"), h.Class(sel)),
							h.Select(h.Data("learn-to", ""), h.Aria("label", "To"), h.Class(sel)),
						),
						h.Div(h.Class("flex gap-2"),
							h.Input(h.Type("text"), h.Data("learn-label", ""), h.Placeholder("linking words, e.g. contains"), h.Attr("autocomplete", "off"), h.Class(learnInputClass)),
							button.Button(button.VariantOutline, button.SizeIcon, h.Type("button"), h.Data("learn-action", "link"), h.Aria("label", "Add link"), hugeicons.Link01Icon()),
						),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
						h.Div(h.Class("flex items-center justify-between"), panelLabel("Propositions"),
							h.Span(h.Data("learn-count", ""), h.Class("font-mono text-xs text-muted-foreground"))),
						h.Ol(h.Data("learn-props", ""), h.Class("flex max-h-48 flex-col gap-1 overflow-y-auto text-sm")),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						learnCopy("Copy"),
						learnBtn("reset", "Reset", hugeicons.RefreshIcon()),
					),
					learnSource("After Novak & Gowin, Learning How to Learn (1984). Select a concept and press Delete to remove it with its links."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L10

type learnRating struct{ technique, rating, note string }

var learnRatings = []learnRating{
	{"Practice testing", "high", "Self-testing, flashcards, practice problems."},
	{"Distributed practice", "high", "Spreading study over time."},
	{"Interleaved practice", "moderate", "Mixing problem types; evidence mostly in math and motor skills."},
	{"Elaborative interrogation", "moderate", "Asking why facts are true."},
	{"Self-explanation", "moderate", "Explaining how steps follow."},
	{"Summarization", "low", "Helps only learners trained to summarise well."},
	{"Highlighting / underlining", "low", "Little benefit; may narrow attention."},
	{"Keyword mnemonic", "low", "Works for some vocabulary; effects fade."},
	{"Imagery for text learning", "low", "Limited to imageable text."},
	{"Rereading", "low", "Feels fluent; weaker than testing."},
}

func learnEvidenceBlock() Block {
	pill := func(r string) h.Node {
		cls := map[string]string{
			"high":     "border-add/40 bg-add/10 text-add",
			"moderate": "border-vec-out/40 bg-vec-out/10 text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))]",
			"low":      "text-muted-foreground",
		}[r]
		return h.Span(h.Class("rounded-full border px-2 py-0.5 text-[11px] font-medium "+cls), r)
	}
	cardp := func(title, body, source string) h.Node {
		return h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-background p-3"),
			h.Span(h.Class("text-sm font-medium"), title),
			h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), body),
			h.P(h.Class("text-xs text-muted-foreground/80"), source),
		)
	}
	return Block{
		Slug:        "evidence",
		Title:       "What the evidence says",
		Description: "The research behind the tools above in four tabs: how ten common techniques were rated, dual coding, desirable difficulties, and popular myths that do not hold up.",
		Tags:        []string{"Dunlosky", "Bjork", "myths"},
		Render: func() h.Node {
			return learnCard(
				segs("Topic", [2]string{"ratings", "Ratings"}, [2]string{"dual", "Dual coding"}, [2]string{"difficulties", "Desirable difficulties"}, [2]string{"myths", "Myths"}),
				h.Div(h.Data("view", "ratings"), h.Class("flex flex-col gap-3"),
					h.Ul(h.Class("flex flex-col divide-y"),
						h.Map(learnRatings, func(r learnRating) h.Node {
							return h.Li(h.Class("flex items-center gap-3 py-2"),
								h.Div(h.Class("flex min-w-0 flex-1 flex-col"),
									h.Span(h.Class("text-sm"), r.technique),
									h.Span(h.Class("text-xs text-muted-foreground"), r.note)),
								pill(r.rating))
						}),
					),
					learnSource("Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), \"Improving students' learning with effective learning techniques\", Psychological Science in the Public Interest 14(1). Ratings weigh how broadly each technique works across learners, materials and delays."),
				),
				h.Div(h.Data("view", "dual"), h.Hidden(), h.Class("grid gap-3 sm:grid-cols-2"),
					cardp("Words and pictures", "Allan Paivio's dual-coding theory (1971) proposes separate verbal and non-verbal memory codes; information encoded both ways has two routes back. Pair a diagram with your words, and explain the diagram aloud.", "Paivio, Imagery and Verbal Processes (1971); Mental Representations (1986)."),
					cardp("Not decoration", "Pictures help when they carry the structure of the idea (a cycle, a cause, a part-whole). Decorative images can distract — Mayer's coherence principle.", "Mayer, Multimedia Learning (2001; 3rd ed. 2020)."),
				),
				h.Div(h.Data("view", "difficulties"), h.Hidden(), h.Class("grid gap-3 sm:grid-cols-2"),
					cardp("Harder now, better later", "Robert Bjork's desirable difficulties: conditions that slow learning during practice — spacing, interleaving, testing, varying conditions — often improve long-term retention and transfer.", "Bjork (1994), \"Memory and metamemory considerations in the training of human beings\"."),
					cardp("Performance is not learning", "Fluent rereading feels like mastery; struggling to recall feels like failure. Judge learning by delayed tests, not by how easy practice felt. A difficulty is only desirable if you can eventually succeed.", "Soderstrom & Bjork (2015), \"Learning versus performance: an integrative review\", Perspectives on Psychological Science."),
				),
				h.Div(h.Data("view", "myths"), h.Hidden(), h.Class("grid gap-3 sm:grid-cols-2"),
					cardp("\"Learning styles\"", "Matching teaching to a preferred style (visual, auditory, kinesthetic) is popular, but studies with the right design found no evidence that matching improves learning.", "Pashler, McDaniel, Rohrer & Bjork (2008), Psychological Science in the Public Interest 9(3)."),
					cardp("\"We use 10% of our brain\"", "Brain imaging shows activity across virtually the whole brain over a day; there is no silent 90%.", "See Beyerstein (1999) in Mind Myths, ed. Della Sala."),
					cardp("\"Highlighting means studying\"", "Highlighting is easy and common but rated low utility: it rarely beats reading alone.", "Dunlosky et al. (2013)."),
					cardp("\"Cramming works\"", "Massed study can carry you through tomorrow's test, but is forgotten faster than spaced study of the same total time.", "Cepeda et al. (2006), Psychological Bulletin 132(3) — a meta-analysis of 317 experiments."),
				),
			)
		},
	}
}
