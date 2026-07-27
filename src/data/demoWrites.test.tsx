import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

/**
 * The demo build must never reach the club's database. Not "must fail to", must
 * never try.
 *
 * `build:demo` is a production build with VITE_DEMO=1 on top, so it carries the
 * live project's URL and anon key — the demo bundle contains them today. RLS
 * would refuse a write from it, since the demo holds no session at all, but the
 * club has fifteen years of history in that project and "the database said no"
 * is a weaker promise than "nothing was sent". This is the test that keeps it
 * the strong one.
 *
 * Stubbed before the import on purpose: `DEMO` is read at module scope, which
 * is what makes it a property of the build rather than of a render.
 */
vi.stubEnv('VITE_DEMO', '1')

const from = vi.fn()
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => ({ from }) }))

const { useDeleteRow, useSaveRow } = await import('./useClubData')
const { demoEvents, demoNews } = await import('./demo')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => from.mockClear())

describe('saving from a build with no database behind it', () => {
  it('creates the row in memory and asks the client for nothing', async () => {
    const { result } = renderHook(() => useSaveRow('news'), { wrapper })
    await act(async () => {
      result.current.mutate({
        id: null,
        values: { title: 'Skrevet i demoen', excerpt: '', author: '', date: '2026-07-27' },
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(from).not.toHaveBeenCalled()
    expect(demoNews[0]).toMatchObject({ title: 'Skrevet i demoen' })
  })

  it('corrects an existing row without a request', async () => {
    const { result } = renderHook(() => useSaveRow('events'), { wrapper })
    const before = demoEvents.length
    await act(async () => {
      result.current.mutate({ id: 'u1', values: { location: 'Lord Nelson' } })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(from).not.toHaveBeenCalled()
    expect(demoEvents).toHaveLength(before)
    expect(demoEvents.find((e) => e.id === 'u1')).toMatchObject({ location: 'Lord Nelson' })
  })

  it('deletes without a request', async () => {
    const { result } = renderHook(() => useDeleteRow('events'), { wrapper })
    await act(async () => {
      result.current.mutate('p2')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(from).not.toHaveBeenCalled()
    expect(demoEvents.find((e) => e.id === 'p2')).toBeUndefined()
  })
})
