# Task: T022 CI pipeline + repo hooks (track D1+D2)

## Goal
Green GitHub checks become the judge for every session type: Actions runs
lint → build → unit tests → RLS suite (local Supabase stack in the runner) on
every push/PR. Repo-committed Claude Code hooks run lint on edit and the unit
suite on session stop.

## Acceptance criteria
- [ ] `.github/workflows/ci.yml`: lint, build, `npm test`, and `test:rls` against `supabase start` in the runner
- [ ] A red RLS test fails the check (prove it once with a deliberate breakage on a branch, then revert)
- [ ] `.claude/settings.json` hooks: oxlint post-edit, unit tests on stop
- [ ] SETUP.md gains a short CI section

## Scope
**May change:** `.github/`, `.claude/`, `docs/SETUP.md`
**Must NOT touch:** `src/`, `supabase/migrations/`, prod anything

## Docs affected
SETUP.md (CI section). CLAUDE.md contract already says "CI is the judge" implicitly via workbench SYSTEM.md — verify wording still holds.

## Size check
One focused session. Supabase-in-Actions may need iteration; cap at 3 attempts
per failure, per contract.

## Working notes (agent fills in)
- Approved by Lukas 2026-07-24 (track D, D4/Superpowers explicitly skipped).
