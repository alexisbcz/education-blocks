package site

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ChemistryBlocks lists the chemistry gallery in display order.
func ChemistryBlocks() []Block {
	return []Block{
		periodicTableBlock(),
		balancerBlock(),
		molarMassBlock(),
		gasBlock(),
		titrationBlock(),
		kineticsBlock(),
		equilibriumBlock(),
		configBlock(),
		vseprBlock(),
		precipitationBlock(),
	}
}

// textInput is a shadcn-style input for formulas and equations (16px, so
// iOS does not zoom on focus).
func textInput(name, value, label string) h.Node {
	return h.Input(h.Type("text"), h.Data("input", name), h.Value(value), h.Aria("label", label),
		h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Attr("autocapitalize", "off"),
		h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-del"))
}

// wfield is field with a wider input, for values like 101.325.
func wfield(name, lbl, unit string, v float64, min, max, step float64) h.Node {
	return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
		h.Span(h.Class("text-muted-foreground"), lbl),
		h.Span(h.Class("flex items-center gap-1"),
			h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
				h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)),
				h.Attr("autocomplete", "off"),
				h.Class("h-8 w-24 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 read-only:cursor-default read-only:bg-muted/40 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
			h.Span(h.Class("w-8 font-mono text-[11px] text-muted-foreground"), unit),
		),
	)
}

// chip is a small outline button that fills an input with an example.
func chip(attr, value, label string) h.Node {
	return h.Button(h.Type("button"), h.Data(attr, value),
		h.Class("rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"),
		label)
}

// formulaHTML renders digits in a formula as subscripts (C3H8 → C₃H₈).
func formulaNode(f string) h.Node {
	var out []h.Node
	digits := ""
	flush := func() {
		if digits != "" {
			out = append(out, h.Sub(digits))
			digits = ""
		}
	}
	for _, r := range f {
		if r >= '0' && r <= '9' {
			digits += string(r)
			continue
		}
		flush()
		out = append(out, h.Text(string(r)))
	}
	flush()
	return h.Span(h.Group(out))
}

// ---------------------------------------------------------------- C1

func periodicTableBlock() Block {
	return Block{
		Slug:        "periodic-table",
		Title:       "Periodic table",
		Description: "All 118 elements, rendered in Go from one data table: IUPAC standard atomic weights, and ground-state electron configurations derived from the Aufbau order with the measured exceptions applied. Colour by category, electronegativity or ionisation energy; arrow keys move through the table.",
		Tags:        []string{"118 elements", "keyboard grid", "data in Go"},
		Wide:        true,
		Render:      periodicTable,
	}
}

func catColor(key string) string {
	for _, c := range categories {
		if c.key == key {
			return c.color
		}
	}
	return "#8a8a8a"
}

func catName(key string) string {
	for _, c := range categories {
		if c.key == key {
			return c.name
		}
	}
	return key
}

func fmtOpt(v float64, digits int) string {
	if v == 0 {
		return "—"
	}
	return strconv.FormatFloat(v, 'f', digits, 64)
}

