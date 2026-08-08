import { useAuth } from '../auth/AuthContext'
import { useEvents, type EventItem } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate, todayISO } from '../lib/dates'
import { Icon } from './Icon'
import { MeetingHead } from './MeetingCard'
import { SectionTitle } from './SectionTitle'
import {
  DeleteConfirm,
  EditButton,
  EditForm,
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

/** Short month, so the date sits in one line beside the heading. As MeetingCard. */
const SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

/**
 * A calendar row, read as the same three things a held meeting is read as: a
 * number, a name for the evening, and a date.
 *
 * The club writes its meeting number into the *title* — "Erhvervsklub #29",
 * "Erhvervsklub #25 JUBILÆUM" — so the figure is lifted out of it and what remains
 * becomes the heading. Where nothing remains (the ordinary case, the club's own
 * name and a number) the venue takes over, which is what a member wants and is the
 * same slot the lead occupies on a held meeting.
 *
 * Titles with no number at all — "Generalforsamling 2026", "Udarbejdelse af
 * vedtægtsudkast" — keep their whole title as the heading and take the day of the
 * month as the figure. Those are the rows where the title *is* the information.
 *
 * **This reads the number, it never joins on it.** T071 established that the club's
 * own numbering ran a meeting ahead of the database's through the middle of the
 * history, so "#20" is not record 20 — which is why the 2026-07-30 backfill matched
 * on dates and leads instead. Printing the club's own label back to the club is a
 * different act from using it as a key.
 */
/**
 * The club's own word for "a meeting", which every numbered title opens with —
 * "Erhvervsklub #29", "Møde #30". Stripped from the heading because the figure
 * beside it has already said which meeting this is, and a card labelled
 * "Erhvervsklub" in the club's own app labels nothing.
 */
const GENERIC = /^\s*(erhvervsklub(ben)?|m(ø|oe)de(t)?)\b/i

export function calendarHead(e: EventItem): { figure: string; heading: string } {
  const numbered = e.title.match(/#\s*(\d+)/)
  if (!numbered) {
    return { figure: e.date.slice(8, 10).replace(/^0/, ''), heading: e.title }
  }
  // What the club said about this evening beyond naming and numbering it.
  // "Erhvervsklub #25 JUBILÆUM" keeps JUBILÆUM, because that is exactly the sort
  // of thing that must survive; "Erhvervsklub #29" keeps nothing and stands aside
  // for the venue. Only the leading club word goes — anything else is kept, which
  // is why the pattern is one short anchored alternation rather than a list that
  // would start eating real titles.
  const rest = e.title.replace(numbered[0], ' ').replace(GENERIC, ' ').replace(/\s+/g, ' ').trim()
  return { figure: numbered[1], heading: rest || e.location || 'Sted endnu ikke sat' }
}

/**
 * The meetings that have not happened yet, on /anciennitet.
 *
 * **Only the ones ahead**, since Lukas asked for the two remaining past rows to go:
 * *"Fjern de to kalender aftaler som kun er i kalenderen. De er gamle og vi laver
 * formentligt ikke sådan nogle igen. Så fjern dem fra frontenden."* Those were
 * `2025-04-26 Erhvervsklub #20` — whose attendance record is one of the eleven that
 * never got a date, so nothing could pair them — and `2025-04-20 Udarbejdelse af
 * vedtægtsudkast`, a working session with no attendance at all.
 *
 * **From the frontend, not from the database.** His words, and the right call: #20's
 * calendar row carries the only prose the club has ever written about that evening,
 * and a row nobody renders costs nothing. Both are still in `events`, and a future
 * pass can move #20's description onto its record the day that record gets a date.
 *
 * This also retires `heldDates`. It existed because this section used to draw every
 * *past* calendar row, ten of which are the same evenings as the attendance cards
 * below — the duplication Lukas found. Nothing past is drawn now, so there is
 * nothing left to deduplicate: a meeting still ahead cannot have an attendance
 * record, which is the whole reason `events` exists as its own table.
 *
 * A mistyped date is no longer this section's problem either. A *new* meeting given
 * a past date is routed to `attendance_records` by `useSaveMeeting` and lands among
 * the history cards, visible and editable. The one path left — editing a planned
 * meeting to a past date — makes the card leave this list, so the form says so
 * before it is saved rather than after.
 */
export function Moedekalender({ onRecord }: { onRecord?: (e: EventItem) => void }) {
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

  // Compared and sorted as text: `YYYY-MM-DD` orders correctly that way, so there
  // is no Date here and therefore no zone to get wrong.
  //
  // **Newest first, like everything under it.** Lukas: *"Er det ikke lidt spøjst med
  // rækkefølgen?"* It was: soonest-first here and newest-first below produced 29, 30,
  // 28, 27 — the number climbing and then dropping back. That came across from
  // `/moeder`, where the two halves were separate sections with their own headings
  // and running each outward from today was right. In one continuous stream it is
  // just a jag, and /anciennitet is one stream now.
  const today = todayISO()
  const planned = data
    .filter((e) => e.date >= today)
    .sort((a, b) => b.date.localeCompare(a.date))
  // The next meeting, and therefore the one the design system marks by border
  // weight. Found by id rather than by position: after the sort above it is the
  // *last* of the planned, and `i === 0` quietly marking the furthest-off meeting
  // instead is exactly the kind of thing a reader would not question.
  const nextId = planned.length > 0 ? planned[planned.length - 1].id : null

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
    >
      {/* Said before it happens, not discovered after. Since nothing past is drawn
          here, a date moved behind today makes this card leave the list — and a
          card that vanishes on Gem, with no explanation, reads as data lost. The
          meeting is not lost: it is a held meeting now, and held meetings are
          recorded in the history below with who came and what it cost. */}
      {editor.draft.date && editor.draft.date < todayISO() ? (
        <p className="mt-1 rounded-lg border border-accent-d bg-surface p-3 text-xs leading-relaxed text-muted">
          Datoen er bagud, så mødet forsvinder fra listen over planlagte møder.
          Afholdte møder registreres i historikken nedenfor — med deltagelse og bøder.
        </p>
      ) : null}
    </EditForm>
  )

  const card = (e: EventItem, next: boolean) => {
    const { figure, heading } = calendarHead(e)
    // The venue is the heading in the ordinary case, so printing it again below
    // would be the same fact twice on a card four lines tall.
    const place = e.location && e.location !== heading ? e.location : null
    return (
      <article
        key={e.id}
        data-reveal
        /* 1.5px blue on the next one — the design system marks the live row by
           border weight, never by fill. */
        className={`rounded-2xl border bg-surface p-4 ${next ? 'border-[1.5px] border-accent' : 'border-line'}`}
      >
        {/* The same head as a held meeting, from the same component. Lukas,
            2026-07-30: "Synes bare at planlagte møder skal fremgå som de
            tidligere. Blot uden anciennitet." These cards arrived from /moeder
            with a 26 px date rail down the left, and sitting above the history on
            one page that read as two different products. What a planned meeting
            has that a held one has not is the *time*, so that is what rides
            beside the date. */}
        <MeetingHead
          figure={figure}
          heading={heading}
          aside={`${daDate(e.date, SHORT)}${e.time ? ` · ${e.time}` : ''}`}
        />

        {/* Where the held card puts its route. The pin is blue because §04 draws
            `place` in #2563EB by name — an icon is a mark, not an emphasis (T072).

            **This row is where the map will live.** Lukas, 2026-07-29: "vi skal
            have et kort, som viser alle steder vi har været implementeret på
            længere sigt." Given its own row and the full width of the card, it can
            become a link or a chip without the card being rebuilt around it.
            Nothing here reaches for a map today and no dependency was added. */}
        {place && (
          <p className="mt-2.5 flex items-baseline gap-1.5 text-xs">
            <Icon name="place" className="shrink-0 text-sm text-accent" />
            <span className="font-medium text-ink">{place}</span>
          </p>
        )}
        {e.description && (
          <p className="mt-2 text-[0.8rem] leading-relaxed text-muted">{e.description}</p>
        )}

        {mayEdit && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {/* **The way a plan becomes a meeting.** Lukas, 2026-08-08, on the day
                of one: "Jeg kan i øvrigt ikke rette deltagere til dagens møde."
                He could — "Nyt møde" with today's date does it — but nothing on the
                evening's own card said so, which is the same as not being able to.
                Only from today onward: an evening still weeks away has nobody to
                tick off. */}
            {onRecord && e.date <= today && (
              <button
                type="button"
                onClick={() => onRecord(e)}
                className="inline-flex min-h-12 items-center justify-center rounded-btn bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hi"
              >
                Registrér deltagelse
              </button>
            )}
            <EditButton onClick={() => editor.edit(e.id, draftOf(e))} />
            <DeleteConfirm
              // The title, not the derived heading: this asks about a row, and the
              // row is what the club typed.
              what={`${e.title} · ${daDate(e.date)}`}
              onDelete={() => editor.remove(e.id)}
              pending={editor.removing(e.id)}
              failed={editor.removeFailed(e.id)}
            />
          </div>
        )}
      </article>
    )
  }

  // Nothing at all rather than "ingen møder planlagt". §9 promises two meetings
  // ahead and a bare heading over an empty space would announce that the promise is
  // broken — but this is not the club's compliance report, and /hjem already leads
  // with the next meeting or the lack of one.
  if (planned.length === 0) return null

  return (
    <>
      {/* The one piece of furniture here: no section wrapper and no create button,
          so these fall into the single stream of meetings on /anciennitet rather
          than sitting in a box above it. */}
      <SectionTitle>Planlagte møder</SectionTitle>
      {planned.map((e) => (mayEdit && editor.editing(e.id) ? form(e.id) : card(e, e.id === nextId)))}
    </>
  )
}
