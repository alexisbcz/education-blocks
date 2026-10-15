package site

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"slices"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/runtime"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
	"github.com/alexisbcz/libhtml/secure"
)

// themeScript applies the saved theme before first paint. It runs only
// because it carries the request's CSP nonce.
const themeScript = `(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch {}
  if (saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches)) root.classList.add("dark");
})();`

// linalgModules are the linear algebra gallery's modules, which predate
// the one-file-per-subject naming.
var linalgModules = []string{"matrix", "editor", "transform", "dot", "elimination", "exercises", "anatomy-loader", "shell"}

// moduleLoader imports the modules a page needs, each in isolation: a
// module that fails to load or throws only loses its own blocks. A page
// gets chrome.js plus its subject's modules, found by name: <slug>.js and
// <slug>-*.js in static/js (helpers such as plot.js are imported by the
// modules themselves). So a new subject is picked up without touching a
// shared file, and no page downloads another subject's figures.
func moduleLoader(slug string) string {
	entries, _ := fs.ReadDir(static, "static/js")
	paths := []string{"/static/js/chrome.js"}
	want := func(name string) bool {
		base := strings.TrimSuffix(name, ".js")
		if slug == "linalg" {
			return slices.Contains(linalgModules, base)
		}
		return slug != "" && (base == slug || strings.HasPrefix(base, slug+"-"))
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".js") && want(e.Name()) {
			paths = append(paths, "/static/js/"+e.Name())
		}
	}
	list, _ := json.Marshal(paths)
	return "for (const m of " + string(list) + ") import(m).catch((e) => console.error(`module ${m} failed:`, e));"
}

// pageShell is the document every page shares: fonts, styles, the theme
// script, the components' runtime and the block modules.
func pageShell(r *http.Request, slug, title, description string, body ...any) h.Node {
	return h.Doctype(h.Html(h.Lang("en"),
		h.Head(
			h.Meta(h.Charset("utf-8")),
			h.Meta(h.Name("viewport"), h.Content("width=device-width, initial-scale=1")),
			h.Title(title+" · Hypercode"),
			h.Meta(h.Name("description"), h.Content(description)),
			h.Link(h.Rel("preload"), h.Href("/static/fonts/Geist-Variable.woff2"), h.Attr("as", "font"), h.Type("font/woff2"), h.Attr("crossorigin", "")),
			h.Link(h.Rel("preload"), h.Href("/static/fonts/GeistMono-Variable.woff2"), h.Attr("as", "font"), h.Type("font/woff2"), h.Attr("crossorigin", "")),
			h.Link(h.Rel("stylesheet"), h.Href("/static/app.css")),
			h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/iso.css")),
			secure.Script(r, h.UnsafeJS(themeScript)),
			runtime.Scripts(r),
			secure.Script(r, h.Type("module"), h.UnsafeJS(moduleLoader(slug))),
		),
		h.Body(append([]any{h.Class("min-h-svh bg-background font-sans text-foreground antialiased")}, body...)...),
	))
}

func gallery(r *http.Request, c Collection) h.Node {
	blocks := c.Blocks()
	return pageShell(r, c.Slug, c.Name, c.Lede,
		siteHeader(c.Slug, c.Name, len(blocks)),
		h.Div(h.Class("mx-auto flex w-full max-w-[1400px] gap-10 px-4 sm:px-6 lg:px-8"),
			sideNav(blocks),
			h.Main(h.Class("flex min-w-0 flex-1 flex-col gap-20 py-10 lg:py-14"),
				intro(c),
				h.MapIdx(blocks, func(i int, b Block) h.Node { return blockSection(i, b) }),
				siteFooter(),
			),
		),
	)
}

func siteHeader(slug, name string, n int) h.Node {
	return h.Header(h.Class("sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"),
		h.Div(h.Class("mx-auto flex h-14 w-full max-w-[1400px] min-w-0 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8"),
			h.A(h.Href("/"), h.Class("flex items-center gap-2.5 font-medium tracking-tight"),
				logoMark(),
				h.Span(h.Class("hidden sm:inline"), "Hypercode"),
			),
			h.Span(h.Class("hidden text-border select-none sm:inline"), "/"),
			subjectsMenu(slug, name),
			h.Iff(n > 0, func() h.Node {
				return badge.Badge(badge.VariantOutline, h.Class("ml-1 hidden font-mono text-[11px] md:inline-flex"), fmt.Sprintf("%d blocks", n))
			}),
			h.Div(h.Class("flex-1")),
			button.Button(button.VariantOutline, button.SizeIcon, h.Class("size-8"), h.Type("button"),
				h.Data("theme-toggle", ""), h.Aria("label", "Toggle theme"),
				hugeicons.Sun03Icon(h.Class("hidden dark:block")),
				hugeicons.Moon02Icon(h.Class("dark:hidden")),
			),
		),
	)
}

