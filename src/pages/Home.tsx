import { useAuth } from '../auth/AuthContext'

/**
 * The front page, rebuilt around what members open the app for.
 *
 * The old one was a recruitment brochure — hero pitch, three generic cards,
 * "become a member" — aimed at strangers, for a club that isn't recruiting.
 * Content lands here as the data layers arrive; the shape is the decision.
 *
 * Note what is NOT here: the club's balance. Finance is the treasurer's,
 * behind /oekonomi (Lukas, 2026-07-26).
 */
export default function Home() {
  const { role } = useAuth()
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-accent-d bg-surface p-4">
        <p className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">Næste møde</p>
        <h2 className="mt-1 text-xl font-semibold">Ikke planlagt endnu</h2>
        <p className="mt-1 text-sm text-muted">
          Vedtægterne §9: der planlægges altid to møder forud.
        </p>
      </section>

      {role === 'admin' && (
        <a
          href="/oekonomi"
          className="rounded-xl border border-line bg-surface p-4 text-sm text-muted"
        >
          <span className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">Kasserer</span>
          <span className="mt-1 block text-ink">Klubkassen →</span>
        </a>
      )}
    </div>
  )
}
