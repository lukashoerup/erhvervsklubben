import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAttendance, useDeleteMeeting, useMyMemberName } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate } from '../lib/dates'
import { AttendanceSummary, MeetingCard } from '../components/MeetingCard'
import { DeleteConfirm, EditButton, NewButton } from '../components/AdminEdit'
import { deltagelser, MeetingEditor } from '../components/MeetingEditor'
import { Loading, Problem } from '../components/State'

/**
 * The club's meeting history, and — since T065 — the screen it is written on.
 *
 * Attendance used to be typed into the database by hand, which is why 29
 * meetings carry no date and why the meeting numbers contain duplicates. The
 * controls are the admin's and sit on this page rather than behind an admin
 * route, the same shape as `/nyheder` and `/moeder`: a member sees the history
 * exactly as before and is never offered a button that could only fail.
 *
 * These are `attendance_records` — what happened. `/moeder` is `events`, what
 * is planned. The two tables have always been separate and this page does not
 * touch the other: recording a meeting here puts nothing in the calendar, and
 * deleting a calendar entry loses no attendance.
 */
export default function Anciennitet() {
  const { userId, role } = useAuth()
  const { data, isPending, error } = useAttendance()
  const { data: me } = useMyMemberName(userId)
  const remove = useDeleteMeeting()
  /** The meeting being edited, or 'ny' for one that does not exist yet. */
  const [open, setOpen] = useState<number | 'ny' | null>(null)

  // Admin is Lukas and Claude, nobody else (PROJECT.md 2026-07-27) — and never
  // a read-only build. RLS refuses a member's write regardless; this is what
  // stops the app offering a button that could only fail.
  const mayEdit = role === 'admin' && !READONLY

  if (isPending) return <Loading what="anciennitet" />
  if (error) return <Problem />

  const names = data.roster.map((r) => r.name)
  // A suggestion, not a rule: the club's numbers already repeat, so the field
  // stays editable and nothing here rejects a duplicate.
  const nextNumber = Math.max(0, ...data.meetings.map((m) => m.number)) + 1

  const editor = (id: number | null) => (
    <MeetingEditor
      key={id ?? 'ny'}
      meeting={id === null ? null : data.meetings.find((m) => m.id === id)!}
      roster={names}
      nextNumber={nextNumber}
      onClose={() => setOpen(null)}
    />
  )

  const newMeeting =
    mayEdit &&
    (open === 'ny' ? editor(null) : <NewButton label="Registrér møde" onClick={() => setOpen('ny')} />)

  if (data.meetings.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {newMeeting}
        <p className="text-sm text-muted">Ingen møder registreret endnu.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {newMeeting}
      <AttendanceSummary roster={data.roster} />

      {data.meetings.map((m) =>
        mayEdit && open === m.id ? (
          editor(m.id)
        ) : (
          <MeetingCard
            key={m.id}
            meeting={m}
            labels={data.labels}
            me={me}
            actions={
              mayEdit && (
                <>
                  <EditButton onClick={() => setOpen(m.id)} />
                  <DeleteConfirm
                    // Two meetings can carry the same number — the club's data
                    // genuinely has duplicates — so the question needs the lead
                    // and the date to say which evening is about to go.
                    what={`Møde ${m.number} · ${m.lead || 'ukendt lead'} · ${
                      m.date ? daDate(m.date) : 'uden dato'
                    }`}
                    // Both foreign keys cascade, so this is never one row, and
                    // "Slet" reads as though it were.
                    detail={`${deltagelser(
                      m.present.length + m.absent.length,
                    )} og mødets bøder slettes med.`}
                    onDelete={() => remove.mutate(m.id)}
                    pending={remove.isPending && remove.variables === m.id}
                    failed={remove.isError && remove.variables === m.id}
                  />
                </>
              )
            }
          />
        ),
      )}
    </div>
  )
}
