// @vitest-environment node
//
// RLS behaviour against the local stack. These policies are not one safety
// layer among several — with Supabase the browser talks straight to the
// database, and the migration grants every signed-in user full table access.
// The policies are the entire lock. A wrong one lets a member delete all news
// from the browser console, no exploit required.
//
// Generated from the rule in ./rules.ts rather than enumerated by hand, so the
// tests cannot drift from the rule and a new table cannot ship untested.
import { beforeAll, describe, expect, test } from 'vitest'
import { anonClient, serviceClient, signedInClient, SEED, RLS_DENIED } from './clients'
import {
  PUBLIC_TABLES, SHARED_TABLES, PERSONAL_TABLES, MEMBER_READABLE_TABLES,
  ADMIN_ONLY_TABLES, ALL_TABLES,
  ADMIN_WRITABLE, SAMPLE_ROW,
} from './rules'
import type { SupabaseClient } from '@supabase/supabase-js'

let anon: SupabaseClient
let service: SupabaseClient
let admin: SupabaseClient
let member1: SupabaseClient
let member2: SupabaseClient

beforeAll(async () => {
  anon = anonClient()
  service = serviceClient()
  admin = await signedInClient(SEED.admin.email)
  member1 = await signedInClient(SEED.member1.email)
  member2 = await signedInClient(SEED.member2.email)
})

