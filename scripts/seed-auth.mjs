// Seed auth users via the GoTrue admin API (task T012, auth part).
// Raw INSERTs into auth.users fail GoTrue's schema scan, so we create users the
// supported way. Then elevate the admin, add member mappings, and add one
// evaluation — all referencing the real generated user ids. Writes the ids to
// tests/rls/seed-ids.json for the RLS tests to import.
//
// Run after `supabase db reset`. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const db = createClient(URL, SERVICE, { auth: { persistSession: false } })
const PASSWORD = 'password123'

const users = [
  { key: 'admin', email: 'alice@test.local', role: 'admin', member: 'Alice' },
  { key: 'member1', email: 'bob@test.local', role: 'user', member: 'Bob' },
  { key: 'member2', email: 'chris@test.local', role: 'user', member: null }, // intentionally unmapped
]

const ids = {}
for (const u of users) {
  const { data, error } = await db.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${u.email}: ${error.message}`)
  ids[u.key] = data.user.id
  // The on_auth_user_created trigger already made a profiles row (role 'user').
  if (u.role === 'admin') {
    const { error: e } = await db.from('profiles').update({ role: 'admin' }).eq('id', data.user.id)
    if (e) throw new Error(`elevate admin: ${e.message}`)
  }
  if (u.member) {
    const { error: e } = await db.from('user_member_mapping').insert({ user_id: data.user.id, member_name: u.member })
    if (e) throw new Error(`map ${u.member}: ${e.message}`)
  }
}

// One evaluation owned by the admin (record 1) — all aspects rated.
const { error: evErr } = await db.from('event_evaluations').insert({
  user_id: ids.admin, record_id: 1,
  pre_surroundings_rating: 5, pre_drinks_rating: 4,
  location_surroundings_rating: 4, location_food_rating: 3, location_value_rating: 4,
  post_value_rating: 3, lead_agenda_rating: 5, lead_flow_rating: 5, lead_overall_rating: 5,
})
if (evErr) throw new Error(`evaluation: ${evErr.message}`)

const outfile = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'rls', 'seed-ids.json')
writeFileSync(outfile, JSON.stringify(ids, null, 2) + '\n')
console.log('seeded auth users:', ids)
