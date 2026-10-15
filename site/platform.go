package site

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/label"
	"github.com/alexisbcz/components/ui/sonner"
	switchui "github.com/alexisbcz/components/ui/switch"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PlatformBlocks lists the platform's own interface components: the
// product around the lessons rather than a subject.
func PlatformBlocks() []Block {
	return []Block{
		platPaletteBlock(),
		platDashboardBlock(),
		platStreakBlock(),
		platPlayerBlock(),
		platNotesBlock(),
		platDiscussionBlock(),
		platLeaderboardBlock(),
		platAchievementsBlock(),
		platCertificateBlock(),
		platTourBlock(),
		platPricingBlock(),
		platSettingsBlock(),
	}
}

// platDemo marks a block whose data is invented for the demo.
func platDemo() h.Node {
	return badge.Badge(badge.VariantOutline, h.Class("font-mono text-[10px] font-normal text-muted-foreground"), "demo data")
}

// platBase is a hidden link to the site root. Its href is rebased by the
// static exporter, so scripts read it to build links under any base path.
func platBase() h.Node {
	return h.A(h.Href("/"), h.Data("plat-base", ""), h.Hidden(), h.Aria("hidden", "true"), h.TabIndex(-1))
}

func platCard(children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-xs")}, children...)...)
}

// ---------------------------------------------------------------- P1

type platEntry struct {
	S string   `json:"s"` // subject name
	P string   `json:"p"` // page path, relative to the site root
	B string   `json:"b"` // block slug
	T string   `json:"t"`
	D string   `json:"d"`
	G []string `json:"g,omitempty"`
}

// platIndex lists every block of every collection, for the palette.
func platIndex() (string, int, int) {
	var entries []platEntry
	cols := Collections()
	for _, c := range cols {
		for _, b := range c.Blocks() {
			entries = append(entries, platEntry{S: c.Name, P: strings.TrimPrefix(c.Path, "/"), B: b.Slug, T: b.Title, D: b.Description, G: b.Tags})
		}
	}
	js, _ := json.Marshal(entries)
	return string(js), len(entries), len(cols)
}

