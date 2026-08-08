-- Sixteen months of visit history, recovered from the auth log.
--
-- Lukas, 2026-08-08: *"Kan det passe at der kun er data i denne uge? Kan vi tage
-- sidste uge med?"*
--
-- It could, and it was. Every row in `member_visits` was written today, because the
-- table was created today and seeded from `member_last_seen` — which holds one
-- timestamp per member and overwrites it on every visit. Eight of the nine seeded
-- rows were therefore today's date.
--
-- **And I told him that history was gone. That was wrong.** `20260808085000` says it
-- twice — *"the history it draws starts today"*, *"Nothing can recover what the old
-- design overwrote"* — and it is wrong for a reason worth writing down rather than
-- quietly fixing: I reasoned about the tables the app owns and stopped there.
-- `auth.audit_log_entries` is Supabase's own, it has been running since the project
-- was created on 2025-04-20, and it holds 532 entries across 11 accounts.
--
-- **What an entry actually proves, which is the whole question.** Three actions are
-- taken as "the member had the site open that day":
--
--   login            a person typed a password. Unambiguous.
--   logout           a person pressed sign out. Unambiguous.
--   token_refreshed  the Supabase client renewed a session token, which it only does
--                    while a page holding that client is running.
--
-- The third is the one carrying most of the weight (182 of the entries) and the one
-- with a soft edge: a tab left open overnight can refresh the next morning with
-- nobody looking at it. That would add a day the member did not choose to spend. It
-- is rare, it errs by at most a day per stale tab, and the alternative — dropping it
-- — throws away most of the recoverable history to avoid an occasional generous
-- reading. **Stated rather than hidden**, because the number this produces is about
-- to be shown to nine men next to each other's names.
--
-- `token_revoked` is deliberately excluded: it is emitted *alongside* a refresh, so
-- it would only ever confirm a day that is already counted.
--
-- One day per member per date, which is the rule the table already enforces and the
-- rule `touch_visit()` was written to keep. Copenhagen dates, matching
-- `current_date` on the database rather than UTC — a member on the site at 00:30 on a
-- Monday was there on the Monday.
--
-- **Recoverable exactly once, like the `member_last_seen` seed before it.** Supabase
-- prunes this log on its own schedule and nothing here can stop it. From here on the
-- record is `touch_visit()`'s, which is written on purpose and kept on purpose.

insert into public.member_visits (user_id, visited_on)
select (payload->>'actor_id')::uuid,
       (created_at at time zone 'Europe/Copenhagen')::date
  from auth.audit_log_entries
 where payload->>'action' in ('login', 'token_refreshed', 'logout')
   and payload->>'actor_id' is not null
   -- An actor that no longer has an account. `member_visits.user_id` is a foreign
   -- key to `auth.users`, so without this the whole insert fails on one deleted row
   -- rather than skipping it.
   and exists (select 1 from auth.users u where u.id = (payload->>'actor_id')::uuid)
 group by 1, 2
    on conflict (user_id, visited_on) do nothing;

do $$
declare
  total   int;
  people  int;
  oldest  date;
  lastwk  int;
begin
  select count(*), count(distinct user_id), min(visited_on)
    into total, people, oldest
    from public.member_visits;

  -- The specific thing he asked for, asserted rather than assumed. "Sidste uge" is
  -- the week before the current one; if this migration ran and that week is still
  -- empty, the recovery did not do what its own comment claims.
  lastwk := (select count(*) from public.member_visits
              where visited_on >= (date_trunc('week', current_date) - interval '7 days')::date
                and visited_on <  date_trunc('week', current_date)::date);

  raise notice 'visits_from_auth_log: % visit-days, % members, oldest %, % in the week before this one',
    total, people, oldest, lastwk;

  if oldest >= date_trunc('week', current_date)::date then
    raise exception 'visits_from_auth_log: still nothing before this week — the log was empty or the actions did not match';
  end if;
end $$;

comment on table public.member_visits is
  'One row per member per day he opened the site. Written by touch_visit(); seeded 2026-08-08 from member_last_seen and from auth.audit_log_entries back to 2025-04-20. Read by every member. Not a page log: no screen, no order, no duration.';
