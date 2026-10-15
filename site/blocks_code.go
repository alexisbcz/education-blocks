package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/collapsible"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- 05

func codeBlockBlock() Block {
	return Block{
		Slug:        "code-block",
		Title:       "Code block",
		Description: "Read-only code in Pierre's style: a file header whose path truncates from the left, a quiet gutter, highlighted lines that carry the point of the example, and a copy button.",
		Tags:        []string{"syntax", "copy", "line highlight"},
		Render:      func() h.Node { return codeBlock("lessons/03-linear-maps/apply.py", applySource, []int{9, 10}) },
	}
}

const applySource = `import numpy as np


def apply(A: np.ndarray, x: np.ndarray) -> np.ndarray:
    """Apply the linear map A to the vector x, one row at a time."""
    m, n = A.shape
    assert x.shape == (n,), "x needs one entry per column of A"
    y = np.zeros(m)
    for i in range(m):
        y[i] = sum(A[i, j] * x[j] for j in range(n))  # row i · x
    return y


A = np.array([[2, 1], [1, 3]])
print(apply(A, np.array([1.0, 0.5])))  # [2.5 2.5]`

func codeBlock(path, src string, highlighted []int) h.Node {
	lines := strings.Split(src, "\n")
	hl := map[int]bool{}
	for _, n := range highlighted {
		hl[n] = true
	}
	return h.Figure(h.Class("overflow-hidden rounded-xl border bg-code shadow-xs"),
		h.Figcaption(h.Class("flex h-10 items-center gap-2 border-b bg-code-panel px-3 text-[13px]"),
			fileIcon(),
			// Long paths are cut from the left, so the file name stays visible.
			h.Span(h.Class("min-w-0 flex-1 truncate text-muted-foreground [direction:rtl] [text-align:left]"),
				h.Bdi(dirOf(path), h.Span(h.Class("text-foreground"), baseOf(path)))),
			h.Span(h.Class("hidden font-mono text-[11px] text-muted-foreground sm:inline"), fmt.Sprintf("%d lines", len(lines))),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Python"),
			copyButton(src, ""),
		),
		h.Pre(h.Class("code scroll-thin overflow-x-auto py-2"),
			h.Code(h.Class("grid min-w-max grid-cols-[auto_1fr]"),
				h.MapIdx(lines, func(i int, l string) h.Node {
					return h.Span(h.Class("line col-span-2 grid grid-cols-subgrid pr-6"), h.If(hl[i+1], h.Data("highlighted", "")),
						h.Span(h.Class("ln"), fmt.Sprint(i+1)),
						h.Span(highlightLine(l)),
					)
				}),
			),
		),
	)
}

func dirOf(p string) string {
	if i := strings.LastIndex(p, "/"); i >= 0 {
		return p[:i+1]
	}
	return ""
}

func baseOf(p string) string { return p[strings.LastIndex(p, "/")+1:] }

// fileIcon is a small Python file glyph in the theme's function color.
func fileIcon() h.Node {
	return hugeicons.File02Icon(h.Class("size-4 shrink-0 text-[var(--tok-function)]"))
}

// ---------------------------------------------------------------- 06

func editorBlock() Block {
	return Block{
		Slug:        "editor",
		Title:       "Exercise editor",
		Description: "The exercise next to the code. Syntax highlighting as you type, Tab and Shift-Tab indent, Enter keeps the indentation, ⌘/Ctrl-Enter runs. The run here is simulated; the platform runs Python in the browser with Pyodide.",
		Tags:        []string{"textarea overlay", "kbd", "console"},
		Wide:        true,
		Render:      editor,
	}
}

const matvecStarter = `import numpy as np


def matvec(A, x):
    """Return A @ x without using @ or np.dot."""
    m, n = A.shape
    y = np.zeros(m)
    # Each entry of y is a row of A dotted with x.
    pass
    return y`

