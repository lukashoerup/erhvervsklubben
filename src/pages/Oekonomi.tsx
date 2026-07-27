import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { READONLY, supabase } from '../lib/supabase'
import { balancesByMember, buildLedger, quarterOf, quarterlyTotals } from '../data/ledger'
import { Loading, Problem } from '../components/State'
import { FineCapture, type DraftFine } from '../components/FineCapture'
import { useAttendance } from '../data/useClubData'
import { useAuth } from '../auth/AuthContext'
import { DEMO, demoFines, demoPayments } from '../data/demo'

/**
 * The treasurer's screen. Reached only through RequireAccess access="admin",
 * and the tables behind it are admin-only in the database too — hiding a page
 * stops honest people, policies stop everyone.
 *
 * Every figure here is derived from the fines and payments rows. The old
 * spreadsheet stored its totals, which is how it came to disagree with itself
 * by 50 kr.
 *
 * A fine belongs to the month its meeting happened in. Meetings recorded before
 * dates were captured have none, so those fines count towards what is owed but
 * stay out of the month-by-month view — and the amount left out is stated,
 * rather than being quietly dropped or shoved into an arbitrary month, which
 * would misstate a quarter. The undated meetings are listed with a field to
 * fill in, so the gap is finite, visible and shrinking.
 */
function useFinance() {
  return useQuery({
    queryKey: ['finance'],
    queryFn: async () => {
      if (DEMO) return { fines: demoFines, payments: demoPayments }
      // The live project predates the club's books: it has no fines or
      // payments tables, and this build may not create them. Empty is the
      // truthful answer, and the page says so rather than erroring.
      if (READONLY) return { fines: [], payments: [] }
      const [fines, payments] = await Promise.all([
        supabase().from('fines').select('member_name, amount_kr, record_id'),
        supabase().from('payments').select('month, amount_kr'),
      ])
      if (fines.error) throw fines.error
      if (payments.error) throw payments.error
      return {
        fines: (fines.data ?? []) as {
          member_name: string
          amount_kr: number
          record_id: number
        }[],
        payments: (payments.data ?? []) as { month: string; amount_kr: number }[],
      }
    },
  })
}

const kr = (n: number) => `${n.toLocaleString('da-DK')} kr.`

