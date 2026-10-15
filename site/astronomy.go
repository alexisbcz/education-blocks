package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AstronomyBlocks lists the astronomy gallery in display order. Every
// figure is computed in static/js/astronomy.js from the constants named in
// the block text.
func AstronomyBlocks() []Block {
	return []Block{
		astroScaleBlock(),
		astroMoonBlock(),
		astroSeasonsBlock(),
		astroSkyBlock(),
		astroHRBlock(),
		astroParallaxBlock(),
		astroTransitBlock(),
		astroHubbleBlock(),
	}
}

// astroPlay is a play/pause button with its own label.
func astroPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func astroSvg(attr, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data(attr, ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

func astroNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- A1

func astroScaleBlock() Block {
	return Block{
		Slug:        "solar-system",
		Title:       "Scale of the solar system",
		Description: "The planets at their real mean distances from the Sun. On a linear axis the inner planets crowd together near the Sun; a log axis spreads them out. Pick a planet for its distance and the time sunlight takes to reach it.",
		Tags:        []string{"AU", "light-time", "log scale"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-scale",
				astroSvg("plot", "0 0 640 220", "Planets by distance from the Sun"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Axis"),
					segs("Distance axis", [2]string{"log", "Log"}, [2]string{"linear", "Linear"})),
				readouts([2]string{"planet", "name"}, [2]string{"distance", "au"}, [2]string{"", "km"}, [2]string{"light-time", "light"}, [2]string{"radius", "radius"}),
				astroNote("Semi-major axes (J2000) and mean radii. 1 AU = 149,597,870.7 km; light covers it in 499.0 s. Planet sizes are not to the distance scale."),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func astroMoonBlock() Block {
	return Block{
		Slug:        "moon-phases",
		Title:       "Moon phases",
		Description: "Phases come from geometry, not shadow: the Moon is always half lit by the Sun, and we see a changing share of that half as it orbits. Left, the view from above the North Pole; right, the Moon as seen from Earth.",
		Tags:        []string{"synodic month", "geometry", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-moon",
				h.Div(h.Class("grid items-center gap-3 sm:grid-cols-[3fr_2fr]"),
					astroSvg("orbit", "-130 -130 260 260", "Sun, Earth and the Moon's orbit seen from above", h.Class("max-w-[360px]")),
					astroSvg("disc", "-60 -60 120 120", "The Moon as seen from Earth", h.Class("max-w-[200px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Time"),
					field("day", "Moon age", "days", 7.4, 0, 29.53, 0.1)),
				astroPlay("Play month"),
				readouts([2]string{"phase", "phase"}, [2]string{"illuminated", "lit"}, [2]string{"elongation", "elong"}),
				astroNote("Synodic month ≈ 29.53 days. Illuminated fraction = (1 − cos e)/2 for elongation e. Eclipses need a new or full Moon near a node: the orbit is tilted about 5.1° to the ecliptic, so most months have none."),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func astroSeasonsBlock() Block {
	return Block{
		Slug:        "seasons",
		Title:       "Seasons and day length",
		Description: "Seasons come from Earth's 23.44° axial tilt, not its distance from the Sun. Pick a latitude and a day: the noon Sun's height and the length of daylight follow from the Sun's declination.",
		Tags:        []string{"axial tilt", "declination", "latitude"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-seasons",
				astroSvg("plot", "0 0 640 300", "Noon solar elevation and day length over the year"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Observer"),
					field("lat", "Latitude", "°", 48.85, -90, 90, 0.05),
					field("doy", "Day of year", "", 172, 1, 365, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"48.85", "Paris"}, {"0", "Equator"}, {"66.56", "Arctic Circle"}, {"-33.87", "Sydney"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("lat", p[0]), p[1])
					}),
				),
				readouts([2]string{"declination", "dec"}, [2]string{"noon Sun", "elev"}, [2]string{"daylight", "day"}),
				astroNote("δ ≈ −23.44° · cos(360°/365 · (N + 10)). Noon elevation = 90° − |φ − δ|. Daylight from cos H₀ = −tan φ · tan δ, geometric (no refraction, Sun's centre)."),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func astroSkyBlock() Block {
	return Block{
		Slug:        "sky",
		Title:       "The sky from here",
		Description: "Bright stars on the sky dome for any latitude and sidereal time: zenith in the centre, horizon on the rim. Polaris sits at an altitude equal to your latitude; let the sky turn and watch which stars never set.",
		Tags:        []string{"alt-az", "RA/Dec", "circumpolar"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-sky",
				astroSvg("dome", "-170 -170 340 340", "Sky dome with bright stars", h.Class("max-w-[460px]")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Observer"),
					field("lat", "Latitude", "°", 48.85, -90, 90, 0.5),
					field("lst", "Sidereal time", "h", 6, 0, 24, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					toggle("astro-sky-eq", "equator", "Celestial equator", true),
					astroPlay("Turn the sky"),
				),
				readouts([2]string{"star", "name"}, [2]string{"altitude", "alt"}, [2]string{"azimuth", "az"}, [2]string{"RA / Dec", "radec"}),
				astroNote("sin a = sin δ sin φ + cos δ cos φ cos H, with hour angle H = LST − RA. Positions J2000, rounded; no refraction or precession."),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func astroHRBlock() Block {
	return Block{
		Slug:        "hr-diagram",
		Title:       "Hertzsprung–Russell diagram",
		Description: "Stars by temperature and luminosity. Most lie on the main sequence while they burn hydrogen; giants are cool but huge, white dwarfs hot but tiny. Diagonal lines are constant radius, from L = 4πR²σT⁴.",
		Tags:        []string{"luminosity", "temperature", "stellar lifetime"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-hr",
				astroSvg("plot", "0 0 640 420", "Hertzsprung–Russell diagram"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Main-sequence star"),
					field("mass", "Mass", "M☉", 1, 0.2, 40, 0.1)),
				readouts([2]string{"star", "name"}, [2]string{"temperature", "temp"}, [2]string{"luminosity", "lum"}, [2]string{"radius", "radius"}, [2]string{"lifetime", "life"}),
				astroNote("Named stars: approximate values from the literature, rounded. The mass slider uses rough main-sequence scalings (L ∝ M³·⁵, R ∝ M⁰·⁸, lifetime ≈ 10 Gyr · M⁻²·⁵): good to a factor of a few, not stellar models."),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

func astroParallaxBlock() Block {
	return Block{
		Slug:        "parallax",
		Title:       "Parallax",
		Description: "The first rung of the distance ladder. As Earth goes round the Sun, a nearby star shifts against distant ones; half that shift is the parallax angle p, and the distance in parsecs is simply 1/p in arcseconds.",
		Tags:        []string{"parsec", "distance ladder", "Gaia"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-parallax",
				astroSvg("plot", "0 0 640 300", "Parallax geometry, angle exaggerated"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Star"),
					field("p", "Parallax", "″", 0.768, 0.0001, 1, 0.0001)),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"0.768", "Proxima Cen"}, {"0.379", "Sirius"}, {"0.130", "Vega"}, {"0.0038", "Rigel"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("p", p[0]), p[1])
					}),
				),
				readouts([2]string{"distance", "pc"}, [2]string{"", "ly"}, [2]string{"", "km"}, [2]string{"light takes", "years"}),
				astroNote("d [pc] = 1 / p [arcsec]; 1 pc ≈ 3.2616 ly ≈ 3.0857 × 10¹³ km. Parallaxes rounded (Gaia/Hipparcos). Rigel's parallax is small and uncertain, so its distance is too. The drawing exaggerates the angle enormously."),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func astroTransitBlock() Block {
	return Block{
		Slug:        "transit",
		Title:       "Exoplanet transits",
		Description: "How most known exoplanets were found: a planet crossing its star dims it by the ratio of their areas. The depth gives the planet's size, the period its orbit, and Kepler's third law the distance.",
		Tags:        []string{"light curve", "Kepler's 3rd law", "ppm"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-transit",
				h.Div(h.Class("flex flex-col gap-2"),
					astroSvg("star", "0 0 640 150", "Planet crossing its star"),
					astroSvg("curve", "0 0 640 200", "Light curve"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					field("rp", "Planet radius", "R⊕", 1, 0.3, 25, 0.1),
					field("rs", "Star radius", "R☉", 1, 0.1, 3, 0.01),
					field("ms", "Star mass", "M☉", 1, 0.1, 3, 0.01),
					field("period", "Period", "days", 365.25, 0.5, 5000, 0.25),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.Map([][2]string{{"earth", "Earth–Sun"}, {"jupiter", "Jupiter–Sun"}, {"hotjupiter", "Hot Jupiter"}}, func(p [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
					}),
				),
				readouts([2]string{"depth", "depth"}, [2]string{"orbit a", "a"}, [2]string{"duration", "dur"}),
				astroNote("Depth = (Rp/R★)², ignoring limb darkening. a³ = M★P² (AU, M☉, years). Central transit duration ≈ (P/π) · asin((R★ + Rp)/a), circular orbit."),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func astroHubbleBlock() Block {
	return Block{
		Slug:        "hubble",
		Title:       "Hubble's law",
		Description: "The farther a galaxy, the faster it recedes: v = H₀ · d. The galaxies plotted are synthetic, scattered like real measurements; move the distance to redshift a spectral line, and change H₀ to see the Hubble tension in the age it implies.",
		Tags:        []string{"redshift", "H₀", "expansion"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-hubble",
				h.Div(h.Class("flex flex-col gap-2"),
					astroSvg("plot", "0 0 640 300", "Recession velocity against distance (synthetic galaxies)"),
					astroSvg("spectrum", "0 0 640 70", "Hydrogen-alpha line, rest and redshifted"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Universe"),
					field("h0", "H₀", "km/s/Mpc", 70, 50, 90, 0.1),
					field("d", "Distance", "Mpc", 100, 1, 400, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("h0", "67.4"), "Planck 67.4"),
					button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("h0", "73"), "SH0ES ≈ 73"),
				),
				readouts([2]string{"velocity", "v"}, [2]string{"redshift z", "z"}, [2]string{"Hα observed", "lambda"}, [2]string{"Hubble time", "age"}),
				astroNote("z ≈ v/c holds only for small z. Hubble time 1/H₀ ≈ 977.8/H₀ Gyr; the actual age (≈ 13.8 Gyr) also depends on the expansion history. Hα rest wavelength 656.28 nm (air)."),
			)
		},
	}
}
