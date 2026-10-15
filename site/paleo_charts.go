package site

import (
	"fmt"
	"math"
	"strings"

	h "github.com/alexisbcz/libhtml"
)

// pRange formats a time range in Ma or ka.
func pRange(start, end float64) string {
	if end <= 0 {
		return "≈ " + pMaLabel(start) + " – present"
	}
	if start < 1 {
		return "≈ " + pTrim(start*1000) + "–" + pTrim(end*1000) + " ka"
	}
	if end < 1 {
		return "≈ " + pTrim(start) + " Ma – " + pTrim(end*1000) + " ka"
	}
	return "≈ " + pTrim(start) + "–" + pTrim(end) + " Ma"
}

// ---------------------------------------------------------------- P1

func paleoRangesBlock() Block {
	return Block{
		Slug:        "hominin-ranges",
		Title:       "Hominin time ranges",
		Description: "Seven million years of our family tree's branches, as the fossil record dates them. Faded ends are uncertainty. Move the year line (pointer, or ←/→ on the chart) to see who lived at the same time; click a species for its key fossils and what is still argued about.",
		Tags:        []string{"time ranges", "log axis", "kbd"},
		Wide:        true,
		Render:      paleoRanges,
	}
}

func paleoRangesSVG(s pScale) h.Node {
	const rowH, headH, top = 19.0, 20.0, 14.0
	y := top
	var rows []h.Node
	for _, g := range []string{"early", "aus", "para", "homo"} {
		rows = append(rows, pText(4, y+13, strings.ToUpper(pGenusName[g]), h.Attr("style", "letter-spacing:0.06em")))
		y += headH
		for _, sp := range pHominins {
			if sp.genus != g {
				continue
			}
			c := pGenusColor[g]
			x0, x1 := s.x(sp.start), s.x(sp.end)
			fz0, fz1 := s.x(sp.start+sp.fuzz), s.x(math.Max(sp.end-sp.fuzz, 0))
			rows = append(rows, h.El("g", h.Data("species", sp.key), h.TabIndex(0), h.Role("button"), h.Aria("label", sp.name+", "+pRange(sp.start, sp.end)),
				h.Data("start", fmt.Sprint(sp.start)), h.Data("end", fmt.Sprint(sp.end)), h.Data("name", sp.name),
				h.Data("range", pRange(sp.start, sp.end)), h.Data("fossils", sp.fossils), h.Data("note", sp.note), h.Data("genus", pGenusName[g]),
				h.Class("group cursor-pointer outline-none"),
				pRect(0, y, 744, rowH, "fill:transparent", h.Class("group-hover:fill-[color-mix(in_oklab,var(--foreground)_4%,transparent)] group-focus-visible:fill-[color-mix(in_oklab,var(--foreground)_6%,transparent)] group-data-[on]:fill-[color-mix(in_oklab,var(--brand)_10%,transparent)]")),
				pText(14, y+13, sp.name, h.Class("fill-foreground text-[11px] italic group-data-[on]:fill-[var(--brand)]"), h.Attr("style", "font-family:var(--font-sans)")),
				// Uncertainty, then the well-dated core.
				pRect(fz0, y+5, x0-fz0, rowH-10, "fill:"+c+";fill-opacity:0.25"),
				pRect(x1, y+5, fz1-x1, rowH-10, "fill:"+c+";fill-opacity:0.25"),
				pRect(x0, y+4, x1-x0, rowH-8, "fill:"+c+";fill-opacity:0.85", h.Attr("rx", "2")),
			))
			y += rowH
		}
		y += 4
	}
	height := y + 22
	return h.Svg(h.ViewBox(fmt.Sprintf("0 0 760 %.0f", height)), h.Class("block w-full min-w-[640px] select-none"),
		h.Data("log", fmt.Sprint(s.log)), h.Data("old", fmt.Sprint(s.old)), h.Data("young", fmt.Sprint(s.young)),
		h.Data("left", fmt.Sprint(s.left)), h.Data("width", fmt.Sprint(s.width)),
		h.Role("img"), h.Aria("label", "Time ranges of hominin species"),
		pTimeAxis(s, 6, y, h.Ternary(s.log, pLogTicks, pLinTicks)),
		h.Group(rows),
		pLine(0, 0, 0, y, "stroke:var(--brand);stroke-width:1.5", h.Data("cursor", "")),
		pText(0, 10, "", h.Data("cursor-label", ""), h.Class("fill-[var(--brand)] font-mono text-[10px]")),
	)
}

