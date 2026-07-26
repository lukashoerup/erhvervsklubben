import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NAV_ROUTES } from './routes'

/**
 * App bar, content, and a bottom tab bar.
 *
 * The tabs sit at the bottom because that is where a thumb reaches, and there
 * are four of them rather than a hamburger — with four destinations a menu
 * costs a tap and hides the one thing people open the app for.
 */
export function Shell() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function onSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-6 place-items-center bg-navy font-serif text-[0.7rem] text-white"
          >
            EK
          </span>
          <span className="text-xs font-bold tracking-[0.13em] uppercase">Erhvervsklubben</span>
        </span>
        <button onClick={onSignOut} className="text-xs text-faint hover:text-accent">
          Log ud
        </button>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <nav aria-label="Hovedmenu" className="grid grid-cols-4 border-t border-line bg-surface">
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
            <span aria-hidden="true" className="block text-base leading-tight">
              {r.nav!.icon}
            </span>
            {r.nav!.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
