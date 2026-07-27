import { useState } from 'react'
import type { Meeting } from '../data/derive'
import { useSaveMeeting, type Attendance } from '../data/useClubData'
import { blankDraft, EditForm, type Draft, type Field } from './AdminEdit'

/**
 * The columns of `attendance_records`, in the order the evening happened.
 *
 * `meeting_number`, `lead` and `main_location` are `not null`; the two other
 * venues and the date are not, and empty means null rather than an empty
 * string — the history stores null there, and a column of `''` mixed with
 * nulls is two spellings of "nothing" for `derive.ts` to filter twice.
 *
 * The date says it may be left empty because it usually is: all 29 meetings in
 * production are undated, and this form is how they stop being. It is *not*
 * prefilled with today. This screen gets used the morning after a meeting, so
 * today's date would be wrong by one day every time — and wrong silently,
 * where an empty date shows on the card as "uden dato" and on Økonomi as a
 * counted reason the chart cannot be drawn. A visible gap beats an invisible
 * error in the one column the club's whole finance view hangs off.
 */
const FIELDS: Field[] = [
  { name: 'meeting_number', label: 'Mødenummer', kind: 'number' },
  { name: 'lead', label: 'Lead' },
  { name: 'meeting_date', label: 'Dato', kind: 'date', hint: 'kan stå tom' },
  { name: 'pre_location', label: 'Før' },
  { name: 'main_location', label: 'Sted' },
  { name: 'post_location', label: 'Efter' },
]

const TICK =
  'flex min-h-12 w-full flex-col justify-center rounded-lg border px-2 py-1 text-left'
/* The same two marks the attendance pips use: filled with a solid edge, or
   hollow with a dashed one. Roughly one man in twelve cannot separate the two
   hues, and this is the control that decides whether he earns anciennitet. Here
   there is room for the word as well, so the state is written out — nothing on
   this button needs to be seen in colour to be read. */
const TICK_STATE = {
  on: 'border-solid border-present/40 bg-present/20',
  off: 'border-dashed border-absent/50 bg-transparent',
} as const

const SMALL =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-3 text-sm text-muted hover:border-accent disabled:opacity-50'

/** Danish has a singular and a plural, and neither of them is "deltagelse(r)". */
export const deltagelser = (n: number) => `${n} ${n === 1 ? 'deltagelse' : 'deltagelser'}`

/** What the database holds for this meeting. A name missing from it has no row. */
export function storedAttendance(meeting: Meeting | null): Attendance {
  if (!meeting) return {}
  return {
    ...Object.fromEntries(meeting.present.map((n) => [n, true])),
    ...Object.fromEntries(meeting.absent.map((n) => [n, false])),
  }
}

const draftOf = (m: Meeting | null, nextNumber: number): Draft =>
  blankDraft(
    FIELDS,
    m
      ? {
          meeting_number: String(m.number),
          lead: m.lead,
          meeting_date: m.date ?? '',
          // `m.venues`, never `m.route`: the route has the empty steps dropped,
          // so an evening with no pre-drinks and one with no after-party are
          // the same two strings, and rebuilding the columns from it would move
          // a venue up a column and save it there.
          pre_location: m.venues.pre ?? '',
          main_location: m.venues.main,
          post_location: m.venues.post ?? '',
        }
      : { meeting_number: String(nextNumber) },
  )

/**
 * Recording a meeting, and correcting one already recorded.
 *
 * The club's attendance was kept outside the app until now: someone typed rows
 * into the database by hand, which is why 29 meetings have no date and why the
 * meeting numbers contain duplicates. This is the screen that replaces that,
 * and it is used the morning after a meeting on a phone — so attendance is ten
 * buttons at the design system's 48 px, two to a row, and the whole meeting
 * saves in one press.
 *
 * Everyone starts ticked on a new meeting. Eight or nine of ten turn up, so
 * ticking the absentees off is two taps where ticking the attendees on is
 * eight — and the count sits above the buttons and in the save button itself,
 * so what is about to be written is on screen rather than assumed.
 */
