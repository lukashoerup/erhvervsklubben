import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Read here rather than imported from data/demo, which must not depend on this module. */
const DEMO = import.meta.env.VITE_DEMO === '1'

/**
 * A build that may read the club's live database but must never write to it.
 *
 * The club has fifteen years of history in Supabase and no backup of it, so a
 * preview pointed at the real project is only acceptable if writing is
 * impossible rather than merely discouraged. Two independent things enforce
 * that: the write-shaped UI is not rendered (see Oekonomi), and the client
 * below refuses the calls outright. Either alone would be a promise; together
 * they are a guarantee that survives someone forgetting the other.
 *
 * Never in the demo build. `build:demo` is a production build, so it picks up
 * .env.production and inherited this flag — which stripped the treasurer's
 * whole fine-recording screen out of the very build made for showing the app,
 * and left it claiming to read real data next to a banner saying the numbers
 * are invented. There is no database behind the demo, so there is nothing for
 * read-only to protect: the two modes are mutually exclusive by definition,
 * and saying so here is more reliable than hoping every build script sets the
 * variable correctly.
 */
export const READONLY = import.meta.env.VITE_READONLY === '1' && !DEMO

const REFUSED =
  'Skrivebeskyttet forhåndsvisning: denne udgave må ikke ændre klubbens data.'

/** PostgREST's mutating verbs — everything else on the builder is a read. */
const WRITES = new Set(['insert', 'update', 'upsert', 'delete'])

function refuse(): never {
  throw new Error(REFUSED)
}

/**
 * Wraps the client so the mutating verbs throw before any request is made.
 *
 * Only the first hop after `.from()` needs guarding, which is all PostgREST
 * requires: the write verbs are always that first call. Methods are bound back
 * to the real builder so chaining behaves exactly as it does unwrapped.
 */
function readOnly(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'rpc') return refuse
      if (prop === 'from') {
        return (table: string) =>
          new Proxy(target.from(table), {
            get(builder, method) {
              if (WRITES.has(method as string)) return refuse
              const value = Reflect.get(builder, method, builder)
              return typeof value === 'function' ? value.bind(builder) : value
            },
          })
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

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
  const created = createClient(url, anonKey)
  client = READONLY ? readOnly(created) : created
  return client
}

/** Test seam: drops the memoised client so a test can build a fresh one. */
export function resetSupabaseForTests() {
  client = null
}
