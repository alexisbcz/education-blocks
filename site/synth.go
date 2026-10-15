package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// SynthBlocks lists the sound synthesis gallery in display order. Every
// sound is made in the page with the Web Audio API: nothing plays until a
// block's "Sound on" switch is turned on, the shared master volume starts
// low, "Stop all" silences every block, and a block goes quiet when it
// leaves the screen or the page is hidden. The pictures are computed from
// the same formulas when the sound is off.
func SynthBlocks() []Block {
	return []Block{
		synthOscBlock(),
		synthAliasBlock(),
		synthADSRBlock(),
		synthSubtractiveBlock(),
		synthFMBlock(),
		synthAdditiveBlock(),
		synthKarplusBlock(),
		synthLFOBlock(),
		synthGranularBlock(),
		synthSequencerBlock(),
	}
}

// synthSound is the audio panel every block shares: the block's own
// switch, the master volume (one value for the whole page, mirrored in
// every block) and a button that stops every block at once.
func synthSound(id string) h.Node {
	return h.Div(h.Class("flex flex-col gap-3 rounded-lg border border-dashed p-3"),
		toggle(id, "sound", "Sound on", false),
		h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
			h.Span(h.Class("flex items-center gap-1.5 text-muted-foreground"), hugeicons.VolumeLowIcon(h.Class("size-4")), "Master"),
			h.Span(h.Class("flex items-center gap-1"),
				h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("master-vol", ""), h.Value("15"),
					h.Data("min", "0"), h.Data("max", "60"), h.Data("step", "1"), h.Attr("autocomplete", "off"),
					h.Aria("label", "Master volume, percent"),
					h.Class("h-8 w-16 cursor-ew-resize rounded-md border border-input bg-background text-right font-mono text-sm tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] duration-150 px-2 focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
				h.Span(h.Class("w-12 font-mono text-[11px] text-muted-foreground"), "%"),
			),
		),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("stop-all", ""), hugeicons.StopIcon(), "Stop all sound"),
		h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"), "Quiet by default; the master volume is shared by every block, and sound stops when the block leaves the screen."),
	)
}

func synthPlot(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

// synthButton is a sound-making action: disabled until the block's sound
// is on.
func synthButton(action, label string, icon h.Node, extra ...any) h.Node {
	return button.Button(append([]any{button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), h.Data("needs-sound", ""), h.Disabled(), icon, h.Span(h.Data("label", ""), label)}, extra...)...)
}

// synthPlayButton starts and stops a sustained sound; the script swaps
// the icon and the label.
func synthPlayButton(action, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), h.Data("needs-sound", ""), h.Disabled(),
		h.Aria("pressed", "false"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.StopIcon(h.Data("icon", "stop"), h.Hidden()),
		h.Span(h.Data("label", ""), label))
}

func synthLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }),
	)
}

func synthNote(s ...any) h.Node {
	return h.P(append([]any{h.Class("px-1 text-xs leading-relaxed text-muted-foreground")}, s...)...)
}

// ---------------------------------------------------------------- 1

