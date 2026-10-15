package site

import (
	"fmt"
	"math"
	"strings"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/dialog"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- P7

func proseDerivationBlock() Block {
	half := mfrac(mi("b"), mrow(mn("2"), mi("a")))
	disc := mrow(msup(mi("b"), mn("2")), mo("−"), mn("4"), mi("a"), mi("c"))
	steps := []struct {
		math h.Node
		why  string
	}{
		{mathBlock(mi("a"), msup(mi("x"), mn("2")), mo("+"), mi("b"), mi("x"), mo("+"), mi("c"), mo("="), mn("0")),
			"Start from a quadratic equation with a ≠ 0."},
		{mathBlock(msup(mi("x"), mn("2")), mo("+"), mfrac(mi("b"), mi("a")), mi("x"), mo("+"), mfrac(mi("c"), mi("a")), mo("="), mn("0")),
			"Divide both sides by a, which is allowed because a ≠ 0."},
		{mathBlock(msup(mi("x"), mn("2")), mo("+"), mfrac(mi("b"), mi("a")), mi("x"), mo("="), mo("−"), mfrac(mi("c"), mi("a"))),
			"Subtract c/a from both sides."},
		{mathBlock(msup(mi("x"), mn("2")), mo("+"), mfrac(mi("b"), mi("a")), mi("x"), mo("+"), msup(mrow(mo("("), half, mo(")")), mn("2")), mo("="),
			msup(mrow(mo("("), half, mo(")")), mn("2")), mo("−"), mfrac(mi("c"), mi("a"))),
			"Add (b/2a)², half the coefficient of x squared, to both sides. This is completing the square."},
		{mathBlock(msup(mrow(mo("("), mi("x"), mo("+"), half, mo(")")), mn("2")), mo("="), mfrac(disc, mrow(mn("4"), msup(mi("a"), mn("2"))))),
			"The left side is now a perfect square. Put the right side over the common denominator 4a²."},
		{mathBlock(mi("x"), mo("+"), half, mo("="), mo("±"), mfrac(msqrt(disc), mrow(mn("2"), mi("a")))),
			"Take square roots of both sides. Both signs are needed, and √(4a²) = 2|a|, whose sign the ± already covers."},
		{mathBlock(mi("x"), mo("="), mfrac(mrow(mo("−"), mi("b"), mo("±"), msqrt(disc)), mrow(mn("2"), mi("a")))),
			"Subtract b/2a from both sides. This is the quadratic formula."},
	}
	return Block{
		Slug:        "derivation",
		Title:       "Derivation, one line at a time",
		Description: "A derivation that reveals itself line by line, each line with the reason it is allowed. The learner can stop before the next line and predict it. Every line is in the page from the start, so search, print and screen readers get the whole argument.",
		Tags:        []string{"stepper", "justifications", "keyboard"},
		Render: func() h.Node {
			return proseRoot("prose-derive",
				proseKind("Derivation", "7 steps"),
				h.Ol(h.Data("pz", "steps"), h.Class("flex flex-col gap-1"),
					h.MapIdx(steps, func(i int, s struct {
						math h.Node
						why  string
					}) h.Node {
						return h.Li(h.Data("pz-step", fmt.Sprint(i)),
							h.Class("grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 rounded-lg border border-transparent px-3 py-2 transition-[background-color,border-color,opacity,translate] duration-200 ease-[var(--ease-out)] data-current:border-brand/40 data-current:bg-brand/5 data-enter:translate-y-1 data-enter:opacity-0 motion-reduce:transition-none"),
							h.Span(h.Class("pt-3 font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("%d", i+1)),
							h.Div(h.Class("flex min-w-0 flex-col gap-1"),
								h.Div(h.Class("overflow-x-auto py-1 text-[17px]"), s.math),
								h.P(h.Data("pz", "why"), h.Class("text-sm leading-6 text-muted-foreground"), s.why),
							),
						)
					}),
				),
				h.Div(h.Data("pz", "controls"), h.Hidden(), h.Class("flex flex-wrap items-center gap-2"),
					proseBtn("prev", hugeicons.ArrowLeft01Icon(), "Previous"),
					proseBtn("next", hugeicons.ArrowRight01Icon(), "Next line"),
					proseBtn("all", hugeicons.ViewIcon(), "Show all"),
				),
				h.P(h.Data("pz", "announce"), h.Aria("live", "polite"), h.Class("sr-only")),
				proseHelp("Next line or → reveals a line, Previous or ← hides it again, when focus is inside the derivation. Without JavaScript every line shows."),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

type proseSection struct {
	id, title string
	paras     []string
}

var proseEigenSections = []proseSection{
	{"stays", "Directions that stay put", []string{
		"Most vectors change direction when a matrix acts on them. A few special ones do not: the matrix only stretches them, shrinks them or flips them. These are the eigenvectors, and the stretch factor is the eigenvalue.",
		"For the matrix with rows (2, 1) and (1, 2), the vector (1, 1) comes out as (3, 3): same direction, three times as long. The vector (1, −1) comes out unchanged. Every other direction turns.",
	}},
	{"equation", "The equation Av = λv", []string{
		"Written as an equation, an eigenvector v and its eigenvalue λ satisfy Av = λv, with v not the zero vector. The zero vector would satisfy it for every λ, which tells us nothing, so it is excluded by definition.",
		"Moving everything to one side gives (A − λI)v = 0. So v is a nonzero solution of a homogeneous system, which exists exactly when the matrix A − λI is singular.",
	}},
	{"characteristic", "Finding λ: the characteristic polynomial", []string{
		"A matrix is singular exactly when its determinant is zero. Setting det(A − λI) = 0 gives a polynomial equation in λ, the characteristic polynomial, whose roots are the eigenvalues.",
		"For our 2 × 2 example it is (2 − λ)² − 1 = 0, so λ = 3 or λ = 1. An n × n matrix has a polynomial of degree n, so at most n eigenvalues, some of which may be complex or repeated.",
	}},
	{"vectors", "Finding v", []string{
		"For each eigenvalue, solve (A − λI)v = 0 by elimination. The solutions form a line, a plane or more: the eigenspace. Any nonzero vector in it is an eigenvector; we usually pick a simple one or scale it to length 1.",
		"In code, np.linalg.eig returns all eigenvalues and unit eigenvectors at once, computed by the QR algorithm rather than by the polynomial, which would be numerically unstable for large matrices.",
	}},
	{"why", "Why it matters", []string{
		"Applying a matrix many times amplifies its largest eigenvalue, so long-run behaviour is read off the eigenvectors: the steady state of a Markov chain, the ranking computed by PageRank, the main axes of a cloud of data in PCA.",
		"Eigenvalues also decide stability. A system that evolves by x ← Ax settles down when every eigenvalue has size below one and blows up when one of them is larger.",
	}},
}

func proseWords(sections []proseSection) (per []int, total int) {
	for _, s := range sections {
		n := len(strings.Fields(s.title))
		for _, p := range s.paras {
			n += len(strings.Fields(p))
		}
		per = append(per, n)
		total += n
	}
	return
}

func proseTOCBlock() Block {
	return Block{
		Slug:        "table-of-contents",
		Title:       "Table of contents with reading progress",
		Description: "The outline of a lesson, which marks the section you are reading, shows how far through you are, and estimates the minutes left at 230 words a minute. It sits beside the text on a wide screen and folds into an \"On this page\" menu on a phone.",
		Tags:        []string{"scrollspy", "aria-current", "reading time"},
		Wide:        true,
		Render: func() h.Node {
			per, total := proseWords(proseEigenSections)
			minutes := int(math.Ceil(float64(total) / 230))
			links := func(where string) h.Node {
				return h.Ol(h.Class("flex flex-col gap-0.5 text-sm"),
					h.MapIdx(proseEigenSections, func(i int, s proseSection) h.Node {
						return h.Li(h.A(h.Href("#prose-toc-"+s.id), h.Data("pz-toc", s.id), h.Data("pz-words", fmt.Sprint(per[i])),
							h.Class("group flex items-start gap-2 rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-[current=location]:text-foreground"),
							h.Span(h.Class("mt-[7px] size-1.5 shrink-0 rounded-full bg-border transition-colors duration-150 group-aria-[current=location]:bg-brand group-data-done:bg-brand/40")),
							h.Span(s.title)))
					}))
			}
			progress := h.Div(h.Class("flex flex-col gap-1.5 px-2"),
				h.Div(h.Data("pz", "bar"), h.Role("progressbar"), h.Aria("label", "Reading progress"), h.Attr("aria-valuemin", "0"), h.Attr("aria-valuemax", "100"), h.Attr("aria-valuenow", "0"),
					h.Class("h-1 overflow-hidden rounded-full bg-muted"),
					h.Div(h.Data("pz", "fill"), h.Class("h-full w-full origin-left scale-x-0 rounded-full bg-brand transition-transform duration-150 motion-reduce:transition-none"))),
				h.P(h.Class("flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground tabular-nums"),
					hugeicons.Clock01Icon(h.Class("size-3")), h.Span(h.Data("pz", "left"), fmt.Sprintf("%d min read", minutes))),
			)
			return proseRoot("prose-toc",
				proseKind("Outline", fmt.Sprintf("%d words", total), fmt.Sprintf("%d min", minutes)),
				h.Details(h.Data("pz", "sheet"), h.Class("group rounded-lg border lg:hidden"),
					h.Summary(h.Class("flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"),
						hugeicons.LeftToRightListBulletIcon(h.Class("size-4 text-muted-foreground")), "On this page",
						h.Span(h.Data("pz", "current"), h.Class("ml-auto truncate text-xs font-normal text-muted-foreground")),
						hugeicons.ArrowDown01Icon(h.Class("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"))),
					h.Nav(h.Aria("label", "On this page"), h.Class("flex flex-col gap-3 border-t p-2"), links("sheet"), progress),
				),
				h.Div(h.Class("grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]"),
					h.Nav(h.Aria("label", "Lesson outline"), h.Class("hidden flex-col gap-4 lg:flex"),
						h.P(h.Class("px-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Eigenvectors"),
						links("side"), progress),
					h.Article(h.Data("pz", "article"), h.TabIndex(0), h.Aria("label", "Lesson: eigenvectors"),
						h.Class("relative h-[26rem] overflow-y-auto overscroll-contain scroll-smooth rounded-xl border bg-background px-5 py-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:scroll-auto sm:px-8"),
						h.Map(proseEigenSections, func(s proseSection) h.Node {
							return h.Section(h.ID("prose-toc-"+s.id), h.Data("pz-section", s.id), h.Class("flex flex-col gap-3 pb-8"),
								h.H3(h.TabIndex(-1), h.Class("text-base font-semibold tracking-tight outline-none"), s.title),
								h.Map(s.paras, func(p string) h.Node { return h.P(h.Class(proseText), p) }))
						}),
						h.P(h.Class("pb-2 text-center font-mono text-[11px] text-muted-foreground"), "End of lesson"),
					),
				),
				proseHelp("Scroll the lesson and the outline follows. A link scrolls to its section and moves focus to the heading. Time left counts the words in the sections still ahead."),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

type proseCheck struct {
	id, prompt string
	options    [][2]string // value, label
	correct    string
	feedback   map[string]string
}

func proseCheckBlock() Block {
	checks := []proseCheck{
		{"indep", "Are they independent?", [][2]string{{"yes", "Yes"}, {"no", "No"}}, "no", map[string]string{
			"no":  "Right: (2, 4) = 2·(1, 2), so one is a multiple of the other.",
			"yes": "Not quite: (2, 4) is 2·(1, 2), so 2·(1, 2) − (2, 4) = 0 with nonzero coefficients.",
		}},
		{"det", "Its determinant is", [][2]string{{"2", "2"}, {"10", "10"}, {"-2", "−2"}}, "2", map[string]string{
			"2":  "Right: 2·3 − 1·4 = 2.",
			"10": "That is 2·3 + 1·4. The cross term is subtracted: ad − bc.",
			"-2": "Check the order: ad − bc = 6 − 4, not 4 − 6.",
		}},
	}
	chip := "inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 align-baseline font-mono text-[13px] outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none data-right:border-brand data-right:bg-brand/10 data-right:text-brand data-wrong:border-del/60 data-wrong:text-del"
	inline := func(c proseCheck) h.Node {
		return h.Group(
			h.Span(h.Data("pz-check", c.id), h.Data("correct", c.correct), h.Role("group"), h.Aria("label", "Quick check: "+c.prompt), h.Hidden(),
				h.Class("mx-1 inline-flex flex-wrap gap-1 align-baseline"),
				h.Map(c.options, func(o [2]string) h.Node {
					return h.Button(h.Type("button"), h.Data("pz-opt", o[0]), h.Data("feedback", c.feedback[o[0]]), h.Class(chip), o[1])
				})),
			h.Span(h.Data("pz-fb", c.id), h.Aria("live", "polite"), h.Class("text-sm empty:hidden data-right:text-brand data-wrong:text-del")),
		)
	}
	answers := func(c proseCheck) h.Node {
		return h.Details(h.Data("pz", "answer"), h.Class("text-sm text-muted-foreground"),
			h.Summary(h.Class("cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), "Answer: "+c.prompt),
			h.P(h.Class("mt-1"), c.feedback[c.correct]))
	}
	return Block{
		Slug:        "inline-checks",
		Title:       "Checks inside the prose",
		Description: "One-tap questions in the middle of a sentence, so checking understanding does not mean leaving the text for a quiz. Feedback appears inline and explains the likely slip. A hidden answer reveals on request. Without JavaScript the questions become plain \"Answer\" disclosures.",
		Tags:        []string{"retrieval", "inline feedback", "spoiler"},
		Render: func() h.Node {
			return proseRoot("prose-checks",
				proseKind("Inline checks", "2 questions", "1 spoiler"),
				h.Div(h.Class("flex flex-col gap-4 "+proseText),
					h.P("Two vectors are dependent when one is a multiple of the other. Take (1, 2) and (2, 4).", inline(checks[0])),
					h.P("The determinant of the matrix with rows (2, 1) and (4, 3) measures how it scales areas.", inline(checks[1])),
					h.P("Swapping two rows flips the sign of a determinant. So a 3 × 3 matrix with two equal rows, which is unchanged by swapping them, has determinant ",
						h.Button(h.Type("button"), h.Data("pz", "spoiler"),
							h.Class("group/sp mx-0.5 inline-flex h-7 items-center rounded-md border border-dashed bg-muted px-2 align-baseline font-mono text-[13px] outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:border-solid aria-expanded:border-brand/40 aria-expanded:bg-brand/10 aria-expanded:text-brand"),
							h.Span(h.Class("transition-[filter] duration-200 group-aria-[expanded=false]/sp:blur-[5px] group-aria-[expanded=false]/sp:select-none motion-reduce:transition-none"), "0")),
						", since d = −d forces d = 0."),
				),
				h.Div(h.Class("flex flex-col gap-1"), answers(checks[0]), answers(checks[1])),
				proseHelp("Tap an answer; a wrong one explains itself and you can try again. Only the first try counts in the tally. The blurred number reveals on click."),
			)
		},
	}
}

// ---------------------------------------------------------------- P10

// proseEllipseSVG draws Figure 2.1: the unit circle and its image under
// A = [[2, 1], [1, 2]], with the eigenvectors (1, 1) and (1, −1).
func proseEllipseSVG(class string) h.Node {
	const s, cx, cy = 34.0, 160.0, 130.0
	pt := func(x, y float64) string { return fmt.Sprintf("%.1f,%.1f", cx+s*x, cy-s*y) }
	var circle, ellipse []string
	for i := 0; i <= 96; i++ {
		t := 2 * math.Pi * float64(i) / 96
		c, sn := math.Cos(t), math.Sin(t)
		circle = append(circle, pt(c, sn))
		ellipse = append(ellipse, pt(2*c+sn, c+2*sn))
	}
	arrow := func(x, y float64, color string) h.Node {
		return h.Line(h.Attr("x1", fmt.Sprint(cx)), h.Attr("y1", fmt.Sprint(cy)), h.Attr("x2", fmt.Sprintf("%.1f", cx+s*x)), h.Attr("y2", fmt.Sprintf("%.1f", cy-s*y)),
			h.Attr("stroke-width", "2.5"), h.Attr("stroke-linecap", "round"), h.Style("stroke:"+color))
	}
	r := 1 / math.Sqrt2
	return h.Svg(h.ViewBox("0 0 320 260"), h.Class(class), h.Attr("aria-hidden", "true"),
		h.Line(h.Attr("x1", "10"), h.Attr("y1", "130"), h.Attr("x2", "310"), h.Attr("y2", "130"), h.Class("stroke-border")),
		h.Line(h.Attr("x1", "160"), h.Attr("y1", "10"), h.Attr("x2", "160"), h.Attr("y2", "250"), h.Class("stroke-border")),
		h.Line(h.Attr("x1", "60"), h.Attr("y1", "230"), h.Attr("x2", "260"), h.Attr("y2", "30"), h.Class("stroke-muted-foreground/30"), h.Attr("stroke-dasharray", "2 4")),
		h.Line(h.Attr("x1", "60"), h.Attr("y1", "30"), h.Attr("x2", "260"), h.Attr("y2", "230"), h.Class("stroke-muted-foreground/30"), h.Attr("stroke-dasharray", "2 4")),
		h.Polyline(h.Attr("points", strings.Join(circle, " ")), h.Class("fill-none stroke-muted-foreground"), h.Attr("stroke-dasharray", "3 3")),
		h.Polyline(h.Attr("points", strings.Join(ellipse, " ")), h.Class("fill-brand/10 stroke-brand"), h.Attr("stroke-width", "1.75")),
		arrow(3*r, 3*r, "var(--vec-u)"),
		arrow(r, -r, "var(--vec-v)"),
		h.SvgText(h.Attr("x", "240"), h.Attr("y", "48"), h.Class("font-mono text-[12px]"), h.Style("fill:var(--vec-u)"), "λ = 3"),
		h.SvgText(h.Attr("x", "196"), h.Attr("y", "170"), h.Class("font-mono text-[12px]"), h.Style("fill:var(--vec-v)"), "λ = 1"),
	)
}

// proseIterSVG draws Figure 2.2: the direction of Aᵏx for k = 0…5,
// starting from x = (1, 0), closing in on the eigenvector (1, 1).
func proseIterSVG(class string) h.Node {
	const cx, cy, R = 40.0, 220.0, 170.0
	x, y := 1.0, 0.0
	var nodes []h.Node
	nodes = append(nodes,
		h.Line(h.Attr("x1", "40"), h.Attr("y1", "220"), h.Attr("x2", "230"), h.Attr("y2", "30"), h.Class("stroke-muted-foreground/40"), h.Attr("stroke-dasharray", "2 4")),
		h.El("path", h.Attr("d", fmt.Sprintf("M %.1f %.1f A %.1f %.1f 0 0 0 %.1f %.1f", cx+R, cy, R, R, cx, cy-R)), h.Class("fill-none stroke-border")))
	for k := 0; k <= 5; k++ {
		n := math.Hypot(x, y)
		ux, uy := x/n, y/n
		op := 0.35 + 0.13*float64(k)
		nodes = append(nodes,
			h.Line(h.Attr("x1", fmt.Sprint(cx)), h.Attr("y1", fmt.Sprint(cy)), h.Attr("x2", fmt.Sprintf("%.1f", cx+R*ux)), h.Attr("y2", fmt.Sprintf("%.1f", cy-R*uy)),
				h.Attr("stroke-width", "2"), h.Attr("stroke-linecap", "round"), h.Style(fmt.Sprintf("stroke:var(--brand);opacity:%.2f", op))),
		)
		if k <= 2 || k == 5 {
			lbl := fmt.Sprintf("k = %d", k)
			if k == 5 {
				lbl = "k = 3–5"
			}
			nodes = append(nodes, h.SvgText(h.Attr("x", fmt.Sprintf("%.1f", cx+(R+10)*ux)), h.Attr("y", fmt.Sprintf("%.1f", cy-(R+10)*uy+4)), h.Class("fill-muted-foreground font-mono text-[11px]"), lbl))
		}
		x, y = 2*x+y, x+2*y
	}
	return h.Svg(append([]any{h.ViewBox("0 0 320 240"), h.Class(class), h.Attr("aria-hidden", "true")}, h.Group(nodes))...)
}

type proseFig struct {
	id, title, caption, long string
	draw                     func(class string) h.Node
}

func proseFigure(num string, f proseFig) h.Node {
	capID, descID := "prose-fig-"+f.id+"-cap", "prose-fig-"+f.id+"-desc"
	return h.Figure(h.ID("prose-fig-"+f.id), h.Class("flex scroll-mt-24 flex-col gap-2 rounded-lg target:ring-2 target:ring-brand/40"),
		h.Div(h.Role("img"), h.Aria("labelledby", capID), h.Aria("describedby", descID), h.Class("relative overflow-hidden rounded-lg border bg-code"),
			f.draw("block h-auto w-full"),
			h.Div(h.Class("absolute top-2 right-2"),
				dialog.Dialog(
					dialog.Trigger(lib.AsChild, button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-7 bg-background/80 backdrop-blur-sm"),
						h.Aria("label", "Enlarge "+num), hugeicons.ArrowExpand01Icon(h.Class("size-3.5")))),
					dialog.Content(h.Class("sm:max-w-3xl"),
						dialog.Header(dialog.Title(num+" · "+f.title), dialog.Description(f.caption)),
						h.Div(h.Class("overflow-hidden rounded-lg border bg-code"), f.draw("block h-auto w-full")),
						h.P(h.Class("text-sm leading-6 text-muted-foreground"), f.long),
					)),
			),
		),
		h.Figcaption(h.ID(capID), h.Class("text-sm leading-6"),
			h.Strong(h.Class("font-semibold"), num+". "), h.Span(h.Class("text-muted-foreground"), f.caption)),
		h.Details(h.Class("text-sm"),
			h.Summary(h.Class("cursor-pointer rounded-sm font-mono text-[11px] text-muted-foreground uppercase outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50"), "Describe this figure"),
			h.P(h.ID(descID), h.Class("mt-1 leading-6 text-muted-foreground"), f.long)),
	)
}

func proseFigureBlock() Block {
	figs := []proseFig{
		{"ellipse", "Circle to ellipse", "The unit circle (dashed) and its image under A, an ellipse whose axes are the eigenvectors.",
			"A dashed unit circle centred at the origin, and a pink ellipse around it, tilted at 45 degrees. The ellipse reaches 3 units along the diagonal y = x, marked by a blue arrow labelled lambda = 3, and 1 unit along the other diagonal, marked by a violet arrow labelled lambda = 1. Every other point of the circle moves to a point of the ellipse that is not on its original line.",
			proseEllipseSVG},
		{"iterate", "Repeated multiplication", "The direction of Aᵏx for k = 0 to 5, starting from x = (1, 0): each product turns closer to the eigenvector (1, 1).",
			"Six arrows from the origin inside a quarter circle, fading from light to dark pink. The first, labelled k = 0, points along the x axis. Each later arrow is closer to the dashed diagonal, and by k = 5 the arrow is almost on it, because the eigenvalue 3 outgrows the eigenvalue 1.",
			proseIterSVG},
	}
	return Block{
		Slug:        "figures",
		Title:       "Numbered figures",
		Description: "Figures numbered by the page, with captions, references that jump to them, an enlarge button that opens the figure in a dialog, and a long text description for readers who cannot see it. The description is attached to the image, so a screen reader reads it as the figure's description.",
		Tags:        []string{"figcaption", "dialog", "long description"},
		Render: func() h.Node {
			nums := []string{"Figure 2.1", "Figure 2.2"}
			ref := func(i int) h.Node {
				return h.A(h.Href("#prose-fig-"+figs[i].id), h.Class("font-medium text-foreground underline decoration-foreground/30 decoration-dotted underline-offset-4 outline-none hover:decoration-brand focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50"), nums[i])
			}
			return proseRoot("prose-figures",
				proseKind("Figures", "auto-numbered"),
				h.P(h.Class(proseText), "A matrix sends the unit circle to an ellipse whose axes are its eigenvectors, as ", ref(0),
					" shows for A with rows (2, 1) and (1, 2). Multiplying by A again and again pulls every starting vector toward the eigenvector with the largest eigenvalue (", ref(1), ")."),
				h.Div(h.Class("grid gap-5 sm:grid-cols-2"),
					h.MapIdx(figs, func(i int, f proseFig) h.Node { return proseFigure(nums[i], f) })),
				proseHelp("The enlarge button opens the figure in a dialog: Esc or the close button returns focus to it. \"Describe this figure\" shows the text that screen readers already get."),
			)
		},
	}
}

// ---------------------------------------------------------------- P11

func proseSettingsBlock() Block {
	group := func(name, legend string, opts [][2]string, def string) h.Node {
		return h.Fieldset(h.Class("flex min-w-0 flex-col gap-1.5"),
			h.Legend(h.Class("mb-1.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), legend),
			h.Div(h.Class("flex flex-wrap gap-1"),
				h.Map(opts, func(o [2]string) h.Node {
					return h.Label(h.Class("relative"),
						h.Input(h.Type("radio"), h.Name("prose-"+name), h.Value(o[0]), h.Data("pz-set", name), h.Iff(o[0] == def, func() h.Prop { return h.Checked() }),
							h.Class("peer sr-only")),
						h.Span(h.Class("inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-xs text-muted-foreground transition-[border-color,background-color,color,box-shadow] duration-150 select-none hover:bg-accent peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"), o[1]))
				})),
		)
	}
	return Block{
		Slug:        "reading-settings",
		Title:       "Reading settings",
		Description: "Text size, line length, typeface and spacing, chosen by the reader and remembered on this device. The wider letter and word spacing follows the British Dyslexia Association's style guide. On the platform the choice would apply to every lesson; here it applies to the sample passage.",
		Tags:        []string{"localStorage", "radio groups", "readability"},
		Render: func() h.Node {
			return proseRoot("prose-settings",
				proseKind("Reading", "saved on this device"),
				h.Div(h.Class("grid gap-4 sm:grid-cols-2"),
					group("size", "Text size", [][2]string{{"s", "Small"}, {"m", "Medium"}, {"l", "Large"}, {"xl", "Extra large"}}, "m"),
					group("measure", "Line length", [][2]string{{"narrow", "Narrow"}, {"medium", "Medium"}, {"wide", "Wide"}}, "medium"),
					group("face", "Typeface", [][2]string{{"sans", "Sans"}, {"serif", "Serif"}}, "sans"),
					group("spacing", "Spacing", [][2]string{{"normal", "Normal"}, {"open", "Open"}}, "normal"),
				),
				h.Div(h.Class("flex items-center gap-2"),
					proseBtn("reset", hugeicons.RefreshIcon(), "Reset"),
					h.Span(h.Data("pz", "saved"), h.Aria("live", "polite"), h.Class("font-mono text-xs text-muted-foreground")),
				),
				h.Div(h.Data("pz", "passage"), h.Class("rounded-xl border bg-background px-5 py-4"),
					h.Div(h.Data("pz", "measure"), h.Class("flex max-w-[60ch] flex-col gap-3 text-foreground/90 transition-[max-width] duration-200 motion-reduce:transition-none"),
						h.H3(h.Class("text-[1.1em] font-semibold tracking-tight"), "What a matrix does"),
						h.P(h.Class("text-pretty"), "A matrix is a machine that takes a vector in and gives a vector out. Each column says where one of the basis vectors lands, and every other vector follows, because the machine is linear: it respects addition and scaling."),
						h.P(h.Class("text-pretty"), "So to know a 2 × 2 matrix, it is enough to watch two arrows. Where (1, 0) goes is the first column; where (0, 1) goes is the second. The rest of the plane comes along like a sheet of rubber pinned to those two arrows."),
					),
				),
				proseHelp("Settings are stored in localStorage under hypercode.reading. If storage is blocked (private browsing, strict settings) they still apply until you leave the page, and the note says so."),
			)
		},
	}
}
