-- A planned meeting gets a lead, in a column of its own.
--
-- Lukas, 2026-08-08: *"Jeg har oprettet ny begivenhed. Have er lead, men jeg skrev
-- TBD, først fordi at jeg ikke vidste det. Men kan ikke ændre det."*
--
-- **He is right that he could not, and the reason is that there was nowhere to put
-- it.** `attendance_records` has had a `lead` column since the beginning — a held
-- meeting's card uses it as its heading — and `events` never did. The form that
-- creates a meeting shows a Lead field either way, and on the calendar branch
-- `useSaveMeeting` simply dropped what he typed. So the field accepted a value, said
-- nothing, and stored nothing.
--
-- **The club has been working around this for years, in free text.** Every calendar
-- row it has ever written says the lead in its description: "Anders er Lead.",
-- "Rasmus er lead", "Esben er Lead. Generalforsamling. Meget stort.", "Formand er
-- lead." A fact the club records on every single row is a column, and keeping it as
-- prose costs three things — it cannot be shown where a held meeting shows it, it
-- cannot be corrected as itself, and it has to be retyped when the evening is
-- recorded.
--
-- Defaulted rather than nullable. §9 has the lead calling the meeting two weeks
-- ahead, so a meeting written down before the lead is known is the ordinary case and
-- not a defect; empty string is that state, and it matches how `location` and `time`
-- already say "not decided" on this table.

alter table public.events
  add column if not exists lead text not null default '';

comment on column public.events.lead is
  'Who runs the evening. Empty until the club decides — see §9. Carried onto attendance_records.lead when the meeting is recorded.';

-- ------------------------------------------------------- the one row he asked about
--
-- Erhvervsklub #31, 24 October 2026 — the meeting he had just created when he wrote.
-- Its description is exactly and only "Have er Lead", and he has told me in the same
-- message that Have is the lead. Two independent statements of the same fact, so
-- moving it into the column is a translation and not a guess.
--
-- The description is cleared **because that sentence was the whole of it**. Left
-- alone, the card would show "Have" as its heading and "Have er Lead" underneath it:
-- the same fact twice, which is how a screen teaches people not to trust it. The old
-- value is written out here, so this is recoverable from the file even though the
-- club's history is not.
--
-- Matched on the description rather than on the id, so re-running against a database
-- where he has already fixed it by hand changes nothing.
update public.events
   set lead = 'Have',
       description = ''
 where title = 'Erhvervsklub #31'
   and date = '2026-10-24'
   and description = 'Have er Lead';

-- **Erhvervsklub #30 is deliberately left alone**, and this is the more interesting
-- half. That row has `location = 'Lukas'` and `description = 'TBD'` — a person's name
-- in the venue field, which is the same workaround pointing the other way. But the
-- club's lead order is not a fixed rotation (meetings 25-29 ran Saaby, Anders,
-- Rasmus, Esben, Mads; the cycle before that was a different order entirely), so
-- there is nothing here that can tell me whether Lukas is the lead of #30 or the
-- venue is his house. Guessing would put a wrong name on the club's own calendar and
-- look authoritative doing it. He can set it in two taps now, which is what he asked
-- for.

do $$
declare
  fixed int;
begin
  fixed := (select count(*) from public.events
             where title = 'Erhvervsklub #31' and lead = 'Have');
  -- Not an exception. A database where he has already corrected the row by hand is
  -- a *better* outcome than this migration's, not a failure of it — and a hard stop
  -- here would block every later migration behind a row that is already right.
  if fixed = 0 then
    raise notice 'events_lead: #31 not backfilled — already edited by hand, or the row is gone';
  end if;
  raise notice 'events_lead: lead column added; % row(s) carried over from prose', fixed;
end $$;
