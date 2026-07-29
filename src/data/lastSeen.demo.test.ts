import { expect, it, vi } from 'vitest'

/**
 * The demo build must not record a visit — and, as with every other write, must
 * not *try* (T074).
 *
 * `build:demo` is a production build with VITE_DEMO=1 on top, so it carries the
 * club's live project URL and anon key. It holds no session, so the database
 * would refuse the call — but "nothing was sent" is a stronger promise than
 * "the database said no", and it is the one this repo makes. See
 * demoWrites.test.tsx, which makes it for the editing screens.
 *
 * Its own file because DEMO is read at module scope, which is what makes it a
 * property of the build rather than of a render.
 */
vi.stubEnv('VITE_DEMO', '1')

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => ({ rpc }) }))

const { markSeen } = await import('./lastSeen')

it('records nothing and asks the client for nothing', async () => {
  await markSeen('demo-user')
  expect(rpc).not.toHaveBeenCalled()
})
