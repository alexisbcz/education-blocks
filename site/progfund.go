package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ProgfundBlocks lists the first-programming-course gallery in display
// order. Every block runs real Python, a teaching subset interpreted by
// static/js/progfund-py.js (tokenizer, parser and a tree-walking
// evaluator written as generators, so a program can be stopped between
// any two steps). static/js/progfund-viz.js draws the editor, the frames
// and the heap; progfund.js and progfund-labs.js wire the blocks.
func ProgfundBlocks() []Block {
	return []Block{
		pfNamesBlock(),
		pfTraceTableBlock(),
		pfStackBlock(),
		pfSlicesBlock(),
		pfNumbersBlock(),
		pfDebugBlock(),
		pfTestsBlock(),
		pfFormulaBlock(),
		pfDictBlock(),
		pfCompBlock(),
	}
}

// ---------------------------------------------------------------- parts

// pfEditor is a code window: a transparent textarea over highlighted
// lines (as in the Linear Algebra exercise editor), a gutter, and a bar
// that marks the line about to run. ro drops the textarea; bp makes the
// gutter toggle breakpoints.
func pfEditor(file, src string, ro, bp bool, right ...any) h.Node {
	lines := strings.Split(src, "\n")
	return h.Div(h.Data("ed", ""), h.If(ro, h.Data("ed-ro", "")), h.If(bp, h.Data("ed-bp", "")),
		h.Class("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-code shadow-xs"),
		h.Div(h.Class("flex h-10 shrink-0 items-center gap-2 border-b bg-code-panel pr-2 pl-3 text-[13px]"),
			fileIcon(),
			h.Span(h.Data("ed-file", ""), h.Class("truncate"), file),
			h.Span(h.Data("ed-dirty", ""), h.Hidden(), h.Class("size-1.5 shrink-0 rounded-full bg-foreground/60"), h.Aria("label", "modified")),
			h.If(ro, h.Span(h.Class("flex items-center gap-1 font-mono text-[11px] text-muted-foreground"), hugeicons.SquareLock02Icon(h.Class("size-3")), "read-only")),
			h.Div(h.Class("flex-1")),
			h.Span(append([]any{h.Class("flex shrink-0 items-center gap-1.5")}, right...)...),
		),
		h.Div(h.Data("ed-scroll", ""), h.Class("code scroll-thin relative grid max-h-[360px] grid-cols-[auto_1fr] overflow-auto py-2"),
			h.Div(h.Data("ed-gutter", ""), h.Aria("hidden", "true"),
				h.Class("ln sticky left-0 z-10 bg-code"+map[bool]string{true: " cursor-pointer", false: ""}[bp]),
				h.MapIdx(lines, func(i int, _ string) h.Node { return h.Div(h.Class("relative"), fmt.Sprint(i+1)) }),
			),
			h.Div(h.Class("relative min-w-0"),
				h.Div(h.Data("ed-err", ""), h.Hidden(), h.Aria("hidden", "true"),
					h.Class("pointer-events-none absolute inset-x-0 top-0 h-5 border-l-2 border-del bg-del/10")),
				h.Div(h.Data("ed-cur", ""), h.Hidden(), h.Aria("hidden", "true"),
					h.Class("pointer-events-none absolute inset-x-0 top-0 h-5 border-l-2 border-brand bg-brand/10 transition-transform duration-150 ease-out motion-reduce:transition-none")),
				h.Pre(h.Data("ed-hl", ""), h.If(!ro, h.Aria("hidden", "true")), h.Class("relative pr-6 whitespace-pre"),
					h.Map(lines, func(l string) h.Node { return h.Div(h.Class("min-h-5"), highlightLine(l)) }),
				),
				h.Iff(!ro, func() h.Node {
					return h.Textarea(h.Data("ed-input", ""), h.Aria("label", "Python code, "+file), h.Attr("spellcheck", "false"),
						h.Attr("autocapitalize", "off"), h.Attr("autocomplete", "off"), h.Attr("autocorrect", "off"), h.Attr("wrap", "off"),
						h.Class("absolute inset-0 resize-none overflow-hidden bg-transparent pr-6 whitespace-pre text-transparent caret-[var(--code-fg)] outline-none selection:bg-[var(--code-selection)] selection:text-transparent"),
						src)
				}),
			),
		),
		h.Template(h.Data("ed-src", ""), src),
	)
}

