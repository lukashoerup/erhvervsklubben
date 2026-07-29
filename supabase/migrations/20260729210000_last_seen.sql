-- "Sidst set" — when each member last opened the site (T074).
--
-- Lukas asked how often the members visit and the app could not answer.
-- `auth.users.last_sign_in_at` only moves when somebody types a password, and a
-- Supabase session survives for months: Saaby signed in last October and was
-- still using that session in February. `auth.sessions` is closer but holds one
-- mutable row per session, so every visit overwrites the last.
--
-- What he approved, in his words: "én linje per medlem med 'sidst set',
-- opdateret ved hvert besøg. Ingen sporing af hvad de kigger på." So this is one
-- row per account holding one timestamp, and nothing else. There is deliberately
-- no event table, no page column and no counter — not because they would be hard
-- to add, but because the moment a second column says *what* was opened, this
-- stops being "was here" and becomes surveillance of a ten-man dinner club.
--
-- **Why a table of its own rather than a column on `profiles`.** Two reasons,
-- and the first is the security one. `profiles` carries `role`, and its only
-- UPDATE policy is "Only admins can update profiles" — which is what stops a
-- member promoting himself, verified 2026-07-23 and the reason RLS could be
-- reproduced verbatim. Letting a member write his own `last_seen` there means
-- relaxing that policy, and any relaxation of an UPDATE policy on the table that
-- holds `role` is a write path to `role`. The second reason is that it would not
-- have worked anyway: `profiles` SELECT is `auth.uid() = id`, own-row-only *even
-- for admins*, so a timestamp stored there is a timestamp Lukas cannot read.
--
-- A separate table lets the write path be narrower than any policy could be, and
-- lets the read be widened for the one person who asked the question, without
-- either decision touching the table that governs privilege.

create table public.member_last_seen (
  -- Keyed by the account, not by member name. `auth.uid()` is the only identity
  -- the database can verify, and a name column would be a name a caller could
  -- supply — the whole trap this table is built to avoid. The member name is
  -- looked up through `user_member_mapping` at read time.
  --
  -- Two of the club's ten members have no login at all. They have no row here
  -- and never will, which is the honest answer: the site cannot observe someone
  -- who never opens it. Absence is a state the reader has to handle, not a zero.
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- The only fact stored. Overwritten on every visit, so the history of visits
  -- is unrecoverable by construction — that is the feature, not a shortcoming.
  last_seen_at timestamptz not null default now()
);

alter table public.member_last_seen enable row level security;

-- ------------------------------------------------------------------ reading
-- Your own row, always. You cannot be surprised by a record of your own visits.
create policy "Users can view their own last seen"
  on public.member_last_seen for select to authenticated
  using (auth.uid() = user_id);

-- And the admin sees everyone's, which is the entire point of writing it down.
-- Same shape as the 2026-07-26 deviation on `event_evaluations`: personal rows,
-- plus the one person who has to be able to look at them. Split into a second
-- policy rather than an OR so each half can be read, and removed, on its own.
create policy "Admins can view all last seen"
  on public.member_last_seen for select to authenticated
  using (get_user_role(auth.uid()) = 'admin'::user_role);

-- ------------------------------------------------------------------ writing
-- There is no INSERT, UPDATE or DELETE policy on this table, for anyone —
-- member, admin, or the treasurer. That is not an omission. RLS denies what it
-- does not permit, so with no write policy the only way a row can appear is the
-- function below, and there is nothing to widen later by accident.
--
-- The function takes no arguments. A member cannot name a row because there is
-- no parameter in which to name one, and it sets no column but the timestamp
-- because it mentions no other column. "A member can only write his own
-- timestamp" is therefore a property of the signature, not of a policy someone
-- has to keep correct.
--
-- SECURITY DEFINER for the same reason `get_user_role` is: it runs as the owner,
-- which is the table's owner, so RLS does not apply inside it.
create or replace function public.touch_last_seen()
  returns void
  language sql
  security definer
  set search_path to 'public'
as $$
  insert into public.member_last_seen (user_id, last_seen_at)
  -- `select … where` rather than `values`, so a caller with no session inserts
  -- nothing instead of failing a not-null constraint. Anon has no execute grant
  -- and cannot get here, but a function that writes must not depend on the grant
  -- being the only thing standing in front of it.
  select auth.uid(), now()
  where auth.uid() is not null
  on conflict (user_id) do update set last_seen_at = now();
$$;

-- Who may call it, stated rather than inherited — and `anon` is named on its own
-- line because leaving it out was a real bug, caught by running this against the
-- club's project rather than only against a local database.
--
-- `revoke … from public` is not enough. A hosted Supabase project carries a
-- default privilege that grants EXECUTE on every new function in this schema to
-- anon, authenticated and service_role, so anon arrives holding a grant of its
-- own that revoking from PUBLIC does not touch. A local stack built from these
-- migrations alone does not have it, which is exactly the shape of hole that
-- passes every test and is open in production.
--
-- The function is a no-op without a session — `where auth.uid() is not null` —
-- so an anon call writes nothing either way. That is the belt. This is the
-- braces, and it is the one that is legible: a signed-out visitor has no
-- business being able to call it at all.
revoke all on function public.touch_last_seen() from public;
revoke all on function public.touch_last_seen() from anon;
grant execute on function public.touch_last_seen() to authenticated;
