package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// QcomputingBlocks lists the quantum computing gallery in display order.
// Every block runs the same exact state-vector simulator
// (static/js/qcomputing-sim.js): complex amplitudes in doubles, gates as
// 2×2 matrices applied with optional controls.
func QcomputingBlocks() []Block {
	return []Block{
		qcCircuitBlock(),
		qcBellBlock(),
		qcTeleportBlock(),
		qcDenseBlock(),
		qcDeutschBlock(),
		qcGroverBlock(),
		qcQFTBlock(),
		qcShorBlock(),
		qcCloningBlock(),
		qcNoiseBlock(),
	}
}

func qcAction(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// qcSegs is a segmented control whose active option is given by value.
func qcSegs(label, active string, opts ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", label),
		h.Map(opts, func(o [2]string) h.Node { return segButton(o[0], o[1], o[0] == active) }),
	)
}

// qcState is the container the simulator fills with a state-vector table.
func qcState(label string) h.Node {
	return h.Div(h.Data("state", ""), h.Class("scroll-thin max-h-72 overflow-auto rounded-lg border bg-background"), h.Role("region"), h.Aria("label", label))
}

func qcNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// ---------------------------------------------------------------- QC1

var qcGates = [][3]string{
	{"h", "H", "Hadamard"}, {"x", "X", "Pauli X"}, {"y", "Y", "Pauli Y"}, {"z", "Z", "Pauli Z"},
	{"s", "S", "Phase S (90°)"}, {"t", "T", "Phase T (45°)"}, {"rx", "Rx", "Rotation about x by the angle"},
	{"ry", "Ry", "Rotation about y by the angle"}, {"rz", "Rz", "Rotation about z by the angle"},
	{"cx", "CNOT", "Controlled NOT: click the control, then the target"},
	{"cz", "CZ", "Controlled Z: click two wires"}, {"swap", "SWAP", "Swap: click two wires"},
	{"ccx", "CCX", "Toffoli: click two controls, then the target"}, {"m", "M", "Measure (applied in every shot)"},
	{"erase", "⌫", "Erase a gate"},
}

