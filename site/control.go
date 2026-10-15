package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ControlBlocks lists the control and robotics gallery in display order.
func ControlBlocks() []Block {
	return []Block{
		ctlArmFigureBlock(),
		ctlPIDBlock(),
		ctlCartPoleBlock(),
		ctlBodeBlock(),
		ctlRootLocusBlock(),
		ctlStateSpaceBlock(),
		ctlIKBlock(),
		ctlRRTBlock(),
		ctlKalmanBlock(),
		ctlOdometryBlock(),
	}
}

// ctlButton is an outline action button for these blocks.
func ctlButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ctlSVG is a plot surface with a viewBox and an accessible label.
func ctlSVG(name, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// The transfer functions shared by the Bode and root-locus blocks.
var ctlPlants = [][2]string{{"type1", "K / s(s+1)(s+5)"}, {"triple", "K / (s+1)³"}, {"lead", "K(s+2) / s(s+0.5)(s+10)"}}

// ---------------------------------------------------------------- C1

func ctlArmFigureBlock() Block {
	return Block{
		Slug:        "robot-arm",
		Title:       "Two-joint robot arm",
		Description: "A shoulder and an elbow servo carrying a ball, driven by inverse kinematics: point at the plane of the arm (or use the arrow keys) and the two joint angles that put the ball there are solved on every frame. E switches between the elbow-up and elbow-down solutions; the markers on the ruler and the post track the target.",
		Tags:        []string{"isometric SVG", "anatomy", "inverse kinematics"},
		Wide:        true,
		Render: func() h.Node {
			b, err := static.ReadFile("static/anatomy/control-arm.html")
			if err != nil {
				return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/control-arm/build.mjs to build the figure.")
			}
			return h.Div(h.Class("mx-auto w-full max-w-3xl"),
				h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/control-arm.css")),
				h.UnsafeHTML(string(b)))
		},
	}
}

// ---------------------------------------------------------------- C2

func ctlPIDBlock() Block {
	return Block{
		Slug:        "pid",
		Title:       "PID tuning",
		Description: "A mass on a spring and damper, pushed by a force-limited actuator, asked to step to 1 m. Proportional gain speeds it up, integral removes the steady-state error, derivative damps the overshoot. With the actuator saturated, a plain integrator keeps winding up and overshoots badly; clamping it (anti-windup) stops that.",
		Tags:        []string{"PID", "step response", "windup"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-pid",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "position y"), legendSwatch("var(--brand)", "setpoint"), legendSwatch("var(--vec-u)", "force u (lower plot)")),
					ctlSVG("y", "0 0 560 230", "Position over time"),
					ctlSVG("u", "0 0 560 110", "Actuator force over time"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Gains"),
					field("kp", "Kp", "N/m", 20, 0, 200, 0.5),
					field("ki", "Ki", "N/(m·s)", 10, 0, 200, 0.5),
					field("kd", "Kd", "N·s/m", 5, 0, 60, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Actuator"),
					field("umax", "Force limit", "N", 15, 1, 200, 1),
					toggle("ctl-aw", "antiwindup", "Anti-windup (clamp integrator)", false),
				),
				readouts([2]string{"rise time", "rise"}, [2]string{"overshoot", "os"}, [2]string{"settling (2%)", "settle"}, [2]string{"error at 10 s", "ess"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func ctlCartPoleBlock() Block {
	return Block{
		Slug:        "cart-pole",
		Title:       "Balancing an inverted pendulum",
		Description: "A pendulum standing on a cart, kept upright by a linear-quadratic regulator. The gain comes from the Riccati equation for the linearised model; the simulation is the full nonlinear one. Push the pendulum and watch the cart run under it. Raising the angle weight makes it fight harder for upright; raising R makes force more expensive.",
		Tags:        []string{"LQR", "Riccati", "nonlinear sim"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-cartpole",
				h.Div(h.Class("flex flex-col gap-1"),
					ctlSVG("scene", "0 0 560 220", "Cart and pendulum"),
					ctlSVG("trace", "0 0 560 120", "Pendulum angle over the last 8 seconds"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cost weights"),
					field("qx", "Q position", "", 1, 0.01, 100, 0.01),
					field("qth", "Q angle", "", 50, 0.1, 1000, 0.1),
					field("r", "R force", "", 0.1, 0.001, 10, 0.001),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					ctlButton("push", hugeicons.FlashIcon(), "Push"),
					ctlButton("reset", hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"gain K", "k"}, [2]string{"angle", "th"}, [2]string{"cart x", "x"}, [2]string{"state", "state"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Cart 1 kg, pendulum 0.1 kg at 0.5 m, g = 9.81 m/s², force limit ±20 N."),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func ctlBodeBlock() Block {
	return Block{
		Slug:        "bode",
		Title:       "Bode plot and stability margins",
		Description: "The open-loop frequency response, gain in decibels and phase in degrees on a log frequency axis. The gain margin is how far the gain can rise before the loop goes unstable (read where the phase crosses −180°); the phase margin is how much extra lag it can take (read where the gain crosses 0 dB).",
		Tags:        []string{"frequency response", "margins", "log axes"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-bode",
				h.Div(h.Class("flex flex-col gap-1"),
					ctlSVG("mag", "0 0 560 190", "Magnitude in decibels"),
					ctlSVG("phase", "0 0 560 190", "Phase in degrees"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Open loop L(s)"),
					segs("Plant", ctlPlants...),
					field("k", "Gain K", "", 10, 0.01, 1000, 0.01),
				),
				readouts([2]string{"gain crossover", "wc"}, [2]string{"phase margin", "pm"}, [2]string{"phase crossover", "w180"}, [2]string{"gain margin", "gm"}, [2]string{"closed loop", "stable"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C5

func ctlRootLocusBlock() Block {
	return Block{
		Slug:        "root-locus",
		Title:       "Root locus",
		Description: "Where the closed-loop poles go as the gain rises from 0 to ∞: they start at the open-loop poles (×) and end at the zeros (○) or run off to infinity along asymptotes. Every point comes from the roots of the characteristic polynomial D(s) + K·N(s), found numerically. The loop is stable while every pole is left of the imaginary axis.",
		Tags:        []string{"poles", "characteristic polynomial", "stability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-locus",
				ctlSVG("plane", "0 0 520 400", "Closed-loop poles in the complex plane"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Open loop"),
					segs("Plant", ctlPlants...),
					field("k", "Gain K", "", 10, 0.01, 1000, 0.01),
				),
				readouts([2]string{"poles at K", "poles"}, [2]string{"critical K", "kc"}, [2]string{"closed loop", "stable"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func ctlStateSpaceBlock() Block {
	return Block{
		Slug:        "state-space",
		Title:       "State space and controllability",
		Description: "A two-state linear system ẋ = Ax + Bu. With u = 0 the eigenvalues of A decide the phase portrait: node, saddle, spiral or centre. Whether an input can steer the state anywhere is the rank of the controllability matrix [B AB]: choose B along an eigenvector and it loses rank.",
		Tags:        []string{"eigenvalues", "phase portrait", "controllability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-ss",
				ctlSVG("portrait", "0 0 420 420", "Phase portrait with u = 0", h.Class("mx-auto block w-full max-w-[420px]")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("A"),
					h.Div(h.Class("grid grid-cols-2 gap-x-3 gap-y-2"),
						field("a11", "a₁₁", "", -1, -5, 5, 0.1), field("a12", "a₁₂", "", 2, -5, 5, 0.1),
						field("a21", "a₂₁", "", -2, -5, 5, 0.1), field("a22", "a₂₂", "", -1, -5, 5, 0.1)),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("B"),
					h.Div(h.Class("grid grid-cols-2 gap-x-3"), field("b1", "b₁", "", 0, -5, 5, 0.1), field("b2", "b₂", "", 1, -5, 5, 0.1)),
				),
				readouts([2]string{"eigenvalues", "eig"}, [2]string{"portrait", "kind"}, [2]string{"det [B AB]", "det"}, [2]string{"controllable", "ctrb"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

func ctlIKBlock() Block {
	return Block{
		Slug:        "two-link-ik",
		Title:       "Forward and inverse kinematics",
		Description: "A two-link arm in the plane. Drag the target (or focus it and use the arrow keys): both joint-angle solutions are drawn, elbow up and elbow down, and each is checked by running it forward again. Outside the shaded annulus between |L₁ − L₂| and L₁ + L₂ there is no solution. The same model drives the robot arm figure above.",
		Tags:        []string{"kinematics", "law of cosines", "workspace"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-ik",
				ctlSVG("plane", "-190 -190 380 380", "Two-link arm and its workspace", h.Class("mx-auto block w-full max-w-[460px] touch-none select-none")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Links"),
					field("l1", "L₁", "mm", 90, 10, 120, 1),
					field("l2", "L₂", "mm", 80, 10, 120, 1),
				),
				readouts([2]string{"target", "target"}, [2]string{"elbow up", "up"}, [2]string{"elbow down", "down"}, [2]string{"FK error", "err"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func ctlRRTBlock() Block {
	return Block{
		Slug:        "rrt",
		Title:       "Motion planning with RRT",
		Description: "A rapidly-exploring random tree grows from the start by sampling random points (or the goal, a tenth of the time) and stepping toward each from its nearest node, skipping any step that would cross an obstacle. When a node reaches the goal, the path back up the tree is a solution; shortcutting removes its detours.",
		Tags:        []string{"sampling", "collision checks", "seeded"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-rrt",
				ctlSVG("map", "0 0 520 360", "Obstacles, the tree and the path"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Planner"),
					field("step", "Step size", "", 18, 4, 60, 1),
					field("bias", "Goal bias", "%", 10, 0, 50, 1),
					toggle("ctl-rrt-short", "shortcut", "Shortcut the path", true),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					ctlButton("grow", hugeicons.PlayIcon(), "Grow"),
					ctlButton("reseed", hugeicons.ShuffleIcon(), "New seed")),
				readouts([2]string{"nodes", "nodes"}, [2]string{"iterations", "iters"}, [2]string{"path length", "len"}, [2]string{"straight line", "direct"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C9

func ctlKalmanBlock() Block {
	return Block{
		Slug:        "kalman",
		Title:       "Kalman filter",
		Description: "Tracking a moving cart from noisy position readings with a constant-velocity Kalman filter. Each step predicts, then corrects by a gain that weighs the model's uncertainty against the sensor's. The shaded band is ±2σ of the estimate. Trust the model more (small q) and the estimate gets smooth but slow to follow a change; trust the sensor more and it gets jittery.",
		Tags:        []string{"estimation", "covariance", "seeded noise"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-kalman",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--muted-foreground)", "true position"), legendSwatch("var(--vec-u)", "measurements"), legendSwatch("var(--brand)", "estimate ± 2σ")),
					ctlSVG("track", "0 0 560 260", "Position, measurements and estimate over time"),
					ctlSVG("gain", "0 0 560 90", "Kalman gain over time"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Noise"),
					field("r", "Sensor σ", "m", 2, 0.1, 10, 0.1),
					field("q", "Process q", "", 0.5, 0.001, 20, 0.001),
				),
				ctlButton("reseed", hugeicons.ShuffleIcon(), "New run"),
				readouts([2]string{"RMSE raw", "raw"}, [2]string{"RMSE estimate", "est"}, [2]string{"final gain", "k"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C10

func ctlOdometryBlock() Block {
	return Block{
		Slug:        "odometry",
		Title:       "Differential-drive odometry",
		Description: "A robot with two driven wheels on a 30 cm axle. Its speed is the average of the wheels and its turn rate their difference over the axle, so it always moves on an arc around a point on the wheel axis. Dead reckoning integrates the wheel encoders; add a little slip to one wheel and the estimate drifts away from where the robot really is.",
		Tags:        []string{"kinematics", "dead reckoning", "drift"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ctl-odo",
				ctlSVG("floor", "-200 -150 400 300", "The robot's true path and its odometry estimate", h.Class("mx-auto block w-full max-w-[560px]")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Wheels"),
					field("vl", "Left wheel", "m/s", 0.3, -0.5, 0.5, 0.01),
					field("vr", "Right wheel", "m/s", 0.4, -0.5, 0.5, 0.01),
					field("slip", "Right-wheel slip", "%", 3, 0, 20, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(),
					ctlButton("reset", hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"speed v", "v"}, [2]string{"turn rate ω", "w"}, [2]string{"turn radius", "R"}, [2]string{"odometry error", "err"}),
			)
		},
	}
}
