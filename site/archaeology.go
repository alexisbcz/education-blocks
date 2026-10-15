package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ArchaeologyBlocks lists the archaeology gallery: methods, not facts. Every
// site, find and curve is synthetic and says so.
func ArchaeologyBlocks() []Block {
	return []Block{
		archaeoExcavationBlock(),
		archaeoHarrisBlock(),
		archaeoSeriationBlock(),
		archaeoRadiocarbonBlock(),
		archaeoDendroBlock(),
		archaeoSurveyBlock(),
		archaeoSpatialBlock(),
		archaeoTypologyBlock(),
		archaeoMNIBlock(),
		archaeoFieldNotesBlock(),
	}
}

func archaeoButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func archaeoDash() h.Node { return h.Span(h.Class("text-muted-foreground"), "—") }

func archaeoSynthetic(text string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), text)
}

// ---------------------------------------------------------------- A1

func archaeoExcavationBlock() Block {
	return Block{
		Slug:        "excavation",
		Title:       "Excavation and context recording",
		Description: "Dig a synthetic site square by square. Each click removes the next layer and opens a new context number; finds are logged with their square and context, because a find without its context is a find without a date.",
		Tags:        []string{"single context", "grid", "find log"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("archaeo-dig",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("grid", ""), h.Class("mx-auto grid w-full max-w-[560px] grid-cols-6 gap-1"), h.Role("grid"), h.Aria("label", "Excavation grid, 6 by 4 squares")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-out)", "topsoil"), legendSwatch("var(--ion-na)", "occupation layer"),
						legendSwatch("var(--ion-k)", "pit fill"), legendSwatch("var(--foreground)", "natural"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Find log"),
					h.Ol(h.Data("log", ""), h.Class("scroll-thin flex max-h-56 flex-col gap-1 overflow-y-auto font-mono text-[11px]"), h.Aria("live", "polite")),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					archaeoButton("dig-all", "Dig all", hugeicons.ArrowDown01Icon()),
					archaeoButton("reset", "Backfill", hugeicons.RefreshIcon())),
				readouts([2]string{"contexts", "contexts"}, [2]string{"finds", "finds"}, [2]string{"squares at natural", "natural"}),
				archaeoSynthetic("Synthetic site. Real excavation follows the layers' own shapes (single-context recording), not fixed spits; the grid is a simplification."),
			)
		},
	}
}

// ---------------------------------------------------------------- A2

func archaeoHarrisBlock() Block {
	return Block{
		Slug:        "harris-matrix",
		Title:       "Harris matrix",
		Description: "Write the stratigraphic relationships you recorded (\"3 above 5\", \"7 cuts 4\") and get the Harris matrix (Harris 1979): contexts ordered from latest to earliest, with redundant links dropped and contradictions (cycles) flagged.",
		Tags:        []string{"Harris 1979", "topological order", "cycles"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("archaeo-harris",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 380"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Harris matrix")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Relationships"),
					h.Textarea(h.Data("rels", ""), h.Aria("label", "Stratigraphic relationships, one per line"), h.Attr("rows", "9"), h.Attr("spellcheck", "false"),
						h.Class("w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-base leading-relaxed shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
						"1 above 2\n2 above 3\n2 above 4\n4 cuts 3\n3 above 5\n4 above 5\n5 above 6\n2 above 5"),
					segs("Example", [2]string{"valid", "Valid"}, [2]string{"cycle", "Contradiction"}),
				),
				readouts([2]string{"contexts", "n"}, [2]string{"phases", "levels"}, [2]string{"redundant links", "redundant"}, [2]string{"status", "status"}),
				archaeoSynthetic("\"A above B\", \"A cuts B\" and \"A fills B\" all mean A is later than B. Synthetic contexts."),
			)
		},
	}
}

// ---------------------------------------------------------------- A3

