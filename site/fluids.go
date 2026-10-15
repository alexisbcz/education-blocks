package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// FluidsBlocks lists the fluid mechanics gallery in display order.
func FluidsBlocks() []Block {
	return []Block{
		fluidHydrostaticsBlock(),
		fluidBuoyancyBlock(),
		fluidVenturiBlock(),
		fluidPipeBlock(),
		fluidPotentialBlock(),
		fluidStableBlock(),
		fluidDragBlock(),
		fluidBoundaryBlock(),
		fluidJumpBlock(),
		fluidPiBlock(),
	}
}

// fluidNote is the small print under a model: what it assumes.
func fluidNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

func fluidSvg(name, viewBox, label string) h.Node {
	return h.Svg(h.Data(name, ""), h.ViewBox(viewBox), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", label))
}

func fluidButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// ---------------------------------------------------------------- F1

func fluidHydrostaticsBlock() Block {
	return Block{
		Slug:        "hydrostatics",
		Title:       "Hydrostatic pressure",
		Description: "Pressure in a fluid at rest grows linearly with depth, p = p₀ + ρgh, whatever the shape of the container. A U-tube manometer reads a pressure difference as a height, and Pascal's principle lets a small force on a small piston lift a large load.",
		Tags:        []string{"p = p₀ + ρgh", "manometer", "Pascal"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-hydro",
				h.Div(h.Class("grid gap-3 md:grid-cols-[3fr_2fr]"),
					fluidSvg("tank", "0 0 360 300", "Tank with a pressure probe at depth h"),
					fluidSvg("press", "0 0 240 300", "Hydraulic press with two pistons"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Fluid"),
					segs("Fluid", [2]string{"water", "Water"}, [2]string{"sea", "Seawater"}, [2]string{"mercury", "Mercury"}),
					field("depth", "Probe depth h", "m", 4, 0, 10, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Hydraulic press"),
					field("f1", "Force F₁", "N", 200, 10, 1000, 10),
					field("d1", "Small piston", "cm", 4, 1, 20, 0.5),
					field("d2", "Large piston", "cm", 30, 5, 80, 1),
				),
				readouts([2]string{"ρ", "rho"}, [2]string{"gauge p", "gauge"}, [2]string{"absolute p", "abs"}, [2]string{"manometer Δh", "mano"}, [2]string{"F₂", "f2"}, [2]string{"stroke ratio", "stroke"}),
				fluidNote("g = 9.80665 m/s², p₀ = 101.325 kPa. Densities ≈ 998 (water, 20 °C), 1025 (seawater), 13,534 kg/m³ (mercury, 20 °C). The manometer is a mercury U-tube open to the air, connected to the probe."),
			)
		},
	}
}

// ---------------------------------------------------------------- F2

func fluidBuoyancyBlock() Block {
	return Block{
		Slug:        "buoyancy",
		Title:       "Buoyancy and stability",
		Description: "A floating body displaces its own weight of fluid (Archimedes). Whether it stays upright depends on the metacentric height GM = KB + BM − KG: heel a box barge and watch the buoyancy centre move, and raise its centre of gravity until it capsizes.",
		Tags:        []string{"Archimedes", "metacentre", "box barge"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-buoy",
				fluidSvg("hull", "0 0 520 320", "Cross-section of a heeled box barge with its centres"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Barge (box section)"),
					field("beam", "Beam B", "m", 10, 2, 20, 0.5),
					field("depth", "Depth D", "m", 6, 1, 12, 0.5),
					field("length", "Length L", "m", 40, 5, 100, 1),
					field("mass", "Mass", "t", 800, 50, 4000, 10),
					field("kg", "Centre of gravity KG", "m", 3.5, 0, 12, 0.1),
					field("heel", "Heel angle", "°", 10, 0, 40, 1),
				),
				readouts([2]string{"draft T", "draft"}, [2]string{"KB", "kb"}, [2]string{"BM", "bm"}, [2]string{"GM", "gm"}, [2]string{"GZ exact", "gz"}, [2]string{"GZ ≈ GM sin φ", "gzs"}, [2]string{"verdict", "verdict"}, [2]string{"ice submerged", "ice"}),
				fluidNote("Seawater 1025 kg/m³. The drawing and \"GZ exact\" use the true heeled waterline (the box keeps its displaced area); GM·sin φ is the small-angle approximation. Ice ≈ 917 kg/m³ floats about 89% submerged in seawater, 92% in fresh water."),
			)
		},
	}
}

// ---------------------------------------------------------------- F3

func fluidVenturiBlock() Block {
	return Block{
		Slug:        "venturi",
		Title:       "Continuity and Bernoulli",
		Description: "What goes in must come out: A₁v₁ = A₂v₂. In the throat of a Venturi the flow speeds up and, by Bernoulli, the pressure drops; the drop in the piezometer columns measures the flow rate.",
		Tags:        []string{"continuity", "Bernoulli", "flow meter"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-venturi",
				fluidSvg("pipe", "0 0 560 300", "Venturi tube with piezometer columns and moving tracers"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Venturi (water)"),
					field("q", "Flow rate Q", "L/s", 6, 0.5, 30, 0.5),
					field("d1", "Inlet D₁", "cm", 10, 3, 20, 0.5),
					field("d2", "Throat D₂", "cm", 5, 1, 19, 0.5),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), playPause()),
				readouts([2]string{"v₁", "v1"}, [2]string{"v₂", "v2"}, [2]string{"Δp = p₁ − p₂", "dp"}, [2]string{"Δh (water)", "dh"}, [2]string{"Q back from Δp", "qback"}),
				fluidNote("Ideal, incompressible, frictionless flow (discharge coefficient 1); a real Venturi has C_d ≈ 0.98. ρ = 998 kg/m³."),
			)
		},
	}
}

