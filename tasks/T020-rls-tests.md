# Task: T020 RLS behaviour suite — rule-driven

## Goal
Cover the access rules properly, and fix one policy gap found while reading
them. Replaces the ~50-case table × actor × operation matrix from
PLAN-REVIEW Part B with tests generated from the rule itself.

## Why the plan changed (Lukas, 2026-07-26)
Lukas questioned the effort going into RLS, and stated the intended rule
plainly: *members should be able to see everything; they just should not be
able to edit attendance records or create news — that should only be admins.*

Two things came out of that.

**He was right about the scale.** Enumerating every table against every actor
against every operation mostly re-tests the same three ideas. The real rule is
three sentences, so the tests are now generated from it (`tests/rls/rules.ts`).
Fewer tests, better coverage, and adding a table forces a decision about which
bucket it belongs to rather than quietly shipping untested.

**He was not right that RLS is misguided, and it is worth writing down why.**
With Supabase the browser talks straight to the database — there is no server
of ours in between. The initial migration grants `authenticated` full access to
every table (`grant all on all tables ... to anon, authenticated`), and the
policies are the only thing narrowing that back down. They are not one layer
among several; they are the entire lock. A wrong policy lets a signed-in member
delete every news item from the browser console, with no exploit involved.

**What was already correct:** members read all attendance data and cannot write
it; news and events are public-read, admin-write. Lukas's intended rule was
already implemented — the tests just had to prove it.

## The policy gap found
`event_evaluations` had three policies, all owner-scoped, and no admin policy.
So the club admin could not read the feedback members submit — it went into the
table and nobody could ever look at it. Confirmed 2026-07-26 as an oversight,
not a decision.

Fixed by `supabase/migrations/20260726160000_admin_can_read_evaluations.sql`.
Members still see only their own; Postgres OR-combines permissive policies, so
this widens SELECT for admins only. DELETE stays absent for everyone —
deliberate, and Lukas chose to keep it that way.

## Acceptance criteria
- [ ] The rule lives in one place (`tests/rls/rules.ts`), tests generated from it
- [ ] Signed-out: reads public tables, sees nothing in gated ones, writes nothing
- [ ] Member: reads all shared data; cannot insert, update or delete any of it
- [ ] Admin: can create and remove rows in every admin-writable table
- [ ] Personal rows visible only to their owner
- [ ] Admin can read a **member's** feedback — asserted on someone else's row,
      since the seeded evaluation is the admin's own and would pass regardless
- [ ] Nobody can delete feedback, including the admin
- [ ] A member cannot promote themselves to admin
- [ ] A sweep proving no gated table is readable by the open internet
- [ ] Green in CI

## Scope
**May change:** `tests/rls/`, `supabase/migrations/` (the new policy only)
**Must NOT touch:** the initial schema migration — it is a verbatim snapshot of
prod and must stay faithful; changes go in new migrations

## Note on how this was verified
Written from a cloud session, which has no Docker and therefore cannot run the
suite. That is exactly why T022 came first: CI runs it against a real stack, so
these tests are proven rather than asserted. Per the contract, an agent's
self-report is not evidence — the CI run is.

## Docs affected
`docs/STATUS.md` (phase 2 state), `docs/PROJECT.md` decision log (the admin-read
policy is a permanent decision).

## Size check
One session.

## Working notes (agent fills in)
