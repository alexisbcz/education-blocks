package site

import (
	"fmt"
	"math"
	"strings"

	h "github.com/alexisbcz/libhtml"
)

// PaleoBlocks lists the paleoanthropology gallery in display order.
func PaleoBlocks() []Block {
	return []Block{
		paleoRangesBlock(),
		paleoCraniaBlock(),
		paleoMapBlock(),
		paleoBipedalBlock(),
		paleoDatingBlock(),
		paleoTreeBlock(),
		paleoToolsBlock(),
		paleoDNABlock(),
		paleoSourceBlock(),
		paleoGlossaryBlock(),
	}
}

// Dates are in millions of years ago (Ma). The values are the widely cited
// ones; most are debated at the edges, and the notes say where.
type pHominin struct {
	key, name, genus string
	start, end       float64 // Ma, start older than end
	fuzz             float64 // uncertainty drawn as faded ends, Ma
	fossils, note    string
}

var pHominins = []pHominin{
	{"sahel", "Sahelanthropus tchadensis", "early", 7.2, 6.8, 0.2,
		"“Toumaï” cranium, Djurab Desert, Chad (found 2001, described 2002).",
		"Whether it walked upright, and so whether it is a hominin at all, is debated."},
	{"orrorin", "Orrorin tugenensis", "early", 6.1, 5.7, 0.1,
		"Femora and teeth, Tugen Hills, Kenya (2000).",
		"Femur shape is read by many as evidence of bipedalism."},
	{"kadabba", "Ardipithecus kadabba", "early", 5.8, 5.2, 0.1,
		"Teeth and fragments, Middle Awash, Ethiopia.", ""},
	{"ramidus", "Ardipithecus ramidus", "early", 4.5, 4.3, 0.05,
		"“Ardi” (ARA-VP-6/500), Aramis, Ethiopia, ≈4.4 Ma; described 2009.",
		"A mix of climbing and upright walking; its grasping big toe stayed opposable."},
	{"anamensis", "Australopithecus anamensis", "aus", 4.2, 3.8, 0.1,
		"Kanapoi and Allia Bay, Kenya; the MRD cranium, Woranso-Mille, Ethiopia (≈3.8 Ma).", ""},
	{"afarensis", "Australopithecus afarensis", "aus", 3.9, 2.9, 0.05,
		"“Lucy” (AL 288-1, ≈3.2 Ma, Hadar, Ethiopia, 1974); the Dikika child; the Laetoli footprints (≈3.66 Ma) are usually attributed to it.",
		"Fully bipedal on the ground, with long arms and curved fingers still suited to climbing."},
	{"platyops", "Kenyanthropus platyops", "aus", 3.5, 3.2, 0.05,
		"Flat-faced cranium KNM-WT 40000, Lomekwi, Kenya (2001).",
		"Whether it deserves its own genus is debated; the cranium is badly distorted."},
	{"africanus", "Australopithecus africanus", "aus", 3.0, 2.1, 0.1,
		"The Taung Child (Dart, 1925); “Mrs. Ples” (Sts 5), Sterkfontein, South Africa.", ""},
	{"sediba", "Australopithecus sediba", "aus", 1.98, 1.97, 0.01,
		"Two partial skeletons, Malapa, South Africa (2008).",
		"A mosaic of Australopithecus and Homo traits; its place in our ancestry is debated."},
	{"aethiopicus", "Paranthropus aethiopicus", "para", 2.7, 2.3, 0.05,
		"The “Black Skull” (KNM-WT 17000), West Turkana, ≈2.5 Ma.", ""},
	{"boisei", "Paranthropus boisei", "para", 2.3, 1.4, 0.05,
		"OH 5, “Nutcracker Man”, Olduvai Gorge (1959).",
		"Huge molars and a sagittal crest anchoring powerful chewing muscles."},
	{"robustus", "Paranthropus robustus", "para", 2.0, 1.0, 0.1,
		"Kromdraai and Swartkrans, South Africa (Broom, 1938).", ""},
	{"habilis", "Homo habilis", "homo", 2.4, 1.4, 0.1,
		"OH 7, the type specimen, Olduvai Gorge (named 1964).",
		"Whether it belongs in Homo is debated."},
	{"rudolfensis", "Homo rudolfensis", "homo", 2.4, 1.8, 0.1,
		"KNM-ER 1470, Koobi Fora, Kenya.", "A separate species or variation within H. habilis: debated."},
	{"erectus", "Homo erectus", "homo", 1.9, 0.11, 0.05,
		"Java (Dubois, 1891); Zhoukoudian; Dmanisi (≈1.8 Ma); the “Turkana Boy” (KNM-WT 15000, ≈1.5 Ma); last at Ngandong, Java, ≈117–108 ka.",
		"African early forms are sometimes split off as H. ergaster."},
	{"heidelbergensis", "Homo heidelbergensis", "homo", 0.7, 0.2, 0.05,
		"The Mauer mandible (1907); Kabwe (Broken Hill) cranium, ≈299 ka.",
		"What this name should cover is one of the field's longest debates."},
	{"naledi", "Homo naledi", "homo", 0.335, 0.236, 0.01,
		"Over 1,500 bones, Rising Star Cave, South Africa (described 2015).",
		"Small brain, yet surprisingly recent."},
	{"neanderthalensis", "Homo neanderthalensis", "homo", 0.4, 0.04, 0.02,
		"Feldhofer Cave, Neander Valley (1856); Sima de los Huesos (≈430 ka) on its lineage.",
		"Disappears around 40 ka, after interbreeding with H. sapiens."},
	{"denisova", "Denisovans", "homo", 0.2, 0.05, 0.05,
		"A finger bone from Denisova Cave, Siberia (genome 2010); the Baishiya Karst mandible, Tibet (≥160 ka).",
		"Known mainly from DNA; the fossil record is tiny and the range is uncertain."},
	{"floresiensis", "Homo floresiensis", "homo", 0.1, 0.06, 0.01,
		"LB1, Liang Bua, Flores (2003). Skeletal remains ≈100–60 ka after the 2016 redating; stone tools to ≈50 ka.", ""},
	{"luzonensis", "Homo luzonensis", "homo", 0.067, 0.05, 0.005,
		"Teeth and bones, Callao Cave, Luzon, Philippines (described 2019).", ""},
	{"sapiens", "Homo sapiens", "homo", 0.315, 0, 0.03,
		"Jebel Irhoud, Morocco (≈315 ka); Omo Kibish, Ethiopia (≥233 ka).",
		"Us. Every other species on this chart is extinct."},
}

