-- Members comment on the club's news.
--
-- Lukas's wishlist, photographed 2026-08-08: *"Kan kommenterer på nyheder."* Then:
-- *"Næste er at man skal lave kommentarer. Det skal vi bygge nu."*
--
-- **This is the first table in the app a member writes for other members to read.**
-- Every policy until now has been some arrangement of "members read, admins write" —
-- even the news drafts added this morning, where a member writes only rows nobody
-- else can see until the board publishes them. A comment is visible to the club the
-- moment it is saved. So the questions this raises are new, and each is answered
-- below rather than left to whoever reads the table next.
--
-- **Who may read: signed-in members, and nobody else.** `news` is anon-readable by
-- the club's own 2026-07-23 decision — the landing page shows it to the internet —
-- and the comments deliberately do not inherit that. A notice the club publishes and
-- a conversation the club has among itself are different objects, and only the first
-- was ever put on the open web. There is no `to anon` policy here at all.
--
-- **Only on published news.** A draft is visible to its author and the board; letting
-- them comment there would mean an editorial conversation that becomes visible to
-- all nine members the moment the item is approved. Nobody would expect that, and
-- nothing warns them. Drafts get no comment thread.
--
-- **A member may edit his own comment, and an admin may not.** This is the one that
-- is worth stating as a choice rather than as an omission. Deleting somebody's
-- comment removes it and everyone can see that it is gone; *editing* it leaves his
-- name attached to words he did not write, and there is no version history in this
-- app that would show it. So the board can moderate — DELETE, below, is theirs — and
-- rewriting another member's words is not a power anybody has.

create table if not exists public.news_comments (
  id         uuid primary key default gen_random_uuid(),
  -- Cascade: a deleted news item takes its thread with it. The alternative is
  -- comments pointing at nothing, which the read policy would hide anyway — an
  -- invisible row nobody can reach is worse than no row.
  news_id    uuid not null references public.news (id) on delete cascade,
  author_id  uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Trimmed length, so a comment of five spaces is refused by the database and not
  -- only by the form. 2000 is generous for a club of ten and is here to bound what
  -- one member can put on another's screen, not to shape how anyone writes.
  constraint news_comments_body_check check (length(btrim(body)) between 1 and 2000)
);

comment on table public.news_comments is
  'A member''s comment on a published news item. Read by signed-in members only — never anon, unlike the news itself. Edited by its author alone; deleted by its author or an admin.';

-- The only way this is ever read: one thread, oldest first.
create index if not exists news_comments_thread_idx
  on public.news_comments (news_id, created_at);

-- **The three columns a client must not be able to restate.** `updated_at` is what
-- the screen prints "redigeret" from, `created_at` is what the thread is ordered by,
-- and `author_id` is whose name appears. All three are writable by whoever may
-- UPDATE the row, and a policy cannot express "this column may not change" — so the
-- trigger puts them back. Without it "redigeret" is a claim the client makes about
-- itself, which is not worth showing.
create or replace function public.news_comments_touch()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  new.author_id  := old.author_id;
  return new;
end;
$function$;

drop trigger if exists news_comments_touch on public.news_comments;
create trigger news_comments_touch
  before update on public.news_comments
  for each row execute function public.news_comments_touch();

alter table public.news_comments enable row level security;

-- Signed-in members, on published items. The `exists` runs against `news`, which has
-- its own RLS — so this is the *intersection* of "the item is published" and "this
-- member may see the item", and a change to either one cannot silently widen the
-- other. No recursion: nothing in `news`'s policies looks at this table.
create policy "Members read comments on published news"
  on public.news_comments for select to authenticated
  using (
    exists (select 1 from public.news n where n.id = news_id and n.status = 'godkendt')
  );

-- His own name on it, and only under a published item. Both halves are `with check`
-- rather than client convention: there is no request a member could send that files
-- a comment under somebody else's name.
create policy "Members write their own comments"
  on public.news_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.news n where n.id = news_id and n.status = 'godkendt')
  );

-- **No admin branch, deliberately** — see the header. `using` decides which rows he
-- may touch, `with check` what he may leave behind; without the second a member
-- could reassign his own comment to another account on the way out.
create policy "Members edit only their own comments"
  on public.news_comments for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Moderation lives here and only here. An admin removing a comment is visible as an
-- absence; an admin rewriting one would not be.
create policy "Members withdraw their own, the board removes any"
  on public.news_comments for delete to authenticated
  using (author_id = auth.uid() or public.get_user_role(auth.uid()) = 'admin');

do $$
declare
  reads int;
  anon_policies int;
begin
  reads := (select count(*) from pg_policies
             where schemaname = 'public' and tablename = 'news_comments');
  -- The assertion worth having. `news` is anon-readable, and a policy on this table
  -- naming `anon` would put the club's private conversation on the open web under a
  -- page that is already public.
  anon_policies := (select count(*) from pg_policies
                     where schemaname = 'public' and tablename = 'news_comments'
                       and 'anon' = any(roles));

  if reads <> 4 or anon_policies <> 0 then
    raise exception 'news_comments: expected 4 policies and 0 naming anon, got % / %',
      reads, anon_policies;
  end if;
  raise notice 'news_comments: ready, 4 policies, none for anon';
end $$;
