# Task: T074 "sidst set" — one timestamp per member

## The problem
Lukas asked how often the members visit. Nothing in the app could answer.

- `auth.users.last_sign_in_at` only moves when somebody types a password, and a
  Supabase session survives for months. Saaby signed in last October and was
  still using that session in February — by that column he had not been near the
  site in four months.
- `auth.sessions` is closer, but it holds one mutable row per session, so each
  visit overwrites the last and the count of visits is unrecoverable.

## Lukas's ruling (2026-07-29), approving this work
> Én linje per medlem med "sidst set", opdateret ved hvert besøg. **Ingen
> sporing af hvad de kigger på.**

So: one row, one timestamp, overwritten. No events table, no page column, no
counter. The second sentence is the load-bearing one — this is the first thing
the app records about member *behaviour* rather than about the club, and the
line it must not cross is written into the schema rather than into a convention.

## The security trap, and what was done about it
`profiles` carries `role`. Its only UPDATE policy is *Only admins can update
profiles*, which was verified in T010's fidelity work to be the thing preventing
role self-escalation: a member cannot update `profiles` at all. Putting
`last_seen` there means relaxing that policy, and **any relaxation of an UPDATE
policy on the table that holds `role` is a write path to `role`.**

It would also not have worked: `profiles` SELECT is `auth.uid() = id`,
own-row-only *even for admins*, so a timestamp stored there is one Lukas cannot
read.

So the timestamp lives in **`public.member_last_seen`**, keyed by `user_id`, and
the write path is narrower than any policy could be:

- **No INSERT, UPDATE or DELETE policy on the table, for anyone** — member,
  admin or treasurer. RLS denies what it does not permit, so there is nothing to
  widen later by accident.
- The only writer is **`touch_last_seen()`**, `security definer`, which **takes
  no arguments**. A member cannot name another member's row because there is no
  parameter in which to name one, and it sets no column but the timestamp
  because it mentions no other column. The property is in the signature, not in
  a policy somebody has to keep correct.
- Reads: your own row always, plus the admin — the same shape as the 2026-07-26
  deviation on `event_evaluations`.

## What was built
- `supabase/migrations/20260729210000_last_seen.sql` — the table, two SELECT
  policies, the function, the grants. **Applied to production 2026-07-29.**
- `src/data/lastSeen.ts` — `markSeen` (fire-and-forget, once per app load) and
  `useLastSeen` (the admin read, `member_last_seen` × `user_member_mapping`).
- `src/App.tsx` — `useMarkSeen(useAuth().userId)`. In App and not in the Shell:
  App is mounted once and survives every navigation, so six screens are one
  visit rather than six.
- `src/components/LastSeen.tsx` — the admin surface on `/anciennitet`, folded
  shut, alphabetical.
- `src/lib/dates.ts` — `daWhen`, the one date in this app rendered in the
  reader's own zone rather than in UTC, because a visit is an instant and every
  other date here is a day the club agreed on.
- `tests/rls/rules.ts` + `tests/rls/rls.test.ts` — classified as a personal
  table, and eight named assertions rather than generated ones.

## The bug production found and a local database could not
`revoke all on function … from public` is **not enough on a hosted Supabase
project.** It carries a default privilege granting EXECUTE on every new function
in `public` to `anon`, `authenticated` and `service_role`, so anon arrives
holding a grant of its own that revoking from PUBLIC does not touch. A database
built from these migrations alone does not have that default, so the hole passed
every local check and was open in production for the four minutes between the
two migrations.

Caught by impersonating `anon` against the club's own project after applying.
`revoke all on function public.touch_last_seen() from anon` is now an explicit
line in the migration, and Supabase's own security advisor confirms the function
is callable by `authenticated` only.

The function was a no-op without a session either way (`where auth.uid() is not
null`), so nothing could have been written. That is the belt; the revoke is the
braces, and it is the one a reader can see.

## Proof
- `npm test` — 318, green. `npm run build`, `npm run lint` — clean.
- `tests/rls` runs in CI against a real stack. The same eight properties were
  also proved by hand against **production**, every one inside a transaction
  that was then rolled back: the function writes exactly one row and it is the
  caller's; a member's direct INSERT of anyone's row (his own included) is
  denied 42501; his UPDATE and DELETE match zero rows; an admin's direct INSERT
  is denied too; anon can neither read nor call; a member sees one row and the
  admin sees the club's; and `update profiles set role='admin'` still matches
  zero rows.
- Read back after applying, against the figures in STATUS.md: **28 meetings, 235
  attendances, 18 fines / 1.780 kr., 13 payments / 13.280 kr., 10 members**, 9
  news, 12 events, 1 evaluation, 9 profiles, 9 mappings — every one unchanged,
  and `member_last_seen` at **0 rows**.

## Not done, deliberately
- **Nothing records which pages anyone opened.** If a future task wants that, it
  is a new decision by Lukas, not an extension of this one.
- **No backfill.** There is no honest source for when anyone last visited before
  today, and inventing one would make the first month of this table a lie.
- The table cannot distinguish a member with no login from one who has never
  opened the site — the app can, by reading `user_member_mapping`, and it says
  both in words rather than rendering either as a date.