export function MeetingEditor({
  meeting,
  roster,
  nextNumber,
  onClose,
}: {
  /** Null creates one. */
  meeting: Meeting | null
  /** Every member the club has, most anciennitet first. */
  roster: string[]
  nextNumber: number
  onClose: () => void
}) {
  const stored = storedAttendance(meeting)
  const save = useSaveMeeting()
  const [draft, setDraft] = useState<Draft>(() => draftOf(meeting, nextNumber))
  const [newName, setNewName] = useState('')
  const [ticks, setTicks] = useState<Attendance>(() =>
    Object.fromEntries(
      // A member with no row for this meeting reads as absent, because a
      // two-state toggle has no third position — and saving leaves them
      // without one unless they are ticked present. See `useSaveMeeting`.
      [...new Set([...roster, ...Object.keys(stored)])].map((n) => [
        n,
        meeting ? (stored[n] ?? false) : true,
      ]),
    ),
  )

  // Alphabetical, unlike the card's pips, which run by anciennitet. Reading a
  // meeting and finding a name in it are different jobs: you arrive here
  // already knowing whose tick is wrong, and alphabetical order is the one that
  // answers "where is Mads".
  const names = Object.keys(ticks).sort((a, b) => a.localeCompare(b, 'da'))
  const present = names.filter((n) => ticks[n]).length

  const number = Number(draft.meeting_number)
  const canSave =
    Number.isInteger(number) &&
    number > 0 &&
    Boolean(draft.lead?.trim()) &&
    Boolean(draft.main_location?.trim())

  const trimmed = newName.trim()
  const canAdd =
    trimmed.length > 0 && !names.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  function addName() {
    if (!canAdd) return
    setTicks((t) => ({ ...t, [trimmed]: true }))
    setNewName('')
  }

  function submit() {
    save.mutate(
      {
        id: meeting?.id ?? null,
        record: {
          meeting_number: number,
          lead: draft.lead.trim(),
          meeting_date: draft.meeting_date?.trim() || null,
          pre_location: draft.pre_location?.trim() || null,
          main_location: draft.main_location.trim(),
          post_location: draft.post_location?.trim() || null,
        },
        attendance: ticks,
        stored,
      },
      // Closed only once the rows are actually written — closing on the tap
      // would show a saved-looking card built from a request that may fail.
      { onSuccess: onClose },
    )
  }

  return (
    <EditForm
      fields={FIELDS}
      draft={draft}
      onChange={setDraft}
      onSave={submit}
      onCancel={onClose}
      saving={save.isPending}
      failed={save.isError}
      canSave={canSave}
    >
      <fieldset className="mt-1 rounded-lg border border-line p-2">
        <legend className="px-1 text-xs text-muted">
          Til stede · <span className="tabular">{present}</span> af{' '}
          <span className="tabular">{names.length}</span>
        </legend>

        <ul className="grid grid-cols-2 gap-1.5">
          {names.map((name) => (
            <li key={name}>
              <button
                type="button"
                aria-pressed={ticks[name] ?? false}
                onClick={() => setTicks((t) => ({ ...t, [name]: !t[name] }))}
                className={`${TICK} ${ticks[name] ? TICK_STATE.on : TICK_STATE.off}`}
              >
                <span className="truncate text-[0.8rem] leading-tight font-semibold text-ink">
                  {name}
                </span>
                <span
                  className={`text-[0.55rem] leading-tight ${
                    ticks[name] ? 'text-present' : 'text-absent'
                  }`}
                >
                  {ticks[name] ? 'til stede' : 'ikke til stede'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* The roster is every name that already appears in `attendances` —
            there is no members table — so an eleventh member cannot be ticked
            until some meeting has recorded them once. Without this field the
            app could record every meeting except the one that matters, and the
            club would be back to typing rows into the database by hand. */}
        <div className="mt-2 flex gap-1.5">
          <label className="flex-1 text-xs text-muted">
            <span className="sr-only">Nyt medlem</span>
            <input
              type="text"
              aria-label="Nyt medlem"
              placeholder="Nyt medlem"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              // Enter in this field would otherwise submit the form and save
              // the meeting without the name that was being typed into it.
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                addName()
              }}
              className="block min-h-12 w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink"
            />
          </label>
          <button type="button" onClick={addName} disabled={!canAdd} className={SMALL}>
            Tilføj
          </button>
        </div>
      </fieldset>
    </EditForm>
  )
}
