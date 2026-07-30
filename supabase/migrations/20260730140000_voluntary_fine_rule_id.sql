-- The treasurer's own 50 kr. at møde #26 was not an unrecorded offence — it was
-- a voluntary transfer, and Lukas said so on 2026-07-29. `historisk` means
-- "nobody knows what this was"; he knew exactly. Renaming it stops the books
-- implying a member misbehaved where one was being a good sport.
--
-- Lukas, 2026-07-30: call it "Frivillige bøder/indbetalinger".
--
-- Guarded on the meeting and the member, so this is a no-op on any database
-- that is not this club's, and re-runnable on the one that is.
update public.fines f
set rule_id = 'frivillig'
from public.attendance_records ar
where ar.id = f.record_id
  and ar.meeting_number = 26
  and f.member_name = 'Lukas'
  and f.rule_id = 'historisk'
  and f.amount_kr = 50;
