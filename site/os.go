package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// OsBlocks lists the operating systems gallery in display order. The
// simulators live in static/js/os.js.
func OsBlocks() []Block {
	return []Block{
		osysSchedBlock(),
		osysStatesBlock(),
		osysPagingBlock(),
		osysReplaceBlock(),
		osysRaceBlock(),
		osysBankerBlock(),
		osysDiningBlock(),
		osysInodeBlock(),
		osysDiskBlock(),
		osysAllocBlock(),
		osysSyscallBlock(),
	}
}

// osysInput is a small numeric or text input in the house style (16px on
// phones, so iOS does not zoom).
func osysInput(attrs ...any) h.Node {
	return h.Input(append([]any{h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
		h.Class("h-8 rounded-md border border-input bg-background px-2 font-mono text-base tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")}, attrs...)...)
}

func osysButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func osysStepper() h.Node {
	return h.Div(h.Class("flex items-center justify-between gap-2"),
		osysButton("back", "Back", hugeicons.ArrowLeft01Icon()),
		h.Span(h.Data("out", "pos"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), "Next", hugeicons.ArrowRight01Icon()),
	)
}

// ---------------------------------------------------------------- O1

type osysProc struct{ arrival, burst, prio int }

var osysWorkload = []osysProc{{0, 8, 3}, {1, 4, 1}, {2, 9, 4}, {3, 5, 2}, {4, 2, 5}}

