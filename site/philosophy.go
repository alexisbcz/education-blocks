package site

import (
	"encoding/json"
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// PhilosophyBlocks lists the philosophy gallery. Setups of thought
// experiments are paraphrased; only short quotations we are sure of are
// given verbatim, with their reference.
func PhilosophyBlocks() []Block {
	return []Block{
		philoArgumentBlock(),
		philoThoughtBlock(),
		philoEthicsBlock(),
		philoLineageBlock(),
		philoFallacyBlock(),
		philoZenoBlock(),
		philoSourceBlock(),
	}
}

// ---------------------------------------------------------------- F1

type philoArg struct {
	key, name, form string
	valid           bool
	premises        []string
	conclusion      string
	note            string
}

var philoArgs = []philoArg{
	{"socrates", "Socrates", "All H are M. s is H. So s is M.", true,
		[]string{"All humans are mortal.", "Socrates is a human."}, "Socrates is mortal.",
		"The textbook valid syllogism: if both premises are true, the conclusion cannot be false."},
	{"kalam", "Kalām cosmological", "Everything that begins to exist has a cause. U began to exist. So U has a cause.", true,
		[]string{"Whatever begins to exist has a cause.", "The universe began to exist."}, "The universe has a cause.",
		"Defended by William Lane Craig (1979), after medieval Islamic theologians. The form is valid; the debate is entirely about whether the premises are true."},
	{"penguins", "Flying penguins", "All B can F. p is B. So p can F.", true,
		[]string{"All birds can fly.", "Penguins are birds."}, "Penguins can fly.",
		"Valid but unsound: the form is fine, the first premise is false, and so is the conclusion."},
	{"cats", "Cats and dogs", "All C are M. All D are M. So all C are D.", false,
		[]string{"All cats are mammals.", "All dogs are mammals."}, "All cats are dogs.",
		"Invalid (undistributed middle): sharing a property doesn't make two groups the same. Counterexample: true premises, false conclusion."},
}

func philoArgumentBlock() Block {
	return Block{
		Slug:        "argument",
		Title:       "Argument map",
		Description: "Validity and soundness, kept apart. Validity is about form: could the premises be true and the conclusion false? Soundness adds that the premises are actually true. Mark what you believe about each premise and the map tells you what follows.",
		Tags:        []string{"validity", "soundness", "map"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("philo-arg", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
					segs("Argument", func() [][2]string {
						var o [][2]string
						for _, a := range philoArgs {
							o = append(o, [2]string{a.key, a.name})
						}
						return o
					}()...),
				),
				h.Map(philoArgs, func(a philoArg) h.Node {
					return h.Div(h.Data("view", a.key), h.If(a.key != philoArgs[0].key, h.Hidden()), h.Data("valid", fmt.Sprint(a.valid)),
						h.Class("flex flex-col gap-3"),
						h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
							h.MapIdx(a.premises, func(i int, p string) h.Node {
								return h.Div(h.Data("premise", ""), h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3 data-[belief=false]:border-del/50 data-[belief=true]:border-add/50"),
									h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), fmt.Sprintf("Premise %d", i+1)),
									h.P(h.Class("text-sm"), p),
									h.Div(h.Class("flex gap-1"), h.Role("group"), h.Aria("label", "Do you accept this premise?"),
										h.Map([][2]string{{"true", "True"}, {"unsure", "Unsure"}, {"false", "False"}}, func(o [2]string) h.Node {
											return h.Button(h.Type("button"), h.Data("belief", o[0]), h.Aria("pressed", fmt.Sprint(o[0] == "unsure")),
												h.Class("rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-ring aria-pressed:text-foreground"), o[1])
										}),
									),
								)
							}),
						),
						h.Div(h.Class("flex justify-center text-muted-foreground"), hugeicons.ArrowDown01Icon(h.Class("size-5"))),
						h.Div(h.Class("rounded-lg border-2 border-dashed bg-background p-3 text-center"),
							h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "Conclusion"),
							h.P(h.Class("text-base font-medium"), a.conclusion),
						),
						h.Div(h.Class("flex flex-wrap items-center gap-2 text-xs"),
							badge.Badge(badge.VariantOutline, h.Class("font-normal "+h.Ternary(a.valid, "text-add", "text-del")), h.Ternary(a.valid, "Valid form", "Invalid form")),
							h.Span(h.Class("font-mono text-muted-foreground"), a.form),
						),
						h.P(h.Data("verdict", ""), h.Aria("live", "polite"), h.Class("rounded-lg border bg-code p-3 text-sm leading-relaxed")),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), a.note),
					)
				}),
			)
		},
	}
}

