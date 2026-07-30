import { useAuth } from '../auth/AuthContext'
import { useEvents, type EventItem } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate, todayISO } from '../lib/dates'
import { DateRail } from './DateRail'
import { Icon } from './Icon'
import { SectionTitle } from './SectionTitle'
import {
  blankDraft,
  DeleteConfirm,
  EditButton,
  EditForm,
  NewButton,
  useEditor,
  type Draft,
  type Field,
} from './AdminEdit'

/**
 * `time` is a text column, so the field is a text field.
 *
 * A native `<input type="time">` would look tidier and would refuse every value
 * the club has actually written: the existing rows say "18.30" with a full
 * stop, which is how Danes write it and not what HTML's time input accepts. The
 * column is text on purpose — a meeting that starts "efter arbejde" is a real
 * answer — so the field takes text and the hint says what the rows look like.
 */
const FIELDS: Field[] = [
  { name: 'title', label: 'Titel' },
  { name: 'date', label: 'Dato', kind: 'date' },
  { name: 'time', label: 'Tidspunkt', hint: 'fx 18.30' },
  { name: 'location', label: 'Sted' },
  { name: 'description', label: 'Beskrivelse', kind: 'textarea' },
]

const draftOf = (e: EventItem): Draft => ({
  title: e.title,
  date: e.date,
  time: e.time,
  location: e.location,
  description: e.description,
})

const blank = () => blankDraft(FIELDS, { date: todayISO() })

/**
 * The club's calendar — what is planned, and what is on the books behind.
 *
 * **This was `/moeder` until 2026-07-30.** Lukas asked for the meetings page and
 * the anciennitet page to become one — *"Så skal mødesiden fjernes"* — with
 * /anciennitet as the surviving screen, untouched. So the calendar moved onto it
 * as a section rather than being deleted, because `events` holds two things
 * `attendance_records` structurally cannot:
 *
 *   * **Meetings still ahead.** #29 and #30 are planned and dated. An attendance
 *     record for a meeting that has not happened would be a record of who
 *     attended it, which is why the two tables were never merged in the database.
 *     Delete this and the club's next meeting is unchangeable, on the front page
 *     as much as here.
 *   * **A held meeting whose record has no date.** `2025-04-26 Erhvervsklub #20`
 *     carries a real description, and record #20 is one of the eleven the history
 *     never dated — so the 2026-07-30 backfill could not match it and it lives on
 *     here. A calendar showing only the future would hide it, along with any
 *     evening whose year was mistyped: that is what the second section is for,
 *     and it is why it is folded rather than dropped.
 *
 * Held entries are shut by default. /anciennitet is the longest page in the app
 * and the history below already tells the club what happened; open, this answers
 * "what did the calendar say" and lets an admin fix it.
 */