/** Save a meeting's fines. One row per fine; the database enforces the cap. */
function useRecordFines() {
  const qc = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: async ({ recordId, fines }: { recordId: number; fines: DraftFine[] }) => {
      if (fines.length === 0) return
      const { error } = await supabase()
        .from('fines')
        .upsert(
          fines.map((f) => ({
            record_id: recordId,
            member_name: f.member,
            rule_id: f.ruleId,
            minutes: f.minutes,
            amount_kr: f.kr,
            noted_by: userId,
          })),
          // Re-recording a meeting corrects it rather than duplicating: the
          // unique key is exactly the regulation's one-per-offence-per-meeting.
          { onConflict: 'record_id,member_name,rule_id' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

function RecordFines() {
  const attendance = useAttendance()
  const record = useRecordFines()
  const [meetingId, setMeetingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<DraftFine[]>([])

  if (READONLY) return null
  if (!attendance.data || attendance.data.meetings.length === 0) return null
  const meetings = attendance.data.meetings
  const meeting = meetings.find((m) => m.id === meetingId)

  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h2 className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">Registrér bøder</h2>

      <label className="mt-2 block text-xs text-muted">
        Møde
        <select
          aria-label="Møde"
          className="mt-1 block w-full rounded-lg border border-line bg-raised px-2 py-2 text-ink"
          value={meetingId ?? ''}
          onChange={(e) => {
            setMeetingId(e.target.value ? Number(e.target.value) : null)
            setDraft([])
          }}
        >
          <option value="">Vælg møde…</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              Nr. {m.number} — {m.lead}
            </option>
          ))}
        </select>
      </label>

      {meeting && (
        <div className="mt-3 flex flex-col gap-2">
          <FineCapture
            // Everyone who was at the meeting — you cannot be fined for
            // toasting early at a meeting you did not attend.
            members={meeting.present}
            value={draft}
            onChange={setDraft}
          />
          <button
            type="button"
            disabled={draft.length === 0 || record.isPending}
            onClick={() => record.mutate({ recordId: meeting.id, fines: draft })}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {record.isPending ? 'Gemmer…' : `Gem ${draft.length} bøde(r)`}
          </button>
          {record.isSuccess && (
            <p role="status" className="text-xs text-present">
              Gemt.
            </p>
          )}
          {record.isError && (
            <p role="alert" className="text-xs text-absent">
              Kunne ikke gemme. Prøv igen.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * The meetings still missing a date, and a way to fill one in.
 *
 * Not busywork: a fine cannot be placed in a month without one, so every undated
 * meeting is a hole in the books. Listing them makes the gap finite and visible
 * instead of a vague "the history has no dates" — and it shrinks as they are
 * filled, so it disappears on its own.
 */
function MissingDates() {
  const attendance = useAttendance()
  const qc = useQueryClient()
  const setDate = useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      const { error } = await supabase()
        .from('attendance_records')
        .update({ meeting_date: date })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })

  const undated = (attendance.data?.meetings ?? []).filter((m) => !m.date)
  if (READONLY) return null
  if (undated.length === 0) return null

  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h2 className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">
        Møder uden dato · {undated.length}
      </h2>
      <p className="mt-1 text-[0.68rem] text-faint">
        Bøder kan ikke placeres i en måned uden en dato. Udfyld dem her, så
        regnskabet måned for måned bliver muligt.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {undated.slice(0, 12).map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-xs">
            <span className="tabular w-8 font-semibold text-accent">{m.number}</span>
            <span className="flex-1 truncate text-muted">{m.lead || 'ukendt'}</span>
            <input
              type="date"
              aria-label={`Dato for møde ${m.number}`}
              className="rounded border border-line bg-raised px-2 py-1 text-ink"
              onChange={(e) => e.target.value && setDate.mutate({ id: m.id, date: e.target.value })}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Oekonomi() {
  const { data, isPending, error } = useFinance()
  const attendance = useAttendance()

  if (isPending) return <Loading what="klubkassen" />
  if (error) return <Problem />

  // A fine belongs to the month its meeting happened in. Fines on a meeting
  // that still has no date are counted in the totals — they are owed either
  // way — but left out of the month-by-month view rather than dumped into an
  // arbitrary month, which would misstate a quarter.
  const monthOf = new Map(
    (attendance.data?.meetings ?? []).map((m) => [m.id, m.month]),
  )
  const finesWithMonth = data.fines.map((f) => ({
    month: monthOf.get(f.record_id) ?? '',
    member_name: f.member_name,
    amount_kr: f.amount_kr,
  }))
  const dated = finesWithMonth.filter((f) => f.month)
  const undatedKr = finesWithMonth
    .filter((f) => !f.month)
    .reduce((n, f) => n + f.amount_kr, 0)

  const owed = balancesByMember(finesWithMonth)
  const totalOwed = owed.reduce((n, o) => n + o.kr, 0)
  const received = data.payments.reduce((n, p) => n + p.amount_kr, 0)

  const quarters = quarterlyTotals(dated)
  const months = [
    ...dated.map((f) => f.month),
    ...data.payments.map((p) => p.month.slice(0, 7)),
  ].sort()
  const ledger = months.length
    ? buildLedger({
        from: months[0],
        to: months[months.length - 1],
        fines: dated,
        payments: data.payments.map((p) => ({ ...p, month: p.month.slice(0, 7) })),
        activeMembers: () => attendance.data?.roster.length ?? 0,
      })
    : []

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-accent-d bg-surface p-4">
        <p className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">Klubkassen</p>
        <p className="tabular mt-1 text-2xl font-semibold">{kr(received)}</p>
        <p className="mt-1 text-xs text-muted">
          Indbetalt i alt. Udestående bøder: <span className="tabular">{kr(totalOwed)}</span>
        </p>
      </section>

      {READONLY && (
        <section className="rounded-xl border border-line bg-surface p-3">
          <h2 className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">
            Skrivebeskyttet forhåndsvisning
          </h2>
          <p className="mt-1 text-[0.68rem] leading-relaxed text-faint">
            Denne udgave læser klubbens rigtige data, men kan ikke ændre dem.
            Bøder og indbetalinger findes endnu ikke i databasen, så tallene
            herunder står på nul, indtil regnskabet flyttes ind.
          </p>
        </section>
      )}

      <RecordFines />
      <MissingDates />

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

      {quarters.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-3">
          <h2 className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">
            Kvartalsvis opkrævning
          </h2>
          <ul className="mt-1">
            {quarters.map((q) => (
              <li
                key={q.quarter}
                className="flex justify-between border-b border-line py-1.5 text-xs last:border-0"
              >
                <span className="tabular">{q.quarter}</span>
                <span className="tabular font-semibold">{kr(q.kr)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ledger.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-3">
          <h2 className="text-[0.58rem] tracking-[0.14em] text-accent uppercase">
            Måned for måned
          </h2>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-faint">
                  <th className="text-left font-normal">Måned</th>
                  <th className="text-right font-normal">Forventet</th>
                  <th className="text-right font-normal">Modtaget</th>
                  <th className="text-right font-normal">Udestående</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {ledger.map((m) => (
                  <tr key={m.month} className="border-t border-line">
                    <td className="py-1">{m.month}</td>
                    <td className="py-1 text-right">{m.expected}</td>
                    <td className="py-1 text-right">{m.received}</td>
                    <td className="py-1 text-right text-accent">{m.outstanding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {undatedKr > 0 && (
            <p className="mt-2 text-[0.68rem] text-faint">
              {kr(undatedKr)} i bøder hører til møder uden dato og indgår derfor
              ikke i månedsoversigten. De tælles stadig med i totalen.
            </p>
          )}
        </section>
      )}

      <p className="text-[0.68rem] leading-relaxed text-faint">
        Alle tal er beregnet, ikke gemte — summen kan ikke komme i modstrid med
        sine egne poster. Bøder opkræves kvartalsvist; indeværende kvartal er{' '}
        <span className="tabular">{quarterOf(new Date().toISOString().slice(0, 7))}</span>.
      </p>
    </div>
  )
}
