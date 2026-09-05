/**
 * Turning the two attendance tables into what the Anciennitet page shows.
 *
 * Kept pure and separate from any fetching, because this is the part with
 * actual logic in it — and it can then be tested exhaustively without a
 * database, which is what keeps the fast suite offline.
 */
import type { Member, MemberStatus } from './members'

export type RecordRow = {
  id: number
  meeting_number: number
  lead: string
  pre_location: string | null
  main_location: string
  post_location: string | null
  /** Null for meetings recorded before dates were captured. */
  meeting_date?: string | null
  /**
   * Free prose about the evening, added 2026-07-30. Optional in the type for the
   * same reason `meeting_date` is: a database that predates the column returns
   * rows without it, and the app has to keep working on one.
   */
  description?: string | null
}

export type AttendanceRow = {
  record_id: number | null
  member_name: string
  attended: boolean | null
}

export type Meeting = {
  id: number
  number: number
  lead: string
  /** YYYY-MM-DD, or null where the history never recorded one. */
  date: string | null
  /** YYYY-MM, for placing fines in a month. Null without a date. */
  month: string | null
  /** Før → Sted → Efter, with the empty steps dropped. */
  route: string[]
  /**
   * The three venue columns as stored, which `route` cannot be turned back
   * into: dropping the empty steps loses *which* step was empty, so a meeting
   * with no pre-drinks reads identically to one with no after-party. An editor
   * rebuilding the columns from `route` would shift a venue up a column and
   * write it back. `route` is for reading; this is for correcting.
   */
  venues: { pre: string | null; main: string; post: string | null }
  /**
   * What the club wrote about the evening, or null.
   *
   * Eight of these were seeded from the calendar's own announcements, which is
   * where the club had always written them — see the 2026-07-30 migration. Empty
   * strings normalise to null so a card cannot open a disclosure onto nothing.
   */
  description: string | null
  present: string[]
  absent: string[]
}

export type RosterEntry = {
  name: string
  /** Anciennitet, which §11 defines as the count of attendances. */
  attended: number
  total: number
  label: string
  /**
   * §3 membership status — what every money question in the app is asked of.
   * Null for a name the attendance history holds and no member row claims; see
   * `rightsOf` in members.ts for why the absence of a record grants nothing.
   */
  status: MemberStatus | null
  /**
   * First month the club charges him kontingent (`YYYY-MM-DD`), or null where it
   * is not known. Carried on the roster because the finance page asks the payer
   * count per month, not once — see `payingMembersIn` in members.ts.
   */
  duesFrom: string | null
  /**
   * Meetings he has led, counted from `attendance_records.lead`.
   *
   * Lukas, 2026-09-05: *"Kan vi få ind på anciennitetsgrafen hvor mange gange
   * folk har været lead?"* Not part of anciennitet — §11 is attendance alone —
   * so it never orders the roster; it rides beside the count. See `leadsIn`.
   */
  led: number
}

/**
 * The roster names a meeting's `lead` field credits.
 *
 * The field is free text, and the club has used it freely: 29 of 30 records hold
 * one bare name, and møde 18 — the London trip — holds *"Rasmus (Co-lead Oskar)"*.
 * Both men are named as leading it, so both are credited: the club wrote Oskar's
 * name into the lead field, and a rule that counted only the first word would be
 * this app deciding the club was wrong about its own evening.
 *
 * Whole names only. The string is split on anything that is not a letter and the
 * name has to appear as a run of whole words, so "Anders" is never credited by
 * "Andersen" and a two-word name still matches. A lead the roster does not know —
 * a guest, a typo — credits nobody rather than inventing a bar.
 */
export function leadsIn(lead: string, names: Iterable<string>): string[] {
  const words = ` ${lead.split(/[^\p{L}]+/u).filter(Boolean).join(' ')} `
  return [...names].filter((name) => name.trim() && words.includes(` ${name.trim()} `))
}

/**
 * Short labels for the attendance strip.
 *
 * Two letters is enough for this club, but the function grows the label rather
 * than shipping two members who read the same — an ambiguous pip is worse than
 * a slightly wider one.
 */
export function shortLabels(names: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of names) {
    let len = 2
    let label = name.slice(0, len)
    while (
      len < name.length &&
      Object.entries(out).some(([n, l]) => n !== name && l === label)
    ) {
      len += 1
      label = name.slice(0, len)
    }
    out[name] = label
  }
  return out
}

