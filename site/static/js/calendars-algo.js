// Calendar arithmetic for the calendars blocks: pure functions on integers,
// no DOM, so they can be tested in Node. Years are astronomical (year 0 is
// 1 BC, −1 is 2 BC); months 1–12; weekdays 0 = Sunday … 6 = Saturday.

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Floor division and a modulo that is never negative. */
export const div = (a, b) => Math.floor(a / b);
export const mod = (a, b) => ((a % b) + b) % b;

export const isLeapGregorian = (y) => (mod(y, 4) === 0 && mod(y, 100) !== 0) || mod(y, 400) === 0;
export const isLeapJulian = (y) => mod(y, 4) === 0;

export function monthLength(y, m, julian = false) {
  if (m === 2) return (julian ? isLeapJulian(y) : isLeapGregorian(y)) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// ------------------------------------------------------------ Julian Day

/** Julian Day Number (the JD at noon) of a Gregorian or Julian calendar date. */
export function toJDN(y, m, d, julian = false) {
  const a = div(14 - m, 12);
  const yy = y + 4800 - a, mm = m + 12 * a - 3;
  const base = d + div(153 * mm + 2, 5) + 365 * yy + div(yy, 4);
  return julian ? base - 32083 : base - div(yy, 100) + div(yy, 400) - 32045;
}

/** The calendar date of a Julian Day Number. */
export function fromJDN(j, julian = false) {
  let b, c;
  if (julian) {
    b = 0;
    c = j + 32082;
  } else {
    const a = j + 32044;
    b = div(4 * a + 3, 146097);
    c = a - div(146097 * b, 4);
  }
  const d = div(4 * c + 3, 1461);
  const e = c - div(1461 * d, 4);
  const m = div(5 * e + 2, 153);
  return {
    y: 100 * b + d - 4800 + div(m, 10),
    m: m + 3 - 12 * div(m, 10),
    d: e - div(153 * m + 2, 5) + 1,
  };
}

/** Weekday of a Julian Day Number (JDN 0 was a Monday). */
export const weekdayOfJDN = (j) => mod(j + 1, 7);

/** Gregorian minus Julian date for the same day, in days. */
export function calendarGap(j) {
  const g = fromJDN(j), jl = fromJDN(j, true);
  return toJDN(g.y, g.m, g.d, true) - toJDN(jl.y, jl.m, jl.d, true);
}

// ------------------------------------------------------------ weekdays

/** Zeller's congruence for a Gregorian date, with its intermediate terms.
 *  Zeller's h counts 0 = Saturday; weekday converts it to 0 = Sunday. */
export function zeller(y, m, d) {
  const mm = m < 3 ? m + 12 : m, yy = m < 3 ? y - 1 : y;
  const K = mod(yy, 100), J = div(yy, 100);
  const t1 = div(13 * (mm + 1), 5), t2 = div(K, 4), t3 = div(J, 4);
  const h = mod(d + t1 + K + t2 + t3 + 5 * J, 7);
  return { mm, yy, K, J, t1, t2, t3, h, weekday: mod(h + 6, 7) };
}

/** The "doomsday" of each month: a date that falls on the year's doomsday. */
export function monthDoomsday(y, m) {
  const leap = isLeapGregorian(y);
  return [leap ? 4 : 3, leap ? 29 : 28, 14, 4, 9, 6, 11, 8, 5, 10, 7, 12][m - 1];
}

/** Conway's Doomsday rule, step by step. */
export function doomsday(y, m, d) {
  const c = div(y, 100);
  const anchor = mod(2 + 5 * mod(c, 4), 7);
  const yy = mod(y, 100);
  const a = div(yy, 12), b = mod(yy, 12), cc = div(b, 4);
  const dd = mod(anchor + a + b + cc, 7);
  const md = monthDoomsday(y, m);
  return { c, anchor, yy, a, b, cc, dd, md, weekday: mod(dd + d - md, 7) };
}

// ------------------------------------------------------------ Easter

/** Gregorian Easter by the anonymous algorithm (Meeus, Jones, Butcher). */
export function easterGregorian(Y) {
  const a = mod(Y, 19), b = div(Y, 100), c = mod(Y, 100);
  const d = div(b, 4), e = mod(b, 4), f = div(b + 8, 25), g = div(b - f + 1, 3);
  const h = mod(19 * a + b - d - g + 15, 30);
  const i = div(c, 4), k = mod(c, 4);
  const l = mod(32 + 2 * e + 2 * i - h - k, 7);
  const m = div(a + 11 * h + 22 * l, 451);
  const n = h + l - 7 * m + 114;
  const month = div(n, 31), day = mod(n, 31) + 1;
  // Paschal full moon: 21 March + h, one day earlier in the two corrected cases.
  const pfm = toJDN(Y, 3, 21) + h - m;
  return { a, b, c, d, e, f, g, h, i, k, l, m, month, day, golden: a + 1, pfm };
}

/** Julian-calendar Easter (Meeus), as a Julian calendar date. */
export function easterJulian(Y) {
  const a = mod(Y, 4), b = mod(Y, 7), c = mod(Y, 19);
  const d = mod(19 * c + 15, 30), e = mod(2 * a + 4 * b - d + 34, 7);
  const n = d + e + 114;
  return { month: div(n, 31), day: mod(n, 31) + 1 };
}

// ------------------------------------------------------------ ISO 8601 weeks

/** ISO week date of a Gregorian date: the week belongs to the year that
 *  holds its Thursday. */
export function isoWeek(y, m, d) {
  const j = toJDN(y, m, d);
  const wd = mod(weekdayOfJDN(j) + 6, 7) + 1; // 1 = Monday … 7 = Sunday
  const thursday = j + 4 - wd;
  const ty = fromJDN(thursday).y;
  const week = div(thursday - toJDN(ty, 1, 1), 7) + 1;
  return { year: ty, week, day: wd };
}

/** Weeks in an ISO year: 53 when 1 January is a Thursday, or a Wednesday in
 *  a leap year. */
export function isoWeeksInYear(y) {
  const wd = weekdayOfJDN(toJDN(y, 1, 1));
  return wd === 4 || (wd === 3 && isLeapGregorian(y)) ? 53 : 52;
}

// ------------------------------------------------------------ Hebrew and Islamic

/** Hebrew year (Anno Mundi) has a 13th month in years 3, 6, 8, 11, 14, 17
 *  and 19 of the 19-year cycle. */
export const hebrewIsLeap = (am) => mod(7 * am + 1, 19) < 7;
export const hebrewCycleYear = (am) => mod(am - 1, 19) + 1;

/** Tabular Islamic calendar, civil (Friday) epoch, 11 leap years in 30
 *  (2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29). */
export const HIJRI_EPOCH = 1948440; // JDN of 1 Muharram AH 1 = 16 July 622 (Julian)
export const hijriIsLeap = (y) => mod(14 + 11 * y, 30) < 11;
export function hijriToJDN(y, m, d) {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + div(3 + 11 * y, 30) + HIJRI_EPOCH - 1;
}
export function jdnToHijri(j) {
  const y = div(30 * (j - HIJRI_EPOCH) + 10646, 10631);
  const m = Math.min(12, Math.ceil((j - (29 + hijriToJDN(y, 1, 1))) / 29.5) + 1);
  return { y, m, d: j - hijriToJDN(y, m, 1) + 1 };
}
export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabiʿ I", "Rabiʿ II", "Jumada I", "Jumada II", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qaʿda", "Dhu al-Hijja"];

