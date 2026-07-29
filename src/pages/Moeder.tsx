import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useEvents, type EventItem } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate, todayISO } from '../lib/dates'
import { DateRail } from '../components/DateRail'
import { Icon } from '../components/Icon'
import { Loading, Problem } from '../components/State'
import { SectionTitle } from '../components/SectionTitle'
import {
  blankDraft,
  DeleteConfirm,
  EditButton,
  EditForm,
  NewButton,
  useEditor,
  type Draft,
  type Field,
} from '../components/AdminEdit'

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
 * The club's calendar — what is planned, and what has been held.
 *
 * It exists because the meetings had nowhere to live. The front page names the
 * next one, the public page shows two, and neither can be corrected: an admin
 * with a wrong date had no screen to fix it on. §9 promises two meetings ahead
 * at all times, so how many are actually in the calendar is a fact members are
 * entitled to see rather than a thing only the app knows.
 *
 * Held meetings stay on the page, below. They are what a mistyped date turns
 * into, and a list that showed only the future would hide the row that needs
 * fixing — the club would lose a meeting by getting its year wrong.
 *
 * These are `events`, not `attendance_records`: the calendar, not the
 * attendance history. Anciennitet reads the other table.
 */
export default function Moeder() {
  const { data, isPending, error } = useEvents()
  const { role } = useAuth()
  const editor = useEditor('events')

  // Admin is Lukas and Claude, nobody else (PROJECT.md 2026-07-27) — and never
  // a read-only build. RLS refuses a member's write regardless; this is what
  // stops the app offering a button that could only fail.
  const mayEdit = role === 'admin' && !READONLY

  if (isPending) return <Loading what="møder" />
  if (error) return <Problem />

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
      {/* The date became the card's face rather than a 10 px line above its
          title. Both halves of this page are the same card repeated, and what
          a member scans for is *when* — so the day is a 26 px serif numeral in
          a rail, with the time under it, and the whole "hvornår" is one block
          on the left instead of a sentence across the top. The rail's hairline
          carries the club's blue while the meeting is still ahead and the
          ordinary line once it has been held: scrolled past the boundary, the
          page says which half you are in without a chip or a second heading.
          See components/DateRail.tsx.

          The blue on the card itself is still its border and only its border,
          which is how the system marks the live row. */}
      <div className="flex gap-3">
        <DateRail iso={e.date} time={e.time} ahead={ahead} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] leading-snug font-semibold">{e.title}</h3>
          {/* The venue on its own line with the set's pin, blue because §04
              draws `place` in #2563EB by name — an icon is a mark, not an
              emphasis (T072).

              **This row is where the map will live.** Lukas, 2026-07-29: "vi
              skal have et kort, som viser alle steder vi har været implementeret
              på længere sigt." A place is a different kind of thing from a
              title and a description, and it was previously indistinguishable
              from either — one more muted 12 px line in a stack of them. Given
              its own row, its own icon and the full width of the card, it can
              become a link, a chip or a row of them without the card being
              rebuilt around it. Nothing here reaches for a map today and no
              dependency was added for one.

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
    <div className="flex flex-col gap-3">
      {mayEdit &&
        (editor.creating ? (
          form(null)
        ) : (
          <NewButton label="Nyt møde" onClick={() => editor.create(blank())} />
        ))}

      <Section title="Planlagte møder">
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
      </Section>

      <Section title="Afholdte møder">
        {held.length === 0 ? (
          <p className="text-sm text-muted">Ingen afholdte møder i kalenderen.</p>
        ) : (
          held.map((e) => (mayEdit && editor.editing(e.id) ? form(e.id) : card(e, false, false)))
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      {/* Sticky here more than anywhere: the two halves of this page look
          identical card for card, and which half you are in — planned, or
          already held — is the whole difference between "we are meeting" and
          "we met". Scrolled past the boundary, the page had stopped saying. */}
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}
