package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/input"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
	"github.com/alexisbcz/libhtml/secure"
)

// SecurityBlocks lists the computer security gallery. Every attack here runs
// against a toy inside the page: nothing is sent anywhere, no script from
// an input is ever executed, and each vulnerable path sits next to its fix.
func SecurityBlocks() []Block {
	return []Block{
		secEntropyBlock(),
		secStorageBlock(),
		secXSSBlock(),
		secSQLiBlock(),
		secCSRFBlock(),
		secSTRIDEBlock(),
		secAccessBlock(),
		secPhishBlock(),
		secOverflowBlock(),
		secTOTPBlock(),
	}
}

// secInput is a text input with security-friendly defaults: no
// autocorrect, no autocapitalize, no spellcheck, monospace.
func secInput(name, value, label string, extra ...any) h.Node {
	return input.Input(append([]any{h.Type("text"), h.Data("in", name), h.Value(value), h.Aria("label", label),
		h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"), h.Attr("autocorrect", "off"), h.Attr("spellcheck", "false"),
		h.Class("font-mono")}, extra...)...)
}

// secVerdict is a status line the module fills in (vulnerable / fixed).
func secVerdict(key string) h.Node {
	return h.P(h.Data("out", key), h.Aria("live", "polite"), h.Class("min-h-5 text-sm"), "—")
}

// secPane is a titled panel: "vulnerable" or "fixed".
func secPane(kind, title string, body ...any) h.Node {
	ring := h.Ternary(kind == "bad", "border-del/40", "border-add/40")
	dot := h.Ternary(kind == "bad", "bg-del", "bg-add")
	return h.Div(h.Class("flex min-w-0 flex-col gap-2 rounded-lg border bg-background p-3 "+ring),
		h.Div(h.Class("flex items-center gap-2 text-xs font-medium"), h.Span(h.Class("size-2 rounded-full "+dot)), title),
		h.Group(body...),
	)
}

// ---------------------------------------------------------------- S1

