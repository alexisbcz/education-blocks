package site

import (
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/textarea"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LawBlocks lists the law blocks in display order. They teach how lawyers
// reason, not what the law of any one place says today: every block names
// the jurisdiction it draws on and none of it is legal advice. Argument
// structure in general lives in /argumentation, Bayes' rule in odds form in
// its belief updater, and the legislative process in /politics.
func LawBlocks() []Block {
	return []Block{
		lawIRACBlock(),
		lawElementsBlock(),
		lawPrecedentBlock(),
		lawInterpretBlock(),
		lawProofBlock(),
		lawHandBlock(),
		lawLimitationBlock(),
		lawClauseBlock(),
		lawSystemsBlock(),
		lawCitationBlock(),
	}
}

// lawInputClass is the shadcn input look, at 16px on phones (no iOS zoom).
const lawInputClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

// lawNote is the footer every block carries: which law it draws on, and
// that it is teaching material.
func lawNote(jurisdiction string, text ...any) h.Node {
	return h.P(h.Class("flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"),
		hugeicons.InformationCircleIcon(h.Class("mt-px size-3.5 shrink-0")),
		h.Span(append([]any{h.Span(h.Class("font-medium text-foreground"), jurisdiction), " · Educational, not legal advice. "}, text...)...),
	)
}

func lawLabeled(lbl string, control h.Node) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5 text-sm"), h.Span(h.Class("text-muted-foreground"), lbl), control)
}

func lawCopy(label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("copy", ""), h.Data("law-copy", ""),
		h.Class("relative"),
		hugeicons.Copy01Icon(h.Class("transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-50 [[data-copied]_&]:opacity-0")),
		hugeicons.Tick02Icon(h.Class("absolute left-2.5 scale-50 opacity-0 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-100 [[data-copied]_&]:opacity-100")),
		label)
}

// lawSegs is a segmented control the module tells apart by name.
func lawSegs(name, label string, opts ...[2]string) h.Node {
	return h.Div(h.Data("law-seg", name), segs(label, opts...))
}

// ---------------------------------------------------------------- L1

