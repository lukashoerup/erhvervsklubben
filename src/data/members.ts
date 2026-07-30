/**
 * Who the club's members are, and what each of them owes.
 *
 * Until now the app had no such thing: the roster was every distinct
 * `attendances.member_name`, so "member" meant "has turned up at least once".
 * That is a fine way to draw an attendance chart and a bad way to send an
 * invoice — §3 divides the club into people who pay and people who do not, and
 * the difference lived nowhere but in the members' heads. `buildLedger` was
 * therefore charging kontingent to the whole roster, and the expected-income
 * curve on /oekonomi has been too high for as long as it has existed.
 *
 * So membership is now a record with a status, and every money question in the
 * app is asked of that status rather than of the attendance history. The two
 * stay deliberately separate: §11 earns anciennitet by attendance alone, and a
 * member who pays nothing still earns it by turning up.
 */

/**
 * The three states the club actually has.
 *
 * **`alumne` is deliberately absent.** §4 Stk. 5 A does describe it, but only
 * as the far end of a road nobody has walked: two years inactive, then a vote,
 * and only then alumni status — and the club has never had an inactive member,
 * let alone one for two years. Adding the value now would mean a status no row
 * can hold, a label nobody can explain from experience, and a rule about
 * re-admission with no case to test it against. It costs nothing to add the day
 * the club votes one, and it is a check constraint plus a label when it does.
 * Same reasoning as the anciennitet revocation §11 allows and this app does not
 * build — see docs/RULES.md.
 */
export type MemberStatus = 'aktiv' | 'inaktiv' | 'founding-father'

/** A member as the club records them. Keyed by the name attendance already uses. */
export type Member = {
  name: string
  status: MemberStatus
  /**
   * First month the club charges this member kontingent, as `YYYY-MM-DD` on the
   * first of that month. Null where it is not known.
   *
   * **Not a joining date, and named for what it holds.** T076 established it
   * from the bank statement, which evidences dues liability and nothing else —
   * and the club's own history says the two are different: Christian Have has
   * attended since møde #3 and was fined at møde #26 in February 2026, three
   * months before his first kontingent transfer; the founding father has
   * attended 22 evenings and will never have a value here at all. Calling the
   * column `joined_on` would have put a joining date on nine members that the
   * statement cannot support and that `attendances` contradicts.
   *
   * Null means *not known*, and `chargedIn` therefore charges such a member in
   * every month of whatever window is being drawn — which is exactly what the
   * app did before this column existed. The column refines the payer count
   * where there is evidence; its absence must not silently drop a payer and
   * report the club richer than it is.
   */
  dues_from?: string | null
}

/**
 * What each status may and must do — the one place the club's exemptions are
 * written down instead of remembered.
 *
 * `aktiv` and `inaktiv` are §3 verbatim: active members pay kontingent and hold
 * voting rights, inactive members are on pause, pay nothing and may not attend.
 *
 * **`founding-father` is Lukas's ruling of 2026-07-29 about Oskar**, and it is
 * not a shade of either of the other two. He attends, so he is not inactive —
 * §3 says an inactive member may not attend. He pays no kontingent and incurs
 * no fines, so he is not active either. And §12 puts the use of the club's
 * funds to the *active* members present, so a member who contributes none of
 * those funds does not vote on spending them. Three exemptions, stated once
 * here, so that the finance code can ask rather than each screen remembering.
 *
 * Nothing in the app votes yet, so `votesOnFunds` is read by no code path.
 * It is here because the alternative is that the third exemption exists only in
 * a chat message — the exact failure this table was built to end. A vote screen
 * that ever gets built has one place to ask.
 */
export type MemberRights = {
  /** Pays the §4 Stk. 3 kontingent. The only thing membership income counts. */
  paysDues: boolean
  /** Can be charged under the Bødekasseregulativ. */
  canBeFined: boolean
  /** Votes on the use of the club's funds (§12 Stk. 2). */
  votesOnFunds: boolean
  /** May attend the club's events at all (§3). */
  mayAttend: boolean
}

