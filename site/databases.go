package site

import (
	"encoding/json"
	"fmt"

	"github.com/alexisbcz/components/ui/badge"
	"github.com/alexisbcz/components/ui/button"
	"github.com/alexisbcz/components/ui/kbd"
	"github.com/alexisbcz/icons/hugeicons"
	h "github.com/alexisbcz/libhtml"
)

// DatabasesBlocks lists the databases gallery in display order.
func DatabasesBlocks() []Block {
	return []Block{
		dbSQLBlock(),
		dbJoinsBlock(),
		dbNormalizationBlock(),
		dbBPlusBlock(),
		dbIndexCostBlock(),
		dbIsolationBlock(),
		dbWALBlock(),
		dbOptimizerBlock(),
		dbERBlock(),
		dbReplicationBlock(),
	}
}

// dbTable is a small seeded relation, rendered by Go and handed to the SQL
// engine in databases.js as JSON, so both read the same rows.
type dbTable struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"` // nil is SQL NULL
}

var dbTables = []dbTable{
	{"students", []string{"id", "name", "year", "city"}, [][]any{
		{1, "Ada", 2, "Paris"}, {2, "Ben", 1, "Lyon"}, {3, "Chloé", 3, "Paris"}, {4, "Dev", 2, "Lille"},
		{5, "Emma", 1, "Lyon"}, {6, "Farid", 3, "Paris"}, {7, "Gus", 2, nil}, {8, "Hana", 1, "Lille"},
	}},
	{"courses", []string{"id", "title", "dept", "credits"}, [][]any{
		{10, "Databases", "CS", 6}, {11, "Algorithms", "CS", 6}, {12, "Statistics", "Math", 4},
		{13, "Linear algebra", "Math", 5}, {14, "Philosophy", "Hum", 3},
	}},
	{"enrollments", []string{"student_id", "course_id", "grade"}, [][]any{
		{1, 10, 17}, {1, 11, 15}, {1, 13, 18}, {2, 10, 12}, {2, 12, 9}, {3, 11, 16}, {3, 12, 14},
		{3, 13, 13}, {4, 10, 11}, {5, 12, nil}, {6, 10, 19}, {6, 11, 14}, {7, 13, 10},
	}},
}

var dbQueries = [][2]string{
	{"Filter & sort", "SELECT name, city\nFROM students\nWHERE year >= 2\nORDER BY name;"},
	{"Group & having", "SELECT c.title, COUNT(*) AS students, AVG(e.grade) AS avg_grade\nFROM enrollments e\nJOIN courses c ON e.course_id = c.id\nGROUP BY c.title\nHAVING COUNT(*) >= 3\nORDER BY avg_grade DESC;"},
	{"Left join", "SELECT s.name, COUNT(e.course_id) AS courses\nFROM students s\nLEFT JOIN enrollments e ON e.student_id = s.id\nGROUP BY s.name\nORDER BY courses, s.name;"},
	{"NULL group", "SELECT city, COUNT(*) AS n\nFROM students\nGROUP BY city\nORDER BY n DESC, city;"},
	{"Three tables", "SELECT s.name, c.title, e.grade\nFROM students s\nJOIN enrollments e ON e.student_id = s.id\nJOIN courses c ON c.id = e.course_id\nWHERE e.grade IS NULL OR e.grade < 12\nORDER BY e.grade\nLIMIT 5;"},
	{"LIKE & IN", "SELECT name, year\nFROM students\nWHERE name LIKE 'C%' OR city IN ('Lille')\nORDER BY year DESC, name;"},
}

func dbCell(v any) h.Node {
	if v == nil {
		return h.Span(h.Class("text-muted-foreground italic"), "NULL")
	}
	return h.Text(fmt.Sprint(v))
}

func dbGrid(cols []string, rows [][]any, keys ...string) h.Node {
	isKey := map[string]bool{}
	for _, k := range keys {
		isKey[k] = true
	}
	return h.Div(h.Class("scroll-thin overflow-x-auto rounded-lg border bg-background"),
		h.Table(h.Class("w-full font-mono text-xs"),
			h.Thead(h.Tr(h.Class("border-b bg-code-panel text-left"),
				h.Map(cols, func(c string) h.Node {
					return h.Th(h.Class("px-2.5 py-1.5 font-medium whitespace-nowrap"+h.Ternary(isKey[c], " underline decoration-brand decoration-2 underline-offset-4", "")), c)
				}))),
			h.Tbody(h.Map(rows, func(r []any) h.Node {
				return h.Tr(h.Class("border-b last:border-b-0"), h.Map(r, func(v any) h.Node {
					return h.Td(h.Class("px-2.5 py-1 whitespace-nowrap tabular-nums"), dbCell(v))
				}))
			})),
		),
	)
}

