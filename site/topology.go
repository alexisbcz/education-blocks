package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// TopologyBlocks lists the topology gallery in display order. Every count
// (vertices, crossings, zeros, bars) is computed in topology.js from the
// object on screen, never typed in.
func TopologyBlocks() []Block {
	return []Block{
		topoLettersBlock(),
		topoEulerBlock(),
		topoGluingBlock(),
		topoMobiusBlock(),
		topoKnotsBlock(),
		topoHairyBlock(),
		topoBorsukBlock(),
		topoOpenBlock(),
		topoBrouwerBlock(),
		topoPersistenceBlock(),
	}
}

func topoButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func topoNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-pretty text-muted-foreground"), s)
}

// topoCanvas is a square canvas for the drawings projected from 3D.
func topoCanvas(label string) h.Node {
	return h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[520px]"),
		h.Canvas(h.Data("canvas", ""), h.TabIndex(0), h.Role("img"), h.Aria("label", label),
			h.Class("absolute inset-0 size-full cursor-grab touch-none rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing")))
}

// ---------------------------------------------------------------- T1

func topoLettersBlock() Block {
	return Block{
		Slug:        "letters",
		Title:       "Homeomorphic letters",
		Description: "Treat each capital as a thin wire you may bend and stretch but not cut or glue. Two letters are the same shape to a topologist when one can be deformed into the other. Ends, branch points and holes cannot change under such a deformation, so they sort the alphabet into classes. Here each class is decided by comparing the letters' reduced graphs, not by a list.",
		Tags:        []string{"homeomorphism", "invariants", "graphs"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-letters",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 720 330"), h.Class("block w-full select-none"), h.Role("group"), h.Aria("label", "The alphabet as wire skeletons; choose a letter to see its class")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Arrange"),
					segs("Arrange", [2]string{"alphabet", "Alphabet"}, [2]string{"classes", "By class"})),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("topo-skel", "skeleton", "Show ends and branch points", true)),
				readouts([2]string{"letter", "letter"}, [2]string{"ends", "ends"}, [2]string{"branch points", "branch"}, [2]string{"holes", "holes"}, [2]string{"same as", "class"}, [2]string{"classes", "count"}),
				topoNote("Letters are drawn in one sans-serif skeleton. Typefaces disagree: a K whose arms meet the stem at a single point, or a Q whose tail crosses the bowl, lands in a different class."),
			)
		},
	}
}

// ---------------------------------------------------------------- T2

func topoEulerBlock() Block {
	return Block{
		Slug:        "euler-characteristic",
		Title:       "Euler characteristic",
		Description: "Count the vertices, edges and faces of any mesh on a surface: V − E + F is the same however finely you cut it, so it belongs to the surface, not the mesh. It is 2 for a sphere, 0 for a torus, 2 − 2g with g handles, and drops by one for every hole you punch. The counts, the boundary loops and whether the surface can be consistently oriented are all computed from the mesh.",
		Tags:        []string{"V − E + F", "invariant", "orientability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-euler",
				topoCanvas("A mesh on the chosen surface; drag or use the arrow keys to turn it"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Surface"),
					segs("Surface", [2]string{"sphere", "Sphere"}, [2]string{"torus", "Torus"}, [2]string{"tube", "Tube"}, [2]string{"mobius", "Möbius band"})),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mesh"),
					field("n", "Resolution", "", 1, 1, 8, 1),
					toggle("topo-tri", "tri", "Split into triangles", false)),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					topoButton("hole", hugeicons.ScissorIcon(), "Punch a hole"),
					topoButton("reset", hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"V − E + F", "vef"}, [2]string{"χ", "chi"}, [2]string{"boundary loops", "b"}, [2]string{"orientable", "orient"}, [2]string{"surface", "name"}),
			)
		},
	}
}

// ---------------------------------------------------------------- T3

