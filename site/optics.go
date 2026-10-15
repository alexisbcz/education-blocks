package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// OpticsBlocks lists the optics and photography gallery in display order.
func OpticsBlocks() []Block {
	return []Block{
		optCameraBlock(),
		optExposureBlock(),
		optDepthBlock(),
		optThinLensBlock(),
		optInstrumentsBlock(),
		optDiffractionBlock(),
		optFieldOfViewBlock(),
		optColorBlock(),
		optPolarizationBlock(),
		optPrismBlock(),
	}
}

// optFigure embeds a generated anatomy figure with its own stylesheet.
func optFigure(name string) h.Node {
	b, err := static.ReadFile("static/anatomy/" + name + ".html")
	if err != nil {
		return h.P(h.Class("text-sm text-muted-foreground"), "Run node figures/"+name+"/build.mjs to build the figure.")
	}
	return h.Div(h.Class("mx-auto w-full max-w-3xl"),
		h.Link(h.Rel("stylesheet"), h.Href("/static/anatomy/"+name+".css")),
		h.UnsafeHTML(string(b)))
}

func optSvg(viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", ""), h.ViewBox(viewBox), h.Class("mx-auto block w-full max-w-[680px] select-none"), h.Role("img"), h.Aria("label", label))
}

func optLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(i [2]string) h.Node { return legendSwatch(i[0], i[1]) }))
}

func optNote(text string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-pretty text-muted-foreground"), text)
}

// ---------------------------------------------------------------- O1

func optCameraBlock() Block {
	return Block{
		Slug:        "camera-cutaway",
		Title:       "Camera cutaway",
		Description: "A mirrorless camera with its near quarter cut away. The aperture ring sets the iris (radius ∝ 1/N, so one stop halves the area), the dial sets the shutter time, and the readout is the exposure value EV = log₂(N²/t). Space fires the focal-plane shutter: watch the curtains and the light cone.",
		Tags:        []string{"isometric SVG", "anatomy", "exposure value"},
		Wide:        true,
		Render:      func() h.Node { return optFigure("optics-camera") },
	}
}

// ---------------------------------------------------------------- O2

var optScenes = [][2]string{{"15", "Sunny"}, {"12", "Overcast"}, {"8", "Bright room"}, {"5", "Night street"}}

