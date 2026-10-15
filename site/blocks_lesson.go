package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/breadcrumb"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/collapsible"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- 01

func lessonHeaderBlock() Block {
	return Block{
		Slug:        "lesson-header",
		Title:       "Lesson header",
		Description: "Where the learner is, what the lesson costs and what it pays. The step bar shows the lesson's rhythm: read, play, code, check.",
		Tags:        []string{"breadcrumb", "progress", "kbd"},
		Render:      lessonHeader,
	}
}

var lessonSteps = []string{"Read", "Watch", "Play", "Code", "Quiz", "Review"}

func lessonHeader() h.Node {
	current := 2
	return h.Div(h.Class("flex flex-col gap-6"),
		breadcrumb.Breadcrumb(breadcrumb.List(
			breadcrumb.Item(breadcrumb.Link(h.Href("#"), "Linear Algebra")),
			breadcrumb.Separator(),
			breadcrumb.Item(breadcrumb.Link(h.Href("#"), "3 · Linear maps")),
			breadcrumb.Separator(),
			breadcrumb.Item(breadcrumb.Page("Lesson 3.2")),
		)),
		h.Div(h.Class("flex flex-col gap-3"),
			h.H3(h.Class("text-2xl font-semibold tracking-tight text-balance sm:text-3xl"), "Matrices as linear transformations"),
			h.P(h.Class("max-w-[60ch] leading-relaxed text-pretty text-muted-foreground"),
				"A matrix is a function that moves space. Follow where the basis vectors land and you know where every vector lands."),
		),
		h.Div(h.Class("flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"),
			metaItem(hugeicons.Clock01Icon(), "18 min"),
			metaItem(hugeicons.SourceCodeIcon(), "4 exercises"),
			metaItem(hugeicons.StarIcon(), "+120 XP"),
			h.Span(h.Class("flex items-center gap-2"),
				h.Span(h.Class("flex gap-0.5"), h.Aria("hidden", "true"),
					h.Span(h.Class("h-3 w-1 rounded-full bg-foreground")),
					h.Span(h.Class("h-3 w-1 rounded-full bg-foreground")),
					h.Span(h.Class("h-3 w-1 rounded-full bg-foreground/20")),
				),
				"Intermediate",
			),
		),
		h.Div(h.Class("flex flex-col gap-2.5"),
			h.Div(h.Class("flex items-baseline justify-between text-xs"),
				h.Span(h.Class("font-medium"), fmt.Sprintf("Step %d of %d · ", current+1, len(lessonSteps)), h.Span(h.Class("text-muted-foreground"), lessonSteps[current])),
				h.Span(h.Class("font-mono text-muted-foreground tabular-nums"), "42%"),
			),
			h.Ol(h.Class("grid gap-1.5"), h.Style(fmt.Sprintf("grid-template-columns: repeat(%d, minmax(0, 1fr))", len(lessonSteps))),
				h.Aria("label", "Lesson steps"),
				h.MapIdx(lessonSteps, func(i int, s string) h.Node {
					bar := "bg-foreground/10"
					switch {
					case i < current:
						bar = "bg-foreground"
					case i == current:
						bar = "bg-[linear-gradient(to_right,var(--foreground)_50%,color-mix(in_oklab,var(--foreground)_10%,transparent)_50%)]"
					}
					return h.Li(h.Class("flex flex-col gap-1.5"), h.If(i == current, h.Aria("current", "step")),
						h.Span(h.Class("h-1 rounded-full "+bar)),
						h.Span(h.Class(h.Ternary(i == current, "text-[11px] font-medium", "hidden text-[11px] text-muted-foreground sm:block")), s),
					)
				}),
			),
		),
		h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-5"),
			button.Button(button.VariantOutline, button.SizeSm, hugeicons.ArrowLeft01Icon(), "Previous"),
			button.Button(button.VariantOutline, button.SizeSm, "Continue",
				kbd.Kbd(h.Class("ml-1 hidden sm:inline-flex"), "⏎"),
			),
		),
	)
}

func metaItem(icon h.Node, label string) h.Node {
	return h.Span(h.Class("flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:text-muted-foreground/70"), icon, label)
}

// ---------------------------------------------------------------- 02

