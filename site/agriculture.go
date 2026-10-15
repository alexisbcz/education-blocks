package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AgricultureBlocks lists the agriculture and soil science gallery in
// display order. Every number is computed in static/js/agriculture.js from
// the method named in the block: the USDA texture classes, the FAO-56 soil
// water balance and Penman–Monteith equation, growing degree days, the
// non-rectangular hyperbola, Liebig and Mitscherlich.
func AgricultureBlocks() []Block {
	return []Block{
		agriTextureBlock(),
		agriWaterBlock(),
		agriET0Block(),
		agriKcBlock(),
		agriGDDBlock(),
		agriLightBlock(),
		agriNitrogenBlock(),
		agriRotationBlock(),
		agriMinimumBlock(),
		agriPHBlock(),
	}
}

func agriSvg(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func agriButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func agriNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- A1

func agriTextureBlock() Block {
	return Block{
		Slug:        "soil-texture",
		Title:       "Soil texture triangle",
		Description: "Every mineral soil is a mix of sand, silt and clay. The USDA triangle turns the three percentages into one of twelve texture classes, which predict how a soil drains, holds water and works. Drag the point, or set the percentages.",
		Tags:        []string{"USDA", "ternary plot", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-texture",
				agriSvg("plot", "0 0 520 470", "USDA soil texture triangle. Drag the point or use the arrow keys."),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Particle sizes"),
					field("sand", "Sand (2–0.05 mm)", "%", 40, 0, 100, 1),
					field("clay", "Clay (< 0.002 mm)", "%", 20, 0, 100, 1),
					h.P(h.Class("text-xs text-muted-foreground"), "Silt (0.05–0.002 mm) is the rest: 100 − sand − clay."),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"85 10", "Sand"}, {"40 20", "Loam"}, {"20 15", "Silt loam"}, {"20 60", "Clay"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
					}),
				),
				readouts([2]string{"class", "class"}, [2]string{"silt", "silt"}, [2]string{"behaviour", "behaviour"}),
				agriNote("Class limits from the USDA Soil Survey Manual (Soil Survey Staff). Texture describes the fine earth only: stones and organic matter are excluded."),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func agriWaterBlock() Block {
	return Block{
		Slug:        "water-balance",
		Title:       "Soil water balance and irrigation",
		Description: "The root zone as a bucket, after FAO-56: rain and irrigation fill it, crop water use empties it, and whatever overflows field capacity drains away. Below a depletion threshold the crop starts to stress. Choose when to irrigate and see how much water a season takes.",
		Tags:        []string{"FAO-56", "bucket model", "irrigation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-water",
				h.Div(h.Class("flex flex-col gap-2"),
					agriSvg("plot", "0 0 620 330", "Root-zone depletion over the season with rain and irrigation"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "water available"), legendSwatch("var(--vec-u)", "rain"),
						legendSwatch("var(--ion-cl)", "irrigation"), legendSwatch("var(--code-del)", "stress threshold (RAW)")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Soil"),
					segs("Soil", [2]string{"sandy", "Sandy loam"}, [2]string{"loam", "Loam"}, [2]string{"clay", "Clay"}),
					field("zr", "Root depth", "m", 0.8, 0.2, 2, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Irrigation"),
					segs("Method", [2]string{"drip", "Drip"}, [2]string{"sprinkler", "Sprinkler"}, [2]string{"none", "None"}),
					field("mad", "Irrigate at depletion", "% TAW", 50, 20, 90, 5),
					agriButton("reseed", "New season", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"TAW", "taw"}, [2]string{"rain", "rain"}, [2]string{"crop use", "eta"}, [2]string{"irrigation", "irr"}, [2]string{"drainage", "dp"}, [2]string{"stress days", "stress"}),
				agriNote("Water holding from FAO-56 Table 19 (typical mid-range values). Rain and evaporative demand are synthetic, seeded; efficiencies are typical: drip ≈ 90%, sprinkler ≈ 75%."),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func agriET0Block() Block {
	return Block{
		Slug:        "reference-et",
		Title:       "Reference evapotranspiration",
		Description: "How much water a well-watered grass surface would use today, from weather alone: the FAO-56 Penman–Monteith equation, computed term by term. The Hargreaves formula, which needs only temperatures, is shown beside it for comparison.",
		Tags:        []string{"Penman–Monteith", "FAO-56", "weather"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-et0",
				h.Div(h.Class("flex flex-col gap-3"),
					agriSvg("plot", "0 0 620 200", "The two parts of ET0: radiation and aerodynamic"),
					h.Div(h.Data("steps", ""), h.Class("grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Weather (daily)"),
					field("tmax", "T max", "°C", 21.5, -10, 50, 0.1),
					field("tmin", "T min", "°C", 12.3, -20, 40, 0.1),
					field("rhmax", "RH max", "%", 84, 5, 100, 1),
					field("rhmin", "RH min", "%", 63, 1, 100, 1),
					field("u2", "Wind at 2 m", "m/s", 2.078, 0, 15, 0.01),
					field("n", "Sunshine", "h", 9.25, 0, 18, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Place and date"),
					field("lat", "Latitude", "°", 50.8, -66, 66, 0.1),
					field("z", "Altitude", "m", 100, 0, 4000, 10),
					field("doy", "Day of year", "", 187, 1, 365, 1),
				),
				readouts([2]string{"ET₀ Penman–Monteith", "et0"}, [2]string{"ET₀ Hargreaves", "hg"}),
				agriNote("Defaults are FAO-56 Example 18 (Brussels, 6 July), whose published answer is 3.9 mm/day. Allen, Pereira, Raes & Smith (1998), FAO Irrigation and Drainage Paper 56."),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func agriKcBlock() Block {
	return Block{
		Slug:        "crop-coefficient",
		Title:       "Crop coefficient over a season",
		Description: "A crop does not use the reference rate: young plants use less, a full canopy more, a ripening crop less again. FAO-56 describes this with a four-stage crop coefficient curve; multiply it by ET₀ and add up the season.",
		Tags:        []string{"Kc", "FAO-56", "growth stages"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-kc",
				agriSvg("plot", "0 0 620 300", "Crop coefficient and crop evapotranspiration over the season"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Crop"),
					segs("Crop", [2]string{"maize", "Maize"}, [2]string{"wheat", "Wheat"}, [2]string{"tomato", "Tomato"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Stages (days)"),
					field("lini", "Initial", "d", 30, 5, 80, 1),
					field("ldev", "Development", "d", 40, 5, 80, 1),
					field("lmid", "Mid-season", "d", 50, 5, 100, 1),
					field("llate", "Late", "d", 30, 5, 80, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Coefficients"),
					field("kini", "Kc ini", "", 0.3, 0.1, 1.3, 0.05),
					field("kmid", "Kc mid", "", 1.2, 0.3, 1.4, 0.05),
					field("kend", "Kc end", "", 0.6, 0.1, 1.3, 0.05),
					field("et0", "Mean ET₀", "mm/d", 5, 1, 10, 0.1),
				),
				readouts([2]string{"season", "len"}, [2]string{"crop water use", "etc"}, [2]string{"peak ETc", "peak"}),
				agriNote("Presets are typical values from FAO-56 Tables 11 and 12; local stage lengths vary with climate and variety. ET₀ follows a smooth seasonal cycle around the mean."),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func agriGDDBlock() Block {
	return Block{
		Slug:        "degree-days",
		Title:       "Growing degree days",
		Description: "Crops develop with accumulated warmth, not calendar days. Each day adds how far its mean temperature sits above a base, with the daily temperatures bounded so that heat above a cap does not count. Watch a season accumulate and the stages arrive.",
		Tags:        []string{"GDD", "phenology", "thermal time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-gdd",
				agriSvg("plot", "0 0 620 330", "Daily temperatures and accumulated degree days"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Method", [2]string{"modified", "Bounded (base, cap)"}, [2]string{"simple", "Simple average"}),
					field("base", "Base temperature", "°C", 10, 0, 15, 0.5),
					field("cap", "Upper cap", "°C", 30, 20, 40, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("One day"),
					field("tx", "T max", "°C", 30, -5, 45, 0.5),
					field("tn", "T min", "°C", 15, -10, 30, 0.5),
				),
				readouts([2]string{"this day", "day"}, [2]string{"season total", "total"}, [2]string{"maturity", "maturity"}),
				agriNote("Bounded method: T min is raised to the base and T max lowered to the cap before averaging (the 10/30 °C convention used for maize). The season's temperatures are synthetic and the stage thresholds are illustrative for a generic summer crop."),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

func agriLightBlock() Block {
	return Block{
		Slug:        "light-response",
		Title:       "Leaf photosynthesis and light",
		Description: "Net CO₂ uptake of a leaf rises steeply in dim light, bends, and levels off at a maximum. The non-rectangular hyperbola describes that bend with one curvature parameter. Compare typical C3 and C4 leaves.",
		Tags:        []string{"photosynthesis", "C3 vs C4", "model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-light",
				h.Div(h.Class("flex flex-col gap-2"),
					agriSvg("plot", "0 0 620 320", "Net photosynthesis against light"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "this leaf"), legendSwatch("var(--muted-foreground)", "other pathway (preset, dashed)")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pathway"),
					segs("Pathway", [2]string{"c3", "C3 (wheat-like)"}, [2]string{"c4", "C4 (maize-like)"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameters"),
					field("pmax", "P max", "µmol/m²/s", 25, 5, 60, 0.5),
					field("alpha", "Quantum yield α", "", 0.05, 0.01, 0.1, 0.005),
					field("theta", "Curvature θ", "", 0.7, 0.01, 0.99, 0.01),
					field("rd", "Dark respiration", "µmol/m²/s", 1.5, 0, 5, 0.1),
					field("light", "Light (PPFD)", "µmol/m²/s", 800, 0, 2000, 10),
				),
				readouts([2]string{"net uptake", "pn"}, [2]string{"compensation", "comp"}, [2]string{"90% of max at", "sat"}),
				agriNote("Model after Thornley (1976). Parameter values are illustrative. C4 plants concentrate CO₂ around Rubisco, so they lose little to photorespiration and tend to saturate at higher light, especially when it is hot."),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func agriNitrogenBlock() Block {
	return Block{
		Slug:        "nitrogen",
		Title:       "Nitrogen balance and fertilizer",
		Description: "How much fertilizer a field needs is a balance: what the crop will take up, minus what the soil and the previous crop supply, divided by how much of the applied nitrogen the crop actually recovers. Then convert kilograms of nitrogen into kilograms of product.",
		Tags:        []string{"N balance", "calculator", "stoichiometry"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("agri-nitrogen", ""),
				h.Div(h.Class("grid gap-x-6 gap-y-2 sm:grid-cols-2"),
					field("yield", "Target yield", "t/ha", 8, 1, 15, 0.1),
					field("uptake", "N uptake per tonne", "kg N/t", 25, 5, 50, 0.5),
					field("soil", "Soil mineral N", "kg N/ha", 40, 0, 200, 1),
					field("miner", "Mineralization", "kg N/ha", 30, 0, 150, 1),
					field("credit", "Previous-crop credit", "kg N/ha", 0, 0, 120, 1),
					field("eff", "Fertilizer recovery", "%", 60, 20, 100, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Product"),
					segs("Fertilizer", [2]string{"urea", "Urea 46%"}, [2]string{"an", "Ammonium nitrate ≈34%"}, [2]string{"can", "CAN 27%"}, [2]string{"as", "Ammonium sulfate 21%"}),
				),
				agriSvg("plot", "0 0 600 150", "Nitrogen budget bars"),
				readouts([2]string{"crop demand", "demand"}, [2]string{"supply", "supply"}, [2]string{"N to apply", "napply"}, [2]string{"product", "product"}, [2]string{"50 kg bags", "bags"}),
				agriNote("Uptake per tonne is a typical value for a cereal grain crop; use local recommendations in practice. Nitrogen the crop does not recover can leach as nitrate or be lost as gas, which is why the recovery term matters."),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func agriRotationBlock() Block {
	return Block{
		Slug:        "rotation",
		Title:       "Crop rotation planner",
		Description: "Plan four beds over four years. Grouping crops by botanical family keeps soil-borne pests and diseases from building up, and following a nitrogen-fixing legume with a hungry crop uses the nitrogen it left. Click a cell to change its crop.",
		Tags:        []string{"planner", "families", "legumes"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("agri-rotation", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					h.Div(h.Data("grid", ""), h.Class("grid gap-1.5"), h.Role("group"), h.Aria("label", "Beds by year")),
					h.Div(h.Data("legend", ""), h.Class("flex flex-wrap gap-1.5")),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
						h.Div(h.Class("flex flex-wrap gap-1.5"),
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "veg"), "Vegetable garden"),
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "norfolk"), "Norfolk four-course"),
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "bad"), "Monoculture"),
						),
					),
					h.Ul(h.Data("checks", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-2 text-sm")),
					agriNote("Gap rules are common guidance (for example, at least three years between potato-family crops, and between brassicas where clubroot is a risk). The Norfolk four-course rotation (wheat, turnips, barley, clover) spread in 18th-century England."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A9

func agriMinimumBlock() Block {
	return Block{
		Slug:        "law-of-minimum",
		Title:       "Limiting factors and diminishing returns",
		Description: "Liebig's law of the minimum: yield is set by the scarcest resource, like a barrel that holds water only up to its shortest stave. Mitscherlich's curve adds diminishing returns: each extra kilogram of fertilizer adds less yield than the one before, so the best rate depends on prices.",
		Tags:        []string{"Liebig", "Mitscherlich", "economics"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-2"), h.Data("agri-minimum", ""),
				h.Div(h.Class("flex flex-col gap-3 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					panelLabel("The barrel (click a stave, or focus it and use ↑ ↓)"),
					agriSvg("barrel", "0 0 320 300", "Barrel with one stave per growth factor"),
					h.P(h.Data("out", "limit"), h.Aria("live", "polite"), h.Class("font-mono text-xs")),
				),
				h.Div(h.Class("flex flex-col gap-3 p-4"),
					panelLabel("Yield against fertilizer rate (Mitscherlich)"),
					agriSvg("curve", "0 0 360 240", "Yield response curve with the economic optimum"),
					h.Div(h.Class("grid gap-x-6 gap-y-2 sm:grid-cols-2"),
						field("A", "Max yield A", "t/ha", 10, 2, 15, 0.1),
						field("c", "Response c", "1/(kg N/ha)", 0.02, 0.002, 0.04, 0.001),
						field("b", "Soil supply b", "kg N/ha", 40, 0, 150, 1),
						field("ratio", "Price ratio", "kg grain/kg N", 6, 1, 20, 0.5),
					),
					readouts([2]string{"economic optimum", "opt"}, [2]string{"yield there", "yopt"}, [2]string{"last kg adds", "marg"}),
					agriNote("Y = A(1 − e^(−c(x + b))): a model with illustrative parameters. The optimum is where one more kilogram of N adds exactly enough grain to pay for itself: dY/dx equals the price ratio."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A10

func agriPHBlock() Block {
	return Block{
		Slug:        "soil-ph",
		Title:       "Soil pH and liming",
		Description: "Soil pH controls which nutrients plants can take up: phosphorus is most available near neutral, iron and manganese in acid soils, molybdenum in alkaline ones. Move the pH to read across the chart, then estimate how much lime it takes to raise an acid soil.",
		Tags:        []string{"pH", "nutrients", "lime"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agri-ph",
				agriSvg("plot", "0 0 620 380", "Schematic nutrient availability against soil pH"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Soil pH"),
					field("ph", "pH (water)", "", 5.5, 4, 10, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Lime requirement (concept)"),
					field("cec", "CEC", "cmol+/kg", 15, 2, 50, 0.5),
					field("bs", "Base saturation now", "%", 60, 10, 100, 1),
					field("bst", "Target saturation", "%", 80, 10, 100, 1),
					field("depth", "Depth limed", "cm", 20, 5, 40, 1),
					field("bd", "Bulk density", "g/cm³", 1.3, 0.8, 1.8, 0.05),
				),
				readouts([2]string{"best supplied", "good"}, [2]string{"poorly supplied", "poor"}, [2]string{"acidity to neutralize", "acid"}, [2]string{"CaCO₃", "lime"}),
				agriNote("The chart is the classic schematic after Truog (1946): band widths show relative availability, not measured amounts. The lime estimate is a simplified concept (1 cmol+ of acidity per kg needs 0.5 g CaCO₃); laboratories use buffer-pH methods and liming materials are less than 100% effective."),
			)
		},
	}
}
