import { createContext, useContext } from 'react'

/** What the app is allowed to know about who is signed in. */
export type Role = 'admin' | 'user'

export type AuthState = {
  /** null = signed out. undefined is never used; `loading` covers "not known yet". */
  userId: string | null
  role: Role | null
  /** True until the first session lookup resolves. Guards must wait, not redirect. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

/**
 * Deliberately a plain context with no default implementation.
 *
 * Route-guard tests wrap components in their own provider and never touch
 * Supabase, which is what keeps the fast suite offline — a requirement, since
 * `npm test` must run in CI without the database stack.
 */
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth used outside an AuthProvider')
  return ctx
}
