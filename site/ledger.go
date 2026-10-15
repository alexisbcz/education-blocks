package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// LedgerBlocks lists the blockchain gallery: a technical course on hash
// chains, Merkle trees, proof of work, difficulty, elliptic-curve
// signatures, UTXOs, double spends, forks and contracts as state machines.
// No prices and no investment content.
func LedgerBlocks() []Block {
	return []Block{
		ledgerChainBlock(),
		ledgerMerkleBlock(),
		ledgerPowBlock(),
		ledgerDifficultyBlock(),
		ledgerCurveBlock(),
		ledgerEcdsaBlock(),
		ledgerUtxoBlock(),
		ledgerNakamotoBlock(),
		ledgerForksBlock(),
		ledgerEscrowBlock(),
	}
}

func ledgerButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func ledgerNote(children ...any) h.Node {
	return h.P(append([]any{h.Class("text-xs leading-relaxed text-pretty text-muted-foreground")}, children...)...)
}

// ledgerText is a plain text input styled like the scrub fields.
func ledgerText(name, value, label string) h.Node {
	return h.Input(h.Type("text"), h.Data("text", name), h.Value(value), h.Aria("label", label),
		h.Attr("autocomplete", "off"), h.Attr("spellcheck", "false"),
		h.Class("h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"))
}

// ---------------------------------------------------------------- L1

func ledgerChainBlock() Block {
	return Block{
		Slug:        "hash-chain",
		Title:       "A chain of hashes",
		Description: "Each block stores the hash of the block before it, and its own hash must start with zeros (here 12 zero bits, three hex zeros). Edit any block's data: its hash changes, the next block's link breaks, and every block after it is invalid until you redo their work.",
		Tags:        []string{"SHA-256", "tamper evidence", "proof of work"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4"), h.Data("ledger-chain", ""),
				h.Div(h.Data("blocks", ""), h.Class("grid gap-3 sm:grid-cols-2 lg:grid-cols-5"), h.Aria("live", "polite")),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					h.Div(h.Class("flex flex-wrap gap-2"),
						ledgerButton("mine-all", "Mine every invalid block", hugeicons.FlashIcon()),
						ledgerButton("reset", "Reset", hugeicons.RefreshIcon()),
					),
					h.Dl(h.Class("flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs"),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "valid"), h.Dd(h.Data("out", "valid"), h.Class("tabular-nums"), "—")),
						h.Div(h.Class("flex gap-1.5"), h.Dt(h.Class("text-muted-foreground"), "hashes spent re-mining"), h.Dd(h.Data("out", "work"), h.Class("tabular-nums"), "0")),
					),
				),
				ledgerNote("SHA-256 is computed in the page over the text “index | previous hash | data | nonce”. Real Bitcoin headers are 80 bytes hashed twice with SHA-256 and point at a Merkle root rather than the data itself, but the chaining is the same."),
			)
		},
	}
}

// ---------------------------------------------------------------- L2

