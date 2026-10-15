package site

import (
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// NetworkingBlocks lists the networking gallery in display order. The
// simulations live in static/js/networking.js; nothing touches the
// network, every packet is computed in the page.
func NetworkingBlocks() []Block {
	return []Block{
		netEncapBlock(),
		netHandshakeBlock(),
		netCwndBlock(),
		netSubnetBlock(),
		netRoutingBlock(),
		netDNSBlock(),
		netTLSBlock(),
		netHTTPBlock(),
		netLatencyBlock(),
		netCSSBlock(),
	}
}

// netInput is a labelled text input (addresses, URLs, paths).
func netInput(name, label, value, class string) h.Node {
	return h.Label(h.Class("flex min-w-0 flex-col gap-1 text-xs text-muted-foreground "+class),
		label,
		h.Input(h.Type("text"), h.Data("in", name), h.Value(value), h.Attr("spellcheck", "false"),
			h.Attr("autocomplete", "off"), h.Attr("autocapitalize", "off"),
			h.Class("h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 font-mono text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[invalid]:border-del sm:text-sm")),
	)
}

// netStepper is the Back / counter / Next row shared by the step-through
// blocks.
func netStepper() h.Node {
	return h.Div(h.Class("flex items-center justify-between gap-3"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), hugeicons.ArrowLeft01Icon(), "Back"),
		h.Span(h.Data("out", "step"), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), "—"),
		button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
	)
}

// netRaw is a monospace panel for raw protocol text.
func netRaw(name, label string) h.Node {
	return h.Div(h.Class("flex min-w-0 flex-col gap-1.5"),
		h.Span(h.Class("font-mono text-[11px] tracking-wider text-muted-foreground uppercase"), label),
		h.Pre(h.Data("raw", name), h.Class("code scroll-thin min-h-24 overflow-x-auto rounded-lg border bg-code p-3 text-[12px] leading-5 whitespace-pre")),
	)
}

// ---------------------------------------------------------------- N1

func netEncapBlock() Block {
	return Block{
		Slug:        "encapsulation",
		Title:       "A packet's journey down the stack",
		Description: "One HTTP request wrapped layer by layer: a TCP segment (20-byte header, RFC 9293), an IPv4 packet (20 bytes, RFC 791), an Ethernet frame (14-byte header and 4-byte FCS, IEEE 802.3), then the preamble on the wire. Each header is drawn to scale with its real field names.",
		Tags:        []string{"TCP/IP", "headers", "overhead"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-encap",
				h.Div(h.Class("flex flex-col gap-4"),
					h.Div(h.Data("bars", ""), h.Class("flex flex-col gap-2")),
					h.Div(h.Data("fields", ""), h.Class("min-h-40 rounded-lg border bg-background p-3")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Payload"),
					field("payload", "HTTP request", "B", 120, 1, 1460, 1),
					field("options", "TCP options", "B", 0, 0, 40, 4),
				),
				netStepper(),
				readouts([2]string{"on the wire", "wire"}, [2]string{"headers", "overhead"}, [2]string{"efficiency", "eff"}, [2]string{"note", "note"}),
			)
		},
	}
}

// ---------------------------------------------------------------- N2

