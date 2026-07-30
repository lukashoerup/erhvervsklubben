-- A meeting record carries its own description, and the calendar's descriptions
-- move onto the eight meetings they belong to.
--
-- Lukas, 2026-07-30: "nogle af de beskrivelser der har været inde i møderne må
-- gerne komme med, samt der skal være mulighed for at lave en kort beskrivelse i
-- ancinitetssiden. Man skal også gerne kunne klikke sig ind på et møde på
-- ancinitetssiden for et medlem og læse fulde beskrivelse samt se hvilke bøder
-- der er blevet udgivet til det møde. Så skal mødesiden fjernes."
--
-- `events` is the calendar (what is planned); `attendance_records` is the history
-- (what happened). The descriptions were written on the calendar, which is where
-- a meeting is announced -- so removing the calendar screen without moving them
-- would lose the only prose the club has ever written about its own evenings.
--
-- **The match is a date, corroborated by a lead.** An event is paired with a
-- record only where the two share a date *and* that date carries exactly one row
-- on each side, which is 8 of the 12 events. What makes it more than a date
-- collision: seven of the eight descriptions name the evening's lead in their own
-- text -- "Oskar er Lead", "Emil er lead", "Anders er Lead", "Rasmus er lead",
-- "Esben er Lead", "Formand er lead" (Saaby is formand), and #22 saying the day
-- was handed to "vores kasserer Lukas" -- and every one of those agrees with
-- `attendance_records.lead` on the row it lands on. The eighth (#21, Esben) names
-- no one and matches on venue: the event's `location` is Bjælkehuset and so is
-- `main_location`.
--
-- **The number in the title is never used.** T071 established that the club's own
-- numbering ran a meeting ahead of the database's through the middle of the
-- history and closed the gap again, so "Erhvervsklub #20" is not record 20.
-- Joining on it would move a third of the history by one.
--
-- **What is deliberately left behind**, because the join refuses it rather than
-- guesses:
--   * `2025-04-26 Erhvervsklub #20` -- a held meeting with a real description, but
--     record #20 is one of the eleven that never got a date, so there is nothing
--     to match it to. It stays in `events`, reachable and editable.
--   * `2025-04-20 Udarbejdelse af vedtægtsudkast` -- a working session, not a
--     numbered club meeting; it has no attendance record at all.
--   * `2026-08-08 #29` and `2026-09-11 #30` -- still ahead. A future meeting
--     cannot have an attendance record, which is the whole reason `events`
--     survives this change and the calendar keeps a home on /anciennitet.
--
-- Additive and idempotent: a nullable column, and a backfill that only ever
-- writes where the target is still null. Safe to re-run, and a no-op on a
-- database that does not hold this club's rows -- which is what CI has.

alter table public.attendance_records
  add column if not exists description text;

comment on column public.attendance_records.description is
  'Free prose about the evening. Seeded 2026-07-30 from events.description where a date matched 1:1; written on /anciennitet since.';

do $$
declare
  moved int;
  club  boolean;
begin
  with pair as (
    select ar.id as record_id, btrim(ev.description) as descr
    from public.events ev
    join public.attendance_records ar
      on ar.meeting_date = ev.date
    where btrim(coalesce(ev.description, '')) <> ''
      -- Exactly one row on each side of the date, or there is no way to say
      -- which evening the prose belongs to. Three of the club's records share a
      -- single calendar event (T071), and that ambiguity must lose the
      -- description rather than pick a row.
      and (select count(*) from public.attendance_records a2 where a2.meeting_date = ev.date) = 1
      and (select count(*) from public.events e2 where e2.date = ev.date) = 1
  )
  update public.attendance_records ar
     set description = pair.descr
    from pair
   where ar.id = pair.record_id
     -- Never overwrite prose written on /anciennitet. This is a seed, not a sync.
     and ar.description is null;

  moved := (select count(*) from public.attendance_records where description is not null);

  -- The club's own database, by the counts T078 verified. Only there is the
  -- expected result known, so only there is it asserted: the failure this catches
  -- is a migration that ran green against production and moved nothing.
  club := (select count(*) = 28 from public.attendance_records)
      and (select count(*) = 12 from public.events);

  if club and moved <> 8 then
    raise exception
      'meeting_description: expected 8 descriptions on the club''s records, got %', moved;
  end if;

  raise notice 'meeting_description: % record(s) now carry a description', moved;
end $$;
