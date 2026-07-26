/**
 * Turning the two attendance tables into what the Anciennitet page shows.
 *
 * Kept pure and separate from any fetching, because this is the part with
 * actual logic in it — and it can then be tested exhaustively without a
 * database, which is what keeps the fast suite offline.
 */

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
  present: string[]
  absent: string[]
}

export type RosterEntry = {
  name: string
  /** Anciennitet, which §11 defines as the count of attendances. */
  attended: number
  total: number
  label: string
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

/** Every member who has ever appeared, ranked by anciennitet. */
export function buildRoster(records: RecordRow[], rows: AttendanceRow[]): RosterEntry[] {
  const seen = new Map<string, { attended: number; total: number }>()
  const validIds = new Set(records.map((r) => r.id))

  for (const row of rows) {
    // A row pointing at a deleted meeting would otherwise inflate the totals.
    if (row.record_id === null || !validIds.has(row.record_id)) continue
    const entry = seen.get(row.member_name) ?? { attended: 0, total: 0 }
    entry.total += 1
    if (row.attended) entry.attended += 1
    seen.set(row.member_name, entry)
  }

  const names = [...seen.keys()]
  const labels = shortLabels(names)

  return names
    .map((name) => ({ name, ...seen.get(name)!, label: labels[name] }))
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
        present,
        absent,
      }
    })
}