func archaeoSeriationBlock() Block {
	return Block{
		Slug:        "seriation",
		Title:       "Frequency seriation",
		Description: "Pottery types rise, peak and fade. Order the assemblages so every type makes a single \"battleship\" shape and you have a relative chronology. Reorder by hand, or let the Brainerd–Robinson similarity find the best order.",
		Tags:        []string{"Brainerd–Robinson", "battleship curves", "relative dating"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("archaeo-seriation",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 320"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Battleship curves of pottery type frequencies")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Order"),
					h.Ol(h.Data("rows", ""), h.Class("flex flex-col gap-1")),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					archaeoButton("auto", "Seriate", hugeicons.SparklesIcon()),
					archaeoButton("shuffle", "Shuffle", hugeicons.ShuffleIcon())),
				readouts([2]string{"adjacent BR sum", "score"}, [2]string{"single-peak types", "unimodal"}, [2]string{"best possible", "best"}),
				archaeoSynthetic("Synthetic assemblages (percent of sherds). Seriation gives order, not direction: which end is earlier needs another clue."),
			)
		},
	}
}

// ---------------------------------------------------------------- A4

func archaeoRadiocarbonBlock() Block {
	return Block{
		Slug:        "radiocarbon",
		Title:       "Calibrating a radiocarbon date",
		Description: "A radiocarbon age is not a calendar age: atmospheric ¹⁴C has varied, so a calibration curve converts one into the other. Where the curve wiggles, one measurement maps to several calendar ranges.",
		Tags:        []string{"calibration", "probability", "wiggles"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("archaeo-c14",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 380"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Synthetic calibration curve with a measured date projected onto calendar years")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Measurement"),
					field("age", "¹⁴C age", "BP", 2450, 1950, 3000, 5),
					field("sigma", "± 1σ", "years", 30, 10, 120, 5),
				),
				readouts([2]string{"95% ranges", "ranges"}, [2]string{"total span", "span"}, [2]string{"most probable", "mode"}),
				h.P(h.Class("rounded-md border border-dashed p-2 text-xs leading-relaxed text-muted-foreground"),
					"Teaching curve: synthetic, not IntCal. Real calibration uses the current IntCal curve (Reimer et al. 2020) in software such as OxCal or CALIB."),
			)
		},
	}
}

// ---------------------------------------------------------------- A5

func archaeoDendroBlock() Block {
	return Block{
		Slug:        "dendrochronology",
		Title:       "Cross-dating tree rings",
		Description: "Slide a timber's ring-width series along a master chronology. Where the pattern of wide and narrow years matches, the correlation peaks, and the outermost ring gets a calendar year.",
		Tags:        []string{"cross-dating", "correlation", "t-value"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("archaeo-dendro",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Master chronology and sample ring widths")),
					h.Svg(h.Data("corr", ""), h.ViewBox("0 0 560 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Correlation against offset")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sample"),
					field("offset", "Start year", "", 1700, 1650, 1751, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					archaeoButton("best", "Best match", hugeicons.Target02Icon()),
					archaeoButton("new", "New sample", hugeicons.ShuffleIcon())),
				readouts([2]string{"r at this offset", "r"}, [2]string{"t-value", "t"}, [2]string{"felling year", "felled"}, [2]string{"best offset", "bestat"}),
				archaeoSynthetic("Synthetic master chronology (1650–1800) and sample. Dendrochronologists usually want t ≥ 3.5 and several overlapping series before trusting a match."),
			)
		},
	}
}

// ---------------------------------------------------------------- A6

func archaeoSurveyBlock() Block {
	return Block{
		Slug:        "survey",
		Title:       "Survey sampling",
		Description: "You can't walk the whole landscape. Choose a design (random quadrats, systematic transects, stratified quadrats), a sample size and how often a walker spots a site that is there, and compare the density estimate with the hidden truth.",
		Tags:        []string{"sampling design", "detection", "estimation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("archaeo-survey",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 400 400"), h.Class("mx-auto block w-full max-w-[460px]"), h.Role("img"), h.Aria("label", "Landscape with survey units and discovered sites")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Design"),
					segs("Sampling design", [2]string{"random", "Random"}, [2]string{"systematic", "Transects"}, [2]string{"stratified", "Stratified"}),
					field("units", "Units", "", 12, 4, 40, 1),
					field("detect", "Detection", "%", 70, 10, 100, 5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					archaeoButton("resample", "Resample", hugeicons.ShuffleIcon()),
					archaeoButton("reveal", "Reveal all", hugeicons.ViewIcon())),
				readouts([2]string{"area covered", "cover"}, [2]string{"sites found", "found"}, [2]string{"estimated density", "est"}, [2]string{"true density", "true"}),
				archaeoSynthetic("Synthetic landscape: sites cluster near a river. Estimate = found ÷ (area covered × detection rate)."),
			)
		},
	}
}

