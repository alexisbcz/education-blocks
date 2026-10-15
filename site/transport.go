package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// TransportBlocks lists the transport and urban systems gallery in display
// order. Every model is stated on its block; cities and networks are
// synthetic.
func TransportBlocks() []Block {
	return []Block{
		transFundamentalBlock(),
		transNaSchBlock(),
		transShockBlock(),
		transBraessBlock(),
		transEquilibriumBlock(),
		transBusBlock(),
		transWebsterBlock(),
		transIsochroneBlock(),
		transScalingBlock(),
		transCO2Block(),
	}
}

// transSvg is a plot surface in a pixel viewBox.
func transSvg(name, viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("block w-full"), h.Role("img"), h.Aria("label", label))
}

func transButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func transNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- T1

func transFundamentalBlock() Block {
	return Block{
		Slug:        "fundamental-diagram",
		Title:       "The fundamental diagram",
		Description: "Greenshields' model of a road: speed falls linearly with density, so flow q = k·v rises, peaks at half the jam density, then falls. The same flow can be carried free-flowing or congested; only the left branch is stable.",
		Tags:        []string{"Greenshields", "flow–density", "capacity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-fd",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					transSvg("q", "0 0 400 300", "Flow against density"),
					transSvg("v", "0 0 260 300", "Speed against density"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Road"),
					field("vf", "Free-flow speed", "km/h", 100, 20, 130, 1),
					field("kj", "Jam density", "veh/km", 120, 60, 200, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Traffic"),
					field("k", "Density", "veh/km", 40, 0, 200, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "free flow"),
					legendSwatch("var(--code-del)", "congested"),
				),
				readouts([2]string{"speed", "v"}, [2]string{"flow", "q"}, [2]string{"capacity", "qmax"}, [2]string{"at density", "kc"}, [2]string{"regime", "regime"}),
			)
		},
	}
}

// ---------------------------------------------------------------- T2

func transNaSchBlock() Block {
	return Block{
		Slug:        "phantom-jams",
		Title:       "Phantom traffic jams",
		Description: "The Nagel–Schreckenberg cellular automaton (1992): cars on a ring road accelerate, keep their distance, randomly hesitate, and move. No bottleneck, no accident, yet stop-and-go waves appear and drift backwards. Time runs downward in the space–time diagram.",
		Tags:        []string{"cellular automaton", "space–time", "emergence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-nasch",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex items-center justify-between px-1 font-mono text-[11px] text-muted-foreground"),
						h.Span("position on the ring →"), h.Span("time ↓ (1 row = 1 s)")),
					h.Canvas(h.Data("canvas", ""), h.Class("block w-full rounded-md border [image-rendering:pixelated]"),
						h.Role("img"), h.Aria("label", "Space–time diagram of cars on a ring road")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "moving car"),
						legendSwatch("var(--code-del)", "stopped car"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ring road (200 cells × 7.5 m)"),
					field("density", "Density", "cars/cell", 0.25, 0.02, 0.6, 0.01),
					field("p", "Hesitation p", "", 0.25, 0, 0.6, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					playPauseLabel("Run"),
					transButton("reseed", "New start", hugeicons.ShuffleIcon()),
				),
				readouts([2]string{"cars", "n"}, [2]string{"mean speed", "speed"}, [2]string{"flow", "flow"}, [2]string{"stopped", "stopped"}),
				transNote("vmax = 5 cells/s = 135 km/h. Rules per second: accelerate by 1, slow to the gap ahead, slow by 1 with probability p, move."),
			)
		},
	}
}

// ---------------------------------------------------------------- T3

func transShockBlock() Block {
	return Block{
		Slug:        "shockwaves",
		Title:       "Shockwaves at a red light",
		Description: "Kinematic wave theory (Lighthill–Whitham 1955, Richards 1956): where two traffic states meet, the boundary moves at w = (q₂ − q₁)/(k₂ − k₁). A queue grows backwards during red, a discharge wave chases it after green, and the queue clears where they meet.",
		Tags:        []string{"LWR", "time–space", "queues"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-shock",
				transSvg("ts", "0 0 640 340", "Time–space diagram of a signalised approach"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Approach (vf 100 km/h, kj 120 veh/km)"),
					field("ka", "Arrival density", "veh/km", 25, 2, 58, 1),
					field("red", "Red time", "s", 60, 15, 120, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--code-del)", "queue front (w₁)"),
					legendSwatch("var(--vec-u)", "discharge (w₂)"),
					legendSwatch("var(--brand)", "clearing (w₃)"),
				),
				readouts([2]string{"w₁", "w1"}, [2]string{"w₂", "w2"}, [2]string{"w₃", "w3"}, [2]string{"max queue", "queue"}, [2]string{"queue clears", "clear"}),
				transNote("States from Greenshields: arrivals A, jam (k = kj, q = 0), discharge at capacity (k = kj/2). Grey lines are individual cars."),
			)
		},
	}
}

// ---------------------------------------------------------------- T4

