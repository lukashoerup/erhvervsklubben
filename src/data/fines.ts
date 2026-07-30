/**
 * The fine book, read three ways — and the distinction the page got wrong.
 *
 * Lukas, 2026-07-30: *"Der står i toppen af økonomisiden at der er udestående
 * bøder på 2510 kr. Det passer ikke."* It did not. `/oekonomi` summed every fine
 * the club has ever incurred and printed the total under the word *udestående*,
 * on the one card that reads as authoritative. 1.780 kr. of it has been in the
 * bank since February 2026.
 *
 * **Three quantities, and they are all true at once.** The app kept conflating
 * them because it only had one number:
 *
 *   - **Pålagt** (incurred) — every fine a Lead ever noted. 2.510 kr.
 *   - **Indbetalt** (collected) — what has actually reached the fine box. 1.780 kr.
 *   - **Udestående** (outstanding) — the difference. 730 kr.
 *
 * The 730 kr. is not an accounting artefact: it is money the club is owed and has
 * never asked for, because three evenings' fines were noted and never billed
 * (docs/finance-reconciliation.md §15.1). Whether to collect it is Lukas's
 * decision, so the page's job is to make it visible without nagging.
 *
 * **Why the split has to live on the fine and not on the payment.** `payments`
 * holds one combined figure per month covering kontingent and fines together —
 * that is all the bank statement itemises (§16) — so nothing on the payments side
 * can say which fines it paid for. `fines.settled_at` carries it instead, added
 * additively in `20260730180000_fines_settled.sql`.
 *
 * Kept pure and free of fetching, like the rest of `data/`, so every figure below
 * is asserted in the offline suite rather than checked by eye on a screen.
 */
import { describeRule, FINE_RULES } from './rules'

export type FineRow = {
  member_name: string
  amount_kr: number
  record_id: number
  /** Which rule was applied. Text, so it can name a rule this build does not know. */
  rule_id: string
  /** Minutes late, on `for-sent` only. */
  minutes: number | null
  /**
   * The collection round this fine was settled in, or null while the club is
   * still owed it.
   *
   * Null is the safe default and the reason this reads the way round it does: a
   * fine nobody has marked as paid is a fine the club has not been paid. A
   * database that has not run the migration reports every fine as outstanding,
   * which is wrong in the direction that under-claims collection rather than
   * over-claiming it.
   */
  settled_at: string | null
}

export type FineTotals = {
  /** Every fine ever noted. */
  incurredKr: number
  incurred: number
  /** What has reached the fine box. */
  collectedKr: number
  collected: number
  /** What the club is still owed — the only figure the word "udestående" may name. */
  outstandingKr: number
  outstanding: number
}

export function isSettled(f: FineRow): boolean {
  return Boolean(f.settled_at)
}

export function fineTotals(fines: FineRow[]): FineTotals {
  const settled = fines.filter(isSettled)
  const open = fines.filter((f) => !isSettled(f))
  const sum = (rows: FineRow[]) => rows.reduce((n, f) => n + f.amount_kr, 0)
  return {
    incurredKr: sum(fines),
    incurred: fines.length,
    collectedKr: sum(settled),
    collected: settled.length,
    outstandingKr: sum(open),
    outstanding: open.length,
  }
}

/** Only what a member still owes. Never the same list as what he has been fined. */
export function outstandingByMember(fines: FineRow[]): { member: string; kr: number }[] {
  const by = new Map<string, number>()
  for (const f of fines) {
    if (isSettled(f)) continue
    by.set(f.member_name, (by.get(f.member_name) ?? 0) + f.amount_kr)
  }
  return [...by.entries()]
    .map(([member, kr]) => ({ member, kr }))
    .sort((a, b) => b.kr - a.kr || a.member.localeCompare(b.member, 'da'))
}

// ------------------------------------------------------------- the insights

export type OffenceTotal = {
  ruleId: string
  /** The regulation's own words for it. */
  offence: string
  kr: number
  count: number
  /** Total minutes, which only `for-sent` can have. */
  minutes: number
  /** Who incurred it, most first. Named, because Lukas asked for it twice. */
  members: { name: string; kr: number; count: number; minutes: number }[]
}

/**
 * What each offence has cost the club, and who incurred it.
 *
 * Lukas, 2026-07-30: *"hvilke forseelser der er givet højeste bøder, og evt. også
 * i samme visualisering, hvem det er."* So the **offence is the subject** and the
 * members are its composition, not the other way round. That ordering is not a
 * detail of layout — a chart with one bar per member is a league table of who
 * behaves worst, and a chart with one bar per offence is a club looking at its own
 * habits. The same rows produce either, and only one of them is what he asked for.
 *
 * Sorted by cost, because "højeste bøder" is the question. Ties fall back to the
 * count and then to the rule's own order in the regulation, so the bars never
 * reorder between renders.
 */
export function byOffence(fines: FineRow[]): OffenceTotal[] {
  const order = new Map(FINE_RULES.map((r, i) => [r.id, i]))
  const by = new Map<string, OffenceTotal>()

  for (const f of fines) {
    const row =
      by.get(f.rule_id) ??
      { ruleId: f.rule_id, offence: describeRule(f.rule_id), kr: 0, count: 0, minutes: 0, members: [] }
    row.kr += f.amount_kr
    row.count += 1
    row.minutes += f.minutes ?? 0
    const member = row.members.find((m) => m.name === f.member_name)
    if (member) {
      member.kr += f.amount_kr
      member.count += 1
      member.minutes += f.minutes ?? 0
    } else {
      row.members.push({
        name: f.member_name,
        kr: f.amount_kr,
        count: 1,
        minutes: f.minutes ?? 0,
      })
    }
    by.set(f.rule_id, row)
  }

  for (const row of by.values()) {
    row.members.sort((a, b) => b.kr - a.kr || a.name.localeCompare(b.name, 'da'))
  }

  return [...by.values()].sort(
    (a, b) =>
      b.kr - a.kr ||
      b.count - a.count ||
      (order.get(a.ruleId) ?? 99) - (order.get(b.ruleId) ?? 99),
  )
}