// ---------------------------------------------------------------- F2

type philoTE struct {
	key, name, source, setup, question string
	options                            []string
	positions                          [][2]string
}

var philoTEs = []philoTE{
	{"trolley", "Trolley", "Philippa Foot (1967); named and extended by Judith Jarvis Thomson (1976, 1985)",
		"A runaway trolley will kill five people on the track ahead. You can pull a lever to send it onto a side track, where it will kill one person instead.",
		"Do you pull the lever?", []string{"Pull the lever", "Don't pull it"},
		[][2]string{
			{"Consequentialism", "Pull: one death is better than five. The same reasoning says you should also push a large stranger off a footbridge to stop the trolley, Thomson's variant."},
			{"Doctrine of double effect", "Pulling is permitted: the one death is a foreseen side effect, not your means. Pushing is not: there the person is used as the means."},
			{"Doing vs allowing", "Some hold that killing the one is worse than letting the five die, so not pulling is permissible."},
		}},
	{"theseus", "Ship of Theseus", "Plutarch, Life of Theseus (c. 100 CE); Hobbes added the rebuilt-planks twist in De Corpore (1655)",
		"The ship of Theseus is preserved by replacing each rotten plank with a new one, until no original plank is left. Someone collects the old planks and rebuilds a ship from them.",
		"Which one is the ship of Theseus?", []string{"The repaired ship", "The rebuilt ship", "Neither, or it depends"},
		[][2]string{
			{"Continuity", "The repaired ship: identity follows an unbroken history of gradual change."},
			{"Same matter", "The rebuilt ship: identity goes with the original material."},
			{"Conventionalism", "There is no deeper fact: \"same ship\" depends on what we care about (ownership, history, material)."},
		}},
	{"chinese-room", "Chinese room", "John Searle, \"Minds, Brains, and Programs\", Behavioral and Brain Sciences (1980)",
		"Someone who knows no Chinese sits in a room with a rulebook for manipulating Chinese symbols. Questions in Chinese come in; by following the rules, they pass out answers fluent enough to fool native speakers.",
		"Does anyone, or anything, in the room understand Chinese?", []string{"Yes", "No"},
		[][2]string{
			{"Searle", "No: running a program is manipulating symbols by their shape (syntax), and syntax alone is not enough for meaning (semantics)."},
			{"Systems reply", "The person doesn't understand, but the whole system (person, rules, papers) does."},
			{"Robot reply", "Connect the symbols to the world through sensors and actions and understanding could arise."},
		}},
	{"mary", "Mary's room", "Frank Jackson, \"Epiphenomenal Qualia\", Philosophical Quarterly (1982)",
		"Mary is a scientist who knows every physical fact about colour vision, but has lived all her life in a black-and-white room. One day she walks out and sees a red tomato.",
		"Does she learn something new?", []string{"Yes", "No"},
		[][2]string{
			{"Jackson (1982)", "Yes: she learns what seeing red is like, so not every fact is physical. Jackson himself later rejected this conclusion and became a physicalist."},
			{"Ability hypothesis", "She gains abilities (to recognise and imagine red), not a new fact (Lewis, Nemirow)."},
			{"New mode, old fact", "She learns an old physical fact in a new way, through experience."},
		}},
	{"experience-machine", "Experience machine", "Robert Nozick, Anarchy, State, and Utopia (1974)",
		"Neuroscientists can plug you into a machine that gives you any experiences you want, indistinguishable from real life, for the rest of your life. You would not know you were plugged in.",
		"Would you plug in?", []string{"Plug in", "Stay out"},
		[][2]string{
			{"Nozick", "Most people refuse, which suggests we care about more than how our lives feel from inside: doing things, being a certain person, contact with reality. A problem for hedonism."},
			{"Status quo bias", "When asked whether to unplug from a machine you're already in, many people choose to stay, so the intuition may reflect attachment to the present (De Brigard 2010)."},
		}},
	{"veil", "Veil of ignorance", "John Rawls, A Theory of Justice (1971); John Harsanyi argued for a version earlier (1953, 1955)",
		"You will choose the rules of a society without knowing who you will be in it: your talents, class, health or beliefs.",
		"Which rule do you choose?", []string{"Make the worst-off as well off as possible", "Maximise the average", "Make everyone equal"},
		[][2]string{
			{"Rawls", "Maximin: under such deep uncertainty, choose to make the worst position as good as possible. This supports his difference principle."},
			{"Harsanyi", "Maximise expected (average) welfare: treat each position as equally likely to be yours."},
		}},
}

