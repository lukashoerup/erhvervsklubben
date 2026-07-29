import { expect, it, vi } from 'vitest'

/**
 * A read-only preview reads the club's real data, and must keep working (T074).
 *
 * `lib/supabase`'s read-only client refuses `rpc` by **throwing**, which is
 * right for a save button — a treasurer pressing Gem should be told the build
 * cannot write — and wrong for this, which runs unasked in an effect on every
 * page load. So the mode is checked before the client rather than by it.
 *
 * Its own file: READONLY is read at module scope, so the mode belongs to the
 * whole module graph and cannot be set from inside a test.
 */
vi.mock('../lib/supabase', () => ({
  READONLY: true,
  supabase: () => ({
    rpc: () => {
      throw new Error('Skrivebeskyttet forhåndsvisning: denne udgave må ikke ændre klubbens data.')
    },
  }),
}))

const { markSeen } = await import('./lastSeen')

it('does not write, and does not throw on its way to not writing', async () => {
  await expect(markSeen('u-1')).resolves.toBeUndefined()
})
