package site

import (
	"fmt"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/sidebar"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- 16

func courseShellBlock() Block {
	return Block{
		Slug:        "course-shell",
		Title:       "Course sidebar",
		Description: "The course shell, after Hypercode's: the shadcn Sidebar with the course progress, chapters as groups and numbered lessons, a reading column. Done lessons turn pink, and a finished chapter says so: press Complete to see it. The trigger or ⌘B collapses the sidebar; below 768px it becomes a sheet.",
		Tags:        []string{"sidebar", "app shell", "⌘B"},
		Wide:        true,
		Render:      courseShell,
	}
}

type chapter struct {
	title   string
	lessons []string
}

var chapters = []chapter{
	{"Vectors", []string{"Arrows and lists", "Adding and scaling", "Length and angle", "The dot product"}},
	{"Linear combinations", []string{"Span", "Linear independence", "Basis and dimension"}},
	{"Linear maps", []string{"What makes a map linear", "Matrices as transformations", "Composition", "Kernel and image", "Rank–nullity"}},
	{"Determinants", []string{"Area scaling", "Computing determinants", "Inverses"}},
	{"Eigenvalues", []string{"Vectors that stay on their line", "The characteristic polynomial", "Diagonalization"}},
}

const lessonsDone = 3

// currentLesson is the title of the first lesson not done.
func currentLesson() string {
	n := 0
	for _, c := range chapters {
		for _, l := range c.lessons {
			if n == lessonsDone {
				return l
			}
			n++
		}
	}
	return ""
}

func courseShell() h.Node {
	total := 0
	for _, c := range chapters {
		total += len(c.lessons)
	}
	n := 0
	return h.Div(h.Class("overflow-hidden rounded-xl border bg-background shadow-xs"), h.Data("shell", ""),
		sidebar.Provider(sidebar.DefaultOpen(true), h.Class("relative h-[640px] min-h-0"),
			sidebar.Sidebar(h.Class("absolute h-full"),
				sidebar.Header(h.Class("gap-3 px-4 pt-4"),
					h.A(h.Href("#course-shell"), h.Class("flex items-center gap-2 text-lg font-semibold tracking-tight text-brand"),
						logoMark(), "Hypercode"),
					h.Div(h.Class("flex items-center gap-3 text-xs text-muted-foreground"),
						h.Span("Progress"),
						h.Div(h.Data("progress", ""), h.Class("h-1 flex-1 overflow-hidden rounded-full bg-foreground/10"), h.Role("progressbar"),
							h.Aria("valuenow", fmt.Sprint(lessonsDone)), h.Aria("valuemax", fmt.Sprint(total)), h.Aria("label", "Course progress"),
							h.Div(h.Data("bar", ""), h.Class("h-full rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)]"), h.Style(fmt.Sprintf("width:%.1f%%", 100*float64(lessonsDone)/float64(total)))),
						),
						h.Span(h.Data("count", ""), h.Class("font-mono tabular-nums"), fmt.Sprintf("%d/%d", lessonsDone, total)),
					),
					sidebar.Menu(sidebar.MenuItem(
						sidebar.MenuButton(lib.AsChild, h.Class("data-[active=true]:bg-brand/10 data-[active=true]:text-brand"),
							h.A(h.Href("#course-shell"), hugeicons.Book02Icon(), h.Span("Introduction"))),
					)),
				),
				sidebar.Content(h.Class("scroll-thin"),
					h.Map(chapters, func(c chapter) h.Node {
						return sidebar.Group(h.Data("chapter-group", ""),
							chapterLabel(c, max(0, min(len(c.lessons), lessonsDone-n))),
							sidebar.GroupContent(sidebar.Menu(
								h.Map(c.lessons, func(title string) h.Node {
									n++
									done, current := n <= lessonsDone, n == lessonsDone+1
									return sidebar.MenuItem(
										sidebar.MenuButton(lib.AsChild, sidebar.IsActive(current),
											h.Class("data-[active=true]:bg-brand/10 data-[active=true]:font-normal data-[active=true]:text-brand"),
											h.A(h.Href("#course-shell"), h.Data("lesson", title), lessonNumber(n, done, current), h.Span(title)),
										),
									)
								}),
							)),
						)
					}),
				),
				sidebar.Footer(h.Class("border-t p-3"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, lib.AsChild, h.A(h.Href("https://github.com/alexisbcz"), hugeicons.GithubIcon(), "GitHub")),
						button.Button(button.VariantOutline, button.SizeSm, lib.AsChild, h.A(h.Href("#course-shell"), hugeicons.DiscordIcon(), "Discord")),
					),
				),
			),
			sidebar.Inset(h.Class("min-h-0 overflow-hidden"),
				h.Header(h.Class("flex h-12 shrink-0 items-center gap-2 border-b px-3"),
					sidebar.Trigger(),
					h.Span(h.Class("truncate text-sm text-muted-foreground"), "Linear Algebra · Introduction"),
					h.Div(h.Class("flex-1")),
					button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"),
						h.Data("theme-toggle", ""), h.Aria("label", "Toggle theme"),
						hugeicons.Sun03Icon(h.Class("hidden dark:block")), hugeicons.Moon02Icon(h.Class("dark:hidden"))),
				),
				h.Div(h.Class("scroll-thin relative min-h-0 flex-1 overflow-y-auto"),
					introArticle(total),
				),
				h.Footer(h.Class("relative flex h-12 shrink-0 items-center justify-between border-t px-3"),
					button.Button(button.VariantGhost, button.SizeSm, h.Class("text-muted-foreground"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Previous"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("complete", ""),
						hugeicons.Tick02Icon(), h.Span(h.Data("complete-label", ""), "Complete “"+currentLesson()+"”")),
					// The tutor, one click away on every lesson.
					button.Button(button.VariantOutline, button.SizeIcon, h.Type("button"), h.Aria("label", "Ask the tutor"),
						h.Class("absolute right-4 -top-14 size-10 rounded-full bg-background shadow-md"),
						hugeicons.BubbleChatSparkIcon()),
				),
			),
		),
	)
}

