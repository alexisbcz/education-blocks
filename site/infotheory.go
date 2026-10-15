package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// InfotheoryBlocks lists the information theory gallery in display order.
// Every number is computed in static/js/infotheory.js from the text or the
// distribution on screen: entropies in bits, codes built step by step,
// CRC-32 with the standard reflected polynomial.
func InfotheoryBlocks() []Block {
	return []Block{
		infoEntropyBlock(),
		infoHuffmanBlock(),
		infoArithmeticBlock(),
		infoLZ77Block(),
		infoBWTBlock(),
		infoChannelBlock(),
		infoCRCBlock(),
		infoMutualBlock(),
		infoDCTBlock(),
		infoQuestionsBlock(),
	}
}

const infoFieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-base shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"

// infoInput is a one-line text input read by the block's script.
func infoInput(name, label, value string) h.Node {
	return h.Label(h.Class("flex flex-col gap-1.5"),
		h.Span(h.Class("text-xs text-muted-foreground"), label),
		h.Input(h.Type("text"), h.Data("info-text", name), h.Value(value), h.Attr("autocomplete", "off"),
			h.Attr("spellcheck", "false"), h.Attr("autocapitalize", "off"), h.Class(infoFieldClass)),
	)
}

// infoPresets is a row of small outline buttons that fill an input.
func infoPresets(target string, presets ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-1.5"),
		h.Map(presets, func(p [2]string) h.Node {
			return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"),
				h.Data("info-preset", target), h.Data("value", p[1]), p[0])
		}),
	)
}

func infoAction(name, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", name), icon, label)
}

// infoPanel stacks controls above a full-width picture, for blocks whose
// output is text-heavy (tables, bit strings) rather than a plot.
func infoPanel(attr string, children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-4 overflow-hidden rounded-xl border bg-background p-4 sm:p-5"), h.Data(attr, "")}, children...)...)
}

// ---------------------------------------------------------------- I1

func infoEntropyBlock() Block {
	return Block{
		Slug:        "entropy",
		Title:       "Shannon entropy",
		Description: "How many bits a symbol really carries. Type any text: each symbol's surprisal is −log₂ p, and the entropy H is their average. A fair coin is exactly 1 bit; a predictable text sits well below log₂ of its alphabet size.",
		Tags:        []string{"entropy", "surprisal", "bits"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("info-entropy",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Symbol probabilities and surprisal")),
				h.Div(h.Class("flex flex-col gap-2"),
					infoInput("text", "Text (symbols are characters)", "abracadabra"),
					infoPresets("text", [2]string{"Fair coin", "HT"}, [2]string{"Biased", "HHHHHHHT"}, [2]string{"abracadabra", "abracadabra"},
						[2]string{"Sentence", "the quick brown fox jumps over the lazy dog"}, [2]string{"One symbol", "aaaaaaaa"}),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "p(x)"), legendSwatch("var(--brand)", "−log₂ p(x)")),
				readouts([2]string{"H", "h"}, [2]string{"log₂ n", "hmax"}, [2]string{"efficiency", "eff"}, [2]string{"symbols", "n"}, [2]string{"N × H", "total"}),
			)
		},
	}
}

// ---------------------------------------------------------------- I2

