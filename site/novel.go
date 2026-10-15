package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NovelBlocks lists the novel engineering gallery in display order: tools a
// writer uses on a manuscript. Everything runs in the browser; drafts are
// kept in localStorage and export as Markdown.
func NovelBlocks() []Block {
	return []Block{
		novelBeatsBlock(),
		novelArcBlock(),
		novelScenesBlock(),
		novelPacingBlock(),
		novelDeadlineBlock(),
		novelProseBlock(),
		novelDialogueBlock(),
		novelPOVBlock(),
		novelSnowflakeBlock(),
		novelBriefBlock(),
	}
}

// ---------------------------------------------------------------- helpers

const novelFieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"

// novelTextarea is a labelled text area; name is its data-nv-field key.
func novelTextarea(name, lbl, placeholder string, rows int, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
		h.Span(h.Class("font-medium"), lbl),
		h.Textarea(h.Data("nv-field", name), h.Attr("rows", fmt.Sprint(rows)), h.Placeholder(placeholder), h.Attr("spellcheck", "true"),
			h.Class(novelFieldClass+" resize-y leading-relaxed"), value),
	)
}

func novelInput(name, lbl, placeholder, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5 text-sm"),
		h.Span(h.Class("font-medium"), lbl),
		h.Input(h.Type("text"), h.Data("nv-field", name), h.Placeholder(placeholder), h.Value(value), h.Attr("autocomplete", "off"),
			h.Class(novelFieldClass+" h-9 py-1")),
	)
}

// novelSource credits the method a tool follows.
func novelSource(s string) h.Node {
	return h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), s)
}

// novelExport is the pair of export buttons every tool shares: copy the
// Markdown, or download it as a .md file (static/js/novel.js).
func novelExport() h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-2"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "copy-md"),
			hugeicons.Copy01Icon(), h.Span(h.Data("nv-copy-label", ""), "Copy Markdown")),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "download-md"),
			hugeicons.Download04Icon(), "Download .md"),
	)
}

// novelHeuristic marks a tool's output as a heuristic, not a verdict.
func novelHeuristic(s string) h.Node {
	return h.P(h.Class("flex gap-2 rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground"),
		hugeicons.InformationCircleIcon(h.Class("mt-px size-3.5 shrink-0")), s)
}

// ---------------------------------------------------------------- 1

