-- A comment is written once. Nobody edits one — not its author, not the board.
--
-- Lukas, 2026-08-08, on the version built an hour earlier: *"Admins må slette
-- kommentarer. Men man behøver ikke at kunne rette i egne kommentarer."*
--
-- The first half confirms what `20260808150000` already does. The second half
-- removes a capability, and removing it is worth more than leaving it in unused.
--
-- **What it costs to keep:** an UPDATE policy is a way in. It carried a `with check`
-- so a member could not reassign a comment to somebody else, and a trigger to stop
-- him rewriting `created_at`, `author_id` and `updated_at` — three guards that exist
-- *only* because the door was open. Closing the door retires all three. The screen
-- loses a "Ret" button and a state; the table loses a column that could only ever
-- have said "redigeret".
--
-- **What it costs to remove:** a member who mistypes must delete and write again,
-- which is one more tap and puts his comment at the bottom of the thread. In a club
-- of ten talking under a handful of notices a year, that is not a real loss — and it
-- is honest in a way editing is not: nothing under anyone's name has ever silently
-- become different words.
--
-- Safe to drop the column rather than leave it: the table shipped this afternoon and
-- has never held a row. Checked before writing this, not assumed. If the club later
-- wants editing back, the column returns with the feature that needs it.

drop policy if exists "Members edit only their own comments" on public.news_comments;

drop trigger if exists news_comments_touch on public.news_comments;
drop function if exists public.news_comments_touch();

alter table public.news_comments drop column if exists updated_at;

comment on table public.news_comments is
  'A member''s comment on a published news item. Read by signed-in members only — never anon, unlike the news itself. Written once: no UPDATE policy exists, for anyone. Deleted by its author or an admin.';

do $$
declare
  updates int;
  total   int;
begin
  -- The assertion this migration is *for*. A future policy named for UPDATE on this
  -- table would restore the whole apparatus above without anyone deciding to.
  updates := (select count(*) from pg_policies
               where schemaname = 'public' and tablename = 'news_comments' and cmd = 'UPDATE');
  total   := (select count(*) from pg_policies
               where schemaname = 'public' and tablename = 'news_comments');

  if updates <> 0 or total <> 3 then
    raise exception 'news_comments_no_edit: expected 3 policies and 0 for UPDATE, got % / %',
      total, updates;
  end if;
  raise notice 'news_comments_no_edit: write-once, 3 policies (select, insert, delete)';
end $$;
