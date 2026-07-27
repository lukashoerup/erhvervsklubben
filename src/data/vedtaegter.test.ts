import { describe, expect, it } from 'vitest'
import { VEDTAEGTER, statedMonthlyDues, statute, stk } from './vedtaegter'
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

  it('refuses to return a section that does not exist', () => {
    // The landing page cites sections by number. Undefined would leave a blank
    // paragraph on the club's front door; this fails at test time instead.
    expect(statute(2).title).toBe('Formål')
    expect(() => statute(99)).toThrow('§99')
  })

  /**
   * The stykke label belongs on /regler, where members read the rules as rules.
   * The public page prints the same sentences as a description of the club and
   * cites "§9" beside them, so the numbering is stripped at the point of use —
   * one text in the repo, not two.
   */
  describe('stripping the stykke label', () => {
    it('removes a plain one', () => {
      expect(stk('Stk. 1. Der afholdes som udgangspunkt møde hver anden måned.')).toBe(
        'Der afholdes som udgangspunkt møde hver anden måned.',
      )
    })

    it('removes a lettered one', () => {
      // "Stk. 2. A." — half the statutes' sub-clauses look like this, and a
      // regex that stops at the number leaves a stray "A." mid-sentence.
      expect(stk(VEDTAEGTER[3].items[2])).toMatch(/^Enkeltpersoner skal have deltaget/)
    })

    it('leaves a sentence that never had one alone', () => {
      expect(stk(VEDTAEGTER[1].items[0])).toBe(VEDTAEGTER[1].items[0])
    })

    it('leaves every stripped stykke starting like a sentence', () => {
      for (const s of VEDTAEGTER) {
        for (const item of s.items) {
          expect(stk(item), `§${s.n}: ${item}`).not.toMatch(/^(Stk\.|[A-Z]\.\s)/)
        }
      }
    })
  })
})