func osysSchedBlock() Block {
	return Block{
		Slug:        "scheduling",
		Title:       "CPU scheduling",
		Description: "Five processes, one CPU, six policies. The Gantt chart shows who runs when; the table gives each process's waiting, turnaround and response time. Shortest-job policies minimise average waiting; Round Robin trades it for response time; a long job first causes the convoy effect.",
		Tags:        []string{"Gantt chart", "FCFS · SJF · RR · MLFQ", "metrics"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-sched",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("gantt", ""), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Gantt chart of the schedule")),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[520px] text-sm"),
							h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "Process"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "Arrival"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "Burst"),
								h.Th(h.Class("py-1.5 pr-2 font-normal"), "Priority"),
								h.Th(h.Class("py-1.5 pr-2 text-right font-normal"), "Waiting"),
								h.Th(h.Class("py-1.5 pr-2 text-right font-normal"), "Turnaround"),
								h.Th(h.Class("py-1.5 text-right font-normal"), "Response"),
							)),
							h.Tbody(h.MapIdx(osysWorkload, func(i int, p osysProc) h.Node {
								cell := func(k string, v int) h.Node {
									return h.Td(h.Class("py-1 pr-2"), osysInput(h.Type("number"), h.Attr("min", "0"), h.Attr("max", "40"), h.Value(fmt.Sprint(v)),
										h.Data("proc", fmt.Sprint(i)), h.Data("k", k), h.Class("w-16"), h.Aria("label", fmt.Sprintf("P%d %s", i+1, k))))
								}
								return h.Tr(h.Class("border-b last:border-b-0"),
									h.Td(h.Class("py-1 pr-2"), h.Span(h.Class("flex items-center gap-2 font-mono text-xs"),
										h.Span(h.Data("swatch", fmt.Sprint(i)), h.Class("size-2.5 rounded-sm")), fmt.Sprintf("P%d", i+1))),
									cell("arrival", p.arrival), cell("burst", p.burst), cell("prio", p.prio),
									h.Td(h.Data("out", fmt.Sprintf("w%d", i)), h.Class("py-1 pr-2 text-right font-mono text-xs tabular-nums"), "—"),
									h.Td(h.Data("out", fmt.Sprintf("t%d", i)), h.Class("py-1 pr-2 text-right font-mono text-xs tabular-nums"), "—"),
									h.Td(h.Data("out", fmt.Sprintf("r%d", i)), h.Class("py-1 text-right font-mono text-xs tabular-nums"), "—"),
								)
							})),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Policy"),
					segs("Scheduling policy", [2]string{"fcfs", "FCFS"}, [2]string{"sjf", "SJF"}, [2]string{"srtf", "SRTF"},
						[2]string{"rr", "RR"}, [2]string{"prio", "Priority"}, [2]string{"mlfq", "MLFQ"}),
					field("quantum", "Quantum", "ms", 2, 1, 8, 1),
					h.P(h.Data("out", "policy"), h.Class("text-xs leading-relaxed text-muted-foreground"), "—"),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					osysButton("convoy", "Convoy effect", hugeicons.FlashIcon()),
					osysButton("reset", "Default workload", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"avg waiting", "aw"}, [2]string{"avg turnaround", "at"}, [2]string{"avg response", "ar"}, [2]string{"context switches", "cs"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O2

type osysStateStep struct {
	pid, from, to, label, text string
}

var osysStateSteps = []osysStateStep{
	{"A", "", "new", "create", "Process A is created: the kernel allocates its PCB and address space."},
	{"A", "new", "ready", "admit", "A is admitted to the ready queue."},
	{"A", "ready", "running", "dispatch", "The scheduler dispatches A: its registers are loaded and it runs on the CPU."},
	{"B", "", "new", "create", "Process B is created while A runs."},
	{"B", "new", "ready", "admit", "B is admitted and waits in the ready queue."},
	{"A", "running", "ready", "timeout", "A's time slice ends (timer interrupt): it goes back to ready."},
	{"B", "ready", "running", "dispatch", "Context switch: A's state is saved in its PCB, B's is restored, and B runs."},
	{"B", "running", "blocked", "I/O wait", "B calls read() on a disk file: it blocks until the data arrives."},
	{"A", "ready", "running", "dispatch", "The CPU is free, so A is dispatched again (another context switch)."},
	{"B", "blocked", "ready", "I/O done", "The disk interrupt completes B's read: B becomes ready (not running: A still has the CPU)."},
	{"A", "running", "terminated", "exit", "A calls exit(): it becomes a zombie until its parent collects the status."},
	{"B", "ready", "running", "dispatch", "B is dispatched."},
	{"B", "running", "terminated", "exit", "B exits. Both processes are done."},
}

func osysStatesBlock() Block {
	nodes := [][3]any{{"new", 70, 50}, {"ready", 230, 130}, {"running", 430, 130}, {"blocked", 330, 230}, {"terminated", 590, 50}}
	pos := map[string][2]int{}
	for _, n := range nodes {
		pos[n[0].(string)] = [2]int{n[1].(int), n[2].(int)}
	}
	edges := [][4]string{
		{"new", "ready", "admit", "0"}, {"ready", "running", "dispatch", "-18"}, {"running", "ready", "timeout", "18"},
		{"running", "blocked", "I/O wait", "0"}, {"blocked", "ready", "I/O done", "0"}, {"running", "terminated", "exit", "0"},
	}
	return Block{
		Slug:        "process-states",
		Title:       "Process states",
		Description: "The five-state model, followed one event at a time for two processes sharing one CPU. Every dispatch after another process ran is a context switch; a process waiting for I/O is blocked, and it only becomes ready, not running, when the I/O completes.",
		Tags:        []string{"state machine", "context switch", "stepper"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("os-states", ""), h.TabIndex(0),
				h.Aria("label", "Process states stepper; arrow keys step"),
				h.Svg(h.ViewBox("0 0 660 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Five-state process model"),
					h.El("defs", h.El("marker", h.ID("os-arrow"), h.Attr("viewBox", "0 0 10 10"), h.Attr("refX", "9"), h.Attr("refY", "5"),
						h.Attr("markerWidth", "6"), h.Attr("markerHeight", "6"), h.Attr("orient", "auto-start-reverse"),
						h.El("path", h.Attr("d", "M0 0 L10 5 L0 10 z"), h.Attr("fill", "currentColor")))),
					h.Map(edges, func(e [4]string) h.Node {
						a, b := pos[e[0]], pos[e[1]]
						var off int
						fmt.Sscan(e[3], &off)
						// Shorten the line so it ends at the node's edge.
						dx, dy := float64(b[0]-a[0]), float64(b[1]-a[1])
						l := osysHypot(dx, dy)
						ux, uy := dx/l, dy/l
						x1, y1 := float64(a[0])+ux*44, float64(a[1])+uy*22+float64(off)
						x2, y2 := float64(b[0])-ux*44, float64(b[1])-uy*22+float64(off)
						return h.El("g", h.Data("edge", e[0]+">"+e[1]), h.Class("text-muted-foreground/60 transition-colors duration-150 data-[on]:text-brand"),
							h.El("line", h.Attr("x1", fmt.Sprintf("%.1f", x1)), h.Attr("y1", fmt.Sprintf("%.1f", y1)), h.Attr("x2", fmt.Sprintf("%.1f", x2)), h.Attr("y2", fmt.Sprintf("%.1f", y2)),
								h.Attr("stroke", "currentColor"), h.Attr("stroke-width", "1.5"), h.Attr("marker-end", "url(#os-arrow)")),
							h.El("text", h.Attr("x", fmt.Sprintf("%.1f", (x1+x2)/2)), h.Attr("y", fmt.Sprintf("%.1f", (y1+y2)/2-6)), h.Attr("text-anchor", "middle"),
								h.Class("fill-current font-mono text-[10px]"), e[2]),
						)
					}),
					h.Map(nodes, func(n [3]any) h.Node {
						name := n[0].(string)
						x, y := n[1].(int), n[2].(int)
						return h.El("g", h.Data("node", name),
							h.Class("[&_rect]:fill-[var(--background)] [&_rect]:stroke-[var(--border)] data-[on]:[&_rect]:stroke-[var(--brand)] data-[on]:[&_text]:fill-[var(--brand)]"),
							h.El("rect", h.Attr("x", fmt.Sprint(x-44)), h.Attr("y", fmt.Sprint(y-20)), h.Attr("width", "88"), h.Attr("height", "40"), h.Attr("rx", "10"), h.Attr("stroke-width", "1.5")),
							h.El("text", h.Attr("x", fmt.Sprint(x)), h.Attr("y", fmt.Sprint(y-2)), h.Attr("text-anchor", "middle"), h.Class("fill-foreground text-[12px] font-medium"), name),
							h.El("text", h.Data("who", name), h.Attr("x", fmt.Sprint(x)), h.Attr("y", fmt.Sprint(y+12)), h.Attr("text-anchor", "middle"), h.Class("fill-muted-foreground font-mono text-[10px]"), ""),
						)
					}),
				),
				h.P(h.Data("out", "text"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-pretty"), "Press Next to create the first process."),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground"),
					h.Span("A: ", h.Span(h.Data("out", "A"), h.Class("text-foreground"), "—")),
					h.Span("B: ", h.Span(h.Data("out", "B"), h.Class("text-foreground"), "—")),
					h.Span("context switches: ", h.Span(h.Data("out", "cs"), h.Class("text-foreground"), "0")),
				),
				osysStepper(),
				h.Template(h.Data("steps", ""), h.Map(osysStateSteps, func(s osysStateStep) h.Node {
					return h.Div(h.Data("pid", s.pid), h.Data("from", s.from), h.Data("to", s.to), h.Data("text", s.text))
				})),
			)
		},
	}
}