func lawIRACBlock() Block {
	card := func(key, title, hint, placeholder string) h.Node {
		return h.Div(h.Data("law-i-card", key),
			h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs transition-[border-color] duration-150 has-focus-visible:border-ring data-[empty]:border-dashed"),
			h.Div(h.Class("flex items-baseline justify-between gap-2"),
				h.Span(h.Class("font-mono text-[11px] font-medium tracking-wider uppercase"), title),
				h.Span(h.Class("text-xs text-muted-foreground"), hint)),
			textarea.Textarea(h.Data("law-field", key), h.Placeholder(placeholder), h.Aria("label", title),
				h.Class("min-h-16 resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 dark:bg-transparent")),
		)
	}
	return Block{
		Slug:        "irac",
		Title:       "IRAC brief builder",
		Description: "The way law students are taught to answer a problem question: name the Issue, state the Rule with its authority, Apply the rule to these facts (the part that earns the marks), and Conclude. CREAC, common in US legal writing, opens with the conclusion and adds an Explanation of how courts have applied the rule. Switch formats; the text is kept and re-ordered.",
		Tags:        []string{"IRAC", "CREAC", "Markdown"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("law-irac", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3 rounded-xl border bg-code p-3 sm:p-4"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						lawSegs("format", "Format", [2]string{"irac", "IRAC"}, [2]string{"creac", "CREAC"}),
						lawSegs("example", "Example", [2]string{"smoke", "Smoke ball"}, [2]string{"blank", "Blank"}),
						h.Div(h.Class("flex-1")),
						lawCopy("Copy as Markdown"),
					),
					h.Div(h.Data("law-i-cards", ""), h.Class("flex flex-col gap-3"),
						card("issue", "Issue", "a question", "Whether…"),
						card("rule", "Rule", "with authority", "The rule, and the case or statute it comes from."),
						card("explanation", "Explanation", "CREAC only", "How courts have applied the rule: facts and outcome of the leading case."),
						card("application", "Application", "fact by fact", "Here, … because …"),
						card("conclusion", "Conclusion", "answer the issue", "Therefore…"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					panelLabel("Checklist"),
					h.Ul(h.Data("law-i-checks", ""), h.Class("flex flex-col gap-2 text-sm")),
					h.Div(h.Class("flex flex-col gap-1.5 border-t pt-3"),
						panelLabel("Markdown"),
						h.Pre(h.Data("law-i-md", ""), h.Class("max-h-64 overflow-auto rounded-md border bg-code p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-code-foreground")),
					),
					lawNote("England & Wales", "The example follows Carlill v Carbolic Smoke Ball Co [1893] 1 QB 256 (CA); the facts are changed slightly."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L2

func lawElementsBlock() Block {
	return Block{
		Slug:        "elements",
		Title:       "Element by element",
		Description: "A claim succeeds only if every element is made out, so the answer to a problem is a checklist, not an impression. Pick a cause of action and a set of facts from a real case; each element shows the authority for it and whether these facts satisfy it. The first unmet element ends the claim. Flip any element to see what would change.",
		Tags:        []string{"negligence", "contract formation", "checklist"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("law-elements", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					lawSegs("doctrine", "Cause of action", [2]string{"negligence", "Negligence"}, [2]string{"contract", "Contract formation"}),
					h.Div(h.Data("law-e-facts", ""), h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("radiogroup"), h.Aria("label", "Facts")),
				),
				h.Div(h.Data("law-e-story", ""), h.Class("rounded-lg border bg-code p-3 text-sm leading-relaxed"), h.Aria("live", "polite")),
				h.Ol(h.Data("law-e-list", ""), h.Class("flex flex-col gap-2")),
				h.Div(h.Data("law-e-verdict", ""), h.Class("flex flex-col items-start gap-1 rounded-lg border p-3 text-sm transition-[border-color] duration-200 data-[ok]:border-brand"), h.Aria("live", "polite")),
				lawNote("England & Wales (common law)", "Defences (consent, contributory negligence, illegality) and remedies are not modelled. Breach and causation are questions of fact for the court; the toggles only show the structure."),
			)
		},
	}
}

// ---------------------------------------------------------------- L3

func lawPrecedentBlock() Block {
	return Block{
		Slug:        "precedent",
		Title:       "Who binds whom",
		Description: "Stare decisis: a court must follow the decisions of courts above it in its own hierarchy, and sometimes its own. Everything else (other branches, other countries, lower courts) is at most persuasive. Pick the court deciding the new case; every other court's earlier decision is marked binding, persuasive or a matter of practice, with the reason.",
		Tags:        []string{"stare decisis", "hierarchy", "UK", "US"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"), h.Data("law-precedent", ""),
				h.Div(h.Class("flex flex-col gap-3"),
					lawSegs("system", "Jurisdiction", [2]string{"ew", "England & Wales"}, [2]string{"us", "US federal"}),
					panelLabel("Court deciding the case"),
					h.Div(h.Data("law-p-courts", ""), h.Class("flex flex-col gap-1.5"), h.Role("radiogroup"), h.Aria("label", "Court deciding the case")),
					h.Div(h.Class("flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-brand")), "binding"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-vec-u")), "binding by practice"),
						h.Span(h.Class("flex items-center gap-1.5"), h.Span(h.Class("size-2 rounded-full bg-foreground/30")), "persuasive"),
					),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					h.Ol(h.Data("law-p-ladder", ""), h.Class("flex flex-col gap-1.5 rounded-xl border bg-code p-3"), h.Aria("live", "polite")),
					lawNote("England & Wales; US federal courts", "Simplified: divisions of the Court of Appeal, retained EU case law, the Privy Council's Willers v Joyce [2016] UKSC 44 direction and state-court hierarchies have more detail than shown."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L4

func lawInterpretBlock() Block {
	canon := func(name, rule, source string) h.Node {
		return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-3"),
			h.Span(h.Class("text-sm font-medium"), name),
			h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), rule),
			h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), source),
		)
	}
	return Block{
		Slug:        "interpretation",
		Title:       "No vehicles in the park",
		Description: "H. L. A. Hart's example (71 Harv. L. Rev. 593, 1958): a rule forbids vehicles in a public park. A car is clearly caught; what about a bicycle, a toy car, an ambulance? Lon Fuller's reply in the same volume (p. 630) asked about a war-memorial truck put on a plinth. Change the wording and the approach to interpretation and watch the verdicts move. Each verdict is one defensible reading, not the answer.",
		Tags:        []string{"Hart–Fuller", "canons", "statutory interpretation"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("law-interpret", ""),
				h.Div(h.Class("flex flex-col gap-2 rounded-xl border bg-code p-3 sm:p-4"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						panelLabel("Wording"),
						lawSegs("wording", "Wording", [2]string{"plain", "General"}, [2]string{"list", "List + general words"}, [2]string{"only", "Closed list"}),
					),
					h.Blockquote(h.Data("law-n-text", ""), h.Class("border-l-2 border-brand pl-3 font-serif text-lg")),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						panelLabel("Approach"),
						lawSegs("approach", "Approach", [2]string{"literal", "Literal"}, [2]string{"golden", "Golden"}, [2]string{"purposive", "Purposive"}),
					),
					h.P(h.Data("law-n-approach", ""), h.Class("text-sm text-muted-foreground")),
				),
				h.Ul(h.Data("law-n-items", ""), h.Class("grid gap-2 sm:grid-cols-2 lg:grid-cols-4")),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2 lg:grid-cols-4"),
					canon("Literal rule", "Words take their ordinary meaning, even if the result is harsh.", "Whiteley v Chappell (1868) LR 4 QB 147"),
					canon("Golden rule", "Ordinary meaning, unless it leads to an absurdity the drafters cannot have meant.", "Grey v Pearson (1857) 6 HL Cas 61"),
					canon("Mischief rule", "Ask what mischief the law set out to remedy, and read it to suppress that mischief.", "Heydon's Case (1584) 3 Co Rep 7a"),
					canon("Ejusdem generis", "General words after a list of specific ones cover only things of the same kind.", "Powell v Kempton Park Racecourse [1899] AC 143"),
				),
				lawNote("England & Wales, with Hart and Fuller's US debate", "Modern English courts speak of a single purposive, contextual approach (e.g. R (Quintavalle) v Secretary of State for Health [2003] UKHL 13) rather than three rival rules; the three are kept apart here to show how the choice moves the outcome."),
			)
		},
	}
}

// ---------------------------------------------------------------- L5

func lawProofBlock() Block {
	return Block{
		Slug:        "proof",
		Title:       "Standards of proof",
		Description: "Who must prove what, and how sure the fact-finder must be. Civil claims are decided on the balance of probabilities (more likely than not); some US civil matters need clear and convincing evidence; criminal guilt must be proved beyond reasonable doubt (in England, so that the jury is sure). Add evidence to move the probability; the cost slider shows the decision-theory reading of where a threshold should sit.",
		Tags:        []string{"burden", "Bayes", "thresholds"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("law-proof",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 200"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Probability of the fact on a scale from 0 to 1, with the thresholds")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Before the evidence"),
					field("prior", "Prior", "%", 20, 1, 99, 1),
				),
				h.Div(h.Data("law-r-evidence", ""), h.Class("flex flex-col gap-2"), panelLabel("Evidence (likelihood ratio)"),
					toggle("law-r-e1", "e1", "Eyewitness identification ×4", true),
					toggle("law-r-e2", "e2", "Motive ×2", true),
					toggle("law-r-e3", "e3", "Fingerprint at the scene ×50", false),
					toggle("law-r-e4", "e4", "Corroborated alibi ×0.2", false),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Errors"),
					field("ratio", "Wrongful conviction costs", "× acquittal", 10, 1, 100, 1),
				),
				readouts([2]string{"P(fact | evidence)", "post"}, [2]string{"civil", "civil"}, [2]string{"clear & convincing", "cc"}, [2]string{"criminal", "crim"}, [2]string{"cost threshold", "thr"}),
				lawNote("England & Wales; US", "Courts refuse to put numbers on these standards; the 75% and 90% marks are illustrative, near the averages judges gave in McCauliff's survey (35 Vand. L. Rev. 1293, 1982). The likelihood ratios are invented. For Bayes' rule itself, see the belief updater in Argumentation."),
			)
		},
	}
}

