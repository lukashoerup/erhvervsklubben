-- Which fines the club has actually collected (T078).
--
-- Lukas, 2026-07-30, reading the top of `/oekonomi`: *"Der står i toppen af
-- økonomisiden at der er udestående bøder på 2510 kr. Det passer ikke."*
--
-- He is right, and the page was wrong in the worst available way: it summed
-- **every fine the club has ever incurred** and printed the total under the word
-- *udestående*. 1.780 kr. of that has been in the bank since February 2026. The
-- card overstated what the membership owes by the entire amount it had already
-- paid.
--
-- The reason the app could not tell them apart is recorded in
-- docs/finance-reconciliation.md §16: **`payments` is one combined figure per
-- month** covering kontingent and fines together, because that is all the bank
-- statement itemises. So "collected" cannot be derived from the payments side at
-- all, and the only honest place to carry it is on the fine itself.
--
-- ===========================================================================
-- The division is evidence, not arithmetic
-- ===========================================================================
-- It was established in T075 (§15) and is not re-derived here. Lukas's own notes
-- carry the line **"Bøder indkrævet"**, which separates the evenings that were
-- billed from the three that never were:
--
--   møder 21–25   1.730 kr.  billed and collected
--   møde  #26       180 kr.  noted, never billed
--   møde  #27        80 kr.  noted, never billed
--   møde  #28       470 kr.  noted, never billed   (generalforsamlingen)
--                   ------
--                    730 kr.  money the club is owed and has never asked for
--
-- The bank confirms the collected half independently and to the krone:
-- `Emil bødekasse` 235 on 09.02.2026 plus `Bøder` 1.545 on 16.02.2026 = 1.780.
--
-- ===========================================================================
-- 1.730 is not 1.780, and the 50 kr. between them decides one row
-- ===========================================================================
-- The five collected evenings sum to 1.730 kr. The bank received 1.780 kr. The
-- difference is **the treasurer's own voluntary 50 kr. at møde #26** (Lukas,
-- 2026-07-29): he transferred it himself, which is precisely why it is
-- `rule_id = 'frivillig'` and not an offence anybody charged him.
--
-- So that row is **settled** even though its meeting is one of the three that
-- were never billed. Money that a member transferred is money the club holds; it
-- cannot sit in a total labelled "not yet collected" merely because the evening
-- around it was never invoiced. With it included the two sides close exactly:
--
--   19 rows  1.780 kr.  settled    = what the bank received
--   11 rows    730 kr.  unsettled  = what §15.1 leaves as Lukas's decision
--   ------------------
--   30 rows  2.510 kr.  incurred
--
-- This is why the guard below is written as `meeting_number <= 25 OR rule_id =
-- 'frivillig'` rather than as a meeting cut-off alone. A cut-off alone marks 18
-- rows and 1.730 kr., which reconciles against nothing.
--
-- ===========================================================================
-- The date is the collection round, not the transfer
-- ===========================================================================
-- Two transfers a week apart make up the 1.780 kr., so no single date is the day
-- each individual fine arrived — and the column deliberately does not pretend
-- otherwise. `settled_at` records **the quarterly collection round the fine was
-- settled in**, which is the unit the Bødekasseregulativ (Stk. 3) actually works
-- in and the unit `payments` already stores: the club's books put the whole
-- 1.780 kr. in 2026-02. 16.02.2026 is the day the bulk of it arrived.
--
-- A per-transfer receipt date would need the bank to say which fine each krone
-- of a 1.545 kr. lump belonged to. It does not, and inventing that mapping is
-- the exact class of fabrication §15 refused for the offences.
--
-- ===========================================================================
-- Additive, guarded, re-runnable
-- ===========================================================================
-- `add column if not exists` — nothing existing is touched, and every row starts
-- null, which reads as "not collected". That is the safe default: a fine nobody
-- has marked as paid is a fine the club is still owed.
--
-- The data update is guarded on **the club's own fine book as a whole** — 30
-- rows summing to 2.510 kr. A local stack, CI and any other database get the
-- column and not one marked row, because the evidence above is about this club's
-- eight fine-bearing evenings and means nothing anywhere else. The guard fails
-- closed and says so.
--
-- Re-runnable: the update only touches rows that are still null, so a second run
-- changes nothing, and a settlement the treasurer later records in the app is
-- never quietly reasserted. Same reasoning as T068's `on conflict do nothing`
-- and T075's `rule_id = 'historisk'` guard.
--
-- To reverse it, exactly and only:
--   alter table public.fines drop column settled_at;

alter table public.fines add column if not exists settled_at date;

comment on column public.fines.settled_at is
  'The quarterly collection round this fine was settled in (Bødekasseregulativ '
  'Stk. 3), as a date inside that round — not the day the individual transfer '
  'landed, which the bank statement does not itemise. Null means not collected: '
  'the club is still owed it. Set for the 19 rows the bank confirms at '
  '1.780 kr.; the 11 rows on møder #26–#28 are the 730 kr. a Lead noted and '
  'nobody ever billed (docs/finance-reconciliation.md §15.1).';

do $$
declare
  n_rows integer;
  total_kr integer;
  marked integer;
begin
  select count(*), coalesce(sum(amount_kr), 0) into n_rows, total_kr from public.fines;

  -- Not this club's fine book. The column is what every database gets; the rows
  -- below are an assertion about eight specific evenings in Copenhagen.
  if n_rows <> 30 or total_kr <> 2510 then
    raise notice
      'fines holds % rows / % kr, not this club''s 30 / 2510 — settled_at added, nothing marked',
      n_rows, total_kr;
    return;
  end if;

  update public.fines f
  set settled_at = date '2026-02-16'
  from public.attendance_records r
  where r.id = f.record_id
    and f.settled_at is null
    -- "Bøder indkrævet" divides the ledger here. The voluntary row rides with
    -- them because it is money that moved, not money anybody was billed.
    and (r.meeting_number <= 25 or f.rule_id = 'frivillig');

  get diagnostics marked = row_count;

  -- The two sides have to close, or the club's books have moved since T075 and
  -- this file is asserting something that is no longer true. Refuse rather than
  -- leave a half-marked ledger behind.
  if marked <> 19 then
    raise exception 'expected to settle 19 fines, settled % — rolling back', marked;
  end if;

  if (select coalesce(sum(amount_kr), 0) from public.fines where settled_at is not null) <> 1780 then
    raise exception 'settled fines do not sum to the 1.780 kr. the bank received — rolling back';
  end if;

  if (select coalesce(sum(amount_kr), 0) from public.fines where settled_at is null) <> 730 then
    raise exception 'unsettled fines do not sum to §15.1''s 730 kr. — rolling back';
  end if;
end $$;
