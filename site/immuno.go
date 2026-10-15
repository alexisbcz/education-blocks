package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ImmunoBlocks lists the immunology gallery in display order. Textbook
// facts follow Janeway's Immunobiology (Murphy & Weaver, 9th ed.) and
// Abbas, Lichtman & Pillai (Cellular and Molecular Immunology); every
// curve that is a teaching model says so on the block.
func ImmunoBlocks() []Block {
	return []Block{
		immunoResponseBlock(),
		immunoClonalBlock(),
		immunoVDJBlock(),
		immunoAntibodyBlock(),
		immunoMHCBlock(),
		immunoComplementBlock(),
		immunoELISABlock(),
		immunoFlowBlock(),
		immunoBloodBlock(),
		immunoTiterBlock(),
	}
}

func immunoNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

func immunoBtn(action string, children ...any) h.Node {
	return button.Button(append([]any{button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action)}, children...)...)
}

func immunoPlay(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func immunoSvg(attr, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", attr), h.ViewBox(viewBox), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// ---------------------------------------------------------------- I1

func immunoResponseBlock() Block {
	return Block{
		Slug:        "immune-response",
		Title:       "Primary and secondary responses",
		Description: "Innate defences start within hours. The first antibody response takes about a week, starting with IgM, then IgG. When the same antigen comes back, memory cells answer faster, with more antibody, mostly IgG. A new antigen gets another slow first response.",
		Tags:        []string{"memory", "IgM → IgG", "log scale"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-response",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "innate activity"),
						legendSwatch("var(--vec-out)", "IgM"),
						legendSwatch("var(--brand)", "IgG"),
					),
					immunoSvg("", "0 0 640 280", "Antibody levels over time after two exposures"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Second exposure"),
					segs("Second antigen", [2]string{"same", "Same antigen"}, [2]string{"new", "New antigen"}),
					field("second", "Day", "d", 60, 25, 110, 1),
				),
				readouts([2]string{"1st IgG peak", "p1"}, [2]string{"2nd IgG peak", "p2"}, [2]string{"peak ratio", "ratio"}, [2]string{"lag to IgG", "lag"}),
				immunoNote("Illustrative curves with typical timings (Janeway, ch. 11), not data. Real responses vary with the antigen, the dose, adjuvants and the person; the y axis is a log scale of relative antibody level."),
			)
		},
	}
}

// ---------------------------------------------------------------- I2