// ---------------------------------------------------------------- L6

func lawHandBlock() Block {
	return Block{
		Slug:        "hand-formula",
		Title:       "The Hand formula",
		Description: "Judge Learned Hand in United States v. Carroll Towing Co., 159 F.2d 169, 173 (2d Cir. 1947): a party is negligent if the burden of precaution B is less than the probability of harm P times the gravity of the loss L. Drag the point or set the numbers; above the line P·L = B, failing to take the precaution is negligent.",
		Tags:        []string{"B < PL", "law and economics", "negligence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("law-hand",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 330"), h.Class("mx-auto block w-full max-w-[640px] touch-none select-none"), h.Role("img"), h.Aria("label", "Probability against loss, log scales, with the negligence boundary")),
				lawSegs("preset", "Scenario", [2]string{"barge", "Unattended barge"}, [2]string{"cricket", "Cricket ball"}, [2]string{"custom", "Custom"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Numbers (illustrative)"),
					field("B", "Burden B", "$", 50, 1, 100000, 1),
					field("P", "Probability P", "%", 10, 0.01, 100, 0.01),
					field("L", "Loss L", "$", 2000, 1, 1000000, 1),
				),
				readouts([2]string{"P · L", "pl"}, [2]string{"B", "b"}, [2]string{"B / PL", "ratio"}, [2]string{"verdict", "verdict"}),
				lawNote("US (2d Cir.); compare England & Wales", "Hand put no numbers on Carroll Towing; these are invented. English courts weigh the same factors without a formula: in Bolton v Stone [1951] AC 850 (HL) a cricket ball leaving the ground was so unlikely that the club was not negligent."),
			)
		},
	}
}

