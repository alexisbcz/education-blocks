package site

import (
	"github.com/alexisbcz/components/ui/button"
	h "github.com/alexisbcz/libhtml"
)

// ClimateBlocks lists the climate and meteorology gallery in display order.
// The models are computed in static/js/climate.js; real numbers carry their
// source in the block's note.
func ClimateBlocks() []Block {
	return []Block{
		climateEnergyBlock(),
		climateForcingBlock(),
		climateKeelingBlock(),
		climateCarbonBlock(),
		climateLayersBlock(),
		climateHumidityBlock(),
		climateCirculationBlock(),
		climateMeteogramBlock(),
	}
}

func climateSvg(attr, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data(attr, ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

func climateNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- C1

func climateEnergyBlock() Block {
	return Block{
		Slug:        "energy-balance",
		Title:       "Earth's energy balance",
		Description: "Why Earth is about 33 °C warmer than a bare rock at its distance would be. A one-layer atmosphere absorbs a share ε of the surface's infrared and re-emits it both up and down; at balance, the surface must warm until what escapes equals what the Sun delivers.",
		Tags:        []string{"greenhouse effect", "Stefan–Boltzmann", "teaching model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-energy",
				climateSvg("plot", "0 0 640 330", "Energy flows between space, a one-layer atmosphere and the surface"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Planet"),
					field("s0", "Solar constant", "W/m²", 1361, 1000, 1700, 1),
					field("albedo", "Albedo", "", 0.3, 0, 0.9, 0.01),
					field("eps", "IR absorbed ε", "", 0.78, 0, 1, 0.01),
				),
				readouts([2]string{"no atmosphere", "te"}, [2]string{"surface", "ts"}, [2]string{"atmosphere", "ta"}, [2]string{"greenhouse", "gh"}),
				climateNote("A teaching model, not a climate model: one grey layer, no convection, clouds or water vapour feedback. σ = 5.670374419 × 10⁻⁸ W·m⁻²·K⁻⁴. Te = (S₀(1 − α)/4σ)^¼; Ts = Te · (2/(2 − ε))^¼."),
			)
		},
	}
}

// ---------------------------------------------------------------- C2

func climateForcingBlock() Block {
	return Block{
		Slug:        "co2-forcing",
		Title:       "CO₂ forcing and warming",
		Description: "Each doubling of CO₂ adds about the same extra energy, because forcing grows with the logarithm of concentration. Climate sensitivity converts that forcing into equilibrium warming; the shaded band is the IPCC AR6 likely range.",
		Tags:        []string{"radiative forcing", "climate sensitivity", "IPCC AR6"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-forcing",
				climateSvg("plot", "0 0 640 320", "Equilibrium warming against CO₂ concentration"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scenario"),
					field("co2", "CO₂", "ppm", 560, 180, 1120, 1),
					field("ecs", "Sensitivity", "°C/2×", 3, 1.5, 6, 0.1),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"280", "Pre-industrial"}, {"420", "≈ 2023"}, {"560", "2 × CO₂"}, {"1120", "4 × CO₂"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("co2", p[0]), p[1])
					}),
				),
				readouts([2]string{"forcing ΔF", "df"}, [2]string{"doublings", "dbl"}, [2]string{"warming", "dt"}),
				climateNote("ΔF = 5.35 · ln(C/280) W/m² (Myhre et al. 1998), 3.71 W/m² per doubling; IPCC AR6 assesses 3.93 ± 0.47 W/m². Equilibrium climate sensitivity: AR6 best estimate 3 °C, likely 2.5–4 °C, very likely 2–5 °C. Equilibrium warming from CO₂ alone, reached over centuries; other gases and aerosols ignored."),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func climateKeelingBlock() Block {
	return Block{
		Slug:        "keeling",
		Title:       "The Keeling curve",
		Description: "Atmospheric CO₂ breathes with the seasons, falling each northern summer as plants grow, and climbs year after year underneath. The curve here is synthetic: a smooth trend through well-known anchor values plus an illustrative seasonal cycle.",
		Tags:        []string{"Mauna Loa", "trend", "seasonal cycle"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-keeling",
				climateSvg("plot", "0 0 640 300", "Synthetic CO₂ concentration from 1958"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Read the curve"),
					field("year", "Year", "", 2000, 1958, 2024, 0.1)),
				h.Div(h.Class("flex flex-col gap-3"),
					toggle("climate-keeling-season", "season", "Seasonal cycle", true),
					toggle("climate-keeling-zoom", "zoom", "Zoom to 3 years", false),
				),
				readouts([2]string{"CO₂", "ppm"}, [2]string{"trend", "trend"}, [2]string{"growth", "rate"}),
				climateNote("Anchors: ≈ 280 ppm pre-industrial, ≈ 315 ppm in 1958 when Keeling's Mauna Loa record began, ≈ 420 ppm in 2023 (NOAA). The quadratic trend through them and the ±3 ppm seasonal cycle are illustrative, not the measured record."),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func climateCarbonBlock() Block {
	return Block{
		Slug:        "carbon-budget",
		Title:       "The carbon budget",
		Description: "Where the carbon we emit goes. Of every ten tonnes, roughly half stays in the air; the ocean and land take up the rest. Change the emission rate to see how fast CO₂ would rise at the same airborne share.",
		Tags:        []string{"sources and sinks", "GtC", "airborne fraction"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-carbon",
				climateSvg("plot", "0 0 640 300", "Carbon sources and sinks, gigatonnes of carbon per year"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Emissions"),
					field("scale", "Total emissions", "GtC/yr", 10.9, 0, 25, 0.1),
					field("years", "Years ahead", "yr", 27, 0, 80, 1),
				),
				readouts([2]string{"into the air", "atm"}, [2]string{"CO₂ rise", "rise"}, [2]string{"after", "future"}),
				climateNote("2013–2022 averages from the Global Carbon Budget 2023 (Friedlingstein et al., ESSD 2023): fossil 9.6, land-use change 1.3; atmosphere 5.2, ocean 2.8, land 3.3 GtC/yr; budget imbalance −0.4. 1 ppm CO₂ = 2.124 GtC. The projection holds the sink shares fixed, a simplification."),
			)
		},
	}
}

// ---------------------------------------------------------------- C5

func climateLayersBlock() Block {
	return Block{
		Slug:        "atmosphere-layers",
		Title:       "Layers of the atmosphere",
		Description: "Temperature falls with height in the troposphere, rises again in the stratosphere where ozone absorbs ultraviolet, and falls once more in the mesosphere. Pressure halves roughly every 5.5 km. Profile: the US Standard Atmosphere 1976.",
		Tags:        []string{"lapse rate", "pressure", "standard atmosphere"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-layers",
				climateSvg("plot", "0 0 640 380", "Temperature against altitude, 0 to 86 km"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Altitude"),
					field("alt", "Height", "km", 8.849, 0, 86, 0.1)),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"8.849", "Everest"}, {"11", "Airliner"}, {"25", "Ozone layer"}, {"39", "Baumgartner jump"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("alt", p[0]), p[1])
					}),
				),
				readouts([2]string{"layer", "layer"}, [2]string{"temperature", "temp"}, [2]string{"pressure", "p"}, [2]string{"of sea level", "frac"}),
				climateNote("US Standard Atmosphere 1976 layers to 86 km, lapse rate −6.5 K/km in the troposphere; heights treated as geopotential. Real tropopause height varies from about 8 km at the poles to 18 km in the tropics."),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func climateHumidityBlock() Block {
	return Block{
		Slug:        "humidity",
		Title:       "Humidity, dew point, cloud base",
		Description: "Warm air can hold much more water vapour than cold air. Cool a parcel until its vapour pressure meets the saturation curve and you reach its dew point; lift it and clouds form where it gets there, roughly 125 m per degree of spread.",
		Tags:        []string{"Magnus formula", "saturation", "calculator"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-humidity",
				climateSvg("plot", "0 0 640 300", "Saturation vapour pressure against temperature"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Air"),
					field("t", "Temperature", "°C", 25, -20, 45, 0.1),
					field("rh", "Relative humidity", "%", 60, 1, 100, 1),
				),
				readouts([2]string{"saturation", "es"}, [2]string{"vapour", "e"}, [2]string{"dew point", "td"}, [2]string{"cloud base", "base"}),
				climateNote("Magnus formula over water: es = 6.112 · exp(17.62 T / (243.12 + T)) hPa (WMO constants, good to ~0.1% from −45 to 60 °C). Cloud base ≈ 125 m × (T − Td) is Espy's rule of thumb for convective clouds."),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

func climateCirculationBlock() Block {
	return Block{
		Slug:        "circulation",
		Title:       "Global circulation",
		Description: "Three cells per hemisphere move heat from the equator toward the poles. Air rises at the equator and near 60°, sinks near 30° and at the poles; the Coriolis effect turns the surface flows into trade winds, westerlies and polar easterlies. Point at a cell to read it.",
		Tags:        []string{"Hadley cell", "Coriolis", "schematic"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-circulation",
				climateSvg("plot", "0 0 640 330", "Cross-section of the three-cell circulation from pole to pole"),
				h.Div(h.Data("info", ""), h.Aria("live", "polite"), h.Class("flex min-h-28 flex-col gap-1.5"),
					h.Span(h.Data("info-name", ""), h.Class("text-sm font-medium"), "Hadley cell"),
					h.P(h.Data("info-text", ""), h.Class("text-xs leading-relaxed text-muted-foreground"), "Point at a cell."),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Coriolis"),
					field("lat", "Latitude", "°", 45, -90, 90, 1)),
				readouts([2]string{"f = 2Ω sin φ", "f"}, [2]string{"deflection", "defl"}),
				climateNote("Schematic and zonally averaged: real cells shift with the seasons and break into weather systems. Ω = 7.2921 × 10⁻⁵ rad/s."),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func climateMeteogramBlock() Block {
	return Block{
		Slug:        "meteogram",
		Title:       "Reading a meteogram",
		Description: "Forty-eight hours at one weather station as a cold front passes: pressure falls then rises sharply, the temperature drops, rain arrives, and the wind veers from south-west to north-west. The data are synthetic, shaped like a textbook frontal passage.",
		Tags:        []string{"cold front", "wind barbs", "synthetic data"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("climate-meteogram",
				climateSvg("plot", "0 0 640 400", "Synthetic 48-hour meteogram"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Time"),
					field("hour", "Hour", "h", 18, 0, 48, 0.5)),
				readouts([2]string{"pressure", "p"}, [2]string{"temperature", "t"}, [2]string{"wind", "wind"}, [2]string{"rain", "rain"}),
				climateNote("Wind barbs point to where the wind comes from: half barb 5 kt, full barb 10 kt, pennant 50 kt, drawn on the clockwise side as in the Northern Hemisphere."),
			)
		},
	}
}