func immunoClonalBlock() Block {
	return Block{
		Slug:        "clonal-selection",
		Title:       "Clonal selection and affinity maturation",
		Description: "500 B cells, each with a random 24-bit receptor. The antigen picks the best binders. They divide, and their copies mutate (somatic hypermutation). Round after round the population's affinity climbs. This is the bit-string model of Farmer, Packard and Perelson (1986).",
		Tags:        []string{"selection", "hypermutation", "histogram"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-clonal",
				h.Div(h.Class("flex flex-col gap-2"),
					immunoSvg("bits", "0 0 640 92", "Antigen and the best receptor, bit by bit"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-[3fr_2fr]"),
						immunoSvg("hist", "0 0 380 220", "Histogram of receptor affinities"),
						immunoSvg("trend", "0 0 260 220", "Mean and best affinity per round"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Germinal centre"),
					field("mut", "Mutation rate", "/bit", 0.03, 0, 0.2, 0.005),
					field("keep", "Selected", "%", 10, 2, 50, 1),
				),
				h.Div(h.Class("grid grid-cols-3 gap-2"), immunoPlay("Run"),
					immunoBtn("step", "Round"),
					immunoBtn("reset", hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"round", "round"}, [2]string{"mean affinity", "mean"}, [2]string{"best", "best"}, [2]string{"perfect binders", "perfect"}),
				immunoNote("Affinity is the number of complementary bits (0–24). The parents are kept unchanged, which keeps the best affinity from going down; real germinal centres also select on T-cell help. Set the mutation rate to 0 and selection alone soon stalls. Set it high and mutation wrecks good receptors."),
			)
		},
	}
}

// ---------------------------------------------------------------- I3

func immunoVDJBlock() Block {
	return Block{
		Slug:        "vdj",
		Title:       "V(D)J recombination",
		Description: "A heavy chain gene is cut and pasted from one V, one D and one J segment. The light chains use V and J only. Count the combinations from the segments, then recombine a locus. The random nucleotides added at each joint make far more variety than the segment choice.",
		Tags:        []string{"combinatorics", "RAG1/2", "junctions"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-vdj",
				h.Div(h.Class("flex flex-col gap-2"),
					immunoSvg("locus", "0 0 640 230", "Heavy-chain locus before and after recombination"),
					h.Div(h.Class("scroll-thin overflow-x-auto rounded-md border bg-background px-3 py-2"),
						h.P(h.Class("font-mono text-xs whitespace-pre text-muted-foreground"), h.Data("out", "junction"), "Press Recombine."),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Functional segments"),
					field("hv", "IGH V", "", 40, 1, 80, 1),
					field("hd", "IGH D", "", 23, 1, 40, 1),
					field("hj", "IGH J", "", 6, 1, 10, 1),
					field("kv", "IGκ V", "", 40, 1, 80, 1),
					field("kj", "IGκ J", "", 5, 1, 10, 1),
					field("lv", "IGλ V", "", 30, 1, 80, 1),
					field("lj", "IGλ J", "", 4, 1, 10, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					immunoBtn("recombine", hugeicons.ArrowReloadHorizontalIcon(), "Recombine"),
					immunoBtn("defaults", hugeicons.RefreshIcon(), "Defaults")),
				readouts([2]string{"heavy VDJ", "heavy"}, [2]string{"light VJ", "light"}, [2]string{"H × L pairs", "pairs"}),
				immunoNote("Approximate counts of functional human gene segments (Janeway, Fig. 5.10); people differ. Junctional diversity (trimming, P and N nucleotides) is commonly estimated to raise the total to 10¹¹ or more possible receptors, far more than the number of B cells in one person."),
			)
		},
	}
}

// ---------------------------------------------------------------- I4

type immunoPart struct{ key, title, body string }

var immunoAntibodyParts = []immunoPart{
	{"heavy", "Heavy chains", "Two identical heavy chains, about 50 kDa each: one variable domain (VH) and three or four constant domains. The constant region sets the isotype."},
	{"light", "Light chains", "Two identical light chains, about 25 kDa each, κ or λ: one variable domain (VL) and one constant domain (CL)."},
	{"cdr", "CDRs (hypervariable loops)", "Three loops on each V domain (CDR1–3) form the antigen-binding site. CDR3 spans the V(D)J junction and is the most variable."},
	{"fab", "Fab", "Fragment, antigen-binding: one light chain plus VH and CH1. Papain cuts above the hinge into two Fab and one Fc fragment."},
	{"hinge", "Hinge", "A flexible stretch held by disulfide bonds that lets the two arms swing and reach antigens at different distances."},
	{"fc", "Fc", "Fragment, crystallizable: the CH2 and CH3 domains. It binds Fc receptors on phagocytes and NK cells, binds C1q to start complement, and sets the half-life through FcRn."},
	{"ss", "Disulfide bonds", "Covalent S–S bridges hold each light chain to its heavy chain and the two heavy chains to each other at the hinge."},
}

func immunoAntibodySVG() h.Node {
	on := "transition-[fill,stroke] duration-150 [[data-on]_&]:fill-[color-mix(in_oklab,var(--brand)_35%,var(--code-bg))] [[data-on]_&]:stroke-[var(--brand)]"
	heavy := "fill-[color-mix(in_oklab,var(--vec-u)_22%,var(--code-bg))] stroke-[var(--vec-u)] " + on
	light := "fill-[color-mix(in_oklab,var(--vec-out)_22%,var(--code-bg))] stroke-[var(--vec-out)] " + on
	part := func(key, transform string, children ...any) h.Node {
		attrs := []any{h.Data("part", key), h.TabIndex(0), h.Class("cursor-pointer outline-none")}
		if transform != "" {
			attrs = append(attrs, h.Attr("transform", transform))
		}
		return h.El("g", append(attrs, children...)...)
	}
	dom := func(x, y, w, hh float64, cls string) h.Node {
		return h.El("rect", h.Attr("x", fmt.Sprint(x)), h.Attr("y", fmt.Sprint(y)), h.Attr("width", fmt.Sprint(w)), h.Attr("height", fmt.Sprint(hh)),
			h.Attr("rx", "9"), h.Attr("stroke-width", "1.5"), h.Class(cls))
	}
	label := func(x, y, s, anchor string) h.Node {
		return h.El("text", h.Attr("x", x), h.Attr("y", y), h.Attr("text-anchor", anchor), h.Class("pointer-events-none fill-muted-foreground font-mono text-[10px]"), s)
	}
	ss := func(x1, y1, x2, y2 float64) h.Node {
		return h.El("line", h.Attr("x1", fmt.Sprint(x1)), h.Attr("y1", fmt.Sprint(y1)), h.Attr("x2", fmt.Sprint(x2)), h.Attr("y2", fmt.Sprint(y2)),
			h.Attr("stroke-width", "2.5"), h.Attr("stroke-dasharray", "2 2.5"), h.Class("stroke-[var(--ion-ca)] transition-[stroke] duration-150 [[data-on]_&]:stroke-[var(--brand)]"))
	}
	bracket := func(d string) h.Node {
		return h.El("path", h.Attr("d", d), h.Attr("fill", "none"), h.Attr("stroke-width", "1.25"),
			h.Class("stroke-[color-mix(in_oklab,var(--foreground)_30%,transparent)] transition-[stroke] duration-150 [[data-on]_&]:stroke-[var(--brand)]"))
	}
	// One arm in local coordinates: the hinge at the origin, the arm pointing
	// up, the heavy chain (VH, CH1) on the inner side and the light chain
	// (VL, CL) outside it. The right arm is the mirror image.
	arms := []string{"translate(266 172) rotate(-38)", "translate(294 172) scale(-1 1) rotate(-38)"}
	cdr := func(x float64) string {
		return fmt.Sprintf("M%g -118 q3.5 -8 7 0 q3.5 -8 7 0 q3.5 -8 7 0", x)
	}
	var arm []any
	for _, t := range arms {
		arm = append(arm,
			part("heavy", t, dom(2, -64, 26, 48, heavy), dom(2, -116, 26, 48, heavy),
				h.El("path", h.Attr("d", "M15 -16 L4 0"), h.Attr("fill", "none"), h.Attr("stroke-width", "3"), h.Class("stroke-[var(--vec-u)] [[data-on]_&]:stroke-[var(--brand)]"))),
			part("light", t, dom(-28, -64, 26, 48, light), dom(-28, -116, 26, 48, light)),
			part("ss", t, ss(-6, -24, 6, -24)),
			part("cdr", t, h.El("path", h.Attr("d", cdr(-25)+" "+cdr(4)), h.Attr("fill", "none"), h.Attr("stroke-width", "2"), h.Attr("stroke-linecap", "round"),
				h.Class("stroke-[var(--vec-i)] transition-[stroke] duration-150 [[data-on]_&]:stroke-[var(--brand)]"))),
			part("fab", t, bracket("M-38 -118 h-6 v104 h6")),
		)
	}
	return h.Svg(h.ViewBox("0 0 560 340"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "IgG antibody: two heavy and two light chains"),
		h.Group(arm...),
		part("hinge", "", h.El("rect", h.Attr("x", "258"), h.Attr("y", "166"), h.Attr("width", "44"), h.Attr("height", "28"), h.Attr("rx", "5"), h.Attr("fill", "none"), h.Attr("stroke-width", "1.25"), h.Attr("stroke-dasharray", "3 3"),
			h.Class("stroke-[color-mix(in_oklab,var(--foreground)_40%,transparent)] [[data-on]_&]:stroke-[var(--brand)]"))),
		part("heavy", "",
			h.El("path", h.Attr("d", "M266 172 L266 198 M294 172 L294 198"), h.Attr("fill", "none"), h.Attr("stroke-width", "3"), h.Class("stroke-[var(--vec-u)] [[data-on]_&]:stroke-[var(--brand)]")),
			dom(252, 198, 26, 46, heavy), dom(282, 198, 26, 46, heavy),
			dom(252, 248, 26, 46, heavy), dom(282, 248, 26, 46, heavy)),
		part("ss", "", ss(266, 180, 294, 180), ss(266, 188, 294, 188)),
		part("fc", "", bracket("M242 198 h-6 v96 h6")),
		label("228", "250", "Fc", "end"),
		label("146", "176", "Fab", "end"),
		label("414", "176", "Fab", "start"),
		label("320", "226", "CH2", "start"), label("320", "276", "CH3", "start"),
		label("280", "326", "hover or tab through the parts", "middle"),
	)
}

func immunoAntibodyBlock() Block {
	return Block{
		Slug:        "antibody",
		Title:       "Antibody structure and isotypes",
		Description: "An IgG molecule is a Y of two heavy and two light chains. Point at a part to see what it does. Then switch isotype: the same antigen-binding site can sit on five different constant regions, with different shapes, levels, lifetimes and jobs.",
		Tags:        []string{"Fab/Fc", "CDRs", "isotypes"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-antibody",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative"),
						immunoAntibodySVG(),
						h.Svg(h.Data("plot", "multimer"), h.ViewBox("0 0 120 90"), h.Class("absolute top-1 right-1 w-24 sm:w-32"), h.Role("img"), h.Aria("label", "Assembly of the selected isotype")),
					),
					h.Div(h.Class("min-h-20 rounded-md border bg-background p-3 text-sm"), h.Aria("live", "polite"),
						h.P(h.Class("font-medium"), h.Data("out", "part-title"), "Point at a part"),
						h.P(h.Class("text-[13px] leading-relaxed text-muted-foreground"), h.Data("out", "part-body"), "Hover, tap or tab through the molecule."),
					),
					h.Ul(h.Hidden(), h.Map(immunoAntibodyParts, func(p immunoPart) h.Node {
						return h.Li(h.Data("desc", p.key), h.Data("title", p.title), p.body)
					})),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Isotype"),
					segs("Isotype", [2]string{"IgG", "IgG"}, [2]string{"IgA", "IgA"}, [2]string{"IgM", "IgM"}, [2]string{"IgE", "IgE"}, [2]string{"IgD", "IgD"}),
				),
				readouts([2]string{"form in blood", "form"}, [2]string{"serum level", "level"}, [2]string{"half-life", "half"}, [2]string{"crosses placenta", "placenta"}, [2]string{"main jobs", "jobs"}),
				immunoNote("Typical adult serum values for the main subclass (Janeway, Fig. 5.19); IgA is a dimer in secretions such as milk, saliva and mucus. Levels vary between people and with age."),
			)
		},
	}
}