func paleoRanges() h.Node {
	logS := pScale{log: true, old: 8, young: 0.01, left: 200, width: 540}
	linS := pScale{log: false, old: 8, young: 0, left: 200, width: 540}
	return h.Div(h.Class("flex flex-col overflow-hidden rounded-xl border bg-background"), h.Data("paleo-ranges", ""),
		h.Div(h.Class("flex flex-wrap items-center gap-3 border-b px-3 py-2"),
			segs("Time axis", [2]string{"log", "Log time"}, [2]string{"linear", "Linear time"}),
			h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
				h.Map([]string{"early", "aus", "para", "homo"}, func(g string) h.Node { return legendSwatch(pGenusColor[g], pGenusName[g]) })),
		),
		h.Div(h.Class("scroll-thin overflow-x-auto bg-code p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("chart", ""), h.TabIndex(0),
			h.Aria("label", "Hominin time ranges. Left and right arrows move the year line."),
			h.Div(h.Data("view", "log"), paleoRangesSVG(logS)),
			h.Div(h.Data("view", "linear"), h.Hidden(), paleoRangesSVG(linS)),
		),
		h.Div(h.Class("grid gap-4 border-t p-4 sm:grid-cols-2"),
			h.Div(h.Class("flex flex-col gap-1.5"),
				panelLabel("Living at the same time"),
				h.P(h.Data("out", "year"), h.Class("font-mono text-sm"), "—"),
				h.P(h.Data("out", "alive"), h.Class("text-sm leading-relaxed text-muted-foreground"), "Move the line over the chart."),
			),
			h.Div(h.Data("detail", ""), h.Class("flex flex-col gap-1.5"),
				panelLabel("Species"),
				h.P(h.Data("out", "name"), h.Class("text-sm font-medium italic"), "Click a species"),
				h.P(h.Data("out", "range"), h.Class("font-mono text-xs text-muted-foreground")),
				h.P(h.Data("out", "fossils"), h.Class("text-sm leading-relaxed text-muted-foreground")),
				h.P(h.Data("out", "note"), h.Class("text-xs leading-relaxed text-[color-mix(in_oklab,var(--vec-out)_60%,var(--foreground))] empty:hidden")),
			),
		),
	)
}

// ---------------------------------------------------------------- P2

func paleoCraniaBlock() Block {
	return Block{
		Slug:        "cranial-capacity",
		Title:       "Brain size through time",
		Description: "Endocranial volume against time, each species drawn as a box: its time range across, the spread of its measured skulls up. Brains stayed chimpanzee-sized for millions of years, then grew with Homo. Hover a box for its numbers.",
		Tags:        []string{"scatter", "ranges", "log time"},
		Wide:        true,
		Render:      paleoCrania,
	}
}

type pSkull struct {
	name, genus string
	start, end  float64 // Ma
	lo, hi      float64 // cm³
	note        string
	place       string // label: "right" (default), "above", "below", "left" or "inside"
}

var pSkulls = []pSkull{
	{"Chimpanzee (living)", "early", 0.01, 0.01, 280, 500, "Our closest living relative, for scale: ≈400 cm³ on average.", "left"},
	{"Au. afarensis", "aus", 3.9, 2.9, 380, 550, "", "above"},
	{"Au. africanus", "aus", 3.0, 2.1, 420, 500, "", "below"},
	{"P. boisei", "para", 2.3, 1.4, 475, 545, "", "right"},
	{"H. habilis", "homo", 2.4, 1.4, 550, 690, "", "above"},
	{"H. erectus", "homo", 1.9, 0.11, 600, 1250, "Early African and Dmanisi skulls are small, late Asian ones large.", "right"},
	{"H. heidelbergensis", "homo", 0.7, 0.2, 1100, 1400, "", "left"},
	{"H. naledi", "homo", 0.335, 0.236, 465, 610, "A small brain late in time: brain size did not grow in a straight line.", "right"},
	{"H. floresiensis", "homo", 0.1, 0.06, 380, 430, "LB1's volume has been estimated between ≈380 and ≈430 cm³.", "right"},
	{"Neanderthals", "homo", 0.4, 0.04, 1200, 1750, "On average slightly larger than ours, in larger, heavier bodies.", "above"},
	{"H. sapiens", "homo", 0.315, 0.01, 1100, 1700, "≈1,350 cm³ on average today.", "inside"},
}

