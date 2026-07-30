# Erhvervsklubben rebuild — goals & decision log

## Goal
Replace the current Lovable frontend of the Erhvervsklubben members site with a
better-designed, genuinely mobile-friendly app on the SAME Supabase backend,
without losing data and without taking the old site down until an approved cutover.

## Success criteria
- Every current feature works: auth, news, events, the attendance/seniority
  matrix + charts, admin editing, per-user event evaluations.
- The attendance matrix is usable on a phone (the current one overflows even on desktop).
- All 235 attendances / 29 meetings / 10 members preserved; members keep their logins.
- The verbatim RLS security model is reproduced and proven by tests.
- Cutover is a config flip with instant rollback (old site keeps working).

## Decisions (permanent)
- **2026-07-23 — Stack:** React + Vite + TS + Tailwind v4 + supabase-js + React
  Router + TanStack Query + Recharts. Why: matches the existing Lovable output,
  keeps the same Supabase backend (auth continuity), trivial to host.
- **2026-07-23 — Hosting: Vercel.** Free tier, preview deploy per PR, cutover =
  env-var flip. (Lukas's call.)
- **2026-07-23 — Coexistence: parallel.** New site at a new URL; old Lovable site
  stays live and untouched until an explicit, Lukas-present cutover.
- **2026-07-23 — Same Supabase project at cutover** (not a fresh DB), so members
  keep logins and the 235 attendances never move. A disposable STAGING clone is
  used for dev; local Supabase stack for CI.
- **2026-07-23 — events & news stay PUBLIC (anon-readable).** Lukas's call; the
  current `USING (true)` SELECT policy is reproduced verbatim, no deviation.
- **2026-07-23 — RLS reproduced verbatim.** The `Only admins can update profiles`
  policy was verified NOT to allow self-escalation (members can't update profiles
  at all), so verbatim == secure; no policy changes needed.
- **2026-07-26 — first deliberate deviation from prod: admins can read all event
  evaluations.** Prod has three owner-scoped policies on `event_evaluations` and
  no admin policy, so the club admin could not read the feedback members submit —
  it went into the table and nobody could ever look at it. Lukas confirmed this
  was an oversight, not a decision. Members still see only their own; DELETE
  stays absent for everyone, deliberately. Must be applied to prod at cutover:
  `supabase/migrations/20260726160000_admin_can_read_evaluations.sql`.
- **2026-07-26 — the access rule is stated once, and tests are generated from it**
  (`tests/rls/rules.ts`), replacing the ~50-case table × actor × operation matrix.
  Lukas's rule: members read everything, only admins write, personal rows are
  owner-only. Enumerating the grid mostly re-tested the same three ideas; deriving
  from the rule means the tests cannot drift from it, and a new table forces a
  bucket decision instead of shipping untested. 54 assertions, ~1s.
  Why RLS matters here at all, recorded because it will be asked again: the
  browser talks straight to the database, and the initial migration grants
  `authenticated` full access to every table. The policies are not one layer
  among several — they are the entire lock.

- **2026-07-26 — signed-out visitors see no member data, and pages are gated
  too.** Lukas's requirement: attendance records, financials and similar must sit
  behind login. The data half is already enforced and tested (anon gets zero rows
  from every non-public table). The page half is T030. Both are needed and
  neither replaces the other: a route guard is not security, since anyone can
  bypass the JavaScript — the policies are the security, the guard is what makes
  the site behave correctly.
- **2026-07-26 — a new table must be classified before it ships.** The suite
  fails if any table the API exposes is missing from `tests/rls/rules.ts`. A
  table is reachable from the browser the moment it exists, so this turns "who
  may read this?" into a decision rather than an oversight. Relevant to the
  financials table when Q1 is resolved.

- **2026-07-26 — Q1 answered: finances come from a Google Sheet today, and will
  be derived instead.** Everything except money-actually-received is computable
  from data the club already holds — the database records every meeting, its
  lead, and who attended. The machine maintains the expected side; Lukas
  confirms the bank balance quarterly. No bank credentials and no aggregator
  subscription: his explicit choice, and it keeps the attack surface at zero.
  Blocked on the published fine rules — see T050.
- **2026-07-26 — finance numbers live in the club database, not in Google
  Sheets.** Lukas's call, replacing the Sheets integration rather than
  continuing it. The site already reads from the database, so the machine writes
  there directly: no Google service account or credential on the box, and one
  source of truth instead of two. The drift between them is what produced both
  the 50 kr discrepancy and two stale months. Lukas may keep his sheet privately;
  nothing will depend on it.

- **2026-07-26 — the club's finances are admin-only, including reads.** Lukas:
  "Not everyone should know how much money is in the bank account." He is the
  treasurer; the balance is his to see, not the membership's. This is the single
  exception to "members read everything", so it gets its own bucket in
  `tests/rls/rules.ts` (`ADMIN_ONLY_TABLES`) rather than a footnote — and the
  balance is off the front page and out of the launch animation, where an
  animated number would have been the least private place to put it.

- **2026-07-27 — "everyone" meant the public, not the members.** The 2026-07-26
  entry above read as a rule about members. Lukas: *"When I mean everyone, I
  mean people who visit the website who are not a member."* So there is no
  privacy line inside the membership at all. Two roles exist and only two:

  | Role | Can |
  |---|---|
  | **member** | read everything behind the login, finances included |
  | **admin** | that, plus add and edit news, events and attendance records |

  Currently only Lukas (and Claude) are admins. `/oekonomi` is therefore a
  member route, `fines` and `payments` are member-readable and admin-writable
  in RLS, and the remaining in-page gates gate *writing*, not *seeing*.

- **2026-07-27 — the write lock is off.** Every deployment refused to write to
  production from 2026-07-27 morning until Lukas lifted it that afternoon,
  holding a full data export plus his own screenshots of the anciennitet
  history. `VITE_READONLY` survives as a one-line switch, tested both ways, for
  any build that should read production without being able to change it.

- **2026-07-27 — `/` is the club's public face, and the members' front page is
  `/hjem`.** Lukas: *"There should be a landing page for both members and the
  public. This is the page where the animation is. With some core details. Then
  everything else should be behind the login page."* Until now a visitor
  following a link met a password box, which is the wrong first impression for
  a club whose own §4 Stk. 2 A. requires attending once as a guest before
  membership can even go to a vote — people arrive before they have a login, by
  design. A signed-in member opening `/` is forwarded to `/hjem`, so both
  audiences use the URL people actually type and share.

  Two rules the page is built on, and they are the ones to keep if it is ever
  rewritten. It reads **only `news` and `events`** — not "omits the rest" but
  never asks, so a future RLS change cannot turn an omission into a leak; a test
  asserts the set of tables it queries. And **every claim about the club is
  quoted from `vedtaegter.ts`** rather than written fresh, because a landing
  page is exactly where copy nobody voted on starts drifting from what the club
  is. The dues figure is deliberately absent too: public in the statutes, but a
  price tag on a page someone is deciding about the club from, and that is
  Lukas's call to make rather than a side effect of building the page.

- **2026-07-27 — the finance graph is cumulative, and it refuses to draw an
  empty one.** Lukas: *"Members cannot see the finance graph. I.e., the
  financials of the club (expected vs. realised income)."* Two choices in it
  that should survive a rewrite.

  It plots the **running totals**, not each month against itself, because
  fines are collected **quarterly** (Bødekasseregulativ, Stk. 3): a month's
  payment against that month's charge is meaningless by design — one month
  shows a quarter's money arriving and the two either side show none. A monthly
  chart draws that sawtooth as if it were a collection problem. On running
  totals the vertical distance between the curves *is* `outstanding`, the number
  the rest of the page already reports. The monthly figures stay in the table
  under it, which is also the chart's table view.

  And **an empty chart is a card of reasons, not a flat line at zero.** `fines`
  and `payments` are empty and every meeting is undated, so there is nothing to
  group into a month. A line along zero would fill the space and read as a club
  that charged nothing and collected nothing — the page instead states which of
  those things is missing, counted rather than assumed, so each reason
  disappears on its own as the books are filled in.

- **2026-07-27 — the admin edits from inside the members' pages, and the club's
  calendar becomes a page.** Lukas: *"Admin is currently only me (and Claude),
  and these can add and edit news, events, and the anciennitet events. That's
  it. Very simple."*

  So there is no admin section, no dashboard and no content types. The controls
  sit on the pages the content already lives on, gated in-page on the role the
  same way the treasurer's tools are on `/oekonomi` — a member sees the club's
  news and calendar exactly as before and is offered no button that could only
  fail. RLS is unchanged and was never the obstacle: `news` and `events` have
  been anon-readable and admin-writable since the initial migration, and this
  task wrote no SQL at all.

  Two things in it worth keeping if it is rewritten. **Held meetings stay on
  `/moeder`.** The front page shows the next meeting and the public page the
  next two, so a date typed with the wrong year lands in the past and disappears
  from every screen that could correct it — the calendar is the one view that
  must show what the club got wrong. And **deleting asks a second time and names
  what is about to go.** There is one copy of everything, no undo and no backup
  habit; "er du sikker?" is a question nobody reads, so the second tap says
  which news item or which meeting.

  `/moeder` is a **member** route rather than an admin one. `events` is public
  by the 2026-07-23 decision, so the club's own meeting list cannot sensibly be
  more private to a member than it is to a stranger reading the landing page.
  Only the buttons on it are the admin's.

- **2026-07-27 — the attendance history is written in the app, and that closes
  Lukas's list.** T065, the third of the three things he named. An admin records
  a meeting and ticks off who came, and corrects one already recorded, on
  `/anciennitet` — the page the history is read on. No migration: RLS has
  allowed admins to write both tables since the initial migration, so this task
  wrote no SQL either.

  Four choices in it that should survive a rewrite.

  **A new meeting starts with everyone present.** Eight or nine of ten turn up,
  so ticking off the absentees is two taps where ticking on the attendees is
  eight — and this gets used the morning after a meeting, on a phone. The count
  sits above the buttons, so what is about to be written is on screen rather
  than assumed.

  **A member with no row keeps none.** The club's 235 attendance rows over 29
  meetings are not ten per meeting: a (meeting, member) pair with no row is a
  third state, and `total` — the denominator under "X deltagelser af Y" — is
  counted from the rows that exist. A two-position toggle has to show that
  member as absent, but saving writes nothing unless the tick is changed *to*
  present. Otherwise opening a historical meeting and pressing Gem would grow
  every member's denominator across 29 meetings as a side effect.

  **The date is set in one place.** `/oekonomi` had a date field per undated
  meeting, from the finance work; the meeting editor covers the same column with
  the lead, the venues and the attendance beside it. Two inputs on one column
  are two places for it to start behaving differently, so the field went and the
  *count* stayed — how many meetings still lack a date is a fact about the
  books, and it belongs on the page whose chart it blocks.

  **The editor can name someone the club has never recorded.** The roster was
  derived from the names already in `attendances`; there was no members table.
  An eleventh member therefore had no row anywhere and could never be ticked, so
  the one meeting that matters — their first — would be the one meeting the app
  could not record. *(T069 gave the club a members table, so an admitted member
  is on the roster before he has attended anything. The field stays, for the
  guest and for the member admitted between meetings.)*

  Not built, and worth stating: no bulk backfill screen, no undo, no attendance
  import. Deleting a meeting is guarded by naming it and counting the ~10
  attendance rows and the fines that cascade with it, which is the same defence
  T063 chose and for the same reason — one copy of everything and no backup
  habit.

- **2026-07-26 — anciennitet revocation is not built.** §11 allows attendance to
  be revoked by a 2/3 vote; Lukas: it has never happened and has never been
  suggested. A voting flow plus a revoked state plus the screens to explain them
  is permanent complexity in the most-used page for an event with no precedent.
  If it ever occurs, flipping `attendances.attended` to false is exactly what a
  revoked attendance means — no schema change and no UI needed. Revisit if it
  happens twice. *(T065 makes that flip a tap on `/anciennitet` rather than a
  hand-written statement. Still not revocation: no vote, no revoked state, and
  in the data a revoked attendance and a typo are the same row.)*

- **2026-07-29 — the club has a members table, and only the members who pay are
  charged (T069).** Until this, "member" meant "appears in `attendances`", which
  is free text. Two consequences, and the second cost money. §3's active/inactive
  split existed nowhere in the app, and `buildLedger` was handed `roster.length`
  — everyone who had ever turned up — so the expected-income curve on `/oekonomi`
  has been too high since the day it was drawn. Against the club's real books
  that was **14.000 kr. charged where 12.600 kr. was owed**: the page reported
  the club 720 kr. short when it is in fact 680 kr. ahead.

  **Statuses: `aktiv`, `inaktiv`, `founding-father`.** The first two are §3
  verbatim. The third is Lukas's ruling of this date about **Oskar**: a real
  member who attends, but who **pays no kontingent, incurs no fines and does not
  vote on the use of the club's funds** (§12). Deliberately not "inactive" —
  §3 says an inactive member may not attend, and he does. His anciennitet is
  untouched: §11 earns it by attendance alone.

  **`alumne` (§4 Stk. 5 A) is not built.** It is the far end of a road nobody
  has walked — two years inactive, then a vote — and the club has never had an
  inactive member. Same reasoning as anciennitet revocation below. It is a check
  constraint and a label the day the club votes one.

  **The exemptions are stated once**, in `src/data/members.ts`, as a rights table
  per status that the finance code asks rather than each screen remembering. The
  founding father is therefore left out of the income base *and* out of the
  fine-capture screen from the same fact.

  **The migration is additive.** A `members` table keyed by the existing
  `member_name` text — no foreign key, no rewrite of `attendances`, and the 235
  attendances / 28 meetings / 17 fines / 13 payments verified untouched after it
  ran. Its ten seed rows are guarded by `where exists` against `attendances`, so
  a database that is not this club's gets the table and no rows; the local
  stack's four members come from `seed.sql` instead. Classified in
  `tests/rls/rules.ts` as a shared table: members read, admins write — a member
  who could edit his own row could set himself inactive and stop being charged.

- **2026-07-29 — the club budgets fines per *meeting*, and the budget is never
  money** (T070). Lukas asked for the spreadsheet's `Forventede bøder` back and
  suggested a rolling average. A rolling average **per month** is the one shape
  it must not have: §9 puts a dinner on the calendar every other month and fines
  are charged at the table, so a monthly mean divides a burst by the empty
  months around it and — the part that decides it — gives a different answer
  depending on how wide the window is. The same five dinners are 133 kr. a month
  across 13 months and 216 kr. across 8. Dividing by *meetings* makes the empty
  months irrelevant, which is what they are, and it is also the only thing
  computable at all while every meeting is undated: a fine's evening is known
  even when its month is not.
  The average is taken over meetings from the first fine-bearing one to the
  last, inclusive, so quiet evenings inside the recording period count and the
  club's undated prehistory does not. The cadence is §9's rule until three dated
  meetings can measure it. `src/data/projection.ts`, `docs/RULES.md`.
  **Nothing was stored and no migration was written** — the budget is derived
  from `fines` and `attendance_records` like every other figure on `/oekonomi`,
  so there is no new column to keep in step with the arithmetic, and nothing that
  could misbehave on a database without this club's data.

- **2026-07-29 — the club is ahead by about 100 kr., not 680** (T070). The
  investigation is `docs/finance-reconciliation.md` §13. The reported 680 is two
  errors nearly cancelling: dues charged to nine payers where the club charged
  eight (+1.200 kr.), against 1.780 kr. of fines that never enter the expected
  line because all 28 meetings are undated and one fine was never imported. Put
  the fines back and the club reads 1.050 kr. **behind**. The fix is not more
  arithmetic — it is §9 Q8 (when did the ninth member join) and the meeting
  dates, both of which need Lukas. **Both were answered on 2026-07-29** — see the
  next two entries; 17 of the 28 meetings are dated as of T071.

- **2026-07-29 — the club became nine members in June 2026, and the ninth has
  not yet paid his buy-in** (Lukas, same day). This closes §9 Q8. Two separate
  facts, and the second is the one the app does not model:
  1. **Before 2026-06 the club had eight paying members**, not nine. `/oekonomi`
     charges today's nine across the whole history, which is the +1.200 kr. in
     §13's decomposition.
  2. **The ninth buys in retroactively** — he is treated as though he had paid
     kontingent all along, but **he has not actually paid it yet**. So it is a
     *receivable*: money the club is owed and has not received. Nothing in the
     schema can express that. `payments` records money that moved, by month, with
     no member on it; `members` carries `name`, `status` and `note` and no dates
     or amounts at all.
  **Not fixed here, deliberately.** Making the historical payer count right needs
  a joining date per member, and `members` cannot carry one — it has no date
  column beyond `created_at`, which is when the row was written, not when the man
  joined. Adding one is a schema change, which by CLAUDE.md's autonomy boundary
  needs Lukas first. What it would take: a nullable `joined_on date` on `members`
  (additive, so RLS and the CI seed are untouched), `buildLedger` counting payers
  per month from it instead of being handed one roster length, the buy-in modelled
  as a receivable rather than smuggled into `payments` — which records money that
  moved and must keep meaning that — and the ledger's tests extended to a roster
  that changes size mid-history. Until then `/oekonomi` keeps naming who it
  charges, in `Hvem betaler kontingent`, which is the honest version of being
  wrong.

- **2026-07-29 — the unattributed 50 kr. of Februar 26 was Lukas's own** (T071).
  A voluntary fine he transferred himself, as treasurer, because a year in which
  the treasurer incurred no fine looked implausible — which is also why he is the
  one member with no row in the sheet's fines grid. Closes §9 Q1 and the last
  open item in the reconciliation. Imported against meeting record 26, the club's
  only February 2026 dinner, so `fines` now total **1.780 kr.** and match the
  annual report.

- **2026-07-29 — the app records member *behaviour* for the first time, and the
  boundary is in the schema (T074).** Lukas asked how often the members visit.
  Nothing could answer: `auth.users.last_sign_in_at` only moves when a password
  is typed, and a session lasts months — Saaby signed in last October and was
  still on that session in February. His ruling, and the whole scope:

  > Én linje per medlem med "sidst set", opdateret ved hvert besøg. **Ingen
  > sporing af hvad de kigger på.**

  This is worth its own entry rather than a line in STATUS.md, because it is the
  first thing this app has ever stored about what a *member did*, as against what
  the club did. Everything else here — meetings, attendance, fines, payments,
  who is a member — is a club fact, minuted, and would exist on paper if the site
  did not. A visit is not. So the limit is built into the schema instead of
  living in a convention: **one row per account, one `timestamptz`, overwritten.**
  There is no events table, no page column and no counter, and the count of
  visits is therefore unrecoverable by construction. Anything that records
  *which screens* a member opened is a new decision by Lukas, not an extension of
  this one — and it would need a second column, which is the point.

  **Where it lives, and why not on `profiles`.** `profiles` holds `role`, and its
  only UPDATE policy is *Only admins can update profiles* — verified in T010 as
  the thing preventing role self-escalation. Letting a member write his own
  timestamp there means relaxing that policy, and relaxing an UPDATE policy on
  the table that holds `role` is a write path to `role`. It would also have been
  unreadable: `profiles` SELECT is own-row-only *even for admins*. So the
  timestamp is `public.member_last_seen`, keyed by `user_id`, with **no INSERT,
  UPDATE or DELETE policy for anyone** — the only writer is `touch_last_seen()`,
  a `security definer` function that **takes no arguments** and so cannot be
  aimed at another member's row. Reads are own-row plus admin, the same shape as
  the 2026-07-26 evaluations deviation.

  **Shown folded shut, alphabetically, on `/anciennitet`, to the admin only.**
  In a club of ten where everyone knows everyone, a permanent list of who has not
  been around is a different social object from a fact you can go and look up,
  and ordering it by recency would build the league table the fold exists to
  avoid. Two of the ten have no login at all; that is said in words, never as a
  date.

- **2026-07-30 — `payments.month` is the month a payment *settles*, not the month
  the money arrived. A catch-up transfer is allocated across the months it was
  for.** (T076, on the club's first real bank statement.)

  This is the club's accounting policy, so it is a decision and not an
  implementation detail — and it is the one place in these books where the honest
  answer and the flattering answer produce the same picture. Lukas asked that one
  member who paid nothing for a year and then cleared it in a single 1.200 kr.
  transfer should appear in the graphs as having paid consistently throughout.
  Read as a request to make a chart look better, that would be falsification.
  Read as accrual accounting, which is what it is, it is simply correct:

  - **The bank total cannot move.** Allocation redistributes a payment across
    months; it can neither create nor destroy a krone. `payments` sums to
    14.880 kr. — the statement's closing balance less one transfer that settles
    August — and `allocation.test.ts` re-proves it against all 87 real transfers
    on every run.
  - **What changes is the monthly view**, which stops recording a man as eleven
    months delinquent and then wildly overpaid, and starts recording what
    happened: he owed those months, and those months are paid.
  - **The line between the two readings is evidence.** *Allocated to the months
    it settles* is a claim about what a payment was for — carried here by the
    bank's own transfer text (`Kasper jun-sep`, `Emil juni-september`) and by
    arithmetic that closes to the krone against a per-member total. *Moved so a
    graph looks nicer* is a claim about nothing. Had the 1.200 kr. left a
    remainder, or come from a member with no arrears, none of this would apply,
    and `allocateDues` throws rather than absorbing money it cannot place.

  Two limits, both deliberate. **Fine receipts are not allocated** — the
  1.780 kr. stays in the month it was collected, because the fine *charges* are
  already dated to their own meetings in `fines`, and re-spreading the receipt
  would state the same money twice in two tables. And **incurred is not
  collected**: the club has incurred 2.510 kr. of fines and collected 1.780 kr.,
  and a reconciliation's natural pull to make those two agree would write off
  730 kr. of the club's own money. They stay two numbers, and the docs say which
  is which. See `docs/finance-reconciliation.md` §16.4–16.5.

- **2026-07-30 — `members.dues_from`, and it is deliberately not called
  `joined_on`.** (T076.)

  §14.5 had specified a nullable joining date as the fix for the club's
  expected-income curve and declined to add it without evidence. The bank
  statement supplied the evidence — and showed that what it evidences is
  **liability to pay**, not membership. Christian Have has attended since møde #3
  and was fined at møde #26 in February 2026, three months before his first
  kontingent transfer; Oskar has attended 22 evenings and will never carry a
  value at all. Naming the column `joined_on` would have written a false joining
  date onto nine members that `attendances` contradicts, and §11 measures
  anciennitet by attendance, so nothing was waiting for a joining date.

  Nullable, additive, guarded on the club's own ten names, and **null means "not
  known" rather than "never"**: a member without one is charged across the whole
  window, exactly as before the column existed. A books page that silently
  under-charges is worse than one that visibly over-charges, because nobody goes
  looking for it.

## Local stack note
- **2026-07-23 — Local Supabase runs Postgres 17** (the CLI default), while prod
  is 15. Forcing local to 15 broke the bundled GoTrue's auth-schema migration
  (`confirmation_token` NULL scan errors, createUser failing). The engine version
  is irrelevant to what we test (our schema/RLS/policies), so we use the CLI's
  known-good 17 locally and diff the PUBLIC schema against the prod snapshot for
  parity — not the engine version.

## Backup
Read-only prod snapshot taken 2026-07-23 before any work: identity/mapping/counts
at `~/backups/erhvervsklubben/` (off-git, contains PII). A complete `pg_dump` is
task T000, and a fresh backup is a hard gate at cutover pre-flight.

## Open decisions (resolve at the noted phase; tracked as Q# in PLAN.md)
- ~~Q1 finance-chart data source~~ **closed 2026-07-27** — answered 2026-07-26 (see
  above), and the chart is built.
- Q3 keep prod on free tier (auto-pauses) or upgrade to paid.
- Q4 new URL / domain (is erhvervsklubbensforum.dk yours?).
- Q5 two auth users have no member mapping — who are they?
- Q7 keep the event-evaluations feature (1 row ever written)?
