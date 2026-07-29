import { duesForMonth } from './rules'
import { monthsBetween } from './ledger'

/**
 * The club's own budgeting of fines it has not been charged yet.
 *
 * The spreadsheet had this and the app lost it. *Klubbens finanser* carries a
 * `Forventede bøder` column beside `Faktiske bøder`, and a `Forventet
 * beholdning` column whose formula is literally `G2 = B2+C2+D2` and
 * `G3 = G2+C3+B3+D3` — last month's expected balance plus kontingent plus
 * actual fines plus budgeted ones. That structure is what Lukas asked for back
 * (2026-07-29) and it is what this file rebuilds: a budget line that sits
 * beside the real money and is never added into it.
 *
 * **What the sheet did not have is a method.** The four `Forventede bøder`
 * cells — Marts 26 146, April 132, Maj 118, Juni 107 — are typed constants.
 * There is no `<f>` on any of them, `table1.xml` declares no calculated-column
 * formula, and the sheet's forward rows (Juli 26 → August 27) budget *no*
 * fines at all, only kontingent. So the column was not a projection running
 * ahead of the club; it was four numbers someone entered on the day the sheet
 * was last saved, covering the gap between the last recorded fine and that day.
 * We are continuing the club's *structure*, and supplying the arithmetic it
 * never had. See docs/finance-reconciliation.md §12.
 *
 * ## Why the average is per meeting and not per month
 *
 * §9 puts a dinner on the calendar roughly every other month, and the
 * Bødekasseregulativ charges fines at the table. So fines arrive in bursts: a
 * meeting month can produce 475 kr. and the month after it produces nothing —
 * not because collection failed, but because nobody was there to be fined.
 *
 * A mean over months divides that burst by the empty months around it. It gets
 * the same answer as this file only when the history happens to be regular, and
 * it is wrong in both directions the moment it is not: it under-budgets the
 * evenings, invents income in the months between them, and — the part that
 * actually bites — its answer moves when the *window* moves, even though not
 * one fine has changed. The club's 1.730 kr. over five dinners is 133 kr. a
 * month across a 13-month payment history and 216 kr. a month across an
 * 8-month one. Both are the same five evenings.
 *
 * So the unit is the evening. `perMeetingKr` is what a dinner costs the members
 * on average, and the cadence turns that into a monthly budget. Divide by
 * meetings, and adding a quiet month to the window changes nothing.
 */

/** One meeting's fine total. `kr` is 0 for a meeting that produced none. */
export type MeetingFines = { number: number; kr: number }

/**
 * §9: *"Hvert andet måned som udgangspunkt."* The fallback cadence, in months
 * per meeting, for a club whose meetings have no dates — which is every meeting
 * this club has recorded. Stated as the club's own rule rather than guessed
 * from `created_at`, which is an insert time and slips by up to a month in
 * either direction (docs/finance-reconciliation.md §6.2).
 */
export const CADENCE_MONTHS_BY_RULE = 2

/** Below this many meetings in the window, the budget is stated as thin. */
export const THIN_HISTORY_MEETINGS = 3

/**
 * How far ahead the budget runs at most. §8 makes the financial year the unit.
 *
 * A ceiling and not a length: `budgetHorizon` also refuses to run the budget
 * further than the books it is drawn from. The club's sheet projected fourteen
 * months past its last real row, and on a chart that is what it looks like —
 * the record shrinks into the corner and the forecast becomes the picture. A
 * member then reads the shape of a guess as the shape of the club's finances.
 */
export const BUDGET_MONTHS = 12

/**
 * How many months of budget to draw: never more than there is history behind it.
 *
 * "A forecast may not be longer than the record it rests on" is a presentation
 * rule with an honesty argument under it. Five months of books cannot support a
 * year of curve, and drawing one anyway gives the eye a line that is two thirds
 * invention. It also means the horizon extends on its own as the club records
 * more, which is the right direction for it to move.
 */
export function budgetHorizon(monthsOfHistory: number): number {
  return Math.max(0, Math.min(BUDGET_MONTHS, monthsOfHistory))
}

