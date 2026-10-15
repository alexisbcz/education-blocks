package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// pStepButton is a Back/Next button for the steppers (static/js/paleo.js).
func pStepButton(dir, label string) h.Node {
	icon := hugeicons.ArrowRight01Icon()
	if dir == "-1" {
		return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", dir), h.Disabled(), hugeicons.ArrowLeft01Icon(), label)
	}
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", dir), label, icon)
}

// ---------------------------------------------------------------- P4

func paleoBipedalBlock() Block {
	return Block{
		Slug:        "bipedalism",
		Title:       "Built for walking upright",
		Description: "Four places in the skeleton where walking on two legs leaves its mark, compared across a chimpanzee, Australopithecus afarensis and us. Drawings are schematic; pick a feature to read what it means and how it is measured.",
		Tags:        []string{"comparison", "parts picker", "schematic"},
		Wide:        true,
		Render:      paleoBipedal,
	}
}

type pFeature struct {
	key, name, why string
	cells          [3]string // chimpanzee, afarensis, human
}

var pFeatures = []pFeature{
	{"foramen", "Foramen magnum", "The hole where the spinal cord leaves the skull. Under a skull carried on a vertical spine it sits centrally; in a quadruped it sits further back. Its position is one of the few clues to posture a skull alone can give, which is why it is argued over for Sahelanthropus.",
		[3]string{"set back", "further forward", "centred"}},
	{"pelvis", "Pelvis", "Short, wide iliac blades turned to the side let the hip muscles (gluteus medius and minimus) stop the body tipping over the standing leg at each step. Chimpanzees have tall, flat blades facing backwards; afarensis (Lucy, AL 288-1) already has short, flaring ones.",
		[3]string{"tall, narrow", "short, flaring", "short, bowl-shaped"}},
	{"femur", "Femur (knee angle)", "The bicondylar angle tilts the thigh bone inwards so the knees sit under the body's centre of mass. It develops in children only as they learn to walk. Afarensis femora show a high angle, ours a moderate one, chimpanzees almost none.",
		[3]string{"≈ 0–2°", "high, ≈ 9–15°", "≈ 8–11°"}},
	{"toe", "Big toe", "A grasping, divergent big toe holds branches; an aligned one pushes off the ground in each stride. The Laetoli footprints (≈3.66 Ma) show an aligned big toe; how mobile afarensis's toe still was is debated.",
		[3]string{"divergent, grasping", "aligned (Laetoli prints)", "aligned, non-grasping"}},
}

// Schematic drawings, one per feature and species, in a 120×90 box.
func pFeatureSVG(key string, sp int) h.Node {
	ink := "stroke:var(--part);fill:color-mix(in oklab, var(--part) 10%, transparent);stroke-width:1.5;stroke-linejoin:round"
	acc := "fill:var(--brand)"
	var shapes []h.Node
	switch key {
	case "foramen": // skull from below; front at the top
		fy := []float64{66, 56, 47}[sp]
		shapes = append(shapes,
			h.El("ellipse", h.Attr("cx", "60"), h.Attr("cy", "50"), h.Attr("rx", "28"), h.Attr("ry", "36"), h.Attr("style", ink)),
			h.El("ellipse", h.Attr("cx", "60"), h.Attr("cy", pf(fy+5)), h.Attr("rx", "6"), h.Attr("ry", "8"), h.Attr("style", acc)),
			pText(60, 9, "face ↑", h.Attr("text-anchor", "middle"), h.Class("fill-muted-foreground text-[8px]")),
		)
	case "pelvis": // front view
		paths := []string{
			"M44 8 L52 52 L60 60 L68 52 L76 8 L70 8 L64 46 L56 46 L50 8 Z",
			"M18 26 C24 18 46 22 52 40 L60 56 L68 40 C74 22 96 18 102 26 C96 40 80 48 72 62 L48 62 C40 48 24 40 18 26 Z",
			"M26 18 C34 10 50 18 54 36 L60 52 L66 36 C70 18 86 10 94 18 C96 34 84 48 74 62 L46 62 C36 48 24 34 26 18 Z",
		}
		shapes = append(shapes, h.El("path", h.Attr("d", paths[sp]), h.Attr("style", ink)))
	case "femur": // knee angle from the front
		deg := []float64{1, 13, 9}[sp]
		shapes = append(shapes,
			pLine(60, 6, 60, 84, "stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:3 3"),
			h.El("g", h.Attr("transform", fmt.Sprintf("rotate(%.1f 60 80)", deg)),
				h.El("path", h.Attr("d", "M55 14 L65 14 L64 74 L68 80 L52 80 L56 74 Z"), h.Attr("style", ink)),
				h.El("circle", h.Attr("cx", "56"), h.Attr("cy", "12"), h.Attr("r", "6"), h.Attr("style", ink)),
			),
			pText(70, 30, fmt.Sprintf("%.0f°", deg), h.Class("fill-[var(--brand)] text-[9px]")),
		)
	case "toe": // foot from above, toes at the top
		toe := []string{"M34 34 l-14 -14 l6 -6 l14 14 Z", "M42 26 l-3 -16 l8 -1 l3 16 Z", "M42 26 l-2 -16 l8 -1 l2 16 Z"}[sp]
		shapes = append(shapes,
			h.El("path", h.Attr("d", "M40 26 C40 18 76 18 78 26 L80 66 C80 82 44 84 42 66 Z"), h.Attr("style", ink)),
			h.El("path", h.Attr("d", toe), h.Attr("style", "fill:var(--brand);stroke:var(--brand);stroke-width:1;stroke-linejoin:round")),
			h.Map([]float64{56, 63, 70, 76}, func(x float64) h.Node {
				return h.El("ellipse", h.Attr("cx", pf(x)), h.Attr("cy", "18"), h.Attr("rx", "3"), h.Attr("ry", "5"), h.Attr("style", ink))
			}),
		)
	}
	return h.Svg(h.ViewBox("0 0 120 90"), h.Class("mx-auto block h-20 w-auto [--part:color-mix(in_oklab,var(--foreground)_60%,transparent)]"), h.Aria("hidden", "true"), h.Group(shapes))
}

