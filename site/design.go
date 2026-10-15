package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// DesignBlocks lists the art and design gallery in display order.
func DesignBlocks() []Block {
	return []Block{
		dsgHarmoniesBlock(),
		dsgContrastBlock(),
		dsgVisionBlock(),
		dsgTypeScaleBlock(),
		dsgRhythmBlock(),
		dsgGridBlock(),
		dsgCompositionBlock(),
		dsgPerspectiveBlock(),
		dsgGestaltBlock(),
		dsgEasingBlock(),
	}
}

// dsgColorInput is a native colour picker paired with a hex field; both
// carry data-dsg-color=name and stay in sync (static/js/design.js).
func dsgColorInput(name, label, value string) h.Node {
	return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
		h.Span(h.Class("text-muted-foreground"), label),
		h.Span(h.Class("flex items-center gap-1.5"),
			h.Input(h.Type("color"), h.Value(value), h.Data("dsg-color", name), h.Aria("label", label+" picker"),
				h.Class("size-8 cursor-pointer rounded-md border border-input bg-background p-0.5")),
			h.Input(h.Type("text"), h.Value(value), h.Data("dsg-hex", name), h.Aria("label", label+" hex"),
				h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Attr("maxlength", "7"),
				h.Class("h-8 w-24 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
		),
	)
}

func dsgNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

// ---------------------------------------------------------------- D1

func dsgHarmoniesBlock() Block {
	return Block{
		Slug:        "harmonies",
		Title:       "Colour harmonies",
		Description: "The classic harmonies (complementary, analogous, triadic, split-complementary, tetradic) are hue rotations. Done in HSL, the swatches jump in lightness; done in OKLCH, lightness and chroma stay put, so the set looks balanced. Click a swatch to copy it.",
		Tags:        []string{"OKLCH", "HSL", "palette"},
		Wide:        true,
		Render: func() h.Node {
			row := func(space, label string) h.Node {
				return h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex items-baseline justify-between gap-2"),
						h.Span(h.Class("text-sm font-medium"), label),
						h.Span(h.Data("out", "spread-"+space), h.Class("font-mono text-[11px] text-muted-foreground"), "—")),
					h.Div(h.Data("dsg-row", space), h.Class("grid grid-cols-2 gap-2 sm:grid-cols-5")),
				)
			}
			return plotPanel("dsg-harmonies",
				h.Div(h.Class("flex flex-col gap-5 p-1"),
					row("oklch", "Rotated in OKLCH"),
					row("hsl", "Rotated in HSL"),
					dsgNote("Under each swatch: hex, then OKLab lightness L. In HSL the lightness L% stays fixed but perceived lightness does not; the spread line shows the range of OKLab L across the set."),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Base colour"), dsgColorInput("base", "Base", "#d6336c")),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Harmony"),
					segs("Harmony", [2]string{"complementary", "Complementary"}, [2]string{"analogous", "Analogous"},
						[2]string{"triadic", "Triadic"}, [2]string{"split", "Split"}, [2]string{"tetradic", "Tetradic"}),
				),
				dsgNote("Colours outside sRGB are brought back by lowering OKLCH chroma at the same lightness and hue; such swatches are marked ◐."),
			)
		},
	}
}

// ---------------------------------------------------------------- D2

