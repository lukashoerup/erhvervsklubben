import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { daDate } from '../lib/dates'
import { useAttendance, useMyMemberName, useNews, useUpcoming } from '../data/useClubData'
import { Eyebrow } from '../components/SectionTitle'

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
      {/* The display line the design system's mobile Hjem opens with: "NÆSTE
          MØDE / Møde #29 / torsdag 13. august". The card keeps its blue rule —
          §04 marks the live row by border weight, and this is the only card in
          the app that is one. */}
      <section data-reveal className="rounded-2xl border border-accent-d bg-surface p-4">
        <Eyebrow>Næste møde</Eyebrow>
        {next ? (
          <>
            <h2 className="mt-2 font-serif text-[1.75rem] leading-[1.1]">{next.title}</h2>
            <p className="mt-1.5 text-sm text-muted">
              {daDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })}
              {next.time ? ` · ${next.time}` : ''}
            </p>
            {/* The pin is the system's, not decoration: §03 names `place` as
                "Sted", and §04's mobile Hjem draws this exact chip with it —
                blue mark, muted text, hairline pill. */}
            {next.location && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-xs text-muted">
                <Icon name="place" className="text-base text-accent" />
                {next.location}
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-2 font-serif text-[1.5rem] leading-[1.15]">Ikke planlagt endnu</h2>
            {/* Not a neutral empty state: the statutes require two meetings to
                be in the calendar at all times, so nothing scheduled is a fact
                worth surfacing rather than hiding behind a blank card. */}
            <p className="mt-1.5 text-sm text-muted">
              Vedtægterne §9: der planlægges altid to møder forud.
            </p>
          </>
        )}
      </section>

      {mine && (
        <section data-reveal className="grid grid-cols-3 gap-2">
          <Stat n={mine.attended} label="Fremmøde" />
          <Stat
            n={meetings ? Math.round((mine.attended / meetings) * 100) : null}
            suffix="%"
            label={`Af ${meetings}`}
          />
          <Stat n={mine.total - mine.attended} label="Misset" />
        </section>
      )}

      {latest && (
        <Link to="/nyheder" data-reveal className="rounded-2xl border border-line bg-surface p-4">
          {/* Muted, where this was blue. A date is not something you can tap;
              the whole card is, and it says so by being a link. */}
          <p className="tabular text-[0.6rem] tracking-[0.1em] text-muted uppercase">
            {daDate(latest.date, { day: 'numeric', month: 'long' })}
          </p>
          <h3 className="mt-1.5 text-[0.95rem] leading-snug font-semibold">{latest.title}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">{latest.excerpt}</p>
        </Link>
      )}

      {role === 'admin' && (
        <Link
          to="/oekonomi"
          data-reveal
          className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted"
        >
          <Eyebrow>Kasserer</Eyebrow>
          {/* §03 lists `north_east` as "Link" and this is the only one on the
              screen. It was a → that Instrument does not draw. Blue, and one of
              the few things left that is: this line goes somewhere. */}
          <span className="mt-1.5 flex items-center gap-1.5 text-accent">
            Klubkassen
            <Icon name="north_east" className="text-sm" />
          </span>
        </Link>
      )}
    </div>
  )
}

/* The three counts, as the system's mobile Hjem lays them out — its own mock
   sets exactly these three, "19 / 68% / 9", and captions the screen "tal tæller
   op ved indlæsning". The row reveals as one block rather than three, because
   three cards arriving 60 ms apart across 380 px reads as a stutter rather than
   a stagger.

   **This is the page's face.** Of the six members' screens, Hjem is the one
   whose whole content is figures — where you stand, out of how many, how many
   you missed — and it read as three more cards in the same stack as everything
   else. They are display type now: Instrument Serif at 26 px, which is what the
   landing page has set the club's facts in since T060 and what §04's own
   scroll-scene sets its lead figure in. `.ek-figure` in index.css carries why
   this idiom and §03's Sans-700 tile are both the system's, and where the line
   between them falls.

   Serif 400 puts less ink on the page than the Sans 700 it replaces, so the
   size goes up rather than the weight — 22 px to 26 px. That is a step
   *towards* §04's phone mocks, which run one notch above this app at every
   level (design/README.md), never away from them.

   `data-count` is what makes them count up (§01: 900 ms, easeOutExpo); see
   lib/reveal.ts. Only when there is a number to count to — a dash is the
   honest answer for a member the club has recorded no meetings against, and
   there is nothing to animate about it. */
function Stat({ n, suffix = '', label }: { n: number | null; suffix?: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-2 py-4 text-center">
      <div data-count={n ?? undefined} className="ek-figure text-[1.625rem] leading-none">
        {n === null ? '—' : `${n.toLocaleString('da-DK')}${suffix}`}
      </div>
      <div className="mt-2 text-[0.55rem] tracking-wider text-faint uppercase">{label}</div>
    </div>
  )
}
