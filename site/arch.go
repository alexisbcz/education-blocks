package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ArchBlocks lists the computer architecture gallery in display order.
// The simulators live in static/js/arch.js.
func ArchBlocks() []Block {
	return []Block{
		archBinaryBlock(),
		archAdderBlock(),
		archCPUBlock(),
		archFloatBlock(),
		archMemoryBlock(),
		archCacheBlock(),
		archPipelineBlock(),
		archAmdahlBlock(),
	}
}

// archBits renders n toggleable bit buttons, most significant first.
func archBits(name string, n int, value int) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1"), h.Data("bits", name),
		h.Range(n, func(i int) h.Node {
			bit := n - 1 - i
			on := value>>bit&1 == 1
			return h.Button(h.Type("button"), h.Data("bit", fmt.Sprint(bit)), h.Aria("pressed", fmt.Sprint(on)),
				h.Aria("label", fmt.Sprintf("%s bit %d", name, bit)),
				h.Class("flex h-10 w-8 flex-col items-center justify-center rounded-md border font-mono text-base tabular-nums outline-none transition-colors duration-100 hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand/60 aria-pressed:bg-brand/10 aria-pressed:text-brand"),
				h.Span(h.Data("digit", ""), h.IfElse(on, "1", "0")),
				h.Span(h.Class("text-[8px] text-muted-foreground"), fmt.Sprint(bit)),
			)
		}),
	)
}

// ---------------------------------------------------------------- A1

