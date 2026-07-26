import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState, type Role } from './AuthContext'
import { supabase } from '../lib/supabase'

/**
 * The real provider: wires Supabase auth into the context the guards read.
 *
 * The role comes from `profiles`, not from the JWT, because that is where the
 * database's own policies read it from (`get_user_role`). Trusting anything
 * else here would let the interface and the security disagree — and the
 * database wins that argument every time.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function readRole(id: string | null) {
      if (!id) return null
      const { data } = await supabase().from('profiles').select('role').eq('id', id).single()
      return (data?.role as Role) ?? 'user'
    }

    async function apply(id: string | null) {
      const r = await readRole(id)
      if (!alive) return
      setUserId(id)
      setRole(r)
      setLoading(false)
    }

    supabase()
      .auth.getSession()
      .then(({ data }) => apply(data.session?.user.id ?? null))
      .catch(() => { if (alive) setLoading(false) })

    // Keeps the session alive across reloads and tabs, and signs the app out
    // the moment the token is revoked rather than on next navigation.
    const { data: sub } = supabase().auth.onAuthStateChange((_e, session) => {
      void apply(session?.user.id ?? null)
    })

    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const signIn: AuthState['signIn'] = useCallback(async (email, password) => {
    const { error } = await supabase().auth.signInWithPassword({ email, password })
    // The message is deliberately not passed through: Supabase distinguishes
    // "no such user" from "wrong password", and echoing that tells an attacker
    // which emails are members.
    return { error: error ? 'Forkert e-mail eller adgangskode.' : null }
  }, [])

  const signOut: AuthState['signOut'] = useCallback(async () => {
    await supabase().auth.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({ userId, role, loading, signIn, signOut }),
    [userId, role, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
