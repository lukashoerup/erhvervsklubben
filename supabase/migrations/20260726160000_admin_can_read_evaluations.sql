-- Admins can read all event evaluations.
--
-- The initial schema (verbatim from prod) gives event_evaluations three
-- policies, all scoped to the owner: select/insert/update where
-- auth.uid() = user_id. There is no admin policy, so the club admin could not
-- read the feedback members submit — it went into the table and nobody could
-- ever look at it. Lukas confirmed 2026-07-26 that this was an oversight, not a
-- decision.
--
-- Members still see only their own. Postgres OR-combines permissive policies
-- for the same command, so this widens SELECT for admins without touching what
-- a member can see, and leaves INSERT/UPDATE owner-only.
--
-- DELETE is deliberately still absent for everyone: no policy means no delete,
-- which is the existing behaviour and Lukas chose to keep it. Feedback is a
-- record, not something to tidy away.
create policy "Admins can view all evaluations"
  on public.event_evaluations for select
  using (get_user_role(auth.uid()) = 'admin'::user_role);
