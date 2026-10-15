package site

import (
	"fmt"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PhysiologyBlocks lists the anatomy and physiology gallery in display order.
func PhysiologyBlocks() []Block {
	return []Block{
		physioWiggersBlock(),
		physioECGBlock(),
		physioPoiseuilleBlock(),
		physioSpirogramBlock(),
		physioOxygenBlock(),
		physioNephronBlock(),
		physioSarcomereBlock(),
		physioGlucoseBlock(),
		physioReflexBlock(),
	}
}

// physioPlay is a play/pause button with a custom idle label.
func physioPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func physioNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// ---------------------------------------------------------------- P1

func physioWiggersBlock() Block {
	return Block{
		Slug:        "cardiac-cycle",
		Title:       "Cardiac cycle (Wiggers diagram)",
		Description: "One heartbeat of the left ventricle as a time-varying elastance model with a Windkessel aorta. Move the cursor (or play) to read pressures, volume and the valve events; change heart rate or contractility and watch stroke volume, ejection fraction and cardiac output follow.",
		Tags:        []string{"lumped model", "valves", "time cursor"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("wiggers",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-del)", "aortic pressure"),
						legendSwatch("var(--foreground)", "LV pressure"),
						legendSwatch("var(--vec-u)", "LA pressure"),
						h.Span(h.Class("ml-auto text-foreground"), h.Data("out", "phase"), "—"),
					),
					h.Svg(h.Data("plot", "p"), h.ViewBox("0 0 640 200"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Pressures over one cardiac cycle")),
					h.Svg(h.Data("plot", "v"), h.ViewBox("0 0 640 110"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Left ventricular volume")),
					h.Svg(h.Data("plot", "ecg"), h.ViewBox("0 0 640 90"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Schematic ECG aligned with the cycle")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Heart"),
					field("hr", "Heart rate", "bpm", 75, 40, 180, 1),
					field("emax", "Contractility", "mmHg/mL", 3.2, 1, 6, 0.1),
					field("rs", "Resistance", "mmHg·s/mL", 1.1, 0.5, 2.5, 0.05),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), physioPlay("Play"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"cursor", "cursor"}, [2]string{"LV / aorta", "pressures"}, [2]string{"LV volume", "volume"},
					[2]string{"blood pressure", "bp"}, [2]string{"EDV / ESV", "edv"}, [2]string{"stroke volume", "sv"}, [2]string{"ejection fraction", "ef"}, [2]string{"cardiac output", "co"}),
				physioNote("Teaching model: elastance curve after Stergiopulos et al. (1996), valves as ideal diodes, no atrial contraction, so there is no a-wave and no dicrotic notch. Drag across the plots to move the cursor."),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func physioECGBlock() Block {
	return Block{
		Slug:        "ecg",
		Title:       "Reading an ECG",
		Description: "A lead II trace on standard paper (25 mm/s, 10 mm/mV) with the P wave, QRS complex and T wave labelled and the intervals measured. Switch rhythms and check the numbers against the usual normal ranges.",
		Tags:        []string{"ECG paper", "intervals", "rhythms"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ecg",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("scroll-thin overflow-x-auto rounded-md"),
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 750 240"), h.Class("block w-full min-w-[560px]"), h.Role("img"), h.Aria("label", "Schematic ECG trace, lead II")),
					),
					h.P(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "small square 0.04 s × 0.1 mV · large square 0.2 s × 0.5 mV"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rhythm"),
					h.Div(h.Class("flex flex-col gap-1.5"),
						segs("Rhythm", [2]string{"nsr", "Normal sinus"}, [2]string{"brady", "Bradycardia"}, [2]string{"tachy", "Tachycardia"}),
						segs("More rhythms", [2]string{"avb1", "1st-degree AV block"}, [2]string{"af", "Atrial fibrillation"}),
					),
				),
				readouts([2]string{"heart rate", "hr"}, [2]string{"RR", "rr"}, [2]string{"PR", "pr"}, [2]string{"QRS", "qrs"}, [2]string{"QT / QTc", "qt"}, [2]string{"reading", "reading"}),
				physioNote("Normal ranges: PR 120–200 ms, QRS under 120 ms, QTc (Bazett) under about 450 ms in men and 460 ms in women. Waveforms are synthetic; this is not a diagnostic tool."),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func physioPoiseuilleBlock() Block {
	return Block{
		Slug:        "poiseuille",
		Title:       "Blood flow and vessel radius",
		Description: "Poiseuille's law, Q = πr⁴ΔP / 8ηL: flow grows with the fourth power of the radius, which is why small changes in arteriole diameter control blood flow so strongly. Halve the radius and flow drops to one sixteenth.",
		Tags:        []string{"Poiseuille", "r⁴", "resistance"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("poiseuille",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("tube", ""), h.ViewBox("0 0 400 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Velocity profile in a vessel")),
					h.Svg(h.Data("curve", ""), h.ViewBox("0 0 260 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Flow against radius")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Vessel"),
					field("r", "Radius", "mm", 2, 0.2, 4, 0.05),
					field("len", "Length", "cm", 10, 1, 50, 1),
					field("dp", "Pressure drop", "mmHg", 1, 0.1, 100, 0.1),
					field("eta", "Viscosity", "mPa·s", 3.5, 1, 10, 0.1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "halve"), "Halve r"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "double"), "Double r")),
				readouts([2]string{"flow Q", "q"}, [2]string{"resistance", "res"}, [2]string{"mean velocity", "vmean"}, [2]string{"vs. r = 2 mm", "ratio"}),
				physioNote("Assumes steady laminar flow of a Newtonian fluid in a rigid tube. Blood is non-Newtonian and arteries pulse and stretch, so treat the numbers as an idealisation; whole blood viscosity is about 3–4 mPa·s."),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func physioSpirogramBlock() Block {
	return Block{
		Slug:        "lung-volumes",
		Title:       "Lung volumes",
		Description: "A spirogram: quiet breaths, then a maximal breath in and a maximal breath out. Four volumes add up to total lung capacity; capacities are sums of volumes. Residual volume never leaves the lungs, so a spirometer alone cannot measure it.",
		Tags:        []string{"spirogram", "volumes", "ventilation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("spiro",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Spirogram with lung volumes and capacities")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					segs("Brackets", [2]string{"volumes", "Volumes"}, [2]string{"capacities", "Capacities"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Breathing"),
					field("tv", "Tidal volume", "mL", 500, 200, 1500, 10),
					field("rr", "Breathing rate", "/min", 12, 4, 40, 1),
					field("dead", "Dead space", "mL", 150, 50, 300, 5),
				),
				readouts([2]string{"minute ventilation", "ve"}, [2]string{"alveolar ventilation", "va"}, [2]string{"vital capacity", "vc"}, [2]string{"selected", "sel"}),
				physioNote("Typical values for a young adult man (Guyton & Hall): IRV ≈ 3000 mL, TV ≈ 500 mL, ERV ≈ 1100 mL, RV ≈ 1200 mL. Values vary with body size, sex and age."),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func physioOxygenBlock() Block {
	return Block{
		Slug:        "oxygen-curve",
		Title:       "Oxygen–hemoglobin dissociation",
		Description: "Hemoglobin's S-shaped binding curve, from the Hill equation (n ≈ 2.7, P50 ≈ 26.8 mmHg). Acid, carbon dioxide and heat shift it right, the Bohr effect, so working muscle gets more oxygen unloaded at the same partial pressure.",
		Tags:        []string{"Hill equation", "Bohr effect", "O₂ content"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("o2",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "standard (pH 7.40, 37 °C, PCO₂ 40)"),
						legendSwatch("var(--brand)", "current conditions"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Oxygen saturation against partial pressure")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Blood"),
					field("ph", "pH", "", 7.4, 6.9, 7.7, 0.01),
					field("pco2", "PCO₂", "mmHg", 40, 15, 90, 1),
					field("temp", "Temperature", "°C", 37, 30, 42, 0.1),
					field("hb", "Hemoglobin", "g/dL", 15, 5, 20, 0.1),
					toggle("o2-fetal", "fetal", "Fetal hemoglobin (P50 ≈ 19)", false),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "rest"), "At rest"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "exercise"), "Exercise")),
				readouts([2]string{"P50", "p50"}, [2]string{"SO₂ in lungs (100)", "sa"}, [2]string{"SO₂ in tissue (40)", "sv"}, [2]string{"O₂ content, a / v", "content"}, [2]string{"unloaded", "unload"}),
				physioNote("Shift from Kelman's virtual-PO₂ correction; O₂ content = 1.34 × Hb × SO₂ + 0.003 × PO₂ (mL O₂ per dL). 2,3-BPG also shifts the curve right; it is not modelled here."),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

type physioPart struct{ key, name, role string }

var physioNephronParts = []physioPart{
	{"glomerulus", "Glomerulus", "A knot of capillaries under high pressure. Plasma is filtered out through its walls; blood cells and most proteins stay in."},
	{"capsule", "Bowman's capsule", "Cups the glomerulus and collects the filtrate, which then flows into the tubule."},
	{"pct", "Proximal convoluted tubule", "Reabsorbs about two thirds of the filtered sodium and water, and normally all of the filtered glucose and amino acids."},
	{"descending", "Descending limb of the loop of Henle", "Permeable to water but not to salt: water leaves into the salty medulla, so the filtrate becomes concentrated."},
	{"ascending", "Thick ascending limb", "Pumps Na⁺, K⁺ and Cl⁻ out (the NKCC2 transporter) but is impermeable to water, so the filtrate becomes dilute and the medulla stays salty."},
	{"dct", "Distal convoluted tubule", "Fine-tunes sodium (the NCC transporter, the target of thiazide diuretics) and calcium reabsorption, the latter under parathyroid hormone."},
	{"collecting", "Collecting duct", "Reabsorbs water through aquaporin-2 channels when ADH (vasopressin) is present, setting how concentrated the final urine is."},
}

func physioNephronSVG() h.Node {
	g := func(key string, children ...any) h.Node {
		name := key
		for _, p := range physioNephronParts {
			if p.key == key {
				name = p.name
			}
		}
		return h.El("g", append([]any{h.Data("part", key), h.TabIndex(0), h.Role("button"), h.Aria("label", name),
			h.Class("cursor-pointer outline-none [&_*]:transition-[stroke,fill] [&_*]:duration-150")}, children...)...)
	}
	tube := func(d string, w float64) h.Node {
		return h.El("path", h.Attr("d", d), h.Attr("fill", "none"), h.Attr("stroke-width", fmt.Sprint(w)),
			h.Attr("stroke-linecap", "round"), h.Attr("stroke-linejoin", "round"), h.Class("stroke-[var(--part)]"))
	}
	return h.Svg(h.ViewBox("0 0 560 360"), h.Class("block w-full [--part:color-mix(in_oklab,var(--foreground)_50%,transparent)] [&_[data-part]:is(:hover,:focus-visible,[data-on])]:[--part:var(--brand)]"),
		h.Role("group"), h.Aria("label", "Diagram of a nephron"),
		// Cortex and medulla.
		h.El("rect", h.Attr("x", "0"), h.Attr("y", "0"), h.Attr("width", "560"), h.Attr("height", "150"), h.Class("fill-[color-mix(in_oklab,var(--foreground)_3%,transparent)]")),
		h.El("rect", h.Attr("x", "0"), h.Attr("y", "150"), h.Attr("width", "560"), h.Attr("height", "210"), h.Class("fill-[color-mix(in_oklab,var(--vec-out)_8%,transparent)]")),
		h.El("text", h.Attr("x", "10"), h.Attr("y", "18"), h.Class("fill-muted-foreground font-mono text-[10px]"), "cortex"),
		h.El("text", h.Attr("x", "10"), h.Attr("y", "168"), h.Class("fill-muted-foreground font-mono text-[10px]"), "medulla (saltier with depth)"),
		g("capsule", h.El("path", h.Attr("d", "M88 62 C88 34 136 34 136 62 C136 90 88 90 88 62 Z"), h.Attr("fill", "none"), h.Attr("stroke-width", "3"), h.Class("stroke-[var(--part)]"))),
		g("glomerulus",
			h.El("path", h.Attr("d", "M96 62 c4 -10 10 -10 12 0 c2 8 10 8 12 -2 c2 -8 8 -6 8 2 c0 8 -8 12 -14 10 c-6 -2 -12 4 -18 0 c-4 -3 -2 -8 0 -10"),
				h.Attr("fill", "none"), h.Attr("stroke-width", "2"), h.Class("stroke-[var(--part)]")),
			h.El("path", h.Attr("d", "M60 40 L96 56 M60 84 L96 70"), h.Attr("stroke-width", "2"), h.Class("stroke-[color-mix(in_oklab,var(--code-del)_70%,transparent)]")),
		),
		g("pct", tube("M136 66 C170 70 170 30 200 34 C230 38 228 78 258 74 C288 70 290 40 316 46 C336 50 340 70 340 96", 5)),
		g("descending", tube("M340 96 L340 300", 5)),
		g("ascending", tube("M340 300 C340 322 372 322 372 300 L372 160", 7)),
		g("dct", tube("M372 160 C372 120 410 140 420 110 C430 80 400 70 420 50 C436 34 460 40 470 60", 5)),
		g("collecting", tube("M470 60 L490 60 L490 340", 8)),
		h.El("path", h.Attr("d", "M490 340 l-5 -8 m5 8 l5 -8"), h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.4")),
		h.El("text", h.Attr("x", "500"), h.Attr("y", "336"), h.Class("fill-muted-foreground font-mono text-[10px]"), "urine"),
	)
}

func physioNephronBlock() Block {
	return Block{
		Slug:        "nephron",
		Title:       "The nephron",
		Description: "The kidney's working unit, from filtration to final urine. Point at a segment (or tab through them) to see what it reabsorbs or secretes. Both kidneys filter about 180 litres a day and return about 99% of it to the blood.",
		Tags:        []string{"parts picker", "filtration", "reabsorption"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("physio-parts", ""),
				h.Div(h.Class("flex items-center border-b bg-code p-4 lg:border-r lg:border-b-0"), physioNephronSVG()),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Aria("live", "polite"), h.Class("flex min-h-36 flex-col gap-2"),
						h.Span(h.Data("info-name", ""), h.Class("text-base font-semibold tracking-tight"), "Point at a segment"),
						h.P(h.Data("info-role", ""), h.Class("text-sm leading-relaxed text-muted-foreground"), "Filtrate flows from the glomerulus through the tubule to the collecting duct."),
					),
					h.Div(h.Class("flex flex-wrap gap-1.5 border-t pt-4"),
						h.Map(physioNephronParts, func(p physioPart) h.Node {
							return h.Button(h.Type("button"), h.Data("pick", p.key), h.Data("name", p.name), h.Data("role", p.role),
								h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"),
								p.name)
						}),
					),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "GFR"), h.Dd("≈ 125 mL/min ≈ 180 L/day"),
						h.Dt(h.Class("text-muted-foreground"), "urine"), h.Dd("≈ 1–2 L/day"),
						h.Dt(h.Class("text-muted-foreground"), "reabsorbed"), h.Dd("≈ 99% of the filtrate"),
						h.Dt(h.Class("text-muted-foreground"), "nephrons"), h.Dd("around a million per kidney"),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func physioSarcomereBlock() Block {
	return Block{
		Slug:        "sarcomere",
		Title:       "Sliding filaments",
		Description: "A sarcomere at any length, and the force it can develop there. Force follows the overlap between actin and myosin: too stretched and few cross-bridges reach, too short and the filaments collide. The classic curve comes from frog muscle fibres.",
		Tags:        []string{"length–tension", "cross-bridges", "frog data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sarcomere",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("fibre", ""), h.ViewBox("0 0 640 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Sarcomere drawing at the chosen length")),
					h.Svg(h.Data("curve", ""), h.ViewBox("0 0 640 220"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Length–tension curve; drag to set the length")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sarcomere"),
					field("len", "Length", "µm", 2.1, 1.3, 3.7, 0.01),
				),
				h.Div(h.Class("grid grid-cols-3 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "1.6"), "Short"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "2.1"), "Optimal"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", "3.2"), "Stretched")),
				readouts([2]string{"active force", "force"}, [2]string{"region", "region"}),
				physioNote("Curve approximated from Gordon, Huxley & Julian (1966), J. Physiol. 184: 170–192: plateau 2.00–2.25 µm, zero force near 3.65 µm. Filament lengths drawn to scale: thick 1.6 µm, thin about 1.0 µm."),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func physioGlucoseBlock() Block {
	return Block{
		Slug:        "glucose",
		Title:       "Negative feedback: blood glucose",
		Description: "Homeostasis as a control loop. After a meal glucose rises, the pancreas releases insulin and tissues take the glucose up; when glucose falls, insulin drops and glucagon makes the liver release more. Remove insulin and the loop breaks.",
		Tags:        []string{"feedback", "teaching model", "6 hours"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("glucose",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "glucose (mmol/L)"),
						legendSwatch("var(--vec-u)", "insulin (relative)"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Blood glucose and insulin over six hours")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Events"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "meal"), hugeicons.RestaurantIcon(), "Add meal"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "exercise"), hugeicons.Dumbbell01Icon(), "Add exercise"),
					),
					field("at", "At time", "min", 60, 0, 330, 5),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("event", "clear"), hugeicons.RefreshIcon(), "Clear events"),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("glu-t1", "type1", "No insulin (untreated type 1)", false),
				),
				readouts([2]string{"fasting", "fasting"}, [2]string{"peak", "peak"}, [2]string{"back near baseline", "back"}),
				physioNote("A teaching model with made-up constants, chosen only to show the feedback loop's shape; it does not predict anyone's glucose. Normal fasting glucose is about 4–5.5 mmol/L (70–100 mg/dL)."),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

type physioStep struct{ title, body string }

var physioReflexSteps = []physioStep{
	{"Tap the tendon", "The hammer stretches the patellar tendon, and with it the quadriceps muscle."},
	{"Spindles fire", "Muscle spindles inside the quadriceps sense the stretch and fire action potentials in their sensory (Ia) fibres."},
	{"Into the spinal cord", "The sensory neuron's cell body sits in the dorsal root ganglion; its axon enters the spinal cord through the dorsal root."},
	{"One synapse", "In the ventral horn it synapses directly on an alpha motor neuron of the quadriceps: a monosynaptic reflex, with no brain involved."},
	{"Quadriceps contract", "The motor neuron fires out through the ventral root and the quadriceps contracts: the leg kicks."},
	{"Reciprocal inhibition", "A branch also excites an inhibitory interneuron that silences the hamstrings' motor neuron, so the opposing muscle relaxes."},
}

func physioReflexSVG() h.Node {
	seg := func(step int, d string, color string, w float64, dash bool) h.Node {
		attrs := []any{h.Data("step", fmt.Sprint(step)), h.Attr("d", d), h.Attr("fill", "none"), h.Attr("stroke-width", fmt.Sprint(w)),
			h.Attr("stroke-linecap", "round"), h.Attr("stroke-linejoin", "round"), h.Style("stroke:" + color),
			h.Class("opacity-30 transition-opacity duration-200 data-[on]:opacity-100")}
		if dash {
			attrs = append(attrs, h.Attr("stroke-dasharray", "5 4"))
		}
		return h.El("path", attrs...)
	}
	label := func(x, y, s string) h.Node {
		return h.El("text", h.Attr("x", x), h.Attr("y", y), h.Class("fill-muted-foreground font-mono text-[10px]"), s)
	}
	return h.Svg(h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Patellar reflex arc"),
		// Spinal cord cross-section with butterfly grey matter.
		h.El("ellipse", h.Attr("cx", "500"), h.Attr("cy", "110"), h.Attr("rx", "80"), h.Attr("ry", "62"), h.Class("fill-[color-mix(in_oklab,var(--foreground)_4%,transparent)] stroke-[color-mix(in_oklab,var(--foreground)_35%,transparent)]"), h.Attr("stroke-width", "1.5")),
		h.El("path", h.Attr("d", "M500 70 C520 60 548 70 545 92 C542 108 520 106 512 112 C524 120 548 126 540 146 C532 162 508 150 500 140 C492 150 468 162 460 146 C452 126 476 120 488 112 C480 106 458 108 455 92 C452 70 480 60 500 70 Z"),
			h.Class("fill-[color-mix(in_oklab,var(--foreground)_9%,transparent)]")),
		label("470", "190", "spinal cord"),
		// Dorsal root ganglion.
		h.El("ellipse", h.Attr("cx", "430"), h.Attr("cy", "70"), h.Attr("rx", "12"), h.Attr("ry", "8"), h.Class("fill-[color-mix(in_oklab,var(--vec-u)_25%,var(--code-bg))] stroke-[var(--vec-u)]"), h.Attr("stroke-width", "1.5")),
		label("392", "52", "dorsal root ganglion"),
		// Thigh (quadriceps above, hamstrings below), knee and shin.
		h.El("rect", h.Attr("x", "40"), h.Attr("y", "118"), h.Attr("width", "232"), h.Attr("height", "34"), h.Attr("rx", "14"), h.Class("fill-[color-mix(in_oklab,var(--brand)_8%,transparent)] stroke-[color-mix(in_oklab,var(--foreground)_30%,transparent)]"), h.Attr("stroke-width", "1.25")),
		h.El("rect", h.Attr("x", "40"), h.Attr("y", "156"), h.Attr("width", "232"), h.Attr("height", "30"), h.Attr("rx", "14"), h.Class("fill-[color-mix(in_oklab,var(--ion-k)_7%,transparent)] stroke-[color-mix(in_oklab,var(--foreground)_30%,transparent)]"), h.Attr("stroke-width", "1.25")),
		h.El("circle", h.Attr("cx", "290"), h.Attr("cy", "160"), h.Attr("r", "17"), h.Class("fill-[color-mix(in_oklab,var(--foreground)_6%,transparent)] stroke-[color-mix(in_oklab,var(--foreground)_30%,transparent)]"), h.Attr("stroke-width", "1.25")),
		h.El("path", h.Attr("d", "M292 176 L322 282"), h.Attr("stroke-width", "26"), h.Attr("stroke-linecap", "round"), h.Class("stroke-[color-mix(in_oklab,var(--foreground)_7%,transparent)]")),
		label("48", "112", "quadriceps"),
		label("48", "200", "hamstrings"),
		label("306", "142", "knee"),
		// Step 1: the hammer and the patellar tendon.
		seg(0, "M318 112 L336 92 M330 86 l12 -12 l7 7 l-12 12 Z", "var(--foreground)", 2, false),
		seg(0, "M266 134 C284 136 300 146 306 172", "var(--vec-out)", 4, false),
		// Step 2: spindle in the quadriceps.
		seg(1, "M140 135 c7 -6 15 -6 22 0 c-7 6 -15 6 -22 0 Z", "var(--vec-u)", 2, false),
		// Steps 2–3: sensory (Ia) fibre to the DRG and into the cord.
		seg(1, "M162 135 C230 100 330 66 418 70", "var(--vec-u)", 2.5, false),
		seg(2, "M442 70 C470 70 486 86 496 104", "var(--vec-u)", 2.5, false),
		// Step 4: the synapse in the ventral horn.
		seg(3, "M496 104 C500 116 502 128 506 136", "var(--vec-u)", 2.5, false),
		seg(3, "M506 136 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0", "var(--brand)", 2, false),
		// Step 5: motor neuron out to the quadriceps.
		seg(4, "M506 140 C470 170 380 150 210 138", "var(--brand)", 2.5, false),
		// Step 6: interneuron and inhibited hamstring motor neuron.
		seg(5, "M500 120 C486 132 482 146 478 152", "var(--ion-k)", 2, false),
		seg(5, "M478 152 C430 200 330 196 200 172", "var(--ion-k)", 2, true),
		label("392", "232", "dashed: inhibited"),
	)
}

func physioReflexBlock() Block {
	return Block{
		Slug:        "reflex-arc",
		Title:       "The knee-jerk reflex",
		Description: "The simplest circuit in the nervous system, one step at a time: a stretch sensed in a muscle comes back as a contraction of the same muscle through a single synapse in the spinal cord, while the opposing muscle is told to relax.",
		Tags:        []string{"stepper", "monosynaptic", "kbd"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:grid-cols-[minmax(0,1fr)_300px]"),
				h.Data("reflex", ""), h.TabIndex(0), h.Aria("label", "Reflex arc stepper; use the arrow keys"),
				h.Div(h.Class("flex items-center border-b bg-code p-4 lg:border-r lg:border-b-0"), physioReflexSVG()),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex items-center justify-between"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), h.Span(h.Data("out", "count"), fmt.Sprintf("1 / %d", len(physioReflexSteps)))),
						button.Button(button.VariantOutline, button.SizeSm, lib.AsChild, h.A(h.Href("/neuro#summation"), hugeicons.LinkSquare02Icon(), "Synapses in /neuro")),
					),
					h.Ol(h.Class("flex flex-col gap-1"),
						h.MapIdx(physioReflexSteps, func(i int, s physioStep) h.Node {
							return h.Li(h.Data("item", fmt.Sprint(i)),
								h.Class("flex gap-3 rounded-lg border border-transparent p-2 text-sm transition-colors duration-150 data-[on]:border-border data-[on]:bg-background"),
								h.Span(h.Class("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground"), fmt.Sprint(i+1)),
								h.Div(h.Class("flex flex-col gap-0.5"),
									h.Span(h.Class("font-medium"), s.title),
									h.Span(h.Data("body", ""), h.Class("hidden text-[13px] leading-relaxed text-muted-foreground [[data-on]_&]:block"), s.body)),
							)
						}),
					),
					h.Div(h.Class("mt-auto grid grid-cols-2 gap-2 border-t pt-4"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
					),
				),
			)
		},
	}
}
