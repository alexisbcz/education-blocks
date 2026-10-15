package site

import (
	"fmt"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/tooltip"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// HistoryBlocks lists the history gallery in display order.
func HistoryBlocks() []Block {
	return []Block{
		timelineBlock(),
		lifespansBlock(),
		biographyBlock(),
		primarySourceBlock(),
		transmissionBlock(),
		lineageBlock(),
		chronologyBlock(),
		numeralsBlock(),
	}
}

// Years are signed: -300 is 300 BCE. There is no year 0; the JavaScript
// maps BCE years to astronomical numbering (1 BCE = 0) before placing them.
func yearLabel(y int, circa bool) string {
	c := ""
	if circa {
		c = "c. "
	}
	if y < 0 {
		return fmt.Sprintf("%s%d BCE", c, -y)
	}
	return fmt.Sprintf("%s%d", c, y)
}

// ---------------------------------------------------------------- H1

type event struct {
	year  int
	circa bool
	lane  string // math, physics, bio, world
	title string
	note  string
	link  string // optional: a block elsewhere in the gallery
}

var lanes = [][3]string{
	{"math", "Mathematics", "var(--vec-u)"},
	{"physics", "Physics & astronomy", "var(--ion-k)"},
	{"bio", "Biology & medicine", "var(--ion-cl)"},
	{"world", "World events", "var(--ion-na)"},
}

var events = []event{
	{-1800, true, "math", "Plimpton 322", "A Babylonian clay tablet listing Pythagorean triples, over a thousand years before Pythagoras.", ""},
	{-1550, true, "math", "Rhind Mathematical Papyrus", "Copied by the scribe Ahmes in Egypt: fractions, areas, and an approximation of π close to 3.16.", ""},
	{-400, true, "bio", "Hippocratic Corpus", "Greek medical texts that explain disease by natural causes rather than divine ones.", ""},
	{-300, true, "math", "Euclid's Elements", "Thirteen books building geometry and number theory from definitions, postulates and proofs, in Alexandria.", "#primary-source"},
	{-250, true, "math", "Archimedes bounds π", "Measurement of a Circle traps π between 3 10⁄71 and 3 1⁄7 using 96-sided polygons.", ""},
	{-240, true, "physics", "Eratosthenes measures the Earth", "From the angle of the Sun's rays at Syene and Alexandria, he estimates the Earth's circumference.", ""},
	{150, true, "physics", "Ptolemy's Almagest", "A geocentric model of the heavens that stays the standard astronomy text for some 1,400 years.", ""},
	{476, false, "world", "End of the Western Roman Empire", "The last western emperor, Romulus Augustulus, is deposed.", ""},
	{628, false, "math", "Brahmagupta's rules for zero", "The Brāhmasphuṭasiddhānta treats zero as a number, with rules for arithmetic with it and with negatives.", ""},
	{820, true, "math", "al-Khwarizmi's al-Jabr", "Written in Baghdad; its title gives us the word algebra, and its author's name the word algorithm.", "#transmission"},
	{1021, true, "physics", "Ibn al-Haytham's Book of Optics", "Argues that vision works by light entering the eye, and tests claims by experiment.", ""},
	{1025, false, "bio", "Avicenna's Canon of Medicine", "Ibn Sina's encyclopedia of medicine, used in European universities into the 1600s.", ""},
	{1202, false, "math", "Fibonacci's Liber Abaci", "Introduces Hindu–Arabic numerals to Latin Europe, with the rabbit problem behind the Fibonacci sequence.", "#numerals"},
	{1450, true, "world", "Gutenberg's printing press", "Movable-type printing in Mainz makes books, including science, cheap to copy.", ""},
	{1492, false, "world", "Columbus reaches the Americas", "The first of his voyages for the Crown of Castile.", ""},
	{1543, false, "physics", "Copernicus, De revolutionibus", "Puts the Sun at the centre; published the year he dies.", ""},
	{1543, false, "bio", "Vesalius, De humani corporis fabrica", "Anatomy from dissection, correcting errors inherited from Galen.", ""},
	{1610, false, "physics", "Galileo, Sidereus Nuncius", "Telescope observations: the Moon's mountains and four moons of Jupiter.", "#lifespans"},
	{1628, false, "bio", "Harvey on the circulation of blood", "De motu cordis shows the heart pumps blood around a closed circuit.", ""},
	{1637, false, "math", "Descartes, La Géométrie", "Coordinates join algebra and geometry.", ""},
	{1665, false, "bio", "Hooke's Micrographia", "Microscope drawings; Hooke names the 'cells' he sees in cork.", ""},
	{1687, false, "physics", "Newton's Principia", "The laws of motion and universal gravitation.", "#lifespans"},
	{1789, false, "world", "French Revolution", "Its aftermath brings the metric system, defined in the 1790s.", ""},
	{1859, false, "bio", "Darwin, On the Origin of Species", "Evolution by natural selection.", ""},
	{1865, false, "physics", "Maxwell's equations", "A Dynamical Theory of the Electromagnetic Field: light is an electromagnetic wave.", ""},
	{1866, false, "bio", "Mendel's laws of inheritance", "Experiments on pea plants, published in Brno; ignored until 1900.", ""},
	{1869, false, "physics", "Mendeleev's periodic table", "Arranges the elements by properties, leaving gaps for elements not yet found.", ""},
	{1905, false, "physics", "Einstein's miracle year", "Special relativity, the photoelectric effect and Brownian motion.", ""},
	{1914, false, "world", "First World War begins", "1914–1918.", ""},
	{1915, false, "physics", "General relativity", "Gravity as the curvature of spacetime.", "#lineage"},
	{1918, false, "math", "Noether's theorem", "Every continuous symmetry of a physical system gives a conserved quantity.", "#biography"},
	{1928, false, "bio", "Fleming discovers penicillin", "Mould kills bacteria in a contaminated culture plate.", ""},
	{1931, false, "math", "Gödel's incompleteness theorems", "No consistent formal system rich enough for arithmetic can prove all its truths.", ""},
	{1936, false, "math", "Turing, On Computable Numbers", "Defines the Turing machine and shows some problems can't be decided by any algorithm.", ""},
	{1939, false, "world", "Second World War begins", "1939–1945.", ""},
	{1952, false, "bio", "Hodgkin–Huxley model", "Equations for the action potential from voltage-clamp experiments on the squid giant axon.", "/neuro#action-potential"},
	{1953, false, "bio", "DNA double helix", "Watson and Crick's model, built on X-ray data from Rosalind Franklin and Maurice Wilkins.", ""},
	{1969, false, "world", "Apollo 11 lands on the Moon", "Neil Armstrong and Buzz Aldrin walk on the Moon.", ""},
	{1995, false, "math", "Fermat's Last Theorem proved", "Andrew Wiles's proof, with Richard Taylor, settles a 358-year-old problem.", ""},
	{2003, false, "bio", "Human genome sequenced", "The Human Genome Project declares its work complete.", ""},
	{2012, false, "physics", "Higgs boson discovered", "Announced at CERN after collisions at the Large Hadron Collider.", ""},
	{2015, false, "physics", "Gravitational waves detected", "LIGO records two black holes merging; announced in 2016.", ""},
}

func timelineBlock() Block {
	return Block{
		Slug:        "timeline",
		Title:       "Timeline",
		Description: "Four thousand years in four lanes. Zoom with the buttons, Ctrl/⌘-scroll or a pinch, drag to pan, and step from event to event with the arrow keys. Some events link to the block that teaches them.",
		Tags:        []string{"zoom & pan", "BCE/CE", "kbd"},
		Wide:        true,
		Render:      timeline,
	}
}

func timeline() h.Node {
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("timeline", ""),
		h.Div(h.Class("flex flex-wrap items-center gap-2 border-b px-3 py-2"),
			segs("Period", [2]string{"all", "All"}, [2]string{"ancient", "Antiquity"}, [2]string{"medieval", "500–1500"}, [2]string{"early", "1500–1800"}, [2]string{"modern", "1800–today"}),
			h.Div(h.Class("flex-1")),
			h.Div(h.Class("flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground"),
				h.Map(lanes, func(l [3]string) h.Node {
					return h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full"), h.Style("background:"+l[2])), l[1])
				}),
			),
			h.Div(h.Class("flex gap-1"),
				button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("zoom", "out"), h.Aria("label", "Zoom out"), hugeicons.Remove01Icon()),
				button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"), h.Data("zoom", "in"), h.Aria("label", "Zoom in"), hugeicons.Add01Icon()),
			),
		),
		h.Div(h.Data("stage", ""), h.TabIndex(0), h.Aria("label", "Timeline. Arrow keys move between events, plus and minus zoom."),
			h.Class("relative cursor-grab touch-none bg-code outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset active:cursor-grabbing"),
			h.Svg(h.Data("svg", ""), h.Class("block h-[300px] w-full"), h.Role("img"), h.Aria("hidden", "true")),
		),
		h.Div(h.Data("detail", ""), h.Aria("live", "polite"), h.Class("flex min-h-28 flex-col gap-1.5 border-t p-4 sm:flex-row sm:items-start sm:gap-6"),
			h.Div(h.Class("flex shrink-0 flex-col gap-1 sm:w-40"),
				h.Span(h.Data("d-year", ""), h.Class("font-mono text-2xl font-medium tabular-nums"), "—"),
				h.Span(h.Data("d-lane", ""), h.Class("flex items-center gap-1.5 text-xs text-muted-foreground")),
			),
			h.Div(h.Class("flex flex-col gap-1"),
				h.Span(h.Data("d-title", ""), h.Class("text-base font-semibold tracking-tight"), "Pick an event"),
				h.P(h.Data("d-note", ""), h.Class("max-w-[65ch] text-sm leading-relaxed text-muted-foreground"), "Click a dot, or focus the timeline and use ← and →."),
				h.A(h.Data("d-link", ""), h.Hidden(), h.Href("#"), h.Class("mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-brand underline-offset-4 hover:underline"),
					"Open the block", hugeicons.ArrowRight01Icon(h.Class("size-3.5"))),
			),
		),
		h.Template(h.Data("events", ""), h.MapIdx(events, func(i int, e event) h.Node {
			return h.Div(h.Data("year", fmt.Sprint(e.year)), h.Data("label", yearLabel(e.year, e.circa)), h.Data("lane", e.lane),
				h.Data("title", e.title), h.Data("note", e.note), h.Data("link", e.link))
		})),
		h.Template(h.Data("lanes", ""), h.Map(lanes, func(l [3]string) h.Node {
			return h.Div(h.Data("key", l[0]), h.Data("name", l[1]), h.Data("color", l[2]))
		})),
		// The same events as a list, for screen readers.
		h.Ol(h.Class("sr-only"), h.Map(events, func(e event) h.Node {
			return h.Li(yearLabel(e.year, e.circa), ": ", e.title, ". ", e.note)
		})),
	)
}