func topoGluingBlock() Block {
	return Block{
		Slug:        "gluing",
		Title:       "Gluing a square",
		Description: "Glue the edges of a square that carry the same letter, matching the arrows, and you get a closed surface: the edge word decides which one. A walker who leaves through one edge comes back through its partner. On the torus it keeps its handedness; on the Klein bottle and the projective plane some crossings return it mirrored, which is what non-orientable means.",
		Tags:        []string{"edge words", "Klein bottle", "orientation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-gluing",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 400 400"), h.TabIndex(0), h.Class("mx-auto block aspect-square w-full max-w-[460px] rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50"),
					h.Role("img"), h.Aria("label", "Square with glued edges and a walker; left and right arrow keys steer")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Edge word"),
					segs("Surface", [2]string{"torus", "a b a⁻¹ b⁻¹"}, [2]string{"klein", "a b a b⁻¹"}, [2]string{"rp2", "a b a b"}, [2]string{"sphere", "a b b⁻¹ a⁻¹"})),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), topoButton("clear", hugeicons.EraserIcon(), "Clear trail")),
				readouts([2]string{"surface", "name"}, [2]string{"V, E, F", "vef"}, [2]string{"χ", "chi"}, [2]string{"orientable", "orient"}, [2]string{"walker", "hand"}, [2]string{"crossings", "cross"}),
				topoNote("Focus the square and steer with ← and →. The walker turns towards its own left flag, so once mirrored, ← turns it the other way on screen. Corners of the same colour are glued into one point."),
			)
		},
	}
}

// ---------------------------------------------------------------- T4

func topoMobiusBlock() Block {
	return Block{
		Slug:        "mobius",
		Title:       "Möbius strip and its cuts",
		Description: "Give a band half-twists before joining the ends. With an odd number it has one side and one edge: an ant walking down the middle comes back on the other face, and only after two laps returns home. Then cut it. Down the middle, one half-twist gives a single band twice as long; at a third of the width it gives two bands, linked. Pieces and linking numbers are computed from the cut curves (Gauss's linking integral).",
		Tags:        []string{"one-sided", "cutting", "linking number"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-mobius",
				topoCanvas("The twisted band and its pieces; drag or use the arrow keys to turn it"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Half-twists"),
					segs("Half-twists", [2]string{"1", "1"}, [2]string{"0", "0"}, [2]string{"2", "2"}, [2]string{"3", "3"})),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cut"),
					h.Div(h.Data("cuts", ""), h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Cut"),
						segButton("none", "None", true), segButton("half", "Middle", false), segButton("third", "One third", false))),
				h.Div(h.Class("grid grid-cols-2 gap-2"), topoButton("ant", hugeicons.PlayIcon(), "Send the ant"), topoButton("reset", hugeicons.RefreshIcon(), "Clear")),
				readouts([2]string{"sides", "sides"}, [2]string{"edges", "edges"}, [2]string{"pieces", "pieces"}, [2]string{"each piece", "each"}, [2]string{"linked", "link"}, [2]string{"ant", "ant"}),
			)
		},
	}
}

// ---------------------------------------------------------------- T5

func topoKnotsBlock() Block {
	return Block{
		Slug:        "knots",
		Title:       "Knots and three colours",
		Description: "Is a tangle really knotted? Colour the arcs of the diagram with three colours so that at every crossing the three strands are all the same colour or all different, using at least two colours. This tricolourability survives the Reidemeister moves, so it is a knot invariant: the trefoil has such a colouring and the unknot does not, which proves the trefoil cannot be untied. The figure-eight knot has none either, yet it is knotted: one invariant does not settle everything.",
		Tags:        []string{"Reidemeister", "invariant", "colouring"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-knots",
				h.Svg(h.Data("plot", ""), h.ViewBox("-3.4 -3.4 6.8 6.8"), h.Class("mx-auto block aspect-square w-full max-w-[480px] select-none"), h.Role("group"), h.Aria("label", "Knot diagram; click an arc to paint it")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Knot"),
					segs("Knot", [2]string{"trefoil", "Trefoil"}, [2]string{"unknot", "Unknot"}, [2]string{"eight", "Figure-eight"}, [2]string{"cinque", "Cinquefoil"})),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Brush"),
					h.Div(h.Data("brush", ""), h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Brush colour"),
						h.Map([][3]string{{"0", "var(--vec-u)", "First"}, {"1", "var(--vec-v)", "Second"}, {"2", "var(--brand)", "Third"}}, func(c [3]string) h.Node {
							return h.Button(h.Type("button"), h.Role("tab"), h.Data("seg", c[0]), h.Aria("selected", h.Ternary(c[0] == "0", "true", "false")), h.Aria("label", c[2]+" colour"),
								h.Class("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-accent aria-selected:text-foreground"),
								h.Span(h.Class("size-2.5 rounded-full"), h.Style("background:"+c[1])), c[2])
						}))),
				h.Div(h.Class("grid grid-cols-2 gap-2"), topoButton("solve", hugeicons.MagicWand01Icon(), "Find one"), topoButton("clear", hugeicons.EraserIcon(), "Clear")),
				readouts([2]string{"crossings", "cross"}, [2]string{"arcs", "arcs"}, [2]string{"crossings ok", "ok"}, [2]string{"colours used", "used"}, [2]string{"valid colourings", "count"}, [2]string{"verdict", "verdict"}),
				topoNote("Crossings are found from a 3D curve projected to the page; the strand that passes under is broken. “Valid colourings” counts every assignment that satisfies the crossing rule, the three one-colour ones included."),
			)
		},
	}
}