func paleoCrania() h.Node {
	s := pScale{log: true, old: 5, young: 0.01, left: 56, width: 540}
	const top, bottom = 22.0, 290.0
	cy := func(v float64) float64 { return bottom - (v-300)/(1800-300)*(bottom-top) }
	return plotPanel("paleo-crania",
		h.Svg(h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Cranial capacity against time"),
			pTimeAxis(s, top, bottom, []float64{5, 3, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01}),
			h.Map([]float64{400, 800, 1200, 1600}, func(v float64) h.Node {
				return h.Group(pLine(s.left, cy(v), s.left+s.width, cy(v), "stroke:currentColor;stroke-opacity:0.07"),
					pText(s.left-6, cy(v)+3, fmt.Sprintf("%.0f", v), h.Attr("text-anchor", "end")))
			}),
			pText(4, 8, "cm³"),
			h.Map(pSkulls, func(k pSkull) h.Node {
				x0, x1 := s.x(k.start), s.x(k.end)
				if x1-x0 < 6 {
					x0, x1 = x0-3, x1+3
				}
				c := pGenusColor[k.genus]
				if k.start == 0.01 {
					c = "var(--foreground)"
				}
				return h.El("g", h.Data("skull", ""), h.TabIndex(0), h.Class("cursor-default outline-none [&:is(:hover,:focus-visible)_rect]:stroke-[var(--brand)] [&:is(:hover,:focus-visible)_rect]:[stroke-width:2]"),
					h.Data("name", k.name), h.Data("info", fmt.Sprintf("%s · ≈ %.0f–%.0f cm³", pRange(k.start, k.end), k.lo, k.hi)), h.Data("note", k.note),
					h.Aria("label", fmt.Sprintf("%s, %.0f to %.0f cubic centimetres", k.name, k.lo, k.hi)),
					pRect(x0, cy(k.hi), x1-x0, cy(k.lo)-cy(k.hi), "fill:"+c+";fill-opacity:0.22;stroke:"+c+";stroke-width:1.25", h.Attr("rx", "2")),
					pSkullLabel(k, x0, x1, cy(k.hi), cy(k.lo)),
				)
			}),
		),
		h.Div(h.Class("flex flex-col gap-2"), panelLabel("Selected"),
			h.P(h.Data("out", "name"), h.Class("text-sm font-medium"), "Hover a box"),
			h.P(h.Data("out", "info"), h.Class("font-mono text-xs text-muted-foreground")),
			h.P(h.Data("out", "note"), h.Class("text-xs leading-relaxed text-muted-foreground")),
		),
		h.P(h.Class("border-t pt-4 text-xs leading-relaxed text-muted-foreground"),
			"Caveat: bigger bodies carry bigger brains, so raw volume overstates differences. Encephalization measures correct for body mass, but fossil body masses are themselves estimates. Volumes are approximate ranges from published skulls."),
	)
}

// pSkullLabel places a box's name where it does not collide with its
// neighbours.
func pSkullLabel(k pSkull, x0, x1, yTop, yBot float64) h.Node {
	cls := h.Class("fill-foreground text-[10px]")
	switch k.place {
	case "above":
		return pText(x0, yTop-4, k.name, cls)
	case "below":
		return pText(x0, yBot+11, k.name, cls)
	case "left":
		return pText(x0-4, yTop+9, k.name, cls, h.Attr("text-anchor", "end"))
	case "inside":
		return pText(x1-4, yTop+11, k.name, cls, h.Attr("text-anchor", "end"))
	}
	return pText(x1+4, yTop+9, k.name, cls)
}

// ---------------------------------------------------------------- P3

func paleoMapBlock() Block {
	return Block{
		Slug:        "out-of-africa",
		Title:       "Out of Africa",
		Description: "How hominins spread across the world, step by step: Homo erectus first, then our own species in a main wave between ≈70 and 50 ka. Dates at the edges (Australia, the Americas) are actively debated, and the notes say so. The map is schematic.",
		Tags:        []string{"map", "stepper", "dispersal"},
		Wide:        true,
		Render:      paleoMap,
	}
}

