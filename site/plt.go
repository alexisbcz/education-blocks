package site

import (
	"strconv"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PltBlocks lists the programming languages gallery in display order.
// Every block runs a real implementation in static/js/plt-*.js: Thompson
// and subset construction, a lexer, a Pratt parser, a tree-walking
// interpreter, a bytecode VM, Algorithm W, two garbage collectors, a
// lambda-calculus reducer and an LL(1) table builder.
func PltBlocks() []Block {
	return []Block{
		pltRegexBlock(),
		pltLexerBlock(),
		pltPrattBlock(),
		pltScopeBlock(),
		pltInterpBlock(),
		pltVMBlock(),
		pltTypesBlock(),
		pltLambdaBlock(),
		pltGCBlock(),
		pltGrammarBlock(),
	}
}

// pltInput is a one-line monospace input; key names it for the module.
func pltInput(key, label, value string) h.Node {
	return h.Label(h.Class("flex min-w-0 flex-1 flex-col gap-1.5"),
		h.Span(h.Class("text-xs text-muted-foreground"), label),
		h.Input(h.Type("text"), h.Data("in", key), h.Value(value), h.Aria("label", label),
			h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"), h.Attr("autocorrect", "off"), h.Attr("spellcheck", "false"),
			h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del sm:text-sm")),
	)
}

// pltSource is a multi-line monospace editor for a small program.
func pltSource(key, label, value string, rows int) h.Node {
	return h.Label(h.Class("flex min-w-0 flex-col gap-1.5"),
		h.Span(h.Class("text-xs text-muted-foreground"), label),
		h.Textarea(h.Data("in", key), h.Aria("label", label), h.Attr("rows", strconv.Itoa(rows)), h.Attr("spellcheck", "false"),
			h.Attr("autocapitalize", "off"), h.Attr("autocorrect", "off"), h.Attr("wrap", "off"),
			h.Class("code scroll-thin w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[bad]:border-del sm:text-[13px]"),
			value),
	)
}

// pltStepper is the Back / Step / Run / Reset row the steppers share.
func pltStepper(run bool) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-2"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "reset"), hugeicons.RefreshIcon(), "Reset"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "back"), hugeicons.ArrowLeft01Icon(), "Back"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "step"), "Step", hugeicons.ArrowRight01Icon()),
		h.If(run, button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "run"), hugeicons.ArrowRightDoubleIcon(), "Run to end")),
	)
}

// pltMessage is the status line under an input: errors in red, results in
// the foreground.
func pltMessage() h.Node {
	return h.P(h.Data("out", "msg"), h.Aria("live", "polite"),
		h.Class("min-h-5 font-mono text-xs text-muted-foreground data-[bad]:text-del data-[good]:text-add"))
}

func pltKeys() h.Node {
	return h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
		"Focus the block and use", kbd.Group(kbd.Kbd("←"), kbd.Kbd("→")), "to step")
}

// ---------------------------------------------------------------- 1