func netHandshakeBlock() Block {
	return Block{
		Slug:        "handshake",
		Title:       "TCP handshake, data and teardown",
		Description: "The three-way handshake, one exchange of data and the four-segment close, with real sequence and acknowledgement numbers (SYN and FIN each consume one). Drop the SYN-ACK and the client retransmits its SYN after the initial 1-second timeout of RFC 6298.",
		Tags:        []string{"sequence diagram", "RFC 9293", "retransmission"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-handshake",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 520"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "TCP sequence diagram")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Connection"),
					field("isnc", "Client ISN", "", 1000, 0, 9999, 1),
					field("isns", "Server ISN", "", 5000, 0, 9999, 1),
					field("req", "Request", "B", 80, 1, 1460, 1),
					field("resp", "Response", "B", 300, 1, 1460, 1),
				),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"), toggle("net-hs-loss", "loss", "Lose the first SYN-ACK", false)),
				netStepper(),
				h.P(h.Data("out", "explain"), h.Class("min-h-16 text-xs leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- N3

func netCwndBlock() Block {
	return Block{
		Slug:        "congestion",
		Title:       "Congestion control (TCP Reno)",
		Description: "The sender's congestion window, round trip by round trip: slow start doubles it up to ssthresh, congestion avoidance adds one segment per RTT, three duplicate ACKs halve it (fast recovery) and a timeout drops it back to one segment (RFC 5681).",
		Tags:        []string{"AIMD", "slow start", "RFC 5681"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-cwnd",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 600 320"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Congestion window per round trip")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Sender"),
					field("ssthresh", "Initial ssthresh", "MSS", 32, 2, 128, 1),
					field("rtts", "Round trips", "", 40, 10, 80, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Losses"),
					field("dup", "3 dup ACKs at RTT", "", 14, 0, 80, 1),
					field("timeout", "Timeout at RTT", "", 28, 0, 80, 1),
					h.P(h.Class("text-[11px] text-muted-foreground"), "0 turns a loss off."),
				),
				readouts([2]string{"segments sent", "sent"}, [2]string{"max cwnd", "max"}, [2]string{"final ssthresh", "ss"}),
			)
		},
	}
}

// ---------------------------------------------------------------- N4

func netSubnetBlock() Block {
	return Block{
		Slug:        "subnets",
		Title:       "Subnet calculator",
		Description: "An IPv4 address with its prefix length, bit by bit: the network part, the host part, the mask and wildcard, the first and last usable hosts (with RFC 3021's /31 point-to-point exception). Below, an IPv6 address compressed by the canonical rules of RFC 5952.",
		Tags:        []string{"CIDR", "IPv4", "IPv6"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-5 rounded-xl border bg-background p-4 sm:p-5"), h.Data("net-subnet", ""),
				h.Div(h.Class("flex flex-wrap items-end gap-3"),
					netInput("cidr", "IPv4 address / prefix", "192.168.1.130/26", "w-64"),
					h.Div(h.Class("flex flex-wrap gap-1.5"),
						h.Map([]string{"10.0.0.1/8", "172.16.5.4/12", "192.168.1.130/26", "203.0.113.9/31", "198.51.100.7/32"}, func(p string) h.Node {
							return button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", p), h.Class("font-mono"), p)
						}),
					),
				),
				h.Div(h.Data("binary", ""), h.Class("scroll-thin overflow-x-auto rounded-lg border bg-code p-3 font-mono text-[12px] leading-6")),
				h.Dl(h.Data("facts", ""), h.Class("grid gap-x-6 gap-y-1.5 font-mono text-xs sm:grid-cols-2")),
				h.Div(h.Class("flex flex-col gap-3 border-t pt-4"),
					netInput("v6", "IPv6 address", "2001:0DB8:0000:0000:0008:0800:200C:417A", "w-full max-w-xl"),
					h.Dl(h.Data("v6facts", ""), h.Class("grid gap-x-6 gap-y-1.5 font-mono text-xs")),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- N5

func netRoutingBlock() Block {
	return Block{
		Slug:        "routing",
		Title:       "Routing: link state and distance vector",
		Description: "Six routers and their link costs. Link state (as in OSPF) floods the whole map and runs Dijkstra from each router; distance vector (as in RIP) only trades tables with neighbours, round by round. Cut a link in the three-router line and watch distance vector count to infinity (16 in RIP, RFC 2453).",
		Tags:        []string{"Dijkstra", "Bellman–Ford", "count to infinity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-routing",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 520 300"), h.Class("mx-auto block w-full max-w-[620px] select-none"), h.Role("img"), h.Aria("label", "Router graph")),
					h.Div(h.Data("table", ""), h.Class("scroll-thin overflow-x-auto")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Algorithm"),
					segs("Algorithm", [2]string{"ls", "Link state"}, [2]string{"dv", "Distance vector"}, [2]string{"inf", "Count to ∞"}),
				),
				h.Div(h.Data("view", "ls"), h.Class("flex flex-col gap-2"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Click a router to make it the source. Click a link to raise its cost (Shift-click lowers it)."),
				),
				h.Div(h.Data("view", "dv"), h.Hidden(), h.Class("flex flex-col gap-2"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "Each round, every router sends its table to its neighbours and keeps the cheapest route through any of them."),
				),
				h.Div(h.Data("view", "inf"), h.Hidden(), h.Class("flex flex-col gap-2"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), "A — B — C. The B–C link fails; without split horizon, A and B keep advertising C to each other."),
					toggle("net-rt-split", "split", "Split horizon with poisoned reverse", false),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "round"), hugeicons.ArrowRight01Icon(), h.Span(h.Data("label", ""), "Next step")),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "reset"), hugeicons.RefreshIcon(), "Reset"),
				),
				readouts([2]string{"step", "round"}, [2]string{"status", "status"}),
			)
		},
	}
}

// ---------------------------------------------------------------- N6