func optExposureBlock() Block {
	return Block{
		Slug:        "exposure-triangle",
		Title:       "Exposure triangle",
		Description: "Aperture, shutter time and ISO each move exposure in stops, and each has a side effect: a wider aperture blurs the background, a longer time blurs motion, a higher ISO adds noise. Pick a scene and keep the meter at zero while trading one for another.",
		Tags:        []string{"stops", "EV", "sunny 16"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-exposure",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Canvas(h.Data("scene", ""), h.Class("mx-auto block aspect-[16/9] w-full max-w-[640px] rounded-lg border"), h.Role("img"), h.Aria("label", "A preview of the photograph: background blur, motion blur and noise")),
					optSvg("0 0 640 70", "Exposure meter, in stops"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scene (EV at ISO 100)"),
					segs("Scene", optScenes...),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Camera"),
					optNote("Each step is one stop. Drag a number sideways or use ↑ ↓."),
					field("n", "Aperture step", "f/16", 7, 0, 8, 1),
					field("t", "Shutter step", "1/125", 5, 0, 12, 1),
					field("iso", "ISO step", "100", 0, 0, 7, 1),
				),
				readouts([2]string{"settings", "settings"}, [2]string{"EV at ISO 100", "ev"}, [2]string{"exposure", "meter"}, [2]string{"same exposure", "equiv"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O3

func optDepthBlock() Block {
	return Block{
		Slug:        "depth-of-field",
		Title:       "Depth of field",
		Description: "How much of the scene is acceptably sharp, from the thin-lens model: hyperfocal distance H = f²/(Nc) + f, then the near and far limits around the subject. The circle of confusion c depends on the sensor size; focus at H and everything from H/2 to infinity is sharp.",
		Tags:        []string{"hyperfocal", "circle of confusion", "log axis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-dof",
				h.Div(h.Class("flex flex-col gap-1"),
					optLegend([2]string{"var(--brand)", "sharp zone"}, [2]string{"var(--foreground)", "subject"}, [2]string{"var(--vec-u)", "hyperfocal H"}),
					optSvg("0 0 640 230", "Depth of field along a log distance axis"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sensor"),
					segs("Sensor format", [2]string{"0.030", "Full frame"}, [2]string{"0.019", "APS-C"}, [2]string{"0.015", "Micro 4/3"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Lens and subject"),
					field("f", "Focal length", "mm", 50, 10, 400, 1),
					field("n", "Aperture f/", "", 8, 1.2, 32, 0.1),
					field("s", "Subject", "m", 3, 0.3, 100, 0.1),
				),
				h.Div(h.Class("flex gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "hyperfocal"), hugeicons.Target02Icon(), "Focus at H"),
				),
				readouts([2]string{"hyperfocal H", "h"}, [2]string{"near limit", "near"}, [2]string{"far limit", "far"}, [2]string{"depth", "depth"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O4

func optThinLensBlock() Block {
	return Block{
		Slug:        "ray-diagram",
		Title:       "Lenses and mirrors",
		Description: "The three principal rays, drawn live. Drag the object along the axis: 1/f = 1/dₒ + 1/dᵢ gives the image, m = −dᵢ/dₒ its size. A converging lens or a concave mirror makes a real, inverted image beyond F and a virtual, upright one inside it; diverging ones always make virtual images.",
		Tags:        []string{"thin lens", "principal rays", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-rays",
				h.Div(h.Class("flex flex-col gap-1"),
					optLegend([2]string{"var(--brand)", "rays"}, [2]string{"var(--vec-u)", "virtual extensions"}, [2]string{"var(--foreground)", "object and image"}),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 300"), h.Class("mx-auto block w-full max-w-[680px] touch-none select-none"), h.Role("img"), h.Aria("label", "Ray diagram. Drag the object or use the arrow keys.")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Element"),
					segs("Optical element", [2]string{"converging", "Converging"}, [2]string{"diverging", "Diverging"}, [2]string{"concave", "Concave mirror"}, [2]string{"convex", "Convex mirror"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					field("f", "|f|", "cm", 10, 3, 30, 0.5),
					field("do", "Object dₒ", "cm", 25, 1, 60, 0.5),
					field("ho", "Height", "cm", 5, 1, 10, 0.5),
				),
				readouts([2]string{"image dᵢ", "di"}, [2]string{"magnification", "m"}, [2]string{"image", "kind"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O5

func optInstrumentsBlock() Block {
	return Block{
		Slug:        "telescope-microscope",
		Title:       "Telescope and microscope",
		Description: "Two lenses in a row. A Keplerian telescope is afocal: parallel light in, parallel light out, angular magnification M = f_obj / f_eye. A compound microscope magnifies twice: the objective by L/f_obj, the eyepiece by 250 mm/f_eye, with a 160 mm tube.",
		Tags:        []string{"magnification", "exit pupil", "two lenses"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-instr",
				optSvg("0 0 640 260", "Two-lens instrument with rays"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Instrument"),
					segs("Instrument", [2]string{"telescope", "Telescope"}, [2]string{"microscope", "Microscope"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					field("fo", "Objective f", "mm", 900, 2, 2000, 1),
					field("fe", "Eyepiece f", "mm", 25, 4, 60, 1),
					field("d", "Objective D", "mm", 90, 10, 300, 1),
				),
				readouts([2]string{"magnification", "m"}, [2]string{"length", "len"}, [2]string{"exit pupil", "pupil"}, [2]string{"note", "note"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O6

func optDiffractionBlock() Block {
	return Block{
		Slug:        "diffraction",
		Title:       "Diffraction and the Airy disk",
		Description: "A circular aperture images a point as an Airy pattern, I(θ) = I₀[2J₁(x)/x]² with x = πD sin θ/λ; its first dark ring sits at θ ≈ 1.22 λ/D. On a camera sensor the disk is 2.44 λN across, so stopping down past a point blurs more than it sharpens.",
		Tags:        []string{"Bessel J₁", "Rayleigh", "pixel pitch"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-airy",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[3fr_2fr]"),
					optSvg("0 0 400 260", "Airy intensity profile"),
					h.Canvas(h.Data("disk", ""), h.Class("mx-auto block aspect-square w-full max-w-[260px] rounded-lg border"), h.Role("img"), h.Aria("label", "The Airy disk over the sensor's pixel grid")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Light and lens"),
					field("lambda", "Wavelength", "nm", 550, 400, 700, 5),
					field("n", "Aperture f/", "", 8, 1.4, 32, 0.1),
					field("pitch", "Pixel pitch", "µm", 4.3, 0.8, 9, 0.1),
				),
				readouts([2]string{"Airy disk ⌀", "disk"}, [2]string{"in pixels", "pixels"}, [2]string{"first zero", "zero"}, [2]string{"limit near", "limit"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O7

func optFieldOfViewBlock() Block {
	return Block{
		Slug:        "field-of-view",
		Title:       "Field of view and crop factor",
		Description: "The angle a lens sees depends on its focal length and the sensor's width: FOV = 2·atan(w / 2f). A smaller sensor crops the image, so the same lens behaves like a longer one: equivalent focal length = f × crop factor.",
		Tags:        []string{"angle of view", "crop factor", "equivalence"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-fov",
				optSvg("0 0 640 280", "Top view of the angle of view"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sensor"),
					segs("Sensor", [2]string{"36", "Full frame"}, [2]string{"23.5", "APS-C"}, [2]string{"17.3", "Micro 4/3"}, [2]string{"13.2", "1-inch"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					field("f", "Focal length", "mm", 35, 8, 600, 1),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([]int{14, 24, 35, 50, 85, 200}, func(f int) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("lens", fmt.Sprint(f)), fmt.Sprintf("%d mm", f))
						}),
					),
				),
				readouts([2]string{"horizontal", "hfov"}, [2]string{"diagonal", "dfov"}, [2]string{"crop factor", "crop"}, [2]string{"FF equivalent", "equiv"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O8

func optColorBlock() Block {
	return Block{
		Slug:        "color-light",
		Title:       "Color and light",
		Description: "Light adds, ink subtracts. Three overlapping lamps (red, green, blue) add up to white; three inks (cyan, magenta, yellow) each remove one primary and stack to near black. Below, a wavelength mapped to an approximate display color.",
		Tags:        []string{"additive", "subtractive", "spectrum"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-color",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Canvas(h.Data("mix", ""), h.Class("mx-auto block aspect-[4/3] w-full max-w-[420px] rounded-lg border"), h.Role("img"), h.Aria("label", "Three overlapping circles of light or ink")),
					h.Canvas(h.Data("spectrum", ""), h.Class("mx-auto block h-14 w-full max-w-[560px] cursor-crosshair rounded-lg border"), h.Role("img"), h.Aria("label", "Visible spectrum, 380 to 750 nm. Click to pick a wavelength.")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mixing"),
					segs("Mixing", [2]string{"additive", "Light (RGB)"}, [2]string{"subtractive", "Ink (CMY)"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"),
					field("a", "Channel 1", "%", 100, 0, 100, 1),
					field("b", "Channel 2", "%", 100, 0, 100, 1),
					field("c", "Channel 3", "%", 100, 0, 100, 1),
					field("lambda", "Wavelength", "nm", 550, 380, 750, 1),
				),
				readouts([2]string{"center", "center"}, [2]string{"λ color", "lambda"}, [2]string{"band", "band"}),
				optNote("Wavelength colors are approximate: a single wavelength can be more saturated than any screen can show."),
			)
		},
	}
}

// ---------------------------------------------------------------- O9

func optPolarizationBlock() Block {
	return Block{
		Slug:        "polarization",
		Title:       "Polarization and Malus's law",
		Description: "Unpolarized light loses half its intensity in the first polarizer; each one after passes I = I₀cos²θ, where θ is the angle between transmission axes. Crossed polarizers block everything, until a third one between them at 45° lets 1/8 through.",
		Tags:        []string{"Malus", "cos²θ", "three polarizers"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-polar",
				optSvg("0 0 640 240", "A beam through polarizers"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Polarizers (axis angle)"),
					field("a1", "First", "°", 0, -90, 90, 1),
					field("a2", "Middle", "°", 45, -90, 90, 1),
					field("a3", "Last", "°", 90, -90, 90, 1),
					toggle("opt-polar-mid", "mid", "Middle polarizer in", true),
				),
				readouts([2]string{"after first", "i1"}, [2]string{"after middle", "i2"}, [2]string{"out", "i3"}, [2]string{"as fraction", "frac"}),
			)
		},
	}
}

// ---------------------------------------------------------------- O10

func optPrismBlock() Block {
	return Block{
		Slug:        "prism",
		Title:       "Dispersion in a prism",
		Description: "Glass bends blue more than red because its index falls with wavelength (Cauchy: n ≈ A + B/λ², here fitted to BK7). Each color is refracted twice, by Snell's law at both faces; turn the prism to find the minimum deviation, where the ray crosses it symmetrically.",
		Tags:        []string{"Cauchy", "Snell twice", "minimum deviation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("opt-prism",
				optSvg("0 0 640 300", "White light dispersed by a prism"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Prism"),
					field("apex", "Apex angle", "°", 60, 20, 75, 1),
					field("inc", "Incidence", "°", 48, 0, 89, 0.5),
				),
				h.Div(h.Class("flex gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "min"), hugeicons.Target02Icon(), "Minimum deviation"),
				),
				readouts([2]string{"n at 656 nm", "nred"}, [2]string{"n at 486 nm", "nblue"}, [2]string{"deviation", "dev"}, [2]string{"spread", "spread"}),
				optNote("BK7 approximated by n = 1.5046 + 0.00420 µm²/λ² (two-term Cauchy fit, good to about ±0.001 across the visible)."),
			)
		},
	}
}
