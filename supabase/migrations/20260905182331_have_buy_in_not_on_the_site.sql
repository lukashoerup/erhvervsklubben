-- Have is billed from May 2026 again: the buy-in is tracked, not charged — yet.
--
-- Lukas, 2026-09-05, an hour after 20260905181816 put Have's charge at June 2025:
-- *"Du skal ikke skrive det nogen steder på hjemmesiden. Det er blot så vi har styr
-- på det. Vi skal lige sikre at Have er med på den."* The 1.100 kr. is the
-- treasurer's intention and has not been put to Have. Until he has agreed, it is
-- not a charge the club makes, so it must not be on /oekonomi — and `dues_from`
-- is what /oekonomi charges from. Back to 2026-05-01, the month the bank first
-- billed him, which is where T076 left it.
--
-- The receivable is kept where Lukas asked for it: in the repo (finance-
-- reconciliation.md §17.5, tasks/done/T091) and in this row's note, which nothing
-- on the site renders. When Have agrees, 20260905181816's update is the change to
-- make again, with "aftalt" meaning it.

update public.members
   set dues_from = date '2026-05-01',
       note = 'Kontingent bagud for juni 2025 til april 2026 (11 måneder à 100 kr. = 1.100 kr.) er Lukas'' hensigt (2026-07-29, 2026-09-05) og afventer aftale med Have. Ikke opkrævet i regnskabet og ikke vist på hjemmesiden, før det er aftalt. Første overførsel 04.05.2026.'
 where name = 'Have'
   and dues_from = date '2025-06-01'
   and (select count(*) from public.members x
         where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                          'Lukas','Mads','Kasper','Have','Oskar')) = 10;

do $$
declare n int;
begin
  select count(*) into n from public.members where name = 'Have' and dues_from = date '2026-05-01';
  if n = 1 then
    raise notice 'have_buy_in_not_on_the_site: Have billed from 2026-05-01; the 1.100 kr. is tracked, not charged';
  else
    raise notice 'have_buy_in_not_on_the_site: no Have row at 2025-06-01 here — nothing changed';
  end if;
end $$;
