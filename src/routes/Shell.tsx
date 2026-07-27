import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/LogoMark'
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
  const { signOut } = useAuth()
  const navigate = useNavigate()

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
      {/* dvh, not vh: on a phone `100vh` is the viewport measured with the
          address bar hidden, so the tab bar sits below the fold until you
          scroll. The --demo-bar variable is set only by the demo build, which
          puts a banner above this; everywhere else it falls back to 0px. */}
      <div className="mx-auto flex min-h-[calc(100dvh-var(--demo-bar,0px))] max-w-lg flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="flex items-center gap-2.5">
            {/* The drawn mark, the same component the landing page uses, rather
                than the letters EK set in a navy box. Two renderings of one
                logo is part of how the app came to look like two products, and
                §02 is explicit that the vector is the mark — "skarp i alle
                størrelser". 26 px matches the landing header and clears the
                24 px floor. */}
            <LogoMark size={26} />
            <span className="text-xs font-bold tracking-[0.13em] uppercase">Erhvervsklubben</span>
          </span>
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