func courseOutlineBlock() Block {
	return Block{
		Slug:        "course-outline",
		Title:       "Course outline",
		Description: "The whole course on one card. Modules open in place, each lesson shows its state, and locked lessons say what unlocks them.",
		Tags:        []string{"collapsible", "progress ring"},
		Render:      courseOutline,
	}
}

type lessonItem struct {
	n, title, kind string
	state          string // done, current, open, locked
}

type module struct {
	n, title string
	lessons  []lessonItem
	open     bool
}

var modules = []module{
	{n: "1", title: "Vectors", lessons: []lessonItem{
		{"1.1", "Arrows and lists of numbers", "read", "done"},
		{"1.2", "Adding and scaling", "code", "done"},
		{"1.3", "Length and the dot product", "code", "done"},
	}},
	{n: "2", title: "Linear combinations", lessons: []lessonItem{
		{"2.1", "Span", "play", "done"},
		{"2.2", "Linear independence", "code", "done"},
		{"2.3", "Basis and dimension", "quiz", "done"},
	}},
	{n: "3", title: "Linear maps", open: true, lessons: []lessonItem{
		{"3.1", "What makes a map linear", "read", "done"},
		{"3.2", "Matrices as linear transformations", "play", "current"},
		{"3.3", "Matrix multiplication is composition", "code", "open"},
		{"3.4", "Kernel and image", "code", "locked"},
		{"3.5", "Rank–nullity", "quiz", "locked"},
	}},
	{n: "4", title: "Determinants", lessons: []lessonItem{
		{"4.1", "Area scaling", "play", "locked"},
		{"4.2", "Computing determinants", "code", "locked"},
	}},
	{n: "5", title: "Eigenvalues", lessons: []lessonItem{
		{"5.1", "Vectors that stay on their line", "play", "locked"},
		{"5.2", "The characteristic polynomial", "code", "locked"},
		{"5.3", "Diagonalization", "code", "locked"},
	}},
}

func courseOutline() h.Node {
	return h.Div(h.Class("overflow-hidden rounded-xl border bg-background shadow-xs"),
		h.Div(h.Class("flex items-center justify-between gap-4 border-b px-4 py-3"),
			h.Div(h.Class("flex flex-col"),
				h.Span(h.Class("text-sm font-medium"), "Linear Algebra"),
				h.Span(h.Class("text-xs text-muted-foreground"), "8 of 16 lessons · 1,040 XP"),
			),
			progressRing(8, 16, 36),
		),
		h.Ul(h.Class("divide-y"),
			h.Map(modules, func(m module) h.Node {
				done := 0
				for _, l := range m.lessons {
					if l.state == "done" {
						done++
					}
				}
				locked := m.lessons[0].state == "locked"
				return h.Li(
					collapsible.Collapsible(h.If(m.open, collapsible.Open(true)),
						collapsible.Trigger(h.Class("group flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors duration-150 outline-none hover:bg-accent/50 focus-visible:bg-accent/60"),
							h.Span(h.Class("w-4 font-mono text-xs text-muted-foreground tabular-nums"), m.n),
							h.Span(h.Class(h.Ternary(locked, "flex-1 text-muted-foreground", "flex-1 font-medium")), m.title),
							h.Span(h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("%d/%d", done, len(m.lessons))),
							hugeicons.ArrowDown01Icon(h.Class("size-4 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)] group-data-[state=open]:rotate-180")),
						),
						collapsible.Content(h.Class("overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"),
							h.Ul(h.Class("flex flex-col pb-2"),
								h.Map(m.lessons, lessonRow),
							),
						),
					),
				)
			}),
		),
	)
}

