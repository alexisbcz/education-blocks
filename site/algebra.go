package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AlgebraBlocks lists the abstract algebra gallery in display order.
func AlgebraBlocks() []Block {
	return []Block{
		algCayleyBlock(),
		algDihedralBlock(),
		algPermBlock(),
		algCosetsBlock(),
		algBurnsideBlock(),
		algRingsBlock(),
		algPuzzleBlock(),
		algPolyBlock(),
	}
}

func algButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func algTextInput(attr, value, label string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1 text-sm"),
		h.Span(h.Class("text-muted-foreground"), label),
		h.Input(h.Type("text"), h.Data(attr, ""), h.Value(value), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
			h.Class("h-9 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-del sm:text-sm")),
	)
}

// ---------------------------------------------------------------- AL1

func algCayleyBlock() Block {
	return Block{
		Slug:        "cayley-table",
		Title:       "Group explorer",
		Description: "A group is a set with one operation that is associative, has an identity and inverses. Its whole structure fits in a Cayley table: every row and column is a permutation of the elements (a Latin square). Pick an element to see its order, its inverse, the cyclic subgroup it generates and its conjugacy class.",
		Tags:        []string{"Cayley table", "orders", "conjugacy classes"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("alg-cayley",
				h.Div(h.Class("scroll-thin max-h-[560px] overflow-auto"), h.Div(h.Data("table", ""))),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Group"),
					segs("Group", [2]string{"z", "ℤₙ"}, [2]string{"d", "Dₙ"}, [2]string{"s3", "S₃"}, [2]string{"s4", "S₄"}, [2]string{"q8", "Q₈"}),
					h.Div(h.Data("needs-n", ""), field("n", "n", "", 6, 2, 12, 1)),
				),
				readouts([2]string{"order |G|", "order"}, [2]string{"abelian", "abelian"}, [2]string{"cyclic", "cyclic"}, [2]string{"conjugacy classes", "classes"}, [2]string{"centre", "centre"}),
				h.Div(h.Data("pick", ""), h.Aria("live", "polite"), h.Class("min-h-24 rounded-lg border bg-code p-3 font-mono text-xs leading-relaxed text-muted-foreground"), "Click an element in the table header."),
			)
		},
	}
}

// ---------------------------------------------------------------- AL2

func algDihedralBlock() Block {
	return Block{
		Slug:        "dihedral",
		Title:       "Symmetries of a polygon",
		Description: "The dihedral group Dₙ is every way to pick up a regular n-gon and put it back: n rotations and n reflections. Apply r (turn by 360°/n) and s (flip) in any order; every sequence collapses to one of the 2n normal forms rᵏ or rᵏs, because s r = r⁻¹ s.",
		Tags:        []string{"Dₙ", "rotations and reflections", "relations"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("alg-dihedral", ""),
				h.Div(h.Class("grid gap-4 sm:grid-cols-[1fr_220px]"),
					h.Svg(h.Data("poly", ""), h.ViewBox("-1.5 -1.5 3 3"), h.Class("mx-auto block aspect-square w-full max-w-[320px]"), h.Role("img"), h.Aria("label", "A labelled regular polygon")),
					h.Div(h.Class("flex flex-col gap-3"),
						field("n", "n (sides)", "", 5, 3, 8, 1),
						h.Div(h.Class("grid grid-cols-2 gap-2"),
							algButton("r", hugeicons.RotateClockwiseIcon(), "r"),
							algButton("s", hugeicons.FlipHorizontalIcon(), "s"),
							algButton("ri", hugeicons.ArrowTurnBackwardIcon(), "r⁻¹"),
							algButton("reset", hugeicons.RefreshIcon(), "e"),
						),
						readouts([2]string{"word", "word"}, [2]string{"normal form", "normal"}, [2]string{"element order", "order"}),
					),
				),
				h.P(h.Class("text-xs text-muted-foreground"), "Turns go counter-clockwise; s flips across the vertical axis. Keys: R, S, Shift+R, E."),
			)
		},
	}
}

