/**
 * A Danish date, from one of the plain `YYYY-MM-DD` columns.
 *
 * Parsed *and* printed in UTC, and both halves are load-bearing.
 * `new Date('2026-08-01')` is UTC midnight; rendered in a zone behind UTC it
 * prints 31. juli, so the 1st of a month silently becomes the last day of the
 * month before — on pages whose whole subject is when something happened. The
 * club sits in UTC+1/+2, which is exactly what makes this dangerous: it is
 * invisible from Copenhagen and appears for anyone reading the app west of it.
 *
 * The year is in the default. The history runs from December 2021, so five
 * meeting cards read "4. dec." with nothing on any of them saying which
 * December — a year every caller has to remember to ask for is a year that gets
 * left off.
 */
const LONG: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }

export function daDate(iso: string, opts: Intl.DateTimeFormatOptions = LONG): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('da-DK', { timeZone: 'UTC', ...opts })
}

/** Today as the database writes dates, for prefilling a new row's date field. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * When something happened, from a `timestamptz` (T074).
 *
 * Deliberately not `daDate`, and the difference is not cosmetic. Every other
 * date in this app is a plain `date` column — a day the club agreed on, with no
 * time and no zone — so it is parsed and printed in UTC to stop it sliding into
 * the day before. A visit is the opposite: an instant, stamped by the server,
 * which genuinely falls on a different wall-clock day in different places. So
 * it is rendered in the reader's own zone, which for this club is Copenhagen's.
 *
 * "i dag", "i går", then the date. Not "for 23 dage siden": a count of days is a
 * number to compare members on, and this exists to answer "has he been here
 * lately", not to rank ten men by absence.
 */
export function daWhen(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((midnight(now) - midnight(then)) / 86_400_000)
  // A phone whose clock runs a few minutes ahead of the server's would otherwise
  // put a visit in the future.
  if (days <= 0) return 'i dag'
  if (days === 1) return 'i går'
  return then.toLocaleDateString('da-DK', LONG)
}