func osysHypot(x, y float64) float64 {
	r := x*x + y*y
	// Newton's method keeps this file free of a math import for one call.
	g := r
	if g == 0 {
		return 0
	}
	for range 30 {
		g = 0.5 * (g + r/g)
	}
	return g
}

// ---------------------------------------------------------------- O3

func osysPagingBlock() Block {
	return Block{
		Slug:        "paging",
		Title:       "Paging and the TLB",
		Description: "A 14-bit virtual address is a 4-bit page number and a 10-bit offset (1 KiB pages). The TLB is checked first; on a miss the page table is walked, and an invalid entry is a page fault that loads the page into a free frame (or evicts the oldest). The offset passes through unchanged.",
		Tags:        []string{"address translation", "TLB", "page faults"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-paging",
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Data("bits", ""), h.Class("flex flex-col gap-1.5"), h.Aria("live", "polite")),
					h.Div(h.Class("grid gap-4 sm:grid-cols-[1fr_auto_auto]"),
						h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Page table"),
							h.Div(h.Data("pt", ""), h.Class("grid grid-cols-4 gap-1 font-mono text-[11px] sm:grid-cols-8"))),
						h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("TLB (LRU)"), h.Div(h.Data("tlb", ""), h.Class("flex flex-col gap-1 font-mono text-[11px]"))),
						h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Frames"), h.Div(h.Data("frames", ""), h.Class("flex flex-col gap-1 font-mono text-[11px]"))),
					),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Trace"), h.Div(h.Data("trace", ""), h.Class("flex flex-wrap gap-1 font-mono text-[11px]"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Translate"),
					h.Label(h.Class("flex items-center justify-between gap-3 text-sm"), h.Span(h.Class("text-muted-foreground"), "Virtual address"),
						osysInput(h.Type("text"), h.Data("va", ""), h.Value("0x0C2A"), h.Class("w-24 text-right"), h.Aria("label", "Virtual address in hex"))),
					osysButton("translate", "Translate", hugeicons.ArrowRight01Icon()),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					osysButton("step", "Next in trace", hugeicons.ArrowRight01Icon()),
					osysButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"TLB hits", "hits"}, [2]string{"TLB misses", "misses"}, [2]string{"page faults", "faults"}, [2]string{"last", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O4

func osysReplaceBlock() Block {
	return Block{
		Slug:        "page-replacement",
		Title:       "Page replacement",
		Description: "Which page to evict when memory is full. OPT (evict the page used furthest in the future) is the unreachable ideal; LRU approximates it; Clock approximates LRU with one bit per frame. FIFO can even get worse with more frames: on the classic string it faults 9 times with 3 frames and 10 times with 4 (Belady's anomaly).",
		Tags:        []string{"FIFO · LRU · OPT · Clock", "Belady's anomaly"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-replace",
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Data("grid", ""), h.Class("scroll-thin overflow-x-auto")),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--foreground)", "FIFO"), legendSwatch("var(--brand)", "LRU"), legendSwatch("var(--vec-u)", "OPT")),
						h.Svg(h.Data("chart", ""), h.ViewBox("0 0 520 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Page faults against number of frames")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reference string"),
					osysInput(h.Type("text"), h.Data("refs", ""), h.Value("7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1"), h.Class("w-full"), h.Aria("label", "Reference string")),
					field("frames", "Frames", "", 3, 1, 7, 1),
					segs("Algorithm", [2]string{"fifo", "FIFO"}, [2]string{"lru", "LRU"}, [2]string{"opt", "OPT"}, [2]string{"clock", "Clock"}),
				),
				osysButton("belady", "Belady's string", hugeicons.FlashIcon()),
				readouts([2]string{"faults", "faults"}, [2]string{"hits", "hits"}, [2]string{"fault rate", "rate"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O5

func osysRaceBlock() Block {
	thread := func(id string) h.Node {
		return h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"), h.Data("thread", id),
			h.Div(h.Class("flex items-center justify-between gap-2"),
				h.Span(h.Class("text-sm font-medium"), "Thread "+id),
				h.Span(h.Class("font-mono text-xs text-muted-foreground"), "r = ", h.Span(h.Data("reg", id), h.Class("text-foreground"), "—")),
			),
			h.Ol(h.Data("code", id), h.Class("code flex flex-col")),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("run", id), "Step thread "+id, kbd.Kbd(h.Class("ml-auto"), map[string]string{"1": "1", "2": "2"}[id])),
		)
	}
	return Block{
		Slug:        "race-condition",
		Title:       "Race condition",
		Description: "counter++ is three instructions: load, add, store. Interleave two threads by hand and one increment can vanish (a lost update). A mutex makes the three instructions a critical section; then any interleaving gives 2. The random run counts how often each final value occurs.",
		Tags:        []string{"threads", "mutex", "interleavings"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("os-race", ""), h.TabIndex(0),
				h.Aria("label", "Race condition; keys 1 and 2 step the threads"),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"), thread("1"), thread("2")),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Div(h.Class("flex items-baseline gap-2"),
						h.Span(h.Class("text-sm text-muted-foreground"), "counter ="),
						h.Span(h.Data("out", "counter"), h.Class("font-mono text-2xl font-medium tabular-nums"), "0"),
						h.Span(h.Data("out", "verdict"), h.Class("text-xs text-muted-foreground"), ""),
					),
					toggle("os-race-mutex", "mutex", "Use a mutex", false),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					osysButton("reset", "Reset", hugeicons.RefreshIcon()),
					osysButton("random", "1,000 random runs", hugeicons.DiceIcon()),
				),
				h.Div(h.Data("hist", ""), h.Class("flex min-h-6 flex-wrap gap-2 font-mono text-xs text-muted-foreground"), h.Aria("live", "polite")),
			)
		},
	}
}

