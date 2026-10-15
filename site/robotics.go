package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// RoboticsBlocks lists the robotics gallery in display order. The two-link
// arm, RRT, the Kalman filter and wheel odometry live in Control; these
// blocks pick up from there.
func RoboticsBlocks() []Block {
	return []Block{
		roboScaraFigureBlock(),
		roboJacobianBlock(),
		roboRedundantBlock(),
		roboDHBlock(),
		roboCSpaceBlock(),
		roboPotentialBlock(),
		roboPursuitBlock(),
		roboOccupancyBlock(),
		roboMCLBlock(),
		roboICPBlock(),
	}
}

// roboButton is an outline action button for these blocks.
func roboButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// roboSVG is a plot surface with a viewBox and an accessible label.
func roboSVG(name, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full touch-none select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

func roboLegend(items ...h.Node) h.Node {
	return h.Div(append([]any{h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pb-1 font-mono text-[11px] text-muted-foreground")}, roboAny(items)...)...)
}

func roboAny(ns []h.Node) []any {
	out := make([]any, len(ns))
	for i, n := range ns {
		out[i] = n
	}
	return out
}

// ---------------------------------------------------------------- R1

func roboScaraFigureBlock() Block {
	return Block{
		Slug:        "scara",
		Title:       "SCARA pick and place",
		Description: "A four-axis SCARA arm moves six pucks from one tray to the other and back. Two horizontal links turn about vertical axes, and a quill at the tip moves up and down. Each target is solved by inverse kinematics, then the move is timed with a quintic profile. In joint mode both joints are interpolated together, so the tool sweeps a curve on the plate. In Cartesian mode the tool runs a straight line, which needs IK at every step. The pink trace on the plate is the path the tool actually took. Press J to switch modes and Space or a click to pause.",
		Tags:        []string{"isometric SVG", "anatomy", "joint vs Cartesian"},
		Wide:        true,
		Render: func() h.Node {
			b, err := static.ReadFile("static/anatomy/robotics-scara.html")
			if err != nil {
				return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/robotics-scara/build.mjs to build the figure.")
			}
			return h.Div(h.Class("mx-auto w-full max-w-3xl"),
				h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/robotics-scara.css")),
				h.UnsafeHTML(string(b)))
		},
	}
}

// ---------------------------------------------------------------- R2

func roboJacobianBlock() Block {
	return Block{
		Slug:        "jacobian",
		Title:       "Jacobian and manipulability",
		Description: "The Jacobian J(q) maps joint speeds to tool speed, ẋ = J q̇. Feed it every joint-speed vector of unit length and the tool's speeds fill an ellipse. Its axes are the singular values of J, and its area follows Yoshikawa's measure w = |det J| = L₁L₂|sin θ₂|. Fold or straighten the elbow and the ellipse flattens into a line: at a singularity, one direction of motion is lost. The force ellipse is the dual: where the arm moves slowly, it pushes hard.",
		Tags:        []string{"Jacobian", "SVD", "singularity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-jac",
				h.Div(h.Class("flex flex-col gap-1"),
					roboLegend(legendSwatch("var(--brand)", "velocity ellipse"), legendSwatch("var(--vec-v)", "force ellipse"), legendSwatch("var(--muted-foreground)", "workspace")),
					roboSVG("plane", "-200 -170 400 340", "Two-link arm with its manipulability ellipse at the tool", h.Class("max-w-[520px]")),
					roboSVG("w", "0 0 400 110", "Manipulability against the elbow angle", h.Class("max-w-[520px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Joints"),
					field("t1", "θ₁", "°", 30, -180, 180, 1),
					field("t2", "θ₂ (elbow)", "°", 70, -179, 179, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Links"),
					field("l1", "L₁", "mm", 90, 20, 120, 1),
					field("l2", "L₂", "mm", 70, 20, 120, 1),
					toggle("robo-jac-force", "force", "Show force ellipse", false),
				),
				readouts([2]string{"J", "J"}, [2]string{"σ₁, σ₂", "sv"}, [2]string{"w = |det J|", "w"}, [2]string{"condition κ", "k"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R3

func roboRedundantBlock() Block {
	return Block{
		Slug:        "resolved-rate",
		Title:       "Redundant arm, resolved-rate IK",
		Description: "Four links and only a 2-D target, so there are infinitely many solutions. Instead of a formula, the arm steps toward the target each frame with q̇ = J⁺ e. Drag the target (or focus it and use the arrow keys). The plain pseudoinverse blows up near a singularity: pull the target out to full reach and watch the joint speeds spike. Damped least squares, J⊤(JJ⊤ + λ²I)⁻¹, trades a little accuracy for bounded speeds. The Jacobian transpose is cheap and never blows up, but it is slow.",
		Tags:        []string{"pseudoinverse", "damped least squares", "redundancy"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-rr",
				h.Div(h.Class("flex flex-col gap-1"),
					roboSVG("plane", "-215 -195 430 390", "Four-link arm reaching for a target", h.Class("max-w-[520px]")),
					roboSVG("speed", "0 0 420 110", "Largest joint speed over time", h.Class("max-w-[520px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Method", [2]string{"dls", "DLS"}, [2]string{"pinv", "J⁺"}, [2]string{"transpose", "Jᵀ"}),
					field("lambda", "Damping λ", "mm", 12, 0.5, 60, 0.5),
					field("gain", "Gain", "/s", 6, 0.5, 20, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), roboButton("reach", hugeicons.Target02Icon(), "Full reach")),
				readouts([2]string{"error", "err"}, [2]string{"max |q̇|", "qd"}, [2]string{"σ_min of J", "smin"}, [2]string{"joints", "q"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R4

func roboDHInput(name string, v, min, max, step float64) h.Node {
	return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
		h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)),
		h.Attr("autocomplete", "off"), h.Aria("label", name),
		h.Class("h-7 w-full min-w-0 cursor-ew-resize rounded-md border border-input bg-background px-1.5 text-right font-mono text-xs tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring"))
}

func roboDHBlock() Block {
	row := func(i int) h.Node {
		n := fmt.Sprint(i)
		return h.Tr(
			h.Td(h.Class("pr-1 font-mono text-xs text-muted-foreground"), n, h.Span(h.Data("dh-type", n), h.Class("ml-1 text-[10px]"), "R")),
			h.Td(h.Class("p-0.5"), roboDHInput("t"+n, 0, -180, 180, 1)),
			h.Td(h.Class("p-0.5"), roboDHInput("d"+n, 0, -120, 120, 1)),
			h.Td(h.Class("p-0.5"), roboDHInput("a"+n, 0, -120, 120, 1)),
			h.Td(h.Class("p-0.5"), roboDHInput("al"+n, 0, -180, 180, 1)),
		)
	}
	return Block{
		Slug:        "dh",
		Title:       "Denavit–Hartenberg chain",
		Description: "Four numbers per joint describe any serial arm. In the standard DH convention each link's transform is Rot_z(θ) · Trans_z(d) · Trans_x(a) · Rot_x(α), and multiplying them gives the tool's pose. Pick a preset or edit the table, and drag the picture to orbit the camera. Each frame is drawn with x in red-pink, y in green and z in blue. The 4 × 4 matrix is the product, ready to copy.",
		Tags:        []string{"DH parameters", "homogeneous transforms", "forward kinematics"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-dh",
				h.Div(h.Class("flex flex-col gap-2"),
					roboLegend(legendSwatch("var(--brand)", "x"), legendSwatch("var(--code-add)", "y"), legendSwatch("var(--vec-u)", "z"), legendSwatch("var(--foreground)", "links")),
					roboSVG("view", "-170 -135 340 250", "The chain's frames in 3-D, drawn from an orbiting camera", h.Class("max-w-[560px] cursor-grab")),
					h.Div(h.Class("relative rounded-lg border bg-background p-3"),
						h.Div(h.Class("absolute top-2 right-2"), h.Span(h.Data("dh-copy", ""), copyButton("", ""))),
						h.Pre(h.Data("dh-matrix", ""), h.Class("overflow-x-auto font-mono text-xs leading-5 tabular-nums"), "—"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Preset"),
					segs("Preset", [2]string{"elbow", "Elbow"}, [2]string{"scara", "SCARA"}, [2]string{"planar", "Planar"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("DH table (mm, °)"),
					h.Table(h.Class("w-full table-fixed text-center"),
						h.Thead(h.Tr(h.Class("font-mono text-[11px] text-muted-foreground"),
							h.Th(h.Class("w-8 text-left font-normal"), "i"), h.Th(h.Class("font-normal"), "θ"), h.Th(h.Class("font-normal"), "d"), h.Th(h.Class("font-normal"), "a"), h.Th(h.Class("font-normal"), "α"))),
						h.Tbody(row(1), row(2), row(3)),
					),
					h.P(h.Class("text-xs text-muted-foreground"), "R: θ is the joint variable. P: d is."),
				),
				readouts([2]string{"tool position", "p"}, [2]string{"tool z axis", "z"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R5

func roboCSpaceBlock() Block {
	return Block{
		Slug:        "configuration-space",
		Title:       "Configuration space",
		Description: "On the left is a two-link arm among round obstacles. On the right is every pose it can take, as a square of (θ₁, θ₂). Each pixel is shaded if that pose would hit something. A small circle in the room becomes a large, strangely shaped blob in C-space. The planner searches the free pixels with A*, wrapping at ±180° because angles do. The arm then follows the path. Click either picture to set the goal, or drag an obstacle.",
		Tags:        []string{"C-space", "collision checking", "A*"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-cs",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Workspace"),
						roboSVG("work", "-170 -170 340 340", "The arm and obstacles; click to set the goal")),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("C-space (θ₁, θ₂)"),
						h.Div(h.Class("relative"),
							h.Canvas(h.Data("cs-canvas", ""), h.Width("180"), h.Height("180"), h.Class("block aspect-square w-full rounded-md border [image-rendering:pixelated]")),
							roboSVG("cspace", "-180 -180 360 360", "Configuration space; shaded poses collide; click to set the goal", h.Class("absolute inset-0 h-full w-full")),
						)),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Arm"),
					field("l1", "L₁", "mm", 80, 30, 110, 1),
					field("l2", "L₂", "mm", 65, 30, 110, 1),
					field("obs", "Obstacles", "", 3, 1, 5, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), roboButton("go", hugeicons.Route01Icon(), "Follow path"), roboButton("reseed", hugeicons.ShuffleIcon(), "New room")),
				readouts([2]string{"free poses", "free"}, [2]string{"path", "path"}, [2]string{"expanded", "exp"}, [2]string{"goal", "goal"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R6

func roboPotentialBlock() Block {
	return Block{
		Slug:        "potential-field",
		Title:       "Potential fields",
		Description: "The goal pulls with a quadratic bowl, U_att = ½ k‖x − x_g‖². Each obstacle pushes inside its range ρ₀ with Khatib's repulsive term, U_rep = ½ η (1/ρ − 1/ρ₀)². The robot just rolls downhill along −∇U. It is fast and local, and it gets stuck: try the U-shaped trap, where the forces cancel short of the goal. Drag the goal or the start.",
		Tags:        []string{"gradient descent", "Khatib 1986", "local minima"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-pf",
				h.Div(h.Class("flex flex-col gap-1"),
					roboLegend(legendSwatch("var(--brand)", "path"), legendSwatch("var(--muted-foreground)", "−∇U")),
					roboSVG("map", "0 0 520 360", "Potential field with obstacles, start, goal and the robot's path", h.Class("max-w-[620px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Room"),
					segs("Room", [2]string{"open", "Open"}, [2]string{"trap", "U-trap"}, [2]string{"gap", "Narrow gap"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Field"),
					field("k", "Attraction k", "", 1, 0.1, 5, 0.1),
					field("eta", "Repulsion η", "×10⁴", 6, 0, 40, 0.5),
					field("rho", "Range ρ₀", "px", 50, 10, 120, 1),
					toggle("robo-pf-arrows", "arrows", "Show the field", true),
				),
				readouts([2]string{"outcome", "out"}, [2]string{"steps", "steps"}, [2]string{"path length", "len"}, [2]string{"final ‖∇U‖", "grad"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R7

func roboPursuitBlock() Block {
	return Block{
		Slug:        "pure-pursuit",
		Title:       "Pure pursuit",
		Description: "A car-like robot follows a path by chasing a point a fixed lookahead distance L_d ahead on it. The arc through that point has curvature κ = 2 sin α / L_d, where α is the bearing to the point. With a short lookahead the robot hugs the path but weaves. With a long one it is smooth but cuts the corners. The steering angle is δ = atan(κ · wheelbase), clipped to the robot's limit.",
		Tags:        []string{"path tracking", "Coulter 1992", "bicycle model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-pp",
				h.Div(h.Class("flex flex-col gap-1"),
					roboLegend(legendSwatch("var(--muted-foreground)", "path"), legendSwatch("var(--brand)", "robot"), legendSwatch("var(--vec-u)", "lookahead arc")),
					roboSVG("map", "0 0 560 340", "The reference path, the robot's track and its lookahead point", h.Class("max-w-[640px]")),
					roboSVG("err", "0 0 560 90", "Cross-track error over time", h.Class("max-w-[640px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Path"),
					segs("Path", [2]string{"s", "S-curve"}, [2]string{"square", "Square"}, [2]string{"lane", "Lane change"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Controller"),
					field("ld", "Lookahead L_d", "px", 40, 8, 120, 1),
					field("v", "Speed", "px/s", 80, 20, 200, 5),
					field("dmax", "Max steer", "°", 35, 10, 60, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), roboButton("reset", hugeicons.RefreshIcon(), "Restart")),
				readouts([2]string{"cross-track", "cte"}, [2]string{"RMS error", "rms"}, [2]string{"steer δ", "steer"}, [2]string{"curvature κ", "kappa"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R8

func roboOccupancyBlock() Block {
	return Block{
		Slug:        "occupancy-grid",
		Title:       "Occupancy grid mapping",
		Description: "A robot with a 2-D lidar drives a loop through a room it has never seen. For each beam, the cells it passes through become more likely free, and the cell where it stops becomes more likely occupied. Each update adds to the cell's log-odds, l = log(p / (1 − p)), so evidence simply adds up. The poses are known exactly here: that is mapping, not SLAM. Add range noise and the walls blur. Lower the hit probability and the map takes longer to firm up.",
		Tags:        []string{"log-odds", "inverse sensor model", "Bresenham"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-og",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("World and scan"),
						roboSVG("world", "0 0 300 220", "The true room, the robot and its lidar beams")),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Map: P(occupied)"),
						h.Canvas(h.Data("og-canvas", ""), h.Width("60"), h.Height("44"), h.Class("block w-full rounded-md border [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", "The occupancy grid as it is built: dark is occupied, light is free, grey unknown"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sensor model"),
					field("phit", "P(occ | hit)", "", 0.7, 0.51, 0.99, 0.01),
					field("pfree", "P(occ | pass)", "", 0.4, 0.01, 0.49, 0.01),
					field("noise", "Range σ", "cells", 0.3, 0, 3, 0.1),
					field("beams", "Beams", "", 60, 8, 180, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), roboButton("reset", hugeicons.RefreshIcon(), "Clear map")),
				readouts([2]string{"scans", "scans"}, [2]string{"cells seen", "seen"}, [2]string{"agreement", "acc"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R9

func roboMCLBlock() Block {
	return Block{
		Slug:        "particle-filter",
		Title:       "Monte Carlo localization",
		Description: "A robot in a corridor with three doors knows its map but not where it is. It holds a cloud of guesses, called particles. Each step moves every particle by the odometry plus noise, then weights each one by how well it explains the sensor (door or wall). It then resamples in proportion to those weights. At first the cloud is spread evenly. After the first door it splits into three bumps, one per door. As the robot drives on, only one bump keeps matching. Turn the sensor accuracy down and the robot can believe the wrong door.",
		Tags:        []string{"Bayes filter", "low-variance resampling", "multimodal"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-mcl",
				h.Div(h.Class("flex flex-col gap-1"),
					roboLegend(legendSwatch("var(--brand)", "true robot"), legendSwatch("var(--vec-u)", "particles"), legendSwatch("var(--muted-foreground)", "belief")),
					roboSVG("corridor", "0 0 560 230", "Corridor with doors, the robot and the particle cloud", h.Class("max-w-[640px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Filter"),
					field("n", "Particles", "", 300, 20, 2000, 10),
					field("acc", "Sensor accuracy", "%", 85, 50, 99, 1),
					field("mnoise", "Motion σ", "px", 4, 0, 20, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					roboButton("step", hugeicons.NextIcon(), "Step"),
					playPause(),
					h.Div(h.Class("col-span-2"), roboButton("reset", hugeicons.ShuffleIcon(), "Kidnap robot")),
				),
				readouts([2]string{"sensor says", "z"}, [2]string{"estimate", "est"}, [2]string{"error", "err"}, [2]string{"N_eff", "neff"}),
			)
		},
	}
}

// ---------------------------------------------------------------- R10

func roboICPBlock() Block {
	return Block{
		Slug:        "icp",
		Title:       "Scan matching with ICP",
		Description: "A new lidar scan of a mapped room, taken from an unknown pose, against the denser reference. Iterative closest point pairs each new point with its nearest point in the reference. It then solves in closed form for the rotation and translation that best align the pairs, using the SVD of their cross-covariance (Besl & McKay 1992; Arun et al. 1987). It repeats until nothing moves. Start close and it snaps into place. Start too far, and wrong pairings pull it into a local minimum.",
		Tags:        []string{"ICP", "SVD", "local minima"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("robo-icp",
				h.Div(h.Class("flex flex-col gap-1"),
					roboLegend(legendSwatch("var(--muted-foreground)", "reference scan"), legendSwatch("var(--brand)", "new scan"), legendSwatch("var(--vec-u)", "pairs")),
					roboSVG("map", "-230 -175 460 350", "Reference scan, moving scan and the closest-point pairs", h.Class("max-w-[600px]")),
					roboSVG("err", "0 0 400 90", "Mean pair distance per iteration", h.Class("max-w-[600px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Initial offset"),
					field("rot", "Rotation", "°", 18, -90, 90, 1),
					field("dx", "Shift x", "px", 30, -100, 100, 1),
					field("dy", "Shift y", "px", -20, -100, 100, 1),
					field("noise", "Noise σ", "px", 1, 0, 8, 0.1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					roboButton("step", hugeicons.NextIcon(), "Iterate"),
					roboButton("run", hugeicons.PlayIcon(), "Converge"),
					h.Div(h.Class("col-span-2"), roboButton("reset", hugeicons.RefreshIcon(), "Reset")),
				),
				readouts([2]string{"iteration", "it"}, [2]string{"mean distance", "err"}, [2]string{"recovered", "pose"}, [2]string{"true offset", "truth"}),
			)
		},
	}
}
