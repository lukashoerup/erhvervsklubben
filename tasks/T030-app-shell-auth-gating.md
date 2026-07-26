# Task: T030 app shell, login, and gating pages behind it (phase 3)

## Goal
The app currently has no login and no routing. Build the shell: sign in, sign
out, session handling, and route protection — so that pages showing member data
cannot be reached by someone who is not signed in, and admin-only screens cannot
be reached by a member.

## Lukas's requirement (2026-07-26)
> "People who are not logged in should of course not be able to read attendance
> records or financials etc. These pages should be behind the login pages."

**At the data level this is already true and tested.** A signed-out visitor gets
zero rows from `attendances`, `attendance_records`, `profiles`,
`user_member_mapping` and `event_evaluations` — proven by the suite in
`tests/rls/rls.test.ts`, including a sweep asserting no gated table is readable
by the open internet. So even if someone typed the URL of a members page today,
there would be no data behind it.

**What is missing is the page layer**, which is this task. Two separate things,
and both are needed:
- *Data* protection stops the information leaving the database. Already done.
- *Page* protection stops a signed-out visitor landing on a broken members page
  and stops the URL being shareable. Not built.

Do not treat the data rules as making route guards optional, or vice versa. A
route guard is not security — anyone can bypass the JavaScript. The RLS policies
are the security; the route guard is what makes the site behave correctly.

## Acceptance criteria
- [ ] Email/password sign-in and sign-out against the existing Supabase auth
- [ ] Session survives a page reload
- [ ] Routes are declared as public / members-only / admin-only, in one place
- [ ] A signed-out visitor hitting a members-only URL lands on the login page,
      and returns to the page they wanted after signing in
- [ ] A signed-in member hitting an admin-only URL is refused, not shown an
      empty screen
- [ ] Public pages (landing, about, news, events) work fully signed out
- [ ] Component tests for the routing rules — these run offline in the fast
      suite, so they must not need the Supabase stack
- [ ] Green in CI

## Scope
**May change:** `src/`, `tests/`
**Must NOT touch:** `supabase/migrations/` — no schema or policy change belongs
in this task

## About financials
There is no financials table. The schema has seven tables and none of them hold
money: `profiles`, `news`, `events`, `attendance_records`, `attendances`,
`event_evaluations`, `user_member_mapping`. This is open question **Q1** — where
the finance data would come from — and it blocks the finance chart (T054).

When it does arrive it must be added to `tests/rls/rules.ts`. A guard now fails
the suite if any table the API exposes has not been classified, so a financials
table cannot be created and quietly left readable — someone has to decide who
may see it.

## Docs affected
`docs/ARCHITECTURE.md` (routing and auth), `docs/STATUS.md` (phase 3).

## Size check
Likely two sessions: auth plumbing, then route protection with its tests.

## Working notes (agent fills in)
