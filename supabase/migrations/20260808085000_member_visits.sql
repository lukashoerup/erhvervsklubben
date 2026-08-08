-- The club starts keeping a history of its visits, one row per member per day.
--
-- Lukas, 2026-08-08: *"Gerne login aktivitet inkl. hvor mange gange folk har været
-- inde og hvornår. En graf."*
--
-- **Today the app cannot answer that, and not by accident.** T074 built
-- `member_last_seen` as one timestamp per member, overwritten on every visit, and
-- said so in its own note: *"the count of visits is unrecoverable by construction."*
-- That was the smallest thing that answered the question he asked then. The question
-- he is asking now needs a record where there is none, so this is a new table rather
-- than a column — and the history it draws **starts today**. Nothing can recover what
-- the old design overwrote.
--
-- **One row per day, not one per page load**, and that is a judgement worth stating
-- because it decides what "hvor mange gange" means. A member who reloads three times
-- over lunch has been in once that day, and counting loads would reward refreshing
-- and turn a fact about attendance-to-the-site into a fact about browser habits. So
-- the count is *days he has been in*, which is the number a reader would assume
-- anyway. `unique (user_id, visited_on)` is what enforces it — the dedupe is the
-- schema, not the client, so a second tab cannot double-count.
--
-- **This is still not page tracking.** A row says a member opened the site on a day.
-- It does not say which screen, in what order, or for how long — the same line T074
-- drew, and adding any of that remains a different feature and a different decision.
--
-- The privacy note from T074 applies more here than there, and applies to Lukas's
-- own decision rather than against it: a per-day log of nine men, readable by all
-- nine, is a heavier object than a single "last seen" date. He has asked for it
-- twice, in writing, on his own list. It is his club and his call; this records that
-- it was made and what it costs.

create table if not exists public.member_visits (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- A date, not a timestamp. Storing the exact moment would make the unique
  -- constraint useless and quietly recreate the per-load log this deliberately is
  -- not — the column's type is what keeps the promise.
  visited_on  date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, visited_on)
);

comment on table public.member_visits is
  'One row per member per day he opened the site. Written only by touch_visit(); read by every member since 2026-08-08. Not a page log: no screen, no order, no duration.';

create index if not exists member_visits_visited_on_idx
  on public.member_visits (visited_on);

alter table public.member_visits enable row level security;

-- Read by the whole club, exactly as "sidst set" became earlier today. `to
-- authenticated`, so this is published to the members and not to the internet.
create policy "Members read visits"
  on public.member_visits for select to authenticated using (true);

-- **No write policy, for anyone, the admin included.** The same shape as
-- `member_last_seen`, and for the same reason: the only way a row can appear is the
-- function below, which takes no arguments and can only ever name `auth.uid()`. A
-- member cannot forge a visit for himself or anyone else, because there is no
-- statement he could write that the policies would permit.

create or replace function public.touch_visit()
  returns void
  language sql
  security definer
  set search_path to 'public'
as $function$
  insert into public.member_visits (user_id, visited_on)
  select auth.uid(), current_date
  where auth.uid() is not null
  on conflict (user_id, visited_on) do nothing;
$function$;

-- Supabase grants EXECUTE on every new function to `anon` by default, which would
-- let a signed-out visitor call this. It would insert nothing — `auth.uid()` is null
-- — but an endpoint that exists and does nothing is one a future change can make do
-- something. Revoked explicitly, the same lesson as `touch_last_seen` (T074), where
-- the function was open for four minutes before anyone noticed.
revoke execute on function public.touch_visit() from anon, public;
grant execute on function public.touch_visit() to authenticated;

-- Today counts. Every member with a `member_last_seen` row was here at some point,
-- and for the nine who have opened the site the most recent of those visits is the
-- only one the old design kept. Seeding it as a visit on its own date is the one
-- piece of history that is recoverable, and it is recoverable exactly once.
insert into public.member_visits (user_id, visited_on)
select user_id, (last_seen_at at time zone 'Europe/Copenhagen')::date
from public.member_last_seen
on conflict (user_id, visited_on) do nothing;