// ---------------------------------------------------------------- AL3

func algPermBlock() Block {
	return Block{
		Slug:        "permutations",
		Title:       "Permutations and cycles",
		Description: "Write permutations in one-line notation and compose them: σ ∘ τ applies τ first. Every permutation splits into disjoint cycles; its order is the lcm of the cycle lengths, and its sign is (−1) to the number of even-length cycles.",
		Tags:        []string{"Sₙ", "cycle notation", "sign and order"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("alg-perm",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Arrow diagrams of τ, then σ")),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("One-line notation"),
					algTextInput("sigma", "2 3 1 5 4 6", "σ"),
					algTextInput("tau", "1 3 2 4 6 5", "τ"),
					algButton("random", hugeicons.ShuffleIcon(), "Random pair"),
				),
				readouts([2]string{"σ", "s"}, [2]string{"τ", "t"}, [2]string{"σ ∘ τ", "st"}, [2]string{"τ ∘ σ", "ts"}, [2]string{"order σ∘τ", "order"}, [2]string{"sign σ∘τ", "sign"}),
			)
		},
	}
}

// ---------------------------------------------------------------- AL4

func algCosetsBlock() Block {
	return Block{
		Slug:        "cosets",
		Title:       "Cosets and Lagrange's theorem",
		Description: "The left cosets gH of a subgroup H cut the group into equal-sized pieces, so |H| divides |G|: Lagrange's theorem. When left and right cosets agree, H is normal and the cosets themselves form a group, the quotient G/H.",
		Tags:        []string{"Lagrange", "normal subgroups", "quotient group"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("alg-cosets",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("cosets", ""), h.Class("flex flex-wrap gap-2")),
					h.Div(h.Data("quotient", ""), h.Class("scroll-thin overflow-x-auto")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Group"),
					segs("Group", [2]string{"z12", "ℤ₁₂"}, [2]string{"d4", "D₄"}, [2]string{"s3", "S₃"}, [2]string{"s4", "S₄"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Subgroup"),
					h.Div(h.Data("subgroups", ""), h.Role("listbox"), h.Aria("label", "Subgroups"), h.Class("flex flex-wrap gap-1.5")),
				),
				readouts([2]string{"|G| = |H| · [G:H]", "lagrange"}, [2]string{"normal", "normal"}, [2]string{"G/H", "quot"}),
			)
		},
	}
}

// ---------------------------------------------------------------- AL5

func algBurnsideBlock() Block {
	return Block{
		Slug:        "burnside",
		Title:       "Counting necklaces with Burnside",
		Description: "How many different necklaces of n beads in k colours, if turning (and optionally flipping) the necklace doesn't count as different? Burnside's lemma: the number of orbits is the average, over the symmetries, of the colourings each one leaves unchanged. A rotation by j fixes k^gcd(j,n) of them.",
		Tags:        []string{"group actions", "orbits", "exact counting"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("alg-burnside",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("table", ""), h.Class("scroll-thin max-h-72 overflow-auto")),
					h.Div(h.Data("gallery", ""), h.Class("flex flex-wrap gap-1.5")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Necklace"),
					field("n", "Beads n", "", 6, 2, 12, 1),
					field("k", "Colours k", "", 2, 1, 4, 1),
					segs("Symmetries", [2]string{"cyclic", "Turns only"}, [2]string{"dihedral", "Turns and flips"}),
				),
				readouts([2]string{"colourings kⁿ", "all"}, [2]string{"symmetries |G|", "g"}, [2]string{"necklaces", "orbits"}, [2]string{"check by listing", "brute"}),
			)
		},
	}
}

// ---------------------------------------------------------------- AL6

