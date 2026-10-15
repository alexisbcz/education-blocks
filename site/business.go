package site

import (
	h "github.com/alexisbcz/libhtml"
)

// BusinessBlocks lists the business and accounting gallery in display
// order. Double entry, the linked statements and break-even live in the
// Finance collection; these blocks pick up from there.
func BusinessBlocks() []Block {
	return []Block{
		bizAccrualBlock(),
		bizDepreciationBlock(),
		bizInventoryBlock(),
		bizVarianceBlock(),
		bizCCCBlock(),
		bizRatiosBlock(),
		bizMarkupBlock(),
		bizUnitBlock(),
		bizRunwayBlock(),
		bizCapTableBlock(),
	}
}

// bizNote is the small print under a block's controls.
func bizNote(s string) h.Node {
	return h.P(h.Class("text-xs leading-relaxed text-muted-foreground"), s)
}

// bizLegend is a row of legend swatches.
func bizLegend(items ...[2]string) h.Node {
	return h.Div(h.Class("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground"),
		h.Map(items, func(it [2]string) h.Node { return legendSwatch(it[0], it[1]) }),
	)
}

// ---------------------------------------------------------------- B1

func bizAccrualBlock() Block {
	return Block{
		Slug:        "accrual-vs-cash",
		Title:       "Accrual versus cash",
		Description: "A design studio's year, counted twice. Cash accounting records money when it moves; accrual accounting records revenue when it is earned and costs when they are used up. Switch the five events on and off: the two profits drift apart, and the gap is always explained, to the euro, by the balance-sheet items the accruals create.",
		Tags:        []string{"deferred revenue", "prepaid expenses", "receivables"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-accrual",
				h.Div(h.Class("flex flex-col gap-2"),
					bizLegend([2]string{"var(--vec-u)", "cash result"}, [2]string{"var(--brand)", "accrual profit"}),
					finSvg("plot", "Monthly cash result and accrual profit over one year", 600, 300),
					h.Div(h.Class("grid gap-1 border-t pt-3"),
						panelLabel("Profit − change in cash, explained"),
						finTable("biz-recon", "Balance-sheet item", "Effect"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"), panelLabel("Events"),
					toggle("biz-acc-annual", "annual", "Annual plan, €12,000 paid in January", true),
					toggle("biz-acc-invoice", "invoice", "€6,000 project invoiced in November, paid in 60 days", true),
					toggle("biz-acc-insurance", "insurance", "€2,400 insurance prepaid for 12 months in July", true),
					toggle("biz-acc-laptop", "laptop", "€1,800 laptop in April, 3-year life", true),
					toggle("biz-acc-bill", "bill", "€300 December power bill, paid in January", true),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Through month"),
					field("month", "End of month", "1–12", 12, 1, 12, 1),
				),
				readouts([2]string{"cash result", "cash"}, [2]string{"accrual profit", "profit"}, [2]string{"difference", "diff"}, [2]string{"explained", "check"}),
				bizNote("Every month also has €4,000 of sales collected at once and €1,500 of rent paid and used. Depreciation is straight-line from the month of purchase, with no salvage value."),
			)
		},
	}
}

// ---------------------------------------------------------------- B2

func bizDepreciationBlock() Block {
	return Block{
		Slug:        "depreciation",
		Title:       "Depreciation methods",
		Description: "A delivery van costs €32,000 and should sell for €4,000 after five years. Depreciation spreads the €28,000 it will use up across those years. The four methods agree on the total and disagree on the timing, which moves profit, and the tax on it, between years.",
		Tags:        []string{"straight-line", "declining balance", "units of production"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-depreciation",
				h.Div(h.Class("flex flex-col gap-2"),
					bizLegend([2]string{"var(--brand)", "book value, selected method"}, [2]string{"var(--muted-foreground)", "other methods"}),
					finSvg("plot", "Book value of the asset under each depreciation method", 600, 280),
					finTable("biz-dep-table", "Year", "Depreciation", "Accumulated", "Book value"),
				),
				segs("Method", [2]string{"sl", "Straight-line"}, [2]string{"ddb", "Double declining"}, [2]string{"syd", "Sum of years"}, [2]string{"uop", "Units"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("The asset"),
					field("cost", "Cost", "€", 32000, 1000, 200000, 500),
					field("salvage", "Salvage value", "€", 4000, 0, 100000, 500),
					field("life", "Useful life", "years", 5, 2, 10, 1),
				),
				h.P(h.Data("out", "formula"), h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), "—"),
				readouts([2]string{"year 1 charge", "y1"}, [2]string{"last-year charge", "yn"}, [2]string{"total", "total"}),
				bizNote("Amounts are kept in whole cents; the last year absorbs the rounding so the book value lands exactly on salvage. Units of production assumes the van drives 30%, 25%, 20%, 15% and 10% of its lifetime distance in a five-year life (spread evenly otherwise)."),
			)
		},
	}
}

