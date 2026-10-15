package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// ImagingBlocks lists the medical imaging gallery in display order.
func ImagingBlocks() []Block {
	return []Block{
		imgXrayBlock(),
		imgCTBlock(),
		imgHUBlock(),
		imgLarmorBlock(),
		imgRelaxBlock(),
		imgWeightingBlock(),
		imgKspaceBlock(),
		imgUltrasoundBlock(),
		imgPETBlock(),
		imgQualityBlock(),
	}
}

func imgNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func imgAction(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// imgCanvas is a square grayscale picture drawn by imaging.js.
func imgCanvas(name, label string) h.Node {
	return h.Canvas(h.Data("canvas", name), h.Class("block aspect-square w-full rounded-md bg-black [image-rendering:pixelated]"),
		h.Role("img"), h.Aria("label", label))
}

func imgCaption(s string) h.Node {
	return h.P(h.Class("pt-1.5 text-center font-mono text-[11px] text-muted-foreground"), s)
}

// ---------------------------------------------------------------- I1

func imgXrayBlock() Block {
	return Block{
		Slug:        "xray",
		Title:       "X-ray projection",
		Description: "A radiograph is a shadow of attenuation. Each ray through this synthetic chest slice loses intensity as I = I₀·e^(−Σμ·Δx) (Beer–Lambert); bone stops more than soft tissue, lung almost nothing. Raise the beam energy and every μ falls, bone faster than tissue, so contrast drops.",
		Tags:        []string{"Beer–Lambert", "attenuation", "contrast"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-xray",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("slice", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Chest slice with vertical rays and the transmitted intensity profile")),
					h.Div(h.Class("h-8 overflow-hidden rounded-md border"), h.Canvas(h.Data("film", ""), h.Class("block size-full"), h.Role("img"), h.Aria("label", "The radiograph: one line of film"))),
					imgCaption("film (one detector row): bright = more attenuation, as radiographs are printed"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Beam"),
					segs("Beam energy", [2]string{"40", "40 keV"}, [2]string{"60", "60 keV"}, [2]string{"80", "80 keV"}, [2]string{"100", "100 keV"}),
					field("rib", "Bone thickness", "cm", 1.2, 0, 4, 0.1),
				),
				readouts([2]string{"μ tissue", "mut"}, [2]string{"μ bone", "mub"}, [2]string{"through spine", "spine"}, [2]string{"through lung", "lung"}, [2]string{"bone contrast", "contrast"}),
				imgNote("μ from NIST mass-attenuation coefficients (water, cortical bone, lung) at a single energy; a real tube emits a spectrum (≈ kVp/3 mean energy). Typical values."),
			)
		},
	}
}

// ---------------------------------------------------------------- I2

func imgCTBlock() Block {
	return Block{
		Slug:        "ct",
		Title:       "CT reconstruction",
		Description: "From shadows back to slices. The Shepp–Logan head phantom (1974) is projected at many angles into a sinogram (the Radon transform, computed exactly from its ellipses). Plain backprojection smears it; filtering each projection with a ramp in the frequency domain first gives a sharp image.",
		Tags:        []string{"Radon", "sinogram", "filtered backprojection"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-ct",
				h.Div(h.Class("grid grid-cols-3 gap-3"),
					h.Div(imgCanvas("phantom", "Shepp–Logan phantom"), imgCaption("phantom")),
					h.Div(imgCanvas("sinogram", "Sinogram: angle across, detector position down"), imgCaption("sinogram (θ →)")),
					h.Div(imgCanvas("recon", "Reconstruction"), imgCaption("reconstruction")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Reconstruction"),
					segs("Filter", [2]string{"ramlak", "Ram-Lak"}, [2]string{"shepplogan", "Shepp-Logan"}, [2]string{"none", "None"}),
					field("angles", "Projections", "", 60, 4, 180, 1),
					toggle("img-ct-mod", "modified", "High-contrast phantom (Toft)", true),
				),
				readouts([2]string{"projections", "n"}, [2]string{"RMS error", "rms"}, [2]string{"time", "ms"}),
				imgNote("Parallel-beam geometry, 128 detector bins over [−1, 1], 128×128 reconstruction. Few projections give streaks; no filter gives the 1/r blur."),
			)
		},
	}
}

