package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// GisBlocks lists the GIS & spatial analysis gallery in display order.
// Every map is synthetic and generated in the page: no tiles, no network.
func GisBlocks() []Block {
	return []Block{
		gisRasterBlock(),
		gisPipBlock(),
		gisSimplifyBlock(),
		gisVoronoiBlock(),
		gisInterpBlock(),
		gisClassifyBlock(),
		gisTerrainBlock(),
		gisOverlayBlock(),
		gisIndexBlock(),
		gisMoranBlock(),
	}
}

// gisSegs is a segmented control the module tells apart from the block's
// other ones by name.
func gisSegs(name, label string, opts ...[2]string) h.Node {
	return h.Div(h.Data("gis-seg", name), segs(label, opts...))
}

// gisMap is the drawing surface: a canvas for rasters under an SVG for
// vectors and handles, both sharing one viewBox of w×h units.
func gisMap(w, hgt int, label string, canvas bool) h.Node {
	return h.Div(h.Class("relative mx-auto w-full overflow-hidden rounded-lg border bg-background "+h.Ternary(w == hgt, "max-w-[480px]", "max-w-[720px]")),
		h.Style(fmt.Sprintf("aspect-ratio:%d/%d", w, hgt)),
		h.Iff(canvas, func() h.Node {
			return h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full [image-rendering:pixelated]"), h.Aria("hidden", "true"))
		}),
		h.Svg(h.Data("map", ""), h.ViewBox(fmt.Sprintf("0 0 %d %d", w, hgt)), h.Class("absolute inset-0 size-full touch-none select-none"),
			h.Role("img"), h.Aria("label", label)),
	)
}

// gisButton is a small outline action button carrying data-action.
func gisButton(action, lbl string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, lbl)
}

func gisNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

func gisLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-2 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }),
	)
}

// ---------------------------------------------------------------- GIS1

