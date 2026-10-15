package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/textarea"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// MediaBlocks lists the media literacy tools in display order. Every
// example is synthetic: the outlets, accounts, people and domains are made
// up (most live under the reserved .example top-level domain, RFC 2606).
// Argument structure, evidence grading and Bayesian updating live in
// /argumentation; study design in /methods; statistics in /stats.
func MediaBlocks() []Block {
	return []Block{
		mediaSIFTBlock(),
		mediaLateralBlock(),
		mediaURLBlock(),
		mediaHeadlineBlock(),
		mediaRiskBlock(),
		mediaChartBlock(),
		mediaPyramidBlock(),
		mediaSourcingBlock(),
		mediaEXIFBlock(),
		mediaPersuasionBlock(),
	}
}

// mediaInputClass is the shadcn input look, at 16px on phones (no iOS zoom).
const mediaInputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

func mediaInput(name, placeholder, value string, extra ...any) h.Node {
	return h.Input(append([]any{h.Type("text"), h.Data("media-field", name), h.Placeholder(placeholder), h.Value(value),
		h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Class(mediaInputClass)}, extra...)...)
}

func mediaArea(name, placeholder, value string, extra ...any) h.Node {
	return textarea.Textarea(append([]any{h.Data("media-field", name), h.Placeholder(placeholder), h.Class("min-h-24 resize-y bg-background"), value}, extra...)...)
}

func mediaLabel(text, hint string) h.Node {
	return h.Div(h.Class("flex items-baseline justify-between gap-2"),
		h.Span(h.Class("text-sm font-medium"), text),
		h.If(hint != "", h.Span(h.Class("text-xs text-muted-foreground"), hint)),
	)
}

