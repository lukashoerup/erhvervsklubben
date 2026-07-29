-- The club's finance history, imported from "Klubbens finanser" (T068).
--
-- Source: Google Sheet `1vOyTgOqqme7ad6ttRdr0Pmfy4izjEMY5AVu0BduIwfE`, last
-- modified 2026-06-09. Read as .xlsx so the *formulas* survive — the text
-- export collapses empty cells and silently shifts columns, and the formulas
-- are what settle the mapping below. Full analysis: docs/finance-reconciliation.md.
--
-- This is real money, so the rule throughout is: record the amount exactly,
-- and record everything we do not know as not known. Nothing here is inferred
-- to make a total look complete.
--
-- Re-runnable. Both inserts are `on conflict do nothing` against the tables'
-- own unique keys, so applying this twice inserts nothing the second time.
-- `do nothing` rather than `do update` on purpose: once the treasurer corrects
-- a row in the app, a re-run must not quietly reassert the spreadsheet over
-- him. This import seeds; it does not keep asserting.
--
-- To reverse it, exactly and only:
--   delete from public.fines where rule_id = 'historisk';
--   delete from public.payments where month between '2025-06-01' and '2026-06-01';

-- ---------------------------------------------------------------------------
-- payments — Sheet1, the monthly ledger
-- ---------------------------------------------------------------------------
-- `amount_kr` is the sheet's `Indbetalinger` (money that actually arrived),
-- `bank_balance_kr` its `Faktisk beholdning` (the running balance, which is
-- what a future reconciliation against a bank statement compares against).
-- Verified: Faktisk beholdning is the exact running total of Indbetalinger for
-- all thirteen months, and the thirteen amounts sum to 13.280 — matching the
-- sheet's own live `E29 = SUM(Finanser[Indbetalinger])` and the annual report.
--
-- `Kontigenter` (what was *charged*) and `Forventede bøder` (a forecast) are
-- deliberately not imported. Only money that moved belongs in `payments`.

insert into public.payments (month, amount_kr, bank_balance_kr, note) values
  ('2025-06-01',  800,   800, null),
  ('2025-07-01',  800,  1600, null),
  ('2025-08-01',  800,  2400, null),
  ('2025-09-01',  800,  3200, null),
  ('2025-10-01',  800,  4000, null),
  ('2025-11-01',  800,  4800, null),
  ('2025-12-01',  800,  5600, null),
  ('2026-01-01',  800,  6400, null),
  -- The sheet stores this cell as `=700+1545+235`, not as a typed 2480. Those
  -- three transfers decompose exactly: 700 kontingent (100 short of the 800
  -- charged, still unexplained), plus 1545 + 235 = 1780 of fines. That is the
  -- independent proof that the year's fines were 1.780 and were collected —
  -- money movement, not a column sum.
  ('2026-02-01', 2480,  8880, '700 kontingent + 1545 + 235 bøder (regnearkets formel E10). Kontingent 100 kr under de 800, der blev opkrævet.'),
  ('2026-03-01',  800,  9680, null),
  ('2026-04-01',  900, 10580, null),
  ('2026-05-01',  900, 11480, null),
  -- Imported with its caveat rather than withheld. The sheet was last saved
  -- 2026-06-09, before the month it reports on had ended, and the bank showed
  -- 13.680 immediately before the 1 July payments — 400 kr more. Leaving the
  -- row out would make the balance wrong by 1.800; leaving it in makes it
  -- possibly wrong by 400, and says so.
  ('2026-06-01', 1800, 13280, 'FORELØBIG: regnearkets øjebliksbillede fra 2026-06-09, før måneden var slut. Banken viste 13.680 før 1. juli. Se docs/finance-reconciliation.md §5.3.')
on conflict (month) do nothing;