func philoThoughtBlock() Block {
	return Block{
		Slug:        "thought-experiments",
		Title:       "Thought experiments",
		Description: "Answer first, then see where the main positions land and who argued what. Setups are paraphrased from the cited sources; your answers stay in this page.",
		Tags:        []string{"vote", "positions", "sources"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("philo-te", ""),
				h.Div(h.Class("scroll-thin overflow-x-auto"),
					segs("Thought experiment", func() [][2]string {
						var o [][2]string
						for _, t := range philoTEs {
							o = append(o, [2]string{t.key, t.name})
						}
						return o
					}()...),
				),
				h.Map(philoTEs, func(t philoTE) h.Node {
					return h.Article(h.Data("view", t.key), h.If(t.key != philoTEs[0].key, h.Hidden()),
						h.Class("flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-xs"),
						h.P(h.Class("font-mono text-[11px] text-muted-foreground"), t.source),
						h.P(h.Class("text-[15px] leading-relaxed"), t.setup),
						h.P(h.Class("font-medium"), t.question),
						h.Div(h.Class("flex flex-wrap gap-2"),
							h.Map(t.options, func(o string) h.Node {
								return h.Button(h.Type("button"), h.Data("vote", o),
									h.Class("rounded-lg border bg-background px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] duration-150 outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-ring data-[on]:ring-[3px] data-[on]:ring-ring/50"), o)
							}),
						),
						h.Div(h.Data("positions", ""), h.Hidden(), h.Class("enter grid gap-2 sm:grid-cols-2"),
							h.Map(t.positions, func(p [2]string) h.Node {
								return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3"),
									h.Span(h.Class("text-sm font-medium"), p[0]),
									h.Span(h.Class("text-[13px] leading-relaxed text-muted-foreground"), p[1]))
							}),
						),
					)
				}),
				h.P(h.Data("tally", ""), h.Class("font-mono text-[11px] text-muted-foreground"), fmt.Sprintf("0 of %d answered", len(philoTEs))),
			)
		},
	}
}

// ---------------------------------------------------------------- F3

type philoCase struct {
	key, name, setup string
	verdicts         [4][2]string // theory → verdict, reasoning
}

var philoTheories = [4][2]string{
	{"Consequentialism", "Bentham (1789), Mill (1863)"},
	{"Deontology", "Kant, Groundwork (1785)"},
	{"Virtue ethics", "Aristotle, Nicomachean Ethics"},
	{"Contractualism", "Scanlon, What We Owe to Each Other (1998)"},
}

var philoCases = []philoCase{
	{"murderer", "The murderer at the door",
		"A friend is hiding in your house. A man who wants to kill them knocks and asks whether they are inside. (Kant, \"On a Supposed Right to Lie from Philanthropy\", 1797, replying to Benjamin Constant.)",
		[4][2]string{
			{"Lie", "Lying saves a life; its bad effects are tiny by comparison."},
			{"Don't lie (Kant's own verdict)", "Truthfulness is a duty to everyone; you are not responsible for what the murderer then does. Many Kantians reject Kant's verdict here (e.g. Korsgaard 1986)."},
			{"Protect your friend", "Honesty matters, but practical wisdom and loyalty mark what a good person does in the situation; deceiving a murderer is not the vice of dishonesty."},
			{"Lie", "No one could reasonably reject a principle that allows deceiving someone in order to stop a murder."},
		}},
	{"surgeon", "The transplant surgeon",
		"A surgeon could kill one healthy visitor and use their organs to save five dying patients. (A case discussed by Foot and Thomson alongside the trolley problem.)",
		[4][2]string{
			{"Depends on the version", "Counting only this act, five beat one. Rule consequentialists answer no: a practice of killing patients would destroy trust in hospitals and do far more harm."},
			{"Don't kill", "It treats the visitor merely as a means: a clear violation of the categorical imperative."},
			{"Don't kill", "No virtuous doctor kills a patient in their care; the act expresses callousness, not compassion."},
			{"Don't kill", "The visitor could reasonably reject any principle that lets them be killed for spare parts."},
		}},
}

