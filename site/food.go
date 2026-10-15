package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// FoodBlocks lists the food science gallery in display order. Every block
// is educational: none of it is food-safety, health or nutrition guidance.
func FoodBlocks() []Block {
	return []Block{
		foodMaillardBlock(),
		foodAltitudeBlock(),
		foodEggBlock(),
		foodSugarBlock(),
		foodLeaveningBlock(),
		foodBakersBlock(),
		foodEmulsionBlock(),
		foodFreezingBlock(),
		foodConverterBlock(),
		foodTasteBlock(),
	}
}

// foodNote is the small "approximate / educational" line under a block's
// controls.
func foodNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- F1

type foodZone struct {
	lo, hi float64
	name   string
	color  string
	what   string
}

// Approximate temperatures: browning reactions speed up gradually, so the
// bands overlap and their edges are soft (McGee, On Food and Cooking, 2004).
var foodZones = []foodZone{
	{0, 100, "Wet heat", "var(--vec-u)", "Food holds liquid water, so its surface cannot rise much above 100 °C: no browning, only gentle cooking."},
	{100, 140, "Drying", "var(--vec-out)", "The surface dries out. Maillard reactions start but are slow; colour builds only over long cooking (stocks, slow roasts)."},
	{140, 165, "Maillard", "var(--ion-na)", "Amino acids react with reducing sugars: browning and hundreds of roasted, meaty flavour compounds. The crust forms quickly."},
	{160, 200, "Caramelization", "var(--brand)", "Sucrose breaks down on its own (≈ 160 °C and up): caramel colour, nutty and buttery notes, then bitterness."},
	{200, 260, "Scorching", "var(--code-del)", "Carbonisation and smoke: acrid, bitter compounds. Many fats pass their smoke point in this range."},
}

func foodMaillardBlock() Block {
	return Block{
		Slug:        "maillard",
		Title:       "Browning: Maillard and caramel",
		Description: "Why a steak browns in a pan but not in a pot of water. Slide the surface temperature through the regimes of browning; the bands are approximate because these reactions accelerate gradually, not at a sharp threshold.",
		Tags:        []string{"Maillard", "caramelization", "temperature"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-5"), h.Data("food-maillard", ""),
				h.Div(h.Class("relative pt-6 pb-8"), h.Data("track", ""),
					h.Div(h.Class("relative flex h-10 overflow-hidden rounded-lg border"),
						h.Map(foodZones, func(z foodZone) h.Node {
							w := (min(z.hi, 260) - max(z.lo, 0)) / 260 * 100
							return h.Div(h.Class("flex items-end overflow-hidden px-1.5 pb-1 text-[10px] font-medium whitespace-nowrap"), h.Style(fmt.Sprintf("width:%.2f%%;background:color-mix(in oklab,%s 22%%,transparent);color:%s", w, z.color, z.color)), h.Span(h.Class("hidden sm:inline"), z.name))
						}),
					),
					h.Div(h.Data("marker", ""), h.Class("pointer-events-none absolute top-3 h-16 w-0.5 -translate-x-1/2 rounded-full bg-foreground transition-[left] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none"), h.Style("left:65%")),
					h.Div(h.Class("absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10px] text-muted-foreground"),
						h.Map([]int{0, 50, 100, 150, 200, 250}, func(t int) h.Node { return h.Span(fmt.Sprintf("%d °C", t)) }),
					),
				),
				h.Div(h.Class("grid gap-5 sm:grid-cols-[260px_1fr]"),
					h.Div(h.Class("flex flex-col gap-3"),
						panelLabel("Pan surface"),
						field("temp", "Temperature", "°C", 170, 20, 260, 1),
						h.Div(h.Class("flex flex-wrap gap-1.5"),
							h.Map([][2]string{{"100", "Boiling"}, {"150", "Searing"}, {"170", "Caramel"}, {"230", "Too hot"}}, func(p [2]string) h.Node {
								return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
							}),
						),
					),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-4"),
						h.Div(h.Class("flex items-center gap-2"),
							h.Span(h.Data("out", "zone"), h.Class("text-base font-semibold tracking-tight"), "—"),
							h.Span(h.Data("out", "t"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), ""),
						),
						h.P(h.Data("out", "what"), h.Class("text-sm leading-relaxed text-muted-foreground"), ""),
						foodNote("Bands are approximate (≈) and overlap: browning depends on time, moisture, pH and sugar content, not temperature alone. After McGee, On Food and Cooking (2004)."),
					),
				),
				h.Template(h.Data("zones", ""), h.Map(foodZones, func(z foodZone) h.Node {
					return h.Div(h.Data("lo", fmt.Sprint(z.lo)), h.Data("hi", fmt.Sprint(z.hi)), h.Data("name", z.name), h.Data("what", z.what))
				})),
			)
		},
	}
}

