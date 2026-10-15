package site

import (
	"fmt"

	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// FinanceBlocks lists the finance and accounting gallery in display order.
func FinanceBlocks() []Block {
	return []Block{
		finLedgerBlock(),
		finStatementsBlock(),
		finBreakEvenBlock(),
		finNPVBlock(),
		finLoanBlock(),
		finBondBlock(),
		finBlackScholesBlock(),
		finStrategiesBlock(),
		finBinomialBlock(),
		finPortfolioBlock(),
	}
}

// finSvg is a plot surface for the finance blocks.
func finSvg(attr, label string, w, hgt int) h.Node {
	return h.Svg(h.Data(attr, ""), h.ViewBox(fmt.Sprintf("0 0 %d %d", w, hgt)), h.Class("mx-auto block w-full max-w-[640px] select-none"),
		h.Role("img"), h.Aria("label", label))
}

// finFormula is a small mono line stating the formula a block computes.
func finFormula(s string) h.Node {
	return h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), s)
}

func finButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

// finTable is an empty table whose body the module fills.
func finTable(attr string, cols ...string) h.Node {
	return h.Div(h.Class("scroll-thin overflow-x-auto"),
		h.Table(h.Class("w-full text-[13px] tabular-nums"),
			h.Thead(h.Tr(h.Class("border-b text-left text-[11px] text-muted-foreground"),
				h.MapIdx(cols, func(i int, c string) h.Node {
					return h.Th(h.Class(h.Ternary(i == 0, "py-1.5 pr-3 font-normal", "py-1.5 pl-3 text-right font-normal")), c)
				}))),
			h.Tbody(h.Data(attr, ""), h.Class("font-mono")),
		),
	)
}

// ---------------------------------------------------------------- F1

