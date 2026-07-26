import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Access } from './routes'

/**
 * Gate a route on the access level declared in routes.ts.
 *
 * Three behaviours worth stating, because each one is a bug if it goes the
 * other way:
 *
 * 1. While the session is still loading it renders nothing rather than
 *    redirecting. Redirecting first would bounce a signed-in member to the
 *    login page on every hard refresh.
 * 2. A signed-out visitor is sent to /login carrying where they were going, so
 *    signing in returns them there instead of dumping them on the front page.
 * 3. A member hitting an admin route is told, not shown an empty screen. A
 *    blank page reads as a broken site; "this is the treasurer's" reads as a
 *    working one.
 */
export function RequireAccess({ access, children }: { access: Access; children: ReactNode }) {
  const { userId, role, loading } = useAuth()
  const location = useLocation()

  if (access === 'public') return <>{children}</>

  if (loading) return <div aria-busy="true" aria-label="Indlæser" />

  if (!userId) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (access === 'admin' && role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">Kun for kassereren</h1>
        <p className="mt-2 text-sm text-muted">
          Klubbens økonomi er forbeholdt bestyrelsens kasserer.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
