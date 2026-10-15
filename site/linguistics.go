package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LinguisticsBlocks lists the linguistics gallery in display order.
func LinguisticsBlocks() []Block {
	return []Block{
		lingIPABlock(),
		lingFormantBlock(),
		lingSyntaxBlock(),
		lingMorphologyBlock(),
		lingZipfBlock(),
		lingFamilyBlock(),
		lingGrimmBlock(),
		lingWritingBlock(),
	}
}

// lingIPAFont is a stack of fonts that carry the IPA. Fonts must be local
// (font-src 'self'), so this relies on what the system has.
const lingIPAFont = `font-family:"Charis SIL","Doulos SIL","Gentium Plus","Noto Sans","Lucida Grande","Helvetica Neue","Arial Unicode MS",serif`

// ---------------------------------------------------------------- L1

type lingVowel struct {
	sym, height, back string
	rounded           bool
	ex                string
}

// The vowels of the IPA chart (2020), with height and backness as the chart
// places them. Examples use Wells' lexical sets for English.
var lingVowels = []lingVowel{
	{"i", "close", "front", false, "English FLEECE; French si"},
	{"y", "close", "front", true, "French tu; German über"},
	{"ɨ", "close", "central", false, "Russian ты (approximately)"},
	{"ʉ", "close", "central", true, ""},
	{"ɯ", "close", "back", false, "Turkish ı (kız)"},
	{"u", "close", "back", true, "English GOOSE (conservative accents); Spanish tú"},
	{"ɪ", "near-close", "near-front", false, "English KIT"},
	{"ʏ", "near-close", "near-front", true, "German hübsch"},
	{"ʊ", "near-close", "near-back", true, "English FOOT"},
	{"e", "close-mid", "front", false, "French été; Spanish e"},
	{"ø", "close-mid", "front", true, "French deux"},
	{"ɘ", "close-mid", "central", false, ""},
	{"ɵ", "close-mid", "central", true, ""},
	{"ɤ", "close-mid", "back", false, ""},
	{"o", "close-mid", "back", true, "French eau; Spanish o"},
	{"ə", "mid", "central", false, "English COMMA (unstressed, schwa)"},
	{"ɛ", "open-mid", "front", false, "English DRESS; French fête"},
	{"œ", "open-mid", "front", true, "French sœur"},
	{"ɜ", "open-mid", "central", false, "English NURSE (RP, approximately)"},
	{"ɞ", "open-mid", "central", true, ""},
	{"ʌ", "open-mid", "back", false, "English STRUT (as traditionally transcribed)"},
	{"ɔ", "open-mid", "back", true, "English THOUGHT (some accents)"},
	{"æ", "near-open", "front", false, "English TRAP"},
	{"ɐ", "near-open", "central", false, "Portuguese a in cama"},
	{"a", "open", "front", false, "French patte"},
	{"ɶ", "open", "front", true, ""},
	{"ɑ", "open", "back", false, "English PALM"},
	{"ɒ", "open", "back", true, "English LOT (RP)"},
}

var lingHeightY = map[string]float64{"close": 0, "near-close": 40, "close-mid": 80, "mid": 120, "open-mid": 160, "near-open": 200, "open": 240}

// lingVowelX places a backness on the trapezoid at height y (0..240): the
// front edge slants from 0 to 170, the back edge is vertical at 340.
func lingVowelX(back string, y float64) float64 {
	front := y / 240 * 170
	central := 170 + y/240*85
	switch back {
	case "front":
		return front
	case "near-front":
		return front + 0.35*(central-front)
	case "central":
		return central
	case "near-back":
		return 340 - 0.35*(340-central)
	}
	return 340
}

type lingCons struct {
	sym, voice, place, manner, ex string
}

var lingPlaces = []string{"bilabial", "labiodental", "dental", "alveolar", "postalveolar", "retroflex", "palatal", "velar", "uvular", "pharyngeal", "glottal"}
var lingManners = []string{"plosive", "nasal", "trill", "tap or flap", "fricative", "lateral fricative", "approximant", "lateral approximant"}

