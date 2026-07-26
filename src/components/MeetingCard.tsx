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
        <h3 className="text-[0.92rem] font-semibold">{meeting.lead}</h3>
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

/** Anciennitet at a glance — §11 defines it as the count of attendances. */
export function AttendanceSummary({ roster }: { roster: RosterEntry[] }) {
  const top = roster[0]?.attended ?? 0
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">
        Anciennitet · antal deltagelser
      </p>
      <ul className="mt-2 flex h-16 items-end gap-1">
        {roster.map((r) => (
          <li
            key={r.name}
            title={`${r.name}: ${r.attended} af ${r.total}`}
            className={`flex-1 rounded-t-[3px] ${r === roster[0] ? 'bg-accent' : 'bg-accent-d'}`}
            style={{ height: `${top ? Math.max(4, (r.attended / top) * 100) : 4}%` }}
          />
        ))}
      </ul>
      <ul className="mt-1 flex gap-1">
        {roster.map((r) => (
          <li key={r.name} className="tabular flex-1 text-center text-[0.5rem] text-faint">
            {r.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
