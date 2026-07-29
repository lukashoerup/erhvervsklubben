import { describe, expect, it } from 'vitest'
import {
  budgetFines,
  budgetHorizon,
  budgetLimits,
  cadenceFrom,
  fineWindow,
  projectBudget,
  type MeetingFines,
} from './projection'

/**
 * The club's real books, as the finance import left them (T068).
 *
 * Five meetings carry fines — records 21–25, numbers 21–25 — and the three
 * meetings after them carry none. Whether those three were quiet evenings or
 * unrecorded ones is docs/finance-reconciliation.md §9 Q10, still open, and the
 * arithmetic below is built so the answer does not change the figure much.
 */
const CLUB: MeetingFines[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ number: i + 1, kr: 0 })),
  { number: 21, kr: 275 },
  { number: 22, kr: 405 },
  { number: 23, kr: 305 },
  { number: 24, kr: 270 },
  { number: 25, kr: 475 },
  { number: 26, kr: 0 },
  { number: 27, kr: 0 },
  { number: 28, kr: 0 },
]

describe('the window the average is taken over', () => {
  it('runs from the first fine-bearing meeting to the last, inclusive', () => {
    expect(fineWindow(CLUB).map((m) => m.number)).toEqual([21, 22, 23, 24, 25])
  })

  it('keeps a quiet evening that sits between two noisy ones', () => {
    const quiet = fineWindow([
      { number: 1, kr: 0 },
      { number: 2, kr: 300 },
      { number: 3, kr: 0 },
      { number: 4, kr: 100 },
      { number: 5, kr: 0 },
    ])
    // Meeting 3 counts — the club was demonstrably recording either side of it.
    // Meetings 1 and 5 do not: nothing says the fine box existed yet, or still.
    expect(quiet.map((m) => m.number)).toEqual([2, 3, 4])
    expect(quiet.reduce((n, m) => n + m.kr, 0)).toBe(400)
  })

  it('is empty on a database with no fines at all', () => {
    expect(fineWindow([{ number: 1, kr: 0 }, { number: 2, kr: 0 }])).toEqual([])
    expect(fineWindow([])).toEqual([])
  })
})

describe('the budget, from the club’s own five dinners', () => {
  const budget = budgetFines({ meetings: CLUB, meetingDates: [] })

  it('averages per meeting: 1.730 kr. over five evenings', () => {
    expect(budget.observedKr).toBe(1730)
    expect(budget.meetingsInWindow).toBe(5)
    expect(budget.perMeetingKr).toBe(346)
  })

  it('turns that into a month with §9’s cadence, not with a month count', () => {
    expect(budget.cadenceSource).toBe('rule')
    expect(budget.cadenceMonths).toBe(2)
    expect(budget.perMonthKr).toBe(173)
  })

  it('is stated as a usable basis rather than as thin', () => {
    expect(budget.basis).toBe('ok')
  })
})

/**
 * The reason the unit is the evening and not the month.
 *
 * A per-month mean answers a different question depending on how many
 * meeting-free months happen to be inside the window — and the window is
 * whatever range the page is drawing. Same five dinners, same 1.730 kr., two
 * answers. Dividing by meetings makes the empty months irrelevant, which is
 * what they are.
 */
describe('the burst problem', () => {
  const bursty: MeetingFines[] = [
    { number: 1, kr: 400 },
    { number: 2, kr: 400 },
    { number: 3, kr: 400 },
  ]

  it('does not move when meeting-free months are added around the history', () => {
    const short = budgetFines({ meetings: bursty, meetingDates: [] })
    const long = budgetFines({
      // The club recorded three more evenings, years earlier, with no fine box.
      meetings: [{ number: -2, kr: 0 }, { number: -1, kr: 0 }, ...bursty],
      meetingDates: [],
    })
    expect(short.perMeetingKr).toBe(400)
    expect(long.perMeetingKr).toBe(400)
    expect(short.perMonthKr).toBe(long.perMonthKr)
  })

  it('budgets an evening at its own size, not at a month’s share of it', () => {
    const budget = budgetFines({ meetings: bursty, meetingDates: [] })
    // 400 kr. is what a dinner costs. 200 kr. is what that averages to per
    // month at §9's cadence — and the difference between the two numbers is
    // the whole point: the first is charged, the second is only budgeted.
    expect(budget.perMeetingKr).toBe(400)
    expect(budget.perMonthKr).toBe(200)
  })

  it('spreads the budget evenly instead of guessing which months hold a dinner', () => {
    const budget = budgetFines({ meetings: bursty, meetingDates: [] })
    const months = projectBudget({
      after: '2026-06',
      months: 4,
      openingBalance: 0,
      budget,
      payingMembers: () => 0,
    })
    // Every month carries the same figure. Putting 400 kr. on alternate months
    // would look more like the club's reality and be a claim the app cannot
    // support: with 28 undated meetings, nothing here knows which months hold
    // a dinner. Four months of budget still comes to two dinners' worth.
    expect(months.map((m) => m.budgetedFines)).toEqual([200, 200, 200, 200])
    expect(months.reduce((n, m) => n + m.budgetedFines, 0)).toBe(2 * 400)
  })
})