func qcCircuitBlock() Block {
	return Block{
		Slug:        "circuit",
		Title:       "Circuit composer",
		Description: "Build a circuit on up to four qubits and read the exact state vector after it: every amplitude as a + bi, its probability and its phase. Run 1024 shots to see what measurements would return, and copy the circuit as OpenQASM 2.0.",
		Tags:        []string{"state vector", "gates", "OpenQASM"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-circuit",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Svg(h.Data("grid", ""), h.ViewBox("0 0 640 220"), h.Class("block w-full min-w-[520px] select-none"), h.Role("group"), h.Aria("label", "Circuit: click a cell to place the selected gate")),
					),
					h.P(h.Data("out", "hint"), h.Aria("live", "polite"), h.Class("min-h-4 px-1 font-mono text-[11px] text-muted-foreground"), "Pick a gate, then click a wire."),
					h.Div(h.Class("grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
						h.Div(h.Class("flex min-w-0 flex-col gap-1.5"), panelLabel("State after the circuit"), qcState("State vector")),
						h.Div(h.Class("flex min-w-0 flex-col gap-1.5"), panelLabel("1024 shots"),
							h.Svg(h.Data("hist", ""), h.ViewBox("0 0 300 180"), h.Class("block w-full rounded-lg border bg-background"), h.Role("img"), h.Aria("label", "Measurement histogram")),
						),
					),
					h.Div(h.Class("flex flex-col gap-1.5"),
						h.Div(h.Class("flex items-center justify-between"), panelLabel("OpenQASM 2.0"), copyButton("", "")),
						h.Pre(h.Data("qasm", ""), h.Class("code scroll-thin max-h-48 overflow-auto rounded-lg border bg-code px-3 py-2 text-[12px]")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Qubits"),
					qcSegs("Number of qubits", "3", [2]string{"2", "2"}, [2]string{"3", "3"}, [2]string{"4", "4"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Gate"),
					h.Div(h.Class("grid grid-cols-5 gap-1.5"), h.Role("radiogroup"), h.Aria("label", "Gate to place"),
						h.Map(qcGates, func(g [3]string) h.Node {
							return h.Button(h.Type("button"), h.Data("tool", g[0]), h.Attr("title", g[2]), h.Aria("label", g[2]), h.Role("radio"), h.Aria("checked", fmt.Sprint(g[0] == "h")),
								h.Class("h-8 rounded-md border bg-background font-mono text-xs transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-brand aria-checked:bg-brand/10 aria-checked:text-brand"),
								g[1])
						}),
					),
					field("angle", "Angle (Rx/Ry/Rz)", "°", 90, -360, 360, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						qcAction("bell", "Bell pair", hugeicons.FlashIcon()),
						qcAction("ghz", "GHZ", hugeicons.FlashIcon()),
						qcAction("undo", "Undo", hugeicons.ArrowTurnBackwardIcon()),
						qcAction("clear", "Clear", hugeicons.Delete02Icon()),
					),
					qcAction("shots", "Run 1024 shots", hugeicons.DiceIcon()),
				),
				readouts([2]string{"gates", "gates"}, [2]string{"norm", "norm"}, [2]string{"entangled", "ent"}),
			)
		},
	}
}

// ---------------------------------------------------------------- QC2

func qcBellBlock() Block {
	return Block{
		Slug:        "bell-states",
		Title:       "Bell states and the CHSH game",
		Description: "Two qubits whose outcomes are correlated more strongly than any classical pair can be. Measure each qubit along an angle in the x–z plane and read the correlation E = ⟨A⊗B⟩; then play the CHSH game, where the entangled strategy wins cos²(π/8) ≈ 85.4% of rounds against a classical best of 75%.",
		Tags:        []string{"entanglement", "correlations", "CHSH"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-bell",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
						h.Svg(h.Data("corr", ""), h.ViewBox("0 0 360 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Correlation against the angle between the two measurement axes")),
						h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("State"), qcState("Bell state amplitudes")),
					),
					h.Div(h.Class("grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto]"),
						h.Div(h.Class("flex flex-col gap-1 text-sm"),
							h.Span(h.Class("font-medium"), "The CHSH game"),
							h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
								"A referee sends Alice a random bit x and Bob a random bit y. They win when a ⊕ b = x·y, with no communication. Quantum strategy on |Φ⁺⟩: Alice measures at 0° or 90°, Bob at 45° or −45° (Bloch angles)."),
							h.Div(h.Data("out", "chsh"), h.Class("font-mono text-xs tabular-nums"), "—"),
						),
						h.Svg(h.Data("chsh", ""), h.ViewBox("0 0 200 120"), h.Class("block w-full sm:w-52"), h.Role("img"), h.Aria("label", "Win rates")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Bell state"),
					qcSegs("Bell state", "phi+", [2]string{"phi+", "Φ⁺"}, [2]string{"phi-", "Φ⁻"}, [2]string{"psi+", "Ψ⁺"}, [2]string{"psi-", "Ψ⁻"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Measurement axes"),
					field("a", "Alice θ", "°", 0, -180, 180, 1),
					field("b", "Bob θ", "°", 45, -180, 180, 1),
					qcAction("measure", "Measure 200 pairs", hugeicons.DiceIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Game"),
					qcAction("play", "Play 1000 rounds", hugeicons.PlayIcon()),
				),
				readouts([2]string{"E(a, b)", "e"}, [2]string{"P(same)", "same"}, [2]string{"200 pairs", "pairs"}),
			)
		},
	}
}

// ---------------------------------------------------------------- QC3

func qcStepper(n int) h.Node {
	return h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-4"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
		h.Span(h.Data("out", "step"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("1 / %d", n)),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
	)
}

func qcTeleportBlock() Block {
	return Block{
		Slug:        "teleportation",
		Title:       "Quantum teleportation",
		Description: "Moving an unknown qubit state from Alice to Bob with one shared Bell pair and two classical bits. Step through the protocol on all three qubits: after Alice measures, Bob's qubit is the input up to an X and a Z, and after his corrections the fidelity is exactly 1, whatever the measurement gave.",
		Tags:        []string{"protocol", "stepper", "classical bits"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-teleport",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Svg(h.Data("diagram", ""), h.ViewBox("0 0 560 170"), h.Class("block w-full min-w-[460px]"), h.Role("img"), h.Aria("label", "Teleportation circuit with the current step marked")),
					),
					h.P(h.Data("out", "explain"), h.Aria("live", "polite"), h.Class("min-h-10 px-1 text-sm leading-relaxed text-pretty"), "—"),
					qcState("Three-qubit state"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Alice's input qubit"),
					field("theta", "θ", "°", 70, 0, 180, 1),
					field("phi", "φ", "°", 40, 0, 359, 1),
					qcAction("random", "Random state", hugeicons.ShuffleIcon()),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Alice's measurement"),
					qcSegs("Measurement outcome", "random", [2]string{"random", "Random"}, [2]string{"00", "00"}, [2]string{"01", "01"}, [2]string{"10", "10"}, [2]string{"11", "11"}),
				),
				readouts([2]string{"bits sent", "bits"}, [2]string{"Bob applies", "fix"}, [2]string{"fidelity", "fid"}),
				qcStepper(6),
			)
		},
	}
}