// logoMark is the basis vectors i and j on a unit square: the platform's mark.
func logoMark() h.Node {
	return h.Svg(h.ViewBox("0 0 24 24"), h.Class("size-6"), h.Aria("hidden", "true"),
		h.El("rect", h.Attr("x", "1"), h.Attr("y", "1"), h.Attr("width", "22"), h.Attr("height", "22"), h.Attr("rx", "6"),
			h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.25")),
		h.El("path", h.Attr("d", "M7 17 L17 17"), h.Attr("stroke", "var(--vec-i)"), h.Attr("stroke-width", "2"), h.Attr("stroke-linecap", "round")),
		h.El("path", h.Attr("d", "M7 17 L7 7"), h.Attr("stroke", "var(--vec-j)"), h.Attr("stroke-width", "2"), h.Attr("stroke-linecap", "round")),
		h.El("circle", h.Attr("cx", "7"), h.Attr("cy", "17"), h.Attr("r", "1.6"), h.Attr("fill", "currentColor")),
	)
}

func sideNav(blocks []Block) h.Node {
	return h.Aside(h.Class("sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 overflow-y-auto py-10 lg:block lg:py-14"),
		h.Nav(h.Aria("label", "Blocks"), h.Class("flex flex-col gap-0.5 text-sm"),
			h.P(h.Class("mb-2 px-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Blocks"),
			h.MapIdx(blocks, func(i int, b Block) h.Node {
				return h.A(h.Href("#"+b.Slug), h.Data("nav-link", b.Slug),
					h.Class("group flex items-center gap-3 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent/60 hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"),
					h.Span(h.Class("font-mono text-[11px] text-muted-foreground/60 tabular-nums group-data-[active=true]:text-foreground/70"), fmt.Sprintf("%02d", i+1)),
					h.Span(h.Class("truncate"), b.Title),
				)
			}),
		),
	)
}

func intro(c Collection) h.Node {
	return h.Section(h.Class("flex max-w-2xl flex-col gap-4"),
		h.P(h.Class("font-mono text-xs tracking-wider text-muted-foreground uppercase"), "Platform rework · "+c.Name),
		h.H1(h.Class("text-3xl font-semibold tracking-tight text-balance sm:text-4xl"), c.Title),
		h.P(h.Class("text-base leading-relaxed text-pretty text-muted-foreground"), c.Lede),
		h.Div(h.Class("flex flex-wrap gap-2 pt-1"),
			h.Map([]string{"Server-rendered", "Strict CSP", "Hugeicons", "Geist", "Reduced motion"}, func(s string) h.Node {
				return badge.Badge(badge.VariantOutline, h.Class("font-normal text-muted-foreground"), s)
			}),
		),
	)
}

func blockSection(i int, b Block) h.Node {
	inner := b.Render()
	return h.Section(h.ID(b.Slug), h.Data("block", b.Slug), h.Class("flex scroll-mt-24 flex-col gap-4"),
		h.Div(h.Class("flex flex-col gap-1.5"),
			h.Div(h.Class("flex items-center gap-3"),
				h.Span(h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("%02d", i+1)),
				h.H2(h.Class("text-lg font-semibold tracking-tight"),
					h.A(h.Href("#"+b.Slug), h.Class("hover:underline hover:decoration-border hover:underline-offset-4"), b.Title)),
				h.Div(h.Class("hidden flex-wrap gap-1.5 sm:flex"),
					h.Map(b.Tags, func(t string) h.Node {
						return h.Span(h.Class("rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"), t)
					}),
				),
			),
			h.P(h.Class("max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground"), b.Description),
		),
		h.Div(h.Class("preview relative overflow-hidden rounded-xl border bg-card"),
			h.Div(h.Class(h.Ternary(b.Wide,
				"relative p-3 sm:p-6",
				"relative flex min-h-48 items-center justify-center p-4 sm:p-10")),
				h.Div(h.Class(h.Ternary(b.Wide, "w-full", "w-full max-w-2xl")), inner),
			),
		),
	)
}

func siteFooter() h.Node {
	return h.Footer(h.Class("flex flex-col gap-1 border-t pt-8 pb-4 text-xs text-muted-foreground"),
		h.P("Built with libhtml, components, icons and tailwind from github.com/alexisbcz."),
		h.P("Icons: Hugeicons (free set, MIT). Fonts: Geist and Geist Mono (OFL)."),
	)
}