func paleoBipedal() h.Node {
	species := []string{"Chimpanzee", "Au. afarensis", "Homo sapiens"}
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("paleo-parts", ""),
		h.Div(h.Class("scroll-thin min-w-0 overflow-x-auto border-b bg-code lg:border-r lg:border-b-0"),
			h.Div(h.Class("grid min-w-[520px] grid-cols-[130px_repeat(3,minmax(0,1fr))]"),
				h.Span(),
				h.Map(species, func(s string) h.Node {
					return h.Span(h.Class("border-b px-2 py-2.5 text-center text-xs font-medium"), s)
				}),
				h.Map(pFeatures, func(f pFeature) h.Node {
					return h.Button(h.Type("button"), h.Data("part", f.key), h.Data("name", f.name), h.Data("why", f.why),
						h.Class("group col-span-4 grid grid-cols-subgrid border-b text-left outline-none transition-colors duration-150 last:border-b-0 hover:bg-accent/40 focus-visible:bg-accent/60 data-[on]:bg-brand/8"),
						h.Span(h.Class("flex items-center px-3 text-sm font-medium group-data-[on]:text-brand"), f.name),
						h.MapIdx(f.cells[:], func(i int, c string) h.Node {
							return h.Span(h.Class("flex flex-col items-center gap-1 px-2 py-3"),
								pFeatureSVG(f.key, i),
								h.Span(h.Class("text-center text-[11px] text-muted-foreground"), c))
						}),
					)
				}),
			),
		),
		h.Div(h.Class("flex flex-col gap-3 p-5"),
			panelLabel("Feature"),
			h.P(h.Data("out", "name"), h.Class("text-base font-semibold tracking-tight"), "Pick a feature"),
			h.P(h.Data("out", "why"), h.Class("text-sm leading-relaxed text-muted-foreground"), "Each row compares the same part of the skeleton in the three species. The pink mark is the part to look at."),
		),
	)
}

// ---------------------------------------------------------------- P5

func paleoDatingBlock() Block {
	return Block{
		Slug:        "dating-methods",
		Title:       "How fossils get their dates",
		Description: "No single clock covers seven million years. Each method works over its own window, on its own material; fossils are often dated indirectly, by the volcanic layers above and below them. Then try it: pick the right method for four finds.",
		Tags:        []string{"log scale", "exercise", "methods"},
		Wide:        true,
		Render:      paleoDating,
	}
}

type pMethod struct {
	name, material string
	from, to       float64 // years ago
	note           string
}

var pMethods = []pMethod{
	{"Radiocarbon (¹⁴C)", "bone collagen, charcoal, shell", 300, 50e3, "Half-life ≈5,730 years; too little ¹⁴C is left beyond ≈50 ka."},
	{"Luminescence (OSL/TL)", "buried sediment grains, burnt flint", 100, 500e3, "When the grains last saw light or heat; upper limit depends on the site."},
	{"U-series (U–Th)", "cave flowstone, coral, bone, teeth", 1e3, 500e3, "Uranium decays into thorium in carbonate crusts above or below fossils."},
	{"ESR", "tooth enamel", 10e3, 2e6, "Radiation damage accumulated in enamel crystals; often paired with U-series."},
	{"Cosmogenic burial (²⁶Al/¹⁰Be)", "quartz in buried sediment", 100e3, 5e6, "Used for the “Little Foot” skeleton at Sterkfontein."},
	{"⁴⁰Ar/³⁹Ar, K–Ar", "volcanic ash and lava", 10e3, 1e7, "Dates eruptions, so a fossil between two ash layers is bracketed. Reaches billions of years."},
	{"Paleomagnetism", "sediments, lava", 10e3, 1e7, "Matches reversals of Earth's field to the dated timescale, e.g. the Brunhes–Matuyama reversal ≈773 ka. Relative, not absolute."},
}

