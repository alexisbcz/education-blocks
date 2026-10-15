package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// EnergyBlocks lists the energy systems gallery in display order.
func EnergyBlocks() []Block {
	return []Block{
		nrgTurbineBlock(),
		nrgBetzBlock(),
		nrgSolarCellBlock(),
		nrgTiltBlock(),
		nrgBatteryBlock(),
		nrgGridBlock(),
		nrgStorageBlock(),
		nrgSankeyBlock(),
		nrgHeatPumpBlock(),
		nrgLCOEBlock(),
		nrgMixBlock(),
	}
}

// nrgFigure embeds the isometric figure built by figures/energy-turbine/build.mjs
// (from our own sources at build time, never user input).
func nrgFigure(name string) h.Node {
	b, err := static.ReadFile("static/anatomy/" + name + ".html")
	if err != nil {
		return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/"+name+"/build.mjs to build the figure.")
	}
	return h.Div(h.Class("mx-auto w-full max-w-3xl"),
		h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/"+name+".css")),
		h.UnsafeHTML(string(b)))
}

func nrgButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func nrgNote(text string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), text)
}

// ---------------------------------------------------------------- E1

func nrgTurbineBlock() Block {
	return Block{
		Slug:        "wind-turbine",
		Title:       "Wind turbine nacelle",
		Description: "A geared 3.5 MW turbine with its cover off. The wind speed drives everything: below rated wind the rotor speeds up to keep the best tip speed ratio, above it the speed is held and the blades pitch to shed power, and past cut-out they feather and the rotor stops. Arrow keys change the wind.",
		Tags:        []string{"isometric SVG", "anatomy", "pitch control"},
		Wide:        true,
		Render:      func() h.Node { return nrgFigure("energy-turbine") },
	}
}

// ---------------------------------------------------------------- E2

func nrgBetzBlock() Block {
	return Block{
		Slug:        "betz",
		Title:       "The Betz limit",
		Description: "Why no turbine can take more than 59.3% of the wind's power. A rotor slows the air by a fraction a; momentum theory gives the power coefficient Cp = 4a(1 − a)², which peaks at a = 1/3. Stop the air completely and nothing flows through; leave it untouched and nothing is taken.",
		Tags:        []string{"momentum theory", "optimum", "Cp"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-betz",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("tube", ""), h.ViewBox("0 0 560 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Stream tube through the rotor")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Power and thrust coefficients against the induction factor")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rotor"),
					field("a", "Induction a", "", 0.2, 0, 0.5, 0.01),
				),
				nrgButton("optimum", "Go to a = 1/3", hugeicons.Target01Icon()),
				readouts([2]string{"rotor speed", "vr"}, [2]string{"wake speed", "vw"}, [2]string{"Cp", "cp"}, [2]string{"Ct", "ct"}, [2]string{"of Betz", "share"}),
				nrgNote("Ideal actuator disc: no swirl, no drag, uniform flow. Real rotors reach about 0.45–0.50."),
			)
		},
	}
}

// ---------------------------------------------------------------- E3

func nrgSolarCellBlock() Block {
	return Block{
		Slug:        "solar-cell",
		Title:       "Solar module I–V curve",
		Description: "A 60-cell crystalline-silicon module from the single-diode model, solved point by point. Light sets the current, temperature mostly the voltage: on a hot roof the module loses about 0.4% of its power per kelvin. The maximum power point is where the inverter's tracker holds it.",
		Tags:        []string{"single-diode model", "MPPT", "fill factor"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-solar",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "current I"), legendSwatch("var(--brand)", "power P"), legendSwatch("currentColor", "at 1000 W/m², 25 °C (dashed)")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Current and power against voltage")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Conditions"),
					field("g", "Irradiance", "W/m²", 1000, 50, 1200, 10),
					field("t", "Cell temp.", "°C", 25, -10, 80, 1),
				),
				readouts([2]string{"Isc", "isc"}, [2]string{"Voc", "voc"}, [2]string{"MPP", "mpp"}, [2]string{"fill factor", "ff"}, [2]string{"efficiency", "eff"}),
				nrgNote("Typical-module parameters (Isc ≈ 9.5 A, Voc ≈ 38 V at standard test conditions, 1.6 m²), not a specific product."),
			)
		},
	}
}

// ---------------------------------------------------------------- E4

