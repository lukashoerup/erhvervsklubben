import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { buildMeetings, buildRoster, shortLabels, type AttendanceRow, type RecordRow } from './derive'
import { DEMO, demoAttendances, demoNews, demoRecords, demoUpcoming } from './demo'

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
      const [recs, atts] = await Promise.all([
        supabase()
          .from('attendance_records')
          .select('id, meeting_number, lead, pre_location, main_location, post_location, meeting_date'),
        supabase().from('attendances').select('record_id, member_name, attended'),
      ])
      if (recs.error) throw recs.error
      if (atts.error) throw atts.error

      const records = (recs.data ?? []) as RecordRow[]
      const rows = (atts.data ?? []) as AttendanceRow[]
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
