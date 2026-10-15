package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// VisionBlocks lists the computer vision gallery in display order. Every
// image is generated in the browser (shapes, textures, random dots) and
// every algorithm runs live on it: nothing is precomputed or uploaded.
func VisionBlocks() []Block {
	return []Block{
		cvCannyBlock(),
		cvHoughBlock(),
		cvHarrisBlock(),
		cvCameraBlock(),
		cvHomographyBlock(),
		cvStereoBlock(),
		cvFlowBlock(),
		cvHistogramBlock(),
		cvComponentsBlock(),
		cvRansacBlock(),
	}
}

// cvNote is the small print under a block: what the demo simplifies.
func cvNote(s ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-muted-foreground")}, s...)...)
}

func cvButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// cvSegs is a segmented control the module finds by name.
func cvSegs(name, label string, opts ...[2]string) h.Node {
	return h.Div(h.Data("cv-seg", name), segs(label, opts...))
}

// cvCanvas is a pixel canvas with an SVG overlay on top of it for crisp
// marks (lines, arrows, handles) in the same image coordinates.
func cvCanvas(name, label, caption string) h.Node {
	return h.Figure(h.Class("flex min-w-0 flex-col gap-1"),
		h.Div(h.Class("relative"),
			h.Canvas(h.Data("canvas", name), h.Class("block w-full rounded-md border [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", label)),
			h.Svg(h.Data("overlay", name), h.Class("pointer-events-none absolute inset-0 h-full w-full overflow-visible rounded-md"), h.Aria("hidden", "true")),
		),
		h.Figcaption(h.Data("caption", name), h.Class("font-mono text-[10px] text-muted-foreground"), caption),
	)
}

