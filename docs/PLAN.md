# Erhvervsklubben rebuild — implementation plan

> Drafted by Fable (planner) 2026-07-23 against docs/DISCOVERY.md. Adversarially
> reviewed in docs/PLAN-REVIEW.md. Not yet approved by Lukas — decisions Q1–Q10
> at the end are open.

## 1. Target architecture

### Stack
React 18 + Vite + TypeScript + Tailwind + supabase-js v2. No framework change is
justified: the app is a small client-rendered SPA talking straight to Supabase
REST (7 tables, zero RPC calls), the old site is exactly this shape, and it keeps
the Supabase backend unchanged (constraint 5, auth continuity). Additions:
React Router (routes mirror old site), TanStack Query, Recharts (two charts),
Vitest + React Testing Library, Playwright (e2e), Supabase CLI local stack.
No SSR/Next — no SEO need for a 10-member private club.

### Hosting
Recommend Vercel (free tier, preview deploys per PR, env-var flip for
cutover/rollback). Alternative: self-host on the lenovo (Caddy + static dist) —
fallback only.

### Coexistence (parallel, constraint 1) — three envs, two Supabase projects
| Env | Frontend | Database |
|---|---|---|
| Local dev / CI | vite dev / Playwright | Supabase local stack (Docker), migrations + seed, throwaway |
| Staging | Vercel (new URL) | New staging Supabase project — clone of prod (~300 rows) |
| Production (at cutover) | Same Vercel project, prod env vars | Existing prod `urlabzyihqrsdeasvrfe` — untouched until cutover |

