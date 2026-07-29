import { duesForMonth } from './rules'

/**
 * The club's books, derived rather than kept.
 *
 * This replaces the spreadsheet's monthly ledger. Nothing here is stored: dues,
 * fines, expected balance and the gap against actual are all computed from the
 * fines and payments tables plus the active-member count.
 *
 * The 50 kr the sheet was blamed for was never a disagreement, and it is worth
 * correcting because the wrong lesson was drawn from it. Its monthly column said
 * 1,780 and its per-member grid summed to 1,730; both were right. The grid
 * breaks fines down across five dinners, the monthly list has six months with
 * fines in them, and one Lead's evening — February 2026, 50 kr — never got a
 * column in the grid. The money was charged and paid; a page simply never
 * counted it. See docs/finance-reconciliation.md.
 *
 * So deriving totals does not immunise us against that class of error. If a
 * meeting is never recorded here, every figure below is short by exactly the
 * same amount, computed just as confidently. What protects the books is that a
 * missing meeting is visible on Anciennitet, not that the arithmetic is live.
 */

export type FineRecord = { month: string; member_name: string; amount_kr: number }
export type PaymentRecord = { month: string; amount_kr: number; bank_balance_kr?: number | null }

export type LedgerMonth = {
  month: string
  dues: number
  fines: number
  /** What should have come in this month. */
  expected: number
  /** What actually arrived, as confirmed by the treasurer. */
  received: number
  expectedBalance: number
  actualBalance: number
  /** Positive means the club is owed money. */
  outstanding: number
}

/** Every month from `from` to `to` inclusive, as YYYY-MM. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

export function buildLedger(opts: {
  from: string
  to: string
  fines: FineRecord[]
  payments: PaymentRecord[]
  /**
   * How many members the club charges kontingent in a given month.
   *
   * Not the size of the roster, and the difference is why this is a question
   * rather than a number. §3 charges *aktive medlemmer* only, and the founding
   * father (§12, Lukas 2026-07-29) pays nothing while attending everything.
   * This was `roster.length` until 2026-07-29 — everyone who had ever turned
   * up — which made the expected-income line too high in every month the club
   * has ever had. Answer it from membership status; see data/members.ts.
   */
  payingMembers: (month: string) => number
}): LedgerMonth[] {
  const finesByMonth = new Map<string, number>()
  for (const f of opts.fines) {
    finesByMonth.set(f.month, (finesByMonth.get(f.month) ?? 0) + f.amount_kr)
  }
  const paidByMonth = new Map<string, number>()
  for (const p of opts.payments) {
    paidByMonth.set(p.month, (paidByMonth.get(p.month) ?? 0) + p.amount_kr)
  }

  let expectedBalance = 0
  let actualBalance = 0

  return monthsBetween(opts.from, opts.to).map((month) => {
    const dues = duesForMonth(month, opts.payingMembers(month))
    const fines = finesByMonth.get(month) ?? 0
    const expected = dues + fines
    const received = paidByMonth.get(month) ?? 0
    expectedBalance += expected
    actualBalance += received
    return {
      month,
      dues,
      fines,
      expected,
      received,
      expectedBalance,
      actualBalance,
      outstanding: expectedBalance - actualBalance,
    }
  })
}

/** What each member owes across the period, most owing first. */
export function balancesByMember(fines: FineRecord[]): { member: string; kr: number }[] {
  const by = new Map<string, number>()
  for (const f of fines) by.set(f.member_name, (by.get(f.member_name) ?? 0) + f.amount_kr)
  return [...by.entries()]
    .map(([member, kr]) => ({ member, kr }))
    .sort((a, b) => b.kr - a.kr || a.member.localeCompare(b.member, 'da'))
}

/**
 * The quarter a month belongs to, for the quarterly collection the regulation
 * requires (Stk. 3).
 */
export function quarterOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
}

/** Fines grouped into the quarters they will be collected in. */
export function quarterlyTotals(fines: FineRecord[]): { quarter: string; kr: number }[] {
  const by = new Map<string, number>()
  for (const f of fines) {
    const q = quarterOf(f.month)
    by.set(q, (by.get(q) ?? 0) + f.amount_kr)
  }
  return [...by.entries()].map(([quarter, kr]) => ({ quarter, kr })).sort((a, b) =>
    a.quarter.localeCompare(b.quarter),
  )
}
