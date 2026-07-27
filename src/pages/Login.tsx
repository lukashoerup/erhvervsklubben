import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DEMO } from '../data/demo'
import { LogoMark } from '../components/LogoMark'

export default function Login() {
  const { userId, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Prefilled in the demo build only. An empty login box, with no valid
  // credentials existing anywhere, is a dead end — and in a preview meant for
  // clicking through, the login is the one door there is.
  const [email, setEmail] = useState(DEMO ? 'demo@erhvervsklubben.dk' : '')
  const [password, setPassword] = useState(DEMO ? 'demo' : '')
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
    /* The texture, which every other page in the app has had since T064 and
       which this one had not: "Side · tekstur — Alle sider" (§03 Fundament).
       It is the single most identifying thing in the system, and the login is
       the first screen a member sees on a new phone. On the full-height
       wrapper rather than the form, the same way the Shell and the landing
       page ground themselves. */
    <div className="ek-texture min-h-dvh">
      <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-5">
        <form onSubmit={onSubmit} className="w-full">
          <div className="mb-8 flex flex-col items-center text-center">
            {/* The drawn mark, not the letters EK in a hard-edged navy box.
                §02 is explicit that the vector is the mark — "skarp i alle
                størrelser", with the 7,3 % corner radius and the inner
                hairline — and T064 already made this swap in the app bar. The
                login sits outside the Shell, so it kept the old lockup and the
                club met itself twice in two different ways. Not `animated`:
                the four-second intro belongs on the front door, and someone
                who has come here to type a password has already been through
                it. */}
            <LogoMark size={64} />
            <h1 className="mt-4 text-sm font-semibold tracking-[0.2em] uppercase">
              Erhvervsklubben
            </h1>
          </div>

          {/* min-h-12 on both fields and the button: §03's touch floor is
              48 × 48 and these measured 46 and 44. The rest of the app has
              been at the floor since T062; the login was never swept because
              nothing on it looked small. */}
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
            className="mt-1 mb-4 block min-h-12 w-full rounded-btn border border-line bg-surface px-3 py-2.5 text-ink"
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
            className="mt-1 block min-h-12 w-full rounded-btn border border-line bg-surface px-3 py-2.5 text-ink"
          />

          {/* role=alert so a screen reader announces the failure rather than
              leaving someone waiting for a page that never changes. */}
          {error && (
            <p role="alert" className="mt-3 text-sm text-absent">
              {error}
            </p>
          )}

          {/* bg-brand, not bg-accent, for the reason every other filled button
              in the app already uses it: --color-accent lightens to #5b8def on
              the dark ground so it stays legible *as text*, and white on that
              measured 3.23:1 here — a login button failing AA on the one
              screen nobody can get past. --color-brand is the system's own
              #2563eb, where white is 5.1:1 on either ground. */}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-btn bg-brand px-4 font-semibold text-white hover:bg-brand-hi disabled:opacity-60"
          >
            {busy ? 'Logger ind…' : 'Log ind'}
          </button>

          {DEMO && (
            <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-faint">
              Demoversion med opdigtede tal. Tryk bare <strong>Log ind</strong> —
              der er ingen database bag denne udgave.
            </p>
          )}
        </form>
      </main>
    </div>
  )
}