func lessonRow(l lessonItem) h.Node {
	icon := map[string]h.Node{
		"done":    h.Span(h.Class("flex size-5 items-center justify-center rounded-full bg-foreground text-background"), hugeicons.Tick02Icon(h.Class("size-3"), h.StrokeWidth("3"))),
		"current": h.Span(h.Class("relative flex size-5 items-center justify-center rounded-full border border-foreground"), h.Span(h.Class("size-2 rounded-full bg-foreground"))),
		"open":    h.Span(h.Class("block size-5 rounded-full border border-dashed border-foreground/40")),
		"locked":  h.Span(h.Class("flex size-5 items-center justify-center text-muted-foreground/60"), hugeicons.SquareLock02Icon(h.Class("size-4"))),
	}[l.state]
	kinds := map[string]h.Node{
		"read": hugeicons.Book02Icon(), "code": hugeicons.SourceCodeIcon(),
		"play": hugeicons.Cursor01Icon(), "quiz": hugeicons.CheckListIcon(),
	}
	row := h.Div(h.Class(
		"relative mx-2 flex items-center gap-3 rounded-md py-2 pr-2 pl-9 text-sm "+
			map[string]string{
				"done":    "text-muted-foreground",
				"current": "bg-accent font-medium",
				"open":    "",
				"locked":  "text-muted-foreground/60",
			}[l.state]),
		h.Span(h.Class("absolute left-2"), icon),
		h.Span(h.Class("w-7 font-mono text-[11px] text-muted-foreground tabular-nums"), l.n),
		h.Span(h.Class("flex-1 truncate"), l.title),
		h.If(l.state == "locked", h.Span(h.Class("hidden text-xs sm:inline"), "Finish 3.3")),
		h.Span(h.Class("text-muted-foreground/70 [&_svg]:size-3.5"), h.Title(l.kind), kinds[l.kind]),
	)
	if l.state == "locked" {
		return h.Li(row)
	}
	return h.Li(h.A(h.Href("#"), h.Class("block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>div]:transition-colors [&>div]:duration-150 hover:[&>div]:bg-accent/60"), row))
}

