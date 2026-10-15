package site

import (
	"github.com/alexisbcz/components/ui/button"
	h "github.com/alexisbcz/libhtml"
)

// AutomotiveBlocks lists the automotive engineering gallery in display order.
func AutomotiveBlocks() []Block {
	return []Block{
		autoEngineFigureBlock(),
		autoOttoBlock(),
		autoTractionBlock(),
		autoAccelBlock(),
		autoDiffFigureBlock(),
		autoAckermannBlock(),
		autoBrakingBlock(),
		autoSuspensionBlock(),
		autoEnergyBlock(),
	}
}

// autoFigure embeds an isometric figure built by figures/<name>/build.mjs
// (from our own sources at build time, never user input).
func autoFigure(name string) h.Node {
	b, err := static.ReadFile("static/anatomy/" + name + ".html")
	if err != nil {
		return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/"+name+"/build.mjs to build the figure.")
	}
	return h.Div(h.Class("mx-auto w-full max-w-3xl"),
		h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/"+name+".css")),
		h.UnsafeHTML(string(b)))
}

// ---------------------------------------------------------------- A1

func autoEngineFigureBlock() Block {
	return Block{
		Slug:        "four-stroke",
		Title:       "Four-stroke engine",
		Description: "A single-cylinder engine with a glass cylinder. One crank angle drives everything: the piston by the exact slider-crank formula, the cams at half speed, the valves, the spark. The charge changes colour with the stroke. Arrow keys turn the crank 10° at a time (Shift: 90°).",
		Tags:        []string{"isometric SVG", "anatomy", "slider-crank"},
		Wide:        true,
		Render:      func() h.Node { return autoFigure("car-engine") },
	}
}

// ---------------------------------------------------------------- A2

