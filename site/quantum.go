package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// QuantumBlocks lists the quantum physics gallery in display order.
func QuantumBlocks() []Block {
	return []Block{
		qBoxBlock(),
		qTunnellingBlock(),
		qOscillatorBlock(),
		qDoubleSlitBlock(),
		qBlochBlock(),
		qUncertaintyBlock(),
		qHydrogenBlock(),
		qPhotoelectricBlock(),
		qBlackbodyBlock(),
	}
}

// units is the small note under a model's controls saying which units it
// computes in.
func qUnits(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func qAction(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- Q1

func qBoxBlock() Block {
	return Block{
		Slug:        "particle-in-a-box",
		Title:       "Particle in a box",
		Description: "The simplest quantum system: a particle trapped between two walls. Its energies come in steps that grow as n², each with a standing wave. Mix two or three of them and the probability density sloshes back and forth at the beat frequency (E₂ − E₁)/ħ.",
		Tags:        []string{"eigenstates", "superposition", "time evolution"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qbox",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]"),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--brand)", "|ψ|²"),
							legendSwatch("var(--vec-u)", "Re ψ"),
							legendSwatch("var(--vec-v)", "Im ψ"),
						),
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Wave function in the box")),
					),
					h.Svg(h.Data("levels", ""), h.ViewBox("0 0 120 300"), h.Class("block w-full max-sm:hidden"), h.Role("img"), h.Aria("label", "Energy levels")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Amplitudes"),
					field("c1", "n = 1", "", 1, 0, 1, 0.05),
					field("c2", "n = 2", "", 1, 0, 1, 0.05),
					field("c3", "n = 3", "", 0, 0, 1, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("qbox-re", "parts", "Show Re ψ and Im ψ", true)),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), qAction("reset", "t = 0", hugeicons.RefreshIcon())),
				readouts([2]string{"t", "t"}, [2]string{"⟨E⟩", "e"}, [2]string{"∫|ψ|²dx", "norm"}, [2]string{"period", "period"}),
				qUnits("Units: ħ = m = L = 1, so Eₙ = n²π²/2. Amplitudes are normalised for you."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q2

func qTunnellingBlock() Block {
	return Block{
		Slug:        "tunnelling",
		Title:       "Wave packet and barrier",
		Description: "The time-dependent Schrödinger equation solved live with the Crank–Nicolson method. A Gaussian wave packet hits a barrier: part reflects, part tunnels through even when its energy is below the barrier. Compare the simulated transmission with the plane-wave formula.",
		Tags:        []string{"Crank–Nicolson", "tunnelling", "norm-preserving"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("tdse",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "|ψ|²"),
						legendSwatch("var(--vec-u)", "Re ψ"),
						legendSwatch("var(--foreground)", "V(x)"),
						legendSwatch("var(--vec-out)", "⟨E⟩"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Wave packet and potential barrier")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Barrier"),
					field("v0", "Height V₀", "", 1.4, 0, 4, 0.05),
					field("a", "Width a", "", 1, 0.1, 6, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Packet"),
					field("k0", "Momentum k₀", "", 1.5, 0.5, 3, 0.05),
					toggle("tdse-re", "re", "Show Re ψ", true),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), qAction("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"⟨E⟩", "e"}, [2]string{"past the barrier", "t"}, [2]string{"before it", "r"}, [2]string{"plane-wave T", "tpw"}, [2]string{"norm", "norm"}),
				qUnits("Units: ħ = m = 1. Grid of 1000 points, Δx = 0.1, Δt = 0.05; walls at the edges."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q3

func qOscillatorBlock() Block {
	return Block{
		Slug:        "harmonic-oscillator",
		Title:       "Quantum harmonic oscillator",
		Description: "Each eigenstate drawn on its own energy level, Eₙ = (n + ½)ħω, inside the parabola V = ½mω²x². The probability leaks past the classical turning points; at high n, |ψₙ|² starts to trace the classical density, which piles up where the particle moves slowest.",
		Tags:        []string{"Hermite functions", "correspondence", "turning points"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qho",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 360"), h.Class("mx-auto block w-full max-w-[680px]"), h.Role("img"), h.Aria("label", "Harmonic oscillator eigenstate")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("State"),
					field("n", "n", "", 0, 0, 40, 1),
					segs("Show", [2]string{"density", "|ψₙ|²"}, [2]string{"wave", "ψₙ"}),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("qho-cl", "classical", "Classical density", true)),
				readouts([2]string{"Eₙ", "e"}, [2]string{"turning points", "tp"}, [2]string{"nodes", "nodes"}, [2]string{"outside", "out"}, [2]string{"∫|ψ|²dx", "norm"}),
				qUnits("Units: ħ = m = ω = 1. ψₙ from the normalised Hermite-function recurrence."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q4

func qDoubleSlitBlock() Block {
	return Block{
		Slug:        "double-slit",
		Title:       "Double slit",
		Description: "Two slits, one wavelength. The pattern is two-slit fringes under a single-slit envelope (Fraunhofer). Fire particles one at a time: each lands at a single random spot, yet the fringes build up hit by hit.",
		Tags:        []string{"interference", "Born rule", "one at a time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("slit",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Intensity on the screen")),
					h.Div(h.Class("relative mx-[6.25%] h-20 overflow-hidden rounded-md border bg-black"),
						h.Canvas(h.Data("screen", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", "Screen")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Setup"),
					field("lambda", "Wavelength λ", "nm", 532, 380, 750, 1),
					field("d", "Separation d", "µm", 250, 50, 1000, 5),
					field("w", "Slit width a", "µm", 60, 10, 300, 5),
					toggle("slit-one", "one", "Cover one slit", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Particles"),
					h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), qAction("clear", "Clear", hugeicons.RefreshIcon())),
				),
				readouts([2]string{"fringe spacing", "fringe"}, [2]string{"central max", "central"}, [2]string{"hits", "hits"}),
				qUnits("Screen at L = 1 m, small-angle approximation; the screen spans ±20 mm."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q5

func qBlochBlock() Block {
	gate := func(g, label, title string) h.Node {
		return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("gate", g), h.Attr("title", title), h.Class("font-mono"), label)
	}
	return Block{
		Slug:        "bloch-sphere",
		Title:       "Spin ½ and the Bloch sphere",
		Description: "Every pure state of a qubit (or a spin-½ particle) is a point on a sphere. Rotate it with gates, then measure along an axis: the Born rule gives each outcome's probability, and a measurement collapses the state onto that axis.",
		Tags:        []string{"qubit", "gates", "measurement"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("bloch",
				h.Div(h.Class("grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"),
					h.Svg(h.Data("sphere", ""), h.ViewBox("-1.45 -1.45 2.9 2.9"), h.Class("mx-auto block w-full max-w-[380px] touch-none select-none"), h.Role("img"), h.Aria("label", "Bloch sphere")),
					h.Div(h.Class("flex flex-col gap-3"),
						h.Div(h.Data("out", "ket"), h.Class("rounded-lg border bg-background px-3 py-2 font-mono text-xs leading-relaxed"), "—"),
						h.Svg(h.Data("hist", ""), h.ViewBox("0 0 200 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Measurement outcomes")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("State"),
					field("theta", "θ", "°", 60, 0, 180, 1),
					field("phi", "φ", "°", 60, 0, 359, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Gates"),
					h.Div(h.Class("grid grid-cols-5 gap-1.5"),
						gate("h", "H", "Hadamard"), gate("x", "X", "Pauli X (bit flip)"), gate("y", "Y", "Pauli Y"), gate("z", "Z", "Pauli Z (phase flip)"), gate("s", "S", "Phase gate (90°)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Measure along"),
					segs("Measurement axis", [2]string{"z", "z"}, [2]string{"x", "x"}, [2]string{"y", "y"}),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						qAction("measure", "Measure", hugeicons.Target02Icon()),
						qAction("many", "×1000 copies", hugeicons.DiceIcon()),
					),
				),
				readouts([2]string{"P(+)", "pp"}, [2]string{"P(−)", "pm"}, [2]string{"last result", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- Q6

func qUncertaintyBlock() Block {
	return Block{
		Slug:        "uncertainty",
		Title:       "Uncertainty principle",
		Description: "Position and momentum are a Fourier pair: squeeze the wave packet in x and it spreads in p. The product σₓσₚ is never below ħ/2, and only an unchirped Gaussian reaches the bound; both widths here are computed numerically, by a discrete Fourier transform.",
		Tags:        []string{"Fourier", "σₓσₚ ≥ ħ/2", "DFT"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("uncert",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("x", ""), h.ViewBox("0 0 320 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Position distribution")),
					h.Svg(h.Data("p", ""), h.ViewBox("0 0 320 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Momentum distribution")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Packet"),
					segs("Shape", [2]string{"gauss", "Gaussian"}, [2]string{"chirp", "Chirped"}, [2]string{"two", "Two humps"}),
					field("sx", "Width σ", "", 1, 0.3, 3, 0.05),
				),
				readouts([2]string{"σₓ", "sx"}, [2]string{"σₚ", "sp"}, [2]string{"σₓσₚ", "prod"}, [2]string{"bound", "bound"}),
				qUnits("Units: ħ = 1, so the bound is σₓσₚ ≥ 0.5. 512-point grid on x ∈ [−16, 16]."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q7

func qHydrogenBlock() Block {
	return Block{
		Slug:        "hydrogen",
		Title:       "Hydrogen spectrum",
		Description: "The Bohr energy levels Eₙ = −13.6 eV / n² and the light a jump between them emits. Pick the upper and lower levels: the Rydberg formula gives the wavelength, and the line takes its place in the Lyman (UV), Balmer (visible) or Paschen (infrared) series.",
		Tags:        []string{"Rydberg", "spectral series", "energy levels"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydrogen",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]"),
					h.Svg(h.Data("levels", ""), h.ViewBox("0 0 220 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Energy levels and the selected transition")),
					h.Div(h.Class("flex flex-col justify-center gap-4"),
						h.Svg(h.Data("spectrum", ""), h.ViewBox("0 0 400 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Emission lines by series")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Transition"),
					field("nu", "From n", "", 3, 2, 7, 1),
					field("nl", "To n", "", 2, 1, 6, 1),
				),
				readouts([2]string{"ΔE", "de"}, [2]string{"λ (vacuum)", "lambda"}, [2]string{"series", "series"}, [2]string{"region", "region"}),
				qUnits("R_H = 1.09678 × 10⁷ m⁻¹ (hydrogen, reduced mass); hc = 1239.84 eV·nm. Bohr model: no fine structure."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q8

func qPhotoelectricBlock() Block {
	return Block{
		Slug:        "photoelectric",
		Title:       "Photoelectric effect",
		Description: "Light knocks electrons out of a metal only if each photon carries more energy than the work function, however bright the light. Above threshold, brightness sets how many electrons leave and frequency sets how fast: K_max = hf − φ.",
		Tags:        []string{"photons", "work function", "Einstein 1905"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("photo",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("tube", ""), h.ViewBox("0 0 320 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Light hitting a metal plate")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 320 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Maximum kinetic energy against frequency")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Light"),
					field("lambda", "Wavelength", "nm", 400, 150, 800, 1),
					field("intensity", "Intensity", "%", 60, 0, 100, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Metal (typical φ)"),
					segs("Metal", [2]string{"2.28", "Na"}, [2]string{"2.1", "Cs"}, [2]string{"4.3", "Zn"}, [2]string{"4.7", "Cu"}),
				),
				readouts([2]string{"photon", "ephoton"}, [2]string{"φ", "phi"}, [2]string{"K_max", "kmax"}, [2]string{"stopping V", "vstop"}, [2]string{"threshold λ", "lthresh"}),
				qUnits("Work functions vary with surface and crystal face; these are typical values. E = hc/λ with hc = 1239.84 eV·nm."),
			)
		},
	}
}

// ---------------------------------------------------------------- Q9

func qBlackbodyBlock() Block {
	return Block{
		Slug:        "blackbody",
		Title:       "Blackbody radiation",
		Description: "Planck's law, the formula that started quantum theory in 1900. Heat the body and the peak slides to shorter wavelengths (Wien) while the total power grows as T⁴ (Stefan–Boltzmann). The classical Rayleigh–Jeans law agrees at long wavelengths and diverges at short ones: the ultraviolet catastrophe.",
		Tags:        []string{"Planck", "Wien", "UV catastrophe"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("blackbody",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "Planck"),
						legendSwatch("var(--vec-u)", "Rayleigh–Jeans"),
						legendSwatch("var(--foreground)", "Sun-like 5772 K"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Spectral radiance against wavelength")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Body"),
					field("temp", "Temperature", "K", 5000, 1000, 12000, 50),
					h.Div(h.Class("flex items-center gap-2 text-sm text-muted-foreground"),
						h.Span("Glows like"),
						h.Span(h.Data("swatch", ""), h.Class("h-5 flex-1 rounded-md border")),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("bb-rj", "rj", "Rayleigh–Jeans (classical)", true),
					toggle("bb-sun", "sun", "Compare with the Sun", false),
				),
				readouts([2]string{"peak λ", "peak"}, [2]string{"σT⁴", "total"}),
				qUnits("B_λ in kW·sr⁻¹·m⁻²·nm⁻¹. h = 6.62607 × 10⁻³⁴ J·s, c = 2.99792 × 10⁸ m/s, k = 1.38065 × 10⁻²³ J/K, b = 2.89777 × 10⁻³ m·K."),
			)
		},
	}
}
