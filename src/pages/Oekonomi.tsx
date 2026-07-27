import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { READONLY, supabase } from '../lib/supabase'
import { balancesByMember, buildLedger, quarterOf, quarterlyTotals } from '../data/ledger'
import { Loading, Problem } from '../components/State'
import { FineCapture, type DraftFine } from '../components/FineCapture'
import { FinanceChart, kr } from '../components/FinanceChart'
import { useAttendance } from '../data/useClubData'
import { useAuth } from '../auth/AuthContext'
import { DEMO, demoFines, demoPayments } from '../data/demo'
import { SectionTitle } from '../components/SectionTitle'

/**
 * The club's money. A member route since 2026-07-27 — §8 puts the accounts in
 * front of the whole membership once a year, so there is no reading of the
 * statutes where the people funding the club may not see what it collects. What
 * is still the treasurer's is gated inside the page, not at the door.
 *
 * Every figure here is derived from the fines and payments rows. The sheet this
 * replaces was blamed for a 50 kr discrepancy it never had — see ledger.ts and
 * docs/finance-reconciliation.md. Deriving the totals is worth doing, but it is
 * not what would have caught that.
 *
 * A fine belongs to the month its meeting happened in. Meetings recorded before
 * dates were captured have none, so those fines count towards what is owed but
 * stay out of the month-by-month view — and the amount left out is stated,
 * rather than being quietly dropped or shoved into an arbitrary month, which
 * would misstate a quarter. The undated meetings are listed with a field to
 * fill in, so the gap is finite, visible and shrinking.
 *
 * A read-only build reads these two tables like any other. It used to answer
 * empty without asking, because the live project genuinely had no `fines` or
 * `payments` and a locked build could not have created them; both have existed
 * in production since 2026-07-27. Short-circuiting now would only make a
 * preview of the books report zeros — a lie about the club's money, told by the
 * mode whose entire purpose is looking without touching. The client refuses the
 * writes on its own (see lib/supabase), and the write-shaped UI below is not
 * rendered, so nothing is protected by also refusing to read.
 */
