package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PsychologyBlocks lists the psychology & cognitive science gallery. The
// experiments run on the learner's own responses; nothing leaves the page.
func PsychologyBlocks() []Block {
	return []Block{
		psychReactionBlock(),
		psychStroopBlock(),
		psychMullerLyerBlock(),
		psychCheckerBlock(),
		psychRecallBlock(),
		psychSDTBlock(),
		psychRescorlaBlock(),
		psychBiasesBlock(),
	}
}

func psychButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// psychPrivacy is the line every experiment block carries.
func psychPrivacy() h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Your responses stay in this page: nothing is sent or stored.")
}

// ---------------------------------------------------------------- P1

func psychReactionBlock() Block {
	return Block{
		Slug:        "reaction-time",
		Title:       "Reaction time and Hick's law",
		Description: "A real experiment on you. A lamp lights after a random wait; press its number as fast as you can. With more possible lamps you slow down, and by about the same amount each time the number of choices doubles: RT = a + b·log₂(n + 1) (Hick 1952, Hyman 1953).",
		Tags:        []string{"experiment", "your data", "fit"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("psych-rt",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("stage", ""), h.TabIndex(0), h.Aria("label", "Stimulus area. Press the number of the lit lamp."),
						h.Class("flex min-h-36 flex-col items-center justify-center gap-4 rounded-lg border bg-background p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						h.Div(h.Data("lamps", ""), h.Class("flex flex-wrap justify-center gap-2")),
						h.P(h.Data("prompt", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-center text-sm text-muted-foreground"), "Choose how many lamps, then press Start."),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Mean reaction time against log2 of n plus 1")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Choices"),
					segs("Number of lamps", [2]string{"1", "1"}, [2]string{"2", "2"}, [2]string{"4", "4"}, [2]string{"8", "8"}),
					h.P(h.Class("text-xs text-muted-foreground"), "10 trials per setting. Keys 1–8, or click the lamp."),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					psychButton("start", "Start", hugeicons.PlayIcon()),
					psychButton("clear", "Clear data", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"last RT", "last"}, [2]string{"trials", "trials"}, [2]string{"fit a", "a"}, [2]string{"fit b", "b"}, [2]string{"too early", "early"}),
				psychPrivacy(),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func psychStroopBlock() Block {
	keys := [][3]string{{"r", "red", "var(--code-del)"}, {"b", "blue", "var(--vec-u)"}, {"g", "green", "var(--code-add)"}, {"y", "yellow", "var(--vec-out)"}}
	return Block{
		Slug:        "stroop",
		Title:       "Stroop task",
		Description: "Name the ink, not the word. Reading is so automatic that a colour word printed in a different ink slows you down: the Stroop interference effect (Stroop 1935), one of the most reliable findings in psychology.",
		Tags:        []string{"experiment", "interference", "kbd"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("psych-stroop", ""),
				h.Div(h.Data("stage", ""), h.TabIndex(0), h.Aria("label", "Stroop stimulus. Press the key for the ink colour."),
					h.Class("flex h-40 flex-col items-center justify-center rounded-xl border bg-background px-4 text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"),
					h.Span(h.Data("word", ""), h.Class("text-5xl font-semibold tracking-tight select-none"), ""),
					h.Span(h.Data("prompt", ""), h.Class("text-sm text-muted-foreground"), "24 trials. Press Start, then answer with the keys below."),
				),
				h.Div(h.Class("grid grid-cols-4 gap-2"),
					h.Map(keys, func(k [3]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("ink", k[1]),
							h.Span(h.Class("size-2.5 shrink-0 rounded-full"), h.Style("background:"+k[2])), k[1], kbd.Kbd(h.Class("ml-auto hidden uppercase sm:inline-flex"), k[0]))
					}),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
					h.Div(h.Class("flex gap-2"),
						psychButton("start", "Start", hugeicons.PlayIcon()),
					),
					h.Span(h.Data("progress", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0 / 24"),
				),
				h.Div(h.Data("results", ""), h.Hidden(), h.Class("enter grid gap-3 sm:grid-cols-[1fr_auto]"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 360 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Mean reaction time, congruent against incongruent")),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "congruent"), h.Dd(h.Data("out", "con"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "incongruent"), h.Dd(h.Data("out", "inc"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "interference"), h.Dd(h.Data("out", "diff"), h.Class("text-brand"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "errors"), h.Dd(h.Data("out", "err"), "—"),
					),
				),
				psychPrivacy(),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func psychMullerLyerBlock() Block {
	return Block{
		Slug:        "muller-lyer",
		Title:       "Müller-Lyer illusion",
		Description: "Measure your own illusion. Adjust the lower line until it looks as long as the upper one, then submit: the gap between what you set and the true length is your bias. Inward fins shrink a line, outward fins stretch it (Müller-Lyer 1889).",
		Tags:        []string{"illusion", "measurement", "your data"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("psych-ml", ""),
				h.Div(h.Class("rounded-xl border bg-background p-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Two lines with arrowhead fins")),
				),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"),
						field("len", "Lower line", "px", 150, 80, 300, 1),
						field("fin", "Fin angle", "°", 35, 10, 80, 1),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Div(h.Class("grid grid-cols-2 gap-2"),
							psychButton("submit", "Looks equal", hugeicons.Tick02Icon()),
							psychButton("reveal", "Reveal", hugeicons.EyeIcon()),
						),
						h.P(h.Data("out", "result"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground"), "Drag the number sideways or use the arrow keys."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func psychCheckerBlock() Block {
	return Block{
		Slug:        "checker-shadow",
		Title:       "Checker shadow",
		Description: "Squares A and B are painted with exactly the same grey; the page draws both from one colour value. The visual system discounts the shadow and the checkerboard pattern, and reports the surface, not the light (after Adelson 1995).",
		Tags:        []string{"lightness", "reveal", "SVG"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("psych-checker", ""),
				h.Div(h.Class("overflow-hidden rounded-xl border"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 420 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "A checkerboard with a cylinder casting a shadow; squares A and B are marked")),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Div(h.Class("flex gap-2"),
						psychButton("bridge", "Connect A and B", hugeicons.Layers01Icon()),
						psychButton("isolate", "Hide the context", hugeicons.EyeIcon()),
					),
					h.Span(h.Data("out", "value"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

var psychWordLists = [][]string{
	{"river", "candle", "horse", "pencil", "garden", "doctor", "window", "apple", "bridge", "button", "forest", "letter", "mirror", "basket", "tiger"},
	{"rocket", "blanket", "violin", "carpet", "island", "kettle", "orange", "pillow", "ladder", "sailor", "monkey", "parrot", "camera", "jacket", "temple"},
	{"anchor", "bottle", "castle", "dragon", "feather", "glove", "hammer", "jungle", "lemon", "marble", "needle", "pepper", "saddle", "tunnel", "wallet"},
	{"barrel", "cactus", "dolphin", "engine", "fountain", "helmet", "kitten", "lantern", "meadow", "napkin", "oyster", "puzzle", "rabbit", "spider", "trumpet"},
}

func psychRecallBlock() Block {
	return Block{
		Slug:        "serial-position",
		Title:       "Serial position curve",
		Description: "Fifteen words, one per second, then write down all you remember in any order. Over several lists, the first words (primacy) and the last ones (recency) come back best: the U-shaped curve of free recall (Murdock 1962).",
		Tags:        []string{"memory", "free recall", "your data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("psych-recall",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("stage", ""), h.Class("flex h-28 flex-col items-center justify-center rounded-lg border bg-background px-4 text-center"),
						h.Span(h.Data("word", ""), h.Class("text-3xl font-semibold tracking-tight"), ""),
						h.Span(h.Data("prompt", ""), h.Class("text-sm text-muted-foreground"), "Press Start list. Don't write anything down while the words show."),
					),
					h.Form(h.Data("recall", ""), h.Hidden(), h.Action("#"), h.Class("flex flex-col gap-2"),
						h.Label(h.For("psych-recall-input"), h.Class("text-sm"), "Type a word and press Enter. Order doesn't matter."),
						h.Div(h.Class("flex gap-2"),
							h.Input(h.ID("psych-recall-input"), h.Type("text"), h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"), h.Attr("spellcheck", "false"),
								h.Class("h-9 flex-1 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), h.Class("h-9"), "Add"),
							psychButton("done", "Done", hugeicons.Tick02Icon()),
						),
						h.Div(h.Data("typed", ""), h.Class("flex min-h-7 flex-wrap gap-1.5")),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Proportion recalled by position in the list")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Lists"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), fmt.Sprintf("%d lists of 15 words. One list gives a noisy curve; three or four start to show the U.", len(psychWordLists))),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					psychButton("start", "Start list", hugeicons.PlayIcon()),
					psychButton("clear", "Clear data", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"lists done", "lists"}, [2]string{"last list", "last"}, [2]string{"first 3", "first"}, [2]string{"middle", "middle"}, [2]string{"last 3", "end"}),
				psychPrivacy(),
				h.Template(h.Data("lists", ""), h.Map(psychWordLists, func(l []string) h.Node {
					return h.Div(h.Data("words", joinWords(l)))
				})),
			)
		},
	}
}

func joinWords(ws []string) string {
	s := ""
	for i, w := range ws {
		if i > 0 {
			s += " "
		}
		s += w
	}
	return s
}

// ---------------------------------------------------------------- P6

func psychSDTBlock() Block {
	return Block{
		Slug:        "signal-detection",
		Title:       "Signal detection theory",
		Description: "Separating how well you can tell signal from noise (sensitivity, d′) from how willing you are to say yes (criterion, c). Set a hit rate and a false-alarm rate; the two distributions, the criterion and the point on the ROC curve follow (Green & Swets 1966).",
		Tags:        []string{"d′", "criterion", "ROC"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("psych-sdt",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("sdt-dist", ""), h.ViewBox("0 0 400 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Noise and signal distributions with the criterion")),
					h.Svg(h.Data("sdt-roc", ""), h.ViewBox("0 0 240 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "ROC curve")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Observer"),
					field("hit", "Hit rate", "", 0.84, 0.01, 0.99, 0.01),
					field("fa", "False alarms", "", 0.16, 0.01, 0.99, 0.01),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "noise"), legendSwatch("var(--brand)", "signal + noise")),
				readouts([2]string{"d′", "d"}, [2]string{"criterion c", "c"}, [2]string{"bias", "bias"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Equal-variance Gaussian model: d′ = z(H) − z(F), c = −(z(H) + z(F)) / 2."),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func psychRescorlaBlock() Block {
	return Block{
		Slug:        "rescorla-wagner",
		Title:       "Rescorla–Wagner and blocking",
		Description: "Classical conditioning as error correction: on each trial, every cue present changes its strength by αβ(λ − ΣV). A cue already predicting the outcome leaves no error to learn from, so a new cue added to it gains almost nothing: blocking (Kamin 1969; model: Rescorla & Wagner 1972).",
		Tags:        []string{"learning", "model", "blocking"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("psych-rw",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Associative strength over trials")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Design"),
					segs("Group", [2]string{"blocking", "Blocking"}, [2]string{"control", "Control"}),
					h.P(h.Data("out", "design"), h.Class("text-xs leading-relaxed text-muted-foreground"), "—"),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameters"),
					field("alpha", "α (salience)", "", 0.3, 0.05, 1, 0.05),
					field("beta", "β (outcome)", "", 0.5, 0.05, 1, 0.05),
					field("lambda", "λ (maximum)", "", 1, 0.1, 1, 0.05),
					field("n", "Trials / phase", "", 20, 5, 50, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "V(A) light"), legendSwatch("var(--brand)", "V(B) tone")),
				readouts([2]string{"V(A) end", "va"}, [2]string{"V(B) end", "vb"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

type psychBias struct {
	name, source, finding, status string
	replicated                    bool
}

var psychBiases = []psychBias{
	{"Anchoring", "Tversky & Kahneman (1974), Science 185:1124–1131",
		"Estimates drift toward an arbitrary starting number: people who first saw a high number from a wheel of fortune gave higher estimates of the share of African countries in the UN.",
		"Replicated in Many Labs 1 (Klein et al. 2014).", true},
	{"Availability", "Tversky & Kahneman (1973), Cognitive Psychology 5:207–232",
		"Frequency is judged by how easily examples come to mind, so vivid or recent events seem more common than they are.",
		"Robust in many variants.", true},
	{"Framing", "Tversky & Kahneman (1981), Science 211:453–458",
		"The same choice described as lives saved or lives lost flips preferences between a sure option and a gamble.",
		"Replicated in Many Labs 1 (Klein et al. 2014).", true},
	{"Ego depletion", "Baumeister et al. (1998)",
		"Claimed that self-control draws on a limited resource that runs out with use.",
		"A 23-lab registered replication found an effect near zero (Hagger et al. 2016).", false},
	{"Power posing", "Carney, Cuddy & Yap (2010)",
		"Claimed that expansive poses change hormone levels and risk-taking.",
		"Hormonal and behavioural effects did not replicate (Ranehill et al. 2015); first author Carney disavowed the effect in 2016.", false},
}

func psychBiasesBlock() Block {
	return Block{
		Slug:        "biases",
		Title:       "Biases, and a replication watch",
		Description: "Take the classic framing problem yourself, then compare with the original result. Each card cites its source and says whether the effect held up when other labs tried again; two famous ones did not.",
		Tags:        []string{"framing", "sources", "replication"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("psych-biases", ""),
				// The framing experiment (Tversky & Kahneman 1981).
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-xs"),
					h.Div(h.Class("flex items-center gap-2"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Try it"),
						h.Span(h.Class("text-xs text-muted-foreground"), "You are randomly shown one of two versions."),
					),
					h.P(h.Class("text-sm leading-relaxed"), "An unusual disease is expected to kill 600 people. Two programmes are proposed:"),
					h.Div(h.Data("frame", "gain"), h.Class("grid gap-2 sm:grid-cols-2"),
						psychChoice("a", "If programme A is adopted, 200 people will be saved."),
						psychChoice("b", "If programme B is adopted, there is a 1/3 probability that 600 people will be saved, and a 2/3 probability that no one will be saved."),
					),
					h.Div(h.Data("frame", "loss"), h.Hidden(), h.Class("grid gap-2 sm:grid-cols-2"),
						psychChoice("a", "If programme C is adopted, 400 people will die."),
						psychChoice("b", "If programme D is adopted, there is a 1/3 probability that nobody will die, and a 2/3 probability that 600 people will die."),
					),
					h.P(h.Data("out", "frame"), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground")),
				),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
					h.Map(psychBiases, func(b psychBias) h.Node {
						return h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3"),
							h.Div(h.Class("flex items-center justify-between gap-2"),
								h.Span(h.Class("text-sm font-medium"), b.name),
								h.Span(h.Class("flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium "+
									h.Ternary(b.replicated, "bg-add/12 text-add", "bg-del/12 text-del")),
									h.IfElse(b.replicated, hugeicons.Tick02Icon(h.Class("size-3")), hugeicons.Cancel01Icon(h.Class("size-3"))),
									h.Ternary(b.replicated, "Replicates", "Failed to replicate")),
							),
							h.P(h.Class("text-[13px] leading-relaxed text-muted-foreground"), b.finding),
							h.P(h.Class("text-[12px] leading-relaxed"), b.status),
							h.P(h.Class("font-mono text-[11px] text-muted-foreground"), b.source),
						)
					}),
				),
			)
		},
	}
}

func psychChoice(v, text string) h.Node {
	return h.Button(h.Type("button"), h.Data("pick", v),
		h.Class("rounded-lg border bg-background p-3 text-left text-sm leading-relaxed shadow-xs transition-[border-color,box-shadow] duration-150 outline-none hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-ring data-[on]:ring-[3px] data-[on]:ring-ring/50"),
		text)
}
