package site

import (
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- T6

func teachCohortBlock() Block {
	return Block{
		Slug:        "cohort-analytics",
		Title:       "Cohort analytics",
		Description: "Where a cohort of 400 synthetic learners stops, and where it struggles. The funnel shows how many reached each of 12 lessons and marks the steepest drop. Pick a lesson to see how long people spent on it (a skewed distribution, so the median is the honest summary) and how many attempts each of its exercises took.",
		Tags:        []string{"funnel", "drop-off", "heatmap"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-cohort", "Analytics",
				h.Group("Funnel bars are buttons; ", teachKbd("←"), teachKbd("→"), " move between lessons. The data is simulated from a seed, so a new cohort tells a different story."),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					teachBtn("resample", hugeicons.DiceIcon(), "New cohort"),
					h.Span(h.Data("tk", "summary"), h.Class("ml-auto font-mono text-xs tabular-nums text-muted-foreground")),
				),
				h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border bg-code p-2"),
					h.Svg(h.Data("tk", "funnel"), h.Class("block h-auto w-full min-w-[520px]"), h.Role("group"), h.Aria("label", "Lesson completion funnel")),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-2"),
					teachPanel("Time on lesson", h.Svg(h.Data("tk", "hist"), h.Class("block h-auto w-full"), h.Aria("hidden", "true")), teachSlot("timeinfo", "font-mono text-xs text-muted-foreground")),
					teachPanel("Attempts per exercise", teachSlot("heat", "min-w-0 overflow-x-auto"), teachSlot("heatinfo", "text-xs text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T7

func teachDecisionBlock() Block {
	return Block{
		Slug:        "variant-decision",
		Title:       "Ship the new lesson?",
		Description: "Two versions of a lesson ran side by side. This is the panel an instructor decides from: the primary metric (passing the end-of-lesson quiz) with its 95% interval, and two guardrails (finishing the lesson, time spent) that must not get clearly worse. The verdict is a rule written down before looking: ship, keep the old one, or keep collecting.",
		Tags:        []string{"A/B", "guardrails", "decision rule"},
		Render: func() h.Node {
			return teachTool("teach-decision", "Experiment",
				h.Group("The numbers are editable. Planning the sample size and the danger of peeking are covered in ",
					h.A(h.Href("/hci#ab-test"), h.Class("underline decoration-foreground/40 underline-offset-4 hover:decoration-brand"), "HCI & UX Research"), "."),
				h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border"), teachSlot("inputs", "")),
				teachSlot("metrics", "flex flex-col gap-3"),
				h.Div(h.Data("tk", "verdict"), h.Aria("live", "polite"), h.Class("rounded-xl border p-4")),
			)
		},
	}
}

// ---------------------------------------------------------------- T8

func teachCommentsBlock() Block {
	return Block{
		Slug:        "comment-bank",
		Title:       "Feedback comment bank",
		Description: "Comments an instructor writes again and again, saved once with tags and inserted with a click, with the learner's name filled in. As the feedback is written, a tone check looks for words that belittle (just, obviously, simply), for shouting, and for criticism with no next step. The checks are word lists, so they suggest, never decide.",
		Tags:        []string{"reusable feedback", "tone", "tags"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-comments", "Feedback",
				h.Group("Filter the bank by typing or by tag; ", teachKbd("Enter"), " on a comment inserts it at the cursor. {name} becomes the learner's name."),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.Div(h.Class("flex gap-2"),
							h.Label(h.For("teach-cb-filter"), h.Class("sr-only"), "Filter comments"),
							h.Input(h.ID("teach-cb-filter"), h.Type("search"), h.Data("tk", "filter"), h.Placeholder("Filter comments…"), h.Attr("autocomplete", "off"), h.Class(teachInputClass)),
						),
						teachSlot("tags", "flex flex-wrap gap-1.5"),
						h.Ul(h.Data("tk", "bank"), h.Class("flex max-h-80 flex-col gap-2 overflow-y-auto pr-1")),
						h.Form(h.Data("tk", "new"), h.Action("#"), h.Class("flex gap-2"),
							h.Label(h.For("teach-cb-new"), h.Class("sr-only"), "New comment"),
							h.Input(h.ID("teach-cb-new"), h.Type("text"), h.Placeholder("Save a new comment… #tag"), h.Attr("autocomplete", "off"), h.Class(teachInputClass)),
							teachBtn("save", hugeicons.Add01Icon(), "Save"),
						),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.Div(h.Class("flex items-center gap-2"),
							h.Label(h.For("teach-cb-name"), h.Class("text-sm text-muted-foreground"), "Learner"),
							h.Input(h.ID("teach-cb-name"), h.Type("text"), h.Data("tk", "name"), h.Value("Inès"), h.Attr("autocomplete", "off"), h.Class(teachInputClass+" w-40")),
						),
						h.Label(h.For("teach-cb-text"), h.Class("sr-only"), "Feedback"),
						h.Textarea(h.ID("teach-cb-text"), h.Data("tk", "text"), h.Attr("rows", "7"), h.Class(teachAreaClass),
							"Your proof is obviously incomplete. You just skipped the base case."),
						h.Ul(h.Data("tk", "tone"), h.Aria("live", "polite"), h.Class("flex flex-col gap-1.5")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T9

func teachHintRulesBlock() Block {
	return Block{
		Slug:        "misconception-rules",
		Title:       "Misconception rules",
		Description: "Write the feedback for wrong answers before learners give them. Each rule is an expression and a message: an answer equal to that expression (checked at random points by the same engine as the Assessment collection) gets the message. Test the rules against a list of real-looking wrong answers and see which ones no rule catches yet.",
		Tags:        []string{"authoring", "feedback", "coverage"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-rules", "Feedback rules",
				h.Group("The exercise: differentiate ", mathml(msup(mi("x"), mn("2")), mi("sin"), mi("x")), ". Expressions use x, sin, cos, ^ and implicit products; nothing is evaluated as code."),
				h.Div(h.Class("flex flex-wrap items-center gap-2 font-mono text-sm"),
					h.Span(h.Class("text-muted-foreground"), "accepted"),
					h.Label(h.For("teach-rules-key"), h.Class("sr-only"), "Accepted answer"),
					h.Input(h.ID("teach-rules-key"), h.Type("text"), h.Data("tk", "key"), h.Value("2x sin(x) + x^2 cos(x)"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Class(teachInputClass+" max-w-80 font-mono")),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-2"),
						h.Div(h.Class("flex items-center justify-between gap-2"), panelLabel("Rules"), teachBtn("add", hugeicons.Add01Icon(), "Add rule")),
						h.Ol(h.Data("tk", "rules"), h.Class("flex flex-col gap-2")),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-2"),
						h.Div(h.Class("flex items-center justify-between gap-2"), panelLabel("Test answers, one per line"), h.Span(h.Data("tk", "coverage"), h.Class("font-mono text-xs tabular-nums"))),
						h.Label(h.For("teach-rules-tests"), h.Class("sr-only"), "Test answers"),
						h.Textarea(h.ID("teach-rules-tests"), h.Data("tk", "tests"), h.Attr("rows", "7"), h.Attr("spellcheck", "false"), h.Class(teachAreaClass+" font-mono"),
							"2x cos(x)\nx^2 cos(x)\n2x sin(x) - x^2 cos(x)\nx^2 cos(x) + 2x sin(x)\n2x sin(x)\n2x + cos(x)\nsin(x) 2x + cos(x) x x\n2 sin(x) + x^2 cos(x)"),
						h.Div(h.Data("tk", "results"), h.Class("min-w-0 overflow-x-auto rounded-xl border")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- T10

func teachGradebookBlock() Block {
	return Block{
		Slug:        "gradebook",
		Title:       "Grade book",
		Description: "One learner's grades under a written policy: weighted categories, the lowest homework dropped, 10% off per day late up to a cap. Every number traces back to the rule that produced it. The what-if slider tries final-exam scores, and the tool solves for the score needed to reach a target grade.",
		Tags:        []string{"weights", "drop lowest", "what-if"},
		Wide:        true,
		Render: func() h.Node {
			return teachTool("teach-grades", "Grade book",
				h.Group("Scores and days late are editable; an empty score counts as not yet graded and is left out. Switch the policies to see each one's effect."),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"),
					h.Div(h.Class("min-w-0 overflow-x-auto rounded-xl border"), teachSlot("table", "")),
					h.Div(h.Class("flex flex-col gap-4"),
						h.Div(h.Class("flex flex-col gap-3"),
							panelLabel("Policy"),
							toggle("teach-grades-drop", "drop", "Drop lowest homework", true),
							toggle("teach-grades-late", "late", "10% per day late (max 50%)", true),
						),
						h.Div(h.Class("flex flex-col gap-2"),
							panelLabel("What if"),
							h.Label(h.For("teach-grades-final"), h.Class("flex items-center justify-between text-sm"),
								h.Span(h.Class("text-muted-foreground"), "Final exam"), h.Span(h.Data("tk", "finalv"), h.Class("font-mono tabular-nums"), "—")),
							h.Input(h.ID("teach-grades-final"), h.Type("range"), h.Data("tk", "final"), h.Attr("min", "0"), h.Attr("max", "100"), h.Value("70"), h.Class("w-full accent-brand")),
							h.Label(h.Class("flex items-center justify-between gap-2 text-sm"),
								h.Span(h.Class("text-muted-foreground"), "Target grade"),
								teachSelect("target", "Target grade", [2]string{"90", "A (90)"}, [2]string{"80", "B (80)"}, [2]string{"70", "C (70)"}, [2]string{"60", "D (60)"}),
							),
						),
						h.Div(h.Class("flex flex-col gap-1 border-t pt-4"),
							panelLabel("Course grade"),
							h.Span(h.Data("tk", "grade"), h.Class("font-mono text-3xl tabular-nums"), "—"),
							h.P(h.Data("tk", "needed"), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed text-muted-foreground")),
						),
					),
				),
				teachSlot("breakdown", "flex h-3 w-full overflow-hidden rounded-full border"),
			)
		},
	}
}