// ---------------------------------------------------------------- T6

func topoHairyBlock() Block {
	return Block{
		Slug:        "hairy-ball",
		Title:       "Hairy ball theorem",
		Description: "You cannot comb a hairy ball flat: every continuous tangent field on a sphere vanishes somewhere. The Poincaré–Hopf theorem says more. Give each zero an index, the number of turns the field makes on a small loop around it; the indices always add up to the Euler characteristic, 2 for the sphere. Here the zeros are found on a grid and their indices measured numerically, whatever field you choose.",
		Tags:        []string{"vector fields", "Poincaré–Hopf", "index"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-hairy",
				topoCanvas("A tangent vector field on a sphere with its zeros marked; drag or use the arrow keys to turn it"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Field"),
					segs("Field", [2]string{"mix", "Swirl and flow"}, [2]string{"one", "One zero"}),
					h.Div(h.Data("view", "mix"), h.Class("flex flex-col gap-2"),
						field("phi", "Swirl ↔ flow", "°", 30, 0, 90, 1),
						field("tilt", "Axis tilt", "°", 35, 0, 90, 1)),
				),
				readouts([2]string{"zeros", "zeros"}, [2]string{"indices", "idx"}, [2]string{"sum", "sum"}, [2]string{"χ(sphere)", "chi"}),
				topoNote("“One zero” carries a constant flow on the plane onto the sphere by stereographic projection: all the turning piles up at the north pole, a single zero of index 2. On a torus, where χ = 0, a field with no zeros exists."),
			)
		},
	}
}

// ---------------------------------------------------------------- T7

func topoBorsukBlock() Block {
	return Block{
		Slug:        "borsuk-ulam",
		Title:       "Borsuk–Ulam on a ring",
		Description: "Around any circle, such as the equator, there are always two opposite points with exactly the same temperature. Let g(θ) = T(θ) − T(θ + π). Going halfway round turns g into −g, so g changes sign and must cross zero somewhere in between. In two dimensions the same theorem gives two antipodes on Earth with equal temperature and equal pressure.",
		Tags:        []string{"antipodes", "intermediate value", "odd function"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-borsuk",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 720 320"), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", "Temperature around a ring and the difference between antipodes")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Probe"),
					field("theta", "θ", "°", 40, 0, 360, 1)),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					topoButton("find", hugeicons.Target01Icon(), "Find a pair"),
					topoButton("new", hugeicons.DiceIcon(), "New weather")),
				readouts([2]string{"T(θ)", "t"}, [2]string{"T(θ + π)", "ta"}, [2]string{"g(θ)", "g"}, [2]string{"g(θ + π)", "ga"}, [2]string{"equal pairs", "pairs"}),
				topoNote("Synthetic temperatures: a sum of four random harmonics. Pairs are counted on θ in [0°, 180°), since each pair appears twice going round."),
			)
		},
	}
}

// ---------------------------------------------------------------- T8

