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

- **2026-07-30 — a fine carries whether it has been paid (`fines.settled_at`), and
  "pålagt" / "indbetalt" / "udestående" are three figures the app must never
  conflate.** Lukas, reading the page: *"Der står i toppen af økonomisiden at der er
  udestående bøder på 2510 kr. Det passer ikke."*

  It did not. `/oekonomi` summed every fine the club had ever incurred and printed
  the total under the word *udestående*, on the card that reads as authoritative —
  overstating what the membership owes by the entire 1.780 kr. it had already paid.
  The bug class is worth naming because the arithmetic was never wrong: **one number
  was doing the job of three, and the label picked the wrong one.** The same
  conflation sat one card down in "Bøder pr. medlem", which is a collection list, and
  invited the treasurer to bill a member twice.

  **It had to be a column, not a derivation.** `payments` holds one combined figure
  per month covering kontingent and fines together, because that is all the bank
  statement itemises (§16), so nothing on the payments side can say *which* fines a
  month's money paid for. The fact therefore lives on the fine.

  Three choices inside it that could have been made dishonestly:

  * **Null means "not collected", never "unknown".** So a database that has not run
    the migration reports every fine as outstanding — wrong in the direction that
    under-claims collection. Over-claiming would let the club stop chasing money it
    is owed, which is the failure that matters.
  * **The 19-row split is T075's evidence, not a date cut-off.** The "Bøder
    indkrævet" line divides møder 21–25 from #26–#28. 1.730 ≠ 1.780, and the 50 kr.
    between them is the treasurer's own *voluntary* fine at møde #26 — money he
    transferred, so settled, even though that evening was never billed. Hence
    `meeting_number <= 25 OR rule_id = 'frivillig'`. A cut-off alone marks 1.730 kr.
    and reconciles against nothing. The migration rolls back unless all three totals
    close.
  * **`settled_at` is the collection *round*, not the transfer.** Two bank transfers
    a week apart make up the 1.780 kr. and the statement does not say which fine each
    krone belonged to. The Bødekasseregulativ collects quarterly and `payments`
    already stores the round, so that is the unit. Inventing a per-fine receipt date
    is the class of fabrication T075 refused for the offences.

- **2026-07-30 — the club's own habits are the club's, so the fine insights are not
  gated to the treasurer.** Lukas, twice in one message: *"Alle medlemmer skal kunne
  se det."* What stays his is the **bank balance** and the **list of who is behind**;
  what every member sees is what the club charges and what it is like. Consistent
  with the 2026-07-27 ruling that put `/oekonomi` on a member route at all (§8 lays
  the accounts before the whole membership).

  The tone decision inside it is the part worth recording, because the same 30 rows
  make either object: **one bar per member is a ranking of who behaves worst; one bar
  per offence is a club looking at its own habits.** He asked for *forseelser* first
  and *hvem* second, so the offence is the subject and the members are its
  composition — named in text beneath each bar rather than as nine coloured segments,
  which at 420 px would have been eight pixels for the smallest share and nine hues
  on a dimension carrying no order. `for-sent` is 86 % of every krone **by
  construction** (it is the only rule with a per-minute component), so the collective
  figure leads: 3 t 22 min of lateness across 7 of the 9 finable members. No log
  scale and no broken axis — the dominance is the finding, and a direct label on every
  bar is what makes the 50 kr. rows readable without distorting the scale.