describe('thin and empty history', () => {
  it('says nothing rather than budgeting zero when there are no fines', () => {
    const budget = budgetFines({
      meetings: [{ number: 1, kr: 0 }, { number: 2, kr: 0 }],
      meetingDates: [],
    })
    expect(budget.basis).toBe('none')
    expect(budget.perMonthKr).toBe(0)
    expect(budgetLimits({ meetings: 2, undatedMeetings: 2, budget })).toEqual([
      'Der er ingen registrerede bøder at regne et gennemsnit på, så der budgetteres ikke med noget.',
    ])
  })

  it('survives an empty database entirely', () => {
    const budget = budgetFines({ meetings: [], meetingDates: [] })
    expect(budget).toMatchObject({ basis: 'none', perMeetingKr: 0, perMonthKr: 0 })
    expect(
      projectBudget({ after: '2026-06', openingBalance: 0, budget, payingMembers: () => 0 }),
    ).toHaveLength(12)
  })

  it('flags a single evening as thin rather than hiding it', () => {
    const budget = budgetFines({ meetings: [{ number: 9, kr: 500 }], meetingDates: [] })
    expect(budget.basis).toBe('thin')
    expect(budget.perMeetingKr).toBe(500)
    expect(budgetLimits({ meetings: 9, undatedMeetings: 9, budget }).join(' ')).toContain(
      'Grundlaget er tyndt',
    )
  })
})

describe('the cadence', () => {
  it('falls back to §9 while the meetings have no dates', () => {
    expect(cadenceFrom([])).toEqual({ months: 2, source: 'rule' })
    expect(cadenceFrom(['2026-01-10'])).toEqual({ months: 2, source: 'rule' })
    // Two dates is one gap, and §9 lets the club decide frequency meeting by
    // meeting — so one short interval must not set a year's budget.
    expect(cadenceFrom(['2026-01-10', '2026-02-10'])).toEqual({ months: 2, source: 'rule' })
  })

  it('is measured once the club’s own dates can carry it', () => {
    const measured = cadenceFrom(['2026-01-10', '2026-03-12', '2026-05-14', '2026-07-02'])
    expect(measured).toEqual({ months: 2, source: 'dates' })
  })

  it('follows a club that meets more often than the rule says', () => {
    const monthly = cadenceFrom(['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10'])
    expect(monthly.source).toBe('dates')
    expect(monthly.months).toBe(1)
    const budget = budgetFines({
      meetings: [{ number: 1, kr: 300 }, { number: 2, kr: 300 }, { number: 3, kr: 300 }],
      meetingDates: ['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10'],
    })
    // Same evenings, twice as often, so twice the monthly budget.
    expect(budget.perMonthKr).toBe(300)
  })
})

describe('the projected months', () => {
  const budget = budgetFines({ meetings: CLUB, meetingDates: [] })

  it('starts the month after the books end and carries the balance forward', () => {
    const months = projectBudget({
      after: '2026-06',
      months: 3,
      openingBalance: 12600,
      budget,
      payingMembers: () => 9,
    })
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    // 9 × 200 kr. kontingent (§4 Stk. 3 from June 2026) + 173 kr. of budget.
    expect(months[0]).toEqual({
      month: '2026-07',
      dues: 1800,
      budgetedFines: 173,
      expectedBalance: 12600 + 1973,
    })
    expect(months[2].expectedBalance).toBe(12600 + 3 * 1973)
  })

  it('rolls the year over', () => {
    const months = projectBudget({
      after: '2026-12',
      months: 2,
      openingBalance: 0,
      budget,
      payingMembers: () => 0,
    })
    expect(months.map((m) => m.month)).toEqual(['2027-01', '2027-02'])
  })

  it('runs a financial year by default', () => {
    expect(
      projectBudget({ after: '2026-06', openingBalance: 0, budget, payingMembers: () => 9 }),
    ).toHaveLength(12)
  })

  it('carries no field that could be mistaken for money that arrived', () => {
    const [first] = projectBudget({
      after: '2026-06',
      months: 1,
      openingBalance: 0,
      budget,
      payingMembers: () => 9,
    })
    // The ledger's own shape has `received`, `actualBalance` and `outstanding`.
    // A budget month has none of them, so a projected month cannot be summed
    // into a real total by accident — the shapes do not fit.
    expect(Object.keys(first).sort()).toEqual([
      'budgetedFines',
      'dues',
      'expectedBalance',
      'month',
    ])
  })
})

describe('what the projection admits it cannot know', () => {
  const budget = budgetFines({ meetings: CLUB, meetingDates: [] })
  const said = budgetLimits({ meetings: 28, undatedMeetings: 28, budget }).join(' ')

  it('names the meetings the average rests on, not the months', () => {
    expect(said).toContain('pr. møde')
    expect(said).toContain('5 møder')
    expect(said).toContain('1.730 kr.')
  })

  it('says the cadence comes from the statutes because the dates are missing', () => {
    expect(said).toContain('§9')
    expect(said).toContain('28 af 28 møder har ingen dato')
  })

  it('never draws more forecast than there is record behind it', () => {
    // Five months of books cannot support a year of curve: two thirds of the
    // line would be invention, and the eye reads length as confidence.
    expect(budgetHorizon(5)).toBe(5)
    expect(budgetHorizon(13)).toBe(12)
    expect(budgetHorizon(0)).toBe(0)
    expect(projectBudget({
      after: '2026-06', months: budgetHorizon(5), openingBalance: 0, budget,
      payingMembers: () => 9,
    })).toHaveLength(5)
  })

  it('refuses to claim that this month will produce fines', () => {
    expect(said).toContain('Det siger ikke, at der kommer bøder i netop denne måned.')
  })
})
