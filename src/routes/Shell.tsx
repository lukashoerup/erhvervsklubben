import { useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyMemberName } from '../data/useClubData'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/LogoMark'
import { useScrollProgress } from '../lib/reveal'
import { NAV_ROUTES } from './routes'

/**
 * App bar, content, and a bottom tab bar.
 *
 * The tabs sit at the bottom because that is where a thumb reaches, and they
 * are all shown rather than folded into a hamburger — at this handful of
 * destinations a menu costs a tap and hides the one thing people open the app
 * for. The bar takes its columns from the route table, so it stays honest as
 * the count moves; six of them fit a 420 px phone, and a seventh would not.
 */
export function Shell() {
  const { signOut, userId } = useAuth()
  const { data: me } = useMyMemberName(userId)
  const navigate = useNavigate()
  // Only to re-key the mark below, so its walk replays on each arrival. Reading
  // the location here also means the Shell re-renders on navigation, which it
  // already did through the Outlet.
  const { pathname } = useLocation()
  const progress = useRef<HTMLDivElement>(null)
  useScrollProgress(progress)

  async function onSignOut() {
    await signOut()
    // To the landing page, not back to the login form. Since 2026-07-27 `/` is
    // the club's public face, so signing out now leaves you somewhere rather
    // than facing the box you just chose to step away from — and signing back
    // in is one tap from there.
    navigate('/', { replace: true })
  }

  return (
    /* The texture goes on a full-width wrapper rather than on the column.
       "Side · tekstur Alle sider" (§03 Fundament), and of everything in the
       design system it carries the most identity — which is why six screens
       without it read as a different product from the landing page. Painted on
       the max-w-lg column it would stop at 512 px and draw a seam down a
       desktop window; the landing page grounds itself the same way. */
    <div className="ek-texture min-h-[calc(100dvh-var(--demo-bar,0px))]">
      {/* How far through the page you are, as the export's own `#ek-progress`:
          a 2 px blue rule pinned to the top of the screen. Anciennitet is 29
          meetings over ~3400 px and nothing on it says whether the card under
          your thumb is a quarter of the club's history or nearly all of it.
          `--demo-bar` because the demo build puts a banner above everything;
          elsewhere it is 0. aria-hidden: it says nothing a scroll position does
          not already say to anyone not looking at the screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-[var(--demo-bar,0px)] z-50 h-[2px]"
      >
        <div ref={progress} className="ek-progress h-full bg-accent" />
      </div>

      {/* dvh, not vh: on a phone `100vh` is the viewport measured with the
          address bar hidden, so the tab bar sits below the fold until you
          scroll. The --demo-bar variable is set only by the demo build, which
          puts a banner above this; everywhere else it falls back to 0px. */}
      <div className="mx-auto flex min-h-[calc(100dvh-var(--demo-bar,0px))] max-w-lg flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          {/* The way back to the club's own front page, which until now did not
              exist: `/` forwards a signed-in member to /hjem (T060, and rightly
              — both audiences share the URL people type), so the landing page
              was live and unvisitable. Lukas, 2026-07-29: "Der er ingen måde at
              man kan navigere tilbage til animationsforsiden … evt. ved at
              klikke på logo oppe i venstre hjørne." His own suggestion, which
              is also the convention every site he uses follows, so the mark
              only has to behave the way he already expects it to.

              `state={{ forside: true }}` is what stops the forward eating the
              tap — see Landing.tsx, ASKED_FOR. The state rides the history
              entry rather than the URL, so nothing a member could copy out of
              the address bar carries it.

              aria-label rather than the lockup's own text: the accessible name
              of a link should say where it goes, and "Erhvervsklubben Lukas
              Hørup" says who we are. 44 px, bought with padding that the
              negative margins hand straight back, so the bar keeps the height
              it had — the same trick "Log ud" uses at the other end of it. */}
          <Link
            to="/"
            state={{ forside: true }}
            aria-label="Til forsiden"
            className="-my-3 -ml-1.5 inline-flex min-h-11 items-center gap-2.5 rounded-btn px-1.5 transition-opacity active:opacity-60"
          >
            {/* The drawn mark, the same component the landing page uses, rather
                than the letters EK set in a navy box. Two renderings of one
                logo is part of how the app came to look like two products, and
                §02 is explicit that the vector is the mark — "skarp i alle
                størrelser". 26 px matches the landing header and clears the
                24 px floor.

                **`key={pathname}`, and it is the whole mechanism.** Lukas asked
                for the landing intro's blue line to travel around this mark on
                the members' screens (2026-07-30). The Shell outlives every
                navigation, so the mark is never remounted and a CSS animation
                inside it would play once in the session and never again;
                re-keying it on the path makes React replace the element, which
                restarts the animation. No timer, no state, no effect — and
                tapping the tab you are already on changes nothing, which is
                right: nothing arrived.

                Once per arrival rather than on a loop, which is a deliberate
                departure from what he described — see `.ek-walk` in index.css
                for the argument. */}
            <LogoMark key={pathname} size={26} walk />
            <span className="flex flex-col leading-none">
              <span className="text-xs font-bold tracking-[0.13em] uppercase">Erhvervsklubben</span>
              {/* Who is signed in, on every page rather than only the front one.
                  Without it the app never says you are logged in at all, and a
                  page of the club's own attendance reads as somebody's data
                  rather than yours. Falls back to nothing — two of the ten
                  members have no row in user_member_mapping, and a blank line
                  is better than the word "medlem" pretending to be a name.

                  Inside the link, not beside it: it doubles the width of the
                  target, and the aria-label above means it costs the link's
                  name nothing. */}
              {me && (
                <span className="mt-0.5 text-[0.62rem] tracking-wide text-muted">{me}</span>
              )}
            </span>
          </Link>
          {/* The word is 37 × 16 px of ink and used to be 37 × 16 px of button,
              on every page in the app. The design system asks for 48 × 48; the
              padding that buys it is pulled straight back out with negative
              margins, so the target grows into the header's own padding and the
              bar keeps the height it had. Nothing sits beside it to mis-tap. */}
          <button
            onClick={onSignOut}
            className="-my-3 -mr-2 inline-flex min-h-12 items-center rounded-btn px-2 text-xs text-faint hover:text-accent"
          >
            Log ud
          </button>
        </header>

        {/* pb-8 rather than p-4 all round: the extra 16 px at the bottom is
            scroll room, not padding. A scroll-linked reveal only completes if
            the page can still scroll, so without a margin past the last card
            that card stops mid-reveal and stays there — see the range note in
            index.css. It also stops content butting against the tab bar. */}
        <main className="flex-1 p-4 pb-8">
          <Outlet />
        </main>

        {/* sticky, not static: Anciennitet runs to ~3400px, so a nav that
            scrolls away can only be reached by scrolling past all 29 meetings —
            which defeats the reason the tabs are at the bottom in the first
            place. */}
        <nav
          aria-label="Hovedmenu"
          /* Columns from the route table, not a fixed four: adding a tab should
             not silently wrap the bar onto a second row. */
          style={{ gridTemplateColumns: `repeat(${NAV_ROUTES.length}, minmax(0, 1fr))` }}
          className="sticky bottom-0 grid border-t border-line bg-surface"
        >
          {NAV_ROUTES.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              end={r.path === '/'}
              className={({ isActive }) =>
                `px-1 pt-2 pb-3 text-center text-[0.6rem] tracking-wide ${
                  isActive ? 'text-accent' : 'text-faint'
                }`
              }
            >
              {/* 22 px, which is the size §04's own mobile bottom bar sets its
                  icons at rather than §03's 24 px line — six columns on a
                  420 px phone, where the label under it has to stay readable
                  too. `block` so the label falls to its own line. */}
              <Icon name={r.nav!.icon} className="mb-0.5 block text-[22px]" />
              {r.nav!.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