// ---------------------------------------------------------------- A7

func archaeoSpatialBlock() Block {
	return Block{
		Slug:        "nearest-neighbour",
		Title:       "Nearest-neighbour analysis",
		Description: "Are these sites clustered, random or evenly spaced? The Clark–Evans index (1954) compares the observed mean distance to each site's nearest neighbour with what complete spatial randomness would give. Click to add a site, Shift-click to remove one.",
		Tags:        []string{"Clark–Evans", "point pattern", "z-test"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("archaeo-nn", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					segs("Pattern", [2]string{"random", "Random"}, [2]string{"clustered", "Clustered"}, [2]string{"dispersed", "Dispersed"}),
					archaeoButton("clear", "Clear", hugeicons.Delete02Icon()),
				),
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 400 300"), h.Class("block w-full cursor-crosshair rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Sites with nearest-neighbour links")),
				h.Dl(h.Class("grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-4"),
					h.Map([][2]string{{"n", "n"}, {"R", "R"}, {"z", "z"}, {"pattern", "verdict"}}, func(r [2]string) h.Node {
						return h.Div(h.Class("flex flex-col"), h.Dt(h.Class("text-muted-foreground"), r[0]), h.Dd(h.Data("out", r[1]), h.Class("tabular-nums"), "—"))
					}),
				),
				archaeoSynthetic("R = r̄ / (0.5 / √(n/A)); R ≈ 1 random, < 1 clustered, > 1 dispersed (max ≈ 2.15). No edge correction, so points near the border look slightly more dispersed than they are."),
			)
		},
	}
}

// ---------------------------------------------------------------- A8

type archaeoArtefact struct {
	name  string
	attrs map[string]string
}

var archaeoSherds = []archaeoArtefact{
	{"Sherd 101", map[string]string{"rim": "everted", "temper": "shell", "decor": "incised"}},
	{"Sherd 102", map[string]string{"rim": "everted", "temper": "grit", "decor": "plain"}},
	{"Sherd 103", map[string]string{"rim": "straight", "temper": "grit", "decor": "cord"}},
	{"Sherd 104", map[string]string{"rim": "straight", "temper": "grit", "decor": "plain"}},
	{"Sherd 105", map[string]string{"rim": "inverted", "temper": "shell", "decor": "plain"}},
	{"Sherd 106", map[string]string{"rim": "everted", "temper": "shell", "decor": "plain"}},
}

