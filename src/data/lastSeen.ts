import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { READONLY, supabase } from '../lib/supabase'
import { DEMO, demoLastSeen, demoVisits, DEMO_ROSTER } from './demo'

/**
 * "Sidst set" — one timestamp per member, written when they open the site.
 *
 * The club could not say how often anyone visits. `auth.users.last_sign_in_at`
 * only moves when a password is typed, and a Supabase session lasts months.
 * What Lukas approved is deliberately the smallest thing that answers it: one
 * row, one timestamp, overwritten. **There is no record of what anyone looked
 * at, and adding one is not a small extension of this — it is a different
 * feature.**
 *
 * The write goes through `touch_last_seen()`, a security definer function that
 * takes no arguments and sets nothing but the timestamp on `auth.uid()`'s own
 * row. See the migration for why that, and not a column on `profiles`.
 */

/**
 * Whose visit has already been recorded this page load.
 *
 * Module scope, because "once per app load" is a property of the loaded page and
 * not of any component: the hook below lives in App, which survives every
 * navigation, but React's StrictMode runs effects twice in development and a
 * member who signs out and back in remounts the tree. Keyed by user id rather
 * than a boolean so signing in as somebody else is still recorded once —
 * two of the club's ten share a laptop.
 *
 * Set *before* the request rather than after, so two effects racing produce one
 * write instead of two.
 */
let recorded: string | null = null

/** Test seam: a fresh page load, without reloading the module. */
export function resetRecordedForTests() {
  recorded = null
}

/**
 * Record that this member was here. Fire-and-forget, and silent when it fails.
 *
 * Nothing on any screen depends on the result, so nothing waits for it and
 * nothing reports it. A member whose visit went unrecorded because the network
 * dropped should see the club's news, not an error about a feature he was never
 * told exists.
 *
 * The two builds that must not write are refused before the client rather than
 * by it. DEMO carries the live project's URL and anon key, so falling through
 * would fire at the club's real database from the build made for showing the
 * app. READONLY's client refuses `rpc` by *throwing*, which is the correct
 * behaviour for a screen's save button and the wrong one here — a read-only
 * preview of the club's real data must keep working, and a throw during an
 * effect on every page load is not "keeps working".
 */
export async function markSeen(userId: string | null): Promise<void> {
  if (!userId || DEMO || READONLY) return
  if (recorded === userId) return
  recorded = userId
  try {
    // No arguments, deliberately: there is no parameter in which a caller could
    // name somebody else's row. Errors are swallowed rather than thrown, and
    // supabase() itself throws synchronously when it has no configuration —
    // hence the try around the await and not a .catch() on the promise.
    // Two calls, because they answer two different questions and one cannot be
    // derived from the other. `touch_last_seen` overwrites a single timestamp —
    // *when was he last here* — and `touch_visit` adds a dated row if today has no
    // row yet: *how many days has he been here, and which*. Lukas asked for the
    // second on 2026-08-08, and it could not be answered from the first because the
    // first was designed to overwrite (T074).
    //
    // Settled together rather than awaited in turn: neither result is used, a
    // failure of one says nothing about the other, and one round trip's latency on
    // every page load is enough.
    await Promise.allSettled([
      supabase().rpc('touch_last_seen'),
      supabase().rpc('touch_visit'),
    ])
  } catch {
    // Silent by design. See above.
  }
}

/** Records the visit once, from the top of the app. */
export function useMarkSeen(userId: string | null): void {
  useEffect(() => {
    void markSeen(userId)
  }, [userId])
}

// ------------------------------------------------------------------ reading

/**
 * What the admin sees: member name → when that member last opened the site.
 *
 * Two flat reads rather than a join. There is no foreign key between
 * `member_last_seen` and anything member-shaped — it is keyed by the account,
 * because the account is the only identity the database can verify — so the
 * name comes from `user_member_mapping`, which an admin may read in full.
 *
 * A member missing from the result is not a zero. Two of the ten have no login
 * at all, and a member who has one may simply never have opened the new site;
 * those are different facts and the caller is given both by omission from
 * different maps. Guessing either into a date would be the one dishonest thing
 * this feature could do.
 */
export type LastSeen = {
  /** member name → ISO timestamp of their most recent visit. */
  seen: Record<string, string>
  /** Every member name that has a login, whether or not they have visited. */
  hasLogin: string[]
  /**
   * member name → the dates he opened the site, one entry per day, oldest first.
   *
   * Added 2026-08-08 for Lukas's *"hvor mange gange folk har været inde og
   * hvornår. En graf."* Empty for every member until then and thin for a while
   * after: `member_last_seen` overwrote itself by design (T074), so the only
   * history that existed to seed from was one date each. **The graph fills in
   * from 2026-08-08 forward** and there is no way to recover what came before.
   */
  visits: Record<string, string[]>
}

export function useLastSeen() {
  return useQuery({
    queryKey: ['last-seen'],
    queryFn: async (): Promise<LastSeen> => {
      if (DEMO) {
        return {
          seen: { ...demoLastSeen },
          hasLogin: DEMO_ROSTER.slice(0, 8),
          visits: demoVisits(),
        }
      }

      const [mapping, seen, visited] = await Promise.all([
        supabase().from('user_member_mapping').select('user_id, member_name'),
        supabase().from('member_last_seen').select('user_id, last_seen_at'),
        supabase().from('member_visits').select('user_id, visited_on'),
      ])
      // A member's own row comes back here too, which is harmless and is the
      // reason this is not gated on the response: the policy decides what is
      // returned, the page decides whether to ask. Both, never one.
      if (mapping.error) throw mapping.error
      if (seen.error) throw seen.error
      // Not thrown. `member_visits` arrived on 2026-08-08 and a database that
      // predates it should cost the graph and nothing else — the same trade
      // `readRecords` makes for its optional columns. An empty list draws an
      // empty chart, which is also what the club's first day looks like.
      const visitRows = visited.error
        ? []
        : ((visited.data ?? []) as { user_id: string; visited_on: string }[])

      const names = new Map(
        ((mapping.data ?? []) as { user_id: string; member_name: string }[]).map((m) => [
          m.user_id,
          m.member_name,
        ]),
      )
      const out: Record<string, string> = {}
      for (const row of (seen.data ?? []) as { user_id: string; last_seen_at: string }[]) {
        const name = names.get(row.user_id)
        // A row whose account has no mapping belongs to somebody the club list
        // cannot name — Claude's own admin account, for one. Nothing to show.
        if (name) out[name] = row.last_seen_at
      }
      const visits: Record<string, string[]> = {}
      for (const row of visitRows) {
        const name = names.get(row.user_id)
        if (!name) continue
        ;(visits[name] ??= []).push(row.visited_on)
      }
      for (const list of Object.values(visits)) list.sort()

      return { seen: out, hasLogin: [...names.values()], visits }
    },
  })
}
