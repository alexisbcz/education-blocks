package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AstroBlocks lists the astrophysics and cosmology gallery in display
// order. Everything is computed in static/js/astro.js from SI constants
// (CODATA 2018, IAU 2015 nominal solar values) named in the block notes.
// Go identifiers use the astroph prefix: the astronomy collection already
// owns astroSvg, astroNote and friends.
func AstroBlocks() []Block {
	return []Block{
		astrophBlackbodyBlock(),
		astrophRedshiftBlock(),
		astrophFatesBlock(),
		astrophBlackHoleBlock(),
		astrophRotationBlock(),
		astrophLensingBlock(),
		astrophExpansionBlock(),
		astrophDistancesBlock(),
		astrophCMBBlock(),
		astrophChirpBlock(),
	}
}

func astrophSvg(attr, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data(attr, ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// astrophCanvas is a square canvas in a framed box.
func astrophCanvas(label string, extra ...any) h.Node {
	return h.Div(append([]any{h.Class("relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-lg border bg-background")},
		append([]any{h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", label))}, extra...)...)...)
}

func astrophNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// astrophPresets is a row of small outline buttons carrying data-preset.
func astrophPresets(opts ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1.5"),
		h.Map(opts, func(p [2]string) h.Node {
			return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
		}),
	)
}

func astrophAction(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func astrophPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func astrophGroup(label string, nodes ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-2"), panelLabel(label)}, nodes...)...)
}

// ---------------------------------------------------------------- 1

func astrophBlackbodyBlock() Block {
	return Block{
		Slug:        "blackbody",
		Title:       "Blackbody spectra",
		Description: "A star's light is close to a blackbody's. Planck's law gives the spectrum for a temperature: hotter bodies peak at shorter wavelengths (Wien) and emit far more per square metre (σT⁴). Add a radius and you have the luminosity, L = 4πR²σT⁴.",
		Tags:        []string{"Planck's law", "Wien", "Stefan–Boltzmann"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-bb",
				astrophSvg("plot", "0 0 640 330", "Planck spectrum of the chosen star, with the Sun for reference"),
				astrophGroup("Star",
					field("t", "Temperature", "K", 5772, 1000, 40000, 1),
					field("r", "Radius", "R☉", 1, 0.01, 1000, 0.01),
				),
				astrophPresets([2]string{"sun", "Sun"}, [2]string{"proxima", "Proxima Cen"}, [2]string{"sirius", "Sirius A"}, [2]string{"betelgeuse", "Betelgeuse"}, [2]string{"rigel", "Rigel"}),
				readouts([2]string{"colour", "swatch"}, [2]string{"Wien peak", "peak"}, [2]string{"surface flux", "flux"}, [2]string{"luminosity", "lum"}, [2]string{"visible share", "vis"}),
				astrophNote("B_λ = 2hc²/λ⁵ · 1/(e^{hc/λkT} − 1); λ_max = b/T with b = 2.898 × 10⁻³ m·K; σ = 5.670 × 10⁻⁸ W m⁻² K⁻⁴; L☉ = 3.828 × 10²⁶ W. The colour is the blackbody's integrated against CIE 1931 colour matching functions (Wyman et al. 2013 fit), then normalised in brightness. Star values rounded; real stellar spectra have absorption lines."),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func astrophRedshiftBlock() Block {
	return Block{
		Slug:        "redshift",
		Title:       "Measuring a redshift",
		Description: "A distant galaxy's emission lines arrive stretched by 1 + z. Slide the template of rest wavelengths until its lines sit on the observed peaks: the stretch that matches is the redshift. Each new galaxy hides a different z in a noisy synthetic spectrum.",
		Tags:        []string{"redshift", "Balmer lines", "spectroscopy"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-z",
				astrophSvg("plot", "0 0 640 300", "Synthetic galaxy spectrum with the redshifted line template"),
				astrophGroup("Your template",
					field("z", "Redshift z", "", 0, 0, 1.5, 0.001),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					astrophAction("new", "New galaxy", hugeicons.ShuffleIcon()),
					astrophAction("reveal", "Reveal", hugeicons.EyeIcon()),
				),
				readouts([2]string{"match", "match"}, [2]string{"true z", "truth"}, [2]string{"1 + z", "stretch"}, [2]string{"velocity (SR)", "v"}),
				astrophNote("Rest wavelengths (air): [O II] 372.7, Hδ 410.2, Hγ 434.0, Hβ 486.1, [O III] 495.9 and 500.7, Hα 656.3, [N II] 658.4, [S II] 671.6/673.1 nm; observed range 360–1000 nm. A cosmological redshift is the stretching of space, not a Doppler shift; the special-relativistic velocity is shown only for comparison and is not meaningful at large z."),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func astrophFatesBlock() Block {
	return Block{
		Slug:        "stellar-fates",
		Title:       "How long a star lives, and how it ends",
		Description: "Massive stars burn hotter and die younger: on the main sequence, luminosity grows roughly as M³·⁵, so the lifetime falls roughly as M⁻²·⁵. The star's initial mass also decides its remains: a white dwarf, a neutron star or a black hole.",
		Tags:        []string{"main sequence", "Chandrasekhar limit", "remnants"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-fate",
				astrophSvg("plot", "0 0 640 330", "Main-sequence lifetime against initial mass, with end states"),
				astrophGroup("Star",
					field("m", "Initial mass", "M☉", 1, 0.1, 100, 0.01),
				),
				astrophPresets([2]string{"0.12", "Proxima"}, [2]string{"1", "Sun"}, [2]string{"2.06", "Sirius A"}, [2]string{"18", "Betelgeuse"}, [2]string{"40", "40 M☉"}),
				readouts([2]string{"lifetime", "life"}, [2]string{"luminosity", "lum"}, [2]string{"ends as", "end"}, [2]string{"remnant", "rem"}, [2]string{"died already?", "dead"}),
				astrophNote("Scalings: lifetime ≈ 10 Gyr · M⁻²·⁵, L ≈ M³·⁵ (M in M☉), good to a factor of a few. Boundaries are approximate and depend on composition, rotation and binaries: below ≈ 8 M☉ a white dwarf (never above the Chandrasekhar limit ≈ 1.4 M☉; white-dwarf mass from a linear initial–final fit ≈ 0.08 M + 0.49), ≈ 8–25 M☉ a neutron star (≈ 1.4 M☉, maximum ≈ 2–2.3 M☉), above ≈ 25 M☉ usually a black hole. Stars below ≈ 0.8 M☉ have not had time to leave the main sequence in 13.8 Gyr."),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func astrophBlackHoleBlock() Block {
	return Block{
		Slug:        "black-hole",
		Title:       "Near a black hole",
		Description: "A non-rotating black hole has one length scale, the Schwarzschild radius r_s = 2GM/c². Clocks near it run slow, light climbing out is redshifted, light can orbit at 1.5 r_s, and matter can orbit stably only beyond 3 r_s. Tides are what tear you apart, and they are gentlest at big black holes.",
		Tags:        []string{"Schwarzschild", "time dilation", "ISCO"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-bh",
				h.Div(h.Class("flex flex-col gap-2"),
					astrophSvg("map", "0 0 640 190", "Event horizon, photon sphere, innermost stable orbit and the observer, to scale in r_s"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "event horizon, r_s"), legendSwatch("var(--vec-out)", "photon sphere, 1.5 r_s"), legendSwatch("var(--vec-u)", "innermost stable orbit, 3 r_s"),
					),
					astrophSvg("plot", "0 0 640 240", "Clock rate against distance from the black hole"),
				),
				astrophGroup("Black hole and observer",
					field("m", "Mass", "log M☉", 1, 0, 10, 0.01),
					field("r", "Observer at", "r_s", 3, 1.01, 20, 0.01),
				),
				astrophPresets([2]string{"1", "10 M☉"}, [2]string{"6.6", "Sgr A*"}, [2]string{"9.81", "M87*"}),
				readouts([2]string{"mass", "mass"}, [2]string{"r_s", "rs"}, [2]string{"clock rate", "rate"}, [2]string{"1 h there", "hour"}, [2]string{"redshift z", "z"}, [2]string{"tidal stretch", "tide"}),
				astrophNote("Static observer in the Schwarzschild metric: dτ/dt = √(1 − r_s/r), z = 1/√(1 − r_s/r) − 1. Photon sphere 1.5 r_s; innermost stable circular orbit 3 r_s. Tidal stretch: Newtonian 2GM·ℓ/r³ across a 2 m body. Masses: Sgr A* ≈ 4 × 10⁶ M☉ (EHT 2022), M87* ≈ 6.5 × 10⁹ M☉ (EHT 2019). GM☉ = 1.32712 × 10²⁰ m³ s⁻²."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func astrophRotationBlock() Block {
	return Block{
		Slug:        "rotation-curves",
		Title:       "Galaxy rotation curves",
		Description: "If a galaxy's mass were where its light is, stars far out would orbit slowly, like outer planets. Measured curves stay flat instead. Fit the synthetic data with a stellar disc alone, then add a dark-matter halo and watch the misfit drop.",
		Tags:        []string{"dark matter", "exponential disc", "χ² fit"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-rot",
				astrophSvg("plot", "0 0 640 330", "Rotation speed against radius: data, disc, halo and total"),
				astrophGroup("Stellar disc",
					field("md", "Disc mass", "10¹⁰ M☉", 7, 0, 20, 0.1),
					field("rd", "Scale length", "kpc", 3, 1, 8, 0.1),
				),
				astrophGroup("Dark halo",
					field("rho", "Core density", "10⁷ M☉/kpc³", 0, 0, 10, 0.01),
					field("rc", "Core radius", "kpc", 5, 0.5, 20, 0.1),
				),
				astrophPresets([2]string{"disc", "Disc only"}, [2]string{"fit", "Good fit"}),
				readouts([2]string{"χ² / point", "chi"}, [2]string{"v at 30 kpc", "v30"}, [2]string{"dark share ≤ 30 kpc", "dark"}),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "disc"), legendSwatch("var(--vec-v)", "halo"), legendSwatch("var(--brand)", "total"),
				),
				astrophNote("Synthetic data drawn from a disc + halo model with 6 km/s errors, not a real galaxy. Thin exponential disc (Freeman 1970): v² = 4πGΣ₀R_d y²[I₀K₀ − I₁K₁](y), y = R/2R_d. Pseudo-isothermal halo: v² = 4πGρ₀r_c²(1 − (r_c/R) atan(R/r_c)). G = 4.30091 × 10⁻⁶ kpc (km/s)² / M☉."),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func astrophLensingBlock() Block {
	return Block{
		Slug:        "lensing",
		Title:       "Gravitational lensing",
		Description: "Mass bends light, so a galaxy behind a massive lens appears distorted, doubled or, when perfectly aligned, smeared into an Einstein ring. Drag the background source across the lens and watch the images form, computed ray by ray from the lens equation.",
		Tags:        []string{"Einstein ring", "lens equation", "magnification"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-lens",
				astrophCanvas("Lensed image of a background galaxy; drag to move the source", h.Class("cursor-grab touch-none")),
				astrophGroup("Lens",
					field("m", "Lens mass", "10¹² M☉", 1, 0.01, 10, 0.01),
					field("dl", "Lens distance", "Gpc", 1, 0.1, 4, 0.01),
					field("ds", "Source distance", "Gpc", 2, 0.2, 5, 0.01),
				),
				astrophGroup("Source",
					field("bx", "Offset", "θ_E", 0.4, -2, 2, 0.01),
					field("size", "Size", "θ_E", 0.18, 0.02, 0.6, 0.01),
				),
				toggle("astro-lens-src", "source", "Show the true source", true),
				readouts([2]string{"θ_E", "te"}, [2]string{"images at", "img"}, [2]string{"magnification", "mu"}),
				astrophNote("Point-mass lens: β = θ − θ_E² θ/|θ|², θ_E = √(4GM/c² · D_ls/(D_l D_s)). Distances simplified to D_ls = D_s − D_l (a flat, static picture; real lensing uses angular-diameter distances). Magnification of a point source μ = (u² + 2)/(u√(u² + 4)), u = β/θ_E. Drag on the image or use the arrow keys."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func astrophExpansionBlock() Block {
	return Block{
		Slug:        "expansion",
		Title:       "The expanding universe",
		Description: "The Friedmann equation ties the expansion rate to what the universe contains. Mix radiation, matter and dark energy and integrate the scale factor a(t) from the Big Bang: the same equation gives the age of the universe and its fate.",
		Tags:        []string{"Friedmann equation", "scale factor", "age"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-fried",
				astrophSvg("plot", "0 0 640 330", "Scale factor against cosmic time"),
				astrophGroup("Universe",
					field("h0", "H₀", "km/s/Mpc", 67.4, 40, 100, 0.1),
					field("om", "Ω matter", "", 0.315, 0, 3, 0.001),
					field("ol", "Ω Λ", "", 0.685, -1, 2, 0.001),
					field("or", "Ω radiation", "10⁻⁵", 9.1, 0, 50, 0.1),
				),
				astrophPresets([2]string{"planck", "Planck 2018"}, [2]string{"eds", "Matter only"}, [2]string{"closed", "Recollapse"}, [2]string{"desitter", "Λ only"}),
				readouts([2]string{"age today", "age"}, [2]string{"Ω curvature", "ok"}, [2]string{"q₀", "q"}, [2]string{"fate", "fate"}),
				astrophNote("H(a)² = H₀²(Ω_r a⁻⁴ + Ω_m a⁻³ + Ω_k a⁻² + Ω_Λ), Ω_k = 1 − Ω_r − Ω_m − Ω_Λ; the past from the age integral ∫da/(aH), the future with RK4 in time. Deceleration q₀ = Ω_r + Ω_m/2 − Ω_Λ. Planck 2018: H₀ = 67.4, Ω_m = 0.315, age 13.8 Gyr. 1/H₀ = 977.8/H₀ Gyr."),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func astrophDistancesBlock() Block {
	return Block{
		Slug:        "distances",
		Title:       "Distances in an expanding universe",
		Description: "Beyond a few hundred megaparsecs, \"distance\" splits in three. The comoving distance is today's separation, the luminosity distance sets how faint a source looks, and the angular-diameter distance sets how big it looks, which shrinks and then grows again: very distant galaxies look larger.",
		Tags:        []string{"luminosity distance", "angular size", "lookback time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-dist",
				h.Div(h.Class("flex flex-col gap-2"),
					astrophSvg("plot", "0 0 640 260", "Comoving, luminosity and angular-diameter distance against redshift"),
					astrophSvg("size", "0 0 640 120", "Angular size of a 30 kpc galaxy against redshift"),
				),
				astrophGroup("Source",
					field("z", "Redshift", "", 1, 0.01, 10, 0.01),
				),
				astrophGroup("Universe",
					field("om", "Ω matter", "", 0.315, 0.01, 1, 0.001),
					field("ol", "Ω Λ", "", 0.685, 0, 1.5, 0.001),
				),
				readouts([2]string{"lookback", "look"}, [2]string{"comoving", "dc"}, [2]string{"luminosity", "dl"}, [2]string{"angular-diam.", "da"}, [2]string{"30 kpc spans", "ang"}),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "comoving D_C"), legendSwatch("var(--vec-v)", "luminosity D_L"), legendSwatch("var(--brand)", "angular-diameter D_A"),
				),
				astrophNote("D_C = c∫dz/H(z); transverse D_M = D_C, or (c/H₀√|Ω_k|) sinh/sin(√|Ω_k| H₀D_C/c) when curved; D_L = (1 + z)D_M; D_A = D_M/(1 + z). H₀ = 67.4 km/s/Mpc, radiation neglected (it matters only at z ≫ 100)."),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func astrophCMBBlock() Block {
	return Block{
		Slug:        "cmb",
		Title:       "The cosmic microwave background",
		Description: "Light released 380,000 years after the Big Bang, now a 2.725 K blackbody peaking at about 160 GHz. Its tiny temperature ripples have a favourite size, about a degree, set by sound waves in the early plasma and by the geometry of space. Bend space and the spots change size.",
		Tags:        []string{"CMB", "acoustic peaks", "curvature"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-cmb",
				h.Div(h.Class("grid items-center gap-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"),
					astrophCanvas("Synthetic 20° × 20° patch of CMB temperature anisotropies"),
					h.Div(h.Class("flex flex-col gap-2"),
						astrophSvg("power", "0 0 360 200", "Toy angular power spectrum with acoustic peaks"),
						astrophSvg("spectrum", "0 0 360 160", "CMB blackbody spectrum against frequency"),
					),
				),
				astrophGroup("Geometry",
					field("omega", "Ω total", "", 1, 0.3, 1.6, 0.01),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					astrophAction("new", "New sky", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"first peak ℓ", "l1"}, [2]string{"spot scale", "spot"}, [2]string{"ΔT rms", "rms"}, [2]string{"peak frequency", "nu"}),
				astrophNote("Synthetic map: a Gaussian random field on a flat 20° patch, drawn from a toy spectrum with damped acoustic peaks, not Planck data. The first peak sits near ℓ ≈ 220 for a flat universe and moves roughly as ℓ₁ ≈ 220/√Ω (closed: bigger spots). Blackbody: T = 2.7255 K (Fixsen 2009), peak of B_ν at 160.2 GHz."),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func astrophChirpBlock() Block {
	return Block{
		Slug:        "chirp",
		Title:       "A gravitational-wave chirp",
		Description: "Two black holes spiralling together radiate gravitational waves whose frequency and amplitude sweep upward until they merge. To leading order the sweep depends on one combination of the masses, the chirp mass, which is how LIGO weighed GW150914.",
		Tags:        []string{"chirp mass", "GW150914", "inspiral"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("astro-gw",
				h.Div(h.Class("flex flex-col gap-2"),
					astrophSvg("wave", "0 0 640 200", "Strain against time before merger"),
					astrophSvg("freq", "0 0 640 150", "Frequency against time before merger"),
				),
				astrophGroup("Binary",
					field("m1", "Mass 1", "M☉", 36, 1, 100, 0.01),
					field("m2", "Mass 2", "M☉", 29, 1, 100, 0.01),
					field("d", "Distance", "Mpc", 410, 10, 5000, 1),
				),
				astrophPresets([2]string{"gw150914", "GW150914"}, [2]string{"gw170817", "GW170817"}, [2]string{"heavy", "2 × 80 M☉"}),
				astrophAction("sound", "Listen", hugeicons.VolumeHighIcon()),
				readouts([2]string{"chirp mass", "mc"}, [2]string{"35 Hz → merger", "tau"}, [2]string{"cycles", "cycles"}, [2]string{"f at ISCO", "fisco"}, [2]string{"strain at ISCO", "hmax"}),
				astrophNote("Leading (Newtonian) order: f(τ) = (1/π)(5/256τ)^{3/8}(GM_c/c³)^{−5/8}, M_c = (m₁m₂)^{3/5}/(m₁ + m₂)^{1/5}, h = (4/d)(GM_c/c²)^{5/3}(πf/c)^{2/3} (optimal orientation), cut at the ISCO frequency c³/(6^{3/2}πGM). Real templates add higher post-Newtonian orders, merger and ringdown. GW150914: 36 + 29 M☉ at ≈ 410 Mpc (Abbott et al. 2016); GW170817: ≈ 1.46 + 1.27 M☉ at ≈ 40 Mpc."),
			)
		},
	}
}
