import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { buildMeetings, buildRoster, shortLabels, type AttendanceRow, type RecordRow } from './derive'
import {
  DEMO,
  demoAttendances,
  demoDelete,
  demoDeleteMeeting,
  demoEvents,
  demoNews,
  demoRecords,
  demoSave,
  demoSaveMeeting,
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

/**
 * The tables the app lets an admin write. RLS is what enforces that.
 *
 * `attendance_records` stands for the meeting *and* its attendance rows, which
 * are written together and never apart — see `useSaveMeeting`. Splitting them
 * into two entries would invite a caller to write one without the other, which
 * is a meeting nobody attended or attendance at no meeting.
 */
export type EditableTable = 'news' | 'events' | 'attendance_records'

/** The two whose rows are flat text and go through the shared form below. */
export type ContentTable = Exclude<EditableTable, 'attendance_records'>

/**
 * Which cached reads a write invalidates.
 *
 * `events` feeds two queries — the calendar below and the front page's next
 * two — and refreshing only one of them would leave the club looking at two
 * different calendars in the same app, one of them stale.
 *
 * A meeting feeds `finance` as well as `attendance`: a fine is placed in a
 * month by its meeting's date, so setting that date moves money into the
 * ledger, and deleting a meeting takes its fines with it (`fines.record_id` is
 * `on delete cascade`). Leaving `finance` stale would show the club a monthly
 * total that its own meeting list no longer supports.
 */
const AFFECTED: Record<EditableTable, string[]> = {
  news: ['news'],
  events: ['events', 'upcoming'],
  attendance_records: ['attendance', 'finance'],
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
export function useSaveRow(table: ContentTable) {
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
export function useDeleteRow(table: ContentTable) {
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

// ------------------------------------------------------ writing a meeting

/** The `attendance_records` columns an admin fills in. */
export type MeetingRecord = {
  meeting_number: number
  lead: string
  /** Null is ordinary: all 29 meetings in production are undated. */
  meeting_date: string | null
  pre_location: string | null
  main_location: string
  post_location: string | null
}

/** Who was ticked off: member name → was present. */
export type Attendance = Record<string, boolean>

export type MeetingWrite = {
  /** Null creates the meeting. */
  id: number | null
  record: MeetingRecord
  /** Every name the form offered, as it is ticked now. */
  attendance: Attendance
  /** What the database holds. A name missing from this has no row at all. */
  stored: Attendance
}

/**
 * Write a meeting and who attended it — two tables, one save.
 *
 * The order matters and is not interchangeable: a new meeting's row has to
 * exist, and hand back the serial id the database chose, before any attendance
 * can point at it. So the insert asks for its own row rather than assuming a
 * number.
 *
 * **Only what changed is written.** A member with no row for a meeting is not
 * the same as a member marked absent — `buildRoster` counts `total` from the
 * rows that exist, so materialising the missing ones would quietly grow the
 * denominator under "X deltagelser af Y" on every member, across 29 historical
 * meetings, as a side effect of opening a form and pressing Gem. The form has
 * to show two states because a phone toggle has two, so an untouched member
 * with no row reads as "ikke til stede" and writes nothing at all. Ticking one
 * *to* present is a deliberate act and does insert a row.
 *
 * Attendance is corrected by `(record_id, member_name)` rather than by the
 * row's own id. There is no unique index on that pair — the club's data does
 * not have one — so this is a filter, not an upsert; it updates however many
 * rows match, which for a duplicate would be both, and both are equally wrong
 * today. Reading the ids back first would be one more round trip to be no more
 * correct.
 *
 * Deliberately not a transaction: PostgREST has no way to offer one. A failure
 * halfway leaves the meeting saved and some ticks not, which is visible on the
 * next render and fixable by pressing Gem again — the alternative, deleting
 * and re-inserting the attendance rows, turns the same failure into a meeting
 * whose attendance is simply gone.
 */
export function useSaveMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, record, attendance, stored }: MeetingWrite) => {
      // Before the client, exactly as useSaveRow does it: the demo bundle
      // carries the live project's URL and key.
      if (DEMO) return demoSaveMeeting({ id, record, attendance, stored })

      let recordId = id
      if (recordId === null) {
        const created = await supabase()
          .from('attendance_records')
          .insert(record)
          .select('id')
          .single()
        if (created.error) throw created.error
        recordId = (created.data as { id: number }).id
      } else {
        const { error } = await supabase()
          .from('attendance_records')
          .update(record)
          .eq('id', recordId)
        if (error) throw error
      }

      const names = Object.keys(attendance)
      // A brand new meeting gets a row per member either way — that is the
      // shape "one row per member per meeting" the club's data is supposed to
      // have, and the reason to keep writing it for meetings the app creates.
      const fresh = id === null ? names : names.filter((n) => stored[n] === undefined && attendance[n])
      const changed =
        id === null
          ? []
          : names.filter((n) => stored[n] !== undefined && stored[n] !== attendance[n])

      if (fresh.length > 0) {
        const { error } = await supabase()
          .from('attendances')
          .insert(
            fresh.map((member_name) => ({
              record_id: recordId,
              member_name,
              attended: attendance[member_name],
            })),
          )
        if (error) throw error
      }

      for (const member_name of changed) {
        const { error } = await supabase()
          .from('attendances')
          .update({ attended: attendance[member_name] })
          .eq('record_id', recordId)
          .eq('member_name', member_name)
        if (error) throw error
      }
    },
    onSuccess: () => refresh('attendance_records', qc),
  })
}

/**
 * Remove a meeting, and everything hanging off it.
 *
 * One statement, because the database does the rest: `attendances.record_id`
 * and `fines.record_id` are both `on delete cascade`, so ~10 attendance rows
 * and any fines recorded that evening go with the meeting. The confirmation
 * this is wired to says so in those words — the club has one copy and no
 * backup habit, and "slet møde" reads like one row.
 *
 * `event_evaluations.record_id` is deliberately *not* cascading (it matches
 * production, verified 2026-07-23), so a meeting somebody submitted feedback on
 * refuses to delete and the screen says the delete failed. One evaluation has
 * ever been written, so this is close to theoretical — but the refusal is the
 * right way round: feedback is the one thing on a meeting nobody can recreate.
 */
export function useDeleteMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      if (DEMO) return demoDeleteMeeting(id)
      const { error } = await supabase().from('attendance_records').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refresh('attendance_records', qc),
  })
}
