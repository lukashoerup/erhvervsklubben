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
- [x] Email/password sign-in and sign-out against the existing Supabase auth
- [x] Session survives a page reload
- [x] Routes are declared as public / members-only / admin-only, in one place
- [x] A signed-out visitor hitting a members-only URL lands on the login page,
      and returns to the page they wanted after signing in
- [x] A signed-in member hitting an admin-only URL is refused, not shown an
      empty screen
- [x] Public pages (landing, about, news, events) work fully signed out
- [x] Component tests for the routing rules — these run offline in the fast
      suite, so they must not need the Supabase stack
- [x] Green in CI

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

## Working notes (agent fills in)
- Done 2026-07-26. 23 tests, all offline — the fast suite still needs no
  Supabase stack, which was a hard requirement for CI.
- **No new dependencies.** react-router-dom, supabase-js, TanStack Query and
  Recharts were already installed per the 2026-07-23 stack decision.
- `AuthContext` deliberately has no default implementation. Tests supply auth
  state directly, which is what keeps route-guard tests away from the network.
- The role is read from `profiles`, not from the JWT, because that is where the
  database's own `get_user_role` reads it. Trusting a different source would let
  the interface and the security disagree, and the database wins that argument.
- The login error is deliberately vague. Supabase distinguishes "no such user"
  from "wrong password"; echoing that tells an attacker which emails are members.
- `RequireAccess` renders nothing while the session is still loading rather than
  redirecting. Redirecting during that window logs everyone out on every hard
  refresh — the classic version of this bug, invisible until someone reloads.
  There is a test for exactly that.

### A flaw caught in review, worth keeping
The route tests derive their expectations from `ROUTES` itself, so they prove
the guards work but cannot catch a route declared at the **wrong** level — the
tests would just verify the mistake. Demonstrated: downgrading `/oekonomi` to
`member` left the whole suite green.

Fixed by writing the intended policy out independently (`INTENDED` in
`routing.test.tsx`) and asserting the two agree. Changing an access level now
fails until someone changes the expectation too — a deliberate act rather than a
one-word edit. Verified by re-running the downgrade: it now fails.

### Also landed here
`src/index.css` now carries the agreed palette instead of the placeholder
tokens, which closes the T031 theme seam — the design was settled with Lukas
rather than arriving as a template.

### Not built
The pages are shells. Content lands with the data layers; the shape and the
access rules are what this task was for.