func autoOttoBlock() Block {
	return Block{
		Slug:        "otto-engine",
		Title:       "Engine size, cycle and power",
		Description: "From the engine's dimensions to its output. Bore, stroke and cylinders give the displacement; the air-standard Otto cycle gives the work per cycle, the mean effective pressure and an ideal power at the chosen speed. Real engines deliver noticeably less: friction, heat loss to the walls and real combustion all cut into the ideal figure.",
		Tags:        []string{"Otto cycle", "displacement", "BMEP"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-otto",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Pressure–volume loop of one cylinder")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Engine"),
					field("bore", "Bore", "mm", 86, 50, 110, 1),
					field("stroke", "Stroke", "mm", 86, 50, 110, 1),
					field("cyl", "Cylinders", "", 4, 1, 12, 1),
					field("cr", "Compression ratio", "", 10, 6, 14, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Running"),
					field("rpm", "Speed", "rpm", 5500, 1000, 8000, 100),
					field("q", "Heat added", "kJ/kg", 1800, 500, 2800, 50),
				),
				readouts([2]string{"displacement", "vd"}, [2]string{"η Otto", "eta"}, [2]string{"MEP", "mep"}, [2]string{"ideal power", "pw"}, [2]string{"ideal torque", "tq"}, [2]string{"peak pressure", "pmax"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func autoTractionBlock() Block {
	return Block{
		Slug:        "traction",
		Title:       "Traction diagram",
		Description: "What each gear can push against what the air and the tyres push back. The force at the wheels is engine torque × gear ratio × final drive × driveline efficiency ÷ tyre radius; the resistance is ½ρC_dAv² + C_rr·m·g. Top speed is where the last useful curve meets the resistance. The torque curve is synthetic.",
		Tags:        []string{"gearing", "drag", "top speed"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-traction",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Tractive force per gear and road resistance against speed")),
					h.Svg(h.Data("torque", ""), h.ViewBox("0 0 560 110"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Engine torque and power against engine speed")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Car"),
					field("mass", "Mass", "kg", 1400, 800, 2500, 10),
					field("cda", "C_d·A", "m²", 0.65, 0.4, 1.2, 0.01),
					field("fd", "Final drive", "", 3.7, 2.5, 5, 0.05),
					field("tq", "Peak torque", "N·m", 250, 100, 600, 5),
				),
				readouts([2]string{"top speed", "vmax"}, [2]string{"in gear", "gear"}, [2]string{"power used", "pw"}, [2]string{"drag share", "drag"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func autoAccelBlock() Block {
	return Block{
		Slug:        "acceleration",
		Title:       "0–100 km/h",
		Description: "The traction diagram run forward in time: the car accelerates in each gear to the shift point, loses 0.3 s per shift, and its driven wheels can only push μ times their load, so first gear is grip-limited. Same synthetic engine and gearbox as above.",
		Tags:        []string{"simulation", "shift points", "grip"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-accel",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Speed against time with gear changes")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Launch"),
					field("mass", "Mass", "kg", 1400, 800, 2500, 10),
					field("shift", "Shift at", "rpm", 6200, 3000, 6800, 100),
					field("mu", "Tyre grip μ", "", 1, 0.3, 1.3, 0.05),
					field("drive", "Load on driven axle", "%", 60, 40, 100, 1),
				),
				readouts([2]string{"0–100 km/h", "t100"}, [2]string{"at 100 km/h", "g100"}, [2]string{"grip-limited", "slip"}, [2]string{"distance", "dist"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func autoDiffFigureBlock() Block {
	return Block{
		Slug:        "differential",
		Title:       "Open differential",
		Description: "Why a car can turn at all. The outer wheel must travel farther than the inner one; the spider gears let the two half-shafts turn at different speeds while the carrier, driven by the ring gear, turns at exactly their average. Steer with the arrow keys and watch the spiders start to spin on their pin.",
		Tags:        []string{"isometric SVG", "anatomy", "gears"},
		Wide:        true,
		Render:      func() h.Node { return autoFigure("car-diff") },
	}
}

// ---------------------------------------------------------------- A6

func autoAckermannBlock() Block {
	return Block{
		Slug:        "ackermann",
		Title:       "Ackermann steering",
		Description: "In a turn every wheel should roll around the same centre, so the inner front wheel must steer more than the outer one. Drag the steering angle and the geometry finds the turning centre on the line of the rear axle.",
		Tags:        []string{"geometry", "turning circle", "top view"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-ackermann",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 360"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Top view of the car, its wheels and the turning centre")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Car"),
					field("wb", "Wheelbase", "m", 2.7, 2, 3.5, 0.01),
					field("track", "Track", "m", 1.55, 1.2, 1.8, 0.01),
					field("delta", "Inner wheel angle", "°", 25, 2, 40, 0.5),
				),
				readouts([2]string{"outer wheel", "outer"}, [2]string{"difference", "diff"}, [2]string{"radius (rear axle)", "r"}, [2]string{"turning circle", "circle"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func autoBrakingBlock() Block {
	return Block{
		Slug:        "braking",
		Title:       "Stopping distance",
		Description: "Stopping takes two parts: the distance covered while the driver reacts, v·t, and the braking distance, v²/(2μg), which grows with the square of speed. Friction coefficients are typical values, not guarantees.",
		Tags:        []string{"friction", "kinematics", "presets"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-braking",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("bars", ""), h.Class("flex flex-col gap-2")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Stopping distance against speed")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Stop"),
					field("v", "Speed", "km/h", 100, 10, 200, 1),
					field("mu", "Friction μ", "", 0.7, 0.05, 1.1, 0.01),
					field("t", "Reaction time", "s", 1, 0.3, 2.5, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Road surface"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"0.8", "Dry asphalt"}, {"0.5", "Wet asphalt"}, {"0.2", "Packed snow"}, {"0.1", "Ice"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Class("justify-between font-normal"), h.Data("mu", p[0]),
								h.Span(p[1]), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "μ≈"+p[0]))
						}),
					),
				),
				readouts([2]string{"reaction", "react"}, [2]string{"braking", "brake"}, [2]string{"total", "total"}, [2]string{"deceleration", "decel"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func autoSuspensionBlock() Block {
	return Block{
		Slug:        "suspension",
		Title:       "Quarter-car suspension",
		Description: "One corner of the car as two masses: the body on the spring and damper, the wheel on the tyre's own stiffness. Drive over a 5 cm bump and compare: soft damping lets the body float, hard damping kicks it and makes the tyre's grip vary. Integrated with RK4.",
		Tags:        []string{"mass–spring–damper", "RK4", "comfort vs grip"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-suspension",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 320"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Road, wheel and body heights over time")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Corner"),
					field("zeta", "Damping ratio ζ", "", 0.3, 0.05, 1.5, 0.01),
					field("ks", "Spring", "kN/m", 20, 8, 60, 1),
					field("v", "Speed", "km/h", 36, 5, 120, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--muted-foreground)", "road"),
					legendSwatch("var(--vec-u)", "wheel"),
					legendSwatch("var(--brand)", "body"),
				),
				readouts([2]string{"body peak", "peak"}, [2]string{"body accel", "acc"}, [2]string{"tyre load", "load"}, [2]string{"body freq", "freq"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A9

func autoEnergyBlock() Block {
	return Block{
		Slug:        "ev-vs-ice",
		Title:       "Energy per kilometre: EV and petrol",
		Description: "The road asks the same energy of both cars; what differs is the chain that delivers it. A petrol engine turns roughly a quarter of its fuel into motion, an electric drivetrain closer to nine tenths, and it can win back part of the braking energy. Efficiencies are typical approximate values.",
		Tags:        []string{"energy chain", "regenerative braking", "approximate"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("auto-energy",
				h.Div(h.Data("chain", ""), h.Class("flex flex-col gap-4 p-1")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cruise"),
					field("v", "Speed", "km/h", 110, 20, 160, 1),
					field("mass", "Mass", "kg", 1600, 900, 2600, 10),
					field("cda", "C_d·A", "m²", 0.6, 0.4, 1.2, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Drivetrains"),
					field("ice", "Tank → wheel", "%", 25, 15, 40, 1),
					field("ev", "Battery → wheel", "%", 88, 70, 95, 1),
					field("regen", "Regen recovered", "%", 60, 0, 80, 1),
				),
				readouts([2]string{"at the wheels", "wheel"}, [2]string{"petrol", "fuel"}, [2]string{"battery", "batt"}, [2]string{"stop from speed", "stop"}),
			)
		},
	}
}