// pfStepper is First / Back / Next / Last, a step slider and the line
// that says what the next step does.
func pfStepper() h.Node {
	btn := func(act, label string, icon h.Node, text string) h.Node {
		if text == "" {
			return button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("st", act), h.Aria("label", label), icon)
		}
		return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("st", act), h.Aria("label", label), icon, text)
	}
	return h.Div(h.Class("flex flex-col gap-2"),
		h.Div(h.Class("flex flex-wrap items-center gap-1.5"),
			btn("first", "First step", hugeicons.ArrowLeftDoubleIcon(), ""),
			btn("back", "Previous step", hugeicons.ArrowLeft01Icon(), "Back"),
			btn("next", "Next step", hugeicons.ArrowRight01Icon(), "Next"),
			btn("last", "Last step", hugeicons.ArrowRightDoubleIcon(), ""),
			h.Span(h.Data("st-label", ""), h.Class("ml-auto font-mono text-[11px] text-muted-foreground tabular-nums"), "Step 0 of 0"),
		),
		h.Input(h.Type("range"), h.Data("st-range", ""), h.Min("0"), h.Max("0"), h.Value("0"), h.Aria("label", "Step"),
			h.Class("h-4 w-full cursor-pointer accent-[var(--brand)]")),
		h.P(h.Data("st-msg", ""), h.Aria("live", "polite"),
			h.Class("min-h-10 text-xs leading-relaxed text-muted-foreground data-[bad]:text-del")),
	)
}

func pfKeys(extra ...any) h.Node {
	return h.P(append([]any{h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
		"Outside the editor,", kbd.Group(kbd.Kbd("←"), kbd.Kbd("→")), "step"}, extra...)...)
}

// pfConsole is where print() writes; errors appear in red.
func pfConsole(label string) h.Node {
	return h.Div(h.Class("flex min-w-0 flex-col gap-1.5"),
		panelLabel(label),
		h.Pre(h.Data("console", ""), h.Aria("live", "polite"),
			h.Class("code scroll-thin max-h-40 min-h-12 overflow-auto rounded-lg border bg-code px-3 py-2 whitespace-pre-wrap"),
			h.Span(h.Class("text-muted-foreground"), "Nothing printed yet.")),
	)
}

// pfMemory is the Python Tutor picture: frames on the left (names), the
// objects on the right, and an arrow for every reference.
func pfMemory() h.Node {
	return h.Div(h.Data("mem", ""), h.Class("relative grid min-w-0 gap-x-10 gap-y-5 sm:grid-cols-[minmax(150px,auto)_minmax(0,1fr)]"),
		h.Div(h.Class("flex min-w-0 flex-col gap-2"), panelLabel("Frames"),
			h.Div(h.Data("mem-frames", ""), h.Class("flex flex-col gap-2"))),
		h.Div(h.Class("flex min-w-0 flex-col gap-2"), panelLabel("Objects"),
			h.Div(h.Data("mem-objects", ""), h.Class("flex flex-col items-start gap-3"))),
		h.Svg(h.Data("mem-arrows", ""), h.Aria("hidden", "true"), h.Class("pointer-events-none absolute top-0 left-0 overflow-visible")),
	)
}

// pfPrograms embeds preset programs (and their notes) as templates the
// module reads by key.
func pfPrograms(progs ...[3]string) h.Node {
	return h.Group(h.Map(progs, func(p [3]string) h.Node {
		return h.Group(
			h.Template(h.Data("prog", p[0]), p[1]),
			h.Template(h.Data("note", p[0]), p[2]),
		)
	}))
}