var pGenusColor = map[string]string{
	"early": "var(--ion-k)",
	"aus":   "var(--vec-out)",
	"para":  "var(--ion-cl)",
	"homo":  "var(--vec-u)",
}

var pGenusName = map[string]string{
	"early": "Earliest hominins",
	"aus":   "Australopithecus & Kenyanthropus",
	"para":  "Paranthropus",
	"homo":  "Homo",
}

// Time scales: x for a date in Ma. Log scales cannot reach 0, so the
// present sits at 10 ka.
type pScale struct {
	log         bool
	old, young  float64 // Ma
	left, width float64
}

func (s pScale) x(ma float64) float64 {
	if s.log {
		ma = math.Max(ma, s.young)
		return s.left + (math.Log10(s.old)-math.Log10(ma))/(math.Log10(s.old)-math.Log10(s.young))*s.width
	}
	return s.left + (s.old-ma)/(s.old-s.young)*s.width
}

func pMaLabel(ma float64) string {
	switch {
	case ma >= 1:
		return pTrim(ma) + " Ma"
	case ma >= 0.0105:
		return pTrim(ma*1000) + " ka"
	default:
		return "now"
	}
}

func pTrim(v float64) string {
	s := fmt.Sprintf("%.2f", v)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	return s
}

func pText(x, y float64, s string, extra ...any) h.Node {
	return h.El("text", append([]any{h.Attr("x", pf(x)), h.Attr("y", pf(y)), h.Class("fill-muted-foreground font-mono text-[10px]")}, extra...), s)
}

func pf(v float64) string { return fmt.Sprintf("%.1f", v) }

func pLine(x1, y1, x2, y2 float64, style string, extra ...any) h.Node {
	return h.El("line", append([]any{h.Attr("x1", pf(x1)), h.Attr("y1", pf(y1)), h.Attr("x2", pf(x2)), h.Attr("y2", pf(y2)), h.Attr("style", style)}, extra...)...)
}

func pRect(x, y, w, hh float64, style string, extra ...any) h.Node {
	return h.El("rect", append([]any{h.Attr("x", pf(x)), h.Attr("y", pf(y)), h.Attr("width", pf(math.Max(w, 1.5))), h.Attr("height", pf(hh)), h.Attr("style", style)}, extra...)...)
}

// pTimeAxis draws gridlines and labels for the given ticks.
func pTimeAxis(s pScale, top, bottom float64, ticks []float64) h.Node {
	return h.Group(h.Map(ticks, func(t float64) h.Node {
		x := s.x(t)
		return h.Group(
			pLine(x, top, x, bottom, "stroke:currentColor;stroke-opacity:0.07"),
			pText(x, bottom+13, pMaLabel(t), h.Attr("text-anchor", "middle")),
		)
	}))
}

var pLogTicks = []float64{7, 5, 3, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01}
var pLinTicks = []float64{7, 6, 5, 4, 3, 2, 1, 0}
