import type { CSSProperties, ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LogoMark } from '../components/LogoMark'
import { statute, stk } from '../data/vedtaegter'
import { useNews, useUpcoming } from '../data/useClubData'

/**
 * The club's public face — everything a stranger may see, and nothing else.
 *
 * Until now `/` was the members' front page and a visitor following a link to
 * Erhvervsklubben met a password box. That is the wrong first impression for
 * an association whose own §4 requires a prospective member to attend as a
 * guest before anyone may even vote on them: people arrive here *before* they
 * have a login, by design, and a login form tells them nothing.
 *
 * What it may show, and why that list is short. News and events are
 * anon-readable in the database (Lukas, 2026-07-23), so they are shown. Member
 * names, the attendance matrix and every figure about the club's money are not
 * — and this page does not merely omit them, it never asks: the only two
 * queries it runs are the two public tables. RLS would refuse the rest anyway,
 * but a page that tries and fails is a page one policy change away from
 * leaking.
 *
 * Every claim about the club is quoted from the statutes rather than written
 * fresh. A landing page is where marketing copy usually appears, and copy
 * nobody voted on is exactly what drifts away from what the club actually is.
 */
export default function Landing() {
  const { userId, loading } = useAuth()
  const upcoming = useUpcoming()
  const news = useNews()

  // A signed-in member gets /hjem, not this. Both audiences reach the club at
  // the same URL — the one people type, bookmark and share — and neither has
  // to know which page is theirs. Deciding it here rather than at the route
  // table keeps `/` genuinely public: the guard is a redirect for people who
  // have somewhere better to be, not a gate.
  //
  // Nothing renders until the session is known, which is the opposite of what
  // a public page usually wants. It is cheap here and it buys a lot: reading
  // the session is a local-storage lookup, so a visitor with no token — every
  // stranger, which is who this page is for — waits a microtask. A *member*
  // waits for the profiles round-trip, and rendering optimistically would
  // start the four-second intro under them every single time they open the
  // app, only to swap it for /hjem.
  if (loading) return <div aria-busy="true" aria-label="Indlæser" />
  if (userId) return <Navigate to="/hjem" replace />

  // Two, because §9 Stk. 3 says two are always in the calendar.
  const events = upcoming.data ?? []
  // Errors are swallowed on purpose. A member seeing "kunne ikke hente data"
  // knows to reload; a stranger reads it as a broken club. The sections below
  // are written so that no data and failed data look identical — and what they
  // fall back to is the club's own cadence, which is true either way.
  const stories = news.data?.slice(0, 3) ?? []

  return (
    <div className="ek-texture min-h-dvh">
      {/* The bar shares the hero's glow rather than sitting on the page ground:
          two backgrounds meeting at the top of the screen draws a seam right
          where the eye lands first. */}
      <div className="ek-hero-glow">
        {/* A plain bar rather than the members' Shell, and deliberately not
            animated: the intro below takes three seconds to finish, and a
            returning member should not have to wait it out to find the door. */}
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <span className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">
              Erhvervsklubben
            </span>
          </span>
          <Link
            to="/login"
            className="inline-flex min-h-12 items-center rounded-[9px] bg-brand px-[18px] text-[13px] font-semibold text-white hover:bg-brand-hi"
          >
            Log ind
          </Link>
        </header>

        <Hero />
      </div>

      <div className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
        <Kernefakta />
        <Moedekalender events={events} />
        <Nyt stories={stories} />
        <Medlemskab />
      </div>

      <footer className="flex flex-col items-center gap-3 border-t border-line px-5 py-10 sm:px-8">
        <LogoMark size={32} />
        <p className="text-[11px] font-semibold tracking-[0.18em] text-faint uppercase">
          Erhvervsklubben · København
        </p>
      </footer>
    </div>
  )
}

/**
 * The lockup and the promise, in that order.
 *
 * The design system times this: the mark fades up, the E and K arrive from
 * opposite sides, the wordmark tightens, the rule draws from the centre, the
 * words rise 22 px at 60 ms intervals, and a blue line walks the four edges of
 * the mark, finishing last. "Bevidst langsom — den skal give indtryk, ikke
 * skynde på" — but readable at two and a half seconds rather than four; the
 * departure and the reason are set out over the keyframes in index.css.
 *
 * Nothing here blocks. The text is in the document from the first frame, the
 * login button in the header never animates, and anyone who has asked for less
 * motion gets the finished lockup immediately.
 */