// ---------------------------------------------------------------- QC4

func qcDenseBlock() Block {
	return Block{
		Slug:        "superdense-coding",
		Title:       "Superdense coding",
		Description: "Teleportation run backwards: one qubit carries two classical bits. Alice applies I, X, Z or ZX to her half of a Bell pair, sends that single qubit, and Bob's CNOT and H turn the four Bell states back into the four bit pairs, with certainty.",
		Tags:        []string{"Bell pair", "two bits", "decoding"},
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("qc-dense", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Alice's two bits"),
						qcSegs("Message", "00", [2]string{"00", "00"}, [2]string{"01", "01"}, [2]string{"10", "10"}, [2]string{"11", "11"}),
					),
					h.Span(h.Data("out", "op"), h.Class("rounded-md border bg-code px-2.5 py-1 font-mono text-sm"), "—"),
				),
				h.Ol(h.Data("steps", ""), h.Class("grid gap-2 sm:grid-cols-2")),
				h.P(h.Data("out", "result"), h.Aria("live", "polite"), h.Class("rounded-lg border border-brand/30 bg-brand/8 p-3 text-sm"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- QC5

func qcDeutschBlock() Block {
	return Block{
		Slug:        "deutsch-jozsa",
		Title:       "Deutsch–Jozsa",
		Description: "The first exponential separation, on a promise problem: f is either constant or balanced. Classically you may need 2ⁿ⁻¹ + 1 queries to be sure; one quantum query suffices. Edit the truth table and watch the amplitude of |0…0⟩ land on 1 or 0.",
		Tags:        []string{"oracle", "phase kickback", "one query"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-deutsch",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("bars", ""), h.ViewBox("0 0 520 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Amplitudes of the input register after the final Hadamards")),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("f(x): click to flip an output"), h.Div(h.Data("table", ""), h.Class("flex flex-wrap gap-1.5"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Input bits n"),
					qcSegs("Input bits", "3", [2]string{"2", "2"}, [2]string{"3", "3"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Oracle presets"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						qcAction("const0", "f = 0", nil), qcAction("const1", "f = 1", nil),
						qcAction("parity", "Parity", nil), qcAction("first", "First bit", nil),
					),
				),
				readouts([2]string{"f is", "kind"}, [2]string{"P(0…0)", "p0"}, [2]string{"verdict", "verdict"}, [2]string{"classical worst", "classical"}),
			)
		},
	}
}

// ---------------------------------------------------------------- QC6

func qcGroverBlock() Block {
	return Block{
		Slug:        "grover",
		Title:       "Grover's search",
		Description: "Finding one marked item among N = 8 by amplitude amplification: the oracle flips the marked amplitude's sign, the diffusion reflects every amplitude about the mean. Success probability is sin²((2k+1)θ) with sin θ = 1/√N, best after ≈ (π/4)√N iterations: 94.5% after 2 here, and worse if you keep going.",
		Tags:        []string{"amplitude amplification", "oracle", "√N"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-grover",
				h.Div(h.Class("grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
					h.Svg(h.Data("bars", ""), h.ViewBox("0 0 400 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Amplitudes of the eight basis states")),
					h.Svg(h.Data("curve", ""), h.ViewBox("0 0 260 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Success probability against iterations")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Search"),
					field("marked", "Marked item", "", 5, 0, 7, 1),
					h.P(h.Data("out", "phase"), h.Class("font-mono text-xs text-muted-foreground"), "—"),
				),
				h.Div(h.Class("grid grid-cols-2 gap-1.5"),
					qcAction("oracle", "Oracle", nil), qcAction("diffuse", "Diffusion", nil),
					qcAction("iterate", "Full iteration", hugeicons.ArrowRight01Icon()), qcAction("reset", "Reset", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"iterations", "k"}, [2]string{"P(marked)", "p"}, [2]string{"theory", "theory"}, [2]string{"optimal k", "opt"}),
			)
		},
	}
}

// ---------------------------------------------------------------- QC7

func qcQFTBlock() Block {
	return Block{
		Slug:        "qft",
		Title:       "Quantum Fourier transform",
		Description: "The QFT on three qubits as a circuit of Hadamards, controlled phase rotations and a final swap, simulated gate by gate. Its output for |x⟩ is (1/√8) Σ e^(2πi·xy/8)|y⟩: equal magnitudes whose phases turn by x/8 of a turn from one basis state to the next.",
		Tags:        []string{"QFT", "phases", "circuit"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-qft",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"),
						h.Svg(h.Data("diagram", ""), h.ViewBox("0 0 520 140"), h.Class("block w-full min-w-[440px]"), h.Role("img"), h.Aria("label", "Three-qubit QFT circuit")),
					),
					h.Svg(h.Data("phasors", ""), h.ViewBox("0 0 520 130"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Output amplitudes as arrows on unit circles")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Input"),
					field("x", "Basis state |x⟩", "", 1, 0, 7, 1),
				),
				readouts([2]string{"input", "in"}, [2]string{"phase step", "step"}, [2]string{"|amplitude|", "mag"}, [2]string{"max error vs formula", "err"}),
				qcNote("Qubit order: q₀ is the top wire and the leftmost digit of each ket. The swap at the end restores that order."),
			)
		},
	}
}

