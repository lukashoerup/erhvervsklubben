-- "Sidst set" becomes the club's, not the treasurer's.
--
-- Lukas's own wishlist, photographed 2026-08-08: *"Offentliggøre login aktivitet."*
-- Then: *"Kan vi tage det næste punkt på listen?"*
--
-- **This reverses a deliberate decision, which is why it is a migration with an
-- argument rather than a one-line policy.** T074 built `member_last_seen` folded shut
-- and admin-only, and said why: *"in a club of ten where everyone knows everyone, a
-- permanent list of who has not been around is a different social object from a fact
-- you can go and look up."* That reasoning has not become wrong — Lukas has simply
-- decided the club can carry it, the same way he opened the finances on 2026-07-30.
-- It is his to decide, and this records that he did.
--
-- **Two tables, not one, and the second is the non-obvious half.** The screen shows
-- *names*, and the names live in `user_member_mapping` — own-row-only until now. Open
-- only `member_last_seen` and every member sees nine timestamps he cannot attach to
-- anyone, which is a worse object than either the closed version or the open one.
--
-- What that costs: any member can now see which account belongs to which name. In a
-- club whose every meeting card already lists all ten by name, that is not a
-- disclosure — the uuid was never the secret. **`profiles` is untouched and stays
-- own-row-only**, which is the table that actually matters: it holds `role`, and it
-- is the reason a member cannot make himself an admin.
--
-- **The write side does not move.** `member_last_seen` still has no write policy for
-- anyone, the admin included; the only way a row appears is `touch_last_seen()`,
-- which takes no arguments and sets nothing but `auth.uid()`'s own timestamp. Opening
-- a read has not opened a write, and the tests assert that separately.

-- Every signed-in member, which is what "offentliggøre" means here — the club, not
-- the public. `member_last_seen` is not in any anon-readable set and does not join
-- one.
create policy "Members read last seen"
  on public.member_last_seen for select to authenticated using (true);

create policy "Members read the member mapping"
  on public.user_member_mapping for select to authenticated using (true);

-- The two SELECT policies these subsume, dropped rather than left standing. Postgres
-- ORs permissive policies, so an own-row rule beside an everyone rule grants exactly
-- nothing extra — it only tells the next reader that access is narrower than it is.
-- A stale licence is worse than none.
drop policy if exists "Users can view their own last seen" on public.member_last_seen;
drop policy if exists "Admins can view all last seen" on public.member_last_seen;
drop policy if exists "Users can view their own mapping" on public.user_member_mapping;

-- `Admins can manage all mappings` stays: it is the write side, and it is the only
-- one there is.

do $$
declare
  reads int;
  writes int;
begin
  reads := (select count(*) from pg_policies
             where schemaname = 'public'
               and tablename in ('member_last_seen', 'user_member_mapping')
               and cmd = 'SELECT');
  -- Nothing may write `member_last_seen` through the API. This is the assertion
  -- worth having: the feature was "publish the reads", and a write policy appearing
  -- here would mean a member could forge when he was last seen.
  writes := (select count(*) from pg_policies
              where schemaname = 'public' and tablename = 'member_last_seen'
                and cmd <> 'SELECT');

  if reads <> 2 or writes <> 0 then
    raise exception
      'last_seen_is_the_clubs: expected 2 read policies and 0 writes, got % / %', reads, writes;
  end if;
end $$;
