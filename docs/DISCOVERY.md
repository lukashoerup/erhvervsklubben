# Erhvervsklubben — discovery (2026-07-23)

What the current live app is, measured directly from the running site and its
database. This is the source of truth for planning the rebuild. Everything here
was observed, not assumed.

## What it is
A private members' site for **Erhvervsklubben**, a Copenhagen business/social
networking club (~10 members). Framed as business networking; functionally it
tracks the club's recurring meetings at bars/restaurants, who attended, whose
turn it was to lead, and the club's finances. Real personal data (member names
and attendance history) — small audience, but privacy matters.

## Current stack
- **Frontend:** Lovable app (React SPA, client-rendered) at
  `https://kobenhavn-forum-connect.lovable.app/`.
- **Backend:** Supabase project `Erhvervsklubbens Forum`
  (`urlabzyihqrsdeasvrfe`, eu-north-1, Postgres 15). The live site talks
  **directly** to this project's REST API — old site and this DB are the same
  system. It was paused; restored 2026-07-23 to inspect (read-only).

> NOTE: an earlier read reported this DB as "empty". That was a mid-restore
> artefact — the tables had not come back yet. The DB is populated (below).

## Routes (all client-side)
| Path | Auth | Purpose |
|---|---|---|
| `/` | public (richer when logged in) | Marketing home + upcoming events |
| `/about` (Om os) | public | About the club |
| `/login` | public | Email + password auth |
| `/news` (Nyheder) | member | News posts |
| `/events` (Begivenheder) | member | Event list |
| `/seniority` (Anciennitet) | member | **The core feature** — attendance matrix + finances |

## Data model (public schema, RLS enabled on every table)
Row counts as of 2026-07-23: auth.users 10, profiles 10, news 8, events 10,
**attendances 235**, attendance_records 29, event_evaluations 1,
user_member_mapping 8.

- **profiles** `(id uuid PK → auth.users.id, role user_role[admin|user], timestamps)`
  — role is the entire authorization model.
- **news** `(id uuid PK, title, excerpt, author, date, timestamps)`
- **events** `(id uuid PK, title, date, time text, location, description, timestamps)`
- **attendance_records** `(id serial PK, meeting_number int, lead text,
  pre_location, main_location, post_location, timestamps)` — one row per meeting.
- **attendances** `(id serial PK, record_id → attendance_records.id,
  member_name text, attended bool)` — one row per (meeting, member). 235 rows =
  the ✓/✗ matrix cells.
- **event_evaluations** `(id uuid PK, user_id → auth.users, record_id →
  attendance_records, 9× {aspect}_rating int 1..5 + _comment, timestamps)` —
  post-meeting feedback across pre/location/post/lead aspects. Only 1 row so far.
- **user_member_mapping** `(id uuid PK, user_id → profiles.id UNIQUE,
  member_name text)` — links a login to a display name used in the matrix.

### Functions / triggers
- `get_user_role(user_id uuid)` — used throughout RLS.
- `handle_new_user()` on `on_auth_user_created` — provisions a profile row when
  a user signs up. **Must be preserved or new signups break.**

### Authorization (RLS) — the migration's riskiest surface
Two roles, `admin` and `user`, resolved via `get_user_role()` / `profiles.role`.
- **Read:** any authenticated user can read news, events, attendance_records,
  attendances. `events`/`news` SELECT are even `public` (anon-readable).
- **Write:** admin-only for news, events, attendance_records, attendances,
  user_member_mapping, and profile updates.
- **event_evaluations:** each user manages only their own rows (`auth.uid() =
  user_id`).
Getting these policies wrong = either data leak or a broken app. They must be
carried over verbatim and tested.

## Design (see docs/old-site-shots/)
Generic Lovable theme: dark navy (~#0a1a3a) hero/nav, cyan (#29b6d8-ish)
primary button, white content cards, system sans. Marketing pages are already
responsive (hamburger, stacked cards on mobile).

**The mobile problem is the data views**, above all `Anciennitet`:
- `Fremmøde Oversigt` — bar chart, attendance count per member.
- The **attendance matrix** — 28+ meeting rows × ~10 member columns of ✓/✗,
  plus Lead / Før / Sted / Efter text columns. A wide matrix like this is
  unusable on a phone as-is. This is the central UX challenge of the rebuild.
- `Klubbens Finanser` — line chart, actual vs expected balance over time.
- Admin-only `Edit` / `Add New Record` controls inline.

## Constraints carried from Lukas
- **Do NOT kill the old site.** It stays live until an explicit cutover.
- **Do NOT lose the data.** 235 attendances + members are the irreplaceable part.
- Rebuild with a **better, more mobile-friendly** design. Lukas will supply a
  design template from Claude Design.
- Coexistence chosen: **parallel — new site at a new URL, old stays live.**

## Open decisions the plan must resolve (flag to Lukas)
1. Old site writes to THIS production DB. Does the new site during development
   use (a) a cloned staging DB, or (b) the same prod DB read-only? A clone is
   cheap here (~300 rows) and removes all risk of dev work touching live data —
   recommended.
2. Target stack for the rebuild (keep React/Vite + Supabase JS, or other).
3. Where the new site is hosted (Vercel? the lenovo? Lovable again?).
4. Auth: reuse the existing Supabase auth users (so members keep their logins),
   which argues for keeping the same Supabase project at cutover.
