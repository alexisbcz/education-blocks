package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	switchui "github.com/alexisbcz/components/ui/switch"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// AudioBlocks lists the audio engineering gallery in display order. Every
// sound is synthesised in the page (pink noise, a drum loop, tones) and
// plays only after the learner turns the block's "Sound on" switch.
func AudioBlocks() []Block {
	return []Block{
		audDecibelsBlock(),
		audWeightingBlock(),
		audEQBlock(),
		audCompressorBlock(),
		audReverbBlock(),
		audPanningBlock(),
		audMicBlock(),
		audCombBlock(),
		audLoudnessBlock(),
		audCalcBlock(),
	}
}

// audSound is the switch that gates a block's audio.
func audSound(id string) h.Node {
	return h.Div(h.Class("flex flex-col gap-2 rounded-lg border border-dashed p-3"),
		toggle(id, "sound", "Sound on", false),
		h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"), "Quiet by default; stops when the block leaves the screen."),
	)
}

func audPlot(attr, viewBox, label string) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(viewBox), h.Class("block w-full"), h.Role("img"), h.Aria("label", label))
}

func audButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), h.Disabled(), icon, label)
}

// ---------------------------------------------------------------- 1

func audDecibelsBlock() Block {
	return Block{
		Slug:        "decibels",
		Title:       "Decibels toolkit",
		Description: "Levels add as powers, not numbers: two 80 dB sources make 83 dB, not 160. The same page converts voltages to dBV and dBu, sample values to dBFS, and follows a point source as it fades by 6 dB per doubling of distance.",
		Tags:        []string{"dB SPL", "dBu / dBV", "inverse square"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-db",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "level at distance"),
						legendSwatch("var(--vec-u)", "−6 dB per doubling"),
					),
					audPlot("plot", "0 0 560 300", "Sound pressure level against distance"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Adding sources"),
					field("l1", "Source 1", "dB SPL", 80, 0, 140, 0.5),
					field("l2", "Source 2", "dB SPL", 80, 0, 140, 0.5),
					field("l3", "Source 3", "dB SPL", 0, 0, 140, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Distance"),
					field("ref", "Level at 1 m", "dB SPL", 94, 0, 140, 0.5),
					field("dist", "Distance", "m", 4, 0.1, 100, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Signals"),
					field("volts", "Voltage", "V rms", 1.228, 0.001, 100, 0.001),
					field("sample", "Sample peak", "of full", 0.5, 0.0001, 1, 0.0001),
				),
				readouts([2]string{"sum", "sum"}, [2]string{"at distance", "atdist"}, [2]string{"dBV / dBu", "volt"}, [2]string{"dBFS", "fs"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func audWeightingBlock() Block {
	return Block{
		Slug:        "weighting",
		Title:       "A-weighting and octave bands",
		Description: "Our ears are deaf to bass at low levels, so sound meters weight the spectrum. The A and C curves here are the exact IEC 61672 formulas; type the level in each octave band and the page sums them into dB(A) and dB(C).",
		Tags:        []string{"IEC 61672", "dB(A)", "octave bands"},
		Wide:        true,
		Render: func() h.Node {
			bands := []struct {
				name string
				v    float64
			}{{"63", 70}, {"125", 72}, {"250", 70}, {"500", 68}, {"1k", 66}, {"2k", 62}, {"4k", 58}, {"8k", 52}}
			return plotPanel("aud-weighting",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "A-weighting"),
						legendSwatch("var(--vec-u)", "C-weighting"),
						legendSwatch("var(--foreground)", "your band levels, A-weighted"),
					),
					audPlot("plot", "0 0 560 300", "Weighting curves and weighted band levels"),
					h.P(h.Class("px-1 text-xs leading-relaxed text-muted-foreground"),
						"Equal-loudness contours (Fletcher–Munson 1933, now ISO 226) are why A-weighting exists: it roughly follows the 40-phon contour. The curves above are the meter standard, not the contours themselves."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Octave band levels"),
					h.Map(bands, func(b struct {
						name string
						v    float64
					}) h.Node {
						return field("b"+b.name, b.name+" Hz", "dB", b.v, 0, 130, 0.5)
					}),
				),
				readouts([2]string{"unweighted", "lin"}, [2]string{"dB(A)", "dba"}, [2]string{"dB(C)", "dbc"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func audEQBlock() Block {
	return Block{
		Slug:        "eq",
		Title:       "Parametric EQ",
		Description: "Three bands (low shelf, bell, high shelf) built from the same biquad filters the browser plays: the curve is read back from the filters themselves with getFrequencyResponse, so what you see is what you hear on the pink noise.",
		Tags:        []string{"biquad", "Web Audio", "pink noise"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-eq",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "total response"),
						legendSwatch("var(--vec-u)", "each band"),
					),
					audPlot("plot", "0 0 560 360", "EQ frequency response"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Low shelf"),
					field("lsf", "Frequency", "Hz", 120, 20, 1000, 1),
					field("lsg", "Gain", "dB", 3, -15, 15, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Bell"),
					field("pkf", "Frequency", "Hz", 2500, 100, 10000, 10),
					field("pkg", "Gain", "dB", -6, -15, 15, 0.5),
					field("pkq", "Q", "", 1.4, 0.3, 10, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("High shelf"),
					field("hsf", "Frequency", "Hz", 8000, 1000, 18000, 50),
					field("hsg", "Gain", "dB", 2, -15, 15, 0.5),
				),
				audSound("aud-eq-sound"),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					h.Span(h.Class("text-sm"), "Bypass"),
					audSwitchOnly("aud-eq-bypass", "bypass", "Bypass the EQ"),
				),
				readouts([2]string{"at 1 kHz", "at1k"}, [2]string{"max boost", "max"}, [2]string{"max cut", "min"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func audCompressorBlock() Block {
	return Block{
		Slug:        "compressor",
		Title:       "Dynamics compressor",
		Description: "A feed-forward compressor written out sample by sample: level detection in dB, a static curve with a soft knee, attack and release smoothing, make-up gain. The drum loop is processed in the page and you can A/B it against the original.",
		Tags:        []string{"soft knee", "attack / release", "gain reduction"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-comp",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					audPlot("curve", "0 0 260 260", "Static transfer curve"),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--foreground)", "input peak"),
							legendSwatch("var(--brand)", "gain reduction"),
						),
						audPlot("trace", "0 0 360 260", "Input level and gain reduction over the drum loop"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Compressor"),
					field("thr", "Threshold", "dBFS", -24, -60, 0, 0.5),
					field("ratio", "Ratio", ": 1", 4, 1, 20, 0.1),
					field("knee", "Knee", "dB", 6, 0, 24, 0.5),
					field("att", "Attack", "ms", 2, 0.1, 200, 0.1),
					field("rel", "Release", "ms", 120, 5, 2000, 1),
					field("makeup", "Make-up", "dB", 4, 0, 24, 0.5),
				),
				audSound("aud-comp-sound"),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					audButton("dry", "Original", hugeicons.PlayIcon()),
					audButton("wet", "Compressed", hugeicons.PlayIcon()),
				),
				readouts([2]string{"max reduction", "maxgr"}, [2]string{"crest in → out", "crest"}, [2]string{"peak in → out", "peak"}),
				h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"),
					"Each hit's first milliseconds pass before the attack clamps down, so the body of the sound falls more than its peak and the crest factor can rise: the \"punch\" engineers set with attack."),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func audReverbBlock() Block {
	return Block{
		Slug:        "reverb",
		Title:       "Room acoustics and reverb",
		Description: "Sabine's formula gives the reverberation time from a room's volume and its absorbing surfaces. The same RT60 shapes a synthetic impulse response, which a convolution reverb then puts behind a hand clap.",
		Tags:        []string{"Sabine", "RT60", "convolution"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-reverb",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "impulse response (dB)"),
						legendSwatch("var(--brand)", "−60 dB at RT60"),
					),
					audPlot("plot", "0 0 560 280", "Synthetic impulse response envelope"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Room"),
					field("len", "Length", "m", 10, 2, 60, 0.1),
					field("wid", "Width", "m", 8, 2, 60, 0.1),
					field("hei", "Height", "m", 3, 2, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Surfaces (α at 500 Hz, typical)"),
					h.Div(h.Class("flex flex-col gap-1.5 text-xs"), h.Data("surfaces", "")),
				),
				audSound("aud-reverb-sound"),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					audButton("dry", "Dry clap", hugeicons.PlayIcon()),
					audButton("wet", "In this room", hugeicons.PlayIcon()),
				),
				readouts([2]string{"volume", "vol"}, [2]string{"absorption", "abs"}, [2]string{"RT60", "rt"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func audPanningBlock() Block {
	return Block{
		Slug:        "panning",
		Title:       "Pan laws and stereo width",
		Description: "Panning a mono source with linear gains leaves a hole in the middle; the constant-power law keeps loudness steady by putting each side 3 dB down at the centre. Below, mid/side encoding widens or narrows a stereo pair, seen on a goniometer.",
		Tags:        []string{"−3 dB law", "mid / side", "goniometer"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-pan",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--brand)", "total power"),
							legendSwatch("var(--vec-u)", "left gain"),
							legendSwatch("var(--ion-cl)", "right gain"),
						),
						audPlot("plot", "0 0 340 260", "Left and right gains against pan position"),
					),
					audPlot("gonio", "0 0 260 260", "Goniometer of the stereo pair"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pan law"),
					segs("Pan law", [2]string{"power", "−3 dB"}, [2]string{"compromise", "−4.5 dB"}, [2]string{"linear", "−6 dB"}),
					field("pan", "Position", "L…R", 0, -1, 1, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Mid / side"),
					field("corr", "Source correlation", "", 0.5, -1, 1, 0.05),
					field("width", "Width", "×", 1, 0, 2, 0.05),
				),
				audSound("aud-pan-sound"),
				readouts([2]string{"L / R gain", "gains"}, [2]string{"total power", "power"}, [2]string{"correlation out", "corr"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

func audMicBlock() Block {
	return Block{
		Slug:        "microphones",
		Title:       "Microphone polar patterns",
		Description: "Every first-order pattern is A + B·cos θ. Move the sound source around the capsule to read each pattern's sensitivity, its null angle, and its directivity index: how much more it hears the front than a room full of diffuse sound.",
		Tags:        []string{"cardioid", "rejection", "directivity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-mic",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("mx-auto w-full max-w-[420px]"), audPlot("plot", "-150 -150 300 300", "Polar patterns with the source direction")),
					h.Div(h.Data("table", ""), h.Class("overflow-x-auto border-t pt-3")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Patterns"),
					h.Div(h.Class("flex flex-wrap gap-1.5"), h.Data("patterns", "")),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Source"),
					field("angle", "Angle off-axis", "°", 90, 0, 180, 1),
					h.P(h.Class("text-xs text-muted-foreground"), "Drag in the plot, or use ← → on it."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func audCombBlock() Block {
	return Block{
		Slug:        "comb-filter",
		Title:       "Phase and comb filtering",
		Description: "Two microphones at different distances hear the same source a little apart in time. Summed, the delay carves notches where the copies arrive in opposite phase, at odd multiples of c/(2Δd). The 3:1 rule keeps the second copy quiet enough to tame them.",
		Tags:        []string{"comb filter", "3:1 rule", "time alignment"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-comb",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "summed response"),
						legendSwatch("var(--vec-u)", "notches"),
					),
					audPlot("plot", "0 0 560 280", "Comb filter response"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Microphones"),
					field("d1", "Near mic", "m", 0.3, 0.05, 10, 0.01),
					field("d2", "Far mic", "m", 0.6, 0.05, 20, 0.01),
					field("temp", "Air", "°C", 20, -10, 40, 0.5),
				),
				h.Div(h.Class("flex items-center justify-between gap-3"),
					h.Span(h.Class("text-sm"), "Time-align the far mic"),
					audSwitchOnly("aud-comb-align", "align", "Time-align the far mic"),
				),
				audSound("aud-comb-sound"),
				readouts([2]string{"delay", "delay"}, [2]string{"first notch", "notch"}, [2]string{"peak / notch", "depth"}, [2]string{"3:1 rule", "rule"}),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func audLoudnessBlock() Block {
	return Block{
		Slug:        "loudness",
		Title:       "Loudness and true peak",
		Description: "Streaming services normalise by loudness, not by peaks. This meter runs the ITU-R BS.1770 algorithm on the signal in the page: K-weighting filters, 400 ms blocks, the −70 LUFS and −10 LU gates. The true peak is read from a 4× oversampled copy.",
		Tags:        []string{"LUFS", "BS.1770", "true peak"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("aud-loud",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "momentary loudness (400 ms)"),
						legendSwatch("var(--brand)", "integrated"),
						legendSwatch("var(--vec-u)", "relative gate"),
					),
					audPlot("plot", "0 0 560 280", "Momentary loudness over time"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Signal"),
					segs("Test signal", [2]string{"sine", "997 Hz sine"}, [2]string{"pink", "Pink noise"}, [2]string{"drums", "Drum loop"}, [2]string{"mix", "Quiet + loud"}),
					field("gain", "Level", "dB", 0, -40, 6, 0.5),
				),
				audSound("aud-loud-sound"),
				h.Div(audButton("play", "Play signal", hugeicons.PlayIcon())),
				readouts([2]string{"integrated", "lufs"}, [2]string{"sample peak", "peak"}, [2]string{"true peak", "tp"}, [2]string{"RMS", "rms"}, [2]string{"PLR", "plr"}),
				h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"), "Single channel, 48 kHz, gating per BS.1770-4. A 0 dBFS sine reads −3.01 LUFS, as the standard specifies."),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func audCalcBlock() Block {
	return Block{
		Slug:        "studio-calculators",
		Title:       "Studio calculators",
		Description: "Two numbers a studio needs every day: delay times locked to the tempo (straight, dotted and triplet), and the size of an uncompressed recording from its sample rate, bit depth and channels, against common compressed bitrates.",
		Tags:        []string{"tempo", "tap", "file size"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("aud-calc", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Calculator", [2]string{"tempo", "Delay times"}, [2]string{"size", "File size"}),
				),
				h.Div(h.Data("pane", "tempo"), h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center gap-3"),
						h.Div(h.Class("w-56"), field("bpm", "Tempo", "BPM", 120, 20, 300, 0.1)),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "tap"), hugeicons.Touch01Icon(), "Tap", kbd.Kbd(h.Class("ml-1"), "T")),
						h.Span(h.Data("out", "tap"), h.Class("font-mono text-xs text-muted-foreground"), ""),
					),
					h.Div(h.Data("table", ""), h.Class("overflow-x-auto")),
				),
				h.Div(h.Data("pane", "size"), h.Hidden(), h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid gap-2 sm:grid-cols-2"),
						field("rate", "Sample rate", "kHz", 44.1, 8, 384, 0.1),
						field("bits", "Bit depth", "bit", 16, 8, 32, 8),
						field("ch", "Channels", "", 2, 1, 16, 1),
						field("min", "Duration", "min", 1, 0.1, 600, 0.1),
					),
					readouts([2]string{"bitrate", "kbps"}, [2]string{"size", "bytes"}, [2]string{"MP3 128 / 320", "mp3"}),
				),
			)
		},
	}
}

// audSwitchOnly is a switch whose label sits beside it in the row.
func audSwitchOnly(id, name, label string) h.Node {
	return switchui.Switch(h.ID(id), h.Data("toggle", name), h.Aria("label", label))
}
