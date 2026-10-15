package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// CompchemBlocks lists the computational chemistry gallery in display
// order. Every number is computed in the page: molecular dynamics in
// reduced Lennard-Jones units, optimisers and the elastic band on the
// Müller–Brown surface, Hückel and normal modes by Jacobi diagonalisation,
// and the hydrogen atom in a Gaussian basis by the variational method.
func CompchemBlocks() []Block {
	return []Block{
		ccLJBlock(),
		ccMDBlock(),
		ccMSDBlock(),
		ccButaneBlock(),
		ccMinimiseBlock(),
		ccNEBBlock(),
		ccHuckelBlock(),
		ccModesBlock(),
		ccBasisBlock(),
		ccAdsorbBlock(),
	}
}

// ccSVG is a drawing surface; the compchem modules draw into it.
func ccSVG(name, viewBox, label, class string) h.Node {
	return h.Svg(h.Data("plot", name), h.ViewBox(viewBox), h.Class("mx-auto block w-full select-none "+class),
		h.Role("img"), h.Aria("label", label))
}

func ccButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func ccPlay() h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "play"),
		hugeicons.PlayIcon(h.Data("icon", "play")), hugeicons.PauseIcon(h.Data("icon", "pause"), h.Hidden()),
		h.Span(h.Data("label", ""), "Run"))
}

func ccLegend(keys ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(keys, func(k [2]string) h.Node { return legendSwatch(k[0], k[1]) }),
	)
}

func ccNote(name string) h.Node {
	return h.P(h.Data("out", name), h.Class("text-xs leading-relaxed text-pretty text-muted-foreground"))
}

func ccGroup(label string, children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-2")}, append([]any{panelLabel(label)}, children...)...)...)
}

func ccGroupRule(label string, children ...any) h.Node {
	return h.Div(append([]any{h.Class("flex flex-col gap-2 border-t pt-4")}, append([]any{panelLabel(label)}, children...)...)...)
}

// ---------------------------------------------------------------- 1