Old Lovable site keeps talking to prod throughout. No dev/CI process ever holds
prod credentials. Frontend reads two env vars: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` — which DB an env talks to is deploy-time config only,
and that is the entire cutover mechanism.

### Cutover mechanics (config flip, not a migration)
1. Pre-flight: re-run schema-parity vs prod; full `pg_dump` backup, checksum in runbook.
2. Add new site URL to prod project's auth Redirect URLs allowlist; decide Site URL deliberately.
3. Flip Vercel prod env vars to prod project, redeploy.
4. Verify: Lukas logs in on new URL, matrix shows 29 meetings / 235 cells, admin edit works.
5. Old site stays live, unmodified. Both write to same DB safely (identical schema+RLS).
Auth continuity: same project → same users/emails/hashes; everyone logs in once on the new URL.
Rollback: revert Vercel env vars (or just use the old URL). No data rollback ever needed.

## 2. Data & schema strategy

### Schema as versioned migrations (extracted, never hand-typed)
`supabase/migrations/00000000000001_initial_schema.sql` from
`pg_dump --schema-only --schema=public` (read-only) PLUS the pieces a public dump
misses: `user_role` enum, `get_user_role(uuid)`, `handle_new_user()`, and the
`on_auth_user_created` trigger **on auth.users** (must be captured or new signups
break). All RLS policies verbatim — same names, same USING/WITH CHECK. Raw dump
committed as `docs/prod-schema-2026-07-23.sql` for audit.

### Parity verification (mechanical)
`tests/schema/parity.sh`: apply migrations to fresh local stack; normalize+diff
schema dumps (must be empty); additionally diff structured catalogs (`pg_policies`,
`pg_proc` for the two functions, `pg_trigger` on auth.users, `relrowsecurity` for
all 7 tables). Prod half manual (read-only); local half in CI forever.

### Prod → staging clone (runbook, repeatable)
Create staging project; apply repo migrations (`db push` — validates the
migrations); copy public data in FK order (profiles, news, events,
attendance_records, attendances, user_member_mapping, event_evaluations); auth
users **synthetic + FK remap** recommended (no real emails/hashes leave prod).
Verify row counts = prod (235/29/10/8/10) and a staging login works.

### Local seed
`supabase/seed.sql` + script: 3 users (admin/member1/member2), ~6 records, ~40
attendances, 2 news, 3 events, 1 evaluation. Deterministic, tiny, synthetic —
real names never enter the repo.

### Cutover data step
Explicitly NONE. New site points at existing prod project; data never moves. The
235 attendances are never migrated or touched — which is why they cannot be lost.

## 3. Anciennitet mobile design (centerpiece)
First move: split data from presentation — one pure module pivots
attendance_records + attendances into `MeetingRow[]` + `memberTotals`
(unit-testable, shared by all renderings and the bar chart).

- **Option A** — meeting cards (<lg) + hardened sticky matrix (≥lg).
- **Option B** — single matrix, sticky-column horizontal scroll everywhere (rejected as primary; mediocre on 390px).
- **Option C** — person-pivot drill-down (member timelines).

**Recommendation: A as the structure, with C's drill-down folded in.**
Breakpoint-split over the shared pivot: cards below lg, sticky-matrix at lg+;
logged-in user's chip/column highlighted (via user_member_mapping); tap a member →
Option-C timeline sheet. Option B's sticky-left-column technique fixes the desktop
matrix inside A. Bar chart → horizontal bars on mobile; finance chart thins ticks +
larger touch targets. Buildable now with neutral Tailwind; design template reskins
tokens later without structural change.

## 4. Phased task breakdown
Each bullet = one task file `tasks/T<id>-<slug>.md` (~30–60 min): goal, acceptance
criteria, scope, test. Full detail to be expanded into task files on approval.

**Phase 0 — Repo & CI:** T001 scaffold-app · T002 ci-pipeline
**Phase 1 — Schema/staging (safety, before any UI):** T010 schema-extract ·
T011 schema-parity-check · T012 local-seed · T013 ci-supabase-job · T014 staging-clone
**Phase 2 — RLS test suite (before feature UI):** T020 rls-read · T021 rls-write ·
T022 rls-ownership-and-trigger
**Phase 3 — Shell & auth:** T030 supabase-client-and-types · T031 layout-and-theme-seam ·
T032 auth-flow · T033 role-gating
**Phase 4 — Read-only screens:** T040 landing · T041 about · T042 news-list ·
T043 events-list · T044 seniority-data-layer
**Phase 5 — Anciennitet UI:** T050 attendance-bar-chart · T051 matrix-desktop ·
T052 matrix-mobile-cards · T053 member-highlight-and-drilldown · T054 finance-chart (blocked on Q1)
**Phase 6 — Admin write flows:** T060 admin-attendance-editing · T061 admin-events-crud ·
T062 admin-news-crud · T063 event-evaluations-form (confirm Q7)
**Phase 7 — Design-template integration (non-blocking):** T070 template-tokens ·
T071 template-marketing · T072 template-data-views
**Phase 8 — Deploy & E2E:** T080 vercel-staging-deploy · T081 e2e-smoke-suite
**Phase 9 — Cutover:** T090 cutover-runbook · T091 execute-cutover (Lukas present)

Critical path: T001 → T010 → T012 → T02x → T030/T032 → T044 → T051/T052 → T060 →
T081 → T090. Phases 4/5/6/7 largely parallelizable once deps land.

## 5. Testing strategy
| Layer | Tool / where | Proves |
|---|---|---|
| Schema parity | parity.sh (dump-diff + catalog queries) | Migrations reproduce prod exactly incl. trigger, functions, every policy, RLS enabled |
| **RLS behavior** | Vitest + 4 supabase-js clients vs local stack | anon/member read scope; every admin-only write denied for members; event_evaluations isolation; no role escalation; handle_new_user provisions role='user' |
| Unit | Vitest, src/features | Pivot logic, totals, duplicate meeting numbers, finance series, da-DK dates |
| Component | Vitest + RTL | Route protection, AdminOnly, both matrix renderings from one fixture, forms |
| E2E smoke | Playwright vs local stack; 390px + 1280px | Login, every page, admin write round-trip, member write denied (UI absence + RLS denial together) |
| Manual staging | Checklist | Real auth, real network, Lukas's eyes on design |

RLS suite exists BEFORE feature UI, so every task lands on a security regression net.

## 6. Open questions for Lukas (ranked) — see PLAN-REVIEW.md for the review's take
1. **Q1** Finance chart data source — no finance table exists; formula lives in old bundle. Blocks T054.
2. **Q2** Staging auth: synthetic (recommended) vs copy real users.
3. **Q3** Prod free-tier pausing — upgrade to paid, or document unpause?
4. **Q4** New URL/domain — is `erhvervsklubbensforum.dk` yours?
5. **Q5** Two logins have no user_member_mapping — who are they?
6. **Q6** Verify exact profiles UPDATE policy (possible pre-existing role-escalation hole).
7. **Q7** Keep event_evaluations (1 row ever) — rebuild form or keep table only?
8. **Q8** Don't make schema changes via Lovable/dashboard during the rebuild.
9. **Q9** Design template timing — get it before Phase 5 finishes.
10. **Q10** events.time stays free text (verbatim render).