export type FineBudget = {
  /** What an average evening costs the members. The figure everything else scales. */
  perMeetingKr: number
  /** Meetings the average is divided by, quiet evenings included. */
  meetingsInWindow: number
  /** Total fines those meetings produced. */
  observedKr: number
  /** Months per meeting — measured where dates allow, else §9's rule. */
  cadenceMonths: number
  /** Whether the cadence was measured from real dates or taken from §9. */
  cadenceSource: 'dates' | 'rule'
  /** The monthly budget line: `perMeetingKr / cadenceMonths`, rounded to kroner. */
  perMonthKr: number
  /**
   * Whether there is enough history to budget at all, and how much to trust it.
   * `none` means say so instead of drawing a zero line — a budget of 0 kr. reads
   * as "the club expects no fines", which is a claim, not an absence.
   */
  basis: 'none' | 'thin' | 'ok'
}

/**
 * The window the average is taken over: first fine-bearing meeting to last,
 * inclusive.
 *
 * Not "every meeting ever", and not "only the meetings with fines". Both of
 * those answer a question the data cannot: a meeting with no `fines` rows is
 * either an evening where nobody offended or an evening whose Lead never told
 * the Kasserer, and the two are identical in the database
 * (docs/finance-reconciliation.md §9 Q10 asks Lukas exactly this and it is
 * still open).
 *
 * Counting only fine-bearing meetings assumes every quiet evening was
 * unrecorded, and budgets too high. Counting all 28 assumes every quiet
 * evening was genuinely quiet, and drags the average down with the club's whole
 * undated prehistory — meetings from years before anyone kept a fine box.
 * The window between the first and last fine takes the quiet evenings that sit
 * *inside* the period the club was demonstrably recording, and no others.
 */
export function fineWindow(meetings: MeetingFines[]): MeetingFines[] {
  const charged = meetings.filter((m) => m.kr > 0)
  if (charged.length === 0) return []
  const from = Math.min(...charged.map((m) => m.number))
  const to = Math.max(...charged.map((m) => m.number))
  return meetings.filter((m) => m.number >= from && m.number <= to)
}

/**
 * Months per meeting, measured from the meetings that have dates.
 *
 * Needs three dated meetings before it will believe itself: two give a single
 * gap, and one gap is an anecdote — the club's own §9 allows the frequency to
 * be decided meeting by meeting, so a single short interval would set the
 * cadence for a year. Below that it returns §9's rule, which is what the club
 * says it does and is currently the only thing available: all 28 meetings are
 * undated.
 */
export function cadenceFrom(dates: string[]): { months: number; source: 'dates' | 'rule' } {
  const sorted = [...dates].filter(Boolean).sort()
  if (sorted.length < 3) return { months: CADENCE_MONTHS_BY_RULE, source: 'rule' }
  const span = monthsBetween(sorted[0].slice(0, 7), sorted[sorted.length - 1].slice(0, 7)).length - 1
  if (span <= 0) return { months: CADENCE_MONTHS_BY_RULE, source: 'rule' }
  return { months: span / (sorted.length - 1), source: 'dates' }
}

/**
 * The budget, from the meetings the club has recorded fines against.
 *
 * `meetingDates` is every meeting date the club knows — used only to measure
 * the cadence, never to place a fine. Placing fines is `/oekonomi`'s job and it
 * refuses to do it without a date, for the same reason
 * (docs/finance-reconciliation.md §6.2).
 */
export function budgetFines(opts: {
  meetings: MeetingFines[]
  meetingDates: string[]
}): FineBudget {
  const window = fineWindow(opts.meetings)
  const observedKr = window.reduce((n, m) => n + m.kr, 0)
  const cadence = cadenceFrom(opts.meetingDates)
  if (window.length === 0 || observedKr <= 0) {
    return {
      perMeetingKr: 0,
      meetingsInWindow: 0,
      observedKr: 0,
      cadenceMonths: cadence.months,
      cadenceSource: cadence.source,
      perMonthKr: 0,
      basis: 'none',
    }
  }
  const perMeetingKr = Math.round(observedKr / window.length)
  return {
    perMeetingKr,
    meetingsInWindow: window.length,
    observedKr,
    cadenceMonths: cadence.months,
    cadenceSource: cadence.source,
    perMonthKr: Math.round(perMeetingKr / cadence.months),
    basis: window.length < THIN_HISTORY_MEETINGS ? 'thin' : 'ok',
  }
}

