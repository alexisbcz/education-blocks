package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// CryptoBlocks lists the number theory and cryptography gallery.
func CryptoBlocks() []Block {
	return []Block{
		cryptoSieveBlock(),
		cryptoEuclidBlock(),
		cryptoModularBlock(),
		cryptoModPowBlock(),
		cryptoRSABlock(),
		cryptoDHBlock(),
		cryptoVigenereBlock(),
		cryptoHashBlock(),
	}
}

// cryptoField is field() with room for big integers (up to ~9 digits)
// and no unit column: number theory has no units.
func cryptoField(name, lbl string, v float64, min, max, step float64) h.Node {
	return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
		h.Span(h.Class("text-muted-foreground"), lbl),
		h.Input(h.Type("text"), h.Attr("inputmode", "numeric"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
			h.Data("min", fmt.Sprint(min)), h.Data("max", fmt.Sprint(max)), h.Data("step", fmt.Sprint(step)),
			h.Attr("autocomplete", "off"),
			h.Class("h-8 w-24 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
	)
}

// cryptoTextInput is a plain text input styled like the scrub fields.
func cryptoTextInput(name, value, label string, extra ...any) h.Node {
	return h.Input(append([]any{h.Type("text"), h.Data("text", name), h.Value(value), h.Aria("label", label),
		h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
		h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 font-mono text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")}, extra...)...)
}

func cryptoButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// cryptoTable is an empty table the JS fills with step rows.
func cryptoTable(heads ...string) h.Node {
	return h.Div(h.Class("scroll-thin max-h-72 overflow-auto rounded-lg border bg-code"),
		h.Table(h.Class("w-full text-sm"),
			h.Thead(h.Class("sticky top-0 bg-code-panel"), h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
				h.Map(heads, func(s string) h.Node { return h.Th(h.Class("px-3 py-2 text-right font-normal first:text-left"), s) }))),
			h.Tbody(h.Data("rows", ""), h.Class("font-mono text-[13px] tabular-nums")),
		),
	)
}

// ---------------------------------------------------------------- C1

func cryptoSieveBlock() Block {
	return Block{
		Slug:        "sieve",
		Title:       "Sieve of Eratosthenes",
		Description: "Cross out the multiples of each prime in turn; whatever survives is prime. Then count them: the prime counting function π(n) tracks n / ln n, as the prime number theorem says, though more slowly than li(n).",
		Tags:        []string{"primes", "animation", "π(n)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sieve",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("grid", ""), h.Class("grid grid-cols-10 gap-1 font-mono text-[11px] tabular-nums sm:grid-cols-20"), h.Aria("label", "Numbers 1 to 200")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 180"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "π(n) compared with n / ln n")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sieve"),
					h.P(h.Data("out", "step"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground"), "Press Step to cross out the multiples of 2."),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					cryptoButton("step", "Step", hugeicons.ArrowRight01Icon()),
					playPause(),
					h.Div(h.Class("col-span-2"), cryptoButton("reset", "Reset", hugeicons.RefreshIcon())),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Counting"),
					cryptoField("n", "n", 100000, 100, 1000000, 100),
				),
				readouts([2]string{"π(n)", "pi"}, [2]string{"n / ln n", "approx"}, [2]string{"ratio", "ratio"}, [2]string{"primes ≤ 200", "found"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C2

func cryptoEuclidBlock() Block {
	return Block{
		Slug:        "euclid",
		Title:       "Euclid's algorithm",
		Description: "The oldest algorithm still in daily use (Elements, Book VII, c. 300 BCE). Divide, keep the remainder, repeat. The extended version carries two more columns and ends with Bézout's identity: gcd(a, b) = s·a + t·b.",
		Tags:        []string{"gcd", "Bézout", "step table"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("euclid", ""),
				h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
					cryptoField("a", "a", 1071, 1, 1000000, 1),
					cryptoField("b", "b", 462, 1, 1000000, 1),
				),
				cryptoTable("step", "q", "r", "s", "t"),
				h.P(h.Data("out", "result"), h.Class("rounded-lg border bg-background p-3 font-mono text-sm"), "—"),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Each row keeps the invariant r = s·a + t·b. The last non-zero remainder is the gcd."),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func cryptoModularBlock() Block {
	return Block{
		Slug:        "modular",
		Title:       "Clock arithmetic",
		Description: "Arithmetic modulo n wraps around like a clock. Walking by steps of k visits every hour exactly when gcd(k, n) = 1; those k are the units, the numbers with a multiplicative inverse, and there are φ(n) of them.",
		Tags:        []string{"mod n", "units", "φ(n)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("modular",
				h.Div(h.Class("grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Svg(h.Data("clock", ""), h.ViewBox("-120 -120 240 240"), h.Class("mx-auto block w-full max-w-[320px]"), h.Role("img"), h.Aria("label", "Clock of residues mod n")),
					h.Div(h.Data("table", ""), h.Class("scroll-thin self-center overflow-auto font-mono text-[10px] tabular-nums"), h.Aria("label", "Multiplication table mod n")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Modulus"),
					cryptoField("n", "n", 12, 2, 24, 1),
					cryptoField("k", "step k", 5, 1, 23, 1),
				),
				readouts([2]string{"gcd(k, n)", "gcd"}, [2]string{"k⁻¹ mod n", "inv"}, [2]string{"φ(n)", "phi"}, [2]string{"units", "units"}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Units are shaded in the table; a row with a 1 in it belongs to an invertible number."),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func cryptoModPowBlock() Block {
	return Block{
		Slug:        "modpow",
		Title:       "Square and multiply",
		Description: "How a computer raises a number to a 2048-bit power without overflowing: read the exponent's bits from the left, square at every bit, multiply when the bit is 1, reduce mod m each time. About 2·log₂ e multiplications instead of e.",
		Tags:        []string{"BigInt", "binary", "steps"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("modpow", ""),
				h.Div(h.Class("grid gap-2 sm:grid-cols-3"),
					cryptoField("base", "base a", 7, 0, 1000000, 1),
					cryptoField("exp", "exponent e", 560, 0, 100000000, 1),
					cryptoField("mod", "modulus m", 561, 2, 1000000, 1),
				),
				h.P(h.Data("out", "bits"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
				cryptoTable("bit", "operation", "value mod m"),
				h.P(h.Data("out", "result"), h.Class("rounded-lg border bg-background p-3 font-mono text-sm"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- C5

func cryptoRSABlock() Block {
	return Block{
		Slug:        "rsa",
		Title:       "RSA, end to end",
		Description: "Rivest, Shamir and Adleman's 1977 public-key system with toy primes. Anyone can encrypt with (n, e); only whoever knows the factors of n can compute d. Factor n and the secret falls out, which is why real keys use primes of 1024 bits or more.",
		Tags:        []string{"public key", "BigInt", "factoring"},
		Wide:        true,
		Render: func() h.Node {
			col := func(title string, children ...any) h.Node {
				return h.Div(append([]any{h.Class("flex flex-col gap-3 rounded-lg border bg-background p-4")}, append([]any{h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), title)}, children...)...)...)
			}
			kv := func(label, out string) h.Node {
				return h.Div(h.Class("flex items-baseline justify-between gap-3 font-mono text-sm"),
					h.Span(h.Class("text-muted-foreground"), label), h.Span(h.Data("out", out), h.Class("truncate tabular-nums"), "—"))
			}
			return h.Div(h.Class("grid gap-3 lg:grid-cols-3"), h.Data("rsa", ""),
				col("1 · Key generation",
					cryptoField("p", "prime p", 61, 2, 9973, 1),
					cryptoField("q", "prime q", 53, 2, 9973, 1),
					cryptoField("e", "public e", 17, 3, 65537, 1),
					kv("n = p·q", "n"), kv("φ(n)", "phi"), kv("d = e⁻¹ mod φ", "d"),
					h.P(h.Data("out", "keyerr"), h.Class("min-h-4 text-xs text-del")),
				),
				col("2 · Encrypt and decrypt",
					cryptoField("m", "message m", 65, 0, 99999999, 1),
					kv("c = mᵉ mod n", "c"), kv("cᵈ mod n", "back"),
					h.P(h.Data("out", "check"), h.Class("min-h-4 text-xs")),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "The message must be a number smaller than n. Real systems also pad it (OAEP); textbook RSA as shown is not secure."),
				),
				col("3 · Break it by factoring n",
					cryptoButton("factor", "Factor n", hugeicons.Search01Icon()),
					kv("found p", "fp"), kv("trial divisions", "tries"), kv("recovered d", "fd"),
					h.P(h.Data("out", "verdict"), h.Class("min-h-4 text-xs text-muted-foreground")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func cryptoDHBlock() Block {
	return Block{
		Slug:        "diffie-hellman",
		Title:       "Diffie–Hellman key exchange",
		Description: "Two people agree on a secret over a public channel (Diffie and Hellman, 1976). The paint analogy on top, the real arithmetic underneath: mixing is easy, unmixing is hard, just as g^a mod p is easy and recovering a (the discrete logarithm) is hard.",
		Tags:        []string{"key exchange", "discrete log", "colour mixing"},
		Wide:        true,
		Render: func() h.Node {
			swatch := func(key, label string) h.Node {
				return h.Div(h.Class("flex flex-col items-center gap-1.5"),
					h.Span(h.Data("swatch", key), h.Class("size-10 rounded-full border shadow-xs")),
					h.Span(h.Class("text-center text-[11px] text-muted-foreground"), label))
			}
			party := func(name, key, secret string, v float64) h.Node {
				return h.Div(h.Class("flex flex-col gap-3 rounded-lg border bg-background p-4"),
					h.Span(h.Class("text-sm font-medium"), name),
					cryptoField(key, "secret "+secret, v, 1, 1000, 1),
					h.Div(h.Class("flex justify-around gap-2"), swatch(key+"-secret", "secret"), swatch(key+"-public", "sends")),
					h.Div(h.Class("flex items-baseline justify-between font-mono text-sm"), h.Span(h.Class("text-muted-foreground"), h.IfElse(key == "a", "A = gᵃ mod p", "B = gᵇ mod p")), h.Span(h.Data("out", key+"-pub"), "—")),
					h.Div(h.Class("flex items-baseline justify-between font-mono text-sm"), h.Span(h.Class("text-muted-foreground"), h.IfElse(key == "a", "Bᵃ mod p", "Aᵇ mod p")), h.Span(h.Data("out", key+"-shared"), h.Class("font-medium text-brand"), "—")),
				)
			}
			return h.Div(h.Class("flex flex-col gap-3"), h.Data("dh", ""),
				h.Div(h.Class("grid gap-3 rounded-lg border bg-code p-4 sm:grid-cols-[auto_1fr]"),
					h.Div(h.Class("flex items-center gap-4"), swatch("common", "public colour g")),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						cryptoField("p", "public prime p", 23, 5, 1000003, 1),
						cryptoField("g", "generator g", 5, 2, 1000, 1),
						h.P(h.Data("out", "gnote"), h.Class("text-xs text-muted-foreground sm:col-span-2")),
					),
				),
				h.Div(h.Class("grid gap-3 md:grid-cols-[1fr_auto_1fr]"),
					party("Alice", "a", "a", 6),
					h.Div(h.Class("flex flex-col items-center justify-center gap-2 px-2 text-center"),
						hugeicons.ArrowDataTransferHorizontalIcon(h.Class("size-5 text-muted-foreground")),
						h.Span(h.Class("max-w-36 text-[11px] text-muted-foreground"), "Eve sees p, g, A and B, but not a, b or the shared secret."),
						swatch("shared", "shared secret")),
					party("Bob", "b", "b", 15),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

// Relative frequencies of letters in English, % (Lewand, Cryptological
// Mathematics, 2000), the table most textbooks reproduce.
var cryptoEnglish = []float64{8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406,
	6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.360, 0.150, 1.974, 0.074}

func cryptoVigenereBlock() Block {
	return Block{
		Slug:        "vigenere",
		Title:       "Ciphers and frequency analysis",
		Description: "Caesar shifts every letter by the same amount, so the ciphertext keeps English's fingerprint: E and T still stand out, shifted. Al-Kindi described frequency analysis in the 9th century. Vigenère's repeating key flattens the bars, which is why it resisted for three centuries.",
		Tags:        []string{"Caesar", "Vigenère", "chi-squared"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"), h.Data("vigenere", ""),
				h.Div(h.Class("flex flex-col gap-3 rounded-lg border bg-background p-4"),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2"),
						segs("Cipher", [2]string{"caesar", "Caesar"}, [2]string{"vigenere", "Vigenère"}),
						h.Div(h.Class("flex items-center gap-2 text-sm"), h.Span(h.Class("text-muted-foreground"), "key"),
							h.Div(h.Class("w-32"), cryptoTextInput("key", "3", "Key"))),
					),
					h.Label(h.Class("flex flex-col gap-1.5 text-xs text-muted-foreground"), "Plaintext",
						h.Textarea(h.Data("text", "plain"), h.Attr("rows", "4"), h.Attr("spellcheck", "false"),
							h.Class("w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
							"It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness.")),
					h.Div(h.Class("flex flex-col gap-1.5 text-xs text-muted-foreground"), "Ciphertext",
						h.P(h.Data("out", "cipher"), h.Class("rounded-md border bg-code p-3 font-mono text-sm break-all text-foreground"), "—")),
				),
				h.Div(h.Class("flex flex-col gap-3 rounded-lg border bg-code p-3"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "ciphertext"), legendSwatch("var(--vec-u)", "English (Lewand)")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Letter frequencies")),
					h.Div(h.Class("flex flex-wrap items-center justify-between gap-2 px-1"),
						cryptoButton("crack", "Crack the Caesar shift", hugeicons.Key01Icon()),
						h.Span(h.Data("out", "crack"), h.Class("font-mono text-xs text-muted-foreground"))),
				),
				h.Template(h.Data("english", ""), h.Data("freq", fmt.Sprint(cryptoEnglish))),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func cryptoHashBlock() Block {
	return Block{
		Slug:        "hash",
		Title:       "Hashing and the avalanche effect",
		Description: "SHA-256, computed by your browser's Web Crypto. Change one character and about half of the 256 output bits flip, unpredictably: the property that lets a hash stand in for a file, a password or a block of transactions.",
		Tags:        []string{"SHA-256", "Web Crypto", "bits"},
		Render: func() h.Node {
			row := func(name, value string) h.Node {
				return h.Div(h.Class("flex flex-col gap-1.5"),
					cryptoTextInput(name, value, "Input "+name),
					h.P(h.Data("out", "hex-"+name), h.Class("font-mono text-[11px] break-all text-muted-foreground"), "—"))
			}
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("hash", ""),
				row("a", "The quick brown fox jumps over the lazy dog"),
				row("b", "The quick brown fox jumps over the lazy cog"),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "256 bits"),
					h.Span(h.Class("font-mono text-xs"), h.Span(h.Class("text-muted-foreground"), "bits that differ "), h.Span(h.Data("out", "diff"), h.Class("text-brand"), "—")),
				),
				h.Div(h.Data("bits", ""), h.Class("grid grid-cols-32 gap-px overflow-hidden rounded-md border bg-border"), h.Aria("label", "Output bits; pink where the two hashes differ")),
			)
		},
	}
}
