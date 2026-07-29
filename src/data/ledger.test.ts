import {
  balancesByMember, buildLedger, monthsBetween, quarterOf, quarterlyTotals,
  type FineRecord,
} from './ledger'
import { canBeFined, payingMembers, type MemberStatus } from './members'
import { duesForMonth } from './rules'

describe('month arithmetic', () => {
  test('spans a year boundary', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  test('a single month is one month', () => {
    expect(monthsBetween('2026-06', '2026-06')).toEqual(['2026-06'])
  })
  test('an inverted range is empty rather than infinite', () => {
    expect(monthsBetween('2026-06', '2026-01')).toEqual([])
  })
})

describe('quarters', () => {
  test('map months to the quarter they are collected in', () => {
    expect(['2026-01', '2026-03', '2026-04', '2026-12'].map(quarterOf)).toEqual([
      '2026-Q1', '2026-Q1', '2026-Q2', '2026-Q4',
    ])
  })
})

describe('the ledger', () => {
  test('reproduces the real sheet history', () => {
    // The migration is only trustworthy if it reproduces the known past. These
    // are the actual figures from "Klubbens finanser": 8 active members at
    // 100 kr through May 26, then 9 at 200 kr from June — the month the club
    // voted to double the fee.
    const fines: FineRecord[] = [
      { month: '2026-01', member_name: 'Mads', amount_kr: 475 },
      { month: '2026-02', member_name: 'Emil', amount_kr: 50 },
    ]
    const ledger = buildLedger({
      from: '2026-01', to: '2026-06',
      fines,
      payments: [
        { month: '2026-01', amount_kr: 800 },
        { month: '2026-02', amount_kr: 2480 },
        { month: '2026-03', amount_kr: 800 },
        { month: '2026-04', amount_kr: 900 },
        { month: '2026-05', amount_kr: 900 },
        { month: '2026-06', amount_kr: 1800 },
      ],
      payingMembers: (m) => (m >= '2026-06' ? 9 : 8),
    })

    const jan = ledger.find((l) => l.month === '2026-01')!
    expect(jan.dues).toBe(800)
    expect(jan.fines).toBe(475)

    const jun = ledger.find((l) => l.month === '2026-06')!
    expect(jun.dues).toBe(1800) // 9 × 200, the doubled fee
  })

  test('carries balances forward', () => {
    const ledger = buildLedger({
      from: '2026-01', to: '2026-03',
      fines: [],
      payments: [{ month: '2026-01', amount_kr: 800 }],
      payingMembers: () => 8,
    })
    expect(ledger.map((l) => l.expectedBalance)).toEqual([800, 1600, 2400])
    expect(ledger.map((l) => l.actualBalance)).toEqual([800, 800, 800])
  })

  test('outstanding is what the club is owed, and it accumulates', () => {
    // This is the number that quietly grew unnoticed in the spreadsheet. It has
    // to be a reported figure, not something you work out by squinting at two
    // columns.
    const ledger = buildLedger({
      from: '2026-01', to: '2026-03',
      fines: [{ month: '2026-02', member_name: 'Mads', amount_kr: 100 }],
      payments: [{ month: '2026-01', amount_kr: 800 }],
      payingMembers: () => 8,
    })
    expect(ledger.map((l) => l.outstanding)).toEqual([0, 900, 1700])
  })

  test('a month with no fines and no payment still appears', () => {
    // A missing row would silently shorten the year and make the balance wrong.
    const ledger = buildLedger({
      from: '2026-01', to: '2026-03', fines: [], payments: [], payingMembers: () => 0,
    })
    expect(ledger.map((l) => l.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(ledger.every((l) => l.expected === 0)).toBe(true)
  })

  test('nothing is stored, so the total always equals its parts', () => {
    // The 50 kr discrepancy in the old sheet existed because a total was typed
    // rather than derived. Here the two cannot disagree by construction.
    const fines: FineRecord[] = [
      { month: '2026-01', member_name: 'Mads', amount_kr: 200 },
      { month: '2026-01', member_name: 'Emil', amount_kr: 55 },
      { month: '2026-02', member_name: 'Mads', amount_kr: 50 },
    ]
    const ledger = buildLedger({
      from: '2026-01', to: '2026-02', fines, payments: [], payingMembers: () => 0,
    })
    const ledgerTotal = ledger.reduce((n, l) => n + l.fines, 0)
    const gridTotal = balancesByMember(fines).reduce((n, b) => n + b.kr, 0)
    expect(ledgerTotal).toBe(gridTotal)
    expect(ledgerTotal).toBe(305)
  })
})

describe('per member', () => {
  test('totals what each owes, most owing first', () => {
    expect(
      balancesByMember([
        { month: '2026-01', member_name: 'Mads', amount_kr: 200 },
        { month: '2026-02', member_name: 'Mads', amount_kr: 185 },
        { month: '2026-01', member_name: 'Saaby', amount_kr: 335 },
      ]),
    ).toEqual([
      { member: 'Mads', kr: 385 },
      { member: 'Saaby', kr: 335 },
    ])
  })
})

describe('quarterly collection', () => {
  test('groups fines into the quarter the treasurer collects them in', () => {
    expect(
      quarterlyTotals([
        { month: '2026-01', member_name: 'A', amount_kr: 100 },
        { month: '2026-03', member_name: 'B', amount_kr: 50 },
        { month: '2026-04', member_name: 'C', amount_kr: 200 },
      ]),
    ).toEqual([
      { quarter: '2026-Q1', kr: 150 },
      { quarter: '2026-Q2', kr: 200 },
    ])
  })
})

/**
 * The membership status the ledger now turns on (T069).
 *
 * `payingMembers` used to be handed `roster.length` — every name that had ever
 * appeared in `attendances`. The tests below pin the two halves of the fix: the
 * count comes from who pays, and the club's imported history still reconciles
 * to the krone once it does.
 */
describe('who gets charged', () => {
  test('kontingent is charged to the members who pay, not to the roster', () => {
    const roster: (MemberStatus | null)[] = [
      // The club as it stands: nine active, one founding father, and one name
      // the attendance history holds that no member row claims.
      ...Array<MemberStatus>(9).fill('aktiv'), 'founding-father', null,
    ]
    const ledger = buildLedger({
      from: '2026-06', to: '2026-06',
      fines: [], payments: [],
      payingMembers: () => payingMembers(roster),
    })
    // 9 × 200, not 11 × 200. The two left out are the whole point.
    expect(ledger[0].dues).toBe(1800)
    expect(duesForMonth('2026-06', roster.length)).toBe(2200)
  })

  test('a founding father is charged nothing, in any month, at either rate', () => {
    const onlyHim: (MemberStatus | null)[] = ['founding-father']
    const ledger = buildLedger({
      from: '2025-06', to: '2026-06',
      fines: [], payments: [],
      payingMembers: () => payingMembers(onlyHim),
    })
    expect(ledger.every((m) => m.dues === 0)).toBe(true)
    // And no fine can reach him either — the other half of §12's exemption,
    // enforced where fines are captured. Stated here too because a ledger that
    // charged him nothing and a screen that fined him anyway would still leave
    // him owing money.
    expect(canBeFined('founding-father')).toBe(false)
  })
})

describe('the imported history (T068) after the members table (T069)', () => {
  test('still reconciles to 13.280 kr. paid and 1.730 kr. of fines', () => {
    // The two totals the whole import is judged by. They are facts about the
    // rows, so no change to who is charged may move them — if this drifts, the
    // members work has damaged the club's books rather than its arithmetic.
    const payments = [
      800, 800, 800, 800, 800, 800, 800, 800, 2480, 800, 900, 900, 1800,
    ].map((amount_kr, i) => ({
      month: `${i < 7 ? 2025 : 2026}-${String(((i + 5) % 12) + 1).padStart(2, '0')}`,
      amount_kr,
    }))
    const fines: FineRecord[] = [
      ['Kasper', 100], ['Rasmus', 95], ['Anders', 80],
      ['Kasper', 105], ['Emil', 50], ['Rasmus', 50], ['Mads', 200],
      ['Emil', 75], ['Saaby', 75], ['Esben', 155],
      ['Saaby', 200], ['Esben', 70],
      ['Kasper', 60], ['Emil', 110], ['Mads', 185], ['Saaby', 60], ['Esben', 60],
    ].map(([member_name, amount_kr]) => ({
      month: '2026-01', member_name: member_name as string, amount_kr: amount_kr as number,
    }))

    expect(fines).toHaveLength(17)
    expect(payments).toHaveLength(13)
    expect(payments.reduce((n, p) => n + p.amount_kr, 0)).toBe(13280)
    expect(balancesByMember(fines).reduce((n, b) => n + b.kr, 0)).toBe(1730)

    // And through the ledger, with the club's nine payers: every krone that
    // arrived is still counted, and every krone of fines is still owed.
    const club: (MemberStatus | null)[] = [
      ...Array<MemberStatus>(9).fill('aktiv'), 'founding-father',
    ]
    const ledger = buildLedger({
      from: '2025-06', to: '2026-06',
      fines, payments,
      payingMembers: () => payingMembers(club),
    })
    const last = ledger[ledger.length - 1]
    expect(last.actualBalance).toBe(13280)
    expect(ledger.reduce((n, m) => n + m.fines, 0)).toBe(1730)
    // Twelve months at 100 kr. and one at 200, nine members: 12.600 kr. of
    // kontingent. It was 14.000 while the roster was being charged.
    expect(last.expectedBalance - 1730).toBe(12600)
  })
})