const matvecSolution = `import numpy as np


def matvec(A, x):
    """Return A @ x without using @ or np.dot."""
    m, n = A.shape
    y = np.zeros(m)
    # Each entry of y is a row of A dotted with x.
    for i in range(m):
        y[i] = sum(A[i, j] * x[j] for j in range(n))
    return y`

func editor() h.Node {
	lines := strings.Split(matvecStarter, "\n")
	return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]"), h.Data("editor", ""),
		// The exercise.
		h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
			h.Div(h.Class("flex items-center gap-2"),
				badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Exercise 3.2.1"),
				h.Span(h.Class("text-xs text-muted-foreground"), "+40 XP"),
			),
			h.H3(h.Class("text-lg font-semibold tracking-tight"), "Multiply a matrix by a vector"),
			h.Div(h.Class("flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground"),
				h.P("Write ", inlineCode("matvec(A, x)"), ". Entry ", mathml(mi("i")), " of the result is row ", mathml(mi("i")), " of A dotted with x:"),
				h.Div(h.Class("text-foreground"), mathBlock(msub(mi("y"), mi("i")), mo("="), h.El("munderover", mo("∑"), mrow(mi("j"), mo("="), mn("1")), mi("n")), msub(mi("a"), mrow(mi("i"), mi("j"))), msub(mi("x"), mi("j")))),
				h.P("Don't use ", inlineCode("@"), " or ", inlineCode("np.dot"), ": the point is to see the loop."),
			),
			h.Ul(h.Class("mt-auto flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground"),
				h.Li(h.Class("flex items-center gap-2"), kbd.Group(kbd.Kbd("⌘"), kbd.Kbd("⏎")), "Run the tests"),
				h.Li(h.Class("flex items-center gap-2"), kbd.Group(kbd.Kbd("Tab")), "Indent · ", kbd.Group(kbd.Kbd("⇧"), kbd.Kbd("Tab")), "Dedent"),
			),
		),
		// The editor window.
		h.Div(h.Class("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-code shadow-xs"),
			h.Div(h.Class("flex h-10 items-center border-b bg-code-panel pr-2"), h.Role("tablist"), h.Aria("label", "Files"),
				h.Button(h.Type("button"), h.Role("tab"), h.Aria("selected", "true"),
					h.Class("relative flex h-full items-center gap-2 border-r bg-code px-3 text-[13px] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-code"),
					fileIcon(), "matvec.py",
					h.Span(h.Data("dirty", ""), h.Hidden(), h.Class("size-1.5 rounded-full bg-foreground/60"), h.Aria("label", "modified")),
				),
				h.Span(h.Class("flex h-full items-center gap-2 px-3 text-[13px] text-muted-foreground"), hugeicons.SquareLock02Icon(h.Class("size-3.5")), "tests.py"),
				h.Div(h.Class("flex-1")),
				button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("action", "reset"), hugeicons.ArrowTurnBackwardIcon(), "Reset"),
			),
			h.Div(h.Class("code scroll-thin relative grid max-h-[340px] grid-cols-[auto_1fr] overflow-auto py-2"), h.Data("scroller", ""),
				h.Div(h.Class("ln sticky left-0 z-10 bg-code"), h.Data("gutter", ""), h.Aria("hidden", "true"),
					h.MapIdx(lines, func(i int, _ string) h.Node { return h.Div(fmt.Sprint(i + 1)) }),
				),
				h.Div(h.Class("relative min-w-0"),
					h.Div(h.Class("pointer-events-none absolute inset-x-0 h-5 bg-[var(--code-line-hl)] transition-transform duration-75"), h.Data("active-line", ""), h.Aria("hidden", "true")),
					h.Pre(h.Class("relative pr-6 whitespace-pre"), h.Data("highlight", ""), h.Aria("hidden", "true"),
						h.Map(lines, func(l string) h.Node { return h.Div(h.Class("min-h-5"), highlightLine(l)) }),
					),
					h.Textarea(h.Data("input", ""), h.Aria("label", "Python code"), h.Attr("spellcheck", "false"),
						h.Attr("autocapitalize", "off"), h.Attr("autocomplete", "off"), h.Attr("autocorrect", "off"), h.Attr("wrap", "off"),
						h.Class("absolute inset-0 resize-none overflow-hidden bg-transparent pr-6 whitespace-pre text-transparent caret-[var(--code-fg)] outline-none selection:bg-[var(--code-selection)] selection:text-transparent"),
						matvecStarter),
				),
			),
			h.Template(h.Data("starter", ""), matvecStarter),
			h.Template(h.Data("solution", ""), matvecSolution),
			// Toolbar.
			h.Div(h.Class("flex items-center gap-2 border-t bg-code-panel px-3 py-2"),
				h.Span(h.Class("flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"),
					h.Span(h.Class("size-1.5 rounded-full bg-add")), "Python 3.12"),
				h.Span(h.Data("cursor", ""), h.Class("hidden font-mono text-[11px] text-muted-foreground tabular-nums sm:inline"), "Ln 9, Col 5"),
				h.Div(h.Class("flex-1")),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "solution"), h.Class("text-muted-foreground"), "Show solution"),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "run"),
					hugeicons.PlayIcon(h.Data("icon", "idle")),
					h.Span(h.Data("icon", "busy"), h.Hidden(), h.Class("size-4 animate-spin rounded-full border-2 border-current border-r-transparent")),
					"Run", kbd.Kbd(h.Class("ml-0.5 hidden sm:inline-flex"), "⌘⏎")),
			),
			// Console.
			h.Div(h.Class("border-t bg-code"),
				h.Div(h.Class("flex items-center gap-2 px-3 pt-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Console",
					h.Span(h.Data("summary", ""), h.Class("ml-auto normal-case tracking-normal"))),
				h.Div(h.Data("console", ""), h.Aria("live", "polite"), h.Class("code scroll-thin max-h-48 min-h-20 overflow-auto px-3 pt-1 pb-3 whitespace-pre-wrap"),
					h.Span(h.Class("text-muted-foreground"), "Press Run to test matvec."),
				),
			),
		),
	)
}

