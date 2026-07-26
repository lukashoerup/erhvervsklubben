import { useAuth } from '../auth/AuthContext'
import { useAttendance, useMyMemberName } from '../data/useClubData'
import { AttendanceSummary, MeetingCard } from '../components/MeetingCard'
import { Loading, Problem } from '../components/State'

export default function Anciennitet() {
  const { userId } = useAuth()
  const { data, isPending, error } = useAttendance()
  const { data: me } = useMyMemberName(userId)

  if (isPending) return <Loading what="anciennitet" />
  if (error) return <Problem />
  if (data.meetings.length === 0)
    return <p className="text-sm text-muted">Ingen møder registreret endnu.</p>

  return (
    <div className="flex flex-col gap-3">
      <AttendanceSummary roster={data.roster} />
      {data.meetings.map((m) => (
        <MeetingCard key={m.id} meeting={m} labels={data.labels} me={me} />
      ))}
    </div>
  )
}