func philoEthicsBlock() Block {
	return Block{
		Slug:        "ethics",
		Title:       "Four ethical theories",
		Description: "One dilemma, four ways of reasoning about it. The point is not the verdict but the reason given: theories that agree on the answer can disagree on why.",
		Tags:        []string{"comparison", "dilemmas"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("philo-ethics", ""),
				segs("Dilemma", [2]string{"murderer", "Murderer at the door"}, [2]string{"surgeon", "Transplant surgeon"}),
				h.Map(philoCases, func(c philoCase) h.Node {
					return h.Div(h.Data("view", c.key), h.If(c.key != "murderer", h.Hidden()), h.Class("flex flex-col gap-3"),
						h.P(h.Class("max-w-[70ch] text-[15px] leading-relaxed"), c.setup),
						h.Div(h.Class("grid gap-2 sm:grid-cols-2 lg:grid-cols-4"),
							h.MapIdx(philoTheories[:], func(i int, t [2]string) h.Node {
								return h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3"),
									h.Span(h.Class("text-sm font-medium"), t[0]),
									h.Span(h.Class("font-mono text-[10px] text-muted-foreground"), t[1]),
									h.Span(h.Class("self-start rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"), c.verdicts[i][0]),
									h.P(h.Class("text-[13px] leading-relaxed text-muted-foreground"), c.verdicts[i][1]),
								)
							}),
						),
					)
				}),
			)
		},
	}
}

// ---------------------------------------------------------------- F4

type philoPerson struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Life   string `json:"life"`
	Born   int    `json:"born"` // negative is BCE
	Lane   int    `json:"lane"`
	Work   string `json:"work"`
	School string `json:"school"`
}

var philoLanes = []string{"Ancient", "Medieval", "Rationalism", "Empiricism", "German", "Analytic", "Existential", "Political"}

