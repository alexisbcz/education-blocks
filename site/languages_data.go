package site

import (
	"encoding/json"
	"strings"
)

// French data for the Language Learning collection: verb tables, number
// spelling, nouns with their genders. The browser receives it as JSON, so
// one source feeds the tools and the Go tests.

// ---------------------------------------------------------------- verbs

type langVerb struct {
	Inf, Gloss, Aux, PP string
	Pres                [6]string // je, tu, il, nous, vous, ils
	ImpStem             string    // imparfait stem (from "nous", except être)
	FutStem             string    // futur and conditionnel stem
	Subj                [6]string // subjonctif présent
	Note                string
}

var langVerbs = []langVerb{
	{"être", "to be", "avoir", "été",
		[6]string{"suis", "es", "est", "sommes", "êtes", "sont"}, "ét", "ser",
		[6]string{"sois", "sois", "soit", "soyons", "soyez", "soient"}, "Irregular everywhere; imparfait on ét-."},
	{"avoir", "to have", "avoir", "eu",
		[6]string{"ai", "as", "a", "avons", "avez", "ont"}, "av", "aur",
		[6]string{"aie", "aies", "ait", "ayons", "ayez", "aient"}, "Auxiliary of most verbs in the passé composé."},
	{"aller", "to go", "être", "allé",
		[6]string{"vais", "vas", "va", "allons", "allez", "vont"}, "all", "ir",
		[6]string{"aille", "ailles", "aille", "allions", "alliez", "aillent"}, "The only irregular -er verb; futur on ir-."},
	{"faire", "to do, to make", "avoir", "fait",
		[6]string{"fais", "fais", "fait", "faisons", "faites", "font"}, "fais", "fer",
		[6]string{"fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"}, "vous faites, ils font."},
	{"pouvoir", "can, to be able", "avoir", "pu",
		[6]string{"peux", "peux", "peut", "pouvons", "pouvez", "peuvent"}, "pouv", "pourr",
		[6]string{"puisse", "puisses", "puisse", "puissions", "puissiez", "puissent"}, "Futur with a double r: pourrai."},
	{"vouloir", "to want", "avoir", "voulu",
		[6]string{"veux", "veux", "veut", "voulons", "voulez", "veulent"}, "voul", "voudr",
		[6]string{"veuille", "veuilles", "veuille", "voulions", "vouliez", "veuillent"}, "Subjonctif: nous voulions, vous vouliez."},
	{"venir", "to come", "être", "venu",
		[6]string{"viens", "viens", "vient", "venons", "venez", "viennent"}, "ven", "viendr",
		[6]string{"vienne", "viennes", "vienne", "venions", "veniez", "viennent"}, "Two stems: vien- and ven-."},
	{"prendre", "to take", "avoir", "pris",
		[6]string{"prends", "prends", "prend", "prenons", "prenez", "prennent"}, "pren", "prendr",
		[6]string{"prenne", "prennes", "prenne", "prenions", "preniez", "prennent"}, "Like apprendre, comprendre."},
	{"savoir", "to know", "avoir", "su",
		[6]string{"sais", "sais", "sait", "savons", "savez", "savent"}, "sav", "saur",
		[6]string{"sache", "saches", "sache", "sachions", "sachiez", "sachent"}, ""},
	{"devoir", "must, to owe", "avoir", "dû",
		[6]string{"dois", "dois", "doit", "devons", "devez", "doivent"}, "dev", "devr",
		[6]string{"doive", "doives", "doive", "devions", "deviez", "doivent"}, "Participle dû keeps its circumflex only in the masculine singular."},
	{"dire", "to say", "avoir", "dit",
		[6]string{"dis", "dis", "dit", "disons", "dites", "disent"}, "dis", "dir",
		[6]string{"dise", "dises", "dise", "disions", "disiez", "disent"}, "vous dites (but vous prédisez)."},
	{"voir", "to see", "avoir", "vu",
		[6]string{"vois", "vois", "voit", "voyons", "voyez", "voient"}, "voy", "verr",
		[6]string{"voie", "voies", "voie", "voyions", "voyiez", "voient"}, "Futur verr-."},
	{"parler", "to speak", "avoir", "parlé",
		[6]string{"parle", "parles", "parle", "parlons", "parlez", "parlent"}, "parl", "parler",
		[6]string{"parle", "parles", "parle", "parlions", "parliez", "parlent"}, "The model regular -er verb."},
	{"finir", "to finish", "avoir", "fini",
		[6]string{"finis", "finis", "finit", "finissons", "finissez", "finissent"}, "finiss", "finir",
		[6]string{"finisse", "finisses", "finisse", "finissions", "finissiez", "finissent"}, "The model regular -ir verb (2nd group): -iss- in the plural."},
	{"manger", "to eat", "avoir", "mangé",
		[6]string{"mange", "manges", "mange", "mangeons", "mangez", "mangent"}, "mang", "manger",
		[6]string{"mange", "manges", "mange", "mangions", "mangiez", "mangent"}, "-ger verbs keep an e before a and o: mangeons, mangeait."},
	{"commencer", "to begin", "avoir", "commencé",
		[6]string{"commence", "commences", "commence", "commençons", "commencez", "commencent"}, "commenc", "commencer",
		[6]string{"commence", "commences", "commence", "commencions", "commenciez", "commencent"}, "-cer verbs write ç before a and o: commençons, commençait."},
	{"appeler", "to call", "avoir", "appelé",
		[6]string{"appelle", "appelles", "appelle", "appelons", "appelez", "appellent"}, "appel", "appeller",
		[6]string{"appelle", "appelles", "appelle", "appelions", "appeliez", "appellent"}, "Doubles the l before a silent e: j'appelle, j'appellerai."},
	{"lever", "to raise", "avoir", "levé",
		[6]string{"lève", "lèves", "lève", "levons", "levez", "lèvent"}, "lev", "lèver",
		[6]string{"lève", "lèves", "lève", "levions", "leviez", "lèvent"}, "Grave accent before a silent e: je lève, je lèverai."},
}

