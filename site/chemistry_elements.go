package site

import (
	"strconv"
	"strings"
)

// Element is one entry of the periodic table.
type Element struct {
	Z         int
	Symbol    string
	Name      string
	Weight    string  // as printed: IUPAC abridged standard atomic weight, or [mass number] of a long-lived isotope
	Mass      float64 // for computation
	EN        float64 // Pauling electronegativity, 0 when not well established
	IE        float64 // first ionisation energy in eV, 0 when not listed
	Category  string
	Period    int
	Group     int // 0 for the f-block rows
	Row, Col  int // position in the 18-column display grid (rows 9 and 10 are the f-block)
	Config    string
	Exception bool // ground state differs from the Madelung (Aufbau) filling order
}

// Abridged standard atomic weights (IUPAC 2021), Pauling electronegativities
// and first ionisation energies (eV, NIST) where well established; "-" means
// not listed. Brackets give the mass number of the longest-lived isotope.
const elementTable = `1 H Hydrogen 1.008 2.20 13.598
2 He Helium 4.0026 - 24.587
3 Li Lithium 6.94 0.98 5.392
4 Be Beryllium 9.0122 1.57 9.323
5 B Boron 10.81 2.04 8.298
6 C Carbon 12.011 2.55 11.260
7 N Nitrogen 14.007 3.04 14.534
8 O Oxygen 15.999 3.44 13.618
9 F Fluorine 18.998 3.98 17.423
10 Ne Neon 20.180 - 21.565
11 Na Sodium 22.990 0.93 5.139
12 Mg Magnesium 24.305 1.31 7.646
13 Al Aluminium 26.982 1.61 5.986
14 Si Silicon 28.085 1.90 8.152
15 P Phosphorus 30.974 2.19 10.487
16 S Sulfur 32.06 2.58 10.360
17 Cl Chlorine 35.45 3.16 12.968
18 Ar Argon 39.95 - 15.760
19 K Potassium 39.098 0.82 4.341
20 Ca Calcium 40.078 1.00 6.113
21 Sc Scandium 44.956 1.36 6.561
22 Ti Titanium 47.867 1.54 6.828
23 V Vanadium 50.942 1.63 6.746
24 Cr Chromium 51.996 1.66 6.767
25 Mn Manganese 54.938 1.55 7.434
26 Fe Iron 55.845 1.83 7.902
27 Co Cobalt 58.933 1.88 7.881
28 Ni Nickel 58.693 1.91 7.640
29 Cu Copper 63.546 1.90 7.726
30 Zn Zinc 65.38 1.65 9.394
31 Ga Gallium 69.723 1.81 5.999
32 Ge Germanium 72.630 2.01 7.899
33 As Arsenic 74.922 2.18 9.789
34 Se Selenium 78.971 2.55 9.752
35 Br Bromine 79.904 2.96 11.814
36 Kr Krypton 83.798 3.00 14.000
37 Rb Rubidium 85.468 0.82 4.177
38 Sr Strontium 87.62 0.95 5.695
39 Y Yttrium 88.906 1.22 6.217
40 Zr Zirconium 91.224 1.33 6.634
41 Nb Niobium 92.906 1.6 6.759
42 Mo Molybdenum 95.95 2.16 7.092
43 Tc Technetium [98] 1.9 7.28
44 Ru Ruthenium 101.07 2.2 7.361
45 Rh Rhodium 102.91 2.28 7.459
46 Pd Palladium 106.42 2.20 8.337
47 Ag Silver 107.87 1.93 7.576
48 Cd Cadmium 112.41 1.69 8.994
49 In Indium 114.82 1.78 5.786
50 Sn Tin 118.71 1.96 7.344
51 Sb Antimony 121.76 2.05 8.608
52 Te Tellurium 127.60 2.1 9.010
53 I Iodine 126.90 2.66 10.451
54 Xe Xenon 131.29 2.6 12.130
55 Cs Caesium 132.91 0.79 3.894
56 Ba Barium 137.33 0.89 5.212
57 La Lanthanum 138.91 1.10 5.577
58 Ce Cerium 140.12 1.12 5.539
59 Pr Praseodymium 140.91 1.13 5.473
60 Nd Neodymium 144.24 1.14 5.525
61 Pm Promethium [145] - 5.582
62 Sm Samarium 150.36 1.17 5.644
63 Eu Europium 151.96 - 5.670
64 Gd Gadolinium 157.25 1.20 6.150
65 Tb Terbium 158.93 - 5.864
66 Dy Dysprosium 162.50 1.22 5.939
67 Ho Holmium 164.93 1.23 6.022
68 Er Erbium 167.26 1.24 6.108
69 Tm Thulium 168.93 1.25 6.184
70 Yb Ytterbium 173.05 - 6.254
71 Lu Lutetium 174.97 1.27 5.426
72 Hf Hafnium 178.49 1.3 6.825
73 Ta Tantalum 180.95 1.5 7.550
74 W Tungsten 183.84 2.36 7.864
75 Re Rhenium 186.21 1.9 7.834
76 Os Osmium 190.23 2.2 8.438
77 Ir Iridium 192.22 2.20 8.967
78 Pt Platinum 195.08 2.28 8.959
79 Au Gold 196.97 2.54 9.226
80 Hg Mercury 200.59 2.00 10.438
81 Tl Thallium 204.38 1.62 6.108
82 Pb Lead 207.2 2.33 7.417
83 Bi Bismuth 208.98 2.02 7.286
84 Po Polonium [209] 2.0 8.414
85 At Astatine [210] 2.2 9.318
86 Rn Radon [222] - 10.749
87 Fr Francium [223] 0.7 4.073
88 Ra Radium [226] 0.9 5.278
89 Ac Actinium [227] 1.1 5.17
90 Th Thorium 232.04 1.3 6.307
91 Pa Protactinium 231.04 1.5 5.89
92 U Uranium 238.03 1.38 6.194
93 Np Neptunium [237] 1.36 -
94 Pu Plutonium [244] 1.28 -
95 Am Americium [243] - -
96 Cm Curium [247] - -
97 Bk Berkelium [247] - -
98 Cf Californium [251] - -
99 Es Einsteinium [252] - -
100 Fm Fermium [257] - -
101 Md Mendelevium [258] - -
102 No Nobelium [259] - -
103 Lr Lawrencium [266] - -
104 Rf Rutherfordium [267] - -
105 Db Dubnium [268] - -
106 Sg Seaborgium [269] - -
107 Bh Bohrium [270] - -
108 Hs Hassium [269] - -
109 Mt Meitnerium [278] - -
110 Ds Darmstadtium [281] - -
111 Rg Roentgenium [282] - -
112 Cn Copernicium [285] - -
113 Nh Nihonium [286] - -
114 Fl Flerovium [289] - -
115 Mc Moscovium [290] - -
116 Lv Livermorium [293] - -
117 Ts Tennessine [294] - -
118 Og Oganesson [294] - -`