type pScenario struct {
	text, answer, why string
}

var pScenarios = []pScenario{
	{"Charcoal from a hearth, thought to be ≈30,000 years old.", "c14", "Organic carbon within the ≈50 ka window: radiocarbon."},
	{"A hominin jaw in East Africa, between two volcanic ash layers, ≈2 Ma.", "ar", "Date the eruptions above and below: ⁴⁰Ar/³⁹Ar on the ash brackets the fossil."},
	{"A Neanderthal tooth in a cave, ≈120,000 years old, no organic carbon left.", "esr", "Too old for radiocarbon; tooth enamel can be dated by ESR, usually combined with U-series."},
	{"Stone tools in cave sediments, ≈70,000 years old, no bone and no ash.", "osl", "Date when the sediment grains were last exposed to light: luminescence."},
}

func paleoDating() h.Node {
	s := pScale{log: true, old: 1e7, young: 10, left: 210, width: 410}
	const rowH, top = 30.0, 10.0
	bottom := top + rowH*float64(len(pMethods))
	tick := []float64{1e7, 1e6, 1e5, 1e4, 1e3, 1e2, 10}
	yearsLabel := map[float64]string{1e7: "10 Ma", 1e6: "1 Ma", 1e5: "100 ka", 1e4: "10 ka", 1e3: "1 ka", 1e2: "100 y", 10: "10 y"}
	options := [][2]string{{"c14", "Radiocarbon"}, {"osl", "Luminescence"}, {"esr", "ESR / U-series"}, {"ar", "⁴⁰Ar/³⁹Ar"}}
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"),
		h.Div(h.Class("scroll-thin overflow-x-auto border-b bg-code p-3"),
			h.Svg(h.ViewBox(fmt.Sprintf("0 0 640 %.0f", bottom+26)), h.Class("mx-auto block w-full max-w-[760px] min-w-[560px]"), h.Role("img"), h.Aria("label", "Age ranges of dating methods"),
				h.Map(tick, func(t float64) h.Node {
					x := s.x(t)
					return h.Group(pLine(x, top, x, bottom, "stroke:currentColor;stroke-opacity:0.08"), pText(x, bottom+14, yearsLabel[t], h.Attr("text-anchor", "middle")))
				}),
				h.MapIdx(pMethods, func(i int, m pMethod) h.Node {
					y := top + float64(i)*rowH
					x0, x1 := s.x(m.to), s.x(m.from)
					return h.El("g", h.El("title", m.note),
						pText(4, y+12, m.name, h.Class("fill-foreground text-[11px]"), h.Attr("style", "font-family:var(--font-sans)")),
						pText(4, y+24, m.material, h.Class("fill-muted-foreground text-[9px]")),
						pRect(x0, y+8, x1-x0, 12, "fill:var(--vec-u);fill-opacity:0.7", h.Attr("rx", "6")),
					)
				}),
			),
		),
		h.Form(h.Class("flex flex-col gap-4 p-4 sm:p-5"), h.Data("paleo-exercise", ""), h.Action("#"),
			h.Div(h.Class("flex items-center justify-between gap-3"),
				h.Span(h.Class("text-sm font-medium"), "Date these finds"),
				h.Span(h.Data("out", "score"), h.Class("font-mono text-xs text-muted-foreground")),
			),
			h.MapIdx(pScenarios, func(i int, sc pScenario) h.Node {
				return h.Fieldset(h.Data("scenario", ""), h.Data("answer", sc.answer), h.Data("why", sc.why),
					h.Class("flex flex-col gap-2 rounded-lg border p-3 transition-colors duration-150 data-[state=right]:border-add/50 data-[state=wrong]:border-del/50"),
					// A floated legend flows inside the box instead of on its border.
					h.Legend(h.Class("float-left mb-1 w-full text-sm"), h.Span(h.Class("mr-2 font-mono text-xs text-muted-foreground"), fmt.Sprintf("%d.", i+1)), sc.text),
					h.Div(h.Class("clear-both flex flex-wrap gap-1.5"),
						h.Map(options, func(o [2]string) h.Node {
							id := fmt.Sprintf("pd-%d-%s", i, o[0])
							return h.Label(h.For(id), h.Class("cursor-pointer rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground has-checked:border-ring has-checked:text-foreground has-checked:ring-[3px] has-checked:ring-ring/50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"),
								h.Input(h.Type("radio"), h.ID(id), h.Name(fmt.Sprintf("pd-%d", i)), h.Value(o[0]), h.Class("sr-only")), o[1])
						})),
					h.P(h.Data("feedback", ""), h.Class("text-xs leading-relaxed text-muted-foreground empty:hidden")),
				)
			}),
			h.Div(h.Class("flex justify-end"), button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), "Check")),
		),
	)
}

