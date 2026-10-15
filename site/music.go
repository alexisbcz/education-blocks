package site

import (
	"fmt"
	"math"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// MusicBlocks lists the music theory and acoustics gallery in display order.
func MusicBlocks() []Block {
	return []Block{
		musicPianoBlock(),
		musicIntervalsBlock(),
		musicHarmonicsBlock(),
		musicCircleBlock(),
		musicScalesBlock(),
		musicChordsBlock(),
		musicStringBlock(),
		musicSequencerBlock(),
	}
}

var musicSharpNames = []string{"C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"}

// musicName is a MIDI note's name with octave, in sharps (C4 = 60).
func musicName(midi int) string { return fmt.Sprintf("%s%d", musicSharpNames[midi%12], midi/12-1) }

// musicFreq is twelve-tone equal temperament with A4 = 440 Hz.
func musicFreq(midi int) float64 { return 440 * math.Pow(2, float64(midi-69)/12) }

func musicIsBlack(midi int) bool {
	switch midi % 12 {
	case 1, 3, 6, 8, 10:
		return true
	}
	return false
}

// musicKeyboard renders the keys lo..hi (MIDI numbers, lo a C) as buttons
// carrying data-midi; static/js/music.js plays them and marks them.
func musicKeyboard(lo, hi int, label string) h.Node {
	var whites []int
	for m := lo; m <= hi; m++ {
		if !musicIsBlack(m) {
			whites = append(whites, m)
		}
	}
	w := 100 / float64(len(whites))
	var keys []h.Node
	for i, m := range whites {
		keys = append(keys, h.Button(h.Type("button"), h.Data("midi", fmt.Sprint(m)), h.Aria("label", musicName(m)),
			h.Style(fmt.Sprintf("left:%.4f%%;width:%.4f%%", float64(i)*w, w)),
			// Keys keep piano colours in both themes: ivory and ebony.
			h.Class("group/key absolute top-0 bottom-0 flex flex-col items-center justify-end rounded-b-md border border-neutral-300 bg-white pb-1.5 outline-none focus-visible:z-20 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-neutral-950 dark:bg-neutral-200 data-[hl]:bg-[color-mix(in_oklab,var(--brand)_16%,white)] dark:data-[hl]:bg-[color-mix(in_oklab,var(--brand)_30%,#e5e5e5)] data-[on]:!bg-brand"),
			h.Span(h.Data("label", ""), h.Class("font-mono text-[10px] text-neutral-500 group-data-[on]/key:text-white"), h.If(m%12 == 0, musicName(m))),
		))
	}
	for m := lo; m <= hi; m++ {
		if !musicIsBlack(m) {
			continue
		}
		// A black key sits on the boundary after the white key below it.
		idx := 0
		for i, wm := range whites {
			if wm == m-1 {
				idx = i
			}
		}
		left := float64(idx+1)*w - w*0.32
		keys = append(keys, h.Button(h.Type("button"), h.Data("midi", fmt.Sprint(m)), h.Aria("label", musicName(m)),
			h.Style(fmt.Sprintf("left:%.4f%%;width:%.4f%%", left, w*0.64)),
			h.Class("group/key absolute top-0 z-10 flex h-[60%] flex-col items-center justify-end rounded-b-[5px] bg-neutral-900 pb-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-neutral-950 dark:ring-1 dark:ring-neutral-700 data-[hl]:bg-[color-mix(in_oklab,var(--brand)_55%,#171717)] dark:data-[hl]:bg-[color-mix(in_oklab,var(--brand)_60%,#0a0a0a)] data-[on]:!bg-brand"),
			h.Span(h.Data("label", ""), h.Class("font-mono text-[8px] text-neutral-200")),
		))
	}
	return h.Div(h.Data("keyboard", ""), h.Role("group"), h.Aria("label", label), h.Class("relative h-36 w-full select-none sm:h-44"), h.Group(keys))
}

// ---------------------------------------------------------------- M1

func musicPianoBlock() Block {
	return Block{
		Slug:        "piano",
		Title:       "Keyboard and frequencies",
		Description: "Two octaves from middle C. Each key shows its name, MIDI number and frequency in twelve-tone equal temperament, where every semitone multiplies the frequency by the twelfth root of 2 and A4 is tuned to 440 Hz. Play with the mouse, touch, or the computer keyboard.",
		Tags:        []string{"Web Audio", "12-TET", "kbd"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("music-piano", ""),
				musicKeyboard(60, 83, "Piano keyboard, C4 to B5"),
				h.Div(h.Class("grid gap-3 sm:grid-cols-[1fr_auto]"),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-[auto_1fr_auto_1fr]"),
						h.Dt(h.Class("text-muted-foreground"), "note"), h.Dd(h.Data("out", "note"), "A4"),
						h.Dt(h.Class("text-muted-foreground"), "MIDI"), h.Dd(h.Data("out", "midi"), "69"),
						h.Dt(h.Class("text-muted-foreground"), "frequency"), h.Dd(h.Data("out", "freq"), "440.00 Hz"),
						h.Dt(h.Class("text-muted-foreground"), "formula"), h.Dd(h.Data("out", "formula"), "440 · 2^(0/12)"),
					),
					h.P(h.Class("flex flex-wrap items-center gap-1 text-xs text-muted-foreground"),
						"Keys", kbd.Kbd("A"), kbd.Kbd("W"), kbd.Kbd("S"), "…", kbd.Kbd("K"), "play C4–C5"),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- M2

var musicIntervals = []struct {
	name     string
	semi     int
	num, den int
}{
	{"Unison", 0, 1, 1}, {"Minor second", 1, 16, 15}, {"Major second", 2, 9, 8}, {"Minor third", 3, 6, 5},
	{"Major third", 4, 5, 4}, {"Perfect fourth", 5, 4, 3}, {"Tritone", 6, 45, 32}, {"Perfect fifth", 7, 3, 2},
	{"Minor sixth", 8, 8, 5}, {"Major sixth", 9, 5, 3}, {"Minor seventh", 10, 16, 9}, {"Major seventh", 11, 15, 8}, {"Octave", 12, 2, 1},
}

func musicIntervalsBlock() Block {
	return Block{
		Slug:        "intervals",
		Title:       "Just and equal intervals",
		Description: "Simple frequency ratios sound consonant: 3:2 is a fifth, 5:4 a major third. Equal temperament divides the octave into 12 equal steps of 100 cents, so its intervals miss the just ratios slightly. The major third misses by almost 14 cents. Play both and listen for the beating.",
		Tags:        []string{"cents", "ratios", "tuning"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("scroll-thin overflow-x-auto rounded-xl border bg-background"), h.Data("music-intervals", ""),
				h.Table(h.Class("w-full min-w-[620px] text-sm"),
					h.Thead(h.Tr(h.Class("border-b text-left text-xs text-muted-foreground"),
						h.Th(h.Class("px-3 py-2 font-normal"), "Interval"),
						h.Th(h.Class("px-3 py-2 text-right font-normal"), "Just ratio"),
						h.Th(h.Class("px-3 py-2 text-right font-normal"), "Just (cents)"),
						h.Th(h.Class("px-3 py-2 text-right font-normal"), "Equal (cents)"),
						h.Th(h.Class("px-3 py-2 text-right font-normal"), "Difference"),
						h.Th(h.Class("px-3 py-2 font-normal"), h.Span(h.Class("sr-only"), "Play")),
					)),
					h.Tbody(h.Map(musicIntervals, func(iv struct {
						name     string
						semi     int
						num, den int
					}) h.Node {
						just := 1200 * math.Log2(float64(iv.num)/float64(iv.den))
						eq := float64(iv.semi * 100)
						diff := eq - just
						return h.Tr(h.Class("border-b last:border-b-0"),
							h.Td(h.Class("px-3 py-1.5"), iv.name),
							h.Td(h.Class("px-3 py-1.5 text-right font-mono tabular-nums"), fmt.Sprintf("%d:%d", iv.num, iv.den)),
							h.Td(h.Class("px-3 py-1.5 text-right font-mono tabular-nums"), fmt.Sprintf("%.2f", just)),
							h.Td(h.Class("px-3 py-1.5 text-right font-mono tabular-nums"), fmt.Sprintf("%.0f", eq)),
							h.Td(h.Class("px-3 py-1.5 text-right font-mono tabular-nums "+h.Ternary(math.Abs(diff) > 10, "text-brand", "text-muted-foreground")), musicSigned(diff)),
							h.Td(h.Class("px-3 py-1.5"),
								h.Div(h.Class("flex justify-end gap-1"),
									button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("dyad", fmt.Sprintf("just:%d/%d", iv.num, iv.den)), "Just"),
									button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("dyad", fmt.Sprintf("equal:%d", iv.semi)), "Equal"),
								)),
						)
					})),
				),
				h.P(h.Class("border-t px-3 py-2 text-xs text-muted-foreground"),
					"Both notes play together over C4 (261.63 Hz). Cents: 1200 · log₂(ratio). Several just ratios exist for some intervals (the tritone is also 64:45, the minor seventh 9:5); one common choice is shown."),
			)
		},
	}
}

func musicSigned(v float64) string {
	if math.Abs(v) < 0.005 {
		return "0.00"
	}
	if v < 0 {
		return fmt.Sprintf("−%.2f", -v)
	}
	return fmt.Sprintf("+%.2f", v)
}

// ---------------------------------------------------------------- M3

func musicHarmonicsBlock() Block {
	return Block{
		Slug:        "timbre",
		Title:       "Harmonics and timbre",
		Description: "A musical tone is a sum of sine waves at whole-number multiples of the fundamental. Their amplitudes set the timbre: a sawtooth has every harmonic at 1/n, a square only the odd ones at 1/n, a triangle the odd ones at 1/n². Drag the bars to build your own.",
		Tags:        []string{"additive synthesis", "Fourier", "Web Audio"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("music-timbre",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("wave", ""), h.ViewBox("0 0 560 180"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "One period of the waveform")),
					h.Svg(h.Data("spectrum", ""), h.ViewBox("0 0 560 170"), h.Class("block w-full cursor-ns-resize touch-none select-none"), h.Role("img"), h.Aria("label", "Harmonic amplitudes. Drag a bar to change it.")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map([][2]string{{"sine", "Sine"}, {"saw", "Sawtooth"}, {"square", "Square"}, {"triangle", "Triangle"}, {"organ", "Organ-like"}, {"clear", "Clear"}}, func(p [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("preset", p[0]), h.Class("justify-start font-normal"), p[1])
						}),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), field("f0", "Fundamental", "Hz", 220, 55, 880, 1)),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), hugeicons.VolumeHighIcon(), "Play 1.5 s"),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Twelve harmonics, sine phase. The ear barely hears phase, so the sound depends almost only on the amplitudes."),
			)
		},
	}
}

