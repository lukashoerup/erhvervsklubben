# Status — Erhvervsklubben rebuild

_Updated 2026-07-27. Single source of truth for "where are we". Update this at the
end of every working session._

## Start here if you are picking this up in a new session

**It is live and writable.** <https://erhvervsklubben.vercel.app>, deployed from
`main` by Vercel's GitHub integration on every push. Build config is in
`vercel.json` and `.env.production` — both committed, nothing in the dashboard.

**Production now has** `fines`, `payments` and `attendance_records.meeting_date`
(added 2026-07-27, additive, no existing row touched). All 29 meetings and 235
attendance rows intact. **Every meeting is undated** — the backfill refused to
guess. `fines` and `payments` are empty; the real figures are in Lukas's Drive
sheet *Klubbens finanser* and have not been imported.

**Two roles, and only two** (see PROJECT.md 2026-07-27): members read everything
behind the login; admins additionally edit news, events and attendance.

**Next, in Lukas's priority order:**
1. **The Claude Design system** — never reached this session. `DesignSync` needs
   an interactive authorisation a cloud session cannot do, and the share link
   needs his browser login. The route that works is **"Send to Claude Code Web"**
   on the Claude Design page, which seeds the project into the workspace.
2. **A public landing page** — with the logo animation and core club details.
   Everything else stays behind the login. Nothing public exists today; `/` is
   member-only.
3. **Admin editing of news and events** — currently read-only in the UI even
   though RLS allows it.
4. **Import the finance figures** from *Klubbens finanser*. Unresolved first:
   its fine total reads 1.730 kr. against 1.780 kr. in the annual report, and
   the per-member breakdown loses which Lead's column some fines belong to.
   Do not import a number that cannot be stood behind.
5. **Known defects** from the 2026-07-27 browser test, left deliberately because
   the design system should decide how they look: late-arrival minutes are lost
   unless Enter is pressed; meeting dates show no year; present/absent is red
   and green with no legend; small text fails AA contrast; "Log ud" is a 37×16px
   tap target.

## Phase progress
| Phase | What | State |
|---|---|---|
| 0 | Repo + app scaffold + green pipeline | ✅ **done** (T001) |
| 1 | Schema-as-migration, seed, local stack | ✅ **done** (T010, T012) |
| 2 | RLS test suite | ✅ **done** (T020) — 40 assertions generated from the rule, green in CI |
| 3 | App shell + auth + role gating | ✅ **done** (T030) — login, route gating, 23 offline tests |
| 4 | Read-only screens | ✅ **done** — front page, Anciennitet, Nyheder, Regler on real data |
| 5 | Anciennitet UI | ✅ **done** — meeting cards + anciennitet chart, mobile-first |
| 6 | Admin write flows | 🟡 **fines + meeting dates done**; news/events editing outstanding |
| 7 | Design | ✅ **agreed 2026-07-26** — corporate blue redesign + logo; tokens live in `src/index.css`. The dark palette was silently absent from the build until T058 — see its notes. |
| 8 | Deploy to Vercel (staging) + e2e | ⬜ not started |
| 9 | Cutover (old site stays live until then) | ⬜ not started |

Full task breakdown: [PLAN.md](PLAN.md) §4. Test spec: [PLAN-REVIEW.md](PLAN-REVIEW.md).

## Green right now
- `npm test` — 68 component/derivation tests (jsdom, fast, offline).
- `npm run build`, `npm run lint` — clean.
- `npm run build:demo` — the whole app as one HTML file with fabricated data
  (`dist-demo/index.html`), for showing the thing without hosting anything real.
  See T058. It is not a deploy and touches no club record.
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
1. **Decide whether Leads can record fines** — the one thing blocking the
   finance flow from matching the regulation. See T050's "Capture is built"
   note; it is an access-rule change, so it needs Lukas.
2. **Fill in the missing meeting dates.** The treasurer's screen lists every
   undated meeting with a date field; the monthly ledger only covers meetings
   that have one, and says how much is left out. The backfill from the events
   table handled the unambiguous ones.
3. **News/events editing for the admin** — currently read-only.
4. **Import the sheet's history**, now that dates exist to hang it on.
5. **Deploy to Vercel** (phase 8) — nothing is hosted yet.
2. **T011 — automated schema parity** (`tests/schema/parity.sh`): diff local
   objects (pg_policies, pg_proc, pg_trigger, relrowsecurity, FK confdeltype,
   grants) against the prod snapshot. Currently fidelity is verified by hand.
3. ~~**T013 — wire CI**~~ ✅ **done 2026-07-26 as T022.** Add the parity check to
   the `rls` job once T011 exists.
4. Fix the `supabase/seed.sql` header (it says `db:reset` runs seed-auth; it does
   not — only `test:rls:reset` does) and remove the `record_id: 1` coupling in
   `scripts/seed-auth.mjs`.

## Blocked / waiting on Lukas (see PROJECT.md open decisions)
- ~~Q1 finance-chart data source~~ **answered 2026-07-26** — derived from meeting/attendance data, with a quarterly bank confirmation. T050 carries it; blocked only on the published fine rules, which this environment cannot reach.
- Q3 keep prod on free tier (auto-pauses) or upgrade to paid.
- Q4 new URL / domain.
- Design template (Phase 7) — non-blocking; the theme seam in `src/index.css` waits.

## How to resume after a fresh session
Read [CLAUDE.md](../CLAUDE.md) → this file → [SETUP.md](SETUP.md) to bring the
local stack up. The repo is the memory; trust `git log` and a green test run,
never a status summary.
