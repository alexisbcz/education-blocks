package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// SignalsBlocks lists the signal processing gallery in display order.
func SignalsBlocks() []Block {
	return []Block{
		sigSamplingBlock(),
		sigDFTBlock(),
		sigFourierBlock(),
		sigConvolutionBlock(),
		sigFIRBlock(),
		sigBiquadBlock(),
		sigZPlaneBlock(),
		sigSpectrogramBlock(),
		sigQuantizeBlock(),
		sigImageBlock(),
	}
}

func sigButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// sigSegs is segs with a chosen initial option.
func sigSegs(label string, active int, opts ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", label),
		h.MapIdx(opts, func(i int, o [2]string) h.Node { return segButton(o[0], o[1], i == active) }),
	)
}

func sigNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- S1

func sigSamplingBlock() Block {
	return Block{
		Slug:        "sampling",
		Title:       "Sampling and aliasing",
		Description: "A continuous sine sampled at a fixed rate. Below half the sampling rate the samples pin down the sine; above it, the same samples fit a slower sine just as well: the alias at |f − k·fs|. Play both to hear the impostor.",
		Tags:        []string{"Nyquist", "alias", "Web Audio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-sampling",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "signal"),
						legendSwatch("var(--brand)", "samples"),
						legendSwatch("var(--vec-u)", "what the samples say (alias)"),
					),
					h.Svg(h.Data("plot", "time"), h.ViewBox("0 0 640 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Signal, samples and the reconstructed alias over 2 ms")),
					h.Svg(h.Data("plot", "freq"), h.ViewBox("0 0 640 90"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Frequency axis with the folding at fs/2")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Signal"),
					field("f", "Frequency", "kHz", 7, 0.1, 30, 0.1),
					field("fs", "Sample rate", "kHz", 10, 1, 48, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					sigButton("play-signal", "Play signal", hugeicons.VolumeHighIcon()),
					sigButton("play-alias", "Play alias", hugeicons.VolumeHighIcon()),
				),
				readouts([2]string{"Nyquist", "nyq"}, [2]string{"alias", "alias"}, [2]string{"verdict", "verdict"}),
				sigNote("Playback is ten times lower (7 kHz plays at 700 Hz) so both tones are comfortable to hear; their ratio is kept."),
			)
		},
	}
}

// ---------------------------------------------------------------- S2

