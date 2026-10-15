package site

import (
	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// DistsysBlocks lists the distributed systems gallery in display order.
// Every cluster is simulated in the page (static/js/distsys*.js): nodes,
// clocks and messages are plain objects, the network is a priority queue.
func DistsysBlocks() []Block {
	return []Block{
		dsClocksBlock(),
		dsImpossibleBlock(),
		dsRaftBlock(),
		dsCAPBlock(),
		dsQuorumBlock(),
		dsCRDTBlock(),
		dsHashingBlock(),
		dsGossipBlock(),
		dsTailBlock(),
		dsBackoffBlock(),
	}
}

// dsAction is an outline button that fires data-action.
func dsAction(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, h.Span(h.Data("label", ""), label))
}

// dsXs is a small outline button carrying one data attribute.
func dsXs(key, value, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data(key, value), h.Class("font-mono"), label)
}

// dsNote is a muted paragraph under the controls.
func dsNote(s ...any) h.Node {
	return h.P(append([]any{h.Class("text-[11px] leading-relaxed text-muted-foreground")}, s...)...)
}

// dsLog is a scrolling monospace event log.
func dsLog() h.Node {
	return h.Ol(h.Data("log", ""), h.Aria("live", "polite"), h.Class("code scroll-thin flex max-h-40 min-h-20 flex-col gap-0.5 overflow-auto rounded-lg border bg-background p-2.5 text-[11.5px] leading-5"))
}

// ---------------------------------------------------------------- D1