// A low-detail world in longitude/latitude: schematic on purpose.
var pLand = [][][2]float64{
	// Africa
	{{-17, 21}, {-16, 28}, {-10, 30}, {-6, 36}, {10, 37}, {11, 33}, {20, 31}, {32, 31}, {34, 28}, {43, 12}, {51, 12}, {41, -1}, {40, -10}, {35, -24}, {27, -34}, {18, -34}, {12, -18}, {9, -1}, {9, 4}, {-8, 4}, {-17, 14}},
	// Eurasia (with Arabia and India)
	{{-9, 37}, {-9, 43}, {-1, 46}, {-5, 48}, {2, 51}, {8, 54}, {5, 62}, {15, 69}, {28, 71}, {40, 67}, {60, 69}, {80, 73}, {100, 77}, {130, 72}, {160, 70}, {180, 66}, {180, 62}, {170, 60}, {160, 53}, {142, 46}, {135, 35}, {122, 31}, {121, 23}, {108, 21}, {105, 9}, {100, 13}, {98, 8}, {103, 1}, {95, 16}, {90, 22}, {80, 15}, {77, 8}, {72, 20}, {67, 24}, {57, 25}, {59, 22}, {52, 16}, {43, 12}, {39, 21}, {34, 28}, {35, 33}, {30, 37}, {26, 40}, {23, 36}, {20, 40}, {13, 45}, {12, 38}, {9, 44}, {3, 43}, {-2, 36}},
	// Sumatra, Java, Borneo, New Guinea
	{{95, 5}, {106, -6}, {103, -5}, {96, 2}},
	{{105, -6}, {115, -8}, {114, -8.7}, {106, -7.2}},
	{{109, 1}, {117, 7}, {119, 1}, {116, -4}, {111, -3}},
	{{131, -1}, {141, -3}, {150, -6}, {147, -9}, {141, -9}, {136, -5}},
	// Australia
	{{113, -22}, {114, -34}, {123, -34}, {131, -31}, {138, -35}, {146, -39}, {150, -37}, {153, -28}, {153, -25}, {146, -19}, {142, -10}, {136, -12}, {130, -12}, {122, -17}},
	// North America
	{{-168, 66}, {-160, 70}, {-140, 70}, {-120, 70}, {-95, 72}, {-80, 70}, {-62, 60}, {-56, 52}, {-66, 45}, {-70, 42}, {-76, 35}, {-81, 31}, {-80, 25}, {-84, 30}, {-90, 29}, {-97, 26}, {-97, 21}, {-90, 21}, {-87, 16}, {-83, 9}, {-78, 8}, {-80, 9}, {-86, 13}, {-96, 16}, {-105, 20}, {-110, 24}, {-114, 31}, {-117, 33}, {-124, 40}, {-124, 48}, {-131, 55}, {-141, 60}, {-152, 59}, {-158, 57}, {-165, 60}},
	// South America
	{{-78, 8}, {-72, 12}, {-62, 11}, {-52, 5}, {-35, -6}, {-39, -15}, {-48, -25}, {-57, -35}, {-65, -41}, {-68, -52}, {-73, -50}, {-74, -40}, {-71, -30}, {-71, -18}, {-77, -12}, {-81, -5}, {-80, 1}},
	// Greenland, Britain, Japan, Madagascar
	{{-55, 60}, {-44, 60}, {-20, 70}, {-20, 80}, {-60, 82}, {-73, 78}, {-55, 70}},
	{{-5, 50}, {1, 51}, {-2, 56}, {-5, 58}, {-6, 55}},
	{{130, 31}, {136, 34}, {141, 38}, {142, 45}, {140, 40}, {133, 33}},
	{{44, -25}, {47, -25}, {50, -15}, {49, -12}, {44, -16}},
}

func pProj(p [2]float64) (float64, float64) { return (p[0] + 180) / 360 * 720, (90 - p[1]) / 180 * 360 }

func pPath(pts [][2]float64, closed bool) string {
	var b strings.Builder
	for i, p := range pts {
		x, y := pProj(p)
		if i == 0 {
			fmt.Fprintf(&b, "M%.1f %.1f", x, y)
		} else {
			fmt.Fprintf(&b, " L%.1f %.1f", x, y)
		}
	}
	if closed {
		b.WriteString(" Z")
	}
	return b.String()
}

