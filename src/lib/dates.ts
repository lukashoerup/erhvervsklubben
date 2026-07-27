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
