package site

import (
	h "github.com/alexisbcz/libhtml"
)

// MechanicalBlocks lists the mechanical engineering gallery in display order.
func MechanicalBlocks() []Block {
	return []Block{
		mechPlanetaryFigureBlock(),
		mechGearsBlock(),
		mechCamFigureBlock(),
		mechCamLawsBlock(),
		mechFourBarBlock(),
		mechBearingBlock(),
		mechSpringBlock(),
		mechBeltBlock(),
		mechTorsionBlock(),
		mechFlywheelBlock(),
	}
}

// mechFigure embeds an isometric figure built by figures/<name>/build.mjs
// (from our own sources at build time, never user input).
func mechFigure(name string) h.Node {
	b, err := static.ReadFile("static/anatomy/" + name + ".html")
	if err != nil {
		return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/"+name+"/build.mjs to build the figure.")
	}
	return h.Div(h.Class("mx-auto w-full max-w-3xl"),
		h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/"+name+".css")),
		h.UnsafeHTML(string(b)))
}

// ---------------------------------------------------------------- ME1

func mechPlanetaryFigureBlock() Block {
	return Block{
		Slug:        "planetary",
		Title:       "Planetary gear train",
		Description: "A sun, three planets on a carrier and an internal ring, on a demo stand with a brake for each member. Hold one member and the other two are locked together by the Willis equation, (n_s − n_c)/(n_r − n_c) = −Z_r/Z_s. With the ring held, the carrier turns at the sun's speed divided by 1 + Z_r/Z_s = 4. Press 1, 2 or 3 to change which member is held, or click the stand.",
		Tags:        []string{"isometric SVG", "anatomy", "Willis equation"},
		Wide:        true,
		Render:      func() h.Node { return mechFigure("mechanical-planetary") },
	}
}

// ---------------------------------------------------------------- ME2

