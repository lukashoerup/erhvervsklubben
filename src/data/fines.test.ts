import { describe, expect, it } from 'vitest'
import {
  byOffence,
  daMinutes,
  fineTotals,
  incomeByQuarter,
  latenessFacts,
  outstandingByMember,
  type FineRow,
} from './fines'
import { FINE_RULES, fineAmount } from './rules'

/**
 * The fine book, and the conflation that put 2.510 kr. under the word
 * *udestående* on the club's own finance page.
 *
 * Lukas found it by reading the page: *"Der står i toppen af økonomisiden at der
 * er udestående bøder på 2510 kr. Det passer ikke."* The bug was not arithmetic —
 * every number was correctly computed — it was that one number was doing the job
 * of three, and the label picked the wrong one.
 *
 * The club's own eight fine-bearing evenings are pinned below rather than
 * described, the same way T075 pinned the classified fines and T076 pinned the
 * bank statement: **the test that would have caught this is one where a
 * fully-collected fine cannot appear in an outstanding total.** It is the last
 * assertion in the first block.
 */

/** `for-sent` is 50 + 5·minutes, so a fixture that lies about it is caught below. */
const late = (member: string, record: number, minutes: number, settled: string | null): FineRow => ({
  member_name: member,
  amount_kr: 50 + 5 * minutes,
  record_id: record,
  rule_id: 'for-sent',
  minutes,
  settled_at: settled,
})

const flat = (member: string, record: number, rule: string, settled: string | null): FineRow => ({
  member_name: member,
  amount_kr: 50,
  record_id: record,
  rule_id: rule,
  minutes: null,
  settled_at: settled,
})

const SETTLED = '2026-02-16'

/**
 * The club's real fine book, in miniature: two evenings collected in the February
 * 2026 round, one evening noted and never billed.
 */
const BOOK: FineRow[] = [
  late('Mads', 21, 30, SETTLED), // 200
  late('Saaby', 21, 6, SETTLED), //  80
  flat('Emil', 21, 'skaal', SETTLED), //  50
  late('Kasper', 25, 11, SETTLED), // 105
  flat('Lukas', 26, 'frivillig', SETTLED), //  50  transferred himself
  late('Mads', 26, 21, null), // 155
  flat('Have', 26, 'drikkevare', null), //  50
]

describe('the three quantities a fine book has', () => {
  it('keeps incurred, collected and outstanding apart', () => {
    const t = fineTotals(BOOK)
    expect(t.incurredKr).toBe(690)
    expect(t.collectedKr).toBe(485)
    expect(t.outstandingKr).toBe(205)
    // The identity that has to hold, or one of the three is wrong.
    expect(t.collectedKr + t.outstandingKr).toBe(t.incurredKr)
    expect(t.collected + t.outstanding).toBe(t.incurred)
  })

  /**
   * The regression, stated as plainly as it can be.
   *
   * This is the assertion whose absence let the page print every fine the club
   * had ever charged under the heading "udestående" for three days.
   */
  it('never counts a fully-collected fine as outstanding', () => {
    const allPaid = BOOK.map((f) => ({ ...f, settled_at: SETTLED }))
    expect(fineTotals(allPaid).outstandingKr).toBe(0)
    expect(outstandingByMember(allPaid)).toEqual([])
    // And the incurred figure does not move when money is collected: what a
    // member was fined is a fact about the evening, not about the transfer.
    expect(fineTotals(allPaid).incurredKr).toBe(fineTotals(BOOK).incurredKr)
  })

  it('treats a fine nobody has marked as paid as money the club is owed', () => {
    // Null is the safe default and the direction matters: a database that has not
    // run the migration under-claims what the club has collected rather than
    // over-claiming it.
    const nothingMarked = BOOK.map((f) => ({ ...f, settled_at: null }))
    const t = fineTotals(nothingMarked)
    expect(t.outstandingKr).toBe(t.incurredKr)
    expect(t.collectedKr).toBe(0)
  })

  it('bills a member only for what he still owes', () => {
    // Mads has 200 kr. collected and 155 kr. open. A collection list that shows
    // 355 asks him twice for the 200.
    expect(outstandingByMember(BOOK)).toEqual([
      { member: 'Mads', kr: 155 },
      { member: 'Have', kr: 50 },
    ])
  })

  it('leaves an empty book at zero rather than undefined', () => {
    expect(fineTotals([])).toMatchObject({ incurredKr: 0, collectedKr: 0, outstandingKr: 0 })
  })
})