// ---------------------------------------------------------------- I5

type immunoStep struct{ title, body string }

var immunoMHCSteps = map[string][]immunoStep{
	"i": {
		{"Protein made in the cytosol", "A virus makes its proteins inside the cell. Some are tagged with ubiquitin and cut into peptides by the proteasome."},
		{"Pumped into the ER by TAP", "The TAP1/TAP2 transporter moves peptides from the cytosol into the endoplasmic reticulum."},
		{"Loaded onto MHC class I", "In the peptide-loading complex (tapasin, calreticulin, ERp57), MHC I heavy chain and β2-microglobulin bind a peptide of 8–10 amino acids."},
		{"To the surface", "The stable peptide:MHC I complex travels through the Golgi to the plasma membrane. Almost every nucleated cell does this."},
		{"Seen by a CD8 T cell", "A cytotoxic T cell's receptor recognises the foreign peptide; CD8 binds MHC I's α3 domain. The T cell kills the infected cell."},
	},
	"ii": {
		{"Antigen taken up", "A dendritic cell, macrophage or B cell engulfs extracellular material (a bacterium, a toxin) into an endosome."},
		{"Cut in acidic endosomes", "The endosome acidifies and proteases such as cathepsins break the protein into peptides."},
		{"MHC II arrives, groove blocked", "MHC class II leaves the ER with the invariant chain sitting in its groove. In the endosome the invariant chain is cut down to a small fragment, CLIP."},
		{"HLA-DM swaps CLIP for peptide", "HLA-DM helps release CLIP so that a longer antigen peptide (about 13–25 amino acids) can bind."},
		{"Seen by a CD4 T cell", "Peptide:MHC II reaches the surface; a helper T cell's receptor recognises it and CD4 binds the β2 domain. The T cell then helps B cells and macrophages."},
	},
}