var langTenses = []string{"présent", "passé composé", "imparfait", "futur simple", "conditionnel présent", "subjonctif présent"}

// langPersons are the subject pronouns in table order.
var langPersons = [6]string{"je", "tu", "il/elle/on", "nous", "vous", "ils/elles"}

func langStartsVowel(s string) bool {
	if s == "" {
		return false
	}
	r := []rune(s)[0]
	return strings.ContainsRune("aeiouyàâéèêëîïôûùh", r)
}

// langWithPronoun puts the pronoun before a form, eliding je to j' before a
// vowel. In the subjonctif the pronoun follows que, which elides before il,
// elle, on, ils, elles.
func langWithPronoun(i int, form string, subj bool) string {
	p := langPersons[i]
	if i == 0 && langStartsVowel(form) {
		p = "j'"
	}
	s := p
	if p != "j'" {
		s += " "
	}
	s += form
	if subj {
		if i == 2 || i == 5 {
			return "qu'" + s
		}
		return "que " + s
	}
	return s
}

// langImparfait applies the stem rules: -ger verbs keep e and -cer verbs
// write ç before an ending that starts with a.
func langEnding(stem, end string) string {
	if strings.HasPrefix(end, "a") || strings.HasPrefix(end, "o") {
		if strings.HasSuffix(stem, "g") {
			return stem + "e" + end
		}
		if strings.HasSuffix(stem, "c") {
			return strings.TrimSuffix(stem, "c") + "ç" + end
		}
	}
	return stem + end
}

var (
	langImpEnd = [6]string{"ais", "ais", "ait", "ions", "iez", "aient"}
	langFutEnd = [6]string{"ai", "as", "a", "ons", "ez", "ont"}
)

// langForms returns the six bare forms (no pronoun) of a tense.
func langForms(v langVerb, tense string) [6]string {
	var out [6]string
	switch tense {
	case "présent":
		out = v.Pres
	case "imparfait":
		for i, e := range langImpEnd {
			out[i] = langEnding(v.ImpStem, e)
		}
	case "futur simple":
		for i, e := range langFutEnd {
			out[i] = v.FutStem + e
		}
	case "conditionnel présent":
		for i, e := range langImpEnd {
			out[i] = v.FutStem + e
		}
	case "subjonctif présent":
		out = v.Subj
	case "passé composé":
		aux := langVerbs[1].Pres
		var agree [6]string
		if v.Aux == "être" {
			aux = langVerbs[0].Pres
			agree = [6]string{"(e)", "(e)", "(e)", "(e)s", "(e)(s)", "(e)s"}
		}
		for i := range out {
			out[i] = aux[i] + " " + v.PP + agree[i]
		}
	}
	return out
}

