package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/label"
	switchui "github.com/alexisbcz/components/ui/switch"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NeuroBlocks lists the neuroscience gallery in display order.
func NeuroBlocks() []Block {
	return []Block{
		actionPotentialBlock(),
		neuronAnatomyBlock(),
		nernstBlock(),
		summationBlock(),
		rasterBlock(),
		doseResponseBlock(),
		glossaryBlock(),
		citationBlock(),
		flashcardsBlock(),
		protocolBlock(),
	}
}

// panelLabel is the small uppercase label over a group of controls.
func panelLabel(s string) h.Node {
	return h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), s)
}

// field is a labelled scrub input with a unit.
func field(name, lbl, unit string, v float64, min, max, step float64) h.Node {
	return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
		h.Span(h.Class("text-muted-foreground"), lbl),
		h.Span(h.Class("flex items-center gap-1"),
			h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
				h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)),
				h.Attr("autocomplete", "off"),
				h.Class("h-8 w-16 cursor-ew-resize rounded-md border border-input bg-background text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 px-2 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
			h.Span(h.Class("w-12 font-mono text-[11px] text-muted-foreground"), unit),
		),
	)
}

func toggle(id, name, lbl string, on bool) h.Node {
	return h.Div(h.Class("flex items-center justify-between gap-3"),
		label.Label(h.For(id), h.Class("font-normal"), lbl),
		switchui.Switch(h.ID(id), h.Data("toggle", name), h.If(on, switchui.Checked(true))),
	)
}

func legendSwatch(color, text string) h.Node {
	return h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("h-0.5 w-3 rounded-full"), h.Style("background:"+color)), text)
}

// ---------------------------------------------------------------- N1

func actionPotentialBlock() Block {
	return Block{
		Slug:        "action-potential",
		Title:       "Action potential lab",
		Description: "The Hodgkin–Huxley model (1952), integrated live in the browser. Change the stimulus, add a second pulse to find the refractory period, or block channels with TTX and TEA and watch which phase of the spike disappears.",
		Tags:        []string{"Hodgkin–Huxley", "simulation", "drugs"},
		Wide:        true,
		Render:      actionPotential,
	}
}

func actionPotential() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("hh", ""),
		h.Div(h.Class("flex min-w-0 flex-col gap-1 border-b bg-code p-3 lg:border-r lg:border-b-0"),
			h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
				legendSwatch("var(--foreground)", "Vm"),
				legendSwatch("var(--ion-na)", "E_Na"),
				legendSwatch("var(--ion-k)", "E_K"),
				h.Span(h.Class("ml-auto"), h.Data("out", "verdict"), "—"),
			),
			h.Svg(h.Data("plot", "v"), h.ViewBox("0 0 640 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Membrane potential over time")),
			h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
				legendSwatch("var(--ion-na)", "m (Na⁺ activation)"),
				legendSwatch("var(--vec-out)", "h (Na⁺ inactivation)"),
				legendSwatch("var(--ion-k)", "n (K⁺ activation)"),
			),
			h.Svg(h.Data("plot", "gates"), h.ViewBox("0 0 640 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Gating variables over time")),
		),
		h.Div(h.Class("flex flex-col gap-5 p-5"),
			h.Div(h.Class("flex flex-col gap-2"),
				panelLabel("Stimulus"),
				field("amp", "Pulse 1", "µA/cm²", 10, 0, 60, 0.5),
				field("dur", "Duration", "ms", 1, 0.1, 10, 0.1),
				field("amp2", "Pulse 2", "µA/cm²", 10, 0, 60, 0.5),
				field("delay", "Delay", "ms", 12, 1, 35, 0.5),
			),
			h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
				panelLabel("Pharmacology"),
				toggle("hh-ttx", "ttx", "TTX (blocks Na⁺ channels)", false),
				toggle("hh-tea", "tea", "TEA (blocks K⁺ channels)", false),
			),
			h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
				h.Dt(h.Class("text-muted-foreground"), "spikes"), h.Dd(h.Data("out", "spikes"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "peak Vm"), h.Dd(h.Data("out", "peak"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "rest"), h.Dd("−65 mV"),
			),
			h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
				"Drag a number sideways to change it. Squid giant axon parameters at 6.3 °C, shifted so rest is −65 mV."),
		),
	)
}

// ---------------------------------------------------------------- N3

func nernstBlock() Block {
	return Block{
		Slug:        "membrane-potential",
		Title:       "Nernst and Goldman",
		Description: "Where the resting potential comes from. Each ion's gradient sets its equilibrium potential (Nernst); the membrane settles between them, weighted by permeability (Goldman–Hodgkin–Katz). Switch to the peak of a spike and Vm swings toward E_Na.",
		Tags:        []string{"Nernst", "GHK", "calculator"},
		Wide:        true,
		Render:      nernst,
	}
}

