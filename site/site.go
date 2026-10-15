// Package site is the block gallery of the linear algebra platform: each
// block is a Go function that renders one piece of a lesson (a matrix, a
// code editor, a transformation playground, ...), shown in a framed preview.
package site

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"

	"github.com/alexisbcz/components/ui/runtime"
	h "github.com/alexisbcz/libhtml"
	"github.com/alexisbcz/libhtml/secure"
)

//go:embed static
var static embed.FS

// Block is one entry of the gallery.
type Block struct {
	Slug        string
	Title       string
	Description string
	Tags        []string
	Render      func() h.Node
	// Wide blocks take the full width of the preview instead of being
	// centered at a reading width.
	Wide bool
}

// Collection is one subject's set of blocks, served at its own path.
type Collection struct {
	Slug, Name, Path string
	Title, Lede      string
	Blocks           func() []Block
}

// Collections lists the subjects, in header order.
func Collections() []Collection {
	return []Collection{
		{Slug: "linalg", Name: "Linear Algebra", Path: "/",
			Title:  "The blocks of an interactive linear algebra course",
			Lede:   "Every block is a Go function rendered on the server with libhtml and the shadcn/ui components for Go. A few kilobytes of vanilla JavaScript make the interactive ones move. No Node.js, no bundler.",
			Blocks: Blocks},
		{Slug: "neuro", Name: "Neuroscience", Path: "/neuro",
			Title:  "The blocks of an interactive neuroscience course",
			Lede:   "Science taught with live models, not pictures of them: the action potential is the Hodgkin–Huxley equations integrated in your browser, membrane potentials come from Nernst and Goldman, spike trains from a Poisson process.",
			Blocks: NeuroBlocks},
		{Slug: "ml", Name: "Machine Learning", Path: "/ml",
			Title:  "The blocks of an interactive machine learning course",
			Lede:   "Models that train while you watch: a neural network fitting its decision boundary, gradient descent crawling down a loss surface, polynomials overfitting a sine wave. Every curve is computed in the browser or in Go, from the same equations a textbook would print.",
			Blocks: MLBlocks},
		{Slug: "history", Name: "History", Path: "/history",
			Title:  "The blocks of an interactive history course",
			Lede:   "History of science and mathematics told with its own evidence: dated events on a zoomable timeline, overlapping lives, a primary source with glosses, and the route a single book took from Alexandria to the printing press.",
			Blocks: HistoryBlocks},
		{Slug: "physics", Name: "Classical Physics", Path: "/physics",
			Title:  "The blocks of an interactive classical physics course",
			Lede:   "Mechanics, waves and optics as running simulations: trajectories integrated with RK4, orbits with a symplectic integrator that keeps energy constant, collisions that conserve momentum to the last digit. Every number on screen comes from the equations of motion.",
			Blocks: PhysicsBlocks},
		{Slug: "quantum", Name: "Quantum Physics", Path: "/quantum",
			Title:  "The blocks of an interactive quantum physics course",
			Lede:   "Quantum mechanics computed, not cartooned: wave packets evolved with the Schrödinger equation, eigenstates from their exact formulas, measurements sampled with the Born rule, spectra from Rydberg and Planck. Units and approximations are stated on every block.",
			Blocks: QuantumBlocks},
		{Slug: "thermo", Name: "Thermodynamics", Path: "/thermo",
			Title:  "The blocks of an interactive thermodynamics course",
			Lede:   "Heat, work and entropy with the bookkeeping shown: cycles whose first-law table closes to zero, a rod solving the heat equation, multiplicities counted exactly, water's phase boundaries from the IAPWS correlations, and a Stirling engine you can watch turn.",
			Blocks: ThermoBlocks},
		{Slug: "sociology", Name: "Sociology", Path: "/sociology",
			Title:  "The blocks of an interactive sociology course",
			Lede:   "Society as systems you can run: Schelling's segregation model, small-world networks, centrality, inequality curves, diffusion, cooperation tournaments and sampling bias. Simulations use synthetic populations; real sources are cited by author and year.",
			Blocks: SociologyBlocks},
		{Slug: "geology", Name: "Geology", Path: "/geology",
			Title:  "The blocks of an interactive geology course",
			Lede:   "The Earth read from its own records: a seismograph writing P and S waves, the ICS time scale to the nearest hundred thousand years, ages from radioactive decay, epicentres from three circles, and cross-sections to read like a field geologist.",
			Blocks: GeologyBlocks},
		{Slug: "chemistry", Name: "Chemistry", Path: "/chemistry",
			Title:  "The blocks of an interactive chemistry course",
			Lede:   "Chemistry with the arithmetic done properly: a periodic table rendered from IUPAC data, equations balanced exactly in rational arithmetic, pH solved from the charge balance, equilibria solved for the extent of reaction, and molecules you can turn in 3D.",
			Blocks: ChemistryBlocks},
		{Slug: "stats", Name: "Statistics", Path: "/stats",
			Title:  "The blocks of an interactive statistics course",
			Lede:   "Uncertainty made visible: distributions with exact CDFs, sample means piling into a bell curve, a hundred confidence intervals at once, power from the noncentral t, and Bayes counted in people. Every number is computed live from seeded samples or published data.",
			Blocks: StatsBlocks},
		{Slug: "calculus", Name: "Calculus", Path: "/calculus",
			Title:  "The blocks of an interactive calculus course",
			Lede:   "Limits, derivatives and integrals as things you can push on: an ε–δ band that finds its own δ, secants collapsing into tangents, quadrature rules with their error orders on a log–log plot, Taylor polynomials that fail outside their radius, and Newton's method doubling its digits.",
			Blocks: CalculusBlocks},
		{Slug: "probability", Name: "Probability", Path: "/probability",
			Title:  "The blocks of an interactive probability course",
			Lede:   "Chance, computed exactly and then checked by simulation: events as areas, the birthday problem, Monty Hall, gambler's ruin, the law of large numbers, a Galton board, a Markov chain and the exact distribution of dice sums.",
			Blocks: ProbabilityBlocks},
		{Slug: "crypto", Name: "Number Theory & Cryptography", Path: "/crypto",
			Title:  "The blocks of an interactive number theory and cryptography course",
			Lede:   "Primes, remainders and the secrets built on them: a sieve you can run, Euclid's algorithm with Bézout's coefficients, square-and-multiply in BigInt, RSA and Diffie–Hellman end to end with toy numbers, frequency analysis against Caesar, and SHA-256 from your browser's Web Crypto.",
			Blocks: CryptoBlocks},
		{Slug: "logic", Name: "Logic", Path: "/logic",
			Title:  "The blocks of an interactive logic course",
			Lede:   "Reasoning made checkable: truth tables from any formula you type, a full adder built from gates, valid forms against fallacies with their counterexamples, syllogisms on Venn diagrams, quantifiers over a small world, and a proof by induction step by step.",
			Blocks: LogicBlocks},
		{Slug: "biology", Name: "Biology", Path: "/biology",
			Title:  "The blocks of an interactive biology course",
			Lede:   "Life from the cell up: organelles you can point at, DNA translated with the standard genetic code, Mendel's ratios counted in Punnett squares, allele frequencies drifting and selected, predators chasing prey, and enzymes slowed by inhibitors. Every curve is computed from its equation.",
			Blocks: BiologyBlocks},
		{Slug: "epidemiology", Name: "Epidemiology", Path: "/epidemiology",
			Title:  "The blocks of an interactive epidemiology course",
			Lede:   "How diseases spread and how we measure them: SIR and SEIR models with herd immunity, an outbreak simulated person by person, flattening the curve against hospital capacity, risk and odds ratios with confidence intervals, screening biases, and John Snow's pump.",
			Blocks: EpidemiologyBlocks},
		{Slug: "paleo", Name: "Paleoanthropology", Path: "/paleo",
			Title:  "The blocks of an interactive paleoanthropology course",
			Lede:   "Seven million years of human evolution with the uncertainty left in: species as dated ranges with fuzzy ends, brains measured in cubic centimetres, dispersals step by step, the methods that date the fossils, and the Neanderthal DNA we still carry. Debated points are marked as debated.",
			Blocks: PaleoBlocks},
		{Slug: "geometry", Name: "Geometry", Path: "/geometry",
			Title:  "The blocks of an interactive geometry course",
			Lede:   "Figures you can push on while the theorems hold: triangle centres on the Euler line, Pythagoras proved by rearrangement, the unit circle with exact values, circle theorems, Archimedes squeezing π, conics from a focus and a line, wallpaper groups, curved triangles and the Platonic solids.",
			Blocks: GeometryBlocks},
		{Slug: "physiology", Name: "Anatomy & Physiology", Path: "/physiology",
			Title:  "The blocks of an interactive anatomy and physiology course",
			Lede:   "The body as a set of working systems: a heartbeat from a pressure–volume model, an ECG you can measure, flow that scales with the fourth power of a vessel's radius, lung volumes, hemoglobin's oxygen curve, the nephron, sliding filaments, a glucose feedback loop and the knee-jerk reflex. Typical textbook values, labelled as such; not medical advice.",
			Blocks: PhysiologyBlocks},
		{Slug: "economics", Name: "Economics", Path: "/economics",
			Title:  "The blocks of an interactive economics course",
			Lede:   "Economic models you can push on: supply and demand with surplus and deadweight loss as areas, elasticity, monopoly pricing, Nash equilibria solved exactly, compounding and inflation, Ricardo's comparative advantage, the Solow growth model and the spending multiplier. Models, clearly labelled, not forecasts.",
			Blocks: EconomicsBlocks},
		{Slug: "geography", Name: "Geography & Demography", Path: "/geography",
			Title:  "The blocks of an interactive geography and demography course",
			Lede:   "The Earth measured and mapped: projections with their distortion made visible, great-circle routes, longitude and solar time, contour maps and profiles, coordinates, population growth, ageing and the gravity model of spatial interaction.",
			Blocks: GeographyBlocks},
		{Slug: "discrete", Name: "Discrete Mathematics", Path: "/discrete",
			Title:  "The blocks of an interactive discrete mathematics course",
			Lede:   "Graphs, counting and recursion worked out exactly: a graph editor that answers Euler's Königsberg question, colourings checked by backtracking, binomial coefficients as big integers, Hanoi's 2ⁿ − 1 moves played in order, and spanning trees built edge by edge.",
			Blocks: DiscreteBlocks},
		{Slug: "algorithms", Name: "Algorithms & Data Structures", Path: "/algorithms",
			Title:  "The blocks of an interactive algorithms course",
			Lede:   "Algorithms you can watch and count: five sorts with every comparison tallied, BFS, Dijkstra and A* spreading across a grid you draw, hash tables filling up, trees keeping their invariants, and a dynamic-programming table filled cell by cell.",
			Blocks: AlgorithmsBlocks},
		{Slug: "linguistics", Name: "Linguistics", Path: "/linguistics",
			Title:  "The blocks of an interactive linguistics course",
			Lede:   "Language taken apart: the IPA chart, vowel formants you can hear in a rough synthesis, syntax trees drawn from bracket notation, words cut into morphemes, Zipf's law on any text, and the regular sound changes that tie English father to Latin pater.",
			Blocks: LinguisticsBlocks},
		{Slug: "music", Name: "Music Theory & Acoustics", Path: "/music",
			Title:  "The blocks of an interactive music theory course",
			Lede:   "Music as sound and as system: a keyboard that shows every frequency, just against equal intervals, timbre built from harmonics, the circle of fifths, correctly spelled modes, chords named as you play them, strings and beats, and a sequencer timed on the audio clock.",
			Blocks: MusicBlocks},
		{Slug: "psychology", Name: "Psychology & Cognitive Science", Path: "/psychology",
			Title:  "The blocks of an interactive psychology course",
			Lede:   "Experiments run on you, in this page: your reaction times against Hick's law, your Stroop interference, your Müller-Lyer bias and your serial position curve, next to signal detection, the Rescorla–Wagner model of learning, and the classic biases with an honest record of which ones replicated.",
			Blocks: PsychologyBlocks},
		{Slug: "philosophy", Name: "Philosophy", Path: "/philosophy",
			Title:  "The blocks of an interactive philosophy course",
			Lede:   "Arguments taken seriously: validity kept apart from soundness, thought experiments you answer before reading the positions, four ethical theories on the same dilemma, who read whom from Socrates to Rawls, informal fallacies, Zeno's paradox summed, and Descartes' cogito read closely.",
			Blocks: PhilosophyBlocks},
		{Slug: "astronomy", Name: "Astronomy & Astrophysics", Path: "/astronomy",
			Title:  "The blocks of an interactive astronomy course",
			Lede:   "The sky worked out from geometry and light: real planetary distances, Moon phases from the Sun–Earth–Moon angle, day length from the Sun's declination, a sky dome for any latitude, the Hertzsprung–Russell diagram, parallax, transit light curves and Hubble's law.",
			Blocks: AstronomyBlocks},
		{Slug: "climate", Name: "Climate & Meteorology", Path: "/climate",
			Title:  "The blocks of an interactive climate and meteorology course",
			Lede:   "The climate system with its bookkeeping shown: Earth's energy balance and the greenhouse effect, CO₂ forcing against the IPCC sensitivity range, the carbon budget, the standard atmosphere, humidity and dew point, global circulation, and a weather station's meteogram. Sources and approximations are named on every block.",
			Blocks: ClimateBlocks},
		{Slug: "em", Name: "Electromagnetism & Circuits", Path: "/em",
			Title:  "The blocks of an interactive electromagnetism course",
			Lede:   "Fields, circuits and light computed from the SI laws: field lines and equipotentials of charges you drag, Coulomb's inverse square, a circuit solved by Kirchhoff's laws, RC charging and RLC resonance, the magnetic field of a wire, Faraday induction and the electromagnetic spectrum.",
			Blocks: EMBlocks},
		{Slug: "arch", Name: "Computer Architecture", Path: "/arch",
			Title:  "The blocks of an interactive computer architecture course",
			Lede:   "From bits to a working processor: two's complement and flags, a ripple-carry adder with gate delays, a tiny CPU stepping through fetch, decode and execute, IEEE 754 floats down to the exact bit, the memory hierarchy, a cache simulator, pipeline hazards and Amdahl's law.",
			Blocks: ArchBlocks},
		{Slug: "genetics", Name: "Genetics", Path: "/genetics",
			Title:  "The blocks of an interactive genetics course",
			Lede:   "Heredity worked out with the tools geneticists use: pedigrees tested against every mode of inheritance, recombination and gene maps, the χ² test on Mendel's peas, the replication fork, PCR cycle by cycle, restriction digests on a gel, Cas9 targets on both strands, the lac operon, sequence alignment and a genome-wide scan.",
			Blocks: GeneticsBlocks},
		{Slug: "argumentation", Name: "Argumentation Tools", Path: "/argumentation",
			Title:  "The blocks of an interactive argumentation course",
			Lede:   "Tools for building and testing arguments, not lectures about them: a Toulmin builder, an argument map with weighted branches, a steelman workshop, an evidence grader, a Bayesian belief updater, a debate flow sheet with timer, claim–evidence–reasoning paragraphs, a decision matrix with sensitivity analysis, Socratic questions and a Rogerian template.",
			Blocks: ArgumentationBlocks},
		{Slug: "novel", Name: "Novel Engineering", Path: "/novel",
			Title:  "The blocks of an interactive novel engineering course",
			Lede:   "Tools for building a novel the way engineers build anything: structures laid on your word count, character arcs from want to need, Swain's scene and sequel chain, a tension graph, a deadline planner, prose and dialogue checkers, a POV and tense audit, the Snowflake method, and Tufts' Novel Engineering design brief for the classroom.",
			Blocks: NovelBlocks},
		{Slug: "rocketry", Name: "Rocket Engineering", Path: "/rocketry",
			Title:  "The blocks of an interactive rocket engineering course",
			Lede:   "Rocketry from the equations up: an engine on a test stand whose thrust follows Cf·Pc·At, the rocket equation and why rockets have stages, nozzle expansion with altitude, Hohmann transfers and orbits from burnout, a two-stage gravity-turn ascent with max-Q, thrust-to-weight, and a ballistic re-entry.",
			Blocks: RocketryBlocks},
		{Slug: "materials", Name: "Materials Science", Path: "/materials",
			Title:  "The blocks of an interactive materials science course",
			Lede:   "Why materials behave as they do, from the atoms up: a testing machine pulling a steel bar to fracture, stress–strain curves for five materials, crystal structures with their packing and density, Miller indices into Bragg's law, the iron–carbon diagram with the lever rule, carburising by diffusion, dislocations and Hall–Petch, Ashby's selection chart and fatigue life.",
			Blocks: MaterialsBlocks},
		{Slug: "automotive", Name: "Automotive Engineering", Path: "/automotive",
			Title:  "The blocks of an interactive automotive engineering course",
			Lede:   "How a car works, part by part: a four-stroke engine you can turn by hand, its cycle and power from bore and stroke, the traction diagram and a 0–100 km/h run, an open differential in a turn, Ackermann steering, stopping distances, a quarter-car suspension and the energy a kilometre costs an electric and a petrol car.",
			Blocks: AutomotiveBlocks},
		{Slug: "languages", Name: "Language Learning", Path: "/languages",
			Title:  "The blocks of an interactive language learning course",
			Lede:   "Tools for learning French that you would use every week: an SM-2 spaced-repetition deck, eighteen verbs in six tenses, gender drills with the exceptions that matter, a La Fontaine cloze, accents and French spacing, minimal pairs, word-frequency coverage on any text, interlinear glossing, numbers in twenties, and a CEFR study plan.",
			Blocks: LanguagesBlocks},
		{Slug: "signals", Name: "Signal Processing", Path: "/signals",
			Title:  "The blocks of an interactive signal processing course",
			Lede:   "Signals you can sample, transform and filter: aliasing you can hear, a DFT with windows and leakage, Fourier series and the Gibbs overshoot, convolution as flip-and-slide, FIR and biquad filters with their responses, a z-plane you drag, a spectrogram's time–frequency trade-off, quantization noise, and 2D image kernels.",
			Blocks: SignalsBlocks},
		{Slug: "graphics", Name: "Computer Graphics", Path: "/graphics",
			Title:  "The blocks of an interactive computer graphics course",
			Lede:   "How pictures are made from numbers: Bézier curves by de Casteljau's construction, triangles rasterized with edge functions, Bresenham's integer lines, the model–view–projection pipeline, a depth buffer against the painter's algorithm, Lambert and Phong shading, a small ray tracer, texture filtering and mipmaps, colour spaces from sRGB to OKLCH, and signed distance fields.",
			Blocks: GraphicsBlocks},
		{Slug: "plt", Name: "Programming Languages & Compilers", Path: "/plt",
			Title:  "The blocks of an interactive programming languages course",
			Lede:   "A language implementation you can step through: regular expressions compiled to automata, a lexer, a Pratt parser that explains precedence, a resolver for lexical scope, a tree-walking interpreter with closures, a bytecode compiler and stack VM, Hindley–Milner type inference, lambda-calculus reduction, two garbage collectors and an LL(1) table builder.",
			Blocks: PltBlocks},
		{Slug: "platform", Name: "Platform Components", Path: "/platform",
			Title:  "The blocks of the learning platform's interface",
			Lede:   "The product around the lessons: a ⌘K palette that searches every block of every subject, a learner dashboard, a streak calendar, a lesson player with a synced transcript, highlights and notes, a discussion thread, a weekly league, achievements announced by toasts, a printable certificate with a verification code, an onboarding tour, plans and pricing, and settings.",
			Blocks: PlatformBlocks},
		{Slug: "finance", Name: "Finance & Accounting", Path: "/finance",
			Title:  "The blocks of an interactive finance and accounting course",
			Lede:   "The arithmetic of money, computed exactly: double-entry bookkeeping to a trial balance, three statements that move together, break-even, NPV and IRR, loan amortization, bond duration and convexity, Black–Scholes with its Greeks, option strategies, binomial trees and the efficient frontier. Educational only: not financial advice.",
			Blocks: FinanceBlocks},
		{Slug: "networking", Name: "Networking & the Web", Path: "/networking",
			Title:  "The blocks of an interactive networking course",
			Lede:   "How data actually crosses the internet, computed in the page: headers added layer by layer, the TCP handshake with real sequence numbers, Reno's congestion window, subnets bit by bit, link-state against distance-vector routing, a DNS lookup with its cache, the TLS 1.3 handshake, raw HTTP with ETags, latency against bandwidth, and the CSS box model and flexbox.",
			Blocks: NetworkingBlocks},
		{Slug: "control", Name: "Control & Robotics", Path: "/control",
			Title:  "The blocks of an interactive control and robotics course",
			Lede:   "Feedback and machines that move, computed live: a robot arm solving its own inverse kinematics, PID tuning with actuator windup, an inverted pendulum held up by LQR, Bode plots with their margins, root locus, controllability, two-link kinematics, motion planning with RRT, a Kalman filter tracking a noisy cart, and wheel odometry that drifts.",
			Blocks: ControlBlocks},
		{Slug: "energy", Name: "Energy Systems", Path: "/energy",
			Title:  "The blocks of an interactive energy systems course",
			Lede:   "How energy is caught, stored and moved, from the physics up: a wind turbine whose pitch and power follow the wind, the Betz limit, a solar module's I–V curve, panel tilt over a clear day, batteries and Peukert's law, grid frequency after a plant trips, energy densities on log axes, conversion chains, heat pump COP, levelized cost and the storage that intermittency demands.",
			Blocks: EnergyBlocks},
		{Slug: "os", Name: "Operating Systems", Path: "/os",
			Title:  "The blocks of an interactive operating systems course",
			Lede:   "What the kernel does between your program and the hardware: six CPU schedulers on one workload, the five process states, address translation through a TLB, page replacement with Belady's anomaly, a race condition you interleave by hand, the banker's algorithm, dining philosophers, inode pointers, disk scheduling, heap fragmentation and a read() traced across the user/kernel boundary.",
			Blocks: OsBlocks},
		{Slug: "databases", Name: "Databases", Path: "/databases",
			Title:  "The blocks of an interactive databases course",
			Lede:   "How data is stored, queried and kept safe: a SQL engine whose logical plan you can read, joins row by row, normalization justified by functional dependencies, a B+ tree that splits as you insert, isolation anomalies, crash recovery from the log, join ordering, ER diagrams and quorums.",
			Blocks: DatabasesBlocks},
		{Slug: "fluids", Name: "Fluid Mechanics", Path: "/fluids",
			Title:  "The blocks of an interactive fluid mechanics course",
			Lede:   "How liquids and gases push and flow: pressure with depth and Pascal's press, buoyancy and a barge that capsizes, continuity and Bernoulli in a Venturi, pipe friction on a Moody chart, superposed potential flows with Kutta–Joukowski lift, a real-time smoke solver, drag and terminal speed, the boundary layer, the hydraulic jump and Buckingham's π theorem.",
			Blocks: FluidsBlocks},
		{Slug: "infotheory", Name: "Information Theory & Compression", Path: "/infotheory",
			Title:  "The blocks of an interactive information theory course",
			Lede:   "Information measured in bits and squeezed out of data: entropy and surprisal, Huffman trees built merge by merge, arithmetic coding with exact intervals, LZ77 and the Burrows–Wheeler transform, channel capacity with a Hamming code you can corrupt, CRC-32, mutual information, JPEG-style DCT quantization, and why a pattern compresses but noise does not.",
			Blocks: InfotheoryBlocks},
		{Slug: "chaos", Name: "Chaos & Fractals", Path: "/chaos",
			Title:  "The blocks of an interactive chaos and fractals course",
			Lede:   "Simple rules, endless structure: the logistic map's cobwebs and bifurcations with Feigenbaum's constant, the Lorenz attractor and a double pendulum pulling nearby starts apart, the Mandelbrot set beside its Julia sets, Hénon and Rössler, the chaos game, the Koch snowflake measured by box counting, L-system plants and cellular automata.",
			Blocks: ChaosBlocks},
		{Slug: "nuclear", Name: "Nuclear & Particle Physics", Path: "/nuclear",
			Title:  "The blocks of an interactive nuclear and particle physics course",
			Lede:   "Inside the nucleus and beyond: a chart of nuclides with their decay modes, the binding-energy curve from the semi-empirical mass formula, mass defects and Q-values from real atomic masses, decay one atom at a time and in Bateman chains, fission and criticality, fusion against the Coulomb barrier, shielding, dose in gray and sievert, and the Standard Model with a hadron builder.",
			Blocks: NuclearBlocks},
		{Slug: "aerospace", Name: "Aerospace & Flight", Path: "/aerospace",
			Title:  "The blocks of an interactive aerospace course",
			Lede:   "How aircraft fly, from a benchtop wind tunnel whose balance weighs a wing's lift and drag: the four forces and the glide, the standard atmosphere and the lift equation, lift curves and drag polars, NACA sections drawn from their formulas, pitot-static airspeed, the V–n envelope, turning flight, Breguet range and rotors in hover.",
			Blocks: AerospaceBlocks},
		{Slug: "civil", Name: "Civil & Structural Engineering", Path: "/civil",
			Title:  "The blocks of an interactive civil engineering course",
			Lede:   "How structures carry load, starting from a model truss bridge on a test bench with its bars tinted by force: the method of joints as a linear system, shear and moment diagrams with the elastic curve, cross-sections and bending stress, Euler buckling, catenary arches, a reinforced concrete beam, load paths with Eurocode factors, footbridge resonance and a gravity dam.",
			Blocks: CivilBlocks},
		{Slug: "optics", Name: "Optics & Photography", Path: "/optics",
			Title:  "The blocks of an interactive optics and photography course",
			Lede:   "Light, lenses and the camera, from a mirrorless camera cut open on a tripod: the exposure triangle in stops, depth of field from the thin-lens model, ray diagrams for lenses and mirrors, telescopes and microscopes, the Airy disk against pixel pitch, angle of view and crop factor, additive and subtractive color, Malus's law and dispersion in a prism.",
			Blocks: OpticsBlocks},
		{Slug: "politics", Name: "Voting & Political Science", Path: "/politics",
			Title:  "The blocks of an interactive voting and political science course",
			Lede:   "How rules turn votes into outcomes, with synthetic voters only: one ballot profile counted eight ways, Condorcet cycles, Arrow's conditions put to the test, spatial voting and the median voter, strategic ballots, apportionment in exact arithmetic with the Alabama paradox, districts you draw yourself with the efficiency gap, polling margins and a generic legislative process.",
			Blocks: PoliticsBlocks},
		{Slug: "pharmacology", Name: "Pharmacology", Path: "/pharmacology",
			Title:  "The blocks of an interactive pharmacology course",
			Lede:   "What the body does to a drug and what the drug does to the body, with a generic drug and illustrative numbers: one- and two-compartment kinetics, oral absorption, repeated dosing to steady state, infusions and loading doses, the therapeutic index, receptor occupancy, interactions through clearance, saturable elimination and variability across a population. Educational only, not medical advice: never use these models for dosing.",
			Blocks: PharmacologyBlocks},
		{Slug: "complex", Name: "Complex Analysis", Path: "/complex",
			Title:  "The blocks of an interactive complex analysis course",
			Lede:   "Numbers with a direction: complex arithmetic as rotate-and-scale, Euler's formula on the unit circle, roots of unity and Durand–Kerner, domain colouring of zeros and poles, conformal maps from z² to the Joukowski airfoil, contour integrals checked against the residue theorem, and the Riemann sphere.",
			Blocks: ComplexBlocks},
		{Slug: "algebra", Name: "Abstract Algebra", Path: "/algebra",
			Title:  "The blocks of an interactive abstract algebra course",
			Lede:   "Structure from a single operation: Cayley tables of cyclic, dihedral, symmetric and quaternion groups, symmetries of a polygon, permutations in cycle notation, cosets and quotient groups, Burnside's lemma counting necklaces, rings and finite fields, the parity invariant of the 15 puzzle, and polynomials over ℤₚ.",
			Blocks: AlgebraBlocks},
	}
}

