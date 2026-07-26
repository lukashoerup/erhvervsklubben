import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAttendance, useMyMemberName, useNews, useUpcoming } from '../data/useClubData'

/**
 * The front page, rebuilt around what members actually open the app for.
 *
 * The old one was a recruitment brochure — a hero pitch, three generic cards
 * about networking, and a "become a member" button — aimed at strangers, for a
 * club that is not recruiting. It answered nobody's question.
 *
 * This answers the three that get asked: when is the next one, where do I
 * stand, and what did I miss.
 *
 * Note what is deliberately absent: the club's balance. That is the treasurer's
 * (Lukas, 2026-07-26), reached through the link below rather than sitting on
 * everyone's front page.
 */
export default function Home() {
  const { userId, role } = useAuth()
  const upcoming = useUpcoming()
  const attendance = useAttendance()
  const { data: me } = useMyMemberName(userId)
  const news = useNews()

  const next = upcoming.data?.[0]
  const mine = attendance.data?.roster.find((r) => r.name === me)
  const meetings = attendance.data?.meetings.length ?? 0
  const latest = news.data?.[0]

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-accent-d bg-surface p-4">
        <p className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">Næste møde</p>
        {next ? (
          <>
            <h2 className="mt-1 text-xl leading-tight font-semibold">{next.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {new Date(next.date).toLocaleDateString('da-DK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {next.time ? ` · ${next.time}` : ''}
            </p>
            {next.location && (
              <p className="mt-2 inline-block rounded border border-line bg-raised px-2 py-1 text-xs text-muted">
                {next.location}
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-1 text-lg font-semibold">Ikke planlagt endnu</h2>
            {/* Not a neutral empty state: the statutes require two meetings to
                be in the calendar at all times, so nothing scheduled is a fact
                worth surfacing rather than hiding behind a blank card. */}
            <p className="mt-1 text-sm text-muted">
              Vedtægterne §9: der planlægges altid to møder forud.
            </p>
          </>
        )}
      </section>

      {mine && (
        <section className="grid grid-cols-3 gap-2">
          <Stat n={mine.attended} label="Fremmøde" />
          <Stat
            n={meetings ? `${Math.round((mine.attended / meetings) * 100)}%` : '—'}
            label={`Af ${meetings}`}
          />
          <Stat n={mine.total - mine.attended} label="Misset" />
        </section>
      )}

      {latest && (
        <Link to="/nyheder" className="rounded-xl border border-line bg-surface p-3">
          <p className="tabular text-[0.6rem] tracking-[0.1em] text-accent uppercase">
            {new Date(latest.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
          </p>
          <h3 className="mt-1 text-[0.95rem] leading-snug font-semibold">{latest.title}</h3>
          <p className="mt-1 text-xs text-muted">{latest.excerpt}</p>
        </Link>
      )}

      {role === 'admin' && (
        <Link
          to="/oekonomi"
          className="rounded-xl border border-line bg-surface p-3 text-sm text-muted"
        >
          <span className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">Kasserer</span>
          <span className="mt-1 block text-ink">Klubkassen →</span>
        </Link>
      )}
    </div>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-2 py-2.5 text-center">
      <div className="tabular text-xl font-semibold">{n}</div>
      <div className="mt-0.5 text-[0.55rem] tracking-wider text-faint uppercase">{label}</div>
    </div>
  )
}