// ---------------------------------------------------------------- L7

func lawLimitationBlock() Block {
	return Block{
		Slug:        "limitation",
		Title:       "Limitation periods",
		Description: "A claim brought too late can be struck out however good it is. Pick a claim, the date the cause of action accrued (when the breach or the damage happened) and, for personal injury, the date the claimant knew; the timeline shows the last day to issue. Under-18s: time runs from the 18th birthday.",
		Tags:        []string{"Limitation Act 1980", "dates", "timeline"},
		Wide:        true,
		Render: func() h.Node {
			sel := h.Select(h.Data("law-l-claim", ""), h.Class(lawInputClass),
				h.Option(h.Value("contract"), "Simple contract: 6 years (s 5)"),
				h.Option(h.Value("tort"), "Tort, not personal injury: 6 years (s 2)"),
				h.Option(h.Value("pi"), "Personal injury: 3 years (ss 11, 14)"),
				h.Option(h.Value("deed"), "Deed (specialty): 12 years (s 8)"),
				h.Option(h.Value("defamation"), "Defamation: 1 year (s 4A)"),
			)
			date := func(name string) h.Node {
				return h.Input(h.Type("date"), h.Data("law-l-date", name), h.Class(lawInputClass+" font-mono"))
			}
			return plotPanel("law-limitation",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 160"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "Timeline from accrual to the last day to issue")),
					h.P(h.Data("law-l-summary", ""), h.Class("px-1 text-sm leading-relaxed"), h.Aria("live", "polite")),
				),
				lawLabeled("Claim", sel),
				lawLabeled("Cause of action accrued", date("accrual")),
				h.Div(h.Data("law-l-pi", ""), h.Hidden(), lawLabeled("Date of knowledge (s 14)", date("knowledge"))),
				toggle("law-l-minor", "minor", "Claimant was under 18", false),
				h.Div(h.Data("law-l-dob", ""), h.Hidden(), lawLabeled("Date of birth", date("dob"))),
				readouts([2]string{"runs from", "from"}, [2]string{"period", "period"}, [2]string{"last day", "last"}, [2]string{"days left", "left"}),
				lawNote("England & Wales, Limitation Act 1980", "Illustrative only. Not modelled: the court's discretion (ss 32A, 33), fraud and concealment (s 32), latent damage (s 14A), the long-stop dates, and procedural rules on when a claim counts as brought. The day of accrual is not counted; 29 February rolls to 1 March."),
			)
		},
	}
}