// Blocks lists the linear algebra gallery in display order.
func Blocks() []Block {
	return []Block{
		courseShellBlock(),
		lessonHeaderBlock(),
		courseOutlineBlock(),
		theoremBlock(),
		matrixBlock(),
		codeBlockBlock(),
		editorBlock(),
		testResultsBlock(),
		diffBlock(),
		transformBlock(),
		dotProductBlock(),
		eliminationBlock(),
		quizBlock(),
		matrixInputBlock(),
		hintsBlock(),
		anatomyBlock(),
	}
}

// Handler serves the gallery, its static files and the components'
// client runtime, behind the security headers (strict CSP with a nonce).
func Handler() http.Handler {
	assets, _ := fs.Sub(static, "static")
	mux := http.NewServeMux()
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(assets)))
	mux.Handle(runtime.Prefix, runtime.Handler())
	mux.HandleFunc("GET /subjects", func(w http.ResponseWriter, r *http.Request) {
		_ = h.WriteHTTP(w, http.StatusOK, catalog(r))
	})
	for _, c := range Collections() {
		mux.HandleFunc("GET "+c.Path+h.Ternary(c.Path == "/", "{$}", ""), func(w http.ResponseWriter, r *http.Request) {
			_ = h.WriteHTTP(w, http.StatusOK, gallery(r, c))
		})
	}
	return secure.Headers(secure.Config{})(mux)
}

// RenderPages renders every collection and the catalog outside a
// request, keyed by name, for the stylesheet generator. Pages are kept
// apart: one huge file loses classes in Tailwind's scanner.
func RenderPages() (map[string]string, error) {
	pages := map[string]string{}
	r0, _ := http.NewRequest("GET", "/subjects", nil)
	s, err := h.RenderString(catalog(r0))
	if err != nil {
		return nil, err
	}
	pages["subjects"] = s
	for _, c := range Collections() {
		r, _ := http.NewRequest("GET", c.Path, nil)
		s, err := h.RenderString(gallery(r, c))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", c.Slug, err)
		}
		pages[c.Slug] = s
	}
	return pages, nil
}
