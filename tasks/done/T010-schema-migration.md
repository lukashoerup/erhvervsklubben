# Task: T010 schema-extract → migration

## Goal
Reproduce prod's public schema + RLS + functions + signup trigger as a versioned
migration that applies cleanly to a fresh local stack.

## Acceptance criteria
- [x] supabase/migrations/..._initial_schema.sql: 7 tables, user_role enum,
      get_user_role + handle_new_user (SECURITY DEFINER), on_auth_user_created
      trigger, all 21 policies verbatim, RLS on all 7 tables, PostgREST grants
- [x] `supabase db reset` applies it with no error
- [x] Verified: 7 tables / 7 RLS-enabled / 21 policies / 2 sec-definer fns / 1 trigger

## Working notes
Grants were needed (hosted Supabase adds them automatically; a hand-authored
migration must). Local stack runs PG17 (CLI default) — forcing 15 broke GoTrue's
auth-schema migration. Prod is 15; parity is on our objects, not the engine.
