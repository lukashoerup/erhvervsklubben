import {
  canBeFined,
  chargedIn,
  MEMBER_RIGHTS,
  paysDues,
  payingMembers,
  payingMembersIn,
  rightsOf,
  STATUS_LABEL,
  STATUS_NOTE,
  votesOnFunds,
  type MemberStatus,
} from './members'

/**
 * The exemptions, asserted rather than remembered.
 *
 * This is the file that exists because a rule lived in a chat message: Oskar
 * pays no kontingent, incurs no fines and does not vote on the use of the
 * club's funds. Each of those is money or governance, and each was previously
 * enforced by whoever happened to be looking at the screen.
 */
describe('a founding father (§12, Lukas 2026-07-29)', () => {
  test('is charged no kontingent and can be given no fine', () => {
    expect(paysDues('founding-father')).toBe(false)
    expect(canBeFined('founding-father')).toBe(false)
  })

  test('does not vote on the use of the club’s funds', () => {
    expect(votesOnFunds('founding-father')).toBe(false)
  })

  test('is not "inactive" — §3 says an inactive member may not attend, and he does', () => {
    expect(MEMBER_RIGHTS['founding-father'].mayAttend).toBe(true)
    expect(MEMBER_RIGHTS.inaktiv.mayAttend).toBe(false)
    expect(MEMBER_RIGHTS['founding-father']).not.toEqual(MEMBER_RIGHTS.inaktiv)
  })
})

describe('§3’s two ordinary states', () => {
  test('an active member pays and votes', () => {
    expect(MEMBER_RIGHTS.aktiv).toEqual({
      paysDues: true, canBeFined: true, votesOnFunds: true, mayAttend: true,
    })
  })

  test('an inactive member is on pause and owes nothing', () => {
    expect(paysDues('inaktiv')).toBe(false)
    expect(votesOnFunds('inaktiv')).toBe(false)
  })
})

describe('a name with no member record', () => {
  test('costs nobody anything', () => {
    // The bug this whole file was written against: the roster used to be every
    // name in `attendances`, so being recorded at one dinner made someone
    // billable. Absence of a record must never grant a charge.
    expect(paysDues(null)).toBe(false)
    expect(canBeFined(null)).toBe(false)
    expect(votesOnFunds(null)).toBe(false)
  })
})

describe('the income base', () => {
  test('counts only the members who pay', () => {
    const club: (MemberStatus | null)[] = [
      'aktiv', 'aktiv', 'aktiv', 'aktiv', 'aktiv',
      'aktiv', 'aktiv', 'aktiv', 'aktiv', 'founding-father',
    ]
    // The club today: ten members, nine invoices.
    expect(club).toHaveLength(10)
    expect(payingMembers(club)).toBe(9)
  })

  test('an inactive member and an unknown name are both outside it', () => {
    expect(payingMembers(['aktiv', 'inaktiv', null])).toBe(1)
  })
})

describe('every status the club can hold', () => {
  test('can be shown and explained on a screen', () => {
    // A status with no label renders as a raw enum value beside a member's
    // name, and a status with no note is the thing this task set out to end:
    // a rule that only exists somewhere else.
    for (const status of Object.keys(MEMBER_RIGHTS) as MemberStatus[]) {
      expect(STATUS_LABEL[status]).toBeTruthy()
      expect(STATUS_NOTE[status]).toBeTruthy()
      expect(rightsOf(status)).toBe(MEMBER_RIGHTS[status])
    }
  })
})

/**
 * When the club started charging each member — the fact `/oekonomi` needed and
 * the club had never written down (T076, from the bank statement).
 */
describe('the payer count, per month', () => {
  // The club as the statement establishes it: eight payers from June 2025, the
  // ninth from May 2026, and the founding father in neither count.
  const club = [
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2025-06-01' },
    { status: 'aktiv' as MemberStatus, duesFrom: '2026-05-01' },
    { status: 'founding-father' as MemberStatus, duesFrom: null },
  ]

  test('rises when a member starts paying, and not before', () => {
    expect(payingMembersIn(club, '2025-05')).toBe(0)
    expect(payingMembersIn(club, '2025-06')).toBe(8)
    expect(payingMembersIn(club, '2026-04')).toBe(8)
    expect(payingMembersIn(club, '2026-05')).toBe(9)
    expect(payingMembersIn(club, '2026-07')).toBe(9)
    // The whole point of measuring it: charging today's nine across the whole
    // history put 1.200 kr. of kontingent on the club that it never charged.
    expect(payingMembers(club.map((m) => m.status))).toBe(9)
  })

  test('the founding father is charged in no month, dated or not', () => {
    // Two independent reasons, and either alone must be enough. §12 exempts
    // him, and he has no dues_from — so a future migration filling one in by
    // accident still cannot bill him.
    expect(chargedIn({ status: 'founding-father', duesFrom: null }, '2026-07')).toBe(false)
    expect(chargedIn({ status: 'founding-father', duesFrom: '2025-06-01' }, '2026-07')).toBe(false)
  })

  test('a member with no dues_from is charged across the whole window', () => {
    // Null means *not known*, and the safe reading of not-knowing is the
    // behaviour this replaced. A database that has not run the migration must
    // not report the club as owed nothing — under-charging silently is worse
    // than over-charging visibly, because nobody goes looking for it.
    expect(chargedIn({ status: 'aktiv', duesFrom: null }, '2020-01')).toBe(true)
    expect(chargedIn({ status: 'aktiv' }, '2026-07')).toBe(true)
    expect(payingMembersIn([{ status: 'aktiv' }, { status: 'inaktiv' }], '2019-03')).toBe(1)
  })

  test('charges the month a member starts and not the one before', () => {
    expect(chargedIn({ status: 'aktiv', duesFrom: '2026-05-01' }, '2026-04')).toBe(false)
    expect(chargedIn({ status: 'aktiv', duesFrom: '2026-05-01' }, '2026-05')).toBe(true)
  })
})
