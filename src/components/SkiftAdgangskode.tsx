import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { DEMO } from '../data/demo'
import { READONLY, supabase } from '../lib/supabase'
import { FILLED } from './AdminEdit'
import { Eyebrow } from './SectionTitle'

/**
 * Supabase's own floor is six. Eight, because the club's logins were handed out by
 * its treasurer rather than chosen — one member is on `1234` — and this form exists
 * precisely to get off those. A rule the field states before it is broken rather
 * than after: the hint is on screen from the moment the fold opens.
 */
const MIN = 8

/** The same field the admin forms use, minus their leading margin. */
const FIELD =
  'block min-h-12 w-full rounded-btn border border-line bg-raised px-3 py-2 text-sm text-ink'

/**
 * Changing your own password, from inside the app.
 *
 * Lukas, 2026-08-08: *"Der er en del som gerne vil have ændret deres password."*
 * Until now there was no way at all — the logins were created by him, and a member
 * who wanted a different one had to ask him to do it in the database.
 *
 * **No current password is asked for, and that is deliberate rather than lazy.**
 * The obvious design verifies the old one first, and it would lock out exactly the
 * people this is for: the club's sessions outlive the sign-in that made them by
 * months (T074 found Saaby still on an October session in February), so a member who
 * has not typed his password since Lukas handed it to him cannot produce it. The
 * session is the proof of identity here, which is the same standard every other
 * write in the app already runs on.
 *
 * The cost of that choice is stated rather than hidden: someone holding an unlocked
 * phone could change its owner's password. In a club of ten with no money moving
 * through these accounts, that is a smaller risk than nine men unable to replace a
 * password the treasurer picked for them.
 *
 * **Typed twice**, because there is nothing to read it back from. A typo in a single
 * field is a member locked out of his own account until Lukas resets it by hand —
 * which is the very errand this is meant to end.
 */
export function SkiftAdgangskode() {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')

  const save = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase().auth.updateUser({ password: next })
      if (error) throw error
    },
    onSuccess: () => {
      setPassword('')
      setRepeat('')
    },
  })

  // Never in a preview or a demo build. Both carry the club's real project
  // configuration, so `updateUser` here would change a real member's real password
  // from a build whose whole point is that it cannot touch anything.
  if (READONLY || DEMO) return null

  const short = password.length > 0 && password.length < MIN
  const mismatch = repeat.length > 0 && password !== repeat
  const canSave = password.length >= MIN && password === repeat && !save.isPending

  return (
    <details data-reveal className="rounded-2xl border border-line bg-surface">
      {/* The same folded idiom as "Sidst set" on /anciennitet: a control almost
          nobody needs on any given visit, costing one row when shut. `<details>` is
          native, so it opens before the JavaScript settles and the keyboard and
          screen-reader behaviour come for free. */}
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between p-4">
        <Eyebrow>Skift adgangskode</Eyebrow>
        <span className="text-[0.62rem] text-faint">Kun din egen</span>
      </summary>

      <form
        className="flex flex-col gap-2.5 border-t border-line p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save.mutate(password)
        }}
      >
        <label className="text-xs text-muted">
          Ny adgangskode
          <input
            type="password"
            // The browser's own generator and its "is this a new password" heuristics
            // both hang off this token; without it a password manager offers to fill
            // the *current* one into a field meant to replace it.
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 ${FIELD}`}
          />
        </label>

        <label className="text-xs text-muted">
          Gentag adgangskode
          <input
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            className={`mt-1 ${FIELD}`}
          />
        </label>

        {/* One line, and only the one that applies. Three simultaneous complaints
            about a half-typed password is noise; the rule is stated up front and the
            others only appear once they are actually true. */}
        <p className="text-[0.68rem] leading-relaxed text-faint" role="status">
          {short
            ? `Mindst ${MIN} tegn.`
            : mismatch
              ? 'De to felter er ikke ens.'
              : `Vælg noget du selv kan huske — mindst ${MIN} tegn.`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* The app's own filled button, imported rather than restated. Written
              out here it had `bg-accent`, which is the token that moves with the
              palette — white on it is not guaranteed to stay readable, and that is
              exactly why `bg-brand` exists. */}
          <button type="submit" disabled={!canSave} className={FILLED}>
            {save.isPending ? 'Gemmer…' : 'Gem adgangskode'}
          </button>

          {/* The server's own message, not a rewrite of it. This is the one place in
              the app where echoing Supabase back is right: on the login form the
              message would tell a stranger whether an e-mail is a member's, and here
              the person reading it is already signed in as that member. What it says
              — too short, too common, unchanged from the last one — is the only thing
              that tells him what to type instead. */}
          {save.isError && (
            <p role="alert" className="text-xs text-absent">
              Kunne ikke gemme: {(save.error as Error).message}
            </p>
          )}
          {save.isSuccess && (
            <p role="status" className="text-xs text-present">
              Adgangskoden er skiftet. Du er stadig logget ind.
            </p>
          )}
        </div>
      </form>
    </details>
  )
}