// ---------------------------------------------------------------- H2

type life struct {
	name        string
	born, died  int
	field, note string
}

var lives = []life{
	{"Galileo Galilei", 1564, 1642, "physics", "Telescopic astronomy, the law of falling bodies."},
	{"Johannes Kepler", 1571, 1630, "physics", "Elliptical planetary orbits."},
	{"René Descartes", 1596, 1650, "math", "Analytic geometry."},
	{"Blaise Pascal", 1623, 1662, "math", "Probability (with Fermat), the mechanical calculator."},
	{"Christiaan Huygens", 1629, 1695, "physics", "Wave theory of light, the pendulum clock."},
	{"Isaac Newton", 1643, 1727, "physics", "Calculus, the laws of motion, gravitation."},
	{"Gottfried Wilhelm Leibniz", 1646, 1716, "math", "Calculus and its notation."},
	{"Leonhard Euler", 1707, 1783, "math", "Analysis, graph theory, and much of today's notation."},
	{"Joseph-Louis Lagrange", 1736, 1813, "math", "Analytical mechanics."},
	{"Pierre-Simon Laplace", 1749, 1827, "physics", "Celestial mechanics, probability."},
	{"Carl Friedrich Gauss", 1777, 1855, "math", "Number theory, least squares, non-Euclidean geometry (unpublished)."},
	{"Évariste Galois", 1811, 1832, "math", "Group theory and the solvability of equations."},
	{"Ada Lovelace", 1815, 1852, "math", "Notes on Babbage's Analytical Engine, with the first published program."},
	{"Bernhard Riemann", 1826, 1866, "math", "Riemannian geometry, the zeta function."},
}