func netDNSBlock() Block {
	return Block{
		Slug:        "dns",
		Title:       "Resolving a name",
		Description: "What happens between typing a name and connecting: the stub resolver asks a recursive resolver, which walks down from a root server to the .com servers to the zone's authoritative server (RFC 1034/1035). Ask again and the answer comes from cache until its TTL runs out.",
		Tags:        []string{"DNS", "caching", "records"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-dns",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 300"), h.Class("mx-auto block w-full max-w-[640px]"), h.Role("img"), h.Aria("label", "DNS resolution path")),
					h.Div(h.Data("log", ""), h.Class("code scroll-thin max-h-48 min-h-28 overflow-auto rounded-lg border bg-background p-3 text-[12px] leading-5")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Query"),
					h.Div(h.Class("flex items-center gap-1 rounded-lg border p-0.5"), h.Role("tablist"), h.Aria("label", "Record type"),
						segButton("A", "A", true), segButton("AAAA", "AAAA", false), segButton("MX", "MX", false), segButton("CNAME", "CNAME", false), segButton("TXT", "TXT", false)),
					h.P(h.Class("font-mono text-xs text-muted-foreground"), "name: www.example.com"),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "query"), hugeicons.Globe02Icon(), "Resolve"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "wait"), hugeicons.Clock01Icon(), "+1 hour"),
				),
				button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "flush"), hugeicons.RefreshIcon(), "Flush the cache"),
				readouts([2]string{"queries sent", "sent"}, [2]string{"answer from", "from"}, [2]string{"TTL left", "ttl"}, [2]string{"clock", "clock"}),
				h.P(h.Class("text-[11px] leading-relaxed text-muted-foreground"), "Addresses are from the documentation ranges (RFC 5737, RFC 3849); server names are illustrative."),
			)
		},
	}
}

// ---------------------------------------------------------------- N7

func netTLSBlock() Block {
	return Block{
		Slug:        "tls",
		Title:       "The TLS 1.3 handshake",
		Description: "How HTTPS agrees on keys in one round trip (RFC 8446): the client guesses a key share in its first message, the server answers with its own, and everything after ServerHello is already encrypted. Compare with TLS 1.2's two round trips, and with 0-RTT resumption and its replay risk.",
		Tags:        []string{"RFC 8446", "1-RTT", "encryption"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-tls",
				h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 480"), h.Class("mx-auto block w-full max-w-[620px]"), h.Role("img"), h.Aria("label", "TLS handshake flow")),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Mode"),
					segs("Handshake", [2]string{"full", "TLS 1.3"}, [2]string{"zero", "0-RTT resumption"}, [2]string{"tls12", "TLS 1.2"}),
				),
				h.Div(h.Class("flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"),
					legendSwatch("var(--foreground)", "cleartext"),
					legendSwatch("var(--brand)", "encrypted { }"),
					legendSwatch("var(--code-add)", "application data"),
				),
				h.Div(h.Data("note", ""), h.Class("min-h-24 rounded-lg border bg-background p-3 text-xs leading-relaxed text-muted-foreground")),
				readouts([2]string{"round trips", "rtt"}, [2]string{"first data", "first"}),
			)
		},
	}
}

// ---------------------------------------------------------------- N8

func netHTTPBlock() Block {
	return Block{
		Slug:        "http",
		Title:       "HTTP requests and caching",
		Description: "Build a request and read the raw text a server would answer (HTTP semantics, RFC 9110; caching, RFC 9111). The URL is parsed with the browser's own WHATWG URL parser. Send If-None-Match with the current ETag and the answer is 304 Not Modified, with no body.",
		Tags:        []string{"HTTP/1.1", "ETag", "URL"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("net-http", ""),
				h.Div(h.Class("flex flex-wrap items-end gap-3"),
					h.Label(h.Class("flex flex-col gap-1 text-xs text-muted-foreground"), "Method",
						h.Select(h.Data("in", "method"), h.Class("h-9 rounded-md border border-input bg-background px-2 font-mono text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"),
							h.Map([]string{"GET", "HEAD", "POST", "PUT", "DELETE"}, func(m string) h.Node { return h.Option(h.Value(m), m) }),
						)),
					netInput("url", "URL", "https://www.example.com:8443/docs/caf%C3%A9?lang=fr&q=a+b#intro", "min-w-64 flex-1"),
				),
				h.Dl(h.Data("url", ""), h.Class("grid gap-x-6 gap-y-1 rounded-lg border bg-code p-3 font-mono text-xs sm:grid-cols-2")),
				h.Div(h.Class("flex flex-wrap items-center gap-x-5 gap-y-2"),
					toggle("net-http-inm", "inm", "Send If-None-Match", false),
					toggle("net-http-gzip", "gzip", "Accept gzip", true),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", "edit"), hugeicons.Edit02Icon(), "Change the resource"),
				),
				h.Div(h.Class("grid gap-3 lg:grid-cols-2"), netRaw("req", "Request"), netRaw("resp", "Response")),
				h.P(h.Data("out", "explain"), h.Class("min-h-10 text-sm leading-relaxed text-muted-foreground"), "—"),
			)
		},
	}
}

// ---------------------------------------------------------------- N9