func sigDFTBlock() Block {
	return Block{
		Slug:        "dft",
		Title:       "DFT explorer",
		Description: "Build a signal from two sines and noise, then look at its spectrum. A frequency that does not land on a bin leaks into its neighbours; a window trades a wider main lobe for much lower side lobes.",
		Tags:        []string{"FFT", "windows", "leakage"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-dft",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", "time"), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Windowed signal, 256 samples")),
					h.Svg(h.Data("plot", "spec"), h.ViewBox("0 0 640 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Magnitude spectrum in dB")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Components (bins)"),
					field("f1", "Sine 1 at", "bin", 20, 0, 127, 0.1),
					field("a1", "amplitude", "", 1, 0, 1, 0.01),
					field("f2", "Sine 2 at", "bin", 45.5, 0, 127, 0.1),
					field("a2", "amplitude", "", 0.05, 0, 1, 0.01),
					field("noise", "Noise σ", "", 0, 0, 0.5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Window"),
					segs("Window", [2]string{"rect", "Rect"}, [2]string{"hann", "Hann"}, [2]string{"hamming", "Hamming"}, [2]string{"blackman", "Blackman"}),
				),
				readouts([2]string{"N", "n"}, [2]string{"peak 1", "p1"}, [2]string{"peak 2", "p2"}, [2]string{"side lobe", "side"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S3

func sigFourierBlock() Block {
	return Block{
		Slug:        "fourier-series",
		Title:       "Fourier series and Gibbs",
		Description: "Partial sums of the Fourier series of a square, sawtooth and triangle wave. Adding harmonics narrows the ripple at a jump but never lowers its peak: the overshoot settles near 8.95% of the jump. The triangle has no jump, so no Gibbs.",
		Tags:        []string{"partial sums", "Gibbs", "convergence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-fourier",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", "wave"), h.ViewBox("0 0 640 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Target wave and its partial Fourier sum")),
					h.Svg(h.Data("plot", "coef"), h.ViewBox("0 0 640 110"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Coefficients of the series")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Wave"),
					segs("Wave", [2]string{"square", "Square"}, [2]string{"saw", "Sawtooth"}, [2]string{"triangle", "Triangle"}),
					field("terms", "Harmonics", "", 9, 1, 199, 1),
				),
				readouts([2]string{"series", "series"}, [2]string{"overshoot", "over"}, [2]string{"limit", "limit"}, [2]string{"RMS error", "rms"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S4

func sigConvolutionBlock() Block {
	return Block{
		Slug:        "convolution",
		Title:       "Convolution, flip and slide",
		Description: "y(t) = ∫ x(τ) h(t − τ) dτ, one value at a time: flip the impulse response, slide it to t, multiply by the input and take the area. Drag t, or play it, and watch the output trace itself.",
		Tags:        []string{"LTI", "impulse response", "animation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-conv",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "x(τ)"),
						legendSwatch("var(--vec-u)", "h(t − τ)"),
						legendSwatch("var(--brand)", "product, its area = y(t)"),
					),
					h.Svg(h.Data("plot", "slide"), h.ViewBox("0 0 640 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Input, flipped and shifted impulse response, and their product")),
					h.Svg(h.Data("plot", "out"), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Output y(t) so far")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Signals"),
					segs("Input", [2]string{"rect", "Pulse"}, [2]string{"step", "Step"}, [2]string{"tri", "Triangle"}),
					segs("Impulse response", [2]string{"exp", "RC decay"}, [2]string{"rect", "Box"}, [2]string{"gauss", "Gaussian"}),
					field("t", "t", "s", 1, -1, 5, 0.01),
				),
				playPause(),
				readouts([2]string{"y(t)", "y"}, [2]string{"∫h", "areaH"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S5

func sigFIRBlock() Block {
	return Block{
		Slug:        "fir",
		Title:       "FIR filter by windowed sinc",
		Description: "The ideal low-pass is a sinc that never ends; cut it to N taps and taper it with a window. More taps give a sharper edge; the window sets how deep the stop band goes. The filter then cleans a noisy test signal.",
		Tags:        []string{"FIR", "frequency response", "dB"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-fir",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-[2fr_3fr]"),
						h.Svg(h.Data("plot", "taps"), h.ViewBox("0 0 260 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Filter taps")),
						h.Svg(h.Data("plot", "resp"), h.ViewBox("0 0 380 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Magnitude response in dB")),
					),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("color-mix(in oklab, var(--foreground) 35%, transparent)", "noisy input"),
						legendSwatch("var(--brand)", "filtered (delay removed)"),
					),
					h.Svg(h.Data("plot", "apply"), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Noisy signal before and after filtering")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Design"),
					field("fc", "Cutoff", "× fs", 0.1, 0.01, 0.49, 0.01),
					field("taps", "Taps", "", 31, 3, 151, 2),
					segs("Window", [2]string{"rect", "Rect"}, [2]string{"hamming", "Hamming"}, [2]string{"blackman", "Blackman"}),
				),
				readouts([2]string{"−3 dB at", "f3"}, [2]string{"stop band", "stop"}, [2]string{"delay", "delay"}, [2]string{"noise left", "left"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S6

func sigBiquadBlock() Block {
	return Block{
		Slug:        "biquad",
		Title:       "Biquad IIR filter",
		Description: "The workhorse of audio: a second-order recursive filter from Robert Bristow-Johnson's Audio EQ Cookbook. Two poles set the resonance, two zeros the shape; the Bode plot shows magnitude and phase on a log frequency axis.",
		Tags:        []string{"IIR", "poles & zeros", "Bode"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-biquad",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					h.Svg(h.Data("plot", "pz"), h.ViewBox("0 0 240 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Pole-zero plot on the unit circle")),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Svg(h.Data("plot", "mag"), h.ViewBox("0 0 380 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Magnitude in dB")),
						h.Svg(h.Data("plot", "phase"), h.ViewBox("0 0 380 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Phase in degrees")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Type"),
					segs("Filter type", [2]string{"lowpass", "Low"}, [2]string{"highpass", "High"}, [2]string{"bandpass", "Band"}, [2]string{"notch", "Notch"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameters (fs = 48 kHz)"),
					field("f0", "f₀", "Hz", 1000, 20, 20000, 10),
					field("q", "Q", "", 0.707, 0.1, 20, 0.01),
				),
				readouts([2]string{"b", "b"}, [2]string{"a", "a"}, [2]string{"|pole|", "r"}, [2]string{"peak", "peak"}),
			)
		},
	}
}

// ---------------------------------------------------------------- S7

func sigZPlaneBlock() Block {
	return Block{
		Slug:        "z-plane",
		Title:       "z-plane playground",
		Description: "Drag a pole pair and a zero pair (conjugates follow). Near the unit circle, a pole lifts the response at that angle and a zero digs a notch. Push a pole outside the circle and the impulse response grows without bound.",
		Tags:        []string{"poles", "stability", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-zplane",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					h.Svg(h.Data("plot", "z"), h.ViewBox("-1.6 -1.6 3.2 3.2"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "The z-plane: drag the pole and the zero")),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Svg(h.Data("plot", "mag"), h.ViewBox("0 0 380 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Magnitude response")),
						h.Svg(h.Data("plot", "imp"), h.ViewBox("0 0 380 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Impulse response")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					toggle("sig-zp-zero", "zero", "Zero pair", true),
				),
				readouts([2]string{"pole", "pole"}, [2]string{"zero", "zero"}, [2]string{"stability", "stable"}),
				sigNote("Drag the × (pole) or ○ (zero) in the upper half; focus one and use the arrow keys for small steps."),
			)
		},
	}
}

// ---------------------------------------------------------------- S8

func sigSpectrogramBlock() Block {
	return Block{
		Slug:        "spectrogram",
		Title:       "Spectrogram",
		Description: "A short-time Fourier transform of a chirp plus a click and a steady tone. Long windows resolve frequency but smear time; short windows locate the click but blur the tone. You cannot have both: Δt·Δf has a floor.",
		Tags:        []string{"STFT", "chirp", "uncertainty"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-spectro",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative w-full overflow-hidden rounded-md border"),
						h.Canvas(h.Data("canvas", ""), h.Class("block aspect-[16/7] w-full"), h.Role("img"), h.Aria("label", "Spectrogram: time across, frequency up")),
					),
					h.Div(h.Class("flex justify-between px-1 font-mono text-[10px] text-muted-foreground"),
						h.Span("0 s"), h.Span("time →"), h.Span("1 s"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Analysis (fs = 8 kHz)"),
					sigSegs("Window length", 2, [2]string{"32", "32"}, [2]string{"64", "64"}, [2]string{"128", "128"}, [2]string{"256", "256"}, [2]string{"512", "512"}),
					field("hop", "Hop", "%", 25, 10, 100, 5),
				),
				readouts([2]string{"Δt (window)", "dt"}, [2]string{"Δf (bin)", "df"}, [2]string{"frames", "frames"}),
				sigNote("Signal: chirp 200 → 3,200 Hz, a 1 kHz tone from 0.2 to 0.8 s, and a click at 0.5 s. Hann window, magnitude in dB."),
			)
		},
	}
}

// ---------------------------------------------------------------- S9

func sigQuantizeBlock() Block {
	return Block{
		Slug:        "quantization",
		Title:       "Quantization and dither",
		Description: "Rounding samples to N bits adds an error of at most half a step. For a full-scale sine the signal-to-noise ratio is about 6.02·N + 1.76 dB. At low levels the error follows the signal and sounds like distortion; a little random dither turns it into plain noise.",
		Tags:        []string{"bit depth", "SNR", "dither"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("sig-quant",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("plot", "wave"), h.ViewBox("0 0 640 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Sine and its quantized version")),
					h.Svg(h.Data("plot", "err"), h.ViewBox("0 0 640 110"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Quantization error")),
					h.Svg(h.Data("plot", "spec"), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Spectrum of the quantized signal")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Converter"),
					field("bits", "Bits", "", 4, 1, 24, 1),
					field("level", "Level", "dBFS", 0, -60, 0, 1),
					toggle("sig-q-dither", "dither", "TPDF dither", false),
				),
				readouts([2]string{"step", "step"}, [2]string{"SNR measured", "snr"}, [2]string{"6.02N + 1.76 + level", "theory"}),
				sigNote("The formula assumes no dither. TPDF dither adds noise of its own (about 4.8 dB less SNR) but makes the error independent of the signal."),
			)
		},
	}
}

// ---------------------------------------------------------------- S10

func sigImageBlock() Block {
	return Block{
		Slug:        "image-kernels",
		Title:       "Image kernels",
		Description: "Convolution in two dimensions: each output pixel is a weighted sum of its 3×3 neighbourhood. The same operation blurs, sharpens or finds edges depending only on the nine weights. Edit them to invent your own.",
		Tags:        []string{"2D convolution", "canvas", "kernels"},
		Wide:        true,
		Render: func() h.Node {
			cells := make([]h.Node, 9)
			for i := range cells {
				cells[i] = h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("k", string(rune('0'+i))), h.Aria("label", "Kernel weight"),
					h.Attr("autocomplete", "off"),
					h.Class("h-9 w-full rounded-md border border-input bg-background text-center font-mono text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"))
			}
			return plotPanel("sig-image",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Figure(h.Class("flex flex-col gap-1"),
						h.Canvas(h.Data("canvas", "in"), h.Class("block aspect-square w-full rounded-md border [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", "Test image")),
						h.Figcaption(h.Class("font-mono text-[10px] text-muted-foreground"), "input (generated test pattern)"),
					),
					h.Figure(h.Class("flex flex-col gap-1"),
						h.Canvas(h.Data("canvas", "out"), h.Class("block aspect-square w-full rounded-md border [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", "Filtered image")),
						h.Figcaption(h.Class("font-mono text-[10px] text-muted-foreground"), "output"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Kernel"),
					h.Select(h.Data("preset", ""), h.Aria("label", "Kernel preset"),
						h.Class("h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						h.Option(h.Value("identity"), "Identity"),
						h.Option(h.Value("box"), "Box blur"),
						h.Option(h.Value("gauss"), "Gaussian blur"),
						h.Option(h.Value("sharpen"), "Sharpen"),
						h.Option(h.Value("sobelx"), "Sobel x (vertical edges)"),
						h.Option(h.Value("laplace"), "Laplacian (all edges)"),
						h.Option(h.Value("emboss"), "Emboss"),
					),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"), h.Group(cells)),
					field("div", "Divide by", "", 1, 0.1, 64, 0.1),
					field("bias", "Bias", "", 0, -128, 128, 1),
				),
				readouts([2]string{"sum of weights", "sum"}, [2]string{"effect", "effect"}),
			)
		},
	}
}