func elementCell(e Element, selected bool) h.Node {
	return h.Button(h.Type("button"),
		h.Data("z", fmt.Sprint(e.Z)), h.Data("sym", e.Symbol), h.Data("name", e.Name), h.Data("weight", e.Weight),
		h.Data("en", fmtOpt(e.EN, 2)), h.Data("ie", fmtOpt(e.IE, 3)), h.Data("cat", catName(e.Category)), h.Data("catkey", e.Category),
		h.Data("period", fmt.Sprint(e.Period)), h.Data("group", h.Ternary(e.Group == 0, "f-block", fmt.Sprint(e.Group))),
		h.Data("config", e.Config), h.Data("exception", fmt.Sprint(e.Exception)),
		h.Data("row", fmt.Sprint(e.Row)), h.Data("col", fmt.Sprint(e.Col)),
		h.TabIndex(h.Ternary(selected, 0, -1)), h.If(selected, h.Aria("pressed", "true")),
		h.Aria("label", fmt.Sprintf("%s, %s, atomic number %d", e.Name, e.Symbol, e.Z)),
		h.Style(fmt.Sprintf("grid-row:%d;grid-column:%d;--c:%s", e.Row, e.Col, catColor(e.Category))),
		h.Class("relative flex aspect-square min-w-0 flex-col justify-between rounded-[5px] border border-[color-mix(in_oklab,var(--c)_35%,transparent)] bg-[color-mix(in_oklab,var(--c)_14%,var(--background))] p-1 text-left outline-none transition-[box-shadow,transform] duration-100 hover:z-10 hover:ring-1 hover:ring-foreground/30 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:z-10 aria-pressed:ring-2 aria-pressed:ring-brand"),
		h.Span(h.Class("font-mono text-[8px] leading-none text-muted-foreground tabular-nums"), fmt.Sprint(e.Z)),
		h.Span(h.Class("text-center text-[15px] leading-none font-semibold"), e.Symbol),
		h.Span(h.Class("truncate text-center font-mono text-[7px] leading-none text-muted-foreground"), strings.Trim(e.Weight, "[]")),
	)
}

func periodicTable() h.Node {
	sel := elements[25] // iron
	detail := func(k, v, out string) h.Node {
		return h.Group(h.Dt(h.Class("text-muted-foreground"), k), h.Dd(h.Data("out", out), h.Class("tabular-nums"), v))
	}
	return h.Div(h.Class("flex flex-col gap-4"), h.Data("ptable", ""),
		h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
			segs("Colour by", [2]string{"category", "Category"}, [2]string{"en", "Electronegativity"}, [2]string{"ie", "Ionisation energy"}),
			h.Span(h.Data("out", "scale"), h.Class("font-mono text-[11px] text-muted-foreground"), "Arrow keys move · Enter selects"),
		),
		h.Div(h.Class("scroll-thin overflow-x-auto pb-1"),
			h.Div(h.Role("group"), h.Aria("label", "Periodic table"), h.Data("grid", ""),
				h.Class("grid min-w-[860px] grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-[repeat(7,auto)_0.6rem_repeat(2,auto)] gap-[3px]"),
				h.Map(elements, func(e Element) h.Node { return elementCell(e, e.Z == sel.Z) }),
				h.Div(h.Style("grid-row:6;grid-column:3"), h.Class("flex items-center justify-center rounded-[5px] border border-dashed font-mono text-[9px] text-muted-foreground"), "57–71"),
				h.Div(h.Style("grid-row:7;grid-column:3"), h.Class("flex items-center justify-center rounded-[5px] border border-dashed font-mono text-[9px] text-muted-foreground"), "89–103"),
			),
		),
		h.Div(h.Class("grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
			h.Div(h.Data("detail", ""), h.Aria("live", "polite"), h.Class("flex gap-4 rounded-xl border bg-background p-4 shadow-xs"),
				h.Div(h.Data("swatch", ""), h.Style("--c:"+catColor(sel.Category)),
					h.Class("flex size-24 shrink-0 flex-col justify-between rounded-lg border border-[color-mix(in_oklab,var(--c)_40%,transparent)] bg-[color-mix(in_oklab,var(--c)_16%,var(--background))] p-2"),
					h.Span(h.Data("out", "z"), h.Class("font-mono text-xs tabular-nums"), fmt.Sprint(sel.Z)),
					h.Span(h.Data("out", "sym"), h.Class("text-center text-4xl leading-none font-semibold"), sel.Symbol),
					h.Span(h.Data("out", "weight"), h.Class("text-center font-mono text-[11px]"), sel.Weight),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-baseline gap-2"),
						h.Span(h.Data("out", "name"), h.Class("text-lg font-semibold tracking-tight"), sel.Name),
						h.Span(h.Data("out", "cat"), h.Class("text-xs text-muted-foreground"), catName(sel.Category)),
					),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						h.Span(h.Data("out", "config"), h.Class("font-mono text-sm"), sel.Config),
						h.Span(h.Data("out", "exception"), h.Hidden(), h.Class("rounded-full bg-brand/12 px-1.5 py-px text-[10px] font-medium text-brand"), "Aufbau exception"),
					),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs"),
						detail("period · group", fmt.Sprintf("%d · %d", sel.Period, sel.Group), "pg"),
						detail("electronegativity", fmtOpt(sel.EN, 2), "en"),
						detail("1st ionisation", fmtOpt(sel.IE, 3)+" eV", "ie"),
					),
				),
			),
			h.Div(h.Data("legend", ""), h.Class("flex flex-wrap content-start gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground"),
				h.Map(categories, func(c struct{ key, name, color string }) h.Node {
					return h.Span(h.Class("flex items-center gap-1.5"),
						h.Span(h.Class("size-2.5 rounded-[3px]"), h.Style("background:"+c.color)), c.name)
				}),
				h.P(h.Class("w-full pt-1 text-[11px] leading-relaxed"),
					"Weights in brackets are mass numbers of the longest-lived isotope. Configurations past Lr are predicted. Electronegativity (Pauling) and ionisation energy are left blank where no well-established value exists."),
			),
		),
	)
}