func novelBeatsBlock() Block {
	return Block{
		Slug:        "beat-sheet",
		Title:       "Beat sheet planner",
		Description: "Five classic story structures laid on your manuscript's length. Pick one, set a target word count, and each beat gets its word position; then place your own scenes on the bar (drag them, or use the arrow keys) and see which beats they land on.",
		Tags:        []string{"structure", "drag", "export"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 overflow-hidden rounded-xl border bg-background p-4 sm:p-5"), h.Data("novel-beats", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Structure",
						[2]string{"three-act", "Three acts"},
						[2]string{"save-the-cat", "Save the Cat!"},
						[2]string{"hero", "Hero's journey"},
						[2]string{"freytag", "Freytag"},
						[2]string{"harmon", "Story circle"},
					),
					h.Div(h.Class("w-60"), field("words", "Target length", "words", 90000, 10000, 250000, 1000)),
				),
				h.P(h.Data("nv-attribution", ""), h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), "—"),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					h.Svg(h.Data("nv-bar", ""), h.ViewBox("0 0 960 168"), h.Class("block w-full min-w-[640px] touch-none select-none"),
						h.Role("img"), h.Aria("label", "Beats and your scenes along the manuscript")),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
					h.Div(h.Class("scroll-thin max-h-96 overflow-auto rounded-lg border"),
						h.Table(h.Class("w-full text-sm"),
							h.Thead(h.Tr(h.Class("sticky top-0 border-b bg-background text-left text-xs text-muted-foreground"),
								h.Th(h.Class("px-3 py-2 font-normal"), "Beat"),
								h.Th(h.Class("px-3 py-2 text-right font-normal"), "At"),
								h.Th(h.Class("px-3 py-2 text-right font-normal"), "Word"),
							)),
							h.Tbody(h.Data("nv-beat-rows", "")),
						),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						panelLabel("Your scenes"),
						h.Form(h.Data("nv-add-scene", ""), h.Class("flex gap-2"), h.Action("#"),
							h.Input(h.Type("text"), h.Data("nv-scene-name", ""), h.Placeholder("Scene, e.g. The ferry sinks"), h.Attr("autocomplete", "off"),
								h.Aria("label", "Scene name"), h.Class(novelFieldClass+" h-9 py-1")),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), h.Class("h-9"), hugeicons.Add01Icon(), "Add"),
						),
						h.Ul(h.Data("nv-scene-list", ""), h.Class("flex flex-col gap-1.5")),
						h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
							"Drag a scene's marker, or focus it and use", kbd.Group(kbd.Kbd("←"), kbd.Kbd("→")), "(Shift: 5%)."),
						novelExport(),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func novelArcBlock() Block {
	return Block{
		Slug:        "character-arc",
		Title:       "Character arc builder",
		Description: "What the character wants against what they need, the lie they believe and the wound it came from. Choose the kind of arc and the chart shows how their hold on the lie (or the truth) should move across the three acts.",
		Tags:        []string{"character", "arc chart", "export"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("novel-arc", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:p-5 lg:border-r lg:border-b-0"),
					novelInput("name", "Character", "e.g. Mara Vey", "Mara Vey"),
					novelTextarea("want", "Want (the goal they chase)", "What they think will fix their life", 2, "To win back the family vineyard from the bank."),
					novelTextarea("need", "Need (what would actually fix it)", "The inner change the story demands", 2, "To accept help and stop measuring her worth by ownership."),
					novelTextarea("lie", "The lie they believe", "A false belief about themselves or the world", 2, "If I rely on anyone, I will lose everything again."),
					novelTextarea("ghost", "Ghost / wound", "The past event that planted the lie", 2, "Her father's partner emptied the accounts when she was twelve."),
					novelSource("After K. M. Weiland, Creating Character Arcs (2016): want vs need, the Lie, the Ghost; positive, flat and negative arcs."),
				),
				h.Div(h.Class("flex flex-col gap-4 bg-code p-4 sm:p-5"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
						panelLabel("Arc"),
						segs("Arc type",
							[2]string{"positive", "Positive"},
							[2]string{"flat", "Flat"},
							[2]string{"disillusionment", "Disillusionment"},
							[2]string{"fall", "Fall"},
							[2]string{"corruption", "Corruption"},
						),
					),
					h.Svg(h.Data("nv-arc-chart", ""), h.ViewBox("0 0 440 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Arc chart across three acts")),
					h.P(h.Data("nv-arc-text", ""), h.Class("text-sm leading-relaxed text-muted-foreground"), "—"),
					h.Ol(h.Data("nv-arc-beats", ""), h.Class("flex flex-col gap-2 text-sm")),
					novelExport(),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func novelScenesBlock() Block {
	return Block{
		Slug:        "scene-sequel",
		Title:       "Scene and sequel planner",
		Description: "Dwight Swain's unit of story: a scene is goal, conflict, disaster; a sequel is reaction, dilemma, decision, and the decision sets the next goal. Build the chain card by card; the planner flags missing parts and breaks in the chain.",
		Tags:        []string{"cards", "reorder", "validation"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("novel-scenes", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "add-scene"), hugeicons.Add01Icon(), "Scene"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "add-sequel"), hugeicons.Add01Icon(), "Sequel"),
					h.Div(h.Class("flex-1")),
					h.Span(h.Data("nv-scene-count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
				),
				h.Ol(h.Data("nv-cards", ""), h.Class("flex flex-col gap-2")),
				h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
					"Move a card with its arrows, or focus it and press", kbd.Group(kbd.Kbd("Alt"), kbd.Kbd("↑")), "/", kbd.Group(kbd.Kbd("Alt"), kbd.Kbd("↓")), "."),
				novelSource("Dwight V. Swain, Techniques of the Selling Writer (1965), chapter on scene and sequel."),
				novelExport(),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func novelPacingBlock() Block {
	return Block{
		Slug:        "pacing",
		Title:       "Pacing and tension",
		Description: "Chapters by length and tension, plotted where they fall in the book. The dashed line is a typical rising shape for the chosen structure (an illustration, not a law); long stretches of low tension are flagged.",
		Tags:        []string{"chart", "table", "flags"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_340px]"), h.Data("novel-pacing", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "your tension"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-0 w-3 border-t border-dashed border-foreground/60")), "typical shape"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-2.5 w-3 rounded-[2px] bg-vec-out/30")), "flagged stretch"),
					),
					h.Svg(h.Data("nv-pace-chart", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Tension against position in the book")),
					h.Ul(h.Data("nv-pace-flags", ""), h.Class("flex flex-col gap-1.5 px-1 pb-1 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-3 p-4"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						panelLabel("Chapters"),
						segs("Expected shape", [2]string{"three-act", "Three acts"}, [2]string{"save-the-cat", "Save the Cat!"}),
					),
					h.Div(h.Class("scroll-thin max-h-[420px] overflow-auto rounded-lg border"),
						h.Table(h.Class("w-full text-sm"),
							h.Thead(h.Tr(h.Class("sticky top-0 border-b bg-background text-left text-xs text-muted-foreground"),
								h.Th(h.Class("px-2 py-2 font-normal"), "#"),
								h.Th(h.Class("px-2 py-2 text-right font-normal"), "Words"),
								h.Th(h.Class("px-2 py-2 text-right font-normal"), "Tension 0–10"),
								h.Th(h.Class("w-8 px-1 py-2"), h.Span(h.Class("sr-only"), "Remove")),
							)),
							h.Tbody(h.Data("nv-pace-rows", "")),
						),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "add-chapter"), hugeicons.Add01Icon(), "Chapter"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "sample"), "Sample book"),
					),
					readouts([2]string{"chapters", "count"}, [2]string{"total words", "total"}, [2]string{"mean tension", "mean"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func novelDeadlineBlock() Block {
	dateInput := func(name, lbl string) h.Node {
		return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
			h.Span(h.Class("text-muted-foreground"), lbl),
			h.Input(h.Type("date"), h.Data("nv-date", name), h.Aria("label", lbl),
				h.Class("h-8 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
		)
	}
	return Block{
		Slug:        "deadline",
		Title:       "Word count and deadline",
		Description: "Turn a target and a date into a daily quota you can keep. Count only the days you actually write, log what is done, and the burndown shows whether you are ahead of the line.",
		Tags:        []string{"planner", "burndown", "NaNoWriMo"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("novel-deadline",
				h.Svg(h.Data("nv-burn", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Words remaining by date")),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("Goal"),
					field("target", "Target", "words", 80000, 1000, 300000, 500),
					field("done", "Written", "words", 12000, 0, 300000, 100),
					field("days", "Writing days", "/ week", 5, 1, 7, 1),
					dateInput("start", "Start"),
					dateInput("end", "Deadline"),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "nano"), hugeicons.Calendar03Icon(), "NaNoWriMo preset"),
				readouts([2]string{"writing days left", "left"}, [2]string{"daily quota", "quota"}, [2]string{"weekly", "weekly"}, [2]string{"status", "status"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

const novelProseSample = `The rain had stopped by the time Mara reached the vineyard. She felt the cold settle into her coat and noticed that the gate was open. It had been left open deliberately, she thought. The rows were quiet. The rows were very quiet, and the vines were bent by the storm.

She walked slowly toward the house. A light was burning in the kitchen window. Someone was waiting for her, and she suddenly realised that she had known it all along.`

func novelProseBlock() Block {
	return Block{
		Slug:        "prose",
		Title:       "Prose analyser",
		Description: "Paste a passage for readability scores and the habits editors circle: -ly adverbs, filter words, possible passive voice, words repeated close together, and the rhythm of sentence lengths. Everything here is a heuristic for English prose, a prompt to reread, not a verdict.",
		Tags:        []string{"Flesch", "heuristics", "highlights"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("novel-prose", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-4 lg:border-r lg:border-b-0"),
					h.Textarea(h.Data("nv-field", "text"), h.Attr("rows", "7"), h.Aria("label", "Passage to analyse"),
						h.Class(novelFieldClass+" resize-y leading-relaxed"), novelProseSample),
					h.Div(h.Class("flex flex-wrap gap-1.5 text-[11px]"), h.Data("nv-legend", ""),
						h.Span(h.Class("rounded-sm bg-vec-out/25 px-1.5 py-0.5"), "-ly adverb"),
						h.Span(h.Class("rounded-sm bg-vec-u/20 px-1.5 py-0.5"), "filter word"),
						h.Span(h.Class("rounded-sm bg-brand/20 px-1.5 py-0.5"), "possible passive"),
						h.Span(h.Class("rounded-sm underline decoration-del decoration-wavy underline-offset-4 px-1.5 py-0.5"), "repeated nearby"),
					),
					h.Div(h.Data("nv-marked", ""), h.Class("scroll-thin max-h-72 overflow-auto rounded-lg border bg-code p-3 text-[15px] leading-7 whitespace-pre-wrap")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Sentence lengths (words)"),
						h.Svg(h.Data("nv-rhythm", ""), h.ViewBox("0 0 640 110"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Words per sentence")),
					),
				),
				h.Div(h.Class("flex flex-col gap-4 p-4"),
					readouts(
						[2]string{"words", "words"}, [2]string{"sentences", "sentences"}, [2]string{"syllables", "syllables"},
						[2]string{"Flesch ease", "fre"}, [2]string{"F–K grade", "fk"}, [2]string{"mean sentence", "msl"},
						[2]string{"-ly adverbs", "ly"}, [2]string{"filter words", "filter"}, [2]string{"passive?", "passive"}, [2]string{"repeats", "repeats"},
					),
					h.P(h.Data("nv-band", ""), h.Class("text-sm text-muted-foreground"), "—"),
					novelHeuristic("Syllables are counted by vowel groups, minus a silent final e, at least one per word; dictionaries would differ on some words. Passive voice is any form of 'be' followed by a word ending in -ed or a common irregular participle, so it also catches adjectives (\"was tired\"). English only."),
					novelSource("Flesch Reading Ease = 206.835 − 1.015 (words/sentences) − 84.6 (syllables/words). Flesch–Kincaid grade = 0.39 (words/sentences) + 11.8 (syllables/words) − 15.59."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

const novelDialogueSample = `"I told you not to come back," she exclaimed.
"Then why is the gate open." he said.
"Because I knew you would," She smiled.
"Fine" he growled, "but I'm not staying."
He set the bag down. "You always say that."`

func novelDialogueBlock() Block {
	return Block{
		Slug:        "dialogue",
		Title:       "Dialogue tag checker",
		Description: "Checks English dialogue punctuation and tags: a comma (not a full stop) before a speech tag, a lowercase tag after the comma, and said-bookisms that pull attention from the words. Actions like smiling can't speak a line: they belong in their own sentence as a beat.",
		Tags:        []string{"dialogue", "punctuation", "suggestions"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("novel-dialogue", ""),
				h.Textarea(h.Data("nv-field", "text"), h.Attr("rows", "6"), h.Aria("label", "Dialogue to check"),
					h.Class(novelFieldClass+" resize-y font-mono leading-relaxed sm:text-[13px]"), novelDialogueSample),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					panelLabel("Findings"),
					h.Span(h.Data("nv-dlg-count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
				),
				h.Ol(h.Data("nv-dlg-issues", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-2")),
				novelHeuristic("Uses American-style double quotes and English tag conventions. Bookisms are flagged as a style note, not an error: an occasional 'whispered' or 'asked' is normal."),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

const novelPOVSample = `I walked down to the harbour before dawn. The boats were still tied up and the water was black.

She watches the gulls circle above the market, and I wonder what she is waiting for.

He had never liked the sea. He said it took more than it gave.

I am standing at the end of the pier now, and the light is coming up over the cranes.`

func novelPOVBlock() Block {
	return Block{
		Slug:        "pov-tense",
		Title:       "POV and tense consistency",
		Description: "Paragraph by paragraph, counts first- and third-person pronouns and past- and present-tense verbs outside dialogue, then flags paragraphs that drift from the passage's main point of view or tense.",
		Tags:        []string{"heuristic", "per paragraph", "flags"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("novel-pov", ""),
				h.Textarea(h.Data("nv-field", "text"), h.Attr("rows", "7"), h.Aria("label", "Passage to check"),
					h.Class(novelFieldClass+" resize-y leading-relaxed"), novelPOVSample),
				h.Div(h.Class("flex flex-wrap items-center gap-x-6 gap-y-1 text-sm"),
					h.Span(h.Class("text-muted-foreground"), "Main POV ", h.Span(h.Data("nv-main-pov", ""), h.Class("font-medium text-foreground"), "—")),
					h.Span(h.Class("text-muted-foreground"), "Main tense ", h.Span(h.Data("nv-main-tense", ""), h.Class("font-medium text-foreground"), "—")),
				),
				h.Ol(h.Data("nv-pov-rows", ""), h.Class("flex flex-col gap-2")),
				novelHeuristic("A heuristic: it counts pronouns and a list of common past and present verb forms outside quotation marks. Free indirect style, flashbacks and frame narratives shift on purpose; read the flags as questions."),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

type novelSnowStep struct {
	key, title, prompt, placeholder, hint string
	rows                                  int
}

var novelSnowSteps = []novelSnowStep{
	{"sentence", "One sentence", "Summarise the whole novel in one sentence.", "A disgraced winemaker must trust the rival who ruined her father to save the vineyard before the harvest rots.", "Ingermanson suggests fewer than 15 words, no character names, tied to the big picture.", 2},
	{"paragraph", "One paragraph", "Expand it to a paragraph of about five sentences: the setup, three disasters, and the ending.", "Setup… First disaster… Second disaster… Third disaster… Ending…", "One sentence for the setup, one for each of three disasters, one for the ending.", 5},
	{"characters", "Characters", "For each major character: name, storyline in one sentence, motivation, goal, conflict, epiphany.", "Mara Vey: wants the vineyard back; motivation: her father's name; goal: pay the bank by October; conflict: no money, no allies; epiphany: she can't do it alone.", "A summary per character; the protagonist's epiphany usually answers the novel's lie.", 6},
	{"synopsis", "One-page synopsis", "Expand each sentence of the paragraph into a paragraph of its own.", "Paragraph per sentence of step 2…", "About a page: each disaster gets its own paragraph and ends on the next problem.", 8},
	{"charts", "Character charts", "Write a fuller description of each character: history, wants, how they change.", "Everything you know about each major character…", "These grow with the book; the full method continues with a scene list and a scene-by-scene description.", 8},
}

func novelSnowflakeBlock() Block {
	return Block{
		Slug:        "snowflake",
		Title:       "Snowflake method",
		Description: "Design a novel from the inside out: one sentence, then a paragraph, then characters, then a page, each step expanding the last. This stepper covers the first five of Randy Ingermanson's ten steps and keeps every step in your browser.",
		Tags:        []string{"stepper", "outline", "export"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("novel-snowflake", ""),
				h.Ol(h.Class("grid gap-1.5"), h.Style(fmt.Sprintf("grid-template-columns: repeat(%d, minmax(0, 1fr))", len(novelSnowSteps))), h.Aria("label", "Steps"),
					h.MapIdx(novelSnowSteps, func(i int, s novelSnowStep) h.Node {
						return h.Li(
							h.Button(h.Type("button"), h.Data("nv-goto", fmt.Sprint(i)),
								h.Class("flex w-full flex-col gap-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm"),
								h.Span(h.Data("nv-pip", fmt.Sprint(i)), h.Class("h-1 rounded-full bg-foreground/10 transition-colors duration-200 data-[on]:bg-brand data-[done]:bg-foreground")),
								h.Span(h.Class("hidden text-[11px] text-muted-foreground sm:block"), fmt.Sprintf("%d · %s", i+1, s.title)),
							),
						)
					}),
				),
				h.Div(h.Class("grid"),
					h.MapIdx(novelSnowSteps, func(i int, s novelSnowStep) h.Node {
						return h.Div(h.Data("nv-step", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col gap-2"),
							h.Div(h.Class("flex items-baseline justify-between gap-3"),
								h.H3(h.Class("text-base font-semibold tracking-tight"), fmt.Sprintf("Step %d · %s", i+1, s.title)),
								h.Span(h.Data("nv-wc", s.key), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0 words"),
							),
							h.P(h.Class("text-sm text-muted-foreground"), s.prompt),
							h.Textarea(h.Data("nv-field", s.key), h.Attr("rows", fmt.Sprint(s.rows)), h.Placeholder(s.placeholder), h.Aria("label", s.title),
								h.Class(novelFieldClass+" resize-y leading-relaxed")),
							h.P(h.Data("nv-hint", s.key), h.Class("text-xs text-muted-foreground"), s.hint),
						)
					}),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-go", "1"), "Next", hugeicons.ArrowRight01Icon()),
					),
					novelExport(),
				),
				novelSource("Randy Ingermanson, \"The Snowflake Method for Designing a Novel\" (advancedfictionwriting.com), and How to Write a Novel Using the Snowflake Method (2014)."),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func novelBriefBlock() Block {
	return Block{
		Slug:        "design-brief",
		Title:       "Novel Engineering design brief",
		Description: "Novel Engineering, from the Tufts University Center for Engineering Education and Outreach (CEEO), joins reading and engineering: students read a book, identify a problem a character faces, and design a solution that fits the story's world. This brief walks the engineering design process for one problem and prints on one page.",
		Tags:        []string{"Tufts CEEO", "design process", "print"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5"), h.Data("novel-brief", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Design brief"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Identify · constrain · imagine · design · test · reflect"),
					h.Div(h.Class("flex-1")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "example"), "Example"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "clear"), "Clear"),
				),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					novelInput("book", "Book", "Title and author", ""),
					novelInput("character", "Character", "Whose problem is it?", ""),
				),
				novelTextarea("problem", "1 · The problem", "What goes wrong for the character, in the story's own terms? Quote or cite the page.", 2, ""),
				novelTextarea("constraints", "2 · Constraints from the story", "Setting, time period, materials and tools the character could really have, what the character can and can't do…", 3, ""),
				novelTextarea("ideas", "3 · Brainstorm (one idea per line)", "Several different solutions before choosing", 3, ""),
				novelTextarea("design", "4 · Chosen design", "What you will build, a sketch description, and why it fits the constraints", 3, ""),
				novelTextarea("test", "5 · Test plan and results", "How you'll test the prototype, what happened, what you changed", 3, ""),
				novelTextarea("reflect", "6 · Reflection", "How would your solution change the story? What did the character need that a device can't give?", 2, ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2 border-t pt-4"),
					novelExport(),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("nv-action", "print"), hugeicons.PrinterIcon(), "Print"),
				),
				novelSource("Novel Engineering is a project of the Tufts University Center for Engineering Education and Outreach (novelengineering.org). This brief is a generic classroom tool built on the engineering design process, not an official Novel Engineering material."),
			)
		},
	}
}
