package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GraphicsBlocks lists the computer graphics gallery in display order.
// Behaviour lives in static/js/graphics.js (curves, rasterization, the
// pipeline, depth) and graphics-render.js (shading, ray tracing, sampling,
// colour, distance fields).
func GraphicsBlocks() []Block {
	return []Block{
		gfxBezierBlock(),
		gfxRasterBlock(),
		gfxLinesBlock(),
		gfxPipelineBlock(),
		gfxZBufferBlock(),
		gfxLightingBlock(),
		gfxRayTracerBlock(),
		gfxTextureBlock(),
		gfxColorBlock(),
		gfxSDFBlock(),
	}
}

func gfxButton(action string, icon h.Node, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func gfxSvg(view, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("plot", ""), h.ViewBox(view), h.Class("mx-auto block w-full touch-none select-none"),
		h.Role("img"), h.Aria("label", label)}, extra...)...)
}

func gfxCanvas(label, class string) h.Node {
	return h.Div(h.Class("relative mx-auto w-full overflow-hidden rounded-lg border "+class),
		h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", label)))
}

// ---------------------------------------------------------------- G1

func gfxBezierBlock() Block {
	return Block{
		Slug:        "bezier",
		Title:       "Bézier curves",
		Description: "De Casteljau's construction: interpolate between neighbouring control points, then between those points, until one point is left. That point traces the curve. Drag the control points, or play t from 0 to 1.",
		Tags:        []string{"de Casteljau", "Bernstein", "drag"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-bezier",
				gfxSvg("0 0 560 360", "Bézier curve with its control polygon and de Casteljau construction", h.Class("max-w-[640px]")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Curve"),
					segs("Degree", [2]string{"cubic", "Cubic"}, [2]string{"quadratic", "Quadratic"}),
					field("t", "t", "", 0.5, 0, 1, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("gfx-bz-construct", "construct", "Show the construction", true),
					toggle("gfx-bz-hull", "hull", "Control polygon", true),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"), playPause(),
					gfxButton("reset", hugeicons.RefreshIcon(), "Reset")),
				readouts([2]string{"B(t)", "point"}, [2]string{"Bernstein form", "bern"}, [2]string{"arc length", "len"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G2

func gfxRasterBlock() Block {
	return Block{
		Slug:        "rasterization",
		Title:       "Triangle rasterization",
		Description: "How a GPU turns a triangle into pixels: three edge functions are evaluated at every pixel centre, and a pixel is covered when all three agree. The top-left rule decides pixels exactly on a shared edge, and the same three numbers give the barycentric weights that blend the vertex colours.",
		Tags:        []string{"edge functions", "top-left rule", "barycentric"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-raster",
				gfxSvg("0 0 480 320", "A triangle over a pixel grid; covered pixels are filled", h.Class("max-w-[640px]")),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Fill"),
					toggle("gfx-rs-bary", "bary", "Barycentric colours", true),
					toggle("gfx-rs-topleft", "topleft", "Top-left rule", true),
					toggle("gfx-rs-centers", "centers", "Pixel centres", false),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Drag a vertex, or focus it and use the arrow keys. Hover a pixel to read its edge values."),
				readouts([2]string{"pixels", "count"}, [2]string{"area", "area"}, [2]string{"pixel", "probe"}, [2]string{"w₀ w₁ w₂", "weights"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G3

func gfxLinesBlock() Block {
	return Block{
		Slug:        "line-drawing",
		Title:       "Bresenham and DDA",
		Description: "Two ways to draw a line on a grid. DDA steps along the long axis and rounds a floating-point coordinate; Bresenham does the same with integers only, keeping an error term that says when to step sideways. Step through them and compare.",
		Tags:        []string{"Bresenham", "integer arithmetic", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-lines",
				gfxSvg("0 0 480 320", "Line drawn on a pixel grid", h.Class("max-w-[640px]")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Algorithm"),
					segs("Algorithm", [2]string{"bresenham", "Bresenham"}, [2]string{"dda", "DDA"}, [2]string{"both", "Both"}),
				),
				h.Div(h.Class("grid grid-cols-3 gap-2"),
					gfxButton("back", hugeicons.ArrowLeft01Icon(), "Back"),
					gfxButton("step", hugeicons.ArrowRight01Icon(), "Step"),
					gfxButton("all", hugeicons.PlayIcon(), "All"),
				),
				h.Div(h.Data("table", ""), h.Class("code scroll-thin max-h-48 overflow-auto rounded-lg border bg-code p-2 text-[12px]")),
				readouts([2]string{"pixels", "count"}, [2]string{"DDA differs", "diff"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G4

func gfxPipelineBlock() Block {
	return Block{
		Slug:        "pipeline",
		Title:       "The 3D pipeline",
		Description: "A vertex's journey to the screen: model, view and projection matrices, the divide by w that makes far things small, then the viewport. Turn the cube and watch one corner's coordinates change at every stage.",
		Tags:        []string{"MVP", "perspective divide", "homogeneous"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-pipeline",
				h.Div(h.Class("flex flex-col gap-3"),
					gfxSvg("0 0 480 320", "A cube drawn through the pipeline; drag to turn it", h.Class("max-w-[560px] cursor-grab")),
					h.Div(h.Data("stages", ""), h.Class("code grid gap-2 text-[11px] sm:grid-cols-2")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Camera"),
					segs("Projection", [2]string{"perspective", "Perspective"}, [2]string{"ortho", "Orthographic"}),
					field("fov", "Field of view", "°", 60, 20, 120, 1),
					field("dist", "Distance", "", 4, 2, 10, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Model"),
					field("yaw", "Yaw", "°", 30, -180, 180, 1),
					field("pitch", "Pitch", "°", 20, -89, 89, 1),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Drag the cube to turn it. The pink corner is the one traced below."),
			)
		},
	}
}

// ---------------------------------------------------------------- G5

func gfxZBufferBlock() Block {
	return Block{
		Slug:        "z-buffer",
		Title:       "Depth buffer",
		Description: "Two triangles that pierce each other. Drawing back to front (the painter's algorithm) cannot get this right, because neither is behind the other everywhere; a depth buffer keeps the nearest depth per pixel and gets it right pixel by pixel.",
		Tags:        []string{"z-buffer", "painter's algorithm", "depth test"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-zbuffer",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "colour buffer"),
						gfxSvg("0 0 240 180", "Colour buffer")),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "depth buffer (darker = nearer)"),
						h.Svg(h.Data("depth", ""), h.ViewBox("0 0 240 180"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Depth buffer"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					segs("Hidden-surface method", [2]string{"zbuffer", "Depth buffer"}, [2]string{"painter", "Painter's"}),
					field("tilt", "Tilt of the blue triangle", "", 0.6, -1, 1, 0.05),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					gfxButton("swap", hugeicons.ArrowDataTransferHorizontalIcon(), "Swap order"),
					gfxButton("replay", hugeicons.PlayIcon(), "Replay"),
				),
				readouts([2]string{"draw order", "order"}, [2]string{"wrong pixels", "wrong"}, [2]string{"depth tests", "tests"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G6

func gfxLightingBlock() Block {
	return Block{
		Slug:        "lighting",
		Title:       "Lighting models",
		Description: "Lambert's diffuse term is the cosine between the normal and the light. Phong adds a highlight from the reflected light; Blinn–Phong uses the half vector instead, which is cheaper and keeps a sensible highlight at grazing angles. Drag the light around the sphere.",
		Tags:        []string{"Lambert", "Phong", "Blinn–Phong"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-lighting",
				gfxCanvas("A shaded sphere; drag to move the light", "aspect-square max-w-[420px] cursor-crosshair"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Model"),
					segs("Shading model", [2]string{"lambert", "Lambert"}, [2]string{"phong", "Phong"}, [2]string{"blinn", "Blinn–Phong"}),
					field("shine", "Shininess", "", 32, 1, 256, 1),
					field("ambient", "Ambient", "", 0.08, 0, 0.5, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("gfx-lt-terms", "terms", "Show terms separately", false)),
				readouts([2]string{"light dir", "light"}, [2]string{"N·L at centre", "ndotl"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G7

func gfxRayTracerBlock() Block {
	return Block{
		Slug:        "ray-tracer",
		Title:       "Ray tracer",
		Description: "A small Whitted-style ray tracer running on the CPU: a ray per sample, the nearest hit, a shadow ray to the light and a reflected ray, recursively. Samples accumulate in place, so the image sharpens while you watch.",
		Tags:        []string{"Whitted", "shadows", "reflection"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-raytracer",
				gfxCanvas("Ray-traced spheres on a checkered plane", "aspect-[4/3] max-w-[560px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Render"),
					field("depth", "Bounces", "", 3, 0, 6, 1),
					field("lightx", "Light x", "", -3, -6, 6, 0.1),
					field("reflect", "Mirror sphere", "", 0.6, 0, 1, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("gfx-rt-shadows", "shadows", "Shadows", true),
					toggle("gfx-rt-aa", "aa", "Jittered samples (anti-aliasing)", true),
				),
				readouts([2]string{"samples / pixel", "spp"}, [2]string{"rays", "rays"}, [2]string{"resolution", "res"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G8

func gfxTextureBlock() Block {
	return Block{
		Slug:        "texture-sampling",
		Title:       "Texture sampling",
		Description: "A checkerboard on a plane receding to the horizon. Far away, each pixel covers many texels: nearest sampling picks one at random and shimmers into moiré, bilinear only blends neighbours, and a mipmap averages them in advance.",
		Tags:        []string{"aliasing", "bilinear", "mipmaps"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-texture",
				gfxCanvas("A checkered plane sampled with the chosen filter", "aspect-[4/3] max-w-[560px]"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Filter"),
					segs("Texture filter", [2]string{"nearest", "Nearest"}, [2]string{"bilinear", "Bilinear"}, [2]string{"mipmap", "Mipmap"}),
					field("tiles", "Checks", "", 64, 4, 256, 1),
					field("tilt", "Camera height", "", 1, 0.3, 4, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("gfx-tx-levels", "levels", "Tint mip levels", false)),
				readouts([2]string{"texels / pixel", "density"}, [2]string{"mip level", "level"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G9

func gfxColorBlock() Block {
	return Block{
		Slug:        "color-spaces",
		Title:       "Colour spaces",
		Description: "One colour, five descriptions: sRGB, linear light, HSL, OKLab and OKLCH. Blending in sRGB darkens the middle of a gradient; linear light is physically right for mixing light; OKLab is built so equal steps look equal. Out-of-gamut OKLCH colours are flagged.",
		Tags:        []string{"sRGB", "OKLab", "gamut"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-color",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex items-center gap-3"),
						h.Div(h.Data("swatch", ""), h.Class("size-20 shrink-0 rounded-lg border")),
						h.Div(h.Data("values", ""), h.Class("code grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]")),
					),
					h.Div(h.Class("flex flex-col gap-1"),
						h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "gradient to the second colour, interpolated in:"),
						h.Div(h.Data("gradients", ""), h.Class("flex flex-col gap-1.5")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("OKLCH"),
					field("L", "Lightness L", "", 0.7, 0, 1, 0.01),
					field("C", "Chroma C", "", 0.15, 0, 0.4, 0.005),
					field("H", "Hue h", "°", 30, 0, 360, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Second colour (hex)"),
					h.Input(h.Type("text"), h.Data("hex2", ""), h.Value("#1f6feb"), h.Aria("label", "Second colour, hex"), h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
						h.Class("h-8 rounded-md border border-input bg-background px-2 font-mono text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm")),
				),
				readouts([2]string{"in sRGB gamut", "gamut"}),
			)
		},
	}
}

// ---------------------------------------------------------------- G10

func gfxSDFBlock() Block {
	return Block{
		Slug:        "sdf",
		Title:       "Signed distance fields",
		Description: "Shapes described by a function: the distance to the surface, negative inside. Combine them with min (union) or a smooth min that melts them together, and march a ray by stepping exactly that distance each time: sphere tracing.",
		Tags:        []string{"SDF", "smooth min", "sphere tracing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gfx-sdf",
				h.Div(h.Class("relative mx-auto w-full max-w-[560px]"),
					gfxCanvas("Distance field of a circle and a box", "aspect-[4/3] cursor-crosshair"),
					h.Svg(h.Data("overlay", ""), h.ViewBox("0 0 400 300"), h.Attr("preserveAspectRatio", "none"), h.Class("pointer-events-none absolute inset-0 size-full")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Combine"),
					segs("Operation", [2]string{"smooth", "Smooth union"}, [2]string{"union", "Union"}, [2]string{"subtract", "Subtract"}, [2]string{"intersect", "Intersect"}),
					field("k", "Smoothness k", "", 0.4, 0.01, 1.5, 0.01),
					field("gap", "Distance apart", "", 1.2, 0, 2.5, 0.05),
				),
				h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Click the field to fire a ray to the right; each circle is one step of sphere tracing."),
				readouts([2]string{"distance at pointer", "d"}, [2]string{"march steps", "steps"}),
			)
		},
	}
}