func transBraessBlock() Block {
	return Block{
		Slug:        "braess",
		Title:       "Braess's paradox",
		Description: "Braess (1968): adding a free road to a congested network can make every driver slower. 4,000 drivers choose between two routes; each has one 45-minute road and one road whose time is T/100 for T drivers. Open the shortcut and the selfish equilibrium gets worse for all.",
		Tags:        []string{"network", "equilibrium", "paradox"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-braess",
				transSvg("net", "0 0 560 320", "Road network from S to E through A and B"),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Network"),
					toggle("trans-braess-link", "shortcut", "Shortcut A → B (0 min)", false),
					field("demand", "Drivers", "", 4000, 500, 6000, 100),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Behaviour"),
					segs("Behaviour", [2]string{"ue", "Selfish (equilibrium)"}, [2]string{"so", "Coordinated (optimum)"}),
				),
				readouts([2]string{"S–A–E", "p1"}, [2]string{"S–B–E", "p2"}, [2]string{"S–A–B–E", "p3"}, [2]string{"trip time", "time"}, [2]string{"without shortcut", "base"}),
				transNote("Equilibrium: no driver can save time by switching route (Wardrop's first principle). Solved in closed form for this symmetric network; below about 3,000 drivers the shortcut genuinely helps."),
			)
		},
	}
}

// ---------------------------------------------------------------- T5

func transEquilibriumBlock() Block {
	return Block{
		Slug:        "route-choice",
		Title:       "Selfish routing vs the optimum",
		Description: "Two parallel roads with BPR travel-time curves t = t₀(1 + 0.15(v/c)⁴). Drivers alone equalise their own times; a planner would equalise marginal costs instead. The gap is the price of anarchy, and the congestion toll that closes it is each driver's delay imposed on others.",
		Tags:        []string{"BPR", "Wardrop", "tolls"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-ue",
				transSvg("t", "0 0 560 320", "Travel time against flow on two roads"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Demand"),
					field("demand", "Peak flow", "veh/h", 5000, 500, 9000, 100),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Roads"),
					field("c1", "Motorway capacity", "veh/h", 4000, 1000, 8000, 100),
					field("c2", "Arterial capacity", "veh/h", 2000, 500, 6000, 100),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "motorway (t₀ 10 min)"),
					legendSwatch("var(--vec-out)", "arterial (t₀ 15 min)"),
				),
				readouts([2]string{"equilibrium split", "ue"}, [2]string{"optimal split", "so"}, [2]string{"veh·h (eq.)", "tue"}, [2]string{"veh·h (opt.)", "tso"}, [2]string{"price of anarchy", "poa"}, [2]string{"motorway toll", "toll"}),
				transNote("BPR: US Bureau of Public Roads (1964) link function. The toll is shown in minutes of time; converting it to money needs a value of time."),
			)
		},
	}
}

// ---------------------------------------------------------------- T6

func transBusBlock() Block {
	return Block{
		Slug:        "bus-bunching",
		Title:       "Bus bunching",
		Description: "A late bus finds more passengers waiting, dwells longer and falls further behind, while the bus behind catches up. Headways spread, and riders who turn up at random wait longer than half the average headway. Holding buses at one stop restores the spacing.",
		Tags:        []string{"headways", "inspection paradox", "control"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-bus",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					transSvg("ring", "0 0 280 280", "Buses on a circular route"),
					transSvg("hw", "0 0 380 280", "Headways over time"),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Route (6 buses, 60-min loop)"),
					field("demand", "Passenger load", "", 0.6, 0, 1.2, 0.05),
					toggle("trans-bus-hold", "hold", "Hold at the control stop", false),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					playPauseLabel("Run"),
					transButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"scheduled", "sched"}, [2]string{"headway spread", "cv"}, [2]string{"mean wait", "wait"}, [2]string{"if regular", "ideal"}),
				transNote("Mean wait for random arrivals = E[H²] / (2·E[H]) = (E[H]/2)(1 + CV²). Dwell time grows with the gap ahead: a stylised model, not calibrated."),
			)
		},
	}
}

// ---------------------------------------------------------------- T7

func transWebsterBlock() Block {
	return Block{
		Slug:        "signal-timing",
		Title:       "Signal timing",
		Description: "Webster's (1958) optimal cycle C₀ = (1.5L + 5)/(1 − Y), from the lost time L and the sum Y of the critical flow ratios (flow ÷ saturation flow) of each phase. Green time is shared in proportion to each phase's ratio; as Y approaches 1 the cycle, and the queues, blow up.",
		Tags:        []string{"Webster", "cycle length", "green split"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("trans-webster", ""),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Critical flow ratios y"),
						field("y1", "Phase 1", "", 0.30, 0, 0.9, 0.01),
						field("y2", "Phase 2", "", 0.25, 0, 0.9, 0.01),
						field("y3", "Phase 3", "", 0.15, 0, 0.9, 0.01),
					),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Lost time"),
						field("lost", "Per phase", "s", 4, 0, 10, 0.5),
					),
				),
				h.Div(h.Data("bar", ""), h.Class("flex h-9 w-full overflow-hidden rounded-md border"), h.Role("img"), h.Aria("label", "One signal cycle split into phases")),
				transSvg("c", "0 0 560 220", "Optimal cycle length against total flow ratio"),
				readouts([2]string{"Y", "Y"}, [2]string{"lost time L", "L"}, [2]string{"cycle C₀", "C"}, [2]string{"greens", "greens"}, [2]string{"status", "status"}),
				transNote("Webster's formula is an approximation, usually clamped to about 30–120 s in practice. Set a phase to 0 to use two phases."),
			)
		},
	}
}