function Hero() {
  return (
    <section className="px-5 pt-10 pb-16 text-center sm:px-8 sm:pt-16 sm:pb-24">
      <div className="mx-auto flex max-w-[820px] flex-col items-center">
        <LogoMark size={104} animated />

        <p className="ek-word mt-8 text-[15px] font-semibold tracking-[0.26em] uppercase sm:text-[19px]">
          Erhvervsklubben
        </p>

        {/* "Én blå streg som signatur." */}
        <span
          aria-hidden="true"
          className="ek-rule mt-6 h-[1.5px] w-[280px] max-w-full bg-accent"
        />

        <p
          className="ek-rise mt-8 text-[11px] tracking-[0.2em] text-accent uppercase"
          style={rise(1900)}
        >
          København · Netværk
        </p>

        {/* The break is designed, not reflowed — two short declarative
            sentences, both of them things the statutes say: §1 places the club
            in Copenhagen, §9 Stk. 1 sets the cadence. */}
        <h1
          className="ek-rise mt-4 font-serif text-[2.35rem] leading-[1.03] tracking-[-0.02em] sm:text-[3.25rem]"
          style={rise(1960)}
        >
          Et netværk i København.
          <br />
          Møde hver anden måned.
        </h1>

        <p
          className="ek-rise mt-4 max-w-[420px] text-[16px] leading-[1.7] text-muted"
          style={rise(2020)}
        >
          {statute(2).items[1]}
        </p>

        <div
          className="ek-rise mt-7 flex flex-wrap justify-center gap-3"
          style={rise(2080)}
        >
          <Link
            to="/login"
            className="inline-flex min-h-12 items-center rounded-[10px] bg-brand px-[22px] text-sm font-semibold text-white hover:bg-brand-hi"
          >
            Log ind som medlem
          </Link>
          <a
            href="#klubben"
            className="inline-flex min-h-12 items-center rounded-[10px] border border-line-hi px-[22px] text-sm font-semibold text-ink hover:border-accent"
          >
            Om klubben
          </a>
        </div>
      </div>
    </section>
  )
}

/**
 * What the club is, in four facts.
 *
 * The design system's landing puts a row of figures here — meetings held,
 * attendance rate, the fine box. Not one of those may be public, and a stat row
 * of things a visitor cannot be told would be worse than none. So the same
 * anatomy carries statements instead of counts: the shape the system asks for,
 * filled with what this club can actually say out loud.
 */
function Kernefakta() {
  // Each caption quotes a different stykke. Repeating one sentence in two
  // cards would read as padding, and padding is how a page of facts turns
  // back into a brochure.
  const facts: { label: string; value: string; cite: number; caption: string }[] = [
    { label: 'Hjemsted', value: 'København', cite: 1, caption: statute(1).items[1] },
    {
      label: 'Mødekadence',
      value: 'Hver anden måned',
      cite: 9,
      caption: stk(statute(9).items[1]),
    },
    {
      label: 'Anciennitet',
      value: 'Ved fremmøde',
      cite: 11,
      caption: stk(statute(11).items[0]),
    },
    {
      label: 'Generalforsamling',
      value: 'Hvert forår',
      cite: 5,
      caption: stk(statute(5).items[0]),
    },
  ]

  return (
    <section id="klubben" className="scroll-mt-6 pt-14 sm:pt-24">
      <SectionHead n="01" title="Om klubben" lede={statute(2).items[0]} />
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => (
          <Card key={f.label} className="p-5">
            <Label>{f.label}</Label>
            <p className="mt-2 font-serif text-[1.625rem] leading-tight">{f.value}</p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
              {f.caption} <span className="tabular text-faint">§{f.cite}</span>
            </p>
          </Card>
        ))}
      </div>
    </section>
  )
}

/**
 * The calendar, which is currently empty and must not look broken.
 *
 * The card is about the club's *rhythm*, not about a specific date — so when
 * there is nothing scheduled it is still answering its own question, and the
 * missing date is a chip inside a complete card rather than a hole where a
 * card should be. That is the design system's own convention for an unset
 * value: plain Danish sentence case, muted text, hairline pill, and the icon
 * left fully blue.
 *
 * There genuinely are no future-dated events today (2026-07-27), so this is
 * the state the page ships in, not a fallback nobody will see.
 */