func dbButton(action, label string, icon h.Node) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("action", action), icon, label)
}

func dbSvg(name, viewBox, label string, extra ...any) h.Node {
	return h.Svg(append([]any{h.Data("svg", name), h.ViewBox(viewBox), h.Class("block w-full"), h.Role("img"), h.Aria("label", label)}, extra...)...)
}

// ---------------------------------------------------------------- D1

func dbSQLBlock() Block {
	data, _ := json.Marshal(dbTables)
	return Block{
		Slug:        "sql",
		Title:       "A SQL engine you can read",
		Description: "A small SQL engine written for this page: SELECT with JOIN, WHERE, GROUP BY, HAVING, ORDER BY and LIMIT over three tables, with SQL's three-valued logic for NULL. Every query shows its logical plan, operator by operator, with the rows flowing between them.",
		Tags:        []string{"SQL", "logical plan", "NULL"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-3"), h.Data("db-sql", ""), h.Data("tables", string(data)),
				h.Div(h.Class("flex flex-wrap gap-1.5"),
					h.MapIdx(dbQueries, func(i int, q [2]string) h.Node {
						return h.Button(h.Type("button"), h.Data("preset", fmt.Sprint(i)), h.Data("sql", q[1]),
							h.Class("rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[on]:border-brand data-[on]:bg-brand/10 data-[on]:text-brand"),
							h.If(i == 1, h.Data("on", "")), q[0])
					}),
				),
				h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),
					h.Div(h.Class("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-code shadow-xs"),
						h.Div(h.Class("flex h-10 items-center gap-2 border-b bg-code-panel px-3 text-[13px]"),
							hugeicons.DatabaseIcon(h.Class("size-4 text-[var(--tok-function)]")), h.Span("query.sql"),
							h.Div(h.Class("flex-1")),
							button.Button(button.VariantOutline, button.SizeXs, h.Type("button"), h.Data("action", "run"), hugeicons.PlayIcon(), "Run",
								kbd.Kbd(h.Class("ml-0.5 hidden sm:inline-flex"), "⌘⏎")),
						),
						h.Div(h.Class("code scroll-thin relative min-h-44 overflow-auto"),
							h.Pre(h.Data("highlight", ""), h.Aria("hidden", "true"), h.Class("pointer-events-none m-0 px-3 py-2 text-base leading-6 whitespace-pre sm:text-[13px] sm:leading-5")),
							h.Textarea(h.Data("input", ""), h.Aria("label", "SQL query"), h.Attr("spellcheck", "false"),
								h.Attr("autocapitalize", "off"), h.Attr("autocomplete", "off"), h.Attr("wrap", "off"),
								h.Class("absolute top-0 left-0 m-0 min-h-full min-w-full resize-none overflow-hidden bg-transparent px-3 py-2 font-mono text-base leading-6 whitespace-pre text-transparent caret-[var(--code-fg)] outline-none sm:text-[13px] sm:leading-5 selection:bg-[var(--code-selection)]"),
								dbQueries[1][1]),
						),
						h.P(h.Data("error", ""), h.Hidden(), h.Class("border-t px-3 py-2 font-mono text-xs text-del")),
					),
					h.Div(h.Class("flex min-w-0 flex-col gap-2 rounded-xl border bg-background p-3"),
						panelLabel("Logical plan"),
						h.Ol(h.Data("plan", ""), h.Class("flex flex-col gap-1 font-mono text-xs")),
					),
				),
				h.Div(h.Class("flex items-center justify-between gap-3 text-xs text-muted-foreground"),
					h.Span(h.Data("count", ""), "—"),
					h.Span("NULLs sort first, as in SQLite; / divides exactly. Tables: students (8), courses (5), enrollments (13)."),
				),
				h.Div(h.Data("result", "")),
				h.Details(h.Class("rounded-lg border bg-background text-sm"),
					h.Summary(h.Class("cursor-pointer px-3 py-2 text-muted-foreground"), "The three tables"),
					h.Div(h.Class("grid gap-3 p-3 lg:grid-cols-3"),
						h.Map(dbTables, func(t dbTable) h.Node {
							return h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("font-mono text-xs font-medium"), t.Name), dbGrid(t.Columns, t.Rows))
						}),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D2

func dbJoinsBlock() Block {
	return Block{
		Slug:        "joins",
		Title:       "Joins, row by row",
		Description: "Four joins on two small tables, each with a row that has no partner. Inner keeps only matches; left and right keep their side's orphans with NULLs; full outer keeps both. Hover a result row to see which input rows made it.",
		Tags:        []string{"INNER", "OUTER", "NULL"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("db-joins", ""),
				h.Div(h.Class("flex flex-wrap items-center justify-between gap-3"),
					segs("Join type", [2]string{"inner", "INNER"}, [2]string{"left", "LEFT"}, [2]string{"right", "RIGHT"}, [2]string{"full", "FULL OUTER"}),
					h.Code(h.Data("sql", ""), h.Class("font-mono text-xs text-muted-foreground")),
				),
				h.Div(h.Class("grid gap-4 md:grid-cols-[1fr_1fr_1.6fr]"),
					h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("font-mono text-xs font-medium"), "authors"), h.Div(h.Data("left", ""))),
					h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("font-mono text-xs font-medium"), "books"), h.Div(h.Data("right", ""))),
					h.Div(h.Class("flex flex-col gap-1.5"), h.Span(h.Class("font-mono text-xs font-medium"), h.Span(h.Data("rows", ""), "—")), h.Div(h.Data("out", "grid"))),
				),
				h.P(h.Data("note", ""), h.Class("text-sm text-muted-foreground")),
			)
		},
	}
}

