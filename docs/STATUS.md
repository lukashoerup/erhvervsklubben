# Status — Erhvervsklubben rebuild

_Updated 2026-07-24. Single source of truth for "where are we". Update this at the
end of every working session._

## Phase progress
| Phase | What | State |
|---|---|---|
| 0 | Repo + app scaffold + green pipeline | ✅ **done** (T001) |
| 1 | Schema-as-migration, seed, local stack | ✅ **done** (T010, T012) |
| 2 | RLS test suite (full ~50-case matrix) | 🟡 **in progress** — harness proven, 9 representative cases green (T020) |
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
- `npm run test:rls` — 9 RLS integration cases vs the local Supabase stack.
- Migration applies clean: 7 tables / 7 RLS-enabled / 21 policies / 2 SECURITY
  DEFINER functions / 1 signup trigger. Verified faithful to prod 2026-07-24.

## Immediate next tasks (resume here)
1. **T020 cont. — expand the RLS suite** to the full matrix in PLAN-REVIEW Part B.
   Priority gaps (flagged by Fable review): positive-auth (member CAN read
   attendances/attendance_records; member CAN CRUD own evaluation; signup trigger
   T1–T3), anon INSERT sweep, admin ALL on attendances (A7), user_member_mapping
   spoof (M3), event_evaluations owner-delete-denied (EV7), P8 admin-client role
   update.
2. **T011 — automated schema parity** (`tests/schema/parity.sh`): diff local
   objects (pg_policies, pg_proc, pg_trigger, relrowsecurity, FK confdeltype,
   grants) against the prod snapshot. Currently fidelity is verified by hand.
3. **T013 — wire CI** (GitHub Actions): lint + typecheck + `npm test`, then a job
   that boots the local stack and runs `test:rls` + parity.
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
