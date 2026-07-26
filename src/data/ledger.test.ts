import {
  balancesByMember, buildLedger, monthsBetween, quarterOf, quarterlyTotals,
  type FineRecord,
} from './ledger'

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
      activeMembers: (m) => (m >= '2026-06' ? 9 : 8),
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
      activeMembers: () => 8,
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
      activeMembers: () => 8,
    })
    expect(ledger.map((l) => l.outstanding)).toEqual([0, 900, 1700])
  })

  test('a month with no fines and no payment still appears', () => {
    // A missing row would silently shorten the year and make the balance wrong.
    const ledger = buildLedger({
      from: '2026-01', to: '2026-03', fines: [], payments: [], activeMembers: () => 0,
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
      from: '2026-01', to: '2026-02', fines, payments: [], activeMembers: () => 0,
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