// ---------------------------------------------------------------- O6

func osysBankerBlock() Block {
	return Block{
		Slug:        "bankers-algorithm",
		Title:       "Deadlock avoidance: the banker's algorithm",
		Description: "The textbook example (Silberschatz, Operating System Concepts): five processes, resources A, B, C with 10, 5 and 7 instances. Need = Max − Allocation. A state is safe if some order lets every process finish; a request is granted only if the state after it is still safe.",
		Tags:        []string{"safe state", "deadlock", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-banker",
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Data("tables", ""), h.Class("scroll-thin overflow-x-auto")),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Safety check"),
						h.Div(h.Data("steps", ""), h.Class("flex flex-col gap-1 font-mono text-xs"), h.Aria("live", "polite"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Request"),
					h.Div(h.Class("flex flex-wrap items-center gap-2 text-sm"),
						h.Select(h.Data("req-p", ""), h.Aria("label", "Requesting process"),
							h.Class("h-8 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
							h.Range(5, func(i int) h.Node {
								return h.Option(h.Value(fmt.Sprint(i)), h.If(i == 1, h.Selected()), fmt.Sprintf("P%d", i))
							})),
						h.Map([]string{"A", "B", "C"}, func(r string) h.Node {
							return osysInput(h.Type("number"), h.Attr("min", "0"), h.Attr("max", "10"), h.Value(map[string]string{"A": "1", "B": "0", "C": "2"}[r]),
								h.Data("req", r), h.Class("w-14 text-right"), h.Aria("label", "Request of "+r))
						}),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						osysButton("request", "Request", hugeicons.ArrowRight01Icon()),
						osysButton("reset", "Reset", hugeicons.RefreshIcon()),
					),
					h.P(h.Data("out", "verdict"), h.Aria("live", "polite"), h.Class("min-h-10 text-xs leading-relaxed text-muted-foreground"), ""),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"1:1,0,2", "P1 asks (1,0,2)"}, {"4:3,3,0", "P4 asks (3,3,0)"}, {"0:0,2,0", "P0 asks (0,2,0)"}}, func(p [2]string) h.Node {
						return h.Button(h.Type("button"), h.Data("preset", p[0]),
							h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"), p[1])
					}),
				),
				readouts([2]string{"available", "avail"}, [2]string{"state", "state"}, [2]string{"safe sequence", "seq"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O7

func osysDiningBlock() Block {
	return Block{
		Slug:        "dining-philosophers",
		Title:       "Dining philosophers",
		Description: "Five philosophers, five forks, each needing both neighbours' forks to eat (Dijkstra's problem, 1965). If everyone grabs the left fork first, they can all hold one and wait forever: a circular wait. Taking the lower-numbered fork first, or letting at most four sit down, breaks the cycle.",
		Tags:        []string{"deadlock", "circular wait", "simulation"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("os-dining", ""),
				h.Div(h.Class("grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_220px]"),
					h.Svg(h.Data("table", ""), h.ViewBox("-150 -150 300 300"), h.Class("mx-auto block w-full max-w-[320px]"), h.Role("img"), h.Aria("label", "Philosophers around the table")),
					h.Div(h.Class("flex flex-col gap-3"),
						segs("Strategy", [2]string{"naive", "Left first"}, [2]string{"ordered", "Ordered"}, [2]string{"waiter", "Waiter"}),
						h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), osysButton("hungry", "All hungry", hugeicons.FlashIcon())),
						osysButton("reset", "Reset", hugeicons.RefreshIcon()),
						h.P(h.Data("out", "status"), h.Aria("live", "polite"), h.Class("min-h-10 text-xs leading-relaxed text-muted-foreground"), ""),
					),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground"),
					h.Span("meals: ", h.Span(h.Data("out", "meals"), h.Class("text-foreground"), "—")),
					h.Span("tick: ", h.Span(h.Data("out", "tick"), h.Class("text-foreground"), "0")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- O8

func osysInodeBlock() Block {
	return Block{
		Slug:        "inode",
		Title:       "Inodes and file size",
		Description: "A Unix inode (ext2-style) holds 12 direct block pointers, then a single, a double and a triple indirect pointer. With B-byte blocks and 4-byte pointers, an indirect block holds k = B/4 pointers, so the largest file is (12 + k + k² + k³)·B bytes. Pick a byte offset to see which pointers the kernel follows to reach it.",
		Tags:        []string{"inode", "indirect blocks", "max file size"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-inode",
				h.Svg(h.Data("diagram", ""), h.ViewBox("0 0 620 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Inode block pointers")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("File system"),
					segs("Block size", [2]string{"1024", "1 KiB"}, [2]string{"2048", "2 KiB"}, [2]string{"4096", "4 KiB"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Look up a byte"),
					h.Label(h.Class("flex items-center justify-between gap-3 text-sm"), h.Span(h.Class("text-muted-foreground"), "Offset"),
						h.Span(h.Class("flex items-center gap-1"),
							osysInput(h.Type("number"), h.Attr("min", "0"), h.Data("offset", ""), h.Value("300"), h.Class("w-24 text-right"), h.Aria("label", "Offset")),
							h.Select(h.Data("unit", ""), h.Aria("label", "Unit"),
								h.Class("h-8 rounded-md border border-input bg-background px-1 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
								h.Option(h.Value("1"), "B"), h.Option(h.Value("1024"), h.Selected(), "KiB"), h.Option(h.Value("1048576"), "MiB"), h.Option(h.Value("1073741824"), "GiB")))),
				),
				readouts([2]string{"pointers / block", "k"}, [2]string{"max file", "max"}, [2]string{"logical block", "lb"}, [2]string{"path", "path"}, [2]string{"disk reads", "reads"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "This is the pointer-structure limit. Real file systems can hit other limits first: ext2 with 4 KiB blocks stops at 2 TiB because i_blocks counts 512-byte sectors in 32 bits."),
			)
		},
	}
}

// ---------------------------------------------------------------- O9

func osysDiskBlock() Block {
	return Block{
		Slug:        "disk-scheduling",
		Title:       "Disk scheduling",
		Description: "The textbook queue (Silberschatz): head at cylinder 53 of 0–199, requests 98, 183, 37, 122, 14, 124, 65, 67. FCFS moves the head 640 cylinders; SSTF serves the nearest next (236, but can starve far requests); SCAN sweeps like an elevator; C-SCAN and C-LOOK return to the start to give uniform waits.",
		Tags:        []string{"FCFS · SSTF · SCAN · LOOK", "seek distance"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-disk",
				h.Svg(h.Data("chart", ""), h.ViewBox("0 0 600 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Head movement over time")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Queue"),
					osysInput(h.Type("text"), h.Data("queue", ""), h.Value("98 183 37 122 14 124 65 67"), h.Class("w-full"), h.Aria("label", "Request queue")),
					field("head", "Head starts at", "", 53, 0, 199, 1),
					segs("Algorithm", [2]string{"fcfs", "FCFS"}, [2]string{"sstf", "SSTF"}, [2]string{"scan", "SCAN"},
						[2]string{"cscan", "C-SCAN"}, [2]string{"look", "LOOK"}, [2]string{"clook", "C-LOOK"}),
					toggle("os-disk-up", "up", "Sweep toward 199", false),
					toggle("os-disk-jump", "jump", "Count the return jump", true),
				),
				readouts([2]string{"total movement", "total"}, [2]string{"order", "order"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O10

func osysAllocBlock() Block {
	return Block{
		Slug:        "memory-allocation",
		Title:       "Contiguous allocation",
		Description: "A 1,000 KB heap serving a script of allocations and frees. First fit takes the first hole that is big enough, best fit the smallest, worst fit the largest, next fit continues from the last allocation. The free memory can be plenty in total yet split into holes too small for a request: external fragmentation.",
		Tags:        []string{"first · best · worst fit", "fragmentation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("os-alloc",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("bar", ""), h.Class("relative h-14 overflow-hidden rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Memory map")),
					h.Div(h.Data("script", ""), h.Class("flex flex-wrap gap-1 font-mono text-[11px]")),
					h.P(h.Data("out", "event"), h.Aria("live", "polite"), h.Class("min-h-5 text-sm"), ""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Policy"),
					segs("Placement policy", [2]string{"first", "First"}, [2]string{"best", "Best"}, [2]string{"worst", "Worst"}, [2]string{"next", "Next"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					osysButton("step", "Step", hugeicons.ArrowRight01Icon()),
					osysButton("run", "Run all", hugeicons.PlayIcon()),
					h.Div(h.Class("col-span-2"), osysButton("reset", "Reset", hugeicons.RefreshIcon())),
				),
				readouts([2]string{"free", "free"}, [2]string{"largest hole", "largest"}, [2]string{"holes", "holes"}, [2]string{"failed", "failed"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O11

type osysCallStep struct {
	lane, title, text string
	miss              bool // only on a page-cache miss
}

var osysCallSteps = []osysCallStep{
	{"user", "n = read(fd, buf, 4096)", "The program calls read() in the C library, an ordinary function call in user mode.", false},
	{"user", "libc wrapper", "The wrapper puts the system-call number for read and the three arguments in registers, then executes the syscall instruction.", false},
	{"boundary", "trap into the kernel", "The CPU switches to kernel mode and jumps to the kernel's entry point; the user's registers are saved.", false},
	{"kernel", "system-call dispatch", "The kernel looks up the handler for this number in its system-call table and calls sys_read.", false},
	{"kernel", "file descriptor → file", "fd indexes the process's file-descriptor table; the open file gives the inode and the current offset.", false},
	{"kernel", "VFS and page cache", "The virtual file system asks the page cache for the pages covering the offset.", false},
	{"device", "disk I/O", "Page-cache miss: the file system maps the offset to a disk block and submits a read request to the driver.", true},
	{"kernel", "process sleeps", "The process is blocked; the scheduler runs something else while the disk works.", true},
	{"device", "interrupt", "The disk finishes and raises an interrupt; the handler marks the page up to date and wakes the process.", true},
	{"kernel", "copy_to_user", "The bytes are copied from the page cache into the user's buffer, checking that buf is a valid user address.", false},
	{"boundary", "return to user mode", "The return value (bytes read, or −1 with errno) goes in a register and the CPU drops back to user mode.", false},
	{"user", "n holds the result", "read() returns in the program; the file offset has advanced by n.", false},
}

func osysSyscallBlock() Block {
	return Block{
		Slug:        "system-call",
		Title:       "Anatomy of a system call",
		Description: "What happens between a program's read() and its return, step by step across the user/kernel boundary. With the data already in the page cache it never touches the disk; on a miss the process sleeps until the disk interrupt wakes it.",
		Tags:        []string{"user / kernel mode", "trap", "page cache"},
		Render: func() h.Node {
			lanes := []string{"user", "boundary", "kernel", "device"}
			names := map[string]string{"user": "User mode", "boundary": "Mode switch", "kernel": "Kernel mode", "device": "Device"}
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("os-syscall", ""), h.TabIndex(0),
				h.Aria("label", "System call stepper; arrow keys step"),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					h.Span(h.Class("text-sm font-medium"), "read() of a file"),
					toggle("os-syscall-miss", "miss", "Page-cache miss", false),
				),
				h.Div(h.Class("grid gap-1.5"),
					h.Map(lanes, func(l string) h.Node {
						return h.Div(h.Class("grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2"),
							h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), names[l]),
							h.Div(h.Data("lane", l), h.Class("flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-dashed p-1 "+
								h.Ternary(l == "boundary", "bg-brand/5", "bg-code"))),
						)
					}),
				),
				h.P(h.Data("out", "text"), h.Aria("live", "polite"), h.Class("min-h-12 text-sm leading-relaxed text-pretty"), ""),
				osysStepper(),
				h.Template(h.Data("steps", ""), h.Map(osysCallSteps, func(s osysCallStep) h.Node {
					return h.Div(h.Data("lane", s.lane), h.Data("title", s.title), h.Data("text", s.text), h.If(s.miss, h.Data("miss", "")))
				})),
			)
		},
	}
}
