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

/**
 * The club's live database is older than this code: it has no meeting_date.
 * Asking for it failed the whole read, which put fifteen years of history
 * behind "kunne ikke hente data" over one optional field.
 */
describe('reading the meeting records', () => {
  it('drops the date column and keeps the history when the column is missing', async () => {
    select
      .mockResolvedValueOnce({
        data: null,
        error: { code: '42703', message: 'column ... does not exist' },
      })
      .mockResolvedValueOnce({ data: [ROW], error: null })

    await expect(readRecords()).resolves.toEqual([ROW])

    expect(select).toHaveBeenCalledTimes(2)
    expect(select.mock.calls[0][0]).toContain('meeting_date')
    expect(select.mock.calls[1][0]).not.toContain('meeting_date')
  })

  it('asks for the date first, so it reappears on its own once the column exists', async () => {
    const dated = { ...ROW, meeting_date: '2026-02-14' }
    select.mockResolvedValueOnce({ data: [dated], error: null })

    await expect(readRecords()).resolves.toEqual([dated])
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