type ion struct {
	key, name, color string
	z                int
	in, out, perm    float64
}

var ions = []ion{
	{"k", "K⁺", "var(--ion-k)", 1, 140, 5, 1},
	{"na", "Na⁺", "var(--ion-na)", 1, 15, 145, 0.05},
	{"cl", "Cl⁻", "var(--ion-cl)", -1, 10, 110, 0.45},
	{"ca", "Ca²⁺", "var(--ion-ca)", 2, 0.0001, 2, 0},
}

func nernst() h.Node {
	cell := func(name string, v float64, min, max, step float64) h.Node {
		return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
			h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)), h.Attr("autocomplete", "off"),
			h.Aria("label", name),
			h.Class("h-8 w-20 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring disabled:cursor-not-allowed disabled:opacity-40"))
	}
	return h.Div(h.Class("flex flex-col gap-0 overflow-hidden rounded-xl border bg-background"), h.Data("ghk", ""),
		h.Div(h.Class("scroll-thin overflow-x-auto"),
			h.Table(h.Class("w-full min-w-[560px] text-sm"),
				h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
					h.Th(h.Class("px-4 py-2.5 font-normal"), "Ion"),
					h.Th(h.Class("px-2 py-2.5 text-right font-normal"), "Inside (mM)"),
					h.Th(h.Class("px-2 py-2.5 text-right font-normal"), "Outside (mM)"),
					h.Th(h.Class("px-2 py-2.5 text-right font-normal"), "Permeability"),
					h.Th(h.Class("px-4 py-2.5 text-right font-normal"), "E_ion"),
				)),
				h.Tbody(h.Map(ions, func(i ion) h.Node {
					return h.Tr(h.Class("border-b last:border-b-0"),
						h.Td(h.Class("px-4 py-2"), h.Span(h.Class("flex items-center gap-2 font-medium"),
							h.Span(h.Class("size-2.5 rounded-full"), h.Style("background:"+i.color)), i.name,
							h.Span(h.Class("font-mono text-[11px] font-normal text-muted-foreground"), fmt.Sprintf("z = %+d", i.z)))),
						h.Td(h.Class("px-2 py-2 text-right"), cell(i.key+"-in", i.in, 0.0001, 500, h.Ternary(i.key == "ca", 0.0001, 1.0))),
						h.Td(h.Class("px-2 py-2 text-right"), cell(i.key+"-out", i.out, 0.0001, 500, h.Ternary(i.key == "ca", 0.1, 1.0))),
						h.Td(h.Class("px-2 py-2 text-right"), h.If(i.key != "ca", cell(i.key+"-p", i.perm, 0, 50, 0.01)),
							h.If(i.key == "ca", h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "not in GHK"))),
						h.Td(h.Class("px-4 py-2 text-right font-mono tabular-nums"), h.Data("out", "e-"+i.key), h.Style("color:"+i.color), "—"),
					)
				})),
			),
		),
		// The voltage axis: every equilibrium potential and the membrane between them.
		h.Div(h.Class("flex flex-col gap-3 border-t bg-code px-4 py-5"),
			h.Div(h.Class("relative mx-4 h-16"), h.Data("axis", ""), h.Aria("hidden", "true")),
			h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
				h.Div(h.Class("flex items-baseline gap-2"),
					h.Span(h.Class("text-sm text-muted-foreground"), "Membrane potential"),
					h.Span(h.Data("out", "vm"), h.Class("font-mono text-2xl font-medium tabular-nums"), "—"),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					field("temp", "T", "°C", 37, 0, 45, 0.5),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "rest"), "At rest"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "peak"), "Peak of a spike"),
				),
			),
			h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"),
				"E = (RT / zF) ln([out]/[in])  ·  Vm = (RT/F) ln((P_K[K]o + P_Na[Na]o + P_Cl[Cl]i) / (P_K[K]i + P_Na[Na]i + P_Cl[Cl]o))"),
		),
	)
}

// ---------------------------------------------------------------- N4

func summationBlock() Block {
	return Block{
		Slug:        "summation",
		Title:       "Synaptic summation",
		Description: "A live oscilloscope on a neuron's soma. One EPSP is not enough to reach threshold; several close in time (temporal summation) or from two synapses at once (spatial summation) are. An IPSP pulls the membrane back down.",
		Tags:        []string{"integrate-and-fire", "oscilloscope", "kbd"},
		Wide:        true,
		Render:      summation,
	}
}