func secEntropyBlock() Block {
	return Block{
		Slug:        "password-entropy",
		Title:       "Password strength",
		Description: "Two estimates side by side. The naive one multiplies length by log₂ of the character set, which is only true for random passwords; the pattern-aware one charges for dictionary words, years, sequences and repeats, the way real crackers guess. Then a passphrase generator shows where real strength comes from.",
		Tags:        []string{"entropy", "guessing", "passphrases"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sec-entropy",
				h.Div(h.Class("flex flex-col gap-4"),
					secInput("pw", "Summer2024!", "Password to analyse"),
					h.Div(h.Data("chips", ""), h.Class("flex min-h-6 flex-wrap gap-1.5")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Bits of entropy, naive against pattern-aware")),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3"),
						h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
							h.Span(h.Class("text-sm font-medium"), "Random passphrase"),
							h.Div(h.Class("flex items-center gap-2"),
								field("words", "Words", "", 5, 3, 10, 1),
								button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "phrase"), hugeicons.ShuffleIcon(), "New"),
							),
						),
						h.P(h.Data("out", "phrase"), h.Class("font-mono text-sm break-all"), "—"),
						h.P(h.Data("out", "phrase-bits"), h.Class("text-xs text-muted-foreground"), "—"),
					),
				),
				readouts([2]string{"length", "len"}, [2]string{"charset", "charset"}, [2]string{"naive", "naive"}, [2]string{"pattern-aware", "real"},
					[2]string{"offline 10¹⁰/s", "offline"}, [2]string{"online 100/h", "online"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"The pattern estimate is a heuristic in the spirit of zxcvbn (Wheeler, 2016), with a small built-in word list. The offline rate assumes a fast unsalted hash on GPUs; a slow hash (next block) cuts it by orders of magnitude. Your input never leaves this page."),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func secStorageBlock() Block {
	return Block{
		Slug:        "password-storage",
		Title:       "Storing passwords",
		Description: "What a server should keep instead of the password. A fast hash is cracked by a precomputed table; a salt makes every entry unique; a slow key-derivation function makes each guess expensive. The PBKDF2 timing is measured live in your browser with Web Crypto.",
		Tags:        []string{"hashing", "salt", "PBKDF2"},
		Wide:        true,
		Render: func() h.Node {
			row := func(key, label string) h.Node {
				return h.Div(h.Class("grid gap-1 border-b py-2 last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)]"),
					h.Span(h.Class("text-xs text-muted-foreground"), label),
					h.Span(h.Data("out", key), h.Class("font-mono text-xs break-all"), "—"))
			}
			return h.Div(h.Class("grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("sec-storage", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-end gap-3"),
						h.Label(h.Class("flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground"), "Password", secInput("pw", "password123", "Password to store")),
						field("iter", "PBKDF2 iterations", "×1000", 600, 1, 1200, 1),
					),
					h.Div(h.Class("rounded-lg border bg-code px-3"),
						row("plain", "Plain text"),
						row("sha", "SHA-256 (fast)"),
						row("salt", "Salt (16 random bytes)"),
						row("salted", "SHA-256(salt ‖ password)"),
						row("pbkdf2", "PBKDF2-HMAC-SHA-256"),
						row("time", "Time for one PBKDF2"),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"OWASP's Password Storage Cheat Sheet recommends PBKDF2-HMAC-SHA-256 with 600,000 iterations when Argon2id or scrypt are unavailable. Each guess costs an attacker the same time it cost you."),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					panelLabel("A leaked table"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"The attacker precomputed SHA-256 for 20 common passwords (a toy rainbow table). Look up each leaked row:"),
					h.Div(h.Data("leak", ""), h.Class("flex flex-col gap-1.5")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "crack"), hugeicons.Key01Icon(), "Run the lookup"),
					secVerdict("crack"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func secXSSBlock() Block {
	return Block{
		Slug:        "xss",
		Title:       "Cross-site scripting",
		Description: "A comment box rendered two ways. The vulnerable path inserts the comment as HTML, so markup in it becomes part of the page; here that path is only analysed in an inert document and drawn as a diagram, never run. The fixed path inserts text. Below: the policy this very page is served with.",
		Tags:        []string{"XSS", "escaping", "CSP"},
		Wide:        true,
		Render: func() h.Node {
			csp := secure.DefaultCSP("…per-request random…")
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("sec-xss", ""),
				h.Div(h.Class("flex flex-wrap items-end gap-2"),
					h.Label(h.Class("flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground"), "Comment",
						secInput("comment", `Nice post! <img src=x onerror="steal(document.cookie)">`, "Comment to render")),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([][2]string{{"img", "img onerror"}, {"script", "script tag"}, {"link", "javascript: link"}, {"plain", "harmless"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
						}),
					),
				),
				h.Div(h.Class("grid gap-3 md:grid-cols-2"),
					secPane("bad", "element.innerHTML = comment",
						h.P(h.Class("text-xs text-muted-foreground"), "What the browser would build (analysed inertly, not executed):"),
						h.Div(h.Data("tree", ""), h.Class("code scroll-thin max-h-56 overflow-auto rounded-md border bg-code p-2 text-[12px]")),
						secVerdict("bad"),
					),
					secPane("good", "element.textContent = comment",
						h.P(h.Class("text-xs text-muted-foreground"), "What the reader sees:"),
						h.Div(h.Data("safe", ""), h.Class("min-h-12 rounded-md border bg-code p-2 text-sm break-words")),
						h.P(h.Class("text-xs text-muted-foreground"), "Escaped HTML that reaches the page:"),
						h.Pre(h.Data("escaped", ""), h.Class("code scroll-thin overflow-x-auto rounded-md border bg-code p-2 text-[12px] whitespace-pre-wrap break-all")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"),
					h.Div(h.Class("flex items-center gap-2 text-xs font-medium"), hugeicons.Shield01Icon(h.Class("size-4 text-add")), "This page's Content-Security-Policy"),
					h.Pre(h.Class("code overflow-x-auto text-[12px] whitespace-pre-wrap break-all"), strings.ReplaceAll(csp, "; ", ";\n")),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"Even if markup slipped through, scripts need this request's nonce, and 'strict-dynamic' only trusts scripts loaded by already-trusted scripts; inline on* handlers are blocked. Defence in depth: escape first, CSP second."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func secSQLiBlock() Block {
	return Block{
		Slug:        "sql-injection",
		Title:       "SQL injection",
		Description: "A toy login against a three-row table, with a tiny SQL parser in the page. Concatenating input into the query lets a quote end the string and turn the rest into code; a parameterised query keeps the whole input a single literal, whatever it contains.",
		Tags:        []string{"injection", "parameterised queries", "parse tree"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("sec-sqli", ""),
				h.Div(h.Class("flex flex-wrap items-end gap-3"),
					h.Label(h.Class("flex min-w-44 flex-1 flex-col gap-1 text-xs text-muted-foreground"), "Username", secInput("user", "admin' --", "Username")),
					h.Label(h.Class("flex min-w-44 flex-1 flex-col gap-1 text-xs text-muted-foreground"), "Password", secInput("pass", "anything", "Password")),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([][2]string{{"comment", "admin' --"}, {"or", "' OR '1'='1"}, {"honest", "alice / wonderland"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p[0]), p[1])
						}),
					),
				),
				h.Div(h.Class("grid gap-3 lg:grid-cols-2"),
					secPane("bad", "String concatenation",
						h.Pre(h.Data("q-bad", ""), h.Class("code scroll-thin overflow-x-auto rounded-md border bg-code p-2 text-[12px] whitespace-pre-wrap break-all")),
						h.P(h.Class("text-xs text-muted-foreground"), "How the database parses it:"),
						h.Div(h.Data("tree-bad", ""), h.Class("code rounded-md border bg-code p-2 text-[12px]")),
						secVerdict("bad"),
					),
					secPane("good", "Parameterised query",
						h.Pre(h.Class("code overflow-x-auto rounded-md border bg-code p-2 text-[12px]"), "SELECT * FROM users\nWHERE name = ? AND password = ?"),
						h.Div(h.Data("params", ""), h.Class("code rounded-md border bg-code p-2 text-[12px]")),
						h.P(h.Class("text-xs text-muted-foreground"), "Parse tree (input bound as literals):"),
						h.Div(h.Data("tree-good", ""), h.Class("code rounded-md border bg-code p-2 text-[12px]")),
						secVerdict("good"),
					),
				),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					h.Table(h.Class("w-full min-w-[420px] text-xs"),
						h.Thead(h.Tr(h.Class("border-b text-left text-muted-foreground"),
							h.Th(h.Class("py-1.5 pr-3 font-normal"), "users.name"), h.Th(h.Class("py-1.5 pr-3 font-normal"), "users.password"), h.Th(h.Class("py-1.5 pr-3 font-normal"), "role"),
							h.Th(h.Class("py-1.5 pr-3 font-normal"), "concatenated"), h.Th(h.Class("py-1.5 font-normal"), "parameterised"))),
						h.Tbody(h.Data("rows", ""), h.Class("font-mono")),
					),
				),
				h.P(h.Class("text-xs text-muted-foreground"), "A real system would also store only password hashes (block 02); the plain column is kept here so the logic stays visible."),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func secCSRFBlock() Block {
	return Block{
		Slug:        "csrf",
		Title:       "Cross-site request forgery",
		Description: "evil.example tries to make your logged-in browser send a request to bank.example. Each defence is a switch; the timeline shows which layer stops which request. The token design mirrors this site's own libhtml/csrf middleware.",
		Tags:        []string{"CSRF", "SameSite", "tokens"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sec-csrf",
				h.Div(h.Class("flex flex-col gap-3"),
					segs("Forged request", [2]string{"form", "POST form"}, [2]string{"img", "GET <img>"}, [2]string{"fetch", "fetch()"}, [2]string{"nav", "GET link click"}),
					h.Ol(h.Data("steps", ""), h.Class("flex flex-col gap-1.5")),
					h.Div(h.Data("result", ""), h.Aria("live", "polite"), h.Class("rounded-lg border p-3 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Defences on bank.example"),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Span(h.Class("text-sm"), "Session cookie SameSite"),
						segs("SameSite", [2]string{"none", "None"}, [2]string{"lax", "Lax"}, [2]string{"strict", "Strict"}),
					),
					toggle("sec-csrf-origin", "origin", "Check Sec-Fetch-Site / Origin", false),
					toggle("sec-csrf-token", "token", "Require a CSRF token", false),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"libhtml/csrf layers Go's http.CrossOriginProtection (Sec-Fetch-Site, Origin) with an HMAC-signed secret in a __Host- cookie, echoed back masked with a fresh one-time pad on every render (against BREACH) and compared in constant time. SameSite=Lax is the browser default in Chromium."),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

type secComponent struct {
	key, name, kind string
	x, y            int
}

var secComponents = []secComponent{
	{"browser", "Browser", "external", 10, 95},
	{"web", "Web app", "process", 190, 30},
	{"db", "Database", "store", 310, 95},
	{"admin", "Admin panel", "process", 190, 160},
	{"pay", "Payment API", "external", 460, 95},
}

func secSTRIDEBlock() Block {
	return Block{
		Slug:        "stride",
		Title:       "Threat modelling with STRIDE",
		Description: "Pick an element of a small shop's data-flow diagram and walk Microsoft's STRIDE categories over it: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege. Each ticked threat proposes a mitigation; the model exports as Markdown.",
		Tags:        []string{"STRIDE", "data-flow diagram", "export"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("sec-stride", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-2"),
					h.Svg(h.Data("dfd", ""), h.ViewBox("0 0 590 240"), h.Class("block w-full rounded-lg border bg-code"), h.Role("group"), h.Aria("label", "Data-flow diagram"),
						// Trust boundary around the server side.
						h.El("rect", h.Attr("x", "172"), h.Attr("y", "12"), h.Attr("width", "270"), h.Attr("height", "216"), h.Attr("rx", "12"),
							h.Attr("fill", "none"), h.Attr("stroke", "var(--brand)"), h.Attr("stroke-dasharray", "6 5"), h.Attr("stroke-opacity", "0.6")),
						h.El("text", h.Attr("x", "436"), h.Attr("y", "222"), h.Attr("text-anchor", "end"), h.Class("fill-muted-foreground font-mono text-[10px]"), "trust boundary"),
						h.Map([][4]int{{130, 108, 188, 62}, {300, 76, 328, 94}, {250, 76, 250, 158}, {310, 46, 458, 104}}, func(l [4]int) h.Node {
							return h.El("line", h.Attr("x1", fmt.Sprint(l[0])), h.Attr("y1", fmt.Sprint(l[1])), h.Attr("x2", fmt.Sprint(l[2])), h.Attr("y2", fmt.Sprint(l[3])),
								h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.45"), h.Attr("marker-end", "url(#sec-arrow)"))
						}),
						h.El("defs", h.El("marker", h.ID("sec-arrow"), h.Attr("viewBox", "0 0 10 10"), h.Attr("refX", "9"), h.Attr("refY", "5"), h.Attr("markerWidth", "6"), h.Attr("markerHeight", "6"), h.Attr("orient", "auto-start-reverse"),
							h.El("path", h.Attr("d", "M0 0L10 5L0 10z"), h.Attr("fill", "currentColor"), h.Attr("fill-opacity", "0.6")))),
						h.Map(secComponents, func(c secComponent) h.Node {
							shape := h.El("rect", h.Attr("x", fmt.Sprint(c.x)), h.Attr("y", fmt.Sprint(c.y)), h.Attr("width", "120"), h.Attr("height", "46"),
								h.Attr("rx", h.Ternary(c.kind == "process", "23", "6")), h.Class("fill-background stroke-[var(--part)] transition-[stroke] duration-150"), h.Attr("stroke-width", "1.5"))
							return h.El("g", h.Data("comp", c.key), h.TabIndex(0), h.Role("button"), h.Aria("label", c.name),
								h.Class("cursor-pointer outline-none [--part:color-mix(in_oklab,var(--foreground)_45%,transparent)] data-[on]:[--part:var(--brand)] focus-visible:[--part:var(--brand)]"),
								shape,
								h.Iff(c.kind == "store", func() h.Node {
									return h.El("line", h.Attr("x1", fmt.Sprint(c.x+8)), h.Attr("y1", fmt.Sprint(c.y+12)), h.Attr("x2", fmt.Sprint(c.x+112)), h.Attr("y2", fmt.Sprint(c.y+12)),
										h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.3"))
								}),
								h.El("text", h.Attr("x", fmt.Sprint(c.x+60)), h.Attr("y", fmt.Sprint(c.y+28)), h.Attr("text-anchor", "middle"), h.Class("fill-foreground text-[12px]"), c.name),
								h.El("text", h.Data("count", c.key), h.Attr("x", fmt.Sprint(c.x+112)), h.Attr("y", fmt.Sprint(c.y-4)), h.Attr("text-anchor", "end"), h.Class("fill-brand font-mono text-[10px]")),
							)
						}),
					),
					h.P(h.Class("text-xs text-muted-foreground"), "Rounded: processes · square: external entities · lined: data store. Click or Tab + Enter."),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						h.Span(h.Data("out", "comp"), h.Class("text-sm font-medium"), "Web app"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "export"), hugeicons.Copy01Icon(), "Copy as Markdown"),
					),
					h.Div(h.Data("threats", ""), h.Class("flex flex-col gap-1.5")),
					h.P(h.Data("out", "total"), h.Class("text-xs text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func secAccessBlock() Block {
	return Block{
		Slug:        "access-control",
		Title:       "Access control: RBAC and ABAC",
		Description: "Two ways to answer \"may this user do this?\". Role-based access control looks up a role's permissions in a matrix you can edit; attribute-based access control evaluates rules over attributes of the user, the resource and the context. The checker explains which rule decided.",
		Tags:        []string{"RBAC", "ABAC", "least privilege"},
		Wide:        true,
		Render: func() h.Node {
			sel := func(name string, opts []string) h.Node {
				return h.Select(h.Data("in", name), h.Aria("label", name),
					h.Class("h-9 rounded-md border border-input bg-background px-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"),
					h.Map(opts, func(o string) h.Node { return h.Option(h.Value(o), o) }))
			}
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("sec-access", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Model", [2]string{"rbac", "RBAC"}, [2]string{"abac", "ABAC"}),
					h.Div(h.Class("flex flex-wrap items-center gap-2 text-sm"),
						sel("user", []string{"ana (editor, sales)", "ben (viewer, sales)", "chloé (editor, legal)", "dev (admin, it)"}),
						sel("action", []string{"read", "edit", "delete", "share"}),
						sel("doc", []string{"sales-report (sales, draft)", "contract (legal, final)", "roadmap (it, draft)"}),
						sel("hour", []string{"10:00", "22:00"}),
					),
				),
				h.Div(h.Data("view", "rbac"), h.Class("scroll-thin overflow-x-auto"),
					h.Table(h.Class("w-full min-w-[420px] text-sm"),
						h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
							h.Th(h.Class("py-2 pr-3 font-normal"), "Role"),
							h.Map([]string{"read", "edit", "delete", "share"}, func(a string) h.Node { return h.Th(h.Class("px-2 py-2 text-center font-normal"), a) }))),
						h.Tbody(h.Data("matrix", "")),
					),
				),
				h.Div(h.Data("view", "abac"), h.Hidden(), h.Class("flex flex-col gap-2"),
					h.Ol(h.Data("rules", ""), h.Class("flex flex-col gap-1.5 font-mono text-[12px]")),
				),
				h.Div(h.Data("decision", ""), h.Aria("live", "polite"), h.Class("rounded-lg border p-3 text-sm")),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func secPhishBlock() Block {
	return Block{
		Slug:        "phishing-url",
		Title:       "Reading a link",
		Description: "Where does a link really go? The browser's own URL parser splits it into scheme, credentials, host and path; the host is shown in the ASCII form the network uses, so look-alike Unicode letters surface as punycode. Then try the quiz. The brand here, examplebank.com, is fictional.",
		Tags:        []string{"URL parsing", "homographs", "quiz"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("sec-phish", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					secInput("url", "https://examplebank.com@login.examp1ebank.co/verify?id=42", "Link to inspect"),
					h.Div(h.Data("parts", ""), h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3 font-mono text-[12px]")),
					h.Ul(h.Data("flags", ""), h.Class("flex flex-col gap-1.5")),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					h.Div(h.Class("flex items-center justify-between gap-2"),
						panelLabel("Quiz"),
						h.Span(h.Data("out", "score"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "0 / 0"),
					),
					h.P(h.Data("q", ""), h.Class("min-h-10 font-mono text-[13px] break-all")),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("answer", "safe"), hugeicons.CheckmarkCircle02Icon(), "Goes to examplebank.com"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("answer", "phish"), hugeicons.Alert02Icon(), "Goes elsewhere"),
					),
					h.P(h.Data("out", "explain"), h.Aria("live", "polite"), h.Class("min-h-10 text-sm text-muted-foreground")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "inspect"), h.Class("self-start"), hugeicons.Link01Icon(), "Inspect this link"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func secOverflowBlock() Block {
	return Block{
		Slug:        "buffer-overflow",
		Title:       "Stack buffer overflow",
		Description: "A function copies input into an 8-byte buffer on the stack with no length check. Type past the end and the bytes run over the canary, the saved frame pointer and the return address. Switch the mitigations on to see what each one stops. Conceptual: a toy memory diagram, no real code runs.",
		Tags:        []string{"memory safety", "canary", "ASLR / NX"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sec-overflow",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Pre(h.Class("code overflow-x-auto rounded-md border bg-code p-2 text-[12px]"),
						h.Span(h.Class("tok-keyword"), "void"), " ", h.Span(h.Class("tok-function"), "greet"), "(", h.Span(h.Class("tok-keyword"), "const char"), " *name) {\n",
						"    ", h.Span(h.Class("tok-keyword"), "char"), " buf[8];\n",
						"    ", h.Span(h.Data("copy-line", ""), h.Class("rounded px-0.5"), "strcpy(buf, name);"), "   ", h.Span(h.Class("tok-comment"), "// no bound"), "\n",
						"}"),
					secInput("name", "AAAAAAAAAAAAAAAAAAAA", "Input copied into the buffer", h.Attr("maxlength", "40")),
					h.Div(h.Data("stack", ""), h.Class("flex flex-col gap-1 font-mono text-[12px]")),
					h.Div(h.Data("result", ""), h.Aria("live", "polite"), h.Class("rounded-lg border p-3 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Mitigations"),
					toggle("sec-ov-canary", "canary", "Stack canary", false),
					toggle("sec-ov-nx", "nx", "Non-executable stack (NX)", false),
					toggle("sec-ov-aslr", "aslr", "ASLR", false),
					toggle("sec-ov-bound", "bound", "Bounded copy (the fix)", false),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Mitigations raise the cost of exploitation; only bounds-checked code (or a memory-safe language) removes the bug. The stack grows down here, so the buffer sits below the saved registers it can overwrite."),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func secTOTPBlock() Block {
	return Block{
		Slug:        "totp",
		Title:       "One-time codes (TOTP)",
		Description: "How an authenticator app turns a shared secret and the clock into a 6-digit code: HMAC over the 30-second step counter, then RFC 4226's dynamic truncation. Computed live with Web Crypto, every intermediate shown, and checked against the RFC 6238 test vector.",
		Tags:        []string{"2FA", "HMAC", "RFC 6238"},
		Render: func() h.Node {
			step := func(key, label string) h.Node {
				return h.Div(h.Class("grid gap-1 border-b py-1.5 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)]"),
					h.Span(h.Class("text-xs text-muted-foreground"), label),
					h.Span(h.Data("out", key), h.Class("font-mono text-xs break-all"), "—"))
			}
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("sec-totp", ""),
				h.Label(h.Class("flex flex-col gap-1 text-xs text-muted-foreground"), "Shared secret (ASCII)", secInput("secret", "12345678901234567890", "Shared secret")),
				h.Div(h.Class("flex flex-wrap items-center gap-4"),
					h.Svg(h.ViewBox("0 0 44 44"), h.Class("size-12 -rotate-90"), h.Aria("hidden", "true"),
						h.El("circle", h.Attr("cx", "22"), h.Attr("cy", "22"), h.Attr("r", "18"), h.Attr("fill", "none"), h.Attr("stroke", "currentColor"), h.Attr("stroke-opacity", "0.1"), h.Attr("stroke-width", "4")),
						h.El("circle", h.Data("ring", ""), h.Attr("cx", "22"), h.Attr("cy", "22"), h.Attr("r", "18"), h.Attr("fill", "none"), h.Attr("stroke", "var(--brand)"), h.Attr("stroke-width", "4"), h.Attr("stroke-linecap", "round"), h.Attr("stroke-dasharray", "113.1 113.1")),
					),
					h.Div(h.Class("flex flex-col"),
						h.Span(h.Data("out", "code"), h.Class("font-mono text-3xl font-medium tracking-[0.2em] tabular-nums"), "——————"),
						h.Span(h.Data("out", "left"), h.Class("text-xs text-muted-foreground tabular-nums"), "—"),
					),
					h.Div(h.Class("ml-auto flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Digits"),
						segButton("6", "6 digits", true), segButton("8", "8 digits", false)),
				),
				h.Div(h.Class("rounded-lg border bg-code px-3"),
					step("t", "Unix time"), step("counter", "T = ⌊time / 30⌋"), step("hmac", "HMAC-SHA-1(secret, T)"),
					step("offset", "Offset (last nibble)"), step("bin", "31-bit integer"), step("mod", "mod 10^digits"),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-3 border-t pt-3"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "vector"), hugeicons.Tick02Icon(), "Check RFC 6238 vector"),
					h.Span(h.Data("out", "vector"), h.Aria("live", "polite"), h.Class("text-sm")),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					badge.Badge(badge.VariantOutline, h.Class("font-normal"), "RFC 4226 (HOTP)"),
					badge.Badge(badge.VariantOutline, h.Class("font-normal"), "RFC 6238 (TOTP)"),
					badge.Badge(badge.VariantOutline, h.Class("font-normal"), "secret stays in this page"),
				),
			)
		},
	}
}