func immunoMHCSVG() h.Node {
	// Each part lists the steps it belongs to ("i0 ii3"…); the module lights
	// the parts of the current step.
	part := func(steps string, children ...any) h.Node {
		return h.El("g", append([]any{h.Data("s", steps), h.Class("opacity-35 transition-opacity duration-200 data-[on]:opacity-100")}, children...)...)
	}
	ink := "stroke-[color-mix(in_oklab,var(--foreground)_45%,transparent)]"
	label := func(x, y, s string) h.Node {
		return h.El("text", h.Attr("x", x), h.Attr("y", y), h.Class("fill-muted-foreground font-mono text-[10px]"), s)
	}
	circle := func(cx, cy, r float64, cls string) h.Node {
		return h.El("circle", h.Attr("cx", fmt.Sprint(cx)), h.Attr("cy", fmt.Sprint(cy)), h.Attr("r", fmt.Sprint(r)), h.Attr("stroke-width", "1.5"), h.Class(cls))
	}
	path := func(d, cls string, extra ...any) h.Node {
		return h.El("path", append([]any{h.Attr("d", d), h.Attr("fill", "none"), h.Attr("stroke-width", "2"), h.Attr("stroke-linecap", "round"), h.Class(cls)}, extra...)...)
	}
	mhc := func(x, y float64, cls string) h.Node {
		// A cup on a stalk, open side out.
		return path(fmt.Sprintf("M%g %g v-16 M%g %g h-6 v-12 M%g %g h6 v-12", x, y, x, y-16, x, y-16), cls)
	}
	return h.Svg(h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Antigen-processing pathways in a cell"),
		// Cell outline, nucleus, ER and Golgi stay drawn.
		h.El("rect", h.Attr("x", "20"), h.Attr("y", "28"), h.Attr("width", "440"), h.Attr("height", "250"), h.Attr("rx", "60"), h.Attr("stroke-width", "1.5"),
			h.Class("fill-[color-mix(in_oklab,var(--foreground)_3%,transparent)] "+ink)),
		circle(110, 200, 42, "fill-[color-mix(in_oklab,var(--foreground)_6%,transparent)] "+ink),
		label("90", "204", "nucleus"),
		part("i1 i2 ii2", path("M170 236 C190 200 170 180 200 160 C230 140 214 116 246 100", "stroke-[var(--vec-u)]", h.Attr("stroke-width", "7"), h.Attr("stroke-opacity", "0.5")),
			label("152", "256", "ER")),
		part("i3", path("M282 210 h40 M286 220 h32 M290 230 h24", "stroke-[var(--vec-v)]", h.Attr("stroke-width", "3")), label("280", "248", "Golgi")),
		// MHC I route.
		part("i0", circle(150, 80, 14, "fill-[color-mix(in_oklab,var(--vec-out)_25%,transparent)] stroke-[var(--vec-out)]"),
			path("M138 74 h24 M138 80 h24 M138 86 h24", "stroke-[var(--vec-out)]", h.Attr("stroke-width", "1.25")), label("100", "58", "proteasome"),
			path("M60 120 q12 -10 24 0 t24 0", "stroke-[var(--code-del)]"), label("40", "140", "viral protein")),
		part("i1", h.El("rect", h.Attr("x", "190"), h.Attr("y", "112"), h.Attr("width", "16"), h.Attr("height", "22"), h.Attr("rx", "3"), h.Attr("stroke-width", "1.5"),
			h.Class("fill-[color-mix(in_oklab,var(--vec-i)_30%,transparent)] stroke-[var(--vec-i)]")), label("166", "106", "TAP")),
		part("i2", mhc(232, 150, "stroke-[var(--brand)]"), h.El("circle", h.Attr("cx", "232"), h.Attr("cy", "128"), h.Attr("r", "3"), h.Class("fill-[var(--code-del)]"))),
		part("i3", path("M240 140 C300 120 360 80 420 60", "stroke-[var(--brand)]", h.Attr("stroke-dasharray", "4 4"))),
		part("i3 i4", mhc(440, 60, "stroke-[var(--brand)]"), h.El("circle", h.Attr("cx", "440"), h.Attr("cy", "38"), h.Attr("r", "3"), h.Class("fill-[var(--code-del)]"))),
		part("i4", circle(560, 70, 40, "fill-[color-mix(in_oklab,var(--vec-v)_14%,transparent)] stroke-[var(--vec-v)]"), label("534", "74", "CD8 T"),
			path("M520 64 h-60", "stroke-[var(--vec-v)]")),
		// MHC II route.
		part("ii0", circle(560, 220, 12, "fill-[color-mix(in_oklab,var(--code-del)_25%,transparent)] stroke-[var(--code-del)]"), label("528", "248", "bacterium"),
			path("M460 220 h80", "stroke-[var(--code-del)]", h.Attr("stroke-dasharray", "3 4"))),
		part("ii0 ii1 ii2 ii3", circle(400, 210, 26, "fill-[color-mix(in_oklab,var(--ion-k)_14%,transparent)] stroke-[var(--ion-k)]"), label("372", "254", "endosome")),
		part("ii1", path("M388 204 l6 6 M400 200 l-4 8 M410 212 l-8 2", "stroke-[var(--code-del)]")),
		part("ii2", path("M246 104 C300 120 340 170 378 200", "stroke-[var(--brand)]", h.Attr("stroke-dasharray", "4 4")), label("300", "170", "MHC II + Ii")),
		part("ii3", mhc(400, 222, "stroke-[var(--brand)]"), label("410", "190", "HLA-DM")),
		part("ii4", mhc(440, 150, "stroke-[var(--brand)]"), h.El("rect", h.Attr("x", "430"), h.Attr("y", "126"), h.Attr("width", "20"), h.Attr("height", "4"), h.Attr("rx", "2"), h.Class("fill-[var(--code-del)]")),
			circle(560, 150, 40, "fill-[color-mix(in_oklab,var(--vec-u)_14%,transparent)] stroke-[var(--vec-u)]"), label("534", "154", "CD4 T"),
			path("M520 146 h-60", "stroke-[var(--vec-u)]")),
	)
}

