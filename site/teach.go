package site

import (
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	nativeselect "github.com/alexisbcz/components/ui/native-select"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// TeachBlocks lists the instructor and course-author tools of the platform:
// the other side of the lessons. Each block root is data-teach-*; inner
// parts are named with data-tk so no inner attribute can be mistaken for a
// root. All data is synthetic and seeded, and state lives in the component.
func TeachBlocks() []Block {
	return []Block{
		teachGraphBlock(),
		teachItemsBlock(),
		teachObjectivesBlock(),
		teachRubricBlock(),
		teachStoryboardBlock(),
		teachCohortBlock(),
		teachDecisionBlock(),
		teachCommentsBlock(),
		teachHintRulesBlock(),
		teachGradebookBlock(),
	}
}

// teachInputClass is the shadcn input at 16px on phones (no iOS zoom).
const teachInputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

// teachAreaClass is the matching textarea.
const teachAreaClass = "w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

// teachTool is the frame of every instructor tool: a role badge, a status
// line the module writes, the body, and a help line at the bottom.
func teachTool(attr, role string, help h.Node, children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex min-w-0 flex-col gap-5"), h.Data(attr, ""),
		h.Div(h.Class("flex flex-wrap items-center gap-2"),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), role),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal text-muted-foreground"), "instructor"),
			h.Span(h.Data("tk", "status"), h.Aria("live", "polite"), h.Class("ml-auto font-mono text-xs text-muted-foreground tabular-nums")),
		),
	}, append(children,
		h.P(h.Class("border-t pt-4 text-xs leading-relaxed text-muted-foreground"), help),
	)...)...)
}

// teachBtn is an outline button the module finds by its data-tk name.
func teachBtn(name string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("tk", name), icon, label)
}

func teachKbd(keys ...string) h.Node {
	return h.Span(h.Class("inline-flex gap-0.5 align-middle"), h.Map(keys, func(k string) h.Node { return kbd.Kbd(k) }))
}

// teachPanel is a bordered region with a small uppercase label.
func teachPanel(label string, children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex min-w-0 flex-col gap-3 rounded-xl border bg-background p-4"), panelLabel(label)}, children...)...)
}

// teachSlot is an empty container the module fills.
func teachSlot(name, class string) h.Node {
	return h.Div(h.Data("tk", name), h.Class(class))
}

func teachSelect(name, label string, opts ...[2]string) h.Node {
	return nativeselect.NativeSelect(nativeselect.SizeSm, h.Data("tk", name), h.Aria("label", label),
		h.Map(opts, func(o [2]string) h.Node { return nativeselect.Option(h.Value(o[0]), o[1]) }))
}

// ---------------------------------------------------------------- T1