// ---------------------------------------------------------------- P6

func paleoTreeBlock() Block {
	return Block{
		Slug:        "phylogeny",
		Title:       "Reading a family tree",
		Description: "A deliberately simplified hominin cladogram, one hypothesis among several. Click a branching point to light up everything that descends from it: that is a clade. Then answer three questions about what the tree does, and does not, say.",
		Tags:        []string{"cladogram", "clades", "quiz"},
		Wide:        true,
		Render:      paleoTree,
	}
}

// pClade is a node of the cladogram; tips have a name and no children.
type pClade struct {
	id, name string
	kids     []*pClade
}

var pTreeRoot = &pClade{id: "n0", kids: []*pClade{
	{name: "Chimpanzees (Pan)"},
	{id: "n1", kids: []*pClade{
		{name: "Ardipithecus"},
		{id: "n2", kids: []*pClade{
			{name: "Au. afarensis"},
			{id: "n3", kids: []*pClade{
				{name: "Paranthropus"},
				{id: "n4", kids: []*pClade{
					{name: "H. erectus"},
					{id: "n5", kids: []*pClade{
						{name: "H. sapiens"},
						{id: "n6", kids: []*pClade{{name: "Neanderthals"}, {name: "Denisovans"}}},
					}},
				}},
			}},
		}},
	}},
}}

var pCladeNames = map[string]string{
	"n0": "Hominins and chimpanzees", "n1": "Hominins", "n2": "Australopiths and later",
	"n3": "Paranthropus + Homo (one hypothesis)", "n4": "Homo", "n5": "Sapiens, Neanderthals, Denisovans", "n6": "Neanderthals + Denisovans",
}

func paleoTreeSVG() h.Node {
	var nodes []h.Node
	tipY := 24.0
	const tipX, step = 470.0, 66.0
	var walk func(c *pClade, depth int, anc []string) (float64, float64)
	walk = func(c *pClade, depth int, anc []string) (float64, float64) {
		in := strings.Join(anc, " ")
		if c.kids == nil {
			y := tipY
			tipY += 30
			nodes = append(nodes, pText(tipX+8, y+4, c.name, h.Data("in", in), h.Class("fill-foreground text-[11px] transition-colors duration-150 data-[on]:fill-[var(--brand)]"), h.Attr("style", "font-family:var(--font-sans)")))
			return tipX, y
		}
		x := 40 + float64(depth)*step
		mine := append(append([]string{}, anc...), c.id)
		var ys []float64
		for _, k := range c.kids {
			kx, ky := walk(k, depth+1, mine)
			ys = append(ys, ky)
			nodes = append(nodes, pLine(x, ky, kx, ky, "stroke-width:1.75", h.Data("in", strings.Join(mine, " ")), h.Class("stroke-[color-mix(in_oklab,var(--foreground)_45%,transparent)] transition-colors duration-150 data-[on]:stroke-[var(--brand)]")))
		}
		y := (ys[0] + ys[len(ys)-1]) / 2
		nodes = append(nodes, pLine(x, ys[0], x, ys[len(ys)-1], "stroke-width:1.75", h.Data("in", strings.Join(mine, " ")), h.Class("stroke-[color-mix(in_oklab,var(--foreground)_45%,transparent)] transition-colors duration-150 data-[on]:stroke-[var(--brand)]")))
		nodes = append(nodes, h.El("circle", h.Data("node", c.id), h.Data("label", pCladeNames[c.id]), h.TabIndex(0), h.Role("button"), h.Aria("label", "Clade: "+pCladeNames[c.id]),
			h.Attr("cx", pf(x)), h.Attr("cy", pf(y)), h.Attr("r", "6"),
			h.Class("cursor-pointer fill-[var(--background)] stroke-[var(--foreground)] outline-none [stroke-width:1.5] hover:stroke-[var(--brand)] focus-visible:stroke-[var(--brand)] focus-visible:[stroke-width:3] data-[on]:fill-[var(--brand)] data-[on]:stroke-[var(--brand)]")))
		return x, y
	}
	walk(pTreeRoot, 0, nil)
	// Root stem.
	nodes = append([]h.Node{pLine(14, 0, 40, 0, "")}, nodes...)
	return h.Svg(h.ViewBox(fmt.Sprintf("0 0 600 %.0f", tipY)), h.Class("block w-full min-w-[520px] select-none"), h.Role("group"), h.Aria("label", "Simplified hominin cladogram"), h.Group(nodes))
}

