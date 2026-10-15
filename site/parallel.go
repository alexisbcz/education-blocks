package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ParallelBlocks lists the parallel computing gallery in display order.
// The models live in static/js/parallel.js; the Web Workers demo runs its
// work in static/js/parallel-worker.js.
func ParallelBlocks() []Block {
	return []Block{
		parScalingBlock(),
		parWorkSpanBlock(),
		parScanBlock(),
		parReductionBlock(),
		parStealingBlock(),
		parDivergenceBlock(),
		parCoalescingBlock(),
		parRooflineBlock(),
		parFalseSharingBlock(),
		parWorkersBlock(),
	}
}

// parSVG is the picture area of a parallel block.
func parSVG(name, viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full"), h.Role("img"), h.Aria("label", label))
}

// parNote is the small explanatory line under a picture, rewritten live.
func parNote(text string) h.Node {
	return h.P(h.Data("out", "note"), h.Class("min-h-4 text-xs leading-relaxed text-pretty text-muted-foreground"), text)
}

func parButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- P1

func parScalingBlock() Block {
	return Block{
		Slug:        "scaling",
		Title:       "Strong and weak scaling",
		Description: "Amdahl fixes the problem and adds cores: the serial part s caps the speedup at 1/s. Gustafson lets the problem grow with the machine, so the parallel part grows too and the scaled speedup s + (1 − s)·n keeps climbing. Same code, two questions.",
		Tags:        []string{"Amdahl", "Gustafson", "efficiency"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-scaling",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("speedup", "0 0 560 300", "Speedup against cores under strong and weak scaling"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-i)", "Amdahl (fixed problem)"),
						legendSwatch("var(--vec-j)", "Gustafson (problem grows with n)"),
						legendSwatch("currentColor", "ideal n"),
					),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Program"),
					field("s", "Serial part s", "%", 5, 0, 60, 0.5),
					field("n", "Cores n", "", 64, 1, 1024, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Plot"),
					segs("Plot", [2]string{"speedup", "Speedup"}, [2]string{"efficiency", "Efficiency"}),
				),
				readouts([2]string{"Amdahl", "amdahl"}, [2]string{"Gustafson", "gustafson"}, [2]string{"efficiency", "eff"}, [2]string{"limit 1/s", "limit"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func parWorkSpanBlock() Block {
	return Block{
		Slug:        "work-span",
		Title:       "Work, span and Brent's bound",
		Description: "A parallel program is a DAG of tasks. Work T₁ is the total time on one core, span T∞ the longest path. No schedule on p cores beats max(T₁/p, T∞), and any greedy one finishes within T₁/p + T∞ (Brent). The Gantt chart is a greedy schedule, with the critical path in pink.",
		Tags:        []string{"DAG", "critical path", "greedy scheduling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-workspan",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("dag", "0 0 560 230", "Task graph"),
					parSVG("gantt", "0 0 560 170", "Greedy schedule on p processors"),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Program"),
					segs("Task graph", [2]string{"reduce", "Tree sum"}, [2]string{"forkjoin", "Fork–join"}, [2]string{"chain", "Chain"}, [2]string{"random", "Random"}),
					parButton("reroll", "New random DAG", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Machine"),
					field("p", "Processors p", "", 3, 1, 16, 1),
				),
				readouts([2]string{"work T₁", "t1"}, [2]string{"span T∞", "tinf"}, [2]string{"parallelism", "par"}, [2]string{"greedy Tₚ", "tp"}, [2]string{"lower bound", "lower"}, [2]string{"Brent bound", "brent"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func parScanBlock() Block {
	return Block{
		Slug:        "prefix-scan",
		Title:       "Parallel prefix sum",
		Description: "A running total looks hopelessly sequential, yet it takes only log n parallel steps. Hillis–Steele adds at distance 1, 2, 4… and does n log n work. Blelloch sweeps up a tree and back down: 2 log n steps but only about 2n additions, which is what a GPU wants.",
		Tags:        []string{"scan", "Hillis–Steele", "Blelloch"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("par-scan", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					segs("Algorithm", [2]string{"hillis", "Hillis–Steele (inclusive)"}, [2]string{"blelloch", "Blelloch (exclusive)"}),
					segs("Size", [2]string{"8", "n = 8"}, [2]string{"16", "n = 16"}),
					h.Div(h.Class("flex-1")),
					parButton("prev", "Back", hugeicons.ArrowLeft01Icon()),
					parButton("next", "Step", hugeicons.ArrowRight01Icon()),
					parButton("random", "New input", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto rounded-lg border bg-code p-3"),
					h.Div(h.Class("min-w-[560px]"), parSVG("scan", "0 0 640 300", "Prefix sum steps")),
				),
				h.Div(h.Class("flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs"),
					h.Span(h.Span(h.Class("text-muted-foreground"), "step "), h.Span(h.Data("out", "step"), "—")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "additions so far "), h.Span(h.Data("out", "adds"), "—")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "sequential scan "), h.Span(h.Data("out", "seq"), "—")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "check "), h.Span(h.Data("out", "check"), "—")),
				),
				parNote(""),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func parReductionBlock() Block {
	return Block{
		Slug:        "reduction-order",
		Title:       "Reductions and the order of addition",
		Description: "Floating-point addition is not associative, so a parallel sum depends on how the work was split. The same numbers summed left to right, as a tree, in 4 or 8 chunks, or sorted give different answers. The exact sum is computed with error-free transformations.",
		Tags:        []string{"reduction", "rounding", "reproducibility"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-reduction",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("tree", "0 0 560 196", "Pairwise reduction tree over the first 16 values"),
					h.Div(h.Data("table", ""), h.Class("overflow-x-auto")),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Numbers"),
					segs("Data", [2]string{"mixed", "Mixed sizes"}, [2]string{"big", "One huge + many small"}, [2]string{"cancel", "Cancelling"}),
					field("n", "How many", "", 4096, 16, 65536, 16),
					parButton("shuffle", "Shuffle the order", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Precision"),
					segs("Precision", [2]string{"f32", "float32"}, [2]string{"f64", "float64"}),
				),
				readouts([2]string{"distinct results", "distinct"}, [2]string{"worst error", "worst"}, [2]string{"spread", "spread"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func parStealingBlock() Block {
	return Block{
		Slug:        "work-stealing",
		Title:       "Static partitioning versus work stealing",
		Description: "Splitting a loop into p equal blocks is free, but if iterations cost different amounts some cores finish early and wait. A shared queue balances the load at the price of contention; work stealing keeps a deque per core and lets idle cores take half of a random victim's work.",
		Tags:        []string{"load balancing", "deques", "Gantt"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-stealing",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("costs", "0 0 560 90", "Cost of each task"),
					parSVG("gantt", "0 0 560 210", "Schedule"),
					h.Div(h.Data("table", ""), h.Class("overflow-x-auto")),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Tasks"),
					segs("Task costs", [2]string{"uniform", "Uniform"}, [2]string{"ramp", "Ramp"}, [2]string{"heavy", "Heavy tail"}),
					field("tasks", "Tasks", "", 96, 8, 400, 8),
					parButton("reroll", "New costs", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scheduler"),
					segs("Strategy", [2]string{"block", "Blocks"}, [2]string{"cyclic", "Cyclic"}, [2]string{"queue", "Queue"}, [2]string{"steal", "Stealing"}),
					field("p", "Workers", "", 6, 2, 16, 1),
					field("overhead", "Queue/steal cost", "units", 0.2, 0, 5, 0.1),
				),
				readouts([2]string{"makespan", "makespan"}, [2]string{"ideal T₁/p", "ideal"}, [2]string{"idle", "idle"}, [2]string{"steals", "steals"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

func parDivergenceBlock() Block {
	return Block{
		Slug:        "divergence",
		Title:       "Warps and branch divergence",
		Description: "A GPU runs threads in warps of 32 that share one instruction stream (SIMT). When lanes disagree on a branch, the warp runs both sides one after the other with the other lanes masked off. Branching on the warp index costs nothing; branching on the lane index halves the speed.",
		Tags:        []string{"GPU", "SIMT", "masking"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-divergence",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("lanes", "0 0 560 250", "Lanes of four warps over time"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-i)", "if branch"),
						legendSwatch("var(--vec-j)", "else branch"),
						legendSwatch("currentColor", "masked (idle lane)"),
					),
					h.Pre(h.Data("out", "code"), h.Class("rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre")),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Branch condition"),
					segs("Condition", [2]string{"warp", "warp % 2"}, [2]string{"half", "lane < 16"}, [2]string{"odd", "lane odd"}, [2]string{"data", "data > t"}),
					field("prob", "P(data > t)", "%", 10, 0, 100, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cost in instructions"),
					field("a", "if body", "", 20, 1, 100, 1),
					field("b", "else body", "", 20, 0, 100, 1),
				),
				readouts([2]string{"cycles (4 warps)", "cycles"}, [2]string{"no divergence", "best"}, [2]string{"SIMT efficiency", "eff"}, [2]string{"divergent warps", "div"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func parCoalescingBlock() Block {
	return Block{
		Slug:        "coalescing",
		Title:       "Memory coalescing",
		Description: "When the 32 threads of a warp load memory, the hardware gathers their addresses into 32-byte sectors. Neighbouring threads reading neighbouring words need 4 sectors for 128 bytes; a stride spreads the same 128 useful bytes over up to 32 sectors and wastes most of the bandwidth.",
		Tags:        []string{"GPU", "sectors", "AoS vs SoA"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-coalescing",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("memory", "0 0 560 230", "Thread addresses mapped onto memory sectors"),
					h.Pre(h.Data("out", "code"), h.Class("rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre")),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Access pattern"),
					segs("Pattern", [2]string{"soa", "SoA x[i]"}, [2]string{"aos", "AoS p[i].x"}, [2]string{"stride", "Stride"}, [2]string{"random", "Gather"}),
					field("stride", "Stride", "words", 2, 1, 32, 1),
					field("offset", "Misalignment", "words", 0, 0, 7, 1),
				),
				readouts([2]string{"useful bytes", "useful"}, [2]string{"sectors (32 B)", "sectors"}, [2]string{"bytes moved", "moved"}, [2]string{"efficiency", "eff"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func parRooflineBlock() Block {
	return Block{
		Slug:        "roofline",
		Title:       "The roofline model",
		Description: "A kernel's speed is capped by compute or by memory: attainable FLOP/s = min(peak, intensity × bandwidth), where intensity is flops per byte moved from memory. Below the ridge point a faster chip does not help; tiling a matrix multiply raises its intensity and moves it to the right.",
		Tags:        []string{"arithmetic intensity", "bandwidth", "tiling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-roofline",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("roof", "0 0 560 320", "Roofline: attainable performance against arithmetic intensity"),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Machine"),
					segs("Machine", [2]string{"laptop", "Laptop CPU"}, [2]string{"server", "Server CPU"}, [2]string{"gpu", "GPU"}),
					field("peak", "Peak (FP64)", "GFLOP/s", 400, 10, 50000, 10),
					field("bw", "Bandwidth", "GB/s", 60, 5, 5000, 5),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Matrix multiply"),
					field("tile", "Tile size b", "", 32, 1, 256, 1),
				),
				readouts([2]string{"ridge point", "ridge"}, [2]string{"tiled matmul AI", "ai"}, [2]string{"tiled matmul", "mm"}, [2]string{"bound", "bound"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

func parFalseSharingBlock() Block {
	return Block{
		Slug:        "false-sharing",
		Title:       "False sharing",
		Description: "Each thread increments its own counter, no data is shared, yet it runs slower with more threads. The counters sit in one 64-byte cache line, and a core must own the whole line to write it, so the line ping-pongs between cores. Padding each counter to its own line fixes it.",
		Tags:        []string{"cache lines", "coherence", "padding"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-falseshare",
				h.Div(h.Class("flex flex-col gap-3"),
					parSVG("cores", "0 0 560 176", "Cores, caches and counters in cache lines"),
					parSVG("throughput", "0 0 560 210", "Increments per microsecond against threads"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-i)", "padded (one line each)"),
						legendSwatch("var(--vec-u)", "packed (false sharing)"),
						legendSwatch("var(--code-del)", "one shared atomic"),
					),
					parNote(""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Layout"),
					segs("Layout", [2]string{"packed", "Packed"}, [2]string{"padded", "Padded"}, [2]string{"shared", "Shared counter"}),
					field("threads", "Threads", "", 4, 1, 8, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Costs"),
					field("hit", "Local write", "ns", 1, 0.5, 10, 0.5),
					field("miss", "Line transfer", "ns", 60, 5, 200, 5),
				),
				h.Div(h.Class("grid grid-cols-1"), playPauseLabel("Run")),
				readouts([2]string{"line transfers", "transfers"}, [2]string{"throughput", "rate"}, [2]string{"vs padded", "ratio"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P10

func parWorkersBlock() Block {
	return Block{
		Slug:        "web-workers",
		Title:       "Real threads: Web Workers",
		Description: "Not a simulation: this renders the Mandelbrot set with 1 to n Web Workers on your own machine and measures the wall-clock time. The rows inside the set cost far more than the rest, so a split into equal blocks leaves workers idle; handing out small chunks keeps them busy.",
		Tags:        []string{"Web Workers", "speedup", "measured"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("par-workers",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("relative mx-auto w-full max-w-[560px] overflow-hidden rounded-lg border bg-background"),
						h.Canvas(h.Data("canvas", ""), h.Width("560"), h.Height("320"), h.Class("block h-auto w-full"), h.Aria("label", "Mandelbrot set coloured by the worker that computed each row"), h.Role("img")),
					),
					parSVG("speedup", "0 0 560 220", "Measured speedup against workers"),
					parNote("Press Run to time it on this device."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Split"),
					segs("Split", [2]string{"blocks", "Equal blocks"}, [2]string{"chunks", "Chunks on demand"}),
					field("workers", "Workers", "", 4, 1, 32, 1),
					field("iter", "Max iterations", "", 2000, 100, 10000, 100),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					parButton("run", "Run", hugeicons.PlayIcon()),
					parButton("sweep", "Sweep 1…n", hugeicons.DashboardSpeed01Icon()),
				),
				toggle("par-tint", "tint", "Colour rows by worker", true),
				readouts([2]string{"cores reported", "cores"}, [2]string{"wall time", "time"}, [2]string{"speedup", "speedup"}, [2]string{"busiest / idlest", "balance"}),
			)
		},
	}
}
