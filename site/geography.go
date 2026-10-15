package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GeographyBlocks lists the geography & demography gallery in display order.
func GeographyBlocks() []Block {
	return []Block{
		geoProjectionBlock(),
		geoGreatCircleBlock(),
		geoSolarTimeBlock(),
		geoContourBlock(),
		geoLatLonBlock(),
		geoGrowthBlock(),
		geoDependencyBlock(),
		geoGravityBlock(),
	}
}

// geoCity is a named place with its coordinates in decimal degrees
// (north and east positive).
type geoCity struct {
	key, name string
	lat, lon  float64
}

// Coordinates of city centres, rounded to 4 decimals (about 10 m).
var geoCities = []geoCity{
	{"paris", "Paris", 48.8566, 2.3522},
	{"nyc", "New York", 40.7128, -74.0060},
	{"tokyo", "Tokyo", 35.6762, 139.6503},
	{"sydney", "Sydney", -33.8688, 151.2093},
	{"capetown", "Cape Town", -33.9249, 18.4241},
	{"quito", "Quito", -0.1807, -78.4678},
	{"reykjavik", "Reykjavík", 64.1466, -21.9426},
	{"singapore", "Singapore", 1.3521, 103.8198},
}

// geoCityData carries the city table to the client once per block.
func geoCityData() h.Node {
	return h.Template(h.Data("cities", ""), h.Map(geoCities, func(c geoCity) h.Node {
		return h.Div(h.Data("key", c.key), h.Data("name", c.name), h.Data("lat", fmt.Sprint(c.lat)), h.Data("lon", fmt.Sprint(c.lon)))
	}))
}

// geoCityPicker is a row of city chips; the selected one carries data-on.
func geoCityPicker(group, label, selected string) h.Node {
	return h.Div(h.Class("flex flex-col gap-1.5"),
		h.Span(h.Class("text-xs text-muted-foreground"), label),
		h.Div(h.Class("flex flex-wrap gap-1"), h.Role("radiogroup"), h.Aria("label", label),
			h.Map(geoCities, func(c geoCity) h.Node {
				return h.Button(h.Type("button"), h.Role("radio"), h.Data("pick", group), h.Data("city", c.key), h.Aria("checked", fmt.Sprint(c.key == selected)),
					h.Class("rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-brand aria-checked:bg-brand/10 aria-checked:text-brand"),
					c.name)
			}),
		),
	)
}

// ---------------------------------------------------------------- G1

