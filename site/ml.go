package site

import (
	"fmt"
	"strings"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// MLBlocks lists the machine learning gallery in display order.
func MLBlocks() []Block {
	return []Block{
		playgroundBlock(),
		gradientDescentBlock(),
		regressionBlock(),
		overfittingBlock(),
		activationsBlock(),
		softmaxBlock(),
		thresholdBlock(),
		kmeansBlock(),
		modelSummaryBlock(),
		trainingLoopBlock(),
	}
}

// plotPanel is the standard layout of a live model: the picture on the
// left (bg-code), the controls on the right.
func plotPanel(attr string, picture h.Node, controls ...any) h.Node {
	return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data(attr, ""),
		h.Div(h.Class("relative min-w-0 border-b bg-code p-3 lg:border-r lg:border-b-0"), picture),
		h.Div(append([]any{h.Class("flex flex-col gap-5 p-5")}, controls...)...),
	)
}

func readouts(rows ...[2]string) h.Node {
	return h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
		h.Map(rows, func(r [2]string) h.Node {
			return h.Group(h.Dt(h.Class("text-muted-foreground"), r[0]), h.Dd(h.Data("out", r[1]), h.Class("tabular-nums"), "—"))
		}),
	)
}

func segs(label string, opts ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", label),
		h.MapIdx(opts, func(i int, o [2]string) h.Node { return segButton(o[0], o[1], i == 0) }),
	)
}

func playPause() h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), "Train"))
}

// ---------------------------------------------------------------- M1

