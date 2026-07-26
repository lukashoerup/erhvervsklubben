import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { buildMeetings, buildRoster, shortLabels, type AttendanceRow, type RecordRow } from './derive'

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
      const { data } = await supabase()
        .from('user_member_mapping')
        .select('member_name')
        .eq('user_id', userId!)
        .maybeSingle()
      return (data?.member_name as string | undefined) ?? null
    },
  })
}