- **2026-07-30 — the chart sweep is 1600 ms on a nearly even curve: a considered
  departure from §01's motion spec, on Lukas's word.** *"Det må godt gå lidt
  langsommere, da man ikke når at se at den bygger op."*

  T077 shipped the sweep at 900 ms on §01's `.16 1 .3 1` and predicted this exact
  complaint. That curve reaches **95 % at 43 % of its duration**, so the chart snapped
  and then spent most of its time creeping the last sliver — and a slower version of
  the same curve only lengthens the creep. The duration *and* the easing had to move
  together.

  Two things this pulls in, both recorded so the next person does not undo them:
  **all three charts share one rule** (three durations would undo T077's whole point),
  and **the count-up is now explicitly coupled to it** — the figures under the finance
  curve run 1600 ms so they still land with the line, which until now held by
  accident because both happened to be 900 ms. `SWEEP_MS` in `src/lib/reveal.ts` must
  equal the CSS duration and a test compares the two files. §01's 900 ms still governs
  every other figure; `countMs()` decides per element rather than moving the global.
  Full argument and the sampled curve profiles: `design/README.md`.

- **2026-07-30 — nothing on `/oekonomi` is gated by role any more.** Lukas, in two
  messages: *"Alle medlemmer skal gerne kunne se udestående bøder på økonomisiden.
  Det er fint med transparens."* and *"Når du nu er i gang, så må alle også gerne se
  den øverste kasse på økonomisiden."*

  The second sentence retires the 2026-07-26 entry above — *"not everyone should know
  how much money is in the bank account"* — and it is his to retire: he is the
  treasurer, and §8 already puts the accounts in front of the whole membership once a
  year. The card is that §8 report, available the other 364 days.

  It is better read as the 2026-07-27 entry finally landing. That one settled that
  there is **no privacy line inside the membership**, but two in-page gates outlived
  it: the balance card and the list of who still owes the fine box. Both are open now,
  so the rule and the screen finally agree, and `Oekonomi.tsx` reads no role at all.

  What did **not** change: RLS. `fines` and `payments` were already member-readable
  and admin-writable, and `ADMIN_ONLY_TABLES` in `tests/rls/rules.ts` is untouched —
  this was a page-layer gate over data every member could already fetch, which is
  worth knowing before anyone reads it as a security change. Writing is still the
  admin's.

- **2026-07-30 — one meetings page, and it is `/anciennitet`.** Lukas: *"Ancinitetssiden
  er den rigtige. Den må der ikke ændres på"*, then *"Men den skal merges ind … Så
  skal mødesiden fjernes."*

  The constraint governs the scope: the merge is **additive by construction**.
  Everything that was on `/anciennitet` is still on it in the order it was, and three
  things joined it — the calendar as a section on top, `attendance_records.description`,
  and a `<details>` on the card that opens onto the full text and that evening's fines.
  A page-level test asserts the *order* of the page, not only its contents, because a
  merge that quietly reorders the club's longest screen has broken the instruction with
  every feature present.

  **`events` was not deleted with its page**, and this is the decision most likely to be
  undone by someone tidying up. It holds two things `attendance_records` structurally
  cannot: **meetings still ahead** (an attendance record for a meeting that has not
  happened is a record of who attended it — this is why the two tables were never one),
  and **a held meeting whose record has no date** (`2025-04-26 #20` carries real prose
  and record #20 is one of the eleven undated ones). Delete the calendar section and the
  club's next meeting becomes unchangeable, on the front page as much as here.

  **The backfill matched on date, corroborated by lead** — 8 of 12 events, only where the
  date carries exactly one row on each side. Seven of the eight name their lead in their
  own text and every one agrees with `attendance_records.lead`; the eighth matches on
  venue. The number in the title is **never** used: T071 established the club's numbering
  ran a meeting ahead of the database's through the middle of the history, so joining on
  "#20" would move a third of it by one.

  Also here, because it belonged nowhere else: `useFinance` moved to
  `data/useClubData.ts` and both pages share the one `['finance']` query rather than each
  keeping a copy of the fines retry ladder.

- **2026-07-30 — the app bar's mark walks its blue line once per arrival, not on a
  loop.** Lukas asked for the landing intro's line to travel around the small logo
  on the members' screens — *"sådan stille og roligt kører rundt om logoet som står
  oppe i venstre hjørne"* — and asked outright whether it was a bad idea.

  **The gesture is good; "forever" is the bad part**, and that is the only thing
  that was changed. A loop in a sticky app bar is motion in the reader's periphery
  on every screen at all times: the eye is drawn to movement, so it would compete
  permanently with the club's own figures, and WCAG 2.2.2 wants a way to stop any
  non-essential motion running past five seconds — a pause control in this app bar
  is absurd. Measured: nothing is animating five seconds after arrival, so a phone
  left open on the page costs nothing.

  So it plays once when you land on a page. The mechanism is `key={pathname}` on
  the mark in `Shell.tsx` and nothing else: the Shell outlives every navigation, so
  a CSS animation inside it would run once per *session* — a failure nothing visible
  would report, because the frame ends in its finished position and the bar looks
  right. Re-keying replaces the element, which is what restarts it. No timer, no
  state, no effect.

  The line **stays** when it stops, which is what makes reduced motion correct
  rather than blank: the finished state is the elements' plain CSS, so someone who
  asked for less motion gets the completed frame immediately.

  Told to him plainly as a departure from what he described, with the loop offered
  as a one-line change if he prefers it after seeing this.

- **2026-07-30 — one list of meetings, one button, and no meeting twice.** Lukas, on
  the first version of the merge: *"Problemet er at der jo ligger to knapper der laver
  møder … alle møder ligger flere gange. Altså denne funktionalitet med at have møder
  separat fra kortene på anciennitetssiden giver ikke så meget mening. Det er jo alt
  sammen møder."*

  He was right twice and the second was a real defect I shipped: the calendar section
  rendered **every** held `events` row, and ten of the twelve are the same evenings as
  the attendance cards below them. The club's history was on the page twice.

  Three fixes, and the shape they share is *the two tables stop showing through the
  screen*:

  1. **`heldDates`.** `/anciennitet` passes the set of dates its records cover, and a
     calendar row on one of those dates is not drawn. Verified against production: 8
     rows hidden, 2 planned, 2 genuinely calendar-only.
  2. **Filtering on "is it in the future" would have been wrong**, which is why it
     filters on the history instead. `2025-04-26 Erhvervsklub #20` is behind us and its
     record was never dated; a meeting whose year is mistyped is behind us too. Both
     must stay reachable, and both now appear under "Kun i kalenderen".
  3. **One button.** `useSaveMeeting` routes on the date it is given — ahead goes to
     `events`, today or behind is recorded with its attendance — and the form drops the
     ten attendance buttons and gains a time field when the date is ahead, *saying so*
     rather than silently changing shape. **Only on create:** changing an existing
     record's date to a future one is a mistyped year, and routing that to `events`
     would strand ~10 attendance rows and the evening's fines on a record nothing
     renders. Both cases have a test.

  What did **not** change: the tables. An attendance record is a record of who
  attended, so a meeting still ahead cannot have one — that is why `events` exists and
  why it was never merged away in the database.

- **2026-07-30 — the calendar shows what is ahead and nothing else.** Lukas, on the
  two rows that were not duplicates: *"Fjern de to kalender aftaler som kun er i
  kalenderen. De er gamle og vi laver formentligt ikke sådan nogle igen. Så fjern dem
  fra frontenden."*

  **Frontend, not the database** — his word, and the right one. `2025-04-26
  Erhvervsklub #20` carries the only prose the club has ever written about that
  evening, and its record is one of the eleven that never got a date, so nothing could
  pair them. Both rows stay in `events`, and a future pass can move #20's description
  onto its record the day that record gets a date. A row nobody renders costs nothing;
  a deleted row is gone.

  This retires `heldDates` one commit after introducing it, and that is the point
  rather than churn: it existed to hide *past* calendar rows that duplicate the
  attendance cards, and nothing past is drawn now. Nothing to deduplicate, so the
  filter is a date instead of a set of dates.

  **The mistyped-date safety net moved rather than disappearing**, which is the part
  worth keeping straight. It used to be "past rows stay visible". Now: a *new* meeting
  given a past date is routed to `attendance_records` and lands among the history
  cards, visible and editable — so the common typo is covered by the routing itself.
  The one remaining path, editing a planned meeting's date into the past, makes the
  card leave the list, so the form says so **before** Gem. A card that vanishes on
  save with no explanation reads as data lost.

- **2026-07-30 — /anciennitet runs newest-first the whole way down.** Lukas, on a
  screenshot: *"Er det ikke lidt spøjst med rækkefølgen?"* It was: the planned
  meetings ran soonest-first and the history newest-first, so the page read **29, 30,
  28, 27** — the number climbing and then dropping back.

  The bug came from a decision that had been correct: `/moeder` ran its two halves
  outward from today, *"soonest first ahead, most recent first behind — because both
  mean nearest to now"*, and with two headings and two sections that reads fine. It
  stopped being fine when the two became one continuous stream, and neither group's
  own sorting was wrong — which is why the test is a property of **the whole page**
  (`['30','29','28','27']`) rather than of either group. A per-group assertion would
  have passed throughout.

  The blue border on the next meeting is now found **by id**, not by position: after
  the flip the soonest planned meeting is the *last* of them, and `i === 0` silently
  marking the furthest-off meeting instead is exactly the kind of thing a reader would
  not think to question.

- **2026-08-08 — recording a fine stays with the admins, and the screen finally says
  so.** Lukas asked: *"Er det kun admins som kan registrere bøder?"* In the database,
  always — `Admins write fines` covers every write on the table and has since
  2026-07-26. On the screen, no: "Registrér bøder" rendered for all nine logins, so
  six members could fill the form in and have RLS refuse it on Gem.

  **The gate added here is not security.** The policy is, and it did not move. This
  is the app telling the truth about who may do what, which is the one rule every
  other write in it already follows — `/nyheder`, `/anciennitet` and the calendar all
  hide their controls from whoever may not use them. A swept check of every
  write-capable file found this was the only one missing it.

  He was offered the other direction and declined it, which is worth recording
  because the argument for it is real: the club's own practice is that **the
  evening's Lead notes the fines**, and only three of the ten members are admins
  (Lukas, Anders, Rasmus). The 730 kr. of fines a Lead noted and nobody billed is
  what that friction looks like. His call, 2026-08-08: keep it with the admins, and
  keep the admins at three.

  Note the asymmetry that survives, deliberately: **reading is open to everyone and
  writing is not.** Since 2026-07-30 every figure on `/oekonomi` is the whole club's
  — the balance, the collection list, both charts. Hiding the capture form must never
  be read as walking that back, and a test asserts both halves together.

- **2026-08-08 — a member can change his own password, and is not asked for the old
  one.** Lukas: *"Der er en del som gerne vil have ændret deres password."* There was
  no way to at all — he created every login, so a member who wanted a different
  password had to ask him to change it in the database.

  Folded shut at the bottom of `/hjem`, the same `<details>` idiom as "Sidst set":
  /hjem is the one screen that is about the member rather than the club, and a
  password change is an errand rather than a reason to open the app.

  **Not asking for the current password is the decision here**, and it is the
  opposite of what the obvious design does. It would lock out precisely the people
  this is for: the club's sessions outlive the sign-in that made them by months —
  T074 found Saaby still on an October session in February — so a member who has not
  typed his password since Lukas handed it to him cannot produce it. The session is
  the proof of identity, which is the standard every other write in the app already
  runs on. The cost is stated rather than hidden: someone holding an unlocked phone
  could change its owner's password. In a club of ten with no money moving through
  these accounts, that is smaller than nine men stuck on a password somebody else
  chose.

  **Hidden in READONLY and DEMO builds, and that needed saying out loud.** The
  read-only Proxy in `lib/supabase` wraps `from` and `rpc` — where the club's *data*
  is — and `auth.updateUser` sails straight past it. A preview build carries the real
  project, so without this gate the one build that exists to be harmless could have
  changed a real member's real password. Two tests hold it.

  Minimum eight characters, against Supabase's own floor of six, because one member
  is on `1234` and getting off those is the point. Typed twice: a typo in a single
  field is a member locked out until Lukas fixes it by hand, which is the errand
  being retired.

  One thing this is *not*: a forgotten-password flow. That needs e-mail delivery
  configured on the Supabase project and is a separate decision.

- **2026-08-08 — the club keeps a visit history, one row per member per day.** Lukas:
  *"Gerne login aktivitet inkl. hvor mange gange folk har været inde og hvornår. En
  graf."* And, closing the other question: **Saaby is not an admin.** The three stay
  Lukas, Anders and Rasmus.

  **The app could not answer this, by design.** T074 built `member_last_seen` as one
  timestamp per member, overwritten on every visit, and wrote down that *"the count of
  visits is unrecoverable by construction."* So this is a new table rather than a
  column, and the honest consequence is that **the graph starts 2026-08-08**. Seven
  rows were seeded — each member's one surviving timestamp, as a visit on its own
  date — and that is the entire recoverable past.

  **A day, not a page load**, and that decides what "hvor mange gange" means. A member
  who reloads three times over lunch has been in once; counting loads would measure
  his browser rather than his interest. `unique (user_id, visited_on)` enforces it in
  the schema, so a second tab cannot double-count — the dedupe is not the client's to
  get right.

  **Still not page tracking.** A row says a member opened the site on a day. Not which
  screen, in what order, or for how long. That is the same line T074 drew and it has
  not moved.

  Written by `touch_visit()` only — security definer, no arguments, `anon` revoked —
  and the table has **no write policy for anyone, the admin included**. A member who
  could write it could forge a visit, which is the one thing that would make the graph
  not worth drawing.

  The chart is by **week**: a club of ten produces a handful of visits a day so a
  daily axis is mostly gaps, and §9 puts a meeting on the calendar every other month
  so a monthly bar would flatten the thing worth seeing — whether the site is opened
  between meetings or only around them. Empty weeks are kept, because dropping them
  would draw over exactly the quiet stretches the chart exists to show.

- **2026-08-08 — anyone may write a news item; only the board publishes it.** Lukas's
  wishlist: *"alle kan skrive nyheder, men skal godkendes af bestyrelsen."*

  **"Bestyrelsen" is the three admins, and that is a choice made here rather than one
  he stated.** The app has two roles and no board. A third role would be a bigger
  change than the feature and would need a decision nobody has made; the admins are
  already the men who write the club's news, so approval landing with them changes who
  may *write* rather than who may *publish*. If the club wants the formand in that set
  — Saaby is not an admin — it is one row in `profiles`, not a schema change. **The
  mechanism does not care who is in the set**, which is what makes that safe to
  revisit.

  **The property everything hangs on: there is no statement a member can send that
  publishes anything.** Not a convention in the app — `with check` on INSERT *and* on
  UPDATE. The second is the one that is easy to omit: with only the first, a member
  could insert a draft and immediately approve it, and the feature would be decorative.
  Both cases have a named RLS test.

  `news` is **anon-readable** by the club's 2026-07-23 decision, so a draft in this
  table is a draft on the internet unless the policy says otherwise. The anon SELECT
  is now `status = 'godkendt'`, and a test asserts a draft is invisible to the public,
  invisible to the other members, and visible to its author and the board.

  It stays in `PUBLIC_TABLES`: that bucket is defined by its *reads*, which still hold.
  The generated member-denial tests also still hold and still mean the right thing,
  because `SAMPLE_ROW.news` is a **published** row — a member creating one is denied,
  which is the rule. That he may create a draft is asserted by name, where the two
  cases can be told apart by the one column that differs.

  Four columns: `status`, `author_id`, `approved_by`, `approved_at`. The default is
  `godkendt`, which is what keeps the club's nine existing items published and what
  makes an admin's insert behave as it did yesterday; a member's is forced to `kladde`
  by policy rather than by the default. The migration refuses to finish if any
  existing item ended up a draft — an item silently unpublished is the failure nobody
  would notice until a member asked where the news went.

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
