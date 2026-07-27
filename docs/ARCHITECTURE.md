# Architecture

Components, dataflows, and interfaces of the rebuild. For the current *state* of
work see [STATUS.md](STATUS.md); for decisions and why, [PROJECT.md](PROJECT.md).

## Big picture
A React SPA talking directly to Supabase (Postgres + Auth + PostgREST) — the same
shape as the current Lovable app, on the **same Supabase backend**. No custom
server; the database's RLS *is* the authorization layer.

```
  Browser (React SPA, Vite build)
     │  supabase-js (anon key + user JWT)
     ▼
  Supabase project  ──────────────────────────────
     • Auth (GoTrue)      email+password logins
     • PostgREST          /rest/v1/<table>  (RLS-filtered)
     • Postgres 15 (prod) 7 public tables, RLS on all
  ───────────────────────────────────────────────
  Environments:
    local/CI  → local Supabase stack (Docker), migrations + seed  [PG17]
    staging   → cloned Supabase project, new Vercel URL           [pending]
    prod      → project urlabzyihqrsdeasvrfe, old site still live  [PG15]
```
Which DB an environment uses is set by two build-time env vars
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — that is also the cutover switch.

## Frontend stack
- **React 19 + Vite + TypeScript**, **React Router**. Routes are Danish, and are
  declared once with their access level in `src/routes/routes.ts`: `/` and
  `/login` are public; `/hjem`, `/anciennitet`, `/nyheder`, `/regler` and
  `/oekonomi` need a login. `/` is the club's public landing page since
  2026-07-27; a signed-in member opening it is forwarded to `/hjem`. The
  intended levels are asserted independently in `routing.test.tsx`, so changing
  one takes two deliberate edits rather than one word.
- **TanStack Query** for data fetching/caching; **supabase-js** as the client.
- **Recharts** for the two charts (attendance bar, finances line).
- **Tailwind v4** with all design tokens in `src/index.css` `@theme` — the single
  seam where the Claude Design template drops in (components use tokens only).
  The same file holds the landing page's logo intro and the design system's
  three surfaces, for the same reason: one place, and a test guarding it.

## Data model (7 public tables, RLS on all)
See [schema-snapshot-2026-07-23.sql](schema-snapshot-2026-07-23.sql) for verbatim
DDL and [DISCOVERY.md](DISCOVERY.md) for the narrative. Summary:

- **profiles** `(id→auth.users, role admin|user)` — role is the whole authz model.
- **user_member_mapping** `(user_id→profiles UNIQUE, member_name)` — links a login
  to a display name. `member_name` elsewhere is free text, decoupled from logins.
- **news**, **events** — content; SELECT is public (anon-readable, by decision).
- **attendance_records** `(serial id, meeting_number, lead, 3× venue)` — one per meeting.
- **attendances** `(serial id, record_id→records, member_name, attended)` — the
  matrix cells. A (meeting, member) with no row = a third state, "none" (not absent).
- **event_evaluations** `(uuid id, user_id→auth.users, record_id→records, 9× rating
  1–5 + comment)` — per-user post-meeting feedback. No DELETE policy → never deletable.

### Functions / trigger (both SECURITY DEFINER)
- `get_user_role(uuid)` — reads a role bypassing RLS; used by admin-write policies.
- `handle_new_user()` on `on_auth_user_created` (AFTER INSERT on `auth.users`) —
  provisions a `profiles` row (role `user`) on signup. Miss it and signups break.

## Authorization model (RLS — the security surface)
Two roles via `get_user_role()` / a `profiles` subquery. Read: authenticated users
read news/events/attendance_records/attendances; news/events also anon-readable.
Write: admin-only for news, events, attendance_records, attendances,
user_member_mapping, and profile updates. event_evaluations: each user only their
own rows. Members cannot update `profiles` at all (no self-escalation).
The RLS test suite ([tests/rls](../tests/rls)) is the executable spec for this.

## Seniority (the core feature) — planned shape
One pure pivot module turns `attendance_records` + `attendances` into
`MeetingRow[]` (record fields + `Map<member, attended|absent|none>`) and
`memberTotals`. Rendered as: meeting **cards** below `lg`, a sticky-column
scrollable **matrix** at `lg+`, both keyed by `record_id` (not meeting_number —
duplicates exist). Tapping a member opens their attendance timeline. See PLAN.md §3.

## Testing layers
| Layer | Where | Runs against |
|---|---|---|
| Component/unit | `src/**/*.test.tsx` (jsdom) | mocked — `npm test` |
| RLS integration | `tests/rls` (node) | local Supabase stack — `npm run test:rls` |
| Schema parity | `tests/schema` (planned T011) | local vs prod snapshot |
| E2E | Playwright (planned T081) | local stack, 390px + 1280px |
