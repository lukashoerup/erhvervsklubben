import { describe, expect, it } from 'vitest'
import { VEDTAEGTER, statedMonthlyDues } from './vedtaegter'
import { duesFor } from './rules'

describe('vedtægterne', () => {
  it('carries all fifteen sections, in order and without gaps', () => {
    expect(VEDTAEGTER.map((s) => s.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ])
  })

  it('has text under every section', () => {
    for (const s of VEDTAEGTER) {
      expect(s.items.length, `§${s.n} ${s.title}`).toBeGreaterThan(0)
      expect(s.items.every((i) => i.trim().length > 0)).toBe(true)
    }
  })

  /**
   * The statutes state the dues; the finance code charges them. If someone
   * amends one and forgets the other, members are billed an amount the club
   * never voted for — so the drift fails here rather than in the books.
   */
  it('charges the rate §4 Stk. 3 states', () => {
    const now = new Date().toISOString().slice(0, 7)
    expect(duesFor(now)).toBe(statedMonthlyDues())
  })
})
