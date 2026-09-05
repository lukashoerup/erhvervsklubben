-- Christian Have pays kontingent from June 2025, not May 2026: the buy-in is real.
--
-- Lukas, 2026-07-29: the ninth member "must still buy in retroactively — he is
-- treated as though he had paid kontingent all along, but he has not actually
-- paid." The next day's bank reconciliation (T076, §16.3) set his dues_from to
-- 2026-05-01 and concluded "Have owes nothing", because his three transfers
-- matched what he had been *asked* for from May. That showed he paid what he was
-- billed; it did not touch the agreement. Lukas, 2026-09-05, asked what Have owes:
-- *"Jo men i de udestående Have har ift. at han startede senere i klubben. Vi har
-- talt tidligere om det."* And, on the figure: **1.100 kr.** — eleven months, June
-- 2025 to April 2026, at the 100 kr. rate then in force; the same arithmetic Mads
-- settled twelve months by on 01.05.2026. Workings: docs/finance-reconciliation.md
-- §17.5.
--
-- `dues_from` means "the first month the club charges him". With the buy-in
-- agreed, that month is June 2025 — retroactively, but charged — so /oekonomi's
-- expected line carries his 1.100 kr. and the club reads as owed exactly that plus
-- the unbilled fines. When he pays, the transfer is allocated across the eleven
-- months it was for (§16.4, the accrual rule), the same way Mads's was.
--
-- Guarded on the row still holding the reconciliation's value, so it applies once
-- and never reasserts itself over a later correction; on a fresh stack there is no
-- Have row and nothing happens, out loud.

update public.members
   set dues_from = date '2025-06-01',
       note = 'Betaler kontingent bagud for juni 2025 til april 2026: 11 måneder à 100 kr. = 1.100 kr. Aftalt (Lukas 2026-07-29, bekræftet 2026-09-05). Første overførsel var 04.05.2026; klubben opkræver fra juni 2025, så de 1.100 kr. står som udestående, indtil de er betalt.'
 where name = 'Have'
   and dues_from = date '2026-05-01'
   and (select count(*) from public.members x
         where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                          'Lukas','Mads','Kasper','Have','Oskar')) = 10;

do $$
declare n int;
begin
  select count(*) into n from public.members where name = 'Have' and dues_from = date '2025-06-01';
  if n = 1 then
    raise notice 'have_dues_from_june_2025: Have charged from 2025-06-01 — 1.100 kr. outstanding until paid';
  else
    raise notice 'have_dues_from_june_2025: no Have row at the reconciliation''s value here — nothing changed';
  end if;
end $$;
