import {
  canBeFined,
  MEMBER_RIGHTS,
  paysDues,
  payingMembers,
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
