import {
  DUES_SCHEDULE,
  FINE_RULES,
  HISTORIC_RULE_ID,
  describeRule,
  duesFor,
  duesForMonth,
  fineAmount,
} from './rules'

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

describe('rule ids this build does not know', () => {
  // The 17 fines imported from the old spreadsheet (T068) all carry
  // 'historisk', because the sheet stored amounts and never which offence
  // produced them. The page must say so rather than render a blank reason.
  test('the historic import describes itself', () => {
    expect(describeRule(HISTORIC_RULE_ID)).toBe('Historisk bøde — forseelse ikke registreret')
  })

  test('never offered as something to charge', () => {
    // It has no amount and the club never voted it. If it ever reaches
    // FINE_RULES it becomes tappable in the capture UI, and a Lead can fine a
    // member for nothing in particular.
    expect(FINE_RULES.map((r) => r.id)).not.toContain(HISTORIC_RULE_ID)
  })

  test('a future rule id renders as unknown and keeps its id', () => {
    // rule_id is text so the club can vote in a rule without a migration, so
    // an id from the future is a normal thing to read, not a bug. Blank would
    // read as "no reason given"; this reads as "not known here", and carries
    // the id someone debugging needs.
    expect(describeRule('mobil-ved-bordet')).toBe('Ukendt bøderegel (mobil-ved-bordet)')
  })

  test('known rules still describe as the regulation words them', () => {
    expect(describeRule('udeblivelse')).toBe('Udeblivelse uden afbud')
    expect(describeRule('for-sent')).toBe('For sent fremmøde')
  })

  test('never blank, whatever it is given', () => {
    for (const id of ['', 'historisk', 'udeblivelse', 'x', '../../etc']) {
      expect(describeRule(id).trim().length).toBeGreaterThan(0)
    }
  })
})