// ---------------------------------------------------------------- QC8

func qcShorBlock() Block {
	return Block{
		Slug:        "shor",
		Title:       "Shor's algorithm, period finding",
		Description: "Factoring N = 15 reduces to finding the period r of aˣ mod 15. Here the period is found classically from the table, and the ideal output of the quantum period-finding step is shown honestly: peaks at multiples of 2ᵗ/r. Then gcd(a^(r/2) ± 1, N) gives the factors.",
		Tags:        []string{"factoring", "period", "gcd"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-shor",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("aˣ mod 15"), h.Div(h.Data("table", ""), h.Class("scroll-thin overflow-x-auto"))),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Ideal measurement of 4 counting qubits"),
						h.Svg(h.Data("hist", ""), h.ViewBox("0 0 520 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Probability of each counting-register outcome"))),
					h.Ol(h.Data("steps", ""), h.Class("flex flex-col gap-1 text-sm")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Base a (coprime to 15)"),
					qcSegs("Base", "7", [2]string{"2", "2"}, [2]string{"4", "4"}, [2]string{"7", "7"}, [2]string{"8", "8"}, [2]string{"11", "11"}, [2]string{"13", "13"}, [2]string{"14", "14"}),
				),
				readouts([2]string{"period r", "r"}, [2]string{"a^(r/2) mod 15", "half"}, [2]string{"factors", "factors"}),
				qcNote("Honest scope: a real run needs modular exponentiation as a quantum circuit and continued fractions on noisy outcomes. Here the counting register's distribution is computed exactly from r; for N = 15, r divides 16, so the peaks are sharp."),
			)
		},
	}
}

