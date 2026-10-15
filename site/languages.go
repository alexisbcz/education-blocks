package site

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LanguagesBlocks lists the language learning gallery in display order.
// Tools, not lessons: each block is something a learner of French uses
// every week. Progress stays in the browser (localStorage).
func LanguagesBlocks() []Block {
	return []Block{
		langSRSBlock(),
		langConjBlock(),
		langGenderBlock(),
		langClozeBlock(),
		langAccentBlock(),
		langPairsBlock(),
		langCoverageBlock(),
		langGlossBlock(),
		langNumbersBlock(),
		langCEFRBlock(),
	}
}

// langData carries JSON for a block's script in an inert template.
func langData(name, json string) h.Node {
	return h.Template(h.Data("lang-json", name), h.Data("json", json))
}

// langSelect is a native select styled like the components' inputs.
func langSelect(name, label string, opts [][2]string) h.Node {
	return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
		h.Span(h.Class("text-muted-foreground"), label),
		h.Select(h.Data("select", name), h.Aria("label", label),
			h.Class("h-9 min-w-0 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
			h.Map(opts, func(o [2]string) h.Node { return h.Option(h.Value(o[0]), o[1]) }),
		),
	)
}

// langAnswer is an answer input: 16px on phones (no iOS zoom), no
// autocorrect, French spellchecking off so it doesn't give answers away.
func langAnswer(name, placeholder, lang string) h.Node {
	return h.Input(h.Type("text"), h.Data("answer", name), h.Placeholder(placeholder), h.Attr("lang", lang),
		h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"), h.Attr("autocorrect", "off"), h.Attr("spellcheck", "false"),
		h.Aria("label", placeholder),
		h.Class("h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add data-[state=wrong]:border-del data-[state=close]:border-vec-out"))
}

func langFeedback() h.Node {
	return h.P(h.Data("feedback", ""), h.Aria("live", "polite"), h.Class("min-h-5 text-sm text-muted-foreground"))
}

func langCard(children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-4 self-start rounded-xl border bg-background p-4 shadow-xs sm:p-5")}, children...)...)
}

// ---------------------------------------------------------------- 1