func netLatencyBlock() Block {
	return Block{
		Slug:        "latency",
		Title:       "Latency and bandwidth",
		Description: "Why a fast link can still feel slow. Propagation delay is distance over signal speed (about 2×10⁸ m/s in fibre, two thirds of c); transmission delay is size over bandwidth. Their product, the bandwidth-delay product, is how much data must be in flight to keep the pipe full.",
		Tags:        []string{"propagation", "BDP", "calculator"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("net-latency",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("plot", ""), h.ViewBox("0 0 560 180"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Delay breakdown")),
					h.Div(h.Data("pipe", ""), h.Class("rounded-lg border bg-background p-3 text-xs leading-relaxed text-muted-foreground")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Link"),
					field("dist", "Distance", "km", 5837, 1, 80000, 1),
					field("bw", "Bandwidth", "Mbit/s", 100, 0.1, 100000, 0.1),
					field("size", "Message", "kB", 1500, 0.1, 1000000, 0.1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Medium"),
					segs("Medium", [2]string{"fibre", "Fibre"}, [2]string{"radio", "Radio / vacuum"}),
					h.Div(h.Class("flex flex-wrap gap-1.5 pt-1"),
						button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "5837"), "Paris–New York"),
						button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "1"), "Same city"),
						button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("preset", "71572"), "Via geostationary"),
					),
				),
				readouts([2]string{"propagation", "prop"}, [2]string{"transmission", "trans"}, [2]string{"one way", "total"}, [2]string{"RTT (min)", "rtt"}, [2]string{"BDP", "bdp"}),
			)
		},
	}
}

// ---------------------------------------------------------------- N10

func netCSSBlock() Block {
	return Block{
		Slug:        "css-layout",
		Title:       "Box model and flexbox",
		Description: "How a browser sizes and places boxes. In the box model, width means the content box unless box-sizing is border-box; padding and border add to it, margin sits outside. The flexbox tab lays out four real items with the properties you pick, and prints the CSS.",
		Tags:        []string{"CSS", "playground", "live"},
		Wide:        true,
		Render: func() h.Node {
			sel := func(name string, opts ...string) h.Node {
				return h.Label(h.Class("flex items-center justify-between gap-3 text-sm"),
					h.Span(h.Class("font-mono text-xs text-muted-foreground"), name),
					h.Select(h.Data("css", name), h.Class("h-8 rounded-md border border-input bg-background px-2 font-mono text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-xs"),
						h.Map(opts, func(o string) h.Node { return h.Option(h.Value(o), o) })))
			}
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("net-css", ""),
				segs("Topic", [2]string{"box", "Box model"}, [2]string{"flex", "Flexbox"}),
				h.Div(h.Data("view", "box"), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"),
					h.Div(h.Class("flex flex-col gap-3"),
						h.Div(h.Data("boxdiagram", ""), h.Class("scroll-thin overflow-x-auto rounded-lg border bg-code p-4")),
						h.Pre(h.Data("boxcss", ""), h.Class("code rounded-lg border bg-code p-3 text-[12px] leading-5 whitespace-pre")),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						field("width", "width", "px", 200, 0, 400, 1),
						field("height", "height", "px", 80, 0, 300, 1),
						field("padding", "padding", "px", 16, 0, 60, 1),
						field("border", "border", "px", 4, 0, 30, 1),
						field("margin", "margin", "px", 24, 0, 60, 1),
						toggle("net-css-bb", "borderbox", "box-sizing: border-box", false),
						readouts([2]string{"rendered width", "rw"}, [2]string{"rendered height", "rh"}, [2]string{"space taken", "space"}),
					),
				),
				h.Div(h.Data("view", "flex"), h.Hidden(), h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"),
					h.Div(h.Class("flex flex-col gap-3"),
						h.Div(h.Data("flexbox", ""), h.Class("min-h-48 rounded-lg border border-dashed bg-code p-2"),
							h.Map([]string{"1", "2", "3", "4"}, func(n string) h.Node {
								return h.Div(h.Data("item", n), h.Class("flex min-h-10 min-w-12 items-center justify-center rounded-md border border-brand/40 bg-brand/10 px-3 py-2 font-mono text-sm text-brand"), n)
							}),
						),
						h.Pre(h.Data("flexcss", ""), h.Class("code rounded-lg border bg-code p-3 text-[12px] leading-5 whitespace-pre")),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						sel("flex-direction", "row", "row-reverse", "column", "column-reverse"),
						sel("justify-content", "flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"),
						sel("align-items", "stretch", "flex-start", "center", "flex-end", "baseline"),
						sel("flex-wrap", "nowrap", "wrap"),
						field("gap", "gap", "px", 8, 0, 40, 1),
						field("grow2", "item 2 flex-grow", "", 0, 0, 5, 1),
						h.P(h.Class("flex items-center gap-1.5 text-[11px] text-muted-foreground"), "Change a select with", kbd.Kbd("↑"), kbd.Kbd("↓")),
					),
				),
			)
		},
	}
}