// ---------------------------------------------------------------- F2

func foodAltitudeBlock() Block {
	return Block{
		Slug:        "altitude",
		Title:       "Boiling point and altitude",
		Description: "Air pressure falls with altitude, and water boils when its vapour pressure matches the air's. Pressure comes from the standard atmosphere and the boiling point from the Clausius–Clapeyron equation, so pasta water in the mountains is simply cooler.",
		Tags:        []string{"Clausius–Clapeyron", "pressure", "plot"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("food-altitude",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Boiling point of water against altitude")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Where"),
					field("alt", "Altitude", "m", 2000, 0, 8849, 10),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([][2]string{{"0", "Sea level"}, {"1609", "Denver"}, {"3640", "La Paz"}, {"8849", "Everest"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
						}),
					),
				),
				readouts([2]string{"pressure", "p"}, [2]string{"boils at", "tb"}, [2]string{"vs sea level", "dt"}),
				foodNote("Standard atmosphere pressure; ΔH_vap = 40.66 kJ/mol taken as constant. Real weather shifts pressure by a few percent. Cooking slows below 100 °C because reaction and conduction rates depend on temperature; recipes adjust by experience, not a fixed formula."),
			)
		},
	}
}

// ---------------------------------------------------------------- F3

func foodEggBlock() Block {
	return Block{
		Slug:        "egg",
		Title:       "Boiling an egg: heat conduction",
		Description: "An egg as a sphere of water-like protein, heated from its shell by conduction. A finite-difference model of the heat equation gives the temperature from shell to centre over time; the white sets well before the yolk.",
		Tags:        []string{"heat equation", "finite differences", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("food-egg",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
					h.Svg(h.Data("profile", ""), h.ViewBox("0 0 380 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Temperature from centre to shell")),
					h.Svg(h.Data("section", ""), h.ViewBox("0 0 240 280"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Cross-section of the egg coloured by temperature")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Egg"),
					field("r", "Radius", "mm", 22, 15, 30, 0.5),
					field("t0", "Starting temp.", "°C", 5, 2, 25, 1),
					field("tw", "Water", "°C", 100, 60, 100, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
						hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Cook")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset")),
				field("time", "Time", "min", 6, 0, 20, 0.1),
				readouts([2]string{"centre", "centre"}, [2]string{"white set", "white"}, [2]string{"yolk centre 65 °C", "yolk"}),
				foodNote("Thermal diffusivity ≈ 1.4×10⁻⁷ m²/s; setting temperatures are approximate (white ≈ 62–65 °C, yolk ≈ 65–70 °C; McGee 2004). Educational model: shell, air cell and the egg's oval shape are ignored."),
			)
		},
	}
}

// ---------------------------------------------------------------- F4

type foodStage struct {
	lo, hi float64
	name   string
	sugar  string
	use    string
}