func summation() h.Node {
	fire := func(kind, lbl, color string, key string) h.Node {
		return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("fire", kind),
			h.Span(h.Class("size-2 rounded-full"), h.Style("background:"+color)), lbl, kbd.Kbd(h.Class("ml-0.5"), key))
	}
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("lif", ""), h.TabIndex(0),
		h.Aria("label", "Synaptic summation oscilloscope. Keys 1, 2 and 3 fire the synapses."),
		h.Div(h.Class("relative bg-code"),
			h.Svg(h.Data("scope", ""), h.ViewBox("0 0 720 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Membrane potential, last 400 ms")),
			h.Div(h.Class("pointer-events-none absolute top-2 right-3 flex flex-col items-end gap-0.5 font-mono text-[11px]"),
				h.Span(h.Data("out", "vm"), h.Class("tabular-nums"), "−70.0 mV"),
				h.Span(h.Class("text-muted-foreground"), h.Data("out", "spikes"), "0 spikes"),
			),
		),
		h.Div(h.Class("flex flex-wrap items-center gap-2 border-t p-3"),
			fire("e1", "Excite A", "var(--ion-na)", "1"),
			fire("e2", "Excite B", "var(--ion-ca)", "2"),
			fire("i", "Inhibit", "var(--ion-k)", "3"),
			h.Span(h.Class("mx-1 h-5 w-px bg-border")),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("fire", "train"), hugeicons.FlashIcon(), "A ×4, 5 ms apart"),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("fire", "both"), hugeicons.GitMergeIcon(), "A + B together"),
		),
	)
}

// ---------------------------------------------------------------- N5

func rasterBlock() Block {
	return Block{
		Slug:        "raster",
		Title:       "Raster and PSTH",
		Description: "How neuroscientists read a neuron's response: twenty trials of the same stimulus as rows of spikes, then a peri-stimulus time histogram that averages them. Spikes come from an inhomogeneous Poisson process with an adapting response.",
		Tags:        []string{"Poisson", "histogram", "seeded"},
		Wide:        true,
		Render:      raster,
	}
}

func raster() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_260px]"), h.Data("raster", ""),
		h.Div(h.Class("min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
			h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 340"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Spike raster and PSTH")),
		),
		h.Div(h.Class("flex flex-col gap-5 p-5"),
			h.Div(h.Class("flex flex-col gap-2"),
				panelLabel("Stimulus"),
				field("contrast", "Contrast", "%", 60, 0, 100, 1),
				field("trials", "Trials", "", 20, 5, 40, 1),
				field("bin", "Bin", "ms", 20, 5, 50, 5),
			),
			button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.ShuffleIcon(), "New trials"),
			h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
				h.Dt(h.Class("text-muted-foreground"), "baseline"), h.Dd(h.Data("out", "base"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "stimulus"), h.Dd(h.Data("out", "stim"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "spikes"), h.Dd(h.Data("out", "n"), "—"),
			),
			h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "The stimulus is on from 0 to 500 ms. Response follows a Naka–Rushton contrast curve."),
		),
	)
}

// ---------------------------------------------------------------- N6

func doseResponseBlock() Block {
	return Block{
		Slug:        "dose-response",
		Title:       "Dose–response",
		Description: "Pharmacology on a log axis. The Hill equation sets potency (EC50) and steepness (Hill coefficient); a competitive antagonist shifts the curve right by the Schild dose ratio, a non-competitive one lowers its ceiling.",
		Tags:        []string{"Hill equation", "log scale", "antagonists"},
		Wide:        true,
		Render:      doseResponse,
	}
}

func doseResponse() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("dose", ""),
		h.Div(h.Class("min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
			h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
				legendSwatch("var(--foreground)", "agonist alone"),
				legendSwatch("var(--ion-na)", "with antagonist"),
			),
			h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Dose–response curves")),
		),
		h.Div(h.Class("flex flex-col gap-5 p-5"),
			h.Div(h.Class("flex flex-col gap-2"),
				panelLabel("Agonist"),
				field("logec50", "log EC50", "log M", -6, -9, -3, 0.1),
				field("hill", "Hill n", "", 1, 0.3, 4, 0.1),
			),
			h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
				panelLabel("Antagonist"),
				field("ratio", "[B] / K_B", "", 10, 0, 1000, 1),
				h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Antagonism"),
					segButton("competitive", "Competitive", true),
					segButton("noncompetitive", "Non-competitive", false),
				),
			),
			h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
				h.Dt(h.Class("text-muted-foreground"), "EC50"), h.Dd(h.Data("out", "ec50"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "with B"), h.Dd(h.Data("out", "ec50b"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "dose ratio"), h.Dd(h.Data("out", "dr"), "—"),
			),
		),
	)
}
