import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { daDate } from './dates'

/**
 * The club is in Copenhagen, so this bug is invisible from home.
 *
 * A plain `YYYY-MM-DD` parses as UTC midnight. Print that in any zone behind
 * UTC and the day before comes out — the 1st of a month becomes the last of the
 * month before, which is a meeting moving and a news item changing months.
 * Copenhagen is UTC+1/+2 and never sees it; a member reading the app from the
 * west sees it on every date on every page.
 *
 * So the suite is run from a zone where it would show. The process zone is set
 * for this file only and restored after.
 */
const WEST = 'America/Los_Angeles'
let was: string | undefined

/**
 * Declared here rather than added to the app's tsconfig `types`. That config
 * describes browser code, and pulling node's globals into it would let any
 * component reach for `process` and compile. A test running in vitest's node
 * process legitimately can, so the declaration is scoped to this file.
 */
declare const process: { env: Record<string, string | undefined> }

beforeAll(() => {
  was = process.env.TZ
  process.env.TZ = WEST
})

afterAll(() => {
  process.env.TZ = was
})

describe('a date from the database', () => {
  it('keeps its day west of Copenhagen', () => {
    // Untreated this reads "31. juli 2026".
    expect(daDate('2026-08-01')).toBe('1. august 2026')
    expect(daDate('2021-12-04')).toBe('4. december 2021')
  })

  it('proves the zone is actually shifted, so the case above is not a no-op', () => {
    expect(new Date('2026-08-01').toLocaleDateString('da-DK')).toBe('31.7.2026')
  })

  it('takes the caller’s format without losing the zone', () => {
    expect(daDate('2026-08-01', { day: 'numeric', month: 'short' })).toBe('1. aug.')
    expect(daDate('2026-08-01', { weekday: 'long', day: 'numeric', month: 'long' })).toBe(
      'lørdag 1. august',
    )
  })
})
