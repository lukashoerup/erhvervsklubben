-- Who the club's members are, and what each of them owes (T069).
--
-- Until now there was no members table at all. The roster was `select distinct
-- member_name from attendances` — free text, and therefore "member" meant "has
-- turned up at least once". Two things followed, and the second cost money:
--
--   * §3's active/inactive distinction existed only in the members' heads. The
--     statutes are explicit that active members pay kontingent and hold voting
--     rights while inactive members are on pause, pay nothing and may not
--     attend; the app could not tell them apart.
--   * The finance page charged kontingent to the whole roster, so the expected
--     income line every member now sees has always been too high.
--
-- Additive, and deliberately keyed by the name `attendances` already carries.
-- No foreign key, no rewrite of `attendances.member_name`, not a row of the 235
-- attendances, 28 meetings, 17 fines or 13 payments touched. Migrating the
-- whole schema to member ids is a bigger job with a bigger blast radius, and it
-- is not what was needed to stop over-charging.

create table public.members (
  -- A surrogate key, though `name` is the natural one. Every other table here
  -- has an `id`, the RLS suite addresses rows by it, and a primary key made of
  -- a person's display name is a key that changes when somebody is renamed.
  id uuid primary key default gen_random_uuid(),

  -- The join to fifteen years of history is this string and nothing else, so it
  -- must match `attendances.member_name` exactly. Unique, because two member
  -- rows for one name is two different answers to "does he pay".
  name text not null unique,

  -- §3 and §12. Text with a check rather than an enum: adding a value to a
  -- Postgres enum is a migration that cannot run in a transaction, and the club
  -- will eventually vote in `alumne` (§4 Stk. 5 A). Deliberately not offered
  -- yet — the club has never had an inactive member, let alone one inactive for
  -- the two years that clause requires. See src/data/members.ts.
  --
  --   aktiv           betaler kontingent, har stemmeret
  --   inaktiv         på pause: betaler ikke, deltager ikke
  --   founding-father deltager, men betaler hverken kontingent eller bøder og
  --                   stemmer ikke om brug af klubbens midler (§12)
  status text not null default 'aktiv'
    check (status in ('aktiv', 'inaktiv', 'founding-father')),

  -- Why this member is not simply active, in the club's own words. Null for the
  -- ordinary case. A status is a category; this is the sentence a treasurer
  -- reads two years from now when he wonders why one member has never paid.
  note text,

  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

-- Members read, admins write — the club's shared data, the same rule as
-- `attendance_records` and `attendances`, and mirrored in tests/rls/rules.ts as
-- a SHARED_TABLE. Not admin-only: who is a member and who is on pause is not a
-- bank balance, it is the club's own composition, and §8 puts the accounts in
-- front of the whole membership once a year anyway.
create policy "Allow authenticated users to view members"
  on public.members for select to authenticated using (true);
create policy "Allow admin users to manage members"
  on public.members for all to authenticated
  using (get_user_role(auth.uid()) = 'admin'::user_role)
  with check (get_user_role(auth.uid()) = 'admin'::user_role);

-- ---------------------------------------------------------------------------
-- The club's ten members, as of 2026-07-29
-- ---------------------------------------------------------------------------
-- Guarded by an existence check on `attendances`, for the reason the finance
-- import was fixed for this morning: a migration runs on every database, not
-- only the one it was written against. A local stack and the CI runner hold
-- `seed.sql`'s synthetic Alice/Bob/Chris/Dana, and inserting ten strangers
-- there would put ten members with no attendance on every developer's
-- /anciennitet — a roster of fourteen for a club of four. On a database that is
-- not this club's, the right answer is to create the table and no rows.
--
-- The names are the ten in `attendances` today, so the check both guards and
-- documents: a name here that never appears in the history is a typo, and it
-- silently inserts nothing rather than creating a member nobody can explain.
insert into public.members (name, status, note)
select v.name, v.status, v.note
from (values
  ('Anders', 'aktiv',           null::text),
  ('Rasmus', 'aktiv',           null::text),
  ('Esben',  'aktiv',           null::text),
  ('Emil',   'aktiv',           null::text),
  ('Saaby',  'aktiv',           null::text),
  ('Lukas',  'aktiv',           null::text),
  ('Mads',   'aktiv',           null::text),
  ('Kasper', 'aktiv',           null::text),
  ('Have',   'aktiv',           null::text),
  -- Lukas, 2026-07-29. Not "inactive": §3 says an inactive member may not
  -- attend, and Oskar attends — 22 of the club's meetings, more than half the
  -- roster. §11 earns anciennitet by attendance alone, so his stays exactly as
  -- it is; what he is exempt from is money and the vote that spends it.
  ('Oskar',  'founding-father',
   'Founding father. Betaler ikke kontingent, pålægges ikke bøder og stemmer ikke om brug af klubbens midler (§12). Besluttet af Lukas 2026-07-29.')
) as v (name, status, note)
where exists (
  select 1 from public.attendances a where a.member_name = v.name
)
on conflict (name) do nothing;
