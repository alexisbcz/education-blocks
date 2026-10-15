package site

import (
	"fmt"
	"math"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ProseBlocks lists the reading components of a lesson page: the parts an
// author writes prose with, as opposed to exercises (Assessment) or the
// lesson player around them (Platform). Every block is server-rendered and
// readable without JavaScript; static/js/prose.js and prose-more.js only
// enhance it. Block roots are data-prose-*, inner parts data-pz.
func ProseBlocks() []Block {
	return []Block{
		proseTheoremBlock(),
		proseSidenoteBlock(),
		proseCalloutBlock(),
		proseExplorableBlock(),
		proseNotationBlock(),
		proseCellBlock(),
		proseDerivationBlock(),
		proseTOCBlock(),
		proseCheckBlock(),
		proseFigureBlock(),
		proseSettingsBlock(),
	}
}

// proseText is the body type of a lesson: a little larger than UI text,
// with a reading line height.
const proseText = "text-[15px] leading-7 text-foreground/90 text-pretty"

// proseRoot is a block root: one data-prose-* attribute, nothing else the
// modules look for.
func proseRoot(attr string, children ...any) h.Node {
	return h.Div(append([]any{h.Data(attr, ""), h.Class("relative flex min-w-0 flex-col gap-5")}, children...)...)
}

// proseBtn is an outline button the module finds by its data-pz name.
func proseBtn(name string, icon h.Node, label string, extra ...any) h.Node {
	return button.Button(append([]any{button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("pz", name), icon, label}, extra...)...)
}

// proseKind is the small badge row on top of a component.
func proseKind(kind string, notes ...string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-2"),
		badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), kind),
		h.Map(notes, func(n string) h.Node {
			return badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal text-muted-foreground"), n)
		}),
		h.Span(h.Data("pz", "status"), h.Aria("live", "polite"), h.Class("ml-auto font-mono text-xs text-muted-foreground tabular-nums")),
	)
}

