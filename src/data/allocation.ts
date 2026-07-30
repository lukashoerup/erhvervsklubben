import { monthsBetween } from './ledger'
import { duesFor } from './rules'

/**
 * Turning bank transfers into the months they settle — the club's accrual rule.
 *
 * This is the one piece of the club's bookkeeping where the honest answer and
 * the flattering answer look identical from outside, so the rule is written
 * down before the code.
 *
 * **`payments.month` is the month a payment settles, not the month the money
 * arrived.** The column has always said so ("The month this settles, as the
 * first of that month" — `20260726180000_finance.sql`), and until the bank
 * statement arrived on 2026-07-30 nothing in the club's records could tell the
 * two apart. The statement can: seven of the club's first transfers are
 * retroactive and two of them say so in the transfer text (`Kasper jun-sep`,
 * `Emil juni-september`), and one member cleared twelve months in a single
 * 1.200 kr. transfer.
 *
 * So a catch-up transfer is spread across the months it was *for*, oldest
 * first. That is ordinary accrual accounting and it is not a cosmetic choice:
 *
 *   * **The bank total never moves.** Allocation redistributes a payment across
 *     months; it cannot create or destroy a krone. `settled` over the whole
 *     window equals the sum of the transfers inside it, and the suite asserts
 *     that on the club's real statement.
 *   * **What it changes is the monthly view**, which stops recording a member
 *     as eleven months delinquent and then wildly overpaid, and starts
 *     recording what actually happened: he owed those months, and those months
 *     are now paid.
 *
 * The line that matters, because it is the one that could be crossed quietly:
 * *allocated to the months it settles* is a statement about what a payment was
 * for, evidenced by the transfer text and by the arithmetic closing to the
 * krone. *Moved to make a graph look nice* is a statement about nothing. This
 * function does the first and cannot do the second — it never invents a
 * transfer, never changes an amount, and reports every krone it could not place
 * rather than absorbing it. See docs/finance-reconciliation.md §16.
 */

/** A transfer as the statement records it: a date, a payer, an amount. */
export type Transfer = {
  /** ISO date the money arrived. Ordering only — never the settlement month. */
  date: string
  member: string
  kr: number
}

/** One cell of the per-member-per-month grid the club has never had. */
export type Cell = { member: string; month: string; owed: number; settled: number }

export type Allocation = {
  months: string[]
  /** The grid, member-major then month. Only months the member is charged for. */
  grid: Cell[]
  byMonth: { month: string; payers: number; owed: number; settled: number; outstanding: number }[]
  byMember: {
    member: string
    owed: number
    settled: number
    outstanding: number
    /** Settled into months *after* the window — in the bank, not yet earned. */
    prepaid: number
  }[]
  owed: number
  settled: number
  outstanding: number
  prepaid: number
}

export type AllocationInput = {
  transfers: Transfer[]
  /**
   * First month the club charges each member, as YYYY-MM. A member absent from
   * this map is charged nothing and may not appear in `transfers` — the club's
   * founding father pays no kontingent (§12), and silently charging a name
   * because money arrived under it is the bug `members.status` was added to fix.
   */
  duesFrom: Record<string, string>
  /** First and last month of the window being reconciled, as YYYY-MM. */
  from: string
  through: string
  /** What one member owes for one month. Defaults to the §4 Stk. 3 rate. */
  rate?: (month: string) => number
  /**
   * How far past `through` a prepayment may reach before it is treated as an
   * error rather than as money paid early. A member who pays a year ahead is
   * possible; a member who pays five is a misattributed transfer, and a silent
   * absorption is exactly the kind of tidy-looking wrong answer this whole
   * exercise exists to avoid.
   */
  prepayMonths?: number
}

/**
 * Allocate transfers to the months they settle, oldest unpaid month first.
 *
 * FIFO rather than "the month it arrived in" because that is what the members
 * are actually doing, and the statement shows three different rhythms at once:
 * two members transfer at the end of month M for month M+1 (§4 Stk. 3 has
 * kontingent paid *in advance*), the rest transfer in the first week of M for M,
 * and one cleared a year of arrears in one go. A calendar-month reading of the
 * same statement reports the first group a month early, the third group as a
 * single 1.200 kr. spike, and the club as wildly ahead and then behind in
 * months where every member paid exactly what he owed.
 *
 * Throws if a transfer cannot be placed inside the window plus `prepayMonths`.
 * That is deliberate: money that will not fit means the model is wrong about
 * that member, and the club is owed a real answer rather than a rounded one.
 */