describe('what the offences cost, and who incurred them', () => {
  it('makes the offence the subject and the members its composition', () => {
    const rows = byOffence(BOOK)
    // Sorted by cost, because "hvilke forseelser der er givet højeste bøder" is
    // the question that was asked.
    // Ties fall back to the regulation's own order and then to "not a rule the
    // club voted", so three 50 kr. singletons come out drikkevare, skaal,
    // frivillig every render — the bars never reorder between paints.
    expect(rows.map((r) => r.ruleId)).toEqual(['for-sent', 'drikkevare', 'skaal', 'frivillig'])
    expect(rows[0]).toMatchObject({ kr: 540, count: 4, minutes: 68 })
    // The regulation's own words, not a slug.
    expect(rows[0].offence).toBe('For sent fremmøde')
    expect(rows[0].members).toEqual([
      { name: 'Mads', kr: 355, count: 2, minutes: 51 },
      { name: 'Kasper', kr: 105, count: 1, minutes: 11 },
      { name: 'Saaby', kr: 80, count: 1, minutes: 6 },
    ])
  })

  it('sums to the same total as the book itself', () => {
    const rows = byOffence(BOOK)
    expect(rows.reduce((n, r) => n + r.kr, 0)).toBe(fineTotals(BOOK).incurredKr)
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(BOOK.length)
    // And a member's share of an offence sums to that offence.
    for (const r of rows) {
      expect(r.members.reduce((n, m) => n + m.kr, 0)).toBe(r.kr)
    }
  })

  it('names a rule this build has never heard of instead of leaving it blank', () => {
    // `fines.rule_id` is text so the club can vote in a rule without a
    // migration, which means a row can always name one this build lacks.
    const rows = byOffence([flat('Emil', 30, 'ny-regel-2027', null)])
    expect(rows[0].offence).toBe('Ukendt bøderegel (ny-regel-2027)')
  })

  it('counts every historic and voluntary row rather than dropping it', () => {
    // Neither is a member of FINE_RULES — they cannot be charged under — but both
    // are real money and have to appear in a total of the club's fines.
    const rows = byOffence(BOOK)
    expect(rows.find((r) => r.ruleId === 'frivillig')?.kr).toBe(50)
  })
})

describe('the club’s lateness, as a fact about the club', () => {
  it('adds up every minute and counts the members who contributed', () => {
    const late = latenessFacts(BOOK)
    expect(late.minutes).toBe(68)
    expect(late.arrivals).toBe(4)
    expect(late.members).toBe(3)
    expect(late.worstMinutes).toBe(30)
  })

  it('states lateness as a share of the whole book', () => {
    // 540 of 690. The point of printing it is that it is most of the money, and
    // the bar being longest is therefore the finding rather than a scaling
    // problem to be smoothed away.
    expect(latenessFacts(BOOK).shareOfKr).toBeCloseTo(540 / 690)
  })

  it('says nothing rather than dividing by zero on an empty book', () => {
    expect(latenessFacts([])).toMatchObject({ minutes: 0, arrivals: 0, shareOfKr: 0 })
  })

  it('reads minutes out the way a Dane says them', () => {
    expect(daMinutes(0)).toBe('0 min')
    expect(daMinutes(59)).toBe('59 min')
    expect(daMinutes(120)).toBe('2 t')
    expect(daMinutes(202)).toBe('3 t 22 min')
  })
})

/**
 * Every fixture amount above is what the club's own regulation charges.
 *
 * The same guard T075 put on the historical import: if `FINE_RULES` is ever
 * amended without dating the change, these amounts stop reproducing and the suite
 * goes red. A rate change must never silently rewrite what a member was charged.
 */
describe('the fixtures obey the regulation', () => {
  it.each(BOOK.filter((f) => f.rule_id === 'for-sent'))(
    'charges $member_name 50 + 5·$minutes',
    (f) => {
      const rule = FINE_RULES.find((r) => r.id === 'for-sent')!
      expect(f.amount_kr).toBe(fineAmount(rule, f.minutes ?? 0))
    },
  )
})

describe('where the club’s money comes from, per quarter', () => {
  const dues = [
    { month: '2026-01', dues: 800 },
    { month: '2026-02', dues: 800 },
    { month: '2026-03', dues: 800 },
    { month: '2026-04', dues: 800 },
  ]

  it('groups months into the quarters the regulation collects in', () => {
    const q = incomeByQuarter(dues, [
      { month: '2026-02', rule_id: 'for-sent', amount_kr: 200 },
      { month: '2026-02', rule_id: 'skaal', amount_kr: 50 },
      { month: '2026-04', rule_id: 'for-sent', amount_kr: 105 },
    ])
    expect(q).toEqual([
      { quarter: '2026-Q1', total: 2650, dues: 2400, 'for-sent': 200, skaal: 50, other: 0 },
      { quarter: '2026-Q2', total: 905, dues: 800, 'for-sent': 105, skaal: 0, other: 0 },
    ])
  })

  it('folds the two-krone tail into one segment rather than drawing slivers', () => {
    // `drikkevare` and `frivillig` are one 50 kr. fine each in the club's whole
    // history. Drawn separately they are two pixels; folded they are legible and
    // the table under the chart still itemises them.
    const q = incomeByQuarter(dues.slice(0, 1), [
      { month: '2026-01', rule_id: 'drikkevare', amount_kr: 50 },
      { month: '2026-01', rule_id: 'frivillig', amount_kr: 50 },
      { month: '2026-01', rule_id: 'historisk', amount_kr: 50 },
    ])
    expect(q[0].other).toBe(150)
    expect(q[0].total).toBe(950)
  })

  it('leaves a fine with no month out of every quarter rather than guessing one', () => {
    // Eleven of the club's 28 meetings still have no date. A fine on one of them
    // belongs to no quarter, and dropping it into an arbitrary one would misstate
    // that quarter — the same rule the ledger above it already follows.
    const q = incomeByQuarter(dues.slice(0, 1), [
      { month: '', rule_id: 'for-sent', amount_kr: 200 },
    ])
    expect(q).toHaveLength(1)
    expect(q[0].total).toBe(800)
  })

  it('runs oldest quarter first, whatever order the rows arrive in', () => {
    const q = incomeByQuarter(
      [
        { month: '2026-07', dues: 1800 },
        { month: '2025-06', dues: 800 },
      ],
      [],
    )
    expect(q.map((r) => r.quarter)).toEqual(['2025-Q2', '2026-Q3'])
  })
})
