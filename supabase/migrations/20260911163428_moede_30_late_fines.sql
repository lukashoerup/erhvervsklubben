-- Møde #30, 11 September 2026, lead Lukas: four late arrivals, fined under the regulativ.
--
-- Lukas, 2026-09-11, the evening of the meeting: *"Bøder til EK møde. Hvor jeg er
-- lead. I dag. Anders: 2 min · Esben: 5 min · Kasper: 12 min · Emil: 27 min"*
--
-- The regulation prices late arrival at **50 kr. + 5 kr. pr. minut** (docs/RULES.md,
-- `for-sent` in src/data/rules.ts), and the amounts below are that arithmetic and
-- nothing else — the same 50 + 5n that T075 used to corroborate fourteen historic
-- fines. The Lead is the one the regulativ makes responsible for noting fines, and
-- tonight the Lead is the one writing.
--
--   | Member | Minutes | kr. |
--   |---|---:|---:|
--   | Anders |  2 |  60 |
--   | Esben  |  5 |  75 |
--   | Kasper | 12 | 110 |
--   | Emil   | 27 | 185 |
--   |        |    | 430 |
--
-- **The evening did not exist yet.** The calendar held `Erhvervsklub #30` on
-- 2026-09-11 with an empty lead — the row the events_lead migration deliberately
-- left alone on 2026-08-08 because nothing then could say whether Lukas was the lead
-- or the venue was his house. He has now said the first half himself, so the record
-- is written with him as lead, dated today, numbered 30 (the club's numbering and
-- the database's have agreed since #27, and the calendar row carries the number),
-- and its venue carried over from the calendar row exactly as the app's own
-- "record this meeting" button would carry it. A fine needs a meeting to hang off.
--
-- **Attendance: only what the message proves.** A late arrival is an arrival, and a
-- lead was there, so five men get a row marked present. The other five are not
-- marked absent — the message says nothing about them, and an absence written on no
-- evidence would count against a man's §11 anciennitet, which the club has said is
-- the number it reckons by. Their rows are for Lukas to add on /anciennitet, where
-- the meeting editor inserts a row for any member it has none for. Recorded as an
-- open question in tasks/done/T092.
--
-- Guarded the way every data migration here is: the block returns, out loud, on a
-- database that is not the club's (no møde #29 on 2026-08-08, or not ten members).
-- Re-runnable: the record is matched on its date and number and never on a serial
-- id, every insert is `not exists`-guarded, and the read-back at the end refuses —
-- and rolls back — unless exactly these four fines, at these amounts, sit on the
-- evening. Two rows claiming the evening is an error, not a guess.

do $$
declare
  rec      int;
  n_rec    int;
  wrote_a  int;
  wrote_f  int;
  fines_n  int;
  fines_kr int;
  bad      int;
  all_n    int;
  all_kr   int;
  open_kr  int;
begin
  -- Not the club's database: the schema is in place, the club is not.
  if not exists (select 1 from public.attendance_records
                  where meeting_number = 29 and meeting_date = '2026-08-08')
     or (select count(*) from public.members) <> 10 then
    raise notice 'moede_30_late_fines: not the club''s database — nothing written';
    return;
  end if;

  -- ----------------------------------------------------------- the evening
  select count(*), min(id) into n_rec, rec
    from public.attendance_records
   where meeting_date = '2026-09-11' or meeting_number = 30;

  if n_rec > 1 then
    raise exception
      'moede_30_late_fines: % records claim 2026-09-11 or møde #30 — refusing to guess', n_rec;
  end if;

  if rec is null then
    insert into public.attendance_records (meeting_number, lead, meeting_date, main_location)
    values (
      30,
      'Lukas',
      '2026-09-11',
      -- What the calendar row says, as the app would copy it. Empty if it says nothing.
      coalesce((select nullif(btrim(location), '') from public.events
                 where title = 'Erhvervsklub #30' and date = '2026-09-11'
                 limit 1), '')
    )
    returning id into rec;
    raise notice 'moede_30_late_fines: møde #30 recorded as attendance_records %', rec;
  else
    raise notice 'moede_30_late_fines: møde #30 already recorded as attendance_records %', rec;
  end if;

  -- The calendar row learns its lead too, so the two tables agree. Matched on the
  -- empty lead, so a row Lukas has since corrected by hand is left as he left it.
  update public.events set lead = 'Lukas'
   where title = 'Erhvervsklub #30' and date = '2026-09-11' and lead = '';

  -- --------------------------------------------------- who was certainly there
  insert into public.attendances (record_id, member_name, attended)
  select rec, m.name, true
    from (values ('Lukas'), ('Anders'), ('Esben'), ('Kasper'), ('Emil')) as m(name)
   where not exists (select 1 from public.attendances a
                      where a.record_id = rec and a.member_name = m.name);
  get diagnostics wrote_a = row_count;

  -- ------------------------------------------------------------- the fines
  insert into public.fines (record_id, member_name, rule_id, minutes, amount_kr)
  select rec, l.name, 'for-sent', l.minutes, 50 + 5 * l.minutes
    from (values ('Anders', 2), ('Esben', 5), ('Kasper', 12), ('Emil', 27)) as l(name, minutes)
   where not exists (select 1 from public.fines f
                      where f.record_id = rec and f.member_name = l.name and f.rule_id = 'for-sent');
  get diagnostics wrote_f = row_count;

  -- ------------------------------------------------------------- read back
  select count(*), coalesce(sum(amount_kr), 0) into fines_n, fines_kr
    from public.fines where record_id = rec and rule_id = 'for-sent';

  -- Each of the four at exactly the regulativ's price for his minutes. A row that was
  -- already there with other minutes or another amount is a disagreement between the
  -- app and this file, and it is reported rather than papered over.
  select count(*) into bad
    from (values ('Anders', 2), ('Esben', 5), ('Kasper', 12), ('Emil', 27)) as l(name, minutes)
    left join public.fines f
      on f.record_id = rec and f.member_name = l.name and f.rule_id = 'for-sent'
   where f.id is null or f.minutes <> l.minutes or f.amount_kr <> 50 + 5 * l.minutes;

  if fines_n <> 4 or fines_kr <> 430 or bad <> 0 then
    raise exception
      'moede_30_late_fines: expected 4 late fines / 430 kr. on møde #30, read % / % kr. (% wrong)',
      fines_n, fines_kr, bad;
  end if;

  select count(*), sum(amount_kr), sum(amount_kr) filter (where settled_at is null)
    into all_n, all_kr, open_kr
    from public.fines;

  raise notice
    'moede_30_late_fines: % attendance row(s) and % fine(s) written; møde #30 holds 4 late fines / 430 kr.; fines now % rows / % kr., % kr. outstanding',
    wrote_a, wrote_f, all_n, all_kr, open_kr;
end $$;