// proseHelp is the line under a component that says how to use it.
func proseHelp(children ...any) h.Node {
	return h.P(append([]any{h.Class("border-t pt-4 text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

func munderover(base, under, over any) h.Node { return h.El("munderover", base, under, over) }
func msqrt(children ...any) h.Node            { return h.El("msqrt", children...) }

// xbar is x with a bar: the sample mean.
func xbar() h.Node { return mover(mi("x"), h.El("mo", h.Attr("accent", "true"), "¯")) }

// realsN is ℝⁿ.
func realsN(n string) h.Node { return msup(mi("ℝ"), mi(n)) }

// ---------------------------------------------------------------- P1

// proseEnv is a numbered environment: definition, lemma, theorem,
// corollary. The statement and proof take the ref function so a statement
// can cite another environment by label, whatever its number ends up being.
type proseEnv struct {
	label, kind, name string
	statement         func(ref func(string) h.Node) h.Node
	proof             []func(ref func(string) h.Node) h.Node
}

func proseTheoremBlock() Block {
	return Block{
		Slug:        "theorem-environments",
		Title:       "Definitions, theorems and proofs",
		Description: "Numbered environments with cross-references that never go stale: the author cites a label, the page prints \"Theorem 2.3\". Hover or focus a reference to read the statement without losing your place. Proofs open one step at a time, so a learner can try the next step before reading it.",
		Tags:        []string{"auto-numbering", "cross-references", "stepwise proof"},
		Render: func() h.Node {
			v := func(i string) h.Node { return msub(vecSym("v"), mi(i)) }
			envs := []proseEnv{
				{label: "def-indep", kind: "Definition", name: "Linear independence",
					statement: func(ref func(string) h.Node) h.Node {
						return h.Group("Vectors ", mathml(v("1"), mo(","), mo("…"), mo(","), v("k")),
							" are linearly independent when ",
							mathml(msub(mi("c"), mn("1")), v("1"), mo("+"), mo("⋯"), mo("+"), msub(mi("c"), mi("k")), v("k"), mo("="), vecSym("0")),
							" only for ", mathml(msub(mi("c"), mn("1")), mo("="), mo("⋯"), mo("="), msub(mi("c"), mi("k")), mo("="), mn("0")), ". Otherwise they are dependent.")
					}},
				{label: "lem-rows", kind: "Lemma", name: "Row operations keep the solutions",
					statement: func(ref func(string) h.Node) h.Node {
						return h.Group("Swapping two rows, scaling a row by a nonzero number, or adding a multiple of one row to another does not change the solutions of ",
							mathml(mi("A"), vecSym("x"), mo("="), vecSym("0")), ".")
					}},
				{label: "thm-many", kind: "Theorem", name: "Too many vectors",
					statement: func(ref func(string) h.Node) h.Node {
						return h.Group("Any ", mathml(mi("n"), mo("+"), mn("1")), " vectors in ", mathml(realsN("n")), " are linearly dependent.")
					},
					proof: []func(ref func(string) h.Node) h.Node{
						func(ref func(string) h.Node) h.Node {
							return h.Group("Put the vectors as the columns of an ", mathml(mi("n"), mo("×"), mrow(mi("n"), mo("+"), mn("1"))), " matrix ", mathml(mi("A")),
								". By ", ref("def-indep"), ", they are dependent exactly when ", mathml(mi("A"), vecSym("x"), mo("="), vecSym("0")), " has a nonzero solution.")
						},
						func(ref func(string) h.Node) h.Node {
							return h.Group("Reduce ", mathml(mi("A")), " to echelon form. By ", ref("lem-rows"), ", the solutions do not change.")
						},
						func(ref func(string) h.Node) h.Node {
							return h.Group("Each of the ", mathml(mi("n")), " rows holds at most one pivot, so at most ", mathml(mi("n")), " of the ",
								mathml(mi("n"), mo("+"), mn("1")), " columns have one. At least one variable is free.")
						},
						func(ref func(string) h.Node) h.Node {
							return h.Group("Set that free variable to 1, the others to 0, and solve for the pivot variables by back substitution. This gives a nonzero solution. ∎")
						},
					}},
				{label: "cor-basis", kind: "Corollary", name: "Size of a basis",
					statement: func(ref func(string) h.Node) h.Node {
						return h.Group("A linearly independent set in ", mathml(realsN("n")), " has at most ", mathml(mi("n")), " vectors. This follows from ", ref("thm-many"), ".")
					}},
			}
			number := map[string]string{}
			for i, e := range envs {
				number[e.label] = fmt.Sprintf("%s 2.%d", e.kind, i+1)
			}
			ref := func(label string) h.Node {
				return h.A(h.Href("#prose-"+label), h.Data("pz-ref", label),
					h.Class("font-medium text-foreground underline decoration-foreground/30 decoration-dotted underline-offset-4 transition-colors duration-150 hover:decoration-brand focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"),
					number[label])
			}
			return proseRoot("prose-thm",
				proseKind("Environments", "numbered", "linked"),
				h.Div(h.Class("flex flex-col gap-4 "+proseText),
					h.P("Section 2 builds up to the size of a basis. Each statement below is numbered by the page, not by the author, so inserting a lemma renumbers everything after it and every reference follows."),
					h.Map(envs, func(e proseEnv) h.Node { return proseEnvNode(e, number[e.label], ref) }),
					h.P("In the next section we use ", ref("cor-basis"), " to show that every basis of ", mathml(realsN("n")), " has exactly ", mathml(mi("n")), " vectors, and ", ref("thm-many"), " again when we count dimensions."),
				),
				proseHelp("Hover or Tab to a reference such as ", ref("thm-many"), " to preview it; press Esc to close the preview. Without JavaScript the references are plain links and the proof opens in full."),
			)
		},
	}
}

func proseEnvNode(e proseEnv, num string, ref func(string) h.Node) h.Node {
	theorem := e.kind != "Definition"
	box := "border-l-2 border-foreground/15 pl-4"
	if !theorem {
		box = "rounded-lg border bg-muted/30 px-4 py-3"
	}
	titleID := "prose-" + e.label + "-title"
	return h.Div(h.ID("prose-"+e.label), h.Data("pz-env", e.label), h.Role("group"), h.Aria("labelledby", titleID),
		h.Class("scroll-mt-24 transition-[background-color] duration-300 target:bg-brand/5 "+box),
		h.P(h.Class("flex flex-col gap-1"),
			h.Span(h.ID(titleID), h.Class("text-sm"),
				h.Strong(h.Class("font-semibold"), num), h.Span(h.Class("text-muted-foreground"), " ("+e.name+")")),
			h.Span(h.Data("pz-statement", ""), h.Class(h.Ternary(theorem, "italic", "")), e.statement(ref)),
		),
		h.Iff(len(e.proof) > 0, func() h.Node {
			return h.Details(h.Data("pz", "proof"), h.Class("group mt-3"),
				h.Summary(h.Class("inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"),
					hugeicons.ArrowRight01Icon(h.Class("size-3.5 transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-90 motion-reduce:transition-none")),
					"Proof"),
				h.Ol(h.Class("mt-3 flex flex-col gap-2"),
					h.MapIdx(e.proof, func(i int, step func(ref func(string) h.Node) h.Node) h.Node {
						return h.Li(h.Data("pz-step", fmt.Sprint(i)), h.Class("grid grid-cols-[1.5rem_1fr] gap-1"),
							h.Span(h.Class("font-mono text-xs leading-7 text-muted-foreground tabular-nums"), fmt.Sprintf("%d.", i+1)),
							h.Span(step(ref)))
					}),
				),
				h.Div(h.Data("pz", "proof-controls"), h.Hidden(), h.Class("mt-3 flex flex-wrap items-center gap-2"),
					proseBtn("next", hugeicons.ArrowDown01Icon(), "Next step"),
					proseBtn("all", hugeicons.ViewIcon(), "Show all"),
					h.Span(h.Data("pz", "count"), h.Aria("live", "polite"), h.Class("font-mono text-xs text-muted-foreground tabular-nums")),
				),
			)
		}),
	)
}

// ---------------------------------------------------------------- P2

func proseSidenoteBlock() Block {
	type note struct{ n, text string }
	type para struct {
		body  h.Node
		notes []note
	}
	sn := func(n string) h.Node {
		return h.A(h.Href("#prose-sn-"+n), h.ID("prose-snref-"+n), h.Data("pz-sn", n), h.Aria("label", "Margin note "+n),
			h.Class("relative -top-[0.5em] ml-0.5 rounded-sm px-0.5 align-baseline font-mono text-[10px] leading-none font-medium text-brand no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), n)
	}
	fn := func(n string) h.Node {
		return h.A(h.Href("#prose-fn-"+n), h.ID("prose-fnref-"+n), h.Aria("label", "Footnote "+n),
			h.Class("relative -top-[0.5em] ml-0.5 scroll-mt-24 rounded-sm px-0.5 align-baseline font-mono text-[10px] leading-none text-muted-foreground underline decoration-dotted underline-offset-2 outline-none target:bg-brand/15 focus-visible:ring-2 focus-visible:ring-ring/50"), "["+n+"]")
	}
	paras := []para{
		{h.Group("The dot product of two vectors multiplies them component by component and adds the results",
			sn("1"), ". For ", mathml(vecSym("u"), mo("="), mrow(mo("("), mn("3"), mo(","), mn("4"), mo(")"))), " and ",
			mathml(vecSym("v"), mo("="), mrow(mo("("), mn("4"), mo(","), mn("3"), mo(")"))), " it is 3·4 + 4·3 = 24."),
			[]note{{"1", "Some books write ⟨u, v⟩ instead of u · v. The two mean the same thing for real vectors."}}},
		{h.Group("The same number measures an angle. Divide by both lengths and you get the cosine of the angle between the vectors: here 24 / (5 · 5) = 0.96, about 16°",
			sn("2"), ". Two vectors are perpendicular exactly when their dot product is zero", fn("1"), "."),
			[]note{{"2", "Lengths come from the dot product too: |u| = √(u · u) = √25 = 5."}}},
		{h.Group("In code this is one line, and NumPy has it built in", sn("3"), ". The cosine is what search engines and language models compare when they ask whether two pieces of text are about the same thing", fn("2"), "."),
			[]note{{"3", "np.dot(u, v), or u @ v for arrays."}}},
	}
	return Block{
		Slug:        "sidenotes",
		Title:       "Margin notes and footnotes",
		Description: "Tufte-style notes that sit in the margin next to the line they comment on, so the eye moves sideways instead of to the bottom of the page. On a narrow screen the margin disappears and each note opens inline from its number. Footnotes, for sources and asides, link both ways.",
		Tags:        []string{"sidenotes", "footnotes", "back-links"},
		Wide:        true,
		Render: func() h.Node {
			return proseRoot("prose-side",
				proseKind("Notes", "margin", "inline on phones"),
				h.Div(h.Class("grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,40rem)_14rem]"),
					h.Map(paras, func(p para) h.Node {
						return h.Group(
							h.P(h.Class(proseText), p.body),
							h.Div(h.Class("flex flex-col gap-2 pb-2 lg:pb-0"),
								h.Map(p.notes, func(n note) h.Node {
									return h.Aside(h.ID("prose-sn-"+n.n), h.Data("pz-note", n.n), h.Aria("label", "Margin note "+n.n),
										h.Class("rounded-md border-l-2 border-brand/50 py-0.5 pl-3 text-[13px] leading-5 text-muted-foreground transition-[background-color] duration-300 data-flash:bg-brand/10"),
										h.Span(h.Class("mr-1 font-mono text-[10px] font-medium text-brand"), n.n), n.text)
								})),
						)
					}),
				),
				h.Section(h.Aria("label", "Footnotes"), h.Class("max-w-[40rem] border-t pt-3"),
					h.Ol(h.Class("flex flex-col gap-1.5 text-[13px] leading-5 text-muted-foreground"),
						h.Li(h.ID("prose-fn-1"), h.Class("scroll-mt-24 rounded-sm target:bg-brand/10"),
							h.Span(h.Class("mr-1.5 font-mono text-[10px]"), "1"),
							"Only for nonzero vectors; the zero vector is perpendicular to everything by this rule. ",
							h.A(h.Href("#prose-fnref-1"), h.Aria("label", "Back to footnote reference 1"), h.Class("rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), "↩")),
						h.Li(h.ID("prose-fn-2"), h.Class("scroll-mt-24 rounded-sm target:bg-brand/10"),
							h.Span(h.Class("mr-1.5 font-mono text-[10px]"), "2"),
							"Salton, Wong and Yang, \"A vector space model for automatic indexing\", Communications of the ACM 18(11), 1975. ",
							h.A(h.Href("#prose-fnref-2"), h.Aria("label", "Back to footnote reference 2"), h.Class("rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), "↩")),
					),
				),
				proseHelp("Resize the window below 1024 px to see the margin fold into the text: numbers become buttons that open their note in place. Footnote numbers jump to the note and ↩ jumps back."),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func proseCallout(kind, color string, icon h.Node, title string, body ...any) h.Node {
	id := "prose-callout-" + strings.ToLower(strings.ReplaceAll(kind, " ", "-"))
	return h.Div(h.Role("note"), h.Aria("labelledby", id),
		h.Class("grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-l-[3px] bg-background px-4 py-3"),
		h.Style("border-left-color:"+color),
		h.Span(h.Class("mt-0.5 [&>svg]:size-4"), h.Style("color:"+color), icon),
		h.P(h.ID(id), h.Class("text-sm font-semibold"), h.Span(h.Class("sr-only"), kind+": "), title),
		h.Div(append([]any{h.Class("col-start-2 flex flex-col gap-2 text-sm leading-6 text-foreground/85")}, body...)...),
	)
}

func proseCalloutBlock() Block {
	return Block{
		Slug:        "callouts",
		Title:       "Callouts",
		Description: "Five kinds of aside a lesson needs, each with one colour, one icon and one job: a note, a tip, a warning, a common mistake set out wrong-then-right, and a historical aside that stays folded unless the reader wants it. Each is a labelled note, so a screen reader announces the kind before the text.",
		Tags:        []string{"role=note", "consistent icons", "details"},
		Render: func() h.Node {
			return proseRoot("prose-callouts",
				proseKind("Callouts", "5 kinds"),
				h.Div(h.Class("flex flex-col gap-3"),
					proseCallout("Note", "var(--vec-u)", hugeicons.InformationCircleIcon(), "Vectors are columns",
						h.P("In this course a vector is a column unless we say otherwise, so a matrix acts on it from the left: ", mathml(mi("A"), vecSym("x")), ".")),
					proseCallout("Tip", "var(--vec-v)", hugeicons.Idea01Icon(), "Check shapes before multiplying",
						h.P("An ", mathml(mi("m"), mo("×"), mi("n")), " matrix times an ", mathml(mi("n"), mo("×"), mi("p")), " matrix is ", mathml(mi("m"), mo("×"), mi("p")),
							". If the inner numbers differ, the product does not exist, and NumPy will tell you with a shape error.")),
					proseCallout("Warning", "var(--vec-out)", hugeicons.Alert02Icon(), "Floating point and zero",
						h.P(h.Code(h.Class("rounded bg-code px-1 py-0.5 font-mono text-[12px]"), "np.linalg.det"), " of a singular matrix often returns something like ",
							h.Code(h.Class("rounded bg-code px-1 py-0.5 font-mono text-[12px]"), "6.7e-16"), " instead of 0. Compare with a tolerance, or ask for the rank.")),
					proseCallout("Common mistake", "var(--code-del)", hugeicons.Cancel01Icon(), "Transposing a product",
						h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
							h.Div(h.Class("rounded-md border border-del/30 bg-del/5 px-3 py-2"),
								h.P(h.Class("mb-1 flex items-center gap-1.5 font-mono text-[11px] text-del uppercase"), hugeicons.Cancel01Icon(h.Class("size-3")), "Wrong"),
								mathml(msup(mrow(mo("("), mi("A"), mi("B"), mo(")")), mi("T")), mo("="), msup(mi("A"), mi("T")), msup(mi("B"), mi("T")))),
							h.Div(h.Class("rounded-md border border-brand/40 bg-brand/5 px-3 py-2"),
								h.P(h.Class("mb-1 flex items-center gap-1.5 font-mono text-[11px] text-brand uppercase"), hugeicons.Tick02Icon(h.Class("size-3")), "Right"),
								mathml(msup(mrow(mo("("), mi("A"), mi("B"), mo(")")), mi("T")), mo("="), msup(mi("B"), mi("T")), msup(mi("A"), mi("T")))),
						),
						h.P(h.Class("text-muted-foreground"), "The order reverses, like taking off socks and shoes. With a 2×3 ", mathml(mi("A")), " and a 3×4 ", mathml(mi("B")), ", the wrong version does not even have matching shapes.")),
					h.Details(h.Class("group rounded-lg border border-l-[3px] border-l-muted-foreground/50 bg-background px-4 py-3"),
						h.Summary(h.Class("grid cursor-pointer list-none grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-sm text-sm font-semibold outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"),
							hugeicons.BookOpen01Icon(h.Class("size-4 text-muted-foreground")),
							h.Span(h.Span(h.Class("sr-only"), "Historical aside: "), "Who named the determinant?"),
							hugeicons.ArrowDown01Icon(h.Class("size-3.5 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180 motion-reduce:transition-none"))),
						h.P(h.Class("mt-2 ml-8 text-sm leading-6 text-foreground/85"),
							"Seki Takakazu in Japan (1683) and Leibniz in Germany (1693) both computed determinants to solve systems of equations. Gauss used the word \"determinant\" in 1801 for a quantity attached to quadratic forms, and Cauchy gave it its modern meaning in 1812."),
					),
				),
				proseHelp("Colours come from the theme (note blue, tip violet, warning amber, mistake red, history grey). The right answer in a mistake uses the platform's pink, the same as a correct answer in an exercise."),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

// proseInlineScrub is a number inside a sentence that the reader drags.
func proseInlineScrub(name, label string, v, min, max, step float64) h.Node {
	return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
		h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)),
		h.Aria("label", label), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
		h.Class("mx-0.5 inline-block h-7 w-12 cursor-ew-resize rounded-md border border-dashed border-brand/60 bg-brand/10 px-1 text-center align-baseline font-mono text-[14px] font-medium text-brand tabular-nums outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-solid"))
}

// proseShearPoints maps the unit square through [[a, b], [0, d]] into the
// figure's pixels: 40 px per unit, origin at (160, 130), y up.
func proseShearPoints(a, b, d float64) (poly string, e1, e2 [2]float64) {
	px := func(x, y float64) [2]float64 { return [2]float64{160 + 40*x, 130 - 40*y} }
	pts := [][2]float64{px(0, 0), px(a, 0), px(a+b, d), px(b, d)}
	var s []string
	for _, p := range pts {
		s = append(s, fmt.Sprintf("%.1f,%.1f", p[0], p[1]))
	}
	return strings.Join(s, " "), px(a, 0), px(b, d)
}

func proseExplorableBlock() Block {
	return Block{
		Slug:        "explorable",
		Title:       "Explorable explanation",
		Description: "A paragraph whose numbers you can drag, after Bret Victor's Explorable Explanations (2011). The figure and every sentence that depends on the numbers are recomputed as you drag, including the words: \"keeps its orientation\" turns into \"is mirrored\" when the determinant changes sign.",
		Tags:        []string{"reactive document", "scrub", "live figure"},
		Render: func() h.Node {
			a, b, d := 2.0, 0.5, 1.0
			poly, e1, e2 := proseShearPoints(a, b, d)
			grid := []h.Node{}
			for i := 0; i <= 8; i++ {
				x := 0 + 40*float64(i)
				grid = append(grid, h.Line(h.Attr("x1", fmt.Sprint(x)), h.Attr("y1", "10"), h.Attr("x2", fmt.Sprint(x)), h.Attr("y2", "250"), h.Class("stroke-border")))
			}
			for i := 0; i <= 6; i++ {
				y := 10 + 40*float64(i)
				grid = append(grid, h.Line(h.Attr("x1", "0"), h.Attr("y1", fmt.Sprint(y)), h.Attr("x2", "320"), h.Attr("y2", fmt.Sprint(y)), h.Class("stroke-border")))
			}
			out := func(name, v string) h.Node {
				return h.Span(h.Data("pz-out", name), h.Class("font-mono text-[14px] font-medium tabular-nums"), v)
			}
			return proseRoot("prose-explore",
				proseKind("Explorable", "drag the pink numbers"),
				h.Div(h.Class("grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]"),
					h.Div(h.Class("flex flex-col gap-3 "+proseText),
						h.P("Stretch the plane by ", proseInlineScrub("a", "Stretch along x", a, -3, 3, 0.1), " along ", mathml(mi("x")),
							" and by ", proseInlineScrub("d", "Stretch along y", d, -3, 3, 0.1), h.Span(h.Class("whitespace-nowrap"), " along ", mathml(mi("y")), ","),
							" then shear it sideways by ", proseInlineScrub("b", "Shear", b, -2, 2, 0.1), ". The matrix that does this is ",
							out("matrix", "[2 0.5; 0 1]"), "."),
						h.P("The unit square becomes a parallelogram of area ", out("area", "2.00"),
							", which is ", mathml(mo("|"), mi("a"), mi("d"), mo("|")), ". The shear slides the top edge by ", out("shift", "0.5"),
							" but leaves the area alone: ", mathml(mi("b")), " sits above the diagonal and never enters the product."),
						h.P("The determinant is ", out("det", "2.00"), ", so the picture ", h.Span(h.Data("pz-out", "verdict"), h.Class("font-medium"), "keeps its orientation"), "."),
					),
					h.Figure(h.Class("flex flex-col gap-2"),
						h.Svg(h.ViewBox("0 0 320 260"), h.Role("img"), h.Aria("label", "The unit square and its image under the matrix"), h.Class("h-auto w-full rounded-lg border bg-code"),
							h.Group(grid),
							h.Line(h.Attr("x1", "0"), h.Attr("y1", "130"), h.Attr("x2", "320"), h.Attr("y2", "130"), h.Class("stroke-muted-foreground/50")),
							h.Line(h.Attr("x1", "160"), h.Attr("y1", "10"), h.Attr("x2", "160"), h.Attr("y2", "250"), h.Class("stroke-muted-foreground/50")),
							h.Rect(h.Attr("x", "160"), h.Attr("y", "90"), h.Attr("width", "40"), h.Attr("height", "40"), h.Class("fill-none stroke-muted-foreground"), h.Attr("stroke-dasharray", "3 3")),
							h.Polygon(h.Data("pz", "shape"), h.Attr("points", poly), h.Class("fill-brand/15 stroke-brand"), h.Attr("stroke-width", "1.5")),
							h.Line(h.Data("pz", "e1"), h.Attr("x1", "160"), h.Attr("y1", "130"), h.Attr("x2", fmt.Sprintf("%.1f", e1[0])), h.Attr("y2", fmt.Sprintf("%.1f", e1[1])), h.Attr("stroke-width", "2.5"), h.Attr("stroke-linecap", "round"), h.Style("stroke:var(--vec-i)")),
							h.Line(h.Data("pz", "e2"), h.Attr("x1", "160"), h.Attr("y1", "130"), h.Attr("x2", fmt.Sprintf("%.1f", e2[0])), h.Attr("y2", fmt.Sprintf("%.1f", e2[1])), h.Attr("stroke-width", "2.5"), h.Attr("stroke-linecap", "round"), h.Style("stroke:var(--vec-j)")),
						),
						h.Figcaption(h.Class("flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--vec-i)", "M e₁"), legendSwatch("var(--vec-j)", "M e₂"), legendSwatch("var(--brand)", "image of the square")),
					),
				),
				proseHelp("Drag a pink number sideways, or focus it and use ↑ ↓ (Shift for ×10); click to type. Try a negative stretch, then a zero one."),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

// proseSeg is one piece of a code line: text, a token class, and the
// symbol of the formula it stands for (if any).
type proseSeg struct{ text, tok, sym string }

func proseCodeLine(segs ...proseSeg) h.Node {
	return h.Div(h.Class("min-h-6 whitespace-pre"),
		h.Map(segs, func(s proseSeg) h.Node {
			cls := ""
			if s.tok != "" {
				cls = "tok-" + s.tok
			}
			if s.sym == "" {
				if cls == "" {
					return h.Text(s.text)
				}
				return h.Span(h.Class(cls), s.text)
			}
			return h.Span(h.Data("pz-sym", s.sym), h.Class(cls+" rounded-sm transition-colors duration-150 data-lit:bg-brand/15 data-lit:text-brand"), s.text)
		}))
}

// proseProjection returns the projection numbers for the figure.
func proseProjection(v, u [2]float64) (scale float64, p [2]float64) {
	scale = (v[0]*u[0] + v[1]*u[1]) / (u[0]*u[0] + u[1]*u[1])
	return scale, [2]float64{scale * u[0], scale * u[1]}
}

func proseNotationBlock() Block {
	return Block{
		Slug:        "notation-links",
		Title:       "Notation linked across formula, figure and code",
		Description: "Every symbol is the same thing in three places. Point at v in the formula, the figure, the code or the key, and all four light up together, so the learner never has to guess which letter is which arrow. The key gives each symbol its definition, and screen readers hear it as the symbol's description.",
		Tags:        []string{"aria-describedby", "linked highlight", "projection"},
		Wide:        true,
		Render: func() h.Node {
			v, u := [2]float64{2, 3}, [2]float64{4, 1}
			scale, p := proseProjection(v, u)
			X := func(x float64) string { return fmt.Sprintf("%.1f", 40+40*x) }
			Y := func(y float64) string { return fmt.Sprintf("%.1f", 200-40*y) }
			sym := func(s string, node h.Node) h.Node {
				return h.El("mrow", h.Data("pz-sym", s), h.Class("rounded-sm transition-colors duration-150 data-lit:text-brand"), node)
			}
			arrow := func(name, color string, x, y float64) h.Node {
				return h.Line(h.Data("pz-sym", name), h.Data("pz", "line-"+name), h.Attr("x1", X(0)), h.Attr("y1", Y(0)), h.Attr("x2", X(x)), h.Attr("y2", Y(y)),
					h.Attr("stroke-width", "2.5"), h.Attr("stroke-linecap", "round"), h.Style("stroke:"+color),
					h.Class("transition-[stroke-width] duration-150 data-lit:stroke-[5]"))
			}
			label := func(name, color string, x, y float64) h.Node {
				return h.SvgText(h.Data("pz-sym", name), h.Data("pz", "label-"+name), h.Attr("x", X(x)), h.Attr("y", Y(y)),
					h.Class("font-mono text-[13px] font-semibold italic data-lit:underline"), h.Style("fill:"+color), name)
			}
			key := []struct{ sym, glyph, def string }{
				{"v", "v", "the vector we project"},
				{"u", "u", "the direction we project onto"},
				{"scale", "(v·u)/(u·u)", "how many copies of u: the dot products divided"},
				{"p", "p", "the projection: the shadow of v on the line of u"},
				{"r", "v − p", "what is left over, perpendicular to u"},
			}
			color := map[string]string{"v": "var(--vec-v)", "u": "var(--vec-u)", "p": "var(--brand)", "scale": "var(--vec-out)", "r": "var(--muted-foreground)"}
			return proseRoot("prose-notation",
				proseKind("Notation", "formula ↔ figure ↔ code"),
				h.Div(h.Class("grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("flex flex-col gap-4"),
						h.Div(h.Class("rounded-lg border bg-background px-4 py-5 text-lg"),
							mathBlock(sym("p", vecSym("p")), mo("="),
								sym("scale", mfrac(mrow(sym("v", vecSym("v")), mo("·"), sym("u", vecSym("u"))), mrow(sym("u", vecSym("u")), mo("·"), sym("u", vecSym("u"))))),
								sym("u", vecSym("u")))),
						h.Div(h.Class("overflow-x-auto rounded-lg border bg-code px-4 py-3 font-mono text-[13px] leading-6"),
							proseCodeLine(proseSeg{"def", "keyword", ""}, proseSeg{" ", "", ""}, proseSeg{"project", "function", ""}, proseSeg{"(", "punct", ""}, proseSeg{"v", "", "v"}, proseSeg{", ", "punct", ""}, proseSeg{"u", "", "u"}, proseSeg{"):", "punct", ""}),
							proseCodeLine(proseSeg{"    ", "", ""}, proseSeg{"scale", "", "scale"}, proseSeg{" = ", "operator", ""}, proseSeg{"dot", "function", ""}, proseSeg{"(", "punct", ""}, proseSeg{"v", "", "v"}, proseSeg{", ", "punct", ""}, proseSeg{"u", "", "u"}, proseSeg{") / ", "operator", ""}, proseSeg{"dot", "function", ""}, proseSeg{"(", "punct", ""}, proseSeg{"u", "", "u"}, proseSeg{", ", "punct", ""}, proseSeg{"u", "", "u"}, proseSeg{")", "punct", ""}),
							proseCodeLine(proseSeg{"    ", "", ""}, proseSeg{"return", "keyword", ""}, proseSeg{" ", "", ""}, proseSeg{"[scale * ui for ui in u]", "", "p"}, proseSeg{"  ", "", ""}, proseSeg{"# p", "comment", ""}),
						),
						h.Dl(h.Class("flex flex-col gap-1"),
							h.Map(key, func(k struct{ sym, glyph, def string }) h.Node {
								id := "prose-def-" + k.sym
								return h.Div(h.Class("grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3"),
									h.Dt(h.Button(h.Type("button"), h.Data("pz-sym", k.sym), h.Aria("describedby", id),
										h.Class("w-full rounded-md border px-2 py-1 text-left font-mono text-[13px] font-semibold outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-lit:border-brand data-lit:bg-brand/10"),
										h.Style("color:"+color[k.sym]), k.glyph)),
									h.Dd(h.ID(id), h.Class("text-sm text-muted-foreground"), k.def))
							})),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Svg(h.Data("pz", "fig"), h.ViewBox("0 0 320 220"), h.Role("img"), h.Aria("label", "The vectors v and u, the projection p of v onto u, and the perpendicular leftover"),
							h.Class("h-auto w-full touch-none rounded-lg border bg-code select-none"),
							h.Line(h.Attr("x1", "40"), h.Attr("y1", "200"), h.Attr("x2", "310"), h.Attr("y2", "200"), h.Class("stroke-border")),
							h.Line(h.Attr("x1", "40"), h.Attr("y1", "10"), h.Attr("x2", "40"), h.Attr("y2", "200"), h.Class("stroke-border")),
							h.Line(h.Data("pz", "uline"), h.Attr("x1", X(-u[0])), h.Attr("y1", Y(-u[1])), h.Attr("x2", X(2*u[0])), h.Attr("y2", Y(2*u[1])), h.Class("stroke-muted-foreground/30"), h.Attr("stroke-dasharray", "2 4")),
							h.Line(h.Data("pz-sym", "r"), h.Data("pz", "line-r"), h.Attr("x1", X(p[0])), h.Attr("y1", Y(p[1])), h.Attr("x2", X(v[0])), h.Attr("y2", Y(v[1])),
								h.Attr("stroke-width", "1.5"), h.Attr("stroke-dasharray", "4 3"), h.Class("stroke-muted-foreground transition-[stroke-width] duration-150 data-lit:stroke-[3.5]")),
							arrow("u", "var(--vec-u)", u[0], u[1]),
							arrow("p", "var(--brand)", p[0], p[1]),
							arrow("v", "var(--vec-v)", v[0], v[1]),
							label("u", "var(--vec-u)", u[0]+0.15, u[1]-0.3),
							label("p", "var(--brand)", p[0]-0.1, p[1]-0.4),
							label("v", "var(--vec-v)", v[0]-0.45, v[1]+0.1),
							h.Circle(h.Data("pz", "handle"), h.TabIndex(0), h.Role("slider"), h.Aria("label", "Tip of v"), h.Aria("valuetext", "v = (2, 3)"),
								h.Attr("cx", X(v[0])), h.Attr("cy", Y(v[1])), h.Attr("r", "9"),
								h.Class("cursor-grab fill-transparent stroke-transparent outline-none hover:stroke-ring focus-visible:stroke-ring"), h.Attr("stroke-width", "2")),
						),
						h.P(h.Data("pz", "readout"), h.Aria("live", "polite"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"),
							fmt.Sprintf("v = (2.0, 3.0) · u = (4.0, 1.0) · scale = %.3f · p = (%.2f, %.2f)", scale, p[0], p[1])),
					),
				),
				proseHelp("Hover any symbol, or Tab through the key. Drag the tip of v (or focus it and use the arrow keys) and the numbers in the readout follow; the leftover stays perpendicular to u."),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

func proseCellBlock() Block {
	sum := func(i string) h.Node { return munderover(mo("∑"), mrow(mi("i"), mo("="), mn("1")), mi("n")) }
	sq := mrow(msup(mrow(mo("("), msub(mi("x"), mi("i")), mo("−"), xbar(), mo(")")), mn("2")))
	type line struct {
		code string
		math h.Node
		out  string
	}
	data := []float64{3, 5, 8, 9, 10}
	n := float64(len(data))
	mean := 0.0
	for _, x := range data {
		mean += x
	}
	mean /= n
	sqs, ss := []string{}, 0.0
	for _, x := range data {
		sqs = append(sqs, fmt.Sprintf("%.1f", (x-mean)*(x-mean)))
		ss += (x - mean) * (x - mean)
	}
	variance := ss / (n - 1)
	lines := []line{
		{"xs = [3, 5, 8, 9, 10]", mathml(msub(mi("x"), mn("1")), mo(","), mo("…"), mo(","), msub(mi("x"), mi("n"))), "[3, 5, 8, 9, 10]"},
		{"n = len(xs)", mathml(mi("n")), "5"},
		{"mean = sum(xs) / n", mathml(xbar(), mo("="), mfrac(mn("1"), mi("n")), sum("i"), msub(mi("x"), mi("i"))), fmt.Sprintf("%.1f", mean)},
		{"sq = [(x - mean) ** 2 for x in xs]", mathml(sq), "[" + strings.Join(sqs, ", ") + "]"},
		{"var = sum(sq) / (n - 1)", mathml(msup(mi("s"), mn("2")), mo("="), mfrac(mn("1"), mrow(mi("n"), mo("−"), mn("1"))), sum("i"), sq), fmt.Sprint(variance)},
		{"sd = var ** 0.5", mathml(mi("s"), mo("="), msqrt(msup(mi("s"), mn("2")))), fmt.Sprint(math.Sqrt(variance))},
	}
	return Block{
		Slug:        "code-math-cell",
		Title:       "Code ⇄ math cell",
		Description: "A formula and the Python that computes it, line for line, with the value each line produces. Point at a line of code and its term in the formula lights up, and the other way round. Run steps through the lines like a debugger; edit the data and every output follows.",
		Tags:        []string{"line correspondence", "Python", "sample variance"},
		Wide:        true,
		Render: func() h.Node {
			return proseRoot("prose-cell",
				proseKind("Cell", "math", "code", "output"),
				h.Div(h.Class("flex flex-wrap items-end gap-3"),
					h.Label(h.Class("flex min-w-0 flex-1 flex-col gap-1.5 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "Data"),
						h.Input(h.Type("text"), h.Data("pz", "data"), h.Value("3, 5, 8, 9, 10"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
							h.Aria("describedby", "prose-cell-data-help"),
							h.Class("h-9 w-full max-w-sm min-w-0 rounded-md border border-input bg-background px-3 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-del md:text-sm dark:bg-input/30"))),
					h.Div(h.Class("flex flex-wrap gap-2"),
						proseBtn("run", hugeicons.PlayIcon(), "Step"),
						proseBtn("reset", hugeicons.RefreshIcon(), "Show all"),
					),
				),
				h.P(h.ID("prose-cell-data-help"), h.Data("pz", "data-msg"), h.Class("-mt-3 text-xs text-muted-foreground"), "Two or more numbers, separated by commas."),
				h.Div(h.Class("overflow-hidden rounded-xl border"),
					h.Div(h.Class("hidden grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] border-b bg-muted/40 px-4 py-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase lg:grid"),
						h.Span("Math"), h.Span("Python"), h.Span("Output")),
					h.Ol(h.Class("divide-y"),
						h.MapIdx(lines, func(i int, l line) h.Node {
							return h.Li(h.Data("pz-line", fmt.Sprint(i)), h.TabIndex(0), h.Aria("label", fmt.Sprintf("Line %d: %s", i+1, l.code)),
								h.Class("grid gap-x-4 gap-y-1 px-4 py-2.5 outline-none transition-[background-color,opacity] duration-150 data-dim:opacity-35 data-lit:bg-brand/8 focus-visible:bg-brand/8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center"),
								h.Div(h.Class("min-w-0 overflow-x-auto"), l.math),
								h.Code(h.Data("pz", "code"), h.Class("min-w-0 overflow-x-auto font-mono text-[13px] whitespace-pre"),
									h.Span(h.Class("mr-3 text-[11px] text-muted-foreground/60 select-none"), fmt.Sprint(i+1)), highlightLine(l.code)),
								h.Output(h.Data("pz", "out"), h.Class("min-w-0 truncate font-mono text-[13px] text-muted-foreground tabular-nums"), l.out),
							)
						}),
					),
				),
				proseHelp("Hover a row or Tab to it to link its three parts. Step runs one line at a time and dims what has not run yet; Show all puts everything back. The outputs are printed the way Python prints them."),
			)
		},
	}
}