type pQuestion struct {
	q       string
	options []string
	answer  int
	why     string
}

var pQuestions = []pQuestion{
	{"In this tree, what is the sister group of the Neanderthals?", []string{"H. sapiens", "Denisovans", "H. erectus"}, 1, "They share a branching point that no other group shares."},
	{"Are we more closely related to Neanderthals or to H. erectus?", []string{"Neanderthals", "H. erectus", "Equally"}, 0, "Our last common ancestor with Neanderthals is more recent than the one with H. erectus."},
	{"Does the tree say H. sapiens descends from Neanderthals?", []string{"Yes", "No"}, 1, "Tips are cousins, not ancestors: the tree shows shared ancestry, never one tip descending from another."},
}

func paleoTree() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_320px]"), h.Data("paleo-tree", ""),
		h.Div(h.Class("flex min-w-0 flex-col gap-2 border-b bg-code p-4 lg:border-r lg:border-b-0"),
			h.Div(h.Class("scroll-thin overflow-x-auto"), paleoTreeSVG()),
			h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
				h.P(h.Data("out", "clade"), h.Class("text-sm text-muted-foreground"), "Click a branching point."),
				badge.Badge(badge.VariantOutline, h.Class("font-normal text-muted-foreground"), "One of several hypotheses"),
			),
		),
		h.Form(h.Class("flex flex-col gap-4 p-5"), h.Data("paleo-quiz", ""), h.Action("#"),
			panelLabel("Check your reading"),
			h.MapIdx(pQuestions, func(i int, q pQuestion) h.Node {
				return h.Fieldset(h.Data("question", ""), h.Data("answer", fmt.Sprint(q.answer)), h.Data("why", q.why), h.Class("flex flex-col gap-2"),
					h.Legend(h.Class("mb-1 text-sm"), q.q),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.MapIdx(q.options, func(j int, o string) h.Node {
							id := fmt.Sprintf("pq-%d-%d", i, j)
							return h.Label(h.For(id), h.Class("cursor-pointer rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground has-checked:border-ring has-checked:text-foreground has-checked:ring-[3px] has-checked:ring-ring/50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"),
								h.Input(h.Type("radio"), h.ID(id), h.Name(fmt.Sprintf("pq-%d", i)), h.Value(fmt.Sprint(j)), h.Class("sr-only")), o)
						})),
					h.P(h.Data("feedback", ""), h.Class("text-xs leading-relaxed empty:hidden")),
				)
			}),
			h.Div(h.Class("flex items-center justify-between gap-2 border-t pt-4"),
				h.Span(h.Data("out", "score"), h.Class("font-mono text-xs text-muted-foreground")),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("submit"), "Check")),
		),
	)
}

// ---------------------------------------------------------------- P7

func paleoToolsBlock() Block {
	return Block{
		Slug:        "stone-tools",
		Title:       "Stone tool technologies",
		Description: "Three million years of making edges, from the first struck flakes to blades and art. The timeline places each industry; the stepper shows the gesture underneath all of them: striking a flake off a core.",
		Tags:        []string{"timeline", "stepper", "knapping"},
		Wide:        true,
		Render:      paleoTools,
	}
}

type pIndustry struct {
	name       string
	start, end float64 // Ma
	who, what  string
}

var pIndustries = []pIndustry{
	{"Lomekwian", 3.35, 3.25, "unknown (Kenyanthropus? Australopithecus?)", "Large, crude flakes from one site, Lomekwi 3, Kenya. Whether it is a distinct industry is debated."},
	{"Oldowan", 2.6, 1.7, "early Homo, possibly Paranthropus", "Simple flakes and cores; persists later in places."},
	{"Acheulean", 1.76, 0.13, "H. erectus, later H. heidelbergensis", "Symmetric bifacial handaxes, shaped on both faces; earliest at Kokiselei, Kenya, ≈1.76 Ma."},
	{"Middle Paleolithic / MSA", 0.3, 0.04, "Neanderthals (Mousterian), early H. sapiens", "Prepared-core (Levallois) flakes of planned shape; hafted points."},
	{"Upper Paleolithic / LSA", 0.05, 0.012, "H. sapiens", "Long blades, bone and antler tools, ornaments, cave art."},
}