// langConjugate returns the six forms of a tense with their pronouns.
func langConjugate(inf, tense string) [6]string {
	var out [6]string
	for _, v := range langVerbs {
		if v.Inf != inf {
			continue
		}
		forms := langForms(v, tense)
		for i, f := range forms {
			out[i] = langWithPronoun(i, f, tense == "subjonctif présent")
		}
	}
	return out
}

// langVerbJSON is every table, ready for the browser.
func langVerbJSON() string {
	type table struct {
		Inf, Gloss, Aux, Note string
		Tenses                map[string][6]string
	}
	var all []table
	for _, v := range langVerbs {
		t := table{Inf: v.Inf, Gloss: v.Gloss, Aux: v.Aux, Note: v.Note, Tenses: map[string][6]string{}}
		for _, tense := range langTenses {
			t.Tenses[tense] = langConjugate(v.Inf, tense)
		}
		all = append(all, t)
	}
	b, _ := json.Marshal(map[string]any{"verbs": all, "tenses": langTenses, "persons": langPersons})
	return string(b)
}

// ---------------------------------------------------------------- numbers

var (
	langUnits = []string{"zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
		"dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"}
	langTens = []string{"", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"}
)

// langBelow100 spells 0–99 in traditional spelling. final says whether the
// number ends the whole numeral (quatre-vingts takes its s only then).
func langBelow100(n int, final bool) string {
	switch {
	case n <= 16:
		return langUnits[n]
	case n < 20:
		return "dix-" + langUnits[n-10]
	}
	t, u := n/10, n%10
	switch {
	case t <= 6:
		switch u {
		case 0:
			return langTens[t]
		case 1:
			return langTens[t] + " et un"
		}
		return langTens[t] + "-" + langUnits[u]
	case t == 7:
		if u == 1 {
			return "soixante et onze"
		}
		return "soixante-" + langBelow100(10+u, final)
	case t == 8:
		if u == 0 {
			if final {
				return "quatre-vingts"
			}
			return "quatre-vingt"
		}
		return "quatre-vingt-" + langUnits[u]
	}
	return "quatre-vingt-" + langBelow100(10+u, final)
}

func langBelow1000(n int, final bool) string {
	hund, rest := n/100, n%100
	if hund == 0 {
		return langBelow100(rest, final)
	}
	s := "cent"
	if hund > 1 {
		s = langUnits[hund] + " cent"
		if rest == 0 && final {
			s += "s"
		}
	}
	if rest > 0 {
		s += " " + langBelow100(rest, final)
	}
	return s
}

// langNumber spells 0–999 999 in French. reform applies the 1990
// rectifications: hyphens between every numeral word.
func langNumber(n int, reform bool) string {
	var s string
	switch {
	case n < 1000:
		s = langBelow1000(n, true)
	default:
		th, rest := n/1000, n%1000
		if th == 1 {
			s = "mille"
		} else {
			s = langBelow1000(th, false) + " mille"
		}
		if rest > 0 {
			s += " " + langBelow1000(rest, true)
		}
	}
	if reform {
		s = strings.ReplaceAll(s, " ", "-")
	}
	return s
}

// ---------------------------------------------------------------- nouns

type langNoun struct {
	Word, Gender, Gloss, Lang, Rule string
}

// French nouns chosen to show the ending tendencies and their exceptions.
var langNouns = []langNoun{
	{"nation", "f", "nation", "fr", "-tion → feminine"},
	{"liberté", "f", "freedom", "fr", "-té → feminine"},
	{"été", "m", "summer", "fr", "-té → feminine: exception"},
	{"moment", "m", "moment", "fr", "-ment → masculine"},
	{"fromage", "m", "cheese", "fr", "-age → masculine"},
	{"plage", "f", "beach", "fr", "-age → masculine: exception"},
	{"page", "f", "page", "fr", "-age → masculine: exception"},
	{"image", "f", "picture", "fr", "-age → masculine: exception"},
	{"château", "m", "castle", "fr", "-eau → masculine"},
	{"eau", "f", "water", "fr", "-eau → masculine: exception"},
	{"peau", "f", "skin", "fr", "-eau → masculine: exception"},
	{"journée", "f", "day", "fr", "-ée → feminine"},
	{"idée", "f", "idea", "fr", "-ée → feminine"},
	{"musée", "m", "museum", "fr", "-ée → feminine: exception"},
	{"lycée", "m", "high school", "fr", "-ée → feminine: exception"},
	{"chance", "f", "luck", "fr", "-ance/-ence → feminine"},
	{"silence", "m", "silence", "fr", "-ance/-ence → feminine: exception"},
	{"tourisme", "m", "tourism", "fr", "-isme → masculine"},
	{"problème", "m", "problem", "fr", "Greek -ème words → masculine"},
	{"système", "m", "system", "fr", "Greek -ème words → masculine"},
	{"maison", "f", "house", "fr", "-son is mixed"},
	{"chanson", "f", "song", "fr", "-son is mixed"},
	{"garçon", "m", "boy", "fr", "-on is mostly masculine"},
	{"main", "f", "hand", "fr", "no rule: learn it"},
	{"mer", "f", "sea", "fr", "no rule: learn it"},
	{"livre", "m", "book", "fr", "no rule: learn it"},
	{"voiture", "f", "car", "fr", "-ure → mostly feminine"},
	{"hôpital", "m", "hospital", "fr", "-al → masculine"},
	{"photo", "f", "photo", "fr", "short for la photographie"},
	{"vélo", "m", "bike", "fr", "short for le vélocipède"},
	// German: der (m), die (f), das (n).
	{"Zeitung", "f", "newspaper", "de", "-ung → die"},
	{"Freiheit", "f", "freedom", "de", "-heit/-keit → die"},
	{"Universität", "f", "university", "de", "-tät → die"},
	{"Nation", "f", "nation", "de", "-ion → die"},
	{"Mädchen", "n", "girl", "de", "-chen/-lein → das"},
	{"Zentrum", "n", "centre", "de", "-um → das"},
	{"Frühling", "m", "spring", "de", "-ling → der"},
	{"Lehrer", "m", "teacher", "de", "-er for people → der"},
	{"Tisch", "m", "table", "de", "no rule: learn it"},
	{"Lampe", "f", "lamp", "de", "-e → mostly die"},
	{"Katze", "f", "cat", "de", "-e → mostly die"},
	{"Buch", "n", "book", "de", "no rule: learn it"},
	{"Fenster", "n", "window", "de", "no rule: learn it"},
	{"Löffel", "m", "spoon", "de", "no rule: learn it"},
	{"Gabel", "f", "fork", "de", "no rule: learn it"},
	{"Messer", "n", "knife", "de", "no rule: learn it"},
	{"Sonne", "f", "sun", "de", "-e → mostly die"},
	{"Mond", "m", "moon", "de", "no rule: learn it"},
	{"Auto", "n", "car", "de", "no rule: learn it"},
	{"Hund", "m", "dog", "de", "no rule: learn it"},
}

func langNounJSON() string {
	b, _ := json.Marshal(langNouns)
	return string(b)
}

// ---------------------------------------------------------------- deck

// langStarterDeck: high-frequency French words with their articles; l'
// nouns carry their gender, since the article hides it.
var langStarterDeck = [][2]string{
	{"le chat", "the cat"}, {"la maison", "the house"}, {"l'eau (f.)", "the water"}, {"le pain", "the bread"},
	{"la voiture", "the car"}, {"l'ami (m.)", "the friend"}, {"le travail", "work, the job"}, {"la ville", "the town, city"},
	{"le temps", "time; the weather"}, {"la femme", "the woman; the wife"}, {"l'homme (m.)", "the man"}, {"le jour", "the day"},
	{"la nuit", "the night"}, {"le livre", "the book"}, {"la porte", "the door"}, {"le monde", "the world; people"},
	{"la vie", "life"}, {"l'enfant (m./f.)", "the child"}, {"le pays", "the country"}, {"la main", "the hand"},
	{"être", "to be"}, {"avoir", "to have"}, {"faire", "to do, to make"}, {"aller", "to go"},
	{"dire", "to say"}, {"pouvoir", "can, to be able"}, {"vouloir", "to want"}, {"savoir", "to know (a fact)"},
	{"voir", "to see"}, {"venir", "to come"}, {"grand, grande", "big, tall"}, {"petit, petite", "small"},
	{"bon, bonne", "good"}, {"nouveau, nouvelle", "new"}, {"beaucoup", "a lot, much"}, {"toujours", "always; still"},
	{"aujourd'hui", "today"}, {"demain", "tomorrow"}, {"merci", "thank you"}, {"parce que", "because"},
}

func langDeckJSON() string {
	b, _ := json.Marshal(langStarterDeck)
	return string(b)
}
