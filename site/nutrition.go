package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NutritionBlocks lists the nutrition science gallery in display order.
// Every block is educational: none of it is medical or dietary advice, and
// every food value is a rounded, typical figure labelled as such.
func NutritionBlocks() []Block {
	return []Block{
		nutriBMRBlock(),
		nutriBalanceBlock(),
		nutriAtwaterBlock(),
		nutriGlycemicBlock(),
		nutriProteinBlock(),
		nutriMicroBlock(),
		nutriDensityBlock(),
		nutriBodyBlock(),
		nutriSodiumBlock(),
		nutriStudyBlock(),
	}
}

// nutriNote is the small evidence or caveat line under a block's controls.
func nutriNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// nutriAdvice marks the blocks that touch on personal numbers.
func nutriAdvice() h.Node {
	return h.P(h.Class("flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"),
		hugeicons.InformationCircleIcon(h.Class("mt-px size-3.5 shrink-0")),
		"Educational model, not medical or dietary advice.")
}

// nutriSegs is a segmented control whose seg-change events carry a group
// name, so a block can hold several of them.
func nutriSegs(group, label string, opts ...[2]string) h.Node {
	return h.Div(h.Data("group", group), segs(label, opts...))
}

func nutriPresets(ps ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1.5"),
		h.Map(ps, func(p [2]string) h.Node {
			return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
		}),
	)
}

func nutriSvg(label, vb string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(vb), h.Class("block w-full"), h.Role("img"), h.Aria("label", label))
}

// ---------------------------------------------------------------- N1

func nutriBMRBlock() Block {
	return Block{
		Slug:        "bmr",
		Title:       "Energy expenditure equations",
		Description: "Resting energy expenditure predicted by Mifflin–St Jeor (1990) and the Harris–Benedict equation as revised by Roza and Shizgal (1984), then scaled by a physical activity level. The curves run over age for the body you set; the shaded band is ±10 %, the error within which Mifflin–St Jeor lands for most non-obese adults in validation studies.",
		Tags:        []string{"BMR", "PAL", "prediction error"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-bmr",
				nutriSvg("Predicted resting energy expenditure against age", "0 0 560 300"),
				nutriSegs("sex", "Sex", [2]string{"m", "Male"}, [2]string{"f", "Female"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Body"),
					field("w", "Weight", "kg", 80, 35, 200, 0.5),
					field("hgt", "Height", "cm", 180, 130, 215, 1),
					field("age", "Age", "years", 30, 18, 90, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Activity (PAL)"),
					nutriSegs("pal", "Physical activity level", [2]string{"1.4", "1.4"}, [2]string{"1.6", "1.6"}, [2]string{"1.8", "1.8"}, [2]string{"2.0", "2.0"}),
				),
				readouts([2]string{"Mifflin–St Jeor", "msj"}, [2]string{"Harris–Benedict", "hb"}, [2]string{"difference", "diff"}, [2]string{"× PAL", "tdee"}, [2]string{"±10 % band", "band"}),
				nutriNote("PAL bands after FAO/WHO/UNU (2004): about 1.4–1.69 sedentary, 1.7–1.99 active, 2.0–2.4 vigorous. Validation: Frankenfield et al. 2005. Both equations predict a group average; an individual can sit well outside the band."),
				nutriAdvice(),
			)
		},
	}
}

// ---------------------------------------------------------------- N2

func nutriBalanceBlock() Block {
	return Block{
		Slug:        "energy-balance",
		Title:       "Why 3,500 kcal per pound over-predicts",
		Description: "The static rule says a lasting change of energy intake moves weight forever in a straight line, at 7,700 kcal per kilogram. Real expenditure falls as weight falls, so the curve bends to a plateau. The dynamic curve here is a one-compartment approximation of Hall et al.'s rule of thumb (2011): each 10 kcal/day of lasting change ends up as about 1 lb (0.45 kg).",
		Tags:        []string{"energy balance", "plateau", "time constant"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-balance",
				nutriSvg("Weight change over time, static rule against dynamic model", "0 0 560 300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Lasting change"),
					field("de", "Energy intake", "kcal/day", -250, -1000, 1000, 10),
					field("years", "Horizon", "years", 3, 1, 6, 0.5),
					nutriPresets([2]string{"-250", "−250"}, [2]string{"-500", "−500"}, [2]string{"100", "+100"}),
				),
				readouts([2]string{"static, 1 y", "s1"}, [2]string{"dynamic, 1 y", "d1"}, [2]string{"static, end", "s3"}, [2]string{"dynamic, end", "d3"}, [2]string{"plateau", "plateau"}, [2]string{"half reached", "half"}),
				nutriNote("Model: ρ = 7,700 kcal/kg of tissue change; expenditure changes by about 22 kcal/day per kg (from the 10 kcal/day ≈ 1 lb rule), giving a time constant ρ/22 ≈ 350 days. Hall's full model, with changing body composition and adaptation, is slower: about half the change in one year and 95 % in three."),
				nutriAdvice(),
			)
		},
	}
}