// ---------------------------------------------------------------- B3

func bizInventoryBlock() Block {
	return Block{
		Slug:        "inventory-costing",
		Title:       "FIFO, LIFO and weighted average",
		Description: "A bike shop buys the same helmet four times a year at rising prices and sells some of them. Which helmets did it sell? The cost-flow assumption decides, and with it the cost of goods sold, the inventory left on the balance sheet and the taxable profit. The physical helmets are identical; only the accounting differs.",
		Tags:        []string{"cost of goods sold", "inventory", "IAS 2"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-inventory",
				h.Div(h.Class("flex flex-col gap-3"),
					bizLegend([2]string{"var(--code-del)", "sold (cost of goods sold)"}, [2]string{"var(--code-add)", "left in inventory"}),
					finSvg("plot", "Purchase lots, split into units sold and units left", 600, 230),
					finTable("biz-inv-table", "Method", "COGS", "Ending inventory", "Gross profit", "Tax at 25%"),
				),
				segs("Method", [2]string{"fifo", "FIFO"}, [2]string{"lifo", "LIFO"}, [2]string{"avg", "Weighted average"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("The year"),
					field("rise", "Price rise per purchase", "%", 10, -20, 40, 1),
					field("sold", "Helmets sold", "units", 600, 0, 800, 10),
					field("price", "Selling price", "€", 45, 1, 200, 1),
				),
				readouts([2]string{"units available", "avail"}, [2]string{"cost available", "costavail"}, [2]string{"COGS + ending", "check"}),
				bizNote("Periodic system: the year's purchases are pooled and the method is applied at year end. Opening stock is 100 helmets at €20. LIFO is not permitted under IFRS (IAS 2); US GAAP allows it, and a US company that uses it for tax must also use it in its financial statements."),
			)
		},
	}
}

// ---------------------------------------------------------------- B4

func bizVarianceBlock() Block {
	return Block{
		Slug:        "variance-analysis",
		Title:       "Budget versus actual",
		Description: "A candle workshop budgeted 1,000 candles and made a different number. Standard costing splits the gap between budgeted and actual profit into causes: how many were sold, at what price, how much wax was used and what it cost, how long the work took and at what wage, and what fixed costs did. Each bar is favourable (it raised profit) or adverse.",
		Tags:        []string{"standard costing", "flexible budget", "waterfall"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-variance",
				h.Div(h.Class("flex flex-col gap-2"),
					bizLegend([2]string{"var(--code-add)", "favourable"}, [2]string{"var(--code-del)", "adverse"}, [2]string{"var(--foreground)", "profit"}),
					finSvg("plot", "Waterfall from budgeted profit to actual profit", 620, 320),
					h.P(h.Class("font-mono text-[11px] text-muted-foreground"),
						"Standard per candle: price €50 · wax 2 kg at €5 · labour 0.5 h at €20 · fixed costs €15,000 a month."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("What actually happened"),
					field("units", "Candles sold", "units", 1100, 0, 3000, 10),
					field("price", "Average price", "€", 48, 1, 150, 0.5),
					field("kg", "Wax used", "kg", 2350, 0, 8000, 10),
					field("kgp", "Wax price", "€/kg", 4.8, 0.5, 20, 0.1),
					field("hrs", "Labour hours", "h", 520, 0, 3000, 5),
					field("rate", "Wage rate", "€/h", 21, 5, 60, 0.5),
					field("fixed", "Fixed costs", "€", 15400, 0, 60000, 100),
				),
				readouts([2]string{"budgeted profit", "budget"}, [2]string{"actual profit", "actual"}, [2]string{"sum of variances", "sum"}),
				bizNote("Assumes every candle made is sold (no change in stock). The volume variance is valued at the standard contribution per candle, €30, so the budgeted profit is €15,000."),
			)
		},
	}
}