func nrgTiltBlock() Block {
	return Block{
		Slug:        "panel-tilt",
		Title:       "Panel tilt and daily yield",
		Description: "How much sunlight a tilted panel catches over a clear day. The sun's path comes from latitude and date, the beam from a clear-sky air-mass model, and the panel only takes the part of the beam along its normal. Find the tilt that catches most on a given day: steep in winter, flat in summer.",
		Tags:        []string{"solar geometry", "clear sky", "optimum tilt"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-tilt",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "on the panel"), legendSwatch("var(--vec-u)", "on flat ground")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Irradiance through the day")),
					h.Svg(h.Data("sweep", ""), h.ViewBox("0 0 560 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Daily energy against tilt")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Site and panel"),
					field("lat", "Latitude", "°", 48.9, -60, 70, 0.1),
					field("day", "Day of year", "", 172, 1, 365, 1),
					field("tilt", "Tilt", "°", 35, 0, 90, 1),
					field("az", "Facing (0 = S)", "°", 0, -180, 180, 5),
				),
				nrgButton("best", "Use the best tilt", hugeicons.Sun01Icon()),
				readouts([2]string{"date", "date"}, [2]string{"daylight", "daylight"}, [2]string{"panel", "panel"}, [2]string{"flat", "flat"}, [2]string{"best tilt", "best"}),
				nrgNote("Clear sky only: Meinel's air-mass model for the beam plus an isotropic diffuse share of 10%. Clouds can cut a day's energy several-fold."),
			)
		},
	}
}

// ---------------------------------------------------------------- E5

func nrgBatteryBlock() Block {
	return Block{
		Slug:        "battery",
		Title:       "Battery: capacity, C-rate, efficiency",
		Description: "What a battery's numbers mean in use. The C-rate is the current relative to capacity; drain faster and some chemistries deliver less (Peukert's law, strongest for lead-acid). Round-trip efficiency is the share of the energy you put in that you get back.",
		Tags:        []string{"C-rate", "Peukert", "round trip"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-battery",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "State of charge over time")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Battery"),
					segs("Chemistry", [2]string{"li", "Li-ion"}, [2]string{"lead", "Lead-acid"}),
					field("cap", "Capacity", "Ah", 100, 1, 500, 1),
					field("volt", "Voltage", "V", 12.8, 1, 800, 0.1),
					field("load", "Load", "A", 25, 0.1, 500, 0.1),
				),
				readouts([2]string{"energy", "energy"}, [2]string{"C-rate", "crate"}, [2]string{"runtime", "runtime"}, [2]string{"Peukert k", "k"}, [2]string{"round trip", "rt"}),
				nrgNote("Peukert's law t = H·(C/(I·H))^k with the capacity rated at H = 20 h. k ≈ 1.05 for Li-ion and ≈ 1.25 for lead-acid, and round-trip efficiencies of ≈ 95% and ≈ 80%, are typical values."),
			)
		},
	}
}

// ---------------------------------------------------------------- E6

func nrgGridBlock() Block {
	return Block{
		Slug:        "grid-frequency",
		Title:       "Grid frequency after a power plant trips",
		Description: "The grid's frequency is a running balance of generation and demand. When a large unit trips, the spinning mass of every machine on the grid slows the fall (inertia), then governors raise output (primary response) and the frequency settles a little below nominal. Less inertia means a faster, deeper dip.",
		Tags:        []string{"swing equation", "inertia", "droop"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-grid",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Frequency after the trip")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					field("loss", "Lost generation", "% of load", 3, 0.5, 10, 0.1),
					field("hc", "Inertia H", "s", 5, 1, 10, 0.1),
					field("droop", "Droop R", "%", 5, 2, 10, 0.1),
					field("tg", "Governor lag", "s", 6, 0.5, 15, 0.5),
				),
				readouts([2]string{"RoCoF", "rocof"}, [2]string{"nadir", "nadir"}, [2]string{"at", "tnadir"}, [2]string{"settles at", "ss"}),
				nrgNote("Single-area model at 50 Hz: 2H·dΔf/dt = ΔPm − ΔPloss − D·Δf with load damping D = 1, and a first-order governor following droop R. Simplified: no secondary control, no network."),
			)
		},
	}
}

// ---------------------------------------------------------------- E7

func nrgStorageBlock() Block {
	return Block{
		Slug:        "energy-density",
		Title:       "Energy density of stores",
		Description: "Energy per kilogram against energy per litre, on log axes, from flywheels to diesel. Fuels hold their energy as chemical heat; switch to useful energy and each store is multiplied by the efficiency of turning it into motion, which narrows the gap without closing it.",
		Tags:        []string{"log–log", "Wh/kg", "Wh/L"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-storage",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 360"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Energy density chart")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					segs("Energy", [2]string{"stored", "Stored"}, [2]string{"useful", "Useful"}),
				),
				h.Div(h.Data("out", "detail"), h.Class("min-h-28 rounded-lg border bg-code p-3 text-xs leading-relaxed text-muted-foreground"), "Hover or tap a store."),
				nrgNote("Typical ranges (cell or fuel level, not packs or tanks unless stated), and typical conversion efficiencies; real values vary by design."),
			)
		},
	}
}

// ---------------------------------------------------------------- E8

