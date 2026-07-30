import { beforeEach, describe, expect, it, vi } from 'vitest'

const select = vi.fn()

vi.mock('../lib/supabase', () => ({
  READONLY: true,
  supabase: () => ({ from: () => ({ select }) }),
}))

const { readRecords } = await import('./useClubData')

const ROW = {
  id: 1,
  meeting_number: 27,
  lead: 'Anders',
  pre_location: null,
  main_location: 'Lord Nelson',
  post_location: null,
}

beforeEach(() => {
  select.mockReset()
})

/** Postgres `undefined_column`, which is what a database behind this build says. */
const MISSING = { data: null, error: { code: '42703', message: 'column ... does not exist' } }

/**
 * The club's live database has twice been older than this code: no meeting_date
 * until 2026-07-29, no description until 2026-07-30. Asking for either failed the
 * whole read, which put fifteen years of history behind "kunne ikke hente data"
 * over one optional field.
 *
 * Two optional columns make it a ladder, and the rungs are asserted in order —
 * the bug a single assertion would miss is a retry that drops *both* columns on
 * the first failure, which costs the dates on every database that merely lacks
 * the newer one.
 */
describe('reading the meeting records', () => {
  it('drops one optional column per rung, newest first', async () => {
    select
      .mockResolvedValueOnce(MISSING)
      .mockResolvedValueOnce(MISSING)
      .mockResolvedValueOnce({ data: [ROW], error: null })

    await expect(readRecords()).resolves.toEqual([ROW])

    expect(select).toHaveBeenCalledTimes(3)
    expect(select.mock.calls[0][0]).toContain('description')
    expect(select.mock.calls[0][0]).toContain('meeting_date')
    // The middle rung is the one that matters: a database with dates and no
    // descriptions must still come back with its dates.
    expect(select.mock.calls[1][0]).not.toContain('description')
    expect(select.mock.calls[1][0]).toContain('meeting_date')
    expect(select.mock.calls[2][0]).not.toContain('meeting_date')
  })

  it('keeps the dates when only the description column is missing', async () => {
    const dated = { ...ROW, meeting_date: '2026-02-14' }
    select.mockResolvedValueOnce(MISSING).mockResolvedValueOnce({ data: [dated], error: null })

    await expect(readRecords()).resolves.toEqual([dated])
    expect(select).toHaveBeenCalledTimes(2)
  })

  it('asks for everything first, so a column reappears on its own once it exists', async () => {
    const whole = { ...ROW, meeting_date: '2026-02-14', description: 'Anders er Lead.' }
    select.mockResolvedValueOnce({ data: [whole], error: null })

    await expect(readRecords()).resolves.toEqual([whole])
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('does not swallow a real failure', async () => {
    select.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(readRecords()).rejects.toMatchObject({ code: '42501' })
    expect(select).toHaveBeenCalledTimes(1)
  })
})