type pKnap struct{ title, body, svg string }

var pKnapSteps = []pKnap{
	{"Choose a core and a hammerstone", "A fine-grained, brittle stone (flint, obsidian, quartzite) as the core, and a rounded cobble as the hammer.",
		`<ellipse cx="78" cy="62" rx="34" ry="24" style="fill:color-mix(in oklab,var(--foreground) 10%,transparent);stroke:var(--foreground);stroke-width:1.5"/><circle cx="150" cy="28" r="14" style="fill:color-mix(in oklab,var(--vec-out) 25%,transparent);stroke:var(--vec-out);stroke-width:1.5"/>`},
	{"Strike near an edge", "Hit the platform at an angle under 90°, close to the edge. The blow sends a cone of force into the stone: conchoidal fracture.",
		`<path d="M44 62 C44 40 112 38 112 62 C112 84 44 86 44 62 Z" style="fill:color-mix(in oklab,var(--foreground) 10%,transparent);stroke:var(--foreground);stroke-width:1.5"/><circle cx="124" cy="36" r="14" style="fill:color-mix(in oklab,var(--vec-out) 25%,transparent);stroke:var(--vec-out);stroke-width:1.5"/><path d="M110 46 L100 52" style="stroke:var(--brand);stroke-width:2;stroke-linecap:round"/><path d="M104 44 L112 62 L92 70" style="fill:none;stroke:var(--brand);stroke-width:1.25;stroke-dasharray:3 3"/>`},
	{"A flake comes off", "The flake carries a razor edge, sharper than a steel scalpel; the core keeps a scar. Both can be used.",
		`<path d="M44 62 C44 40 96 40 98 50 L90 70 C70 84 44 82 44 62 Z" style="fill:color-mix(in oklab,var(--foreground) 10%,transparent);stroke:var(--foreground);stroke-width:1.5"/><path d="M124 46 L146 58 L130 78 L116 66 Z" style="fill:color-mix(in oklab,var(--brand) 18%,transparent);stroke:var(--brand);stroke-width:1.5;stroke-linejoin:round"/>`},
	{"Shape by retouch", "Small removals along an edge resharpen or shape it. Done on both faces around the whole outline, it makes an Acheulean handaxe.",
		`<path d="M90 14 C112 28 120 56 106 92 L74 92 C60 56 68 28 90 14 Z" style="fill:color-mix(in oklab,var(--foreground) 10%,transparent);stroke:var(--foreground);stroke-width:1.5;stroke-linejoin:round"/><path d="M80 34 l6 4 M76 48 l7 3 M74 62 l7 2 M100 34 l-6 4 M104 48 l-7 3 M106 62 l-7 2" style="stroke:var(--brand);stroke-width:1.25;stroke-linecap:round"/>`},
}

func paleoTools() h.Node {
	s := pScale{log: true, old: 4, young: 0.01, left: 16, width: 600}
	const top = 8.0
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"),
		h.Div(h.Class("scroll-thin overflow-x-auto border-b bg-code p-3"),
			h.Svg(h.ViewBox("0 0 640 200"), h.Class("mx-auto block w-full max-w-[760px] min-w-[560px]"), h.Role("img"), h.Aria("label", "Stone tool industries on a log time axis"),
				pTimeAxis(s, top, 170, []float64{3, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01}),
				h.MapIdx(pIndustries, func(i int, in pIndustry) h.Node {
					y := top + 4 + float64(i)*32
					x0, x1 := s.x(in.start), s.x(in.end)
					return h.El("g", h.El("title", in.who+". "+in.what),
						pRect(x0, y+14, x1-x0, 10, "fill:var(--vec-out);fill-opacity:0.75", h.Attr("rx", "5")),
						// Late industries sit at the right edge: label them from their end.
						h.IfElseF(x0 > 420,
							func() h.Node {
								return pText(x1, y+10, in.name+"  ·  "+pRange(in.start, in.end), h.Class("fill-foreground text-[10px]"), h.Attr("text-anchor", "end"))
							},
							func() h.Node {
								return pText(x0, y+10, in.name+"  ·  "+pRange(in.start, in.end), h.Class("fill-foreground text-[10px]"))
							}),
					)
				}),
			),
		),
		h.Div(h.Class("grid gap-4 p-4 sm:grid-cols-[1fr_1.2fr] sm:p-5"), h.Data("paleo-stepper", ""),
			h.Div(h.Class("grid place-items-center rounded-lg border bg-code p-2"),
				h.MapIdx(pKnapSteps, func(i int, k pKnap) h.Node {
					return h.Div(h.Data("step", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1 w-full"),
						h.Svg(h.ViewBox("0 0 180 110"), h.Class("enter mx-auto block h-36 w-auto"), h.Aria("hidden", "true"), h.UnsafeHTML(k.svg)))
				}),
			),
			h.Div(h.Class("flex flex-col gap-3"),
				h.Div(h.Class("flex items-center justify-between"),
					panelLabel("Knapping"),
					h.Span(h.Data("out", "count"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("1 / %d", len(pKnapSteps)))),
				h.Div(h.Class("grid min-h-28"),
					h.MapIdx(pKnapSteps, func(i int, k pKnap) h.Node {
						return h.Div(h.Data("step", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col gap-1.5"),
							h.P(h.Class("text-base font-semibold tracking-tight"), fmt.Sprintf("%d. %s", i+1, k.title)),
							h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), k.body))
					})),
				h.Div(h.Class("mt-auto flex items-center justify-between gap-2"),
					pStepButton("-1", "Back"),
					h.Div(h.Class("flex gap-1"), h.Aria("hidden", "true"),
						h.Range(len(pKnapSteps), func(i int) h.Node {
							return h.Span(h.Data("pip", fmt.Sprint(i)), h.If(i == 0, h.Data("on", "")),
								h.Class("h-1.5 w-1.5 rounded-full bg-foreground/15 transition-[width,background-color] duration-200 data-[on]:w-4 data-[on]:bg-brand"))
						})),
					pStepButton("1", "Next"),
				),
			),
		),
	)
}