func ccLJBlock() Block {
	return Block{
		Slug:        "lennard-jones",
		Title:       "Lennard-Jones pair potential",
		Description: "V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]: a steep repulsion and a soft attraction, with its minimum −ε at r = 2^(1/6)σ. Two atoms bound in the well vibrate between the turning points of their energy; the period is computed from the integral and the animation integrates the motion, so they agree. Near the bottom the well is a spring of stiffness 57.1 ε/σ²; higher up it softens and the period grows.",
		Tags:        []string{"reduced units", "turning points", "anharmonicity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-lj",
				h.Div(h.Class("flex flex-col gap-2"),
					ccSVG("dimer", "0 0 560 70", "Two atoms vibrating along their bond", "max-w-[640px]"),
					ccSVG("main", "0 0 560 300", "The Lennard-Jones potential and force against distance, with the dimer's energy level", "max-w-[640px]"),
				),
				ccGroup("Potential",
					field("eps", "well depth ε", "ε₀", 1, 0.2, 3, 0.05),
					field("sig", "size σ", "σ₀", 1, 0.7, 1.5, 0.01),
					toggle("cc-lj-force", "force", "Show the force F = −dV/dr", false),
				),
				ccGroupRule("Dimer",
					field("e", "energy E/ε", "", -0.6, -0.99, -0.02, 0.01),
					h.Div(h.Class("flex flex-wrap gap-2"), ccPlay()),
				),
				ccLegend([2]string{"var(--vec-u)", "V(r)"}, [2]string{"var(--vec-j)", "F(r)"}, [2]string{"var(--brand)", "energy E"}),
				readouts([2]string{"r at minimum", "rmin"}, [2]string{"turning points", "turn"}, [2]string{"period", "period"}, [2]string{"harmonic period", "harm"}, [2]string{"for argon", "argon"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 2

func ccMDBlock() Block {
	return Block{
		Slug:        "molecular-dynamics",
		Title:       "Molecular dynamics of a Lennard-Jones fluid",
		Description: "144 atoms in a periodic box, moved by velocity Verlet with a time step of 0.005: half-kick, drift, new forces, half-kick. With the thermostat off the total energy should stay flat, and the plot shows how well it does. The radial distribution function g(r) is averaged as the run goes: sharp split peaks for the solid, a few fading shells for the liquid, almost flat for the gas.",
		Tags:        []string{"velocity Verlet", "periodic boundaries", "g(r)"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-md",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"),
					ccSVG("box", "0 0 300 300", "The simulation box with every atom", "max-w-[360px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-2"),
						ccSVG("energy", "0 0 360 170", "Kinetic, potential and total energy per atom against time", ""),
						ccSVG("gr", "0 0 360 170", "Radial distribution function g(r)", ""),
					),
				),
				ccGroup("State",
					segs("State", [2]string{"liquid", "Liquid"}, [2]string{"solid", "Solid"}, [2]string{"gas", "Gas"}),
					field("T", "temperature T*", "", 0.45, 0.05, 3, 0.05),
					field("rho", "density ρ*", "", 0.75, 0.05, 1, 0.01),
					toggle("cc-md-thermo", "thermo", "Thermostat (Berendsen)", false),
					h.P(h.Class("text-xs text-muted-foreground"), "Each start is equilibrated with the thermostat first; off, the run conserves energy."),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), ccPlay(), ccButton("reset", "Restart", hugeicons.RefreshIcon())),
				ccLegend([2]string{"var(--vec-u)", "kinetic"}, [2]string{"var(--vec-j)", "potential"}, [2]string{"var(--brand)", "total"}),
				readouts([2]string{"time t*", "time"}, [2]string{"temperature", "temp"}, [2]string{"E per atom", "etot"}, [2]string{"energy drift", "drift"}, [2]string{"pressure P*", "press"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 3

func ccMSDBlock() Block {
	return Block{
		Slug:        "diffusion",
		Title:       "Diffusion from the mean squared displacement",
		Description: "Follow each atom without wrapping it back into the box and average how far it has gone. At first the atoms fly freely and the mean squared displacement grows as t²; after a few collisions it grows linearly, and in two dimensions the slope is 4D (Einstein's relation). Heat the liquid and watch the slope, and D, rise.",
		Tags:        []string{"Einstein relation", "ballistic vs diffusive", "unwrapped coordinates"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-msd",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"),
					ccSVG("box", "0 0 300 300", "Paths of six tagged atoms, unwrapped", "max-w-[360px]"),
					ccSVG("msd", "0 0 360 300", "Mean squared displacement against time with the fitted line", ""),
				),
				ccGroup("Liquid",
					field("T", "temperature T*", "", 1.0, 0.45, 2.5, 0.05),
					field("rho", "density ρ*", "", 0.7, 0.3, 0.85, 0.01),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), ccPlay(), ccButton("reset", "Restart clock", hugeicons.RefreshIcon())),
				ccLegend([2]string{"var(--brand)", "MSD"}, [2]string{"var(--vec-u)", "fit 4Dt + c"}, [2]string{"var(--vec-out)", "ballistic 2T t²"}),
				readouts([2]string{"elapsed t*", "time"}, [2]string{"MSD", "msd"}, [2]string{"D*", "D"}, [2]string{"for argon", "argon"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 4

func ccButaneBlock() Block {
	return Block{
		Slug:        "butane",
		Title:       "Butane conformations",
		Description: "Turn the central C–C bond and watch the Newman projection. The torsion energy is a short cosine series fitted exactly through textbook values: anti 0, gauche 3.8, eclipsed H/CH₃ 16 and syn 19 kJ/mol. The Boltzmann factor turns that curve into populations: at room temperature about two molecules in three are anti, and heating fills the gauche wells.",
		Tags:        []string{"Newman projection", "torsion", "Boltzmann populations"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-butane",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"),
					ccSVG("newman", "0 0 260 260", "Newman projection along the central carbon-carbon bond", "max-w-[300px]"),
					ccSVG("main", "0 0 380 300", "Torsion energy and Boltzmann distribution against the dihedral angle", ""),
				),
				ccGroup("Conformation",
					segs("Conformation", [2]string{"180", "Anti"}, [2]string{"60", "Gauche"}, [2]string{"120", "Eclipsed"}, [2]string{"0", "Syn"}),
					field("phi", "dihedral φ", "°", 180, 0, 360, 1),
					h.Div(h.Class("flex flex-wrap gap-2"), ccPlay()),
				),
				ccGroupRule("Thermal",
					field("T", "temperature", "K", 298, 50, 1500, 1),
				),
				ccLegend([2]string{"var(--vec-u)", "V(φ)"}, [2]string{"var(--brand)", "population p(φ)"}),
				readouts([2]string{"V(φ)", "V"}, [2]string{"conformation", "name"}, [2]string{"anti", "anti"}, [2]string{"gauche (both)", "gauche"}, [2]string{"RT", "rt"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 5

func ccMinimiseBlock() Block {
	return Block{
		Slug:        "minimisers",
		Title:       "Geometry optimisation on an energy surface",
		Description: "Müller and Brown's two-dimensional surface (1979) is the standard test for reaction-path methods: three minima and two saddles. Click anywhere to start three optimisers there. Steepest descent zigzags across narrow valleys; conjugate gradients (Polak–Ribière) remember the last direction; BFGS builds an inverse Hessian from the gradients it has seen and usually needs the fewest steps. All three share the same backtracking line search, so the counts compare fairly.",
		Tags:        []string{"steepest descent", "conjugate gradient", "BFGS"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-min",
				ccSVG("main", "0 0 540 480", "Contour map of the Müller–Brown surface with three optimiser paths; click to choose the start", "max-w-[600px] cursor-crosshair"),
				ccGroup("Start",
					h.P(h.Class("text-sm text-muted-foreground"), "Click the map, or focus it and use the arrow keys."),
					h.Div(h.Class("flex flex-wrap gap-2"), ccButton("random", "Random start", hugeicons.DiceIcon())),
				),
				ccLegend([2]string{"var(--vec-j)", "steepest descent"}, [2]string{"var(--vec-u)", "conjugate gradient"}, [2]string{"var(--brand)", "BFGS"}),
				readouts([2]string{"start", "start"}, [2]string{"steepest", "sd"}, [2]string{"conj. grad.", "cg"}, [2]string{"BFGS", "bfgs"}, [2]string{"minimum", "min"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 6

func ccNEBBlock() Block {
	return Block{
		Slug:        "elastic-band",
		Title:       "Reaction path by nudged elastic band",
		Description: "A chain of images joins two minima. Each image feels only the part of the true force across the path, plus springs along it that keep the images evenly spaced: the band slides sideways until it lies on the minimum energy path. Switch on the climbing image and the highest image drops its springs and climbs to the saddle point exactly, giving the barrier (Henkelman, Uberuaga and Jónsson 2000).",
		Tags:        []string{"minimum energy path", "climbing image", "transition state"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-neb",
				h.Div(h.Class("flex flex-col gap-2"),
					ccSVG("main", "0 0 540 480", "The band of images on the Müller–Brown surface", "max-w-[560px]"),
					ccSVG("profile", "0 0 360 260", "Energy along the band against distance along it", "max-w-[460px]"),
				),
				ccGroup("Reaction",
					segs("Reaction", [2]string{"AB", "A → B"}, [2]string{"BC", "B → C"}),
					field("n", "images", "", 11, 5, 25, 1),
					field("k", "spring k", "", 100, 10, 400, 10),
					toggle("cc-neb-climb", "climb", "Climbing image", true),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), ccPlay(), ccButton("reset", "Restart", hugeicons.RefreshIcon())),
				readouts([2]string{"iterations", "iter"}, [2]string{"max force", "fmax"}, [2]string{"highest image", "top"}, [2]string{"barrier", "barrier"}, [2]string{"true saddle", "saddle"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 7

const ccHuckelSource = `import numpy as np

def huckel(bonds, n, electrons):
    A = np.zeros((n, n))
    for i, j in bonds:
        A[i, j] = A[j, i] = 1          # β between bonded carbons
    x, C = np.linalg.eigh(A)           # E = α + xβ, β < 0
    order = np.argsort(-x)             # largest x is lowest energy
    x, C = x[order], C[:, order]
    occ = np.zeros(n)
    occ[: electrons // 2] = 2
    if electrons % 2:
        occ[electrons // 2] = 1
    return x, C, (occ * x).sum()       # E_π = Nα + (Σ nₖxₖ)β`

func ccHuckelBlock() Block {
	return Block{
		Slug:        "huckel",
		Title:       "Hückel molecular orbitals",
		Description: "Simple Hückel theory keeps one p orbital per carbon and two numbers: α on each atom and β between bonded neighbours. The orbitals are then the eigenvectors of the molecule's adjacency matrix, found here by the Jacobi rotation method. Pick a level to draw its orbital: lobe size is the coefficient, colour its sign. Benzene's six electrons fill three bonding orbitals and gain 2β over three separate double bonds; cyclobutadiene's four leave two electrons unpaired in a degenerate pair.",
		Tags:        []string{"eigenvectors", "4n + 2", "delocalisation energy"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"),
				plotPanel("cc-huckel",
					h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"),
						ccSVG("mol", "0 0 380 300", "The molecule with the selected orbital drawn as lobes", ""),
						ccSVG("levels", "0 0 240 300", "Energy levels in units of β, with their electrons; click a level to draw it", "max-w-[280px] cursor-pointer"),
					),
					ccGroup("Molecule",
						segs("Molecule", [2]string{"benzene", "Benzene"}, [2]string{"butadiene", "Butadiene"}, [2]string{"allyl", "Allyl"}, [2]string{"ethylene", "Ethylene"},
							[2]string{"hexatriene", "Hexatriene"}, [2]string{"cyclobutadiene", "Cyclobutadiene"}, [2]string{"cp", "Cyclopentadienyl"}, [2]string{"naphthalene", "Naphthalene"}),
						field("q", "charge", "", 0, -2, 2, 1),
					),
					ccGroupRule("Orbital",
						h.P(h.Class("text-sm text-muted-foreground"), "Click a level, or use ↑ ↓ with the diagram focused."),
					),
					ccLegend([2]string{"var(--vec-i)", "positive lobe"}, [2]string{"var(--vec-j)", "negative lobe"}),
					readouts([2]string{"orbital", "orb"}, [2]string{"π electrons", "ne"}, [2]string{"E_π", "epi"}, [2]string{"delocalisation", "deloc"}, [2]string{"HOMO–LUMO gap", "gap"}, [2]string{"Hückel rule", "rule"}),
					ccNote("note"),
				),
				codeBlock("huckel.py", ccHuckelSource, []int{5, 6}),
			)
		},
	}
}

// ---------------------------------------------------------------- 8

func ccModesBlock() Block {
	return Block{
		Slug:        "normal-modes",
		Title:       "Normal modes of a triatomic",
		Description: "Two bond springs and one angle spring: a valence force field. The page builds the Hessian by finite differences, divides by the square roots of the masses and diagonalises it; three eigenvalues are zero (two translations and the rotation in the plane) and the other three are the vibrations. A mode absorbs infrared light only if it changes the dipole moment, which the partial charges decide: CO₂'s symmetric stretch is invisible.",
		Tags:        []string{"mass-weighted Hessian", "wavenumbers", "IR selection rule"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-modes",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					ccSVG("mol", "0 0 320 240", "The molecule moving in the selected normal mode", "max-w-[380px]"),
					ccSVG("spec", "0 0 360 240", "Stick spectrum: wavenumber of each mode with its infrared intensity", "cursor-pointer"),
				),
				ccGroup("Molecule",
					segs("Molecule", [2]string{"co2", "CO₂"}, [2]string{"h2o", "H₂O"}),
					segs("Mode", [2]string{"0", "Mode 1"}, [2]string{"1", "Mode 2"}, [2]string{"2", "Mode 3"}),
				),
				ccGroupRule("Force field",
					field("k", "bond k", "aJ/Å²", 15.5, 2, 25, 0.1),
					field("kth", "bend kθ", "aJ/rad²", 0.77, 0.1, 2, 0.01),
					field("amp", "amplitude", "", 1, 0, 2, 0.1),
				),
				readouts([2]string{"mode", "name"}, [2]string{"wavenumber", "nu"}, [2]string{"observed", "obs"}, [2]string{"infrared", "ir"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 9

func ccBasisBlock() Block {
	return Block{
		Slug:        "gaussian-basis",
		Title:       "Gaussian basis sets for hydrogen",
		Description: "Quantum chemistry codes build orbitals from Gaussians e^(−αr²) because their integrals have closed forms, even though the true 1s orbital e^(−r) has a cusp at the nucleus that no Gaussian has. The page optimises every exponent for n = 1 to 6 Gaussians and solves the generalised eigenproblem Hc = ESc. The variational principle keeps every energy above the exact −0.5 hartree, and each added Gaussian gets closer.",
		Tags:        []string{"variational principle", "STO-3G", "generalised eigenproblem"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-basis",
				h.Div(h.Class("grid gap-3 md:grid-cols-2"),
					ccSVG("psi", "0 0 360 260", "The radial function of the expansion against the exact 1s orbital", ""),
					ccSVG("conv", "0 0 360 260", "Energy error against the number of Gaussians, log scale", ""),
				),
				ccGroup("Basis",
					segs("Basis", [2]string{"1", "1"}, [2]string{"2", "2"}, [2]string{"3", "3"}, [2]string{"4", "4"}, [2]string{"5", "5"}, [2]string{"6", "6"}, [2]string{"sto3g", "STO-3G"}),
					toggle("cc-basis-r2", "r2", "Plot r²ψ² instead of ψ", false),
				),
				ccLegend([2]string{"var(--vec-u)", "exact e^(−r)/√π"}, [2]string{"var(--brand)", "Gaussian expansion"}, [2]string{"var(--vec-j)", "each Gaussian"}),
				readouts([2]string{"energy", "E"}, [2]string{"error", "err"}, [2]string{"exponents α", "alpha"}, [2]string{"coefficients", "coef"}),
				ccNote("note"),
			)
		},
	}
}

// ---------------------------------------------------------------- 10

func ccAdsorbBlock() Block {
	return Block{
		Slug:        "adsorption",
		Title:       "Adsorption isotherm by Monte Carlo",
		Description: "Gas molecules land on a 24 × 24 grid of sites and leave again. Each Metropolis step picks a site and tries to fill or empty it, accepting with the Boltzmann factor of the change at the gas pressure (the grand canonical ensemble). With no forces between neighbours the coverage must follow Langmuir's isotherm θ = KP/(1 + KP), and the simulation does; make neighbours attract and the layer condenses suddenly, which Langmuir cannot describe.",
		Tags:        []string{"Metropolis", "grand canonical", "Langmuir"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cc-ads",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"),
					ccSVG("grid", "0 0 288 288", "The surface: filled sites are adsorbed molecules", "max-w-[320px]"),
					ccSVG("iso", "0 0 360 288", "Coverage against pressure: simulation points and the Langmuir curve", ""),
				),
				ccGroup("Conditions",
					field("lp", "pressure log₁₀(KP)", "", 0, -3, 3, 0.05),
					field("J", "neighbour energy J", "kT", 0, -2, 1, 0.05),
				),
				h.Div(h.Class("flex flex-wrap gap-2"), ccPlay(), ccButton("sweep", "Sweep isotherm", hugeicons.ChartLineData01Icon()), ccButton("clear", "Clear points", hugeicons.Delete02Icon())),
				ccLegend([2]string{"var(--vec-u)", "Langmuir"}, [2]string{"var(--brand)", "simulation"}),
				readouts([2]string{"coverage θ", "theta"}, [2]string{"Langmuir θ", "lang"}, [2]string{"acceptance", "acc"}, [2]string{"sweeps", "sweeps"}),
				ccNote("note"),
			)
		},
	}
}
