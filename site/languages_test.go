package site

import "testing"

func TestLangConjugation(t *testing.T) {
	cases := []struct {
		inf, tense string
		person     int
		want       string
	}{
		{"manger", "présent", 3, "nous mangeons"},
		{"manger", "imparfait", 0, "je mangeais"},
		{"manger", "imparfait", 3, "nous mangions"},
		{"commencer", "présent", 3, "nous commençons"},
		{"commencer", "imparfait", 2, "il/elle/on commençait"},
		{"appeler", "présent", 0, "j'appelle"},
		{"appeler", "futur simple", 0, "j'appellerai"},
		{"lever", "présent", 0, "je lève"},
		{"lever", "futur simple", 3, "nous lèverons"},
		{"faire", "présent", 5, "ils/elles font"},
		{"faire", "présent", 4, "vous faites"},
		{"être", "subjonctif présent", 0, "que je sois"},
		{"avoir", "subjonctif présent", 0, "que j'aie"},
		{"avoir", "subjonctif présent", 2, "qu'il/elle/on ait"},
		{"finir", "présent", 3, "nous finissons"},
		{"aller", "passé composé", 0, "je suis allé(e)"},
		{"aller", "passé composé", 3, "nous sommes allé(e)s"},
		{"parler", "passé composé", 0, "j'ai parlé"},
		{"être", "imparfait", 0, "j'étais"},
		{"aller", "futur simple", 0, "j'irai"},
		{"pouvoir", "conditionnel présent", 0, "je pourrais"},
		{"venir", "subjonctif présent", 3, "que nous venions"},
		{"voir", "imparfait", 3, "nous voyions"},
	}
	for _, c := range cases {
		if got := langConjugate(c.inf, c.tense)[c.person]; got != c.want {
			t.Errorf("%s, %s, person %d: got %q, want %q", c.inf, c.tense, c.person, got, c.want)
		}
	}
}

func TestLangNumbers(t *testing.T) {
	trad := map[int]string{
		0: "zéro", 16: "seize", 17: "dix-sept", 21: "vingt et un", 70: "soixante-dix",
		71: "soixante et onze", 72: "soixante-douze", 80: "quatre-vingts", 81: "quatre-vingt-un",
		90: "quatre-vingt-dix", 91: "quatre-vingt-onze", 99: "quatre-vingt-dix-neuf", 100: "cent",
		101: "cent un", 180: "cent quatre-vingts", 200: "deux cents", 201: "deux cent un",
		1000: "mille", 1789: "mille sept cent quatre-vingt-neuf", 2026: "deux mille vingt-six",
		80000: "quatre-vingt mille", 200000: "deux cent mille", 280000: "deux cent quatre-vingt mille",
	}
	for n, want := range trad {
		if got := langNumber(n, false); got != want {
			t.Errorf("%d: got %q, want %q", n, got, want)
		}
	}
	reform := map[int]string{21: "vingt-et-un", 201: "deux-cent-un", 1789: "mille-sept-cent-quatre-vingt-neuf"}
	for n, want := range reform {
		if got := langNumber(n, true); got != want {
			t.Errorf("%d (1990): got %q, want %q", n, got, want)
		}
	}
}
