import type { ReactNode } from 'react'
import type { Meeting, RosterEntry } from '../data/derive'
import { daDate } from '../lib/dates'

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
    <article data-reveal className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-baseline gap-2">
        <span className="tabular text-[0.95rem] font-semibold text-accent">{meeting.number}</span>
        <h3 className="text-[0.92rem] font-semibold">{meeting.lead || 'Ukendt lead'}</h3>
        <span className="tabular ml-auto text-[0.65rem] text-faint">
          {meeting.date ? daDate(meeting.date, SHORT) : 'uden dato'}
        </span>
      </div>

      {meeting.route.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          {meeting.route.map((stop, i) => (
            <span key={stop + i}>
              {i > 0 && ' → '}
              <span className={i === meeting.route.length - 1 ? 'font-semibold text-ink' : ''}>
                {stop}
              </span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-faint">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[3px] border ${SWATCH.present}`} />
          <span className="tabular">{meeting.present.length}</span> til stede
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[3px] border ${SWATCH.absent}`} />
          <span className="tabular">{meeting.absent.length}</span> ikke til stede
        </span>
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1">
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
    <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">
        Anciennitet · antal deltagelser{total ? ` af ${total}` : ''}
      </p>
      <ul className="mt-2 flex items-end gap-1">
        {roster.map((r) => (
          <li
            key={r.name}
            aria-label={`${r.name}: ${r.attended} af ${r.total}`}
            title={`${r.name}: ${r.attended} af ${r.total}`}
            className="flex flex-1 flex-col items-center gap-0.5"
          >
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