// Categories, with the colours the table uses for them (hex, mixed at low
// opacity into the background).
var categories = []struct{ key, name, color string }{
	{"alkali", "Alkali metal", "#d5512f"},
	{"alkaline", "Alkaline earth metal", "#d5a910"},
	{"transition", "Transition metal", "#1ca1c7"},
	{"post", "Post-transition metal", "#7c8b9e"},
	{"metalloid", "Metalloid", "#18a46c"},
	{"nonmetal", "Reactive nonmetal", "#009fff"},
	{"halogen", "Halogen", "#693acf"},
	{"noble", "Noble gas", "#a631be"},
	{"lanthanide", "Lanthanide", "#d32a61"},
	{"actinide", "Actinide", "#c4556f"},
	{"unknown", "Unknown properties", "#8a8a8a"},
}

func categoryOf(z int, sym string) string {
	switch {
	case z >= 109:
		return "unknown"
	case z >= 57 && z <= 71:
		return "lanthanide"
	case z >= 89 && z <= 103:
		return "actinide"
	}
	switch sym {
	case "H", "C", "N", "O", "P", "S", "Se":
		return "nonmetal"
	case "F", "Cl", "Br", "I", "At":
		return "halogen"
	case "He", "Ne", "Ar", "Kr", "Xe", "Rn":
		return "noble"
	case "B", "Si", "Ge", "As", "Sb", "Te":
		return "metalloid"
	case "Li", "Na", "K", "Rb", "Cs", "Fr":
		return "alkali"
	case "Be", "Mg", "Ca", "Sr", "Ba", "Ra":
		return "alkaline"
	case "Al", "Ga", "In", "Sn", "Tl", "Pb", "Bi", "Po":
		return "post"
	}
	return "transition"
}

// position returns period, group (0 in the f-block) and grid row/column.
func position(z int) (period, group, row, col int) {
	starts := []int{1, 3, 11, 19, 37, 55, 87, 119}
	for p := 1; p <= 7; p++ {
		if z < starts[p] {
			period = p
			break
		}
	}
	i := z - starts[period-1] // index within the period
	switch {
	case period == 1:
		group = map[int]int{0: 1, 1: 18}[i]
	case period <= 3:
		if i < 2 {
			group = i + 1
		} else {
			group = i + 11
		}
	case period <= 5:
		group = i + 1
	default: // periods 6 and 7 carry the f-block
		switch {
		case i < 2:
			group = i + 1
		case i < 17: // La–Lu, Ac–Lr
			return period, 0, period + 3, i + 1
		default:
			group = i - 13
		}
	}
	return period, group, period, group
}