// ---------------------------------------------------------------- M4

func musicCircleBlock() Block {
	return Block{
		Slug:        "circle-of-fifths",
		Title:       "Circle of fifths",
		Description: "Keys arranged by fifths: each step clockwise adds a sharp, each step counterclockwise a flat, and neighbouring keys share six of their seven notes. Relative minors sit inside. Click a key to see its signature and scale.",
		Tags:        []string{"keys", "signatures", "SVG"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("music-circle",
				h.Svg(h.Data("circle", ""), h.ViewBox("0 0 400 400"), h.Class("mx-auto block w-full max-w-[440px]"), h.Role("group"), h.Aria("label", "Circle of fifths")),
				h.Div(h.Class("flex flex-col gap-1"), panelLabel("Key"),
					h.Span(h.Data("out", "key"), h.Class("text-2xl font-semibold tracking-tight"), "C major"),
					h.Span(h.Data("out", "minor"), h.Class("text-sm text-muted-foreground"), "relative minor: A minor")),
				h.Div(h.Class("flex flex-col gap-1 border-t pt-4"), panelLabel("Signature"),
					h.Span(h.Data("out", "sig"), h.Class("font-mono text-sm"), "no sharps or flats")),
				h.Div(h.Class("flex flex-col gap-1 border-t pt-4"), panelLabel("Scale"),
					h.Span(h.Data("out", "scale"), h.Class("font-mono text-sm"), "C D E F G A B")),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), hugeicons.VolumeHighIcon(), "Play tonic chord"),
			)
		},
	}
}