// progressRing draws done/total as a ring of the given pixel size.
func progressRing(done, total, size int) h.Node {
	r := float64(size)/2 - 3
	c := 2 * 3.141592653589793 * r
	frac := float64(done) / float64(total)
	return h.Div(h.Class("relative flex items-center justify-center"), h.Style(fmt.Sprintf("width:%dpx;height:%dpx", size, size)),
		h.Role("img"), h.Aria("label", fmt.Sprintf("%d of %d lessons done", done, total)),
		h.Svg(h.ViewBox(fmt.Sprintf("0 0 %d %d", size, size)), h.Class("-rotate-90"), h.Width(fmt.Sprint(size)), h.Height(fmt.Sprint(size)),
			h.El("circle", h.Attr("cx", fmt.Sprint(size/2)), h.Attr("cy", fmt.Sprint(size/2)), h.Attr("r", fmt.Sprintf("%.2f", r)),
				h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.1"), h.Attr("stroke-width", "3")),
			h.El("circle", h.Attr("cx", fmt.Sprint(size/2)), h.Attr("cy", fmt.Sprint(size/2)), h.Attr("r", fmt.Sprintf("%.2f", r)),
				h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-width", "3"), h.Attr("stroke-linecap", "round"),
				h.Attr("stroke-dasharray", fmt.Sprintf("%.2f %.2f", c*frac, c))),
		),
		h.Span(h.Class("absolute font-mono text-[10px] tabular-nums"), fmt.Sprintf("%d%%", int(frac*100+0.5))),
	)
}

// ---------------------------------------------------------------- 03

func theoremBlock() Block {
	return Block{
		Slug:        "theorem",
		Title:       "Definition, theorem, proof",
		Description: "Textbook environments with MathML the browser typesets itself. A theorem can link to its formal statement in Lean's Mathlib; the proof opens on demand.",
		Tags:        []string{"MathML", "collapsible", "Lean"},
		Render:      theorems,
	}
}

func envCard(kind, number, title string, body ...any) *h.Element {
	return h.Div(h.Class("flex flex-col gap-3 rounded-lg border bg-background p-4 sm:p-5"),
		h.Div(h.Class("flex flex-wrap items-baseline gap-x-2 gap-y-1"),
			h.Span(h.Class("font-mono text-[11px] font-medium tracking-wider uppercase"), kind+" "+number),
			h.If(title != "", h.Span(h.Class("text-sm text-muted-foreground"), "· "+title)),
		),
		h.Div(h.Class("flex flex-col gap-3 text-[15px] leading-relaxed"), h.Group(body...)),
	)
}

func theorems() h.Node {
	T := mi("T")
	return h.Div(h.Class("flex flex-col gap-4"),
		envCard("Definition", "3.1", "Linear map",
			h.P("A function ", mathml(T, mo(":"), mi("V"), mo("→"), mi("W")), " between vector spaces is ", h.Em("linear"), " when, for all vectors ",
				mathml(vecSym("u"), mo(","), vecSym("v")), " and every scalar ", mathml(mi("c")), ":"),
			h.Div(h.Class("flex flex-col items-center gap-1 py-1"),
				mathBlock(T, mo("("), vecSym("u"), mo("+"), vecSym("v"), mo(")"), mo("="), T, mo("("), vecSym("u"), mo(")"), mo("+"), T, mo("("), vecSym("v"), mo(")")),
				mathBlock(T, mo("("), mi("c"), vecSym("v"), mo(")"), mo("="), mi("c"), T, mo("("), vecSym("v"), mo(")")),
			),
		),
		envCard("Theorem", "3.4", "Rank–nullity",
			h.P("Let ", mathml(T, mo(":"), mi("V"), mo("→"), mi("W")), " be linear, with ", mathml(mi("V")), " finite-dimensional. Then"),
			mathBlock(opname("dim"), mi("V"), mo("="), opname("rank"), T, mo("+"), opname("nullity"), T),
			h.Div(h.Class("flex flex-wrap items-center gap-2 pt-1"),
				collapsible.Collapsible(h.Class("flex w-full flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						collapsible.Trigger(lib.AsChild, button.Button(button.VariantOutline, button.SizeSm, h.Class("group"),
							hugeicons.ArrowRight01Icon(h.Class("transition-transform duration-200 ease-[var(--ease-out)] group-data-[state=open]:rotate-90")),
							h.Span(h.Class("group-data-[state=open]:hidden"), "Show proof"),
							h.Span(h.Class("hidden group-data-[state=open]:inline"), "Hide proof"),
						)),
						badge.Badge(badge.VariantOutline, h.Class("gap-1.5 font-mono text-[11px] font-normal"),
							h.Span(h.Class("size-1.5 rounded-full bg-add")),
							"Mathlib: LinearMap.finrank_range_add_finrank_ker"),
					),
					collapsible.Content(h.Class("overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"),
						h.Div(h.Class("flex flex-col gap-2 border-l-2 pl-4 text-[15px] leading-relaxed text-muted-foreground"),
							h.P(h.Em("Proof. "), "Take a basis ", mathml(msub(vecSym("k"), mn("1")), mo(","), mo("…"), mo(","), msub(vecSym("k"), mi("p"))),
								" of ker T and extend it to a basis of V with ", mathml(msub(vecSym("v"), mn("1")), mo(","), mo("…"), mo(","), msub(vecSym("v"), mi("q"))), "."),
							h.P("The images ", mathml(T, msub(vecSym("v"), mn("1")), mo(","), mo("…"), mo(","), T, msub(vecSym("v"), mi("q"))),
								" span im T, and they are independent: a relation among them would put a combination of the ",
								mathml(msub(vecSym("v"), mi("i"))), " in the kernel. So rank T = q and dim V = p + q.",
								h.Span(h.Class("float-right text-foreground"), "∎")),
						),
					),
				),
			),
		),
		h.Div(h.Class("flex gap-3 rounded-lg border border-dashed p-4 text-sm leading-relaxed"),
			hugeicons.BulbIcon(h.Class("mt-0.5 size-4 shrink-0 text-vec-out")),
			h.P(h.Span(h.Class("font-medium"), "Intuition. "), h.Span(h.Class("text-muted-foreground"),
				"Every dimension of V either survives the map (it shows up in the image) or gets crushed to zero (it lands in the kernel). None is lost, none is created.")),
		),
	)
}

// ---------------------------------------------------------------- 04

func matrixBlock() Block {
	return Block{
		Slug:        "matrix",
		Title:       "Matrix",
		Description: "A matrix the learner can read: hover an entry to see its name and its row and column, flip to the NumPy literal, copy it. The facts underneath are computed in Go.",
		Tags:        []string{"tabs", "copy", "hover"},
		Render:      matrixView,
	}
}

var matA = [][]int{{2, 0, 1}, {1, 3, -1}, {0, 1, 4}}

func det3(m [][]int) int {
	return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) -
		m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) +
		m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
}

// minus prints a real minus sign, which lines up with the digits.
func minus(n int) string {
	if n < 0 {
		return "−" + fmt.Sprint(-n)
	}
	return fmt.Sprint(n)
}

