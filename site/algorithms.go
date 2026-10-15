package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AlgorithmsBlocks lists the algorithms and data structures gallery.
func AlgorithmsBlocks() []Block {
	return []Block{
		algoSortBlock(),
		algoGrowthBlock(),
		algoSearchBlock(),
		algoPathBlock(),
		algoHashBlock(),
		algoTreeBlock(),
		algoStructuresBlock(),
		algoDPBlock(),
	}
}

func algoInput(name, value, label, class string) h.Node {
	return h.Input(h.Type("text"), h.Data("input", name), h.Value(value), h.Aria("label", label), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
		h.Class("h-8 min-w-0 rounded-md border border-input bg-background px-2 font-mono text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 "+class))
}

// ---------------------------------------------------------------- A1

func algoSortBlock() Block {
	return Block{
		Slug:        "sorting",
		Title:       "Sorting, step by step",
		Description: "Five classic sorts on the same shuffled array, with every comparison and every write counted. Bubble and insertion sort make about n²/4 swaps on random data; merge, quick and heap sort stay near n log₂ n comparisons.",
		Tags:        []string{"sorting", "counters", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("asort",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 300"), h.Attr("preserveAspectRatio", "none"), h.Class("block h-[300px] w-full"), h.Role("img"), h.Aria("label", "Array being sorted")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Algorithm"),
					segs("Algorithm", [2]string{"bubble", "Bubble"}, [2]string{"insertion", "Insertion"}, [2]string{"merge", "Merge"}, [2]string{"quick", "Quick"}, [2]string{"heap", "Heap"}),
					field("n", "Size n", "", 32, 4, 96, 1),
					field("speed", "Steps / frame", "", 2, 1, 50, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discretePlayButton("Sort"),
					discreteButton("step", "Step", hugeicons.ArrowRight01Icon()),
					discreteButton("shuffle", "Shuffle", hugeicons.ShuffleIcon()),
					discreteButton("reversed", "Reversed", hugeicons.SortByDown01Icon()),
				),
				readouts([2]string{"comparisons", "cmp"}, [2]string{"writes", "writes"}, [2]string{"progress", "prog"}, [2]string{"n log₂ n", "nlogn"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func algoGrowthBlock() Block {
	return Block{
		Slug:        "growth",
		Title:       "Growth of functions",
		Description: "Big-O on a log scale, with the times that make it matter: how long n steps of each class take at a billion operations per second. Below, comparisons actually counted while insertion sort and merge sort ran on random arrays.",
		Tags:        []string{"big-O", "log scale", "measured"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("agrowth",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					discreteSvg("theory", "0 0 300 260", "Growth of common complexity classes"),
					discreteSvg("measured", "0 0 300 260", "Measured comparisons of two sorts"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Input size"),
					field("n", "n", "", 1000, 1, 1000000, 1),
				),
				h.Div(h.Data("table", ""), h.Class("flex flex-col gap-1 border-t pt-4 font-mono text-xs")),
				h.P(h.Class("text-xs text-muted-foreground"), "At 10⁹ simple operations per second."),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func algoSearchBlock() Block {
	return Block{
		Slug:        "binary-search",
		Title:       "Binary search",
		Description: "Halve the sorted range at every step: at most ⌊log₂ n⌋ + 1 comparisons, against up to n for scanning from the left. Choose a target and step through both.",
		Tags:        []string{"divide and conquer", "O(log n)", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("asearch", ""),
				h.Div(h.Class("flex flex-wrap items-end gap-3"),
					h.Div(h.Class("w-48"), field("target", "Target", "", 37, 0, 99, 1)),
					discreteButton("step", "Step", hugeicons.ArrowRight01Icon()),
					discreteButton("reset", "Reset", hugeicons.RefreshIcon()),
					discreteButton("shuffle", "New array", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Data("cells", ""), h.Class("grid grid-cols-8 gap-1 sm:grid-cols-[repeat(16,minmax(0,1fr))]")),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("rounded-lg border bg-code p-3 font-mono text-xs"),
						h.Div(h.Class("mb-1 text-muted-foreground"), "binary search"),
						h.Div(h.Data("out", "bin"), "—")),
					h.Div(h.Class("rounded-lg border bg-code p-3 font-mono text-xs"),
						h.Div(h.Class("mb-1 text-muted-foreground"), "linear scan, same target"),
						h.Div(h.Data("out", "lin"), "—")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func algoPathBlock() Block {
	return Block{
		Slug:        "pathfinding",
		Title:       "Graph search on a grid",
		Description: "Draw walls and mud, then watch the frontier spread. BFS finds the fewest steps, DFS finds a path but not a short one, Dijkstra finds the cheapest when mud costs 5, and A* gets the same cost while visiting less by aiming at the goal.",
		Tags:        []string{"BFS", "Dijkstra", "A*"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("apath",
				h.Div(h.Class("relative mx-auto aspect-[5/3] w-full max-w-[640px] overflow-hidden rounded-lg border"),
					h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full cursor-crosshair touch-none"), h.Role("img"), h.Aria("label", "Grid: drag to draw"))),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Algorithm"),
					segs("Algorithm", [2]string{"bfs", "BFS"}, [2]string{"dfs", "DFS"}, [2]string{"dijkstra", "Dijkstra"}, [2]string{"astar", "A*"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Draw"),
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("radiogroup"), h.Aria("label", "Brush"),
						h.Map([][2]string{{"wall", "Wall"}, {"mud", "Mud ×5"}, {"erase", "Erase"}, {"start", "Start"}, {"goal", "Goal"}}, func(b [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("brush", b[0]), h.Aria("pressed", h.Ternary(b[0] == "wall", "true", "false")),
								h.Class("rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"), b[1])
						}),
					),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discretePlayButton("Search"),
					discreteButton("maze", "Random maze", hugeicons.ShuffleIcon()),
					discreteButton("clear", "Clear", hugeicons.Delete02Icon()),
				),
				readouts([2]string{"visited", "visited"}, [2]string{"path steps", "steps"}, [2]string{"path cost", "cost"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func algoHashBlock() Block {
	return Block{
		Slug:        "hash-table",
		Title:       "Hash table",
		Description: "Keys go to bucket hash(key) mod m. When two keys collide, chaining hangs a list off the bucket and linear probing walks to the next free slot. Watch the probes grow as the load factor α = n/m approaches 1.",
		Tags:        []string{"hashing", "collisions", "load factor"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ahash",
				h.Div(h.Data("table", ""), h.Class("flex min-h-64 flex-col gap-1 p-1 font-mono text-xs")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Strategy"),
					segs("Collision strategy", [2]string{"chain", "Chaining"}, [2]string{"probe", "Linear probing"}),
					field("m", "Buckets m", "", 11, 3, 23, 1),
				),
				h.Form(h.Data("insert", ""), h.Action("#"), h.Class("flex gap-2 border-t pt-4"),
					algoInput("key", "", "Key to insert", "flex-1"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), hugeicons.Add01Icon(), "Insert"),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discreteButton("words", "Add 8 words", hugeicons.TextIcon()),
					discreteButton("clear", "Clear", hugeicons.Delete02Icon()),
				),
				readouts([2]string{"keys n", "n"}, [2]string{"load α", "alpha"}, [2]string{"collisions", "coll"}, [2]string{"last insert", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

func algoTreeBlock() Block {
	return Block{
		Slug:        "trees",
		Title:       "Binary search tree and heap",
		Description: "Two trees with different promises. A binary search tree keeps every left subtree smaller, so an in-order walk is sorted, but inserting sorted keys degrades it to a list. A binary min-heap only keeps parents smaller than children, and stays perfectly balanced in an array.",
		Tags:        []string{"BST", "heap", "invariants"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("atree",
				discreteSvg("plot", "0 0 560 320", "Tree"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Structure"),
					segs("Structure", [2]string{"bst", "Search tree"}, [2]string{"heap", "Min-heap"}),
				),
				h.Form(h.Data("insert", ""), h.Action("#"), h.Class("flex gap-2"),
					algoInput("key", "42", "Number to insert", "w-20"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), hugeicons.Add01Icon(), "Insert"),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					discreteButton("remove", "Delete min", hugeicons.MinusSignIcon()),
					discreteButton("random", "7 random", hugeicons.ShuffleIcon()),
					discreteButton("sorted", "1…7 in order", hugeicons.SortByUp01Icon()),
					discreteButton("clear", "Clear", hugeicons.Delete02Icon()),
				),
				readouts([2]string{"size", "size"}, [2]string{"height", "height"}, [2]string{"walk", "walk"}, [2]string{"last", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func algoStructuresBlock() Block {
	return Block{
		Slug:        "stack-queue",
		Title:       "Stack, queue, linked list",
		Description: "The same values in three containers. A stack takes and gives from the top (last in, first out), a queue gives from the front (first in, first out), and a singly linked list reaches anything by following next pointers from its head.",
		Tags:        []string{"LIFO", "FIFO", "pointers"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("astruct", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					segs("Structure", [2]string{"stack", "Stack"}, [2]string{"queue", "Queue"}, [2]string{"list", "Linked list"}),
					h.Div(h.Class("flex-1")),
					algoInput("value", "7", "Value", "w-16"),
					discreteButton("add", "Push", hugeicons.Add01Icon()),
					discreteButton("take", "Pop", hugeicons.MinusSignIcon()),
				),
				h.Div(h.Data("view", ""), h.Class("flex min-h-36 items-center justify-center overflow-x-auto rounded-xl border bg-code p-4")),
				h.P(h.Data("out", "log"), h.Class("min-h-4 font-mono text-xs text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

func algoDPBlock() Block {
	return Block{
		Slug:        "edit-distance",
		Title:       "Dynamic programming: edit distance",
		Description: "The fewest insertions, deletions and substitutions turning one word into another. Each cell reuses three smaller answers: D[i][j] = min(D[i−1][j] + 1, D[i][j−1] + 1, D[i−1][j−1] + [aᵢ ≠ bⱼ]). Fill the table, then trace the optimal path back.",
		Tags:        []string{"DP", "Levenshtein", "traceback"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("adp", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					algoInput("a", "kitten", "From", "w-32"),
					hugeicons.ArrowRight01Icon(h.Class("size-4 text-muted-foreground")),
					algoInput("b", "sitting", "To", "w-32"),
					h.Div(h.Class("flex-1")),
					discretePlayButton("Fill"),
					discreteButton("step", "Step", hugeicons.ArrowRight01Icon()),
					discreteButton("all", "Fill all", hugeicons.Forward02Icon()),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto"), h.Div(h.Data("grid", ""), h.Class("inline-grid gap-0.5 font-mono text-xs"))),
				h.Div(h.Class("grid gap-3 sm:grid-cols-[auto_1fr]"),
					h.Div(h.Class("font-mono text-sm"), h.Span(h.Class("text-muted-foreground"), "distance "), h.Span(h.Data("out", "dist"), h.Class("text-lg font-medium"), "—")),
					h.Div(h.Data("out", "ops"), h.Class("font-mono text-xs leading-relaxed text-muted-foreground"), "—"),
				),
			)
		},
	}
}