// ---------------------------------------------------------------- T8

func transIsochroneBlock() Block {
	return Block{
		Slug:        "walkability",
		Title:       "The 15-minute city",
		Description: "Walking isochrones on a synthetic street grid with a river and two bridges. Click any junction to start; Dijkstra's algorithm colours every street by walking time and counts the everyday places within 15 minutes. Start on either side of the river to see how much two bridges matter.",
		Tags:        []string{"Dijkstra", "isochrones", "accessibility"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-iso",
				h.Div(h.Class("flex flex-col gap-2"),
					transSvg("map", "0 0 620 450", "Street grid coloured by walking time. Click a junction to start from it."),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-add)", "≤ 5 min"),
						legendSwatch("var(--vec-u)", "≤ 10 min"),
						legendSwatch("var(--vec-out)", "≤ 15 min"),
						legendSwatch("color-mix(in oklab, var(--foreground) 25%, transparent)", "further"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Walking"),
					field("speed", "Speed", "km/h", 5, 2, 7, 0.1),
				),
				readouts([2]string{"start", "start"}, [2]string{"reachable", "reach"}, [2]string{"places within", "places"}, [2]string{"missing", "missing"}),
				transNote("Synthetic town: blocks are 100 m, places are seeded. ≈ 5 km/h is a typical adult walking pace; real isochrones also need crossings, slopes and safety."),
			)
		},
	}
}

// ---------------------------------------------------------------- T9

func transScalingBlock() Block {
	return Block{
		Slug:        "urban-scaling",
		Title:       "Urban scaling",
		Description: "Bettencourt et al. (2007) found that many city quantities follow Y = Y₀·N^β: socioeconomic outputs grow faster than population (β ≈ 1.15), infrastructure slower (β ≈ 0.85), household needs about linearly. Fit β on a log–log plot of synthetic cities.",
		Tags:        []string{"power laws", "log–log", "regression"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("trans-scale",
				transSvg("plot", "0 0 560 340", "Log–log plot of a city quantity against population"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Quantity"),
					segs("Quantity", [2]string{"socio", "Output"}, [2]string{"infra", "Roads"}, [2]string{"basic", "Homes"}),
					field("noise", "Scatter σ", "", 0.15, 0, 0.6, 0.01),
				),
				transButton("reseed", "New cities", hugeicons.ShuffleIcon()),
				readouts([2]string{"true β", "beta"}, [2]string{"fitted β", "fit"}, [2]string{"95% CI", "ci"}, [2]string{"R²", "r2"}, [2]string{"per capita ×2 pop", "double"}),
				transNote("60 synthetic cities, illustrative only. Real exponents vary by country, by how cities are bounded, and by the quantity measured."),
			)
		},
	}
}

// ---------------------------------------------------------------- T10

func transCO2Block() Block {
	return Block{
		Slug:        "commute-co2",
		Title:       "Commute carbon",
		Description: "Daily commuting emissions of a synthetic city of 100,000 commuters from its mode shares, trip length and car occupancy. Factors are typical per passenger-kilometre values, after the UK government's greenhouse-gas conversion factors; they vary by vehicle, fuel and grid.",
		Tags:        []string{"mode share", "emissions", "calculator"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("trans-co2", ""),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mode share (%)"),
						field("car", "Car", "%", 60, 0, 100, 1),
						field("bus", "Bus", "%", 12, 0, 100, 1),
						field("rail", "Rail", "%", 10, 0, 100, 1),
						field("bike", "Bike", "%", 8, 0, 100, 1),
						field("walk", "Walk", "%", 10, 0, 100, 1),
					),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Trips"),
						field("km", "One-way trip", "km", 8, 1, 40, 0.5),
						field("occ", "People per car", "", 1.2, 1, 4, 0.1),
					),
				),
				h.Div(h.Data("bars", ""), h.Class("flex flex-col gap-1.5")),
				readouts([2]string{"shares sum", "sum"}, [2]string{"per day", "day"}, [2]string{"per commuter / year", "year"}, [2]string{"if 20% of car trips switch to bike", "swap"}),
				transNote("Typical factors (kg CO₂e per passenger-km): petrol car ≈ 0.164 per vehicle-km ÷ occupancy, bus ≈ 0.10, rail ≈ 0.035, bike and walk ≈ 0 (operation only). 230 working days, two trips a day."),
			)
		},
	}
}