// ---------------------------------------------------------------- B5

func bizCCCBlock() Block {
	return Block{
		Slug:        "cash-conversion-cycle",
		Title:       "The cash conversion cycle",
		Description: "Money leaves when the business pays its suppliers and comes back when its customers pay. In between it sits in stock and in unpaid invoices. The cash conversion cycle counts those days: days of inventory plus days of receivables, minus the days suppliers let you wait. A supermarket that sells before it pays runs it below zero.",
		Tags:        []string{"working capital", "DIO", "DSO", "DPO"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-ccc",
				h.Div(h.Class("flex flex-col gap-2"),
					bizLegend([2]string{"var(--vec-u)", "in stock"}, [2]string{"var(--vec-v)", "awaiting payment"}, [2]string{"var(--muted-foreground)", "supplier credit"}, [2]string{"var(--brand)", "cash gap"}),
					finSvg("plot", "Timeline of inventory, receivables and payables days", 600, 230),
					bizNote("Each bar is an average: a business with 80 days of inventory holds, on average, 80 days' worth of cost of sales on its shelves. A negative cycle means customers pay before suppliers do, so growth brings in cash instead of consuming it."),
				),
				segs("Business", [2]string{"maker", "Manufacturer"}, [2]string{"grocer", "Supermarket"}, [2]string{"agency", "Agency"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("From the statements, € thousands"),
					field("rev", "Revenue", "k€/yr", 3650, 100, 20000, 10),
					field("cogs", "Cost of sales", "k€/yr", 2190, 0, 20000, 10),
					field("inv", "Inventory", "k€", 480, 0, 5000, 5),
					field("ar", "Receivables", "k€", 450, 0, 5000, 5),
					field("ap", "Payables", "k€", 240, 0, 5000, 5),
				),
				h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), "DIO = inventory / COGS × 365 · DSO = receivables / revenue × 365 · DPO = payables / COGS × 365"),
				readouts([2]string{"DIO", "dio"}, [2]string{"DSO", "dso"}, [2]string{"DPO", "dpo"}, [2]string{"cycle", "ccc"}, [2]string{"working capital", "wc"}, [2]string{"collect 10 days sooner", "ten"}),
			)
		},
	}
}

// ---------------------------------------------------------------- B6

func bizRatiosBlock() Block {
	return Block{
		Slug:        "ratios-dupont",
		Title:       "Ratios and the DuPont split",
		Description: "Return on equity is three ratios multiplied: how much of each sale is profit, how many sales each euro of assets produces, and how many euros of assets each euro of equity carries. Three made-up companies reach similar returns by very different routes: thick margins, fast turnover, or borrowed money.",
		Tags:        []string{"ROE", "liquidity", "leverage"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-ratios",
				h.Div(h.Class("flex flex-col gap-3"),
					finSvg("plot", "Return on equity as margin times turnover times leverage", 600, 200),
					h.Div(h.Data("biz-ratio-grid", ""), h.Class("grid grid-cols-2 gap-2 sm:grid-cols-4")),
				),
				segs("Company", [2]string{"software", "Software"}, [2]string{"grocer", "Supermarket"}, [2]string{"utility", "Utility"}),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Statements, € millions"),
					field("rev", "Revenue", "M€", 400, 1, 5000, 5),
					field("ebit", "Operating profit", "M€", 100, -500, 2000, 1),
					field("interest", "Interest", "M€", 2, 0, 500, 0.5),
					field("ni", "Net income", "M€", 74, -500, 2000, 1),
					field("assets", "Total assets", "M€", 600, 1, 20000, 5),
					field("equity", "Equity", "M€", 450, 1, 10000, 5),
					field("ca", "Current assets", "M€", 300, 0, 5000, 5),
					field("stock", "Inventory", "M€", 0, 0, 5000, 5),
					field("cl", "Current liabilities", "M€", 120, 1, 5000, 5),
				),
				bizNote("All three companies are synthetic. Ratios use year-end balances; analysts often average opening and closing balances instead."),
			)
		},
	}
}