func infoHuffmanBlock() Block {
	return Block{
		Slug:        "huffman",
		Title:       "Huffman coding",
		Description: "The optimal prefix code, built one merge at a time: repeatedly join the two least frequent nodes. Frequent symbols get short codes, and the average length always lands between H and H + 1 bits.",
		Tags:        []string{"prefix code", "tree", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return infoPanel("info-huffman",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"),
					infoInput("text", "Message", "abracadabra"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						infoAction("back", "Back", hugeicons.ArrowLeft01Icon()),
						infoAction("next", "Merge", hugeicons.ArrowRight01Icon()),
						infoAction("all", "Build all", hugeicons.FlashIcon()),
					),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
					h.Div(h.Class("min-w-0 rounded-lg border bg-code p-2"),
						h.Svg(h.Data("tree", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Huffman tree"))),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.P(h.Data("step", ""), h.Aria("live", "polite"), h.Class("min-h-10 text-sm text-muted-foreground")),
						h.Div(h.Class("scroll-thin max-h-56 overflow-auto"), h.Table(h.Class("w-full font-mono text-xs"), h.Data("codes", ""))),
					),
				),
				h.Div(h.Class("flex flex-col gap-1"),
					panelLabel("Encoded bits"),
					h.P(h.Data("bits", ""), h.Class("font-mono text-xs leading-relaxed break-all text-muted-foreground")),
				),
				readouts([2]string{"average length", "avg"}, [2]string{"entropy H", "h"}, [2]string{"encoded", "size"}, [2]string{"decodes back", "decode"}),
			)
		},
	}
}

// ---------------------------------------------------------------- I3

func infoArithmeticBlock() Block {
	return Block{
		Slug:        "arithmetic",
		Title:       "Arithmetic coding",
		Description: "A whole message becomes one number. Each symbol narrows the interval [low, high) in proportion to its probability; the final width is the message's probability, so about −log₂ of it bits suffice, beating Huffman's whole-bit codes.",
		Tags:        []string{"intervals", "exact fractions", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return infoPanel("info-arith",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"),
					infoInput("text", "Message over A, B, C (p = 1/2, 1/4, 1/4)", "ABACAB"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						infoAction("back", "Back", hugeicons.ArrowLeft01Icon()),
						infoAction("next", "Next symbol", hugeicons.ArrowRight01Icon()),
						infoAction("all", "All", hugeicons.FlashIcon()),
					),
				),
				h.Div(h.Class("rounded-lg border bg-code p-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Interval narrowing"))),
				h.P(h.Data("step", ""), h.Aria("live", "polite"), h.Class("min-h-5 font-mono text-xs text-muted-foreground")),
				readouts([2]string{"interval", "interval"}, [2]string{"width = P(message)", "width"}, [2]string{"−log₂ width", "ideal"}, [2]string{"code (bits)", "code"}),
				h.P(h.Class("text-xs text-muted-foreground"), "Bounds are exact fractions (BigInt numerators over powers of 2), so nothing is rounded."),
			)
		},
	}
}

// ---------------------------------------------------------------- I4

func infoLZ77Block() Block {
	return Block{
		Slug:        "lz77",
		Title:       "LZ77",
		Description: "Compression by pointing back. The encoder slides a window over what it has already seen and replaces each repeat with (offset, length, next symbol). It is the idea inside DEFLATE, gzip and PNG.",
		Tags:        []string{"sliding window", "triples", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return infoPanel("info-lz",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"),
					infoInput("text", "Input", "abracadabra abracadabra"),
					h.Div(h.Class("w-48"), field("window", "Window", "", 16, 2, 64, 1)),
					h.Div(h.Class("flex flex-wrap gap-2"),
						infoAction("back", "Back", hugeicons.ArrowLeft01Icon()),
						infoAction("next", "Step", hugeicons.ArrowRight01Icon()),
						infoAction("all", "All", hugeicons.FlashIcon()),
					),
				),
				h.Div(h.Data("strip", ""), h.Class("scroll-thin flex overflow-x-auto pb-1 font-mono text-sm"), h.Aria("label", "Window, match and lookahead")),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--vec-u)", "search window"), legendSwatch("var(--code-add)", "match"), legendSwatch("var(--brand)", "next symbol")),
				h.Div(h.Class("scroll-thin max-h-48 overflow-auto"), h.Ol(h.Data("triples", ""), h.Class("flex flex-wrap gap-1.5 font-mono text-xs"))),
				readouts([2]string{"triples", "count"}, [2]string{"input symbols", "len"}, [2]string{"decodes back", "decode"}),
			)
		},
	}
}

// ---------------------------------------------------------------- I5