func finLedgerBlock() Block {
	return Block{
		Slug:        "ledger",
		Title:       "Double-entry bookkeeping",
		Description: "A small bakery's first month, one transaction at a time. Every transaction is posted twice, as a debit and an equal credit, so the T-accounts change together and the trial balance always balances. Assets and expenses grow on the debit side; liabilities, equity and revenue on the credit side.",
		Tags:        []string{"journal", "T-accounts", "trial balance"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5"), h.Data("fin-ledger", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-2"),
					finButton("next", "Post next", hugeicons.ArrowRight01Icon()),
					finButton("all", "Post all", hugeicons.PlayIcon()),
					finButton("reset", "Reset", hugeicons.RefreshIcon()),
					h.Span(h.Data("out", "step"), h.Class("ml-auto font-mono text-xs text-muted-foreground tabular-nums"), "0 / 8 posted"),
				),
				h.Ol(h.Data("fin-txs", ""), h.Class("grid gap-1.5 text-sm sm:grid-cols-2")),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("Journal"),
						finTable("fin-journal", "Account", "Debit", "Credit"),
					),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("T-accounts"),
						h.Div(h.Data("fin-taccounts", ""), h.Class("grid grid-cols-2 gap-2 sm:grid-cols-3")),
					),
				),
				h.Div(h.Class("grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"),
					h.Div(h.Class("flex flex-col gap-2"),
						panelLabel("Trial balance"),
						finTable("fin-trial", "Account", "Debit", "Credit"),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						panelLabel("The accounting equation"),
						h.P(h.Data("out", "equation"), h.Class("font-mono text-sm leading-relaxed"), "—"),
						h.P(h.Data("out", "check"), h.Class("text-sm"), "—"),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"Debit means left, credit means right: nothing more. Revenue and expenses are temporary equity accounts, closed into retained earnings at the end of the period."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- F2

func finStatementsBlock() Block {
	row := func(label, key string, strong bool) h.Node {
		return h.Tr(h.Class(h.Ternary(strong, "border-t font-medium", "")),
			h.Td(h.Class("py-1 pr-3"), label),
			h.Td(h.Data("out", key), h.Class("py-1 pl-3 text-right font-mono tabular-nums transition-colors duration-500 data-[changed]:bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] data-[changed]:duration-0"), "—"))
	}
	statement := func(title string, rows ...h.Node) h.Node {
		return h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"),
			panelLabel(title),
			h.Table(h.Class("w-full text-[13px]"), h.Tbody(h.Group(rows))),
		)
	}
	return Block{
		Slug:        "statements",
		Title:       "Three linked statements",
		Description: "The income statement, the balance sheet and the cash-flow statement are three views of the same year. Change one input and watch it ripple: net income flows into retained earnings and starts the cash-flow statement, and the cash it ends with is the cash on the balance sheet, which still balances.",
		Tags:        []string{"income statement", "balance sheet", "cash flow"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[260px_minmax(0,1fr)]"), h.Data("fin-statements", ""),
				h.Div(h.Class("flex flex-col gap-4 border-b p-5 lg:border-r lg:border-b-0"),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("The year, € thousands"),
						field("rev", "Revenue", "k€", 120, 0, 500, 1),
						field("cogs", "Cost of sales", "k€", 50, 0, 400, 1),
						field("opex", "Operating costs", "k€", 30, 0, 300, 1),
						field("dep", "Depreciation", "k€", 10, 0, 60, 1),
						field("int", "Interest paid", "k€", 2, 0, 30, 0.5),
						field("tax", "Tax rate", "%", 25, 0, 50, 1),
					),
					h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Cash and working capital"),
						field("capex", "Capex", "k€", 15, 0, 100, 1),
						field("dar", "Δ receivables", "k€", 5, -15, 30, 1),
						field("dinv", "Δ inventory", "k€", 3, -10, 30, 1),
						field("dap", "Δ payables", "k€", 4, -12, 30, 1),
						field("debt", "New borrowing", "k€", 0, -30, 50, 1),
						field("div", "Dividends", "k€", 5, 0, 50, 1),
					),
				),
				h.Div(h.Class("grid content-start gap-3 p-4 sm:p-5 xl:grid-cols-3"),
					statement("Income statement",
						row("Revenue", "is-rev", false), row("Cost of sales", "is-cogs", false), row("Gross profit", "is-gp", true),
						row("Operating costs", "is-opex", false), row("Depreciation", "is-dep", false), row("Operating profit", "is-ebit", true),
						row("Interest", "is-int", false), row("Tax", "is-tax", false), row("Net income", "is-ni", true),
					),
					statement("Cash-flow statement",
						row("Net income", "cf-ni", false), row("+ Depreciation", "cf-dep", false), row("− Δ receivables", "cf-ar", false),
						row("− Δ inventory", "cf-inv", false), row("+ Δ payables", "cf-ap", false), row("Operating cash flow", "cf-cfo", true),
						row("Capex", "cf-capex", false), row("Borrowing", "cf-debt", false), row("Dividends", "cf-div", false),
						row("Change in cash", "cf-dcash", true),
					),
					statement("Balance sheet, year end",
						row("Cash", "bs-cash", false), row("Receivables", "bs-ar", false), row("Inventory", "bs-inv", false),
						row("Property & equipment", "bs-ppe", false), row("Total assets", "bs-ta", true),
						row("Payables", "bs-ap", false), row("Debt", "bs-debt", false), row("Equity", "bs-eq", false),
						row("Liabilities + equity", "bs-tle", true),
					),
					h.P(h.Data("out", "check"), h.Class("text-sm xl:col-span-3"), "—"),
					h.P(h.Class("text-xs leading-relaxed text-muted-foreground xl:col-span-3"),
						"Opening balance sheet: cash 20, receivables 15, inventory 10, equipment 60 = payables 12, debt 30, equity 63 (k€). Tax is zero when the year makes a loss (no carry-forward modelled)."),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- F3

func finBreakEvenBlock() Block {
	return Block{
		Slug:        "break-even",
		Title:       "Break-even and unit economics",
		Description: "Every unit sold contributes its price minus its variable cost toward the fixed costs. Once those are covered, the contribution is profit. The break-even point is where the revenue line crosses the total-cost line; operating leverage measures how much a 1% change in sales moves profit.",
		Tags:        []string{"contribution margin", "operating leverage", "cost–volume–profit"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-breakeven",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "revenue"),
						legendSwatch("var(--foreground)", "total cost"),
						legendSwatch("var(--code-add)", "profit"),
						legendSwatch("var(--code-del)", "loss"),
					),
					finSvg("plot", "Revenue and total cost against units sold", 560, 340),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Per month"),
					field("fixed", "Fixed costs", "€", 12000, 0, 100000, 100),
					field("price", "Price", "€/unit", 25, 1, 500, 0.5),
					field("var", "Variable cost", "€/unit", 10, 0, 500, 0.5),
					field("q", "Units sold", "units", 1100, 0, 10000, 10),
				),
				finFormula("Q* = F / (p − v)"),
				readouts([2]string{"contribution", "cm"}, [2]string{"CM ratio", "cmr"}, [2]string{"break-even", "be"},
					[2]string{"break-even sales", "bes"}, [2]string{"profit", "profit"}, [2]string{"margin of safety", "mos"}, [2]string{"operating leverage", "dol"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F4

func finNPVBlock() Block {
	cells := []float64{-1000, 300, 300, 300, 300, 300, 0}
	return Block{
		Slug:        "npv-irr",
		Title:       "NPV and IRR",
		Description: "A project as a row of yearly cash flows. Discounting each one back to today and adding them up gives the net present value; the internal rate of return is the discount rate that makes it zero. When the cash flows change sign more than once, the NPV curve can cross zero twice, and \"the\" IRR stops meaning anything.",
		Tags:        []string{"discounting", "IRR", "multiple roots"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-npv",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid grid-cols-4 gap-2 sm:grid-cols-7"),
						h.MapIdx(cells, func(i int, v float64) h.Node {
							return h.Label(h.Class("flex flex-col items-center gap-1"),
								h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), fmt.Sprintf("year %d", i)),
								h.Input(h.Type("text"), h.Attr("inputmode", "decimal"), h.Data("scrub", fmt.Sprintf("c%d", i)), h.Value(fmt.Sprint(v)),
									h.Data("min", "-5000"), h.Data("max", "5000"), h.Data("step", "10"), h.Attr("autocomplete", "off"),
									h.Aria("label", fmt.Sprintf("Cash flow in year %d", i)),
									h.Class("h-8 w-full min-w-0 cursor-ew-resize rounded-md border border-input bg-background px-1 text-center font-mono text-sm tabular-nums shadow-xs outline-none focus:cursor-text focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[scrubbing]:border-ring")),
							)
						}),
					),
					finSvg("plot", "NPV against the discount rate", 560, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Discounting"),
					field("rate", "Discount rate", "%", 8, 0, 60, 0.25),
					segs("Presets", [2]string{"standard", "Standard"}, [2]string{"two", "Two IRRs"}, [2]string{"none", "No IRR"}),
				),
				finFormula("NPV(r) = Σ Cₜ / (1 + r)ᵗ"),
				readouts([2]string{"NPV", "npv"}, [2]string{"IRR", "irr"}, [2]string{"sign changes", "signs"}, [2]string{"payback", "payback"}, [2]string{"verdict", "verdict"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F5

func finLoanBlock() Block {
	return Block{
		Slug:        "amortization",
		Title:       "Loan amortization",
		Description: "A fixed-rate loan repaid in equal monthly payments. Early payments are mostly interest, late ones mostly principal. Add a little every month and see how many months and how much interest it saves.",
		Tags:        []string{"annuity", "schedule", "extra payments"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-loan",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--code-del)", "interest"),
						legendSwatch("var(--vec-u)", "principal"),
						legendSwatch("var(--foreground)", "balance"),
					),
					finSvg("plot", "Interest and principal paid each year, with the remaining balance", 560, 300),
					finTable("fin-schedule", "Year", "Paid", "Interest", "Principal", "Balance"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Loan"),
					field("p", "Amount", "k€", 200, 1, 2000, 1),
					field("r", "Annual rate", "%", 3.5, 0, 20, 0.05),
					field("y", "Term", "years", 20, 1, 40, 1),
					field("x", "Extra / month", "€", 0, 0, 5000, 10),
				),
				finFormula("A = P · i / (1 − (1 + i)⁻ⁿ), i = r/12"),
				readouts([2]string{"monthly payment", "pmt"}, [2]string{"total interest", "ti"}, [2]string{"paid off in", "months"}, [2]string{"saved", "saved"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F6

func finBondBlock() Block {
	return Block{
		Slug:        "bonds",
		Title:       "Bond price, duration and convexity",
		Description: "A bond is a row of coupons plus the face value at maturity, priced by discounting them at the market yield. When yields rise, prices fall: duration is the slope of that curve, convexity its bend. The tangent line (duration alone) underestimates the price on both sides; adding convexity closes most of the gap.",
		Tags:        []string{"yield", "Macaulay duration", "convexity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-bond",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--foreground)", "exact price"),
						legendSwatch("var(--vec-u)", "duration only"),
						legendSwatch("var(--brand)", "duration + convexity"),
					),
					finSvg("plot", "Price against yield", 560, 320),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Bond (face 100)"),
					field("c", "Coupon", "%/yr", 4, 0, 15, 0.25),
					field("y", "Yield", "%/yr", 5, 0, 15, 0.05),
					field("n", "Maturity", "years", 10, 1, 40, 1),
					segs("Coupons per year", [2]string{"1", "Annual"}, [2]string{"2", "Semi-annual"}),
				),
				readouts([2]string{"price", "price"}, [2]string{"Macaulay", "mac"}, [2]string{"modified", "mod"},
					[2]string{"convexity", "cx"}, [2]string{"+1% yield", "shock"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F7

func finBlackScholesBlock() Block {
	return Block{
		Slug:        "black-scholes",
		Title:       "Black–Scholes and the Greeks",
		Description: "The 1973 Black–Scholes–Merton price of a European option on a stock that pays no dividend, with its sensitivities: delta, gamma, vega, theta and rho. The curve shows today's value against the stock price, above the payoff at expiry; the gap is time value. Put–call parity is checked live.",
		Tags:        []string{"options", "Greeks", "put–call parity"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-bs",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "value today"),
						legendSwatch("var(--foreground)", "payoff at expiry"),
					),
					finSvg("plot", "Option value against the stock price", 560, 320),
					h.Dl(h.Data("fin-greeks", ""), h.Class("grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border bg-code p-3 font-mono text-xs sm:grid-cols-3")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Contract"),
					segs("Option type", [2]string{"call", "Call"}, [2]string{"put", "Put"}),
					field("s", "Stock price S", "", 100, 1, 300, 0.5),
					field("k", "Strike K", "", 100, 1, 300, 0.5),
					field("t", "Time T", "years", 1, 0.01, 5, 0.01),
					field("v", "Volatility σ", "%", 20, 1, 150, 0.5),
					field("r", "Rate r", "%", 5, 0, 20, 0.05),
				),
				finFormula("d₁ = (ln(S/K) + (r + σ²/2)T) / σ√T, d₂ = d₁ − σ√T"),
				readouts([2]string{"call", "call"}, [2]string{"put", "put"}, [2]string{"C − P", "parity"}, [2]string{"S − Ke^(−rT)", "parity2"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F8

func finStrategiesBlock() Block {
	return Block{
		Slug:        "option-strategies",
		Title:       "Option strategies",
		Description: "Combinations of calls, puts and stock, priced with Black–Scholes and drawn as profit at expiry. The straddle bets on movement in either direction, spreads trade upside for a cheaper entry, the covered call sells away the upside for income. Break-evens and the worst and best cases are computed from the legs.",
		Tags:        []string{"payoff diagrams", "spreads", "break-even"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-strat",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--brand)", "profit at expiry"),
						legendSwatch("var(--vec-u)", "value today (before expiry)"),
					),
					finSvg("plot", "Profit against the stock price at expiry", 560, 320),
					h.Ul(h.Data("fin-legs", ""), h.Class("flex flex-wrap gap-1.5 font-mono text-[11px]")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Strategy"),
					segs("Strategy", [2]string{"straddle", "Straddle"}, [2]string{"strangle", "Strangle"}, [2]string{"bull", "Bull call spread"},
						[2]string{"bear", "Bear put spread"}, [2]string{"covered", "Covered call"}, [2]string{"condor", "Iron condor"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Market"),
					field("s", "Stock price", "", 100, 10, 300, 0.5),
					field("w", "Strike width", "", 10, 1, 50, 0.5),
					field("t", "Time to expiry", "years", 0.25, 0.01, 2, 0.01),
					field("v", "Volatility σ", "%", 25, 1, 120, 0.5),
				),
				readouts([2]string{"net premium", "net"}, [2]string{"break-even", "be"}, [2]string{"max profit", "maxp"}, [2]string{"max loss", "maxl"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F9

func finBinomialBlock() Block {
	return Block{
		Slug:        "binomial",
		Title:       "Binomial option pricing",
		Description: "The Cox–Ross–Rubinstein tree (1979): in each step the stock goes up by u or down by d, and the option is valued backwards from expiry at risk-neutral odds. As the steps multiply, a European option's price converges to Black–Scholes. An American put can be exercised early, and the tree shows where that pays.",
		Tags:        []string{"CRR tree", "risk-neutral", "early exercise"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-binom",
				h.Div(h.Class("flex flex-col gap-3"),
					finSvg("tree", "Binomial tree with stock prices and option values", 560, 300),
					finSvg("conv", "Price against the number of steps, with Black–Scholes", 560, 170),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Option"),
					segs("Option", [2]string{"ec", "European call"}, [2]string{"ep", "European put"}, [2]string{"ap", "American put"}),
					field("n", "Steps (tree)", "", 4, 1, 6, 1),
					field("s", "Stock price", "", 100, 10, 300, 1),
					field("k", "Strike", "", 100, 10, 300, 1),
					field("t", "Time", "years", 1, 0.05, 5, 0.05),
					field("v", "Volatility σ", "%", 20, 1, 100, 0.5),
					field("r", "Rate r", "%", 5, 0, 20, 0.25),
				),
				finFormula("u = e^(σ√Δt), d = 1/u, p = (e^(rΔt) − d)/(u − d)"),
				readouts([2]string{"tree price", "tree"}, [2]string{"500 steps", "fine"}, [2]string{"Black–Scholes", "bs"}, [2]string{"u, d, p", "udp"}),
			)
		},
	}
}

// ---------------------------------------------------------------- F10

func finPortfolioBlock() Block {
	return Block{
		Slug:        "portfolio",
		Title:       "Diversification and the efficient frontier",
		Description: "Three assets with illustrative expected returns, volatilities and correlations (not forecasts). Every long-only mix lands somewhere in the risk–return plane; the upper edge is the efficient frontier (Markowitz, 1952). Lower the correlations and the frontier bends left: the same return for less risk. The line from the risk-free rate to the tangency portfolio is the capital market line.",
		Tags:        []string{"Markowitz", "Sharpe ratio", "correlation"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("fin-port",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
						legendSwatch("var(--vec-u)", "mixes (1% grid)"),
						legendSwatch("var(--foreground)", "efficient frontier"),
						legendSwatch("var(--brand)", "capital market line"),
					),
					finSvg("plot", "Expected return against volatility for every mix", 560, 340),
					h.Dl(h.Data("fin-weights", ""), h.Class("grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border bg-code p-3 font-mono text-xs sm:grid-cols-2")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Assets (illustrative)"),
					field("m1", "Stocks return", "%", 8, -5, 20, 0.25), field("s1", "Stocks σ", "%", 18, 1, 60, 0.5),
					field("m2", "Bonds return", "%", 3, -5, 20, 0.25), field("s2", "Bonds σ", "%", 6, 1, 60, 0.5),
					field("m3", "Gold return", "%", 5, -5, 20, 0.25), field("s3", "Gold σ", "%", 15, 1, 60, 0.5),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Correlations"),
					field("r12", "Stocks–bonds", "", 0.1, -1, 1, 0.05),
					field("r13", "Stocks–gold", "", 0, -1, 1, 0.05),
					field("r23", "Bonds–gold", "", 0.2, -1, 1, 0.05),
					field("rf", "Risk-free rate", "%", 2, 0, 10, 0.25),
				),
				h.P(h.Data("out", "warn"), h.Class("text-xs text-[var(--code-del)] empty:hidden")),
			)
		},
	}
}
