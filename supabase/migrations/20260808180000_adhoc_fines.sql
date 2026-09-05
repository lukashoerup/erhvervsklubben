-- Ad-hoc fines: a bet made up on the night, recorded with the reason attached.
--
-- Lukas, 2026-08-08, from the bowling alley: *"Vi skal have en ad hoc bøde kategori.
-- Så nar vi finder på væddemål hvor vi giver bøder af hov, så skal vi kunne det. Når
-- jeg skriver til dig. Som i dag."*
--
-- The category itself already exists — `aftalt`, added hours earlier for Esben's
-- bowling defeat. **Tonight proved it unusable twice**, and both failures are fixed
-- here rather than worked around:
--
-- 1. **It could only be used once per man per meeting.** Esben lost round one and
--    round two; the second insert was refused by
--    `fines_record_id_member_name_rule_id_key`, and the money was summed into a
--    single 150 kr row to get it recorded at all. That constraint is the club's own
--    regulativ — *"Et medlem kan ikke pålægges mere end én bøde pr. forseelse pr.
--    møde"* — and for the five voted rules it is a real protection: it stops a man
--    being charged twice for one late arrival. But `aftalt` is not a forseelse. It is
--    a bucket for whatever the club agreed, and two different bets on one evening are
--    two different things. The constraint was being applied at the wrong granularity.
--
-- 2. **There was nowhere to say what the bet was.** `fines` holds an amount, a man, a
--    meeting and a rule id — and for the five voted rules the id *is* the reason. For
--    an ad-hoc fine it says only "the club agreed something", which in six months is
--    exactly the `historisk` problem the club has already spent a migration cleaning
--    up: an amount against a name with no offence anyone can recall.
--
-- So: a note column, the uniqueness relaxed for `aftalt` alone, and — the part worth
-- arguing for — **an ad-hoc fine without a reason is refused by the database.** The
-- whole point of this category is that the reason lives nowhere else.
--
-- **Guarded on 2026-09-05, after a month of red CI.** The rows below name
-- `attendance_records` id 30 — the bowling evening — and a fresh database has no
-- such row, so `supabase start` died on the foreign key (SQLSTATE 23503) on every
-- CI run from 2026-08-08 15:52 onward. Production ran it fine because the row was
-- there. The three data statements and the assertion now do what every other data
-- migration in this directory does: nothing, out loud, when the club's own rows are
-- absent. The column, the index and the check constraint are applied everywhere.

alter table public.fines add column if not exists note text;

comment on column public.fines.note is
  'Why, in the club''s own words. Required on `aftalt`, where the rule id says nothing; optional elsewhere, where the rule id is the reason.';

-- ------------------------------------------------------------- the uniqueness
--
-- Dropped and replaced by a partial index rather than removed. The regulativ's rule
-- still holds for every rule the club actually voted, which is where it protects
-- somebody; it stops applying only to the bucket that was never a single offence.
alter table public.fines
  drop constraint if exists fines_record_id_member_name_rule_id_key;

create unique index if not exists fines_one_per_offence
  on public.fines (record_id, member_name, rule_id)
  where rule_id <> 'aftalt';

-- ------------------------------------------------------------- tonight's rows
--
-- Written before the check below, or the check would refuse the rows it is meant to
-- protect. Order matters here and nowhere else in this file.
update public.fines set note = 'Tabte 2. runde i bowling mod det andet hold'
 where record_id = 30 and rule_id = 'aftalt' and member_name in ('Lukas', 'Saaby', 'Kasper')
   and exists (select 1 from public.attendance_records where id = 30);

-- Esben's 150 kr goes back to being the two fines it always was. The sum was a
-- workaround for the constraint above, recorded openly at the time as one; with the
-- constraint corrected there is no reason to keep the club's books saying one thing
-- happened where two did.
update public.fines set amount_kr = 50, note = 'Tabte 2. runde i bowling mod det andet hold'
 where record_id = 30 and rule_id = 'aftalt' and member_name = 'Esben'
   and exists (select 1 from public.attendance_records where id = 30);

-- The exists-guard is what a fresh stack needs: without it this insert is the
-- statement that broke CI, because the fine's meeting is a production row.
insert into public.fines (record_id, member_name, rule_id, amount_kr, minutes, note)
select 30, 'Esben', 'aftalt', 100, 0, 'Tabte 1. runde i bowling'
where exists (select 1 from public.attendance_records where id = 30)
  and not exists (
  select 1 from public.fines
   where record_id = 30 and member_name = 'Esben' and rule_id = 'aftalt' and amount_kr = 100
);

-- ------------------------------------------------------------------ the guard
--
-- **The assertion this whole migration exists for.** An ad-hoc fine whose reason was
-- never written down is an amount against a man's name that nobody can explain, and
-- the club has been there: eighteen rows came out of the old spreadsheet that way and
-- it took until T075 to name them. This is that mistake made impossible instead of
-- discouraged. The five voted rules are untouched — their id is their reason.
alter table public.fines drop constraint if exists fines_aftalt_needs_note;
alter table public.fines add constraint fines_aftalt_needs_note
  check (rule_id <> 'aftalt' or length(btrim(coalesce(note, ''))) > 0);

do $$
declare
  adhoc   int;
  unnamed int;
  esben   int;
begin
  -- Not this club's fine book: the schema is in place, the evening is not.
  if not exists (select 1 from public.attendance_records where id = 30) then
    raise notice 'adhoc_fines: no meeting record 30 here — note, index and check added, no rows written';
    return;
  end if;

  select count(*), count(*) filter (where coalesce(btrim(note), '') = '')
    into adhoc, unnamed
    from public.fines where rule_id = 'aftalt';
  esben := (select count(*) from public.fines
             where record_id = 30 and member_name = 'Esben' and rule_id = 'aftalt');

  if unnamed <> 0 then
    raise exception 'adhoc_fines: % ad-hoc fine(s) with no reason', unnamed;
  end if;
  if esben <> 2 then
    raise exception 'adhoc_fines: Esben should hold 2 ad-hoc fines at meeting 29, holds %', esben;
  end if;
  raise notice 'adhoc_fines: % ad-hoc fine(s), all with a reason; Esben split back into 2', adhoc;
end $$;