func platPaletteBlock() Block {
	return Block{
		Slug:        "command-palette",
		Title:       "Command palette",
		Description: "Search every block of every subject from one box. Fuzzy matching with the matched letters marked, results grouped by subject, arrows and Enter to go, Esc to close. Press ⌘K or Ctrl+K anywhere on this page.",
		Tags:        []string{"⌘K", "fuzzy search", "dialog"},
		Wide:        true,
		Render: func() h.Node {
			index, nBlocks, nSubjects := platIndex()
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("plat-palette", ""), h.Data("index", index),
				platBase(),
				h.Button(h.Type("button"), h.Data("open", ""),
					h.Class("group flex h-12 w-full items-center gap-3 rounded-xl border bg-background px-4 text-left text-muted-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
					hugeicons.Search01Icon(h.Class("size-4")),
					h.Span(h.Class("flex-1 text-sm"), fmt.Sprintf("Search %d blocks in %d subjects…", nBlocks, nSubjects)),
					kbd.Group(kbd.Kbd("⌘"), kbd.Kbd("K")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2 text-xs text-muted-foreground"),
					h.Span("Try"),
					h.Map([]string{"fourier", "enzyme", "nash", "pid", "gel"}, func(q string) h.Node {
						return h.Button(h.Type("button"), h.Data("try", q),
							h.Class("rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"), q)
					}),
					h.Span(h.Data("recent-label", ""), h.Hidden(), h.Class("ml-2"), "Recent"),
					h.Span(h.Data("recent", ""), h.Class("flex flex-wrap gap-2")),
				),
				// The dialog itself: native <dialog> gives focus trapping, Esc
				// and the top layer for free.
				h.El("dialog", h.Data("dialog", ""), h.Aria("label", "Search blocks"),
					h.Class("plat-dialog m-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"),
					h.Div(h.Class("flex items-center gap-3 border-b px-4"),
						hugeicons.Search01Icon(h.Class("size-4 shrink-0 text-muted-foreground")),
						h.Input(h.Type("search"), h.Data("query", ""), h.Placeholder("Search blocks, subjects, tags…"), h.Aria("label", "Search"),
							h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Role("combobox"), h.Aria("expanded", "true"), h.Aria("controls", "plat-results"),
							h.Class("h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm")),
						kbd.Kbd(h.Class("hidden sm:inline-flex"), "Esc"),
					),
					h.Div(h.ID("plat-results"), h.Role("listbox"), h.Data("results", ""), h.Class("scroll-thin max-h-[min(60vh,440px)] overflow-y-auto p-2")),
					h.Div(h.Class("flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground"),
						h.Span(h.Class("flex items-center gap-1"), kbd.Kbd("↑"), kbd.Kbd("↓"), "move"),
						h.Span(h.Class("flex items-center gap-1"), kbd.Kbd("⏎"), "open"),
						h.Span(h.Data("count", ""), h.Class("ml-auto font-mono tabular-nums")),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func platDashboardBlock() Block {
	return Block{
		Slug:        "learner-dashboard",
		Title:       "Learner dashboard",
		Description: "The home screen after sign-in: experience over the last 30 days, the weekly goal, progress per subject, reviews due today, and the one lesson to do next.",
		Tags:        []string{"rings", "sparkline", "cards"},
		Wide:        true,
		Render:      platDashboard,
	}
}

// platXP is a deterministic demo series: 30 days of experience points.
func platXP() []int {
	out := make([]int, 30)
	seed := uint32(17)
	for i := range out {
		seed = seed*1664525 + 1013904223
		base := 40 + 25*math.Sin(float64(i)/4)
		if (seed>>24)%7 == 0 {
			base = 0 // a day off
		}
		out[i] = int(base) + int((seed>>16)%30)
		if base == 0 {
			out[i] = 0
		}
	}
	return out
}

func platDashboard() h.Node {
	xp := platXP()
	total, maxV := 0, 1
	for _, v := range xp {
		total += v
		maxV = max(maxV, v)
	}
	week := 0
	for _, v := range xp[23:] {
		week += v
	}
	const W, H = 320, 64
	var pts []string
	for i, v := range xp {
		pts = append(pts, fmt.Sprintf("%.1f,%.1f", float64(i)*W/29, H-4-float64(v)*(H-8)/float64(maxV)))
	}
	area := "M0," + fmt.Sprint(H) + " L" + strings.Join(pts, " L") + fmt.Sprintf(" L%d,%d Z", W, H)
	subjects := []struct {
		name       string
		done, all  int
		path, next string
	}{
		{"Linear Algebra", 8, 16, "/", "Matrices as transformations"},
		{"Machine Learning", 3, 10, "/ml", "Gradient descent"},
		{"Genetics", 1, 10, "/genetics", "Linkage and recombination"},
	}
	reviews := [][2]string{{"Eigenvalues", "Linear Algebra"}, {"Softmax", "Machine Learning"}, {"Hardy–Weinberg", "Biology"}, {"Ohm's law", "Electromagnetism"}}
	return h.Div(h.Class("flex flex-col gap-3"),
		h.Div(h.Class("flex items-center justify-between gap-3"),
			h.Div(h.Class("flex flex-col"),
				h.Span(h.Class("text-lg font-semibold tracking-tight"), "Good afternoon, Ada"),
				h.Span(h.Class("text-sm text-muted-foreground"), "You're 3 days into a streak. One lesson keeps it."),
			),
			platDemo(),
		),
		h.Div(h.Class("grid gap-3 md:grid-cols-[2fr_1fr]"),
			platCard(
				h.Div(h.Class("flex items-baseline justify-between"),
					panelLabel("Experience · 30 days"),
					h.Span(h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("%d XP", total)),
				),
				h.Svg(h.ViewBox(fmt.Sprintf("0 0 %d %d", W, H)), h.Attr("preserveAspectRatio", "none"), h.Class("h-20 w-full"), h.Role("img"),
					h.Aria("label", fmt.Sprintf("Daily XP over 30 days, %d in total", total)),
					h.El("path", h.Attr("d", area), h.Style("fill:var(--brand);fill-opacity:0.12")),
					h.El("polyline", h.Attr("points", strings.Join(pts, " ")), h.Attr("vector-effect", "non-scaling-stroke"),
						h.Style("fill:none;stroke:var(--brand);stroke-width:1.75;stroke-linejoin:round")),
				),
				h.Div(h.Class("flex justify-between font-mono text-[10px] text-muted-foreground"), h.Span("30 days ago"), h.Span("today")),
			),
			platCard(
				panelLabel("Weekly goal"),
				h.Div(h.Class("flex items-center gap-4"),
					h.Div(h.Class("text-brand"), progressRing(min(week, 350), 350, 64)),
					h.Div(h.Class("flex flex-col text-sm"),
						h.Span(h.Class("font-medium tabular-nums"), fmt.Sprintf("%d / 350 XP", week)),
						h.Span(h.Class("text-xs text-muted-foreground"), h.IfElse(week >= 350, "Goal reached this week", fmt.Sprintf("%d XP to go, 4 days left", 350-week))),
					),
				),
			),
		),
		h.Div(h.Class("grid gap-3 md:grid-cols-3"),
			platCard(
				panelLabel("Subjects"),
				h.Ul(h.Class("flex flex-col gap-3"),
					h.Map(subjects, func(s struct {
						name       string
						done, all  int
						path, next string
					}) h.Node {
						return h.Li(h.A(h.Href(s.path), h.Class("flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"),
							progressRing(s.done, s.all, 36),
							h.Span(h.Class("flex min-w-0 flex-col"),
								h.Span(h.Class("truncate text-sm font-medium"), s.name),
								h.Span(h.Class("truncate text-xs text-muted-foreground"), "Next: "+s.next)),
						))
					}),
				),
			),
			platCard(
				h.Div(h.Class("flex items-baseline justify-between"), panelLabel("Reviews due"), h.Span(h.Class("font-mono text-xs text-brand tabular-nums"), fmt.Sprint(len(reviews)))),
				h.Ul(h.Class("flex flex-col divide-y text-sm"),
					h.Map(reviews, func(r [2]string) h.Node {
						return h.Li(h.Class("flex items-center justify-between gap-2 py-2"),
							h.Span(h.Class("truncate"), r[0]),
							h.Span(h.Class("shrink-0 text-xs text-muted-foreground"), r[1]))
					}),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Class("mt-auto"), hugeicons.Clock01Icon(), "Review now · ≈ 4 min"),
			),
			platCard(
				panelLabel("Up next"),
				h.Div(h.Class("flex flex-col gap-1"),
					h.Span(h.Class("text-base font-semibold tracking-tight text-balance"), "Matrices as linear transformations"),
					h.Span(h.Class("text-sm text-muted-foreground"), "Linear Algebra · lesson 3.2 · 18 min · +120 XP"),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Picked because you finished 3.1 yesterday and its reviews are fresh."),
				button.Button(button.VariantOutline, button.SizeSm, h.Class("mt-auto"), lib.AsChild, h.A(h.Href("/linalg#lesson-header"), hugeicons.PlayIcon(), "Continue")),
			),
		),
	)
}

// ---------------------------------------------------------------- P3

func platStreakBlock() Block {
	return Block{
		Slug:        "streak-calendar",
		Title:       "Streak calendar",
		Description: "A year of practice at a glance, GitHub-style: one square per day, darker for more minutes. Current and longest streaks count a freeze day as kept, which is how a missed day stops ending a run.",
		Tags:        []string{"heatmap", "streaks", "tooltip"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("plat-streak", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-x-6 gap-y-2"),
					h.Dl(h.Class("flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs"),
						platStat("current", "current"), platStat("longest", "longest"),
						platStat("active days", "active"), platStat("freezes used", "freezes")),
					h.Div(h.Class("flex-1")),
					platDemo(),
				),
				h.Div(h.Class("scroll-thin relative overflow-x-auto"),
					h.Svg(h.Data("grid", ""), h.ViewBox("0 0 720 112"), h.Class("block min-w-[640px] w-full"), h.Role("img"), h.Aria("label", "Minutes practised per day over the last year")),
					h.Div(h.Data("tip", ""), h.Hidden(), h.Class("pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md")),
				),
				h.Div(h.Class("flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground"),
					"Less",
					h.Range(5, func(i int) h.Node {
						return h.Span(h.Class("size-2.5 rounded-[2px]"), h.Style(platLevel(i)))
					}),
					"More",
					h.Span(h.Class("ml-3 flex items-center gap-1.5"), h.Span(h.Class("size-2.5 rounded-[2px] ring-1 ring-vec-u ring-inset")), "freeze"),
				),
			)
		},
	}
}

func platStat(lbl, key string) h.Node {
	return h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), lbl), h.Dd(h.Data("out", key), h.Class("tabular-nums"), "—"))
}

// platLevel is the fill for activity level 0–4.
func platLevel(i int) string {
	if i == 0 {
		return "background:color-mix(in oklab,var(--foreground) 8%,transparent)"
	}
	return fmt.Sprintf("background:color-mix(in oklab,var(--brand) %d%%,transparent)", []int{0, 30, 52, 75, 100}[i])
}

// ---------------------------------------------------------------- P4

type platLine struct {
	t    float64
	text string
}

var platChapters = []struct {
	t     float64
	title string
}{{0, "Vectors that stay put"}, {38, "The eigen equation"}, {82, "Finding eigenvalues"}, {131, "Why it matters"}}

var platTranscript = []platLine{
	{0, "Most vectors change direction when a matrix acts on them."},
	{6, "A few special ones don't: they only stretch, shrink or flip."},
	{13, "Those are the eigenvectors, and how much they stretch is the eigenvalue."},
	{21, "Picture the plane being sheared: one direction keeps sliding along itself."},
	{30, "That direction is an eigenvector of the shear."},
	{38, "In symbols, A v equals lambda v."},
	{45, "The matrix does to v exactly what multiplying by a number would do."},
	{53, "Move everything to one side: A minus lambda I, times v, is zero."},
	{62, "For a non-zero v, that matrix must squash some direction to nothing."},
	{71, "So its determinant is zero."},
	{82, "For a two by two matrix, the determinant gives a quadratic in lambda."},
	{91, "Its roots are the eigenvalues: one, two, or a complex pair."},
	{101, "Take A with rows two one and one two: lambda is three or one."},
	{112, "Plug each back in to get its line of eigenvectors."},
	{122, "Three goes with the diagonal, one with the anti-diagonal."},
	{131, "Eigenvectors are the axes along which a transformation is simple."},
	{140, "They decide which states a system settles into, and how fast."},
	{149, "Google's first ranking was an eigenvector of the web's link matrix."},
	{158, "Next lesson: diagonalisation, which uses them as a basis."},
}

const platDuration = 166.0

func platPlayerBlock() Block {
	return Block{
		Slug:        "lesson-player",
		Title:       "Lesson player",
		Description: "A lesson's timeline with chapters and a transcript that follows along: the current sentence lights up, a click on any sentence seeks there. J, K and L rewind, play or pause, and skip, as on video sites.",
		Tags:        []string{"chapters", "transcript", "J/K/L"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("plat-player", ""), h.Data("duration", fmt.Sprint(platDuration)),
				h.TabIndex(0), h.Aria("label", "Lesson player. J, K and L control playback."),
				h.Div(h.Class("flex min-w-0 flex-col border-b lg:border-r lg:border-b-0"),
					// The stage: a vector and its image under the shear, turning with time.
					h.Div(h.Class("relative aspect-video bg-code"),
						h.Svg(h.Data("stage", ""), h.ViewBox("-4 -2.25 8 4.5"), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", "Animated illustration of the current chapter")),
						h.Div(h.Class("pointer-events-none absolute top-3 left-3 rounded-md bg-background/80 px-2 py-1 text-xs backdrop-blur-sm"),
							h.Span(h.Class("text-muted-foreground"), "Chapter "), h.Span(h.Data("chapter", ""), "1 · Vectors that stay put")),
					),
					h.Div(h.Class("flex flex-col gap-2 p-3"),
						// Scrubber with chapter ticks.
						h.Div(h.Data("scrub", ""), h.Role("slider"), h.TabIndex(0), h.Aria("label", "Seek"), h.Aria("valuemin", "0"), h.Aria("valuemax", fmt.Sprint(platDuration)), h.Aria("valuenow", "0"),
							h.Class("group relative h-5 cursor-pointer touch-none outline-none"),
							h.Div(h.Class("absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/10 transition-[height] duration-150 group-hover:h-2"),
								h.Div(h.Data("fill", ""), h.Class("h-full w-0 bg-brand"))),
							h.Map(platChapters[1:], func(c struct {
								t     float64
								title string
							}) h.Node {
								return h.Span(h.Class("absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-background"), h.Style(fmt.Sprintf("left:%.2f%%", 100*c.t/platDuration)))
							}),
							h.Span(h.Data("knob", ""), h.Class("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-brand shadow group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50"), h.Style("left:0")),
						),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("seek", "-10"), h.Aria("label", "Back 10 seconds"), hugeicons.ArrowTurnBackwardIcon()),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
								hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Play")),
							h.Span(h.Data("time", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0:00 / 2:46"),
							h.Div(h.Class("flex-1")),
							segs("Playback speed", [2]string{"0.75", "0.75×"}, [2]string{"1", "1×"}, [2]string{"1.5", "1.5×"}, [2]string{"2", "2×"}),
						),
						h.Ol(h.Class("grid gap-1 sm:grid-cols-4"),
							h.MapIdx(platChapters, func(i int, c struct {
								t     float64
								title string
							}) h.Node {
								return h.Li(h.Button(h.Type("button"), h.Data("chapter-seek", fmt.Sprint(c.t)), h.Data("idx", fmt.Sprint(i)),
									h.Class("flex w-full flex-col rounded-md border px-2 py-1.5 text-left text-xs outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand/50 data-[on]:bg-brand/8"),
									h.Span(h.Class("font-mono text-[10px] text-muted-foreground tabular-nums"), platClock(c.t)),
									h.Span(h.Class("truncate font-medium"), c.title)))
							}),
						),
					),
				),
				h.Div(h.Class("flex min-h-0 flex-col"),
					h.Div(h.Class("flex items-center justify-between border-b px-4 py-2.5"),
						panelLabel("Transcript"),
						h.Span(h.Class("flex items-center gap-1 text-[11px] text-muted-foreground"), kbd.Kbd("J"), kbd.Kbd("K"), kbd.Kbd("L"))),
					h.Div(h.Data("transcript", ""), h.Class("scroll-thin relative max-h-[420px] overflow-y-auto p-2 text-sm leading-relaxed"),
						h.MapIdx(platTranscript, func(i int, l platLine) h.Node {
							return h.Button(h.Type("button"), h.Data("t", fmt.Sprint(l.t)),
								h.Class("flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:bg-brand/10 data-[on]:text-foreground"),
								h.Span(h.Class("mt-0.5 w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums"), platClock(l.t)),
								h.Span(l.text))
						}),
					),
				),
			)
		},
	}
}

func platClock(t float64) string {
	s := int(t)
	return fmt.Sprintf("%d:%02d", s/60, s%60)
}

// ---------------------------------------------------------------- P5

func platNotesBlock() Block {
	return Block{
		Slug:        "notes-highlights",
		Title:       "Notes and highlights",
		Description: "Select any words in the lesson to highlight them in one of three colours and attach a note. Notes collect beside the text, jump back to their passage, and export as Markdown.",
		Tags:        []string{"selection", "marks", "export"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("plat-notes", ""),
				h.Article(h.Class("relative flex flex-col gap-3 rounded-xl border bg-background p-5 text-[15px] leading-7"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), "Lesson 5.1 · Vectors that stay on their line"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Select text to highlight")),
					h.Div(h.Data("text", ""), h.Class("flex flex-col gap-3 text-muted-foreground selection:bg-brand/20 [&_mark]:rounded-[3px] [&_mark]:px-0.5 [&_mark]:text-foreground"),
						h.P("A matrix moves almost every vector off its own line. The exceptions are the eigenvectors: the matrix only scales them, by a factor called the eigenvalue."),
						h.P("To find them, ask when A minus lambda times the identity can send a non-zero vector to zero. That happens exactly when its determinant vanishes, which gives the characteristic polynomial."),
						h.P("A two by two matrix has at most two eigenvalues. When they are real and distinct, their eigenvectors form a basis in which the matrix is diagonal, and powers of the matrix become easy to compute."),
					),
					// Toolbar shown over a selection.
					h.Div(h.Data("toolbar", ""), h.Hidden(), h.Role("toolbar"), h.Aria("label", "Highlight"),
						h.Class("enter absolute z-10 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-lg"),
						h.Map([][2]string{{"brand", "Pink"}, {"vec-out", "Yellow"}, {"vec-u", "Blue"}}, func(c [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("color", c[0]), h.Aria("label", c[1]+" highlight"),
								h.Class("flex size-7 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"),
								h.Span(h.Class("size-3.5 rounded-full"), h.Style("background:var(--"+c[0]+")")))
						}),
						h.Span(h.Class("mx-0.5 h-5 w-px bg-border")),
						h.Button(h.Type("button"), h.Data("color", "brand"), h.Data("with-note", ""), h.Class("flex h-7 items-center gap-1 rounded-md px-2 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"),
							hugeicons.Note01Icon(h.Class("size-3.5")), "Note"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						h.Span(h.Class("flex items-baseline gap-2"), panelLabel("Notes"), h.Span(h.Data("count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("export", ""), hugeicons.Copy01Icon(), "Copy as Markdown"),
					),
					h.Ul(h.Data("list", ""), h.Class("flex flex-col gap-2")),
					h.P(h.Data("empty", ""), h.Class("rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"), "No highlights yet. Select a few words in the lesson."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

type platPost struct {
	ID      int        `json:"id"`
	Author  string     `json:"a"`
	Role    string     `json:"r,omitempty"`
	Minutes int        `json:"m"` // minutes ago
	Text    string     `json:"t"`
	Votes   int        `json:"v"`
	Answer  bool       `json:"ans,omitempty"`
	Replies []platPost `json:"re,omitempty"`
}

var platThread = []platPost{
	{ID: 1, Author: "Noor", Minutes: 180, Votes: 12, Text: "Why does the determinant have to be zero? I get that A − λI squashes v, but why does that force det = 0?",
		Replies: []platPost{
			{ID: 2, Author: "Mateo", Role: "TA", Minutes: 150, Votes: 18, Answer: true, Text: "@Noor if a matrix sends a non-zero vector to zero, it isn't invertible: two inputs (0 and v) give the same output. Non-invertible ⇔ det = 0."},
			{ID: 3, Author: "Noor", Minutes: 140, Votes: 3, Text: "Oh, the two-inputs-one-output argument makes it click. Thanks @Mateo!"},
		}},
	{ID: 4, Author: "Lin", Minutes: 50, Votes: 5, Text: "Is there a quick way to spot one eigenvector of a symmetric matrix without solving anything?",
		Replies: []platPost{
			{ID: 5, Author: "Sam", Minutes: 20, Votes: 2, Text: "If every row sums to the same number s, then (1, 1, …, 1) is an eigenvector with eigenvalue s."},
		}},
	{ID: 6, Author: "Ines", Minutes: 4, Votes: 0, Text: "The shear animation in chapter 1 is great. Could we get one for rotations, where there's no real eigenvector?"},
}

func platDiscussionBlock() Block {
	return Block{
		Slug:        "discussion",
		Title:       "Discussion thread",
		Description: "Questions under a lesson: threaded replies, votes, sorting by top or new, an accepted answer pinned with its badge, @mentions, and times that read like a person wrote them. Posts stay in this page.",
		Tags:        []string{"threads", "votes", "relative time"},
		Render: func() h.Node {
			data, _ := json.Marshal(platThread)
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("plat-discussion", ""), h.Data("thread", string(data)),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					h.Span(h.Class("flex items-center gap-2 text-sm font-medium"), hugeicons.BubbleChatIcon(h.Class("size-4 text-muted-foreground")), h.Span(h.Data("total", ""), "Discussion")),
					h.Div(h.Class("flex items-center gap-2"), platDemo(), segs("Sort", [2]string{"top", "Top"}, [2]string{"new", "New"})),
				),
				h.Form(h.Data("compose", ""), h.Action("#"), h.Class("flex flex-col gap-2 rounded-xl border bg-background p-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"),
					h.Textarea(h.Data("body", ""), h.Placeholder("Ask a question or share an insight… (@name to mention)"), h.Aria("label", "New post"), h.Attr("rows", "2"),
						h.Class("min-h-12 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm")),
					h.Div(h.Class("flex items-center justify-end"), button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), "Post")),
				),
				h.Ol(h.Data("posts", ""), h.Class("flex flex-col gap-3")),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func platLeaderboardBlock() Block {
	return Block{
		Slug:        "leaderboard",
		Title:       "Weekly league",
		Description: "A league of 20 learners reset each week: the top five move up a division, the bottom five move down. Your row stays pinned while the table scrolls, and arrows show how places changed since yesterday.",
		Tags:        []string{"table", "sticky row", "zones"},
		Render:      platLeaderboard,
	}
}

func platLeaderboard() h.Node {
	names := []string{"Hana", "Gus", "Priya", "Ola", "Tomás", "Mei", "Kofi", "Ada (you)", "Yusuf", "Elsa", "Ravi", "June", "Bilal", "Zoé", "Ivan", "Amara", "Leo", "Sara", "Ken", "Nia"}
	xp := []int{1840, 1702, 1655, 1420, 1388, 1210, 1175, 1090, 1002, 940, 905, 811, 760, 655, 610, 512, 430, 318, 205, 90}
	change := []int{0, 2, -1, 1, -2, 3, 0, 4, -1, -3, 1, 0, -2, 2, -1, 0, 1, -1, 0, 0}
	row := func(i int, sticky bool) h.Node {
		zone := ""
		switch {
		case i < 5:
			zone = "up"
		case i >= 15:
			zone = "down"
		}
		you := strings.HasSuffix(names[i], "(you)")
		cls := "grid grid-cols-[2.5rem_1fr_auto_3rem] items-center gap-2 px-3 py-2 text-sm"
		if you {
			cls += " bg-brand/8 font-medium"
		}
		if sticky {
			cls += " sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur-sm"
		}
		arrow := h.Span(h.Class("text-muted-foreground"), "–")
		if change[i] > 0 {
			arrow = h.Span(h.Class("flex items-center justify-end text-add"), hugeicons.ArrowUp01Icon(h.Class("size-3.5")), fmt.Sprint(change[i]))
		} else if change[i] < 0 {
			arrow = h.Span(h.Class("flex items-center justify-end text-del"), hugeicons.ArrowDown01Icon(h.Class("size-3.5")), fmt.Sprint(-change[i]))
		}
		return h.Li(h.Class(cls), h.If(you && !sticky, h.Data("you", "")), h.If(sticky, h.Data("sticky", "")), h.If(sticky, h.Aria("hidden", "true")),
			h.Span(h.Class("font-mono text-xs tabular-nums "+map[string]string{"up": "text-add", "down": "text-del", "": "text-muted-foreground"}[zone]), fmt.Sprint(i+1)),
			h.Span(h.Class("flex items-center gap-2 truncate"),
				h.Span(h.Class("flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-[10px] font-medium"), names[i][:1]),
				h.Span(h.Class("truncate"), names[i])),
			h.Span(h.Class("font-mono text-xs tabular-nums"), fmt.Sprintf("%d XP", xp[i])),
			h.Span(h.Class("text-right font-mono text-xs tabular-nums"), arrow),
		)
	}
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs"), h.Data("plat-leaderboard", ""),
		h.Div(h.Class("flex items-center justify-between gap-3 border-b px-3 py-2.5"),
			h.Span(h.Class("flex items-center gap-2 text-sm font-medium"), hugeicons.Award01Icon(h.Class("size-4 text-vec-out")), "Sapphire League"),
			h.Span(h.Class("flex items-center gap-2"), platDemo(), h.Span(h.Class("font-mono text-xs text-muted-foreground"), "ends in 2d 6h")),
		),
		h.Ol(h.Class("scroll-thin relative max-h-80 overflow-y-auto"),
			h.Range(len(names), func(i int) h.Node {
				out := []h.Node{row(i, false)}
				if i == 4 {
					out = append(out, h.Li(h.Class("flex items-center gap-2 px-3 py-1 text-[10px] tracking-wider text-add uppercase"), h.Span(h.Class("h-px flex-1 bg-add/30")), "promotion zone above", h.Span(h.Class("h-px flex-1 bg-add/30"))))
				}
				if i == 14 {
					out = append(out, h.Li(h.Class("flex items-center gap-2 px-3 py-1 text-[10px] tracking-wider text-del uppercase"), h.Span(h.Class("h-px flex-1 bg-del/30")), "demotion zone below", h.Span(h.Class("h-px flex-1 bg-del/30"))))
				}
				return h.Group(out)
			}),
			row(7, true),
		),
	)
}

// ---------------------------------------------------------------- P8

var platAchievements = []struct{ id, name, rule string }{
	{"first", "First steps", "Finish 1 lesson"},
	{"five", "Warming up", "Finish 5 lessons"},
	{"streak", "On a roll", "Practise 3 days in a row"},
	{"perfect", "Flawless", "Score 100% on a quiz"},
	{"night", "Night owl", "Study after midnight"},
	{"polymath", "Polymath", "Finish lessons in 3 subjects"},
}

func platAchievementsBlock() Block {
	return Block{
		Slug:        "achievements",
		Title:       "Achievements and toasts",
		Description: "Badges that unlock as you go, announced by a toast that slides up from the corner and stacks with the others (the shadcn Sonner component, ported to Go). Rare moments get a little ceremony; routine ones don't.",
		Tags:        []string{"sonner", "badges", "toast"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("plat-achievements", ""),
				sonner.Toaster(),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "lesson"), hugeicons.Book02Icon(), "Finish a lesson"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "day"), hugeicons.FireIcon(), "Practise a day"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "quiz"), hugeicons.Target01Icon(), "Ace a quiz"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "reset"), h.Class("text-muted-foreground"), "Reset"),
				),
				h.Div(h.Class("flex gap-4 font-mono text-xs text-muted-foreground"),
					h.Span("lessons ", h.Span(h.Data("out", "lessons"), h.Class("text-foreground tabular-nums"), "0")),
					h.Span("streak ", h.Span(h.Data("out", "days"), h.Class("text-foreground tabular-nums"), "0")),
					h.Span("unlocked ", h.Span(h.Data("out", "unlocked"), h.Class("text-foreground tabular-nums"), "0"), fmt.Sprintf("/%d", len(platAchievements)))),
				h.Ul(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-3"),
					h.Map(platAchievements, func(a struct{ id, name, rule string }) h.Node {
						return h.Li(h.Data("badge", a.id), h.Class("group flex items-center gap-3 rounded-xl border bg-background p-3 transition-[border-color,background-color] duration-300 data-[on]:border-vec-out/50 data-[on]:bg-vec-out/8"),
							h.Span(h.Class("flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/6 text-muted-foreground transition-colors duration-300 group-data-[on]:bg-vec-out/20 group-data-[on]:text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))]"),
								hugeicons.Medal01Icon(h.Class("size-4"))),
							h.Span(h.Class("flex min-w-0 flex-col"),
								h.Span(h.Class("truncate text-sm font-medium text-muted-foreground group-data-[on]:text-foreground"), a.name),
								h.Span(h.Class("truncate text-xs text-muted-foreground"), a.rule)),
						)
					}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

func platCertificateBlock() Block {
	return Block{
		Slug:        "certificate",
		Title:       "Certificate of completion",
		Description: "A certificate the learner can print or save as an image. Its verification code is the first ten hex digits of a SHA-256 hash of the name, course and date, so any change to them changes the code.",
		Tags:        []string{"print", "canvas PNG", "SHA-256"},
		Wide:        true,
		Render: func() h.Node {
			courses := []string{}
			for _, c := range Collections() {
				courses = append(courses, c.Name)
			}
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"), h.Data("plat-certificate", ""),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Label(h.Class("flex flex-col gap-1.5 text-sm"), "Name",
						h.Input(h.Data("name", ""), h.Value("Ada Lovelace"), h.Attr("autocomplete", "name"),
							h.Class("h-9 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"))),
					h.Label(h.Class("flex flex-col gap-1.5 text-sm"), "Course",
						h.Select(h.Data("course", ""), h.Class("h-9 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
							h.Map(courses, func(c string) h.Node { return h.Option(h.Value(c), c) }))),
					h.Div(h.Class("grid grid-cols-2 gap-2 pt-1"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("print", ""), hugeicons.PrinterIcon(), "Print"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("png", ""), hugeicons.Download01Icon(), "PNG"),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Demo: nothing is issued or stored. A real certificate would be signed by the server."),
				),
				h.Div(h.Data("sheet", ""), h.Class("relative aspect-[1.414] w-full overflow-hidden rounded-xl border bg-[color-mix(in_oklab,var(--background)_96%,var(--vec-out))] p-[4%] shadow-xs"),
					h.Div(h.Class("flex size-full flex-col items-center justify-between rounded-lg border-2 border-double border-foreground/25 p-[5%] text-center"),
						h.Div(h.Class("flex items-center gap-2 text-sm font-medium tracking-tight"), logoMark(), "Hypercode"),
						h.Div(h.Class("flex flex-col items-center gap-[0.6em] text-[clamp(10px,1.6vw,16px)]"),
							h.Span(h.Class("font-mono text-[0.75em] tracking-[0.25em] text-muted-foreground uppercase"), "Certificate of completion"),
							h.Span(h.Class("text-[0.9em] text-muted-foreground"), "This certifies that"),
							h.Span(h.Data("out-name", ""), h.Class("font-serif text-[2.4em] leading-tight italic"), "Ada Lovelace"),
							h.Span(h.Class("text-[0.9em] text-muted-foreground"), "has completed the course"),
							h.Span(h.Data("out-course", ""), h.Class("text-[1.5em] font-semibold tracking-tight"), "Linear Algebra"),
						),
						h.Div(h.Class("flex w-full items-end justify-between text-left text-[clamp(9px,1.1vw,12px)]"),
							h.Div(h.Class("flex flex-col"), h.Span(h.Class("text-muted-foreground"), "Date"), h.Span(h.Data("out-date", ""), "—")),
							hugeicons.CheckmarkBadge01Icon(h.Class("size-[clamp(24px,4vw,44px)] text-brand")),
							h.Div(h.Class("flex flex-col text-right"), h.Span(h.Class("text-muted-foreground"), "Verification"), h.Span(h.Data("out-code", ""), h.Class("font-mono"), "—")),
						),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P10

var platTourSteps = []struct{ target, title, body string }{
	{"search", "Search everything", "Find any lesson or block from here. ⌘K works anywhere."},
	{"progress", "Your progress", "This bar fills as you finish lessons in the current course."},
	{"lesson", "Pick up where you left off", "The next lesson waits here, with its length and reward."},
	{"help", "Stuck?", "Ask the tutor: it sees the lesson you're on."},
}

func platTourBlock() Block {
	return Block{
		Slug:        "product-tour",
		Title:       "Onboarding tour",
		Description: "A first-run checklist and a spotlight tour: each step dims the page except the part it explains, with a card beside it. Arrow keys or Enter move on, Esc ends the tour, and focus returns where it was.",
		Tags:        []string{"spotlight", "checklist", "focus"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("plat-tour", ""), h.Data("steps", platTourJSON()),
				// A miniature app the tour points at.
				h.Div(h.Class("flex min-h-64 flex-col overflow-hidden rounded-xl border bg-background"),
					h.Div(h.Class("flex items-center gap-2 border-b px-3 py-2"),
						logoMark(),
						h.Div(h.Data("tour-target", "search"), h.Class("flex h-8 flex-1 items-center gap-2 rounded-md border px-2.5 text-xs text-muted-foreground"), hugeicons.Search01Icon(h.Class("size-3.5")), "Search…"),
						h.Div(h.Data("tour-target", "help"), h.Class("flex size-8 items-center justify-center rounded-full border"), hugeicons.BubbleChatIcon(h.Class("size-4"))),
					),
					h.Div(h.Class("flex flex-1 flex-col gap-4 p-4"),
						h.Div(h.Data("tour-target", "progress"), h.Class("flex flex-col gap-1.5 rounded-md p-1"),
							h.Div(h.Class("flex justify-between text-xs"), h.Span("Linear Algebra"), h.Span(h.Class("font-mono text-muted-foreground"), "8/16")),
							h.Div(h.Class("h-1.5 rounded-full bg-foreground/10"), h.Div(h.Class("h-full w-1/2 rounded-full bg-brand")))),
						h.Div(h.Data("tour-target", "lesson"), h.Class("flex items-center gap-3 rounded-lg border p-3"),
							h.Span(h.Class("flex size-9 items-center justify-center rounded-md bg-brand/10 text-brand"), hugeicons.PlayIcon(h.Class("size-4"))),
							h.Span(h.Class("flex flex-col"), h.Span(h.Class("text-sm font-medium"), "Matrices as transformations"), h.Span(h.Class("text-xs text-muted-foreground"), "18 min · +120 XP"))),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"),
					h.Div(h.Class("flex items-center justify-between"),
						h.Span(h.Class("text-sm font-medium"), "Get started"),
						h.Span(h.Data("progress-label", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("0/%d", len(platTourSteps)))),
					h.Div(h.Class("h-1 overflow-hidden rounded-full bg-foreground/10"), h.Div(h.Data("bar", ""), h.Class("h-full w-0 rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)]"))),
					h.Ol(h.Class("flex flex-col gap-1"),
						h.MapIdx(platTourSteps, func(i int, s struct{ target, title, body string }) h.Node {
							return h.Li(h.Data("check", fmt.Sprint(i)), h.Class("group flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm text-muted-foreground data-[done]:text-foreground"),
								h.Span(h.Class("flex size-5 items-center justify-center rounded-full border text-[10px] group-data-[done]:border-transparent group-data-[done]:bg-brand group-data-[done]:text-white"),
									h.Span(h.Class("group-data-[done]:hidden"), fmt.Sprint(i+1)), hugeicons.Tick02Icon(h.Class("hidden !size-3 group-data-[done]:block"), h.StrokeWidth("3"))),
								s.title)
						}),
					),
					button.Button(button.VariantOutline, button.SizeSm, h.Class("mt-auto"), h.Type("button"), h.Data("start", ""), hugeicons.Rocket01Icon(), "Start the tour"),
				),
				// Overlay: a hole cut with a huge box-shadow, plus the step card.
				h.Div(h.Data("overlay", ""), h.Hidden(), h.Class("fixed inset-0 z-50"),
					h.Div(h.Data("hole", ""), h.Class("pointer-events-none absolute rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ring-2 ring-brand transition-[top,left,width,height] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none")),
					h.Div(h.Data("card", ""), h.Role("dialog"), h.Aria("modal", "true"), h.Aria("labelledby", "plat-tour-title"), h.TabIndex(-1),
						h.Class("absolute w-72 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl outline-none"),
						h.Div(h.Class("flex items-center justify-between"),
							h.Span(h.Data("step-label", ""), h.Class("font-mono text-[11px] text-muted-foreground")),
							h.Button(h.Type("button"), h.Data("close", ""), h.Aria("label", "End tour"), h.Class("rounded-md p-1 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"), hugeicons.Cancel01Icon(h.Class("size-4")))),
						h.P(h.ID("plat-tour-title"), h.Data("step-title", ""), h.Class("mt-1 font-medium")),
						h.P(h.Data("step-body", ""), h.Class("mt-1 text-sm text-muted-foreground")),
						h.Div(h.Class("mt-3 flex justify-between gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("prev", ""), "Back"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("next", ""), "Next")),
					),
				),
			)
		},
	}
}

func platTourJSON() string {
	type s struct {
		Target string `json:"target"`
		Title  string `json:"title"`
		Body   string `json:"body"`
	}
	var out []s
	for _, x := range platTourSteps {
		out = append(out, s{x.target, x.title, x.body})
	}
	b, _ := json.Marshal(out)
	return string(b)
}

// ---------------------------------------------------------------- P11

type platPlan struct {
	id, name, tagline string
	monthly, yearly   float64 // per month billed monthly; per year billed yearly
	features          []string
	featured          bool
}

var platPlans = []platPlan{
	{"free", "Free", "Every lesson's reading and the first exercise.", 0, 0, []string{"All subjects to read", "3 exercises a day", "Community discussions"}, false},
	{"pro", "Pro", "Everything, with the tutor and certificates.", 12, 99, []string{"Unlimited exercises", "Tutor on every lesson", "Spaced-review deck", "Certificates"}, true},
	{"team", "Classroom", "For a teacher and their students.", 20, 192, []string{"Everything in Pro", "Class dashboard", "Assignments and grading", "Seats from 5 learners"}, false},
}

var platFeatureRows = []struct {
	name string
	has  [3]string
}{
	{"Lessons and readings", [3]string{"✓", "✓", "✓"}},
	{"Exercises per day", [3]string{"3", "Unlimited", "Unlimited"}},
	{"Tutor", [3]string{"—", "✓", "✓"}},
	{"Certificates", [3]string{"—", "✓", "✓"}},
	{"Class dashboard", [3]string{"—", "—", "✓"}},
}

func platPricingBlock() Block {
	return Block{
		Slug:        "pricing",
		Title:       "Plans and pricing",
		Description: "A plan picker with monthly and yearly billing: the yearly price shows its exact saving against twelve monthly payments, and a student toggle halves it. A demo of the component, with no checkout behind it.",
		Tags:        []string{"toggle", "comparison", "demo"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("plat-pricing", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-center gap-4"),
					segs("Billing", [2]string{"monthly", "Monthly"}, [2]string{"yearly", "Yearly"}),
					h.Div(h.Class("flex items-center gap-2"),
						switchui.Switch(h.ID("plat-student"), h.Data("toggle", "student")),
						label.Label(h.For("plat-student"), h.Class("font-normal"), "Student (−50%)")),
					platDemo(),
				),
				h.Div(h.Class("grid gap-3 md:grid-cols-3"),
					h.Map(platPlans, func(p platPlan) h.Node {
						return h.Div(h.Data("plan", p.id), h.Data("monthly", fmt.Sprint(p.monthly)), h.Data("yearly", fmt.Sprint(p.yearly)),
							h.Class("relative flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-xs "+h.Ternary(p.featured, "border-brand/50 ring-[3px] ring-brand/15", "")),
							h.If(p.featured, h.Span(h.Class("absolute -top-2.5 left-5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-white"), "Most popular")),
							h.Div(h.Class("flex flex-col gap-1"),
								h.Span(h.Class("font-medium"), p.name),
								h.Span(h.Class("text-sm text-muted-foreground"), p.tagline)),
							h.Div(h.Class("flex items-baseline gap-1"),
								h.Span(h.Data("price", ""), h.Class("text-3xl font-semibold tracking-tight tabular-nums"), fmt.Sprintf("€%g", p.monthly)),
								h.Span(h.Data("per", ""), h.Class("text-sm text-muted-foreground"), "/ month")),
							h.Span(h.Data("note", ""), h.Class("min-h-4 text-xs text-muted-foreground")),
							h.Ul(h.Class("flex flex-col gap-2 text-sm"),
								h.Map(p.features, func(f string) h.Node {
									return h.Li(h.Class("flex items-center gap-2"), hugeicons.Tick02Icon(h.Class("size-4 text-brand")), f)
								})),
							button.Button(button.VariantOutline, button.SizeSm, h.Class("mt-auto"), h.Type("button"), h.IfElse(p.monthly == 0, "Start free", "Choose "+p.name)),
						)
					}),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto rounded-xl border bg-background"),
					h.Table(h.Class("w-full min-w-[480px] text-sm"),
						h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
							h.Th(h.Class("px-4 py-2.5 font-normal"), "Compare"),
							h.Map(platPlans, func(p platPlan) h.Node { return h.Th(h.Class("px-4 py-2.5 text-center font-normal"), p.name) }))),
						h.Tbody(h.Map(platFeatureRows, func(r struct {
							name string
							has  [3]string
						}) h.Node {
							return h.Tr(h.Class("border-b last:border-b-0"),
								h.Td(h.Class("px-4 py-2.5"), r.name),
								h.Map(r.has[:], func(v string) h.Node {
									return h.Td(h.Class("px-4 py-2.5 text-center "+h.Ternary(v == "—", "text-muted-foreground", "")), v)
								}))
						})),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P12

func platSettingsBlock() Block {
	shortcuts := [][2][]string{
		{{"⌘", "K"}, {"Search"}},
		{{"⌘", "B"}, {"Toggle sidebar"}},
		{{"⌘", "⏎"}, {"Run code"}},
		{{"J", "K", "L"}, {"Lesson player"}},
		{{"1", "2", "3"}, {"Grade a card"}},
	}
	return Block{
		Slug:        "settings",
		Title:       "Settings",
		Description: "Preferences that change the whole page live: theme (light, dark or follow the system), text size, and a reduced-motion override for people whose system setting doesn't say what they want here. Data can be exported or wiped.",
		Tags:        []string{"theme", "a11y", "local data"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col divide-y rounded-xl border bg-background shadow-xs"), h.Data("plat-settings", ""),
				platSettingRow("Theme", "Light, dark, or follow the system.",
					segs("Theme", [2]string{"system", "System"}, [2]string{"light", "Light"}, [2]string{"dark", "Dark"})),
				platSettingRow("Text size", "Scales every text and spacing on the page.",
					h.Div(h.Data("size-group", ""), segs("Text size", [2]string{"100", "A"}, [2]string{"112.5", "A+"}, [2]string{"125", "A++"}))),
				platSettingRow("Reduce motion", "Turns off animations and transitions, whatever the system says.",
					switchui.Switch(h.ID("plat-motion"), h.Data("toggle", "motion"), h.Aria("label", "Reduce motion"))),
				h.Div(h.Class("flex flex-col gap-3 p-4"),
					h.Span(h.Class("text-sm font-medium"), "Keyboard shortcuts"),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm"),
						h.Map(shortcuts, func(s [2][]string) h.Node {
							return h.Group(
								h.Dt(kbd.Group(h.Map(s[0], func(k string) h.Node { return kbd.Kbd(k) }))),
								h.Dd(h.Class("text-muted-foreground"), s[1][0]))
						})),
				),
				platSettingRow("Your data", "Settings, notes and progress saved in this browser.",
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("export", ""), hugeicons.Download01Icon(), "Export"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("reset", ""), h.Class("text-del"), hugeicons.Delete02Icon(), "Reset"))),
				h.P(h.Data("status", ""), h.Aria("live", "polite"), h.Class("px-4 py-2 text-xs text-muted-foreground"), "Changes apply immediately and are saved in this browser."),
			)
		},
	}
}

func platSettingRow(title, hint string, control h.Node) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 p-4"),
		h.Div(h.Class("flex flex-col"), h.Span(h.Class("text-sm font-medium"), title), h.Span(h.Class("text-xs text-muted-foreground"), hint)),
		control)
}