type pSite struct {
	name string
	at   [2]float64
	step int
	date string
	// Label placement: "end" puts it left of the dot; dy moves it down.
	anchor string
	dy     float64
}

type pRoute struct {
	step   int
	pts    [][2]float64
	dashed bool
	color  string
}

type pStep struct{ title, date, body string }

var pSteps = []pStep{
	{"Homo erectus leaves Africa", "≈1.9–1.8 Ma", "Within a few hundred thousand years of appearing, H. erectus (or a close relative) reached the Caucasus: the Dmanisi skulls in Georgia are ≈1.8 Ma old. It went on to Java and China; Zhoukoudian's fossils are ≈0.78–0.4 Ma (dates debated)."},
	{"Our species appears in Africa", "≈315 ka", "The oldest fossils attributed to H. sapiens come from Jebel Irhoud, Morocco (≈315 ka), far from East Africa: our species likely emerged across Africa, not at one spot. Omo Kibish, Ethiopia, is ≥233 ka."},
	{"Early excursions", "≈200–100 ka", "Some H. sapiens left Africa early: Misliya Cave, Israel (≈194–177 ka), Skhul and Qafzeh (≈120–90 ka). These early groups left little or no ancestry in people living today."},
	{"The main dispersal", "≈70–50 ka", "Almost all ancestry of present-day non-Africans traces to a dispersal around 70–50 ka, probably by a southern route across the Bab-el-Mandeb into Arabia, then along South Asia. Along the way they interbred with Neanderthals."},
	{"Australia (Sahul)", "≥ 50 ka", "Reaching Sahul needed sea crossings of tens of kilometres. Occupation by ≈50 ka is widely accepted; Madjedbebe in northern Australia has been dated to ≈65 ka, which some dispute. Papuans and Aboriginal Australians carry Denisovan ancestry."},
	{"Europe", "≈45 ka", "Modern humans were in Europe by ≈46–45 ka (Bacho Kiro, Bulgaria). Neanderthals disappeared around 40 ka, after a few thousand years of overlap."},
	{"The Americas", "≥ 16 ka", "People crossed from Siberia via Beringia. Monte Verde in Chile shows occupation by ≈14.5 ka. Footprints at White Sands, New Mexico, dated to ≈23–21 ka would push arrival earlier; the dating is debated."},
}

var pSites = []pSite{
	{"Dmanisi", [2]float64{44.3, 41.3}, 0, "≈1.8 Ma", "end", 14},
	{"Sangiran (Java)", [2]float64{110.9, -7.4}, 0, "≈1.5 Ma", "end", 14},
	{"Zhoukoudian", [2]float64{115.9, 39.7}, 0, "≈0.78–0.4 Ma", "end", 0},
	{"Jebel Irhoud", [2]float64{-8.9, 31.9}, 1, "≈315 ka", "end", 0},
	{"Omo Kibish", [2]float64{35.9, 5.4}, 1, "≥233 ka", "start", 14},
	{"Misliya", [2]float64{35, 32.7}, 2, "≈194–177 ka", "start", 16},
	{"Madjedbebe", [2]float64{132.9, -12.3}, 4, "≈65 ka?", "start", 14},
	{"Bacho Kiro", [2]float64{25.4, 43}, 5, "≈46 ka", "end", 0},
	{"White Sands", [2]float64{-106.2, 32.8}, 6, "≈23–21 ka?", "end", 0},
	{"Monte Verde", [2]float64{-73.2, -41.5}, 6, "≈14.5 ka", "start", 0},
}

