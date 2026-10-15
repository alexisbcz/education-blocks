package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ModerncryptoBlocks lists the modern cryptography gallery: AES round by
// round, block cipher modes, nonce reuse, HMAC, authenticated encryption,
// secret sharing, a zero-knowledge proof, key stretching, a toy lattice
// scheme and the TLS 1.3 handshake. Everything runs in the page; AES and
// SHA-256 are checked against FIPS test vectors and WebCrypto.
func ModerncryptoBlocks() []Block {
	return []Block{
		mcAesBlock(),
		mcModesBlock(),
		mcNonceBlock(),
		mcHmacBlock(),
		mcAeadBlock(),
		mcShamirBlock(),
		mcZkpBlock(),
		mcStretchBlock(),
		mcLweBlock(),
		mcTlsBlock(),
	}
}

func mcButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func mcNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// mcText is a monospace text input; name is read as data-text.
func mcText(name, value, label string) h.Node {
	return h.Input(h.Type("text"), h.Data("text", name), h.Value(value), h.Aria("label", label),
		h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
		h.Class("h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-[var(--code-del)]"))
}

func mcLabeled(lbl string, input h.Node) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-sm text-muted-foreground"), lbl), input)
}

// mcCanvas is a pixel canvas shown crisp at any size.
func mcCanvas(name, label string, size int) h.Node {
	return h.Figure(h.Class("flex min-w-0 flex-col gap-1.5"),
		h.Canvas(h.Data("canvas", name), h.Width(fmt.Sprint(size)), h.Height(fmt.Sprint(size)), h.Role("img"), h.Aria("label", label),
			h.Class("block aspect-square w-full rounded-md border bg-background [image-rendering:pixelated]")),
		h.Figcaption(h.Data("caption", name), h.Class("font-mono text-[11px] text-muted-foreground"), label),
	)
}

// ---------------------------------------------------------------- 1