func nrgSankeyBlock() Block {
	return Block{
		Slug:        "sankey",
		Title:       "Conversion chains",
		Description: "Follow 100 units of energy from source to service. Each stage keeps a share and loses the rest as heat; the band widths are the energies, so the losses peel away where they happen and the end-to-end efficiency is the product of the stages.",
		Tags:        []string{"Sankey", "efficiency", "chains"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-sankey",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Energy flow through the chain")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Chain"),
					segs("Chain", [2]string{"coal", "Coal → LED"}, [2]string{"car", "Petrol car"}, [2]string{"ev", "Solar → EV"}),
				),
				h.Div(h.Data("stages", ""), h.Class("flex flex-col gap-2")),
				readouts([2]string{"end to end", "total"}, [2]string{"lost", "lost"}),
				nrgNote("Stage efficiencies are typical values you can change; they are not measurements of a particular plant or vehicle."),
			)
		},
	}
}

// ---------------------------------------------------------------- E9

func nrgHeatPumpBlock() Block {
	return Block{
		Slug:        "heat-pump-cop",
		Title:       "Heat pump COP and temperatures",
		Description: "A heat pump moves heat uphill, and the steeper the hill the more work it costs. The Carnot limit Th/(Th − Tc) sets the ceiling; real machines reach about half of it. Lower the radiator temperature and the same pump delivers much more heat per kilowatt-hour.",
		Tags:        []string{"COP", "Carnot", "supply temperature"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-hp",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("currentColor", "Carnot limit"), legendSwatch("var(--brand)", "this pump")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "COP against outdoor temperature")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Temperatures"),
					field("out", "Outdoor (source)", "°C", 2, -25, 20, 1),
					field("flow", "Flow (supply)", "°C", 45, 25, 75, 1),
					field("eta", "Share of Carnot", "", 0.5, 0.3, 0.7, 0.01),
				),
				readouts([2]string{"Carnot COP", "carnot"}, [2]string{"COP", "cop"}, [2]string{"per kWh", "heat"}, [2]string{"vs. 45 °C", "vs"}),
				nrgNote("Temperatures in kelvin inside the formula; the 0.4–0.6 share of Carnot is a typical range, not a product rating."),
			)
		},
	}
}

// ---------------------------------------------------------------- E10

func nrgLCOEBlock() Block {
	return Block{
		Slug:        "lcoe",
		Title:       "Levelized cost of energy",
		Description: "The price per MWh at which a plant just pays back its investment, running costs and fuel over its life, with the money discounted. The capital recovery factor turns the up-front cost into an annual payment, so for capital-heavy plants the discount rate matters as much as the hardware.",
		Tags:        []string{"LCOE", "discounting", "sensitivity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-lcoe",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("bars", ""), h.Class("flex flex-col gap-1.5")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "LCOE against discount rate")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Plant (your numbers)"),
					segs("Preset", [2]string{"wind", "Wind-like"}, [2]string{"solar", "Solar-like"}, [2]string{"gas", "Gas-like"}),
					field("capex", "Capex", "€/kW", 1400, 100, 10000, 10),
					field("fom", "Fixed O&M", "€/kW·yr", 40, 0, 300, 1),
					field("vom", "Variable O&M", "€/MWh", 0, 0, 50, 0.5),
					field("fuel", "Fuel", "€/MWh", 0, 0, 200, 1),
					field("cf", "Capacity factor", "%", 35, 1, 95, 1),
					field("life", "Lifetime", "yr", 25, 5, 60, 1),
					field("rate", "Discount rate", "%", 6, 0, 15, 0.1),
				),
				readouts([2]string{"LCOE", "lcoe"}, [2]string{"CRF", "crf"}, [2]string{"MWh / kW·yr", "mwh"}),
				nrgNote("LCOE = (Capex·CRF + fixed O&M) / (8.76·CF) + variable O&M + fuel, with CRF = r(1+r)ⁿ/((1+r)ⁿ − 1). Presets are illustrative inputs, not market data."),
			)
		},
	}
}

// ---------------------------------------------------------------- E11

func nrgMixBlock() Block {
	return Block{
		Slug:        "intermittency",
		Title:       "Intermittency and storage",
		Description: "A week of synthetic sun and wind against a steady demand. Size the solar and wind fleets so they produce as much energy as is used over the week, and the timing still leaves gaps: the storage needed to cover them, and what is curtailed when it is full, depend on the mix.",
		Tags:        []string{"capacity factor", "storage sizing", "synthetic data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nrg-mix",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-out)", "solar"), legendSwatch("var(--vec-u)", "wind"), legendSwatch("currentColor", "demand"), legendSwatch("var(--brand)", "store level")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 330"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "A week of generation, demand and storage")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mix"),
					field("solar", "Solar share", "%", 40, 0, 100, 1),
					field("over", "Overbuild", "×", 1.2, 1, 3, 0.05),
					field("eff", "Store round trip", "%", 85, 50, 100, 1),
				),
				nrgButton("reseed", "Another week", hugeicons.ShuffleIcon()),
				readouts([2]string{"solar CF", "cfs"}, [2]string{"wind CF", "cfw"}, [2]string{"store needed", "store"}, [2]string{"curtailed", "curt"}),
				nrgNote("Synthetic profiles, not measured data: a clear-to-cloudy solar day shape and autocorrelated wind. Storage is in hours of average demand."),
			)
		},
	}
}
