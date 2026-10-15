package site

import (
	"fmt"

	"github.com/alexisbcz/components/lib"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/collapsible"
	"github.com/alexisbcz/components/ui/dialog"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/components/ui/tabs"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// A11yBlocks lists the accessibility gallery in display order.
func A11yBlocks() []Block {
	return []Block{
		a11yTreeBlock(),
		a11yFocusBlock(),
		a11yReaderBlock(),
		a11yHeadingsBlock(),
		a11yAltBlock(),
		a11yTargetBlock(),
		a11yFormsBlock(),
		a11yPatternsBlock(),
		a11yColorBlock(),
		a11yMotionBlock(),
	}
}

// a11ySC is a WCAG success criterion chip: number, name and level.
func a11ySC(num, name, level string) h.Node {
	return h.Span(h.Class("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"),
		h.Span(h.Class("font-mono text-foreground"), num), name,
		h.Span(h.Class("font-mono text-[10px]"), level))
}

func a11yCriteria(items ...h.Node) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1.5"), h.Aria("label", "WCAG 2.2 success criteria"), h.Role("list"),
		h.Map(items, func(n h.Node) h.Node { return h.Span(h.Role("listitem"), n) }))
}

// a11yVersions is a pair of toggle buttons choosing between the broken and
// the fixed version of a demo (aria-pressed; static/js/a11y.js swaps the
// [data-a11y-version] panels inside the same block root).
func a11yVersions(label string) h.Node {
	btn := func(v, text string, on bool) h.Node {
		return h.Button(h.Type("button"), h.Data("a11y-pick", v), h.Aria("pressed", fmt.Sprint(on)),
			h.Class("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"),
			h.IfElse(v == "bad", hugeicons.Cancel01Icon(h.Class("size-3.5 text-del")), hugeicons.Tick02Icon(h.Class("size-3.5 text-add"))),
			text)
	}
	return h.Div(h.Role("group"), h.Aria("label", label), h.Class("flex items-center gap-1 rounded-lg border p-0.5"),
		btn("bad", "Broken", true), btn("good", "Fixed", false))
}

func a11yNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, children...)...)
}

// a11yStage is the framed area where a sample widget lives.
func a11yStage(children ...any) *h.Element {
	return h.Div(append([]any{h.Class("rounded-lg border border-dashed bg-background p-4")}, children...)...)
}

const a11yInput = "h-9 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"

// ---------------------------------------------------------------- 1

