import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  useAttendance,
  useDeleteMeeting,
  useDeleteRow,
  useFinance,
  useMyMemberName,
} from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate } from '../lib/dates'
import { AttendanceSummary, MeetingCard, type MeetingFine } from '../components/MeetingCard'
import { DeleteConfirm, EditButton, NewButton } from '../components/AdminEdit'
import { LastSeen } from '../components/LastSeen'
import type { Draft } from '../components/AdminEdit'
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
 * **This is the club's only meetings page since 2026-07-30**, at Lukas's word —
 * *"Ancinitetssiden er den rigtige. Den må der ikke ændres på"*, then *"Så skal
 * mødesiden fjernes."* So the page below is what it was, in the order it was, and
 * the merge is four additions: a description on each meeting, a disclosure on the
 * card opening onto the full text and that evening's fines, the meetings the
 * history has no evening for (`Moedekalender`), and one button where there were
 * two.
 *
 * **One list, one button, no meeting twice.** His verdict on the first attempt —
 * *"der ligger jo to knapper der laver møder … alle møder ligger flere gange …
 * Det er jo alt sammen møder"* — named both faults, and the duplication was the
 * real one: ten of the twelve `events` rows are the same evenings as the cards
 * here, and both were being drawn. `heldDates` is what stops that now.
 *
 * The two tables stay two tables, because an attendance record is a record of who
 * attended and a meeting still ahead cannot have one. What went away is the
 * *seam* being visible: the form routes on the date it is given
 * (`useSaveMeeting`), so the club sees one list of meetings and one way to add to
 * it.
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
  /**
   * The calendar entry a new meeting is being recorded from, if any. Its date, venue
   * and description seed the form, so the evening is written down as it was
   * announced rather than retyped from memory the morning after.
   */
  const [fromEvent, setFromEvent] = useState<Draft | undefined>(undefined)
  /** The calendar row that becomes this meeting, retired once the meeting exists. */
  const [fromEventId, setFromEventId] = useState<string | null>(null)
  const retireEvent = useDeleteRow('events')

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
      preset={id === null ? fromEvent : undefined}
      onSaved={() => {
        if (fromEventId) retireEvent.mutate(fromEventId)
      }}
      onClose={() => {
        setOpen(null)
        setFromEvent(undefined)
        setFromEventId(null)
      }}
    />
  )

  /**
   * Open the meeting form seeded from a calendar entry, and retire that entry once
   * the meeting exists.
   *
   * Lukas, 2026-08-08: *"Før mødet er begyndt, er det blot en kommende begivenhed og
   * det bliver så automatisk et møde når man registrerer deltagelse"* — and, in the
   * same breath, *"så der ikke er to forskellige typer cards."* The first version of
   * this left the calendar row alone and let it expire the next day, which put the
   * evening on the page twice for the length of its own night. That is the
   * duplication he has now objected to three times, and he is right each time.
   *
   * **Written, then retired, in that order.** The meeting is created first and the
   * calendar row deleted only on success, so a save that fails leaves the plan
   * exactly where it was rather than losing both. Nothing is lost either way: the
   * date, the venue and what the lead wrote all move onto the meeting.
   */
  const recordFrom = (e: {
    id: string
    date: string
    location: string
    description: string
  }) => {
    setFromEvent({
      meeting_date: e.date,
      main_location: e.location,
      description: e.description,
    })
    setFromEventId(e.id)
    setOpen('ny')
  }

  // **One button, for both kinds of meeting.** Lukas, 2026-07-30: "der ligger jo
  // to knapper der laver møder … Det er jo alt sammen møder." It was "Registrér
  // møde" beside "Nyt møde i kalenderen", which is the app's two tables showing
  // through the screen. The form decides from the date it is given: ahead goes in
  // the calendar, today or behind is recorded with its attendance. See
  // `useSaveMeeting`.
  const newMeeting =
    mayEdit &&
    (open === 'ny' ? editor(null) : <NewButton label="Nyt møde" onClick={() => setOpen('ny')} />)

  if (data.meetings.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {newMeeting}
        <Moedekalender onRecord={mayEdit ? recordFrom : undefined} />
        <p className="text-sm text-muted">Ingen møder registreret endnu.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {newMeeting}
      <AttendanceSummary roster={data.roster} />

      {/* "Sidst set", folded shut, for the admin only (T074). On this page
          because it is the only screen that already lists the club by name, and
          the one an admin is on when he is thinking about the membership rather
          than about a meeting. Read-only builds keep it: it reads, it never
          writes, and a preview of the club's real data should show the club's
          real screens. */}
      {role === 'admin' && <LastSeen roster={names} />}

      {/* The meetings still ahead, in the same stream as the ones behind rather
          than in a box of their own. Lukas: "Generelt så skal de ligge samme sted
          som de gamle møder … Det er jo alt sammen møder." Nothing past is drawn
          here, so no meeting is on this page twice and nothing needs deduplicating
          — see components/Moedekalender.tsx. */}
      <Moedekalender onRecord={mayEdit ? recordFrom : undefined} />

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