func algRingsBlock() Block {
	return Block{
		Slug:        "rings-fields",
		Title:       "Rings and finite fields",
		Description: "ℤₙ with + and × is a ring. The elements with a multiplicative inverse are its units (shaded); a zero divisor times something non-zero gives 0. ℤₙ is a field exactly when n is prime. GF(4) is the field with four elements, built from x² = x + 1 over ℤ₂: not ℤ₄, which has a zero divisor.",
		Tags:        []string{"units", "zero divisors", "GF(4)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("alg-rings",
				h.Div(h.Class("grid gap-4 xl:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "addition"), h.Div(h.Data("add", ""), h.Class("scroll-thin overflow-x-auto"))),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "multiplication"), h.Div(h.Data("mul", ""), h.Class("scroll-thin overflow-x-auto"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ring"),
					segs("Ring", [2]string{"zn", "ℤₙ"}, [2]string{"gf4", "GF(4)"}),
					h.Div(h.Data("needs-n", ""), field("n", "n", "", 12, 2, 16, 1)),
				),
				readouts([2]string{"units", "units"}, [2]string{"zero divisors", "zd"}, [2]string{"field", "field"}, [2]string{"unit group order", "phi"}),
			)
		},
	}
}

// ---------------------------------------------------------------- AL7

func algPuzzleBlock() Block {
	return Block{
		Slug:        "fifteen-puzzle",
		Title:       "The 15 puzzle and parity",
		Description: "Sliding moves are permutations, and each one changes two things at once: the parity of the tile order and the row of the gap. Their combination never changes, which is why exactly half of all arrangements can never be solved. Swapping two tiles, as Sam Loyd's famous 1880s challenge did, lands you in that half.",
		Tags:        []string{"invariants", "permutation parity", "playable"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("alg-15", ""),
				h.Div(h.Class("grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start"),
					h.Div(h.Data("board", ""), h.TabIndex(0), h.Role("grid"), h.Aria("label", "15 puzzle; arrow keys slide a tile into the gap"),
						h.Class("mx-auto grid size-64 grid-cols-4 gap-1 rounded-xl border bg-code p-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50")),
					h.Div(h.Class("flex flex-col gap-3"),
						h.Div(h.Class("grid grid-cols-2 gap-2"),
							algButton("scramble", hugeicons.ShuffleIcon(), "Scramble"),
							algButton("swap", hugeicons.ArrowTurnBackwardIcon(), "Swap 14 ↔ 15"),
							algButton("reset", hugeicons.RefreshIcon(), "Solved"),
						),
						readouts([2]string{"moves", "moves"}, [2]string{"inversions", "inv"}, [2]string{"gap row from bottom", "row"}, [2]string{"solvable", "solvable"}),
					),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "On a 4-wide board a position is solvable exactly when the number of inversions and the gap's row counted from the bottom have opposite parities. Click a tile next to the gap, or use the arrow keys."),
			)
		},
	}
}

// ---------------------------------------------------------------- AL8

func algPolyBlock() Block {
	return Block{
		Slug:        "polynomials-mod-p",
		Title:       "Polynomials over ℤₚ",
		Description: "Polynomials with coefficients in a field ℤₚ divide with remainder just like integers, so Euclid's algorithm finds their gcd. Whether a polynomial factors depends on the field: x² + 1 is irreducible over ℤ₃ but splits as (x + 2)(x + 3) over ℤ₅.",
		Tags:        []string{"division algorithm", "Euclid", "irreducibility"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("alg-poly",
				h.Div(h.Data("steps", ""), h.Class("flex flex-col gap-3 font-mono text-sm")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Field"),
					field("p", "p (prime)", "", 5, 2, 13, 1),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Coefficients, highest first"),
					algTextInput("a", "1 0 1", "a(x)"),
					algTextInput("b", "1 3", "b(x)"),
				),
				readouts([2]string{"a = q·b + r", "div"}, [2]string{"gcd(a, b)", "gcd"}, [2]string{"a(x) factors", "fact"}, [2]string{"a irreducible", "irr"}),
			)
		},
	}
}