func geoProjectionBlock() Block {
	return Block{
		Slug:        "projections",
		Title:       "Map projections",
		Description: "Every flat map distorts the sphere. The circles are Tissot's indicatrices: identical small circles on the globe, projected exactly. Mercator keeps their shape (conformal) but inflates their area toward the poles; equal-area projections keep the area and squash the shape.",
		Tags:        []string{"Tissot", "conformal", "equal-area"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-projection",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("map", ""), h.ViewBox("0 0 640 400"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "World graticule in the selected projection, with Tissot circles and cities")),
					geoCityData(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Projection"),
					segs("Projection",
						[2]string{"equirect", "Plate carrée"}, [2]string{"mercator", "Mercator"},
						[2]string{"gallpeters", "Gall–Peters"}, [2]string{"mollweide", "Mollweide"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Local scale"),
					field("lat", "At latitude", "°", 60, 0, 85, 1),
				),
				readouts([2]string{"preserves", "keeps"}, [2]string{"north–south scale h", "h"}, [2]string{"east–west scale k", "k"}, [2]string{"area scale h·k", "area"}, [2]string{"angular distortion", "omega"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G2

func geoGreatCircleBlock() Block {
	return Block{
		Slug:        "great-circle",
		Title:       "Great-circle distance",
		Description: "The shortest route between two cities follows a great circle, which looks curved on a flat map; a constant compass bearing (a rhumb line) looks straight but is longer. Distances use the haversine formula on a sphere of mean radius 6,371 km.",
		Tags:        []string{"haversine", "bearing", "rhumb line"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-gc",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "great circle (shortest)"),
						legendSwatch("var(--vec-u)", "rhumb line (constant bearing)"),
					),
					h.Svg(h.Data("map", ""), h.ViewBox("0 0 640 330"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "Routes between the two cities on a plate carrée map")),
					geoCityData(),
				),
				geoCityPicker("a", "From", "paris"),
				h.Div(h.Class("border-t pt-4"), geoCityPicker("b", "To", "nyc")),
				readouts([2]string{"great circle", "gc"}, [2]string{"rhumb line", "rhumb"}, [2]string{"saved", "saved"}, [2]string{"initial bearing", "bearing"}, [2]string{"rhumb bearing", "rbearing"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G3

func geoSolarTimeBlock() Block {
	return Block{
		Slug:        "solar-time",
		Title:       "Time zones and solar time",
		Description: "The Sun crosses the meridian 4 minutes later for every degree you go west. Local mean solar time follows longitude exactly; clock time follows 15°-wide zones (in theory: real zones follow borders, and China keeps a single zone, UTC+8, across about 60° of longitude). The equation of time shifts real noon by up to about a quarter of an hour.",
		Tags:        []string{"longitude", "UTC", "equation of time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-solar",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("strip", ""), h.ViewBox("0 0 640 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Longitude strip with nominal time zones, the Sun's position and the chosen place")),
					h.Svg(h.Data("eot", ""), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Equation of time over the year")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Place and time"),
					field("lon", "Longitude", "°E", 2.35, -180, 180, 0.25),
					field("utc", "UTC", "h", 12, 0, 23.99, 0.25),
					field("day", "Day of year", "", 80, 1, 365, 1),
				),
				readouts([2]string{"nominal zone", "zone"}, [2]string{"zone clock", "clock"}, [2]string{"mean solar time", "mean"}, [2]string{"apparent solar time", "apparent"}, [2]string{"equation of time", "eot"}, [2]string{"solar noon (UTC)", "noon"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G4

func geoContourBlock() Block {
	return Block{
		Slug:        "contours",
		Title:       "Contours and profiles",
		Description: "Reading relief from a topographic map. Contour lines join points of equal height, every 20 m here with a bold index line every 100 m; close lines mean steep ground. Drag the two ends of the transect to draw its elevation profile. Synthetic terrain, at 1:25,000 (1 cm on the map is 250 m).",
		Tags:        []string{"contour lines", "transect", "1:25,000"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-contours",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("map", ""), h.ViewBox("0 0 600 400"), h.Class("mx-auto block w-full max-w-[640px] touch-none select-none"), h.Role("img"), h.Aria("label", "Contour map with a transect from A to B; drag A and B")),
					h.Svg(h.Data("profile", ""), h.ViewBox("0 0 600 170"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Elevation profile along the transect")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Terrain"),
					field("interval", "Contour interval", "m", 20, 5, 50, 5),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.ShuffleIcon(), "New terrain"),
				),
				readouts([2]string{"ground distance", "dist"}, [2]string{"map distance", "mapdist"}, [2]string{"A → B height", "heights"}, [2]string{"climb / descent", "climb"}, [2]string{"steepest", "steep"}, [2]string{"vertical exaggeration", "ve"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G5

func geoLatLonBlock() Block {
	return Block{
		Slug:        "latlon",
		Title:       "Find the coordinates",
		Description: "Latitude counts degrees north or south of the Equator, longitude east or west of the Greenwich meridian. Click where you think each coordinate is; the error is measured as a great-circle distance on the ground.",
		Tags:        []string{"quiz", "graticule", "five rounds"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-latlon",
				h.Svg(h.Data("map", ""), h.ViewBox("0 0 640 340"), h.Class("mx-auto block w-full max-w-[720px] cursor-crosshair select-none"), h.Role("img"), h.Aria("label", "Graticule map: click to place your answer")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Target"),
					h.P(h.Data("out", "target"), h.Class("font-mono text-2xl font-medium tabular-nums"), "—"),
					h.P(h.Data("out", "hint"), h.Class("min-h-10 text-sm text-muted-foreground"), "Click the map where this point is."),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), h.Disabled(), hugeicons.ArrowRight01Icon(), "Next"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "restart"), hugeicons.RefreshIcon(), "Restart"),
				),
				readouts([2]string{"round", "round"}, [2]string{"your click", "guess"}, [2]string{"error", "err"}, [2]string{"average error", "avg"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G6

func geoGrowthBlock() Block {
	return Block{
		Slug:        "growth",
		Title:       "Population growth",
		Description: "Two models of a growing population. Exponential growth doubles every ln 2 / r years forever; logistic growth slows as it approaches a carrying capacity K and grows fastest at K/2. The rule of 70 approximates the doubling time.",
		Tags:        []string{"exponential", "logistic", "doubling time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-growth",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "exponential"),
						legendSwatch("var(--brand)", "logistic"),
						legendSwatch("var(--vec-u)", "carrying capacity K"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Population over time under both models")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					field("n0", "Start N₀", "M", 10, 1, 1000, 1),
					field("r", "Growth rate r", "%/yr", 2, 0.1, 10, 0.1),
					field("k", "Capacity K", "M", 100, 10, 5000, 10),
					field("years", "Horizon", "yr", 200, 20, 500, 10),
				),
				readouts([2]string{"doubling (exact)", "dbl"}, [2]string{"rule of 70", "r70"}, [2]string{"exponential at end", "exp"}, [2]string{"logistic at end", "log"}, [2]string{"fastest growth", "infl"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G7

func geoDependencyBlock() Block {
	return Block{
		Slug:        "dependency",
		Title:       "Ageing and dependency",
		Description: "A cohort-component projection: every five years each age group survives into the next and women aged 15–49 have children. Lower fertility and longer lives raise the share of over-65s and the dependency ratio, (0–14 + 65+) per 100 people aged 15–64. A stylised model: survival follows a Gompertz curve fitted to the chosen life expectancy.",
		Tags:        []string{"cohort component", "dependency ratio", "stylised"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-dependency",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					h.Svg(h.Data("ages", ""), h.ViewBox("0 0 260 340"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Age structure in the selected year")),
					h.Svg(h.Data("ratio", ""), h.ViewBox("0 0 360 340"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Dependency ratios over time")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Assumptions"),
					field("tfr", "Children per woman", "TFR", 1.6, 0.8, 7, 0.1),
					field("e0", "Life expectancy", "yr", 82, 40, 95, 1),
					field("year", "Show year", "", 50, 0, 100, 5),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "0–14 · youth ratio"),
					legendSwatch("var(--brand)", "65+ · old-age ratio"),
					legendSwatch("var(--foreground)", "total ratio"),
				),
				readouts([2]string{"dependency ratio", "total"}, [2]string{"youth / old-age", "split"}, [2]string{"aged 65+", "old"}, [2]string{"population index", "pop"}, [2]string{"replacement", "repl"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G8

func geoGravityBlock() Block {
	return Block{
		Slug:        "gravity",
		Title:       "Gravity model of interaction",
		Description: "Flows between places (migrants, trips, trade) modelled like gravity: proportional to the two populations, inversely to distance raised to a friction exponent β. Drag the towns; Reilly's breaking point marks where the pull of the two largest balances. Synthetic towns; β is usually estimated from data.",
		Tags:        []string{"spatial interaction", "Reilly's law", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("geo-gravity",
				h.Svg(h.Data("map", ""), h.ViewBox("0 0 600 400"), h.Class("mx-auto block w-full max-w-[640px] touch-none select-none"), h.Role("img"), h.Aria("label", "Towns and interaction lines; drag the towns")),
				h.Div(h.Class("flex flex-col gap-2"), econFormulaLabel("Model", "F = P₁P₂ / dᵝ"),
					field("beta", "Friction β", "", 2, 0.5, 3, 0.1),
					field("popA", "Population of A", "k", 500, 10, 2000, 10),
				),
				h.Div(h.Class("flex flex-col gap-1 border-t pt-4"), panelLabel("Strongest flows"),
					h.Ol(h.Data("out", "flows"), h.Class("flex flex-col gap-1 font-mono text-xs")),
				),
				readouts([2]string{"breaking point", "bp"}),
			)
		},
	}
}