// ---------------------------------------------------------------- N3

func nutriAtwaterBlock() Block {
	return Block{
		Slug:        "atwater",
		Title:       "Reading a label with Atwater factors",
		Description: "Energy on a label is computed, not measured: grams of each macronutrient times its general Atwater factor (fat 9, protein 4, carbohydrate 4, alcohol 7 kcal/g; fibre about 2 kcal/g in EU rules). Edit the label and see how the parts add up against the stated total.",
		Tags:        []string{"Atwater", "label", "kcal"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-atwater",
				h.Div(h.Class("flex flex-col gap-4"),
					nutriSvg("Energy by macronutrient, stacked against the label's total", "0 0 560 150"),
					h.Div(h.Data("label", ""), h.Class("mx-auto w-full max-w-sm rounded-lg border-2 border-foreground/80 bg-background p-3 font-mono text-xs"),
						h.P(h.Class("border-b-4 border-foreground/80 pb-1 font-sans text-lg font-bold tracking-tight"), "Nutrition facts"),
						h.Div(h.Class("flex justify-between border-b py-1"), h.Span("per serving"), h.Span(h.Data("out", "name"), "—")),
						h.Div(h.Class("flex justify-between border-b-2 border-foreground/80 py-1 font-sans text-sm font-semibold"), h.Span("Energy (stated)"), h.Span(h.Data("out", "stated"), "—")),
						h.Map([][2]string{{"fat", "Fat"}, {"carb", "Carbohydrate, available"}, {"fibre", "Fibre"}, {"protein", "Protein"}, {"alcohol", "Alcohol"}}, func(r [2]string) h.Node {
							return h.Div(h.Class("flex justify-between border-b py-1"), h.Span(r[1]), h.Span(h.Data("out", "g-"+r[0]), "—"))
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Per serving"),
					field("fat", "Fat", "g", 9, 0, 100, 0.5),
					field("carb", "Carbohydrate", "g", 28, 0, 150, 0.5),
					field("fibre", "Fibre", "g", 4, 0, 40, 0.5),
					field("protein", "Protein", "g", 6, 0, 100, 0.5),
					field("alcohol", "Alcohol", "g", 0, 0, 60, 0.5),
					field("stated", "Stated energy", "kcal", 220, 0, 1500, 5),
				),
				nutriSegs("fibre", "Fibre factor", [2]string{"2", "Fibre 2 kcal/g"}, [2]string{"0", "Fibre 0"}),
				nutriPresets([2]string{"bar", "Granola bar"}, [2]string{"beer", "Beer"}, [2]string{"yoghurt", "Yoghurt"}),
				readouts([2]string{"computed", "computed"}, [2]string{"stated", "st"}, [2]string{"gap", "gap"}, [2]string{"fat share", "fatshare"}),
				nutriNote("Labels are rounded (energy often to the nearest 5 or 10 kcal) and allowed a tolerance: the US FDA, for instance, treats a product as compliant if its actual energy is up to 120 % of the declared value. US labels count fibre within total carbohydrate; EU labels list available carbohydrate and fibre separately. Presets are synthetic, typical products."),
			)
		},
	}
}

// ---------------------------------------------------------------- N4

type nutriGIFood struct {
	id, name, serving string
	gi, carbs         float64
}

// Glycemic index (glucose = 100) and available carbohydrate per serving:
// rounded typical values after the International Tables of Glycemic Index
// (Atkinson et al. 2008, 2021). Varieties and cooking change both a lot.
var nutriGIFoods = []nutriGIFood{
	{"bread", "White bread", "1 slice, 30 g", 75, 14},
	{"rice", "White rice, boiled", "150 g", 73, 40},
	{"pasta", "Spaghetti, boiled", "180 g", 49, 45},
	{"potato", "Potato, boiled", "150 g", 78, 26},
	{"flakes", "Cornflakes", "30 g", 81, 25},
	{"oats", "Porridge oats", "250 g cooked", 55, 22},
	{"lentils", "Lentils, boiled", "150 g", 32, 18},
	{"apple", "Apple", "120 g", 36, 15},
	{"melon", "Watermelon", "120 g", 76, 6},
	{"oj", "Orange juice", "250 ml", 50, 26},
	{"milk", "Milk", "250 ml", 37, 12},
}

func nutriGlycemicBlock() Block {
	return Block{
		Slug:        "glycemic-load",
		Title:       "Glycemic index versus glycemic load",
		Description: "The glycemic index ranks how fast a food's carbohydrate raises blood glucose, per 50 g of carbohydrate. The glycemic load scales it by the carbohydrate actually eaten: GL = GI × carbs / 100. Watermelon has a high index and a tiny load. Build a meal and compare.",
		Tags:        []string{"GI", "GL", "meal builder"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-gl",
				h.Div(h.Class("flex flex-col gap-3"),
					nutriSvg("Glycemic load of each food in the meal", "0 0 560 260"),
					h.Ul(h.Class("grid gap-1.5 sm:grid-cols-2"), h.Aria("label", "Foods"),
						h.Map(nutriGIFoods, func(f nutriGIFood) h.Node {
							return h.Li(h.Data("food", f.id), h.Data("gi", fmt.Sprint(f.gi)), h.Data("carbs", fmt.Sprint(f.carbs)), h.Data("name", f.name),
								h.Class("flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"),
								h.Span(h.Class("flex min-w-0 flex-col"),
									h.Span(h.Class("truncate font-medium"), f.name),
									h.Span(h.Class("font-mono text-[10px] text-muted-foreground"), fmt.Sprintf("%s · GI %g · %g g", f.serving, f.gi, f.carbs)),
								),
								h.Span(h.Class("flex items-center gap-1"),
									button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-6"), h.Type("button"), h.Data("step", "-1"), h.Aria("label", "One serving less of "+f.name), hugeicons.MinusSignIcon(h.Class("size-3"))),
									h.Span(h.Data("count", ""), h.Class("w-4 text-center font-mono tabular-nums"), "0"),
									button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-6"), h.Type("button"), h.Data("step", "1"), h.Aria("label", "One serving more of "+f.name), hugeicons.PlusSignIcon(h.Class("size-3"))),
								),
							)
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Your own food"),
					field("gi", "GI", "", 70, 0, 110, 1),
					field("carbs", "Carbohydrate", "g", 50, 0, 150, 1),
					field("n", "Servings", "", 1, 0, 6, 1),
				),
				nutriPresets([2]string{"breakfast", "Cornflakes + juice"}, [2]string{"lunch", "Lentils + rice"}, [2]string{"melon", "Watermelon"}, [2]string{"clear", "Clear"}),
				readouts([2]string{"meal GL", "gl"}, [2]string{"meal GI", "mgi"}, [2]string{"carbohydrate", "carb"}, [2]string{"your food GL", "own"}),
				nutriNote("Per-serving GL is often called low at ≤ 10 and high at ≥ 20. Meal GI is the carbohydrate-weighted mean of the foods' GIs, a simplification: fat, protein and fibre in a meal slow absorption. Values are approximate and vary with variety, ripeness and cooking."),
				nutriAdvice(),
			)
		},
	}
}

// ---------------------------------------------------------------- N5

type nutriAAFood struct {
	id, name string
	digest   float64
	aa       [9]float64 // mg per g protein, in nutriAAOrder
}

var nutriAAOrder = []string{"His", "Ile", "Leu", "Lys", "SAA", "AAA", "Thr", "Trp", "Val"}

// FAO (2013) scoring pattern for older children, adolescents and adults,
// mg per g protein. SAA = methionine + cysteine, AAA = phenylalanine +
// tyrosine.
var nutriAARef = [9]float64{16, 30, 61, 48, 23, 41, 25, 6.6, 40}

// Rounded typical amino acid compositions (mg/g protein) and protein
// digestibilities; real values vary by source and analysis.
var nutriAAFoods = []nutriAAFood{
	{"rice", "Rice", 0.88, [9]float64{23, 40, 82, 36, 45, 90, 36, 12, 58}},
	{"wheat", "Wheat", 0.91, [9]float64{23, 35, 68, 27, 38, 78, 29, 12, 43}},
	{"maize", "Maize", 0.85, [9]float64{30, 36, 125, 27, 40, 87, 37, 7, 50}},
	{"beans", "Kidney beans", 0.80, [9]float64{28, 44, 80, 69, 21, 81, 42, 12, 52}},
	{"soy", "Soy", 0.91, [9]float64{26, 46, 78, 63, 26, 88, 39, 13, 48}},
	{"egg", "Egg", 0.97, [9]float64{24, 54, 86, 72, 55, 93, 47, 16, 68}},
}

func nutriProteinBlock() Block {
	foodSeg := func(group, label string) h.Node {
		opts := make([][2]string, len(nutriAAFoods))
		for i, f := range nutriAAFoods {
			opts[i] = [2]string{f.id, f.name}
		}
		if group == "b" {
			opts[0], opts[3] = opts[3], opts[0]
		}
		return nutriSegs(group, label, opts...)
	}
	return Block{
		Slug:        "protein-quality",
		Title:       "Protein quality and complementing",
		Description: "A protein is scored by its scarcest essential amino acid relative to a reference pattern: the limiting amino acid. Cereals run short of lysine, legumes of the sulfur amino acids, so a mix can score higher than either. Bars show each amino acid as a fraction of the FAO (2013) pattern.",
		Tags:        []string{"amino acid score", "PDCAAS", "limiting"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-protein",
				nutriSvg("Essential amino acids of the blend relative to the reference pattern", "0 0 560 280"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Food A"), foodSeg("a", "Food A")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Food B"), foodSeg("b", "Food B")),
				field("mix", "Protein from A", "%", 50, 0, 100, 5),
				h.Template(h.Data("foods", ""), h.Map(nutriAAFoods, func(f nutriAAFood) h.Node {
					s := ""
					for i, v := range f.aa {
						if i > 0 {
							s += ","
						}
						s += fmt.Sprint(v)
					}
					return h.Div(h.Data("id", f.id), h.Data("name", f.name), h.Data("digest", fmt.Sprint(f.digest)), h.Data("aa", s))
				})),
				readouts([2]string{"limiting", "lim"}, [2]string{"amino acid score", "aas"}, [2]string{"digestibility", "dig"}, [2]string{"PDCAAS", "pdcaas"}),
				nutriNote("PDCAAS = amino acid score × protein digestibility, capped at 1.0. DIAAS, which FAO recommended in 2013, uses the ileal digestibility of each amino acid and is not capped; it needs data not modelled here. Compositions and digestibilities are rounded typical values."),
			)
		},
	}
}

// ---------------------------------------------------------------- N6

func nutriMicroBlock() Block {
	return Block{
		Slug:        "micronutrient",
		Title:       "EAR, RDA and UL",
		Description: "Requirements vary between people. The Estimated Average Requirement (EAR) meets the needs of half of them; the Recommended Dietary Allowance (RDA) sits two standard deviations higher and covers about 97.5 %. Above the Tolerable Upper Intake Level (UL) the risk of harm can start. For a population, the share eating below the EAR estimates how many fall short.",
		Tags:        []string{"DRI", "cut-point", "risk curve"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-micro",
				nutriSvg("Risk of inadequacy against intake, with the population's intake distribution", "0 0 560 300"),
				nutriSegs("nutrient", "Nutrient", [2]string{"vcm", "Vitamin C, men"}, [2]string{"vcf", "Vitamin C, women"}, [2]string{"zn", "Zinc, men"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Population intake"),
					field("median", "Median", "mg/day", 70, 1, 400, 1),
					field("spread", "Spread (GSD)", "×", 1.6, 1.1, 3, 0.05),
					field("you", "One intake", "mg/day", 80, 1, 3000, 1),
				),
				readouts([2]string{"EAR / RDA / UL", "dri"}, [2]string{"below EAR", "below"}, [2]string{"probability approach", "prob"}, [2]string{"above UL", "above"}, [2]string{"P(inadequate) at intake", "pi"}),
				nutriNote("Values for adults 19–50 from the US Institute of Medicine (2000, 2001): vitamin C EAR 75 / RDA 90 mg (men), 60 / 75 mg (women), UL 2,000 mg; zinc EAR 9.4 / RDA 11 mg (men), UL 40 mg. Requirement spread from SD = (RDA − EAR)/2. The intake distribution is a synthetic log-normal. The cut-point method needs requirements that are roughly symmetric and independent of intake; it fails for iron in menstruating women."),
				nutriAdvice(),
			)
		},
	}
}

// ---------------------------------------------------------------- N7

type nutriDensityFood struct {
	name string
	v    [7]float64 // kcal, protein g, fibre g, vitamin C mg, potassium mg, calcium mg, iron mg per 100 g
}

// Rounded typical values per 100 g after USDA FoodData Central (SR Legacy).
var nutriDensityFoods = []nutriDensityFood{
	{"Spinach, raw", [7]float64{23, 2.9, 2.2, 28, 558, 99, 2.7}},
	{"Broccoli, raw", [7]float64{34, 2.8, 2.6, 89, 316, 47, 0.7}},
	{"Orange", [7]float64{47, 0.9, 2.4, 53, 181, 40, 0.1}},
	{"Banana", [7]float64{89, 1.1, 2.6, 8.7, 358, 5, 0.3}},
	{"Potato, boiled", [7]float64{87, 1.9, 1.8, 13, 379, 5, 0.3}},
	{"Lentils, boiled", [7]float64{116, 9, 7.9, 1.5, 369, 19, 3.3}},
	{"Milk, whole", [7]float64{61, 3.2, 0, 0, 132, 113, 0}},
	{"Egg", [7]float64{143, 12.6, 0, 0, 138, 56, 1.8}},
	{"Chicken breast, cooked", [7]float64{165, 31, 0, 0, 256, 15, 1}},
	{"Cheddar", [7]float64{403, 25, 0, 0, 76, 710, 0.7}},
	{"Bread, white, enriched", [7]float64{265, 9, 2.7, 0, 115, 151, 3.6}},
	{"Almonds", [7]float64{579, 21, 12.5, 0, 733, 269, 3.7}},
}

func nutriDensityBlock() Block {
	return Block{
		Slug:        "nutrient-density",
		Title:       "Nutrient density per 100 kcal",
		Description: "Per 100 g, almonds and cheddar look rich in almost everything because they are energy-dense. Per 100 kcal, the ranking changes: leafy vegetables pull ahead for most vitamins and minerals. Switch the basis and the nutrient and watch the order move.",
		Tags:        []string{"density", "per 100 kcal", "ranking"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-density",
				nutriSvg("Foods ranked by the chosen nutrient", "0 0 560 342"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Basis"),
					nutriSegs("basis", "Basis", [2]string{"kcal", "Per 100 kcal"}, [2]string{"g", "Per 100 g"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Nutrient"),
					nutriSegs("nutrient", "Nutrient", [2]string{"1", "Protein"}, [2]string{"2", "Fibre"}, [2]string{"3", "Vitamin C"}, [2]string{"4", "Potassium"}, [2]string{"5", "Calcium"}, [2]string{"6", "Iron"}),
				),
				h.Template(h.Data("foods", ""), h.Map(nutriDensityFoods, func(f nutriDensityFood) h.Node {
					s := ""
					for i, v := range f.v {
						if i > 0 {
							s += ","
						}
						s += fmt.Sprint(v)
					}
					return h.Div(h.Data("name", f.name), h.Data("v", s))
				})),
				readouts([2]string{"top", "top"}, [2]string{"top value", "topv"}, [2]string{"rank changes", "moves"}),
				nutriNote("Rounded typical values per 100 g after USDA FoodData Central; varieties and preparation differ. Density says nothing about absorption (iron from plants is less available than from meat) or about how much of a food people actually eat."),
			)
		},
	}
}

// ---------------------------------------------------------------- N8

func nutriBodyBlock() Block {
	return Block{
		Slug:        "body-composition",
		Title:       "BMI and its limits",
		Description: "Body mass index is weight over height squared: cheap, useful for populations, blind to what the weight is made of. Two people with the same BMI can carry very different fat and waist sizes. The waist-to-height ratio adds where the fat sits.",
		Tags:        []string{"BMI", "waist-to-height", "fat mass"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-body",
				nutriSvg("Weight against height with BMI category bands", "0 0 560 300"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Measurements"),
					field("w", "Weight", "kg", 105, 35, 200, 0.5),
					field("hgt", "Height", "cm", 185, 140, 210, 1),
					field("waist", "Waist", "cm", 88, 50, 160, 1),
					field("fat", "Body fat", "%", 14, 4, 55, 1),
				),
				nutriPresets([2]string{"rugby", "Rugby forward"}, [2]string{"desk", "Same BMI, sedentary"}, [2]string{"slim", "Normal BMI, high fat"}),
				readouts([2]string{"BMI", "bmi"}, [2]string{"category", "cat"}, [2]string{"waist / height", "whtr"}, [2]string{"fat mass", "fm"}, [2]string{"lean mass", "lm"}),
				nutriNote("WHO adult cut-points: 18.5, 25 and 30 kg/m²; WHO (2004) also suggested lower public-health action points (23 and 27.5) for many Asian populations. A waist-to-height ratio above 0.5 is a widely used screening boundary (Ashwell et al. 2012). Body fat % here is an input: measuring it well needs methods such as DXA."),
				nutriAdvice(),
			)
		},
	}
}

// ---------------------------------------------------------------- N9

type nutriSaltFood struct {
	id, name, serving string
	na, k             float64 // mg per serving
}

// Rounded typical sodium and potassium per serving; brands vary widely.
var nutriSaltFoods = []nutriSaltFood{
	{"bread", "Bread", "2 slices", 400, 100},
	{"cheese", "Cheddar", "30 g", 190, 25},
	{"ham", "Ham", "2 slices, 50 g", 600, 140},
	{"soup", "Canned soup", "1 bowl, 300 g", 900, 300},
	{"crisps", "Crisps", "30 g bag", 160, 360},
	{"soy", "Soy sauce", "1 tbsp", 900, 60},
	{"banana", "Banana", "1 medium", 1, 420},
	{"potato", "Baked potato", "1 medium, 170 g", 15, 920},
	{"beans", "White beans", "150 g", 10, 830},
	{"spinach", "Spinach, cooked", "90 g", 65, 420},
	{"yoghurt", "Yoghurt", "150 g", 70, 230},
	{"oj", "Orange juice", "250 ml", 5, 450},
}

func nutriSodiumBlock() Block {
	return Block{
		Slug:        "sodium-potassium",
		Title:       "Salt, sodium and potassium",
		Description: "Salt is sodium chloride, and only 39 % of its weight is sodium: 1 g of salt carries 393 mg of sodium. Build a day's foods and compare sodium and potassium with the WHO guidelines, and the sodium-to-potassium molar ratio that studies link to blood pressure.",
		Tags:        []string{"sodium", "potassium", "Na:K ratio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-salt",
				h.Div(h.Class("flex flex-col gap-3"),
					nutriSvg("Sodium and potassium for the day against the guidelines", "0 0 560 170"),
					h.Ul(h.Class("grid gap-1.5 sm:grid-cols-2"), h.Aria("label", "Foods"),
						h.Map(nutriSaltFoods, func(f nutriSaltFood) h.Node {
							return h.Li(h.Data("food", f.id), h.Data("na", fmt.Sprint(f.na)), h.Data("k", fmt.Sprint(f.k)),
								h.Class("flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"),
								h.Span(h.Class("flex min-w-0 flex-col"),
									h.Span(h.Class("truncate font-medium"), f.name),
									h.Span(h.Class("font-mono text-[10px] text-muted-foreground"), fmt.Sprintf("%s · Na %g · K %g mg", f.serving, f.na, f.k)),
								),
								h.Span(h.Class("flex items-center gap-1"),
									button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-6"), h.Type("button"), h.Data("step", "-1"), h.Aria("label", "One serving less of "+f.name), hugeicons.MinusSignIcon(h.Class("size-3"))),
									h.Span(h.Data("count", ""), h.Class("w-4 text-center font-mono tabular-nums"), "0"),
									button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-6"), h.Type("button"), h.Data("step", "1"), h.Aria("label", "One serving more of "+f.name), hugeicons.PlusSignIcon(h.Class("size-3"))),
								),
							)
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Salt converter"),
					field("salt", "Salt", "g", 5, 0, 30, 0.1),
					h.P(h.Data("out", "conv"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
				),
				nutriPresets([2]string{"processed", "Processed day"}, [2]string{"fresh", "Fresh day"}, [2]string{"clear", "Clear"}),
				readouts([2]string{"sodium", "na"}, [2]string{"as salt", "saltEq"}, [2]string{"potassium", "k"}, [2]string{"Na:K molar", "ratio"}),
				nutriNote("WHO (2012) guidelines for adults: sodium below 2,000 mg/day (5 g salt) and potassium at least 3,510 mg/day; a Na:K molar ratio near 1 or below corresponds to meeting both. Serving values are rounded and brands vary widely, especially for bread, soup and ham."),
				nutriAdvice(),
			)
		},
	}
}

// ---------------------------------------------------------------- N10

func nutriStudyBlock() Block {
	return Block{
		Slug:        "study-designs",
		Title:       "Healthy-user bias in a simulated cohort",
		Description: "A synthetic cohort where health-conscious people both eat more of food X and fall ill less, for reasons unrelated to X. The crude comparison shows X as protective even when its true effect is nil; stratifying by health consciousness, or randomising who eats X, recovers the truth.",
		Tags:        []string{"confounding", "RCT", "Mantel–Haenszel"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("nutri-study",
				nutriSvg("Disease risk by exposure, crude and within strata", "0 0 560 300"),
				nutriSegs("design", "Study design", [2]string{"obs", "Observational"}, [2]string{"rct", "Randomised"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cohort"),
					field("n", "People", "", 4000, 200, 20000, 100),
					field("conf", "Confounding", "×", 3, 1, 6, 0.1),
					field("rr", "True effect of X", "RR", 1, 0.5, 2, 0.05),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.RepeatIcon(), "New cohort"),
				readouts([2]string{"crude RR", "crude"}, [2]string{"adjusted RR", "adj"}, [2]string{"true RR", "truth"}, [2]string{"exposed", "exp"}),
				nutriNote("Health-conscious people (40 % of the cohort) are more likely to eat X by the confounding factor, and have half the baseline risk of disease (10 % against 20 %). The adjusted RR is the Mantel–Haenszel estimate across the two strata. Real confounders are many, partly unmeasured, and measured with error."),
				h.P(h.Class("text-xs text-muted-foreground"), "More on study design: ",
					h.A(h.Href("/methods"), h.Class("underline underline-offset-4 hover:text-brand"), "Research Methods"), "."),
			)
		},
	}
}
