-- October 2026 collected: nine of nine, and the account stands at 20.480,00 kr.
-- Source: four screenshots of the account ("Erhvervsklub konto") Lukas sent on
-- 2026-10-24 at 09.37, running from July 2026 to today. Full workings:
-- docs/finance-reconciliation.md §17.7.
--
-- What the screenshots show for October, newest first, with the running balance:
--
--   02.10  Overførsel (Mads)   +200   20.480,00   — the unnamed transfers are his (§16.2)
--   02.10  Kontingent Kasper   +200   20.280,00
--   02.10  Emil kontingent     +200   20.080,00
--   02.10  Mathias Saaby       +200   19.880,00
--   01.10  Anders Tørring      +200   19.680,00
--   01.10  Kontingent Esben C. +200   19.480,00
--   01.10  Christian Have      +200   19.280,00
--   30.09  Lukas               +200   19.080,00   — pays the coming month at month end,
--   29.09  Rasmus Holst Anders +200   18.880,00     as both did for August and September
--
-- 18.680 (the September row) + 9 × 200 = 20.480 = the saldo, and the screenshots say
-- "Kommende betalinger 0,00". All nine seen, none inferred. The running balances are
-- an unbroken chain from 15.080,00 on 30.07 (the T076 statement's close) to today, so
-- they also show September's three inferred transfers by sight: Rasmus 28.08,
-- Lukas 31.08, Esben 01.09. And Anders's September transfer is 01.09, not 02.09 as the
-- September row's note says — recorded in this row's note rather than by rewriting that
-- one.
--
-- `bank_balance_kr` is the balance on the day the figure was checked, 24.10.2026, as
-- the August and September rows hold theirs.
--
-- Guarded on the club's own ten names so a fresh stack or CI writes nothing, and on
-- conflict (month) so it applies exactly once — the same shape as August and
-- September. Then it reads itself back and rolls back unless everything to October
-- sums to the saldo: dated to October, so a later month does not break a re-run.

do $$
begin
  if (select count(*) from public.members x
       where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                        'Lukas','Mads','Kasper','Have','Oskar')) <> 10 then
    raise notice 'oktober_2026_statement: not this club''s database, nothing written';
    return;
  end if;

  insert into public.payments (month, amount_kr, bank_balance_kr, note)
  values (date '2026-10-01', 1800, 20480,
    'Afstemt mod kontoens saldo 24.10.2026: 20.480,00 kr. (fire skærmbilleder fra Lukas, 24.10.2026, kl. 09.37). Ni opkrævede à 200 kr., alle betalt, og alle ni ses på skærmbillederne: Rasmus 29.09 og Lukas 30.09 (de betaler måneden forud ved månedsskiftet, som i august og september), Have, Esben og Anders 01.10, Saaby, Emil, Kasper og Mads (Overførsel) 02.10. Ingen udestående kontingent, kommende betalinger 0,00, og de samlede indbetalinger (20.480 kr.) er for tredje måned i træk nøjagtig kontoens saldo. Skærmbillederne viser en ubrudt kæde af løbende saldi fra 15.080 (30.07) til 20.480 og bekræfter dermed septembers tre udledte overførsler: Rasmus 28.08, Lukas 31.08 og Esben 01.09. Anders'' septemberoverførsel er fra 01.09, ikke 02.09 som septemberrækken siger.')
  on conflict (month) do nothing;

  if (select sum(amount_kr) from public.payments where month <= date '2026-10-01') <> 20480
     or not exists (select 1 from public.payments
                     where month = date '2026-10-01'
                       and amount_kr = 1800 and bank_balance_kr = 20480) then
    raise exception 'oktober_2026_statement: payments to October do not sum to the saldo 20.480';
  end if;
end $$;
