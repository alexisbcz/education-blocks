package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AerospaceBlocks lists the aerospace gallery in display order.
func AerospaceBlocks() []Block {
	return []Block{
		aeroTunnelBlock(),
		aeroForcesBlock(),
		aeroISABlock(),
		aeroAirfoilBlock(),
		aeroNACABlock(),
		aeroPitotBlock(),
		aeroVnBlock(),
		aeroTurnBlock(),
		aeroBreguetBlock(),
		aeroRotorBlock(),
	}
}

// aeroFigure embeds an isometric figure built by figures/<name>/build.mjs
// (from our own sources at build time, never user input).
func aeroFigure(name string) h.Node {
	b, err := static.ReadFile("static/anatomy/" + name + ".html")
	if err != nil {
		return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/"+name+"/build.mjs to build the figure.")
	}
	return h.Div(h.Class("mx-auto w-full max-w-3xl"),
		h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/"+name+".css")),
		h.UnsafeHTML(string(b)))
}

func aeroSvg(viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", label))
}

func aeroNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- 1

func aeroTunnelBlock() Block {
	return Block{
		Slug:        "wind-tunnel",
		Title:       "Wind tunnel",
		Description: "A benchtop open-jet tunnel: air drawn through a honeycomb and a contraction into the test section, where a small wing sits on a two-component balance. Turn the angle-of-attack knob (← →) or the fan (↑ ↓) and watch the lift and drag dials, and the manometer reading the pitot tube. The balance uses the same lift model as the airfoil block below.",
		Tags:        []string{"isometric SVG", "anatomy", "balance"},
		Wide:        true,
		Render:      func() h.Node { return aeroFigure("aerospace-tunnel") },
	}
}

// ---------------------------------------------------------------- 2