func immunoStepList(path string, steps []immunoStep, hidden bool) h.Node {
	return h.Ol(h.Data("path", path), h.Class("flex flex-col gap-1"), h.If(hidden, h.Hidden()),
		h.MapIdx(steps, func(i int, s immunoStep) h.Node {
			return h.Li(h.Data("item", fmt.Sprint(i)),
				h.Class("flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 text-sm transition-colors duration-150 data-[on]:border-border data-[on]:bg-background"),
				h.Span(h.Class("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground"), fmt.Sprint(i+1)),
				h.Div(h.Class("flex flex-col gap-0.5"),
					h.Span(h.Class("font-medium"), s.title),
					h.Span(h.Class("hidden text-[13px] leading-relaxed text-muted-foreground [[data-on]_&]:block"), s.body)),
			)
		}),
	)
}

func immunoStepper(attr, label string, picture h.Node, top h.Node, lists ...any) h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:grid-cols-[minmax(0,1fr)_320px]"),
		h.Data(attr, ""), h.TabIndex(0), h.Aria("label", label),
		h.Div(h.Class("flex items-center border-b bg-code p-4 lg:border-r lg:border-b-0"), picture),
		h.Div(h.Class("flex flex-col gap-4 p-5"),
			top,
			h.Group(lists...),
			h.Div(h.Class("mt-auto grid grid-cols-2 gap-2 border-t pt-4"),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
			),
		),
	)
}