func archBinaryBlock() Block {
	return Block{
		Slug:        "binary",
		Title:       "Binary, hex and two's complement",
		Description: "Eight bits, read three ways: as an unsigned number, as a signed two's-complement number (the top bit weighs −128), and in hex. Add a second byte and watch the carry and overflow flags: carry is unsigned overflow, V is signed overflow.",
		Tags:        []string{"bits", "two's complement", "flags"},
		Wide:        true,
		Render: func() h.Node {
			row := func(name, label string, v int) h.Node {
				return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-2"),
					h.Span(h.Class("w-6 font-mono text-sm text-muted-foreground"), label),
					archBits(name, 8, v),
					h.Dl(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs"),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "unsigned"), h.Dd(h.Data("out", name+"-u"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "signed"), h.Dd(h.Data("out", name+"-s"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "hex"), h.Dd(h.Data("out", name+"-h"), "—")),
					),
				)
			}
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("arch-binary", ""),
				row("a", "A", 100),
				row("b", "B", 60),
				h.Div(h.Class("h-px bg-border")),
				h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-2"),
					h.Span(h.Class("w-6 font-mono text-sm text-muted-foreground"), "A+B"),
					h.Div(h.Data("sum", ""), h.Class("flex gap-1")),
					h.Dl(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs"),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "unsigned"), h.Dd(h.Data("out", "sum-u"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "signed"), h.Dd(h.Data("out", "sum-s"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "hex"), h.Dd(h.Data("out", "sum-h"), "—")),
					),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2 border-t pt-4"),
					h.Span(h.Data("flag", "c"), h.Class("rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"), "C carry"),
					h.Span(h.Data("flag", "v"), h.Class("rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"), "V overflow"),
					h.Span(h.Data("flag", "z"), h.Class("rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"), "Z zero"),
					h.Span(h.Data("flag", "n"), h.Class("rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"), "N negative"),
					h.Div(h.Class("flex-1")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "negate"), "Negate A (invert, +1)"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "minus1"), "A = −1"),
				),
				h.P(h.Data("out", "note"), h.Class("min-h-4 text-xs text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func archAdderBlock() Block {
	return Block{
		Slug:        "adder",
		Title:       "Ripple-carry adder",
		Description: "Four full adders in a chain. Each full adder is two XORs, two ANDs and an OR; the carry has to ripple through all of them, two gate delays per bit. Step through time and watch the signals settle: grey wires are not yet valid.",
		Tags:        []string{"full adder", "gate delays", "carry"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("arch-adder",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 300"), h.Class("mx-auto block w-full max-w-[680px]"), h.Role("img"), h.Aria("label", "Four-bit ripple-carry adder")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Inputs"),
					h.Div(h.Class("flex items-center gap-2"), h.Span(h.Class("w-4 font-mono text-xs text-muted-foreground"), "A"), archBits("a", 4, 11)),
					h.Div(h.Class("flex items-center gap-2"), h.Span(h.Class("w-4 font-mono text-xs text-muted-foreground"), "B"), archBits("b", 4, 7)),
					toggle("arch-cin", "cin", "Carry in", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Time"),
					field("t", "t", "gate delays", 9, 0, 9, 1),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "replay"), hugeicons.PlayIcon(), "Replay"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "settle"), hugeicons.ArrowRight01Icon(), "Settle"),
					),
				),
				readouts([2]string{"A + B", "sum"}, [2]string{"settled", "settled"}, [2]string{"critical path", "path"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func archCPUBlock() Block {
	return Block{
		Slug:        "cpu",
		Title:       "A tiny CPU",
		Description: "An 8-bit accumulator machine with 32 bytes of memory. Each instruction is one byte: 3 bits of opcode, 5 bits of address. Step through fetch, decode and execute and watch the program counter, the instruction register and memory change.",
		Tags:        []string{"fetch–decode–execute", "ISA", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			reg := func(key, label string) h.Node {
				return h.Div(h.Class("flex flex-col gap-0.5 rounded-lg border bg-background px-3 py-2"),
					h.Span(h.Class("font-mono text-[10px] tracking-wider text-muted-foreground uppercase"), label),
					h.Span(h.Data("register", key), h.Class("font-mono text-lg tabular-nums"), "0"))
			}
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("arch-cpu", ""), h.TabIndex(0),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-5"),
						reg("pc", "PC"), reg("ir", "IR"), reg("acc", "ACC"), reg("z", "Z flag"), reg("cycle", "cycle"),
					),
					h.Div(h.Class("flex items-center gap-2 font-mono text-xs"),
						h.Span(h.Class("text-muted-foreground"), "next"),
						h.Span(h.Data("cpu-phase", ""), h.Class("rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-brand"), "fetch"),
						h.Span(h.Data("explain", ""), h.Class("min-w-0 truncate text-muted-foreground")),
					),
					h.Div(h.Data("memory", ""), h.Class("grid grid-cols-4 gap-1 sm:grid-cols-8")),
					h.Div(h.Class("flex items-center gap-2 font-mono text-xs"),
						h.Span(h.Class("text-muted-foreground"), "output"),
						h.Span(h.Data("output", ""), h.Class("min-h-5 tabular-nums")),
					),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Program"),
						segs("Program", [2]string{"add", "Add"}, [2]string{"count", "Countdown"}, [2]string{"mul", "Multiply"}),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "step"), hugeicons.ArrowRight01Icon(), "Step", kbd.Kbd(h.Class("ml-auto"), "→")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "run"),
							hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
							h.Span(h.Data("label", ""), h.Data("idle", "Run"), "Run")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), h.Class("col-span-2"), hugeicons.RefreshIcon(), "Reset"),
					),
					h.Div(h.Class("flex flex-col gap-1.5 border-t pt-4"), panelLabel("Instruction set"),
						h.Div(h.Class("grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]"),
							h.Map([][3]string{{"000", "HALT", "stop"}, {"001", "LOAD a", "ACC ← M[a]"}, {"010", "STORE a", "M[a] ← ACC"}, {"011", "ADD a", "ACC ← ACC + M[a]"}, {"100", "SUB a", "ACC ← ACC − M[a]"}, {"101", "JMP a", "PC ← a"}, {"110", "JZ a", "if Z: PC ← a"}, {"111", "OUT", "print ACC"}}, func(r [3]string) h.Node {
								return h.Group(h.Span(h.Class("text-muted-foreground"), r[0]), h.Span(r[1]), h.Span(h.Class("text-muted-foreground"), r[2]))
							}),
						),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func archFloatBlock() Block {
	return Block{
		Slug:        "float",
		Title:       "IEEE 754 floating point",
		Description: "A 32-bit float is a sign, an 8-bit biased exponent and 23 bits of fraction: (−1)^s × 1.f × 2^(e−127). Type a number to see the float it becomes and its exact value, or flip bits directly. 0.1 has no exact binary form, which is why 0.1 + 0.2 ≠ 0.3.",
		Tags:        []string{"float32", "rounding", "bits"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("arch-float", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					h.Label(h.For("arch-float-in"), h.Class("text-sm text-muted-foreground"), "Number"),
					h.Input(h.ID("arch-float-in"), h.Type("text"), h.Attr("inputmode", "decimal"), h.Value("0.1"), h.Attr("autocomplete", "off"),
						h.Class("h-9 w-44 rounded-md border border-input bg-background px-3 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
					h.Map([]string{"0.1", "1", "-2.5", "3.14159265", "16777217", "1e-40", "Infinity"}, func(v string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("value", v), v)
					}),
				),
				h.Div(h.Data("bits", ""), h.Class("scroll-thin flex gap-0.5 overflow-x-auto pb-1")),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--code-del)", "sign"), legendSwatch("var(--vec-out)", "exponent (8)"), legendSwatch("var(--vec-u)", "fraction (23)")),
				h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
					h.Dt(h.Class("text-muted-foreground"), "formula"), h.Dd(h.Data("out", "formula"), h.Class("break-all"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "exact value"), h.Dd(h.Data("out", "exact"), h.Class("break-all"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "rounding error"), h.Dd(h.Data("out", "error"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "next float up"), h.Dd(h.Data("out", "next"), h.Class("break-all"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "kind"), h.Dd(h.Data("out", "kind"), "—"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func archMemoryBlock() Block {
	return Block{
		Slug:        "memory",
		Title:       "The memory hierarchy",
		Description: "How long a CPU waits for data, from a register to a spinning disk, on a log scale. Each step down is bigger, cheaper and slower. Switch on human scale to stretch one nanosecond to one second. Latencies are typical orders of magnitude; real hardware varies.",
		Tags:        []string{"latency", "log scale", "human scale"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4 sm:p-5"), h.Data("arch-memory", ""),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					panelLabel("Access latency"),
					h.Div(h.Class("flex items-center gap-2"), toggle("arch-human", "human", "Human scale", false)),
				),
				h.Div(h.Data("rows", ""), h.Class("flex flex-col gap-1.5")),
				h.P(h.Class("text-xs text-muted-foreground"), "Bars are logarithmic: each gridline is ×10."),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

func archCacheBlock() Block {
	return Block{
		Slug:        "cache",
		Title:       "Cache simulator",
		Description: "A 128-byte cache in front of memory. Each address splits into tag, index and offset; a direct-mapped cache has one place per block, a 2-way cache two (least recently used is evicted). Run a trace and compare hit rates: the conflict trace thrashes direct-mapped and fits 2-way.",
		Tags:        []string{"tag / index / offset", "associativity", "LRU"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("arch-cache",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("lines", ""), h.Class("grid gap-1")),
					h.Div(h.Data("log", ""), h.Class("scroll-thin max-h-56 overflow-y-auto rounded-lg border bg-background font-mono text-xs")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cache"),
					segs("Associativity", [2]string{"1", "Direct-mapped"}, [2]string{"2", "2-way"}),
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("group"), h.Aria("label", "Block size"),
						h.Map([]string{"4", "8", "16"}, func(b string) h.Node {
							return h.Button(h.Type("button"), h.Data("bsize", b), h.Aria("pressed", fmt.Sprint(b == "16")),
								h.Class("rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"),
								b+" B blocks")
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Trace"),
					h.Div(h.Data("traces", ""), h.Class("flex flex-wrap gap-1.5"),
						h.Map([][2]string{{"scan", "Array scan"}, {"stride", "Stride 64"}, {"conflict", "Conflict"}}, func(t [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("trace", t[0]), h.Aria("pressed", fmt.Sprint(t[0] == "scan")),
								h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:bg-brand/10 aria-pressed:text-brand"),
								t[1])
						}),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2 pt-1"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "step"), hugeicons.ArrowRight01Icon(), "Step"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "all"), "Run all"),
					),
				),
				readouts([2]string{"address split", "split"}, [2]string{"accesses", "n"}, [2]string{"hits", "hits"}, [2]string{"hit rate", "rate"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func archPipelineBlock() Block {
	return Block{
		Slug:        "pipeline",
		Title:       "Pipelining and hazards",
		Description: "A classic 5-stage pipeline (fetch, decode, execute, memory, write-back) overlaps instructions. A data hazard stalls an instruction until the value it needs exists; forwarding passes results straight from EX or MEM and removes most stalls, but not the load-use one.",
		Tags:        []string{"IF ID EX MEM WB", "stalls", "forwarding"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("arch-pipeline", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					toggle("arch-fwd", "forward", "Forwarding", true),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs"),
						h.Span(h.Span(h.Class("text-muted-foreground"), "cycles "), h.Span(h.Data("out", "cycles"), "—")),
						h.Span(h.Span(h.Class("text-muted-foreground"), "stalls "), h.Span(h.Data("out", "stalls"), "—")),
						h.Span(h.Span(h.Class("text-muted-foreground"), "CPI "), h.Span(h.Data("out", "cpi"), "—")),
					),
				),
				h.Div(h.Data("grid", ""), h.Class("scroll-thin overflow-x-auto")),
				h.P(h.Data("out", "note"), h.Class("text-xs leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func archAmdahlBlock() Block {
	return Block{
		Slug:        "amdahl",
		Title:       "Amdahl's law",
		Description: "Speeding up part of a program speeds up the whole only so much: with a fraction p parallelised over n cores, speedup = 1 / ((1 − p) + p/n), which can never exceed 1/(1 − p). At p = 95%, a thousand cores give less than 20×.",
		Tags:        []string{"parallelism", "speedup", "limits"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("arch-amdahl",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Speedup against number of cores")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Program"),
					field("p", "Parallel part p", "%", 95, 0, 100, 0.5),
					field("n", "Cores n", "", 16, 1, 1024, 1),
				),
				readouts([2]string{"speedup", "s"}, [2]string{"limit 1/(1−p)", "limit"}, [2]string{"efficiency", "eff"}),
			)
		},
	}
}