// ---------------------------------------------------------------- QC9

func qcCloningBlock() Block {
	return Block{
		Slug:        "no-cloning",
		Title:       "No-cloning",
		Description: "No device copies an unknown quantum state. Try the obvious copier, a CNOT into a blank qubit: it copies |0⟩ and |1⟩ perfectly, but turns α|0⟩ + β|1⟩ into the entangled α|00⟩ + β|11⟩, not two copies. The fidelity of each output with the input is |α|⁴ + |β|⁴.",
		Tags:        []string{"theorem", "linearity", "proof"},
		Wide:        true,
		Render: func() h.Node {
			psi := mrow(mo("|"), mi("ψ"), mo("⟩"))
			phi := mrow(mo("|"), mi("φ"), mo("⟩"))
			return plotPanel("qc-cloning",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 640 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Fidelity of the copy against the input angle")),
					h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
						h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Wanted: two copies"), qcState("Two copies")),
						h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Got: CNOT output"), h.Div(h.Data("state2", ""), h.Class("scroll-thin max-h-72 overflow-auto rounded-lg border bg-background"))),
					),
					h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-background p-3 text-sm leading-relaxed"),
						h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Proof sketch (Wootters & Zurek, Dieks, 1982)"),
						h.P("Suppose a unitary U copies every state: ", mathml(mi("U"), psi, mo("⊗"), mrow(mo("|"), mn("0"), mo("⟩")), mo("="), psi, mo("⊗"), psi), " and the same for ", mathml(phi), "."),
						h.P("Unitaries preserve inner products, so ", mathml(mrow(mo("⟨"), mi("ψ"), mo("|"), mi("φ"), mo("⟩")), mo("="), msup(mrow(mo("⟨"), mi("ψ"), mo("|"), mi("φ"), mo("⟩")), mn("2"))), "."),
						h.P("That holds only for ", mathml(mrow(mo("⟨"), mi("ψ"), mo("|"), mi("φ"), mo("⟩")), mo("="), mn("0")), " or ", mn("1"), ": a copier works for one orthogonal set of states at most, never for an unknown state."),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Input state"),
					field("theta", "θ", "°", 60, 0, 180, 1),
				),
				readouts([2]string{"α", "alpha"}, [2]string{"β", "beta"}, [2]string{"copy fidelity", "fid"}, [2]string{"perfect only at", "perfect"}),
			)
		},
	}
}

// ---------------------------------------------------------------- QC10

func qcNoiseBlock() Block {
	return Block{
		Slug:        "noise",
		Title:       "Noise and decoherence",
		Description: "Why qubits are hard: each gate leaves some noise. Pass a Bell pair through a depolarizing channel on both qubits, ρ → (1−p)ρ + p·I/2, layer after layer. The fidelity with |Φ⁺⟩ decays toward 1/4, and the CHSH value 2√2(1−p)^(2k) stops beating the classical bound of 2.",
		Tags:        []string{"density matrix", "fidelity", "simplified"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("qc-noise",
				h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 300 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Fidelity and CHSH value against the number of noisy layers")),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Density matrix (real part)"),
						h.Svg(h.Data("rho", ""), h.ViewBox("0 0 220 220"), h.Class("mx-auto block w-full max-w-[260px]"), h.Role("img"), h.Aria("label", "Density matrix after the noise"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Channel"),
					field("p", "p per qubit per layer", "", 0.05, 0, 1, 0.01),
					field("k", "Layers", "", 3, 0, 40, 1),
				),
				readouts([2]string{"fidelity", "fid"}, [2]string{"CHSH S", "s"}, [2]string{"entangled", "ent"}, [2]string{"layers until S ≤ 2", "limit"}),
				qcNote("Simplified model: independent depolarizing noise, no gate errors, no relaxation. ρ is computed exactly by applying the channel to the 4×4 density matrix."),
			)
		},
	}
}
