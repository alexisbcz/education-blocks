package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LlmBlocks lists the large language models gallery in display order. Every
// model here is a toy trained or computed in the browser: the mechanisms are
// the real ones, the scale is not.
func LlmBlocks() []Block {
	return []Block{
		llmTokenizerBlock(),
		llmNgramBlock(),
		llmEmbeddingsBlock(),
		llmAttentionBlock(),
		llmPositionsBlock(),
		llmTinyModelBlock(),
		llmSamplingBlock(),
		llmCostBlock(),
		llmPipelineBlock(),
		llmEvaluationBlock(),
	}
}

// llmCorpus is the opening of Lewis Carroll, Alice's Adventures in
// Wonderland (1865), chapter I, public domain.
const llmCorpus = `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'
So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.
In another moment down went Alice after it, never once considering how in the world she was to get out again.
The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.`

// llmCorpusData carries the corpus to the page once per block that needs it.
func llmCorpusData() h.Node {
	return h.Template(h.Data("llm-corpus", ""), llmCorpus)
}

func llmSource() h.Node {
	return h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"),
		"Text: Lewis Carroll, ", h.Em("Alice's Adventures in Wonderland"), " (1865), chapter I, public domain.")
}

func llmTextarea(attr, value string, rows int) h.Node {
	return h.Textarea(h.Data(attr, ""), h.Attr("rows", fmt.Sprint(rows)), h.Attr("spellcheck", "false"),
		h.Aria("label", "Training text"),
		h.Class("w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-base leading-relaxed shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-[13px]"),
		value)
}

func llmButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, h.Span(h.Data("label", ""), label))
}

// ---------------------------------------------------------------- L1