export type LatenessFacts = {
  /** Every minute the club has been late, added up. */
  minutes: number
  /** How many members have ever been late. */
  members: number
  /** The single latest arrival, in minutes. */
  worstMinutes: number
  /** How many late arrivals there have been. */
  arrivals: number
  /** What lateness costs as a share of every fine, 0–1. */
  shareOfKr: number
}

/**
 * The club's lateness, as a fact about the club.
 *
 * This is the number worth leading with, and the reason is tone rather than
 * arithmetic. `for-sent` is 86 % of every krone the club has ever fined, which on
 * any per-member chart makes whoever tops it look like the problem. He is not: in
 * a club of ten, **seven of the nine finable members have been late at least
 * once**. Lateness is not one man's failing, it is the club's single habit, and
 * the collective figure says so before any name appears.
 *
 * It is also the most interesting thing in the data. `minutes` is populated on
 * every late arrival since T075, so the club's total lateness is answerable for
 * the first time — and it is over three hours.
 */
export function latenessFacts(fines: FineRow[]): LatenessFacts {
  const late = fines.filter((f) => f.rule_id === 'for-sent')
  const totalKr = fines.reduce((n, f) => n + f.amount_kr, 0)
  return {
    minutes: late.reduce((n, f) => n + (f.minutes ?? 0), 0),
    members: new Set(late.map((f) => f.member_name)).size,
    worstMinutes: Math.max(0, ...late.map((f) => f.minutes ?? 0)),
    arrivals: late.length,
    shareOfKr: totalKr > 0 ? late.reduce((n, f) => n + f.amount_kr, 0) / totalKr : 0,
  }
}

/**
 * Minutes as Danes say them out loud — "3 t 22 min", not "202".
 *
 * 202 minutes is a number nobody has a feel for; three hours and twenty-two
 * minutes is an evening's worth of the club standing around waiting, which is the
 * point of printing it at all.
 */
export function daMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} t` : `${h} t ${m} min`
}

// -------------------------------------------------------- the income mix

/**
 * The club's income, split by where it comes from, per quarter.
 *
 * Lukas, 2026-07-30: *"en graf længere nede som viser indtægtsfordeling
 * (kontingenter, bødetyper) over tid. Tænker et søjlediagram."*
 *
 * **Quarters, not months, and the club's own regulation is why.** The
 * Bødekasseregulativ (Stk. 3) collects fines quarterly and §9 puts a dinner on
 * the calendar every other month, so a monthly bar chart draws a flat 800 kr.
 * kontingent bar with a fine spike in every second one and nothing between. That
 * sawtooth is the club's *calendar*, not its finances, and a reader would take it
 * for a collection problem. On quarters the fines land where the club actually
 * bills them, and fourteen months becomes six bars — which is also the difference
 * between legible and unreadable at 420 px. `/oekonomi` already reports
 * "Kvartalsvis opkrævning", so the unit is one the page has taught.
 *
 * **The kontingent figure is derived and must never be presented as itemised.**
 * `payments` holds one combined amount per month covering kontingent and fines
 * together — that is all the bank statement says (§16) — so this split comes from
 * `duesForMonth` on one side and the `fines` rows on the other. It is what the
 * club **charged**, broken down. What arrived is one number per month and the
 * card says so.
 *
 * The tail is folded rather than drawn: `drikkevare` and `frivillig` are one fine
 * of 50 kr. each, which at this scale is a two-pixel sliver apiece. They are one
 * `Øvrige bøder` segment on the chart and itemised in the table under it — the
 * chart carries the shape, the table carries every krone.
 */
export const MIX_KEYS = ['dues', 'for-sent', 'skaal', 'other'] as const
export type MixKey = (typeof MIX_KEYS)[number]

/** Fixed labels in fixed order. Never sorted by size — see the ramp note in IncomeMix. */
export const MIX_LABELS: Record<MixKey, string> = {
  dues: 'Kontingent',
  'for-sent': 'For sent fremmøde',
  skaal: 'Skål før Leads første skål',
  other: 'Øvrige bøder',
}

export type QuarterMix = { quarter: string; total: number } & Record<MixKey, number>

export function incomeByQuarter(
  duesByMonth: { month: string; dues: number }[],
  fines: { month: string; rule_id: string; amount_kr: number }[],
): QuarterMix[] {
  const quarter = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
  }
  const by = new Map<string, QuarterMix>()
  const at = (q: string) => {
    const row = by.get(q) ?? { quarter: q, total: 0, dues: 0, 'for-sent': 0, skaal: 0, other: 0 }
    by.set(q, row)
    return row
  }

  for (const m of duesByMonth) {
    const row = at(quarter(m.month))
    row.dues += m.dues
    row.total += m.dues
  }
  for (const f of fines) {
    // A fine on a meeting with no date belongs to no quarter and is left out
    // rather than dropped into one, exactly as the ledger above it does. The
    // amount left out is stated on the card.
    if (!f.month) continue
    const row = at(quarter(f.month))
    const key: MixKey = f.rule_id === 'for-sent' || f.rule_id === 'skaal' ? f.rule_id : 'other'
    row[key] += f.amount_kr
    row.total += f.amount_kr
  }

  return [...by.values()].sort((a, b) => a.quarter.localeCompare(b.quarter))
}