func immunoMHCBlock() Block {
	return Block{
		Slug:        "antigen-presentation",
		Title:       "MHC class I and class II presentation",
		Description: "T cells only see antigen as a peptide held by an MHC molecule. Proteins made inside the cell go to MHC class I and are shown to CD8 killer T cells. Material taken in from outside goes to MHC class II and is shown to CD4 helper T cells. Step through both routes.",
		Tags:        []string{"stepper", "TAP", "HLA-DM"},
		Wide:        true,
		Render: func() h.Node {
			return immunoStepper("immuno-mhc", "Antigen presentation stepper; use the arrow keys", immunoMHCSVG(),
				h.Div(h.Class("flex flex-col gap-3"),
					segs("Pathway", [2]string{"i", "MHC class I"}, [2]string{"ii", "MHC class II"}),
					h.Div(h.Class("flex items-center justify-between"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), h.Span(h.Data("out", "count"), "1 / 5")),
					),
				),
				immunoStepList("i", immunoMHCSteps["i"], false),
				immunoStepList("ii", immunoMHCSteps["ii"], true),
			)
		},
	}
}

// ---------------------------------------------------------------- I6

func immunoComplementBlock() Block {
	return Block{
		Slug:        "complement",
		Title:       "The complement cascade",
		Description: "Three ways in, one way out. The classical, lectin and alternative pathways each build a C3 convertase. That enzyme coats the target with C3b, makes C3a and C5a to call in inflammation, and ends in the membrane attack complex. Turn on the host regulators and watch your own cells escape.",
		Tags:        []string{"cascade", "convertases", "regulators"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-complement",
				h.Div(h.Class("flex flex-col gap-2"),
					immunoSvg("", "0 0 640 300", "Complement pathways from triggers to effects"),
					h.Div(h.Class("min-h-16 rounded-md border bg-background p-3 text-[13px] leading-relaxed text-muted-foreground"), h.Aria("live", "polite"), h.Data("out", "explain"), "—"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Trigger"),
					segs("Pathway", [2]string{"classical", "Classical"}, [2]string{"lectin", "Lectin"}, [2]string{"alternative", "Alternative"}),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					toggle("immuno-reg", "reg", "On a host cell (CD55, CD59, factor H)", false),
				),
				h.Div(h.Class("grid grid-cols-3 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Aria("label", "Back"), hugeicons.ArrowLeft01Icon()),
					immunoPlay("Play"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), h.Aria("label", "Next"), hugeicons.ArrowRight01Icon()),
				),
				readouts([2]string{"step", "step"}, [2]string{"C3 convertase", "c3conv"}, [2]string{"C5 convertase", "c5conv"}, [2]string{"outcome", "outcome"}),
				immunoNote("Simplified from Janeway, ch. 2. Older texts write the classical C3 convertase C4b2a; newer ones write C4b2b, because the large C2 fragment was renamed C2b."),
			)
		},
	}
}