// lessonNumber is the lesson's number in a ring. Done, it turns into a
// pink check (static/js/shell.js animates the change); current, the ring
// takes the brand color.
func lessonNumber(n int, done, current bool) h.Node {
	state := "todo"
	switch {
	case done:
		state = "done"
	case current:
		state = "current"
	}
	return h.Span(h.Data("lesson-dot", ""), h.Data("state", state),
		h.Class("group/dot relative flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground tabular-nums transition-[background-color,border-color,color] duration-200 ease-[var(--ease-out)] "+
			"data-[state=current]:border-brand data-[state=current]:text-brand "+
			"data-[state=done]:border-transparent data-[state=done]:bg-brand data-[state=done]:text-white data-[state=done]:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_18%,transparent)]"),
		h.Span(h.Class("group-data-[state=done]/dot:hidden"), fmt.Sprint(n)),
		hugeicons.Tick02Icon(h.Data("check", ""), h.Class("hidden !size-3 group-data-[state=done]/dot:block"), h.StrokeWidth("3")),
	)
}

// chapterLabel is a chapter's title, with a pink check once all its
// lessons are done.
func chapterLabel(c chapter, done int) h.Node {
	complete := done >= len(c.lessons)
	return sidebar.GroupLabel(h.Class("gap-2 font-mono text-[11px] tracking-wider uppercase"), h.Data("chapter", ""),
		h.Span(c.title),
		h.Span(h.Data("chapter-check", ""), h.If(!complete, h.Hidden()),
			h.Class("flex items-center gap-1 rounded-full bg-brand/12 px-1.5 py-px font-sans text-[10px] font-medium tracking-normal text-brand normal-case"),
			hugeicons.Tick02Icon(h.Class("!size-2.5"), h.StrokeWidth("3")), "Done"),
	)
}

func introArticle(total int) h.Node {
	lead := func(b, rest string) h.Node {
		return h.Li(h.Span(h.Class("font-medium text-foreground"), b), " — ", rest)
	}
	return h.Article(h.Class("mx-auto flex max-w-[65ch] flex-col gap-5 px-6 py-10 text-[15px] leading-relaxed text-muted-foreground"),
		h.H3(h.Class("text-3xl font-semibold tracking-tight text-foreground"), "Introduction"),
		h.H4(h.Class("pt-2 text-xl font-semibold tracking-tight text-foreground"), "Why linear algebra?"),
		h.P("Linear algebra is the mathematics of the modern computer. It renders every frame of a game, ranks every search result, compresses every photo and trains every neural network. Learn it by building it, and you can read the code behind all of them."),
		h.Ul(h.Class("flex list-disc flex-col gap-2 pl-5 marker:text-foreground/40"),
			lead("Graphics", "rotations, projections and cameras are matrices."),
			lead("Machine learning", "a neural network layer is a matrix times a vector, plus a bend."),
			lead("Data", "PCA, least squares and recommendations are eigenvectors and projections."),
			lead("Physics", "states, forces and quantum mechanics live in vector spaces."),
		),
		h.H4(h.Class("pt-2 text-xl font-semibold tracking-tight text-foreground"), "What you will build"),
		h.P("This course has ", h.Span(h.Class("font-medium text-foreground"), fmt.Sprintf("%d lessons", total)),
			" in ", h.Span(h.Class("font-medium text-foreground"), fmt.Sprintf("%d chapters", len(chapters))),
			". Every lesson ends with code you write and tests that check it:"),
		h.Ol(h.Class("flex list-decimal flex-col gap-2 pl-5 marker:font-mono marker:text-xs marker:text-foreground/50"),
			h.Map(chapters, func(c chapter) h.Node {
				return h.Li(h.Span(h.Class("font-medium text-foreground"), c.title), " — ", c.lessons[0], ", ", c.lessons[1], "…")
			}),
		),
		h.P(h.Class("pt-2"), "All you need is high school algebra and a little Python. Press ",
			h.Kbd(h.Class("rounded border bg-muted px-1 font-mono text-xs text-foreground"), "⌘B"),
			" to hide the sidebar while you read."),
	)
}