func lifespansBlock() Block {
	return Block{
		Slug:        "lifespans",
		Title:       "Who was alive when",
		Description: "Lifespans as bars, so overlaps jump out: Galileo died in 1642, the year before Newton was born (by the Gregorian calendar). Move across the chart, or focus it and use ← and →, to list everyone alive in a given year.",
		Tags:        []string{"Gantt", "crosshair", "kbd"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("lifespans", ""),
				h.Div(h.Data("stage", ""), h.TabIndex(0), h.Aria("label", "Lifespans chart. Arrow keys move the year, Shift for ten years."),
					h.Class("scroll-thin overflow-x-auto bg-code p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"),
					h.Svg(h.Data("svg", ""), h.ViewBox(fmt.Sprintf("0 0 760 %d", 40+len(lives)*22)), h.Class("block w-full min-w-[620px] cursor-crosshair touch-pan-x select-none"),
						h.Role("img"), h.Aria("label", "Lifespans of scientists from 1564 to 1866")),
				),
				h.Div(h.Class("flex flex-col gap-1 border-t p-4 sm:flex-row sm:items-baseline sm:gap-4"),
					h.Span(h.Class("shrink-0 text-sm text-muted-foreground"), "Alive in ", h.Span(h.Data("year", ""), h.Class("font-mono text-foreground tabular-nums"), "1650")),
					h.P(h.Data("alive", ""), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed")),
				),
				h.Template(h.Data("lives", ""), h.Map(lives, func(l life) h.Node {
					return h.Div(h.Data("name", l.name), h.Data("born", fmt.Sprint(l.born)), h.Data("died", fmt.Sprint(l.died)), h.Data("field", l.field), h.Data("note", l.note))
				})),
			)
		},
	}
}