// ---------------------------------------------------------------- I7

func immunoELISABlock() Block {
	return Block{
		Slug:        "elisa",
		Title:       "ELISA standard curve",
		Description: "A sandwich ELISA turns a cytokine concentration into a colour, read as optical density (OD). Eight standards in duplicate are fitted with a four-parameter logistic curve. The fit then turns your unknown's OD back into a concentration, but only inside the range the standards cover.",
		Tags:        []string{"4PL fit", "Levenberg–Marquardt", "log axis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-elisa",
				h.Div(h.Class("flex flex-col gap-1"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "standards"),
						legendSwatch("var(--brand)", "4PL fit"),
						legendSwatch("var(--vec-u)", "unknown"),
					),
					immunoSvg("", "0 0 640 300", "Standard curve: OD against concentration", h.Class("cursor-ns-resize")),
					h.Div(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), mathml(mi("y"), mo("="), mi("d"), mo("+"), mfrac(mrow(mi("a"), mo("−"), mi("d")), mrow(mn("1"), mo("+"), msup(mrow(mo("("), mi("x"), mo("/"), mi("c"), mo(")")), mi("b")))))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Plate"),
					field("noise", "Pipetting noise", "% CV", 4, 0, 20, 0.5),
					field("od", "Unknown OD", "", 1.2, 0.02, 3, 0.01),
				),
				h.Div(h.Class("grid grid-cols-1 gap-2"), immunoBtn("plate", hugeicons.TestTube01Icon(), "New plate")),
				readouts([2]string{"a (bottom)", "a"}, [2]string{"b (slope)", "b"}, [2]string{"c (EC50)", "c"}, [2]string{"d (top)", "d"}, [2]string{"R²", "r2"}, [2]string{"unknown", "conc"}),
				immunoNote("Synthetic plate: the true curve is a = 0.05, b = 1.2, c = 40 pg/mL, d = 2.6, with 3-fold dilutions from 1000 pg/mL. Drag on the plot to set the unknown's OD. With 0% noise the fit recovers those values."),
			)
		},
	}
}

// ---------------------------------------------------------------- I8

