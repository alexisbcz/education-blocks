package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// HydrologyBlocks lists the hydrology and water resources gallery in
// display order. Every catchment, record and terrain is synthetic and
// labelled as such; the models are the textbook ones, computed exactly.
func HydrologyBlocks() []Block {
	return []Block{
		hydroCycleBlock(),
		hydroHortonBlock(),
		hydroCurveNumberBlock(),
		hydroUnitHydrographBlock(),
		hydroManningBlock(),
		hydroFloodBlock(),
		hydroWellBlock(),
		hydroReservoirBlock(),
		hydroSagBlock(),
		hydroD8Block(),
	}
}

// hydroNote is the small print under a model: what it assumes.
func hydroNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func hydroSvg(name, viewBox, label string) h.Node {
	return h.Svg(h.Data(name, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func hydroButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// hydroSegs is a segmented control the module can tell apart from the
// block's other ones by name.
func hydroSegs(name, label string, opts ...[2]string) h.Node {
	return h.Div(h.Data("hydro-seg", name), segs(label, opts...))
}

// ---------------------------------------------------------------- H1

func hydroCycleBlock() Block {
	return Block{
		Slug:        "water-cycle",
		Title:       "Stocks, fluxes and residence time",
		Description: "Treat the water cycle as three well-mixed reservoirs. At steady state every stock's inflow equals its outflow, so two fluxes follow from the others, and the mean residence time is simply stock ÷ flux: a tracer pulse decays as e^(−t/τ).",
		Tags:        []string{"mass balance", "τ = S / F", "box model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-cycle",
				h.Div(h.Class("grid gap-3 md:grid-cols-[3fr_2fr]"),
					hydroSvg("boxes", "0 0 420 300", "Atmosphere, land and ocean reservoirs with the fluxes between them"),
					hydroSvg("decay", "0 0 300 300", "Fraction of a tracer pulse left in the chosen reservoir"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Stocks"),
					field("atm", "Atmosphere", "10³ km³", 13, 1, 50, 1),
					field("land", "Land (soil, lakes, aquifers)", "10³ km³", 2000, 100, 20000, 100),
					field("ocean", "Ocean", "10⁹ km³", 1.3, 0.1, 3, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Fluxes"),
					field("eo", "Evaporation, ocean", "10³ km³/yr", 410, 50, 800, 5),
					field("pl", "Precipitation, land", "10³ km³/yr", 110, 10, 300, 5),
					field("el", "Evapotranspiration, land", "10³ km³/yr", 70, 0, 300, 5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Tracer pulse in"),
					hydroSegs("box", "Reservoir", [2]string{"atm", "Atmosphere"}, [2]string{"land", "Land"}, [2]string{"ocean", "Ocean"}),
				),
				readouts([2]string{"P ocean", "po"}, [2]string{"runoff R", "r"}, [2]string{"τ atmosphere", "tatm"}, [2]string{"τ land", "tland"}, [2]string{"τ ocean", "tocean"}, [2]string{"balance", "ok"}),
				hydroNote("Round, order-of-magnitude numbers for illustration, not a dataset. Steady state: P_ocean = E_ocean − (P_land − ET_land) and runoff R = P_land − ET_land. τ = stock ÷ total outflow is a mean for a well-mixed box; real reservoirs are not well mixed (deep aquifers hold water far longer than their average)."),
			)
		},
	}
}

// ---------------------------------------------------------------- H2

func hydroHortonBlock() Block {
	return Block{
		Slug:        "infiltration",
		Title:       "Horton infiltration and ponding",
		Description: "A soil's infiltration capacity decays from f₀ towards a steady fc as it wets: f = fc + (f₀ − fc)e^(−kt). Rain lighter than the capacity soaks in entirely; once the capacity falls below the rain rate the surface ponds and the excess runs off.",
		Tags:        []string{"Horton", "ponding time", "infiltration excess"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-horton",
				hydroSvg("plot", "0 0 560 300", "Infiltration capacity, rain rate and runoff against time"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Soil (Horton)"),
					field("f0", "Initial capacity f₀", "mm/h", 80, 5, 250, 1),
					field("fc", "Final capacity fc", "mm/h", 10, 0, 100, 1),
					field("k", "Decay constant k", "1/h", 2, 0.1, 10, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Storm (constant)"),
					field("i", "Rain intensity i", "mm/h", 30, 1, 200, 1),
					field("dur", "Duration", "h", 3, 0.5, 8, 0.5),
				),
				readouts([2]string{"ponding time", "tp"}, [2]string{"rain", "rain"}, [2]string{"infiltrated", "inf"}, [2]string{"runoff", "ro"}, [2]string{"runoff ratio", "ratio"}),
				hydroNote("Before ponding all rain infiltrates, so the capacity follows the water taken in rather than the clock: the time-compression approximation finds the time on Horton's curve at which the cumulative infiltration F = fc·t + (f₀ − fc)(1 − e^(−kt))/k matches what has entered. Synthetic soil parameters."),
			)
		},
	}
}

// ---------------------------------------------------------------- H3

func hydroCurveNumberBlock() Block {
	return Block{
		Slug:        "curve-number",
		Title:       "SCS Curve Number runoff",
		Description: "The NRCS Curve Number method turns a storm depth into a runoff depth with one parameter. Retention S = 25400/CN − 254 mm, initial abstraction Ia = λS, and Q = (P − Ia)² / (P − Ia + S) once P exceeds Ia.",
		Tags:        []string{"Curve Number", "runoff depth", "TR-55"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-cn",
				hydroSvg("plot", "0 0 560 320", "Runoff depth against rainfall depth for several curve numbers"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Land cover (soil group B)"),
					hydroSegs("cover", "Land cover", [2]string{"custom", "Custom"}, [2]string{"55", "Woods"}, [2]string{"69", "Pasture"}, [2]string{"78", "Row crops"}, [2]string{"75", "Suburb"}, [2]string{"98", "Paved"}),
					field("cn", "Curve number CN", "", 80, 30, 100, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Storm"),
					field("p", "Rainfall depth P", "mm", 100, 0, 300, 1),
					hydroSegs("lambda", "Initial abstraction ratio", [2]string{"0.2", "λ = 0.2"}, [2]string{"0.05", "λ = 0.05"}),
				),
				readouts([2]string{"S", "s"}, [2]string{"Ia", "ia"}, [2]string{"runoff Q", "q"}, [2]string{"Q / P", "c"}, [2]string{"retained", "ret"}),
				hydroNote("Presets are typical TR-55 table values for hydrologic soil group B, average antecedent moisture (AMC II): woods in good condition 55, pasture in fair condition 69, straight-row crops 78, ¼-acre residential 75, paved 98. λ = 0.2 is the classic ratio; λ = 0.05 is a revision proposed for many watersheds. Q ≤ P − Ia always, and Q → P − Ia − S as P grows."),
			)
		},
	}
}

// ---------------------------------------------------------------- H4

func hydroUnitHydrographBlock() Block {
	return Block{
		Slug:        "unit-hydrograph",
		Title:       "Unit hydrograph convolution",
		Description: "A unit hydrograph is a catchment's response to 1 mm of excess rain in one hour. The system is linear and time-invariant, so any storm's hydrograph is the sum of shifted, scaled copies: Qₙ = Σ Pₘ·Uₙ₋ₘ₊₁. Drag the bars to shape the storm.",
		Tags:        []string{"convolution", "linear system", "SCS triangle"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-uh",
				h.Div(h.Class("flex flex-col gap-2"),
					hydroSvg("rain", "0 0 560 120", "Hourly excess rainfall; drag a bar to change it"),
					hydroSvg("flow", "0 0 560 260", "Streamflow: one shifted unit hydrograph per hour of rain and their sum"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Catchment (synthetic)"),
					field("area", "Area A", "km²", 120, 5, 1000, 5),
					field("tp", "Time to peak tp", "h", 4, 1, 12, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Storm"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						hydroButton("burst", "Burst", hugeicons.DropletIcon()),
						hydroButton("clear", "Clear", hugeicons.Eraser01Icon()),
					),
				),
				readouts([2]string{"excess rain", "depth"}, [2]string{"A × depth", "vin"}, [2]string{"Σ Q·Δt", "vout"}, [2]string{"peak flow", "peak"}, [2]string{"time of peak", "tpk"}),
				hydroNote("The 1-hour unit hydrograph is the SCS triangle (base 2.67 tp) sampled hourly and scaled so its ordinates hold exactly 1 mm over the catchment, which is why the two volumes always match. Coloured outlines are the individual responses; the filled curve is their sum."),
			)
		},
	}
}

// ---------------------------------------------------------------- H5

func hydroManningBlock() Block {
	return Block{
		Slug:        "manning",
		Title:       "Manning's equation in a trapezoidal channel",
		Description: "Uniform open-channel flow balances gravity against bed friction: v = (1/n) R^(2/3) S^(1/2), with the hydraulic radius R = A/P. Change the depth, the section or the roughness and read the discharge off the rating curve.",
		Tags:        []string{"Manning", "hydraulic radius", "rating curve"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-manning",
				h.Div(h.Class("grid gap-3 md:grid-cols-[3fr_2fr]"),
					hydroSvg("section", "0 0 360 240", "Trapezoidal channel cross-section with the wetted perimeter highlighted"),
					hydroSvg("rating", "0 0 260 260", "Rating curve: discharge against depth"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Section"),
					field("b", "Bottom width b", "m", 4, 0, 20, 0.5),
					field("z", "Side slope z (H:V)", "", 2, 0, 4, 0.1),
					field("y", "Flow depth y", "m", 1.2, 0.05, 4, 0.05),
					field("s", "Bed slope S", "‰", 1, 0.05, 20, 0.05),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Lining"),
					hydroSegs("lining", "Lining", [2]string{"0.013", "Concrete"}, [2]string{"0.022", "Earth"}, [2]string{"0.035", "Natural"}, [2]string{"0.05", "Weedy"}),
				),
				readouts([2]string{"n", "n"}, [2]string{"area A", "a"}, [2]string{"wetted P", "p"}, [2]string{"R = A/P", "r"}, [2]string{"velocity v", "v"}, [2]string{"discharge Q", "q"}, [2]string{"Froude", "fr"}),
				hydroNote("SI units (the 1/n form; US units need 1.49/n). n values are typical textbook figures for finished concrete, clean earth, natural streams and weedy channels. Froude number Fr = v/√(gD) with hydraulic depth D = A/T: below 1 the flow is subcritical."),
			)
		},
	}
}

// ---------------------------------------------------------------- H6

func hydroFloodBlock() Block {
	return Block{
		Slug:        "flood-frequency",
		Title:       "Return periods and flood frequency",
		Description: "A 100-year flood has a 1% chance of being exceeded in any year, so over 30 years the chance of at least one is 1 − 0.99³⁰ ≈ 26%. Fit a Gumbel distribution to a record of annual maxima by moments and read design floods off the probability plot.",
		Tags:        []string{"return period", "Gumbel", "probability plot"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-flood",
				h.Div(h.Class("grid gap-3 md:grid-cols-[3fr_2fr]"),
					hydroSvg("plot", "0 0 380 300", "Annual maxima on a Gumbel probability plot with the fitted line"),
					hydroSvg("risk", "0 0 260 300", "Chance of at least one exceedance against design life"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Design"),
					field("t", "Return period T", "yr", 100, 2, 1000, 1),
					field("life", "Design life n", "yr", 30, 1, 200, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Synthetic record"),
					hydroSegs("len", "Record length", [2]string{"30", "30 yr"}, [2]string{"60", "60 yr"}, [2]string{"120", "120 yr"}),
					h.Div(hydroButton("resample", "New record", hugeicons.DiceFaces03Icon())),
				),
				readouts([2]string{"AEP 1/T", "aep"}, [2]string{"risk in n yr", "risk"}, [2]string{"mean, sd", "ms"}, [2]string{"Gumbel u, α", "ua"}, [2]string{"Q_T fitted", "qt"}, [2]string{"Q_T true", "qtrue"}),
				hydroNote("The record is drawn from a known Gumbel parent (u = 300, α = 100 m³/s), so the fitted design flood can be compared with the truth: short records scatter widely. Moments: α = s√6/π, u = x̄ − 0.5772α, Q_T = u − α ln(−ln(1 − 1/T)). Points use Weibull plotting positions i/(N + 1)."),
			)
		},
	}
}

// ---------------------------------------------------------------- H7

func hydroWellBlock() Block {
	return Block{
		Slug:        "groundwater",
		Title:       "Darcy's law and a pumping well",
		Description: "Groundwater flux is proportional to the head gradient: Q = K·i·A. Around a well pumping a confined aquifer at steady state, Darcy's law through each cylinder 2πrb gives Thiem's cone of depression, s(r) = Q/(2πKb)·ln(R/r).",
		Tags:        []string{"Darcy", "Thiem", "transmissivity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-well",
				hydroSvg("section", "0 0 560 300", "Cross-section of a confined aquifer with a pumping well and its cone of depression"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Aquifer (confined)"),
					field("k", "Conductivity K", "m/day", 20, 0.1, 200, 0.1),
					field("b", "Thickness b", "m", 25, 2, 80, 1),
					field("ne", "Effective porosity", "", 0.2, 0.01, 0.4, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Well"),
					field("q", "Pumping rate Q", "m³/day", 1500, 50, 10000, 50),
					field("rw", "Well radius rw", "m", 0.15, 0.05, 1, 0.05),
					field("rr", "Radius of influence R", "m", 500, 50, 3000, 10),
					field("ro", "Observation well r", "m", 50, 1, 1000, 1),
				),
				readouts([2]string{"T = Kb", "t"}, [2]string{"drawdown at well", "sw"}, [2]string{"drawdown at r", "so"}, [2]string{"gradient at r", "i"}, [2]string{"K·i·2πrb", "darcy"}, [2]string{"seepage v at r", "v"}),
				hydroNote("Steady radial flow, homogeneous isotropic aquifer, fully penetrating well, no drawdown at R. The Darcy check recomputes the flow through the cylinder at r from the local gradient: it equals Q at every radius. Seepage velocity = Darcy flux ÷ effective porosity. Synthetic aquifer."),
			)
		},
	}
}

// ---------------------------------------------------------------- H8

func hydroReservoirBlock() Block {
	return Block{
		Slug:        "reservoir",
		Title:       "Reservoir storage: mass curve and sequent peak",
		Description: "How big must a reservoir be to deliver a steady draft through the driest spell on record? Rippl's mass curve answers graphically; the sequent peak algorithm answers exactly, Kₜ = max(0, Kₜ₋₁ + D − Qₜ), run over the record twice so a drought spanning its end is caught.",
		Tags:        []string{"Rippl", "sequent peak", "yield"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-res",
				h.Div(h.Class("flex flex-col gap-2"),
					hydroSvg("mass", "0 0 560 220", "Cumulative inflow with a draft line from the critical peak"),
					hydroSvg("deficit", "0 0 560 150", "Sequent peak deficit through two passes of the record"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Draft"),
					field("d", "Draft, % of mean inflow", "%", 70, 5, 100, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Synthetic inflow (8 yr)"),
					h.Div(hydroButton("resample", "New record", hugeicons.DiceFaces03Icon())),
				),
				readouts([2]string{"mean inflow", "mean"}, [2]string{"draft D", "d"}, [2]string{"storage (sequent peak)", "k"}, [2]string{"storage (single pass)", "rippl"}, [2]string{"critical period", "crit"}, [2]string{"storage ÷ annual inflow", "ratio"}),
				hydroNote("Monthly inflows in hm³ from a seasonal pattern times random wet and dry years: synthetic. The draft line drawn on the mass curve is the critical one: the largest vertical gap below it is the storage. The single pass ignores a deficit still open at the end of the record; the second pass of the sequent peak closes it. No evaporation or spill losses."),
			)
		},
	}
}

// ---------------------------------------------------------------- H9

func hydroSagBlock() Block {
	return Block{
		Slug:        "oxygen-sag",
		Title:       "Streeter–Phelps oxygen sag",
		Description: "Downstream of an organic discharge, bacteria consume oxygen as they decay the BOD while the surface re-aerates the river. The deficit D(t) = k_d L₀/(k_a − k_d)·(e^(−k_d t) − e^(−k_a t)) + D₀e^(−k_a t) peaks at the critical time, where dissolved oxygen is lowest.",
		Tags:        []string{"BOD", "reaeration", "critical point"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-sag",
				hydroSvg("plot", "0 0 560 300", "Dissolved oxygen and remaining BOD against distance downstream"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mixed river below the outfall"),
					field("l0", "Ultimate BOD L₀", "mg/L", 20, 0, 60, 0.5),
					field("do0", "Initial DO", "mg/L", 8, 0, 14, 0.1),
					field("sat", "Saturation DO", "mg/L", 9.1, 5, 14, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Rates (base e, per day)"),
					field("kd", "Deoxygenation k_d", "1/day", 0.3, 0.05, 2, 0.01),
					field("ka", "Reaeration k_a", "1/day", 0.7, 0.05, 5, 0.01),
					field("u", "Velocity", "km/day", 25, 1, 100, 1),
				),
				readouts([2]string{"critical time t_c", "tc"}, [2]string{"critical distance", "xc"}, [2]string{"minimum DO", "min"}, [2]string{"f = k_a/k_d", "f"}, [2]string{"below 5 mg/L", "low"}),
				hydroNote("t_c = ln[(k_a/k_d)(1 − D₀(k_a − k_d)/(k_d L₀))]/(k_a − k_d); when k_a = k_d the limit D = (k_d L₀ t + D₀)e^(−k_d t) is used. If the bracket is ≤ 1 the deficit only shrinks and the minimum is at the outfall. 9.1 mg/L is about saturation for fresh water near 20 °C. Plug flow, one point source: a synthetic reach."),
			)
		},
	}
}

// ---------------------------------------------------------------- H10

func hydroD8Block() Block {
	return Block{
		Slug:        "d8-drainage",
		Title:       "D8 flow routing on a terrain",
		Description: "Send each cell's water to the steepest of its eight neighbours (diagonals are √2 farther), count how many cells drain through each one, and keep those above a threshold: a drainage network appears. Click a cell to outline the catchment above it.",
		Tags:        []string{"D8", "flow accumulation", "watershed"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("hydro-d8",
				hydroSvg("map", "0 0 560 400", "Synthetic elevation grid with its D8 drainage network; click a cell to show its catchment"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network"),
					field("thr", "Channel threshold", "cells", 25, 2, 400, 1),
					toggle("hydro-d8-arrows", "arrows", "Flow directions", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Synthetic terrain"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						hydroButton("resample", "New terrain", hugeicons.DiceFaces03Icon()),
						hydroButton("clear", "Clear catchment", hugeicons.Eraser01Icon()),
					),
				),
				readouts([2]string{"grid", "grid"}, [2]string{"pits filled", "pits"}, [2]string{"largest accumulation", "max"}, [2]string{"channel cells", "chan"}, [2]string{"selected catchment", "sel"}),
				hydroNote("Random tilted terrain, not a real DEM. Pits are filled first (priority flood with a tiny gradient) so every cell drains off the edge. A cell's accumulation counts itself plus every cell upstream; the catchment of a clicked cell is exactly that set."),
			)
		},
	}
}
