# Task: T012 local-seed

## Goal
Deterministic synthetic seed for local/CI, reproducing the review's edge cases.

## Acceptance criteria
- [x] supabase/seed.sql: news/events/records/attendances incl. duplicate
      meeting_number 3 (one blank), a late joiner (Chris), an unmapped member (Dana)
- [x] scripts/seed-auth.mjs: 3 users via admin API (raw auth.users inserts fail
      GoTrue), admin elevation, mappings (member2 unmapped), 1 evaluation
- [x] `npm run test:rls:reset` applies + seeds + tests green

## Working notes
Auth users MUST be created via the GoTrue admin API, not SQL. Generated ids are
written to tests/rls/seed-ids.json for the tests.