// ---------------------------------------------------------------- D3

type dbNormStep struct {
	title, why string
	fds        []string
	tables     []dbTable
	keys       [][]string
	anomaly    string
}

var dbNormSteps = []dbNormStep{
	{"Unnormalized", "One row per student, with the courses packed into a single field: a repeating group.",
		[]string{"StudentID → Name, Advisor", "Advisor → Office", "CourseID → Title", "StudentID, CourseID → Grade"},
		[]dbTable{{"enrollment_form", []string{"StudentID", "Name", "Advisor", "Office", "Courses"}, [][]any{
			{1, "Ada", "Codd", "B12", "10 Databases 17; 11 Algorithms 15"},
			{2, "Ben", "Gray", "C03", "10 Databases 12"},
			{3, "Chloé", "Codd", "B12", "11 Algorithms 16; 12 Statistics 14"},
		}}}, [][]string{{"StudentID"}},
		"You can't query one course without parsing a string, and a student's courses can't be indexed."},
	{"1NF", "Atomic values: one row per student and course. The key becomes (StudentID, CourseID).",
		[]string{"StudentID → Name, Advisor", "Advisor → Office", "CourseID → Title", "StudentID, CourseID → Grade"},
		[]dbTable{{"enrollments", []string{"StudentID", "CourseID", "Name", "Advisor", "Office", "Title", "Grade"}, [][]any{
			{1, 10, "Ada", "Codd", "B12", "Databases", 17}, {1, 11, "Ada", "Codd", "B12", "Algorithms", 15},
			{2, 10, "Ben", "Gray", "C03", "Databases", 12}, {3, 11, "Chloé", "Codd", "B12", "Algorithms", 16},
			{3, 12, "Chloé", "Codd", "B12", "Statistics", 14},
		}}}, [][]string{{"StudentID", "CourseID"}},
		"Partial dependencies: Name depends on StudentID alone, Title on CourseID alone. Renaming a course means updating every enrollment row (update anomaly); a course with no students can't be stored (insertion anomaly)."},
	{"2NF", "Remove partial dependencies: every non-key attribute depends on the whole key.",
		[]string{"StudentID → Name, Advisor", "Advisor → Office", "CourseID → Title", "StudentID, CourseID → Grade"},
		[]dbTable{
			{"students", []string{"StudentID", "Name", "Advisor", "Office"}, [][]any{{1, "Ada", "Codd", "B12"}, {2, "Ben", "Gray", "C03"}, {3, "Chloé", "Codd", "B12"}}},
			{"courses", []string{"CourseID", "Title"}, [][]any{{10, "Databases"}, {11, "Algorithms"}, {12, "Statistics"}}},
			{"enrollments", []string{"StudentID", "CourseID", "Grade"}, [][]any{{1, 10, 17}, {1, 11, 15}, {2, 10, 12}, {3, 11, 16}, {3, 12, 14}}},
		}, [][]string{{"StudentID"}, {"CourseID"}, {"StudentID", "CourseID"}},
		"A transitive dependency remains: StudentID → Advisor → Office. Codd's office is stored twice; moving him means two updates, and an advisor with no students has nowhere to live."},
	{"3NF / BCNF", "Remove transitive dependencies: non-key attributes depend on the key, the whole key, and nothing but the key. Here every determinant is now a key, so the schema is also in BCNF.",
		[]string{"StudentID → Name, Advisor", "Advisor → Office", "CourseID → Title", "StudentID, CourseID → Grade"},
		[]dbTable{
			{"students", []string{"StudentID", "Name", "Advisor"}, [][]any{{1, "Ada", "Codd"}, {2, "Ben", "Gray"}, {3, "Chloé", "Codd"}}},
			{"advisors", []string{"Advisor", "Office"}, [][]any{{"Codd", "B12"}, {"Gray", "C03"}}},
			{"courses", []string{"CourseID", "Title"}, [][]any{{10, "Databases"}, {11, "Algorithms"}, {12, "Statistics"}}},
			{"enrollments", []string{"StudentID", "CourseID", "Grade"}, [][]any{{1, 10, 17}, {1, 11, 15}, {2, 10, 12}, {3, 11, 16}, {3, 12, 14}}},
		}, [][]string{{"StudentID"}, {"Advisor"}, {"CourseID"}, {"StudentID", "CourseID"}},
		"Each fact is stored once. Joining the four tables on their keys gives back the 1NF table exactly: the decomposition is lossless."},
}