func cvSvg(name, viewBox, label string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

// cvMatrix is a 3×3 grid of live numbers between brackets.
func cvMatrix(name string) h.Node {
	cells := make([]h.Node, 9)
	for i := range cells {
		cells[i] = h.Span(h.Data("out", fmt.Sprintf("%s%d", name, i)), h.Class("text-right"), "—")
	}
	return h.Div(h.Class("grid grid-cols-3 gap-x-3 gap-y-0.5 border-x border-foreground/40 px-2 py-1 font-mono text-[11px] tabular-nums"), h.Group(cells))
}

// ---------------------------------------------------------------- CV1

func cvCannyBlock() Block {
	return Block{
		Slug:        "canny",
		Title:       "Canny edge detector, stage by stage",
		Description: "Canny's 1986 recipe for thin, connected edges: smooth with a Gaussian, take Sobel gradients, keep only pixels that are the maximum along their gradient direction, then link with two thresholds: strong pixels are edges, weak ones survive only if they touch a strong one.",
		Tags:        []string{"Gaussian", "Sobel", "non-maximum suppression", "hysteresis"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-canny",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
						cvCanvas("in", "Generated test scene with noise", "input: generated shapes + noise"),
						cvCanvas("out", "The chosen stage of the Canny pipeline", "stage"),
					),
					h.Div(h.Data("legend", "dir"), h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "gradient 0° (vertical edge)"),
						legendSwatch("var(--vec-v)", "45°"),
						legendSwatch("var(--brand)", "90° (horizontal edge)"),
						legendSwatch("var(--vec-out)", "135°"),
					),
					h.Div(h.Data("legend", "edges"), h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "strong (≥ high)"),
						legendSwatch("var(--brand)", "weak, linked to strong: kept"),
						legendSwatch("var(--muted-foreground)", "weak, isolated: dropped"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Stage"),
					cvSegs("stage", "Stage",
						[2]string{"blur", "1 Blur"}, [2]string{"mag", "2 |∇I|"}, [2]string{"dir", "3 Direction"},
						[2]string{"nms", "4 Thin"}, [2]string{"edges", "5 Edges"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Parameters"),
					field("sigma", "Gaussian σ", "px", 1.4, 0.5, 4, 0.1),
					field("low", "Low threshold", "", 5, 1, 80, 1),
					field("high", "High threshold", "", 13, 1, 120, 1),
					field("noise", "Noise σ", "grey", 18, 0, 60, 1),
				),
				readouts([2]string{"edge pixels", "edges"}, [2]string{"strong", "strong"}, [2]string{"weak kept", "kept"}, [2]string{"weak dropped", "dropped"}),
				cvNote("Stage 3 colours each pixel by the direction bin that thinning uses (gradient angle rounded to 0°, 45°, 90° or 135°), faded by its magnitude. Thresholds apply to the Sobel magnitude of the blurred image, in grey levels per pixel."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV2

func cvHoughBlock() Block {
	return Block{
		Slug:        "hough",
		Title:       "Hough transform for lines",
		Description: "Every edge pixel votes for all the lines that could pass through it: in (θ, ρ) space with ρ = x cos θ + y sin θ, one pixel is a sinusoid. Collinear pixels' sinusoids cross at one cell, so lines become peaks, even with gaps and clutter.",
		Tags:        []string{"voting", "ρ = x cos θ + y sin θ", "accumulator"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-hough",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					cvCanvas("img", "Edge pixels from dashed lines and random clutter, with detected lines drawn over", "edge pixels · detected lines"),
					cvCanvas("acc", "Hough accumulator, θ across and ρ down; click a cell to draw its line", "accumulator: θ 0–180° across, ρ down · click a cell"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scene"),
					field("lines", "Lines", "", 3, 1, 6, 1),
					field("clutter", "Clutter pixels", "", 250, 0, 1500, 10),
					field("gap", "Gaps in lines", "%", 30, 0, 80, 5),
					h.Div(h.Class("flex flex-wrap gap-2"), cvButton("new", "New scene", hugeicons.DiceFaces03Icon())),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Detection"),
					field("peaks", "Peaks to keep", "", 3, 1, 8, 1),
					field("minvotes", "Min votes", "", 40, 5, 200, 1),
				),
				readouts([2]string{"edge pixels", "n"}, [2]string{"accumulator", "size"}, [2]string{"best peak", "best"}, [2]string{"picked cell", "pick"}, [2]string{"planted found", "found"}),
			)
		},
	}
}

// ---------------------------------------------------------------- CV3

func cvHarrisBlock() Block {
	return Block{
		Slug:        "harris",
		Title:       "Harris corners",
		Description: "Slide a small window: on a flat patch nothing changes, along an edge one direction is free, at a corner every shift changes the patch. The structure tensor M (summed products of gradients) measures that; its eigenvalues λ₁, λ₂ classify the point, and R = det M − k (tr M)² flags corners without computing them.",
		Tags:        []string{"structure tensor", "eigenvalues", "R = det − k·tr²"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-harris",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					cvCanvas("img", "Generated scene with detected corners circled; hover to read the eigenvalues", "scene · corners · hover a pixel"),
					cvCanvas("resp", "Harris response map: corners bright, edges negative", "response R (brand: R > 0, blue: R < 0)"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scene"),
					field("rot", "Rotate scene", "°", 20, 0, 90, 1),
					field("noise", "Noise σ", "grey", 4, 0, 40, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Detector"),
					field("k", "k", "", 0.05, 0.02, 0.2, 0.01),
					field("win", "Window σ", "px", 1.5, 0.6, 4, 0.1),
					field("thr", "Threshold", "% max", 5, 0.5, 50, 0.5),
				),
				readouts([2]string{"corners", "n"}, [2]string{"hover λ₁, λ₂", "lam"}, [2]string{"hover R", "r"}, [2]string{"hover class", "cls"}),
				cvNote("The scene is redrawn at each angle, so the count staying put shows rotation invariance: eigenvalues do not care about orientation. Corners are local maxima of R in a 5 × 5 neighbourhood above the threshold."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV4

func cvCameraBlock() Block {
	return Block{
		Slug:        "camera",
		Title:       "Pinhole camera, intrinsics and lens distortion",
		Description: "A camera maps a 3D point to a pixel in two steps: the extrinsics [R | t] move it into the camera's frame, the intrinsic matrix K divides by depth and scales by the focal length in pixels. Real lenses then bend straight lines; the radial model scales each point by 1 + k₁r² + k₂r⁴.",
		Tags:        []string{"x = K [R | t] X", "focal length", "radial distortion"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-camera",
				h.Div(h.Class("flex flex-col gap-2"),
					cvSvg("img", "0 0 640 480", "The 640 × 480 image: a cube on a ground grid as the camera sees it"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "cube"),
						legendSwatch("var(--muted-foreground)", "ground grid"),
						legendSwatch("var(--vec-u)", "principal point"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Intrinsics K"),
					field("f", "Focal length f", "px", 520, 150, 1500, 10),
					field("cx", "Principal point x", "px", 320, 200, 440, 2),
					field("cy", "Principal point y", "px", 240, 160, 320, 2),
					field("k1", "Radial k₁", "", 0, -0.5, 0.5, 0.01),
					field("k2", "Radial k₂", "", 0, -0.3, 0.3, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Extrinsics"),
					field("yaw", "Orbit (yaw)", "°", 35, -180, 180, 1),
					field("pitch", "Elevation", "°", 25, 2, 80, 1),
					field("dist", "Distance", "m", 6, 2.5, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("K"), cvMatrix("k")),
				readouts([2]string{"horizontal FOV", "fov"}, [2]string{"nearest corner", "corner"}, [2]string{"its depth Z", "z"}),
				cvNote("Image 640 × 480 px, square pixels, no skew. The cube is 2 m on a side, standing on a 10 × 10 m grid. Barrel distortion is k₁ < 0, pincushion k₁ > 0; r is measured in normalised coordinates (x/z, y/z). Past the radius where the polynomial stops increasing it folds back on itself, so those points are not drawn."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV5

func cvHomographyBlock() Block {
	return Block{
		Slug:        "homography",
		Title:       "Homography from four points",
		Description: "A flat page seen at an angle is a projective transform of the flat page: a 3×3 matrix H with 8 degrees of freedom. Four point pairs give eight equations; the direct linear transform solves them, and warping backwards through H flattens the page. Drag the four handles onto the page's corners.",
		Tags:        []string{"DLT", "8 DoF", "perspective correction"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-homography",
				h.Div(h.Class("grid items-start gap-3 sm:grid-cols-[3fr_2fr]"),
					h.Figure(h.Class("flex min-w-0 flex-col gap-1"),
						h.Div(h.Class("relative"),
							h.Canvas(h.Data("canvas", "photo"), h.Class("block w-full rounded-md border"), h.Role("img"), h.Aria("label", "A generated photo of a page on a desk, seen in perspective")),
							h.Svg(h.Data("overlay", "photo"), h.Class("absolute inset-0 h-full w-full touch-none overflow-visible rounded-md"), h.Aria("label", "Four draggable corner handles")),
						),
						h.Figcaption(h.Class("font-mono text-[10px] text-muted-foreground"), "photo (generated) · drag the 4 handles, or focus one and use the arrow keys"),
					),
					cvCanvas("flat", "The page rectified through the estimated homography", "rectified page (A4 proportions, 210 × 297)"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Handles"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						cvButton("snap", "Snap to corners", hugeicons.Target02Icon()),
						cvButton("jitter", "Misplace", hugeicons.ShuffleIcon()),
						cvButton("new", "New photo", hugeicons.DiceFaces03Icon()),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("H (page → photo, h₃₃ = 1)"), cvMatrix("h")),
				readouts([2]string{"corner reprojection error", "err"}, [2]string{"handle vs true corner", "off"}, [2]string{"det of the 8 × 8 system", "det"}),
				cvNote("The photo itself is made by a known homography, so the block can tell how far each handle is from the true corner. With exact corners the recovered H equals the true one; the four handles always map exactly, so the error that matters is the handle placement."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV6

func cvStereoBlock() Block {
	return Block{
		Slug:        "stereo",
		Title:       "Stereo: disparity to depth",
		Description: "Two cameras a baseline B apart see a near object shifted more than a far one. Find each left-image patch along the same row of the right image (block matching, sum of absolute differences) and the shift d gives depth Z = f·B / d. Random dots hide the shapes from either eye alone.",
		Tags:        []string{"Z = fB/d", "block matching", "random-dot stereogram"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-stereo",
				h.Div(h.Class("flex flex-col"), h.Div(h.Class("grid gap-3 sm:grid-cols-3"),
					cvCanvas("left", "Left random-dot image", "left"),
					cvCanvas("right", "Right random-dot image", "right"),
					cvCanvas("disp", "Disparity map found by block matching; hover to read depth", "disparity (bright = near) · hover"),
				),
					h.Div(h.Class("mt-3 flex flex-col gap-1"),
						cvSvg("scan", "0 0 640 170", "Disparity along one image row: found against the truth"),
						h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--brand)", "found"),
							legendSwatch("var(--muted-foreground)", "truth"),
							h.Span(h.Data("out", "row"), "row 50"),
						),
					)),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Scene (disparity in px)"),
					field("dbg", "Background", "px", 2, 0, 12, 1),
					field("dsq", "Square", "px", 6, 0, 12, 1),
					field("ddisc", "Disc", "px", 10, 0, 12, 1),
					field("density", "Dot density", "%", 50, 5, 95, 5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Matcher"),
					field("win", "Window", "px", 7, 1, 15, 2),
					toggle("cv-stereo-truth", "truth", "Show ground truth", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Rig"),
					field("f", "Focal length f", "px", 700, 100, 2000, 10),
					field("b", "Baseline B", "cm", 12, 1, 50, 1),
				),
				readouts([2]string{"pixels correct", "acc"}, [2]string{"depth: background", "zbg"}, [2]string{"depth: square", "zsq"}, [2]string{"depth: disc", "zdisc"}, [2]string{"hover", "hover"}),
				cvNote("Rectified pair: matches lie on the same row, so the search is 1D over d = 0…12. Small windows are noisy, large ones blur the borders of the shapes (the fattening effect). Depth resolution falls fast: one pixel of disparity is worth more metres the farther away you are."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV7

func cvFlowBlock() Block {
	return Block{
		Slug:        "flow",
		Title:       "Optical flow and the aperture problem",
		Description: "Brightness constancy gives one equation per pixel, Ix·u + Iy·v + It = 0, for two unknowns (u, v). Lucas and Kanade (1981) assume the flow is constant in a small window and solve the stack by least squares. Where the window holds only a straight edge, the system is singular: only motion across the edge can be seen.",
		Tags:        []string{"Lucas–Kanade", "brightness constancy", "aperture problem"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-flow",
				h.Div(h.Class("flex flex-col gap-2"),
					cvCanvas("img", "A moving generated pattern with the estimated flow drawn as arrows", "frame t · arrows: estimated flow × 6"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "well conditioned"),
						legendSwatch("var(--muted-foreground)", "aperture: only the normal flow"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pattern"),
					cvSegs("pattern", "Pattern", [2]string{"blobs", "Blobs"}, [2]string{"stripes", "Stripes"}, [2]string{"square", "Square"}),
					h.Div(h.Class("flex flex-wrap gap-2"), playPause()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("True motion per frame"),
					field("u", "u (right)", "px", 0.8, -2, 2, 0.1),
					field("v", "v (down)", "px", 0.4, -2, 2, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Solver"),
					field("win", "Window", "px", 9, 3, 21, 2),
				),
				readouts([2]string{"true flow", "truth"}, [2]string{"mean estimate", "mean"}, [2]string{"mean error", "err"}, [2]string{"aperture windows", "ap"}),
				cvNote("One Lucas–Kanade step, no pyramid, so it is accurate for motions under about a pixel. A window counts as an aperture case when the smaller eigenvalue of its structure tensor is under 2% of the larger; there only the component along the gradient is drawn."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV8

func cvHistogramBlock() Block {
	return Block{
		Slug:        "histogram",
		Title:       "Histogram equalisation and Otsu's threshold",
		Description: "Two ways to use an image's histogram. Equalisation maps each grey level through the cumulative histogram so the levels spread over the full range. Otsu (1979) tries every threshold and keeps the one that maximises the variance between the two classes, which needs no tuning when the histogram has two humps.",
		Tags:        []string{"CDF", "between-class variance", "binarisation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-histogram",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[2fr_3fr]"),
					cvCanvas("img", "The generated image after the chosen operation", "image"),
					h.Div(h.Class("flex flex-col gap-1"),
						cvSvg("hist", "0 0 420 300", "Histogram of grey levels, its cumulative curve, and the between-class variance with Otsu's threshold"),
						h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
							legendSwatch("var(--foreground)", "histogram"),
							legendSwatch("var(--vec-u)", "cumulative"),
							legendSwatch("var(--brand)", "σ²_B(t) · Otsu t"),
						),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					cvSegs("view", "View", [2]string{"orig", "Original"}, [2]string{"eq", "Equalised"}, [2]string{"otsu", "Otsu mask"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Image"),
					field("bg", "Background level", "", 70, 0, 255, 1),
					field("fg", "Object level", "", 110, 0, 255, 1),
					field("noise", "Noise σ", "", 10, 0, 50, 1),
					field("shade", "Uneven lighting", "", 0, 0, 80, 1),
				),
				readouts([2]string{"Otsu threshold", "t"}, [2]string{"class means", "means"}, [2]string{"separability η", "eta"}, [2]string{"pixels labelled right", "acc"}),
				cvNote("η = σ²_B / σ² is 1 for a perfectly two-level image. Add uneven lighting and one global threshold fails, whatever its value: the motivation for adaptive thresholds."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV9

func cvComponentsBlock() Block {
	return Block{
		Slug:        "components",
		Title:       "Connected components, two passes",
		Description: "Label each blob of a binary image. The first pass gives each pixel the smallest label of its already-visited neighbours, inventing a new one when there is none, and records when two labels meet. A union-find structure merges those equivalences; the second pass rewrites every pixel with its root.",
		Tags:        []string{"union-find", "4- vs 8-connectivity", "labelling"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-components",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Canvas(h.Data("canvas", "grid"), h.Class("block w-full touch-none rounded-md border [image-rendering:pixelated]"), h.Role("img"), h.Aria("label", "A paintable binary image with its components coloured; click or drag to paint, Shift to erase")),
					h.P(h.Class("font-mono text-[10px] text-muted-foreground"), "click or drag to paint · Shift or right button to erase · numbers: label of each pixel"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Connectivity"),
					cvSegs("conn", "Connectivity", [2]string{"4", "4-connected"}, [2]string{"8", "8-connected"}),
					toggle("cv-components-pass", "first", "Show first-pass labels", false),
				),
				h.Div(h.Class("flex flex-wrap gap-2 border-t pt-4"),
					cvButton("random", "Random", hugeicons.DiceFaces03Icon()),
					cvButton("clear", "Clear", hugeicons.Eraser01Icon()),
				),
				readouts([2]string{"components", "n"}, [2]string{"provisional labels", "prov"}, [2]string{"merges", "merges"}, [2]string{"largest", "largest"}),
				cvNote("Diagonal touches join blobs only under 8-connectivity; the random image is chosen to show the difference. Colours repeat after five labels; the numbers do not."),
			)
		},
	}
}

// ---------------------------------------------------------------- CV10

func cvRansacBlock() Block {
	return Block{
		Slug:        "ransac",
		Title:       "RANSAC vs least squares",
		Description: "Least squares lets every point vote, so a few gross outliers drag the fit. RANSAC (Fischler & Bolles, 1981) repeatedly fits a line to two random points, counts the points within a tolerance, keeps the best consensus and refits on it. The number of tries needed follows from the outlier ratio.",
		Tags:        []string{"robust fitting", "consensus", "N = log(1−p) / log(1−wˢ)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cv-ransac",
				h.Div(h.Class("flex flex-col gap-2"),
					cvSvg("plot", "0 0 640 400", "Points with a planted line, outliers, the least-squares fit and the RANSAC fit"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "RANSAC fit · inliers"),
						legendSwatch("var(--vec-out)", "least squares"),
						legendSwatch("var(--muted-foreground)", "planted line (dashed)"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Data"),
					field("n", "Points", "", 120, 20, 400, 10),
					field("out", "Outliers", "%", 40, 0, 90, 5),
					field("sd", "Inlier noise σ", "", 0.15, 0, 1, 0.01),
					cvButton("new", "New data", hugeicons.DiceFaces03Icon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("RANSAC"),
					field("tol", "Tolerance", "", 0.4, 0.05, 2, 0.05),
					field("iters", "Iterations", "", 50, 1, 500, 1),
					h.Div(h.Class("flex flex-wrap gap-2"),
						cvButton("step", "One try", hugeicons.NextIcon()),
						cvButton("run", "Run all", hugeicons.PlayIcon()),
					),
				),
				readouts([2]string{"planted", "true"}, [2]string{"least squares", "ls"}, [2]string{"RANSAC", "rs"}, [2]string{"inliers", "inl"}, [2]string{"tries done", "tries"}, [2]string{"tries for 99%", "need"}),
				cvNote("Outliers are uniform over the plot. The 99% figure uses the true inlier ratio w and a sample size s = 2; in practice w is unknown and the count is updated from the best consensus so far."),
			)
		},
	}
}