func immunoFlowBlock() Block {
	return Block{
		Slug:        "flow-gating",
		Title:       "Flow cytometry gating",
		Description: "Each dot is one lymphocyte measured for two markers, CD4 and CD8, on log axes. Drag a rectangle to gate a population and read its share of the parent gate. Or switch to quadrants and move the crosshair to read the CD4:CD8 ratio.",
		Tags:        []string{"gating", "log scale", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-flow",
				h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[460px]"),
					h.Canvas(h.Data("plot", ""), h.Class("absolute inset-0 size-full touch-none cursor-crosshair select-none"), h.Role("img"), h.Aria("label", "CD4 against CD8 dot plot")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Gate"),
					segs("Gate type", [2]string{"rect", "Rectangle"}, [2]string{"quad", "Quadrants"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					immunoBtn("cd4", "Gate CD4⁺"),
					immunoBtn("sample", hugeicons.RefreshIcon(), "New sample")),
				readouts([2]string{"events", "events"}, [2]string{"in gate", "in"}, [2]string{"% of parent", "pct"}, [2]string{"CD4 : CD8", "ratio"}),
				immunoNote("Synthetic sample of 6,000 events pre-gated on lymphocytes: CD4⁺ T cells about 45%, CD8⁺ T cells about 22%, double negatives (mostly B and NK cells) about 31%, double positives about 2%. A healthy adult CD4:CD8 ratio is usually between about 1 and 4."),
			)
		},
	}
}

// ---------------------------------------------------------------- I9

var immunoBloodTypes = []string{"O−", "O+", "A−", "A+", "B−", "B+", "AB−", "AB+"}

func immunoBloodBlock() Block {
	cell := "size-7 sm:size-9 rounded-md border text-xs font-mono outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 data-[ok]:bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] data-[ok]:border-[color-mix(in_oklab,var(--brand)_50%,transparent)] data-[sel]:ring-2 data-[sel]:ring-ring/60"
	return Block{
		Slug:        "blood-types",
		Title:       "Blood group compatibility",
		Description: "Your plasma carries antibodies against the ABO antigens your red cells lack. A transfusion is safe when those antibodies find nothing to attack. Compare red cells and plasma: the universal donor of one is the universal recipient of the other. Pick any cell to see why.",
		Tags:        []string{"ABO/Rh", "matrix", "agglutination"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-blood",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Table(h.Class("mx-auto border-separate border-spacing-0.5 sm:border-spacing-1"),
							h.Caption(h.Class("caption-bottom pt-2 font-mono text-[11px] text-muted-foreground"), "rows: donor · columns: recipient"),
							h.Thead(h.Tr(
								h.Th(h.Class("font-mono text-[10px] font-normal text-muted-foreground"), "D \\ R"),
								h.Map(immunoBloodTypes, func(t string) h.Node {
									return h.Th(h.Attr("scope", "col"), h.Class("font-mono text-[11px] font-medium"), t)
								}),
							)),
							h.Tbody(h.MapIdx(immunoBloodTypes, func(d int, dt string) h.Node {
								return h.Tr(
									h.Th(h.Attr("scope", "row"), h.Class("pr-1 text-right font-mono text-[11px] font-medium"), dt),
									h.MapIdx(immunoBloodTypes, func(r int, rt string) h.Node {
										return h.Td(h.Button(h.Type("button"), h.Data("d", fmt.Sprint(d)), h.Data("r", fmt.Sprint(r)), h.Class(cell),
											h.Aria("label", fmt.Sprintf("Donor %s to recipient %s", dt, rt)), "·"))
									}),
								)
							})),
						),
					),
					h.Div(h.Class("min-h-16 rounded-md border bg-background p-3 text-[13px] leading-relaxed text-muted-foreground"), h.Aria("live", "polite"), h.Data("out", "why"), "Pick a cell."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Component"),
					segs("Component", [2]string{"rbc", "Red cells"}, [2]string{"plasma", "Plasma"}),
				),
				readouts([2]string{"universal donor", "donor"}, [2]string{"universal recipient", "recipient"}, [2]string{"compatible pairs", "pairs"}),
				immunoNote("ABO and RhD only; real transfusions also check other antigens and crossmatch every unit. Anti-D is not naturally present: an RhD− person makes it after exposure, which is why Rh− recipients get Rh− red cells. Plasma rules here consider ABO only. Educational, not clinical guidance."),
			)
		},
	}
}

// ---------------------------------------------------------------- I10

func immunoTiterBlock() Block {
	return Block{
		Slug:        "titer",
		Title:       "Serial dilution and antibody titer",
		Description: "A row of wells, each one more dilute than the last. Agglutination spreads as a mat while antibody is still enough. Without it, the cells roll to a tight button. The titer is the reciprocal of the last positive dilution. Compare an acute and a convalescent sample: a fourfold rise is the usual sign of a recent infection.",
		Tags:        []string{"microplate", "titer", "C₁V₁ = C₂V₂"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("immuno-titer",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						immunoSvg("", "0 0 640 230", "Two rows of microplate wells: acute and convalescent sera", h.Class("min-w-[520px]")),
					),
					h.P(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), h.Data("out", "recipe"), "—"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Dilution series"),
					segs("Dilution factor", [2]string{"2", "2-fold"}, [2]string{"3", "3-fold"}, [2]string{"10", "10-fold"}),
					field("start", "First dilution 1:x", "", 10, 1, 100, 1),
					field("vol", "Well volume", "µL", 50, 10, 200, 5),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sera"),
					field("acute", "Acute", "AU", 160, 1, 50000, 1),
					field("conv", "Convalescent", "AU", 1400, 1, 50000, 1),
				),
				readouts([2]string{"acute titer", "t1"}, [2]string{"convalescent", "t2"}, [2]string{"fold rise", "rise"}, [2]string{"reading", "reading"}),
				immunoNote("A well is positive while the diluted antibody is above a fixed detection limit of 1 arbitrary unit (AU). The titer depends on the series you choose, so compare sera tested side by side in the same run."),
			)
		},
	}
}