// ---------------------------------------------------------------- F4

func fluidPipeBlock() Block {
	return Block{
		Slug:        "pipe-flow",
		Title:       "Pipe friction and the Moody chart",
		Description: "The Reynolds number decides the regime. Laminar flow loses head as f = 64/Re; turbulent flow follows the Colebrook equation, solved here by iteration, which depends on the wall roughness. The head loss comes from Darcy–Weisbach.",
		Tags:        []string{"Reynolds", "Colebrook", "Darcy–Weisbach"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-pipe",
				fluidSvg("moody", "0 0 600 360", "Friction factor against Reynolds number for several roughnesses"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pipe and flow"),
					segs("Fluid", [2]string{"water", "Water"}, [2]string{"air", "Air"}),
					field("v", "Mean velocity", "m/s", 1.5, 0.001, 30, 0.001),
					field("d", "Diameter", "mm", 50, 2, 500, 1),
					field("eps", "Roughness ε", "mm", 0.05, 0, 3, 0.005),
					field("len", "Length", "m", 100, 1, 1000, 1),
				),
				readouts([2]string{"Re", "re"}, [2]string{"regime", "regime"}, [2]string{"ε/D", "rel"}, [2]string{"f", "f"}, [2]string{"head loss", "hl"}, [2]string{"Δp", "dp"}, [2]string{"Colebrook iterations", "iter"}),
				fluidNote("Water 998 kg/m³, 1.0 mPa·s; air 1.204 kg/m³, 18.1 µPa·s (20 °C). Between Re ≈ 2300 and 4000 the flow is transitional and f is uncertain (shaded). Roughness ≈ 0.0015 mm drawn tubing, 0.045 mm commercial steel, 0.26 mm cast iron."),
			)
		},
	}
}

// ---------------------------------------------------------------- F5