// The pulmonic consonants of the IPA chart (2020).
var lingConsonants = []lingCons{
	{"p", "voiceless", "bilabial", "plosive", "English pin"}, {"b", "voiced", "bilabial", "plosive", "English bin"},
	{"t", "voiceless", "alveolar", "plosive", "English tin"}, {"d", "voiced", "alveolar", "plosive", "English din"},
	{"ʈ", "voiceless", "retroflex", "plosive", "Hindi ट"}, {"ɖ", "voiced", "retroflex", "plosive", "Hindi ड"},
	{"c", "voiceless", "palatal", "plosive", "Hungarian ty"}, {"ɟ", "voiced", "palatal", "plosive", "Hungarian gy"},
	{"k", "voiceless", "velar", "plosive", "English kin"}, {"ɡ", "voiced", "velar", "plosive", "English go"},
	{"q", "voiceless", "uvular", "plosive", "Arabic ق (Standard)"}, {"ɢ", "voiced", "uvular", "plosive", ""},
	{"ʔ", "voiceless", "glottal", "plosive", "the catch in English uh-oh"},
	{"m", "voiced", "bilabial", "nasal", "English man"}, {"ɱ", "voiced", "labiodental", "nasal", "English comfort, before f"},
	{"n", "voiced", "alveolar", "nasal", "English no"}, {"ɳ", "voiced", "retroflex", "nasal", "Tamil ண"},
	{"ɲ", "voiced", "palatal", "nasal", "Spanish ñ (año)"}, {"ŋ", "voiced", "velar", "nasal", "English sing"},
	{"ɴ", "voiced", "uvular", "nasal", "Japanese ん at the end of a phrase"},
	{"ʙ", "voiced", "bilabial", "trill", ""}, {"r", "voiced", "alveolar", "trill", "Spanish perro"},
	{"ʀ", "voiced", "uvular", "trill", "some French and German speakers' r"},
	{"ⱱ", "voiced", "labiodental", "tap or flap", ""}, {"ɾ", "voiced", "alveolar", "tap or flap", "Spanish pero; American English better"},
	{"ɽ", "voiced", "retroflex", "tap or flap", "Hindi ड़"},
	{"ɸ", "voiceless", "bilabial", "fricative", "Japanese ふ (fu)"}, {"β", "voiced", "bilabial", "fricative", "Spanish lobo, between vowels"},
	{"f", "voiceless", "labiodental", "fricative", "English fan"}, {"v", "voiced", "labiodental", "fricative", "English van"},
	{"θ", "voiceless", "dental", "fricative", "English thin"}, {"ð", "voiced", "dental", "fricative", "English this"},
	{"s", "voiceless", "alveolar", "fricative", "English sip"}, {"z", "voiced", "alveolar", "fricative", "English zip"},
	{"ʃ", "voiceless", "postalveolar", "fricative", "English ship"}, {"ʒ", "voiced", "postalveolar", "fricative", "English measure"},
	{"ʂ", "voiceless", "retroflex", "fricative", "Mandarin sh"}, {"ʐ", "voiced", "retroflex", "fricative", ""},
	{"ç", "voiceless", "palatal", "fricative", "German ich"}, {"ʝ", "voiced", "palatal", "fricative", ""},
	{"x", "voiceless", "velar", "fricative", "German Bach; Scottish loch"}, {"ɣ", "voiced", "velar", "fricative", "Spanish agua, between vowels"},
	{"χ", "voiceless", "uvular", "fricative", ""}, {"ʁ", "voiced", "uvular", "fricative", "French rouge (often)"},
	{"ħ", "voiceless", "pharyngeal", "fricative", "Arabic ح"}, {"ʕ", "voiced", "pharyngeal", "fricative", "Arabic ع"},
	{"h", "voiceless", "glottal", "fricative", "English hat"}, {"ɦ", "voiced", "glottal", "fricative", "English ahead, for many speakers"},
	{"ɬ", "voiceless", "alveolar", "lateral fricative", "Welsh ll (llan)"}, {"ɮ", "voiced", "alveolar", "lateral fricative", ""},
	{"ʋ", "voiced", "labiodental", "approximant", "Hindi व; Dutch w (often)"}, {"ɹ", "voiced", "alveolar", "approximant", "English red"},
	{"ɻ", "voiced", "retroflex", "approximant", "Tamil ழ"}, {"j", "voiced", "palatal", "approximant", "English yes"},
	{"ɰ", "voiced", "velar", "approximant", ""},
	{"l", "voiced", "alveolar", "lateral approximant", "English let"}, {"ɭ", "voiced", "retroflex", "lateral approximant", ""},
	{"ʎ", "voiced", "palatal", "lateral approximant", "Italian figlio"}, {"ʟ", "voiced", "velar", "lateral approximant", ""},
}

// lingImpossible lists cells the IPA chart shades: articulations judged
// impossible.
var lingImpossible = map[string]bool{
	"nasal/pharyngeal": true, "nasal/glottal": true,
	"trill/velar": true, "trill/pharyngeal": true, "trill/glottal": true,
	"tap or flap/velar": true, "tap or flap/glottal": true,
	"lateral fricative/bilabial": true, "lateral fricative/labiodental": true, "lateral fricative/pharyngeal": true, "lateral fricative/glottal": true,
	"lateral approximant/bilabial": true, "lateral approximant/labiodental": true, "lateral approximant/pharyngeal": true, "lateral approximant/glottal": true,
}