func inlineCode(s string) h.Node {
	return h.Code(h.Class("rounded-[4px] border bg-muted/60 px-1 py-px font-mono text-[0.9em] text-foreground"), s)
}

// ---------------------------------------------------------------- 07

func testResultsBlock() Block {
	return Block{
		Slug:        "tests",
		Title:       "Test results",
		Description: "What the learner sees after a run. Passing tests stay quiet; a failure opens by itself and shows expected against actual, down to the entry that differs.",
		Tags:        []string{"collapsible", "status"},
		Render:      testResults,
	}
}

type testCase struct {
	name, detail string
	ms           int
	ok           bool
}

func testResults() h.Node {
	tests := []testCase{
		{"test_identity_leaves_x_alone", "", 3, true},
		{"test_shape_2x3_times_3", "", 2, true},
		{"test_matches_numpy_on_random_matrices", "", 31, true},
		{"test_rotation_by_90_degrees", "", 4, false},
	}
	passed := 3
	return h.Div(h.Class("overflow-hidden rounded-xl border bg-background shadow-xs"),
		h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3"),
			h.Div(h.Class("flex items-center gap-2 text-sm font-medium"),
				h.Span(h.Class("flex size-5 items-center justify-center rounded-full bg-del/12 text-del"), hugeicons.Cancel01Icon(h.Class("size-3"), h.StrokeWidth("3"))),
				"1 test failed",
			),
			h.Div(h.Class("flex items-center gap-3 font-mono text-xs text-muted-foreground tabular-nums"),
				h.Span(h.Class("text-add"), fmt.Sprintf("%d passed", passed)),
				h.Span(h.Class("text-del"), "1 failed"),
				h.Span("40 ms"),
			),
			h.Div(h.Class("flex-1")),
			button.Button(button.VariantOutline, button.SizeSm, hugeicons.RefreshIcon(), "Run again"),
		),
		// One segment per test: the run at a glance.
		h.Div(h.Class("flex gap-0.5 px-4 pt-3"), h.Aria("hidden", "true"),
			h.Map(tests, func(t testCase) h.Node {
				return h.Span(h.Class("h-1 flex-1 rounded-full " + h.Ternary(t.ok, "bg-add", "bg-del")))
			}),
		),
		h.Ul(h.Class("flex flex-col p-2"),
			h.Map(tests, func(t testCase) h.Node {
				row := func(extra ...any) *h.Element {
					return h.Div(h.Class("flex items-center gap-3 rounded-md px-2 py-2 text-sm"), h.Group(extra...),
						h.Span(h.Class(h.Ternary(t.ok, "text-add", "text-del")),
							h.IfElse(t.ok, hugeicons.Tick02Icon(h.Class("size-4")), hugeicons.Cancel01Icon(h.Class("size-4")))),
						h.Span(h.Class(h.Ternary(t.ok, "flex-1 truncate font-mono text-[13px] text-muted-foreground", "flex-1 truncate font-mono text-[13px]")), t.name),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground tabular-nums"), fmt.Sprintf("%d ms", t.ms)),
					)
				}
				if t.ok {
					return h.Li(row())
				}
				return h.Li(collapsible.Collapsible(collapsible.Open(true),
					collapsible.Trigger(h.Class("group w-full text-left outline-none [&>div]:transition-colors [&>div]:duration-150 hover:[&>div]:bg-accent/50 focus-visible:[&>div]:bg-accent/60"),
						row(),
					),
					collapsible.Content(h.Class("overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"),
						h.Div(h.Class("mx-2 mb-2 ml-9 flex flex-col gap-3 rounded-lg border bg-code p-3"),
							h.P(h.Class("text-sm"), "A 90° rotation should send ", mathml(hat("i")), " to ", mathml(hat("j")), ". Check the sign of each entry."),
							h.Div(h.Class("code grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5"),
								h.Span(h.Class("text-muted-foreground"), "input"), h.Span("R = [[0, -1], [1, 0]], x = [1, 0]"),
								h.Span(h.Class("text-muted-foreground"), "expected"), h.Span("[", h.Span(h.Class("word-add px-0.5"), "0."), ", 1.]"),
								h.Span(h.Class("text-muted-foreground"), "actual"), h.Span("[", h.Span(h.Class("word-del px-0.5"), "-0."), ", 1.]  ", h.Span(h.Class("text-muted-foreground"), "# close, but check row 1")),
							),
							h.Div(h.Class("code text-[12px] text-muted-foreground"),
								h.Div("tests.py:31 in test_rotation_by_90_degrees"),
								h.Div(h.Class("text-del"), "AssertionError: arrays are not equal (atol=0)"),
							),
						),
					),
				))
			}),
		),
	)
}