// ---------------------------------------------------------------- L8

func lawClauseBlock() Block {
	return Block{
		Slug:        "clause",
		Title:       "Contract clause annotator",
		Description: "Drafters signal legal effect with a small vocabulary: shall for a duty, may for a permission, shall not for a prohibition, if, unless and provided that for conditions. Paste a clause and the annotator marks them, with parties, defined terms, time limits and termination, and flags vague words worth a second look. A highlighter for reading, not an interpretation.",
		Tags:        []string{"drafting", "heuristic", "highlighter"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-2"), h.Data("law-clause", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						panelLabel("Clause"),
						h.Div(h.Class("flex-1")),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("law-c-reset", ""), hugeicons.RefreshIcon(), "Sample"),
					),
					textarea.Textarea(h.Data("law-c-input", ""), h.Aria("label", "Contract text"), h.Attr("spellcheck", "false"),
						h.Class("min-h-72 resize-y bg-background font-mono text-xs leading-relaxed")),
				),
				h.Div(h.Class("flex min-w-0 flex-col gap-2"),
					h.Div(h.Data("law-c-legend", ""), h.Class("flex flex-wrap gap-1.5")),
					h.Div(h.Data("law-c-out", ""), h.Class("min-h-72 rounded-lg border bg-code p-3 text-sm leading-7 whitespace-pre-wrap")),
					h.Ul(h.Data("law-c-flags", ""), h.Class("flex flex-col gap-1 text-xs text-muted-foreground")),
				),
				h.Div(h.Class("lg:col-span-2"), lawNote("Common-law drafting conventions", "Word lists, not a parser: \"shall\" used for the future tense, or an obligation phrased as \"will\", is marked as it is written. Courts read a contract as a whole, in context.")),
			)
		},
	}
}

// ---------------------------------------------------------------- L9

func lawSystemsBlock() Block {
	return Block{
		Slug:        "legal-systems",
		Title:       "Legal systems compared",
		Description: "Most of the world's legal systems descend from two traditions: common law, built up by judges deciding cases, and civil law, organised around codes. Many mix them, and religious and customary law govern parts of life in many countries. Filter by tradition and sort any column.",
		Tags:        []string{"comparative law", "sortable table", "codes"},
		Wide:        true,
		Render: func() h.Node {
			th := func(key, label string) h.Node {
				return h.Th(h.Data("law-s-col", key), h.Attr("aria-sort", "none"), h.Class("px-3 py-2 text-left font-medium"),
					h.Button(h.Type("button"), h.Class("inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [[aria-sort=ascending]_&]:text-foreground [[aria-sort=descending]_&]:text-foreground"),
						label, hugeicons.ArrowUpDownIcon(h.Class("size-3.5")),
					),
				)
			}
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("law-systems", ""),
				lawSegs("tradition", "Tradition", [2]string{"all", "All"}, [2]string{"common", "Common law"}, [2]string{"civil", "Civil law"}, [2]string{"mixed", "Mixed"}, [2]string{"religious", "Religious"}),
				h.Div(h.Class("overflow-x-auto rounded-xl border"),
					h.Table(h.Class("w-full min-w-[680px] text-sm"),
						h.Thead(h.Class("border-b bg-code"), h.Tr(
							th("place", "Jurisdiction"), th("tradition", "Tradition"), th("code", "Civil code"), th("year", "Year"), th("court", "Highest court (private law)"),
						)),
						h.Tbody(h.Data("law-s-body", ""), h.Class("divide-y")),
					),
				),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2 lg:grid-cols-4"),
					lawTraditionCard("Common law", "Judges' decisions are a source of law; precedent binds. Trials are adversarial: the parties lead the evidence.", "England, from the 12th century"),
					lawTraditionCard("Civil law", "Codes and statutes are the primary source; case law guides (jurisprudence constante) but formally binds less. Judges take a larger part in investigating.", "Roman law; the French Code civil, 1804"),
					lawTraditionCard("Mixed", "Civil-law private law with common-law procedure and precedent, often after a change of colonial power.", "Scotland, Louisiana, Québec, South Africa"),
					lawTraditionCard("Religious and customary", "Islamic, Jewish, Hindu or customary law governs family and personal status in many states, alongside state courts.", "e.g. South African Constitution s 211"),
				),
				lawNote("Comparative overview", "Labels simplify: most systems mix sources, and \"civil code\" lists the main private-law code only. Years are of enactment."),
			)
		},
	}
}