var philoPeople = []philoPerson{
	{"socrates", "Socrates", "c. 470–399 BCE", -470, 0, "Wrote nothing; known through Plato and Xenophon", "Athens"},
	{"plato", "Plato", "c. 428/427–348/347 BCE", -428, 0, "Republic; Apology", "Academy"},
	{"aristotle", "Aristotle", "384–322 BCE", -384, 0, "Nicomachean Ethics; Metaphysics", "Lyceum"},
	{"plotinus", "Plotinus", "c. 204/205–270", 204, 1, "Enneads", "Neoplatonism"},
	{"augustine", "Augustine", "354–430", 354, 1, "Confessions; City of God", "Christian Neoplatonism"},
	{"avicenna", "Ibn Sina (Avicenna)", "c. 980–1037", 980, 1, "The Book of Healing", "Islamic Aristotelianism"},
	{"averroes", "Ibn Rushd (Averroes)", "1126–1198", 1126, 1, "Commentaries on Aristotle", "Islamic Aristotelianism"},
	{"aquinas", "Thomas Aquinas", "1225–1274", 1225, 1, "Summa Theologiae", "Scholasticism"},
	{"descartes", "René Descartes", "1596–1650", 1596, 2, "Meditations on First Philosophy (1641)", "Rationalism"},
	{"spinoza", "Baruch Spinoza", "1632–1677", 1632, 2, "Ethics (1677)", "Rationalism"},
	{"leibniz", "G. W. Leibniz", "1646–1716", 1646, 2, "Monadology (1714)", "Rationalism"},
	{"locke", "John Locke", "1632–1704", 1632, 3, "Essay Concerning Human Understanding (1689)", "Empiricism"},
	{"berkeley", "George Berkeley", "1685–1753", 1685, 3, "Principles of Human Knowledge (1710)", "Empiricism"},
	{"hume", "David Hume", "1711–1776", 1711, 3, "A Treatise of Human Nature (1739–40)", "Empiricism"},
	{"kant", "Immanuel Kant", "1724–1804", 1724, 4, "Critique of Pure Reason (1781)", "Critical philosophy"},
	{"hegel", "G. W. F. Hegel", "1770–1831", 1770, 4, "Phenomenology of Spirit (1807)", "German idealism"},
	{"schopenhauer", "Arthur Schopenhauer", "1788–1860", 1788, 4, "The World as Will and Representation (1818)", "German philosophy"},
	{"marx", "Karl Marx", "1818–1883", 1818, 7, "Capital, vol. 1 (1867)", "Historical materialism"},
	{"nietzsche", "Friedrich Nietzsche", "1844–1900", 1844, 4, "Beyond Good and Evil (1886)", "German philosophy"},
	{"kierkegaard", "Søren Kierkegaard", "1813–1855", 1813, 6, "Either/Or (1843)", "Existentialism (precursor)"},
	{"frege", "Gottlob Frege", "1848–1925", 1848, 5, "Begriffsschrift (1879)", "Analytic philosophy"},
	{"russell", "Bertrand Russell", "1872–1970", 1872, 5, "Principia Mathematica (with Whitehead, 1910–13)", "Analytic philosophy"},
	{"wittgenstein", "Ludwig Wittgenstein", "1889–1951", 1889, 5, "Tractatus (1921); Philosophical Investigations (1953)", "Analytic philosophy"},
	{"heidegger", "Martin Heidegger", "1889–1976", 1889, 6, "Being and Time (1927)", "Phenomenology"},
	{"sartre", "Jean-Paul Sartre", "1905–1980", 1905, 6, "Being and Nothingness (1943)", "Existentialism"},
	{"beauvoir", "Simone de Beauvoir", "1908–1986", 1908, 6, "The Second Sex (1949)", "Existentialism"},
	{"rawls", "John Rawls", "1921–2002", 1921, 7, "A Theory of Justice (1971)", "Political philosophy"},
}

// Influences: a selection of well-documented ones, not a complete map.
var philoEdges = [][2]string{
	{"socrates", "plato"}, {"plato", "aristotle"}, {"plato", "plotinus"}, {"plotinus", "augustine"},
	{"aristotle", "avicenna"}, {"aristotle", "averroes"}, {"avicenna", "aquinas"}, {"averroes", "aquinas"}, {"aristotle", "aquinas"}, {"augustine", "aquinas"},
	{"descartes", "spinoza"}, {"descartes", "leibniz"}, {"descartes", "locke"},
	{"locke", "berkeley"}, {"berkeley", "hume"}, {"locke", "hume"},
	{"hume", "kant"}, {"leibniz", "kant"}, {"kant", "hegel"}, {"kant", "schopenhauer"},
	{"schopenhauer", "nietzsche"}, {"hegel", "marx"}, {"hegel", "kierkegaard"},
	{"frege", "russell"}, {"frege", "wittgenstein"}, {"russell", "wittgenstein"},
	{"kierkegaard", "heidegger"}, {"nietzsche", "heidegger"}, {"heidegger", "sartre"}, {"sartre", "beauvoir"}, {"beauvoir", "sartre"},
	{"kant", "rawls"}, {"locke", "rawls"},
}

func philoLineageBlock() Block {
	data, _ := json.Marshal(map[string]any{"people": philoPeople, "edges": philoEdges, "lanes": philoLanes})
	return Block{
		Slug:        "lineage",
		Title:       "Who read whom",
		Description: "Philosophers placed by birth year and tradition, with a selection of well-documented influences. Pick one to light up the thinkers they drew on and those who drew on them. The axis compresses the long ancient and medieval stretch.",
		Tags:        []string{"graph", "influence", "kbd"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("philo-lineage", ""),
				h.Div(h.Class("scroll-thin min-w-0 overflow-x-auto border-b bg-code p-3 lg:border-r lg:border-b-0"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 940 360"), h.Class("block w-full min-w-[760px]"), h.Role("group"), h.Aria("label", "Influence graph of philosophers")),
				),
				h.Div(h.Class("flex flex-col gap-3 p-5"),
					h.Span(h.Data("out", "name"), h.Class("text-base font-semibold tracking-tight"), "Pick a philosopher"),
					h.Span(h.Data("out", "life"), h.Class("font-mono text-xs text-muted-foreground")),
					h.P(h.Data("out", "work"), h.Class("text-sm leading-relaxed text-muted-foreground"), "Click a dot, or focus the graph and use ← and →."),
					h.Div(h.Data("out", "links"), h.Class("flex flex-col gap-1.5 border-t pt-3 text-xs leading-relaxed text-muted-foreground")),
					h.P(h.Class("mt-auto text-[11px] leading-relaxed text-muted-foreground"), "Influence is selective: an arrow means a documented reading or reaction, not a complete account of anyone's sources."),
				),
				h.Template(h.Data("graph", string(data))),
			)
		},
	}
}

