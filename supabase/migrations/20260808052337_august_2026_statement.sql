-- August 2026 collected, and the club's last outstanding kontingent settled (T081).
-- Source: the account statement for 4086341662, 01.06.2026 - 04.08.2026, closing
-- 16.880,00 kr. Full workings: docs/finance-reconciliation.md §17.
--
-- **Recovered from production on 2026-08-08, not authored here.** This ran against
-- the club's database at 05:23 and its repo copy was never committed, so GitHub
-- could not reproduce the club's own books for nine hours. The statements below are
-- byte-for-byte what `supabase_migrations.schema_migrations` holds for version
-- 20260808052337; only this note and the filename were added, and the filename is
-- that version so the migration is recognised as already applied rather than run a
-- second time.
--
-- One thing it names is still missing: `docs/finance-reconciliation.md §17`, the
-- workings behind these figures. It cannot be reconstructed from the database — it
-- needs the statement itself — so it is recorded as an open item rather than
-- invented. The substance survives in the two notes below: who paid on which day,
-- and the balance each figure was checked against.

-- July 2026 - Anders settled it on 03.08, so the month is whole.
-- bank_balance_kr deliberately stays at 15.080: that is what the account held on
-- 30.07.2026, which is what the column means.
update public.payments
   set amount_kr = 1800,
       note = 'Fuldt indbetalt: 1.800 kr. af 1.800 kr. opkrævet. Anders'' manglende 200 kr. kom 03.08.2026 i en samlet overførsel på 400 kr., der dækker juli og august — han havde skiftet bank (Lukas, 2026-07-30/2026-08-08). bank_balance_kr står fortsat på kontoens saldo 30.07.2026 (15.080 kr.); at det tal nu er magen til de samlede indbetalinger til og med juli er et tilfælde — saldoen indeholdt Rasmus'' augustbetaling og ikke Anders'' juli.'
 where month = date '2026-07-01'
   and amount_kr = 1600
   and bank_balance_kr = 15080;

-- August 2026 - nine of nine, and no outstanding kontingent anywhere.
insert into public.payments (month, amount_kr, bank_balance_kr, note)
select date '2026-08-01', 1800, 16880,
  'Afstemt mod kontoudtog pr. 04.08.2026, saldo 16.880,00 kr. Ni opkrævede à 200 kr., alle betalt: Rasmus 30.07, Lukas 31.07, Esben og Anders 03.08, Emil, Kasper, Mads, Have og Saaby 04.08. Anders'' 400 kr. dækker juli og august. Første gang i fjorten måneder uden udestående kontingent, og første gang de samlede indbetalinger (16.880 kr.) er nøjagtig kontoens saldo — ingen har betalt september forud endnu.'
where (select count(*) from public.members x
        where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                         'Lukas','Mads','Kasper','Have','Oskar')) = 10
on conflict (month) do nothing;