// ---------------------------------------------------------------- P8

func paleoDNABlock() Block {
	return Block{
		Slug:        "ancient-dna",
		Title:       "Ancient DNA and admixture",
		Description: "Our genomes carry pieces of other humans. Pick a present-day population to see roughly how much of its DNA comes from Neanderthals and Denisovans. The fractions follow published estimates; where the pieces fall along the chromosomes is illustrative.",
		Tags:        []string{"genomes", "introgression", "sources"},
		Wide:        true,
		Render:      paleoDNA,
	}
}

func paleoDNA() h.Node {
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("paleo-dna", ""),
		h.Div(h.Class("flex flex-wrap items-center gap-3 border-b px-3 py-2"),
			segs("Population",
				[2]string{"eurasian", "Europe & East Asia"},
				[2]string{"papuan", "Papua New Guinea"},
				[2]string{"african", "Sub-Saharan Africa"}),
			h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
				legendSwatch("var(--vec-out)", "Neanderthal"), legendSwatch("var(--ion-cl)", "Denisovan")),
		),
		h.Div(h.Class("bg-code p-3"),
			h.Svg(h.Data("genome", ""), h.ViewBox("0 0 720 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "22 chromosomes with introgressed segments marked")),
		),
		h.Div(h.Class("grid gap-4 border-t p-4 sm:grid-cols-[1fr_1.4fr]"),
			h.Dl(h.Class("grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 font-mono text-xs"),
				h.Dt(h.Class("text-muted-foreground"), "Neanderthal"), h.Dd(h.Data("out", "nea"), "—"),
				h.Dt(h.Class("text-muted-foreground"), "Denisovan"), h.Dd(h.Data("out", "den"), "—"),
			),
			h.P(h.Data("out", "note"), h.Class("text-sm leading-relaxed text-muted-foreground")),
		),
		h.P(h.Class("border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground"),
			"Sources: Green et al. 2010 (Science), the draft Neanderthal genome; Reich et al. 2010 (Nature), the Denisovan genome; Chen et al. 2020 (Cell) on Neanderthal ancestry in Africans. Svante Pääbo received the 2022 Nobel Prize in Physiology or Medicine for this work."),
	)
}

// ---------------------------------------------------------------- P9

func paleoSourceBlock() Block {
	return Block{
		Slug:        "paleo-source",
		Title:       "Primary source",
		Description: "The paper that pushed the origin of our species back by about 100,000 years, with what it found, why it mattered, and a citation to copy.",
		Tags:        []string{"citation", "copy", "DOI"},
		Render:      paleoSource,
	}
}

const pAPA = "Hublin, J.-J., Ben-Ncer, A., Bailey, S. E., et al. (2017). New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens. Nature, 546(7657), 289–292. https://doi.org/10.1038/nature22336"

const pBibTeX = `@article{hublin2017jebelirhoud,
  title   = {New fossils from Jebel Irhoud, Morocco and the
             pan-African origin of Homo sapiens},
  author  = {Hublin, Jean-Jacques and Ben-Ncer, Abdelouahed and
             Bailey, Shara E. and others},
  journal = {Nature},
  volume  = {546},
  number  = {7657},
  pages   = {289--292},
  year    = {2017},
  doi     = {10.1038/nature22336}
}`