// ---------------------------------------------------------------- F5

type philoFallacy struct{ example, answer, why string }

var philoFallacyNames = []string{"Straw man", "Ad hominem", "False dilemma", "Slippery slope", "Begging the question", "Appeal to popularity", "Appeal to authority"}

var philoFallacies = []philoFallacy{
	{"\"My opponent wants to reduce the defence budget. Clearly she wants to leave the country defenceless.\"", "Straw man",
		"It attacks a distorted, weaker version of the claim (no defence at all) instead of the one made (a smaller budget)."},
	{"\"Why listen to his argument about tax policy? He was fired from his last job.\"", "Ad hominem",
		"It attacks the person, not the argument; the argument stands or falls on its own."},
	{"\"Either we ban all cars from the city centre, or we accept that pollution will keep killing people.\"", "False dilemma",
		"It presents two options as the only ones when many others exist (cleaner engines, congestion charges, more buses…)."},
	{"\"If we let students resit one exam, soon they'll expect to resit every exam, and degrees will mean nothing.\"", "Slippery slope",
		"It claims a chain of consequences without showing why each step would follow from the last."},
	{"\"This book is entirely reliable, because it says so itself, and a reliable book wouldn't lie.\"", "Begging the question",
		"The conclusion (the book is reliable) is assumed in the reasoning offered for it."},
	{"\"Millions of people read their horoscope every day, so astrology must work.\"", "Appeal to popularity",
		"How many people believe a claim says nothing about whether it is true."},
	{"\"A famous actor says this supplement cures colds, so it does.\"", "Appeal to authority",
		"The authority is not an expert on the question; even genuine expertise is evidence, not proof."},
}

func philoFallacyBlock() Block {
	return Block{
		Slug:        "fallacies",
		Title:       "Informal fallacies",
		Description: "Arguments that persuade without supporting their conclusion. Name the fallacy in each example; every answer comes with why it fails. (Formal fallacies, errors of logical form, are in the Logic collection.)",
		Tags:        []string{"quiz", "reasoning"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("philo-fallacy", ""),
				h.Div(h.Class("flex items-center justify-between text-xs text-muted-foreground"),
					h.Span(h.Data("out", "pos"), h.Class("font-mono tabular-nums"), fmt.Sprintf("1 / %d", len(philoFallacies))),
					h.Span(h.Data("out", "score"), "0 correct"),
				),
				h.Blockquote(h.Data("example", ""), h.Class("rounded-xl border bg-background p-5 text-[17px] leading-relaxed text-pretty shadow-xs"), philoFallacies[0].example),
				h.Div(h.Class("flex flex-wrap gap-2"),
					h.Map(philoFallacyNames, func(n string) h.Node {
						return h.Button(h.Type("button"), h.Data("answer", n),
							h.Class("rounded-lg border bg-background px-3 py-1.5 text-sm shadow-xs transition-[border-color,box-shadow,background-color] duration-150 outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=right]:border-add data-[state=right]:bg-add/8 data-[state=wrong]:border-del data-[state=wrong]:bg-del/8"), n)
					}),
				),
				h.P(h.Data("why", ""), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground")),
				h.Div(h.Class("flex justify-end border-t pt-4"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "next"), h.Disabled(), "Next", hugeicons.ArrowRight01Icon())),
				h.Template(h.Data("items", ""), h.Map(philoFallacies, func(f philoFallacy) h.Node {
					return h.Div(h.Data("example", f.example), h.Data("answer", f.answer), h.Data("why", f.why))
				})),
			)
		},
	}
}

