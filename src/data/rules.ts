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
 * A fine whose offence is not known.
 *
 * All eighteen fines imported from the club's old spreadsheet carried this
 * (T068): the sheet recorded amounts and nothing else, and against the five
 * rules above most amounts have several valid readings — 200 kr is
 * `udeblivelse` *or* thirty minutes late; 100 kr is `sent-afbud` *or* two
 * 50-rules *or* ten minutes late. Writing a specific offence against a named
 * member on a guess would be worse than recording none, so the money was exact
 * and the offence honestly unknown.
 *
 * **T075 emptied it down to one row.** The Leads' own notes named the offence
 * for three of them outright, and Lukas answered for the rest from memory on
 * 2026-07-30 — all late arrivals — which the regulation's own 50 + 5·minutes
 * then corroborated on every single amount. What is left is his voluntary 50 kr
 * at møde #26, where the arithmetic cannot decide: 50 kr is late arrival at
 * zero minutes *and* exactly what `drikkevare` and `skaal` cost.
 * See docs/finance-reconciliation.md §15.
 *
 * It stays in the code regardless of how few rows hold it. It is how this
 * schema says "not known", and the next import from a paper record will need it
 * again.
 *
 * Deliberately *not* a member of `FINE_RULES`. It is not a rule anyone can be
 * charged under — it has no amount and the club never voted it — so it must
 * never appear in the capture UI as something to tap. It exists only to be read
 * back off history.
 */
export const HISTORIC_RULE_ID = 'historisk'

/**
 * A fine nobody was charged — money a member put in the box himself.
 *
 * The club has exactly one so far: the treasurer's own 50 kr. at møde #26,
 * transferred because a year in which the treasurer incurred no fine looked
 * implausible (Lukas, 2026-07-29). It carried `historisk` until he named it,
 * and that was wrong in a specific way — `historisk` means *nobody knows what
 * this was*, and he knew precisely what it was. A voluntary contribution is not
 * an unrecorded offence, and the club's books should not imply that somebody
 * misbehaved where somebody was in fact being a good sport.
 *
 * Not a member of `FINE_RULES`, for the same reason as the historic id: it is
 * not something a Lead can charge anyone under, so it must never appear in the
 * capture UI as a chip to tap. It is written when a transfer is recorded, and
 * read back off history.
 */
export const VOLUNTARY_RULE_ID = 'frivillig'

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
  if (ruleId === VOLUNTARY_RULE_ID) return 'Frivillige bøder/indbetalinger'
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
