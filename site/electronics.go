package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ElectronicsBlocks lists the electronics gallery in display order: devices
// and analog circuits. DC networks, RC charging and RLC resonance live in
// Electromagnetism & Circuits; adders and the CPU in Computer Architecture.
func ElectronicsBlocks() []Block {
	return []Block{
		elecDiodeBlock(),
		elecRectifierBlock(),
		elecZenerBlock(),
		elecLEDBlock(),
		elecBJTBlock(),
		elecMOSFETBlock(),
		elecOpAmpBlock(),
		elecFilterBlock(),
		elec555Block(),
		elecColorCodeBlock(),
	}
}

func elecSVG(attr, viewBox, label, class string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full select-none "+class), h.Role("img"), h.Aria("label", label))
}

// ---------------------------------------------------------------- EL1

func elecDiodeBlock() Block {
	return Block{
		Slug:        "diode",
		Title:       "Diode I–V curve",
		Description: "The Shockley equation I = Iₛ(e^(V/nV_T) − 1), with the thermal voltage V_T = kT/q (25.85 mV at 300 K). On a log scale the forward current is a straight line: every decade costs n·V_T·ln 10 ≈ 60 mV for n = 1. Heat the junction and Iₛ grows, so the same current needs less voltage.",
		Tags:        []string{"Shockley", "thermal voltage", "log scale"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-diode",
				elecSVG("plot", "0 0 560 320", "Diode current against voltage", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Junction"),
					field("is", "log₁₀ Iₛ", "A", -14, -16, -8, 0.1),
					field("n", "Ideality n", "", 1, 1, 2, 0.01),
					field("t", "Temperature", "°C", 27, -40, 125, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Axis"),
					segs("Scale", [2]string{"lin", "Linear"}, [2]string{"log", "Log"}),
				),
				readouts([2]string{"V_T", "vt"}, [2]string{"V at 1 mA", "v1"}, [2]string{"V at 10 mA", "v10"}, [2]string{"r_d at 10 mA", "rd"}, [2]string{"per decade", "dec"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL2

func elecRectifierBlock() Block {
	return Block{
		Slug:        "rectifier",
		Title:       "Rectifier and smoothing capacitor",
		Description: "A sine through diodes into a capacitor and a load. Half-wave refills the capacitor once per cycle, a bridge twice, so its ripple is about half: ΔV ≈ I/(f_r·C) with f_r = f or 2f. The bridge pays two diode drops instead of one. The simulation uses diodes with a fixed forward drop.",
		Tags:        []string{"bridge", "ripple", "time-stepped"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-rect",
				elecSVG("plot", "0 0 560 300", "Input, rectified and smoothed voltage against time", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Circuit"),
					segs("Rectifier", [2]string{"full", "Bridge"}, [2]string{"half", "Half-wave"}),
					field("vpk", "Peak in", "V", 17, 3, 40, 0.5),
					field("f", "Mains", "Hz", 50, 40, 70, 1),
					field("c", "C", "µF", 1000, 10, 10000, 10),
					field("rl", "Load", "Ω", 100, 10, 2000, 5),
					field("vf", "Diode drop", "V", 0.7, 0.2, 1.2, 0.05),
				),
				readouts([2]string{"DC average", "vdc"}, [2]string{"ripple p–p", "rip"}, [2]string{"≈ I/(f_r C)", "ripx"}, [2]string{"load current", "il"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL3

func elecZenerBlock() Block {
	return Block{
		Slug:        "zener",
		Title:       "Zener regulator",
		Description: "A series resistor drops the difference between the supply and the Zener voltage; the Zener takes whatever current the load does not. It regulates while I_Z stays above a small minimum, and the worst case for its power is no load at all. Sweep the load and watch where regulation breaks.",
		Tags:        []string{"shunt regulator", "power rating", "load line"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-zener",
				elecSVG("plot", "0 0 560 300", "Output voltage and Zener current against load resistance", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Regulator"),
					field("vin", "Supply", "V", 12, 5, 30, 0.5),
					field("rs", "R series", "Ω", 220, 10, 2000, 5),
					field("vz", "V_Z", "V", 5.1, 2.4, 15, 0.1),
					field("rl", "Load", "Ω", 470, 50, 5000, 10),
					field("izmin", "I_Z min", "mA", 1, 0.1, 10, 0.1),
				),
				readouts([2]string{"V out", "vo"}, [2]string{"I series", "is"}, [2]string{"I Zener", "iz"}, [2]string{"P Zener", "pz"}, [2]string{"P at no load", "pz0"}, [2]string{"state", "state"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL4

func elecLEDBlock() Block {
	presets := [][2]string{{"2.0", "Red"}, {"2.1", "Yellow"}, {"2.2", "Green (GaP)"}, {"3.0", "Blue"}, {"3.1", "White"}}
	return Block{
		Slug:        "led-resistor",
		Title:       "LED resistor calculator",
		Description: "R = (V_s − V_f)/I_f, then the next standard value up so the current never exceeds the target, the real current that gives, and a power rating with a 2× margin. Forward voltages are typical for each colour; read the datasheet for a real part.",
		Tags:        []string{"E12/E24", "Ohm's law", "power rating"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-5"), h.Data("elec-led", ""),
				h.Div(h.Class("grid gap-5 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Circuit"),
						field("vs", "Supply", "V", 5, 1.5, 24, 0.1),
						field("vf", "LED V_f", "V", 2, 1.6, 3.6, 0.05),
						field("if", "Current", "mA", 20, 1, 50, 0.5),
						h.Div(h.Class("flex flex-wrap gap-1.5 pt-1"),
							h.Map(presets, func(p [2]string) h.Node {
								return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("vf", p[0]), p[1]+" ≈ "+p[0]+" V")
							}),
						),
						h.Div(h.Class("pt-2"), segs("Series", [2]string{"e12", "E12"}, [2]string{"e24", "E24"})),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						h.Svg(h.Data("schematic", ""), h.ViewBox("0 0 260 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Supply, resistor and LED in series")),
						readouts([2]string{"exact R", "rx"}, [2]string{"standard R", "rs"}, [2]string{"real current", "ireal"}, [2]string{"P resistor", "pr"}, [2]string{"rating", "rating"}, [2]string{"P LED", "pled"}),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- EL5

func elecBJTBlock() Block {
	return Block{
		Slug:        "bjt-amplifier",
		Title:       "BJT common-emitter amplifier",
		Description: "Voltage-divider bias, solved with the base current included (Thevenin source into the base, I_B = (V_Th − V_BE)/(R_Th + (β+1)R_E)). The Q-point sits on the DC load line; the small-signal gain is −g_m·R_C with the emitter bypassed, or −R_C/(r_e + R_E) without, where g_m = I_C/V_T.",
		Tags:        []string{"Q-point", "load line", "small signal"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-bjt",
				elecSVG("plot", "0 0 560 320", "Collector current against collector-emitter voltage with the load line and Q-point", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Bias"),
					field("vcc", "V_CC", "V", 12, 3, 30, 0.5),
					field("r1", "R₁", "kΩ", 47, 1, 470, 1),
					field("r2", "R₂", "kΩ", 10, 1, 470, 1),
					field("rc", "R_C", "kΩ", 4.7, 0.1, 47, 0.1),
					field("re", "R_E", "kΩ", 1, 0, 10, 0.1),
					field("beta", "β", "", 150, 20, 500, 5),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("elec-bjt-bypass", "bypass", "R_E bypassed (C_E)", true)),
				readouts([2]string{"I_C", "ic"}, [2]string{"V_CE", "vce"}, [2]string{"region", "region"}, [2]string{"g_m", "gm"}, [2]string{"gain", "gain"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL6

func elecMOSFETBlock() Block {
	return Block{
		Slug:        "mosfet",
		Title:       "MOSFET: switch and square law",
		Description: "Output curves from the square-law model, I_D = (k/2)(V_GS − V_th)² in saturation and k((V_GS − V_th)V_DS − V_DS²/2) in the triode region. As a switch the transistor sits deep in triode: loss is I²R_DS(on) while on, plus about ½·V·I·(t_r + t_f)·f each cycle while switching, with the transition time set by gate charge over gate current.",
		Tags:        []string{"square law", "conduction loss", "gate charge"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-mos",
				elecSVG("plot", "0 0 560 320", "Drain current against drain-source voltage for several gate voltages", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Device"),
					field("vth", "V_th", "V", 2, 0.5, 4, 0.1),
					field("k", "k", "A/V²", 0.5, 0.05, 5, 0.05),
					field("vgs", "V_GS", "V", 5, 0, 12, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("As a switch"),
					field("v", "Supply", "V", 24, 3, 60, 1),
					field("i", "Load", "A", 5, 0.1, 30, 0.1),
					field("rds", "R_DS(on)", "mΩ", 20, 1, 500, 1),
					field("qg", "Gate charge", "nC", 30, 1, 200, 1),
					field("ig", "Gate drive", "A", 0.5, 0.01, 3, 0.01),
					field("fsw", "Switching", "kHz", 50, 1, 500, 1),
				),
				readouts([2]string{"region", "region"}, [2]string{"I_D at V_GS", "id"}, [2]string{"conduction", "pcond"}, [2]string{"t_sw", "tsw"}, [2]string{"switching", "psw"}, [2]string{"total", "ptot"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL7

func elecOpAmpBlock() Block {
	return Block{
		Slug:        "op-amp",
		Title:       "Op-amp configurations",
		Description: "The ideal op-amp rules (no input current, inputs at equal voltage under negative feedback) solve each circuit in one line. The output clips at the supply rails. A real amplifier trades gain for bandwidth: the closed-loop bandwidth is about GBW divided by the noise gain 1 + R_f/R_in.",
		Tags:        []string{"negative feedback", "Schmitt trigger", "GBW"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-opamp",
				h.Div(h.Class("flex flex-col gap-2"),
					elecSVG("schematic", "0 0 560 170", "Op-amp circuit schematic", "mx-auto max-w-[620px]"),
					elecSVG("plot", "0 0 560 230", "Input and output waveforms", "mx-auto max-w-[640px]"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Circuit"),
					h.Select(h.Data("config", ""), h.Aria("label", "Configuration"),
						h.Class("h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						h.Option(h.Value("inverting"), "Inverting"),
						h.Option(h.Value("noninverting"), "Non-inverting"),
						h.Option(h.Value("follower"), "Voltage follower"),
						h.Option(h.Value("summing"), "Summing (2 inputs)"),
						h.Option(h.Value("integrator"), "Integrator"),
						h.Option(h.Value("differentiator"), "Differentiator"),
						h.Option(h.Value("schmitt"), "Schmitt trigger"),
					),
					field("rin", "R_in", "kΩ", 10, 1, 1000, 1),
					field("rf", "R_f", "kΩ", 47, 1, 1000, 1),
					field("cap", "C", "nF", 100, 1, 10000, 1),
					field("amp", "Input amp.", "V", 1, 0.05, 10, 0.05),
					field("freq", "Input freq.", "Hz", 100, 1, 10000, 1),
					field("rail", "Rails ±", "V", 12, 3, 18, 0.5),
					field("gbw", "GBW", "MHz", 1, 0.1, 100, 0.1),
				),
				readouts([2]string{"formula", "formula"}, [2]string{"gain", "gain"}, [2]string{"output peak", "vout"}, [2]string{"bandwidth", "bw"}, [2]string{"note", "note"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL8

func elecFilterBlock() Block {
	return Block{
		Slug:        "rc-filter",
		Title:       "Passive RC and RL filters",
		Description: "Size a first-order filter: pick the cutoff and one component, get the other, then round it to E24 and see where the cutoff really lands. The −3 dB point is f_c = 1/(2πRC) (or R/(2πL)); the slope beyond it is 20 dB per decade and the phase passes ∓45° at f_c.",
		Tags:        []string{"Bode", "component sizing", "E24"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-filter",
				elecSVG("plot", "0 0 560 340", "Magnitude and phase of the filter against frequency", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Filter"),
					segs("Type", [2]string{"rc-lp", "RC low"}, [2]string{"rc-hp", "RC high"}, [2]string{"rl-lp", "RL low"}, [2]string{"rl-hp", "RL high"}),
					field("fc", "Target f_c", "Hz", 1000, 1, 100000, 1),
					field("comp", "C or L", "nF / mH", 100, 0.1, 10000, 0.1),
				),
				readouts([2]string{"exact R", "rx"}, [2]string{"E24 R", "r24"}, [2]string{"real f_c", "fc"}, [2]string{"error", "err"}, [2]string{"a decade out", "dec"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL9

func elec555Block() Block {
	return Block{
		Slug:        "timer-555",
		Title:       "555 timer, astable",
		Description: "The capacitor charges through R₁ + R₂ and discharges through R₂ alone, bouncing between ⅓ and ⅔ of the supply. Each half lasts ln 2 ≈ 0.693 time constants, so f = 1/(0.693(R₁ + 2R₂)C) ≈ 1.44/((R₁ + 2R₂)C), and the duty cycle is (R₁ + R₂)/(R₁ + 2R₂), always above 50% in this basic circuit.",
		Tags:        []string{"oscillator", "duty cycle", "waveforms"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("elec-555",
				elecSVG("plot", "0 0 560 300", "Capacitor voltage and output against time", "mx-auto max-w-[640px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Timing"),
					field("r1", "R₁", "kΩ", 1, 0.1, 1000, 0.1),
					field("r2", "R₂", "kΩ", 10, 0.1, 1000, 0.1),
					field("c", "C", "µF", 10, 0.001, 1000, 0.001),
					field("vcc", "V_CC", "V", 9, 4.5, 16, 0.5),
				),
				readouts([2]string{"t high", "th"}, [2]string{"t low", "tl"}, [2]string{"frequency", "f"}, [2]string{"duty cycle", "duty"}),
			)
		},
	}
}

// ---------------------------------------------------------------- EL10

// The IEC 60062 colour code: digit, multiplier exponent, tolerance and
// temperature coefficient for each colour, with the colours drawn.
type elecBand struct {
	name, color string
	digit, mult int // −1 when the colour has no digit
	tol         string
	tempco      string
}

var elecBands = []elecBand{
	{"black", "#1a1a1a", 0, 0, "", "250 ppm/K"},
	{"brown", "#7b4a2a", 1, 1, "±1%", "100 ppm/K"},
	{"red", "#d32f2f", 2, 2, "±2%", "50 ppm/K"},
	{"orange", "#f57c00", 3, 3, "±0.05%", "15 ppm/K"},
	{"yellow", "#fbc02d", 4, 4, "±0.02%", "25 ppm/K"},
	{"green", "#388e3c", 5, 5, "±0.5%", "20 ppm/K"},
	{"blue", "#1976d2", 6, 6, "±0.25%", "10 ppm/K"},
	{"violet", "#7b1fa2", 7, 7, "±0.1%", "5 ppm/K"},
	{"grey", "#9e9e9e", 8, 8, "±0.01%", "1 ppm/K"},
	{"white", "#f5f5f5", 9, 9, "", ""},
	{"gold", "#c9a227", -1, -1, "±5%", ""},
	{"silver", "#b0b0b0", -1, -2, "±10%", ""},
}

func elecColorCodeBlock() Block {
	return Block{
		Slug:        "color-code",
		Title:       "Resistor colour code",
		Description: "Read or write the IEC 60062 code: 4 bands are two digits, a multiplier and a tolerance; 5 bands add a third digit; 6 bands add a temperature coefficient. Click a band to change it, or type a value like 4k7 or 220 to get its bands.",
		Tags:        []string{"IEC 60062", "decoder", "encoder"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-5"), h.Data("elec-colors", ""),
				h.Script(h.Type("application/json"), h.Data("bands", ""), h.UnsafeJS(elecBandsJSON())),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Bands", [2]string{"4", "4 bands"}, [2]string{"5", "5 bands"}, [2]string{"6", "6 bands"}),
					h.Label(h.Class("flex items-center gap-2 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "Value"),
						h.Input(h.Type("text"), h.Data("value-input", ""), h.Value("1k"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
							h.Aria("label", "Resistance, e.g. 4k7"),
							h.Class("h-9 w-28 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("encode", ""), hugeicons.ArrowRight01Icon(), "Bands"),
					),
				),
				h.Svg(h.Data("resistor", ""), h.ViewBox("0 0 560 140"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Resistor with coloured bands")),
				h.Div(h.Data("pickers", ""), h.Class("grid gap-2")),
				h.Div(h.Class("flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t pt-4"),
					h.Span(h.Data("out", "value"), h.Class("font-mono text-2xl font-medium tabular-nums"), "—"),
					h.Span(h.Data("out", "detail"), h.Class("font-mono text-xs text-muted-foreground"), ""),
				),
			)
		},
	}
}

func elecBandsJSON() string {
	s := "["
	for i, b := range elecBands {
		if i > 0 {
			s += ","
		}
		s += fmt.Sprintf(`{"name":%q,"color":%q,"digit":%d,"mult":%d,"tol":%q,"tempco":%q}`, b.name, b.color, b.digit, b.mult, b.tol, b.tempco)
	}
	return s + "]"
}
