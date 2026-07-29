import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "Sidst set" — the write half (T074).
 *
 * What is worth asserting is not that a request is made. It is the three
 * promises the feature was allowed to exist on: it fires **once per app load**
 * rather than once per screen, it **never breaks the page**, and it carries
 * **no argument** — a member has nothing to point at anyone else's row.
 */
type Answer = { data: null; error: { message: string } | null }
const rpc = vi.fn(async (): Promise<Answer> => ({ data: null, error: null }))
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => ({ rpc }) }))

const { markSeen, resetRecordedForTests } = await import('./lastSeen')

beforeEach(() => {
  rpc.mockClear()
  rpc.mockImplementation(async () => ({ data: null, error: null }))
  resetRecordedForTests()
})

describe('recording that a member was here', () => {
  it('asks the database to stamp the caller, naming nobody', async () => {
    await markSeen('u-1')
    // No second argument, ever. That is the whole security argument: there is
    // no parameter in which a member could name another member's row.
    expect(rpc).toHaveBeenCalledExactlyOnceWith('touch_last_seen')
  })

  it('writes once per app load, however many screens are opened', async () => {
    // Six navigations inside one loaded page must be one visit, not six. This
    // is "was here today", not a click counter.
    for (let i = 0; i < 6; i++) await markSeen('u-1')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('records the next person after a sign-out and sign-in', async () => {
    // Two of the ten share a laptop. Keyed by user id rather than a boolean so
    // the second man's visit is not swallowed by the first man's.
    await markSeen('u-1')
    await markSeen('u-2')
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('does nothing at all when nobody is signed in', async () => {
    await markSeen(null)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('is silent when the write fails', async () => {
    // A member whose visit went unrecorded because the network dropped should
    // see the club's news, not an error about a feature nobody told him exists.
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'nede' } }))
    await expect(markSeen('u-1')).resolves.toBeUndefined()
  })

  it('is silent when the client itself cannot be built', async () => {
    // supabase() throws synchronously with no URL or key. An exception raised
    // in an effect at the top of App takes the whole tree down to a blank page.
    rpc.mockImplementation(() => {
      throw new Error('VITE_SUPABASE_URL is not set')
    })
    await expect(markSeen('u-1')).resolves.toBeUndefined()
  })
})