func lingSymButton(sym, desc, ex string) h.Node {
	return h.Button(h.Type("button"), h.Data("ipa", sym), h.Data("desc", desc), h.Data("ex", ex),
		h.Aria("label", desc), h.Style(lingIPAFont),
		h.Class("rounded px-1 text-lg leading-7 transition-colors duration-100 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:bg-brand/15 data-[on]:text-brand"),
		sym)
}

func lingCap(s string) string { return strings.ToUpper(s[:1]) + s[1:] }

func lingVowelChart() h.Node {
	const ox, oy = 76.0, 28.0
	pt := func(x, y float64) string { return fmt.Sprintf("%.1f,%.1f", ox+x, oy+y) }
	var marks []h.Node
	for _, v := range lingVowels {
		y := lingHeightY[v.height]
		x := lingVowelX(v.back, y)
		desc := lingCap(fmt.Sprintf("%s %s %s vowel", v.height, v.back, map[bool]string{true: "rounded", false: "unrounded"}[v.rounded]))
		if v.sym == "ə" || v.sym == "ɐ" {
			desc = lingCap(fmt.Sprintf("%s %s vowel", v.height, v.back))
		}
		dx := -14.0
		if v.rounded {
			dx = 14
		}
		if v.sym == "ə" || v.sym == "ɐ" {
			dx = 0
		}
		marks = append(marks, h.El("circle", h.Attr("cx", fmt.Sprintf("%.1f", ox+x)), h.Attr("cy", fmt.Sprintf("%.1f", oy+y)), h.Attr("r", "2.5"), h.Class("fill-foreground/50")))
		marks = append(marks, h.El("foreignObject", h.Attr("x", fmt.Sprintf("%.1f", ox+x+dx-14)), h.Attr("y", fmt.Sprintf("%.1f", oy+y-15)), h.Attr("width", "28"), h.Attr("height", "30"),
			h.Div(h.Class("flex size-full items-center justify-center"), lingSymButton(v.sym, desc, v.ex))))
	}
	return h.Svg(h.ViewBox("0 0 450 300"), h.Class("block w-full max-w-[580px]"), h.Role("group"), h.Aria("label", "IPA vowel chart"),
		h.El("polygon", h.Attr("points", strings.Join([]string{pt(0, 0), pt(340, 0), pt(340, 240), pt(170, 240)}, " ")), h.Class("fill-none stroke-foreground/40"), h.Attr("stroke-width", "1.2")),
		h.El("line", h.Attr("x1", fmt.Sprint(ox+170)), h.Attr("y1", fmt.Sprint(oy)), h.Attr("x2", fmt.Sprint(ox+255)), h.Attr("y2", fmt.Sprint(oy+240)), h.Class("stroke-foreground/25")),
		h.El("line", h.Attr("x1", fmt.Sprintf("%.1f", ox+80.0/240*170)), h.Attr("y1", fmt.Sprint(oy+80)), h.Attr("x2", fmt.Sprint(ox+340)), h.Attr("y2", fmt.Sprint(oy+80)), h.Class("stroke-foreground/25")),
		h.El("line", h.Attr("x1", fmt.Sprintf("%.1f", ox+160.0/240*170)), h.Attr("y1", fmt.Sprint(oy+160)), h.Attr("x2", fmt.Sprint(ox+340)), h.Attr("y2", fmt.Sprint(oy+160)), h.Class("stroke-foreground/25")),
		h.Map([][3]string{{"Front", "0", "-12"}, {"Central", "170", "-12"}, {"Back", "340", "-12"}}, func(l [3]string) h.Node {
			return h.El("text", h.Attr("x", fmt.Sprint(ox+lingAtof(l[1]))), h.Attr("y", fmt.Sprint(oy+lingAtof(l[2]))), h.Attr("text-anchor", "middle"), h.Class("fill-muted-foreground font-mono text-[10px]"), l[0])
		}),
		h.Map([][2]string{{"Close", "0"}, {"Close-mid", "80"}, {"Open-mid", "160"}, {"Open", "240"}}, func(l [2]string) h.Node {
			y := lingAtof(l[1])
			return h.El("text", h.Attr("x", fmt.Sprintf("%.1f", ox+y/240*170-30)), h.Attr("y", fmt.Sprint(oy+y+3)), h.Attr("text-anchor", "end"), h.Class("fill-muted-foreground font-mono text-[10px]"), l[0])
		}),
		h.Group(marks),
	)
}

func lingAtof(s string) float64 {
	var f float64
	fmt.Sscan(s, &f)
	return f
}

