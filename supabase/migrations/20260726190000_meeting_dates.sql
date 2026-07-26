-- Meeting dates.
--
-- The attendance record has never carried one — only a meeting number. That
-- blocks everything month-shaped: a fine cannot be placed in a month, so the
-- monthly ledger and the quarterly collection have nothing to group by.
--
-- Nullable, because the history genuinely does not have dates and inventing
-- them would be worse than admitting the gap. Vedtægterne §9 says two meetings
-- are always planned ahead, so from here on the date exists before the meeting
-- does — this is only a hole in the past, and a shrinking one.
alter table public.attendance_records add column meeting_date date;

comment on column public.attendance_records.meeting_date is
  'Nullable: meetings before 2026-07 were recorded without a date. Fines cannot '
  'be assigned to a month without it.';

-- Backfill what can be known. The events table titles meetings "Møde #N", and
-- carries the date the attendance record lacks.
--
-- Deliberately skips any meeting_number that identifies more than one record.
-- The data contains duplicates — the seed encodes a real one — and guessing
-- which of two records an event refers to would put a fine in the wrong month
-- silently. A missing date is visible; a wrong one is not.
update public.attendance_records ar
set meeting_date = e.date
from public.events e
where e.title ~ '^Møde #[0-9]+$'
  and nullif(regexp_replace(e.title, '\D', '', 'g'), '')::int = ar.meeting_number
  and (
    select count(*) from public.attendance_records dup
    where dup.meeting_number = ar.meeting_number
  ) = 1;