func mediaCard(children ...any) *h.Element {
	return h.Div(append([]any{h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5")}, children...)...)
}

// mediaCopy is a copy button whose text the module keeps up to date (the
// page's copy handler reads data-copy at click time).
func mediaCopy(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("copy", ""), h.Data("media-copy", ""),
		h.Class("relative"),
		hugeicons.Copy01Icon(h.Class("transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-50 [[data-copied]_&]:opacity-0")),
		hugeicons.Tick02Icon(h.Class("absolute left-2.5 scale-50 opacity-0 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-100 [[data-copied]_&]:opacity-100")),
		label)
}

func mediaPreset(attr, value, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data(attr, value), label)
}

func mediaNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// ---------------------------------------------------------------- 1

func mediaSIFTBlock() Block {
	return Block{
		Slug:        "sift",
		Title:       "SIFT, step by step",
		Description: "Mike Caulfield's four moves for a claim you meet online: Stop, Investigate the source, Find better coverage, Trace claims to their origin. Walk a synthetic viral post through them; each move reveals what a quick check would turn up.",
		Tags:        []string{"SIFT", "stepper", "synthetic"},
		Wide:        true,
		Render: func() h.Node {
			steps := [][2]string{{"S", "Stop"}, {"I", "Investigate the source"}, {"F", "Find better coverage"}, {"T", "Trace the claim"}}
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"), h.Data("media-sift", ""), h.TabIndex(0),
				h.Aria("label", "SIFT stepper. Left and right arrow keys move between steps."),
				// The synthetic post.
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("The post"),
					h.Article(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-xs"),
						h.Div(h.Class("flex items-center gap-3"),
							h.Span(h.Class("flex size-9 items-center justify-center rounded-full bg-muted font-mono text-xs"), "RW"),
							h.Div(h.Class("flex min-w-0 flex-col"),
								h.Span(h.Class("truncate text-sm font-medium"), "Riverton Watch"),
								h.Span(h.Class("truncate font-mono text-xs text-muted-foreground"), "@rivertonwatch · social.example"),
							),
						),
						h.P(h.Class("text-[15px] leading-relaxed"),
							"🚨 NEW STUDY: 1 in 3 teens in Riverton now skip breakfast every day. Our schools are failing our kids. Share before they bury this!"),
						h.Div(h.Class("flex flex-wrap gap-3 font-mono text-xs text-muted-foreground"),
							h.Span("48.2k shares"), h.Span("·"), h.Span("2 h ago"), h.Span("·"), h.Span("link: survey-results.example/riverton"),
						),
						h.Div(h.Data("media-sift-stamp", ""), h.Hidden(),
							h.Class("enter flex items-center gap-2 rounded-md border border-dashed border-brand/50 bg-brand/8 px-3 py-2 text-sm"),
							hugeicons.Alert02Icon(h.Class("size-4 shrink-0 text-brand")),
							h.Span(h.Data("media-sift-verdict", ""))),
					),
					mediaNote("Every account, site and figure here is invented for practice."),
				),
				// The stepper.
				h.Div(h.Class("flex min-w-0 flex-col gap-4"),
					h.Ol(h.Class("grid grid-cols-4 gap-1.5"), h.Aria("label", "SIFT moves"),
						h.MapIdx(steps, func(i int, s [2]string) h.Node {
							return h.Li(h.Button(h.Type("button"), h.Data("media-sift-go", string(rune('0'+i))),
								h.Class("flex w-full flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/8 data-[done]:border-foreground/30"),
								h.If(i == 0, h.Data("on", "")),
								h.Span(h.Class("font-mono text-lg leading-none font-semibold"), s[0]),
								h.Span(h.Class("hidden text-[11px] text-muted-foreground sm:block"), s[1]),
							))
						}),
					),
					h.Div(h.Data("media-sift-panel", ""), h.Aria("live", "polite"), h.Class("flex min-h-64 flex-col gap-3 rounded-xl border bg-code p-4")),
					h.Div(h.Class("flex items-center justify-between gap-3"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("media-sift-step", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
						h.Span(h.Data("media-sift-count", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "1 / 4"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("media-sift-step", "1"), "Next", hugeicons.ArrowRight01Icon()),
					),
					mediaNote("SIFT: Mike Caulfield (2019), building on lateral reading research by Wineburg and McGrew at the Stanford History Education Group."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func mediaLateralBlock() Block {
	return Block{
		Slug:        "lateral-reading",
		Title:       "Lateral vs vertical reading",
		Description: "Fact-checkers leave a site to learn about it; most of us scroll down and judge it by its own pages. Investigate a polished, fictional research centre both ways and watch your confidence move.",
		Tags:        []string{"lateral reading", "simulation", "synthetic"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("media-lateral", ""),
				h.Div(h.Class("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-xs"),
					// A fake browser bar.
					h.Div(h.Class("flex items-center gap-2 border-b bg-code-panel px-3 py-2"),
						h.Span(h.Class("flex gap-1"), h.Span(h.Class("size-2.5 rounded-full bg-foreground/15")), h.Span(h.Class("size-2.5 rounded-full bg-foreground/15")), h.Span(h.Class("size-2.5 rounded-full bg-foreground/15"))),
						h.Span(h.Data("media-lat-url", ""), h.Class("min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1 font-mono text-xs text-muted-foreground"), "https://cbnr.example/"),
					),
					h.Div(h.Class("flex items-center justify-between gap-3 border-b px-3 py-2"),
						segs("Reading strategy", [2]string{"vertical", "Read the site itself"}, [2]string{"lateral", "Open new tabs"}),
					),
					h.Div(h.Data("media-lat-list", ""), h.Class("grid gap-2 p-3 sm:grid-cols-2")),
					h.Div(h.Data("media-lat-detail", ""), h.Aria("live", "polite"), h.Class("min-h-28 border-t bg-code p-4 text-sm leading-relaxed")),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					panelLabel("How much do you trust cbnr.example?"),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Div(h.Class("relative h-2 overflow-hidden rounded-full bg-foreground/10"),
							h.Div(h.Data("media-lat-bar", ""), h.Class("absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"), h.Style("width:50%"))),
						h.Div(h.Class("flex justify-between font-mono text-[11px] text-muted-foreground"), h.Span("distrust"), h.Span("trust")),
					),
					readouts([2]string{"pages read", "read"}, [2]string{"what you know", "know"}),
					h.P(h.Data("media-lat-take", ""), h.Class("text-sm leading-relaxed text-pretty")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("media-lat-reset", ""), hugeicons.RefreshIcon(), "Start over"),
					mediaNote("After Wineburg & McGrew, “Lateral Reading: Reading Less and Learning More When Evaluating Digital Information” (Stanford History Education Group working paper, 2017). The centre, sites and funder are fictional."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func mediaURLBlock() Block {
	return Block{
		Slug:        "url-inspector",
		Title:       "URL inspector",
		Description: "Who really owns a link? The browser's own URL parser splits it into parts; the registrable domain (the name someone actually bought) is what matters, not the brand name a scammer can put in a subdomain or a path.",
		Tags:        []string{"WHATWG URL", "domains", "phishing"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("media-url", ""),
				h.Div(h.Class("flex flex-col gap-2"),
					mediaLabel("Paste a link", "nothing is fetched"),
					mediaInput("url", "https://…", "https://northbank.com.account-verify.example/login?session=81", h.Aria("label", "URL to inspect"), h.Class("font-mono")),
					h.Div(h.Class("flex flex-wrap gap-2"),
						mediaPreset("media-url-preset", "https://www.northbank.com/accounts", "Genuine"),
						mediaPreset("media-url-preset", "https://northbank.com.account-verify.example/login?session=81", "Brand in subdomain"),
						mediaPreset("media-url-preset", "https://www.n0rthbank.com/login", "Look-alike spelling"),
						mediaPreset("media-url-preset", "https://www.northbаnk.com/", "Cyrillic а"),
						mediaPreset("media-url-preset", "http://northbank.com@198.51.100.7/secure", "User-info trick"),
						mediaPreset("media-url-preset", "https://news.rivertoncourier.co.uk.example/story", "Suffix in the middle"),
					),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3 rounded-xl border bg-code p-4"),
						h.Div(h.Data("media-url-bar", ""), h.Class("font-mono text-sm break-all")),
						h.Dl(h.Data("media-url-parts", ""), h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs")),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						panelLabel("Flags"),
						h.Ul(h.Data("media-url-flags", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-2")),
					),
				),
				mediaNote("The registrable domain needs the Public Suffix List (publicsuffix.org) to be exact: “co.uk” is a suffix, “rivertoncourier.co.uk” would be registrable. This block embeds only a small subset of it, so treat unusual suffixes with care. Brand names here are fictional; .example is reserved and never resolves."),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func mediaHeadlineBlock() Block {
	return Block{
		Slug:        "headline-check",
		Title:       "Headline vs body",
		Description: "Headlines are written last and in a hurry. Check whether the headline's numbers and claims appear in the article, how much the body hedges, and how many sources it names.",
		Tags:        []string{"headlines", "hedges", "heuristic"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("media-headline", ""),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						mediaPreset("media-hl-preset", "0", "Overstated"),
						mediaPreset("media-hl-preset", "1", "Faithful"),
						mediaPreset("media-hl-preset", "2", "Number drift"),
					),
					mediaLabel("Headline", ""),
					mediaInput("headline", "Headline", "", h.Aria("label", "Headline")),
					mediaLabel("Article body", ""),
					mediaArea("body", "Paste or write the article text", "", h.Aria("label", "Article body"), h.Class("min-h-56")),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("What the check finds"),
					h.Div(h.Data("media-hl-marked", ""), h.Class("max-h-56 overflow-auto rounded-xl border bg-code p-3 text-sm leading-relaxed")),
					h.Ul(h.Data("media-hl-findings", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-2")),
					readouts([2]string{"headline numbers in body", "nums"}, [2]string{"hedges in body", "hedges"}, [2]string{"named sources", "sources"}, [2]string{"certainty gap", "gap"}),
					mediaNote("Word-list heuristics for English: they flag things to look at, they don't judge the story. Presets are invented articles."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func mediaRiskBlock() Block {
	return Block{
		Slug:        "risk-numbers",
		Title:       "“Doubles the risk”",
		Description: "The same finding can be reported as relative or absolute risk. Set a baseline and a relative risk, and see the headline each framing produces, the icon array behind it, and the percent vs percentage-point trap.",
		Tags:        []string{"relative risk", "icon array", "percentage points"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("media-risk",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						h.Div(h.Class("rounded-lg border bg-background p-3"),
							h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Relative framing"),
							h.P(h.Data("media-risk-rel", ""), h.Class("mt-1 text-base leading-snug font-semibold text-balance"))),
						h.Div(h.Class("rounded-lg border bg-background p-3"),
							h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Absolute framing"),
							h.P(h.Data("media-risk-abs", ""), h.Class("mt-1 text-base leading-snug font-semibold text-balance"))),
					),
					h.Svg(h.Data("media-risk-icons", ""), h.ViewBox("0 0 720 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Icon array: one square per person")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "cases without exposure"),
						legendSwatch("var(--brand)", "extra cases with exposure"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("The finding"),
					field("base", "Baseline", "per 10k", 1, 0.1, 5000, 0.1),
					field("rr", "Relative risk", "×", 2, 0.1, 10, 0.05),
				),
				readouts([2]string{"risk without", "r0"}, [2]string{"risk with", "r1"}, [2]string{"difference (points)", "ard"}, [2]string{"relative change", "rel"}, [2]string{"exposed per extra case", "nnh"}),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					panelLabel("Percent or points?"),
					field("from", "From", "%", 40, 0, 100, 0.5),
					field("to", "To", "%", 50, 0, 100, 0.5),
					h.P(h.Data("media-risk-pp", ""), h.Class("text-sm leading-relaxed")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func mediaChartBlock() Block {
	return Block{
		Slug:        "news-chart",
		Title:       "The chart in the story",
		Description: "A synthetic news chart of quarterly ridership. Its axis starts at 49 and its window is two quarters, so a 2% change looks like a landslide. Fix it one switch at a time and watch Tufte's lie factor fall to 1.",
		Tags:        []string{"lie factor", "baseline", "context"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("media-chart",
				h.Div(h.Class("flex flex-col gap-2"),
					h.P(h.Data("media-chart-title", ""), h.Class("px-1 text-base font-semibold text-balance")),
					h.Svg(h.Data("media-chart-plot", ""), h.ViewBox("0 0 520 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "News chart of ridership")),
					h.P(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "Source: Riverton Transit Authority (fictional). Synthetic data."),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("Fixes"),
					toggle("media-chart-zero", "zero", "Start the axis at zero", false),
					toggle("media-chart-window", "window", "Show three years, not two quarters", false),
					toggle("media-chart-calm", "calm", "Neutral headline", false),
				),
				readouts([2]string{"change in data", "data"}, [2]string{"change as drawn", "drawn"}, [2]string{"lie factor", "lie"}),
				mediaNote("Lie factor = size of the effect shown in the graphic ÷ size of the effect in the data (Tufte, The Visual Display of Quantitative Information, 1983). Bars encode value by length, so they need a zero baseline; lines may not."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func mediaPyramidBlock() Block {
	return Block{
		Slug:        "inverted-pyramid",
		Title:       "Inverted pyramid builder",
		Description: "News is written most-important-first, so a reader who stops after one sentence still has the story. Fill in the five Ws and H; the builder assembles a lede, orders the rest, and warns when the lede runs long.",
		Tags:        []string{"lede", "5 Ws", "Markdown"},
		Wide:        true,
		Render: func() h.Node {
			row := func(key, label, ph, val string) h.Node {
				return h.Label(h.Class("grid gap-1.5 sm:grid-cols-[72px_1fr] sm:items-center"),
					h.Span(h.Class("font-mono text-xs text-muted-foreground"), label),
					mediaInput(key, ph, val, h.Aria("label", label)),
				)
			}
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("media-pyramid", ""),
				mediaCard(
					panelLabel("The facts"),
					row("who", "Who", "Who did it?", "The Riverton city council"),
					row("what", "What", "What happened?", "voted 7–2 to make weekend buses free"),
					row("when", "When", "When?", "on Tuesday"),
					row("where", "Where", "Where?", "at its monthly meeting"),
					row("why", "Why", "Why?", "after weekend ridership fell for three years"),
					row("how", "How", "How will it work?", "paid for by a one-year transport grant"),
					h.Label(h.Class("flex flex-col gap-1.5"),
						h.Span(h.Class("font-mono text-xs text-muted-foreground"), "Quote"),
						mediaInput("quote", "A quote, with who said it", "“We want people back on the buses,” said council member Ana Ruiz.", h.Aria("label", "Quote"))),
					h.Label(h.Class("flex flex-col gap-1.5"),
						h.Span(h.Class("font-mono text-xs text-muted-foreground"), "Background"),
						mediaArea("background", "Older context, least important", "The free service starts next month and will be reviewed after a year. Two members voted against, citing the cost once the grant ends.", h.Aria("label", "Background"), h.Class("min-h-20"))),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex items-center justify-between gap-3"),
						panelLabel("The story"),
						mediaCopy("Copy as Markdown"),
					),
					h.Div(h.Class("grid grid-cols-[72px_1fr] gap-3"),
						// The pyramid: three bands that line up with the paragraphs.
						h.Svg(h.ViewBox("0 0 72 220"), h.Class("block w-full"), h.Aria("hidden", "true"),
							h.El("path", h.Attr("d", "M2 4 H70 L58 70 H14 Z"), h.Class("fill-brand/25 stroke-brand")),
							h.El("path", h.Attr("d", "M14 76 H58 L48 142 H24 Z"), h.Class("fill-brand/12 stroke-brand/60")),
							h.El("path", h.Attr("d", "M24 148 H48 L38 214 H34 Z"), h.Class("fill-foreground/5 stroke-foreground/30")),
						),
						h.Article(h.Data("media-pyr-story", ""), h.Class("flex flex-col gap-3 text-[15px] leading-relaxed")),
					),
					readouts([2]string{"lede words", "words"}, [2]string{"lede covers", "covers"}),
					mediaNote("Rules of thumb used in many newsrooms, not a standard: a lede of roughly 25–35 words, one idea, the newest fact first."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func mediaSourcingBlock() Block {
	return Block{
		Slug:        "sourcing-ethics",
		Title:       "Sourcing and corrections",
		Description: "How a reporter may use what a source says, from on the record to off the record, with the attribution each allows; and the other end of the job, owning mistakes, with a correction log built on the SPJ Code of Ethics.",
		Tags:        []string{"attribution", "SPJ", "corrections"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("media-sourcing", ""),
				segs("Topic", [2]string{"ladder", "Sourcing ladder"}, [2]string{"corrections", "Ethics and corrections"}),
				h.Div(h.Data("view", "ladder"), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Ol(h.Data("media-src-ladder", ""), h.Class("flex flex-col gap-1.5")),
					h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-code p-4"),
						h.Span(h.Data("media-src-name", ""), h.Class("text-base font-semibold")),
						h.P(h.Data("media-src-def", ""), h.Class("text-sm leading-relaxed text-muted-foreground")),
						panelLabel("How it reads in print"),
						h.Blockquote(h.Data("media-src-example", ""), h.Class("border-l-2 border-brand pl-3 text-[15px] leading-relaxed italic")),
						mediaNote("Common newsroom usage; the exact meaning of “background” and “deep background” varies between outlets and countries, so reporters agree the terms with a source before the conversation. Names and quotes are fictional."),
					),
				),
				h.Div(h.Data("view", "corrections"), h.Hidden(), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						h.Map([][2]string{
							{"Seek truth and report it", "Accuracy and fairness; verify before publishing; identify sources clearly."},
							{"Minimize harm", "Treat sources, subjects and the public as people deserving respect."},
							{"Act independently", "Serve the public; avoid conflicts of interest, real or perceived."},
							{"Be accountable and transparent", "Take responsibility for your work and explain your choices; correct mistakes promptly and prominently."},
						}, func(p [2]string) h.Node {
							return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-3"),
								h.Span(h.Class("text-sm font-medium"), p[0]),
								h.Span(h.Class("text-xs leading-relaxed text-muted-foreground"), p[1]))
						}),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground sm:col-span-2"), "The four principles of the Society of Professional Journalists Code of Ethics (2014 revision), paraphrased."),
					),
					mediaCard(
						h.Div(h.Class("flex items-center justify-between gap-3"),
							panelLabel("Correction log"),
							mediaCopy("Copy"),
						),
						h.Label(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-xs text-muted-foreground"), "What the story said"),
							mediaInput("wrong", "The error, quoted", "the vote was 6–3", h.Aria("label", "What the story said"))),
						h.Label(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-xs text-muted-foreground"), "What is correct"),
							mediaInput("right", "The correct fact", "the vote was 7–2", h.Aria("label", "What is correct"))),
						h.Label(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-xs text-muted-foreground"), "Story"),
							mediaInput("story", "Headline of the story", "Council makes weekend buses free", h.Aria("label", "Story"))),
						h.Div(h.Data("media-corr-note", ""), h.Class("rounded-lg border border-dashed bg-code p-3 text-sm leading-relaxed")),
						mediaNote("A correction names the error and the fix plainly, says when it was made, and sits where readers of the original will see it."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func mediaEXIFBlock() Block {
	return Block{
		Slug:        "image-metadata",
		Title:       "Image metadata reader",
		Description: "Photos often carry EXIF metadata: when, with what camera, sometimes where. Open a JPEG from your own device and read it here, in the browser; nothing is uploaded. Then remember why metadata proves less than it seems.",
		Tags:        []string{"EXIF", "verification", "offline"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("media-exif", ""),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						h.Label(h.Class("inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm shadow-xs transition-colors duration-150 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 hover:bg-accent"),
							hugeicons.Image01Icon(h.Class("size-4")), "Open a JPEG",
							h.Input(h.Type("file"), h.Attr("accept", "image/jpeg"), h.Data("media-exif-file", ""), h.Class("sr-only"))),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("media-exif-sample", ""), hugeicons.File01Icon(), "Load a synthetic sample"),
					),
					h.Div(h.Class("flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"),
						hugeicons.Shield01Icon(h.Class("size-4 shrink-0")),
						"Read with FileReader in this tab. The file never leaves your device."),
					h.Dl(h.Data("media-exif-out", ""), h.Aria("live", "polite"), h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border bg-code p-4 font-mono text-xs")),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("What metadata can and can't tell you"),
					h.Ul(h.Class("flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-foreground/40"),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "It can be missing. "), "Most social platforms strip EXIF on upload, so a photo from a feed usually has none."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "It can be wrong. "), "Camera clocks drift or were never set, and any field can be edited with free tools."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "It is a lead, not proof. "), "Check it against the scene: weather, shadows, signs, what else was published from that place and time."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Search for older copies. "), "A reverse image search (several engines offer one) can show the same photo published earlier, with another caption. This block does no searching."),
						h.Li(h.Span(h.Class("font-medium text-foreground"), "Location is personal. "), "GPS tags can reveal a home. Strip them before you share your own photos."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func mediaPersuasionBlock() Block {
	return Block{
		Slug:        "persuasion",
		Title:       "Persuasion techniques",
		Description: "Ten classic techniques of propaganda and persuasion, each with an invented example, then a quiz on fresh statements. Spotting the technique doesn't settle whether the claim is true; it tells you where to look harder.",
		Tags:        []string{"propaganda", "quiz", "synthetic"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("media-persuasion", ""),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Data("media-tech-grid", ""), h.Class("grid gap-2 sm:grid-cols-2")),
					mediaNote("Seven of these (name-calling, glittering generalities, transfer, testimonial, plain folks, card stacking, bandwagon) come from the Institute for Propaganda Analysis (1937); the others are standard terms from rhetoric and media studies. All examples are invented."),
				),
				mediaCard(
					h.Div(h.Class("flex items-center justify-between gap-2"),
						panelLabel("Quiz"),
						h.Span(h.Data("media-quiz-score", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0 / 0"),
					),
					h.P(h.Data("media-quiz-q", ""), h.Class("text-[15px] leading-relaxed font-medium text-balance")),
					h.Div(h.Data("media-quiz-options", ""), h.Class("grid grid-cols-2 gap-1.5")),
					h.P(h.Data("media-quiz-feedback", ""), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("media-quiz-next", ""), "Next statement", hugeicons.ArrowRight01Icon()),
				),
			)
		},
	}
}