var pRoutes = []pRoute{
	{0, [][2]float64{{36, 3}, {40, 20}, {44.3, 41.3}}, false, "var(--vec-out)"},
	{0, [][2]float64{{44.3, 41.3}, {65, 30}, {85, 22}, {100, 12}, {110.9, -7.4}}, false, "var(--vec-out)"},
	{0, [][2]float64{{100, 12}, {108, 28}, {115.9, 39.7}}, false, "var(--vec-out)"},
	{2, [][2]float64{{36, 3}, {33, 22}, {35, 32.7}}, true, "var(--vec-u)"},
	{3, [][2]float64{{38, 6}, {43.4, 12.6}, {55, 20}, {66, 25}, {77, 18}, {92, 20}, {100, 12}, {108, -2}}, false, "var(--vec-u)"},
	{4, [][2]float64{{108, -2}, {118, -8}, {126, -9}, {132.9, -12.3}}, false, "var(--vec-u)"},
	{5, [][2]float64{{55, 20}, {40, 33}, {33, 38}, {25.4, 43}, {10, 48}}, false, "var(--vec-u)"},
	{6, [][2]float64{{108, 28}, {125, 45}, {150, 60}, {179.5, 65}}, false, "var(--vec-u)"},
	{6, [][2]float64{{-179.5, 65}, {-160, 64}, {-135, 58}, {-122, 45}, {-106.2, 32.8}, {-96, 18}, {-79, 4}, {-76, -20}, {-73.2, -41.5}}, false, "var(--vec-u)"},
}

func paleoMap() h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("paleo-map", ""),
		h.Div(h.Class("min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"),
			h.Svg(h.ViewBox("0 30 720 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Schematic world map of hominin dispersals"),
				h.Map(pLand, func(poly [][2]float64) h.Node {
					return h.El("path", h.Attr("d", pPath(poly, true)), h.Attr("style", "fill:color-mix(in oklab, var(--foreground) 7%, transparent);stroke:color-mix(in oklab, var(--foreground) 22%, transparent);stroke-width:0.75;stroke-linejoin:round"))
				}),
				h.Map(pRoutes, func(r pRoute) h.Node {
					dash := ""
					if r.dashed {
						dash = ";stroke-dasharray:4 4"
					}
					return h.El("path", h.Data("at", fmt.Sprint(r.step)), h.Attr("d", pPath(r.pts, false)), h.Attr("pathLength", "1"),
						h.Class("transition-[stroke-dashoffset,opacity] duration-700 ease-[var(--ease-in-out)] motion-reduce:transition-none"),
						h.Attr("style", "fill:none;stroke:"+r.color+";stroke-width:2;stroke-linecap:round;stroke-linejoin:round"+dash))
				}),
				h.Map(pSites, func(s pSite) h.Node {
					x, y := pProj(s.at)
					dx := 5.0
					if s.anchor == "end" {
						dx = -5
					}
					return h.El("g", h.Data("at", fmt.Sprint(s.step)), h.Class("transition-opacity duration-300"),
						h.El("circle", h.Attr("cx", pf(x)), h.Attr("cy", pf(y)), h.Attr("r", "3"), h.Attr("style", "fill:var(--background);stroke:var(--brand);stroke-width:1.75")),
						pText(x+dx, y-5+s.dy, s.name+" "+s.date, h.Attr("text-anchor", s.anchor), h.Class("fill-foreground text-[9px]")),
					)
				}),
			),
		),
		h.Div(h.Class("flex flex-col gap-4 p-5"),
			h.Div(h.Class("flex items-center justify-between"),
				panelLabel("Step"),
				h.Span(h.Data("out", "count"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("1 / %d", len(pSteps))),
			),
			h.Div(h.Class("flex min-h-56 flex-col gap-2"),
				h.MapIdx(pSteps, func(i int, st pStep) h.Node {
					return h.Div(h.Data("step", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("flex flex-col gap-2"),
						h.Span(h.Class("font-mono text-xs text-brand"), st.date),
						h.P(h.Class("text-base font-semibold tracking-tight"), st.title),
						h.P(h.Class("text-sm leading-relaxed text-muted-foreground"), st.body),
					)
				}),
			),
			h.Div(h.Class("mt-auto flex items-center justify-between gap-2 border-t pt-4"),
				pStepButton("-1", "Back"),
				h.Div(h.Class("flex gap-1"), h.Aria("hidden", "true"),
					h.Range(len(pSteps), func(i int) h.Node {
						return h.Span(h.Data("pip", fmt.Sprint(i)), h.If(i == 0, h.Data("on", "")),
							h.Class("h-1.5 w-1.5 rounded-full bg-foreground/15 transition-[width,background-color] duration-200 data-[on]:w-4 data-[on]:bg-brand"))
					})),
				pStepButton("1", "Next"),
			),
		),
	)
}