func gisRasterBlock() Block {
	return Block{
		Slug:        "raster-vector",
		Title:       "Raster and vector",
		Description: "The same lake stored two ways. As a vector it is a ring of vertices and its area comes exactly from the shoelace formula; as a raster it is a grid of cells, each counted as water when its centre falls inside the shore. Coarser cells are cheaper to store and wrong by more along the edge.",
		Tags:        []string{"data models", "resolution", "shoelace"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-raster",
				h.Div(h.Class("flex flex-col gap-3"),
					gisMap(640, 400, "A synthetic lake as a polygon over its rasterised cells", true),
					h.Svg(h.Data("chart", ""), h.ViewBox("0 0 640 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Area error against cell size")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Grid"),
					field("cell", "Cell size", "m", 40, 5, 160, 5),
					toggle("gis-raster-vec", "vector", "Show the vector outline", true),
					toggle("gis-raster-grid", "grid", "Show cell edges", true),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), gisButton("new", "New lake", hugeicons.RefreshIcon())),
				readouts([2]string{"vector area", "vec"}, [2]string{"raster area", "ras"}, [2]string{"error", "err"}, [2]string{"cells", "cells"}, [2]string{"vertices", "verts"}),
				gisNote("Map extent 3.2 × 2.0 km. The chart repeats the count for every cell size from 5 to 160 m; only cells cut by the shore can be wrong, so the error swings wider as cells grow, and its sign depends on how the grid happens to fall."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS2

func gisPipBlock() Block {
	return Block{
		Slug:        "point-in-polygon",
		Title:       "Point in polygon",
		Description: "Is the point inside? Cast a ray to the right and count the edges it crosses: odd means inside. Each edge counts as half-open, so a ray that passes exactly through a vertex is counted once, not twice. Drag the point or any vertex; the shoelace formula gives the area and its sign gives the ring's orientation.",
		Tags:        []string{"ray casting", "even–odd", "shoelace"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-pip",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(640, 400, "A concave polygon, a test point and its ray with the crossings marked", false),
					gisLegend([2]string{"var(--brand)", "test point and ray"}, [2]string{"var(--vec-u)", "crossed edges"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Shape"),
					gisSegs("shape", "Polygon", [2]string{"bay", "Bay"}, [2]string{"comb", "Comb"}, [2]string{"star", "Star"}),
					gisButton("vertex", "Put point on a vertex's level", hugeicons.Target02Icon()),
				),
				readouts([2]string{"crossings", "cross"}, [2]string{"verdict", "verdict"}, [2]string{"area", "area"}, [2]string{"orientation", "orient"}, [2]string{"vertices", "verts"}),
				gisNote("Drag with a pointer, or focus the map and use the arrow keys to move the test point."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS3

func gisSimplifyBlock() Block {
	return Block{
		Slug:        "simplification",
		Title:       "Line simplification",
		Description: "A coastline digitised at survey detail has far more vertices than a small-scale map needs. Douglas–Peucker keeps the vertex farthest from the current chord and recurses until every dropped vertex is within the tolerance; Visvalingam–Whyatt instead removes, one at a time, the vertex whose triangle with its neighbours has the least area.",
		Tags:        []string{"Douglas–Peucker", "Visvalingam", "generalisation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-simplify",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(640, 360, "A synthetic coastline, original and simplified", false),
					gisLegend([2]string{"currentColor", "original"}, [2]string{"var(--brand)", "simplified"}, [2]string{"var(--code-del)", "largest deviation"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					gisSegs("method", "Method", [2]string{"dp", "Douglas–Peucker"}, [2]string{"vw", "Visvalingam"}),
					field("tol", "Tolerance", "m", 60, 0, 200, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), gisButton("new", "New coast", hugeicons.RefreshIcon())),
				readouts([2]string{"vertices kept", "kept"}, [2]string{"length", "len"}, [2]string{"area change", "area"}, [2]string{"max deviation", "dev"}),
				gisNote("For Visvalingam the tolerance is turned into an area, t²/2, so both methods drop detail at a similar scale. Douglas–Peucker guarantees the deviation bound; Visvalingam does not, but keeps smoother shapes."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS4

func gisVoronoiBlock() Block {
	return Block{
		Slug:        "voronoi",
		Title:       "Voronoi and Delaunay",
		Description: "Each facility serves the area closer to it than to any other: its Voronoi cell. Joining facilities whose cells touch gives the Delaunay triangulation, built here with Bowyer–Watson, in which no point lies inside any triangle's circumcircle. Drag facilities, click empty ground to add one, and see how far households must travel.",
		Tags:        []string{"Bowyer–Watson", "service areas", "nearest facility"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-voronoi",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(640, 400, "Facilities with their Voronoi service areas and Delaunay triangles", true),
					gisLegend([2]string{"var(--brand)", "facilities"}, [2]string{"currentColor", "Voronoi edges"}, [2]string{"var(--vec-u)", "Delaunay edges"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Layers"),
					toggle("gis-vor-del", "delaunay", "Delaunay triangles", true),
					toggle("gis-vor-circ", "circles", "Circumcircles", false),
					toggle("gis-vor-fill", "fill", "Shade service areas", true),
				),
				h.Div(h.Class("flex flex-wrap gap-2"),
					gisButton("new", "Scatter", hugeicons.RefreshIcon()),
					gisButton("remove", "Remove last", hugeicons.Delete02Icon()),
				),
				readouts([2]string{"facilities", "n"}, [2]string{"triangles", "tris"}, [2]string{"empty circles", "empty"}, [2]string{"mean trip", "mean"}, [2]string{"longest trip", "max"}, [2]string{"busiest", "busy"}),
				gisNote("Households: 2,400 synthetic homes, denser toward the town centre. Distances are straight lines on a 6.4 × 4 km map."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS5

func gisInterpBlock() Block {
	return Block{
		Slug:        "interpolation",
		Title:       "Spatial interpolation",
		Description: "Thirty rain gauges sample a surface we secretly know. Nearest neighbour gives each place its closest gauge's value; inverse distance weighting averages all gauges with weights 1/dᵖ; a TIN interpolates linearly inside Delaunay triangles. Leave-one-out cross-validation predicts each gauge from the others, which is how you would choose without knowing the truth.",
		Tags:        []string{"IDW", "TIN", "cross-validation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-idw",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(640, 400, "Interpolated rainfall surface with the gauge locations", true),
					h.Div(h.Data("ramp", ""), h.Class("flex items-center gap-2 px-1 pt-2 font-mono text-[11px] text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Method"),
					gisSegs("method", "Method", [2]string{"idw", "IDW"}, [2]string{"nn", "Nearest"}, [2]string{"tin", "TIN"}, [2]string{"truth", "Truth"}),
					field("p", "IDW power p", "", 2, 0.5, 6, 0.5),
					field("n", "Gauges", "", 30, 6, 120, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), gisButton("new", "Move gauges", hugeicons.RefreshIcon())),
				h.Dl(h.Class("grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1.5 border-t pt-4 font-mono text-xs"),
					h.Dt(h.Class("text-muted-foreground"), "RMSE (mm)"), h.Dd(h.Class("text-muted-foreground"), "LOO-CV"), h.Dd(h.Class("text-muted-foreground"), "vs truth"),
					h.Map([][2]string{{"idw", "IDW"}, {"nn", "Nearest"}, {"tin", "TIN"}}, func(m [2]string) h.Node {
						return h.Group(h.Dt(h.Class("text-muted-foreground"), m[1]),
							h.Dd(h.Data("out", "cv-"+m[0]), h.Class("tabular-nums"), "—"),
							h.Dd(h.Data("out", "true-"+m[0]), h.Class("tabular-nums"), "—"))
					}),
				),
				gisNote("TIN is undefined outside the gauges' convex hull and is left blank there. Its cross-validation skips gauges on the hull."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS6

func gisClassifyBlock() Block {
	return Block{
		Slug:        "classification",
		Title:       "Choropleth classes",
		Description: "One skewed variable, 120 districts, four honest-looking maps. Equal intervals split the range, quantiles split the count, standard deviations split around the mean, and Jenks natural breaks minimise the variance inside classes, computed exactly by dynamic programming (Fisher 1958). The goodness of variance fit (GVF) says how much of the total variance the classes explain.",
		Tags:        []string{"Jenks", "quantiles", "GVF"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-classify",
				h.Div(h.Class("flex flex-col gap-3"),
					gisMap(640, 330, "Districts shaded by class", false),
					h.Svg(h.Data("chart", ""), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Histogram of the values with the class breaks")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Classification"),
					gisSegs("method", "Method", [2]string{"jenks", "Jenks"}, [2]string{"quantile", "Quantile"}, [2]string{"equal", "Equal"}, [2]string{"sd", "Std dev"}),
					field("k", "Classes", "", 5, 3, 7, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Data"),
					gisSegs("data", "Data", [2]string{"skewed", "Skewed"}, [2]string{"bimodal", "Bimodal"}, [2]string{"uniform", "Uniform"}),
				),
				readouts([2]string{"breaks", "breaks"}, [2]string{"GVF", "gvf"}, [2]string{"largest class", "big"}, [2]string{"smallest class", "small"}),
				gisNote("Standard-deviation classes are centred on the mean, one deviation wide, and their number follows from the data's spread, so the class slider does not apply to them."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS7

func gisTerrainBlock() Block {
	return Block{
		Slug:        "terrain",
		Title:       "Slope, aspect and hillshade",
		Description: "Terrain analysis works on a digital elevation model, one height per cell. Horn's method (1981) estimates the gradient from the eight neighbours of each cell; slope is its steepness, aspect the compass direction it faces, and hillshade the brightness of the cell under a lamp at the chosen azimuth and altitude.",
		Tags:        []string{"DEM", "Horn's method", "hillshade"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-terrain",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(640, 400, "Synthetic terrain shown as hillshade, slope or aspect", true),
					h.Div(h.Data("ramp", ""), h.Class("flex items-center gap-2 px-1 pt-2 font-mono text-[11px] text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Layer"),
					gisSegs("layer", "Layer", [2]string{"shade", "Hillshade"}, [2]string{"slope", "Slope"}, [2]string{"aspect", "Aspect"}, [2]string{"elev", "Elevation"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sun"),
					field("az", "Azimuth", "°", 315, 0, 360, 5),
					field("alt", "Altitude", "°", 45, 5, 90, 1),
					field("z", "Vertical exaggeration", "×", 1, 0.5, 5, 0.5),
				),
				readouts([2]string{"cell", "cell"}, [2]string{"elevation", "elev"}, [2]string{"slope", "slope"}, [2]string{"aspect", "aspect"}, [2]string{"hillshade", "shade"}),
				gisNote("Point at the map to read a cell. 160 × 100 cells of 25 m. Cartographers light from the north-west (315°) because a lamp from the south makes valleys look like ridges."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS8

func gisOverlayBlock() Block {
	return Block{
		Slug:        "site-selection",
		Title:       "Buffers and overlay",
		Description: "A site-selection query in map algebra: within a walking distance of a road, outside the river's floodplain, on gentle slopes. Each condition is a buffer or threshold turned into a true/false layer, and the answer is their intersection, cell by cell. Change any rule and the suitable land updates.",
		Tags:        []string{"buffer", "map algebra", "suitability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-overlay",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(640, 400, "Roads, river, floodplain and the suitable land", true),
					gisLegend([2]string{"var(--brand)", "suitable"}, [2]string{"var(--vec-u)", "floodplain"}, [2]string{"currentColor", "roads"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rules"),
					field("road", "Max distance to a road", "m", 500, 100, 1500, 50),
					field("flood", "Floodplain half-width", "m", 300, 0, 800, 50),
					field("slope", "Slope below", "%", 10, 2, 40, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					gisSegs("show", "Layer", [2]string{"result", "Result"}, [2]string{"road", "Road buffer"}, [2]string{"flood", "Floodplain"}, [2]string{"slope", "Slope"}),
				),
				h.Pre(h.Data("out", "expr"), h.Class("overflow-x-auto rounded-md border bg-code px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground")),
				readouts([2]string{"suitable area", "area"}, [2]string{"share of map", "share"}, [2]string{"patches", "patches"}, [2]string{"largest patch", "big"}),
				gisNote("Distances are exact Euclidean distances from each 50 m cell's centre to the road segments and the river; a vector GIS would buffer the lines into polygons and intersect those instead."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS9

func gisIndexBlock() Block {
	return Block{
		Slug:        "spatial-index",
		Title:       "Spatial indexing",
		Description: "To find the points inside a window, a database should not test them all. A point quadtree splits any square holding more than its capacity into four, so a range query only descends into squares that touch the window. Drag the window and compare the work with a brute-force scan.",
		Tags:        []string{"quadtree", "range query", "geohash"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-index",
				h.Div(h.Class("flex flex-col gap-1"),
					gisMap(400, 400, "Points in a quadtree with a draggable query window", false),
					gisLegend([2]string{"var(--brand)", "query window and hits"}, [2]string{"var(--vec-u)", "nodes visited"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Index"),
					field("cap", "Node capacity", "", 4, 1, 32, 1),
					field("n", "Points", "", 600, 50, 4000, 50),
					field("w", "Window size", "%", 20, 5, 80, 1),
					gisSegs("dist", "Distribution", [2]string{"clustered", "Clustered"}, [2]string{"uniform", "Uniform"}),
				),
				readouts([2]string{"hits", "hits"}, [2]string{"nodes visited", "nodes"}, [2]string{"points tested", "tested"}, [2]string{"brute force", "brute"}, [2]string{"tree depth", "depth"}, [2]string{"geohash of centre", "hash"}),
				gisNote("The map is read as longitude −10°…10° and latitude 40°…60° so the window centre has a geohash: each extra character splits the cell 32 ways, the same idea as the quadtree's 4."),
			)
		},
	}
}

// ---------------------------------------------------------------- GIS10

func gisMoranBlock() Block {
	return Block{
		Slug:        "morans-i",
		Title:       "Spatial autocorrelation",
		Description: "Are high values next to high values? Moran's I compares each cell with its rook neighbours: near +1 for clusters, near −1 for a checkerboard and near −1/(n−1) for randomness. Is a value surprising? Shuffle the same values over the grid 999 times and see where the real I falls.",
		Tags:        []string{"Moran's I", "permutation test", "clusters"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("gis-moran",
				h.Div(h.Class("flex flex-col gap-3"),
					gisMap(400, 400, "A 12 by 12 grid of values; click cells to paint", false),
					h.Svg(h.Data("chart", ""), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Distribution of Moran's I under random permutation, with the observed value")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pattern"),
					gisSegs("preset", "Preset", [2]string{"cluster", "Clustered"}, [2]string{"random", "Random"}, [2]string{"checker", "Checkerboard"}, [2]string{"gradient", "Gradient"}),
					gisSegs("paint", "Brush", [2]string{"high", "Paint high"}, [2]string{"low", "Paint low"}),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), gisButton("perm", "Reshuffle 999 times", hugeicons.ShuffleIcon())),
				readouts([2]string{"Moran's I", "i"}, [2]string{"E[I] if random", "ei"}, [2]string{"z (normality)", "z"}, [2]string{"pseudo p", "p"}, [2]string{"verdict", "verdict"}),
				gisNote("Paint with a pointer, or focus the grid and use the arrow keys and Space. Rook contiguity, row-standardised weights. The pseudo p-value is (1 + number of shuffles with I at least as extreme) / 1000, two-sided."),
			)
		},
	}
}
