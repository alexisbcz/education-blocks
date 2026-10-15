package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// SemiBlocks lists the semiconductor gallery in display order: carriers in
// a crystal, the pn junction and the MOS stack, then how chips are made and
// what they cost. Diode, BJT and MOSFET circuits live in Electronics; the
// solar cell in Energy.
func SemiBlocks() []Block {
	return []Block{
		semiFermiBlock(),
		semiCarriersBlock(),
		semiMobilityBlock(),
		semiJunctionBlock(),
		semiMOSBlock(),
		semiInverterBlock(),
		semiHallBlock(),
		semiProcessBlock(),
		semiLithoBlock(),
		semiYieldBlock(),
	}
}

func semiSVG(viewBox, label, class string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("block w-full select-none "+class), h.Role("img"), h.Aria("label", label))
}

func semiLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }),
	)
}

// ---------------------------------------------------------------- S1

func semiFermiBlock() Block {
	return Block{
		Slug:        "fermi-level",
		Title:       "Bands, Fermi–Dirac and the Fermi level",
		Description: "Electrons fill states by the Fermi–Dirac distribution f(E) = 1/(1 + e^((E−E_F)/kT)). Multiply by the density of states, which grows as √(E − E_c) above the conduction band edge, and you get the electrons; the holes mirror it below E_v. Doping moves E_F: the solver finds the level where the charges balance, p + N_D⁺ = n + N_A⁻, with donors and acceptors that may not all be ionized. Silicon, Boltzmann statistics (valid below about 10¹⁸ cm⁻³).",
		Tags:        []string{"Fermi–Dirac", "density of states", "charge neutrality"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-fermi",
				h.Div(
					semiSVG("0 0 600 330", "Energy bands with the density of states, the Fermi–Dirac distribution and the carrier densities", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--vec-u)", "electrons n(E)"}, [2]string{"var(--vec-j)", "holes p(E)"}, [2]string{"var(--brand)", "E_F"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Doping"),
					segs("Dopant", [2]string{"n", "Donors (P)"}, [2]string{"p", "Acceptors (B)"}, [2]string{"i", "Intrinsic"}),
					field("logn", "log₁₀ N", "cm⁻³", 16, 12, 18, 0.1),
					field("t", "Temperature", "K", 300, 50, 700, 5),
				),
				readouts([2]string{"n_i", "ni"}, [2]string{"n", "n"}, [2]string{"p", "p"}, [2]string{"E_F − E_i", "ef"}, [2]string{"E_c − E_F", "ecf"}, [2]string{"ionized", "ion"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func semiCarriersBlock() Block {
	return Block{
		Slug:        "carriers-vs-temperature",
		Title:       "Freeze-out, extrinsic, intrinsic",
		Description: "Electron density in n-type material from 20 K to 800 K. Cold, the donors hold on to their electrons (freeze-out). Warmer, every donor is ionized and n ≈ N_D, flat over hundreds of kelvin: the range devices are designed for. Hot, electrons jumping the whole gap outnumber the dopants and n follows n_i = √(N_c N_v)·e^(−E_g/2kT), with E_g(T) from Varshni's fit. Narrow-gap germanium leaves the flat range far sooner than silicon or GaAs.",
		Tags:        []string{"n_i(T)", "Varshni", "ionization"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-carriers",
				h.Div(
					semiSVG("0 0 600 320", "Electron density against temperature on a log scale", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--brand)", "n (electrons)"}, [2]string{"currentColor", "n_i, dashed"}, [2]string{"var(--vec-out)", "N_D"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Crystal"),
					segs("Material", [2]string{"si", "Si"}, [2]string{"ge", "Ge"}, [2]string{"gaas", "GaAs"}),
					field("logn", "log₁₀ N_D", "cm⁻³", 15, 13, 18, 0.1),
					field("t", "Cursor", "K", 300, 20, 800, 5),
				),
				readouts([2]string{"E_g(T)", "eg"}, [2]string{"n_i", "ni"}, [2]string{"n", "n"}, [2]string{"ionized", "ion"}, [2]string{"regime", "reg"}, [2]string{"flat range", "range"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func semiMobilityBlock() Block {
	return Block{
		Slug:        "mobility",
		Title:       "Mobility, drift and diffusion",
		Description: "Carriers scatter off ionized dopants, so mobility falls as doping rises: μ = μ_min + (μ_max − μ_min)/(1 + (N/N_ref)^α), the Caughey–Thomas form with Masetti et al. (1983) silicon parameters at 300 K. Resistivity ρ = 1/(q n μ) follows. The Einstein relation D = μ·kT/q links mobility to diffusion, and the current is the sum of the two: J = q n μ E + q D dn/dx.",
		Tags:        []string{"Caughey–Thomas", "resistivity", "Einstein relation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-mobility",
				h.Div(
					semiSVG("0 0 600 320", "Mobility or resistivity of silicon against doping, log-log", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--vec-u)", "electrons (n-type)"}, [2]string{"var(--vec-j)", "holes (p-type)"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Silicon, 300 K"),
					segs("Plot", [2]string{"mu", "Mobility"}, [2]string{"rho", "Resistivity"}),
					field("logn", "log₁₀ N", "cm⁻³", 16, 13, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Current in n-type"),
					field("e", "Field E", "V/cm", 100, 0, 2000, 10),
					field("grad", "dn/dx", "×N/µm", 0.01, -0.1, 0.1, 0.001),
				),
				readouts([2]string{"μ_n", "mun"}, [2]string{"μ_p", "mup"}, [2]string{"D_n", "dn"}, [2]string{"ρ (n-type)", "rhon"}, [2]string{"ρ (p-type)", "rhop"}, [2]string{"J drift", "jdr"}, [2]string{"J diffusion", "jdf"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func semiJunctionBlock() Block {
	return Block{
		Slug:        "pn-junction",
		Title:       "The pn junction, four linked pictures",
		Description: "The depletion approximation: next to the junction, mobile carriers are swept out and the fixed ions stay behind, −qN_A on the p side and +qN_D on the n side. Integrate the charge once for the field (a triangle, steepest at the junction), twice for the potential, and the band edges bend by q(V_bi − V). V_bi = (kT/q)·ln(N_A N_D/n_i²) and W = √(2ε(V_bi − V)/q · (1/N_A + 1/N_D)). Forward bias shrinks the barrier and splits the quasi-Fermi levels by qV; the lighter side holds most of the width. Silicon, 300 K.",
		Tags:        []string{"depletion approximation", "Poisson", "band bending"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-pn",
				h.Div(
					semiSVG("0 0 600 520", "Charge density, electric field, potential and band diagram across a pn junction", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--vec-j)", "p side, N_A⁻"}, [2]string{"var(--vec-u)", "n side, N_D⁺"}, [2]string{"var(--brand)", "quasi-Fermi levels"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Junction"),
					field("na", "log₁₀ N_A", "cm⁻³", 16, 14, 18, 0.1),
					field("nd", "log₁₀ N_D", "cm⁻³", 16, 14, 18, 0.1),
					field("v", "Bias V", "V", 0, -5, 0.6, 0.05),
				),
				readouts([2]string{"V_bi", "vbi"}, [2]string{"W", "w"}, [2]string{"x_p / x_n", "x"}, [2]string{"|E|max", "emax"}, [2]string{"barrier", "bar"}, [2]string{"C_j", "cj"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func semiMOSBlock() Block {
	return Block{
		Slug:        "mos-cv",
		Title:       "MOS capacitor, C–V curve",
		Description: "Metal, oxide, p-type silicon. Negative gate voltage pulls holes to the surface (accumulation: C = C_ox). Positive voltage pushes them away and a depletion layer adds a second capacitor in series, so C drops. Past the threshold V_T = V_FB + 2φ_F + √(4ε_s q N_A φ_F)/C_ox an electron layer forms (inversion). At low frequency it follows the signal and C climbs back to C_ox; at high frequency it can't, and C stays at its minimum. The surface charge is the exact solution of Poisson's equation (Sze); the high-frequency curve pins the depletion width at its maximum.",
		Tags:        []string{"accumulation", "inversion", "threshold voltage"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-mos",
				h.Div(
					semiSVG("0 0 600 320", "Capacitance over oxide capacitance against gate voltage", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--brand)", "low frequency"}, [2]string{"var(--vec-u)", "high frequency"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Stack"),
					field("na", "log₁₀ N_A", "cm⁻³", 17, 14, 18, 0.1),
					field("tox", "Oxide t_ox", "nm", 10, 1, 100, 0.5),
					field("vfb", "Flat band V_FB", "V", 0, -1.5, 1.5, 0.05),
				),
				readouts([2]string{"C_ox", "cox"}, [2]string{"φ_F", "phif"}, [2]string{"V_T", "vt"}, [2]string{"W_max", "wmax"}, [2]string{"C_min/C_ox", "cmin"}, [2]string{"Debye length", "ld"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

func semiInverterBlock() Block {
	return Block{
		Slug:        "cmos-inverter",
		Title:       "CMOS inverter transfer curve",
		Description: "An nMOS pulling down and a pMOS pulling up, both square-law transistors (k_n = 100 µA/V²) with channel-length modulation (the switch and the square law itself are in Electronics). Solving I_n = I_p for every input gives the transfer curve. Its two slope −1 points set V_IL and V_IH, and the noise margins are how far a logic level can drift before the next gate misreads it. Current flows only while both are on: the switching spike. Make the pMOS weaker and the switching point V_M slides down.",
		Tags:        []string{"VTC", "noise margins", "β ratio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-cmos",
				h.Div(
					semiSVG("0 0 600 330", "Output voltage and supply current against input voltage", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--brand)", "V_out"}, [2]string{"var(--vec-out)", "supply current"}, [2]string{"currentColor", "V_out = V_in, dashed"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Transistors"),
					field("vdd", "V_DD", "V", 1.8, 0.8, 5, 0.1),
					field("vtn", "V_Tn", "V", 0.45, 0.1, 1.2, 0.05),
					field("vtp", "|V_Tp|", "V", 0.45, 0.1, 1.2, 0.05),
					field("r", "k_n / k_p", "", 1, 0.2, 5, 0.1),
					field("lam", "λ", "1/V", 0.05, 0, 0.3, 0.01),
				),
				readouts([2]string{"V_M", "vm"}, [2]string{"V_IL / V_IH", "vil"}, [2]string{"V_OL / V_OH", "vol"}, [2]string{"NM_L", "nml"}, [2]string{"NM_H", "nmh"}, [2]string{"peak current", "ipk"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func semiHallBlock() Block {
	return Block{
		Slug:        "hall-effect",
		Title:       "Hall effect: sign and density of carriers",
		Description: "Push a current through a slab in a magnetic field. The Lorentz force bends the carriers toward one edge until the charge piling up there makes a field that balances it: the Hall voltage V_H = IB/(q p t). Its sign tells holes from electrons, which a resistance measurement cannot, and its size gives the density. That is how the carrier type of a new material is first measured. B points into the page.",
		Tags:        []string{"Lorentz force", "carrier type", "R_H"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-hall",
				semiSVG("0 0 600 320", "A slab carrying current in a magnetic field, with carriers deflected to one edge and the Hall voltage", "mx-auto max-w-[720px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sample"),
					segs("Carriers", [2]string{"n", "Electrons"}, [2]string{"p", "Holes"}),
					field("logn", "log₁₀ density", "cm⁻³", 16, 12, 23, 0.1),
					field("t", "Thickness", "µm", 500, 1, 2000, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Measurement"),
					field("i", "Current I", "mA", 1, 0.01, 100, 0.01),
					field("b", "Field B", "T", 0.5, 0.01, 2, 0.01),
				),
				readouts([2]string{"V_H", "vh"}, [2]string{"R_H", "rh"}, [2]string{"Hall field", "eh"}, [2]string{"drift speed", "vd"}, [2]string{"read back", "back"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func semiProcessBlock() Block {
	return Block{
		Slug:        "cmos-process",
		Title:       "Building a CMOS pair, step by step",
		Description: "A cross-section of one nMOS and one pMOS transistor as a simplified front-end flow builds them: isolation trenches, wells, a gate oxide a few nanometres thick, the polysilicon gates, light implants, spacers, heavy source and drain implants and an anneal, silicide, then the first insulator and the tungsten contacts. Each picture is to the order of the real flow, not to scale. Modern nodes swap in high-k metal gates and fins, but the order of ideas is the same.",
		Tags:        []string{"front end of line", "self-aligned", "cross-section"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("semi-process", ""),
				h.Div(h.Class("relative min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
					semiSVG("0 0 600 300", "Cross-section of a CMOS transistor pair during fabrication", "mx-auto max-w-[720px]"),
					h.Div(h.Data("legend", ""), h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 font-mono text-[11px] text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex items-center gap-2"),
						button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("step", "-1"), h.Aria("label", "Previous step"), hugeicons.ArrowLeft01Icon()),
						h.Span(h.Data("out", "count"), h.Class("min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground"), "1 / 11"),
						button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("step", "1"), h.Aria("label", "Next step"), hugeicons.ArrowRight01Icon()),
						button.Button(button.VariantOutline, button.SizeSm, h.Class("ml-auto"), h.Type("button"), h.Data("step", "reset"), hugeicons.RefreshIcon(), "Start"),
					),
					h.Div(h.Aria("live", "polite"), h.Class("flex flex-col gap-1.5"),
						h.P(h.Data("out", "title"), h.Class("text-sm font-medium"), "—"),
						h.P(h.Data("out", "text"), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground"), ""),
					),
					h.Ol(h.Data("steps", ""), h.Class("flex flex-col gap-0.5 border-t pt-3 text-xs")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func semiLithoBlock() Block {
	return Block{
		Slug:        "lithography",
		Title:       "How small can a scanner print?",
		Description: "A lens passes only diffraction orders that fit inside its numerical aperture. A grating of pitch p sends its first orders out at sin θ = λ/p; when they miss the lens, the image is flat and nothing prints. Tilting the light (partial coherence σ) lets one first order through with the zeroth, down to a half-pitch of λ/(2NA(1 + σ)): Rayleigh's R = k₁·λ/NA with k₁ ≥ 0.25. The picture sums the orders that pass, averaged over the source, to get the aerial image; the resist prints where it crosses the threshold. Depth of focus shrinks as λ/NA².",
		Tags:        []string{"Rayleigh", "k₁", "EUV"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-litho",
				h.Div(
					semiSVG("0 0 600 330", "Mask pattern and the aerial image intensity it produces", "mx-auto max-w-[720px]"),
					semiLegend([2]string{"var(--brand)", "aerial image"}, [2]string{"var(--vec-out)", "resist threshold"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scanner"),
					h.Div(h.Class("flex flex-col gap-1.5"),
						segs("Light", [2]string{"iline", "i-line"}, [2]string{"krf", "KrF"}, [2]string{"arf", "ArF"}),
						segs("Light, short", [2]string{"arfi", "ArF imm."}, [2]string{"euv", "EUV"}, [2]string{"euvh", "High-NA"}),
					),
					field("na", "NA", "", 1.35, 0.3, 1.4, 0.01),
					field("sigma", "Coherence σ", "", 0.8, 0, 1, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pattern"),
					field("hp", "Half-pitch", "nm", 45, 5, 400, 1),
				),
				readouts([2]string{"λ", "lam"}, [2]string{"k₁ of pattern", "k1"}, [2]string{"limit (k₁ = 0.25)", "rmin"}, [2]string{"orders through", "ord"}, [2]string{"contrast", "con"}, [2]string{"DOF ≈ λ/NA²", "dof"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func semiYieldBlock() Block {
	return Block{
		Slug:        "wafer-yield",
		Title:       "Dies per wafer, yield and cost",
		Description: "Square dies tiled on a round wafer, minus an edge ring. Random killer defects land at D₀ per cm²; a die with one is lost. The fraction that survive follows Poisson, Y = e^(−A·D₀), if defects are spread evenly, or Murphy's ((1 − e^(−AD₀))/(AD₀))² if their density varies from wafer to wafer. Bigger dies lose twice: fewer fit, and each is more likely to be hit. That is why large chips are split into chiplets. The gross-die formula is the usual πd²/4A − πd/√(2A).",
		Tags:        []string{"Poisson", "Murphy", "cost per die"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("semi-yield",
				h.Div(
					semiSVG("0 0 640 320", "A wafer map with good and defective dies, and yield against die area", "mx-auto max-w-[760px]"),
					semiLegend([2]string{"var(--brand)", "good die"}, [2]string{"var(--code-del)", "killed by a defect"}, [2]string{"var(--vec-u)", "Poisson"}, [2]string{"var(--vec-out)", "Murphy"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Die and wafer"),
					segs("Wafer", [2]string{"300", "300 mm"}, [2]string{"200", "200 mm"}),
					field("w", "Die width", "mm", 10, 1, 30, 0.5),
					field("hgt", "Die height", "mm", 10, 1, 30, 0.5),
					field("d0", "D₀", "/cm²", 0.1, 0, 2, 0.01),
					field("cost", "Wafer cost", "$", 10000, 500, 30000, 100),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.DiceIcon(), "New wafer"),
				readouts([2]string{"dies (counted)", "dies"}, [2]string{"gross formula", "gross"}, [2]string{"good (this wafer)", "good"}, [2]string{"Poisson", "poi"}, [2]string{"Murphy", "mur"}, [2]string{"$ per good die", "cpd"}),
			)
		},
	}
}
