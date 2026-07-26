import { DUES_SCHEDULE, FINE_RULES, duesFor, duesForMonth, fineAmount } from './rules'

describe('fine amounts', () => {
  test('match the regulation', () => {
    const byId = Object.fromEntries(FINE_RULES.map((r) => [r.id, r.kr]))
    expect(byId).toEqual({
      udeblivelse: 200,
      'sent-afbud': 100,
      'for-sent': 50,
      drikkevare: 50,
      skaal: 50,
    })
  })

  test('late arrival is 50 kr plus 5 kr per minute', () => {
    const late = FINE_RULES.find((r) => r.id === 'for-sent')!
    expect(fineAmount(late, 0)).toBe(50)
    expect(fineAmount(late, 1)).toBe(55)
    expect(fineAmount(late, 12)).toBe(110)
  })

  test('only late arrival has a per-minute component', () => {
    for (const rule of FINE_RULES.filter((r) => r.id !== 'for-sent')) {
      expect(fineAmount(rule, 30)).toBe(rule.kr)
    }
  })

  test('minutes cannot reduce a fine', () => {
    // A negative or fractional value must never make someone owe less than the
    // base amount — it would be a quiet way to under-charge.
    const late = FINE_RULES.find((r) => r.id === 'for-sent')!
    expect(fineAmount(late, -10)).toBe(50)
    expect(fineAmount(late, 2.9)).toBe(60)
  })

  test('the two waivable rules are the two the regulation allows', () => {
    expect(FINE_RULES.filter((r) => r.waiver).map((r) => r.id).sort()).toEqual([
      'drikkevare',
      'for-sent',
    ])
  })
})

describe('membership dues', () => {
  test('follow the vote, not the stale document', () => {
    expect(duesFor('2026-05')).toBe(100)
    expect(duesFor('2026-06')).toBe(200)
    expect(duesFor('2027-01')).toBe(200)
  })

  test('reconcile against the real sheet history', () => {
    // The sheet shows 800 kr/month at 8 active members before the change, and
    // 1,800 kr from June 26 at 9 × 200. If this stops matching, the migration
    // of past months is wrong and every later balance is wrong with it.
    expect(duesForMonth('2026-05', 8)).toBe(800)
    expect(duesForMonth('2026-06', 9)).toBe(1800)
  })

  test('only active members pay — §3', () => {
    expect(duesForMonth('2026-06', 0)).toBe(0)
    expect(duesForMonth('2026-06', 5)).toBe(1000)
  })

  test('the schedule is ordered, so the lookup stays correct', () => {
    const froms = DUES_SCHEDULE.map((r) => r.from)
    expect([...froms].sort()).toEqual(froms)
  })
})
