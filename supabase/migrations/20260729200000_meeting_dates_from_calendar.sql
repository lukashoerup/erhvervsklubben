-- Dates for the club's meetings, from Lukas's Outlook calendar (T071).
--
-- Every one of the 28 meetings in `attendance_records` was undated, which is
-- why all 1.730 kr. of imported fines sat outside the month-by-month ledger
-- while the payments sat inside it. A fine cannot be placed in a month without
-- a meeting date. This migration supplies the dates that could be established;
-- it deliberately supplies no others.
--
-- Source: Lukas's Outlook calendar, searched exhaustively for the club's
-- invitations and for the all-day blocks he keeps for it. Subjects vary
-- ("Erhvervsklubben", "Erhvervsklub", with and without `#N` and a venue), so
-- the search was run per date window and per member-organiser rather than on
-- one query string.
--
-- THE ONE THING THAT MUST NOT BE COPIED FROM HERE: `#N` in a calendar subject
-- is NOT `attendance_records.meeting_number`. The club's own numbering ran one
-- ahead of the database's through the middle of the history and closed the gap
-- again later. Proof, not suspicion:
--
--   "Erhvervsklub #18" (2024-10-12) has an agenda naming Aamanns 1921,
--   St. Pauli 54 and ÅBEN i Kødbyen, organised by Kasper Juulsgaard from
--   Stenosgade 3. That is record 17 exactly — lead Kasper, main `Aamanns`,
--   post `St. Pauli + ÅBEN`, pre `Privaten`. Not record 18, which is London.
--
--   "Erhvervsklub #13 - Ekskursion til Odense" (2024-01-20) is at RESTAURANT
--   HOS, Kongensgade 65, Odense, organised by Mads. That is record 12 — lead
--   Mads, main `Hos`, pre `DSB` (the train), post `Sir Club` (Odense).
--
-- So every date below was matched on **lead + venue + ordering**, and the
-- number in the subject was only ever used as a tiebreak once lead and venue
-- already agreed. Where lead and venue could not corroborate a date, the row
-- is left null on purpose. A missing date is visible in the app; a wrong one
-- is not, and a wrong one puts a fine in the wrong month and quarter.
--
-- Independent second source, and the reason confidence in records 21-25 is
-- high rather than merely good: `docs/finance-reconciliation.md` §3.2 pins each
-- of Sheet2's five Lead columns to a month of Sheet1 by way of two verbatim
-- spreadsheet formulas. Those five months — Juni 25, August 25, Oktober 25,
-- November 25, Januar 26 — land on the leads Esben, Lukas, Oskar, Emil, Saaby.
-- The calendar, which has never seen that spreadsheet, dates records 21-25 to
-- meetings led by Esben, Lukas, Oskar, Emil and Saaby in that order, in
-- 31 May 2025, August, October, November 2025 and January 2026. Four of the
-- five fall in the sheet's own month; the fifth is a dinner on the last day of
-- May whose fines were booked in the ledger's first month, June.
--
-- Re-runnable and additive. Each update is guarded three ways: it fires only
-- where the row exists, where its `meeting_number` AND `lead` match what was
-- matched here, and where `meeting_date` is still null. So a re-run changes
-- nothing, a database that lacks this club's rows (CI's stack, whose seed has
-- ids 1-4 under other leads entirely) is untouched, and a date the treasurer
-- has since corrected in the app is never overwritten by this file.
--
-- To reverse it, exactly and only:
--   update public.attendance_records set meeting_date = null
--    where id in (5,6,7,9,10,11,12,13,17,21,22,23,24,25,26,27,29);
--   delete from public.fines where record_id = 26 and member_name = 'Lukas';

-- ---------------------------------------------------------------------------
-- meeting_date
-- ---------------------------------------------------------------------------
update public.attendance_records ar
set meeting_date = v.meeting_date,
    updated_at   = now()
