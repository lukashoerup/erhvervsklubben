import { useNews } from '../data/useClubData'
import { daDate } from '../lib/dates'
import { Loading, Problem } from '../components/State'

/** The one page Lukas said already worked — same shape, restyled to match. */
export default function Nyheder() {
  const { data, isPending, error } = useNews()

  if (isPending) return <Loading what="nyheder" />
  if (error) return <Problem />
  if (data.length === 0) return <p className="text-sm text-muted">Ingen nyheder endnu.</p>

  return (
    <div className="flex flex-col gap-3">
      {data.map((n) => (
        <article key={n.id} className="rounded-xl border border-line bg-surface p-3">
          <p className="tabular text-[0.6rem] tracking-[0.1em] text-accent uppercase">
            {daDate(n.date, { day: 'numeric', month: 'long' })}
          </p>
          <h3 className="mt-1 text-[0.95rem] leading-snug font-semibold">{n.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{n.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