// ---------------------------------------------------------------- M5

func musicScalesBlock() Block {
	tonics := []string{"C", "C♯", "D♭", "D", "E♭", "E", "F", "F♯", "G♭", "G", "A♭", "A", "B♭", "B"}
	modes := [][2]string{{"ionian", "Ionian (major)"}, {"dorian", "Dorian"}, {"phrygian", "Phrygian"}, {"lydian", "Lydian"}, {"mixolydian", "Mixolydian"}, {"aeolian", "Aeolian (natural minor)"}, {"locrian", "Locrian"}, {"harmonic", "Harmonic minor"}, {"pentatonic", "Major pentatonic"}}
	return Block{
		Slug:        "scales",
		Title:       "Scales and modes",
		Description: "A scale is a pattern of steps. The seven modes are the same pattern of whole (W) and half (H) steps started on different notes; spelled correctly, each letter appears once. Pick a tonic and a mode, then play it.",
		Tags:        []string{"modes", "spelling", "Web Audio"},
		Wide:        true,
		Render: func() h.Node {
			sel := func(name, lbl string, opts [][2]string, def string) h.Node {
				return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
					h.Span(h.Class("text-muted-foreground"), lbl),
					h.Select(h.Data("select", name),
						h.Class("h-8 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"),
						h.Map(opts, func(o [2]string) h.Node { return h.Option(h.Value(o[0]), h.If(o[0] == def, h.Selected()), o[1]) })))
			}
			var topts [][2]string
			for _, t := range tonics {
				topts = append(topts, [2]string{t, t})
			}
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("music-scales", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					musicKeyboard(60, 83, "Scale on the keyboard"),
					h.Div(h.Data("out", "notes"), h.Class("flex flex-wrap gap-1.5")),
				),
				h.Div(h.Class("flex flex-col gap-3 p-5"),
					sel("tonic", "Tonic", topts, "C"),
					sel("mode", "Mode", modes, "ionian"),
					h.Div(h.Class("flex flex-col gap-1 border-t pt-3"), panelLabel("Steps"),
						h.Span(h.Data("out", "steps"), h.Class("font-mono text-sm tracking-widest"), "W W H W W W H")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), hugeicons.PlayIcon(), "Play up and down"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Sharps and flats follow the letters: E♭ Dorian contains G♭ and D♭, not F♯ and C♯. Pentatonic and harmonic minor are included for contrast (the latter has a 1½-step gap)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- M6

func musicChordsBlock() Block {
	return Block{
		Slug:        "chords",
		Title:       "Chord identifier",
		Description: "Click keys to build a chord; it is named from the intervals above each candidate root, and its inversion from the lowest note. Or pick a root and a quality to see how it is built.",
		Tags:        []string{"triads", "sevenths", "inversions"},
		Wide:        true,
		Render: func() h.Node {
			qualities := [][2]string{{"maj", "Major"}, {"min", "Minor"}, {"dim", "Diminished"}, {"aug", "Augmented"}, {"7", "Dominant 7"}, {"maj7", "Major 7"}, {"m7", "Minor 7"}, {"m7b5", "Half-dim 7"}}
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_280px]"), h.Data("music-chords", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					musicKeyboard(48, 71, "Chord keyboard, C3 to B4"),
					h.Div(h.Class("flex flex-wrap items-baseline gap-3"),
						h.Span(h.Data("out", "name"), h.Class("text-2xl font-semibold tracking-tight"), "—"),
						h.Span(h.Data("out", "detail"), h.Class("text-sm text-muted-foreground"), "Click two or more keys"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3 p-5"),
					panelLabel("Build on the selected root"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						h.Map(qualities, func(q [2]string) h.Node {
							return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("quality", q[0]), h.Class("justify-start font-normal"), q[1])
						}),
					),
					h.Div(h.Class("grid grid-cols-2 gap-1.5 border-t pt-3"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "invert"), hugeicons.RefreshIcon(), "Invert"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "clear"), hugeicons.Delete02Icon(), "Clear"),
						button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), h.Class("col-span-2"), hugeicons.VolumeHighIcon(), "Play"),
					),
					readouts([2]string{"notes", "notes"}, [2]string{"intervals", "intervals"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- M7

func musicStringBlock() Block {
	return Block{
		Slug:        "string",
		Title:       "Strings and beats",
		Description: "Why a string has a pitch: waves on it travel at v = √(T/μ) and only standing waves with nodes at both ends survive, at fₙ = n·v/2L. Two close frequencies played together beat at their difference.",
		Tags:        []string{"standing waves", "beats", "physics"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("music-string",
				h.Div(h.Class("flex flex-col gap-3"),
					segs("View", [2]string{"standing", "Standing wave"}, [2]string{"beats", "Beats"}),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "String or beat waveform")),
					h.P(h.Data("out", "caption"), h.Class("text-xs text-muted-foreground")),
				),
				h.Div(h.Data("view", "standing"), h.Class("flex flex-col gap-2"), panelLabel("String"),
					field("L", "Length L", "m", 0.65, 0.2, 1.5, 0.01),
					field("T", "Tension T", "N", 70, 5, 200, 1),
					field("mu", "Density μ", "g/m", 1.0, 0.2, 10, 0.05),
					field("n", "Harmonic n", "", 1, 1, 8, 1),
				),
				h.Div(h.Data("view", "beats"), h.Hidden(), h.Class("flex flex-col gap-2"), panelLabel("Two tones"),
					field("fa", "f₁", "Hz", 440, 100, 1000, 0.5),
					field("fb", "f₂", "Hz", 444, 100, 1000, 0.5),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"), hugeicons.VolumeHighIcon(), "Play"),
				readouts([2]string{"wave speed", "v"}, [2]string{"frequency", "f"}, [2]string{"harmonics · carrier", "list"}),
			)
		},
	}
}

// ---------------------------------------------------------------- M8

func musicSequencerBlock() Block {
	return Block{
		Slug:        "sequencer",
		Title:       "Rhythm sequencer",
		Description: "A step sequencer with sample-accurate timing: notes are scheduled ahead on the audio clock rather than fired by timers, so the beat does not drift. Change the metre and the tempo while it plays.",
		Tags:        []string{"rhythm", "metre", "Web Audio"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("music-seq", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
						hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.StopIcon(h.Data("icon", "pause"), h.Hidden()), h.Span(h.Data("label", ""), "Play")),
					segs("Metre", [2]string{"4/4", "4/4"}, [2]string{"3/4", "3/4"}, [2]string{"6/8", "6/8"}),
					h.Div(h.Class("w-44"), field("bpm", "Tempo", "BPM", 96, 40, 200, 1)),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "clear"), hugeicons.Delete02Icon(), "Clear"),
				),
				h.Div(h.Data("grid", ""), h.Class("scroll-thin overflow-x-auto")),
				h.P(h.Data("out", "info"), h.Class("text-xs text-muted-foreground")),
			)
		},
	}
}