func fluidPotentialBlock() Block {
	return Block{
		Slug:        "potential-flow",
		Title:       "Potential flow playground",
		Description: "Ideal 2D flows add up: a uniform stream, sources, sinks, vortices and doublets superpose their stream functions. Uniform flow plus a doublet is flow past a cylinder; add clockwise circulation and the stagnation points slide down while the cylinder feels a lift ρU|Γ| per metre (Kutta–Joukowski).",
		Tags:        []string{"stream function", "superposition", "Kutta–Joukowski"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-potential",
				h.Div(h.Class("flex flex-col gap-2"),
					fluidSvg("field", "0 0 600 360", "Streamlines of the superposed potential flow"),
					h.P(h.Class("px-1 font-mono text-[11px] text-muted-foreground"), "Drag a source, sink or vortex. Streamlines are contours of ψ; the shading is the pressure coefficient C_p."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Preset"),
					segs("Flow", [2]string{"cylinder", "Cylinder"}, [2]string{"lifting", "Spinning cylinder"}, [2]string{"rankine", "Rankine body"}, [2]string{"vortex", "Source + vortex"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Strengths"),
					field("u", "Free stream U", "m/s", 1, 0, 3, 0.05),
					field("gamma", "Circulation Γ", "m²/s", 0, -20, 20, 0.5),
					field("m", "Source strength m", "m²/s", 3, 0, 10, 0.1),
				),
				readouts([2]string{"cylinder radius", "radius"}, [2]string{"stagnation", "stag"}, [2]string{"lift per metre", "lift"}, [2]string{"drag", "drag"}),
				fluidNote("Inviscid, incompressible, irrotational flow; ρ = 1.204 kg/m³ (air) for the lift. Zero drag is d'Alembert's paradox: real flows separate behind a cylinder."),
			)
		},
	}
}

// ---------------------------------------------------------------- F6

func fluidStableBlock() Block {
	return Block{
		Slug:        "smoke",
		Title:       "Smoke in a box",
		Description: "A real-time 2D fluid: drag across the box to push the air and inject smoke. Velocity is advected, diffused and projected to stay divergence-free on a 64 × 64 grid, after Jos Stam's Stable Fluids (1999).",
		Tags:        []string{"Navier–Stokes", "stable fluids", "canvas"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-smoke",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("relative mx-auto aspect-square w-full max-w-[480px] cursor-crosshair touch-none overflow-hidden rounded-lg border bg-background"),
						h.Canvas(h.Data("canvas", ""), h.Class("absolute inset-0 size-full"), h.Role("img"), h.Aria("label", "Smoke density in a closed box; drag to stir")),
					),
					h.P(h.Class("text-center font-mono text-[11px] text-muted-foreground"), "Drag to stir · the box has solid walls"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Solver"),
					field("visc", "Viscosity", "×10⁻⁵", 0, 0, 50, 1),
					field("fade", "Smoke fade", "%/s", 4, 0, 50, 1),
					field("iters", "Projection iterations", "", 20, 2, 60, 1),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					toggle("fluid-smoke-vel", "vectors", "Show velocity", false),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					playPause(),
					fluidButton("puff", "Puff", hugeicons.CloudIcon()),
					h.Div(h.Class("col-span-2"), fluidButton("clear", "Clear", hugeicons.Delete02Icon())),
				),
				readouts([2]string{"max speed", "speed"}, [2]string{"divergence after", "div"}, [2]string{"frame time", "ms"}),
				fluidNote("A visual solver: semi-Lagrangian advection and a Gauss–Seidel pressure projection are unconditionally stable but numerically dissipative, so it looks right rather than measuring anything."),
			)
		},
	}
}

// ---------------------------------------------------------------- F7