func ledgerMerkleBlock() Block {
	return Block{
		Slug:        "merkle-tree",
		Title:       "Merkle tree and inclusion proof",
		Description: "Pair up the transaction hashes, hash each pair, repeat until one root remains. To prove a transaction is in the block you only need the sibling hash at each level: log₂ n hashes instead of all n transactions. Pick a leaf, then tamper with one and watch the proof fail.",
		Tags:        []string{"Merkle root", "SPV", "log n proof"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-merkle",
				h.Svg(h.Data("tree", ""), h.ViewBox("0 0 640 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Merkle tree; the proof path is highlighted")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Transactions"),
					segs("Leaf count", [2]string{"8", "8"}, [2]string{"5", "5"}, [2]string{"16", "16"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Prove leaf"),
					h.Div(h.Data("leaves", ""), h.Class("flex flex-wrap gap-1"), h.Role("group"), h.Aria("label", "Leaf to prove")),
				),
				toggle("ledger-merkle-tamper", "tamper", "Tamper with the leaf", false),
				h.Ol(h.Data("proof", ""), h.Class("flex flex-col gap-1 font-mono text-[11px] text-muted-foreground"), h.Aria("live", "polite")),
				readouts([2]string{"proof hashes", "size"}, [2]string{"root", "root"}, [2]string{"verdict", "verdict"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L3

func ledgerPowBlock() Block {
	return Block{
		Slug:        "proof-of-work",
		Title:       "Proof of work, in your browser",
		Description: "Try nonce after nonce until SHA-256 of the header has k leading zero bits. Each try succeeds with probability 2⁻ᵏ, so the number of tries is geometric with mean 2ᵏ: no shortcut, no memory, just expected work. Mine twenty blocks and compare the spread with the theory.",
		Tags:        []string{"nonce", "geometric", "hash rate"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-pow",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-col gap-1 rounded-lg border bg-background p-3 font-mono text-[11px]"),
						h.Div(h.Class("flex gap-2"), h.Span(h.Class("w-12 shrink-0 text-muted-foreground"), "nonce"), h.Span(h.Data("out", "nonce"), h.Class("tabular-nums"), "—")),
						h.Div(h.Class("flex gap-2"), h.Span(h.Class("w-12 shrink-0 text-muted-foreground"), "hash"), h.Span(h.Data("out", "hash"), h.Class("min-w-0 break-all"), "—")),
						h.Div(h.Class("flex gap-2"), h.Span(h.Class("w-12 shrink-0 text-muted-foreground"), "bits"), h.Span(h.Data("bits", ""), h.Class("flex flex-wrap gap-px"), h.Aria("hidden", "true"))),
					),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Tries per block against the geometric distribution")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Target"),
					h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-sm text-muted-foreground"), "Header data"), ledgerText("header", "prev=000a3f… txs=7f21…", "Header data")),
					field("k", "zero bits k", "bits", 16, 4, 24, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					ledgerButton("one", "Mine one", hugeicons.PlayIcon()),
					ledgerButton("twenty", "Mine 20", hugeicons.FlashIcon()),
					h.Div(h.Class("col-span-2"), ledgerButton("stop", "Stop", hugeicons.StopIcon())),
				),
				readouts([2]string{"expected tries 2ᵏ", "expected"}, [2]string{"mean tries", "mean"}, [2]string{"blocks", "blocks"}, [2]string{"hash rate", "rate"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L4

func ledgerDifficultyBlock() Block {
	return Block{
		Slug:        "difficulty",
		Title:       "Difficulty adjustment",
		Description: "Bitcoin aims for one block every 10 minutes. Every 2016 blocks each node compares how long they took with two weeks and scales the difficulty by the ratio, clamped to a factor of 4. Change the hash rate and watch block times drift, then snap back at the next retarget.",
		Tags:        []string{"retarget", "2016 blocks", "feedback"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-difficulty",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "hash rate"), legendSwatch("var(--brand)", "difficulty"), legendSwatch("var(--vec-v)", "mean block time")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Hash rate, difficulty and block time over retarget periods")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Hash rate"),
					segs("Hash rate scenario", [2]string{"growth", "Growth"}, [2]string{"halve", "Halves"}, [2]string{"spike", "Spike"}, [2]string{"crash", "−90%"}),
				),
				field("periods", "periods", "×2016", 24, 6, 60, 1),
				toggle("ledger-difficulty-clamp", "clamp", "Clamp to ×4 per period", true),
				ledgerButton("reroll", "New random block times", hugeicons.RefreshIcon()),
				readouts([2]string{"worst period", "worst"}, [2]string{"periods off by >10%", "off"}, [2]string{"final block time", "final"}),
				ledgerNote("Block times are drawn from an exponential distribution, the way independent miners find blocks. Bitcoin's code measures 2015 intervals, not 2016, a known off-by-one kept for compatibility; the simulation uses 2016."),
			)
		},
	}
}

// ---------------------------------------------------------------- L5

func ledgerCurveBlock() Block {
	return Block{
		Slug:        "elliptic-curve",
		Title:       "Elliptic curve arithmetic",
		Description: "Bitcoin's keys live on y² = x³ + 7. On the real curve, P + Q is where the chord through P and Q meets the curve again, flipped. Over a prime field the same formulas give a finite cloud of points, and k·G by double-and-add is easy to compute but, at 256 bits, infeasible to undo.",
		Tags:        []string{"secp256k1 shape", "double-and-add", "F_p"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-curve",
				h.Div(h.Class("grid gap-3 md:grid-cols-2"),
					h.Div(h.Class("flex flex-col gap-1"), panelLabel("Over the reals: P + Q"),
						h.Svg(h.Data("real", ""), h.ViewBox("0 0 300 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Chord construction of P + Q on y² = x³ + 7"))),
					h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Data("out", "fieldlabel"), h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), "Over F_p"),
						h.Svg(h.Data("field", ""), h.ViewBox("0 0 300 300"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Points of y² = x³ + 7 over a prime field, with the multiples of G"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Real curve"),
					field("px", "x of P", "", -1.5, -1.9, 4, 0.05),
					field("qx", "x of Q", "", 2.2, -1.9, 4, 0.05),
					toggle("ledger-curve-qneg", "qneg", "Q below the axis", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Prime field"),
					segs("Prime p", [2]string{"67", "p = 67"}, [2]string{"43", "43"}, [2]string{"97", "97"}),
					field("k", "scalar k", "", 9, 1, 120, 1),
				),
				h.Ol(h.Data("steps", ""), h.Class("scroll-thin flex max-h-36 flex-col gap-0.5 overflow-auto font-mono text-[11px] tabular-nums")),
				readouts([2]string{"P + Q", "sum"}, [2]string{"group order", "order"}, [2]string{"k·G", "kg"}, [2]string{"doublings + adds", "ops"}),
			)
		},
	}
}

// ---------------------------------------------------------------- L6

func ledgerEcdsaBlock() Block {
	return Block{
		Slug:        "ecdsa",
		Title:       "Signatures with ECDSA (toy size)",
		Description: "Sign with a private key d, verify with the public point Q = d·G, on the 79-point curve over F₆₇. Then sign two messages with the same nonce k: anyone can solve for k, then for d. That mistake leaked real keys, such as Sony's PlayStation 3 signing key in 2010.",
		Tags:        []string{"sign", "verify", "nonce reuse"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-ecdsa",
				h.Div(h.Class("flex flex-col gap-3 p-1"),
					h.Div(h.Class("grid gap-3 sm:grid-cols-2"),
						h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-sm text-muted-foreground"), "Message 1"), ledgerText("m1", "pay Bob 5", "Message 1")),
						h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("text-sm text-muted-foreground"), "Message 2"), ledgerText("m2", "pay Eve 50", "Message 2")),
					),
					h.Div(h.Data("work", ""), h.Class("grid gap-3 font-mono text-xs leading-relaxed sm:grid-cols-2"), h.Aria("live", "polite")),
					h.Div(h.Data("attack", ""), h.Class("rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"), h.Aria("live", "polite")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Keys"),
					field("d", "private d", "", 23, 1, 78, 1),
					field("k1", "nonce k₁", "", 11, 1, 78, 1),
					field("k2", "nonce k₂", "", 30, 1, 78, 1),
					toggle("ledger-ecdsa-reuse", "reuse", "Reuse k₁ for message 2", false),
					toggle("ledger-ecdsa-forge", "forge", "Verify message 2 with signature 1", false),
				),
				readouts([2]string{"public Q", "pub"}, [2]string{"sig 1 (r, s)", "sig1"}, [2]string{"sig 2 (r, s)", "sig2"}),
				ledgerNote("Insecure on purpose: n = 79 can be brute-forced by hand. Messages are hashed with SHA-256 and reduced mod n. Real wallets use n ≈ 2²⁵⁶ and derive k deterministically from d and the message (RFC 6979)."),
			)
		},
	}
}

// ---------------------------------------------------------------- L7

func ledgerUtxoBlock() Block {
	return Block{
		Slug:        "utxo",
		Title:       "Coins as unspent outputs",
		Description: "In Bitcoin there are no balances, only unspent transaction outputs. To pay, consume whole coins as inputs and create new outputs: the payment, your change, and whatever is left over goes to the miner as a fee. Try spending a coin twice.",
		Tags:        []string{"UTXO", "change", "double spend"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("ledger-utxo", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-4 border-b bg-code p-4 lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Alice's coins: pick the inputs"),
						h.Div(h.Data("coins", ""), h.Class("flex flex-wrap gap-2"), h.Role("group"), h.Aria("label", "Unspent outputs"))),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ledger"),
						h.Ol(h.Data("log", ""), h.Class("scroll-thin flex max-h-56 flex-col gap-1.5 overflow-auto font-mono text-[11px]"), h.Aria("live", "polite"))),
				),
				h.Div(h.Class("flex flex-col gap-4 p-5"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Outputs"),
						field("pay", "to Bob", "sat", 7000, 1, 100000, 100),
						field("fee", "fee", "sat", 300, 0, 5000, 50),
					),
					h.Dl(h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs"),
						h.Dt(h.Class("text-muted-foreground"), "inputs"), h.Dd(h.Data("out", "in"), h.Class("text-right tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "to Bob"), h.Dd(h.Data("out", "pay"), h.Class("text-right tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "change to Alice"), h.Dd(h.Data("out", "change"), h.Class("text-right tabular-nums"), "—"),
						h.Dt(h.Class("text-muted-foreground"), "fee to miner"), h.Dd(h.Data("out", "fee"), h.Class("text-right tabular-nums"), "—"),
					),
					h.P(h.Data("out", "status"), h.Class("min-h-10 text-sm leading-relaxed"), h.Aria("live", "polite"), "Pick one or more coins."),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						ledgerButton("send", "Broadcast", hugeicons.SentIcon()),
						ledgerButton("replay", "Replay last", hugeicons.Copy01Icon()),
						h.Div(h.Class("col-span-2"), ledgerButton("reset", "Reset", hugeicons.RefreshIcon())),
					),
					ledgerNote("Account systems such as Ethereum keep a balance and a nonce per address instead; a replayed transaction is rejected there because its nonce is already used."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- L8

func ledgerNakamotoBlock() Block {
	return Block{
		Slug:        "double-spend",
		Title:       "How many confirmations?",
		Description: "An attacker with a share q of the hash power secretly mines a chain that undoes your payment. Section 11 of the Bitcoin paper (Nakamoto 2008) gives the chance they ever catch up after you wait z blocks: it falls exponentially in z while q < ½, and is 1 once q ≥ ½.",
		Tags:        []string{"Nakamoto 2008", "gambler's ruin", "Poisson"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-nakamoto",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "your q"), legendSwatch("var(--vec-u)", "q = 0.1, 0.2, 0.3, 0.4"), legendSwatch("var(--vec-v)", "simulated")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Attacker success probability against confirmations, log scale")),
					h.Div(h.Class("scroll-thin overflow-x-auto"), h.Table(h.Data("table", ""), h.Class("w-full font-mono text-[11px] tabular-nums"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Attacker"),
					field("q", "hash share q", "", 0.1, 0.01, 0.6, 0.01),
					field("z", "confirmations z", "blocks", 6, 0, 60, 1),
				),
				ledgerButton("simulate", "Simulate 20,000 races", hugeicons.FlashIcon()),
				readouts([2]string{"P, paper (Poisson)", "p"}, [2]string{"P, exact race", "exact"}, [2]string{"simulated", "sim"}, [2]string{"z for P < 0.1%", "need"}),
				ledgerNote("While the honest network finds z blocks, the attacker finds some number k of its own, then must close the remaining gap. The paper approximates k with a Poisson count; the exact count is negative binomial, and the exact column uses it (Grunspan and Pérez-Marco, 2018). The simulation races block by block and gives up 200 blocks behind, where the chance left is (q/p)²⁰⁰, below 10⁻¹⁷ for q ≤ 0.45."),
			)
		},
	}
}

// ---------------------------------------------------------------- L9

func ledgerForksBlock() Block {
	return Block{
		Slug:        "forks",
		Title:       "Forks and the most-work chain",
		Description: "Five miners find blocks at random and announce them, but news takes time to travel. Two blocks found within the delay of each other split the network until one branch gets longer; the losing block is orphaned. The longer the delay compared with the block interval, the more work is wasted.",
		Tags:        []string{"orphans", "propagation delay", "longest chain"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-forks",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "main chain"), legendSwatch("var(--code-del)", "orphaned")),
					h.Svg(h.Data("tree", ""), h.ViewBox("0 0 640 160"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Block tree with the main chain highlighted")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Network"),
					field("delay", "delay d", "s", 60, 0, 600, 5),
					field("interval", "interval T", "s", 600, 15, 1200, 15),
					field("blocks", "blocks", "", 60, 10, 120, 10),
				),
				ledgerButton("run", "Run again", hugeicons.RefreshIcon()),
				readouts([2]string{"orphan rate", "rate"}, [2]string{"rough 1 − e^(−d/T)", "theory"}, [2]string{"main chain height", "height"}, [2]string{"deepest reorg", "reorg"}),
				ledgerNote("Each miner has 20% of the hash power and sees others' blocks d seconds after they are found; ties go to the block it saw first. 1 − e^(−d/T) is the chance that a rival block turns up within d of a given one: close for small d/T, an overestimate once forks start to overlap. Bitcoin's d is a few seconds against T = 600 s."),
			)
		},
	}
}

// ---------------------------------------------------------------- L10

func ledgerEscrowBlock() Block {
	return Block{
		Slug:        "contract",
		Title:       "A contract is a state machine",
		Description: "A smart contract is a program whose state lives on the chain and changes only through transactions. This escrow holds the buyer's deposit until the buyer confirms delivery, or until a deadline passes. Every step costs gas; a call that is not allowed in the current state reverts and still pays for the gas it used.",
		Tags:        []string{"escrow", "gas", "revert"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ledger-escrow",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("fsm", ""), h.ViewBox("0 0 600 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Escrow states and transitions; the current state is highlighted")),
					h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Storage"),
							h.Dl(h.Data("storage", ""), h.Class("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-background p-3 font-mono text-[11px] tabular-nums"))),
						h.Div(h.Class("flex flex-col gap-1"), panelLabel("Transactions"),
							h.Ol(h.Data("log", ""), h.Class("scroll-thin flex max-h-40 flex-col gap-1 overflow-auto rounded-lg border bg-background p-3 font-mono text-[11px]"), h.Aria("live", "polite"))),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Call as"),
					h.Div(h.Class("grid grid-cols-1 gap-2"),
						ledgerButton("deposit", "buyer · deposit(100)", hugeicons.Wallet01Icon()),
						ledgerButton("ship", "seller · markShipped()", hugeicons.DeliveryTruck01Icon()),
						ledgerButton("confirm", "buyer · confirmDelivery()", hugeicons.CheckmarkCircle02Icon()),
						ledgerButton("refund", "anyone · refundAfterDeadline()", hugeicons.Clock01Icon()),
						ledgerButton("wait", "advance 10 blocks", hugeicons.ArrowRight01Icon()),
						ledgerButton("reset", "Deploy a fresh contract", hugeicons.RefreshIcon()),
					),
				),
				readouts([2]string{"state", "state"}, [2]string{"block", "block"}, [2]string{"gas used", "gas"}),
				ledgerNote("Gas costs here are simplified illustrations in the spirit of the EVM (storage writes cost the most); they are not Ethereum's actual schedule."),
			)
		},
	}
}
