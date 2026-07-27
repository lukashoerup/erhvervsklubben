import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { buildMeetings, buildRoster, shortLabels, type AttendanceRow, type RecordRow } from './derive'
import {
  DEMO,
  demoAttendances,
  demoDelete,
  demoEvents,
  demoNews,
  demoRecords,
  demoSave,
} from './demo'

/** Newest first, the way all three content queries below ask the database for it. */
const newestFirst = <T extends { date: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.date.localeCompare(a.date))

/** The columns every version of the club's database has had. */
const RECORD_COLUMNS = 'id, meeting_number, lead, pre_location, main_location, post_location'

/** Postgres `undefined_column` — PostgREST passes the SQLSTATE straight through. */
const UNDEFINED_COLUMN = '42703'

/**
 * The meeting records, tolerating a database older than this code.
 *
 * `meeting_date` arrived in a migration that has been applied here but not to
 * the club's live project, and asking for a column that does not exist fails
 * the *whole* read — fifteen years of history disappearing behind "kunne ikke
 * hente data" because one optional field was missing. The dates are worth
 * having and not worth that, so a missing column costs the dates and nothing
 * else.
 *
 * Written as a retry rather than a flag so it repairs itself: the day the
 * column is added, the first request succeeds and the dates simply appear.
 */
export async function readRecords(): Promise<RecordRow[]> {
  const withDate = await supabase()
    .from('attendance_records')
    .select(`${RECORD_COLUMNS}, meeting_date`)
  if (!withDate.error) return (withDate.data ?? []) as RecordRow[]
  if (withDate.error.code !== UNDEFINED_COLUMN) throw withDate.error

  const withoutDate = await supabase().from('attendance_records').select(RECORD_COLUMNS)
  if (withoutDate.error) throw withoutDate.error
  return (withoutDate.data ?? []) as RecordRow[]
}

/**
 * Its own function, not an inline `supabase().from(...)` in the Promise.all
 * below: `supabase()` throws synchronously when it has no configuration, and a
 * synchronous throw while building that array abandons the sibling promise
 * mid-flight — an unhandled rejection, and a failure reported from the wrong
 * place. Inside an async function the same throw is just a rejection, which
 * Promise.all is built to handle.
 */
async function readAttendances(): Promise<AttendanceRow[]> {
  const { data, error } = await supabase()
    .from('attendances')
    .select('record_id, member_name, attended')
  if (error) throw error
  return (data ?? []) as AttendanceRow[]
}

/**
 * The club's attendance history, shaped for the page.
 *
 * Two queries rather than a join: PostgREST would nest the attendance rows
 * under each record, but the roster needs them flat anyway, and two flat reads
 * are simpler to reason about than an embedded shape that changes if the
 * foreign key ever does.
 */
export function useAttendance() {
  return useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      if (DEMO) {
        const roster = buildRoster(demoRecords, demoAttendances)
        return {
          roster,
          meetings: buildMeetings(demoRecords, demoAttendances, roster),
          labels: shortLabels(roster.map((r) => r.name)),
        }
      }
      const [records, rows] = await Promise.all([readRecords(), readAttendances()])
      const roster = buildRoster(records, rows)
      return {
        roster,
        meetings: buildMeetings(records, rows, roster),
        labels: shortLabels(roster.map((r) => r.name)),
      }
    },
  })
}

export type NewsItem = { id: string; title: string; excerpt: string; author: string; date: string }

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      if (DEMO) return newestFirst(demoNews)
      const { data, error } = await supabase()
        .from('news')
        .select('id, title, excerpt, author, date')
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as NewsItem[]
    },
  })
}

/** Which member name the signed-in user maps to, so their pip can be ringed. */
export function useMyMemberName(userId: string | null) {
  return useQuery({
    queryKey: ['my-member', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (DEMO) return 'Lukas'
      const { data } = await supabase()
        .from('user_member_mapping')
        .select('member_name')
        .eq('user_id', userId!)
        .maybeSingle()
      return (data?.member_name as string | undefined) ?? null
    },
  })
}

export type EventItem = {
  id: string
  title: string
  date: string
  time: string
  location: string
  description: string
}

/**
 * The next meetings. §9 says two are always planned ahead, so this should
 * normally return two — if it returns none, that is itself worth seeing on the
 * front page rather than hiding.
 */
export function useUpcoming() {
  return useQuery({
    queryKey: ['upcoming'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      if (DEMO) {
        return demoEvents
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 2)
      }
      const { data, error } = await supabase()
        .from('events')
        .select('id, title, date, time, location, description')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(2)
      if (error) throw error
      return (data ?? []) as EventItem[]
    },
  })
}

/**
 * Every meeting in the calendar, the held ones included, newest first.
 *
 * Its own query rather than a looser `useUpcoming`. That one is narrow on
 * purpose — the next two, because §9 promises two, and a front page answers one
 * question. Widening it to serve an editing screen would put fifteen years of
 * meetings on the front page to save a function.
 *
 * The past matters here for one specific reason: a date typed wrong lands
 * behind today, and a list that only shows the future would hide the row that
 * needs correcting. What the club got wrong has to stay reachable.
 */
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      if (DEMO) return newestFirst(demoEvents)
      const { data, error } = await supabase()
        .from('events')
        .select('id, title, date, time, location, description')
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as EventItem[]
    },
  })
}

// ------------------------------------------------------------ admin writing

/** The two tables the app lets an admin write. RLS is what enforces that. */
export type EditableTable = 'news' | 'events'

/**
 * Which cached reads a write invalidates.
 *
 * `events` feeds two queries — the calendar below and the front page's next
 * two — and refreshing only one of them would leave the club looking at two
 * different calendars in the same app, one of them stale.
 */
const AFFECTED: Record<EditableTable, string[]> = {
  news: ['news'],
  events: ['events', 'upcoming'],
}

function refresh(table: EditableTable, qc: ReturnType<typeof useQueryClient>) {
  for (const key of AFFECTED[table]) qc.invalidateQueries({ queryKey: [key] })
}

/**
 * Write one row, new or corrected.
 *
 * Insert when there is no id, update when there is — one mutation rather than
 * two, because "add a news item" and "fix the typo in a news item" are the same
 * fields and the same save button. Two would be two places to forget a column.
 *
 * Nothing here validates: `news` and `events` are `not null` on every column
 * with no other constraint, so the database's opinion is "text is text". The
 * one rule worth having (a row must have a title) is enforced where it can be
 * explained to the person typing, not thrown back as a Postgres error.
 */
export function useSaveRow(table: EditableTable) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: Record<string, string> }) => {
      // Before the client, not after: a demo build carries the club's real
      // project URL, so falling through would fire a write at fifteen years of
      // history from the build made for showing the app. See data/demo.
      if (DEMO) return demoSave(table, id, values)
      const { error } = id
        ? await supabase().from(table).update(values).eq('id', id)
        : await supabase().from(table).insert(values)
      if (error) throw error
    },
    onSuccess: () => refresh(table, qc),
  })
}

/**
 * Remove one row. There is no undo and no backup — see the confirmation this
 * is wired to, which is the only thing standing between a mis-tap and a lost
 * news item.
 */
export function useDeleteRow(table: EditableTable) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (DEMO) return demoDelete(table, id)
      const { error } = await supabase().from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refresh(table, qc),
  })
}
