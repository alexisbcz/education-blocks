package site

import (
	"github.com/alexisbcz/components/ui/button"
	h "github.com/alexisbcz/libhtml"
)

// CalendarsBlocks lists the calendars & timekeeping gallery in display order.
func CalendarsBlocks() []Block {
	return []Block{
		calLeapBlock(),
		calWeekdayBlock(),
		calJDNBlock(),
		calEasterBlock(),
		calMetonicBlock(),
		calHijriBlock(),
		calISOWeekBlock(),
		calSundialBlock(),
		calPendulumBlock(),
		calUnixBlock(),
	}
}

// calDate is the year / month / day trio of scrub fields most blocks share.
func calDate(label string, y, m, d float64, minYear float64) h.Node {
	return h.Div(h.Class("flex flex-col gap-2"), panelLabel(label),
		field("y", "Year", "", y, minYear, 9999, 1),
		field("m", "Month", "", m, 1, 12, 1),
		field("d", "Day", "", d, 1, 31, 1),
	)
}

// calNote is the small print under a block's picture.
func calNote(s string) h.Node {
	return h.P(h.Class("px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground"), s)
}

func calButton(k, label string) h.Node {
	return button.Button(button.VariantOutline, button.SizeSm, h.Type("button"), h.Data("k", k), label)
}

// ---------------------------------------------------------------- C1