// ---------------------------------------------------------------- 08

func diffBlock() Block {
	return Block{
		Slug:        "diff",
		Title:       "Solution diff",
		Description: "The learner's attempt against the reference, diffed in Go. Changed words are marked inside changed lines; unified or split, like diffs.com.",
		Tags:        []string{"diff", "word diff", "split view"},
		Wide:        true,
		Render:      diffView,
	}
}

const attemptSource = `def det2(A):
    """Determinant of a 2x2 matrix."""
    a, b = A[0]
    c, d = A[1]
    return a * c - b * d


def is_invertible(A):
    return det2(A) > 0`

const referenceSource = `def det2(A):
    """Determinant of a 2x2 matrix."""
    a, b = A[0]
    c, d = A[1]
    return a * d - b * c


def is_invertible(A, tol=1e-12):
    return abs(det2(A)) > tol`

func diffView() h.Node {
	ops := diffLines(strings.Split(attemptSource, "\n"), strings.Split(referenceSource, "\n"))
	adds, dels := 0, 0
	for _, o := range ops {
		switch o.kind {
		case '+':
			adds++
		case '-':
			dels++
		}
	}
	return h.Div(h.Class("overflow-hidden rounded-xl border bg-code shadow-xs"), h.Data("diff", ""),
		h.Div(h.Class("flex h-11 items-center gap-3 border-b bg-code-panel px-3 text-[13px]"),
			fileIcon(),
			h.Span(h.Class("min-w-0 truncate"), "determinant.py"),
			h.Span(h.Class("font-mono text-xs tabular-nums"),
				h.Span(h.Class("text-diff-add"), fmt.Sprintf("+%d", adds)), " ",
				h.Span(h.Class("text-del"), fmt.Sprintf("−%d", dels))),
			h.Div(h.Class("flex-1")),
			h.Div(h.Class("flex items-center gap-1 rounded-lg border bg-background p-0.5"), h.Role("tablist"), h.Aria("label", "Layout"),
				segButton("unified", "Unified", true),
				segButton("split", "Split", false),
			),
		),
		h.Div(h.Class("grid grid-cols-2 border-b text-[11px] text-muted-foreground"), h.Data("view", "split"), h.Hidden(),
			h.Div(h.Class("border-r px-3 py-1.5"), "Your attempt"),
			h.Div(h.Class("px-3 py-1.5"), "Reference"),
		),
		h.Div(h.Data("view", "unified"), h.Class("code scroll-thin overflow-x-auto py-2 whitespace-pre"),
			h.Div(h.Class("grid min-w-max grid-cols-[auto_auto_1ch_1fr]"),
				h.Map(ops, func(o diffOp) h.Node { return unifiedRow(o) }),
			),
		),
		h.Div(h.Data("view", "split"), h.Hidden(), h.Class("code scroll-thin grid grid-cols-2 overflow-x-auto py-2 whitespace-pre"),
			h.Div(h.Class("grid min-w-0 auto-rows-[20px] grid-cols-[auto_1fr] border-r"), h.Map(splitSide(ops, false), splitRow)),
			h.Div(h.Class("grid min-w-0 auto-rows-[20px] grid-cols-[auto_1fr]"), h.Map(splitSide(ops, true), splitRow)),
		),
	)
}