func dsgContrastBlock() Block {
	return Block{
		Slug:        "contrast",
		Title:       "Contrast checker",
		Description: "WCAG 2.x contrast: relative luminance from linearised sRGB, ratio (L1 + 0.05)/(L2 + 0.05). It checks the AA and AAA thresholds and, when the text fails, finds the nearest passing colour by moving only its OKLCH lightness, keeping hue and chroma.",
		Tags:        []string{"WCAG", "accessibility", "luminance"},
		Wide:        true,
		Render: func() h.Node {
			check := func(key, label string) h.Node {
				return h.Div(h.Class("flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"),
					h.Span(h.Class("text-muted-foreground"), label),
					h.Span(h.Data("out", key), h.Class("font-mono font-medium"), "—"))
			}
			return plotPanel("dsg-contrast",
				h.Div(h.Class("flex flex-col gap-3 p-1"),
					h.Div(h.Data("dsg-sample", ""), h.Class("flex flex-col gap-2 rounded-lg border p-5"),
						h.P(h.Class("text-2xl font-semibold tracking-tight"), "Large heading text"),
						h.P(h.Class("text-base leading-relaxed"), "Body text at 16 px. The quick brown fox jumps over the lazy dog, 0123456789."),
						h.P(h.Class("text-xs"), "Small caption text, 12 px."),
					),
					h.Div(h.Class("flex flex-wrap items-baseline gap-x-3 gap-y-1"),
						h.Span(h.Class("text-sm text-muted-foreground"), "Contrast ratio"),
						h.Span(h.Data("out", "ratio"), h.Class("font-mono text-3xl font-medium tabular-nums"), "—"),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2 sm:grid-cols-4"),
						check("aa", "AA text ≥ 4.5"), check("aa-large", "AA large ≥ 3"),
						check("aaa", "AAA text ≥ 7"), check("aaa-large", "AAA large ≥ 4.5")),
					h.Div(h.Data("dsg-suggest", ""), h.Class("flex flex-wrap items-center gap-2 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Colours"),
					dsgColorInput("fg", "Text", "#777777"),
					dsgColorInput("bg", "Background", "#ffffff"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "swap"), hugeicons.RefreshIcon(), "Swap"),
				),
				readouts([2]string{"L text", "lfg"}, [2]string{"L background", "lbg"}),
				dsgNote("Large text means at least 24 px, or 18.66 px bold. Linearisation uses the sRGB threshold 0.04045 (WCAG 2.1 printed 0.03928; the results agree to the shown precision). APCA, the contrast method proposed for WCAG 3, weighs polarity and font size differently; it is not a standard yet and isn't computed here."),
			)
		},
	}
}

// ---------------------------------------------------------------- D3

