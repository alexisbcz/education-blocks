package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/checkbox"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/tooltip"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ---------------------------------------------------------------- N2

func neuronAnatomyBlock() Block {
	return Block{
		Slug:        "neuron-anatomy",
		Title:       "Neuron anatomy",
		Description: "A labelled diagram without labels in the way: point at a part (or tab through them) and its name and role appear beside the drawing, with the direction signals travel.",
		Tags:        []string{"SVG", "hover", "keyboard"},
		Wide:        true,
		Render:      neuronAnatomy,
	}
}

type part struct {
	key, name, role, fact string
}

var neuronParts = []part{
	{"dendrites", "Dendrites", "Branched processes that receive synaptic input and carry graded potentials toward the soma.", "A pyramidal neuron can receive over 10,000 synapses on its dendritic tree."},
	{"soma", "Soma", "The cell body. It holds the nucleus and most organelles, and sums the currents arriving from the dendrites.", "Soma diameters range from about 5 to over 50 µm."},
	{"nucleus", "Nucleus", "Holds the cell's DNA; transcription happens here, translation mostly in the soma's rough ER (Nissl bodies).", "Neurons are post-mitotic: most never divide again."},
	{"hillock", "Axon hillock and initial segment", "Where the soma narrows into the axon. The initial segment just beyond it is packed with voltage-gated Na⁺ channels, so action potentials usually start here.", "It is the neuron's decision point: threshold is lowest here."},
	{"axon", "Axon", "Carries action potentials away from the soma, without decrement, to the terminals.", "Motor axons running down the leg can be about a metre long."},
	{"myelin", "Myelin sheath", "Insulating wraps made by oligodendrocytes in the brain and spinal cord, and by Schwann cells in peripheral nerves.", "Myelinated axons conduct at up to about 120 m/s."},
	{"node", "Node of Ranvier", "Short gaps between myelin segments, dense in Na⁺ channels, where the action potential is regenerated: conduction jumps from node to node (saltatory conduction).", "Each node is only about 1 µm long."},
	{"terminals", "Axon terminals", "Boutons where the arriving spike opens Ca²⁺ channels, triggering exocytosis of neurotransmitter into the synaptic cleft.", "Release takes well under a millisecond after Ca²⁺ entry."},
}

