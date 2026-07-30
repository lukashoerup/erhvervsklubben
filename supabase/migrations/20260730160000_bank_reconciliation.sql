-- The club's books against its actual bank statement (T076).
--
-- Source: `Erhvervsklubkonto4086341662_20260730.csv`, every transaction on the
-- account from the first payment to 30.07.2026 — 90 lines, closing 15.080,00 kr.
-- Latin-1 read as UTF-8 by whoever exported it, so it had to be decoded rather
-- than pattern-matched around: `Beløb` arrived as `Bel?b`. Full analysis and
-- every figure that did not tie out: docs/finance-reconciliation.md §16.
--
-- This is the first time the real ledger has been available. Everything in
-- `payments` until now came from the Google Sheet *Klubbens finanser*, which was
-- last saved 2026-06-09 — before the month it reports on had ended — and the
-- statement supersedes it for every month it covers.
--
-- ===========================================================================
-- The one decision in this file that could be made dishonestly
-- ===========================================================================
-- `payments.month` is **the month a payment settles**, not the month the money
-- arrived. The column has said so since it was created ("The month this settles,
-- as the first of that month"), and until this statement arrived nothing the
-- club kept could tell the two apart.
--
-- So a catch-up transfer is allocated across the months it was *for*. Seven of
-- the club's first transfers are retroactive and two say so in the bank's own
-- text — `Kasper jun-sep`, `Emil juni-september` — and one member cleared twelve
-- months in a single 1.200 kr. transfer on 01.05.2026. That is ordinary accrual
-- accounting, and it is worth being explicit about what it does and does not do:
--
--   * **The bank total does not move.** Allocation redistributes a payment
--     across months; it cannot create or destroy a krone. The rows below sum to
--     14.880 kr., which is the statement's own closing balance less the one
--     transfer that settles August (see the 2026-07 row).
--   * **What changes is the monthly view**, which stops recording a member as
--     eleven months delinquent and then wildly overpaid.
--
-- The distinction that matters, because it is the one that could be crossed
-- quietly: *allocated to the months it settles* is a claim about what a payment
-- was for, evidenced by the transfer text and by arithmetic that closes to the
-- krone against a per-member total. *Moved to make a graph look nicer* is a
-- claim about nothing. The allocation is implemented and tested in
-- `src/data/allocation.ts`, run against the real statement, so the numbers below
-- are reproducible rather than asserted.
--
-- Fine receipts are NOT allocated that way, deliberately — see the 2026-02 row.
--
-- ===========================================================================
-- Re-runnable, and guarded twice over
-- ===========================================================================
-- The `payments` corrections are guarded on **the values they replace**: each
-- row updates only while the month still holds the spreadsheet's amount *and*
-- the spreadsheet's balance. After one application neither matches, so a second
-- run changes nothing, and a correction the treasurer later makes in the app is
-- never quietly reasserted — the same reasoning as T068's `on conflict do
-- nothing` and T075's `rule_id = 'historisk'` guard.
--
-- Everything that inserts or writes `members` is additionally guarded on the
-- club's own ten names, because a migration runs on every database and not only
-- the one it was written against. A local stack and CI hold `seed.sql`'s
-- Alice/Bob/Chris/Dana, where the right outcome is the column and no rows.
--
-- To reverse it, exactly and only:
--   delete from public.payments where month = '2026-07-01';
--   update public.members set dues_from = null;
--   alter table public.members drop column dues_from;
--   -- then re-apply 20260729120000_finance_history_import.sql's payments block.

-- ---------------------------------------------------------------------------
-- members.dues_from — the historical payer count, at last
-- ---------------------------------------------------------------------------
-- §13 measured the club's expected-income line as 1.200 kr. too high across the
-- early months, because `/oekonomi` charged today's nine payers to a club that
-- charged eight, and §14.5 wrote down what fixing it would take: a nullable
-- date on `members`, and `buildLedger` counting payers per month from it. It was
-- left undone on purpose — "adding a joining date is a schema change and needs
-- Lukas first" — because the club had no record of when anyone started paying
-- and inventing one to make the early months land is a guess dressed as a
-- figure. The statement is that record, so the column is now evidence-led.
--
-- **Named `dues_from`, not `joined_on`, and the difference is not pedantry.**
-- The statement evidences dues liability and nothing else, and this club's own
-- history says the two dates are different people's:
--
--   * **Christian Have** has attended since møde #3 and was fined 60 kr. at
--     møde #26 on 2026-02-21 — three months before his first kontingent
--     transfer on 04.05.2026. Whatever happened in May, he did not join then.
--   * **Oskar** has attended 22 evenings and will never carry a value here at
--     all, because §12's founding father pays no kontingent.
--   * The club's first meeting on file predates the account by roughly three
--     years, so June 2025 is when the club started *charging*, not when seven
--     men joined.
--
-- Writing 2025-06-01 into a column called `joined_on` would have put a false
-- joining date on nine members, contradicted by `attendances`, in the name of a
-- column nothing else needs. Anciennitet is measured by attendance (§11), so
-- there is no second consumer waiting for a joining date.
alter table public.members add column if not exists dues_from date;

comment on column public.members.dues_from is
  'Første måned klubben opkræver kontingent af medlemmet (den 1. i måneden). '
  'NULL = ukendt, eller medlemmet opkræves ikke (founding father, §12). '
  'Er IKKE en indmeldelsesdato: fastlagt ud fra bankkontoudtoget 2026-07-30, '
  'som kun dokumenterer betalingspligt. Se docs/finance-reconciliation.md §16.3.';

-- Only where it is still null, so a later correction is not overwritten by a
-- re-run. Oskar is deliberately absent rather than present with a null: a row
-- in this list is a claim, and there is no month in which the club charges him.
update public.members m
   set dues_from = v.dues_from
  from (values
    -- The seven whose first transfer is the retroactive 400 kr. of 30.08 –
    -- 25.09.2025. 400 = four months at the then-rate of 100 kr., and two of the
    -- seven wrote the months in the transfer text: `Kasper jun-sep`, `Emil
    -- juni-september`. So the club's kontingent starts June 2025.
    ('Lukas',  date '2025-06-01'),
    ('Rasmus', date '2025-06-01'),
    ('Kasper', date '2025-06-01'),
    ('Esben',  date '2025-06-01'),
    ('Saaby',  date '2025-06-01'),
    ('Emil',   date '2025-06-01'),
    ('Anders', date '2025-06-01'),
    -- Mads made no transfer at all until 01.05.2026, when 1.200 kr. arrived as
    -- a bare `Overførsel`. 1.200 = twelve months at 100 kr. = June 2025 through
    -- May 2026 exactly, with nothing left over — which is both why his dues
    -- start with everyone else's and independent corroboration of Lukas's
    -- 2026-07-30 statement that the unnamed transfers are his. He was liable
    -- from the start and paid late; those are different facts.
    ('Mads',   date '2025-06-01'),
    -- Christian Have's first transfer is 04.05.2026, for 100 kr. — May's rate.
    -- His three transfers total 500 kr., which is May at 100 plus June and July
    -- at 200, exactly. §9 Q8 recorded "nine from June 2026" from memory; the
    -- bank refines it by one month. Nothing about when he *joined* — see above.
    ('Have',   date '2026-05-01')
  ) as v (name, dues_from)
 where m.name = v.name
   and m.dues_from is null
   -- This club and no other. Ten specific names, rather than a bare existence
   -- check: an editable status or meeting date would make a weaker fingerprint,
   -- and hanging one club's dues history off another database's `Lukas` is
   -- exactly the failure T068 and T075 were both fixed for.
   and (select count(*) from public.members x
         where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                          'Lukas','Mads','Kasper','Have','Oskar')) = 10;

-- ---------------------------------------------------------------------------
-- payments — the thirteen imported months, corrected against the bank
-- ---------------------------------------------------------------------------
-- `amount_kr` becomes what settles in that month: dues allocated to it, plus
-- fine money collected in it. `bank_balance_kr` becomes **the statement's own
-- closing Saldo for that calendar month** — real bank data, which is what the
-- column has always meant ("What the treasurer saw in the bank when
-- confirming"). It was previously the running total of `amount_kr`, copied from
-- the sheet's `Faktisk beholdning`, and that column turns out never to have been
-- a bank balance: it was an accrual roll-up of 800 kr. a month, and only its
-- final cell — 13.280 on the day the sheet was saved — coincided with a figure
-- the bank ever showed.
--
-- The two columns therefore now differ by the timing float, on purpose. Running
-- `amount_kr` says what the club had earned by the end of a month; the bank
-- balance says what was in the account. Two members pay in advance (§4 Stk. 3
-- has kontingent paid in advance) and one paid a year in arrears, so the two can
-- only agree by accident.
update public.payments p
   set amount_kr = v.amount_kr,
       bank_balance_kr = v.bank_balance_kr,
       note = v.note
  from (values
    -- Nothing was in the account until 30.08.2025: the first four months of
    -- kontingent were paid retroactively, so the bank stood at 0 through June
    -- and July 2025 while 800 kr. a month was being earned.
    (date '2025-06-01',  800,   800,  800,     0,
     'Kontingent for juni-september 2025 blev indbetalt bagud, 30.08-25.09.2025 (bl.a. "Kasper jun-sep" og "Emil juni-september"). Kontoen stod derfor på 0 kr. ved månedens udgang. Se docs/finance-reconciliation.md §16.'),
    (date '2025-07-01',  800,  1600,  800,     0, null),
    (date '2025-08-01',  800,  2400,  800,   400, null),
    (date '2025-09-01',  800,  3200,  800,  3000, null),
    (date '2025-10-01',  800,  4000,  800,  3700, null),
    (date '2025-11-01',  800,  4800,  800,  4400, null),
    (date '2025-12-01',  800,  5600,  800,  5100, null),
    (date '2026-01-01',  800,  6400,  800,  5800, null),
    -- The club's one month with fines in it. 800 kr. of dues (eight members
    -- charged, all eight now settled) plus the 1.780 kr. the treasurer
    -- collected, arriving exactly as the sheet's formula `E10 = 700+1545+235`
    -- said: `Emil bødekasse` 235 on 09.02 and `Bøder` 1.545 on 16.02. The bank
    -- confirms that decomposition from money movement, three months after §3.3
    -- inferred it from a spreadsheet cell.
    --
    -- The 700 the sheet booked as February kontingent was right about the cash
    -- and wrong about the charge, and this closes §9 Q7 ("did someone miss
    -- February?"): nobody did. Only seven members were transferring at the
    -- time, and 7 x 100 = 700 exactly. The eighth was Mads, who settled his
    -- February with the catch-up of 01.05.2026.
    --
    -- The fines are booked in the month they were **collected**, not spread
    -- back across the six evenings they paid for. That is a deliberate limit on
    -- the accrual rule above: the fine *charges* are already dated to their own
    -- meetings in `fines` (T071), so re-spreading the receipt would state the
    -- same money twice in two tables, and the Bødekasseregulativ makes
    -- collection a quarterly event rather than a monthly one. See §16.4.
    (date '2026-02-01', 2480,  8880, 2580,  8280,
     '800 kontingent (otte opkrævede) + 1.780 bøder, indbetalt som 235 kr. ("Emil bødekasse", 09.02) + 1.545 kr. ("Bøder", 16.02) — netop regnearkets formel E10 = 700+1545+235, nu set i banken. Regnearkets 700 var kassebeholdningen, ikke opkrævningen: kun syv medlemmer indbetalte dengang (7 x 100), og den ottende (Mads) betalte februar med sin efterbetaling 01.05.2026.'),
    (date '2026-03-01',  800,  9680,  800,  8980, null),
    -- The sheet had 900 here and 900 in May. The bank says 800 and 900: eight
    -- payers in April, nine from May. §13 read the two 900s as "+100 each"
    -- against 800 charged; one of the two hundreds was simply May's.
    (date '2026-04-01',  900, 10580,  800,  9780,
     'Regnearket havde 900. Banken viser 800: otte opkrævede à 100 kr. De ekstra 100 kr. hørte til maj, hvor Christian Have kom til.'),
    (date '2026-05-01',  900, 11480,  900, 11780,
     'Ni opkrævede for første gang: Christian Have betalte første gang 04.05.2026. Mads'' efterbetaling på 1.200 kr. (01.05.2026) dækker juni 2025 - maj 2026 og afvikler hele hans restance.'),
    -- §5.3's 400 kr., answered. The doc called explanation (a) "the more likely
    -- of the two" — that two more payments sat just below the screenshot's cut,
    -- dated 1 July. The statement says (b), and names the transfers: Rasmus on
    -- 29.06 and Lukas on 30.06, 200 kr. each, both settling **July**. They
    -- arrived after the sheet was saved on 2026-06-09 and before 1 July, which
    -- is why neither the sheet nor the screenshot could see them.
    --
    -- So both closing figures are right about different things. 13.280 kr. is
    -- what the club had earned through June 2026 — and it is exactly the annual
    -- report's total, reproduced here from the bank for the first time. 13.680
    -- kr. is what was in the account on 30 June. The 400 kr. between them is
    -- July's dues, paid in advance. Nothing is missing.
    (date '2026-06-01', 1800, 13280, 1800, 13680,
     'Ni opkrævede à 200 kr. Banken stod på 13.680 kr. 30.06.2026, ikke 13.280 som regneark og årsberetning: Rasmus (29.06) og Lukas (30.06) betalte juli forud med 200 kr. hver. Det er §5.3''s 400 kr. — forklaring (b), ikke (a). Begge tal er rigtige: 13.280 er indtjent til og med juni, 13.680 er kontoens saldo.')
  ) as v (month, was_amount, was_balance, amount_kr, bank_balance_kr, note)
 where p.month = v.month
   -- The guard that makes this apply once and never again: both of the values
   -- being replaced must still be the spreadsheet's.
   and p.amount_kr = v.was_amount
   and p.bank_balance_kr = v.was_balance;

-- July 2026 — the month the sheet never reached, and the first month the club
-- has not been paid in full.
--
-- 1.600 kr. settled of 1.800 kr. charged. **Anders is 200 kr. short, and it is
-- known rather than an error**: he has just changed bank (Lukas, 2026-07-30).
-- He is the only member with anything outstanding in fourteen months.
--
-- The statement closes at 15.080 kr., and `bank_balance_kr` says so, because
-- that is what the account held on 30.07.2026. The 200 kr. between that and the
-- 14.880 kr. these rows sum to is Rasmus's transfer of 30.07, which settles
-- **August** — he has paid a month in advance since October 2025. The club is
-- mid month-change and its members transfer on different days, so a
-- reconciliation drawn at the end of July has to hold that one transfer out or
-- report eight members delinquent for a month that has barely started. 14.880
-- is also the balance Lukas photographed on 27.07, three days before the
-- statement was pulled, which is a second sighting of the same figure.
--
-- No 2026-08 row is written for it. A month in progress does not belong in a
-- ledger that reports what the club is owed.
insert into public.payments (month, amount_kr, bank_balance_kr, note)
select date '2026-07-01', 1600, 15080,
  'Afstemt mod bankkontoudtog pr. 30.07.2026. 1.600 kr. af 1.800 kr. opkrævet: Anders mangler 200 kr., fordi han har skiftet bank (Lukas, 2026-07-30) — det eneste udestående kontingent i fjorten måneder. Kontoens saldo på 15.080 kr. indeholder Rasmus'' 200 kr. fra 30.07, der dækker august og derfor ikke er med her; afstemningen går til 14.880 kr., samme tal som Lukas fotograferede 27.07.'
where (select count(*) from public.members x
        where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                         'Lukas','Mads','Kasper','Have','Oskar')) = 10
on conflict (month) do nothing;

-- ---------------------------------------------------------------------------
-- What was deliberately NOT written
-- ---------------------------------------------------------------------------
-- **The −2,61 kr. of 30.08.2025**, the only outgoing on the account in its whole
-- life. Its Saldo column settles what it was: the balance *before* it is 2,61
-- and *after* it is 0,00, on the same day the club's first 400 kr. arrived. It
-- is the account being swept to zero of a residue that predates the club, to the
-- owner's own use — which is what `Til Eget forbrug` says. The club's books
-- should not carry it: it is not the club's money, `payments` is whole kroner
-- and could not hold it faithfully anyway, and the statutes (§8) describing a
-- club with no operating costs are borne out rather than contradicted — 89 of
-- the 90 lines are credits and the ninetieth is not an expense. The club's
-- ledger opens at 0,00, which is exactly where the statement's Saldo starts.
--
-- **A 2026-08 row for Rasmus's 200 kr.** See above.
--
-- **Anything in `fines`.** The statement confirms the fine money that was
-- *collected* — 235 + 1.545 = 1.780 kr., independently of the spreadsheet — and
-- says nothing about what was *incurred*, which stands at 2.510 kr. after T075.
-- The 730 kr. between them is fines a Lead noted and nobody ever billed (§15.1);
-- it is money the club is owed, not a reconciliation difference, and collapsing
-- the two would lose the club 730 kr. quietly. Nothing here touches a fine row.
--
-- **`attendances`, `attendance_records`, `news`, `events`, `profiles`, and
-- `members.status`.** Untouched, and counted before and after.
