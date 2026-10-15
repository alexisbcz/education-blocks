package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PhysicsBlocks lists the classical physics gallery in display order.
func PhysicsBlocks() []Block {
	return []Block{
		projectileBlock(),
		pendulumBlock(),
		oscillatorBlock(),
		orbitBlock(),
		trackBlock(),
		wavesBlock(),
		collisionBlock(),
		inclineBlock(),
		snellBlock(),
	}
}

// physPlay is a play/pause button with a custom idle label.
func physPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func actionButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- P1

func projectileBlock() Block {
	return Block{
		Slug:        "projectile",
		Title:       "Projectile motion",
		Description: "Launch, compare, launch again. Without air resistance 45° goes farthest and the range is v²·sin 2θ / g; add drag (integrated with RK4) and the best angle drops below 45°, the path stops being a parabola.",
		Tags:        []string{"RK4", "drag", "overlay"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("proj",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 340"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "Trajectories")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Launch"),
					field("angle", "Angle", "°", 45, 1, 89, 1),
					field("speed", "Speed", "m/s", 20, 1, 60, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Air"),
					segs("Drag model", [2]string{"none", "None"}, [2]string{"linear", "Linear"}, [2]string{"quadratic", "Quadratic"}),
					field("k", "Drag k", "", 0.1, 0, 1, 0.01),
					h.P(h.Data("out", "model"), h.Class("font-mono text-[11px] text-muted-foreground"), "a = −g ŷ"),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					actionButton("launch", "Launch", hugeicons.Rocket01Icon()),
					actionButton("clear", "Clear", hugeicons.Delete02Icon())),
				readouts([2]string{"range", "range"}, [2]string{"apex", "apex"}, [2]string{"flight time", "time"},
					[2]string{"no-drag range", "ideal"}, [2]string{"best angle", "best"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P2

func pendulumBlock() Block {
	return Block{
		Slug:        "pendulum",
		Title:       "Pendulum",
		Description: "The full nonlinear pendulum, θ″ = −(g/L) sin θ − γθ′ + A cos ωt, against the small-angle approximation that every textbook period formula assumes. Raise the amplitude and the real period grows; add damping and a drive to find resonance.",
		Tags:        []string{"RK4", "nonlinear", "resonance"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("pend",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]"),
					h.Svg(h.Data("swing", ""), h.ViewBox("-1.2 -0.25 2.4 2.4"), h.Class("mx-auto block w-full max-w-[220px]"), h.Role("img"), h.Aria("label", "The pendulum")),
					h.Div(h.Class("flex min-w-0 flex-col gap-2"),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--foreground)", "nonlinear θ(t)"),
							legendSwatch("var(--vec-u)", "small-angle"),
						),
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Angle over time")),
						h.Svg(h.Data("res", ""), h.ViewBox("0 0 520 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Resonance curve")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pendulum"),
					field("amp", "Amplitude", "°", 30, 1, 179, 1),
					field("len", "Length", "m", 1, 0.1, 5, 0.05),
					field("gamma", "Damping γ", "1/s", 0, 0, 2, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Drive"),
					field("drive", "Amplitude A", "rad/s²", 0, 0, 5, 0.05),
					field("omega", "Frequency ω", "rad/s", 3, 0.1, 10, 0.05),
				),
				readouts([2]string{"period", "period"}, [2]string{"2π√(L/g)", "ideal"}, [2]string{"ratio", "ratio"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P3

func oscillatorBlock() Block {
	return Block{
		Slug:        "oscillator",
		Title:       "Damped oscillator and phase space",
		Description: "A mass on a spring, x″ + 2ζω₀x′ + ω₀²x = 0, drawn twice: position over time, and the same motion as a curve in phase space (x, v). Below ζ = 1 it rings and spirals in; at ζ = 1 it returns fastest without overshoot; above, it creeps.",
		Tags:        []string{"phase portrait", "damping ratio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("osc",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("xt", ""), h.ViewBox("0 0 400 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Position over time")),
					h.Svg(h.Data("phase", ""), h.ViewBox("0 0 260 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Phase portrait")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					field("zeta", "Damping ζ", "", 0.15, 0, 3, 0.01),
					field("w0", "ω₀", "rad/s", 2, 0.5, 6, 0.1),
					field("x0", "x₀", "m", 1, -2, 2, 0.05),
					field("v0", "v₀", "m/s", 0, -6, 6, 0.1),
				),
				readouts([2]string{"regime", "regime"}, [2]string{"ω_d", "wd"}, [2]string{"Q", "q"}, [2]string{"energy left at 10 s", "left"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P4

func orbitBlock() Block {
	return Block{
		Slug:        "orbit",
		Title:       "Orbits and Kepler's laws",
		Description: "A planet around the Sun in astronomical units and years, where GM = 4π² AU³/yr². Drag the velocity arrow: at 2π AU/yr the orbit is circular, faster it stretches into an ellipse, and past √2·2π it escapes. Equal-time wedges have equal areas: Kepler's second law.",
		Tags:        []string{"velocity Verlet", "drag", "Kepler"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("phys-orbit",
				h.Svg(h.Data("plot", ""), h.ViewBox("-4 -3 8 6"), h.Class("mx-auto block aspect-[4/3] w-full max-w-[640px] touch-none select-none"), h.Role("img"), h.Aria("label", "Orbit. Drag the arrow tip to change the launch velocity.")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Launch at 1 AU"),
					field("v", "Speed", "AU/yr", 6.28, 1, 12, 0.01),
					field("dir", "Direction", "°", 0, -80, 80, 1),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("orb-wedges", "wedges", "Equal-time wedges", true),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), physPlay("Play"),
					actionButton("circular", "Circular", hugeicons.CircleIcon())),
				readouts([2]string{"energy", "e"}, [2]string{"drift", "drift"}, [2]string{"eccentricity", "ecc"}, [2]string{"period", "period"}, [2]string{"orbit", "kind"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P5

func trackBlock() Block {
	return Block{
		Slug:        "track",
		Title:       "Energy on a track",
		Description: "A bead sliding on a curved track. Without friction, kinetic plus potential energy stays constant and the bead returns to its starting height; with friction the missing energy turns into heat, shown in its own bar.",
		Tags:        []string{"conservation", "friction", "bars"},
		Wide:        true,
		Render: func() h.Node {
			bar := func(key, label, color string) h.Node {
				return h.Div(h.Class("flex items-center gap-2 text-xs"),
					h.Span(h.Class("w-16 text-muted-foreground"), label),
					h.Div(h.Class("h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/8"),
						h.Div(h.Data("bar", key), h.Class("h-full rounded-full"), h.Style("width:0;background:"+color))),
					h.Span(h.Data("out", key), h.Class("w-16 text-right font-mono tabular-nums"), "—"),
				)
			}
			return plotPanel("track",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "Bead on a track")),
					h.Div(h.Class("mx-auto flex w-full max-w-[720px] flex-col gap-1.5 px-2"),
						bar("ke", "kinetic", "var(--vec-u)"),
						bar("pe", "potential", "var(--ion-cl)"),
						bar("heat", "heat", "var(--ion-na)"),
						bar("total", "total", "var(--foreground)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Release"),
					field("x0", "Start at x", "m", 0.5, 0, 9.5, 0.1),
					field("mu", "Friction μ", "", 0, 0, 0.3, 0.005),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), physPlay("Release"),
					actionButton("reset", "Reset", hugeicons.RefreshIcon())),
				readouts([2]string{"time", "t"}, [2]string{"speed", "speed"}, [2]string{"height", "height"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Mass 1 kg, g = 9.81 m/s². Friction uses μ·N with N from gravity and curvature."),
			)
		},
	}
}

// ---------------------------------------------------------------- P6

func wavesBlock() Block {
	return Block{
		Slug:        "waves",
		Title:       "Superposition of waves",
		Description: "Two sinusoidal waves on the same string add point by point. Running in opposite directions at the same frequency they make a standing wave with fixed nodes; at slightly different frequencies in the same direction they beat at |f₁ − f₂|.",
		Tags:        []string{"superposition", "standing waves", "beats"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("waves",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "wave 1"),
						legendSwatch("var(--vec-v)", "wave 2"),
						legendSwatch("var(--foreground)", "sum"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "Two waves and their sum")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Preset"),
					segs("Preset", [2]string{"standing", "Standing"}, [2]string{"beats", "Beats"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Waves"),
					field("f1", "f₁", "Hz", 0.5, 0.05, 3, 0.05),
					field("f2", "f₂", "Hz", 0.5, 0.05, 3, 0.05),
					field("v", "Speed", "m/s", 1, 0.2, 4, 0.1),
					toggle("waves-opp", "opposite", "Wave 2 travels left", true),
				),
				h.Div(h.Class("grid grid-cols-1 gap-2"), physPlay("Play")),
				readouts([2]string{"λ₁", "l1"}, [2]string{"λ₂", "l2"}, [2]string{"beat", "beat"}, [2]string{"pattern", "pattern"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P7

func collisionBlock() Block {
	return Block{
		Slug:        "collision",
		Title:       "Collisions in one dimension",
		Description: "Two carts on a frictionless track. Momentum is always conserved; kinetic energy only when the collision is elastic (e = 1). At e = 0 the carts stick together and the lost energy is as large as it can be.",
		Tags:        []string{"momentum", "restitution", "animation"},
		Wide:        true,
		Render: func() h.Node {
			cell := func(key string) h.Node {
				return h.Td(h.Data("out", key), h.Class("px-2 py-1.5 text-right tabular-nums"), "—")
			}
			return plotPanel("coll",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 150"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "Two carts on a track")),
					h.Div(h.Class("scroll-thin mx-auto w-full max-w-[720px] overflow-x-auto"),
						h.Table(h.Class("w-full min-w-[420px] font-mono text-xs"),
							h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
								h.Th(h.Class("px-2 py-1.5 font-normal"), ""),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "v₁ (m/s)"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "v₂ (m/s)"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "p (kg·m/s)"),
								h.Th(h.Class("px-2 py-1.5 text-right font-normal"), "KE (J)"),
							)),
							h.Tbody(
								h.Tr(h.Class("border-b"), h.Td(h.Class("px-2 py-1.5 text-muted-foreground"), "before"), cell("v1"), cell("v2"), cell("p"), cell("ke")),
								h.Tr(h.Td(h.Class("px-2 py-1.5 text-muted-foreground"), "after"), cell("v1a"), cell("v2a"), cell("pa"), cell("kea")),
							),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Carts"),
					field("m1", "m₁", "kg", 2, 0.1, 10, 0.1),
					field("v1", "v₁", "m/s", 3, -6, 6, 0.1),
					field("m2", "m₂", "kg", 1, 0.1, 10, 0.1),
					field("v2", "v₂", "m/s", -1, -6, 6, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Collision"),
					field("e", "Restitution e", "", 1, 0, 1, 0.01),
				),
				h.Div(h.Class("grid grid-cols-1 gap-2"), physPlay("Run")),
				readouts([2]string{"KE lost", "lost"}, [2]string{"type", "type"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P8

func inclineBlock() Block {
	return Block{
		Slug:        "incline",
		Title:       "Inclined plane",
		Description: "A free-body diagram that solves itself. Weight splits into components along and across the slope; static friction holds the block until tan θ exceeds μs, then kinetic friction μk·N takes over and the block accelerates at g(sin θ − μk cos θ).",
		Tags:        []string{"free-body diagram", "friction", "vectors"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("incline",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "weight mg"),
						legendSwatch("var(--vec-u)", "normal N"),
						legendSwatch("var(--ion-na)", "friction"),
						legendSwatch("var(--vec-out)", "components"),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Block on an inclined plane with forces")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Slope"),
					field("angle", "Angle θ", "°", 25, 0, 80, 0.5),
					field("m", "Mass", "kg", 2, 0.1, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Friction"),
					field("mus", "μs", "", 0.5, 0, 1.5, 0.01),
					field("muk", "μk", "", 0.3, 0, 1.5, 0.01),
				),
				readouts([2]string{"N", "n"}, [2]string{"friction", "f"}, [2]string{"acceleration", "a"}, [2]string{"slips above", "crit"}, [2]string{"state", "state"}),
			)
		},
	}
}

// ---------------------------------------------------------------- P9

func snellBlock() Block {
	return Block{
		Slug:        "snell",
		Title:       "Refraction and Snell's law",
		Description: "Light crossing into another medium bends: n₁ sin θ₁ = n₂ sin θ₂. Drag the source around the circle. Going from glass to air, past the critical angle no light gets out: total internal reflection. Ray brightness follows the Fresnel equations.",
		Tags:        []string{"optics", "Fresnel", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("snell",
				h.Svg(h.Data("plot", ""), h.ViewBox("-1.25 -1.1 2.5 2.2"), h.Class("mx-auto block aspect-[25/22] w-full max-w-[560px] touch-none select-none"), h.Role("img"), h.Aria("label", "Ray diagram. Drag the source to change the angle of incidence.")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Media"),
					segs("Preset", [2]string{"air-glass", "Air → glass"}, [2]string{"glass-air", "Glass → air"}, [2]string{"air-water", "Air → water"}),
					field("n1", "n₁ (top)", "", 1, 1, 2.5, 0.01),
					field("n2", "n₂ (bottom)", "", 1.5, 1, 2.5, 0.01),
					field("theta", "Incidence θ₁", "°", 40, 0, 89, 0.5),
				),
				readouts([2]string{"θ₂", "t2"}, [2]string{"critical angle", "crit"}, [2]string{"reflected", "r"}, [2]string{"transmitted", "tr"}),
			)
		},
	}
}