func infoBWTBlock() Block {
	return Block{
		Slug:        "bwt",
		Title:       "Burrows–Wheeler and run lengths",
		Description: "A reversible shuffle that gathers equal letters together. Sort every rotation of the text and keep the last column: runs appear, move-to-front turns them into small numbers, and run-length encoding then has something to bite on. This is how bzip2 works.",
		Tags:        []string{"BWT", "move-to-front", "RLE"},
		Wide:        true,
		Render: func() h.Node {
			return infoPanel("info-bwt",
				h.Div(h.Class("flex flex-col gap-2"),
					infoInput("text", "Text ($ marks the end)", "banana"),
					infoPresets("text", [2]string{"banana", "banana"}, [2]string{"mississippi", "mississippi"}, [2]string{"abracadabra", "abracadabra"}),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-2"),
					h.Div(h.Class("flex min-w-0 flex-col gap-1.5"), panelLabel("Sorted rotations"),
						h.Div(h.Class("scroll-thin max-h-72 overflow-auto rounded-lg border bg-code p-2"), h.Ol(h.Data("rotations", ""), h.Class("font-mono text-xs leading-5")))),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Last column (BWT)"), h.P(h.Data("bwt", ""), h.Class("font-mono text-base break-all"))),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Move-to-front"), h.P(h.Data("mtf", ""), h.Class("font-mono text-xs break-all text-muted-foreground"))),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Run-length encoded"), h.P(h.Data("rle", ""), h.Class("font-mono text-xs break-all text-muted-foreground"))),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Inverted back"), h.P(h.Data("inverse", ""), h.Class("font-mono text-xs break-all"))),
					),
				),
				readouts([2]string{"runs in text", "runsText"}, [2]string{"runs in BWT", "runsBWT"}, [2]string{"zeros after MTF", "zeros"}),
			)
		},
	}
}

// ---------------------------------------------------------------- I6

func infoChannelBlock() Block {
	return Block{
		Slug:        "channel",
		Title:       "Noisy channels and Hamming(7,4)",
		Description: "A binary symmetric channel flips each bit with probability p; its capacity is C = 1 − H(p). Send a nibble through it with a repetition code or Hamming(7,4): click any bit to flip it and watch the syndrome point at the error. Hamming corrects every single flip.",
		Tags:        []string{"capacity", "error correction", "syndrome"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("info-channel",
				h.Div(h.Class("flex flex-col gap-4"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Capacity of the binary symmetric channel")),
					h.Div(h.Class("flex flex-col gap-3 rounded-lg border bg-background p-3"),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							h.Span(h.Class("w-20 text-xs text-muted-foreground"), "Data"),
							h.Div(h.Data("data", ""), h.Class("flex gap-1")),
						),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							h.Span(h.Class("w-20 text-xs text-muted-foreground"), "Sent"),
							h.Div(h.Data("sent", ""), h.Class("flex flex-wrap gap-1")),
						),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							h.Span(h.Class("w-20 text-xs text-muted-foreground"), "Received"),
							h.Div(h.Data("received", ""), h.Class("flex flex-wrap gap-1")),
						),
						h.Div(h.Class("flex flex-wrap items-center gap-2"),
							h.Span(h.Class("w-20 text-xs text-muted-foreground"), "Decoded"),
							h.Div(h.Data("decoded", ""), h.Class("flex gap-1")),
							h.Span(h.Data("verdict", ""), h.Aria("live", "polite"), h.Class("text-xs")),
						),
						h.P(h.Data("syndrome", ""), h.Class("font-mono text-xs text-muted-foreground")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Channel"), field("p", "Flip probability p", "", 0.11, 0, 0.5, 0.01)),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Code"),
					segs("Code", [2]string{"hamming", "Hamming(7,4)"}, [2]string{"repeat", "Repeat ×3"}),
					h.Div(h.Class("flex flex-wrap gap-2"),
						infoAction("noise", "Add noise", hugeicons.ShuffleIcon()),
						infoAction("clear", "No errors", hugeicons.RefreshIcon()),
					),
				),
				readouts([2]string{"H(p)", "hp"}, [2]string{"capacity C", "cap"}, [2]string{"code rate", "rate"}, [2]string{"P(block fails)", "fail"}),
			)
		},
	}
}

// ---------------------------------------------------------------- I7