func dbNormalizationBlock() Block {
	return Block{
		Slug:        "normalization",
		Title:       "Normalization, one form at a time",
		Description: "From a form with a repeating group to 3NF, each split justified by a functional dependency and by the anomaly it removes. Keys are underlined.",
		Tags:        []string{"1NF–BCNF", "functional dependencies", "stepper"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"), h.Data("db-norm", ""), h.TabIndex(0),
				h.Aria("label", "Normalization steps, use the arrow keys"),
				h.Div(h.Class("grid"),
					h.MapIdx(dbNormSteps, func(i int, s dbNormStep) h.Node {
						return h.Div(h.Data("step", fmt.Sprint(i)), h.If(i != 0, h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col gap-4"),
							h.Div(h.Class("flex flex-wrap items-baseline gap-2"),
								badge.Badge(badge.VariantOutline, h.Class("font-mono text-[11px]"), s.title),
								h.P(h.Class("text-sm text-pretty"), s.why)),
							h.Div(h.Class("grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]"),
								h.Div(h.Class("flex min-w-0 flex-col gap-3"),
									h.MapIdx(s.tables, func(k int, t dbTable) h.Node {
										return h.Div(h.Class("flex flex-col gap-1"), h.Span(h.Class("font-mono text-xs font-medium"), t.Name), dbGrid(t.Columns, t.Rows, s.keys[k]...))
									})),
								h.Div(h.Class("flex flex-col gap-2 rounded-lg border bg-code p-3"),
									panelLabel("Functional dependencies"),
									h.Ul(h.Class("flex flex-col gap-1 font-mono text-xs"), h.Map(s.fds, func(f string) h.Node { return h.Li(f) })),
								),
							),
							h.P(h.Class("flex gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"),
								hugeicons.Alert02Icon(h.Class("mt-0.5 size-4 shrink-0 text-vec-out")), s.anomaly),
						)
					}),
				),
				h.Div(h.Class("flex items-center justify-between gap-3 border-t pt-3"),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "-1"), h.Disabled(), hugeicons.ArrowLeft01Icon(), "Back"),
					h.Span(h.Data("counter", ""), h.Class("font-mono text-xs text-muted-foreground tabular-nums"), fmt.Sprintf("1 / %d", len(dbNormSteps))),
					button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("go", "1"), "Next", hugeicons.ArrowRight01Icon()),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D4

func dbBPlusBlock() Block {
	return Block{
		Slug:        "bplus-tree",
		Title:       "B+ tree",
		Description: "The index behind most databases. Keys live in the leaves, which are linked for range scans; internal nodes only route. Insert until a node overflows and watch it split, pushing a separator up; the tree only grows at the root, so every leaf stays at the same depth.",
		Tags:        []string{"index", "splits", "balanced"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("db-bplus",
				h.Div(h.Class("scroll-thin overflow-x-auto"), dbSvg("tree", "0 0 640 300", "B+ tree", h.Class("block min-w-[560px] w-full"))),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Order"),
					segs("Max keys per node", [2]string{"3", "3 keys"}, [2]string{"4", "4 keys"}, [2]string{"2", "2 keys"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Key"),
					h.Div(h.Class("flex items-center gap-2"),
						algoInput("key", "42", "Key", "w-20 text-base sm:text-sm"),
						dbButton("insert", "Insert", hugeicons.Add01Icon()),
						dbButton("search", "Find", hugeicons.Search01Icon()),
					),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						dbButton("random", "+10 random", hugeicons.ShuffleIcon()),
						dbButton("reset", "Reset", hugeicons.RefreshIcon()),
					),
				),
				readouts([2]string{"keys", "keys"}, [2]string{"height", "height"}, [2]string{"nodes", "nodes"}, [2]string{"splits", "splits"}, [2]string{"last", "last"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D5

func dbIndexCostBlock() Block {
	return Block{
		Slug:        "index-cost",
		Title:       "What an index buys you",
		Description: "Page reads to answer a query, as the table grows: a full scan reads every page, a B+ tree reads one page per level (a handful even for a billion rows), a hash index about one page for an exact match but nothing better than a scan for a range. A simple cost model, labelled as such.",
		Tags:        []string{"I/O cost", "log scale", "model"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("db-cost",
				dbSvg("plot", "0 0 600 300", "Page reads against table size"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Query"),
					segs("Query kind", [2]string{"point", "WHERE id = ?"}, [2]string{"range", "Range"}),
					field("sel", "Range selects", "%", 1, 0.01, 100, 0.01),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Storage"),
					field("rows", "Rows (log₁₀)", "", 7, 2, 10, 0.1),
					field("perpage", "Rows / page", "", 100, 1, 1000, 1),
					field("fanout", "Fan-out", "", 200, 4, 1000, 1),
				),
				readouts([2]string{"full scan", "scan"}, [2]string{"B+ tree", "btree"}, [2]string{"hash", "hash"}, [2]string{"tree levels", "levels"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D6

type dbTxStep struct {
	tx, op string
	read   string // the value this read returns, filled by JS per level
}

var dbScenarios = []struct {
	key, name string
	steps     []dbTxStep
	anomaly   int // index in the standard's anomaly columns
}{
	{"dirty", "Dirty read", []dbTxStep{
		{"T1", "BEGIN", ""}, {"T1", "UPDATE acct SET bal = 0 WHERE id = 1", ""},
		{"T2", "BEGIN", ""}, {"T2", "SELECT bal FROM acct WHERE id = 1", "r1"},
		{"T1", "ROLLBACK", ""}, {"T2", "COMMIT", ""},
	}, 0},
	{"nonrepeatable", "Non-repeatable read", []dbTxStep{
		{"T1", "BEGIN", ""}, {"T1", "SELECT bal FROM acct WHERE id = 1", "r1"},
		{"T2", "BEGIN", ""}, {"T2", "UPDATE acct SET bal = 50 WHERE id = 1", ""}, {"T2", "COMMIT", ""},
		{"T1", "SELECT bal FROM acct WHERE id = 1", "r2"}, {"T1", "COMMIT", ""},
	}, 1},
	{"phantom", "Phantom", []dbTxStep{
		{"T1", "BEGIN", ""}, {"T1", "SELECT COUNT(*) FROM acct WHERE bal > 40", "r1"},
		{"T2", "BEGIN", ""}, {"T2", "INSERT INTO acct VALUES (3, 70)", ""}, {"T2", "COMMIT", ""},
		{"T1", "SELECT COUNT(*) FROM acct WHERE bal > 40", "r2"}, {"T1", "COMMIT", ""},
	}, 2},
}

var dbLevels = [][2]string{{"ru", "Read uncommitted"}, {"rc", "Read committed"}, {"rr", "Repeatable read"}, {"ser", "Serializable"}}

func dbIsolationBlock() Block {
	return Block{
		Slug:        "isolation",
		Title:       "Isolation levels",
		Description: "Two transactions interleaved, and what the reads return at each isolation level. The table is the SQL standard's: which anomalies each level must prevent. Accounts start at 100 (id 1) and 60 (id 2).",
		Tags:        []string{"transactions", "anomalies", "SQL-92"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("flex flex-col gap-4 rounded-xl border bg-background p-4"), h.Data("db-isolation", ""),
				h.Div(h.Class("flex flex-wrap items-center gap-3"),
					segs("Scenario", [2]string{"dirty", "Dirty read"}, [2]string{"nonrepeatable", "Non-repeatable read"}, [2]string{"phantom", "Phantom"}),
					segs("Isolation level", [2]string{"ru", "Read uncommitted"}, [2]string{"rc", "Read committed"}, [2]string{"rr", "Repeatable read"}, [2]string{"ser", "Serializable"}),
				),
				h.Div(h.Class("grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"),
					h.Div(h.Class("grid"),
						h.Map(dbScenarios, func(s struct {
							key, name string
							steps     []dbTxStep
							anomaly   int
						}) h.Node {
							return h.Ol(h.Data("scenario", s.key), h.If(s.key != "dirty", h.Hidden()), h.Class("col-start-1 row-start-1 flex flex-col overflow-hidden rounded-lg border font-mono text-xs"),
								h.Li(h.Class("grid grid-cols-2 border-b bg-code-panel text-[11px] text-muted-foreground"),
									h.Span(h.Class("px-3 py-1.5"), "T1"), h.Span(h.Class("border-l px-3 py-1.5"), "T2")),
								h.MapIdx(s.steps, func(i int, st dbTxStep) h.Node {
									cell := h.Span(h.Class("flex items-start gap-2 px-3 py-1.5"),
										h.Span(h.Class("w-4 shrink-0 text-muted-foreground tabular-nums"), fmt.Sprint(i+1)),
										h.Span(h.Class("min-w-0 flex-1 break-words"), st.op,
											h.If(st.read != "", h.Span(h.Data("read", st.read), h.Class("ml-2 inline-block rounded bg-brand/10 px-1.5 text-brand tabular-nums"), "—"))))
									empty := h.Span(h.Class("px-3 py-1.5"))
									return h.Li(h.Class("grid grid-cols-2 border-b last:border-b-0"),
										h.IfElse(st.tx == "T1", cell, empty),
										h.Span(h.Class("border-l"), h.IfElse(st.tx == "T2", cell, empty)))
								}),
							)
						}),
					),
					h.Div(h.Class("flex flex-col gap-3"),
						h.Div(h.Data("verdict", ""), h.Aria("live", "polite"), h.Class("rounded-lg border p-3 text-sm")),
						h.Div(h.Class("overflow-x-auto rounded-lg border"),
							h.Table(h.Class("w-full text-[11px]"),
								h.Thead(h.Tr(h.Class("border-b bg-code-panel text-left text-muted-foreground"),
									h.Th(h.Class("px-2 py-1.5 font-normal"), "Level"), h.Th(h.Class("px-2 py-1.5 font-normal"), "Dirty"),
									h.Th(h.Class("px-2 py-1.5 font-normal"), "Non-rep."), h.Th(h.Class("px-2 py-1.5 font-normal"), "Phantom"))),
								h.Tbody(h.MapIdx(dbLevels, func(i int, l [2]string) h.Node {
									mark := func(possible bool) h.Node {
										return h.Td(h.Class("px-2 py-1.5"), h.IfElse(possible,
											h.Span(h.Class("text-del"), "✗ allowed"), h.Span(h.Class("text-add"), "✓ no")))
									}
									return h.Tr(h.Data("level-row", l[0]), h.Class("border-b last:border-b-0 data-[on]:bg-brand/8"),
										h.Td(h.Class("px-2 py-1.5 whitespace-nowrap"), l[1]), mark(i < 1), mark(i < 2), mark(i < 3))
								})),
							),
						),
						h.P(h.Class("text-xs leading-relaxed text-muted-foreground"),
							"The standard lists the minimum; real engines often do more. PostgreSQL's repeatable read is snapshot isolation and also prevents this phantom, and its read uncommitted behaves like read committed."),
					),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D7

var dbWAL = [][4]string{
	{"BEGIN", "T1", "", ""}, {"UPDATE", "T1", "A", "100 → 50"}, {"BEGIN", "T2", "", ""},
	{"UPDATE", "T2", "B", "200 → 250"}, {"UPDATE", "T1", "C", "10 → 60"}, {"COMMIT", "T1", "", ""},
	{"UPDATE", "T2", "A", "50 → 80"}, {"BEGIN", "T3", "", ""}, {"UPDATE", "T3", "C", "60 → 0"},
	{"COMMIT", "T2", "", ""}, {"UPDATE", "T3", "B", "250 → 300"},
}

func dbWALBlock() Block {
	return Block{
		Slug:        "wal",
		Title:       "Crash recovery from the log",
		Description: "Write-ahead logging: every change is logged before the data page is written, so after a crash the log alone rebuilds a consistent state. Pick where the crash happens, then step through recovery: find the winners, redo history, undo the losers (the ARIES pattern, simplified).",
		Tags:        []string{"WAL", "ACID", "redo/undo"},
		Wide:        true,
		Render: func() h.Node {
			return h.Div(h.Class("grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_300px]"), h.Data("db-wal", ""),
				h.Div(h.Class("flex min-w-0 flex-col gap-2"),
					h.Div(h.Class("flex items-center justify-between gap-3"),
						panelLabel("Log (LSN, transaction, record)"),
						h.Span(h.Class("text-xs text-muted-foreground"), "Click a record to crash right after it"),
					),
					h.Ol(h.Class("flex flex-col overflow-hidden rounded-lg border font-mono text-xs"),
						h.MapIdx(dbWAL, func(i int, r [4]string) h.Node {
							return h.Li(
								h.Button(h.Type("button"), h.Data("lsn", fmt.Sprint(i+1)),
									h.Class("grid w-full grid-cols-[2.5rem_2.5rem_5rem_1fr] items-center gap-2 border-b px-3 py-1.5 text-left transition-colors duration-100 outline-none hover:bg-accent/50 focus-visible:bg-accent/60 data-[gone]:opacity-35 data-[cur]:bg-brand/10 data-[cur]:text-brand"),
									h.Span(h.Class("text-muted-foreground tabular-nums"), fmt.Sprint(i+1)),
									h.Span(r[1]), h.Span(r[0]),
									h.Span(h.Class("text-muted-foreground"), h.If(r[2] != "", h.Span(r[2]+": "+r[3]))),
								),
							)
						}),
						h.Li(h.Data("crashline", ""), h.Class("bg-del/10 px-3 py-1.5 text-del"), "💥 crash"),
					),
				),
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("grid grid-cols-3 gap-2"),
						h.Map([]string{"A", "B", "C"}, func(k string) h.Node {
							return h.Div(h.Class("flex flex-col items-center gap-0.5 rounded-lg border bg-code py-2"),
								h.Span(h.Class("font-mono text-[11px] text-muted-foreground"), "page "+k),
								h.Span(h.Data("val", k), h.Class("font-mono text-lg tabular-nums"), "—"))
						}),
					),
					h.P(h.Data("phase", ""), h.Aria("live", "polite"), h.Class("min-h-16 rounded-lg border bg-code p-3 text-sm leading-relaxed")),
					h.Div(h.Class("grid grid-cols-2 gap-2"),
						dbButton("back", "Back", hugeicons.ArrowLeft01Icon()),
						dbButton("next", "Next step", hugeicons.ArrowRight01Icon()),
					),
					readouts([2]string{"winners", "win"}, [2]string{"losers", "lose"}, [2]string{"expected", "expect"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D8

func dbOptimizerBlock() Block {
	return Block{
		Slug:        "optimizer",
		Title:       "Join order",
		Description: "The same three-way join, every left-deep order, costed by the size of the intermediate results (a textbook cost model). Joining two tables with no predicate between them is a cross product, which is why order matters so much; System R (Selinger et al., 1979) searched these orders by dynamic programming.",
		Tags:        []string{"cost model", "cardinality", "plans"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("db-opt",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Code(h.Class("px-1 font-mono text-xs text-muted-foreground"), "SELECT … FROM R JOIN S ON R.a = S.a JOIN T ON S.b = T.b WHERE R.x = ?"),
					dbSvg("bars", "0 0 600 260", "Cost of each join order"),
					dbSvg("plan", "0 0 600 150", "Best plan as a tree"),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Cardinalities"),
					field("r", "|R|", "k rows", 10, 0.001, 10000, 0.001),
					field("s", "|S|", "k rows", 100, 0.001, 10000, 0.001),
					field("t", "|T|", "k rows", 1, 0.001, 10000, 0.001),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Selectivities"),
					field("fx", "R.x = ?", "", 0.01, 0.0001, 1, 0.0001),
					field("rs", "R ⋈ S", "", 0.00001, 0.0000001, 1, 0.0000001),
					field("st", "S ⋈ T", "", 0.001, 0.0000001, 1, 0.0000001),
				),
				readouts([2]string{"best", "best"}, [2]string{"worst", "worst"}, [2]string{"ratio", "ratio"}),
			)
		},
	}
}

// ---------------------------------------------------------------- D9

func dbERBlock() Block {
	return Block{
		Slug:        "er-diagram",
		Title:       "Entity–relationship diagram",
		Description: "A university schema in crow's-foot notation. Pick a relationship, change its cardinality and participation, and see the notation and the tables it turns into: a foreign key on the many side, a UNIQUE foreign key for one-to-one, a junction table for many-to-many.",
		Tags:        []string{"ER", "crow's foot", "schema"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("db-er",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("scroll-thin overflow-x-auto"), dbSvg("er", "0 0 640 300", "Entity-relationship diagram", h.Class("block min-w-[560px] w-full"))),
					h.Div(h.Class("flex flex-col gap-1.5"), panelLabel("Tables"),
						h.Pre(h.Data("ddl", ""), h.Class("code scroll-thin overflow-x-auto rounded-lg border bg-background p-3 text-[12px] leading-[18px] whitespace-pre"))),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Relationship"),
					segs("Relationship", [2]string{"enrolls", "Enrolls"}, [2]string{"teaches", "Teaches"}, [2]string{"belongs", "Works in"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Cardinality"),
					segs("Cardinality", [2]string{"1:1", "1 : 1"}, [2]string{"1:N", "1 : N"}, [2]string{"N:1", "N : 1"}, [2]string{"M:N", "M : N"}),
					h.Span(h.Class("pt-1 text-xs text-muted-foreground"), "Left entity takes part"),
					segs("Left participation", [2]string{"optional", "Optional"}, [2]string{"mandatory", "Mandatory"}),
					h.Span(h.Class("pt-1 text-xs text-muted-foreground"), "Right entity takes part"),
					segs("Right participation", [2]string{"optional", "Optional"}, [2]string{"mandatory", "Mandatory"}),
				),
			)
		},
	}
}

// ---------------------------------------------------------------- D10

func dbReplicationBlock() Block {
	return Block{
		Slug:        "quorum",
		Title:       "Replication and quorums",
		Description: "N replicas, a write acknowledged by W of them, a read that asks R. If R + W > N every read set overlaps the latest write; otherwise a read can miss it while the other replicas lag. The exact chance of a stale read is C(N−W, R) / C(N, R).",
		Tags:        []string{"replication", "quorum", "consistency"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("db-quorum",
				dbSvg("ring", "0 0 600 280", "Replicas, the last write and the last read"),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Quorum"),
					field("n", "Replicas N", "", 3, 1, 9, 1),
					field("w", "Write quorum W", "", 2, 1, 9, 1),
					field("r", "Read quorum R", "", 2, 1, 9, 1),
				),
				h.Div(h.Class("grid grid-cols-2 gap-2"),
					dbButton("write", "Write", hugeicons.Add01Icon()),
					dbButton("read", "Read", hugeicons.Search01Icon()),
					dbButton("sync", "Sync", hugeicons.RefreshIcon()),
					dbButton("many", "1000 reads", hugeicons.FlashIcon()),
				),
				readouts([2]string{"R + W > N", "overlap"}, [2]string{"stale (exact)", "exact"}, [2]string{"stale (sim.)", "sim"}, [2]string{"last read", "last"}),
			)
		},
	}
}