export const MEMBER_RIGHTS: Record<MemberStatus, MemberRights> = {
  aktiv: { paysDues: true, canBeFined: true, votesOnFunds: true, mayAttend: true },
  inaktiv: { paysDues: false, canBeFined: false, votesOnFunds: false, mayAttend: false },
  'founding-father': {
    paysDues: false,
    canBeFined: false,
    votesOnFunds: false,
    mayAttend: true,
  },
}

/** What the members' screens call each status. */
export const STATUS_LABEL: Record<MemberStatus, string> = {
  aktiv: 'Aktivt medlem',
  inaktiv: 'Inaktivt medlem',
  'founding-father': 'Founding father',
}

/** The one-line reason, for the places a status needs to explain itself. */
export const STATUS_NOTE: Record<MemberStatus, string> = {
  aktiv: 'Betaler kontingent og har stemmeret (§3).',
  inaktiv: 'På pause. Betaler ikke kontingent og deltager ikke (§3).',
  'founding-father':
    'Deltager, men betaler hverken kontingent eller bøder og stemmer ikke om brug af klubbens midler (§12).',
}

/**
 * A name the roster holds but no member row claims.
 *
 * It happens for one reason today: `attendances.member_name` is free text and
 * always has been, so the attendance editor can record a guest or an eleventh
 * person the club has not yet admitted. Their history is real and stays on
 * /anciennitet — §10 Stk. 3 says a guest earns no anciennitet, but the club has
 * never used the app that way and the rows it does have are members.
 *
 * What such a name must never do is cost anyone money. Charging a person the
 * club has no membership record for is precisely the bug this file exists to
 * fix, so the absence of a record grants nothing.
 */
const UNCLAIMED: MemberRights = {
  paysDues: false,
  canBeFined: false,
  votesOnFunds: false,
  mayAttend: true,
}

export function rightsOf(status: MemberStatus | null): MemberRights {
  return status ? MEMBER_RIGHTS[status] : UNCLAIMED
}

/** Whether this member is charged the monthly kontingent. */
export function paysDues(status: MemberStatus | null): boolean {
  return rightsOf(status).paysDues
}

/** Whether a fine can be recorded against this member. */
export function canBeFined(status: MemberStatus | null): boolean {
  return rightsOf(status).canBeFined
}

/** Whether this member votes on the use of the club's funds (§12). */
export function votesOnFunds(status: MemberStatus | null): boolean {
  return rightsOf(status).votesOnFunds
}

/** How many of these members the club charges kontingent — the income base. */
export function payingMembers(statuses: (MemberStatus | null)[]): number {
  return statuses.filter(paysDues).length
}

/** What `chargedIn` and `payingMembersIn` need of a member. */
export type Charged = { status: MemberStatus | null; duesFrom?: string | null }

/**
 * Whether this member is charged kontingent in a given month (`YYYY-MM`).
 *
 * Two questions, and both have to be yes: does his status pay dues at all (§3,
 * §12), and had the club started charging him by then. The second one is new —
 * until 2026-07-30 the club had never recorded when a member's dues began, so
 * `/oekonomi` charged today's members across the whole history and the
 * expected-income curve sat 1.200 kr. too high (§13). The bank statement
 * answered it: eight payers from June 2025, nine from May 2026.
 *
 * A member with no `duesFrom` is charged in every month, which is the behaviour
 * this function replaces rather than a new guess. Erring the other way would
 * make a database that has not run the migration report the club as owed
 * nothing, and a books page that under-charges silently is worse than one that
 * over-charges loudly.
 */
export function chargedIn(m: Charged, month: string): boolean {
  if (!paysDues(m.status)) return false
  return !m.duesFrom || m.duesFrom.slice(0, 7) <= month
}

/** How many of these members the club charges in a given month (`YYYY-MM`). */
export function payingMembersIn(members: Charged[], month: string): number {
  return members.filter((m) => chargedIn(m, month)).length
}
