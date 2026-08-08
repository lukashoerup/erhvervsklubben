-- Every member has a row for every meeting since he joined — present or absent.
--
-- Lukas, 2026-07-29: *"Der er noget galt med dem der ikke har deltaget i
-- frontenden. Der vises ikke dem som ikke har deltaget for mange af
-- arrangementerne."* Then, asked whether to fill the gaps: *"Marker de manglende
-- som fraværende. På tværs af alle møder. Det er det vi regner efter."*
--
-- **This is written down late, and that is the point of writing it.** The 26 rows
-- it describes were applied to production with direct SQL on 2026-07-29 and never
-- became a migration, which made it the one change to the club's data this month
-- that lived nowhere but in a chat window. Lukas, 2026-08-08: *"Det er meget
-- vigtigt at det som står i databasen er korrekt."* Correct is not enough on its
-- own — it has to be reproducible, or the next restore quietly loses it.
--
-- The filename carries the version Supabase actually recorded (20260808054642),
-- not the date the rows were written. Those are nine days apart and the version is
-- what decides whether this runs again.
--
-- **The rule, and why it is not "every member, every meeting".** A member cannot be
-- absent from a meeting held before he joined; recording him as absent there would
-- count against him in a §11 anciennitet the club never intended. So a row is
-- written only from each member's **first recorded meeting** onward:
--
--   | Member | First meeting | Meetings with no row |
--   |---|---|---|
--   | Kasper | 16 | 1–15 |
--   | Lukas  |  5 | 1–4  |
--   | the other eight | 1 | none |
--
-- Those two gaps are deliberate and were confirmed by Lukas at the time. Both are
-- corroborated by the club's own lead rotation, which is independent of the
-- attendance rows: the first cycle runs Rasmus, Emil, Mads, Anders, Saaby, Oskar,
-- Esben, Have, **Lukas** — nine leads, with Lukas last, which is where a member who
-- joined at meeting 5 lands.
--
-- Deriving the join point from the data rather than hardcoding two names keeps the
-- migration honest on a database that is not this club's: with no rows there is no
-- member, and nothing is written.
--
-- Idempotent: it only ever inserts where no row exists, so re-running it is a
-- no-op. It was a no-op the first time it ran, too — the rows were already there.

do $$
declare
  wrote    int;
  rows_now int;
  here_now int;
  club     boolean;
begin
  with joined as (
    -- Each member's first meeting, by the club's own numbering. `min` over the
    -- meeting number and not over the date: eleven meetings have no date.
    select a.member_name, min(r.meeting_number) as from_meeting
    from public.attendances a
    join public.attendance_records r on r.id = a.record_id
    group by a.member_name
  )
  insert into public.attendances (record_id, member_name, attended)
  select r.id, j.member_name, false
  from public.attendance_records r
  join joined j on r.meeting_number >= j.from_meeting
  where not exists (
    select 1 from public.attendances x
     where x.record_id = r.id and x.member_name = j.member_name
  );

  get diagnostics wrote = row_count;

  rows_now := (select count(*) from public.attendances);
  here_now := (select count(*) from public.attendances where attended is true);

  -- The club's own database, by the counts verified on 2026-07-30. Only there is
  -- the expected result known, so only there is it asserted — and the assertion is
  -- on the *attendance*, not on the row count, because those are the two numbers a
  -- reader confuses. 261 rows, of which 190 are someone actually turning up.
  club := (select count(*) = 28 from public.attendance_records)
      and (select count(*) = 10 from public.members);

  if club and (rows_now <> 261 or here_now <> 190) then
    raise exception
      'absences_recorded: expected 261 rows / 190 attendances, got % / %', rows_now, here_now;
  end if;

  raise notice 'absences_recorded: % row(s) written, % total, % present', wrote, rows_now, here_now;
end $$;