func calLeapBlock() Block {
	return Block{
		Slug:        "leap-rules",
		Title:       "Leap-year rules",
		Description: "The tropical year is about 365.24219 days. Julius Caesar's rule (a leap day every 4 years) gives 365.25 and drifts a day every 128 years; by 1582 the spring equinox had moved 10 days. Gregory XIII dropped 10 days and 3 leap days every 400 years, for 365.2425: one day off in about 3,200 years.",
		Tags:        []string{"Julian", "Gregorian", "tropical year"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-leap",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("k", "grid"), h.ViewBox("0 0 640 250"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Every year of a cycle, leap years filled")),
					h.Svg(h.Data("k", "drift"), h.ViewBox("0 0 640 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Calendar drift against the tropical year")),
					h.Div(h.Class("overflow-x-auto"), h.Table(h.Data("k", "adopt"), h.Class("w-full min-w-[460px] font-mono text-[11px]"))),
					calNote("Adoption dates are examples; many countries switched at other dates, some in several steps. The tropical year shortens by about half a second per century, so the drift curves are for today's length."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rule"),
					segs("Leap-year rule", [2]string{"gregorian", "Gregorian"}, [2]string{"julian", "Julian"}, [2]string{"revised", "Revised Julian"}),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Test a year"),
					field("y", "Year", "", 1900, -4000, 9999, 1),
				),
				readouts([2]string{"leap years", "count"}, [2]string{"mean year", "mean"}, [2]string{"error per year", "err"}, [2]string{"one day off in", "days"}, [2]string{"this year", "verdict"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C2

func calWeekdayBlock() Block {
	return Block{
		Slug:        "weekday",
		Title:       "Day of the week",
		Description: "Two ways to find a weekday in your head. Zeller's congruence (1882) is a single formula that treats January and February as months 13 and 14 of the previous year. Conway's Doomsday rule uses dates that share a weekday every year (4/4, 6/6, 8/8, 10/10, 12/12, 9/5, 5/9, 7/11, 11/7 and the last day of February): find the year's doomsday, then count from the nearest one.",
		Tags:        []string{"Zeller", "Doomsday", "Conway"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-weekday",
				h.Div(h.Class("grid gap-4 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"),
					h.Div(h.Data("k", "month")),
					h.Ol(h.Data("k", "steps"), h.Aria("live", "polite"), h.Class("flex flex-col gap-1.5 font-mono text-xs")),
				),
				calDate("Date (Gregorian)", 1969, 7, 20, 1),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Method"),
					segs("Method", [2]string{"doomsday", "Doomsday"}, [2]string{"zeller", "Zeller"}),
				),
				readouts([2]string{"weekday", "wd"}, [2]string{"year's doomsday", "dd"}, [2]string{"checked against Date", "check"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C3

func calJDNBlock() Block {
	return Block{
		Slug:        "julian-day",
		Title:       "Julian Day Numbers",
		Description: "Astronomers count days, not dates: the Julian Day Number is the number of days since noon on 1 January 4713 BC in the Julian calendar (Scaliger, 1583). It makes date differences a subtraction and converts between calendars. The integer algorithm here is exact for any date; years are astronomical, so year 0 is 1 BC.",
		Tags:        []string{"JDN", "MJD", "J2000"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-jdn",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("k", "line"), h.ViewBox("0 0 640 150"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Timeline of day counts with landmark epochs")),
					calNote("Landmarks: JD 0; the Gregorian reform; MJD 0 (1858-11-17); the Unix epoch (1970-01-01); J2000.0 (JD 2451545.0, noon on 2000-01-01). A JD starts at noon, so midnight is a half day."),
				),
				calDate("Date", 2000, 1, 1, -4712),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Read the date in"),
					segs("Calendar of the date", [2]string{"gregorian", "Gregorian"}, [2]string{"julian", "Julian"}),
					field("add", "Add days", "d", 0, -100000, 100000, 1),
				),
				readouts([2]string{"Julian Day Number", "jdn"}, [2]string{"JD at 0 h UT", "jd0"}, [2]string{"MJD", "mjd"}, [2]string{"weekday", "wd"}, [2]string{"Gregorian", "greg"}, [2]string{"Julian", "jul"}, [2]string{"Julian lags by", "gap"}, [2]string{"days from J2000", "j2k"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C4

func calEasterBlock() Block {
	return Block{
		Slug:        "easter",
		Title:       "Computing Easter",
		Description: "Easter is the first Sunday after the ecclesiastical full moon on or after 21 March. That moon is not observed: it comes from a 19-year lunar table (the golden number) corrected for the Gregorian leap rule and for the table's own drift. The anonymous Gregorian algorithm (published in Nature in 1876; Meeus, Jones and Butcher) does it all in integer arithmetic.",
		Tags:        []string{"computus", "golden number", "epact"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-easter",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Class("overflow-x-auto"), h.Table(h.Data("k", "steps"), h.Class("w-full min-w-[440px] font-mono text-[11px]"))),
					h.Svg(h.Data("k", "hist"), h.ViewBox("0 0 640 170"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "How often Easter falls on each date, 1600 to 2599")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Year"),
					field("y", "Year", "", 2026, 1583, 9999, 1),
				),
				readouts([2]string{"Western Easter", "west"}, [2]string{"Paschal full moon", "pfm"}, [2]string{"golden number", "golden"}, [2]string{"Orthodox Easter", "east"}, [2]string{"gap", "gap"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C5

func calMetonicBlock() Block {
	return Block{
		Slug:        "metonic",
		Title:       "The Metonic cycle",
		Description: "Nineteen tropical years (6,939.60 days) are almost exactly 235 lunar months (6,939.69 days), as Meton of Athens noted in 432 BC. A lunisolar calendar can therefore keep its months on the Moon and its festivals in their season by giving 7 of every 19 years a 13th month. The Hebrew calendar adds Adar I in years 3, 6, 8, 11, 14, 17 and 19 of each cycle.",
		Tags:        []string{"lunisolar", "Hebrew calendar", "19 years"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-metonic",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"),
					h.Svg(h.Data("k", "wheel"), h.ViewBox("0 0 240 240"), h.Class("mx-auto block w-full max-w-[240px]"), h.Role("img"), h.Aria("label", "The 19 years of the cycle, 13-month years filled")),
					h.Svg(h.Data("k", "drift"), h.ViewBox("0 0 420 240"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Start of the lunar year against the solar year over three cycles")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Hebrew year"),
					field("y", "Year (AM)", "", 5786, 1, 9999, 1),
				),
				readouts([2]string{"year of the cycle", "cyc"}, [2]string{"months", "months"}, [2]string{"19 tropical years", "solar"}, [2]string{"235 lunar months", "lunar"}, [2]string{"mismatch per cycle", "diff"}, [2]string{"one day off in", "drift"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C6

func calHijriBlock() Block {
	return Block{
		Slug:        "hijri",
		Title:       "A purely lunar calendar",
		Description: "The Islamic calendar has 12 lunar months and no leap month, so its year is about 354.37 days and every date slides about 11 days earlier each solar year: Ramadan travels through all the seasons in about 33 years. This is the tabular (arithmetic) calendar, with 11 leap days in 30 years; in practice most months begin with a sighting of the crescent or a national rule, and can differ by a day or two.",
		Tags:        []string{"Hijri", "lunar year", "Ramadan"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-hijri",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Svg(h.Data("k", "drift"), h.ViewBox("0 0 640 230"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Gregorian date of 1 Ramadan, year by year")),
					h.Div(h.Data("k", "months"), h.Class("grid grid-cols-3 gap-1 sm:grid-cols-6")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Hijri date (tabular)"),
					field("y", "Year", "AH", 1447, 1, 3000, 1),
					field("m", "Month", "", 9, 1, 12, 1),
					field("d", "Day", "", 1, 1, 30, 1),
				),
				readouts([2]string{"month", "name"}, [2]string{"Gregorian", "greg"}, [2]string{"year length", "len"}, [2]string{"through the seasons in", "cycle"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C7

func calISOWeekBlock() Block {
	return Block{
		Slug:        "iso-week",
		Title:       "ISO week numbers",
		Description: "ISO 8601 weeks start on Monday, and week 1 is the week that contains the year's first Thursday (equivalently, 4 January). So 1–3 January can belong to the last week of the previous year, and 29–31 December to week 1 of the next. A year has 53 weeks when it starts on a Thursday, or on a Wednesday in a leap year.",
		Tags:        []string{"ISO 8601", "week date", "Thursday rule"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-isoweek",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Div(h.Data("k", "months"), h.Class("grid gap-4 sm:grid-cols-2")),
					calNote("Thursdays are shaded: whichever year a week's Thursday falls in, the week belongs to that year."),
				),
				calDate("Date", 2021, 1, 3, 1),
				h.Div(h.Class("flex flex-wrap gap-2 border-t pt-4"),
					calButton("p-0103", "2021-01-03"), calButton("p-1229", "2008-12-29"), calButton("p-1231", "2026-12-31"),
				),
				readouts([2]string{"week date", "iso"}, [2]string{"week-numbering year", "wy"}, [2]string{"weeks in that year", "weeks"}, [2]string{"next 53-week years", "next"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C8

func calSundialBlock() Block {
	return Block{
		Slug:        "sundial",
		Title:       "Laying out a sundial",
		Description: "A sundial's style must point at the celestial pole, so it leans at the latitude. The shadow then turns 15° an hour around the style, but on a flat plate the hour lines bunch near noon: on a horizontal dial tan θ = sin φ · tan(15° × hours from noon); on a vertical dial facing the equator, tan θ = cos φ · tan(15° × hours). The dial shows local apparent solar time.",
		Tags:        []string{"gnomon", "hour lines", "latitude"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-sundial",
				h.Div(h.Class("flex flex-col gap-2"),
					h.Svg(h.Data("k", "dial"), h.ViewBox("0 0 640 330"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Dial plate with hour lines, and the style seen from the side")),
					calNote("To read clock time, add the longitude correction and the equation of time (see Geography's solar-time block) and any daylight saving."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Dial"),
					segs("Dial plane", [2]string{"horizontal", "Horizontal"}, [2]string{"vertical", "Vertical"}),
					field("lat", "Latitude", "°", 48.9, -80, 80, 0.1),
					field("hr", "Hour", "h", 15, 6, 18, 0.25),
				),
				readouts([2]string{"style angle", "style"}, [2]string{"hour angle", "ha"}, [2]string{"line angle θ", "theta"}, [2]string{"3 pm line", "three"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C9

func calPendulumBlock() Block {
	return Block{
		Slug:        "pendulum-clock",
		Title:       "The pendulum clock",
		Description: "Huygens' pendulum clock (1656) kept time to seconds a day because a swing's period depends only on length and gravity: T = 2π√(L/g) for small swings. That is also its weakness: a rod that warms by 10 °C grows, and a brass rod then loses about 8 seconds a day. Wider swings run slow too (circular error), roughly T₀(1 + θ₀²/16).",
		Tags:        []string{"Huygens", "seconds pendulum", "invar"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-pendulum",
				h.Div(h.Class("grid gap-3 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]"),
					h.Svg(h.Data("k", "bob"), h.ViewBox("0 0 200 260"), h.Class("mx-auto block w-full max-w-[200px]"), h.Role("img"), h.Aria("label", "The pendulum swinging at its period")),
					h.Svg(h.Data("k", "error"), h.ViewBox("0 0 420 260"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "Seconds gained or lost per day against temperature change, for three rod materials")),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Pendulum"),
					field("L", "Length", "m", 0.994, 0.1, 3, 0.001),
					field("amp", "Amplitude", "°", 3, 0.5, 30, 0.5),
					field("dT", "Warmer by", "°C", 10, -20, 30, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Gravity"),
					segs("Gravity", [2]string{"std", "Standard"}, [2]string{"equator", "Equator"}, [2]string{"pole", "Pole"}),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("Rod"),
					segs("Rod material", [2]string{"brass", "Brass"}, [2]string{"steel", "Steel"}, [2]string{"invar", "Invar"}),
				),
				readouts([2]string{"period", "T"}, [2]string{"1 s beat needs", "sec"}, [2]string{"vs a 1 s beat", "rate"}, [2]string{"temperature error", "temp"}, [2]string{"circular error", "circ"}),
			)
		},
	}
}

// ---------------------------------------------------------------- C10

func calUnixBlock() Block {
	return Block{
		Slug:        "unix-time",
		Title:       "Unix time and leap seconds",
		Description: "Computers count seconds since 1970-01-01 00:00 UTC, ignoring leap seconds: every day is 86,400 Unix seconds. Stored as a signed 32-bit integer, the count runs out at 2³¹ − 1, on 2038-01-19 at 03:14:07 UTC, and the next second wraps to 1901. Meanwhile atomic time (TAI) has pulled 37 s ahead of UTC through 27 leap seconds.",
		Tags:        []string{"epoch", "Y2038", "TAI"},
		Wide:        true,
		Render: func() h.Node {
			return plotPanel("cal-unix",
				h.Div(h.Class("flex flex-col gap-3"),
					h.Div(h.Data("k", "bits"), h.Class("flex flex-col gap-1.5")),
					h.Svg(h.Data("k", "tai"), h.ViewBox("0 0 640 190"), h.Class("block w-full"), h.Role("img"), h.Aria("label", "TAI minus UTC since 1972, with the chosen date")),
					calNote("Leap seconds from IERS Bulletin C. In 2022 the CGPM decided to stop adding them by 2035; GPS time runs at TAI − 19 s and has no leap seconds."),
				),
				h.Div(h.Class("flex flex-col gap-2"), panelLabel("UTC date and time"),
					field("y", "Year", "", 2038, 1902, 2200, 1),
					field("m", "Month", "", 1, 1, 12, 1),
					field("d", "Day", "", 19, 1, 31, 1),
					field("h", "Hour", "", 3, 0, 23, 1),
					field("mi", "Minute", "", 14, 0, 59, 1),
					field("s", "Second", "", 7, 0, 59, 1),
				),
				h.Div(h.Class("flex flex-col gap-2 border-t pt-4"), panelLabel("Stored as"),
					segs("Integer width", [2]string{"i32", "Signed 32-bit"}, [2]string{"u32", "Unsigned 32"}, [2]string{"i64", "64-bit"}),
					h.Div(h.Class("flex flex-wrap gap-2"), calButton("p-last", "Last 32-bit second"), calButton("p-next", "One second later")),
				),
				readouts([2]string{"Unix time", "unix"}, [2]string{"stored value", "stored"}, [2]string{"reads back as", "back"}, [2]string{"TAI − UTC", "tai"}, [2]string{"GPS − UTC", "gps"}),
			)
		},
	}
}
