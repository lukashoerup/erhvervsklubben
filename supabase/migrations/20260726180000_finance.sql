-- The club's finances (T050).
--
-- Two tables, and the split between them is the whole design:
--
--   fines   — what the Lead observed. Recorded by a human, because four of the
--             five rules are things only someone at the table can see (what a
--             member ordered, whether they toasted early, how many minutes late
--             they were). See docs/RULES.md.
--   payments— money that actually arrived. Nothing can derive this; the
--             treasurer confirms it against the bank quarterly, which is the
--             club's own rhythm (Bødekasseregulativ Stk. 3), not a new process.
--
-- Everything else — monthly dues, running balances, quarterly totals, who owes
-- what — is arithmetic over these two plus the member roster, and is computed
-- rather than stored. Storing a derived total is how the old sheet came to
-- disagree with itself by 50 kr.

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  record_id integer not null references public.attendance_records (id) on delete cascade,
  member_name text not null,
  -- Matches an id in src/data/rules.ts. Text rather than an enum so the club
  -- can vote in a new rule without a schema migration; the app validates it.
  rule_id text not null,
  -- Only meaningful for 'for-sent', which is 50 kr + 5 kr per minute.
  minutes integer not null default 0 check (minutes >= 0),
  -- The amount as charged, in kroner. Denormalised on purpose: if the club
  -- later votes to change a fine, history must still show what was actually
  -- owed at the time rather than silently re-pricing the past.
  amount_kr integer not null check (amount_kr > 0),
  noted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),

  -- Bødekasseregulativ: "Et medlem kan ikke pålægges mere end én bøde pr.
  -- forseelse pr. møde." Enforced here as well as in the app, because a rule
  -- the database does not know is a rule that eventually gets broken.
  unique (record_id, member_name, rule_id)
);

create index fines_record_idx on public.fines (record_id);
create index fines_member_idx on public.fines (member_name);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- The month this settles, as the first of that month.
  month date not null,
  amount_kr integer not null,
  -- What the treasurer saw in the bank when confirming, if they checked.
  bank_balance_kr integer,
  note text,
  confirmed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (month)
);

alter table public.fines enable row level security;
alter table public.payments enable row level security;

-- Admin only, reads included. Lukas, 2026-07-26: "Not everyone should know how
-- much money is in the bank account." This is the single place the club's
-- otherwise-open read rule does not apply, which is why it is stated once here
-- and mirrored in tests/rls/rules.ts as ADMIN_ONLY_TABLES.
--
-- Note this is stricter than hiding a page: a member querying the table
-- directly from the browser console gets nothing.
create policy "Admins manage fines"
  on public.fines for all to authenticated
  using (get_user_role(auth.uid()) = 'admin'::user_role)
  with check (get_user_role(auth.uid()) = 'admin'::user_role);

create policy "Admins manage payments"
  on public.payments for all to authenticated
  using (get_user_role(auth.uid()) = 'admin'::user_role)
  with check (get_user_role(auth.uid()) = 'admin'::user_role);
