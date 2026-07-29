-- Deterministic synthetic seed for local dev + CI (task T012), user-INDEPENDENT
-- part. Auth users + anything referencing them are created by
-- scripts/seed-auth.mjs (via the GoTrue admin API — raw auth.users inserts fail
-- GoTrue's schema scan). `npm run db:reset` runs both in order.
--
-- Reproduces the edge cases the review flagged (PLAN-REVIEW):
--   * duplicate meeting_number (two records numbered 3, one blank)
--   * a late joiner (Chris) with rows only in later meetings → 'none' cells
--   * a member_name with no login (Dana) — member_name is free text

-- News (2 posts).
insert into public.news (title, excerpt, author, date) values
  ('Sæsonstart', 'Klubben er tilbage efter sommerpausen.', 'Bestyrelsen', '2025-09-01'),
  ('Nye vedtægter', 'Vedtægterne er opdateret og godkendt.', 'Bestyrelsen', '2025-10-15');

-- Events (2 past, 1 future — exercises the upcoming-events filter).
insert into public.events (title, date, time, location, description) values
  ('Møde #1', '2025-09-06', '18:00 - 23:00', 'Café A', 'Sæsonstart.'),
  ('Møde #2', '2025-10-18', '12.00-22.00',  'Café B', 'Efterårsmøde.'),
  ('Møde #3', '2099-01-01', '17:00 - 22:00', 'Café C', 'Fremtidigt møde.');

-- Attendance records: 4 meetings, incl. a DUPLICATE meeting_number 3 (one blank).
-- Identity ids autoassign 1..4 in this order.
insert into public.attendance_records (meeting_number, lead, pre_location, main_location, post_location) values
  (1, 'Alice', 'Privaten', 'Café A', 'Bar X'),        -- id 1
  (2, 'Bob',   'Privaten', 'Café B', null),            -- id 2
  (3, 'Chris', 'Lilly',    'Café C', 'Bar Z'),         -- id 3
  (3, '',      null,       '',       null);            -- id 4 (blank duplicate #3)

-- Members. The club's own ten come from the members migration, which guards
-- itself on their attendance rows and therefore inserts nothing into this
-- stack — the members here are these four. Bob is inactive, so a dev box
-- exercises the §3 split the finance page turns on: a roster of four, three of
-- them charged.
insert into public.members (name, status, note) values
  ('Alice', 'aktiv',   null),
  ('Bob',   'inaktiv', 'På pause siden sæsonstart.'),
  ('Chris', 'aktiv',   null),
  ('Dana',  'aktiv',   null);

-- Attendances: Chris joins only from meeting 3 → meetings 1,2 have no Chris row.
-- Dana is a member_name with no login at all.
insert into public.attendances (record_id, member_name, attended) values
  (1, 'Alice', true), (1, 'Bob', true),  (1, 'Dana', false),
  (2, 'Alice', true), (2, 'Bob', false), (2, 'Dana', true),
  (3, 'Alice', true), (3, 'Bob', true),  (3, 'Chris', true), (3, 'Dana', true),
  (4, 'Alice', false),(4, 'Bob', true),  (4, 'Chris', false);
