-- August 2026 collected, and the club's last outstanding kontingent settled (T081).
--
-- Source: the account statement for 4086341662, 01.06.2026 – 04.08.2026, closing
-- 16.880,00 kr. Its June and July lines reproduce T076's CSV exactly — same
-- dates, same transfer texts, same amounts — so the overlap corroborates the
-- existing books rather than being a second source to reconcile against them.
-- Nothing before 2026-07-30 moves. Full workings:
-- docs/finance-reconciliation.md §17.
--
-- Eight transfers are new since T076's statement closed on 30.07.2026:
--
--   31.07  Lukas                    200  august (he has paid a month ahead since 2025)
--   03.08  Kontingent - Esben C.    200  august
--   03.08  Anders Tørring           400  **juli + august**
--   04.08  Emil kontingent          200  august
--   04.08  Kontingent Kasper        200  august
--   04.08  Overførsel               200  august — Mads, whose transfers carry no name (§16.2)
--   04.08  Christian Have           200  august
--   04.08  Mathias Saaby            200  august
--
-- Rasmus's 200 kr. of 30.07 was already on T076's statement and was deliberately
-- held out of the books as August money. It is in the 2026-08 row below, which is
-- what it was always for — which is why nine members paid August and only eight
-- transfers are listed here.
--
-- ===========================================================================
-- Anders's 400 kr., and why it does not have to be taken on trust
-- ===========================================================================
-- The bank says `Anders Tørring` and `400,00` and nothing else. Three
-- independent things place it across July and August:
--
--   1. Lukas said so — "Anders Tørring har indbetalt det han skylder" (2026-08-08).
--   2. The arithmetic has one solution. He owed exactly 200 kr. — July 2026, the
--      club's only outstanding kontingent in fourteen months (§16.8) — and
--      August's rate is 200 kr. 400 = 200 + 200 with no remainder, and
--      `allocateDues` places it oldest-month-first without being told which
--      months it was for.
--   3. The transfer text changed with him. Every earlier Anders line reads
--      `Anders Tørring Hanse`; this one reads `Anders Tørring`. A change of bank
--      is what T076 recorded as the reason the 200 kr. was late to begin with,
--      so the new text corroborates rather than confuses.
--
-- ===========================================================================
-- The club's position after this file
-- ===========================================================================
--   15.100  kontingent settled, June 2025 – August 2026
--   +1.780  bøder collected, February 2026
--   ------
--   16.880  reconciled
--   16.880  bank, 04.08.2026 = the statement's own closing balance
--
-- **The two agree exactly, for the first time in the club's recorded history**,
-- and that is a fact about the calendar rather than a tidier answer: T076 had to
-- hold one transfer out because the club was mid month-change, and here nobody
-- has paid September in advance yet. The gap reopens when Rasmus and Lukas
-- transfer at the end of August, and it should.
--
-- Kontingent outstanding is **0 kr.** Every month from June 2025 to August 2026
-- is settled in full by every member the club charges.
--
-- Untouched, deliberately: `fines`. The 730 kr. a Lead noted and nobody ever
-- billed (§15.1) is money the club is still owed, and folding a good month over
-- it would lose the club 730 kr. quietly. Also untouched: `members`,
-- `attendances`, `attendance_records`, `news`, `events`, `profiles`.
--
-- ===========================================================================
-- Re-runnable, and guarded the same way T076 is
-- ===========================================================================
-- The July correction is guarded on **the values it replaces**: it applies only
-- while that month still holds T076's 1.600 kr. against T076's 15.080 kr. After
-- one application the amount no longer matches, so a second run changes nothing
-- and a correction the treasurer later makes in the app is never quietly
-- reasserted. The August insert is guarded on the club's own ten names, because
-- a migration runs on every database and not only this one — a local stack and
-- CI hold seed.sql's Alice/Bob/Chris/Dana, where the right outcome is no rows.
--
-- To reverse it, exactly and only:
--   delete from public.payments where month = '2026-08-01';
--   update public.payments set amount_kr = 1600 where month = '2026-07-01';
--   -- and restore that row's note from 20260730160000_bank_reconciliation.sql.

-- ---------------------------------------------------------------------------
-- July 2026 — Anders settled it on 03.08, so the month is whole
-- ---------------------------------------------------------------------------
-- `bank_balance_kr` deliberately stays at 15.080. That is what the account held
-- on 30.07.2026, which is what the column has always meant, and it remains true
-- after this row's amount changes. Note that 15.080 is now also the running
-- total of `amount_kr` through July — the two coincide **by accident, not by
-- composition**: the balance contained Rasmus's August transfer and not Anders's
-- July one, and both happen to be 200 kr.
update public.payments
   set amount_kr = 1800,
       note = 'Fuldt indbetalt: 1.800 kr. af 1.800 kr. opkrævet. Anders'' manglende 200 kr. kom 03.08.2026 i en samlet overførsel på 400 kr., der dækker juli og august — han havde skiftet bank (Lukas, 2026-07-30/2026-08-08). bank_balance_kr står fortsat på kontoens saldo 30.07.2026 (15.080 kr.); at det tal nu er magen til de samlede indbetalinger til og med juli er et tilfælde — saldoen indeholdt Rasmus'' augustbetaling og ikke Anders'' juli.'
 where month = date '2026-07-01'
   and amount_kr = 1600
   and bank_balance_kr = 15080;

-- ---------------------------------------------------------------------------
-- August 2026 — nine of nine, and no outstanding kontingent anywhere
-- ---------------------------------------------------------------------------
-- T076 refused to write this row for Rasmus's single transfer of 30.07, on the
-- grounds that "a month in progress does not belong in a ledger that reports
-- what the club is owed" — eight members would have read as delinquent for a
-- month that had barely begun. That objection is now spent: all nine have paid,
-- so the row reports a settled month rather than a partial one.
insert into public.payments (month, amount_kr, bank_balance_kr, note)
select date '2026-08-01', 1800, 16880,
  'Afstemt mod kontoudtog pr. 04.08.2026, saldo 16.880,00 kr. Ni opkrævede à 200 kr., alle betalt: Rasmus 30.07, Lukas 31.07, Esben og Anders 03.08, Emil, Kasper, Mads, Have og Saaby 04.08. Anders'' 400 kr. dækker juli og august. Første gang i fjorten måneder uden udestående kontingent, og første gang de samlede indbetalinger (16.880 kr.) er nøjagtig kontoens saldo — ingen har betalt september forud endnu.'
where (select count(*) from public.members x
        where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                         'Lukas','Mads','Kasper','Have','Oskar')) = 10
on conflict (month) do nothing;