// Standard candy stages, sea level (after McGee 2004; values vary slightly
// between references).
var foodStages = []foodStage{
	{106, 112, "Thread", "≈ 80%", "Syrups, glazes"},
	{112, 116, "Soft ball", "≈ 85%", "Fudge, fondant, pralines"},
	{118, 120, "Firm ball", "≈ 87%", "Caramels"},
	{121, 130, "Hard ball", "≈ 90%", "Nougat, marshmallows, divinity"},
	{132, 143, "Soft crack", "≈ 95%", "Taffy, butterscotch"},
	{146, 154, "Hard crack", "≈ 99%", "Brittle, lollipops, toffee"},
	{160, 177, "Caramel", "≈ 100%", "Caramel sauce, spun sugar colour"},
}

func foodSugarBlock() Block {
	return Block{
		Slug:        "sugar-stages",
		Title:       "Sugar syrup stages",
		Description: "As a sugar syrup boils, water leaves and the boiling point climbs, so the thermometer reads the sugar concentration. The classic confectioner's stages, from thread to caramel, on one temperature scale.",
		Tags:        []string{"candy", "boiling point", "concentration"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"), h.Data("food-sugar", ""),
				field("temp", "Syrup temperature", "°C", 115, 100, 180, 0.5),
				h.Ol(h.Class("flex flex-col gap-1"),
					h.Map(foodStages, func(s foodStage) h.Node {
						return h.Li(h.Data("lo", fmt.Sprint(s.lo)), h.Data("hi", fmt.Sprint(s.hi)),
							h.Class("grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors duration-150 data-[on]:border-brand/40 data-[on]:bg-brand/8"),
							h.Span(h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("%g–%g °C", s.lo, s.hi)),
							h.Span(h.Span(h.Class("font-medium"), s.name), h.Span(h.Class("text-muted-foreground"), " · "+s.use)),
							h.Span(h.Class("font-mono text-xs tabular-nums"), s.sugar),
						)
					}),
				),
				h.P(h.Data("out", "stage"), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground"), ""),
				foodNote("Sea-level temperatures; subtract about 1 °C per 300 m of altitude. Sugar shares are approximate (after McGee, On Food and Cooking, 2004)."),
			)
		},
	}
}

// ---------------------------------------------------------------- F5