-- ---------------------------------------------------------------------------
-- fines — Sheet2, the per-member grid
-- ---------------------------------------------------------------------------
-- Which meeting each column is.
--
-- Sheet2's columns are Leads, not dates, and every Lead name leads several
-- meetings in `attendance_records` — a lead-only join is ambiguous 2-to-4 ways
-- and must not be used alone. Two formulas in Sheet1 resolve it as fact rather
-- than inference, and both were re-verified against the .xlsx for this import:
--
--   C2 = 100+95+80    -> the Esben Lead column, top to bottom: Kasper 100,
--                        Holst 95, Tørring 80. Sheet1 puts it in Juni 25.
--   C4 = 105+50+50+200 -> the Lukas Lead column, top to bottom: Kasper 105,
--                        Emil 50, Holst 50, Mads 200. Sheet1 puts it in Aug 25.
--
-- Whoever built the sheet typed each Lead column into one month cell. So one
-- fine-month = one Lead column. The remaining three follow uniquely, because
-- the five column sums (405/275/305/270/475) and the five nonzero month values
-- are the same set of five *distinct* numbers. `created_at` ordering on
-- records 21–25 agrees independently, and within the Juni 25 – Februar 26
-- window each of the five Lead names occurs exactly once:
--
--   Juni 25    275  Esben Lead  -> record 21  (formula C2)
--   August 25  405  Lukas Lead  -> record 22  (formula C4)
--   Oktober 25 305  Oskar Lead  -> record 23
--   November 25 270 Emil Lead   -> record 24
--   Januar 26  475  Saaby Lead  -> record 25
--
-- Why every row is `rule_id = 'historisk'`, `minutes = 0`.
--
-- The sheet records amounts and nothing else. Against the five fine rules most
-- amounts have several valid readings — 200 kr is `udeblivelse` *or* thirty
-- minutes late, 100 kr is `sent-afbud` *or* two 50-rules *or* ten minutes late
-- — and 12 of the 18 cells are ambiguous that way. Writing a specific offence
-- against a named member on a guess would be worse than recording none, so the
-- money is exact and the offence is honestly unknown. `minutes = 0` because
-- zero minutes is not a claim; it is the column's default.
--
-- Not imported, deliberately: the Februar 26 fine of 50 kr. It is real and was
-- paid (it is inside the 1.545 lump in E10 above), but Sheet2 never got a
-- sixth column, so it has neither a member nor a meeting. A fine on the wrong
-- evening against the wrong member is worse than a fine not yet entered.
-- That is why these rows total 1.730 and the year's fines were 1.780.

insert into public.fines (record_id, member_name, rule_id, minutes, amount_kr) values
  -- record 21 — møde #21, Esben Lead, Bjælkehuset (Juni 25, sum 275)
  (21, 'Kasper',  'historisk', 0, 100),
  (21, 'Rasmus',  'historisk', 0,  95),   -- sheet: "Holst"
  (21, 'Anders',  'historisk', 0,  80),   -- sheet: "Tørring"

  -- record 22 — møde #22, Lukas Lead, Tivolihallen (August 25, sum 405)
  (22, 'Kasper',  'historisk', 0, 105),
  (22, 'Emil',    'historisk', 0,  50),
  (22, 'Rasmus',  'historisk', 0,  50),   -- sheet: "Holst"
  (22, 'Mads',    'historisk', 0, 200),

  -- record 23 — møde #23, Oskar Lead, Café Lindevang (Oktober 25, sum 305)
  (23, 'Emil',    'historisk', 0,  75),
  (23, 'Saaby',   'historisk', 0,  75),
  (23, 'Esben',   'historisk', 0, 155),

  -- record 24 — møde #24, Emil Lead, Les St Jacques (November 25, sum 270)
  (24, 'Saaby',   'historisk', 0, 200),
  (24, 'Esben',   'historisk', 0,  70),

  -- record 25 — møde #25, Saaby Lead, Marv og Ben (Januar 26, sum 475)
  (25, 'Kasper',  'historisk', 0,  60),
  -- One row of 110, not 60 + 50. The sheet's cell is `{=60+50}` — two separate
  -- offences bundled — but the regulation's one-fine-per-offence-per-meeting
  -- rule is the table's unique key `(record_id, member_name, rule_id)`, and
  -- with both offences unknown there is no honest pair of rule ids to split
  -- them under. Inventing two to satisfy the constraint would fabricate the
  -- very thing this import refuses to guess. The krone total is identical.
  (25, 'Emil',    'historisk', 0, 110),
  (25, 'Mads',    'historisk', 0, 185),
  (25, 'Saaby',   'historisk', 0,  60),
  (25, 'Esben',   'historisk', 0,  60)
on conflict (record_id, member_name, rule_id) do nothing;

-- Sheet2 name -> database member_name. `Holst` = Rasmus and `Tørring` = Anders
-- were both answered by Lukas (2026-07-29); the sheet mixes first names and
-- surnames, the database uses first names only. All seven names exist in the
-- roster. Everyone else appears identically in both.
