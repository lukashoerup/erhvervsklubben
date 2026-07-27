import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState, type Role } from './AuthContext'

/**
 * Auth for a build with no database behind it.
 *
 * Any password gets you in, and a switch in the corner flips between member and
 * treasurer so the access rules can actually be seen working rather than
 * described. This exists only in the VITE_DEMO build; the real provider is
 * untouched.
 *
 * The role is kept in sessionStorage so a reload does not throw you back to the
 * login screen — the same behaviour the real session has, and without it every
 * refresh loses your place. sessionStorage rather than localStorage: closing the
 * tab should end the demo.
 */
const KEY = 'ek-demo-role'

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(
    () => (sessionStorage.getItem(KEY) as Role | null) ?? null,
  )

  function remember(next: Role | null) {
    if (next) sessionStorage.setItem(KEY, next)
    else sessionStorage.removeItem(KEY)
    setRole(next)
  }

  const value = useMemo<AuthState>(
    () => ({
      userId: role ? 'demo-user' : null,
      role,
      loading: false,
      signIn: async () => {
        remember('user')
        return { error: null }
      },
      signOut: async () => remember(null),
    }),
    [role],
  )

  // The bar takes real height, so the app's full-height shell has to know about
  // it or the tab bar is pushed below the fold — which is exactly what happened
  // before this existed. Production never sets the variable, and the shell falls
  // back to 0px, so nothing about the real build changes.
  useEffect(() => {
    const root = document.documentElement
    if (role) root.style.setProperty('--demo-bar', '2.1rem')
    else root.style.removeProperty('--demo-bar')
  }, [role])

  return (
    <AuthContext.Provider value={value}>
      {/* Sticky and in normal flow, not fixed. Three bugs caught by driving the
          real build in a browser: at the bottom it covered the tab bar and
          swallowed every tap; fixed at the top it sat over the header; and
          translucent, the header scrolled visibly through it. Opaque, in normal
          flow, with its height published to the shell. */}
      {role && (
        <div className="sticky top-0 z-50 flex h-[2.1rem] items-center justify-center gap-2 border-b border-accent-d bg-raised px-3 text-[0.65rem]">
          <span className="text-muted">Demo · opdigtede tal</span>
          <button
            type="button"
            onClick={() => remember(role === 'admin' ? 'user' : 'admin')}
            className="rounded border border-accent px-2 py-0.5 font-semibold text-accent"
          >
            {role === 'admin' ? 'Se som medlem' : 'Se som kasserer'}
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  )
}
