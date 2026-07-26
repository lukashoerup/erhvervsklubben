# Status — Erhvervsklubben rebuild

_Updated 2026-07-26. Single source of truth for "where are we". Update this at the
end of every working session._

## Phase progress
| Phase | What | State |
|---|---|---|
| 0 | Repo + app scaffold + green pipeline | ✅ **done** (T001) |
| 1 | Schema-as-migration, seed, local stack | ✅ **done** (T010, T012) |
| 2 | RLS test suite | ✅ **done** (T020) — 40 assertions generated from the rule, green in CI |
| 3 | App shell + auth + role gating | ⬜ not started |
| 4 | Read-only screens (landing, about, news, events, seniority data layer) | ⬜ not started |
| 5 | Anciennitet UI (matrix + charts) | ⬜ not started |
| 6 | Admin write flows | ⬜ not started |
| 7 | Design-template integration | ⬜ waiting on Lukas's Claude Design template |
| 8 | Deploy to Vercel (staging) + e2e | ⬜ not started |
| 9 | Cutover (old site stays live until then) | ⬜ not started |

Full task breakdown: [PLAN.md](PLAN.md) §4. Test spec: [PLAN-REVIEW.md](PLAN-REVIEW.md).

## Green right now
- `npm test` — 1 component/unit test (jsdom, fast, offline).
- `npm run build`, `npm run lint` — clean.
- `npm run test:rls` — 40 RLS assertions vs the local Supabase stack (~1s).
- **CI on every push/PR** (`.github/workflows/ci.yml`): `checks` (lint, build,
  unit) and `rls` (Supabase stack in the runner + the RLS suite). Both green,
  and the `rls` job is proven to go red on a real policy regression — see
  T022's working notes for the evidence.
- Migrations apply clean: 7 tables / 7 RLS-enabled / **22** policies / 2 SECURITY
  DEFINER functions / 1 signup trigger. The initial migration is faithful to prod
  (verified 2026-07-24); the 22nd policy is the deliberate 2026-07-26 deviation
  letting admins read member feedback — see PROJECT.md. It must be applied to
  prod at cutover.

## Immediate next tasks (resume here)
1. **Phase 3 — app shell + auth + role gating.** Phase 2 is closed: the access
   rule is covered by 40 generated assertions and CI proves them against a real
   stack. Two spec items were deliberately dropped as redundant under the
   rule-driven approach (the per-cell grid from PLAN-REVIEW Part B); the signup
   trigger cases T1–T3 are still worth adding when auth work starts, since that
   is when the trigger actually matters.
2. **T011 — automated schema parity** (`tests/schema/parity.sh`): diff local
   objects (pg_policies, pg_proc, pg_trigger, relrowsecurity, FK confdeltype,
   grants) against the prod snapshot. Currently fidelity is verified by hand.
3. ~~**T013 — wire CI**~~ ✅ **done 2026-07-26 as T022.** Add the parity check to
   the `rls` job once T011 exists.
4. Fix the `supabase/seed.sql` header (it says `db:reset` runs seed-auth; it does
   not — only `test:rls:reset` does) and remove the `record_id: 1` coupling in
   `scripts/seed-auth.mjs`.

## Blocked / waiting on Lukas (see PROJECT.md open decisions)
- Q1 finance-chart data source (no finance table) — blocks the finance chart (T054).
- Q3 keep prod on free tier (auto-pauses) or upgrade to paid.
- Q4 new URL / domain.
- Design template (Phase 7) — non-blocking; the theme seam in `src/index.css` waits.

## How to resume after a fresh session
Read [CLAUDE.md](../CLAUDE.md) → this file → [SETUP.md](SETUP.md) to bring the
local stack up. The repo is the memory; trust `git log` and a green test run,
never a status summary.