func llmTokenizerBlock() Block {
	return Block{
		Slug:        "tokenizer",
		Title:       "Byte-pair encoding",
		Description: "How text becomes tokens. BPE starts from characters and repeatedly merges the most frequent adjacent pair into a new token. Train it on any text, watch the vocabulary grow, and check that decoding gives back exactly what you typed.",
		Tags:        []string{"tokenizer", "BPE", "round trip"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("llm-bpe", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-3"),
					llmTextarea("text", "the cat sat on the mat. the cat ate the rat. then the cat sat on the hat.", 3),
					h.Div(h.Data("tokens", ""), h.Aria("live", "polite"), h.Class("flex min-h-16 flex-wrap gap-1 rounded-lg border bg-code p-3 font-mono text-[13px]")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Merges, in order"),
						h.Ol(h.Data("merges", ""), h.Class("scroll-thin flex max-h-40 flex-wrap gap-1 overflow-y-auto font-mono text-[12px]")),
					),
				),
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Training"),
						field("merges", "Merges", "", 12, 0, 120, 1)),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						llmButton("step", "Merge once", hugeicons.ArrowRight01Icon()),
						llmButton("reset", "Reset", hugeicons.RefreshIcon())),
					readouts([2]string{"characters", "chars"}, [2]string{"vocabulary", "vocab"}, [2]string{"tokens", "ntok"}, [2]string{"tokens / word", "tpw"}, [2]string{"round trip", "roundtrip"}),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
						"This BPE works on characters. Production tokenizers usually run it on UTF-8 bytes (byte-level BPE, as in GPT-2), so any string can be encoded with a base vocabulary of 256 symbols."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L2

func llmNgramBlock() Block {
	return Block{
		Slug:        "ngram",
		Title:       "N-gram language model",
		Description: "The simplest language model: count which character follows each context of n − 1 characters, then sample. Perplexity on held-out text shows how surprised the model is; longer contexts fit the training text better but generalise worse without smoothing.",
		Tags:        []string{"counts", "perplexity", "sampling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("llm-ngram",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Next character after the context"),
						h.Div(h.Class("flex items-center gap-2"),
							h.Input(h.Type("text"), h.Data("context", ""), h.Value("the"), h.Attr("maxlength", "12"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"), h.Aria("label", "Context"),
								h.Class("h-9 w-36 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
							h.Span(h.Data("out", "used"), h.Class("font-mono text-xs text-muted-foreground"))),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Next-character distribution")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Sampled text"),
						h.P(h.Data("sample", ""), h.Class("min-h-16 rounded-lg border bg-background p-3 font-mono text-[13px] leading-relaxed break-words")),
					),
					llmCorpusData(),
					llmSource(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					segs("Order", [2]string{"1", "n = 1"}, [2]string{"2", "n = 2"}, [2]string{"3", "n = 3"}, [2]string{"5", "n = 5"}),
					field("k", "Smoothing k", "", 0.01, 0.001, 1, 0.001),
					field("temp", "Temperature", "", 1, 0.1, 3, 0.05),
				),
				llmButton("sample", "Sample 200 chars", hugeicons.DiceIcon()),
				readouts([2]string{"train chars", "ntrain"}, [2]string{"held-out", "ntest"}, [2]string{"alphabet", "alpha"}, [2]string{"train PPL", "pptrain"}, [2]string{"held-out PPL", "pptest"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L3

func llmEmbeddingsBlock() Block {
	return Block{
		Slug:        "embeddings",
		Title:       "Word embeddings",
		Description: "Words that appear in similar contexts get similar vectors. Here: co-occurrence counts in a small made-up corpus, reweighted by positive PMI, then compressed to a few dimensions by a truncated SVD. Click a coloured word to list its nearest neighbours by cosine similarity.",
		Tags:        []string{"PPMI", "SVD", "cosine"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("llm-embed",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 380"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Two-dimensional projection of the word vectors")),
					h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"),
						"Corpus: about seventy short sentences written for this block (animals, royalty, food, cities), with filler words removed. At this toy scale neighbours are informative but word analogies are noisy; real embeddings are trained on billions of words."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Space"),
					field("dims", "Dimensions", "", 6, 2, 12, 1),
					field("window", "Window", "words", 2, 1, 4, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Nearest neighbours"),
					h.P(h.Data("out", "word"), h.Class("text-sm font-medium"), "Click a word"),
					h.Ol(h.Data("neighbours", ""), h.Class("flex flex-col gap-1 font-mono text-xs")),
				),
				readouts([2]string{"vocabulary", "vocab"}, [2]string{"variance kept", "kept"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L4

func llmAttentionBlock() Block {
	return Block{
		Slug:        "attention",
		Title:       "Attention, step by step",
		Description: "Scaled dot-product attention on five tokens with every matrix shown: X times W gives Q, K and V; scores QKᵀ/√d; the causal mask hides the future; softmax turns each row into weights; the output mixes the value vectors. Weights are seeded random, as in an untrained model.",
		Tags:        []string{"QKV", "softmax", "causal mask"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("llm-attn", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					segs("Step", [2]string{"qkv", "Q, K, V"}, [2]string{"scores", "Scores"}, [2]string{"mask", "Masked"}, [2]string{"weights", "Softmax"}, [2]string{"output", "Output"}),
					toggle("llm-attn-causal", "causal", "Causal mask", true),
					llmButton("reseed", "New weights", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Data("stage", ""), h.Class("scroll-thin overflow-x-auto rounded-lg border bg-code p-3")),
				h.P(h.Data("explain", ""), h.Aria("live", "polite"), h.Class("max-w-[70ch] text-sm leading-relaxed text-muted-foreground")),
				h.Div(h.Class("flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs"),
					h.Span(h.Span(h.Class("text-muted-foreground"), "d_k "), "4"),
					h.Span(h.Span(h.Class("text-muted-foreground"), "row sums "), h.Span(h.Data("out", "rowsum"), "—")),
					h.Span(h.Span(h.Class("text-muted-foreground"), "masked weight "), h.Span(h.Data("out", "masked"), "—")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L5

func llmPositionsBlock() Block {
	return Block{
		Slug:        "positions",
		Title:       "Positional encodings and heads",
		Description: "Attention by itself ignores word order, so positions are added to the token vectors. The sinusoidal encoding of Vaswani et al. (2017) gives each position a pattern of sines and cosines at geometric wavelengths; nearby positions get similar codes. Multi-head attention splits d_model into heads that attend independently.",
		Tags:        []string{"sinusoidal", "Vaswani 2017", "multi-head"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("llm-pe",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("PE(pos, i)"),
						h.Canvas(h.Data("pe", ""), h.Class("aspect-square w-full rounded-md border"), h.Role("img"), h.Aria("label", "Positional encoding heatmap"))),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("PE(p) · PE(q)"),
						h.Canvas(h.Data("dot", ""), h.Class("aspect-square w-full rounded-md border"), h.Role("img"), h.Aria("label", "Dot products between positions"))),
					h.Div(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground sm:col-span-2"),
						"PE(pos, 2i) = sin(pos / 10000^(2i/d)) · PE(pos, 2i+1) = cos(pos / 10000^(2i/d)). Rows are positions, columns dimensions; pink is positive, blue negative. Right: dot products divided by d/2."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Encoding"),
					field("d", "d_model", "", 64, 8, 256, 8),
					field("n", "Positions", "", 64, 8, 128, 8),
					field("heads", "Heads", "", 8, 1, 16, 1),
				),
				readouts([2]string{"d per head", "dhead"}, [2]string{"longest λ", "lambda"}, [2]string{"shift check", "check"}),
				h.P(h.Data("out", "heads"), h.Class("text-xs leading-relaxed text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- L6

func llmTinyModelBlock() Block {
	return Block{
		Slug:        "tiny-model",
		Title:       "Train a tiny language model",
		Description: "A character-level neural language model trained in your browser by backpropagation and Adam: three previous characters are embedded, passed through a tanh layer, and a softmax predicts the next one (the architecture of Bengio et al. 2003, at toy size). It is not a transformer, but it learns the same objective: next-token cross-entropy. On a text this short it memorises quickly; weight decay (decoupled, as in AdamW) holds the validation loss down. Set it to 0 to watch it overfit.",
		Tags:        []string{"backprop", "Adam", "cross-entropy"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("llm-tiny",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("loss", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Training and validation loss")),
					h.Div(h.Class("flex flex-col gap-1"),
						panelLabel("Sample from the model"),
						h.P(h.Data("sample", ""), h.Class("min-h-20 rounded-lg border bg-background p-3 font-mono text-[13px] leading-relaxed break-words"), "Press Train, then Sample."),
					),
					llmCorpusData(),
					llmSource(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					field("hidden", "Hidden units", "", 32, 8, 128, 8),
					field("lr", "Learning rate", "", 0.003, 0.001, 0.05, 0.001),
					field("wd", "Weight decay", "", 0.1, 0, 1, 0.01),
					field("temp", "Temperature", "", 0.8, 0.1, 2, 0.05),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
						hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Train")),
					llmButton("reset", "Reset", hugeicons.RefreshIcon()),
					h.Div(h.Class("col-span-2"), llmButton("sample", "Sample 160 chars", hugeicons.DiceIcon())),
				),
				readouts([2]string{"steps", "steps"}, [2]string{"train loss", "train"}, [2]string{"val loss", "val"}, [2]string{"uniform loss", "uniform"}, [2]string{"parameters", "params"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L7

func llmSamplingBlock() Block {
	return Block{
		Slug:        "sampling",
		Title:       "Decoding strategies",
		Description: "A model outputs a probability for every token; decoding decides which one to emit. Greedy takes the top token, temperature reshapes the distribution, top-k keeps the k most likely, and top-p (nucleus sampling, Holtzman et al. 2019) keeps the smallest set whose probability reaches p. Softmax itself is in the Machine Learning collection.",
		Tags:        []string{"top-k", "top-p", "temperature"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("llm-sampling", ""),
				h.P(h.Class("text-base"), h.Span(h.Class("text-muted-foreground"), "Once upon a "),
					h.Span(h.Data("out", "pick"), h.Class("inline-block min-w-12 rounded-md border border-dashed px-2 font-medium text-brand"), "___")),
				segs("Strategy", [2]string{"greedy", "Greedy"}, [2]string{"temperature", "Temperature"}, [2]string{"topk", "Top-k"}, [2]string{"topp", "Top-p"}),
				h.Div(h.Class("grid gap-2 sm:grid-cols-3"),
					field("temp", "Temperature", "", 1, 0.05, 3, 0.05),
					field("k", "k", "", 3, 1, 10, 1),
					field("p", "p", "", 0.9, 0.05, 1, 0.01),
				),
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Token probabilities before and after truncation")),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
					h.Div(h.Class("flex gap-2"),
						llmButton("sample", "Sample", hugeicons.DiceIcon()),
						llmButton("sample1000", "×1000", hugeicons.DiceIcon()),
					),
					h.Span(h.Class("font-mono text-xs text-muted-foreground"), "kept ", h.Span(h.Data("out", "kept"), h.Class("text-foreground"), "—"),
						" · mass ", h.Span(h.Data("out", "mass"), h.Class("text-foreground"), "—"),
						" · entropy ", h.Span(h.Data("out", "entropy"), h.Class("text-foreground"), "—")),
				),
				h.P(h.Data("out", "tally"), h.Class("min-h-4 font-mono text-[11px] text-muted-foreground")),
				h.P(h.Class("text-xs text-muted-foreground"), "The logits are illustrative. ",
					h.A(h.Href("/ml#softmax"), h.Class("underline underline-offset-4 hover:text-foreground"), "How softmax and temperature work →")),
			)
		},
	}
}

// ---------------------------------------------------------------- L8

func llmCostBlock() Block {
	return Block{
		Slug:        "context-cost",
		Title:       "Parameters, context and the KV cache",
		Description: "Back-of-the-envelope sizes for a decoder-only transformer. Parameters are about 12·L·d² for the blocks plus the embedding table; while generating, every layer caches a key and a value per head per token, so memory grows with the context; attention compute grows with its square.",
		Tags:        []string{"KV cache", "O(n²)", "estimates"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("llm-cost",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "KV cache memory and attention cost against context length")),
					h.Div(h.Class("flex flex-col gap-1 font-mono text-[11px] leading-relaxed text-muted-foreground"),
						h.Span("params ≈ 12·L·d² + V·d"),
						h.Span("KV cache = 2 · L · heads · d_head · n · batch · bytes"),
						h.Span("attention FLOPs ≈ 4 · L · n² · d for a full pass (QKᵀ and the weighted sum)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Architecture"),
					field("layers", "Layers L", "", 24, 1, 96, 1),
					field("d", "d_model", "", 2048, 128, 12288, 128),
					field("heads", "Heads", "", 16, 1, 96, 1),
					field("vocab", "Vocabulary", "", 50000, 1000, 256000, 1000),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Generation"),
					field("n", "Context n", "tokens", 4096, 128, 131072, 128),
					field("batch", "Batch", "", 1, 1, 64, 1),
					segs("Precision", [2]string{"2", "fp16"}, [2]string{"1", "int8"}, [2]string{"4", "fp32"}),
				),
				readouts([2]string{"parameters", "params"}, [2]string{"weights", "weights"}, [2]string{"KV cache", "kv"}, [2]string{"KV per token", "kvtok"}, [2]string{"attention FLOPs", "flops"}),
				h.P(h.Class("text-xs text-muted-foreground"), "Estimates for illustrative sizes; real models add biases, normalisation, grouped-query attention and other variations."),
			)
		},
	}
}

// ---------------------------------------------------------------- L9

type llmStage struct {
	name, data, objective, result string
}

var llmStages = []llmStage{
	{"Pretraining", "Large amounts of text, mostly from the web, books and code.",
		"Predict the next token: minimise cross-entropy over the whole corpus.",
		"A base model that continues text fluently and has absorbed many facts and patterns, but does not reliably follow instructions."},
	{"Supervised fine-tuning", "Demonstrations: prompts paired with responses written by people.",
		"The same next-token loss, but only on the demonstrated responses.",
		"A model that answers in the style of the demonstrations: follows instructions, stays on task."},
	{"Reward model", "Comparisons: people rank several responses to the same prompt.",
		"Train a model to give the preferred response a higher score.",
		"A learned stand-in for human preferences, cheap to query."},
	{"Preference optimisation", "Prompts, the policy's own samples, and the reward model.",
		"Maximise reward with a penalty for drifting from the fine-tuned model (RLHF with PPO in InstructGPT). Direct Preference Optimization (Rafailov et al. 2023) skips the explicit reward model.",
		"Responses people prefer more often; Ouyang et al. (2022) found their 1.3B-parameter InstructGPT outputs preferred to those of the 175B GPT-3."},
}

func llmPipelineBlock() Block {
	return Block{
		Slug:        "pipeline",
		Title:       "From base model to assistant",
		Description: "The training stages behind instruction-following models, as described for InstructGPT (Ouyang et al. 2022): pretraining on next-token prediction, supervised fine-tuning on demonstrations, then learning from human preferences.",
		Tags:        []string{"SFT", "RLHF", "InstructGPT"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("llm-pipeline", ""),
				h.Ol(h.Class("grid grid-cols-4 gap-1.5"),
					h.MapIdx(llmStages, func(i int, s llmStage) h.Node {
						return h.Li(h.Button(h.Type("button"), h.Data("stage", fmt.Sprint(i)),
							h.Class("flex h-full w-full flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors duration-150 outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/8"),
							h.If(i == 0, h.Data("on", "")),
							h.Span(h.Class("font-mono text-[10px] text-muted-foreground"), fmt.Sprintf("%d", i+1)),
							h.Span(h.Class("font-medium"), s.name)))
					}),
				),
				h.MapIdx(llmStages, func(i int, s llmStage) h.Node {
					return h.Dl(h.Data("panel", fmt.Sprint(i)), h.If(i != 0, h.Hidden()),
						h.Class("grid gap-3 rounded-lg border bg-background p-4 text-sm leading-relaxed sm:grid-cols-3"),
						h.Div(h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Data"), h.Dd(s.data)),
						h.Div(h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Objective"), h.Dd(s.objective)),
						h.Div(h.Dt(h.Class("mb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Result"), h.Dd(s.result)),
					)
				}),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
					"Ouyang et al., “Training language models to follow instructions with human feedback”, NeurIPS 2022. Recipes vary between labs and change quickly; this is the published outline, not any specific product's."),
			)
		},
	}
}

// ---------------------------------------------------------------- L10

func llmEvaluationBlock() Block {
	return Block{
		Slug:        "evaluation",
		Title:       "Confident errors and evaluation",
		Description: "Why a fluent model can be wrong with confidence, and how models are measured. The demo asks a character trigram model, trained on the same Alice text, for its most likely continuation: it always produces an answer, and nothing in it is checked against the world.",
		Tags:        []string{"hallucination", "perplexity", "benchmarks"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("llm-eval", ""),
				h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-4"),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "trigram, greedy"),
						h.Span(h.Class("text-sm text-muted-foreground"), "Continue a prompt the model has never seen:")),
					h.Div(h.Class("flex flex-wrap items-center gap-2"),
						h.Input(h.Type("text"), h.Data("prompt", ""), h.Value("the queen of"), h.Attr("maxlength", "40"), h.Attr("autocomplete", "off"), h.Aria("label", "Prompt"),
							h.Class("h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
						llmButton("continue", "Continue", hugeicons.ArrowRight01Icon())),
					h.P(h.Data("out", "continuation"), h.Class("min-h-6 font-mono text-[13px]")),
					h.P(h.Data("out", "confidence"), h.Class("font-mono text-xs text-muted-foreground")),
					llmCorpusData(),
				),
				h.Ul(h.Class("grid gap-3 text-sm leading-relaxed sm:grid-cols-2"),
					h.Li(h.Class("rounded-lg border p-3"), h.Span(h.Class("font-medium"), "Next-token training rewards plausibility. "),
						h.Span(h.Class("text-muted-foreground"), "The loss measures how likely the text is, not whether it is true; where the training data is thin, the most likely continuation can be a confident invention.")),
					h.Li(h.Class("rounded-lg border p-3"), h.Span(h.Class("font-medium"), "Perplexity "),
						h.Span(h.Class("text-muted-foreground"), "(the exponential of the average cross-entropy) measures fit to held-out text; lower is better, but it says little about usefulness or truth.")),
					h.Li(h.Class("rounded-lg border p-3"), h.Span(h.Class("font-medium"), "Benchmarks "),
						h.Span(h.Class("text-muted-foreground"), "test held-out questions with known answers. Results can be inflated by contamination: test items that leaked into the training data.")),
					h.Li(h.Class("rounded-lg border p-3"), h.Span(h.Class("font-medium"), "Human evaluation "),
						h.Span(h.Class("text-muted-foreground"), "compares responses side by side; it captures preference and helpfulness but is costly and can reward confident style.")),
				),
				h.P(h.Class("text-xs text-muted-foreground"), "Grounding answers in retrieved sources, asking models to abstain when unsure, and checking claims are common mitigations; none removes errors entirely."),
			)
		},
	}
}