export function Moedekalender() {
  const { data, isPending, error } = useEvents()
  const { role } = useAuth()
  const editor = useEditor('events')

  // Admin is Lukas and Claude, nobody else (PROJECT.md 2026-07-27) — and never
  // a read-only build. RLS refuses a member's write regardless; this is what
  // stops the app offering a button that could only fail.
  const mayEdit = role === 'admin' && !READONLY

  // No spinner and no error box. This section sits above a page that renders its
  // own state for the club's history, and two competing "henter…" blocks on one
  // screen read as a page that is broken rather than as one that is loading.
  if (isPending || error || !data) return null

  // Compared and sorted as text: `YYYY-MM-DD` orders correctly that way, so
  // there is no Date here and therefore no zone to get wrong. The two halves
  // run in opposite directions — soonest first ahead, most recent first behind
  // — because both mean "nearest to now".
  const today = todayISO()
  const planned = data
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const held = data.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date))

  const form = (id: string | null) => (
    <EditForm
      key={id ?? 'ny'}
      fields={FIELDS}
      draft={editor.draft}
      onChange={editor.change}
      onSave={editor.save}
      onCancel={editor.close}
      saving={editor.saving}
      failed={editor.failed}
      // A meeting without a title is not a meeting. The date, the venue and the
      // time are routinely decided later — §9 has the lead calling the meeting
      // two weeks ahead — so requiring them would stop the club writing down
      // the one thing it has agreed.
      canSave={Boolean(editor.draft.title?.trim())}
    />
  )

  const card = (e: EventItem, next: boolean, ahead: boolean) => (
    <article
      key={e.id}
      data-reveal
      /* 1.5px blue on the next one — the design system marks the live row by
         border weight, never by fill. */
      className={`rounded-2xl border bg-surface p-4 ${next ? 'border-[1.5px] border-accent' : 'border-line'}`}
    >
      {/* The date is the card's face rather than a 10 px line above its title:
          what a member scans a calendar for is *when*, so the day is a 26 px
          serif numeral in a rail with the time under it. The rail's hairline
          carries the club's blue while the meeting is still ahead and the
          ordinary line once it has been held. See components/DateRail.tsx. */}
      <div className="flex gap-3">
        <DateRail iso={e.date} time={e.time} ahead={ahead} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] leading-snug font-semibold">{e.title}</h3>
          {/* The venue on its own line with the set's pin, blue because §04
              draws `place` in #2563EB by name — an icon is a mark, not an
              emphasis (T072).

              **This row is where the map will live.** Lukas, 2026-07-29: "vi
              skal have et kort, som viser alle steder vi har været implementeret
              på længere sigt." Given its own row, its own icon and the full
              width of the card, it can become a link or a chip without the card
              being rebuilt around it. Nothing here reaches for a map today and
              no dependency was added for one.

              Stated rather than left blank: the venue is usually settled after
              the date, so an empty line reads as a page that failed to load. */}
          <p className="mt-2 flex items-baseline gap-1.5 text-xs">
            <Icon name="place" className="shrink-0 text-sm text-accent" />
            <span className={e.location ? 'font-medium text-ink' : 'text-faint'}>
              {e.location || 'Sted endnu ikke sat'}
            </span>
          </p>
          {e.description && (
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted">{e.description}</p>
          )}
        </div>
      </div>

      {mayEdit && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <EditButton onClick={() => editor.edit(e.id, draftOf(e))} />
          <DeleteConfirm
            what={`${e.title} · ${daDate(e.date)}`}
            onDelete={() => editor.remove(e.id)}
            pending={editor.removing(e.id)}
            failed={editor.removeFailed(e.id)}
          />
        </div>
      )}
    </article>
  )

  return (
    <div className="flex flex-col gap-2.5">
      <SectionTitle>Planlagte møder</SectionTitle>

      {mayEdit &&
        (editor.creating ? (
          form(null)
        ) : (
          // "i kalenderen", because /anciennitet now carries two new-meeting
          // buttons that write different tables: this one plans an evening,
          // "Registrér møde" below records one that has happened.
          <NewButton label="Nyt møde i kalenderen" onClick={() => editor.create(blank())} />
        ))}

      {planned.length === 0 ? (
        // Not a neutral empty state: the statutes require two in the calendar
        // at all times, so nothing planned is a fact worth stating.
        <p className="text-sm text-muted">
          Ingen møder i kalenderen. Vedtægterne §9: der planlægges altid to møder forud.
        </p>
      ) : (
        planned.map((e, i) =>
          mayEdit && editor.editing(e.id) ? form(e.id) : card(e, i === 0, true),
        )
      )}

      {held.length > 0 && (
        <details data-reveal className="rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between p-4">
            <SectionTitle onCard>Kalenderen bagud</SectionTitle>
            <span className="text-[0.62rem] text-faint">{held.length}</span>
          </summary>
          {/* Inside the fold, the same cards. This is the only screen a meeting
              with a mistyped — and therefore past — date can be reached on, so
              an admin still gets Rediger and Slet on every one of them. */}
          <div className="flex flex-col gap-2.5 border-t border-line p-4">
            {held.map((e) => (mayEdit && editor.editing(e.id) ? form(e.id) : card(e, false, false)))}
          </div>
        </details>
      )}
    </div>
  )
}
