import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Created lazily rather than at module load.
 *
 * The fast test suite imports components that transitively reach this file, and
 * those tests supply their own auth state — so constructing a client (and
 * throwing on missing env) at import time would break `npm test` for everyone
 * without a local stack. Nothing calls this until something actually queries.
 */
let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (client) return client
  if (!url || !anonKey) {
    throw new Error(
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
        'Copy them from `npm run db:start` output, or see docs/SETUP.md.',
    )
  }
  client = createClient(url, anonKey)
  return client
}
