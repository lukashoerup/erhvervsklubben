# Task: T069 a real notion of who the members are, and what each one owes

## The problem
There was no members table. The roster was `select distinct member_name from
attendances` — free text — so "member" meant "has turned up at least once". Two
consequences, and the second cost money.

1. **§3's active/inactive split existed only in people's heads.** The statutes
   are explicit: *aktive medlemmer* pay kontingent and hold voting rights,
   *inaktive* are on pause, pay nothing and may not attend. The app could not
   tell them apart.
2. **`buildLedger` charged the whole roster.** `/oekonomi` passed
   `roster.length` into `activeMembers`, so the expected-income line — the blue
   curve every member now sees — has been too high since the day it was drawn.

## Lukas's ruling (2026-07-29), approving this work
> **Oskar** is a real member and attends, but as a *founding father* he **pays
> no kontingent, incurs no fines, and does not vote on the use of the club's
> funds** (§12).

Not "inactive": §3 says an inactive member may not attend, and he attends —
22 of the club's meetings. And §11 earns anciennitet by attendance alone, so
his is untouched.

## What was built
- `src/data/members.ts` — the member record, the three statuses and the rights
  table. **One row per status**, so the founding father's three exemptions are
  stated once and the finance code asks rather than each screen remembering.
- `supabase/migrations/20260729180000_members.sql` — `public.members`, RLS, and
  the club's ten seed rows. **Applied to production 2026-07-29.**
- `src/data/derive.ts` — `buildRoster` takes the member list; `RosterEntry`
  carries a `status`. A member with no attendance yet is on the roster on
  nought; a name in the history that no member row claims keeps its history and
  gets `null`.
- `src/data/useClubData.ts` — `readMembers`, tolerating a database older than
  the table (the pattern `readRecords` already uses). It falls back to *no
  members*, not to the attendance names: an app that cannot read the member list
  must under-charge, never guess.
- `src/data/ledger.ts`, `src/data/rules.ts` — `activeMembers` → `payingMembers`,
  with the reason in the signature.
- `src/pages/Oekonomi.tsx` — the caller fixed, the fine-capture screen filtered
  by `canBeFined`, and a new **"Hvem betaler kontingent"** card naming the base
  and every member left out of it.
- `tests/rls/rules.ts` — classified as a shared table: members read, admins
  write. `supabase/seed.sql` — four synthetic members, one of them inactive.
- 18 new tests. `npm test` 234 → 252. Build and lint clean. No new dependency.

## The number
Against the club's real books — 13 payments, 17 fines, all 28 meetings undated:

| | expected (opkrævet) | received | reported as |
|---|---|---|---|
| before | 14.000 kr. | 13.280 kr. | 720 kr. **short** |
| after | 12.600 kr. | 13.280 kr. | 680 kr. **ahead** |

A 1.400 kr. correction, and the sign flips. The new figure agrees with the
club's own annual report independently: 9 × 200 = **1.800 kr./md**, which is the
"hævet fra 800 til 1.800 kr/md" the report states. Ten members never did.

Read back after the migration: 235 attendance rows, 28 meetings, 17 fines
totalling **1.730 kr.**, 13 payments totalling **13.280 kr.** — all unchanged.

## Decisions
- **`alumne` (§4 Stk. 5 A) is not built.** It only arises after two years of
  inactivity and a vote, and the club has never had an inactive member. Same
  reasoning as anciennitet revocation: it is a check constraint and a label the
  day the club votes one, and until then it is a status no row can hold.
- **Keyed by name, not by id.** `members.name` matches
  `attendances.member_name` with no foreign key between them, which is what let
  this land without touching 235 rows of history. Migrating every table to
  member ids is a bigger job with a bigger blast radius and was not needed to
  stop over-charging.
- **The seed rows are guarded by `where exists` against `attendances`** — the
  lesson from this morning's CI break. A database that is not this club's gets
  the table and no rows; the local stack's members come from `seed.sql`.
- **The founding father is left out of fine capture, not shown and refused.** A
  chip that cannot be tapped invites the Lead to work out why while settling a
  bill.
- **A flat payer count across the whole history, not per month.** The club has
  never recorded when a member joined. The pre-June-2026 months therefore still
  compute 900 kr. where the sheet charged 800 — one member the club did not yet
  have. Inventing a joining date to make those months land would be a guess
  dressed as a figure; see below.

## Not done / left open
- **Joining dates.** The historical months are still slightly high (900 vs the
  800 actually charged before June 2026) because `members` has no `joined`
  column. It needs Lukas's memory or the old agendas, not more code.
- **The status is not editable in the app.** An admin changes it in the database
  today. That is the same place the club stood on news, events and attendance
  before T063/T065, and it is the obvious next task if a member ever pauses.
- **`votesOnFunds` is read by no code path.** Nothing in the app votes yet. It
  is recorded so the third exemption is not left in a chat message.