func a11yTreeBlock() Block {
	return Block{
		Slug:        "accessibility-tree",
		Title:       "Accessibility tree",
		Description: "What assistive technology actually receives: a role, a name and a state for every element. Switch between a broken and a fixed sign-up widget; the tree on the right is computed from the live DOM with the accessible-name rules (aria-labelledby, then aria-label, then the native label or content, then title).",
		Tags:        []string{"AccName", "4.1.2", "roles"},
		Wide:        true,
		Render: func() h.Node {
			bad := a11yStage(h.Data("a11y-version", "bad"), h.Data("a11y-sample", ""),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("text-base font-semibold"), "Join the newsletter"),
					h.Div(h.Class("flex items-center gap-2"),
						h.Img(h.Src("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), h.Class("size-5 rounded bg-brand/30")),
						h.Input(h.Type("email"), h.Placeholder("Email"), h.Class(a11yInput))),
					h.Label(h.Class("flex items-center gap-2 text-sm"), h.Input(h.Type("checkbox")), "Weekly digest"),
					h.Div(h.Class("inline-flex h-9 w-fit cursor-pointer items-center rounded-md border px-3 text-sm"), "Subscribe"),
					h.P(h.Class("text-sm text-muted-foreground"), "Read our privacy policy ", h.A(h.Href("#accessibility-tree"), h.Class("underline"), "here"), "."),
				))
			good := a11yStage(h.Data("a11y-version", "good"), h.Data("a11y-sample", ""), h.Hidden(),
				h.Form(h.Action("#accessibility-tree"), h.Class("flex flex-col gap-3"), h.Aria("labelledby", "a11y-nl-title"),
					h.H3(h.ID("a11y-nl-title"), h.Class("text-base font-semibold"), "Join the newsletter"),
					h.Div(h.Class("flex flex-col gap-1.5"),
						h.Label(h.For("a11y-nl-email"), h.Class("text-sm font-medium"), "Email address"),
						h.Div(h.Class("flex items-center gap-2"),
							h.Img(h.Src("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), h.Alt(""), h.Class("size-5 rounded bg-brand/30")),
							h.Input(h.Type("email"), h.ID("a11y-nl-email"), h.Required(), h.Attr("autocomplete", "email"), h.Class(a11yInput)))),
					h.Label(h.Class("flex items-center gap-2 text-sm"), h.Input(h.Type("checkbox"), h.Checked()), "Weekly digest"),
					h.Button(h.Type("button"), h.Class("inline-flex h-9 w-fit items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), "Subscribe"),
					h.P(h.Class("text-sm text-muted-foreground"), h.A(h.Href("#accessibility-tree"), h.Class("underline"), "Read our privacy policy"), "."),
				))
			return h.Div(h.Data("a11y-tree", ""), h.Class("grid gap-4 overflow-hidden rounded-xl border bg-background p-4 lg:grid-cols-2 sm:p-5"),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"), panelLabel("The widget"), a11yVersions("Widget version")),
					bad, good,
					a11yCriteria(a11ySC("1.1.1", "Non-text Content", "A"), a11ySC("1.3.1", "Info and Relationships", "A"), a11ySC("2.4.4", "Link Purpose", "A"), a11ySC("4.1.2", "Name, Role, Value", "A")),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("What the accessibility tree exposes"),
					h.Ol(h.Data("a11y-tree-out", ""), h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3 font-mono text-[12px]"), h.Aria("live", "polite")),
					h.P(h.Data("a11y-tree-summary", ""), h.Class("text-sm"), h.Role("status")),
					a11yNote("A simplified computation for teaching: real browsers follow the full AccName 1.2 algorithm and the HTML-AAM mappings."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func a11yFocusBlock() Block {
	field := func(id, label string, tabindex string) h.Node {
		return h.Div(h.Class("relative flex flex-col gap-1"),
			h.Label(h.For(id), h.Class("text-xs font-medium"), label),
			h.Input(h.ID(id), h.Type("text"), h.Data("a11y-focusable", ""), h.If(tabindex != "", h.Data("a11y-tabindex", tabindex)), h.Class(a11yInput)))
	}
	form := func(version string, bad bool) h.Node {
		suffix := version
		ti := func(s string) string {
			if bad {
				return s
			}
			return ""
		}
		return h.Div(h.Data("a11y-version", version), h.If(!bad, h.Hidden()), h.Class("flex flex-col gap-3"),
			a11yStage(h.Data("a11y-focus-stage", ""), h.Class("relative"),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					field("a11y-f-first-"+suffix, "First name", ti("3")),
					field("a11y-f-last-"+suffix, "Last name", ti("1")),
					field("a11y-f-city-"+suffix, "City", ti("2")),
					h.Div(h.Class("relative flex flex-col gap-1"),
						h.Label(h.For("a11y-f-date-"+suffix), h.Class("text-xs font-medium"), h.IfElse(bad, "Date (keyboard trap)", "Date")),
						h.Input(h.ID("a11y-f-date-"+suffix), h.Type("text"), h.Data("a11y-focusable", ""), h.If(bad, h.Data("a11y-trap", "")), h.Placeholder("DD/MM/YYYY"), h.Class(a11yInput))),
				),
				h.Div(h.Class("mt-3 flex gap-2"),
					h.Button(h.Type("button"), h.Data("a11y-focusable", ""), h.If(bad, h.Data("a11y-tabindex", "4")), h.Class("inline-flex h-9 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), "Cancel"),
					h.Button(h.Type("button"), h.Data("a11y-focusable", ""), h.Class("inline-flex h-9 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), "Save"),
				),
			),
		)
	}
	return Block{
		Slug:        "focus-order",
		Title:       "Focus order and keyboard traps",
		Description: "Tab through the same form twice. The broken one uses positive tabindex, so focus jumps around the page, and its date field swallows Tab like a badly built widget. The numbers show the order a keyboard user really gets.",
		Tags:        []string{"2.4.3", "2.1.2", "tabindex"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("a11y-focus", ""), h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					h.P(h.Class("flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"), "Click into the form, then press", kbd.Kbd("Tab"), "and", kbd.Group(kbd.Kbd("⇧"), kbd.Kbd("Tab"))),
					a11yVersions("Form version")),
				form("bad", true), form("good", false),
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_auto]"),
					h.P(h.Data("a11y-focus-log", ""), h.Role("status"), h.Class("min-h-10 rounded-lg border bg-code px-3 py-2 font-mono text-xs"), "Focus: outside the form"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("a11y-focus-numbers", ""), h.Aria("pressed", "true"), hugeicons.ViewIcon(), "Show order"),
				),
				a11yCriteria(a11ySC("2.1.1", "Keyboard", "A"), a11ySC("2.1.2", "No Keyboard Trap", "A"), a11ySC("2.4.3", "Focus Order", "A"), a11ySC("2.4.7", "Focus Visible", "AA")),
				a11yNote("The broken form simulates tabindex=\"1\"…\"4\" inside the demo only, so this page keeps a sane order; its trap releases after three Tab presses, a real one would not. Keep DOM order equal to visual order and use tabindex only as 0 or −1."),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func a11yReaderBlock() Block {
	return Block{
		Slug:        "screen-reader",
		Title:       "Screen reader, linearised",
		Description: "A screen reader turns the page into a line, and users jump by landmarks, headings and links. Read this sample region the way they do: in order, as a headings list, or as a links list. Ambiguous links such as “click here” and three identical “Read more” stand out at once.",
		Tags:        []string{"landmarks", "rotor", "2.4.4"},
		Wide:        true,
		Render: func() h.Node {
			sample := a11yStage(h.Data("a11y-reader-sample", ""), h.Class("text-sm"),
				h.Nav(h.Aria("label", "Sample site"), h.Class("mb-3 flex gap-3 border-b pb-2"),
					h.A(h.Href("#screen-reader"), h.Class("underline"), "Home"),
					h.A(h.Href("#screen-reader"), h.Class("underline"), "Courses"),
					h.A(h.Href("#screen-reader"), h.Class("underline"), "Pricing")),
				h.Section(h.Aria("label", "Featured courses"), h.Class("flex flex-col gap-2"),
					h.H3(h.Class("text-base font-semibold"), "New this month"),
					h.Article(h.Class("flex flex-col gap-1"),
						h.H4(h.Class("font-medium"), "Linear algebra"),
						h.P(h.Class("text-muted-foreground"), "Matrices as transformations. ", h.A(h.Href("#screen-reader"), h.Class("underline"), "Read more"))),
					h.Article(h.Class("flex flex-col gap-1"),
						h.H4(h.Class("font-medium"), "Neuroscience"),
						h.P(h.Class("text-muted-foreground"), "The action potential, live. ", h.A(h.Href("#accessibility-tree"), h.Class("underline"), "Read more"))),
					h.Article(h.Class("flex flex-col gap-1"),
						h.H4(h.Class("font-medium"), "Chemistry"),
						h.P(h.Class("text-muted-foreground"), "Balance any equation. ", h.A(h.Href("#focus-order"), h.Class("underline"), "Read more"))),
					h.Img(h.Src("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), h.Alt("Bar chart: enrolments doubled since January"), h.Class("h-6 w-full rounded bg-brand/20")),
					h.P("To download the syllabus, ", h.A(h.Href("#screen-reader"), h.Class("underline"), "click here"), "."),
					h.Button(h.Type("button"), h.Class("w-fit rounded-md border px-2.5 py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), "Subscribe")))
			mode := func(v, label string, on bool) h.Node {
				return h.Button(h.Type("button"), h.Data("a11y-mode", v), h.Aria("pressed", fmt.Sprint(on)),
					h.Class("rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"), label)
			}
			return h.Div(h.Data("a11y-reader", ""), h.Class("grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-2 sm:p-5"),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Sample region"), sample),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"), panelLabel("What is announced"),
						h.Div(h.Role("group"), h.Aria("label", "Reading mode"), h.Class("flex items-center gap-1 rounded-lg border p-0.5"),
							mode("read", "Read all", true), mode("headings", "Headings", false), mode("links", "Links", false), mode("landmarks", "Landmarks", false))),
					h.Ol(h.Data("a11y-reader-out", ""), h.Class("flex max-h-80 flex-col gap-1 overflow-auto rounded-lg border bg-code p-3 font-mono text-[12px]")),
					h.P(h.Data("a11y-reader-warn", ""), h.Role("status"), h.Class("text-sm")),
					a11yCriteria(a11ySC("1.3.1", "Info and Relationships", "A"), a11ySC("2.4.1", "Bypass Blocks", "A"), a11ySC("2.4.4", "Link Purpose (In Context)", "A"), a11ySC("2.4.6", "Headings and Labels", "AA")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

const a11yHeadingsSample = `<h1>Course catalogue</h1>
<h2>Mathematics</h2>
<h4>Linear algebra</h4>
<h3>Calculus</h3>
<h2></h2>
<div role="heading" aria-level="2">Physics</div>
<h3>Optics</h3>
<h1>Contact</h1>`

func a11yHeadingsBlock() Block {
	return Block{
		Slug:        "headings",
		Title:       "Headings outline checker",
		Description: "Paste any HTML and get the outline a screen-reader user navigates with. The checker flags skipped levels, empty headings and several level-one headings. The markup is parsed into an inert document and never inserted into this page.",
		Tags:        []string{"DOMParser", "outline", "1.3.1"},
		Render: func() h.Node {
			return h.Div(h.Data("a11y-headings", ""), h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"),
				h.Label(h.For("a11y-headings-in"), h.Class("text-sm font-medium"), "HTML to check"),
				h.Textarea(h.ID("a11y-headings-in"), h.Data("a11y-headings-in", ""), h.Attr("rows", "8"), h.Attr("spellcheck", "false"),
					h.Class("w-full rounded-md border border-input bg-code p-3 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-[13px]"),
					a11yHeadingsSample),
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Outline"),
						h.Ol(h.Data("a11y-headings-out", ""), h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3 text-sm"))),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Findings"),
						h.Ul(h.Data("a11y-headings-findings", ""), h.Role("status"), h.Class("flex flex-col gap-1.5 text-sm"))),
				),
				a11yNote("Skipping levels and several h1 elements are not failures of a success criterion on their own; they are flagged because they break the outline users rely on (1.3.1, 2.4.6)."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func a11yAltBlock() Block {
	return Block{
		Slug:        "alt-text",
		Title:       "Alt text decision tree",
		Description: "Which alt does this image need? Answer the questions of the W3C WAI alt decision tree one at a time; the answer names the kind of image (informative, functional, text, complex, decorative) and gives the alt to write, with an example.",
		Tags:        []string{"1.1.1", "W3C WAI", "stepper"},
		Render: func() h.Node {
			return h.Div(h.Data("a11y-alt", ""), h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"),
				h.Div(h.Class("flex items-center justify-between gap-2"),
					h.Span(h.Data("a11y-alt-step", ""), h.Class("font-mono text-xs text-muted-foreground"), "Question 1"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("a11y-alt-restart", ""), hugeicons.RefreshIcon(), "Start over")),
				h.Div(h.Data("a11y-alt-card", ""), h.Aria("live", "polite"), h.Class("flex min-h-40 flex-col gap-3 rounded-lg border bg-code p-4")),
				h.Ol(h.Data("a11y-alt-path", ""), h.Aria("label", "Your answers"), h.Class("flex flex-col gap-1 text-xs text-muted-foreground")),
				a11yNote("After the W3C WAI Images Tutorial, “An alt Decision Tree”. Purely decorative images get alt=\"\" (empty), not a missing alt attribute."),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func a11yTargetBlock() Block {
	return Block{
		Slug:        "target-size",
		Title:       "Target size",
		Description: "WCAG 2.2 asks for pointer targets of at least 24 by 24 CSS pixels, or enough spacing: a 24 px circle centred on each small target must not touch another target or its circle. Resize the two icon buttons and their gap and watch the verdict.",
		Tags:        []string{"2.5.8", "2.5.5", "spacing"},
		Render: func() h.Node {
			return h.Div(h.Data("a11y-target", ""), h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"),
				h.Div(h.Class("flex min-h-44 items-center justify-center rounded-lg border bg-code p-4"),
					h.Svg(h.Data("a11y-target-svg", ""), h.ViewBox("0 0 320 140"), h.Class("block w-full max-w-md"), h.Role("img"), h.Aria("label", "Two targets with their 24 pixel spacing circles"))),
				h.Div(h.Class("grid gap-2 sm:grid-cols-3"),
					field("w", "Width", "px", 20, 8, 60, 1),
					field("hgt", "Height", "px", 20, 8, 60, 1),
					field("gap", "Gap", "px", 2, 0, 40, 1),
				),
				h.Ul(h.Data("a11y-target-verdict", ""), h.Role("status"), h.Class("flex list-none flex-col gap-1.5 text-sm")),
				a11yCriteria(a11ySC("2.5.8", "Target Size (Minimum)", "AA"), a11ySC("2.5.5", "Target Size (Enhanced)", "AAA")),
				a11yNote("2.5.8 also exempts inline targets in text, targets whose size the browser sets, equivalent controls elsewhere on the page, and essential presentations. 2.5.5 (AAA) asks for 44 by 44."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func a11yFormsBlock() Block {
	badForm := func() h.Node {
		return h.Form(h.Data("a11y-version", "bad"), h.Data("a11y-form", "bad"), h.Action("#forms"), h.Attr("novalidate", ""), h.Class("flex flex-col gap-3"),
			a11yStage(h.Class("flex flex-col gap-3"),
				h.Input(h.Type("text"), h.Name("name"), h.Placeholder("Full name"), h.Class(a11yInput)),
				h.Input(h.Type("text"), h.Name("email"), h.Placeholder("Email"), h.Class(a11yInput)),
				h.Div(h.Class("inline-flex"), h.Button(h.Type("submit"), h.Class("h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), "Send")),
			))
	}
	goodForm := func() h.Node {
		return h.Form(h.Data("a11y-version", "good"), h.Data("a11y-form", "good"), h.Hidden(), h.Action("#forms"), h.Attr("novalidate", ""), h.Class("flex flex-col gap-3"),
			a11yStage(h.Class("flex flex-col gap-3"),
				h.Div(h.Class("flex flex-col gap-1"),
					h.Label(h.For("a11y-fm-name"), h.Class("text-sm font-medium"), "Full name ", h.Span(h.Class("text-muted-foreground"), "(required)")),
					h.Input(h.ID("a11y-fm-name"), h.Type("text"), h.Name("name"), h.Required(), h.Attr("autocomplete", "name"), h.Aria("describedby", "a11y-fm-name-err"), h.Class(a11yInput+" aria-invalid:border-del")),
					h.P(h.ID("a11y-fm-name-err"), h.Data("a11y-err", "name"), h.Class("flex items-center gap-1 text-xs text-del empty:hidden"))),
				h.Div(h.Class("flex flex-col gap-1"),
					h.Label(h.For("a11y-fm-email"), h.Class("text-sm font-medium"), "Email ", h.Span(h.Class("text-muted-foreground"), "(required)")),
					h.P(h.ID("a11y-fm-email-hint"), h.Class("text-xs text-muted-foreground"), "We only use it to reply."),
					h.Input(h.ID("a11y-fm-email"), h.Type("email"), h.Name("email"), h.Required(), h.Attr("autocomplete", "email"), h.Aria("describedby", "a11y-fm-email-hint a11y-fm-email-err"), h.Class(a11yInput+" aria-invalid:border-del")),
					h.P(h.ID("a11y-fm-email-err"), h.Data("a11y-err", "email"), h.Class("flex items-center gap-1 text-xs text-del empty:hidden"))),
				h.Div(h.Class("inline-flex"), h.Button(h.Type("submit"), h.Class("h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"), "Send")),
				h.P(h.Data("a11y-form-status", ""), h.Role("status"), h.Class("text-sm empty:hidden")),
			))
	}
	return Block{
		Slug:        "forms",
		Title:       "Labels, errors and status messages",
		Description: "Submit both forms empty. The broken one relies on placeholders and turns borders red; the fixed one has real labels, ties hints and errors to their fields with aria-describedby, marks them aria-invalid, moves focus to the first error and announces the result in a status region. The panel shows what is announced when each field gets focus.",
		Tags:        []string{"3.3.1", "3.3.2", "4.1.3"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("a11y-forms", ""), h.Class("grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-2 sm:p-5"),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"), panelLabel("The form"), a11yVersions("Form version")),
					badForm(), goodForm()),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("Announced on focus"),
					h.P(h.Data("a11y-form-announce", ""), h.Class("min-h-16 rounded-lg border bg-code p-3 font-mono text-[12px]"), "Focus a field"),
					a11yCriteria(a11ySC("1.3.1", "Info and Relationships", "A"), a11ySC("3.3.1", "Error Identification", "A"), a11ySC("3.3.2", "Labels or Instructions", "A"), a11ySC("4.1.3", "Status Messages", "AA")),
					a11yNote("A placeholder vanishes as soon as you type and is not a reliable label. Error text must say what is wrong in words, not only in colour."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func a11yPatternsBlock() Block {
	keys := func(rows ...[2]string) h.Node {
		return h.Table(h.Class("w-full text-xs"),
			h.Caption(h.Class("sr-only"), "Keyboard interaction"),
			h.Tbody(h.Map(rows, func(r [2]string) h.Node {
				return h.Tr(h.Class("border-b last:border-b-0"),
					h.Th(h.Attr("scope", "row"), h.Class("py-1.5 pr-3 text-left font-normal"), kbd.Kbd(r[0])),
					h.Td(h.Class("py-1.5 text-muted-foreground"), r[1]))
			})))
	}
	card := func(title string, demo h.Node, table h.Node) h.Node {
		return h.Section(h.Class("flex flex-col gap-3 rounded-lg border bg-background p-4"), h.Aria("label", title),
			h.H3(h.Class("text-sm font-semibold"), title), demo, table)
	}
	return Block{
		Slug:        "aria-patterns",
		Title:       "ARIA patterns done right",
		Description: "Three widgets from the ARIA Authoring Practices Guide, built with this site's shadcn components (which follow Radix): a disclosure, tabs with arrow-key navigation, and a modal dialog that traps focus, closes on Escape and returns focus to its trigger. The log follows focus as you use them.",
		Tags:        []string{"APG", "tabs", "dialog"},
		Wide:        true,
		Render: func() h.Node {
			disclosure := collapsible.Collapsible(h.Class("flex flex-col gap-2"),
				collapsible.Trigger(lib.AsChild, button.Button(button.VariantOutline, button.SizeSm, h.Class("group w-fit"),
					hugeicons.ArrowRight01Icon(h.Class("transition-transform duration-200 ease-[var(--ease-out)] group-data-[state=open]:rotate-90")),
					"Shipping details")),
				collapsible.Content(h.Class("overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"),
					h.P(h.Class("rounded-md border bg-code p-3 text-sm text-muted-foreground"), "Orders ship in two working days. The button reports aria-expanded and points to this panel with aria-controls.")))
			tabsDemo := tabs.Tabs(tabs.Value("overview"),
				tabs.List(h.Aria("label", "Course"),
					tabs.Trigger(tabs.Value("overview"), "Overview"),
					tabs.Trigger(tabs.Value("syllabus"), "Syllabus"),
					tabs.Trigger(tabs.Value("reviews"), "Reviews")),
				tabs.Content(tabs.Value("overview"), h.P(h.Class("p-2 text-sm text-muted-foreground"), "One tab stop for the whole list; arrows move between tabs.")),
				tabs.Content(tabs.Value("syllabus"), h.P(h.Class("p-2 text-sm text-muted-foreground"), "Twelve lessons, each with exercises.")),
				tabs.Content(tabs.Value("reviews"), h.P(h.Class("p-2 text-sm text-muted-foreground"), "Rated 4.8 by learners (demo text).")))
			dialogDemo := dialog.Dialog(
				dialog.Trigger(lib.AsChild, button.Button(button.VariantOutline, button.SizeSm, h.Data("a11y-dialog-trigger", ""), "Delete draft…")),
				dialog.Content(
					dialog.Header(dialog.Title("Delete this draft?"), dialog.Description("This removes the draft from this device. You can't undo it.")),
					dialog.Footer(
						dialog.Close(lib.AsChild, button.Button(button.VariantOutline, "Cancel")),
						dialog.Close(lib.AsChild, button.Button(button.VariantOutline, h.Class("text-del"), "Delete"))),
				))
			return h.Div(h.Data("a11y-patterns", ""), h.Class("flex flex-col gap-4"),
				h.Div(h.Class("grid gap-3 lg:grid-cols-3"),
					card("Disclosure", disclosure, keys([2]string{"Enter", "Toggles the panel"}, [2]string{"Space", "Toggles the panel"})),
					card("Tabs", tabsDemo, keys([2]string{"Tab", "Into the list, then to the panel"}, [2]string{"← →", "Previous or next tab"}, [2]string{"Home", "First tab"}, [2]string{"End", "Last tab"})),
					card("Modal dialog", h.Div(dialogDemo), keys([2]string{"Tab", "Cycles inside the dialog only"}, [2]string{"Esc", "Closes it"}, [2]string{"Close", "Focus returns to the trigger"})),
				),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("Focus log"),
					h.Ol(h.Data("a11y-patterns-log", ""), h.Aria("live", "off"), h.Class("flex max-h-40 flex-col-reverse gap-0.5 overflow-auto rounded-lg border bg-code p-3 font-mono text-[12px] text-muted-foreground"),
						h.Li("Use the widgets above"))),
				a11yCriteria(a11ySC("2.1.1", "Keyboard", "A"), a11ySC("2.4.3", "Focus Order", "A"), a11ySC("4.1.2", "Name, Role, Value", "A")),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func a11yColorBlock() Block {
	return Block{
		Slug:        "use-of-color",
		Title:       "Colour is not the only cue",
		Description: "Information carried only by colour is lost to many people. Compare a chart whose two series differ only in hue with one that adds markers, dash patterns and direct labels, and an error state shown only as a red border with one that adds an icon and text. View both in greyscale to see what remains.",
		Tags:        []string{"1.4.1", "1.4.11", "greyscale"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Data("a11y-color", ""), h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					a11yVersions("Cues"),
					h.Button(h.Type("button"), h.Data("a11y-grey", ""), h.Aria("pressed", "false"),
						h.Class("inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"),
						hugeicons.EyeIcon(h.Class("size-4")), "View in greyscale")),
				h.Div(h.Data("a11y-color-stage", ""), h.Class("grid gap-4 transition-[filter] duration-200 sm:grid-cols-2 data-[grey]:grayscale"),
					h.Svg(h.Data("a11y-color-chart", ""), h.ViewBox("0 0 320 200"), h.Class("block w-full rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Line chart of two courses' weekly sign-ups")),
					h.Div(h.Class("flex flex-col justify-center gap-3 rounded-lg border bg-code p-4"),
						h.Div(h.Data("a11y-version", "bad"), h.Class("flex flex-col gap-1"),
							h.Label(h.For("a11y-col-bad"), h.Class("text-sm font-medium"), "Promo code"),
							h.Input(h.ID("a11y-col-bad"), h.Type("text"), h.Value("SPRING24"), h.Class(a11yInput+" !border-[#e5484d] !ring-0"))),
						h.Div(h.Data("a11y-version", "good"), h.Hidden(), h.Class("flex flex-col gap-1"),
							h.Label(h.For("a11y-col-good"), h.Class("text-sm font-medium"), "Promo code"),
							h.Input(h.ID("a11y-col-good"), h.Type("text"), h.Value("SPRING24"), h.Aria("invalid", "true"), h.Aria("describedby", "a11y-col-err"), h.Class(a11yInput+" !border-[#e5484d] border-2")),
							h.P(h.ID("a11y-col-err"), h.Class("flex items-center gap-1.5 text-xs text-del"), hugeicons.Alert02Icon(h.Class("size-3.5")), "This code has expired.")),
					),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"),
					h.A(h.Href("/design#contrast"), h.Class("underline underline-offset-4 hover:text-brand"), "Contrast checker (Art & Design)"),
					h.A(h.Href("/design#colour-vision"), h.Class("underline underline-offset-4 hover:text-brand"), "Colour-vision simulation (Art & Design)")),
				a11yCriteria(a11ySC("1.4.1", "Use of Color", "A"), a11ySC("1.4.11", "Non-text Contrast", "AA")),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func a11yMotionBlock() Block {
	return Block{
		Slug:        "motion-media",
		Title:       "Motion, captions and transcripts",
		Description: "Motion can make people with vestibular disorders ill, so this site honours prefers-reduced-motion. The card below reads your setting, lets you simulate it, and gives its own animation a pause button, since anything that moves on its own for more than five seconds must be pausable. Media needs text alternatives too.",
		Tags:        []string{"2.2.2", "2.3.3", "1.2.2"},
		Render: func() h.Node {
			return h.Div(h.Data("a11y-motion", ""), h.Class("flex flex-col gap-4"),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-4 sm:p-5"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
						h.P(h.Class("text-sm"), "Your system setting: ", h.Span(h.Data("a11y-motion-pref", ""), h.Class("font-mono font-medium"), "—")),
						h.Div(h.Class("flex gap-2"),
							h.Button(h.Type("button"), h.Data("a11y-motion-sim", ""), h.Aria("pressed", "false"),
								h.Class("inline-flex h-8 items-center rounded-md border px-3 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"), "Simulate reduce"),
							h.Button(h.Type("button"), h.Data("a11y-motion-pause", ""), h.Aria("pressed", "false"),
								h.Class("inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"),
								hugeicons.PauseIcon(h.Class("size-4")), h.Span(h.Data("a11y-motion-pause-label", ""), "Pause")))),
					h.Div(h.Class("relative h-28 overflow-hidden rounded-lg border bg-code"), h.Aria("hidden", "true"),
						h.Div(h.Data("a11y-motion-orb", ""), h.Class("absolute top-1/2 left-4 size-10 -translate-y-1/2 rounded-full bg-brand/70"))),
					h.P(h.Data("a11y-motion-state", ""), h.Role("status"), h.Class("text-sm text-muted-foreground")),
				),
				h.Div(h.Class("grid gap-3 sm:grid-cols-3"),
					h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-background p-4 text-sm"),
						h.Span(h.Class("flex items-center gap-2 font-medium"), hugeicons.SubtitleIcon(h.Class("size-4")), "Captions"),
						h.P(h.Class("text-muted-foreground"), "Synchronised text of speech and meaningful sounds for prerecorded video with audio."),
						h.P(h.Class("mt-auto pt-1 text-xs text-muted-foreground"), h.Span(h.Class("font-mono text-foreground"), "1.2.2"), " Captions (Prerecorded) · A")),
					h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-background p-4 text-sm"),
						h.Span(h.Class("flex items-center gap-2 font-medium"), hugeicons.Message01Icon(h.Class("size-4")), "Transcripts"),
						h.P(h.Class("text-muted-foreground"), "A full text alternative for audio-only content, also useful for video and for search."),
						h.P(h.Class("mt-auto pt-1 text-xs text-muted-foreground"), h.Span(h.Class("font-mono text-foreground"), "1.2.1"), " Audio-only and Video-only · A")),
					h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-background p-4 text-sm"),
						h.Span(h.Class("flex items-center gap-2 font-medium"), hugeicons.VolumeHighIcon(h.Class("size-4")), "Audio description"),
						h.P(h.Class("text-muted-foreground"), "Narration of important visual information that the soundtrack doesn't convey."),
						h.P(h.Class("mt-auto pt-1 text-xs text-muted-foreground"), h.Span(h.Class("font-mono text-foreground"), "1.2.5"), " Audio Description (Prerecorded) · AA")),
				),
				a11yCriteria(
					a11ySC("2.2.2", "Pause, Stop, Hide", "A"),
					a11ySC("2.3.3", "Animation from Interactions", "AAA")),
			)
		},
	}
}
