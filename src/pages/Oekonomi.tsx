import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { balancesByMember, quarterOf } from '../data/ledger'
import { Loading, Problem } from '../components/State'

/**
 * The treasurer's screen. Reached only through RequireAccess access="admin",
 * and the tables behind it are admin-only in the database too — hiding a page
 * stops honest people, policies stop everyone.
 *
 * Every figure here is derived from the fines and payments rows. The old
 * spreadsheet stored its totals, which is how it came to disagree with itself
 * by 50 kr.
 *
 * The month-by-month ledger is deliberately absent for now: meetings carry no
 * date (§9 says two are always planned ahead, so dates are captured from here
 * on), and a fine cannot be placed in a month until its meeting has one.
 * Showing an invented month would be worse than showing none.
 */
function useFinance() {
  return useQuery({
    queryKey: ['finance'],
    queryFn: async () => {
      const [fines, payments] = await Promise.all([
        supabase().from('fines').select('member_name, amount_kr'),
        supabase().from('payments').select('month, amount_kr'),
      ])
      if (fines.error) throw fines.error
      if (payments.error) throw payments.error
      return {
        fines: (fines.data ?? []) as { member_name: string; amount_kr: number }[],
        payments: (payments.data ?? []) as { month: string; amount_kr: number }[],
      }
    },
  })
}

const kr = (n: number) => `${n.toLocaleString('da-DK')} kr.`

export default function Oekonomi() {
  const { data, isPending, error } = useFinance()

  if (isPending) return <Loading what="klubkassen" />
  if (error) return <Problem />

  const owed = balancesByMember(
    data.fines.map((f) => ({ month: '', member_name: f.member_name, amount_kr: f.amount_kr })),
  )
  const totalOwed = owed.reduce((n, o) => n + o.kr, 0)
  const received = data.payments.reduce((n, p) => n + p.amount_kr, 0)

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-accent-d bg-surface p-4">
        <p className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">Klubkassen</p>
        <p className="tabular mt-1 text-2xl font-semibold">{kr(received)}</p>
        <p className="mt-1 text-xs text-muted">
          Indbetalt i alt. Udestående bøder: <span className="tabular">{kr(totalOwed)}</span>
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <h2 className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">Bøder pr. medlem</h2>
        {owed.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Ingen bøder registreret endnu.</p>
        ) : (
          <ul className="mt-1">
            {owed.map((o) => (
              <li
                key={o.member}
                className="flex justify-between border-b border-line py-1.5 text-xs last:border-0"
              >
                <span>{o.member}</span>
                <span className="tabular font-semibold text-accent">{kr(o.kr)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[0.68rem] leading-relaxed text-faint">
        Alle tal er beregnet, ikke gemte — summen kan ikke komme i modstrid med
        sine egne poster. Bøder opkræves kvartalsvist; indeværende kvartal er{' '}
        <span className="tabular">{quarterOf(new Date().toISOString().slice(0, 7))}</span>.
      </p>
    </div>
  )
}