// neuronSVG is a stylised neuron in one 760×240 drawing. Each part is a
// group with data-part, focusable, so pointer and keyboard both work.
func neuronSVG() h.Node {
	g := func(key string, children ...any) h.Node {
		var p part
		for _, x := range neuronParts {
			if x.key == key {
				p = x
			}
		}
		return h.El("g", append([]any{h.Data("part", key), h.TabIndex(0), h.Role("button"), h.Aria("label", p.name),
			h.Class("cursor-pointer outline-none [&_*]:transition-[stroke,fill,opacity] [&_*]:duration-150")}, children...)...)
	}
	path := func(d string, width float64, extra ...any) h.Node {
		return h.El("path", append([]any{h.Attr("d", d), h.Attr("fill", "none"), h.Attr("stroke-width", fmt.Sprint(width)),
			h.Attr("stroke-linecap", "round"), h.Attr("stroke-linejoin", "round"), h.Class("stroke-[var(--part)]")}, extra...)...)
	}
	// Myelin segments with nodes between them.
	var myelin, nodes []h.Node
	for i := range 6 {
		x := 236 + i*66
		myelin = append(myelin, h.El("rect", h.Attr("x", fmt.Sprint(x)), h.Attr("y", "111"), h.Attr("width", "54"), h.Attr("height", "18"), h.Attr("rx", "9"),
			h.Class("fill-[color-mix(in_oklab,var(--part)_14%,var(--code-bg))] stroke-[var(--part)]"), h.Attr("stroke-width", "1.5")))
		if i < 5 {
			nodes = append(nodes, h.El("rect", h.Attr("x", fmt.Sprint(x+56)), h.Attr("y", "114"), h.Attr("width", "8"), h.Attr("height", "12"), h.Attr("rx", "2"),
				h.Class("fill-transparent"))) // hit area
		}
	}
	boutons := [][2]float64{{712, 70}, {728, 104}, {732, 140}, {716, 178}}
	return h.Svg(h.ViewBox("0 0 760 240"), h.Class("block w-full [--part:color-mix(in_oklab,var(--foreground)_55%,transparent)] [&_[data-part]:is(:hover,:focus-visible,[data-on])]:[--part:var(--brand)]"),
		h.Role("group"), h.Aria("label", "Diagram of a neuron"),
		g("dendrites",
			path("M118 104 C96 86 78 70 52 58 M84 74 C76 56 70 44 66 26 M52 58 C38 54 26 52 14 46 M52 58 C42 66 30 74 22 88", 3),
			path("M116 138 C92 152 74 168 48 186 M72 166 C58 160 44 160 28 156 M48 186 C40 198 34 208 30 222 M48 186 C34 190 22 196 12 204", 3),
			path("M132 98 C128 76 132 56 140 34 M136 58 C148 50 158 40 166 28", 3),
			path("M134 162 C130 182 134 198 142 216", 3),
			// Spines: little stubs along one dendrite.
			path("M70 64 l-4 -6 M60 62 l-2 -7 M40 54 l-1 -7 M28 52 l0 -7", 2),
		),
		g("soma",
			h.El("path", h.Attr("d", "M120 102 C134 86 168 88 182 104 C194 118 194 142 182 156 C168 172 134 174 120 158 C108 144 108 116 120 102 Z"),
				h.Class("fill-[color-mix(in_oklab,var(--part)_10%,var(--code-bg))] stroke-[var(--part)]"), h.Attr("stroke-width", "2")),
		),
		g("nucleus",
			h.El("circle", h.Attr("cx", "150"), h.Attr("cy", "130"), h.Attr("r", "13"),
				h.Class("fill-[color-mix(in_oklab,var(--part)_22%,var(--code-bg))] stroke-[var(--part)]"), h.Attr("stroke-width", "1.5")),
			h.El("circle", h.Attr("cx", "154"), h.Attr("cy", "126"), h.Attr("r", "3.5"), h.Class("fill-[var(--part)]")),
		),
		g("hillock",
			h.El("path", h.Attr("d", "M186 118 L222 126 L222 134 L186 142 Z"),
				h.Class("fill-[color-mix(in_oklab,var(--part)_10%,var(--code-bg))] stroke-[var(--part)]"), h.Attr("stroke-width", "1.5")),
		),
		g("axon", path("M222 130 L640 130", 4)),
		g("myelin", h.Group(myelin)),
		g("node",
			h.Group(nodes),
			h.Map([]int{0, 1, 2, 3, 4}, func(i int) h.Node {
				x := 236 + i*66 + 60
				return h.El("circle", h.Attr("cx", fmt.Sprint(x)), h.Attr("cy", "130"), h.Attr("r", "3"), h.Class("fill-[var(--part)]"))
			}),
		),
		g("terminals",
			path("M640 130 C664 128 680 100 704 74 M640 130 C670 128 700 112 720 104 M640 130 C672 132 702 138 724 140 M640 130 C664 134 686 160 708 176", 2.5),
			h.Map(boutons, func(b [2]float64) h.Node {
				return h.El("circle", h.Attr("cx", fmt.Sprint(b[0])), h.Attr("cy", fmt.Sprint(b[1])), h.Attr("r", "7"),
					h.Class("fill-[color-mix(in_oklab,var(--part)_18%,var(--code-bg))] stroke-[var(--part)]"), h.Attr("stroke-width", "1.5"))
			}),
		),
		// Signal direction, under the axon.
		h.El("path", h.Attr("d", "M260 168 L600 168"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.3"), h.Attr("stroke-dasharray", "4 4")),
		h.El("path", h.Attr("d", "M594 163 L602 168 L594 173"), h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.4")),
		h.El("text", h.Attr("x", "430"), h.Attr("y", "186"), h.Attr("text-anchor", "middle"), h.Class("fill-muted-foreground font-mono text-[10px]"), "direction of the action potential"),
	)
}

func neuronAnatomy() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("anatomy-neuron", ""),
		h.Div(h.Class("flex items-center border-b bg-code p-4 lg:border-r lg:border-b-0"), neuronSVG()),
		h.Div(h.Class("flex flex-col gap-4 p-5"),
			h.Div(h.Data("info", ""), h.Aria("live", "polite"), h.Class("flex min-h-40 flex-col gap-2"),
				h.Span(h.Data("info-name", ""), h.Class("text-base font-semibold tracking-tight"), "Point at a part"),
				h.P(h.Data("info-role", ""), h.Class("text-sm leading-relaxed text-muted-foreground"), "Hover the drawing, or press Tab to step through the neuron from input to output."),
				h.P(h.Data("info-fact", ""), h.Class("flex gap-2 text-xs leading-relaxed text-muted-foreground empty:hidden")),
			),
			h.Div(h.Class("flex flex-wrap gap-1.5 border-t pt-4"),
				h.Map(neuronParts, func(p part) h.Node {
					return h.Button(h.Type("button"), h.Data("pick", p.key), h.Data("name", p.name), h.Data("role", p.role), h.Data("fact", p.fact),
						h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"),
						p.name)
				}),
			),
		),
	)
}

// ---------------------------------------------------------------- N7

func glossaryBlock() Block {
	return Block{
		Slug:        "glossary",
		Title:       "Inline glossary",
		Description: "Prose that explains its own jargon. Technical terms carry a dotted underline; hover or focus one for a short definition, without leaving the paragraph.",
		Tags:        []string{"tooltip", "reading"},
		Render:      glossary,
	}
}

func term(word, def string) h.Node {
	return tooltip.Tooltip(
		tooltip.Trigger(lib.AsChild, h.Button(h.Type("button"),
			h.Class("cursor-help rounded-sm font-medium text-foreground underline decoration-foreground/40 decoration-dotted underline-offset-4 outline-none transition-colors duration-150 hover:decoration-brand focus-visible:ring-2 focus-visible:ring-ring/50"),
			word)),
		tooltip.Content(h.Class("max-w-64 text-pretty"), def),
	)
}

func glossary() h.Node {
	return h.Div(h.Class("flex flex-col gap-4"),
		h.Div(h.Class("flex items-center gap-2"),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Lesson 4.1"),
			h.Span(h.Class("text-sm text-muted-foreground"), "Chemical synapses"),
		),
		h.P(h.Class("text-[17px] leading-8 text-pretty text-muted-foreground"),
			"When an action potential reaches the axon terminal, ",
			term("voltage-gated Ca²⁺ channels", "Channels that open when the membrane depolarizes, letting calcium flow into the terminal down its steep gradient."),
			" open. The rise in calcium triggers ",
			term("exocytosis", "Fusion of a vesicle's membrane with the cell membrane, which empties the vesicle's contents outside the cell."),
			" of ",
			term("synaptic vesicles", "Small membrane spheres, about 40 nm across, each filled with thousands of neurotransmitter molecules."),
			", releasing glutamate into the ",
			term("synaptic cleft", "The gap between the presynaptic terminal and the postsynaptic cell, roughly 20 nm wide."),
			". Glutamate binds ",
			term("AMPA receptors", "Ionotropic glutamate receptors: ligand-gated channels that let Na⁺ in (and K⁺ out), depolarizing the cell within a millisecond."),
			" on the postsynaptic membrane, producing an ",
			term("EPSP", "Excitatory postsynaptic potential: a small, graded depolarization that brings the membrane closer to threshold."),
			". Finally, ",
			term("excitatory amino acid transporters", "Pumps on neurons and astrocytes that take glutamate back up from the cleft, ending the signal."),
			" clear the cleft so the next signal starts clean.",
		),
	)
}

// ---------------------------------------------------------------- N8

func citationBlock() Block {
	return Block{
		Slug:        "citation",
		Title:       "Primary source",
		Description: "Science lessons point to the paper. A citation card with what the paper found and why it matters, its DOI, and ready-to-copy APA and BibTeX.",
		Tags:        []string{"citation", "copy", "tabs"},
		Render:      citation,
	}
}

const hhAPA = "Hodgkin, A. L., & Huxley, A. F. (1952). A quantitative description of membrane current and its application to conduction and excitation in nerve. The Journal of Physiology, 117(4), 500–544. https://doi.org/10.1113/jphysiol.1952.sp004764"

const hhBibTeX = `@article{hodgkin1952quantitative,
  title   = {A quantitative description of membrane current and its
             application to conduction and excitation in nerve},
  author  = {Hodgkin, A. L. and Huxley, A. F.},
  journal = {The Journal of Physiology},
  volume  = {117},
  number  = {4},
  pages   = {500--544},
  year    = {1952},
  doi     = {10.1113/jphysiol.1952.sp004764}
}`

func citation() h.Node {
	return h.Article(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs"),
		h.Div(h.Class("flex flex-col gap-3 p-5"),
			h.Div(h.Class("flex flex-wrap items-center gap-2 text-xs text-muted-foreground"),
				hugeicons.File02Icon(h.Class("size-4")),
				h.Span("The Journal of Physiology · 1952 · 117(4): 500–544"),
				badge.Badge(badge.VariantOutline, h.Class("gap-1 font-normal"), hugeicons.Award01Icon(h.Class("size-3")), "Nobel Prize 1963"),
			),
			h.H3(h.Class("text-lg leading-snug font-semibold tracking-tight text-balance"),
				"A quantitative description of membrane current and its application to conduction and excitation in nerve"),
			h.P(h.Class("text-sm text-muted-foreground"), "A. L. Hodgkin, A. F. Huxley"),
			h.Dl(h.Class("grid gap-3 pt-1 text-sm leading-relaxed sm:grid-cols-2"),
				h.Div(h.Class("rounded-lg border bg-code p-3"),
					h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Finding"),
					h.Dd("Voltage-clamp currents in the squid giant axon fit a model of separate Na⁺ and K⁺ conductances, gated by voltage-dependent variables m, h and n.")),
				h.Div(h.Class("rounded-lg border bg-code p-3"),
					h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Why it matters"),
					h.Dd("The model predicted the shape and speed of the action potential from first principles. The simulation in block 01 runs its equations.")),
			),
		),
		h.Div(h.Class("border-t bg-code-panel"),
			h.Div(h.Class("flex items-center gap-2 px-3 pt-2"),
				h.Div(h.Class("flex items-center gap-1 rounded-lg border bg-background p-0.5"), h.Role("tablist"), h.Aria("label", "Citation format"),
					segButton("apa", "APA", true),
					segButton("bibtex", "BibTeX", false),
				),
				h.Div(h.Class("flex-1")),
				button.Button(button.VariantOutline, button.SizeSm, lib.AsChild,
					h.A(h.Href("https://doi.org/10.1113/jphysiol.1952.sp004764"), h.Target("_blank"), hugeicons.LinkSquare02Icon(), "DOI")),
			),
			h.Div(h.Data("view", "apa"), h.Class("relative px-3 py-3"),
				h.P(h.Class("rounded-lg border bg-code py-3 pr-12 pl-3 text-[13px] leading-relaxed"), hhAPA),
				copyButton(hhAPA, "absolute top-5 right-5"),
			),
			h.Div(h.Data("view", "bibtex"), h.Hidden(), h.Class("relative px-3 py-3"),
				h.Pre(h.Class("code scroll-thin overflow-x-auto rounded-lg border bg-code p-3 text-[12px]"), hhBibTeX),
				copyButton(hhBibTeX, "absolute top-5 right-5"),
			),
		),
	)
}

// ---------------------------------------------------------------- N9

func flashcardsBlock() Block {
	return Block{
		Slug:        "flashcards",
		Title:       "Flashcards",
		Description: "Retrieval practice between lessons. Answer in your head, flip the card, then say how it went; cards you missed come back at the end of the deck.",
		Tags:        []string{"flip", "spaced recall", "kbd"},
		Render:      flashcards,
	}
}

type card struct{ q, a, note string }

var deck = []card{
	{"Which ion's influx drives the rising phase of the action potential?", "Na⁺", "Voltage-gated Na⁺ channels open, and Na⁺ rushes in toward E_Na ≈ +55 mV."},
	{"What does tetrodotoxin (TTX) block?", "Voltage-gated Na⁺ channels", "From the pufferfish; it abolishes action potentials but leaves the resting potential intact."},
	{"Roughly what is a typical neuron's resting membrane potential?", "About −70 mV", "Close to E_K, because at rest the membrane is mostly permeable to K⁺."},
	{"What causes the absolute refractory period?", "Na⁺ channel inactivation", "The h gates close and stay closed until the membrane repolarizes."},
	{"Which neurotransmitter acts at the vertebrate neuromuscular junction?", "Acetylcholine", "It opens nicotinic receptors on the muscle fibre."},
}

func flashcards() h.Node {
	return h.Div(h.Class("flex flex-col gap-4"), h.Data("deck", ""),
		h.Div(h.Class("flex items-center justify-between text-xs text-muted-foreground"),
			h.Span(h.Data("out", "pos"), h.Class("font-mono tabular-nums"), fmt.Sprintf("1 / %d", len(deck))),
			h.Span(h.Data("out", "score"), "0 known"),
		),
		h.Div(h.Class("[perspective:1200px]"),
			h.Button(h.Type("button"), h.Data("card", ""), h.Aria("label", "Flip card"),
				h.Class("group relative grid h-56 w-full cursor-pointer rounded-xl text-left outline-none [transform-style:preserve-3d] focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-transform duration-500 ease-[var(--ease-in-out)] data-[flipped]:[transform:rotateY(180deg)] motion-reduce:transition-none"),
				h.Div(h.Class("col-start-1 row-start-1 flex flex-col justify-between rounded-xl border bg-background p-6 shadow-xs [backface-visibility:hidden]"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Question"),
					h.P(h.Data("q", ""), h.Class("text-lg leading-snug font-medium text-balance"), deck[0].q),
					h.Span(h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"), "Click or press", kbd.Kbd("Space"), "to flip"),
				),
				h.Div(h.Class("col-start-1 row-start-1 flex flex-col justify-between rounded-xl border border-brand/40 bg-background p-6 shadow-xs [backface-visibility:hidden] [transform:rotateY(180deg)]"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-brand uppercase"), "Answer"),
					h.P(h.Data("a", ""), h.Class("text-2xl font-semibold tracking-tight"), deck[0].a),
					h.P(h.Data("note", ""), h.Class("text-sm leading-relaxed text-muted-foreground"), deck[0].note),
				),
			),
		),
		h.Div(h.Data("grades", ""), h.Class("grid grid-cols-3 gap-2"),
			h.Map([][3]string{{"again", "Again", "1"}, {"good", "Good", "2"}, {"easy", "Easy", "3"}}, func(g [3]string) h.Node {
				return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("grade", g[0]), h.Disabled(),
					g[1], kbd.Kbd(h.Class("ml-auto"), g[2]))
			}),
		),
		h.Template(h.Data("cards", ""), h.Map(deck, func(c card) h.Node {
			return h.Div(h.Data("q", c.q), h.Data("a", c.a), h.Data("note", c.note))
		})),
	)
}

// ---------------------------------------------------------------- N10

func protocolBlock() Block {
	return Block{
		Slug:        "protocol",
		Title:       "Lab protocol",
		Description: "A procedure the learner works through step by step: checkboxes that keep count, the numbers that matter in mono, and the steps where things go wrong flagged before they do.",
		Tags:        []string{"checkbox", "progress", "callouts"},
		Render:      protocol,
	}
}

type step struct {
	title, detail string
	critical      bool
}

var patchSteps = []step{
	{"Pull a glass pipette", "Fire-polish the tip; aim for 3–7 MΩ when filled.", false},
	{"Fill with internal solution", "Fill from the tip, then backfill. Flick out bubbles: one at the tip ruins the seal.", false},
	{"Apply positive pressure and enter the bath", "Keep pressure on so the tip stays clean. Zero the pipette offset.", true},
	{"Approach the cell", "Watch the test pulse: resistance rises as the tip dimples the membrane.", false},
	{"Release pressure, add gentle suction", "Wait for a gigaseal: seal resistance above 1 GΩ. Set the holding potential to −70 mV.", true},
	{"Compensate fast capacitance", "Cancel the pipette transients before breaking in.", false},
	{"Break in", "A short, sharp pulse of suction ruptures the patch: whole-cell configuration.", true},
	{"Record", "Check access resistance; discard cells whose access drifts by more than ~20%.", false},
}

func protocol() h.Node {
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs"), h.Data("protocol", ""),
		h.Div(h.Class("flex flex-col gap-3 border-b p-4"),
			h.Div(h.Class("flex items-center justify-between gap-3"),
				h.Div(h.Class("flex flex-col"),
					h.Span(h.Class("text-sm font-medium"), "Whole-cell patch clamp"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Lab 2 · Recording from cultured neurons"),
				),
				h.Span(h.Data("out", "count"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("0 / %d", len(patchSteps))),
			),
			h.Div(h.Class("h-1 overflow-hidden rounded-full bg-foreground/10"),
				h.Div(h.Data("bar", ""), h.Class("h-full w-0 rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)]"))),
		),
		h.Ol(h.Class("flex flex-col p-2"),
			h.MapIdx(patchSteps, func(i int, s step) h.Node {
				id := fmt.Sprintf("patch-%d", i)
				return h.Li(h.Class("flex gap-3 rounded-lg p-2.5 transition-colors duration-150 has-data-[state=checked]:[&_[data-title]]:text-muted-foreground has-data-[state=checked]:[&_[data-title]]:line-through has-data-[state=checked]:[&_[data-title]]:decoration-foreground/30"),
					checkbox.Checkbox(h.ID(id), h.Class("mt-0.5 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white")),
					h.Label(h.For(id), h.Class("flex flex-1 cursor-pointer flex-col gap-1"),
						h.Span(h.Class("flex flex-wrap items-center gap-2 text-sm font-medium"),
							h.Span(h.Data("title", ""), h.Class("transition-colors duration-150"), fmt.Sprintf("%d. %s", i+1, s.title)),
							h.If(s.critical, h.Span(h.Class("flex items-center gap-1 rounded-full bg-vec-out/15 px-1.5 py-px text-[10px] font-medium text-[color-mix(in_oklab,var(--vec-out)_70%,var(--foreground))]"),
								hugeicons.Alert02Icon(h.Class("size-3")), "Critical")),
						),
						h.Span(h.Class("text-[13px] leading-relaxed text-muted-foreground"), monoNumbers(s.detail)),
					),
				)
			}),
		),
		h.Div(h.Data("done", ""), h.Hidden(), h.Class("enter m-2 mt-0 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/8 p-3 text-sm"),
			hugeicons.CheckmarkCircle02Icon(h.Class("size-4 text-brand")), "Protocol complete. Log the cell's resting potential and access resistance."),
	)
}

// monoNumbers sets measured values (numbers with their units) in mono, so
// the eye finds them in a sentence.
func monoNumbers(s string) h.Node {
	words := strings.Split(s, " ")
	var out []h.Node
	for i, w := range words {
		sep := ""
		if i < len(words)-1 {
			sep = " "
		}
		core := strings.TrimRight(w, ".,;:")
		punct := w[len(core):]
		isNum := len(core) > 0 && (core[0] >= '0' && core[0] <= '9' || strings.HasPrefix(core, "−") || strings.HasPrefix(core, "~"))
		if isNum || core == "MΩ" || core == "GΩ" || core == "mV" {
			out = append(out, h.Span(h.Class("font-mono text-[12px] text-foreground"), core), h.Text(punct+sep))
		} else {
			out = append(out, h.Text(w+sep))
		}
	}
	return h.Group(out)
}
