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
  const names = [...seen.keys()]
  const labels = shortLabels(names)

  return names
    .map((name) => ({
      name,
      ...seen.get(name)!,
      label: labels[name],
      status: status.get(name) ?? null,
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
        present,
        absent,
      }
    })
}