func aeroForcesBlock() Block {
	return Block{
		Slug:        "four-forces",
		Title:       "Four forces and the glide",
		Description: "In steady flight lift balances weight and thrust balances drag. Give the aircraft more thrust than drag and it climbs, at sin γ = (T − D)/W; cut the engine and it glides, at tan γ = 1/(L/D), so the glide ratio is the lift-to-drag ratio itself.",
		Tags:        []string{"equilibrium", "climb", "glide ratio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-forces",
				aeroSvg("0 0 560 340", "Forces on an aircraft and its flight path"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Aircraft"),
					field("mass", "Mass", "kg", 1100, 100, 80000, 10),
					field("ld", "L/D", "", 12, 3, 60, 0.5),
					field("thrust", "Thrust", "% of drag", 130, 0, 300, 1),
					field("alt", "Height", "m", 1000, 0, 12000, 50),
				),
				readouts([2]string{"weight", "w"}, [2]string{"drag", "d"}, [2]string{"path angle", "gamma"}, [2]string{"glide range", "range"}),
				aeroNote("Small-angle steady flight: L ≈ W. Engine off, the still-air glide range from the given height is h × L/D."),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func aeroISABlock() Block {
	return Block{
		Slug:        "isa-lift",
		Title:       "The atmosphere and the lift equation",
		Description: "The International Standard Atmosphere in the troposphere: temperature falls 6.5 K per kilometre from 288.15 K, and pressure and density follow exactly from hydrostatics and the gas law. Lift L = ½ρv²S·CL then tells how much faster a wing must fly at altitude to carry the same weight.",
		Tags:        []string{"ISA", "density", "lift equation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-isa",
				aeroSvg("0 0 560 340", "Temperature, pressure and density against altitude"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Flight"),
					field("alt", "Altitude", "m", 3000, 0, 11000, 50),
					field("v", "Airspeed (TAS)", "m/s", 60, 5, 300, 1),
					field("area", "Wing area S", "m²", 16.2, 0.5, 900, 0.1),
					field("cl", "CL", "", 0.4, 0, 2.5, 0.01),
				),
				readouts([2]string{"T", "t"}, [2]string{"p", "p"}, [2]string{"ρ", "rho"}, [2]string{"σ = ρ/ρ₀", "sigma"}, [2]string{"lift", "lift"}),
				aeroNote("ISA troposphere (to 11 km): T = 288.15 − 0.0065 h K, p = 101325 (T/288.15)^5.2559 Pa, ρ = p / (287.053 T)."),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func aeroAirfoilBlock() Block {
	return Block{
		Slug:        "airfoil",
		Title:       "Lift curve and drag polar",
		Description: "The idealised wing the tunnel tests: thin-airfoil theory gives CL = 2πα until the flow separates near 15°, and the drag is a parasite part plus the induced drag of a finite wing, CD = CD0 + CL²/(πeAR). The best lift-to-drag ratio sits where the two drags are equal.",
		Tags:        []string{"thin airfoil", "stall", "L/D"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-airfoil",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("cl", ""), h.ViewBox("0 0 300 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Lift coefficient against angle of attack")),
					h.Svg(h.Data("polar", ""), h.ViewBox("0 0 300 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Drag polar")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Wing"),
					field("alpha", "Angle α", "°", 6, -6, 24, 0.5),
					field("ar", "Aspect ratio", "", 3, 1, 30, 0.5),
					field("e", "Oswald e", "", 0.85, 0.5, 1, 0.01),
					field("cd0", "CD0", "", 0.02, 0.005, 0.1, 0.001),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("aero-finite", "finite", "Finite-wing lift slope", false)),
				readouts([2]string{"CL", "cl"}, [2]string{"CD", "cd"}, [2]string{"L/D", "ld"}, [2]string{"(L/D)max", "ldmax"}),
				aeroNote("The finite-wing slope is a = 2π / (1 + 2π/(πeAR)), the lifting-line correction. Post-stall values are a smooth stand-in, not data."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func aeroNACABlock() Block {
	return Block{
		Slug:        "naca",
		Title:       "NACA four-digit airfoils",
		Description: "The NACA series encodes a section in four digits: maximum camber in percent of chord, its position in tenths, and thickness in percent. Type a code and the section is drawn from the published formulas, with the mean camber line and the point of maximum thickness.",
		Tags:        []string{"geometry", "camber", "thickness"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-naca",
				aeroSvg("0 0 560 260", "Airfoil section"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Section"),
					h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
						h.Span(h.Class("text-muted-foreground"), "NACA"),
						h.Input(h.Type("text"), h.Data("code", ""), h.Value("2412"), h.Attr("inputmode", "numeric"), h.Attr("maxlength", "4"), h.Attr("autocomplete", "off"),
							h.Aria("label", "NACA four-digit code"),
							h.Class("h-9 w-24 rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
					),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([]string{"0012", "2412", "4412", "6409"}, func(c string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", c), c)
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("aero-te", "closed", "Closed trailing edge", false)),
				readouts([2]string{"max camber", "m"}, [2]string{"at", "p"}, [2]string{"thickness", "t"}, [2]string{"thickest at", "tx"}),
				aeroNote("y_t = 5t(0.2969√x − 0.1260x − 0.3516x² + 0.2843x³ − 0.1015x⁴), applied normal to the camber line; the closed trailing edge uses −0.1036x⁴."),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func aeroPitotBlock() Block {
	return Block{
		Slug:        "pitot-static",
		Title:       "Pitot-static airspeed",
		Description: "A pitot tube brings the air to rest and reads the total pressure; static ports read the ambient pressure. Their difference is the dynamic pressure ½ρv², which the airspeed indicator converts at sea-level density: that is the indicated airspeed. True airspeed is higher at altitude by √(ρ₀/ρ).",
		Tags:        []string{"Bernoulli", "IAS", "TAS"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-pitot",
				aeroSvg("0 0 560 300", "Pitot-static system"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Instrument"),
					field("ias", "Indicated airspeed", "kt", 120, 10, 400, 1),
					field("alt", "Altitude", "m", 3000, 0, 11000, 50),
				),
				readouts([2]string{"q", "q"}, [2]string{"ρ", "rho"}, [2]string{"TAS", "tas"}, [2]string{"TAS − IAS", "gain"}),
				aeroNote("Incompressible: valid below about Mach 0.3; faster, the instrument's calibration (CAS, EAS) also corrects for compressibility. 1 kt = 0.514444 m/s."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func aeroVnBlock() Block {
	return Block{
		Slug:        "v-n-diagram",
		Title:       "Flight envelope (V–n diagram)",
		Description: "How hard an aircraft may pull. Below the manoeuvring speed the wing stalls before it can overload the structure; above it, a full pull would break the airframe, so the limit load factor bounds the envelope. Drag the point or step it with the arrow keys.",
		Tags:        []string{"load factor", "stall speed", "envelope"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-vn",
				aeroSvg("0 0 560 340", "Load factor against airspeed"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Aircraft"),
					field("ws", "Wing loading", "N/m²", 700, 100, 8000, 10),
					field("clmax", "CLmax", "", 1.6, 0.8, 3, 0.05),
					field("nmax", "Limit n+", "g", 3.8, 2, 9, 0.1),
					field("vd", "Dive speed VD", "m/s", 90, 30, 300, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Point"),
					field("v", "Airspeed", "m/s", 50, 0, 300, 1),
					field("n", "Load factor", "g", 2, -3, 9, 0.1),
				),
				readouts([2]string{"stall speed", "vs"}, [2]string{"manoeuvring VA", "va"}, [2]string{"this point", "state"}),
				aeroNote("Sea-level density. The negative limit is taken as 0.4 × n+, as in normal-category rules (−1.52 for 3.8); real certification envelopes add gust lines."),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func aeroTurnBlock() Block {
	return Block{
		Slug:        "turning-flight",
		Title:       "Turning flight",
		Description: "To turn, the aircraft banks and lets lift pull it sideways. In a level turn the vertical part of lift still carries the weight, so lift and load factor grow as 1/cos φ: a 60° bank is 2 g, and the stall speed rises by √n. The circle below is the turn seen from above, to scale.",
		Tags:        []string{"bank angle", "load factor", "radius"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-turn",
				aeroSvg("0 0 560 320", "Turn radius seen from above, and the bank"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Turn"),
					field("bank", "Bank φ", "°", 30, 0, 80, 1),
					field("v", "True airspeed", "m/s", 60, 10, 300, 1),
					field("vs", "1 g stall speed", "m/s", 25, 10, 120, 1),
				),
				readouts([2]string{"load factor", "n"}, [2]string{"radius", "r"}, [2]string{"rate", "rate"}, [2]string{"360° in", "time"}, [2]string{"stall speed", "vsn"}),
				aeroNote("Level, coordinated turn: n = 1/cos φ, r = v²/(g tan φ), ω = g tan φ / v. A standard-rate turn is 3°/s."),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func aeroBreguetBlock() Block {
	return Block{
		Slug:        "breguet-range",
		Title:       "Breguet range",
		Description: "How far an aircraft can fly on its fuel: range grows with efficiency of the engine, aerodynamic efficiency (L/D) and the logarithm of the take-off to landing weight ratio, exactly as the rocket equation does with mass ratio.",
		Tags:        []string{"range", "fuel fraction", "L/D"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-breguet",
				aeroSvg("0 0 560 300", "Range against weight ratio"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Engine"),
					segs("Engine type", [2]string{"jet", "Jet"}, [2]string{"prop", "Propeller"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Aircraft"),
					field("v", "Cruise speed", "m/s", 230, 30, 300, 1),
					field("ld", "L/D", "", 17, 4, 40, 0.5),
					field("tsfc", "TSFC", "g/(kN·s)", 15.6, 5, 40, 0.1),
					field("bsfc", "BSFC", "g/(kW·h)", 270, 150, 450, 1),
					field("eta", "Propeller η", "", 0.8, 0.4, 0.95, 0.01),
					field("ratio", "W₀ / W₁", "", 1.4, 1.01, 3, 0.01),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "airliner"), "Airliner ≈"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "light"), "Light aircraft ≈"),
				),
				readouts([2]string{"range", "range"}, [2]string{"fuel fraction", "fuel"}),
				aeroNote("Jet: R = (V / (g·TSFC)) · (L/D) · ln(W₀/W₁). Propeller: R = (η / (g·BSFC)) · (L/D) · ln(W₀/W₁). Constant speed and L/D (cruise-climb); presets are typical values, not a specific aircraft."),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func aeroRotorBlock() Block {
	return Block{
		Slug:        "rotor-hover",
		Title:       "Rotor in hover",
		Description: "Momentum theory: a rotor makes thrust by pushing air down through its disc. Lifting the same weight with a bigger disc means moving more air more slowly, which costs less power: the ideal induced velocity is √(T/2ρA) and the ideal power T·vi.",
		Tags:        []string{"momentum theory", "disc loading", "power"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aero-rotor",
				aeroSvg("0 0 560 320", "Hover power against rotor radius"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rotorcraft"),
					field("mass", "Mass", "kg", 1200, 0.2, 20000, 1),
					field("radius", "Rotor radius", "m", 5, 0.05, 15, 0.05),
					field("fm", "Figure of merit", "", 0.7, 0.4, 0.85, 0.01),
					field("alt", "Altitude", "m", 0, 0, 6000, 50),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "heli"), hugeicons.HelicopterIcon(), "Light helicopter ≈"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "drone"), hugeicons.DroneIcon(), "Quadcopter rotor ≈"),
				),
				readouts([2]string{"disc loading", "dl"}, [2]string{"induced velocity", "vi"}, [2]string{"ideal power", "pi"}, [2]string{"shaft power", "p"}),
				aeroNote("Ideal hover: vi = √(T / 2ρA), P = T·vi; the figure of merit (typically 0.6–0.8) accounts for profile drag and losses. The quadcopter preset is one of four rotors."),
			)
		},
	}
}
