import type { ReactNode } from 'react'
import type { Meeting, RosterEntry } from '../data/derive'
import { daDate } from '../lib/dates'
import { Icon } from './Icon'
import { Eyebrow } from './SectionTitle'

/** Short month, because 29 of these stack down a phone. The year stays. */
const SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

/**
 * How a pip says which state it is in, without asking anyone to see a colour.
 *
 * Filled with a solid edge, or hollow with a dashed one. Green and red were the
 * whole of it, and roughly one man in twelve cannot reliably separate those two
 * hues — in a club of ten that is not a hypothetical reader. Fill and border
 * style survive being seen in greyscale, in sunlight, and by that man, and they
 * cost no space at all: these are 24px squares, ten to a meeting, twenty-nine
 * meetings on the page. A word or an icon in each does not fit.
 */
const PIP = {
  present: 'border-solid border-present/40 bg-present/20 text-present',
  absent: 'border-dashed border-absent/50 text-absent',
} as const

/** The same two marks at legend size, so the key cannot drift from the strip. */
const SWATCH = {
  present: 'border-solid border-present/40 bg-present/20',
  absent: 'border-dashed border-absent/50',
} as const

/**
 * One meeting, as a card.
 *
 * The old site showed this as a fifteen-column table, which cannot work on a
 * phone — and the phone is where it gets used. Attendance becomes a strip of
 * initials with the reader's own ringed, so a whole meeting reads in one glance
 * and a season scrolls under a thumb.
 *
 * The key sits on every card rather than once at the top of the page, and earns
 * the line by carrying the counts: after the third card nobody is reading it as
 * a legend any more, they are reading how many turned up — which is the
 * question the strip is there to answer, now answerable without decoding it.
 */