func infoCRCBlock() Block {
	return Block{
		Slug:        "crc",
		Title:       "Parity, checksums and CRC-32",
		Description: "Detecting errors without correcting them. A parity bit catches any odd number of flips; a byte sum misses swapped bytes; CRC-32 (the polynomial in Ethernet, ZIP and PNG) divides the message as a polynomial over GF(2) and catches every burst up to 32 bits.",
		Tags:        []string{"CRC-32", "GF(2)", "detection"},
		Render: func() h.Node {
			return infoPanel("info-crc",
				h.Div(h.Class("flex flex-col gap-2"),
					infoInput("text", "Message", "123456789"),
					infoPresets("text", [2]string{"Check value", "123456789"}, [2]string{"Hello", "Hello, world"}, [2]string{"Swapped", "213456789"}),
				),
				h.Div(h.Class("flex flex-col gap-1.5"),
					panelLabel("Message bits (click a bit to flip it)"),
					h.Div(h.Data("bits", ""), h.Class("scroll-thin flex max-h-40 flex-wrap gap-0.5 overflow-auto font-mono text-[11px]")),
				),
				h.Div(h.Class("grid gap-2 sm:grid-cols-3"),
					infoCheckCard("parity", "Even parity"),
					infoCheckCard("sum", "Byte sum mod 256"),
					infoCheckCard("crc", "CRC-32"),
				),
				h.P(h.Class("text-xs text-muted-foreground"), "CRC-32: reflected polynomial 0xEDB88320, initial value and final XOR 0xFFFFFFFF. The standard check value of \"123456789\" is CBF43926."),
			)
		},
	}
}

func infoCheckCard(key, label string) h.Node {
	return h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-code p-3"),
		h.Span(h.Class("text-xs text-muted-foreground"), label),
		h.Span(h.Data("out", key), h.Class("font-mono text-base tabular-nums"), "—"),
		h.Span(h.Data("out", key+"-ok"), h.Class("text-xs"), ""),
	)
}

// ---------------------------------------------------------------- I8

func infoMutualBlock() Block {
	return Block{
		Slug:        "mutual-information",
		Title:       "Mutual information",
		Description: "How much knowing Y tells you about X. Edit the joint distribution of weather and umbrella: the entropies, the conditional entropies and I(X;Y) update, and I(X;Y) equals the KL divergence between the joint and the product of its marginals.",
		Tags:        []string{"joint entropy", "KL divergence", "Venn"},
		Wide:        true,
		Render: func() h.Node {
			cell := func(name string, v float64) h.Node {
				return h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", name), h.Value(fmt.Sprint(v)),
					h.Data("min", "0"), h.Data("max", "100"), h.Data("step", "1"), h.Attr("autocomplete", "off"), h.Aria("label", "Count "+name),
					h.Class("h-9 w-16 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-base tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring sm:text-sm"))
			}
			return plotPanel("info-mutual",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Entropy diagram")),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("Counts (rows X, columns Y)"),
					h.Div(h.Class("grid grid-cols-[auto_auto_auto] items-center gap-1.5 text-xs text-muted-foreground"),
						h.Span(), h.Span(h.Class("text-center"), "umbrella"), h.Span(h.Class("text-center"), "none"),
						h.Span("rain"), cell("c00", 30), cell("c01", 5),
						h.Span("dry"), cell("c10", 10), cell("c11", 55),
					),
					infoPresets("joint", [2]string{"Dependent", "30,5,10,55"}, [2]string{"Independent", "20,30,20,30"}, [2]string{"Identical", "50,0,0,50"}),
				),
				readouts([2]string{"H(X)", "hx"}, [2]string{"H(Y)", "hy"}, [2]string{"H(X,Y)", "hxy"}, [2]string{"H(X|Y)", "hxgy"}, [2]string{"I(X;Y)", "mi"}, [2]string{"KL(p‖pₓp_y)", "kl"}),
			)
		},
	}
}

// ---------------------------------------------------------------- I9