export function allocateDues(opts: AllocationInput): Allocation {
  const rate = opts.rate ?? duesFor
  const prepayMonths = opts.prepayMonths ?? 12
  const window = monthsBetween(opts.from, opts.through)
  const horizon = monthsBetween(opts.from, addMonths(opts.through, prepayMonths))

  // member -> month -> kr settled. Built over the horizon so a prepayment is
  // visible as such instead of vanishing at the window's edge.
  const settled = new Map<string, Map<string, number>>()
  const members = Object.keys(opts.duesFrom).sort((a, b) => a.localeCompare(b, 'da'))
  for (const m of members) settled.set(m, new Map())

  const owedIn = (member: string, month: string) =>
    month >= opts.duesFrom[member] ? rate(month) : 0

  for (const t of [...opts.transfers].sort(byDateThenMember)) {
    const own = settled.get(t.member)
    if (!own) {
      throw new Error(
        `${t.date}: ${t.kr} kr. from "${t.member}", who the club charges no kontingent. ` +
          'Attribute the transfer or add the member; do not let it settle a month.',
      )
    }
    let left = t.kr
    for (const month of horizon) {
      if (left <= 0) break
      const gap = owedIn(t.member, month) - (own.get(month) ?? 0)
      if (gap <= 0) continue
      const take = Math.min(left, gap)
      own.set(month, (own.get(month) ?? 0) + take)
      left -= take
    }
    if (left > 0) {
      throw new Error(
        `${t.date}: ${left} kr. of ${t.member}'s ${t.kr} kr. settles no month ` +
          `within ${prepayMonths} months of ${opts.through}. Unexplained — do not absorb it.`,
      )
    }
  }

  const grid: Cell[] = []
  for (const member of members) {
    for (const month of window) {
      const owed = owedIn(member, month)
      if (owed === 0) continue
      grid.push({ member, month, owed, settled: settled.get(member)!.get(month) ?? 0 })
    }
  }

  const byMonth = window.map((month) => {
    const cells = grid.filter((c) => c.month === month)
    const owed = sum(cells.map((c) => c.owed))
    const s = sum(cells.map((c) => c.settled))
    return { month, payers: cells.length, owed, settled: s, outstanding: owed - s }
  })

  const byMember = members.map((member) => {
    const cells = grid.filter((c) => c.member === member)
    const owed = sum(cells.map((c) => c.owed))
    const s = sum(cells.map((c) => c.settled))
    const prepaid = sum(
      [...settled.get(member)!.entries()].filter(([m]) => m > opts.through).map(([, v]) => v),
    )
    return { member, owed, settled: s, outstanding: owed - s, prepaid }
  })

  return {
    months: window,
    grid,
    byMonth,
    byMember,
    owed: sum(byMonth.map((m) => m.owed)),
    settled: sum(byMonth.map((m) => m.settled)),
    outstanding: sum(byMonth.map((m) => m.outstanding)),
    prepaid: sum(byMember.map((m) => m.prepaid)),
  }
}

/**
 * The `payments` rows an allocation implies: one per settlement month.
 *
 * `payments` has no member column and is not getting one — it records money
 * that moved, by the month it settles, and a per-transfer table would reconcile
 * against nothing the club keeps. Fine receipts are passed in separately rather
 * than allocated, because the fines themselves are already dated by meeting in
 * `fines`; see §16.4 for why re-spreading the receipt would state the same
 * money twice.
 */
export function paymentRows(
  allocation: Allocation,
  fineReceipts: { month: string; kr: number }[] = [],
): { month: string; amount_kr: number }[] {
  const fines = new Map<string, number>()
  for (const f of fineReceipts) fines.set(f.month, (fines.get(f.month) ?? 0) + f.kr)
  return allocation.byMonth.map((m) => ({
    month: m.month,
    amount_kr: m.settled + (fines.get(m.month) ?? 0),
  }))
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0)
}

function byDateThenMember(a: Transfer, b: Transfer): number {
  return a.date.localeCompare(b.date) || a.member.localeCompare(b.member, 'da')
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}