func dsgVisionBlock() Block {
	return Block{
		Slug:        "colour-vision",
		Title:       "Colour vision deficiency",
		Description: "A palette and a chart seen through simulated protanopia, deuteranopia and tritanopia (Machado, Oliveira & Fernandes 2009, severity 1.0, applied in linear RGB) and achromatopsia. Pairs that become hard to tell apart are flagged by their OKLab distance.",
		Tags:        []string{"accessibility", "Machado 2009", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-vision",
				h.Div(h.Class("flex flex-col gap-4 p-1"),
					h.Div(h.Data("dsg-palette", ""), h.Class("grid grid-cols-5 gap-2")),
					h.Svg(h.Data("dsg-chart", ""), h.ViewBox("0 0 520 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Sample bar chart in the simulated palette")),
					h.Div(h.Data("dsg-warn", ""), h.Aria("live", "polite"), h.Class("text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Vision"),
					segs("Simulation", [2]string{"normal", "Typical"}, [2]string{"protan", "Protanopia"}, [2]string{"deutan", "Deuteranopia"},
						[2]string{"tritan", "Tritanopia"}, [2]string{"achro", "Achromatopsia"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Palette"),
					dsgColorInput("c0", "1", "#d62728"), dsgColorInput("c1", "2", "#2ca02c"), dsgColorInput("c2", "3", "#1f77b4"),
					dsgColorInput("c3", "4", "#ff7f0e"), dsgColorInput("c4", "5", "#9467bd"),
				),
				dsgNote("About 8% of men and 0.5% of women of Northern European ancestry have a red–green deficiency. Simulations approximate dichromacy; real perception varies by person and severity."),
			)
		},
	}
}

// ---------------------------------------------------------------- D4

func dsgTypeScaleBlock() Block {
	return Block{
		Slug:        "type-scale",
		Title:       "Type scale",
		Description: "A modular scale: every size is the base times a ratio raised to a step. Pick a musical ratio, see the sizes in px and rem, and a specimen with a measure check: Bringhurst's comfortable line length is 45 to 75 characters, about 66 ideally.",
		Tags:        []string{"typography", "modular scale", "measure"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-type",
				h.Div(h.Class("flex flex-col gap-4 p-1"),
					h.Div(h.Data("dsg-scale", ""), h.Class("flex flex-col gap-1 overflow-hidden")),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-3"),
						h.Div(h.Class("flex items-baseline justify-between gap-2 text-xs"),
							h.Span(h.Class("text-muted-foreground"), "Measure"),
							h.Span(h.Data("out", "measure"), h.Class("font-mono"), "—")),
						h.P(h.Data("dsg-measure", ""), h.Class("leading-relaxed text-pretty"),
							"Typography exists to honor content. A comfortable line lets the eye return to the start of the next line without hunting for it, and without the rhythm of reading breaking into fragments. Too long and readers lose their place; too short and the text stutters."),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scale"),
					field("base", "Base", "px", 16, 10, 24, 1),
					field("ratio", "Ratio", "", 1.333, 1.05, 1.8, 0.001),
					h.Div(h.Class("flex flex-wrap gap-1.5 pt-1"),
						h.Map([][2]string{{"1.2", "Minor third"}, {"1.25", "Major third"}, {"1.333", "Perfect fourth"}, {"1.5", "Fifth"}, {"1.618", "Golden"}}, func(r [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("ratio", r[0]), r[1])
						})),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Specimen"),
					field("width", "Column", "px", 440, 200, 900, 10),
					field("leading", "Line height", "×", 1.5, 1, 2.2, 0.05),
				),
				dsgNote("Robert Bringhurst, The Elements of Typographic Style (1992): 45–75 characters per line is satisfactory for single-column text, 66 is widely regarded as ideal."),
			)
		},
	}
}

// ---------------------------------------------------------------- D5

func dsgRhythmBlock() Block {
	return Block{
		Slug:        "vertical-rhythm",
		Title:       "Vertical rhythm",
		Description: "Text on a baseline grid: when every line height and margin is a multiple of one unit, lines in neighbouring columns align. Headings get the smallest line height that is a whole number of grid units; toggle the grid to see what snaps.",
		Tags:        []string{"baseline grid", "line height", "layout"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-rhythm",
				h.Div(h.Data("dsg-page", ""), h.Class("relative overflow-hidden rounded-md border bg-background p-4 sm:p-6"),
					h.Div(h.Data("dsg-baseline", ""), h.Aria("hidden", "true"), h.Class("pointer-events-none absolute inset-0")),
					h.Div(h.Data("dsg-flow", ""), h.Class("relative grid gap-x-6 sm:grid-cols-2"),
						h.Div(
							h.H4(h.Data("dsg-h", "1"), "On rhythm"),
							h.P(h.Data("dsg-p", ""), "Vertical rhythm is the regular spacing of lines down a page. A shared unit keeps body text, headings and gaps in step."),
							h.H4(h.Data("dsg-h", "2"), "Why it helps"),
							h.P(h.Data("dsg-p", ""), "Side-by-side columns align line for line, and the page reads as one calm texture."),
						),
						h.Div(
							h.P(h.Data("dsg-p", ""), "When a heading is larger than the text, its line height is rounded up to a whole number of units, so the text after it lands back on the grid."),
							h.P(h.Data("dsg-p", ""), "Break the rule with an odd margin and every later line drifts off the baseline."),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Grid"),
					field("size", "Body", "px", 16, 12, 22, 1),
					field("unit", "Unit", "px", 24, 16, 36, 1),
					field("hsize", "Heading", "px", 28, 16, 56, 1),
					field("gap", "Paragraph gap", "units", 1, 0, 3, 0.25),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("dsg-rhythm-grid", "grid", "Show baseline grid", true)),
				readouts([2]string{"heading line", "hline"}, [2]string{"gap", "gapout"}, [2]string{"on grid", "ongrid"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D6

func dsgGridBlock() Block {
	return Block{
		Slug:        "layout-grid",
		Title:       "Layout grid",
		Description: "Columns, gutters and margins, solved: column width = (width − 2·margin − (n − 1)·gutter) / n. Span a card across columns to see its exact width, and copy the CSS grid that reproduces it.",
		Tags:        []string{"columns", "CSS grid", "calculator"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-grid",
				h.Div(h.Class("flex flex-col gap-3 p-1"),
					h.Div(h.Class("overflow-hidden rounded-md border bg-background"),
						h.Svg(h.Data("dsg-cols", ""), h.ViewBox("0 0 640 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Column grid"))),
					h.Div(h.Class("relative rounded-lg border bg-code"),
						h.Pre(h.Data("dsg-css", ""), h.Class("code scroll-thin overflow-x-auto px-4 py-3 pr-12")),
						h.Div(h.Data("dsg-copy-wrap", ""), h.Class("absolute top-2 right-2"), copyButton("", "")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Grid"),
					field("width", "Width", "px", 1200, 320, 1920, 10),
					field("cols", "Columns", "", 12, 1, 24, 1),
					field("gutter", "Gutter", "px", 24, 0, 64, 1),
					field("margin", "Margin", "px", 48, 0, 160, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Card"),
					field("start", "Starts at", "col", 2, 1, 24, 1),
					field("span", "Spans", "cols", 6, 1, 24, 1),
				),
				readouts([2]string{"column", "col"}, [2]string{"card width", "card"}, [2]string{"content", "content"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D7

func dsgCompositionBlock() Block {
	return Block{
		Slug:        "composition",
		Title:       "Thirds and golden sections",
		Description: "Two composition guides over the same scene: the rule of thirds and the golden section (lines at 0.382 and 0.618, with a golden spiral). Drag the subject and the horizon to see which lines they sit on.",
		Tags:        []string{"composition", "golden ratio", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-compose",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("dsg-scene", ""), h.ViewBox("0 0 600 371"), h.Class("block w-full touch-none select-none rounded-md border"),
						h.Role("img"), h.Aria("label", "A scene with a draggable sun and horizon")),
					h.P(h.Class("text-xs text-muted-foreground"), "Drag the sun or the horizon; arrow keys move the focused one."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Overlay"),
					segs("Overlay", [2]string{"thirds", "Thirds"}, [2]string{"golden", "Golden"}, [2]string{"both", "Both"}, [2]string{"none", "None"}),
				),
				readouts([2]string{"sun", "sun"}, [2]string{"horizon", "horizon"}, [2]string{"nearest", "near"}),
				dsgNote("The golden ratio φ = 1.618… is real mathematics, but claims that it governs beauty (the Parthenon, the Mona Lisa, faces) don't survive measurement, and experiments on preferred rectangles have not found a consistent pull toward φ. Treat both overlays as starting points for balance, not laws."),
			)
		},
	}
}

// ---------------------------------------------------------------- D8

func dsgPerspectiveBlock() Block {
	return Block{
		Slug:        "perspective",
		Title:       "Perspective construction",
		Description: "One- and two-point linear perspective: every receding edge of a box points at a vanishing point on the horizon. Drag the horizon, the vanishing points and the box's near corner, and the construction lines redraw.",
		Tags:        []string{"drawing", "vanishing points", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-persp",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("dsg-canvas", ""), h.ViewBox("0 0 640 400"), h.Class("block w-full touch-none select-none rounded-md border bg-background"),
						h.Role("img"), h.Aria("label", "Perspective construction of a box")),
					h.P(h.Class("text-xs text-muted-foreground"), "Drag the round handles; Tab to one and use the arrow keys."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mode"),
					segs("Perspective", [2]string{"two", "Two-point"}, [2]string{"one", "One-point"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Box"),
					field("bw", "Width", "", 0.45, 0.1, 0.9, 0.01),
					field("bd", "Depth", "", 0.35, 0.1, 0.9, 0.01),
					field("bh", "Height", "px", 120, 30, 220, 1),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("dsg-persp-lines", "lines", "Construction lines", true)),
				dsgNote("Width and depth are the fraction of the way from the near corner to each vanishing point, so equal values are not equal lengths: that foreshortening is the point."),
			)
		},
	}
}

// ---------------------------------------------------------------- D9

func dsgGestaltBlock() Block {
	card := func(key, title, body string) h.Node {
		return h.Div(h.Data("dsg-gestalt-card", key), h.Class("flex flex-col gap-3 rounded-lg border bg-background p-4"),
			h.Div(h.Class("flex items-center justify-between gap-2"),
				h.Span(h.Class("text-sm font-medium"), title),
				button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("action", "flip"), h.Aria("pressed", "false"), "Change")),
			h.Svg(h.Data("dsg-g", key), h.ViewBox("0 0 240 140"), h.Class("block w-full"), h.Role("img"), h.Aria("label", title+" example")),
			h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), body),
		)
	}
	return Block{
		Slug:        "gestalt",
		Title:       "Gestalt principles",
		Description: "How we group what we see, after Wertheimer (1923) and the Berlin school: five principles, each with a live example. Press Change to break or reinforce the grouping and watch your reading of the picture switch.",
		Tags:        []string{"perception", "grouping", "cards"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 sm:grid-cols-2 lg:grid-cols-3"), h.Data("dsg-gestalt", ""),
				card("proximity", "Proximity", "Things close together read as a group. Change the spacing and the same 24 dots become rows or columns."),
				card("similarity", "Similarity", "Things that look alike group together: colour can override position."),
				card("closure", "Closure", "We complete shapes from fragments; with wider gaps the circle falls apart into arcs."),
				card("continuity", "Continuity", "The eye follows the smoothest path: two crossing curves, not two bent corners."),
				card("figure-ground", "Figure and ground", "One region reads as an object, the other as background; swap the fills and the reading swaps too."),
				h.Div(h.Class("flex flex-col justify-center gap-2 rounded-lg border border-dashed p-4 text-xs leading-relaxed text-muted-foreground"),
					h.Span(h.Class("font-medium text-foreground"), "Using them"),
					"Group related controls by proximity before borders; give actions of one kind one look; leave gaps where meaning changes.",
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D10

var dsgEasings = [][5]string{
	{"ease-out", "Strong ease-out (theme)", "0.23", "1", "0.32"},
	{"ease-in-out", "Strong ease-in-out (theme)", "0.77", "0", "0.175"},
	{"drawer", "Drawer (theme)", "0.32", "0.72", "0"},
	{"ease", "CSS ease", "0.25", "0.1", "0.25"},
	{"ease-in", "CSS ease-in", "0.42", "0", "1"},
}

func dsgEasingBlock() Block {
	return Block{
		Slug:        "easing",
		Title:       "Easing curve editor",
		Description: "A cubic-bezier editor: drag the two handles and the preview replays with that timing. The presets include this site's own curves, after Emil Kowalski: a strong ease-out for things entering and leaving, ease-in-out for things moving, and never ease-in for interface motion.",
		Tags:        []string{"motion", "cubic-bezier", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("dsg-easing",
				h.Div(h.Class("grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Svg(h.Data("dsg-curve", ""), h.ViewBox("-40 -60 320 360"), h.Class("block w-full max-w-[360px] touch-none select-none"),
						h.Role("img"), h.Aria("label", "Cubic bezier timing curve with two draggable handles")),
					h.Div(h.Class("flex flex-col justify-center gap-4"),
						h.Div(h.Class("relative h-14 rounded-lg border bg-background"),
							h.Div(h.Data("dsg-ball", ""), h.Class("absolute top-1/2 left-2 size-8 -translate-y-1/2 rounded-full bg-brand shadow"))),
						h.Div(h.Class("relative h-14 rounded-lg border bg-background"),
							h.Div(h.Data("dsg-box", ""), h.Class("absolute inset-y-2 left-2 w-16 rounded-md border bg-foreground/10"))),
						h.Div(h.Class("relative rounded-lg border bg-code"),
							h.Pre(h.Data("dsg-easing-css", ""), h.Class("code scroll-thin overflow-x-auto px-3 py-2.5 pr-11 text-[12px]")),
							h.Div(h.Class("absolute top-1.5 right-1.5"), copyButton("", ""))),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					h.Div(h.Class("flex flex-col gap-1.5"),
						h.Map(dsgEasings, func(e [5]string) h.Node {
							y2 := "1"
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Class("justify-start font-normal"),
								h.Data("easing", fmt.Sprintf("%s %s %s %s", e[2], e[3], e[4], y2)), e[1])
						})),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					field("dur", "Duration", "ms", 300, 100, 1200, 10),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), hugeicons.PlayIcon(), "Replay"),
				),
				h.Div(h.Data("dsg-easing-warn", ""), h.Class("min-h-4 text-xs text-muted-foreground")),
				badge.Badge(badge.VariantOutline, h.Class("w-fit font-normal"), "Under 300 ms for UI"),
			)
		},
	}
}