func numpyLiteral(m [][]int) string {
	rows := make([]string, len(m))
	for i, r := range m {
		cells := make([]string, len(r))
		for j, v := range r {
			cells[j] = fmt.Sprintf("%2d", v)
		}
		rows[i] = "    [" + strings.Join(cells, ", ") + "]"
	}
	return "A = np.array([\n" + strings.Join(rows, ",\n") + ",\n])"
}

func matrixView() h.Node {
	n := len(matA)
	trace := matA[0][0] + matA[1][1] + matA[2][2]
	sym := true
	for i := range matA {
		for j := range matA {
			if matA[i][j] != matA[j][i] {
				sym = false
			}
		}
	}
	return h.Div(h.Class("flex flex-col gap-5"), h.Data("matrix-explorer", ""),
		h.Div(h.Class("flex items-center justify-between gap-3"),
			h.Div(h.Class("flex items-center gap-2"),
				h.Span(h.Class("font-serif text-lg italic"), "A"),
				badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), fmt.Sprintf("%d × %d", n, n)),
			),
			h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Notation"),
				segButton("math", "Math", true),
				segButton("numpy", "NumPy", false),
			),
		),
		h.Div(h.Class("grid min-h-40 place-items-center"),
			h.Div(h.Data("view", "math"), h.Class("enter flex items-center gap-4"),
				h.Span(h.Class("font-serif text-2xl italic"), "A", h.Span(h.Class("mx-2 not-italic"), "=")),
				h.Div(h.Class("matrix gap-x-1 gap-y-1 text-lg"), h.Style(fmt.Sprintf("grid-template-columns: repeat(%d, minmax(3rem, auto))", n)),
					h.MapIdx(matA, func(i int, row []int) h.Node {
						return h.MapIdx(row, func(j int, v int) h.Node {
							return h.Button(h.Type("button"),
								h.Data("i", fmt.Sprint(i+1)), h.Data("j", fmt.Sprint(j+1)), h.Data("v", minus(v)),
								h.Aria("label", fmt.Sprintf("a%d%d = %s", i+1, j+1, minus(v))),
								h.Class("h-10 rounded-md px-2 text-center font-mono tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[hl=cell]:bg-foreground data-[hl=cell]:text-background data-[hl=line]:bg-accent"),
								minus(v),
							)
						})
					}),
				),
			),
			h.Div(h.Data("view", "numpy"), h.Hidden(), h.Class("enter w-full max-w-sm"),
				h.Div(h.Class("relative rounded-lg border bg-code"),
					h.Pre(h.Class("code scroll-thin overflow-x-auto px-4 py-3"),
						h.Code(h.Map(strings.Split(numpyLiteral(matA), "\n"), func(l string) h.Node {
							return h.Span(h.Class("block"), highlightLine(l))
						})),
					),
					copyButton(numpyLiteral(matA), "absolute top-2 right-2"),
				),
			),
		),
		h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm"),
			h.P(h.Data("readout", ""), h.Aria("live", "polite"), h.Class("min-h-5 font-mono text-xs text-muted-foreground"),
				"Hover an entry"),
			h.Dl(h.Class("flex gap-4 font-mono text-xs"),
				fact("det", minus(det3(matA))),
				fact("trace", minus(trace)),
				fact("rank", "3"),
				fact("symmetric", h.Ternary(sym, "yes", "no")),
			),
		),
	)
}

func fact(k, v string) h.Node {
	return h.Div(h.Class("flex gap-1.5"),
		h.Dt(h.Class("text-muted-foreground"), k),
		h.Dd(h.Class("tabular-nums"), v),
	)
}

func segButton(value, label string, active bool) h.Node {
	return h.Button(h.Type("button"), h.Role("tab"), h.Data("seg", value), h.Aria("selected", fmt.Sprint(active)),
		h.Class("rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-accent aria-selected:text-foreground"),
		label)
}

// copyButton copies text to the clipboard (site/static/js/app.js).
func copyButton(text, class string) h.Node {
	return button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-7 bg-background/80 backdrop-blur-sm "+class), h.Type("button"),
		h.Data("copy", text), h.Aria("label", "Copy"),
		hugeicons.Copy01Icon(h.Class("size-3.5 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-50 [[data-copied]_&]:opacity-0")),
		hugeicons.Tick02Icon(h.Class("absolute size-3.5 scale-50 opacity-0 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-100 [[data-copied]_&]:opacity-100")),
	)
}