func teachGraphBlock() Block {
	return Block{
		Slug:        "prerequisite-graph",
		Title:       "Prerequisite graph",
		Description: "The course as a graph of concepts and prerequisites. Add or remove an edge and the tool checks for cycles, then lays the concepts out in the order they unlock. Switch on a learner's mastery to see the frontier: the concepts whose prerequisites are all mastered, which is what that learner should be offered next.",
		Tags:        []string{"DAG", "topological order", "frontier"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-graph", "Course map",
				h.Group("Select a concept and press ", teachKbd("Space"), " to mark it mastered in learner view. Edges are added from the two menus; a cycle is refused and the loop is named."),
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border bg-code p-2"),
						h.Svg(h.Data("tk", "svg"), h.Class("block h-auto w-full min-w-[640px]"), h.Role("group"), h.Aria("label", "Concept graph")),
					),
					h.Div(h.Class("grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
						h.Div(h.Class("flex flex-col gap-2"),
							panelLabel("Add a prerequisite"),
							h.Div(h.Class("grid grid-cols-[1fr_auto_1fr] items-center gap-2"),
								teachSlot("from", ""), h.Span(h.Class("text-xs text-muted-foreground"), "before"), teachSlot("to", ""),
							),
							h.Div(h.Class("flex flex-wrap gap-2"),
								teachBtn("add", hugeicons.Add01Icon(), "Add edge"),
								teachBtn("remove", hugeicons.Delete02Icon(), "Remove edge"),
								teachBtn("reset", hugeicons.RefreshIcon(), "Reset"),
							),
						),
						h.Div(h.Class("flex flex-col gap-3"),
							toggle("teach-graph-learner", "learner", "Learner view", false),
							h.Div(h.Data("tk", "msg"), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed empty:hidden")),
						),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("Unlock order"),
						h.Ol(h.Data("tk", "order"), h.Class("flex flex-wrap gap-1.5 font-mono text-[11px]")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T2

func teachItemsBlock() Block {
	return Block{
		Slug:        "item-analysis",
		Title:       "Item analysis",
		Description: "After a quiz, which questions did their job? 120 synthetic learners answered 12 multiple-choice items. For each item: difficulty (the share right), discrimination (the correlation with the rest of the test, and the upper–lower 27% index), and Cronbach's α if the item were dropped. Rules flag items to rewrite; pick an item to see how each option drew the strong and the weak learners.",
		Tags:        []string{"difficulty", "discrimination", "Cronbach's α"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-items", "Quiz report",
				h.Group("Rows are buttons: ", teachKbd("↑"), teachKbd("↓"), " move between items. Flags: p above 0.90 (too easy), below 0.20 (too hard), item–rest r below 0.20 (weak) or negative (check the key)."),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					teachBtn("resample", hugeicons.DiceIcon(), "New cohort"),
					h.Dl(h.Class("ml-auto flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs"),
						h.Div(h.Class("flex gap-2"), h.Dt(h.Class("text-muted-foreground"), "learners"), h.Dd(h.Data("tk", "n"), h.Class("tabular-nums"), "—")),
						h.Div(h.Class("flex gap-2"), h.Dt(h.Class("text-muted-foreground"), "mean score"), h.Dd(h.Data("tk", "mean"), h.Class("tabular-nums"), "—")),
						h.Div(h.Class("flex gap-2"), h.Dt(h.Class("text-muted-foreground"), "Cronbach's α"), h.Dd(h.Data("tk", "alpha"), h.Class("tabular-nums"), "—")),
					),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border"), teachSlot("table", "")),
					teachPanel("Options of the selected item", teachSlot("options", "grid gap-x-8 gap-y-3 md:grid-cols-2")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T3

func teachObjectivesBlock() Block {
	return Block{
		Slug:        "learning-objectives",
		Title:       "Learning objectives and alignment",
		Description: "Write an objective and the tool finds its verb on the revised Bloom taxonomy (Anderson & Krathwohl, 2001), flags verbs nobody can observe (understand, know, appreciate), and looks for a condition and a criterion. Below, the alignment matrix: every objective should be practised by an activity and checked by an assessment.",
		Tags:        []string{"Bloom", "measurable", "alignment"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-objectives", "Objectives",
				h.Group("Press ", teachKbd("Enter"), " to add the objective to the matrix. Matrix cells are checkboxes. The verb list is a guide, not a rule: the same verb can sit at two levels depending on the task."),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Label(h.For("teach-obj-in"), h.Class("text-sm font-medium"), "By the end of the lesson, learners will be able to…"),
					h.Div(h.Class("flex gap-2"),
						h.Input(h.ID("teach-obj-in"), h.Type("text"), h.Data("tk", "input"), h.Attr("autocomplete", "off"),
							h.Value("compute the determinant of a 3×3 matrix by cofactor expansion, with no errors in 4 of 5 attempts"),
							h.Class(teachInputClass)),
						teachBtn("add", hugeicons.Add01Icon(), "Add"),
					),
				),
				teachSlot("analysis", "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
				teachSlot("ladder", "flex flex-col gap-1"),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex items-center justify-between gap-2"), panelLabel("Alignment matrix"), h.Span(h.Data("tk", "gaps"), h.Class("font-mono text-xs text-muted-foreground"))),
					h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border"), teachSlot("matrix", "")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T4

func teachRubricBlock() Block {
	return Block{
		Slug:        "rubric-builder",
		Title:       "Rubric builder",
		Description: "An analytic rubric for a project: criteria in rows, four levels in columns, a descriptor in every cell and a weight per criterion. Edit any cell, then grade a submission by picking one level per criterion; the score is the weighted mean. Weights that don't sum to 100% are flagged, and the whole rubric copies as a Markdown table.",
		Tags:        []string{"criteria", "weights", "Markdown"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-rubric", "Rubric",
				h.Group("Descriptors are editable text. The 4 3 2 1 buttons under each criterion grade a submission; ", teachKbd("←"), teachKbd("→"), " move between levels."),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					teachBtn("add", hugeicons.Add01Icon(), "Add criterion"),
					teachBtn("copy", hugeicons.Copy01Icon(), "Copy as Markdown"),
					teachBtn("clear", hugeicons.Undo02Icon(), "Clear grades"),
					h.Span(h.Data("tk", "weights"), h.Class("ml-auto font-mono text-xs tabular-nums")),
				),
				h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border"), teachSlot("grid", "")),
				h.Div(h.Class("flex flex-wrap items-end justify-between gap-3"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Score"), h.Span(h.Data("tk", "score"), h.Class("font-mono text-2xl tabular-nums"), "—")),
					h.P(h.Data("tk", "detail"), h.Class("max-w-md text-right text-xs text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T5

func teachStoryboardBlock() Block {
	return Block{
		Slug:        "lesson-storyboard",
		Title:       "Lesson storyboard",
		Description: "Plan a lesson section by section. Each section has a kind and a size, words, minutes of video or a number of exercises, and the tool estimates its time: 230 words a minute for reading, video at 1.3× its length for pauses and replays, 3 minutes an exercise. A timeline shows the rhythm against the target length, and warnings point at long stretches without practice or too many new terms at once.",
		Tags:        []string{"time estimate", "pacing", "cognitive load"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-story", "Storyboard",
				h.Group("Move a section with ", teachKbd("Alt", "↑"), " / ", teachKbd("Alt", "↓"), " or the arrow buttons. The rates are rough averages for adults; change the target to see the timeline rescale."),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					teachBtn("add", hugeicons.Add01Icon(), "Add section"),
					h.Label(h.Class("flex items-center gap-2 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "Target"),
						h.Input(h.Type("number"), h.Data("tk", "target"), h.Value("30"), h.Attr("min", "5"), h.Attr("max", "120"), h.Attr("step", "5"),
							h.Class(teachInputClass+" w-20 font-mono tabular-nums")),
						h.Span(h.Class("font-mono text-xs text-muted-foreground"), "min"),
					),
					h.Span(h.Data("tk", "total"), h.Class("ml-auto font-mono text-xs tabular-nums")),
				),
				teachSlot("timeline", "flex h-8 w-full overflow-hidden rounded-md border"),
				h.Ol(h.Data("tk", "list"), h.Class("flex flex-col gap-2")),
				h.Ul(h.Data("tk", "warnings"), h.Aria("live", "polite"), h.Class("flex flex-col gap-1.5 empty:hidden")),
			)
		},
	}
}