// ---------------------------------------------------------------- B7

func bizMarkupBlock() Block {
	return Block{
		Slug:        "markup-margin-discounts",
		Title:       "Markup, margin and discounts",
		Description: "Markup is profit over cost; margin is profit over price. A 50% markup is a 33% margin, and mixing them up is a classic pricing error. Discounts cut straight into the margin: at a 30% margin, a 20% discount leaves a third of the profit per sale, so volume must triple just to stand still.",
		Tags:        []string{"gross margin", "markup", "pricing"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-markup",
				h.Div(h.Class("flex flex-col gap-2"),
					bizLegend([2]string{"var(--brand)", "your margin"}, [2]string{"var(--muted-foreground)", "20%, 40%, 60% margins"}),
					finSvg("plot", "Extra sales volume needed to keep the same gross profit after a discount", 600, 300),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("One product"),
					field("cost", "Unit cost", "€", 60, 0.5, 1000, 0.5),
					field("price", "Price", "€", 100, 0.5, 2000, 0.5),
					field("disc", "Discount", "%", 10, 0, 60, 1),
				),
				h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), "volume needed = m / (m − d), with margin m and discount d as fractions of price"),
				readouts([2]string{"markup", "markup"}, [2]string{"margin", "margin"}, [2]string{"margin after discount", "after"}, [2]string{"volume needed", "need"}, [2]string{"+10% price: sales can fall", "lose"}),
				bizNote("Gross profit only: the curve assumes the unit cost stays the same at the higher volume."),
			)
		},
	}
}

// ---------------------------------------------------------------- B8

func bizUnitBlock() Block {
	return Block{
		Slug:        "unit-economics",
		Title:       "Unit economics: CAC, LTV and payback",
		Description: "A subscription business pays to win each customer (the CAC) and earns it back one month of gross profit at a time, while some customers leave each month. The curve is what an average acquired customer has paid back so far; it levels off at the lifetime value. The cohort table shows the same churn as head-counts.",
		Tags:        []string{"churn", "cohorts", "LTV:CAC"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-unit",
				h.Div(h.Class("flex flex-col gap-3"),
					bizLegend([2]string{"var(--brand)", "cumulative gross profit per customer"}, [2]string{"var(--code-del)", "CAC"}, [2]string{"var(--muted-foreground)", "LTV"}),
					finSvg("plot", "Cumulative gross profit per acquired customer against acquisition cost", 600, 280),
					h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cohorts: customers still subscribed"),
						h.Div(h.Data("biz-cohorts", ""), h.Class("scroll-thin overflow-x-auto")),
					),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Per customer"),
					field("arpu", "Revenue", "€/month", 50, 1, 1000, 1),
					field("gm", "Gross margin", "%", 80, 1, 100, 1),
					field("churn", "Monthly churn", "%", 3, 0.5, 30, 0.5),
					field("cac", "Acquisition cost", "€", 600, 0, 20000, 10),
				),
				h.P(h.Class("font-mono text-[11px] leading-relaxed text-muted-foreground"), "LTV = revenue × margin / churn"),
				readouts([2]string{"average lifetime", "life"}, [2]string{"LTV", "ltv"}, [2]string{"LTV : CAC", "ratio"}, [2]string{"simple payback", "payback"}, [2]string{"expected payback", "epayback"}),
				bizNote("Constant churn and no discounting, the textbook simplification; real cohorts usually churn fastest in their first months. Each cohort starts 5% larger than the one before."),
			)
		},
	}
}