from (values
  -- Calendar "Erhvervsklubben #5 - Restaurant Kronborg", organiser Saaby.
  -- Location Brolæggerstræde 12 is Restaurant Kronborg's address.
  (5,  5,  'Saaby',  date '2022-10-29'),

  -- Calendar "Erhvervsklub", organiser Oskar (oaj.eco@cbs.dk), starting at the
  -- private address Ægirsgade 29 — record 6 records `Privaten inden med
  -- papvin`. The only club event between the confirmed #5 and #7.
  (6,  6,  'Oskar',  date '2023-01-21'),

  -- Calendar "Erhvervsklubben #7 - Restaurant Møntergade", organiser Esben,
  -- location Møntergade 19. Agenda: warm-up on Vesterbrogade, then Møntergade.
  (7,  7,  'Esben',  date '2023-03-11'),

  -- Calendar "Erhvervsklub #9", organiser Lukas. Body: bubbles at his own
  -- Asminderødgade 3 (`Privaten`), then Hansens Familiehave (`main_location`).
  (9,  9,  'Lukas',  date '2023-08-05'),

  -- Calendar "Erhvervsklub #10", organiser Emil. Body: his own Blegdamsvej
  -- 74C (`Privaten`), then Restaurant Palægade (`main_location`).
  (10, 10, 'Emil',   date '2023-09-09'),

  -- Calendar "Erhvervsklub #12 - Jubilæum", organiser Rasmus, venue still TBD
  -- when the invitation went out — so no venue corroboration, but the lead
  -- matches and it is the only club event between the confirmed records 10 and
  -- 12. An evening at 2.000 kr. a head fits record 11's Punk Royal.
  (11, 11, 'Rasmus', date '2023-11-11'),

  -- Calendar "Erhvervsklub #13 - Ekskursion til Odense", organiser Mads, at
  -- RESTAURANT HOS in Odense. Record 12: lead Mads, main `Hos`, pre `DSB`,
  -- post `Sir Club`. The calendar's 13 is the club's count, not the table's.
  (12, 12, 'Mads',   date '2024-01-20'),

  -- Calendar "Erhvervsklubben #X", organiser Anders (anha@cerix.dk), at
  -- Seaside Toldboden. Record 13's `pre_location` is `Seaside`. The subject
  -- carries no usable number at all, which is why lead and venue decide it.
  (13, 13, 'Anders', date '2024-03-09'),

  -- Calendar "Erhvervsklub #18", organiser Kasper Juulsgaard. Full agenda read
  -- from the event: drinks at Stenosgade 3 (`Privaten`), lunch at Aamanns 1921
  -- (`Aamanns`), then St. Pauli 54 and ÅBEN i Kødbyen (`St. Pauli + ÅBEN`).
  -- Record 17, beyond doubt, under a subject line that says 18.
  (17, 17, 'Kasper', date '2024-10-12'),

  -- Calendar all-day "Erhvervsklub" on 2025-05-31, and the record itself was
  -- created that same day. Lead Esben; §3.2 puts the Esben Lead column's
  -- 275 kr. in the ledger's first month, June 25 — a 31 May dinner settled in
  -- June, which is also why the sheet's month is one later than the dinner.
  (21, 21, 'Esben',  date '2025-05-31'),

  -- Calendar block on 2025-08-30 plus Saaby's "Placeholder | Erhvervsklub"
  -- invitation to the club for that date, and the record was created that day.
  -- Lead Lukas; §3.2 puts the Lukas Lead column's 405 kr. in August 25.
  -- (Lukas's own block is titled "#21" — his numbering, drifting, not the
  -- table's. The month from the spreadsheet is what makes this one safe.)
  (22, 22, 'Lukas',  date '2025-08-30'),

  -- Calendar "Erhvervsklub #23" on 2025-10-11, preceded by Saaby's
  -- "Erhvervsklub | Check-in" call the afternoon before — which is when the
  -- record was created. Lead Oskar; §3.2 puts the Oskar Lead column's 305 kr.
  -- in Oktober 25.
  (23, 23, 'Oskar',  date '2025-10-11'),

  -- Calendar "Erhvervsklub #24 | Fredagsbar", organiser Emil, at his own Nordre
  -- Frihavnsgade 19 ("vi ses efter arbejde hos mig") — record 24's `Privaten`.
  -- A Friday, and the invitation calls the Friday format new. Record created
  -- the same evening. §3.2 puts the Emil Lead column's 270 kr. in November 25.
  (24, 24, 'Emil',   date '2025-11-21'),

  -- Calendar "Erhvervsklub #25" on 2026-01-24. The record was not created
  -- until 2026-02-05, twelve days later, which on its own would leave January
  -- and February open — §3.2 closes it: the Saaby Lead column's 475 kr. is the
  -- ledger's Januar 26. Lead Saaby. So this meeting is January's, not
  -- February's, and February 2026 has exactly one meeting: record 26.
  (25, 25, 'Saaby',  date '2026-01-24'),

  -- Calendar "Erhvervsklub #26" on 2026-02-21 and the record created the same
  -- day. Lead Anders. The club's only February 2026 meeting — see the fine
  -- below.
  (26, 26, 'Anders', date '2026-02-21'),

  -- Calendar "Erhvervsklub" 2026-04-24 16.00-23.30 local, and the record
  -- created that afternoon. Lead Rasmus.
  (27, 27, 'Rasmus', date '2026-04-24'),

  -- Calendar "Erhvervsklub #28 - Generalforsamling", organiser Esben. Body:
  -- meet at Esben's Sylviavej 26 (`Privaten`), general meeting, then dinner at
  -- Propaganda (`main_location`). Record created the same day.
  (29, 28, 'Esben',  date '2026-06-26')
) as v (record_id, meeting_number, lead, meeting_date)
where ar.id = v.record_id
  and ar.meeting_number = v.meeting_number
  and ar.lead = v.lead
  and ar.meeting_date is null;

-- ---------------------------------------------------------------------------
-- The 50 kr. of Februar 26 — the last open item in the reconciliation
-- ---------------------------------------------------------------------------
-- `docs/finance-reconciliation.md` §3 established that the club's fines were
-- 1.780 kr. and not 1.730, that the missing 50 kr. was charged and collected in
-- Februar 26, and that Sheet2 simply never gave that month a Lead column. Two
-- things were unknown and both are now answered:
--
--   whose it was — Lukas's own. He told us on 2026-07-29: a voluntary fine he
--   transferred himself, as treasurer, because a year in which the treasurer
--   incurred no fine at all looked implausible. That is also why he is the one
--   member with no row in Sheet2's grid.
--
--   which meeting — record 26. The dating above puts exactly one meeting in
--   February 2026, on 2026-02-21, and record 25 is pinned to January by the
--   spreadsheet's own month column. There is no second candidate.
--
-- Same shape as the other seventeen: `rule_id = 'historisk'`, because the
-- offence is no more known here than it is for any of them, and inventing one
-- would fabricate the thing that import refused to guess. After this, fines
-- total 1.780 kr. and match the annual report.
insert into public.fines (record_id, member_name, rule_id, minutes, amount_kr)
select v.record_id, v.member_name, v.rule_id, v.minutes, v.amount_kr
from (values
  (26, 'Lukas', 'historisk', 0, 50)
) as v (record_id, member_name, rule_id, minutes, amount_kr)
where exists (
  select 1 from public.attendance_records ar
  where ar.id = v.record_id
    and ar.meeting_number = 26
    and ar.lead = 'Anders'
)
on conflict (record_id, member_name, rule_id) do nothing;