/**
 * The club's people, ranked by anciennitet.
 *
 * Two sources, and they answer different questions. `members` says who the club
 * *is* and what each of them owes; the attendance rows say what each of them has
 * turned up to. Neither can stand in for the other — the roster used to be the
 * attendance names alone, which made "member" mean "has been to a meeting" and
 * sent the finance page an invoice list ten names long.
 *
 * So the union is deliberate in both directions. A member with no attendance yet
 * appears at once, on nought, which is what a newly admitted member is. And a
 * name in the history that no member row claims keeps its history — the club's
 * records are older than its member list, and losing an evening off a chart to
 * tidy up a table would be a bad trade.
 */
export function buildRoster(
  records: RecordRow[],
  rows: AttendanceRow[],
  members: Member[] = [],
): RosterEntry[] {
  const seen = new Map<string, { attended: number; total: number }>()
  const validIds = new Set(records.map((r) => r.id))
  for (const m of members) seen.set(m.name, { attended: 0, total: 0 })

  for (const row of rows) {
    // A row pointing at a deleted meeting would otherwise inflate the totals.
    if (row.record_id === null || !validIds.has(row.record_id)) continue
    const entry = seen.get(row.member_name) ?? { attended: 0, total: 0 }
    entry.total += 1
    if (row.attended) entry.attended += 1
    seen.set(row.member_name, entry)
  }

  const status = new Map(members.map((m) => [m.name, m.status]))
  const duesFrom = new Map(members.map((m) => [m.name, m.dues_from ?? null]))
  const names = [...seen.keys()]
  const labels = shortLabels(names)

  // One credit per meeting record per name it leads with. Counted against the
  // roster as it stands, so a lead who is neither a member nor in the attendance
  // history — a guest — is dropped rather than added: leading an evening is not
  // what §11 says makes a member, turning up is.
  const led = new Map<string, number>()
  for (const r of records) {
    for (const name of leadsIn(r.lead, names)) led.set(name, (led.get(name) ?? 0) + 1)
  }

  return names
    .map((name) => ({
      name,
      ...seen.get(name)!,
      label: labels[name],
      status: status.get(name) ?? null,
      duesFrom: duesFrom.get(name) ?? null,
      led: led.get(name) ?? 0,
    }))
    // Most attendances first; ties alphabetical so the order never jitters
    // between renders, which would make the bar chart look alive when it isn't.
    .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name, 'da'))
}

/** Meetings newest first — the order you want on a phone. */
export function buildMeetings(
  records: RecordRow[],
  rows: AttendanceRow[],
  roster: RosterEntry[],
): Meeting[] {
  const order = new Map(roster.map((r, i) => [r.name, i]))
  const byRecord = new Map<number, AttendanceRow[]>()
  for (const row of rows) {
    if (row.record_id === null) continue
    const list = byRecord.get(row.record_id) ?? []
    list.push(row)
    byRecord.set(row.record_id, list)
  }

  const rank = (n: string) => order.get(n) ?? Number.MAX_SAFE_INTEGER

  return [...records]
    // Newest first. Dates win where both have one, since a meeting number can
    // repeat — the data contains duplicates — but the number is the only
    // ordering available for the undated history.
    .sort((a, b) => {
      if (a.meeting_date && b.meeting_date) {
        return b.meeting_date.localeCompare(a.meeting_date)
      }
      return b.meeting_number - a.meeting_number
    })
    .map((r) => {
      const rows = byRecord.get(r.id) ?? []
      const present = rows.filter((x) => x.attended).map((x) => x.member_name).sort((a, b) => rank(a) - rank(b))
      const absent = rows.filter((x) => !x.attended).map((x) => x.member_name).sort((a, b) => rank(a) - rank(b))
      return {
        id: r.id,
        number: r.meeting_number,
        lead: r.lead,
        date: r.meeting_date ?? null,
        month: r.meeting_date ? r.meeting_date.slice(0, 7) : null,
        route: [r.pre_location, r.main_location, r.post_location].filter(
          (v): v is string => Boolean(v && v.trim()),
        ),
        venues: {
          pre: r.pre_location,
          main: r.main_location,
          post: r.post_location,
        },
        // Trimmed to null, not passed through. A row holding "" or a stray
        // newline is indistinguishable from one holding nothing, and the card
        // decides whether to offer a "læs mere" on exactly this value.
        description: r.description?.trim() || null,
        present,
        absent,
      }
    })
}