func lingConsonantChart() h.Node {
	short := map[string]string{"bilabial": "Bilabial", "labiodental": "Labio-dental", "dental": "Dental", "alveolar": "Alveolar", "postalveolar": "Post-alveolar", "retroflex": "Retroflex", "palatal": "Palatal", "velar": "Velar", "uvular": "Uvular", "pharyngeal": "Pharyn-geal", "glottal": "Glottal"}
	cell := func(manner, place string) h.Node {
		var vl, vd h.Node
		for _, c := range lingConsonants {
			if c.manner != manner || c.place != place {
				continue
			}
			desc := lingCap(fmt.Sprintf("%s %s %s", c.voice, c.place, c.manner))
			b := lingSymButton(c.sym, desc, c.ex)
			if c.voice == "voiceless" {
				vl = b
			} else {
				vd = b
			}
		}
		shaded := lingImpossible[manner+"/"+place]
		return h.Td(h.Class("h-10 border px-0.5 text-center "+h.Ternary(shaded, "bg-foreground/10", "")),
			h.Div(h.Class("grid grid-cols-2"), h.Span(h.Class("flex justify-center"), vl), h.Span(h.Class("flex justify-center"), vd)))
	}
	return h.Div(h.Class("scroll-thin overflow-x-auto"),
		h.Table(h.Class("w-full min-w-[700px] border-collapse text-sm"),
			h.Thead(h.Tr(h.Th(),
				h.Map(lingPlaces, func(p string) h.Node {
					return h.Th(h.Class("border px-0.5 py-1.5 text-[10px] font-normal leading-tight text-muted-foreground"), short[p])
				}))),
			h.Tbody(h.Map(lingManners, func(m string) h.Node {
				return h.Tr(h.Th(h.Class("border px-2 py-1 text-left text-[11px] font-normal whitespace-nowrap text-muted-foreground"), lingCap(m)),
					h.Map(lingPlaces, func(p string) h.Node { return cell(m, p) }))
			})),
		),
		h.P(h.Class("pt-2 text-xs text-muted-foreground"), "Where symbols appear in pairs, the one on the left is voiceless. Shaded cells are articulations judged impossible."),
	)
}

