package site

import (
	"fmt"
	"net/http"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/button"
	dropdownmenu "github.com/alexisbcz/components/ui/dropdown-menu"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// Subjects are grouped by area for the header menu and the catalog. A
// collection whose slug is not listed lands in "More", so a new subject
// shows up even before it is filed here.
var areas = []struct {
	name  string
	slugs []string
}{
	{"Mathematics", []string{"linalg", "calculus", "geometry", "probability", "stats", "discrete", "crypto", "logic", "complex", "algebra", "chaos", "optimization", "methods", "numtheory", "topology"}},
	{"Computing", []string{"ml", "algorithms", "arch", "graphics", "networking", "plt", "os", "databases", "infotheory", "qcomputing", "security", "dataviz", "a11y", "games", "llm", "distsys", "toc", "vision", "ledger"}},
	{"Physical sciences", []string{"physics", "quantum", "thermo", "em", "optics", "nuclear", "fluids", "chemistry", "astronomy", "astro"}},
	{"Engineering", []string{"automotive", "rocketry", "materials", "signals", "control", "energy", "aerospace", "civil", "electronics", "audio", "mechanical", "robotics"}},
	{"Earth & life sciences", []string{"geology", "climate", "biology", "genetics", "physiology", "pharmacology", "neuro", "epidemiology", "ecology", "paleo", "food", "sports", "agriculture", "imaging", "hydrology", "ocean", "immuno", "weather", "biochem"}},
	{"Platform", []string{"platform", "assess"}},
	{"Thinking & writing tools", []string{"argumentation", "languages", "novel", "learning", "media"}},
	{"Society & humanities", []string{"history", "sociology", "economics", "geography", "psychology", "philosophy", "linguistics", "music", "finance", "politics", "design", "film", "archaeology", "transport", "behavioral", "law", "business"}},
}

type areaGroup struct {
	name        string
	collections []Collection
}

func groupedCollections() []areaGroup {
	bySlug := map[string]Collection{}
	for _, c := range Collections() {
		bySlug[c.Slug] = c
	}
	var out []areaGroup
	filed := map[string]bool{}
	for _, a := range areas {
		g := areaGroup{name: a.name}
		for _, s := range a.slugs {
			if c, ok := bySlug[s]; ok {
				g.collections = append(g.collections, c)
				filed[s] = true
			}
		}
		if len(g.collections) > 0 {
			out = append(out, g)
		}
	}
	more := areaGroup{name: "More"}
	for _, c := range Collections() {
		if !filed[c.Slug] {
			more.collections = append(more.collections, c)
		}
	}
	if len(more.collections) > 0 {
		out = append(out, more)
	}
	return out
}

// subjectsMenu is the header's subject switcher: one submenu per area.
func subjectsMenu(current string, currentName string) h.Node {
	return dropdownmenu.DropdownMenu(
		dropdownmenu.Trigger(lib.AsChild, button.Button(button.VariantOutline, button.SizeSm, h.Class("max-w-[55vw] min-w-0 gap-1.5 sm:max-w-none"),
			h.Span(h.Class("truncate"), currentName),
			hugeicons.ArrowDown01Icon(h.Class("text-muted-foreground")),
		)),
		dropdownmenu.Content(dropdownmenu.AlignStart, h.Class("w-60"),
			dropdownmenu.Item(lib.AsChild, h.A(h.Href("/subjects"), hugeicons.GridViewIcon(), "All subjects")),
			dropdownmenu.Separator(),
			h.Map(groupedCollections(), func(g areaGroup) h.Node {
				return dropdownmenu.Sub(
					dropdownmenu.SubTrigger(g.name),
					dropdownmenu.Portal(dropdownmenu.SubContent(h.Class("w-56"),
						h.Map(g.collections, func(c Collection) h.Node {
							return dropdownmenu.Item(lib.AsChild,
								h.A(h.Href(c.Path), h.If(c.Slug == current, h.Aria("current", "page")),
									h.Class("aria-[current=page]:font-medium aria-[current=page]:text-brand"),
									c.Name))
						}),
					)),
				)
			}),
		),
	)
}

// catalog is the /subjects page: every subject, grouped by area.
func catalog(r *http.Request) h.Node {
	total := 0
	for _, c := range Collections() {
		total += len(c.Blocks())
	}
	return pageShell(r, "", "Subjects", "Every subject of the interactive course platform, grouped by area.",
		siteHeader("", "All subjects", 0),
		h.Main(h.Class("mx-auto flex w-full max-w-[1400px] flex-col gap-14 px-4 py-10 sm:px-6 lg:px-8 lg:py-14"),
			h.Section(h.Class("flex max-w-2xl flex-col gap-4"),
				h.P(h.Class("font-mono text-xs tracking-wider text-muted-foreground uppercase"), "Platform rework · catalog"),
				h.H1(h.Class("text-3xl font-semibold tracking-tight text-balance sm:text-4xl"), "Every subject, built from the same blocks"),
				h.P(h.Class("text-base leading-relaxed text-pretty text-muted-foreground"),
					fmt.Sprintf("%d subjects and %d interactive blocks, each one a Go function rendered on the server, with live models where the subject has them.", len(Collections()), total)),
			),
			h.Map(groupedCollections(), func(g areaGroup) h.Node {
				return h.Section(h.Class("flex flex-col gap-4"),
					h.H2(h.Class("font-mono text-xs tracking-wider text-muted-foreground uppercase"), g.name),
					h.Div(h.Class("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"),
						h.Map(g.collections, func(c Collection) h.Node {
							blocks := c.Blocks()
							return h.A(h.Href(c.Path),
								h.Class("group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
								h.Div(h.Class("flex items-center justify-between gap-2"),
									h.Span(h.Class("font-medium tracking-tight"), c.Name),
									h.Span(h.Class("font-mono text-[11px] text-muted-foreground tabular-nums"), fmt.Sprintf("%d blocks", len(blocks))),
								),
								h.Ul(h.Class("flex flex-wrap gap-1"),
									h.Map(blocks[:min(4, len(blocks))], func(b Block) h.Node {
										return h.Li(h.Class("rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"), b.Title)
									}),
									h.If(len(blocks) > 4, h.Li(h.Class("px-1 py-0.5 text-[11px] text-muted-foreground"), fmt.Sprintf("+%d", len(blocks)-4))),
								),
								h.Span(h.Class("mt-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 group-hover:text-foreground"),
									"Open", hugeicons.ArrowRight01Icon(h.Class("size-3.5"))),
							)
						}),
					),
				)
			}),
			siteFooter(),
		),
	)
}