func topoOpenBlock() Block {
	return Block{
		Slug:        "open-sets",
		Title:       "Open sets and metric balls",
		Description: "A set is open when every point in it has a small ball around it that stays inside. The shape of the ball depends on the distance: a diamond for the taxicab metric, a disc for the Euclidean one, a square for the maximum metric. Each ball contains a smaller ball of the other kinds, so all three metrics produce exactly the same open sets, the same topology.",
		Tags:        []string{"open and closed", "L¹, L², L∞", "interior"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-open",
				h.Svg(h.Data("plane", ""), h.ViewBox("-3 -3 6 6"), h.Class("mx-auto block aspect-square w-full max-w-[480px] touch-none select-none"), h.Role("img"), h.Aria("label", "A region with the largest ball around the point that fits inside it")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Distance"),
					segs("Metric", [2]string{"2", "Euclidean L²"}, [2]string{"1", "Taxicab L¹"}, [2]string{"inf", "Maximum L∞"})),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("topo-closed", "closed", "Include the boundary", false),
					toggle("topo-nest", "nest", "Show the other balls", false)),
				topoButton("edge", hugeicons.Target01Icon(), "Move to the boundary"),
				readouts([2]string{"point", "x"}, [2]string{"largest ball", "r"}, [2]string{"interior point", "inside"}, [2]string{"set is open", "open"}),
				topoNote("Drag the point, or focus it and use the arrow keys. The radius is the distance from the point to the boundary in the chosen metric."),
			)
		},
	}
}

// ---------------------------------------------------------------- T9

func topoBrouwerBlock() Block {
	return Block{
		Slug:        "brouwer",
		Title:       "Brouwer fixed point",
		Description: "Any continuous map of a disc into itself leaves at least one point where it was. In one dimension this is the intermediate value theorem: a graph from [0, 1] to [0, 1] must cross the diagonal. In two, crumple a map of the room and drop it on the floor: some point of the map lies exactly above the spot it shows. The fixed point is located by a topological argument, the winding of f(p) − p around nested squares.",
		Tags:        []string{"fixed points", "winding", "continuity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-brouwer",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 720 360"), h.Class("block w-full touch-none select-none"), h.Role("group"), h.Aria("label", "A map of an interval and a map of a disc, with their fixed points")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Disc map"),
					field("rot", "Rotation", "°", 70, -180, 180, 1),
					field("swirl", "Swirl", "°", 60, -360, 360, 5),
					field("squash", "Shrink", "", 0.8, 0.2, 1.2, 0.01),
					field("dx", "Shift x", "", 0.3, -1, 1, 0.01),
					field("dy", "Shift y", "", -0.2, -1, 1, 0.01)),
				readouts([2]string{"interval fixed points", "n1"}, [2]string{"disc fixed point", "p"}, [2]string{"|f(p) − p|", "err"}, [2]string{"boundary winding", "wind"}),
				topoNote("Left: drag the handles to reshape f. Right: the faint grid is where the map sends the disc's own grid; points that would leave the disc are pulled back onto its rim, which keeps the map continuous."),
			)
		},
	}
}

// ---------------------------------------------------------------- T10

func topoPersistenceBlock() Block {
	return Block{
		Slug:        "persistence",
		Title:       "Persistent homology",
		Description: "Topology for data. Grow a ball around every point and join points whose balls touch, filling triangles when all three do. As the radius grows, components merge (H₀) and loops open and close (H₁). Each feature is a bar from the radius where it is born to where it dies; long bars are shape, short ones are noise. Bars come from a real column reduction over ℤ/2 of the Vietoris–Rips complex.",
		Tags:        []string{"Vietoris–Rips", "barcode", "Betti numbers"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("topo-persistence",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 720 360"), h.Class("block w-full touch-none select-none"), h.Role("group"), h.Aria("label", "Point cloud with its Rips complex, and the barcode")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cloud"),
					segs("Cloud", [2]string{"circle", "Circle"}, [2]string{"two", "Two loops"}, [2]string{"blobs", "Clusters"}, [2]string{"noise", "Noise"})),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scale"),
					field("eps", "ε", "", 0.3, 0, 0.8, 0.01)),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("topo-balls", "balls", "Show the balls", true)),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(), topoButton("new", hugeicons.DiceIcon(), "Resample")),
				readouts([2]string{"points", "n"}, [2]string{"edges, triangles", "simp"}, [2]string{"β₀ at ε", "b0"}, [2]string{"β₁ at ε", "b1"}, [2]string{"longest loop", "life"}),
				topoNote("Click the cloud to add a point, Shift-click to remove one. Two points are joined when their distance is at most ε, so the balls drawn have radius ε / 2."),
			)
		},
	}
}