// ---------------------------------------------------------------- H3

func biographyBlock() Block {
	return Block{
		Slug:        "biography",
		Title:       "Biography",
		Description: "A life told as dates, places and work, without a portrait to lean on: a short timeline of the person, what they changed, and who they worked alongside.",
		Tags:        []string{"card", "mini timeline", "tooltip"},
		Render:      biography,
	}
}

var noetherLife = [][3]string{
	{"1882", "Born in Erlangen, Bavaria, 23 March.", ""},
	{"1907", "Doctorate at Erlangen under Paul Gordan, on invariant theory.", ""},
	{"1915", "Invited to Göttingen by David Hilbert and Felix Klein. Barred from habilitation as a woman, she lectures under Hilbert's name.", ""},
	{"1918", "Proves Noether's theorem: each continuous symmetry gives a conservation law.", "key"},
	{"1919", "Habilitation at Göttingen; she can finally teach in her own name.", ""},
	{"1921", "Idealtheorie in Ringbereichen: the start of modern abstract algebra (Noetherian rings).", "key"},
	{"1933", "Dismissed under Nazi law as a Jew; moves to Bryn Mawr College, Pennsylvania.", ""},
	{"1935", "Dies in Bryn Mawr, 14 April, after surgery.", ""},
}

func biography() h.Node {
	person := func(name, dates, role string) h.Node {
		return tooltip.Tooltip(
			tooltip.Trigger(lib.AsChild, h.Button(h.Type("button"),
				h.Class("rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 outline-none hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"), name)),
			tooltip.Content(h.Span(h.Class("font-mono"), dates), " · ", role),
		)
	}
	return h.Article(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs"),
		h.Div(h.Class("flex flex-col gap-3 p-5"),
			h.Div(h.Class("flex flex-wrap items-center gap-2"),
				badge.Badge(badge.VariantOutline, h.Class("font-normal"), "Mathematician"),
				h.Span(h.Class("font-mono text-xs text-muted-foreground"), "1882–1935"),
			),
			h.H3(h.Class("text-2xl font-semibold tracking-tight"), "Emmy Noether"),
			h.P(h.Class("text-[15px] leading-relaxed text-pretty text-muted-foreground"),
				"She showed that symmetry and conservation are the same idea, and rebuilt algebra around structures rather than calculations. ",
				"Her theorem is used in every branch of physics; her rings and ideals are in every algebra course."),
			h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-1 text-sm"),
				h.Dt(h.Class("text-muted-foreground"), "Born"), h.Dd("Erlangen, Germany"),
				h.Dt(h.Class("text-muted-foreground"), "Died"), h.Dd("Bryn Mawr, Pennsylvania"),
				h.Dt(h.Class("text-muted-foreground"), "Worked at"), h.Dd("Erlangen, Göttingen, Bryn Mawr"),
			),
		),
		h.Ol(h.Class("relative flex flex-col gap-0 border-t px-5 py-4"),
			h.Map(noetherLife, func(e [3]string) h.Node {
				key := e[2] == "key"
				return h.Li(h.Class("relative grid grid-cols-[3rem_1rem_1fr] gap-x-2 pb-3 last:pb-0"),
					h.Span(h.Class(h.Ternary(key, "font-mono text-sm font-medium text-brand tabular-nums", "font-mono text-sm text-muted-foreground tabular-nums")), e[0]),
					h.Span(h.Class("relative flex justify-center"),
						h.Span(h.Class("absolute top-2 bottom-[-0.75rem] w-px bg-border [li:last-child_&]:hidden")),
						h.Span(h.Class(h.Ternary(key, "relative mt-1.5 size-2.5 rounded-full bg-brand ring-4 ring-brand/15", "relative mt-1.5 size-2 rounded-full border border-foreground/40 bg-background")))),
					h.Span(h.Class(h.Ternary(key, "text-sm leading-relaxed", "text-sm leading-relaxed text-muted-foreground")), e[1]),
				)
			}),
		),
		h.Div(h.Class("flex flex-col gap-2 border-t bg-code-panel px-5 py-4"),
			panelLabel("Worked alongside"),
			h.Div(h.Class("flex flex-wrap gap-1.5"),
				person("David Hilbert", "1862–1943", "brought her to Göttingen"),
				person("Felix Klein", "1849–1925", "co-sponsored her invitation"),
				person("Hermann Weyl", "1885–1955", "Göttingen colleague, later at Princeton"),
				person("Albert Einstein", "1879–1955", "her theorem answered a puzzle in his general relativity"),
				person("Paul Gordan", "1837–1912", "her doctoral advisor"),
			),
		),
	)
}