func pltRegexBlock() Block {
	return Block{
		Slug:        "regex",
		Title:       "Regex to NFA to DFA",
		Description: "How a regular expression engine works. The pattern is parsed, turned into an NFA by Thompson's construction, then into a DFA by the subset construction; each DFA state is a set of NFA states. Step through a test string and watch the current state move.",
		Tags:        []string{"Thompson", "subset construction", "automata"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("plt-regex", ""), h.TabIndex(0),
				h.Aria("label", "Regex automaton. Arrow keys step through the test string."),
				h.Div(h.Class("flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end"),
					pltInput("re", "Regular expression", "(a|b)*abb"),
					pltInput("str", "Test string", "aababb"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						segs("Automaton", [2]string{"dfa", "DFA"}, [2]string{"nfa", "NFA"}),
					),
				),
				h.Div(h.Class("grid lg:grid-cols-[minmax(0,1fr)_300px]"),
					h.Div(h.Class("relative min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
						h.Div(h.Data("tape", ""), h.Class("mb-2 flex flex-wrap gap-1 font-mono text-sm")),
						h.Div(h.Class("scroll-thin overflow-x-auto"), h.Svg(h.Data("graph", ""), h.Class("block h-auto min-w-[520px]"), h.Role("img"), h.Aria("label", "State diagram"))),
					),
					h.Div(h.Class("flex flex-col gap-4 p-5"),
						pltStepper(true),
						pltMessage(),
						readouts([2]string{"NFA states", "nfa"}, [2]string{"DFA states", "dfa"}, [2]string{"current", "cur"}, [2]string{"verdict", "verdict"}),
						h.Div(h.Class("scroll-thin max-h-56 overflow-auto rounded-md border"), h.Table(h.Data("table", ""), h.Class("w-full font-mono text-[11px]"))),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"Supports literals, ", inlineCode("."), ", ", inlineCode("* + ?"), ", ", inlineCode("|"), ", groups, classes like ",
							inlineCode("[a-z0-9]"), " and ", inlineCode(`\.`), " escapes. The DFA is built over the characters of the pattern and the test string."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func pltLexerBlock() Block {
	return Block{
		Slug:        "lexer",
		Title:       "Lexer",
		Description: "The first stage of a compiler: characters in, tokens out. The scanner reads one longest match at a time (maximal munch), skips whitespace and comments, and reports the line and column of anything it cannot recognise.",
		Tags:        []string{"tokens", "maximal munch", "stepper"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("plt-lexer", ""), h.TabIndex(0),
				pltSource("src", "Source", "let total = price * 1.2 + 3; // with tax\nif (total >= 10) { print \"big\" }", 3),
				h.Div(h.Class("code scroll-thin overflow-x-auto rounded-lg border bg-code p-3 whitespace-pre"), h.Data("code", "")),
				pltStepper(true),
				pltMessage(),
				h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("tokens", ""), h.Aria("live", "polite")),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func pltPrattBlock() Block {
	return Block{
		Slug:        "pratt",
		Title:       "Precedence and the Pratt parser",
		Description: "Why 2 + 3 * 4 is 14 and 2 ^ 3 ^ 2 is 512. A Pratt parser gives each operator a binding power; the tree it builds puts tighter operators lower, and associativity decides which side of a tie binds. Every call of the parser is logged.",
		Tags:        []string{"AST", "binding power", "associativity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("plt-pratt",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"), h.Svg(h.Data("tree", ""), h.Class("mx-auto block h-auto"), h.Role("img"), h.Aria("label", "Abstract syntax tree"))),
					h.Div(h.Data("sexpr", ""), h.Class("code rounded-md border bg-background px-3 py-2")),
					h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
						h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parser calls"),
							h.Ol(h.Data("log", ""), h.Class("scroll-thin code max-h-64 overflow-auto rounded-md border bg-background p-2 text-[11px]"))),
						h.Div(h.Class("flex flex-col gap-2"), panelLabel("Binding powers"),
							h.Table(h.Data("bp", ""), h.Class("w-full font-mono text-[11px]"))),
					),
				),
				pltInput("expr", "Expression", "2 + 3 * 4"),
				h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("presets", "")),
				pltMessage(),
				readouts([2]string{"value", "value"}, [2]string{"nodes", "nodes"}, [2]string{"depth", "depth"}),
			)
		},
	}
}

// pltLangSample is the tiny language the interpreter, the scope view and the
// bytecode compiler share.
const pltLangSample = `let makeCounter = fn(start) {
  let count = start;
  fn(step) { count = count + step; count }
};
let c = makeCounter(10);
c(1);
c(5)`

// ---------------------------------------------------------------- 4

func pltScopeBlock() Block {
	return Block{
		Slug:        "scope",
		Title:       "Scope and name resolution",
		Description: "Lexical scope, made visible. Each function body and block opens a scope; click any use of a name to see which declaration it resolves to, how many scopes up that is, and which names it shadows.",
		Tags:        []string{"lexical scope", "shadowing", "resolver"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("plt-scope", ""),
				pltSource("src", "Program", "let x = 1;\nlet f = fn(y) {\n  let x = y * 2;\n  fn(z) { x + y + z }\n};\nlet g = f(3);\ng(x)", 7),
				pltMessage(),
				h.Div(h.Data("code", ""), h.Class("code scroll-thin overflow-x-auto rounded-lg border bg-code p-3 leading-7 whitespace-pre")),
				h.P(h.Data("out", "info"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground"), "Click a name in the program."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func pltInterpBlock() Block {
	return Block{
		Slug:        "interpreter",
		Title:       "Tree-walking interpreter",
		Description: "An evaluator for a tiny language with let, fn, if and closures, run one AST node at a time. Environments are frames that point to their parent; a closure keeps the frame it was created in, which is why the counter remembers its count.",
		Tags:        []string{"environments", "closures", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("plt-interp", ""), h.TabIndex(0),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-4 lg:border-r lg:border-b-0"),
					pltSource("src", "Program", pltLangSample, 7),
					h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("presets", "")),
					pltStepper(true),
					pltMessage(),
					h.Div(h.Data("code", ""), h.Class("code scroll-thin overflow-x-auto rounded-lg border bg-code p-3 whitespace-pre")),
					pltKeys(),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 bg-code p-4"),
					h.Div(h.Class("flex items-center justify-between"), panelLabel("Environment frames"), h.Span(h.Data("out", "steps"), h.Class("font-mono text-xs text-muted-foreground"))),
					h.Div(h.Data("frames", ""), h.Class("flex flex-col gap-2")),
					panelLabel("Output"),
					h.Div(h.Data("out", "result"), h.Class("code min-h-12 rounded-md border bg-background p-2 whitespace-pre-wrap")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func pltVMBlock() Block {
	return Block{
		Slug:        "bytecode",
		Title:       "Bytecode and a stack machine",
		Description: "The same kind of program, compiled instead of walked: the compiler turns the AST into instructions for a stack machine, with jumps for if and while. Step the VM and watch the program counter, the operand stack and the variables.",
		Tags:        []string{"compiler", "stack VM", "jumps"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]"), h.Data("plt-vm", ""), h.TabIndex(0),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-4 lg:border-r lg:border-b-0"),
					pltSource("src", "Program", "let n = 5;\nlet sum = 0;\nwhile (n > 0) {\n  sum = sum + n;\n  n = n - 1;\n}\nprint sum", 7),
					pltStepper(true),
					pltMessage(),
					readouts([2]string{"pc", "pc"}, [2]string{"steps", "steps"}, [2]string{"output", "output"}),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-2 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					panelLabel("Bytecode"),
					h.Ol(h.Data("code", ""), h.Class("code scroll-thin max-h-[360px] overflow-auto")),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 p-4"),
					panelLabel("Operand stack"),
					h.Ol(h.Data("stack", ""), h.Class("flex min-h-24 flex-col-reverse justify-end gap-1 font-mono text-sm")),
					panelLabel("Variables"),
					h.Dl(h.Data("vars", ""), h.Class("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func pltTypesBlock() Block {
	return Block{
		Slug:        "type-inference",
		Title:       "Type inference",
		Description: "Hindley–Milner type inference (Algorithm W) on small lambda terms. Every subterm gets a type variable, unification solves the equations, and let-bound names are generalised so the identity function can be used at two types. Self-application fails the occurs check.",
		Tags:        []string{"Hindley–Milner", "unification", "polymorphism"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("plt-types", ""),
				pltInput("term", "Term", `\f. \x. f (f x)`),
				h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("presets", "")),
				pltMessage(),
				h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Inferred type"),
					h.Div(h.Data("out", "type"), h.Class("font-mono text-lg")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Unification steps"),
					h.Ol(h.Data("steps", ""), h.Class("code scroll-thin max-h-72 overflow-auto rounded-md border bg-code p-2 text-[12px]"))),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Syntax: ", inlineCode(`\x. e`), " lambda, ", inlineCode("f x"), " application, ", inlineCode("let x = e in e"),
					", integers, ", inlineCode("true"), "/", inlineCode("false"), ", ", inlineCode("if c then a else b"), ", and ", inlineCode("+"), " on integers."),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func pltLambdaBlock() Block {
	return Block{
		Slug:        "lambda",
		Title:       "Lambda calculus",
		Description: "Computation as substitution. Each step contracts the leftmost-outermost redex (normal order), renaming bound variables when a substitution would capture one. Church numerals come out as numbers; the Y combinator shows why a step limit is needed.",
		Tags:        []string{"β-reduction", "Church numerals", "normal order"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("plt-lambda", ""), h.TabIndex(0),
				pltInput("term", "Term (λ may be typed as \\)", "SUCC (SUCC ZERO)"),
				h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("presets", "")),
				pltStepper(true),
				pltMessage(),
				readouts([2]string{"steps", "steps"}, [2]string{"normal form", "normal"}, [2]string{"as a numeral", "church"}),
				h.Ol(h.Data("trace", ""), h.Class("code scroll-thin max-h-96 overflow-auto rounded-lg border bg-code p-3 text-[13px]")),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Defined names, expanded before reducing: ZERO, ONE, TWO, THREE, SUCC, PLUS, MULT, TRUE, FALSE, IF, Y, ID, K, OMEGA. The underlined term is the redex about to be contracted."),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func pltGCBlock() Block {
	return Block{
		Slug:        "gc",
		Title:       "Garbage collection",
		Description: "Two ways to free memory. Reference counting frees an object the moment its count drops to zero, but a cycle keeps itself alive. Mark-and-sweep starts from the roots, marks everything reachable and sweeps the rest, cycles included.",
		Tags:        []string{"reference counting", "mark-and-sweep", "heap"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("plt-gc",
				h.Svg(h.Data("heap", ""), h.ViewBox("0 0 640 340"), h.Class("block h-auto w-full"), h.Role("img"), h.Aria("label", "Heap graph")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Collector"),
					segs("Collector", [2]string{"rc", "Reference counting"}, [2]string{"ms", "Mark-and-sweep"})),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Program"),
					h.Div(h.Class("grid grid-cols-1 gap-1.5"), h.Data("ops", "")),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "collect"), hugeicons.Delete02Icon(), h.Span(h.Data("label", ""), "Collect")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("act", "reset"), hugeicons.RefreshIcon(), "Reset"),
				),
				pltMessage(),
				readouts([2]string{"live objects", "live"}, [2]string{"reachable", "reach"}, [2]string{"leaked", "leaked"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func pltGrammarBlock() Block {
	return Block{
		Slug:        "grammar",
		Title:       "Grammars and LL(1)",
		Description: "Write a context-free grammar in BNF and get its nullable set, FIRST and FOLLOW sets and the LL(1) parse table, with conflicts and left recursion pointed out. Remove the left recursion and the conflicts disappear.",
		Tags:        []string{"BNF", "FIRST / FOLLOW", "LL(1)"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"), h.Data("plt-grammar", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b p-4 lg:border-r lg:border-b-0"),
					pltSource("src", "Grammar (first rule is the start; ε or eps for empty)", "E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id", 6),
					h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("presets", "")),
					pltMessage(),
					h.Ul(h.Data("issues", ""), h.Class("flex flex-col gap-1.5 text-sm")),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 bg-code p-4"),
					h.Div(h.Class("scroll-thin overflow-x-auto"), h.Table(h.Data("sets", ""), h.Class("w-full font-mono text-[12px]"))),
					panelLabel("LL(1) parse table"),
					h.Div(h.Class("scroll-thin overflow-x-auto"), h.Table(h.Data("table", ""), h.Class("w-full font-mono text-[12px]"))),
				),
			)
		},
	}
}