func mcAesBlock() Block {
	return Block{
		Slug:        "aes-rounds",
		Title:       "AES, round by round",
		Description: "AES-128 turns 16 bytes into 16 bytes with ten rounds of four simple steps on a 4×4 grid: substitute each byte through the S-box, shift the rows, mix each column as a polynomial over GF(2⁸), and add the round key. Step through it and watch one changed input byte spread to all sixteen by round two.",
		Tags:        []string{"FIPS-197", "S-box", "GF(2⁸)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-aes",
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Class("grid gap-4 sm:grid-cols-2"),
						h.Div(h.Class("flex flex-col gap-2"),
							h.Div(h.Class("flex items-baseline justify-between gap-2"), panelLabel("State"), h.Span(h.Data("out", "where"), h.Class("font-mono text-xs"), "—")),
							h.Div(h.Data("state", ""), h.Class("grid grid-cols-4 gap-1"), h.Role("grid"), h.Aria("label", "AES state, four rows by four columns")),
						),
						h.Div(h.Class("flex flex-col gap-2"),
							h.Div(h.Class("flex items-baseline justify-between gap-2"), panelLabel("Round key"), h.Span(h.Data("out", "keyround"), h.Class("font-mono text-xs"), "—")),
							h.Div(h.Data("key", ""), h.Class("grid grid-cols-4 gap-1"), h.Aria("label", "Round key")),
						),
					),
					h.Div(h.Class("flex flex-col gap-1.5"),
						h.Div(h.Class("flex items-center justify-between gap-2"), panelLabel("Steps"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "← → step")),
						h.Div(h.Data("track", ""), h.Class("flex flex-wrap gap-0.5"), h.Role("group"), h.Aria("label", "AES steps")),
					),
					h.P(h.Data("explain", ""), h.Aria("live", "polite"), h.Class("min-h-10 text-sm leading-relaxed text-pretty text-muted-foreground")),
					h.Div(h.Class("flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-t pt-3 font-mono text-xs"),
						h.Span(h.Class("text-muted-foreground"), "ciphertext"), h.Span(h.Data("out", "ct"), h.Class("min-w-0 break-all tabular-nums"), "—")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Input"),
					mcLabeled("Plaintext (hex)", mcText("pt", "3243f6a8885a308d313198a2e0370734", "Plaintext in hex")),
					mcLabeled("Key (hex)", mcText("key", "2b7e151628aed2a6abf7158809cf4f3c", "Key in hex")),
					h.Div(h.Class("flex flex-wrap gap-2"),
						mcButton("prev", "Back", hugeicons.ArrowLeft01Icon()),
						mcButton("next", "Next", hugeicons.ArrowRight01Icon()),
						mcButton("end", "Ciphertext", hugeicons.ArrowRightDoubleIcon()),
					),
					h.Div(h.Class("flex flex-wrap gap-2"),
						mcButton("fips-b", "FIPS-197 B", hugeicons.Book02Icon()),
						mcButton("fips-c", "FIPS-197 C.1", hugeicons.Book02Icon()),
					),
				),
				readouts([2]string{"changed", "changed"}, [2]string{"test vector", "check"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func mcModesBlock() Block {
	return Block{
		Slug:        "block-modes",
		Title:       "Why ECB leaks the picture",
		Description: "A block cipher only encrypts 16 bytes. A mode says how to encrypt more. ECB encrypts every block on its own, so equal blocks give equal ciphertext and the outline of the image survives. CBC chains each block into the next, and CTR turns AES into a keystream: both look like noise.",
		Tags:        []string{"ECB", "CBC", "CTR"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-modes",
				h.Div(h.Class("grid grid-cols-2 gap-3"),
					mcCanvas("plain", "Plaintext: 1 byte per pixel", 96),
					mcCanvas("cipher", "Ciphertext bytes as pixels", 96),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mode"),
					segs("Mode", [2]string{"ecb", "ECB"}, [2]string{"cbc", "CBC"}, [2]string{"ctr", "CTR"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Image"),
					segs("Image", [2]string{"logo", "Logo"}, [2]string{"stripes", "Stripes"}, [2]string{"text", "Text"}),
				),
				mcButton("rekey", "New key", hugeicons.Key01Icon()),
				readouts([2]string{"blocks", "blocks"}, [2]string{"distinct plaintext blocks", "pdistinct"}, [2]string{"distinct ciphertext blocks", "cdistinct"}),
				mcNote("Each 16-pixel row segment is one AES block, encrypted with the AES in this page (checked against WebCrypto). The image has few distinct blocks, so ECB shows few distinct ciphertext blocks too."),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func mcNonceBlock() Block {
	return Block{
		Slug:        "nonce-reuse",
		Title:       "Never reuse a nonce",
		Description: "CTR mode, like a one-time pad, XORs the message with a keystream. If two messages use the same key and nonce, they get the same keystream, and XORing the two ciphertexts cancels it: what is left is the XOR of the two plaintexts, which often shows both. Give the second message a fresh nonce and the overlay turns to noise.",
		Tags:        []string{"one-time pad", "keystream", "nonce"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-nonce",
				h.Div(h.Class("grid grid-cols-2 gap-3 sm:grid-cols-4"),
					mcCanvas("p1", "Message 1", 96),
					mcCanvas("c1", "Ciphertext 1", 96),
					mcCanvas("c2", "Ciphertext 2", 96),
					mcCanvas("x", "Ciphertext 1 ⊕ ciphertext 2", 96),
				),
				toggle("mc-nonce-fresh", "fresh", "Fresh nonce for message 2", false),
				mcButton("rekey", "New key", hugeicons.Key01Icon()),
				readouts([2]string{"nonce 1", "n1"}, [2]string{"nonce 2", "n2"}, [2]string{"c₁ ⊕ c₂ = p₁ ⊕ p₂", "same"}),
				mcNote("Shannon (1949) proved the one-time pad perfectly secret: with a truly random key used once, the ciphertext says nothing about the message. The proof needs the key used once. Real protocols get this from a unique nonce per message, which is why AES-GCM and ChaCha20-Poly1305 APIs make you pass one."),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func mcHmacBlock() Block {
	return Block{
		Slug:        "hmac",
		Title:       "HMAC: a tag only the key holder can make",
		Description: "A hash proves nothing about who sent a message: anyone can hash. A MAC mixes in a secret key. HMAC hashes twice, inner and outer, with the key padded and XORed with two constants. Edit the received message or tag and the check fails; only someone with the key can make a matching tag.",
		Tags:        []string{"HMAC-SHA-256", "RFC 2104", "integrity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-hmac",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Ol(h.Data("steps", ""), h.Class("flex flex-col gap-2"), h.Aria("label", "HMAC steps")),
					h.Div(h.Data("verdict", ""), h.Aria("live", "polite"), h.Class("rounded-lg border px-3 py-2 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Sender"),
					mcLabeled("Key", mcText("key", "correct horse battery staple", "Shared key")),
					mcLabeled("Message", mcText("msg", "pay 20 EUR to Bob", "Message")),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Receiver gets"),
					mcLabeled("Message", mcText("rmsg", "pay 20 EUR to Bob", "Received message")),
					mcLabeled("Tag (hex)", mcText("rtag", "", "Received tag")),
					mcButton("copytag", "Use the sender's tag", hugeicons.Copy01Icon()),
				),
				mcNote("HMAC (Bellare, Canetti & Krawczyk 1996; RFC 2104) is checked here against node:crypto. Do not build a MAC as SHA-256(key ‖ message): SHA-2's structure makes that unsafe, and HMAC's double hash is what avoids it. Compare tags in constant time in real code."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func mcAeadBlock() Block {
	return Block{
		Slug:        "authenticated-encryption",
		Title:       "Encryption is not integrity",
		Description: "Encryption hides a message but does not stop someone changing it. Flip one ciphertext bit under plain CTR and the same plaintext bit flips, silently. AES-GCM adds an authentication tag: the same flip makes decryption refuse to return anything. Click any ciphertext byte to flip its lowest bit.",
		Tags:        []string{"AES-GCM", "malleability", "AEAD"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-aead",
				h.Div(h.Class("grid gap-4 md:grid-cols-2"),
					h.Div(h.Class("flex min-w-0 flex-col gap-2"),
						panelLabel("AES-CTR, no tag"),
						h.Div(h.Data("bytes", "ctr"), h.Class("flex flex-wrap gap-0.5"), h.Role("group"), h.Aria("label", "CTR ciphertext bytes; press one to flip a bit")),
						h.Div(h.Data("result", "ctr"), h.Aria("live", "polite"), h.Class("rounded-lg border px-3 py-2 font-mono text-xs break-all")),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-2"),
						panelLabel("AES-GCM, 128-bit tag"),
						h.Div(h.Data("bytes", "gcm"), h.Class("flex flex-wrap gap-0.5"), h.Role("group"), h.Aria("label", "GCM ciphertext and tag bytes; press one to flip a bit")),
						h.Div(h.Data("result", "gcm"), h.Aria("live", "polite"), h.Class("rounded-lg border px-3 py-2 font-mono text-xs break-all")),
					),
				),
				mcLabeled("Message", mcText("msg", "amount=0100", "Message")),
				h.Div(h.Class("flex flex-wrap gap-2"),
					mcButton("encrypt", "Encrypt again", hugeicons.SquareLock02Icon()),
					mcButton("restore", "Undo flips", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"bits flipped", "flips"}, [2]string{"CTR decrypts to", "ctrout"}, [2]string{"GCM decrypts to", "gcmout"}),
				mcNote("Both use WebCrypto with a fresh random key and 96-bit nonce on each encryption. The last 16 GCM bytes are the tag. Use an AEAD mode (AES-GCM, ChaCha20-Poly1305) or encrypt-then-MAC, never encryption alone."),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func mcShamirBlock() Block {
	return Block{
		Slug:        "secret-sharing",
		Title:       "Shamir's secret sharing",
		Description: "Hide a secret as the value at x = 0 of a random polynomial of degree k − 1 over a prime field, and hand out points as shares. Any k shares pin down the polynomial by Lagrange interpolation; k − 1 shares fit every possible secret equally well, so they reveal nothing.",
		Tags:        []string{"Shamir 1979", "threshold", "Lagrange"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-shamir",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 340"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "The sharing polynomial over the field of 97 elements, with the shares marked")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Split"),
					field("secret", "secret (0–96)", "", 42, 0, 96, 1),
					field("k", "threshold k", "shares", 3, 2, 5, 1),
					field("n", "shares n", "", 5, 2, 8, 1),
					mcButton("reshare", "New polynomial", hugeicons.RefreshIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Shares you hold"),
					h.Div(h.Data("shares", ""), h.Class("flex flex-wrap gap-1"), h.Role("group"), h.Aria("label", "Shares to combine")),
				),
				readouts([2]string{"field", "field"}, [2]string{"reconstructed", "rec"}, [2]string{"secrets still possible", "possible"}),
				mcNote("Arithmetic is mod 97 so the polynomial's points fit the plot; real systems use a large prime field or GF(2⁸) per byte. The faint dots are other polynomials through the same shares, one for each secret they cannot rule out."),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func mcZkpBlock() Block {
	return Block{
		Slug:        "zero-knowledge",
		Title:       "A zero-knowledge proof of a 3-colouring",
		Description: "The prover knows a way to colour the graph with three colours so no edge joins two equal colours, and wants to convince you without showing it. Each round they shuffle the colour names, commit to every vertex with a hash, and you open one edge of your choice: two different colours. A cheater is caught with probability at least 1/|E| each round.",
		Tags:        []string{"GMW 1986", "commitments", "soundness"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-zkp",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Svg(h.Data("graph", ""), h.ViewBox("0 0 320 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "The graph; the opened edge is highlighted")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 320 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Chance a cheating prover survives, against rounds")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Prover"),
					segs("Prover", [2]string{"honest", "Honest"}, [2]string{"cheat", "Cheating"}),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					mcButton("round", "One round", hugeicons.ArrowRight01Icon()),
					mcButton("rounds", "50 rounds", hugeicons.ArrowRightDoubleIcon()),
					mcButton("reset", "Reset", hugeicons.RefreshIcon()),
				),
				h.Ol(h.Data("log", ""), h.Class("flex max-h-32 flex-col gap-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground"), h.Aria("live", "polite")),
				readouts([2]string{"rounds passed", "passed"}, [2]string{"caught", "caught"}, [2]string{"P(cheater survives)", "psurvive"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func mcStretchBlock() Block {
	return Block{
		Slug:        "key-stretching",
		Title:       "Stretching a password into a key",
		Description: "A password has little entropy, so a key derived from it must be slow to compute: PBKDF2 repeats HMAC thousands of times. Your browser times real PBKDF2-SHA-256 below; the chart shows how iterations stretch an attacker's search for passwords of different strength.",
		Tags:        []string{"PBKDF2", "WebCrypto", "entropy"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-stretch",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Expected time to search half the password space against iterations")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Derivation"),
					field("iter", "iterations", "×1000", 600, 1, 2000, 1),
					field("bits", "password entropy", "bits", 40, 20, 80, 1),
					field("speedup", "attacker vs this browser", "×", 1000, 1, 100000, 1),
					mcButton("time", "Time it here", hugeicons.Timer02Icon()),
				),
				readouts([2]string{"one derivation here", "ms"}, [2]string{"attacker guesses/s", "rate"}, [2]string{"time to search half", "crack"}),
				mcNote("OWASP's 2023 guidance is 600 000 iterations for PBKDF2-HMAC-SHA-256. The attacker speedup is an assumption you set (GPUs run many derivations in parallel); memory-hard functions such as scrypt and Argon2id blunt that advantage. See the Security collection for how to store passwords."),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func mcLweBlock() Block {
	return Block{
		Slug:        "lattice-lwe",
		Title:       "Encrypting a bit with noisy equations (toy LWE)",
		Description: "Learning with errors, the idea behind the post-quantum standard ML-KEM: the public key is a set of linear equations in a secret vector, each off by a small random error. To encrypt a bit, add up a random subset of equations and shift by q/2 for a 1. Decryption subtracts the secret part and reads which half of the circle the result is in, which works while the summed errors stay below q/4.",
		Tags:        []string{"Regev 2005", "post-quantum", "noise"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-lwe",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Decrypted values on the circle of integers mod q, for bits 0 and 1")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Parameters"),
					field("q", "modulus q", "", 257, 31, 3329, 2),
					field("n", "secret length n", "", 8, 2, 32, 1),
					field("m", "equations m", "", 24, 4, 64, 1),
					field("e", "error bound", "±", 2, 0, 40, 1),
					mcButton("run", "Encrypt 400 bits", hugeicons.SquareLock02Icon()),
				),
				readouts([2]string{"worst-case noise", "worst"}, [2]string{"q/4", "quarter"}, [2]string{"decryption errors", "errors"}),
				mcNote("Toy parameters, wildly insecure: real ML-KEM (FIPS 203) uses module lattices with n = 256 polynomials, q = 3329 and carefully shaped noise. The dots are the values the decryptor sees; inside the shaded half nearest 0 they read as 0, otherwise as 1."),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func mcTlsBlock() Block {
	return Block{
		Slug:        "tls13-handshake",
		Title:       "The TLS 1.3 handshake",
		Description: "Every HTTPS connection starts with this exchange, in one round trip. Step through it: the key share gives both sides a Diffie–Hellman secret, the certificate and its signature prove the server is who it says, and the Finished messages check that nobody altered the transcript.",
		Tags:        []string{"RFC 8446", "ECDHE", "forward secrecy"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mc-tls",
				h.Svg(h.Data("seq", ""), h.ViewBox("0 0 640 420"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Message sequence between client and server")),
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex items-center justify-between gap-2"), panelLabel("Message"), h.Span(h.Data("out", "count"), h.Class("font-mono text-xs"), "—")),
					h.H3(h.Data("name", ""), h.Class("font-medium tracking-tight"), "—"),
					h.P(h.Data("what", ""), h.Aria("live", "polite"), h.Class("text-sm leading-relaxed text-pretty text-muted-foreground")),
				),
				h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs"),
					h.Dt(h.Class("text-muted-foreground"), "proves"), h.Dd(h.Data("out", "proves"), "—"),
					h.Dt(h.Class("text-muted-foreground"), "encrypted"), h.Dd(h.Data("out", "enc"), "—"),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					mcButton("prev", "Back", hugeicons.ArrowLeft01Icon()),
					mcButton("next", "Next", hugeicons.ArrowRight01Icon()),
				),
				mcNote("Simplified: no HelloRetryRequest, no session resumption or 0-RTT, and the key schedule (HKDF) is summarised. Messages after ServerHello are encrypted with handshake keys; application data uses separate traffic keys."),
			)
		},
	}
}