func lingIPABlock() Block {
	return Block{
		Slug:        "ipa",
		Title:       "IPA chart",
		Description: "The International Phonetic Alphabet as the official chart lays it out: vowels on the trapezoid of tongue height and backness, pulmonic consonants by place and manner. Click a symbol to read its full name and an example. No recordings: synthetic speech would teach the wrong sounds.",
		Tags:        []string{"IPA", "phonetics", "chart"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("ling-ipa", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					segs("Chart", [2]string{"vowels", "Vowels"}, [2]string{"consonants", "Consonants"}),
					h.Div(h.Data("view", "vowels"), h.Class("flex justify-center"), lingVowelChart()),
					h.Div(h.Data("view", "consonants"), h.Hidden(), lingConsonantChart()),
				),
				h.Div(h.Class("flex flex-col gap-3 p-5"),
					panelLabel("Symbol"),
					h.Div(h.Data("out", "sym"), h.Style(lingIPAFont), h.Class("text-5xl leading-none"), "ə"),
					h.P(h.Data("out", "desc"), h.Class("text-sm font-medium"), "Mid central vowel"),
					h.P(h.Data("out", "ex"), h.Class("text-sm leading-relaxed text-muted-foreground"), "English COMMA (unstressed, schwa)"),
					h.P(h.Class("mt-auto border-t pt-3 text-xs leading-relaxed text-muted-foreground"),
						"Chart after the IPA (2020). Example words follow Wells' lexical sets (FLEECE, KIT, …); real pronunciations vary by accent."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L2

// Average formants of American English vowels, adult men, after
// Hillenbrand, Getty, Clark & Wheeler (1995), JASA 97(5): rounded to Hz.
var lingFormants = []struct {
	sym, word string
	f1, f2    int
}{
	{"i", "heed", 342, 2322}, {"ɪ", "hid", 427, 2034}, {"e", "hayed", 476, 2089}, {"ɛ", "head", 580, 1799},
	{"æ", "had", 588, 1952}, {"ɑ", "hod", 768, 1333}, {"ɔ", "hawed", 652, 997}, {"o", "hoed", 497, 910},
	{"ʊ", "hood", 469, 1122}, {"u", "who'd", 378, 997}, {"ʌ", "hud", 623, 1200}, {"ɝ", "heard", 474, 1379},
}

func lingFormantBlock() Block {
	return Block{
		Slug:        "formants",
		Title:       "Vowel formants",
		Description: "Vowels are told apart by their formants, the resonances of the vocal tract. Plotted F2 against F1, with both axes reversed, the measurements fall into the shape of the IPA trapezoid. Drag the target and play a rough three-formant synthesis of it.",
		Tags:        []string{"acoustics", "F1/F2", "Web Audio"},
		Wide:        true,
		Render: func() h.Node {
			var pts []string
			for _, f := range lingFormants {
				pts = append(pts, fmt.Sprintf("%s|%s|%d|%d", f.sym, f.word, f.f1, f.f2))
			}
			return plotPanel("ling-formant",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 380"), h.Class("mx-auto block w-full max-w-[640px] touch-none select-none"),
						h.Role("img"), h.Aria("label", "Vowels by first and second formant. Drag the target."), h.Style(lingIPAFont)),
					h.Template(h.Data("points", strings.Join(pts, ";"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Target"),
					field("f1", "F1", "Hz", 500, 200, 1000, 5),
					field("f2", "F2", "Hz", 1500, 600, 2600, 5),
					field("f0", "Pitch f0", "Hz", 120, 70, 300, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), hugeicons.VolumeHighIcon(), "Play"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "glide"), hugeicons.ArrowRight01Icon(), "i → ɑ → u"),
				),
				readouts([2]string{"nearest", "nearest"}, [2]string{"distance", "dist"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Data: adult male averages from Hillenbrand et al. (1995), rounded. The sound is a sawtooth through three band-pass filters (F3 fixed at 2500 Hz): a crude synthesis that only suggests the vowel."),
			)
		},
	}
}

// ---------------------------------------------------------------- L3

var lingTrees = [][2]string{
	{"The cat sat on the mat", "[S [NP [D The] [N cat]] [VP [V sat] [PP [P on] [NP [D the] [N mat]]]]]"},
	{"She saw the man with a telescope (1)", "[S [NP She] [VP [V saw] [NP [D the] [N man]] [PP [P with] [NP [D a] [N telescope]]]]]"},
	{"She saw the man with a telescope (2)", "[S [NP She] [VP [V saw] [NP [D the] [N' [N man] [PP [P with] [NP [D a] [N telescope]]]]]]]"},
	{"Colorless green ideas sleep furiously", "[S [NP [AdjP [Adj Colorless] [Adj green]] [N ideas]] [VP [V sleep] [AdvP furiously]]]"},
}

func lingSyntaxBlock() Block {
	return Block{
		Slug:        "syntax-tree",
		Title:       "Syntax trees",
		Description: "Phrase structure in both of its usual notations. Edit the labelled brackets and the tree redraws; the two readings of 'with a telescope' show that one string of words can have two structures, and so two meanings.",
		Tags:        []string{"phrase structure", "parser", "ambiguity"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4"), h.Data("ling-syntax", ""),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.MapIdx(lingTrees, func(i int, t [2]string) h.Node {
						return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("tree", t[1]), h.Class("font-normal"), t[0])
					}),
				),
				h.Label(h.Class("flex flex-col gap-1.5"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Labelled brackets"),
					h.Textarea(h.Data("input", ""), h.Attr("rows", "2"), h.Attr("spellcheck", "false"),
						h.Class("w-full resize-y rounded-md border border-input bg-code px-3 py-2 font-mono text-[13px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						lingTrees[0][1]),
				),
				h.P(h.Data("out", "error"), h.Aria("live", "polite"), h.Class("min-h-4 text-xs text-del")),
				h.Div(h.Class("scroll-thin overflow-x-auto rounded-lg border bg-code p-2"),
					h.Svg(h.Data("tree", ""), h.Class("mx-auto block"), h.Role("img"), h.Aria("label", "Syntax tree"))),
				h.P(h.Class("text-xs text-muted-foreground"),
					"S sentence · NP noun phrase · VP verb phrase · PP prepositional phrase · D determiner · N′ an intermediate noun level (X-bar). The fourth sentence is Chomsky's (1957): grammatical, yet meaningless."),
			)
		},
	}
}

// ---------------------------------------------------------------- L4

type lingMorph struct {
	form, kind, gloss string
}

var lingWords = []struct {
	word   string
	parts  []lingMorph
	result string
}{
	{"unbreakable", []lingMorph{{"un-", "derivational prefix", "not"}, {"break", "root (verb)", "break"}, {"-able", "derivational suffix", "verb → adjective: can be …ed"}}, "adjective: cannot be broken"},
	{"teachers", []lingMorph{{"teach", "root (verb)", "teach"}, {"-er", "derivational suffix", "verb → noun: one who …"}, {"-s", "inflectional suffix", "plural"}}, "noun, plural"},
	{"nationalization", []lingMorph{{"nation", "root (noun)", "nation"}, {"-al", "derivational suffix", "noun → adjective"}, {"-ize", "derivational suffix", "adjective → verb"}, {"-ation", "derivational suffix", "verb → noun: the process of"}}, "noun"},
	{"rewritten", []lingMorph{{"re-", "derivational prefix", "again"}, {"writ(e)", "root (verb)", "write"}, {"-en", "inflectional suffix", "past participle"}}, "verb, past participle"},
	{"happiness", []lingMorph{{"happi", "root (adjective)", "happy (y → i before a suffix)"}, {"-ness", "derivational suffix", "adjective → noun: state of"}}, "noun"},
	{"walked", []lingMorph{{"walk", "root (verb)", "walk"}, {"-ed", "inflectional suffix", "past tense"}}, "verb, past tense"},
}

func lingMorphologyBlock() Block {
	color := func(kind string) string {
		switch {
		case strings.HasPrefix(kind, "root"):
			return "border-foreground/30 bg-foreground/5"
		case strings.HasPrefix(kind, "inflectional"):
			return "border-[var(--vec-u)]/50 bg-[var(--vec-u)]/10"
		}
		return "border-brand/40 bg-brand/10"
	}
	return Block{
		Slug:        "morphology",
		Title:       "Morphology",
		Description: "Words cut into morphemes, the smallest pieces that carry meaning. Derivational affixes make new words (often changing the word class); inflectional ones only mark grammar such as plural or tense, and come last.",
		Tags:        []string{"morphemes", "affixes", "tabs"},
		Render: func() h.Node {
			var opts [][2]string
			for _, w := range lingWords {
				opts = append(opts, [2]string{w.word, w.word})
			}
			return h.Div(h.Class("flex flex-col gap-5"),
				segs("Word", opts...),
				h.Map(lingWords, func(w struct {
					word   string
					parts  []lingMorph
					result string
				}) h.Node {
					return h.Div(h.Data("view", w.word), h.If(w.word != lingWords[0].word, h.Hidden()), h.Class("flex flex-col gap-4"),
						h.Div(h.Class("flex flex-wrap items-stretch gap-1.5"),
							h.Map(w.parts, func(m lingMorph) h.Node {
								return h.Div(h.Class("flex min-w-24 flex-col gap-1 rounded-lg border px-3 py-2 "+color(m.kind)),
									h.Span(h.Class("font-mono text-lg"), m.form),
									h.Span(h.Class("text-[11px] text-muted-foreground"), m.kind),
									h.Span(h.Class("text-xs"), m.gloss),
								)
							}),
						),
						h.P(h.Class("text-sm"), h.Span(h.Class("text-muted-foreground"), "Result: "), w.result),
					)
				}),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground"),
					h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2.5 rounded-sm border border-foreground/30 bg-foreground/5")), "root"),
					h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2.5 rounded-sm border border-brand/40 bg-brand/10")), "derivational"),
					h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2.5 rounded-sm border border-[var(--vec-u)]/50 bg-[var(--vec-u)]/10")), "inflectional"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L5

// The first two paragraphs of Alice's Adventures in Wonderland (Lewis
// Carroll, 1865), public domain.
const lingAlice = `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.`

func lingZipfBlock() Block {
	return Block{
		Slug:        "zipf",
		Title:       "Zipf's law",
		Description: "Count the words of any text and rank them: frequency falls roughly as 1/rank, a straight line of slope near −1 on log–log axes. Paste your own text; short texts are noisy, long ones line up.",
		Tags:        []string{"corpus", "log–log", "paste text"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ling-zipf",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Word frequency against rank, log–log")),
				h.Label(h.Class("flex flex-col gap-1.5"),
					h.Span(h.Class("text-xs text-muted-foreground"), "Text"),
					h.Textarea(h.Data("input", ""), h.Attr("rows", "7"),
						h.Class("w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-xs leading-relaxed shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						lingAlice),
				),
				h.P(h.Class("text-[11px] text-muted-foreground"), "Default: Lewis Carroll, Alice's Adventures in Wonderland (1865), chapter 1."),
				readouts([2]string{"words", "tokens"}, [2]string{"distinct", "types"}, [2]string{"slope", "slope"}, [2]string{"top 5", "top"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L6

type lingNode struct {
	name, note string
	extinct    bool
	kids       []lingNode
}

// A schematic Indo-European tree: main branches and some members. Higher
// groupings (Italo-Celtic, for instance) are debated and not shown.
var lingIE = lingNode{"Proto-Indo-European", "Reconstructed ancestor; spoken perhaps 4500–2500 BCE (dating and homeland debated).", true, []lingNode{
	{"Anatolian", "The earliest attested branch.", true, []lingNode{{"Hittite", "Attested from the 17th century BCE.", true, nil}, {"Luwian", "", true, nil}}},
	{"Tocharian", "Known from manuscripts in the Tarim Basin, 6th–8th c. CE.", true, []lingNode{{"Tocharian A", "", true, nil}, {"Tocharian B", "", true, nil}}},
	{"Indo-Iranian", "", false, []lingNode{
		{"Indo-Aryan", "", false, []lingNode{{"Sanskrit", "Classical and Vedic.", true, nil}, {"Hindi–Urdu", "", false, nil}, {"Bengali", "", false, nil}, {"Punjabi", "", false, nil}}},
		{"Iranian", "", false, []lingNode{{"Persian", "", false, nil}, {"Pashto", "", false, nil}, {"Kurdish", "", false, nil}}},
	}},
	{"Hellenic", "", false, []lingNode{{"Ancient Greek", "", true, nil}, {"Modern Greek", "", false, nil}}},
	{"Italic", "", false, []lingNode{
		{"Latin → Romance", "", false, []lingNode{{"Italian", "", false, nil}, {"French", "", false, nil}, {"Spanish", "", false, nil}, {"Portuguese", "", false, nil}, {"Romanian", "", false, nil}}},
		{"Oscan, Umbrian", "", true, nil},
	}},
	{"Celtic", "", false, []lingNode{{"Irish", "", false, nil}, {"Scottish Gaelic", "", false, nil}, {"Welsh", "", false, nil}, {"Breton", "", false, nil}, {"Gaulish", "", true, nil}}},
	{"Germanic", "", false, []lingNode{
		{"North", "", false, []lingNode{{"Icelandic", "", false, nil}, {"Norwegian", "", false, nil}, {"Swedish", "", false, nil}, {"Danish", "", false, nil}}},
		{"West", "", false, []lingNode{{"English", "", false, nil}, {"Frisian", "", false, nil}, {"Dutch", "", false, nil}, {"German", "", false, nil}}},
		{"East", "", true, []lingNode{{"Gothic", "Bible translation by Wulfila, 4th c. CE.", true, nil}}},
	}},
	{"Balto-Slavic", "", false, []lingNode{
		{"Baltic", "", false, []lingNode{{"Lithuanian", "", false, nil}, {"Latvian", "", false, nil}}},
		{"Slavic", "", false, []lingNode{{"Russian", "", false, nil}, {"Ukrainian", "", false, nil}, {"Polish", "", false, nil}, {"Czech", "", false, nil}, {"Serbo-Croatian", "", false, nil}, {"Bulgarian", "", false, nil}}},
	}},
	{"Armenian", "", false, nil},
	{"Albanian", "", false, nil},
}}

func lingTreeHTML(n lingNode, depth int) h.Node {
	label := h.Span(h.Class("flex items-baseline gap-1.5"),
		h.Span(h.Class(h.Ternary(len(n.kids) > 0, "font-medium", "")+h.Ternary(n.extinct, " text-muted-foreground", "")), n.name),
		h.If(n.extinct, h.Span(h.Class("text-[11px] text-muted-foreground"), "†")),
		h.If(n.note != "", h.Span(h.Class("text-[11px] text-muted-foreground"), "· "+n.note)),
	)
	if len(n.kids) == 0 {
		return h.Li(h.Class("relative py-0.5 pl-4 text-sm before:absolute before:top-3 before:left-0 before:h-px before:w-3 before:bg-border"), label)
	}
	return h.Li(h.Class(h.Ternary(depth == 0, "text-sm", "relative py-0.5 pl-4 text-sm before:absolute before:top-3 before:left-0 before:h-px before:w-3 before:bg-border")),
		label,
		h.Ul(h.Class("ml-1.5 border-l pl-1"), h.Map(n.kids, func(k lingNode) h.Node { return lingTreeHTML(k, depth+1) })),
	)
}

func lingFamilyBlock() Block {
	return Block{
		Slug:        "language-family",
		Title:       "Language family tree",
		Description: "Indo-European, the family of nearly half the world's population: ten branches descended from one reconstructed language. A dagger marks languages with no native speakers today. Schematic: only a few members per branch, and debated higher groupings are left out.",
		Tags:        []string{"historical linguistics", "tree"},
		Render: func() h.Node {
			return h.Div(h.Class("scroll-thin max-h-[560px] overflow-auto rounded-xl border bg-background p-4"),
				h.Ul(lingTreeHTML(lingIE, 0)),
			)
		},
	}
}

// ---------------------------------------------------------------- L7

var lingGrimm = []struct {
	pie, gmc, latin, english string
}{
	{"*p", "f", "pater, piscis, pēs (ped-)", "father, fish, foot"},
	{"*t", "θ (th)", "trēs, tenuis", "three, thin"},
	{"*k", "h", "cornū, centum, canis", "horn, hundred, hound"},
	{"*d", "t", "decem, dēns (dent-)", "ten, tooth"},
	{"*g", "k", "genū, grānum", "knee, corn"},
	{"*bʰ", "b", "Sanskrit bhrātar", "brother"},
	{"*dʰ", "d", "Sanskrit dhā- 'put'", "do"},
	{"*gʰ", "g", "hostis (Latin h < *gʰ)", "guest"},
}

func lingGrimmBlock() Block {
	return Block{
		Slug:        "grimm",
		Title:       "Grimm's law",
		Description: "Regular sound change, the evidence that languages are related. Proto-Indo-European stops shifted systematically in Germanic, so Latin pater and English father differ in a predictable way. Type a Latin word to apply only the consonant shifts.",
		Tags:        []string{"sound change", "cognates", "toy tool"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("ling-grimm", ""),
				h.Div(h.Class("scroll-thin overflow-x-auto rounded-xl border bg-background"),
					h.Table(h.Class("w-full min-w-[520px] text-sm"),
						h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
							h.Th(h.Class("px-3 py-2 font-normal"), "PIE"), h.Th(h.Class("px-3 py-2 font-normal"), "Germanic"),
							h.Th(h.Class("px-3 py-2 font-normal"), "Kept in Latin / Sanskrit"), h.Th(h.Class("px-3 py-2 font-normal"), "English cognate"))),
						h.Tbody(h.Map(lingGrimm, func(g struct{ pie, gmc, latin, english string }) h.Node {
							return h.Tr(h.Class("border-b last:border-b-0"),
								h.Td(h.Class("px-3 py-2 font-mono"), h.Style(lingIPAFont), g.pie),
								h.Td(h.Class("px-3 py-2 font-mono text-brand"), h.Style(lingIPAFont), "→ "+g.gmc),
								h.Td(h.Class("px-3 py-2 italic"), g.latin),
								h.Td(h.Class("px-3 py-2"), g.english))
						})),
					),
				),
				h.Div(h.Class("flex flex-wrap items-end gap-3 rounded-xl border bg-code p-4"),
					h.Label(h.Class("flex flex-col gap-1.5"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Latin word"),
						h.Input(h.Type("text"), h.Data("input", ""), h.Value("pēs"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
							h.Class("h-9 w-48 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"))),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Span(h.Class("text-xs text-muted-foreground"), "After the shifts"),
						h.Span(h.Data("out", "shifted"), h.Class("font-mono text-lg text-brand"), "—")),
					h.P(h.Class("basis-full text-xs leading-relaxed text-muted-foreground"),
						"Toy tool: it maps p→f, t→th, c/k→h, d→t, g→k, b→p and ignores vowel changes, Verner's law and later English sound changes, so it gets close (pēs → fēs, cf. foot) rather than right."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L8

func lingWritingBlock() Block {
	type sys struct{ kind, unit, examples, script, sample, gloss string }
	systems := []sys{
		{"Alphabet", "consonants and vowels, each with its own letter", "Greek, Latin, Cyrillic", "Greek", "λόγος", "l-o-g-o-s, 'word'"},
		{"Abjad", "consonants only; vowels optional marks", "Arabic, Hebrew", "Arabic", "كتب", "k-t-b, the root of 'write'"},
		{"Abugida", "consonant letters with an inherent vowel, changed by marks", "Devanagari, Ge'ez, Thai", "Devanagari", "क कि कु", "ka, ki, ku"},
		{"Syllabary", "one sign per syllable", "Japanese kana, Cherokee", "Hiragana", "か き く", "ka, ki, ku"},
		{"Logography", "signs for morphemes (with phonetic parts)", "Chinese characters", "Chinese", "山 木 林", "mountain, tree, woods"},
	}
	return Block{
		Slug:        "writing-systems",
		Title:       "Writing systems",
		Description: "What a written sign stands for differs across the world's scripts: a sound, a consonant, a syllable, or a unit of meaning. The same three syllables, ka ki ku, show how an abugida and a syllabary differ.",
		Tags:        []string{"scripts", "typology"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-2 sm:grid-cols-2 lg:grid-cols-5"),
				h.Map(systems, func(s sys) h.Node {
					return h.Div(h.Class("flex flex-col gap-2 rounded-xl border bg-background p-4"),
						h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), s.kind),
						h.Span(h.Class("py-2 text-3xl"), h.Attr("lang", map[string]string{"Greek": "el", "Arabic": "ar", "Devanagari": "hi", "Hiragana": "ja", "Chinese": "zh"}[s.script]), s.sample),
						h.Span(h.Class("text-xs text-muted-foreground"), s.script+": "+s.gloss),
						h.P(h.Class("mt-auto border-t pt-2 text-xs leading-relaxed"), s.unit),
						h.P(h.Class("text-[11px] text-muted-foreground"), s.examples),
					)
				}),
			)
		},
	}
}