func lawTraditionCard(title, body, origin string) h.Node {
	return h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-background p-3"),
		h.Div(h.Class("flex items-center gap-2"), hugeicons.JusticeScale01Icon(h.Class("size-4 text-muted-foreground")), h.Span(h.Class("text-sm font-medium"), title)),
		h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), body),
		badge.Badge(badge.VariantOutline, h.Class("self-start font-normal text-muted-foreground"), origin),
	)
}

// ---------------------------------------------------------------- L10

func lawCitationBlock() Block {
	in := func(name, lbl, placeholder string) h.Node {
		return lawLabeled(lbl, h.Input(h.Type("text"), h.Data("law-t-in", name), h.Placeholder(placeholder), h.Attr("autocomplete", "off"), h.Class(lawInputClass)))
	}
	out := func(name, lbl string) h.Node {
		return h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-background p-3"),
			h.Div(h.Class("flex items-center justify-between gap-2"),
				panelLabel(lbl),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("copy", ""), h.Data("law-t-copy", name), h.Class("relative"),
					hugeicons.Copy01Icon(h.Class("transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-50 [[data-copied]_&]:opacity-0")),
					hugeicons.Tick02Icon(h.Class("absolute left-2.5 scale-50 opacity-0 transition-[opacity,scale] duration-150 [[data-copied]_&]:scale-100 [[data-copied]_&]:opacity-100")),
					"Copy"),
			),
			h.P(h.Data("law-t-out", name), h.Class("font-serif text-base leading-relaxed")),
			h.Ul(h.Data("law-t-why", name), h.Class("flex list-disc flex-col gap-0.5 pl-4 text-xs text-muted-foreground")),
		)
	}
	return Block{
		Slug:        "citation",
		Title:       "Case citation formatter",
		Description: "The same case cited in the two styles students meet most: the Bluebook (US) and OSCOLA (UK). Pick a landmark case or type your own; the parts are named so you can see which rule placed each one. Italics, brackets and punctuation follow simplified versions of each guide.",
		Tags:        []string{"Bluebook", "OSCOLA", "references"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("law-citation", ""),
				lawSegs("case", "Case", [2]string{"donoghue", "Donoghue v Stevenson"}, [2]string{"carlill", "Carlill"}, [2]string{"marbury", "Marbury v. Madison"}, [2]string{"brown", "Brown v. Board"}, [2]string{"miller", "Miller (2017)"}),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Div(h.Class("grid grid-cols-2 gap-3 rounded-xl border bg-code p-3 sm:p-4"),
						h.Div(h.Class("col-span-2"), in("parties", "Parties (A v B)", "Donoghue v Stevenson")),
						in("year", "Year", "1932"),
						in("volume", "Volume", "(blank if none)"),
						in("reporter", "Report series", "AC"),
						in("page", "First page", "562"),
						in("pin", "Pinpoint", "580"),
						in("court", "Court", "HL"),
						h.Div(h.Class("col-span-2"), in("neutral", "Neutral citation (UK, 2001 on)", "[2017] UKSC 5")),
						h.Div(h.Class("col-span-2 flex items-center justify-between gap-3"),
							h.Span(h.Class("text-sm text-muted-foreground"), "Year identifies the volume (square brackets)"),
							h.Input(h.Type("checkbox"), h.Data("law-t-in", "square"), h.Class("size-4 accent-[var(--brand)]"), h.Aria("label", "Year in square brackets")),
						),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						out("bluebook", "Bluebook (21st ed., simplified)"),
						out("oscola", "OSCOLA (4th ed., simplified)"),
					),
				),
				lawNote("US and UK citation guides", "Simplified: the Bluebook adds court and jurisdiction rules for foreign cases, parallel citations and short forms; OSCOLA prefers the most authoritative report series. Check the guide your school or court requires."),
			)
		},
	}
}