func langSRSBlock() Block {
	return Block{
		Slug:        "spaced-repetition",
		Title:       "Spaced repetition deck",
		Description: "A real SM-2 scheduler (Wozniak, 1987): each grade updates the card's ease factor and pushes its next review out by the interval shown on the button. Starts with 40 high-frequency French words; import or export the deck as TSV. Progress stays in this browser.",
		Tags:        []string{"SM-2", "flashcards", "kbd"},
		Wide:        true,
		Render: func() h.Node {
			grade := func(q, label, key string) h.Node {
				return button.Button(button.VariantOutline, h.Type("button"), h.Data("grade", q), h.Disabled(), h.Class("h-auto flex-col gap-0.5 py-2"),
					h.Span(h.Class("flex items-center gap-1.5"), label, kbd.Kbd(key)),
					h.Span(h.Data("preview", q), h.Class("font-mono text-[11px] font-normal text-muted-foreground tabular-nums"), "—"))
			}
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("lang-srs", ""), h.TabIndex(-1),
				langCard(
					h.Div(h.Class("flex flex-wrap items-center gap-2 text-xs text-muted-foreground"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono font-normal"), h.Span(h.Data("out", "new"), "0"), " new"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono font-normal"), h.Span(h.Data("out", "due"), "0"), " due"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono font-normal"), h.Span(h.Data("out", "learned"), "0"), " learned"),
						h.Span(h.Class("ml-auto font-mono"), "EF ", h.Span(h.Data("out", "ef"), "—")),
					),
					h.Div(h.Class("flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center"),
						h.P(h.Data("front", ""), h.Attr("lang", "fr"), h.Class("text-2xl font-semibold tracking-tight text-balance"), "…"),
						h.P(h.Data("back", ""), h.Hidden(), h.Class("text-lg text-muted-foreground")),
						h.P(h.Data("done", ""), h.Hidden(), h.Class("text-sm text-muted-foreground"), "Nothing due. Come back tomorrow, or add cards from the gloss tool below."),
					),
					button.Button(button.VariantOutline, h.Type("button"), h.Data("action", "show"), hugeicons.ViewIcon(), "Show answer", kbd.Kbd(h.Class("ml-1"), "Space")),
					h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-4"),
						grade("1", "Again", "1"), grade("3", "Hard", "2"), grade("4", "Good", "3"), grade("5", "Easy", "4"),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"SM-2 grades: Again = 1, Hard = 3, Good = 4, Easy = 5. A grade below 3 restarts the card at 1 day. Intervals: 1 day, 6 days, then the previous interval × ease factor, rounded to the nearest day."),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					langCard(
						panelLabel("Reviews due, next 14 days"),
						h.Svg(h.Data("forecast", ""), h.ViewBox("0 0 320 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Reviews due per day")),
					),
					langCard(
						panelLabel("Deck"),
						h.Textarea(h.Data("tsv", ""), h.Attr("rows", "4"), h.Attr("spellcheck", "false"), h.Aria("label", "Deck as TSV"),
							h.Placeholder("front<TAB>back, one card per line"),
							h.Class("w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-xs")),
						h.Div(h.Class("flex flex-wrap gap-2"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "export"), hugeicons.Download01Icon(), "Export"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "import"), hugeicons.Upload01Icon(), "Import"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), h.Class("text-muted-foreground"), hugeicons.RefreshIcon(), "Reset"),
						),
						h.P(h.Data("deck-msg", ""), h.Aria("live", "polite"), h.Class("min-h-4 text-xs text-muted-foreground")),
					),
				),
				langData("deck", langDeckJSON()),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func langConjBlock() Block {
	verbs := make([][2]string, len(langVerbs))
	for i, v := range langVerbs {
		verbs[i] = [2]string{v.Inf, v.Inf + " · " + v.Gloss}
	}
	tenses := make([][2]string, len(langTenses))
	for i, t := range langTenses {
		tenses[i] = [2]string{t, t}
	}
	return Block{
		Slug:        "conjugation",
		Title:       "Conjugation trainer",
		Description: "Eighteen verbs in six tenses, from the irregular (être, aller, faire) to the spelling-change ones (nous mangeons, j'appelle, je lève). Read the table, or quiz yourself: answers without their accents count as close, not right.",
		Tags:        []string{"French", "quiz", "tables"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("lang-conj", ""),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					langSelect("verb", "Verb", verbs),
					langSelect("tense", "Tense", tenses),
				),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					h.P(h.Data("conj-note", ""), h.Class("text-xs text-muted-foreground")),
					segs("Mode", [2]string{"table", "Table"}, [2]string{"quiz", "Quiz"}),
				),
				h.Div(h.Data("view", "table"),
					h.Table(h.Class("w-full text-base"), h.Attr("lang", "fr"),
						h.Tbody(h.Data("conj-table", ""), h.Class("divide-y")),
					),
				),
				h.Div(h.Data("view", "quiz"), h.Hidden(), h.Class("flex flex-col gap-3"),
					h.P(h.Class("text-sm text-muted-foreground"), "Conjugate: ",
						h.Span(h.Data("conj-prompt", ""), h.Attr("lang", "fr"), h.Class("font-medium text-foreground"))),
					h.Form(h.Data("conj-form", ""), h.Action("#"), h.Class("flex gap-2"),
						langAnswer("conj", "your answer, e.g. nous mangeons", "fr"),
						button.Button(button.VariantOutline, h.Type("submit"), "Check"),
					),
					langFeedback(),
					h.Div(h.Class("flex items-center justify-between text-xs text-muted-foreground"),
						h.Span("Score ", h.Span(h.Data("out", "score"), h.Class("font-mono text-foreground"), "0 / 0")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), hugeicons.ArrowRight01Icon(), "Next"),
					),
				),
				langData("verbs", langVerbJSON()),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func langGenderBlock() Block {
	tendencies := [][3]string{
		{"-tion, -sion", "feminine", "la nation, la télévision"},
		{"-té", "feminine", "but l'été, le côté, le pâté"},
		{"-ée", "feminine", "but le musée, le lycée"},
		{"-ance, -ence", "feminine", "but le silence"},
		{"-ment", "masculine", "but la jument"},
		{"-age", "masculine", "but la plage, la page, l'image, la cage"},
		{"-eau", "masculine", "but l'eau, la peau"},
		{"-isme", "masculine", "le tourisme"},
	}
	return Block{
		Slug:        "gender",
		Title:       "Gender and articles",
		Description: "Le or la, der, die or das. Ending rules help, but only as tendencies: every rule here comes with the exceptions you will actually meet, and the trainer asks about them on purpose.",
		Tags:        []string{"French", "German", "drill"},
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("lang-gender", ""),
				langCard(
					h.Div(h.Class("flex items-center justify-between gap-2"),
						segs("Language", [2]string{"fr", "Français"}, [2]string{"de", "Deutsch"}),
						h.Span(h.Class("font-mono text-xs text-muted-foreground"), h.Span(h.Data("out", "score"), "0 / 0")),
					),
					h.Div(h.Class("flex flex-col items-center gap-1 py-4"),
						h.P(h.Data("noun", ""), h.Class("text-3xl font-semibold tracking-tight"), "…"),
						h.P(h.Data("gloss", ""), h.Class("text-sm text-muted-foreground")),
					),
					h.Div(h.Data("choices", ""), h.Class("grid grid-cols-3 gap-2")),
					langFeedback(),
				),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("French endings: tendencies, not laws"),
					h.Table(h.Class("w-full text-sm"),
						h.Tbody(h.Class("divide-y"),
							h.Map(tendencies, func(t [3]string) h.Node {
								return h.Tr(
									h.Td(h.Class("py-1.5 pr-3 font-mono text-[13px] whitespace-nowrap"), t[0]),
									h.Td(h.Class("py-1.5 pr-3"), t[1]),
									h.Td(h.Class("py-1.5 text-xs text-muted-foreground"), h.Attr("lang", "fr"), t[2]),
								)
							}),
						),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Before a vowel the article becomes l', which hides the gender: learn l'eau as feminine, l'été as masculine. German has three genders and strong but imperfect patterns: -ung, -heit, -keit, -tät → die; -chen, -lein → das."),
				),
				langData("nouns", langNounJSON()),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

type langToken struct {
	W   string `json:"w"`
	POS string `json:"pos,omitempty"`
}

// La Fontaine, « La Cigale et la Fourmi », Fables, livre I (1668): the
// opening lines, public domain. POS tags on the content words only.
var langFable = []langToken{
	{"La", ""}, {"Cigale", "N"}, {",", ""}, {"ayant", "V"}, {"chanté", "V"}, {"\n", ""},
	{"Tout", ""}, {"l'", ""}, {"été", "N"}, {",", ""}, {"\n", ""},
	{"Se", ""}, {"trouva", "V"}, {"fort", ""}, {"dépourvue", "A"}, {"\n", ""},
	{"Quand", ""}, {"la", ""}, {"bise", "N"}, {"fut", "V"}, {"venue", "V"}, {" :", ""}, {"\n", ""},
	{"Pas", ""}, {"un", ""}, {"seul", "A"}, {"petit", "A"}, {"morceau", "N"}, {"\n", ""},
	{"De", ""}, {"mouche", "N"}, {"ou", ""}, {"de", ""}, {"vermisseau", "N"}, {".", ""}, {"\n", ""},
	{"Elle", ""}, {"alla", "V"}, {"crier", "V"}, {"famine", "N"}, {"\n", ""},
	{"Chez", ""}, {"la", ""}, {"Fourmi", "N"}, {"sa", ""}, {"voisine", "N"}, {",", ""}, {"\n", ""},
	{"La", ""}, {"priant", "V"}, {"de", ""}, {"lui", ""}, {"prêter", "V"}, {"\n", ""},
	{"Quelque", ""}, {"grain", "N"}, {"pour", ""}, {"subsister", "V"}, {"\n", ""},
	{"Jusqu'à", ""}, {"la", ""}, {"saison", "N"}, {"nouvelle", "A"}, {".", ""},
}

func langClozeBlock() Block {
	b, _ := json.Marshal(langFable)
	return Block{
		Slug:        "cloze",
		Title:       "Cloze reader",
		Description: "Reading with gaps: the opening of La Fontaine's « La Cigale et la Fourmi » with its nouns, verbs or adjectives blanked out. A hint gives the first letter; a missing accent counts as close.",
		Tags:        []string{"reading", "La Fontaine", "public domain"},
		Render: func() h.Node {
			return langCard(h.Data("lang-cloze", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					segs("Gaps", [2]string{"N", "Nouns"}, [2]string{"V", "Verbs"}, [2]string{"A", "Adjectives"}),
					h.Span(h.Class("font-mono text-xs text-muted-foreground"), h.Span(h.Data("out", "score"), "—")),
				),
				h.Div(h.Data("passage", ""), h.Attr("lang", "fr"), h.Class("font-serif text-lg leading-[2.4] [&_input]:font-sans")),
				h.P(h.Class("text-xs text-muted-foreground"), "Jean de La Fontaine, « La Cigale et la Fourmi », ", h.Em("Fables"), ", livre I, 1668. Public domain."),
				h.Div(h.Class("flex flex-wrap gap-2 border-t pt-4"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "check"), hugeicons.CheckmarkCircle02Icon(), "Check"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "hint"), hugeicons.BulbIcon(), "Hint"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reveal"), h.Class("text-muted-foreground"), "Reveal"),
				),
				langData("fable", string(b)),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

const (
	langNBSP  = " " // espace insécable
	langNNBSP = " " // espace fine insécable
)

var langAccentDrills = []string{
	"Où es-tu" + langNNBSP + "? Ça va très bien, merci" + langNNBSP + "!",
	"Il a dit" + langNBSP + ":" + langNBSP + "«" + langNBSP + "À bientôt." + langNBSP + "»",
	"Le cœur a ses raisons que la raison ne connaît point.",
	"Noël tombe un jeudi" + langNNBSP + "; la fête sera à la maison.",
	"Français, Allemand, Espagnol" + langNNBSP + "? J'hésite encore.",
}

func langAccentBlock() Block {
	keys := []string{"é", "è", "ê", "ë", "à", "â", "ç", "ô", "û", "ù", "î", "ï", "œ", "æ", "«", "»", "É", "À", "Ç"}
	b, _ := json.Marshal(langAccentDrills)
	return Block{
		Slug:        "accents",
		Title:       "Accents and French typography",
		Description: "Type every French letter without a French keyboard, and learn the spacing rule nobody tells learners: a narrow no-break space before ; ! ?, a no-break space before : and inside « guillemets ». The drill compares spaces too.",
		Tags:        []string{"typing", "typography", "drill"},
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("lang-accent", ""),
				langCard(
					h.Div(h.Class("flex flex-wrap gap-1"), h.Aria("label", "French characters"), h.Role("toolbar"),
						h.Map(keys, func(k string) h.Node {
							return h.Button(h.Type("button"), h.Data("key", k), h.Aria("label", "Insert "+k),
								h.Class("flex h-9 min-w-9 items-center justify-center rounded-md border bg-background px-2 text-base shadow-xs transition-[background-color,transform] duration-100 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97]"), k)
						}),
					),
					h.Textarea(h.Data("pad", ""), h.Attr("lang", "fr"), h.Attr("rows", "3"), h.Attr("spellcheck", "false"), h.Aria("label", "Type here"),
						h.Placeholder("Tapez ici… essayez « Ça va ? »"),
						h.Class("w-full resize-y rounded-md border border-input bg-background p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
					toggle("lang-typo", "typo", "Insert French spaces automatically", true),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
						h.Div(h.Class("flex items-center justify-between gap-2"),
							panelLabel("Drill: copy exactly"),
							button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), hugeicons.ShuffleIcon(), "Next")),
						h.P(h.Data("target", ""), h.Attr("lang", "fr"), h.Class("rounded-md bg-muted/50 px-3 py-2 font-mono text-sm whitespace-pre-wrap")),
						langAnswer("drill", "retype the sentence", "fr"),
						langFeedback(),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 text-sm"),
					panelLabel("The spacing rule"),
					h.Table(h.Class("w-full"),
						h.Tbody(h.Class("divide-y"),
							h.Tr(h.Td(h.Class("py-1.5 pr-3 font-mono whitespace-nowrap"), "; ! ?"), h.Td(h.Class("py-1.5"), "narrow no-break space before (U+202F)")),
							h.Tr(h.Td(h.Class("py-1.5 pr-3 font-mono"), ":"), h.Td(h.Class("py-1.5"), "no-break space before (U+00A0)")),
							h.Tr(h.Td(h.Class("py-1.5 pr-3 font-mono"), "« »"), h.Td(h.Class("py-1.5"), "no-break space inside both")),
							h.Tr(h.Td(h.Class("py-1.5 pr-3 font-mono"), ". ,"), h.Td(h.Class("py-1.5"), "no space before, as in English")),
						),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"This is the Imprimerie nationale convention; many publishers use a full no-break space before ; ! ? too. In the drill, ⍽ marks a no-break space and · a narrow one."),
					panelLabel("Without a French keyboard"),
					h.Ul(h.Class("flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground"),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "macOS (US layout): "), "hold a letter for its accents, or ⌥e then e → é, ⌥` then a → à, ⌥i then o → ô, ⌥u then i → ï, ⌥c → ç."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Windows: "), "add the US-International layout: ' then e → é, ` then a → à, ^ then o → ô, \" then i → ï."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Phones: "), "long-press the letter."),
					),
				),
				langData("drills", string(b)),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

type langPair struct {
	A, AIPA, B, BIPA, Contrast string
}

// Minimal pairs, IPA in the conventions of the Linguistics IPA chart.
var langPairs = []langPair{
	{"tu", "/ty/", "tout", "/tu/", "/y/ vs /u/"},
	{"rue", "/ʁy/", "roue", "/ʁu/", "/y/ vs /u/"},
	{"dessus", "/dəsy/", "dessous", "/dəsu/", "/y/ vs /u/"},
	{"vin", "/vɛ̃/", "vent", "/vɑ̃/", "/ɛ̃/ vs /ɑ̃/"},
	{"vent", "/vɑ̃/", "vont", "/vɔ̃/", "/ɑ̃/ vs /ɔ̃/"},
	{"pain", "/pɛ̃/", "pont", "/pɔ̃/", "/ɛ̃/ vs /ɔ̃/"},
	{"beau", "/bo/", "bon", "/bɔ̃/", "oral /o/ vs nasal /ɔ̃/"},
	{"lait", "/lɛ/", "lin", "/lɛ̃/", "oral /ɛ/ vs nasal /ɛ̃/"},
	{"deux", "/dø/", "doux", "/du/", "/ø/ vs /u/"},
	{"poisson", "/pwasɔ̃/", "poison", "/pwazɔ̃/", "/s/ vs /z/"},
}

func langPairsBlock() Block {
	b, _ := json.Marshal(langPairs)
	return Block{
		Slug:        "minimal-pairs",
		Title:       "Minimal pairs",
		Description: "Words that differ by one sound: tu and tout, vin, vent and vont, poisson and poison. Listen with your browser's French voice when it has one; without a voice, the quiz turns into reading the IPA.",
		Tags:        []string{"listening", "IPA", "speech synthesis"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("lang-pairs", ""),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Ul(h.Class("divide-y rounded-xl border bg-background"),
						h.MapIdx(langPairs, func(i int, p langPair) h.Node {
							word := func(w, ipa string) h.Node {
								return h.Button(h.Type("button"), h.Data("say", w), h.Aria("label", "Listen to "+w),
									h.Class("flex items-center gap-2 rounded-md px-2 py-1 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"),
									hugeicons.VolumeHighIcon(h.Class("size-3.5 text-muted-foreground")),
									h.Span(h.Attr("lang", "fr"), h.Class("font-medium"), w),
									h.Span(h.Class("font-mono text-xs text-muted-foreground"), h.Style(lingIPAFont), ipa))
							}
							return h.Li(h.Class("grid grid-cols-2 items-center gap-x-2 px-2 py-1.5 sm:grid-cols-[1fr_1fr_auto]"),
								word(p.A, p.AIPA), word(p.B, p.BIPA),
								h.Span(h.Class("col-span-2 px-2 text-[11px] text-muted-foreground sm:col-span-1 sm:text-right"), h.Style(lingIPAFont), p.Contrast))
						}),
					),
					h.P(h.Data("voice", ""), h.Class("text-xs text-muted-foreground"), "Checking for a French voice…"),
				),
				langCard(
					h.Div(h.Class("flex items-center justify-between gap-2"),
						panelLabel("Quiz"),
						h.Span(h.Class("font-mono text-xs text-muted-foreground"), h.Span(h.Data("out", "score"), "0 / 0"))),
					h.P(h.Data("question", ""), h.Class("text-sm text-muted-foreground"), "Press Start."),
					h.P(h.Data("quiz-ipa", ""), h.Class("text-center text-3xl"), h.Style(lingIPAFont)),
					h.Div(h.Data("choices", ""), h.Class("grid grid-cols-2 gap-2")),
					langFeedback(),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "start"), hugeicons.PlayIcon(), "Start"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "replay"), h.Disabled(), hugeicons.VolumeHighIcon(), "Replay")),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Many speakers today, in Paris especially, no longer distinguish brun /bʁœ̃/ from brin /bʁɛ̃/, so that pair is left out. See the ",
						h.A(h.Href("/linguistics#ipa"), h.Class("underline underline-offset-2"), "IPA chart"), " for every symbol."),
				),
				langData("pairs", string(b)),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

const langSampleText = `Le matin, je prends le train pour aller au travail. Dans le train, je lis le journal ou je regarde par la fenêtre. Le soir, je rentre à la maison et je prépare le dîner avec ma femme. Nous parlons de la journée, des enfants et du travail. Le week-end, nous allons au marché. Au marché, il y a des fruits, des légumes, du pain et du fromage. Les enfants aiment le fromage, mais ils n'aiment pas les légumes. Après le marché, nous allons au parc avec les enfants. Le dimanche soir, je prépare la semaine : je regarde mon agenda et je fais une liste. C'est une vie simple, mais c'est une bonne vie.`

func langCoverageBlock() Block {
	return Block{
		Slug:        "coverage",
		Title:       "Frequency and coverage",
		Description: "Paste any French text: the tool counts word forms, shows how few of them cover most of the text, and marks the words not yet in your deck. A handful of very frequent words always do most of the work.",
		Tags:        []string{"frequency", "vocabulary", "your deck"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("lang-coverage", ""),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Textarea(h.Data("text", ""), h.Attr("lang", "fr"), h.Attr("rows", "7"), h.Aria("label", "French text"),
						h.Class("w-full resize-y rounded-md border border-input bg-background p-3 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
						langSampleText),
					h.P(h.Class("text-xs text-muted-foreground"), "Sample text written for this block. Counts are of word forms (mange and mangeons are two forms); nothing is lemmatised."),
					panelLabel("Words not in your deck"),
					h.Div(h.Data("marked", ""), h.Attr("lang", "fr"), h.Class("rounded-lg border bg-background p-3 text-sm leading-relaxed")),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Dl(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-5"),
						h.Map([][2]string{{"tokens", "tokens"}, {"forms", "forms"}, {"80%", "c80"}, {"90%", "c90"}, {"95%", "c95"}}, func(r [2]string) h.Node {
							return h.Div(h.Class("rounded-lg border bg-background p-2"),
								h.Dt(h.Class("text-[11px] text-muted-foreground"), h.IfElse(strings.HasSuffix(r[0], "%"), "forms for "+r[0], r[0])),
								h.Dd(h.Data("out", r[1]), h.Class("font-mono text-lg tabular-nums"), "—"))
						}),
					),
					h.Svg(h.Data("curve", ""), h.ViewBox("0 0 360 180"), h.Class("block w-full rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Cumulative coverage by word rank")),
					h.Ol(h.Data("top", ""), h.Attr("lang", "fr"), h.Class("grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-3")),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"For English, Nation (2006) estimated that reading with 98% of words known takes 8,000–9,000 word families. The numbers above are measured on your text only."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func langGlossBlock() Block {
	abbrevs := [][2]string{{"1SG", "first person singular"}, {"2SG", "second person singular"}, {"3SG", "third person singular"}, {"PL", "plural"},
		{"M", "masculine"}, {"F", "feminine"}, {"DEF", "definite"}, {"INDF", "indefinite"}, {"NEG", "negation"},
		{"PRS", "present"}, {"PST", "past"}, {"IPFV", "imperfective"}, {"FUT", "future"}, {"COND", "conditional"},
		{"SBJV", "subjunctive"}, {"REFL", "reflexive"}, {"PTCP", "participle"}, {"INF", "infinitive"}}
	return Block{
		Slug:        "interlinear-gloss",
		Title:       "Sentence mining and glossing",
		Description: "Collect real sentences and take them apart: each word gets a gloss in the Leipzig style (1SG, F, NEG, PRS…), aligned under the French. Save the sentence to your deck to review it with the scheduler above.",
		Tags:        []string{"Leipzig rules", "sentence mining", "deck"},
		Render: func() h.Node {
			return langCard(h.Data("lang-gloss", ""),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
					h.Input(h.Type("text"), h.Data("sentence", ""), h.Attr("lang", "fr"), h.Value("Je ne mange pas de pommes."), h.Aria("label", "French sentence"),
						h.Class("h-10 min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
					h.Input(h.Type("text"), h.Data("translation", ""), h.Value("I don't eat apples."), h.Aria("label", "Translation"),
						h.Class("h-10 min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")),
				),
				h.Div(h.Data("columns", ""), h.Class("scroll-thin flex gap-2 overflow-x-auto pb-1")),
				h.Div(h.Class("rounded-lg border bg-code p-3"),
					panelLabel("Preview"),
					h.Div(h.Data("preview", ""), h.Class("scroll-thin mt-2 overflow-x-auto font-mono text-sm")),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "save"), hugeicons.Add01Icon(), "Add to deck"),
					copyButton("", "relative"),
					h.Span(h.Data("msg", ""), h.Aria("live", "polite"), h.Class("text-xs text-muted-foreground")),
				),
				h.Details(h.Class("text-xs text-muted-foreground"),
					h.Summary(h.Class("cursor-pointer"), "Leipzig glossing abbreviations"),
					h.Dl(h.Class("mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr_auto_1fr]"),
						h.Map(abbrevs, func(a [2]string) h.Node {
							return h.Group(h.Dt(h.Class("font-mono text-foreground"), a[0]), h.Dd(a[1]))
						}),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func langNumbersBlock() Block {
	return Block{
		Slug:        "numbers",
		Title:       "Numbers, times and dates",
		Description: "Soixante-dix, quatre-vingts, quatre-vingt-onze: French counts in twenties above sixty. Drill numbers both ways, the 24-hour and spoken clock, and dates; both the traditional spelling and the 1990 one (hyphens everywhere) are accepted.",
		Tags:        []string{"French", "listening", "1990 spelling"},
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("lang-num", ""),
				langCard(
					segs("Drill", [2]string{"write", "Number → words"}, [2]string{"read", "Words → number"}, [2]string{"time", "Time"}, [2]string{"date", "Date"}),
					h.Div(h.Class("flex flex-col items-center gap-2 py-3 text-center"),
						h.P(h.Data("ask", ""), h.Class("text-xs text-muted-foreground")),
						h.P(h.Data("prompt", ""), h.Attr("lang", "fr"), h.Class("text-2xl font-semibold tracking-tight text-balance tabular-nums")),
					),
					h.Form(h.Data("num-form", ""), h.Action("#"), h.Class("flex gap-2"),
						langAnswer("num", "your answer", "fr"),
						button.Button(button.VariantOutline, h.Type("submit"), "Check"),
					),
					langFeedback(),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), hugeicons.ArrowRight01Icon(), "Next"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "listen"), hugeicons.VolumeHighIcon(), "Listen"),
						h.Span(h.Class("ml-auto font-mono text-xs text-muted-foreground"), h.Span(h.Data("out", "score"), "0 / 0")),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					langSelect("range", "Numbers up to", [][2]string{{"100", "100"}, {"1000", "1 000"}, {"999999", "999 999"}}),
					h.Table(h.Class("w-full text-sm"), h.Attr("lang", "fr"),
						h.Tbody(h.Class("divide-y"),
							h.Map([]int{70, 71, 80, 81, 90, 91, 200, 201, 80000}, func(n int) h.Node {
								return h.Tr(h.Td(h.Class("py-1 pr-3 font-mono tabular-nums"), langGroup(n)), h.Td(h.Class("py-1"), langNumber(n, false)))
							}),
						),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Vingt and cent take an s when multiplied and last: quatre-vingts, deux cents, but quatre-vingt-un and deux cent mille. Mille never does. Belgian and Swiss French say septante, nonante (and huitante in some Swiss cantons). Heure is feminine: une heure, vingt et une heures."),
				),
			)
		},
	}
}

// langGroup writes 80000 as 80 000, with a narrow no-break space.
func langGroup(n int) string {
	s := fmt.Sprint(n)
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteString(langNNBSP)
		}
		b.WriteRune(r)
	}
	return b.String()
}

// ---------------------------------------------------------------- 10

type langLevel struct {
	Code, Name string
	CanDo      []string
	Hours      [2]int // Cambridge English guided learning hours, cumulative
}

// Paraphrases of the CEFR global scale (Council of Europe, 2001; Companion
// Volume, 2020). Hours: Cambridge English guidance for English learners,
// cumulative guided learning hours (A2 onward; it gives none for A1).
var langLevels = []langLevel{
	{"A1", "Breakthrough", []string{"I can introduce myself and answer simple questions about where I live and people I know.", "I can understand very short, slow phrases about familiar things.", "I can fill in a form with my name, address and nationality."}, [2]int{0, 0}},
	{"A2", "Waystage", []string{"I can handle short everyday exchanges: shopping, directions, simple plans.", "I can understand the main point of short, clear announcements.", "I can write a short note or message about immediate needs."}, [2]int{180, 200}},
	{"B1", "Threshold", []string{"I can deal with most situations while travelling where the language is spoken.", "I can follow the main points of clear speech on familiar topics.", "I can describe experiences and hopes, and give brief reasons for opinions."}, [2]int{350, 400}},
	{"B2", "Vantage", []string{"I can talk with native speakers with some fluency, without strain on either side.", "I can follow extended speech and lectures on familiar topics.", "I can write clear, detailed text and argue for a point of view."}, [2]int{500, 600}},
	{"C1", "Effective operational proficiency", []string{"I can express myself fluently without obviously searching for words.", "I can understand long, demanding texts and implicit meaning.", "I can use the language flexibly for social, academic and work purposes."}, [2]int{700, 800}},
	{"C2", "Mastery", []string{"I can understand virtually everything I hear or read with ease.", "I can summarise information from different sources coherently.", "I can express fine shades of meaning precisely, even on complex topics."}, [2]int{1000, 1200}},
}

func langCEFRBlock() Block {
	b, _ := json.Marshal(langLevels)
	return Block{
		Slug:        "cefr",
		Title:       "Level check and study plan",
		Description: "Tick what you can already do at each CEFR level, then plan the rest. The hours are a rough guide only: they come from Cambridge English's guidance for learners of English, and real progress varies widely with the learner and the language.",
		Tags:        []string{"CEFR", "self-assessment", "planner"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("lang-cefr", ""),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
					h.Map(langLevels, func(l langLevel) h.Node {
						return h.Fieldset(h.Data("level", l.Code), h.Class("flex flex-col gap-2 rounded-xl border bg-background p-3"),
							h.Legend(h.Class("sr-only"), l.Code+" "+l.Name),
							h.Div(h.Class("flex items-baseline gap-2"),
								h.Span(h.Class("font-mono text-sm font-medium"), l.Code),
								h.Span(h.Class("text-xs text-muted-foreground"), l.Name)),
							h.MapIdx(l.CanDo, func(i int, c string) h.Node {
								id := fmt.Sprintf("cefr-%s-%d", l.Code, i)
								return h.Label(h.For(id), h.Class("flex cursor-pointer items-start gap-2 text-xs leading-relaxed"),
									h.Input(h.Type("checkbox"), h.ID(id), h.Class("mt-0.5 size-4 shrink-0 accent-[var(--brand)]")),
									h.Span(c))
							}),
						)
					}),
				),
				langCard(
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("text-sm text-muted-foreground"), "Your level now"),
						h.Span(h.Data("out", "level"), h.Class("font-mono text-2xl font-medium"), "—")),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-3"),
						langSelect("target", "Target", [][2]string{{"A2", "A2"}, {"B1", "B1"}, {"B2", "B2"}, {"C1", "C1"}, {"C2", "C2"}}),
						field("hours", "Study per week", "h", 5, 1, 40, 1),
					),
					readouts([2]string{"hours left", "left"}, [2]string{"weeks", "weeks"}, [2]string{"months", "months"}),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Descriptors paraphrase the CEFR global scale (Council of Europe, 2001; Companion Volume, 2020). For French specifically, the US Foreign Service Institute puts it in its easiest category for English speakers: about 24–30 weeks (600–750 class hours) to professional working proficiency."),
				),
				langData("levels", string(b)),
			)
		},
	}
}
