import { useState } from 'react'
import type { Meeting } from '../data/derive'
import { useSaveMeeting, type Attendance } from '../data/useClubData'
import { todayISO } from '../lib/dates'
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
  // Lukas, 2026-07-30: "der skal være mulighed for at lave en kort beskrivelse i
  // ancinitetssiden". Last, because the six fields above are what a meeting *is*
  // and this is what was said about it — and because it is the one field that
  // grows: a textarea between two single-line inputs pushes the venues off a
  // phone screen. The eight seeded from the calendar run from four words to a
  // full paragraph, so the hint states the intent without the form enforcing a
  // length nobody agreed to.
  {
    name: 'description',
    label: 'Beskrivelse',
    kind: 'textarea',
    hint: 'kort — vises på kortet, fuldt når man klikker ind',
  },
]

/**
 * The one extra field a meeting that has not happened yet needs, and the reason it
 * is not in the list above: `attendance_records` has no `time` column, so it is
 * only ever written on the calendar branch of `useSaveMeeting`. A text field, not
 * `<input type="time">` — the club writes "18.30" with a full stop, which is how
 * Danes write it and not what HTML's time input accepts.
 */
const AHEAD_FIELDS: Field[] = [{ name: 'time', label: 'Tidspunkt', hint: 'fx 18.30' }]

const TICK =
  'flex min-h-12 w-full flex-col justify-center rounded-btn border px-2 py-1 text-left'
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
  'inline-flex min-h-12 items-center justify-center rounded-btn border border-line px-3 text-sm text-muted hover:border-accent disabled:opacity-50'

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

const draftOf = (m: Meeting | null, nextNumber: number, preset?: Draft): Draft =>
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
          description: m.description ?? '',
          time: '',
        }
      : { meeting_number: String(nextNumber), ...preset },
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
  preset,
  onSaved,
  onClose,
}: {
  /** Null creates one. */
  meeting: Meeting | null
  /** Every member the club has, most anciennitet first. */
  roster: string[]
  nextNumber: number
  /**
   * Fields to start a *new* meeting from, when the club already wrote them down
   * somewhere. Today that is the calendar: an evening planned weeks ago carries its
   * date, its venue and what the lead said about it, and retyping all three the
   * morning after is how they end up different from what was announced.
   */
  preset?: Draft
  /**
   * Called once the rows are actually written, before the form closes. Its one
   * caller retires the calendar entry this meeting was recorded from — which is why
   * it fires on success only: a failed save must leave the plan where it was.
   */
  onSaved?: () => void
  onClose: () => void
}) {
  const stored = storedAttendance(meeting)
  const save = useSaveMeeting()
  const [draft, setDraft] = useState<Draft>(() => draftOf(meeting, nextNumber, preset))
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
  // A date in the future means this evening has not happened, so it goes in the
  // calendar and there is nothing to tick off. Only on a *new* meeting: changing an
  // existing record's date to a future one is a mistyped year, and it must not move
  // the club's attendance rows into the calendar behind his back. See useSaveMeeting.
  const ahead = !meeting && !!draft.meeting_date && draft.meeting_date > todayISO()
  const canSave =
    Number.isInteger(number) &&
    number > 0 &&
    // A planned meeting has no lead yet — §9 has the lead calling it two weeks
    // ahead, and the club routinely writes the date and the venue down first.
    (ahead || Boolean(draft.lead?.trim())) &&
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
          description: draft.description?.trim() || null,
        },
        attendance: ticks,
        stored,
        // Only read when the date puts the meeting ahead — see useSaveMeeting.
        time: draft.time,
      },
      // Closed only once the rows are actually written — closing on the tap
      // would show a saved-looking card built from a request that may fail.
      {
        onSuccess: () => {
          onSaved?.()
          onClose()
        },
      },
    )
  }

  return (
    <EditForm
      fields={ahead ? [...FIELDS, ...AHEAD_FIELDS] : FIELDS}
      draft={draft}
      onChange={setDraft}
      onSave={submit}
      onCancel={onClose}
      saving={save.isPending}
      failed={save.isError}
      canSave={canSave}
    >
      {ahead ? (
        /* Said, not silently done. The form has just dropped ten buttons and
           gained a time field because of one character in the date, and a person
           who cannot see why that happened will assume the app is broken. */
        <p className="mt-1 rounded-lg border border-accent-d bg-surface p-3 text-xs leading-relaxed text-muted">
          Datoen er i fremtiden, så mødet lægges i kalenderen. Deltagelse og bøder
          registreres bagefter — rediger mødet her, når det er afholdt.
        </p>
      ) : (
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

        {/* Since T069 the roster is the members table *plus* every name the
            attendance history holds, so a newly admitted member shows up here
            without having attended anything. This field covers the evening
            before that — a guest, or someone admitted between meetings, ticked
            off on the spot rather than the club going back to typing rows into
            the database by hand. A name added this way has no member record and
            is therefore charged nothing; see data/members.ts. */}
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
              className="block min-h-12 w-full rounded-btn border border-line bg-raised px-3 py-2 text-sm text-ink"
            />
          </label>
          <button type="button" onClick={addName} disabled={!canAdd} className={SMALL}>
            Tilføj
          </button>
        </div>
      </fieldset>
      )}
    </EditForm>
  )
}