// ---------------------------------------------------------------- I3

func imgHUBlock() Block {
	return Block{
		Slug:        "hounsfield",
		Title:       "Hounsfield units & windowing",
		Description: "CT reports attenuation on a scale pinned to water and air: HU = 1000·(μ − μ_water)/(μ_water − μ_air). A monitor shows ~256 grey levels, so a window (level ± width/2) picks which slice of the −1000…+3000 range gets them.",
		Tags:        []string{"HU", "window/level", "contrast"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-hu",
				h.Div(h.Class("flex flex-col gap-3 sm:flex-row"),
					h.Div(h.Class("w-full sm:w-1/2"), imgCanvas("slice", "Synthetic chest CT slice in Hounsfield units"), imgCaption("synthetic chest slice (hover for HU)")),
					h.Svg(h.Data("scale", ""), h.ViewBox("0 0 300 300"), h.Class("block w-full sm:w-1/2"), h.Role("img"), h.Aria("label", "HU scale with the window")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Window"),
					segs("Window preset", [2]string{"soft", "Soft tissue"}, [2]string{"lung", "Lung"}, [2]string{"bone", "Bone"}, [2]string{"brain", "Brain"}),
					field("level", "Level", "HU", 40, -1000, 2000, 10),
					field("width", "Width", "HU", 400, 10, 4000, 10),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("HU from μ"),
					field("mu", "μ", "cm⁻¹", 0.19, 0, 1, 0.001),
				),
				readouts([2]string{"HU of μ", "hu"}, [2]string{"pixel", "pixel"}, [2]string{"window", "range"}),
				imgNote("μ_water = 0.19 cm⁻¹ (≈ 70 keV), μ_air ≈ 0. Preset windows and tissue HU are typical values."),
			)
		},
	}
}

// ---------------------------------------------------------------- I4

func imgLarmorBlock() Block {
	return Block{
		Slug:        "larmor",
		Title:       "Larmor precession",
		Description: "In a magnetic field B₀ a nuclear spin's magnetization precesses at the Larmor frequency f = γ̄·B₀. MRI listens at that frequency; a radiofrequency pulse at f tips the magnetization away from B₀ (the flip angle).",
		Tags:        []string{"MRI", "γ", "resonance"},
		Render: func() h.Node {
			return plotPanel("img-larmor",
				h.Svg(h.Data("spin", ""), h.ViewBox("0 0 320 300"), h.Class("mx-auto block w-full max-w-[360px]"), h.Role("img"), h.Aria("label", "Magnetization precessing about B0")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Field"),
					segs("Nucleus", [2]string{"h1", "¹H"}, [2]string{"c13", "¹³C"}, [2]string{"p31", "³¹P"}, [2]string{"f19", "¹⁹F"}),
					field("b0", "B₀", "T", 1.5, 0.1, 11.7, 0.1),
					field("flip", "Flip angle", "°", 30, 0, 180, 1),
				),
				readouts([2]string{"γ̄", "gamma"}, [2]string{"Larmor f", "f"}, [2]string{"period", "period"}, [2]string{"Mz / Mxy", "mz"}),
				imgNote("γ̄ (MHz/T): ¹H 42.577, ¹⁹F 40.078, ³¹P 17.235, ¹³C 10.708 (CODATA/NIST). The drawing turns ~10⁷ times slower than real."),
			)
		},
	}
}

// ---------------------------------------------------------------- I5

func imgRelaxBlock() Block {
	return Block{
		Slug:        "relaxation",
		Title:       "T1 and T2 relaxation",
		Description: "After a 90° pulse, longitudinal magnetization regrows as Mz = M₀(1 − e^(−t/T1)) and transverse signal dies as Mxy = M₀e^(−t/T2). Tissues differ in T1 and T2, and that difference is where MRI contrast comes from.",
		Tags:        []string{"T1", "T2", "exponentials"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-relax",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("t1", ""), h.ViewBox("0 0 320 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "T1 recovery curves")),
					h.Svg(h.Data("t2", ""), h.ViewBox("0 0 320 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "T2 decay curves")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Probe time"),
					field("t", "t", "ms", 500, 0, 5000, 10),
				),
				h.Div(h.Data("legend", ""), h.Class("flex flex-col gap-1 font-mono text-[11px]")),
				imgNote("Approximate values at 1.5 T (textbook ranges vary by ±20%): fat T1 260 / T2 80 ms, white matter 780 / 90, grey matter 920 / 100, muscle 870 / 47, CSF 4000 / 2000."),
			)
		},
	}
}