// --------------------------------------------------------------- signed out
describe('a signed-out visitor', () => {
  test.each(PUBLIC_TABLES)('reads %s', async (t) => {
    const { data, error } = await anon.from(t).select('*')
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  // `MEMBER_READABLE_TABLES` joined this list on 2026-08-08 and belongs in it: the
  // policies opened that day are `to authenticated`, so publishing login activity
  // published it to the *club*, not to the internet. Anon still sees nothing.
  test.each([...SHARED_TABLES, ...PERSONAL_TABLES, ...MEMBER_READABLE_TABLES])(
    'sees nothing in %s',
    async (t) => {
      const { data, error } = await anon.from(t).select('*')
      // RLS filters rows rather than erroring — zero rows IS the denial.
      expect(error).toBeNull()
      expect(data).toEqual([])
    },
  )

  test.each(Object.keys(SAMPLE_ROW))('cannot write to %s', async (t) => {
    const { error } = await anon.from(t).insert(SAMPLE_ROW[t])
    expect(error?.code).toBe(RLS_DENIED)
  })
})

// ---------------------------------------------------------------- a member
describe('a signed-in member', () => {
  test.each([...PUBLIC_TABLES, ...SHARED_TABLES])('reads all of %s', async (t) => {
    const { data, error } = await member1.from(t).select('*')
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  // `MEMBER_READABLE_TABLES` is asserted on the *policy* rather than on a row count.
  // Its two tables are written by nobody the seed can act as — `member_last_seen`
  // and `member_visits` only ever fill through their functions — so a fresh
  // database has them empty, and "> 0 rows" would be testing seed data rather than
  // access. That these reads really are unfiltered is asserted by name further
  // down, where rows exist because the test just made them.
  test.each(MEMBER_READABLE_TABLES)('is not refused %s', async (t) => {
    const { error } = await member1.from(t).select('*')
    expect(error).toBeNull()
  })

  test.skipIf(ADMIN_ONLY_TABLES.length === 0)
    .each(ADMIN_ONLY_TABLES)('sees nothing in %s — admin only', async (t) => {
      // The club's money is the treasurer's business, not the membership's
      // (Lukas, 2026-07-26). This is the one place a member is denied a read,
      // so it gets its own test rather than riding along with the others.
      const { data, error } = await member1.from(t).select('*')
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

  test.each(Object.keys(SAMPLE_ROW))('cannot create in %s', async (t) => {
    const { error } = await member1.from(t).insert(SAMPLE_ROW[t])
    expect(error?.code).toBe(RLS_DENIED)
  })

  test.each(ADMIN_WRITABLE)('cannot change existing rows in %s', async (t) => {
    const before = await service.from(t).select('*').limit(1).single()
    await member1.from(t).update(SAMPLE_ROW[t]).eq('id', before.data!.id)
    // A blocked UPDATE is not an error — it matches zero writable rows and
    // reports success having changed nothing. So the assertion has to be that
    // the row is untouched, not that an error came back.
    const after = await service.from(t).select('*').eq('id', before.data!.id).single()
    expect(after.data).toEqual(before.data)
  })

  test.each(ADMIN_WRITABLE)('cannot delete from %s', async (t) => {
    const before = await service.from(t).select('id').limit(1).single()
    await member1.from(t).delete().eq('id', before.data!.id)
    const still = await service.from(t).select('id').eq('id', before.data!.id)
    expect(still.data?.length).toBe(1)
  })
})

// ----------------------------------------------------------------- an admin
describe('an admin', () => {
  test.each(ADMIN_WRITABLE)('can create and remove rows in %s', async (t) => {
    const ins = await admin.from(t).insert(SAMPLE_ROW[t]).select().single()
    expect(ins.error).toBeNull()
    const del = await admin.from(t).delete().eq('id', ins.data!.id)
    expect(del.error).toBeNull()
    const gone = await service.from(t).select('id').eq('id', ins.data!.id)
    expect(gone.data).toEqual([])
  })
})

// ------------------------------------------------------------ personal rows
describe('personal data stays personal', () => {
  test('a member sees only their own profile', async () => {
    const { data } = await member1.from('profiles').select('*')
    expect(data?.map((r) => r.id)).toEqual([SEED.member1.id])
  })

  // `user_member_mapping` left this describe on 2026-08-08. It was own-row-only
  // until Lukas published login activity, and the names had to open with the
  // timestamps or the club would read nine dates it could not attach to anyone.
  // What it became is asserted under "sidst set" below; what stays personal is
  // `profiles`, which is the row above this one and the line that matters.

  test('a member cannot read another member\'s feedback', async () => {
    // The seeded evaluation belongs to the admin.
    expect((await member1.from('event_evaluations').select('*')).data).toEqual([])
    expect((await member2.from('event_evaluations').select('*')).data).toEqual([])
  })

  test('a member cannot submit feedback in someone else\'s name', async () => {
    const { error } = await member1.from('event_evaluations').insert({
      user_id: SEED.member2.id, record_id: 1,
      pre_surroundings_rating: 5, pre_drinks_rating: 5,
      location_surroundings_rating: 5, location_food_rating: 5, location_value_rating: 5,
      post_value_rating: 5, lead_agenda_rating: 5, lead_flow_rating: 5, lead_overall_rating: 5,
    })
    expect(error?.code).toBe(RLS_DENIED)
  })

  test('a member can submit and edit their own feedback', async () => {
    const ins = await member1.from('event_evaluations').insert({
      user_id: SEED.member1.id, record_id: 2,
      pre_surroundings_rating: 3, pre_drinks_rating: 3,
      location_surroundings_rating: 3, location_food_rating: 3, location_value_rating: 3,
      post_value_rating: 3, lead_agenda_rating: 3, lead_flow_rating: 3, lead_overall_rating: 3,
    }).select().single()
    expect(ins.error).toBeNull()

    const upd = await member1.from('event_evaluations')
      .update({ lead_overall_rating: 5 }).eq('id', ins.data!.id).select().single()
    expect(upd.error).toBeNull()
    expect(upd.data!.lead_overall_rating).toBe(5)

    await service.from('event_evaluations').delete().eq('id', ins.data!.id)
  })

  test('the admin CAN read a member\'s feedback', async () => {
    // Added 2026-07-26. Without this policy the club admin could not read the
    // feedback members submit — it went in and nobody could ever look at it.
    //
    // Deliberately asserts on a row belonging to *someone else*. The seeded
    // evaluation is the admin's own, so asserting "admin sees at least one"
    // would pass with or without the new policy and prove nothing.
    const theirs = await member1.from('event_evaluations').insert({
      user_id: SEED.member1.id, record_id: 3,
      pre_surroundings_rating: 2, pre_drinks_rating: 2,
      location_surroundings_rating: 2, location_food_rating: 2, location_value_rating: 2,
      post_value_rating: 2, lead_agenda_rating: 2, lead_flow_rating: 2, lead_overall_rating: 2,
    }).select().single()
    expect(theirs.error).toBeNull()

    const seen = await admin.from('event_evaluations').select('id,user_id')
    expect(seen.error).toBeNull()
    expect(seen.data?.map((r) => r.id)).toContain(theirs.data!.id)

    await service.from('event_evaluations').delete().eq('id', theirs.data!.id)
  })

  test('nobody can delete feedback, including the admin', async () => {
    const seeded = await service.from('event_evaluations').select('id').limit(1).single()
    await admin.from('event_evaluations').delete().eq('id', seeded.data!.id)
    const still = await service.from('event_evaluations').select('id').eq('id', seeded.data!.id)
    expect(still.data?.length).toBe(1)
  })
})

// --------------------------------------------------------------- sidst set
//
// The one table in this app whose contents a member can cause to be written, so
// it gets named tests rather than generated ones.
//
// The trap it was designed around: `profiles` holds `role`, and its only UPDATE
// policy is what stops a member promoting himself. Putting `last_seen` there
// would have meant relaxing that policy, which is a write path to `role`. So the
// timestamp lives in its own table with no write policy at all, reachable only
// through a security definer function that takes no arguments. Each test below
// is one sentence of that claim.
describe('sidst set', () => {
  /** True state, RLS bypassed. */
  const stored = async (id: string) =>
    (await service.from('member_last_seen').select('last_seen_at').eq('user_id', id)).data ?? []

  test('a member records their own visit, and has no way to name anyone else', async () => {
    const { error } = await member1.rpc('touch_last_seen')
    expect(error).toBeNull()

    expect((await stored(SEED.member1.id)).length).toBe(1)
    // The function takes no arguments, so there is no parameter in which
    // member1 could have named member2. The property is in the signature, not
    // in a policy someone has to keep correct.
    expect(await stored(SEED.member2.id)).toEqual([])
  })

  test('calling it again moves the timestamp and adds no row', async () => {
    // One row per member, overwritten: the count of visits is unrecoverable by
    // construction. That is the half Lukas asked for, and the half that keeps
    // this from turning into a visit log.
    await service
      .from('member_last_seen')
      .update({ last_seen_at: '2020-01-01T00:00:00Z' })
      .eq('user_id', SEED.member1.id)

    await member1.rpc('touch_last_seen')

    const rows = await stored(SEED.member1.id)
    expect(rows.length).toBe(1)
    expect(new Date(rows[0].last_seen_at as string).getFullYear()).toBeGreaterThan(2020)
  })

  // Ordered before the denial tests that follow *and* independent of them: this
  // used to call `member2.rpc('touch_last_seen')`, which left member2 a row and made
  // "a member cannot write anyone else's timestamp" pass or fail on test order
  // rather than on the policy. It seeds through the service client instead, which
  // is not the path under test.
  test('every member reads the whole club\'s, and can name them', async () => {
    // Lukas published this on 2026-08-08 — his own wishlist, and a reversal of the
    // fold T074 built deliberately. Two tables, because a timestamp nobody can
    // attach to a name is a worse object than either the closed or the open
    // version: `user_member_mapping` opened with it.
    await member1.rpc('touch_last_seen')
    await service
      .from('member_last_seen')
      .upsert({ user_id: SEED.member2.id, last_seen_at: new Date().toISOString() })

    const seen = await member1.from('member_last_seen').select('user_id')
    expect(seen.error).toBeNull()
    expect(seen.data?.map((r) => r.user_id)).toContain(SEED.member2.id)

    const names = await member1.from('user_member_mapping').select('user_id, member_name')
    expect(names.error).toBeNull()
    expect((names.data ?? []).length).toBeGreaterThan(1)
  })

  test('publishing the read did not open a write', async () => {
    // The whole feature was "let the club see it". A member who can also *write* it
    // can forge when he was last here, and the list stops being worth reading.
    // Asserted on the outcome rather than on the policy list: an UPDATE no policy
    // permits changes no rows, so the timestamp is unmoved either way.
    await member1.rpc('touch_last_seen')
    const before = (await stored(SEED.member1.id))[0].last_seen_at

    await member1
      .from('member_last_seen')
      .update({ last_seen_at: '1999-01-01T00:00:00Z' })
      .eq('user_id', SEED.member1.id)

    expect((await stored(SEED.member1.id))[0].last_seen_at).toBe(before)
  })

  test('a member cannot write anyone else\'s timestamp', async () => {
    const { error } = await member1.from('member_last_seen').insert({ user_id: SEED.member2.id })
    expect(error?.code).toBe(RLS_DENIED)
    expect(await stored(SEED.member2.id)).toEqual([])
  })

  test('a member cannot write even their own row directly', async () => {
    // Not belt and braces — this is what makes the test above hold. The table
    // has no write policy, so the only write path is the function, and the
    // function is the thing that cannot be aimed at somebody else.
    const { error } = await member1
      .from('member_last_seen')
      .insert({ user_id: SEED.member1.id, last_seen_at: '1999-01-01T00:00:00Z' })
    expect(error?.code).toBe(RLS_DENIED)

    // UPDATE and DELETE are denied by matching no rows rather than by erroring,
    // so they are asserted on the row and not on an error code.
    const before = await stored(SEED.member1.id)
    await member1
      .from('member_last_seen')
      .update({ last_seen_at: '1999-01-01T00:00:00Z' })
      .eq('user_id', SEED.member1.id)
    await member1.from('member_last_seen').delete().eq('user_id', SEED.member1.id)
    expect(await stored(SEED.member1.id)).toEqual(before)
  })

  test('not even an admin can write it by hand', async () => {
    const { error } = await admin.from('member_last_seen').insert({ user_id: SEED.member2.id })
    expect(error?.code).toBe(RLS_DENIED)
  })

  test('a signed-out visitor can neither write it nor call the function', async () => {
    const written = await anon.from('member_last_seen').insert({ user_id: SEED.member1.id })
    expect(written.error?.code).toBe(RLS_DENIED)
    // No execute grant, so anon is refused before the function's own
    // "no session, no row" guard is ever reached.
    expect((await anon.rpc('touch_last_seen')).error).not.toBeNull()
  })

  test('every member sees the club\'s visits, not only his own', async () => {
    // Reversed 2026-08-08, deliberately: Lukas published login activity off his own
    // wishlist. Until then this test asserted the exact opposite and was right to.
    // What did *not* change is the write side, which the tests around this one hold.
    await member2.rpc('touch_last_seen')
    await member1.rpc('touch_last_seen')

    const theirs = await member1.from('member_last_seen').select('user_id')
    expect(theirs.data?.map((r) => r.user_id)).toEqual(
      expect.arrayContaining([SEED.member1.id, SEED.member2.id]),
    )
  })

  test('recording a visit cannot touch anything else, least of all a role', async () => {
    // The whole reason this is not a column on `profiles`. If the write path
    // ever widened, this is the assertion that goes red.
    await member1.rpc('touch_last_seen')
    const check = await service.from('profiles').select('role').eq('id', SEED.member1.id).single()
    expect(check.data?.role).toBe('user')
  })
})

// ------------------------------------------------------- privilege boundary
describe('nobody can promote themselves', () => {
  test('a member cannot make themselves an admin', async () => {
    await member1.from('profiles').update({ role: 'admin' }).eq('id', SEED.member1.id)
    // profiles SELECT is own-only even for admins, so read the true state with
    // the service client, which bypasses RLS.
    const check = await service.from('profiles').select('role').eq('id', SEED.member1.id).single()
    expect(check.data?.role).toBe('user')
  })

  test('every table the API exposes has been classified in rules.ts', async () => {
    // The guard that makes "signed-out visitors cannot read member data" hold
    // for tables that do not exist yet. A new table — financials, say — is
    // exposed to the browser the moment it is created, and every test above
    // only covers tables someone remembered to list. This one fails instead,
    // forcing a decision about who may read it.
    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const spec = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).then((r) => r.json() as Promise<{ paths?: Record<string, unknown> }>)

    const exposed = Object.keys(spec.paths ?? {})
      .map((p) => p.replace(/^\//, ''))
      .filter((p) => p !== '' && !p.startsWith('rpc/'))

    const unclassified = exposed.filter((t) => !ALL_TABLES.includes(t))
    expect(
      unclassified,
      `unclassified table(s): ${unclassified.join(', ')}. Add each to ` +
        'tests/rls/rules.ts — PUBLIC_TABLES, SHARED_TABLES, PERSONAL_TABLES, ' +
        'MEMBER_READABLE_TABLES or ADMIN_ONLY_TABLES — ' +
        'so who can read it is a decision rather than an accident.',
    ).toEqual([])
  })

  test('no gated table is readable by the open internet', async () => {
    // The check that catches the worst possible mistake. A table added without
    // row level security is wide open to anyone who opens the browser console,
    // and no per-policy test would notice, because there are no policies to
    // test. Sweeping every known table means forgetting one is what fails.
    const gated = ALL_TABLES.filter((t) => !PUBLIC_TABLES.includes(t as never))
    for (const t of gated) {
      const { data } = await anon.from(t).select('*')
      expect(data, `${t} is readable by a signed-out visitor — is RLS enabled?`).toEqual([])
    }
  })
})

// ------------------------------------------------------------ news, drafts and the board
//
// Lukas, 2026-08-08: "alle kan skrive nyheder, men skal godkendes af bestyrelsen."
// The generated tests above still assert that a member cannot create a *published*
// item, which is half the rule. This is the other half, and it needs naming rather
// than generating because the two cases differ by one column.
describe('news drafts', () => {
  const draft = (author_id: string) => ({
    title: 'kladde', excerpt: 'kladde', author: 'probe',
    date: '2026-08-08', status: 'kladde', author_id,
  })

  test('a member may write his own draft', async () => {
    const { error } = await member1.from('news').insert(draft(SEED.member1.id))
    expect(error).toBeNull()
  })

  test('a member cannot publish, on the way in or afterwards', async () => {
    // The whole feature in two statements. Both are refused by `with check`, which
    // is why the policy carries one on INSERT *and* UPDATE — with only the first, a
    // member could insert a draft and immediately approve it.
    const straight = await member1
      .from('news')
      .insert({ ...draft(SEED.member1.id), status: 'godkendt' })
    expect(straight.error?.code).toBe(RLS_DENIED)

    const mine = await member1.from('news').insert(draft(SEED.member1.id)).select().single()
    expect(mine.error).toBeNull()
    const promote = await member1
      .from('news')
      .update({ status: 'godkendt' })
      .eq('id', (mine.data as { id: string }).id)
    expect(promote.error?.code).toBe(RLS_DENIED)
  })

  test('a member cannot write a draft in someone else’s name', async () => {
    const { error } = await member1.from('news').insert(draft(SEED.member2.id))
    expect(error?.code).toBe(RLS_DENIED)
  })

  test('a draft is invisible to the public and to the other members', async () => {
    // `news` is anon-readable by the club's 2026-07-23 decision, so this is the one
    // that would be a leak if the policy were wrong: an unapproved item on the
    // internet.
    const mine = await member1.from('news').insert(draft(SEED.member1.id)).select().single()
    const id = (mine.data as { id: string }).id

    expect((await anon.from('news').select('id').eq('id', id)).data).toEqual([])
    expect((await member2.from('news').select('id').eq('id', id)).data).toEqual([])
    expect((await member1.from('news').select('id').eq('id', id)).data).toHaveLength(1)
    expect((await admin.from('news').select('id').eq('id', id)).data).toHaveLength(1)
  })

  test('the board publishes it, and then it is everyone’s', async () => {
    const mine = await member1.from('news').insert(draft(SEED.member1.id)).select().single()
    const id = (mine.data as { id: string }).id

    const { error } = await admin.from('news').update({ status: 'godkendt' }).eq('id', id)
    expect(error).toBeNull()
    expect((await anon.from('news').select('id').eq('id', id)).data).toHaveLength(1)

    // And the writer can no longer touch it: it is the club's now, not his.
    const late = await member1.from('news').update({ title: 'omskrevet' }).eq('id', id)
    expect((await member1.from('news').select('title').eq('id', id)).data?.[0].title).toBe('kladde')
    expect(late.error ?? null).toBeNull()
  })
})