type diffOp struct {
	kind       byte // ' ', '-', '+'
	text       string
	oldN, newN int
	pair       string // the line it replaces or is replaced by, for word diffs
	paired     bool
}

// diffLines is a longest-common-subsequence line diff, then pairs each run
// of deletions with the additions that follow, for word-level marks.
func diffLines(a, b []string) []diffOp {
	n, m := len(a), len(b)
	lcs := make([][]int, n+1)
	for i := range lcs {
		lcs[i] = make([]int, m+1)
	}
	for i := n - 1; i >= 0; i-- {
		for j := m - 1; j >= 0; j-- {
			if a[i] == b[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else {
				lcs[i][j] = max(lcs[i+1][j], lcs[i][j+1])
			}
		}
	}
	var ops []diffOp
	i, j := 0, 0
	for i < n || j < m {
		switch {
		case i < n && j < m && a[i] == b[j]:
			ops = append(ops, diffOp{kind: ' ', text: a[i], oldN: i + 1, newN: j + 1})
			i, j = i+1, j+1
		case i < n && (j == m || lcs[i+1][j] >= lcs[i][j+1]):
			ops = append(ops, diffOp{kind: '-', text: a[i], oldN: i + 1})
			i++
		default:
			ops = append(ops, diffOp{kind: '+', text: b[j], newN: j + 1})
			j++
		}
	}
	// Pair deletions with the additions right after them.
	for k := 0; k < len(ops); {
		if ops[k].kind != '-' {
			k++
			continue
		}
		d := k
		for d < len(ops) && ops[d].kind == '-' {
			d++
		}
		a := d
		for a < len(ops) && ops[a].kind == '+' {
			a++
		}
		for p := 0; p < d-k && p < a-d; p++ {
			ops[k+p].pair, ops[k+p].paired = ops[d+p].text, true
			ops[d+p].pair, ops[d+p].paired = ops[k+p].text, true
		}
		k = a
	}
	return ops
}

// wordDiff renders line with the words that are not in other marked.
func wordDiff(line, other string, class string) h.Node {
	split := func(s string) []string {
		var out []string
		cur := ""
		for _, r := range s {
			if strings.ContainsRune(" ()[],:*-+=<>", r) {
				if cur != "" {
					out = append(out, cur)
				}
				out = append(out, string(r))
				cur = ""
				continue
			}
			cur += string(r)
		}
		if cur != "" {
			out = append(out, cur)
		}
		return out
	}
	x, y := split(line), split(other)
	lcs := make([][]int, len(x)+1)
	for i := range lcs {
		lcs[i] = make([]int, len(y)+1)
	}
	for i := len(x) - 1; i >= 0; i-- {
		for j := len(y) - 1; j >= 0; j-- {
			if x[i] == y[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else {
				lcs[i][j] = max(lcs[i+1][j], lcs[i][j+1])
			}
		}
	}
	var nodes []h.Node
	i, j := 0, 0
	for i < len(x) {
		if j < len(y) && x[i] == y[j] {
			nodes = append(nodes, highlightLine(x[i]))
			i, j = i+1, j+1
		} else if j < len(y) && lcs[i][j+1] >= lcs[i+1][j] {
			j++
		} else {
			nodes = append(nodes, h.Span(h.Class(class), highlightLine(x[i])))
			i++
		}
	}
	return h.Group(nodes)
}

func diffBody(o diffOp) h.Node {
	switch {
	case o.kind == '+' && o.paired:
		return wordDiff(o.text, o.pair, "word-add")
	case o.kind == '-' && o.paired:
		return wordDiff(o.text, o.pair, "word-del")
	default:
		return highlightLine(o.text)
	}
}

func lineClass(kind byte) string {
	switch kind {
	case '+':
		return "diff-add"
	case '-':
		return "diff-del"
	}
	return ""
}

func num(n int) string {
	if n == 0 {
		return ""
	}
	return fmt.Sprint(n)
}

func unifiedRow(o diffOp) h.Node {
	return h.Div(h.Class("col-span-4 grid grid-cols-subgrid pr-6 "+lineClass(o.kind)),
		h.Span(h.Class("ln !pr-0"), num(o.oldN)),
		h.Span(h.Class("ln"), num(o.newN)),
		h.Span(h.Class("select-none text-muted-foreground/70"), h.If(o.kind != ' ', string(o.kind))),
		h.Span(h.Class("pl-1"), diffBody(o)),
	)
}

type splitLine struct {
	op    diffOp
	n     int
	blank bool
}

// splitSide lays out one side of the split view, with blank rows where the
// other side has lines this one lacks, so the two columns stay aligned.
func splitSide(ops []diffOp, newSide bool) []splitLine {
	var out []splitLine
	for k := 0; k < len(ops); {
		if ops[k].kind == ' ' {
			n := ops[k].oldN
			if newSide {
				n = ops[k].newN
			}
			out = append(out, splitLine{op: ops[k], n: n})
			k++
			continue
		}
		var dels, adds []diffOp
		for k < len(ops) && ops[k].kind == '-' {
			dels = append(dels, ops[k])
			k++
		}
		for k < len(ops) && ops[k].kind == '+' {
			adds = append(adds, ops[k])
			k++
		}
		mine := dels
		if newSide {
			mine = adds
		}
		for r := 0; r < max(len(dels), len(adds)); r++ {
			if r < len(mine) {
				n := mine[r].oldN
				if newSide {
					n = mine[r].newN
				}
				out = append(out, splitLine{op: mine[r], n: n})
			} else {
				out = append(out, splitLine{blank: true})
			}
		}
	}
	return out
}

func splitRow(l splitLine) h.Node {
	if l.blank {
		return h.Div(h.Class("col-span-2 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--foreground)_5%,transparent)_6px_7px)]"))
	}
	return h.Div(h.Class("col-span-2 grid grid-cols-subgrid pr-4 "+lineClass(l.op.kind)),
		h.Span(h.Class("ln"), num(l.n)),
		h.Span(h.Class("overflow-hidden text-ellipsis whitespace-pre"), diffBody(l.op)),
	)
}
