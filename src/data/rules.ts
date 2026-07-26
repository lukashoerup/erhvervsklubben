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
 * Only *aktive* members pay (§3): inactive members are on pause and owe
 * nothing. Income is never simply "everyone × rate".
 */
export function duesForMonth(month: string, activeMembers: number): number {
  return duesFor(month) * Math.max(0, activeMembers)
}
