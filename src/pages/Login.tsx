import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { userId, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Where the guard was trying to send them before it bounced them here.
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (!loading && userId) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError(error)
    else navigate(from, { replace: true })
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-sm place-items-center px-5">
      <form onSubmit={onSubmit} className="w-full">
        <div className="mb-8 text-center">
          <div
            aria-hidden="true"
            className="mx-auto grid size-16 place-items-center bg-navy font-serif text-2xl text-white"
          >
            EK
          </div>
          <h1 className="mt-4 text-sm font-semibold tracking-[0.2em] uppercase">
            Erhvervsklubben
          </h1>
        </div>

        <label className="block text-xs tracking-wider text-faint uppercase" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink"
        />

        <label className="block text-xs tracking-wider text-faint uppercase" htmlFor="password">
          Adgangskode
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink"
        />

        {/* role=alert so a screen reader announces the failure rather than
            leaving someone waiting for a page that never changes. */}
        {error && (
          <p role="alert" className="mt-3 text-sm text-absent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Logger ind…' : 'Log ind'}
        </button>
      </form>
    </main>
  )
}
