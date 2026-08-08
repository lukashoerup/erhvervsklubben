// The access rule, written once as data.
//
// Every table in this app falls into one of three buckets. Stating them here
// and generating the tests from them beats enumerating table × actor ×
// operation by hand: the checks cannot drift from the rule, and adding a table
// forces a decision about which bucket it belongs to instead of quietly
// shipping untested.
//
// The rule in one sentence: signed-in people read the club's shared data,
// only admins change it, and personal rows are visible only to their owner.

/** Readable by anyone at all, including signed-out visitors. Admin-only writes. */
export const PUBLIC_TABLES = ['news', 'events'] as const

/**
 * The club's shared data: any signed-in member reads it all. Admin-only writes.
 *
 * `members` joined here on 2026-07-29 rather than with the finance tables: who
 * belongs to the club and who is on pause is its own composition, not a bank
 * balance, and §3's split is a rule members are held to. Writing is the part
 * that has to stay with the admins — a member able to edit his own row could
 * set himself inactive and stop being charged kontingent.
 */
export const SHARED_TABLES = ['attendance_records', 'attendances', 'members'] as const

/**
 * Personal rows — you see yours, not anyone else's.
 *
 * `member_last_seen` joined here on 2026-07-29 (T074). It is one timestamp per
 * account saying when that member last opened the site, and it is personal for
 * the same reason a member's own feedback is: it is a fact about a person, not
 * about the club. Like `event_evaluations` it also carries an admin read, which
 * is the whole point of writing it down — Lukas asked how often the members
 * visit and nothing in the app could answer him.
 *
 * What makes it unlike everything else in this file is the write side: it has
 * **no write policy at all**, for anyone, the admin included. The only way a row
 * can appear is `touch_last_seen()`, a security definer function that takes no
 * arguments and sets nothing but `auth.uid()`'s own timestamp. The alternative —
 * a column on `profiles`, reachable only by relaxing an UPDATE policy on the
 * table that holds `role` — is the trap this design exists to avoid. See the
 * migration, and the named tests at the bottom of rls.test.ts.
 */
export const PERSONAL_TABLES = ['profiles', 'event_evaluations'] as const

/**
 * Read by every signed-in member, written by **nobody** through the API.
 *
 * A fifth shape, added 2026-08-08 rather than squeezed into one of the four above,
 * because neither fits and the misfit is the interesting part.
 *
 * `member_last_seen` and `user_member_mapping` left `PERSONAL_TABLES` when Lukas
 * published login activity — his own wishlist item, and a reversal of T074's
 * deliberate fold. They are not `SHARED_TABLES`, because that bucket asserts an
 * admin *can* write, and `member_last_seen` has no write policy for anyone: its rows
 * appear only through `touch_last_seen()`, a security definer function that takes no
 * arguments. Filing it under SHARED would have quietly asserted the opposite of the
 * property that makes it safe.
 *
 * `user_member_mapping` is here for the reads and keeps its own admin-write policy,
 * which `ADMIN_WRITABLE` below states separately. It came along because the screen
 * shows *names*: opening only the timestamps leaves every member looking at nine
 * dates he cannot attach to anyone.
 *
 * `profiles` stays personal, and that is the line that matters — it holds `role`.
 */
export const MEMBER_READABLE_TABLES = ['user_member_mapping', 'member_last_seen'] as const

/**
 * Admin-only, read included. Ordinary members cannot see these at all.
 *
 * Note this breaks the otherwise tidy "members read everything" rule, which is
 * why it is its own bucket rather than a footnote. Lukas, 2026-07-26: "Not
 * everyone should know how much money is in the bank account." He is the
 * club's treasurer; the balance is his to see, not the membership's.
 *
 * Populated 2026-07-26 when the finance tables landed. The guard below is what
 * made that a decision rather than an oversight: an unclassified table fails
 * the suite by name.
 */
export const ADMIN_ONLY_TABLES = ['fines', 'payments'] as const

export const ALL_TABLES = [
  ...PUBLIC_TABLES, ...SHARED_TABLES, ...PERSONAL_TABLES,
  ...MEMBER_READABLE_TABLES, ...ADMIN_ONLY_TABLES,
]

/** Minimal valid rows, so a denial test fails on the policy and not on a
 *  NOT NULL constraint — a constraint error would look like a passing test. */
export const SAMPLE_ROW: Record<string, Record<string, unknown>> = {
  news: { title: 'probe', excerpt: 'probe', author: 'probe', date: '2025-01-01' },
  events: { title: 'probe', date: '2025-01-01', time: '18:00', location: 'probe', description: 'probe' },
  attendance_records: { meeting_number: 9999, lead: 'probe', main_location: 'probe' },
  attendances: { record_id: 1, member_name: 'probe', attended: true },
  // A status the check constraint accepts, or the denial tests would pass on a
  // constraint violation instead of on the policy.
  members: { name: 'probe', status: 'aktiv' },
  // Admin-only tables. A member must not be able to write these either — an
  // unwritable-but-readable balance would still be a leak, and a writable one
  // would let a member forgive their own fines.
  fines: { record_id: 1, member_name: 'probe', rule_id: 'skaal', amount_kr: 50 },
  payments: { month: '2026-01-01', amount_kr: 1 },
  // `member_last_seen` is deliberately absent. Its only column is a user id
  // that has to be a real account, and a made-up uuid here would risk the
  // denial landing on the foreign key rather than on the policy — the exact
  // failure this map exists to prevent. Its denials are written out by hand
  // with the seed users instead; see 'sidst set' in rls.test.ts.
}

/**
 * Tables an admin is expected to be able to write.
 *
 * `user_member_mapping` is listed by hand rather than by bucket: it is the one table
 * in `MEMBER_READABLE_TABLES` an admin may change, and `member_last_seen` — its
 * neighbour there — is writable by nobody at all. A bucket-wide rule would have to be
 * wrong about one of them.
 */
export const ADMIN_WRITABLE = [
  ...PUBLIC_TABLES, ...SHARED_TABLES, 'user_member_mapping',
] as const