// ---------------------------------------------------------------- H4

type gloss struct {
	label, text, note string
}

var euclid = []gloss{
	{"Definition 1", "A point is that which has no part.", "Not a dot but a position: no length, no width. Everything else is built from this undefined idea."},
	{"Definition 2", "A line is breadthless length.", "Euclid's 'line' may be curved; he needs a separate definition for straight lines."},
	{"Definition 3", "The extremities of a line are points.", "Lines end in points: the two notions are tied together, not defined independently."},
	{"Definition 4", "A straight line is a line which lies evenly with the points on itself.", "A notoriously vague definition. Modern axioms (Hilbert, 1899) leave 'line' undefined instead."},
	{"Postulate 1", "To draw a straight line from any point to any point.", "A construction you are allowed to make: the ruler. Postulates 1–3 describe straightedge and compass."},
	{"Postulate 5", "That, if a straight line falling on two straight lines make the interior angles on the same side less than two right angles, the two straight lines, if produced indefinitely, meet on that side on which are the angles less than the two right angles.", "The parallel postulate. For two thousand years mathematicians tried to prove it from the others; in the 1820s–30s Lobachevsky and Bolyai showed geometry stays consistent without it."},
}

func primarySourceBlock() Block {
	return Block{
		Slug:        "primary-source",
		Title:       "Primary source",
		Description: "Reading the original, with help. Euclid's opening definitions and two postulates in Heath's 1908 translation; hover or focus a passage for a gloss. The fifth postulate leads to the lineage block below.",
		Tags:        []string{"glosses", "hover sync", "public domain"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("source", ""),
				h.Figure(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs"),
					h.Figcaption(h.Class("flex flex-wrap items-center gap-2 border-b bg-code-panel px-4 py-2.5 text-[13px]"),
						hugeicons.Book02Icon(h.Class("size-4 text-muted-foreground")),
						h.Span(h.Class("font-medium"), "Euclid, Elements, Book I"),
						h.Span(h.Class("text-muted-foreground"), "c. 300 BCE · tr. T. L. Heath, 1908"),
					),
					h.Ol(h.Class("flex flex-col p-2"),
						h.MapIdx(euclid, func(i int, g gloss) h.Node {
							return h.Li(h.Data("passage", fmt.Sprint(i)), h.TabIndex(0),
								h.Class("flex cursor-default flex-col gap-0.5 rounded-lg px-3 py-2.5 outline-none transition-colors duration-100 data-[lit]:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"),
								h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), g.label),
								h.Span(h.Class("font-serif text-[17px] leading-relaxed text-pretty"), g.text),
							)
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("sticky top-20 flex flex-col gap-2 rounded-xl border bg-background p-4"),
						panelLabel("Gloss"),
						h.Span(h.Data("g-label", ""), h.Class("text-sm font-medium"), "Hover a passage"),
						h.P(h.Data("g-note", ""), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground"),
							"Each line of the text has a short commentary: what it means, and why it mattered later."),
					),
					h.Template(h.Data("glosses", ""), h.Map(euclid, func(g gloss) h.Node { return h.Div(h.Data("label", g.label), h.Data("note", g.note)) })),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- H5

type place struct {
	key, name string
	lon, lat  float64
}

var places = []place{
	{"athens", "Athens", 23.7, 38.0},
	{"alexandria", "Alexandria", 29.9, 31.2},
	{"constantinople", "Constantinople", 29.0, 41.0},
	{"baghdad", "Baghdad", 44.4, 33.3},
	{"toledo", "Toledo", -4.0, 39.9},
	{"venice", "Venice", 12.3, 45.4},
}

type leg struct {
	from, to, date, text string
}

var euclidRoute = []leg{
	{"", "alexandria", "c. 300 BCE", "Euclid compiles the Elements in Alexandria, drawing on earlier Greek work from Athens and elsewhere."},
	{"alexandria", "constantinople", "888", "Greek copies survive in the Byzantine Empire. The oldest complete manuscript was copied in Constantinople in 888 and is now in Oxford."},
	{"alexandria", "baghdad", "c. 800", "In Abbasid Baghdad, al-Hajjaj ibn Yusuf translates the Elements into Arabic; later revisions by Ishaq ibn Hunayn and Thabit ibn Qurra follow in the 9th century."},
	{"baghdad", "toledo", "12th century", "Arabic texts reach Spain. Adelard of Bath translates the Elements into Latin around 1120, and Gerard of Cremona translates it again in Toledo."},
	{"toledo", "venice", "1482", "Erhard Ratdolt prints the first edition of the Elements in Venice, from Campanus's Latin version."},
}

func transmissionBlock() Block {
	return Block{
		Slug:        "transmission",
		Title:       "How a book travelled",
		Description: "The Elements reached modern Europe the long way: from Greek to Arabic to Latin to print. Step through the route on a schematic map: cities sit at their real longitude and latitude, coastlines are left out.",
		Tags:        []string{"map", "stepper", "projection"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("route",
				h.Svg(h.Data("svg", ""), h.ViewBox("0 0 640 330"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Schematic map of the Mediterranean and the Near East with the route of the Elements")),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Span(h.Data("r-date", ""), h.Class("font-mono text-2xl font-medium"), "—"),
					h.P(h.Data("r-text", ""), h.Aria("live", "polite"), h.Class("min-h-32 text-sm leading-relaxed text-pretty text-muted-foreground")),
				),
				h.Div(h.Class("flex items-center justify-between gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
					h.Span(h.Data("r-count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
				),
				h.Template(h.Data("places", ""), h.Map(places, func(p place) h.Node {
					return h.Div(h.Data("key", p.key), h.Data("name", p.name), h.Data("lon", fmt.Sprint(p.lon)), h.Data("lat", fmt.Sprint(p.lat)))
				})),
				h.Template(h.Data("legs", ""), h.Map(euclidRoute, func(l leg) h.Node {
					return h.Div(h.Data("from", l.from), h.Data("to", l.to), h.Data("date", l.date), h.Data("text", l.text))
				})),
			)
		},
	}
}

// ---------------------------------------------------------------- H6

type idea struct {
	key, title, date, text string
	x, y                   int
	parents                []string
}

var ideas = []idea{
	{"p5", "Parallel postulate", "c. 300 BCE", "Euclid's fifth postulate, stated but never proved.", 80, 150, nil},
	{"sacc", "Saccheri's attempt", "1733", "Tries to prove the postulate by contradiction; derives strange but consistent results and rejects them.", 230, 80, []string{"p5"}},
	{"gauss", "Gauss's private notes", "c. 1820s", "Becomes convinced a non-Euclidean geometry is possible, but does not publish.", 230, 220, []string{"p5"}},
	{"lob", "Non-Euclidean geometry", "1829–1832", "Lobachevsky (1829) and Bolyai (1832) publish geometries where the postulate fails.", 380, 150, []string{"sacc", "gauss"}},
	{"riem", "Riemann's lecture", "1854", "On the hypotheses which lie at the foundations of geometry: curved spaces of any dimension. Gauss, his teacher, chose the topic.", 530, 150, []string{"lob"}},
	{"ricci", "Tensor calculus", "1900", "Ricci-Curbastro and Levi-Civita give the tools to do calculus on curved spaces.", 680, 80, []string{"riem"}},
	{"mink", "Minkowski spacetime", "1908", "Special relativity recast as the geometry of a four-dimensional spacetime.", 680, 220, nil},
	{"gr", "General relativity", "1915", "Einstein: gravity is the curvature of spacetime, written in Riemann's geometry with tensor calculus.", 830, 150, []string{"ricci", "mink", "riem"}},
}

func lineageBlock() Block {
	return Block{
		Slug:        "lineage",
		Title:       "Lineage of an idea",
		Description: "From a doubtful postulate to the shape of spacetime: a small graph of ideas where each one made the next possible. Pick a node to light up everything it rests on.",
		Tags:        []string{"DAG", "ancestors", "kbd"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("lineage", ""),
				h.Div(h.Class("scroll-thin overflow-x-auto bg-code"),
					h.Svg(h.Data("svg", ""), h.ViewBox("0 0 910 300"), h.Class("block w-full min-w-[680px]"), h.Role("group"), h.Aria("label", "Graph of ideas")),
				),
				h.Div(h.Class("flex min-h-24 flex-col gap-1 border-t p-4"),
					h.Div(h.Class("flex items-baseline gap-3"),
						h.Span(h.Data("i-title", ""), h.Class("text-base font-semibold tracking-tight"), "General relativity"),
						h.Span(h.Data("i-date", ""), h.Class("font-mono text-xs text-muted-foreground"), "1915"),
					),
					h.P(h.Data("i-text", ""), h.Aria("live", "polite"), h.Class("max-w-[70ch] text-sm leading-relaxed text-muted-foreground")),
				),
				h.Template(h.Data("ideas", ""), h.Map(ideas, func(i idea) h.Node {
					ps := ""
					for k, p := range i.parents {
						if k > 0 {
							ps += " "
						}
						ps += p
					}
					return h.Div(h.Data("key", i.key), h.Data("title", i.title), h.Data("date", i.date), h.Data("text", i.text),
						h.Data("x", fmt.Sprint(i.x)), h.Data("y", fmt.Sprint(i.y)), h.Data("parents", ps))
				})),
			)
		},
	}
}

// ---------------------------------------------------------------- H7

var orderEvents = []event{
	{1202, false, "math", "Fibonacci's Liber Abaci", "", ""},
	{1543, false, "physics", "Copernicus's De revolutionibus", "", ""},
	{1628, false, "bio", "Harvey's De motu cordis", "", ""},
	{1637, false, "math", "Descartes's La Géométrie", "", ""},
	{1665, false, "bio", "Hooke's Micrographia", "", ""},
}

func chronologyBlock() Block {
	return Block{
		Slug:        "chronology",
		Title:       "Put them in order",
		Description: "A chronology exercise. Move the five books into the order they were published, with the arrows or Alt+↑/↓ on a focused row, then check: each row says whether it is in place and reveals its date.",
		Tags:        []string{"reorder", "kbd", "feedback"},
		Render: func() h.Node {
			// A fixed starting shuffle, so the server render and the
			// exercise agree.
			order := []int{3, 0, 4, 1, 2}
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("chronology", ""),
				h.P(h.Class("text-base font-medium"), "Oldest at the top."),
				h.Ol(h.Data("list", ""), h.Class("flex flex-col gap-1.5"),
					h.Map(order, func(k int) h.Node {
						e := orderEvents[k]
						return h.Li(h.Data("item", ""), h.Data("year", fmt.Sprint(e.year)), h.TabIndex(0),
							h.Class("group flex items-center gap-3 rounded-lg border bg-background px-3 py-2 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add/60 data-[state=wrong]:border-del/60"),
							h.Span(h.Data("pos", ""), h.Class("w-4 font-mono text-xs text-muted-foreground tabular-nums")),
							h.Span(h.Class("flex-1 text-sm"), e.title),
							h.Span(h.Data("reveal", ""), h.Hidden(), h.Class("font-mono text-xs tabular-nums group-data-[state=right]:text-add group-data-[state=wrong]:text-del"), fmt.Sprint(e.year)),
							h.Span(h.Class("flex gap-1"),
								button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-7"), h.Type("button"), h.Data("move", "-1"), h.Aria("label", "Move up"), h.TabIndex(-1), hugeicons.ArrowUp01Icon()),
								button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-7"), h.Type("button"), h.Data("move", "1"), h.Aria("label", "Move down"), h.TabIndex(-1), hugeicons.ArrowDown01Icon()),
							),
						)
					}),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
					h.P(h.Data("feedback", ""), h.Aria("live", "polite"), h.Class("flex items-center gap-1.5 text-xs text-muted-foreground"),
						"Focus a row, then", kbd.Group(kbd.Kbd("Alt"), kbd.Kbd("↑")), "or", kbd.Group(kbd.Kbd("Alt"), kbd.Kbd("↓"))),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "shuffle"), h.Class("text-muted-foreground"), hugeicons.ShuffleIcon(), "Shuffle"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "check"), "Check order"),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- H8

func numeralsBlock() Block {
	return Block{
		Slug:        "numerals",
		Title:       "Number systems",
		Description: "One number, four ways of writing it. Roman numerals add symbols; Babylonian (base 60) and Maya (base 20) numerals are positional like ours, but neither wrote digits as we do. Type a number from 1 to 3999.",
		Tags:        []string{"converter", "base 60", "base 20"},
		Wide:        true,
		Render: func() h.Node {
			card := func(key, title, sub string, body h.Node) h.Node {
				return h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), title),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), sub)),
					h.Div(h.Data("sys", key), h.Class("flex min-h-28 flex-1 items-center justify-center"), body),
					h.P(h.Data("explain", key), h.Class("min-h-8 font-mono text-[11px] leading-relaxed text-muted-foreground")),
				)
			}
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("numerals", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					h.Label(h.For("num-in"), h.Class("text-sm text-muted-foreground"), "Number"),
					h.Input(h.ID("num-in"), h.Type("text"), h.Attr("inputmode", "numeric"), h.Value("1482"), h.Data("input", ""), h.Attr("autocomplete", "off"),
						h.Class("h-10 w-28 rounded-md border border-input bg-background px-3 font-mono text-base tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-del")),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([][2]string{{"1482", "First printed Euclid"}, {"60", "60"}, {"400", "400"}, {"3999", "3999"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("set", p[0]), h.Class("font-normal"), p[1])
						}),
					),
					h.Span(h.Data("error", ""), h.Class("text-xs text-del")),
				),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2 lg:grid-cols-4"),
					card("arabic", "Hindu–Arabic", "base 10", h.Span(h.Class("font-mono text-4xl tabular-nums"), "1482")),
					card("roman", "Roman", "additive", h.Span(h.Class("font-serif text-3xl tracking-wide"), "MCDLXXXII")),
					card("babylonian", "Babylonian", "base 60", h.Svg(h.Class("h-24 w-full"))),
					card("maya", "Maya", "base 20", h.Svg(h.Class("h-28 w-full"))),
				),
			)
		},
	}
}