func dsClocksBlock() Block {
	return Block{
		Slug:        "logical-clocks",
		Title:       "Lamport clocks and vector clocks",
		Description: "Three processes and no shared clock. Add local events and messages, then click any event: its causal past and future light up, and everything else is concurrent with it. A Lamport timestamp (Lamport 1978) respects happens-before but cannot detect concurrency; a vector clock (Fidge, Mattern 1988) can: a → b exactly when V(a) < V(b).",
		Tags:        []string{"happens-before", "causality", "space-time diagram"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-clocks",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 280"), h.Class("block w-full select-none"), h.Role("img"), h.Aria("label", "Space-time diagram of three processes")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Local event"),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"), dsXs("local", "0", "P1"), dsXs("local", "1", "P2"), dsXs("local", "2", "P3")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Send a message"),
					h.Div(h.Class("grid grid-cols-3 gap-1.5"),
						dsXs("send", "0-1", "P1→P2"), dsXs("send", "1-2", "P2→P3"), dsXs("send", "0-2", "P1→P3"),
						dsXs("send", "1-0", "P2→P1"), dsXs("send", "2-1", "P3→P2"), dsXs("send", "2-0", "P3→P1"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Show"),
					segs("Timestamps", [2]string{"vector", "Vector clocks"}, [2]string{"lamport", "Lamport"}),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					dsAction("undo", "Undo", hugeicons.ArrowLeft01Icon()),
					dsAction("reset", "Example", hugeicons.RefreshIcon()),
				),
				readouts([2]string{"selected", "sel"}, [2]string{"Lamport", "lam"}, [2]string{"vector", "vec"}, [2]string{"before / after", "cone"}, [2]string{"concurrent", "conc"}),
				h.P(h.Data("out", "trap"), h.Class("min-h-10 text-[11px] leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- D2

func dsImpossibleBlock() Block {
	return Block{
		Slug:        "impossibility",
		Title:       "What cannot be done: two generals and FLP",
		Description: "Two generals must attack together but can only talk through messengers who may be caught. Send as many as you like: whoever sent the last one never knows it arrived, so no finite exchange makes the plan certain (Akkoyunlu, Ekanadham and Huber 1975; Gray 1978). FLP (Fischer, Lynch and Paterson 1985) is the cousin result for consensus with one crash.",
		Tags:        []string{"impossibility", "common knowledge", "consensus"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("ds-impossible", ""),
				segs("Result", [2]string{"generals", "Two generals"}, [2]string{"flp", "FLP"}, [2]string{"escape", "How real systems cope"}),
				h.Div(h.Data("view", "generals"), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"),
					h.Div(h.Class("flex min-w-0 flex-col gap-3"),
						h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full rounded-lg border bg-code"), h.Role("img"), h.Aria("label", "Two hills and a valley")),
						h.P(h.Data("out", "knows"), h.Class("min-h-12 rounded-lg border bg-code p-3 font-mono text-xs leading-relaxed")),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						field("loss", "Messenger caught", "%", 30, 0, 90, 5),
						h.Div(h.Class("grid grid-cols-2 gap-2"),
							dsAction("send", "Send", hugeicons.SentIcon()),
							dsAction("reset", "Reset", hugeicons.RefreshIcon()),
						),
						readouts([2]string{"messengers", "sent"}, [2]string{"arrived in a row", "depth"}, [2]string{"last sender sure?", "sure"}),
						dsNote("The argument: suppose some protocol works with k messages. The last one may be caught, and its sender acts the same either way, so the protocol must also work with k − 1. Repeat down to zero messages: absurd."),
					),
				),
				h.Div(h.Data("view", "flp"), h.Hidden(), h.Class("grid gap-3 md:grid-cols-3"),
					dsCard("The setting", "Processes exchange messages with no bound on delay (an asynchronous system), and at most one of them may crash, silently. Every correct process must decide the same value, and that value must have been proposed by someone."),
					dsCard("The theorem", "No deterministic protocol guarantees that every correct process decides in that setting (Fischer, Lynch and Paterson, J. ACM 1985). A slow process and a crashed one look the same, and the proof builds a run that stays undecided forever."),
					dsCard("What it does not say", "It does not say consensus usually fails, or that Paxos and Raft are wrong. They are always safe (never two different decisions); FLP only shows that some unlucky schedule can keep them from deciding, as split votes do in the Raft block."),
				),
				h.Div(h.Data("view", "escape"), h.Hidden(), h.Class("grid gap-3 md:grid-cols-3"),
					dsCard("Partial synchrony", "Assume delays are bounded eventually, without knowing the bound (Dwork, Lynch and Stockmeyer 1988). Paxos and Raft rely on this for progress, with randomized timeouts, and never for safety."),
					dsCard("Randomization", "Let processes flip coins. Ben-Or's protocol (1983) decides with probability 1, though no fixed bound on the number of rounds exists."),
					dsCard("Failure detectors", "Give each process an unreliable oracle that suspects crashed peers. Chandra and Toueg (1996) showed the weakest such detector that makes consensus solvable, ◇W."),
				),
			)
		},
	}
}

func dsCard(title, body string) h.Node {
	return h.Div(h.Class("flex flex-col gap-1.5 rounded-lg border bg-code p-4"),
		h.H3(h.Class("text-sm font-medium"), title),
		h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), body),
	)
}

// ---------------------------------------------------------------- D3

func dsRaftBlock() Block {
	return Block{
		Slug:        "raft",
		Title:       "Raft: elections and log replication",
		Description: "Five servers running a faithful core of Raft (Ongaro and Ousterhout 2014): randomized election timeouts of 150–300 ms, RequestVote with the up-to-date log check, AppendEntries with the consistency check, and commit only by majority in the leader's own term. Crash servers, cut the network in two and write through any node.",
		Tags:        []string{"consensus", "leader election", "replicated log"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-raft",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("110 0 340 320"), h.Class("mx-auto block w-full max-w-[400px] select-none"), h.Role("img"), h.Aria("label", "Five Raft servers and their messages")),
					h.Div(h.Data("logs", ""), h.Class("scroll-thin overflow-x-auto rounded-lg border bg-background p-2.5")),
					h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "leader"),
						legendSwatch("var(--vec-u)", "candidate · RequestVote"),
						legendSwatch("var(--muted-foreground)", "AppendEntries"),
						legendSwatch("var(--code-del)", "crashed / lost"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cluster"),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						playPause(),
						dsAction("reset", "Reset", hugeicons.RefreshIcon()),
					),
					segs("Speed", [2]string{"0.15", "Slow"}, [2]string{"0.4", "Normal"}, [2]string{"1", "Real time"}),
					toggle("ds-raft-part", "partition", "Partition {S1, S2} | {S3, S4, S5}", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Selected server"),
					h.P(h.Class("text-xs text-muted-foreground"), "Click a server to select it."),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						dsAction("crash", "Crash", hugeicons.PowerServiceIcon()),
						dsAction("write", "Client write", hugeicons.Add01Icon()),
					),
					dsAction("timeout", "Time out now", hugeicons.FlashIcon()),
				),
				readouts([2]string{"selected", "sel"}, [2]string{"highest term", "term"}, [2]string{"leader", "leader"}, [2]string{"committed", "commit"}, [2]string{"elections", "elections"}, [2]string{"leaders per term", "safety"}),
				h.P(h.Data("out", "event"), h.Aria("live", "polite"), h.Class("min-h-10 text-[11px] leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- D4

func dsCAPBlock() Block {
	return Block{
		Slug:        "cap",
		Title:       "CAP and PACELC with a replicated store",
		Description: "A key-value store on three replicas, with a client next to S1 and another next to S3. When the network partitions, a store must choose (Brewer 2000; Gilbert and Lynch 2002): refuse requests on the minority side (CP) or answer them and risk stale reads and lost writes (AP). PACELC (Abadi 2012) adds the everyday trade-off: Else, latency against consistency.",
		Tags:        []string{"consistency", "availability", "partitions"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-cap",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("44 0 472 230"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "Three replicas and two clients")),
					dsLog(),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("During a partition, choose"),
					segs("Mode", [2]string{"cp", "CP: majority"}, [2]string{"ap", "AP: any replica"}),
					toggle("ds-cap-part", "partition", "Partition S3 from S1, S2", false),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Clients"),
					h.Div(h.Class("grid grid-cols-2 gap-1.5"),
						dsXs("op", "w1", "Alice writes"), dsXs("op", "r1", "Alice reads"),
						dsXs("op", "w2", "Bob writes"), dsXs("op", "r2", "Bob reads"),
					),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Else: no partition"),
					field("rtt", "RTT S1 ↔ S3", "ms", 80, 1, 300, 1),
					toggle("ds-cap-sync", "sync", "Wait for every replica", true),
				),
				readouts([2]string{"refused", "refused"}, [2]string{"stale reads", "stale"}, [2]string{"lost writes", "lost"}, [2]string{"write latency", "lat"}, [2]string{"PACELC", "class"}),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset"),
			)
		},
	}
}

// ---------------------------------------------------------------- D5

func dsQuorumBlock() Block {
	return Block{
		Slug:        "quorums",
		Title:       "Quorums: N, R and W",
		Description: "Dynamo-style replication (DeCandia et al. 2007): a write waits for W of the N replicas, a read asks R. If R + W > N, every read set meets every write set, so a read sees the latest write. Smaller quorums are faster and more available; the block computes the exact chance of a stale read and the availability when each replica is down with probability p.",
		Tags:        []string{"replication", "hypergeometric", "availability"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-quorum",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "One write and one read on the replicas")),
					h.Svg(h.Data("avail", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Availability against replica failure probability")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Replication"),
					field("n", "N replicas", "", 5, 1, 12, 1),
					field("w", "W (write quorum)", "", 3, 1, 12, 1),
					field("r", "R (read quorum)", "", 3, 1, 12, 1),
					field("p", "Replica down", "%", 5, 0, 60, 1),
				),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					dsXs("preset", "5,3,3", "N5 W3 R3"), dsXs("preset", "3,1,1", "N3 W1 R1"), dsXs("preset", "3,3,1", "N3 W3 R1"), dsXs("preset", "5,1,5", "N5 W1 R5"),
				),
				dsAction("trial", "New trial", hugeicons.ShuffleIcon()),
				readouts([2]string{"R + W > N", "strict"}, [2]string{"P(stale read)", "stale"}, [2]string{"simulated", "sim"}, [2]string{"write available", "wa"}, [2]string{"read available", "ra"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D6

func dsCRDTBlock() Block {
	return Block{
		Slug:        "crdts",
		Title:       "CRDTs: replicas that always agree",
		Description: "Conflict-free replicated data types (Shapiro et al. 2011) let every replica accept updates offline and merge states in any order, any number of times. The merge is commutative, associative and idempotent, so replicas that have seen the same updates hold the same value. Compare a naive counter that just copies the bigger number.",
		Tags:        []string{"eventual consistency", "G-counter", "OR-Set"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("ds-crdt", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Type", [2]string{"g", "G-counter"}, [2]string{"pn", "PN-counter"}, [2]string{"orset", "OR-Set"}),
					h.Div(h.Class("flex flex-wrap gap-2"),
						dsAction("gossip", "Sync all, random order", hugeicons.ShuffleIcon()),
						dsAction("reset", "Reset", hugeicons.RefreshIcon()),
					),
				),
				h.Div(h.Data("replicas", ""), h.Class("grid gap-3 md:grid-cols-3")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Send state"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						dsXs("merge", "0-1", "A → B"), dsXs("merge", "1-0", "B → A"), dsXs("merge", "1-2", "B → C"),
						dsXs("merge", "2-1", "C → B"), dsXs("merge", "0-2", "A → C"), dsXs("merge", "2-0", "C → A"),
					),
				),
				h.Div(h.Class("flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 font-mono text-xs"),
					h.Span(h.Class("text-muted-foreground"), "converged: ", h.Span(h.Data("out", "conv"), "—")),
					h.Span(h.Class("text-muted-foreground"), "updates applied: ", h.Span(h.Data("out", "ops"), "—")),
					h.Span(h.Class("text-muted-foreground"), "naive counter: ", h.Span(h.Data("out", "naive"), "—")),
				),
				h.P(h.Data("out", "explain"), h.Class("min-h-10 text-xs leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- D7

func dsHashingBlock() Block {
	return Block{
		Slug:        "consistent-hashing",
		Title:       "Consistent hashing",
		Description: "Where does a key live? With hash(key) mod N, adding one server moves almost every key. Consistent hashing (Karger et al. 1997) puts servers and keys on one ring and gives each key to the next server clockwise, so a new server takes keys only from its neighbours. Virtual nodes even out the load.",
		Tags:        []string{"partitioning", "virtual nodes", "rebalancing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-hashing",
				h.Div(h.Class("grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 300 300"), h.Class("mx-auto block w-full max-w-[340px]"), h.Role("img"), h.Aria("label", "Hash ring")),
					h.Svg(h.Data("load", ""), h.ViewBox("0 0 300 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Keys per server")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Ring"),
					field("vnodes", "Virtual nodes each", "", 1, 1, 200, 1),
					field("keys", "Keys", "", 2000, 100, 20000, 100),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					dsAction("add", "Add server", hugeicons.PlusSignIcon()),
					dsAction("remove", "Remove one", hugeicons.MinusSignIcon()),
				),
				readouts([2]string{"servers", "n"}, [2]string{"last change moved", "moved"}, [2]string{"mod N would move", "modn"}, [2]string{"ideal share", "ideal"}, [2]string{"max / mean load", "imb"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D8

func dsGossipBlock() Block {
	return Block{
		Slug:        "gossip",
		Title:       "Gossip: rumours spread in log n rounds",
		Description: "Each round, every node that knows the update tells a random peer (push), or every node asks a random peer (pull), or both (Demers et al. 1987). With push and one contact per round, everyone knows after about log₂ n + ln n rounds (Pittel 1987), so a cluster of a million is reached in about 34. Run it many times and compare.",
		Tags:        []string{"epidemic protocols", "anti-entropy", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-gossip",
				h.Div(h.Class("grid items-center gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]"),
					h.Div(h.Data("grid", ""), h.Class("mx-auto grid w-full max-w-[260px] gap-px"), h.Style("grid-template-columns:repeat(32,minmax(0,1fr))"), h.Role("img"), h.Aria("label", "1,024 nodes; filled ones know the update")),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Informed nodes per round")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Protocol"),
					segs("Protocol", [2]string{"push", "Push"}, [2]string{"pull", "Pull"}, [2]string{"pushpull", "Push-pull"}),
					field("fanout", "Fanout", "peers", 1, 1, 6, 1),
					field("loss", "Message loss", "%", 0, 0, 80, 5),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					dsAction("step", "One round", hugeicons.ArrowRight01Icon()),
					dsAction("run", "Run to the end", hugeicons.PlayIcon()),
				),
				dsAction("batch", "Average 50 runs, n = 2⁸ … 2¹⁶", hugeicons.ShuffleIcon()),
				readouts([2]string{"nodes", "n"}, [2]string{"round", "round"}, [2]string{"informed", "inf"}, [2]string{"log₂ n + ln n", "theory"}, [2]string{"messages", "msgs"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D9

func dsTailBlock() Block {
	return Block{
		Slug:        "tail-latency",
		Title:       "The tail at scale",
		Description: "A request that fans out to k servers is as slow as the slowest of them. If one server answer in 100 is slow, a fan-out of 100 is slow 1 − 0.99¹⁰⁰ ≈ 63% of the time (Dean and Barroso, “The Tail at Scale”, 2013). Hedged requests send a second copy after a short wait and keep whichever answers first.",
		Tags:        []string{"latency", "percentiles", "hedged requests"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-tail",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Chance a fan-out request is slow, against k")),
					h.Svg(h.Data("hist", ""), h.ViewBox("0 0 560 200"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Latency distribution of the whole request")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("One server"),
					field("fast", "Typical answer", "ms", 10, 1, 100, 1),
					field("slow", "Slow answer", "ms", 1000, 50, 5000, 10),
					field("pslow", "Slow fraction", "%", 1, 0, 20, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Request"),
					field("k", "Fan-out k", "servers", 100, 1, 2000, 1),
					toggle("ds-tail-hedge", "hedge", "Hedge after the p95 of one server", false),
				),
				readouts([2]string{"P(slow) = 1 − (1 − p)^k", "pk"}, [2]string{"request p50", "p50"}, [2]string{"request p99", "p99"}, [2]string{"extra requests", "extra"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D10

func dsBackoffBlock() Block {
	return Block{
		Slug:        "backoff",
		Title:       "Retries: backoff and jitter",
		Description: "A server fails and a hundred clients retry. Retrying at once, or on the same exponential schedule, sends the herd back in waves that overload it again. Adding randomness (jitter) spreads the retries out; the comparison follows Marc Brooker's AWS Architecture Blog post “Exponential Backoff And Jitter” (2015).",
		Tags:        []string{"thundering herd", "resilience", "simulation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("ds-backoff",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 220"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Requests per time slot")),
					h.Div(h.Data("compare", ""), h.Class("scroll-thin overflow-x-auto")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Strategy"),
					h.Div(h.Class("flex flex-wrap items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Strategy"),
						segButton("none", "Immediate", false), segButton("exp", "Exponential", false), segButton("full", "Full jitter", true),
						segButton("equal", "Equal jitter", false), segButton("decor", "Decorrelated", false),
					),
					h.Pre(h.Data("formula", ""), h.Class("code min-h-10 rounded-lg border bg-code p-2.5 text-[11.5px] leading-5 whitespace-pre-wrap")),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Load"),
					field("clients", "Clients", "", 100, 2, 1000, 1),
					field("cap", "Server capacity", "req/slot", 10, 1, 100, 1),
					field("base", "Base delay", "slots", 1, 1, 20, 1),
				),
				dsAction("rerun", "Run again", hugeicons.ShuffleIcon()),
				readouts([2]string{"total calls", "calls"}, [2]string{"failed calls", "fails"}, [2]string{"last success", "done"}),
				h.Div(h.Class("flex items-center gap-2 text-[11px] text-muted-foreground"), badge.Badge(badge.VariantOutline, "model"), "A slot accepts the first ‘capacity’ calls and fails the rest; failed clients retry by the chosen rule."),
			)
		},
	}
}