func paleoSource() h.Node {
	return h.Article(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs"),
		h.Div(h.Class("flex flex-col gap-3 p-5"),
			h.Div(h.Class("flex flex-wrap items-center gap-2 text-xs text-muted-foreground"),
				hugeicons.File02Icon(h.Class("size-4")),
				h.Span("Nature · 2017 · 546: 289–292"),
				badge.Badge(badge.VariantOutline, h.Class("gap-1 font-normal"), hugeicons.Bone01Icon(h.Class("size-3")), "Jebel Irhoud, Morocco"),
			),
			h.H3(h.Class("text-lg leading-snug font-semibold tracking-tight text-balance"),
				"New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens"),
			h.P(h.Class("text-sm text-muted-foreground"), "J.-J. Hublin, A. Ben-Ncer, S. E. Bailey, et al."),
			h.Dl(h.Class("grid gap-3 pt-1 text-sm leading-relaxed sm:grid-cols-2"),
				h.Div(h.Class("rounded-lg border bg-code p-3"),
					h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Finding"),
					h.Dd("Skulls with a modern face and teeth but an elongated braincase, dated to ≈315 ka (±34 ka) by thermoluminescence on burnt flints, in a companion paper by Richter et al.")),
				h.Div(h.Class("rounded-lg border bg-code p-3"),
					h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Why it matters"),
					h.Dd("Our species was already present in North Africa ≈100,000 years before the Ethiopian fossils, suggesting it evolved across Africa.")),
			),
		),
		h.Div(h.Class("border-t bg-code-panel"),
			h.Div(h.Class("flex items-center gap-2 px-3 pt-2"),
				h.Div(h.Class("flex items-center gap-1 rounded-lg border bg-background p-0.5"), h.Role("tablist"), h.Aria("label", "Citation format"),
					segButton("apa", "APA", true), segButton("bibtex", "BibTeX", false)),
				h.Div(h.Class("flex-1")),
				button.Button(button.VariantOutline, button.SizeSm, lib.AsChild,
					h.A(h.Href("https://doi.org/10.1038/nature22336"), h.Target("_blank"), hugeicons.LinkSquare02Icon(), "DOI")),
			),
			h.Div(h.Data("view", "apa"), h.Class("relative px-3 py-3"),
				h.P(h.Class("rounded-lg border bg-code py-3 pr-12 pl-3 text-[13px] leading-relaxed"), pAPA),
				copyButton(pAPA, "absolute top-5 right-5")),
			h.Div(h.Data("view", "bibtex"), h.Hidden(), h.Class("relative px-3 py-3"),
				h.Pre(h.Class("code scroll-thin overflow-x-auto rounded-lg border bg-code p-3 text-[12px]"), pBibTeX),
				copyButton(pBibTeX, "absolute top-5 right-5")),
		),
	)
}

// ---------------------------------------------------------------- P10

func paleoGlossaryBlock() Block {
	return Block{
		Slug:        "paleo-glossary",
		Title:       "Words of the field",
		Description: "A paragraph that defines its own terms. Hover or focus an underlined word.",
		Tags:        []string{"tooltip", "reading"},
		Render:      paleoGlossary,
	}
}

func paleoGlossary() h.Node {
	return h.Div(h.Class("flex flex-col gap-4"),
		h.Div(h.Class("flex items-center gap-2"),
			badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "Lesson 1.1"),
			h.Span(h.Class("text-sm text-muted-foreground"), "What makes a hominin"),
		),
		h.P(h.Class("text-[17px] leading-8 text-pretty text-muted-foreground"),
			"Paleoanthropologists call humans and all our extinct relatives since the split from chimpanzees ",
			term("hominins", "The tribe Hominini: modern humans and every species more closely related to us than to chimpanzees and bonobos."),
			"; the wider family that also includes the great apes is the ",
			term("hominids", "The family Hominidae: humans, chimpanzees, bonobos, gorillas and orangutans, with their extinct relatives."),
			". The first hallmark of hominins is ",
			term("bipedalism", "Habitual walking on two legs. It shows in the skull, pelvis, knee and foot long before brains grew."),
			", not a big brain: ",
			term("encephalization", "Brain size relative to body size. It rose sharply only within the genus Homo."),
			" came millions of years later. Every fossil also has a history after death, studied by ",
			term("taphonomy", "The study of what happens between death and discovery: scavenging, transport by water, burial, mineralization."),
			", and an age read from its place in the rock layers, through ",
			term("stratigraphy", "The study of rock and sediment layers. Lower layers are usually older, so a fossil's layer gives its relative age."),
			".",
		),
	)
}
