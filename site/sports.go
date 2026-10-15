package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	h "github.com/alexisbcz/libhtml"
)

// SportsBlocks lists the sports science gallery in display order.
func SportsBlocks() []Block {
	return []Block{
		sportBallBlock(),
		sportThrowBlock(),
		sportSprintBlock(),
		sportCyclingBlock(),
		sportVO2Block(),
		sportHeartBlock(),
		sportEnergyBlock(),
		sportLeverBlock(),
		sportJumpBlock(),
		sportEloBlock(),
	}
}

// sportPresets is a row of outline buttons carrying data-preset values.
func sportPresets(opts ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1.5"),
		h.Map(opts, func(o [2]string) h.Node {
			return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", o[0]), o[1])
		}),
	)
}

func sportSvg(label, viewBox string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", label))
}

func sportNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- S1

func sportBallBlock() Block {
	return Block{
		Slug:        "ball-flight",
		Title:       "Ball flight with spin",
		Description: "Why a free kick dips and a topspin forehand drops in: drag slows the ball and the Magnus force, perpendicular to its velocity, lifts it with backspin and pushes it down with topspin. Integrated with RK4 in the vertical plane, drawn beside the same shot without spin.",
		Tags:        []string{"Magnus", "drag", "RK4"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-ball",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "with spin"),
						legendSwatch("var(--vec-u)", "same shot, no spin"),
						legendSwatch("var(--foreground)", "vacuum (no air)"),
					),
					sportSvg("Ball trajectories with and without spin", "0 0 640 320"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ball"),
					sportPresets([2]string{"football", "Free kick"}, [2]string{"tennis", "Tennis"}, [2]string{"baseball", "Baseball"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Shot"),
					field("v", "Speed", "m/s", 25, 5, 50, 0.5),
					field("angle", "Angle", "°", 16, -10, 60, 0.5),
					field("h0", "Height", "m", 0.11, 0, 3, 0.01),
					field("rpm", "Spin", "rpm", 600, -3000, 3000, 10),
				),
				sportNote("Positive spin is backspin (lift), negative is topspin (dip). Cd and the lift curve CL = 1/(2 + v/(rω)) are a common empirical fit, labelled approximate."),
				readouts([2]string{"range", "range"}, [2]string{"apex", "apex"}, [2]string{"flight time", "time"},
					[2]string{"spin ratio rω/v", "s"}, [2]string{"vs no spin", "diff"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func sportThrowBlock() Block {
	return Block{
		Slug:        "release-angle",
		Title:       "Best release angle",
		Description: "The 45° rule only holds when you land at the height you launch from. A shot put leaves the hand about 2 m up, so the best angle is lower, and the closed form says how much. In the long jump, takeoff speed falls as you push the angle up, so the best angle is lower still.",
		Tags:        []string{"closed form", "shot put", "long jump"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-throw",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("path", ""), h.ViewBox("0 0 400 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Trajectory at the chosen angle and at the best angle")),
					h.Svg(h.Data("range", ""), h.ViewBox("0 0 260 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Range against release angle")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Event"),
					segs("Event", [2]string{"shot", "Shot put"}, [2]string{"jump", "Long jump"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Release"),
					field("v", "Speed", "m/s", 13.5, 3, 20, 0.1),
					field("angle", "Angle", "°", 40, 5, 80, 0.5),
					field("h", "Height", "m", 2.1, 0, 3, 0.05),
					field("loss", "Speed loss", "m/s per °", 0.12, 0, 0.3, 0.01),
				),
				sportNote("No air resistance. For the long jump, takeoff speed is modelled as v − loss·θ (a simplified, labelled assumption), and the jumper is treated as a point."),
				readouts([2]string{"range", "range"}, [2]string{"best angle", "best"}, [2]string{"best range", "bestRange"}, [2]string{"takeoff speed", "vt"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func sportSprintBlock() Block {
	return Block{
		Slug:        "sprint",
		Title:       "100 m sprint model",
		Description: "A sprinter's speed rises toward a top speed as v(t) = vmax(1 − e^(−t/τ)), so distance is vmax(t − τ(1 − e^(−t/τ))). Two numbers give the whole race: the 10 m splits, the time to 100 m, and how much of it is acceleration.",
		Tags:        []string{"exponential", "splits", "synthetic"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-sprint",
				h.Div(h.Class("flex flex-col gap-3"),
					sportSvg("Speed against time over 100 m", "0 0 640 260"),
					h.Div(h.Class("scroll-thin overflow-x-auto"), h.Div(h.Data("splits", ""), h.Class("grid min-w-[560px] grid-cols-10 gap-1 font-mono text-[11px]"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Athlete"),
					field("vmax", "Top speed", "m/s", 11.8, 6, 13, 0.05),
					field("tau", "τ", "s", 1.3, 0.4, 3, 0.05),
					field("react", "Reaction", "s", 0.15, 0, 0.4, 0.01),
				),
				sportNote("A synthetic model with no deceleration at the end of the race. Real sprinters slow slightly over the last 20–30 m."),
				readouts([2]string{"100 m time", "time"}, [2]string{"95% of top speed", "t95"}, [2]string{"distance by then", "d95"}, [2]string{"mean speed", "mean"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func sportCyclingBlock() Block {
	return Block{
		Slug:        "cycling-power",
		Title:       "Cycling power and speed",
		Description: "P = ½ρCdA·v³ + Crr·m·g·v + m·g·v·sin θ. On the flat, air resistance grows with the cube of speed and dominates above 20 km/h; uphill, gravity takes over. The block solves the equation for the speed your power buys.",
		Tags:        []string{"aerodynamics", "solver", "drafting"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-cycle",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "air"), legendSwatch("var(--vec-out)", "rolling"), legendSwatch("var(--ion-cl)", "climbing"), legendSwatch("var(--foreground)", "total"),
					),
					sportSvg("Power needed against speed", "0 0 640 300"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rider"),
					field("power", "Power", "W", 250, 50, 600, 5),
					field("mass", "Mass", "kg", 80, 40, 130, 1),
					field("grade", "Grade", "%", 0, -8, 15, 0.5),
					field("cda", "CdA", "m²", 0.32, 0.18, 0.6, 0.01),
				),
				sportPresets([2]string{"0.40", "Hoods"}, [2]string{"0.32", "Drops"}, [2]string{"0.25", "Time trial"}),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("sport-draft", "draft", "Drafting (≈ −30% CdA)", false)),
				sportNote("ρ = 1.2 kg/m³, Crr = 0.004 (good road tyres), drivetrain losses ignored. Presets and the drafting saving are typical values, not measurements."),
				readouts([2]string{"speed", "speed"}, [2]string{"air share", "air"}, [2]string{"W/kg", "wkg"}, [2]string{"40 km takes", "t40"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func sportVO2Block() Block {
	return Block{
		Slug:        "running-vo2",
		Title:       "Running oxygen cost",
		Description: "The ACSM running equation estimates oxygen uptake from speed and grade: VO₂ = 0.2·v + 0.9·v·grade + 3.5 ml/kg/min, with v in m/min. From there, METs and an energy estimate at ≈ 5 kcal per litre of oxygen.",
		Tags:        []string{"ACSM", "metabolic", "estimate"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-vo2",
				sportSvg("Oxygen uptake against running speed for several grades", "0 0 640 300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Run"),
					field("speed", "Speed", "km/h", 10, 8, 22, 0.1),
					field("grade", "Grade", "%", 0, 0, 15, 0.5),
					field("mass", "Mass", "kg", 70, 35, 130, 1),
				),
				sportNote("ACSM's Guidelines for Exercise Testing and Prescription. The equation is meant for speeds above about 8 km/h; it is a population estimate, not a measurement."),
				readouts([2]string{"VO₂", "vo2"}, [2]string{"METs", "mets"}, [2]string{"VO₂ (L/min)", "lmin"}, [2]string{"energy", "kcal"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

func sportHeartBlock() Block {
	return Block{
		Slug:        "heart-zones",
		Title:       "Heart-rate zones",
		Description: "The Karvonen method places zones inside heart-rate reserve, the gap between resting and maximum heart rate. Maximum is estimated from age, and the estimate is rough: individuals vary by about ±10–12 beats per minute.",
		Tags:        []string{"Karvonen", "estimate", "zones"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-5"), h.Data("sport-heart", ""),
				h.Div(h.Class("grid gap-4 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"),
						field("age", "Age", "years", 35, 10, 90, 1),
						field("rest", "Resting HR", "bpm", 60, 35, 100, 1),
					),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Maximum estimate"),
						segs("Formula", [2]string{"tanaka", "Tanaka 208 − 0.7·age"}, [2]string{"fox", "220 − age"}),
						h.P(h.Data("out", "max"), h.Class("font-mono text-sm"), "—"),
					),
				),
				h.Div(h.Data("zones", ""), h.Class("flex flex-col gap-1.5")),
				sportNote("Tanaka, Monahan & Seals (2001) for 208 − 0.7·age. Population averages only; not training or medical advice."),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func sportEnergyBlock() Block {
	return Block{
		Slug:        "energy-systems",
		Title:       "Energy systems",
		Description: "Muscle makes ATP three ways: the phosphocreatine store for the first seconds, glycolysis for the next minute or two, and aerobic metabolism beyond. All three run at once; what changes with duration is the share. Aerobic supply passes half at roughly 75 s of maximal effort.",
		Tags:        []string{"schematic", "log time", "ATP"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-energy",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--ion-na)", "ATP-PC"), legendSwatch("var(--vec-out)", "glycolytic"), legendSwatch("var(--vec-u)", "aerobic"),
					),
					sportSvg("Share of energy supply against maximal effort duration", "0 0 640 280"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Effort"),
					field("t", "Duration", "s", 30, 1, 7200, 1),
				),
				sportPresets([2]string{"10", "100 m"}, [2]string{"45", "400 m"}, [2]string{"110", "800 m"}, [2]string{"220", "1500 m"}, [2]string{"7200", "Marathon"}),
				sportNote("Schematic curves shaped after Gastin (2001), with the aerobic crossover near 75 s. Shares are illustrative, not measurements."),
				readouts([2]string{"ATP-PC", "pc"}, [2]string{"glycolytic", "gly"}, [2]string{"aerobic", "aer"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func sportLeverBlock() Block {
	return Block{
		Slug:        "levers",
		Title:       "Levers in the body",
		Description: "Most joints are third-class levers: the muscle attaches close to the joint, so it pulls far harder than the load it lifts, in exchange for speed and range. The biceps curl shows the cost; three cards show the three lever classes.",
		Tags:        []string{"torque", "moments", "biomechanics"},
		Wide:        true,
		Render: func() h.Node {
			lever := func(class, name, example, note string) h.Node {
				return h.Div(h.Class("flex flex-col gap-1 rounded-lg border p-3"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), class),
					h.Span(h.Class("text-sm font-medium"), name),
					h.Span(h.Class("text-xs text-muted-foreground"), example),
					h.Span(h.Class("text-xs text-muted-foreground"), note),
				)
			}
			return plotPanel("sport-lever",
				h.Div(h.Class("flex flex-col gap-3"),
					sportSvg("Forearm as a lever with the biceps force and the load", "0 0 640 260"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-3"),
						lever("First class", "Fulcrum in the middle", "Nodding: the head pivots on the atlas, neck muscles behind.", "Like a seesaw."),
						lever("Second class", "Load in the middle", "Rising on the toes: pivot at the ball of the foot, calf pulls on the heel.", "Mechanical advantage above 1."),
						lever("Third class", "Effort in the middle", "Biceps curl: elbow pivot, biceps insertion, load in the hand.", "Mechanical advantage below 1, but fast."),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Curl"),
					field("load", "Load", "kg", 10, 0, 40, 0.5),
					field("arm", "Hand distance", "cm", 35, 25, 45, 0.5),
					field("ins", "Insertion", "cm", 4, 2, 7, 0.1),
					field("angle", "Elbow angle", "°", 90, 30, 160, 1),
				),
				sportNote("Upper arm vertical; the biceps pulls along the line from its insertion to the shoulder (≈ 30 cm above the elbow), and the forearm (≈ 1.5 kg at ≈ 15 cm) is included. A teaching model."),
				readouts([2]string{"biceps force", "force"}, [2]string{"× load weight", "ratio"}, [2]string{"mechanical adv.", "ma"}, [2]string{"elbow torque", "torque"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func sportJumpBlock() Block {
	return Block{
		Slug:        "jumps-bounces",
		Title:       "Jumps and bounces",
		Description: "Two measurements with one stopwatch. A jump's flight time gives its height, h = g·t²/8, since the jumper rises for half the flight. A ball's rebound height gives its coefficient of restitution, e = √(h₂/h₁), and from it every later bounce.",
		Tags:        []string{"kinematics", "restitution", "measurement"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sport-jump",
				h.Div(h.Class("flex flex-col gap-2"),
					segs("Mode", [2]string{"jump", "Jump"}, [2]string{"bounce", "Bounce"}),
					sportSvg("Height against time", "0 0 640 260"),
				),
				h.Div(h.Data("mode", "jump"), h.Class("flex flex-col gap-2"), panelLabel("Jump"),
					field("flight", "Flight time", "s", 0.5, 0.1, 1.2, 0.01),
				),
				h.Div(h.Data("mode", "bounce"), h.Hidden(), h.Class("flex flex-col gap-2"), panelLabel("Ball"),
					field("h1", "Drop height", "cm", 254, 20, 400, 1),
					field("h2", "Rebound", "cm", 141, 1, 400, 1),
					sportPresets([2]string{"254:141", "Tennis"}, [2]string{"180:130", "Basketball"}, [2]string{"100:60", "Golf"}, [2]string{"100:85", "Superball"}),
				),
				sportNote("Tennis: ITF rules ask for a rebound of 135–147 cm from 254 cm. The other presets are typical values. No air resistance."),
				// Readouts whose labels follow the mode (sports.js sets them).
				h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
					h.Map([][2]string{{"jump height", "main"}, {"takeoff speed", "second"}, {"time in the air", "third"}}, func(r [2]string) h.Node {
						return h.Group(h.Dt(h.Class("text-muted-foreground"), h.Span(h.Data("lbl", map[string]string{"main": "0", "second": "1", "third": "2"}[r[1]]), r[0])),
							h.Dd(h.Data("out", r[1]), h.Class("tabular-nums"), "—"))
					}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func sportEloBlock() Block {
	return Block{
		Slug:        "elo",
		Title:       "Elo ratings",
		Description: "Elo turns results into ratings. Each player's expected score is 1/(1 + 10^((Rb − Ra)/400)); after a game the rating moves by K times the surprise, the result minus the expectation. Upsets move ratings most.",
		Tags:        []string{"rating", "probability", "statistics"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-5"), h.Data("sport-elo", ""),
				h.Div(h.Class("grid gap-4 sm:grid-cols-3"),
					field("ra", "Player A", "", 1500, 100, 3000, 1),
					field("rb", "Player B", "", 1500, 100, 3000, 1),
					field("k", "K-factor", "", 32, 1, 64, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Result for A"),
					segs("Result", [2]string{"1", "A wins"}, [2]string{"0.5", "Draw"}, [2]string{"0", "B wins"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-3"),
					h.Div(h.Class("flex flex-col gap-1 rounded-lg border p-3"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Player A"),
						h.Span(h.Data("out", "expA"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
						h.Span(h.Data("out", "newA"), h.Class("font-mono text-2xl tabular-nums"), "—"),
					),
					h.Div(h.Class("flex flex-col gap-1 rounded-lg border p-3"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Player B"),
						h.Span(h.Data("out", "expB"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
						h.Span(h.Data("out", "newB"), h.Class("font-mono text-2xl tabular-nums"), "—"),
					),
				),
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Expected score against rating difference")),
				sportNote(fmt.Sprintf("Arpad Elo's system, used in chess; K = %d is a common choice for newer players. Points gained by one player equal points lost by the other.", 32)),
			)
		},
	}
}
