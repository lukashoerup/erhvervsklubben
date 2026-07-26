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
  PUBLIC_TABLES, SHARED_TABLES, PERSONAL_TABLES, ALL_TABLES,
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

  test.each([...SHARED_TABLES, ...PERSONAL_TABLES])('sees nothing in %s', async (t) => {
    const { data, error } = await anon.from(t).select('*')
    // RLS filters rows rather than erroring — zero rows IS the denial.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

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

  test('a member sees only their own account mapping', async () => {
    const { data } = await member2.from('user_member_mapping').select('*')
    // member2 is intentionally unmapped, so this is the empty case.
    expect(data).toEqual([])
  })

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

// ------------------------------------------------------- privilege boundary
describe('nobody can promote themselves', () => {
  test('a member cannot make themselves an admin', async () => {
    await member1.from('profiles').update({ role: 'admin' }).eq('id', SEED.member1.id)
    // profiles SELECT is own-only even for admins, so read the true state with
    // the service client, which bypasses RLS.
    const check = await service.from('profiles').select('role').eq('id', SEED.member1.id).single()
    expect(check.data?.role).toBe('user')
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