// ---------------------------------------------------------------- I6

func imgWeightingBlock() Block {
	return Block{
		Slug:        "weighting",
		Title:       "T1, T2 and PD weighting",
		Description: "A spin-echo sequence's signal is S = PD·(1 − e^(−TR/T1))·e^(−TE/T2). Short TR and TE make a T1-weighted image (fat bright, fluid dark); long TR and TE make it T2-weighted (fluid bright); long TR with short TE leaves proton density.",
		Tags:        []string{"spin echo", "TR/TE", "contrast"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-weight",
				h.Div(h.Class("flex flex-col gap-3 sm:flex-row"),
					h.Div(h.Class("w-full sm:w-1/2"), imgCanvas("brain", "Synthetic brain slice"), imgCaption("synthetic slice: scalp fat, grey and white matter, CSF")),
					h.Svg(h.Data("bars", ""), h.ViewBox("0 0 300 300"), h.Class("block w-full sm:w-1/2"), h.Role("img"), h.Aria("label", "Signal per tissue")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sequence"),
					segs("Preset", [2]string{"t1", "T1w"}, [2]string{"t2", "T2w"}, [2]string{"pd", "PD"}),
					field("tr", "TR", "ms", 500, 50, 6000, 10),
					field("te", "TE", "ms", 15, 5, 300, 1),
				),
				readouts([2]string{"weighting", "kind"}, [2]string{"brightest", "bright"}, [2]string{"GM/WM contrast", "gmwm"}),
				imgNote("Proton densities (relative): CSF 1.0, grey 0.85, fat 0.90, white 0.70 — approximate. Same T1/T2 values as the block above."),
			)
		},
	}
}

// ---------------------------------------------------------------- I7

func imgKspaceBlock() Block {
	return Block{
		Slug:        "k-space",
		Title:       "k-space",
		Description: "An MRI scanner measures the image's 2D Fourier transform, one line of k-space at a time. The centre holds contrast, the edges hold detail; skipping lines to save time folds the image onto itself. Masks here act on a real FFT of the picture.",
		Tags:        []string{"2D FFT", "MRI", "aliasing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-kspace",
				h.Div(h.Class("grid grid-cols-3 gap-3"),
					h.Div(imgCanvas("image", "Original image"), imgCaption("image")),
					h.Div(imgCanvas("k", "k-space magnitude (log), with the kept region"), imgCaption("|k-space| (log), kept")),
					h.Div(imgCanvas("out", "Image rebuilt from the kept k-space"), imgCaption("inverse FFT")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mask"),
					segs("Mask", [2]string{"centre", "Centre"}, [2]string{"edges", "Edges"}, [2]string{"skip", "Every 2nd line"}, [2]string{"full", "Full"}),
					field("radius", "Radius", "%", 12, 2, 70, 1),
				),
				readouts([2]string{"k-space kept", "kept"}, [2]string{"round-trip error", "err"}, [2]string{"image error", "rms"}),
				imgNote("128×128 radix-2 FFT written for this page. The round-trip error is the largest pixel difference after FFT then inverse FFT with nothing masked."),
			)
		},
	}
}

// ---------------------------------------------------------------- I8

