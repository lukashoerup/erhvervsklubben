import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { buildMeetings, buildRoster, shortLabels, type AttendanceRow, type RecordRow } from './derive'
import { DEMO, demoAttendances, demoNews, demoRecords, demoUpcoming } from './demo'

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
      if (DEMO) return demoNews
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
      if (DEMO) return demoUpcoming
      const today = new Date().toISOString().slice(0, 10)
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
