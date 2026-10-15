package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GamesBlocks lists the game design and game AI gallery in display order.
func GamesBlocks() []Block {
	return []Block{
		gameTicTacToeBlock(),
		gameConnectFourBlock(),
		gameMCTSBlock(),
		gameNoiseBlock(),
		gameWFCBlock(),
		gameFeelBlock(),
		gameNPCBlock(),
		gameSteeringBlock(),
		gameCollisionBlock(),
		gameLootBlock(),
	}
}

func gameButton(action, label string, icon ...any) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), h.Group(icon...), label)
}

func gameCanvas(attr, label, aspect string) h.Node {
	return h.Div(h.Class("relative mx-auto w-full max-w-[640px] overflow-hidden rounded-lg border bg-background "+aspect),
		h.Canvas(h.Data(attr, ""), h.Class("absolute inset-0 size-full touch-none"), h.Role("img"), h.Aria("label", label)))
}

// ---------------------------------------------------------------- G1

func gameTicTacToeBlock() Block {
	return Block{
		Slug:        "tic-tac-toe",
		Title:       "Minimax and alpha–beta",
		Description: "Play tic-tac-toe against a perfect player. Every move it searches the whole game tree; the readout counts the positions plain minimax visits against alpha–beta pruning, which reaches the same answer with a fraction of the work.",
		Tags:        []string{"minimax", "alpha–beta", "playable"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-ttt",
				h.Div(h.Class("flex flex-col items-center gap-3 py-2"),
					h.Div(h.Class("grid aspect-square w-full max-w-[300px] grid-cols-3 gap-1.5"), h.Role("grid"), h.Aria("label", "Tic-tac-toe board"),
						h.Range(9, func(i int) h.Node {
							return h.Button(h.Type("button"), h.Data("cell", fmt.Sprint(i)), h.Aria("label", fmt.Sprintf("Square %d", i+1)),
								h.Class("flex items-center justify-center rounded-md border bg-background font-mono text-4xl font-medium transition-colors duration-150 outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[win]:bg-brand/15 data-[win]:text-brand data-[mark=O]:text-vec-u"))
						}),
					),
					h.P(h.Data("out", "status"), h.Aria("live", "polite"), h.Class("text-sm text-muted-foreground"), "Your move: you are X."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Who starts"), segs("Who starts", [2]string{"you", "You"}, [2]string{"ai", "Computer"})),
				h.Div(h.Class("grid grid-cols-1 gap-2"), gameButton("new", "New game", hugeicons.RefreshIcon())),
				readouts([2]string{"minimax", "plain"}, [2]string{"alpha–beta", "pruned"}, [2]string{"saved", "saved"}, [2]string{"value", "value"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Counts are for the computer's last search. From the empty board, plain minimax visits every node of the game tree."),
			)
		},
	}
}

// ---------------------------------------------------------------- G2

func gameConnectFourBlock() Block {
	return Block{
		Slug:        "connect-four",
		Title:       "Connect Four with a time budget",
		Description: "The game is too big to search to the end, so the computer deepens its search one ply at a time until its time budget runs out, scoring unfinished positions with a heuristic: open lines of two and three, and the centre column.",
		Tags:        []string{"iterative deepening", "heuristic", "playable"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-c4",
				h.Div(h.Class("flex flex-col items-center gap-3"),
					h.Svg(h.Data("board", ""), h.ViewBox("0 0 700 600"), h.Class("block w-full max-w-[520px] cursor-pointer select-none"), h.TabIndex(0),
						h.Role("img"), h.Aria("label", "Connect Four board. Click a column, or use the keys 1 to 7.")),
					h.P(h.Data("out", "status"), h.Aria("live", "polite"), h.Class("text-sm text-muted-foreground"), "Your move: click a column."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Computer"),
					field("time", "Think time", "ms", 300, 20, 2000, 10),
					segs("Who starts", [2]string{"you", "You start"}, [2]string{"ai", "Computer starts"}),
				),
				gameButton("new", "New game", hugeicons.RefreshIcon()),
				readouts([2]string{"depth reached", "depth"}, [2]string{"positions", "nodes"}, [2]string{"positions/s", "rate"}, [2]string{"evaluation", "eval"}),
				h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"), "Keys", kbd.Kbd("1"), "…", kbd.Kbd("7"), "drop in a column when the board has focus."),
			)
		},
	}
}

// ---------------------------------------------------------------- G3

func gameMCTSBlock() Block {
	return Block{
		Slug:        "mcts",
		Title:       "Monte Carlo tree search",
		Description: "Instead of evaluating positions, play thousands of random games and grow a tree toward the moves that win. UCT balances trying the best move so far against exploring the others. Set up any tic-tac-toe position and compare its choice with exact minimax.",
		Tags:        []string{"UCT", "random playouts", "exploration"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-mcts",
				h.Div(h.Class("flex flex-col items-center gap-3 py-2"),
					h.Div(h.Class("grid aspect-square w-full max-w-[320px] grid-cols-3 gap-1.5"),
						h.Range(9, func(i int) h.Node {
							return h.Button(h.Type("button"), h.Data("cell", fmt.Sprint(i)), h.Aria("label", fmt.Sprintf("Square %d", i+1)),
								h.Class("relative flex flex-col items-center justify-center gap-0.5 rounded-md border bg-background outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[best]:border-brand data-[best]:bg-brand/10"),
								h.Span(h.Data("mark", ""), h.Class("font-mono text-3xl font-medium")),
								h.Span(h.Data("stat", ""), h.Class("font-mono text-[10px] text-muted-foreground tabular-nums")))
						}),
					),
					h.P(h.Data("out", "turn"), h.Class("text-sm text-muted-foreground"), "X to move. Click squares to set up a position."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Search"),
					field("c", "Exploration C", "", 1.41, 0, 4, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					gameButton("run1k", "+1,000", hugeicons.PlayIcon()),
					gameButton("run10k", "+10,000", hugeicons.PlayIcon()),
					gameButton("reset", "Reset tree", hugeicons.RefreshIcon()),
					gameButton("clear", "Clear board", hugeicons.Cancel01Icon()),
				),
				readouts([2]string{"playouts", "playouts"}, [2]string{"playouts/s", "rate"}, [2]string{"MCTS pick", "pick"}, [2]string{"minimax best", "exact"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Each square shows visits and the win rate for the side to move (draws count half)."),
			)
		},
	}
}

// ---------------------------------------------------------------- G4

func gameNoiseBlock() Block {
	return Block{
		Slug:        "noise-terrain",
		Title:       "Noise terrain",
		Description: "Procedural landscapes from Perlin gradient noise summed over octaves: each octave doubles the detail (lacunarity) and shrinks its height (persistence). Same seed, same world.",
		Tags:        []string{"Perlin noise", "fBm", "seeded"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-noise",
				gameCanvas("canvas", "Height map coloured from sea to snow", "aspect-[4/3]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Fractal noise"),
					field("octaves", "Octaves", "", 5, 1, 8, 1),
					field("persistence", "Persistence", "", 0.5, 0.1, 0.9, 0.01),
					field("lacunarity", "Lacunarity", "", 2, 1.2, 4, 0.05),
					field("scale", "Feature size", "px", 90, 20, 300, 1),
					field("sea", "Sea level", "", 0.45, 0.1, 0.8, 0.01),
				),
				gameButton("reseed", "New seed", hugeicons.ShuffleIcon()),
				readouts([2]string{"seed", "seed"}, [2]string{"land", "land"}, [2]string{"peaks", "peaks"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G5

func gameWFCBlock() Block {
	return Block{
		Slug:        "wave-function-collapse",
		Title:       "Wave function collapse",
		Description: "Every cell starts able to be any pipe tile. Repeatedly fix the cell with the fewest options left, then remove the tiles its neighbours can no longer use. When a cell runs out of options it is a contradiction, and the run restarts.",
		Tags:        []string{"constraint propagation", "tiles", "seeded"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-wfc",
				gameCanvas("canvas", "Grid of pipe tiles; uncollapsed cells show how many tiles remain", "aspect-[4/3]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Tiles"),
					field("cross", "Cross & T weight", "", 1, 0, 5, 0.1),
					field("empty", "Empty weight", "", 2, 0, 8, 0.1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					gameButton("step", "Step", hugeicons.ArrowRight01Icon()),
					playPauseLabel("Run"),
					gameButton("restart", "New seed", hugeicons.ShuffleIcon()),
					gameButton("solve", "Solve", hugeicons.Tick02Icon()),
				),
				readouts([2]string{"collapsed", "done"}, [2]string{"contradictions", "fails"}, [2]string{"seed", "seed"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G6

func gameFeelBlock() Block {
	return Block{
		Slug:        "game-feel",
		Title:       "Game feel lab",
		Description: "The same little platformer with and without the tricks players never notice but always feel: coyote time, jump buffering, variable jump height, acceleration and a little screen shake. Turn them off one at a time.",
		Tags:        []string{"platformer", "input", "keyboard"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-feel",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Data("stage", ""), h.TabIndex(0), h.Aria("label", "Platformer. Arrow keys or A and D to move, Space or W to jump."),
						h.Class("relative mx-auto aspect-[16/9] w-full max-w-[640px] overflow-hidden rounded-lg border bg-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full")),
						h.P(h.Data("hint", ""), h.Class("pointer-events-none absolute inset-x-0 top-3 text-center text-xs text-muted-foreground"), "Click here, then play"),
					),
					h.P(h.Class("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
						kbd.Kbd("←"), kbd.Kbd("→"), "or", kbd.Kbd("A"), kbd.Kbd("D"), "move ·", kbd.Kbd("Space"), "or", kbd.Kbd("W"), "jump"),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Tricks"),
					toggle("game-feel-coyote", "coyote", "Coyote time (0.1 s)", true),
					toggle("game-feel-buffer", "buffer", "Jump buffer (0.1 s)", true),
					toggle("game-feel-variable", "variable", "Variable jump height", true),
					toggle("game-feel-accel", "accel", "Acceleration", true),
					toggle("game-feel-shake", "shake", "Landing shake", true),
				),
				readouts([2]string{"jumps", "jumps"}, [2]string{"saved by coyote", "coyote"}, [2]string{"saved by buffer", "buffered"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G7

func gameNPCBlock() Block {
	return Block{
		Slug:        "npc-state-machine",
		Title:       "An NPC's state machine",
		Description: "A guard that patrols, chases you when it sees you, searches where it last saw you, and gives up and goes home. Move the player with the pointer; the diagram lights up the current state and the transition that fired.",
		Tags:        []string{"finite state machine", "AI", "pointer"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-npc",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					gameCanvas("canvas", "Arena with a guard, its view cone and the player", "aspect-[4/3]"),
					h.Svg(h.Data("diagram", ""), h.ViewBox("0 0 260 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "State diagram")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Guard"),
					field("sight", "Sight range", "px", 140, 40, 260, 5),
					field("fov", "Field of view", "°", 90, 20, 360, 5),
					field("patience", "Search time", "s", 3, 0.5, 10, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("game-npc-hide", "hide", "Player sneaking (half range)", false)),
				readouts([2]string{"state", "state"}, [2]string{"last event", "event"}, [2]string{"distance", "dist"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G8

func gameSteeringBlock() Block {
	return Block{
		Slug:        "steering",
		Title:       "Steering and flocking",
		Description: "Craig Reynolds' steering behaviours: each agent asks for a desired velocity and turns toward it with a limited force. Seek, flee, arrive and wander follow the pointer; boids flock from three local rules alone.",
		Tags:        []string{"Reynolds", "boids", "pointer"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-steer",
				gameCanvas("canvas", "Agents steering toward or away from the pointer", "aspect-[4/3]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Behaviour"),
					segs("Behaviour", [2]string{"seek", "Seek"}, [2]string{"flee", "Flee"}, [2]string{"arrive", "Arrive"}, [2]string{"wander", "Wander"}, [2]string{"flock", "Flock"}),
					field("speed", "Max speed", "px/s", 160, 40, 400, 5),
					field("force", "Max force", "px/s²", 300, 50, 1200, 10),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Flock weights"),
					field("sep", "Separation", "", 1.5, 0, 4, 0.1),
					field("ali", "Alignment", "", 1, 0, 4, 0.1),
					field("coh", "Cohesion", "", 1, 0, 4, 0.1),
				),
				readouts([2]string{"agents", "n"}, [2]string{"mean speed", "speed"}, [2]string{"order", "order"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G9

func gameCollisionBlock() Block {
	return Block{
		Slug:        "collision",
		Title:       "Collision detection",
		Description: "How games know two things touch. Boxes compare their ranges on each axis, circles compare a distance, and convex polygons use the separating axis theorem: if any edge normal separates their shadows, they don't collide. Drag the shapes.",
		Tags:        []string{"AABB", "SAT", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-collide",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 380"), h.Class("mx-auto block w-full max-w-[640px] touch-none select-none"),
					h.Role("img"), h.Aria("label", "Two shapes you can drag, with their projections on the separating axis")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Shapes"),
					segs("Test", [2]string{"aabb", "Box–box"}, [2]string{"circle", "Circle–circle"}, [2]string{"boxcircle", "Box–circle"}, [2]string{"sat", "Polygons (SAT)"}),
					field("rot", "Rotate polygon B", "°", 20, 0, 360, 1),
				),
				readouts([2]string{"colliding", "hit"}, [2]string{"separating axis", "axis"}, [2]string{"gap / overlap", "depth"}, [2]string{"axes tested", "tests"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Drag a shape, or focus it and use the arrow keys. When the shapes overlap, the arrow is the minimum push that separates them."),
			)
		},
	}
}

// ---------------------------------------------------------------- G10

func gameLootBlock() Block {
	return Block{
		Slug:        "loot-odds",
		Title:       "Loot odds and pity timers",
		Description: "A 2% drop sounds like one in fifty tries, but after fifty tries more than a third of players still have nothing. The geometric distribution, exactly, with a pity timer that guarantees the drop and a simulated crowd of players.",
		Tags:        []string{"geometric distribution", "expected value", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("game-loot",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Share of players who got the drop after each number of tries")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Drop"),
					field("p", "Drop chance", "%", 2, 0.1, 50, 0.1),
					field("n", "Tries", "", 50, 1, 500, 1),
					field("pity", "Pity at try", "", 90, 0, 500, 1),
				),
				gameButton("sim", "Simulate 10,000 players", hugeicons.DiceIcon()),
				readouts([2]string{"P(≥ 1 in n)", "atleast"}, [2]string{"expected tries", "mean"}, [2]string{"50% / 90% / 99%", "quant"}, [2]string{"simulated", "sim"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Pity 0 means no pity. With pity N, the N-th try always drops if nothing dropped before."),
			)
		},
	}
}