/**
 * A month of budget. Deliberately not a `LedgerMonth`.
 *
 * The ledger's fields are money that moved — `received`, `actualBalance`,
 * `outstanding`. None of them mean anything here and every one of them would be
 * a lie if it were zero, so the type does not have them. A caller cannot
 * accidentally add a projected month into a real total, because the shapes do
 * not fit.
 */
export type BudgetMonth = {
  month: string
  /** Kontingent the club will charge, at §4 Stk. 3's rate for that month. */
  dues: number
  /** The fine budget. Not a charge, not a receipt, not money. */
  budgetedFines: number
  /** Expected balance carried forward from the ledger's last actual month. */
  expectedBalance: number
}

/**
 * The months after the books end, carrying dues plus the fine budget.
 *
 * This is the sheet's `Forventet beholdning` continued — same structure, same
 * running sum, and the same refusal to touch `Faktisk beholdning`. It starts
 * from `openingBalance`, which is the ledger's own `expectedBalance` at its last
 * real month, so the dashed line begins exactly where the solid one stops
 * instead of restarting at zero.
 */
export function projectBudget(opts: {
  /** The last month the books actually cover, as YYYY-MM. */
  after: string
  months?: number
  openingBalance: number
  budget: FineBudget
  payingMembers: (month: string) => number
}): BudgetMonth[] {
  const count = opts.months ?? BUDGET_MONTHS
  if (count <= 0) return []
  const [y, m] = opts.after.split('-').map(Number)
  const first = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  const last = (() => {
    let yy = Number(first.slice(0, 4))
    let mm = Number(first.slice(5, 7)) + count - 1
    yy += Math.floor((mm - 1) / 12)
    mm = ((mm - 1) % 12) + 1
    return `${yy}-${String(mm).padStart(2, '0')}`
  })()

  let expectedBalance = opts.openingBalance
  return monthsBetween(first, last).map((month) => {
    const dues = duesForMonth(month, opts.payingMembers(month))
    const budgetedFines = opts.budget.perMonthKr
    expectedBalance += dues + budgetedFines
    return { month, dues, budgetedFines, expectedBalance }
  })
}

/**
 * The fines the budget cannot see, and the honest sentence about them.
 *
 * A fine hangs off a meeting record, and a meeting without a date belongs to no
 * month. Every one of the club's 28 meetings is undated today, so all 1.730 kr.
 * of recorded fines is outside the month-by-month ledger. That does **not**
 * stop the budget: the average is per *meeting*, and a meeting's number and its
 * fine total are known whether or not anyone wrote down the date. What it stops
 * is the cadence — how often those evenings happen — which is why that falls
 * back to §9's rule rather than being measured.
 *
 * So the projection can say what an evening costs. It cannot say which month
 * the next evening lands in, and it does not pretend to.
 */
export function budgetLimits(opts: {
  meetings: number
  undatedMeetings: number
  budget: FineBudget
}): string[] {
  const out: string[] = []
  if (opts.budget.basis === 'none') {
    out.push(
      'Der er ingen registrerede bøder at regne et gennemsnit på, så der budgetteres ikke med noget.',
    )
    return out
  }
  out.push(
    `Gennemsnittet er regnet pr. møde — ${opts.budget.meetingsInWindow} møder, ${opts.budget.observedKr.toLocaleString('da-DK')} kr. — og ikke pr. måned. Bøder gives ved bordet, og der er ikke møde hver måned.`,
  )
  if (opts.budget.cadenceSource === 'rule') {
    out.push(
      `Hvor ofte der holdes møde er ikke målt, men taget fra vedtægternes §9: hver anden måned. ${opts.undatedMeetings} af ${opts.meetings} møder har ingen dato, så kadencen kan endnu ikke regnes ud af klubbens egne datoer.`,
    )
  } else {
    out.push(
      `Kadencen er målt på klubbens egne mødedatoer: der går i gennemsnit ${opts.budget.cadenceMonths
        .toFixed(1)
        .replace('.', ',')} måneder mellem møderne.`,
    )
  }
  if (opts.budget.basis === 'thin') {
    out.push(
      'Grundlaget er tyndt — færre end tre møder med bøder — så tallet flytter sig meget, når det næste møde registreres.',
    )
  }
  out.push(
    'Budgettet er et gennemsnit fordelt ud på månederne. Det siger ikke, at der kommer bøder i netop denne måned.',
  )
  return out
}