func foodLeaveningBlock() Block {
	return Block{
		Slug:        "leavening",
		Title:       "Chemical leavening",
		Description: "Baking soda needs an acid. With cream of tartar the reaction is one-to-one in moles, NaHCO₃ + KHC₄H₄O₆ → KNaC₄H₄O₆ + H₂O + CO₂, so the masses follow from the molar masses, and the gas volume from the ideal gas law. Below, typical pH values of everyday foods.",
		Tags:        []string{"stoichiometry", "ideal gas", "pH"},
		Wide:        true,
		Render: func() h.Node {
			foods := [][3]string{
				{"Lemon juice", "2.0", "2.6"}, {"Vinegar", "2.4", "3.4"}, {"Yogurt", "4.0", "4.6"}, {"Tomatoes", "4.3", "4.9"},
				{"Buttermilk", "4.4", "4.8"}, {"Bread", "5.3", "5.8"}, {"Milk", "6.4", "6.8"}, {"Egg white", "7.6", "9.2"}, {"Baking soda (1% sol.)", "8.2", "8.4"},
			}
			return h.Div(h.Class("grid gap-4 lg:grid-cols-2"), h.Data("food-leaven", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-5"),
					panelLabel("Recipe"),
					field("soda", "Baking soda", "g", 5, 0.5, 20, 0.5),
					field("temp", "Gas at", "°C", 180, 0, 220, 1),
					readouts([2]string{"NaHCO₃", "mol"}, [2]string{"cream of tartar", "tartar"}, [2]string{"CO₂ released", "co2"}, [2]string{"CO₂ volume", "vol"}),
					foodNote("M(NaHCO₃) = 84.007, M(KHC₄H₄O₆) = 188.177, M(CO₂) = 44.009 g/mol; volume at 1 atm by PV = nRT. Real batters lose some gas and dissolve some CO₂."),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-5"),
					panelLabel("Typical pH of foods"),
					h.Div(h.Class("relative h-3 rounded-full"), h.Style("background:linear-gradient(to right,var(--code-del),var(--vec-out),var(--code-add),var(--vec-u),var(--ion-k))")),
					h.Div(h.Class("flex justify-between font-mono text-[10px] text-muted-foreground"), h.Span("0 acidic"), h.Span("7 neutral"), h.Span("14 basic")),
					h.Ul(h.Class("flex flex-col gap-1.5"),
						h.Map(foods, func(f [3]string) h.Node {
							var lo, hi float64
							fmt.Sscan(f[1], &lo)
							fmt.Sscan(f[2], &hi)
							return h.Li(h.Class("grid grid-cols-[9.5rem_1fr] items-center gap-3 text-sm"),
								h.Span(f[0]),
								h.Div(h.Class("relative h-4 rounded-sm bg-foreground/5"),
									h.Div(h.Class("absolute inset-y-0 rounded-sm bg-foreground/70"), h.Style(fmt.Sprintf("left:%.2f%%;width:%.2f%%", lo/14*100, max(0.6, (hi-lo)/14*100)))),
									h.Span(h.Class("absolute inset-y-0 flex items-center font-mono text-[10px] text-muted-foreground"), h.Style(fmt.Sprintf("left:calc(%.2f%% + 6px)", hi/14*100)), f[1]+"–"+f[2]),
								),
							)
						}),
					),
					foodNote("Typical ranges (≈), which vary by product and freshness; egg white becomes more alkaline as eggs age."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- F6

func foodBakersBlock() Block {
	return Block{
		Slug:        "bakers-percentages",
		Title:       "Baker's percentages",
		Description: "Bakers write every ingredient as a percentage of the flour's weight, so a recipe scales by changing one number. Set the flour (or a target dough weight) and the percentages; the grams follow exactly.",
		Tags:        []string{"ratios", "scaling", "bread"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"), h.Data("food-bakers", ""),
				h.Div(h.Class("grid gap-x-6 gap-y-2 sm:grid-cols-2"),
					field("flour", "Flour", "g", 500, 50, 5000, 10),
					field("hydration", "Water", "%", 70, 50, 100, 1),
					field("salt", "Salt", "%", 2, 0, 4, 0.1),
					field("yeast", "Instant yeast", "%", 1, 0, 3, 0.1),
					field("levain", "Levain", "%", 0, 0, 40, 1),
					field("target", "Or target dough", "g", 0, 0, 10000, 10),
				),
				h.Table(h.Class("w-full text-sm"),
					h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
						h.Th(h.Class("py-1.5 font-normal"), "Ingredient"), h.Th(h.Class("py-1.5 text-right font-normal"), "%"), h.Th(h.Class("py-1.5 text-right font-normal"), "grams"))),
					h.Tbody(h.Data("rows", ""), h.Class("font-mono tabular-nums")),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2 border-t pt-3 font-mono text-xs"),
					h.Span(h.Span(h.Class("text-muted-foreground"), "total dough "), h.Span(h.Data("out", "total"), "—")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "true hydration "), h.Span(h.Data("out", "true"), "—")),
				),
				foodNote("Set the target dough weight above 0 to solve for the flour instead. True hydration counts the water inside a 100%-hydration levain."),
			)
		},
	}
}

// ---------------------------------------------------------------- F7

func foodEmulsionBlock() Block {
	return Block{
		Slug:        "emulsion",
		Title:       "Emulsions and creaming",
		Description: "Mayonnaise is oil dispersed as tiny droplets in a little water, held apart by egg-yolk emulsifiers such as lecithin. Droplets still drift because oil is lighter; Stokes' law shows why smaller droplets and a thicker continuous phase make an emulsion last.",
		Tags:        []string{"Stokes' law", "droplets", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("food-emulsion",
				h.Svg(h.Data("jar", ""), h.ViewBox("0 0 520 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Oil droplets rising in the water phase")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Emulsion"),
					field("d", "Droplet diameter", "µm", 10, 0.5, 200, 0.5),
					field("mu", "Water-phase viscosity", "mPa·s", 1, 1, 5000, 1),
					field("drho", "Density difference", "kg/m³", 80, 10, 200, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"vinaigrette", "Vinaigrette"}, {"milk", "Milk"}, {"mayo", "Mayonnaise"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
					}),
				),
				readouts([2]string{"creaming speed", "v"}, [2]string{"to rise 1 cm", "t1"}, [2]string{"verdict", "verdict"}),
				foodNote("v = 2Δρ g r² / (9μ) for a single, isolated sphere; packed emulsions like mayonnaise barely cream because the droplets crowd each other. Presets are illustrative (≈)."),
			)
		},
	}
}

// ---------------------------------------------------------------- F8

func foodFreezingBlock() Block {
	return Block{
		Slug:        "freezing-point",
		Title:       "Freezing-point depression",
		Description: "Dissolved particles lower water's freezing point: ΔT_f = i·K_f·m, with K_f = 1.86 K·kg/mol for water. Salt counts twice (it splits into two ions), sugar once, which is why ice cream mixes stay scoopable and salted ice gets colder.",
		Tags:        []string{"colligative", "molality", "ice cream"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"), h.Data("food-freeze", ""),
				segs("Solute", [2]string{"nacl", "Table salt"}, [2]string{"sucrose", "Sucrose"}, [2]string{"glucose", "Glucose"}),
				h.Div(h.Class("grid gap-x-6 gap-y-2 sm:grid-cols-2"),
					field("g", "Solute", "g", 58.44, 0, 400, 0.1),
					field("water", "Water", "g", 1000, 50, 2000, 10),
				),
				readouts([2]string{"molality", "m"}, [2]string{"van 't Hoff i", "i"}, [2]string{"freezes at", "tf"}),
				h.Div(h.Class("relative h-8 rounded-md border bg-code"), h.Data("scale", ""),
					h.Div(h.Data("bar", ""), h.Class("absolute inset-y-0 right-[16.7%] bg-vec-u/40 transition-[width] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"), h.Style("width:0")),
					h.Span(h.Class("absolute top-1/2 left-[83.3%] -translate-y-1/2 border-l border-foreground/40 pl-1 font-mono text-[10px]"), "0 °C"),
				),
				h.Div(h.Class("relative -mt-2 h-3 font-mono text-[10px] text-muted-foreground"),
					h.Map([]int{-30, -20, -10}, func(t int) h.Node {
						return h.Span(h.Class("absolute -translate-x-1/2"), h.Style(fmt.Sprintf("left:%.2f%%", 83.3-float64(-t)/30*83.3)), fmt.Sprintf("%d °C", t))
					}),
				),
				foodNote("Ideal dilute-solution formula with ideal i; concentrated solutions deviate (real NaCl brine reaches its eutectic at ≈ −21 °C, 23.3% salt by mass)."),
			)
		},
	}
}

