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

/** The club's shared data: any signed-in member reads it all. Admin-only writes. */
export const SHARED_TABLES = ['attendance_records', 'attendances'] as const

/** Personal rows — you see yours, not anyone else's. */
export const PERSONAL_TABLES = ['profiles', 'user_member_mapping', 'event_evaluations'] as const

/**
 * Admin-only, read included. Ordinary members cannot see these at all.
 *
 * Note this breaks the otherwise tidy "members read everything" rule, which is
 * why it is its own bucket rather than a footnote. Lukas, 2026-07-26: "Not
 * everyone should know how much money is in the bank account." He is the
 * club's treasurer; the balance is his to see, not the membership's.
 *
 * Empty until the finance table exists (T050) — the guard below will refuse to
 * let it ship unclassified.
 */
export const ADMIN_ONLY_TABLES = [] as const

export const ALL_TABLES = [
  ...PUBLIC_TABLES, ...SHARED_TABLES, ...PERSONAL_TABLES, ...ADMIN_ONLY_TABLES,
]

/** Minimal valid rows, so a denial test fails on the policy and not on a
 *  NOT NULL constraint — a constraint error would look like a passing test. */
export const SAMPLE_ROW: Record<string, Record<string, unknown>> = {
  news: { title: 'probe', excerpt: 'probe', author: 'probe', date: '2025-01-01' },
  events: { title: 'probe', date: '2025-01-01', time: '18:00', location: 'probe', description: 'probe' },
  attendance_records: { meeting_number: 9999, lead: 'probe', main_location: 'probe' },
  attendances: { record_id: 1, member_name: 'probe', attended: true },
}

/** Tables an admin is expected to be able to write. */
export const ADMIN_WRITABLE = [...PUBLIC_TABLES, ...SHARED_TABLES] as const
