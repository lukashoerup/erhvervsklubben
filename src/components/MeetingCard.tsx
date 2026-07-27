import type { Meeting, RosterEntry } from '../data/derive'

/**
 * One meeting, as a card.
 *
 * The old site showed this as a fifteen-column table, which cannot work on a
 * phone — and the phone is where it gets used. Attendance becomes a strip of
 * initials, colour-coded, with the reader's own ringed, so a whole meeting
 * reads in one glance and a season scrolls under a thumb.
 */
export function MeetingCard({
  meeting,
  labels,
  me,
}: {
  meeting: Meeting
  labels: Record<string, string>
  me?: string | null
}) {
  const pip = (name: string, present: boolean) => (
    <span
      key={name}
      title={`${name} — ${present ? 'til stede' : 'ikke til stede'}`}
      className={[
        'grid size-6 place-items-center rounded-[5px] border text-[0.55rem] font-semibold',
        present
          ? 'border-present/40 bg-present/20 text-present'
          : 'border-absent/30 bg-absent/15 text-absent',
        name === me ? 'outline-2 outline-offset-1 outline-accent' : '',
      ].join(' ')}
    >
      {labels[name] ?? name.slice(0, 2)}
    </span>
  )

  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-baseline gap-2">
        <span className="tabular text-[0.95rem] font-semibold text-accent">{meeting.number}</span>
        <h3 className="text-[0.92rem] font-semibold">{meeting.lead || 'Ukendt lead'}</h3>
        <span className="tabular ml-auto text-[0.65rem] text-faint">
          {meeting.date
            ? new Date(meeting.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
            : 'uden dato'}
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

      <div className="mt-2 flex flex-wrap gap-1">
        {meeting.present.map((n) => pip(n, true))}
        {meeting.absent.map((n) => pip(n, false))}
      </div>
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
    <section className="rounded-xl border border-line bg-surface p-3">
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
              <span
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