func pfBox(attr string, children ...any) h.Node {
	return h.Div(append([]any{h.Data(attr, ""), h.Class("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.TabIndex(-1)}, children...)...)
}

func pfNote() h.Node {
	return h.P(h.Data("note-out", ""), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground"))
}

// ---------------------------------------------------------------- 1

const pfAliasSrc = `a = [1, 2, 3]
b = a
a.append(4)
print(b)
print(a is b)`

func pfNamesBlock() Block {
	return Block{
		Slug:        "names-and-objects",
		Title:       "Names point at objects",
		Description: "A variable is a name with an arrow to an object, not a box with a value inside. Step through each program and watch the arrows: two names can share one list, a call passes arrows, and [[0] * 3] * 3 builds one row three times.",
		Tags:        []string{"aliasing", "mutability", "Python Tutor"},
		Wide:        true,
		Render: func() h.Node {
			return pfBox("pf-names",
				h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
					segs("Program",
						[2]string{"alias", "Two names, one list"},
						[2]string{"ints", "Numbers rebind"},
						[2]string{"call", "Calls pass arrows"},
						[2]string{"copies", "Shallow and deep copies"},
						[2]string{"grid", "The grid trap"}),
					pfNote(),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b p-4 lg:border-r lg:border-b-0"),
						pfEditor("names.py", pfAliasSrc, false, false,
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("act", "reset"), hugeicons.ArrowTurnBackwardIcon(), "Reset")),
						pfStepper(),
						pfConsole("Output"),
						pfKeys(" · edit the code and the trace follows"),
					),
					h.Div(h.Class("min-w-0 p-5"), pfMemory()),
				),
				pfPrograms(
					[3]string{"alias", pfAliasSrc, "b = a copies the arrow, not the list: there is one list with two names. Changing it through a shows through b, and a is b is True."},
					[3]string{"ints", "x = 5\ny = x\nx = x + 1\nprint(x, y)", "Numbers can't be changed in place, so they are drawn inside the frame. x = x + 1 makes a new number and moves x to it; y still holds 5."},
					[3]string{"call", "def add_item(items, x):\n    items.append(x)\n    x = 0\n\nshopping = [\"eggs\"]\nn = 5\nadd_item(shopping, \"milk\")\nprint(shopping, n)", "A call gives the function arrows to the same objects. Appending changes the caller's list; assigning to the parameter x only moves the local name."},
					[3]string{"copies", "import copy\na = [[1, 2], [3, 4]]\nb = a[:]\nc = copy.deepcopy(a)\na[0].append(99)\nprint(b)\nprint(c)", "a[:] makes a new outer list whose items still point at the same inner lists (a shallow copy). copy.deepcopy copies all the way down, so c doesn't see the 99."},
					[3]string{"grid", "row = [0] * 3\ngrid = [row] * 3\ngrid[0][0] = 1\nprint(grid)\n\ngood = [[0] * 3 for _ in range(3)]\ngood[0][0] = 1\nprint(good)", "[row] * 3 repeats the arrow, not the row: the grid is one row seen three times. A comprehension builds a new row on each pass."},
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func pfTraceTableBlock() Block {
	return Block{
		Slug:        "trace-table",
		Title:       "Predict the trace table",
		Description: "Before running a loop, write down what the variables will be each time Python checks the loop's condition. Fill the cells, check them, then reveal the real trace row by row. Predicting first is how tracing becomes a habit.",
		Tags:        []string{"predict then run", "loops", "trace table"},
		Wide:        true,
		Render: func() h.Node {
			return pfBox("pf-trace",
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center"),
					segs("Loop",
						[2]string{"odds", "Sum of odd numbers"},
						[2]string{"digits", "Digits of a number"},
						[2]string{"collatz", "Collatz steps"}),
					h.Label(h.Class("flex items-center gap-2 text-sm sm:ml-auto"),
						h.Span(h.Class("text-muted-foreground"), "Start with n ="),
						h.Input(h.Type("text"), h.Attr("inputmode", "numeric"), h.Data("start", ""), h.Value("7"), h.Aria("label", "Starting value of n"),
							h.Attr("autocomplete", "off"),
							h.Class("h-8 w-20 rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del")),
					),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-4 lg:border-r lg:border-b-0"),
						pfEditor("loop.py", "", true, false),
						pfNote(),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 p-4"),
						h.Div(h.Class("scroll-thin max-h-[420px] overflow-auto rounded-lg border"),
							h.Table(h.Data("table", ""), h.Class("w-full border-collapse font-mono text-sm tabular-nums"))),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "check"), hugeicons.CheckmarkCircle02Icon(), "Check"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "row"), hugeicons.ArrowDown01Icon(), "Reveal a row"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "all"), "Reveal all"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "clear"), hugeicons.RefreshIcon(), "Clear"),
							h.Span(h.Data("score", ""), h.Aria("live", "polite"), h.Class("ml-auto font-mono text-xs text-muted-foreground tabular-nums")),
						),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"One row each time the loop line runs, including the last check that ends the loop. Write values the way Python prints them: ",
							inlineCode("3"), ", ", inlineCode("3.0"), ", ", inlineCode("'a'"), ". A dash means the name doesn't exist yet."),
					),
				),
				pfPrograms(
					[3]string{"odds", "n = 7\ntotal = 0\ni = 1\nwhile i <= n:\n    total = total + i\n    i = i + 2\nprint(total)", "i,total|4|1|15|The sum of the first k odd numbers is k², so the total is always a square."},
					[3]string{"digits", "n = 4096\ndigits = 0\ns = 0\nwhile n > 0:\n    s = s + n % 10\n    n = n // 10\n    digits = digits + 1\nprint(digits, s)", "n,s,digits|4|1|99999|n % 10 is the last digit and n // 10 drops it, so each pass moves one digit from n into s."},
					[3]string{"collatz", "n = 6\nsteps = 0\nwhile n != 1:\n    if n % 2 == 0:\n        n = n // 2\n    else:\n        n = 3 * n + 1\n    steps = steps + 1\nprint(steps)", "n,steps|3|2|40|Halve even numbers, triple odd ones and add one. Nobody has proved this loop ends for every start, but it has for every number tried."},
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func pfStackBlock() Block {
	return Block{
		Slug:        "call-stack",
		Title:       "The call stack and recursion",
		Description: "Each call gets its own frame with its own n, stacked on top of the caller's. Step through a recursive function: frames pile up until the base case, then each one returns its value to the frame below. The chart shows the depth of the stack at every step.",
		Tags:        []string{"recursion", "frames", "base case"},
		Wide:        true,
		Render: func() h.Node {
			return pfBox("pf-stack",
				h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
					segs("Function",
						[2]string{"fact", "Factorial"},
						[2]string{"fib", "Fibonacci"},
						[2]string{"total", "Sum of a list"},
						[2]string{"nobase", "No base case"}),
					pfNote(),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b p-4 lg:border-r lg:border-b-0"),
						pfEditor("recursion.py", "", false, false,
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("act", "reset"), hugeicons.ArrowTurnBackwardIcon(), "Reset")),
						pfStepper(),
						pfConsole("Output"),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-5 p-5"),
						h.Div(h.Class("flex flex-col gap-2"),
							panelLabel("Stack depth at each step"),
							h.Svg(h.Data("depth", ""), h.Class("block h-28 w-full cursor-pointer touch-none rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Stack depth over the steps of the program; click to jump to a step")),
							readouts([2]string{"calls so far", "calls"}, [2]string{"depth now", "depth"}, [2]string{"deepest", "max"}),
						),
						pfMemory(),
					),
				),
				pfPrograms(
					[3]string{"fact", "def fact(n):\n    if n == 0:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(4))", "fact(4) can't finish until fact(3) does, and so on down to fact(0), the base case. Then the multiplications happen on the way back up: 1, 1, 2, 6, 24."},
					[3]string{"fib", "def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(4))", "Each call makes two more, so the same values are computed again and again: fib(2) runs twice for fib(4), and the number of calls grows like the Fibonacci numbers themselves."},
					[3]string{"total", "def total(xs):\n    if not xs:\n        return 0\n    return xs[0] + total(xs[1:])\n\nprint(total([3, 1, 4, 1]))", "Each call peels off the first item and asks a smaller list for the rest. xs[1:] is a new, shorter list each time; the empty list is the base case."},
					[3]string{"nobase", "def countdown(n):\n    print(n)\n    countdown(n - 1)\n\ncountdown(3)", "Without a base case nothing stops the calls. Python gives up with a RecursionError (its default limit is 1000 frames; this tracer stops at 25 to keep the picture readable). Add if n == 0: return."},
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func pfSlicesBlock() Block {
	return Block{
		Slug:        "ranges-and-slices",
		Title:       "Ranges and slices on a ruler",
		Description: "Most off-by-one errors come from forgetting that stop is never included. Set start, stop and step and see which positions are taken, in order, with negative indices counted from the end. Every result comes from the interpreter, not from a separate rule.",
		Tags:        []string{"off by one", "slicing", "range()"},
		Wide:        true,
		Render: func() h.Node {
			in := func(key, label, value string) h.Node {
				return h.Label(h.Class("flex flex-col gap-1"),
					h.Span(h.Class("text-xs text-muted-foreground"), label),
					h.Input(h.Type("text"), h.Data("in", key), h.Value(value), h.Aria("label", label), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
						h.Placeholder("blank"),
						h.Class("h-9 w-20 rounded-md border border-input bg-background px-2 text-center font-mono text-base tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del sm:text-sm")),
				)
			}
			return pfBox("pf-slices",
				h.Div(h.Class("flex flex-col gap-4 border-b p-4"),
					h.Div(h.Class("flex flex-wrap items-end gap-3"),
						segs("Mode", [2]string{"slice", "Slice s[start:stop:step]"}, [2]string{"range", "range(start, stop, step)"}),
						h.Label(h.Data("text-field", ""), h.Class("flex flex-col gap-1"),
							h.Span(h.Class("text-xs text-muted-foreground"), "s ="),
							h.Input(h.Type("text"), h.Data("in", "text"), h.Value("PYTHONIC"), h.Aria("label", "The string s"), h.Attr("maxlength", "14"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
								h.Class("h-9 w-40 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
						),
						in("start", "start", "2"),
						in("stop", "stop", "6"),
						in("step", "step", ""),
					),
					h.Div(h.Data("challenges", ""), h.Class("flex flex-wrap items-center gap-1.5"),
						h.Span(h.Class("mr-1 text-xs text-muted-foreground"), "Try to get:"),
						h.Map([][2]string{{"'PYT'", "the first three"}, {"'NIC'", "the last three"}, {"'PTOI'", "every other letter"}, {"'CINOHTYP'", "the string reversed"}, {"'THON'", "THON"}}, func(c [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("target", c[0]), h.Aria("pressed", "false"),
								h.Class("aria-pressed:border-brand aria-pressed:text-foreground"), c[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-4 p-4 sm:p-6"),
					h.Div(h.Class("scroll-thin overflow-x-auto rounded-lg border bg-code p-4"),
						h.Svg(h.Data("ruler", ""), h.Class("mx-auto block h-auto min-w-[460px]"), h.Role("img"), h.Aria("label", "Index ruler"))),
					h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-code px-4 py-3 font-mono text-sm"),
						h.Div(h.Class("flex flex-wrap items-baseline gap-x-3"), h.Span(h.Class("text-muted-foreground"), ">>>"), h.Code(h.Data("expr", ""))),
						h.Div(h.Data("result", ""), h.Aria("live", "polite"), h.Class("break-all")),
					),
					h.P(h.Data("explain", ""), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func pfNumbersBlock() Block {
	return Block{
		Slug:        "ints-and-floats",
		Title:       "int, float and 0.1 + 0.2",
		Description: "Python has whole numbers of any size and floats with about 16 significant digits. Try the expressions that surprise beginners: true division always gives a float, // rounds down (even below zero), and 0.1 is not exactly one tenth. The right panel shows the exact value a float stores.",
		Tags:        []string{"int", "float", "REPL"},
		Wide:        true,
		Render: func() h.Node {
			chips := []string{"0.1 + 0.2", "0.1 + 0.2 == 0.3", "math.isclose(0.1 + 0.2, 0.3)", "7 / 2", "6 / 3", "7 // 2", "-7 // 2", "-7 % 3", "2 ** 100", "2.0 ** 100", "round(2.5)", "int(3.99)", "1e16 + 1", "sum([0.1] * 10)", "type(4 / 2)"}
			return pfBox("pf-numbers",
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-4 lg:border-r lg:border-b-0"),
						h.Div(h.Class("flex flex-wrap gap-1.5"),
							h.Map(chips, func(c string) h.Node {
								return h.Button(h.Type("button"), h.Data("expr", c),
									h.Class("rounded-md border bg-code px-2 py-1 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"), c)
							}),
						),
						h.Div(h.Class("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-code"),
							h.Div(h.Data("history", ""), h.Aria("live", "polite"), h.Class("code scroll-thin flex max-h-[340px] min-h-48 flex-col gap-2 overflow-y-auto px-3 py-3")),
							h.Label(h.Class("flex items-center gap-2 border-t bg-code-panel px-3 py-2 font-mono text-[13px]"),
								h.Span(h.Class("text-muted-foreground select-none"), ">>>"),
								h.Input(h.Type("text"), h.Data("repl", ""), h.Aria("label", "Python expression or statement"), h.Placeholder("type an expression and press Enter"),
									h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"), h.Attr("spellcheck", "false"),
									h.Class("min-w-0 flex-1 bg-transparent text-base text-[var(--code-fg)] outline-none placeholder:text-muted-foreground/60 sm:text-[13px]")),
								kbd.Kbd(h.Class("hidden sm:inline-flex"), "⏎"),
							),
						),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							inlineCode("math"), " is already imported. Assignments are remembered, so ", inlineCode("x = 0.1"), " then ", inlineCode("x * 3"), " works. ",
							kbd.Kbd("↑"), " recalls the previous line."),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 p-5"),
						panelLabel("What a float really stores"),
						h.Label(h.Class("flex items-center gap-2 text-sm"),
							h.Span(h.Class("text-muted-foreground"), "You write"),
							h.Input(h.Type("text"), h.Data("dec", ""), h.Value("0.1"), h.Aria("label", "A decimal number"), h.Attr("inputmode", "decimal"), h.Attr("autocomplete", "off"),
								h.Class("h-8 w-40 rounded-md border border-input bg-background px-2 font-mono text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del")),
						),
						h.Div(h.Class("flex flex-col gap-1"),
							h.Span(h.Class("text-xs text-muted-foreground"), "Python stores exactly"),
							h.Div(h.Data("exact", ""), h.Class("rounded-md border bg-code px-3 py-2 font-mono text-[13px] leading-relaxed break-all")),
						),
						readouts([2]string{"repr() prints", "repr"}, [2]string{"stored − written", "err"}, [2]string{"gap to the next float", "ulp"}, [2]string{"relative gap", "rel"}),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"A float is a 53-bit binary fraction times a power of two, so most decimals land on the nearest one. ",
							inlineCode("repr"), " prints the shortest decimal that rounds back to the same float, which hides the error until you add a few. ",
							"For how these errors grow in real computations, see ",
							h.A(h.Href("/numerics"), h.Class("text-foreground underline underline-offset-4"), "Numerical Methods"), "."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

const pfVowelsSrc = `def count_vowels(word):
    count = 0
    for i in range(1, len(word)):
        if word[i] in "aeiou":
            count += 1
    return count`

func pfDebugBlock() Block {
	return Block{
		Slug:        "debugger",
		Title:       "Breakpoints and a failing test",
		Description: "count_vowels fails two of its tests. Click the gutter to set breakpoints, debug one failing case, step and watch i and count, then fix the code and run the tests again. There are two bugs; the last test finds the second.",
		Tags:        []string{"debugging", "breakpoints", "tests"},
		Wide:        true,
		Render: func() h.Node {
			return pfBox("pf-debug",
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b p-4 lg:border-r lg:border-b-0"),
						pfEditor("vowels.py", pfVowelsSrc, false, true,
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("act", "reset"), hugeicons.ArrowTurnBackwardIcon(), "Reset")),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "test"), hugeicons.TestTube01Icon(), "Run tests"),
							h.Span(h.Class("mx-1 h-5 w-px bg-border"), h.Aria("hidden", "true")),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "debug"), hugeicons.Bug01Icon(), "Debug"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "continue"), h.Disabled(), hugeicons.PlayIcon(), "Continue"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "step"), h.Disabled(), hugeicons.ArrowRight01Icon(), "Step"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "back"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "stop"), h.Disabled(), hugeicons.StopCircleIcon(), "Stop"),
						),
						h.P(h.Data("dbg-msg", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-xs leading-relaxed text-muted-foreground data-[bad]:text-del")),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"Click a line number to set a breakpoint, or press ", kbd.Kbd("F9"), " in the editor. Debug runs the case picked in the tests list."),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-5 p-5"),
						h.Div(h.Class("flex flex-col gap-2"),
							h.Div(h.Class("flex items-center gap-2"), panelLabel("Tests"),
								h.Span(h.Data("summary", ""), h.Class("ml-auto font-mono text-xs tabular-nums"))),
							h.Ul(h.Data("tests", ""), h.Role("radiogroup"), h.Aria("label", "Test to debug"), h.Class("flex flex-col gap-1")),
						),
						pfMemory(),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

const pfTestsStarter = `# One test per assert line.
assert is_leap(2024) == True
assert is_leap(2023) == False`

func pfTestsBlock() Block {
	return Block{
		Slug:        "tests-first",
		Title:       "Write the tests first",
		Description: "Five classmates wrote is_leap(year), and four of them got it wrong in different ways. Write assert lines from the rule alone: a test that the correct version passes and a wrong version fails catches that version. How few tests catch all of them?",
		Tags:        []string{"assert", "edge cases", "mutation testing"},
		Wide:        true,
		Render: func() h.Node {
			return pfBox("pf-tests",
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b p-4 lg:border-r lg:border-b-0"),
						h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed"),
							h.Div(h.Class("flex items-center gap-2"), badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Spec"),
								h.Code(h.Class("font-mono text-[13px]"), "is_leap(year) -> bool")),
							h.P("A year is a leap year if it is divisible by 4, except century years, which are leap years only if divisible by 400. So 2024 and 2000 are leap years; 2023 and 1900 are not."),
						),
						pfEditor("test_leap.py", pfTestsStarter, false, false,
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("act", "reset"), hugeicons.ArrowTurnBackwardIcon(), "Reset")),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "run"), hugeicons.PlayIcon(), "Run the tests", kbd.Kbd(h.Class("ml-0.5 hidden sm:inline-flex"), "⌘⏎")),
							h.Span(h.Data("score", ""), h.Aria("live", "polite"), h.Class("ml-auto font-mono text-xs tabular-nums")),
						),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 p-5"),
						panelLabel("Which versions each test catches"),
						h.Div(h.Class("scroll-thin overflow-x-auto rounded-lg border"),
							h.Table(h.Data("matrix", ""), h.Class("w-full border-collapse font-mono text-xs"))),
						h.P(h.Data("verdict", ""), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground")),
						h.Details(h.Class("group rounded-lg border"),
							h.Summary(h.Class("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-muted-foreground select-none hover:text-foreground"),
								hugeicons.ArrowRight01Icon(h.Class("size-4 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none")), "Show the five versions"),
							h.Div(h.Data("versions", ""), h.Class("flex flex-col gap-3 border-t p-3")),
						),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

// pfSym marks a symbol of a formula; the module links it to the code.
func pfSym(key string, node h.Node) h.Node {
	return h.El("mrow", h.Data("sym", key), h.TabIndex(0), h.Class("rounded-sm outline-none transition-colors duration-150 data-[on]:bg-brand/20 focus-visible:bg-brand/20"), node)
}

func pfFormulaBlock() Block {
	return Block{
		Slug:        "formula-to-code",
		Title:       "From formula to code",
		Description: "Every symbol of a formula becomes a name or an operator in the program. Hover or focus a symbol on either side to see its partner, change the inputs, and read the output. Σ becomes sum(), a subscript becomes a loop variable, and an exponent becomes **.",
		Tags:        []string{"MathML", "translation", "f-strings"},
		Wide:        true,
		Render: func() h.Node {
			sub := func(b, s string) h.Node { return msub(mi(b), mi(s)) }
			meanF := mathBlock(pfSym("mean", mover(mi("x"), mo("‾"))), mo("="), mfrac(mn("1"), pfSym("n", mi("n"))),
				pfSym("sum", h.El("munderover", mo("∑"), mrow(mi("i"), mo("="), mn("1")), mi("n"))), pfSym("x", sub("x", "i")))
			varF := mathBlock(pfSym("var", msup(mi("s"), mn("2"))), mo("="), mfrac(mn("1"), mrow(pfSym("n", mi("n")), mo("−"), mn("1"))),
				pfSym("sum", h.El("munderover", mo("∑"), mrow(mi("i"), mo("="), mn("1")), mi("n"))),
				msup(mrow(mo("("), pfSym("x", sub("x", "i")), mo("−"), pfSym("mean", mover(mi("x"), mo("‾"))), mo(")")), pfSym("pow", mn("2"))))
			compF := mathBlock(pfSym("A", mi("A")), mo("="), pfSym("P", mi("P")),
				msup(mrow(mo("("), mn("1"), mo("+"), mfrac(pfSym("r", mi("r")), pfSym("n", mi("n"))), mo(")")), pfSym("pow", mrow(pfSym("n", mi("n")), pfSym("t", mi("t"))))))
			newtonF := mathBlock(pfSym("x", msub(mi("x"), mrow(mi("k"), mo("+"), mn("1")))), mo("="), mfrac(mn("1"), mn("2")),
				mrow(mo("("), pfSym("x", sub("x", "k")), mo("+"), mfrac(pfSym("a", mi("a")), pfSym("x", sub("x", "k"))), mo(")")))
			return pfBox("pf-formula",
				h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
					segs("Formula",
						[2]string{"mean", "Mean and variance"},
						[2]string{"interest", "Compound interest"},
						[2]string{"newton", "Newton's square root"}),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-5 border-b p-5 lg:border-r lg:border-b-0"),
						h.Div(h.Data("view", "mean"), h.Class("flex flex-col gap-3 text-lg"), meanF, varF,
							h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), "The sample variance divides by n − 1, not n: the mean was estimated from the same data, which uses up one degree of freedom.")),
						h.Div(h.Data("view", "interest"), h.Hidden(), h.Class("flex flex-col gap-3 text-lg"), compF,
							h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), "P grows by r/n each period, n times a year for t years. nt in the exponent becomes n * t: in Python the multiplication must be written.")),
						h.Div(h.Data("view", "newton"), h.Hidden(), h.Class("flex flex-col gap-3 text-lg"), newtonF,
							h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), "The subscripts k and k + 1 don't need two variables: x = … overwrites the old guess with the new one, one pass of the loop per step k.")),
						h.Div(h.Data("params", ""), h.Class("flex flex-col gap-2 border-t pt-4")),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 p-4"),
						pfEditor("formula.py", "", true, false,
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("act", "run"), hugeicons.PlayIcon(), "Run")),
						pfConsole("Output"),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func pfDictBlock() Block {
	return Block{
		Slug:        "counting-with-a-dict",
		Title:       "Counting with a dictionary",
		Description: "A dict maps keys to values, which makes it the natural tool for counting. Type a sentence and step through the loop: each word either gets a new key or adds one to its count. The bars below follow the dict at every step.",
		Tags:        []string{"dict", "word frequency", ".get()"},
		Wide:        true,
		Render: func() h.Node {
			return pfBox("pf-dict",
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end"),
					h.Label(h.Class("flex min-w-0 flex-1 flex-col gap-1"),
						h.Span(h.Class("text-xs text-muted-foreground"), "text ="),
						h.Input(h.Type("text"), h.Data("text", ""), h.Value("the cat and the hat and the bat"), h.Aria("label", "Text to count"), h.Attr("maxlength", "80"), h.Attr("autocomplete", "off"),
							h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
					),
					segs("Style", [2]string{"get", "counts.get(word, 0) + 1"}, [2]string{"in", "if word in counts"}),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b p-4 lg:border-r lg:border-b-0"),
						pfEditor("count.py", "", true, false),
						pfStepper(),
						pfConsole("Output"),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-5 p-5"),
						h.Div(h.Class("flex flex-col gap-2"),
							h.Div(h.Class("flex items-center gap-2"), panelLabel("counts, at this step"),
								h.Span(h.Data("totals", ""), h.Class("ml-auto font-mono text-[11px] text-muted-foreground tabular-nums"))),
							h.Div(h.Data("bars", ""), h.Class("flex min-h-24 flex-col gap-1")),
						),
						pfMemory(),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func pfCompBlock() Block {
	return Block{
		Slug:        "loop-and-comprehension",
		Title:       "A loop and a comprehension, side by side",
		Description: "A list comprehension is a for loop that builds a list, folded into one expression. Step through both versions together: the same item is visited, the same test decides, the same value is added. Edit the input list and they still agree.",
		Tags:        []string{"list comprehension", "for loop", "equivalence"},
		Wide:        true,
		Render: func() h.Node {
			pane := func(key, file, label string) h.Node {
				return h.Div(h.Data("pane", key), h.Class("flex min-w-0 flex-col gap-3"),
					h.Div(h.Class("flex items-center gap-2"), panelLabel(label),
						h.Span(h.Data("pane-steps", ""), h.Class("ml-auto font-mono text-[11px] text-muted-foreground tabular-nums"))),
					pfEditor(file, "", true, false),
					h.Div(h.Class("flex flex-wrap items-center gap-2 font-mono text-xs"),
						h.Span(h.Data("pane-x", ""), h.Class("rounded-md border bg-code px-2 py-1")),
						h.Span(h.Data("pane-kept", ""), h.Class("text-muted-foreground")),
					),
					h.Div(h.Data("pane-list", ""), h.Class("flex min-h-10 flex-wrap items-center gap-1 font-mono text-sm")),
				)
			}
			return pfBox("pf-comp",
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end"),
					segs("Example", [2]string{"squares", "Squares"}, [2]string{"evens", "Keep the evens"}, [2]string{"lengths", "Word lengths"}),
					h.Label(h.Class("flex min-w-0 flex-1 flex-col gap-1"),
						h.Span(h.Data("src-label", ""), h.Class("text-xs text-muted-foreground"), "nums ="),
						h.Input(h.Type("text"), h.Data("src", ""), h.Value("[3, 8, 5, 12, 7]"), h.Aria("label", "Input list"), h.Attr("maxlength", "80"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
							h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del sm:text-sm")),
					),
				),
				h.Div(h.Class("grid gap-6 p-4 lg:grid-cols-2"),
					pane("loop", "loop.py", "For loop"),
					pane("comp", "comprehension.py", "Comprehension"),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t p-4"),
					pfStepper(),
				),
			)
		},
	}
}