func imgUltrasoundBlock() Block {
	return Block{
		Slug:        "ultrasound",
		Title:       "Ultrasound echoes",
		Description: "A pulse travels at ≈ 1540 m/s in soft tissue, so an echo's delay gives depth: d = c·t/2. How much reflects at an interface depends on acoustic impedance Z = ρc: R = ((Z₂ − Z₁)/(Z₂ + Z₁))². Higher frequency sharpens the image but is absorbed sooner.",
		Tags:        []string{"A-mode", "impedance", "attenuation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-us",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("layers", ""), h.ViewBox("0 0 640 120"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Tissue layers along the beam")),
					h.Svg(h.Data("amode", ""), h.ViewBox("0 0 640 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "A-mode echo trace")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Probe"),
					field("freq", "Frequency", "MHz", 5, 1, 15, 0.5),
					field("fat", "Fat layer", "cm", 1.5, 0.2, 5, 0.1),
					field("muscle", "Muscle layer", "cm", 3, 0.5, 8, 0.1),
					segs("Deep interface", [2]string{"bone", "Bone"}, [2]string{"liver", "Liver"}, [2]string{"air", "Air (lung)"}),
				),
				readouts([2]string{"wavelength", "lambda"}, [2]string{"axial resolution", "axial"}, [2]string{"penetration", "pen"}, [2]string{"deepest echo", "deep"}),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Echo → depth"),
					field("echo", "Echo delay", "µs", 130, 1, 300, 1),
				),
				readouts([2]string{"depth", "depth"}),
				imgNote("Typical values: Z (MRayl) fat 1.38, muscle 1.70, liver 1.65, bone ≈ 7.8, air 0.0004; attenuation ≈ 0.5 dB/cm/MHz. Axial resolution ≈ half a 2-cycle pulse; penetration where the round trip loses 60 dB."),
			)
		},
	}
}

// ---------------------------------------------------------------- I9

func imgPETBlock() Block {
	return Block{
		Slug:        "pet",
		Title:       "PET coincidences",
		Description: "A positron annihilates with an electron into two 511 keV photons flying apart almost back to back. When two detectors on the ring fire within the coincidence window, the decay lay on the line between them. Many lines of response, backprojected, reveal where the tracer gathered.",
		Tags:        []string{"511 keV", "lines of response", "backprojection"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-pet",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("ring", ""), h.ViewBox("-110 -110 220 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Detector ring with lines of response")),
					h.Div(imgCanvas("image", "Backprojected lines of response"), imgCaption("backprojection of all lines")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Acquisition"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						imgAction("one", "1 event", hugeicons.ArrowRight01Icon()),
						imgAction("many", "+500", hugeicons.PlayIcon()),
						imgAction("reset", "Reset", hugeicons.RefreshIcon()),
						imgAction("reseed", "New phantom", hugeicons.ShuffleIcon()),
					),
					field("tof", "Timing resolution", "ps", 400, 0, 1000, 10),
				),
				readouts([2]string{"coincidences", "count"}, [2]string{"TOF uncertainty", "tof"}, [2]string{"photon energy", "e"}),
				imgNote("2D toy: point annihilations in two hot spots plus background, no attenuation, scatter or randoms. Time of flight narrows each line to Δx = c·Δt/2."),
			)
		},
	}
}

// ---------------------------------------------------------------- I10

func imgQualityBlock() Block {
	return Block{
		Slug:        "image-quality",
		Title:       "Resolution, noise and contrast",
		Description: "Three numbers grade an image. Blur sets resolution, described by the modulation transfer function (for a Gaussian blur MTF(f) = e^(−2π²σ²f²)); noise sets SNR; and a lesion is only seen if its contrast-to-noise ratio is high enough.",
		Tags:        []string{"MTF", "SNR", "CNR"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("img-quality",
				h.Div(h.Class("flex flex-col gap-3 sm:flex-row"),
					h.Div(h.Class("w-full sm:w-1/2"), imgCanvas("test", "Sine gratings and a low-contrast disc, blurred and noisy"), imgCaption("sine gratings + low-contrast disc")),
					h.Svg(h.Data("mtf", ""), h.ViewBox("0 0 300 300"), h.Class("block w-full sm:w-1/2"), h.Role("img"), h.Aria("label", "Modulation transfer function")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("System"),
					field("sigma", "Blur σ", "px", 1.2, 0, 4, 0.1),
					field("noise", "Noise σ", "%", 5, 0, 30, 0.5),
					field("contrast", "Disc contrast", "%", 8, 0, 50, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), imgAction("reseed", "New noise", hugeicons.ShuffleIcon())),
				readouts([2]string{"MTF 50%", "f50"}, [2]string{"MTF 10%", "f10"}, [2]string{"SNR", "snr"}, [2]string{"CNR", "cnr"}),
				imgNote("Frequencies in line pairs per pixel (Nyquist = 0.5). Rose criterion: a disc needs CNR ≳ 3–5 to be seen reliably."),
			)
		},
	}
}
