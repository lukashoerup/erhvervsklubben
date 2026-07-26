# Task: T022 CI pipeline + repo hooks (track D1+D2)

## Goal
Green GitHub checks become the judge for every session type: Actions runs
lint → build → unit tests → RLS suite (local Supabase stack in the runner) on
every push/PR. Repo-committed Claude Code hooks run lint on edit and the unit
suite on session stop.

## Acceptance criteria
- [x] `.github/workflows/ci.yml`: lint, build, `npm test`, and `test:rls` against `supabase start` in the runner
- [x] A red RLS test fails the check (prove it once with a deliberate breakage on a branch, then revert)
- [x] `.claude/settings.json` hooks: oxlint post-edit, unit tests on stop
- [x] SETUP.md gains a short CI section

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
- Done 2026-07-26 from a cloud session. Supabase-in-Actions needed **no**
  iteration — the stack booted and the suite passed first try.

### Why this task went before T020
A cloud session has no Docker, so the RLS suite cannot run there. An agent
writing RLS cases without a stack would be asserting they pass, which the
contract explicitly forbids ("tests are the judge, never an agent's
self-report"). CI is what restores that guarantee for the largest remaining
piece of work in the repo, so it had to come first.

### Proof that the check actually catches a regression
Not just that it runs — that it fails for the right reason.

A deliberate policy regression was pushed on `prove/ci-catches-rls-regression`:
a migration granting `anon` SELECT on `attendances`.

- Run 30207096742 (clean branch): `checks` ✅, `rls` ✅
- Run 30207261455 (with regression): `checks` ✅, `rls` ❌ at
  `tests/rls/rls.test.ts:31` — the `RLS-A1/AR1/P1/M1/EV1` assertion that anon
  reads of gated tables return zero rows. The failure diff showed real
  attendance rows (Alice, Bob, Chris, Dana) reaching an anonymous client.

Right test, right line, right reason.

The regression was reverted. **The branch could not be deleted** — this
session's git proxy refuses ref deletion (HTTP 403) — so the offending
migration was removed from it instead, leaving the branch harmless. It is safe
to merge or ignore, but it should be deleted in the GitHub UI when convenient.

### Decisions worth keeping
- **Two jobs, not one.** `checks` is seconds and offline; `rls` pulls container
  images and takes minutes. Split so a lint error reports immediately rather
  than behind a stack boot, and so a red RLS suite is distinguishable at a
  glance from a red build — one is a policy regression, the other is not.
- **CI runs `npm run test:rls:reset`**, the repo's own script, rather than
  restating its steps in YAML. CI and a laptop then execute literally the same
  sequence, so CI cannot drift into testing something else.
- **Supabase CLI installed globally at a pinned version**, not via a
  marketplace action. An action is a dependency and the contract forbids adding
  those unasked; a global install touches the runner only. Pinned because an
  unpinned CLI lets an upstream release turn the suite red with no change here,
  and that failure would read as a policy regression.
- **The RLS suite is deliberately not hooked** in `.claude/settings.json`. It
  needs the stack running; hooking it would make every session stop either slow
  or spuriously red.

### Follow-up noticed, not acted on
GitHub warns that `actions/checkout@v4` and `actions/setup-node@v4` target
Node 20, which is deprecated; they are currently forced onto Node 24 and work
fine. Bumping to v5 is the fix, but this session cannot reach the GitHub API for
those repos to confirm v5 exists, and guessing a version is how CI breaks for no
reason. Verify and bump in a session that can check.
