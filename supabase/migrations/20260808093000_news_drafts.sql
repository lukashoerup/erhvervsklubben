-- Anyone may write a news item; only the board publishes it.
--
-- Lukas's own wishlist, photographed 2026-08-08: *"alle kan skrive nyheder, men skal
-- godkendes af bestyrelsen."* Then: *"Start med nyheder tilføjelse og godkendelse."*
--
-- **"Bestyrelsen" is the admins — Lukas, Anders and Rasmus — and that is a choice, so
-- here is the reasoning.** The app has exactly two roles and no board. Inventing a
-- third role would be a bigger change than the feature, and it would have to be
-- populated from a decision nobody has made; the three admins are already the men who
-- write the club's news today, so approval landing with them changes who may *write*
-- and not who may *publish*. If the club later wants the formand in that set — Saaby
-- is not an admin — the fix is one row in `profiles`, not a schema change. **The
-- mechanism does not care who is in the set.**
--
-- Four columns and a rewritten policy set. The property the whole thing hangs on:
-- **a member can create and edit a draft, and there is no statement he can write that
-- makes it published.** That is not a convention in the app — it is `with check` on
-- both INSERT and UPDATE, so it holds against anything that reaches the API.

alter table public.news
  add column if not exists status text not null default 'godkendt',
  add column if not exists author_id uuid references auth.users (id) on delete set null,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists approved_at timestamptz;

-- 'godkendt' is the default, which is what keeps the club's three existing items
-- published and what makes an admin's insert behave exactly as it did yesterday.
-- A member's insert is forced to 'kladde' by policy, not by the default.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'news_status_check') then
    alter table public.news
      add constraint news_status_check check (status in ('kladde', 'godkendt'));
  end if;
end $$;

comment on column public.news.status is
  'kladde = written, awaiting the board. godkendt = published, visible to the public.';
comment on column public.news.author_id is
  'Who wrote it. Null on the three items that predate 2026-08-08. `author` stays the displayed name and is free text.';

-- Drafts are never many and are always the newest rows.
create index if not exists news_status_idx on public.news (status);

-- ------------------------------------------------------------------ the policies
--
-- Rewritten rather than added to. The old set was "everyone reads, admins write",
-- and both halves change: the public must not see a draft, and a member must be able
-- to make one.

drop policy if exists "Enable read access for all users" on public.news;
drop policy if exists "Enable insert for admin users only" on public.news;
drop policy if exists "Enable update for admin users only" on public.news;
drop policy if exists "Enable delete for admin users only" on public.news;

-- The public sees published items and nothing else. This is the one that would be a
-- leak if it were wrong: `news` is anon-readable by the club's own 2026-07-23
-- decision, so a draft in this table is a draft on the internet unless the policy
-- says otherwise.
create policy "Anyone reads published news"
  on public.news for select to anon
  using (status = 'godkendt');

-- A member sees what is published, plus his own drafts. An admin sees everything,
-- which is what makes an approval queue possible at all.
create policy "Members read published news and their own drafts"
  on public.news for select to authenticated
  using (
    status = 'godkendt'
    or author_id = auth.uid()
    or public.get_user_role(auth.uid()) = 'admin'
  );

-- **The load-bearing one.** A member may write a row only if it is his and only if it
-- is a draft; an admin may write anything. There is no third case, so there is no
-- statement a member could send that publishes anything.
create policy "Members write their own drafts"
  on public.news for insert to authenticated
  with check (
    public.get_user_role(auth.uid()) = 'admin'
    or (author_id = auth.uid() and status = 'kladde')
  );

-- Same rule on both sides of the update. `using` decides which rows he may touch and
-- `with check` decides what he may leave behind: without the second, a member could
-- select his own draft and set it to 'godkendt', which is the whole feature defeated
-- in one statement.
create policy "Members edit their own drafts, admins edit anything"
  on public.news for update to authenticated
  using (
    public.get_user_role(auth.uid()) = 'admin'
    or (author_id = auth.uid() and status = 'kladde')
  )
  with check (
    public.get_user_role(auth.uid()) = 'admin'
    or (author_id = auth.uid() and status = 'kladde')
  );

create policy "Members withdraw their own drafts, admins delete anything"
  on public.news for delete to authenticated
  using (
    public.get_user_role(auth.uid()) = 'admin'
    or (author_id = auth.uid() and status = 'kladde')
  );

do $$
declare
  published int;
  drafts    int;
begin
  published := (select count(*) from public.news where status = 'godkendt');
  drafts    := (select count(*) from public.news where status = 'kladde');

  -- Nothing the club had written may have become a draft by this running: an item
  -- silently unpublished is the failure mode nobody would notice until a member
  -- asked where the news went.
  if drafts <> 0 then
    raise exception 'news_drafts: % existing item(s) ended up as drafts', drafts;
  end if;
  raise notice 'news_drafts: % published item(s), 0 drafts', published;
end $$;