// Subshells in Madelung (n + l, then n) order, with their capacities.
var madelung = []string{"1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s", "4f", "5d", "6p", "7s", "5f", "6d", "7p"}

func capacity(sub string) int {
	return map[byte]int{'s': 2, 'p': 6, 'd': 10, 'f': 14}[sub[1]]
}

// Measured ground states that differ from Madelung filling (NIST).
var configExceptions = map[int]map[string]int{
	24: {"3d": 5, "4s": 1}, 29: {"3d": 10, "4s": 1},
	41: {"4d": 4, "5s": 1}, 42: {"4d": 5, "5s": 1}, 44: {"4d": 7, "5s": 1}, 45: {"4d": 8, "5s": 1},
	46: {"4d": 10, "5s": 0}, 47: {"4d": 10, "5s": 1},
	57: {"4f": 0, "5d": 1}, 58: {"4f": 1, "5d": 1}, 64: {"4f": 7, "5d": 1},
	78: {"5d": 9, "6s": 1}, 79: {"5d": 10, "6s": 1},
	89: {"5f": 0, "6d": 1}, 90: {"5f": 0, "6d": 2}, 91: {"5f": 2, "6d": 1}, 92: {"5f": 3, "6d": 1},
	93: {"5f": 4, "6d": 1}, 96: {"5f": 7, "6d": 1}, 103: {"6d": 0, "7p": 1},
}

// occupancy is the ground-state electron count per subshell.
func occupancy(z int) map[string]int {
	occ := map[string]int{}
	left := z
	for _, s := range madelung {
		n := min(left, capacity(s))
		occ[s] = n
		left -= n
	}
	for s, n := range configExceptions[z] {
		occ[s] = n
	}
	return occ
}

var superDigits = []rune("⁰¹²³⁴⁵⁶⁷⁸⁹")

func sup(n int) string {
	var b strings.Builder
	for _, c := range strconv.Itoa(n) {
		b.WriteRune(superDigits[c-'0'])
	}
	return b.String()
}

// subshellsByN lists occupied subshells in n-then-l order (the way
// configurations are written: [Xe] 4f¹⁴ 5d¹⁰ 6s¹).
func subshellsByN(occ map[string]int) []string {
	var out []string
	for n := '1'; n <= '7'; n++ {
		for _, l := range "spdf" {
			s := string(n) + string(l)
			if occ[s] > 0 {
				out = append(out, s)
			}
		}
	}
	return out
}

// configString writes the configuration with a noble-gas core.
func configString(z int) string {
	occ := occupancy(z)
	core := 0
	for _, ng := range []int{86, 54, 36, 18, 10, 2} {
		if ng < z {
			core = ng
			break
		}
	}
	var parts []string
	coreOcc := map[string]int{}
	if core > 0 {
		coreOcc = occupancy(core)
		parts = append(parts, "["+map[int]string{2: "He", 10: "Ne", 18: "Ar", 36: "Kr", 54: "Xe", 86: "Rn"}[core]+"]")
	}
	for _, s := range subshellsByN(occ) {
		if n := occ[s] - coreOcc[s]; n > 0 {
			parts = append(parts, s+sup(n))
		}
	}
	return strings.Join(parts, " ")
}

// fullOccupancy is the configuration as "1s2 2s2 2p6 …" in Madelung order,
// for the client-side orbital diagrams.
func fullOccupancy(z int) string {
	occ := occupancy(z)
	var parts []string
	for _, s := range madelung {
		if occ[s] > 0 {
			parts = append(parts, s+strconv.Itoa(occ[s]))
		}
	}
	return strings.Join(parts, " ")
}

var elements = func() []Element {
	var out []Element
	for _, line := range strings.Split(elementTable, "\n") {
		f := strings.Fields(line)
		z, _ := strconv.Atoi(f[0])
		e := Element{Z: z, Symbol: f[1], Name: f[2], Weight: f[3]}
		e.Mass, _ = strconv.ParseFloat(strings.Trim(f[3], "[]"), 64)
		if f[4] != "-" {
			e.EN, _ = strconv.ParseFloat(f[4], 64)
		}
		if f[5] != "-" {
			e.IE, _ = strconv.ParseFloat(f[5], 64)
		}
		e.Category = categoryOf(z, e.Symbol)
		e.Period, e.Group, e.Row, e.Col = position(z)
		e.Config = configString(z)
		_, e.Exception = configExceptions[z]
		out = append(out, e)
	}
	return out
}()

// elementData is "Sym:mass,…" for the client-side formula parsers.
func elementData() string {
	var b strings.Builder
	for i, e := range elements {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(e.Symbol + ":" + strconv.FormatFloat(e.Mass, 'f', -1, 64))
	}
	return b.String()
}