func mechGearsBlock() Block {
	return Block{
		Slug:        "involute-gears",
		Title:       "Involute spur gears",
		Description: "Two spur gears drawn with exact involute flanks and a 20° pressure angle. The pitch diameter is d = m·z, the centre distance is a = m(z₁ + z₂)/2, and the speed ratio is z₂/z₁. The contact runs along the line of action, which is tangent to both base circles, and the contact ratio counts how many tooth pairs share the load on average. Turn on a second stage to make a compound train, whose ratios multiply.",
		Tags:        []string{"involute", "module", "compound train"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-gears",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Two meshing involute spur gears with their pitch circles, base circles and line of action")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mesh"),
					field("m", "Module", "mm", 4, 1, 10, 0.5),
					field("z1", "Pinion teeth z₁", "", 14, 8, 60, 1),
					field("z2", "Gear teeth z₂", "", 28, 8, 90, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					toggle("mech-gears-stage", "stage", "Second stage", false),
					field("z3", "Pinion z₃", "", 12, 8, 60, 1),
					field("z4", "Gear z₄", "", 36, 8, 90, 1),
				),
				h.Div(h.Class("flex items-center gap-2"), playPause()),
				readouts([2]string{"pitch d₁ / d₂", "d"}, [2]string{"centre distance", "a"}, [2]string{"contact ratio", "eps"}, [2]string{"ratio", "i"}, [2]string{"undercut", "cut"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME3

func mechCamFigureBlock() Block {
	return Block{
		Slug:        "cam-bench",
		Title:       "Cam and follower",
		Description: "A disc cam on a shaft turned by a handwheel lifts a roller follower that slides in a guide bushing. A spring keeps the roller on the cam, and a dial gauge reads the lift. The profile is generated from the motion law: rise 10 mm over 120°, dwell 60°, return over 120°, then dwell. Arrow keys turn the cam 5°, L switches between cycloidal and harmonic motion, and Space or a click pauses it.",
		Tags:        []string{"isometric SVG", "anatomy", "cam profile"},
		Wide:        true,
		Render:      func() h.Node { return mechFigure("mechanical-cam") },
	}
}

// ---------------------------------------------------------------- ME4

func mechCamLawsBlock() Block {
	return Block{
		Slug:        "cam-motion",
		Title:       "Cam motion laws",
		Description: "The same rise, dwell, return and dwell as the bench above, under four motion laws. The plots show displacement, velocity, acceleration and jerk. Uniform velocity has infinite acceleration spikes at the ends of each stroke. Harmonic motion removes those, but its acceleration still jumps where it meets a dwell. Cycloidal and 3-4-5 polynomial motion start and stop with zero acceleration. Picking harmonic or cycloidal also recuts the cam on the bench, and the dashed cursor follows the bench's angle.",
		Tags:        []string{"kinematics", "jerk", "linked to the figure"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-camlaw",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 400"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Follower displacement, velocity, acceleration and jerk against cam angle")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Motion law"),
					segs("Motion law", [2]string{"cycloidal", "Cycloidal"}, [2]string{"harmonic", "Harmonic"}, [2]string{"345", "3-4-5"}, [2]string{"uniform", "Uniform"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Follower"),
					field("h", "Lift", "mm", 10, 1, 40, 0.5),
					field("rpm", "Cam speed", "rpm", 300, 10, 3000, 10),
				),
				readouts([2]string{"peak velocity", "v"}, [2]string{"peak accel.", "a"}, [2]string{"peak jerk", "j"}, [2]string{"at the ends", "ends"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME5

func mechFourBarBlock() Block {
	return Block{
		Slug:        "four-bar",
		Title:       "Four-bar linkage",
		Description: "A crank, a coupler and a rocker pinned to a fixed ground link. Loop closure fixes the coupler and rocker for every crank angle: the coupler's far pin must lie on two circles at once. Grashof's condition, s + l ≤ p + q, tells whether any link can turn fully. When the shortest link is the crank you get a crank-rocker, and when no assembly exists the crank stops at a dead point. The point on the coupler traces the coupler curve.",
		Tags:        []string{"Grashof", "loop closure", "coupler curve"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-fourbar",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 360"), h.Class("mx-auto block w-full max-w-[640px] touch-none"), h.Role("img"), h.Aria("label", "A four-bar linkage and the curve traced by a point on its coupler")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Links"),
					field("a", "Crank", "", 2, 0.5, 12, 0.1),
					field("b", "Coupler", "", 7, 0.5, 12, 0.1),
					field("c", "Rocker", "", 9, 0.5, 12, 0.1),
					field("d", "Ground", "", 6, 0.5, 12, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Coupler point"),
					field("u", "Along coupler", "×b", 0.5, -1, 2, 0.05),
					field("w", "Offset", "×b", 0.4, -1.5, 1.5, 0.05),
				),
				h.Div(h.Class("flex items-center gap-2"), playPause()),
				readouts([2]string{"s + l", "sl"}, [2]string{"p + q", "pq"}, [2]string{"type", "kind"}, [2]string{"crank angle", "th"}, [2]string{"transmission", "mu"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME6

func mechBearingBlock() Block {
	return Block{
		Slug:        "bearing-life",
		Title:       "Rolling bearing life",
		Description: "The basic rating life L₁₀ is the number of revolutions that 90% of a large batch of identical bearings will survive: L₁₀ = (C/P)^p million revolutions, with p = 3 for ball bearings and 10/3 for roller bearings. C is the dynamic load rating from the catalogue and P is the equivalent load. Because of the exponent, halving the load makes a ball bearing last eight times longer. The curve is the Weibull survival of the batch, with a shape parameter of 1.5.",
		Tags:        []string{"L10", "ISO 281", "Weibull"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-bearing",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 250"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Rating life against load ratio, log-log")),
					h.Svg(h.Data("surv", ""), h.ViewBox("0 0 560 150"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Fraction of bearings surviving against life")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Bearing"),
					segs("Bearing type", [2]string{"ball", "Ball"}, [2]string{"roller", "Roller"}),
					field("C", "Load rating C", "kN", 25, 1, 500, 0.5),
					field("P", "Equivalent load P", "kN", 5, 0.1, 200, 0.1),
					field("rpm", "Speed", "rpm", 1500, 10, 20000, 10),
				),
				readouts([2]string{"C / P", "cp"}, [2]string{"L₁₀", "l10"}, [2]string{"L₁₀h", "hours"}, [2]string{"L₅₀ (median)", "l50"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME7

func mechSpringBlock() Block {
	return Block{
		Slug:        "coil-springs",
		Title:       "Helical compression springs",
		Description: "The stiffness of a helical spring is k = Gd⁴/(8D³n), with wire diameter d, mean coil diameter D and n active coils. Doubling the wire makes the spring sixteen times stiffer. The shear stress at the inside of the coil is τ = K_w · 8FD/(πd³), where the Wahl factor K_w = (4C − 1)/(4C − 4) + 0.615/C corrects for curvature and direct shear, and C = D/d is the spring index. Two springs in series add their compliances, and in parallel they add their stiffnesses.",
		Tags:        []string{"stiffness", "Wahl factor", "series and parallel"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-spring",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 320"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "The spring under load and its force-deflection line")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Spring"),
					field("d", "Wire d", "mm", 2, 0.5, 8, 0.1),
					field("D", "Mean coil D", "mm", 16, 4, 60, 0.5),
					field("n", "Active coils", "", 8, 2, 30, 0.5),
					field("G", "Shear modulus G", "GPa", 79, 20, 90, 1),
					field("F", "Load F", "N", 60, 1, 1000, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Two identical springs"),
					segs("Arrangement", [2]string{"one", "One"}, [2]string{"series", "Series"}, [2]string{"parallel", "Parallel"}),
				),
				readouts([2]string{"index C", "c"}, [2]string{"k (one)", "k"}, [2]string{"k (set)", "kset"}, [2]string{"deflection", "x"}, [2]string{"Wahl K_w", "kw"}, [2]string{"τ max", "tau"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME8

func mechBeltBlock() Block {
	return Block{
		Slug:        "belt-drive",
		Title:       "Belt friction",
		Description: "A flat belt slips when the ratio of its tight-side tension to its slack-side tension reaches e^(μθ), the Euler–Eytelwein (capstan) limit. Here μ is the friction coefficient and θ is the wrap angle in radians. The power it carries is (T₁ − T₂)·v. A V-belt wedges in its groove, which raises the effective friction to μ/sin(β/2). The same law lets a sailor hold a heavy load with a few turns of rope around a winch.",
		Tags:        []string{"capstan equation", "friction", "power"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-belt",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("drive", ""), h.ViewBox("0 0 560 190"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Two pulleys and the belt, tension shown by thickness")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 170"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Tension ratio against wrap angle")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Belt"),
					field("mu", "Friction μ", "", 0.3, 0.05, 0.8, 0.01),
					field("theta", "Wrap θ", "°", 180, 30, 720, 1),
					field("T1", "Tight side T₁", "N", 800, 10, 5000, 10),
					field("v", "Belt speed", "m/s", 15, 1, 40, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					toggle("mech-belt-v", "vbelt", "V-belt, 40° groove", false),
				),
				readouts([2]string{"e^(μθ)", "ratio"}, [2]string{"slack side T₂", "T2"}, [2]string{"effective pull", "pull"}, [2]string{"power", "pw"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME9

func mechTorsionBlock() Block {
	return Block{
		Slug:        "shaft-torsion",
		Title:       "Shaft in torsion",
		Description: "A shaft carrying torque T shears in proportion to radius: τ = Tr/J, which is zero at the centre and greatest at the surface. The polar moment is J = π(D⁴ − d⁴)/32. The twist over a length L is φ = TL/(GJ). Material near the centre carries almost nothing, so boring it out saves a lot of mass for little strength. The comparison shows a solid shaft with the same mass.",
		Tags:        []string{"polar moment", "shear stress", "solid vs hollow"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-torsion",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Cross-sections and the shear stress across the radius")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Shaft"),
					field("T", "Torque T", "N·m", 500, 1, 20000, 10),
					field("D", "Outer D", "mm", 40, 5, 200, 1),
					field("k", "Bore d/D", "", 0.6, 0, 0.95, 0.01),
					field("L", "Length L", "m", 1, 0.1, 10, 0.1),
					field("G", "Shear modulus G", "GPa", 80, 20, 120, 1),
				),
				readouts([2]string{"J", "J"}, [2]string{"τ max", "tau"}, [2]string{"twist φ", "phi"}, [2]string{"same-mass solid", "solid"}, [2]string{"mass saved", "save"}),
			)
		},
	}
}

// ---------------------------------------------------------------- ME10

func mechFlywheelBlock() Block {
	return Block{
		Slug:        "flywheel",
		Title:       "Flywheel sizing",
		Description: "A single-cylinder four-stroke engine delivers its torque in one pulse every two turns, while the load takes a steady torque. The flywheel stores the surplus and gives it back, but it can only do that by speeding up and slowing down. With E = ½Iω², the largest swing of energy ΔE sets the speed fluctuation C_s = (ω_max − ω_min)/ω ≈ ΔE/(Iω²). The engine's torque curve is synthetic.",
		Tags:        []string{"kinetic energy", "fluctuation", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mech-flywheel",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 210"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Engine torque and load torque over two revolutions")),
					h.Svg(h.Data("speed", ""), h.ViewBox("0 0 560 130"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Shaft speed over two revolutions")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Engine and wheel"),
					field("rpm", "Mean speed", "rpm", 1500, 300, 6000, 50),
					field("tq", "Mean torque", "N·m", 40, 5, 300, 1),
					field("I", "Flywheel I", "kg·m²", 1, 0.01, 5, 0.01),
				),
				readouts([2]string{"stored E", "E"}, [2]string{"swing ΔE", "dE"}, [2]string{"fluctuation C_s", "cs"}, [2]string{"speed range", "range"}, [2]string{"I for C_s = 1%", "need"}),
			)
		},
	}
}