function Moedekalender({ events }: { events: { id: string; title: string; date: string; time: string; location: string }[] }) {
  return (
    <section className="pt-14 sm:pt-24">
      <SectionHead
        n="02"
        title="Mødekalender"
        lede={stk(statute(9).items[0])}
      />

      {/* min-height, so the card does not jump a line taller when the query
          answers. "Ingen loading-hop." */}
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        {events.length === 0 ? (
          <Card className="min-h-[172px] border-accent/40 p-6 sm:col-span-2">
            <Label>Næste møde</Label>
            <p className="mt-2 font-serif text-[1.625rem] leading-tight">
              Datoen er ikke offentliggjort
            </p>
            <p className="mt-1.5 max-w-[520px] text-[13px] leading-[1.6] text-muted">
              {stk(statute(9).items[2])}
            </p>
            <Chip>Indkaldes af mødets lead, senest 2 uger før · §9</Chip>
          </Card>
        ) : (
          events.map((e, i) => (
            <Card
              key={e.id}
              /* 1.5px blue, the system's way of marking the live one —
                 emphasis by border weight, never by fill or shadow. */
              className={`min-h-[172px] p-6 ${i === 0 ? 'border-[1.5px] border-accent' : ''}`}
            >
              <Label>{i === 0 ? 'Næste møde' : 'Derefter'}</Label>
              <p className="mt-2 font-serif text-[1.625rem] leading-tight">{e.title}</p>
              <p className="tabular mt-1.5 text-[13px] text-muted">{daDate(e.date)}{e.time ? ` · ${e.time}` : ''}</p>
              {/* The venue is often decided later than the date, so its absence
                  is stated rather than left blank — the design system's own
                  wording for an unset field, and it keeps the two cards the
                  same height. */}
              <Chip>{e.location || 'Sted endnu ikke sat'}</Chip>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}

/**
 * Recent news. Rows inside one card, not a card each — the system's list
 * idiom, separated by the lighter hairline.
 */
function Nyt({ stories }: { stories: { id: string; title: string; excerpt: string; date: string }[] }) {
  return (
    <section className="pt-14 sm:pt-24">
      <SectionHead
        n="03"
        title="Nyt fra klubben"
        lede="Referater og beskeder, som klubben lægger offentligt frem."
      />
      {/* Height reserved so the card does not grow under the reader when the
          query answers — "ingen loading-hop" — and the empty line centred in
          it, so the reserved space reads as a card rather than as a gap. */}
      <Card className="mt-9 flex min-h-[132px] flex-col justify-center p-6">
        {stories.length === 0 ? (
          <p className="text-[15px] leading-[1.7] text-muted">
            Der er ikke lagt nyheder frem endnu.
          </p>
        ) : (
          stories.map((s) => (
            <article
              key={s.id}
              className="border-b border-line py-4 first:pt-0 last:border-0 last:pb-0"
            >
              <p className="tabular text-[10px] tracking-[0.18em] text-accent uppercase">
                {daDate(s.date)}
              </p>
              <h3 className="mt-1.5 text-[16px] leading-snug font-semibold">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-[1.6] text-muted">{s.excerpt}</p>
            </article>
          ))
        )}
      </Card>
    </section>
  )
}

/**
 * The way in, and the way in is a person — not a signup form.
 *
 * §4 Stk. 2 A. makes that literal: you attend once as a guest before anyone
 * may vote. So there is no "become a member" button here, because there is no
 * such button in the club's rules. The only action is the members' login.
 */
function Medlemskab() {
  const s4 = statute(4)

  return (
    <section className="pt-14 sm:pt-24">
      <SectionHead n="04" title="Medlemskab" lede={stk(s4.items[0])} />

      <Card className="mt-9 border-t-[3px] border-t-accent p-6 sm:p-8">
        <ol className="flex flex-col gap-4">
          {[s4.items[2], s4.items[1]].map((item, i) => (
            <li key={i} className="flex gap-4">
              <span className="tabular shrink-0 text-[13px] font-bold text-accent">
                {i + 1}
              </span>
              <p className="text-[15px] leading-[1.7] text-muted">{stk(item)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 border-t border-line pt-6">
          <p className="text-[15px] leading-[1.7] text-muted">
            Er du allerede medlem? Anciennitet, referater, regler og regnskab ligger bag
            login.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-flex min-h-12 items-center rounded-[10px] bg-brand px-[22px] text-sm font-semibold text-white hover:bg-brand-hi"
          >
            Log ind
          </Link>
        </div>
      </Card>
    </section>
  )
}

// ------------------------------------------------------------------ pieces

/** Baseline-aligned section number and serif title — the system's header. */
function SectionHead({ n, title, lede }: { n: string; title: string; lede: string }) {
  return (
    <>
      <div className="flex items-baseline gap-4">
        <span className="tabular text-xs tracking-[0.24em] text-faint">{n}</span>
        <h2 className="font-serif text-[1.75rem] tracking-[-0.01em] sm:text-[2.75rem]">
          {title}
        </h2>
      </div>
      <p className="mt-3.5 max-w-[620px] text-[16px] leading-[1.7] text-muted sm:text-[17px]">
        {lede}
      </p>
    </>
  )
}

/** Hairline and flat. The system puts shadows on the logo and nothing else. */
function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.16em] text-faint uppercase">{children}</p>
  )
}

/** An unset or pending value, stated rather than hidden. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-xs text-muted">
      {/* Left fully saturated while the text stays muted — the system's way of
          keeping an empty state alive rather than greying it out. */}
      <span aria-hidden="true" className="text-accent">
        ◇
      </span>
      {children}
    </span>
  )
}

/**
 * Where an element falls in the intro's closing stagger — 60 ms apart, per the
 * design system. A prop rather than nth-child selectors, so the order is
 * legible in the markup it orders.
 */
function rise(ms: number): CSSProperties {
  return { '--ek-rise-delay': `${ms}ms` } as CSSProperties
}

function daDate(iso: string): string {
  return new Date(iso).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