func playgroundBlock() Block {
	return Block{
		Slug:        "playground",
		Title:       "Neural network playground",
		Description: "A small neural network trained live in the browser: two hidden layers of tanh units, a sigmoid output, cross-entropy loss and Adam. Watch the decision boundary bend to the data; try a spiral with too few units.",
		Tags:        []string{"MLP", "backprop", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("mlp",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full"), h.Aria("label", "Decision boundary and training data"), h.Role("img")),
					),
					h.Svg(h.Data("loss", ""), h.ViewBox("0 0 460 70"), h.Class("mx-auto block w-full max-w-[460px]"), h.Role("img"), h.Aria("label", "Training loss")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Data"),
					segs("Dataset", [2]string{"circles", "Circles"}, [2]string{"xor", "XOR"}, [2]string{"moons", "Moons"}, [2]string{"spiral", "Spiral"}),
					field("noise", "Noise", "", 0.1, 0, 0.5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Model"),
					field("hidden", "Units / layer", "", 8, 1, 16, 1),
					field("lr", "Learning rate", "", 0.03, 0.001, 0.5, 0.001),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"epoch", "epoch"}, [2]string{"loss", "loss"}, [2]string{"accuracy", "acc"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M2

func gradientDescentBlock() Block {
	return Block{
		Slug:        "gradient-descent",
		Title:       "Gradient descent",
		Description: "Optimisation you can see. Click anywhere on the loss surface to drop the starting point, then step downhill. In the ravine, a learning rate just past 2/λ_max makes the path explode; momentum carries it through Rosenbrock's banana-shaped valley.",
		Tags:        []string{"optimiser", "momentum", "contours"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gd",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative mx-auto aspect-[4/3] w-full max-w-[560px] cursor-crosshair overflow-hidden rounded-lg border"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full")),
						h.Svg(h.Data("path", ""), h.ViewBox("0 0 400 300"), h.Attr("preserveAspectRatio", "none"), h.Class("absolute inset-0 size-full"),
							h.Role("img"), h.Aria("label", "Loss surface and the optimiser's path. Click to set the start.")),
					),
					h.Svg(h.Data("loss", ""), h.ViewBox("0 0 560 70"), h.Class("mx-auto block w-full max-w-[560px]"), h.Role("img"), h.Aria("label", "Loss per step")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Surface"),
					segs("Loss surface", [2]string{"ravine", "Ravine"}, [2]string{"rosenbrock", "Rosenbrock"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Optimiser"),
					field("lr", "Learning rate", "", 0.09, 0.0001, 0.2, 0.0001),
					field("beta", "Momentum β", "", 0, 0, 0.99, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
						hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Run")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "step"), hugeicons.ArrowRight01Icon(), "Step")),
				readouts([2]string{"step", "step"}, [2]string{"loss", "f"}, [2]string{"|∇f|", "grad"}, [2]string{"status", "status"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M3

func regressionBlock() Block {
	return Block{
		Slug:        "regression",
		Title:       "Least squares",
		Description: "Linear regression with the error made visible. Click to add a point, Shift-click to remove one; the line is the closed-form least-squares fit, and the squares are the errors it minimises: their total area is the sum of squared residuals.",
		Tags:        []string{"OLS", "residuals", "click to add"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("reg",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 360"), h.Class("mx-auto block w-full max-w-[640px] cursor-crosshair select-none"),
					h.Role("img"), h.Aria("label", "Scatter plot with the least-squares line. Click to add points.")),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Show"),
					toggle("reg-res", "residuals", "Residuals", true),
					toggle("reg-sq", "squares", "Squared errors", true),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset points"),
				readouts([2]string{"fit", "eq"}, [2]string{"MSE", "mse"}, [2]string{"R²", "r2"}, [2]string{"n", "n"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M4

func overfittingBlock() Block {
	return Block{
		Slug:        "overfitting",
		Title:       "Overfitting",
		Description: "Twelve noisy samples of a sine wave, fitted with polynomials of growing degree. Training error only goes down; test error falls, then climbs. The best model is the one in the valley, not the one that fits the points.",
		Tags:        []string{"bias–variance", "polynomials", "train vs test"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("poly",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("fit", ""), h.ViewBox("0 0 400 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Polynomial fit")),
					h.Svg(h.Data("err", ""), h.ViewBox("0 0 260 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Train and test error by degree")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					field("degree", "Degree", "", 3, 0, 11, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "fit"),
					legendSwatch("var(--vec-u)", "true sin(2πx)"),
					legendSwatch("var(--brand)", "test error"),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reseed"), hugeicons.ShuffleIcon(), "New sample"),
				readouts([2]string{"train MSE", "train"}, [2]string{"test MSE", "test"}, [2]string{"verdict", "verdict"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M5

func activationsBlock() Block {
	fns := [][2]string{{"relu", "ReLU"}, {"leaky", "Leaky ReLU"}, {"sigmoid", "Sigmoid"}, {"tanh", "Tanh"}, {"gelu", "GELU"}, {"silu", "SiLU"}}
	return Block{
		Slug:        "activations",
		Title:       "Activation functions",
		Description: "The nonlinearities between layers, with their derivatives: the derivative is what backpropagation multiplies by, so a flat region is where gradients vanish. Hover the plot to read both values.",
		Tags:        []string{"plot", "derivatives", "hover"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("act",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 340"), h.Class("mx-auto block w-full max-w-[640px] cursor-crosshair"),
					h.Role("img"), h.Aria("label", "Activation functions")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Functions"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.MapIdx(fns, func(i int, f [2]string) h.Node {
							return h.Button(h.Type("button"), h.Data("fn", f[0]), h.Aria("pressed", fmt.Sprint(i == 0 || i == 2)),
								h.Class("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:text-foreground"),
								h.Span(h.Data("swatch", f[0]), h.Class("size-2 rounded-full")), f[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("act-d", "deriv", "Show derivatives (dashed)", true)),
				h.Div(h.Data("out", "hover"), h.Class("min-h-24 rounded-lg border bg-code p-3 font-mono text-xs leading-relaxed text-muted-foreground"), "Hover the plot"),
			)
		},
	}
}

// ---------------------------------------------------------------- M6

var nextWords = []struct {
	word  string
	logit float64
}{{"mat", 3.2}, {"floor", 2.1}, {"sofa", 1.6}, {"roof", 0.4}, {"moon", -1.5}}

func softmaxBlock() Block {
	return Block{
		Slug:        "softmax",
		Title:       "Softmax and temperature",
		Description: "How a language model turns scores into a choice. Softmax maps logits to probabilities; temperature sharpens or flattens them before sampling. The logits here are illustrative; the arithmetic is the real thing.",
		Tags:        []string{"softmax", "sampling", "entropy"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5"), h.Data("softmax", ""),
				h.P(h.Class("text-base"), h.Span(h.Class("text-muted-foreground"), "The cat sat on the "),
					h.Span(h.Data("out", "pick"), h.Class("inline-block min-w-12 rounded-md border border-dashed px-2 font-medium text-brand"), "___")),
				h.Div(h.Class("grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 gap-y-2"),
					h.Span(h.Class("text-xs text-muted-foreground"), "token"),
					h.Span(h.Class("text-right text-xs text-muted-foreground"), "logit"),
					h.Span(h.Class("text-xs text-muted-foreground"), "probability"),
					h.Span(),
					h.MapIdx(nextWords, func(i int, w struct {
						word  string
						logit float64
					}) h.Node {
						return h.Group(
							h.Span(h.Class("font-mono text-sm"), w.word),
							h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", fmt.Sprintf("logit-%d", i)), h.Value(fmt.Sprint(w.logit)),
								h.Data("min", "-5"), h.Data("max", "8"), h.Data("step", "0.1"), h.Attr("autocomplete", "off"), h.Aria("label", "Logit of "+w.word),
								h.Class("h-8 w-16 cursor-ew-resize rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
							h.Div(h.Class("h-6 overflow-hidden rounded-md bg-foreground/5"),
								h.Div(h.Data("bar", fmt.Sprint(i)), h.Class("h-full rounded-md bg-brand/70 transition-[width] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"), h.Style("width:0"))),
							h.Span(h.Data("prob", fmt.Sprint(i)), h.Class("w-14 text-right font-mono text-xs tabular-nums"), "—"),
						)
					}),
				),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3 border-t pt-4"),
					h.Div(h.Class("w-56"), field("temp", "Temperature", "", 1, 0.05, 5, 0.05)),
					h.Span(h.Class("font-mono text-xs text-muted-foreground"), "entropy ", h.Span(h.Data("out", "entropy"), h.Class("text-foreground"), "—")),
					h.Div(h.Class("flex gap-2"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "sample"), hugeicons.DiceIcon(), "Sample"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "sample100"), "×100"),
					),
				),
				h.P(h.Data("out", "tally"), h.Class("min-h-4 font-mono text-[11px] text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- M7

func thresholdBlock() Block {
	cell := func(key, label, cls string) h.Node {
		return h.Div(h.Class("flex flex-col items-center justify-center rounded-md border px-2 py-2 "+cls),
			h.Span(h.Data("out", key), h.Class("font-mono text-lg font-medium tabular-nums"), "—"),
			h.Span(h.Class("text-[10px] text-muted-foreground"), label))
	}
	return Block{
		Slug:        "threshold",
		Title:       "Threshold, confusion matrix, ROC",
		Description: "A classifier outputs scores; the threshold turns them into decisions. Slide it and watch errors trade off: the confusion matrix, precision and recall, and the point moving along the ROC curve. Separation sets how good the classifier can ever be (its AUC).",
		Tags:        []string{"metrics", "ROC / AUC", "trade-off"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("roc",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("hist", ""), h.ViewBox("0 0 400 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Score histograms by true class")),
					h.Svg(h.Data("curve", ""), h.ViewBox("0 0 260 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "ROC curve")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Classifier"),
					field("threshold", "Threshold", "", 0.5, 0, 1, 0.01),
					field("sep", "Separation", "", 0.3, 0, 0.8, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-1.5 border-t pt-4"),
					h.Div(h.Class("grid grid-cols-[auto_1fr_1fr] items-center gap-1.5 text-[11px] text-muted-foreground"),
						h.Span(), h.Span(h.Class("text-center"), "pred +"), h.Span(h.Class("text-center"), "pred −"),
						h.Span("true +"), cell("tp", "TP", "border-add/40 bg-add/8"), cell("fn", "FN", "border-del/40 bg-del/8"),
						h.Span("true −"), cell("fp", "FP", "border-del/40 bg-del/8"), cell("tn", "TN", "border-add/40 bg-add/8"),
					),
				),
				readouts([2]string{"precision", "precision"}, [2]string{"recall", "recall"}, [2]string{"F1", "f1"}, [2]string{"accuracy", "acc"}, [2]string{"AUC", "auc"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M8

func kmeansBlock() Block {
	return Block{
		Slug:        "kmeans",
		Title:       "k-means",
		Description: "Clustering as two alternating moves: assign every point to its nearest centroid, then move each centroid to the mean of its points. Step through it, or run to convergence; a bad start can land in a worse local minimum.",
		Tags:        []string{"unsupervised", "stepper", "inertia"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("kmeans",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 360"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Points coloured by cluster, with centroids")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Clusters"), field("k", "k", "", 3, 1, 6, 1)),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "step"), hugeicons.ArrowRight01Icon(), h.Span(h.Data("label", ""), "Assign")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "run"), hugeicons.PlayIcon(), "Run"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "init"), h.Class("col-span-2"), hugeicons.ShuffleIcon(), "New random start"),
				),
				readouts([2]string{"iteration", "iter"}, [2]string{"next move", "phase"}, [2]string{"inertia", "inertia"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M9

type layer struct {
	name, args string
	out        []int // output shape without the batch dimension
	params     int
}

// linear, conv2d, ... compute output shapes and parameter counts the way
// PyTorch defines them, so the summary is derived, not typed in.
func linear(in, out int) layer {
	return layer{"Linear", fmt.Sprintf("%d → %d", in, out), []int{out}, in*out + out}
}
func conv2d(cin, cout, k, pad int, hw int) layer {
	o := hw + 2*pad - k + 1
	return layer{"Conv2d", fmt.Sprintf("%d → %d, %d×%d, pad %d", cin, cout, k, k, pad), []int{cout, o, o}, cout*cin*k*k + cout}
}
func same(name, args string, shape []int) layer { return layer{name, args, shape, 0} }

func mlpLayers() []layer {
	return []layer{
		same("Flatten", "", []int{784}),
		linear(784, 256), same("ReLU", "", []int{256}), same("Dropout", "p = 0.2", []int{256}),
		linear(256, 128), same("ReLU", "", []int{128}),
		linear(128, 10),
	}
}

func cnnLayers() []layer {
	c1 := conv2d(1, 32, 3, 1, 28)
	c2 := conv2d(32, 64, 3, 1, 14)
	return []layer{
		c1, same("ReLU", "", c1.out), same("MaxPool2d", "2×2", []int{32, 14, 14}),
		c2, same("ReLU", "", c2.out), same("MaxPool2d", "2×2", []int{64, 7, 7}),
		same("Flatten", "", []int{64 * 7 * 7}),
		linear(64*7*7, 128), same("ReLU", "", []int{128}),
		linear(128, 10),
	}
}

func commas(n int) string {
	s := fmt.Sprint(n)
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}
	return b.String()
}

func shapeString(s []int) string {
	parts := []string{"B"}
	for _, d := range s {
		parts = append(parts, fmt.Sprint(d))
	}
	return "(" + strings.Join(parts, ", ") + ")"
}

func summaryTable(input []int, layers []layer) h.Node {
	total := 0
	for _, l := range layers {
		total += l.params
	}
	return h.Div(h.Class("flex flex-col gap-3"),
		h.Div(h.Class("scroll-thin overflow-x-auto"),
			h.Table(h.Class("w-full min-w-[520px] text-sm"),
				h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
					h.Th(h.Class("py-2 pr-3 font-normal"), "Layer"),
					h.Th(h.Class("py-2 pr-3 font-normal"), "Output shape"),
					h.Th(h.Class("py-2 pr-3 text-right font-normal"), "Params"),
					h.Th(h.Class("w-32 py-2 font-normal"), h.Span(h.Class("sr-only"), "Share")),
				)),
				h.Tbody(h.Class("font-mono text-[13px]"),
					h.Tr(h.Class("border-b text-muted-foreground"),
						h.Td(h.Class("py-1.5 pr-3"), "Input"), h.Td(h.Class("py-1.5 pr-3"), shapeString(input)), h.Td(h.Class("py-1.5 pr-3 text-right"), "—"), h.Td()),
					h.Map(layers, func(l layer) h.Node {
						share := float64(l.params) / float64(total)
						return h.Tr(h.Class("border-b last:border-b-0"),
							h.Td(h.Class("py-1.5 pr-3"), h.Span(h.Class(h.Ternary(l.params > 0, "text-foreground", "text-muted-foreground")), l.name),
								h.If(l.args != "", h.Span(h.Class("ml-2 text-[11px] text-muted-foreground"), l.args))),
							h.Td(h.Class("py-1.5 pr-3 text-muted-foreground"), shapeString(l.out)),
							h.Td(h.Class("py-1.5 pr-3 text-right tabular-nums"), h.IfElse(l.params > 0, commas(l.params), "0")),
							h.Td(h.Class("py-1.5"), h.If(l.params > 0,
								h.Div(h.Class("h-1.5 rounded-full bg-foreground/8"),
									h.Div(h.Class("h-full rounded-full bg-brand"), h.Style(fmt.Sprintf("width:%.1f%%", 100*share)))))),
						)
					}),
				),
			),
		),
		h.Div(h.Class("flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 font-mono text-xs"),
			h.Span(h.Span(h.Class("text-muted-foreground"), "total params "), commas(total)),
			h.Span(h.Span(h.Class("text-muted-foreground"), "weights in fp32 "), fmt.Sprintf("%.2f MB", float64(total*4)/1e6)),
			h.Span(h.Span(h.Class("text-muted-foreground"), "input "), "28×28 grayscale, 10 classes"),
		),
	)
}

func modelSummaryBlock() Block {
	return Block{
		Slug:        "model-summary",
		Title:       "Model summary",
		Description: "Shapes and parameter counts, layer by layer, derived in Go from the layer definitions the way PyTorch computes them. Compare an MLP and a small CNN on MNIST: the CNN has more parameters, almost all in one dense layer.",
		Tags:        []string{"shapes", "param count", "tabs"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5"),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					h.Div(h.Class("flex items-center gap-2"),
						badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px] font-normal"), "MNIST"),
						h.Span(h.Class("text-sm text-muted-foreground"), "batch size B"),
					),
					segs("Architecture", [2]string{"mlp", "MLP"}, [2]string{"cnn", "CNN"}),
				),
				h.Div(h.Data("view", "mlp"), summaryTable([]int{1, 28, 28}, mlpLayers())),
				h.Div(h.Data("view", "cnn"), h.Hidden(), summaryTable([]int{1, 28, 28}, cnnLayers())),
			)
		},
	}
}

// ---------------------------------------------------------------- M10

const trainingLoopSource = `model = MLP().to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(10):
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = loss_fn(logits, y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        correct = sum((model(x.to(device)).argmax(1) == y.to(device)).sum().item()
                      for x, y in val_loader)
    print(f"epoch {epoch}: val acc {correct / len(val_loader.dataset):.3f}")`

type note struct {
	lines []int
	title string
	body  string
}

var loopNotes = []note{
	{[]int{2}, "Optimiser", "AdamW keeps a running mean and variance of each gradient and decouples weight decay from the update."},
	{[]int{3}, "Loss", "Cross-entropy takes raw logits: it applies log-softmax itself, so the model must not end with a softmax."},
	{[]int{6}, "Training mode", "Turns on dropout and makes batch norm use batch statistics."},
	{[]int{9, 10}, "Forward pass", "Compute predictions and the loss; autograd records every operation on the way."},
	{[]int{11}, "Reset gradients", "PyTorch accumulates gradients, so clear them before each backward pass."},
	{[]int{12}, "Backward pass", "Backpropagation: fills .grad on every parameter with ∂loss/∂parameter."},
	{[]int{13}, "Update", "The optimiser moves each parameter a small step against its gradient."},
	{[]int{15, 16}, "Evaluation", "eval() switches dropout off; no_grad() skips building the graph, saving memory and time."},
}

func trainingLoopBlock() Block {
	return Block{
		Slug:        "training-loop",
		Title:       "Annotated training loop",
		Description: "The ten lines every PyTorch model is trained with, annotated. Hover a note to light up its lines, or hover a line to find its note; the order of zero_grad, backward and step is the part everyone gets wrong once.",
		Tags:        []string{"PyTorch", "annotations", "hover sync"},
		Wide:        true,
		Render: func() h.Node {
			lines := strings.Split(trainingLoopSource, "\n")
			noteOf := map[int]int{}
			for i, n := range loopNotes {
				for _, l := range n.lines {
					noteOf[l] = i + 1
				}
			}
			return h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"), h.Data("annotated", ""),
				h.Figure(h.Class("min-w-0 self-start overflow-hidden rounded-xl border bg-code shadow-xs lg:sticky lg:top-20"),
					h.Figcaption(h.Class("flex h-10 items-center gap-2 border-b bg-code-panel px-3 text-[13px]"),
						fileIcon(), h.Span("train.py"), h.Div(h.Class("flex-1")), copyButton(trainingLoopSource, "")),
					h.Pre(h.Class("code scroll-thin overflow-x-auto py-2"),
						h.Code(h.Class("grid min-w-max grid-cols-[auto_1.5rem_1fr]"),
							h.MapIdx(lines, func(i int, l string) h.Node {
								n := noteOf[i+1]
								return h.Span(h.Class("line col-span-3 grid grid-cols-subgrid pr-6 transition-colors duration-100 data-[lit]:bg-[var(--code-line-hl)]"),
									h.If(n > 0, h.Data("note", fmt.Sprint(n))),
									h.Span(h.Class("ln"), fmt.Sprint(i+1)),
									h.Span(h.Class("flex items-center justify-center"),
										h.If(n > 0, h.Span(h.Class("flex size-4 items-center justify-center rounded-full bg-brand/15 font-sans text-[9px] font-medium text-brand"), fmt.Sprint(n)))),
									h.Span(highlightLine(l)),
								)
							}),
						),
					),
				),
				h.Ol(h.Class("flex flex-col gap-1"),
					h.MapIdx(loopNotes, func(i int, n note) h.Node {
						return h.Li(h.Data("note-item", fmt.Sprint(i+1)), h.TabIndex(0),
							h.Class("flex cursor-default gap-3 rounded-lg border border-transparent p-2.5 text-sm outline-none transition-colors duration-100 data-[lit]:border-border data-[lit]:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"),
							h.Span(h.Class("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-medium text-brand"), fmt.Sprint(i+1)),
							h.Div(h.Class("flex flex-col gap-0.5"),
								h.Span(h.Class("font-medium"), n.title),
								h.Span(h.Class("text-[13px] leading-relaxed text-muted-foreground"), n.body)),
						)
					}),
					h.Li(h.Class("px-2.5 pt-1 text-xs text-muted-foreground"), "Hover a line or a note; Tab moves through the notes."),
				),
			)
		},
	}
}