// ---------------------------------------------------------------- F6

func philoZenoBlock() Block {
	return Block{
		Slug:        "zeno",
		Title:       "Achilles and the tortoise",
		Description: "Zeno of Elea (5th century BCE, reported by Aristotle, Physics VI.9): to overtake the tortoise, Achilles must first reach where it was, by which time it has moved on, and so forever. Infinitely many stages, yet their times form a geometric series with a finite sum.",
		Tags:        []string{"paradox", "geometric series", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("philo-zeno",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("zeno-track", ""), h.ViewBox("0 0 560 90"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Positions of Achilles and the tortoise")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Total time after each stage")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Race"),
					field("head", "Head start", "m", 100, 1, 500, 1),
					field("va", "Achilles", "m/s", 10, 1, 20, 0.5),
					field("vt", "Tortoise", "m/s", 1, 0.1, 9, 0.1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "step"), hugeicons.ArrowRight01Icon(), "Next stage"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset"),
				),
				readouts([2]string{"stage", "stage"}, [2]string{"time so far", "t"}, [2]string{"gap left", "gap"}, [2]string{"limit", "limit"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F7

type philoGloss struct{ text, gloss string }

var philoMeditation = []philoGloss{
	{"Descartes resolves to doubt everything that can be doubted, even the existence of the world and of his own body.", "Method: hyperbolic doubt. He doubts not because he thinks these things are false, but to find something that survives any possible doubt."},
	{"He imagines a deceiver of the greatest power and cunning, bent on deceiving him at every turn.", "The 'evil demon' of Meditation I: a device to test even mathematics and the most basic beliefs."},
	{"Yet however much he is deceived, he must exist in order to be deceived.", "Being deceived is a kind of thinking; whatever thinks, exists while it thinks."},
	{"Ego sum, ego existo, quoties a me profertur, vel mente concipitur, necessario esse verum.", "\"I am, I exist, is necessarily true each time I say it or conceive it in my mind\" (our translation; Latin text, AT VII 25). The famous phrase \"cogito, ergo sum\" is from the Principles (1644); the French \"je pense, donc je suis\" from the Discourse on Method (1637)."},
	{"But what is this 'I' that exists? Only a thing that thinks: that doubts, understands, affirms, denies, wills, refuses, imagines and senses.", "He concludes he is a thinking thing (res cogitans), setting up the mind–body distinction of Meditation VI."},
}

func philoSourceBlock() Block {
	return Block{
		Slug:        "meditation",
		Title:       "Primary source: the cogito",
		Description: "Descartes, Meditations on First Philosophy (1641), Meditation II. A close paraphrase with the key Latin sentence quoted; hover or focus each passage for its gloss. Read it in full in the Latin edition (AT VII) or a translation.",
		Tags:        []string{"glossed text", "Descartes", "Latin"},
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[3fr_2fr]"), h.Data("philo-source", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-xs"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						badge.Badge(badge.VariantOutline, h.Class("font-normal"), "Paraphrase"),
						badge.Badge(badge.VariantOutline, h.Class("font-normal"), "Latin quoted: AT VII 25"),
					),
					h.Div(h.Class("flex flex-col gap-2 text-[16px] leading-relaxed"),
						h.MapIdx(philoMeditation, func(i int, p philoGloss) h.Node {
							latin := i == 3
							return h.P(h.Data("passage", fmt.Sprint(i)), h.TabIndex(0),
								h.Class("cursor-default rounded-md px-2 py-1 outline-none transition-colors duration-100 data-[on]:bg-brand/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 "+h.Ternary(latin, "font-serif italic", "")),
								p.text)
						}),
					),
				),
				h.Aside(h.Class("flex flex-col gap-2 rounded-xl border bg-code p-5 lg:sticky lg:top-20 lg:self-start"),
					h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Gloss"),
					h.P(h.Data("gloss", ""), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed text-muted-foreground"), "Hover or focus a passage."),
				),
				h.Template(h.Data("glosses", ""), h.Map(philoMeditation, func(p philoGloss) h.Node { return h.Div(h.Data("gloss", p.gloss)) })),
			)
		},
	}
}
