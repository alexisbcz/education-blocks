package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// EMBlocks lists the electromagnetism & circuits gallery in display order.
// Every number is computed in static/js/em.js from SI formulas
// (k = 8.9875517923e9 N·m²/C², μ0 = 1.25663706212e-6 N/A², c exact).
func EMBlocks() []Block {
	return []Block{
		emFieldBlock(),
		emCoulombBlock(),
		emCircuitBlock(),
		emRCBlock(),
		emRLCBlock(),
		emWireBlock(),
		emFaradayBlock(),
		emWaveBlock(),
	}
}

// emButton is an outline action button tagged with data-action.
func emButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// emPlay is a play/pause button with its own idle label.
func emPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), h.Data("idle", label), label))
}

func emSVG(attr, viewBox, label, class string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full select-none "+class), h.Role("img"), h.Aria("label", label))
}

// ---------------------------------------------------------------- EM1

func emFieldBlock() Block {
	return Block{
		Slug:        "field",
		Title:       "Electric field and potential",
		Description: "Point charges you can drag. Field lines leave positive charges and end on negative ones; the shading is the potential V = Σ kq/r, with equipotential contours. Move the pointer to read E and V anywhere.",
		Tags:        []string{"field lines", "equipotentials", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-field",
				h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-lg border touch-none"),
					h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full")),
					h.Svg(h.Data("plane", ""), h.ViewBox("-5 -5 10 10"), h.Class("absolute inset-0 size-full select-none"),
						h.Role("img"), h.Aria("label", "Point charges with field lines; drag a charge or use the arrow keys")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Charges"),
					segs("Preset", [2]string{"dipole", "Dipole"}, [2]string{"like", "Like charges"}, [2]string{"quad", "Quadrupole"}),
					h.Div(h.Class("grid grid-cols-2 gap-2 pt-1"),
						emButton("add-pos", "+1 nC", hugeicons.Add01Icon()),
						emButton("add-neg", "−1 nC", hugeicons.MinusSignCircleIcon()),
						h.Div(h.Class("col-span-2"), emButton("remove", "Remove last", hugeicons.Delete02Icon())),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("em-field-lines", "lines", "Field lines", true), toggle("em-field-pot", "potential", "Potential shading", true)),
				readouts([2]string{"at pointer", "pos"}, [2]string{"|E|", "e"}, [2]string{"V", "v"}, [2]string{"net charge", "q"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Positions in cm, charges in nC. Lines start evenly around each positive charge, so their density near a charge follows |q|."),
			)
		},
	}
}

// ---------------------------------------------------------------- EM2

func emCoulombBlock() Block {
	return Block{
		Slug:        "coulomb",
		Title:       "Coulomb's law",
		Description: "Two charges and the force between them, F = k|q₁q₂|/r². Like charges repel, opposite charges attract, and doubling the distance quarters the force: the curve on the right is the inverse square.",
		Tags:        []string{"inverse square", "force", "SI"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-coulomb",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					emSVG("scene", "0 0 400 220", "Two charges and the forces on them", ""),
					emSVG("plot", "0 0 260 220", "Force against distance", ""),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Charges"),
					field("q1", "q₁", "µC", 2, -10, 10, 0.1),
					field("q2", "q₂", "µC", -3, -10, 10, 0.1),
					field("r", "Distance r", "cm", 20, 1, 100, 0.5),
				),
				readouts([2]string{"F", "f"}, [2]string{"nature", "kind"}, [2]string{"at 2r", "f2"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EM3

func emCircuitBlock() Block {
	return Block{
		Slug:        "circuit",
		Title:       "DC circuit solver",
		Description: "A source and four resistors, solved by nodal analysis: Kirchhoff's current law at each node gives a small linear system for the node voltages, then Ohm's law gives every current. The table checks that the source's power equals the sum dissipated.",
		Tags:        []string{"Kirchhoff", "Ohm", "nodal analysis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-circuit",
				emSVG("schematic", "0 0 560 300", "Circuit: source, R1 in series with R2 in parallel with R3 plus R4", "mx-auto max-w-[620px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Components"),
					field("vs", "Source V", "V", 12, 0, 48, 0.5),
					field("r1", "R₁", "Ω", 100, 1, 1000, 1),
					field("r2", "R₂", "Ω", 200, 1, 1000, 1),
					field("r3", "R₃", "Ω", 100, 1, 1000, 1),
					field("r4", "R₄", "Ω", 100, 1, 1000, 1),
				),
				h.Div(h.Data("table", ""), h.Class("border-t pt-4 font-mono text-xs")),
			)
		},
	}
}

// ---------------------------------------------------------------- EM4

func emRCBlock() Block {
	return Block{
		Slug:        "rc",
		Title:       "Capacitor and RC circuit",
		Description: "A capacitor charging through a resistor: V(t) = V₀(1 − e^(−t/τ)) with τ = RC. After one time constant it holds 63.2% of the source voltage, after five 99.3%. The capacitance comes from the plates: C = ε₀εᵣA/d.",
		Tags:        []string{"time constant", "exponential", "capacitance"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-rc",
				emSVG("plot", "0 0 560 300", "Capacitor voltage and current against time", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parallel-plate capacitor"),
					field("area", "Plate area", "cm²", 100, 1, 1000, 1),
					field("gap", "Gap d", "mm", 0.1, 0.01, 10, 0.01),
					field("er", "εᵣ", "", 3.5, 1, 100, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Circuit"),
					field("v0", "Source V₀", "V", 9, 0.5, 50, 0.5),
					field("r", "R", "kΩ", 100, 0.1, 10000, 0.1),
					segs("Phase", [2]string{"charge", "Charging"}, [2]string{"discharge", "Discharging"}),
				),
				readouts([2]string{"C", "c"}, [2]string{"τ = RC", "tau"}, [2]string{"V at τ", "vtau"}, [2]string{"energy ½CV₀²", "energy"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EM5

func emRLCBlock() Block {
	return Block{
		Slug:        "rlc",
		Title:       "RLC resonance",
		Description: "A series RLC circuit driven by a sine wave. The current peaks at f₀ = 1/(2π√LC), where the inductor's and capacitor's reactances cancel; Q = (1/R)√(L/C) sets how sharp the peak is. The step response shows the same circuit ringing.",
		Tags:        []string{"resonance", "Q factor", "transient"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-rlc",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("px-1"), segs("View", [2]string{"response", "Frequency response"}, [2]string{"step", "Step response"})),
					emSVG("plot", "0 0 560 300", "RLC circuit response", "mx-auto max-w-[640px]"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Components"),
					field("r", "R", "Ω", 10, 0.1, 1000, 0.1),
					field("l", "L", "mH", 10, 0.1, 1000, 0.1),
					field("c", "C", "µF", 1, 0.01, 100, 0.01),
					field("v0", "Amplitude V₀", "V", 1, 0.1, 10, 0.1),
				),
				readouts([2]string{"f₀", "f0"}, [2]string{"Q", "q"}, [2]string{"bandwidth", "bw"}, [2]string{"damping ζ", "zeta"}, [2]string{"I at f₀", "imax"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EM6

func emWireBlock() Block {
	return Block{
		Slug:        "wire",
		Title:       "Magnetic field of a current",
		Description: "A long straight wire seen end-on. The field circles it, B = μ₀I/(2πr), pointing the way your fingers curl when your right thumb follows the current. Drag the probe to read B; the solenoid line gives the uniform field inside an ideal coil, B = μ₀nI.",
		Tags:        []string{"right-hand rule", "Ampère", "probe"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-wire",
				h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-lg border touch-none"),
					h.Svg(h.Data("plane", ""), h.ViewBox("-5 -5 10 10"), h.Class("absolute inset-0 size-full select-none"),
						h.Role("img"), h.Aria("label", "Field circles around a wire; drag the probe")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Wire"),
					field("i", "Current I", "A", 10, 0.1, 100, 0.1),
					segs("Direction", [2]string{"out", "Out of the page"}, [2]string{"in", "Into the page"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Solenoid"),
					field("n", "Turns per metre", "/m", 1000, 1, 100000, 1),
				),
				readouts([2]string{"probe r", "r"}, [2]string{"B at probe", "b"}, [2]string{"Earth's field", "earth"}, [2]string{"solenoid B", "sol"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EM7

func emFaradayBlock() Block {
	return Block{
		Slug:        "faraday",
		Title:       "Faraday's law of induction",
		Description: "A bar magnet oscillating through a coil. The flux through the coil changes, and the induced EMF is ℰ = −N dΦ/dt: largest where the flux changes fastest, zero where it peaks. The sign is Lenz's law: the induced current opposes the change.",
		Tags:        []string{"flux", "EMF", "Lenz"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-faraday",
				h.Div(h.Class("flex flex-col gap-2"),
					emSVG("scene", "0 0 560 150", "Magnet moving through a coil", "mx-auto max-w-[640px]"),
					emSVG("plot", "0 0 560 230", "Flux and EMF against time", "mx-auto max-w-[640px]"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Setup"),
					field("turns", "Coil turns N", "", 200, 1, 2000, 1),
					field("freq", "Oscillation", "Hz", 1, 0.1, 5, 0.1),
					field("amp", "Travel ±", "cm", 6, 1, 10, 0.5),
				),
				h.Div(h.Class("grid grid-cols-1 gap-2"), emPlay("Run")),
				readouts([2]string{"peak Φ", "phi"}, [2]string{"peak ℰ", "emf"}, [2]string{"now", "now"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "The magnet is modelled as a magnetic dipole (m = 1 A·m², radius 1 cm); the flux uses the on-axis field over a 2 cm coil, a fair approximation for a coil small next to the travel."),
			)
		},
	}
}

// ---------------------------------------------------------------- EM8

func emWaveBlock() Block {
	return Block{
		Slug:        "em-wave",
		Title:       "Electromagnetic waves and the spectrum",
		Description: "Light as perpendicular electric and magnetic fields travelling together at c = 299,792,458 m/s (exact). Pick a frequency: wavelength λ = c/f and photon energy E = hf follow, and the marker shows where it falls in the spectrum.",
		Tags:        []string{"c = λf", "E = hf", "spectrum"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("em-wave",
				h.Div(h.Class("flex flex-col gap-3"),
					emSVG("scene", "0 0 560 230", "Electric and magnetic field of a plane wave", "mx-auto max-w-[640px]"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-del)", "E field (vertical)"), legendSwatch("var(--vec-u)", "B field (horizontal)")),
					emSVG("spectrum", "0 0 560 74", "Electromagnetic spectrum with the current frequency", "mx-auto max-w-[640px]"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Wave"),
					field("logf", "log₁₀ f", "Hz", 14.75, 3, 21, 0.01),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([][2]string{{"8", "FM radio"}, {"9.39", "Wi-Fi"}, {"14.75", "Green light"}, {"18", "X-ray"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
						}),
					),
				),
				h.Div(h.Class("grid grid-cols-1 gap-2"), emPlay("Animate")),
				readouts([2]string{"f", "f"}, [2]string{"λ", "lambda"}, [2]string{"photon E", "energy"}, [2]string{"band", "band"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Band edges are conventional and approximate; the drawing is not to scale."),
			)
		},
	}
}
