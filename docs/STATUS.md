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
1. **The Claude Design system** — 🟡 **in the repo since 2026-07-27** as
   `design/erhvervsklubben-designsystem-v2.html`, exported by Lukas. Palette,
   type pairing, the three surfaces and the logo intro are in the app. **Still
   outstanding: the two Instrument fonts**, which are inlined in that bundle but
   not extracted — the app falls back to Georgia and the system sans. They must
   be self-hosted; there is no CDN access.
2. ~~**A public landing page**~~ ✅ **done 2026-07-27 (T060).** `/` is the club's
   face: the logo intro, the purpose and cadence quoted from the statutes,
   upcoming meetings and recent news. Everything else still needs a login, and
   the members' front page moved to `/hjem` — a signed-in member opening `/` is
   forwarded there. The page reads only `news` and `events`, the two
   anon-readable tables, and a test asserts it asks for nothing else.
3. ~~**The finance graph**~~ ✅ **done 2026-07-27 (T061).** `/oekonomi` now draws
   what the club has charged against what has actually arrived, running totals,
   for every member rather than the treasurer alone. **In production it draws
   nothing and says why** — no fines, no payments, no meeting dates — which is
   the honest state and the thing item 5 below fixes.
4. ~~**Admin editing of news and events**~~ ✅ **done 2026-07-27 (T063).** An
   admin can add, correct and delete both from inside the app. News on
   `/nyheder`; the meetings on a new member page **`/moeder`**, which is also
   the first place the club's whole calendar — planned *and* held — has been
   readable. Held meetings stay on it deliberately: a date typed wrong lands in
   the past, and every other view of `events` shows only the future. Deleting
   asks a second time and names what will go; the club has no backup habit.
   Nothing was migrated — RLS has allowed exactly this since 2026-07-23.
5. **Import the finance figures** from *Klubbens finanser*. Unresolved first:
   its fine total reads 1.730 kr. against 1.780 kr. in the annual report, and
   the per-member breakdown loses which Lead's column some fines belong to.
   Do not import a number that cannot be stood behind.
6. **Known defects** from the 2026-07-27 browser test — cleared in T062, except
   the last one.
   ✅ **Late-arrival minutes** no longer need Enter: the field commits when it
   loses focus, which on a phone is how the keyboard gets dismissed. Bounded at
   240 minutes (past four hours it is *udeblivelse*, which the regulation
   charges separately), and a refused entry says so instead of taking 99999 at
   face value or charging -50 as none.
   ✅ **Amounts use the shared `kr()`**, so the fine screen and the ledger
   cannot write the same number two ways. "Gem 1 bøde" / "Gem 2 bøder".
   ✅ **Meeting dates carry their year**, and render in UTC so a plain date
   cannot slide into the month before.
   ✅ **Present/absent no longer rides on hue alone** — filled versus hollow
   pips, a key with the counts in it on every card, and the state in the pip's
   own text rather than a tooltip a phone cannot show.
   ✅ **Tap targets** — "Log ud", the fine chips, the minutes field and the save
   button are all at the design system's 48px floor. `minTapHeightPx` in
   `src/test/harness.tsx` is what the tests assert against.
   ⬜ **Small text still fails AA** in places on the members' screens, which
   have not been through the design system yet. Filled buttons are done: they
   use `--color-brand`, a theme-constant #2563eb where white measures 5.1:1
   against `bg-accent`'s 3.2:1. Anything filled added later should be too.

## Phase progress
| Phase | What | State |
|---|---|---|
| 0 | Repo + app scaffold + green pipeline | ✅ **done** (T001) |
| 1 | Schema-as-migration, seed, local stack | ✅ **done** (T010, T012) |
| 2 | RLS test suite | ✅ **done** (T020) — 40 assertions generated from the rule, green in CI |
| 3 | App shell + auth + role gating | ✅ **done** (T030) — login, route gating, 23 offline tests |
| 4 | Read-only screens | ✅ **done** — public landing, members' front page, Anciennitet, Møder, Nyheder, Regler on real data |
| 5 | Anciennitet UI | ✅ **done** — meeting cards + anciennitet chart, mobile-first. The finance curve (was T054) landed 2026-07-27 as T061. |
| 6 | Admin write flows | ✅ **done** — fines, meeting dates, and news/events create/edit/delete (T063). Attendance itself is still recorded outside the app. |
| 7 | Design | 🟡 **tokens + landing done** — corporate blue, the design system's surfaces and its logo intro live in `src/index.css`. The dark palette was silently absent from the build until T058 — see its notes. Outstanding: self-host the two Instrument fonts, and apply the system to the members' screens. |
| 8 | Deploy to Vercel (staging) + e2e | ⬜ not started |
| 9 | Cutover (old site stays live until then) | ⬜ not started |

Full task breakdown: [PLAN.md](PLAN.md) §4. Test spec: [PLAN-REVIEW.md](PLAN-REVIEW.md).

## Green right now
- `npm test` — 176 component/derivation tests (jsdom, fast, offline). The finance
  chart is asserted through its words, never its SVG: recharts renders in jsdom
  but with no layout, so every coordinate in it is zero. Same reason a tap
  target is asserted through its classes (`minTapHeightPx`): nothing in jsdom
  has a size.
- `npm run build`, `npm run lint` — clean.
- `npm run build:demo` — the whole app as one HTML file with fabricated data
  (`dist-demo/index.html`), for showing the thing without hosting anything real.
  See T058. It is not a deploy and touches no club record. **Its writes are
  in-memory** (T063): the demo bundle carries the live project's URL and anon
  key, so every mutation short-circuits in `data/demo` before the client, and a
  test asserts the client is never asked. Verified in a browser: create, edit
  and delete in the demo make no network request at all.
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
3. **Import the sheet's history**, now that dates exist to hang it on.
4. **Deploy to Vercel** (phase 8) — nothing is hosted yet.
5. **T011 — automated schema parity** (`tests/schema/parity.sh`): diff local
   objects (pg_policies, pg_proc, pg_trigger, relrowsecurity, FK confdeltype,
   grants) against the prod snapshot. Currently fidelity is verified by hand.
   ~~**T013 — wire CI**~~ ✅ **done 2026-07-26 as T022.** Add the parity check to
   the `rls` job once T011 exists.
6. Fix the `supabase/seed.sql` header (it says `db:reset` runs seed-auth; it does
   not — only `test:rls:reset` does) and remove the `record_id: 1` coupling in
   `scripts/seed-auth.mjs`.

## Blocked / waiting on Lukas (see PROJECT.md open decisions)
- ~~Q1 finance-chart data source~~ **closed 2026-07-27** — answered 2026-07-26 (derived, in the club's own database, with a quarterly bank confirmation), and the chart it blocked shipped as T061. Nothing is left for Lukas here; what is left is importing the figures.
- Q3 keep prod on free tier (auto-pauses) or upgrade to paid.
- Q4 new URL / domain.
- ~~Design template (Phase 7)~~ **arrived 2026-07-27** — Lukas committed the
  export to `design/`. The seam in `src/index.css` is filled: palette, type
  pairing, surfaces, logo intro. What still needs him is nothing; what needs
  doing is font extraction and the members' screens.

## How to resume after a fresh session
Read [CLAUDE.md](../CLAUDE.md) → this file → [SETUP.md](SETUP.md) to bring the
local stack up. The repo is the memory; trust `git log` and a green test run,
never a status summary.