func fluidDragBlock() Block {
	return Block{
		Slug:        "terminal-velocity",
		Title:       "Drag and terminal velocity",
		Description: "A falling sphere stops accelerating when drag balances weight minus buoyancy. For tiny, slow spheres Stokes' law holds (C_d = 24/Re); faster ones follow the sphere drag curve, which flattens near 0.44. The solver iterates Re and C_d to the terminal speed.",
		Tags:        []string{"Stokes", "C_d(Re)", "terminal speed"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-drag",
				h.Div(h.Class("grid gap-3 md:grid-cols-[3fr_2fr]"),
					fluidSvg("cd", "0 0 380 300", "Drag coefficient of a sphere against Reynolds number"),
					fluidSvg("fall", "0 0 240 300", "Speed against time for the falling sphere"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Preset"),
					segs("Object", [2]string{"rain", "Raindrop"}, [2]string{"sand", "Sand grain"}, [2]string{"steel", "Steel ball in water"}, [2]string{"skydiver", "Skydiver"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Sphere"),
					field("d", "Diameter", "mm", 2, 0.01, 50, 0.01),
					field("rho", "Density", "kg/m³", 1000, 100, 9000, 10),
				),
				readouts([2]string{"fluid", "fluid"}, [2]string{"terminal speed", "vt"}, [2]string{"Stokes estimate", "stokes"}, [2]string{"Re at terminal", "re"}, [2]string{"C_d", "cd"}, [2]string{"time to 95%", "t95"}),
				fluidNote("Sphere drag: C_d = 24/Re·(1 + 0.15 Re^0.687) up to Re = 1000 (Schiller–Naumann), then 0.44 until the drag crisis near 2×10⁵ (not modelled). Real raindrops flatten, so a 2 mm drop falls ≈ 6.5 m/s rather than the sphere value. The skydiver uses C_d·A ≈ 0.43 m², 80 kg, belly-to-earth (≈ 55 m/s)."),
			)
		},
	}
}

// ---------------------------------------------------------------- F8

func fluidBoundaryBlock() Block {
	return Block{
		Slug:        "boundary-layer",
		Title:       "Boundary layer on a flat plate",
		Description: "Right at the wall the fluid sticks; the region where it catches up with the stream thickens downstream. Laminar thickness grows as δ ≈ 5x/√Re_x (Blasius), until near Re_x ≈ 5×10⁵ it trips into a thicker turbulent layer, δ ≈ 0.37x/Re_x^0.2.",
		Tags:        []string{"Blasius", "transition", "no-slip"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-bl",
				fluidSvg("plate", "0 0 600 320", "Boundary layer thickness along a flat plate with velocity profiles"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Flow"),
					segs("Fluid", [2]string{"air", "Air"}, [2]string{"water", "Water"}),
					field("u", "Free stream U", "m/s", 10, 0.1, 60, 0.1),
					field("len", "Plate length", "m", 1, 0.05, 5, 0.05),
					field("probe", "Probe at x", "% of L", 30, 1, 100, 1),
				),
				readouts([2]string{"Re at probe", "rex"}, [2]string{"δ at probe", "delta"}, [2]string{"regime", "regime"}, [2]string{"transition at", "xt"}, [2]string{"δ at the end", "dend"}),
				fluidNote("Thickness is drawn exaggerated (the scale bar is true). Profiles use Pohlhausen's quartic u/U = 2η − 2η³ + η⁴ (laminar) and the 1/7 power law (turbulent), both approximations. The turbulent layer grows from a virtual origin chosen so δ is continuous at transition, taken at Re_x = 5×10⁵, a typical value for a smooth plate."),
			)
		},
	}
}

// ---------------------------------------------------------------- F9

func fluidJumpBlock() Block {
	return Block{
		Slug:        "hydraulic-jump",
		Title:       "Open channels and the hydraulic jump",
		Description: "In a channel the Froude number Fr = v/√(gy) plays the role of a Mach number. Fast, shallow (supercritical) flow can jump abruptly to slow, deep (subcritical) flow; momentum fixes the depth after the jump and the energy lost in the roller.",
		Tags:        []string{"Froude", "sequent depths", "energy loss"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fluid-jump",
				fluidSvg("channel", "0 0 600 300", "Side view of a hydraulic jump in a rectangular channel"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Upstream flow (per metre width)"),
					field("y1", "Depth y₁", "m", 0.3, 0.02, 2, 0.01),
					field("fr", "Froude Fr₁", "", 3, 1.05, 12, 0.05),
				),
				readouts([2]string{"v₁", "v1"}, [2]string{"q = v₁y₁", "q"}, [2]string{"y₂ / y₁", "ratio"}, [2]string{"y₂", "y2"}, [2]string{"v₂ and Fr₂", "v2"}, [2]string{"energy lost ΔE", "de"}, [2]string{"efficiency E₂/E₁", "eff"}, [2]string{"jump type", "kind"}),
				fluidNote("Rectangular channel, horizontal bed, momentum conserved across the jump: y₂/y₁ = ½(√(1 + 8Fr₁²) − 1), ΔE = (y₂ − y₁)³/(4y₁y₂). Jump classes after the US Bureau of Reclamation (Fr₁ ranges ≈)."),
			)
		},
	}
}

// ---------------------------------------------------------------- F10

func fluidPiBlock() Block {
	return Block{
		Slug:        "buckingham-pi",
		Title:       "Dimensional analysis",
		Description: "Buckingham's π theorem: n variables built from k independent dimensions combine into n − k dimensionless groups. Pick a problem and repeating variables; the exponents of each group are solved exactly from the dimension matrix.",
		Tags:        []string{"π theorem", "dimension matrix", "similarity"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-5"), h.Data("fluid-pi", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					panelLabel("Problem"),
					segs("Problem", [2]string{"sphere", "Drag on a sphere"}, [2]string{"pipe", "Pressure drop in a pipe"}, [2]string{"pendulum", "Pendulum period"}),
				),
				h.Div(h.Data("matrix", ""), h.Class("scroll-thin overflow-x-auto")),
				h.Div(h.Class("flex flex-col gap-2"),
					panelLabel("Repeating variables (pick as many as dimensions)"),
					h.Div(h.Data("repeat", ""), h.Class("flex flex-wrap gap-1.5")),
				),
				h.Div(h.Data("groups", ""), h.Aria("live", "polite"), h.Class("flex flex-col gap-2")),
				fluidNote("Repeating variables must together contain every dimension and be independent; otherwise the solve fails and says why. Any valid choice gives an equivalent set of groups."),
			)
		},
	}
}
