package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NumtheoryBlocks lists the number theory gallery in display order.
// Sieving, Euclid's algorithm and clock arithmetic live in Cryptography;
// these blocks go further: the shape of the primes, approximations,
// congruences, conjectures.
func NumtheoryBlocks() []Block {
	return []Block{
		ntUlamBlock(),
		ntPrimeCountBlock(),
		ntGoldbachBlock(),
		ntContFracBlock(),
		ntFordBlock(),
		ntTimesBlock(),
		ntCRTBlock(),
		ntResiduesBlock(),
		ntPythagBlock(),
		ntCollatzBlock(),
	}
}

func ntButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func ntNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

// ntCaption labels a figure where case matters (p and P are not the same).
func ntCaption(s string) h.Node {
	return h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), s)
}

// ntSvg is a plot surface with a fixed viewBox that scales to its column.
func ntSvg(viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// ---------------------------------------------------------------- NT1

func ntUlamBlock() Block {
	return Block{
		Slug:        "ulam",
		Title:       "The Ulam spiral",
		Description: "Write the integers in a square spiral and mark the primes. They are not random-looking at all: they crowd onto diagonals, because a diagonal is the set of values of a quadratic polynomial 4n² + bn + c, and some of those polynomials avoid small prime factors. Start the spiral at 41 to see Euler's n² + n + 41, prime for every n from 0 to 39, lined up on one diagonal.",
		Tags:        []string{"primes", "quadratic polynomials", "Euler's polynomial"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-ulam",
				chaosCanvas("aspect-square max-w-[560px]", "Integers in a square spiral with primes marked", h.Data("hover", "")),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Spiral"),
					field("side", "side", "cells", 151, 21, 401, 2),
					segs("Start at", [2]string{"1", "start 1"}, [2]string{"41", "start 41"}),
					toggle("nt-ulam-euler", "euler", "Highlight n² + n + 41", true),
				),
				readouts([2]string{"numbers", "count"}, [2]string{"primes", "primes"}, [2]string{"share prime", "share"}, [2]string{"1 / ln(max)", "expect"}, [2]string{"under pointer", "hover"}),
				ntNote("Each cell is one integer. The highlighted cells are the values n² + n + 41 for n ≥ 0; the first 40 are all prime, and 40² + 40 + 41 = 41² is the first that is not."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT2

func ntPrimeCountBlock() Block {
	return Block{
		Slug:        "prime-counting",
		Title:       "Counting primes",
		Description: "π(x) counts the primes up to x. The prime number theorem (Hadamard and de la Vallée Poussin, 1896) says π(x) behaves like x / ln x, but the logarithmic integral Li(x) = ∫₂ˣ dt / ln t, the estimate Gauss proposed as a teenager, is far closer. Every count here is exact, from a sieve run in your browser up to ten million.",
		Tags:        []string{"π(x)", "prime number theorem", "Li(x)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-pi",
				h.Div(h.Class("flex flex-col gap-2"),
					ntSvg("0 0 640 340", "π(x), x / ln x and Li(x) against x"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "π(x), exact"), legendSwatch("var(--vec-u)", "Li(x)"), legendSwatch("var(--vec-v)", "x / ln x"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Range"),
					segs("Upper limit", [2]string{"10000", "10⁴"}, [2]string{"100000", "10⁵"}, [2]string{"1000000", "10⁶"}, [2]string{"10000000", "10⁷"}),
					segs("View", [2]string{"count", "counts"}, [2]string{"ratio", "ratios"}),
				),
				readouts([2]string{"x", "x"}, [2]string{"π(x)", "pi"}, [2]string{"x / ln x", "xln"}, [2]string{"Li(x)", "li"}, [2]string{"π · ln x / x", "ratio"}, [2]string{"sieve", "time"}),
				ntNote("Move the pointer over the chart to read any x. Li(x) stays above π(x) for every x anyone has computed, yet Littlewood proved (1914) that the lead changes sides infinitely often."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT3

func ntGoldbachBlock() Block {
	return Block{
		Slug:        "goldbach",
		Title:       "Goldbach's comet",
		Description: "Goldbach's conjecture (1742): every even number greater than 2 is a sum of two primes. Plot how many ways each even number splits and the points form a widening comet, with bands for numbers divisible by 3, 5 and 7. Still unproved; Oliveira e Silva, Herzog and Pardi checked it up to 4 × 10¹⁸ in 2014.",
		Tags:        []string{"conjecture", "prime pairs", "partitions"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-goldbach",
				h.Div(h.Class("flex flex-col gap-2"),
					ntSvg("0 0 640 340", "Number of ways to write each even number as a sum of two primes"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "n divisible by 3"), legendSwatch("var(--muted-foreground)", "other even n"), legendSwatch("var(--brand)", "picked n"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Numbers"),
					field("max", "up to", "", 4000, 100, 20000, 100),
					field("n", "pick n", "", 100, 4, 20000, 2),
				),
				readouts([2]string{"n", "n"}, [2]string{"ways p + q", "ways"}, [2]string{"smallest p", "small"}, [2]string{"fewest ways, top half", "min"}),
				h.Div(h.Data("list", ""), h.Aria("live", "polite"), h.Class("scroll-thin max-h-28 overflow-auto rounded-lg border bg-code p-2 font-mono text-[11px] leading-relaxed text-muted-foreground")),
				ntNote("Counted with p ≤ q, so 10 = 3 + 7 = 5 + 5 has 2 ways. Click the chart to pick a number."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT4

func ntContFracBlock() Block {
	return Block{
		Slug:        "continued-fractions",
		Title:       "Continued fractions",
		Description: "Peel off the integer part, flip what is left, repeat: x = a₀ + 1/(a₁ + 1/(a₂ + …)). Cutting the expansion short gives the convergents p/q, which close in on x from alternating sides and are the best rational approximations for their size. A large term means a very good one: 355/113 for π comes just before the 292.",
		Tags:        []string{"convergents", "best approximation", "Pell"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-cf",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("expansion", ""), h.Class("min-h-10 px-1 font-mono text-sm tabular-nums")),
					ntSvg("0 0 640 150", "Convergents closing in on x on a zooming number line"),
					h.Div(h.Class("scroll-thin max-h-64 overflow-auto rounded-lg border bg-background"), h.Div(h.Data("table", ""))),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Number"),
					segs("Number", [2]string{"pi", "π"}, [2]string{"e", "e"}, [2]string{"phi", "φ"}, [2]string{"sqrt", "√n"}, [2]string{"frac", "p / q"}),
					h.Div(h.Data("needs", "sqrt"), field("n", "n", "", 7, 2, 99, 1)),
					h.Div(h.Data("needs", "frac"), h.Class("flex flex-col gap-2"), field("p", "p", "", 415, 1, 9999, 1), field("q", "q", "", 93, 1, 9999, 1)),
					field("k", "convergent", "", 3, 0, 14, 1),
				),
				readouts([2]string{"pₖ / qₖ", "conv"}, [2]string{"error", "err"}, [2]string{"1 / qₖ²", "bound"}, [2]string{"digits right", "digits"}),
				ntNote("The number line zooms on the k-th convergent; earlier ones that still fit are drawn faded. π's terms come from its known expansion, e and φ from their exact patterns, √n and p/q are expanded exactly here."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT5

func ntFordBlock() Block {
	return Block{
		Slug:        "ford-circles",
		Title:       "Farey sequences and Ford circles",
		Description: "The Farey sequence Fₙ lists the reduced fractions in [0, 1] with denominator at most n. On each p/q stand a circle of diameter 1/q²: these Ford circles never overlap, and two of them touch exactly when the fractions are Farey neighbours, |ad − bc| = 1. The fraction born between neighbours is their mediant (a + c)/(b + d).",
		Tags:        []string{"Farey", "mediant", "tangent circles"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-ford",
				ntSvg("0 0 640 360", "Ford circles on the unit interval"),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Order"),
					field("n", "n", "", 7, 1, 16, 1),
					toggle("nt-ford-tan", "tangent", "Show tangencies", true),
				),
				readouts([2]string{"|Fₙ|", "size"}, [2]string{"picked", "pick"}, [2]string{"neighbours", "nb"}, [2]string{"determinants", "det"}, [2]string{"mediant", "med"}),
				h.Div(h.Data("seq", ""), h.Class("scroll-thin max-h-24 overflow-auto rounded-lg border bg-code p-2 font-mono text-[11px] leading-relaxed text-muted-foreground")),
				ntNote("Click a circle to pick its fraction. |Fₙ| = 1 + φ(1) + … + φ(n), so it grows like 3n²/π²."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT6

func ntTimesBlock() Block {
	return Block{
		Slug:        "times-circle",
		Title:       "Times tables on a circle",
		Description: "Put m points round a circle and join each k to k·t mod m. Times 2 draws a cardioid, times 3 a nephroid, and in general the envelope is an epicycloid with t − 1 cusps. Let t run through the decimals to watch one curve morph into the next.",
		Tags:        []string{"mod m", "cardioid", "envelopes"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-times",
				ntSvg("-110 -110 220 220", "Chords from k to k times t mod m", h.Class("mx-auto block w-full max-w-[520px] select-none")),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Table"),
					field("t", "times t", "", 2, 2, 100, 0.01),
					field("m", "points m", "", 200, 10, 600, 1),
					h.Div(h.Class("flex flex-wrap gap-2"), playPause(), ntButton("cardioid", hugeicons.RefreshIcon(), "Cardioid")),
				),
				readouts([2]string{"t", "t"}, [2]string{"cusps", "cusps"}, [2]string{"curve", "curve"}, [2]string{"fixed points", "fixed"}),
				ntNote("Fixed points are the k with k·t ≡ k (mod m), when t is a whole number; their chords shrink to a dot."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT7

func ntCRTBlock() Block {
	return Block{
		Slug:        "crt",
		Title:       "The Chinese remainder theorem",
		Description: "When gcd(m, n) = 1, any pair of remainders (a mod m, b mod n) comes from exactly one x below mn. Count 0, 1, 2, … and step diagonally through an m × n grid, wrapping at the edges: with coprime moduli the walk fills every cell. With a common factor it misses most of them, and a system has a solution only when a ≡ b mod gcd(m, n).",
		Tags:        []string{"congruences", "Sunzi", "Bézout"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-crt",
				h.Div(h.Class("scroll-thin flex h-full items-center overflow-auto"), h.Div(h.Class("mx-auto"), h.Data("grid", ""))),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("System"),
					field("m", "modulus m", "", 5, 2, 16, 1),
					field("a", "x ≡ a", "", 3, 0, 15, 1),
					field("n", "modulus n", "", 7, 2, 16, 1),
					field("b", "x ≡ b", "", 2, 0, 15, 1),
					h.Div(h.Class("flex flex-wrap gap-2"), playPause(), ntButton("random", hugeicons.ShuffleIcon(), "Random")),
				),
				readouts([2]string{"gcd(m, n)", "gcd"}, [2]string{"solution x", "x"}, [2]string{"all solutions", "all"}, [2]string{"cells reached", "reach"}),
				h.Div(h.Data("work", ""), h.Class("rounded-lg border bg-code p-3 font-mono text-[11px] leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- NT8

func ntResiduesBlock() Block {
	return Block{
		Slug:        "quadratic-residues",
		Title:       "Quadratic residues and reciprocity",
		Description: "A square mod p is a quadratic residue. For an odd prime exactly half the nonzero classes are squares, and Euler's criterion decides which: a^((p−1)/2) ≡ (a/p), the Legendre symbol ±1. Gauss's quadratic reciprocity ties (p/q) to (q/p): they agree unless p and q are both 3 mod 4.",
		Tags:        []string{"Legendre symbol", "Euler's criterion", "reciprocity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-qr",
				h.Div(h.Class("grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("flex flex-col gap-2"), ntCaption("Squares mod p: x joined to x²"), ntSvg("-120 -120 240 240", "Residues mod p on a circle, squares joined to their roots", h.Data("ring", ""), h.Class("mx-auto block w-full max-w-[340px] select-none"))),
					h.Div(h.Class("flex flex-col gap-2"), ntCaption("Reciprocity: the sign of (p/q)·(q/p)"), h.Div(h.Data("recip", ""), h.Class("scroll-thin overflow-auto"))),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Prime and number"),
					field("p", "prime p", "", 13, 3, 97, 1),
					field("a", "a", "", 10, 1, 96, 1),
				),
				readouts([2]string{"p", "p"}, [2]string{"residues", "res"}, [2]string{"a^((p−1)/2) mod p", "euler"}, [2]string{"(a / p)", "leg"}, [2]string{"square roots of a", "roots"}),
				ntNote("p snaps to the nearest odd prime. In the grid, ", h.Span(h.Class("text-brand"), "brand"), " cells are −1: both primes are 3 mod 4."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT9

func ntPythagBlock() Block {
	return Block{
		Slug:        "pythagorean",
		Title:       "Pythagorean triples",
		Description: "Every primitive solution of a² + b² = c² comes from Euclid's formula a = m² − n², b = 2mn, c = m² + n², with m > n > 0 coprime and of opposite parity; the rest are multiples. Plotted as points (a, b) they fan out along lines through the origin, one line per primitive triple.",
		Tags:        []string{"Euclid's formula", "primitive triples", "lattice points"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-pyth",
				h.Div(h.Class("grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
					ntSvg("0 0 400 400", "Legs (a, b) of every Pythagorean triple up to a limit"),
					ntSvg("0 0 260 260", "The triangle for the chosen m and n", h.Data("tri", ""), h.Class("mx-auto max-w-[260px]")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Euclid's formula"),
					field("m", "m", "", 2, 2, 30, 1),
					field("n", "n", "", 1, 1, 29, 1),
					field("limit", "legs up to", "", 200, 30, 600, 10),
				),
				readouts([2]string{"(a, b, c)", "abc"}, [2]string{"primitive", "prim"}, [2]string{"check", "check"}, [2]string{"triples shown", "count"}, [2]string{"primitive shown", "pcount"}),
				ntNote("Primitive triples are drawn in brand colour, multiples faded. Click a point to load its m and n."),
			)
		},
	}
}

// ---------------------------------------------------------------- NT10

func ntCollatzBlock() Block {
	return Block{
		Slug:        "collatz",
		Title:       "The Collatz problem",
		Description: "Halve an even number, send an odd n to 3n + 1, repeat. Every start ever tried falls to 1, often after wild climbs: 27 takes 111 steps and peaks at 9232. Nobody can prove it always happens. It is an open conjecture, checked by computer for every start below 2⁶⁸ (Barina, 2021); Tao proved in 2019 that almost all orbits get almost bounded.",
		Tags:        []string{"open problem", "orbits", "stopping time"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nt-collatz",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Orbit, log scale"), ntSvg("0 0 640 220", "The orbit of the starting number", h.Data("orbit", ""))),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Steps to reach 1 for every start"),
						h.Div(h.Class("relative"), h.Canvas(h.Data("dots", ""), h.Class("pointer-events-none absolute inset-0 size-full"), h.Aria("hidden", "true")), ntSvg("0 0 640 220", "Total stopping time of every start up to N", h.Data("times", ""), h.Class("relative block w-full select-none")))),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Start"),
					algTextInput("start", "27", "start (any size)"),
					field("N", "scatter up to N", "", 10000, 100, 100000, 100),
					h.Div(h.Class("flex flex-wrap gap-2"), ntButton("next", hugeicons.NextIcon(), "Next record")),
				),
				readouts([2]string{"steps", "steps"}, [2]string{"peak", "peak"}, [2]string{"peak / start", "ratio"}, [2]string{"odd steps", "odd"}, [2]string{"longest ≤ N", "record"}),
				ntNote("Big starts are exact (BigInt). “Next record” jumps to the next start whose orbit is longer than every smaller start's. Click the scatter to load a start."),
			)
		},
	}
}
