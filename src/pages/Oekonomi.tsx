import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { READONLY, supabase } from '../lib/supabase'
import { buildLedger, quarterOf, quarterlyTotals } from '../data/ledger'
import { fineTotals, incomeByQuarter, outstandingByMember, type FineRow } from '../data/fines'
import { HISTORIC_RULE_ID } from '../data/rules'
import { FineInsights } from '../components/FineInsights'
import { IncomeMix } from '../components/IncomeMix'
import { budgetFines, budgetHorizon, budgetLimits, projectBudget } from '../data/projection'
import { canBeFined, paysDues, payingMembersIn } from '../data/members'
import { Loading, Problem } from '../components/State'
import { FineCapture, type DraftFine } from '../components/FineCapture'
import { FinanceChart, kr } from '../components/FinanceChart'
import { useAttendance } from '../data/useClubData'
import { useAuth } from '../auth/AuthContext'
import { DEMO, demoFines, demoPayments } from '../data/demo'
import { Eyebrow, SectionTitle } from '../components/SectionTitle'

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
/** Postgres `undefined_column`, as PostgREST passes the SQLSTATE through. */
const UNDEFINED_COLUMN = '42703'

/**
 * The fine rows, tolerating a database older than this code.
 *
 * Three columns arrived after the club's project did — `rule_id` and `minutes`
 * with T054's capture, and `settled_at` on 2026-07-30 — and asking for a column
 * that does not exist fails the *whole* read. The club's books disappearing
 * behind "kunne ikke hente data" because one field is missing is the trade
 * `readRecords` already refused for `meeting_date`, so a missing column costs
 * that column and nothing else.
 *
 * What it costs is stated rather than hidden: without `settled_at` every fine
 * reads as outstanding, which is wrong in the direction that under-claims what
 * the club has collected. Over-claiming would be the dangerous way round.
 */
async function readFines() {
  const full = await supabase()
    .from('fines')
    .select('member_name, amount_kr, record_id, rule_id, minutes, settled_at')
  if (!full.error) return (full.data ?? []) as FineRow[]
  if (full.error.code !== UNDEFINED_COLUMN) throw full.error

  const { data, error } = await supabase().from('fines').select('member_name, amount_kr, record_id')
  if (error) throw error
  return ((data ?? []) as Omit<FineRow, 'rule_id' | 'minutes' | 'settled_at'>[]).map((f) => ({
    ...f,
    rule_id: HISTORIC_RULE_ID,
    minutes: null,
    settled_at: null,
  }))
}

/**
 * Its own async function, and not an inline `supabase().from(...)` in the
 * `Promise.all` below — the same trap `readMembers` documents in useClubData.ts.
 *
 * `supabase()` throws *synchronously* when it has no configuration, and a
 * synchronous throw while the argument array is being built abandons the sibling
 * promise mid-flight: an unhandled rejection, reported from the wrong place, in a
 * test file that never opened this page. It was inline until T078 made the fines
 * read a function and moved the throw to the second element, which is how it
 * surfaced. Inside an async function the same throw is an ordinary rejection,
 * which `Promise.all` is built to handle.
 */
async function readPayments() {
  const { data, error } = await supabase().from('payments').select('month, amount_kr')
  if (error) throw error
  return (data ?? []) as { month: string; amount_kr: number }[]
}