func archaeoTypologyBlock() Block {
	return Block{
		Slug:        "typology",
		Title:       "A dichotomous key",
		Description: "Typologies turn variable objects into named types by asking the same questions every time. Pick a (synthetic) sherd and walk the key one question at a time; the path is recorded so another archaeologist can repeat it.",
		Tags:        []string{"typology", "key", "classification"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("archaeo-key", ""),
				h.Div(h.Class("flex flex-wrap gap-1.5"), h.Role("group"), h.Aria("label", "Sherds"),
					h.MapIdx(archaeoSherds, func(i int, a archaeoArtefact) h.Node {
						return h.Button(h.Type("button"), h.Data("sherd", fmt.Sprint(i)),
							h.Data("rim", a.attrs["rim"]), h.Data("temper", a.attrs["temper"]), h.Data("decor", a.attrs["decor"]),
							h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"),
							a.name)
					}),
				),
				h.Div(h.Data("card", ""), h.Class("rounded-lg border bg-code p-3 font-mono text-xs leading-relaxed")),
				h.Div(h.Data("question", ""), h.Class("flex flex-col gap-3 rounded-lg border p-4"), h.Aria("live", "polite")),
				h.Ol(h.Data("path", ""), h.Class("flex flex-col gap-1 font-mono text-[11px] text-muted-foreground")),
				archaeoSynthetic("Synthetic key and sherds. Answering from the object's recorded attributes is automatic here; in the lab the hard part is deciding the attribute in the first place."),
			)
		},
	}
}

// ---------------------------------------------------------------- A9

var archaeoElements = []struct {
	name   string
	paired bool
	l, r   int
	other  int
}{
	{"Femur (proximal)", true, 5, 3, 1},
	{"Humerus (distal)", true, 2, 4, 0},
	{"Tibia (distal)", true, 3, 3, 2},
	{"Mandible", false, 0, 0, 3},
	{"Cranium (petrous)", true, 1, 2, 0},
}

