import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The club has no backup of fifteen years of history, so "this build cannot
 * write to the live database" is a claim that has to be tested rather than
 * asserted in a comment. Each case re-imports the module because the flag is
 * read once at load, exactly as it is in a real build.
 */
async function load(readonly: boolean) {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-for-tests')
  vi.stubEnv('VITE_READONLY', readonly ? '1' : '')
  return await import('./supabase')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('read-only build', () => {
  it.each(['insert', 'update', 'upsert', 'delete'] as const)(
    'refuses %s before any request is made',
    async (verb) => {
      const { supabase } = await load(true)
      const table = supabase().from('news') as unknown as Record<
        string,
        (row: unknown) => unknown
      >
      expect(() => table[verb]({ title: 'nope' })).toThrow(/[Ss]krivebeskyttet/)
    },
  )

  it('refuses rpc', async () => {
    const { supabase } = await load(true)
    expect(() => supabase().rpc('anything')).toThrow(/[Ss]krivebeskyttet/)
  })

  it('still allows reads to be built', async () => {
    const { supabase } = await load(true)
    const query = supabase().from('news').select('id').limit(1)
    expect(query).toBeDefined()
  })

  it('leaves the client untouched in a normal build', async () => {
    const { READONLY, supabase } = await load(false)
    expect(READONLY).toBe(false)
    expect(() => supabase().from('news').insert({ title: 'fine here' })).not.toThrow()
  })
})