// ---------------------------------------------------------------- F9

type foodIngredient struct {
	name  string
	grams float64 // per US cup (236.6 mL), typical
}

var foodIngredients = []foodIngredient{
	{"Water", 236.6}, {"Milk", 242}, {"All-purpose flour (spooned)", 120}, {"Granulated sugar", 200},
	{"Brown sugar (packed)", 213}, {"Butter", 227}, {"Honey", 340}, {"Rolled oats", 90}, {"White rice (raw)", 185}, {"Cocoa powder", 85},
}

func foodConverterBlock() Block {
	return Block{
		Slug:        "converter",
		Title:       "Cups, grams and ovens",
		Description: "Volume recipes hide a density for every ingredient: a cup of flour weighs about half a cup of honey. Convert by ingredient, scale servings, and translate oven settings between °C, °F and UK gas marks.",
		Tags:        []string{"units", "density", "scaling"},
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 sm:grid-cols-2"), h.Data("food-convert", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-5"),
					panelLabel("Volume → weight"),
					h.Label(h.Class("flex flex-col gap-1.5 text-sm"), h.Span(h.Class("text-muted-foreground"), "Ingredient"),
						h.Select(h.Data("ingredient", ""), h.Class("h-9 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
							h.MapIdx(foodIngredients, func(i int, g foodIngredient) h.Node {
								return h.Option(h.Value(fmt.Sprint(g.grams)), h.If(i == 2, h.Selected()), g.name)
							}))),
					field("cups", "Cups", "cup", 1, 0.125, 10, 0.125),
					field("scale", "Scale recipe", "×", 1, 0.25, 8, 0.25),
					readouts([2]string{"weight", "grams"}, [2]string{"volume", "ml"}),
					foodNote("US cup = 236.6 mL; grams per cup are typical values (≈) — flour varies by 20% with how it is scooped, which is why bakers weigh."),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-5"),
					panelLabel("Oven"),
					field("c", "Celsius", "°C", 180, 100, 260, 5),
					readouts([2]string{"Fahrenheit", "f"}, [2]string{"gas mark", "gas"}),
					h.Table(h.Class("w-full font-mono text-xs tabular-nums"),
						h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"), h.Th(h.Class("py-1 font-normal"), "Gas"), h.Th(h.Class("py-1 font-normal"), "°C"), h.Th(h.Class("py-1 font-normal"), "°F"))),
						h.Tbody(h.Map([][3]int{{1, 140, 275}, {2, 150, 300}, {3, 170, 325}, {4, 180, 350}, {5, 190, 375}, {6, 200, 400}, {7, 220, 425}, {8, 230, 450}, {9, 240, 475}}, func(r [3]int) h.Node {
							return h.Tr(h.Data("gas", fmt.Sprint(r[0])), h.Class("data-[on]:bg-brand/10 data-[on]:text-brand"), h.Td(h.Class("py-0.5"), fmt.Sprint(r[0])), h.Td(fmt.Sprint(r[1])), h.Td(fmt.Sprint(r[2])))
						})),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- F10

func foodTasteBlock() Block {
	tastes := [][3]string{
		{"Sweet", "Sugars; a signal of energy.", "var(--brand)"},
		{"Salty", "Sodium ions, through ENaC channels.", "var(--vec-u)"},
		{"Sour", "Acids (hydrogen ions).", "var(--vec-out)"},
		{"Bitter", "Many different compounds; often a warning of toxins.", "var(--ion-k)"},
		{"Umami", "Glutamate and ribonucleotides; named by Kikunae Ikeda, 1908.", "var(--ion-na)"},
	}
	return Block{
		Slug:        "taste-smell",
		Title:       "Taste and smell",
		Description: "The tongue reports five basic tastes; almost everything else we call flavour is smell, reaching the nose from the back of the mouth.",
		Tags:        []string{"senses", "glossary"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"),
				h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-5"),
					h.Map(tastes, func(t [3]string) h.Node {
						return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-3"),
							h.Span(h.Class("flex items-center gap-1.5 text-sm font-medium"), h.Span(h.Class("size-2 rounded-full"), h.Style("background:"+t[2])), t[0]),
							h.Span(h.Class("text-xs leading-relaxed text-muted-foreground"), t[1]),
						)
					}),
				),
				h.P(h.Class("text-[15px] leading-7 text-pretty text-muted-foreground"),
					"Pinch your nose and a jelly bean tastes only sweet and sour: its fruit flavour comes from ",
					term("retronasal olfaction", "Smell from inside the mouth: aromas travel up the back of the throat to the olfactory epithelium while you chew and breathe out."),
					". All five tastes are detected across the whole tongue; the famous ",
					term("tongue map", "A diagram of zones for each taste, from a misreading of D. P. Hänig's 1901 thesis. Every region of the tongue senses all five tastes, with only small differences in sensitivity."),
					" is a myth. Chili's burn is not a taste either but ",
					term("chemesthesis", "Chemical activation of pain and temperature nerves: capsaicin opens the heat receptor TRPV1, menthol the cold receptor TRPM8."),
					".",
				),
				badge.Badge(badge.VariantOutline, h.Class("self-start font-normal text-muted-foreground"), "Educational content, not nutrition or health advice"),
			)
		},
	}
}
