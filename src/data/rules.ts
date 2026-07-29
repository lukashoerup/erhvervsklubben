/**
 * The club's own rules, as the app states and charges them.
 *
 * Transcribed from `250504_Bødekasseregulativ_Erhvervsklubben_v02.docx` and
 * `250426_Vedtaegter_vS.docx` — see docs/RULES.md for the full text and the
 * administration clauses. The Drive documents remain the source of truth: if
 * the club amends them, amend them there first, then here.
 *
 * These amounts are charged, not just displayed, so they live in one place.
 */

export type FineRule = {
  id: string
  /** What it costs. `perMinute` is added per minute for late arrival. */
  kr: number
  perMinute?: number
  offence: string
  /** How it can be avoided, where the regulation allows it. */
  waiver?: string
}

export const FINE_RULES: FineRule[] = [
  {
    id: 'udeblivelse',
    kr: 200,
    offence: 'Udeblivelse uden afbud',
  },
  {
    id: 'sent-afbud',
    kr: 100,
    offence: 'Afbud efter Lead har foretaget bordbestilling',
  },
  {
    id: 'for-sent',
    kr: 50,
    perMinute: 5,
    offence: 'For sent fremmøde',
    waiver:
      'Undgås ved at informere Lead om forventet forsinkelse senest 24 timer efter dagsordenen er offentliggjort.',
  },
  {
    id: 'drikkevare',
    kr: 50,
    offence: 'Bestille en anden type drikkevare end Lead under maden',
    waiver: 'Undgås hvis Lead har givet samtykke.',
  },
  {
    id: 'skaal',
    kr: 50,
    offence: 'Skål før Leads første skål',
  },
]

/**
 * Bødekasseregulativ, closing note: *"Et medlem kan ikke pålægges mere end én
 * bøde pr. forseelse pr. møde."* Enforced when fines are recorded, not merely
 * printed on the rules page.
 */
export const ONE_FINE_PER_OFFENCE_PER_MEETING = true

/**
 * The fines imported from the club's old spreadsheet (T068).
 *
 * The sheet recorded amounts and nothing else, and against the five rules above
 * most amounts have several valid readings — 200 kr is `udeblivelse` *or*
 * thirty minutes late; 100 kr is `sent-afbud` *or* two 50-rules *or* ten
 * minutes late. Twelve of the eighteen cells are ambiguous that way. Writing a
 * specific offence against a named member on a guess would be worse than
 * recording none, so those rows carry this id instead: the money is exact and
 * the offence is honestly unknown.
 *
 * Deliberately *not* a member of `FINE_RULES`. It is not a rule anyone can be
 * charged under — it has no amount and the club never voted it — so it must
 * never appear in the capture UI as something to tap. It exists only to be read
 * back off history. See docs/finance-reconciliation.md.
 */
export const HISTORIC_RULE_ID = 'historisk'

/**
 * What to show for a fine's `rule_id`, including ids this build does not know.
 *
 * `fines.rule_id` is text precisely so the club can vote in a new rule without
 * a schema migration, which means a row can always name a rule this build has
 * never heard of — a newer rule, or the historic import above. Looking the id
 * up and rendering whatever came back would print an empty cell for exactly
 * those rows, and an empty cell beside an amount reads as "no reason given"
 * rather than "this build does not know that reason yet".
 *
 * So an unknown id is stated as unknown and keeps its id, which is the part
 * anyone debugging it actually needs.
 */
export function describeRule(ruleId: string): string {
  const known = FINE_RULES.find((r) => r.id === ruleId)
  if (known) return known.offence
  if (ruleId === HISTORIC_RULE_ID) return 'Historisk bøde — forseelse ikke registreret'
  return `Ukendt bøderegel (${ruleId})`
}

/**
 * What a fine comes to. Only late arrival has a per-minute component, and only
 * that rule accepts `minutes`.
 */
export function fineAmount(rule: FineRule, minutes = 0): number {
  if (!rule.perMinute) return rule.kr
  return rule.kr + rule.perMinute * Math.max(0, Math.floor(minutes))
}

/**
 * Membership dues, per §4 Stk. 3 — with the rate change the club voted through.
 *
 * The statutes on file said 100 kr for a long time after the vote; the code
 * follows the vote. Dated rather than hardcoded to a single number, because
 * historical months must still reconcile to what was actually charged then.
 */
export const DUES_SCHEDULE: { from: string; kr: number }[] = [
  { from: '2000-01-01', kr: 100 },
  { from: '2026-06-01', kr: 200 },
]

export function duesFor(month: string): number {
  // month as YYYY-MM; the applicable rate is the latest one starting on or
  // before it.
  const applicable = DUES_SCHEDULE.filter((r) => r.from.slice(0, 7) <= month)
  return applicable[applicable.length - 1]?.kr ?? 0
}

/**
 * Membership income for a month: the rate times the members who actually pay.
 *
 * Never "everyone × rate". §3 puts inactive members on pause owing nothing, and
 * §12's founding father pays nothing while attending everything — so the count
 * comes from membership status (`payingMembers` in data/members.ts) and not
 * from the roster's length. Counting the roster is exactly the mistake this
 * argument is named after.
 */
export function duesForMonth(month: string, payingMembers: number): number {
  return duesFor(month) * Math.max(0, payingMembers)
}
