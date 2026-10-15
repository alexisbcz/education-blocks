package site

import (
	"strconv"

	"github.com/alexisbcz/components/ui/button"
	h "github.com/alexisbcz/libhtml"
)

// FilmBlocks lists the animation and film gallery in display order.
func FilmBlocks() []Block {
	return []Block{
		filmRateBlock(),
		filmSquashBlock(),
		filmSpacingBlock(),
		filmFollowBlock(),
		filmSpringBlock(),
		filmKeysBlock(),
		filmAspectBlock(),
		filmShotsBlock(),
		filmAxisBlock(),
		filmGradeBlock(),
	}
}

// filmCanvas is a canvas filling its box, drawn by film.js.
func filmCanvas(attr, label, aspect string) h.Node {
	return h.Div(h.Class("relative mx-auto w-full overflow-hidden rounded-lg border bg-background "+aspect),
		h.Canvas(h.Data(attr, ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", label)))
}

func filmButton(action, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), label)
}

// ---------------------------------------------------------------- F1

func filmRateBlock() Block {
	return Block{
		Slug:        "frame-rate",
		Title:       "Frame rate and shutter angle",
		Description: "The same motion sampled at 12, 24, 30 and 60 frames per second. The shutter angle sets how long each frame is exposed, exposure = (angle / 360) / fps, and so how much motion blur each frame carries: 180° at 24 fps is the classic 1/48 s.",
		Tags:        []string{"fps", "motion blur", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-rate",
				filmCanvas("canvas", "A ball crossing the frame at four frame rates", "aspect-[16/9] max-w-[720px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Camera"),
					field("angle", "Shutter angle", "°", 180, 1, 360, 1),
					field("speed", "Ball speed", "widths/s", 0.5, 0.1, 2, 0.05),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Play"), filmButton("step", "Step")),
				readouts([2]string{"exposure at 24 fps", "exp24"}, [2]string{"exposure at 60 fps", "exp60"}, [2]string{"blur at 24 fps", "blur"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F2

func filmSquashBlock() Block {
	return Block{
		Slug:        "squash-stretch",
		Title:       "Squash and stretch",
		Description: "The first of the twelve principles in Thomas and Johnston's The Illusion of Life (1981). The ball stretches along its velocity and squashes on impact, but its area stays constant (width × height = 1), so it reads as soft without looking like it changes size.",
		Tags:        []string{"12 principles", "volume", "onion skin"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-squash",
				filmCanvas("canvas", "A bouncing ball with squash and stretch", "aspect-[16/9] max-w-[720px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ball"),
					field("amount", "Amount", "", 0.6, 0, 1.2, 0.05),
					toggle("film-squash-on", "squash", "Squash and stretch", true),
					toggle("film-squash-onion", "onion", "Onion skin", false),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Play"), filmButton("step", "Step")),
				readouts([2]string{"scale x · y", "scale"}, [2]string{"area", "area"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F3

func filmSpacingBlock() Block {
	return Block{
		Slug:        "timing-spacing",
		Title:       "Timing and spacing",
		Description: "Timing is how many frames a move takes; spacing is how far the drawing moves between them. An onion skin of one bounce shows each frame, and the spacing chart under it shows the gaps: wide at the bottom where the ball is fast, tight at the top where gravity slows it.",
		Tags:        []string{"onion skin", "spacing chart", "slow in / out"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-spacing",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 360"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "Onion skin of a bounce and its spacing chart")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Bounce"),
					field("frames", "Frames per bounce", "", 12, 4, 30, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Spacing"),
					segs("Spacing", [2]string{"gravity", "Gravity"}, [2]string{"ease", "Ease in-out"}, [2]string{"linear", "Even"}),
				),
				readouts([2]string{"at 24 fps", "dur"}, [2]string{"largest gap", "maxgap"}, [2]string{"smallest gap", "mingap"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F4

func filmFollowBlock() Block {
	return Block{
		Slug:        "follow-through",
		Title:       "Follow-through and overlapping action",
		Description: "Parts that hang off a moving body keep going after it stops, each a little later than the one before. A tail of five segments, each a damped spring following the one ahead, drags behind the head and settles in a wave. Turn on anticipation to add the small opposite move before the main one.",
		Tags:        []string{"12 principles", "spring chain", "anticipation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-follow",
				filmCanvas("canvas", "A head moving with a tail that follows", "aspect-[16/9] max-w-[720px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Tail"),
					field("stiff", "Stiffness", "", 120, 10, 400, 5),
					field("damp", "Damping", "", 14, 0, 40, 0.5),
					toggle("film-follow-ant", "anticipation", "Anticipation", true),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Play"), filmButton("reset", "Reset")),
				readouts([2]string{"tail lag", "lag"}, [2]string{"settled", "settled"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F5

func filmSpringBlock() Block {
	return Block{
		Slug:        "spring",
		Title:       "Spring motion",
		Description: "A mass on a spring with a damper, released one unit away from rest: its curve is exact for any mass, stiffness and damping. The damping ratio ζ = c / (2√(km)) decides the character: bouncy below 1, critically damped at 1 (the fastest return with no overshoot), sluggish above. In interfaces, springs suit gestures and drags; fixed curves suit everything else.",
		Tags:        []string{"damping ratio", "overshoot", "exact"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-spring",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Spring position over time")),
					h.Div(h.Class("relative h-14 overflow-hidden rounded-lg border bg-background"), h.Data("track", ""),
						h.Div(h.Data("box", ""), h.Class("absolute top-2 left-0 size-10 rounded-md bg-brand"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Spring"),
					field("mass", "Mass m", "", 1, 0.1, 5, 0.1),
					field("k", "Stiffness k", "", 100, 5, 500, 5),
					field("c", "Damping c", "", 6, 0, 80, 0.5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), filmButton("critical", "Make critical"), playPauseLabel("Play")),
				readouts([2]string{"ζ", "zeta"}, [2]string{"character", "kind"}, [2]string{"overshoot", "over"}, [2]string{"settles (2%)", "settle"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F6

func filmKeysBlock() Block {
	return Block{
		Slug:        "keyframes",
		Title:       "Keyframes and interpolation",
		Description: "Four keys on a timeline; the computer fills the frames in between. Linear joins them with straight lines and sharp turns, ease gives each segment a slow in and slow out, and Catmull-Rom draws one smooth curve through every key, at the cost of overshooting past them. Drag the keys, or select one and use the arrow keys.",
		Tags:        []string{"in-betweens", "Catmull-Rom", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-keys",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 280"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Animation curve through four keyframes")),
					h.Div(h.Class("relative h-12 overflow-hidden rounded-lg border bg-background"), h.Data("track", ""),
						h.Div(h.Data("dot", ""), h.Class("absolute top-2 left-0 size-8 rounded-full bg-brand"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Interpolation"),
					segs("Interpolation", [2]string{"linear", "Linear"}, [2]string{"ease", "Ease"}, [2]string{"catmull", "Catmull-Rom"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPauseLabel("Play"), filmButton("reset", "Reset keys")),
				readouts([2]string{"frame", "frame"}, [2]string{"value", "value"}, [2]string{"overshoot", "over"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F7

func filmAspectBlock() Block {
	return Block{
		Slug:        "aspect-ratio",
		Title:       "Aspect ratios and framing",
		Description: "Fit a picture of one shape onto a screen of another without cropping: a wider picture gets bars above and below (letterbox), a narrower one bars at the sides (pillarbox). The bars are exact: 2.39:1 on a 16:9 screen leaves 12.8% top and bottom. Safe areas follow SMPTE ST 2046-1 for HD: action 93%, titles 90%.",
		Tags:        []string{"letterbox", "pillarbox", "safe areas"},
		Wide:        true,
		Render: func() h.Node {
			ratios := [][2]string{{"1.333", "4:3"}, {"1.778", "16:9"}, {"1.85", "1.85:1"}, {"2.39", "2.39:1"}, {"0.5625", "9:16"}, {"1", "1:1"}}
			pick := func(name string, def int) h.Node {
				return h.Div(h.Class("flex flex-wrap gap-1"), h.Data("pick", name),
					h.MapIdx(ratios, func(i int, r [2]string) h.Node {
						return h.Button(h.Type("button"), h.Data("ratio", r[0]), h.Aria("pressed", h.Ternary(i == def, "true", "false")),
							h.Class("rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-brand aria-pressed:text-brand"),
							r[1])
					}))
			}
			return plotPanel("film-aspect",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 380"), h.Class("mx-auto block w-full max-w-[720px]"), h.Role("img"), h.Aria("label", "A picture fitted onto a screen")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Picture"), pick("picture", 3)),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Screen"), pick("screen", 1)),
				h.Div(h.Class("flex flex-col gap-3"), toggle("film-aspect-safe", "safe", "Safe areas", true)),
				readouts([2]string{"fit", "fit"}, [2]string{"each bar", "bar"}, [2]string{"screen used", "used"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F8

type filmShot struct {
	code, name, use string
	top, bottom     float64 // framed slice of the figure, 0 = top of head, 1 = feet
}

var filmShots = []filmShot{
	{"ECU", "Extreme close-up", "One detail, often the eyes: intensity, a clue.", 0.035, 0.085},
	{"CU", "Close-up", "The face fills the frame: emotion, reaction.", 0.0, 0.17},
	{"MCU", "Medium close-up", "Head and shoulders: the default for dialogue.", 0.0, 0.27},
	{"MS", "Medium shot", "From the waist up: gesture and expression together.", 0.0, 0.5},
	{"MFS", "Medium full shot", "From the knees up: the American shot of westerns.", 0.0, 0.72},
	{"FS", "Full shot", "The whole body, head to feet: movement, costume.", -0.04, 1.04},
	{"WS", "Wide shot", "The figure in its setting: where we are.", -0.6, 1.6},
	{"EWS", "Extreme wide shot", "The setting dominates; the figure is a speck: scale, isolation.", -2.6, 3.6},
}

func filmShotsBlock() Block {
	return Block{
		Slug:        "shot-sizes",
		Title:       "Shot sizes and angles",
		Description: "The standard shot sizes, each framing the same figure tighter or looser, and the three camera angles that change how we read it: a high angle looks down and diminishes, a low angle looks up and empowers, a Dutch tilt unsettles. Names vary a little between crews; these are the common ones.",
		Tags:        []string{"framing", "camera angle", "cards"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("film-shots", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					panelLabel("Camera angle"),
					segs("Camera angle", [2]string{"eye", "Eye level"}, [2]string{"high", "High"}, [2]string{"low", "Low"}, [2]string{"dutch", "Dutch"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-3 sm:grid-cols-4"),
					h.Map(filmShots, func(s filmShot) h.Node {
						return h.Figure(h.Class("flex flex-col gap-2"),
							h.Svg(h.Data("shot", s.code), h.Data("top", ftoa(s.top)), h.Data("bottom", ftoa(s.bottom)),
								h.ViewBox("0 0 160 90"), h.Class("block w-full rounded-md border bg-code"), h.Role("img"), h.Aria("label", s.name)),
							h.Figcaption(h.Class("flex flex-col gap-0.5"),
								h.Span(h.Class("flex items-baseline gap-2 text-sm font-medium"), h.Span(h.Class("font-mono text-[11px] text-brand"), s.code), s.name),
								h.Span(h.Class("text-xs leading-relaxed text-muted-foreground"), s.use)),
						)
					}),
				),
				h.P(h.Data("angle-note", ""), h.Class("text-sm text-muted-foreground"), "Eye level: neutral, the camera is a witness."),
			)
		},
	}
}

func ftoa(f float64) string { return strconv.FormatFloat(f, 'g', -1, 64) }

// ---------------------------------------------------------------- F9

func filmAxisBlock() Block {
	return Block{
		Slug:        "axis-of-action",
		Title:       "The 180-degree rule",
		Description: "Two characters face each other across an imaginary line, the axis of action. While the camera stays on one side, A stays on the left of the frame and B on the right, cut after cut. Drag the camera across the line and they swap sides on screen: the audience reads it as a jump. Arrow keys move the camera too.",
		Tags:        []string{"screen direction", "drag", "keyboard"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-axis",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Svg(h.Data("plan", ""), h.ViewBox("0 0 400 300"), h.Class("block w-full touch-none select-none"), h.Role("img"), h.Aria("label", "Top view of two characters, the axis and the camera")),
					h.Div(h.Class("flex flex-col gap-2"),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "what the camera sees"),
						h.Svg(h.Data("view", ""), h.ViewBox("0 0 160 90"), h.Class("block w-full rounded-md border bg-background"), h.Role("img"), h.Aria("label", "The camera's frame")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Camera"),
					h.P(h.Class("text-sm text-muted-foreground"), "Drag the camera around the pair."),
					filmButton("cross", "Jump across the line"),
				),
				readouts([2]string{"A on screen", "a"}, [2]string{"B on screen", "b"}, [2]string{"side", "side"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F10

func filmGradeBlock() Block {
	return Block{
		Slug:        "colour-grading",
		Title:       "Colour grading: lift, gamma, gain",
		Description: "The three basic grading controls on a generated frame, per channel: lift moves the blacks, gamma the mid-tones, gain the whites, using one common definition, out = gain · (x + lift · (1 − x))^(1/gamma). The waveform scope plots every pixel's brightness by column, as a colourist reads it.",
		Tags:        []string{"lift gamma gain", "waveform", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("film-grade",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "frame"),
						filmCanvas("canvas", "A generated landscape frame", "aspect-[16/9]")),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "waveform (luma)"),
						filmCanvas("scope", "Waveform scope of the frame", "aspect-[16/9]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Grade"),
					segs("Channel", [2]string{"all", "Master"}, [2]string{"r", "R"}, [2]string{"g", "G"}, [2]string{"b", "B"}),
					field("lift", "Lift", "", 0, -0.3, 0.3, 0.01),
					field("gamma", "Gamma", "", 1, 0.4, 2.5, 0.01),
					field("gain", "Gain", "", 1, 0.5, 1.5, 0.01),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), filmButton("teal", "Teal & orange"), filmButton("reset", "Reset")),
				readouts([2]string{"black point", "black"}, [2]string{"white point", "white"}, [2]string{"clipped", "clip"}),
			)
		},
	}
}
