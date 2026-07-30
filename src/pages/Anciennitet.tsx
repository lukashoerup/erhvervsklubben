import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAttendance, useDeleteMeeting, useFinance, useMyMemberName } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate } from '../lib/dates'
import { AttendanceSummary, MeetingCard, type MeetingFine } from '../components/MeetingCard'
import { DeleteConfirm, EditButton, NewButton } from '../components/AdminEdit'
import { LastSeen } from '../components/LastSeen'
import { deltagelser, MeetingEditor } from '../components/MeetingEditor'
import { Moedekalender } from '../components/Moedekalender'
import { Loading, Problem } from '../components/State'

/**
 * The club's meeting history, and — since T065 — the screen it is written on.
 *
 * Attendance used to be typed into the database by hand, which is why 29
 * meetings carry no date and why the meeting numbers contain duplicates. The
 * controls are the admin's and sit on this page rather than behind an admin
 * route, the same shape as `/nyheder`: a member sees the history
 * exactly as before and is never offered a button that could only fail.
 *
 * These are `attendance_records` — what happened. The calendar above is
 * `events`, what is planned. The two tables have always been separate and this
 * page does not merge them: recording a meeting here puts nothing in the
 * calendar, and deleting a calendar entry loses no attendance.
 *
 * **The meetings page folded into this one on 2026-07-30**, at Lukas's word —
 * *"Ancinitetssiden er den rigtige. Den må der ikke ændres på"*, then *"Så skal
 * mødesiden fjernes"*. So everything below the calendar is exactly what it was,
 * in the order it was, and the merge is three additions: the calendar section on
 * top, a description on each meeting, and a disclosure on the card that opens
 * onto the full text and that evening's fines. See components/Moedekalender.tsx
 * for why `events` outlived its page.
 */
export default function Anciennitet() {
  const { userId, role } = useAuth()
  const { data, isPending, error } = useAttendance()
  const { data: me } = useMyMemberName(userId)
  // The club's fines, so a card can show its own. Same query key as /oekonomi,
  // so the two pages share one request and one cache entry rather than each
  // fetching the table. Its failure is not this page's: a card without its fines
  // is the card the club read yesterday, where a red box over the history would
  // lose four and a half years to a missing side note.
  const finance = useFinance()
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
  // Grouped once, not filtered per card: 28 cards over 30 fines is 840
  // comparisons on every render of the club's longest page.
  const finesByMeeting = new Map<number, MeetingFine[]>()
  for (const f of finance.data?.fines ?? []) {
    const list = finesByMeeting.get(f.record_id)
    if (list) list.push(f)
    else finesByMeeting.set(f.record_id, [f])
  }
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
        <Moedekalender />
        {newMeeting}
        <p className="text-sm text-muted">Ingen møder registreret endnu.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The calendar, on top, because it is the only part of this page that
          looks forward — and because everything under it has to stay where it
          was. It is two cards deep in the ordinary case (§9 requires two
          meetings planned) with the held entries folded away, so the club's own
          history is still what the page opens on after one thumb-flick. */}
      <Moedekalender />

      {newMeeting}
      <AttendanceSummary roster={data.roster} />

      {/* "Sidst set", folded shut, for the admin only (T074). On this page
          because it is the only screen that already lists the club by name, and
          the one an admin is on when he is thinking about the membership rather
          than about a meeting. Read-only builds keep it: it reads, it never
          writes, and a preview of the club's real data should show the club's
          real screens. */}
      {role === 'admin' && <LastSeen roster={names} />}

      {data.meetings.map((m) =>
        mayEdit && open === m.id ? (
          editor(m.id)
        ) : (
          <MeetingCard
            key={m.id}
            meeting={m}
            fines={finesByMeeting.get(m.id)}
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
