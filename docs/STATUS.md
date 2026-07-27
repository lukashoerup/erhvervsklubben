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
1. ~~**The Claude Design system**~~ ✅ **done 2026-07-27 (T064).** The export is
   in the repo as `design/erhvervsklubben-designsystem-v2.html`. Palette, type
   pairing, the three surfaces and the logo intro landed earlier; T064 added
   the two **Instrument fonts**, decoded out of that bundle and self-hosted
   under `public/fonts/` (51 kB for both — there is no CDN access, and a
   Google Fonts link fails silently), and put the system on all six members'
   screens: the texture ground, the drawn mark in the app bar, 16 px card
   radius, serif display type, sticky section labels, and the system's
   scroll-linked reveal. **T066 then closed the icons and swept the rest.**
   §03's Material Symbols now ship, subset from 339 kB to **1072 bytes** — the
   tab bar was six geometric characters that Instrument does not draw, so it
   rendered differently on every phone. The sweep put the texture, the drawn
   mark, the brand-blue button and the 48 px floor on `/login` (which the
   design pass had missed, being outside the Shell), gave the fifteen statute
   rows on `/regler` a 48 px target, named the button radius §03 asks for, and
   put §01's reveal on the public landing page. Contrast is at zero failing
   pairs on all eight screens in both themes. **What is deliberately still
   open** — the members' type scale against §04's phone mocks, §01's count-up
   on figures, and iOS before Safari 26 — is in `design/README.md`.
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
4. ~~**Admin editing of news, events and attendance**~~ ✅ **done 2026-07-27
   (T063 + T065).** This was Lukas's whole list — *"add and edit news, events,
   and the anciennitet events"* — and all three are now in the app. Neither task
   migrated anything: RLS has allowed exactly this since 2026-07-23.
   **News and events (T063).** News on `/nyheder`; the meetings on a new member
   page **`/moeder`**, which is also the first place the club's whole calendar —
   planned *and* held — has been readable. Held meetings stay on it
   deliberately: a date typed wrong lands in the past, and every other view of
   `events` shows only the future.
   **Attendance (T065).** On `/anciennitet`, the page the history is read on: an
   admin records a meeting and ticks off who came, or corrects one already
   recorded. Ten members, two columns, 48 px buttons, and a new meeting starts
   with everyone present so the *absentees* are what get tapped — this is used
   the morning after a meeting, not at a desk. A member with no row for a
   meeting keeps none unless he is ticked present, because 235 rows over 29
   meetings is not ten per meeting and `total` is counted from the rows that
   exist. The editor can also name someone the club has never recorded, which is
   the only way an eleventh member ever enters a database with no members table.
   **A meeting's date is now set in one place** — that editor. The date field on
   `/oekonomi`'s "Møder uden dato" is gone and its *count* stayed: how many
   meetings lack a date is a fact about those books, but two inputs on one
   column are two places for it to start behaving differently.
   Deleting asks a second time and names what will go; for a meeting that
   includes counting the ~10 attendance rows and the fines that cascade with it.
   The club has no backup habit.
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
   ✅ **Small text meets AA** as of T064. Two light-mode tokens were short and
   both are measured in a browser now rather than argued from a hex: `--color-
   faint` was 4.05:1 on the page ground (it had been corrected once against
   white, which is not where most of it sits) and is 4.59:1; `--color-present`
   was 4.02:1 where it is actually read — 8.8px initials on a wash mixed from
   itself in the attendance pips — and is 4.9:1. Every text/background pair on
   all six screens, both themes, now passes 4.5:1 (3:1 large). Filled buttons
   use `--color-brand`, a theme-constant #2563eb where white measures 5.1:1
   against `bg-accent`'s 3.2:1 — with one exception T064 could not see, because
   it swept the six members' screens and `/login` is not one of them. **"Log
   ind" was `bg-accent` and measured 3.23:1 on the dark ground** — the one
   button nobody can get past — and is `bg-brand` since T066. All eight screens
   are now at zero failing pairs. Anything filled added later should be too.

## Phase progress
| Phase | What | State |
|---|---|---|
| 0 | Repo + app scaffold + green pipeline | ✅ **done** (T001) |
| 1 | Schema-as-migration, seed, local stack | ✅ **done** (T010, T012) |
| 2 | RLS test suite | ✅ **done** (T020) — 40 assertions generated from the rule, green in CI |
| 3 | App shell + auth + role gating | ✅ **done** (T030) — login, route gating, 23 offline tests |
| 4 | Read-only screens | ✅ **done** — public landing, members' front page, Anciennitet, Møder, Nyheder, Regler on real data |
| 5 | Anciennitet UI | ✅ **done** — meeting cards + anciennitet chart, mobile-first. The finance curve (was T054) landed 2026-07-27 as T061. |
| 6 | Admin write flows | ✅ **done** — fines, news/events create/edit/delete (T063), and the attendance history itself (T065). Nothing about the club's records is typed into the database by hand any more. |
| 7 | Design | ✅ **done** — corporate blue, the surfaces and the logo intro in `src/index.css` (T031/T060); the two Instrument fonts self-hosted and the system applied to all six members' screens (T064); the icon set and a conformance sweep of all eight screens (T066). The dark palette was silently absent from the build until T058 — see its notes. Still open, and all of it written up in `design/README.md`: the members' **type scale** sits one notch below §04's own phone mocks, §01's count-up on figures, and no motion on iOS before Safari 26. |
| 8 | Deploy to Vercel (staging) + e2e | ⬜ not started |
| 9 | Cutover (old site stays live until then) | ⬜ not started |

Full task breakdown: [PLAN.md](PLAN.md) §4. Test spec: [PLAN-REVIEW.md](PLAN-REVIEW.md).

## Green right now
- `npm test` — 208 component/derivation tests (jsdom, fast, offline). The finance
  chart is asserted through its words, never its SVG: recharts renders in jsdom
  but with no layout, so every coordinate in it is zero. Same reason a tap
  target is asserted through its classes (`minTapHeightPx`): nothing in jsdom
  has a size. The members' scroll-linked reveals are asserted the same way —
  the stylesheet is read as text and checked for its two guards — because jsdom
  has no layout and no scroll, so whether a card actually finishes revealing
  can only be answered in a browser. It was, in T064, on all six screens: see
  that task's notes for the measurements, including why the design export's own
  `cover 26%` range had to become `cover 12%`.
- `npm run build`, `npm run lint` — clean.
- `npm run build:demo` — the whole app as one HTML file with fabricated data
  (`dist-demo/index.html`), for showing the thing without hosting
  anything real. Since T064 it inlines the woff2 faces as data URIs — three of
  them since T066, the two Instrument subsets and the 1 kB icon subset:
  `public/fonts/` is a path only a web server can answer, and left as a URL the
  standalone file 404s on both and quietly renders in Georgia.
  See T058. It is not a deploy and touches no club record. **Its writes are
  in-memory** (T063, extended to meetings in T065): the demo bundle carries the
  live project's URL and anon key, so every mutation short-circuits in
  `data/demo` before the client, and a test asserts the client is never asked.
  Verified in a browser both times: creating, correcting and deleting a news
  item, a calendar entry or a whole meeting with its attendance makes no network
  request at all. The demo is now ~984 kB.
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
2. **Fill in the missing meeting dates.** All 29 are undated. Since T065 the
   date is set on the meeting's own card under Anciennitet, beside its lead, its
   venues and who attended; `/oekonomi` counts how many are still missing and
   the monthly ledger says how much it is therefore leaving out. The backfill
   from the events table handled the unambiguous ones and refused to guess the
   rest, so the remaining ones need Lukas's agendas rather than more code.
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