function useFinance() {
  return useQuery({
    queryKey: ['finance'],
    queryFn: async () => {
      if (DEMO) return { fines: demoFines, payments: demoPayments }
      const [fines, payments] = await Promise.all([readFines(), readPayments()])
      return { fines, payments }
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
  const statusOf = new Map(attendance.data.roster.map((r) => [r.name, r.status]))

  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <SectionTitle onCard>Registrér bøder</SectionTitle>

      <label className="mt-3 block text-xs text-muted">
        Møde
        <select
          aria-label="Møde"
          className="mt-1 block min-h-12 w-full rounded-btn border border-line bg-raised px-2 py-2 text-ink"
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
            // Everyone at the meeting who can be fined. Attending is the first
            // condition — you cannot toast early at a dinner you missed — and
            // membership status is the second: the founding father incurs no
            // fines (§12, Lukas 2026-07-29) and attends nearly everything, so
            // without this he would be the most frequently offered name on the
            // screen. Left out rather than shown-and-refused: a chip that
            // cannot be tapped invites the Lead to work out why mid-clean-up.
            members={meeting.present.filter((n) => canBeFined(statusOf.get(n) ?? null))}
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
            className="inline-flex min-h-12 items-center justify-center rounded-btn bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hi disabled:opacity-50"
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

  // Pålagt, indbetalt and udestående are three different numbers, and the page
  // used to print the first of them under the third's name — Lukas, 2026-07-30:
  // "Der står i toppen af økonomisiden at der er udestående bøder på 2510 kr.
  // Det passer ikke." See data/fines.ts.
  const totals = fineTotals(data.fines)
  const stillOwed = outstandingByMember(data.fines)
  const received = data.payments.reduce((n, p) => n + p.amount_kr, 0)

  const quarters = quarterlyTotals(dated)
  // The income mix needs the fine's rule as well as its month, which the ledger
  // shape above deliberately drops — it only ever cared about amounts per month.
  const finesForMix = data.fines.map((f) => ({
    month: monthOf.get(f.record_id) ?? '',
    rule_id: f.rule_id,
    amount_kr: f.amount_kr,
  }))
  const months = [
    ...dated.map((f) => f.month),
    ...data.payments.map((p) => p.month.slice(0, 7)),
  ].sort()
  // Who the club charges, from membership status — and since 2026-07-30, in
  // which months. This was `roster.length` until 2026-07-29: everyone who had
  // ever attended, member or not, exempt or not. It then became a flat count of
  // today's payers across the whole history, which was still 1.200 kr. too high
  // in the early months, because it charged nine members where the club charged
  // eight (§13). The bank statement supplied the missing fact rather than a
  // guess — eight payers from June 2025, nine once Christian Have's first
  // transfer arrives in May 2026 — and `members.dues_from` holds it. A member
  // with no `dues_from` is still charged across the whole window, so a database
  // that has not run the migration behaves exactly as it did before.
  const roster = attendance.data?.roster ?? []
  const payers = roster.filter((r) => paysDues(r.status))
  const chargedIn = (month: string) => payingMembersIn(roster, month)
  const ledger = months.length
    ? buildLedger({
        from: months[0],
        to: months[months.length - 1],
        fines: dated,
        payments: data.payments.map((p) => ({ ...p, month: p.month.slice(0, 7) })),
        payingMembers: chargedIn,
      })
    : []

  // Built from the ledger's own dues rather than recomputed, so the bars and the
  // blue curve above them cannot disagree about what the club charged.
  const quarterMix = incomeByQuarter(
    ledger.map((m) => ({ month: m.month, dues: m.dues })),
    finesForMix,
  )

  // The club's own budgeting of fines it has not been charged yet — the
  // `Forventede bøder` column *Klubbens finanser* had and this app dropped
  // (Lukas, 2026-07-29). The average is per meeting, not per month, which is
  // the only reason it can be computed at all here: every one of the club's
  // meetings is undated, so a fine's *month* is unknown while its *evening* is
  // not. See data/projection.ts for why that distinction is the whole design.
  const finesByMeeting = new Map<number, number>()
  for (const f of data.fines) {
    finesByMeeting.set(f.record_id, (finesByMeeting.get(f.record_id) ?? 0) + f.amount_kr)
  }
  const budget = budgetFines({
    meetings: meetings.map((m) => ({ number: m.number, kr: finesByMeeting.get(m.id) ?? 0 })),
    meetingDates: meetings.map((m) => m.date).filter((d): d is string => !!d),
  })
  const budgetNotes = budgetLimits({
    meetings: meetings.length,
    undatedMeetings: meetings.filter((m) => !m.month).length,
    budget,
  })
  const budgetMonths =
    ledger.length > 0 && budget.basis !== 'none'
      ? projectBudget({
          after: ledger[ledger.length - 1].month,
          // Never a longer forecast than the record behind it. The sheet ran
          // fourteen months past its last real row, and on a curve that means
          // the club's actual history becomes a squiggle in the corner while
          // the guess becomes the picture.
          months: budgetHorizon(ledger.length),
          openingBalance: ledger[ledger.length - 1].expectedBalance,
          budget,
          payingMembers: chargedIn,
        })
      : []

  return (
    <div className="flex flex-col gap-4">
      {/* The balance itself stays with the treasurer (Lukas, 2026-07-26: "not
          everyone should know how much money is in the bank account"), while
          the club's income against what it should have collected is for every
          member (Lukas, 2026-07-27). Both hold at once — one is a bank
          balance, the other is whether the club collects what it is owed. */}
      {isTreasurer && (
        <section data-reveal className="rounded-2xl border border-accent-d bg-surface p-4">
          <Eyebrow>Klubkassen · kun kassereren</Eyebrow>
          {/* The one figure on the page that is a balance rather than a series,
              so it is the one set as display type — §04's scroll-scene does
              exactly this with "13.150 kr." at 34 px in Instrument Serif. */}
          <p className="ek-figure mt-2 text-[1.75rem] leading-none">{kr(received)}</p>
          {/* Three figures where there used to be one, because there were always
              three and the card named the wrong one. `Udestående` must be the
              730 kr. the club has not been paid — never the 2.510 kr. it has
              ever charged, of which 1.780 kr. has been in the bank since
              February 2026.

              Said as a sentence rather than as a second figure row: this card is
              the one balance on the page (§ the Klubkassen note above), and
              three tiles under it would read as four balances. */}
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Indbetalt i alt. Bøder pålagt{' '}
            <span className="tabular">{kr(totals.incurredKr)}</span>, heraf indbetalt{' '}
            <span className="tabular">{kr(totals.collectedKr)}</span> — udestående{' '}
            <span className="tabular font-semibold text-ink">{kr(totals.outstandingKr)}</span>.
          </p>
          {/* The 730 kr. is not a rounding gap, it is three evenings nobody
              billed (§15.1), and whether to collect it is Lukas's decision and
              not the app's. So the card states the fact once and stops — no
              badge, no red, no "husk at opkræve". A number that nags every time
              he opens the page is a number he stops reading. */}
          {totals.outstandingKr > 0 && (
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-faint">
              De{' '}
              <span className="tabular">{kr(totals.outstandingKr)}</span> er bøder,
              en Lead har noteret, og som aldrig er blevet opkrævet.
            </p>
          )}
        </section>
      )}

      {READONLY && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
          <SectionTitle onCard>Skrivebeskyttet forhåndsvisning</SectionTitle>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
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
          // What the expected curve is built from, so it can be checked rather
          // than trusted. The card that used to say it — "Hvem betaler
          // kontingent", nine of ten, and Oskar named as founding father — is
          // gone at Lukas's word (2026-07-29): "Det ved alle godt." He is
          // right, in a club of ten. What he was not saying is that the blue
          // line is nine times the rate and not ten, and a member checking it
          // on his fingers gets a different number — so the count survives as
          // a clause in the chart's own caption, with no names and no card.
          payers: payers.length,
          fines: data.fines.length,
          payments: data.payments.length,
          meetings: meetings.length,
          undatedMeetings: meetings.filter((m) => !m.month).length,
        }}
        budget={budget}
        budgetMonths={budgetMonths}
        budgetNotes={budgetNotes}
      />

      {/* Both new cards sit outside every `isTreasurer` gate, and that is
          Lukas's instruction rather than an oversight — 2026-07-30, twice in one
          sentence: "Alle medlemmer skal kunne se det. Det samme med bøderne."
          What stays the treasurer's is the bank balance and the list of who is
          still behind; what the club is like is the club's. */}
      <FineInsights fines={data.fines} />

      <RecordFines />
      <MissingDates />

      {/* The treasurer's collection list, and it is now what its name says.
          It used to be `balancesByMember` over every fine ever incurred under
          the heading "Bøder pr. medlem", on a card next to the word udestående —
          the same conflation as the balance card, one screen down: it invited
          the treasurer to bill a member for fines the man paid in February.
          What a collection list has to contain is what is still owed.

          Who has been fined *at all* is not lost — it is the chart below, which
          every member can see. This card is the subset that is unpaid, and it
          stays the treasurer's because a standing list naming who is behind
          turns a shared account into a public debt notice at the table. */}
      {isTreasurer && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
          <SectionTitle onCard>Udestående bøder pr. medlem · kun kassereren</SectionTitle>
          {stillOwed.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              {totals.incurred === 0
                ? 'Ingen bøder registreret endnu.'
                : 'Alle registrerede bøder er betalt.'}
            </p>
          ) : (
            <ul className="mt-2">
              {stillOwed.map((o) => (
                <li
                  key={o.member}
                  className="flex items-baseline justify-between border-b border-line py-2 text-xs last:border-0"
                >
                  <span>{o.member}</span>
                  <span className="ek-figure text-[0.95rem]">{kr(o.kr)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* "længere nede", as asked (Lukas, 2026-07-30) — under the curve and the
          fine insights, above the two ledger tables it is a summary of. */}
      <IncomeMix quarters={quarterMix} undatedKr={undatedKr} />

      {quarters.length > 0 && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
          <SectionTitle onCard>Kvartalsvis opkrævning</SectionTitle>
          <ul className="mt-2">
            {quarters.map((q) => (
              <li
                key={q.quarter}
                className="flex items-baseline justify-between border-b border-line py-2 text-xs last:border-0"
              >
                <span className="tabular">{q.quarter}</span>
                <span className="ek-figure text-[0.95rem]">{kr(q.kr)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ledger.length > 0 && (
        <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
          {/* Also the chart's table view: every value the curves and the hover
              readout show is here in text, so nothing on this page can only be
              read by having a mouse or seeing a colour. */}
          <SectionTitle onCard>Måned for måned</SectionTitle>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
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
                    <td className="py-1.5">{m.month}</td>
                    <td className="py-1.5 text-right">{kr(m.expected)}</td>
                    <td className="py-1.5 text-right">{kr(m.received)}</td>
                    {/* Ink and semibold rather than blue: the running balance
                        is the column that matters and it says so by weight, on
                        a page where blue now means the curve and the buttons. */}
                    <td className="py-1.5 text-right font-semibold text-ink">
                      {kr(m.outstanding)}
                    </td>
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

      {/* The dashed line's table view, and a separate table on purpose: the one
          above is money, this one is a plan. The column names are the
          spreadsheet's own — `Forventede bøder`, `Forventet beholdning` — so a
          member who knew *Klubbens finanser* recognises what came back. */}
      {budgetMonths.length > 0 && (
        <section data-reveal className="rounded-2xl border border-dashed border-accent-d bg-surface p-4">
          <SectionTitle onCard>Budget · forventede bøder</SectionTitle>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
            Ikke penge klubben har. Det er, hvad kontingentet og et gennemsnitligt
            møde giver, hvis klubben fortsætter som hidtil.
          </p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-faint">
                  <th className="text-left font-normal">Måned</th>
                  <th className="text-right font-normal">Kontingent</th>
                  <th className="text-right font-normal">Forventede bøder</th>
                  <th className="text-right font-normal">Forventet beholdning</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {budgetMonths.map((m) => (
                  <tr key={m.month} className="border-t border-line">
                    <td className="py-1.5">{m.month}</td>
                    <td className="py-1.5 text-right">{kr(m.dues)}</td>
                    <td className="py-1.5 text-right font-semibold text-ink">
                      {kr(m.budgetedFines)}
                    </td>
                    <td className="py-1.5 text-right">{kr(m.expectedBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
