# Erhvervsklubben rebuild — goals & decision log

## Goal
Replace the current Lovable frontend of the Erhvervsklubben members site with a
better-designed, genuinely mobile-friendly app on the SAME Supabase backend,
without losing data and without taking the old site down until an approved cutover.

## Success criteria
- Every current feature works: auth, news, events, the attendance/seniority
  matrix + charts, admin editing, per-user event evaluations.
- The attendance matrix is usable on a phone (the current one overflows even on desktop).
- All 235 attendances / 29 meetings / 10 members preserved; members keep their logins.
- The verbatim RLS security model is reproduced and proven by tests.
- Cutover is a config flip with instant rollback (old site keeps working).

## Decisions (permanent)
- **2026-07-23 — Stack:** React + Vite + TS + Tailwind v4 + supabase-js + React
  Router + TanStack Query + Recharts. Why: matches the existing Lovable output,
  keeps the same Supabase backend (auth continuity), trivial to host.
- **2026-07-23 — Hosting: Vercel.** Free tier, preview deploy per PR, cutover =
  env-var flip. (Lukas's call.)
- **2026-07-23 — Coexistence: parallel.** New site at a new URL; old Lovable site
  stays live and untouched until an explicit, Lukas-present cutover.
- **2026-07-23 — Same Supabase project at cutover** (not a fresh DB), so members
  keep logins and the 235 attendances never move. A disposable STAGING clone is
  used for dev; local Supabase stack for CI.
- **2026-07-23 — events & news stay PUBLIC (anon-readable).** Lukas's call; the
  current `USING (true)` SELECT policy is reproduced verbatim, no deviation.
- **2026-07-23 — RLS reproduced verbatim.** The `Only admins can update profiles`
  policy was verified NOT to allow self-escalation (members can't update profiles
  at all), so verbatim == secure; no policy changes needed.
- **2026-07-26 — first deliberate deviation from prod: admins can read all event
  evaluations.** Prod has three owner-scoped policies on `event_evaluations` and
  no admin policy, so the club admin could not read the feedback members submit —
  it went into the table and nobody could ever look at it. Lukas confirmed this
  was an oversight, not a decision. Members still see only their own; DELETE
  stays absent for everyone, deliberately. Must be applied to prod at cutover:
  `supabase/migrations/20260726160000_admin_can_read_evaluations.sql`.
- **2026-07-26 — the access rule is stated once, and tests are generated from it**
  (`tests/rls/rules.ts`), replacing the ~50-case table × actor × operation matrix.
  Lukas's rule: members read everything, only admins write, personal rows are
  owner-only. Enumerating the grid mostly re-tested the same three ideas; deriving
  from the rule means the tests cannot drift from it, and a new table forces a
  bucket decision instead of shipping untested. 40 assertions, ~1s.
  Why RLS matters here at all, recorded because it will be asked again: the
  browser talks straight to the database, and the initial migration grants
  `authenticated` full access to every table. The policies are not one layer
  among several — they are the entire lock.

- **2026-07-26 — signed-out visitors see no member data, and pages are gated
  too.** Lukas's requirement: attendance records, financials and similar must sit
  behind login. The data half is already enforced and tested (anon gets zero rows
  from every non-public table). The page half is T030. Both are needed and
  neither replaces the other: a route guard is not security, since anyone can
  bypass the JavaScript — the policies are the security, the guard is what makes
  the site behave correctly.
- **2026-07-26 — a new table must be classified before it ships.** The suite
  fails if any table the API exposes is missing from `tests/rls/rules.ts`. A
  table is reachable from the browser the moment it exists, so this turns "who
  may read this?" into a decision rather than an oversight. Relevant to the
  financials table when Q1 is resolved.

- **2026-07-26 — Q1 answered: finances come from a Google Sheet today, and will
  be derived instead.** Everything except money-actually-received is computable
  from data the club already holds — the database records every meeting, its
  lead, and who attended. The machine maintains the expected side; Lukas
  confirms the bank balance quarterly. No bank credentials and no aggregator
  subscription: his explicit choice, and it keeps the attack surface at zero.
  Blocked on the published fine rules — see T050.

## Local stack note
- **2026-07-23 — Local Supabase runs Postgres 17** (the CLI default), while prod
  is 15. Forcing local to 15 broke the bundled GoTrue's auth-schema migration
  (`confirmation_token` NULL scan errors, createUser failing). The engine version
  is irrelevant to what we test (our schema/RLS/policies), so we use the CLI's
  known-good 17 locally and diff the PUBLIC schema against the prod snapshot for
  parity — not the engine version.

## Backup
Read-only prod snapshot taken 2026-07-23 before any work: identity/mapping/counts
at `~/backups/erhvervsklubben/` (off-git, contains PII). A complete `pg_dump` is
task T000, and a fresh backup is a hard gate at cutover pre-flight.

## Open decisions (resolve at the noted phase; tracked as Q# in PLAN.md)
- Q1 finance-chart data source (no finance table exists) — blocks the finance chart.
- Q3 keep prod on free tier (auto-pauses) or upgrade to paid.
- Q4 new URL / domain (is erhvervsklubbensforum.dk yours?).
- Q5 two auth users have no member mapping — who are they?
- Q7 keep the event-evaluations feature (1 row ever written)?