// ------------------------------------------------------------ Unix time

export const UNIX_EPOCH_JDN = 2440588; // 1970-01-01

/** Leap seconds inserted at the end of the day before each date; TAI − UTC
 *  was 10 s from 1972-01-01 and gains 1 s at each (IERS Bulletin C). */
export const LEAP_SECONDS = [
  "1972-07-01", "1973-01-01", "1974-01-01", "1975-01-01", "1976-01-01", "1977-01-01", "1978-01-01",
  "1979-01-01", "1980-01-01", "1981-07-01", "1982-07-01", "1983-07-01", "1985-07-01", "1988-01-01",
  "1990-01-01", "1991-01-01", "1992-07-01", "1993-07-01", "1994-07-01", "1996-01-01", "1997-07-01",
  "1999-01-01", "2006-01-01", "2009-01-01", "2012-07-01", "2015-07-01", "2017-01-01",
];

/** Unix seconds of a UTC date and time, exactly (BigInt-free: fits a double). */
export function toUnix(y, mo, d, h = 0, mi = 0, s = 0) {
  return (toJDN(y, mo, d) - UNIX_EPOCH_JDN) * 86400 + h * 3600 + mi * 60 + s;
}
export function fromUnix(t) {
  const days = div(t, 86400), sec = t - days * 86400;
  const { y, m, d } = fromJDN(days + UNIX_EPOCH_JDN);
  return { y, m, d, h: div(sec, 3600), mi: div(mod(sec, 3600), 60), s: mod(sec, 60) };
}

/** TAI − UTC in seconds at a Unix time (before 1972 the offset was not a
 *  whole number of seconds; null there). */
export function taiMinusUtc(t) {
  if (t < toUnix(1972, 1, 1)) return null;
  let n = 10;
  for (const ds of LEAP_SECONDS) {
    const [y, m, d] = ds.split("-").map(Number);
    if (t >= toUnix(y, m, d)) n++;
  }
  return n;
}

/** Zero-padded ISO 8601 text of a date and time; years outside 0–9999
 *  get a sign and six digits, as ISO 8601 extended years do. */
export function isoString({ y, m, d, h, mi, s }, withTime = true) {
  const p = (v, n = 2) => String(v).padStart(n, "0");
  const ys = y >= 0 && y <= 9999 ? p(y, 4) : (y < 0 ? "−" : "+") + p(Math.abs(y), 6);
  const date = `${ys}-${p(m)}-${p(d)}`;
  return withTime ? `${date}T${p(h)}:${p(mi)}:${p(s)}Z` : date;
}

/** Human date "Sunday 20 April 2025", with BC years for year ≤ 0. */
export function longDate(y, m, d, wd) {
  const year = y > 0 ? String(y) : `${1 - y} BC`;
  return `${wd === undefined ? "" : WEEKDAYS[wd] + " "}${d} ${MONTHS[m - 1]} ${year}`;
}
