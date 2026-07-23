// @vitest-environment node
// Core RLS behaviour against the local stack (a representative subset of the
// PLAN-REVIEW Part B spec — the security net). Expand to the full matrix next.
import { beforeAll, describe, expect, test } from 'vitest'
import { anonClient, serviceClient, signedInClient, SEED, RLS_DENIED } from './clients'
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

describe('anon read boundary', () => {
  test('RLS-N1/E1: anon CAN read news + events (public policy)', async () => {
    expect((await anon.from('news').select('*')).data?.length).toBeGreaterThan(0)
    expect((await anon.from('events').select('*')).data?.length).toBeGreaterThan(0)
  })
  test('RLS-A1/AR1/P1/M1/EV1: anon reads gated tables → 0 rows, no error', async () => {
    for (const t of ['attendances', 'attendance_records', 'profiles', 'user_member_mapping', 'event_evaluations']) {
      const { data, error } = await anon.from(t).select('*')
      expect(error).toBeNull()
      expect(data).toEqual([])
    }
  })
})

describe('member write denial', () => {
  test('RLS-N4/E4/AR4: member INSERT into admin-gated tables denied (42501)', async () => {
    const n = await member1.from('news').insert({ title: 'x', excerpt: 'x', author: 'x', date: '2025-01-01' })
    expect(n.error?.code).toBe(RLS_DENIED)
    const e = await member1.from('events').insert({ title: 'x', date: '2025-01-01', time: 'x', location: 'x', description: 'x' })
    expect(e.error?.code).toBe(RLS_DENIED)
    const r = await member1.from('attendance_records').insert({ meeting_number: 99, lead: 'x', main_location: 'x' })
    expect(r.error?.code).toBe(RLS_DENIED)
  })
  test('RLS-A4: member cannot even self-report an attendance', async () => {
    const a = await member1.from('attendances').insert({ record_id: 1, member_name: 'Bob', attended: true })
    expect(a.error?.code).toBe(RLS_DENIED)
  })
})

describe('admin writes', () => {
  test('RLS-N7: admin CRUD on news round-trips', async () => {
    const ins = await admin.from('news').insert({ title: 'T', excerpt: 'E', author: 'A', date: '2025-01-01' }).select().single()
    expect(ins.error).toBeNull()
    const del = await admin.from('news').delete().eq('id', ins.data!.id)
    expect(del.error).toBeNull()
  })
})

describe('event_evaluations isolation', () => {
  test('RLS-EV2/EV3: member sees only own evaluations', async () => {
    // Alice (admin) owns the seeded evaluation; member1/member2 own none.
    expect((await member1.from('event_evaluations').select('*')).data).toEqual([])
    expect((await member2.from('event_evaluations').select('*')).data).toEqual([])
  })
  test('RLS-EV5: member cannot forge an evaluation as another user', async () => {
    const f = await member1.from('event_evaluations').insert({
      user_id: SEED.member2.id, record_id: 1,
      pre_surroundings_rating: 5, pre_drinks_rating: 5,
      location_surroundings_rating: 5, location_food_rating: 5, location_value_rating: 5,
      post_value_rating: 5, lead_agenda_rating: 5, lead_flow_rating: 5, lead_overall_rating: 5,
    })
    expect(f.error?.code).toBe(RLS_DENIED)
  })
})

describe('privilege escalation', () => {
  test('RLS-P4: member cannot promote self to admin', async () => {
    await member1.from('profiles').update({ role: 'admin' }).eq('id', SEED.member1.id)
    // profiles SELECT is own-only even for admins, so verify true state via the
    // service-role client (bypasses RLS).
    const check = await service.from('profiles').select('role').eq('id', SEED.member1.id).single()
    expect(check.data?.role).toBe('user')
  })

  test('RLS-P3: admin cannot read another member\'s profile (own-only SELECT)', async () => {
    // Documents the real policy — there is no admin-read-all on profiles.
    const asAdmin = await admin.from('profiles').select('*').eq('id', SEED.member1.id)
    expect(asAdmin.data).toEqual([])
  })
})