func infoDCTBlock() Block {
	return Block{
		Slug:        "dct",
		Title:       "Lossy compression with the DCT",
		Description: "JPEG's core idea on a generated test image. Each 8×8 block is turned into frequencies by the discrete cosine transform, divided by the standard luminance table scaled by quality, and rounded. Most high frequencies become zero; the PSNR says what that cost.",
		Tags:        []string{"DCT", "quantization", "PSNR"},
		Wide:        true,
		Render: func() h.Node {
			canvas := func(name, label string) h.Node {
				return h.Figure(h.Class("flex flex-col gap-1"),
					h.Canvas(h.Data("canvas", name), h.Width("128"), h.Height("128"), h.Class("aspect-square w-full rounded-md border [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", label)),
					h.Figcaption(h.Class("text-center text-[11px] text-muted-foreground"), label))
			}
			return plotPanel("info-dct",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid grid-cols-3 gap-2"),
						canvas("original", "Original"), canvas("decoded", "Decoded"), canvas("error", "Error ×4")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Quantized coefficients of the block under the pointer"),
						h.Div(h.Data("coeffs", ""), h.Class("grid grid-cols-8 gap-px font-mono text-[10px] tabular-nums"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Encoder"), field("quality", "Quality", "", 50, 1, 100, 1)),
				readouts([2]string{"nonzero coefficients", "nonzero"}, [2]string{"kept", "kept"}, [2]string{"PSNR", "psnr"}, [2]string{"table scale", "scale"}),
				h.P(h.Class("text-xs text-muted-foreground"), "Quality scaling follows the IJG libjpeg formula; there is no entropy coding here, so \"kept\" is the share of nonzero coefficients, a proxy for size."),
			)
		},
	}
}

// ---------------------------------------------------------------- I10

func infoQuestionsBlock() Block {
	return Block{
		Slug:        "twenty-questions",
		Title:       "Twenty questions and compressibility",
		Description: "A yes/no answer is worth at most one bit, so finding one of N equally likely numbers takes log₂ N questions when each splits the candidates in half. Below, gzip gives an upper bound on a string's information: a pattern compresses to almost nothing, random letters barely at all.",
		Tags:        []string{"information gain", "binary search", "gzip"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-3 lg:grid-cols-2"),
				infoPanel("info-questions",
					h.Div(h.Class("flex items-center justify-between gap-2"),
						panelLabel("Guess my number"),
						badge.Badge(badge.VariantOutline, h.Data("out", "range"), h.Class("font-mono text-[11px] font-normal"), "1 – 1000"),
					),
					h.P(h.Data("question", ""), h.Aria("live", "polite"), h.Class("min-h-6 text-base")),
					h.Div(h.Class("flex flex-wrap gap-2"),
						infoAction("yes", "Yes", hugeicons.Tick02Icon()),
						infoAction("no", "No", hugeicons.Cancel01Icon()),
						infoAction("restart", "New number", hugeicons.ShuffleIcon()),
					),
					h.Ol(h.Data("log", ""), h.Class("flex flex-col gap-1 font-mono text-xs text-muted-foreground")),
					readouts([2]string{"candidates left", "left"}, [2]string{"bits gained", "bits"}, [2]string{"log₂ 1000", "need"}),
					h.P(h.Class("text-xs text-muted-foreground"), "Think of a number between 1 and 1000 and answer honestly: \"Is it greater than …?\" always splits the candidates in half."),
				),
				infoPanel("info-kolmogorov",
					panelLabel("Compressed size as an upper bound"),
					h.Div(h.Data("rows", ""), h.Class("flex flex-col gap-2")),
					h.Label(h.Class("flex flex-col gap-1.5"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Your string"),
						h.Textarea(h.Data("info-text", "own"), h.Attr("rows", "3"), h.Attr("spellcheck", "false"), h.Class(infoFieldClass+" resize-y"), "to be or not to be, that is the question"),
					),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"The Kolmogorov complexity of a string, the length of its shortest description, is uncomputable; any real compressor only gives an upper bound. Sizes use the browser's gzip (CompressionStream), header included."),
				),
			)
		},
	}
}