// ---------------------------------------------------------------- C2

func balancerBlock() Block {
	return Block{
		Slug:        "balancer",
		Title:       "Equation balancer",
		Description: "Type an unbalanced equation; it is balanced exactly, as the null space of the atom-count matrix in rational arithmetic, then scaled to the smallest whole numbers. The table proves it: every element counts the same on both sides.",
		Tags:        []string{"linear algebra", "exact fractions", "parser"},
		Render: func() h.Node {
			return h.Form(h.Class("flex flex-col gap-4"), h.Data("balancer", ""), h.Data("elements", elementData()), h.Action("#"),
				h.Div(h.Class("flex gap-2"),
					textInput("equation", "C3H8 + O2 -> CO2 + H2O", "Chemical equation"),
					button.Button(button.VariantOutline, h.Type("submit"), h.Class("h-9"), "Balance"),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					chip("example", "C3H8 + O2 -> CO2 + H2O", "propane"),
					chip("example", "Fe + O2 -> Fe2O3", "rust"),
					chip("example", "KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2", "KMnO₄ + HCl"),
					chip("example", "Ca3(PO4)2 + H2SO4 -> CaSO4 + H3PO4", "phosphate rock"),
					chip("example", "CuSO4·5H2O -> CuSO4 + H2O", "hydrate"),
				),
				h.Div(h.Data("result", ""), h.Aria("live", "polite"), h.Class("flex min-h-12 items-center justify-center rounded-lg border bg-code px-4 py-3 text-center text-lg")),
				h.Div(h.Data("check", ""), h.Class("scroll-thin overflow-x-auto")),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func molarMassBlock() Block {
	return Block{
		Slug:        "molar-mass",
		Title:       "Molar mass and stoichiometry",
		Description: "From a formula to grams, moles and particles, with each element's share of the mass. Then the question every lab asks: given these masses, which reactant runs out first, and how much product can form?",
		Tags:        []string{"Avogadro", "limiting reagent", "mass %"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-2"), h.Data("molar", ""), h.Data("elements", elementData()),
				h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
					panelLabel("Formula"),
					textInput("formula", "C6H12O6", "Chemical formula"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						chip("formula", "C6H12O6", "glucose"), chip("formula", "Ca(OH)2", "Ca(OH)₂"),
						chip("formula", "CuSO4·5H2O", "CuSO₄·5H₂O"), chip("formula", "C8H10N4O2", "caffeine")),
					h.Div(h.Class("flex items-baseline gap-2"),
						h.Span(h.Class("text-sm text-muted-foreground"), "M ="),
						h.Span(h.Data("out", "mm"), h.Class("font-mono text-2xl font-medium tabular-nums"), "—"),
						h.Span(h.Class("font-mono text-xs text-muted-foreground"), "g/mol"),
					),
					h.Div(h.Data("bar", ""), h.Class("flex h-3 overflow-hidden rounded-full bg-foreground/5")),
					h.Div(h.Data("breakdown", ""), h.Class("font-mono text-xs")),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
						field("grams", "Mass", "g", 10, 0, 100000, 0.1),
						h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs"),
							h.Dt(h.Class("text-muted-foreground"), "amount"), h.Dd(h.Data("out", "mol"), "—"),
							h.Dt(h.Class("text-muted-foreground"), "particles"), h.Dd(h.Data("out", "n"), "—"),
						),
						h.P(h.Class("text-[11px] text-muted-foreground"), "N_A = 6.02214076 × 10²³ mol⁻¹ (exact since 2019)."),
					),
				),
				h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5"),
					panelLabel("Limiting reagent"),
					textInput("reaction", "H2 + O2 -> H2O", "Reaction"),
					h.Div(h.Data("balanced", ""), h.Class("font-mono text-sm")),
					h.Div(h.Data("masses", ""), h.Class("flex flex-col gap-2")),
					h.Div(h.Data("yield", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-1.5 border-t pt-4 text-sm")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func gasBlock() Block {
	return Block{
		Slug:        "ideal-gas",
		Title:       "Ideal gas law",
		Description: "PV = nRT with a box you can watch. Pick which variable to solve for and change the other three; the molecules move at speeds drawn from the Maxwell–Boltzmann distribution for the gas and temperature, plotted below with its three characteristic speeds.",
		Tags:        []string{"PV = nRT", "Maxwell–Boltzmann", "kinetic theory"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gas",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("relative mx-auto h-48 w-full max-w-[560px] overflow-hidden rounded-lg border bg-background"),
						h.Canvas(h.Data("box", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", "Gas molecules in a container with a piston")),
					),
					h.Svg(h.Data("mb", ""), h.ViewBox("0 0 560 200"), h.Class("mx-auto block w-full max-w-[560px]"), h.Role("img"), h.Aria("label", "Maxwell–Boltzmann speed distribution")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Solve for"),
					segs("Solve for", [2]string{"V", "V"}, [2]string{"P", "P"}, [2]string{"T", "T"}, [2]string{"n", "n"}),
				),
				h.Div(h.Class("flex flex-col gap-2"),
					wfield("P", "Pressure", "kPa", 101.325, 1, 2000, 0.001),
					wfield("V", "Volume", "L", 22.414, 0.1, 200, 0.001),
					wfield("T", "Temperature", "K", 273.15, 10, 2000, 0.01),
					wfield("n", "Amount", "mol", 1, 0.01, 20, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Gas"),
					segs("Gas", [2]string{"N2", "N₂"}, [2]string{"He", "He"}, [2]string{"O2", "O₂"}, [2]string{"CO2", "CO₂"}),
				),
				readouts([2]string{"most probable", "vp"}, [2]string{"mean", "vmean"}, [2]string{"root mean square", "vrms"}),
				h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"), "R = 8.314462618 J·mol⁻¹·K⁻¹. Real gases deviate at high pressure and low temperature."),
			)
		},
	}
}

// ---------------------------------------------------------------- C5

func titrationBlock() Block {
	return Block{
		Slug:        "titration",
		Title:       "Titration curve",
		Description: "pH as base is added, solved exactly from the charge balance at every point rather than from textbook shortcuts. A weak acid buffers around its pKa (half-equivalence) and reaches equivalence above pH 7; choose the indicator whose colour change brackets the jump.",
		Tags:        []string{"charge balance", "buffer", "indicators"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("titration",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "pH against volume of base added")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Acid"),
					segs("Acid strength", [2]string{"weak", "Weak acid"}, [2]string{"strong", "Strong acid"}),
					field("pka", "pKa", "", 4.76, 1, 12, 0.01),
					field("ca", "[acid]", "M", 0.1, 0.001, 2, 0.001),
					field("va", "V acid", "mL", 25, 1, 100, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Base (NaOH)"),
					field("cb", "[NaOH]", "M", 0.1, 0.001, 2, 0.001),
					field("vb", "Added", "mL", 12.5, 0, 60, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Indicator"),
					segs("Indicator", [2]string{"phenolphthalein", "Phenolphthalein"}, [2]string{"btb", "Bromothymol blue"}, [2]string{"mo", "Methyl orange"}),
				),
				h.Div(h.Class("flex items-center gap-3"),
					h.Span(h.Data("flask", ""), h.Class("size-8 shrink-0 rounded-full border shadow-inner transition-colors duration-300")),
					h.Span(h.Data("out", "colour"), h.Class("text-xs text-muted-foreground"), "—"),
				),
				readouts([2]string{"pH", "ph"}, [2]string{"equivalence", "eq"}, [2]string{"pH at equivalence", "pheq"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func kineticsBlock() Block {
	return Block{
		Slug:        "kinetics",
		Title:       "Rate laws and Arrhenius",
		Description: "How fast a reactant disappears depends on the order of the reaction and, through the Arrhenius equation, on temperature. Zero, first and second order decay with their half-lives; the right-hand plot is the straight line chemists use to measure the activation energy.",
		Tags:        []string{"rate laws", "half-life", "Arrhenius"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("kinetics",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("conc", ""), h.ViewBox("0 0 400 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Concentration over time")),
					h.Svg(h.Data("arr", ""), h.ViewBox("0 0 260 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Arrhenius plot")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Order"),
					segs("Reaction order", [2]string{"1", "First"}, [2]string{"0", "Zero"}, [2]string{"2", "Second"}),
					field("a0", "[A]₀", "M", 1, 0.01, 5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Arrhenius"),
					field("ea", "Ea", "kJ/mol", 80, 1, 250, 1),
					field("loga", "log₁₀ A", "", 13, 0, 18, 0.1),
					field("T", "T", "K", 298, 200, 800, 1),
				),
				readouts([2]string{"k", "k"}, [2]string{"t½", "half"}, [2]string{"k(T+10)/k(T)", "ratio"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

func equilibriumBlock() Block {
	return Block{
		Slug:        "equilibrium",
		Title:       "Equilibrium and Le Chatelier",
		Description: "N₂ + 3H₂ ⇌ 2NH₃, solved exactly: the extent of reaction that makes Q equal K. Disturb it (add a reactant, remove ammonia, compress) and the system shifts back toward K, the way Le Chatelier predicts.",
		Tags:        []string{"Q vs K", "exact solve", "perturbations"},
		Wide:        true,
		Render: func() h.Node {
			action := func(a, label string, icon h.Node) h.Node {
				return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", a), h.Class("justify-start"), icon, label)
			}
			return plotPanel("equilibrium",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 260"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Concentrations over the course of the reaction")),
					h.Div(h.Data("gauge", ""), h.Class("relative mx-auto h-14 w-full max-w-[560px]"), h.Aria("hidden", "true")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Start (mol/L)"),
					field("n2", "[N₂]₀", "M", 1, 0, 5, 0.01),
					field("h2", "[H₂]₀", "M", 3, 0, 10, 0.01),
					field("nh3", "[NH₃]₀", "M", 0, 0, 5, 0.01),
					field("K", "K_c", "M⁻²", 0.5, 0.0001, 1000, 0.0001),
				),
				h.Div(h.Class("grid grid-cols-1 gap-1.5 border-t pt-4"),
					action("addN2", "Add 0.5 M N₂", hugeicons.Add01Icon()),
					action("removeNH3", "Remove half the NH₃", hugeicons.Remove01Icon()),
					action("compress", "Halve the volume", hugeicons.ArrowShrinkIcon()),
				),
				readouts([2]string{"Q → K", "qk"}, [2]string{"shift", "shift"}),
				h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"), "K_c is adjustable; 0.5 is illustrative. Time is shown in arbitrary units: this block solves where the system ends up, not how fast."),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func configBlock() Block {
	var cfgs []string
	for _, e := range elements {
		cfgs = append(cfgs, e.Symbol+"="+fullOccupancy(e.Z)+"="+fmt.Sprint(e.Exception))
	}
	return Block{
		Slug:        "configuration",
		Title:       "Electron configuration",
		Description: "Orbital boxes filled in Aufbau order, one arrow per electron: Hund's rule puts electrons in separate boxes with parallel spins before any pair up. Chromium, copper and the other exceptions are drawn as measured, not as the rule predicts.",
		Tags:        []string{"Aufbau", "Hund's rule", "exceptions"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("econfig", ""), h.Data("cfg", strings.Join(cfgs, "|")),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Div(h.Class("w-64"), field("z", "Atomic number", "", 24, 1, 118, 1)),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([]string{"8", "24", "26", "29", "46", "64"}, func(z string) h.Node {
							n, _ := strconv.Atoi(z)
							return chip("z", z, elements[n-1].Symbol)
						}),
					),
				),
				h.Div(h.Class("flex items-baseline gap-3"),
					h.Span(h.Data("out", "sym"), h.Class("text-3xl font-semibold"), "Cr"),
					h.Span(h.Data("out", "name"), h.Class("text-sm text-muted-foreground"), "Chromium"),
					h.Span(h.Data("out", "exception"), h.Class("rounded-full bg-brand/12 px-1.5 py-px text-[10px] font-medium text-brand"), "Aufbau exception"),
				),
				h.Div(h.Data("boxes", ""), h.Class("flex flex-wrap gap-x-4 gap-y-3 rounded-lg border bg-code p-4")),
				h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs"),
					h.Dt(h.Class("text-muted-foreground"), "configuration"), h.Dd(h.Data("out", "cfg"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "unpaired electrons"), h.Dd(h.Data("out", "unpaired"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "magnetism"), h.Dd(h.Data("out", "mag"), "—"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- C9

func vseprBlock() Block {
	return Block{
		Slug:        "vsepr",
		Title:       "Molecular geometry (VSEPR)",
		Description: "Ball-and-stick molecules in 3D: drag to rotate, or focus and use the arrow keys. Lone pairs push bonds together, which is why water bends to 104.5° instead of the tetrahedral 109.5°. Atoms use the standard CPK colours.",
		Tags:        []string{"3D", "drag to rotate", "bond angles"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("vsepr",
				h.Svg(h.Data("mol", ""), h.ViewBox("-160 -130 320 260"), h.TabIndex(0),
					h.Class("mx-auto block aspect-[32/26] w-full max-w-[560px] cursor-grab touch-none rounded-lg outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"),
					h.Role("img"), h.Aria("label", "Rotatable molecule. Drag or use the arrow keys.")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Molecule"),
					h.Div(h.Class("grid grid-cols-4 gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Molecule"),
						h.MapIdx([]string{"H2O", "NH3", "CH4", "CO2", "BF3", "PCl5", "SF6"}, func(i int, m string) h.Node {
							return h.Button(h.Type("button"), h.Role("tab"), h.Data("seg", m), h.Aria("selected", fmt.Sprint(i == 0)),
								h.Class("rounded-md px-1.5 py-1 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-accent aria-selected:text-foreground"),
								formulaNode(m))
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("vsepr-lp", "lonepairs", "Show lone pairs", true)),
				readouts([2]string{"shape", "shape"}, [2]string{"electron domains", "domains"}, [2]string{"AXE", "axe"}, [2]string{"bond angle", "angle"}, [2]string{"polar", "polar"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C10

type salt struct{ formula, cation, anion string }

var salts = []salt{
	{"AgNO3", "Ag+", "NO3-"}, {"NaCl", "Na+", "Cl-"}, {"KI", "K+", "I-"}, {"BaCl2", "Ba 2+", "Cl-"},
	{"Na2SO4", "Na+", "SO4 2-"}, {"Pb(NO3)2", "Pb 2+", "NO3-"}, {"CuSO4", "Cu 2+", "SO4 2-"},
	{"NaOH", "Na+", "OH-"}, {"Na2CO3", "Na+", "CO3 2-"}, {"CaCl2", "Ca 2+", "Cl-"},
	{"K3PO4", "K+", "PO4 3-"}, {"MgSO4", "Mg 2+", "SO4 2-"}, {"FeCl3", "Fe 3+", "Cl-"}, {"NH4Cl", "NH4+", "Cl-"},
}

func precipitationBlock() Block {
	sel := func(name, label string, def int) h.Node {
		return h.Label(h.Class("flex flex-1 flex-col gap-1.5 text-xs text-muted-foreground"), label,
			h.Select(h.Data("salt", name), h.Aria("label", label),
				h.Class("h-9 rounded-md border border-input bg-background px-2 font-mono text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
				h.MapIdx(salts, func(i int, s salt) h.Node {
					return h.Option(h.Value(s.formula), h.Data("cation", s.cation), h.Data("anion", s.anion), h.If(i == def, h.Selected()), s.formula+"(aq)")
				}),
			),
		)
	}
	return Block{
		Slug:        "precipitation",
		Title:       "Precipitation predictor",
		Description: "Mix two salt solutions: the ions swap partners, and the solubility rules say whether either new pairing falls out as a solid. The net ionic equation keeps only the ions that actually react; the rest are spectators.",
		Tags:        []string{"solubility rules", "net ionic", "aqueous"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("precip", ""),
				h.Div(h.Class("flex flex-col gap-3 sm:flex-row sm:items-end"),
					sel("a", "Solution 1", 0),
					h.Span(h.Class("hidden pb-2 text-muted-foreground sm:block"), "+"),
					sel("b", "Solution 2", 1),
				),
				h.Div(h.Data("result", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-3")),
				h.Details(h.Class("group rounded-lg border bg-background"),
					h.Summary(h.Class("flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"),
						"Solubility rules used",
						hugeicons.ArrowDown01Icon(h.Class("size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"))),
					h.Ul(h.Class("flex list-disc flex-col gap-1 px-3 pb-3 pl-7 text-[13px] leading-relaxed text-muted-foreground"),
						h.Li("Nitrates, and salts of Na⁺, K⁺ and NH₄⁺, are soluble."),
						h.Li("Chlorides and iodides are soluble, except with Ag⁺ and Pb²⁺ (PbCl₂ is only slightly soluble)."),
						h.Li("Sulfates are soluble, except BaSO₄ and PbSO₄; CaSO₄ and Ag₂SO₄ are slightly soluble."),
						h.Li("Carbonates and phosphates are insoluble, except with Na⁺, K⁺ and NH₄⁺."),
						h.Li("Hydroxides are insoluble, except with Na⁺, K⁺ and Ba²⁺; Ca(OH)₂ is slightly soluble."),
						h.Li("Rules of thumb at room temperature. Cu²⁺ and Fe³⁺ oxidise iodide, which is a redox reaction, not a precipitation."),
					),
				),
				h.Div(h.Class("flex items-center gap-2"),
					badge.Badge(badge.VariantOutline, h.Class("font-normal text-muted-foreground"), "Try AgNO₃ + NaCl, Pb(NO₃)₂ + KI, BaCl₂ + Na₂SO₄"),
				),
			)
		},
	}
}