func archaeoMNIBlock() Block {
	return Block{
		Slug:        "mni",
		Title:       "Counting individuals",
		Description: "A pile of bones from a (synthetic) mass grave: how many people? NISP counts the fragments; the minimum number of individuals (MNI) counts the most frequent single element, taking sides into account, because no one has two left femurs.",
		Tags:        []string{"MNI", "NISP", "osteology"},
		Render: func() h.Node {
			cell := func(name string, v int) h.Node {
				return h.Input(h.Type("number"), h.Attr("min", "0"), h.Attr("max", "99"), h.Value(fmt.Sprint(v)), h.Data("count", name), h.Aria("label", name),
					h.Class("h-8 w-12 sm:w-16 rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"))
			}
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("archaeo-mni", ""),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					h.Table(h.Class("w-full min-w-[320px] text-sm"),
						h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
							h.Th(h.Class("py-2 pr-3 font-normal"), "Element (diagnostic zone)"),
							h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Left"),
							h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Right"),
							h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Unsided"),
							h.Th(h.Class("py-2 text-right font-normal"), "MNI"),
						)),
						h.Tbody(h.MapIdx(archaeoElements, func(i int, e struct {
							name   string
							paired bool
							l, r   int
							other  int
						}) h.Node {
							return h.Tr(h.Class("border-b last:border-b-0"), h.Data("row", fmt.Sprint(i)), h.Data("paired", fmt.Sprint(e.paired)),
								h.Td(h.Class("py-1.5 pr-3"), e.name),
								h.Td(h.Class("py-1.5 pr-2 text-right sm:pr-3"), h.IfElse(e.paired, cell(fmt.Sprintf("l%d", i), e.l), archaeoDash())),
								h.Td(h.Class("py-1.5 pr-2 text-right sm:pr-3"), h.IfElse(e.paired, cell(fmt.Sprintf("r%d", i), e.r), archaeoDash())),
								h.Td(h.Class("py-1.5 pr-2 text-right sm:pr-3"), cell(fmt.Sprintf("u%d", i), e.other)),
								h.Td(h.Data("mni", fmt.Sprint(i)), h.Class("py-1.5 text-right font-mono tabular-nums"), "—"),
							)
						})),
					),
				),
				h.Dl(h.Class("grid grid-cols-3 gap-x-4 font-mono text-xs"),
					h.Div(h.Dt(h.Class("text-muted-foreground"), "NISP"), h.Dd(h.Data("out", "nisp"), "—")),
					h.Div(h.Dt(h.Class("text-muted-foreground"), "MNI"), h.Dd(h.Data("out", "mni"), h.Class("text-base text-brand"), "—")),
					h.Div(h.Dt(h.Class("text-muted-foreground"), "from"), h.Dd(h.Data("out", "from"), "—")),
				),
				h.Div(h.Class("rounded-lg border p-3 text-sm leading-relaxed text-muted-foreground"),
					h.P(h.Span(h.Class("font-medium text-foreground"), "Rule. "), "For a paired element, MNI = the larger of left and right; for a single element (mandible), its count. The site MNI is the largest of these. Unsided fragments of paired bones are left out, which keeps the estimate a minimum."),
					h.P(h.Class("mt-2"), h.Span(h.Class("font-medium text-foreground"), "Age and sex. "), "Juveniles are aged from tooth formation and eruption and from epiphyseal fusion; adults more roughly from the pubic symphysis, the auricular surface and cranial sutures. Sex is estimated in adults, best from the pelvis, then the skull. See White & Folkens, ", h.Em("The Human Bone Manual"), " (2005)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- A10

func archaeoFieldNotesBlock() Block {
	return Block{
		Slug:        "field-notes",
		Title:       "Formation, recording and ethics",
		Description: "Three notes every excavation needs: how a site came to look the way it does, how to photograph it for a 3D model, and whose past it is.",
		Tags:        []string{"taphonomy", "photogrammetry", "ethics"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("archaeo-notes", ""),
				segs("Note", [2]string{"formation", "Formation"}, [2]string{"photogrammetry", "Photogrammetry"}, [2]string{"ethics", "Ethics"}),
				h.Div(h.Data("view", "formation"), h.Class("flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground"),
					h.P("Michael Schiffer (", h.Em("Formation Processes of the Archaeological Record"), ", 1987) separates two kinds of process that turn living behaviour into what we dig up:"),
					h.Ul(h.Class("flex list-disc flex-col gap-1.5 pl-5"),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Cultural: "), "discard, loss, abandonment, reuse, later digging and ploughing."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Natural: "), "burial by sediment, decay, animal burrowing, root action, freezing and thawing, erosion."),
					),
					h.P(term("Taphonomy", "The study of what happens to remains between death or discard and discovery; the word was coined by Efremov in 1940 for fossils."),
						" asks which of these left a mark: gnawed bone, a sherd that rolled downslope, a coin that sank through a burrow."),
				),
				h.Div(h.Data("view", "photogrammetry"), h.Hidden(), h.Class("flex flex-col gap-3"),
					h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), "Structure-from-motion needs every point in several photos. Typical guidance is about 60–80% overlap between neighbouring shots; spacing follows from the camera's footprint."),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						field("dist", "Distance", "m", 2, 0.3, 50, 0.1),
						field("focal", "Focal length", "mm", 24, 10, 200, 1),
						field("sensor", "Sensor width", "mm", 36, 5, 50, 0.1),
						field("overlap", "Overlap", "%", 70, 30, 95, 5),
					),
					readouts([2]string{"footprint width", "foot"}, [2]string{"move between shots", "step"}, [2]string{"shots for 10 m", "shots"}),
				),
				h.Div(h.Data("view", "ethics"), h.Hidden(), h.Class("flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground"),
					h.Ul(h.Class("flex list-disc flex-col gap-1.5 pl-5"),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Provenance. "), "An object without a documented origin may come from looting; museums and journals increasingly refuse it."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Descendant communities. "), "Burials and sacred objects belong to living people too. In the United States, the Native American Graves Protection and Repatriation Act (NAGPRA, 1990) requires institutions to inventory and return human remains and cultural items to tribes."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Excavation is destruction. "), "A layer can only be dug once, so the record (contexts, plans, photographs) must be good enough to reconstruct it, and it must be published and archived."),
					),
				),
			)
		},
	}
}