export function MeetingCard({
  meeting,
  labels,
  me,
  actions,
}: {
  meeting: Meeting
  labels: Record<string, string>
  me?: string | null
  /** The admin's Rediger and Slet, below the strip. A member is passed none
      and the card is exactly what it was. */
  actions?: ReactNode
}) {
  const pip = (name: string, present: boolean) => (
    <span
      key={name}
      // The full name only. The state used to live in this tooltip too, which
      // is the same as not saying it: there is no hover on a phone, and the
      // phone is where this page is read.
      title={name}
      className={[
        'grid size-6 place-items-center rounded-[5px] border text-[0.55rem] font-semibold',
        present ? PIP.present : PIP.absent,
        name === me ? 'outline-2 outline-offset-1 outline-accent' : '',
      ].join(' ')}
    >
      {labels[name] ?? name.slice(0, 2)}
      <span className="sr-only">{present ? ' til stede' : ' ikke til stede'}</span>
    </span>
  )

  return (
    /* data-reveal on the card, not on its parts. 29 of these stack down the
       page and the system's reveal is per element ("60 ms forskudt pr.
       element") — but a card whose date arrives after its own heading reads as
       a page still loading, not as choreography. The stagger here is the
       scroll itself: the cards enter one after another because they are
       stacked, so the thumb supplies the offset. */
    <article data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <div className="relative flex items-baseline gap-2.5">
        {/* The meeting's number, and the page's face.
            /anciennitet is the club's rhythm — twenty-nine evenings, one after
            another, and the number is the only thing that changes at the same
            place on every card. It was 15 px of the same blue as the section
            labels and the links, so it read as one more emphasis rather than as
            the count it is. Serif at 20 px, in ink: the beat is now legible
            from a thumb-scroll, and the blue it gives up is on the streg under
            the lead's name, where §01 puts the club's signature. */}
        <span className="ek-figure text-[1.25rem] leading-none">{meeting.number}</span>
        <h3 className="text-[0.92rem] font-semibold">{meeting.lead || 'Ukendt lead'}</h3>
        <span className="tabular ml-auto text-[0.65rem] text-faint">
          {meeting.date ? daDate(meeting.date, SHORT) : 'uden dato'}
        </span>
        {/* The club's signature blue streg — "én blå streg som signatur" (§01)
            — under the meeting's name, giving each of the twenty-nine cards a
            masthead. Absolute, so it costs no height on the longest page in the
            app: it lands in the gap the route line already leaves.

            Not drawn, though the drawing was built and measured. Animating this
            one extra element per card cost Anciennitet 7 fps at a 6× CPU
            throttle, and almost all of what the rule gives the card it gives by
            being there. */}
        <span aria-hidden="true" className="absolute -bottom-1 inset-x-0 h-px bg-accent/30" />
      </div>

      {/* The step between venues was a literal → — which is how §04's own
          Anciennitet mock writes it, and which neither Instrument subset
          contains, so it fell back per glyph and the club's evening was drawn
          by whichever font the phone reached for. `arrow_right_alt` is the
          set's long arrow: the same mark, from the shipped file. */}
      {meeting.route.length > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          {meeting.route.map((stop, i) => (
            <span key={stop + i}>
              {i > 0 && (
                <Icon name="arrow_right_alt" className="mx-1 align-[-0.15em] text-sm text-faint" />
              )}
              <span className={i === meeting.route.length - 1 ? 'font-semibold text-ink' : ''}>
                {stop}
              </span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-faint">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[3px] border ${SWATCH.present}`} />
          <span className="tabular">{meeting.present.length}</span> til stede
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[3px] border ${SWATCH.absent}`} />
          <span className="tabular">{meeting.absent.length}</span> ikke til stede
        </span>
      </p>

      {/* The strip settles a beat after the meeting's name — one element, not
          ten. The ten pips arriving in sequence was the nicer gesture and it
          was measured off the page: ten extra animating elements on each of 29
          cards took Anciennitet from 60 fps to 34 at a 4× CPU throttle, on the
          one screen §04 asks to stay cheap. The whole strip as one thing costs
          nothing and still says "who was there" arrives after "whose evening it
          was". See .ek-strip in index.css. */}
      <div className="ek-strip mt-2 flex flex-wrap gap-1">
        {meeting.present.map((n) => pip(n, true))}
        {meeting.absent.map((n) => pip(n, false))}
      </div>

      {actions && <div className="mt-3 flex flex-wrap items-start gap-2">{actions}</div>}
    </article>
  )
}

/**
 * Anciennitet at a glance — §11 defines it as the count of attendances.
 *
 * The count is printed, not just drawn. It used to live only in a `title`
 * tooltip, which does not exist on a touchscreen: the club's most-used page
 * showed ten unlabelled bars and withheld the single number it is about.
 *
 * Every member on the top score is highlighted, not just the first. Five of
 * them are usually tied, and colouring one of a tie crowns a leader the data
 * does not have.
 */
export function AttendanceSummary({ roster }: { roster: RosterEntry[] }) {
  const top = roster[0]?.attended ?? 0
  const total = roster[0]?.total ?? 0
  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <Eyebrow>Anciennitet · antal deltagelser{total ? ` af ${total}` : ''}</Eyebrow>
      <ul className="mt-3 flex items-end gap-1">
        {roster.map((r) => (
          <li
            key={r.name}
            aria-label={`${r.name}: ${r.attended} af ${r.total}`}
            title={`${r.name}: ${r.attended} af ${r.total}`}
            className="flex flex-1 flex-col items-center gap-0.5"
          >
            {/* No count-up on these ten, and §04's own Anciennitet mock agrees:
                it marks the bars as growing and leaves the figures above them
                as plain text, where its Hjem mock counts all three of its stats.
                Measured, that is the right way round — ten figures rewriting
                their text for 900 ms sit at the top of the club's longest page,
                so the cost lands on exactly the scroll that has to stay cheap
                (60 → 41 fps at a 4× CPU throttle). The bar growing under the
                number is the gesture here; the number arriving as well says the
                same thing twice and charges the page for it. */}
            <span className="tabular text-[0.6rem] leading-none font-semibold text-ink">
              {r.attended}
            </span>
            <span aria-hidden="true" className="flex h-14 w-full items-end">
              {/* "Søjler vokser ved scroll" (§04), from the baseline (§01). The
                  height stays an inline style and the growth is a scaleY on top
                  of it, so the bar's real height is still the number it
                  represents — animating the height itself would be the one
                  thing the system forbids, and it would relayout the row ten
                  times a frame. */}
              <span
                data-bar
                className={`w-full rounded-t-[3px] ${
                  r.attended === top ? 'bg-accent' : 'bg-accent-d'
                }`}
                style={{ height: `${top ? Math.max(4, (r.attended / top) * 100) : 4}%` }}
              />
            </span>
            <span className="tabular text-[0.55rem] leading-none text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