func synthOscBlock() Block {
	return Block{
		Slug:        "oscillator-lab",
		Title:       "Oscillator lab",
		Description: "The four classic waveforms and what they are made of. The scope and spectrum are computed from each wave's Fourier series while the sound is off; with the sound on they switch to what the browser's AnalyserNode actually measures. The readouts name the nearest MIDI note and how many cents the pitch sits from it.",
		Tags:        []string{"OscillatorNode", "AnalyserNode", "MIDI and cents"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-osc",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--brand)", "waveform"}, [2]string{"var(--vec-u)", "harmonic levels"}),
					synthPlot("scope", "0 0 560 170", "Oscilloscope trace of the waveform"),
					synthPlot("spectrum", "0 0 560 190", "Spectrum of the waveform"),
					h.P(h.Data("source", ""), h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "computed from the Fourier series"),
				),
				segs("Waveform", [2]string{"sine", "Sine"}, [2]string{"square", "Square"}, [2]string{"sawtooth", "Saw"}, [2]string{"triangle", "Triangle"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pitch"),
					field("freq", "Frequency", "Hz", 220, 20, 4000, 0.5),
					field("detune", "Detune", "cents", 0, -100, 100, 1),
				),
				synthSound("synth-osc-sound"),
				readouts([2]string{"nearest note", "note"}, [2]string{"offset", "cents"}, [2]string{"period", "period"}, [2]string{"harmonics", "harm"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func synthAliasBlock() Block {
	return Block{
		Slug:        "aliasing",
		Title:       "Aliasing in a naive sawtooth",
		Description: "A sawtooth computed sample by sample as 2·frac(f·t) − 1 has harmonics above the Nyquist frequency, and they fold back as inharmonic tones. The band-limited version sums only the harmonics that fit. Both are rendered here at 48 kHz and analysed with an FFT; push the pitch up and listen to the naive one whistle.",
		Tags:        []string{"Nyquist", "FFT", "band-limited"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-alias",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--code-del)", "naive: folded (aliased) partials"}, [2]string{"var(--brand)", "true harmonics"}, [2]string{"var(--vec-u)", "band-limited"}),
					synthPlot("plot", "0 0 560 320", "Spectra of a naive and a band-limited sawtooth"),
					synthNote("Each peak marked in red is a harmonic of the naive saw that lies above 24 kHz and has been reflected back below it. They do not fall on the harmonic series, which is why they sound like a separate, wrong tone."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sawtooth"),
					field("freq", "Frequency", "Hz", 1760, 100, 6000, 1),
				),
				synthSound("synth-alias-sound"),
				h.Div(h.Class("flex flex-wrap gap-2"),
					synthButton("naive", "Play naive", hugeicons.PlayIcon()),
					synthButton("bandlimited", "Play band-limited", hugeicons.PlayIcon()),
				),
				readouts([2]string{"harmonics below Nyquist", "count"}, [2]string{"aliased energy", "alias"}, [2]string{"loudest alias", "loud"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func synthADSRBlock() Block {
	return Block{
		Slug:        "adsr",
		Title:       "ADSR envelope",
		Description: "Attack, decay, sustain and release shape a note's loudness over time. Drag the three handles (or focus one and use the arrow keys), then hold the key: the envelope runs on the audio clock with AudioParam ramps, and the dot follows it.",
		Tags:        []string{"envelope", "AudioParam", "gate"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-adsr",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--brand)", "envelope"}, [2]string{"var(--vec-u)", "gate held"}),
					synthPlot("plot", "0 0 560 280", "ADSR envelope with draggable handles"),
					synthNote("Release starts from wherever the level is when the key is let go, so a short tap never reaches the sustain level."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Envelope"),
					field("a", "Attack", "ms", 40, 1, 2000, 1),
					field("d", "Decay", "ms", 250, 1, 2000, 1),
					field("s", "Sustain", "level", 0.6, 0, 1, 0.01),
					field("r", "Release", "ms", 600, 1, 4000, 1),
				),
				segs("Presets", [2]string{"pad", "Pad"}, [2]string{"pluck", "Pluck"}, [2]string{"organ", "Organ"}, [2]string{"swell", "Swell"}),
				synthSound("synth-adsr-sound"),
				synthButton("key", "Hold to play", hugeicons.MusicNote01Icon(), kbd.Kbd(h.Class("ml-1"), "Space")),
				readouts([2]string{"note length to sustain", "tos"}, [2]string{"level", "level"}, [2]string{"stage", "stage"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func synthSubtractiveBlock() Block {
	return Block{
		Slug:        "subtractive",
		Title:       "Subtractive synth",
		Description: "Start from a bright, harmonic-rich wave and carve it with a resonant low-pass filter. The filter curve is read back from a real BiquadFilterNode with getFrequencyResponse, so the output partials drawn here are what you hear. A filter envelope sweeps the cutoff down after each note starts.",
		Tags:        []string{"low-pass", "resonance", "filter envelope"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-sub",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--muted-foreground)", "source partials"}, [2]string{"var(--vec-u)", "filter response"}, [2]string{"var(--brand)", "output partials"}),
					synthPlot("plot", "0 0 560 320", "Source spectrum, filter response and output spectrum"),
				),
				segs("Source", [2]string{"sawtooth", "Saw"}, [2]string{"square", "Square"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Oscillator and filter"),
					field("freq", "Note", "Hz", 110, 30, 880, 0.5),
					field("cutoff", "Cutoff", "Hz", 900, 40, 18000, 10),
					field("q", "Resonance", "dB", 12, 0, 24, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Filter envelope"),
					field("amount", "Amount", "octaves", 3, 0, 6, 0.1),
					field("decay", "Decay", "ms", 300, 10, 3000, 10),
				),
				synthSound("synth-sub-sound"),
				synthButton("note", "Play note", hugeicons.PlayIcon()),
				readouts([2]string{"partials below cutoff", "below"}, [2]string{"peak at cutoff", "peak"}, [2]string{"envelope start", "start"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func synthFMBlock() Block {
	return Block{
		Slug:        "fm",
		Title:       "FM synthesis",
		Description: "John Chowning's 1973 discovery: let one sine wave swing the frequency of another and sidebands appear at the carrier ± multiples of the modulator, with amplitudes given by Bessel functions Jₙ(I) of the index I. The bars are the theory; the dots are an FFT of the rendered signal. Whole-number ratios give harmonic tones, others give bells.",
		Tags:        []string{"Chowning 1973", "Bessel Jₙ", "Carson's rule"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-fm",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--brand)", "|Jₙ(I)| theory"}, [2]string{"var(--vec-u)", "measured by FFT"}, [2]string{"var(--muted-foreground)", "Carson bandwidth"}),
					synthPlot("plot", "0 0 560 300", "FM spectrum: Bessel theory against FFT"),
					synthPlot("bessel", "0 0 560 160", "Bessel functions J0 to J4 against the index"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Operators"),
					field("fc", "Carrier", "Hz", 440, 50, 2000, 1),
					field("ratio", "Ratio fm/fc", "", 1, 0.1, 8, 0.01),
					field("index", "Index I", "", 2, 0, 12, 0.05),
				),
				segs("Presets", [2]string{"brass", "Brass 1:1"}, [2]string{"clarinet", "Clarinet 1:2"}, [2]string{"bell", "Bell 1:1.4"}),
				synthSound("synth-fm-sound"),
				synthPlayButton("play", "Play"),
				readouts([2]string{"modulator", "fm"}, [2]string{"peak deviation", "dev"}, [2]string{"Carson bandwidth", "carson"}, [2]string{"worst |theory − FFT|", "err"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func synthAdditiveBlock() Block {
	return Block{
		Slug:        "additive",
		Title:       "Additive synthesis",
		Description: "Build a timbre one sine at a time: drag the 16 harmonic bars (or focus one and use the arrow keys). The browser plays exactly these amplitudes through a PeriodicWave; the organ preset pulls the first three Hammond drawbars (16′, 5⅓′, 8′) fully out, registration 888000000. Scrambling the phases changes the waveform's shape completely but barely changes the sound, which is Ohm's acoustic law.",
		Tags:        []string{"Fourier", "PeriodicWave", "drawbars"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-add",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--vec-u)", "harmonic amplitudes"}, [2]string{"var(--brand)", "one period of the sum"}),
					synthPlot("bars", "0 0 560 200", "Sixteen harmonic amplitude bars"),
					synthPlot("wave", "0 0 560 170", "One period of the summed waveform"),
				),
				segs("Presets", [2]string{"saw", "Saw"}, [2]string{"square", "Square"}, [2]string{"organ", "Organ 888"}, [2]string{"flute", "Flute"}, [2]string{"clear", "Sine"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Tone"),
					field("freq", "Fundamental", "Hz", 196, 30, 1000, 0.5),
				),
				toggle("synth-add-phase", "phase", "Scramble phases", false),
				synthSound("synth-add-sound"),
				synthPlayButton("play", "Play"),
				readouts([2]string{"partials on", "on"}, [2]string{"peak of sum", "peak"}, [2]string{"spectral centroid", "centroid"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func synthKarplusBlock() Block {
	return Block{
		Slug:        "karplus-strong",
		Title:       "Karplus–Strong plucked string",
		Description: "Karplus and Strong (1983) made a convincing string from almost nothing: a burst of noise circulating in a delay line, averaged with its neighbour on every lap. The delay sets the pitch; the averaging takes the high harmonics away first, just as a real string loses them. The pitch shown is measured from the rendered sound by autocorrelation.",
		Tags:        []string{"Karplus & Strong 1983", "delay line", "physical modelling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-ks",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--brand)", "output, first 25 ms"}, [2]string{"var(--vec-u)", "envelope over 3 s"}),
					synthPlot("start", "0 0 560 150", "The first milliseconds of the plucked string"),
					synthPlot("env", "0 0 560 150", "Peak level of the plucked string over three seconds"),
					synthNote("The two-point averaging filter adds s samples of delay (s = ½ for the classic plain average; brightness moves weight off the second tap and shortens it), so the loop is N + s samples long and the pitch is fs / (N + s). Tuning to fractions of a sample needs an all-pass filter, which is left out here; the readout shows the error that rounding leaves."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("String"),
					field("freq", "Pitch", "Hz", 220, 40, 1200, 0.5),
					field("decay", "Loop gain ρ", "", 0.996, 0.9, 0.9999, 0.0001),
					field("bright", "Brightness", "", 0, 0, 1, 0.05),
				),
				segs("Excitation", [2]string{"noise", "Noise burst"}, [2]string{"pick", "Soft pick"}),
				synthSound("synth-ks-sound"),
				synthButton("pluck", "Pluck", hugeicons.MusicNote01Icon()),
				readouts([2]string{"delay N", "n"}, [2]string{"expected pitch", "expected"}, [2]string{"measured pitch", "measured"}, [2]string{"time to −60 dB", "t60"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func synthLFOBlock() Block {
	return Block{
		Slug:        "lfo",
		Title:       "LFO modulation",
		Description: "A low-frequency oscillator, too slow to hear as a tone, wired into another parameter: into pitch it is vibrato, into gain it is tremolo, into a filter's cutoff it is a wah-like sweep. The top plot is the modulated parameter; the bottom one is the signal it produces.",
		Tags:        []string{"vibrato", "tremolo", "filter sweep"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-lfo",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--vec-u)", "modulated parameter"}, [2]string{"var(--brand)", "resulting signal"}),
					synthPlot("param", "0 0 560 170", "The parameter moved by the LFO over two seconds"),
					synthPlot("signal", "0 0 560 170", "The audio signal under modulation"),
				),
				segs("Target", [2]string{"vibrato", "Pitch (vibrato)"}, [2]string{"tremolo", "Gain (tremolo)"}, [2]string{"filter", "Cutoff (sweep)"}),
				segs("LFO shape", [2]string{"sine", "Sine"}, [2]string{"triangle", "Triangle"}, [2]string{"square", "Square"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("LFO"),
					field("rate", "Rate", "Hz", 5.5, 0.1, 20, 0.1),
					field("depth", "Depth", "%", 40, 0, 100, 1),
				),
				synthSound("synth-lfo-sound"),
				synthPlayButton("play", "Play"),
				readouts([2]string{"swing", "swing"}, [2]string{"period", "period"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func synthGranularBlock() Block {
	return Block{
		Slug:        "granular",
		Title:       "Granular synthesis",
		Description: "Chop a recording into grains of tens of milliseconds, each faded in and out by a window, and replay them densely from a moving position. The source here is a two-second tone made in the page that glides and changes timbre. Freeze the position to hold one instant as a texture; add jitter to smear it.",
		Tags:        []string{"grains", "window", "time stretch"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-gran",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--muted-foreground)", "source buffer"}, [2]string{"var(--brand)", "grains (last second)"}, [2]string{"var(--vec-u)", "play position"}),
					synthPlot("plot", "0 0 560 260", "Source waveform with the grains drawn over it"),
					synthNote("With the sound off the grains drawn are a preview of the schedule the same settings would play."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Grains"),
					field("size", "Grain size", "ms", 80, 5, 400, 1),
					field("density", "Density", "grains/s", 30, 1, 120, 1),
					field("pos", "Position", "s", 0.6, 0, 2, 0.01),
					field("speed", "Scan speed", "×", 0.25, -1, 2, 0.05),
					field("jitter", "Jitter", "ms", 40, 0, 500, 1),
					field("pitch", "Pitch", "semitones", 0, -24, 24, 1),
				),
				synthSound("synth-gran-sound"),
				synthPlayButton("play", "Start cloud"),
				readouts([2]string{"grains overlapping", "overlap"}, [2]string{"grains played", "count"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func synthSequencerBlock() Block {
	steps := make([]int, 16)
	return Block{
		Slug:        "step-sequencer",
		Title:       "Melodic step sequencer",
		Description: "Sixteen steps of melody locked to a scale, so no note can be wrong, plus a lane that automates the filter cutoff on every step. Notes are scheduled ahead on the audio clock rather than with timers, so the timing stays tight even when the page is busy.",
		Tags:        []string{"scale lock", "automation", "lookahead scheduling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("synth-seq",
				h.Div(h.Class("flex flex-col gap-2"),
					synthLegend([2]string{"var(--brand)", "note on"}, [2]string{"var(--vec-u)", "cutoff per step (200 Hz – 8 kHz, log)"}, [2]string{"var(--foreground)", "playhead"}),
					h.Div(h.Data("grid", ""), h.Role("grid"), h.Aria("label", "Note grid: columns are steps, rows are scale degrees"),
						h.Class("grid gap-0.5 overflow-x-auto rounded-md p-1"), h.Style("grid-template-columns:repeat(16,minmax(0.85rem,1fr))")),
					h.Div(h.Aria("hidden", "true"), h.Class("grid gap-0.5 px-1 font-mono text-[10px] text-muted-foreground"), h.Style("grid-template-columns:repeat(16,minmax(0.85rem,1fr))"),
						h.MapIdx(steps, func(i int, _ int) h.Node { return h.Span(h.Class("text-center"), fmt.Sprint(i+1)) }),
					),
					synthPlot("lane", "0 0 560 110", "Filter cutoff automation for each step: drag the bars"),
				),
				segs("Scale", [2]string{"minorpenta", "Minor pent."}, [2]string{"major", "Major"}, [2]string{"dorian", "Dorian"}, [2]string{"harmonic", "Harm. minor"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Transport"),
					field("bpm", "Tempo", "BPM", 112, 40, 200, 1),
					field("root", "Root", "MIDI", 45, 24, 72, 1),
					field("q", "Resonance", "dB", 10, 0, 24, 0.5),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "random"), hugeicons.ShuffleIcon(), "New pattern"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "clear"), hugeicons.Delete02Icon(), "Clear"),
				),
				synthSound("synth-seq-sound"),
				synthPlayButton("play", "Play"),
				readouts([2]string{"notes", "notes"}, [2]string{"step", "step"}, [2]string{"scheduled ahead", "ahead"}),
			)
		},
	}
}