// ---------------------------------------------------------------- B9

func bizRunwayBlock() Block {
	return Block{
		Slug:        "runway",
		Title:       "Runway and default alive",
		Description: "A startup's bank balance over four years, month by month: growing subscription revenue against a team that keeps hiring. Runway is how long the cash lasts. Paul Graham's question is sharper: with today's growth and hiring plan, does the company reach profitability before the money runs out (default alive), or not (default dead)?",
		Tags:        []string{"burn rate", "headcount plan", "break-even"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-runway",
				h.Div(h.Class("flex flex-col gap-2"),
					bizLegend([2]string{"var(--brand)", "cash"}, [2]string{"var(--vec-u)", "gross profit / month"}, [2]string{"var(--foreground)", "costs / month"}),
					finSvg("plot", "Cash balance, monthly gross profit and costs over 48 months", 600, 320),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Today"),
					field("cash", "Cash in bank", "k€", 1200, 0, 20000, 10),
					field("mrr", "Monthly revenue", "k€", 30, 0, 2000, 1),
					field("growth", "Revenue growth", "%/month", 7, -10, 30, 0.5),
					field("gm", "Gross margin", "%", 80, 0, 100, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Costs"),
					field("team", "Team now", "people", 8, 0, 300, 1),
					field("hires", "Hires per quarter", "people", 1, 0, 50, 1),
					field("salary", "Cost per person", "k€/month", 8, 1, 40, 0.5),
					field("opex", "Other costs", "k€/month", 12, 0, 1000, 1),
				),
				readouts([2]string{"burn this month", "burn"}, [2]string{"runway", "runway"}, [2]string{"profitable from", "profit"}, [2]string{"funding gap", "low"}, [2]string{"verdict", "verdict"}),
				bizNote("Hiring stops for good once the company is profitable. Simplified: no taxes, no fundraising, and everything is paid in the month it is incurred. After Paul Graham, \"Default Alive or Default Dead?\" (2015)."),
			)
		},
	}
}

// ---------------------------------------------------------------- B10

func bizCapTableBlock() Block {
	return Block{
		Slug:        "cap-table",
		Title:       "Cap table and dilution",
		Description: "Two founders split 8,000,000 shares, then raise a seed round and a Series A. Each round sells new shares at a price set by the pre-money valuation, and investors usually ask for the employee option pool to be created or topped up before they buy, which dilutes only the existing holders. Every share is counted, so the holdings always add up to the total.",
		Tags:        []string{"pre-money", "option pool", "dilution"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("biz-captable",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("biz-cap-bars", ""), h.Class("flex flex-col gap-2")),
					finTable("biz-cap-table", "Holder", "Founding", "After seed", "After Series A"),
					h.Div(h.Data("biz-cap-rounds", ""), h.Class("grid gap-1 font-mono text-[11px] text-muted-foreground")),
				),
				toggle("biz-cap-pre", "pre", "Pool counted in the pre-money", true),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Seed"),
					field("sPre", "Pre-money", "M€", 6, 0.5, 100, 0.5),
					field("sInv", "Investment", "M€", 1.5, 0.1, 50, 0.1),
					field("sPool", "Pool after round", "%", 10, 0, 30, 1),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Series A"),
					field("aPre", "Pre-money", "M€", 24, 1, 500, 1),
					field("aInv", "Investment", "M€", 6, 0.5, 200, 0.5),
					field("aPool", "Pool after round", "%", 12, 0, 30, 1),
				),
				bizNote("Simplified: priced equity rounds only, no convertible notes, SAFEs or liquidation preferences. Share counts are rounded to whole shares."),
			)
		},
	}
}