function useFinance() {
  return useQuery({
    queryKey: ['finance'],
    queryFn: async () => {
      if (DEMO) return { fines: demoFines, payments: demoPayments }
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

/**
 * Danish has a singular and a plural, and neither of them is "bøde(r)".
 *
 * The parenthesis is a note-to-self left in the interface: the club's own
 * treasurer reads it every time he closes a meeting, and it says the app was
 * not finished.
 */
const boeder = (n: number) => `${n} ${n === 1 ? 'bøde' : 'bøder'}`

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
    <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
      <SectionTitle onCard>Registrér bøder</SectionTitle>

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
            /* bg-brand, not bg-accent: white on the accent measures 3.2:1 on
               the dark ground and fails AA, and this is the button the whole
               screen exists for. Same #2563eb the landing page's buttons use,
               where white measures 5.1:1 on either ground. */
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hi disabled:opacity-50"
          >
            {record.isPending ? 'Gemmer…' : `Gem ${boeder(draft.length)}`}
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
 * How many meetings still have no date, and where that gets fixed.
 *
 * This card used to carry a date field per meeting — a second way to write
 * `attendance_records.meeting_date`, on a page about money. T065 gave the
 * meeting itself an editor on `/anciennitet`, where the date sits beside the
 * lead, the venues and who attended; the field here then became the same
 * column reached by a worse route, able to set a date and nothing else, and
 * two inputs on one column are two places for it to start behaving differently.
 *
 * The *count* is what was worth keeping, and it stays for the reason it was
 * built: a fine cannot be placed in a month without a date, so every undated
 * meeting is a hole in these books and the size of the hole belongs on the page
 * it is a hole in. It shrinks as they are filled and goes away on its own.
 */
function MissingDates() {
  const attendance = useAttendance()
  const meetings = attendance.data?.meetings ?? []
  const undated = meetings.filter((m) => !m.date)
  if (READONLY) return null
  if (undated.length === 0) return null

  return (
    <p className="text-[0.68rem] leading-relaxed text-faint">
      <span className="tabular">{undated.length}</span> af{' '}
      <span className="tabular">{meetings.length}</span> møder har ingen dato, og en
      bøde kan ikke placeres i en måned uden. Datoen sættes på mødets eget kort
      under Anciennitet, sammen med resten af mødet.
    </p>
  )
}

export default function Oekonomi() {
  const { data, isPending, error } = useFinance()
  const attendance = useAttendance()
  // Every member sees what the club holds and what it is owed. Who owes it is
  // the treasurer's business: a standing list naming who is behind turns a
  // shared account into a public debt notice at the table.
  const { role } = useAuth()
  const isTreasurer = role === 'admin'

  if (isPending) return <Loading what="klubkassen" />
  if (error) return <Problem />

  // A fine belongs to the month its meeting happened in. Fines on a meeting
  // that still has no date are counted in the totals — they are owed either
  // way — but left out of the month-by-month view rather than dumped into an
  // arbitrary month, which would misstate a quarter.
  const meetings = attendance.data?.meetings ?? []
  const monthOf = new Map(meetings.map((m) => [m.id, m.month]))
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
      {/* The balance itself stays with the treasurer (Lukas, 2026-07-26: "not
          everyone should know how much money is in the bank account"), while
          the club's income against what it should have collected is for every
          member (Lukas, 2026-07-27). Both hold at once — one is a bank
          balance, the other is whether the club collects what it is owed. */}
      {isTreasurer && (
        <section data-reveal className="rounded-2xl border border-accent-d bg-surface p-4">
          <p className="text-[0.6rem] tracking-[0.14em] text-accent uppercase">
            Klubkassen · kun kassereren
          </p>
          <p className="tabular mt-1 text-2xl font-semibold">{kr(received)}</p>
          <p className="mt-1 text-xs text-muted">
            Indbetalt i alt. Udestående bøder: <span className="tabular">{kr(totalOwed)}</span>
          </p>
        </section>
      )}

      {READONLY && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
          <SectionTitle onCard>Skrivebeskyttet forhåndsvisning</SectionTitle>
          <p className="mt-1 text-[0.68rem] leading-relaxed text-faint">
            Denne udgave læser klubbens rigtige tal, men kan ikke ændre dem. Der
            kan hverken registreres bøder eller rettes datoer herfra.
          </p>
        </section>
      )}

      {/* Every member, not just the treasurer (Lukas, 2026-07-27: members could
          not see the club's finances at all). It shows what the club charges
          against what it collects — not the bank balance, which is the card
          above and still his. */}
      <FinanceChart
        ledger={ledger}
        books={{
          fines: data.fines.length,
          payments: data.payments.length,
          meetings: meetings.length,
          undatedMeetings: meetings.filter((m) => !m.month).length,
        }}
      />

      <RecordFines />
      <MissingDates />

      {isTreasurer && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
          <SectionTitle onCard>Bøder pr. medlem · kun kassereren</SectionTitle>
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
      )}

      {quarters.length > 0 && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
          <SectionTitle onCard>Kvartalsvis opkrævning</SectionTitle>
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
        <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
          {/* Also the chart's table view: every value the curves and the hover
              readout show is here in text, so nothing on this page can only be
              read by having a mouse or seeing a colour. */}
          <SectionTitle onCard>Måned for måned</SectionTitle>
          <p className="mt-1 text-[0.68rem] text-faint">
            De samme tal som kurven, måned for måned frem for lagt sammen.
          </p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-faint">
                  <th className="text-left font-normal">Måned</th>
                  <th className="text-right font-normal">Forventet</th>
                  <th className="text-right font-normal">Modtaget</th>
                  {/* Labelled as accumulating, because it does: the column is a
                      running balance while the two beside it are that month's
                      own figures. Unlabelled, a month reads as not adding up. */}
                  <th className="text-right font-normal">Udestående (akk.)</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {/* Formatted, not raw. The same page wrote 3.600 kr. two cards
                    up and 3600 here, and a reader comparing them has to work
                    out that they are the same kind of number first. */}
                {ledger.map((m) => (
                  <tr key={m.month} className="border-t border-line">
                    <td className="py-1">{m.month}</td>
                    <td className="py-1 text-right">{kr(m.expected)}</td>
                    <td className="py-1 text-right">{kr(m.received)}</td>
                    <td className="py-1 text-right text-accent">{kr(m.outstanding)}</td>
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
